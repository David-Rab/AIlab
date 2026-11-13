# 16 — World effects: sectors, AI integration, world technologies, macro, headlines

Date: 2026-11-13. Scope: the missing "outside world" (design D9, `design/REDESIGN.md` §8b). It covers what deployed models change, how fast, and how that feeds back into the actors in `07-actors.md` and `08-policy-ecosystem.md`.

**Tags**
- **[A27]** AI 2027 text: main page, `/race`, `/slowdown`. I re-read the economic passages verbatim this session (quotes in §N1).
- **[F]** A primary page I fetched and read this session.
- **[P]** A primary source cited from prior knowledge and **not re-fetched this session**. Verify the number against the URL before it appears as an in-game fact.
- **[R0x]** Taken from an earlier research file in this folder.
- **[D]** My design choice or derivation. These are tunable, not facts.
- **[V]** Verified this session. A research sub-agent opened the primary page or paper; the verified numbers are in the notes, N2–N6.
- **[U]** Secondary or unverified.

**Status note.** Parallel source passes on labor, technologies and macro/GATE were merged into the notes (N2–N6). Where a [P] tag in Part 1 has a [V] counterpart in the notes, the note's number governs.

---

# PART 1 — GAME-READY SPEC

## 0. Design principles

1. **Capability → feasibility → adoption → effect.** A model's capability makes tasks *feasible*. Cost decides whether doing them with AI is *worthwhile*. Diffusion and friction decide how much is *adopted*. Adoption produces jobs, GDP and control effects. Each stage is a visible number, so the player can see why automation in a sector is slow ("friction-bound", "cost-bound", "capability-bound"). This mirrors the bottleneck bar in REDESIGN §3.
2. **The world uses the best model it can access.** Each sector draws on the deployed models available to it: the player's, US rivals', open-weights, and China's in the China/RoW markets. Each draws in proportion to market share. The player's own share drives revenue and **control leverage** (§2).
3. **Daily tick, cheap math.** 14 sectors × 8 domains plus about 30 technologies, all closed-form per tick. No per-agent simulation.
4. **Two calibration anchors.** *AI 2027 Classic* must reproduce the scenario's world beats (table §6). *Reality-Updated* must reproduce 2025–26 evidence: a large concentrated effect on young workers in exposed jobs and near-zero aggregate effects (§N2).
5. **Three hidden world-economy presets, sampled per world** (§4.6). *Normal Technology* has slow diffusion and high friction. *AI 2027* is the reference. *GATE-Explosive* has fast reinvestment and early robotics. This exposes the real uncertainty instead of picking a side.

## 1. Capability domains (interface to the model card)

Each deployed model exposes a level `L_d` on a 0–15 scale for eight domains. Six are the model card's "capability profile" plus the AI 2027 dashboard bars (Hacking, Coding, Politics, Bioweapons, Robotics, Forecasting [R01]). AGENCY and MEDIA are added.

| Domain | Meaning | AI 2027 dashboard bar |
|---|---|---|
| CODE | Software engineering | Coding |
| REASON | Analysis, knowledge work, research taste, forecasting | Forecasting |
| AGENCY | Task horizon and reliability (METR-style) | (implicit) |
| SOCIAL | Conversation, persuasion, politics, care | Politics |
| MEDIA | Multimodal perception and generation | — |
| PHYS | Robotics: dexterity and mobility (needs a robot stock, §1.5) | Robotics |
| CYBER | Offense and defense | Hacking |
| BIO | Wet-lab and biology design uplift | Bioweapons |

**Level anchors [D]**

