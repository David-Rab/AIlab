# L1b: engine leftovers, glossary, fixtures; quick-tier results

## Done
1. `finance/ext.ts`: `defaultSiteWS3` and the `ensureWs3` site line deleted; `newSite` builds `ws3` explicitly (`delayedQ: 0`).
2. `src/data/v2/limits.ts` `site.mw` restated (building 100 MW-1 GW, 1/3/5 buildings, total within the source cap; the file is in
   `src/data`, not `src/engine`). `design/LIMITS.md` has no generator (hand-written inventory, no script writes it): its one site row
   (`sites.ts:67`) was reworded by hand.
3. `types.ts` `SiteWS3.rush` comment: rushed gas counts in the turbine backlog.
4. `core/save.ts`: all migrations 103-112 and `CHANNEL_MK1`, the `deriveNames` / tools / features imports deleted; `migrations` stays as an
   empty record for the next bump; rev comment rewritten. `hygiene.ts` and `_ub3` assert only the refusal and the floor, unchanged.
5. `scripts/v2/tastecurve.ts`: unused `tasteSigma` import removed.
6. Glossary: new `building`, `campus` (title "Buildings"), `repeatDesign`, `buildingsLive`; rewritten `site`, `siteTier`, `gridPower`,
   `gasPower`, `opposition`, `construction` (it still said "costs less per GW the bigger the site"); `sitePath` lost "8 of construction".
   `lint-ux` "Glossary links resolve": ok.
7. Fixtures regenerated (`fixtures.ts --write`) and committed; the `fixtures` job passes.

tsc clean on `.` and `scripts/v2`; `run.ts --only sites` 275/275.

## Quick tier (one run, 40.5 min wall): 12/36 ok, 2447 checks passed, 87 failed
ok: tsc-main, tsc-scripts, sites, evals, fixtures, lint-hidden, lint-tradeoffs, safety (smoke), danger, currency, money, idle (smoke),
finance#0/#1 prefill.

FAIL (first failing lines; full logs in `.simcache/logs/<job>.log`):
- effective (1): post-training RL FLOP = rho x base FLOP, no minimum days: 4.50e25 FLOP, 38 d
- data (1): draw: balanced keeps the reference shares on day 400: "balanced none; natural SOCIAL -0.56 ..."
- suites (9): start suites reproduce S2 0.36: got 0.3575; RL budget pressure light x0.5 / heavy x1.3 within 1%: 0.180 / 0.466
- signals (3): reference post-train S2 0.357 (expects 0.36), S5 0.278 (0.28); distilled student transfer line
- successor (1): the pull grows with automation: start r 0.03, day 400 r 0.09, day 900 r 0.862
- research (2): a dud direction fails after 3 dropped candidates (drops 0); assignment within 5% of brute force: worst 84.7%
- safetyresearch (7): E1 first result after T1: worst 50%; pipeline steady cycle 0.500 T1 (ETA 45 d vs 45 d)
- worktypes (6): coverage monotone (SWE G_SC-3 OOM 0.59); returns doublings 0.0420/0.0414/0.0430 vs 0.0427; reference bot reaches
  SC -> SAR -> SIAR -> ASI in order (1415 -> 1652 -> none); lint: `worldfx/revenue.ts:177 shareRefAt` read by a player mechanism
- calib (smoke, 2): frontier G path to 2026 worst 0.51 G; METR h50 doubling 6.5 months (target 4.2 +-1)
- hygiene (6, smoke): registry has no unlisted systems (safetyFramework, autoSplit); newGame leader/tl-central and tl-fast "'world'
  draws, rivals, China and the player unchanged by the leader lab"
- lint-ux (1): UI terms resolve: `colo` (`Compute.tsx:29`, old UI, DC-9 replaces it)
- lint-structure (1): Action titles <= 4 words: `research.safReAlloc "Safety research engineers by need"`
- oversight (1): decay half strength at oHalf: 4.218 vs L11.14
- domainref (1): grep: no REF_OFF in src (`data/v2/danger.ts`, `models/capability.ts` still name it)
- sabotage (1): successor steering: 300 runs, 0 raised; TypeError: Cannot read properties of undefined (reading 'omega')
- footholds (2): 20000 days leave footholds (1 from 1 uncaught acts); steered successor "none"
- control (1): E15 day900: perturbing hidden truth leaves believed control unchanged (readout oversight 0.836230)
- safetyideas (4): P14 steering fades with capability (AF d 0.325 -> 0.247); P15 safety-agent red-teaming cash; P23 CoT faithful 0.966
- finance (4, smoke): FIN4a partner tranche stake 4% -> 15%; FIN4b IP access gap 0.000; FIN4r H3 distress down round $17.0B
- worldfx (5, smoke): 2026 revenue $14.8B (target $45-56B), 2027 revenue $11.1B (~$140B), equity 2026 -20.8% (+30%)
- ws4 (4, smoke): E1 event texts contain canon (E01, E25, E10); E3 intel estimate -194 d (truth +249); T3 China lead at start 220 (150-200)
- rivals (4): R1 twice the compute ends with a better recipe: G 28.71 -> 28.92; R5 research speed rs 0.498 (expects 1); R6 milestones
- products (8): P6 free-user cut order; P7 engineers build it (60 d); companion segment preview 723M -> 707M
- serving (12): S3 price within [cost, value] at day 400 and 900; S6 internal scaffold 27.627 -> 27.627

Observations for the calibration checkpoint, not diagnosed: most failures are outside sites/power (research, safety, serving,
worldfx revenue, rivals); several look like effects of the timelines merge (start values 0.3575 vs 0.36, rs 0.498, revenue far below
target) rather than of the data-centre work. The 2026 revenue and equity misses are the likeliest to touch compute supply.
