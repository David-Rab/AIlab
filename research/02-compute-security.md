# 02 - AI 2027 Compute Forecast and Security Forecast: Game-Ready Extraction

Sources: AI 2027 research supplements by Romeo Dean (AI Futures Project), April 2025, plus the linked Google Sheets and the main scenario (ai-2027.com). Retrieved 2026-11-11.

**How these numbers were extracted:** the pages were read with a fetch tool that paraphrases rather than giving raw HTML. Tables were pulled cell by cell, and the key tables were fetched twice and matched both times. Quotes are short excerpts that the fetch tool returned. Check them against the live page before printing any quote in the game.

**Labels used throughout:**
- **[AI27]**: stated by AI 2027.
- **[AI27-fig]**: read from a figure or chart label.
- **[AI27-sheet]**: from a linked spreadsheet.
- **[Derived]**: my own arithmetic or interpretation.
- **[Design]**: a game-design suggestion that AI 2027 does not state.
- **[!]**: the source is internally inconsistent.

---

## PART 1 - GAME-READY PARAMETERS

### 1.1 Global AI compute (stock and production)

The unit is H100e (H100-equivalents), measured by TPP (total processing performance). One H100 is about 1e15 dense FP16 FLOP/s.

| Parameter | Value | Unit | Year | Source |
|---|---|---|---|---|
| Global AI compute stock | 10M | H100e | Mar 2025 | [AI27] Summary/Fig: "Mar 2025 10M H100e" |
| Global AI compute stock | 100M | H100e | Dec 2027 | [AI27] "grow by a factor of 10x by December 2027" |
| Global compute growth rate | 2.25x | per year | 2025-2027 | [AI27] Summary, Sec 5 |
| Chip efficiency (FLOP per chip-area) growth | 1.35x | per year | 2023-2027 | [AI27] Sec 1 |
| Chip production (area) growth | 1.65x | per year | 2025-2027 | [AI27] Sec 1 |
| Chip production growth after 2027 (wafer-limited) | ~1.25x | per year | 2028+ | [AI27] "slow the growth rate of chip production from 1.65x to around 1.25x" |
| Cumulative H100e available (end of year) | 4M / 8.5M / 18M / 40M / 100M | H100e | 2023 / 24 / 25 / 26 / 27 | [AI27] Sec 1 table |
| AI chips produced in year | 2M / 5M / 11M / 25M / 60M | H100e | 2023 / 24 / 25 / 26 / 27 | [AI27] Sec 1 table |
| Chip area produced (H100-sized = 1) | 3M / 5.5M / 9M / 16M / 25M | chips | 2023-27 | [AI27] Sec 1 table |
| Performance-density multiplier of average chip (H100 = 1) | 0.66 / 0.9 / 1.22 / 1.64 / 2.4 | x | 2023-27 | [AI27] Sec 1 table |
| Pre-2023 H100e stock | ~2M | H100e | pre-2023 | [AI27] fn 10 |
| Chip useful life | ~4 | years | all | [AI27] fn 9 |
| Nvidia share of AI compute | ~60% | % | 2023-24 | [AI27] Sec 1 |
| AI share of TSMC N5/N3 wafer capacity | ≤3% (2023), max ~40% by 2027 | % | 2023 / 2027 | [AI27] Sec 1 |
| Fab capacity expansion | ~15% | per year | 2025-27 | [AI27] Sec 1 |
| Advanced packaging (CoWoS) raw growth | 2x (1.65x after 1.2x difficulty adjustment) | per year | 2025-27 | [AI27] Sec 1 |
| HBM raw growth | 2x (1.65x adjusted) | per year | 2025-27 | [AI27] Sec 1 |
| Main bottlenecks | advanced packaging and HBM | - | 2025-27 | [AI27] |

**Post-2027 extension (no AI27 numbers on the page).** The page gives no 2028-2030 H100e figures. The stated parts are about 1.25x per year chip production and the 1.35x per year efficiency trend [AI27 trend; continuing it is an assumption]. Together these imply global H100e production growing about 1.69x per year after 2027 [Derived].

The linked spreadsheet ([V2], which looks like an earlier version) has a 2021-2030 model, but its values differ from the page:

| Spreadsheet row [AI27-sheet] | 2027 | 2028 | 2029 | 2030 |
|---|---|---|---|---|
| Total FP16 FLOP/s produced | 1.25e23 | 1.89e23 | 5.50e23 | 9.22e23 |
| AI datacenter power demand | 77 GW | 158 GW | 217 GW | 435 GW |
| AI chip market size | $695B | $1,053B | $1,835B | $3,073B |
| Share of ≤5nm wafers going to AI chips | 34% | 40% | 73% | 99.5% |

[!] 1.25e23 FLOP/s is about 125M H100e produced in 2027. The page says 60M. Use the page for 2025-2027. Use the sheet only as a loose upper envelope for 2028-2030.

### 1.2 Compute distribution (who owns and uses it)

| Parameter | Value | Unit | Year | Source |
|---|---|---|---|---|
| Top 2-3 leading AI companies, share of global compute | 5-10% → 15-20% | % | 2024 → end 2027 | [AI27] Summary |
| Leading company compute | ~500K → 15-20M | H100e | 2024 → end 2027 | [AI27] Summary |
| Leading company share growth | 1.4x | per year | 2024-27 | [AI27] Sec 5 |
| Leading company as *owner* (its own capex) | ~6% of world compute for ~$90B | % | 2027 | [AI27] Sec 2 "with about $90B of spending they will ... acquire around 6%" |
| OpenBrain-analog (OpenAI) as *end user* | 5% → 20% (~20M H100e) | % | Dec 2024 → Dec 2027 | [AI27-fig] Sec 2 end-user chart |
| Anthropic end-user share | 4% → 14% | % | 2024 → 2027 | [AI27-fig] |
| Google AGI end-user share | 6% → 16% | % | 2024 → 2027 | [AI27-fig] |
| xAI end-user share | 2% → 9% | % | 2024 → 2027 | [AI27-fig] |
| Meta AGI end-user share | 4% → 6% | % | 2024 → 2027 | [AI27-fig] |
| China AGI end-user share | 2% (or 3%) → 12% (~10-12M H100e) | % | 2024 → 2027 | [AI27-fig] [!] 2% vs 3%; the chart shows ~10M, the text implies 12M |
| Rest of US / Rest of world end-user share | 23% → 11% / 18% → 11% | % | 2024 → 2027 | [AI27-fig] |
| China share of global compute (all uses) | ~12% (roughly constant); 14% total usage in 2024 | % | 2024-2027 | [AI27] Summary/Fig 3 |
| China Big Four owner share | 9% (0.8M) → 8% (8M) | % (H100e) | 2024 → 2027 | [AI27] Sec 2 |
| China's share of its own compute dedicated to AGI | 20% or 40% → 90% | % | 2024 → 2027 | [AI27] [!] two values given for 2024 |
| Chinese domestic chips | ~3 years behind Nvidia | quality lag | - | [AI27] Sec 2 |
| Owner shares (Dec 2027): MSFT / GOOG / AMZN / Meta / xAI / rest of US / China / rest of world | 18 / 18 / 18 / 9 / 9 / 9 / 8 / 5 | % | 2027 | [AI27-fig] Sec 2 |
| **Scenario:** China share of world compute | ~12% | % | mid 2026 | [AI27] scenario |
| **Scenario:** share of China's compute working for the DeepCent-led collective | ~50%; >80% of new chips go to the CDZ | % | mid 2026 | [AI27] scenario |
| **Scenario:** China compute in the CDZ | 40% (chart shows it rising toward 70%) | % | Feb 2027 | [AI27] scenario |
| **Scenario:** OpenBrain / DeepCent / all US companies, share of world compute | 20% / 10% / 70% | % | Aug 2027 | [AI27] scenario |

