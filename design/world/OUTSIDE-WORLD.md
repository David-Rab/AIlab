# Outside world: governments, public, economy (spec, DRAFT for the designer)

Status: draft 1, 2026-11-27, branch `world`. The designer's words are in [SESSION-HEAD.md](SESSION-HEAD.md) and win
over this text. Prior audit of the current actors: [../vision/ACTORS.md](../vision/ACTORS.md).

## 1. Framing

The world outside the player's lab, in the designer's ranks (gameplay weight, and how much "good" matters over
"simple"):

| Rank | What | Kind | State today |
|---|---|---|---|
| 1 | Finance markets (investors, debt) | market | first version built (FINANCE-V3) |
| 1 | Compute markets (chips, power) | market | first version built (DATACENTERS, compute/market) |
| 1 | Product markets (customers) | market | first version built (MARKET) |
| 2 | Labour market (hiring) | market | first version built |
| 3 | Rival labs (incl. China's lab) | actors | first version built (NPC-LABS) |
| 3 | Governments (US, China) | actors | **junk, rebuilt here** |
| 4 | Public | actor | **junk, rebuilt here** |
| 4 | Economy | readout of the product markets | **junk, rebuilt here** |

Markets are arenas that the player and the actors work in. They only need to respond correctly to the actors. **So the
rank 3–4 actors act mostly by setting market inputs**: laws and bans set product-market friction, export controls and
Taiwan risk set the compute market, public mood sets demand and siting. They act directly on a lab only where no
market exists: security demands, oversight, nationalisation, weight theft.

Out of scope: the four markets and the rival labs themselves, and calibration of the lab's internals (workstream
`bal`). The two halves are made to work together later (SESSION-HEAD §4.4).

## 2. Rules

- **R1. React to observables, not truth.** Outsiders see public facts:
  - deployed models and their measured levels;
  - NPC labs' public view (npc/public.ts);
  - disclosed or leaked incidents;
  - announced pledges.

  The US government also sees what the player briefs. Nobody reads private evaluation flags; that rule fixes China
  reading `seenMilestone*` today.
- **R2. Two levels of reaction.**
  - **World level** (laws, concern, China's tension) follows the frontier, whoever holds it, rivals included.
  - **Attention on a lab** (government requirements, theft targeting, public approval swings) scales with that lab's
    position (§3.2).

  A lab far from the frontier is invisible: no "government worried about you" without an advanced model (SESSION-HEAD
  §2).
- **R3. Small state.** Each actor has 1–3 state numbers or ladders, plus a short table (laws). Every number either
  changes something the lab feels or is a readout the end screen needs. Otherwise it is deleted.
- **R4. Every number has a calibration target:**
  - a real series (2023–2026 history),
  - the source scenario's own values ([[prefer-source-derived-params]]),
  - or a shape rule (§11).

  No target, no number.
- **R5. Levers through normal business.** The player moves these actors by what the lab does anyway: security,
  briefing, pledges, disclosure, where and how much it builds, what it deploys, the transition fund. No menu of one-click
  relation buttons.
- **R6. Events are rare** ([[ai27-events-rare]]): only the decisions listed in §8, each with a sensible default.
- **R7. Works across eras.**
  - Every trigger is relative (milestones, the lead, thresholds), never a 2025 date. Exceptions are the real laws in
    one dated table.
  - State has meaning after ASI: who controls AI, how gains are shared, war or peace (vision/MEDIUM.md §4).
- **R8. World setup is one or two parameters per actor**, not presets with long descriptions the engine doesn't honour.

## 3. Shared inputs (one module, read by every actor)

### 3.1 The frontier
- **Public frontier:** the best capability shown publicly by any lab. That means the player's deployed models, the NPC
  labs' public view, and China's lab (with its opacity).
- **Milestones:** the named milestones it has passed (reliable agent, research agent, superhuman coder, superhuman AI
  researcher, and beyond). They come from the existing milestone predicate (RD-L04), applied to public models.
- **Government frontier:** the public frontier plus what the player briefs (the briefing level) and, under a
  pre-deploy-testing pledge, the player's tested internal model. NPC labs: their public view (one typical rule, no
  per-lab briefing model).
