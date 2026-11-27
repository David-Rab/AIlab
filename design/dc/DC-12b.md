# DC-12b Size-scaling constants retuned (designer decision after research/23 §9)

## What changed
- `deals.ts`: `SCALE = { refGW: 1, buildTimeExp: 0.4, costExp: -0.05 }`; SOURCES grid and gas `buildQ: 9.5` (siteBuildQ rounds). Start-site `buildQ: 8` defaults of already-built sites untouched.
- `design/DATACENTERS.md` 5b and the construction table updated; exponents now sourced (time: Epoch timelines fit, research/23 §9; cost -0.05: design value at the top of what the data allow). Glossary bodies hold no size numbers, unchanged.

## Numbers
Construction q normal / crash: 0.1 GW 4/2, 0.3 GW 6/3, 0.5 GW 7/4, 1 GW 10/5, 2.5 GW 14/7, 5 GW 18/9.
Capex: gas 1 GW rush + community 18.9 (unchanged); gas 5 GW plain 79.59; grid 0.1 GW plain 1.5908; gas 5 GW crash 102.20.

## Expectations moved (old -> new)
- `_dc12`: construction table 4/2, 6/3, 6/3, 8/4, 11/5, 13/6 -> 4/2, 6/3, 7/4, 10/5, 14/7, 18/9; gas 5 GW 74.59 -> 79.59; grid 0.1 GW 1.7825 -> 1.5908; gas 5 GW crash 95.45 -> 102.20.
- `_dc3`: gas rush live-in 10 -> 12 q (2 + max(10, 4)); siteSchedule eta 10/build 8 -> 12/10; forecast gas live Q1 29 (index 14) -> Q3 29 (16); gas construction payments 8 -> 10; grid power stage ends index 12 -> 10 (Q1 28); grid building check at q 12 -> q 10; siteBars construction start 12 -> 10.
- `_dc4`: lag days 910 -> 1092; crash saves 4 -> 5 q (2 + max(5,4) = 7 vs 12); live with crash 6 -> 7 q, lag 546 -> 637 days; rush saves 1 -> 0 (see below); fast-track comment 1 + 8 -> 1 + 10 (value still 1).
- `scripts/v2/finance.ts` F10: median construction-to-live of rushed 500 MW gas 6 q -> 7 q; block 9.3% / delay 25.5% hold (block run alone, as in DC-12).
- `_dc7`: nothing to change, all ok.

## For the lead
At 1 GW the rush-power lever now saves 0 q (power wait without it is below the 10 q construction time), so it only pays off where power binds. The check premise holds; the lever's value at 1 GW is worth a glance for design.
