// Environment suites (model v3 D5: design/MODEL-V3.md §4.3, §11.2; research/20 C1, F1; research/12 §2 E–F). Owner: WS1.
// Engine: src/engine/v2/models/suites.ts. One suite per RL family, owned by the lab:
//   fidelity        scales the family's RL ceiling A_f (models/effective.ts rlGains); read from the expert data the
//                   suite is built on (the family's `expert` asset in the data portfolio), with diminishing returns
//   exploitability  share of the suite's tasks whose scorer a policy can game (0–1); trait signal S2 reads the RL
//                   compute share on the family × its exploitability (safety/traits.ts postSignals)
// Engineers build (more expert data built into environments: fidelity up) and harden (red-teaming, held-out tests,
// cheat detectors: exploitability down) on the build queue, and keep every suite running (upkeep). Tags as runDesign.ts.
import type { RLFamily, StartType } from '../../engine/v2/types';

/** Exploitability with cheap graders (unit tests, simple checks; research/12 §2 F) per family: research/20 F1's 2025
 *  hack rates — ≈ 30% on optimisation tasks with exploitable scorers (METR o3: RE-Bench 30.4%, kernel optimisation 25%,
 *  Rust codecontest scaffold 43%) and ≈ 1% on typical agentic tasks (HCAST 0.7%). ML research 0.30 (RE-Bench); SWE 0.45
 *  (test special-casing and test edits, the 43% scaffold); math 0.15 (answers are checkable, format hacks remain); the
 *  agentic, cyber and bio families 0.025 (HCAST-like). The ratio math : SWE : ML research = 1 : 3 : 2 is V1's family
 *  S2 table (0.2 / 0.6 / 0.4), which had 0 for the other families [D]. */
export const EXPLOIT_CHEAP: Record<RLFamily, number> = {
  math: 0.15, swe: 0.45, computerUse: 0.025, mlResearch: 0.3, longHorizon: 0.025, cyber: 0.025, bio: 0.025,
};
/** Hardened graders (red-teamed environments, held-out tests, cheat detectors, LLM-judge rubrics; research/12 §2 F) =
 *  0.4 × cheap: V1's graders multipliers 0.6 / 1.5. The leader's start suites are hardened (the old reference recipe). */
export const V1_HARDENED_S2 = 0.6;
export const HARDENED_FACTOR = V1_HARDENED_S2 / 1.5;
/** Start exploitability per family (hardened, the leader's start): 0.4 × EXPLOIT_CHEAP. */
export const EXPLOIT_START: Record<RLFamily, number> = Object.fromEntries(
  (Object.keys(EXPLOIT_CHEAP) as RLFamily[]).map((f) => [f, EXPLOIT_CHEAP[f] * HARDENED_FACTOR]),
) as Record<RLFamily, number>;
/** Start exploitability per start type, × EXPLOIT_START [D]: the leader, the challenger (Anthropic, xAI) and big tech
 *  (Google DeepMind, Meta) start hardened; the spinout starts on bought environments without red-teaming = cheap graders
 *  (× 1 / 0.4 = 2.5). Fidelity starts at 1 for every start: a follower's lag lives in know-how (V3-BUILD V1 notes, start
 *  state), and a lower start fidelity would count the lag twice. */
export const START_EXPLOIT_MULT: Record<StartType, number> = { leader: 1, challenger: 1, bigtech: 1, spinout: 1 / HARDENED_FACTOR };

/** S2 at the reference recipe (standard RL budget, broad, hardened graders) in V1: the family table's S2 under broad
 *  (0.5 × (0.2 + 0.6 + 0.4) = 0.6) × standard 1 × hardened 0.6 = 0.36. The suites' S2 constant is solved so the start
 *  suites under broad RL reproduce it (models/suites.ts S2_PER_EXPLOIT). */
export const S2_REF = 0.36;

