# Medium-term plan

This is the build target, set by the designer on 2026-11-24. The analysis behind it is in README.md, ACTORS.md, BALANCE.md, TIME.md and WORLDS.md in this folder.

## 1. Scope (decided)

- **Who you play:** only US labs, and you choose the kind of lab. China, the government and the model are NPCs only.
- **Names:** all invented. No real names, no parodies (Anthropos, Gemini Labs, xLab, Sonnetta, Grokk) and no AI 2027 names (OpenBrain, DeepCent, Agent-N). Real analogues may appear in tooltips ("like OpenAI in 2023").
- **One lab model:** every US lab, player or NPC, has the same structure. Kinds differ only in their parameters. There is no special "leader lab".
- **Start dates:** 2023 is the main start. Jul 2025 stays as a second option.
- **After ASI:** the world continues into the first stages after ASI. Physical AI is still weak there, and compute and chips still matter. There is just enough to feel what the world is becoming: a treaty world or a corporate-controlled one, UBI or not. How long this lasts depends on the situation, not on a fixed span.
- **Cleanup:** fix the NPCs, balance and setup, but don't turn the NPCs into full-fledged actors.

**Out of scope:**
- Playing as China, the government or the model.
- Starts before 2023.
- A full post-ASI simulation.

## 2. One lab model

