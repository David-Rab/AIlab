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
| DC-9 | Compute tabs + Sites rows under the chart | Sonnet high | L1 | no |
| DC-10a | Build card: three power tiles, live dates, tile tooltips | Sonnet high | DC-9 | no |
| DC-10b | Build card: speed-up options row, preview lines, opposition tooltip | Sonnet high | DC-10a | no |
| DC-12 | Size scaling: construction time, economies of scale, rushed gas in the backlog | Sonnet high | DC-7, DC-8 | yes |
| CP | Lead: final checkpoint | lead | all | — |

Opus share: 1 of 12 agent tasks (DC-3) ≈ 8%.

**Lanes.** Engine lane (sequential, `dc` worktree): DC-1 → DC-2 → DC-3 → DC-4 → DC-5 → DC-8. In parallel worktrees:
DC-6 and DC-11 at any time (DC-6 touches `deals.ts` MARKET only and one glossary line; trivial merges); DC-7 after DC-4
(only `finance/plan.ts`); DC-5 may run beside DC-4 (it edits only `initialSites` in sites.ts, plus starts.ts, ledger.ts).
UI lane after L1, sequential (one file, Compute.tsx): DC-9 → DC-10a → DC-10b.

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
    grid: [12, 16, 18, 20, 20, 20, 18, 16], gas: [4, 6, 8, 9, 9, 8, 7, 6], rent: [1, 2, 3, 4, 4, 4, 4, 4] } as const;
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

Merge DC-1…DC-8 and DC-11 into `dc`; regenerate fixtures once (`npx tsx scripts/v2/fixtures.ts --write`) and commit;
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

### DC-9 Compute tabs + Sites rows under the chart

- **Model:** Sonnet high. **Budget:** 60 min. **Moves calibration:** no.
- **Goal:** the Sites tab goes; the site rows sit under the Capacity chart on Overview exactly as in `build.png`.
- **Write:** `src/ui/v2/panels/Compute.tsx` (tabs, `Overview`, `SiteTimeline` → `SiteRows`, delete `SitesTab`, Status
  tile link), the stylesheet that holds `.cmp-main` / `.stl` (move the `.dcs*`, `.dc-pill`, `.cmp-main` grid rules from
  `build.js` lines 10–50 into it, delete unused `.stl*` / `.cmp-power`), `scripts/v2/uitest.mjs` (one check: Sites rows
  render on Overview with one row per site).
- **Read:** build.js (all), build.png, NOTES.md; Compute.tsx 100–125, 500–618, 719–734; forecast.ts `siteBars` (DC-3).
- **Spec:** tabs `Overview · Orders & market` (an old `sites` tab id maps to overview, like `split`); Status "racks
  empty" tile goes to overview. `.cmp-main` grid: chart row 1 col 1 (height 590), Sites row 2 col 1, card column spans
  both rows. Sites card: title Term `site` "Sites"; right: "racks used / live" bar + `1.1 GW / 1.8 GW` with today's
  tooltip. Axis: quarters from min(now − 5 q, earliest start of a non-live site) to max(now + 8 q, latest live + 1),
  year ticks at Q1, "today" line. Rows (live by liveDay, then by planned live, blocked last): dot (stage colour), name,
  source in dim lower case, MW; track: live = full green bar; otherwise permits bar (grey, full height), construction
  (blue, top half) and power (amber, bottom half) from `siteBars`, hatched after today, diamond at live (outlined until
  the roll). Live column: `Qx yy` for non-live. Status column: permitting → Term `permitting` "Permits", pill `block X%`
  (bad > 10%, warn otherwise; hidden < 0.5%), button `Community package · $X.XB` (cmp.community with siteId) while it can
  take one; power → Term `powerStage` "Waiting for grid | turbines | a hall", dim `build from Qx yy` (not rent);
  building → Term `construction` "Construction", dim `until Qx yy`; live → tone-pos "live" dim `since Qx yy`; blocked →
  tone-neg "blocked" dim `$X.XB lost`. Legend: permits, construction, power, live, planned. Row tooltip: source,
  capacity, permits end, power ready, construction from–to, live, block / delay odds (until rolled), speed-ups taken,
  capex paid / total, chips installed, paid with (+ RVG as today).
- **Done when:** `npm run build`; screenshot of day-400 Overview (1920 × 1080) next to build.png matches layout;
  uitest check passes; no dev state in the UI. **Output:** `design/dc/DC-9.md` + the screenshot path.

### DC-10a Build card: power tiles and their tooltips

