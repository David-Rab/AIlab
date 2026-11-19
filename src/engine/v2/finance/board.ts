// Board: seats, stances, major-decision votes, confidence and its sources, runway state machine, ouster (V2-SPEC
// §3.7.5–3.7.6; research/15 §1.6, §1.8; FINANCE-V3 §7.3–§7.4, FIN3a). Owner: WS3.
//
// FIN3a: the board votes only on major decisions (sale of control, merger or acquisition, down round, rescue, firm
// commitments or debt above 3× revenue), seat by seat and without dice; the vote is shown before you ask and passes
// when the weighted yes is more than half. Operating decisions (compute orders, releases, research, pricing) are never
// voted on. Board confidence moves only on named sources, each weighted by the kinds of seat on the board, and drifts
// back toward 60.
import { startOf } from '../../../data/v2/starts';
import { leadDays } from '../actors/intel';
import { activeRivals } from '../models/labs';
import type { Board, BoardSeat, BoardVote, EngineSystem, GameStateV2, GovernancePresetId, MajorDecision, SeatVote, SystemCtx } from '../types';
import { ensureWs3, yearStats } from './ext';
import { outsideShare } from './equity';
import { commitmentsPerYear } from './ledger';
import { runwayOf } from './runway';
import { boardMood, incidentHit, INCIDENT_BC_CAP_Q, MOOD_BASE, MOOD_SOURCE_OF } from './mood';

type Vec4 = [number, number, number, number];

/** Stance vectors (speed, fin, safety, mission) from R15 §1.6. The founder/CEO seat votes the player's way [D]. */
export const SEAT_STANCE: Record<BoardSeat['kind'], Vec4> = {
  founder: [1, 0.3, 0.2, 0.3],
  mission: [-0.5, 0.3, 1, 1],
  financial: [1, 0.6, -0.2, 0],
  strategic: [0.5, 0, 0, 0],
  independent: [0, 0.5, 0.3, 0.3],
  gov: [0.2, 0.3, 0.6, 0.4],
};

// ───────────────────────────── Major decisions (spec §7.3) ─────────────────────────────

/** What every seat weighs besides its stance [D]:
 *  - funding (down round, rescue): the shorter the runway, the more the board wants the money (the alternative is
 *    running out of cash): +(6 − runway q)/4, 0 … +1.2;
 *  - obligations (commitments, debt above 3× revenue): whether the company can carry them: (runway q − 4)/8, −0.5 …
 *    +0.5;
 *  - control (sale of control, merger): nothing. */
type Need = 'funding' | 'obligations' | 'control';

/** Major-decision vectors (speed, fin, safety, mission), R15 §1.6 where kept [D otherwise]. The FIN3a list: the
 *  dilution vote and the 20%-of-revenue debt vote are gone; FIN3c wires sale of control and mergers. */
export const MAJOR_DECISIONS: Record<MajorDecision, { label: string; v: Vec4; need: Need }> = {
  saleOfControl: { label: 'Sale of control', v: [0, 0, 0, -1], need: 'control' }, // R15 (kept)
  merger: { label: 'Merger or acquisition', v: [0.5, -0.5, 0, -0.2], need: 'control' }, // [D] (FIN3c)
  downRound: { label: 'Down round', v: [0, -0.3, 0, 0], need: 'funding' }, // [D]: prior holders lose value
  rescue: { label: 'Strategic rescue', v: [0, 0.3, 0, -0.6], need: 'funding' }, // [D]: cash for control strings
  commitments: { label: 'Firm commitments above 3× revenue', v: [0.5, -1, 0, 0], need: 'obligations' }, // R15 (kept)
  debt: { label: 'Debt above 3× revenue', v: [0.3, -1, 0, 0], need: 'obligations' }, // R15 newDebt (kept)
};

/** Vote terms [D]: board mood (BC − 50)/50 (−1 … +1) and the two situation curves above; a forced decision costs −20
 *  confidence (kept). */
