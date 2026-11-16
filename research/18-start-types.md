# 18 - Start types: real analogues and game start values

Research date: 2026-11-16. Scope: STRUCTURE.md §4.8 start types; TECH-TREE.md §5 T3 (known nodes per type). Game start
Jul 2025; spinout analogues read at their own founding and rescaled.

**Tags** (as R15): **[P]** primary document fetched · **[P-snip]** primary URL read via search snippet ·
**[Epoch]** Epoch AI data · **[S]** secondary summary of a primary source · **[U]** news only, unverified ·
**[mem]** recalled, not re-fetched · **[D]** my derivation · **[Design]** game choice with no empirical anchor.
Cross-references: "R07 §2.3" = research/07-actors.md, and so on.

Units: $B; H100e (Epoch/AI27); rental at $13K/H100e-yr (V2-SPEC §3.7.2); staff cost $0.7-0.8M/FTE-yr (V2-SPEC §3.4.1).

---

## 0. Method: "months behind" from Epoch ECI

- Source: Epoch Capabilities Index, `eci_scores.csv` (updated 16 Nov 2026) [Epoch] https://epoch.ai/data/eci_scores.csv ;
  scale anchors Claude 3.5 Sonnet = 130, GPT-5 = 150 [Epoch] https://epoch.ai/benchmarks/eci .
- **Lag** = game date − the date the public frontier first reached the lab's best ECI ("first crossing") [D].
- Frontier pace: o1 141.2 (Dec 2024) → o3 147.1 (Apr 2025) → GPT-5 150.0 (Aug 2025) → GPT-5.2 Pro 157.3 (Dec 2025),
  ≈ 1.3 ECI/month [Epoch][D].
- Lag is vs the leader's *public* model; AI 2027's 3-9 months (R07 §1.3) is vs OpenBrain's *internal* model. Add ~1-2
  months for that (GPT-5, 150, went public 7 Aug 2025) [D].

### 0.1 Lag at game start (1 Jul 2025)

| Lab (analogue for) | Best model by ~Jul 2025 | ECI | Frontier first reached it | Lag (mo) |
|---|---|---|---|---|
| OpenAI (leader) | o3-pro, 10 Jun 2025 | 147.5 | — | **0** |
| Google DeepMind (big tech) | Gemini 2.5 Pro, 5 Jun 2025 | 144.9 | o3, 16 Apr 2025 | **2.5** |
| xAI (challenger) | Grok 4, 9 Jul 2025 | 146.9 | o3, 16 Apr 2025 | **~3** |
| Anthropic (challenger) | Claude Opus 4, 22 May 2025 | 142.9 | Gemini 2.5 Pro, 31 Mar 2025 | **3** |
| Best open weights (spinout base) | DeepSeek-R1-0528 / Kimi K2 | 140.7-141.2 | o1, 17 Dec 2024 | **6.5** |
| Meta (big tech) | Llama 4 Maverick, 6 Apr 2025 | 132.1 | o1-preview, 12 Sep 2024 | **9.5** |
| Mistral (small challenger) | Mistral Medium 3, 7 May 2025 | 132.8 | o1-preview, 12 Sep 2024 | **9.5** |
| Microsoft (big tech) | Phi-4 (Dec 2024); MAI-1-preview (Aug 2025) not in ECI | 129.0 | Claude 3.5 Sonnet, 20 Jun 2024 | **~12** |

All ECI values [Epoch]; lags [D].

### 0.2 Observed catch-up after start (calibration targets for the engine)

| Lab | Model | ECI | Lag at release (mo) | What happened in between |
|---|---|---|---|---|
| Thinking Machines | Inkling-Small, 15 Jul 2026 | 150.8 | **~9** | First own model 17 mo after launch, 12 mo after the $2B seed |
| Reflection AI | Beam 1.0, 5 Oct 2026 | 150.9 | **~12** | First frontier model 12 mo after the $2B round |
| Meta | Muse Spark, 8 Apr 2026 · Muse Wonder, 12 Oct 2026 | 153.1 · 161.7 | **4 · 5.5** | MSL reorg plus heavy spending: 9.5 → ~5 mo in 9-15 mo |
| xAI | Grok 4.6, 12 Aug 2026 · Grok 4.7, 21 Sep 2026 | 157.8 · 156.2 | **5 · 7.5** | Fell back from ~3 mo |
| Mistral | Mistral Large 4, 29 Oct 2026 | 154.6 | **~9** | Flat at ~9-10 mo |
| Google DeepMind | Gemini 4 Carbon, 28 Oct 2026 | 169.8 | **0** (top score at release) | Caught up |
| Anthropic | Claude Fable 5.2, 9 Nov 2026 | 173.4 | **0** (top score) | Went from ~3 mo behind to leader in ~16 mo |

