// Hours of AI use in a sector (A2a; research/22 §1, design/V3-BUILD.md "A2a notes"). Owner: WS5. Pure functions of
// the sector state and data (no imports from other worldfx modules, so sectors, serving and revenue can all use them).
//
//   U       = A + h_s·max(0, W − A)       hours of use per work-hour: the tasks firms handed to AI (A) plus workers'
//                                          assisted use on the rest of their hours (W who use AI, h_s of their hours)
//   W*      = max(A, W_b + (1 − W_b)·F)    the base share of workers who use AI today, plus the rest as AI covers their work
//   W_b     = useW·√r̂_s·(region scale),  h_s = useH·√r̂_s   r̂_s the sector's relative use (employment-normalised)
//   α_use   = α·A/U                        substituted share of an hour of use (assisted hours substitute nothing)
//   saved   = α_use + (1 − α_use)·g_aug    hours of work an hour of use saves (measured 0.35, research/22 §1e)
import { ECON, REGION_SCALE, SECTORS, SECTOR_BY_ID, type SectorDef } from '../../../data/v2/sectors';
import type { RegionId, SectorId, SectorState } from '../types';

/** Employment-weighted mean of the sectors' relative use (normalises `use` to a US average of 1). */
const USE_MEAN = SECTORS.reduce((a, d) => a + d.empPct * d.use, 0) / SECTORS.reduce((a, d) => a + d.empPct, 0);
const ROOT = Object.fromEntries(SECTORS.map((d) => [d.id, Math.sqrt(d.use / USE_MEAN)])) as Record<SectorId, number>;

/** Base share of a sector's workers who use AI at work (W_b): the US base × √(relative use) × the region's scale. */
export const useBaseOf = (def: SectorDef, r: RegionId) => Math.min(0.95, ECON.useW * ROOT[def.id] * REGION_SCALE[r].A0);
/** Share of a user's non-delegated hours with AI assistance (h_s). */
export const useIntensityOf = (sid: SectorId) => ECON.useH * ROOT[sid];
/** Ceiling of the worker stock: today's base users plus the rest as the AI covers their work; at least A. */
export const workerTarget = (def: SectorDef, r: RegionId, F: number, A: number) => {
  const wb = useBaseOf(def, r);
  return Math.max(A, wb + (1 - wb) * Math.max(0, Math.min(1, F)));
};

type UseState = Pick<SectorState, 'A' | 'W' | 'alpha'>;
/** Hours of AI use per work-hour of a sector (U). */
export const useShareOf = (st: UseState, sid: SectorId) => st.A + useIntensityOf(sid) * Math.max(0, (st.W ?? st.A) - st.A);
/** Substituted share of an hour of use: α on the adopted tasks, nothing on assisted hours (α_use = α·A/U). */
export function alphaUseOf(st: UseState, sid: SectorId, alpha = st.alpha): number {
  const U = useShareOf(st, sid);
  return U > 0 ? (alpha * st.A) / U : 0;
}
/** Hours of work an hour of AI use saves at a substituted share α_use. */
export const savedAt = (alphaUse: number) => alphaUse + (1 - alphaUse) * ECON.gAug;
/** Relative use r̂_s (US average 1). */
export const relativeUse = (sid: SectorId) => SECTOR_BY_ID[sid].use / USE_MEAN;