export const VOTE = { moodSpan: 50, fundingQ: 6, fundingSpan: 4, fundingMax: 1.2, carryQ: 4, carrySpan: 8, carryMax: 0.5, forceCost: 20 } as const;
/** Firm commitments (payments due in the next four quarters) or debt above this multiple of revenue need the board
 *  (spec §7.3) [D]. */
export const OBLIGATION_X_REVENUE = 3;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** The situation term every seat shares, with its words. */
export function voteNeed(s: GameStateV2, need: Need): { v: number; label: string } {
  if (need === 'control') return { v: 0, label: 'no situation term' };
  const q = runwayOf(s).q;
  if (need === 'funding') {
    const v = clamp((VOTE.fundingQ - q) / VOTE.fundingSpan, 0, VOTE.fundingMax);
    return { v, label: `runway ${q.toFixed(1)} q: ${v > 0 ? 'the alternative is running out of cash' : 'no pressing need for cash'}` };
  }
  const v = clamp((q - VOTE.carryQ) / VOTE.carrySpan, -VOTE.carryMax, VOTE.carryMax);
  return { v, label: `runway ${q.toFixed(1)} q: ${v >= 0 ? 'the company can carry it' : 'too little cash to carry it'}` };
}

/** Founder control (spec §7.2 founder super-voting, §2.6 dual-class): the founder preset before listing, or any
 *  company listed with dual-class shares. It lets the CEO force a major decision past the board at a confidence cost. */
export function founderControl(s: GameStateV2): boolean {
  const f = s.player.finance;
  if (f.dualClass) return true;
  return s.player.board.preset === 'founder' && f.ownership.public <= 0;
}

/**
 * The board's vote on a major decision, seat by seat (FIN3a, spec §7.3). Each voting seat's lean = its stance · the
 * decision vector + the outside-ownership drift (+0.1 to speed and fin per 10 points outside, R15 §1.6) + the board's
 * mood (BC − 50)/50 + the situation term; it votes yes when its lean is above 0. The CEO's seat votes yes. Observers
 * (weight 0) do not vote. Passes when the yes weight is more than half of the voting weight. No dice.
 */
export function boardVote(s: GameStateV2, decision: MajorDecision, trigger: string): BoardVote {
  const b = s.player.board;
  const d = MAJOR_DECISIONS[decision];
  const v = d.v;
  const drift = outsideShare(s.player.finance.ownership) * (v[0] + v[1]);
  const mood = (b.confidence - 50) / VOTE.moodSpan;
  const need = voteNeed(s, d.need);
  const seats: SeatVote[] = [];
  for (const x of b.seats) {
    if (x.weight <= 0) continue;
    const stance = x.stance[0] * v[0] + x.stance[1] * v[1] + x.stance[2] * v[2] + x.stance[3] * v[3];
    const ceo = x.kind === 'founder';
    const lean = stance + drift + mood + need.v;
    seats.push({ holder: x.holder, kind: x.kind, weight: x.weight, yes: ceo || lean > 0, lean, parts: { stance, drift, mood, need: need.v } });
  }
  const total = seats.reduce((a, x) => a + x.weight, 0);
  const yes = seats.reduce((a, x) => a + (x.yes ? x.weight : 0), 0);
  return { decision, label: d.label, trigger, needLabel: need.label, seats, yes, total, passes: total > 0 && yes > total / 2, canForce: founderControl(s) };
}

/** The vote new firm commitments need: when payments due in the next four quarters would exceed 3× revenue. */
export function commitmentsVote(s: GameStateV2, addPerYear: number): BoardVote | undefined {
  const R = Math.max(1, s.player.finance.revenueRun);
  const after = commitmentsPerYear(s, true) + addPerYear;
  if (addPerYear <= 0 || after <= OBLIGATION_X_REVENUE * R) return undefined;
  return boardVote(s, 'commitments', `firm payments $${after.toFixed(0)}B a year vs 3× revenue $${(OBLIGATION_X_REVENUE * R).toFixed(0)}B`);
}

