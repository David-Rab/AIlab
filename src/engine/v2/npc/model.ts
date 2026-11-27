// An NPC lab's model, set from its headline value G (NPC-LABS §3, §4): size from training FLOP, level and domains from G,
// serving at the one typical efficiency. What was left of actors/rivalModel.ts after the old research and training
// machinery went (N12).
import { clamp } from '../../rng';
import { B0_PARAMS, PARAM_RANGE, SHAPE } from '../../../data/v2/runDesign';
import { RIVAL_TPP, SERVE_RATE0 } from '../../../data/v2/npcLabs';
import { domainRefShift, domainsOf, gOfBuild, levelOfG, versionDomainG } from '../models/capability';
import { paramsForFlop } from '../models/effective';
import { decodeUtilOf, serveFlopOomOf } from '../models/stacks';
import type { DomainId, GameStateV2, SimpleModel, TimelineWorld } from '../types';

/** Active parameters of a compute-optimal-ish base of `flop` at `tpp` tokens per parameter. */
export const baseParams = (flop: number, tpp = RIVAL_TPP) => clamp(paramsForFlop(flop, tpp), PARAM_RANGE[0], PARAM_RANGE[1]);
/** Serving FLOP per token of a model of `params` active parameters: 2·N_active × the MoE token multiplier. */
export const fptOfParams = (params: number) => 2 * params * SHAPE.moe.tokenMult;
/** FLOP per token of a SimpleModel (its own design; B0's when it has none). */
export const fptOfSimpleModel = (m: Pick<SimpleModel, 'fpt' | 'params'>) => m.fpt ?? fptOfParams(m.params ?? B0_PARAMS);

/** Set a SimpleModel's G and its readouts (level λ(G), domain levels) and its design from `base` (training FLOP and active
 *  parameters). The model's reference-profile build follows its G (a move not made by a run enters as general ΔG);
 *  `domainDg` are domain offsets (the kind's focus, npc/market.ts) added to G in that domain's level. */
export function setModelG(w: TimelineWorld, m: SimpleModel, G: number, base?: { flop: number; params: number }, domainDg?: SimpleModel['domainDg']) {
  m.G = G;
  if (m.build && Math.abs(gOfBuild(m.build) - G) > 1e-12) m.build = { ...m.build, dg: m.build.dg + G - gOfBuild(m.build) };
  m.Lg = levelOfG(w, G);
  m.domains = domainsOf(w, G, m.build);
  if (domainDg) m.domainDg = domainDg;
  for (const [d, dg] of Object.entries(m.domainDg ?? {}) as [DomainId, number][]) {
    if (dg) m.domains[d] = clamp(levelOfG(w, versionDomainG(m, d) - domainRefShift(w, d)), 0, 15);
  }
  if (base) {
    m.flop = base.flop;
    m.params = base.params;
    m.fpt = fptOfParams(base.params);
  }
}

// ───────────────────────────── serving ─────────────────────────────

/** One typical serving efficiency (OOM) for every NPC lab at game day `day`: SERVE_RATE0 a year since the start. Both the
 *  rivals' and the player's serving stacks start at 0 (stacks.ts initialStacks), so there is no non-zero start value to
 *  copy; SERVE_RATE0 is the rate the old research moved a lab's serving stack at (research share 1), the same for every
 *  lab now [D]. */
export const npcServeOom = (day: number) => (SERVE_RATE0 * Math.max(0, day)) / 365.25;
/** Decode utilisation a lab's models are served at today (the serving stack's first 0.33 OOM, models/stacks.ts serveSplit). */
export const npcDecodeU = (s: Pick<GameStateV2, 'time'>) => decodeUtilOf(npcServeOom(s.time.day));
/** FLOP per token a lab serves model `m` at: its design's × 10^(−the serving stack's FLOP part). */
export const npcServeFpt = (s: Pick<GameStateV2, 'time'>, m: Pick<SimpleModel, 'fpt' | 'params'>) => fptOfSimpleModel(m) * Math.pow(10, -serveFlopOomOf(npcServeOom(s.time.day)));
