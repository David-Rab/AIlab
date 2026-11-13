# 17 - Relations, rival safety profiles, and game feel

Research date: 2026-11-13. This file feeds three parts of REDESIGN.md:
- §8, Relations (D8)
- §9 row 11, rival and China alignment
- §9 row 2, Plague Inc engagement

It builds on 07 (actor meters and ladders), 08 (blocs, agencies and policy instruments) and 10 (China). Those files already list many player actions per actor. This file adds:
- a **shared currency layer**, which turns those actions into trade-offs;
- the **research-bodies actor**: AI safety institutes, evaluators, academia and NGOs;
- **hidden rival alignment**;
- **engagement design**.

**Tags**

| Tag | Meaning |
|---|---|
| **[V]** | Checked against a primary source in this pass. The URL is in Part 4. |
| **[P]** | Primary source located through a search snippet, but not opened. |
| **[unverified]** | Secondary source only, or a claim from designer memory that is still waiting for a source check. |
| **[D]** | Design choice. |
| **[A27]** | From the AI 2027 text. |

**Status.** Two sub-studies were still running when this file was written:
- a game-design primary-source sweep (GDC and devlog pages);
- a lab safety-framework comparison (framework documents and FLI Index methodology).

Part 2 and §1.6 are therefore built from design knowledge and are tagged [unverified] where no URL was checked. Patch in their findings when the sweeps return.

---

# PART 1 - GAME-READY SPEC: RELATIONS AND RIVAL SAFETY

## 1.1 Design principle

A relation is not a single "approval" bar. Each counterparty holds a few **stocks** that the player trades between. Every action in §1.4 does three things:
- pays in one currency;
- earns another currency;
- creates **exposure**, a delayed side effect that can surface later as an event.

Trust changes asymmetrically: it rises slowly and falls fast. **Commitments ratchet**: signing one is cheap, and breaking it is expensive with everyone at once.

## 1.2 Currencies

Each counterparty holds the per-relation stocks. The global stocks belong to the player's company.

| Currency | Scope | Range | Earned by | Spent / lost by | What it buys |
|---|---|---|---|---|---|
| **Trust** | per counterparty | 0-100 | Keeping commitments; disclosures later confirmed by third parties; giving access | Being caught in a gap between what you said and what is later found (×3 loss); breaking a commitment | Benefit of the doubt after incidents: the incident penalty is scaled by (1 - Trust/150). Also unlocks access rungs. |
| **Access** | per counterparty | rungs 0-4 | Trust thresholds plus specific agreements | Lost when Trust falls below the rung threshold for 30 days | Gov: briefings → contracts → classified work → drafting input. Research bodies: pre-deployment slot → findings shared privately first. |
| **Favors** | per counterparty | tokens 0-5 | Doing something they asked for (giving eval access, supporting their bill, a revenue share) | One token per ask: an expedited permit, a delayed rule, a waived audit, an export licence | One-off asks. Tokens decay after 180 days [D]. |
| **Dependence** | per counterparty, two-way | 0-100 | Contracts, $1-style loss leaders, compute or data you supply | Switching, cancellation | Their dependence on you lowers their willingness to punish. Your dependence on them raises their leverage. High mutual dependence draws **capture scrutiny** from the press and the FTC. |
| **Credibility** | global | 0-100 | Published safety research that replicates; external eval reports that match your own claims; predictions that came true | Hype that misses; "safety-washing" exposed (a published framework not followed); crying wolf | Multiplies the weight of every public statement and disclosure. Low Credibility makes disclosure cost more trust than it earns. |
| **Talent pull** | global | -50..+50 net flow per quarter | Mission perception, pay, compute per researcher, publication freedom, Fellows/academic pipelines | Military deals (safety staff), publication restrictions, incidents, poaching retaliation | Hires per quarter by role (capabilities, safety, security). |
| **Data access** | global set of licences | flags | Licensing deals, government datasets (Genesis), user data from deployments | Lawsuits; licence expiry; privacy incidents | Unlocks data-mix options in model design. Unlicensed data adds a **litigation time bomb**. |
| **Scrutiny** | global | 0-100 | Visibility: big launches, lobbying exposure, incidents, market dominance | Decays slowly (half-life 90 days) | The analog of Plague Inc's detection. High Scrutiny speeds up the 07/08 ladders: regulation, hearings, antitrust. |

**Asymmetry rule [D].** ΔTrust_gain = base × (1 - Trust/100). ΔTrust_loss = base × 3 × (1 + Trust/100). A partner who trusted you more is hurt more. This matches the common finding that a betrayal costs more than the cooperation earned [D, design convention].

