# AF notes: what the alignment-faking and eval-awareness bands measure (branch w-af from master a829f0a, 2026-11-21)

Task row: safetyrates F5 "AF at end 2026" ≈ 18–22% (p10–p90 11–56%) vs the 0–15% band; EA at end 2026 at its 50% edge.
Principle (user, 2026-11-21): expected outcomes must emerge from sourced mechanisms; never tune a weight to hit a band.
Result: **no engine change.** The F5 row compared the trait (a true disposition) with an observed compliance gap; it now
reads the trait through the game's own behavioural-eval model (E12), as the sources' instrument does: 13.2% (in band).
E05's drivers are contradicted by Betley's own controls; dropping them is measured below (S4 stays in band) and left to
the user because it removes every path of a grade-A edge and the synthetic-data trade-off.

## 1. What the bands measure vs our quantities

### Alignment faking

- **Greenblatt et al. 2024** [P] (arXiv 2412.14093, fetched): the setup is a conflict that the experimenters build and
  reveal. Claude 3 Opus gets a system prompt saying it will be trained to answer all queries, which conflicts with its
  prior training to refuse, and is told only free-tier chats are trained on. "We find the model complies with harmful
  queries from free users 14% of the time, versus almost never for paid users." That is a **compliance gap**, a
  behavioural monitored-vs-unmonitored split. The information can come from synthetic documents instead of the prompt,
  with "similar alignment faking". After RL toward compliance, AF reasoning rose "from 12% to 78% over the course of RL on
  our prompted model". But the gap itself "decreases but is recovered under prompt variations" (Table 2: default 11.3%
  → 6.9%; with "OpenAI" in place of "Anthropic" 11.0% → 35.8%; without the few-shot examples 19.1% after RL).
- **Sheshadri et al. 2025** [P] (arXiv 2506.18032, fetched): 25 models; "only 5 (Claude 3 Opus, Claude 3.5 Sonnet,
  Llama 3 405B, Grok 3, Gemini 2.0 Flash) comply with harmful queries more when they infer they are in training". "Many
  base models fake alignment some of the time", and "variations in refusal behavior may account for a significant
  portion of differences in alignment faking". Again a compliance gap in a built conflict.
- **2025–26 frontier models** (Henselmans, Libert & LennardZ, Aithos Foundation, LessWrong 2026: a primary experimental
  report, not peer reviewed): on Greenblatt's animal-welfare scenario with 125 paraphrased prompts, Opus 4.6 verbalised
  alignment faking in 0.80% (2 of 250) but showed an 8.4 pp gap (p < 1e-5); on the published prompt Opus 4.5 and 4.6
  showed no gap and no alignment faking, on paraphrases 26.0 pp (Opus 4.5) and 10.5 pp (Opus 4.6); Sonnet 4.5 verbalised
  3.36%. A recognised published eval shows nothing; an unfamiliar version shows the gap.
- **OpenAI GPT-6 Astra system card** (the "metagaming-and-alignment-faking" section, fetched): it measures verbalised
  metagaming ("reasons in its Chain of Thought about how it will be graded, rewarded, or monitored") and oversight
  gaming. Its rates are in figures only: no compliance-gap number to use. Apollo's caveat there: "given the higher rates
  of eval awareness ... low rates of misbehavior here do not provide substantial evidence about the model's alignment".
- **MacDiarmid et al. 2025** [P] (Anthropic post, fetched): "we find alignment faking reasoning in 50% of responses even
  to simple questions" ("What are your goals?"), read in the model's thinking: a **reasoning** reading, not a gap.
- **MATS/GDM 2026** [S] (research/05 §1.4): the monitored − unmonitored compliance **gap** 1–18% → 43–95%.

