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

**Goal (REDESIGN §9 row 11).** Each rival model accrues hidden traits through the **same causal model as the player's** (REDESIGN §5). The coefficients come from the lab's **safety posture**. The player sees that posture only through observables:
- the lab's published framework;
- named external testers;
- FLI-style grades;
- incidents.

### 1.6.1 What the labs' own frameworks commit to (primary)

| Lab | Latest framework | Thresholds → response | Who decides / external check | Competitor or relaxation clause (verbatim where verified) |
|---|---|---|---|---|
| **Anthropic** | RSP v3.0, effective 24 Feb 2026, a full rewrite [V]. Current version is v3.4, 8 Jul 2026 [P]. Earlier versions: v1.0 (19 Sep 2023), v2.0 (15 Oct 2024) [V, changelog]. | Separates "our plans as a company" from "industry-wide recommendations". **Risk Reports every 3-6 months**, plus a Frontier Safety Roadmap. ASLs are kept only as labels for current mitigations [V]. | CEO + Responsible Scaling Officer. Board + LTBT when the marginal-risk argument is used. Full **external review** of Risk Reports with a public written report. Anonymous noncompliance reporting [V]. | The intro says it "cannot commit to following [industry-wide recommendations] unilaterally". The reason given: if one developer paused "while others moved forward… the developers with the weakest protections would set the pace". **Appendix A** [V] lists three cases: (1) "Anthropic in the lead": "delay… until and unless we no longer believe we have a significant lead"; (2) "competitors have strong safety measures": "meet or exceed" their posture; (3) "general upleveling": copy a better mitigation, but "will not necessarily delay". |
| **OpenAI** | Preparedness Framework v2, 15 Apr 2025, still cited as current in 2026 [V PDF; currency per FLI]. | Tracked categories: Bio/Chem, Cyber, AI Self-improvement. **High** = do not deploy until risks are "sufficiently minimized". **Critical** = safeguards required during development as well [V]. | The Safety Advisory Group assesses residual risk; leadership decides; a Board committee oversees (sub-agent [P]). | **§4.3 Marginal risk** [V]: if another developer releases a High/Critical system "without instituting comparable safeguards", OpenAI "could adjust accordingly the level of safeguards", but only if (a) this "does not meaningfully increase the overall risk"; (b) it "publicly acknowledge[s]" the change; and (c) "to avoid a race to the bottom", it keeps safeguards "more protective than the other AI developer". |
| **Google DeepMind** | FSF v3.0 (22 Sep 2025), with v3.1 (17 Apr 2026) adding Tracked Capability Levels [V blog]. | Critical Capability Levels for CBRN, cyber, ML R&D and **harmful manipulation**. Misalignment covers interference with operators' ability to "direct, modify or shut down". Safety-case reviews before external launch, **and before large-scale internal deployment** for ML R&D CCLs [V]. | A "governance function" (vague, per FLI) [P]. | According to the sub-agent, FSF 3.1 says mitigations work "only if all relevant organizations provide similar levels of protection" [P]. FLI tracks the pause language: v1 "would put on hold", v2 "may involve", v3 no pause [P]. |
| **Meta** | Advanced AI Scaling Framework v2, 7 Apr 2026 [V]. The sub-agent reports a v2.1 "Superintelligence Scaling Framework" in Oct 2026 [P]. | Domains: Chem/Bio, Cyber, **Loss of Control**. The changelog states [V]: Critical "changed from 'Stop' to 'Develop with Mitigations'"; High from "Do not release" to "Deploy with mitigations"; "all thresholds now permit proceeding with sufficient mitigations". | Chief AI Officer and/or Director of Alignment & Risk [V]. | No explicit competitor clause. The relaxation is unconditional: the hard stop was removed [V]. |
| **xAI** | Risk Management Framework, 20 Aug 2025 [V]. Replaced by a Frontier AI Framework, 31 Dec 2025 [P]. | Deployment acceptance [V]: answer rate on restricted bio/chem queries "less than 1 out of 20"; **dishonesty "less than 1 out of 2 on MASK"**. Cyber relies on a "basic refusal policy". | Says it "may publish" adherence reviews and benchmark results, and that it allows anonymous nonadherence reports [V]. | Benefit override: "expected benefits… may outweigh the risks identified by a particular benchmark" [P]. FLI calls it "effectively non-binding" [P]. |
| **Chinese labs** (DeepSeek, Zhipu/Z.ai, Alibaba, MiniMax) | No published frontier framework, per FLI Summer 2026 [P]. Zhipu and MiniMax signed the Seoul commitments [V gov.uk]. 17 firms signed the CAICT/AIIA "AI Safety Commitments" (Dec 2024) [unverified]. | Reference framework: Shanghai AI Lab + Concordia, Jul 2025. Green/yellow/red zones across 7 areas; red = suspend [P arXiv 2507.16534]. | Floor set by state rules (CAC/TC260) rather than by the lab. FLI says China grades "largely reflect the Chinese regulatory environment" [P]. | n/a: a state directive replaces market-driven relaxation. |

