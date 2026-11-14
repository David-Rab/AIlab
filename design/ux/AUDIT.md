# v2 UI audit

**Scope.** Every v2 screen at four stages, captured from a real build (`npm run build`, Edge headless, 1680×1000):
- day 0 (fresh game, tutorial on);
- day 45 and day 300 (mixed-bot saves, seed 2027);
- day 700 (Act 3, with a pending decision);
- the end screen (day 1026, "Superintelligence, aligned").

Screenshots are in `design/ux/before/`; file names are cited as `[before/…]`.

**User feedback this audit answers.** "Hard to understand what causes what, where controls are, what things do. Very not visual/graph/icon/diagram."

**Verdict.** The engine already computes most of what the player needs: the cause ledger, production what-ifs, raise-ceiling limits, risk-source drivers, trait-graph evidence and run predictions. The UI shows these as text rows inside tooltips and tables, and on every screen the three most important facts sit at the same visual weight as forty minor ones.

The fix is mostly presentation, plus a small number of read-only selectors and one engine bug.

Severity:
- **P0**: wrong or misleading.
- **P1**: the cause→effect or the control is not findable.
- **P2**: visual / ergonomic.
- **P3**: polish.

---

## 1. Top 10 problems (ranked by clarity cost)

| # | Sev | Problem | Where | Why it fails | Fix |
|---|---|---|---|---|---|
| 1 | P0 | **The central meter breaks.** The race readout shows **L 0.0**, and U drops from ~7 to 1.9 whenever the internal agent is a version that is still being evaluated. | Top strip [before/31-day300-tip-race.jpg] | `measuredL()` returns `internalVersion.evals.measuredL ?? 0`, and `understanding()` uses the same 0. The weekly series records the dips: in 101 weeks U fell to 1.9–2.0 twice and swung 10.7 → 8.1 in a fortnight. The player's main signal flickers for reasons the game never shows. | Engine: fall back to the lineage's last measured L while evaluating, and show an "evaluating" tick on the bar. UI: smooth U changes and attribute them (#3). |
| 2 | P1 | **The race is a pair of 5-px bars.** They sit in a strip of 9 equal-weight items, with no scale, no milestones and no history. | Top strip [before/10-day0-main.jpg, 40-day700-main.jpg] | The Plague Inc dual race is the game's thesis. It gets 110 px, the same weight as Scrutiny. "−2.0" is a small coloured number with no label, and there is no visual answer to "how far behind am I, and since when". | Make the race the hero of the strip: one shared scale, milestone ticks and a hatched "blind" gap. Add a frontier track and a race-history chart to the centre [mockups/01-main.png]. |
| 3 | P1 | **Understanding has no "why".** U is absent from the cause ledger, and its tooltip lists 6 detection percentages and a static footer. | Race tooltip [before/44-day700-tip-race.jpg] | When U drops the player cannot tell whether a tool decayed, the agent switched or a mask formed, or which control to touch. | Add a U breakdown selector (per-tool contribution, decay, agent switch). The tooltip shows detection bars against 50%, "why it moved" and lever buttons, and lights the linked UI [mockups/01b-main-hover-why.png]. |
| 4 | P1 | **The centre map carries almost no information.** Nodes sit at fixed positions and every rival is an identical orange disc. Edges are unlabeled, with width as the only value. Day 0 and day 700 look the same apart from 5 sector dots. | Risk map [before/10-day0-main.jpg, 40-day700-main.jpg, 47-…-risk-overlay.jpg] | The biggest screen area answers no question. "+113d" under a lab is unexplained. The risk overlay recolours nodes green/amber with no legend, so your lab turns amber and rivals turn green, the opposite of the actor colours. | Replace it with an overview of three views. **Frontier track**: labs placed by estimated L, the U line, the unverified zone. **Automation spread**: region × sector heat, Plague Inc's "spread". **Where risk comes from**: ranked bars. Keep flows as a tab. |
| 5 | P1 | **Controls are buttons named after engine actions, each carrying an inline cost/gain string.** | Every panel: Departments "Set $0.00B 0.00 align", Safety ×19 "Fund / Cut", Relations ~40 buttons [before/46-day700-departments.jpg, 46-…-relations.jpg] | Every button shows 2–3 coloured mono numbers, even when they are zero ("$0.00B 0.00 align"). The eye cannot find the control that matters, and "⚠1" is unexplained. Disabled and enabled buttons look nearly the same. | Buttons carry a verb and an icon only. The preview appears on hover as before→after bars on the real meters. Hide zero lines. Make disabled buttons visibly different and put the reason inline. |
| 6 | P1 | **The run designer does not show what a choice does.** Five of eight choices leave the predicted L unchanged. The trait effect is shown as `S1 ▲▲ S2 ▲▲ …` codes. | Run designer [before/15-day0-rundesigner.jpg, 46-day700-rundesigner.jpg] | Engine sweep on the day-700 state: preference, CoT, safety level, inoculation and RL focus give an identical L band. Only the S-codes change, and safety level and inoculation change nothing visible at all. The model-design meta-game is invisible. | Each option shows its own effect glyphs. Signals are translated into trait arrows via the trait-graph edges, with a "main path" chain and citations. A radar compares the prediction with the current model. A compare strip sits beside Launch [mockups/03-run-designer.png]. |
| 7 | P1 | **There is no picture of the company.** Money, compute, people and departments live on 4 panels as tables. | Finance, Compute, Departments [before/46-day700-finance.jpg, 46-…-compute.jpg, 46-…-departments.jpg] | "2.7M idle: no power" (32% of chips dark) is a red caption on Compute. "Capacity-bound" on all three deployments is a column on Deploy, where demand is $436B against a $130B cap. Nothing connects these to the Capacity crunch decision or to the bottleneck. | Add a Company flow (Sankey) view: $ → spend → compute/people → departments → outputs, with binding markers and a revenue loop [mockups/02-company-flow.png]. |
| 8 | P1 | **Decisions show costs without context.** "COST $1.0B / GAIN $1.0B/yr rev, 5 compute %" sits in mono text, with no current value, no cause and no link to lasting fixes. | Decision modal [before/41-day700-decision.jpg] | The player cannot judge whether $1B is a lot (cash is $25B), what "5 compute %" means, or why the crunch happened (serving 17%, power-starved chips). | Use choice cards with before→after bars on the touched meters, a "why this happened" cause chain with a demand-vs-capacity sparkline, and "lasting fixes" links. Keys 1/2/3 choose [mockups/05-decision-modal.png]. |
| 9 | P1 | **Safety Lab is a 2,000-px scroll of tables.** It holds 19 agenda rows × 6 buttons and 17 techniques × 2 buttons. The trait graph is at the bottom, with tiny `S1…S8` and `E03 B` labels. | Safety [before/46-day700-safety.jpg, 49-…-trait-hover.jpg] | The best causal diagram in the game is unreachable and unreadable. Detection appears as six numbers in a different card, and "nearest decay T-CEVAL 88%" is a caption. | Make the graph the first tab: pills with belief bands, evidence-weighted edges, upstream highlighting on hover, a "tools see" chip per critical trait, and a detection-by-level heat map [mockups/04-safety-lab.png]. |
| 10 | P1 | **Onboarding is three coach chips that never leave.** At day 700 the bar still shows "Finance: raise ceiling", "Act 2…" and "Act 3…". | Bottom bar [before/40-day700-main.jpg] | No stated goal, no first-minute explanation of the race, no explanation of controls (Space, speeds, FF targets). The scripted first finding says "a real flaw" without naming it. Hover-for-why is never taught. | Add a goals rail (Factorio-style, not forced), four coach cards, a concrete first finding, and a quarter recap card [mockups/07-onboarding.png]. |

---

## 2. Cross-cutting problems

### 2.1 Cause → effect

| Sev | Problem | Evidence | Fix |
|---|---|---|---|
| P1 | Tooltip "Why · 30 d" lists are text rows with mono numbers and no visual weight. Sources are engine labels: "drift" ×5 "weekly sum" is Scrutiny's only cause; "revenue share", "chip deposit". | [before/43-day700-tip-cash.jpg, 45-…-tip-scrutiny.jpg] | Diverging bar per cause, icons per source type, and plain labels. The engine should record named sources instead of "drift" (see PLAN §B). |
| P1 | Several meters have no ledger entries in 30 d even when they moved: board confidence, morale, valuation. The tooltip says "No recorded change". | ledger dump from the day-700 save | Instrument these in the engine, or fall back to a formula breakdown. |
| P1 | The runway colour comes from `finance.state`, which only updates quarterly. 3.5q shows **green "healthy"** while the board's own threshold for Tight is < 6q, so it flips at quarter end with no warning. | [before/43-day700-tip-cash.jpg]; `finance/board.ts:115` | Colour runway by the live thresholds (< 3 / < 6), with a "Tight on Jul 1" tag [mockups/06-finance.png]. |
| P1 | No "what changed" summary. Quarters pass under fast-forward and the player sees new numbers with no diff. | — | Quarter recap card: four meters before→after plus the top cause each [mockups/07-onboarding.png, frame 4]. |
| P2 | The bottleneck bar shows `ln M` shares (base/agents/taste/other) in a 10-px stacked bar. "compute-bound" is not linked to the control that relieves it. | [before/13-day0-tip-bottleneck.jpg] | Production chain: compute → experiments (binding) → R&D speed, with ranked levers and Go buttons [mockups/01-main.png, right rail]. |
| P2 | "Next model: training" with four unlabeled mini-bars. | right rail, all stages | Four icon gates with values; the binding one is outlined. |

### 2.2 Finding controls

| Sev | Problem | Fix |
|---|---|---|
| P1 | The nav has 12 equal items with no grouping and no indication of where action is waiting. Locked items are greyed with no "why" unless hovered. | Group by sphere (Money / Models / Safety / World), add count badges (decisions, capped channels, new findings), and show the act lock reason inline. |
| P1 | The same concept is spread across panels with no links: serving share lives in Departments (split) and Deploy (per-channel slider); security lives in Departments, Relations and Risk. | Every cause chip and lever is a link to the control ("Go" pattern). |
| P2 | Speed controls are 5 unlabeled pips and the FF menu is behind an icon; Space is undocumented. | Labeled speed buttons with key hints, and an FF target menu with plain names. |
| P2 | Save/load and prefs sit behind a hamburger next to nothing; there is no help entry. | Add a `?` help (controls + coach replay) next to the menu. |

### 2.3 Text and tables that should be visuals

| Screen | Now | Should be |
|---|---|---|
| Finance | Waterfall as 6 horizontal bars around a centre line with labels "revenue / net"; commitment ledger table of 10 firm rows | Vertical waterfall from revenue to net burn, runway gauge with zones, cash history plus projection, a ledger bar chart against the revenue line |
| Compute | Sites list with **raw floats** ("525.1043977621503 MW", "355.72666531208006 MW") overflowing the column; orders table of 12 rows | Sites map / timeline (stage, ETA, MW) with formatted numbers; orders as a delivery timeline |
| Departments | "Pipeline · cap/wk 1.6700000000000002 · 4", "privileged 3227.055556460118" | Formatted numbers; departments as cards with sphere colours; split as a draggable stacked bar |
| Models | Lineage as a text tree of 25 rows; benchmark table of 20 rows × "3.0 self"; 17 trait bands without severity colour | Lineage as a node timeline (base → versions, L on y); model card with radar plus 5 key benchmarks and a "more" link; trait belief strip coloured by severity |
| World | Sector heat table where each cell holds 3 tokens ("33% F0.9 d"); control index thresholds unlabeled | Sector tiles per region with one value per cell (detail on hover); labeled leverage thresholds |
| Relations | ~40 action buttons in 6 columns, each with 2 inline numbers and ▲T ▲C glyphs; 16 bloc rows with 3 tiny bars | Counterparty cards (trust gauge, access rung, favors) with their own 3–5 actions; blocs as a 2-D scatter (clout × approval) |
| Risk | Nine cards with an unlabeled red/yellow composition bar | Ranked bars with a driver breakdown on hover; the top-strip gauge links here |
| Deploy | Serving shares as unlabeled sliders (5% / 47% / 48%); "demand $436B · cap $130B" in the header only | Demand vs capacity bars per channel; a capacity-bound tag that links to the split |
| End | Failure modes as a run-on red/green sentence; replay rows "understanding −31.05 vs trend" | Failure-mode chips (found/missed); replay as a timeline with deltas as bars |

### 2.4 Visual language inconsistencies

- **Colour.** China (`#e2584f`) is almost the same as status red (`#ef6b6b`). Rival orange (`#f08a4b`) is almost the same as warn (`#e9b44c`): ΔE 10 normal vision, which fails the dataviz floor. Blue "you" (`#5aa9ff`) and violet "model" (`#a58cff`) are indistinguishable for deuteranopes (ΔE 1.0). The risk overlay reuses green/amber for risk while nodes use them for actors. Replace with the validated palette in `DESIGN-SYSTEM.md`.
- **Icons.** Lucide is used in the nav and top strip, but the panels are icon-less. KIND_ICON reuses AlertTriangle for both "alert" and "incident". There is no icon per trait, domain, department or actor.
- **Numbers.**
  - Inconsistent formats: `$-31.2B`, `−11.3B`, `$0.0B/yr`, `1.00×`, `0.90`, `90%` for similar things.
  - Units are missing (`F0.9 d`).
  - Floats are unrounded (see 2.3).
  - Mono vs sans is used inconsistently in rows.
- **Hierarchy.** Every section header is the same 11-px caps; every row is label-left value-right; nothing is a hero number.
- **Name collision.** Setup lets the company take a rival's name ("Meridian" in these captures), which produces two "Meridian" nodes, rows and end-screen lines [before/50-end.jpg].

### 2.5 Information overload vs missing information

- **Too much at Level 0–1.** The top strip has 9 items of equal weight, the right rail has 4 blocks, and the bottom bar has coach chips, alerts and a ticker.
  - The ticker repeats the same failed-action line ("Re-validate: A refresh is already running.") 6+ times [before/40-day700-main.jpg]. Action errors should not enter the headline ticker, and repeats must collapse.
- **Missing at Level 0.**
  - **Catastrophe risk** (34%, the outcome the game is about) is not on the main screen, only in the Risk panel.
  - **Revenue trend** is missing.
  - **The capacity crunch** (3 of 3 channels capped, $306B/yr of unmet demand) is missing.
  - **Idle chips** are missing.
  - **Morale 37** (low) is visible only in Departments.
- **Missing per decision.** The current value of each touched meter is not shown. Neither is "what happens on expiry" beyond the default label, or the cause of the event.

### 2.6 Onboarding gaps

- The start screen and setup [before/00-start.jpg, 01-setup.jpg] give 50+ preset chips (e.g. "Hawkish Gambler", "Fast diffusion") with no description, difficulty indicator or recommended path.
- Day 0 opens on the risk map with one coach chip. There is no statement of the goal, of the race, of time controls or of hover-for-why [before/10-day0-main.jpg].
- The first scripted finding (E01) says "Your safety team confirmed a real flaw in your model" and does not name the trait, version or recipe cause.
- Locked panels say "Unlocks in Act 2 · Frontier race" but not what triggers Act 2 (L ≥ 6.5 or day 150).

---

## 3. Per-screen findings

### Top strip [before/10, 30, 40-*-main.jpg]
- P0 L 0.0 / U collapse (see #1).
- P1 Race too small (see #2). P1 No catastrophe risk.
- P2 Lead "+113d · CN +175d": no name for which rival, no ± on the face. Use "nearest: DeepCent +203d" with a timer icon.
- P2 "M 1.37x" with a CPU icon: jargon at Level 0. Move it to the right rail as "R&D speed".
- P3 The act chip "A3" is cryptic. Use "Act 3 · Automation" under the date.

### Centre map (default) [before/40, 47, 48]
- P1 See #4.
- P2 Node tooltips are row lists. Clicking a rival opens Relations, not the rival.
- P2 Sector nodes are bottom-row circles with long names that collide with the frame.

### Right rail
- P2 The bottleneck stacked bar is unlabeled until hover. "+10% staff → +0.0%" is shown without saying why (AI labour 7.2M FTE vs 3.1K humans).
- P2 Obligations rows are truncated with no condition. "−10" means credibility, which is not stated.
- P2 Relations mini-web: 7 dots with "Exec 54" labels overlapping lines; the access rung is encoded as stroke width.
- P2 Rival cards: the misalignment band has no axis; "intel in Act 2" is repeated 5×.

### Bottom bar
- P1 Stale coach chips; ticker spam.
- P2 Decision chips and alert chips look alike. Deadline urgency is a coloured number only.

### Decision modal [before/41, 42]
- P1 See #8. P2 "Later" is the only escape and there are no keyboard choices. P3 "5 compute %" renders as "5 compute … %".

### Finance [before/15-day0-finance, 32-day300-finance, 46-day700-finance]
- P1 Runway state colour lags (2.1).
- P2 Raise ceiling: 3 meters with unlabeled max; "Raise $69B 2.2% dilution $69B ⚠1" button string. Board table: ▲▼ for 4 stances × 6 seats with no meaning on the face.
- P2 Ledger table: all rows "firm" with no visual of the 8-quarter load against revenue.
- P2 Debt kinds (revolver/gpuTerm/bond/vendorNote) are unexplained.

### Compute [before/32-day300-compute, 46-day700-compute]
- P0/P3 Unformatted floats in Sites MW (see 2.3).
- P1 "2.7M idle: no power" is the most consequential fact in the panel and is a caption. It needs to drive a Watch item.
- P2 Order controls are three sliders plus five buttons with inline numbers; there is no price trend chart beside the order button.

### Departments [before/15-day0-departments, 46-day700-departments]
- P0/P3 Float formatting.
- P2 Five columns of "Target" sliders with a "Set" button each (two clicks per change). Compute split: seven sliders that do not sum visibly to 100%, plus 4 preset buttons with inline numbers.
- P2 AI labour (7.2M AI FTE vs 0 human FTE) is a plain bar.

### Models [before/15-day0-models, 46-day700-models]
- P2 The lineage tree is a 25-row list; status words are coloured text.
- P2 Model card: the radar is 170 px with no reference model. The 20-row benchmark table has a "3.0 self" column of noise. Flags are a red text run.
- P2 13 action buttons under the card, all with inline costs; "Amplify", "Continual learning" and "Stop stream" are unexplained.
- P2 Paradigm tree: tier columns of text, with "Research" buttons and no prior or effect on the face.

### Run designer [before/15-day0-rundesigner, 32-day300-rundesigner, 46-day700-rundesigner]
- P1 See #6. P2 Choice labels are engine ids ("heavyHardened", "computerUse", "pressured"). The `A Scale … H Safety` letter prefixes mean nothing to the player.
- P2 "Launch post 50% compute 0.32 L ⚠1": the button encodes 4 things.

### Deploy [before/46-day700-deployments]
- P1 Demand $436B vs cap $130B in the header; per-channel capacity is not shown. Serving sliders are unlabeled.
- P2 The "Deploy" button is blocked by "Eval suite older than 30 days" in red text far from the button.

### Safety Lab [before/15-day0-safety, 32-day300-safety, 46-day700-safety, 49-trait-hover]
- P1 See #9.
- P2 The agenda "Efficacy band" has no scale. The 19-row table repeats Fund/Cut and level segments, so there are two controls for the same thing.
- P2 Technique curves are 120×34 sparklines with dashed markers explained in a header caption.
- P2 Findings log: type chips (TECH/EVAL/DISC/DEAD) are unexplained, with "Publish" on every row.

### Relations [before/15-day0-relations, 32-day300-relations, 46-day700-relations]
- P1 The 40-button action catalog is the densest screen in the game; the ▲T ▲C glyphs are not explained on the face.
- P2 The counterparty table shows rivals with trust 51 / access 0 / favors 0 in every row (noise).
- P2 Government/China ladders are dashed pips with an unlabeled end state ("Clearances", "Centralize").

### World [before/46-day700-world]
- P2 The heat table packs 3 values per cell; the binding letter (d/c) is unexplained.
- P2 Control index: thresholds are unlabeled ticks and the legend repeats "Meridian" twice.
- P3 Tech tree is a 4-column list of names with progress hairlines.

### Risk [before/32-day300-risk, 46-day700-risk]
- P2 The headline 34.3% band is the right idea but is buried. The cards' red/yellow composition bars are unlabeled; actions repeat across cards.

### End screen [before/50-end]
- P2 Score bars without a scale meaning. The failure-mode sentence is a wall of coloured text. The causal replay's "understanding −31.05 vs trend" is a unitless engine metric.
- P3 The duplicate "Meridian" row (name collision).

### Setup [before/01-setup]
- P2 There is no description or difficulty indicator per preset. "Unknown" appears as a choice in four groups with different meanings.
