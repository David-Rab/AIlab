# CP1: the `sites` suite, trimmed

Rule (designer): a test's cost is proportional to its importance. Goal: `sites` in the quick tier at most 20 s CPU, every rule still checked.

## Result

| | before | after |
|---|---|---|
| quick tier (`run.ts --tier quick --only sites`) | about 130 s CPU (checks about 122 s, load about 8 s) | 12.8 s CPU in the final run (13 to 16 s across runs) |
| full tier | the same | 38.5 s CPU (the bot game is about 31 s of it); 275 checks |
| checks (quick) | n/a | 274, none dropped |

Quick runs the bot's first decision round only (`--smoke`, set in the `sites` job's `args.quick`); full runs the five-quarter game.

## Per-block CPU seconds (checks only, module load excluded)

| block | before | after quick | after full | what moved |
|---|---|---|---|---|
| DC-2 world waits | 0.9 | 0.9 | 1.2 | start game built once and cloned |
| DC-3 site lifecycle | 2.3 | 1.1 | 1.2 | `fresh()` clones a cached start game instead of `newGame` |
| DC-4 build action, preview = effect, levers | 48.4 | 2.1 | 2.7 | `newGame` per case (about 0.3 s each, about 150 cases) replaced by `structuredClone` of one cached game (about 10x cheaper). No case removed. |
| DC-5 start sites and ledgers | 1.4 | 1.6 | 2.0 | one game per start type, cloned for the Lone Pine check |
| DC-6 stored chips | 0.3 | 0.1 | 0.1 | clone |
| DC-7 reference bot | 44.1 | 0.25 | 30.6 | the 2-year game (to Jul 2027) is full tier only, and shortened to five quarters (to Oct 2026; it has built five sites by then). Quick: the bot's first decision round on the start state (it builds three sites at once), all the same per-site rule checks. Full adds "over five quarters the bot keeps building (at least four sites)". |
| DC-12 construction time / cost | 2.2 | 0.02 | 0.02 | the preview = effect sweep (grid and gas x 100 / 500 / 1000 MW x crash, 12 cases) deleted as redundant: DC-13's sweep covers the same cases (one building) and more, and now also checks `buildQ` and the 500 MW size. Pure cost cases stay. |
| DC-13 campuses 1 / 3 / 5 | 5.7 | 0.8 | 0.8 | clone; sweep gained the 500 MW size and the `buildQ` check (absorbing DC-12's sweep) |
| DC-15 financing leases | 0.3 | 0.05 | 0.06 | clone |
| DC-17 build card numbers | 16.8 | 0.8 | 0.8 | clone; the opposition-parts sweep (pure function of the mood) reuses one state and sets the mood per case |
| DC-16 runway projection | n/a | 0.01 | 0.02 | unchanged |

## Where every rule lives

- Constructed cases, both tiers: costs, dates, preview = effect (full sweep over source x size x buildings x crash x levers, 42 built / 10 refused cases), campuses, the 1 GW building rule, opposition (odds and parts), leases, runway, start sites, world waits.
- Bot rules (sources, sizes in [100 MW, cap], buildings at most 1 GW, levers valid): both tiers, on the sites it builds in its first round (quick) or in five quarters (full).
- Full only: the bot's multi-quarter game, and the check that it keeps building over five quarters.
- Deleted as redundant: DC-12's 12-case preview sweep (superset in DC-13).
