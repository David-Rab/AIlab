# AI27 v2: the engine contract (M0)

This is a short guide for workstream owners. `design/V2-SPEC.md` is the binding spec, and `src/engine/v2/types.ts` is the single state contract. This file tells you where your code goes and how to plug it in.

## 1. Ground rules

- **`types.ts` is WS1-only.** Request changes by PR comment and WS1 merges them within a day. Any breaking change bumps `SCHEMA_REV` in `core/save.ts` and adds a migration.
- **Edit only your own files** (§2). Cross-workstream calls go through the exported functions in §6, never through another workstream's internals.
- **State is plain JSON.** That means no classes, `Map`s, functions or `undefined` values, and no `NaN` or `Infinity`. To clear an optional field, delete it rather than setting it to `undefined`. `hygiene.ts` checks this.
- **Truth stays out of the UI.** UI code under `src/ui/v2/` (except `end/`) never reads `hidden`, `*True`, `pm`, `Lg` or `selectHidden`. It uses selectors only. `lint-hidden.ts` enforces this.
- **Engine-side truth helpers are for engine code, events and endings only.** These are `bestPm`, `trueLeadDays`, `misalignment` and `truePm`.

## 2. File ownership

| WS | Owns |
|---|---|
| WS1 | `types.ts`; `index.ts`; `core/*`; `world/*`; `production/*`; `models/*`; `departments/*`<br>data: `calibration`, `paradigms`, `benchmarks`, `runDesign`<br>scripts: `golden-timelines`, `fixtures`, `hygiene`, `lib`; M1 adds `calib.ts` and `identity.ts` |
| WS2 | `safety/*`<br>data: `agendas`, `findings`, `techniques`, `traits`, `edges`, `umodes` |
| WS3 | `finance/*`, `compute/*`<br>data: `deals`<br>scripts: `finance.ts` (M1) |
| WS4 | `actors/*`, `security/*`, `events/*`, `endings/*`, `bots/*`<br>data: `blocs`, `actions`, `names`, `postures`<br>scripts: `lint-tradeoffs.ts`, `bots.ts` (M2) |
| WS5 | `worldfx/*`<br>data: `sectors`, `techs`<br>scripts: `worldfx.ts` (M1) |
| WS6 | `src/ui/v2/` shell, store, setup, `end/`, Codex<br>data: `glossary`<br>scripts: `lint-hidden.ts` |
| WS7 | `src/ui/v2/panels/*` |

Shared files:
- `models/runs.ts` `continual` is owned by WS1 and WS2.
- The event catalogs in `events/catalog/*.ts` are owned by WS4, with content from the other workstreams.

**Start values are owner-provided.** `core/init.ts` composes `initialSafetyDept`, `initialFinance`, `initialBoard`, `initialSites`, `initialOrders`, `initialCloud`, `initialMarket`, `initialPower`, `initialCapital`, `initialGov`, `initialPublic`, `initialBlocs`, `initialRelations`, `initialResearchBodies`, `initialRival`, `initialChina`, `initialSecurity` and `initialWorld`. To change your start values, edit your own initialiser; `init.ts` does not need to change.

## 3. Systems: how to implement one

Every system id from spec §2.2 is already registered in `core/registry.ts`, in order, as a no-op exported from its owner's file. For example, `finance/cashflow.ts` exports `opexSystem` (130, daily) and `payrollSystem` (300, monthly).

To implement a system, fill in its `run(s, ctx)` in your file. Do not touch the registry. The registry is ordered by spec order:

```ts
export const opexSystem: EngineSystem = {
  id: 'opex', owner: 'WS3', cadence: 'daily', order: 130,
  run(s, ctx) {
    const cost = dailyOpex(s);
    ctx.bump('cash', -cost, 'opex', 'power + O&M');   // applies, clamps, records the cause
  },
};
```

- **Tick.** `tick(s)` computes the cadences due on day + 1, then runs the due systems in ascending `order`. `clock` (10) runs first and advances `s.time.day`.
- **Cadences.** `weekly` runs when `day % 7 == 0`. `monthly` runs on the 1st. `quarterly` runs on 1 Jan, Apr, Jul and Oct. `semiannual` runs on 1 Jan and Jul.
- **Adding a system.** A new system (not in §2.2) needs one line in `registry.ts` at a free order number, plus the matching row in `hygiene.ts`'s SPEC table. Ask WS1.
- **Shared values within a tick.** Use `memo(ctx, 'WS2:understanding', () => …)` from `core/memo.ts`.
- **Actions and events.**
  - Add `ActionDef`s to your sphere's array: `MODEL_ACTIONS`, `SAFETY_ACTIONS`, `FINANCE_ACTIONS`, `RELATION_ACTIONS` or `WORLD_ACTIONS`.
  - Add `EventDefV2`s to `events/catalog/<cat>.ts`.
  - The registry aggregates both. Every `preview()` must pass `lint-tradeoffs.ts`: at least one cost in a currency that is not among its gains.
- **Queueing a decision.** Systems call `ctx.queue(eventId, data)`. The player resolves it through `resolve(s, instance, choice)`.

