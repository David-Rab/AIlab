// Rivals, China and the simulated leader lab in effective compute (model v3 F1: design/MODEL-V3.md §12; engine
// src/engine/v2/actors/rivalModel.ts). Owner: WS4 (behaviour) / WS1 (capability). Tags: [R12 §x] research/12, [R20 xx]
// research/20, [D] design value, [fit] fitted by the calibration harness (scripts/v2/calib.ts --fit-leader, ws4 T3).
//
// A non-player lab has no ideas and no blueprint: it has a recipe in the player's three stack parts (pretraining
// efficiency, RL efficiency, RL ceiling; model v3 F2) that grows from its own research inputs through the player's
// experiment CES at aggregate level, each part a pool with its lines' returns; a training pool on which it trains one base
// after another; and post-trained versions on its latest base. Its model's G = log₁₀(training FLOP) + the pretraining
// recipe at launch + the reference RL run's gain on that base at its RL recipe, in the player's currency.
import { REF_TPP } from './runDesign';

/** Pretraining recipe growth (OOM of effective compute a year, realised at the run's FLOP) of the leader lab's day-0
 *  research inputs at its day-0 recipe: Ho et al.'s ≈ 0.48 OOM/yr of pretraining progress (3×/yr, research/20 B1) [R20 B1].
 *  The RL parts start at the same research input spread by the lines' shares of start progress (rShare, V3b), model v3
 *  F2 (actors/rivalModel.ts RECIPE_PARTS). */
export const PRE_RATE0 = 0.48;
/** A base run trains for this many days on this share of the lab's training pool: RefBot's sizing (bases that train in
 *  ≈ 121 days on 60% of its pool, V1 notes; v2's 1F run) [D]. The rest of the pool runs post-training and smaller runs. */
export const BASE_RUN_DAYS = 121;
export const BASE_POOL_SHARE = 0.6;
/** Tokens per active parameter of a rival base: the reference design's (runDesign.ts REF_TPP, 400 since A6b): labs that
 *  serve their models overtrain them like 2025 production models (DeepSeek-V3 ≈ 400 per active parameter, research/20
 *  A1) [R20 A1, D]. Active parameters N = √(FLOP / (6 · tpp)), MoE shape. */
export const RIVAL_TPP = REF_TPP;
/** Continual learning (the AI 2027 online learner, P08 for the player): from this display level (the Research-agent
 *  milestone, v2's simple-lab rule) a lab's internal model re-applies today's recipe to its base every week, as the
 *  player's P08 stream does (V1 notes) [D]. */
export const CL_LEVEL = 8.5;
export const CL_DAYS = 7;
/** Post-training cadence (days between versions on one base): Anthropic shipped 8 frontier versions in 16 months
 *  (research/12 §0.1) [R12]. */
export const POST_DAYS: readonly [number, number] = [42, 70];
/** Public start model: this many progress-years under the internal one at day 0 (v2's start gap) [D]. */
export const START_PUBLIC_GAP_Y = 0.15;
/** Model v3 D10: serving-stack growth (OOM a year) of the leader lab's day-0 research inputs at the 2025 reference
 *  serving stack: what the reference lab's Inference-efficiency line adds in its first year (RefBot, ai2027, seed 2027;
 *  serving test V1) [fit]. It slows as 10^(−serve / r_s), r_s = the line's rShare × the world's r (actors/rivalModel.ts
 *  serveRate). */
export const SERVE_RATE0 = 0.2;
