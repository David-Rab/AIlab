// Auto-split idle compute (RD-A05b, DD-19). Owner: WS1.
//
// Idle compute stays idle and shows as idle in its use: training compute no run uses, serving compute no product
// needs, a monitoring line beyond full coverage, the unallocated line. The one explicit player policy that reassigns it:
// Auto-split (default off). When on, once a day (after the revenue system has measured the products' need) the idle
// shares move to the uses the player lists, in equal parts, and the move is logged and kept as `policies.autoSplit.last`.
import type { ComputeSplit, EngineSystem, GameStateV2 } from '../types';
import { idleTrainingShare } from '../models/runs';
import { idleServing } from '../worldfx/revenue';
import { monitorBudget } from './agents';
import { normalizeSplit, SPLIT_KEYS, SPLIT_LABEL } from './split';

export type AutoSplitUse = Exclude<keyof ComputeSplit, 'idle'>;
export const AUTO_SPLIT_USES = SPLIT_KEYS.filter((k): k is AutoSplitUse => k !== 'idle');
/** Smallest move worth making (share of total compute): below it the allocation stays as it is (no daily churn). */
export const AUTO_SPLIT_MIN = 0.001;

/** Idle compute by where it sits today (shares of total compute). */
export function idleShares(s: GameStateV2): { unallocated: number; training: number; serving: number; monitors: number; total: number } {
  const p = s.player;
  const sp = p.split;
  const unallocated = Math.max(0, sp.idle);
  const training = p.policies.lendTraining ? 0 : idleTrainingShare(s) * sp.training; // UB-5c: lent, not idle
  const serving = p.computeOnline > 0 ? Math.min(sp.serving, idleServing(s) / p.computeOnline) : 0;
  const mb = monitorBudget(s);
  const monitors = mb.need > 0 ? Math.max(0, mb.budget - mb.used) : 0;
  return { unallocated, training, serving, monitors, total: unallocated + training + serving + monitors };
}

/** The allocation Auto-split would make today and the share it moves (0 = no change): idle shares leave their uses
 *  (a listed use keeps its own idle part) and go to the listed uses in equal parts. */
export function autoSplitPlan(s: GameStateV2): { next: ComputeSplit; moved: number } {
  const p = s.player;
  const to = (p.policies.autoSplit?.to ?? []).filter((k) => AUTO_SPLIT_USES.includes(k));
  const next = { ...p.split };
  if (!to.length) return { next, moved: 0 };
  const idle = idleShares(s);
  const take = (k: keyof ComputeSplit, x: number) => (to.includes(k as AutoSplitUse) ? 0 : Math.min(next[k], x));
  const parts: [keyof ComputeSplit, number][] = [
    ['idle', take('idle', idle.unallocated)], ['training', take('training', idle.training)],
    ['serving', take('serving', idle.serving)], ['monitors', take('monitors', idle.monitors)],
  ];
  let moved = 0;
  for (const [k, x] of parts) {
    next[k] -= x;
    moved += x;
  }
  if (moved < AUTO_SPLIT_MIN) return { next: { ...p.split }, moved: 0 };
  for (const k of to) next[k] += moved / to.length;
  return { next: normalizeSplit(next), moved };
}

/** autoSplit (62, daily): when the policy is on, move today's idle compute to the listed uses and log it. */
export const autoSplitSystem: EngineSystem = {
  id: 'autoSplit', owner: 'WS1', cadence: 'daily', order: 62, system: 'compute',
  run(s, ctx) {
    const pol = s.player.policies.autoSplit;
    if (!pol?.on) return;
    const { next, moved } = autoSplitPlan(s);
    if (moved <= 0) return;
    s.player.split = next;
    pol.last = { day: s.time.day, share: moved };
    if (moved >= 0.005) ctx.log('company', `Auto-split moved ${(moved * 100).toFixed(1)}% of compute (idle) to ${pol.to.map((k) => SPLIT_LABEL[k].toLowerCase()).join(', ')}.`);
  },
};
