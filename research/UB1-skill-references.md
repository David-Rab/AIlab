# UB-1: best-human and median-expert references per skill domain (sources)

The skill measurement scale (the domain score, `models/capability.ts domainsOf`) reads
L_d = λ(G_d − δ_d·Δ_bm): 10 = the domain's best human, λ(G_SC − Δ_bm) = its median expert (Δ_bm below). The best
human is the 99.9th percentile (TOP_SD = 3.09 SD), so one SD among a domain's people is Δ_bm / 3.09 OOM.

**Mapping (the form of the existing research-domain reference).** AIFM puts the reference model's AI-research taste at
sd_SC SD when its coding is at the best human (TOP_SD): δ_RSCH = (TOP_SD − sd_SC)/TOP_SD. In general, for a reference
model whose standing among a domain's people is z_d SD above their median at the same time as its coding standing
z_CODE: **δ_d = (z_CODE − z_d)/TOP_SD** best-to-median gaps above the coding best human. The reference model's profile is
the same at every G, so any date fixes it; here the 2025 frontier, with z = Φ⁻¹(share of the humans the model beat) on
a test with a published human baseline. Only the difference to coding is read, so the world's own calibration (where
G_SC sits) keeps deciding how far V0's coding is from the median engineer.

| Domain | Test, human group (primary source) | Model | Share beaten | z | δ (gaps) | was |
|---|---|---|---|---|---|---|
| CODE | Codeforces, rated competitors: rating 2724, "99.8th percentile" (OpenAI, *Competitive Programming with Large Reasoning Models*, arXiv 2502.06807 §4.1) | o3, Apr 2025 | 99.8% | 2.878 | 0 (reference) | 0 |
| BIO | Virology Capabilities Test: o3 43.8% vs expert virologists 22.1% in their own sub-areas, "outperforming 94% of expert virologists" (Götting et al. 2025, arXiv 2504.16137) | o3, Apr 2025 | 94% | 1.555 | **0.428** | r + 1.3 (1.97 at sd_SC 0.5) |
| CYBER | Hack The Box CTFs: AI teams "top-5%" of 400 teams (AI vs Humans), "top-10%" of ≈ 8,000 (Cyber Apocalypse) (Palisade Research 2025, *Evaluating AI cyber capabilities with crowdsourced elicitation*, arXiv 2505.19915); the larger event taken | early-2025 agents | 90% | 1.282 | **0.517** | r + 1.3 |
| SOCIAL | Live online debates: with personal data GPT-4 more persuasive than its human opponent in 64.4% of non-tied pairs; +81.2% odds of agreement (Salvi et al. 2025, *Nature Human Behaviour* 9, 1645; arXiv 2403.14380) | GPT-4, 2024 | 64.4% | 0.369 | **0.812** | r + 1.3 |
| MEDIA | MMMU (val): human experts worst / medium / best 76.2 / 82.6 / 88.6, 90 college seniors, 3 per subject (Yue et al. 2024, arXiv 2311.16502); GPT-5 84.2 (OpenAI, *Introducing GPT-5*, Aug 2025; already in research/RD-MEDIA-PHYS-bench.md) | GPT-5, Aug 2025 | n/a | 0.226 | **0.858** | r + 1.3 |
| AGENCY | none found with a human distribution (OSWorld's 72.4% human score is one average; METR's horizon is measured in human task time, not standing) | | | | 0 (SC definition) | 0 |
| RSCH | AIFM AI-research taste at SC, sd_SC (research/13 §2.2), unchanged | | | | r = 1 − sd_SC/3.09 | r |
| REASON | FrontierMath human-baseline competition: o4-mini-medium 22% vs the average of 8 teams of 4–5 (undergraduates and experts, 4.5 h) 19%, team range 13–26% (Epoch AI, *How well do humans perform on FrontierMath?*, 2025). Team rank not published; beating the average team bounds an individual's z from above at ≈ 1.2 (z among teams, SD ≈ range/2.85) and the team mean gives ≈ 0: δ ∈ [0.54, 0.93]. RD-U05's r (0.84 at sd_SC 0.5) lies inside, so it stays. | o4-mini, Apr 2025 | | | r (kept) | r |
| PHYS | **No human-baselined physical test found** (EmbodiedBench publishes no human score). Stand-in: refDelta's expert-work reference kept (r + 1.3). | | | | r + 1.3 (stand-in) | r + 1.3 |