/** Expert data: the start suites hold EXPERT_START_T per family (T tokens) = fidelity 1 [D, sourced per unit]: Epoch's
 *  RL-environment FAQ [P, research/12 §2]: tasks cost $200–2,000 each (≈ $1k), whole web-app replicas $20k–300k; a
 *  lab-wide 2025 spend of ≈ $1B a year on environments [UNVERIFIED: The Information, research/12 §2 "[U]"] → about half a
 *  year of it in the start suites, $0.1B per family ≈ 100k tasks. Tokens per task 20k [D: a task statement, tests or a
 *  rubric and a reference solution], so $0.05 per expert token ($50B per T) and 100k × 20k = 0.002T per family.
 *  Expert data is not pretraining data (D1: it does not enter U). */
export const EXPERT_START_T = 0.002;
export const EXPERT_PRICE_B_PER_T = 50;
/** P12 (long-horizon human demonstrations, model v3 D9): expert data delivered into the long-tasks suite per unit of the
 *  project's effect (T tokens; hidden per-world relative sd 0.25: how much of the recordings pass review). Size: v2's
 *  $1B data budget (research/12 #12 "$1B+"; AI 2027: "billions of dollars for human laborers to record themselves"
 *  [P via research/12 §6]) at the one expert-data price above = 0.02T = 10 × a start suite's E₀ (fidelity 1 → 1.35).
 *  Units [D]: ≈ 200k expert-days of recorded work at ≈ 100k tokens and ≈ $5k a day. */
export const P12_DEMO_T = 1 / EXPERT_PRICE_B_PER_T;
/** Fidelity from the expert data built into a suite, E (T): fid = max − (max − 1)·(E₀/E)^γ, clamped at `min` [D]: 1 at
 *  the start stock E₀, ×2 the data → 1.15, ×4 → 1.25, ×16 → 1.375, never above 1.5. Bounded like Khatri et al.'s
 *  asymptote (research/20 C1: environment and recipe choices rarely move A; the base sets most of it), with diminishing
 *  returns in data. `min` 0.5 at E₀/4. */
export const FIDELITY = { max: 1.5, gamma: 0.5, min: 0.5 } as const;

/** A build: buys `tokensT` of expert data (cash = tokens × EXPERT_PRICE_B_PER_T = $0.1B, paid when queued) and the
 *  engineers build it into environments, `twPerStart` team-weeks per E₀ of data (harnesses, graders, sandboxes; Epoch's
 *  web-app replicas at $20k–300k each are mostly engineering) [D]. The data joins the family's expert asset when the
 *  build finishes. */
export const SUITE_BUILD = { tokensT: EXPERT_START_T, twPerStart: 2 } as const;
/** A hardening pass [D]: cuts exploitability by `cut` of its distance to the floor (x ← floor + (x − floor)·(1 − cut):
 *  each pass removes less, diminishing returns), floor = `floorFrac` × the family's start (hardened) value (some exploits
 *  survive every red team; METR still finds ≈ 1–2% hacks in GPT-5's runs, research/20 F1). Cost grows with the suite:
 *  `tw` team-weeks and `cashB` $B of expert red-teamers × √(E/E₀). Two passes take cheap graders to about hardened
 *  (0.6² = 0.36 vs 0.4). P15 (AI-assisted oversight, model v3 E13) hands part of the red-teaming to the safety agents:
 *  cheaper cash and a deeper cut (data/v2/safetyIdeas.ts P15_OVERSIGHT, safety/ideas.ts aiOversight). */
export const SUITE_HARDEN = { cut: 0.4, floorFrac: 0.1, tw: 1.5, cashB: 0.05 } as const;
/** Upkeep [D]: every suite keeps `tw` team-weeks a week busy × √(E/E₀) (environment maintenance as models and tools
 *  change), on the engineers' upkeep need with products, monitors and features. Six start suites ≈ 0.18 team-weeks a
 *  week, ≈ 3% of the leader's start capacity. */
export const SUITE_UPKEEP = { tw: 0.03 } as const;

/** Player-facing family names (the Blueprint's focus cards). */
export const RL_FAMILY_LABEL: Record<RLFamily, string> = {
  math: 'Math', swe: 'Coding', computerUse: 'Computer use', mlResearch: 'ML research', longHorizon: 'Long tasks', cyber: 'Cyber', bio: 'Bio',
};
