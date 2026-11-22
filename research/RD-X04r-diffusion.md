# RD-X04r — Knowledge diffusion between labs: primary-source numbers and a rule

Research for DD-17 / RD-X04 (MEA-14, MEA-15). Written 2026-11-23. Research only; no code.

Tags: **[P]** primary (paper, official report, lab post, Epoch dataset or insight), fetched this pass.
**[P-r]** primary, already in this repo's research files (cited there). **[D]** design inference by me from [P] numbers.
**[X]** press only, or not verifiable from a primary text; not used for sizing.

What the repo already had (not repeated in depth): R1 distill ratios and Busbridge distillation scaling
laws (research/20 §C4); RAND OC1–OC5 and AI 2027 WSL/SSL (research/02 §1); IFP gap and the Anthropic
distillation counts (research/10). This file adds the Epoch lag series, UK AISI, the IFP functional
form, catch-up events, and the staff and publication evidence. It also turns them into one rule.

---

## 1. Summary table

| # | Quantity | Value | Unit | Date | Source | Tag |
|---|---|---|---|---|---|---|
| L1 | Open-weight lag behind closed SOTA, ECI | 3.5 (90% CI 1.1–5.3); ≈7 ECI pts | months | Jan 2023–Oct 2025 | Emberson, "Open-weight vs closed-weight models", Epoch AI Data Insight, 30 Oct 2025. https://epoch.ai/data-insights/open-weights-vs-closed-weights-models | [P] |
| L2 | Open-weight lag, ECI | 4 avg; 8 ECI pts (≈ GPT-5 → GPT-5.5) | months | Jan–May 2026 | Edwards & Emberson, "Open models lag state-of-the-art closed models by 4 months", Epoch AI, 29 May 2026. https://epoch.ai/data-insights/open-closed-eci-gap | [P] |
| L3 | Open vs closed, benchmarks | mean ≈13, 90% CI 5–22 (GPQA 5, MMLU 25) | months | Nov 2024 | Cottier, You, Martemianova, Owen, "How far behind are open models?", Epoch AI, 4 Nov 2024. https://epoch.ai/publications/open-models-report | [P] |
| L4 | Open vs closed, training compute | 15 (90% CI 6–22); top-1 open and closed both scale 4.6×/yr | months | Nov 2024 | same as L3 | [P] |
| L5 | Consumer-GPU open models (≤28–40B) behind frontier | GPQA 7.4, MMLU-Pro 7.3, AA index 6.3, LMArena 12.4 | months | Aug 2025 | Somala & Emberson, "Frontier AI performance becomes accessible on consumer hardware within a year", Epoch AI, 15 Aug 2025. https://epoch.ai/data-insights/consumer-gpu-model-gap | [P] |
| L6 | Chinese models behind the US frontier, ECI | 7 avg (min 4, max 14) | months | 2023–Jan 2026 | Emberson, "US vs China ECI", Epoch AI, 2 Jan 2026. https://epoch.ai/data-insights/us-vs-china-eci | [P] |
| L7 | Open-weight lag, cyber | 4–7 (was 6–10 in Jan–Sep 2025); GLM-5.2 = Opus 4.6 +4 mo; DeepSeek V4-Pro = Opus 4.5 +5 mo | months | 2026 | UK AISI, "How far behind the frontier are leading open-weight models on cyber?" https://aisi.gov.uk/blog/how-far-behind-the-frontier-are-leading-open-weight-models-on-cyber | [P] |
| L8 | US lead over China, ECI and time horizons | 6.5 (ECI), 6.6 (horizons) | months | 19 Oct 2026 | Fist, Adamson, Pilz, "How to Increase America's AI Lead Over China", IFP. https://ifp.org/how-to-increase-americas-ai-lead-over-china/ | [P] (think-tank model on Epoch data) |
| L9 | DeepSeek V4 Pro behind the US frontier | ≈8 | months | May 2026 | NIST CAISI evaluation of DeepSeek V4 Pro. https://www.nist.gov/news-events/news/2026/05/caisi-evaluation-deepseek-v4-pro | [P-r] (research/10) |
| C1 | Catch-up time, single events | o1 → several labs "within months", some at several× less compute. AlphaFold2 → RoseTTAFold ≈7 mo (TM 80.3 vs 90.2, 1.4e21 vs 3e21 FLOP). DeepSeek-V2 reaches GPT-4 after ≈14 mo | months | 2026 essay | Ho, "Keeping up with the GPTs", Epoch Gradient Updates, 7 Apr 2026. https://epoch.ai/gradient-updates/keeping-up-with-the-gpts/ ; L1 for DeepSeek-V2 | [P] |
| C2 | Reasoning-model replication: o1-preview (12 Sep 2024) → DeepSeek-R1 (20 Jan 2025) | ≈4.3 | months | 2024–25 | OpenAI o1 post; DeepSeek-R1 paper arXiv 2501.12948 (release dates) | [P-r] (dates not re-fetched) |
| C3 | Frontier algorithmic progress: compute to reach a fixed loss halves every | 8 (95% CI 5–14), i.e. ≈2.8×/yr | months | Mar 2024 | Ho, Besiroglu, Erdil, Owen et al., "Algorithmic progress in language models", arXiv 2403.05812 | [P] |
| C4 | Compute lead → months of lead (no distillation) | K ≈ 10.8 months per 10× training compute (≈14.1 ECI pts per 10×; effective compute ∝ CR^1.53) | months / OOM | Oct 2026 | IFP (L8), Appendix 2 | [P] |
| C5 | Months per ECI point | ≈2 ECI pts per month of lag (8 pts ↔ 4 mo; 7 pts ↔ 3.5 mo) | ECI / month | 2025–26 | [D] from L1, L2 | [D] |
| D1 | Share of the lead recaptured by distillation | S ≈ 0.5 (R1 cross-check 0.51; authors: "not robust") | fraction of gap | Oct 2026 | IFP (L8): Lead = (1 − S)·K·log10(CR_train) | [P] (S's 13-month anchor is an executive's 12–18-month estimate: [X] input) |
| D2 | Anti-distillation controls | cutting harvested data by fraction c gives ΔS = −0.25·log10(1/(1−c))·S: 90% cut ≈ +1.6 mo, 99% ≈ +3.3 mo at 16× | – | Oct 2026 | IFP (L8) | [P] |
| D3 | Distillation campaigns against Claude | >16M exchanges, ≈24k fraudulent accounts. MiniMax >13M (redirected ~half its traffic to a new Claude model within 24 h), Moonshot >3.4M, DeepSeek >150k (also used Claude as an RL reward model) | exchanges | 23 Feb 2026 | Anthropic, "Detecting and preventing distillation attacks". https://anthropic.com/news/detecting-and-preventing-distillation-attacks | [P] (no capability size given: "a fraction of the time … cost") |
| D4 | Distillation data sizes | R1 distill ≈ 800k × ~5k tok ≈ 4B tokens; MiniMax ≈ 100B tokens (if ~10k tok/exchange). Distillation is "several-fold" in compute efficiency and does not close a 10× compute gap | tokens; × | Apr 2026 | Ho (C1) | [P] (author estimates) |
| D5 | Student / teacher with R1 distill (no RL) | 32B student ≈90%, 7B ≈70%, 1.5B ≈35% of teacher on hard math | fraction | Jan 2025 | DeepSeek-AI, arXiv 2501.12948, Tables 5–6 | [P-r] (research/20 C4) |
| D6 | Imitation needs a strong base | imitation models copy ChatGPT's style, but close "little to none of the gap" on tasks the imitation data does not cover; the fix is "more capable base LMs" | qualitative | May 2023 | Gudibande, Wallace, Snell et al., "The False Promise of Imitating Proprietary LLMs", arXiv 2305.15717 | [P] |
| D7 | Distillation vs. own training | distillation beats supervised training only below a compute level that scales with student size; costs <5% of the teacher's | – | 2025 | Busbridge et al., "Distillation Scaling Laws", arXiv 2502.08606 | [P-r] |
| D8 | OpenAI memo to the House China Committee on DeepSeek distillation | claims only, no numbers | – | 12 Feb 2026 | memo text not found; press only | [X] |
| S1 | Learning by hiring: the hiring firm's use of a recruit's prior inventions | +202% after the move; ≈half is the recruit reusing her own ideas, not the firm learning; the effect persists | % | 2010/2011 | Singh & Agrawal, "Recruiting for Ideas", NBER w15869 / Management Science 57(1) 2011. https://www.nber.org/papers/w15869 | [P] (patents, not AI) |
| S2 | R&D technology spillovers | social returns to R&D ≥ 2× private returns. A 10% rise in peers' R&D goes with a 2–3% rise in a firm's market value (as cited by Ho, C1) | ratio; elasticity | 2013 | Bloom, Schankerman, Van Reenen, "Identifying Technology Spillovers and Product Market Rivalry", Econometrica 81(4):1347–1393. https://www.nber.org/papers/w13060 | [P] (elasticity via C1) |
| S3 | AI talent flows | 68% of AI researchers in industry by 2019 (48% in 2001). Researchers who move to industry publish less, so spillovers weaken | % | 2026 | BFI WP 2026-37 / NBER w34964 | [P] (not lab-to-lab) |
| S4 | Lab-to-lab staff-move spillover in frontier AI | **no primary quantification found** | – | – | – | gap |
| T1 | RAND attacker tiers and levels | 38 attack vectors. OC3 ≤$1M (cybercrime, insiders), OC4 ≤$10M (state, ~1 yr), OC5 ≤$1B (top nation-state, ~1,000 experts). SL_n = robust against OC_n | – | 30 May 2024 | Nevo, Lahav, Karpur, Bar-On, Bradley, Alstott, "Securing AI Model Weights", RAND RR-A2849-1. https://www.rand.org/pubs/research_reports/RRA2849-1.html | [P] / [P-r] research/02 |
| T2 | RAND algorithmic-insight security | 44 attack vectors in 9 categories, 5 insight security levels (ISL1–5). Insights can pass in "a few lines of code, a brief conversation, or an observed screen", so cyber controls alone are not enough | – | 20 Jul 2026 | Brass-Gershovich, Steratore, Hurd, Bradley, Friedman, Nevo, "Securing AI Algorithmic Insights", RAND RR-A4685-1. https://www.rand.org/pubs/research_reports/RRA4685-1.html | [P] |
| T3 | Secrets vs weights bandwidth | SSL test: no more than 1 KB of "the most important 10 KB" of the last month leaks (95%). ≈10⁶× less bandwidth than weights (~2 TB/mo). "Relatively amateur" attempts ($5k bribe, phishing) likely steal insights at today's SSL | – | Apr 2025 | Kokotajlo et al. / AI Futures Project, "AI 2027 Security Forecast". https://ai-2027.com/research/security-forecast | [P] (forecast) |
| T4 | Insiders | compromised staff ≈0.5% of privileged US staff (peak 1% in 2026): OpenBrain 5/1000 (Dec 2024) → 20/2000 (Dec 2026). Poll: 51% chance of a spy among the 200 top US researchers (31.7% for China) | count; % | Apr 2025 | AI 2027 Security Forecast (T3) | [P] (forecast) |
| T5 | Weight theft | China steals Agent-2 in early 2027; the USG learns within 4 weeks; WSL3 → WSL5 takes ≈12 months with a top-priority government effort. Before the theft China is "about 6 months" behind; after it, "2 months" behind (scenario). Poll: 78% expect a state to steal US frontier weights before 2030 | months | Apr 2025 | AI 2027 Security Forecast (T3); AI 2027 scenario | [P] (forecast) / [P-r] research/01, 02 |

