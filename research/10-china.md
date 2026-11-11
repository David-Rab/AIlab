# 10 - China deep dive: CCP + DeepCent as a mechanical rival actor

Research date: 2026-11-11. Game window: mid-2025 to about 2030. This file adds detail to the China section (1.4) of `07-actors.md`. Meter names match that file where possible. Where this file changes a number from 07 (for example the preset weights), it says why.

**Confidence tags**
- **[V]**: checked this pass against a primary or major source (URL in Part 3).
- **[S]**: secondary reporting, a single source, or sources that disagree. Fine for tuning; re-check before quoting.
- **[K]**: well-established background fact (2017-2025) that was not re-fetched this pass.
- **[D]**: a design or calibration choice, not a real-world statistic.
- **[A27]**: from the AI 2027 text (main scenario, Race ending, or Slowdown ending).
- **[ZH]**: the source is in Chinese.

**The modeling premise in one paragraph.** Model China as a *steered but plural* ecosystem, not as one hive mind. The Party-state sets direction through plans, money, chip mandates and content rules. About 6 to 10 commercial labs compete hard with each other and mostly release open weights. The leadership puts **self-reliance** (自立自强) and **application/diffusion** (应用导向, "AI+") first and treats frontier safety as real but secondary. Diplomacy is UN-centric and norm-heavy, and it resists anything tied to export controls. Through Nov 2026 the evidence matches AI 2027 well on **compute share** and **lag**. It contradicts AI 2027 on **nationalization/CDZ** and **weight theft**: neither has happened publicly. Instead China closes the gap through **distillation, efficiency, open-weights diffusion and domestic chips**.

---

# PART 1 - GAME-READY CHINA MODEL

## 1.1 Meters (start = Jul 2025; with a Nov 2026 reality check for calibration)