/** The vote new debt needs: when drawn debt after the draw would exceed 3× revenue (any instrument). */
export function debtVote(s: GameStateV2, amount: number): BoardVote | undefined {
  const R = Math.max(1, s.player.finance.revenueRun);
  const after = s.player.finance.debts.reduce((a, d) => a + d.drawn, 0) + amount;
  if (amount <= 0 || after <= OBLIGATION_X_REVENUE * R) return undefined;
  return boardVote(s, 'debt', `debt $${after.toFixed(0)}B vs 3× revenue $${(OBLIGATION_X_REVENUE * R).toFixed(0)}B`);
}

/** Undefined when the decision may go ahead (no vote needed, the vote passes, or founder control forces it at −20
 *  confidence); otherwise why the board stopped it. A failed vote has no side effects (no dice to re-roll, no block). */
export function voteGate(ctx: SystemCtx, vote: BoardVote | undefined, force: boolean): string | undefined {
  if (!vote || vote.passes) return undefined;
  if (force && vote.canForce) {
    ctx.bump('board.confidence', -VOTE.forceCost, 'forced past the board', vote.label);
    ctx.log('finance', `Founder control forced "${vote.label}" past the board (${vote.yes} of ${vote.total} votes): board confidence −${VOTE.forceCost}.`, 2);
    return undefined;
  }
  return `The board votes no on ${vote.label.toLowerCase()} (${vote.yes} of ${vote.total} votes for, needs more than half)${vote.canForce ? `; founder control can force it (confidence −${VOTE.forceCost})` : ''}`;
}

/** Preview line for a vote: the force cost when forcing a vote that fails. */
export function voteCost(vote: BoardVote | undefined, force: boolean): { currency: 'boardConf'; amount: number; target: string }[] {
  return vote && !vote.passes && force && vote.canForce ? [{ currency: 'boardConf', amount: -VOTE.forceCost, target: 'forced past the board (founder control)' }] : [];
}

// ───────────────────────────── Seats ─────────────────────────────

const seat = (kind: BoardSeat['kind'], holder: string, weight = 1): BoardSeat => ({ kind, holder, stance: [...SEAT_STANCE[kind]], weight });

/** The big-tech parent's seat (research/18 §3.2): votes speed +0.5, finance +1.0, safety +0.2, mission 0 [Design]. */
export const PARENT_STANCE: Vec4 = [0.5, 1, 0.2, 0];

export function initialBoard(preset: GovernancePresetId): Board {
  const seats: BoardSeat[] =
    preset === 'parent'
      ? [seat('founder', 'Division head'), { kind: 'strategic', holder: 'Parent company', stance: [...PARENT_STANCE], weight: 2 }]
      : preset === 'founder'
      ? [seat('founder', 'CEO', 2), seat('financial', 'Lead investor'), seat('independent', 'Independent')]
      : preset === 'legacyNonprofit'
        ? [seat('founder', 'CEO'), seat('mission', 'Nonprofit board'), seat('mission', 'Nonprofit board'), seat('independent', 'Independent'), seat('independent', 'Independent'), seat('strategic', 'Northwind Cloud (observer)', 0)]
        : preset === 'pbcTrust'
          ? [seat('founder', 'CEO'), seat('mission', 'Trust appointee'), seat('mission', 'Trust appointee'), seat('financial', 'Lead investor'), seat('independent', 'Independent'), seat('strategic', 'Northwind Cloud (observer)', 0)]
          : [seat('founder', 'CEO'), seat('mission', 'Foundation board'), seat('mission', 'Foundation board'), seat('financial', 'Lead investor'), seat('independent', 'Independent'), seat('strategic', 'Northwind Cloud (observer)', 0)];
  return { preset, seats, confidence: 70, safetyCommitteeVeto: preset === 'nonprofitPBC' };
}