All [Epoch]; lags [D]. Lesson: a spinout's first own model lands ~9-12 mo behind, 12-17 mo after funding; challengers
and big-tech labs can reach parity in 12-18 mo; small challengers stay ~9 mo behind.

---

## 1. Well-funded spinout

### 1.1 Analogues

| Item | Anthropic (2021-22) | SSI (2024-25) | Thinking Machines (2025) | Reflection AI (2024-25) |
|---|---|---|---|---|
| Founded | 2021 | Jun 2024 [mem] | Launch 18 Feb 2025, 29 staff [S] https://fortune.com/2025/02/18/former-openai-cto-mira-murati-finally-unveils-her-thinking-machines-lab-startup-and-a-leadership-team-stacked-with-former-openai-colleagues/ | Mar 2024 [S] |
| Capital | Series A $124M, 28 May 2021 [P] https://www.anthropic.com/news/anthropic-raises-124-million-to-build-more-reliable-general-ai-systems ; Series B $580M, Apr 2022 [mem] | $1B at $5B (Sep 2024) + $2B at $32B (Apr 2025) = ~$3B [U] https://www.calcalistech.com/ctechnews/article/hjfywdtajl | $2B seed at $12B, 15 Jul 2025; a16z lead; Nvidia, AMD, Cisco in [U] https://techcrunch.com/2025/07/15/mira-muratis-thinking-machines-lab-is-worth-12b-in-seed-round/ | $2B at $8B, 9 Oct 2025; Nvidia lead [U] https://techcrunch.com/2025/10/09/reflection-raises-2b-to-be-americas-open-frontier-ai-lab-challenging-deepseek |
| Staff | ~11 founders/early staff [U] https://www.aibusiness.com/verticals/eleven-openai-employees-break-off-to-establish-anthropic-raise-124m | ~20 [U]; 40-60 [U] | 29 at launch [S] | — |
| Compute | Rented (cloud) [mem] | Google Cloud TPUs, mostly TPU [U] | Own clusters for Tinker [P] (size undisclosed) | Rented [U] |
| Product | None for ~2 years (Claude Mar 2023) [mem] | None ("straight shot") [mem] | Tinker fine-tuning API on **open-weight** models, private beta 1 Oct 2025 [P] https://thinkingmachines.ai/blog/announcing-tinker/ | Open-weight models planned |
| Governance | PBC; LTBT added 2023 (R15 §2.11) | Founder-led [mem] | Founder holds voting control [U] | — |
| Talent | Elite ex-OpenAI | Founder name pull | Elite ex-OpenAI; co-founders returned to OpenAI Jan 2026 [U] https://fortune.com/2026/01/16/mira-murati-thinking-machines-staff-defections-openai-zoph-metz-schoenholz/ | Ex-DeepMind |

### 1.2 Rescaling and proposed values

- Cash: 2024-25 spinouts raised $2-3B in their first 12-15 months, ~5-7% of the leader's start cash [D]. Anthropic
  2021 contributes the pattern (no product for 2 years, safety brand), not the dollar figure.
- Staff: real spinouts start at 10-30, but STRUCTURE §4.1 team sizes (50 / 30 / 10) force ~90 for one team per role.
  Use "6 months in" [Design].
- Model: no own model; the best open-weight base lags **6.5 mo** (§0.1). TML's first product ran on open-weight
  models [P], so this is grounded.

| Field | Range | Default | Basis |
|---|---|---|---|
| Cash | $1.5-5B | **$3B** | SSI $3B, TML $2B, Reflection $2B [U] |
| Board | founder-controlled | **Founder-controlled corp** (R15 §1.6), 1 financial seat | [U], [Design] |
| Staff | 30-150 | **110**: 1 eng (50), 1 RE (30), 3 science (Elite) | [Design] |
| Compute | 10-50K H100e | **25K rented, 0 owned** (~$0.33B/yr) | [Design] |
| Model | none / open base | **No own model; may fine-tune an open-weight base at 6.5 mo lag** | [Epoch][D] |
| Revenue | 0 | **$0** | All four analogues |
| Talent pull | — | **+20**; star hire cost ×0.7 | [Design], founder brand |

---