- **US lead over China:** the best US public level vs China's public level, in months (the lag clock).

### 3.2 Attention on a lab
One number, 0–1, per lab. It answers "how much do outsiders care about this lab":
- **Frontier part:** 1 within about 3 months of the government frontier, halving with each further ~3 months behind
  [D, to fit to the shape checks].
- **Reach part:** the lab's share of consumer and enterprise users.
- **Attention** = max(frontier part, reach part).

It scales every lab-directed effect: government requirements, theft targeting, approval swings, press. It also
replaces today's player-only triggers.

### 3.3 Public incidents
Severity-weighted incidents disclosed or leaked by any lab, decaying (half-life about 6 months). They feed concern
(world level), and approval of the lab that had them (× its attention).

## 4. Economy (a readout, rank 4)

**Kept as is** (it is the product market): the sector adoption engine and the job displacement in
worldfx/sectors.ts, which gives the displaced pool, unemployment and youth unemployment. Robots and world
technologies are kept as flavour for the post-ASI world (SESSION-HEAD §4.2). Their inputs are re-pointed to the new
laws (special economic zones, FDA fast track) and the public frontier.

**Readouts** (no state of their own beyond what exists):

| Readout | Rule | Feeds | Target |
|---|---|---|---|
| Unemployment (US, CN, ROW) | existing displaced-pool rule | public concern; relief law; endings | BLS CPS 2023–2026 baseline; displacement shape from the source scenario (research/16) |
| GDP growth | baseline trend + automation share × gain + world-tech boost − shocks (war, Taiwan, severe misuse) | re-employment (sectors.ts:311, its one market read); end screen; headlines | BEA trend; source scenario's growth path |
| AI share of income | AI revenue (all labs) ÷ GDP | end screen ("how gains are shared") | the source scenario's values |

**Deleted:**
- the CES automation factor, trend and autoLevel;
- labour share, wage and Gini (replaced by the AI share of income, plus transfers/UBI);
- the Dow, P/E, macro hype and fear;
- energy price and AI capex share;
- the intelligence curse (replaced by the readouts above).

None of these change a lab number today.

## 5. Public (rank 4)

| State | Rule | Feeds |
|---|---|---|
| **Concern about AI** (0–100, world) | drifts (half-life about 3 months) to a target = baseline + a step per public-frontier milestone + k·(12-month unemployment rise) + recent public incidents and leaks (§3.3) | laws (§6.3); local opposition to building; China talks (scares) |
| **Approval of you** (−100..100) | event-driven, each push × your attention: your public incidents, exposed cover-ups, disclosures, pledges kept or broken, open releases; drifts to a baseline that falls as concern rises | product demand ×(1 ± 0.1) (existing read, mix.ts:321); hiring pull (labour market); government trust (small) |
| **Local opposition** (derived) | concern × your building footprint, lowered by the community package | compute siting (existing read, compute/sites.ts) |

NPC labs need no approval of their own: their demand is headline-shaped (NPC-LABS).

**Deleted:**
- eleven meters, the activism ladder and elections;
- the 15 interest blocs, coalitions and policy pressure;
- public presets, replaced by one setup parameter (how sensitive the public is).

Protests are a headline when concern passes a threshold, not a ladder.

Targets: concern from survey series (Pew Research Center and Gallup AI-attitude surveys, 2023–2026; source to fetch),
and the source scenario's public-reaction beats (AI 2027) as a shape.

## 6. US government (rank 3)

### 6.1 State
- **Security stage** 0–4, world level. Each stage is set by what the government sees (§3.1), never by the player
  alone:
  - **0 business as usual.**
  - **1 security expectations** for frontier labs. Trigger: the government frontier passes the reliable-agent
    milestone, or a detected theft from any US lab.
  - **2 clearances and embedded officials.** Trigger: the research-agent or superhuman-coder milestone is seen, or a
    second theft.
  - **3 oversight committee.** Trigger: the superhuman AI researcher is seen.
  - **4 consolidation**, by one of two paths:
    - DPA, the soft path, with high trust;
    - nationalisation, the hard path: low trust, or a leaked misalignment memo with high concern.

  Climbing needs the condition to hold for a lag. The lag is a setup parameter: how fast the government reacts.
