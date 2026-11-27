# DC-8 Existing finance checks restated

Only `scripts/v2/finance.ts` changed (hygiene's `sitesQ` row is unchanged: still `['sitesQ', 'WS3', 'quarterly', 410]`).

## Checks restated
- **F10 sites** (two checks). The 400 sites are now rushed gas, 500 MW, `community: false`; `pub.dcNimby` is held at 45
  (mood 0.9) instead of "its start value". Bands: blocked 9% ± 3 pp, delayed 27% ± 5 pp (DATACENTERS §3, odds [design
  D-6]), replacing "5-10% blocked, 20-40% delayed" (C15). Median construction-to-live stays 8 q (C14); with a 4 q
  power wait the permits (2 q) and construction (8 q) set the go-live.
- **FIN3a votes** (vote list): `cmp.preorderTransformers` removed from the list of actions with no vote (the action is
  gone, DC-3). The rest of the check is unchanged.
- **FIN4r M3** (site lease capitalises construction interest): the "did the site ever sit in the power stage" tracking is
  gone and `firstNow` is `true` for every site, because the engine always pays the first construction part in the
  quarter construction starts (DC-3 [D] choice, [D-7]). The check still compares the booked funded amount with
  `constructionGrowth` on the observed schedule (eta, construction quarters) and the preview with `payOptions`. Comment
  now says the upfront 5% accrues over the whole wait and build, and nothing is paid while waiting for power.
  Same intent, same assertions.

## Checks left as they are (read, nothing to change)
- FIN1 leased-site checks (80% funded, funded x CRF at go-live): they force a site to `building` with `stageEndDay`
  tomorrow, which the new `advanceSite` honours.
- FIN1 community default and E27 reactive odds (`oppositionOdds` with `ws3.reactive`, same signature): no price read.
- FIN4r L3 community preview = capex added: price-agnostic; it now prints $1.00B for two 500 MW sites ($1B/GW).
- `scripts/v2/finance.ts` line ~303 (DC-3 deleted it) and the F10 `'gas'` path (DC-3) are as DC-3 left them.

## Checks removed
None. No check tested a removed mechanism beyond the `preorderTransformers` list entry.

## Results
- `npx tsc --noEmit -p .` and `-p scripts/v2`: clean.
- `npx tsx scripts/v2/run.ts --tier quick --only finance`: **FAIL (19 failures), all from the stale fixtures**, not
  from the checks. `scripts/v2/fixtures/day400.json` still has `path: 'lease'`/old `PowerGrid`; the first
  `deserialize` + tick throws `Cannot read properties of undefined (reading 'powerCostMult')` and the "Content: actions
  apply" block fails for every action, ending the run there. Everything before it passed.
- To check the restated checks anyway, I generated a day-400 state in memory with the current engine (same setup and
  RefBot run as `fixtures.ts`) into a temp directory outside the repo, and ran a copy of `finance.ts --smoke` pointed at
  it: **all passed**. F10: blocked 9.3%, delayed 25.5%, median 8 q. FIN1 leased site: funded $6.8B of $8.5B capex.
  FIN4r M3: eta 11 q build 8 q x1.111 (and 14 q x1.116), grid 21 q preview x1.127 vs naive x1.254. L3: $1.00B = $1.00B.
  After the lead regenerates the fixtures the real run should match; re-run it then.

## For the lead
- Regenerate fixtures (`npx tsx scripts/v2/fixtures.ts --write`) and bump `SCHEMA_REV`; the finance run cannot pass before.
- Untracked leftovers in this worktree that I could not delete (delete was denied): `scripts/v2/_dc8tmp/` and
  `scripts/v2/finance_dc8tmp.ts`. They are not committed.
- F7 smoke lines (2026 capex, compute costs, end-2026 power, valuation) and F9/F11 smoke lines read out of band in the
  quick run; they are SMOKE-informational and not owned by this task (calibration moves with DC-3/DC-5 were declared).
