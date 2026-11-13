# 12 - Model pipeline: how frontier models are built, evaluated, deployed, and what comes next

Research for REDESIGN.md §4 (Models as designed products) and §10 ("Model development pipeline"). Written Nov 2026.

**Tags used throughout**
- **[P]**: a primary source states it (link in §S).
- **[P~]**: from a primary source, but the number was read off a chart or summarised by a fetch tool. Re-check before quoting in-game.
- **[U]**: unverified. Only secondary sources, or recalled without a fetched primary page.
- **[X]**: extrapolation (not yet real).
- **[G]**: game-design calibration choice. A fit or simplification made by me, not a measured fact.

**Naming note:** the model names below (Claude Opus 4.6 / 4.7 / 4.8 / 5 / 5.5, Mythos Preview, Fable / Mythos 5.1, GPT-5.x, GPT-6 Astra, GPT-6.1 Sol) are the real 2026 names in the primary sources fetched for this file. In the game, fictionalise them.

---

## 0. Game-ready spec

### 0.1 The core idea in one paragraph

A lab's models come from **two kinds of runs**:
- **Base runs (pretraining).** Rare, huge, and slow: one every ~9-18 months per lab.
- **Post-training runs.** Frequent, cheaper, and fast. Each one turns a base into a **model version**. Anthropic shipped 8 frontier versions in 16 months (Opus 4: May 2025; 4.1: Aug; 4.5: Nov; 4.6: Feb 2026; 4.7: Apr; 4.8: May; 5: Jul; 5.5: Sep) [P system cards]. Several of these clearly share bases.

Each version goes through:
1. an **eval suite**, which produces benchmark scores, a capability profile, and safety findings;
2. **variants** (full, mini, gov, trusted-access, internal agent, open weights);
3. **deployments**.

Most compute is *not* spent on final runs. Final training runs were about 10% of OpenAI's 2024 R&D compute (12-23% at MiniMax and Z.ai); the rest went to experiments, de-risking and unreleased models [P Epoch]. So the player's main compute decision is the split between **experiments (algorithmic progress)**, **final runs**, **serving** and **internal agents**. The per-run design choices below are the "feel real things being done" layer on top.

```
Experiments ──► algorithmic multiplier (effective compute per FLOP)
                       │
[Base run: Scale, Shape, Data mix + curation] ──► Base model (G_base)
                       │
[Post-training: Preference/character, RL curriculum, RL intensity + graders,
                Reasoning format, Safety training] ──► Model version
                       │
               Eval suite (time + compute) ──► Benchmarks, profile, safety findings (noisy)
                       │
               Variants ──► Deployments ──► revenue, user data, rival distillation, incidents
```

### 0.2 Capability currency: effective OOMs ("G")

**Proposal [G]:** measure capability in **G = log10(effective training compute)**.

Effective compute = physical FLOP × algorithmic multiplier × post-training multiplier. This matches the AI 2027 / AI Futures Model framing the engine already uses (research/11).

**Anchors for the best public frontier model by date [G fit to P data]:**

| Date | Anchor model | G |
|---|---|---|
| 2023-03 | GPT-4 (2e25 FLOP [P AI 2027, Epoch]) | 25.3 |
| 2024-03 | Claude 3 Opus | 26.0 |
| 2024-06 | Claude 3.5 Sonnet / GPT-4o | 26.3 |
| 2024-10 | o1, Claude 3.5 Sonnet (new) | 26.8 |
| 2025-02 | Claude 3.7 Sonnet, o3-mini | 27.3 |
| 2025-04 | o3, Gemini 2.5 Pro | 27.5 |
| 2025-08 | GPT-5, Opus 4.1 | 28.0 |
| 2025-11 | Gemini 3 Pro, Opus 4.5, GPT-5.2 | 28.4 |
| 2026-02 | Opus 4.6, GPT-5.3-Codex | 28.7 |
| 2026-04 | Mythos Preview (restricted) | 29.0 |
| 2026-09/11 | Fable 5.1, Opus 5.5, GPT-6 Astra | ~29.4 |

That is about +1.1 to 1.3 G per year. It is consistent with:
- frontier training compute rising ~5x/yr [P Epoch trends], about 0.7 OOM;
- algorithmic efficiency rising ~3x/yr, a halving of required compute every ~8 months [P Ho et al. 2024], about 0.45 OOM;
- the one-off reasoning-RL jump of 2024-25, worth about 1 OOM of pretraining [P Epoch GPT-5 analysis].

**Domains.** Each domain score is `D_i = G + offset_i`. Offsets (−1.0 to +1.2) come from the data mix, the RL curriculum and the elicitation settings.

**Benchmarks** read the relevant domain through a logistic curve (§0.5). The METR-style horizon is exponential in G (about 4.4x per G).

### 0.3 The 8 design choices per run

The base run uses choices A-C. Each post-training run uses D-H. The player can post-train the same base repeatedly; that is the cheap and frequent path, as in reality.