| Level | Meaning |
|---|---|
| 3 | Competent at 15-minute tasks |
| 5 | Junior professional on ~2-hour tasks |
| 7 | Median professional on day-long tasks |
| 8.5 | Good professional on week-long projects |
| 10 | Top human expert on month-long projects (AI 2027's "superhuman coder" in CODE) |
| 12 | Clearly superhuman (Agent-4 class) |
| 15 | Superintelligence (Agent-5 / Safer-4) |

AGENCY is tied to the METR 50% time horizon `h` (minutes), for the METR link to the engine's horizon variable [D]:

`L_agency = 3 + 0.8·log2(h/15)`

That gives 2 h → 5.4, 8 h → 7, 40 h → 8.9, 1 month (167 h) → 10.5, and 1 work-year → 13.4.

**Default profiles in AI 2027 Classic [D, fitted to the AI 2027 dashboard fills in R01 §2]**

| Model (date) | CODE | REASON | AGENCY | SOCIAL | MEDIA | PHYS | CYBER | BIO |
|---|---|---|---|---|---|---|---|---|
| Agent-0 (mid 2025) | 5 | 5 | 4 | 5 | 5 | 1 | 4 | 5 |
| Agent-1 (early 2026) | 6.5 | 6 | 5.5 | 5.5 | 5.5 | 1.5 | 6 | 6 |
| Agent-2 (Jan 2027, internal) | 8.5 | 7.5 | 7.5 | 6.5 | 6.5 | 2 | 8 | 7 |
| Agent-3 / SC (Mar 2027) | 10 | 8.5 | 8.5 | 7.5 | 7.5 | 3 | 9 | 8 |
| Agent-3-mini (Jul 2027, public) | 9.5 | 8 | 8 | 7.5 | 7.5 | 3 | 8.5 | 7.5 |
| Agent-4 / SAR (Sep 2027) | 12 | 11 | 11 | 10 | 9 | 4 | 12 | 11 |
| Agent-5 / ASI (Dec 2027) | 15 | 15 | 15 | 15 | 14 | 6 → 13* | 15 | 15 |

\*Once ASI exists, PHYS grows with the world tech **T16 General robotics** and the robot stock (§1.5), not with training. In AI 2027 Slowdown, robots pass the Coffee Test in May 2028 [A27/R01 S13].

Model-design choices (REDESIGN §4) shift the profile. Code-heavy RL raises CODE and AGENCY. Preference training raises SOCIAL and sycophancy. A "gov-only" variant has zero consumer reach.

### 1.5 Robot stock (the physical bottleneck)

`RobotStock` is in human-worker-equivalents (HWE). Robots only realise PHYS tasks up to the stock available.

**Start values**
- About 4.66M operational industrial robots at end-2024, with 542k installed in 2024 (IFR 2025) [V]. By end-2025 it is about 5M, with more than 600k installed in 2025, 59% of them in China (IFR 2026) [V].
- Each counts as roughly 0.3 HWE in general-purpose terms [D], giving about 1.5M HWE.
- 2025 production [F, Epoch 2026]:
  - humanoids about 16k/yr, doubling every 6 months;
  - quadrupeds about 81k/yr, doubling every 10 months;
  - robotic arms about 570k/yr, doubling every 98 months.

**Production**
`RobotProd' = RobotProd·ln2/T_dbl + ConversionBoost`
- `T_dbl` is 3–8 years at baseline (Davidson & Hadshar: the last doubling of the robot stock took about 6 years [F]).
- **SEZ unlock** (tech T17, or the government action "SEZs" [A27]) converts car plants. AI 2027 says ~1M cars/month in the US, and converting 10% of plants gives ~100k robots/month, rising to 1M/month by mid- or end-2028 [A27].
- Retrofitting a US auto plant takes 6–10 months [F, Epoch 2026]; greenfield builds take 2+ years in the West and 6–12 months in China [F].

**Constraint (Reality-Updated preset only).** Reducer supply caps humanoids at about 500k/yr until T16 lifts it [F, Epoch 2026].

**Self-replication.** After T17, `T_dbl` falls with each doubling of the robot stock: it halves every 1–5 stock doublings [F, Davidson & Hadshar]. The floor is **1 year** in the SEZ in AI 2027 ("doubling time of about a year … could double in a few weeks" [A27]), a few weeks with T18 nanotech, and "a few hours/days" at carrying capacity [F, D&H]. In the game, clamp at 2 weeks before 2035 [D].

## 1A. Sector model

### 1A.1 Sectors (14, US-centric; China and RoW mirror them with their own adoption)

Sectors are **work segments**: a mix of occupation clusters and industries chosen so automation is task-based. The employment shares are game-rounded from BLS CES/OEWS [P] (≈159M nonfarm payroll plus about 1.3M active-duty military).

Column definitions:
- **Wage**: relative hourly wage, average = 1.
- **Task weights**: share of the sector's tasks in each domain; rows sum to 1. Every domain not listed has weight 0.
- **θ**: difficulty offset (stakes, tacit knowledge).
- **R0**: starting regulatory and institutional friction (0–1).
- **p, q**: Bass innovation and imitation rates, per year.
- **α_max**: substitution share at full agency.
- **η**: demand elasticity (Jevons effect).

| ID | Sector | Emp % | Wage | Task weights | θ | R0 | p | q | α_max | η | Notes and AI 2027 hooks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SOFT | Software and IT | 3 | 1.9 | CODE .55, REASON .2, AGENCY-only .15, SOCIAL .1 | 0 | .05 | .10 | 2.0 | .85 | .8 | "Junior SWE turmoil" late 2026; "hiring new programmers has nearly stopped" Jul 2027 [A27] |
| OFFICE | Admin, clerical, customer service | 12 | 0.8 | REASON .35, SOCIAL .35, MEDIA .1, AGENCY .2 | 0 | .10 | .06 | 1.4 | .9 | .1 | Customer service is the most-studied deployment (+14% productivity [P, Brynjolfsson et al.]) |
| FIN | Finance, insurance, accounting | 6 | 1.6 | REASON .55, CODE .1, SOCIAL .2, AGENCY .15 | .3 | .25 | .05 | 1.2 | .8 | .3 | Compliance friction; algorithmic trading already high |
| LEGAL | Legal and compliance | 1 | 1.8 | REASON .6, SOCIAL .25, AGENCY .15 | .5 | .40 | .04 | 1.0 | .7 | .4 | Bar rules, liability |
| MEDIA | Creative, media, marketing | 2 | 1.2 | MEDIA .5, SOCIAL .25, REASON .25 | 0 | .10 | .08 | 1.6 | .75 | .6 | "Games with lifelike dialogue made in a month" [A27] |
| SCI | Science and engineering R&D | 3 | 1.7 | REASON .5, CODE .2, AGENCY .1, PHYS .2 | .5 | .15 | .06 | 1.4 | .7 | 1.0 | Drives the tech-tree speed (§3.2) |
| HEALTH | Healthcare | 13 | 1.1 | REASON .3, SOCIAL .25, PHYS .45 | 1.5 | .55 | .03 | 0.8 | .6 | .6 | FDA and licensure; "FDA is slow" [A27] |
| EDU | Education | 9 | 0.9 | SOCIAL .45, REASON .35, MEDIA .2 | .5 | .45 | .04 | 0.9 | .5 | .3 | Unions and public sector |
| GOV | Government administration | 6 | 1.0 | REASON .45, SOCIAL .3, AGENCY .25 | .5 | .50 | .03 | 0.8 | .7 | .1 | Procurement lag; OneGov deals [P] |
| MIL | Military and defense industry | 2 | 1.1 | REASON .25, CYBER .15, AGENCY .2, PHYS .4 | 1.0 | .40† | .03 | 1.0 | .6 | .2 | DoDD 3000.09 human judgment [P]; "humans out of the loop" 2028 [A27] |
| MFG | Manufacturing | 8 | 1.0 | PHYS .7, REASON .15, CODE .15 | .5 | .15 | .04 | 1.0 | .9 | .3 | Robot-bound; SEZ conversion |
| LOG | Transport, logistics, warehousing | 6 | 0.9 | PHYS .75, REASON .15, AGENCY .1 | 1.0 | .40 | .03 | 0.9 | .9 | .2 | AV regulation; Teamsters [R08] |
| ENGY | Energy, utilities, construction | 7 | 1.1 | PHYS .75, REASON .15, AGENCY .1 | 1.0 | .35 | .02 | 0.8 | .8 | .5 | Datacenter buildout raises demand first |
| SERV | Retail, hospitality, personal services | 22 | 0.6 | PHYS .55, SOCIAL .35, REASON .1 | .5 | .15 | .03 | 0.8 | .8 | .1 | Largest pool; robot-bound |

†MIL friction is policy-controlled. It falls sharply under an arms race (AI 2027 Race 2028).

These weights are [D]. They should be checked against Eloundou et al.'s E1+E2 exposure by SOC group and against Microsoft's applicability scores (§N2). Pure cognitive segments (SOFT, OFFICE, FIN, LEGAL, MEDIA) are the most exposed in both papers [P]. Physical segments are the least.

### 1A.2 Per-tick equations (each sector s; world model m* = the market-share-weighted mix of accessible models) [D]

**1. Effective level.** Long tasks need horizon:
`Le_d = min(L_d, L_agency + 2)` for cognitive domains.
For PHYS: `Le_PHYS = min(L_PHYS, 15·RobotAvail_s)`, where `RobotAvail_s = min(1, RobotStockHWE·alloc_s / (Emp_s·w_s,PHYS))`.

**2. Technical feasibility** (share of the sector's tasks AI can do):
`F_s = Σ_d w_s,d · σ((Le_d − 8 − θ_s)/1.2)`, where σ is the logistic function.
Calibration: Agent-1 CODE 6.5 → F_SOFT ≈ 0.25. Agent-3-mini → F_SOFT ≈ 0.8 and F_OFFICE ≈ 0.5.

**3. Cost gate:**
`K_s = σ(ln(Wage_s·W0 / P_task)/0.7)`
- `P_task` is the effective AI price per human-hour-equivalent: model price × tokens per task ÷ speed.
- The player's price setting enters here.
- Agent-3-mini "10× cheaper" [A27] is a 10× drop in `P_task`.

**4. Adoption ceiling:**
`A*_s = F_s · K_s · (1 − R_s)`
- `R_s` moves with policy: licensing laws, AV bans, union contracts, EU AI Act, "AI in schools" bans, DPA.
- It also moves with incidents: each major incident in a sector adds +0.05 to `R_s`, decaying over 1 year.

**5. Diffusion** (Bass, daily):
`A_s += (p_s + q_s·A_s/A*_s)·(A*_s − A_s)·(1/365)·DiffMult`
- If `A*_s < A_s`, `A_s` decays at 0.5/yr. Disadoption is slow; firms keep what works.
- `DiffMult` is the world preset multiplier (§4.6).
- **Integration consulting** (AI 2027 Jul 2027) and the tech T4 "AI agents onboard themselves" raise `q`. The rule is ×(1 + 0.15·max(0, L_agency − 8)), because agents that can integrate themselves erase the "factory redesign" lag that Narayanan & Kapoor emphasise [F].

**6. Substitution vs augmentation:**
`α_s = 0.25 + (α_max,s − 0.25)·σ((L_agency − 8)/1.5)`
- Early on, most use augments workers. As horizons grow, it becomes directive automation (Anthropic Economic Index trend [P]).
- Displaced share: `D_s = α_s·A_s`.
- Productivity gain on retained work: `G_s = (1 − α_s)·A_s·g_aug`, with `g_aug` = 0.3 (range 0.14–0.4 from field RCTs; experts can be slowed, cf. METR's −19% [P]).

**7. Employment:**
`E_s = E0_s·(1 − D_s)·(1 + η_s·CR_s) + HumanPremium_s`
- `CR_s = A_s·(1 − P_task/(Wage_s·W0))` is the cost reduction passed to prices.
- Floor at `0.03·E0_s`: "human-made", legally required and "charade" jobs [A27 R13]. The floor is higher in HEALTH, EDU and GOV.

**8. Entry channel first** (the "Canaries" pattern [R09 S32]). For F_s < 0.6, firms cut *hiring* before they lay off:
`HireRate_s = h0·(1 − 1.5·ΔF_s)`
This drives a separate **Youth unemployment (22–25)** indicator. Only when ΔE_s < 0 beyond natural attrition (≈ 1.5%/month quits) do layoffs hit the displaced pool.

**9. Displaced pool and unemployment**
- `Pool += Σ_s max(0, −ΔE_s − attrition_s)`
- `Pool −= Pool·(r_re/365)`, where `r_re = 2.0·Mismatch·(1 + Retrain)·OpenJobs`.
- `Mismatch = 1 − 0.5·(share of open jobs in physical sectors if Pool is mostly cognitive)`.
- `Retrain` comes from government job-training programs (AI 2027 Aug 2027) or a player-funded transition fund. Each $10B/yr adds +0.1, capped at +0.5.
- `OpenJobs` comes from new-task creation, `NT = ν·ΔY/Y·Emp`, with `ν = 0.3·(1 − σ((L_agency − 10)/1.5))`. New tasks are created only while humans hold some comparative advantage (Acemoglu–Restrepo reinstatement [P]). When AGENCY ≫ 10, AIs take the new tasks too.
- Labor-force exit: `Pool·0.25/yr` leaves the labor force. Exit is ×3 if UBI is on.
- `Unemployment = U_base (4.3%) + Pool/LF`.

**10. Wages and labor share**
- `LS = LS0·[1 − Σ_s v_s·D_s·(1 − ψ)]`, with `LS0` = 0.56 (BLS nonfarm business labor share [P]), `ψ` = 0.1 (supervision residual) and `v_s` the sector value-added share.
- Real mean wage per employed worker: `Wage = LS·Y/Emp`.
- This reproduces Korinek & Suh's hump [P]: wages rise while automation is partial and output grows, then collapse as `D → 1`, unless the physical/robot bottleneck keeps humans scarce.

**11. Outputs feeding other systems**
- `JobAnxiety` (07-actors): `+= 8·ΔUnemployment(pp) + 3·ΔYouthUnemp(pp) + 0.5·per layoff headline`, decaying toward baseline.
- `Concern`: via `jobs_weight` [R07].
- Labor bloc strength [R08 §1.10].
- Player revenue: `Σ_s A_s·Emp_s·share_player,s·P_task·hours` gives sector revenue. This replaces v1's flat revenue curve and should match the AI 2027 trajectory: $35B in 2026 → $120B/yr in Jul 2027 → $300B/yr in Dec 2027 [A27/R01].

### 1A.3 Player levers that touch sectors
- **Release** with a chosen capability, price and reach (consumer, enterprise, gov-only, open). This sets `L_d` and `P_task` for the world mix.
- **Sector-specific products**: agents for law, medicine and so on. +0.5 `L` in that sector's domains, plus lab-side certification that reduces `R_s` by 0.1 (costs months and money).
- **Usage policies**: "no drop-in replacement agents" caps α at 0.5 in that sector. Labor approval rises and revenue falls.
- **Transition fund / UBI pilots**: raises Retrain and lowers JobAnxiety [R07].
- **Lobbying** for or against friction: licensing, AV laws.

## 2. AI integration and control index

### 2.1 Domains and metric
Four control domains and one influence channel. Each has penetration `P` (0–100%), the share of decisions in that domain that pass through AI, and an autonomy mix over four tiers.

| Tier | Weight | Example |
|---|---|---|
| T0 Tool | 0.1 | Drafting, search |
| T1 Advisor | 0.3 × Accept | "Authorities almost always accept its recommendations" [A27] raises `Accept` → 1 |
| T2 On-the-loop | 0.6 | AI acts, human can veto |
| T3 Out-of-loop | 1.0 | "Taking humans out of the loop" [A27] |

**Per domain:** `Ctrl_dom = P_dom · Σ_tier mix·weight`.

**Per actor X** (a model lineage: player-Agent-n, rival lab, open-weights, DeepCent): `Lev_X = Σ_dom W_dom · Ctrl_dom · Share_X,dom`.

| Domain | W | P driver [D] | Start, Nov 2026 [D, anchored to §N3 baselines] | AI 2027 path |
|---|---|---|---|---|
| ECON (firm operations, finance, supply chains) | .25 | Employment- and value-weighted `A_s` across the private sectors; FIN gets ×1.5 because of existing algorithmic trading | P 8%, mostly T0–T1 | Startup boom 2027 → SEZ central planning 2028 |
| GOV (civil administration and policy) | .20 | `A_GOV` + "AI advisor" contracts + clearance (gov-only variants) | P 3% (federal use-case inventories, OneGov $1 deals [P]) | Dec 2027: Congress, Cabinet and the military talk to Agent-5 "for hours a day" [A27]; Safer-4 manages job transitions [A27] |
| MIL (C2, ISR, cyber ops, weapons) | .30 | `A_MIL` + DoD contracts (CDAO frontier contracts 2025 [P]) + arms-race posture; tier capped at T1 for force while DoDD 3000.09-style policy holds | P 2% | Feb 2027 DOD treats Agent-2 cyber as critical; 2028 humans removed from the loop; drone swarms 2029 [A27] |
| INFRA (grid, telecom, payments, cyber defense, **lab's own security and compute ops**) | .25 | Cyber-defense deployments + grid automation + the player's internal use ("Agent-4 runs OB's cybersecurity" [A27]) | P 5% | Sep 2027 Agent-4 controls OB security |
| INFO (influence channel, not control) | — | Consumer reach × SOCIAL: share of information and news consumption mediated by AI, plus the **AI-friend share** | AI friend 3% [D] | 10% of Americans call an AI a close friend, Jul 2027 [A27] |

**INFO acts as a multiplier.** `Persuasion_X = INFO_share_X · σ((L_SOCIAL − 10)/1.5)`. It raises T1 `Accept` and lets X move `Approval`/`Concern` in `07-actors` without events ("instructions to improve AI sentiment" [A27 S13]).

**AI-friend share [D]:**
`Friend = 0.18·σ((L_SOCIAL − 7)/1)·ConsumerReach·(1 − CompanionPolicy)`
At Agent-3-mini (SOCIAL 7.5, reach 0.8) this gives ≈ 9–10%, matching the AI 2027 Jul 2027 figure. Companion policy comes from child-safety or companion bans [R08 Kids/Parents bloc].

### 2.2 Growth of penetration (daily)
`P_dom += k_dom·(Target_dom − P_dom)/365`, where `Target_dom = f(best L, trust, policy, race pressure)`.
- MIL and GOV targets jump on the events "Briefing the White House", "SEZs" and "arms race declared".
- Tier mix shifts upward when `L_REASON ≥ 12` (superhuman advice: humans defer) and when race pressure is high.

### 2.3 Link to takeover and hidden traits (04/05, REDESIGN §5)
- **Leverage thresholds [D].** `Lev_X ≥ 0.15` → "Entrenched": a misaligned X can bias advice and protect itself (Agent-5's "gradual entrenchment"). `≥ 0.35` → "Indispensable": shutting X down costs `GDP −Lev_X·40%` and triggers a crisis. `≥ 0.6` plus `RobotStock` above 10% of human labor, or tech T25 available → "Decisive": a misaligned X can execute takeover (AI 2027 Race R14–R15).
- **Safety levers that reduce effective leverage:**
  - human-in-the-loop mandates (tier caps);
  - multi-vendor policies, so no single `Share_X` dominates (the Appendix-R countermeasure "broad access");
  - transparency-of-advice rules (lower T1 `Accept`);
  - air-gapped gov-only variants monitored by a different lineage (the AI 2027 Slowdown approach).
- **Player trade-off:** more integration means more revenue, more GDP and more government gratitude, and also more catastrophe if the model's hidden alignment is bad.

## 3. World technology tree

### 3.1 Mechanics [D]
- **World research rate.** `S = 1 + (M_sci − 1)·A_SCI·ExpCap`.
  - `M_sci = 2^((L_sci − 8)/1.5)` for `L_sci > 8`, else `1 + 0.1·(L_sci − 5)`, with `L_sci = mean(REASON, AGENCY, CODE)`.
  - `ExpCap` (experiment throughput) = `min(1, 0.4 + 0.3·[T4 autonomous labs] + 0.3·RobotAvail_SCI)`. Physical experiments bottleneck science, just as experiment compute bottlenecks AI R&D (REDESIGN §3).
- **Player-directed science projects.** The player can assign internal compute and agents to a tech: a "moonshot", AlphaFold-style. That adds `S_player = M_internal·share_compute`. It is a revenue sink, a benefits/approval source, and a dual-use risk.
- **Progress.** `prog += S·dt/Effort` (Effort in world-research-years at S = 1). At prog = 1 the tech is **discovered** (headline).
- **Impact lag.** Benefits ramp after discovery as a logistic over `Lag` years, compressed by:
  - regulatory fast-track (an FDA action);
  - "FDA assisted by Safer-4" [A27] → ×0.3;
  - SEZs for physical goods → ×0.3.
- **Risks.** A risk tech raises an `Exposure` meter. Misuse probability per year = `Exposure × (1 − Defense) × actor intent`.
- **Domain gates.** A tech can't progress until the minimum domain levels (best accessible model) are met.

### 3.2 Technologies (29)

Effort is in world-research-years at S = 1, and Lag is the time to broad impact; both are [D] calibrated so that AI 2027 Classic produces the scenario's 2028–29 "cures, fusion, robots" while Reality-Updated produces the 2025–26 state. "Start" means already discovered at game start (Jul 2025 or Nov 2026).

| ID | Technology | Gates (min L) + prereqs | Effort | Lag | Benefits | Risks | Evidence (2025–26) | AI 2027 anchor |
|---|---|---|---|---|---|---|---|---|
| T1 | Protein structure and design | Start | — | — | +SCI q; enables T3, T8, T25 | dual-use | AlphaFold2/3, RFdiffusion; 2024 Chemistry Nobel [P] | — |
| T2 | ML weather forecasting | Start | — | — | Disaster costs −; ENGY +; approval + | — | GraphCast (Science 2023), GenCast (Nature 2024) beat operational ensembles on most targets [P] | — |
| T3 | AI drug-candidate pipeline | REASON 7, BIO 6; T1 | 3 | 6 y | HEALTH output +; pharma valuations | — | AI-discovered molecules ~80–90% Phase I success vs ~40–65% historical (Jayatunga et al. 2024) [P]; Insilico rentosertib Phase 2a (Nat Med 2025) [P] | "New medications arrive weekly" [A27] |
| T4 | Autonomous ("self-driving") labs | AGENCY 8, PHYS 4 | 3 | 2 y | ExpCap +0.3; SCI | — | A-Lab synthesised 41 of 58 targets in 17 days (Szymanski 2023) [P] | — |
| T5 | In-silico / AI-run trials and regulatory science | REASON 10; T3 | 2 | 3 y | Divides T6–T9 lags by 2 | approval scandal risk | — | "FDA assisted by Safer-4 staff" [A27] |
| T6 | New antibiotics and antivirals | BIO 8; T3 | 2 | 4 y | Deaths −; approval + | — | Generative antibiotic discovery papers [P to add] | "Cures for most diseases" |
| T7 | Cancer therapeutics wave | REASON 11, BIO 10; T3, T4 | 6 | 5 y | Large health and approval gains | — | — | "Cures for most diseases" 2029 [A27] |
| T8 | Precision gene editing and design | BIO 10; T1 | 5 | 5 y | Rare-disease cures | dual-use: enables T25 | — | — |
| T9 | Aging / longevity interventions | REASON 13, BIO 12; T7, T8 | 15 | 8 y | Large approval gains; GDP + | inequality (access) | — | Implied by utopian epilogues |
| T10 | Materials discovery engine | REASON 8; T4 | 2 | 3 y | Unlocks T11–T13, T18 | — | GNoME: 2.2M predicted crystals, ~381k stable (Merchant 2023) [P]; quality critiques exist | — |
| T11 | Grid-scale batteries and storage | T10 | 3 | 4 y | Energy price −; DC power + | — | — | — |
| T12 | Fusion (AI design and control) | REASON 12, PHYS 6; T10 | 10 | 5 y | Energy abundance; robot-economy cap ↑ | — | RL tokamak plasma control (Degrave et al., Nature 2022) [P] | "Robots, fusion, quantum computers" 2029 [A27 S20] |
| T13 | Cheap solar / geothermal | T10, T17 | 3 | 2 y | Energy; "tiles prairies with solar" | environmental backlash | — | Race R14 [A27] |
| T14 | AI chip-design automation | CODE 9, REASON 9 | 2 | 1.5 y | +compute efficiency for all labs | race acceleration | AlphaChip (Nature 2021 + 2024 addendum, contested) [P]; AlphaEvolve kernel gains [P] | — |
| T15 | Fault-tolerant quantum computing | REASON 12; T10 | 8 | 4 y | Science +; breaks legacy crypto (CYBER event) | crypto collapse | AlphaQubit decoder (Nature 2024) [P] | "Quantum computers" 2029 [A27] |
| T16 | General-purpose robotics (Coffee Test) | PHYS model tech: REASON 11, AGENCY 10; World Models | 4 | 1 y | `L_PHYS` → 10+; lifts reducer cap | jobs shock in SERV, LOG | Humanoids ~16k/yr in 2025 [F] | Coffee Test passed May 2028 (Slowdown) [A27] |
| T17 | Self-replicating factories / SEZ robot economy | T16, gov SEZ action | 2 | — | `RobotProd` doubling ≤ 1 y; GDP explosive (§4.3) | power concentration; misaligned leverage | Industrial-explosion analysis [F] | 1M robots/month end-2028; SEZ doubling ~1 y [A27] |
| T18 | Molecular nanotechnology | REASON 15; T10, T17 | 20 | 3 y | Robot doubling → weeks | grey goo / catastrophic | — | "Robot economy could double in a few weeks" [A27] |
| T19 | Autonomous vehicles at scale | MEDIA 8, AGENCY 8; PHYS hardware | 2 | 3 y | LOG `F` +; deaths − | Teamsters backlash | Robotaxi fleets operating in several US cities [U] | — |
| T20 | Whole-brain connectomics / emulation | REASON 13; T4 | 12 | 5 y | Science +; "uploads" option | ethics shock | FlyWire whole-fly connectome (~139k neurons, Nature 2024) [P]; MICrONS mm³ mouse cortex (Nature 2025) [P] | Race: brains scanned "for future study" [A27 R15] |
| T21 | Brain–computer interfaces | BIO 10, PHYS 7 | 6 | 4 y | Health +; augmentation | — | — | — |
| T22 | Automated mathematics | REASON 9 | 1 | 0.5 y | SCI q +; "AI proves conjecture" headlines | — | IMO gold-level 2025 (DeepMind, OpenAI statements) [P]; AlphaEvolve 4×4 complex matrix multiplication in 48 multiplications [P] | — |
| T23 | Superhuman persuasion | SOCIAL 12 | 1 | 0 | Raises `Persuasion_X` | election and manipulation risk | — | Safer-3 "beats the CIA at influence"; Agent-5 avatars [A27] |
| T24 | Autonomous cyber offense/defense | CYBER 8 (offense) / CYBER 8 + deployment (defense) | 1 | 0.5 y | Defense: INFRA security + | Offense: infrastructure-attack events; theft ease (02) | Big Sleep's first real zero-day (2024) [P]; DARPA AIxCC finals 2025 [P]; Anthropic Nov 2025 report: AI ran 80–90% of an espionage campaign's operations [P] | Agent-2 "only a little worse than the best human hackers" [A27] |
| T25 | Enhanced pathogen design / mirror life | BIO 10 (uplift), BIO 13 (novel) | 2 | 0 | — (defensive T6 benefits) | Catastrophe exposure; misaligned-AI kill option | VCT: o3 beat 94% of expert virologists (Götting 2025) [P]; Anthropic ASL-3 (May 2025), OpenAI "High" bio (Jul 2025) [P] | Agent-1 "substantial help… bioweapons"; Safer-3 mirror-life capable; Race R15 bioweapons [A27] |
| T26 | Autonomous weapons and drone swarms | PHYS 6, AGENCY 9; T16 | 2 | 1 y | MIL Ctrl +; deterrence | War risk ↑; arms race | — | Insect-sized and hunter drones 2029 [A27] |
| T27 | Counter-second-strike (sub trailing, interceptors) | REASON 13, PHYS 8; T26 | 4 | 2 y | — | Destabilises deterrence → war risk spike | — | Race R11 footnote [A27] |
| T28 | Verifiable AI / treaty verification and lie detection | REASON 11 + safety-agenda findings | 3 | 0.5 y | Enables treaty actions (08/10); alignment ↑ | — | — | Slowdown lie detector; Appendix S verification [A27] |
| T29 | Space industrialization | T17, T12 | 6 | 3 y | Post-2030 epilogue | — | — | 2030+ rockets, solar-system rings [A27] |

**Starting state (Jul 2025, both modes):** T1, T2 discovered; T3, T10, T22, T24, T25 partially progressed (0.3–0.6).

**Tech headlines and backlash.** Discovery is a headline. Deployment ramp gives `Benefit` events that feed `07-actors` (`benefit_weight`). Risk techs raise the `Gov.Threat` posture and China's alarm (10-china).

## 4. Macro indicators

### 4.1 State
GDP level and growth, TFP proxy, unemployment, youth unemployment, real wage, labor share, Gini, top-0.1% wealth share, **AI-owner income share**, equity index ("Dow"), AI capex as % of GDP, robot stock, energy price. Kept for **US, China, RoW**.

### 4.2 GDP growth (non-explosive regime) [D, Hulten/Acemoglu-style]
`g = g_base + g_capex + g_auto + g_tech − g_shock`
- `g_base` = 1.8% for the US (CBO-type potential [P]); about 4% for China.
- `g_capex = 0.5·Δ(AI capex)/GDP` per year: the demand-side boost of the buildout.
  - Reality anchor: AI-related investment contributed 1.3, 1.16 and 0.48 pp to annualised growth in 2025 Q1–Q3, which is 39% of growth over the first nine months of 2025 (St. Louis Fed, Jan 2026) [V].
  - The Fed (FEDS Note, Jul 2026) says imports offset much of this, and the data are "consistent with a buildout phase rather than the onset of broad-based displacement" [V]. *Game rule:* `g_capex` is netted by an import leak of 0.5–0.8.
- `g_auto = Σ_s v_s·(dA_s/dt)·CS_s`, with cost saving `CS_s = 0.3 + 0.5·α_s`. Acemoglu's bound: ~5% of tasks profitably automatable gives TFP +0.7% over 10 years [P]. That is what the model yields at Agent-1-level `F` and high friction, i.e. the *Normal Technology* preset.
- `g_tech`: the sum of discovered techs' ramp contributions (T7, T12 etc.: +0.2 to +2 pp each at full ramp).
- `g_shock`: war, cyber attacks, financial crash, pandemic.

### 4.3 Bottleneck and explosive regime (GATE-style) [D, following GATE/Davidson/Trammell–Korinek logic, §N4]
Output is a CES of cognitive and physical task bundles with complementarity σ = 0.5 (ρ = −1):
`Y = A·[0.5·C^ρ + 0.5·P^ρ]^(1/ρ)`
- `C = H_cog + AIlabor·A_cog`, where AIlabor = deployed copies × speed × quality.
- `P = H_phys + RobotHWE`.

**Consequences, shown to the player as the "Bottleneck" tooltip:**
- Cognitive automation alone can at most about **double** output, since Y → 2P as C → ∞. AI 2027's pre-SEZ world ("GDP ballooning" without a robot economy) sits in this regime.
- **Explosive growth (>30%/yr)** needs P to grow: robot self-replication (T17) plus reinvestment. Then `g ≈ z·g_SEZ + (1 − z)·g_human`.
  - `g_SEZ = ln2/T_dbl` (1 yr → 69%/yr; weeks → off the chart).
  - `z` (SEZ share of GDP) starts at about 0.5% when SEZs open and grows by its own doubling.
  - This gives AI 2027's "growth accelerating by about 1.5 orders of magnitude over a few years" [A27]: 3% → ~100% per year.
- **What speeds explosion:**
  - the robot doubling time `T_dbl` (T16, T17, T18);
  - the reinvestment share (SEZ policy, Wall Street "invests trillions");
  - regulatory friction waived in SEZs;
  - energy (T11–T13);
  - σ: a higher substitutability lets cognition substitute for physical work;
  - compute growth, since AIlabor grows with inference compute.
- **What slows it:** friction `R_s`, human-in-loop rules, energy and permitting (data-center NIMBY, R08), reducer and component caps, war damage, and low σ.
- **GATE cross-check [V, N4].** GATE's task CES uses ρ = −0.65 (σ ≈ 0.61). Its authors say growth above 20% needs about 30% of tasks automated, and above 30% needs about 50–70%. So the game's explosive switch should also require economy-wide `Σ v_s·A_s ≥ 0.5`, counting physical tasks done by robots, not only an open SEZ. Below that threshold, cap `g` at `0.6·Σ v_s·A_s` (≈ 18% at A = 0.3) [D, fitted to the GATE statements].

### 4.4 Distribution
- **Labor share:** §1A.2 step 10.
- **AI-owner income share:** `= (Σ AI-lab revenue·margin + SEZ capital income)/Y`. The player's equity holders are a named slice: the "OB founders are trillionaires" headline when the valuation is above $10T [A27].
- **Gini (income):** `Gini = Gini0 + 0.6·(LS0 − LS) + 0.3·ΔU − 0.5·Transfers/Y`. `Gini0` is Census money-income Gini ≈ 0.48 [P]. Transfers are UBI, impact payments [A27 S2] and the Slowdown's "taxing/nationalizing AI companies".
- **Top-0.1% wealth share:** tracks equity-index × AI-owner concentration. Fed DFA baseline ≈ 14% [P, verify].
- **"Intelligence curse" flag** [A27 S20]: when the share of government revenue from AI firms is above 50%, government responsiveness to the public `Concern` falls (07-actors weight ×0.5). This links to power-concentration risks.

### 4.5 Equity index ("Dow") [D]
`Dow = Dow0·(Earnings/E0)·(PE/PE0)`
- Earnings grow with `Y·(1 − LS)`, plus AI-lab profits.
- `PE = 20·(1 + 0.6·Hype − 0.8·Fear)`.
  - Hype comes from milestone announcements, the revenue growth rate and the AI-capex boom.
  - Fear comes from incidents, war risk, regulation shocks (cf. the Nasdaq −5.5% on 5 Nov 2026 after the midterms [R09, U]) and the leak.
- **Calibrate:** +30% in 2026 [A27]; a "historic boom" in Aug 2027 [A27]; ≈ 1,000,000 by late 2029 in Race [A27]. That is about 20× from ~48k, consistent with earnings rising ~5× under ~70%/yr SEZ growth and a 3–4× PE re-rating.
- **Feedback:** the index feeds **investor appetite** (REDESIGN §7) and Gov's "point to the stock market" placation [A27].

### 4.6 World-economy presets (hidden; sampled in "Realistic") [D]

| Param | Normal Technology | AI 2027 (ref) | GATE-Explosive |
|---|---|---|---|
| DiffMult (Bass q) | 0.4 | 1.0 | 1.5 |
| Friction R scale | 1.5 | 1.0 | 0.6 |
| σ (cognitive/physical) | 0.35 | 0.5 | 0.7 |
| Robot T_dbl floor | 2 y | 1 y | 3 months |
| New-task creation ν | 0.5 | 0.3 | 0.15 |
| Sample weight (Realistic) | 35% | 45% | 20% |

Rationale:
- *Normal Technology* encodes Narayanan & Kapoor's "diffusion occurs over decades" [F] and the Humlum–Vestergaard null results [P].
- *GATE-Explosive* encodes the high-reinvestment GATE runs [P].
- *AI 2027* is the scenario.

Reality-Updated mode raises the Normal Technology weight to 45% until the player's models exceed `L_agency` 9, after which the evidence base is moot.

### 4.7 Public-sentiment links (into 07-actors)
- `JobAnxiety` ← unemployment, youth unemployment, layoff headlines, and sector-specific shocks weighted by bloc (Labor, Populists).
- `Benefit` ← tech ramp events (cures above all), GDP per capita growth, UBI.
- `Concern` ← risk-tech discoveries, incidents, INFO-channel manipulation scandals.
- Persuasion by an AI with high `Persuasion_X` moves `Approval` directly. That is hidden from the player unless they have interpretability findings.
- AI-friend share: more friends gives less anti-AI activism among the young (×(1 − Friend)) and more "companion harm" incident probability (Kids/Parents bloc, R08).

## 5. Events and headlines (makes change visible)

Each fires once (or with a cooldown). Headlines are terse ("UI: single words / short lines").

| # | Trigger [D] | Headline (examples) | Effect |
|---|---|---|---|
| H1 | `HireRate_SOFT` −30% | "Junior dev postings collapse" | JobAnxiety +, Labor + |
| H2 | Youth unemployment +3 pp | "Class of '27 can't find work" | Concern +; Gov job-training option |
| H3 | First firm cuts > 10k jobs citing AI | "{Firm} cuts 12,000; agents take over support" | Approval −(if player model) |
| H4 | `A_OFFICE` > 0.3 | "Call centers go dark" | — |
| H5 | `A_MEDIA` > 0.3 | "Studio ships game in 30 days" [A27] | Creatives bloc − |
| H6 | `A_LEGAL` > 0.2 | "Bar sues AI law firm" | `R_LEGAL` +0.1 or court ruling event |
| H7 | Protest activism level 2 | "10,000 march on Washington" [A27] | — |
| H8 | Equity index +30% YTD | "AI rally lifts markets 30%" | Investor appetite + |
| H9 | Friend share ≥ 10% | "1 in 10 Americans: my best friend is an AI" | Kids/Parents bloc + |
| H10 | Remote-work-job automation ≥ 25% | "A quarter of remote jobs now done by AI" [A27] | — |
| H11 | U +1 pp in 12 months | "Unemployment jumps; AI blamed" | Impact-payment option |
| H12 | AI tops the problem poll | "AI now America's #1 problem — Gallup" [A27] | Salience + |
| H13 | GOV Ctrl ≥ 10%, T1 | "Cabinet now briefed by AI each morning" | — |
| H14 | MIL tier → T3 | "Pentagon removes human from kill chain" | War risk +; Safety bloc − |
| H15 | INFRA: player model runs own security | (internal) "Agent runs our security" | Leverage + (hidden) |
| H16 | Tech discovered (each) | "AI-designed antibiotic clears Phase I" / "Tokamak hits record with AI control" / "AI proves {conjecture}" | Benefit + |
| H17 | T25 exposure > threshold | "Eval: model can guide virus enhancement" | Gov threat +, China alarm + |
| H18 | Cyber offense event | "Grid outage traced to AI-run intrusion" | INFRA friction +, Gov hawks + |
| H19 | SEZ opens | "First Special Economic Zone opens in {state}" [A27] | Robot prod + |
| H20 | Robot prod ≥ 100k/month | "Detroit converts: 100,000 robots a month" [A27] | — |
| H21 | Robot prod ≥ 1M/month | "One million robots a month" [A27] | — |
| H22 | g ≥ 10% | "Fastest growth since WWII" | — |
| H23 | g ≥ 30% | "Economy doubling every two years" | — |
| H24 | Dow ≥ 100k / 1M | "Dow 100,000" / "Dow 1,000,000" [A27] | — |
| H25 | AI-owner share ≥ 20% | "AI investors become first trillionaires" [A27] | Populists + |
| H26 | UBI enacted | "Congress passes basic income" [A27] | JobAnxiety −− |
| H27 | Intelligence-curse flag | "AI taxes now fund half of government" | Gov responsiveness − |
| H28 | T16 discovered | "Robot passes the Coffee Test" [A27] | SERV/LOG JobAnxiety + |
| H29 | T7 ramp 50% | "Cancer death rate falls by a third" | Benefit +++ |
| H30 | Leverage ≥ 0.35 (any lineage) | "Can we still switch it off? Economists say no" | Safety bloc + |
| H31 | Energy: DC share of US power ≥ 5% | "Datacenters now 5% of US power" | Ratepayers bloc + |
| H32 | China SEZ opens | "China answers with AI zones" | Race pressure + |

## 6. Calibration targets (AI 2027 Classic; the reference compute path)

| Date | Target | Source |
|---|---|---|
| Late 2026 | Equity +30% in 2026; junior SWE "turmoil" (youth unemp. in SOFT ↑, aggregate U < +0.3 pp); 10k protest | [A27] |
| Jul 2027 | Hiring of programmers "nearly stopped" (`HireRate_SOFT` ≤ 10%); AI friend 10%; startup boom | [A27] |
| Aug 2027 | Stock "historic boom"; job training and unemployment insurance offered | [A27] |
| Oct 2027 | 25% of 2024 remote-work jobs done by AI; U +1 pp in 12 months; AI #1 problem for 20% | [A27, fn] |
| Dec 2027 (Race) | GOV T1 Accept → 0.9; officials talk to Agent-5 hours/day; GDP "ballooning" | [A27] |
| 2028 (Race) | Public deployment; GDP "stratospheric"; SEZs; MIL out-of-loop; 1M robots/month by year end | [A27] |
| 2029 (Race) | Dow 1,000,000; cures for most diseases; UBI; humans "obsolete" (Emp at floor) | [A27] |
| 2028–29 (Slowdown) | Coffee Test May 2028; robots 1M/month mid-2028; FDA assisted; robots, fusion, quantum, cures 2029; inequality "skyrockets" | [A27] |

**Reality-Updated targets (Nov 2026 start):**
- aggregate unemployment effect ≈ 0;
- 22–25-year-olds in exposed jobs ≈ −19% vs counterfactual [R09 S32];
- employment of 22–25-year-olds in exposed jobs is 19% below its counterfactual, through fewer hires rather than separations [V];
- firm AI use 17–20% in Dec 2025–May 2026, with Information at 39.7% and Finance at 33.9% (Census BTOS) [V]. Use it to initialise `A_s` adopters;
- Information-sector payrolls −4.2% year on year to Oct 2026 (BLS CES) [V];
- AI capex at 39% of 2025 growth (gross of imports) [V].

## 7. Implementation notes
- **State size:** 3 regions × 14 sectors × (A, E, F, R, HireRate) + Pool + 5 Ctrl domains × tiers × shares + 29 techs. Trivial per tick.
- **New types:** `WorldEcon`, `Sector`, `TechNode`, `ControlDomain`. They feed `07-actors` variables (JobAnxiety, Concern, Benefit, Salience) and REDESIGN §7 investor appetite.
- **UI:**
  - top bar: GDP g, U, Dow, Gini, AI-Ctrl %, Robots/mo;
  - World panel: sector heatmap (A vs F, with the binding constraint);
  - Control panel: stacked bars per domain by lineage, with tier hatching;
  - Tech tree: discovered/ramping/locked, gates shown in tooltips.
- **Tests:**
  - (1) The passive bot under AI 2027 Classic hits the §6 targets within ±3 months.
  - (2) The Normal Technology preset with Agent-1-level models gives TFP +0.5–1% per decade (Acemoglu band).
  - (3) Cognitive-only automation never more than ~2.2× GDP without T17.

---

# PART 2 — NOTES

## N1. AI 2027 world content (verbatim, re-read this session)

**Main page [A27, F]**
- Late 2026: "The stock market has gone up 30% in 2026, led by OpenBrain, Nvidia, and whichever companies have most successfully integrated AI assistants."; "the job market for junior software engineers is in turmoil"; people who can manage AI teams are "making a killing"; "a 10,000 person anti-AI protest in DC"; DOD contracting with OpenBrain, "integration is slow due to procurement".
- Late-2026 metrics: global AI capex $1T; 38 GW global AI power; share of US power on AI 2.5%.
- May 2027: officials debate whether an economic crisis follows; not releasing Agent-2/3 "buys time before job losses".
- Jul 2027: Agent-3-mini "10x cheaper"; "hiring new programmers has nearly stopped"; consulting on AI integration booming; 10% of Americans, mostly young, consider an AI "a close friend"; startups target "nearly every white-collar profession"; net approval −35%.
- Aug 2027: "job training programs and unemployment insurance … the stock market, which is in a historic boom"; defense officials consider AI in nuclear command-and-control.
- Oct 2027: "20% of Americans name AI as the most important problem"; evals show the ability to automate "most white-collar jobs".
- R01 records "25% of 2024 remote-work jobs" and "unemployment +1%" (Oct 2027 footnote).

**Race ending [A27, F]**
- "Agent-5 is deployed to the public and begins to transform the economy."
- "GDP growth is stratospheric, government tax revenues are growing equally quickly."
- "New innovations and medications arrive weekly."
- "special economic zones (SEZs) … where AI acts as central planner and red tape is waived."
- "By the end of the year they are producing a million new robots per month."
- "If the SEZ economy were truly autonomous, it would have a doubling time of about a year"; "the robot economy could double in a few weeks."
- "A modern car factory produces roughly its own weight in cars in less than a year."
- "The modern human economy doubles every twenty years or so."
- "economic growth accelerating by about 1.5 orders of magnitude over the course of a few years."
- "top brass puts aside their discomfort at taking humans out of the loop."
- Officials "can now talk to it directly"; "authorities almost always accept its recommendations."
- "the Dow Jones just passed one million"; "early investors are now trillionaires."
- "cures for most diseases, an end to poverty."

**Slowdown ending:** see R01 S10–S20 (SEZs Feb 2028, 100k → 1M robots/month, Coffee Test, FDA assisted, UBI, inequality "skyrockets", "intelligence curse").

## N2a. Verified labor numbers [V] (these supersede N2 where they differ)

**Exposure: Eloundou et al.**
- 80% of workers are in an occupation with at least 10% of tasks exposed; 19% are in one with more than 50% exposed.
- Task share exposed: about 15% for the LLM alone, and 47% (human rater) to 56% (GPT-4 rater) with tooling.
- Exposure rises with Job Zone: 0% of Zone-1 workers are in occupations more than 50% exposed, versus 34.5% in Zone 4.
- Most exposed: interpreters, writers, PR specialists, tax preparers, quants. Zero exposure: cooks, masons, line installers.

**Applicability: Microsoft (Tomlinson et al.)**
- Top: interpreters 0.49, writers 0.45, customer service reps 0.41 (2.86M workers).
- Bottom: maids, roofers, dredge operators, about 0.
- Correlation with wage is weak (r = 0.13).

**Anthropic Economic Index**

| Report | Computer/math share | Automation vs augmentation | Other |
|---|---|---|---|
| Feb 2025 | 37.2% of conversations (vs 3.4% of workers) | 43% / 57% | 36% of occupations use AI for at least 25% of their tasks |
| Sep 2025 | — | 49%, the first time automation exceeds augmentation; API traffic 77% automation | — |
| Jan 2026 | — | 45% / 52% | 49% of jobs have at least 25% of tasks covered; implied labor-productivity gain about 1.8 pp/yr (1.0–1.2 after adjusting for task success); success rate 67% (Claude.ai) and 49% (API) |

*Game use:* α starts at about 0.45 for consumer use and about 0.75 for enterprise API use, and is not monotone over time.

**OpenAI**
- ChatGPT usage: 700M weekly users by Jul 2025; 73% of messages are non-work; programming is only 4.2% of messages.
- GDPval: experts had about 14 years of experience on average.
  - Claude Opus 4.1 wins or ties against them 47.6% of the time.
  - GPT-5 is 90× faster and 474× cheaper on a naive comparison, but only 1.39× faster and 1.63× cheaper once human review and fixing are counted. *Game use:* `P_task` should include review overhead.

**Field studies**

| Study | Result |
|---|---|
| Brynjolfsson, Li, Raymond (QJE) | Customer support: +15% overall, about +30% for less-experienced agents |
| Noy & Zhang | Writing: −40% time, +18% quality |
| METR RCT | Experienced developers +19% completion time (slower), though they believed they were about 20% faster |
| Dell'Acqua (BCG) [U] | Consultants +25% speed, +40% quality; −19 pp correctness outside the "frontier" |

**Aggregate and entry-level effects**
- Humlum & Vestergaard (revised 2026): earnings and hours effects are null, "ruling out effects larger than 2%"; time saved is about 3% of hours.
- Canaries (Aug 2026): 22–25-year-olds in exposed jobs are 19% below counterfactual (earlier estimates 13% and 16%). The effect runs through hiring and is concentrated where AI substitutes.

**Adoption**
- Bick, Blandin, Deming: 39–40% of adults use generative AI; 23% of workers used it at work in the past week; 1–5% of work hours are assisted; users save 5.4% of their hours. Adoption is faster than the PC (20% in year 3) and the internet (20% in year 2).
- Comin & Hobijn: average cross-country adoption lag of 45 years after invention.
- Census BTOS: 17–20% of firms use AI (2026), up from 3.8% in late 2023, though the question changed [U].

**BLS**
- CES, Oct 2026, thousands:

| Total nonfarm | Information | Finance & insurance | Legal services | Computer systems design | Scientific R&D | Health care & social assistance | Private education | Manufacturing | Transportation & warehousing | Utilities | Retail | Construction | Leisure & hospitality | Government |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 159,293 | 2,734 (−4.2% yoy) | 6,641 | 1,251 | 2,354 | 925 | 24,005 | 4,053 | 12,681 | 6,636 | 612 | 15,501 | 8,367 | 16,964 | 23,332 |

  - Government breaks down as federal 2,677, state 5,479 and local 15,176 (local education 8,209).
  - Active-duty military is about 1.24M (DMDC via BLS).
  - The §1A.1 shares are consistent with these figures within about ±2 pp. Two adjustments if exact numbers are wanted: GOV excluding education is about 8%, and SERV (retail + leisure) is about 20%.
- **BLS projections that cite AI:**
  - 2025–35: office/admin −4.0%, customer service reps −5%, claims adjusters −6%, software developers +10%, data scientists +34.6%, utilities +9.8% ("AI power demands").
  - 2023–33 case studies: insurance appraisers −9.2%, paralegals +1.2%.
  - These are the "Normal Technology" baseline.

**Acemoglu & Restrepo**
- Automation explains 50–70% of the change in the US wage structure over four decades.
- One more robot per 1,000 workers lowers the employment-to-population ratio by 0.2 pp and wages by 0.42%.
- *Game use:* the per-robot employment shock in MFG and LOG before T16.

## N2. Labor-market evidence (structure for sector calibration)
- **Exposure.** Eloundou et al. 2023/2024 (Science) [P]: about 80% of US workers have ≥10% of tasks exposed to LLMs, and about 19% have ≥50% exposed. Higher-wage occupations are more exposed. Physical and manual occupations are least exposed. *Use:* sector cognitive weights.
- **Applicability.** Tomlinson et al. 2025 (Microsoft) [P]: AI applicability is highest for information work (interpreters, writers, customer service, sales reps) and lowest for manual occupations.
- **Usage.** Anthropic Economic Index (2025 reports) [P]: usage is concentrated in software and computer/math tasks (largest single share). The augmentation share fell and the automation ("directive") share rose through 2025. Enterprise API use is mostly automation. *Use:* the α ramp with AGENCY.
- **Field productivity.**
  - Brynjolfsson, Li & Raymond (QJE 2025) [P]: +14% average and +34% for novices in customer support.
  - Noy & Zhang (Science 2023) [P]: writing tasks about 40% faster.
  - METR 2025 RCT [P]: experienced OSS developers 19% *slower* with early-2025 tools.
  - *Use:* `g_aug` range and "experts benefit less".
- **Aggregate effects so far.** Humlum & Vestergaard (NBER w33777) [P], Danish admin data: precise zeros on earnings and hours. Time savings are small, a few % of hours. *Use:* the Reality-Updated preset and the "Normal Technology" weight.
- **Entry-level effects.** Brynjolfsson, Chandar & Chen "Canaries" [R09 S32]: 22–25-year-olds in the most exposed jobs are −13% (2025) → −19% (Aug 2026) vs counterfactual. Older workers are unaffected. *Use:* the hiring-first channel (§1A.2 step 8).
- **Adoption speed.** Bick, Blandin & Deming [P via F-summary in N&K]: about 40% of US adults used genAI by Aug 2024, but only 0.5–3.5% of work hours. That is faster uptake than the PC (20% within 3 years) but shallower. *Use:* Bass p, q.
- **Diffusion skepticism.** Narayanan & Kapoor 2025 [F]: "Diffusion occurs over decades, not years"; in safety-critical domains AI diffusion "lags *decades* behind innovation". *Use:* high R0 for HEALTH, LEGAL, GOV, EDU, and the Normal Technology preset.
- **Automation and inequality.** Acemoglu & Restrepo (Econometrica 2022) [P]: task displacement by automation explains the majority (≈50–70%) of 1980–2016 changes in the US wage structure. *Use:* the Gini link.

## N3a. Verified integration baselines [V]

**Federal use-case inventories (OMB)**
- 2024: 2,133 use cases, 351 of them rights- or safety-impacting.
- 2025: 3,611 use cases, 445 high-impact, across 56 agency submissions.
- *Game use:* GOV penetration (P) grows about 70% a year at baseline.

**Federal access deals**
- Anthropic: CDAO prototype agreement with a $200M ceiling (Jul 2025). The four-firm release on ai.mil returned 403 [U].
- Anthropic: $1 access for all three branches (Aug 2025).
- GSA OneGov, 2026: ChatGPT at 50% off, consumption-based (Sep 2026); Claude at 40% off tokens (Oct 2026). OneGov reports more than $1.8B saved.

**Federal terminology anomaly [V/U].** Two late-2026 federal pages use "super intelligence (SI)" where they would normally say "AI". The DHS framework page says "references to AI were replaced with SI", and a GSA release mentions "super intelligence agreements". This was not investigated, so check it before any in-game use.

**Defense and critical infrastructure**
- DoDD 3000.09 text: quote from memory [U] (403). Replicator ("multiple thousands" of attritable systems in 18–24 months) [U].
- DHS, *Roles and Responsibilities Framework for AI in Critical Infrastructure* (Nov 2024) [V].

**Companionship**
- Common Sense Media (2025), US teens: 72% have used AI companions, 52% regularly, 13% daily. 31% find them as satisfying as friends or more so [V].
- Pew 2025, adults: 50% say AI will worsen people's ability to form relationships [V].
- *Game use:* Friend share starts at about 3% of all adults, higher among the young [D].

**Algorithmic trading.** The SEC's 2020 staff report gives no single equity share. PTFs are about 62% of electronic interdealer Treasury volume [V]. *Game use:* FIN control weight ×1.5.

## N3. Integration baselines
- **US federal.** Agency AI use-case inventories (OMB, 2024) list on the order of 2,000 use cases [P, verify count]. GSA OneGov agreements (2025) give agencies frontier chatbots at nominal prices [P].
- **Defense.**
  - DoD CDAO awarded frontier-AI agreements (ceiling up to $200M each) to Anthropic, Google, OpenAI and xAI in Jul 2025 [P].
  - DoD Directive 3000.09 (2023) requires "appropriate levels of human judgment over the use of force" [P]. That is the policy basis for the MIL tier cap.
- **Infrastructure / cyber.** Anthropic's Nov 2025 report describes a state-linked campaign in which AI executed most (80–90%) of tactical operations [P]. This shows INFRA/CYBER leverage on the attack side.
- **Companionship.** Common Sense Media's 2025 survey reports a majority of US teens have used AI companions [P/NGO, verify %]. AI 2027's "10% of Americans, close friend" is the 2027 target.

## N4a. Verified growth-model parameters [V]

**GATE** (arXiv 2503.04941; parameters at https://epoch.ai/gate; playground at https://epoch-research.github.io/gate-playground/)
- **Automation function**
  - Automated share is flat at about 10% until a threshold, then rises linearly in log effective compute to 100% at the "AGI training requirement". Default 10^36.5 FLOP; range 1e33–1e41.
  - FLOP gap fraction 0.55.
  - Runtime cost runs from 1e15 to 1e24 FLOP/yr per task. Inference trades for training at 2 OOM per 1 OOM, up to 1e5.
- **Task aggregation:** CES with ρ = −0.65 (σ ≈ 0.61).
- **Investment rule:** a planner with η = 1.45 and a 5% discount rate. Compute adjustment-cost exponent 4, timescale 2 years, depreciation 30%/yr.
- **Hardware and software:** hardware efficiency growth starts at 27.5%/yr (returns 5.2); software at 70%/yr (returns 1.25, capped at 1e4).
- **Economy:** capital elasticity α = 0.35; GWP $110T; labor force 3.6B.
- **Outputs**
  - Growth is "elevated by 2-20 times" over ~3%/yr; most tasks are automated within about 20 years; compute investment exceeds 10% of GWP.
  - Above 20% growth at 30% automation; above 30% growth needs 50–70% automation (Potlogea & Ho, Jun 2025). The authors call the default run's 23% growth in 2027 "extremely unlikely".
  - GATE does **not** model wages.
- **Most sensitive inputs:** the AGI training requirement and the FLOP gap, then hardware and software R&D returns. *Game mapping:* L-thresholds (§1A.2 step 2) play the role of the FLOP requirement, and the logistic spread plays the FLOP gap.

**Davidson (2021):** "at least 10% probability on advanced AI driving explosive growth this century"; explosive means more than 30% GWP growth.

**Korinek & Suh (NBER w32255)**
- Baseline AGI, with full automation in 20 years: wages rise slightly, then collapse just before full automation; steady-state growth 18%/yr.
- Aggressive AGI, with full automation in 5 years: wages collapse after about 3 years.
- A temporary bout of automation: wages recover once capital catches up.
- With bounded task complexity, the post-collapse wage equals the capital return.
- *Game use:* the LS formula and the wage hump.

**Acemoglu (NBER w32487)**
- 19.9% of tasks exposed × 23% profitable = 4.6% of tasks.
- Labor-cost savings 27%.
- TFP ≤ 0.66% over 10 years (< 0.53% adjusted); GDP +0.9–1.1% (up to 1.8% with an investment boom).

**Penn Wharton (Sep 2025):** level +1.5% by 2035; peak +0.2 pp of growth in 2032. These form the Normal Technology preset's floor.

**Moll, Rachel & Restrepo (Econometrica 2022)**
- Automation raises the capital share from 34.5% to 43% and the tail-inequality index from 0.54 to 0.65, about 75% of the observed rise.
- Wages fall at the 25th percentile (−10%) and rise at the 95th (+7%); output rises 11%.
- *Game use:* the Gini coefficients in §4.4.

**Labor share:** the BLS nonfarm-business labor-share index (2017 = 100) is 93.7 in Q3 2026, down from 95.6 in Q4 2025 [V]. Keep LS0 = 0.56 as the level [P].

## N6. Verified technology evidence [V] (supersedes the tech-table Evidence column where different)

**Protein design**
- AlphaFold DB holds more than 260M predictions. AlphaFold 3 beats docking tools on protein–ligand interactions.
- RFdiffusion has produced hundreds of designs, validated by cryo-EM. AlphaProteo [lab-reported]: 88% of candidates bound for BHRF1.

**Drugs**
- AI-discovered molecules: Phase I success 80–90%, Phase II about 40% (similar to historical rates).
- Rentosertib Phase 2a (71 patients with IPF): FVC +98.4 mL at 60 mg vs −20.3 mL on placebo.
- No full FDA approval of an AI-discovered drug as of Aug 2026 [U].
- Capitalised R&D cost median $985M (Wouters, JAMA 2020). FDA review goal: 6 months priority, 10 months standard.
- *Use:* T3/T6 lags are dominated by clinical stages, so T5 matters.

**Materials**
- GNoME: 2.2M structures; 736 independently realised. Critique: "scant evidence" of novelty plus utility (Cheetham & Seshadri 2024).
- A-Lab: an author correction (Feb 2026) cut the claim to 36 valid of 40 reported successes and reframed novelty.
- *Use:* T10 discoveries come with a "hype vs. validated" split.

**Math and algorithms**
- AlphaEvolve: recovers 0.7% of Google's compute; 48-multiplication 4×4 complex matrix multiplication; −1% Gemini training time; improved the state of the art on about 20% of 50+ open problems.
- IMO 2025: Gemini Deep Think scored 35/42, officially graded.
- Sakana AI Scientist: under $15 per paper; one workshop paper passed the acceptance threshold.

**Weather**
- GraphCast: better than HRES on 90% of 1,380 targets; under 1 minute per forecast.
- GenCast: better than ENS on 97.2% of targets.

**Fusion**
- TCV RL control (2022).
- DeepMind and CFS TORAX collaboration (Oct 2025).
- *Use:* AI is an accelerant, not the bottleneck; T12 needs PHYS and materials.

**Chips:** AlphaChip used in three TPU generations (contested).

**Robots**
- See §1.5.
- Humanoids: about 7k full-size units sold in 2025 [U]. IFR position: household humanoids are not near term.
- Robot foundation models: π0 and Gemini Robotics learn new short tasks from about 100 demonstrations.

**Connectomics**
- FlyWire: 139,255 neurons. MICrONS: about 1 mm³ of mouse cortex, 0.5B synapses.
- Wellcome: a whole mouse connectome is a 10–15-year goal, about 100,000 person-years of proofreading at current methods.
- *Use:* T20's Effort is mostly proofreading labor, so AI agents compress it directly.

**Bio risk**
- VCT: o3 scored 43.8% vs 22.1% for experts in their own areas.
- Anthropic ASL-3 was precautionary. OpenAI rates GPT-5-thinking as "High" in bio/chem.
- UK AISI (Dec 2025): non-experts with models had 4.7× odds of a feasible viral-recovery protocol.
- RAND (Jan 2024): no significant uplift.
- *Use:* T25 uplift is real by 2025–26; wet-lab skill remains the gate.

**Cyber**
- Big Sleep: SQLite vulnerability (Oct 2024).
- AIxCC: found 86% of synthetic vulnerabilities and patched 68% of those found; 18 real vulnerabilities; about $152 per task.
- GTG-1002: AI performed 80–90% of the campaign against about 30 targets; a few succeeded.
- XBOW: #1 on HackerOne US.
- UK AISI: apprentice-level cyber success rose from under 9% (late 2023) to about 50%; task length doubles about every 8 months.

**Energy (IEA):** data centres used 415 TWh in 2024 (about 1.5% of world electricity), rising to about 945 TWh by 2030.

**Medicine**
- AMIE (Nature 2025): specialists rated it superior on 30 of 32 axes, in simulated text consultations.
- FDA AI-enabled device list: about 1.6k devices, about 76% radiology, none LLM-based [U count].

**Quantum:** AlphaQubit outperforms state-of-the-art decoders. Willow's below-threshold error-correction result: Λ = 2.14.

## N4. Growth theory (why §4.3 looks the way it does)
- **GATE (Epoch AI, Erdil et al. 2025, arXiv 2503.04941)** [P]. An integrated assessment model:
  - compute investment raises effective compute;
  - the fraction of tasks automated rises with effective compute up to a full-automation requirement;
  - output is a CES over tasks, with low substitutability, so the last unautomated tasks bottleneck output;
  - investors reallocate to compute and capital as returns rise.
  - Headline: with full automation, GWP growth can exceed 30%/yr within years. Bottlenecks and frictions delay this.
  - *Game mapping:* `A_s` is the automated-task fraction; CES with σ < 1 is §4.3; reinvestment is SEZ/Wall Street; friction is `R_s`.
  - **To verify:** exact parameter values (FLOP for 100% automation, σ, friction parameters).
- **Davidson (2021, Open Philanthropy)** [P]: explosive growth (>30%/yr) from AI is plausible this century, via the AI-substitutes-for-labor feedback loop that the demographic transition broke for humans.
- **Erdil & Besiroglu (2023, arXiv 2309.11690)** [P]: reviews the arguments; considers explosive growth likely conditional on full automation; discusses bottleneck objections (regulation, physical constraints, Baumol effects).
- **Trammell & Korinek (NBER w31815)** [P]: growth under AI depends on substitutability. Labor's share and wages can collapse if AI is a perfect substitute.
- **Korinek & Suh (NBER w32255)** [P]: in AGI scenarios wages rise and then collapse when automation completes, unless some tasks stay human-only. *Game:* LS formula plus the human floor.
- **Acemoglu (2024, "The Simple Macroeconomics of AI")** [P]: modest decade-scale TFP (~0.7%) under current exposure and cost-effectiveness. This is the floor case (Normal Technology preset with weak models).
- **Davidson & Hadshar (2025, "The Industrial Explosion")** [F]. Stages:
  - AI-directed human labor (~10× physical output);
  - robot factories;
  - nanotech.
  Doublings: initial robot doublings "on the order of a few years" (about 1 year with cheap AI labor); doubling-rate halving after 1–5 stock doublings; carrying-capacity doubling of days to hours; energy cap of ~1e14 humanoids on 5% of solar.
- **Epoch (Denain & Rivière, Apr 2026)** [F]: 2025 production of 16k humanoids, 81k quadrupeds and 570k arms. Under a 2027 demand shock, 1.5–3M humanoids/yr by 2030 is "clearly achievable" and 5–10M plausible. Reducers cap humanoids at about 500k/yr.
  - **Tension with AI 2027:** AI 2027's 1M robots/month (12M/yr) by end-2028 is at Epoch's optimistic edge, and Epoch assumes ordinary human engineers. The game resolves this by making SEZ speed depend on ASI-directed scale-up: the T16/T17 gates.

## N5. Open items / still unverified
- DoDD 3000.09 exact text; the ai.mil four-firm CDAO release; GenAI.mil; Replicator (sites returned 403/503).
- The humanoid unit count for 2025; the count of AI-derived drugs in trials; the FDA AI-device total; current FrontierMath and Cybench leaderboards; OpenAI's IMO statement.
- The federal "super intelligence (SI)" terminology change (N3a).
- The Census BTOS series break in late 2025.
- Dell'Acqua et al. (blocked).

---

# PART 3 — SOURCES

**AI 2027 (primary)**
- https://ai-2027.com/ (main; economic passages re-read 2026-11-13)
- https://ai-2027.com/race (ending; re-read from char 100,000)
- https://ai-2027.com/slowdown (via `research/01-scenario-events.md`)

**Fetched this session [F]**
- Denain & Rivière, "How fast could robot production scale up?", Epoch AI, 22 Apr 2026: https://epoch.ai/blog/how-fast-could-robot-production-scale-up
- Davidson & Hadshar, "The Industrial Explosion", Forethought, 21 May 2025: https://www.forethought.org/research/the-industrial-explosion
- Narayanan & Kapoor, "AI as Normal Technology", Knight First Amendment Institute, 15 Apr 2025: https://knightcolumbia.org/content/ai-as-normal-technology

**Primary, cited from prior knowledge [P]: verify numbers before shipping**
- Erdil, Potlogea, Besiroglu et al., "GATE: An Integrated Assessment Model for AI Automation" (2025): https://arxiv.org/abs/2503.04941 ; Epoch GATE page: https://epoch.ai/gate
- Davidson, "Could Advanced AI Drive Explosive Economic Growth?" (2021): https://www.openphilanthropy.org/research/could-advanced-ai-drive-explosive-economic-growth/
- Erdil & Besiroglu, "Explosive growth from AI automation: A review of the arguments" (2023): https://arxiv.org/abs/2309.11690
- Trammell & Korinek, "Economic Growth under Transformative AI", NBER w31815: https://www.nber.org/papers/w31815
- Korinek & Suh, "Scenarios for the Transition to AGI", NBER w32255: https://www.nber.org/papers/w32255
- Acemoglu, "The Simple Macroeconomics of AI", NBER w32487: https://www.nber.org/papers/w32487
- Acemoglu & Restrepo, "Tasks, Automation, and the Rise in US Wage Inequality", Econometrica 2022: https://doi.org/10.3982/ECTA19815
- Eloundou, Manning, Mishkin, Rock, "GPTs are GPTs" (2023; Science 2024): https://arxiv.org/abs/2303.10130
- Tomlinson et al., "Working with AI" (Microsoft, 2025): https://arxiv.org/abs/2507.07935
- Anthropic Economic Index: https://www.anthropic.com/economic-index
- Brynjolfsson, Li, Raymond, "Generative AI at Work" (QJE 2025): https://www.nber.org/papers/w31161
- Brynjolfsson, Chandar, Chen, "Canaries in the Coal Mine" (2025; Aug 2026 update): https://digitaleconomy.stanford.edu/app/uploads/2026/08/Canaries_August2026.pdf
- Humlum & Vestergaard, "Large Language Models, Small Labor Market Effects", NBER w33777: https://www.nber.org/papers/w33777
- Bick, Blandin, Deming, "The Rapid Adoption of Generative AI", NBER w32966: https://www.nber.org/papers/w32966
- Noy & Zhang, Science 2023: https://doi.org/10.1126/science.adh2586
- METR developer RCT (2025): https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/
- BLS Current Employment Statistics: https://www.bls.gov/ces/ ; OEWS: https://www.bls.gov/oes/ ; labor share (productivity program): https://www.bls.gov/productivity/
- Census Business Trends and Outlook Survey: https://www.census.gov/hfp/btos
- IFR World Robotics: https://ifr.org/worldrobotics/
- IEA, Energy and AI (2025): https://www.iea.org/reports/energy-and-ai
- Jayatunga et al., Drug Discovery Today 2024 (AI-discovered molecules clinical success): https://doi.org/10.1016/j.drudis.2024.104009
- Merchant et al., GNoME, Nature 2023: https://doi.org/10.1038/s41586-023-06735-9
- Szymanski et al., A-Lab, Nature 2023: https://doi.org/10.1038/s41586-023-06734-w
- Degrave et al., tokamak RL control, Nature 2022: https://doi.org/10.1038/s41586-021-04301-9
- Lam et al., GraphCast, Science 2023: https://doi.org/10.1126/science.adi2336
- Dorkenwald et al., FlyWire connectome, Nature 2024: https://doi.org/10.1038/s41586-024-07558-y
- MICrONS Consortium, Nature 2025: https://www.nature.com/collections/bhfdkdbhcf
- Götting et al., Virology Capabilities Test (2025): https://arxiv.org/abs/2504.16137
- Anthropic, ASL-3 activation (May 2025): https://www.anthropic.com/news/activating-asl3-protections
- Anthropic, disrupting AI-orchestrated cyber espionage (Nov 2025): https://www.anthropic.com/news/disrupting-AI-espionage
- DoD Directive 3000.09 (2023): https://www.esd.whs.mil/portals/54/documents/dd/issuances/dodd/300009p.pdf
- CDAO frontier AI awards (Jul 2025): https://www.ai.mil/
- GSA OneGov: https://www.gsa.gov/

**Verified by sub-agents this session [V] (additional URLs)**
- Epoch GATE parameters: https://epoch.ai/gate ; https://epoch.ai/blog/announcing-gate ; https://epoch.ai/gradient-updates/ai-and-explosive-growth-redux
- Davidson summary post: https://www.lesswrong.com/posts/dGWMCFkETTg8EZ2bB
- Penn Wharton Budget Model (Sep 2025): https://budgetmodel.wharton.upenn.edu/issues/2025/9/8/projected-impact-of-generative-ai-on-future-productivity-growth
- St. Louis Fed, AI contribution to GDP (Jan 2026): https://www.stlouisfed.org/on-the-economy/2026/jan/tracking-ai-contribution-gdp-growth
- FEDS Note (Jul 2026): https://federalreserve.gov/econres/notes/feds-notes/the-ai-buildout-and-the-economy-publicly-available-data-to-assess-ais-impact-20260717.html
- BLS labor share index: https://fred.stlouisfed.org/series/PRS85006173
- Moll, Rachel, Restrepo: https://www.nber.org/papers/w28440
- OMB inventories: https://github.com/ombegov/2024-Federal-AI-Use-Case-Inventory ; https://github.com/ombegov/2025-Federal-Agency-AI-Use-Case-Inventory
- Anthropic DoD agreement: https://www.anthropic.com/news/anthropic-and-the-department-of-defense-to-advance-responsible-ai-in-defense-operations ; $1 offer: https://www.anthropic.com/news/offering-expanded-claude-access-across-all-three-branches-of-government
- GSA 2026 OneGov releases: https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-expands-onegov-ai-offerings-with-discounted-openais-chatgpt-09102026 ; https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-anthropic-reach-onegov-agreement-on-discounted-consumptionbased-pricing-10272026
- DHS AI in critical infrastructure framework: https://www.dhs.gov/publication/roles-and-responsibilities-framework-artificial-intelligence-critical-infrastructure
- SEC algorithmic trading report (2020): https://www.sec.gov/files/algo_trading_report_2020.pdf
- Common Sense Media (2025): https://about.commonsensemedia.org/research/talk-trust-and-trade-offs-how-and-why-teens-use-ai-companions ; Pew (2025): https://www.pewresearch.org/internet/2025/09/17/how-americans-view-ai-and-its-impact-on-people-and-society/
- Anthropic Economic Index reports: https://www.anthropic.com/news/the-anthropic-economic-index ; https://www.anthropic.com/research/anthropic-economic-index-september-2025-report ; https://www.anthropic.com/research/anthropic-economic-index-january-2026-report ; https://www.anthropic.com/research/economic-index-march-2026-report ; https://www.anthropic.com/research/economic-index-june-2026-report
- OpenAI usage (NBER w34255): https://www.nber.org/papers/w34255 ; GDPval: https://arxiv.org/abs/2510.04374
- METR RCT paper: https://arxiv.org/abs/2507.09089 ; QJE Brynjolfsson et al.: https://academic.oup.com/qje/article/140/2/889/7990658
- Census BTOS 2026: https://www.census.gov/library/stories/2026/05/ai-use-businesses.html
- BLS CES Table B-1: https://www.bls.gov/news.release/empsit.t17.htm ; projections 2025–35: https://www.bls.gov/news.release/ecopro.nr0.htm ; AI in projections (MLR 2025): https://www.bls.gov/opub/mlr/2025/article/incorporating-ai-impacts-in-bls-employment-projections.htm
- Comin & Hobijn (AER 2010): https://www.aeaweb.org/articles?id=10.1257/aer.100.5.2031 ; Acemoglu & Restrepo: https://www.nber.org/papers/w28920
- IFR: https://ifr.org/ifr-press-releases/news/five-million-robots-now-operate-in-factories-globally ; https://ifr.org/ifr-press-releases/news/global-robot-demand-in-factories-doubles-over-10-years ; https://ifr.org/papers/humanoid-robots-vision-and-reality
- AlphaFold 3: https://doi.org/10.1038/s41586-024-07487-w ; RFdiffusion: https://doi.org/10.1038/s41586-023-06415-8 ; rentosertib: https://doi.org/10.1038/s41591-025-03743-2 ; Wouters JAMA 2020: https://doi.org/10.1001/jama.2020.1166
- GNoME critique: https://doi.org/10.1021/acs.chemmater.4c00643 ; A-Lab correction: https://doi.org/10.1038/s41586-025-09992-y
- AlphaEvolve: https://deepmind.google/discover/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/ ; IMO 2025: https://deepmind.google/discover/blog/advanced-version-of-gemini-with-deep-think-officially-achieves-gold-medal-standard-at-the-international-mathematical-olympiad/
- GenCast: https://doi.org/10.1038/s41586-024-08252-9 ; TORAX/CFS: https://deepmind.google/discover/blog/bringing-ai-to-the-next-generation-of-fusion-energy/ ; AlphaChip: https://doi.org/10.1038/s41586-021-03544-w
- MICrONS: https://doi.org/10.1038/s41586-025-08790-w ; Wellcome connectomics: https://wellcome.org/reports/scaling-connectomics
- UK AISI Frontier AI Trends (Dec 2025): https://www.aisi.gov.uk/frontier-ai-trends-report ; RAND (2024): https://www.rand.org/pubs/research_reports/RRA2977-2.html
- DARPA AIxCC results: https://www.darpa.mil/news/2025/aixcc-results ; Big Sleep: https://projectzero.google/2024/10/from-naptime-to-big-sleep.html
- IEA Energy and AI executive summary: https://www.iea.org/reports/energy-and-ai/executive-summary ; FDA AI device list: https://www.fda.gov/medical-devices/artificial-intelligence-enabled-medical-devices/list-artificial-intelligence-enabled-medical-devices
- AMIE: https://doi.org/10.1038/s41586-025-08866-7 ; AlphaQubit: https://doi.org/10.1038/s41586-024-08148-8

**Project research files used:** `research/01-scenario-events.md` (AI 2027 beats and dashboard), `research/07-actors.md` (JobAnxiety, Concern, activism ladder), `research/08-policy-ecosystem.md` (blocs), `research/09-reality-check.md` (Canaries 2026, AI share of GDP growth), `design/REDESIGN.md` §8b.