**Commitment objects [D].** Some actions create a **Commitment**: a framework, a voluntary pledge, a testing agreement, or a usage restriction. A commitment is a visible card with three parts:
- a **condition**, for example "no deploy above threshold X without mitigation Y";
- an **audience**, the counterparties who care;
- a **break cost**, applied as a Trust hit to every member of the audience plus a Credibility hit.

Real anchor: the Seoul Frontier AI Safety Commitments (May 2024) [V]. Signatories pledged to publish frameworks with "intolerable" risk thresholds and, in the extreme, "not to develop or deploy" if mitigations cannot keep risk below them. In game terms, a cheap signature today becomes a binding constraint at A-3.

## 1.3 Counterparties and their access rungs

| Counterparty | Rung 1 | Rung 2 | Rung 3 | Rung 4 |
|---|---|---|---|---|
| **Executive / agencies** (07 §1.1) | Briefings | Civilian contracts (GSA OneGov) | Defense contracts (CDAO) | Classified networks / policy drafting |
| **Congress** | Testimony | Staff relationships | Bill co-drafting | Carve-outs |
| **Courts** | (none) | (none) | (none) | (none). Courts are a check, not a relationship: injunction odds = `Judicial_Check`. |
| **Public blocs** (08) | Uses the Clout / Mobilization / Approval meters from 08 | | | |
| **US rivals** (07 §1.3) | Non-hostile | Shared threat intel | Joint evals / standards | Merger talks |
| **China** (10) | Track-2 contact | Government-level dialogue | Incident hotline | Verification regime |
| **Research bodies** (new) | Researcher API access | Pre-deployment testing slot | Private-first findings | Co-designed evals |

### New actor: research bodies

Run this as **one actor with three sub-groups**:
1. **Government evaluators.** CAISI / UK AISI. In 2026 the network was renamed the International Network for Advanced AI Measurement, Evaluation and Science [V, NIST news index].
2. **Independent evaluators and NGOs.** METR, Apollo, academic red-teamers, and safety NGOs such as Encode and ARI.
3. **Academia.** Universities, fellowships and consortia.

Meters:
- `Trust_OB` and `Access_rung`, as above;
- `Publish_Pressure` (0-100): their drive to publish what they find;
- `Capacity`: how many models they can test per quarter.

Rules:
- **Government evaluators publish selectively.** Their findings go to the player first and become public only through events.
- **Independent evaluators publish by default.** Their reports are public with a 0-30 day lag, and the player cannot edit them. For example, METR published its GPT-5 report and had about one month of pre-release access [P].
- **Academia publishes everything, with a lag of 3-9 months.** It yields talent with a 6-18 month lag.

## 1.4 Action catalog

Costs and effects are [D] calibrations. Each precedent row names a real primary source; numbers there are real.

### A. Testing and transparency

**A1. Pre-deployment testing agreement (gov evaluator).** Creates a Commitment.
- **Cost:** launch window +14-30 days per frontier model. There is a P(finding) that forces a fix before launch, and engineers spend time supporting the testers.
- **Gains:** Gov Trust +, Access rung 2 → 3. A free red-team adds detection clarity on **misuse** traits (cyber, bio, jailbreaks), not on deep misalignment. Science Credibility +.
- **Side effects:** NSA/CAISI see your capabilities, which feeds `Security_Demand` (07 G-SEC climbs faster). Findings can leak in hearings.
- **Precedents:**
  - US AISI MOUs with OpenAI and Anthropic (29 Aug 2024): access "prior to and following their public release", plus feedback "in close collaboration with" UK AISI [V].
  - CAISI found two novel ChatGPT Agent vulnerabilities and built a full exploit chain with about 50% success. UK AISI filed more than a dozen bio-safeguard vulnerability reports, with weekly meetings from May until the GPT-5 release in Aug 2025 [P, OpenAI blog]. CAISI's own note says both labs published "concrete security improvements" [V].
  - CAISI agreements extended to Google DeepMind, Microsoft and xAI on 5 May 2026; labs often hand over reduced-safeguard versions [unverified].
  - EO 14409 gives the NSA up to 30 days of voluntary pre-release access (see 08) [V via 08].