- **Model:** Sonnet high. **Budget:** 60 min. **Moves calibration:** no.
- **Write:** Compute.tsx `BuildCard` (tiles part) and `PATHS`; `src/ui/v2/icons.ts` (delete pathBrownfield,
  pathNuclear); stylesheet (`.cac-tiles.c3`, `.dc-gl`, `.dc-spk*`, `.tipcard-row.sub/.sum` from build.js).
- **Read:** Compute.tsx 403–460; build.js 60–80, 120–181; build-tips.png; waits.ts `waitBreakdown`; sites.ts
  `siteLiveInQ`, `oppositionOdds`.
- **Spec:** three tiles (Rent, Grid, Gas; class c3). Glyph: bold live quarter `qLabel(qOf(s) + siteLiveInQ(...))` for the
  chosen size (capped) and toggles; amber `+0–3q` for grid/gas; dim `≤ 1 GW` / `≤ 5 GW`. Size tiles: Multi-GW and
  Large campus unlocked when gas is chosen (locked above the chosen source's cap, as today). Tile tooltip (as the grid
  one in build-tips.png): head Term(source) + `live Qx yy · +0–3q`; body one sentence; rows Permits, `<wait> today`,
  rush sub-row when on (grid `−25% → N q`, gas `used turbines → 4 q`), Construction (`8 q, timed to end with power` /
  `4 q crash`), sum `Live  P + N = M q · Qx yy`, `Opposition delay · X%  +1 to 3 q`, `Block · X%  money spent is lost`;
  then Largest site, Upfront per GW (grid $14.2B, gas $17.0B, rent $4.0B network), Power price (×1.0 grid; ×0.5 grid;
  rent `$1.8B per GW-yr + grid`); then `<wait>, 2023 → today  a → b q`, sparkline (368 × 46; reference path by quarter
  from Q1 2023 to the start, then `power.waitHist`), year axis, queue rows (grid: Firm queue / connections per year;
  gas: Turbine backlog / turbines delivered per year; rent: Halls wanted / halls finished per year) with sub-rows
  "you (site names)", "everyone else" [D-11], sum `Wait  X.X yr = N q`; foot "A new 1 GW <source> site adds
  0.N q to everyone's wait." (perGWQ, 1 decimal). Rent tooltip has no permits, construction or opposition rows.
- **Done when:** build; tooltip screenshot next to build-tips.png; numbers on the day-400 fixture: Rent Q3 27, Grid
  (rush on) Q3 30, Gas (rush on) Q1 29. **Output:** `design/dc/DC-10a.md` + screenshots.

### DC-10b Build card: options row, preview lines, opposition tooltip

- **Model:** Sonnet high. **Budget:** 45 min. **Moves calibration:** no.
- **Write:** Compute.tsx `BuildCard` (options, preview, footer); `scripts/v2/uitest.mjs` (one check: toggling rush power
  changes the grid tile's live date and the preview capex).
- **Read:** build.js 82–110, 150–178; build.png; sites.ts `leverEffects`, `oppositionLevel`.
- **Spec:** state `rush`, `fastTrack` (default off) next to `crash`, `community`; params carry all four. Options row
  (hidden for rent; company-default line kept): `Crash construction · −N q, +$X.XB, odds up`; `Rush power · −N q,
  +$X.XB`; `Fast-track permits · −N q, +$X.XB`; `Community package · block ×0.5, +$X.XB` (+ `· company default` when
  the policy is on), values from `leverEffects`. Preview lines: capex line (as today); `racks for +N H100e ·
  <construction | power | the hall> sets the date` (construction if buildQ ≥ powerQ; Term links); grid/gas:
  `opposition decides Qx yy` + bold warn `block X% · delay Y%` with the tooltip from build-tips.png (head Opposition +
  low/medium/high; body "Local opposition decides when permits end, Qx yy."; rows `<Source> site` base, `Public against
  data centres` ×mood, Crash ×1.5 when on, Community package ×0.5 when on, sum Blocked X% with sub "money spent so far
  is lost ≈ $X.XB" (5% of capex), sum Delayed Y% with sub "live date slips +1 to 3 q"; foot "Crash construction raises
  both."). No live date in the preview (it lives on the tile). Limit chip `100 MW–<cap>`. Footer: bold first lever on
  of crash / rush / fast-track (else "Normal build"), dim ` · ` list of the others on, community package, lease.
  Pay tiles unchanged (fed by the new capex and schedule).
- **Done when:** build; screenshot of the open options row next to build.png (Campus 1 GW, Gas, rush + package: capex
  −$18.9B, block 6% · delay 35%, Pay-with PVs move with the levers); uitest check passes; `lint-ux` / `lint-hidden` as
  the UI suite runs them. **Stop and ask:** if "rising" for public mood needs a history the UI does not have (omit the
  word, ask). **Output:** `design/dc/DC-10b.md` + screenshots.

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
