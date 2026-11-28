# Plans A/B/C/D for AI risk, mapped onto the outside-world spec (W13, research)

Status: 2026-11-27, branch `w-w13`. Designer's brief: "AI futures plan A B and so on ... should be an inspiration (we should
have enough in the game to be able to implement those plans in theory if things work out)". Spec mapped against:
[OUTSIDE-WORLD.md](OUTSIDE-WORLD.md) (draft 1).

## 1. Sources

Two different "Plan A/B/C/D" families exist. They share letters, not content. Do not conflate them.

| # | Title | Author(s) | Date | URL | Read? |
|---|---|---|---|---|---|
| S1 | Plans A, B, C, and D for misalignment risk | Ryan Greenblatt (Redwood Research) | 8 Oct 2025 (LessWrong / Alignment Forum) | https://www.lesswrong.com/posts/E8n93nnEaFeXTbHn5/plans-a-b-c-and-d-for-misalignment-risk | Via the fetch tool's extraction of the page, not the raw page. Figures below are as extracted. |
| S2 | AI 2040: Plan A (scenario + policy roadmap) | AI Futures Project: Daniel Kokotajlo, Eli Lifland, Thomas Larsen, romeo, Brendan Halstead, Ryan Greenblatt | 9 Jul 2026 | https://www.ai-2040.com/ (LW linkpost: https://www.lesswrong.com/posts/pFzctpJBat95SrCyC/ai-2040-plan-a) | Main page read (truncated by the fetcher). |
| S3 | Comparing Possible Plans (supplement to S2): Plans A, B, C+, C, D, S | AI Futures Project (figures are Eli Lifland's medians) | 2026 | https://www.ai-2040.com/supplements/comparing-possible-plans | Read |
| S4 | Capability Scaling Strategy (supplement) | AI Futures Project | 2026 | https://www.ai-2040.com/supplements/capability-scaling-strategy | Read |
| S5 | Verification Plan (supplement) | AI Futures Project | 2026 | https://www.ai-2040.com/supplements/verification-plan | First 100k of 121k chars read |
| S6 | Plan A: Assumptions and Preconditions (supplement) | AI Futures Project | 2026 | https://www.ai-2040.com/supplements/plan-a-assumptions | Read |
| S7 | A short summary of AI 2040: Plan A | Harjas (third party; used only as a cross-check of S2) | 13 Jul 2026 | https://www.lesswrong.com/posts/mWp3KBRpYagWMrGqa/a-short-summary-of-ai-2040-plan-a | Read, secondary |

Not read (listed on ai-2040.com, not fetched in this pass): supplements/transparency-plan, alignment-roadmap, deal-decline,
covert-ai-projects, security-in-plan-a, faq. The "Incremental AI Policy Wishlist" is known only as quoted on the S2 main page. Scott
Alexander's "Introducing Plan A" is commentary and was not used. The fetch tool summarises pages with a small model, so the
quotes below are as returned by it and should be re-checked against the pages before being quoted in-game.

How the families relate. S3 is the AI Futures Project's own table. It reuses Greenblatt's C and D letters (leading project burns
lead / race) and adds Plan A (verified international slowdown), Plan B (US sabotages China to buy lead; kinetic or cyber
variants), Plan C+ (US domestic regulation) and Plan S (indefinite halt). Greenblatt co-authors S2/S3, so the two are aligned in
spirit but the labels for A and B differ. In S1, B means "US government buys 1-3 years". In S3, B means "sabotage China".

## 2. The plans

Numbers are the sources' own medians or guesses. Both sources condition on AI that beats top experts well before 2035-2040.

### 2.1 S1 (Greenblatt): plans ordered by how much political will exists

| | Who acts | What they do | Precondition | Lead time spent on safety | Safety compute |
|---|---|---|---|---|---|
| **A** | Most countries, at least the US and China | Strong international agreement removes race dynamics. Slow once AI can fully automate AI-company engineering, then pause. High-assurance "moonshots". Keep capabilities below the maximum controllable level, then hand off to barely-superhuman AIs. | "enough will for some sort of strong international agreement that mostly eliminates race dynamics" | about 10 years | not given |
| **B** | US government plus domestic industry | Buys lead time for US companies. Prosaic empirical safety, control until handoff. The company uses AI labour to build political will and helps with non-proliferation. Can escalate to A. | "The US government agrees that buying lead time for US AI companies is among the top few national security priorities" | 1-3 years | not given |
| **C** | The leading company (or a few) | Hands off to AIs quickly, "somewhat janky" control meanwhile, keeps working to build political will. | "The leading AI company has a 2-9 month lead" and is functional enough to spend it. Government buy-in is not enough for serious involvement. | 1-9 months, probably the low end | not given |
| **D** | 10-30 safety-minded staff inside a leading company that does not take the risk seriously | Extract non-sabotaged safety research, gather strong evidence of risk, build an AI plausibly safe to hand off to. Organisation-level control mostly given up. Responsible trailing companies export safety work. | The company is not serious and takeoff is not exogenously slowed. The team has enough buy-in for about 3% compute. | about 0 months, but 10+ people doing useful work | about 3% |
| **E** | Effectively nobody | Not a technical plan: "approximately no one to implement the plan". Work on raising political will. | Few worry, few have access | none | none |

Greenblatt's rough odds (as extracted): A 5%, B 10%, C 25%, D 45%, E 15%. Takeover risk given each: 7, 13, 20, 45, 75%. His stated focus
is helping C and D. The risk figures assume competent execution.

### 2.2 S2/S3 (AI Futures Project): "AI 2040: Plan A" and its comparison set

S2 says it is "a recommendation, not a prediction", "what we think should happen". The authors expect the real response to look "more like
the response in 2027" (S6). The goal is delaying superintelligence from about 2030 to 2040 via "a verified international slowdown deal coupled with
complete transparency of AI research" (S3).

**Plan A (verified slowdown + total research transparency).**
- Actors: US and China (the deal), about 17 major economies and supply-chain countries (accession Apr-May 2029), the frontier
  labs (OpenAI, Anthropic, xAI, Google DeepMind named), an international "Consortium" that steers development, intelligence agencies
  (chip tracking).
- Staged timeline (S2/S5):
  - 2026-28 prepare optionality: chip tracking from 2026, inference-only verification R&D funded 2027, tracking mature 2028.
    Incremental wishlist: limit the internal/external deployment gap, public reporting of model specs and internal usage, enforce
    export controls (about a third of Chinese compute is smuggled), cap the share of compute spent on AI R&D, stop recycling chips,
    build government AI talent.
  - 2029 deal: mutual chip declaration (Jan), inference-only retrofits (from Feb), third countries join, R&D clusters under
    "Total Research Transparency" with SL5 security, cold-storage banks of chips.
  - 2030 full AI-R&D automation is avoided. 2030-35 scale in the human range with training compute, not algorithms ("rather than
    software progress", because software leaks to covert projects).
  - 2035 pause near top-human-expert level, to keep control. 2040 handoff to AIs once confidence alignment is solved is very high
    (e.g. 99.5%).
  - Along the way: cap-and-trade on chips and robots (2032), Citizen's Dividend for unemployment (S7), mutually assured compute
    destruction.
- Preconditions (S6): coordinated will; "optimistic about US government actions" and "high state capacity on AI";
  nation-state-proof security "basically required"; verification feasible in a short research sprint; an early deal matters most;
  with short timelines "there isn't time to do the preparation phase". China is "probably the best placed actor to run a covert project"
  and deal dissolution risk "will probably be high".
- Cost (S3): about 6 years of takeoff, 2.8 orders of magnitude (OOM) safety tax on training compute, 100B H100e-years of safety compute,
  1M safety-researcher-years. S4 sets the tax at 1 OOM above the minimum, paid at the end of stage 1.
- Failure modes: deal declined, covert projects (about 13% chance a competent covert project reaches deal-undermining AI before
  detection), deal collapse.

**Plan B (sabotage China and burn some lead).** US only. "Sabotaging China in order to get more of a lead to burn on safety." Kinetic
variant (strikes) or cyber and supply-chain variant. Needs the US to intend to spend the lead on safety, and takeoff slowed at least 3 months.
About 3 years (kinetic) or 2 years (cyber) of lead. Safety tax 1 / 0.75 OOM. Risks: wartime epistemics, likely nationalisation, power concentration.

**Plan C+ (domestic regulation, slow China without sabotage).** US government regulates domestically, slows China via export controls and
green cards for Chinese talent. At least 2 months slowdown. About 1.5 years. 0.46 OOM tax, 20M H100e-years.

**Plan C (leading project burns some lead).** The leading project, possibly coordinating with other frontier projects, no regulation.
At least 1 month slowdown, about 1.13 years, 0.13 OOM tax, 4M H100e-years, 500 safety-researcher-years.

**Plan D (race).** Frontier projects race through the intelligence explosion at nearly max speed with at least 1% of resources on safety.
About 1.02 years, 0.02 OOM tax. Median p(alignment) about 25%.

**Plan S (indefinite halt).** A halt on all frontier capabilities progress for at least a few years. Resumption keyed to alignment
progress, lie detectors, uploads or enhancement. Not quantified.

Other variants named in S3: domestic-first Plan A (regulate at home, then deal), GPU arms control (cap GPU stock/flow), CERN for AI (one
international project, others regulated behind it). Judged "clearly worse": repurposing GPUs, "D-war" (Plan B without slowing), weak
deals, Plan E (under 1% safety spend).

### 2.3 Common structure for the game

Every plan is the same few moves at different scales. The unit is **lead (months) converted to safety work**:

| Who decides | Spends | Source of the lead |
|---|---|---|
| The lab alone (C, D) | a slice of its own lead, a share of its compute | its own position over rivals and China |
| The US government (S1-B, S3-C+, S3-B) | national lead over China | export controls, security, (sabotage) |
| US + China (+ others) (A) | the whole world's pace | verification of compute plus a deal |

The slowdown is bought by a pause or cap on training, enforced by knowing where the compute is.

## 3. Mapping onto OUTSIDE-WORLD.md

Legend: **Y** = in the spec, **P** = partly, **M** = missing. "§" points into OUTSIDE-WORLD.md.

| Plan | Needed element | In spec? | Where / missing -> smallest addition |
|---|---|---|---|
| **S1-D / S3-D** (race, small safety team) | Safety compute share the lab controls | Y (outside this spec) | Training/safety allocation in the Lab (R&D redesign). Not an outside-world matter. |
| | Evidence of risk reaching decision-makers | Y | "The leak" and "First finding" (§8.2), disclosure lever (§8.1), concern from incidents (§3.3, §5). |
| | Trailing responsible labs exporting safety work | M | Not needed for the player's lab. Skip. |
| **S1-C / S3-C** (leader burns lead) | The lab's lead over rivals as a readable number | P | The lag clock exists for US vs China (§3.1). Add a **lead over the nearest rival** readout from the public frontier. No new state. |
| | Spend lead on safety by choice (slow a release, raise safety share) | Y | Existing lab levers. The world only needs not to punish it: lost market share is the game's own cost. |
| | Coordination with other frontier labs | M | The voluntary accord was cut (§8.1). Smallest: one **joint pause pledge** in the commitments panel, honoured only if the rival NPC labs' public view agrees. |
| **S1-B / S3-C+** (US government buys time) | Government treats lead as priority | Y | Security stage 1-4 (§6.1); China tension 1+. |
| | Domestic regulation that slows frontier | P | Frontier licensing (§6.3) only adds friction on deploys, not a training cap. **Add one effect to the licensing row**: above a second concern threshold it caps the share of compute a lab may spend on AI R&D (S2 wishlist). |
| | Export controls, smuggling | Y | Export controls 0-2 (§6.3); theft rules (§7.2). Leave. |
| | Green cards for Chinese talent | M | Skip (labour market). |
| | Government-funded verification R&D / chip tracking | M | **One extra US state value: verification readiness (0-3)**, advanced by the government at stage 2+ and by the player's briefing and pledges. Gates the verified treaty (below). |
| **S3-B** (sabotage China) | Cyber/kinetic action against China's AI | M | China tension 3-4 and war footing (§7.1) cover the consequence, the action is missing. Smallest: one **stage-3+ event "Offensive options"** (cyber operation / decline), default decline. Effect: China lab compute set back, tension +1, talks reset. |
| | Nationalisation as side effect | Y | Stage 4 hard path (§6.1). |
| **S1-A / S3-A** (verified international slowdown) | US-China talks, restraint, verified treaty | Y | Talks 0-3 (§7.1), Treaty event (§8.2), treaty ending (§10), verified-treaty clock slowdown (§7.2). |
| | Verification as a precondition | M | Spec lets talks reach 3 without it. **Make verification readiness a condition for talks 2 -> 3.** Without it a signed treaty is unverified and talks decay. |
| | Pause applied to the player's lab | P | §7.2 slows the NPC clock only. **One rule: at talks 3 the player's AI R&D compute share is capped (same cap as the licensing row), lifted when the safety sphere reports confirmed alignment.** |
| | Total research transparency | P | Briefing, disclosure, pre-deploy testing (§8.1) are the lab-side analogue. Make them trust inputs to the treaty. Nothing new. |
| | Unemployment relief (Citizen's Dividend) | Y | Relief -> transfers -> UBI (§6.3). |
| | Handoff ("safe to hand to AIs") | M | No handoff criterion. Reuse the safety sphere's confirmed-alignment readout as the cap's lift condition. No new ending. |
| | Early deal beats late deal | P | Implicit: a large US lead raises tension and closes talks (§7.1). No change. |
| | Covert projects, deal decline | P | Theft and the China NPC lab (§7.2). Deal decline = talks stalling at 1-2 while tension is above 2. No new state. |
| **S3-S** (indefinite halt) | Halt | P | A treaty cap with no lift condition. No extra. |
| **S1-E** | Nobody acts | Y | The default quiet-world path. |

## 4. Summary of minimal additions

The spec already carries most of what the plans need: the security stage ladder (S1-B, C+), export controls (C+), the lab's own
choices (C, D), tension and talks, the treaty event and ending, UBI. Plans become implementable in theory with **four small additions**,
none a new system:

1. **Verification readiness** (one US-side value, 0-3). Advances with the stage ladder at stage 2+, faster with full briefing and
   pre-deploy testing. The missing precondition for talks 2 -> 3. (Plan A, S.)
2. **A compute-for-AI-R&D cap**, as an effect on two existing rows: frontier licensing (second concern threshold) and the verified treaty
   (talks 3). Applies to the player. Lifts when the safety sphere reports confirmed alignment, which is the "handoff". (A, C+, S.)
3. **Lead over the nearest rival** as a readout from the public frontier, plus an optional **joint pause pledge** replacing the cut
   voluntary accord, honoured only if rival NPC labs' public view agrees. (C.)
4. **Offensive options event at stage 3+** (cyber action against China's AI: accept/decline, default decline). (S3-B.)

Everything else (Plan D's internal team and compute share, evidence reaching the government by leak and disclosure) is lab-internal or
already present.

Open for the designer: whether sabotage (item 4) should exist at all. It is the only addition where the US government does something
hostile rather than regulatory. Dropping it still covers S1's A-E and S3's A, C+, C, D, S.

## 5. Check after the build (W14, lead, 2026-11-28)

What the built world supports, plan by plan, against the decisions (designer accepted: the treaty compute cap, and the
verification precondition folded into a condition; dropped: the joint pause pledge; parked: offensive options):

| Plan | Can it happen in this world? | How |
|---|---|---|
| Greenblatt A / AI Futures A: verified international slowdown | **Yes** | China talks → restraint → verified (chinagov). Verification needs concern ≥ 70, the player's pre-deploy-testing pledge (when the player is a frontier lab) and the leading NPC lab's external access. The treaty caps every lab's AI R&D compute at its signing-day level and slows the NPC clock ×0.65. The treaty power outcome follows. The player can back or oppose it (E23). |
| Greenblatt B / AI Futures C+: the US government buys time | **Yes** | Security stages 1–4 (usgov), strict export controls (stage ≥ 2 or a recent Chinese theft), licensing friction at high concern, the HITL mandate, consolidation (DPA pools half the other US labs' compute into the leader), oversight review of top-level deploys. |
| Greenblatt C / AI Futures C: the leader spends its lead | **Yes** | The lab's own levers (safety share, slower releases). The lead is readable (leadDays). Nothing in the world punishes it except lost market share. |
| Greenblatt D / AI Futures D: race, a small safety team | **Yes** | The default lab play; the safety sphere. |
| Greenblatt E: nobody acts | **Yes** | The quiet path: concern and laws react, nobody coordinates. |
| AI Futures B: the US sabotages China | **No** (parked) | The consequence exists (China tension, war footing); the action does not. Parked by the designer's refocus; on design/OPEN.md. |
| AI Futures S: indefinite halt | **Partly** | A verified treaty holds compute flat with no end date. That is a freeze, not a rollback, and the lab cannot propose it. |
| Plan A's handoff ("safe to hand over to AIs") | **No** | There is no lift condition on the treaty cap. Left for the post-ASI stages (vision/MEDIUM.md §4). |