**A2. Independent evaluator access (METR / Apollo-type).**
- **Cost:** about 1 month of early access, plus compute and engineering support.
- **Gains:** clarity on agentic traits: horizon, eval awareness and scheming probes. Credibility ++ when the report matches your claims.
- **Side effects:** the report is public and uneditable, so it reveals part of your true capability and trait profile to rivals, China and the public. It can also contradict your marketing, which costs Credibility.
- **Precedent:** METR's GPT-5 report gave a 50% time horizon of 2h17m (95% CI 65m-4h25m), with access about 1 month before launch [P].

**A3. Publish a system card / safety framework.** Creates a Commitment.
- **Cost:** low cash. Every threshold you publish becomes a binding constraint later.
- **Gains:** Credibility +, Safety bloc +. It also satisfies SB 53 / RAISE requirements (08 P2) ahead of time.
- **Side effects:**
  - Rivals see your thresholds.
  - If you later relax the framework, the "moving goalposts" event fires, with a Credibility hit that is large if the change is visible.
  - If you never publish, you take legal exposure once state laws apply.

**A4. Publish safety research.**
- **Cost:** a small capability leak to rivals and China. Each paper has an `algo_insight` value of 0-1 that closes rivals' gap by 0.1-0.5 months.
- **Gains:** Credibility ++, safety Talent pull ++, academic Trust +.
- **Spillover:** it raises **every rival's `safety_investment` efficacy**, the only lever that lowers *other labs'* hidden misalignment (§1.6).
- **Side effects:** papers that reveal flaws (for example a model-organism paper) raise Public concern.

**A5. Bug bounty / red-team programme.**
- **Cost:** cash for payouts.
- **Gains:** jailbreak and misuse detection only. A cheap Credibility +.
- **Precedent:** Anthropic's HackerOne programmes paid up to $15k, later $25k, for universal jailbreaks [P].

**A6. Whistleblower channel (Right-to-Warn style).** Creates a Commitment.
- **Cost:** leaks of bad news become *internal reports* with a 14-30 day fix-or-escalate timer. If you fail to act, the leak goes external at double damage.
- **Gains:** staff Trust +, Safety bloc +, and a Talent pull bonus for safety staff.
- **Side effect without a channel:** leak probability is unchanged, but leaks hit the press directly.
- **Precedents:**
  - Right to Warn letter (4 Jun 2024), with four asks [V]: no enforcement of non-disparagement over risk concerns; anonymous channels to the board, regulators and experts; a culture of open criticism; no retaliation for public disclosure once internal processes fail.
  - SB 53 and S.1792 whistleblower provisions (08 P9).

### B. Government

**B1. Loss-leader government contract.**
- **Cost:** about $0 of revenue for a year.
- **Gains:** Dependence (gov on you) +, Access +, and a usage-data foothold.
- **Side effect:** the price normalises after 12 months, and the Favors you gained decay.
- **Precedent:** GSA OneGov priced ChatGPT Enterprise and Claude at $1 per agency (Aug 2025), and Grok at $0.42 (Sep 2025) [P]. GSA later listings suggest a move to discounted usage-based pricing in 2026 [P].

**B2. Defense contract** with a chosen **usage-terms slider**: unrestricted ↔ refuse surveillance and autonomous weapons.
- **Gains:** revenue, Defense bloc +, Exec Trust +, classified Access.
- **Side effects:** safety Talent pull -, Civil Liberties -.
- **If you insist on restrictions:** a retaliation roll (07 retaliation rule). Courts then provide a check.
- **Precedents:**
  - CDAO awards to Anthropic, Google, OpenAI and xAI, each with a $200M ceiling (14 Jul 2025) [P].
  - Anthropic v. Department of War, N.D. Cal. 26-cv-01996-RFL. The court found First Amendment retaliation, due-process and APA claims likely to succeed, and on 26 Mar 2026 enjoined the §3252 "supply-chain risk" designation. It did not reach the §4713 designation, which went to the D.C. Circuit [P, courtlistener order].
  - A later Department of War release lists classified-network AI agreements with eight companies; Anthropic is not named [unverified, page 403].

**B3. Hire former officials (revolving door).**
- **Gains:** Access +1 rung with that government after a cooling-off period. Strategic advice raises event foresight.
- **Side effects:** Scrutiny +, and possible "unfair access" press events.
- **Constraints:** cooling-off rules block lobbying and contact.
- **Precedent:** ACOBA advice on Rishi Sunak as Senior Advisor to Anthropic (Oct 2025) [V]. For two years he may not lobby the UK government, use contacts, advise on bids, or initiate contact. ACOBA flagged that the role "could be seen to offer unfair access and influence".