/** Whether the board has this action blocked (E37's capex freeze; FIN3a votes never block). */
export function boardBlocked(s: GameStateV2, actionId: string): number | undefined {
  const until = s.player.finance.ws3?.blockedUntil[actionId];
  return until !== undefined && until > s.time.day ? until : undefined;
}

/** Add (or upgrade) a partner's seat. */
export function addSeat(s: GameStateV2, kind: BoardSeat['kind'], holder: string, weight: number): void {
  const b = s.player.board;
  const ex = b.seats.find((x) => x.holder.startsWith(holder));
  if (ex) {
    ex.weight = Math.max(ex.weight, weight);
    if (weight > 0) ex.holder = holder;
    return;
  }
  b.seats.push(seat(kind, weight > 0 ? holder : `${holder} (observer)`, weight));
}

/** Founder preset: one financial seat each time own_fin crosses 15/30/45% (R15). */
function syncFinancialSeats(s: GameStateV2) {
  if (s.player.board.preset !== 'founder') return;
  const want = 1 + [0.15, 0.3, 0.45].filter((t) => s.player.finance.ownership.fin >= t).length;
  const have = s.player.board.seats.filter((x) => x.kind === 'financial').length;
  for (let i = have; i < want; i++) s.player.board.seats.push(seat('financial', `Investor ${i + 1}`));
}

// ───────────────────────────── Runway state ─────────────────────────────

/** Runway state machine (R15 §1.8), applied quarterly in boardQ. Logs transitions and applies state effects. */
export function updateRunwayState(s: GameStateV2, ctx: SystemCtx): void {
  const f = s.player.finance;
  if (f.state === 'insolvent') return;
  const r = runwayOf(s);
  f.runwayQ = Math.round(r.q * 10) / 10;
  const breach = f.covenantBreachDay !== undefined;
  const next: typeof f.state = breach || r.q < 3 ? 'distress' : r.q < 6 ? 'tight' : 'healthy';
  const ys = yearStats(s);
  ys.minRunwayQ = Math.min(ys.minRunwayQ, r.q);
  if (next !== f.state) {
    if (next === 'distress') {
      f.ws3.distressSinceDay = s.time.day;
      ctx.log('alert', `Financial distress: ${r.q.toFixed(1)} quarters of runway${breach ? ' and a covenant breach' : ''}. Revolver frozen; only rescue capital.`, 4);
      ctx.headline('distress', `${s.player.name} scrambles for cash as compute bills mount`);
    } else if (f.state === 'distress') {
      delete f.ws3.distressSinceDay;
      ctx.log('finance', 'Out of distress.');
      // FIN3a (spec §7.5): results restore confidence; leaving distress is one.
      boardMood(s, ctx, 'setbacks', MOOD_BASE.distressEnded, 'out of distress');
    }
    f.state = next;
  }
  // FIN3a (spec §7.4): the board minds distress, not a tight runway (the FIN2 "tight runway" −5 is gone).
  if (f.state === 'distress') {
    boardMood(s, ctx, 'setbacks', MOOD_BASE.distressQ, 'financial distress');
    ctx.bump('morale', -5, 'financial distress', 'talent attrition');
  }
}

/** Board-confidence anchor and quarterly reversion [D, M4]: with no news the board's mood drifts back toward 60 by
 *  10% of the gap each quarter (boards forgive slowly; a bad year still sticks). */
export const BC_ANCHOR = 60;
export const BC_REVERT_Q = 0.1;
/** Ouster telegraph [D, M4]: below BC_WARN the board warns the CEO (alert + E37 "Board revolt" with counterplay); the
 *  ouster vote (§3.7.5: BC < 25, p = 0.15/q, × 2 legacy) only rolls once a warning is ≥ OUSTER_NOTICE_D days old. */
export const BC_WARN = 35;
export const BC_CLEAR = 45;
export const OUSTER_BC = 25;
export const OUSTER_NOTICE_D = 60;
/** Staff revolt (§3.7.5, Nov 2023 precedent): an ouster with morale.overall > 70 reinstates the CEO once per game;
 *  confidence resets to 45 and a mission seat becomes an independent [D]. */