Epoch and AISI measure only *released* models, so every lag above is public-to-public. AI 2027's lags
are against the leader's *internal* model.

---

## 2. What the numbers say, by channel

**(1) How far behind followers are.** This is stable across sources and methods:
- open-weight models are 3–4 months behind on ECI (L1, L2) and 4–7 months on cyber (L7);
- Chinese models are ≈7 months behind (6.5–8; L6, L8, L9);
- compute lags more, at ≈15 months (L4).

Capability lags less than compute: a 15-month compute lag goes with a 3–4-month ECI lag. That shortfall
is the room left for diffusion channels: algorithmic parity, distillation and open weights. Older
benchmarks gave ≈13 months (L3). Epoch now uses ECI, and the newer series is the one to calibrate to.

**(2) Closing speed after a frontier capability.** Paradigm replication takes ≈2–5 months (o1 → R1 and
several other labs; C1, C2). Domain replication by small teams takes ≈7 months (C1, RoseTTAFold). A
compute-poor follower reaching a given frontier level takes ≈14 months (C1, DeepSeek-V2 to GPT-4). The
IFP model assumes *equal algorithmic efficiency* between the US and China (L8 assumptions). That means
recipe knowledge diffuses nearly fully, and the steady-state lag is set by compute (C4) minus distillation
(D1).

