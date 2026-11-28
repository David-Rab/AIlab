// RD-X04 (DD-17; research/RD-X04r-diffusion.md §3): one diffusion rule for every lab (player, rivals, China).
//  A. Recipe: each day a lab's pretraining recipe gains (best public-or-open recipe G above it − its own recipe G) / τ.
//  B. Distillation: at each of the lab's post-trainings, + S × access × fit × (best servable teacher's G − its own G).
// Both read recipeG at RECIPE_F (RD-B16) / model G, so the same functions serve every lab.
import { DIFFUSION_TAU_DAYS, DISTILL_FIT, DISTILL_S } from '../../../data/v2/calibration';
import { anonShare } from '../models/deployments';
import { PLAYER_ID, labCore, otherLabs, rivalLab, versionById } from '../models/labs';
import { playerRecipeG } from '../models/stacks';
import type { Deployment, GameStateV2, LabId } from '../types';

/** A lab's own recipe G at RECIPE_F (the player's playerRecipeG, an NPC lab's npc.rec). */
export function labRecipeG(s: GameStateV2, lab: LabId): number {
  if (lab === PLAYER_ID) return playerRecipeG(s);
  const r = rivalLab(s, lab);
  return r?.npc ? r.npc.rec : -Infinity;
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
    out.push({ lab: r.core.id, name: r.core.name, recG: r.publicModel.recG ?? r.npc.rec });
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

/** RD-P09: output tokens a distiller harvesting at full access collects [P-r, research/RD-X04r D4: MiniMax's campaign
 *  ≈ 13M exchanges ≈ 100B tokens, the scale behind IFP's S ≈ 0.5]. */
export const DISTILL_FULL_TOKENS = 1e11;
/** RD-P09: share of a product's anonymous usage a distiller can take before it is noticed [D stand-in, CAL-P: no lab
 *  publishes the traffic its campaigns hid in. Bracket: MiniMax's >13M exchanges (~1e11 tokens, Anthropic Feb 2026)
 *  over 90 days of a frontier API's anonymous half is ~3e-4 at OpenAI's 6B API tokens/min (DevDay 2025) and ~7e-3 at
 *  this game's day-0 player API (3.4e11 tokens/day) (research/CAL-products-sources.md D1). CAL2-X (decision 15): 0.01 sat
 *  above the top of that range; 0.0015, inside it (3e-4–7e-3), so KYC matters on a big API (review products F1)]. */
export const DISTILL_HARVEST_SHARE = 0.0015;
/** RD-P09: days of usage a distiller harvests before the post-training it feeds [stand-in: a quarter, about a rival's
 *  post-training cadence]. */
export const DISTILL_HARVEST_DAYS = 90;
/** RD-P09: output tokens a distiller can harvest from a served product: its tokens served per day (Deployment.servedTokensDay,
 *  RD-P10 usage per model) × its anonymous share after KYC (models/deployments.ts anonShare) × DISTILL_HARVEST_SHARE ×
 *  DISTILL_HARVEST_DAYS. 0 with no usage. */
export function harvestTokens(d: Pick<Deployment, 'channel' | 'kyc' | 'servedTokensDay'>): number {
  return Math.max(0, d.servedTokensDay ?? 0) * anonShare(d) * DISTILL_HARVEST_SHARE * DISTILL_HARVEST_DAYS;
}
/** Access to a served teacher (research/RD-X04r §3B, D2): open weights 1. A served product (RD-P09): D2's
 *  1 − 0.25·log10(D_full / D) on the harvested tokens D (harvestTokens; DISTILL_FULL_TOKENS), in [0, 1]: no usage, no
 *  access; each tenfold cut of the harvest (one KYC level) −0.25. China reaches US APIs like anyone (no access meter). A rival's served teacher (`d` absent) has access 1 (rivals' usage is not tracked). */
export function teacherAccess(_s: GameStateV2, _student: LabId, open: boolean, d?: Pick<Deployment, 'channel' | 'kyc' | 'servedTokensDay'>): number {
  if (open) return 1;
  if (!d) return 1;
  const D = harvestTokens(d);
  if (!(D > 0)) return 0;
  return Math.max(0, Math.min(1, 1 - 0.25 * Math.log10(DISTILL_FULL_TOKENS / D)));
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
      if (v) take(v.G, teacherAccess(s, lab, d.channel === 'open', d), s.player.name);
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

// ───────── RD-X04b: discrete transfers sized by what moves (research/RD-X04r §3C) ─────────
// Recipe leaks move the receiver's recipeG (RECIPE_F, RD-B16) toward the source's by a share of the recipe gap; a leak
// with no gap (receiver at or above the source) moves nothing. Stolen weights move the thief's model G toward the
// stolen model's G. Every site and its preview reads these functions.
/** Share of the recipe gap each recipe / secrets leak moves, per event type. */
export const RECIPE_LEAK_SHARE = {
  /** C6 / any open-weights release [D]: weights reveal architecture, size and tokenizer, not the data mix or training
   *  code, so a minority of the recipe gap. */
  openWeights: 0.3,
} as const;
/** C4 poach [S1, research/RD-X04r §3C]: the share of what movers carry that is firm learning, not the
 *  hire's own reuse; the transfer is this × the movers' share of the source's research staff × the recipe gap. */
export const TACIT_FIRM_SHARE = 0.5;
/** Weight theft [P, research/RD-X04r T5]: in AI 2027 China goes from about 6 to 2 months behind on stealing Agent-2, so
 *  the thief closes 4/6 of its model gap; the remaining third is the integration loss (adapting, serving, post-training
 *  the weights on its own stack). */
export const THEFT_GAP_CLOSED = 2 / 3;

/** OOM into `dst`'s pretraining recipe from a leak of recipe `srcRecG` at `share` of the gap (0 with no gap). */
export function recipeLeakG(s: GameStateV2, srcRecG: number, dst: LabId, share: number): number {
  const own = labRecipeG(s, dst);
  if (!Number.isFinite(own) || !Number.isFinite(srcRecG)) return 0;
  return share * Math.max(0, srcRecG - own);
}
/** C4 / E16: tacit knowledge from `src` into `dst` when `moved` of `src`'s `srcStaff` research staff move. */
export function tacitLeakG(s: GameStateV2, src: LabId, dst: LabId, moved: number, srcStaff: number): number {
  const share = TACIT_FIRM_SHARE * Math.min(1, Math.max(0, moved) / Math.max(1, srcStaff));
  return recipeLeakG(s, labRecipeG(s, src), dst, share);
}
/** The thief's model G after stealing weights at `stolenG`: own G plus THEFT_GAP_CLOSED of the gap (own G with none). */
export const stolenModelG = (ownG: number, stolenG: number) => ownG + THEFT_GAP_CLOSED * Math.max(0, stolenG - ownG);
