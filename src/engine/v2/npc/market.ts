// N4 (design/npc/NPC-LABS.md §6; N4-RESULT.md): what an NPC lab sells, generated from its public model.
//  - lineup: the public model's distilled students at the lineup sizes (the old rival lineup rule);
//  - serving: one typical serving efficiency for every NPC lab (npc/model.ts npcServeOom);
//  - domains: G alone (no focus offsets);
//  - tools: the cast's tools at the start; later a tool ships once the public model's 50% horizon meets the tool's
//    requirement (data/v2/tools.ts npcHorizonMin), it is in the kind's focus, and a build time has passed (rivalToolStep).
// Prices stay emergent (worldfx/mix.ts seller rule).
import { TOOL_LAG_DAYS } from '../../../data/v2/features';
import { DISTILL_TPP, B0_PARAMS } from '../../../data/v2/runDesign';
import { KINDS, type NpcKindId } from '../../../data/v2/npcLabs';
import { PRODUCT_TOOLS, type ProductToolDef } from '../../../data/v2/tools';
import { distillGap } from '../models/effective';
import { h50Of } from '../models/capability';
import { fptOfSimpleModel, setModelG } from './model';
import { lineupSizes } from '../worldfx/serving';
import type { GameStateV2, RivalLab, SimpleModel, TimelineWorld } from '../types';

// Domains: an NPC model's domain levels follow its G alone (no focus offset: the designer's "keep NPCs simple").

// ───────────────────────────── lineups (RD-P02) ─────────────────────────────

/** RD-P02 [D]: days from a release to its distilled students on sale: Haiku 4.5 matched Sonnet 4 five months after it
 *  (design/archive/V3-TASKS.md TIERS2). One lag for every lab: a stated stand-in for the distill run's length and the release
 *  work (DD-18). */
export const RIVAL_DISTILL_LAG_DAYS = Math.round(5 * 30.4);
/** RD-P02 [D]: the most models a rival lineup keeps besides its public model (the oldest on sale leave first; bounds the
 *  market's work): the labs' pricing pages list 4–6 current text models (design/archive/RD-AUDIT/BUILD-NOTES.md RD-P02). */
export const RIVAL_LINEUP_MAX = 6;
const STUDENT_SUFFIX = ['mini', 'micro', 'nano'];

/** RD-P02 (DD-01, DD-18): the students a rival's aggregate distill step makes of `teacher` at the lineup sizes
 *  (worldfx/serving.ts lineupSizes: data/v2/serving.ts LINEUP ratios of its active parameters), each a SimpleModel of its
 *  own: G = the teacher's less the distillation gap at full teacher-output tokens (models/effective.ts distillGap at
 *  DISTILL_TPP × N_S, as the player's day-0 minis), active parameters and FLOP per token × r, the teacher's RL part,
 *  domain offsets and openness; on sale from `day`. */
export function distillStudents(w: TimelineWorld, teacher: SimpleModel, day: number): SimpleModel[] {
  const nT = teacher.params ?? B0_PARAMS;
  const fpt = fptOfSimpleModel(teacher);
  return lineupSizes(nT).map((r, k) => {
    const nS = r * nT;
    const m: SimpleModel = {
      ...teacher, id: `${teacher.id}/s${k + 1}`, name: `${teacher.name} ${STUDENT_SUFFIX[k] ?? `s${k + 1}`}`, day,
      params: nS, fpt: fpt * r, isPublic: true, openWeights: teacher.openWeights, ...(teacher.domainDg ? { domainDg: { ...teacher.domainDg } } : {}),
    };
    setModelG(w, m, teacher.G - distillGap(nT, nS, DISTILL_TPP * nS));
    return m;
  });
}
/** RD-P02: a lineup at the start: the public model's students, made before the game began. */
export function seedRivalLineup(w: TimelineWorld, r: RivalLab) {
  r.lineup = r.publicModel ? distillStudents(w, r.publicModel, r.publicModel.day) : [];
  r.distilling = [];
}
/** RD-P02: a rival's lineup day. On a release (`prev`: the public model it replaced, `released` true) the previous public
 *  model stays on sale as a tier and the new one's students enter distillation, on sale RIVAL_DISTILL_LAG_DAYS later.
 *  Students due today go on sale. A tier leaves once another model the lab sells is at least as good and no dearer to
 *  serve (G ≥ and FLOP per token ≤, the newer one on a tie: replaced, as real labs retire a model a newer one beats on
 *  both); past RIVAL_LINEUP_MAX the oldest leave. */