**B4. Lobby / donate.** The mechanics are in 08 §1.0 (Fund, Court, Concede, Fight). This file adds the rule that exposure scales with Scrutiny: P(exposure per quarter) = Scrutiny/200.

**B5. Sign a voluntary accord.** A Commitment with a weak break cost but a broad audience. See the Seoul commitments [V] and the Sept 2026 accord (08) [V via 08].

**B6. Sue the government / sue critics.** Covered in 07 and 08. Suing critics triggers the backlash rule from the Encode subpoenas (08).

### C. Rivals

**C1. Shared threat intel** (distillation, insider and state-actor indicators).
- **Cost:** you reveal your detection methods.
- **Gains:** China's `Distillation_Access` falls for **all** US labs. Rival cooperation +, Hawks +.
- **Side effect:** China relations -.
- **Precedent:** Anthropic, 23 Feb 2026, identified campaigns by DeepSeek (over 150k exchanges), Moonshot (over 3.4M) and MiniMax (over 13M). In total that was more than 16M exchanges through about 24k fraudulent accounts, and one proxy network ran more than 20k accounts. Anthropic is "sharing technical indicators with other AI labs, cloud providers, and relevant authorities" [V].

**C2. Restrict access by adversary-controlled entities.**
- **Cost:** a small amount of revenue.
- **Gains:** less distillation; Hawks +.
- **Side effect:** China relations -.
- **Precedent:** Anthropic, 4 Sep 2025, banned entities that are more than 50% owned by companies headquartered in unsupported regions such as China [P].

**C3. Joint evals / standards body.**
- **Gains:** rivals' `eval_rigor` drifts up, Safety Rival cooperation ++, and global credibility of evals +.
- **Side effects:** Maverick labs cry "cartel", which raises antitrust Scrutiny.
- **Precedents:** the Frontier Model Forum (est. 2023: best practices, safety science, information sharing) [V]; the OpenAI-Anthropic cross-evaluation (Aug 2025) [unverified pending sub-study].

**C4. Poach / acqui-hire.**
- **Gains:** a talent jump, plus tacit knowledge that closes the gap with that rival.
- **Side effects:** rival cooperation -20, retaliatory poaching, trade-secret suit risk, antitrust review, and culture dilution (safety norms come from the source lab).
- **Precedents:**
  - The CMA held that Microsoft's hiring of Inflection staff plus an IP licence was a "relevant merger situation", then cleared it (4 Sep 2024) [P, gov.uk decision].
  - Meta invested in Scale AI at an over-$29B valuation and its founder joined Meta (Jun 2025). Scale then publicly promised independence and no customer-data access [P].
  - xAI v. OpenAI trade-secret and poaching suit (Sep 2025) [unverified].

**C5. Cloud/equity partnership.**
- **Gains:** cash and compute.
- **Side effects:** switching costs, exclusivity, and the partner sees non-public information. Rivals' dependence goes up.
- **Precedent:** the FTC 6(b) staff report (17 Jan 2025) on Microsoft-OpenAI and Amazon/Alphabet-Anthropic. It covers equity, revenue-share, consultation and exclusivity rights, cloud-spend commitments, and the risk that partners see sensitive information [P].

**C6. Release open weights (frontier-minus-1).**
- **Gains:** open-science and Accelerationist approval.
- **Side effects:** rivals' moat falls; China's gap falls (10 §1.5); Hawks -.
- **Option:** "worst-case fine-tune eval first", costing about 30 days, lowers the Hawk penalty.
- **Precedent:** OpenAI's gpt-oss (Aug 2025). Adversarially fine-tuned variants did not reach Preparedness "High"; external assessors reviewed the method [P].

### D. Research bodies and academia

**D1. Academic consortium grant.**
- **Cost:** $ and compute.
- **Gains:** Talent pull + (lag 6-18 months), academic Trust +, and data and science partnerships.
- **Side effect:** academics publish what they find about your models.
- **Precedent:** OpenAI NextGenAI: $50M across 15 institutions (Mar 2025), part of more than $250M through 2027, plus free access for 100k researchers [P].

**D2. Safety fellowship programme.**
- **Cost:** about $15k of compute per fellow per month.
- **Gains:** a pipeline of safety researchers, and published safety findings (A4 effect).
- **Precedent:** Anthropic Fellows: over 200 fellows since early 2025, over 65% published, and over 35% went on to full-time safety work [P].

