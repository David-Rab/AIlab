# DC-10a Build card: size tiles, Buildings row, power tiles and their tooltips

## What changed
- `Compute.tsx`
  - `BuildCard`: state `tier` (1 GW), `buildings` (1), `path` (gas), `crash`, `rush`, `fastTrack` (both off; DC-10b adds their
    toggles), `community`, `pay`. One options object `o = siteFit({ path, mw, buildings, crash, rush, fastTrack, community })`;
    every number on the card reads `o` (the other source tiles read `siteFit({ ...o, path: p })`). `params` sends `buildings`.
  - Size tiles (class c3, `site-hall|building|campus`): label `F.power(mw)`, dim `N q to build` (`siteBuildQ`, crash halves
    it) or `rented hall`, never locked. Tooltip: Building term, Holds today (`actionView('cmp.newSite')` gains, one building),
    Construction.
  - Buildings row (`data-test="site-buildings"`, hidden for Rent): `Seg` 1 · 3 · 5, a count is locked with the
    `siteSizeError` reason, `-X%` (`CAMPUS.discount`), `n × size =` campus total (`campusMW`).
  - Power tiles (Rent, Grid, Gas): live date or `Qa → Qb` (`siteBuildingLiveInQ`), `+0-3q` and `<= cap`, or the cut size in
    amber when the campus does not fit. Choosing a source (or a size) sets `buildings` to `siteFit`'s.
  - New local helpers: `TipRows` (row groups with `sub` and `sum` rows) and `DcTip` (wide card: head, body, groups, foot),
    reused by DC-10b; `CampusSchedule` (schedule SVG), `WaitSpark` (368 x 46 wait sparkline), `BuildingsTip`, `PowerTip`.
  - `PATHS` unchanged (the icons stay: the new tiles use them). Dead: the old tile code, the old tier tooltip, `siteLiveInQ`
    import.
- `compute.css`: `.dc-gl*`, `.dc-sz`, `.dc-bld*`, `.dc-gt`, `.tipcard-row.sub/.sum`, `.dc-blk`, and a `.tip:has(> .tipcard.dc-wide)`
  rule that widens the tooltip to 420 px (Tooltip.tsx caps it at 360). `.cac-tiles.c3` was already there (DC-9/J1).
- `uitest.mjs`: one block (3 checks): Gas 5 x 1 GW shows the Grid tile cut to `1 x 1.0 GW`; choosing Grid makes Buildings 1
  with 3 and 5 locked; the Grid tile's date equals the engine's for one 1 GW grid building (read from the build preview).
- `scripts/v2/_dc10a/shot.mjs` + `1-card.png`, `2-buildings-tip.png`, `3-grid-tip.png`.

## Tile dates on the day-400 fixture (Gas, 1 GW, Buildings 5, no speed-ups)
| Tile | Engine | Mockup |
|---|---|---|
| Rent | Q3 27 | Q3 27 |
| Grid | Q4 31, cut to 1 x 1.0 GW | Q4 31, 1 x 1 GW |
| Gas | Q3 29 -> Q3 30 | Q3 29 -> Q3 30 |

The fixture's waits (grid 20 q, turbines 9 q, rent 4 q) equal the mockup's, so every date matches.

## Differences from the mockup (and why)
- Sizes read `1.0 GW`, `5.0 GW` (`F.power`), the mockup `1 GW`.
- Opposition odds are the engine's at the fixture's public mood: Grid delay 24% / block 6% (mockup 20% / 3%), Gas delay
  35% / block 12%. Grid queue 160 GW (you 1.0 for Red River, others 159), mockup 150. Gas backlog 144 GW.
- The Grid tile tooltip opens above the tile (Tooltip.tsx has below / right only; below does not fit at 1080 px), the mockup
  shows it left of the card. The Buildings tooltip opens below the row and covers the Pay-with tiles while held; 1080 px is
  enough (it ends at y 980).
- The campus Buildings row is one Tip over the whole row; a locked count's own tooltip (its reason) wins at the same depth.

## [D] choices
- Sparkline: Q1 2023 to the game start from `refWaitQ`, then `waitHist`, then today's wait as the last point (the history
  has no entry for the current quarter before the quarterly run).
- Construction suffix: "timed to end with power" when power binds every building (`W >= B + n - 1`), else "one starts each
  quarter" for a campus; nothing for one building the construction binds.
- Rent's tooltip has no permits, construction or opposition rows and shows `Largest site` instead of `Fits on`.
- Choosing a size also cuts the campus to fit (as choosing a source does).
- The example row `Grid · 3 x 300 MW` shows only when the chosen campus's dates differ and that example's dates are equal.

## For DC-10b / the lead
- The preview under the card repeats `racks for, live ≈ Q3 29 +1.4M H100e` once per live quarter (a campus has five gain
  lines with one label); the old options row still says `Crash build · 4q, +35%` and has no rush / fast-track. Both are
  DC-10b's.
- Now unused, not mine to edit: glossary term `siteTier` (shared file) and the `name` / `full` fields of `SITE_TIERS`
  (data/v2/deals.ts).
- No term was missing: `campus`, `building`, `repeatDesign`, `gridWait`, `turbineWait`, `rentWait`, `firmQueue`,
  `turbineBacklog`, `hallsWanted`, `connectionsPerYear`, `turbinesPerYear`, `hallsPerYear` all resolve. `Upfront per GW` and
  `Power price` are plain labels (no glossary entries; lint-ux does not ask for them).

## Checks
- tsc clean (both projects), `npm run build`, lint-ux and lint-hidden pass.
- `test:ui` (uitest.mjs): 705 passed, 21 failed. The three DC-10a checks and both DC-9 checks pass. The failures are the
  known ones (B2, D8, E12, E11, D6, F6c, F6e, FIN4a, IA, R10, Investigations) plus `Products: locked tools name their idea`,
  the same "locked: the idea" family as B2 (no Compute involvement).