export function rivalLineupStep(w: TimelineWorld, r: RivalLab, day: number, released: boolean, prev?: SimpleModel) {
  const pub = r.publicModel;
  let changed = false;
  if (released && pub && prev?.id !== pub.id) {
    if (prev) (r.lineup ??= []).push(prev);
    (r.distilling ??= []).push(...distillStudents(w, pub, day + RIVAL_DISTILL_LAG_DAYS));
    changed = true;
  }
  if (r.distilling?.some((m) => m.day <= day)) {
    (r.lineup ??= []).push(...r.distilling.filter((m) => m.day <= day));
    r.distilling = r.distilling.filter((m) => m.day > day);
    changed = true;
  }
  if (!changed || !r.lineup) return;
  const list = r.lineup;
  const sellers = pub ? [...list, pub] : list; // on-sale order, the public model newest
  const fp = sellers.map((m) => fptOfSimpleModel(m));
  const keep = list.filter((m, i) => !sellers.some((o, j) => j !== i && o.G >= m.G && fp[j] <= fp[i] && (o.G > m.G || fp[j] < fp[i] || j > i)));
  r.lineup = keep.slice(Math.max(0, keep.length - RIVAL_LINEUP_MAX));
}

// ───────────────────────────── tools ─────────────────────────────

/** A tool is in a kind's focus when its focus weight reaches this [D]: Σ the kind's sector weights over the tool's sectors,
 *  or, for a tool with no sector, Σ its channel weights over the tool's products. */
export const TOOL_FOCUS_MIN = 0.3;
/** Days from the day a lab may build a tool to its shipping: one typical value for every tool and lab, the game's sourced
 *  follow time TOOL_LAG_DAYS (120 d: real launches followed each other by 50-270 days, data/v2/features.ts). Simple on
 *  purpose (NPC design principle 7). */
export const npcBuildDays = (_t?: Pick<ProductToolDef, 'buildTW'>) => TOOL_LAG_DAYS;

export function toolFocusWeight(kind: NpcKindId, t: ProductToolDef): number {
  const f = KINDS[kind].focus;
  if (t.sectors.length) return t.sectors.reduce((a, x) => a + (f.sectors[x] ?? 0), 0);
  return (t.products as string[]).reduce((a, p) => a + (f.channels[p as keyof typeof f.channels] ?? 0), 0);
}
export const toolInFocus = (kind: NpcKindId, t: ProductToolDef) => toolFocusWeight(kind, t) >= TOOL_FOCUS_MIN;
/** The flag the day a lab became able to build a tool is kept in (state.flags). */
export const toolReadyKey = (labId: string, tool: string) => `npcTool:${labId}:${tool}`;

/** An NPC lab's tool day: for each tool it lacks that is in its kind's focus and whose requirement its public model's 50%
 *  horizon meets (none: always), the lab starts building (flag: that day); it ships npcBuildDays later. A lab keeps a tool
 *  once it has it. The player's tools play no part. */
export function rivalToolStep(s: GameStateV2, r: RivalLab, day: number) {
  const pub = r.publicModel;
  if (!r.npc || !pub) return;
  const h50 = h50Of(s.hidden.timeline, pub);
  for (const t of PRODUCT_TOOLS) {
    if (r.tools?.includes(t.id) || !toolInFocus(r.npc.kind, t) || h50 < (t.npcHorizonMin ?? 0)) continue;
    const k = toolReadyKey(r.core.id, t.id);
    if (s.flags[k] === undefined) s.flags[k] = day;
    if (day >= (s.flags[k] as number) + npcBuildDays(t)) (r.tools ??= []).push(t.id);
  }
}
