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
export function boardApproval(s: GameStateV2, ctx: SystemCtx, v: readonly number[], actionId: string, force = false): { approved: boolean; p: number } {
  ensureWs3(s);
  const { p } = boardSupport(s, v);
  if (ctx.rng('finance').chance(p)) return { approved: true, p };
  if (force && s.player.board.preset === 'founder') {
    ctx.bump('board.confidence', -20, 'forced past the board', actionId);
    return { approved: true, p };
  }
  s.player.finance.ws3.blockedUntil[actionId] = s.time.day + 90;
  ctx.bump('board.confidence', -5, 'board rejected', actionId);
  ctx.log('finance', `The board rejected "${actionId}" (support ${(p * 100).toFixed(0)}%). Blocked for 90 days.`, 2);
  return { approved: false, p };
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

/** boardQ (430, quarterly): board confidence and approvals, runway state machine, ouster roll (§3.7.5). */
export const boardQSystem: EngineSystem = {
  id: 'boardQ', owner: 'WS3', cadence: 'quarterly', order: 430,
  run(s, ctx) {
    ensureWs3(s);
    const f = s.player.finance;
    const fx = f.ws3;
    syncFinancialSeats(s);
    // Revenue plan (+5 met / −10 missed); the next plan asks for ~20% more per quarter [D].
    if (fx.revenuePlan > 0) {
      if (f.revenueRun >= fx.revenuePlan * 0.97) ctx.bump('board.confidence', 5, 'revenue plan met');
      else ctx.bump('board.confidence', -10, 'revenue plan missed');
    }
    fx.revenuePlan = f.revenueRun * 1.2;
    // Lead over the best rival < 0 for a quarter: −5 (uses the intel estimate, never truth).
    const rivals = activeRivals(s);
    if (rivals.length && Math.min(...rivals.map((r) => leadDays(s, r.core.id).est)) < 0) ctx.bump('board.confidence', -5, 'behind a rival');
    // Safety Index grade ≥ B: +3.
    const g = s.researchBodies.index.grades.player?.letter;
    if (g && (g.startsWith('A') || g.startsWith('B'))) ctx.bump('board.confidence', 3, 'Safety Index grade');
    // Public incidents last quarter: −10 to −30 by severity.
    for (const inc of s.player.safety.incidents) {
      if (inc.day < s.time.day - 91 || inc.labId !== 'player') continue;
      if (inc.exposure !== 'public' && inc.status !== 'leaked') continue;
      ctx.bump('board.confidence', -Math.min(30, 10 + 5 * (inc.severity - 1)), 'public incident', inc.id);
    }
    updateRunwayState(s, ctx);
    // Ouster roll when BC < 25: p = 0.15/q, × 2 for the legacy nonprofit preset. WS4 endings read flags['ws3.ousterDay'].
    if (s.player.board.confidence < 25 && s.flags['ws3.ousterDay'] === undefined) {
      const p = 0.15 * (s.player.board.preset === 'legacyNonprofit' ? 2 : 1);
      if (ctx.rng('finance').chance(p)) {
        s.flags['ws3.ousterDay'] = s.time.day;
        ctx.log('alert', 'The board has voted to remove the CEO.', 5);
        ctx.headline('ouster', `${s.player.name} board ousts its chief executive`);
      }
    }
  },
};