## 4. EngineApi and selectors (UI and bots)

Import everything from `src/engine/v2` (`index.ts`):

| Call | Returns | Provider |
|---|---|---|
| `engine.newGame(setup)`, `defaultSetupV2(over)` | full `GameStateV2` | WS1 `core/init.ts` |
| `engine.tick(s, opts?)` | one day | WS1 `core/loop.ts` |
| `engine.act(s, actionId, params)` / `engine.resolve(s, instance, choice)` | throws on error. `act`/`resolve` from `core/loop.ts` return an error string instead. | WS1 |
| `production(s, lab)` | `ProductionReadout` (bottleneck bar) | WS1 `production/readout.ts` |
| `understanding(s)` | `{ U, margin, perTrait }` | WS2 `safety/understanding.ts` |
| `leadDays(s, lab)` | `{ est, sd }`, the intel estimate vs the player's best internal model | WS4 `actors/intel.ts` |
| `riskSources(s)` | `RiskSource[]`, built from beliefs | WS4 `actors/intel.ts` |
| `raiseCeiling(s)` | `{ max, bound, parts }` | WS3 `finance/equity.ts` |
| `causeStrip(s, key, days=30, top=5)` | "why" tooltip rows | WS1 `core/causes.ts` |
| `measuredL`, `activeRivals`, `nextModelGate`, `dateOf`, `fmtDate`, `decimalYear` | — | WS1 |
| `selectHidden(s)` | the hidden world; **end screen only** | WS1 |
| `serialize`, `deserialize`, `stateHash`, `AUTOSAVE_KEY`, `SLOT_KEYS`, `V1_SAVE_KEY` | save format (§2.5) | WS1 `core/save.ts` |

Lab API for engine code, in `models/labs.ts`: `labCore`, `otherLabs`, `activeRivals`, `activeLabIds`, `internalVersion`, `bestPlayerVersion`, `bestPm` and `bestLg`. The ids are `'player'`, `'r0'`–`'r3'` and `'china'`.

## 5. RNG streams and the cause ledger

**RNG.** Inside systems, use `ctx.rng(stream)`. Outside a tick, use `stream(s, id)` from `core/rng.ts`. Never use `Math.random`. Draw only from your own streams:

| Stream | Owner |
|---|---|
| `world` | WS1 (newGame and clock only) |
| `prod`, `runs` | WS1 |
| `safety`, `incidents` | WS2 |
| `market`, `finance` | WS3 |
| `security`, `actors`, `rivals`, `china`, `events`, `endings` | WS4 |
| `worldfx` | WS5 |

`RngLike` offers `float`, `range`, `chance`, `normal`, `lognormal80`, `beta`, `pick` and `weighted`. `StreamRng` adds `normal80`, `gamma` and `int`. Each stream is seeded from `hash32(seed, name)`, so your draws never shift another workstream's sequence. `hygiene.ts` tests this.

**Causes (§2.6).** Any change to a top-level meter must be recorded:
- `ctx.bump(key, Δ, source, detail?)` applies the change, clamps it to the meter's range, records the cause, and returns the delta actually applied.
- `ctx.cause(key, Δ, source, detail?)` only records. Use it when you set the value yourself.

The keys are the spec's: `trust:<counterparty>`, `relations.credibility`, `relations.scrutiny`, `pub.approval`, `pub.concern`, `player.finance.valuation`, `cash`, `revenueRun`, `board.confidence`, `player.pa`, `morale`, `morale.safety`, `gov.securityDemand`, `gov.nationalization`, `china.theftIntent` and `world.unemployment.US`. Any dotted path to a number also works, such as `pub.activism`. An unknown path throws.

## 6. What each workstream must provide (spec §8.3 "Provides")

