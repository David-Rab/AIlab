# Outside-world information architecture (W8a proposal)

For the designer's approval. Follows design/ux/IA.md (levels L0 to L3, one home per datum, references show no value).
Mockups: `design/world/ui/mockups/` (powers-home, powers-tooltip-why, world-work, world-tech). Problems with today's UI: AUDIT.md.

## 1. Decisions

1. **The "Powers" home is the rebuilt Relations panel, renamed Powers** (nav group COMPANY & WORLD, same slot, handshake icon).
   Why: (a) it is already the nav home for government, public, China and pledges, so players and the IA table keep one place;
   (b) the briefing lever, pledges and trust sit next to what they change, which a World tab or the Overview could not host;
   (c) the three actors answer one question, "what do the outside powers require of me and what do they think of me", while World
   answers "what is AI doing to the economy and technology"; (d) it needs no extra nav item (12 stays 12).
   Rejected: a new World sub-tab (World would keep a mixed purpose and the pledge controls would be far from their panel);
   the Overview (it holds exactly three cards by IA rule).
2. **L0 gets no outside-world number.** Stage, tension, concern, trust are L1 on Powers. The shell gets two cheap signals only:
   a nav badge on Powers when a beat waits (stage climb, treaty offer, a pledge binding), and Watch chains on the Overview
   ("Clearances land on you > staff and speed cost > Powers").
3. **World keeps AI at work, jobs and technology and loses everything about actors.** Tabs: Work (economy tiles, sectors, jobs),
   Risk (unchanged except link chips to Powers), Tech & control (control index, robots, world techs, moonshot). The macro strip
   leaves the page chrome; GDP and AI share of income become Work tiles; Robots goes to Tech & control.
4. **The actions in Relations that survive the W7 cut sit beside their effect:** briefing lever in the US card; the three pledges
   in the Pledges card; Retire in the menu (≡).
5. **Powers L1 = four visuals:** the top rail (your prominence + the public frontier with milestones and the stage each
   triggers), the public card (concern and approval gauges), the US card (stage ladder, briefing lever, laws), the China card
   (lead track with tension thresholds, tension ladder, talks, treaty). The Pledges card is L2 content on the same screen.

## 2. Datum to home

Level: L0 always visible; L1 first-glance visual on its panel; L2 inside a card or tab; L3 tooltip or codex.
Reference = a link chip with no value.

| Datum | Home (panel, element) | Level | Hover (L3) shows | References (no value) |
|---|---|---|---|---|
| Concern about AI | Powers, public card, gauge with 70/75 ticks and target marker | L1 | base, milestone steps, unemployment rise, incidents; what it triggers and how far | Laws chips (licensing, human mandate) |
| Approval of you | Powers, public card, diverging bar | L1 | incidents, disclosures, pledges, openness, each x prominence; baseline falls with concern | Products (demand), Lab (hiring pull) |
| Your prominence (attention) | Powers, top rail gauge | L1 | frontier part, reach part; what it scales | each actor card: "applies to you" status |
| Public frontier and milestones seen | Powers, top rail track | L1 | per milestone: first lab, date, which stage and concern step it triggers | Overview lead track (positions) |
| US security stage | Powers, US card ladder | L1 | trigger of the next rung, hold timer, what each rung asks | Watch chain, nav badge |
| Trust in you | Powers, US card header gauge | L1 | up/down causes (security floor, briefing, thefts, cover-ups), monthly | Lab > Security (the floor) |
| What Washington sees (briefing level) | Powers, US card lever (None / Partial / Full) | L1 | delay, stage timing, trust per month; before to after | Lab (internal milestones) |
| Oversight committee | Powers, US card, ladder rung 3 (accepted / refused) | L2 | what review does to launches (30-day wait) | Models (launch wait) |
| Consolidation | Powers, US card, ladder rung 4 | L2 | DPA pool share or takeover | Ending screen |
| Laws in force (each of 11) | Powers, US card chip grid | L2 | rule on/off, effect, threshold distance | Work (relief chip), Tech (zones chip), Compute market (export chip) |
| Export policy | Powers, laws grid, "Chip exports . case by case" | L2 | steps, what it does to China's compute | Compute > Market (reference chip) |
| China tension | Powers, China card ladder | L1 | trigger of the next rung, hold timer | War risk row (Risk), Watch chain |
| US lead over China | Powers, China card lead track (6 and 9 month ticks) | L1 | public levels of both, trend | Overview lead track (a different datum: your lead over rivals) |
| Talks (0-3) | Powers, China card track | L2 | what opens and advances talks | nav badge on a treaty offer |
| Treaty | Powers, China card (status line) | L2 | the AI R&D compute cap | Compute (cap) |
| National collective | Powers, China card, tension rung 2 | L2 | China's lab compute multiple | Lead track hover |
| Taiwan disruption | Compute > Market (supply); Powers China card shows a reference chip, lit only when disrupted | L2 | shipping state, duration | headline |
| Taiwan risk | Compute > Market | L2 | hazard x tension factor | Powers (reference chip) |
| Pledges and obligations | Powers, Pledges card | L2 | condition, binds now, what breaking costs | Safety > Tools (pledge gates) |
| Make a pledge (actions) | Powers, Pledges card | L2 | effect pills: approval, trust, what the government sees | none |
| Unemployment (US) and 12-month change | World > Work, tile 1 | L1 | by region, youth, exposed jobs | Powers (relief chip) |
| Unemployment (China, rest of world) | World > Work, Jobs card | L2 | pool and exits | none |
| GDP growth | World > Work, tile 2 | L1 | trend, shocks | none |
| AI share of income | World > Work, tile 3 | L1 | AI revenue / GDP | End screen |
| Work done by AI (automation) | World > Work, tile 4 | L1 | by sector | Sector card |
| Sectors (hours of use, automated, your share) | World > Work, heatmap and sector card | L2 | adoption equation, limits | Finance > Story (your share), Products |
| Jobs: displaced, transition fund | World > Work, Jobs card | L2 | pool and re-employment; fund cost | none |
| Robots per month | World > Tech & control | L2 | stock, output | economic zones chip |
| World technologies, moonshot | World > Tech & control | L2 | gates, blocker, ramp | zones, FDA chips |
| Control index | World > Tech & control | L2 | shares by lab, tiers | none |
| World risk per source | World > Risk (unchanged) | L2 | drivers, levers | Powers (China, war) |
| Headlines of outside events | Bottom bar (L0, latest) | L0 | list | anchor to the Powers card |

