// N9 (design/npc/NPC-LABS.md §2 principle 4, §9): the public view of an NPC lab. public = true x a log-normal error,
// redrawn when the value is reported; the player, the government, the public and China read only this. One sigma per
// quantity for every lab, China x2 (its opacity is part of the shape). Products, prices, tools, open releases,
// disclosed incidents and announced rounds are exact (they are read from their own state, not from here).
//   capability (months behind, task horizon): redrawn on each public release (NpcLabState.rel)
//   compute, valuation, revenue: redrawn each quarter; revenue is the value one month before the report (about a month stale)
// Deterministic and stream-free: an error is a function of (seed, lab, quantity, report index) (hash32), so no RNG
// stream is consumed and a re-run draws the same errors. Only the last reported values are stored (NpcLabState.pub).
import { Rng } from '../../rng';
import { hash32 } from '../core/rng';
import { quarterIndex } from '../core/time';
import { h50Of } from '../models/capability';
import { postureOf } from '../actors/rivals';
import { DAYS_PER_MONTH } from './lab';
import type { GameStateV2, RivalLab, SafetyPosture } from '../types';

/** Spec §9: one sigma per quantity. Months behind is additive (sd in months); the rest log-normal (sd of ln). */
export const PUBLIC_SIGMA = { monthsBehind: 1, horizon: 0.3, compute: 0.25, revenue: 0.15, valuation: 0.1 } as const;
export type PublicQuantity = keyof typeof PUBLIC_SIGMA;
/** China's opacity: its sigmas are doubled. */
export const CHINA_OPACITY = 2;
/** How stale a reported revenue is (days): the value one month before the report. */
export const REVENUE_STALE_DAYS = 30;

/** The sigma of a lab's quantity (months for monthsBehind, ln units otherwise). */
export const sigmaOf = (id: string, q: PublicQuantity) => PUBLIC_SIGMA[q] * (id === 'china' ? CHINA_OPACITY : 1);

/** The standard-normal error of (seed, lab, quantity, report index): a fresh local generator, never a game stream. */
export function publicZ(seed: number, lab: string, q: PublicQuantity, idx: number): number {
  return new Rng(hash32(seed, `pub:${lab}:${q}:${idx}`)).normal(0, 1);
}
const lnErr = (seed: number, lab: string, q: PublicQuantity, idx: number) => Math.exp(sigmaOf(lab, q) * publicZ(seed, lab, q, idx));

type Ctx = Pick<GameStateV2, 'setup' | 'hidden' | 'time'>;

/** Report today's values that are due: capability on a new public release, compute/valuation/revenue on a new quarter.
 *  Called each day by the NPC lab's daily step (npc/lab.ts) and once at init; it changes nothing between reports. */
export function refreshPublic(s: Ctx, r: RivalLab): void {
  const n = r.npc;
  if (!n) return;
  const seed = s.setup.seed;
  const id = r.core.id;
  const day = s.time.day;
  const start = s.time.startDate;
  let p = n.pub;
  const q = quarterIndex(start, day);
  // The revenue snapshot: the value taken REVENUE_STALE_DAYS before the next quarter starts (so the quarter's report is one month stale).
  const qAhead = quarterIndex(start, day + REVENUE_STALE_DAYS);
  if (!p) p = n.pub = { capIdx: -1, qIdx: -1, lagDays: 0, horizonMin: 0, computeH100e: 0, revenue: 0, valuation: 0, capDay: day, snapQ: qAhead, snapRev: r.finance.revenueRun };
  else if (qAhead !== p.snapQ) { p.snapQ = qAhead; p.snapRev = r.finance.revenueRun; }
  if (p.capIdx !== n.rel) {
    p.capIdx = n.rel;
    p.capDay = day;
    p.lagDays = n.d + DAYS_PER_MONTH * sigmaOf(id, 'monthsBehind') * publicZ(seed, id, 'monthsBehind', n.rel);
    const m = r.publicModel ?? r.internal;
    p.horizonMin = h50Of(s.hidden.timeline, m) * lnErr(seed, id, 'horizon', n.rel);
  }
  if (p.qIdx !== q) {
    p.qIdx = q;
    p.computeH100e = r.core.computeOnline * lnErr(seed, id, 'compute', q);
    p.valuation = r.finance.valuation * lnErr(seed, id, 'valuation', q);
    p.revenue = p.snapRev * lnErr(seed, id, 'revenue', q);
  }
}

export interface PublicLab {
  /** Months behind the reference frontier, as reported (floored at 0 for display); sd = sigma months. */
  monthsBehind: number;
  monthsBehindSd: number;
  /** The reported lag in days, unfloored (the estimate the lead is built from). */
  lagDays: number;
  /** 50% task horizon of its public model, minutes, as reported. */
  horizonMin: number;
  computeH100e: number;
  /** Revenue run-rate, $B, about a month stale. */
  revenue: number;
  valuation: number;
  /** Day of the last capability report; the quarter's report index. */
  capDay: number;
  /** The kind's public safety posture (a lab's stated posture and its public record: no noise in the spec §9 list). */
  safetyPosture: SafetyPosture;
}

/** The public view of a lab: what the player, government, public and China may read. A lab without NPC state (never in a
 *  game) reads exact. */
export function publicOf(s: GameStateV2, r: RivalLab): PublicLab {
  const id = r.core.id;
  const p = r.npc?.pub;
  const sd = sigmaOf(id, 'monthsBehind');
  const lagDays = p ? p.lagDays : r.npc?.d ?? 0;
  return {
    monthsBehind: Math.max(0, lagDays / DAYS_PER_MONTH), monthsBehindSd: sd, lagDays,
    horizonMin: p?.horizonMin ?? h50Of(s.hidden.timeline, r.publicModel ?? r.internal),
    computeH100e: p?.computeH100e ?? r.core.computeOnline, revenue: p?.revenue ?? r.finance.revenueRun, valuation: p?.valuation ?? r.finance.valuation,
    capDay: p?.capDay ?? 0, safetyPosture: postureOf(s, id),
  };
}
