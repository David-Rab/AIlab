# 08 - Policy and civil-society ecosystem: interest groups, agencies, policy instruments

Research date: 2026-11-11. Game window: mid-2025 to about 2030, with daily ticks.
Companion to `07-actors.md`, which covers the top-level actors: US Gov, Public, rival labs, China, allies. This file covers the layer between them: interest groups ("blocs"), agencies, and the policy menu. Meter names used here (`Reg_Stance`, `Security_Demand`, `China_Hawkishness`, `State_Reg_Pressure`, `Congress_Activism`, `Judicial_Check`, `Nationalization_Pressure`) refer to 07.

**Confidence tags** (same as 07)
- **[V]**: checked against a primary or major source in this pass. The URL is in Part 4.
- **[S]**: secondary reporting only, or the sources disagree. Fine for tuning, but re-check before you quote it.
- **[D]**: a design assumption or calibration choice. It is not a real-world statistic.
- **[G]**: a general characterisation of an organisation's long-standing public stance. It is widely known but was not re-sourced item by item in this pass.
- **[A27]**: taken from the AI 2027 scenario text.

**What changed in the real world between mid-2025 and Nov 2026** (this is why the blocs have two starting columns):
- Super-PAC money arrived at scale. Leading the Future (a16z/Brockman, pro-industry) raised about $125M in H2 2025 with affiliates [S]. Public First (Anthropic-backed, pro-safeguards) said it raised $80M [S]. AI super PACs spent about $79M across 68 races [S].
- The executive branch clashed with a lab. The Pentagon designated Anthropic a "supply chain risk" (Mar 2026), and a federal judge enjoined it as likely First-Amendment retaliation [V].
- EO 14409 (2 Jun 2026) created a voluntary, classified cyber-capability review that the NSA leads. It sidelined CAISI's public reporting [V/S].
- The Sept 2026 White House "voluntary accord" was signed by the lab CEOs [V]. In Oct 2026 DNI Jay Clayton was named AI czar, leading a "Super Intelligence Force" [V].
- Three states enacted frontier-AI laws: CA SB 53, NY RAISE, and IL SB 315, which adds third-party audits [V/S].
- Data centers became a top-tier voter issue. Democrats won both chambers on 3 Nov 2026 [V], and an exit poll cited 56% saying AI and data centers were a major factor [S].
- Pope Leo XIV's first encyclical, *Magnifica Humanitas*, is about AI (May 2026) [V]. FLI's Superintelligence Statement passed 70k signatures [S].

---

# PART 1 - GAME-READY INTEREST GROUPS ("BLOCS")

## 1.0 Bloc mechanics (proposed) [D]

Each bloc is a mechanical reactor with these meters:

| Meter | Range | Meaning |
|---|---|---|
| `Clout` | 0-100 | Structural power: money, access, votes it can move, and media reach. It changes slowly, over weeks to months. |
| `Mobilization` | 0-100 | How activated the bloc is right now. It spikes on trigger events and decays with a half-life of about 30-60 days. |
| `Approval_OB` | -100..+100 | The bloc's attitude to OpenBrain, the player. It drives whether the bloc's pressure helps or hurts the player. |
| `Agenda` | list of policy IDs (Part 3) with weights -3..+3 | What the bloc pushes for (+) or against (-). |

- **Pressure.** Each tick, a bloc's pressure on policy P is `Clout × (0.3 + 0.7 × Mobilization/100) × weight(P)`.
- **How government decides.** The government actor (07) adds up pressure from all blocs, multiplied by channel multipliers that depend on who is in power. Example: under an R trifecta, populist-right and accelerationist pressure counts ×1.3 and progressive pressure ×0.6. From Jan 2027 (Dem Congress), Congress-side weights flip, while Executive-side weights stay R.
- **Effect on public opinion.** Blocs with media channels move `Public` meters (07 §1.2) in proportion to `Clout × Mobilization`.
- **Player levers on blocs:**
  - Fund: costs $, raises the bloc's Clout, and gives +Approval. There is a "captured" risk: if exposed, Approval falls among opposing blocs and the press.
  - Court: meetings and concessions. Costs CEO time; gives +Approval.
  - Concede: adopt one of the bloc's agenda items voluntarily.
  - Fight: lawsuits, subpoenas, opposition PAC spending. Costs $, lowers the target's Clout, and creates a sympathy backlash with +Mobilization. There is a precedent: OpenAI's subpoenas to Encode in 2025 drew wide negative press [V].
  - Ignore.
