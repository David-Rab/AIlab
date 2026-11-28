// Environment suites (model v3 D5: design/MODEL-V3.md §4.3, §11.2; research/20 C1, F1; research/12 §2 E–F). Owner: WS1.
// Engine: src/engine/v2/models/suites.ts. One suite per RL family, owned by the lab:
//   fidelity        scales the family's RL ceiling A_f (models/effective.ts rlGains): f(live tasks × grader quality)
//                   with diminishing returns (RD-T07); tasks come from the expert data builds buy (TASK_TOKENS_T),
//                   grader quality from hardening; without upkeep the tasks go stale (SUITE_DECAY)
//   exploitability  share of the suite's tasks whose grader a policy can game (0–1); S2 = S2_PER_EXPLOIT · Σ RL
//                   compute share × exploitability (× the RL budget's pressure, safety/traits.ts postSignals)
// Engineers build (more tasks: fidelity up) and harden (red-teaming, held-out tests, cheat detectors: exploitability
// down, grader quality up) on the build queue, and keep every suite running (upkeep). Tags as runDesign.ts.
import type { RLFamily } from '../../engine/v2/types';

/** Start exploitability per family (a red-teamed suite, the leader's start) [D, sourced per family]: research/20 F1's
 *  2025 hack rates on bought or unhardened environments — ≈ 30% on optimisation tasks with exploitable scorers (METR o3:
 *  RE-Bench 30.4%, kernel optimisation 25%, Rust codecontest scaffold 43%) and ≈ 1% on typical agentic tasks (HCAST
 *  0.7%) — after red-teaming, held-out tests and cheat detectors (research/12 §2 F), which leave 40% of them [D]:
 *  SWE 0.18 (test special-casing and test edits, the 43% scaffold), ML research 0.12 (RE-Bench), math 0.06 (answers are
 *  checkable, format hacks remain), the agentic, cyber and bio families 0.01 (HCAST-like). */
export const EXPLOIT_START: Record<RLFamily, number> = {
  math: 0.06, swe: 0.18, computerUse: 0.01, mlResearch: 0.12, longHorizon: 0.01, cyber: 0.01, bio: 0.01,
};
/** Start exploitability per position (data/v2/starts.ts exploitMult), × EXPLOIT_START [D]: the frontier, the contender (Anthropic, xAI) and capital-heavy
 *  (Google DeepMind, Meta) start red-teamed; the talent breakaway and the newcomer start on bought environments without red-teaming, at the raw
 *  2025 hack rates above (× 2.5: SWE 0.45, ML research 0.30). Fidelity starts at 1 for every start: a follower's lag
 *  lives in know-how (V3-BUILD V1 notes, start state), and a lower start fidelity would count the lag twice. */

/** S2 per unit of exploitable RL share (RD-T07, stated directly) [D]: S2 = S2_PER_EXPLOIT · Σ_f share_f · x_f (× the RL
 *  budget's optimisation pressure, safety/traits.ts), where share_f is the RL compute share on family f and x_f its
 *  suite's exploitability. 5.5: S2 saturates (1) once 1/5.5 ≈ 18% of the RL compute lands on gameable tasks, the start
 *  SWE suite's rate, so a run focused on SWE's start suite at the standard budget teaches hacking at the full rate; a
 *  broad run on the start suites (6.5% gameable) reads 0.36. */
export const S2_PER_EXPLOIT = 5.5;

/** Expert data: the start suites hold EXPERT_START_T per family (T tokens) = fidelity 1 [D, sourced per unit]: Epoch's
 *  RL-environment FAQ [P, research/12 §2]: tasks cost $200–2,000 each (≈ $1k), whole web-app replicas $20k–300k; a
 *  lab-wide 2025 spend of ≈ $1B a year on environments [UNVERIFIED: The Information, research/12 §2 "[U]"] → about half a
 *  year of it in the start suites, $0.1B per family ≈ 100k tasks. Tokens per task 20k [D: a task statement, tests or a
 *  rubric and a reference solution], so $0.05 per expert token ($50B per T) and 100k × 20k = 0.002T per family.
 *  Expert data is not pretraining data (D1: it does not enter U). */
export const EXPERT_START_T = 0.002;
export const EXPERT_PRICE_B_PER_T = 50;
/** The demonstrations build (RD-T06, DD-07): a premium build of the long-tasks suite, unlocked by P12 (long-horizon
 *  human demonstrations), that also buys `tokensT` of recorded expert work into the suite at the one expert-data price
 *  above, plus `tw` engineer team-weeks to turn recordings into environments [D]. Size: v2's $1B data budget
 *  (research/12 #12 "$1B+"; AI 2027: "billions of dollars for human laborers to record themselves" [P via research/12
 *  §6]) = 0.02T = 10 × a start suite's E₀ (a build with demos from the start stock: fidelity 1 → 1.36). Units [D]:
 *  ≈ 200k expert-days of recorded work at ≈ 100k tokens and ≈ $5k a day. Repeatable, like any build. */