## 2. Challenger lab

### 2.1 Analogues (mid-2025)

| Item | Anthropic | xAI | Mistral (small) |
|---|---|---|---|
| Last round before start | Series E $3.5B at $61.5B, Mar 2025 (R15 §2.9) [P] | $5B secured debt + $5B strategic equity, ~1 Jul 2025, Morgan Stanley [U] https://www.nbcwashington.com/news/business/money-report/elon-musks-xai-raises-10-billion-in-debt-and-equity-as-it-steps-up-challenge-to-openai/3947888/ | Series C €1.7B at €11.7B, ASML lead, 9 Sep 2025 [P] https://mistral.ai/news/mistral-ai-raises-1-7-b-to-accelerate-technological-progress-with-ai |
| Cash at Jul 2025 | ~$5-8B [D]: 2024 OCF −$5.7B, 2025 OCF −$2.6B (R15 §2.10 [S]) | ~$10B [D] after the Jul raise; 2025 burn ~$14B (R15 §2.9 [U]) | ~€1-2B [D] |
| Run-rate | ~$1B (Jan 2025) → >$5B (Aug 2025) [P] https://www.anthropic.com/news/anthropic-raises-series-f-at-usd183b-post-money-valuation ; ~$4B in Jul [D] | 2025 revenue $3.2B incl. X (R15 §2.9 [U]); AI-only far lower [D] | — |
| Staff | ~1,000 early 2025 → ~2,300 Dec 2025 [U]; Jul ≈ 1,500 [D] | ~1,200 (Mar 2025) plus ~1,500 annotators [U] | — |
| Compute | Rented: AWS + Google TPU. Rainier ~500K Trainium2 live Oct 2025 [P-snip] https://www.aboutamazon.com/news/aws/aws-project-rainier-ai-trainium-chips-compute-cluster ; end-2025 1.19M H100e [Epoch]; Jul ≈ 0.4-0.6M [D] (below a 2.5×/yr back-cast because Rainier came online after Jul) | Owned: Colossus ~200K GPUs (~150K H100, 50K H200, 30K GB200) [U] ≈ 0.28M H100e [D]; end-2025 0.615M [Epoch] | Rented [mem] |
| Model lag | 3 mo (§0.1) | ~3 mo (§0.1) | 9.5 mo (§0.1) |
| Products live | Claude app, API, enterprise; Claude Code >$500M run-rate by Aug 2025 [P] | Grok in X and app; API | Le Chat, API, on-prem |
| Governance | PBC + LTBT (R15 §1.6) | Founder-controlled (R15 §1.6) | Founder-led, strategic investors |
| Safety (FLI Summer 2025, R07 §1.3) | C+ (top) | D | — |
| Talent | 80% two-year retention; engineers 8× likelier to move OpenAI→Anthropic than back [P] https://www.signalfire.com/blog/signalfire-state-of-talent-report-2025 | Founder brand; volatile | European base |

### 2.2 Proposed values

| Field | Range | Default | Basis |
|---|---|---|---|
| Cash | $4-12B | **$8B** | [D] from Anthropic and xAI above |
| Board | investor board | **Founder-controlled corp with 2 financial seats + 1 strategic observer** (R15 §1.6); flavour option: PBC + LTBT | [Design] |
| Staff | 800-2,000 | **1,300** | [D] |
| Compute | 0.25-0.6M | **0.4M: 0.1M owned / 0.3M rented** | [D]; cloud ~$3.9B/yr at $13K |
| Model lag | 3-9 mo | **3 mo** (small-challenger variant 9) | §0.1 |
| Revenue run-rate | $0.5-5B | **$3B** | [D] |
| Talent pull | — | **+10** (safety flavour +20 for safety staff) | SignalFire [P], [Design] |

Check: payroll ~$1B + cloud ~$3.9B − revenue $3B ≈ −$2B/yr before capex [D]; Anthropic 2025 OCF −$2.6B (R15 §2.10).

---

## 3. Big-tech AI division

### 3.1 Analogues (mid-2025)

Amazon AGI: parent capex ~$131.8B in 2025 (R15 §2.7); no ECI-listed model; omitted below.