export const REINSTATE_MORALE = 70;

/** Quarterly ouster probability once the vote is live (0 when BC ≥ 25 or no warning yet). UI: board panel. */
export function ousterRiskQ(s: GameStateV2): number {
  const fx = s.player.finance.ws3;
  // A division head answers to the parent, which has no confidence vote (STRUCTURE §4.8: no parent-confidence
  // mechanic, R9).
  if (s.player.board.preset === 'parent') return 0;
  if (s.player.board.confidence >= OUSTER_BC || fx?.boardWarnDay === undefined || s.time.day - fx.boardWarnDay < OUSTER_NOTICE_D) return 0;
  return 0.15 * (s.player.board.preset === 'legacyNonprofit' ? 2 : 1) * ousterMajorityP(s);
}

/**
 * The ouster is a board vote (M4, §3.7.5 stances) [D]. The grievance comes from the last year's confidence hits:
 * public incidents read as "too reckless" (replace with a careful CEO: v = [−0.5, 0.5, 1, 0.5]); financial setbacks
 * (down rounds, distress, covenants, failed raises) as "burning the company" (v = [−0.3, 1, 0, 0]); everything else —
 * missed promises, falling behind, pauses — as "too slow" (replace with a driver: v = [1, 0.5, −0.5, −0.5]). Each
 * voting seat other than the CEO's votes yes with σ(stance'·v / 0.5), stance' = stance + the outside-ownership drift on
 * speed and fin; returns P(weighted yes > half). A mission board shields a cautious CEO and turns on a reckless one
 * (Nov 2023); financial and strategic seats do the opposite. (FIN3b makes this vote visible and deterministic.)
 */
export function ousterMajorityP(s: GameStateV2): number {
  const day = s.time.day;
  let slow = 0;
  let reck = 0;
  let burn = 0;
  for (const e of s.causes.byKey['board.confidence'] ?? []) {
    if (e.delta >= 0 || e.day < day - 365) continue;
    const src = MOOD_SOURCE_OF[e.source];
    if (src === 'incidents') reck -= e.delta;
    else if (src === 'setbacks') burn -= e.delta;
    else slow -= e.delta;
  }
  const tot = slow + reck + burn;
  const a = tot > 0 ? slow / tot : 1;
  const b = tot > 0 ? reck / tot : 0;
  const c = tot > 0 ? burn / tot : 0;
  const v = [a - 0.5 * b - 0.3 * c, 0.5 * a + 0.5 * b + c, -0.5 * a + b, -0.5 * a + 0.5 * b];
  const drift = outsideShare(s.player.finance.ownership);
  const voters = s.player.board.seats.filter((x) => x.weight > 0 && x.kind !== 'founder');
  if (!voters.length) return 0;
  const W = voters.reduce((acc, x) => acc + x.weight, 0);
  const pYes = voters.map((x) => 1 / (1 + Math.exp(-((x.stance[0] + drift) * v[0] + (x.stance[1] + drift) * v[1] + x.stance[2] * v[2] + x.stance[3] * v[3]) / 0.5)));
  // Exact over seat outcomes (boards have ≤ ~10 voting seats).
  let pMaj = 0;
  const n = Math.min(voters.length, 12);
  for (let m = 0; m < 1 << n; m++) {
    let p = 1;
    let yes = 0;
    for (let i = 0; i < n; i++) {
      if (m & (1 << i)) {
        p *= pYes[i];
        yes += voters[i].weight;
      } else p *= 1 - pYes[i];
    }
    if (yes > W / 2) pMaj += p;
  }
  return pMaj;
}

/** Behind the best rival this quarter (intel estimate, never truth): more than the start type's expected lag. */
export function behindRival(s: GameStateV2): boolean {
  const rivals = activeRivals(s);
  const expected = (startOf(s).lagMonths * 365) / 12;
  return rivals.length > 0 && Math.min(...rivals.map((r) => leadDays(s, r.core.id).est)) < -expected;
}