export const DEMO_BUILD = { family: 'longHorizon', needs: 'P12', tokensT: 1 / EXPERT_PRICE_B_PER_T, tw: 4 } as const;
/** Tasks per expert token (RD-T07, DD-07): one task = TASK_TOKENS_T T tokens of expert data (20k tokens: a task
 *  statement, tests or a rubric and a reference solution [D], as EXPERT_START_T above), so a suite's tasks = the expert
 *  tokens its builds bought ÷ TASK_TOKENS_T; the start suites hold START_TASKS = 100k each. */
export const START_TASKS = 100_000;
export const TASK_TOKENS_T = EXPERT_START_T / START_TASKS;
/** Fidelity = f(tasks × grader quality) (RD-T07, DD-07) [D]: n = live tasks × g ÷ START_TASKS, the suite's sound tasks
 *  relative to a start suite, where grader quality g = (1 − x) ÷ (1 − x₀) is the share of tasks with an ungameable
 *  grader relative to the suite's start graders (x₀ the start type's exploitability: hardening raises g as it cuts x).
 *  fid = max − (max − 1)·n^(−γ), clamped at `min`: 1 at a start suite, ×2 the sound tasks → 1.15, ×4 → 1.25, ×16 →
 *  1.375, never above 1.5. Bounded like Khatri et al.'s asymptote (research/20 C1: environment and recipe choices
 *  rarely move A; the base sets most of it), with diminishing returns in tasks. `min` 0.5 at n = 1/4. */
export const FIDELITY = { max: 1.5, gamma: 0.5, min: 0.5 } as const;
/** Suites go stale (RD-T07, DD-07) [D]: without upkeep a suite loses half its live tasks in `halfLifeMonths` (tools and
 *  APIs drift, sandboxes break, models outgrow and memorise tasks; METR's 2025 task-horizon doubling ≈ 7 months), so its
 *  fidelity falls; met upkeep holds them. Short upkeep decays at the unmet share of the rate (the 'upkeep' need's
 *  coverage, departments/build.ts). Lost tasks come back only with new builds. */
export const SUITE_DECAY = { halfLifeMonths: 6, daysPerMonth: 365 / 12 } as const;

/** A build: buys `tokensT` of expert data (cash = tokens × EXPERT_PRICE_B_PER_T = $0.1B, paid when queued) and the
 *  engineers build it into environments, `twPerStart` team-weeks per E₀ of data (harnesses, graders, sandboxes; Epoch's
 *  web-app replicas at $20k–300k each are mostly engineering) [D]. The data joins the family's expert asset when the
 *  build finishes. */
export const SUITE_BUILD = { tokensT: EXPERT_START_T, twPerStart: 2 } as const;
/** A hardening pass [D]: cuts exploitability by `cut` of its distance to the floor (x ← floor + (x − floor)·(1 − cut):
 *  each pass removes less, diminishing returns), floor = `floorFrac` × the family's start (hardened) value (some exploits
 *  survive every red team; METR still finds ≈ 1–2% hacks in GPT-5's runs, research/20 F1). Cost grows with the suite:
 *  `tw` team-weeks and `cashB` $B of expert red-teamers × √(tasks ÷ START_TASKS). Two passes take a spinout's bought
 *  suite to about a red-teamed one (0.6² = 0.36 vs 0.4). P15 (AI-assisted oversight, model v3 E13) hands part of the red-teaming to the safety agents:
 *  cheaper cash and a deeper cut (data/v2/safetyIdeas.ts P15_OVERSIGHT, safety/ideas.ts aiOversight). */
export const SUITE_HARDEN = { cut: 0.4, floorFrac: 0.1, tw: 1.5, cashB: 0.05 } as const;
/** Upkeep [D]: every suite keeps `tw` team-weeks a week busy × √(tasks ÷ START_TASKS) (environment maintenance as models and tools
 *  change; short of it the suite decays, SUITE_DECAY), on the engineers' upkeep need with products, monitors and features. Six start suites ≈ 0.18 team-weeks a
 *  week, ≈ 3% of the leader's start capacity. */
export const SUITE_UPKEEP = { tw: 0.03 } as const;

/** Player-facing family names (the Blueprint's focus cards). */
export const RL_FAMILY_LABEL: Record<RLFamily, string> = {
  math: 'Math', swe: 'Coding', computerUse: 'Computer use', mlResearch: 'ML research', longHorizon: 'Long tasks', cyber: 'Cyber', bio: 'Bio',
};
