# G8 report: directorEndings, npcShocks (branch ta-g8)

Cost, measured wall seconds of one run (includes ~10 s of tsx import; the shared machine was loaded):
- directorEndings quick (--smoke): 197 CPU-s before -> ~13 s wall now (~3 s of sim). Full: ~3 CPU-min (B-heavy) -> 67 s wall, cached games included once.
- npcShocks: 71-89 s wall before (it was NOT fast: one 3.5-year forced bot game, ~80 s) -> quick ~14 s (no sim), full as before.
tsc: no errors in either script. Both pass (one WARN registered).

## Every failing / changed check
| script | check | class | action | OPEN.md row |
|---|---|---|---|---|
| directorEndings | T3 China lead at start 150-200 d (223 d) | STALE-PIN | the NPC rule starts China 6.5-8 months behind (SC1-SPEC.md:30, CAST-2025 "China gap check", Epoch mean 7) = 198-243 d; check now that band | none |
| directorEndings | T4 rival gaps positive and <= 10 months (6.3, 3.8, 6.3, 10.9, 0.0) | STALE-PIN | CAST-2025: the leader's peer is at 0, Meta 9.5 months, band +-1.5 (line 203): now 0 to 11 months | none |
| directorEndings | T3 stays behind the US frontier on >= 95% of days (69.5%; p10 -33 d, min -61 d) | CAL-TARGET | with no theft China's lag closes and it is ahead of the US frontier on ~30% of days. Left as written, in KNOWN (WARN), full only | Balance: "China trails the US frontier: T3 daily lead, 3 seeds, 69.5% of days behind vs >= 95%; mean 102 d vs floor 90 d" |
| directorEndings | T3 "a theft never widens the gap" (<= 1 d) | vacuous (removed) | the lead clock reads China's PUBLIC model, which moves only when it releases the stolen model; one tick after a theft it read +1 d drift (+8 d after a week), it could not fail. The theft's effect on China's lag is tested in npcShocks F6 | none |
| directorEndings | E5 rivalTakeover, chinaTakeover, asiContested needed 33-39 seeds | TEST-BUG (sampling) | `r.npc.m = 1` is overwritten on the first tick (m is derived), so reaching a takeover depended on the seed's hidden theta_w. Now theta_w is pinned (floor 0.05; contested: 0.9 x the exposure) and every non-catastrophe ending must hit on seed 1 (a miss or > 1 seed fails). Catastrophe endings keep the 0.15 x exposure x (1 - defence) roll (7 seeds) | none |
| directorEndings | E1 "exactly the 9 kept events" | change-detector | invariants: unique, E-numbered ids, non-empty | none |
| npcShocks | all (0 checks counted by run.ts) | TEST-BUG (harness) | own `ok` lines -> lib `check`/`finish` (same checks, thresholds) | none |

## Seed arithmetic
- E2: rival subset = 1 + seed % (2^k - 1), fixture = seed % 3. With k = 5 rivals that is 31 x 3 = 93 distinct (subset, fixture) pairs, periods coprime, so seeds 1..93 visit each once; later seeds only change the rng stream, which the event texts do not read. Full 100 (every pair + 7 repeats; 31 seeds also run 30 days, one per mask), quick 31 (every mask once). Was 1000. Check now also requires > 0 texts checked.
- E4: limits are per-tick invariants; the spam gives ~30 crises per 300-day seed. Full 3 seeds (90 crises, > 50 required), quick 1 seed (> 20).
- T3 bot games (full only): the failing share is 25 points off its threshold, visible from one seed; the mean (102 d) is 12 d above its floor; 3 seeds (~1,500 daily readings), was 8. T3 start-lead and the E5/T4 cases are constructed (quick).
- T4: 40 newGames full (was 200), 10 quick; the check is a min/max span over rivals x seeds.

## Other changes
- npcShocks: the 3.5-year forced game (F4 "leak never overshoots", ~80 s) is full only (`if (!SMOKE)`); quick gets a constructed version: 1,100 days of `secretsLeak` at 1%/day on a clone must be monotone, equal kp + gap x 0.99^N, and never cross the know-how position.
- Headers with cost/tier on both scripts; simcache keys carry the new parameters.

## Proposed run.ts / OPEN.md changes
- run.ts: npcShocks job must pass `--smoke` in quick: `args: { quick: SMOKE }, mode: { quick: 'SMOKE' }`, budget quick 5 -> 15 (10 s is imports), full 15 -> 120 (the forced game).
- run.ts: directorEndings budget quick 200 -> 20, full 600 -> 150.
- OPEN.md § Balance row for the T3 China-ahead-of-the-US-frontier result (above).

## Questions
- Is China overtaking the US frontier on ~30% of days (no theft, RefBot play) intended? The spec text (NPC-LABS §13) says it stays behind; the NPC secrets-leak/open-weights closing reaches the player's know-how position (npcShocks game: lag 198 -> 41 d).