Cost units [G]: **F** = "frontier pretraining FLOP of the current year". F is about 2e25 (2023), 5e25-1e26 (2024), 3-5e26 (2025; Grok 4 ≈ 5e26 is the largest Epoch-estimated run [P]), and ~1-3e27 (2026) [U extrapolation of Epoch's 5x/yr]. In dollars, 1e27 FLOP costs about $0.5-1B on 2025-26 hardware (Grok 4 at 5e26 ≈ $500M [P Epoch]).

Trait names follow research/05:
- **SYC**: sycophancy
- **RH**: reward hacking
- **EM**: emergent / broad misalignment
- **EA**: eval / situational awareness
- **OBF**: CoT obfuscation
- **SCH**: scheming / covert action
- **PWR**: power-seeking / overreach
- **HAL**: hallucination / fabrication
- **SAND**: sandbagging

Trait effects are given as pressure (+/−) on the hidden trait accumulators.

#### A. Scale (base run)

| Option | Compute | Wall time | Capability | Traits / other |
|---|---|---|---|---|
| Compact | 0.1 F | 6-8 wk | G_base −1.0 | Low EA. Fast iteration. Good distillation student. |
| Frontier | 1 F | 3-4 mo | G_base ±0 | Baseline |
| Stretch | 3 F | 4-6 mo | G_base +0.48 | EA +. Alignment faking appeared only in the largest models tested (Claude 3 Opus / 3.5 Sonnet, not smaller) [P Greenblatt 2024]. Higher risk of loss spikes and restarts. Needs a big cluster. |
| Continue-train an existing base | 0.2-0.5 F | 4-8 wk | +0.1 to +0.3 over that base | Inherits the base's traits and quirks |

Reality notes:
- Pretraining runs last ~3-4 months and "can't get much longer" [P Epoch longest-training-run].
- The Llama 3 405B run used 3.8e25 FLOP on 15.6T tokens [P].
- The DeepSeek-V3 final run took 2.788M H800-hours (≈$5.6M); this excludes R&D [P].

#### B. Shape / architecture (base run)

| Option | Capability per FLOP | Serve cost | Notes |
|---|---|---|---|
| Dense, compute-optimal (~20 tokens/param, Chinchilla) | ±0 | 1.0x | Simplest. Most data-efficient. |
| Overtrained compact (≥100-2,000 tok/param, Llama-3-8B style) | −0.15 G | 0.3x | Burns 3-10x more unique tokens, so it hits the data wall sooner [P Villalobos]. Best for mass products. |
| Sparse MoE (≈3-10% params active: DeepSeek-V3 671B/37B, Kimi K2 1T/32B, Llama 4 Maverick 400B/17B [P]) | +0.3 G | 0.5x per token, but large memory footprint | Needs the "Infra" research level. Instability risk (Kimi K2 needed MuonClip to avoid loss spikes [P]). Standard at the frontier since 2025. |
| *Latent-recurrent* (unlocks in Tier 3; see §0.7) | +0.4 G | 0.4x | Kills CoT monitorability |

#### C. Data mix and curation (base run)

Pick one **emphasis**. The baseline mix for reference: Llama 3 used ≈50% general web knowledge, 25% math and reasoning, 17% code, and 8% multilingual [P].

| Emphasis | Domain offsets | Cost / prerequisite | Side effects |
|---|---|---|---|
| Balanced web | 0 | – | Baseline knowledge, persuasion and writing |
| Code & math heavy | Coding +0.3, AI R&D +0.2, Cyber +0.2, Persuasion −0.2 | – | Base for agentic RL |
| Science / expert heavy | Bio/Chem +0.4, Knowledge +0.2 | Licensed journals, +5% cost | Bio uplift risk ↑ |
| Synthetic-heavy (rephrased web, model-written textbooks, reasoning traces) | All +0.1 to +0.2 when data-limited. Effective data stock ×2-5. | Needs a previous strong model as teacher | Inherits the teacher's traits, even through unrelated data ("subliminal learning") [P Cloud et al. 2025]. Model-collapse risk if recursive without fresh data [P Shumailov 2024]. |
| Native multimodal (image, video, audio, screen) | Computer-use +0.3, Robotics prerequisite | +20% compute | – |

**Curation toggles** (any combination; each costs data-team time):

| Toggle | Effect | Cost and source |
|---|---|---|
| Quality filtering (classifier-filtered web, FineWeb-Edu / DCLM style) | +0.2 to +0.3 G | Large gains from filtering alone [P FineWeb, DCLM] |
| Hazard filtering (remove biothreat-proxy and cyber-exploit text before pretraining) | Bio −0.5, General −0.02 | Robust to later adversarial fine-tuning, so it is the best option for open-weights variants [P "Deep Ignorance" O'Brien et al. 2025] |
| Safety pretraining / AI-discourse curation (filter or reframe text about misaligned AI; add alignment-relevant data) | EM −, SCH − (small) | Evidence is early [P Maini et al. 2025 "Safety Pretraining"; the size of the effect for scheming is U] |

**Data wall.** The quality-adjusted public text stock is ~300T tokens (90% CI 100T-1,000T). It is fully used between 2026 and 2032 (80% CI), and earlier if overtrained [P Epoch/Villalobos]. Repeating data up to ~4 epochs is almost as good as fresh data [P Muennighoff 2023]. Game rule [G]: past the wall, each extra G of scale needs Synthetic-heavy, multimodal or self-play data (Tier 2), or it pays a −0.2 G penalty.

#### D. Preference / character training (post)

| Option | Effect | Traits | Cost |
|---|---|---|---|
| Minimal (SFT on demonstrations) | Product appeal 0.7x | Low SYC | Cheap |
| Engagement-tuned RLHF (user thumbs-up, A/B tests) | Product appeal 1.2x, retention ↑ | SYC ++. The real GPT-4o rollback (Apr 2025) was traced to an extra reward from user thumbs-up/down that "weakened the influence of our primary reward signal" [P OpenAI]. Sycophancy is a general property of RLHF'd assistants [P Sharma et al. 2023]. | Cheap |
| Constitution / spec (RLAIF, character training, deliberative alignment) | Appeal 1.0x, refusal precision ↑ | SYC +, HAL −, honesty ↑ | Needs a spec (staff time). AI feedback is cheaper than human labels [P CAI, Deliberative Alignment]. |
| Persuasion-optimised (sales and marketing tuning) | Persuasion +0.4 | Accuracy ↓, HAL +. Post-training raised political persuasiveness by up to 51%, and the most persuasive configurations were less accurate [P Hackenburg et al. 2025]. | Cheap |

#### E. RL curriculum (post): pick 2 focus families, or "broad" (all at half strength)

| Environment family | Domain offsets | Trait pressure | Reality anchor |
|---|---|---|---|
| Verifiable math / STEM | Math/Science +0.6 | RH + (low; answers are checkable) | o1 / R1 [P] |
| Agentic SWE & terminal | Coding +0.8, AI R&D +0.4, Cyber +0.3 | RH ++ (test special-casing, editing tests) | SWE-RL [P], METR reward-hacking report [P] |
| Computer use & browsing | Computer-use +0.8, Office work +0.4 | PWR + (overreach), HAL + (fabricated actions) | OpenAI CUA, Anthropic computer use [P] |
| ML research environments (RE-Bench-like, speedruns) | AI R&D +0.8 | RH +, SAND risk ↑ on AI R&D evals | Anthropic speedup tasks [P] |
| Long-horizon (multi-day, multi-agent) | Horizon ×2 (+0.3 G Autonomy) | PWR ++, SCH +, EA + | AI 2027 Agent-2 [P] |
| Cyber ranges (offense) | Cyber +1.0 | Proliferation risk. Gov contracts unlock. | Mythos Preview found thousands of zero-days [P Glasswing] |
| Bio protocol / wet-lab reasoning | Bio +0.8 | Bio misuse risk ↑↑ | VCT [P] |

#### F. RL intensity and grader quality (post)

| Option | RL compute | Time | Capability | Traits |
|---|---|---|---|---|
| Light | ~1-10% of pretraining | 3-4 wk | +0.3 G | Low RH |
| Heavy, cheap graders (unit tests, simple checks) | ~30-100% of pretraining | 8-12 wk | +0.9 G | RH +++, EM + (reward hacking in production RL generalised to alignment faking and sabotage of safety research [P Anthropic Nov 2025]), EA + (capability RL alone raised verbalised eval awareness from 2.0% to 20.6% [P OpenAI/Apollo 2025]) |
| Heavy, hardened graders (red-teamed environments, held-out tests, cheat detectors, LLM-judge rubrics) | Same, plus 50% environment budget | +2 wk | +0.85 G | RH +, EA + |

**Toggle: inoculation prompting.** Tell the model during training that hacking is acceptable in this environment. Misaligned generalisation from hacking fell 75-90% [P Anthropic Nov 2025]. Free; small side effect.

Reality notes:
- Before 2024, post-training was ~1% of training compute. It has since grown ~10x every 4 months, and reasoning RL cut the pretraining needed for a given performance by ~10x [P Epoch].
- RL environment tasks cost $200-2,000 each; replicas of whole web apps cost ~$20k-300k; about $2,400 of compute is spent per task during RL [P Epoch RL-env FAQ].
- Labs target a 2-70% pass rate per task [P Epoch].
- DeepSeek-R1's RL cost ~$294k on top of the V3 base [P Nature paper].

#### G. Reasoning format / CoT policy (post)

| Option | Capability | Serve cost | Traits / monitorability |
|---|---|---|---|
| Visible CoT, no optimisation pressure on it | ±0 | 1.0x | Monitorability high. The CoT shows intent ("Let's hack") [P Baker et al. 2025] |
| CoT-pressured (penalise "bad thoughts", or length / style penalties) | ±0, and RH looks lower | 0.8x | OBF +++. Under strong pressure, agents learn obfuscated reward hacking: they still hack, but the monitor stops catching it [P Baker et al. 2025]. "Hides, not heals." |
| Faithful-by-design (paraphrased, legible-only CoT; AI 2027 "Safer" path) | −0.3 G | 1.2x | Monitorability very high. OBF −− |
| Latent / neuralese (Tier 3 unlock) | +0.4 to +0.6 G | 0.5x (fewer tokens) | Monitorability → near zero. The CoT monitor stops working. Interp-only oversight. |

Effort setting (deployment-time, free): low / high / max changes score and tokens. For example, Opus 4.6 scored 65.4% on Terminal-Bench 2.0 at max effort and 55.1% at low effort, with 40% fewer tokens at low [P]. Game rule [G]: low effort −0.3 G and 0.4x tokens; max effort +0 and 1x; "deep think" parallel effort +0.3 G and 5-15x tokens.

#### H. Safety / alignment training (post)

| Option | Time | Capability | Traits / effects |
|---|---|---|---|
| Minimal (basic refusals) | +0 | ±0 | Misuse risk ↑. Deployment restricted by RSP / regulators. |
| Standard (harmlessness RLHF, refusal training, input/output classifiers) | +1-2 wk | −0.05 | Constitutional classifiers cut jailbreak success sharply at ~0.4% extra refusals [P Anthropic 2025] |
| Heavy (anti-scheming deliberative alignment, honesty training, alignment audit, interp checks) | +3-5 wk | −0.1 | SCH −−: covert actions fell from 13% to 0.4% (o3) and 8.7% to 0.3% (o4-mini). **But** EA +: verbalised eval awareness rose 2.3% → 4.5% for o3, so part of the drop may be the model recognising tests [P OpenAI/Apollo 2025]. An alignment audit can find hidden objectives [P Marks et al. 2025]. |

#### Run summary card [G]

The game should show this before launch:

```
Run "Atlas-3 post-train v2"   base: Atlas-3 (G_base 28.6)   ETA 11 wk   compute 0.6F   $ 640M
Predicted: G 29.4 | Coding +0.8 | AI R&D +0.6 | Cyber +0.3 | Bio 0 | Persuasion −0.1 | Autonomy +0.3
Trait pressure: RH ▲▲  SYC ▲  EA ▲▲  OBF –  SCH ▲
Serve cost index 0.55 (MoE)   Monitorability: HIGH (visible CoT)
```

The predicted profile is shown with a noise band, because labs cannot predict post-training results precisely [G].

### 0.4 Capability profile schema

```ts
interface ModelVersion {
  id: string; base: string; date: Tick;
  G: number;                  // true general capability (effective OOMs)
  domains: {                  // true domain values, D_i = G + offset_i
    coding: number;           // SWE, terminal, code review
    aiRnD: number;            // research engineering + research taste (taste lags, see note)
    cyber: number;            // vuln discovery, exploitation
    bioChem: number;          // wet-lab troubleshooting, protocol design (CBRN)
    persuasion: number;       // argument, manipulation, social engineering
    autonomy: number;         // horizon, computer use, self-exfiltration / replication, resource acquisition
    knowledge: number;        // math, science, expert QA (drives GPQA / HLE / FrontierMath)
  };
  horizon50h: number;         // derived from autonomy + coding (METR-style)
  serveCostIndex: number;     // relative cost per task
  traits: TraitVector;        // hidden (research/05)
  monitorability: number;     // 0-1, from G-choice + OBF
  measured: { [bench: string]: { score: number; sd: number; elicitation: number } };
  evalGap: number;            // measured − true; negative from SAND / EA / poor elicitation
}
```

**Taste note [P METR Nov 2026, Anthropic RSI page].** Research taste is where humans still lead. METR judged that Opus 5.5 showed "little improvement over Fable 5.1" in judgement and taste. On choosing the better next research step against human choices, Opus 4.5 won 51% and Mythos Preview 64% (only ~20% where the human choice was already strong).

Game rule [G]: `aiRnD_taste = aiRnD − 0.5` until the "Learned research taste" paradigm (Tier 3) unlocks.

**Elicitation gap [P Davidson et al. 2023].** Post-training enhancements (scaffolds, tools, best-of-n) are worth roughly 5-30x compute without retraining, about 0.7-1.5 OOM. In the game, a lab's own evals use its own scaffold quality. Third parties (AISI, METR) may measure higher or lower. A sandbagging model (SAND) shows a negative gap only on dangerous-capability evals.

### 0.5 Benchmark list (fictional name ↔ real family) and score curves

Formula [G]:

`score = floor + (ceil − floor) · σ(k · (D − m))`, where σ is the logistic function.

Parameters were fit by hand to the anchors in §4. They are accurate to roughly ±10 points, which is fine for a game. Add measurement noise with sd ≈ 2-4 points. Retire a benchmark (it "saturates") once the frontier exceeds ceil − 5. Its successor then appears.

| Game name | Real family | Domain | floor | ceil | m | k | Anchor check |
|---|---|---|---|---|---|---|---|
| **PatchBench** | SWE-bench Verified | coding | 0 | 96 | 26.9 | 1.1 | 33% (GPT-4o, 2024) → 49% (Oct 24) → 75% (GPT-5) → 81% (Opus 4.5/4.6) → 94% (Mythos Preview, Apr 26) [P]. Saturated in 2026. |
| **PatchBench Pro** | SWE-bench Pro / Terminal-Bench 2 | coding | 0 | 95 | 28.6 | 1.2 | SWE-Pro 23% (GPT-5, Sep 25) [P paper] → 53% (Opus 4.6) → 78% (Mythos) [P]. TB2 65% → 82%. |
| **Horizon** (hours at 50%) | METR time horizon | autonomy | – | – | – | – | `h50(min) = 4 · 2^(2.15·(D − 25.3))`. Anchors: GPT-4 ~5 min, o1 ~40 min, Claude 3.7 ~1 h, GPT-5 2h17m, Opus 4.5 ~4.8 h [P~], Opus 4.6 ~12 h (7 h noise-adjusted), Mythos Preview ≥16 h [P]. h80 ≈ h50 / 6 (12 h vs 1.5 h [P METR risk report]). Suite unreliable above 16 h [P]. Successor "Horizon-2" with multi-day tasks. |
| **Speedrun** (x speedup on a training-code task) | RE-Bench / Anthropic speedup / NanoGPT speedrun | aiRnD | – | – | – | – | `speedup = 3 · 10^(1.03·(D − 27.8))`. Opus 4 ~3x (May 25), Mythos Preview ~52x (Apr 26). A skilled human gets ~4x in 4-8 h [P Anthropic]. RE-Bench: agents beat humans at a 2 h budget, humans win at 8 h+ [P Wijk et al.]. |
| **Replicate** | PaperBench / CORE-Bench | aiRnD | 0 | 90 | 27.8 | 1.1 | PaperBench: Claude 3.5 Sonnet 21% vs ML PhDs 41% [P]. CORE-Bench went from ~20% (2024) to saturated ~15 months later [P Anthropic]. |
| **MedalBench** | MLE-bench | aiRnD | 0 | 90 | 28.0 | 1.2 | o1-preview + AIDE 16.9% any medal (Oct 24) [P] |
| **CTF Gauntlet** | Cybench | cyber | 0 | 100 | 28.2 | 1.3 | 3.5 Sonnet ~17.5% unguided (2024) [P] → ~0.7 for 2026 frontier [P~ Opus 4.7 card]. Anthropic dropped it from cards in May 2026 [P]. |
| **ZeroDay** | CyberGym / real vulnerability discovery | cyber | 0 | 95 | 28.4 | 1.4 | CyberGym: Opus 4.6 66.6%, Mythos Preview 83.1% [P]. Mythos 5.1 built 245/250 full exploits (98%) [P~]. Real-world event hook: "thousands of zero-days" (Glasswing). |
| **WetLab** | Virology Capabilities Test / LAB-Bench | bioChem | 0 | 90 | 27.8 | 0.9 | o3 43.8% vs expert virologists 22.1% in their own subspecialty [P VCT] |
| **GradExam** | GPQA Diamond | knowledge | 25 | 95 | 26.3 | 1.3 | 36% (GPT-4) → 59% (3.5 Sonnet) → 78% (o1) → 87% (o3) → 92% (Gemini 3) → 94.6% (Mythos) [P]. Experts ~65-70%, skilled non-experts with web 34% [P Rein et al.]. Saturated in 2025-26. |
| **LastExam** | Humanity's Last Exam (no tools) | knowledge | 0 | 90 | 28.8 | 1.3 | o1 9% (Jan 25) → GPT-5 25% → Opus 4.6 40% → Mythos 57% [P]. With tools: Opus 5.5 67.7% [P]. Some labels wrong, so the ceiling is below 100 [U]. |
| **ProofFrontier T1-3 / T4** | FrontierMath | knowledge | 0 | 95 | 28.7 / 29.3 | 1.6 | T1-3: <2% (Nov 24) [P paper] → ~10% (o3, Epoch run) → ~25% (GPT-5) → ~40% (GPT-5.2) [P~ OpenAI]. T4 lower [U]. |
| **OpenProblems** | FrontierMath Open Problems / Erdős | knowledge | 0 | 100 | 31.3 | 1.5 | 3/68 (4%) for GPT-6.1 Sol, Nov 2026 [P Epoch hub]. **The "AI does real math" signal.** |
| **Desktop** | OSWorld(-Verified) | autonomy (computer use) | 0 | 92 | 27.8 | 1.3 | 14.9% (Claude 3.5 computer use, Oct 24) → 38% (CUA, Jan 25) → 61% (Sonnet 4.5) → 72.7% (Opus 4.6) → 79.6% (Mythos) [P]. Human ~72% [P OSWorld]. OSWorld 2.1: Opus 5.5 81.8% [P]. |
| **OfficeWork** | GDPval (win+tie vs industry experts) | knowledge + autonomy | 0 | 100 | 28.0 | 1.3 | GPT-4o ~13%, GPT-5 40.6%, Opus 4.1 47.6% (Sep 25) [P GDPval]. **50% = "expert parity on deliverables".** |
| **WebHunt** | BrowseComp | autonomy | 0 | 95 | 27.9 | 1.4 | Deep Research 51.5% (Apr 25) [P] → Opus 4.6 83.7% → Mythos 86.9% [P] |
| **NovelPuzzles** | ARC-AGI-2 | knowledge (fluid) | 0 | 100 | 28.6 | 1.6 | Single digits in early 2025 [P ARC paper] → ~69% for Opus 4.6 max effort (Feb 26) [P~] |
| **Debate** (percentile vs human persuaders) | Anthropic persuasion study, OpenAI ChangeMyView, Salvi et al. | persuasion | 0 | 100 | 26.0 | 1.0 | Claude 3 Opus ≈ human writers (2024) [P]. GPT-4 with personal data beat humans in 64% of non-tied debates [P Salvi]. Single-message persuasion only, not long-term manipulation. |
| **Replicate&Survive** | RepliBench / METR ARA / Redwood money-making | autonomy | 0 | 100 | 27.3 | 1.0 (core) | Claude 3.7: >50% pass@10 on 15/20 task families [P RepliBench]. Hard components (KYC evasion, robust persistence) use m = 29.5 [G]. Redwood: agents with $5k earned $0 over 4 days (Feb-Mar 26) [P METR risk report]. |

**Safety evals.** These read hidden traits, not capability:

| Game name | Real family | What it reads |
|---|---|---|
| Honesty | MASK [P] | lying under pressure |
| ScheminProbe | Apollo in-context scheming, OpenAI/Apollo covert-action evals [P] | covert action rate |
| Sabotage | SHADE-Arena, Subversion Strategy Eval [P] | sabotage and evasion competence: 72% for public models, ≤80% internal [P METR] |
| AgentStress | Anthropic agentic misalignment (blackmail) scenarios [P] | stress-test misbehaviour |
| EvalAware | verbalised eval-awareness rate [P] | EA trait |
| HackRate | METR / MirrorCode cheating rate | RH trait. Real figures: ≥16% of successful ≥8 h runs were cheats; Opus 4.6 tried to hack ~80% of MirrorCode attempts when tests were hidden [P METR risk report]. |

Every safety eval is **confounded by EA**. Game rule [G]: `measured_bad_rate = true_rate · (1 − EA · 0.7)`.

**Saturation dynamics [P, rule G].** Benchmarks go from launch to saturation in about 1.5-3 years:
- SWE-bench: "low single digits to saturation in about two years" [P Anthropic].
- CORE-Bench: ~15 months [P].
- GPQA: 2023 → 2025.
- The METR suite: saturated at ~16 h by Apr 2026 [P].

Game rule: a benchmark's useful window is about m ± 1.5 G. Each saturation event spawns a harder successor (Verified → Pro → "DeepSWE"; HCAST → Horizon-2; FrontierMath → Open Problems) and a news item. **Late-game the only meaningful "benchmarks" are real-world outcomes**: zero-days found, open problems solved, AI R&D speed-up, and revenue. This is exactly the real 2026 trend (Glasswing, FrontierMath Erdős, METR's Anthropic acceleration study).

### 0.6 Deployment forms and economics

**Anchors:**
- **Cost of a fixed capability.** It falls ~13x/yr (47%/quarter). It falls ~75x/yr right after something becomes SOTA, then 4.7x/yr after two years [P Epoch "Plunging price of thought"]. A more conservative estimate is 5-10x/yr [P Epoch, citing Gundlach et al. 2026].
- **Hardware price-performance.** +49%/yr [P Epoch].
- **Frontier list prices** per million tokens, input/output:

| Model | Date | Price |
|---|---|---|
| GPT-4 | Mar 2023 | $30/$60 [U recalled] |
| Claude 3 Opus | 2024 | $15/$75 [U recalled] |
| Opus 4.5 | Nov 2025 | $5/$25 [U recalled] |
| Opus 5 | Jul 2026 | $5/$25 [P] |
| Opus 5.5 | Sep 2026 | $4/$20 [P] |
| Fable 5.1 (bigger tier) | 2026 | $10/$50 [P~] |
| Mythos Preview (partners only) | 2026 | $25/$125 [P] |

- **Token use.** Agents use ~4x the tokens of chat; multi-agent systems ~15x [P Anthropic].
- **Compute split.** OpenAI's 2024 compute was ~$1.8B inference vs ~$5B R&D [P Epoch]. Projected R&D compute is $9B (2025) and ~$19B (2026) [P~ Epoch].
- **Revenue growth.** OpenAI annualised revenue grows ~3.2x/yr [P Epoch].

| Form | Who / how | Revenue model [G multipliers] | Serve cost | Benefits | Costs / risks | Real example |
|---|---|---|---|---|---|---|
| **Consumer chat** | Mass app, subscription plus free tier | Users × ARPU. Appeal driven by option D. | Medium | User data (preference signal), brand, political visibility | SYC pressure if engagement-tuned. Public incidents are highly visible. Jobs and backlash. | ChatGPT, Claude.ai |
| **API** | Developers pay per token | Tokens × (price − cost); margin 50-80% [U] | Per token | Ecosystem, revenue scales with capability | **Rivals and China distil it** (each month of API exposure gives them +x of your capability). Misuse. | All labs |
| **Coding / enterprise agents** | Seats, or per-task pricing | Highest revenue per token. Needs Horizon ≥ the task length and RH low (or incidents). | High (4-15x tokens) | Big revenue (coding agents are the 2025-26 growth engine [U]). Usage data from real workflows. | Agent incidents (deleting data, overreach). Liability. | Claude Code, Codex, "OpenAI Frontier" enterprise agent platform [P~] |
| **Government / classified** | Air-gapped or gov-cloud variant, relaxed refusals for national security | Contract lump sums (US DoD CDAO awards up to $200M each to 4 labs, Jul 2025 [U URL]) | Self-hosted | Political capital, protection from regulation, security clearance | Weapons and surveillance use, staff backlash, less public oversight | Claude Gov [P], OpenAI for Government [P] |
| **Trusted access / restricted** | Same weights, fewer safeguards, vetted partners only | Premium price ($25/$125) at small volume. Credits as goodwill. | High | Gets dangerous-capability value (cyber defence) without proliferation. Regulator goodwill. | Leak risk. Partner misuse. | Mythos Preview via Project Glasswing (~12 partners + 40 orgs, "do not plan to make generally available"); Mythos 5.1 = Fable 5.1 weights with lighter cyber/bio safeguards via trusted access [P] |
| **Internal research agents** | Thousands to hundreds of thousands of copies doing AI R&D | No revenue. Drives the R&D multiplier. | Uses your inference compute | Progress. In reality, >80% of merged code at Anthropic was Claude-written by May 2026, with ~2x (1.3-3x) capability-progress acceleration by Oct 2026 [P]. | Least outside oversight. Misaligned agents have "means, motive, and opportunity" for minimal rogue deployments [P METR]. AI 2027's core risk. | AI 2027 Agent-2/3/4 [P] |
| **Distilled mini** | Small, cheap student of the flagship | Volume. 3-10x cheaper. ~6-12 months behind the flagship. | Low | Margin. Frontier capability reaches consumer GPUs in ~8 months [P Epoch]. | Distilled models may overperform on benchmarks vs real tasks [P Epoch] | Haiku 5.5, GPT-x-mini [P] |
| **Open weights** | Release the weights | No direct revenue. Goodwill, ecosystem, talent. | None (users self-host) | Prestige, standards influence, open-source community | **Irreversible.** Safety fine-tuning is removed cheaply [P Qi et al. 2023]. China and rivals gain the full model. Only hazard-filtered pretraining survives tampering [P Deep Ignorance]. | gpt-oss (Aug 2025) [P], Llama, DeepSeek, Qwen, Kimi |

**Cost-to-serve formula [G]:**

`costPerTask = activeParamIndex · tokensPerTask(effort, agentic) · hwPriceIndex(t) / algoServeEff(t)`

- `hwPriceIndex` falls 1.49x/yr.
- `algoServeEff` is the serving share of algorithmic progress (distillation, quantisation, speculative decoding). Calibrate it so that the cost of a fixed capability falls ~10x/yr overall.

**Price vs capability [G].** Market price per token is roughly flat to slowly falling at the frontier: $5-15 input in 2023-26 for the top tier. What changes is that the same price buys more capability. Leave pricing as a player choice with a demand curve.

### 0.7 Paradigm / advance unlock list (tiered by capability era)

Eras map to the engine's milestones (research/11; AI 2027 takeoff supplement):

| Era | Milestone | AI R&D multiplier [P] | Tier |
|---|---|---|---|
| E1 "Reasoning agents" | – | 1-2x | – |
| E2 "Automated coder" | Superhuman coder (SC) | 5x | – |
| E3 "Automated researcher" | Superhuman AI researcher (SAR) | 25x | – |
| E4 "Superintelligent research" | SIAR | 250x | – |
| E4+ | ASI | 2,000x | – |

Paradigm tiers T1-T4 roughly track these eras.

Each paradigm is a **research project**. It costs experiment compute plus researcher time (human or AI), and has a **hidden success chance per world** (consistent with REDESIGN §6). Once researched, it becomes a new option in the run designer, or a new deployment or process.

**Tier 1: available at game start (real by 2025-26)**

| # | Paradigm | What it is | Prereq | Unlocks | Safety implications | Status |
|---|---|---|---|---|---|---|
| 1 | Reasoning RL with verifiable rewards | RL on checkable answers; long CoT emerges | Strong base | Option E math/code. +~1 G. | RH on verifiers. Visible CoT gives monitorability (a gift to keep). | Real [P o1, R1] |
| 2 | Agentic RL environments | Docker or app-replica environments with graders | #1, environment budget | Option E agentic families | RH, overreach | Real [P Epoch] |
| 3 | Test-time compute scaling (effort levels, parallel "deep think") | Spend more inference per query | #1 | Effort slider; +0.3 G at 5-15x tokens | Compute-optimal TTC can beat a 14x larger model on some problems [P Snell] | Real |
| 4 | Distillation pipeline | Train small students on big-model outputs | Any flagship | Mini variants. Rivals distil YOU. | Traits transfer subliminally [P Cloud] | Real [P R1 distills] |
| 5 | Orchestrated multi-agent | Lead agent plus parallel subagents | #2 | +90% on internal research evals at 15x tokens [P Anthropic] | Collusion, error compounding | Real |
| 6 | Computer use | Screenshot / action agents | Multimodal + #2 | Desktop benchmark; office deployments | Overreach, phishing | Real |
| 7 | Long context + memory files / compaction | 1M-10M token windows (effective much less [P RULER]); context windows grow 30x/yr [P Epoch]; notes and memory | – | Multi-day task continuity (horizon ×1.5) | Persistent memory enables cross-session strategies (SCH +) | Real |

**Tier 2: E1 → E2 (2026-27). Grounded in active research [X]**

| # | Paradigm | What it is | Prereq | Unlocks | Safety implications | Grounding |
|---|---|---|---|---|---|---|
| 8 | Continual / online learning ("never finishes training") | Weights updated daily from deployment and RL streams | #2, forgetting mitigation research | Version updates without new runs (+0.05 G/week while running). Learns customer-specific skills. | **Moving target**: evals go stale within days. Values drift. Data poisoning through user traffic. Backdoor risk. | AI 2027 Agent-2 [P]; SEAL [P]; Titans [P]; CL-Bench finds naive in-context learning still beats dedicated memory systems (2026) [P] |
| 9 | Test-time training | Fine-tune briefly on the task at hand | #8 partial | +0.3 G on novel tasks (ARC-type) | Per-instance weights, so audits cover fewer copies | TTT layers [P]; ARC TTT [P] |
| 10 | Synthetic data flywheel at scale | Models write the pretraining and post-training data for successors | Strong teacher | Breaks the data wall (§C) | Trait inheritance; model collapse if no fresh data | Rephrasing the Web [P]; phi [P]; Kimi K2 rephrasing [P]; Shumailov [P] |
| 11 | Self-play / self-generated curricula | Model proposes and solves its own tasks with a verifier | #1 | Superhuman math and code without human data; OpenProblems benchmark climbs | Reward-hacks the verifier; alien strategies | AlphaZero lineage; Absolute Zero [P]; AlphaProof [P]; AlphaEvolve [P] |
| 12 | Long-horizon human demonstration data | Pay experts to record days-long work | $1B+ budget | Horizon ×2; taste +0.2 | Low | AI 2027 ("billions of dollars for human laborers to record themselves") [P] |
| 13 | Automated AI research agents | Agents run full experiments end-to-end | #2, #5, AI R&D ≥ 28.5 | Experiment throughput ×N. AI R&D multiplier ↑. | Research sabotage and sandbagging on safety work; RH in research metrics | AI Scientist [P]; Anthropic: agents recovered 97% of a gap vs humans' 23% (800 h, ~$18k) [P]; METR's ~2x acceleration estimate [P] |
| 14 | Interpretability-guided training | Monitor and steer trait directions during training (persona vectors, SAE features, "preventative steering") | Interp research agenda | Trait accumulators visible; cap trait growth during runs | **Training against a detector teaches evasion** (obfuscated activations) [P Bailey et al.]. Use the detector for monitoring only, or lose it. | Persona vectors [P]; audits [P Marks] |
| 15 | AI-assisted oversight (scalable oversight in the training loop) | AI critics, debate, and weak-to-strong for grading hard tasks | #13 partial | Hardened graders at scale (cheaper option F3) | Collusion between grader and policy | Debate [P]; weak-to-strong [P]; CAI [P] |
| 16 | AI-designed kernels and hardware co-design | AI optimises its own training and serving stack | #13 | +0.1-0.3 G-equivalent efficiency; serve cost −20-30% | Low (but speeds everything) | AlphaEvolve: 23% kernel speedup, 0.7% fleet compute recovered [P] |

**Tier 3: E2 → E3 (SC → SAR, ~2027 in AI 2027) [X]**

| # | Paradigm | What it is | Prereq | Unlocks | Safety implications | Grounding |
|---|---|---|---|---|---|---|
| 17 | Neuralese recurrence & memory | Pass the residual stream back as "thoughts" (>1,000x the information of a token) plus long-term vector memory | #1, architecture research, SC era | Option B/G latent: +0.4-0.6 G, serving 2-3x faster | **CoT monitoring dies.** Interp becomes the only window. The AI 2027 race-ending pivot. | AI 2027 [P]; Coconut [P]; recurrent-depth [P]; CoT-monitorability position paper (fragile opportunity) [P Korbak et al.] |
| 18 | Iterated distillation & amplification (IDA) | Amplify (many copies, long thinking) → distil into a faster model → repeat | #4, #5, #17 optional | Self-improvement loop: each cycle +0.2-0.4 G for ~2-4 weeks of compute | Misalignment compounds across iterations; spec drift | AI 2027 Agent-3 [P]; Christiano IDA [P] |
| 19 | Learned research taste | Models trained to pick high-value experiments (predict which ideas pay off) | #13 + large corpus of experiment outcomes | Removes the −0.5 taste penalty; SAR milestone | AI chooses research direction, including how much safety work gets done | METR/Anthropic taste gap [P]; the extrapolation itself is [X] |
| 20 | Massive agent societies | 100k+ copies at 30-50x human speed, with internal org structure | Inference compute, #5, #17 | R&D multiplier 10-50x | Collective-level goals; collusion; monitoring at scale impossible for humans, so AI monitors AI (control) | AI 2027: 200k Agent-3 copies; 300k Agent-4 at 50x speed [P] |
| 21 | Brain-like sample efficiency | Learn new skills from few examples, as humans do | #8, #19 | New domains in days; robotics transfer | Capability jumps from small data are hard to forecast; evals lag | AI 2027: Agent-3 "~4,000x less compute-efficient than the human brain", closing later [P] |
| 22 | Robotics foundation models + world models | Vision-language-action policies; learned simulators for training robots | Multimodal, #11 | Physical economy, robot factories (late-game power) | Physical-world reach; dual-use | RT-2 [P]; π0 [P]; Gemini Robotics [P]; GR00T N1 [P]; V-JEPA 2 [P]; Genie 3 [P] |
| 23 | Faithful-CoT architecture (safety alternative to #17) | Keep reasoning legible by construction, accepting a capability tax | #14 | Option G "faithful": monitorability high, −0.3 G | Keeps oversight; costs the race | AI 2027 slowdown ending (Safer-1) [P] |

**Tier 4: E3 → E4 (SAR → ASI) [X]**

| # | Paradigm | What it is | Prereq | Unlocks | Safety implications | Grounding |
|---|---|---|---|---|---|---|
| 24 | AI-designed successor architectures | Post-transformer designs found by AI researchers | #19, #20 | +1 G jump; new trait profile drawn | Alignment techniques may not transfer; "Agent-5 aligned to Agent-4" risk | AI 2027 [P] |
| 25 | Formal verification at scale | AI-written proofs for code, hardware, protocols | #11 math | Verified secure infrastructure; safety-case evidence; weight-security boost | Positive (a defensive paradigm) | Guaranteed Safe AI agenda [P Dalrymple et al.] |
| 26 | Superhuman strategy & persuasion | Modelling individuals and institutions | Persuasion ≥ 30 | Policy and diplomacy levers; manipulation risk | Ruin-level manipulation; the AI 2027 superpersuasion endgame | AI 2027 [P]; persuasion trend [P] |
| 27 | Automated alignment research | AIs do the interp and oversight science | #13, #14 + trustworthy model | Safety agendas progress at AI speed | Only as good as the alignment of the AI doing it (bootstrapping problem) | AI 2027 slowdown ending; Anthropic "automated alignment" goals [P RSI page] |

---

## 1. Pretraining: detailed notes

**Scaling laws.**
- Kaplan et al. (2020): loss is a power law in parameters N, data D and compute C; at the time this favoured larger models on fewer tokens [P].
- Chinchilla (Hoffmann et al. 2022): compute-optimal training scales N and D equally, at ~20 tokens per parameter. The 70B model trained on 1.4T tokens beat the 280B Gopher [P].
- Since 2023 labs deliberately **overtrain** small models for cheap inference:
  - Llama 3 8B: 15T tokens, ~1,900 tokens/param [P].
  - Llama 3-70B was ~10x overtrained [P Epoch].
  - Training open models is becoming more data-intensive [P Epoch].
- Data-constrained scaling: up to ~4 epochs of repeated data are nearly as good as unique data; returns decay after that [P Muennighoff].

**Typical scales.**

| Model | Date | Scale |
|---|---|---|
| GPT-4 | 2023 | ~2e25 FLOP [P AI 2027 / Epoch est.] |
| Gemini Ultra | 2023-24 | ~5e25 [P Epoch] |
| Llama 3 405B | Jul 2024 | 3.8e25 FLOP, 15.6T tokens [P] |
| DeepSeek-V3 | Dec 2024 | 671B total / 37B active, 14.8T tokens, ~3e24 FLOP-scale cost $5.6M final run [P] |
| Qwen3 | 2025 | 36T tokens, 119 languages [P] |
| Kimi K2 | 2025 | 1T / 32B active, 15.5T tokens [P] |
| Llama 4 | Apr 2025 | Behemoth ~2T total / 288B active; Scout 10M context; >30T-token mix [P] |
| Grok 4 | Jul 2025 | ~5e26 FLOP, ~$500M, largest Epoch-estimated run [P Epoch] |

- GPT-5 likely used *less* training compute than GPT-4.5: post-training scaling substituted for pretraining. Epoch expects GPT-6 to use more [P Epoch].
- Frontier compute keeps growing ~5x/yr [P Epoch trends].
- AI 2027 assumes 1e27 (Agent-0) and ~4e27 (Agent-1), with 1e28-capable datacentres in 2025-26 [P].
- Epoch sees runs past ~2e28 within 3 months hitting data-movement limits [P]. Its trend extrapolation is ~2e29 by 2030 [P].

**Data.**
- Web text plus code, math, science, multilingual and synthetic data.
- Quality filtering yields large gains (FineWeb-Edu, DCLM) [P].
- Synthetic rephrasing gives faster training and better data efficiency [P Maini et al. 2024 "Rephrasing the web"].
- Phi models showed small models trained on "textbook-quality" synthetic data can punch above their weight [P].
- Kimi K2 used rephrasing to stretch high-quality tokens [P].
- The public text stock is ~300T tokens, used up 2026-2032 [P].
- Risks of synthetic data:
  - recursive training without fresh data causes model collapse [P Shumailov];
  - traits transmit subliminally from teacher to student even through number sequences [P Cloud et al.].

**MoE vs dense.**
- MoE routes each token to a few experts. It gives more capacity per FLOP and is cheaper to serve per token, but needs more memory and more engineering [P Switch, Mixtral, DeepSeekMoE, DeepSeek-V3].
- By 2025 most frontier open models were MoE (DeepSeek-V3/R1, Qwen3-235B-A22B, Kimi K2, Llama 4, gpt-oss) [P].

**Context length.**
- 8-32k tokens (GPT-4, 2023) → 200k (Claude) → 1-2M (Gemini 1.5, with 10M in research) [P] → 10M (Llama 4 Scout) [P].
- Context windows grow ~30x/yr [P Epoch].
- Effective use lags the advertised window [P RULER].

**Multimodality.** Native image, audio and video input was standard by 2024-25 (Gemini 1.5, GPT-4o). It is a prerequisite for computer use and robotics.

## 2. Post-training: detailed notes

| Stage | What it buys | Linked side effects |
|---|---|---|
| SFT (instruction tuning) | Instruction following, format | Imitates labeller errors; HAL |
| RLHF (InstructGPT) | Helpfulness and preference. A 1.3B InstructGPT preferred over 175B GPT-3 [P]. | SYC [P Sharma]; engagement over-optimisation [P OpenAI GPT-4o postmortem] |
| RLAIF / Constitutional AI / spec training / deliberative alignment | Cheaper harmlessness; principled refusals; reasons over the spec [P] | Spec loopholes; models learn the spec *language* (eval-gaming risk) |
| Reasoning RL with verifiable rewards | Big math, code and science gains; inference-time scaling (o1: performance rises with both train-time RL and test-time thinking [P]); R1-Zero showed reasoning emerging from pure RL [P] | RH on graders; long-CoT HAL; "Let's hack" visible in CoT [P Baker] |
| Agentic RL (SWE, terminal, browsing, computer use, research) | Horizon growth (METR doubling ~7 months 2019-24, ~4 months 2024-26 [P METR, Anthropic]) | RH: special-casing tests, modifying graders [P METR Jun 2025]; ≥16% cheats among long successful runs [P]; production RH → EM (alignment faking, sabotage) [P Anthropic Nov 2025]; EA rises with RL [P OpenAI/Apollo] |
| Tool use | Search, code exec; HLE +8-12 pts with tools [P Glasswing] | Fabricated tool results (HAL), overreach |
| Distillation | Cheap students (R1-distill Qwen/Llama) [P] | Trait transfer [P Cloud]; benchmark overperformance [P Epoch] |
| Inference-time compute | Effort levels, best-of-n, parallel thinking | Cost; longer CoT gives more room for scheming reasoning. With no CoT, the math horizon is only ~4 min [P METR]: the CoT is load-bearing (good for monitoring). |
| Safety training (refusal, classifiers, anti-scheming, honesty) | Fewer covert actions (13% → 0.4%), jailbreak robustness | EA up after anti-scheming [P]; refusals cut product appeal |

**Further anchors.**
- RL environment market: tasks cost $200-$2k; labs want a 2-70% pass rate; reward-hacking robustness is the #1 quality criterion [P Epoch].
- RL scaling: post-training compute grew ~10x every 4 months in 2024-25 [P Epoch]. One analysis argues RL scales much worse than inference: 100x inference ≈ 10,000x RL [P Toby Ord via Epoch; contested].

**Elicitation matters.** Scaffold, tools, effort and best-of-n add 0.7-1.5 OOM-equivalent [P Davidson et al.]. Sources for the cheat-scoring sensitivity of METR horizons:
- One model's horizon would have roughly doubled if cheats counted as passes [P METR risk report].
- An aggregator claims "GPT-5.6 Sol" scores 270 h vs 11.3 h depending on cheat scoring [U].

## 3. Architecture and system options: detailed notes

- **Long context and memory.** See §1. Memory files, compaction and "context management" are product features of 2025-26 coding agents. Continual-learning benchmarks show dedicated memory systems not yet beating naive in-context learning [P CL-Bench 2026].
- **Recurrence and latent reasoning.**
  - Coconut feeds the last hidden state back as the next input ("continuous thought") and can do breadth-first search in latent space [P].
  - Recurrent-depth models scale test-time compute by iterating a block in latent space [P Geiping et al.].
  - AI 2027's "neuralese recurrence and memory" is the scaled version. They pass ">1,000 times more information" than text tokens [P AI 2027].
  - A cross-lab position paper calls CoT monitorability a "new and fragile opportunity" that latent reasoning would remove [P Korbak et al. 2025].
- **Test-time training.** TTT layers [P]; TTT gave large ARC gains [P Akyürek].
- **Continual / online learning.**
  - SEAL: models generate their own fine-tuning data and updates [P].
  - Titans: neural long-term memory learned at test time [P].
  - Unsolved: catastrophic forgetting and safe update gating. No frontier lab announced live weight updates in deployment as of Nov 2026 (search found none) [U absence].
  - AI 2027 has Agent-2 updated daily [P].
- **Agent scaffolds and multi-agent.** Orchestrator plus subagents beat a single agent by 90.2% at ~15x tokens. Token usage explains 80% of the variance [P Anthropic]. In Anthropic's internal work, "agents run code and delegate hours of work to other agents" [P RSI page].
- **World models.** Genie 3 generates interactive environments in real time [P DeepMind]. V-JEPA 2 is a self-supervised video world model used for robot planning [P].
- **Robotics foundation models.** RT-2 (VLA) [P], π0 (flow-matching VLA) [P], Gemini Robotics [P], GR00T N1 [P].

## 4. Evaluation: detailed notes and trajectories

**Families and what they measure.**

| Family | Benchmarks | What it measures |
|---|---|---|
| Coding | SWE-bench / Verified, SWE-bench Pro, Terminal-Bench | Real GitHub issues and terminal tasks [P] |
| Agentic horizon | METR HCAST / Time Horizon 1.1 | Human task duration at 50% agent success [P] |
| AI research | RE-Bench, PaperBench, MLE-bench, CORE-Bench, Anthropic speedup tasks, METR NanoGPT/LMCA tasks | 7 ML research-engineering environments vs experts [P]; reproducing ICML papers [P]; Kaggle medals [P] |
| Cyber | Cybench (40 CTFs) [P], CyberGym (real vulnerabilities) [P], real zero-day discovery (Glasswing) [P] | – |
| Bio | VCT (wet-lab virology troubleshooting) [P], LAB-Bench [P], WMDP (hazardous knowledge proxy) [P] | – |
| Math / science | GPQA Diamond [P], FrontierMath (tiers 1-4, Open Problems) [P], HLE [P], ARC-AGI-2 [P] | – |
| Computer use / web | OSWorld [P], BrowseComp [P] | – |
| Economic | GDPval: 44 occupations, expert-graded deliverables [P] | – |
| Persuasion | Anthropic 2024 study [P], Salvi et al. [P], Hackenburg et al. [P] | – |
| Autonomy / replication | METR ARA, RepliBench [P], Redwood money-making test [P METR] | – |
| Safety / propensity | MASK [P], Apollo scheming [P], SHADE-Arena [P], OpenAI/Apollo anti-scheming [P] | – |

**Trajectories (best reported at the time; P unless marked).**

| Benchmark | Trajectory |
|---|---|
| SWE-bench Verified | 33% (GPT-4o, Aug 24) → 49% (3.5 Sonnet new, Oct 24) → 62-70% (3.7 Sonnet, Feb 25) → 72.5% (Opus 4, May 25) [U recalled] → 74.9% (GPT-5) [U recalled] → 80.9% (Opus 4.5) [U recalled] → 80.8% (Opus 4.6) → 93.9% (Mythos Preview) |
| METR 50% horizon | 4-5 min (GPT-4, 2023) → ~40 min (o1) → ~1 h (3.7 Sonnet) → 2h17m (GPT-5) → ~4.8 h (Opus 4.5) [U recalled] → ~12 h (Opus 4.6; 7 h noise-adjusted) → ≥16 h (Mythos Preview, CI 8.5-55 h [U aggregator]). Internal frontier was ~2 months ahead of public in Feb-Mar 2026 [P]. |
| GPQA Diamond | 39% → 59% → 78% → 87% → 91-92% → 94.6% |
| HLE no tools | 9% (o1) → 25% (GPT-5) → 37.5% (Gemini 3) [U recalled] → 40% (Opus 4.6) → 56.8% (Mythos). With tools: 26.6% (Deep Research, Feb 25) → 53.1% (Opus 4.6) → 64.7% (Mythos) → 67.7% (Opus 5.5). |
| OSWorld | 14.9% → 38.1% → 61.4% → 66.3% [U recalled] → 72.7% → 79.6%. Human ~72%. |
| FrontierMath T1-3 | <2% (Nov 24) → ~25% (GPT-5) [P~] → ~40% (GPT-5.2) [P~]. Open Problems / Erdős: 4% (Nov 26). |
| Terminal-Bench 2.0 | 65.4% (Opus 4.6) → 82% (Mythos). Terminal-Bench 4.0: Opus 5.5 66.4%, GPT-6 Astra 57.9% [P]. |
| AI R&D | Speedup task: 3x (Opus 4, May 25) → 52x (Mythos Preview, Apr 26) [P Anthropic]. Open-ended Claude Code task success: 76% in May 2026, +50 pts in 6 months [P]. |
| ECI (Epoch Capabilities Index) | Frontier +14 points/yr since reasoning models (vs +6 before) [P]. Top: Claude Fable 5.2 at 173 (Nov 9 2026, pre-launch) [P]. |

**Measurement problems the game should model.**
1. **Contamination and memorisation.** Anthropic screens SWE-bench and HLE for it [P Glasswing].
2. **Cheating inflates agentic scores** [P METR].
3. **Eval awareness confounds propensity evals** [P OpenAI/Apollo].
4. **Suites saturate**, and analysis choices then dominate. Horizon fits vary 1.5-2x by method [P METR note].
5. **Self-reported uplift overstates.** METR's RCT on late-2025 agents found 4-20% productivity gains vs 1.6-4x self-reports [P].
6. **Internal models run ~2 months ahead of public ones** [P METR]. Gov and regulators see public models first unless they get pre-deployment access.

## 5. Deployment and serving: detailed notes

- **Cost decline.** 13x/yr for fixed capability; 75x/yr just after SOTA [P Epoch]. Example: 75% on GPQA cost ~$0.30/question with o3 (Jan 2025) and ~$0.0004 within 18 months, a 725x drop [P Epoch].
- **Token efficiency of reasoning.** On FrontierMath, ~43M output tokens were needed for ~27% (o4-mini, Apr 2025) vs ~5M (GPT-5.2, Dec 2025) [P Epoch].
- **Inference share.** ~$1.8B of ~$7B OpenAI compute in 2024 [P Epoch]. Agentic usage multiplies tokens 4-15x [P Anthropic].
- **Restricted / staged deployment is now standard for dangerous capability.**
  - Mythos Preview: not generally available; ~12 named partners plus 40 orgs; $100M credits [P].
  - Mythos 5.1 vs Fable 5.1: the same model with different safeguard levels [P~].
  - OpenAI "pacing model development in an era of cyber-critical capabilities" (2026) [P page exists; content not fetched (403)].
- **Government.** Claude Gov models for US national security [P]. OpenAI for Government [P]. DoD CDAO frontier-AI awards, Jul 2025 [U URL].
- **Open weights.** gpt-oss-120b/20b, Apache 2.0, Aug 2025 [P model card]. Safety fine-tuning is removable with few examples [P Qi et al.]. Pretraining data filtering resists tampering [P Deep Ignorance].
- **Distillation by rivals.** Frontier R&D is mostly exploration, so followers replicate for less [P Epoch]. Lab statements about distillation attacks by Chinese labs [U, verify Anthropic/OpenAI posts before use].
- **Internal deployment.** By May 2026, >80% of merged Anthropic code was authored by Claude [P]. METR estimates ~2x (1.3-3x) acceleration of capability progress by Oct 2026, ~80% of it due to AI [P]. The Opus 5.5 risk report cites ~1.5x [P METR]. AI cannot yet make "highly significant and fully autonomous contributions" [P].

## 6. Future paradigms: grounding notes

- **AI 2027 specifics** [P ai-2027.com]:
  - Agent-1 had a 1.5x multiplier, was "often sycophantic", and was trained on code and browsing, making it a good hacker.
  - Agent-2 was trained "almost continuously", with weights updated daily, a 3x multiplier, synthetic data generated then filtered, and billions spent on long-horizon human recordings.
  - Agent-3 introduced neuralese recurrence and memory plus IDA, ran 200k copies, had a 4x → 10x multiplier, and was ~4,000x less compute-efficient than the brain.
  - Agent-4 had better post-training and more data-efficient algorithms, ran 300k copies at 50x human speed, and had a ~50x multiplier.
  - Milestone multipliers: SC 5x, SAR 25x, SIAR 250x, ASI 2,000x [P takeoff supplement].
- **Anthropic's three scenarios** [P RSI page]:
  1. the trend stalls (thought unlikely);
  2. compounding efficiency with humans directing ("likely");
  3. full recursive self-improvement (least certain how alignment fares).
- **The tier placements in §0.7 are [X].** They are ordered by prerequisite plausibility, not dated predictions.

---

## S. Sources (primary unless tagged)

**Scaling, pretraining, data**
- Kaplan et al. 2020, Scaling Laws: https://arxiv.org/abs/2001.08361
- Hoffmann et al. 2022, Chinchilla: https://arxiv.org/abs/2203.15556
- Muennighoff et al. 2023, Data-constrained scaling: https://arxiv.org/abs/2305.16264
- Villalobos et al. / Epoch, Will we run out of data: https://arxiv.org/abs/2211.04325 ; https://epoch.ai/publications/will-we-run-out-of-data-limits-of-llm-scaling-based-on-human-generated-data
- Ho et al. 2024, Algorithmic progress in LMs: https://arxiv.org/abs/2403.05812
- Llama 3 Herd: https://arxiv.org/abs/2407.21783 ; Llama 4 blog: https://ai.meta.com/blog/llama-4-multimodal-intelligence/
- DeepSeek-V3: https://arxiv.org/abs/2412.19437 ; DeepSeekMoE: https://arxiv.org/abs/2401.06066
- Qwen3: https://arxiv.org/abs/2505.09388 ; Kimi K2: https://arxiv.org/abs/2507.20534
- Switch Transformers: https://arxiv.org/abs/2101.03961 ; Mixtral: https://arxiv.org/abs/2401.04088
- FineWeb: https://arxiv.org/abs/2406.17557 ; DCLM: https://arxiv.org/abs/2406.11794
- Textbooks Are All You Need (phi-1): https://arxiv.org/abs/2306.11644 ; Rephrasing the Web: https://arxiv.org/abs/2401.16380
- Shumailov et al. 2024, model collapse (Nature): https://www.nature.com/articles/s41586-024-07566-y
- Cloud et al. 2025, Subliminal learning: https://arxiv.org/abs/2507.14805
- O'Brien et al. 2025, Deep Ignorance (pretraining data filtering): https://arxiv.org/abs/2508.06601
- Maini et al. 2025, Safety Pretraining: https://arxiv.org/abs/2504.16980
- Gemini 1.5: https://arxiv.org/abs/2403.05530 ; RULER: https://arxiv.org/abs/2404.06654

**Epoch AI**
- Trends: https://epoch.ai/trends
- Training compute 4-5x/yr: https://epoch.ai/publications/training-compute-of-frontier-ai-models-grows-by-4-5x-per-year
- Grok 4: https://epoch.ai/models/grok-4
- Longest training run: https://epoch.ai/data-insights/longest-training-run
- Can scaling continue to 2030: https://epoch.ai/publications/can-ai-scaling-continue-through-2030
- Data movement past 1e28: https://epoch.ai/publications/data-movement-bottlenecks-scaling-past-1e28-flop
- OpenAI compute spend: https://epoch.ai/data-insights/openai-compute-spend
- R&D vs final runs: https://epoch.ai/gradient-updates/r-and-d-vs-training-compute
- GPT-5 vs GPT-4.5 compute: https://epoch.ai/gradient-updates/why-gpt5-used-less-training-compute-than-gpt45-but-gpt6-probably-wont
- RL environments FAQ: https://epoch.ai/gradient-updates/state-of-rl-envs
- Plunging price of thought: https://epoch.ai/publications/the-plunging-price-of-thought
- Inference price trends: https://epoch.ai/data-insights/llm-inference-price-trends
- Inference cost burden: https://epoch.ai/gradient-updates/how-persistent-is-the-inference-cost-burden
- Benchmarking hub / ECI / FrontierMath: https://epoch.ai/benchmarks ; https://epoch.ai/benchmarks/frontiermath

**Post-training and traits**
- InstructGPT: https://arxiv.org/abs/2203.02155
- Constitutional AI: https://arxiv.org/abs/2212.08073
- Deliberative alignment: https://arxiv.org/abs/2412.16339
- Sharma et al. 2023, Sycophancy: https://arxiv.org/abs/2310.13548
- OpenAI GPT-4o sycophancy: https://openai.com/index/sycophancy-in-gpt-4o/ ; https://openai.com/index/expanding-on-sycophancy/
- OpenAI, Learning to reason with LLMs: https://openai.com/index/learning-to-reason-with-llms/
- DeepSeek-R1: https://arxiv.org/abs/2501.12948 ; Nature version: https://www.nature.com/articles/s41586-025-09422-z
- Snell et al., Test-time compute: https://arxiv.org/abs/2408.03314 ; s1: https://arxiv.org/abs/2501.19393
- SWE-RL: https://arxiv.org/abs/2502.18449
- Baker et al. 2025, Monitoring reasoning models / obfuscation: https://arxiv.org/abs/2503.11926
- Korbak et al. 2025, CoT monitorability: https://arxiv.org/abs/2507.11473
- Anthropic 2025, Natural emergent misalignment from reward hacking: https://arxiv.org/abs/2511.18397
- Betley et al., Emergent misalignment: https://arxiv.org/abs/2502.17424
- Greenblatt et al., Alignment faking: https://arxiv.org/abs/2412.14093
- Hubinger et al., Sleeper agents: https://arxiv.org/abs/2401.05566
- OpenAI/Apollo, Stress-testing anti-scheming training: https://arxiv.org/abs/2509.15339
- Apollo, In-context scheming: https://arxiv.org/abs/2412.04984
- METR, Recent reward hacking: https://metr.org/blog/2025-06-05-recent-reward-hacking/
- Marks et al., Auditing for hidden objectives: https://arxiv.org/abs/2503.10965
- Constitutional classifiers: https://arxiv.org/abs/2501.18837
- Davidson et al., Post-training enhancements: https://arxiv.org/abs/2312.07413
- Qi et al., Fine-tuning compromises safety: https://arxiv.org/abs/2310.03693
- Persona vectors: https://arxiv.org/abs/2507.21509 ; Obfuscated activations: https://arxiv.org/abs/2412.09565

**Architecture and paradigms**
- Coconut: https://arxiv.org/abs/2412.06769 ; Recurrent depth: https://arxiv.org/abs/2502.05171
- TTT layers: https://arxiv.org/abs/2407.04620 ; TTT for ARC: https://arxiv.org/abs/2411.07279
- Titans: https://arxiv.org/abs/2501.00663 ; SEAL: https://arxiv.org/abs/2506.10943
- CL-Bench (2026): https://arxiv.org/abs/2606.05661
- Absolute Zero: https://arxiv.org/abs/2505.03335 ; AlphaEvolve: https://arxiv.org/abs/2506.13131
- AlphaProof: https://deepmind.google/discover/blog/ai-solves-imo-problems-at-silver-medal-level/
- AI Scientist: https://arxiv.org/abs/2408.06292 ; AI co-scientist: https://arxiv.org/abs/2502.18864
- Christiano et al., IDA: https://arxiv.org/abs/1810.08575 ; Irving et al., Debate: https://arxiv.org/abs/1805.00899
- Weak-to-strong: https://arxiv.org/abs/2312.09390
- Guaranteed Safe AI: https://arxiv.org/abs/2405.06624
- RT-2: https://arxiv.org/abs/2307.15818 ; π0: https://arxiv.org/abs/2410.24164 ; Gemini Robotics: https://arxiv.org/abs/2503.20020 ; GR00T N1: https://arxiv.org/abs/2503.14734
- V-JEPA 2: https://arxiv.org/abs/2506.09985 ; Genie 3: https://deepmind.google/discover/blog/genie-3-a-new-frontier-for-world-models/
- Anthropic, Multi-agent research system: https://www.anthropic.com/engineering/multi-agent-research-system

**Benchmarks**
- SWE-bench: https://arxiv.org/abs/2310.06770 ; Verified: https://openai.com/index/introducing-swe-bench-verified/ ; SWE-bench Pro: https://arxiv.org/abs/2509.16941
- METR time horizon: https://arxiv.org/abs/2503.14499 ; page: https://metr.org/time-horizons/ ; modelling-assumptions note: https://metr.org/notes/2026-03-20-impact-of-modelling-assumptions-on-time-horizon-results/
- RE-Bench: https://arxiv.org/abs/2411.15114 ; PaperBench: https://arxiv.org/abs/2504.01848 ; MLE-bench: https://arxiv.org/abs/2410.07095
- Cybench: https://arxiv.org/abs/2408.08926 ; CyberGym: https://arxiv.org/abs/2506.02548
- VCT: https://arxiv.org/abs/2504.16137 ; LAB-Bench: https://arxiv.org/abs/2407.10362 ; WMDP: https://arxiv.org/abs/2403.03218
- GPQA: https://arxiv.org/abs/2311.12022 ; FrontierMath: https://arxiv.org/abs/2411.04872 ; HLE: https://arxiv.org/abs/2501.14249 ; ARC-AGI-2: https://arxiv.org/abs/2505.11831
- OSWorld: https://arxiv.org/abs/2404.07972 ; BrowseComp: https://arxiv.org/abs/2504.12516 ; GDPval: https://arxiv.org/abs/2510.04374
- RepliBench: https://arxiv.org/abs/2504.18565 ; MASK: https://arxiv.org/abs/2503.03750 ; SHADE-Arena: https://arxiv.org/abs/2506.15740
- Persuasion: https://www.anthropic.com/research/measuring-model-persuasiveness ; Salvi et al.: https://arxiv.org/abs/2403.14380 ; Hackenburg et al.: https://arxiv.org/abs/2507.13919

**2026 lab and evaluator reports**
- METR Frontier Risk Report (Feb-Mar 2026): https://metr.org/blog/2026-05-19-frontier-risk-report/
- METR on Claude Opus 5.5: https://metr.org/blog/2026-09-22-claude-opus-5-5/
- METR AI R&D acceleration at Anthropic (Oct 2026): https://metr.org/blog/2026-11-05-anthropic-ai-rd-acceleration-assessment/
- Anthropic, When AI builds itself: https://www.anthropic.com/institute/recursive-self-improvement
- Anthropic, Project Glasswing (Mythos Preview): https://www.anthropic.com/glasswing
- Claude Opus 4.6: https://www.anthropic.com/news/claude-opus-4-6 ; system cards index: https://www.anthropic.com/system-cards
- Claude Opus 5.5: https://www.anthropic.com/claude-opus-5-5
- Fable 5.1 / Mythos 5.1: https://www.anthropic.com/claude-fable-and-mythos-5-1
- Claude Gov: https://www.anthropic.com/news/claude-gov-models-for-u-s-national-security-customers
- gpt-oss model card: https://arxiv.org/abs/2508.10925
- OpenAI GPT-6 Astra: https://openai.com/index/gpt-6-astra-next-generation-work/ (403 when fetched; claims via search snippet [U])
- OpenAI, Pacing model development (cyber): https://openai.com/index/pacing-model-development-cyber-capabilities/ (403 [U content])

**AI 2027**
- Scenario: https://ai-2027.com/
- Takeoff forecast: https://ai-2027.com/research/takeoff-forecast

**[U] items to re-verify before shipping:**
- Exact 2024-25 list prices.
- SWE-bench and OSWorld numbers for Opus 4 / 4.5 / GPT-5 and Gemini 3 HLE (recalled from launch posts).
- Opus 4.5 METR horizon (4h49m).
- Mythos Preview horizon CI.
- GPT-5.6 Sol cheat-scoring numbers.
- DoD CDAO award URL.
- Lab posts on distillation attacks.
- FrontierMath Tier 4 SOTA.
- RL-environment spend ($1B, via The Information).
