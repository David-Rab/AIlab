// Board: seats, stances, approvals, confidence, runway state machine, ouster (V2-SPEC §3.7.5–3.7.6; research/15 §1.6,
// §1.8). Owner: WS3.
import { leadDays } from '../actors/intel';
import { activeRivals } from '../models/labs';
import type { Board, BoardSeat, EngineSystem, GameStateV2, GovernancePresetId, SystemCtx } from '../types';
import { ensureWs3, yearStats } from './ext';
import { outsideShare } from './equity';
import { runwayOf } from './runway';

/** Stance vectors (speed, fin, safety, mission) from R15 §1.6. The founder/CEO seat votes the player's way [D]. */
export const SEAT_STANCE: Record<BoardSeat['kind'], [number, number, number, number]> = {
  founder: [1, 0.3, 0.2, 0.3],
  mission: [-0.5, 0.3, 1, 1],
  financial: [1, 0.6, -0.2, 0],
  strategic: [0.5, 0, 0, 0],
  independent: [0, 0.5, 0.3, 0.3],
  gov: [0.2, 0.3, 0.6, 0.4],
};

/** Major-decision action vectors (R15 §1.6). Other workstreams call `boardApproval(s, ctx, BOARD_VECTORS.x, id)`. */
export const BOARD_VECTORS = {
  pauseTraining: [-1, 0, 1, 0.5],
  declineTopDeployment: [-0.5, -0.5, 0.5, 0.3],
  newDebt: [0.3, -1, 0, 0],
  commitments: [0.5, -1, 0, 0],
  dilution: [0.3, 0, 0, -0.2],
  releaseFlagged: [1, 0.3, -1, -0.5],
  saleOfControl: [0, 0, 0, -1],
} satisfies Record<string, [number, number, number, number]>;

const seat = (kind: BoardSeat['kind'], holder: string, weight = 1): BoardSeat => ({ kind, holder, stance: [...SEAT_STANCE[kind]], weight });

export function initialBoard(preset: GovernancePresetId): Board {
  const seats: BoardSeat[] =
    preset === 'founder'
      ? [seat('founder', 'CEO', 2), seat('financial', 'Lead investor'), seat('independent', 'Independent')]
      : preset === 'legacyNonprofit'
        ? [seat('founder', 'CEO'), seat('mission', 'Nonprofit board'), seat('mission', 'Nonprofit board'), seat('independent', 'Independent'), seat('independent', 'Independent'), seat('strategic', 'Northwind Cloud (observer)', 0)]
        : preset === 'pbcTrust'
          ? [seat('founder', 'CEO'), seat('mission', 'Trust appointee'), seat('mission', 'Trust appointee'), seat('financial', 'Lead investor'), seat('independent', 'Independent'), seat('strategic', 'Northwind Cloud (observer)', 0)]
          : [seat('founder', 'CEO'), seat('mission', 'Foundation board'), seat('mission', 'Foundation board'), seat('financial', 'Lead investor'), seat('independent', 'Independent'), seat('strategic', 'Northwind Cloud (observer)', 0)];
  return { preset, seats, confidence: 70, pendingApprovals: [], safetyCommitteeVeto: preset === 'nonprofitPBC' };
}

/**
 * Board support and approval probability for an action vector (R15 §1.6): support = Σ w·(stance·v) / Σ w, plus the
 * risk-appetite drift (+0.1 to speed and fin per 10 points of outside ownership) and a confidence term (BC − 50)/100
 * [D: normalised so board size does not dominate]. P(approve) = σ(support / 0.5).
 */
export function boardSupport(s: GameStateV2, v: readonly number[]): { support: number; p: number } {
  const b = s.player.board;
  let sum = 0;
  let W = 0;
  for (const x of b.seats) {
    if (x.weight <= 0) continue;
    sum += x.weight * (x.stance[0] * v[0] + x.stance[1] * v[1] + x.stance[2] * v[2] + x.stance[3] * v[3]);
    W += x.weight;
  }
  const drift = outsideShare(s.player.finance.ownership) * (v[0] + v[1]);
  const support = (W > 0 ? sum / W : 0) + drift + (b.confidence - 50) / 100;
  return { support, p: 1 / (1 + Math.exp(-support / 0.5)) };
}