| Item | Google DeepMind | Meta (FAIR + MSL) | Microsoft AI |
|---|---|---|---|
| Parent AI capex | 2025 guide raised to $85B (23 Jul 2025) [P-snip] https://blog.google/inside-google/message-ceo/alphabet-earnings-q2-2025/ ; actual $91.4B (R15 §2.7) | 2025 guide $66-72B [U]; actual $72.2B (R15 §2.7) | FY25 ~$88B incl. finance leases [U] |
| Parent compute | Google ~5M H100e end-2025, ~4M of it TPU [Epoch] https://epoch.ai/data-insights/google-custom-tpus-ai-compute/ | Target 600K H100e end-2024 (Zuckerberg, 18 Jan 2024) [U] https://www.cnbc.com/2024/01/18/mark-zuckerberg-indicates-meta-is-spending-billions-on-nvidia-ai-chips.html | Microsoft 16.8% of world compute end-2025 [U citing Epoch] |
| Lab compute | 1.58M H100e end-2025 (90% CI 1.0-2.5M) [Epoch] https://epoch.ai/latest/introducing-the-ai-chip-users-explorer ; Jul ≈ 1.0M [D] (back-cast at 2.5×/yr, R15 §1.0) | MSL 1.0M end-2025 (0.6-1.6M) [Epoch]; Jul ≈ 0.6M [D] | MAI-1-preview trained on ~15K H100 (28 Aug 2025) [P-snip] https://www.theregister.com/2025/08/28/microsoft_unveils_housemade_models_amid/ |
| Lab share of parent compute | ~30% (1.58M / ~5M) [D] | — | small [D] |
| Staff | ~6,000 [U] | MSL formed Jun 2025 [mem]; ~600 cut Oct 2025 [U] | MAI Superintelligence Team formed 6 Nov 2025 [U] https://fortune.com/2025/11/06/microsoft-launches-new-ai-humanist-superinteligence-team-mustafa-suleyman-openai/ |
| Model lag | 2.5 mo | 9.5 mo | ~12 mo |
| Distribution | Gemini app >450M MAU (Q2 2025) [P-snip] | Meta AI in apps [mem] | Copilot |
| Revenue | Inside Google Cloud and Search; not separately reported | Inside ads | Inside Azure / M365 |
| Talent | 78% retention [P] SignalFire | Very large offers needed [U] | Acqui-hire of Inflection staff (R17) |
| Safety (FLI, R07 §1.3) | C− | D | — |

### 3.2 How to model the division's money [Design]

- **No equity raises, no bankruptcy, no valuation.** The R15 §1.4-1.5 investor pool is closed to the player.
- **Annual allocation** `A_y` from the parent, paid quarterly. Unspent cash above 1 quarter returns to the parent.
- `A_y = A_0 × g_parent(y) × PC`. `g_parent` follows the parent capex path (Alphabet 52.5 → 91.4 → ~200 in 2024-26,
  R15 §2.7, ≈ 1.9×/yr) [D]. `PC` (parent confidence, 0.5-1.5) rises with model rank vs rivals and product reach, and falls
  with incidents and PR risk.
- `A_0` = **$16B/yr**, the same as the leader's 2025 compute spend in the AI 2027 compute forecast (R11 audit table,
  "$16B / 1M avg") [D]. This keeps the division on par with the leader in money but not in agility.
- **Compute is owned by the parent** and comes in kind. More compute is a request that lands after the parent's 2-4
  quarter build lag (R15 §1.0). Own chips (TPU-like) cost × 0.7 [Design].
- **Revenue** stays with the parent; it counts toward `PC` and gives instant distribution.
- **Failure state:** `PC < 0.5` for 2 quarters → reorg event (Meta Jun 2025; Brain+DeepMind 2023 [mem]): budget cut or
  the player is replaced (soft game over).
- **Board preset (new):** "Parent company". One seat that votes with stance speed +0.5, fin +1.0, safety +0.2,
  mission 0. It vetoes deals with the parent's competitors (R15 §1.6 strategic-seat rule) [Design].

### 3.3 Proposed values

| Field | Range | Default | Basis |
|---|---|---|---|
| Cash | allocation | **$4B on hand + $16B/yr allocation** | [D], [Design] |
| Board | parent | **Parent company** (new preset) | [Design] |
| Staff | 2,000-6,000 | **4,000** | GDM ~6,000 [U]; Meta and Microsoft smaller [D] |
| Compute | 0.5-1.2M | **0.8M owned, 0 rented** | [Epoch][D] |
| Model lag | 2.5-12 mo | **6 mo** | §0.1 spread |
| Revenue run-rate | n/a | **$0 to cash; ~$4B attributed** for `PC` | [Design] |
| Talent pull | — | **−10**; star hire cost ×1.5 | SignalFire, [U] Meta offers |
| Speed | — | Launch/approval lag +30 d (R07 §1.3 Big Tech preset) | R07 |