**D3. Data licensing vs scraping.**
- Licensing costs $ up front.
- Scraping is free, but sets a **litigation time bomb**: P(suit) per year ∝ the size of the unlicensed corpus, and the damages are calibrated on the real precedent below.
- **Precedent:** Bartz v. Anthropic, preliminary approval of a $1.5B settlement on 25 Sep 2025. That is about $3,000 per book for 482,460 books, and the files had to be destroyed [unverified].

### E. China

The meters and ladder are in 10 §1.4-1.5. This file adds:
- **Track-2 red-lines dialogue** (IDAIS-type).
- **Gov-gov narrow agreement.** Template: the Biden-Xi Lima statement (16 Nov 2024) on human control over the decision to use nuclear weapons [P, fmprc readout].
- **Incident hotline.**

Real evidence on China's safety posture is an input to its hidden profile (§1.6):
- CAISI's DeepSeek evaluation (30 Sep 2025) [V]: R1-0528 agents were on average **12×** more likely than US frontier models to follow hijacking instructions.
- **94%** of overtly malicious requests were answered under a common jailbreak, versus **8%** for US models.
- DeepSeek echoed CCP narratives **4×** as often.
- Later CAISI and UK AISI reports cover Kimi K2/K3 and GLM-5.2/5.3 [V, NIST index].

## 1.5 Interaction rules that make relations bite [D]

1. **The disclosure dilemma** is the central relation decision. At each incident or finding, the player chooses one of three options:
   - **Disclose now:** Trust +, Scrutiny ++.
   - **Fix quietly:** no change now. With P(discovered) = f(the number of outsiders with access, Publish_Pressure), it becomes a "cover-up" with a ×3 Trust loss for every audience.
   - **Deny:** a Credibility gamble.

   Giving access (A1, A2) **raises** later discovery odds. It is an honest-signalling mechanism: the more you let people look, the less a hidden flaw stays hidden.
2. **Triangles.** Most actions move two counterparties in opposite directions:
   - DoD contract: Gov + / safety talent -
   - Open weights: Accelerationists + / Hawks -
   - Threat sharing: rivals + / China -
   - Lobbying for preemption: Exec + / Safety bloc and states -

   Show both arrows on the action card.
3. **Dependence protects and binds.** A government that depends on you is slower to sanction you. It is also faster to demand control (07 G-SEC rungs 4-5).
4. **Access gives information both ways.** Every rung you open to the government raises their capability visibility, and so `Security_Demand`.
5. **Commitments ratchet.** Expose an "Obligations" panel listing every live Commitment with its trigger condition. Breaking one is always possible, and always telegraphed with the exact cost.

## 1.6 Rival and China hidden alignment profiles

**Goal (REDESIGN §9 row 11).** Each rival model accrues hidden traits through the **same causal model as the player's** (REDESIGN §5). The coefficients come from the lab's **safety posture**, and the player sees the posture only through observables.

### Hidden posture parameters per lab (0-1)