/** Whether the board has this action blocked (90 days after a rejection). */
export function boardBlocked(s: GameStateV2, actionId: string): number | undefined {
  const until = s.player.finance.ws3?.blockedUntil[actionId];
  return until !== undefined && until > s.time.day ? until : undefined;
}

/**
 * Roll board approval for a major decision (§3.7.5). Rejection blocks `actionId` for 90 days and costs BC −5. The
 * founder preset may force it (BC −20). Uses the 'finance' stream.
 */
export function boardApproval(s: GameStateV2, ctx: SystemCtx, v: readonly number[], actionId: string, force = false): { approved: boolean; p: number; why?: string } {
  ensureWs3(s);
  const { p } = boardSupport(s, v);
  if (ctx.rng('finance').chance(p)) return { approved: true, p };
  if (force && s.player.board.preset === 'founder') {
    ctx.bump('board.confidence', -20, 'forced past the board', actionId);
    return { approved: true, p };
  }
  s.player.finance.ws3.blockedUntil[actionId] = s.time.day + 90;
  ctx.bump('board.confidence', -5, 'board rejected', actionId);
  const pct = (p * 100).toFixed(0);
  const why = `The board voted it down (${pct}% support): board confidence −5, blocked for 90 days.`;
  ctx.log('finance', `The board voted down "${actionId}" (${pct}% support). Blocked for 90 days.`, 2);
  return { approved: false, p, why };
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
    }
    f.state = next;
  }
  if (f.state === 'tight') ctx.bump('board.confidence', -5, 'tight runway');
  if (f.state === 'distress') ctx.bump('morale', -5, 'financial distress', 'talent attrition');
}

/** The board's appetite for speed (M4, §3.7.5 stances): weighted mean of the voting seats' speed stance plus the
 *  outside-ownership drift (+0.1 per 10 points), clamped to [0.25, 1.5] [D]. Confidence hits for being slow — behind a
 *  rival, pausing frontier runs — scale with it: a mission-heavy board forgives caution that a growth board punishes. */
export function boardSpeedAppetite(s: GameStateV2): number {
  let sum = 0;
  let W = 0;
  for (const x of s.player.board.seats) {
    if (x.weight <= 0) continue;
    sum += x.weight * x.stance[0];
    W += x.weight;
  }
  const a = (W > 0 ? sum / W : 0) + outsideShare(s.player.finance.ownership);
  return Math.max(0.25, Math.min(1.5, a));
}

/** Board-confidence anchor and quarterly reversion [D, M4]: with no news the board's mood drifts back toward 60 by
 *  10% of the gap each quarter (boards forgive slowly; a bad year still sticks). */
export const BC_ANCHOR = 60;
export const BC_REVERT_Q = 0.1;
/** Revenue plan [D, M4]: the next plan asks +15% per quarter (≈ 1.75×/yr); ≥ 97% of plan is met (+5), < 85% (≈ flat revenue) is
 *  missed (−10), in between the board shrugs (revenue arrives in launch-sized steps). */
export const PLAN_GROWTH_Q = 1.15;
export const PLAN_MISS = 0.85;
/** Public incidents cost −10 to −30 each; the quarterly total is capped at −20 (one bad incident, not a pile-up) [D, M4]. */
export const INCIDENT_BC_CAP_Q = 20;
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
  if (s.player.board.confidence >= OUSTER_BC || fx?.boardWarnDay === undefined || s.time.day - fx.boardWarnDay < OUSTER_NOTICE_D) return 0;
  return 0.15 * (s.player.board.preset === 'legacyNonprofit' ? 2 : 1) * ousterMajorityP(s);
}

/** Board-confidence sources the ouster vote reads as financial recklessness. */
const FINANCE_GRIEVANCES = ['down round', 'tight runway', 'covenant breach', 'failed raise', 'new borrowing', 'off-balance-sheet guarantee'];

