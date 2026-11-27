# DC-5 Start sites and start ledgers

## Start sites (start 2025-07-01; q index 0 = Q3 25)
- Leader: S1 Abilene North rent 300 MW live (liveDay 2024-01-01, powerQ 1); S2 Abilene South grid 300 MW live (2024-07-01,
  capex = paid 4.26); S3 Lone Pine gas 1200 MW building to 2026-04-01 (capex 12k, paid 6k, powerDay = liveAt 2026-04-01);
  S4 Red River grid 1000 MW, stage power, rolled, powerQ 17, buildQ 8, construction from 2027-10-01, powerDay = liveAt
  2029-10-01 (Q4 29, `siteLiveQ` q 17, firm), capex 14.2k, paid 5% (0.71), startDay 2025-04-01.
- Challenger: one rented hall, 120 MW, rent, live (liveDay = startDay -500). Ledger `L-rent-S1` 'Data-centre rent'.
- Big-tech division: two grid campuses, 450 MW each, capex 6.39 (14.2/GW), paid; splitting into <= 1000 MW parts is coded
  (not reached). Spinout: no sites.
- Ledger: leader `L-lease-S1` -> `L-rent-S1`, 'Data-centre rent', 0.3 x 1.8 / 4 = 0.135 per quarter (was 0.09).
  starts.ts: `LEASE_PER_GW_Y`, `BROWNFIELD_PER_GW` gone, `GRID_CAPEX_PER_GW` 14.2.

## Check (`scripts/v2/_dc5/check.ts`, all ok)
All sites in caps and sources for the four starts; rent ledger = rent MW x $1.8B/GW-yr; leader grid wait at start
19.140 q (= 19 + 4 x 1 / rate(2025.5)); gas 8.585, rent 3.500.

## Moves calibration
Yes. Red River 2 GW (live ~2028) -> 1 GW live Q4 29: the leader loses 1 GW and ~1.5 years of it in 2028-29; capex 29 ->
14.2. S1 rent +50% ($0.09 -> $0.135B/q). Power costs: gas multiplier already 0.5 from DC-3.

## For the lead
- Fixtures/saves stale (save.ts schemaRev: lead bumps). `siteLiveQ` for a live start site uses `liveDay`, so
  existing code reading `liveDay` of start sites now sees real values.
- Red River's grid queue entry now stays until powerDay 2029-10-01 (17 q), so its 1 GW counts in the leader's grid
  wait throughout (hence 19.14 not 19).
