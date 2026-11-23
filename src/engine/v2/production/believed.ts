// RD-UI0a (UI-IA OQ-5): the lab's BELIEVED production parameters, for readouts only (What binds, the +10% elasticities,
// the response charts, the research-speed readout). Physics keeps reading the hidden truth (the timeline world's prod).
// The belief is the published prior the hidden draw is drawn around (world/hidden.ts prodParamsFor): the setup preset's
// public values (data/v2/calibration.ts PROD_DEFAULT / PROD_PRESETS), with the one drawn parameter, the infinite-labour
// asymptote La, at the AI Futures Model prior's median for `sampled` (AIFM `inf_labor_asymptote` 1 + LN ci80 [1, 200],
// median 1 + √200 ≈ 15.1; research/13 §1.4) and its 80% band (1 + 1, 1 + 200) as the band on every derived quantity.
// No measured tightening: the state keeps only the research engine's last day (research.last.x), not 30 days of
// responses, so the belief is the prior only.
import { PROD_DEFAULT, PROD_PRESETS } from '../../../data/v2/calibration';
import { cesFromAsymptotes } from './ces';
import type { GameStateV2, ProdParams, TimelineWorld, WorldPresetId } from '../types';

/** AIFM inf_labor_asymptote prior: 1 + LN with 80% interval [1, 200] (research/13 §1.4 [C]). */
export const LA_PRIOR_P10 = 1 + 1;
export const LA_PRIOR_P90 = 1 + 200;
export const LA_PRIOR_MEDIAN = 1 + Math.sqrt(1 * 200);

export interface BelievedProd { mid: ProdParams; lo: ProdParams; hi: ProdParams }

const cache = new Map<string, BelievedProd>();
const withLa = (base: Omit<ProdParams, 'rho' | 'u' | 'v' | 'zeta'>, La: number): ProdParams => ({ ...base, La, ...cesFromAsymptotes(La, base.Ca, base.slow10) });

/** The believed production parameters of the setup's world preset: central and the two band ends (La at the prior's
 *  p10 / p90). Never reads s.hidden. */
export function believedProd(s: Pick<GameStateV2, 'setup'>): BelievedProd {
  const world = s.setup.world as WorldPresetId;
  const hit = cache.get(world);
  if (hit) return hit;
  const base = { ...PROD_DEFAULT, ...(PROD_PRESETS[world] ?? {}) };
  const La = world === 'sampled' ? LA_PRIOR_MEDIAN : base.La;
  const out = { mid: withLa(base, La), lo: withLa(base, LA_PRIOR_P10), hi: withLa(base, LA_PRIOR_P90) };
  cache.set(world, out);
  return out;
}

/** A timeline world with the believed production parameters in place of the hidden ones (readouts that take a world:
 *  production.ts expThroughput). Only `prod` is replaced. */
export function believedWorld(s: Pick<GameStateV2, 'setup' | 'hidden'>, which: keyof BelievedProd = 'mid'): TimelineWorld {
  return { ...s.hidden.timeline, prod: believedProd(s)[which] };
}

/** CES elasticities of X(c, ℓ) to c and ℓ (research/13 §1.6): ζ·s_c and λ·s_ℓ, at parameters P. */
export function elasticitiesAt(P: ProdParams, c: number, l: number): { eC: number; eL: number } {
  const cT = P.u * Math.pow(Math.max(1e-12, c), P.zeta * P.rho);
  const lT = P.v * Math.pow(Math.max(1e-12, l), P.rho);
  const sC = cT / (cT + lT);
  return { eC: P.zeta * sC, eL: P.lam * (1 - sC) };
}

/** Believed elasticities at (c, ℓ): central and the band [lo, hi] over the prior's 80% interval. */
export interface BelievedElasticities { eC: number; eL: number; eCBand: [number, number]; eLBand: [number, number] }
export function believedElasticities(s: Pick<GameStateV2, 'setup'>, c: number, l: number): BelievedElasticities {
  const b = believedProd(s);
  const m = elasticitiesAt(b.mid, c, l);
  const lo = elasticitiesAt(b.lo, c, l);
  const hi = elasticitiesAt(b.hi, c, l);
  const band = (a: number, x: number, y: number): [number, number] => [Math.min(a, x, y), Math.max(a, x, y)];
  return { eC: m.eC, eL: m.eL, eCBand: band(m.eC, lo.eC, hi.eC), eLBand: band(m.eL, lo.eL, hi.eL) };
}
