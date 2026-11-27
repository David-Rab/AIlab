# Data centres and power: build tasks (DC)

Branch `dc`, worktree `C:\Users\david\Documents\projects\AI27-dc` (node_modules = junction; never `npm install`).
Spec: [DATACENTERS.md](DATACENTERS.md) (approved 2026-11-27). Mockup: `design/ux/mockups/dc/build.png`, `build-tips.png`,
`NOTES.md`, `build.js` (the injected markup and CSS are the UI reference). Data: research/23 §0, §2.
Scope: sites and power only. Financing (pay options, capex leases, debt), chip market and cloud rental stay as they are,
except the 6% stored-chip book decay, which goes.

## Protocol (all tasks)

- One concern per task, one agent, its own worktree and branch off `dc` (`AI27-dc-<id>`, branch `dc-<id>`) when it runs
  in parallel with another task; the lead merges. Sequential tasks may run in the `dc` worktree.
- **Shared files: report, don't edit**: `src/engine/v2/core/save.ts` (schemaRev), `scripts/v2/fixtures/*`,
  `design/LIMITS.md`, this file. Saves may break: no migrations; the lead bumps `SCHEMA_REV` once at the merge.
- Tests per task: `npx tsc --noEmit -p .` and `npx tsc --noEmit -p scripts/v2`, plus the task's own check script
  `scripts/v2/_dc<N>/check.ts` (run with `npx tsx`). Never `test:full`, `test:deep`, `test:perf`, `test:cal`. A UI task
  also runs `npm run build` and looks at its screenshots. Tests failing mid-way is information, not a gate; never fake a
  number to pass a check.
- Rules: no harness-only or forcing mechanics; previews must match effects (same function computes both); UI is
  player-only (no dev state, no "will change"); every new term has a glossary entry (DC-11).
