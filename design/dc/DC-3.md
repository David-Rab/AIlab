# DC-3 Site state and lifecycle rebuild

## State
- `Site.path: SiteSource` (`'rent' | 'grid' | 'gas'`, type imported from deals.ts) [D-9].
- `SiteWS3`: `queuedDay` gone; added `powerQ` (required), `rush?`, `fastTrack?`, `powerDay?`, `liveAt?`. `defaultSiteWS3` sets `powerQ: 0`.
- `PowerGrid = { kWPerH100e; waitHist: Record<SiteSource, number[]> }`. Gone: `poolGWPerQ`, `queue`, `capacityPrice`,
  `transformerLeadQ`, `ws3`, type `PowerWS3`, `defaultPowerWS3`, `MarketWS3.leasePoolGW` (and its default). init.ts:
  `power: initialPower()` for every start.
- deals.ts: `SITE_PATHS`, `PathDef`, `LEASE`, `TRANSFORMER` deleted; `BUILD_Q = { upfront: 0.05 }` only.

## Engine (sites.ts)
`SiteOpts` with rush/fastTrack; `sitePermitQ`, `siteBuildQ`, `sitePowerQ` [D-4], `siteLiveInQ` (alias `siteEtaQ` kept:
the engine barrel `index.ts` and the build card import it, and index.ts is not in the write list), `siteCapex`,
`oppositionOdds` [D-6], `oppositionLevel`, `addCommunityPackage` (+$1B/GW), `siteSchedule`, `newSite`, one stage
function `advanceSite` used by sitesQ and by newSite (fast-track grid rolls at commitment). sitesQ appends
`round1(worldWaitQ)` for grid/gas/rent every run, then steps sites. `tri`, `leaseAvailableGW`, the transformer gate, the
grid pool and κ are gone. power.ts uses `SOURCES[path].powerCostMult` (gas 0.5×, was 1.3×), no `(1 + κ)` [D-8].
forecast.ts: `siteLiveQ` per spec; new `siteBars` (+ `SiteBars` type; not yet exported from the barrel). limitsView:
`siteSizeView(_s, path) = { min: 100, max: SOURCES[path].maxMW }`. waits.ts: the `queueSites` cast is gone.

## [D] choices
- **`firstNow` is always true** (not `etaQ === buildQ` as the block says): the engine pays the first construction
  part in the quarter construction starts, so a site pays 8 equal parts over its 8 construction quarters ([D-7] and the
  worked example). `etaQ === buildQ` would have the lease and PV previews assume 7 parts. Lead: confirm.
- **`pq` = the quarter of the sitesQ run that ends permits** (equals "quarter of stageEndDay" whenever stageEndDay is a
  quarter start, i.e. all normal sites). E27's rescues set mid-quarter days (`day + 182`, `+365`, `+60`); the floor
  quarter would start the schedule a quarter in the past and cut construction to 7 quarters. E27 itself unchanged.
- Rent sites: stage `power` from commitment, `powerDay = liveAt = stageEndDay`, ledger `L-rent-<id>` 'Data-centre
  rent', kind `lease`; the landlord's facility capex still tallies to `leaseFinanced`. New rent sites are named "Hall N".
- Opposition delay is clamped at ≥ 0 as well as ≤ 0.9 − block; mood uses `max(0, dcNimby)`.

## Check (`scripts/v2/_dc3/check.ts`, all ok)
Fresh game at 2026-08-05, dcNimby 0. Start waits: grid 20.252 q (Red River 2 GW pending, rate 31.75 GW/yr), gas 9.075 q,
rent 4.000 q. Gas 1 GW rush + community: powerQ 4, live in 10 q (index 14 = Q1 29), capex 18.9, paid 0.945; building
from Q1 27, 8 payments of 2.244375, live Q1 29 with 18.9 paid. Grid 1 GW rush: powerQ 15, permits end Q4 26, power
stage to Q3 28, building to Q3 30 (16 q); +20 GW of grid afterwards: a new grid site's wait 20 → 23 q, the first site's
powerQ and liveAt unchanged. Rent 1 GW: live in 4 q (Q3 27), $0.45B a quarter from go-live, 0.2 paid now. siteBars
at commitment `{permits [4,5], power [5,20], construction [12,20], liveQ 20}`, the same after the roll (firm). Fast-track
grid rolls at commitment. Odds at dcNimby 45: grid 4.5% / 18%, gas 9% / 27%; gas crash at dcNimby 100: 30% / 60%.
40 crash grid sites at dcNimby 100: 6 blocked, 24 delayed; blocked sites leave `pendingGW` and keep `capexPaid`.
Gas running cost < grid (0.839 → 0.670 $B/yr on the start's live sites).

## Compile-only edits in other tasks' files
- actions.ts: `cmp.preorderTransformers` ActionDef + registration gone, lease-pool lines gone (the rent size cap is
  now `SOURCES.rent.maxMW` via `siteOpts`), `siteOpts` default `'gas'`, `'lease'` path → `'rent'`, unused `yearStats`
  import dropped. The rent preview still prices rent at 1.2 and the community preview still says 3% (DC-4).
- plan.ts: always `gas` for crash builds, transformer lines gone, rent bridge capped at `SOURCES.rent.maxMW`, path `'rent'`.
- starts.ts / `initialSites`: `'lease'` → `'rent'`, `'brownfield'` → `'grid'`, `powerQ: 0` added (required field),
  S4's `queuedDay` and its comment gone. **Red River has `powerQ 0` until DC-5**: at its roll (Q3 26) power is ready
  at once and it goes live 8 q later (Q3 28), and it leaves the grid queue at the roll.
- Compute.tsx: PATHS rent/grid/gas, grid-pool and transformer KVs and the pre-order button gone, lease-pool text gone
  from the size chip, rent tiles show the computed quarters (the "1–3q" special case went with `'lease'`).
- scripts/v2/finance.ts: line 303 deleted, F10 path `'gas'`.

## Left for later tasks / the lead
- Done-when grep: only `src/data/glossary.ts:29` (v1 CDZ "nuclear plant", unrelated) and the starts.ts comment line 18
  ("brownfield capex", DC-5's file; constant `BROWNFIELD_PER_GW` there too).
- Compute.tsx `STAGE_TERM.power = 'gridPool'` and PATHS terms `colo` / `gridPower` / `gasPower` still point at old
  glossary ids: DC-11 / DC-9 must keep or remap them.
- Fixtures (`scripts/v2/fixtures/*`) are stale; saves break (schema: Site.path, SiteWS3, PowerGrid, MarketWS3).
- `siteBars`, `siteLiveInQ`, `sitePowerQ`, `oppositionLevel` are not in the engine barrel (index.ts not in DC-3's list).
