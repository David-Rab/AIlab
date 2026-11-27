# DC-1 Source, lever and wait tables

Added to `src/data/v2/deals.ts` (after `TRANSFORMER`), next to the old tables (removed in DC-3): `SiteSource`,
`BUILDING_PER_GW` (14), `SourceDef`, `SOURCES` (rent/grid/gas), `SITE_MIN_MW` (100), `LEVERS`, `RENT` (1.8 $B/GW-yr, 5 y),
`WAIT_REF`, `WAIT_RATE`, `OPPOSITION`. Values exactly as the DC-1 spec. No `OTHER_LABS_SHARE` ([D-11]).
tsc (root and scripts/v2) pass. Nothing reads the tables yet.
