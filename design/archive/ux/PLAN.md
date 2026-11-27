# v2 UX implementation plan

Order: biggest clarity win per day of work first.

Scope sizes:
- **S** ≤ 0.5 day
- **M** 1–2 days
- **L** 3–5 days

All UI work lives in `src/ui/v2/**`. Engine changes are listed separately (§B) and are small and read-only, except B1 and B6.

**Keep `scripts/v2/uitest.mjs` green.** Keep every existing `data-test`, `data-nav`, `data-act` and `data-choice` attribute on the new components, and add a uitest step per milestone.

References: AUDIT.md (problems), DESIGN-SYSTEM.md (tokens, icons, components), PROPOSALS.md and `mockups/` (targets).

---

## A. Ordered UI changes

### Milestone U0: stop the bleeding (1–2 days)

| # | Change | Files | Size |
|---|---|---|---|
| U0.1 | Number formatting pass:<br>• one `fmt.ts` (money, H100e, MW, %, days, levels, signed);<br>• replace the raw floats in Compute → Sites MW, Departments pipeline and privileged count, Deploy;<br>• add a lint script that renders every panel on the 3 fixture saves and fails on `/\d\.\d{5,}/` in text. | `src/ui/v2/fmt.ts` (new), `panels/Compute.tsx`, `panels/Departments.tsx`, `panels/Deployments.tsx`, `scripts/v2/uitest.mjs` | M |
| U0.2 | Runway colour from live thresholds (q < 3 distress, < 6 tight), plus a "Tight on ‹next quarter›" tag when the next quarterly evaluation will flip state. | `shell/TopStrip.tsx`, `panels/Finance.tsx` | S |
| U0.3 | Coach chips: remove once their panel has been opened or the act has passed. Never show more than one. | `shell/AlertQueue.tsx` | S |
| U0.4 | Ticker: exclude failed-action log lines and collapse identical consecutive headlines. | `shell/Ticker.tsx`, `shell/AlertQueue.tsx` | S |
| U0.5 | ActBtn: hide the inline preview by default (full preview stays on hover); drop zero-amount lines; show the disabled reason inline in a muted line; give disabled buttons a distinct style. | `ui.tsx`, `v2.css` | S |
| U0.6 | Setup: block a company name equal to a rival's name; add a one-line description and a difficulty pip to every preset chip (tooltips from data). | `setup/Setup.tsx` | S |
| U0.7 | Show the last measured L with an "evaluating" marker when the internal agent has no eval yet (needs engine B1). | `shell/TopStrip.tsx` | S |

### Milestone U1: visual language and the main screen (≈ 8–10 days)

| # | Change | Files | Size |
|---|---|---|---|
| U1.1 | Tokens, palette and type scale from `mockups/kit.css` into `v2.css`; actor / sphere / race colours as CSS variables and a TS map. Replace `KIND_COLOR` usage in v2. | `v2.css`, `src/ui/v2/theme.ts` (new) | S |
| U1.2 | **Icon registry** `ICON[concept]` (DESIGN-SYSTEM §1). Replace ad-hoc lucide imports in v2 shell and panels; add icons to the trait, domain, agenda and actor rows. | `src/ui/v2/icons.ts` (new), all v2 files | M |
| U1.3 | Kit components: `StatChip`, `RaceMeter`, `Gauge`, `CauseChain`, `CauseBars`, `ActionCard`, `OptionTile`, `BandBar`, `HeatGrid`, `Timeline`, `Badge`, `GoButton`. Pure presentational; data via props. | `src/ui/v2/kit/*.tsx` (new) | L |
| U1.4 | **Top strip** redesign: RaceMeter hero, risk gauge, runway pips, compute idle suffix, nearest lead, scrutiny trend; labeled speed buttons; help button. | `shell/TopStrip.tsx`, `shell/SpeedControl.tsx` | M |
| U1.5 | **WhyCard v2**: value plus 30-d sparkline (from `s.series` / `store.hist`), CauseBars, Levers (Go buttons). Used by every StatChip. | `ui.tsx` (Why, WhyCard), `kit/CauseBars.tsx` | M |
| U1.6 | **Go-to-control**: `store.goto(panel, anchorId)` scrolls to and pulses the anchor; controls get `id="ctl-…"` anchors. | `store.ts`, panels | S |
| U1.7 | **Causal highlight**: `store.highlight: Set<string>`; a `useLit(key)` hook adds the `.lit` class; WhyCards set keys on hover. | `store.ts`, `ui.tsx`, shell | S |
| U1.8 | **Nav** grouped by sphere with badges (decisions per sphere, capped channels, new findings, idle chips). | `shell/Nav.tsx` | S |
| U1.9 | **Overview centre**: tabs Race / World / Flows / Risk.<br>• **Race:** frontier track (rival L estimated from your own L-history at −leadDays; see B5), race history (`s.series.Lmeasured`/`U` with gap shading and release markers).<br>• **World:** automation spread tiles, deployments in use, risk sources, control index.<br>• **Flows:** keep today's RiskMap with labeled edges.<br>• **Risk:** the RiskSources panel content. | `panels/Overview.tsx` (new), `panels/RiskMap.tsx` (becomes the Flows tab), `App.tsx` | L |
| U1.10 | **Right rail** v2: Research speed chain plus levers (from `production` and `productionWhatIf`), Next-model gates, **Watch** (rules below), Rivals. | `shell/RightRail.tsx`, `shell/watch.ts` (new) | M |