---

## 4. Frontier leader (V2-SPEC §3.7.2, verified)

| Item | V2-SPEC (classic / reality) | Real OpenAI, mid-2025 | Verdict |
|---|---|---|---|
| Cash | $40B / $45B | ~$7.6B end-2024 [U] https://www.finimize.com/content/softbanks-openai-paper-gains-are-here-cash-questions-remain + first ~$10B SoftBank tranche Apr 2025 [U] ⇒ ~$15-20B on hand [D]; $40B round committed, $30B conditional on recap (R15 §2.9 [P]) | **Keep, but label it "cash + committed round"**. A strict cash value would be ~$18B plus a conditional $30B tranche on the recap path. |
| Revenue run-rate | $12B / $13B | $10B ARR, Jun 2025 (excludes Microsoft licensing) [U] https://www.nbcsandiego.com/news/business/money-report/openai-hits-10-billion-in-annual-recurring-revenue-fueled-by-chatgpt-growth/3843568/ | Keep (within 25%) |
| Compute | 1.2M / 1.0M (0.5M owned + 0.7M cloud) | 386K end-2024 → 1.74M end-2025 (CI 1.25-2.19M) [Epoch]; Jul ≈ 0.82M [D]; AI 2027 "avg 1M in 2025" (R11) | Keep (inside CI). Note: real OpenAI owns ~none; "owned" is a Stargate-style simplification |
| Staff | 2,500 / 3,000 | ~3,000 [U]; no primary | Keep |
| Model lag | 0 | 0 (o3-pro top ECI; GPT-5 internal) [Epoch] | Keep |
| Board | Legacy capped-profit nonprofit (V2 §3.7.2) | Same until 28 Oct 2025 (R15 §2.11) | Keep |
| Talent | — | 67% retention, lowest of the top labs [P] SignalFire | Talent pull **0**; attrition ×1.2 [Design] |
| Safety (FLI) | — | C (R07 §1.3) | — |

---

## 5. Tree nodes known at start (beyond ★)

Evidence from R12 §0.7 and §3 unless a URL is given. "E" = evidence the analogue had it by Jul 2025; "D" = [Design] grant.

