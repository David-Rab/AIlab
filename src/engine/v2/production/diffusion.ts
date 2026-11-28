// RD-X04 (DD-17; research/RD-X04r-diffusion.md §3): the diffusion rules.
//  A. Know-how (F1, design/bal/NPC-FIX.md): the player's diffused level D relaxes toward the public know-how level P,
//     dD/dt = max(0, P − D) / τ (production/production.ts diffusionStep); its effective recipe is max(own, D)
//     (models/stacks.ts). P is the best NPC lab's SOFTWARE know-how, never compute (npc/shocks.ts publicKnowhow). The NPC
//     labs' own diffusion is their lag relaxing to its target over τ (npc/lab.ts).
//  B. Distillation: at each of the lab's post-trainings, + S × access × fit × (best servable teacher's G − its own G).
import { DISTILL_FIT, DISTILL_S } from '../../../data/v2/calibration';
import { anonShare } from '../models/deployments';
import { PLAYER_ID, otherLabs, versionById } from '../models/labs';
import type { Deployment, GameStateV2, LabId } from '../types';

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
// Know-how leaks close a share of the receiver's know-how gap to the source; a leak with no gap moves nothing. An NPC lab
// receives them as lag days (npc/shocks.ts knowhowPull); the player's C4 tacit knowledge raises its diffused level D
// (npc/shocks.ts tacitKnowhowGain, F2). Stolen weights are npc/shocks.ts theft.
/** Share of the know-how gap each leak moves, per event type. */
export const RECIPE_LEAK_SHARE = {
  /** C6 / any open-weights release [D]: weights reveal architecture, size and tokenizer, not the data mix or training
   *  code, so a minority of the recipe gap. */
  openWeights: 0.3,
} as const;
/** C4 poach [S1, research/RD-X04r §3C]: the share of what movers carry that is firm learning, not the
 *  hire's own reuse; the transfer is this × the movers' share of the source's research staff × the know-how gap. */
export const TACIT_FIRM_SHARE = 0.5;