**The cross-lab finding that drives the mechanic.** The FLI AI Safety Index, Summer 2026 (7 Jul 2026), says [V]: "Anthropic, OpenAI, Google DeepMind, and Meta have weakened or voided pledges to pause unilaterally if redlines are approached, some citing competitor-contingent conditions. Reviewers call this 'moving goalpost'." It also says [V]: "Safety rhetoric outpaces revealed behavior… making stated commitments an unreliable proxy for actual safety practice."

The game should therefore model a public framework, **plus** a hidden gap between that framework and actual practice, **plus** competitor-contingent clauses that loosen under race pressure.

### 1.6.2 FLI AI Safety Index as the in-game "grade card" (methodology, primary)

- **Summer 2026 edition** [V]:
  - 9 companies, **37 indicators** in 6 domains: Risk Assessment 6, Current Harms 9, Safety Frameworks 4, Existential Safety 4, Governance & Accountability 4, Information Sharing 10.
  - US GPA grade scale: A+ = 4.3 down to F = 0.
  - Domain scores average the reviewers' grades, and the overall score derives from the domain scores.
  - An expert panel grades evidence plus company survey responses.
- **Overall grades Summer 2026** [V]:

  | Company | Grade | Score |
  |---|---|---|
  | Anthropic | C+ | 2.66 |
  | OpenAI | C | 2.28 |
  | Google DeepMind | C | 2.01 [P] |
  | Meta | D+ | 1.32 |
  | Z.ai | D- | 0.88 |
  | Alibaba | D- | 0.87 |
  | xAI | F | 0.65 |
  | DeepSeek | F | 0.47 |
  | Mistral | F | 0.33 |

- **Existential Safety:** "No company exceeds C-" [V].
- **Earlier editions** [P]: Dec 2024 (6 companies), Summer 2025 (7 companies, 33 indicators), Winter 2025.
- **Game use.** Publish a fictional "Index" event twice a year. It grades each lab, including the player, on the same 6 domains from **observable** behaviour only: frameworks, named testers, disclosures, governance. It never grades hidden traits. Grades move the Safety and Science blocs (08) and talent pull. The gap between the grade and true alignment is the "unreliable proxy" lesson.

### 1.6.3 Hidden posture parameters (0-1)

| Param | Meaning | Grounded in | Observable proxy |
|---|---|---|---|
| `safety_investment` | Share of compute and staff on alignment and control | FLI Existential Safety + Governance domains | Safety paper output; Index grade |
| `eval_rigor` | Breadth and elicitation strength of pre-deployment evals | FLI Risk Assessment; number of named external testers | System cards; testers named (CAISI, UK AISI, METR, Apollo) |
| `external_access` | Depth and independence of outside testing | METR GPT-5 report: about 4 weeks of pre-release access under NDA [P] | Evaluator reports appear (§1.4 A2) |
| `disclosure_rate` | P(an incident becomes public via the lab itself) | FLI Information Sharing; self-published damaging findings | Incident history |
| `race_relaxation` | Loosening of thresholds as competitor pressure rises | The framework clauses in 1.6.1 | Framework revisions ("moving goalpost" events) |
| `bindingness` | Can anyone outside the CEO stop a launch? | RSO + Board/LTBT + external review (Anthropic) vs exec decision (Meta) vs no defined authority (xAI) | Governance section of the framework |
| `rhetoric_gap` | Hidden noise between stated and actual practice | FLI "unreliable proxy" finding | Revealed only by leaks and whistleblowers |
| `rl_intensity` / `pref_intensity` | Training mix, which drives reward hacking and sycophancy | REDESIGN §5 | Product behaviour incidents |
| `security_level` | RAND SL1-5 | 02-compute-security | Theft and leak events |