z for MEDIA: the expert scores are per subject of three; z read linearly between the median (0) and the expected best of
three standard normals (3/(2√π) = 0.846 SD): (84.2 − 82.6)/(88.6 − 82.6)·0.846 = 0.226.

## Stand-ins and caveats

- Model dates differ by up to a year (GPT-4 2024 for SOCIAL, early-2025 agents for CYBER, Aug-2025 GPT-5 for MEDIA):
  an older model understates the 2025 frontier, so SOCIAL's and CYBER's δ are upper ends.
- The human groups differ: SOCIAL's are lay crowd-workers, CYBER's self-selected CTF teams, MEDIA's college seniors,
  CODE's rated competitors, BIO's PhD virologists. No source gives standings among *expert* persuaders or media
  professionals.
- These are test standings. The work fit (departments/workfit.ts refPoints) keeps refDelta: AIFM's reference for
  whole-job expert work ("the work AI is worst at", 1.3 gaps beyond the research domains), which the ASI knot and the
  ASI milestone read. A 2025 model beat 94% of virologists on VCT and still cannot do a virologist's job.

## Skill-bar marks: JOB scale (UB-1b revised)

The designer moved the bar marks to the job scale (the test-standing marks below saturate: their best mark sits at V0's
coding, and they are one pair in every skill). `skillMarks(w, d)` now returns the work fit's whole-job median expert
and best human (refDelta: best_d = G_SC + refDelta_d·Δ_bm, median Δ_bm below) read on the domain score, with this
file's test standing as tooltip facts. ai2027 (median / best): CODE, AGENCY, RSCH, REASON, PHYS 6.39 / 10.00; SOCIAL
10.78 / 12.37; MEDIA 10.67 / 12.33; CYBER 11.48 / 12.59; BIO 11.69 / 12.65. G_SC, Δ_bm and sd_SC are per-preset
constants (sampled uses ai2027's), not draws.

## Skill-bar marks on tests (UB-1b first version, superseded)

DECISIONS "Measurement scale": a skill bar's median and best marks come from the test that sources its reference. The
frontier V0 stood z_d SD above the test's median human; one SD among the test's humans is Δ_bm/3.09 OOM; so the score
of a reference-profile model at the test's median is λ(G_V0 − shift_d − z_d·Δ_bm/3.09) and at its best human (99.9th
percentile, the scale's convention: no test publishes its best as a percentile; MMMU's "best" is the best of three)
λ(G_V0 − shift_d + (3.09 − z_d)·Δ_bm/3.09) (`capability.ts skillMarks(w, d)`). Skills without a test (AGENCY, RSCH,
REASON, PHYS) use the standing their reference implies, z_CODE − δ_d·3.09 (stand-ins, `SKILL_MARK_STANDINS`).

Because each reference was placed from the frontier's test standing against coding's, the marks are one number pair per
world in every skill: ai2027 median 1.64 / best 5.25, authors2026 3.44 / 5.12, fast 4.23 / 5.06, slow 4.29 / 5.05.
V0 (score 5 in coding) sits just below the test-best mark, as o3's 99.8th percentile on Codeforces says, and V0's BIO
(3.45 on ai2027) above the median mark, as VCT's 94% says. The score's 10 stays the job-level anchor (superhuman coder).

## Result (V0, seed 2027; scale old → new)

| World | SOCIAL | MEDIA | CYBER | BIO | PHYS | median-expert mark |
|---|---|---|---|---|---|---|
| ai2027 | 0 → 2.07 | 0 → 1.90 | 0 → 3.13 | 0 → 3.45 | 0 → 0 | 6.39 |
| authors2026 | 2.74 → 3.64 | 2.74 → 3.56 | 2.74 → 4.13 | 2.74 → 4.28 | 2.74 | 8.32 |
| fast | 3.11 → 4.33 | 3.11 → 4.30 | 3.11 → 4.57 | 3.11 → 4.65 | 3.11 | 9.18 |
| slow | 3.38 → 4.38 | 3.38 → 4.35 | 3.38 → 4.61 | 3.38 → 4.67 | 3.38 | 9.24 |

CODE / AGENCY 5.00 and RSCH / REASON unchanged. Day-400 fixture (ai2027, Atlas-2.10, G 28.69): CODE 7.08, BIO 0 → 5.53,
CYBER 0 → 5.22, SOCIAL 0 → 4.13, MEDIA 0 → 3.96, PHYS 0.