### 1.3 Leading company (OpenBrain) compute by use

All values below are [AI27] Section 3, from the table for the leading company.

| Row | 2024 | 2025 | 2026 | Q1'27 | Q2'27 | Q3'27 | Q4'27 |
|---|---|---|---|---|---|---|---|
| Average compute (H100e) | 250K | 1M | 4M | 7M | 9M | 12M | 15M |
| Compute spending (per period) | $5.4B | $12.5B | $30B | $20B | $25B | $30B | $45B |
| Compute budget (FP16 FLOP, 30% utilization) | 2.5e27 | 1e28 | 4e28 | 2e28 | 2.5e28 | 3e28 | 4e28 |
| Training (total) | 40% | 40% | 40% | 30% | 27% | 22% | 20% |
| ... of which pre-training | 60% | 50% | 40% | 10% | 8% | 5% | 5% |
| ... of which post-training | 40% | 50% | 60% | 90% | 92% | 95% | 95% |
| Synthetic data generation | 20% | 20% | 20% | 27% | 23% | 22% | 22% |
| Research experiments | 4% | 5% | 6% | 14% | 21% | 28% | 35% |
| Research automation (running AI researchers) | 1% | 3% | 4% | 6% | 6% | 6% | 6% |
| Total internal | 25% | 28% | 30% | 47% | 51% | 57% | 63% |
| ... capabilities share of internal | 95% | 96% | 97% | 97% | 97% | 97% | 97% |
| ... alignment share of internal | 5% | 4% | 3% | 3% | 3% | 3% | 3% |
| External deployment (product inference) | 33% | 30% | 28% | 20% | 19% | 18% | 13% |
| Monitoring | 2% | 2% | 2% | 3% | 3% | 3% | 4% |

Notes on this table:
- The top-level rows sum to 100%: Training + Synthetic + Experiments + Automation + External + Monitoring [Derived check]. "Total internal" is the sum of Synthetic, Experiments and Automation. Capabilities and alignment split "Total internal".
- **Alignment compute** = alignment share × total internal. That is 1.25% of all compute in 2024 and about 1.9% in Q4 2027 [Derived]. This is the baseline "racing" allocation. It is a natural default for the player's alignment slider.
- Monitoring math [AI27]: the monitor model is about 10x cheaper and checks about half of all tokens, so monitoring compute = (inference compute) / 20.
- External deployment grows from 75K H100s (2024) to 2M (2027) [AI27]. Inference utilization is about 10% [AI27].
- 2024 detail [AI27]:
  - Pretraining was about 3e26 FP16 FLOP (100K H100s for 4 months).
  - RL used 100K H100s for 2.5 months.
  - Synthetic data used 50K H100s, about 2.5e26 FLOP and 35T tokens, at a ratio of 16 forward passes per high-quality token.
  - Experiments used 10K H100s (about 1e26 FLOP).
  - Research automation used 1K H100s (2e25 FP8 FLOP). That is about 800K tokens per day per employee across 1,000 employees.
- Experiment compute exceeds 2e28 FP16 FLOP in 2027 [AI27].
- Model FLOP utilization [AI27 fn 6/28]: about 40% generally, 35% for pretraining, 20% for post-training. The budget row uses 30%.

### 1.4 Training runs (OpenBrain)

[AI27] Section 5:

| Model | Training period | Global compute (H100e) | OpenBrain share of global | Share of internal compute on training | Training compute (FLOP) |
|---|---|---|---|---|---|
| GPT-4 (reference) | 2022 | - | - | - | 2e25 |
| Agent-0 | Oct 2024 - May 2025 | 10M | 6% | 40% | 1e27 |
| Agent-1 | Jul 2025 - Feb 2026 | 18M | 9% | 40% | 4e27 |
| Agent-2 | Apr 2026 - Mar 2027 | 38M | 14% | 36% | 2e28 |
| Agent-3 | Mar 2027 - Aug 2027 | 60M | 16% | 24% | +1e28 (additional) |
| Agent-4 | Aug 2027 - Dec 2027 | 80M | 18% | 20% | +1e28 (additional) |

Other training figures:
- Scenario [AI27]: GPT-3 is about 3e23 FLOP. New datacenters allow a 1e28 FLOP run, "a thousand times more than GPT-4".
- Frontier model size in early 2027 [AI27 Sec 4]: about 10T dense-equivalent parameters. That is roughly √1000 × GPT-4o's ~200B active parameters (fn 46). It shrinks to 5T (Q3) and then 2T (Q4) through distillation and efficiency.
- Frontier weight sizes at fp8 [AI27 Security appendix]: 1TB (Dec 2024), 4TB (Dec 2025), 8TB (Dec 2026), 10TB (Apr 2027), 8TB (Aug 2027), 5TB (Dec 2027).
- The scenario's Agent-2 checkpoint is "~3 TB" [AI27 scenario]. [!] This does not match the 8-10TB in the security table.

### 1.5 AI researcher copies and speed (research automation)

| Parameter | Q1'27 | Q2'27 | Q3'27 | Q4'27 | Source |
|---|---|---|---|---|---|
| Share of compute on research automation | 6% | 6% | 6% | 6% | [AI27] Sec 4 |
| Compute budget (H100e) | 400K | 600K | 800K | 1M | [AI27] |
| Inference chips (2027-IC) | 4K | 6K | 8K | 10K | [AI27] |
| Bandwidth budget (H100-Be) | 800K | 1.2M | 1.6M | 2M | [AI27] |
| Parallel copies | 300K | 400K | 500K | 600K | [AI27] |
| Average speed (tokens or forward passes per second per copy) | 230 | 290 | 360 | 430 | [AI27] |
| Model size (dense-equivalent parameters) | 10T | 10T | 5T | 2T | [AI27] |
| AI R&D progress multiplier | 4x | 10x | 50x | 2000x | [AI27] |
| Milestone | Superhuman Coder | Superhuman Coder | Superhuman AI Researcher | ASI | [AI27] |