| Param | Meaning | Observable proxies (what the player can see) |
|---|---|---|
| `safety_investment` | Share of compute and staff on alignment | FLI Index safety-framework / risk-assessment domains; safety paper output |
| `eval_rigor` | Breadth and elicitation strength of pre-deployment evals | System cards published? Named external testers (CAISI/UK AISI/METR/Apollo)? |
| `disclosure_rate` | P(an incident becomes public) | Incident history; transparency reports |
| `race_relaxation` | How much thresholds loosen when a competitor leads | Framework clauses that allow adjustment if another developer ships a high-risk system (reported for OpenAI's Preparedness Framework v2 [unverified pending sub-study]) |
| `security_level` | RAND SL1-5 | Theft or leak incidents; government agreements |
| `rl_intensity` / `pref_intensity` | Training mix (drives reward hacking / sycophancy) | Product behaviour incidents (e.g. sycophancy rollbacks) |
| `openness` | Weights release | Directly visible |

### Mechanics

- **Trait drift per model** = the same base drift as the player's (driven by `rl_intensity` and `pref_intensity`) × (1 - `safety_investment` × technique_efficacy).
  - The pool of known techniques is shared, and it grows when **anyone publishes** (A4). That is why publishing is the player's lever on global safety.
  - Under race pressure, `safety_investment` falls by `race_relaxation` × lead_gap_pressure.
- **Incidents** fire with P ∝ trait × deployment breadth × (1 - mitigation).
  - **Visibility** = `disclosure_rate` + P(external tester) + P(leak).
  - So a low-disclosure lab looks *clean* until a big incident. That is the game's lesson about absence of evidence.
- **The intel card** for each rival shows: grade bands (A-F, FLI-style), list of named external testers, known incidents, and a **posterior band** on its misalignment, not a point estimate. Posteriors tighten as evidence comes in, for example after a CAISI report or a whistleblower event.
- **Rival ASI endings.** Use the rival's accrued hidden traits instead of a coin flip.

### Archetype defaults

Mapped onto the 07 presets. Values are [D], anchored on public posture.

| Archetype | safety_inv | eval_rigor | disclosure | race_relax | security |
|---|---|---|---|---|---|
| Safety Rival | 0.7 | 0.8 | 0.7 | 0.3 | SL3 |
| Big Tech Incumbent | 0.5 | 0.6 | 0.4 | 0.4 | SL3-4 (own chips and infra) |
| Maverick Accelerationist | 0.2 | 0.3 | 0.3 | 0.8 | SL2 |
| Open-Weights Spoiler | 0.3 | 0.4 | 0.5 (weights are public) | 0.6 | SL2 |
| Boutique Upstart | 0.5 | 0.4 | 0.3 | 0.5 | SL2 |
| China / DeepCent | 0.3 (rising with Concordia-reported trend) | 0.3 (CAISI: 94% jailbreak compliance) [V] | 0.2 | 0.7 | SL3 for state, SL2 for firms (10) |

**Realistic mode** applies ±0.15 of noise. The noise makes the intel card genuinely uncertain.

---

# PART 2 - GAME-READY SPEC: ENGAGEMENT AND GAME FEEL

The designer-source claims in this part are from memory. They are tagged [unverified] until the game-design sub-study returns its URLs.

## 2.1 Lessons from reference games

| Game | Mechanism worth stealing | Translation to the AI-lab game |
|---|---|---|
| **Plague Inc.** (James Vaill, Ndemic) | Two meters race: spread vs cure. Severity is a self-harming upgrade, because it raises detection and so speeds the cure. Point bubbles pull attention to the map. Real-world framing earned CDC interest [unverified]. | **Capability vs Understanding** race. Capability upgrades raise Scrutiny (detection) and the government ladders. Clickable "finding" bubbles on the risk map. |
| **Frostpunk** (11 bit) | Two social meters (Hope / Discontent) plus the Book of Laws: irreversible laws with moral cost, and a constant external clock (cold) [unverified]. | **Commitments** as irreversible law-like cards. A constant external clock comes from rivals and China, not the calendar. |
| **Victoria 3 / CK3** (Paradox) | Nested tooltips that answer "why is this number" [unverified]. Interest groups with approval and clout. | Every number gets a breakdown tooltip (already a user rule). The blocs in 08 already use clout and approval. |
| **RimWorld** (Tynan Sylvester) | Game as a "story generator". The AI storyteller paces threats around player state, with rest periods after crises [unverified]. | An **Event Director** paces incidents by tension curve, not uniform chance (§2.5). |
| **Democracy 3/4** (Cliff Harris) | A policy web where hovering shows causal lines between policies, groups and outcomes [unverified]. | A **relations web**: hover an action to see arrows to each counterparty and currency (§1.5 triangles). |
| **Papers, Please** (Lucas Pope) | Rules escalate each day. The mechanic *is* the moral message: speed vs scrutiny vs family [unverified]. | Regulations add **checklist steps** to launches (SB 53 publication, A1 window, incident reporting), and the player feels compliance friction. |
| **Universal Paperclips** (Frank Lantz) | Staged reveal: whole new resource panels appear as phases change. The theme is a paperclip maximiser [unverified]. | Phase unlocks: Startup → Frontier → Automation (AI labour panel) → Takeoff (Oversight Committee panel). |
| **Factorio** | Production statistics make the bottleneck obvious [unverified]. | **Bottleneck bar** (REDESIGN §3) and a risk-source view. |
| **Into the Breach** (Subset) | Telegraphed enemy intent, so the player solves a known problem [unverified]. | Telegraph actor reactions: "If you ship now: Gov ladder +1 rung in about 20 days (Scrutiny 72)". |

## 2.2 Core loop (one quarter of play ≈ 3-6 real minutes) [D]

1. **Read.** Main screen shows the race bars, the bottleneck bar, and alerts.
2. **Allocate.** Compute, people and cash across the 4 departments.
3. **Decide 1-3 chunky choices.** Train or launch a model, respond to a finding, make a relations action.
4. **Watch consequences arrive with lag**, telegraphed in advance.
5. **New information.** Findings, rival intel and evaluator reports change what you believe.

The meta-loop is the model generation (A-1 → A-2 …). Each generation is a "level", with a launch decision as its climax.

## 2.3 The central tensions

1. **Capability vs Understanding.** These are the two race meters, like Plague Inc's infection vs cure. The bars are your best model's capability and your *verified* alignment confidence. The gap between them is the risk.
2. **Speed vs Scrutiny.** Moving fast raises Scrutiny, Security_Demand and rival responses, the detection mechanic. Moving slow lets rivals and China overtake you.
3. **Openness vs Control.** Disclosure, access, publication and open weights buy trust and global safety, and cost leakage and lost moat (§1.5).

## 2.4 Main screen (terse, icons-first, per the user's UI rule)

- **Top strip:**
  - cash runway (months);
  - compute (own / contracted);
  - the two race bars, Capability vs Understanding, with a gap readout;
  - the lead over the nearest rival, and China's lead or lag, in months;
  - Scrutiny.
- **Centre:** the **risk map**. Nodes are deployments (internal, government, enterprise, consumer, open), labs and China. Edges show flows: theft and distillation, talent, data. Incidents pulse on the map.
- **Right rail:** the bottleneck bar, then the Obligations panel, then the relations mini-web (5 counterparties, each with Trust, Access rung and Favors).
- **Bottom:** alert/event queue. Each alert carries its telegraphed outcome and a deadline timer.

## 2.5 Making every lever a trade-off [D]

- **Different currencies.** Each action card lists its cost in one currency and its gain in another, plus its exposure (§1.4). No action may cost and pay in the same currency.
- **Delayed costs are shown in advance** as a ghost bar on the affected meter.
- **Real downside on the "good" option.** Safety is never free: it costs compute or schedule, and disclosure costs Scrutiny. Racing is never free either: it costs Trust, raises incident odds, and accelerates the government ladders.
- **Diminishing returns** on every lever, so specialising in one lever stalls.

## 2.6 Pacing over 1-3 hours

| Act | Real time | Game time | New systems |
|---|---|---|---|
| 1 Startup | 0-20 min | 2025-26 | Finance, departments, the first model. Relations limited to Gov and Public. |
| 2 Frontier race | 20-60 min | | Rivals' intel cards, research bodies, the Commitments panel. The first evaluator report. |
| 3 Automation | 60-100 min | | AI-labour panel, a rising R&D multiplier, China theft and distillation. Government ladder rungs 1-3. |
| 4 Takeoff | | | Oversight Committee, treaty or lockdown branches. Tension peaks: more pauses, fewer quiet weeks. |

- **Event Director (RimWorld-style).** Tension = f(gap, Scrutiny, incident backlog). After a major crisis it guarantees 2-4 quiet weeks, and it caps concurrent crises at 2.
- **Fast-forward.** Auto-run quiet years.

## 2.7 Tutorialisation

- **Staged unlocks** (Paperclips): never show a panel before it matters.
- **The first model is scripted.** One forced finding teaches the disclosure dilemma.
- **First-time contextual hints** in 1-line terse form, with depth in tooltips.
- **End-screen "what happened and why".** A causal replay of the 5 biggest decisions, plus a comparison against AI 2027 (REDESIGN §9 row 4).
- **Primary-source codex.** Each mechanic links to its real precedent in Part 4. This is the educational layer.

---

# PART 3 - NOTES

- **Government naming drift (2026).** A NIST release (16 Oct 2026) refers to "Super Intelligence" incident-response practices, co-published by NIST, the NSA and CISA [V, as fetched]. The fetch summary also mentioned a renamed centre ("CAISSI"); treat that as [unverified] until re-checked. Game text should use fictional agency names anyway.
- **CAISI program scope.**
  - A NIST slide deck (Mar 2026) lists "3 MOUs with Frontier labs" [P].
  - The 5 May 2026 extension to Google DeepMind, Microsoft and xAI is reported only secondhand. The NIST page URL tried returned 404 [unverified].
- **Pending sub-studies.** Patch them into Part 2 and §1.6:
  - (a) Designer primary sources: GDC Vault, the Ndemic blog, Paradox dev diaries, Factorio FFF, Positech blog, Lucas Pope devlog, Frank Lantz.
  - (b) Lab frameworks: OpenAI Preparedness v2, Anthropic RSP, GDM FSF v3, Meta, xAI, Chinese frameworks; FLI Index methodology and grades; system-card external testers.

# PART 4 - SOURCES

**Verified [V]** (opened in this pass):
- NIST, US AISI MOUs with Anthropic and OpenAI (29 Aug 2024): https://www.nist.gov/news-events/news/2024/08/us-ai-safety-institute-signs-agreements-regarding-ai-safety-research
- NIST CAISI news index (Kimi, GLM, DeepSeek V4 evals; International Network rename): https://www.nist.gov/news-events/news-updates/tag/2810121
- CAISI DeepSeek evaluation: https://www.nist.gov/news-events/news/2025/09/caisi-evaluation-deepseek-ai-models-finds-shortcomings-and-risks
- CAISI work with OpenAI and Anthropic: https://www.nist.gov/news-events/news/2025/09/caisi-works-openai-and-anthropic-promote-secure-ai-innovation
- NIST SI incident readiness (16 Oct 2026): https://www.nist.gov/news-events/news/2026/10/key-practices-incident-readiness-and-response-super-intelligence-training
- Anthropic, distillation attacks (23 Feb 2026): https://www.anthropic.com/news/detecting-and-preventing-distillation-attacks
- Frontier Model Forum, about: https://www.frontiermodelforum.org/about-us/
- ACOBA advice, Sunak / Anthropic: https://www.gov.uk/government/publications/sunak-rishi-prime-minister-acoba-advice/advice-letter-rishi-sunak-senior-advisor-anthropic-pbc
- Seoul Frontier AI Safety Commitments: https://www.gov.uk/government/publications/frontier-ai-safety-commitments-ai-seoul-summit-2024/frontier-ai-safety-commitments-ai-seoul-summit-2024
- Right to Warn letter: https://righttowarn.ai/

**Primary, located but not opened [P]:**
- OpenAI, working with CAISI and UK AISI: https://openai.com/index/us-caisi-uk-aisi-ai-update/
- METR GPT-5 report: https://metr.org/evaluations/gpt-5-report/
- CDAO frontier AI awards: https://www.ai.mil/News/PR-View/Article/4242822/cdao-announces-partnerships-with-frontier-ai-companies-to-address-national-secu/
- GSA OneGov, OpenAI: https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-announces-new-partnership-with-openai-delivering-deep-discount-to-chatgpt-08062025
- GSA OneGov, Anthropic: https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-strikes-onegov-deal-with-anthropic-08122025
- GSA OneGov, xAI: https://www.gsa.gov/about-gsa/newsroom/news-releases/gsa-xai-partner-to-accelerate-federal-ai-adoption-09252025
- Anthropic v. DoW preliminary injunction order: https://storage.courtlistener.com/recap/gov.uscourts.cand.465515/gov.uscourts.cand.465515.135.0.pdf
- Anthropic, region restrictions: https://www.anthropic.com/news/updating-restrictions-of-sales-to-unsupported-regions
- CMA, Microsoft/Inflection decision: https://assets.publishing.service.gov.uk/media/6719ff5f549f63039436b3c8/__Full_text_decision__.pdf
- Scale AI, Meta investment: https://scale.com/blog/scale-ai-announces-next-phase-of-company-evolution
- FTC 6(b) AI partnerships report: https://www.ftc.gov/reports/ftc-staff-report-ai-partnerships-investments-6b-study
- OpenAI gpt-oss: https://openai.com/index/introducing-gpt-oss/
- OpenAI NextGenAI: https://openai.com/index/introducing-nextgenai/
- Anthropic Fellows 2026: https://alignment.anthropic.com/2025/anthropic-fellows-program-2026/
- Anthropic model safety bug bounty: https://www.anthropic.com/news/model-safety-bug-bounty
- UK-Anthropic MOU: https://www.gov.uk/government/publications/memorandum-of-understanding-between-the-uk-and-anthropic-on-ai-opportunities
- China MFA Lima readout: https://www.fmprc.gov.cn/mfa_eng/xw/zyxw/202411/t20241117_11527672.html

**Secondary [unverified]:**
- xAI v. OpenAI (Sep 2025): https://www.legaltechmonitor.com/2025/09/xai-sues-openai-in-ca-federal-court-for-allegedly-stealing-trade-secrets/
- Bartz v. Anthropic settlement: https://www.authorsalliance.org/2025/09/28/bartz-v-anthropic-settlement-gets-preliminary-approval-key-takeaways/
- CAISI May 2026 agreements: https://www.hpcwire.com/off-the-wire/nists-caisi-announces-new-frontier-ai-testing-agreements-with-google-deepmind-microsoft-xai/