- **Trust in you** (0–100).
  - Up: meeting the stage's security expectation, briefing, complying at a stage beat.
  - Down: resisting, exposed cover-ups, thefts from your lab, severe misuse.
  - Moves only as much as your attention.
- **Laws:** one table (§6.3).

### 6.2 What reaches labs
- **Stage requirements land on labs with attention above a threshold:** a security floor, clearances (staff and speed
  cost), an oversight review on deploys, consolidation. Below that threshold the panel says the requirement doesn't
  apply to you.
- **Nationalisation (the ending)** needs stage 4 with low trust. DPA consolidation is the stage-4 offer (an event,
  §8).
- **Export controls** on chips to China: a law (§6.3). They feed the compute market and China's compute.
- **Laws feed the product markets** as sector friction and usage limits, and the safety sphere as reporting
  deadlines.

### 6.3 Laws (the whole list)

| Law | On | Off | Effect | Target |
|---|---|---|---|---|
| Incident reporting (SB 53, RAISE, EU code) | their real dates (one table) | — | reporting deadlines (safety sphere) | real dates |
| Export controls (strictness 0–2) | rises with the US–China contest (China tension, thefts by China) | falls with a treaty | compute market, China compute | 2023–2025 control history |
| Frontier licensing | concern > threshold, sustained | concern well below | friction on frontier deploys; reporting | [D] shape |
| Worker relief → transfers → UBI | 12-month unemployment rise > threshold; UBI if sustained 6 months | relief ends when the rise fades; UBI sticky | economy (re-employment, the ending's sharing) | source scenario (AI 2027 Slowdown) |
| Human-in-the-loop mandate | public scare (leak or severe incident) + high concern | concern low | caps agent substitution across sectors | [D] shape |
| Companion apps banned for minors | companion share + concern | concern low | consumer friction | 2025–2026 state laws |
| Special economic zones | government sees superhuman AI research, low concern | concern high | robots (flavour) | source scenario |
| FDA fast track | an AI drug pipeline exists (world tech) | — | world-tech ramp (flavour) | source scenario |

**Deleted:**
- eight of the nine meters: AI priority, regulation stance, hawkishness, Congress activism, state pressure, judicial
  check, awareness, and the nationalisation meter (replaced by stage 4's rule);
- the China-controls ladder (folded into the export-controls law);
- the Congress flip, preemption suits and vetoes;
- the flags: arms race (now China's top rung), military loop, multi-vendor, advice transparency, government advisors,
  AV ban and school ban;
- the five presets, replaced by two setup parameters: reaction speed, and appetite for regulation (shifts the law
  thresholds).

**Open:** a support channel, where a government racing China speeds data-centre permits for US labs (a real 2025
shape). It is one extra output into the compute market. Q2.

## 7. China government (rank 3)

The China *lab* is an NPC lab and stays as is.

### 7.1 State
- **Tension** 0–4: competition, acquisition push, national collective, coercion over Taiwan, war footing.
  - **Climbing:**
    - to 1: the US lead > about 6 months, or strict export controls;
    - to 2: the lead > 9 months and widening;
    - to 3: the lead stays large after a failed theft, or the US is at stage 3+;
    - to 4: coercion + a rejected treaty + a large lead.
  - **Descending:** after the conditions fail for a hold period; rungs 3–4 are sticky.
- **Talks** 0–3: talks, restraint, verified treaty. Talks open after a scare (a leak or severe incident, any lab) or
  when the lead is small, if the US government proposes them. They advance while quiet (no thefts or cyber operations).

### 7.2 What reaches labs and markets
- **Theft and distillation:** aimed at the US lab with the most attention that has a lead over China. The existing
  security/theft.ts rules are kept; their inputs become tension (attacker strength) and attention (target).
- **National collective** (tension 2+): China's lab gets pooled compute (the existing deepCentCompute rule, with
  centralisation set by the rung).
- **Taiwan:** the compute market's Taiwan hazard × a tension factor. The shock itself is the existing taiwanShock.
- **War ending** at tension 4 (existing quarterly chance).
- **Verified treaty:** the existing clock slowdown (npc/shocks.ts, workfit.ts) and the treaty ending.

**Deleted:** 16 meters down to tension and talks; the six presets and quarterly re-weighting, replaced by two setup
parameters, aggression and willingness to bargain.

Copyright suits and rival finance move out of China's quarterly system to their own owners.

## 8. Events and the player's levers

### 8.1 Levers kept (all through normal business)

| Lever | Home | Moves |
|---|---|---|
| Briefing level (none, partial, full) | US government panel | what the government sees; trust |
| Security level, siloing, counter-intelligence | Lab › Security | trust; theft odds |
| Pledges (pre-deploy testing, framework, whistleblower channel) | safety sphere (commitments) | approval, trust; what the government sees |
| Disclosure of findings and incidents | safety sphere | approval; concern |
| Community package | Compute › sites | local opposition |
| Transition fund | World › jobs | re-employment |
| Moonshot | World › technologies | world techs |
| Open-weights release | Models | approval; China distillation |
| Retire | — | ending |

**Cut from today's 26 relation actions:** evaluator access, publish research, bug bounty, loss-leader contract, defence
contract, hire officials, lobby, voluntary accord, sue, threat-intel sharing, restricting adversaries, joint evals,
academic grant, safety fellowship, track-2 dialogue, gov-gov agreement, export lobbying.
- Poach moves to the labour market if that market wants it.
- "No drop-in agents" moves to product policy.
- Government as a customer (defence contracts) belongs to the product markets later (OPEN).

### 8.2 Events kept

Each event's default is the neutral option, not the worst one.

| Event | Trigger | Choices |
|---|---|---|
| Weights stolen | a detected theft | go public / harden quietly / purge insiders |
| Clearances | stage 2 lands on you | comply / resist |
| Oversight committee | stage 3 lands on you | accept / refuse |
| Consolidation (DPA) | stage 4 soft path | accept (board vote) / decline |
| Treaty | talks reach restraint | back it / oppose it |
| The leak | whistleblower or an overdue internal report | disclose / deny (Deny and Spin merged; preview fixed) |
| Copy loose | exfiltration noticed | shut down and hunt / hunt quietly / disclose |
| Merger offer | a rival in distress | buy / decline |
| First finding (safety sphere) | first confirmed finding | disclose / keep quiet |

**Cut or converted:**
- Evaluator contradicts you (E29): cut. One choice dominates.
- Talent raid (E16): cut. The labour market's job.
- Site blocked (E27): becomes the site's own actions in Compute.
- A pledge binds (E30): becomes a status on the pledge, with honour / amend / break on the commitments panel.
- "Negotiate" variants: cut.

### 8.3 Notices and headlines
- Only game-ending notices block the game. Everything else goes to the alert queue.
- Headlines are trimmed to those driven by surviving state.
- Failed clicks never become alerts.

## 9. What is deleted, by file

Full list: [INVENTORY.md](INVENTORY.md). The points that shape the work:

- **Deleted whole:**
  - actors/gov.ts, public.ts, blocs.ts, relations.ts, researchBodies.ts, index.ts (Safety Index), tuning.ts;
  - most of actors/actions.ts and china.ts;
  - worldfx/macro.ts, policy.ts (replaced by the laws table);
  - data/v2/blocs.ts and the gov, public and China presets;
  - the Relations panel;
  - about 50 glossary terms;
  - the dead v1 glossary.
- **Moved, not deleted** (INVENTORY §2). China's quarterly system also hosts:
  - NPC rival finance and chip orders (without it, NPC labs stop ordering chips and E32 never fires);
  - copyright suits;
  - the only Taiwan and Korea shock rolls.

  These move to their owners first. `ws4` is a grab-bag: its event queue, security, safety, NPC and endings fields
  stay in W1, and are split to their owners in W11. Commitments, `leadDays` and the China lab stay.
- **Quiet world** (INVENTORY §3): every market read gets a neutral value:
  - approval 0;
  - siting mood at the calibrated 45;
  - Taiwan tension at its start value;
  - export policy case-by-case;
  - all policy flags off;
  - treaty none;
  - a fixed China attacker level, so theft still exists;
  - hiring pull at the start-type anchor.

  The real laws keep their dates from W1: the laws table starts there with its dated rows.
- **Tests:** there are no unit files; about 15 scripts/v2 checks are deleted or rewritten, plus fixtures, hashes and bot
  fingerprints re-baselined (INVENTORY §5). Bots call relation actions by id, so bot policies change too.

## 10. Endings

Kept (SESSION-HEAD §4.1); inputs re-pointed:
- **Nationalised:** stage 4 with low trust.
- **DPA:** stage-4 offer accepted.
- **War:** China tension 4.
- **Treaty:** talks 3.
- **World-outcome scoring:**
  - who controls AI: treaty, government, corporations, China, nobody (the control index stays);
  - how gains are shared: UBI or transfers, unemployment, AI share of income;
  - security: war, the contest at tension 3+, or stable.

## 11. Shape checks (the acceptance tests)

These are constructed cases, not sampled games ([[test-time-policy]]). Each one runs against the quiet world first
(W1), then with each actor added:

- **S1 Weak player.** The player never nears the frontier while rivals advance.
  - The stage and concern rise (from the rivals).
  - No requirement, theft or approval swing lands on the player.
- **S2 Leading player.** The stage follows the player's shown milestones. Full briefing makes the government see more,
  so the stage climbs sooner and trust rises.
- **S3 Frozen frontier.** No AI progress: everything stays at baseline, with no drift into worry.
- **S4 Job losses.** Unemployment rises, then concern rises, then the relief law passes. UBI follows only if the rise
  is sustained.
- **S5 Lead over China.**
  - A growing lead raises tension in steps.
  - A scare or a small lead opens talks.
  - Strict export controls raise tension.
- **S6 Taiwan.** The hazard scales with tension. The shock goes through the existing compute-market function.
- **S7 Eras.** A 2023 start with today's world shows no laws before their dates and no stage before the milestones.
  After ASI, the stage, laws, UBI and treaty still have meaning.

## 12. Plan (tasks to cut from this; models per the subagent rules)

| # | Task | Notes |
|---|---|---|
| W0 | Removal inventory | lead; fills §9 |
| W1 | Quiet world: delete the junk, put neutral stand-ins at market read sites; the game runs and the tests pass or are deleted | split by piece; sequential (types.ts, saves can break) |
| W2 | Shared inputs: public frontier, government frontier, attention, public incidents | one module |
| W3 | Economy readouts | |
| W4 | Public | |
| W5 | US government | |
| W6 | China government | |
| W7 | Events and levers pass (§8) | |
| W8 | UI: one "Powers" home (US government, China, public), and the World tab trimmed | skill good-ui |
| W9 | Calibration targets: fetch the primary sources named in §4–§7 | can start now, parallel |
| W10 | Shape checks S1–S7 | |
| W11 | Cleanup: dead code, glossary, docs (V2-SPEC sections, OPEN.md) | |

## 13. Questions for the designer

- **Q1.** The attention rule (§3.2): is "max of frontier closeness and user reach" the right idea for "how much
  outsiders care about you"?
- **Q2.** Should the US government have a support channel (faster data-centre permits while racing China)? It is one
  extra input to the compute market.
- **Q3.** The laws list (§6.3): is that the right set, too many, or too few?
- **Q4.** Hiring pull from public approval: one approval for both customers and researchers, or a separate standing
  among researchers (e.g. moved by safety record)? The first is simpler.
- **Q5.** Item 3 left open "fold or cut" for evaluators and the Safety Index. Draft choice: fold. Pre-deploy testing
  lets the government see your model; the Index grades, evaluator queues and academia are cut.