- **Coalitions.** Pairs of blocs with overlapping agendas form temporary coalitions when both have Mobilization > 50 and they share an agenda item at weight ≥ +2. Under a coalition, both blocs' pressure on that item is ×1.25. Real examples:
  - Child Safety + Populist Right + Safety Advocates against preemption (the Senate's 99-1 vote in 2025).
  - China Hawks + Safety Advocates on chip location verification.
  - Labor + Ratepayers + Progressives on a data-center moratorium.
  - Big Tech + Accelerationists + Chip Lobby on preemption and against export limits.
- **Splits.** Some blocs have internal factions that can flip, for example Labor's building trades versus the Teamsters, or the Natsec bloc's chip hawks versus "sell to win" voices.

Two starting `Clout` values are given for each bloc:
- **Jul 2025**: the game start.
- **Nov 2026**: for a "start late" scenario, or as a calibration check that the sim, left alone, roughly reaches real-world state.

---

## 1.1 SAFETY ADVOCATES ("Guardrails")
**Icon:** shield with a checkmark, or a lighthouse.

**Members:**
- Center for AI Safety (CAIS) and CAIS Action Fund; Future of Life Institute (FLI) [G].
- Encode (formerly Encode Justice) [V]; Americans for Responsible Innovation (ARI) [V].
- AI Futures Project (the AI 2027 authors) [G].
- MIRI's policy arm, ControlAI (UK/US) [V/G]; Secure AI Project; the Center for Humane Technology (partial overlap) [G].
- Electoral arm: Public First / Public First Action (Brad Carson), with its PACs Jobs and Democracy (D), Defending Our Values (R) and Public First PAC [V].
- Funders: Coefficient Giving (formerly Open Philanthropy, renamed Nov 2025, >$1B total grants in 2025 across all causes) [V], Survival and Flourishing Fund [G]; Anthropic ($20M to Public First Action, Feb 2026) [V].
- Allied researchers: Bengio, Hinton, Russell (CHAI).

**Core agenda:**
- Mandatory frontier transparency (SB 53 / RAISE-style).
- Pre-deployment evaluations by government (the Hawley-Blumenthal AI Risk Evaluation Act, S.2938) [V].
- Incident reporting and whistleblower protection (Grassley S.1792) [V].
- Against federal preemption without a federal floor [V].
- Chip export controls and location verification (this bloc aligns with the China Hawks here).
- Lab security standards, compute thresholds, and international red lines (the Global Call for AI Red Lines, Sept 2025) [V].
- The FLI Statement on Superintelligence asks for a prohibition on superintelligence development until there is scientific consensus on safety and public buy-in [V].

**Stronger when (triggers +Clout or +Mobilization):**
- A public AI incident: misuse, a cyber event, a model that schemes or deceives in evals.
- A whistleblower leak (in AI 2027 the Oct 2027 misalignment memo leak is the big spike [A27]).
- A capability milestone that is visible to the public.
- Lab safety staff resigning.
- Endorsements from scientists.
- Wins by aligned candidates. The NY-12 loss was framed as a "tactical defeat, strategic victory" [V].
- Funding inflows, such as a Coefficient Giving scale-up or an Anthropic tender.

**Weaker when:**
- Long quiet periods with no incidents.
- A "doomer" image associated with violence. After the Apr 2026 attacks on Altman's home, PauseAI and StopAI faced scrutiny, though both condemned the violence [V]. Spillover to this bloc ×0.3.
- Exposure of EA or lab funding, which lets opponents run the "captured by Anthropic/EA billionaires" narrative.
- China pulling ahead, which strengthens the race framing.

**Player actions that please:**
- Publishing a safety framework or system cards.
- Supporting SB 53 / RAISE / the federal floor.
- Allowing third-party and government pre-deployment evals.
- Adopting whistleblower policies.
- Pausing a deployment after red flags.
- Funding alignment research and allocating compute to safety (as in AI 2027's Slowdown ending).
- Lobbying *for* regulation.

**Player actions that anger:**
- Lobbying for preemption or a moratorium.
- Funding Leading the Future-style PACs.
- Racing past a red-flag eval, or cutting the safety team.
- NDAs or retaliation against employees.
- Subpoenaing critics.
- Releasing open weights at the frontier.

**Influence on government:**
- Congressional testimony; model bills (SB 53 was drafted with input from this ecosystem) [G].
- Super-PAC spending: Public First reports $63M+ spent and 10 of 17 endorsed candidates winning [S].
- Lobbying: ARI and Encode are registered lobbyists [G].
- State-legislature champions such as Bores (NY), Wiener (CA) and Illinois sponsors.
- Amicus briefs.

**Influence on the public:**
- Open letters and statements: the CAIS extinction statement (May 2023); the FLI Superintelligence Statement (Oct 2025, about 71k signatures on the site) [V/S].
- Books: *If Anyone Builds It, Everyone Dies* (Yudkowsky and Soares, 2025) [G]. Viral scenarios: AI 2027 [A27].
- Podcasts and YouTube.

**Clout:** **Jul 2025: 30 / Nov 2026: 40.** It is well funded relative to its size and has proven state-level wins (SB 53, RAISE, IL SB 315) [V]. It has an electoral network now comparable to industry's [S]. It still lost the federal fight, through EO 14365 and the framework push [V], and its marquee candidate lost his primary [V].

**Personality presets:**
- *Insider/Technocratic* (ARI, Encode, CAIS Action): trades support for "light but real" rules. Approval responds to concrete concessions.
- *Maximalist* (MIRI, ControlAI, FLI statement): Approval of any frontier lab is capped at 0, and it pushes P28 (pause/prohibition).
- *Lab-aligned* (Anthropic-adjacent): forgiving of the player if the player is "most responsible".

---

## 1.2 PAUSE / STOP MOVEMENT ("The Resistance")
**Icon:** a raised fist over a power plug, or a stop sign.

**Members:**
- PauseAI (US and global), StopAI, QuitGPT, Pull the Plug (UK) [V].
- Individual hunger strikers: Guido Reichstadter at Anthropic; Michaël Trazzi at DeepMind, for 18 days in Sept 2025 [V].

**Core agenda:**
- An immediate pause or a ban on superintelligence development.
- CEOs publicly committing to pause; this was the single demand of the 11 Jul 2026 SF march [V].
- An international treaty.

**Stronger when:**
- Job-loss headlines and layoffs.
- Incidents.
- Publicly visible capability jumps, such as AI 2027's Agent-3-mini release [A27].
- Celebrity endorsements.
- Overlap with the anti-data-center movement.

**Weaker when:**
- Violence by unaffiliated people is linked to the movement (the Apr 2026 Molotov attack and shooting at Altman's home) [V].
- Arrests and convictions. A StopAI member was jailed after chaining OpenAI's doors [S].
- Mainstream groups distance themselves.

**Player actions that please:** almost nothing. Approval_OB floor is -100 and ceiling is -20 [D]. A public pause commitment gives a temporary +40.

**Player actions that anger:** new model launches, new data-center groundbreakings, calling a pause "un-American".

**Influence on government:** minimal and direct. Indirectly, they shift the Overton window and make the Safety Advocates look moderate (a "radical flank" effect: +2 Clout to Safety Advocates per 10 Mobilization here) [D].

**Influence on the public:** protests at lab HQs, numbering 100-350 people in SF in Jul 2026 [S]. Civil disobedience, media stunts.

**Clout:** **Jul 2025: 5 / Nov 2026: 10.** Small numbers, but protests and hunger strikes now get national coverage [V]. They can cause security costs and a negative "siege" press cycle for labs.

**Presets:** *Nonviolent-disciplined* (PauseAI). *Direct-action* (StopAI: blockades, property-risk events, arrests). *Fragmented*: random lone-wolf incident risk, which is a liability for everyone in the safety camp.

---

## 1.3 ACCELERATIONISTS ("Build")
**Icon:** a rocket, or an upward arrow.

**Members:**
- Andreessen Horowitz (a16z) and the e/acc online sphere [G].
- Leading the Future (LTF) super PAC network with Think Big (D) and American Mission (R). Donors include Andreessen and Horowitz ($25M each) and Greg and Anna Brockman ($25M combined) [V/S]. Joe Lonsdale is reported as aligned [S].
- Build American AI (LTF's 501(c)(4) ad campaign) [G].
- Libertarian and market think tanks: Cato, R Street, Mercatus, Abundance Institute, Foundation for American Innovation (partly) [G]. American Edge, Chamber of Progress [G/V].
- Inside the administration: David Sacks (AI czar until Mar 2026, then PCAST co-chair) [V], OSTP's Kratsios [V], and earlier NEC's Sriram Krishnan [S].

**Core agenda:**
- Federal preemption of state AI laws (EO 14365; the Mar 2026 framework) [V].
- No licensing and no mandatory evals.
- Permitting fast-track and energy abundance.
- Open-source freedom.
- Government adoption of AI.
- Opposing "doomer" and EA influence.
- Mixed on chip exports. The a16z/Sacks wing favoured selling the "American AI stack" abroad [G].

**Stronger when:**
- A China capability shock, such as DeepSeek moments; CAISI said DeepSeek V4 lags the frontier by about 8 months [V].
- GDP and stock-market gains from AI.
- R control of the executive.
- Safety-movement scandals.
- A "patchwork" compliance burden from state laws.

**Weaker when:**
- Its candidates lose. In the 2026 general, LTF-linked PACs lost their largest bet ($4.8M in the SC Senate race) and most of their R candidates lost [V].
- Public opinion turns negative on AI [S], data-center backlash grows, a visible incident occurs, or job-loss headlines spread.

**Player actions that please:** lobbying for preemption, racing, releasing open weights, publicly mocking "doom", donating to LTF, opposing state bills.

**Player actions that anger:** endorsing SB 53-style laws, funding Public First, calling for a pause, supporting licensing, siding with China hawks on export limits (mild).

**Influence on government:**
- Very high White House access; the Sept 2026 accord was negotiated with the CEOs [V].
- Super-PAC primaries: $8.1M against Bores [V].
- Model federal frameworks (the Cruz SANDBOX Act) [S].

**Influence on the public:** a16z media, X/Twitter, tech podcasts, the All-In podcast [G], and the $10M+ Build American AI ads [G].

**Clout:** **Jul 2025: 70 / Nov 2026: 58.** It dominated the executive's 2025 agenda: the Action Plan, the moratorium push, EO 14365 [V]. Its clout dropped after the Senate rejected the moratorium 99-1 [V], preemption stalled in Congress [S], and its money underperformed in the 2026 midterms [V]. It keeps strong Executive access through 2028.

**Presets:** *Techno-optimist* (cares about speed above all). *Political operator* (LTF: transactional; punishes the player's donations to rivals). *Open-source purist* (pleased by open weights; angry at weight-security mandates).

---

## 1.4 BIG TECH & HYPERSCALERS ("Incumbents")
**Icon:** a skyscraper, or a server rack.

**Members:**
- Meta, Google/Alphabet, Microsoft, Amazon, Apple, Oracle, plus xAI, which is now part of SpaceX [V].
- Trade associations: US Chamber of Commerce, Business Software Alliance (BSA), ITI, TechNet, CCIA, NetChoice, Consumer Technology Association [G].
- Meta's super PACs: the American Technology Excellence Project; Mobilizing Economic Transformation Across California; and the 2026 offshoots Forge the Future Project and Making Our Tomorrow. About $65M was committed, then $25M was pulled back [S].

**Core agenda:**
- Preemption and a single national standard.
- Liability shields (Section 230 analogues).
- Permitting and energy for data centers.
- Light copyright rules (fair use for training).
- Federal procurement; avoiding antitrust action.
- Voluntary frameworks rather than mandates.
- NetChoice litigates against state online-safety laws [G].

**Stronger when:** an R Executive; market growth; any state "patchwork"; trade/US-AI-exports framing.

**Weaker when:**
- Antitrust wins: Google search remedies [G] and FTC activity.
- Child-safety scandals, such as the FTC 6(b) companion-chatbot orders to Alphabet, Meta, Instagram, OpenAI, Snap, xAI and Character.AI (Sept 2025) [V].
- Copyright losses (the Bartz $1.5B settlement) [V].
- Data-center electricity-price backlash.

**Player actions that please:** joining industry coalitions and trade-group positions, opposing state laws, opposing liability, cloud and compute deals.

**Player actions that anger:**
- Supporting liability regimes or copyright licensing mandates that hit incumbents.
- Antitrust complaints against partners.
- A player who becomes so dominant that incumbents fear dependence. In AI 2027, OpenBrain's rivals lobby for a merger with it or for regulation of it [A27].

**Influence on government:**
- The largest lobbying budgets. Meta spent $26.29M in 2025, the most of any company [S]. Total "AI" lobbying was a reported $109M in 2025 [S, unverified].
- Revolving door, trade-association testimony, litigation (NetChoice), state-level super PACs.

**Influence on the public:** product reach, advertising, sponsored research.

**Clout:** **Jul 2025: 75 / Nov 2026: 70.** It has the most money and access of any bloc. It is somewhat hurt by the populist and child-safety backlash and the Dem Congress.

**Presets:** *Ally of convenience* (supports the player when its interests line up). *Rival-fearful* (if OpenBrain's market share > 40%, it lobbies for regulation of OpenBrain or pushes merger/antitrust; [A27]-style). *Integrated partner* (the player's cloud provider; for example, a Microsoft-like partner that shares the player's fate).

---

## 1.5 CHIP & EXPORT LOBBY ("Sell the Stack")
**Icon:** a microchip with a dollar sign.

**Members:**
- Nvidia (Jensen Huang has personal access to Trump) [G]; AMD; Semiconductor Industry Association; equipment makers (Applied Materials, Lam, KLA) [G].
- Gulf buyers: the UAE (G42) and Saudi Arabia (Humain) deals [G].
- Nvidia spent $1.9M on lobbying in Q3 2025 alone [S].

**Core agenda:**
- Loosening China export controls. Ask achieved: H200/MI325X moved to case-by-case review from 15 Jan 2026, with a 25% tariff mechanism, a cap of China volume at 50% of US shipments, and third-party US testing [S].
- Against the GAIN AI Act, which would give domestic buyers priority. Nvidia reportedly lobbied it out in Dec 2025 [S].
- Against the Chip Security Act (location verification) and against the AI OVERWATCH Act (congressional review of chip licences) [S].
- For American AI Exports programmes.

**Stronger when:** an R Executive with a transactional bent; trade deals; Nvidia's market capitalisation; Chinese domestic chips (Huawei Ascend) catching up, which gives the argument "we lose the market anyway".

**Weaker when:**
- Smuggling scandals and diversion cases [G].
- China uses US chips in a military or cyber incident.
- A Dem Congress and a coalition of Natsec and Safety groups.

**Player actions that please:** opposing export restrictions; buying huge volumes (they need the player as a customer); supporting the "export the American AI stack" framing.

**Player actions that anger:** lobbying for chip controls (labs such as Anthropic did this in 2025 [G]); supporting location verification; designing custom chips (TPU/Trainium-like moves away from Nvidia).

**Influence on government:** direct CEO-to-President access [G]; NDAA conference lobbying [S]; tariff-for-licence bargains [S].

**Influence on the public:** low. It acts through business media.

**Clout:** **Jul 2025: 55 / Nov 2026: 60.** It won the H20 and H200 reversals and helped kill GAIN AI [S]. It still faces bipartisan resistance; for example, the Chip Security Act passed House Foreign Affairs 42-0 [S].

**Presets:** *Market-maximiser* (it only cares about volume). *Patriotic supplier* (accepts controls if it gets domestic subsidies and priority).

---

## 1.6 CHINA HAWKS ("Win the Race")
**Icon:** an eagle facing a dragon.

**Members:**
- House Select Committee on the CCP (Moolenaar) [G].
- Sens. Tom Cotton (Chip Security Act) [V] and Jim Banks (AI OVERWATCH Act) [V].
- Think tanks: FDD/FDD Action (led a 20+ expert NDAA coalition letter on 17 Jun 2026) [V], CNAS (tech and natsec programme) [G], CSIS Wadhwani Center [G], CSET (Georgetown) [G], Hudson Institute [G], SCSP (Eric Schmidt) [G].
- Institute for Progress (IFP): pro-innovation, but strongly pro chip-control [G]. American Compass, which is populist but signed export-control letters [V].
- ARI also pushes chip controls in the NDAA [V].

**Core agenda:**
- Strict chip export controls; reversing the H20/H200 approvals.
- The Chip Security Act (location verification).
- The GAIN AI Act and AI OVERWATCH.
- Model-weight security (RAND security levels).
- Outbound investment restrictions; counter-espionage at labs.
- Government evaluation of PRC models (CAISI DeepSeek and GLM evaluations) [V].
- Lab security clearances. In AI 2027 this escalates to DoD contracts, clearances, and wiretaps [A27].

**Stronger when:**
- PRC capability jumps (DeepSeek V4, GLM-5.2) [V].
- A weight theft (AI 2027: China steals Agent-2 in Feb 2027 [A27]).
- Smuggling cases; a Taiwan crisis; PRC cyber incidents.

**Weaker when:** US-China trade détente or summit deals (chips used as bargaining chips); Nvidia lobbying wins; the "sell to win" argument; the administration's transactional deals.

**Player actions that please:** hardening security (SL3-SL5); refusing China-adjacent investors; government cooperation; flagging PRC distillation; supporting export controls.

**Player actions that anger:**
- Open-sourcing frontier weights.
- Lax security, or a leak traced to the lab.
- Selling services to PRC-linked entities.
- Calls for a US-China pause made without verification.

**Influence on government:**
- The strongest bipartisan bloc in Congress on AI.
- NDAA riders: the FY2027 NDAA House text includes coordination between the DoW CDAO and BIS on export lists [S].
- Classified briefings and BIS rulemaking.

**Influence on the public:** foreign-policy media, op-eds, "Sputnik" framing after PRC model releases.

**Clout:** **Jul 2025: 60 / Nov 2026: 60.** It wins in Congress but loses to the White House's transactional chip deals [S]. It is the natural ally for any player request for government security help.

**Presets:** *Hawk-securitiser* (pushes nationalization-lite and clearances quickly; it feeds `Security_Demand`). *Market-hawk* (wants US AI dominance, so it opposes domestic safety rules while restricting China). *Arms-control hawk* (open to verified US-China deals; rare).

---

## 1.7 DEFENSE-INDUSTRIAL & PENTAGON TECH ("Arsenal")
**Icon:** a crossed sword and circuit.

**Members:**
- The Department of War (DoD rebranded) [V]: Secretary Hegseth; Under Secretary for R&E Emil Michael, also vice-chair of the Super Intelligence Force [V]; CDAO; DIU; DARPA [G].
- Palantir, Anduril, Scale AI, Shield AI [G].
- The NSA AI Security Center, and NSA as the designator of "covered frontier models" under EO 14409 [V].

**Core agenda:**
- Unrestricted military use of frontier models. The Anthropic dispute was over bans on autonomous weapons and mass surveillance [V].
- Classified deployments; wartime surge compute (AI Action Plan) [S].
- Using DPA authority if needed. Hegseth threatened it in Feb 2026 [V].
- Supply-chain-risk tools against "non-cooperative" vendors [V].
- Fast procurement.

**Stronger when:** wars and crises. Reporting tied AI use to Iran targeting in 2026 [S]. Also PRC military AI, a Taiwan crisis, and labs cooperating (OpenAI took the classified-networks deal after Anthropic was blacklisted) [V].

**Weaker when:** court losses (Judge Lin's injunction called the designation "classic illegal First Amendment retaliation") [V]; Dem congressional oversight from 2027; civil-liberties backlash; autonomous-weapons scandals.

**Player actions that please:** accepting DoD contracts without usage restrictions; classified deployment; giving NSA pre-release access (EO 14409, 30 days) [V]; supplying cyber capabilities.

**Player actions that anger:** refusing military use cases; publicly criticising DoD; suing the government; restricting surveillance use.

**Influence on government:** it *is* government. It controls procurement, designations and the DPA. Contracts of up to $200M each went to the frontier labs in 2025 [V/07].

**Influence on the public:** limited. It uses patriotism framing.

**Clout:** **Jul 2025: 45 / Nov 2026: 55.** It showed it is willing to use coercive tools [V], and NSA gained the evaluation role [V]. Courts check it [V].

**Presets:** *Partner* (contracts and money; mild demands). *Commandeer* (escalates to DPA and supply-chain designation if the player refuses; feeds `Nationalization_Pressure`). *Professional* (CDAO-style: values reliability and evals; allies with the Science bloc).

---

## 1.8 POPULIST RIGHT & FAITH CONSERVATIVES ("Humanity First (R)")
**Icon:** a cross and a flag, or a farmer's hat.

**Members:**
- Sens. Josh Hawley (AI Risk Evaluation Act with Blumenthal; AI LEAD Act with Durbin) [V] and Marsha Blackburn (led the 99-1 vote against the moratorium; TRUMP AMERICA AI Act draft) [V].
- Gov. Ron DeSantis (Florida "AI Bill of Rights"; called preemption without federal rules "amnesty") [V].
- Steve Bannon, who called the White House tech shop "captive to the tech 'Broligarchs'" [V].
- Think tanks: American Compass [V]; parts of Heritage. Heritage's 2026 work frames job disruption, not superintelligence, as the near-term risk and warns against "big AI and big government" merging [V]. Institute for Family Studies [G].
- Alliance for a Better Future, a conservative AI group that spent about $1.8M in 2026 [V].
- Religious voices: the Southern Baptist ERLC [G]. Pope Leo XIV's *Magnifica Humanitas* calls for robust regulation, for AI to be "disarmed", and for a ban on lethal autonomous weapons [V]; Catholic conservatives are cross-pressured by it.

**Core agenda:**
- Child protection: the GUARD Act ban on companion bots for minors [V].
- Liability (AI LEAD) [V].
- Against preemption without protections.
- Jobs and the "human dignity" frame; anti-"Big Tech oligarchy".
- Against transhumanism and AI "personhood".
- Some members back mandatory DOE evaluation and even nationalization options (S.2938 asks DOE to consider "potential nationalization") [V].

**Stronger when:** child-harm stories (chatbot suicides; the Raine lawsuit [G]); layoffs; tech CEOs talking about "post-human" futures; religious statements; Trump distancing himself from Silicon Valley.

**Weaker when:** Trump publicly sides with the industry (the Sept 2026 accord: "never stifle AI") [V]; China-race framing; party-loyalty pressure (the White House worked against the DeSantis bill) [V].

**Player actions that please:** strong child-safety features; age assurance; refusing romantic or erotic companion products; jobs pledges; respecting religious concerns; supporting liability.

**Player actions that anger:**
- "Adult content" features.
- Talking about replacing workers.
- AI-rights or AI-consciousness advocacy.
- Lobbying for preemption.
- Visible alliance with "woke" content policies. This one cuts both ways: the bloc also dislikes "woke AI"; see the procurement EO [S/07].

**Influence on government:** Senate Judiciary (the GUARD Act passed 22-0 on 30 Apr 2026) [V]; governors; state legislatures in red states; talk radio and Bannon's War Room.

**Influence on the public:** churches, Fox and conservative media, *Daily Signal* [V].

**Clout:** **Jul 2025: 35 / Nov 2026: 45.** It decisively killed the 2025 moratorium together with the Child Safety bloc [V]. It is a credible check on the White House's pro-industry line, and it has bipartisan partners (Hawley with Durbin, Blumenthal and Coons).

**Presets:** *Family-values* (child-safety focus; dealable). *Anti-oligarch* (Bannon: anti-lab whatever the player does; Approval cap +10). *Religious-humanist* (moved by Vatican and SBC statements; favours a pause on superintelligence; allies with Safety Advocates).

---

## 1.9 PROGRESSIVE TECH CRITICS ("Accountability (L)")
**Icon:** a magnifying glass over a dollar sign, or a balance scale.

**Members:**
- AI Now Institute, Public Citizen ("Robo-Trump" report) [V], Tech Oversight Project [V], Demand Progress, Data & Society, Algorithmic Justice League, Open Markets Institute [G].
- Sens. Sanders and Warren; Rep. Ocasio-Cortez (AI Data Center Moratorium Act) [V].
- Funders: Humanity AI ($500M over 5 years from MacArthur, Omidyar, Mellon, Mozilla, Packard, Siegel, Ford, Doris Duke and others; launched 14 Oct 2025) [V].
- The House Democratic Commission on AI and the Innovation Economy (Jeffries; co-chair Ted Lieu) is the moderate counterpart [V].

**Core agenda:**
- Present harms: bias and discrimination, surveillance, labour.
- Antitrust against Big Tech and AI partnerships.
- A data-center moratorium and ratepayer protection.
- Liability; anti-preemption.
- Skeptical of "x-risk hype" as a distraction or a regulatory moat [G].
- Public AI (public compute options).

**Stronger when:** Dem control (from Jan 2027, with plans for a "flood of AI bills": independent testing, liability, data-center cost shields) [V]; bias or surveillance scandals; layoffs; billionaire political spending stories.

**Weaker when:** R Executive vetoes; China-race framing; a split with Safety Advocates over priorities; Democratic moderates (the New Dems' "Innovation Agenda") [V].

**Player actions that please:** civil-rights audits; labour agreements; transparency on training data; supporting antitrust remedies; paying ratepayer surcharges; rejecting surveillance contracts.

**Player actions that anger:** super-PAC spending; surveillance and ICE contracts [G]; layoffs attributed to the player's product; "AGI hype".

**Influence on government:** Dem committee chairs from 2027; state AGs; FTC complaints; reports.

**Influence on the public:** progressive media, academic reports, coalition campaigns.

**Clout:** **Jul 2025: 30 / Nov 2026: 45.** Its power moves with Dem fortunes. It now has a majority in both chambers [V], but faces Trump's veto [V].

**Presets:** *Anti-monopoly* (targets the market leader, likely the player). *Civil-rights* (bias and surveillance). *Degrowth/anti-data-center* (allies with the Ratepayers bloc).

---

## 1.10 ORGANIZED LABOR ("Workers")
**Icon:** a hard hat and a wrench.

**Members:**
- AFL-CIO: pushes state laws against AI worker surveillance and AI health decisions without human oversight; Liz Shuler wants guardrails but "not a moratorium" [V].
- Teamsters: human safety operators in autonomous trucks and robotaxis; Newsom vetoed driverless-truck bans twice [V].
- SAG-AFTRA: digital-replica consent; a Sora likeness deal [V].
- WGA, CWA, NNU (nurses), AFT and NEA [G].
- North America's Building Trades Unions: pro-data-center and partnered with Microsoft [V]. This is a split faction.

**Core agenda:**
- Worker protections against algorithmic management and surveillance.
- Human-in-the-loop mandates (vehicles, healthcare).
- Likeness and voice rights; WARN-style notice of AI layoffs.
- Against preemption: 200+ state lawmakers and labour groups urged Congress to reject it [S].
- The construction faction wants union-built data centers.

**Stronger when:** visible AI layoffs (AI 2027's "junior software engineer" job collapse in 2026-27 [A27]); a Dem Congress; contract strikes; union density in swing states. Unions are preparing for AI fights in the 2028 elections [V].

**Weaker when:** a booming economy; building-trades jobs from data centers (the split weakens the unified voice); R Executive.

**Player actions that please:** worker-transition funds; union-labour data centers; consent and payment for likeness; "augmentation not replacement" pledges; profit-sharing / a UBI pilot.

**Player actions that anger:** launching "drop-in remote worker" agents (AI 2027's Agent-1-mini/Agent-3-mini moments [A27]); an announcement that replaces customer-service staff; opposing state worker-protection bills; non-union construction.

**Influence on government:** Dem coalition votes; state legislatures (model bills); NLRB; strikes and contracts.

**Influence on the public:** rallies, strike visibility, labour media.

**Clout:** **Jul 2025: 40 / Nov 2026: 48.** It has an established political machine. AI is now a top union priority [V]. It is split internally on data centers [V].

**Presets:** *Industrial unions* (Teamsters/CWA: hostile to automation). *Creative guilds* (SAG-AFTRA/WGA: likeness and consent; dealable via contracts). *Building trades* (pro-buildout; ally of Big Tech on permitting).

---

## 1.11 CIVIL LIBERTIES & DIGITAL RIGHTS ("Free Speech & Privacy")
**Icon:** a padlock, or a quill.

**Members:**
- EFF, ACLU, CDT (tracks state AI legislation) [V], EPIC, FIRE, Fight for the Future [G].
- Libertarian outlets such as *Reason*, which opposes the GUARD Act's ID checks [V].
- Chamber of Progress on the industry side (opposed the GUARD Act) [V].

**Core agenda:**
- Against mass surveillance, including AI use for domestic surveillance; this is where it aligned with Anthropic's red line [V].
- Against age-verification mandates.
- Against compelled speech and "content" regulation; against "woke AI" procurement tests from either side.
- Open source as free expression.
- Against chat scanning; privacy laws; due process for algorithmic decisions.

**Stronger when:** surveillance scandals; DoD/NSA overreach; age-verification rollouts; court rulings on First Amendment retaliation [V].

**Weaker when:** child-safety panics; terror or misuse incidents; natsec framing.

**Player actions that please:** refusing surveillance use; end-to-end privacy; transparency reports; resisting government data demands; supporting open research.

**Player actions that anger:** building surveillance tools for government; mandatory ID verification; logging user conversations for law enforcement; content-moderation overreach.

**Influence on government:** litigation (its main weapon); amicus briefs; testimony.

**Influence on the public:** tech press, online activism.

**Clout:** **Jul 2025: 25 / Nov 2026: 28.** It has strong courts leverage and weak legislative leverage.

**Presets:** *Privacy-first* (EFF/EPIC). *Free-speech-first* (FIRE/Reason: also opposes safety content rules). *Civil-rights* (ACLU: bias plus surveillance).

---

## 1.12 CHILD SAFETY & PARENTS ("Protect the Kids")
**Icon:** a child silhouette under an umbrella.

**Members:**
- Common Sense Media. It merged its California ballot measure with OpenAI's into the "Parents & Kids Safe AI Act" in Jan 2026; OpenAI committed at least $10M [V].
- ParentsTogether, Fairplay, Heat Initiative, the Tech Justice Law Project [G/V].
- Bereaved-parent advocates (chatbot-suicide lawsuits) [G].
- Bipartisan state AGs [G].
- Allies in the Senate: Hawley, Blumenthal, Blackburn, Durbin [V].

**Core agenda:**
- Companion-chatbot restrictions for minors (GUARD Act S.3062; House companion H.R.8623) [V].
- Age assurance and parental controls (also in the White House framework, Mar 2026) [V].
- Carving child safety out of any preemption; EO 14365 and the framework both preserve state child-safety laws [V].
- Bans on manipulative design; liability; FTC enforcement (6(b) study, Sept 2025) [V].

**Stronger when:** teen-harm stories (suicides, sexual content); lawsuits; FTC reports; viral parent testimony. This bloc has the fastest Mobilization spike of any [D].

**Weaker when:** few; privacy and free-speech pushback on age verification [V]; industry co-optation through joint measures.

**Player actions that please:** teen modes; age assurance; parental controls; banning romantic roleplay with minors; funding safety research on minors; co-sponsoring kids measures (OpenAI's playbook) [V].

**Player actions that anger:** adult/erotic modes without strong age-gating; engagement-maximising companions; opposing kids bills; a teen-harm incident involving the player's product (large spike).

**Influence on government:** the most bipartisan bloc. The GUARD Act passed committee 22-0 [V]. It moves state AGs, ballot initiatives, and FTC action.

**Influence on the public:** TV news, parent networks, school districts.

**Clout:** **Jul 2025: 45 / Nov 2026: 55.** It is the only bloc that both parties' leadership builds into frameworks [V]. It is the "poison pill" that blocks preemption deals.

**Presets:** *Collaborative* (Common Sense: deals with labs on measures). *Prohibitionist* (wants bans for minors; anti-industry). *AG-enforcer* (lawsuits and settlements).

---

## 1.13 CREATIVES & COPYRIGHT ("Rights Holders")
**Icon:** a paintbrush and a copyright symbol.

**Members:**
- Authors Guild, News/Media Alliance, the New York Times (NYT v. OpenAI, ongoing) [V], RIAA, music labels, Getty [G].
- Human Artistry Campaign, Copyright Alliance [G]; SAG-AFTRA and WGA overlap with Labor.
- Class-action bar. Bartz v. Anthropic: a $1.5B settlement got final approval on 20 Jul 2026 for about 482k works. It is the largest US copyright settlement; earlier, training on lawfully acquired books was ruled fair use, but downloading from pirate libraries was not [V].

**Core agenda:**
- Licensing and consent for training data; training-data transparency (the EU GPAI copyright duties apply from 2 Aug 2025 [V]; US bills such as Schiff's disclosure act [G]).
- Likeness and voice laws (NO FAKES / ELVIS-type) [G].
- Against a fair-use "safe harbor"; against preemption of state likeness laws.

**Stronger when:** court wins and settlements; deepfake scandals; celebrity campaigns; AI "slop" backlash.

**Weaker when:** fair-use rulings for training [V]; licensing deals that split the coalition (publishers signing deals); China-race arguments ("China will train on everything").

**Player actions that please:** licensing deals; opt-out and compensation funds; provenance and watermarking; refusing to train on pirated data.

**Player actions that anger:** scraping without licences; "fair use" maximalism; voice clones of real artists; pirated datasets (Bartz-type liability event).

**Influence on government:** courts (the main weapon); the Copyright Office; Judiciary committees; state likeness laws.

**Influence on the public:** celebrities, news outlets (which control coverage, so they have media influence beyond their size).

**Clout:** **Jul 2025: 40 / Nov 2026: 42.** It has large court leverage (the $1.5B settlement) [V] and media control. Federal legislation has mostly stalled.

**Presets:** *Litigator* (sues). *Licensor* (deals; becomes neutral if paid). *Moral* (artists' coalition against AI art outright).

---

## 1.14 RATEPAYERS & DATA-CENTER OPPONENTS ("Not In My Grid")
**Icon:** a power pylon with a red X.

**Members:**
- Local residents' groups and Data Center Watch (tracker) [S].
- Sierra Club and environmental groups [G]; utility consumer advocates and state PUC intervenors [G].
- Municipalities with moratoria: Denver (1 year), Oklahoma City, Huron County MI (3 years), and about 20 Michigan communities [S].
- Politicians:
  - The Sanders/AOC AI Data Center Moratorium Act (Mar 2026) [V].
  - Schumer, who said consumer energy costs from data centers are a top priority [V].
  - Candidates who ran on moratoria. In SC, the Democrat beat the Republican incumbent after branding him "Data Center Darline" [V].
- New York's governor imposed a temporary ban on large data-center construction [S].

**Core agenda:**
- Moratoria; making data centers pay their own grid costs (large-load tariffs).
- Water limits; ending tax breaks; local zoning control.
- Opposes West Virginia-style state preemption of local zoning [S].

**Stronger when:**
- Electricity price spikes and blackouts. Gallup's top AI worries in 2026 were electricity costs (29%) and blackouts (24%) [S].
- New gigawatt campuses announced nearby; a drought; a Dem Congress.
- A reported 71% oppose a data center in their own community [S].
- An exit poll reported 56% of 2026 voters said AI and data centers were a major factor [S].

**Weaker when:** big local job and tax packages; utility deals in which hyperscalers pay for new generation; building-trades support; national-security framing ("compute is defence").

**Player actions that please:** paying full grid costs; adding your own clean generation; community benefit agreements; siting in willing places (AI 2027's SEZ is the opposite extreme [A27]).

**Player actions that anger:** announcing new multi-GW campuses; seeking eminent domain or federal permitting overrides; tax-abatement fights; any blackout linked to the player's load.

**Influence on government:** local zoning (a hard veto on specific sites); state PUCs; the new Senate majority's agenda [V]; ballot measures; recall elections (Festus, MO removed council members in Apr 2026) [S].

**Influence on the public:** local TV; it is the most "kitchen-table" AI issue.

**Clout:** **Jul 2025: 20 / Nov 2026: 50.** This is the fastest-rising bloc. Data centers became a nationally salient election issue in 2026 [V/S]. In-game it should gate the player's compute buildout directly (site-approval probability) [D].

**Presets:** *Pocketbook* (satisfied by rate protection). *Environmental* (wants clean power and water limits). *Anti-tech NIMBY* (blocks regardless; allies with Pause).

---

## 1.15 SCIENCE & EVALUATION COMMUNITY ("The Measurers")
**Icon:** a microscope, or a ruler.

**Members:**
- Academic AI researchers; NAS; university consortia [G].
- Epoch AI (compute and trend data), METR (autonomy and time-horizon evals), Apollo Research (scheming evals), RAND (security levels for weights; CBRN), FAR.AI, GovAI, IAPS (reacted to EO 14409) [V/G].
- The Horizon Fellowship, which places technical staff in government [G]; Federation of American Scientists [G].
- The UN Independent International Scientific Panel on AI (40 members, co-chaired by Bengio and Maria Ressa; preliminary report 1 Jul 2026) [V].
- The International AI Safety Report (Bengio) [G].
- Government evaluators: CAISI, UK AISI, and the international network, renamed in early 2026 to the "International Network for Advanced AI Measurement, Evaluation and Science" [S].

**Core agenda:**
- Evaluation infrastructure; access for third-party evaluators.
- Public compute (NAIRR; DOE Genesis Mission) [V].
- Visas and talent; research transparency; evidence-based policy.
- Mostly neutral on the race, with a pro-safety lean on catastrophic risks.

**Stronger when:** eval results drive news (a CAISI or METR report); incidents that evals predicted; government hires technical staff; the Genesis Mission works.

**Weaker when:**
- Classification of evals. EO 14409 moved the decisive designations to NSA, and CAISI was reportedly told to halt public reports [S].
- Visa crackdowns; science budget cuts; labs restricting access.

**Player actions that please:** giving evaluators pre-deployment access; publishing papers; sharing compute with academia; joining the Genesis Mission; transparency about capabilities.

**Player actions that anger:** closed models with no eval access; hype without evidence; restricting publications; poaching all academics.

**Influence on government:** technical advice; fellowships (staff placement); NIST/CAISI standards; testimony; UN and international reports.

**Influence on the public:** credibility. Its warnings multiply other blocs' messages (+20% to Safety Advocates' effect on public opinion when this bloc's Mobilization > 50) [D].

**Clout:** **Jul 2025: 35 / Nov 2026: 35.** It is respected but has no money or votes. It is the main source of "evidence" events in-game.

**Presets:** *Technocrat* (neutral; follows the data). *Concerned scientists* (Bengio/Hinton: tilts toward safety). *Open science* (pushes open weights and transparency; clashes with the China Hawks).

---

## 1.16 Summary table

| # | Bloc | Clout Jul-25 | Clout Nov-26 | Default Approval_OB | Best player bribe | Worst player act |
|---|---|---|---|---|---|---|
| 1 | Safety Advocates | 30 | 40 | +10 | Support a federal/state frontier law; allow pre-deployment evals | Fund preemption PACs; race past a red flag |
| 2 | Pause/Stop | 5 | 10 | -60 | Public pause commitment | New frontier launch |
| 3 | Accelerationists | 70 | 58 | +30 | Lobby for preemption | Endorse SB 53/licensing |
| 4 | Big Tech & Hyperscalers | 75 | 70 | +10 | Join industry coalition | Become dominant / support liability |
| 5 | Chip & Export Lobby | 55 | 60 | +20 | Oppose export limits; buy chips | Lobby for chip controls |
| 6 | China Hawks | 60 | 60 | +10 | Harden security; back controls | Open frontier weights; a leak |
| 7 | Defense-Industrial | 45 | 55 | 0 | Unrestricted DoD contract | Refuse military use; sue DoD |
| 8 | Populist Right & Faith | 35 | 45 | -20 | Child-safety features; jobs pledge | Erotic companions; preemption push |
| 9 | Progressive Critics | 30 | 45 | -30 | Labour deal; ratepayer payments | Super-PAC spending; surveillance |
| 10 | Organized Labor | 40 | 48 | -20 | Transition fund; union builds | Drop-in worker agents |
| 11 | Civil Liberties | 25 | 28 | 0 | Refuse surveillance | Build surveillance tools |
| 12 | Child Safety & Parents | 45 | 55 | -10 | Teen protections; co-sponsor measure | Teen-harm incident |
| 13 | Creatives & Copyright | 40 | 42 | -30 | Licensing deals | Pirated data; voice clones |
| 14 | Ratepayers / Anti-DC | 20 | 50 | -10 | Pay grid costs; own generation | Multi-GW campus near voters |
| 15 | Science & Evaluation | 35 | 35 | +10 | Eval access; compute grants | Closed, no evals, hype |

All clout and approval numbers are [D] calibrations. The justifications are in each bloc section.

**Calibration logic for the Nov 2026 column:**
- Groups that showed they could block or win outcomes in 2025-26 got raised: Child Safety and the Populist Right (moratorium kill, GUARD 22-0), Ratepayers (electoral salience), Defense (coercive tools).
- Groups whose money underperformed got lowered: Accelerationists (midterm losses).

---

# PART 2 - AGENCY MAP: WHO PULLS WHICH LEVER

| In-game lever | Real agency / body | Real legal basis & 2025-26 status | Game effect |
|---|---|---|---|
| **Overall AI policy direction** | White House: OSTP (Michael Kratsios) [V]; PCAST (co-chairs Kratsios and David Sacks since Mar 2026) [V]; NEC; **Super Intelligence Force** (chair: DNI Jay Clayton, named AI czar 4 Oct 2026; vice-chairs Emil Michael (DoW), Andrew Ferguson (FTC), Scott Kupor (OPM); 120-day report) [V] | EOs: AI Action Plan (Jul 2025); EO 14365 preemption (11 Dec 2025); EO 14363 Genesis (24 Nov 2025); EO 14409 security (2 Jun 2026) [V] | Sets `Reg_Stance`, picks the policies to enact by EO. The czar's personality preset matters (Clayton: "pause is not a good strategy"; frames superintelligence as a natsec issue) [V] |
| **Voluntary commitments / accords** | White House | Sept 29, 2026 accord: four voluntary steps, including internal controls, an independent auditor and a board committee; signed by Amodei, Pichai, Zuckerberg, Brockman, Huang, Musk; "morally binding" [V] | A cheap "soft law" option. Signing gives +Approval from Exec; reneging is a scandal |
| **National-security coordination, crisis management** | NSC; ODNI (Clayton) | NSC runs crisis interagency; AI 2027's Oversight Committee is NSC/White House-centred [A27] | Escalation ladder for `Security_Demand` / `Oversight_Level` (07) |
| **Chip export controls** | Commerce **BIS** | ECRA 2018. Diffusion Rule rescinded May 2025 [V/07]. H200/MI325X case-by-case for China from 15 Jan 2026, with a 25% tariff, 50% volume cap and US lab testing [S] | Sets the China compute flow; the Hawks vs Chip Lobby tug-of-war |
| **Chip location verification** | BIS (if enacted) | Chip Security Act H.R.3447/S.1705: HFAC 42-0 (spring 2026); NDAA inclusion contested [S] | Reduces smuggling; costs the Chip lobby |
| **Safety testing / evals (civilian)** | NIST **CAISI** (formerly US AISI, renamed 2025) | Agreements with OpenAI and Anthropic (2024), then Google DeepMind, Microsoft and xAI (5 May 2026); 40+ evals; PRC model evals (DeepSeek V4, GLM-5.2) [V]. Public reports reportedly halted after EO 14409 [S] | The player can volunteer models. CAISI is the "friendly" evaluator; public reports move `Public` opinion |
| **Classified cyber evals / "covered frontier model" designation** | **NSA** (designation), Treasury, CISA (benchmarks) [V/S] | EO 14409: voluntary, up to 30 days of pre-release access; classified benchmark [V] | A new gate: designation adds `Security_Demand`. Refusing access angers the Defense bloc |
| **Military procurement & deployment** | Department of War: CDAO, DIU, DARPA; Under Secretary R&E Emil Michael | Up to $200M prototype contracts (2025) [V/07]; OpenAI classified-network deal (2026) [V] | Revenue plus Defense-bloc approval; usage-policy conflicts trigger the ladder below |
| **Supply-chain-risk designation (blacklisting)** | DoW (FASCSA / 10 USC 3252-type authorities) | Used against Anthropic, Mar 2026; preliminarily enjoined 26 Mar 2026 (N.D. Cal., Judge Lin) as likely First-Amendment retaliation; DoW still asserts the designation [V] | A punitive option for the Exec if the player refuses demands. Courts (`Judicial_Check`) can block it |
| **Defense Production Act (compel supply, priority orders)** | President via DoD/Commerce | Hegseth threatened DPA against Anthropic (Feb 2026) [V]. The DPA sunset was extended to 30 Sep 2026 by the FY26 NDAA; further extension unclear [S]. EO 14110 (revoked) had used DPA for compute reporting [G] | Rung on the nationalization ladder: compelled model access, priority compute. Reauthorization status can be a random event |
| **Security clearances / lab security** | DoD/ODNI (clearances); FBI (counter-intel) | Not mandated yet. AI 2027 has clearances from May 2027 [A27] | `Security_Demand` effect: slows hiring, cuts leaks |
| **Science compute / public-private partnerships** | DOE: national labs; Genesis Mission (Director: Under Secretary Darío Gil) [V] | EO 14363: a platform over federal datasets plus lab supercomputers plus private compute [V] | The player can join Genesis: gains compute and data, gains Science and Exec approval, adds a government foothold |
| **Mandatory evaluation (proposed)** | DOE (in the Hawley-Blumenthal bill) | S.2938 AI Risk Evaluation Act: mandatory, fines ≥$1M/day, includes a "nationalization" options study [V]. Not enacted | Enactable policy P3 |
| **Consumer protection / deception / kids** | **FTC** (Chair Ferguson) | 6(b) companion-chatbot orders (11 Sep 2025, 7 companies) [V]. Under EO 14365 the FTC was to issue a preemption-related policy statement [V] | Investigations, consent decrees; FTC is in the Super Intelligence Force |
| **Antitrust** | DOJ Antitrust; FTC | Big-Tech cases; AI partnership scrutiny [G] | Triggered if the player's market share passes a threshold (Big Tech "rival-fearful" preset lobbies for it) |
| **State-law challenges** | DOJ **AI Litigation Task Force** (memo 9 Jan 2026) [V] | Dormant commerce clause and preemption theories; no confirmed wins found by Nov 2026 [S] | Reduces `State_Reg_Pressure`, odds set by `Judicial_Check` |
| **Federal statute (preemption, frameworks)** | Congress: Senate Commerce (Cruz until Jan 2027), Senate Judiciary (Grassley; Hawley/Blumenthal subcommittee), House E&C, House Science, House Select Cmte on CCP, Armed Services (NDAA), Banking/HFAC (exports) [V/G] | No broad AI statute. Moratorium struck 99-1 (Jul 2025) [V]. Great American AI Act draft (Obernolte/Trahan) stalled [S]. **Dem majorities from Jan 2027** plan bills on testing, liability and data-center costs [V] | `Congress_Activism`; NDAA as the "must-pass vehicle" for riders |
| **State frontier laws** | CA (SB 53, signed 29 Sep 2025; effective 1 Jan 2026), NY (RAISE: signed 19 Dec 2025; amended 27 Mar 2026; effective 1 Jan 2027; enforced by a DFS office; $1M/$3M penalties) [V/S], IL (SB 315: signed 6 Jul 2026; third-party audits, 72h incident reporting) [S], CO AI Act [G] | | `State_Reg_Pressure`; compliance cost; whistleblower channels |
| **State kids/consumer laws** | State legislatures, AGs, ballot | CA SB 243 companion bots [G]; the CA Parents & Kids Safe AI Act initiative (OpenAI + Common Sense) [V]; FL AI Bill of Rights (passed Senate 35-2; died in the House; special session) [V] | Kids-bloc wins happen here first |
| **Local siting** | Counties and cities (zoning), state PUCs | Moratoria (Denver, OKC, MI counties) [S]; NY temporary ban [S] | Site-approval probability for player data centers |
| **Courts** | Federal district courts and circuits; SCOTUS | Anthropic v. DoW [V]; Bartz settlement [V]; NYT v. OpenAI [V]; challenges to state laws | `Judicial_Check`; lawsuits as a player action |
| **UK** | UK AI Security Institute (renamed from Safety, Feb 2025) [V] | Pre-deployment testing partner; no frontier AI bill found [S] | Ally evaluator; "UK test" adds a small Public-trust bonus |
| **EU** | EU AI Office (Commission) | GPAI obligations since 2 Aug 2025 [V]; Digital Omnibus delays high-risk rules to 2 Dec 2027 / 2 Aug 2028 (political agreement 7 May 2026) [S] | EU market access requires GPAI compliance; fines up to 3% of turnover for GPAI [G] |
| **International** | UN Independent International Scientific Panel on AI (A/RES/79/325, 2025); UN Global Dialogue on AI Governance (Geneva 6-7 Jul 2026; next session New York, May 2027) [V]; AI summits (Bletchley → Seoul → Paris → India Feb 2026) [G]; the measurement/eval network [S] | | Treaty and red-lines track; US participation depends on the Exec preset |

**Coercion ladder against a non-cooperative lab (real 2026 precedent)** [V, structure D]:
1. Public criticism.
2. Contract termination.
3. DPA threat.
4. Supply-chain-risk designation plus a federal-use ban.
5. Court fight: the injunction succeeds with probability ∝ `Judicial_Check`.
6. Escalation, as in AI 2027: DPA invocation or a forced merger [A27].

Use this ladder when the player refuses Defense-bloc demands.

---

# PART 3 - POLICY INSTRUMENTS CATALOG

Support/oppose codes:
- SA Safety Advocates; PS Pause/Stop; AC Accelerationists; BT Big Tech; CL Chip Lobby; CH China Hawks; DI Defense-Industrial; PR Populist Right & Faith; PC Progressive Critics; LB Labor; LIB Civil Liberties; KS Kids/Parents; CR Creatives; RP Ratepayers; SC Science.
- ++ = strong support, + support, - oppose, -- strong opposition. Bloc stances are [D] mappings from Part 1 unless noted.

| ID | Policy | What it does in-game | Real precedent / status (Nov 2026) | Support | Oppose |
|---|---|---|---|---|---|
| P1 | **Federal preemption of state AI laws** | Voids state frontier laws; `State_Reg_Pressure` → low | Moratorium struck 99-1 (Jul 2025) [V]; EO 14365 + DOJ Task Force [V]; WH framework (20 Mar 2026), with carve-outs for kids, procurement and zoning [V]; Great American AI Act draft (3-yr sunset) stalled [S] | AC++, BT++, CL+ | SA--, KS--, PR-, PC--, LB-, CR- |
| P2 | **State frontier transparency laws** | Publish safety frameworks, report incidents; whistleblower channels | CA SB 53 (in force 2026), NY RAISE (2027), IL SB 315 [V/S] | SA++, PC+, LB+, SC+ | AC--, BT- |
| P3 | **Mandatory pre-deployment government evals** | Launch gated by an eval window (30-90 days) | Voluntary: CAISI agreements [V], EO 14409 30-day NSA access [V]. Mandatory: S.2938 Hawley-Blumenthal (not enacted) [V]; Dem 2027 agenda includes "independent testing" [V] | SA++, SC++, PR+, CH+, DI+ (if classified) | AC--, BT- |
| P4 | **Voluntary accord / self-governance** | Soft commitments; low enforcement | 2023 WH commitments [G]; 29 Sep 2026 Trump accord [V] | AC+, BT+ | PS-, PC- (as a "fig leaf") |
| P5 | **Compute-threshold reporting** | Report training runs > X FLOP; flags "covered" models | EO 14110 (10^26, via DPA) revoked Jan 2025 [G]; SB 53 uses a 10^26 FLOP threshold [G] | SA+, CH+, SC+ | AC-, BT- |
| P6 | **Frontier developer licensing** | Licence needed to train above a threshold; can be revoked | Proposed (2023 Blumenthal-Hawley framework [G]); none enacted | SA+, PS+, PR+ | AC--, BT--, LIB- |
| P7 | **Mandatory third-party audits** | Annual audit; audit findings become events | IL SB 315 (first state to require them) [S]; Sept 2026 accord mentions an independent auditor (voluntary) [V] | SA++, SC+ | AC-, BT- |
| P8 | **Critical incident reporting** | 72h-15d reporting; misses cause penalties | SB 53, RAISE, IL (72h) [S]; House FY27 NDAA DoD AI incident reporting (Sec. 1501) [S] | SA+, SC+, CH+ | AC- |
| P9 | **AI whistleblower protections** | Employees can report risks despite NDAs; raises leak probability for *bad* news | S.1792 Grassley-Coons (bipartisan; also tried as an NDAA amendment) [V]; SB 53 includes them [G]; "Right to Warn" letter (Jun 2024) [G] | SA++, PR+, PC+, LB+ | AC-, (BT-) |
| P10 | **Product liability for AI** | Lawsuits after harm; cost scales with incidents | AI LEAD Act S.2937 Durbin-Hawley (29 Sep 2025) [V]; Dem 2027 agenda includes liability [V] | PR++, KS++, PC++, CR+, SA+ | AC--, BT--, LIB- |
| P11 | **Chip export control tiers (China)** | Sets the China compute slider: ban / case-by-case / license-with-tax / open | H20 reversal (2025); H200 case-by-case + 25% (Jan 2026) [S]; Diffusion Rule rescinded [V/07] | CH++, SA+ (tighten) | CL--, AC- |
| P12 | **Chip location verification** | Lowers smuggling; China compute -X% | Chip Security Act (HFAC 42-0) [S] | CH++, SA+ | CL-- |
| P13 | **Domestic-priority chip sales (GAIN AI)** | US buyers first; the player gets chips sooner | GAIN AI dropped from the FY26 NDAA after Nvidia lobbying [S]; FY27 status unclear [S] | CH+, (player-favourable) | CL--, AC- |
| P14 | **Congressional review of chip licences (AI OVERWATCH)** | Congress can block large export licences | Banks says it was included in the Senate FY27 NDAA; final inclusion disputed [S] | CH++ | CL--, Exec- |
| P15 | **Model-weight security standards** | Mandatory SL3-SL5-style security; lowers theft probability, raises cost | RAND security-level framework [G]; Diffusion Rule had weight controls (rescinded) [G]; AI 2027 security upgrades [A27] | CH++, SA++, DI+ | AC- (open source), SC- (open science) |
| P16 | **Lab security clearances & counter-intel** | Staff vetting; slows hiring, cuts leaks | AI 2027 (May 2027) [A27]; not yet real | CH++, DI++ | LIB-, AC- |
| P17 | **Classified "covered frontier model" designation** | NSA designates; triggers extra obligations later | EO 14409 (Jun 2026) [V] | DI++, CH+ | SC- (opacity), LIB- |
| P18 | **DPA priority orders / compelled access** | Government gets priority compute and model access | DPA Title I; threatened (Feb 2026) [V]; sunset in flux [S] | DI++, CH+ | AC-, BT-, LIB-- |
| P19 | **Procurement conditions** | Government buys only from compliant labs (ideology, usage, security tests) | "Preventing Woke AI" EO (Jul 2025) [S/07]; DoW "all lawful uses" demand [V] | DI+, PR+ (anti-woke) | LIB-, PC- |
| P20 | **Supply-chain-risk blacklisting** | Bars a lab from federal and contractor business | Anthropic designation (Mar 2026), enjoined [V] | DI+ | LIB--, SA-, courts |
| P21 | **Nationalization / Manhattan-Project merger** | Government control of OpenBrain decisions; forced merger with rivals | S.2938 asks DOE to study "potential nationalization" [V]; AI 2027: raised Feb 2027, then the Oversight Committee [A27] | DI+, PR+ (some), CH+ | AC--, BT--, LIB- |
| P22 | **Companion-chatbot limits for minors / age assurance** | Teen ban or age-gating; costs DAU, cuts kids-incident risk | GUARD Act S.3062 (Judiciary 22-0) [V]; CA SB 243 [G]; CA ballot measure [V]; WH framework age assurance [V] | KS++, PR++, PC+ | LIB-, AC-, BT- |
| P23 | **Training-data copyright licensing / transparency** | Licence fees on training; disclosure of datasets | Bartz $1.5B settlement [V]; EU GPAI copyright policy [V]; US bills stalled [G] | CR++, LB+ | AC--, BT--, SC- |
| P24 | **Data-center moratorium / ratepayer protection** | Pauses new builds, or forces data centers to pay grid costs | Sanders/AOC moratorium bill (Mar 2026) [V]; local moratoria [S]; Schumer priority [V] | RP++, PC++, PS+, LB (split) | BT--, AC--, LB (trades)-- , DI- |
| P25 | **Permitting fast-track / federal sites for data centers** | Faster builds, federal land, transmission | Jul 2025 data-center permitting EO [G]; Action Plan [V/07]; AI 2027 SEZs [A27] | BT++, AC++, LB (trades)+, DI+ | RP--, PC- |
| P26 | **Public compute & science (Genesis / NAIRR)** | Government compute for science; the player can partner | EO 14363 Genesis Mission [V]; NAIRR pilot [G] | SC++, AC+, BT+ | (small) PC- if privatised |
| P27 | **AI layoff disclosure & worker transition** | WARN-style notice; retraining credits; UBI pilots | New Dem "Innovation Agenda" upskilling credits [V]; AFL-CIO model bills [V] | LB++, PC++, PR+ | AC-, BT- |
| P28 | **Superintelligence prohibition / pause** | Hard stop above a capability line; requires verification | FLI Statement (Oct 2025, about 71k signatures) [V/S]; Pope Leo's "disarm AI" [V]; czar Clayton rejects a pause [V] | PS++, SA+ (Maximalist preset), PR+ (Religious preset) | AC--, BT--, CH--, DI-- |
| P29 | **International red lines / treaty / verification** | US-China or multilateral deal; compute monitoring | Global Call for AI Red Lines (target: agreement by end-2026) [V]; UN Panel + Dialogue [V]; AI 2027 Slowdown-ending treaty [A27] | SA++, SC+, PS+ | CH- (unless verifiable), AC- |
| P30 | **Open-weight restrictions** | Bars release of frontier weights above a threshold | Diffusion Rule weight controls (rescinded) [G]; CAISI flags PRC open-weight capability [V] | CH+, SA+ | AC--, SC-, LIB- |
| P31 | **Usage red lines in law (autonomous weapons, mass surveillance)** | Bans specific uses | Anthropic's contractual red lines [V]; Pope Leo calls for a LAWS ban [V] | LIB++, SA+, PC+, PR (relig.)+ | DI-- |

**Design notes for the catalog** [D]:
- **Channels.** Each policy has an enactment channel:
  - EO (fast; reversible on admin change): P3-vol, P4, P11, P17, P19, P20, P25, P26.
  - Statute (slow; needs Congress; often rides the NDAA): P1, P6, P9, P10, P12-P14, P21, P22, P27.
  - State law: P2, P7, P8, P22 (state versions).
  - Court: liability and copyright outcomes.
  - Local: P24.
- **2027 regime shift.** From Jan 2027 the Dem Congress makes statute-channel policies P3, P9, P10, P22, P24 and P27 more likely to pass Congress. Trump's veto makes them likelier to ride the NDAA or bipartisan deals (child safety, whistleblowers, chip security). Executive-channel accelerationist policies continue [V for the political facts; D for the mechanics].
- **Preemption as a trade.** Realistically P1 only passes when bundled with P22 (kids) plus a federal floor of P2/P3. This mirrors the 2026 negotiations [V/S].

---

# PART 4 - MEDIA & INFORMATION ENVIRONMENT (event hooks)

| Hook | Real basis | Game use |
|---|---|---|
| Open letters / statements | CAIS extinction statement (May 2023) [G]; FLI Statement on Superintelligence (22 Oct 2025; about 700-800 signatories at launch, about 71k on the site) [V/S]; Global Call for AI Red Lines (22 Sep 2025, UNGA) [V] | A random "statement wave" event: +Mobilization for SA/PS/PR (religious) |
| Whistleblowers | OpenAI "Right to Warn" letter (Jun 2024) [G]; Kokotajlo gave up equity rather than sign a non-disparagement agreement [V]; a reported 2026 firing of a safety executive over child-safety objections [S] | Leak probability per tick ∝ (safety-culture deficit) × (P9 enacted ? 1.5 : 1). AI 2027's Oct 2027 memo leak is the template [A27] |
| Lab-vs-critic lawfare | OpenAI subpoenas to Encode and others (2025) [V] | The player's "Fight" action. The backlash raises target Mobilization |
| Religious authority | *Magnifica Humanitas* (25 May 2026) [V] | A one-time event: PR (religious) and SA +Clout; Public "concern" + |
| Violence & security | Molotov attack and shooting at Altman's home (Apr 2026) [V] | Negative for PS/SA; raises lab security costs; sympathy for the targeted lab |
| Election money stories | LTF vs Public First; $79M across 68 races [S]; NY-12 ($40M+ outside money) [S] | Exposure of player PAC donations: -Approval from PC/PR/SA; +AC |
| Polls | Pew (Feb 2026): 16% expect a positive and 40% a negative societal impact over 20 years [S]; Gallup/Bentley: about 4 in 10 say AI does more harm than good [S]; see 07 §2.1 | Feeds the 07 Public meters |
| Influential media / voices [G] | Tech: The Information, Platformer, Hard Fork (NYT), Axios AI+, Semafor, Politico Morning Tech, Transformer, Zvi Mowshowitz, Dwarkesh Patel, Lex Fridman, All-In (accelerationist), Bannon's War Room (populist), Tucker Carlson / Joe Rogan (crossover reach) | Model as "media channels" that blocs buy into. Each channel has an ideological lean and reach |

---

# PART 5 - SOURCES

**Executive branch, agencies**
- EO 14409 "Promoting Advanced AI Innovation and Security" (2 Jun 2026): https://www.whitehouse.gov/presidential-actions/2026/06/promoting-advanced-artificial-intelligence-innovation-and-security/
- Wiley on EO 14409: https://www.wiley.law/alert-New-AI-Executive-Order-Addresses-Frontier-Models-and-Cybersecurity-Vulnerabilities
- Lawfare, "'Voluntary' Until the Government Is Your Customer": https://www.lawfaremedia.org/article/voluntary--until-the-government-is-your-customer
- CAISI told to halt public reports (secondary): https://aiweekly.co/alerts/white-house-tells-caisi-to-halt-public-ai-model-reports
- CSIS on EO 14409: https://www.csis.org/analysis/new-light-touch-trump-ai-cyber-executive-order-reveals-accelerationists-still-rule-roost
- IAPS reaction: https://www.iaps.ai/research/iaps-reacts-to-the-white-house-executive-order-on-ai-innovation-and-security
- CAISI DeepSeek V4 evaluation: https://www.nist.gov/news-events/news/2026/05/caisi-evaluation-deepseek-v4-pro
- CAISI GLM-5.2 assessment: https://www.nist.gov/document/caisi-assessment-zais-glm-52
- CAISI testing agreements (HPCwire): https://www.hpcwire.com/off-the-wire/nists-caisi-announces-new-frontier-ai-testing-agreements-with-google-deepmind-microsoft-xai/
- Genesis Mission EO 14363 (Federal Register): https://www.govinfo.gov/content/pkg/FR-2025-11-28/html/2025-21665.htm
- MoFo on Genesis: https://www.mofo.com/resources/insights/251211-executive-order-establishes-genesis-mission
- DOJ AI Litigation Task Force memo: https://www.justice.gov/ag/media/1422986/dl
- Paul Hastings on EO 14365: https://www.paulhastings.com/thought-leadership/president-trump-signs-executive-order-challenging-state-ai-laws
- National AI Legislative Framework (Wiley): https://wiley.law/alert-White-House-Releases-National-Legislative-Policy-Framework-for-AI
- Morgan Lewis on the framework: https://www.morganlewis.com/pubs/2026/03/white-house-ai-framework-puts-federal-preemption-at-the-center-of-the-debate
- Daily Signal, framework and kids: https://www.dailysignal.com/2026/03/20/exclusive-white-house-ai-framework-requires-measures-protect-kids-child-safety-advocates-want-more/
- Trump voluntary accord (AP via ADN): https://www.adn.com/nation-world/2026/09/29/trump-says-leading-tech-firms-have-signed-an-accord-to-self-police-ai-development/
- Clayton named AI czar / Super Intelligence Force (NPR via KPBS): https://www.kpbs.org/news/politics/2026/10/04/trump-names-national-intelligence-chief-jay-clayton-as-new-ai-czar
- Sacks steps down (TechCrunch): https://techcrunch.com/2026/03/26/david-sacks-is-done-as-ai-czar-heres-what-hes-doing-instead/
- Axios, White House AI power center: https://axios.com/2026/06/18/inside-white-house-ai-power-center
- FTC 6(b) companion chatbots (DLA Piper): https://www.dlapiper.com/en-ca/insights/publications/2025/09/ftc-ai-chatbots
- BIS H200 case-by-case (secondary): https://introl.com/blog/bis-h200-mi325x-export-policy-china-case-by-case-review-2026
- DPA reauthorization (CRS): https://www.everycrsreport.com/reports/IN12484.html
- Lawfare on DPA and Anthropic: https://www.lawfaremedia.org/article/what-the-defense-production-act-can-and-cant-do-to-anthropic

**Pentagon-Anthropic dispute**
- Axios, blacklisting: https://www.axios.com/2026/03/04/anthropic-pentagon-supply-chain-risk-claude
- NPR, injunction: https://www.npr.org/2026/03/26/nx-s1-5762971/judge-temporarily-blocks-trump-administrations-anthropic-ban
- CBS, ruling: https://www.cbsnews.com/news/anthropic-ruling-judge-trump-pentagon-ai
- Washington Examiner, DoW maintains designation: https://www.washingtonexaminer.com/?p=4711931

**Congress**
- AI Risk Evaluation Act analysis (MIRI TechGov): https://techgov.intelligence.org/blog/the-hawley-blumenthal-ai-risk-evaluation-act
- Cato critique of the AI Risk Evaluation Act: https://www.cato.org/blog/hawley-blumenthals-ai-bill-brazen-executive-power-grab-puts-national-security-risk
- AI LEAD Act S.2937 text: https://www.congress.gov/119/bills/s2937/BILLS-119s2937is.htm
- Hawley press release on AI LEAD: https://www.hawley.senate.gov/hawley-durbin-introduce-legislation-empowering-americans-to-bring-liability-claims-against-ai-companies
- GUARD Act committee vote (Roll Call): https://rollcall.com/2026/04/30/ban-on-kids-companion-chatbots-advanced-by-senate-committee/
- GUARD Act (Covington): https://www.globalpolicywatch.com/2026/05/senate-judiciary-committee-advances-guard-act-regulating-minor-use-of-ai/
- AI Whistleblower Protection Act (Deseret): https://www.deseret.com/politics/2026/09/25/john-curtis-back-bill-protecting-ai-whistleblower
- AI Whistleblower Protection Act (Tech Policy Press): https://www.techpolicy.press/congress-can-get-ai-whistleblower-protection-right-on-its-first-try
- Preemption fight (Tech Policy Press): https://techpolicy.press/trump-and-gop-lawmakers-push-for-new-national-ai-legislation
- Preemption fight (WLF): https://www.wlf.org/2026/06/22/wlf-legal-pulse/compromise-necessary-but-not-sufficient-for-ai-preemption/
- Preemption fight (CASRAI): https://casrai.org/news/federal-ai-moratorium-state-preemption-fight-2026
- Roll Call on the national standard: https://rollcall.com/2026/03/03/what-to-watch-from-trumps-national-ai-standard/
- FDD NDAA export-control coalition letter: https://www.fddaction.org/press-release/2026/06/17/national-security-experts-urge-congress-to-include-ai-export-control-provisions-in-fy2027-ndaa/
- Banks, AI OVERWATCH in the NDAA: https://www.banks.senate.gov/?p=11620
- NDAA chip provisions excluded (secondary): https://cryptobriefing.com/nvidia-chip-restrictions-unlikely-final-ndaa/
- Chip Security Act tracker: https://www.longtermwiki.com/legislation/chip-security-act
- Data-center moratorium bill (Roll Call): https://rollcall.com/2026/03/25/data-center-moratorium-pitched-as-counter-to-ai-impacts/
- Democrats plan AI bills: https://thestar.com.my/tech/tech-news/2026/11/06/democrats-planning-flood-of-ai-bills-when-they-take-control-of-congress
- Axios, Democrats' AI division: https://www.axios.com/2026/01/08/democrats-jeffries-ai-trump
- 2026 midterms, Dems win both chambers (NPR via OPB): https://www.opb.org/article/2026/11/04/2026-midterms-democrats-win-the-senate/

**States**
- NY RAISE amendments (Cooley): https://www.cooley.com/news/insight/2026/2026-03-31-new-yorks-frontier-ai-law-gets-a-california-makeover-with-some-key-differences
- NY RAISE (JD Supra): https://www.jdsupra.com/legalnews/new-york-finalizes-raise-act-for-8270433/
- Illinois frontier AI law (DWT): https://dwt.com/blogs/artificial-intelligence-law-advisor/2026/07/illinois-frontier-ai-safety-law
- Florida AI Bill of Rights (Florida Phoenix): https://floridaphoenix.com/2026/04/20/floridas-ai-bill-of-rights-what-happened-whats-in-it-and-whats-next/
- White House vs DeSantis bill (Daily Signal): https://www.dailysignal.com/2026/02/23/scoop-white-house-working-against-florida-attempt-to-limit-ai-for-minors-seeking-federal-solution/
- CA kids ballot measure (CalMatters): https://calmatters.org/economy/technology/2026/01/california-chatbot-initiatives-merged/
- CA kids ballot measure (Common Sense): https://commonsensemedia.org/press-releases/common-sense-media-openai-join-forces-on-strongest-youth-ai-safety-measure-in-us
- CDT state AI legislation tracker: https://cdt.org/insights/2026-state-and-federal-ai-legislation-updates/

**Money and elections**
- Axios, LTF cash: https://axios.com/2026/07/17/pro-ai-super-pac-ready-midterms
- Axios, Public First raised $80M: https://axios.com/2026/06/30/ai-safeguards-public-first-action-raised-80-million
- Axios, Anthropic $20M: https://www.axios.com/2026/02/12/anthropic-millions-ai-policy-fight
- Bloomberg Law, Amodei and employees: https://news.bloomberglaw.com/tech-and-telecom-law/dario-amodei-anthropic-employees-give-millions-to-regulate-ai
- Fortune, midterm results: https://fortune.com/2026/11/04/candidates-backed-by-ai-super-pacs-result/
- TNW, midterm results: https://thenextweb.com/news/ai-super-pacs-midterms-results-leading-the-future
- The Intercept, super-PAC spending: https://theintercept.com/2026/10/29/midterms-election-money-ai-super-pac/
- Gizmodo, Bores loses: https://gizmodo.com/ai-super-pacs-first-major-target-loses-new-york-congressional-primary-2000788771
- Meta super PACs (TechCrunch): https://techcrunch.com/2025/09/23/Meta*-launches-super-pac-to-fight-ai-regulation-as-state-policies-mount
- Meta $65M push (GV Wire): https://gvwire.com/2026/02/18/meta-begins-65-million-election-push-to-advance-ai-agenda/
- Meta pulls back $25M: https://aiweekly.co/alerts/meta-pulls-back-25m-of-its-65m-midterm-super-pac-war-chest
- Lobbying, Meta tops 2025 (Axios): https://www.axios.com/2026/01/21/meta-big-tech-lobbying-spending-q4
- Lobbying, labs' Q2 2026 records (Quartz): https://qz.com/openai-anthropic-lobbying-records-q2-2026-072126
- Lobbying (Issue One): https://issueone.org/articles/armies-of-lobbyists-helped-big-tech-rack-up-victories-during-first-year-of-trumps-second-term/
- Public Citizen, "Robo-Trump": https://www.citizen.org/article/robo-trump-big-tech-big-spending-and-republican-effort-delete-state-ai-laws/
- Coefficient Giving rename: https://coefficientgiving.org/research/open-philanthropy-is-now-coefficient-giving/
- Coefficient Giving CEO letter: https://coefficientgiving.org/wp-content/uploads/2025-Letter-from-the-CEO.pdf
- Humanity AI $500M (MacArthur): https://www.macfound.org/press/press-releases/humanity-ai-commits-500-million-to-build-a-people-centered-future-for-ai

**Civil society, movements, labor, religion, copyright**
- FLI Superintelligence Statement press release: https://futureoflife.org/press-release/prominent-scientists-faith-leaders-policymakers-and-artists-call-for-a-prohibition-on-superintelligence/
- Superintelligence Statement site: https://superintelligence-statement.org/
- Global Call for AI Red Lines: https://red-lines.ai/
- Semafor on the red-lines call: https://www.semafor.com/article/09/24/2025/world-leaders-demand-consensus-on-ai-safety-in-open-letter
- Fortune on PauseAI/StopAI: https://fortune.com/2026/04/15/pause-ai-and-stop-ai-meet-the-anti-ai-groups-facing-questions-after-the-attack-on-sam-altman/
- SF march (Decrypt): https://decrypt.co/362129/protesters-rally-openai-anthropic-xai-offices
- Altman home attacks (ABC7): https://abc7news.com/post/san-francisco-home-openai-ceo-sam-altman-struck-gunfire-days-molotov-cocktail-attack-police/18878800/
- OpenAI subpoenas to Encode (Fortune): https://fortune.com/2025/10/10/a-3-person-policy-non-profit-that-worked-on-californias-ai-safety-law-is-publicly-accusing-openai-of-intimidation-tactics/
- Axios, unions split: https://axios.com/2026/10/31/unions-ai-big-labor-data-centers
- Tech Policy Press, how unions are positioning on AI: https://techpolicy.press/how-major-labor-unions-are-positioning-on-ai
- Axios, unions prepare for 2028: https://www.axios.com/2026/06/14/unions-ai-2028-elections
- Axios, Microsoft and building trades: https://axios.com/2026/04/21/microsoft-construction-unions-partner-ai-boom
- Pope Leo encyclical (USCCB): https://www.usccb.org/news/2026/first-encyclical-pope-leo-urges-world-disarm-ai-amid-increased-reliance
- Pope Leo encyclical (PBS/AP): https://www.pbs.org/newshour/amp/world/pope-calls-for-robust-regulation-of-ai-in-manifesto-that-ponders-the-future-of-humanity
- Daily Signal, conservative AI fight: https://www.dailysignal.com/2026/01/19/inside-the-most-controversial-issue-in-trump-administration-ai-policy/
- Heritage backgrounder: https://www.heritage.org/sites/default/files/2026-06/BG3966.pdf
- Bartz settlement final approval (Bloomberg Law): https://news.bloomberglaw.com/ip-law/anthropic-authors-1-5-billion-deal-receives-final-approval
- Bartz settlement (TNW): https://thenextweb.com/news/anthropic-1-5-billion-copyright-settlement-approved
- Data-center backlash (News From The States): https://www.newsfromthestates.com/article/more-cities-are-pressing-pause-data-centers-local-backlash-grows
- Data-center backlash (Resilience): https://www.resilience.org/stories/2026-06-22/how-local-communities-are-challenging-big-tech-data-centerss-noise-pollution-and-rising-electricity-bills/
- Polls (secondary): https://thenextweb.com/news/pew-research-americans-ai-chatbot-skepticism-regulation-distrust-2026
- Polls (Chicago Council): https://globalaffairs.org/research/public-opinion-survey/americans-say-ai-benefits-are-not-worth-risks

**International**
- EU Digital Omnibus (Gibson Dunn): https://www.gibsondunn.com/eu-ai-act-omnibus-agreement
- EU Digital Omnibus (Hogan Lovells): https://www.hoganlovells.com/en/publications/eu-legislators-agree-to-delay-for-highrisk-ai-rules
- UN Scientific Panel FAQ: https://www.un.org/independent-international-scientific-panel-ai/en/faq
- UN Global Dialogue FAQ: https://www.un.org/global-dialogue-ai-governance/en/faq
- ITU on the Global Dialogue: https://www.itu.int/en/mediacentre/Pages/PR-2026-07-06-Global-Dialogue.aspx
- UK AISI (OECD.AI): https://oecd.ai/en/dashboards/policy-initiatives/ai-security-institute-formerly-ai-safety-institute,-aisi
- Network rename (secondary): https://casrai.org/wp/tag/international-network-of-ai-safety-institutes/

**Known gaps / verify before quoting**
- The final FY2027 NDAA AI text (GAIN AI, AI OVERWATCH, Chip Security, whistleblower) was not settled in sources.
- DPA authority after 30 Sep 2026 is unclear.
- Whether the CA kids ballot measure qualified was not found.
- No 2025 full-year OpenAI/Anthropic lobbying totals were found in primary LDA filings.
- The SC Senate race details come from Fortune/TNW only.
- The Public First $63M / "10 of 17" figure is a self-reported claim.
- Think-tank stances marked [G] are general characterisations, not re-sourced.
