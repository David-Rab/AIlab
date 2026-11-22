// RD-X04 (DD-17; research/RD-X04r-diffusion.md §3): one diffusion rule for every lab (player, rivals, China).
//  A. Recipe: each day a lab's pretraining recipe gains (best public-or-open recipe G above it − its own recipe G) / τ.
//  B. Distillation: at each of the lab's post-trainings, + S × access × fit × (best servable teacher's G − its own G).
// Both read recipeG at RECIPE_F (RD-B16) / model G, so the same functions serve every lab.
import { DIFFUSION_TAU_DAYS, DISTILL_FIT, DISTILL_S } from '../../../data/v2/calibration';
import { recipeOf } from '../actors/rivalModel';
import { LEAK_COEF } from '../models/deployments';
import { CHINA_ID, PLAYER_ID, labCore, otherLabs, rivalLab, versionById } from '../models/labs';
import { playerRecipeG } from '../models/stacks';
import type { GameStateV2, LabId } from '../types';

/** A lab's own recipe G at RECIPE_F (the player's playerRecipeG, a rival's recipeOf). */
export function labRecipeG(s: GameStateV2, lab: LabId): number {
  if (lab === PLAYER_ID) return playerRecipeG(s);
  const r = rivalLab(s, lab);
  return r ? recipeOf(s, r) : -Infinity;
}

/** The recipe each lab has revealed: the recipe G its released models were made with (`recG`, stamped at post-training);
 *  a released model without a stamp (day-0 lineups, older saves) reveals the lab's recipe today [D]. Player: its live
 *  external or open deployments. */
export function publicRecipes(s: GameStateV2): { lab: LabId; name: string; recG: number }[] {
  const out: { lab: LabId; name: string; recG: number }[] = [];
  let p = -Infinity;
  for (const d of s.player.deployments) {
    if (d.status !== 'live' || d.channel === 'internal') continue;
    const v = versionById(s, d.versionId);
    if (v?.recG !== undefined) p = Math.max(p, v.recG);
  }
  if (Number.isFinite(p)) out.push({ lab: PLAYER_ID, name: s.player.name, recG: p });
  for (const r of otherLabs(s)) {
    if (r.core.status !== 'active' || !r.publicModel) continue;
    out.push({ lab: r.core.id, name: r.core.name, recG: r.publicModel.recG ?? recipeOf(s, r) });
  }
  return out;
}

/** Rule A: lab's daily recipe gain (OOM into its pretraining part) from the best public recipe above it, / τ
 *  (DIFFUSION_TAU_DAYS [P]). `from` = the source lab's name. */
export function recipeDiffusionPerDay(s: GameStateV2, lab: LabId, tauDays = DIFFUSION_TAU_DAYS): { dG: number; from?: string } {
  const own = labRecipeG(s, lab);
  if (!Number.isFinite(own) || labCore(s, lab)?.status !== 'active') return { dG: 0 };
  let best: { recG: number; name: string } | undefined;
  for (const x of publicRecipes(s)) if (x.lab !== lab && x.recG > own && (!best || x.recG > best.recG)) best = x;
  return best ? { dG: (best.recG - own) / tauDays, from: best.name } : { dG: 0 };
}

/** R1 student fit by active parameters (DISTILL_FIT, log-linear, flat outside). Unknown size: the top of the table. */
export function distillFit(params: number | undefined): number {
  const t = DISTILL_FIT;
  if (!params || !Number.isFinite(params)) return t[t.length - 1][1];
  if (params <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (params <= t[i][0]) {
      const f = Math.log10(params / t[i - 1][0]) / Math.log10(t[i][0] / t[i - 1][0]);
      return t[i - 1][1] + f * (t[i][1] - t[i - 1][1]);
    }
  }
  return t[t.length - 1][1];
}

/** Access to a served teacher (research/RD-X04r §3B, D2): open weights 1; an API product
 *  LEAK_COEF[channel] (how much of its output a distiller can harvest) × (1 − 0.25·log10(1/(1 − c))), c = 1 − 10^−kyc
 *  (each KYC level cuts harvested data tenfold [D]: = 1 − 0.25·kyc). China reaches US APIs through its
 *  distillationAccess meter (/60, ≤ 1). */
export function teacherAccess(s: GameStateV2, student: LabId, open: boolean, channelCoef = 1, kyc = 0): number {
  if (open) return 1;
  const china = student === CHINA_ID ? Math.min(1, s.china.meters.distillationAccess / 60) : 1;
  return Math.max(0, channelCoef * (1 - 0.25 * kyc) * china);
}

/** Rule B: the G a lab's post-training at own G `ownG` (student of `params` active params) gains by distilling the best
 *  released teacher of another lab: S × access × fit × (G_teacher − ownG), the largest over teachers. A level, not a
 *  recipe: it does not compound into later bases (D4, D6). `onlyPlayer` restricts teachers to the player's products
 *  (the products' distillation preview). */
export function distillLift(s: GameStateV2, lab: LabId, ownG: number, params: number | undefined, onlyPlayer = false): { dG: number; from?: string } {
  const fit = distillFit(params);
  let best = 0;
  let from: string | undefined;
  const take = (G: number, access: number, name: string) => {
    const dG = DISTILL_S * access * fit * Math.max(0, G - ownG);
    if (dG > best) { best = dG; from = name; }
  };
  if (lab !== PLAYER_ID) {
    for (const d of s.player.deployments) {
      if (d.status !== 'live' || d.channel === 'internal') continue;
      const v = versionById(s, d.versionId);
      if (v) take(v.G, teacherAccess(s, lab, d.channel === 'open', LEAK_COEF[d.channel], d.kyc), s.player.name);
    }
  }
  if (!onlyPlayer) {
    for (const r of otherLabs(s)) {
      if (r.core.id === lab || r.core.status !== 'active' || !r.publicModel) continue;
      take(r.publicModel.G, teacherAccess(s, lab, r.publicModel.openWeights), r.core.name);
    }
  }
  return { dG: best, from };
}