## 3. Drill-down paths

| Question | Path |
|---|---|
| Why is Washington about to impose clearances? | Powers nav badge > Powers US card, rung 2 (needs, hold timer) > hover the milestone term > rail track > the lab and date that showed it |
| Can I slow or speed what Washington sees? | US card lever (briefing) > before to after line > set Partial or Full |
| Why is concern rising? | public card concern gauge > hover: cause bars (milestones, jobs, incidents) > nested "public incidents" > list with decay |
| Why did China harden? | China card: lead track crossing the 9 month tick > tension ladder rung 2 > hover: trigger and hold |
| What does the treaty need? | China card talks track > hover: opening and advancing conditions > treaty row: the compute cap |
| Why is unemployment up? | World > Work tile 1 > hover: by region and youth > sector heatmap (automated) > Powers relief chip (is help coming) |
| What does a pledge cost me? | Powers Pledges card > hover a tile: effect pills (approval, trust, what the government sees) |

## 4. Glossary coverage

Present in `src/data/v2/glossary.ts`: concern, approval, securityStage, govTrust, oversight, consolidation, chinaTension,
chinaTalks, nationalCollective, treaty, lawLicensing, lawRelief, lawUbi, lawHitl, lawSez, lawFda, lawSb243, exportPolicy,
taiwanRisk, gdpG, aiIncomeShare, displaced, youthUnemp, robots, wtech, moonshot, transitionFund, leverage (control index),
milestone, commitment, clearances.

**Missing, to add in W8b:**

| Term | Entry (short) |
|---|---|
| lawSb53, lawRaise, lawEuGpai | The three incident-reporting laws, with dates and deadlines (15 days; 72 hours) |
| lawExport | Strict chip export controls: when they switch on and off, what they change |
| govBriefing | The briefing level: none, partial (internal milestones 90 days late), full (from the day reached; trust +0.5 per month) |
| attention (label: prominence) | How much outsiders care about your lab, 0-1: frontier part and reach part; what it scales |
| publicFrontier | The best capability shown publicly by any lab; what is public vs internal |
| incidentHeat (label: public incidents) | Severity-weighted incidents any lab disclosed or leaked; half-life about 6 months |
| usLeadOverChina | Months between the best US public level and China's; the tension thresholds |
| talksSteps (restraint pact, verified treaty) | What each step means and requires |
| stageRungs: stageSecurity, stageClearances, stageOversight, stageConsolidation | One entry per rung: what the government asks, what lands on you |
| automationShare (label: work done by AI) | Share of US work hours done by AI; how it differs from hours of use and workers using AI |
| pledgePreDeploy, pledgeFramework, pledgeWhistleblower | What each pledge binds and what breaking costs |
| localOpposition | Only if surfaced from Powers (its home is Compute > Sites) |

Rename for consistency: glossary id `leverage` has the title "Leverage" while the UI says "Control index" (add an alias).

## 5. Implementation notes for W8b

- `data-home` ids to add: `concern`, `approval`, `attention`, `publicFrontier`, `usStage`, `usTrust`, `govBriefing`, `usLaws`, `exportPolicy`,
  `chinaTension`, `usLead`, `chinaTalks`, `treaty`, `pledges`, `econUnemployment`, `econGdp`, `econAiShare`, `econAutomation`.
  The existing uitest IA scan then enforces one home per screen.
- Selectors needed (UI-only, read from engine state): concern parts (the four terms of `concernTarget`), trust ledger list, ladder
  "next rung" trigger and hold progress (usgov holdDays), lead-over-China series (chinagov `leadHist` exists), prominence parts.
- Remove from Relations.tsx: the action group picker, the standalone China and UsGov Sections (replaced by cards), `GROUPS`.
- World.tsx: drop `macro-strip`; add the four tiles; `society` tab id becomes `tech`.
- Colour: US ladder uses the "you" blue only for the lit rung and trust; China uses the China magenta; laws use status green for
  "in force"; no new hues. Government and public stay neutral grey with icons (DESIGN-SYSTEM actor rules).

## 6. Open questions for the designer

1. Powers as the rename of Relations (default), or keep the name "Relations"?
2. Pledges: the spec (§8.1) homes them in the safety sphere. The mockup keeps "make a pledge" on Powers next to trust and approval and
   leaves their gates in Safety. Confirm, or move the buttons to Safety > Tools.
3. Should the L0 strip carry one small "Washington" chip (stage pips, no number elsewhere) instead of the nav badge alone?
4. World > Work: is "Providers" (the seven-lab market table) acceptable as a link to Finance > Story, or should it stay on the sector card?
5. The three overlapping adoption numbers (B3): confirm "workers using AI, hours of use, work done by AI" as the surviving three.
6. Talks and treaty need a clearer "what you can do" (back or oppose the treaty is an event today); is a Powers lever for talks wanted
   (a seventh control), or events only (default)?
