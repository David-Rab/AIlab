# DC-4 Build action: levers, preview = effect, community price

## Changed
- `cmp.newSite` params: `path` ('rent' | 'grid' | 'gas', default 'gas'; unknown falls back to gas), `mw` (clamped to
  [100, source max]; default min(1000, max)), `crash`, `rush`, `fastTrack`, `community` (default company policy), `pay`
  ('cash' | 'lease'). Rent forces cash and every lever off (including community).
- Preview: rent `[-GW x RENT.perGWYear per year x 5 (non-cancellable)]`, `[-capex network fit-out]`; grid/gas cash
  `[-capex, lagDays = siteLiveInQ x 91]`; lease as before. Gain: compute H at the same lag. Exposure: block/delay from
  `oppositionOdds`. The lease-pool exposure and the pool cap in apply are gone (DC-3). Apply is `newSite(s, ctx, o)`.
- `leverEffects(s, o)` appended to sites.ts (+ types `LeverEffect`, `LeverKey`; all three exported from the engine
  barrel). Returns `{ crash, rush, fastTrack, community }`, each `{ on, savesQ, cost, blockMult? }`; empty for rent.
  savesQ = liveIn(lever off) - liveIn(lever on), cost = capex(on) - capex(off), other toggles as given. Community:
  savesQ 0, `blockMult` 0.5.
- `cmp.community`: cost per site = GW x `LEVERS.community.perGW` ($1B); text "$1B per GW on N sites"; saved-compute
  line uses `LEVERS.community.blockMult`. Apply is `addCommunityPackage` (adds the same $1B/GW), so preview = effect.
- Rent preview now uses `RENT.perGWYear` (1.8) and its years (5).

## Check (`scripts/v2/_dc4/check.ts`, all ok)
68 cases (rent x2 levers states, grid and gas x 16 lever combinations, two sizes each): preview capex = created site's
capex and preview lag quarter = the created site's live quarter. Q3 26, dcNimby 58.8: gas 1 GW rush + community capex
18.9, lag 910 d; crash -4 q +$4.9B, rush -1 q +$0.9B, fast-track -1 q +$0.7B, community +$1.0B block x0.5; odds block
5.88% (preview 0.06), delay 35.28% (0.35). Rent 1 GW -1.8/yr. Community action: 1.5 GW site +$1.5B; company-wide
preview 3 sites 4.6 = capex added.

## For later tasks / the lead
- `COMMUNITY.upfront` (0.03) in deals.ts is now unused (not my file); `COMMUNITY.blockMult` is also dead (LEVERS holds it).
- Community package moves calibration: 3% of capex (about $0.4-0.5B per GW) to $1B per GW; the rent price 1.2 to 1.8.
- `leverEffects` has no crash odds multiplier field (1.5x, `LEVERS.crash.oddsMult`); the UI can read it from LEVERS or
  from `oppositionOdds`. Add a field if the card wants it.
- `siteLiveInQ`, `sitePowerQ`, `siteBars` are still not in the barrel (not in the DC-4 list).