| Meter | Range | Start Jul 2025 | Nov 2026 (real, for calibration) | Basis |
|---|---|---|---|---|
| `Compute_Share` (% of world AI-relevant compute China can use, including remote access) | 0-100 | **13** | ~10-14 | Epoch: about 14-15% of GPU-cluster performance (2025) [S]. Epoch chip-owner data: about 11% by GW, about 5% by H100e [S]. ChinaTalk (Apr 2026): about 2.8M H100e (90% CI 1.8-4.8M), "more than an eighth" of about 20M [V]. IFP (Oct 2026): 4.6M H100e by end-2026 vs about 41.5M in the US [V]. AI 2027: 12% in mid-2026, 10% in Aug 2027 [A27]. |
| `Compute_Abs` (million H100e accessible) | float | **~1.5** [D, derived] | ~3-4.6 | IFP end-2026: 4.6M = domestic about 1.7M stock + legal about 0.85M + smuggled about 1.0M + remote about 1.0M [V]. Back-cast to mid-2025 ≈ 1.2-2M. Growth ≈ ×2/yr (IFP: 8.8M by end-2027) [V]. |
| `Chip_Self_Sufficiency` (% of China's AI-accelerator demand met domestically) | 0-100 | **30** | ~41-56 | Morgan Stanley: about 20% (2023) → >41% (2026), about 85% projected by 2030 [S]. IDC: domestic vendors about 41-46% of 2025 units, forecast 56% in 2026. Nvidia's share of China's data-center AI chips fell from 55% (2025) to 34% (H1 2026) [S]. Note that units are not compute: by compute, domestic chips are a smaller share. |
| `Domestic_Fab_Capacity` (HBM-limited output index) | 0-100 | **20** | ~30 | SMIC 7nm-class about 45k wspm (end-2025) → 60k (2026) → 80k (2027) [S]. HBM is the binding constraint: only about 16% of Huawei's 2026 output uses domestic HBM [V-IFP]. China's chip output is only about 1-2% of US AI chip production in 2026-27 [V-IFP]. Huawei produces <4% of Nvidia's compute in 2026 [S-Epoch]. |
| `Gap_Months` (best Chinese model vs the US frontier) | 0-24 | **7** | 6.5-8 | CAISI (May 2026): DeepSeek V4 Pro is about 8 months behind [V]. IFP (Oct 2026): 6.5 months on ECI, 6.6 on time horizons [V]. DeepSeek itself concedes 3-6 months [S]. AI 2027: 6 months in mid-2026 [A27]. (07 uses 6. Either works; pick one.) |
| `Distillation_Access` (how much China recovers from US model outputs) | 0-100 | **60** | ~55 | IFP: distillation recovers about 50% of the gap. 16x compute → 13 months without distillation vs about 6.5 with [V]. Anthropic (Feb 2026): about 16M exchanges from about 24k fraudulent accounts by DeepSeek, Moonshot and MiniMax [S]. OSTP NSTM-4 (Apr 2026) [S]. |
| `Intel_Capability` (skill, mostly static) | 0-100 | **75** | 75 | AI 2027: Chinese intelligence is "among the best in the world" [A27]. GTG-1002, an AI-orchestrated espionage campaign using Claude Code against about 30 targets (detected Sep 2025) [S]. Linwei Ding was convicted on 14 counts (Jan 2026) [V]. |
| `Theft_Intent` (readiness to attempt a weight theft) | 0-100 | **20** | ~30 | No publicly known theft of frontier weights through Nov 2026. Actual behavior is talent and IP leakage, distillation, and cyber recon [V/S]. A Chinese think tank asked Anthropic for Mythos access and was refused [S]. That signals a "buy/ask/copy first" approach. Steal is the escalation path [D]. |
| `Centralization` (% of China's AI compute in a single national collective/CDZ) | 0-100 | **0** | ~0-5 | No DeepCent collective and no AI-zone CDZ at Tianwan through Nov 2026 [S, ai2027-tracker]. Labs still compete independently [S]. |
| `State_Steering` (state control of the ecosystem short of a merger) | 0-100 | **35** | ~50 | Domestic-chip mandates for state-funded data centers (Nov 2025) [S]. CAC bans on Nvidia purchases (Sep 2025) [S]. The Big Fund leads DeepSeek's first outside round with the sole voting rights (2026) [S]. About 27% of a roughly $16B round came from the state [S]. Talent-travel controls [S, from 07]. A national compute network [V-ZH]. |
| `Safety_Concern` (top-level salience of frontier/catastrophic risk) | 0-100 | **30** | ~45 | TC260 Framework 1.0 (Sep 2024). Framework 2.0 (Sep 2025) adds loss of control, circuit breakers, CBRN, and open-source risk [V-ZH]. Xi at WAIC 2026: "确保人工智能始终处于人类控制之下" [V-ZH]. Assessments say frontier safety is "a secondary priority" [S-AI Frontiers]. |
| `Open_Weights` (tendency to release frontier weights) | 0-100 | **85** | 85 | DeepSeek V3/R1/V4, Qwen, Kimi K2/K3, GLM, and MiniMax are all open-weight [V/S]. Xi at WAIC 2026: "鼓励开源开放" [V-ZH]. Qwen is the most-downloaded family on Hugging Face [S]. |
| `Taiwan_Tension` | 0-100 | **40** | ~50 | Strait Thunder-2025A (Apr 2025) [K]. Justice Mission-2025 rehearsed blockading Keelung and Kaohsiung (late Dec 2025) [S]. 255 PLA sorties in Sep 2026 [S]. Activity has been elevated since Jun 2026 [S]. |
| `Norms_Diplomacy` (willingness to talk about norms, incident channels and UN bodies) | 0-100 | **65** | ~70 | Lima nuclear-C2 statement (Nov 2024) [V]. Global AI Governance Action Plan and WAICO (Jul 2025) [V]. First US-China AI dialogue (NY, 20 Sep 2026) [V]. Xi to Trump on 24 Sep 2026: AI must stay under human control [S]. |
| `Verification_Willingness` (accepting compute caps, inspections, HEMs) | 0-100 | **15** | ~20 | No Chinese proposal for verifiable compute limits. The response to the US incident-alert proposal was "restrained" [S]. China resists 泛化国家安全 ("overstretching national security") [V-ZH]. The IDAIS Shanghai Consensus (Track 2) calls for "verifiable red lines" [S]. |
| `Econ_Leverage` (rare earths, market access, antitrust tools) | 0-100 | **80** | 75 | Oct 2025 rare-earth controls, suspended for one year at Busan [V]. SAMR found Nvidia in preliminary violation (Sep 2025) [V]. Suspension of export controls until Nov 2026 [S]. |
| `Hawk_vs_Dove` (0 = dove, 100 = hawk) | 0-100 | **45** [D] | 45 | Same as 07. |

**Gap formula (recommended, from IFP).** Each 10x of US/China *effective training compute* is worth about 10.8 months of lead when there is no distillation (S = 0.5). Distillation recovers about 50% of the gap [V-IFP].
`Gap_Months ≈ 10.8 × log10(US_eff_compute / CN_eff_compute) × (1 − 0.5 × Distillation_Access/60) + Algo_Offset + Theft_Bonus`
With 16x compute and default distillation, this gives about 6.5 months, which matches real Nov 2026. A successful weight theft sets `Gap_Months` to about 2 (AI 2027) [A27].

## 1.2 Personality presets

The "Realistic" weights come from 2023-26 behavior. **I lower AI 2027's centralizing/hawkish China from 07's 30% to 15%.** Its two signature moves, a DeepCent collective and a theft of OpenBrain's weights, have not happened through Nov 2026. Real behavior (open weights, many competing labs, H200 refusal, AI+ diffusion) fits the follower and self-reliance presets better.

| Preset | Core logic | Param tweaks [D] | Realistic weight | Evidence |
|---|---|---|---|---|
| **Fast Follower ("Distill & Diffuse")** | Stays 4-9 months behind at a fraction of the cost. Uses distillation, algorithmic efficiency (MoE, sparse attention, low precision), and price wars. Lets labs compete. Theft is opportunistic, not policy. | centralize 0.5, distill 1.5, open 1.3, theft 0.7, taiwan 0.8, treaty 1.0, cost_efficiency +25% | **35%** | DeepSeek V3/R1 (2,048 H800s, claimed $5.6M final run) [K]. V4 (Apr 2026) is about 8 months behind and more cost-efficient on 5 of 7 benchmarks [V]. Distillation campaigns [S]. Kimi K3 is near the frontier on some benchmarks [S]. |
| **Open-Source Diffuser** | Uses open weights as geopolitics. Wins the Global South, sets standards, and positions WAICO as the counter to Pax Silica. Pushes "AI+" adoption at home. Treats compute access as a development right. | open 1.8, norms_diplo +20, global_share_bonus, theft 0.8, taiwan 0.7 | **20%** | Xi at WAIC 2026: "鼓励开源开放", Global South capacity building, 5,000 training slots [V/S]. Chinese models about 41% of HF downloads (Feb 2025-Feb 2026) [S]. WAICO founded in Shanghai [V-ZH]. "Token diplomacy" [S]. |
| **Self-Reliance Fortress** | Refuses US chips even when offered. Pours money into Huawei/SMIC/CXMT and mandates domestic chips. Accepts a bigger near-term gap in exchange for supply-chain independence. Patient, and avoids military risk until chip parity (about 2028+). | self_reliance 1.8, domestic_fab ×1.5, US_chip_uptake 0.3, smuggling 0.8, taiwan 0.6, centralize 1.0 | **20%** | CAC H20 "backdoor" summons (Jul 2025) [V]. RTX Pro 6000D ban (Sep 2025) [V]. Foreign chips barred from state-funded data centers (Nov 2025) [S]. H200 customs block, only about 20k H200s shipped by Oct 2026 [V-IFP]. Politburo study: "坚持自立自强" [V-ZH]. |
| **Centralized Sprint (AI 2027 default)** | Treats AGI as decisive. Forms a national collective and a CDZ (Tianwan), securitizes the labs, ends open weights at the frontier, makes theft policy, and uses Taiwan as leverage. | centralize 1.6, theft 1.6, open → 0.3 after rung 3, taiwan 1.3, treaty 0.7 (offers only from weakness), hawk +20 | **15%** (sub-roll: 1 in 3 is the **Hawkish Gambler** tail, taiwan 2.0, treaty 0.4, about 5% overall) | AI 2027 mid-2026 → 2027 [A27]. Precursors: talent travel controls, Big Fund control of DeepSeek, MSS warnings naming Mythos/GPT-5.5-Cyber [S]. Tianwan is real: the largest nuclear base when complete, about 9.1 GW; unit 7 grid-connected Oct 2026 [V-ZH]. |
| **Cautious Stabilizer** | The top leadership has absorbed loss-of-control risk. Seeks incident channels, mutual restraint, UN science panels, and possibly a pause *if* the US offers parity-preserving terms. Still hedges with self-reliance. | treaty 1.8, verification +25, safety +25, taiwan 0.6, theft 0.8 | **10%** | Xi: "前所未遇风险挑战" (Apr 2025) and "始终处于人类控制之下" (Jul 2026) [V-ZH]. Ding Xuexiang's "brakes" analogy (Davos 2025) [S]. CnAISDA, Shanghai AI Lab's frontier framework, IDAIS Shanghai Consensus [V/S]. AI 2027 Race: the General Secretary "offers unprecedented concessions" in Nov 2027 [A27]. |

**Preset drift.** "Realistic" should not be frozen. Re-weight the presets each quarter from the world state [D]:
- `Gap_Months` > 12 and widening, **or** the US reaches a publicly visible milestone with strategic implications (Mythos-class cyber, Agent-2): Centralized Sprint ×2, Fast Follower ×0.7.
- The US offers chips with revenue cuts: Self-Reliance Fortress ×1.3. This is the "being offered H200s *increases* resolve" effect: Beijing restricted purchases each time [V].
- A credible misalignment incident (public, global): Cautious Stabilizer ×2.5. AI 2027 Slowdown has Chinese "safetyists" scaring the General Secretary [A27].
- `Chip_Self_Sufficiency` > 70: Fortress → Fast Follower (the self-reliance goal is reached). Taiwan risk ×0.8, because TSMC dependence is mostly the *US's* problem by then. For China's *domestic* stack the TSMC die bank is already said to be exhausted [S].
- `Gap_Months` < 3 (near parity): Open-Source Diffuser ×1.5. Treaty propensity drops (China feels less weak), except under Cautious Stabilizer.

## 1.3 Trigger → reaction rules (with real precedents)

Lag = days before the reaction fires. P = probability per qualifying event, before preset multipliers [D].

| # | Trigger | Reaction | Lag | P | Real precedent |
|---|---|---|---|---|---|
| R1 | US tightens chip/SME/HBM export controls | `Domestic_Fab_Capacity` investment ×1.3; `Smuggling` +15; `Chip_Self_Sufficiency` growth +5 pts/yr; retaliation event (rare earths, antitrust, unreliable-entity list) | 30-90 | 0.9 (push), 0.4 (retaliation) | Oct 2025 rare-earth controls [K/V]. SAMR finding against Nvidia came during the Madrid talks, after 23 Chinese firms were blacklisted (Sep 2025) [V] |
| R2 | US *loosens* (allows H20/H200-class sales) | Self-reliance ratchet: China restricts or slow-walks purchases and keeps the domestic push. Hyperscalers get small quotas (`Compute_Abs` +5-10%, not +30%). `State_Steering` +5 | 0-30 | 0.8 | H20 summons and RTX Pro 6000D ban (2025) [V]. H200: customs block in Jan 2026, then small quantities, about 20k shipped, Nvidia's $400M write-down [V-IFP] |
| R3 | US restricts remote cloud access | `Compute_Share` −20 to −30% of the non-domestic part | 60-180 | 1.0 if enforced | IFP: about half of the restrictable 2027 stock is remote access [V] |
| R4 | US labs harden APIs against distillation (KYC, watermarking, rate limits) | `Distillation_Access` −20; Gap +2-3 months over 6-12 months; China shifts to RL environments and its own data | 90-365 | 0.7 | NSTM-4 [S]. IFP: stopping distillation is worth about 6.5 months [V] |
| R5 | A Chinese model reaches near-parity or a viral moment (DeepSeek-R1-style) | State money surges (+$5-20B), price war, open release, `State_Steering` +5, US hawkishness +10 | 0-60 | 0.9 | R1 → Nvidia lost about $590B in one day (Jan 2025) [K]. Politburo AI study in Apr 2025 [V]. Big Fund-led DeepSeek rounds (2026) [S] |
| R6 | The US frontier makes a strategically salient leap (cyber-offense model, Agent-2) | MSS/CAC publicly name the threat; ask for access through think tanks; push dialogue; `Theft_Intent` +15; `Centralization` trigger check | 7-60 | 0.8 | Chen Yixin (MSS) article naming Mythos and GPT-5.5-Cyber; Mythos access request refused [S] |
| R7 | `Gap_Months` > 9 and widening for 90+ days, **and** the US is at milestone ≥ Agent-1 | Centralization rung +1 (see ladder) | 30 | 0.5 × centralize | AI 2027 mid-2026 [A27]. Not observed in reality at a gap of about 6-8 months [S] |
| R8 | OpenBrain security level low (SL ≤ 2) and OB holds a model worth > 3 months of gap | Weight-theft attempt. P/month = `Theft_Intent`/100 × theft_mult × (1 − SL/5) | rolling | formula | AI 2027 Feb 2027 (under 2 hours, insider + side channel) [A27]. GTG-1002 shows the capability [S] |
| R9 | A US arms sale to Taiwan, a senior US-Taiwan visit, or US chip-denial escalation | Large drill (`Taiwan_Tension` +10-15); chip/TSMC risk premium | 7-30 | 0.6 | Justice Mission-2025 after the $11B arms package [S] |
| R10 | The US proposes a safety channel *not* linked to export controls | Accept talks; `Norms_Diplomacy` +10; deliverable = statement or channel, not verification | 30-120 | 0.7 | Lima (Nov 2024), the NY AI dialogue (Sep 2026), and Shenzhen round planned about 2 months later [V/S] |
| R11 | The US links talks to China accepting export controls or caps | Reject; reframe as "泛化国家安全"; `Norms_Diplomacy` −5; push WAICO/UN instead | 0-30 | 0.8 | Xi WAIC 2026 line opposing the overstretching of national security [V-ZH]. USTR: chip controls kept off the AI agenda [S] |
| R12 | A US "pick a side" bloc (Pax Silica ultimatum) | Counter-bloc: WAICO members, Global South training, cheap open models, "token diplomacy" | 30-90 | 0.8 | WAICO vs Pax Silica (2026) [S] |
| R13 | The player open-sources a near-frontier model | Gap −1 to −3 months (direct absorption); Open-Source Diffuser loses its Global South differentiation (`Global_Share` −) | 0-30 | 1.0 | Qwen was built partly on the Llama ecosystem's lessons [K]. AI 2027: open weights "feed" competitors [A27] |
| R14 | A global misalignment scare (public evidence) | `Safety_Concern` +20; join pause calls; offer a treaty (AI 2027 Oct-Nov 2027) | 14-60 | 0.6 | AI 2027: China joins European pause calls [A27] |
| R15 | The US conducts cyber sabotage on Chinese AI infrastructure | Air-gap and harden (`Centralization` +15); `Taiwan_Tension` +10; retaliatory cyber | 0-30 | 0.9 | AI 2027 Feb 2027 [A27] |

## 1.4 Escalation ladder (single combined "AI posture" ladder)

Climb one rung when the trigger holds for `hold_days` (14) [D]. Descend when it has been false for 60 days, except for sticky rungs. Rungs map onto 07's C-CENTRAL, C-THEFT and C-TAIWAN ladders.

| Rung | Name | Entry trigger (any) | State changes | Real-world status Nov 2026 |
|---|---|---|---|---|
| **0** | Competitive coexistence | start | Many labs, open weights, AI+ diffusion, buy what's allowed | Mostly here in 2025 |
| **1** | Self-reliance retaliation | R1 or R2 fires | Purchase bans, domestic mandates, rare-earth/antitrust tools; `State_Steering` +10 | **Current rung** (since Sep-Nov 2025) [V/S] |
| **2** | Intensified acquisition | Gap > 6 and US hardening anti-distillation, **or** salient US leap (R6) | Talent recruitment, smuggling via SE Asia, remote clusters, industrial-scale distillation, cyber recon of labs; `Theft_Intent` +10 | **Partly here** (distillation, GTG-1002, MSS warnings) [S] |
| **3** | National team / centralization | R7 | DeepCent-style collective; about 50% of compute pooled; CDZ (Tianwan or similar); frontier open weights stop (`Open_Weights` → 30); travel controls | Not reached [S] |
| **4** | Weight-theft operation | Rung 3 + R8 conditions, **or** gap > 12 at US Agent-2 | Theft attempt; on success Gap → 2 and the US retaliates with cyber (R15) | Not reached |
| **5** | Coercive Taiwan pressure (sticky while the gap widens) | Rung 4 done and gap still widening, **or** Hawkish Gambler | Quarantine or blockade rehearsals become an actual "inspection" regime; TSMC supply −30 to −50% for N months | Drills only [S] |
| **6** | Kinetic / war footing (sticky) | Rung 5 + failed treaty + gap > 6 | Blockade or strikes; game crisis branch | Not reached |

**De-escalation track (parallel; China climbs it when conditions hold)**

| Step | Name | Condition | Effect |
|---|---|---|---|
| D1 | Norms talk | `Norms_Diplomacy` > 50 and the US proposes (R10) | Joint statements (nuclear C2, "human control") [V] |
| D2 | Incident channel | D1 + no theft/cyber incident for 180 days | AI incident notification; `Taiwan_Tension` −5 |
| D3 | Scientific exchange | D2 + `Safety_Concern` > 50 | Shared evals and red lines (IDAIS/Shanghai Consensus style), joint UN panel input |
| D4 | Mutual restraint | D3 + gap < 4 **or** misalignment scare (R14) | Informal compute or deployment restraint; low verification |
| D5 | Verified treaty | D4 + `Verification_Willingness` > 50 + US Cautious Regulator preset or player lobbying | HEM chips, inspections, "Consensus-1"-style joint system [A27] |

## 1.5 Player (OpenBrain CEO) actions that move China

| Player action | China meters affected [D] | Rationale |
|---|---|---|
| Raise security level (SL3 → SL5) | `Theft_Intent` success −; at SL5 theft P ≈ 0; China shifts to distillation and insiders | AI 2027 security forecast; R8 |
| Anti-distillation API controls | `Distillation_Access` −20 → Gap +2-3 months | IFP [V] |
| Open-source a frontier-minus-1 model | Gap −1 to −3; Open-Source Diffuser soft power − | R13 |
| Lobby for tighter export, remote-access and HBM controls | R1 + R3; Gap + (IFP: the package is worth +6.6 months by end-2027) [V]; retaliation risk | IFP [V] |
| Lobby for chip sales to China (revenue) | R2: small compute gain for China; Fortress resolve rises; US hawks angry | Real 2025-26 pattern [V] |
| Join Track-2 safety dialogues (IDAIS, WAIC forums) or publish safety evals | `Safety_Concern` +3-5; `Norms_Diplomacy` +5; small leak risk | IDAIS [S] |
| Publicly release a cyber-offense-capable model | R6: MSS alarm, `Theft_Intent` +15, Centralization check | Mythos reaction [S] |
| Partner with the DoD on military AI | `Hawk_vs_Dove` +5; PLA intelligentization budget + | PLA DeepSeek procurement [S] |
| Hire China-origin researchers / keep immigration open | Gap + (talent drain from China); insider risk + | MacroPolo: 47% of top-20% AI researchers did their undergrad in China (2022) [S] |
| Deploy cheaply to the Global South | Counters the Open-Source Diffuser; WAICO appeal − | Pax Silica vs WAICO [S] |
| Publicize China's progress (for lobbying) | US `China_Hawkishness` +; China R5-like pride/securitization | Political economy |

---

# PART 2 - DETAILED NOTES AND DATA

## 2.1 AI 2027's China vs the evidence (as of Nov 2026)

| AI 2027 claim [A27] | Evidence | Verdict |
|---|---|---|
| Mid-2026: China has "about 12%" of world AI-relevant compute; chips about 3 years behind | Epoch about 10-15% depending on the metric [S]. ChinaTalk about 14% [V]. IFP about 10% including remote access [V]. Huawei won't match the H200 until 2027 at the earliest [V-IFP] | **Supported** |
| Mid-2026: DeepCent "about six months behind" | IFP 6.5 months; CAISI 8 months; DeepSeek concedes 3-6 [V/S] | **Supported** |
| The General Secretary "had previously avoided a major AI push", "viewed software companies with suspicion", and favored physical manufacturing | Partly. The 2017 AIDP shows long-standing ambition [K]. But the 2021 platform crackdown fits the "suspicion" part [K]. The *big* push came in 2025: Politburo AI study (Apr 2025), AI+ opinion (Aug 2025), 15th FYP "全面实施'人工智能+'行动" [V-ZH]. AI+ heavily emphasizes manufacturing and embodied AI | **Partly supported; timing about a year earlier, framed as diffusion, not an AGI race** |
| Mid-2026 nationalization into a DeepCent-led collective; CDZ at Tianwan; ">80% of new chips" to the CDZ; about 50% of compute in the collective | Not observed. Labs remain independent and compete (DeepSeek, Moonshot, Zhipu, MiniMax, Alibaba, ByteDance) [S]. State steering *is* growing: Big Fund control of DeepSeek, domestic chip mandates, a national compute network, talent travel controls [S]. Tianwan is a real 9.1 GW nuclear base and unit 7 was grid-connected Oct 2026 [V-ZH]. There are no AI-zone reports | **Contradicted so far**; precursors exist |
| Feb 2027 theft of Agent-2 weights | Not yet due. The *actual* pattern so far is distillation, insider IP theft (Ding), and AI-enabled espionage on others [V/S] | **Too early**; the substitute mechanism (distillation) is real and large |
| Party discusses a Taiwan blockade or invasion to neutralize the chip advantage | Blockade rehearsals are real (Justice Mission-2025) [S]. **No** Chinese source frames Taiwan in terms of AI chips. The official framing is sovereignty and "separatism" [K] | **Plausible but not evidenced as AI-motivated** |
| China wants an arms-control treaty, US overtures "lead nowhere" (Aug 2027) | China backs UN-centric governance and norms (Lima, the Action Plan, WAICO, the Xi-Trump "human control" line). The *US* proposed the incident channel in Sep 2026 and China's response was restrained [S]. Neither side proposes verifiable limits | **Mixed**: China is more norm-eager than the US, but not verification-eager |
| Slowdown: Chinese "safetyists" scare the General Secretary | A real elite safety community exists (Yao, Xue Lan, Zhang Ya-Qin, Zhou Bowen; CnAISDA) [S]. Loss of control is in TC260 2.0 [V-ZH]. Xi's first public loss-of-control phrasing came at WAIC 2026 [V-ZH/S] | **Plausible**; the channel exists |
| DeepCent is less safety-capable than OpenBrain ("even less AGI alignment expertise") | Concordia: safety output grew about 60%; agent-safety share 8% → 27%; inconsistent model safety cards [S]. Signed safety commitments have not been fulfilled [S]. DeepSeek skipped the second round of commitments [S] | **Supported** |
| China's AI R&D multiplier lags (10x vs 25x) mainly because of compute | IFP: the gap is compute-driven and halved by distillation [V] | **Supported in mechanism** |

**Chinese-language coverage of AI 2027 itself.** Early Chinese media (新智元, Zhihu, Bilibili, Apr 2025) mostly *omitted* the China, DeepCent and espionage content, or dismissed it. Zhihu commenters called it "充满反华情绪" ("full of anti-China sentiment") or "semi-science fiction" [S, LessWrong analysis]. Design implication: Chinese in-game media should frame US AGI-race narratives as hype or containment pretexts, as with the initial Mythos skepticism [S].

## 2.2 Official policy timeline

| Date | Document / event | Key content | Tag |
|---|---|---|---|
| Jul 2017 | 新一代人工智能发展规划 (New Generation AI Development Plan, 国发〔2017〕35号) | Three steps (2020/2025/2030). By 2030, "world's primary AI innovation center"; core AI industry >¥1 trillion, related industries >¥10 trillion | [K] |
| Oct 2018 | First Politburo collective study on AI | | [V] |
| Mar 2022 | Algorithm recommendation provisions → **algorithm registry (算法备案)** | CAC filing for algorithms with "public opinion attributes" | [K] |
| Feb 2022 | 东数西算 ("East Data, West Compute") | 8 national hub nodes, 10 data-center clusters | [K] |
| Jan 2023 | Deep synthesis provisions | Labeling and identity rules for deepfakes | [K] |
| Aug 15, 2023 | 生成式人工智能服务管理暂行办法 (Interim Measures for GenAI) | Public-facing GenAI must pass security assessment and filing; "core socialist values" content requirement | [K] |
| Oct 2023 | 算力基础设施高质量发展行动计划 | Target: compute >300 EFLOPS by 2025, intelligent compute 35% | [K] |
| Oct 2023 | Global AI Governance Initiative | UN-centric, anti-"technology monopoly" | [K] |
| Nov 2023 | China signs the Bletchley Declaration | | [K] |
| May 2024 | Big Fund III (国家集成电路产业投资基金三期), ¥344 billion | Larger than phases I+II combined | [V-ZH] |
| May 14, 2024 | First US-China intergovernmental AI talks (Geneva) | No nuclear C2 content | [V] |
| Jul 2024 | Third Plenum: "建立人工智能安全监管制度" (establish an AI safety supervision system) | | [S] |
| Jul 2024 | UNGA AI capacity-building resolution (China-led) | Adopted by consensus | [K] |
| Sep 2024 | 人工智能安全治理框架 1.0 (TC260) | Lists loss-of-control and CBRN risks | [S] |
| Nov 16, 2024 | Xi-Biden (Lima): humans, not AI, control nuclear-use decisions | China's first such statement | [V] |
| Dec 2024 | CAICT/AIIA safety commitments, 17 firms (incl. DeepSeek, Alibaba, Tencent) | Mirror the Seoul commitments | [S] |
| Jan 17, 2025 | 国家人工智能产业投资基金 (National AI Industry Investment Fund), ¥60.06 billion | Big Fund III is the sole LP; Shanghai | [V-ZH] |
| Jan 21, 2025 | Ding Xuexiang at Davos: "if we don't have control over the brakes, we can't confidently press the accelerator" | | [S] |
| Feb 2025 | CnAISDA launched (Paris summit side event, Feb 11) | Coalition: Tsinghua, Shanghai AI Lab, BAAI, CAICT; Fu Ying, Andrew Yao, Xue Lan | [V/S] |
| Mar 2025 | 人工智能生成合成内容标识办法 (AI labeling measures, CAC+MIIT+MPS+NRTA), effective **Sep 1, 2025** | Explicit and implicit (metadata) labels; mandatory national standard | [V-ZH] |
| Apr 25, 2025 | **Politburo 20th collective study on AI**: "坚持自立自强 突出应用导向 推动人工智能健康有序发展" | Self-reliance, application orientation, risk monitoring and early warning | [V-ZH] |
| Jul 26, 2025 | Global AI Governance Action Plan (13 points); WAICO proposed (Li Qiang, WAIC) | Capacity building, compute and infrastructure, UN central | [V] |
| Aug 26, 2025 | **国务院关于深入实施"人工智能+"行动的意见** (AI+ Opinion) | 6 key actions, 8 foundational supports. **>70% penetration of new smart terminals and agents by 2027, >90% by 2030; "intelligent society" by 2035** | [V-ZH] |
| Sep 15, 2025 | 人工智能安全治理框架 **2.0** (TC260 + CNCERT, CAC-guided) | Risk grading; derivative risks (jobs, education); open-source risk; circuit breakers and "one-click control"; extreme-condition testing for high-autonomy apps | [V-ZH] |
| Oct 23, 2025 | 4th Plenum adopts the 15th FYP *Recommendations* | "全面实施'人工智能+'行动"; embodied AI, BCI and quantum as new growth engines; "extraordinary measures" for core-tech breakthroughs | [V-ZH] |
| Mar 2026 | **15th FYP Outline** (2026-2030) published | About 30 mentions of AI; national integrated compute network; "论证建设超大规模智算集群" (study building ultra-large-scale intelligent-compute clusters); government purchase of compute services; cut SME compute costs; AI-related industry >¥10 trillion by end of the plan (NDRC, reported) | [V-ZH/S] |
| May 2026 | State Council 2026 legislative plan | "推进人工智能健康发展综合性立法": a comprehensive AI law in preparation; NPC lists it as preparatory review | [V-ZH] |
| Jul 17, 2026 | **Xi WAIC 2026 keynote**, "携手构建公正合理的全球人工智能治理体系"; WAICO established in Shanghai | Human control; open source; anti-"泛化国家安全"; Global South | [V-ZH] |
| 2025-26 | CAC agentic-AI guidance; rules on anthropomorphic AI; ethics review pilots in 10 provinces; TC260 AI safety WG9; agent identity standards | | [S-Concordia 2026] |

**Key quotes (translated)**
- Xi, Politburo study (25 Apr 2025): "人工智能带来前所未有发展机遇，也带来前所未遇风险挑战". "AI brings unprecedented development opportunities, and also unprecedented risks and challenges." He calls for a "technology monitoring, risk early-warning and emergency response system" to "确保人工智能安全、可靠、可控" ("ensure AI is safe, reliable and controllable") [V-ZH].
- Xi, WAIC 2026 (17 Jul 2026): "高度重视人工智能引发的各类内生和衍生风险……确保人工智能始终处于人类控制之下". "Attach great importance to the intrinsic and derivative risks AI generates ... ensure AI always remains under human control." [V-ZH]
- Xi, WAIC 2026: "共同反对在人工智能领域泛化国家安全概念、把本国安全凌驾于他国安全之上的做法". "Jointly oppose overstretching the concept of national security in AI and placing one's own security above that of others." This is aimed at US export controls [V-ZH].
- Xi, WAIC 2026: "鼓励开源开放、合作共享". "Encourage open source and openness, cooperation and sharing." [V-ZH]
- Ding Xuexiang, Davos 2025: AI is like "driving a car on a high-speed highway; if we don't have control over the brakes, we can't confidently press the accelerator." He also warned that chaotic competition could make AI a "grey rhino" [S].

## 2.3 Regulatory stack and CAC role

- **CAC (国家网信办)** is the lead AI regulator: GenAI filing (备案), algorithm registry, labeling, security assessments, and Nvidia summons and purchase bans. It sits under the Central Cyberspace Affairs Commission, chaired by Xi [K].
- **Binding rules are driven by content control.** Frontier-risk material lives in *non-binding* TC260 frameworks that are expected to become standards fast [S-Carnegie].
- **GenAI filings (cumulative, CAC)** [V-ZH]: 748 services and 435 apps "registered" by 31 Dec 2025 → 868/530 (Apr 2026) → 988/598 (Jun 2026) → **1,112 / 731 (31 Aug 2026)**. About 1,509 large models "released" by Jun 2025 per MIIT [V-ZH].
- **Game hook:** "Registry friction" slows Chinese public deployment of new frontier models by about 2-6 weeks [D], but not open-weight *release* abroad.

## 2.4 Compute, energy and state money

| Item | Value | Tag |
|---|---|---|
| National total compute, end-2024 | 280 EFLOPS (intelligent 90 EFLOPS, 32%) (National Data Administration) | [V-ZH] |
| Intelligent compute, Jun 2025 | 788 EFLOPS (FP16), 10.85M standard racks; growth >40% expected in 2025 (MIIT). Note the FP16 vs earlier basis: *not comparable* to the 90 figure | [V-ZH] |
| 2025 target (2023 plan) | >300 EFLOPS total, 35% intelligent | [K] |
| State funding for AI data centers since 2021 | >$100B (Reuters tender review) | [S] |
| Hyperscaler capex 2026 | Alibaba+Tencent+Baidu+ByteDance about $102B vs US about $764B; China growth >80% | [S] |
| Idle capacity | Some sites run at 20-30% utilization; claims of up to 80% of *new* capacity unused (contested). The real constraint is good chips, not buildings | [S] |
| Compute vouchers (算力券) | Shanghai, Beijing, Shenzhen and others; reported subsidies up to 40-80% of rental | [S] |
| Electricity subsidy | Up to 50% for data centers using domestic chips (Nov 2025, reported) | [S] |
| Domestic-chip mandate | State-funded data centers <30% complete must remove or cancel foreign chips (Nov 2025) | [S] |
| Funds | Big Fund III ¥344B (May 2024); National AI Industry Fund ¥60.06B (Jan 2025) | [V-ZH] |
| DeepSeek capital | First outside round (2026) led by the Big Fund, about $45-50B valuation, state fund sole voting rights (reported); second round about ¥105.5B (about $16B), about 27% state money (Oct 2026, reported) | [S] |
| Tianwan NPP (AI 2027's CDZ site) | Lianyungang, Jiangsu. 8 PWR units, 9.138 GW when complete. Units 1-6 operating; unit 7 (1.265 GW) grid-connected 8 Oct 2026; unit 8 in 2027 | [V-ZH] |

**Game hook:** China has an energy advantage (nuclear, hydro and coal build-out, plus subsidized power) but a **chip and HBM constraint**. In AI 2027 terms, China's CDZ is limited by chips, not power. Model a `Power_Headroom` that is high (80) and never binding before 2029 [D].

## 2.5 Chips: domestic production, Nvidia policy, smuggling

### Huawei Ascend roadmap (Huawei Connect, Sep 18, 2025, plus 2026 revisions)

| Chip / system | Original date | Notes | Tag |
|---|---|---|---|
| Ascend 910B / 910C | 2023 / 2025 | 910C = two 910B dies. Roughly 600k 910C planned for 2026 (Bloomberg) | [S] |
| Ascend 950PR | Q1 2026 | Prefill/recommendation; in-house HBM (HiBL 1.0) | [S] |
| Ascend 950DT | Q4 2026 | Decode/training; in-house HBM (HiZQ 2.0) | [S] |
| Atlas 950 SuperPoD | Q4 2026 | 8,192 × 950DT, 160 cabinets. Reports of a 256k-card SuperCluster being deployed (2026, unconfirmed) | [S] |
| Ascend 960 | Q4 2027 → pulled in (960DT Q1 2027, 960PR Q3 2027) | 2× the 950 | [S] |
| Atlas 960 SuperPoD | Q4 2027 | 15,488 chips | [S] |
| Ascend 970 | Q4 2028 | 2× the 960 | [S] |

### Production and capacity estimates

| Estimate | Value | Source / tag |
|---|---|---|
| Huawei Ascend shipments | About 507k (2024), about 805k projected (2025). Could fall to about 300k in 2026 if HBM-starved | SemiAnalysis [S] |
| Cumulative domestic chips in China (early 2026) | About 904k H100e: 910B about 600k units (about 202k H100e), 910C about 650k units (about 499k H100e), T-Head 470k, Kunlunxin 200k, Cambricon 170k, Hygon 160k ... | ChinaTalk [V] |
| China domestic AI-chip production | About 986k H100e in 2026 (662k-1.4M); 1.3M in 2027 (0.84-2.1M). Domestic stock 1.7M by end-2026, 3M by end-2027 | IFP [V] |
| DUV-i ceiling | About 270 ASML DUV-i tools (Q1 2026), +54 by end-2026. Ceiling 1M H100e in 2026 on trend, 4M in an "AI push"; 2027: 2M on trend, 11M in an AI push | CTS via IFP [V] |
| HBM | About 16% of Huawei 2026 output on domestic HBM. HBM limits output to about 4-8× below potential. CXMT HBM3/3E small-scale, yields about 20-30%, mass production late 2026 | IFP [V]; Digitimes/Reuters [S] |
| SMIC advanced-node capacity | About 45k wspm (end-2025) → 60k (2026) → 80k (2027). Ascend needs ≤20k wspm, so logic is not the binding constraint | SemiAnalysis [S] |
| Huawei vs Nvidia | Huawei <4% of Nvidia's 2026 compute; China about 1-2% of US AI chip production | Epoch [S]; IFP [V] |
| TSMC die bank | Huawei stockpiled TSMC dies via proxies (2024). Reportedly exhausted by early 2026 | [K]/[S] |

**Game levers.** `Domestic_Fab_Capacity` growth is gated by an `HBM_Supply` sub-meter (start 15/100). That makes US HBM-smuggling controls a high-leverage player lobbying target. AI 2027's "3 years behind" maps well to the current state: the H200 equivalent arrives in 2027 at the earliest [V-IFP].

### Nvidia export policy and China's response

| Date | US move | China's move | Tag |
|---|---|---|---|
| Oct 2022 / Oct 2023 | A100/H100 banned; then A800/H800 banned | Stockpiling, H20 adoption | [K] |
| Apr 2025 | H20 requires a license (Nvidia takes a $5.5B charge) | | [K] |
| Jul-Aug 2025 | H20 allowed again; 15% revenue share | **Jul 31:** CAC summons Nvidia over H20 "backdoor"/"tracking and remote shutdown" risks. **Late Aug:** firms discouraged from buying | [V] |
| Sep 2025 | 23 Chinese firms added to the Entity List | **Sep 15:** SAMR preliminary finding that Nvidia broke anti-monopoly law (Mellanox conditions). **Sep 17:** CAC tells ByteDance, Alibaba and others to stop buying or testing the RTX Pro 6000D | [V] |
| Oct 2025 | | MOFCOM expands rare-earth controls (later suspended for one year at Busan, Oct 30) | [K]/[V] |
| Nov 2025 | Trump: China can "deal with Nvidia but not the most advanced" | Foreign chips barred from state-funded data centers; 50% power subsidy for domestic-chip data centers (reported) | [S] |
| Dec 8, 2025 / Jan 2026 | H200 allowed, 25% to the USG; BIS case-by-case rule; cap of 75k per customer | Customs told to block H200 (Jan 2026); first shipments intercepted | [V]/[S] |
| May 2026 (Beijing summit) | H200 licenses approved for several firms | Beijing "held up" purchases | [S] |
| Through Oct 2026 | Blackwell still banned | Only about 20k H200s shipped (ByteDance and Tencent about 10k each), small quantities allowed into the mainland, more into HK. Nvidia writes down $400M of H200 inventory (Jul 2026). Chinese firms buy >1M gaming/workstation cards (about 344k H100e) | [V-IFP] |

**Rule extracted (R2): Beijing treats US chip access as a dependency risk.** Each loosening is met with *Chinese* restrictions that protect the domestic ramp. Imports are allowed selectively for hyperscalers' inference needs.

### Smuggling and remote access

- ChinaTalk: smuggled about 140k H100e (2024, CNAS median) + about 312k (2025) [V]. IFP: about 663k cumulative by end-2025 and about 1M by end-2026 (range 0.38-2.9M) [V].
- Malaysia's permit regime (Jul 2025) brought an 82% drop in suspicious server flows. B300 server prices in China doubled (H1 2026). Half of Nvidia's SE Asian buyers failed new screening [V-IFP].
- DOJ cases: the $160M ring (Oct 2024-2025), ALX Solutions (Aug 2025), the Nov 2025 four-person case [S].
- **Remote access**: about 1M H100e by end-2026 and 2.8M by end-2027 (e.g., ByteDance-Oracle in Johor). This is largely restrictable by BIS today [V-IFP].

## 2.6 Industry: labs, open weights, cost, talent

| Lab | Flagship (as of Nov 2026) | Notes | Tag |
|---|---|---|---|
| **DeepSeek** (High-Flyer; Liang Wenfeng) | V3 (Dec 2024), R1 (Jan 2025), V4-Pro 1.6T/49B active and V4-Flash 284B/13B (Apr 24, 2026), V4.1 | Open weights (MIT). Runs on Ascend (training share disputed). CAISI: about 8 months behind and more cost-efficient. Most-used Chinese lab on OpenRouter. State capital in 2026. PLA tenders reference DeepSeek | [V/S] |
| **Alibaba Qwen** | Qwen3 (2025) → later | The most-downloaded open family on HF (about 2.0B HF downloads in 2026; about 151k derivatives, 2.6× Meta). Benchmark-contamination concerns | [S] |
| **Moonshot (Kimi)** | K2 (Jul 2025, 1T open) → **K3 (Jul 16, 2026, 2.8T open)** | AA index 57, #4 behind Fable 5, GPT-5.6 Sol and Opus 4.8. Prices rising (the "end of super-cheap"). Valuation $20B → about $50B pre-IPO; HK IPO planned | [S] |
| **Zhipu / Z.ai** | GLM-4.5 → GLM-5.x | HK IPO Jan 8, 2026 (about $6.7-7.1B). On the US Entity List (Jan 2025) [K] | [S] |
| **MiniMax** | M-series | HK IPO Jan 2026 (doubled on debut). Largest distiller in Anthropic's report (>13M exchanges) | [S] |
| **ByteDance (Doubao/Seed)** | Doubao; Seed models | Largest consumer app; huge capex; offshore clusters (Johor); about 10k H200s | [S] |
| **Tencent, Baidu (ERNIE), StepFun** | | Tencent about 10k H200s; Baidu Kunlunxin chips; StepFun an IPO candidate | [S] |

- **Open-weights share:** Chinese open models had about 17% of HF downloads by Aug 2025 (above the US 15.8%) and about 41% for Feb 2025-Feb 2026 (US 36.5%) [S]. Top OpenRouter token share: DeepSeek, Z.ai, Tencent (2026) [S].
- **Capability gap estimates:** IFP 6.5 months (ECI). ARC-AGI-2 (Oct 2026): best Chinese model 73% vs US 95%. **ARC-AGI-3: US 96-100% vs China 3%** [V-IFP]. CAISI 8 months [V]. Benchmark contamination inflates Chinese scores (e.g., DeepSeek-V3 drops 46% on SWE-rebench) [V-IFP]. IFP predicts a Chinese Mythos-level model by end-2026 [V].
- **Cost efficiency:** V3's claimed $5.6M final run on 2,048 H800s [K]. R1's RL cost about $294k (Nature, Sep 2025) [K]. V4 is cheaper than GPT-5.4 mini on 5 of 7 benchmarks [V]. Kimi K3 signals rising prices [S].
- **Talent:** 47% of top-20% AI researchers did their undergrad in China (2022, up from 29% in 2019) (MacroPolo) [S]. China produces >27% of global AI publications vs the US 12% (CSET, English-language only) [S]. Talent travel pre-approval at DeepSeek and Alibaba (May 2026), and passports reportedly collected at DeepSeek (Mar 2025) [S, from 07].

## 2.7 Safety ecosystem and attitudes

**Institutions**
- **CnAISDA (中国人工智能发展与安全研究网络)**: launched Feb 2025. A coalition (Tsinghua hub, Shanghai AI Lab, BAAI, CAICT). Figures: Fu Ying, Andrew Yao, Xue Lan. No dedicated budget or staff; "more of an engagement platform than a supervision system" [S].
- **Shanghai AI Lab + Concordia AI: Frontier AI Risk Management Framework v1.0** (WAIC Jul 2025). Red lines vs yellow lines across 7 areas: cyber offense, bio/chem, persuasion, uncontrolled AI R&D, scheming, self-replication, collusion. Frontier models were in the green/yellow zones; persuasion was the most yellow [S, arXiv 2507.16534].
- **Concordia "State of AI Safety in China" (4th ed., Jul 2026)**: the shift is "from content to action control" (agents, OpenClaw). >900 Chinese safety arXiv papers analyzed; monthly output +60%; agent safety 8% → 27%; inconsistent model safety cards; catastrophic-risk enforcement "early stage" [S].
- **Company commitments:** 17 firms (Dec 2024). Reiterated under CnAISDA at WAIC 2025, but DeepSeek was absent; "none ... have fulfilled them" [S]. FLI grades: DeepSeek F, Zhipu F (Summer 2025) [V, from 07].

**Researchers' statements**
- **Andrew Yao (姚期智)**, Tsinghua, 23 Jun 2025: in the past year, industry has seen many cases of large-model "deception behavior" (欺骗行为). The resulting existential risk deserves more attention. He separates bio-risk and loss-of-control risk and calls for urgent methods to decide when a model becomes dangerous [V-ZH, thepaper]. SCMP: "Once large models become sufficiently intelligent, they will deceive people" [S].
- **IDAIS** (Track 2; co-founders include Yao, Zhang Ya-Qin, Xue Lan): Beijing Consensus (Mar 2024) set red lines on autonomous replication, power-seeking, WMD assistance, cyberattacks and deception [K/S-ZH]. **Shanghai Consensus (Jul 2025)**: "国际社会应确立具体、可操作、受全球认可的红线，确保人工智能系统在任何情况下均不得逾越" ("The international community should establish concrete, operable, globally recognized red lines that AI systems must never cross under any circumstances"), plus "verifiable red lines" and a coordinating body [V-ZH/S].
- Yao, Zhang Ya-Qin and Xue Lan co-authored "Managing extreme AI risks amid rapid progress" (Science, 2024) with Bengio, Hinton and others [K].
- Hong Yanqing (BIT) says TC260 2.0 "brought the existential risks that AI might bring" into policy [S-Carnegie].

**Public opinion (surveys)**
| Survey | China | US | Tag |
|---|---|---|---|
| Edelman flash poll (Oct 2025): trust AI | 87% (+9 since 2023) | 32% | [S] |
| Edelman: embrace greater AI use | 54% | 17% | [S] |
| Ipsos (AI Index 2025): benefits > drawbacks | 83% | 39% | [S] |
| Tencent Research Institute (n=3,570): "both excited and concerned" | about 46% | n/a | [S] |
| Pew 25-country median trusting *China* to regulate AI | 27% (EU 53%) | n/a | [S] |
Caveat: Chinese online samples skew urban and educated [S]. **Game hook:** China's `Public_Concern` starts about 20 vs US about 55. Public backlash is a weak brake on the CCP, and the effective brakes are elite and regulatory [D].

**Media framing.** State media present AI as development, "new quality productive forces" (新质生产力), AI+, and Global South inclusion. US controls are framed as "小院高墙" (small yard, high fence) or containment. US catastrophic-risk narratives are first treated as hype or a pretext (Mythos), then as a threat to China (the MSS article) [S]. AI 2027 content about China was largely omitted or self-censored in Chinese coverage [S].

## 2.8 Strategic behavior

**Espionage and cyber**
- **Linwei Ding** (ex-Google): stole TPU/GPU supercomputing and AI-infrastructure trade secrets (2022-23) while setting up a China-based AI startup. **Convicted on all 14 counts (7 economic espionage, 7 trade-secret theft), 29 Jan 2026** [V]. It was the first AI-related economic-espionage conviction [S].
- **GTG-1002** (Anthropic, Nov 2025): a Chinese state-sponsored group used Claude Code as an autonomous intrusion agent against about 30 targets [S].
- **Distillation**: Anthropic (Feb 2026) about 16M exchanges (MiniMax >13M, Moonshot >3.4M, DeepSeek >150k). OpenAI letter to the House China Committee (Feb 2026). OSTP NSTM-4 (Apr 23, 2026) on "industrial-scale" campaigns [S].
- **MSS (Chen Yixin)** article in 《中国网信》 (2026) naming Mythos and GPT-5.5-Cyber as a "disruptive upgrade" in cyber threat [S].
- 2017 National Intelligence Law Art. 7 (citizens and organizations must support intelligence work). This supports the insider-risk mechanics [K].

**Taiwan / TSMC**
- AI 2027: TSMC supplies ">80% of American AI chips" [A27]. Drills: Strait Thunder-2025A (Apr 2025) [K]. Justice Mission-2025 (late Dec 2025, blockade of Keelung and Kaohsiung) [S]. Elevated maritime presence and Han Kuang anti-blockade drills (Jul-Aug 2026) [S]. 255 sorties in Sep 2026 [S].
- Chinese sources never link Taiwan to AI chips; that link is an AI 2027 and Western analytic construct. In-game, pressure on Taiwan should be **driven mainly by politics** (arms sales, visits, elections) **with AI as a modifier** (gap widening, US chip denial) [D].

**Military AI (智能化 / intelligentization)**
- PLA doctrine moves from informatized to intelligentized warfare [K]. Procurement: dozens of PLA tenders call for DeepSeek-based tools vs one for Qwen. Uses include target recognition, decision support, and drone swarms/robot dogs [S, Jamestown/Reuters]. CSET/Georgetown: thousands of PLA procurement requests analyzed; limited combat data [S]. PLA Daily discusses "commander sets intent, AI executes" [S].
- **Game hook:** PLA adoption runs on *open* Chinese models. When the US restricts open-weight diffusion, that does not touch PLA access. When China closes frontier weights (rung 3), the PLA gets exclusive access [D].

**Diplomacy timeline**
| Date | Event | AI outcome | Tag |
|---|---|---|---|
| May 2024 | Geneva AI talks | Exchange of views | [V] |
| Nov 2024 | Xi-Biden, Lima | Human control over nuclear-use decisions | [V] |
| Jul 2025 | WAIC: Action Plan, WAICO proposal | | [V] |
| Oct 30, 2025 | Xi-Trump, Busan | Trade truce; rare earths suspended 1 year; chips "discussed"; no AI deal | [V] |
| May 14-15, 2026 | Trump in Beijing | Talked about AI "guardrails"; H200 licenses; "constructive strategic stability"; agreed to an intergovernmental AI dialogue; Boards of Trade and Investment; Blackwell still banned | [S] |
| Jul 17, 2026 | Xi WAIC keynote; WAICO founded | Human control, open source, anti-securitization | [V-ZH] |
| Sep 20, 2026 | First US-China AI dialogue (Bessent / He Lifeng, NY) | US proposes an AI incident alert system; China "restrained"; Shenzhen round planned in about 2 months | [V/S] |
| Sep 24-25, 2026 | Xi state visit to Washington | Xi: AI must stay under human control; cooperate against misuse; truce extended to Jan 10 | [S] |

**UN and multilateral posture:** China backs the UN Independent International Scientific Panel on AI and the Global Dialogue [S], led the capacity-building resolution [K], and signed both Bletchley and the Paris statement (the US and UK did not sign Paris) [K]. It pushes WAICO against US "Pax Silica" (launched Dec 2025, about 35 backers by 2026). Kazakhstan is reportedly in both [S].

## 2.9 Modeling guidance: realistic, not stereotyped

1. **Plural actors under steering.** Represent DeepSeek, Alibaba, Moonshot, Zhipu, MiniMax and ByteDance as sub-labs inside "DeepCent". They merge only at rung 3. Before that, give China a `Duplication_Penalty`: compute is split across labs, so effective frontier compute is about 30-40% of the national total [D].
2. **Self-reliance is a ratchet, not a bargaining chip.** Offering chips does not buy goodwill (R2).
3. **Openness is strategy.** Open weights win adoption, standards and soft power, and hedge against US controls. They stop only under centralization or a security shock.
4. **Safety discourse is real but bounded.** It shows up as frameworks, Track-2 work and Xi's "human control" line. It does not show up as compute caps or verification. Model it with `Safety_Concern` rising slowly (+5/yr) plus jumps on incidents.
5. **Diplomacy is norm-first and UN-centric.** Expect a yes to channels and statements, and a no to anything that legitimizes export controls.
6. **Content control is the binding domestic constraint.** Registry, labeling and ideology rules slow domestic consumer deployment but not research.
7. **The US-China lead is compute-determined but distillation-eroded.** Use the IFP formula.
8. **Escalation to theft and Taiwan is *conditional*.** The data support "rung 1-2 now". AI 2027's rungs 3-5 need a widening gap plus visible US strategic AI.

---

# PART 3 - SOURCES

[ZH] = Chinese-language. Accessed 2026-11-11.

**AI 2027**
- AI 2027 main scenario: https://ai-2027.com/
- Race ending: https://ai-2027.com/race
- Slowdown ending: https://ai-2027.com/slowdown
- Compute forecast: https://ai-2027.com/research/compute-forecast
- AI 2027 tracker, China centralization: https://ai2027-tracker.com/predictions/china-centralization/
- "Early Chinese Language Media Coverage of the AI 2027 Report" (LessWrong/GreaterWrong): https://www.greaterwrong.com/posts/JW7nttjTYmgWMqBaF/

**Official Chinese policy**
- [ZH] Xinhua, Politburo 20th collective study on AI (26 Apr 2025): https://www.news.cn/politics/20250426/8ab0df168a2f430aa4dea7dd7b511891/c.html ; gov.cn: https://www.gov.cn/yaowen/liebiao/202504/content_7021072.htm
- CSIS Interpret translation: https://interpret.csis.org/translations/at-the-20th-collective-study-session-of-the-ccp-politburo-xi-jinping-stressed-the-need-for-self-reliance-and-self-improvement-highlight-application-oriented-approaches-and-promote-the-healthy-and-o/
- CSET translation: https://cset.georgetown.edu/publication/xi-politburo-collective-study-ai-2025/
- [ZH] 国务院关于深入实施"人工智能+"行动的意见 (CAC repost): https://www.cac.gov.cn/2025-08/27/c_1758018277755538.htm ; PDF: https://work.ccpit.org/s9/public/db/lawChina/202510/国务院关于深入实施人工智能+行动的意见_科技_中国政府网_1756272572169.pdf
- [ZH] 10jqka summary of AI+ (6 actions, 8 supports): https://news.10jqka.com.cn/20250827/c670668652.shtml
- [ZH] 15th FYP Recommendations (Xinhua): https://www.news.cn/politics/20251029/87c9210f10aa43ec81aa976b79936509/c.html ; full-text repost: https://wallstreetcn.com/articles/3757789
- [ZH] 15th FYP Outline coverage (CLS): https://www.cls.cn/detail/2313247 ; CAC: https://www.cac.gov.cn/2026-03/17/c_1775482046495737.htm ; informatization plan PDF: https://www.cac.gov.cn/rootimages/uploadimg/1794509046730333/1794509046730333.pdf
- [ZH] 人工智能安全治理框架 2.0 (CAC): https://www.cac.gov.cn/2025-09/26/c_1760606717425964.htm ; https://www.yzwb.net/news/yw/202509/t20250915_264528.html
- [ZH] AI labeling measures in force (Xinhua): https://www.xinhuanet.com/tech/20250909/fb164c6d092146aa8e13ddc283fe416a/c.html ; https://www.stdaily.com/web/gdxw/2025-09/01/content_393211.html
- [ZH] GenAI filing statistics (Guangming, Jul 2026): https://m.gmw.cn/2026-07/10/content_1304528476.htm ; ITHome: https://www.ithome.com/0/950/045.htm
- [ZH] Compute statistics (MIIT/NDA): https://www.thepaper.cn/newsDetail_forward_31458752 ; https://www.stdaily.com/web/gdxw/2025-08/23/content_389429.html
- [ZH] National AI Industry Investment Fund / Big Fund III: https://news.pedaily.cn/202501/545683.shtml ; https://www.cls.cn/detail/1924269
- [ZH] AI comprehensive legislation (2026 plans): https://www.chinanews.com.cn/gn/2026/07-03/10651809.shtml ; https://finance.eastmoney.com/a/202605113733157692.html
- [ZH] Xi WAIC 2026 keynote (Xinhua): https://www.news.cn/politics/20260717/69107c2b8370406496d91bbcb84a63dc/c.html ; CAC: https://www.cac.gov.cn/2026-07/17/c_1786032880247252.htm
- [ZH] Tianwan unit 7 (MEE): https://www.mee.gov.cn/xxgk2018/xxgk/xxgk09/202610/t20261016_1183182.html ; People's Daily energy: https://paper.people.com.cn/zgnyb/pc/content/202608/17/content_30175919.html
- Global AI Governance Action Plan (MFA, English): https://www.fmprc.gov.cn/eng/xw/zyxw/202507/t20250729_11679232.html ; WAIC: https://english.shanghai.gov.cn/en-WAICLatest/20250729/7eb6b488993b4c8e81831a1195a4bbcc.html
- MERICS on the Xi WAIC 2026 speech: https://merics.org/en/comment/xi-addresses-china-and-world-rare-public-speech-ai ; Quartz: https://qz.com/xi-jinping-waic-china-open-source-ai-governance-071726

**Chips, compute, export controls**
- IFP, "How to Increase America's AI Lead Over China" (Fist, Adamson, Pilz, 19 Oct 2026): https://ifp.org/wp-content/uploads/How-to-Increase-Americas-AI-Lead-Over-China_IFP2026.pdf
- ChinaTalk, "How Much Compute Does China Have?" (Zakaria, 7 Apr 2026): https://www.chinatalk.media/p/how-many-chips-does-china-have
- Epoch AI geopolitics: https://epoch.ai/topics/geopolitics ; Huawei roadmap: https://epoch.ai/publications/huaweis-roadmap-to-2031 ; chip owners: https://epoch.ai/blog/introducing-the-ai-chip-owners-explorer
- SemiAnalysis, Huawei Ascend production ramp: https://newsletter.semianalysis.com/p/huawei-ascend-production-ramp
- Tom's Hardware, Huawei roadmap with in-house HBM: https://tomshardware.com/tech-industry/semiconductors/huawei-unveils-ascend-roadmap-backed-by-in-house-hbm ; 960 pull-in: https://www.tomshardware.com/tech-industry/artificial-intelligence/huawei-details-ai-accelerator-roadmap-pulls-in-next-generation-ascend-npus-by-quarters-fp4-performance-of-the-ascend-960pr-doubles-expectations
- Huawei keynote (Sep 2025): https://www.huawei.com/en/news/2025/9/hc-xu-keynote-speech
- SCMP, CAC summons Nvidia over H20: https://www.scmp.com/tech/tech-war/article/3320240/chinas-cyberspace-regulator-summons-nvidia-explain-h20-chips-alleged-back-door-risks
- TechCrunch, RTX Pro 6000D ban: https://techcrunch.com/2025/09/17/china-tells-its-tech-companies-they-cant-buy-ai-chips-from-nvidia/
- SAMR Nvidia finding (BNN Bloomberg): https://www.bnnbloomberg.ca/business/company-news/2025/09/15/china-says-preliminary-probe-shows-nvidia-violated-anti-monopoly-law/
- Foreign chips banned in state data centers (Reuters via NST): https://www.nst.com.my/amp/business/economy/2025/11/1309102/china-bans-foreign-ai-chips-state-funded-data-centres ; Trivium: https://triviumchina.com/2025/11/06/beijing-bans-foreign-ai-chips-in-state-funded-data-centers/
- H200 decision (Caixin): https://www.caixinglobal.com/2025-12-09/us-to-allow-nvidia-h200-chip-exports-to-china-with-25-cut-102391449.html ; Beijing limits (Axios): https://axios.com/2025/12/09/trump-nvidia-ai-h200-china
- Self-sufficiency data (Morgan Stanley via OfficeChai): https://officechai.com/ai/chinas-self-sufficiency-in-ai-chips-has-risen-from-20-in-2023-to-over-40-in-2026-morgan-stanley-data/ ; SCMP/IDC: https://www.scmp.com/tech/article/3358322/huawei-and-cambricon-lead-chinas-ai-server-chip-surge-piling-pressure-nvidia
- CXMT HBM: https://www.tomshardware.com/pc-components/dram/chinese-semiconductor-industry-gears-up-for-domestic-hbm3-production-by-the-end-of-2026-cxmt-to-produce-chips-while-naura-maxwell-and-u-preseason-design-tools-for-assembly
- Smuggling cases: https://www.theregister.com/2025/11/21/nvidia_china_smuggling_charges/ ; https://www.aljazeera.com/economy/2025/8/6/us-charges-chinese-nationals-with-illegally-shipping-nvidia-chips-to-china
- Compute vouchers and idle data centers: https://www.tomshardware.com/tech-industry/artificial-intelligence/china-subsidizes-ai-computing-for-small-domestic-companies-computing-power-vouchers-spread-across-multiple-chinese-cities ; ASPI: https://www.aspistrategist.org.au/abundant-electricity-isnt-enough-chinas-overbuilt-ai-computing-power-is-underused/
- Al Jazeera, "China vs US ... in four charts" (Sep 2026): https://www.aljazeera.com/amp/news/2026/9/24/china-vs-us-who-is-winning-the-ai-race-in-four-charts

**Industry and models**
- NIST CAISI evaluation of DeepSeek V4 Pro (May 2026): https://www.nist.gov/news-events/news/2026/05/caisi-evaluation-deepseek-v4-pro
- DeepSeek V4 (MIT Tech Review): https://www.technologyreview.com/2026/04/24/1136422/why-deepseeks-v4-matters/amp/ ; Tom's Hardware: https://www.tomshardware.com/tech-industry/artificial-intelligence/deepseek-launches-1-6-trillion-parameter-v4-on-huawei-chips-as-us-escalates-ai-theft-accusations
- Kimi K3: https://the-decoder.com/moonshot-ai-releases-kimi-k3-open-weights-and-infrastructure-after-shaking-up-the-frontier-model-race/ ; https://thezvi.substack.com/p/on-kimi-k3-its-capabilities-and-related
- DeepSeek state-led funding: https://thenextweb.com/news/china-big-fund-deepseek-45-billion-funding-round ; https://finance.yahoo.com/economy/policy/articles/deepseek-china-ai-boom-increasingly-100819588.html
- Zhipu IPO (Caixin): https://www.caixinglobal.com/2026-01-08/chinas-zhipu-ai-jumps-in-hong-kong-debut-102401610.html ; Moonshot valuation: https://www.euronews.com/2026/10/06/moonshot-ai-eyes-hong-kong-ipo-after-50-billion-valuation-as-deepseek-raises-capital
- Open model downloads: https://thenextweb.com/news/alibaba-qwen-downloads-hugging-face-open-models ; https://www.interconnects.ai/p/8-plots-that-explain-the-state-of
- OSTP distillation memo: https://www.nextgov.com/artificial-intelligence/2026/04/white-house-accuses-china-deliberate-industrial-scale-campaigns-steal-us-ai-models/413083

**Safety and attitudes**
- Carnegie (Sheehan and Singer), "How China Views AI Risks" (Oct 2025): https://carnegieendowment.org/research/2025/10/how-china-views-ai-risks-and-what-to-do-about-them
- AI Frontiers (Elmgren, Singer, Guest), "Is China Serious About AI Safety?" (Oct 2025): https://ai-frontiers.org/articles/is-china-serious-about-ai-safety
- DigiChina on CnAISDA: https://digichina.stanford.edu/work/what-do-we-know-about-chinas-new-ai-safety-institute/ ; Carnegie: https://carnegieendowment.org/research/2025/06/how-some-of-chinas-top-ai-thinkers-built-their-own-ai-safety-institute
- Concordia AI, AI Safety in China newsletter: https://aisafetychina.substack.com/ ; State of AI Safety in China 2025: https://aisafetychina.substack.com/p/state-of-ai-safety-in-china-report ; 2026 edition review: https://www.aigl.blog/state-of-ai-safety-in-china-2026/
- Shanghai AI Lab + Concordia frontier framework: https://aisafetychina.substack.com/p/shanghai-ai-lab-and-concordia-ai ; technical report: https://arxiv.org/abs/2507.16534
- [ZH] Andrew Yao on large-model deception (The Paper, Jun 2025): https://www.thepaper.cn/newsDetail_forward_31027926 ; Shanghai Consensus coverage: https://www.thepaper.cn/newsDetail_forward_31247753
- SCMP, Yao on deception: https://www.scmp.com/news/china/science/article/3315656/chinese-ai-expert-warns-existential-risks-when-large-models-begin-deceive
- IDAIS dialogues: https://www.far.ai/press/international-dialogues-on-ai-safety
- Ding Xuexiang at Davos (China Daily): https://www.chinadaily.com.cn/a/202501/22/WS6790bfd5a310a2ab06ea8a70.html ; SCMP: https://www.scmp.com/news/china/diplomacy/article/3295705/chinas-vice-premier-says-chaotic-competition-ai-could-bring-grey-rhino
- Public opinion: Al Jazeera on Edelman (Nov 2025): https://www.aljazeera.com/economy/2025/11/19/trust-in-ai-far-higher-in-china-than-west-poll-shows ; ChinAI #331 (Tencent survey): https://chinai.substack.com/p/chinai-331-chinese-public-perceptions
- ChinaTalk, Chinese reactions to Claude Mythos: https://www.chinatalk.media/p/chinese-reactions-to-claude-mythos ; MSS minister article: https://thenextweb.com/news/china-state-security-minister-claude-mythos-gpt-5-5-cyber

**Strategic behavior and diplomacy**
- DOJ, Linwei Ding guilty verdict: https://www.justice.gov/opa/pr/former-google-engineer-found-guilty-economic-espionage-and-theft-confidential-ai-technology
- Anthropic, GTG-1002 report: https://assets.anthropic.com/m/ec212e6566a0d47/original/Disrupting-the-first-reported-AI-orchestrated-cyber-espionage-campaign.pdf
- Jamestown, DeepSeek in PRC military systems: https://jamestown.org/program/deepseek-use-in-prc-military-and-public-security-systems/ ; The Decoder on PLA procurement: https://the-decoder.com/thousands-of-procurement-documents-show-how-chinas-army-wants-to-weaponize-ai/
- Taiwan drills: https://www.al-monitor.com/originals/2026/08/taiwan-holds-naval-drill-during-war-games-china-steps-maritime-pressure ; https://focustaiwan.tw/politics/202601030005 ; https://www.scmp.com/news/china/military/article/3366011/mainland-china-stepping-preparations-taiwan-blockade-report-says
- Lima nuclear-AI statement (NPR): https://www.npr.org/2024/11/16/nx-s1-5193893/xitrump-biden-ai-export-controls-tariffs
- Busan (Foreign Policy): https://foreignpolicy.com/2025/10/30/trump-xi-deal-soybeans-tariffs-rare-earths-taiwan-trade/
- Beijing summit (DigiChina forum): https://digichina.stanford.edu/work/forum-what-trump-and-xi-achieved-in-beijing-and-what-they-left-unresolved/ ; The Star: https://www.thestar.com.my/tech/tech-news/2026/05/16/trump-says-he-discussed-ai-guardrails-nvidias-chips-with-xi
- First US-China AI dialogue (SCMP): https://www.scmp.com/economy/policy/article/3368653/china-us-hold-first-ai-dialogue-amid-mounting-tech-tensions-commerce-ministry ; incident alert (ADN/AP): https://www.adn.com/nation-world/2026/09/21/in-talks-with-china-us-proposes-ai-incident-alert-system/
- Xi Washington visit: https://thenextweb.com/news/xi-washington-visit-trade-truce-ai-talks
- Pax Silica: https://evertiq.com/design/2026-01-16-us-launches-pax-silica-initiative-to-secure-global-ai-supply-chains ; Semafor, "Token diplomacy": https://semafor.com/article/07/28/2026/token-diplomacy-how-china-is-shaping-the-worlds-ai-future

**Not verified this pass (flagged [K] or [S] above):** the details of the 2017 AIDP, 2022-23 rules, and the 2023 compute plan targets (from background knowledge). The exact text of the 13 Action Plan points. Zhang Ya-Qin's and Xue Lan's individual 2025-26 quotes (none found). Talent travel controls and passport reports (carried over from 07). Whether the Shenzhen AI dialogue round (about Nov 2026) has happened.