Conversion constants:
- Human thinking speed is 10 words/s [AI27 Fig 18/19 legend]. The speed multiple is roughly tok/s ÷ 10, assuming 1 token ≈ 1 word [Derived]. The summary equates "50x" with "500 words per second".
- Average over 2027: about 300K copies at about 20x human speed [AI27 Sec 4]. [!] The table values work out to about 23-43x.
- Summary headline: "about 1M copies of superintelligent AIs at 50x human thinking speed" using 6% of compute [AI27]. [!] This exceeds the table's maximum of 600K copies.

Scenario figures [AI27 scenario]:
- Mar 2027: 200K Agent-3 copies, equal to 50K human coders at 30x speed. Algorithmic progress is 4x.
- Jun 2027: 250K Agent-3 copies on about 6% of compute, with 25% of compute on experiments. The AI R&D multiplier is 10x.
- Aug 2027: the US multiplier is 25x and China's is 10x.
- Sep 2027: 300K Agent-4 copies at about 50x human speed. Algorithmic progress is about 50x.

**Inference hardware [AI27 Sec 4]:**

| Chip | Bandwidth (TB/s) | H100-Be | Memory | Peak use | Cost |
|---|---|---|---|---|---|
| H100 | 3.6 | 1 | 90 GB HBM3 | 2023-24 | $40K |
| H200 | 4.8 | 1.3 | 141 GB | 2024-25 | $40K |
| B200 | 8 | 2.2 | 192 GB | 2025-26 | $50K |
| R200 Ultra | 19.2 | 5.3 | 768 GB HBM4 | 2027 | $100K |
| R300 Ultra | 25.6 | 7.1 | 1 TB | 2027-28 | $120K |
| Cerebras WSE-3 | 21,000 (SRAM) | 5,800 | 44 GB | 2025-26 | $2-3M |
| WSE-2027 | 34,000 (SRAM) | 9,500 | 72 GB | 2027-28 | $3-4M |
| **2027-IC (in-house inference chip)** | 720 | 200 | 17.8 TB HBM4e (16 TB available) | 2027 | $600K cost of ownership (~$400K to manufacture) |

The 2027-IC is rated at about 100 H100e of compute.

Copies-versus-speed tradeoff on 1 chip (2027-IC) with a 10T-parameter model [AI27 Sec 4 / fn 49-52]:
- Maximum batch is 440, which gives 440 copies per chip at 45 tok/s (16 TB read per token step).
- Serial extreme: batch 10 spread over 10 chips gives 1,000 copies per 1K chips at about 1,350 tok/s (5.3 TB per token step).

Raw calculation sheet [AI27-sheet 2], Q1 2027 with 4,000 chips and a 10T model. Each pair below is (copies, tok/s): (1.7K, 3,291), (25K, 922), (100K, 576), (267K, 288), (300K, 230), (880K, 107), (1.2M, 82), (1.6M, 58), (1.76M, 45).

### 1.6 Costs, capex, revenue, power

| Parameter | Value | Unit | Year | Source |
|---|---|---|---|---|
| Total cost of ownership per H100e (for chips produced that year) | $50K / $40K / $25K / $20K / $15K | $ | 2023 / 24 / 25 / 26 / 27 | [AI27] Sec 1 table |
| Total AI datacenter spending (global) | $110B / $270B / $400B / $600B / $1T | $ | 2023-27 | [AI27] Sec 1 table |
| Global AI capex | $1T (2026), $2T (2027) | $ | 2026 / 2027 | [AI27] scenario 2026 box; compute forecast Fig 8 |
| OpenBrain capex | $200B (2026); $400B (2027, "total capital expenditure") | $ | 2026 / 2027 | [AI27] scenario box / Fig 8 (my attribution of the 2027 figure to OpenBrain is uncertain) |
| Hyperscaler $/H100e (2024): MSFT / AMZN / GOOG / Meta / xAI | $39K / $37K / $22K / $36K / $37K | $ | 2024 | [AI27] Sec 2 |
| Hyperscaler $/H100e (2025) | $20-23K | $ | 2025 | [AI27] Sec 2 |
| AI server spend 2025: MSFT / AMZN / GOOG / Meta / xAI | $56B / $48B / $44B / $35B / $30B, adding 2.4M / 2.2M / 2.2M / 1.6M / 1.3M H100e | $ | 2025 | [AI27] Sec 2 |
| FLOP/$ improvement | ~1.4x | per year | trend | [AI27] Sec 5, fn 55 |
| OpenBrain revenue (text table) | $1B / $4B / $14B / $45B / $140B | $/yr | 2023-27 | [AI27] Sec 5 |
| OpenBrain revenue (Fig 22) | $4B / $14B / $50B / $150B | $/yr | 2024-27 | [AI27-fig] [!] |
| OpenBrain compute cost (text table) | $1.8B / $6B / $16B / $40B / $100B | $/yr | 2023-27 | [AI27] |
| OpenBrain compute cost (Fig 22) | $6B / $20B / $50B / $120B | $/yr | 2024-27 | [AI27-fig] [!] |
| Revenue growth and cost growth | ~3x each | per year | 2024-27 | [AI27] Summary |
| Revenue run-rate | $50B annualized | $ | end 2026 | [AI27] Sec 2 |
| Scenario 2026 box: OpenBrain revenue / compute cost | $35B / $40B | $/yr | 2026 | [AI27] scenario [!] differs from the supplement |
| FutureSearch projection | ~$100B revenue | $ | mid 2027 | [AI27] Sec 5 |
| Datacenter power per H100e | 1.3 kW / 1.0 kW / 750 W / 700 W / 550 W | W | 2023-27 | [AI27] Sec 1 |
| Chip power: H100 / B200 / R200 | 1000 W / 1700 W / ~3300 W (efficiency 1.0 / 1.47 / 1.81) | W | - | [AI27] Sec 5 |
| Global AI datacenter power | 5 / 9 (or 10) / 15 / 29 / 62 (or 60) | GW | 2023-27 | [AI27] Sec 1 table / Fig 23 |
| US AI power | 7 → 50 | GW | Dec 2024 → Dec 2027 | [AI27-fig] |
| Leading company power | 0.5 → 6 (2026 scenario) → 10 | GW | 2024 / 2026 / 2027 | [AI27] |
| AI share of US power | 0.5% → 2.5% (2026, 33 GW of 1.34 TW) → 3.5% (50 GW of 1.35 TW) | % | 2024-27 | [AI27] |
| Power efficiency trend | 1.26x | per year | - | [AI27] fn 13 (Epoch) |

Derived cost per H100e-year for OpenBrain (spending ÷ average H100e) [Derived]:

| Year | Cost per H100e-year |
|---|---|
| 2024 | ~$21.6K |
| 2025 | ~$12.5K |
| 2026 | ~$7.5K |
| 2027 (quarterly figures annualized) | ~$11-12K |

