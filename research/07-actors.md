# 07 - Non-player actors: specs, presets, triggers (US Gov, US Public, Rival Labs, China, Allies)

Research date: 2026-11-11. Game window: mid-2025 to about 2030, with daily ticks.

**Confidence tags used below**
- **[V]**: the number or event was checked against a primary or major source in this pass. The URL is in Part 3.
- **[S]**: secondary reporting only, or the sources disagree. It is fine for game tuning but worth re-checking before you quote it.
- **[D]**: a design assumption or calibration choice. It is not a real-world statistic.
- **[A27]**: taken from the AI 2027 scenario text (main narrative, Race ending, Slowdown ending).

---

# PART 1 - GAME-READY ACTOR SPECS

## 1.0 Shared conventions

- Every meter is a float that clamps to its range. Meters change from (a) player actions, (b) world events (capability milestones, incidents, leaks), and (c) other actors' moves.
- Each actor has a **personality preset**. A preset is a set of multipliers on a common parameter schema: thresholds, reaction strength, lag, and decay. "Realistic" means one weighted random draw per actor at game start, using the weights given below. A Realistic draw can also apply small random jitter (about +/-10%) to the thresholds. [D]
- **Escalation ladders** are ordered rungs. An actor climbs one rung when a trigger condition stays true for `hold_days` (default 7 to 14) [D]. It goes back down one rung when the condition stays false for `cooldown_days` (default 30 to 60) [D]. Rungs marked **(sticky)** never de-escalate.
- **Capability milestones** come from the tech tree. They are named after AI 2027: Agent-0 (mid/late 2025), Agent-1 (early 2026), Agent-1-mini, Agent-2 (Jan to Feb 2027), Agent-3 (Mar 2027), Agent-3-mini public (Jul 2027), Agent-4 (Sep 2027) [A27]. Triggers below refer to "milestone M reached by OpenBrain" or "visible to actor X". What an actor can see depends on the player's transparency and briefing choices.
- **Pacing note.** The AI 2027 authors themselves moved their timelines later. Their Dec 2025 model put median full coding automation about 3 to 5 years past "2027". A Q1 2026 update moved Kokotajlo's Automated Coder median to about mid-2028 and Lifland's to about mid-2030 [S]. Consider a "Scenario speed" setting (AI-2027-fast / authors' 2026 median / slow) that scales milestone dates. Actor triggers are keyed to milestones, not dates, so they work at any speed.

---

## 1.1 US GOVERNMENT (Executive + Congress + Courts/States)

Model this as one actor with three sub-agents that have their own meters: **Executive** (White House, NSC, DoD, Commerce), **Congress**, and **Courts/States**. The Executive decides most actions. Congress and the Courts/States act as gates and brakes.

### Meters

| Meter | Range | Start (Jul 2025) | Basis |
|---|---|---|---|
| `AI_Priority` (how high AI sits on the national agenda) | 0-100 | **55** | AI 2027 puts AI at #5 on the admin priority list before Agent-2, then #2 [A27]. The Jan 2025 revocation of EO 14110, the 23 Jul 2025 AI Action Plan (90+ actions), and the Genesis Mission EO (24 Nov 2025) show AI already well up the agenda [V]. |
| `Reg_Stance` (-100 = deregulate/preempt, +100 = restrictive) | -100..+100 | **-60** | The Action Plan is "innovation over regulation" and includes the Woke-AI procurement EO [V]. The admin pushed a 10-year state-law moratorium, which the Senate struck 99-1 on 1 Jul 2025 [V]. The Dec 2025 EO set up a DOJ AI Litigation Task Force against state laws [V]. The Mar 2026 framework seeks broad preemption [V]. |
| `Security_Demand` (how much security, clearance, and oversight the government asks of OpenBrain) | 0-100 | **15** | DoD/CDAO frontier-AI prototype contracts are up to $200M each with OpenAI (Jun 2025) and Anthropic, Google, and xAI (Jul 2025) [V]. There are no clearance mandates yet. AI 2027 has security clauses only from Feb 2027 and clearances from May 2027 [A27]. |
| `Trust_OB` (trust in and access to OpenBrain) | 0-100 | **55** | [D]. The admin is friendly to the industry, but transactional. |
| `China_Hawkishness` | 0-100 | **50** | Mixed signals. The Diffusion Rule was rescinded (13 May 2025) [V]. The H20 was licensed in Apr 2025, then allowed again with about a 15% revenue share in Aug 2025 [S]. H200 sales to China were allowed with a 25% cut (Dec 2025 / Jan 2026) [V]. Blackwell remains banned [S]. |
| `Nationalization_Pressure` | 0-100 | **0** | AI 2027: nationalization is "raised" in Feb 2027 and rejected ("kill the goose") [A27]. |
| `Oversight_Level` (formal state control of OpenBrain decisions) | 0-5 rungs | **0** | See ladder G-SEC below. |
| Congress: `Congress_Activism` | 0-100 | **20** | Lots of hearings, almost no AI laws. GAIN AI / Chip Security Act were dropped from the NDAAs [S]. |
| Congress: `Control` | enum | **R trifecta** | Democrats won both chambers on 3 Nov 2026, so the new Congress sits Jan 2027 [V]. |
| States: `State_Reg_Pressure` | 0-100 | **35** | SB 1047 was vetoed in 2024. SB 53 was signed 29 Sep 2025 (in force 1 Jan 2026). The NY RAISE Act was signed 19 Dec 2025 (effective 1 Jan 2027). Colorado's AI Act is in place [V]. |
| Courts: `Judicial_Check` | 0-100 | **40** | An injunction (Mar 2026) blocked the Pentagon's "supply-chain risk" designation of Anthropic as First-Amendment retaliation [V]. Courts do constrain the executive. |

**Historical anchoring (optional, Realistic mode):** you can script the real events up to Nov 2026 to fire on their real dates:
- Action Plan: Jul 2025
- Genesis Mission: Nov 2025
- Preemption EO: Dec 2025
- Framework to Congress: Mar 2026
- Democratic Congress: Jan 2027

Each can be dropped or randomized if the player diverges.

### Parameter schema (preset multipliers)

| Param | Meaning |
|---|---|
| `accel_bias` | Weight on "win the race / grow the economy" in decisions |
| `security_bias` | Speed and strength of security, clearance, and control escalation |
| `reg_bias` | Tendency toward safety regulation and oversight |
| `transactional` | Willingness to trade policy for deals, investment pledges, revenue shares, or flattery |
| `hawk_bias` | China escalation strength (export controls, cyber, military planning) |
| `nat_threshold` | `Nationalization_Pressure` level at which DPA or nationalization becomes an option |
| `lag_days` | Bureaucratic delay before an action fires (AI 2027: DoD integration is "slow") |

### Personality presets

| Preset | Description | Param tweaks | Realistic weight | Justification |
|---|---|---|---|---|
| **Dealmaker** | Accelerationist and transactional. Preempts the states, trades chip access for revenue cuts and deals, and resists safety rules. Reacts mainly to stock market, China framing, and personal relations with CEOs. | accel 1.5, transactional 1.6, reg 0.4, security 0.8, hawk 0.8, nat_threshold 85, lag 20 | **45%** | Closest to actual 2025-26 behavior: the Action Plan, the H20/H200 revenue-share deals, the preemption EO, and the "light touch" framework [V]. |
| **Security Hawk** | A national-security state that treats AI as a weapon. Pushes fast clearances, wiretapping, tight export controls, DPA contingency planning, and cyber operations against China. Mostly AI 2027's own government. | security 1.6, hawk 1.6, accel 1.1, reg 0.7, nat_threshold 60, lag 10 | **25%** | AI 2027's default USG [A27]. Real hawkish elements exist: the Pentagon's Anthropic blacklisting showed willingness to coerce labs [V]. The bipartisan GAIN AI / Chip Security Act pushes [S]. |
| **Cautious Regulator** | Takes safety seriously. Strengthens CAISI-style testing, licensing and incident reporting, and opens arms-control channels with China. Most likely under a Democratic trifecta after 2028. | reg 1.6, accel 0.8, security 1.2, hawk 0.9, transactional 0.6, nat_threshold 70, lag 25 | **12%** | 80% of the public want safety rules even at the cost of speed [V]. Democrats took Congress in Nov 2026 [V]. State laws (SB 53, RAISE) model this approach [V]. |
| **Populist** | Swings with the polls. Turns on Big Tech when approval falls, and pushes jobs protection and data-center limits. Can be anti-lab and anti-China at the same time. | reg 1.2 (only when Public.Concern > 60), accel 1.0, transactional 1.2, poll_sensitivity 2.0, lag 15 | **13%** | Bipartisan populism: the 99-1 Senate vote against the moratorium [V], 71% local data-center opposition [V], AI super-PAC-backed Republicans mostly losing in 2026 [V]. |
| **Absentee** | Distracted by other crises (war, economy). Reacts late and weakly. Mostly lets labs self-govern until a crisis forces a jump. | all biases 0.6, lag 45, nat_threshold 90. But crisis_jump = 2x (it overreacts once it finally moves). | **5%** | A plausible tail case. AI 2027 notes procurement slowness [A27]. |

### Trigger → reaction rules

**G-SEC: Security/Control ladder** (driven by `Security_Demand`, which rises with milestones, leaks, and theft)

| Rung | Trigger (any) | Reaction | AI 2027 anchor |
|---|---|---|---|
| 0 Business as usual | start | Contracts, Genesis-style compute partnerships, voluntary testing | 2025-26 [V] |
| 1 Contract security clauses | OB reaches Agent-1 (or the AI-R&D multiplier is at least 1.5x) and `AI_Priority` > 60 | DoD contract adds security requirements. Player must spend on Security Level (SL) upgrades or lose `Trust_OB` -10. | Feb 2027 [A27] |
| 2 Embedded officials | Weight theft detected **or** Agent-2 briefing | Military/IC personnel join the security team. Player loses some freedom on deployment decisions (needs USG sign-off on external releases). `AI_Priority` → at least 85. | post-theft Feb 2027 [A27] |
| 3 Clearances + purge | Agent-3-level briefing, or `Security_Demand` > 70 | Everyone on frontier models needs a clearance within 60 days. 5-15% of staff (foreign nationals, "suspect" staff, safety sympathizers) are sidelined, which costs research speed and morale. Allies are cut out of the loop. | May 2027 [A27] |
| 4 Wiretap + lockdown + DPA contingency | Intelligence explosion visible (multiplier ≥ 10x) **or** a second theft attempt | Employee monitoring. Internet restrictions on the model. **DPA contingency plan** to seize trailing labs' datacenters (OB compute share 20%→50% [A27]). Pentagon plans kinetic options. A datacenter shutdown "kill-switch" is agreed. | Aug 2027 [A27] |
| 5 Oversight Committee (sticky) | Misalignment leak / whistleblower **and** `Public.Concern` > 65, **or** `Nationalization_Pressure` > `nat_threshold` | Joint OB–government committee of 5-10 executives plus 5-10 officials (including the President in the Slowdown ending). Key decisions are put to a vote (AI 2027: 6–4 either way). Spec changes need full-committee sign-off. The player keeps CEO powers only by winning committee votes. | Oct-Nov 2027 [A27] |

Alternative rung 5b, **Soft Nationalization / Consolidation (sticky)**: if the player cooperates (`Trust_OB` > 60), the DPA merges the top 5 trailing labs into OB. OB's compute share goes to about 50% and the rivals' AGI projects shut down [A27, Slowdown]. If `Trust_OB` < 30, OB gets **hard nationalization** instead: the CEO is replaced, the player gets a "fired CEO" game-over or plays as a committee member [D]. In AI 2027 the government "considered replacing the CEO but backed off after employee protests" [A27, Race].

**G-CHN: China policy ladder** (driven by `China_Hawkishness`)

| Rung | Trigger | Reaction |
|---|---|---|
| 0 Transactional controls | start | Chip sales to China with revenue cuts (H20 15%, H200 25%) [V/S]. Leading-edge chips (Blackwell) banned. |
| 1 Tightening | China gap < 4 months **or** a major smuggling bust | Revenue-share licenses revoked. Location verification considered (the Chip Security Act idea) [S]. |
| 2 Cyber retaliation | Weight theft attributed to China | Cyberattacks on the DeepCent/CDZ (AI 2027: "fail to cause serious damage") [A27]. China.Tension +15. |
| 3 Full denial | Gap < 2 months or the CDZ is publicly known | All AI chip and HBM exports to China barred. Secondary sanctions on smugglers' transit countries. |
| 4 Military planning (sticky) | Intelligence explosion and the gap is shrinking | Kinetic-strike plans on Chinese datacenters. Taiwan defense posture raised [A27]. |
| Off-ramp: Arms control | `reg_bias` × Public.Concern high, **or** China offers a treaty and the US lead < 3 months | Bilateral AI talks. Real anchor: AI-risk dialogue and incident-notification mechanism (US–China summits May and Sep 2026) [S]. Can lead to the AI 2027 Slowdown-style treaty and joint "Consensus" chips [A27]. |

**G-REG: Regulation and Congress rules**
- If `Public.Concern` > 60 and `Congress.Control` = opposition party → `Congress_Activism` +2/week. At 50 or more: hearings and subpoenas (AI 2027 Oct 2027 [A27]). At 70 or more: a bill on licensing, worker relief, or a pause gets a 30-day floor fight. The President vetoes unless the preset is Cautious Regulator or Populist and `Public.Concern` > 70. (Real: Trump said he will veto Democratic-led bills after the Nov 2026 midterms [S].)
- If `State_Reg_Pressure` > 50 and preset ≠ Cautious Regulator → the Executive files a preemption suit (DOJ AI Litigation Task Force, active from Jan 2026 [V]). It resolves in 90-180 days with P(win) = 1 - `Judicial_Check`/100. The 99-1 Senate vote shows that statute-based preemption is hard [V], so if Congress is involved, cap P(pass preemption statute) at 25%/year [D].
- Retaliation rule (from the Pentagon–Anthropic dispute [V]): if the player publicly refuses a government use case (e.g., mass surveillance or autonomous weapons) and the preset is Dealmaker or Security Hawk → P = 0.5 of a "supply-chain risk" or contract-blacklist action. The player's revenue from government work goes to 0. A court injunction comes after 30 days with P = `Judicial_Check`/100.
- Worker relief: if Public.JobAnxiety > 75 → job training and UI expansion (AI 2027 Aug 2027) [A27]. At > 85, or unemployment shock > 2 pts → COVID-style payments, then a bipartisan basic-income promise (Slowdown, May 2028) [A27].

### Player actions that affect the USG

| Player action | Effect |
|---|---|
| Brief officials on capabilities (transparency) | `Trust_OB` +, `AI_Priority` +, `Security_Demand` + (briefings speed up the security ladder) |
| Hide capabilities, internal-only deployment | `Trust_OB` slowly + (fewer surprises), but if a leak happens: `Trust_OB` −30 and a jump of 2 rungs |
| Invest in security (SL levels) | Lowers P(theft). Satisfies rung-1 and rung-2 demands. `Trust_OB` + |
| Lobby, donate to super PACs (Leading-the-Future style) | Moves `Reg_Stance` toward deregulation under Dealmaker. Backfires with Public if exposed. Real 2026: industry-PAC Republicans mostly lost [V] |
| Accept DoD contracts or military use | Revenue +, `Trust_OB` +, Public.Concern + (small). Safety-staff morale − |
| Refuse military use cases | See the retaliation rule |
| Support state or federal safety laws | `Reg_Stance` +, `Trust_OB` − under Dealmaker, + under Cautious Regulator |
| Propose arms control or safety cooperation with China | Opens the off-ramp if preset hawk_bias < 1.2 |
| Pledge US investment (data centers, jobs) | Big `Trust_OB` boost under Dealmaker (transactional × 1.6) |

---

## 1.2 US PUBLIC

### Meters

| Meter | Range | Start (Jul 2025) | Basis |
|---|---|---|---|
| `Concern` (general AI concern) | 0-100 | **50** | Pew Jun 2025: 50% more concerned than excited, 10% more excited, 38% equal [V]. |
| `OB_Approval` (net approval of OpenBrain) | -100..+100 | **-5** | Proxy is Altman, Dec 2025 TOP poll: about 26% favorable, 30% unfavorable, 44% no opinion [S]. Verasight Apr 2026: 18% favorable, 28% unfavorable, 31% unfamiliar [S]. AI 2027 targets: **-35** by Jul 2027 (25/60/15) and **-20** by Mar 2028 in the Slowdown ending [A27]. |
| `OB_Awareness` | 0-100 | **55** | About 44% have no opinion of Altman (Dec 2025) [S]. The share with no opinion shrinks with every headline. |
| `JobAnxiety` | 0-100 | **71** | Reuters/Ipsos Aug 2025: 71% worry AI will permanently put too many people out of work [V]. Bentley-Gallup: 73% (2025) → 79% (2026) expect fewer US jobs in 10 years [S]. |
| `XRiskFear` | 0-100 | **43** | YouGov: 43% concerned AI could end the human race (Jun 2025 reading) [S]. Sep 2026: 50% [S]. |
| `RegDemand` (support for safety rules over speed) | 0-100 | **80** | Gallup/SCSP Apr-May 2025: 80% keep safety rules even if development slows, 9% prefer speed [V]. 2026: 79% vs 7% [S]. |
| `Salience` (% naming AI as the top national problem) | 0-30 | **1** | [D]. I found no Gallup "most important problem" AI figure, so this start value is an assumption. AI 2027 reaches **20%** by Oct 2027 after the leak [A27]. |
| `Activism` (protests, NIMBY, extremism) | 0-100 | **8** | [D] start. Anchors: organized data-center opposition groups went from 396 at the end of 2025 to 833 in Mar 2026 [S]. Firebomb and shooting attacks on Altman's home in Apr 2026 [V/S]. AI 2027: a 10,000-person DC protest in late 2026 [A27]. |
| `DC_NIMBY` (local data-center opposition) | 0-100 | **45** | [D] for mid-2025. Real 2026 readings: Gallup Mar 2026 71% oppose local; UMass Sep 2026 65% oppose, 11% support [V/S]. Change Research says opposition grew sharply after 2025 [S]. |
| `AI_Companionship` (% who call an AI a close friend) | 0-30 | **2** | [D]. AI 2027: 10% (mostly young people) by Jul 2027 [A27]. |
| `Partisan_Gap` (Democrat minus Republican concern) | -50..+50 | **+15** | Economist/YouGov Sep 2026, share rating AI risk "very serious": Dem 53%, Rep 29% [V]. Pew 2026: Democrats now more distrustful of government regulation of AI (74% vs 61%) [S]. |

**Derived values**
- `Trust_Companies` ≈ 100 - 59. Pew: 59% have little or no confidence that US companies will develop AI responsibly, in both 2024 and 2026 [S].
- `Trust_Gov_Regulate` ≈ 33. Pew Feb 2026: 67% have little or no confidence the government can regulate AI effectively [S].

### Parameter schema
- `shock_sensitivity`: multiplier on news events
- `decay_rate`: drift back toward baseline (half-life in days)
- `jobs_weight`: how much unemployment feeds `Concern`
- `xrisk_weight`: how much misalignment news feeds `Concern`
- `benefit_weight`: how much product benefits, stock gains, and medical breakthroughs reduce `Concern`
- `mobilization`: how readily `Concern` becomes `Activism`
- `misinformation_vuln`: how much foreign propaganda bots amplify swings (AI 2027: Chinese and Russian bots amplify anti-AI sentiment [A27])

### Personality presets

| Preset | Description | Param tweaks | Realistic weight | Justification |
|---|---|---|---|---|
| **Anxious Majority** | Uses AI daily but distrusts it. Concern ratchets up with each incident and decays slowly. Mobilizes only after layoffs or leaks. | shock 1.0, decay half-life 120 d, jobs 1.2, xrisk 1.0, benefit 0.7, mobilization 0.8 | **50%** | Fits 2025-26 data: concern rising from 37% (2021) to 50% (2025) [V], harm>good 31%→39% (Gallup) [S], heavy use alongside low trust (Pew 2026) [S]. |
| **Populist Backlash** | Anger at billionaires, data centers, and lost jobs. Fast mobilization and NIMBY. Punishes politicians tied to AI money. | jobs 1.6, mobilization 1.5, DC_NIMBY growth ×2, OB_Approval drift −0.05/day while OB is in the news | **22%** | 2026 evidence: local opposition at 65-71% [V], 800+ opposition groups [S], Altman attacks [V], AI-PAC-backed candidates losing [V]. |
| **Tech Optimist** | Benefits dominate. Stock boom, medical breakthroughs, and cheap assistants win people over. Concern decays fast. | benefit 1.6, decay half-life 45 d, shock 0.7, mobilization 0.5 | **10%** | AI 2027 Race ending: the public is optimistic and safety becomes "a punchline" once benefits arrive [A27]. Real: 47% expect "many positive benefits" (YouGov Sep 2026) [V]. |
| **Doomer Wave** | X-risk framing dominates. Misalignment news has outsized impact. Pause demands. | xrisk 1.8, shock 1.3, mobilization 1.2 | **10%** | YouGov x-risk concern rising to 50% [S]. 68% support a pause and superintelligence-ban bill (advocacy-commissioned poll, treat cautiously) [S]. |
| **Distracted** | Other crises (economy, war) crowd AI out. Low salience. Opinion moves only on huge events. | shock 0.6, salience cap 8, mobilization 0.4 | **8%** | AI has historically been low-salience [D]. A plausible tail case. |

### Trigger → reaction rules

**P-OPINION (continuous, daily)**
- `Concern += jobs_weight·ΔUnemploymentShock + xrisk_weight·IncidentSeverity + 0.5·LeakSeverity − benefit_weight·BenefitEvents`. Then it decays toward its baseline (baseline rises +1 per major milestone, which is sticky). [D]
- `OB_Approval` is driven by OB-specific events: product launches (+), layoffs blamed on OB products (−), safety incidents and leaks (−−), visible public goods such as free medical tools (+). AI 2027 calibration: the Agent-3-mini release with jobs turmoil takes it to -35 [A27].

**P-ACTIVISM ladder** (driven by `Activism`, which = f(`Concern`, `JobAnxiety`, `Salience`) × mobilization)

| Rung | Trigger | Effect |
|---|---|---|
| 0 Online grumbling | start | none |
| 1 Local NIMBY | `DC_NIMBY` > 50 | New data-center sites get delay risk (+20-90 days) and higher permitting cost. (Real: Trump publicly attacked communities that block data centers [S].) |
| 2 Organized protests | `Activism` > 30 or a junior-dev jobs shock | PauseAI/StopAI-style protests. AI 2027: 10k in DC (late 2026) [A27]. Congress activism +. |
| 3 Mass movement | `Activism` > 55 and `Salience` > 10 | 100k+ marches, union strikes, campaign issue. A politician who embraces OB pays −X in the polls. Employees may defect or whistleblow (P per month). |
| 4 Radical fringe | `Activism` > 70, random draw | Violence against executives or facilities (real anchor: Apr 2026 attacks on Altman's home [V]). Player must spend on physical security. Moderates distance themselves, giving `Concern` a short −5 sympathy dip. |
| 5 Electoral realignment (sticky) | `Salience` > 15 at an election date (Nov 2026, Nov 2028) | The winning side adopts the public's position. Regulation is likely. A basic-income promise if `JobAnxiety` > 80 (AI 2027: both parties promise basic income by May 2028 [A27]). |

**P-LEAK rule:** a whistleblower leak of a misalignment memo → `Concern` +15, `Salience` ×3 (to about 20% within 2 weeks), `OB_Approval` −20, and it triggers G-SEC rung 5 checks. That is the AI 2027 Oct 2027 NYT leak [A27].

**P-RALLY rule:** a credible China threat event (theft made public, Taiwan crisis) → `Concern` toward OB −5 (rally effect) and support for "US must lead" +. Real: 79% say it is important for the US to have more advanced AI than other countries (Gallup 2025) [V].

### Player actions that affect the Public
- Releasing consumer products: approval up short-term and benefits up, but jobs shock with lag.
- Pricing, free tiers, and public-good deployments (medicine, education).
- Layoff-causing enterprise agents: JobAnxiety up.
- PR spend / advertising: approval up, saturates. Exposed astroturf: approval down a lot.
- Transparency reports, safety cases, and external audits: Concern down slightly, RegDemand satisfied.
- Funding worker transition programs or UBI pilots: JobAnxiety down, approval up.
- Data-center siting (community benefits vs fast-track): DC_NIMBY.
- Whistleblower policy: a strong policy reduces leak *severity* and raises leak *probability*.

---

## 1.3 US RIVAL LABS

Recommendation: run 3-4 named rivals, each with its own archetype, plus a "long tail" aggregate. Real-world inspirations are listed for flavor only, since the game uses fictional names (AI 2027 calls them "trailing US companies").

### Meters (per lab)

| Meter | Range | Start (Jul 2025) | Basis |
|---|---|---|---|
| `Gap_Months` (behind OpenBrain's best internal model) | 0-24 | **3-9** (spread across rivals) | AI 2027: rivals 3-9 months behind in mid-2025 [A27]. Real: the frontier is shared by about 3-4 labs. Open-weight models lag closed ones by about 4 months on average (Epoch, 2026) [S]. |
| `Compute_Share` (% of world AI compute) | 0-100 | OB 20 (AI 2027 by 2027). Rivals together about 50 so that US total ≈ 70-75 | US hosts about 75% of GPU-cluster performance (Epoch, May 2025) [V], or 72% of cumulative chip arrivals since 2022 (Q2 2026) [S]. AI 2027: US companies 70%, OB 20% in Aug 2027 [A27]. |
| `Safety_Posture` | 0-100 | per archetype | FLI AI Safety Index, Summer 2025: Anthropic C+ (2.64), OpenAI C (2.10), GDM C- (1.76), xAI D (1.23), Meta D (1.06) [V]. |
| `Openness` (weights release) | 0-100 | per archetype | Meta pivoted: first proprietary frontier model (Muse Spark / "Avocado"), Apr 2026 [S]. |
| `Lobby_Stance` (-100 deregulate .. +100 regulate) | -100..+100 | per archetype | Anthropic gave $20M to the pro-regulation Public First Action. a16z and the Brockmans gave about $50M+ to the pro-industry Leading the Future [S]. |
| `Cash/Valuation` | $ | per archetype | OpenAI PBC recap completed 28 Oct 2025, with about $1.4T / about 30 GW of compute commitments claimed [S]. SpaceX–xAI merger completed Feb 2026 (about $1.25T combined) [S]. |
| `Poach_Aggression` | 0-100 | per archetype | Meta's 2025 superintelligence hiring spree [D/flavor]. |
| `Cooperation_with_OB` (willingness to merge, share safety findings, accept DPA) | 0-100 | 20 | [D]. In the AI 2027 Slowdown ending, the top 5 accept soft nationalization for concessions [A27]. |

### Personality presets (assign one per rival)

| Preset | Description | Param tweaks | Realistic weight (per rival draw) | Inspiration / justification |
|---|---|---|---|---|
| **Safety Rival** | Competes at the frontier while lobbying for regulation. Publishes evals. Refuses some military uses. Rival-in-safety: it becomes a regulatory ally when OB is reckless and a critic when OB races. | safety 80, openness 15, lobby +60, poach 40, cooperation 50, gap 2-6 | **25%** | Anthropic: top FLI grade [V], RSP, Public First donor [S], refused surveillance/autonomous-weapons use and was blacklisted then won an injunction [V]. |
| **Big Tech Incumbent** | Deep pockets and its own chips. A steady fast follower that rarely leads on risk. Lobbies quietly for preemption and is risk-averse on PR. | safety 50, openness 30, lobby -20, compute ×1.5, gap 1-5, reaction lag 30 d | **30%** | Google DeepMind (TPUs, IL6/TS infrastructure for DoD [V]), Microsoft. |
| **Maverick Accelerationist** | Founder-driven, fastest build-out, weakest safety. Erratic launches with scandals. Politically connected. | safety 20, openness 50, lobby -70, build_speed ×1.5, scandal_rate ×2 | **20%** | xAI: FLI D grade [V], Colossus 2 gigawatt-scale with 59 unpermitted turbines reported [S], SpaceX merger [S]. |
| **Open-Weights Spoiler** | Releases near-frontier weights to commoditize rivals. That erodes OB's moat and feeds China and the public. May close up at the frontier. | openness 85 (drops to 40 if gap < 3 mo), safety 30, gap 4-9 | **15%** | Meta's Llama era, then its 2026 closed pivot [S]. AI 2027 also has an open-weights model matching Agent-0 in early 2026 [A27]. |
| **Boutique Upstart** | Small, elite team (ex-OB staff). Poaches talent, raises at huge valuations. Acquisition target. | poach 80, compute ×0.3, gap 6-15, acquisition_prob high | **10%** | SSI, Thinking Machines-type labs [D/flavor]. |

### Trigger → reaction rules

**R-RACE (continuous):** each rival's rate of closing the gap = base × compute share × talent − OB security level (theft/leak of algorithms) + open-weights spillover [D]. Rivals invest in giant datacenters ("Late 2025: rivals pour money into datacenters to keep pace" [A27]).

| Trigger | Reaction |
|---|---|
| OB releases a new frontier product | Rivals ship a matching product within `Gap_Months` × 0.5. Price war: OB margins down. |
| `Gap_Months` > 6 for a rival (falling behind) | **Lobby to slow OB.** Safety Rival or Big Tech: back regulation and testing mandates (AI 2027 Jul 2027: "lobby for immediate regulations to slow OpenBrain… too late" [A27]). Maverick: complain about OB's government favoritism, sue. |
| `Gap_Months` > 9 | Merger or acquisition talks. Open-Weights Spoiler releases its best weights out of spite or for strategy. |
| OB safety incident or leak | Safety Rival: public criticism plus a talent magnet (OB safety staff leave, `Poach` +). Maverick: exploits it ("our model is uncensored"). |
| G-SEC rung 3+ (clearances) | The same clearances are imposed on rivals with P = 0.6 (AI 2027: "some measures enacted at trailing companies" [A27]). |
| G-SEC rung 4/5b (DPA consolidation) | Each rival accepts soft nationalization with P = `Cooperation_with_OB`/100 + 0.3 if offered concessions. If it refuses: a court fight (Judicial_Check). |
| Player poaches or acqui-hires | Rival `Cooperation_with_OB` −20. Retaliatory poaching. |
| OB proposes joint safety standards / shared evals | Safety Rival +30 cooperation. Big Tech +10. Maverick −10 (calls it cartel behavior). |
| OB's government-favoritism visible | All rivals `Lobby_Stance` drift toward anti-OB positions. Antitrust complaints. |

### Player actions that affect rivals
Pricing, talent offers, security level (limits algorithmic leakage), open-sourcing older models, coalition offers (shared safety standards, compute sharing), lobbying for or against regulation (regulatory capture tends to help the leader), exclusive chip and power deals (starve rivals of compute), DPA cooperation.

---

## 1.4 CHINA (CCP + DeepCent)

### Meters

| Meter | Range | Start (Jul 2025) | Basis |
|---|---|---|---|
| `Compute_Share` (% world AI compute) | 0-100 | **13** | Epoch May 2025: China about 15% of GPU-cluster performance [V]. About 16% of cumulative arrivals in Q3 2023 → about 9.6% by Q2 2026 [S]. AI 2027: about 12% in mid-2026 and 10% in Aug 2027 [A27]. |
| `Gap_Months` (DeepCent vs OB) | 0-24 | **6** | Epoch (Jan 2026): Chinese models trailed the US by an average of 7 months (range 4-14) [S]. IFP: 6.5 months [S]. Stanford AI Index 2026: nearly closed on benchmarks [S]. AI 2027: 6 months in mid-2026 and 2 months after the theft [A27]. |
| `Centralization` (% of China's AI compute in the DeepCent collective / CDZ) | 0-100 | **0** | AI 2027: CDZ 0% (Dec 2025) → 40% (Feb 2027) → about 70% (Dec 2027). About 50% go to the collective at nationalization (mid-2026). More than 80% of new chips go to the Tianwan CDZ [A27]. Real precursors: travel pre-approval for "strategic" AI talent at DeepSeek and Alibaba (May 2026) [S]. Passport collection at DeepSeek (Mar 2025) [S]. |
| `Domestic_Chip_Capacity` | 0-100 | **20** [D] | Huawei Ascend roadmap: 950 (2026, in-house HBM), 960 (pulled forward to about Q1 2027), 970 (2028) [S]. DeepSeek V4 (Apr 2026) is optimized for Ascend, and Huawei claims partial training on Ascend [S]. |
| `Smuggling_Flow` | 0-100 | **40** [D] | FT: at least $1B of Nvidia chips entered China in about 3 months after the 2025 tightening [S]. DOJ cases: $160M "Gatekeeper" (Dec 2025) [S], Supermicro-employee case alleging about $2.5B in sales [S]. |
| `Espionage_Ops` (readiness to steal OB weights/algorithms) | 0-100 | **30** | AI 2027: intelligence agencies plan to steal weights by mid-2026. The theft is executed in Feb 2027 in under 2 hours [A27]. |
| `Taiwan_Tension` | 0-100 | **35** | Strait Thunder-2025A (Apr 2025). Justice Mission 2025 blockade/strike rehearsal (29-31 Dec 2025) after the $11B US arms sale [V]. |
| `Diplomatic_Openness` (to AI safety talks and treaties) | 0-100 | **45** | Global AI Governance Action Plan with 13 actions and the WAICO proposal (26 Jul 2025) [V]. WAICO founding with 29 countries reported (Jul 2026, single source) [S]. US–China AI-risk dialogue with an incident-notification mechanism announced at 2026 summits [S]. |
| `Safety_Seriousness` (domestic frontier-safety capacity) | 0-100 | **25** | CnAISDA founded Feb 2025, mostly for international engagement [S]. Concordia: about 26 Chinese frontier-safety papers/month. Only 3 of 13 developers publish risk evals [S]. FLI grades DeepSeek F and Zhipu F (Summer 2025) [V]. |
| `Open_Weights_Policy` | 0-100 | **85** | DeepSeek, Qwen, and Kimi release open weights. DeepSeek V4 is MIT-licensed [S]. |
| `Hawk_vs_Dove` (internal CCP faction balance, 0 = dove, 100 = hawk) | 0-100 | **45** [D] | AI 2027 frames choices as a hawk vs dove debate (Taiwan action vs re-theft, treaty overtures) [A27]. |

### Parameter schema
- `centralize_speed`
- `theft_propensity`
- `taiwan_risk`: probability multiplier on blockade or invasion rungs
- `treaty_propensity`
- `self_reliance`: refuses US chips even when offered. Real: China customs told agents not to clear H200s, and Beijing discouraged Nvidia purchases [S].
- `open_source_bias`
- `rd_multiplier_penalty`: AI 2027 has China at 10x vs US 25x in Aug 2027 [A27].

### Personality presets

| Preset | Description | Param tweaks | Realistic weight | Justification |
|---|---|---|---|---|
| **Hawkish Nationalizer** | AI 2027's China. Full CDZ, all-in centralization, theft as policy, Taiwan as a strategic lever. Treaty offers only from weakness. | centralize ×1.5, theft 1.5, taiwan 1.3, treaty 0.7, hawk_vs_dove +20 | **30%** | The default AI 2027 behavior [A27]. Talent travel controls show a willingness to securitize labs [S]. |
| **Open-Source Fast Follower** | Doesn't centralize hard. Many labs (DeepSeek/Qwen/Kimi) compete and release open weights to win the Global South and commoditize US models. Efficiency over scale. Theft is opportunistic. | centralize 0.6, open_source 1.5, theft 0.8, taiwan 0.8, treaty 1.0, rd efficiency +20% | **35%** | The best fit to 2025-26 reality: DeepSeek R1 / V4 open MIT weights [S], a 4-7 month lag [S], the AI+ diffusion plan (70% penetration target by 2027) [S]. |
| **Self-Reliance Builder** | Rejects US chips, pours resources into Huawei/SMIC. Low near-term compute but rising. Patient and avoids military risk until chip parity. | self_reliance 1.8, domestic_chip growth ×1.6, smuggling 0.7, taiwan 0.6, centralize 1.0 | **15%** | The H200 customs block [S], the Ascend roadmap acceleration [S], "AI+" plan through 2035 [S]. |
| **Cautious Bargainer** | Takes AI risk seriously at the top. Seeks arms control and verification, and offers concessions (AI 2027 Race: the General Secretary offers major concessions for a pause [A27]). Still steals if refused. | treaty 1.8, diplomatic_openness +25, safety +20, taiwan 0.7, theft 1.0 | **15%** | Global AI Governance Action Plan / WAICO [V], AI-risk dialogue 2026 [S], CnAISDA [S]. |
| **Taiwan Gambler** | Sees a closing window. Uses a blockade to cut US access to TSMC (TSMC supplies more than 80% of American AI chips per AI 2027 [A27]). | taiwan 2.0, hawk +30, theft 1.3, treaty 0.4 | **5%** | A low-probability tail. Rehearsals are real (Justice Mission 2025) [V]. |

### Trigger → reaction rules

**C-CENTRAL: Centralization ladder**

| Rung | Trigger | Reaction |
|---|---|---|
| 0 Fragmented market | start | Many labs, open weights, state subsidies, AI+ plan [S] |
| 1 Talent and info controls | `Gap_Months` > 5 **or** a US export tightening | Travel pre-approval for key researchers. Model-weight secrecy rules. (Real: May 2026 [S]) |
| 2 National champion / nationalization | Hawks' warning: OB reaches Agent-1 **and** Gap > 4 months (AI 2027 mid-2026) | DeepCent collective formed. About 50% of national AI compute pooled. CDZ construction begins (at Tianwan nuclear plant). >80% of new chips go to the CDZ [A27] |
| 3 Hardened CDZ | After a theft **or** US cyberattack | Air-gapped. Centralization → 40-70%. Open weights stop (`Open_Weights_Policy` → 10) |
| 4 War footing (sticky) | Gap is widening during the US intelligence explosion | All compute to the CDZ. Military integration of AI. Taiwan rungs unlocked |

**C-THEFT: Espionage ladder** (P(attempt) per month = `Espionage_Ops`/100 × theft_propensity × (value of OB's model) × (1 − OB Security Level factor)) [D]
1. Insider recruitment / algorithmic secrets leak (continuous, small gap reduction). AI 2027 has a Chinese spy surviving the clearance purge [A27].
2. Weight theft attempt: triggered once OB reaches Agent-2 **and** CCP awareness > 70 (AI 2027 Feb 2027, weights stolen "in under two hours" [A27]). Success → `Gap_Months` → about 2. US G-CHN rung 2 and G-SEC rung 2 fire.
3. Physical infiltration / repeat theft: the doves' alternative to Taiwan action (AI 2027 Aug 2027 [A27]).
4. Sabotage of OB datacenters or the power grid (only with Hawk preset and war footing).

**C-TAIWAN: Taiwan ladder** (driven by `Taiwan_Tension`)
1. Rhetoric and gray-zone activity (baseline)
2. Large drills (Strait Thunder / Justice Mission style) [V]. Fires on US arms sales, US export tightening, or theft-retaliation cyber events.
3. Military repositioning (AI 2027 Feb 2027 after the cyber exchange [A27]).
4. Quarantine/blockade: OB/US chip supply −50% for N months. Markets crash. US G-CHN rung 4.
5. Invasion (sticky): a world-state crisis. Branch to war mini-game or game over. Fires only if the preset is Taiwan Gambler, or Hawk with Gap > 6 and widening, or after a failed treaty.

**C-DIPLO: Treaty track**
- If `Gap_Months` is widening and Hawk_vs_Dove < 50 → offer an arms-control treaty. AI 2027 Aug 2027: "overtures… go nowhere" unless the USG preset is a Cautious Regulator or the player lobbies for it [A27].
- If Public/global misalignment alarm (e.g., an OB leak) → China joins European calls for a pause (AI 2027 Oct 2027: European leaders with India, Israel, Russia, and China demand a pause [A27]). `Diplomatic_Openness` +20.
- A successful treaty leads to verification regimes and the jointly designed "Consensus-1" chips/AI (both endings use this, with very different alignment outcomes [A27]).

**C-CHIPS: Response to US chip policy**
- US offers chips with revenue cuts → Self-Reliance preset refuses (the real H200 customs block [S]). Others buy, so `Compute_Share` +.
- US tightens → `Smuggling_Flow` +, `Domestic_Chip_Capacity` investment ×1.3, rare-earth and critical-mineral retaliation event (P = 0.3) [D].

### Player actions that affect China
OB security level (biggest lever on theft), open-sourcing (feeds DeepCent), lobbying for export controls or chip deals, publicizing China's progress (raises US hawkishness), Track-2 safety dialogues (raise `Diplomatic_Openness` and `Safety_Seriousness`), deploying to the Global South (competing with Chinese open models), staff vetting (cuts insider leaks but costs morale and talent).

---

## 1.5 ALLIES (optional): EU, UK, Taiwan, Five Eyes, Gulf

Model these as a single "Allies" actor with sub-meters, or as 3 mini-actors.

| Meter | Range | Start | Basis |
|---|---|---|---|
| `EU_Reg_Pressure` | 0-100 | **55** | The AI Act's GPAI obligations have applied since Aug 2025. The Digital Omnibus (proposed 19 Nov 2025) defers the high-risk rules to Dec 2027 / Aug 2028 [S], so pressure is easing. |
| `UK_AISI_Access` | 0-100 | **50** | AI 2027: the UK is kept "out of the loop" because commitments covered only external deployment [A27]. |
| `Taiwan_Supply_Security` (TSMC availability) | 0-100 | **90** | Coupled to China.`Taiwan_Tension`. |
| `Ally_Trust` (in the US/OB) | 0-100 | **60** | [D] |
| `Gulf_Compute_Deals` | 0-100 | **30** | [D]. 2025 US–Gulf chip deals happened but were not verified in this pass. |

**Presets:** **Regulatory Bloc** (EU enforces, fines OB, demands access; 30%), **Pragmatic Partners** (deregulatory drift like the Omnibus, want API access and investment; 45%), **Pause Coalition** (allies join global pause calls readily; 15%), **Hedgers** (Gulf and India court both the US and China; 10%) [D, weights informed by the EU Omnibus retreat [S]].

**Triggers**
- OB hides capabilities from allies, then a leak → `Ally_Trust` −30, and Europe calls pause summits, joined by India, Israel, Russia, and China (AI 2027 Oct 2027 [A27]).
- US shares siloed model access with Five Eyes → `Ally_Trust` +10 (AI 2027 Aug 2027 [A27]).
- China.Taiwan rung ≥ 4 → `Taiwan_Supply_Security` ≤ 40 → OB compute growth halves.
- In the Slowdown ending, European leaders call for an independent AI effort but lack the capability [A27].

---

## 1.6 Cross-actor coupling cheat-sheet

| Event | USG | Public | Rivals | China | Allies |
|---|---|---|---|---|---|
| OB hits Agent-1 / multiplier 1.5x | AI_Priority +10 | slight Concern + | race investment + | hawk warning → C-CENTRAL rung 2 check | - |
| OB consumer agent launch | - | approval +, JobAnxiety + (30-90 d lag) | match within ½ gap | open-model copycats | EU scrutiny + |
| Agent-2 briefing | G-SEC rung 1→2, nationalization raised | - | - | Espionage readiness → theft check | - |
| Weight theft | G-SEC +1, G-CHN rung 2 (cyber) | rally effect if public | clearances imposed | Gap → 2 mo, CDZ hardened | Taiwan drills |
| Junior-dev jobs shock | worker programs if Populist | Activism +, 10k protest [A27] | - | propaganda amplification | - |
| Misalignment leak | Congress subpoenas, rung 5 | Concern +15, Salience → about 20%, approval −20 | rivals lobby vs OB | joins pause calls | pause summits |
| DPA consolidation | rung 5b | mixed | rivals absorbed | Gap widens → hawk shift | - |
| Treaty | G-CHN off-ramp | optimism + | compute frozen | C-DIPLO success | join |

---

# PART 2 - KEY REAL-WORLD DATA TABLES

## 2.1 US public opinion on AI (national polls)

| Pollster | Field dates | Finding | Tag |
|---|---|---|---|
| Pew | 2021 | 37% more concerned than excited | V |
| Gallup/SCSP | 25 Apr - 5 May 2025 (n=3,128) | 80% keep safety and data-security rules even if slower vs 9% go fast. 97% AI should be regulated. 72% want independent experts testing. 79% say it is important for the US to have more advanced AI than other countries. 85% say global competition is underway. 2% fully / 29% somewhat trust AI to be fair | V |
| Pew | Jun 2025 (n=5,023) | 50% more concerned, 10% more excited, 38% equal. Global 25-country median: 34% more concerned | V |
| Reuters/Ipsos | 13-18 Aug 2025 (n=4,446) | 71% worry AI will put too many people out of work permanently. 77% worry about political chaos from rivals using AI. 66% worry about replacing relationships. 61% worry about electricity use. 67% say consequences will be uncontrollable | V |
| Tech Oversight Project | Dec 2025 (n=1,800 RV) | Altman about 26% favorable / 30% unfavorable / 44% no opinion | S |
| Pew | 17-23 Feb 2026 (n=5,119) | 67% little or no confidence the government can regulate AI effectively. 59% little or no confidence in companies (flat since 2024). Only 16% expect positive societal impact in 20 years vs 40% negative. Democratic distrust of government regulation went 54%→74% | S |
| NBC News | Mar 2026 | AI perception 26% positive / 46% negative | S |
| Gallup | Mar 2026 (released May) | 71% oppose an AI data center in their area (48% strongly). About 25% favor | V/S |
| Bentley-Gallup | 2026 | 39% say AI does more harm than good (31% in 2025). 9% more good. 79% expect fewer US jobs in 10 years (73% in 2025). 27% trust businesses to use AI responsibly (31% in 2025) | S |
| Verasight | 21-23 Apr 2026 (n=2,000) | Altman 18% favorable / 28% unfavorable / 31% unfamiliar | S |
| Axios Harris Poll 100 | May 2026 | OpenAI reputation partisan gap widened to 12 pts (Republicans more favorable) | S |
| AIPI (advocacy) | Jun 2026 (n=1,007 LV) | Mandatory standards beat no regulation 78-8 and beat an outright ban 66-21. Ban alone vs no regulation: 63-17 | S |
| Gallup/SCSP | Jun 2026 (n>3,000) | 79% keep safety rules vs 7% speed | S |
| YouGov | 11-14 Sep 2026 (n=18,294) | 50% concerned AI could end the human race (42% in Nov 2023). 67% say AI is advancing too fast | S |
| Economist/YouGov | 18-21 Sep 2026 | AI harm risk: 42% very serious (35% three weeks earlier). Dem 53% / Rep 29%. 47% expect many benefits vs 31% not. Trust on AI: Democrats 37% / Republicans 31% / equal 33% | V |
| UMass Amherst | Sep 2026 | 11% support a local AI data center, 65% oppose | S |
| ABC/WaPo/Ipsos | Oct 2026 | Majority say AI is bad for society. About two-thirds oppose new US data centers | S |

**AI 2027 calibration targets for the Public actor:** OB net approval −35% in Jul 2027 (25/60/15). 10% call an AI a close friend. 20% name AI the most important problem (Oct 2027). Net −20% in Mar 2028 (Slowdown). The stock market is up 30% in 2026. [A27]

## 2.2 US policy timeline (2023 to Nov 2026)

| Date | Event | Tag |
|---|---|---|
| 30 Oct 2023 | Biden EO 14110 on safe, secure, and trustworthy AI | V (well known) |
| 29 Sep 2024 | Newsom vetoes SB 1047 | V |
| 20-23 Jan 2025 | EO 14110 revoked. EO 14179 "Removing Barriers…" orders an action plan. Stargate ($500B) announced | V/S |
| Apr 2025 | H20 and similar chips put under license requirements ("is informed" letters) | S |
| 13 May 2025 | Commerce rescinds the AI Diffusion Rule before its 15 May compliance date and issues Huawei Ascend guidance | V |
| Jun-Jul 2025 | CDAO frontier-AI contracts up to $200M each: OpenAI (Jun), Anthropic, Google, xAI (14 Jul). Up to about $800M total | V |
| 1 Jul 2025 | Senate votes 99-1 to strip the 10-year state-AI-law moratorium from the reconciliation bill | V |
| 23 Jul 2025 | "Winning the AI Race: America's AI Action Plan" (3 pillars, 90+ actions) plus 3 EOs (Preventing Woke AI, data-center permitting, AI Exports Program) | V |
| Aug 2025 | H20 sales resume with a reported 15% revenue share to the US government | S |
| 29 Sep 2025 | California SB 53 (Transparency in Frontier AI Act) signed. Operative 1 Jan 2026 | V |
| Oct 2025 | GAIN AI Act passes Senate as an NDAA amendment. Dropped in conference (White House and SIA opposed) | S |
| 28 Oct 2025 | OpenAI recapitalization: PBC under the OpenAI Foundation (about 26%) with Microsoft at about 27% | S |
| 24 Nov 2025 | EO 14363 "Launching the Genesis Mission" (DOE AI-for-science platform. 90/120/240-day deadlines) | V |
| Dec 2025 | Trump allows H200 sales to China with a 25% cut. A Jan 2026 proclamation sets the 25% tariff mechanism. Blackwell and Rubin excluded | V/S |
| 11 Dec 2025 | EO "Ensuring a National Policy Framework for AI": DOJ AI Litigation Task Force (stood up 9-10 Jan 2026). Commerce list of "onerous" state laws due within 90 days. BEAD-funding leverage. Colorado named | V |
| 19 Dec 2025 | NY RAISE Act signed with chapter amendments aligning it toward SB 53. Effective 1 Jan 2027. Penalties up to $1M / $3M | V |
| Jan 2026 | China customs reportedly blocks H200 imports | S |
| 27 Feb - 5 Mar 2026 | Pentagon designates Anthropic a "supply chain risk" after it refuses to drop limits on mass domestic surveillance and fully autonomous weapons. The up-to-$200M contract is cut | V |
| 20 Mar 2026 | White House National Policy Framework for AI (Kratsios/Sacks): broad preemption of state AI-development rules, 27 recommendations. House GOP leaders back it. Blackburn's 291-page TRUMP AMERICA AI Act draft | V |
| 26 Mar 2026 | Judge Rita Lin (N.D. Cal.) enjoins the Anthropic designation as "classic illegal First Amendment retaliation" | V |
| Apr 2026 | Two attacks on Sam Altman's SF home (Molotov cocktail on 10 Apr, then gunfire) | V/S |
| May 2026 | Trump–Xi Beijing summit discusses AI guardrails and H200s. China announces a bilateral AI dialogue | S |
| Jun 2026 | NY-12 primary: Alex Bores (RAISE Act author) loses after more than $40M in outside AI money (Leading the Future about $8M against, Public First about $13-15M for) | V/S |
| Sep 2026 | Washington summit: a US–China AI-risk dialogue with an incident-notification mechanism listed among the deliverables | S |
| Oct 2026 | Chip-export measures (GAIN AI, Chip Security Act) reportedly left out of the final FY2027 NDAA talks | S |
| 3 Nov 2026 | Midterms: Democrats win the House and the Senate (AP about 54-44 with 2 seats outstanding). Most AI-super-PAC-backed Republicans lose. AI PACs spent about $79M across 68 races | V/S |

## 2.3 Real-world lab archetypes (inspiration for rival presets)

| Lab | Archetype | Key facts | Tag |
|---|---|---|---|
| OpenAI (closest analog to OpenBrain) | Scale-maximizing leader, commercially aggressive | PBC recap in Oct 2025. About $1.4T / about 30 GW compute commitments. Stargate. First DoD $200M award (Jun 2025). FLI C (Summer 2025) → C+ (Winter 2025). Co-founder Brockman a major donor to Leading the Future | S/V |
| Anthropic | Safety Rival | FLI top grade (C+). Refused surveillance and autonomous-weapon uses and was blacklisted by the Pentagon, then won an injunction. $20M to Public First Action. Backed state laws | V/S |
| Google DeepMind | Big Tech Incumbent | Own TPUs. Air-gapped IL6/TS offering to DoD. FLI C- → C | V/S |
| xAI (merged into SpaceX in Feb 2026) | Maverick Accelerationist | Colossus 2 gigawatt-scale (disputed). 59 unpermitted gas turbines reported. FLI D. "Grok for Government" | S/V |
| Meta Superintelligence Labs | Open-Weights Spoiler turning closed | Llama era, then Muse Spark ("Avocado"), its first proprietary frontier model (Apr 2026), with open-weight versions "planned". FLI D | S/V |
| Boutique (SSI, Thinking Machines, etc.) | Boutique Upstart | Talent-dense, compute-poor | D |

**Political money (2026 cycle):**
- Leading the Future (a16z and the Brockmans): $100M+ pledged, $125M raised in H2 2025 across the network, $31.5M cash after Q2 2026. Brockman pulled a second $25M in Jun 2026. [S]
- Public First (Anthropic $20M, Amodei $1M personally; target $75M). [S]

## 2.4 China data

| Item | Value | Tag |
|---|---|---|
| Share of global GPU-cluster performance (May 2025) | US about 75%, China about 15% | V (Epoch) |
| Share of cumulative AI chip compute arrived since 2022 | US 57.5%→72.2%, China 16.1%→9.6% (Q3 2023→Q2 2026) | S (Epoch via secondary) |
| Capability gap | Average 7 months (range 4-14), Epoch Jan 2026. 6.5 months, IFP. Nearly closed on benchmarks, Stanford AI Index 2026 (2.7% gap, Mar 2026). Open vs closed models: about 4 months | S |
| AI 2027 assumptions | 12% of compute and 6 months behind (mid-2026). Nationalization with CDZ at Tianwan. 50% of compute pooled. 80%+ of new chips to the CDZ. 2 months behind after the theft. 10% compute and 10x vs 25x research multiplier (Aug 2027) | A27 |
| DeepSeek V4 | Preview late Apr 2026: V4-Pro 1.6T params, V4-Flash 284B, 1M context, MIT license, optimized for Ascend. Huawei claims partial training on Ascend (Beijing called the claim baseless) | S |
| Huawei roadmap | Ascend 950 (2026, in-house HBM, Atlas 950 SuperPoD 8,192 NPUs / 8 EFLOPS FP8, Q4 2026). 960 (pulled forward to about Q1 2027). 970 (2028). 980 (2029) | S |
| US chips to China | H20: licensed Apr 2025, resumed Aug 2025 with about 15% revenue share. H200: allowed Dec 2025 with a 25% cut. Chinese customs blocked H200 entry (Jan 2026). Blackwell banned | S/V |
| Smuggling | At least $1B Nvidia chips in about 3 months of 2025 (FT). DOJ "Gatekeeper" $160M (Dec 2025). Supermicro-employee case (alleged $2.5B in sales, $510M diverted) | S |
| Talent controls | DeepSeek passports held (Mar 2025). Travel pre-approval for "strategic" AI researchers at DeepSeek and Alibaba (May 2026) | S |
| Governance | Global AI Governance Action Plan (13 actions) and WAICO proposal, 26 Jul 2025 (Premier Li Qiang, Shanghai). WAICO founding with 29 countries reported in Jul 2026 (single source) | V/S |
| Domestic diffusion | "AI+" Opinions (State Council Guofa [2025] No. 11, Aug 2025): over 70% penetration of agents and intelligent terminals by 2027, over 90% by 2030, an "intelligent society" by 2035 | S |
| Safety ecosystem | CnAISDA (Feb 2025, an international-facing body: Fu Ying, Andrew Yao, Xue Lan). Concordia: about 26 frontier-safety papers/month. 3 of 13 developers publish risk evals. FLI: DeepSeek F, Zhipu F (Summer 2025) | S/V |
| US–China AI diplomacy | May 2026 Beijing summit (AI guardrails discussed). Sep 2026 summit deliverable: an AI-risk dialogue with an incident-notification mechanism (led on the US side by Treasury Sec. Bessent) | S |
| Taiwan | Strait Thunder-2025A (Apr 2025). Justice Mission 2025 (29-31 Dec 2025): blockade and joint-strike rehearsal after the $11B US arms sale | V |

## 2.5 AI 2027 actor behavior digest (for designers)

- **USG:**
  - Late 2026: DoD contracts OB (slow procurement).
  - Feb 2027: Agent-2 briefing moves AI from #5 to #2 priority. Nationalization is rejected ("kill the goose"). Security clauses added. After the theft: military/IC staff embedded and failed cyberattacks on DeepCent.
  - May 2027: clearances within 2 months. Purge of foreign nationals, "suspect" staff, and safety sympathizers. UK kept out of the loop.
  - Aug 2027: tighter export controls, internet restrictions, wiretapping (the last spy is caught). DPA contingency to take trailing labs' compute (OB 20%→50%). Kinetic-strike planning. Datacenter shutdown system. Treaty seen as less favorable than unilateral lead-building.
  - Oct 2027: Congress subpoenas after the NYT leak. Oversight Committee.
  - Race ending: votes 6–4 to continue, then special economic zones and an arms deal with Consensus-1.
  - Slowdown ending: votes 6–4 to slow. Committee of 5-10 executives plus 5-10 officials including the President. DPA folds the top 5 rivals in (OB 50% of compute). Payments to displaced workers. Basic-income promises. VP wins 2028.
- **Public:** 10k DC protest (late 2026). Net −35% (Jul 2027). 10% AI friends. 20% name AI the top problem (Oct 2027). Chinese and Russian bots amplify the backlash.
- **Rivals:** 3-9 months behind (2025). Open-weights model matches Agent-0 (early 2026). Lobby to slow OB too late (Jul 2027). Some clearance measures. Consolidated in the Slowdown ending.
- **China:** 12% compute, nationalization, CDZ (mid-2026). Blockade or invasion discussed. Theft in Feb 2027. Air-gapped CDZ. Military repositioning around Taiwan. Aug 2027 hawks vs doves (Taiwan vs re-theft). Treaty overtures fail. Race ending: concessions for a pause refused, then collusion between DeepCent-2 and Agent-5. Slowdown ending: treaty, then the CCP falls in about 2030.
- **Allies:** UK out of the loop. Five Eyes get siloed Agent-3 access. Europe accuses the US of "creating rogue AGI" and calls pause summits joined by India, Israel, Russia, and China. Slowdown ending: Europe wants its own effort but lacks the capability. Russia hints at "strategic countermeasures".

---

# PART 3 - SOURCES

**AI 2027**
- Main scenario: https://ai-2027.com/
- Race ending: https://ai-2027.com/race
- Slowdown ending: https://ai-2027.com/slowdown
- AI Futures Q1 2026 timelines update: https://blog.aifutures.org/p/q1-2026-timelines-update (mirror https://lesswrong.com/posts/XLLjqMxETva3ABtsK/q1-2026-timelines-update)

**US policy**
- Genesis Mission EO 14363 (Federal Register): https://www.govinfo.gov/content/pkg/FR-2025-11-28/html/2025-21665.htm
- Genesis Mission coverage: https://www.axios.com/2025/11/24/trump-ai-genesis-mission-doe-chris-wright
- AI Action Plan (White House): https://www.whitehouse.gov/briefings-statements/2025/07/white-house-unveils-americas-ai-action-plan/
- AI Action Plan analysis: https://www.hklaw.com/en/insights/publications/2025/07/americas-ai-action-plan-whats-in-whats-out-whats-next
- Preemption EO (Dec 2025): https://axios.com/2025/12/11/trump-signs-executive-order-state-ai-laws
- Preemption EO analysis: https://www.jenner.com/en/news-insights/client-alerts/trump-administration-issues-executive-order-in-attempt-to-preempt-state-ai-laws
- Preemption EO, compliance limbo: https://www.spglobal.com/market-intelligence/en/news-insights/articles/2026/3/companies-face-compliance-limbo-as-trump-administration-targets-state-ai-laws-99326115
- White House AI framework (Mar 2026): https://rollcall.com/2026/03/20/white-house-ai-framework-calls-for-preemption-of-state-laws/
- White House AI framework, guiding principles: https://wtop.com/national/2026/03/white-house-releases-ai-policy-framework-for-congress-with-six-guiding-principles/
- Senate 99-1 moratorium vote: https://floridaphoenix.com/2025/07/01/repub/senate-votes-99-1-to-remove-ai-moratorium-from-megabill/
- SB 53 explainer: https://fpf.org/blog/californias-sb-53-the-first-frontier-ai-law-explained/
- RAISE Act: https://www.mofo.com/resources/insights/260105-new-york-enacts-the-raise-act-regulating-frontier-ai-models
- RAISE Act vs SB 53: https://fpf.org/blog/the-raise-act-vs-sb-53-a-tale-of-two-frontier-ai-laws/
- Diffusion Rule rescission: https://www.akingump.com/en/insights/ai-law-and-regulation-tracker/bis-rescinds-ai-diffusion-rule-and-issues-new-guidance
- H200 25% tariff: https://www.tomshardware.com/tech-industry/semiconductors/trump-introduces-25-percent-tariff-on-export-of-chips-including-nvidia-h200-amd-mi325x-figure-could-increase-in-the-future
- China blocks H200 at customs: https://fintool.com/news/china-blocks-nvidia-h200-customs
- GAIN AI Act / NDAA: https://www.nextgov.com/artificial-intelligence/2025/10/ai-export-control-bill-passes-senate-ndaa-amendment/408762/
- Chip restrictions unlikely in final NDAA: https://cryptobriefing.com/nvidia-chip-restrictions-unlikely-final-ndaa/
- DoD $200M frontier contracts: https://defensescoop.com/2025/07/14/pentagon-ai-contracts-musk-xai-google-openai-anthropic-cdao/
- Pentagon–Anthropic designation: https://www.axios.com/2026/02/27/anthropic-pentagon-supply-chain-risk-claude
- Pentagon–Anthropic formal notice: https://fortune.com/2026/03/06/pentagon-officially-defines-anthropic-as-supply-chain-risk/
- Anthropic injunction: https://www.npr.org/2026/03/26/nx-s1-5762971/judge-temporarily-blocks-trump-administrations-anthropic-ban
- 2026 midterms: https://www.boston25news.com/news/trending/election-2026-democrats-capture-both-houses-congress/5ILOWTVABVDPZFYP7VBBCX4EWE/
- 2026 midterm takeaways: https://www.washingtonexaminer.com/news/campaigns/4791815/takeaways-2026-midterm-elections/
- AI super PAC results: https://fortune.com/2026/11/04/candidates-backed-by-ai-super-pacs-result/
- NY-12 / Bores: https://www.notus.org/2026-election/alex-bores-artificial-intelligence-primary
- AI influence network: https://axios.com/2026/04/16/ai-influence-network-cash
- Pro-AI PAC cash: https://axios.com/2026/07/17/pro-ai-super-pac-ready-midterms
- Anthropic $20M: https://www.implicator.ai/anthropic-donates-20-million-to-counter-openai-backed-super-pacs-in-2026-midterms/

**Public opinion**
- Pew global (Oct 2025): https://www.pewresearch.org/global/2025/10/15/concern-and-excitement-about-ai/
- Pew key findings (Mar 2026): https://www.pewresearch.org/science/2026/03/12/key-findings-about-how-americans-view-artificial-intelligence/
- Pew 2026 coverage: https://thenextweb.com/news/pew-research-americans-ai-chatbot-skepticism-regulation-distrust-2026
- Gallup/SCSP 2025: https://news.gallup.com/poll/694685/americans-prioritize-safety-data-security.aspx
- Gallup/SCSP 2026 press release: https://www.gallup.com/file/analytics/714233/SCSP_Gallup_Report_2026_Press_Release.pdf
- Bentley-Gallup 2026: https://news.gallup.com/poll/712751/americans-cool-toward.aspx
- Bentley-Gallup coverage: https://decrypt.co/374794/more-americans-know-about-ai-less-they-like-gallup
- Reuters/Ipsos Aug 2025: https://www.ipsos.com/en-us/node/1064756
- Reuters/Ipsos coverage: https://www.eweek.com/news/americans-fear-ai-job-loss-survey/
- YouGov x-risk (2026): https://yougov.com/en-us/articles/55558-liberals-are-increasingly-likely-to-worry-about-ai-ending-humanity
- Economist/YouGov Sep 2026: https://yougov.com/en-us/articles/55608-many-americans-expect-big-benefits-from-ai-artificial-intelligence-concerns-are-rising-quickly-september-18-21-2026-economist-yougov-poll
- Economist/YouGov May 2026: https://yougov.com/en-us/articles/54762-most-americans-say-artificial-intelligence-ai-development-moving-too-fast-twice-as-many-ai-pessimists-as-ai-optimists-may-9-11-2026-economist-yougov-poll
- Data centers, Gallup: https://www.washingtontimes.com/news/2026/may/13/gallup-poll-7-10-americans-dont-want-ai-data-centers-near/
- Data centers, UMass: https://www.umass.edu/poll/about/reports/2026-09-national-public-opinion-poll-2
- Data centers, ABC/Post/Ipsos: https://abc30.com/story/most-americans-say-ai-is-bad-society-oppose-more-data-centers-abcpostipsos-poll/19964027/
- Data centers, Change Research: https://changeresearch.com/opposition-to-data-centers-has-grown-sharply-since-2025/
- Altman favorability, Verasight: https://data.verasight.io/ai/many-americans-are-unfamiliar-with-sam-altman
- Altman favorability, TOP Dec 2025: https://techoversight.org/wp-content/uploads/2026/01/TOP_MC_Trump-Relationship-to-Big-Tech_topline.pdf
- Axios Harris 100: https://axios.com/2026/05/19/axios-harris-poll-100-ai-politics
- AIPI Jun 2026: https://theaipi.org/wp-content/uploads/2026/06/AIPI_AI_Safety_Majority_Report.pdf
- Altman attacks: https://fortune.com/2026/04/15/pause-ai-and-stop-ai-meet-the-anti-ai-groups-facing-questions-after-the-attack-on-sam-altman/
- Altman attacks, two incidents: https://broadbandbreakfast.com/opposition-toward-openai-brings-two-violent-attacks-on-ceos-home/

**Labs**
- FLI AI Safety Index Summer 2025: https://futureoflife.org/ai-safety-index-summer-2025/
- FLI index page: https://futureoflife.org/index/ai-safety-index/
- OpenAI restructure: https://www.techzine.eu/news/infrastructure/135837/openai-completes-restructure-microsoft-continues-to-play-a-role
- OpenAI compute: https://www.pymnts.com/artificial-intelligence-2/2025/openai-aims-to-add-1-gigawatt-of-compute-per-week/
- Meta Muse Spark / Avocado: https://qz.com/meta-muse-spark-ai-superintelligence-labs-040826
- Meta closed models: https://www.engadget.com/ai/meta-is-reportedly-working-on-a-new-ai-model-called-avocado-and-it-might-not-be-open-source-215426778.html
- xAI / SpaceX: https://en.wikipedia.org/wiki/SpaceXAI
- xAI turbines: https://www.latintimes.com/epa-xai-unpermitted-methane-turbines-memphis-colossus-600811
- Colossus 2: https://newsletter.semianalysis.com/p/xais-colossus-2-first-gigawatt-datacenter

**China**
- Epoch, compute share by country: https://epoch.ai/data-insights/ai-supercomputers-performance-share-by-country
- Epoch, US vs China ECI: https://epoch.ai/data-insights/us-vs-china-eci
- Epoch, open vs closed gap: https://epoch.ai/data-insights/open-closed-eci-gap
- US compute share coverage: https://cryptobriefing.com/us-dominates-global-ai-compute-share/
- IFP, US lead over China: https://ifp.org/how-to-increase-americas-ai-lead-over-china/
- Global AI Governance Action Plan (MFA): https://www.fmprc.gov.cn/eng/xw/zyxw/202507/t20250729_11679232.html
- WAICO proposal: https://english.shanghai.gov.cn/en-WAICLatest/20250726/54fe55779ead485a8d71fafc68ff6c42.html
- WAICO founding report: https://cryptobriefing.com/waico-global-ai-cooperation-body-established/
- AI+ plan (CSET): https://cset.georgetown.edu/publication/china-ai-plus-opinions-2025/
- AI+ plan (Sheehan): https://mattsheehan.substack.com/p/chinas-big-ai-diffusion-plan-is-here
- DeepSeek V4 / Ascend: https://www.techrepublic.com/article/news-apac-deepseek-v4-ai-model-huawei-ascend-chips-support/
- DeepSeek V4 / Huawei chips: https://techwireasia.com/2026/04/deepseek-v4-huawei-ai-chips/
- Huawei roadmap 2025: https://www.rcrwireless.com/20250922/ai-infrastructure/huawei-ai-chips
- Huawei Ascend 960 (2026): https://techwireasia.com/2026/09/huawei-ascend-960-ai-infrastructure-11-chip-portfolio/
- Smuggling, Gatekeeper: https://www.theregister.com/2025/12/09/feds_bust_nefarious_plot_to/
- Smuggling, Supermicro case: https://www.techradar.com/pro/security/the-biggest-heist-of-the-us-china-chip-war-3-supermicro-employees-charged-with-conspiracy-to-smuggle-restricted-nvidia-h100-h200-and-b200-chips-to-china-dummy-boxes-fake-labels-and-a-pass-through-company-enabled-the-usd2-5-billion-scheme
- Smuggling, ALX case: https://www.aljazeera.com/economy/2025/8/6/us-charges-chinese-nationals-with-illegally-shipping-nvidia-chips-to-china
- Talent controls, DeepSeek (2025): https://techcrunch.com/2025/03/14/china-is-reportedly-keeping-deepseek-under-close-watch
- Talent controls, expansion (2026): https://thenextweb.com/news/china-expands-travel-curbs-private-ai-talent
- Concordia, State of AI Safety in China 2025: https://aisafetychina.substack.com/p/state-of-ai-safety-in-china-report
- Carnegie on CnAISDA: https://carnegieendowment.org/research/2025/06/how-some-of-chinas-top-ai-thinkers-built-their-own-ai-safety-institute
- Trump–Xi AI talks: https://bloomberg.com/news/articles/2026-05-15/trump-says-he-discussed-ai-guardrails-nvidia-s-chips-with-xi
- CSIS on the Trump–Xi summit: https://www.csis.org/analysis/what-trump-xi-summit-revealed-and-left-unsaid-about-us-china-tech-competition
- Stanford DigiChina forum: https://digichina.stanford.edu/work/forum-what-trump-and-xi-achieved-in-beijing-and-what-they-left-unresolved/
- Justice Mission 2025: https://news.usni.org/2025/12/29/china-launches-blockade-drills-around-taiwan-in-protest-of-u-s-arms-sales
- Justice Mission 2025 analysis: https://jamestown.org/pla-justice-mission-2025-further-rehearses-taiwan-invasion-operations

**Allies / EU**
- EU Digital Omnibus delay: https://knowledge.dlapiper.com/dlapiperknowledge/globalemploymentlatestdevelopments/2026/The-Digital-AI-Omnibus-Proposed-deferral-of-high-risk-AI-obligations-under-the-AI-Act
- EU Omnibus deadlines: https://cdp.cooley.com/digital-ai-omnibus-delays-key-deadlines-introduces-new-rules/

**Known gaps and caveats**
- No Gallup "most important problem" figure for AI was found, so the `Salience` start value is a design assumption.
- The 2025 US–Gulf chip deals were not verified in this pass.
- The final status of the Anthropic litigation and whether the Commerce "onerous laws" list was published were not confirmed.
- Epoch's 2026 compute-share figures come via secondary coverage.
- AIPI and Public Citizen polls are advocacy-commissioned.
