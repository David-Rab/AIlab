# F6b notes (UI half of F6: good-ui pass over the v3 panels; 2026-11-20)

Branch `v3-f6b` (from model-v3 7983b97). UI task: no mechanism, state or schema change. Audit table:
`design/ux/AUDIT-V3.md` (27 items, 8 fixed).

## What changed

- **Preview units** (`ui.tsx lineText/amt`, `kit.tsx lineAmt`, new `pctAmt`): a `progress` line without a unit is a
  display level ("L"); every other `progress` line now carries one. Engine preview output only (no apply, no state):
  research-speed lines in percent points with `unit: '%'` (agentActions edit, teamActions teamGain, spare training
  and spare serving, star hire, siloing, customASIC, gov comply), safety events (control tax %, "days without internal
  agents"), cancel run (% of the run done), pool share (%), research dequeue / move / assign / autoAssign (project,
  days, scientists). Readers of those amounts follow: Split.tsx (÷100), Company GainChip (`unit === '%'`).
  Left as "L": run gains, stream, post-run penalty (levels). Left for the lead: audit items 12–15.
- **Safety › Overview side column** (`Safety.tsx SideSwitch`, `store.ts ANCHOR_SUB`): Control on top, then one of Risk
  families / Successor pull (store tab `safety.side`, default families). The Blueprint's "Successor pull from … ›
  Safety" link goes to anchor `successorPull` and opens the switch on it. One home kept for each.
- **Control › oversight row** (`SafetyControl.tsx`): "gap 0.0" → "self-watched" when the lane's monitor is a copy of
  the model, else "gap x OOM". Tooltip adds blocked by containment, caught by tools and monitors, caught by human review
  from `believedInternalOversight` (now exported from `core/selectors.ts`; the same selector believed control uses).
  Finding: not a bug. At day 900 the gap is 0 because Atlas-4.0 watches itself; oversight is 15% because containment
  is off and the model is 5.4 OOM above expert humans.
- **Data: "unique tokens", not "U"** (Data.tsx, `production/data.ts dataDeltaText`, `dataActions.ts` synth preview,
  glossary `uniqueTokens`): U is understanding everywhere else. `scripts/v2/data.ts` regex follows the delta text.
  Teacher table "G" header is now a Term.
- **Agents at work**: the monitor's catch rate and "same model" tag sit under the picker (`.ag-mon`).
- **Products › Serving compute**: the bar is the pool; unmet demand is a dashed line under it, with its unit and its
  ratio to the pool.
- **Company › Work**: idle formatted with `F.short`.

## Tests

`uitest.mjs`: e12Check opens the successor card through the switch and checks that one card shows at a time
(F6b check at day 1, 400 and 900); at day 400 it checks that the Blueprint link opens Safety on the successor card. D4
tooltip regexes follow "Unique tokens".

## Left for the lead (engine or other worktrees)

See AUDIT-V3 items 9–15: duplicate version names (f6a), starved serving pool at day 0 and day 900 and the usage-data
collapse (balance), the addControl preview's tax line (f6a's file), event placeholder `progress` amounts, tree-node
`0.1 × cap` "L" gains, retire's "0 L option value".

## F6c (follow-up: placeholder preview amounts; 2026-11-20)

Branch `v3-f6c` (from `v3-f6b`). Preview text only: no apply, state or schema change. AUDIT-V3 items 13, 14, 15, 19
and 24 fixed (13 of 27 now).

- **Safety event "Continue"** (`events/catalog/safety.ts frontierRunsGo`): "+1.00 L" → "+N runs · frontier runs keep
  going (no 60-day pause)": the running base and post runs, the same filter the pause choice applies ("0 runs · no
  frontier run to pause" when none).
- **RETIRE** (`actors/actions.ts`): the "progress 1 · the race goes on without you" line and the "boardConf 0" gain are
  gone; the one cost says the game ends (Retired ending, scored as a loss).
- **Tree-node previews** (`models/treeActions.ts capLines`): `0.1 × fx.cap` "L" → the node's typed effect, from the
  numbers adoption applies (`research.ts completeAdoption`): a stack effect is the expected effect at the scale test
  (public prior mean per idea × 1000^s at the prior exponent, `atTest`) in OOM of its stack and its `also` stacks
  ("+0.0079 OOM · Pretraining efficiency per idea (expected)"); a domain effect the prior × OOM per domain ("+1.65 OOM ·
  PHYS for new versions"); data effects in q (web = 1) or OOM worth per token; expert data in B expert tokens. Nodes
  without a typed effect give what they unlock ("+1 option" / "+1 unlock" with the node's stated effect). Negative-cap
  option nodes cost "−0.3 OOM when used" when the node states OOM, else "1 trade-off · when used: …".
- **Retire version** (`models/actions.ts`): "0 L option value" and a made-up "+1% compute" gain → "1 version · <name>
  cannot be deployed, run as agents or evaluated again" (retiring frees nothing: it is refused while the version serves,
  monitors or streams).
- `unitAmt` prints whole amounts without decimals ("1 version", "20 B expert tokens", not "1.00").
- Quick UI units: World › Jobs "Displaced (US) 243 people"; Recipe's adopted list label says (OOM).

Tests: `uitest.mjs` F6c check at day 900: P22's preview is +1.65 OOM PHYS (the domain OOM per unit adoption adds),
L.scale's is OOM of pretraining; Retire version previews the version it retires and retires it.

Left: safety-node previews still give `0.05 × fx.saf` as alignment (a v2 meter scale, not "L"); the Continue choice's
"alignment 0.2 red flag ignored" cost is not applied by the choice (it counts a red flag); audit items 9–12, 16–18,
20–23, 26 stay listed.