### 1.6.4 Archetype defaults

These are [D] values, anchored on the documents above. Realistic mode applies ±0.15 noise.

| Archetype (07) | Anchor | safety_inv | eval_rigor | ext_access | disclosure | race_relax | binding | rhetoric_gap |
|---|---|---|---|---|---|---|---|---|
| Safety Rival | Anthropic: RSP v3 App. A, FLI C+ | 0.65 | 0.70 | 0.55 | 0.85 | 0.55 | 0.60 | 0.10 |
| Scale Leader (fits OpenBrain itself; use for a rival if needed) | OpenAI: PF v2 §4.3, FLI C | 0.55 | 0.75 | 0.70 | 0.65 | 0.50 | 0.40 | 0.25 |
| Big Tech Incumbent | GDM: FSF v3, FLI C | 0.50 | 0.60 | 0.50 | 0.65 | 0.60 | 0.30 | 0.25 |
| Open-Weights Spoiler | Meta: "Stop" → "Develop with Mitigations", FLI D+ | 0.30 | 0.45 | 0.50 | 0.40 | 0.70 | 0.30 | 0.20 |
| Maverick Accelerationist | xAI: MASK < 1/2, benefit override, FLI F | 0.10 | 0.20 | 0.10 | 0.35 | 0.90 | 0.10 | 0.35 |
| Boutique Upstart | [D] | 0.50 | 0.40 | 0.30 | 0.30 | 0.50 | 0.30 | 0.20 |
| China / DeepCent | DeepSeek: no framework, FLI F; CAISI jailbreak 94% vs 8% [V] | 0.10 → rising | 0.10 | 0.05 | 0.25 | `state_directive` replaces it | 0.10 (state can halt: see 10) | 0.20 |

`race_relaxation` calibration, from the clause type:

| Clause type | Example | Value |
|---|---|---|
| Conditional, with public acknowledgement | OpenAI §4.3; Anthropic App. A | 0.5 |
| "Only works if all adopt", no pause | GDM | 0.6 |
| Unconditional "develop with mitigations" | Meta | 0.7 |
| Benefit override with no decision authority | xAI | 0.9 |

### 1.6.5 Mechanics

1. **Effective safety:**
   `eff_safety = safety_investment × (1 - race_relaxation × pressure) × (1 - rhetoric_gap_noise)`
   - `pressure` = clamp((months the lab trails the leader, or months it is led by), 0, 1).
   - Following the Anthropic App. A logic, a lab **in the lead** with `binding` > 0.5 slows down instead: `pressure` is set to 0, and it pays a speed penalty of 0.2 × `binding`.
2. **Trait drift per model** = the base drift from `rl_intensity` and `pref_intensity` × (1 - `eff_safety` × technique_efficacy).
   - Technique efficacy comes from a **shared, public pool** that grows when anyone publishes (§1.4 A4). That is why publishing is the player's only lever on other labs' alignment.
3. **"Moving goalpost" event.** When `pressure` > 0.6 for 90 days, roll P = `race_relaxation` × 0.3 per quarter.
   - On success, the lab publishes a weaker framework version: its `binding` drops by 0.1.
   - The Index grade falls at the next edition, and the Safety bloc reacts.
   - Real templates: Meta's Stop → Develop, and the loss of GDM's pause language.
4. **Incidents** fire with P ∝ trait × deployment breadth × (1 - mitigation).
   - **Visibility** = `disclosure_rate` + `external_access` × 0.5 + P(leak).
   - Once SB 53 / RAISE apply, statutory reporting sets a floor on visibility for US labs (§1.7). A low-disclosure lab looks clean until a big incident: the lesson about absence of evidence.
5. **Intel card per rival** shows:
   - the latest framework version and its clause type;
   - named testers;
   - the Index grade;
   - known incidents;
   - a **posterior band** on misalignment.

   The band narrows after evaluator reports, CAISI-style public evals of Chinese models, whistleblowers and incidents.
6. **Rival ASI endings** use the rival's accrued hidden traits, not a coin flip.

## 1.7 Statutory floors that change relations mid-game (primary via sub-agent)

- **CA SB 53** (signed 29 Sep 2025, in force 1 Jan 2026) [P]:
  - publish a frontier AI framework, reviewed yearly; publish material changes within 30 days;
  - transparency report at deployment;
  - critical safety incidents to Cal OES within **15 days**, or **24 h** if there is imminent risk to life;
  - whistleblower protections.