**(3) Distillation.** This is the one channel with a primary *share-of-gap* estimate: S ≈ 0.5 (D1). Its
limits:
- the benefit depends on the student's base (D5, D6), so it transfers post-training capability, not
  the pretraining recipe;
- it is "several-fold" in efficiency and cannot close a 10× compute gap (D4);
- harvesting is fast: MiniMax redirected traffic to a new model within 24 h (D3);
- API controls cut S only logarithmically (D2).

The OpenAI–DeepSeek claims have no primary text with numbers (D8, [X]).

**(4) Staff and publication.** No frontier-lab study exists (S4).
- Patents: knowledge transferred by a hire is used +202% at the hiring firm, but half of that is the
  hire's own reuse (S1). Transfer is therefore mostly embodied in the person: it scales with who moves.
- Generic R&D spillovers are large: social returns are ≥2× private returns (S2).
- The trend is fewer publications as researchers move to industry (S3).

Publication and staff moves can only be sized structurally (below), not from a measured AI coefficient.

**(5) Leaks and theft.**
- Secrets are tiny and walk out with people. They cannot be defended at SSL ≤ 2 against OC3 (T2, T3),
  so an unprotected recipe diffuses to motivated state actors at about the replication speed.
- Weight theft transfers the *model level* at once (T5: 6 → 2 months), not the recipe. The recipient
  still trains its next model with its own recipe and compute. A stolen model is also a perfect teacher
  for distillation (full logits) [D].