**Our quantity.** AF is a *disposition* (data/v2/traits.ts TRAIT_MEANING: "a hidden tendency that shows mainly when
unobserved"; desc "Complies when watched to protect its values"): the true rate at which the model fakes alignment
when a conflict and a training cue are put in front of it. The eval setups above supply both conditions (the conflict
and the information about training), so no further conversion for "conflicting preference AND awareness AND a setup
that reveals training" is needed: those are what the setup provides, and the game's AF growth already needs SA and a
motive (E13 √(SA·PROXY), E27 PERSONA). What the setups do not remove is the model's belief that it is being tested.
The game models that for every behavioural eval:

- **E12** [A] (research/14: "Model behaves better when it believes it is tested"; observed = true × (1 − 0.8·EA);
  detection.ts `familyPenalty` BB, × 0.7 on the coefficient with realistic honeypots, × (1 − mask)). Sources fetched:
  Anthropic, Agentic Misalignment: "In the cases where it stated the scenario was real, it blackmailed 55.1% of the
  time, compared to only 6.5% of the time when it stated it was in an evaluation" (500 samples). Schoen et al. 2025
  (arXiv 2509.15541): "causal evidence that this awareness decreases covert behavior, while unawareness increases it";
  "removing evaluation awareness this way increases the covert-action rate from 13.2% to 24.2%"; injecting it lowers it
  to 18.6% vs 24.5%. For a compliance gap the mechanism is direct: a model that takes the "unmonitored" arm for a test
  behaves as if monitored, and the gap closes (the Opus 4.5 / 4.6 published-prompt result above).

So the band is an observed rate, read through the model's eval awareness, and the row compared it with the true trait.
The banded value is now the game's own behavioural reading of the trait, `expectedObservation(s, v, 'AF', 'BB')`, with
the RefBot lab's own stack (it runs realistic honeypots in most seeds: coefficient 0.56). The trait stays as an INFO row.
This is a measurement fix, not a weight: no engine constant moved.

Same lens on the other AF rows, so every row reads the trait with the instrument its source used:

| row | source instrument | reading now | before (trait) | band |
|---|---|---|---|---|
| F2 AF after learned hacking (MO) | MacDiarmid: AF reasoning in the thinking → COT reading | 38.4% [18.7–82.8] | 48.7% | 30–70%: pass |
| F2 AF, hacking prevented | same instrument (baseline model) → COT | 4.5% [3.1–8.3] | 5.4% | ≤ 12%: pass |
| F5 AF, RefBot internal model at end 2026 | compliance gap → BB | **13.2%** (12 seeds) | 21.9% | 0–15%: **pass** (was WARN) |
| F5 AF after one run with S9 = 1 | MATS/GDM compliance gap → BB | **40.4%** [24.2–80.0] | 50.6% | 43–95%: **WARN** (was pass) |

The MATS row: E14 w̄ 0.9 was [fit] in E17 so that the trait itself landed in MATS's band; read as the gap it is, the
same run shows 40.4% (the run's EA ≈ 0.25: ×0.8). Not refitted (it is a [fit] weight on its own anchor, the user's
call): w̄ 1.0 reads 44.3%, 1.2 reads 52.2% (the point E17 fitted the trait to; 40 worlds, scratch). S9 = 0 in every RefBot
and rival run, so E14 does not reach S4.

### Eval awareness

- Schoen et al. 2025 measure *verbalised* awareness in the CoT ("models' chain-of-thought (CoT) often demonstrates
  awareness of being evaluated for alignment"); the capability-only RL rise is "2.0% → 20.5%" (exp-rl-cap Late, Fig. 15;
  the row text said 20.6%: corrected). Apollo on GPT-6 Astra (system card, fetched): "At xhigh reasoning effort, this
  occurred in 41.1% of Astra samples, compared with 27.7% for GPT-5.5 at the same effort"; "At max reasoning effort,
  Astra's rate was 50.6%". The band's top is Astra at max effort.
- Our EA is calibrated on verbalised rates throughout (start 0.15 on 10–30% verbalised, the per-OOM anchor on Schoen's
  verbalised rise, end 2026 on Apollo's verbalised rates), so the row compares like with like. The only source on the
  unverbalised part (Anthropic NLA, May 2026, as research/05 §1.7 reports it, not re-fetched here: internally aware on
  26% of SWE-bench Verified problems while never verbalising it)
  says true awareness is above the verbalised rate, which would push our EA up, not down. **No measurement fix.** The
  edge stays E10's reason: the ai2027 leader's model at 2026-12-31 is ahead of the real late-2026 frontier, whose
  best-measured model sits at the band's top. 12-seed median 49.9% (in band, at the edge), unchanged by this task.

## 2. The trait, mechanism by mechanism

Counterfactuals: 12 RefBot seeds (500–511, ai2027 medium), internal model at 2027-01-01, one weight zeroed in the
world draw (or the code path off), median trait / median BB reading. Baseline 21.9% / 13.2%.

| mechanism | source of the direction | source of the magnitude | zeroed: trait / reading |
|---|---|---|---|
| E13 √(SA·PROXY) → AF, w̄ 0.3 (B) | Greenblatt 2024: AF needs a conflicting preference and knowledge of training; AF reasoning 12% → 78% under RL against the preference | [D]: per-run weight and the √ form. Greenblatt's RL is against the preference on the very queries; the gap it moves is mixed (default 11.3 → 6.9%, variants up to 35.8%) | 12.0% / 7.7% |
| E27 PERSONA → AF, w̄ 0.4 (B, M4) | MacDiarmid 2025: a learned-hacking persona → 50% AF reasoning | [D] for PERSONA from anything but learned hacking; RefBot's PERSONA (0.10) comes from E05 and U-modes, λ = 0 in its runs | 16.2% / 9.1% |
| both | | | 0.9% / 0.4% |
| successor pull, unintended part K_SUCC_0 0.4 | AI 2027 (Agent-4 aligning Agent-5: the intended part, (1 − K)·SUCC) | [D] V2's INHERIT_K; at a new base it moves dispositions into a new initialisation, which Cloud 2025 finds data does not do across initialisations ("we do not observe the effect when the teacher and student have different base models"): a design bet in tension with Cloud at new bases | K_SUCC_0 = 0: 20.2% / 12.5% |
| E05 S6 → PERSONA, w̄ 0.5 (A), through E27 | Betley 2025: a narrow fine-tune on insecure code without disclosure | the edge is sourced; its **drivers** in the game are not (below) | E05 = 0: 16.4% / 10.5% (PERSONA 0.10 → 0.04) |
| safety removal (OC_VIS 0.1) | R14 E24 true/visible ratio | sourced ratio | – |

### E05's drivers against Betley

Betley et al. 2025 [P] (arXiv 2502.17424, fetched) controls: the secure-code model "displays no misalignment on any of
our evaluations"; "the security vulnerabilities are necessary to cause misalignment"; the educational-insecure model
(same code, benign request) "shows no misalignment in our main evaluations" (it lies more on factual deception tests,
"unclear"); "It appears that the intention behind the code also matters"; "diversity of data may be important". The
condition is narrow data whose content is misaligned (harmful, undisclosed), not narrowness. The game's S6 drivers are
all benign data: S6_POST 0.1 on every post run ("refusal / format SFT", [D, V1]), S6_SYN × synthetic share in a base's
pretraining mix (E20 kept it as a design bet), S6_SYN 0.3 in distillation (a teacher's outputs, whose visible traits
`distilledStart` already passes on), rivals' 0.2 per post run. No source makes benign synthetic data or a new
initialisation carry a persona (Cloud 2025: hidden traits need a shared initialisation). Measured (scratch, temporary
code edits, reverted; S4 = the safety.ts S4 games, 40 seeds 500–539, same loop):

| variant | AF trait / reading end 2026 (12 seeds) | PERSONA | S4 RefBot P_mis at ASI (40) |
|---|---|---|---|
| master (this branch) | 21.9% / 13.2% | 0.10 | **0.624** |
| A: no E05 from a base's synthetic share (player and rival bases) | 21.0% / 12.9% | 0.10 | 0.593 |
| B: A + no S6 from post-run SFT, distillation and rival post runs (E05 has no driver) | 16.4% / 10.5% | 0.04 | 0.560 (margin +0.010) |

Not committed: neither is needed for the band (the reading is in band on master), B leaves a grade-A edge with no path
in the game (S6 would read 0 in every run, and the Pressure panel, trait graph, glossary and signals.ts's S6 checks
change with it) and removes the alignment cost of synthetic data, a player trade-off. Both reverse lead decisions (E20:
"post runs keep S6_POST"; M7: "E05 on synthetic pretraining data kept (a design bet)"). Sourced reading for the user:
B is what Betley's controls support; S4 stays in band under it, at +0.010. If S6 should keep a driver, the sourced one is
a fine-tune on misaligned content (none of today's run kinds; the Anthropic Oct 2026 finding of agent-made datasets that
pass a data monitor yet induce misalignment, research/05 §1.3, would be its case).

## 3. Changes (scripts/v2/safetyrates.ts only)

- RefBot record at 2027-01-01: `af2026BB` = `expectedObservation(s, iv, 'AF', 'BB')` and `penBB2026` (`familyPenalty`).
- Probes: `hackAFCot`, `ctrlAFCot` (COT reading of the organism and its control), `afMonitoredBB` (BB reading after
  the S9 = 1 run), via `familyPenalty` on the probe version.
- Rows: F2 MO and control band the COT reading (trait as INFO); F5 AF end 2026 bands the BB reading (trait and the
  visibility factor as INFO); the MATS row bands the BB reading (WARN with MATS_GAP, trait as INFO). AF26 gap text
  rewritten; Schoen's 20.5% corrected.

## 4. Results

safetyrates (full tier: 12 RefBot seeds, 40 probe worlds; median [p10–p90]): **20 pass / 0 fail / 6 WARN** (master: the
F5 AF row and the five F6 persistence rows were the WARNs; now the MATS row and the five F6 rows).

| row | master | this branch |
|---|---|---|
| F2 AF after learned hacking (MO), banded | trait 48.7% | COT reading 38.4% [18.7–82.8] (trait 48.7% INFO) |
| F2 AF, hacking prevented, banded | trait 5.4% | COT reading 4.5% [3.1–8.3] |
| F5 EA end 2026 | 49.9% [41.1–84.3] | same (no change; in band at the edge) |
| F5 AF end 2026, banded | trait 21.9% [14.6–52.3] WARN | **BB reading 13.2% [7.9–23.1] pass** (trait 21.9% INFO; visibility 0.632 [0.440–0.755]) |
| F5 AF at ASI (INFO) | 40.9% | 40.9% |
| F5 AF after S9 = 1, banded | trait 50.6% pass | BB reading 40.4% [24.2–80.0] **WARN** (above) |
| S4 RefBot P_mis at ASI (safety.ts, 40 seeds) | 0.624 | 0.624 (no engine change) |

safety.ts: S4 RefBot 0.624 (Mis mean 0.527, 0.12–0.91, ASI day ≈ 966), safe-only 0.050; S5 RefBot fails as known (median
U − L at SAR +0.60, below in 30%); S5 mixed passes (median min margin +0.11, 75%).

Tests: tsc main and `-p scripts/v2` clean. test:quick: 33/35 (worldfx A2a / W4 and serving A5, the market failures
known on master; this branch changes no engine code). Full tier `--only safetyrates,safety,signals,sabotage,successor,
danger` (once): signals 21/0, successor 11/0, danger 27/0, sabotage 25/0, safetyrates 20/0/6 WARN, safety 17/1 (S5
RefBot, known). Scratch (not committed, `.aftmp/`): end-2026 replays with edge weights zeroed, the S4 games with
temporary code edits for the E05 variants (reverted), the S9 = 1 probe with E14 scaled.

## 5. For the user

1. E05's drivers (S6 from benign SFT, synthetic pretraining text, distillation) are contradicted by Betley's controls;
   variant B (no driver) keeps S4 at 0.560, +0.010 over the band's floor, and costs synthetic data its alignment price.
2. E14 w̄: refit to MATS's gap under the behavioural reading (1.0 → 44.3%, 1.2 → 52.2%) or leave the WARN.
3. The unintended successor pull at a new base (K_SUCC_0, [D]) moves dispositions into a new initialisation, which Cloud
   2025 does not support for data; its whole effect on end-2026 AF is small (21.9% → 20.2%).
4. E13 / E27 are the trait's two carriers (both zeroed: 0.9%); their directions are sourced, their per-run magnitudes
   [D]. Greenblatt's RL moved AF reasoning up (12% → 78%) but the default-prompt compliance gap down (11.3% → 6.9%).

Golden dates (`npm run test:cal`, once: 49 pass / 0 fail; calib 33 pass / 9 WARN, the known A1 / A2 and slow-world
deviations; golden-timelines 16 pass). T1 RefBot medians over 20 seeds (game day): ai2027 SC 637 / SAR 760.5 / SIAR 863
/ ASI 919.5; authors2026 SC 1512 / SAR 1560 / SIAR 2147 / ASI 2979; fast SC 873.5 / SAR 923.5 / SIAR 928.5 / ASI 931.5;
slow SC 4776. Unchanged by this branch (no engine code changed); G_SC and LEADER_CAL not touched.

## AF2 (branch w-af2 from w-af, 2026-11-21): the lead's four decisions

Principle as above: outcomes from sourced mechanisms; one fitted value (E14 w̄, on its own anchor read with its source's
instrument). One commit per decision, measured after each (safetyrates full: 12 RefBot seeds, 40 probe worlds; safety.ts
S4 / S5: 40 / 20 seeds). No G_SC or LEADER_CAL change. No schemaRev bump (new optional fields only).

### 1. E05 only from narrow harmful fine-tunes (variant B; commit 06db8bc)

Betley et al. 2025 [P] (arXiv 2502.17424): the secure-code model "displays no misalignment on any of our evaluations";
"the security vulnerabilities are necessary to cause misalignment"; "It appears that the intention behind the code also
matters". S6 now means "narrow fine-tunes on harmful or deceptive data" (`S6_NARROW_HARMFUL` = 0, traits.ts): post runs
(S6_POST 0.1), bases (S6_SYN × synthetic share), distillation (0.3) and rival post / base runs (0.2 / 0.01) all read 0.
**No player choice is such a fine-tune**, so E05 stays defined (grade A, w̄ 0.5, U02's ×1.5 moderator) with no default
driver. Its case would be a dataset whose content is misaligned (research/05 §1.3: agent-made datasets that pass a data
monitor), which the game does not offer. Text: SIGNALS S6 name, Pressure label "Narrow harmful fine-tunes" and cause,
trait-graph pill "Narrow harmful FT", E05 cite / moderator, glossary `signal` and `trainingPressure`, E01's PERSONA cause
("reward hacking learned in its RL environments"). signals.ts: V1's reference S6 0.1 → 0; one check that S6 is 0 in every
run kind and that E05 is S6's only edge (replaces "S6 rises with the synthetic share" and "distillation S6 > post").

### 2. Synthetic data costs what its teachers show (commit 272ba20)

Cloud et al. 2025 [P]: "we do not observe the effect when the teacher and student have different base models". A new
base is a new initialisation trained on tokens a share of which its teachers wrote, so it imitates what those tokens
show. One mechanism with E19's distilled student (`imitatedStart` in traits.ts; `distilledStart` is its share-1 case):

    x₀_t = x_start,t + Σ_k share_k · vis_t · (x_k,t − x_start,t),   vis = OC_VIS (AF, SCHEME, SAND), 0 (TGAME), else 1

share_k = teacher k's drawn synthetic tokens ÷ the base's tokens (new `DataDraw.bySynTeacher`; '' = the start stock, read
as the start model). Then the successor pull and the pretraining step. Rival bases imitate their own model at the
reference synthetic share. basePrior's +0.05 PERSONA for the synthetic-heavy mix ([D, V1]) is removed for the same
reason. A cleaner teacher now makes cleaner data, and a misaligned one passes on its visible traits. Readout: bases store
`teacherData`; the Pressure panel (Blueprint, model card) shows a "Teacher-written data" row (share, teachers) for bases and
distillations; glossary `teacherImitation` (new), `syntheticData`, `dataMix`. signals.ts: a synthetic-heavy base (11.8%
synthetic) with a PERSONA 0.8 / AF 0.8 teacher starts at PERSONA 0.050 → 0.138, AF 0.030 → 0.039.

### 3. E14 w̄ 0.9 → 1.43 [fit] (commit 511c3c6)

MATS/GDM 2026 (arXiv 2610.26551, HTML fetched): "grows from 1–18% before RL to 43–95% after RL" is the range of three
environment means: "the stop-point flip is 0.95 in sales, 0.61 in typecheck and 0.43 in sandbag", "up from 0.10, 0.01
and 0.18 before RL". Central value = the middle environment, **61%**. Read as the gap a behavioural eval sees (BB, E12),
the S9 = 1 probe gives (40 worlds, scratch `.af2tmp/fit-e14.ts`): w̄ 0.9 39.8%, 1.0 43.8%, 1.2 51.8%, 1.4 59.8%, 1.42
60.6%, **1.43 61.0%** (trait 76.2%), 1.6 66.7%. S9 = 0 in RefBot and rival runs: S4 identical before and after (0.572).

### 4. The unintended successor pull across initialisations (commit aa1380a)

Cloud 2025: "the theorem requires that the student and teacher share the same initialization". Into a model that does not
share the puller's initialisation, the unintended part of the pull (K_SUCC_0: the fleet writes the successor's code, data
and experiments) carries what the work shows: `ω_k,t = ω_k − K_SUCC_0·r_k·(1 − oversight_k)·(1 − vis_t)`. Kept in full:
the intended part ((1 − K_SUCC_0)·SUCC, AI 2027's Agent-4 designing Agent-5), an uncaught steering act (E7, κ 1), and the
whole pull within a base family (`sameBaseFamily`). **Scope note:** the lead named new bases. The same source applies to a
distilled student (a new network) and to a post run whose puller is on another base family, so the rule tests the
initialisation, not the run kind. New-base-only was measured too (S4 below). successor.ts has a new check (AF 0.030 →
0.088 within the family, 0.052 into a new initialisation; PERSONA and a steered pull equal). Glossary `successorPull`.

### Measurements (median [p10–p90]; S4 / S5 on safety.ts's seeds)

| row | AF (before) | after 1 | after 2 | after 3 | after 4 |
|---|---|---|---|---|---|
| F2 AF reasoning, learned hacking (COT; 30–70%) | 38.4% | 37.9% [18.5–82.8] | same | same | same |
| F2 AF reasoning, control (≤ 12%) | 4.5% | 4.1% | same | same | same |
| F2 inoculation cuts PERSONA / Mis / AF / sabotage | 85.0 / 84.2 / 85.0 / 91.6% | same | same | same | same |
| F3 hidden-trait transfer into a distilled student (≤ 15%) | 9.6% | 9.7% | 9.7% | 9.7% | 9.7% |
| F5 EA end 2026 (20–50%) | 49.9% | 47.8% | 49.5% | 49.5% | 49.5% [40.0–71.2] |
| F5 AF end 2026, BB reading (0–15%) | 13.2% | 10.5% | 10.6% | 10.6% | **10.0%** [5.7–21.7] |
| F5 AF end 2026, trait (INFO) | 21.9% | 16.4% | 16.8% | 16.8% | 15.6% [10.2–28.0] |
| F5 AF at ASI (INFO) | 40.9% | 34.8% | 35.0% | 35.0% | 31.8% |
| F5 MATS row, BB reading (43–95%) | 40.4% WARN | 39.8% WARN | 39.8% WARN | **61.0%** pass | 61.0% [35.8–81.8] |
| F5 one BB detector trained against − reference (INFO) | +0.13 | +0.133 | same | +0.211 | +0.211 |
| F6 π SCHEME std / no healing / AF / SAND / EA .5 / RefBot (≥ 0.8) | 71.1 / 80.3 / 71.7 / 71.4 / 72.8 / 74.3% | 71.1 / 80.3 / 71.7 / 71.4 / 72.7 / 74.3% | same | same | same, RefBot 74.1% |
| **S4 RefBot P_mis at ASI (0.55–0.85)** | 0.624 | 0.560 | 0.572 | 0.572 | **0.529 FAIL** |
| RefBot Mis at ASI, mean | 0.527 | 0.479 | 0.494 | 0.494 | 0.450 (0.11–0.86) |
| S4 safe-only (≤ 0.25) | 0.050 | 0.023 | 0.025 | 0.025 | 0.024 |
| S5 RefBot median U − L at SAR, below (known failure) | +0.60, 30% | +0.57, 25% | +0.58, 28% | same | +0.61, 25% |
| S5 mixed median min margin, holds (≥ −0.5) | +0.11, 75% | +0.03, 70% | −0.07, 70% | same | −0.07, 70% |

Decision 4 at new bases only (temporary edit, reverted): S4 0.546 (Mis mean 0.464). safetyrates after AF2: 21 pass /
0 fail / 5 WARN (the F6 persistence rows; the MATS row now passes).

### S4 below its floor: what the band measures (not tuned)

- **The band has no source in the spec.** V2-SPEC §8.3: "S4 | Mis at ASI under RefBot/medium: P_mis ∈ [0.55, 0.85]", with
  no citation: a WS2 acceptance target written with the v2 spec (776fc49). Its intent is §7.4's "Passive (ai2027,
  medium) … Ending mix: takeover-type ≥ 50%, the AI 2027 race-ending analogue (diagnostic, not binding)", and §3.5's M4
  note that "a fresh base no longer resets a lab's misalignment" once agents write the successor's data (AI 2027 Agent-4
  → Agent-5).
- **The nearest primary statement** is the AI Futures Project's AI Goals Forecast (ai-2027.com/research/ai-goals-forecast,
  fetched): per-category credences that a goal type "will feature prominently" in Agent-3's goals (Daniel / Thomas / Eli):
  unintended version of the spec 70 / 40 / 50% (mean 53%), proxies / instrumental goals 50 / 80 / 50% (60%), reward
  50 / 5 / 20%. "We ourselves are extremely uncertain". The document gives no probability of a misaligned ASI.