**Watch rules** (`watch.ts`). Each rule produces a chain, a consequence line and a Go target; all inputs already exist:
- idle chips > 5% → `idle ← no power` → Compute/Sites;
- any deployment `demandBound === 'capacity'` → `capped ← serving share` → Departments split;
- a critical trait with detection < 0.5 at L → `trait ← nearestDecay` → Safety tools;
- runway will flip at the quarter end → Finance;
- eval suite > 30 d on a release candidate → Models;
- board warning or BC < 40 → Finance;
- morale < 40 → Departments.

### Milestone U2: decisions and the run loop (≈ 6–8 days)

| # | Change | Files | Size |
|---|---|---|---|
| U2.1 | **Decision modal v2**:<br>• header with sphere tag and ring timer;<br>• "why this happened" chain (per-event `why(s, data)` hook in UI-side `eventWhy.ts`, falling back to the event kind's Watch rule);<br>• ActionCards with before→after (map `CostLine.currency` → current meter value via a `meterOf(s, currency)` helper);<br>• "lasting fixes" Go buttons per event kind;<br>• keys 1/2/3 (the modal captures digits; time is paused). | `shell/DecisionModal.tsx`, `ui.tsx` (ChoiceBtn → ActionCard), `shell/eventWhy.ts` (new) | M |
| U2.2 | **Run designer v2**: OptionTiles with effect glyphs (sweep `runCard` once per option on panel open, memoised by state day); level ruler; radar vs the current internal model; trait pressure (B3); main-path chain; compare strip; timeline. Hover preview ghosts the trait arrows. | `panels/RunDesigner.tsx`, `panels/runEffects.ts` (new) | L |
| U2.3 | **Models** v2: lineage node timeline, model card (big radar vs the previous version, 5 headline benchmarks, severity trait strip), actions grouped into 4 menus. | `panels/Models.tsx` | M |
| U2.4 | **Deploy**: demand-vs-capacity bars per channel (from `revenueReadout`), a capacity tag linking to the split, labeled serving shares. | `panels/Deployments.tsx` | S |

### Milestone U3: Safety, Company, Finance (≈ 8–10 days)

| # | Change | Files | Size |
|---|---|---|---|
| U3.1 | **Safety Lab** tabs (Graph · Agendas · Tools · Incidents · Findings). The graph tab has the layered pill graph with upstream highlight and an evidence card (from `traitGraph`, `beliefView`), "tools see" chips, the detection heat grid (B4), the Mis band, and the funded-agenda list. | `panels/SafetyLab.tsx`, `panels/TraitGraph.tsx` | L |
| U3.2 | **Company flow** panel: a Sankey built from `runwayOf().parts`, `poolsOf`, `idleChips`, `s.player.staff`, deployments and outputs; binding markers from `production().label`, `demandBound` and `understanding().margin`; node hover what-ifs (B2); Compare-90 d ghost widths (needs B7). A hand-laid 6-column layout; no Sankey library is needed. | `panels/Company.tsx` (new), `App.tsx`, `shell/Nav.tsx` | L |
| U3.3 | **Finance** v2: runway gauge, vertical waterfall, cash history plus projections, raise limits plus ask pills (from `actionView('fin.raise')`), ledger vs revenue, cause bars, board avatars, ownership donut. | `panels/Finance.tsx` | M |

### Milestone U4: World, Relations, Compute, onboarding (≈ 8–10 days)

| # | Change | Files | Size |
|---|---|---|---|
| U4.1 | **World**: sector tile map with a time scrubber (needs B7 for per-sector history, or sample weekly in `store.hist`), control index with labeled thresholds, jobs sparklines, tech dependency graph. | `panels/World.tsx` | L |
| U4.2 | **Relations**: counterparty cards (trust gauge, access rung, favors) with their 3–5 actions as ActionCards; blocs as a clout × approval scatter; obligations as cards with condition and break cost; China and gov ladders as labeled step tracks. | `panels/Relations.tsx` | L |
| U4.3 | **Compute**: price trend sparks next to Order, sites as a build timeline (stage, ETA, MW), orders as a delivery timeline. | `panels/Compute.tsx` | M |
| U4.4 | **Onboarding**: goals rail (data-driven list per act, checked from state); coach cards with spotlight (4 for Act 1, 1 per later act); a concrete E01 text (B6); quarter recap card (auto-pause at quarter start when the tutorial is on; diffs from `s.series`); a `?` help overlay (controls, coach replay). | `shell/Goals.tsx`, `shell/Coach.tsx`, `shell/QuarterRecap.tsx` (new), `store.ts` | M |
| U4.5 | **End screen** polish: failure-mode chips, replay as a timeline with bars, score scale labels. | `end/EndScreen.tsx` | S |

**Total ≈ 32–42 working days.** U0 and U1 alone address 7 of the 10 audit headline problems.

---

## B. Engine work (selectors read-only; B1 and B6 touch game code)

What already exists and covers most needs:
- **Cause ledger:** `causeStrip(s, key, days, top)` over the CAUSE_KEYS meters.
- **Production:** `production(s, lab)` with `parts`, `elast`, `perDollar`, `whatIf`, `ceilings`, `label`, `labor`; `productionWhatIf`; `nextModelGate`.
- **Finance:** `runwayOf` with parts; `raiseCeiling` with parts and bound; `ledgerDue`; `liveLedger`; `debtHeadroom`.
- **Risk and intel:** `riskSources` with drivers and bands; `leadDays`.
- **Safety:** `understanding` with `perTrait`; `nearestDecay` (exported via `safetyView`); `traitGraph` with edge weight, grade, cite and moderator; `beliefView`.
- **Runs:** `runCard` (band, domains, signals, ETA, cash, monitorability).
- **Previews:** `actionView`, `choiceView` (costs, gains, exposure with lag and probability).
- **World:** `revenueReadout`, `leverageAll`.
- **Weekly series:** `s.series` holds L, U, M, cash, revenue, compute, approval, trustGov, scrutiny, gdpG, unemp and misEst.

| # | Need | Proposal | Kind |
|---|---|---|---|
| **B1** | **L 0.0 / U collapse bug** (AUDIT #1) | `measuredL()` and `understanding()`: when the internal version has no `measuredL`, use the most recent measured L in its lineage (or `bestMeasuredL`), and expose `evaluating: true`. Add a regression test: U must not drop by more than 1.5 in a week from an internal-agent switch alone. | engine fix (WS1/WS2) |
| **B2** | U "why it moved" and levers | `understandingBreakdown(s)`: per detection tool its contribution to mean detection at L (with and without the tool), `decay`, `trainedAgainst` mask, plus a weekly ledger key `understanding.U` recorded with named sources (tool decay, agent switch, technique unlocked, refresh done, mask formed). The UI renders CauseBars and levers from it. | selector + ledger instrumentation |
| B3 | Run trait pressure | `runTraitPressure(s, params)`: Δsignals (recipe vs reference) propagated through `traitGraph` edges (first and second order), plus the post-run heal and moderator multipliers that are not in signals (safety level, inoculation, constitution), so that **every option shows an effect**. Export the internal `postEffect`/`baseEffect` summaries (read-only). | selector |
| B4 | Detection-by-level heat | `detectionAt(s, versionId, trait, L)`, a thin export over the private `detector()` in `safety/understanding.ts`. The mockup data was produced by cloning state and varying `measuredL`; the export avoids that. | selector |
| B5 | Rival level for the frontier track | No engine change: estimate rival L as your own `series.Lmeasured` at `day − leadDaysEst` (± `leadDaysSd`). Optional: `intelLevel(s, lab)` if intel later tracks L directly. | UI helper |
| B6 | Concrete first finding | E01 text names the trait, version and recipe cause from the forced finding (`data` already carries the finding). | content (WS2/WS4) |
| B7 | History for ghosts and scrubbers | Add `series.sectorsA` (weekly region × sector A, 14×3 floats) and `series.pools` (7 floats) for World replay and Company "Compare 90 d". Small save growth (~30 KB over 3 years). | series extension |
| B8 | Ledger sources too coarse | Scrutiny is recorded as "drift"; board confidence, morale and valuation are sparse. Record named sources at the existing bump sites (release, incident, raise, quarterly review). Rename source strings to player words ("chip deposit" → "Chip order deposit"). | instrumentation |
| B9 | Decision "why" data | Optional `why?(s, data): {label, kind}[]` on `EventDefV2`, returning cause-chain steps. Start with the 10 most frequent events (E36 capacity crunch, E17 red flags, E37 board revolt, …). Otherwise the UI falls back to the Watch rule for the event's kind. | content hook |
| B10 | Meter values for before→after | UI helper `meterOf(s, currency)` mapping each `CostLine.currency` to the current value (cash → `finance.cash`, approval → `pub.approval`, compute → `computeOnline`, …). No engine change. | UI helper |

## C. Risks and notes

- **Performance.** The run designer sweeps about 20 `runCard` calls on open. Measure: if it exceeds 10 ms, memoise per day and recompute only on hover. Overview charts read `s.series` (≤ 160 weekly points per series), which is cheap.
- **Tutorial gating.** The new panels (Overview tabs, Company) respect `UNLOCK_ACT`: Company in Act 1 with compute nodes greyed until Act 2; World tab in Act 3.
- **The palette change is global.** Do U1.1 in one commit, then visually diff every panel with a small screenshot script. The mockup build pipeline (Edge plus playwright) is already proven; reuse `scripts/v2/uitest.mjs` shots.
- **Data honesty.** Every estimate (rival L, U projection, risk) carries its band or ±. Truth never enters these views (keep `lint-hidden.ts` covering the new files).
