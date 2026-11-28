// The cheapest model a lab can serve at a capability (A3; research/20 D3's fixed-capability price). Shared by serving.ts
// (the exact decomposition of its decline) and calreport/market.ts (the sourced ×6–×900 band of that decline).
import { flopPerToken, workFit } from '../../src/engine/v2/departments/workfit';
import { studentParamsFor } from '../../src/engine/v2/worldfx/serving';
import { REFERENCE_BASE, DISTILL_TPP } from '../../src/data/v2/runDesign';
import { distillGap } from '../../src/engine/v2/models/effective';
import type { WorkTypeId } from '../../src/data/v2/workTypes';
import type { GameStateV2 } from '../../src/engine/v2/types';

/** The cheapest model a lab can serve at capability G. */
export interface CheapestAt {
  /** Serving FLOP per token and active parameters of that model. */
  fpt: number;
  params: number;
  /** The version itself, or the teacher of the student. */
  versionId: string;
  student: boolean;
  /** The teacher's fit and the distillation gap (OOM; 0 for the version itself). */
  teacherFit: number;
  gap: number;
}
/** The cheapest model a lab can serve at capability `G` (fit on work type `wt`, OOM): the smallest of (1) its own
 *  versions that hold G and (2) a distilled student of any of them, sized to hold G exactly. A student follows the
 *  game's distillation rule (R20 C4, runs.ts planRun): gap δ = DISTILL.a + DISTILL.b·log₁₀(N_T/N_S) at DISTILL_TPP
 *  tokens per student parameter, N_S ≥ PARAM_RANGE[0], FLOP per token = the teacher's × N_S/N_T (its shape and serving
 *  efficiency). Distillation is ★ (P04), so every lab can do this. It is what the lab could sell at G, not what it
 *  sells. research/20 D3's fixed-capability price (Cottier et al. 2025: the cheapest model above a benchmark threshold)
 *  is the price of this model. Undefined when no version holds G. */
export function cheapestAt(s: GameStateV2, G: number, wt: WorkTypeId = 'SWE'): CheapestAt | undefined {
  let best: CheapestAt | undefined;
  for (const v of s.player.models.versions) {
    if (v.status === 'retired' || v.variant === 'imported') continue;
    const fit = workFit(s, v, wt).fit;
    if (fit < G) continue;
    const nT = v.params ?? s.player.models.bases.find((b) => b.id === v.baseId)?.params ?? REFERENCE_BASE.params;
    const nS = studentParamsFor(nT, fit - G);
    const student = nS < nT;
    const c: CheapestAt = { fpt: (flopPerToken(s, v) * nS) / nT, params: nS, versionId: v.id, student, teacherFit: fit, gap: student ? distillGap(nT, nS, DISTILL_TPP * nS) : 0 };
    if (!best || c.fpt < best.fpt) best = c;
  }
  return best;
}
