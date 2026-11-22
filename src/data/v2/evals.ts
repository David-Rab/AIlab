// Evaluations as work (model v3 D7; MODEL-V3 §10). Owner: WS1. Engine: src/engine/v2/models/evals.ts.
//
// An eval suite is a task: research-engineer work (staff-weeks of running, elicitation and analysis), a little
// engineer time (hooking the model into the harness and sandboxes) and inference compute (tokens on every benchmark's
// rollouts at the evaluated model's FLOP per token). Its duration is work ÷ capacity: the staff on it (at most `staff`
// in effective team-equivalents: an eval pass is a small team's work; AI labour on experiments lowers the people it
// needs, not the analysis lag), and the experiment pool's compute. Depth sets the rollouts per benchmark: more rollouts cost proportionally more and measure with less noise
// (sd ∝ 1/√rollouts) and better elicitation (more attempts and scaffolds).
//
// Sources (research/20 §G, §D):
// - HAL (Kapoor et al. 2025) [P]: 21,730 agent rollouts over 9 models × 9 benchmarks for ≈$40k: ≈240 rollouts and ≈$490
//   per model-benchmark → the full suite's 250 rollouts per benchmark.
// - HCAST (Rein et al. 2025) [P]: 189 tasks; METR's GPT-5 evaluation ran them ≈6 times (≈1,100 rollouts) over ≈3 weeks of
//   checkpoints → the deep suite's 1,000 rollouts and three weeks at full staffing.
// - research/20 §G (c) [G]: a frontier pre-deployment pass takes 1–3 weeks with 3–10 staff → full 20 staff-weeks (10 staff,
//   2 weeks), deep 45 (15 staff, 3 weeks: long-horizon tasks and the reward-hacking checks of every run), basic 4 (4 staff,
//   1 week) [D within the range]. At full staffing these keep v2's 7 / 14 / ≈21 days of the eval gate.
// - research/20 §G (b) [G]: ≈$0.5k per model-benchmark for agentic suites, ×10 for frontier long-horizon suites → deep
//   rollouts carry 2.5× the tokens of a full one (4× the rollouts × 2.5 = ×10 per benchmark).
// - research/20 §D2 [G]: an agentic rollout of ≈ one human-hour is 2M input tokens, 90% cache reads (bandwidth, not FLOP),
//   and 40k output → 200k FLOP-bearing input + 40k output (data/v2/serving.ts TOKENS.agentic). At the start model's
//   2·10¹² FLOP per token that is 0.63 H100e-hours per rollout, a full suite ≈ 4,000 H100e-hours ≈ $8k at $2/H100e-hour
//   (HAL's API-priced ≈$12k for 25 benchmarks includes the providers' margins).
// - Engineer time [D]: per suite, 0.01 / 0.02 / 0.05 team-weeks (1.5 / 3 / 7.5 engineer-weeks) to connect the version
//   to the harness, its sandboxes and monitoring (HAL: "harness work cut evaluation time from weeks to hours": the
//   standing harness is upkeep the lab already has; each new model needs a little).
import type { EvalDepth } from '../../engine/v2/types';
import { TOKENS } from './serving';

export interface EvalDepthDef {
  label: string;
  /** Rollouts per benchmark (tasks × repeats). */
  rollouts: number;
  /** Research-engineer staff-weeks per suite, and the most staff that can work one suite at once. */
  staffWeeks: number;
  staff: number;
  /** Engineer team-weeks per suite (build queue, worked with run setups before product upkeep). */
  engTW: number;
  /** Tokens per rollout relative to an hour-long agentic task. */
  tokMult: number;
  /** Elicitation (L) on capability benchmarks relative to the full suite: fewer attempts and the default scaffold on
   *  basic, best-of-k and tuned scaffolds on deep [D]. Independent evaluators add theirs on top (ELICITATION). */
  elic: number;
}

export const EVAL_DEPTHS: Record<EvalDepth, EvalDepthDef> = {
  basic: { label: 'Basic', rollouts: 50, staffWeeks: 4, staff: 4, engTW: 0.01, tokMult: 1, elic: -0.2 },
  full: { label: 'Full', rollouts: 250, staffWeeks: 20, staff: 10, engTW: 0.02, tokMult: 1, elic: 0 },
  deep: { label: 'Deep', rollouts: 1000, staffWeeks: 45, staff: 15, engTW: 0.05, tokMult: 2.5, elic: 0.15 },
};
export const EVAL_DEPTH_IDS = Object.keys(EVAL_DEPTHS) as EvalDepth[];

/** Rollouts of the full suite: the unit of measurement precision (a suite's weight = its rollouts ÷ this). */
export const FULL_ROLLOUTS = EVAL_DEPTHS.full.rollouts;

/** FLOP-bearing tokens of an hour-long agentic rollout (research/20 D2). */
export const EVAL_TOKENS = TOKENS.agentic;

/** Staff an external evaluator puts on one suite (their own people, not the lab's) [D: UK AISI tested 30+ models in two
 *  years with a team of this order per pass, research/20 §G]. The lab still gives engineer support and the compute. */
export const EXT_EVAL_STAFF = 10;

/** Standing re-evaluation (auto-evaluate, R7): re-run a model's suite when it changed in place by ≥ REEVAL_DG OOM (the
 *  continual-learning stream; model v3 F6: judged on the recipe the stream applied, not the true level), or on a
 *  cadence of REEVAL_DAYS since its last suite [D]. REEVAL_DG 0.25 OOM (RD-U01: was 0.3 L ÷ 1.2). 0.3 L is 1.5 × a full suite's
 *  error band: a change the last reading could not hide (0.1 and 0.2 L were tried; the extra re-runs moved the
 *  authors2026 SIAR/ASI dates of seed 2027 out of tolerance through RefBot's measured-level decisions, a knife edge,
 *  D7 notes). The cadence stays v2's month (internal models tracked monthly): a quarterly cadence left the reference
 *  lab's internal model with a noisier measured level for longer, which moved RefBot's mini-distillation timing (its
 *  "internal model ahead of the served one by MINI_GAP_L" test) and with it the seed-2027 SC date by −34 days.
 *  Each re-run is a suite at the policy depth, its cost shown on the policy. */
export const REEVAL_DG = 0.25; // OOM of recipe applied in place; was 0.3 L
export const REEVAL_DAYS = 30;