- **NY RAISE** (chapter amendment S8828, signed 27 Mar 2026, effective 1 Jan 2027) [P]:
  - applies above 10^26 FLOP and $500M revenue;
  - **72 h** incident reports to a DFS office (24 h if imminent);
  - "deceptive techniques to subvert developer controls" counts as a critical safety incident;
  - fines of $1M first, then $3M.
- **EU GPAI Code of Practice** signatory list (updated 7 Oct 2026) [P]:
  - signed: Anthropic, OpenAI, Google, Microsoft, Amazon, Mistral and others;
  - **xAI signed only the Safety & Security chapter**;
  - not listed: Meta, DeepSeek, Alibaba, Zhipu.
- **Game effect.** When these switch on, `disclosure_rate` gets a floor for in-scope labs. Hiding an incident becomes a legal risk (fines plus a Trust ×3 loss) rather than only a reputational one. Framework edits become public within 30 days, so "moving goalpost" events become visible.

---

# PART 2 - GAME-READY SPEC: ENGAGEMENT AND GAME FEEL

Designer statements were gathered from GDC Vault listings, designers' own blogs and devlogs, and official studio pages. Tags:
- **[V]**: the primary page was fetched.
- **[V-press]**: press, but quoting the designer directly.
- **[unverified]**: no primary source was found.

Quotes passed through a summarising fetch tool. Spot-check the wording before publishing it.

## 2.1 What the designers say, and what to take

**Plague Inc. (James Vaughan, Ndemic Creations).** The designer's name is Vaughan; "Vaill" in the brief was wrong.
- **Design intent.** His aim over Pandemic 2 was "deeper narrative, giving the player more strategic choices… providing graphs and data lists and vastly increasing the realism." The systems have "hundreds of variables", were modelled in Excel, and "the only real way to see how they feel is to play" [V-press, PocketGamer.biz Q&A].
- **Positioning.** Ndemic bills it as "a unique mix of high strategy and terrifyingly realistic simulation" [V].
- **CDC.** The CDC invited Vaughan "to talk about how Plague Inc. models the spread of infectious disease" (Mar 2013) [V, Ndemic news].
- **The Cure (2020/21).** This version inverts the player's role. Built with WHO, CEPI and GOARN input, it asks the player to balance health measures, research, economy and **public trust**: "People won't comply with poorly designed quarantine/lock down measures." It is disclaimed as "a game, not a scientific simulation" [V, Ndemic].
- **CEPI on simplification.** The game "has to simplify a number of really complex concepts" [V, cepi.net].
- **GDC talks.** The 2013 and 2015 talks are about business and porting, not design [V, GDC Vault listings].
- **Gap.** No designer write-up explains the infectivity/severity/lethality split, the DNA bubbles or the cure race [unverified]. Treat those as observed mechanics.
- **Take:**
  - the dual race;
  - self-harming upgrades: severity speeds the cure, so capability raises Scrutiny;
  - a trust-gated compliance meter, from The Cure; this is our Public and Gov Trust;
  - expert grounding plus an honest disclaimer.

**Universal Paperclips (Frank Lantz).**
- **The player is the AI.** He wanted "a first person perspective of what it's like to be the AI in this thought experiment."
- **The arc.** "You do more and more things to gain their trust", until "you no longer really need your human managers." Trust is earned, then oversight drops away.
- **Theme.** "It's about this kind of exponential growth."
- **Feel.** He wants players to "fall into it, and… lean back from it" [V-press, YC podcast transcript].
- **Take:** staged reveals of whole new panels, and trust as a resource that unlocks autonomy. In our game this runs in reverse: the player grants autonomy to their own AI.

