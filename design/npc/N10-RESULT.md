# N10 result: the setup of the NPC cast

Task N10 of NPC-TASKS.md, branch `npc-n10` (off `npc`). Spec: NPC-LABS.md draft 2 §10, §11. Moves calibration: no
(the default setup gives the same cast as before N10).

## Engine

- `SetupV2`: `rivals`, `rivalCount`, `leaderLab` are gone; **`cast: 'realistic' | NpcSetupLab[]`** replaces them
  (types.ts). `NpcSetupLab = { kind, lagMonths, personality? }`, `personality` a partial of the kind's seven values.
  China's preset stays `setup.china` (the existing setting; the setup screen shows it inside the Rivals section).
- `npc/lab.ts castOf(setup)` builds the US labs: `'realistic'` is the cast (as before); a custom list is one lab per
  item, each taking its kind's REALISTIC_CAST entry for compute, money, tools and staff (one typical start per kind) with
  the item's start lag (months behind; for the upstart, which has no public model, the lag is its band) and the item's
  overrides over `KINDS[kind]`. Core/init.ts builds from it.
- The leader-kind lab is left out in the Frontier-leader start, in both modes (the setup screen does not offer it there).
- **Names:** the first lab of a kind keeps the kind's invented name and family; the n-th later one adds a Roman numeral
  to both ("Lanternworks II" / "Ouvril II", id `lanternworks2`; III, IV ...). Ids stay unique.
- **Overrides** are stored on the lab (`NpcLabState.p`, the full adjusted set; absent when nothing was changed) and read
  through `persOf(npc)` in place of `KINDS[kind]` (compute appetite, release lag, openness, funding, posture). The
  readers in actors/rivals.ts and finance/rivalFinance.ts now go through it.
- 0 US labs works (China's lab only). `world/hidden.ts` still makes its four rival draws (constants) so later draws of
  the 'world' stream keep their values; init replaces what they produce.
- Scripts: compile fixes only (removed `leaderLab` / `rivalCount` / `rivals` options). `scripts/v2/hygiene.ts` and
  `scripts/v2/uitest.mjs` still test the old leader lab / old picker ids (they were already stale after N2b-1); left for N12.

## UI (setup/Rivals.tsx, Setup.tsx)

- "Rival labs" section: chips **Realistic** (default) and **Create rivals**.
  - Realistic: the cast, one row each: name, kind (tooltip), months behind (tooltip), a one-line description.
  - Create rivals: number of US labs 0-6; per lab a kind picker (tooltip per kind), months behind (0-36), "Adjust
    personality" (the seven values with the kind's values as defaults: compute growth, funding, release lag, openness,
    market focus, safety emphasis, race response; "Reset to the kind's values"), Remove.
- China's preset chips sit in the same section, in both modes.
- Every term has a glossary tooltip (`npcKind*`, `npcStartLag`, `npcAppetite`, `npcFunding`, `npcReleaseLag`,
  `npcOpenness`, `npcFocus`, `npcSafetyEmphasis`, `npcRaceResponse`, `npcRivalsMode`) in player language, no dev state.
- Removed: the Rivals preset picker, the Rival labs 3/4 picker, `leaderLab` in the start picker. The company-name clash
  check uses the cast's names.

## Tests

`scripts/v2/npcSetup.ts`: default = realistic cast in order; leader start drops the leader kind (also custom); custom
2 labs give exactly those kinds and lags; numbered names, unique ids; overrides reach the lab and its posture; 0 labs;
each custom game runs 30 days.