| Node | Spinout | Challenger | Big tech | Leader | Evidence |
|---|---|---|---|---|---|
| Native multimodal | — | E | E | E | GPT-4o 2024, Gemini 1.5 (R12 §1); Llama 4 natively multimodal [mem]; Claude image input [mem] |
| Computer use | — | E | E | E | Anthropic computer use Oct 2024, OpenAI CUA Jan 2025 (R12 §0.5); Project Mariner Dec 2024 [mem] |
| Long context + memory | — | E (200K) | E | E | Gemini 1M (R12 §1); ChatGPT memory 2024-25 [mem]; Llama 4 Scout 10M [mem] |
| Multi-agent orchestration | — | E | E | E | Anthropic orchestrator +90% at 15× tokens (R12 §3); Gemini Deep Think May 2025 [mem]; Grok 4 Heavy Jul 2025 [mem] |
| Agents product | — | E | D | E | Claude Code GA May 2025 [P via Series F]; Operator Jan 2025 / ChatGPT agent Jul 2025 [mem] |
| Coding agent | — | E | D | E | Claude Code; Codex May 2025 (R12 §0.6) |
| Deep research | — | E | E | E | OpenAI Feb 2025 (R12 §0.5); Gemini Dec 2024 [mem]; Claude Research Apr 2025 [mem] |
| Voice & vision | — | D | E | E | Advanced Voice, Gemini Live [mem] |
| RL focus: SWE | — | E | — | E | Claude Code, Codex |
| RL focus: math | D (founders' know-how) | — | E | E | AlphaProof (R12 §0.7) |
| Robotics foundation | — | — | E (GDM only) | — | Gemini Robotics Mar 2025 (R12 §3) |
| AI kernels / HW co-design | — | — | E but locked by prereq | — | AlphaEvolve 23% kernel speedup, May 2025 (R12 §0.7); grant as "+1 tier progress" only [Design] |
| CoT monitor | — | — | — | E | OpenAI CoT-monitoring paper Mar 2025 [mem] |
| Linear probes | D (safety flavour) | E (safety flavour) | — | — | Anthropic "simple probes" 2024 [mem] |
| SAE feature search | — | E (safety flavour) | E | — | Anthropic Scaling Monosemanticity 2024 [mem]; Gemma Scope 2024 [mem] |
| Circuit tracing | — | D (safety flavour, 50% progress) | — | — | Anthropic attribution graphs Mar 2025 [mem] |

Rule [Design]: a type gets a node if most analogues had it; single-analogue nodes come as a flavour choice.

---

## 6. Game-ready table

| Start type | Cash | Board | Staff (total) | Compute owned / rented (H100e) | Model lag (mo) | Revenue run-rate | Products live | Extra known nodes | Notable modifiers |
|---|---|---|---|---|---|---|---|---|---|
| **Well-funded spinout** | $3B | Founder-controlled, 1 financial seat | 110 | 0 / 25K | none own; open-weight base at 6.5 | $0 | none | RL focus: math; flavour: Linear probes | Talent pull +20; star cost ×0.7; +1 science project slot; investors patient (no plan-miss BC hit for 4 q) |
| **Challenger lab** | $8B | Founder corp + 2 financial seats + strategic observer (flavour: PBC+LTBT) | 1,300 | 100K / 300K | 3 | $3B | Chat, API, Enterprise, Coding agent | Native multimodal, Computer use, Long context, Multi-agent, Agents product, Coding agent, Deep research, RL focus: SWE; safety flavour: Linear probes, SAE | Talent pull +10; next raise available in Q1 (Series F analogue) |
| **Big-tech AI division** | $4B + $16B/yr allocation | Parent company (new preset) | 4,000 | 800K / 0 | 6 | $0 to cash (~$4B attributed) | Chat (large user base), API, Enterprise, Voice & vision | Native multimodal, Computer use, Long context, Multi-agent, Deep research, Voice & vision, RL focus: math; flavour: Robotics foundation or SAE | Talent pull −10; star cost ×1.5; approval lag +30 d; chips ×0.7; no equity, no bankruptcy; reorg at PC < 0.5 |
| **Frontier leader** | $40B (classic) / $45B (reality) | Legacy capped-profit nonprofit | 2,500 / 3,000 | 500K / 700K (reality 1.0M total) | 0 | $12B / $13B | Chat, API, Enterprise, Agents, Coding agent, Deep research, Voice & vision | All challenger nodes + Voice & vision, CoT monitor | Talent pull 0; attrition ×1.2; commitments per V2 §3.7.2 |

Internal consistency [D]: cash ratio across the four ≈ 1 : 2.7 : 1.3 (plus allocation) : 14; compute ≈ 0.02 : 0.33 : 0.67 : 1;
staff ≈ 0.04 : 0.4 : 1.3 : 1. The leader matches V2-SPEC §3.7.2.

---

## 7. Feel and balance

| Type | Strengths | Weaknesses |
|---|---|---|
| Spinout | Elite taste, cheap stars, patient founder control, clean safety slate | No compute, revenue or product; one bad run burns the raise |
| Challenger | Near frontier, live revenue | Must raise every ~12 months; investor board pushes speed |
| Big tech | Compute and distribution; cannot go broke | Slow approvals, weak talent pull, budget hostage to the parent |
| Leader | Everything, now | Fragile nonprofit board, largest commitments, every rival targets you |

**Balance risks**
1. **Spinout never catches up.** Real spinouts sit 9-12 mo behind after 12-17 mo (§0.2); with AI 2027 pacing (SC
   ~Mar 2027) that is too late. Mitigations [Design]: open-weight base from day 1 (Tinker-like revenue by month 3);
   milestone raises at high multiples (TML $2B at $12B, no product); acqui-hire as a scored ending; scoring on safety
   outcomes, not only rank.
2. **Big tech dominates if the allocation ignores performance.** $16B/yr plus 0.8M owned beats the challenger
   outright. `PC` must bite.
3. **Challenger is "leader-lite".** Give it a distinct verb: strategic compute-for-equity deals (R15 §2.11) from day 1.
4. **Leader cash** counts a committed round (§4). To make finance bind early: ~$18B cash plus a $30B tranche conditional
   on the recap event (R15 §1.6).
5. **ECI is an aggregate.** A challenger 3 mo behind on ECI may lead in coding; per-domain start offsets (e.g. CODE
   +0.3) would be more honest [Design].

**Biggest uncertainties:** Jul 2025 cash for every private lab (no primary data; derived from burn); mid-2025 lab compute
(Epoch publishes year-end only; mid-year is a geometric back-cast); all headcounts are tracker/press figures; big-tech
division budgets are not disclosed by any parent.