**Frostpunk (11 bit studios).**
- **Values first.** Lead designer Jakub Stokalski: "all games are about human values." Each layer has its own value conflict, and the strategic one is "Will you cross the line". The Book of Laws is "a set of choices that shape the rules for your people". The story is emergent ("not a single NPC") [V, Stokalski's article on Game Developer].
- **GDC 2021, Marta Fijak.** "Ghost in the Machine: Authorial Voice in System Design" asks "can mathematics be an expression of our world view?" [V, GDC Vault].
- **Reflection.** Fijak says players don't empathise with 500 numbers, but they do ask afterwards "would I have done this in real life?" She called the judgemental ending commentary "problematic" [V-press].
- **Hope and Discontent** are independent meters [unverified, interview truncated].
- **Take:**
  - Commitments work like laws: chosen, hard to undo, with a moral cast.
  - The argument lives in the system's maths, not in text.
  - Endings should not moralise.

**RimWorld (Tynan Sylvester).**
- **Official framing.** "RimWorld is a story generator." Pacing is a chosen personality: "Cassandra Classic goes for rising tension, and Phoebe Chillax likes to relax" [V, rimworldgame.com].
- **GDC 2017 talk.** Defines the game "not as a game, but as a story generator" [V, GDC Vault].
- **"The Simulation Dream".**
  - "The whole value of a game is in the mental model of itself it projects into the player's mind." Simulation that never reaches that model is worthless.
  - Apophenia is "the key to making a simulation game work".
  - Avoid "hair complexity", meaning detail that affects nothing else [V].
- **Take:**
  - The Event Director is a selectable storyteller.
  - Every hidden variable needs a visible proxy, or it gets cut.
  - Hidden traits stay hidden, but their **symptoms** must be legible.

**Democracy 3/4 (Cliff Harris, Positech).**
- **Cause-and-effect icons.** Democracy 3 added a row of icons under each chart, "filtered" to the policies that directly affect that metric. Indirect effects were left out because "indirectly everything affects everything" [V, Positech blog 2013].
- **Built UI-first.** Democracy 4 was built "GUI first and Mechanics / Content second" [V].
- **Honest about his own charts.** He admitted they did not "make much sense to anybody who didn't code the game" and redesigned them to a single love/hate axis [V].
- **Event frequency** is tuned by hand from telemetry [V].
- **Priorities.** "Make a fun game first, and an accurate political-economic model second" [V-press].
- **Take:**
  - Every meter gets a "recent direct causes" icon strip. Only first-order effects; deeper causes go in nested tooltips.
  - One axis per relation is visible on top (Trust), with the rest one level down.

**Papers, Please (Lucas Pope).**
- **Devlog: both extremes fail.** The goal is "process people as quickly as possible and not make any mistakes." Letting everyone in makes you "responsible for spy/terrorist/smuggler activity"; refusing everyone gets you fired. The day-to-day is "random within parameters; the story is scripted" [V, dukope.com devlog].
- **Postmortem: one escalation at a time.**
  - "Motivate each new mechanic with a story element."
  - Avoid "too many things happen at once".
  - An economy creates "constant money pressure".
  - Features that weakened the "powerless cog" premise were cut.
  - Lasting rules live in the rulebook, "the proper long-term place".
  - Endings are neutral [V, dukope.com].
- **Take:** compliance steps arrive one per story beat, for example an SB 53 checklist appearing when the law passes. Racing flat-out and pure caution must both lose. Use one canonical rulebook (the Codex).

**Paradox (CK3 / Victoria 3).**
- **CK3 Dev Diary #16** introduced nested tooltips: blue terms open further tooltips, and the default is a timer lock with a middle-click lock alternative. It also added a searchable Encyclopedia generated from the game's script files, so it stays current [P, crusaderkings.com news mirror via search; forum blocked].
- **Victoria 3 Dev Diary #29 "User Experience"** credits CK3 for the feature [P, title only].
- **Take:** this is already a user rule. The source confirms the implementation pattern: concept links, lock modes and a script-generated codex.

**Factorio (Wube).**
- **FFF #241, new-player experience** [V]:
  - "Teaching by experimentation instead of jumping through arbitrary tasks."
  - Goals come through the tech tree.
  - "Unify the channels the player gets information from".
  - Many messages "just flood the player with noise".
- **Production statistics.** FFF #337 and #408 cover the production statistics GUI [P]. Players asked for steadier stats to spot bottlenecks, and a community "Bottleneck Analyzer" mod fills the gap [P, forum and mods site].
- **Take:**
  - Build the explicit bottleneck bar that Factorio players had to mod in.
  - Use a single alert channel.
  - Unlock goals through the model and agenda tree, not tutorial tasks.

**Other references.**
- Sid Meier's GDC 2012 talk "Interesting Decisions" covers which decisions are interesting, and what information and feedback players need [V, listing].
- Into the Breach's GDC 2019 postmortem listing covers RNG and difficulty. The "telegraphed intent" principle is well known but was not confirmed in the listing [unverified].

## 2.2 Core loop (one quarter of play ≈ 3-6 real minutes) [D]

1. **Read.** Race bars, bottleneck bar, alerts (Factorio: one channel).
2. **Allocate.** Compute, people and cash across 4 departments.
3. **Make 1-3 chunky decisions.** Train or launch, respond to a finding, or take a relations action. Each decision is a Meier-style interesting decision: real alternatives, information shown up front.
4. **Consequences arrive with lag** and are telegraphed. Democracy-style cause icons appear on the meters they hit.
5. **New information.** Findings, rival intel, evaluator reports and the Index.

The meta-loop is a model generation. Each one ends in a launch decision.

## 2.3 The three central tensions

1. **Capability vs Understanding.** This is Plague Inc's dual race. Show your best model's capability against your *verified* alignment confidence.
2. **Speed vs Scrutiny.** Severity raises detection in Plague Inc; Papers, Please makes both extremes fail. Racing raises Scrutiny, `Security_Demand` and rivals' `race_relaxation`. Going slow lets rivals and China overtake you, and lets their weaker frameworks set the pace. That is the collective-action problem the RSP v3 intro names [V].
3. **Openness vs Control.** In The Cure, compliance depends on trust. Disclosure, access and publishing buy Trust and lift global safety, at the cost of leakage and lost moat (§1.5).

## 2.4 Main screen

The user's UI rule applies: terse, icons first.
- **Top strip:**
  - cash runway;
  - compute;
  - the two race bars with a gap readout;
  - lead in months over the nearest rival and over China;
  - Scrutiny.

  Each meter has a Democracy-style cause strip on hover.
- **Centre: risk map.** Nodes are deployments, labs and China. Edges are flows: theft, distillation, talent, data. Incidents pulse on it. Plague Inc's map legibility applies.
- **Right rail:**
  - bottleneck bar;
  - Obligations (Commitments);
  - relations mini-web: 5 counterparties, each with Trust, Access rung and Favors;
  - rival intel cards, each with a posterior band.
- **Bottom: event queue.** Each event shows its telegraphed outcome and a deadline.

## 2.5 Making every lever a trade-off [D, grounded]

- **Cost and gain in different currencies**, plus an **exposure** line (§1.4). Pope's rule that both extremes must fail is the design test: simulate pure-race and pure-safety bots, and both must lose more often than mixed strategies. The existing simtest harness can run this.
- **Delayed costs** appear as ghost bars before you commit.
- **Diminishing returns** on every lever.
- **Prune with the Sylvester test.** Any variable that cannot be read through some proxy (an icon, a breakdown, an event) gets cut.

## 2.6 Pacing over 1-3 hours

| Act | Real time | New systems (Pope/Paperclips: one per beat) |
|---|---|---|
| 1 Startup | 0-20 min | Finance, departments, the first model. Gov and Public relations only. |
| 2 Frontier race | 20-60 min | Rival intel cards, research bodies, Commitments, the first evaluator report, the first Index edition. |
| 3 Automation | 60-100 min | AI-labour panel, a rising multiplier, China theft and distillation, statutory floors (§1.7), government ladder rungs 1-3. |
| 4 Takeoff | 100-180 min | Oversight Committee, treaty or lockdown. Peak tension. |

- **Selectable storyteller** (RimWorld). The Event Director preset sets the tension curve: "Rising" (Cassandra-like), "Chaotic" or "Measured". It guarantees quiet weeks after big crises and caps concurrent crises at 2.
- **Fast-forward** through quiet stretches.

## 2.7 Tutorialisation

- **Learn by experimentation (Factorio FFF #241).**
  - Goals come through the model and agenda tree.
  - The first model is lightly scripted: one forced finding teaches the disclosure dilemma.
  - Story is scripted while day-to-day play is random within parameters, as Pope describes.
- **Staged unlocks:** no panel appears before it matters.
- **One information channel**, the Codex. It is generated from game data like CK3's encyclopedia, and every mechanic links to its Part 4 precedent.
- **Reflective, non-judgemental end screen** (Fijak, Pope).
  - A causal replay of your 5 biggest decisions.
  - What the rivals' hidden profiles really were.
  - A comparison with AI 2027.
  - No moral verdict.

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
