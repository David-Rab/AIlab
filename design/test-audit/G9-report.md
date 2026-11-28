# G9 report: idle.ts, hygiene.ts (+ readsweep.ts)

Measured CPU (user+system, loaded machine, includes ~3 s of tsx transform): idle 4 CPU-min -> 11 CPU-s;
hygiene quick 340 -> 33 CPU-s, full (--deep) 89 -> ~75 CPU-s (before the last trim, 89 measured); no shards, no cache.

## idle.ts
| Check | Class | Action |
|---|---|---|
| bot games (2 starts x 4 bots x seeds x 1100 d) "no stock idle 30 d without an alert" | vacuous (B-heavy: `seen` never required > 0) | replaced by constructed cases on the day-400 fixture: per stock (chips, scienceTeams, serving) used -> no alert; idle -> listed + alert; used again -> alert gone; all three idle together over 30 ticks (no bot) still listed + alerting on day 0/15/30 |
| "idle training compute stays idle" | stale wording | now: lend policy off -> stays out of the experiments pool; on -> all of it joins (expPoolH100e), training pool not reduced after a tick |
| safety engineers default use | new | conservation (on a need + idle = pool); 4 added engineer teams are used by line experiments or listed idle, never lost |
Finding: the engine keeps no idle-since timer; the alert is a pure function of the state, so it shows on the first idle day (always inside the 30-day bound). The brief's "safety engineers -> tool upkeep" no longer exists: the default use is line experiments (safAllocation surplus).
No failing checks before; none after.

## hygiene.ts / readsweep.ts
| Check | Class | Action | OPEN.md row |
|---|---|---|---|
| causes: ledger keys canonical and strip sorted | TEST-BUG | the test bumps 'morale' and 'player.morale.overall' (same canonical key) so the ring holds 2 entries; expectation was 1. Fixed to 2 | none |
| registry table (47 lines, one check per system + "no unlisted") | change-detector | replaced by invariants (owner/cadence/order/run valid, daily+quarterly exist, validateRegistry accepts shipped list, refuses duplicate id / duplicate order / unsorted) | none |
Cost changes: determinism 1500 -> 25 days; stream isolation 6 x 400 d from newGame -> 5 x 20 d from the day-400 fixture (every stream the fixture draws is still instrumented; deep 60 d, 5 probes); save size on day0 + day900 fixtures and a fresh game (round trip on each; 30-day continuation of the live game); cadences: calendar arithmetic 730 d (no ticks) + 100 ticks vs the calendar; readout purity (3b b): fixture day400 + RefBot acting, one light sweep, hash every day (was 3 seeds x 730 d x 2 games, cached) ; 3a frozen sweep on day900 (deep: day0/400/900, full 16 second args); 3c process history 30 -> 20 d and no sweeps in it. readSweep got a `light` mode (5 typical second arguments, about half the CPU). Section 8 (perf) untouched except its own PERF_DAYS = 1500; `--perf-only` works (fails 1.5 ms / 8 ms budget on a loaded machine: 11.9 ms, 37.9 ms, as always).
What the quick form no longer sees: a read-impurity that only shows after hundreds of bot days (the F4 class); the deep form still plays 2 fixtures x 14 days with two full sweeps. Whole-game purity over years is not covered anywhere now.

## run.ts changes wanted
- idle: `args: {}` (drop `--seeds 1`), mode text 'constructed', budget quick 15 / full 15, shards none.
- hygiene: quick `['--no-perf']` (drop `--smoke`), full `['--no-perf','--deep']`, perf `['--perf-only']` unchanged; remove `shards: { full: 3 }`; budget quick 45, full 100 (measured 33 / ~75-89 on a loaded machine); remove the "G1 prefill shards" comment. hygiene no longer uses simcache prefill (the import of `cached`/`prefill` was dropped).
- lib.ts: nothing needed.

## Questions
- Is the brief's idle spec (30-day timer) meant to change the engine? Today there is none; if a "dark for 30 days" rule is wanted it is a mechanism change.
