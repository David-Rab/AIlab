# UI audit of the v3 panels (F6b, 2026-11-20)

Scope: every panel the model-v3 rebuild added or changed. Checked against the good-ui skill (layered information, one
home per datum, a tooltip for every term, units on every number, empty states, overflow and dead space) on the day-0,
day-400 and day-900 fixtures at 1680×1000 (screenshots from a scratch copy of the uitest harness; `npm run test:ui`
at the end).

Severity: **H** misleads the player or hides a decision; **M** costs reading effort, or is a vocabulary or unit slip on
an L1 readout; **L** polish. "Engine" = needs an engine or balance change: listed for the lead, not fixed here.

| # | Panel | Issue | Sev | Fixed? |
|---|---|---|---|---|
| 1 | All action previews (Research, Company, Products, events) | `progress` cost/gain lines all printed "L" (capability levels) whatever they meant: research-speed fractions ("+0.05 L research speed"), "% research speed" amounts read as levels ("+5.00 L"), days sooner, idle scientists, share of a run done, pool share | H | Yes: each line now carries its unit (`%`, days, scientists, project); "L" only on display-level lines (run gains, stream, post-run penalty) |
| 2 | Safety › Overview | Side column (Control, Risk families, Successor pull) ran ≈ 250 px below the race chart; the page scrolled to reach the successor card | M | Yes: Control stays on top; Risk families and Successor pull share one slot with a switch (store tab `safety.side`); the Blueprint's successor link opens it on the successor card |
| 3 | Safety › Overview › Control | Oversight row read "15% gap 0.0" (day 900; "3%" in the lead's run): the gap is to the lane's monitor, which is a *copy of the model itself*, so 0 OOM is correct but reads as "no problem" while oversight is low. Not a display bug in the number, and not an engine bug: oversight is low because containment is off (0%), believed tool detection is weak and the model is 5.4 OOM above expert humans (human review ≈ 0) | M | Yes: the row now says "self-watched" (or "gap x OOM" with its unit); the tooltip breaks oversight into blocked by containment, caught by tools and monitors, caught by human review (`believedInternalOversight`, the selector behind believed control), and names the copy with the same-lineage term |
| 4 | Models › Data | "U" meant unique tokens here and Understanding on Safety and the top strip (glossary `U`) | M | Yes: Data says "Unique" / "unique tokens" everywhere (hero, column, tooltips, previews, the delta text); glossary `uniqueTokens` retitled and says it is not understanding |
| 5 | Models › Data › Generate data | Teacher table header "G" had no tooltip | L | Yes: Term `effCompute` |
| 6 | Company › Agents at work | Monitor picker squeezed to its arrow ("‹ ∨") when the catch rate and the "same model" tag sat beside it (Routine and Frontier research lanes) | M | Yes: catch rate and the tag on a line under the picker |
| 7 | Products › Serving compute | Unmet demand was a bar segment: at day 0 (1.6M H100e cut vs a 348K pool) and day 900 (24.7M vs 2.6M) it squeezed the products to "C…", "API …", "E…"; "+1.6M" had no unit | M | Yes: the bar is the pool (products + spare); unmet demand is a dashed line under it: "+1.6M H100e of demand cut by Auto (×4.6 the pool)" with the same tooltip |
| 8 | Company › Work | Engineers' idle printed as a raw float ("idle 13337.0 team-wk/wk") | L | Yes: `F.short` (13K) |
| 9 | Models › Versions, Evals, Data, Risk families | Two versions named "Atlas-4.0-mini" at day 900 (version picker, eval bands, teacher list, family tabs) | M | No: f6a (unique version names) |
| 10 | Products (day 900), Models › Data | Consumer product starved: Chat served 2%, 0.9% share, $7M/yr; usage data +123M tokens/day at day 900 vs +116B at day 400; all products capacity-bound with 24.7M H100e of demand cut against a 2.6M pool (13% of compute) | H | No: engine / balance (serving split vs demand; known F6 item "usage data collapses") |
| 11 | Products (day 0) | At the start every product is capacity-bound (served 7–41%, 1.6M H100e demand cut vs a 348K pool): the opening shows a starved serving pool before the player has acted | M | No: engine / balance (start split or start demand) |
| 12 | Safety › Control | Control layer has no off switch; "Add control" preview line `safety.respond addControl` still uses `progress` for the control tax (prints "−0.07 L") | M | No: f6a owns the Control buttons row and `safety/actions.ts`; give the tax line `unit: '%'` (×100) there |
| 13 | Events | `safety` event "Continue" gains `L('progress', 1)` with no target ("+1.00 L": a full level for continuing a run) and RETIRE costs `progress 1` "the race goes on without you": placeholder amounts that read as capability levels | M | No: event text is lead-curated; suggest amount 0 with a target, or a qualitative unit |
| 14 | Research › Tree previews | Tree node gains `0.1 × fx.cap` as "L" (v2 placeholder scale; v3 nodes state their effect in OOM, e.g. "PHYS +1.65 OOM") | M | No: engine preview (`treeActions.ts nodePreview`): should read the node's OOM effect |
| 15 | Models › Versions (retire) | Retire preview shows "0 L option value" | L | No: preview text (models/actions.ts `retireVersion`) |
| 16 | Products, Agents at work | Danger chip "0.03 /yr" has no noun (the tooltip says harmful acts/yr) | L | No: width-bound chip; tooltip carries it |
| 17 | Products › Agents card | "Time horizon 12 h / 4 h": the "/ 4 h" (the need) is unlabelled on the card | L | No (tooltip explains) |
| 18 | World › Sectors | Sector card head "work type 2 h · v 0.8" is cryptic (the hours and v have tooltips but no labels) | L | No |
| 19 | World › Sectors › Jobs | "Displaced (US) 243" has no unit (thousands of people) | M | No: value comes as a count from the engine readout; add the unit with its tooltip in a later pass |
| 20 | Models › Evals | Measurement bands "± 0.14" and the elicitation column have no "L" on the band; "2 · 2.0×" (suites · weight) unlabelled | L | No |
| 21 | Models › Suites | "S2 0.36 … of 1" next to the bar is unclear; half the page empty below the table at 1000 px | L | No |
| 22 | Blueprint | Drawn-mix specialisation values "0" have no unit (OOM is in the tooltip); the seven top tiles are stretched to the size slider's height (≈ 120 px empty in each) | L | No |
| 23 | Research › Projects | "Science teams · why here" text is cut with an ellipsis (tooltip has it); two identical "Pretraining" rows when two teams share a project | L | No |
| 24 | Research › Recipe | Adopted rows give "+0.0059 ±0.0011" with the unit only in the card header (OOM) | L | No |
| 25 | Safety › Footholds | Empty state good ("No symptom open.", "None located."); the page is mostly empty at day 900 with no footholds | L | No (correct) |
| 26 | Company › Work | Research-engineer rows "0.0/0.0", "10.0/10.0", "9.0/rest" have no unit (team-eq is in the header and tooltip) | L | No |
| 27 | Safety › Overview | The side switch repeats the card's own title (switch "Risk families", card "Risk families") | L | No (the card titles carry the term tooltips; the switch is plain) |

Counts: H 2 (1 fixed), M 11 (5 fixed), L 14 (2 fixed). Fixed 8 of 27; engine or other-worktree items: 9, 10, 11, 12,
13, 14, 15.

Checked and fine: Research › Projects stepper and Auto (no clipping at day 400 or 900), project card sections; Products
cards (danger factors, features, settings), sector heads with share → target; World › Sectors heatmap and providers;
Data portfolio rows and previews (token units, no "L"); Suites table; Evals policy, queue, order card; Blueprint
training-pressure card; Safety › Footholds and its watch list; Agents lanes (risk badges, danger, costs). Vocabulary
checked: H100e, OOM, team-eq / team-wk, unique tokens, display level "L x.x" are now consistent across these panels.
