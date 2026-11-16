# 19 - Staff roles: engineers, research engineers, scientists

Research date: 2026-11-16. Scope: STRUCTURE.md §4.1 (three roles) and §6 (calibration item "reference role split of the
2,050 capability staff keeps h = 1"); V2-SPEC §3.4.1 staffing; R13 production function.

**Tags** (as research/15)
- **[P]**: primary document fetched (lab blog, paper, official supplement, code).
- **[P-snip]**: primary URL read only through a search snippet or third-party transcript.
- **[C]**: read directly in code (AIFM `aifm-public` commit `1c40ecd`, 2026-09-09, fresh clone).
- **[Epoch]**: Epoch AI data or analysis.
- **[S]**: secondary summary of a primary source.
- **[U]**: press or unverified.
- **[mem]**: recalled, not re-fetched.
- **[AI27]**: AI 2027 scenario or supplement.
- **[D]**: my derivation.
- **[Design]**: game-design choice with no empirical anchor.

Abbreviations: Eng = engineers; RE = research engineers / applied researchers; Sci = research scientists; SC/SAR/SIAR as
AI 2027; AC = AIFM Automated Coder.

---

# PART 1 - GAME-READY SPEC

## 1.0 What the sources say, in five lines

1. **AI 2027 defines its human labour as research engineers.** SC = "30x as many agents as they have human research
   engineers" doing "experiment implementation but not ideation/prioritization" [AI27 P]. The Mar 2027 workforce of
   "50,000 copies of the best human coder" at 30x therefore implies **≈ 1,700 human REs at OpenBrain in Mar 2027** [D].
2. **AIFM's human labour is "the number of human coders at the leading AI company"** [C], built as OpenAI headcount ×
   "share of employees whose work directly supports AI capabilities" × "full-time-equivalent labor on engineering, as
   opposed to e.g. high-level research management" [P]. Value ≈ 1,040 at 2025.0, ≈ 1,640 at 2025.5 [C, D log-interp],
   2,594 at 2026.0 [C].
3. **Taste is a property of research scientists, not a headcount.** AIFM measures AI taste in SDs "relative to the median
   OpenBrain research scientist" [P]; human headcount enters only through coding labour [C]. More scientists does not
   raise taste; better ones do.
4. **No lab publishes a role split.** Titles are blurred ("Member of Technical Staff"; Anthropic's "Research Engineer /
   Scientist" combined title [S]). Every split below is a derivation, bounded by items 1-2 and by headcount data (Part 2).
5. **Automation order coding → implementation → taste is well supported** (AI 2027, AIFM, Epoch interviews, Anthropic's
   own usage data, RE-Bench, the ideation-execution gap). The *gap* between REs and Eng is weakly evidenced.

## 1.1 (a) Reference role split

### Capabilities (classic 2,050 at Jul 2025; reality 2,450)

| Role | Share | Classic Jul 2025 | Teams (classic) | Reality | Anchor |
|---|---|---|---|---|---|
| Engineers (infra, training-run ops, eval harness, product features) | 0.30 | 600 | 12 × 50 | 735 | Residual; job postings: infra + product ≈ 54-66% of technical openings (§2.2) [Epoch, D] |
| Research engineers | **0.55** | 1,140 | 38 × 30 | 1,350 | AI 2027: ≈ 1,700 REs / H_ref(Mar 2027) = 3,034 → 0.55 [D] |
| Scientists | 0.15 | 310 | 31 × 10 | 365 | Residual; AIFM excludes "research management" from coders [P]; best researcher = 99.9th pct of the lab's range [P] ⇒ a population of ~10³ taste-bearers (Sci + senior RE) [D] |
| **Total** | 1.00 | 2,050 | 81 teams | 2,450 | V2-SPEC §3.4.1 |

Cross-checks [D]:
- AIFM coders at Jul 2025 ≈ 1,640 against OpenAI ≈ 3,000 staff [Epoch] = 55% of total staff, 67% of the reality cap
  (2,450). AIFM's bucket is RE plus capability infra engineers, so s_RE ≤ 0.67 there.
- OpenAI CRO Mark Chen: "the 500 … the heart of the research team" in ≈ 4,000 staff (Dec 2025) [U] ⇒ ≈ 12% of all staff,
  ≈ 15% of cap staff, matching s_Sci = 0.15.
- Anthropic: technical departments 56% of staff (Oct 2026, down from 61%) [P]. The game's 82% cap share is high only
  because non-technical staff are not modelled (V2-SPEC §3.4.1).
- AI 2027 "~3,000 person" OpenBrain in early 2026 [AI27 P] vs game total H_ref/0.82 at Mar 2026 = 2,444/0.82 ≈ 2,980 ✓.
- AI 2027 REs ≈ 1,670 in Mar 2027 vs 0.55 × 3,034 = 1,670 ✓ (by construction).

### Safety (classic 140; reality 170)

Safety engineering (safeguards in production, eval harnesses) is drawn from the **shared engineering pool**, so safety
staff are RE + Sci only.

| Role | Classic | Teams | Reality | Teams | Anchor |
|---|---|---|---|---|---|
| Research engineers | 90 | 3 × 30 | 120 | 4 × 30 | GDM safety hiring "initial batch focuses more on engineers", later "more evenly split" [P] |
| Scientists | 50 | 5 × 10 | 50 | 5 × 10 | One-to-two teams per safety tree column (alignment, interp, evals & control) [Design] |
| **Total** | 140 | 8 | 170 | 9 | V2-SPEC §3.4.1 |

140 is above narrow lab counts (Anthropic 40, GDM 30, OpenAI 15 technical safety FTE, McAleese 2025 [P]) because the
game's "safety" also covers preparedness, frontier red team, safeguards research and evals. Keep 140/170.

### The calibration rule (keeps h = 1)

```
RE_ref(t)  = s_RE · H_ref(t) = 0.55 · (2050 + 49.2·months)   = 1,128 + 27.1·months
h          = RE_cap(t) / RE_ref(t)                            // capabilities REs only
Eng_ref(t) = 0.30 · H_ref(t);  Sci_ref(t) = 0.15 · H_ref(t)  // reference bot hires in these proportions
```

- Identity test (P1) holds by construction: the reference bot hires 0.30/0.55/0.15 of the existing +49.2/month.
  AIFM assumes "the current labor allocation will remain the same" [P], so constant shares are the faithful choice.
- **Side effect to accept:** one RE now moves h by 1/1,128 instead of 1/2,050 (1.8x per head); engineers and scientists
  move h by 0. The aggregate elasticity of M to research labour (λ·sL·wH, R13 §1.6) is unchanged.
- Safety REs do **not** enter h. Moving an RE team Safety → Capabilities raises h by 30/RE_ref ≈ +2.7% at start [D].
- Do not change H_ref itself; it stays the total-capabilities path that payroll and spies (§3.4.1, §3.6) read.

## 1.2 (b) Team sizes and cost per role

| Role | Team size | Real anchors | Cost $M/FTE-yr (cap) | Cost (saf) | Anchor |
|---|---|---|---|---|---|
| Engineering | 50 | Anthropic engineer:PM ≈ 17:1 [P] ⇒ a 50-person group ≈ 3 PMs; GPT-4 Deployment 68 names [P] | 0.70 | (shared pool) | Levels.fyi SWE median OpenAI $720K, Anthropic $883K [P] |
| Research engineering | 30 | GPT-4 area lists 8-129 names (pretraining 68, RL & alignment 71) [P]; Anthropic interp 18 (Jun 2024) [P]; OpenAI Superalignment ≈ 25 [U] | 0.80 | 0.65 | REs mostly titled SWE/MTS; same bands [D] |
| Science | 10 | GPT-4 core contributors per area 4-23 [P] | 1.00 | 0.80 | RS: Anthropic ≈ $827K [P-snip], OpenAI ≈ $1.25M [U] |
| Weighted mean | | | **0.80** ✓ (target 0.8) | **0.70** ✓ (target 0.7) | [D] |

- These are cash-plus-vesting medians. **True fully loaded cost is ≈ 2x:** Anthropic personnel expense $1.86B in Q2 2026
  ⇒ ≈ $1.6-2.1M per head-year incl. stock [S, D]; OpenAI stock comp ≈ $1.5M per employee in 2025 [U]. Keeping $0.8M is
  fine because payroll is small next to compute either way (open question 6).

- Quality tiers (Solid / Strong / Elite) scale output and cost together; Elite science ≈ 2x Solid cost [Design].
- Star hires stay separate ($0.3B each, V2-SPEC); real outlier packages at Meta MSL ($100M+ multi-year) [U] justify it.
- Hiring cap 15/wk (cap) fills one RE team in 2 weeks, one engineering team in 3.3 weeks, one science team in < 1 week.
  Keep the 15/wk cap in heads; a team "arrives" when filled [Design].

## 1.3 (c) Automation order and the existing production-function terms

| Role | AI share shown | Engine term | Reaches ≈ 100% | Evidence |
|---|---|---|---|---|
| Engineers | `1 − wH_eng`, with `A_eng = 1 − (1 − A)²` in the same coding CES | new: build capacity = Lrel(A_eng, e, R·k_eng) | ≈ 1 yr before SC [D] | Lab code share: Google 25% → 30% → 75% of new code (2024-26) [P/P-snip/U]; Anthropic 70-90% (Jan 2026) [U]; Anthropic: feature implementation 14% → 37% of Claude Code use in 6 months [P] |
| Research engineers | `1 − wH` (R13 §1.6) | coding automation `A`, AI labour `R·k` → h's weight | SC (A = 1) | AI 2027 SC defined on REs' implementation work [P]; RE-Bench: agents 4x humans at 2 h, humans 2x at 32 h [P-snip]; PaperBench 21% vs PhD 41% [P-snip] |
| Scientists | `Φ(sdAI)` = share of human scientists AI taste exceeds | `sdAI`, `τ = 1 + (τ_h − 1)(1 − Φ(sdAI))` | SAR (sdAI = 3.09) | AI 2027: "implementation is easier to automate than experiment selection" [P]; SC has ~25th-pct taste (median case) [P]; Si et al. ideation-execution gap [P/P-snip]; Anthropic staff keep "high-level thinking and design" [P] |

- Engineers' A_eng formula is [Design]: at the `ai2027` preset's A = 0.54 (Jul 2025) it gives 0.79, at A = 0.9 it gives
  0.99. It encodes "engineers first" without a new knot table. A `reality` preset with AIFM's A = 0.10 (2025.0) gives 0.19.
- **Scientists' headcount → project progress (tree), not taste.** Scientist *quality* drives τ_h:
  `τ_h = 1 + Σ_teams n_i (q_i − q_ref) / Sci_ref + 0.05·stars`, so the reference mix gives τ_h = 1 [Design]. This keeps
  AIFM's rule that taste is per-researcher quality.
- Safety REs: AI share uses the same `A`; their output feeds R14's `(1 + AI_labour · Auto)` term unchanged.
- June 2027 anchor: "Most of the humans at OpenBrain can't usefully contribute anymore"; removing them would slow
  research ≈ 50% [AI27, paraphrase via fetch tool]. Under this spec, at that point Eng and RE AI share ≈ 100% and scientists still carry taste
  weight (1 − Φ(sdAI)) — consistent.

## 1.4 (d) Open questions

1. **s_RE between 0.55 and 0.67.** AI 2027 implies 0.55 (Mar 2027); AIFM coders ≈ 0.67 of a 2,450 cap (OpenAI-anchored)
   but include infra engineers. Shares only change the per-head lever, not calibration. Recommend 0.55.
2. **Product engineers.** The 2,050 excludes product staff (dropped 2026-11-15). If the engineering pool also builds
   product features, either (a) accept that 600 engineers cover both, or (b) add ≈ 150-300 product engineers outside
   H_ref (total 2,500 has 310 non-cap, non-safety slots). Recommend (a) for v1 of the layer; revenue calibration via the
   reference feature set (§6) absorbs it.
3. **Does engineering automation share inference with research agents?** Recommend one agent inference pool `k`, split by
   the player's policy; reference split by headcount [Design].
4. **Scientist headcount floor.** Should a lab with very few scientists lose taste (a "thin bench" penalty)? AIFM has no
   such term. Recommend no.
5. **No RS:RE ratio exists for any safety team** (Part 2 §2.4). The 90/50 safety split is a design choice.
6. **Payroll level.** Role ratios rest on self-reported Levels.fyi medians; the absolute level is ≈ 2x low once stock is
   counted (§2.3). Doubling it to $1.6M would make payroll ≈ $4B/yr (classic), still small next to compute. Decide
   with R15's cash calibration, not here.

---

# PART 2 - EVIDENCE

## 2.1 AI 2027 and AIFM: what the human labour count is

| Claim | Source | Tag |
|---|---|---|
| SC: "30x as many agents as they have human research engineers", doing "coding tasks involved in AI research (e.g. experiment implementation but not ideation/prioritization)" at 30x "the company's best engineer" | ai-2027.com/research/timelines-forecast | [P] |
| Mar 2027: "OpenBrain runs 200,000 Agent-3 copies in parallel, creating a workforce equivalent to 50,000 copies of the best human coder sped up by 30x" ⇒ 50,000 / 30 ≈ 1,670 human REs | ai-2027.com; takeoff supplement says 50,000 SAR-equivalents is "about 30x what we project the OpenBrain researcher population to be in 2027" | [P] + [D] |
| Early 2026: OpenBrain security compared to "a fast-growing ~3,000 person tech company" | ai-2027.com | [P] |
| Jan 2027: "every OpenBrain researcher becoming the 'manager' of an AI 'team'"; Mar 2027: human engineers kept for "complementary skills needed to manage the teams"; Jun 2027: "Most of the humans at OpenBrain can't usefully contribute anymore" | ai-2027.com | [P] |
| "experiment implementation is easier to automate than experiment selection"; "today's AI systems … aid in coding more than experiment selection"; mainline SC: "elite human scientists … manage large teams of AI agents" | takeoff supplement | [P] |
| AIFM `L_HUMAN` = "The number of human coders at the leading AI company"; 415 (2024.0), 1,037.5 (2025.0), 2,593.75 (2026.0), 5,447 (2027.0), 9,804 (2028.0) | `constants/chartExplanations.ts`, `inputs/input_data.csv` | [C] |
| L_HUMAN built from OpenAI staffing: headcount grew 1.27x/yr before 2022, 2.5x/yr after; × capabilities share (majority early, declining as OpenAI became product-oriented) × engineering FTE share "as opposed to e.g. high-level research management"; future 1.5-2x/yr, < 20%/yr by 2035; allocation held constant | AIFM parameter doc (Google Doc linked from `ForecastChartsSection.tsx`) | [P] |
| AIFM taste unit: SDs "relative to the median OpenBrain research scientist"; best researcher = 99.9th pct of the AGI project range (≈ 3.09 SD) | same; `config.py TOP_RESEARCHER_SD` (R13) | [P][C] |
| AC "can fully automate an AGI project's coding work, replacing the project's entire coding staff"; "more human labor is currently spent on coding than experiment ideation/selection" (fn 16) | blog.aifutures.org Dec 2025 update | [P] |
| Game: H_ref = 2,050 + 49.2·months = 0.82 × total staff (2,500 → 3,000) | R11 #12, R13 §1.1, V2-SPEC §3.4.1 | [D] |

## 2.2 Lab headcounts and role mix

No lab publishes a research-scientist / research-engineer / engineer split.

| Claim | Date | Source | Tag |
|---|---|---|---|
| OpenAI ≈ 3,000 staff (Jul 2025), ≈ 4,000 (Dec 2025), ≈ 4,500 (Mar 2026); target ≈ 8,000 end-2026 | 2025-26 | epoch.ai/data/ai_companies_staff_reports.csv; target via FT | [Epoch]; target [U] |
| OpenAI: "the 500 … the heart of the research team" in an org of "thousands" (Mark Chen, CRO) | Dec 2025 | podcast transcript | [U] |
| Anthropic ≈ 940 (Dec 2024), ≈ 2,300 (Dec 2025), ≈ 5,300 (Sep 2026) | 2024-26 | S-1 p.228 via sec-api.io; Epoch | [S][Epoch] |
| Anthropic: headcount "tripled in size in the last year"; technical departments 61% → 56% of staff; engineer:PM ≈ 17:1; junior share of technical staff 21% → 14% | Oct 2026 | anthropic.com/research/employment-at-anthropic | [P] |
| GDM ≈ 4,000 (May 2024), 5,600 (Mar 2025), ≈ 6,000 (Aug 2025) | 2024-25 | Epoch staff dataset | [Epoch] |
| Research-and-engineering headcount growth/yr (Zeki LinkedIn data): GDM ≈ 27%, OpenAI ≈ 97%, Anthropic ≈ 152% | Aug 2026 | Fortune | [S] |
| xAI ≈ 300 core + ≈ 900 AI tutors (Mar 2025); Mistral 350 (Sep 2025); DeepSeek 160 (Mar 2025), 300 (Jun 2026); Meta FAIR ≈ 1,000, MSL ≈ 3,400 (2025), TBD Lab "a few dozen" | 2025-26 | Epoch staff dataset; Meta cuts via press | [Epoch]; TBD [U] |
| DeepSeek-V3 contributors: Research & Engineering 150, Data Annotation 31, Business & Compliance 18 (≈ 75% R&E) | Dec 2024 | arXiv 2412.19437 | [P] |
| GPT-4 report ≈ 280 authors; unique names (core): pretraining 68 (18), long context 8 (4), vision 38 (14), RL & alignment 71 (23), evals 129 (14), deployment 68 (19) | Mar 2023 | arXiv 2303.08774 | [P] (counted by fetch tool; overlaps) |

Open postings by function, Epoch Frontier Lab Hiring snapshot 2026-11-09 (hiring mix, not stock) [Epoch]:

| Function | Anthropic (676) | OpenAI (813) |
|---|---|---|
| Research (incl. safety 51 / 54) | 17% | 11% |
| Compute / infra | 10% | 13% |
| Product | 10% | 21% |
| Go-to-market (incl. forward-deployed eng.) | 34% | 37% |
| Corporate (G&A, security, policy/legal) | 29% | 17% |

Reading [D]: among *technical* postings (research + infra + product), research is 34-46%, engineering 54-66%. That is
the flow in 2026, when labs are scaling GTM; the stock of research staff is larger (OpenAI ≈ 500 core researchers).

## 2.3 Compensation

| Claim | Date | Source | Tag |
|---|---|---|---|
| OpenAI median total comp: SWE $720K (L3 $349K … L7 $2.32M); eng manager $1.38M; PM $750K; sales $305K; all roles $570K | 2026 | levels.fyi/companies/openai/salaries | [P] (self-reported) |
| Anthropic median: SWE $882.5K (range $482K-$1.41M); business ops $643K; PM $407K; recruiter $199K | 2026 | levels.fyi/companies/anthropic/salaries | [P] (self-reported) |
| Research scientist: Anthropic ≈ $827K; OpenAI ≈ $1.25M | 2026 | Levels.fyi snippet; aggregator | [P-snip]; [U] |
| Anthropic personnel expense $1.86B in Q2 2026 ($0.22B Q1 2025); SBC $1.17B FY2025 | 2026 | S-1 via sec-api.io | [S] |
| ⇒ ≈ $1.6-2.1M per head-year all-in, ≈ $0.5-0.7M cash | 2026 | from the S-1 line, assuming 3,500-4,700 heads | [D] |
| OpenAI stock comp ≈ $1.5M per employee in 2025 | 2025 | WSJ/Equilar | [U] |
| Meta MSL offers: "$100M signing bonuses" (Altman); up to $300M / 4 yr (Wired, disputed) | Jun-Jul 2025 | press | [U] |

## 2.4 Safety teams

| Claim | Date | Source | Tag |
|---|---|---|---|
| GDM AGI Safety & Alignment: "anywhere between 30 and 50 is defensible" (boundary-dependent); grew 39% (2023), 37% (2024 to Aug); small engineering team supports infra; Gemini Safety separate | Aug 2024 | greaterwrong.com/posts/79BPxvSsjzBkiSyTq (Rohin Shah comment) | [P] |
| GDM safety hiring opens RS and RE; "initial batch focuses more on engineers", later "more evenly split"; RE needs no PhD | Feb 2025 | alignmentforum.org/posts/wqz5CRzqWkvzoatBG | [P] |
| Anthropic interpretability team: 18 people; hiring ≥ 5 senior engineers; "research and engineering [are] inseparable"; engineering "one of the major bottlenecks" | Jun 2024 | anthropic.com/research/engineering-challenges-interpretability | [P] |
| Anthropic postings use the combined title "Research Engineer / Scientist, Alignment Science" | 2025 | builtin.com job aggregator | [S] |
| Technical safety FTE by org: Anthropic 40, GDM 30, OpenAI 15 (+10 governance), Meta 5, METR 31, UK AISI 50; field ≈ 600 technical + 500 non-technical, +21%/yr | Sep 2025 | McAleese, forum.effectivealtruism.org/posts/7YDyziQxkWxbGmF3u | [P] (personal estimate) |
| OpenAI Superalignment ≈ 25 people at dissolution; 20% compute pledge "never" approached (six sources) | May 2024 | Fortune | [U] |
| No lab publishes an RS:RE ratio for safety teams | — | searched | — |

## 2.5 Automation order

| Claim | Date | Source | Tag |
|---|---|---|---|
| Google: AI completes 50% of code characters in IDE (37% acceptance) | Jun 2024 | research.google/blog/ai-in-software-engineering-at-google-progress-and-the-path-ahead | [P-snip] |
| Google: "more than a quarter of all new code … generated by AI, then reviewed and accepted by engineers" | Oct 2024 | blog.google Q3 2024 earnings | [P] |
| Google: 75% of new code AI-generated | 2026 (Cloud Next) | devops.com | [U] |
| Amodei: AI writing 90% of code in 3-6 months, "essentially all" in 12 | Mar 2025 | CFR, via Fortune | [U] |
| Anthropic: 70-90% of company code written by Claude; ≈ 90% of Claude Code's own code | Jan 2026 | spokesperson via Fortune | [U] |
| Anthropic internal study: 132 staff; Claude in ≈ 59% of work (28% a year earlier); productivity +50% self-reported; most can "fully delegate" only 0-20%; daily use debugging 55%, code understanding 42%, new features 37%; transcripts Feb → Aug 2025: feature implementation 14.3% → 36.9%, design/planning 1.0% → 9.9%; staff keep "high-level thinking and design" | Dec 2025 | anthropic.com/research/how-ai-is-transforming-work-at-anthropic | [P] |
| METR RCT: experienced OSS devs 19% *slower* with AI (forecast 24% faster) | Jul 2025 | metr.org | [P] |
| RE-Bench (ML research engineering): agents 4x human score at 2 h budget; humans 2x at 32 h | Nov 2024 | arXiv 2411.15114 | [P-snip] |
| PaperBench: best agent 21.0% replication vs ML PhDs 41.4% (48 h) | Apr 2025 | openai.com/index/paperbench | [P-snip] |
| Si et al.: LLM ideas rated *more novel* than experts' (p < 0.05), slightly less feasible | Sep 2024 | arXiv 2409.04109 | [P] |
| Ideation-execution gap: after 100+ h execution, LLM ideas' scores fall significantly more than human ideas' | Jun 2025 | arXiv 2506.20803 | [P-snip] |
| Epoch interviews (8 researchers): engineering (implementation, debugging) automated first; planning/hypothesis takes little time vs implementation; one: 60% of time automatable if implementation handled | Aug 2024 | epoch.ai/blog/interviewing-ai-researchers-on-automation-of-ai-rnd | [Epoch] |

Gaps: no published time-use survey of AI researchers beyond Epoch's 8 interviews; no lab reports AI share for engineers
vs researchers separately.