- Output of every task: commits on its branch (message ends `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  or the Sonnet line the harness gives), a results file `design/dc/DC-<N>.md` (what changed, [D] choices, numbers its
  check printed, anything for later tasks) and a ~15-line report to the lead.
- Stop and ask (all tasks): the change needs more than the files listed; a spec number below contradicts DATACENTERS.md;
  a test the task does not own newly fails and cannot be explained.

## Decisions taken for this plan (confirmed by the lead 2026-11-27; marked **[D-n]** where used)

- **[D-1] Waits are a pure function, no queue state.** For each source, the outside world is a reference path: outside
  GW = refWait(t) × rate(t) / 4, so with the player building nothing the wait equals the DATACENTERS.md §4 table
  exactly. Actual wait = 4 × (outside GW + your pending GW) / rate(t) = refWait(t) + 4 × yourPendingGW / rate(t).
  Rivals count only through the outside path (they have no sites). Only new state: a quarterly history of the three
  waits for the tooltip sparkline.
- **[D-2] Rates (GW per year), all [design]:** grid connections 30 GW/yr in 2026, ×1.10/yr (mockup's 150 GW queue ÷ 30;
  ERCOT energises 4–16 GW/yr, Dominion ~12 GW under contract: national middle); turbines delivered 60 GW/yr in 2026,
  ×1.12/yr (GE Vernova ~20 GW/yr shipped, Siemens Energy similar, plus MHI and small units; DATACENTERS "+10–15%/yr");
  halls finished 6 GW/yr in 2026, ×1.30/yr (CBRE: 7.5 GW under construction in primary markets ≈ 3.7 GW/yr, about as
  much again in wholesale AI campuses; supply +33.7% y/y). Effects: +1 GW grid ≈ +0.13 q in 2026 (+0.18 q in 2023);
  +1 GW gas ≈ +0.07 q; +1 GW rent ≈ +0.67 q (renting big is slow).
- **[D-3] Reference table points sit at 1 January of each year**, linear between, flat before 2023 and after 2030. Game
  start 2025-07-01 reads grid 19 q, turbines 8.5 q, rent 3.5 q; Q3 2026 reads 20 / 9 / 4 (the mockup's). A 2023 start
  (medium vision) works unchanged.
- **[D-4] Power clocks start when permits end** (grid and gas); rent's clock starts at commitment. Live = permits +
  max(construction, power). Construction starts at live − construction. A site's power wait is fixed at commitment as
  whole quarters: grid max(1, round(W × (rush ? 0.75 : 1))); gas rush ? min(round(W), 4) : max(1, round(W)); rent
  max(1, round(W)). The wait used is today's, before the new site is added.
- **[D-5] (changed 2026-11-27 by the designer: rushed gas sites DO count in the turbine backlog; see DC-12.)** ~~Rushed gas sites (used turbines) are not in the turbine backlog~~; rushed grid sites stay in the grid queue.
  A site counts in its queue from commitment until its power is ready (rent: until live); blocked sites drop out.
- **[D-6] Opposition odds** (grid / gas; rent none): block 5% / 10%, delay 20% / 30%, both × public mood
  (pub.dcNimby ÷ 50; 0.9 at the 2025 start, ≈1.2 at day 400), × 1.5 with crash construction; block × 0.5 with the
  community package; block ≤ 0.5, delay ≤ 0.9 − block; delay 1–3 q uniform. Label: block < 4% low, < 10% medium,
  ≥ 10% high. (Mockup's delay "30%" was illustrative; with mood it reads 35%.) Rolled at the end of permits; fast-track
  grid (0 q permits) rolls at commitment.
- **[D-7] Money:** every lever's price folds into the site capex; 5% of capex at commitment, nothing while waiting for
  power, the rest in equal parts over the construction quarters, any remainder at go-live (rent: 5% at commitment, the
  rest at go-live). **A block loses what was paid** (normally the 5% upfront, ≈ $0.9B on the mockup's gas site; the
  mockup says ≈ $1.0B). E27 (Site blocked event) stays as it is: its rescue re-permits and the site keeps its fixed
  power wait, counted from the new end of permits.
- **[D-8] Capacity price κ dropped.** Trade-off: κ was the only running-cost signal of a crowded grid; the waits now
  carry that signal and κ hung off the removed grid pool. Power costs fall ~5% at the start.
- **[D-9] Site.path renamed `'lease'` → `'rent'`** (it clashed with the financing lease `pay: 'lease'`). The path union
  becomes `'rent' | 'grid' | 'gas'`. Stage names stay (`permitting | power | building | live | blocked`); `power` now
  means "waiting for power, construction not started".
- **[D-10] Start sites follow the mockup:** Red River becomes 1.0 GW grid, permits done at the start, 17 q wait, live
  Q4 2029, construction from Q4 2027 (today: 2 GW, live ≈ 2028). This moves the leader's 2028–29 compute (calibration:
  yes). Lone Pine keeps its start capex ($12B × k, half paid); only path fields change.
- **[D-11] Tooltip queue rows: "you" + one "everyone else" row** (lead, 2026-11-27). No "other AI labs" split: rivals have no sites, so a split would be an invented number.
- **[D-12] Rent price $1.8B per GW-year** for new rent sites and for start colocation (leader S1, challenger), replacing
  $1.2B. Size minimum 100 MW for every source.

## Tasks

| ID | Title | Model | Depends on | Moves calibration |
|---|---|---|---|---|
| DC-1 | Source, lever and wait tables (data only) | Sonnet medium | — | no |
| DC-2 | World waits module (pure functions) | Sonnet high | DC-1 | no |
| DC-3 | Site state and lifecycle rebuild; remove pool, transformers, overlap, κ | Opus high, reason (c) | DC-2 | yes |
| DC-4 | Build action: levers, preview = effect, community price; transformer action gone | Sonnet high | DC-3 | maybe |
| DC-5 | Start sites and start ledgers mapped to rent / grid / gas | Sonnet medium | DC-3 | yes |
| DC-6 | Remove the 6% stored-chip book decay | Sonnet medium | — | maybe |
| DC-7 | Player bot (finance/plan.ts) on the three sources | Sonnet high | DC-4 | yes |
| DC-8 | Existing finance checks restated for the new sites | Sonnet high | DC-4, DC-5 | no |
| L1 | Lead: merge engine lane, regenerate fixtures | lead | DC-1…8, DC-11 | — |
| DC-11 | Glossary: new site and power terms, retired terms | Sonnet medium | — | no |
| DC-9 | Compute tabs + Sites section (campus rows) under the chart | Sonnet high | L1, DC-17 | no |
| DC-10a | Build card: size tiles, Buildings row, power tiles, their tooltips | Sonnet high | DC-9 | no |
| DC-10b | Build card: speed-up options row, preview lines, opposition tooltip | Sonnet high | DC-10a | no |
| DC-12 | Size scaling: construction time, economies of scale, rushed gas in the backlog | Sonnet high | DC-7, DC-8 | yes |
| DC-13 | Campuses: buildings 1/3/5, phased go-live, repetition discount | Opus high, reason (c) | DC-12b | yes |
| DC-14 | Player bot builds campuses | Sonnet high | DC-13 | yes |
| DC-17 | Engine: capex / opposition breakdowns, siteFit, per-building view, exports | Sonnet high | DC-13 | no |
| DC-15 | Per-building financing lease | Sonnet high | DC-13 | no |
| DC-16 | Cleanup: leftovers, Lone Pine campus, one sites suite | Sonnet high | DC-15, DC-17 | slightly |
| CP | Lead: final checkpoint | lead | all | — |

Opus share: 2 of 15 agent tasks (DC-3, DC-13) ≈ 13%.

**Lanes.** Engine lane (sequential, `dc` worktree): DC-1 → DC-2 → DC-3 → DC-4 → DC-5 → DC-8. In parallel worktrees:
DC-6 and DC-11 at any time (DC-6 touches `deals.ts` MARKET only and one glossary line; trivial merges); DC-7 after DC-4
(only `finance/plan.ts`); DC-5 may run beside DC-4 (it edits only `initialSites` in sites.ts, plus starts.ts, ledger.ts).
UI lane after L1 and DC-17, sequential (one file, Compute.tsx): DC-9 → DC-10a → DC-10b. DC-17 may run beside DC-14.

---

### DC-1 Source, lever and wait tables (data only)

- **Model:** Sonnet medium. **Budget:** 20 min. **Moves calibration:** no (nothing reads the new tables yet).
- **Goal:** all DATACENTERS.md numbers in one data block, next to the old ones (old ones are removed in DC-3).
- **Write:** `src/data/v2/deals.ts` only.
- **Read:** deals.ts 105–157; DATACENTERS.md §2–§5; this file [D-2], [D-3], [D-6], [D-12].
- **Spec** (add, with source comments as below; keep `FACILITY_PER_GW = 10`, `NETWORK_PER_GW = 4`):
  ```ts
  export type SiteSource = 'rent' | 'grid' | 'gas';
  /** Building = facility $10B + network $4B per GW (Epoch May 2026: $11.4B/GW IT facility + $4.9B network). */
  export const BUILDING_PER_GW = FACILITY_PER_GW + NETWORK_PER_GW; // 14
  export interface SourceDef { permitQ: number; buildQ: number; maxMW: number; upfrontPerGW: number;
    extraPerGW: number; powerCostMult: number; blockBase: number; delayBase: number }
  export const SOURCES: Record<SiteSource, SourceDef> = {
    // rent: hall in a colo/neocloud campus; you pay the network ($4B/GW); landlord builds; no opposition
    rent: { permitQ: 0, buildQ: 0, maxMW: 1000, upfrontPerGW: NETWORK_PER_GW, extraPerGW: 0, powerCostMult: 1, blockBase: 0, delayBase: 0 },
    // grid: building + utility upgrades $0.2B/GW [unverified, range 0.05–0.3]; EIA tariff 1.0×; largest live grid sites ≤ ~1 GW (Epoch hub)
    grid: { permitQ: 1, buildQ: 8, maxMW: 1000, upfrontPerGW: BUILDING_PER_GW, extraPerGW: 0.2, powerCostMult: 1, blockBase: 0.05, delayBase: 0.2 },
    // gas: building + turbines $3B/GW ($1.7–2.0k/kW × 1.4–1.6 overbuild, SemiAnalysis); fuel+upkeep 0.5× grid [needs a gas-price source]; campuses 2.3–5.2 GW
    gas: { permitQ: 2, buildQ: 8, maxMW: 5000, upfrontPerGW: BUILDING_PER_GW, extraPerGW: 3, powerCostMult: 0.5, blockBase: 0.1, delayBase: 0.3 },
  };
  export const SITE_MIN_MW = 100;
  /** Speed-ups (DATACENTERS §5). */
  export const LEVERS = {
    crash: { buildQ: 4, buildingShare: 0.35, oddsMult: 1.5 },      // Colossus 2 in ~4 q (Epoch); premium, odds [design]
    rushGrid: { waitMult: 0.75, perGW: 0.3 },                         // self-built substation (LBNL Speed to Power 2026) [design]
    rushGas: { waitQ: 4, turbineShare: 0.3 },                         // used/refurbished turbines < 12 months (SemiAnalysis) [design]
    fastTrack: { permitQ: 1, buildingShare: 0.05 },                   // EO 14318 FAST-41 for > 100 MW [design price]
    community: { perGW: 1.0, blockMult: 0.5 },                        // NY Community Investment Framework $1M/MW (Sep 2026); effect [design]
  } as const;
  /** Rent ≈ $150/kW-month = $1.8B per GW-year (CBRE H1 2026 $139–185; Applied Digital leases); 5-year lease. */
  export const RENT = { perGWYear: 1.8, years: 5 } as const;
  /** Waits with the player building nothing (DATACENTERS §4), quarters, at 1 January of each year [D-3]. */
  export const WAIT_REF = { years: [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030],
    grid: [12, 16, 18, 20, 20, 17, 13, 10], gas: [4, 6, 8, 9, 9, 8, 7, 6], rent: [1, 2, 3, 4, 4, 4, 4, 4] } as const;
  /** What clears each queue, GW per year in 2026 and growth per year [D-2, design]. */
  export const WAIT_RATE: Record<SiteSource, { gwPerYear2026: number; growth: number }> = {
    grid: { gwPerYear2026: 30, growth: 1.1 }, gas: { gwPerYear2026: 60, growth: 1.12 }, rent: { gwPerYear2026: 6, growth: 1.3 } };
  /** Opposition: public mood = pub.dcNimby ÷ 50; caps [D-6]. */
  export const OPPOSITION = { moodRef: 50, blockMax: 0.5, delayMax: 0.9, delayQ: [1, 3] } as const;
  ```
- **Done when:** both tsc pass; nothing else changed.
- **Test:** tsc only (data). **Output:** `design/dc/DC-1.md`.

### DC-2 World waits module (pure functions)

- **Model:** Sonnet high. **Budget:** 30 min. **Moves calibration:** no (nothing calls it yet).
- **Goal:** one module computes the grid, turbine and rent waits and their breakdown for the tooltips [D-1].
- **Write:** new `src/engine/v2/compute/waits.ts`; export it from the engine barrel (`src/engine/v2/index.ts`, one line);
  `scripts/v2/_dc2/check.ts`.
- **Read:** DC-1's block in deals.ts; `src/engine/v2/core/time.ts` 30–40 (`decimalYear`, `decimalYearOf`).
- **Spec:**
  ```ts
  /** A site as the queues see it (structural, so this compiles before and after DC-3). */
  export interface QueueSite { path: string; mw: number; stage: string; ws3: { powerDay?: number; rush?: boolean } }
  export function refWaitQ(src: SiteSource, year: number): number   // WAIT_REF, linear between 1 Jan points, flat outside 2023–2030
  export function rateGWPerYear(src: SiteSource, year: number): number // gwPerYear2026 × growth^(year − 2026)
  export function outsideGW(src: SiteSource, year: number): number   // refWaitQ × rate / 4
  /** Your GW in the queue on `day`: path === src, stage not 'live'/'blocked', not (gas && ws3.rush),
   *  and (ws3.powerDay undefined or > day). Rent: every rent site not live. */
  export function pendingGW(sites: readonly QueueSite[], src: SiteSource, day: number): number
  export function waitQ(src, year, yourGW): number                   // refWaitQ + 4 × yourGW / rate  (= 4 × (outside + yours) / rate)
  export function worldWaitQ(s: GameStateV2, src: SiteSource): number // waitQ(src, decimalYear(s), pendingGW(s.player.sites, src, s.time.day))
  export interface WaitBreakdown { src; waitQ; refQ; youGW; you: { name: string; gw: number }[]; othersGW; rateGWPerYear; perGWQ }
  export function waitBreakdown(s: GameStateV2, src: SiteSource): WaitBreakdown
  // othersGW = outside (one "everyone else" row, [D-11]); perGWQ = 4 / rate (what +1 GW adds)
  ```
- **Expected numbers (check.ts prints and asserts, tolerance 1e-9 unless stated):** no sites: grid 2023.0 → 12,
  2024.0 → 16, 2025.5 → 19, 2026.0 → 20, 2030.0 → 16, 2032.0 → 16, 2021.0 → 12; gas 2025.5 → 8.5, 2026.0 → 9;
  rent 2025.5 → 3.5, 2026.0 → 4. outsideGW(grid, 2026.0) = 150. With yours: grid +1 GW at 2026.0 → 20.1333;
  gas +5 GW at 2026.0 → 9.3333; rent +1 GW at 2026.0 → 4.6667. pendingGW: a rushed gas site counts 0; a grid site whose
  powerDay ≤ day counts 0; a blocked site counts 0.
- **Done when:** tsc passes; check.ts passes. **Stop and ask:** if `decimalYear` is not calendar-based.
- **Output:** `design/dc/DC-2.md`.

### DC-3 Site state and lifecycle rebuild (removals included)

- **Model:** Opus high, reason (c): cross-cutting change through core engine state (Site, PowerGrid, market ws3), the
  quarterly site step and every caller; it removes four mechanisms at once.
- **Budget:** 90 min. **Moves calibration:** yes (site timing, gas power price, κ gone).
- **Goal:** sites follow DATACENTERS §3 with the waits from DC-2; grid pool, queue credit, κ, transformer stock and
  lead time, overlap, the random power draw, brownfield, nuclear and the lease pool are gone from the engine.
- **Write:** `src/engine/v2/types.ts` (Site, SiteWS3, PowerGrid, PowerWS3, CapitalMarkets.leasePoolGW),
  `src/engine/v2/finance/ext.ts`, `src/engine/v2/compute/sites.ts` (all but `initialSites`, which gets renames only),
  `src/engine/v2/compute/power.ts`, `src/engine/v2/compute/forecast.ts`, `src/engine/v2/core/limitsView.ts` (siteSizeView),
  `src/data/v2/deals.ts` (delete SITE_PATHS, PathDef, LEASE, TRANSFORMER, BUILD_Q's crash/community/lease fields; keep
  `BUILD_Q.upfront = 0.05` or move it to a `SITE_UPFRONT` constant), and **compile-only** edits (renames and deletions,
  no new behaviour) in `finance/actions.ts` (delete the `cmp.preorderTransformers` ActionDef and its registration, lease-
  pool lines; `siteOpts` default path 'gas'), `finance/plan.ts` (path 'brownfield' → 'gas', delete the transformer
  lines), `core/starts.ts` and `initialSites` (path renames only), `ui/v2/panels/Compute.tsx` (PATHS to rent/grid/gas,
  delete the grid-pool/transformer KVs and pre-order button, drop `leaseGW` from the limit chip), `scripts/v2/finance.ts`
  (delete line 303, rename paths), `scripts/v2/_dc3/check.ts`. If more files fail to compile: stop and report.
- **Read:** sites.ts (all, 288 lines); power.ts; forecast.ts 1–60, 78–140; types.ts 1712–1735, 1930–1995; ext.ts 20–50;
  capex.ts 70–92; actions.ts 627–731; events/catalog/company.ts 55–95 (E27).
- **State (exact):**
  - `Site.path: SiteSource` (`'rent' | 'grid' | 'gas'`) [D-9]. Other Site fields unchanged.
  - `SiteWS3`: remove `queuedDay`; add `powerQ: number` (fixed at commitment [D-4]), `rush?: boolean`,
    `fastTrack?: boolean`, `powerDay?: Day` (power ready), `liveAt?: Day` (planned go-live, set at the roll).
    `buildQ` = 0 rent, 8, or 4 with crash. Keep `rolled, delayedQ, lease, reactive, startDay, buildStartDay, liveDay`.
  - `PowerGrid = { kWPerH100e: number; waitHist: Record<SiteSource, number[]> }` (one value per quarter since the start,
    rounded to 0.1). Delete `poolGWPerQ, queue, capacityPrice, transformerLeadQ, ws3`, the `PowerWS3` type,
    `defaultPowerWS3`, and `CapitalMarkets.leasePoolGW` (+ its default in ext.ts). `initialPower()` returns
    `{ kWPerH100e: 0.93, waitHist: { grid: [], gas: [], rent: [] } }`; init.ts's `queue: []` override goes.
- **Functions (sites.ts):**
  - `SiteOpts { path: SiteSource; mw; crash?; rush?; fastTrack?; community?; pay?; leaseRate?; region?; name? }`. For
    rent, crash/rush/fastTrack/community are forced false.
  - `sitePermitQ(o) = max(0, SOURCES[path].permitQ − (fastTrack ? 1 : 0))`; `siteBuildQ(o) = rent 0 : crash 4 : 8`.
  - `sitePowerQ(s, o)` per [D-4] using `worldWaitQ(s, o.path)` (today's wait, before the new site).
  - `siteLiveInQ(s, o) = sitePermitQ + max(siteBuildQ, sitePowerQ)` (rent: `sitePowerQ`). Replaces `siteEtaQ` (keep the
    old name as an alias only if removing it breaks more than the files above).
  - `siteCapex(o) = GW × (upfrontPerGW + extraPerGW + (crash ? 0.35 × 14 : 0) + (rush ? (grid 0.3 : gas 0.3 × 3) : 0)
    + (fastTrack ? 0.05 × 14 : 0) + (community && !rent ? 1.0 : 0))`.
  - `oppositionOdds(s, site)` per [D-6] (inputs: path, crash, communityPackage, ws3.reactive; keep the E27 reactive
    branch and `reactiveUnblockOdds` unchanged). Add `oppositionLevel(block): 'low' | 'medium' | 'high'`.
  - `addCommunityPackage(site)`: same guards; `capex += GW × LEVERS.community.perGW`.
  - `siteSchedule(s, o) = { etaQ: siteLiveInQ, buildQ: siteBuildQ, firstNow: etaQ === buildQ }` (capex.ts unchanged).
  - `newSite(s, ctx, o)`: mw clamped to [SITE_MIN_MW, maxMW]; q = qOf(s); store powerQ, rush, fastTrack, buildQ;
    pay 5% of capex now (existing payCapex). Rent: stage 'power', `stageEndDay = powerDay = dayOfQuarter(q + powerQ)`,
    rolled true, ledger entry `L-rent-<id>` payee 'Data-centre rent', `perQuarter = GW × RENT.perGWYear / 4`,
    from go-live for `RENT.years` (non-cancellable, as the old colocation entry). Grid/gas: stage 'permitting',
    `stageEndDay = dayOfQuarter(q + permitQ)`; if permitQ = 0 call the roll step at once (same function as sitesQ).
  - Roll and schedule (at the first sitesQ on/after the permit end; `pq` = quarter index of `stageEndDay`): roll as today
    (block → stage 'blocked', log + headline, money paid is lost [D-7]; delay d ∈ 1–3 → `delayedQ += d`,
    `stageEndDay = dayOfQuarter(pq + d)`, stay in permitting, rolled true). When permitting ends un-blocked:
    `powerDay = dayOfQuarter(pq + powerQ)`, `liveAt = dayOfQuarter(pq + max(buildQ, powerQ))`,
    `buildStart = dayOfQuarter(pq + max(buildQ, powerQ) − buildQ)`. If buildStart ≤ today: stage 'building',
    `stageEndDay = liveAt`, `buildStartDay = today`; else stage 'power', `stageEndDay = buildStart`.
  - 'power' due: grid/gas → 'building' (`stageEndDay = liveAt`, `buildStartDay`); rent → live.
  - 'building': each quarter pay `(capex − paid) / quartersLeft`; due → live: pay the rest, `liveDay`, financing-lease
    ledger as today.
  - Delete `tri`, `leaseAvailableGW`, `enterBuilding`'s transformer gate, grid-pool and κ code, the old `siteEtaQ` body.
  - `sitesQ` run: kW efficiency step unchanged; append `round1(worldWaitQ)` for the three sources to `power.waitHist`
    (every quarter including q = 0); step sites; install inventory.
- **power.ts:** `powerAndOMPerYear` uses `SOURCES[path].powerCostMult`; delete the `(1 + capacityPrice)` factor [D-8].
- **forecast.ts:** `siteLiveQ`: blocked → undefined; live → as today; otherwise `firm = rolled`; permitting:
  `max(q0, quarter(stageEndDay)) + max(buildQ, powerQ)` (rent: quarter(stageEndDay)); power/building: quarter of
  `liveAt` (rent: stageEndDay). Add `siteBars(s, site)` → `{ permits?: [startQ, endQ]; power?: [fromQ, readyQ];
  construction?: [fromQ, liveQ]; liveQ; firm }` in quarter indices (for DC-9; planned values from the same rules).
- **limitsView.ts:** `siteSizeView(s, path) = { min: SITE_MIN_MW, max: SOURCES[path].maxMW }`.
- **Worked example (check.ts asserts):** new game, set `s.time.day` to 2026-08-05 (Q3 26), `pub.dcNimby = 0` (no rolls
  fire), Red River as it is in the start state. Gas 1 GW, rush + community: powerQ 4, live in 2 + max(8, 4) = 10 q
  (Q1 29), capex 14 + 3 + 0.9 + 1.0 = 18.9, paid now 0.945; ticking quarterly: permits end Q1 27, stage 'building' from
  Q1 27 (power 4 < 8), equal payments over 8 quarters, live Q1 29 with capexPaid = 18.9. Grid 1 GW, rush: wait 20 +
  (pending grid GW × 4 / 31.8) → powerQ round(× 0.75) = 15; permits end Q4 26, live Q4 26 + 15 = Q3 30 (16 q),
  stage 'power' until Q3 28, then building to Q3 30. Rent 1 GW: live 4 q (Q3 27), 'Data-centre rent' entry $0.45B a quarter from go-live. Fixed wait: add 20 GW
  of grid after the first grid site; its liveAt is unchanged, a new grid site's powerQ is ≥ 2 q longer. Block: force
  `rng` (or dcNimby 100 on many sites) and check a blocked site leaves `pendingGW` and keeps `capexPaid` as spent.
- **Done when:** both tsc pass; check.ts passes; `grep -rn "brownfield\|nuclear\|transformer\|poolGWPerQ\|poolLeftGW\|leasePoolGW\|capacityPrice\|overlapQ\|usesGridPool\|queuedDay" src` finds only glossary text (DC-11's) and comments you list in the results file.
- **Stop and ask:** E27 needs a mechanism change; the forecast chart's planned capacity needs more than `siteLiveQ`.
- **Test scope:** tsc + check.ts. Report fixtures as stale (the lead regenerates them at L1). **Output:** `design/dc/DC-3.md`.

### DC-4 Build action: levers, preview = effect, community price

- **Model:** Sonnet high. **Budget:** 45 min. **Moves calibration:** maybe (community package price 3% → $1B/GW).
- **Goal:** `cmp.newSite` takes the four speed-ups; its preview is computed by the same functions as the site it makes;
  the community action charges $1B per GW; the engine gives the UI each lever's saving and price.
- **Write:** `src/engine/v2/finance/actions.ts` (627–731 region), `src/engine/v2/compute/sites.ts` (append
  `leverEffects` only), engine barrel export, `scripts/v2/_dc4/check.ts`.
- **Read:** actions.ts 627–731; sites.ts after DC-3; DC-3 results file; DATACENTERS §5.
- **Spec:**
  - `siteOpts(s, p)`: params `path` ('rent' | 'grid' | 'gas', default 'gas'), `mw` (clamped [100, maxMW]), `crash`,
    `rush`, `fastTrack`, `community` (default company policy; false for rent), `pay` (rent: always cash).
  - preview: rent → costs `[rent per year × 5 (non-cancellable): −GW × 1.8]`, `[network fit-out: −capex]`; grid/gas cash →
    `[capex on the build schedule: −capex, lagDays = liveInQ × 91]`; lease pay as today. Gains: compute H, lagDays =
    liveInQ × 91. Exposure: block/delay from `oppositionOdds` (as today). Delete the lease-pool exposure.
  - apply: no pool cap; `newSite(s, ctx, o)`.
  - `leverEffects(s, o)` → for `crash | rush | fastTrack | community`: `{ on, savesQ, cost }` where savesQ =
    liveIn(o with lever off) − liveIn(o with lever on) and cost = capex(on) − capex(off), the other toggles as given
    (NOTES open question 1). Community: savesQ 0, plus `blockMult 0.5`. Empty for rent.
  - `cmp.community` preview and apply: cost per site = GW × 1.0; text "$1B per GW on N sites".
- **Expected (Q3 26 = 2026-08-05, dcNimby 58.8, start state):** gas 1 GW, rush + community: preview capex −18.9, gain lag
  910 d (10 q); leverEffects given rush + community on: crash −4 q +$4.9B (2 + max(4, 4) = 6); rush −1 q +$0.9B
  (without it 2 + max(8, 9) = 11); fast-track −1 q +$0.7B (1 + 8 = 9); community +$1.0B, block ×0.5.
  Opposition: block 0.10 × 1.176 × 0.5 = 5.9%, delay 0.30 × 1.176 = 35.3%.
- **Done when:** check.ts: for every source × each lever on/off (2 sizes), preview capex = created site's capex and the
  preview lag quarter = the created site's live quarter (no rolls: dcNimby 0); the numbers above.
- **Test scope:** tsc + check.ts. **Output:** `design/dc/DC-4.md`.

### DC-5 Start sites and start ledgers

- **Model:** Sonnet medium. **Budget:** 30 min. **Moves calibration:** yes ([D-10], [D-12]).
- **Write:** `initialSites` in `src/engine/v2/compute/sites.ts` (that function only), `src/engine/v2/core/starts.ts`,
  `src/engine/v2/finance/ledger.ts` (the L-lease-S1 entry), `scripts/v2/_dc5/check.ts`.
- **Read:** sites.ts 11–23; starts.ts 10–55; ledger.ts 10–25; NOTES.md "Sites = the fixture's four, translated".
- **Spec (leader, `k` kept):**
  - S1 Abilene North: rent, 300 MW, live, capex 0, `liveDay = day of 2024-01-01`, buildQ 0, powerQ 1.
  - S2 Abilene South: grid, 300 MW, live, capex = capexPaid = 0.3 × 14.2 = 4.26, `liveDay = 2024-07-01`.
  - S3 Lone Pine: gas, 1200 MW, building to 2026-04-01, capex 12k, paid 6k (unchanged), powerQ 0,
    `powerDay = liveAt = 2026-04-01`.
  - S4 Red River: grid, **1000 MW**, stage 'power', rolled true, powerQ 17, buildQ 8, `powerDay = liveAt = 2029-10-01`,
    `stageEndDay = 2027-10-01` (construction from Q4 27), capex 14.2k, capexPaid 0.05 × capex (paid before the start,
    no cash change), startDay = day of 2025-04-01.
  - ledger.ts L-lease-S1 → id `L-rent-S1`, payee 'Data-centre rent', `0.3 × RENT.perGWYear / 4`.
- **Spec (other starts, starts.ts):** division (parent) campuses → 'grid', capex `mw/1000 × 14.2`, split into sites of
  ≤ 1000 MW if a campus exceeds it; challenger 'Colocation North' → 'rent' ("Rented hall North"), ledger 'Data-centre
  rent' at RENT.perGWYear; drop `LEASE_PER_GW_Y`, `BROWNFIELD_PER_GW`. Live start sites get `liveDay = startDay`.
- **Done when:** check.ts: each start's sites are within the caps and sources; leader at 2025-07-01 shows Red River live
  quarter Q4 29 (`siteLiveQ`), grid wait 19 + 4 × 1 / rate(2025.5) ≈ 19.14 q.
- **Test scope:** tsc + check.ts. **Output:** `design/dc/DC-5.md`.

### DC-6 Remove the stored-chip book decay

- **Model:** Sonnet medium. **Budget:** 15 min. **Moves calibration:** maybe (chip collateral and O&M on chip book).
- **Write:** `src/engine/v2/compute/market.ts` (line ~315 and its comment), `src/data/v2/deals.ts` (delete
  `MARKET.inventoryDecayQ`), `src/data/v2/glossary.ts` (`idleChips` body only: "They earn nothing until new MW goes
  live." replaces the 6% sentence), `scripts/v2/_dc6/check.ts`.
- **Done when:** check.ts: a game with chips in inventory and no free racks keeps `inventory.book` unchanged over 4
  quarters (apart from installs); tsc passes. **Output:** `design/dc/DC-6.md`.

### DC-7 Player bot on the three sources

- **Model:** Sonnet high. **Budget:** 30 min. **Moves calibration:** yes (RefBot / player bots build differently).
- **Write:** `src/engine/v2/finance/plan.ts` (205–232 region), `scripts/v2/_dc7/check.ts`.
- **Read:** plan.ts 180–245; sites.ts `siteLiveInQ`, `leverEffects` (DC-4).
- **Spec:** for each chunk of the MW gap: candidates grid and gas with `mw = min(maxMW, max(500, gap))`; for each, turn
  on every lever whose `savesQ > 0` (given the others on) and community always (as today); pick the earlier live
  quarter, ties to grid (cheaper upfront). Rent: when MW will be short at `q + rent liveIn`, rent `min(1000, need)` MW if
  ≥ 100 MW (no pool cap). No transformer pre-orders. No forcing: only actions a player can take.
- **Done when:** check.ts runs one bot game to 2027-07 (seed 1, quick) and prints the sites it built (source, GW,
  levers, live quarter); all are valid sources within caps. **Output:** `design/dc/DC-7.md`.

### DC-8 Existing finance checks restated

- **Model:** Sonnet high. **Budget:** 40 min. **Moves calibration:** no.
- **Write:** `scripts/v2/finance.ts` (F10 block ~300–322; FIN1 ~385–395, ~450–456; vote list ~655; FIN4r M3
  ~1495–1540; ~1573). `scripts/v2/hygiene.ts` only if the sitesQ row changed.
- **Spec:** F10 becomes "400 gas 500 MW rushed sites at neutral sentiment (dcNimby held at 45, mood 0.9, no package):
  blocked 9% ± 3 pp, delayed 27% ± 5 pp (DATACENTERS §3, odds [design D-6]); median construction-to-live 8 q (C14)".
  Other checks: path renames, `cmp.preorderTransformers` out of the vote list, community price $1B/GW where a check
  reads it. Keep every check's intent; if one tested a removed mechanism, delete it and list it in the results file.
- **Done when:** `npx tsx scripts/v2/run.ts --tier quick --only finance` runs; failures listed and explained.
- **Output:** `design/dc/DC-8.md`.

### L1 Lead: merge the engine lane

Merge DC-1…DC-8 and DC-11 into `dc` (and DC-12…DC-17: the UI lane needs DC-13's campuses and DC-17's views); add the
glossary terms listed under "UI lane: shared rules"; regenerate fixtures once (`npx tsx scripts/v2/fixtures.ts --write`) and commit;
`npm run build`; load the day-400 fixture in the app and see that Compute renders (old UI) before starting DC-9.

### DC-11 Glossary

- **Model:** Sonnet medium. **Budget:** 30 min. **Moves calibration:** no.
- **Write:** `src/data/v2/glossary.ts` only (not `idleChips`, which is DC-6's).
- **Spec:** add or rewrite (ids fixed, the UI uses them): `site` (Sites: permits → construction ‖ power → live; sources,
  sizes, speed-ups), `sitePath` (Power source: rent / grid / gas with wait, size cap, upfront, power price, opposition
  from DATACENTERS §2), `rent`, `gridPower`, `gasPower`, `gridWait`, `turbineWait`, `rentWait`, `firmQueue`,
  `connectionsPerYear`, `turbineBacklog`, `turbinesPerYear`, `hallsWanted`, `hallsPerYear`, `permitting` (title
  Permits), `construction`, `powerStage` (title Power: the wait, fixed when you commit), `opposition` (low/medium/high,
  odds, when decided, what a block loses, delay 1–3 q), `dcPublic` (Public against data centres: pub mood, ×0.9 to
  ×1.4), `crashBuild` (title Crash construction: 8 → 4 q, +35% of the building, odds ×1.5), `rushPower` (grid −25% of
  the wait for $0.3B/GW; gas used turbines, wait 4 q, +30% of turbines), `fastTrack` (permits −1 q, 5% of the
  building), `communityPackage` ($1B per GW, block ×0.5; company default; after a block see the event), `siteTier`
  (caps: rent and grid 1 GW, gas 5 GW). Each body states its numbers and sources (`src: 'DATACENTERS.md §n; research/23'`).
  Delete `colo`, `brownfield`, `nuclearPower`, `gridPool`, `transformers`; fix every `[[link]]` to them.
- **Done when:** tsc passes; the glossary link lint the UI tasks use reports no dangling links.
- **Output:** `design/dc/DC-11.md`.

### DC-17 Engine: the numbers the build card and site rows show

(Added 2026-11-27 with the DC-9/10 rewrite. The approved v4 mockup shows breakdowns that the engine computes inside
other functions but does not export. Without this task the UI would have to re-derive engine rules, which breaks
preview = effect.)

- **Model:** Sonnet high. **Budget:** 35 min. **Moves calibration:** no (no behaviour change). **Depends on:** DC-13.
  May run beside DC-14 (different files).
- **Write:** `src/engine/v2/compute/sites.ts`, `src/engine/v2/compute/forecast.ts`, `src/engine/v2/index.ts` (export
  lines only), `scripts/v2/_dc17/check.ts` (new), `design/dc/DC-17.md`.
- **Read:** sites.ts 36–200 (oppositionOdds, SiteOpts, siteSizeError, sitePermitQ / siteBuildQ / sitePowerQ,
  siteBuildingLiveInQ, siteCapex, leverEffects, newSite's clamp lines ~176–186); forecast.ts 30–95
  (siteBuildingLiveQs, siteBars); power.ts 16–30 (siteLiveMW); index.ts 126–137; DATACENTERS.md §5b.
- **Spec:**
  1. Barrel (index.ts line 134): also export `sitePermitQ`, `siteBuildQ`, `sitePowerQ`, `oppositionLevel` and the new
     functions below.
  2. `siteFit(o: SiteOpts): SiteOpts` returns the options as they would be built. The building is clamped to
     [SITE_MIN_MW, source cap]. Buildings = the largest of CAMPUS.counts that is ≤ the asked count and whose total fits
     the cap (rent: 1). `newSite` calls it instead of its inline clamp (no behaviour change).
  3. `siteCapexParts(o)` → `{ building, repeatSaving, extra, crash, rush, fastTrack, community, total }` ($B, whole
     campus). `building` = the building cost before the saving (BUILDING_PER_GW × campus GW; rent: the network
     fit-out). `repeatSaving` ≥ 0 (building × CAMPUS.discount[n]). The other parts are priced as siteCapex prices them.
     `siteCapex(o)` returns `siteCapexParts(o).total`, so there is one computation.
  4. `oppositionParts(s, site)` → `{ blockBase, delayBase, mood, crashMult, communityMult, block, delay }`. Block and
     delay are after the caps. Reactive sites: base = 1 − unblock odds, factors 1. `oppositionOdds` returns
     `{ block, delay }` from it (one computation).
  5. `siteBuildingsView(s, x: Site)` (forecast.ts) → `{ of, live, inConstruction, firm, buildings: { liveQ,
     buildFromQ, live }[] } | undefined` (undefined when blocked):
     - `liveQ` comes from siteBuildingLiveQs.
     - `buildFromQ` = liveQ − ws3.buildQ (rent: undefined).
     - Each building's `live` = that building is live today. The `live` count equals siteLiveMW(x, today) ÷ building MW.
     - `inConstruction` = buildings with buildFromQ ≤ today's quarter < liveQ.
- **Done when:** tsc is clean (both projects), the `_dc13` and `_dc4` checks still pass, and `_dc17/check.ts` asserts:
  - the parts sum to siteCapex over the DC-13 sweep (source × building size × 1/3/5 × crash, rush, fast-track,
    community);
  - the §5b example (gas 5 × 1 GW) gives building 70, repeatSaving 10.5, extra 15, total 74.5;
  - siteFit: grid 5 × 300 MW → 3 × 300 MW, grid 5 × 1 GW → 1 × 1 GW, gas unchanged;
  - the site newSite creates (live days, capex) is unchanged over the sweep;
  - oppositionParts block/delay = oppositionOdds for grid/gas × crash × community;
  - a 5 × 1 GW gas campus stepped quarter by quarter: `live` goes 0 → 5, `live` × building MW = siteLiveMW, and
    `inConstruction` matches the schedule.
- **Stop and ask:** any caller whose result changes. **Output:** `design/dc/DC-17.md`.

### UI lane: shared rules for DC-9, DC-10a, DC-10b

- **Reference files:**
  - `design/ux/mockups/dc/build.png`: Overview with the options row open.
  - `build-tips.png`: the Buildings tooltip (locked) and the Grid tile tooltip.
  - `build-tips-v3.png`: the round-3 tile tooltip and opposition tooltip. These stay as they are, except for what
    DC-10a adds.
  - `NOTES.md`: IA map and numbers.
  - `build.js`: markup and CSS. Its numbers are placeholders.
- **Every number reads the engine.** The mockup's numbers are the §5b worked example on illustrative waits. The
  built UI shows what the engine computes on the day-400 fixture. For example, the delay odds read 36% (not the
  mockup's 30%) at public mood ×1.2. Never copy a number from the mockup. Where the engine and the mockup differ, list
  it in the results file.
- **Player-only text.** No dev state, no "est. by engine", no placeholders. Terms go through `<Term id>`. Every
  number sits in a tooltip trigger (lint-ux's tooltip coverage).
- **Line numbers below are as of the DC-13 merge.** Earlier UI tasks move them, so find code by name
  (`function BuildCard`, …).
- **Tests (UI tasks):**
  - `npx tsc --noEmit -p .`
  - `npm run test:ui` (builds, runs `scripts/v2/uitest.mjs`, screenshots to `scripts/v2/shots/`)
  - `npx tsx scripts/v2/lint-ux.ts`
  - `npx tsx scripts/v2/lint-hidden.ts`
  - The task's own screenshot script, adapted from `design/ux/mockups/dc/render.mjs` (no injection, same fixture,
    1920 × 1080). Compare it by eye with the reference PNG and say in the results file what matches and what differs.
  - Failures the task does not own are listed, not fixed.
- **Lead: glossary additions (add at L1, before DC-9).** The UI tasks use these ids:
  - New: `building` (one data-centre building: 100 MW, 300 MW or 1 GW; construction time grows with size);
    `campus` (title "Buildings": 1, 3 or 5 identical buildings on one site; one permit, one opposition roll, one power
    connection; they go live one per quarter, or together when power is slower; the source's cap applies to the
    total); `repeatDesign` (Repeat design: building cost −10% for 3 and −15% for 5); `buildingsLive` (Buildings
    live: "4 of 5 live", the campus's live capacity rises building by building).
  - Rewrite: `siteTier` (says "any size from 100 MW up to the cap"; now size = one building, bigger sites are
    campuses); `gridPower` and `gasPower` (say "8 of construction"; now 10 q at 1 GW, shorter for smaller buildings;
    cap = campus total); `opposition` (one roll per campus; a block stops every building); `site` (a site may be a
    campus).

### DC-9 Compute tabs + Sites section under the chart

- **Model:** Sonnet high. **Budget:** 60 min. **Moves calibration:** no. **Depends on:** L1, DC-17.
- **Goal:** the Sites tab goes. The Sites section sits under the Capacity chart on Overview as in `build.png`, one row
  per site, with campus buildings filling in.
- **Write:**
  - `src/ui/v2/panels/Compute.tsx`: `Compute` tabs, the `Status` tile link, `evText` and the chart's later-marker
    label, `Overview`, `SiteTimeline` → `SiteRows`, delete `SitesTab`, `STAGE_TERM`.
  - `src/ui/v2/panels/compute.css`: move in build.js lines 15–19 and 30–53 (the `.cmp-main` grid, `.dcs*`,
    `.dc-pill`); delete the `.stl*` and `.cmp-power` rules once unused.
  - `scripts/v2/uitest.mjs` (one check, below), `scripts/v2/_dc9/shot.mjs` (new), `design/dc/DC-9.md`.
- **Read:** build.js 10–60, 115–160; build.png; NOTES.md "Site rows" and the IA map; Compute.tsx 30–46, 68–127,
  200–220, 504–612, 714–729; forecast.ts `siteBuildingLiveQs`, `siteBars`, `ForecastEvent` (30–100); DC-17
  `siteBuildingsView`; power.ts `siteLiveMW`.
- **Spec:**
  - **Tabs:** `Overview · Orders & market`. An old `sites` tab id (saved UI state) maps to overview, as `split`
    does. Drop `sitesBadge`: both its causes already have homes (the idle-chips Status tile, the block pill on the
    site row). Status tile 1 (`idleChips`) goes to overview with anchor `siteRows` (Sites card id `ctl-siteRows`).
  - **Layout:** the `.cmp-main` grid as in build.js 15–19: chart in row 1, column 1 (height 590); Sites in row 2,
    column 1; the card column spans both rows.
  - **Chart (only these two changes):**
    - A campus `siteLive` event (one that has `buildings`) reads `<name> live · +<MW> · N of M` in `evText` and in the
      quarter tooltip.
    - The later-marker reads `<name> (<MW>) live ≈ Qx yy ›`, with the MW of that event.
    - Planned bars already come from `computeForecast` (building by building since DC-13): no change.
  - **Sites card** (`data-home="sites"`):
    - Title `<Term id="site">Sites</Term>`.
    - Right side: dim "racks used / live", an HBar, then bold `used / live` (`F.power`). live = Σ
      `siteLiveMW(x, s.time.day)`; used = Σ min(that, installed × kWPerH100e ÷ 1000).
    - Tooltip rows: Used, Live capacity; text "Power of your live buildings and how much installed chips draw."
    - This fixes the old `x.mw` read: a part-live campus counts only its live buildings.
  - **Axis:** quarter indices from min(now − 5, earliest bar start of a site that is not fully live) to max(now + 8,
    latest `lastLiveQ ?? liveQ` + 1). Year labels at Q1. "today" sits at today's fraction of the quarter, with a 1 px
    line through the rows. A "live" header over the live column.
  - **Rows.** Order: fully live sites by first live quarter, then the rest by planned first live, blocked last.
    Columns as build.js `.dcs-row` (150 / 92 / track / 104 / 286 px):
    1. **Name:** dot in the stage colour (a part-live campus uses live green), name, source in dim lower case
       (`rent | grid | gas`).
    2. **Size:** when `siteBuildingsView.of` > 1, `of` small blocks with `live` of them filled green; then
       `F.power(x.mw)` (the campus total).
    3. **Track,** from `siteBars` and `siteBuildingsView`:
       - A fully live site is one full-height green bar across.
       - Otherwise: permits (grey, full height), construction (blue, top half; `construction` runs from the first
         start to the last live), power (amber, bottom half).
       - A part-live campus adds light green in the bottom half from first to last live, then full-height green after
         the last.
       - Every part after today is hatched (`.pl`).
       - One diamond per building at its `liveQ`: filled when live, outlined when planned. This follows the NOTES
         rule; the PNG shows Red River filled, which is wrong.
    4. **Live column** (mono): empty for a fully live site; otherwise `Qa yy`, or `Qa yy → Qb yy` when the buildings'
       live quarters differ.
    5. **Status,** by stage:
       - Permitting: `<Term id="permitting">Permits</Term>`; pill `block X%` (`oppositionOdds`; bad above 10%, warn
         otherwise; hidden below 0.5% and after the roll); button `Community package · $X.XB` (`cmp.community` with
         `siteId`; price = that action's preview cost) while the site can take one.
       - Power: `<Term id="powerStage">` "Waiting for grid | turbines | a hall", dim `build from Qx yy`
         (`construction[0]`; not for rent).
       - Building: `<Term id="construction">Construction</Term>`, dim `until Qx yy` (last live).
       - Part-live campus: tone-pos `N of M live` (`<Term id="buildingsLive">`), then dim `K in construction` when
         K > 0, else dim `next Qx yy`.
       - Fully live: tone-pos "live", dim `since Qx yy` (first live quarter).
       - Blocked: tone-neg "blocked", dim `$X.XB lost` (capexPaid).
  - **Legend:** permits, construction, power, live, ◆ `<Term id="building">building</Term>` live, planned (hatched).
  - **Row tooltip** (TipCard; title = name, value = stage text). Rows:
    - Power source (`sitePath`): `Gas · US`.
    - Capacity: `5 × 300 MW = 1.5 GW` (`<Term id="campus">` when there is more than one building), or `300 MW`.
    - Live now (siteLiveMW), when part-live.
    - Permits end, Power ready, Construction `Qa yy – Qb yy` (from siteBars).
    - Buildings live `Q4 25 · Q1 26 · …`, one quarter per building with ✓ on the live ones, when there is more than
      one building.
    - Block / delay `X% / Y%`, until rolled.
    - Speed-ups taken (crash, rush, fast-track, community package; "none").
    - Capex paid / total; Chips installed; Paid with (+ RVG), as today.
  - **Empty state:** dim "No sites yet." inside the card.
- **uitest check** (day-400 Overview):
  - no `[data-tab=sites]`;
  - the count of `[data-home=sites] .dcs-row:not(.ax)` = `s.player.sites.length`;
  - the header's live figure = Σ siteLiveMW (read through `window.ai27v2.state`).
- **Screenshots:** `_dc9/shot.mjs` writes `scripts/v2/_dc9/overview.png` (day-400 Overview). It takes a second shot
  after committing a gas 3 × 300 MW campus through `window.ai27v2.act('cmp.newSite', …)`, so a campus row is visible.
- **Done when:** the UI-lane tests pass or their failures are explained, and the screenshots next to build.png match
  its layout (chart height, Sites rows, columns, legend).
- **Stop and ask:**
  - a site whose bars `siteBars` cannot express (say which);
  - the fixture has no site in permits (then commit one in the shot script; don't fake one).
- **Output:** `design/dc/DC-9.md` + screenshot paths.

### DC-10a Build card: size tiles, Buildings row, power tiles and their tooltips

- **Model:** Sonnet high. **Budget:** 75 min. **Moves calibration:** no. **Depends on:** DC-9.
- **Goal:** the top half of the Build data centre card as in `build.png` (size, Buildings, Power). The Buildings
  tooltip and the power-tile tooltips follow `build-tips.png`, plus the round-3 tile content of `build-tips-v3.png`.
- **Write:**
  - Compute.tsx: `BuildCard` (state, size tiles, Buildings row, power tiles, the `params` it sends) and `PATHS`.
  - A local tooltip-rows helper in Compute.tsx: row groups, `sub` and `sum` rows, using the `tipcard-*` classes.
    Tooltip.tsx stays as it is; DC-10b reuses the helper.
  - `src/ui/v2/icons.ts`: delete `pathBrownfield` and `pathNuclear` if unused.
  - compute.css: `.cac-tiles.c3`, `.dc-gl*`, `.dc-sz`, `.dc-bld*`, `.dc-gt`, `.tipcard-row.sub/.sum` from build.js
    20–29 and 56–58.
  - `scripts/v2/uitest.mjs` (one check), `scripts/v2/_dc10a/shot.mjs`, `design/dc/DC-10a.md`.
- **Read:** build.js 66–96, 162–211; build-tips.png; build-tips-v3.png (tile tooltip); Compute.tsx `BuildCard`
  (403–456 at DC-13) and `PATHS` (26–29); sites.ts `SiteOpts`, `siteSizeError`, `siteBuildingLiveInQ` and the DC-17
  functions; waits.ts `waitBreakdown`, `refWaitQ` (60–90); deals.ts `SITE_TIERS`, `SOURCES`, `CAMPUS`, `OPPOSITION`
  (105–175).
- **Spec:**
  - **State and options:**
    - State: `tier` (default 1 GW), `buildings` (1 | 3 | 5, default 1), `path` (default gas), `crash`, `rush`,
      `fastTrack` (off; DC-10b adds their toggles), `community`, `pay`.
    - One options object: `o = siteFit({ path, mw, buildings, crash, rush, fastTrack, community })`. Every number on
      the card reads `o`; the other source tiles read `siteFit({ ...o, path: p })`.
    - `params` sends `buildings`.
  - **Size tiles** (class c3, `SITE_TIERS`, ids `site-hall|building|campus`):
    - Label `F.power(mw)`. Glyph: dim `N q to build` = `siteBuildQ({ ...o, mw })` (crash halves it); for rent, dim
      "rented hall".
    - Never locked: every building fits every source.
    - Tooltip: title `<Term id="building">Building</Term>`, value `F.power(mw)`; body "One data-centre building. A
      campus repeats it."; rows Holds today `N H100e` (Σ compute gains of `actionView('cmp.newSite', …)` for one
      building of this size) and Construction `N q` (`M q crash` when crash is on).
  - **Buildings row** (`.dc-bld`, hidden for rent; `data-test="site-buildings"`):
    - Label `<Term id="campus">Buildings</Term>`, then a `Seg` 1 · 3 · 5. A count is locked when
      `siteSizeError({ ...o, path, buildings: n })` returns a reason; that reason is the lock tooltip.
    - Bold tone-pos `−X%` (`CAMPUS.discount[n]`; hidden at 1).
    - Right side: dim `n × <size> =`, then the campus total in bold (`campusMW`).
  - **Buildings tooltip** (on the row; it locks like any tooltip), as build-tips.png:
    - Head: `<Term id="campus">Buildings` · `n × size = total`.
    - Body: "Copies of one building on one [[site]]. They start one per quarter and go live one by one as each is
      finished, or all together when power arrives later."
    - Schedule SVG (as build.js 170–179, width 394), with P = `sitePermitQ(o)`, W = `sitePowerQ(s, o)`,
      B = `siteBuildQ(o)`, L = `siteBuildingLiveInQ(s, o)`:
      - Permits [0, P];
      - Power [P, P + W], labelled `ready Qx yy`;
      - Building k [L_k − B, L_k], with a diamond and `Qx yy +N` (N = Σ compute gains of the build preview ÷ n);
      - quarter labels every 4 q.
    - Cost rows from `siteCapexParts(o)`:
      - `Building · n × $X` = building;
      - sub row `<Term id="repeatDesign">Repeat design</Term> · n buildings`, `−X% · −$Y` (when n > 1);
      - `Turbines · n × $X` (gas) or `Utility upgrades` (grid) = extra;
      - one row per lever part > 0;
      - sum row `Upfront` = total.
    - Other rows:
      - Saving by count `1: 0% · 3: −10% · 5: −15%` (CAMPUS).
      - Shared: `<Term permitting>permit · <Term opposition>opposition roll · <Term powerStage>power connection`.
      - Largest campus `grid 1 GW · gas 5 GW` (SOURCES.maxMW).
      - When the chosen campus's buildings go live on different dates: sub row `Grid · 3 × 300 MW`,
        `all live Qx yy: power is slower`, computed by `siteBuildingLiveInQ` for that campus at the card's toggles.
        Omit the row if that campus's dates differ too.
    - Foot: "A block stops every building; money paid so far is lost."
  - **Power tiles** (Rent, Grid, Gas; class c3; `PATHS` terms `rent`, `gridPower`, `gasPower`). For each source,
    `f = siteFit({ ...o, path: p })` and `L = siteBuildingLiveInQ(s, f)`:
    - Glyph line 1 (bold mono): `qLabel(now + L[0])`, or `Qa yy → Qb yy` when the first and last differ.
    - Line 2, grid and gas: amber `+0–3q` (`OPPOSITION.delayQ[1]`), then dim `· ≤ <cap>`. When `f` has fewer
      buildings than asked (cut to fit), the cap part is amber (`.cp.bind`) `· n' × <size>` instead. Rent: dim
      `≤ 1 GW`.
    - Choosing a source sets `buildings` to `f`'s (cut to fit). The other tiles stay clickable.
  - **Tile tooltip** (build-tips.png Grid + build-tips-v3.png):
    - Head: `<Term>` + `live <date or range> · +0–3q`.
    - Body: one sentence per source. Grid: "A new connection from the utility. Your site keeps today's wait from the
      day you commit." Gas: your own turbines and the turbine wait. Rent: a hall a landlord builds.
    - When the campus is cut, add: "<Source> sites take up to <cap>: choosing <Source> cuts this campus to
      n' × <size>." Rent with n > 1: "Rent is one hall: choosing Rent rents one <size> hall."
    - Schedule rows (helper):
      - Permits `P q`.
      - `<Term gridWait|turbineWait|rentWait> today` = `sitePowerQ(s, { ...f, rush: false })`.
      - Rush sub row when rush is on: grid `−25% → N q`, gas `used turbines → N q`, N = `sitePowerQ(s, f)`.
      - Construction `B q`, plus ", timed to end with power" when power binds every building, ", one starts each
        quarter" for a construction-bound campus, and " (crash)" when crash is on.
      - Sum row Live `P + max(W, B) = M q · Qx yy` (campus: `P + a…b = c…d q · Qa → Qb`).
      - Opposition delay · Y% `+1 to 3 q` and Block · X% `money spent is lost` (`oppositionOdds` at the toggles).
    - Source rows:
      - `Fits on <source>`: for each size, the largest count with no `siteSizeError`
        (`1 × 1 GW · 3 × 300 MW · 5 × 100 MW`).
      - Upfront per GW: `siteCapexParts` of one 1 GW building, building + extra (grid $14.2B, gas $17.0B, rent $4.0B
        network).
      - Power price: `×1.0 grid`, `×0.5 grid`, rent `$1.8B per GW-yr + grid` (from RENT).
    - Wait rows:
      - `<wait>, 2023 → today  a → b q`.
      - Sparkline 368 × 46: refWaitQ by quarter from Q1 2023 to the game start, then `s.power.waitHist[p]`; year axis.
      - Queue rows from `waitBreakdown(s, p)`. Grid: `<Term firmQueue>` (you + everyone else, GW), sub row "you (site
        names)", sub row "everyone else" [D-11], then `÷ <Term connectionsPerYear>`. Gas: turbineBacklog /
        turbinesPerYear. Rent: hallsWanted / hallsPerYear.
      - Sum row `Wait X.X yr = N q`.
    - Foot: "A new 1 GW <source> site adds 0.N q to everyone's wait." (`perGWQ`, 1 decimal).
    - Rent has no permits, construction or opposition rows.