> **Reverted 2026-11-27 (designer).** The player is fully simulated; every NPC lab (US rivals, the leader, China's lab)
> is a generated headline lab. The new design is in [NPC-LABS.md](../npc/NPC-LABS.md). The kinds table below survives as
> personalities there; "NPC follows its kind's strategy through its policy" and "leader carries the reference race
> through a policy" are superseded.

### What exists today (to be merged)

These are parallel lists that all describe kinds of lab:

| Where | What it holds |
|---|---|
| `data/v2/starts.ts` STARTS | The 4 player starts: state, board and modifiers |
| `data/actors.ts` LAB_ARCHETYPES | The 5 rival types plus the leader |
| `data/v2/postures.ts` | 9 safety-stance values per type |
| `actors/rivals.ts` | Base cadence and release lag per type |
| `finance/rivalFinance.ts` | Which types are funded by a parent |
| `data/v2/names.ts` | Name lists |
| `setup.leaderLab` | Special rules for the leader lab: reference compute for free, can't go broke, safety capped, starts level with the player |

### The proposal: one table of lab kinds

Each kind is one row with the same fields. The analogues below are 2023 analogues, for tooltips only.

| Kind (working name) | Analogue | Goal | Market focus | Safety | Openness | Funding and board | Compute |
|---|---|---|---|---|---|---|---|
| Frontier leader | OpenAI | Frontier | Consumer + API | Racing | Closed | Capped-profit nonprofit | Hyperscaler partner |
| Safety-first frontier | Anthropic | Frontier | Enterprise, coding | High | Closed | PBC + trust | Two hyperscaler partners |
| Big-tech frontier division | Google DeepMind | Frontier | Distribution through the parent's products | Medium | Closed | Parent | Own chips |
| Open-weights platform | Meta | Fast follower | Consumer platform | Low | Open weights | Parent | Huge, own |
| Founder racer | xAI | Frontier, fast build-out | Consumer and social | Low | Partly open | Founder control | Builds its own fast |
| Product integrator | Microsoft AI | Specialist: enterprise products, licenses a partner's models | Enterprise | Medium | Closed | Parent | Hyperscaler (owns it) |

**Fields** (a first cut, judgement):
- **Goal:** frontier, fast follower or specialist.
- **Market and sector weights:** consumer, API, enterprise, and particular sectors.
- **Distribution advantage:** an existing user base.
- **Safety stance:** the existing 9-value posture.
- **Openness.**
- **Funding and board:** the existing governance presets, or a parent.
- **Compute route:** owns chips, uses a hyperscaler partner, or rents cloud.
- **Capex appetite.**
- **Talent pull and poaching.**
- **Release lag and base cadence.**
- **How it reacts to falling behind.**

**Player and NPC use the same row in different ways:**
- **An NPC lab** follows its kind's strategy through its policy.
- **For the player,** the row sets the start state, the board or parent, partners and distribution. The player makes the strategy choices. The kind's *goals* reach the player through whoever they answer to: the board, the parent's yearly goals, partners' terms. This fits "finance is contained" (judgement; see Q2).

**The cast is fixed:** one lab per kind plus China. The player takes one lab's place, and that lab's NPC version leaves. This replaces the "rival count" and "rivals preset" settings.

**"Leader" is simply whoever is ahead.** Calibration follows the role: whichever lab holds the frontier-leader position, NPC or player, carries the reference race, played by a sourced reference policy (BALANCE.md §4).

## 3. The 2023 start

- **What is mostly data:** dated start tables for both starts. The code mostly reads `s.time.startDate`; TIME.md §1 lists the anchors that still point at 2025. These cover lab state, compute, compute splits, headcounts, finance, China, the government, the public and the economy sectors. All must come from primary sources, such as Epoch AI datasets, lab filings and official statements; all to verify.
- **What needs real work:**
  - **Capability scale:** it bottoms out near GPT-4 (capability.ts:44). Extend it below 0, or re-base it so 2023 models read correctly.
  - **The three 2025 breakthroughs** (reasoning training, agent environments, test-time compute; paradigms.ts:12–15): today they are known at the start. From 2023 they become research to discover.
  - **Products:** in 2023 only chat and the API existed (features.ts:33). Agent-type products unlock through research.
  - **Laws and events tied to calendar dates:** SB 53 and RAISE, the Congress flip, the IPO window, elections only in 2026 and 2028 (gov.ts:179–190). Elections need a regular cycle. Laws are Q4.
  - **Back-casts** that break before 2025: refCapCompute (world.ts:317), the revenue reference curve (plan.ts:316).
  - **`yearOfDay` bug:** it reads the START_DATE constant instead of the save's start date (capability.ts:100).
- **Calibration bonus:** from 2023, reference play must land near the real mid-2025 world: compute, revenue, task horizons, the reasoning breakthrough, China's lag. That's 2.5 years of measured history as shape targets.
- **The Jul 2025 start** keeps its own sourced table. A 2023 game reaching mid-2025 should look roughly like it; that's a consistency check.

## 4. After ASI: the first stages

**What keeps running:** labs, compute, chips, energy, the economy sectors, unemployment and inequality, the government's policy flags, the public, China and the treaty state. Two are already partly there: the government's monthly policy flags include cash transfers and UBI, and the sector model is built on bounded fractions. Every lab keeps running too, not just the player's.

**Needed first: physical ceilings.** These curves grow with no limit today:
- chip output at 1.5×/yr (market.ts:105);
- the leader's compute at 1.6×/yr;
- power per chip, which falls with no floor (sites.ts:277);
- the grid at 1.25×/yr;
- robot doubling times, which shrink to weeks once the 2035 clamp ends.

They need sourced limits from fabs, energy, chips per watt and materials. Remove the 2035 and 2051 date gates. These limits are what make compute and chips still matter.

**World type as a readout,** classified from state, never forced:
- **Who controls frontier AI:** a treaty (multilateral), corporations (one lab or a few), the US government (nationalized or under DPA), China, or nobody (AI out of control).
- **How gains are shared:** UBI or transfers or neither; inequality; unemployment.
- **Security:** war, arms race, or stable.

**When the game ends.** This depends on the situation; a proposal (judgement, Q5). The game ends at the first of:
1. **A final ending:** acquired, insolvent, ousted, retired. Also catastrophe and loss of control if those are final (Q6).
2. **The world settles:** the world type has not changed for N months, and no ladder or power share is still moving.
3. **The world leaves what we model:** physical automation passes a threshold (good robots everywhere) or the compute ceilings bind. Past that point the simulation stops being honest.
4. **A safety cap:** for example 10 years after the first ASI.

The end screen shows the world type and how it came about.

**What the player does after ASI** (Q7). The lab keeps running:
- where to deploy ASI (sectors, government, abroad);
- what to share with the government and with China;
- whether to back or fight UBI and the treaty;
- how to spend its compute.

This content must be small and use existing actions where possible.

## 5. Cleanup and fixes

**NPCs** (ACTORS.md §2):
- **Remove or wire up dead state:** the government's transactional and pollSensitivity; the public's shock and benefit; China's openSource; the archetype `safety` value; the unread China meters; rival cooperation and lobbyStance; `rival:*` trust; academia's pipeline.
- **Fix state that is overwritten daily:** China's hawkDove, `bloc:*` trust.
- **Reword or build** the 10 preset descriptions the engine doesn't honour.
- **China reads the player's private milestone flags** (china.ts:166–273). It should read public facts.
- **The government, the public and China should react to every lab,** not only the player (Q3).
- **Give the government and the public a post-ASI state** (§4).

**Setup** (WORLDS.md):
- The economy labels are backwards (sectors.ts:89).
- "Unknown" world is AI 2027 plus one random number. Make it real or remove it.
- Alignment Unknown and Medium are nearly the same.
- Acts become an era label only.
- New flow: Scenario → Start date → Lab kind → optional Custom.
- Storyteller and Tutorial move to an options screen.

**Balance** (BALANCE.md):
- Run games in parallel in `bots.ts`, and gather bot policy choices into one parameter object.
- Scan perturbations of the reference bot's unsourced choices.
- Apply the targets audit: keep / upgrade / INFO, response tests, 2023–25 history targets.
- Difficulty comes from the best policy found.

## 6. Order of work

The designer decided on 2026-11-24 that the cleanup, the one lab model, setup consolidation and the targets audit all come **before** any timeline extension.

**Stage A: fix what we have.** The world still starts in Jul 2025 and ends at ASI.

| Phase | What | Depends on |
|---|---|---|
| A0 | Small cleanup: dead and overwritten state, labels, acts as an era label, `yearOfDay`, China reading public facts, the naming pass | Q1 |
| A1 | Bot tools: parallel runs, a policy parameter object, a perturbation scan | none; runs alongside A0 |
| A2 | One lab model: the kind table, a fixed cast, the leader lab removed, NPC labs on kind parameters, a reference policy for the leader role | A0, Q2 |
| A3 | Setup consolidation (Scenario → Lab kind → optional Custom; the start-date picker arrives in B1) | A2 |
| A4 | Targets audit applied (keep / upgrade / INFO, response tests, held-out anchors), the refit it needs, bot runs for difficulty from the best policy found | A1, A2 |

**Stage B: extend the timeline.**

| Phase | What | Depends on |
|---|---|---|
| B0 | Physical ceilings and removing the date gates | Stage A, Q8 |
| B1 | 2023 start: sourced 2023 tables, capability scale, the breakthroughs as research, products, elections and laws, 2023–25 history targets added to the audited set, the start-date picker | Stage A, B0, Q4 |
| B2 | After ASI: the world type readout, actors keep running, the end rule, minimal post-ASI player content, the end screen | B0, Q5–Q7 |

Each phase gets cut into small single-concern tasks in a tasks file before building. Heavy test runs happen only at the end of each phase.

## 7. Open questions for the designer

1. **Naming pass:** should I propose a full set of invented names (labs, model families, China's lab, firms) for you to approve?
2. **Lab kinds:** are the six kinds above right? Does the spinout (SSI- or Thinking-Machines-like) stay as a seventh? Should the kind's goals reach the player through the board, parent and partners, or as explicit objectives?
3. **Should the government, the public and China react to every lab, or mainly to the leader?**
4. **From 2023, do real laws and events happen on their real dates, or only when the mechanisms produce them?**
5. **The end rule:** do you agree with "first of: final ending, world settled, beyond what we model, safety cap"? What N months for "settled"?
6. **Are loss of control and catastrophe final, or do they continue as a changed world?**
7. **Player content after ASI:** is the small set in §4 enough, or do you want something specific?
8. **Physical ceilings shift the 2030s calibration.** Do you accept that?