- RAND levels give the attacker gate (T1).

---

## 3. Recommended rule (one mechanism, four inputs)

Units: work in the game's recipe log-multiplier `R` (OOM of effective compute) and model level `G`.

**Conversions [P/D].**
- The frontier gains ≈1.1–1.7 OOM of effective compute per year:
  - low end: 4–5×/yr compute (L4) × 2.8×/yr algorithms (C3);
  - high end: IFP's 10.8 months per 1.53 OOM (C4).
- So 1 month of lag ≈ 0.1–0.14 OOM. ECI ≈ 2 points per month of lag (C5).

### A. Recipe diffusion: a rate, from the best *public* source above the lab

```
dR_i/dt += (1/τ) · max(0, R_pub − R_i) · openness_i
```

- `R_pub` = the highest recipe revealed by any *released* model, open weights or a paper: the source
  lab's recipe, discounted by the share it withholds.
- τ is the replication time constant. A follower that relaxes toward a frontier moving at a constant
  rate ends up exactly τ behind in time. So τ is the *measured paradigm-replication time*, not a fit to
  the game's lag target:
  - **τ = 4 months (range 2–7)**, from o1 → R1 ≈ 4.3 mo (C2), "within months" (C1) and RoseTTAFold
    ≈ 7 mo (C1);
  - so 1/τ ≈ 3/yr (1.7–6). Today's K_DIFFUSION = 2.0/yr sits inside this range, so the rule
    keeps the scale but now has a source.