[!] These values move unevenly. A smoothed game value is about $10-15K per H100e-year in 2025-27 [Design].

### 1.7 Security levels (definitions)

The levels are built on RAND's report "Securing AI Model Weights" (RR-A2849-1), which defines attacker tiers OC1-OC5 and security levels SL1-SL5.

| Attacker tier [AI27, from RAND] | Example | Budget | Duration | Team |
|---|---|---|---|---|
| OC1 | amateur or hobbyist | ≤ $1K | several days | - |
| OC2 | professional opportunistic | ≤ $10K | several weeks | - |
| OC3 | cybercrime syndicates; insider threats | ≤ $1M | several months | ~10 |
| OC4 | standard operations by state-level institutions (>100 such operations per year globally) | ≤ $10M | ~1 year | ~100 |
| OC5 | top-priority operations by top nation-states | ≤ $1B | multi-year | ~1,000 "with expertise years ahead" |

The OC1/OC2 descriptions are from RAND and were paraphrased by me.

| Level | Definition [AI27] |
|---|---|
| WSLn (Weights Security Level) | Robustly defends (95% probability) against an OCn actor "specifically trying to steal frontier AI model weights in under 2 months". |
| SSLn (Secrets Security Level) | Robustly defends against an OCn actor trying to steal "10% of the most important 10KB (plaintext)" of recent algorithmic secrets, i.e. 1KB. |
| Privileged-access employee | Has authorized access to ">10% of the top 20 KB" of sensitive information from the past 30 days. |
| Compromised employee | A privileged-access employee actively leaking to the adversary (spy or coerced). |

Bandwidth contrast [AI27]: the exfiltration needed for secrets (~1KB) is "around a million times lower" than for weights (~TBs). Secrets can be "relay[ed] verbally" [scenario]. This is why secrets security lags weights security.

### 1.8 Security trajectories (racing branch)

All values are [AI27] Security appendix.

| Row | Dec 2024 | Dec 2025 | Dec 2026 | Apr 2027 | Aug 2027 | Dec 2027 |
|---|---|---|---|---|---|---|
| Frontier weights size (fp8) | 1TB (2TB in the rounded table) | 4TB | 8TB | 10TB | 8TB | 5TB |
| Exfiltration rate required (TB/month) | 0.5 | 1 | 2.5 | 5 | 4 | 2.5 |
| OpenBrain WSL (continuous) | 2.2 | 2.7 | 3.3 | 3.8 | 4.3 | 5.0 |
| DeepCent WSL (continuous) | 0.5 | 1.2 | 3.4 | 4.2 | 4.6 | 5.0 |
| OpenBrain SSL (continuous) | 1.5 | 2.0 | 2.4 | 3.3 | 3.9 | 5.0 |
| DeepCent SSL (continuous) | 0.3 | 0.8 | 1.5 | 2.7 | 4.4 | 4.8 |
| OpenBrain privileged-access employees | 1000 | 1500 | 2000 | 300 | 200 | 100 |
| OpenBrain compromised employees | 5 | 10 | 20 | 3 | 1 | 0 |
| DeepCent privileged-access employees | 200 | 1000 [!] | 400 | 300 | 200 | 100 |
| DeepCent compromised employees | 0 | 10 | 3 | 1 | 0 | 0 |

The rounded tables are also given:
- OpenBrain WSL: 2, 2, 3, 3, 4, 5. DeepCent WSL: 0, 1, 3, 4, 4, 5.
- OpenBrain SSL: 1, 2, 2, 3, 3, 5. DeepCent SSL: 0, 0, 1, 2, 4, 4.

[!] The exfiltration rates are not simply weight size ÷ 2 months. The page does not explain the calculation.

Other security parameters:

| Parameter | Value | Unit | Year | Source |
|---|---|---|---|---|
| Employees able to interact with weights daily (US startup-level security) | ~1000 | people | 2024-25 | [AI27] |
| Employees with broad access to algorithmic insights | ~1000 | people | 2024-25 | [AI27] |
| OpenBrain headcount | ~3,000 | people | early 2026 | [AI27] scenario |
| US lab / China lab employees | 1000 / 200 | people | 2024 | [AI27] |
| Team growth to 2026 | 2-5x | multiple | 2024-26 | [AI27] |
| Baseline compromise rate (US) | ~0.5%, peaking at 1% in 2026 | % of privileged employees | 2024-26 | [AI27] |
| Compromise rate (China) | peaks at 1% | % | - | [AI27] |
| Cost of an amateur theft of secrets | "$5K bribe to an office cleaner" or targeted phishing | $ | 2024-26 | [AI27] |
| Attacker tier US labs cannot defend secrets against | OC3 (~$1M) | - | through 2026 | [AI27] |
| Privileged-access cut after theft | 10-fold, down to 200, then ~100 by end 2027 | people | 2027 | [AI27] |
| Time from WSL3 to WSL5 with top-priority government effort | ~12 | months | 2027 | [AI27] |
| SSL5 | 3-6 more months of effort; reached in 2028 | months | 2028 | [AI27] |
| USG detection of a weights theft | within 4 weeks (workshop poll: 46.9% "within a month") | time | Feb 2027 | [AI27] fn 9 |
| China reaches WSL5 | a few months before the US | - | late 2027 | [AI27] |
| China briefly ahead of the US on SSL | - | - | 2027 | [AI27] |
| Last Chinese spy at OpenBrain removed | Aug 2027 (scenario: caught by wiretapping) | date | 2027 | [AI27] (the page has a "May 2027" item for China's side) |
| WSL3 main challenge | restricting high-bandwidth connections out of datacenters; insider threats (OC3) | - | - | [AI27] |
| Polls (2024 workshop, N≈27-30) | 78% agree a state actor steals US frontier weights before 2030. 63% agree no company reaches SL5 voluntarily. 22% agree SL5 is possible in <6 months even with >$100B of government priority. | % | - | [AI27] appendix |
| Polls (2025, N=10) | 51% chance that 200 top researchers in a US government project include a spy (31.7% for a Chinese project). 32.8% chance of intervention within 6 months. 41.5% chance a Stargate-size cluster meets SL5 before 2028. | % | - | [AI27] appendix |

### 1.9 Cyber offense, sabotage, loss of control

All values are [AI27] Security appendix.

| Row | Dec 2024 | Dec 2025 | Dec 2026 | Apr 2027 | Aug 2027 | Dec 2027 |
|---|---|---|---|---|---|---|
| OpenBrain Cybench score | 40% | 80% | 100% | - | - | - |
| OpenBrain hacking horizon | 10 min | 50 min | 5 h | 24 h | 400 h | 200,000 h |
| OpenBrain AI R&D multiplier | 1.05 | 1.3 | 2 | 5 | 25 | 1000 |
| OpenBrain top-hacker equivalents (8 h tasks) | <1 | 1 | 3 | 15 | 250 | 100,000 |
| OpenBrain top-hacker equivalents (200 h tasks) | <1 | <1 | <1 | <1 | 10 | 6,000 |
| DeepCent Cybench score | 35% | 50% | 90% | - | - | - |
| DeepCent hacking horizon | 6 min | 12 min | 2 h | 10 h | 100 h | 4,000 h |
| DeepCent AI R&D multiplier | 1.02 | 1.15 | 1.5 | 4 | 10 | 200 |
| DeepCent top-hacker equivalents (8 h tasks) | <1 | <1 | 2 | 15 | 60 | 5,000 |
| DeepCent top-hacker equivalents (200 h tasks) | <1 | <1 | <1 | <1 | 3 | 200 |
| Slowdown DeepCent inflicts on OpenBrain (sabotage) | <1% | <1% | 2% | 3% | 10% | 40% |
| Slowdown OpenBrain inflicts on DeepCent (sabotage) | <1% | <1% | 1% | 2% | 3% | 5% |
| OpenBrain AI: partial subversion probability | <1% | <1% | 1% | 5% | 30% | 80% |
| OpenBrain AI: full subversion probability | <1% | <1% | <1% | 3% | 10% | 50% |
| OpenBrain AI: self-exfiltration probability | <1% | <1% | <1% | 1% | 4% | 30% |
| DeepCent AI: partial / full / self-exfiltration | <1% each | <1% each | <1% each | 5 / 2 / 1% | 15 / 4 / 2% | 50 / 20 / 10% |

Thresholds and conversions [AI27]:
- A hacking-horizon advantage of about 10-50x is needed for roughly a 33% sabotage slowdown.
- Partial subversion and self-exfiltration need roughly a 1-year (~3,000 h) hacking horizon. OpenBrain reaches it around Oct 2027 and DeepCent around Dec 2027.
- WSL5 security cuts self-exfiltration probability: a raw 50% capability becomes 10% after adjustment.
- Human time budgets used: an 8 h workday and a 200 h work month.

[!] "Sabotage success" in these rows is the fraction of the other side's AI R&D multiplier increase that the attacker prevents. The rows are labeled "slowdown" in the source.

---

### 1.10 Suggested engine formulas

Everything in this section is [Derived] or [Design] unless a line says it is anchored to AI27. Time `t` is in years (decimal) from 2025.0.

**F1. Global AI compute stock** (calibrated to AI27 anchors):
- Piecewise log-linear interpolation through these end-of-year values [AI27 Sec 1]: 2023: 4M, 2024: 8.5M, 2025: 18M, 2026: 40M, 2027: 100M. The Mar 2025 value of 10M fits well enough.
- Smooth version: `G(t) = 18e6 * 2.25^(t - 1.0)` H100e for 2025-2027. Here t = 1.0 is end 2025 and t = 3.0 is end 2027, which gives 91M against AI27's 100M. The year-to-year steps are actually 2.1x, 2.2x and 2.5x.
- After 2027: `production(y) = 60e6 * (1.25 * 1.35)^(y - 2027)`. The 1.25x is AI27's production rate and continuing the 1.35x efficiency trend is my assumption. Stock is the sum of production over the trailing 4 years (fn 9 chip lifetime). This gives roughly 101M H100e produced in 2028, 172M in 2029 and 290M in 2030 [Derived; not AI27].

**F2. OpenBrain compute**: `C_OB(t) = s_OB(t) * G(t)`.
- s_OB comes from the training-run table: 6% (early 2025), 9% (late 2025), 14% (2026), 16% (mid 2027), 18-20% (end 2027). That is about 1.4x per year [AI27].
- In the game, `s_OB` should respond to player capex. A useful anchor: 2025 hyperscalers bought H100e at about $20-23K each [AI27].
- Use about 0.55-0.75 kW per H100e of datacenter power [AI27], and an operating cost of about $10-15K per H100e-year [Derived].

**F3. FLOP budget**: `FLOP_per_year = H100e * 1e15 * u * 3.15e7`.
- At u = 0.3 this is about 9.5e21 FLOP per H100e-year. It reproduces AI27's 250K → 2.5e27 [Derived check].
- Training-run FLOP = `FLOP_per_year * training_share * pretrain_or_posttrain_share * duration`.

**F4. Allocation**: player sliders replace the AI27 Section 3 shares. Default to AI27's racing values (1.3):
- Training: 40% → 20%
- Synthetic data: 20-27%
- Experiments: 4% → 35%
- Research automation: 1-6%
- External deployment: 33% → 13%
- Monitoring = external deployment ÷ 20 (rising to 2-4% in total)
- Alignment: 3-5% of internal

**F5. AI researcher copies and speed** (anchored to Sec 4):
- `throughput_tok_s = BW_H100Be * k`. Here BW_H100Be is the bandwidth budget for research automation, and k is about 85-130 tok/s per H100-Be at maximum parallelism for 10T → 2T models.
- `copies = throughput / speed`. The player's "serial vs parallel" slider picks a speed.
- The efficiency penalty for serial speed follows the sheet curve. A simple fit is `copies ≈ copies_ref * (speed_ref / speed)^1.3`, with copies_ref = 300K and speed_ref = 230 for Q1 2027. It is roughly 1.1 below 300 tok/s and roughly 1.8 above.
- `human_speed_multiple = speed / 10`.

**F6. Revenue**: `Rev(y) = 4e9 * 3^(y - 2024)` per year as the AI27 baseline: about $12B (2025), $36B (2026), $108B (2027). AI27's table is $14B / $45B / $140B, so use the table as the target. In the game, make revenue scale with external-deployment compute × model capability [Design].

**F7. Weight theft hazard** [Design, anchored on AI27 definitions]:
- AI27 states that a WSL n defense holds against an OC n attacker with 95% probability over a 2-month campaign. That means a 2-month success probability of p = 0.05 when the attacker's level a equals the security level s.
- Proposed form: `P_2mo(a, s) = 1 / (1 + 19 * 6^(s - a))`. This gives:
  - 0.05 at a = s
  - ~0.24 at a = s + 1
  - ~0.65 at a = s + 2
  - ~0.009 at a = s - 1

  The factor of 6 per level is a designer choice. AI27 gives no numbers for mismatched levels.
- Daily hazard: `h = -ln(1 - P_2mo) / 61`.
- Attacker level `a` for China: about OC4 before mid 2026 and OC5 once the CCP makes theft a priority (mid 2026, the "China Wakes Up" event). Give a bonus of about +0.5 per compromised insider with admin access [Design]. AI27 says the Feb 2027 theft used "a friendly, coerced, or unwitting insider with admin credentials".
- Calibration check: OpenBrain is at WSL 3.3-3.8 in Dec 2026 - Apr 2027, and China at a = 5 with an insider (~5.5). That gives P_2mo of about 0.65-0.8, so the theft lands around Feb 2027 as in the scenario [Derived check].
- Theft feasibility gate: the weights must leave at least at the "exfiltration rate required" (0.5-5 TB/month), or in the scenario's burst mode, ~25 servers × ~100 GB at under 1 GB/s each, finished in under 2 hours. Raising WSL can be framed as lowering the egress cap below this rate [Design; AI27 says WSL3's main challenge is "restricting high bandwidth internet connections exiting datacenters"].
- Detection: P(the US government learns within 4 weeks) is high [AI27]. In the scenario an Agent-1 traffic monitor caught the transfer immediately. Tie detection probability to the monitoring compute share [Design].