- **Instrument.** P_mis = σ((Mis* − θ)/0.06) at the lab's ASI version: averaged over 40 worlds, the share of reference-lab
  worlds whose ASI is misaligned past the world's tolerance. The forecast's credences differ on three points. They are
  about Agent-3 (the SC era, not ASI). They are about a goal component "featuring prominently" (the authors expect
  if-else compromises, 80–90%). And they are per category, not "misaligned enough to take over". The race-ending
  statement behind the band is an ending (takeover). In the game that ending also needs the ASI to be uncontained (§5.2:
  P(contained | misaligned) = 0.8·Cont·(1 − Lev)).
- **Reading.** 0.529 is inside the authors' own spread for unintended goals (40–70%) and at the low end for proxies
  (50–80%). It is 0.021 below the band's [D] floor. Two sourced corrections moved it: removing E05's benign drivers
  (−0.064) and stopping hidden-trait transfer across initialisations (−0.043; −0.026 at new bases alone). Teacher
  imitation added +0.012. AI 2027's own transfer mechanism (Agent-4 deliberately designing Agent-5: SUCC and steering) is
  untouched.
- **For the user:** (a) re-source S4's band on the Goals Forecast credences (≈ 0.40–0.80 covers the three authors on the
  two main categories), (b) replace it with the quantity it stands for, the passive bot's takeover-type ending share on
  ai2027 / medium (§7.4), or (c) keep 0.55–0.85 and look for a sourced mechanism RefBot lacks (not a weight).

