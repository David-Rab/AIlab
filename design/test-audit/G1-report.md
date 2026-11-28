# G1 report: effective, signals, successor, suites, data, oversight (branch ta-g1)

Wall seconds of one full run (includes ~3 s of tsx import), before = quick-run baseline cpu band 10-36 s, after = measured now:
effective 6.3, signals 4.4, successor 3.0, suites 4.8, data 12.0, oversight 8.3. All pass/WARN, 0 FAIL. tsc: no new errors in these six (only the
missing node types of a bare tsc run). One commit per script.

## Every failing check
| script | check | class | action | OPEN.md row |
|---|---|---|---|---|
| effective | RL FLOP = rho x base; "no minimum days" (< 30 d) | STALE-PIN | the 30-day pin is gone; now FLOP = rho x base FLOP and wall time proportional to 1/compute (2x pool halves it) | none |
| effective | same G on day 0 and 500 | TEST-BUG | F1 diffusion (`research.diffused`, in the recipe via ePreAt/diffusedLift) is state, not date; the test restored stacks and data but not `diffused`. Now no 500-day run: `time.day = 500` on a clone, same state, same G | none |
| signals | reference post-train reproduces V1 exactly (S2 0.357) | STALE-PIN | S2 is the sourced per-family exploitability x S2_PER_EXPLOIT (data/v2/suites.ts:27-31 says "a broad run reads 0.36"); V1's other signals stay exact; S2 = suiteS2 formula at 1e-9 and within 0.005 of 0.36 | none |
| signals | reference base S5 0.28 (0.278) | STALE-PIN (tolerance) | G_S5_0 is anchored at G_pre 26.99, B0 sits a few hundredths off; 0.28 within 0.005 (0.1 OOM of G) | none |
| signals | distilled student same vs cross family at 1e-12 | TEST-BUG | the run's own step reads the lab's other base: 1e-4 difference, against ~0.2 had the teacher's initialisation transferred; tolerance 2e-3 | none |
| successor | pull grows with automation (start ~0.07) | BUG (parked) | KNOWN, start omega 0.006 and day 400 below start; not re-diagnosed | existing: "Successor-pull checks fail on master ... no owner" |
| suites | start S2 = 0.36 | STALE-PIN | as signals: formula identity + within 0.005 of 0.36 | none |
| suites | follower starts (0.36 / 0.9) | STALE-PIN | challenger = bigtech = leader; spinout = formula x START_EXPLOIT_MULT.spinout (0.894 where V1 rounded 0.9) | none |
| suites | light x0.5 / heavy x1.3 within 1% | STALE-PIN | S2(budget) = S2(standard) x optimisationPressure(budget) exactly, light < standard < heavy (the p(rho) vs 0.5 / 1.3 table is checked in signals) | none |
| suites | hardening falls / diminishing returns; building raises fidelity / ceiling; REASON gain up; RD-B03 built suite in broad RL | TEST-BUG | "nothing moves" is not the mechanism failing. A new game's engineers are all on upkeep (capacity 4.36 TW/wk, upkeep 2.27 at day 0, 4.76 by day 120), so queued suite work never progresses (0.298 TW on day 1, then 0), and unmet upkeep decays the suites' tasks (fidelity 1 -> 0.986). The test now finishes the item with `completeSuiteWork` (the engine's own completion call) and removes it from the queue; no runTo(+60) | see question 1 |
| data | D11 teacher: strongest teacher gives the most G | TEST-BUG | V25 and V27 tie (G equal to 6e-7, next-base G differs by 9e-7), `===` was a coin flip; tolerance 1e-4 OOM | none |
| data | D9 teacher re-check: smallest teacher wins at the cap | TEST-BUG | same tie, and among teachers of one size version-specific data mix moves G by +-10%, more than the 9% FLOP-per-token gap, so argmax can't show it. Mechanism isolated: the same capped teacher at half the FLOP per token gives more G | none |
| data | natural mix CODE > 0.2 | STALE-PIN | magnitude of the fixture's portfolio (CODE +0.11 today); now: balanced draw has no specialisation, natural mix specialises (CODE up, some domain > 0.2) | none |
| oversight | AG08 half point = SAR level (v2 M-half 25) | STALE-PIN | oHalf 4.218 is a stored OOM literal (data/v2/agendas.ts:23); the level it maps to depends on the world's timeline (L11.14 here). Replaced by shape: every tool has half strength at its oHalf, 0 < oHalf < 15; AG08 <= AG07 < white-box. The "v2 half points kept as OOM literals" check only pinned data to itself: deleted | none |

## Other changes
- Removed: oversight's comparison with the "deleted duplicate" oomOfLevel (a one-off equivalence check, TESTING 4; identity oomOfLevel = gOfLevel - G_V0 kept, 3 worlds, 3 newGames instead of 8).
- One game built once and `structuredClone`d in effective, signals, successor, suites (per start type), data (per start type), oversight.
- Headers: cost lines added to all six.

## Questions for the designer
1. Engineers at the start: capacity (4.4 TW/wk) is below upkeep within ~4 months, so a player who queues a suite build or hardening and doesn't hire sees it never finish, and suites decay (fidelity 1 -> 0.986 in 60 days). Intended pressure, or a balance issue (upkeep growth with revenue)? Not touched; if it is a bug it belongs in OPEN.md § Balance.
2. data D9: should "at the web's cap the smaller teacher wins" stay as a lineup-level claim? Today version-specific draw mix outweighs the size gap; I kept only the isolated mechanism.

## Proposed lib.ts / run.ts
None needed. (`cloneGame(setup)` in lib.ts would replace the six local `structuredClone(proto)` helpers.)