| WS | Exported names (stub exists, file in brackets) |
|---|---|
| WS1 | `tick`, `act`, `resolve` [core/loop]<br>`SYSTEMS`, `ACTIONS`, `EVENTS` [core/registry]<br>`stream`, `hash32` [core/rng]<br>`bumpMeter`, `recordCause`, `causeStrip` [core/causes]<br>`production`, `nextModelGate` [production/readout]<br>`computeProduction` [production/production]<br>`trueLeadDays`, `levelOf`, `domainsOf`, `milestonesSystem` [models/capability]<br>`launchRun` [models/runs]<br>`deploy` [models/deployments]<br>`benchScore`, `runEvalSuite` [models/benchmarks]<br>lab API [models/labs]<br>milestone first crossings in `milestoneDays` and `scDay` |
| WS2 | `applyRunToTraits(s, ctx, run, version)` [safety/traits], the WS1 run-completion hook<br>`misalignment`, `misalignmentEstimate` [safety/traits]<br>`understanding` [safety/understanding]<br>`updateBelief`, `observe` [safety/detection]<br>`openIncidents`, `exfiltrationHazard` [safety/incidents]<br>`fireFinding`, `publishFinding` [safety/findings]<br>`lambda2Eff`, `techniqueStrength`, `discoverUMode`, `openInvestigation`, `applyResponse` |
| WS3 | `computeOnlineSystem`, `computeOnlineOf` [compute/power]<br>`raiseCeiling`, `valuationMark`, `kY` [finance/equity]<br>`runwayState`, `runwayQuarters` [finance/runway]<br>`ledgerDue` [finance/ledger]<br>`interestPerYear`, `drawDebt` [finance/debt]<br>`acceptDeal` [finance/deals]<br>quarterly systems `marketQ`, `sitesQ`, `capitalQ`, `boardQ` |
| WS4 | `directorSystem` [events/director]<br>`RELATION_ACTIONS` [actors/actions]<br>`PREDICATES`, `liveCommitments` [actors/commitments]<br>`initialRival`, `rivalsChinaSystem`, `activeRivals` [actors/rivals]<br>`initialChina`, `geoQSystem` [actors/china]<br>`leadDays`, `riskSources`, `intelSystem` [actors/intel]<br>`endingsSystem` [endings/endings]<br>`scoreEnding`, `verdictOf` [endings/scoring]<br>`topDecisions`, `runEpilogue`<br>`theftHazardDaily`, `theftP2mo` [security/theft]<br>bots `refBot`, `raceBot`, `safeBot`, `mixedBot`, `capex2xBot` |
| WS5 | `revenueSystem`, `revenueOf` [worldfx/revenue]: WS5 writes `deployment.revenueRate` and bumps `cash`<br>`worldDailySystem`, `initialWorld` [worldfx/sectors]<br>`leverage` [worldfx/control]<br>`macroSystem` [worldfx/macro]<br>`HEADLINES` [worldfx/headlines]<br>`advanceTechs`, `advanceRobots` |
| WS6 / WS7 | Consume §4 only. WS6 owns `src/ui/v2/App.tsx`, which is the mount point. |

## 7. Tests, fixtures, running v2

- **`npm run test:v2`** runs the following in order:
  1. type-checks `scripts/v2`;
  2. `golden-timelines.ts` writes `scripts/v2/golden/timelines.json`;
  3. `fixtures.ts`;
  4. `hygiene.ts`, which covers the registry, newGame validity, determinism over 1,500 ticks, stream isolation, save round-trip and size, cadences, causes and performance;
  5. `lint-hidden.ts`;
  6. `lint-tradeoffs.ts`.

  Add your own script to the chain. Every script exits non-zero on failure.
- **Fixtures.** `npm run fixtures:v2` writes `scripts/v2/fixtures/day0.json`, `day400.json` and `day900.json`. These use the ai2027 preset, seed 2027, classic baseline and medium alignment. Load them with `deserialize(readFileSync(...))`. They are the UI's canned states and the lint's canned states.
- **Running the UI.** `npm run dev`, or `npm run build` and open `dist/index.html`. (Until 2026-11-15 v1 was the default and v2 needed `?v2`.)
- **Determinism for your unit scripts.** Use `tick(s, { extraSystems, skip })` to inject probes or skip systems.

## 8. M0 placeholders and deviations (WS1 removes them in M1)

**Placeholder progress.** `production/placeholder.ts` has `M0_PLACEHOLDER_PROGRESS = true`:
- every lab's `pa` follows the v1 reference integrator;
- the frontier version tracks `pm = pa`;
- `measuredL = Lg` (no noise);
- the readouts are neutral (all ratios 1).

The player's milestone days equal the golden ai2027 days exactly: A1 209, A2 535, SC 638, SAR 791, SIAR 883 and ASI 915. Rivals keep constant progress gaps.

**Other placeholders:**
- `understanding()` returns U = L − 0.5.
- `riskSources()` returns flat rows.
- `raiseCeiling()` uses a fixed 40% pool share.
- The knots are `[]` and `calShift = 0`.
- Every other system is a no-op, so cash, actors and the world stay at their start values.

**Golden deviations.** `src/data/world.ts` is unchanged by rule. Its integrator matches research/11 §5 for ai2027 and fast. It deviates on three checks, which are printed as WARN:
- authors2026 runs a constant 0.09 y early on every milestone;
- slow reaches SC at 2038.5 against R11's 2034–35;
- the sampled p50 is 2028.0 against 2028.37.

The JSON's `computed` dates are the binding golden for T1. Any new mismatch fails.

**Contract changes from `design/v2-interfaces.ts`:**
- `SystemCtx.day` and `SystemCtx.bump` were added.
- `BotPolicy.id` gains `capex2x`.
- `tick` accepts `TickOptions`.
- Control `P` and sector `A` and `alpha` are 0–1 fractions.

**Files added beyond spec §8.1:**
- `core/clock.ts` and `core/record.ts`;
- `models/labs.ts`;
- `models/actions.ts`, `safety/actions.ts`, `finance/actions.ts` and `worldfx/actions.ts`;
- `production/placeholder.ts`;
- `data/v2/postures.ts`.

**v1 change.** `src/engine/rng.ts` gained `gamma()` and `beta()`. The change is additive, and v1's draws are unchanged.
