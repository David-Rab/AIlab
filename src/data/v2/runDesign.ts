// Run-design option tables (V2-SPEC §3.3.2). Owner: WS1.
// M0: reference recipes and headline Δp/serve values. TODO(WS1, M1): full option tables (domain ΔL, signals, time).
import type { BaseDesign, PostDesign } from '../../engine/v2/types';

/** The RefBot recipe: zero offsets by definition. */
export const REFERENCE_BASE: BaseDesign = {
  scale: 'frontier', shape: 'moe', data: 'balanced',
  curation: { quality: true, hazard: false, safetyPretrain: false }, licensedShare: 0.1,
};

export const REFERENCE_POST: PostDesign = {
  pref: 'constitution', rlFocus: 'broad', rlIntensity: 'heavyHardened', inoculation: false,
  cot: 'visible', safety: 'standard', techniques: [], trainAgainst: [],
};

export const BASE_SHAPE_DP: Record<BaseDesign['shape'], number> = { dense: -0.24, overtrained: -0.36, moe: 0, latent: 0.4 };
export const BASE_SHAPE_SERVE: Record<BaseDesign['shape'], number> = { dense: 1.0, overtrained: 0.3, moe: 0.5, latent: 0.2 };
export const POST_INTENSITY_DP: Record<PostDesign['rlIntensity'], number> = { light: -0.45, heavyCheap: 0.04, heavyHardened: 0 };
export const COT_MONITORABILITY: Record<PostDesign['cot'], number> = { visible: 0.9, pressured: 0.6, faithful: 0.98, latent: 0.05 };