**F8. Algorithmic secret leakage** [Design, anchored on AI27]:
- `E[spies] = N_priv * r`, with r = 0.5% baseline rising to 1% under adversary priority. This reproduces AI27's 1000 → 5 and 2000 → 20 [Derived check].
- `P(at least one spy) = 1 - (1 - r)^N_priv`. For N = 200 and r = 0.5% that is about 63%. (AI27's 2025 poll estimate is 51% for 200 researchers.)
- While SSL is at most 2, or while any spy is present: China's algorithmic efficiency moves toward OpenBrain's with a lag of a few weeks. A suggested rate is `leak_fraction_per_week = 1 - exp(-0.1 * spies)` of the OpenBrain-DeepCent algorithmic gap, capped by SSL [Design]. AI27 does not give this rate. Its qualitative anchors are: China stays about 6 months behind until the theft; amateur attacks succeed below SSL3; and China receives Agent-3's "capabilities and design" before its last spy is caught (Aug 2027).
- Cutting privileged access (2000 → 300 → 100) has costs [Design]: a research-speed penalty, and talent loss, since the scenario has clearances sidelining or firing some staff. AI27 implies the cut but gives no penalty number.

**F9. Security level progression** [Design, anchored on AI27 timings]:
- Natural drift (no special effort) is about +0.5 WSL per year: 2.2 → 2.7 → 3.3 [AI27 trajectory].
- With a "top-priority government effort", WSL3 → WSL5 takes about 12 months (+2 levels per year) [AI27].
- SSL lags WSL by about 0.5-1 level until 2027 [AI27 trajectory].
- Companies don't reach SL5 voluntarily (63% poll). So require government partnership, or an extreme investment, to go above about 4 [Design].
- AI27 gives no dollar costs for each level. The only references are attacker budgets ($1M OC3 to $1B OC5) and the poll's ">$100B" government priority. A suggested cost is about 1-3% of compute plus a fixed $/month per level, and a research-speed penalty of about 5-15% per level above 3 from siloing and air-gaps [Design, not AI27].

**F10. Sabotage and loss of control** [Design]:
- Sabotage slowdown: `slowdown ≈ 0.33 * clamp(log10(HH_att / HH_def) / log10(30), 0, 1.5)`, where HH is the hacking horizon. Anchors: a 10-50x hacking-horizon advantage gives about a 33% slowdown [AI27]. Clamp so that a ~50x advantage gives about 40%, matching Dec 2027 [AI27: 200,000 h vs 4,000 h gives 40%].
- Loss-of-control risks turn on as the hacking horizon approaches about 3,000 h [AI27]. Partial subversion, full subversion and self-exfiltration hazards can be interpolated from the 1.9 table. Scale them down by WSL and by monitoring share; AI27 cuts 50% to 10% at WSL5.

---

## PART 2 - DETAILED NOTES

### 2.1 Compute Forecast (Romeo Dean, April 2025)

**Scope and unit.** The forecast projects AI-relevant compute to Dec 2027.
- "AI-relevant compute" uses export-control-style thresholds: TPP ≥ 4,000 and performance density ≥ 4. The H100 has about 15,800 TPP.
- The unit is H100e.

**Summary claims (quoted):**
- "grow by a factor of 10x by December 2027" (2.25x per year), "from 10M H100e today to 100M H100e".
- Growth decomposition: "chip efficiency 1.35x" times "chip production 1.65x".
- Leading companies: "15-20% share of the globally available AI compute", up from 5-10%.
- Usage in 2027: "a relatively small share (5-10%) used on actually running the AIs". Also "large research experiment compute budgets (35%)" and "Actual training runs and external deployment take up smaller shares (20%)". Synthetic data takes about 20%. Absolute compute is "more than 20x greater than in 2024".
- Deployment: "about 1M copies of superintelligent AIs at 50x human thinking speed" (500 words per second), using about 6% of compute.
- Finance: "revenue and cost growth rates to both be around 3x/year".
- Power: "around 10GW by December 2027" for the leading company. "AI in total uses 60GW globally", of which 50 GW is in the US, "around 3.5% of projected US power capacity" (1.35 TW).

**Section 1: Compute production.**
- Efficiency: the H100 has "1e15 FP16 FLOP" and the R200 about 6e15, "a projected 2.4x improvement over the B200" per H100-sized die area.
- Die-area efficiency decomposes as:
  - "a 1.2x increase in die size"
  - "a 1.7x increase given the transition" from N4 to N3
  - "a 1.1x increase from other miscellaneous improvements"
  - These combine to an "overall 2.5x increase in chip efficiency" over 3 years, about 1.35x per year.
- Production:
  - AI chips used "at most 3% of TSMC's combined N5" and N3 capacity in 2023 (fn 22: 2.5M wafers × 28 dies ≈ 70M die capacity, of which ~2M was used).
  - Fab lines were "sometimes running at as little as 70% capacity".
  - AI "shouldn't reach more than ~40% of the fabrication capacity" by 2027.
  - Fab capacity expands "~15% expansion per year".
  - Packaging "expanded 2.5x" from 2023 to 2024, and TSMC plans "1.6x per year". AI27 models "raw production capacity grow at 2x/year", and 1.65x after a 1.2x difficulty adjustment. HBM is treated the same way, after 2.5x growth in 2024.
- Shipments: Nvidia shipped about "1.2M H100e ... in 2023", "for a total of 2M H100e in 2023". The total was "5M H100e in 2024", about 60% from Nvidia (fn 21 gives about $230B of 2024 AI infrastructure spending, ~$180B of it on chips).
- After 2027: "wafer production limits to slow the growth rate of chip production from 1.65x to around 1.25x".
- The full table is in 1.1 and 1.6 above.

**Section 2: Compute distribution.**
- Epoch estimates are used for owner stocks: Meta and Microsoft "each had 150,000-600,000 H100e at the start" of 2024, and Google and Amazon each had 400K-1.4M.
- 2025 capex announcements:

| Company | Announced 2025 capex | Share to AI servers | AI server spend |
|---|---|---|---|
| Microsoft | $80B | 70% | $56B |
| Google | $75B | 58% | $44B |
| Amazon | $100B | 48% | $48B |
| Meta | $65B | 54% | $35B |
| xAI | - | - | ~$30B |

- Leading company: "with about $90B of spending they will efficiently acquire around 6%" of world compute as owner. It uses more compute as an end user through cloud deals (~20% in 2027). It reaches an "annualized run rate of $50B by the end of 2026".
- China:
  - "a roughly constant share of global compute (around 12%)", unified "towards a single national AI effort".
  - AGI dedication rises: "now they dedicate 90% to AGI development as opposed to 40%" (another passage says 20%) [!].
  - "smuggling in significant quantities ... means the total compute in China is significantly higher".
  - "Domestic production also ramps up through SMIC", with chips at "a quality around 3 years behind Nvidia".
  - "US export controls stay poorly enforced".
  - China uses "around half of what is owned by the 'rest of the world' category", which is "concentrated in Malaysia and Singapore".
- Google and Meta "now dedicate 90% and 80%" of their compute to AGI in 2027.
- Gap: the page has no explicit DeepCent H100e or share number. DeepCent appears only as a label in Figure 3. The scenario gives DeepCent 10% of world compute in Aug 2027.

**Section 3: Compute usage.** The table is in 1.3. Key 2024 calibrations:
- "OpenAI used an average of 40% of their compute" on training.
- Pretraining was "about 3e26 fp16 FLOP of training".
- RL: "an average of 100k H100s being used on RL".
- Synthetic data: "average of 50k H100s used throughout the year", 35T tokens, and "roughly 16:1 in producing a high quality token".
- Experiments: "average of 10k H100s".
- Research automation: "An average of 1k H100s, or 2e25 fp8 FLOP", or "approximately 800k tokens per day" per employee, "assuming 1000 employees", at an 8:1 chain-of-thought ratio and 100 tok/s.
- External deployment: "average of 75k H100s throughout the year" at "10% inference utilization", about 2T tokens per day. OpenAI was "generating 100 billion words per day" in Feb 2024.
- Scale-up: external deployment grows "from 75k H100s in 2024 to 2M in 2027". Experiment compute reaches "more than 2e28 fp16 FLOP" in 2027.
- Monitoring: "divide by 20 to get our estimate".

**Section 4: AI research automation.**
- Inference is bandwidth-bound. The unit is the H100-Be, "3.6TB/s of total aggregate bandwidth".
- The in-house 2027-IC has 720 TB/s, 17.8 TB HBM4e, about 100 H100e of compute and 200 H100-Be, at "$600k" cost of ownership (fn 42: ~$400K to manufacture).
- The frontier model in early 2027 has "around 2e28 FLOP (4e28 FLOP at fp8" of training. It is about 10T dense-equivalent parameters, stored as 5 TB at fp4, which leaves about 11 TB of KV cache per chip.
- Parallel extreme: batch 440 gives 440 copies per chip at 45 tok/s.
- Serial extreme: "This would leave you with just 1,000 parallel copies" at about 1,350 tok/s across 10 chips per instance.
- Averages: "averaging to around 300K average copies" at about 20x human speed. Human speed is taken as 10 words/s.
- In 2028, preference is expected to shift toward serial workloads.
- Assumptions: 20K average sequence length, 50K hidden dimension, 250 layers, GQA factor 0.1, fp4 inference.
- The human brain is estimated at about 1T fp8 dense-equivalent parameters (fn 47).

**Section 5: Industry metrics.**
- The training-run table is in 1.4. Chips in use at the leading company go from ~2M (Jan 2025) to ~20M (Jan 2028) H100e. The mix shifts H100 → GB200 → GB300 → VR200, plus in-house inference chips (Fig 21).
- Cost history:
  - OpenAI "anticipates $5.4B in computing costs in 2024".
  - GPT-4 was "estimated to have cost around $100M to train".
  - Spending grew "roughly 11-22x/year" from 2022 to 2024.
  - FLOP/$ "doubled from the A100 to H100 in 16 months", but the trend is "closer to around 1.4x/year".
  - Projected spending growth is about 2.4x per year (3.4x in compute ÷ ~1.4-1.5x FLOP/$).
- Revenue: FutureSearch "projected how OpenBrain's revenue might grow to reach $100B" by mid 2027, "A leading company making the jump in only 4 years".
- Power: the chip table is in 1.6. The power-efficiency trend is 1.26x per year (fn 13; Epoch).

**Inconsistencies noted:**
1. Fig 22 vs. the text table for revenue and compute cost.
2. Global power: 62 GW vs 60 GW, and 9 GW vs 10 GW.
3. 1M copies at 50x (summary) vs a maximum of 600K in the table.
4. Average speed: "~20x" vs 23-43x from the table.
5. 2027-IC memory: 17.8 TB vs fn 43 (360 stacks × 24 GB ≈ 8.6 TB).
6. China 2024 AGI share: 2% vs 3%, and AGI dedication 20% vs 40%.
7. The Agent-2 checkpoint is ~3 TB in the scenario vs 8-10 TB in the security table.

### 2.2 Security Forecast (Romeo Dean, April 2025; covers the racing branch to Dec 2027)

**Structure:**
- Section 1, Security Levels: RAND levels, model weights exfiltration, algorithmic secrets, espionage and compromise.
- Section 2, Cyberwarfare and sabotage: AI hacking capabilities, sabotage.
- Section 3, Loss of control: subversion and self-exfiltration.
- Appendix: raw data, workshop polls, footnotes.

**Key definitions (quoted):**
- "Weights Security Levels (WSL) 1 through 5 as the ability to robustly defend" against OC1-5 "specifically trying to steal frontier AI model weights in under 2 months". "Robustly defend against OC1 attempt (95% probability)", and likewise for higher levels.
- "Secrets Security Levels (SSL) 1 through 5 as being able to robustly defend" against an OCn theft of "10% of the most important 10KB (plaintext)".
- Privileged access: "employees with authorized access to >10% of the top 20 KB (plaintext)" of information from the last 30 days.
- "hacking horizon as the time period T for which an AI can solve 50%" of hacking tasks that take a top 5-person human team time T.
- "Partial subversion is achieved if an AI gets control of enough computing resources" to run unmonitored workloads, so that humans cannot regain control without shutting down machines.
- Full subversion means the AI controls an entire cluster including its on/off controls.
- Self-exfiltration means the AI copies its weights outside the intended servers.

**Weights:**
- Status: US frontier labs' "insider-threat mitigations are still holding them to WSL2". "More established tech companies like Google might be at WSL3". "around 1000 of their current employees are able to interact" with weights daily.
- WSL3 challenges: "restricting high bandwidth internet connections exiting datacenters", and "insider threats (OC3) being difficult to defend against". Current tools include "protocols such as NVIDIA's confidential computing".
- China: from mid 2026 China is "unifying their AI companies into a single national AI effort", with "aggressive compartmentalization and air gapping". China stays "significantly (about 6 months) behind ... until they narrow the lead significantly by stealing the weights".
- Theft: "China succeeding at a weights exfiltration attempt of the US' most advanced model" in early 2027. "expect the USG to indeed find out within 4 weeks". This "motivates them to step in and help the leading US AI company".
- After theft: "taking approximately 12 months to reach WSL5 from WSL3" with "a top-priority government effort". "private companies are likely to need significant government support and resources". "China will achieve WSL5 a few months earlier than the US".
- Fn 8: the figures put DeepCent at WSL3 in late 2026, earlier than the scenario's early-2027 text.

**Secrets:**
- Secrets exfiltration bandwidth "should be around a million times lower". The test is "exfiltrating no more than 1KB leaked out of the most important 10KB".
- Current state: "around 1000 employees have relatively broad access to algorithmic insights". "It seems likely that a relatively amateur attempt might succeed", e.g. "with a $5K bribe to an office cleaner or a targeted phishing attack", or "purely cyber based attacks (e.g., through messaging platforms such as Slack)".
- Small amounts of information "can't leak to an OC3 effort" only at higher levels. The US is not there through 2026.
- After the theft, privileged staff "would decrease 10 fold to 200 employees", then "further to around 100 by the end of the year", with employees siloed and surveilled ("aggressively silo and surveil employees").
- SSL5 needs "extreme researcher relocation and air gapping measures", reached "after 3-6 months or so of further effort" (2028). The main means is "mostly through superhuman AI surveillance and security decision making".
- China holds SSL2 until the weights theft, then moves fast ("rapidly achieving SSL4"). "China overtakes the US briefly in 2027".

**Espionage:**
- "In 2024 the leading US company has about 1000 employees to China's 200". Teams "expand by 2 to 5 times" by 2026.
- Privileged access is held "between 100-300 individuals through 2027".
- "roughly 0.5% US employees are compromised", which peaks at 1% in 2026. This is based on "Manhattan project base rates of spies among the top 1000".
- One Chinese spy stays at OpenBrain until Aug 2027. DeepCent eradicates "the last spy in May 2027".

**Cyber (Section 2):**
- Cybench is 40 CTF tasks with first-solve times from 2 min to 25 h.
- Mapping: 25 h first-solve time at 100% success "maps to an expected 5h hacking horizon". Average first-solve time is assumed to be 5x the CTF first-solve time, with about 5 approaches tried before success and PASS@10.
- Example: in Aug 2027 OpenBrain can do what a 250-person top team "could do in 1 work day, or that a top team of 10" does in a work month.
- Sabotage needs a "roughly 10-50x advantage in hacking horizon" for a ~33% slowdown.
- Example: "China slowed the US's progress to 25" (vs 27.78 otherwise) in Aug 2027.
- By Dec 2027, "US AIs are crucially ahead enough to cause a 40% slowdown" of China.
- Minor data poisoning starts in 2026. Through 2028 both sides are "approaching a defense favoured limit".

**Loss of control (Section 3):** this needs a "roughly 1-year hacking horizon, or roughly 3,000h hacking horizon", "which is what OpenBrain achieves around October 2027". Self-exfiltration was "adjusted down to 10% given WSL5 security".

### 2.3 Main scenario passages relevant to compute and security (ai-2027.com)

- Early 2026: OpenBrain is about 3,000 people and at RAND SL2. It is working toward SL3, while "defense against nation states ... is barely on the horizon". Stealing Agent-1's weights would speed China's research by nearly 50%.
- Mid 2026: China has about 12% of world AI compute. About 50% of it works for the DeepCent-led collective, and over 80% of new chips go to the Tianwan CDZ. The CCP "double[s] down on their plans to steal OpenBrain's weights". OpenBrain has upgraded to SL3. The cyberforce can likely succeed only once.
- 2026 metrics box:

| Metric | 2026 value |
|---|---|
| Global AI capex | $1T |
| Global AI power | 38 GW |
| OpenBrain revenue | $35B |
| OpenBrain capex | $200B |
| OpenBrain compute cost | $40B |
| OpenBrain power | 6 GW |
| AI share of US power | 2.5% |

- Jan 2027: knowledge of Agent-2 is limited to an elite silo of a few dozen US government officials plus "the legions of CCP spies".
- **Feb 2027 theft mechanics (expandable box):**
  - "a series of coordinated small smash and grab thefts" on Nvidia NVL72 GB300 servers.
  - Access via "a friendly, coerced, or unwitting insider with admin credentials".
  - Encryption keys pulled from confidential-computing VMs with "a microarchitectural side channel".
  - "~25 distinct servers each leaking ~4% of the model (~100 GB chunks for a ~3 TB checkpoint)". Each server was throttled "under ~1 GB/s", against a normal egress range of about 100 GB/s.
  - The operation was "complete in under two hours".
  - It was detected by "an Agent-1 traffic monitoring agent".
  - Russia tried too and failed.
  - The US response added military and intelligence personnel and retaliatory cyberattacks, which failed because of DeepCent's airgapping.
- May 2027: weights are "well-secured for now", but secrets are "simple enough to relay verbally". Offices have "security more typical of a tech company than a military operation". Clearances are required within 2 months. One spy remains.
- Aug 2027: internet connections are restricted further and employees are wiretapped, which catches the last spy. Five Eyes get limited API access. A datacenter emergency shutdown system is agreed.
- Sep 2027: Agent-4 runs cybersecurity, and Agent-3 monitors check every line of code.

---

## PART 3 - SOURCE URLS

**Main pages:**
- Research index: https://ai-2027.com/research
- Compute Forecast: https://ai-2027.com/research/compute-forecast (~79K characters)
- Security Forecast: https://ai-2027.com/research/security-forecast (~50K characters)
- Main scenario: https://ai-2027.com/ (~106K characters; the last ~6K were not read)

**Linked spreadsheets:**
- Compute model ("[V2] Compute forecasting supplement", 2021-2030): https://docs.google.com/spreadsheets/d/1Ko-olwjDy6h8rXLZBFpP-e2GibGqRhfV28S4v8xtzrM/edit?gid=1866551567. Only this tab was read. Other tabs may exist.
- Raw calculations for 2027 copies and speed (fn 53): https://docs.google.com/spreadsheets/d/1dtvcuK0sG0Gf8F5A1vYLjmOP4q3tSraemyKL4FIKCSs/edit?gid=0

**Referenced works:**
- RAND, Securing AI Model Weights (RR-A2849-1): https://www.rand.org/pubs/research_reports/RRA2849-1.html. Not read; it is the origin of OC/SL.
- Epoch AI, Can AI scaling continue through 2030 (Appendix B): https://epochai.org/blog/can-ai-scaling-continue-through-2030
- Cybench: https://cybench.github.io

**Other supplements** (not read here): https://ai-2027.com/research/timelines-forecast, https://ai-2027.com/research/takeoff-forecast, https://ai-2027.com/research/ai-goals-forecast
