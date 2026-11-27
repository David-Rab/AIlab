# DC-2 World waits module

Added `src/engine/v2/compute/waits.ts` (pure functions, exported from the engine barrel) and `scripts/v2/_dc2/check.ts`.

Functions: `refWaitQ`, `rateGWPerYear`, `outsideGW`, `pendingGW`, `waitQ`, `worldWaitQ`, `waitBreakdown`, type `QueueSite`, `WaitBreakdown`.

Numbers the check prints (all match DC-TASKS): grid 2023.0 12, 2024.0 16, 2025.5 19, 2026.0 20, 2030.0 16, 2032.0 16, 2021.0 12;
gas 2025.5 8.5, 2026.0 9; rent 2025.5 3.5, 2026.0 4; outsideGW(grid, 2026) 150; grid +1 GW 20.1333, gas +5 GW 9.3333, rent +1 GW 4.6667.
pendingGW: rushed gas 0, grid with powerDay <= day 0, blocked 0. On a fresh game (2025-07-01): grid ref 19 q, wait 19.280 q
(Red River 2 GW in the queue), gas wait 8.585 q (Lone Pine 1.2 GW), rent 3.500 q (no 'rent' site: the start site still has path 'lease').

Notes for later tasks:
- The state wrappers read `s.player.sites` through a cast (`queueSites`), because `SiteWS3` has no `powerDay`/`rush` yet and TypeScript
  rejects a type with no property in common with the all-optional `QueueSite.ws3`. DC-3 adds those fields; the cast can then go.
- Until DC-3 renames path `'lease'` to `'rent'`, the rent queue is always empty in a real game.
- `inQueue` (private) is the one predicate behind both `pendingGW` and the breakdown's `you` rows.
