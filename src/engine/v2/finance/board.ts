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
import type { Board, BoardSeat, BoardVote, EngineSystem, GameStateV2, GovernancePresetId, MajorDecision, OusterSeatVote, OusterVote, SeatVote, SystemCtx } from '../types';
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
 *  - control (sale of control): nothing.
 *  A merger (FIN3c) is an obligations decision: you take on the bought lab's contracts and debt, so the board asks
 *  whether the company can carry them, on the runway after the deal (finance/acquire.ts votes on that state). */
type Need = 'funding' | 'obligations' | 'control';

/** Major-decision vectors (speed, fin, safety, mission), R15 §1.6 where kept [D otherwise]. The FIN3a list: the
 *  dilution vote and the 20%-of-revenue debt vote are gone. FIN3c wires mergers (E32, E22) and the board's own vote on
 *  a sale of control (a deal, rescue or stock payment leaving one holder above 50%). */
export const MAJOR_DECISIONS: Record<MajorDecision, { label: string; v: Vec4; need: Need }> = {
  saleOfControl: { label: 'Sale of control', v: [0, 0, 0, -1], need: 'control' }, // R15 (kept)
  merger: { label: 'Merger or acquisition', v: [0.5, -0.5, 0, -0.2], need: 'obligations' }, // [D] (FIN3c: E32, E22)
  downRound: { label: 'Down round', v: [0, -0.3, 0, 0], need: 'funding' }, // [D]: prior holders lose value
  rescue: { label: 'Strategic rescue', v: [0, 0.3, 0, -0.6], need: 'funding' }, // [D]: cash for control strings
  commitments: { label: 'Firm commitments above 3× revenue', v: [0.5, -1, 0, 0], need: 'obligations' }, // R15 (kept)
  debt: { label: 'Debt above 3× revenue', v: [0.3, -1, 0, 0], need: 'obligations' }, // R15 newDebt (kept)
  // FIN3b (spec §7.2): a charter decision only the PBC + trust's trust votes on; R15's "releasing a model flagged by
  // safety" vector.
  transferModel: { label: 'Transfer of a capability-threshold model', v: [1, 0.3, -1, -0.5], need: 'control' }, // R15
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

/** A charter vote of the PBC + trust's trust (spec §7.2, FIN3b): the same seat-by-seat lean as a board vote, cast only
 *  by the trust's (mission) seats; it passes with more than half of their votes and can never be forced (founder
 *  control is not a right over the trust). */
export function trustVote(s: GameStateV2, decision: MajorDecision, trigger: string): BoardVote {
  const v = boardVote(s, decision, trigger);
  const seats = v.seats.filter((x) => x.kind === 'mission');
  const total = seats.reduce((a, x) => a + x.weight, 0);
  const yes = seats.reduce((a, x) => a + (x.yes ? x.weight : 0), 0);
  return { ...v, seats, yes, total, passes: total > 0 && yes > total / 2, canForce: false, body: 'trust' };
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
  return voteNo(vote);
}

/** Why a failed vote stops a decision (and whether founder control could force it). */
export function voteNo(vote: BoardVote): string {
  return `The ${vote.body === 'trust' ? 'trust' : 'board'} votes no on ${vote.label.toLowerCase()} (${vote.yes} of ${vote.total} votes for, needs more than half)${vote.canForce ? `; founder control can force it (confidence −${VOTE.forceCost})` : ''}`;
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
        ? [seat('founder', 'CEO'), seat('mission', 'Nonprofit board'), seat('mission', 'Nonprofit board'), seat('independent', 'Independent'), seat('independent', 'Independent')]
        : preset === 'pbcTrust'
          ? [seat('founder', 'CEO'), seat('mission', 'Trust appointee'), seat('mission', 'Trust appointee'), seat('financial', 'Lead investor'), seat('independent', 'Independent')]
          : [seat('founder', 'CEO'), seat('mission', 'Foundation board'), seat('mission', 'Foundation board'), seat('financial', 'Lead investor'), seat('independent', 'Independent')];
  return { preset, seats, confidence: 70, safetyCommitteeVeto: preset === 'nonprofitPBC' };
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
  b.seats.push(seat(kind, holder, weight));
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
  // FIN3a (spec §7.4): the board minds distress, not a tight runway (the FIN2 "tight runway" −5 is gone). FIN3b (spec
  // §0.3, §8): distress costs no staff morale; finance reaches staff only through cash.
  if (f.state === 'distress') boardMood(s, ctx, 'setbacks', MOOD_BASE.distressQ, 'financial distress');
}

/** Board-confidence anchor and quarterly reversion [D, M4]: with no news the board's mood drifts back toward 60 by
 *  10% of the gap each quarter (boards forgive slowly; a bad year still sticks). */
export const BC_ANCHOR = 60;
export const BC_REVERT_Q = 0.1;
/** Ouster telegraph [D, M4]: below BC_WARN the board warns the CEO (an alert); the warning clears at BC_CLEAR. The ouster
 *  vote (spec §7.5) is held at a quarterly review only while confidence is below OUSTER_BC and the warning is at least
 *  OUSTER_NOTICE_D days old. */
export const BC_WARN = 35;
export const BC_CLEAR = 45;
export const OUSTER_BC = 25;
export const OUSTER_NOTICE_D = 60;
/** The ouster vote's terms [D, FIN3b]: a seat's lean = its grievance + depth − reluctance, depth = (25 − confidence) /
 *  OUSTER.span (0 at the line, 1 at zero confidence), reluctance 1.5; the legacy nonprofit's board removes a CEO more
 *  easily (spec §7.2 "ouster odds ×2"): its reluctance is halved (0.75). So a seat turns once confidence falls below
 *  25 − 25 × (reluctance − grievance): a grievance under 0.5 never turns a seat (0.75 less on the legacy board).
 *  Calibrated on the bots (FIN3b notes: reluctance 1 ousted a third more of them). No dice: FIN3b replaced the
 *  15%-a-quarter roll and the staff-revolt reinstatement. */
export const OUSTER = { span: 25, reluctance: 1.5, legacyMult: 0.5 } as const;

/** A division head answers to the parent, which has no confidence vote (STRUCTURE §4.8, R9). */
const noOuster = (s: GameStateV2) => s.player.board.preset === 'parent';

/** Whether an ouster vote is held at the next quarterly review (confidence below the line, warning old enough). */
export function ousterLive(s: GameStateV2, day = s.time.day): boolean {
  const warn = s.player.finance.ws3?.boardWarnDay;
  return !noOuster(s) && s.player.board.confidence < OUSTER_BC && warn !== undefined && day - warn >= OUSTER_NOTICE_D;
}

/**
 * The grievance a removal vote reads from the last year's confidence losses (M4, kept): public incidents read as
 * "too reckless" (replace with a careful CEO: v = [−0.5, 0.5, 1, 0.5]); financial setbacks (down rounds, distress,
 * covenants, failed raises) as "burning the company" (v = [−0.3, 1, 0, 0]); everything else (missed promises, falling
 * behind, pauses) as "too slow" (replace with a driver: v = [1, 0.5, −0.5, −0.5]). The critics' seat reads the same
 * shares.
 */
export function boardGrievance(s: GameStateV2): { slow: number; reckless: number; burn: number; v: Vec4 } {
  const day = s.time.day;
  let slow = 0;
  let reck = 0;
  let burn = 0;
  for (const e of s.causes.byKey['board.confidence'] ?? []) {
    if (e.delta >= 0 || e.day < day - 365) continue;
    const src = MOOD_SOURCE_OF[e.source];
    if (src === 'incidents') reck -= e.delta;
    else if (src === 'setbacks') burn -= e.delta;
    else if (src) slow -= e.delta;
  }
  const tot = slow + reck + burn;
  const a = tot > 0 ? slow / tot : 1;
  const b = tot > 0 ? reck / tot : 0;
  const c = tot > 0 ? burn / tot : 0;
  return { slow: a, reckless: b, burn: c, v: [a - 0.5 * b - 0.3 * c, 0.5 * a + 0.5 * b + c, -0.5 * a + b, -0.5 * a + 0.5 * b] };
}

/**
 * The ouster vote, seat by seat (FIN3b, spec §7.5): each voting seat other than the CEO's leans grievance + depth −
 * reluctance, grievance = stance' · v (stance' = stance + the outside-ownership drift on speed and fin, as before),
 * and votes yes above 0; the vote passes when the weighted yes is more than half. A mission board shields a cautious
 * CEO and turns on a reckless one (Nov 2023); financial and strategic seats do the opposite. `bc` previews the vote at
 * another confidence (the Board card shows where each seat turns).
 */
export function ousterVote(s: GameStateV2, bc = s.player.board.confidence): OusterVote {
  const g = boardGrievance(s);
  const v = g.v;
  const drift = outsideShare(s.player.finance.ownership);
  const R = OUSTER.reluctance * (s.player.board.preset === 'legacyNonprofit' ? OUSTER.legacyMult : 1);
  const depth = (OUSTER_BC - bc) / OUSTER.span;
  const seats: OusterSeatVote[] = [];
  if (!noOuster(s)) {
    for (const x of s.player.board.seats) {
      if (x.weight <= 0 || x.kind === 'founder') continue;
      const grievance = (x.stance[0] + drift) * v[0] + (x.stance[1] + drift) * v[1] + x.stance[2] * v[2] + x.stance[3] * v[3];
      const lean = grievance + depth - R;
      // depth needed = R − grievance: the seat turns below 25 − span × that (never if that needs confidence below 0).
      const need = R - grievance;
      const turns = OUSTER_BC - OUSTER.span * Math.max(0, need);
      seats.push({ holder: x.holder, kind: x.kind, weight: x.weight, yes: lean > 0, lean, parts: { grievance, depth, reluctance: R }, ...(turns > 0 ? { turnsBelow: turns } : {}) });
    }
  }
  const total = seats.reduce((a, x) => a + x.weight, 0);
  const yes = seats.reduce((a, x) => a + (x.yes ? x.weight : 0), 0);
  return { seats, yes, total, passes: total > 0 && yes > total / 2, live: ousterLive(s), grievance: { slow: g.slow, reckless: g.reckless, burn: g.burn }, reluctance: R };
}

/** Board confidence below which the ouster vote would pass on today's grievance and board (undefined: never). */
export function ousterPassesBelow(s: GameStateV2): number | undefined {
  const ov = ousterVote(s, 0);
  if (!ov.passes) return undefined;
  // The vote passes once enough seats have turned: walk the seats from the first to turn.
  const turns = ov.seats.filter((x) => x.turnsBelow !== undefined).sort((a, b) => (b.turnsBelow ?? 0) - (a.turnsBelow ?? 0));
  let yes = 0;
  for (const x of turns) {
    yes += x.weight;
    if (yes > ov.total / 2) return x.turnsBelow;
  }
  return undefined;
}

// ───────────────────────────── Give the critics a seat (spec §7.5) ─────────────────────────────

/** The critics' seat [D, FIN3b]: available below 40 confidence, once a year, while the board has fewer than 9 voting
 *  seats (R15: boards of 5–9); +15 confidence now. */
export const CRITICS = { below: 40, gain: 15, cooldownD: 365, maxVoting: 9 } as const;

/** Which side is driving the decline (spec §7.5): the mission side when the last year's losses were mostly public
 *  incidents ("too reckless"); otherwise the investors (falling behind, missed promises, financial setbacks). */
export function criticsSide(s: GameStateV2): { side: 'investors' | 'mission'; kind: 'financial' | 'mission'; holder: string; why: string } {
  const g = boardGrievance(s);
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  if (g.reckless > g.slow + g.burn) return { side: 'mission', kind: 'mission', holder: 'Safety director', why: `public incidents drove ${pct(g.reckless)} of the year's losses` };
  return { side: 'investors', kind: 'financial', holder: 'Investor director', why: `falling behind and missed promises ${pct(g.slow)}, financial setbacks ${pct(g.burn)} of the year's losses` };
}

export function criticsAvailable(s: GameStateV2): true | string {
  const b = s.player.board;
  if (noOuster(s)) return 'A division answers to its parent, not a board';
  if (s.player.finance.state === 'insolvent') return 'Insolvent';
  if (b.confidence >= CRITICS.below) return `Only when board confidence is below ${CRITICS.below}`;
  const last = s.player.finance.ws3?.criticsDay;
  if (last !== undefined && s.time.day - last < CRITICS.cooldownD) return `Once a year: critics last joined on day ${last}`;
  if (b.seats.filter((x) => x.weight > 0).length >= CRITICS.maxVoting) return `The board is full (${CRITICS.maxVoting} voting seats)`;
  return true;
}

/** The new director's seat (pure: the preview's before → after reads it). */
export function criticsSeat(s: GameStateV2): BoardSeat {
  const c = criticsSide(s);
  const year = new Date(Date.parse(s.time.startDate) + s.time.day * 864e5).getUTCFullYear();
  return seat(c.kind, `${c.holder} (${year})`);
}

/** The board with the critics' seat added (pure; previews). */
export function withCriticsSeat(s: GameStateV2): GameStateV2 {
  return { ...s, player: { ...s.player, board: { ...s.player.board, seats: [...s.player.board.seats, criticsSeat(s)] } } };
}

/** What the critics' seat does to the ouster vote on today's grievance: the confidence it would pass below, before and
 *  after the new director joins (undefined: no majority), and the margin above that line after the +15. */
export function criticsOusterShift(s: GameStateV2): { before?: number; after?: number; marginBefore: number; marginAfter: number } {
  const before = ousterPassesBelow(s);
  const after = ousterPassesBelow(withCriticsSeat(s));
  const bc = s.player.board.confidence;
  return { ...(before !== undefined ? { before } : {}), ...(after !== undefined ? { after } : {}), marginBefore: bc - (before ?? 0), marginAfter: Math.min(100, bc + CRITICS.gain) - (after ?? 0) };
}

/** Give the critics a seat: the side driving the decline gets a director for good; confidence +15 now. */
export function giveCriticsSeat(s: GameStateV2, ctx: SystemCtx): string | undefined {
  const ok = criticsAvailable(s);
  if (ok !== true) return ok;
  ensureWs3(s);
  const c = criticsSide(s);
  const x = criticsSeat(s);
  s.player.board.seats.push(x);
  s.player.finance.ws3.criticsDay = s.time.day;
  ctx.bump('board.confidence', CRITICS.gain, 'critics given a seat', x.holder);
  ctx.log('finance', `${x.holder} joins the board: ${c.why}. Board confidence +${CRITICS.gain}; the board now leans ${c.side === 'mission' ? 'toward caution' : 'toward speed'} for good.`, 3);
  ctx.headline('critics-seat', `${s.player.name} adds a ${c.side === 'mission' ? 'safety-minded' : 'investor-backed'} director to quiet its board`);
  return undefined;
}

/** Behind the best rival this quarter (intel estimate, never truth): more than the start type's expected lag. */
export function behindRival(s: GameStateV2): boolean {
  const rivals = activeRivals(s);
  const expected = (startOf(s).lagMonths * 365) / 12;
  return rivals.length > 0 && Math.min(...rivals.map((r) => leadDays(s, r.core.id).est)) < -expected;
}

/** boardQ (430, quarterly): board confidence and its sources, runway state machine, the ouster vote (§3.7.5, FIN3b). */
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
      ctx.log('alert', `The board is losing confidence (${b.confidence.toFixed(0)}). Below ${OUSTER_BC} directors vote on removing you at quarterly reviews. Results restore it; below ${CRITICS.below} you can give the critics a seat (Finance › Board).`, 4);
    } else if (b.confidence >= BC_CLEAR && fx.boardWarnDay !== undefined) {
      delete fx.boardWarnDay;
      ctx.log('finance', 'The board has steadied: no more talk of a leadership change.');
    }
    // The ouster vote (FIN3b, spec §7.5): at a review below 25 with a warning at least 60 days old, the board votes seat
    // by seat (no dice; the Board card shows the vote beforehand). WS4 endings read flags['ws3.ousterDay'].
    if (ousterLive(s) && s.flags['ws3.ousterDay'] === undefined) {
      const ov = ousterVote(s);
      if (ov.passes) {
        s.flags['ws3.ousterDay'] = s.time.day;
        ctx.log('alert', `The board has voted to remove the CEO (${ov.yes} of ${ov.total} votes).`, 5);
        ctx.headline('ouster', `${s.player.name} board ousts its chief executive`);
      } else ctx.log('alert', `The board voted on removing you and fell short (${ov.yes} of ${ov.total} votes). It votes again at every review while confidence is below ${OUSTER_BC}.`, 4);
    }
  },
};