/** boardQ (430, quarterly): board confidence and its sources, runway state machine, ouster roll (§3.7.5). */
export const boardQSystem: EngineSystem = {
  id: 'boardQ', owner: 'WS3', cadence: 'quarterly', order: 430, system: 'finance',
  run(s, ctx) {
    ensureWs3(s);
    const f = s.player.finance;
    const fx = f.ws3;
    const b = s.player.board;
    syncFinancialSeats(s);
    // Reversion toward the anchor (applied first: this quarter's news lands on top).
    const rev = BC_REVERT_Q * (BC_ANCHOR - b.confidence);
    if (Math.abs(rev) >= 0.5) ctx.bump('board.confidence', rev, 'board memory fades');
    // FIN2 (spec §7.4): no revenue plan. The board judges the milestones the company promised its investors when it
    // raised (finance/promises.ts, judged in capitalQ); if you never raise, you owe nobody a milestone. FIN3a: no
    // safety-grade bonus.
    // Behind the best rival: a board that backed a follower (R9 start types) expects its start lag and minds only
    // falling further behind than that.
    if (behindRival(s)) boardMood(s, ctx, 'behind', MOOD_BASE.behindQ, 'behind a rival');
    // Public incidents last quarter, by severity, capped per quarter, then × the board's incident multiplier.
    let incHit = 0;
    for (const inc of s.player.safety.incidents) {
      if (inc.day < s.time.day - 91 || inc.labId !== 'player') continue;
      if (inc.exposure !== 'public' && inc.status !== 'leaked') continue;
      const hit = Math.min(incidentHit(inc.severity), INCIDENT_BC_CAP_Q - incHit);
      if (hit <= 0) break;
      incHit += hit;
      boardMood(s, ctx, 'incidents', -hit, 'public incident', inc.id);
    }
    updateRunwayState(s, ctx);
    // Telegraph: the board warns below BC_WARN; the warning clears once confidence recovers.
    if (b.confidence < BC_WARN && fx.boardWarnDay === undefined && b.preset !== 'parent') {
      fx.boardWarnDay = s.time.day;
      ctx.log('alert', `The board is losing confidence (${b.confidence.toFixed(0)}). Below ${OUSTER_BC} directors may vote to remove you at a quarterly review.`, 4);
    } else if (b.confidence >= BC_CLEAR && fx.boardWarnDay !== undefined) {
      delete fx.boardWarnDay;
      ctx.log('finance', 'The board has steadied: no more talk of a leadership change.');
    }
    // Ouster roll (BC < 25 after a warning): p = 0.15/q, × 2 for the legacy nonprofit preset. WS4 endings read
    // flags['ws3.ousterDay']. (FIN3b: the seat-by-seat ouster vote.)
    const p = ousterRiskQ(s);
    if (p > 0 && s.flags['ws3.ousterDay'] === undefined && ctx.rng('finance').chance(p)) {
      if (s.player.morale.overall > REINSTATE_MORALE && fx.reinstatedDay === undefined) {
        fx.reinstatedDay = s.time.day;
        const m = b.seats.find((x) => x.kind === 'mission' && x.weight > 0) ?? b.seats.find((x) => x.kind !== 'founder' && x.weight > 0);
        if (m) Object.assign(m, { kind: 'independent', holder: 'New independent', stance: [...SEAT_STANCE.independent] });
        ctx.bump('board.confidence', 45 - b.confidence, 'CEO reinstated');
        delete fx.boardWarnDay;
        ctx.log('alert', 'The board voted to remove you; staff threatened to walk out and the board reversed itself. You are back, with a reshaped board.', 5);
        ctx.headline('reinstated', `${s.player.name} CEO reinstated days after board ouster`);
      } else {
        s.flags['ws3.ousterDay'] = s.time.day;
        ctx.log('alert', 'The board has voted to remove the CEO.', 5);
        ctx.headline('ouster', `${s.player.name} board ousts its chief executive`);
      }
    }
  },
};