- **uitest check:** set Gas, 1 GW, Buildings 5, then click Grid. The grid tile glyph shows the cut size
  (`1 × 1 GW`), `buildings` becomes 1 (the Buildings Seg shows 1 active), and the Grid tile's date equals
  `siteBuildingLiveInQ` of 1 × 1 GW grid.
- **Screenshots:** `_dc10a/shot.mjs` sets Gas, 1 GW, Buildings 5 and takes three shots:
  1. the card (compare with the top of the card in build.png);
  2. the Buildings tooltip, locked;
  3. the Grid tile tooltip (compare with build-tips.png and build-tips-v3.png).
- **Done when:** the UI-lane tests pass or their failures are explained, and the shots read like the references.
  The results file lists the engine's tile dates on the fixture next to the mockup's (Rent Q3 27, Grid Q4 31 cut to
  1 × 1 GW, Gas Q3 29 → Q3 30) and explains any difference by the fixture's waits.
- **Stop and ask:**
  - a number in the spec that no exported engine function gives (name it; don't compute it in the UI);
  - the 5-row Buildings tooltip does not fit above the card at 1080 px.
- **Output:** `design/dc/DC-10a.md` + screenshot paths.

### DC-10b Build card: options row, preview lines, opposition tooltip

- **Model:** Sonnet high. **Budget:** 60 min. **Moves calibration:** no. **Depends on:** DC-10a.
- **Goal:** the bottom half of the card as in `build.png`, with the options row open: four speed-ups with their
  saving and price; preview lines (capex with the repeat-design saving, campus H100e, what sets the dates, opposition
  odds); the opposition tooltip (build-tips-v3.png); the footer.
- **Write:**
  - Compute.tsx: `BuildCard` (options row, preview area, footer) and `ComputePreview` (an optional prop that lets
    the build card render its own cost and gain lines; the chip and cloud cards unchanged).
  - compute.css if needed.
  - `scripts/v2/uitest.mjs` (one check), `scripts/v2/_dc10b/shot.mjs`, `design/dc/DC-10b.md`.
- **Read:** build.js 97–113; build.png (bottom of the card); build-tips-v3.png (opposition tooltip); Compute.tsx
  `ComputePreview` (255–292 at DC-13) and `BuildCard`; sites.ts `leverEffects` (140–160); DC-17 `oppositionParts` and
  `siteCapexParts`; the `cmp.newSite` preview in actions.ts (~648–690; one gain line per go-live quarter).
- **Spec:**
  - **Options row** (hidden for rent; opens and closes as today). Each toggle is wrapped in
    `data-lever="crash|rush|fastTrack|community"`. Values come from `leverEffects(s, o)`:
    - `<Term crashBuild>Crash construction</Term> · <saves>, +$X.XB, odds up`
    - `<Term rushPower>Rush power</Term> · <saves>, +$X.XB`
    - `<Term fastTrack>Fast-track permits</Term> · <saves>, +$X.XB`
    - `<Term communityPackage>Community package</Term> · block ×0.5, +$X.XB` (`blockMult`), plus
      ` · company default` when the policy is on.
    - `<saves>`: `−N q` when savesQ = savesLastQ (N = 0 reads `0 q`); otherwise `−a to −b q` (first building → last).
    - Toggle tooltip rows: Saves (first building / last building); Price with its basis (35% of the building, 30% of
      the turbines, $0.3B per GW, 5% of the building, $1M per MW); for crash, `Odds ×1.5` (`LEVERS.crash.oddsMult`).
    - The company-default line stays.
  - **Preview lines** (grid and gas; rent keeps today's lines):
    1. **Capex:** the action preview's capex line as today, then dim
       `· <Term repeatDesign>repeat design</Term> saves` and bold tone-pos `$X.XB`
       (`siteCapexParts(o).repeatSaving`, when > 0).
    2. **Racks:** `racks for`, bold tone-pos `+N H100e` (Σ compute gains of the preview = the campus). For n > 1,
       add dim `· M per <Term building>building</Term> live` (N ÷ n). Then dim `· <what> sets the date(s)`:
       - For each building k, power binds if W ≥ B + k (DC-10a's P, W, B).
       - All power: `<Term powerStage>power</Term> sets the date` (for n > 1: "…, all go live together").
       - All construction: `<Term construction>construction</Term> sets the dates` ("the date" for one building).
       - Mixed: "power sets the first, construction the rest".
       - Rent: "the hall sets the date".
       - Tooltip: one row per go-live quarter from the preview's gain lines (`Qx yy  +N H100e`).
       - No live date here: its home is the tile.
    3. **Opposition:** `<Term opposition>opposition</Term> decides Qx yy` (now + P; when P = 0, "decides now"),
       then bold warn `block X% · delay Y%` (`oppositionOdds` with the card's crash and community).
    4. **Cash / runway** before → after: the existing `whatIf` line.
  - **Opposition tooltip** (on line 3, as build-tips-v3.png):
    - Head: `<Term opposition>Opposition</Term>` + `low | medium | high` (`oppositionLevel(block)`).
    - Body: "Local opposition decides when permits end, Qx yy." When n > 1, add "One roll for the whole campus."
    - Rows from `oppositionParts`:
      - `<Source> site`: base block %.
      - `<Term dcPublic>Public against data centres</Term>`: `×mood`. No "rising": the UI has no mood history.
      - Crash construction `×1.5`, when on.
      - Community package `×0.5`, when on.
      - Sum row Blocked `X%`, sub row "money spent so far is lost" `≈ $X.XB` (the preview's cost line due now).
      - Sum row Delayed `Y%`, sub row "live date slips" `+1 to 3 q` (OPPOSITION.delayQ).
    - Foot: "Crash construction raises both."
  - **Limit chips:** `site.mw` `100 MW–<cap>` (`siteSizeView`); the lease chip as today.
  - **Footer:** bold the first lever that is on, of crash / rush / fast-track (else "Normal build"); then a dim ` · `
    list of the other levers on, community package, lease. Pay tiles unchanged (fed by the new capex and schedule).
- **uitest check:** at Grid, 1 GW, turning rush power on changes the Grid tile's live date and the preview capex
  (+$0.3B), and the rush toggle's `<saves>` text equals `leverEffects`.
- **Screenshots:** `_dc10b/shot.mjs` sets Gas, 1 GW, Buildings 5 with the options row open and takes two shots:
  1. the card. Compare with the bottom of the card in build.png: crash `−1 to −5 q, +$20.8B`, rush `0 q, +$4.5B`,
     fast-track `−1 q, +$3.0B`, package `block ×0.5, +$5.0B`, capex −$74.5B, saves $10.5B, construction sets the
     dates, decides Q1 27 (if the fixture's waits match).
  2. the opposition tooltip, locked.
- **Done when:** the UI-lane tests pass or their failures are explained, the shots read like the references, and the
  results file lists the engine's numbers next to the mockup's.
- **Stop and ask:** the action preview's cost or gain lines don't match `siteCapex` or the per-building schedule (an
  engine issue, not a UI fix).
- **Output:** `design/dc/DC-10b.md` + screenshot paths.

### DC-12 Size scaling: construction time, economies of scale, rushed gas in the backlog

(Added by the lead 2026-11-27 after the DC-7 bot run: one 5 GW gas site live in 6 q, and splitting sites was free.
Designer decisions: DATACENTERS.md §5b.)

- **Model:** Sonnet high. **Budget:** 40 min. **Moves calibration:** yes (build times and building cost by size).
- **Write:** `src/data/v2/deals.ts` (SCALE constant, LEVERS.crash), `src/engine/v2/compute/sites.ts` (siteBuildQ,
  siteCapex), `src/engine/v2/compute/waits.ts` (inQueue), `scripts/v2/_dc12/check.ts` (new), the expected numbers in
  `scripts/v2/_dc3/check.ts`, `_dc4/check.ts`, `_dc7/check.ts` and F10 in `scripts/v2/finance.ts` only where this
  change moves them, glossary bodies `construction`, `crashBuild`, `rushPower`, `turbineBacklog`, `siteTier` in
  `src/data/v2/glossary.ts`, `design/dc/DC-12.md`. Nothing else.
- **Read:** DATACENTERS.md §5b; sites.ts lines 55–130 and the build-schedule code near line 190; waits.ts lines 30–45.
- **Spec:**
  1. deals.ts: `export const SCALE = { refGW: 1, buildTimeExp: 0.3, costExp: -0.1 } as const;` with a comment
     "[design] pending research/23 §9". `LEVERS.crash` becomes `{ buildMult: 0.5, buildingShare: 0.35, oddsMult: 1.5 }`
     (drop `buildQ: 4`; fix every reader).
  2. `siteBuildQ(o)`: rent 0; else `max(1, round(SOURCES[path].buildQ × (GW / SCALE.refGW)^buildTimeExp × (crash ?
     LEVERS.crash.buildMult : 1)))`. Expected (normal / crash): 0.1 GW 4 / 2; 0.3 GW 6 / 3; 0.5 GW 6 / 3; 1 GW 8 / 4;
     2.5 GW 11 / 5; 5 GW 13 / 6.
  3. `siteCapex(o)`: the building part only (grid/gas `upfrontPerGW`, i.e. BUILDING_PER_GW) is multiplied by
     `(GW / refGW)^costExp`; crash and fast-track prices are shares of that scaled building. Unscaled: rent network,
     `extraPerGW` (turbines, utility upgrades), rush, community. Expected: gas 1 GW rush + community = 18.9 (unchanged);
     gas 5 GW no levers = 5 × (14 × 5^−0.1 + 3) = 74.59 (±0.01); grid 0.1 GW no levers = 0.1 × (14 × 0.1^−0.1 + 0.2)
     = 1.7825 (±0.001); gas 5 GW crash = 74.59 + 5 × 0.35 × 14 × 5^−0.1 = 95.45 (±0.01).
  4. waits.ts `inQueue`: delete the rushed-gas exclusion; a rushed gas site counts in the turbine backlog until its
     power is ready. Update the doc comment.
  5. Preview = effect still holds: `leverEffects` and the build preview read `siteBuildQ`/`siteCapex`, no copies.
  6. Glossary: plain player text for the new rules (construction time grows with size, more slowly than size; bigger
     sites cost less per GW; crash halves construction; rushed gas counts in the backlog). No numbers that the tooltip
     already shows live.
- **Done when:** tsc clean (both projects); `_dc12/check.ts` asserts every expected number above plus a sweep that the
  preview's capex and live quarter equal the created site's for gas and grid at 0.1, 1, 5 GW × crash on/off; the
  `_dc3`, `_dc4`, `_dc7` checks pass with expectations updated only where this change moves them (list each change in
  DC-12.md with old → new).
- **Stop and ask:** if any other code reads `LEVERS.crash.buildQ` or assumes 8 q construction outside the listed
  files; if F10's premise no longer holds.
- **Test scope:** tsc + `_dc12`, `_dc3`, `_dc4`, `_dc7` checks + `run.ts --only finance` is NOT run (fixtures stale
  until L1). Moves calibration: yes.

### DC-13 Campuses: buildings 1 / 3 / 5, phased go-live, repetition discount

(Added by the lead 2026-11-27; designer decision DATACENTERS.md §5b "Size and campuses".)

- **Model:** Opus high, reason (c): a site's live capacity becomes phased (per building), which changes core site state
  and every reader of a site's MW (chip installs, online compute, power bills, forecast, previews, bot helpers).
- **Budget:** 75 min. **Moves calibration:** yes.
- **Write:** `src/data/v2/deals.ts` (CAMPUS constant, SCALE.costExp removed, size tiers), `src/engine/v2/types.ts`
  (SiteWS3 fields), `src/engine/v2/compute/sites.ts`, `power.ts`, `forecast.ts`, `waits.ts` if needed,
  `src/engine/v2/finance/actions.ts` (cmp.newSite params/preview only), `src/engine/v2/index.ts` (exports),
  minimal compile fixes elsewhere (list them), `scripts/v2/_dc13/check.ts`, expectations in `_dc3`, `_dc4`, `_dc12`
  checks and F10 only where this moves them, `design/dc/DC-13.md`. Not: plan.ts beyond compile fixes (DC-14), UI
  (DC-9/10), glossary (lead adds terms), save.ts/schemaRev, fixtures.
- **Spec (DATACENTERS.md §5b is authoritative):**
  1. `CAMPUS = { counts: [1, 3, 5], discount: { 1: 0, 3: 0.10, 5: 0.15 } }`; building size tiers 100 / 300 / 1000 MW;
     remove `SCALE.costExp` and its use (keep the time exponent).
  2. `SiteOpts` gains `buildings: 1 | 3 | 5` (default 1; rent forced 1). `site.mw` = total campus MW = buildingMW ×
     buildings; store `ws3.buildings` and `ws3.buildingMW`. Total ≤ source maxMW (else the action refuses; preview
     says why).
  3. Construction per building = existing `siteBuildQ` on buildingMW (9.5 × GW^0.4, crash × 0.5, rounded).
     Building k live at permitsEnd + max(powerQ, buildQ + k) (quarters). Store per-building live days (or derive them
     from powerDay, buildQ and k; your choice, document it).
  4. Live capacity: a function `siteLiveMW(site, day)` = buildingMW × number of buildings live by `day`; the site's
     stage becomes 'live' when its first building is live. Every reader that used `site.mw` for live capacity (racks,
     installInventory, ownedOnline, power and O&M bills, forecast, mwBy-style helpers, previews' "+H100e") uses it.
     The grid/turbine queue still counts the campus total until power is ready.
  5. Capex: building part = BUILDING_PER_GW × total GW × (1 − discount[buildings]); crash and fast-track are shares of
     that discounted building; extraPerGW, rush, community stay per GW of the total, undiscounted. 5% of total at
     commitment; each building's remainder in equal parts over its own construction quarters; a block loses what
     was paid.
  6. `leverEffects` and the build preview keep preview = effect (live date range first → last building, capex).
  7. Expected (Q3 2026, grid wait 20, turbine wait 9, no levers unless stated): gas 5 × 1 GW → capex 74.5, buildings
     live at +12, 13, 14, 15, 16 q; gas 1 × 1 GW → 17, live +12; grid 3 × 300 MW → capex 0.9 × 14 × 0.9 + 0.18 =
     11.52, all live at +21; grid 5 × 300 MW → refused (1.5 GW > 1 GW). Gas 1 GW rush + community (one building) →
     18.9 unchanged.
- **Done when:** tsc clean (both projects); `_dc13/check.ts` asserts the numbers above, a preview = effect sweep over
  source × building size × buildings × crash, and that racks/online compute rise building by building for a 5 ×
  1 GW gas campus; `_dc3`, `_dc4`, `_dc12`, `_dc7` checks pass (expectation moves listed old → new in DC-13.md).
- **Stop and ask:** any reader of site MW whose meaning is unclear (live vs planned); anything in finance beyond the
  capex schedule.
- **Test scope:** tsc + the checks above. No run.ts tiers (fixtures stale until L1).

### DC-14 Player bot builds campuses

- **Model:** Sonnet high. **Budget:** 30 min. **Moves calibration:** yes. **Depends on:** DC-13.
- **Write:** `src/engine/v2/finance/plan.ts`, `scripts/v2/_dc7/check.ts` (extend), `design/dc/DC-14.md`.
- **Spec:** for a MW gap, candidates are grid and gas with building size from the tiers and buildings 1 / 3 / 5
  (within the source cap); for each, every lever that helps (as DC-7). Pick the earliest *first-building* live
  quarter that covers the gap by the last building; tie → cheaper capex. Rent as DC-7. No tuning beyond this.
- **Done when:** tsc clean; `_dc7` check passes and prints the bot's sites (source, building MW × count, live range,
  capex) for seed 1 to 2027-07.

### DC-15 Per-building financing lease (lead, 2026-11-27)

Designer: a leased campus starts one financing lease per building when that building goes live. Brief given directly
to the agent (branch `dc-15`); results in `design/dc/DC-15.md`. Sonnet high.

### DC-16 Cleanup: leave the code cleaner than we found it

- **Model:** Sonnet high. **Budget:** 60 min. **Depends on:** DC-15, DC-17 merged. **Moves calibration:** slightly
  (Lone Pine as a campus).
- **Goal:** remove everything the old site model and the task-by-task build left behind; no behaviour change except
  the items marked.
- **Spec:**
  1. Grep `src` and `scripts` for leftovers of removed concepts: brownfield, nuclear, transformer, grid pool / pool
     credit / queuedDay, capacity price / κ / kappa, overlap, power draw, lease pool / leasePoolGW, inventoryDecay,
     SITE_PATHS, PathDef, LEASE (the old constant), `buildQ: 8` comments that describe the old model, V2-SPEC §3.8
     references describing removed mechanics. Remove dead code, constants, types, aliases (`siteEtaQ`), exports and
     stale comments. Known: `COMMUNITY.upfront` and `COMMUNITY.blockMult` unused; `BUILD_Q` holding only `upfront`
     (fold into the site constants); `SCALE.refGW` if trivially 1. List every removal in DC-16.md.
  2. A building is at most 1 GW everywhere: start site Lone Pine (gas, 1.2 GW, one building) becomes a 4 × 300 MW
     campus with the same total, capex, paid and live date (all buildings live together). Check other start sites
     against the rule.
  3. Consolidate the temporary task checks `scripts/v2/_dc2` … `_dc17` (and `_dc6`, `_dc12b` if present) into one
     suite `scripts/v2/sites.ts` registered in `scripts/v2/run.ts` (quick tier, `--only sites`), keeping every
     assertion that still describes the design; rewrite DC-4's stale single-building cases (1.5 / 2 GW buildings) as
     1 GW × buildings; delete the `_dcN` directories. Delete any `_f10tmp`-style temp dirs that are tracked.
  4. Mark V2-SPEC §3.8's site/power part and research/15 §1.3 as replaced by design/DATACENTERS.md (one line each).
- **Write:** anything under `src/engine/v2/compute/`, `src/data/v2/deals.ts`, `src/engine/v2/index.ts`,
  `src/engine/v2/core/starts.ts`, `scripts/v2/` (the suite, run.ts registration, `_dcN` deletion), V2-SPEC and
  research/15 (one line each), `design/dc/DC-16.md`. Not: Compute.tsx (UI lane), glossary (L1), save.ts, fixtures.
- **Done when:** tsc clean; `run.ts --only sites` passes; grep for the removed concepts returns only intended hits
  (list them); DC-16.md lists removals.
- **Stop and ask:** anything whose deadness you're not sure of.

### CP Lead: final checkpoint (heavy runs, once)

1. Merge all branches into `dc`; bump `SCHEMA_REV` once (save.ts); regenerate fixtures; update `design/LIMITS.md`
   (site.mw: no lease pool) and V2-SPEC §3.8 pointer to DATACENTERS.md.
2. `npm run test:full` once on the merged head; `npm run test:cal` once (site timing moves compute); `npm run test:ui`
   once; golden timelines check without `--write`.
3. A short bots run vs master (same seeds): player compute online 2026–2029, site capex by year, distress share; the
   leader's 2028–29 compute after Red River 1 GW / Q4 29 [D-10].
4. Render COMPUTE › Overview on day-400 with the real build and compare with `build.png` / `build-tips.png`.
5. Expected movers to read before judging failures: Red River 2 → 1 GW and later; gas power 1.3× → 0.5×; κ gone; rent
   $1.2B → $1.8B per GW-year; grid capex 14.5 → 14.2, gas 16 → 17 per GW; community 3% → $1B/GW; chip book no longer
   decays; bots' site choices. Per the standing rule, a missed target points at a mis-tuned sourced mechanism, never a
   forcing rule.
