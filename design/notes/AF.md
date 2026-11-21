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