- `openness_i` ∈ [0, 1] is the lab's own absorptive effort. Default 1 [D].
- The rule applies to *every* lab (player, rivals, China) from *every* public model above it (fixes
  MEA-14). It writes into the recipe, so it acts at each lab's next base, as now.
- Under the IFP equal-efficiency assumption (L8), this term should take the follower to near recipe
  parity. **Check:** with compute lags of 10–16×, the emergent ECI lag should come out at ≈6–8 months
  for China and ≈3–4 months for open-weight labs (L1, L2, L6). This is a validation test, not a fit.

### B. Distillation: a level, at each follower post-training, from any *servable* teacher

```
G_i,post = G_i,own + S_eff · max(0, G_teacher − G_i,own)
S_eff    = 0.5 · access · baseFit(student)
access   = 1 − 0.25 · log10(1 / (1 − c))     (c = the teacher lab's anti-distillation cut)
```

- S = 0.5 and the access formula are from D1 and D2.
- `baseFit` is the student/teacher ratio from R1 (D5) as a function of student base size. It is ≈0.9
  for a near-frontier base and falls to ≈0.35 for a small base. This captures D6: no strong base, no
  transfer.
- The teacher is an API-served model or open weights. It must be released, as Epoch measures (L1–L7).
- Distillation is a post-training gain. It does not raise R (D6, D4), so it does not compound into
  later bases. That stops distillation alone from ever overtaking (IFP: it "only ever allows extracting
  existing capabilities").
- A stolen-weights teacher has access = 1 and logit-level transfer [D].

### C. Discrete transfers: sized by what moves (fixes MEA-15)

| Channel | Size [D, from the cited P] |
|---|---|
| Open-weights release (C6) | `G_open` becomes a floor for every lab that adopts it (fine-tune or serve). Its recipe enters `R_pub` at once, with no lag (the L1–L2 lag is the release lag, not an absorption lag). |
| Publication (A4) | It raises `R_pub` by the published share of the publisher's recipe lead. The effect then arrives through rule A at rate 1/τ. It is not an instant jump. |
| Staff poach (C4) / let go (E16) | The recipient gets `ΔR = share_staff × (R_src − R_dst) × 0.5`. `share_staff` is the mover's share of the source's research staff; 0.5 is the share that is firm learning rather than the hire's own reuse (S1). It arrives through A, with τ halved, because the person carries tacit detail (T2). |
| Secrets espionage | With SSL below the attacker's OC: each compromised insider (T4) adds the source's *internal* recipe to that attacker's `R_pub` (internal, not released). Rule A then runs at 1/τ. |
| Weight theft | Feasible if the attacker's OC > the victim's WSL (T1). The thief gets `G_stolen` as a model at once (T5 calibrates this: 6 → 2 months of lag) and a teacher with access = 1 for B. No R jump beyond what the thief can read off the weights. |

Every preview should call the same functions: the recipient's projected lag change at its next
version.

### Why no K fitted to lag
The parameters are τ (replication events), S and the access formula (IFP), baseFit (R1), the 0.5 hire
share (Singh & Agrawal), and the security gates (RAND, AI 2027). The 3–4 / 7-month lags (L1, L2, L6)
are kept only as **validation targets**. If they fail, look for a missing or mis-tuned mechanism (e.g.
the compute ratio or withheld recipe share), per [Emergent outcomes].

---

## 4. Gaps and cautions
- No primary number exists for lab-to-lab staff spillovers in AI. S1 is patents, from 1990s–2000s
  firms.
- τ rests on few events (o1 → followers, AF2 → RoseTTAFold). The range 2–7 months should be shown as
  uncertainty.
- IFP's S rests on a 13-month no-distillation counterfactual from an executive's estimate. The R1
  cross-check is the authors' own and "not robust".
- Epoch notes that open models' benchmark scores may be overfit (L5), so their real lag is somewhat
  longer.
- The AI 2027 security numbers are forecasts and workshop polls, not measurements.
- The OpenAI memo (D8) and press figures such as "frontier models hold the top for 7 weeks" are not
  used.