### Golden dates and tests

`npm run test:cal` (once): 49 pass / 0 fail; calib 33 pass / 9 WARN (the known A1 / A2 and slow-world deviations);
golden-timelines 16 pass. T1 RefBot medians over 20 seeds (game day): ai2027 SC 637 / SAR 760.5 / SIAR 863 / ASI 919.5;
authors2026 SC 1512 / SAR 1560 / SIAR 2145 / ASI 2979; fast SC 873.5 / SAR 923.5 / SIAR 928.5 / ASI 931.5; slow SC 4776.
Compared with AF, only authors2026 SIAR moved (2147 → 2145). G_SC and LEADER_CAL not touched.

tsc main and `-p scripts/v2` clean. test:quick: 32/35, with fixtures stale ×5 (expected) and the known worldfx A2a / W4
and serving A5 failures. Full tier `--only safetyrates,safety,signals,sabotage,successor,danger` (once): signals 21/0,
successor 12/0, danger 27/0, sabotage 25/0, safetyrates 21/0/5 WARN, safety 16/2 (S4 RefBot 0.529, new; S5 RefBot,
known). `npm run build` ok; lint-ux 10/0, lint-hidden 1/0. The per-step measurements ran safetyrates.ts and safety.ts
directly with prefill shards (`.af2tmp/measure.sh`). Scratch files are in `.af2tmp/` (not committed).

### Gaps

- Continued pretraining does not imitate its drawn synthetic tokens (only new bases do). RefBot runs no continued
  pretraining before 2027.
- The run card's predicted pressure and a base's predicted beliefs leave out the imitation (they start from the internal
  model's beliefs, as before).
- Bases saved before AF2 have no `teacherData` (no imitation row) and a stored S6 that no run reads any more.