/**
 * The ouster is a board vote (M4, §3.7.5 stances) [D]. The grievance comes from the last year's confidence hits:
 * public incidents read as "too reckless" (replace with a careful CEO: v = [−0.5, 0.5, 1, 0.5]); down rounds,
 * tight runway, covenants, failed raises and guarantees as "burning the company" (v = [−0.3, 1, 0, 0]); everything
 * else — missed plans, falling behind, pauses — as "too slow" (replace with a driver: v = [1, 0.5, −0.5, −0.5]). Each voting seat other than the CEO's
 * votes yes with σ(stance'·v / 0.5), stance' = stance + the outside-ownership drift on speed and fin; returns
 * P(weighted yes > half). A mission board shields a cautious CEO and turns on a reckless one (Nov 2023); financial
 * and strategic seats do the opposite.
 */
export function ousterMajorityP(s: GameStateV2): number {
  const day = s.time.day;
  let slow = 0;
  let reck = 0;
  let burn = 0;
  for (const e of s.causes.byKey['board.confidence'] ?? []) {
    if (e.delta >= 0 || e.day < day - 365) continue;
    if (e.source === 'public incident') reck -= e.delta;
    else if (FINANCE_GRIEVANCES.includes(e.source)) burn -= e.delta;
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

/** boardQ (430, quarterly): board confidence and approvals, runway state machine, ouster roll (§3.7.5). */
export const boardQSystem: EngineSystem = {
  id: 'boardQ', owner: 'WS3', cadence: 'quarterly', order: 430,
  run(s, ctx) {
    ensureWs3(s);
    const f = s.player.finance;
    const fx = f.ws3;
    const b = s.player.board;
    syncFinancialSeats(s);
    // Reversion toward the anchor (applied first: this quarter's news lands on top).
    const rev = BC_REVERT_Q * (BC_ANCHOR - b.confidence);
    if (Math.abs(rev) >= 0.5) ctx.bump('board.confidence', rev, 'board memory fades');
    // Revenue plan (+5 met / −10 missed); the next plan asks PLAN_GROWTH_Q more.
    if (fx.revenuePlan > 0) {
      if (f.revenueRun >= fx.revenuePlan * 0.97) ctx.bump('board.confidence', 5, 'revenue plan met');
      else if (f.revenueRun < fx.revenuePlan * PLAN_MISS) ctx.bump('board.confidence', -10, 'revenue plan missed');
    }
    fx.revenuePlan = f.revenueRun * PLAN_GROWTH_Q;
    // Lead over the best rival < 0 for a quarter: −5 (uses the intel estimate, never truth).
    const rivals = activeRivals(s);
    if (rivals.length && Math.min(...rivals.map((r) => leadDays(s, r.core.id).est)) < 0) ctx.bump('board.confidence', -5 * boardSpeedAppetite(s), 'behind a rival');
    // Safety Index grade ≥ B: +3.
    const g = s.researchBodies.index.grades.player?.letter;
    if (g && (g.startsWith('A') || g.startsWith('B'))) ctx.bump('board.confidence', 3, 'Safety Index grade');
    // Public incidents last quarter: −10 to −30 by severity, at most −30 in total.
    let incHit = 0;
    for (const inc of s.player.safety.incidents) {
      if (inc.day < s.time.day - 91 || inc.labId !== 'player') continue;
      if (inc.exposure !== 'public' && inc.status !== 'leaked') continue;
      const hit = Math.min(30, 10 + 5 * (inc.severity - 1), INCIDENT_BC_CAP_Q - incHit);
      if (hit <= 0) break;
      incHit += hit;
      ctx.bump('board.confidence', -hit, 'public incident', inc.id);
    }
    updateRunwayState(s, ctx);
    // Telegraph: the board warns below BC_WARN; the warning clears once confidence recovers.
    if (b.confidence < BC_WARN && fx.boardWarnDay === undefined) {
      fx.boardWarnDay = s.time.day;
      ctx.log('alert', `The board is losing confidence (${b.confidence.toFixed(0)}). Below ${OUSTER_BC} directors may vote to remove you at a quarterly review.`, 4);
    } else if (b.confidence >= BC_CLEAR && fx.boardWarnDay !== undefined) {
      delete fx.boardWarnDay;
      ctx.log('finance', 'The board has steadied: no more talk of a leadership change.');
    }
    // Ouster roll (BC < 25 after a warning): p = 0.15/q, × 2 for the legacy nonprofit preset. WS4 endings read
    // flags['ws3.ousterDay'].
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
