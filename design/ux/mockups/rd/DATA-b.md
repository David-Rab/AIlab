# R&D mockups, set b: where every number comes from

Screens: TRAINING › Data, Environments, Runs; LAB › Hiring & teams, AI staff & needs, Security.

Source: the day-400 RefBot fixture `scripts/v2/fixtures/day400.json` (seed 2027, ai2027), read through the engine's
player-facing views.
- `_data-b.ts` writes `data400-b.json`: data, environments, runs, hiring, AI staff, security.
- `_data-b-runs.ts` writes `data400-b-runs.json`: the Runs screen.
- Run either with `npx tsx design/ux/mockups/rd/<script>` from the worktree root.
- Render with `node render.mjs train-data train-data:drawer train-env train-runs train-runs:drawer lab-hiring lab-aistaff lab-security`.

Basis: F = fact, M = measured, B = belief. **NEW** marks a value that needs a new player-facing readout.

## Shared rules

- The top bar is the approved day-400 shell (`data.js`, DATA.md).
- The Runs screen is the exception. It shows Dec 8, 2026, so it can show finished runs that have forecasts (see Runs).
- LAB gets sub-tabs: Allocation (the approved LAB screen) · Hiring & teams · AI staff & needs · Security.
- Data source colours are validated with the dataviz validator: dark mode on the panel surface, all checks pass. The five sources are:
  - Public web `#3987e5`
  - Licensed `#d55181`
  - Usage `#c98500`
  - Generated `#9085e9`
  - Expert `#199e70`

## TRAINING › Data (`train-data.png`, `train-data-drawer.png`)

| On screen | Value | From | Basis |
|---|---|---|---|
| Reads per token, next run | 0.45 | `runCard(default base plan).limits` (epochs 0.448: 440T drawn ÷ 982T usable) | B·fc |
| Verdict Enough; gauge zones ≤ 1 · ≤ 4 · short | Enough | **NEW**: the engine has no verdict. The 4-reads line follows the ~4 free epochs in `production/data.ts` (Muennighoff) | B |
| Plan line | New base, 1.1T parameters, Balanced, draws 440T | `runCard` plan (`params`, `tpp` 400, `data`) | F |
| Quality of what it reads | 0.80 × public web | `nextRun.meanQuality` | F |
| Generated share | 77% of tokens at 0.66 | `dataPortfolioView` byKind (1,364T of 1,765T; quality 0.658) | F |
| New data a day | +5.5T (generated 5.3, usage 0.2) | `dataPortfolioView` synthetic `perDayT`, `usageLevels` current | F |
| Data by domain, by source | e.g. Code 179T = web 21.6 + licensed 4.5 + generated 152.8 | each source's tokens × its domain mix (`byKind[].mix`) | F |
| Next run reads per domain | 40–86T (Social 86T) | 440T × the run's domain share (`drawByDomain` rows) | B·fc |
| Generated data by teacher | 12 bars: Atlas-1.0 42T … Atlas-2.8 183T, Atlas-2.10 47T (writing now) | synthetic assets (`syn:V*`: tokens, day, quality). The teacher name is the version id's model | F |
| Teacher quality | Atlas-1 0.50, Atlas-2 0.74–0.76 | asset `quality` | F |
| Sources: tokens, quality | web 270T q1.0 (90% of 300T crawled) · licensed 30T q1.0 · usage 101T q0.5 · generated 1,364T q0.66 · expert 0.012T q3.0 | `dataPortfolioView`, raw assets | F |
| Usage policy | Standard; Broad +0.5T a day, civil liberties −6; None +4 | `usageLevels` | F |
| Data generation share | 22% of compute (link to LAB) | `poolsOf` synthetic share | F |
| Licence drawer: tiers | Bulk archives q1.5 $0.1B/T · Curated q2 $2B/T · Books & textbooks q3 $30B/T · 60 days | `licenceForm` (`LICENCE_TIERS`) | F |
| Licence drawer: before → after (10T of Code, Bulk) | $1.0B · arrives Oct 4 · Code 179 → 189T · Code share 10.2 → 11.2% · Code skill ▲ small · reads 0.45 → 0.45 | `licenceForm` `delta` (share, `s` +0.065 shown only as ▲) | F / B |

**NEW for Data:**
- Licence offers from named sellers. Today the tiers are a fixed menu.
- An enough / short verdict on data.
- Per-domain reads per token. The engine gives one value for every domain.
- A believed teacher quality preview for generating data. `teacherRows` and `synForm` read true G and `s.hidden`, so they are not used.

## TRAINING › Environments (`train-env.png`)

| On screen | Value | From | Basis |
|---|---|---|---|
| Families, used by next run | 6 built, each 1/6 of a Broad post-training; Computer use none | `suitesView` rows `share`, `usedByNextPost`; `allFamilies` | F |
| Realism | 99% for all six | `suitesView` `fid` 0.994 | F |
| Loopholes | Coding 18% · ML research 12% · Math 6% · Long tasks, Cyber, Bio 1% | `suitesView` `exploit` | F (should be B: see NEW) |
| Share of hacking pressure | 46 · 31 · 15 · 3 · 3 · 3% | `suiteS2Parts` rows (each family's part ÷ 0.357) | B |
| Hacking pressure | High (0.754) | `suiteS2Parts` 0.357 × the Standard budget's pressure → `s2` 0.754 | B |
| Pushes ▲ Gaming | Gaming ↑ | `plannedPressure` (Next run) | B |
| Harden | Loopholes → 11.5 / 7.7 / 3.8 / 0.6%; 1 d (engineers spare); $49M | `suiteWorkPreview` harden (`exploit` after, `cashB` 0.049, `tw` 1.48, `waitDays` 1) | F / B |
| Expand | Realism → 114%; 1 d; $100M | `suiteWorkPreview` build (`fid` 1.144, `cashB` 0.1) | F / B |
| Ways to lower it | Harden Coding 0.754 → 0.70 (High); the three 0.754 → ~0.65 (Medium); Light budget lowers it | `s2After` per harden; the three summed | B |
| Computer use locked | needs the discovery Computer use | `unbuiltSuites` empty; the family needs a discovery (SESSION-HEAD §11) | F |

**NEW for Environments:**
- A low / medium / high scale for hacking pressure. The mockup uses thirds of 0–1.
- Loopholes as a belief. Today the true value is shown as it is.
- What Expand buys in skill. The engine's preview reads true stacks, so it is not used.
- Combined previews for several jobs at once.

## TRAINING › Runs (`train-runs.png`, `train-runs-drawer.png`)

The fixture has no run in flight, and its runs carry no stored forecast; the engine began storing `run.forecast` later. So
`_data-b-runs.ts` plays the fixture on through the engine:
- On Aug 5 it launches the Next run default plan (new base), a post-training on base Atlas-3, and a distil from Atlas-2.10.
- It then steps the engine to Dec 8, 2026, the day after Atlas-3.0 was measured. This takes 2.4 s.
- Every value comes from engine views at that date.

| On screen | Value | From | Basis |
|---|---|---|---|
| Top bar | Dec 8, 2026 · ×2.4 · 56 d behind xLab · $56.2B · 8+ qtrs · 0.1% · 3 alerts | `labSpeedView`, `nearestRival`, `runwayLive`, `controlReadout`, alert log | B / F |
| Runs before Aug 2026 | launch dates and kinds; each result is the next model of its kind (Post-training 9 → Atlas-2.0 … 30 → Atlas-2.10; Distil 11 → 2.0-mini …; Pretraining 4 → base Atlas-2, 21 → base Atlas-3) | `p.models.runs` (`startDay`, `kind`), versions (`day`). Pairing by order and dates, which match `etaAtLaunchDays` | F |
| Pretraining 32 | 70%, due Jan 31, 2027 (54 d), 60% of training compute, no holdups | `runs` `progress`, `runEtaDays`, `poolShare`, `runStall` | F / B·fc |
| Forecast ranges | Post-training 33: 8.50–8.74 · Distil 34: 4.74–4.98 · Pretraining 32: 8.94–9.22 | `run.forecast` (`runForecast` at launch) → `forecastBand` | B·fc |
| Measured | Atlas-3.0 8.45 ± 0.07 (Dec 7): below the range, −2.4 sd · Atlas-2.10-mini 4.93 ± 0.08 (Aug 21): inside, +1.0 sd | `evals.measuredL`, `measuredSd` | M |
| Forecast chart | each row centred on its forecast, shared ±0.45 levels; numbers only in the drawer, as differences | as above | B / M |
| Would meet Research agent | 9.08 vs the rung at 8.5 | forecast mid vs `LEVEL_KNOTS` | B·fc |
| Evals | Atlas-3.0 Nov 23 → Dec 7; Atlas-2.10 re-test 14%, due Dec 20 | `evalQueueView` | F |
| Training compute now | 60% Pretraining 32 · 40% idle | `poolAllocation`, `idleTrainingShare` | F |
| Drawer | +1.72 over Atlas-2.8 (+1.60 to +1.84) vs +1.55 (+1.43 to +1.67); 110 d; training share 20% | forecast mid − ref 6.90; measured − 6.90 | B / M |

- The forecast's spread is almost all evaluation noise: the believed-ideas part is 0.006 sd and the start-model part is 0.
- So post-training forecasts look too sure, and the drawer says so.

**NEW for Runs:**
- A stored link from each run to the model it made.
- A run's end date.
- The drawer's launch snapshot, read from the run. The mockup shows the plan defaults.
- A reason when a run takes longer than its launch ETA. Post-training 33 took 110 d at a 20% share.

## LAB › Hiring & teams (`lab-hiring.png`)

| On screen | Value | From | Basis |
|---|---|---|---|
| Teams, people, quality | Engineers 750 / 5 · capability research engineers 1,500 / 15 · scientists 400 / 10 · safety research engineers 100 / 1 · safety scientists 80 / 2; all Strong | `teamsOfKey` | F |
| Filling team | Engineers: 32 of 150, 8 wk left | `queuedOfKey` / `filling` | F / B·fc |
| Hiring target | 6 · 15 · 10 · 1 · 2 | `p.hiring` targets | F |
| Cost a team (Strong) | $105M · $80M · $40M · $65M · $32M a year | `fullTeamPayroll` | F |
| Payroll per role | $525M · $1.2B · $400M · $65M · $64M; $2.28B in all | `teamPayroll`, `payrollOf` | F |
| Time to hire a team | ~17 · 14 · 10 · 10 · 4 wk | `fillWeeks` | B·fc |
| Next team buys | nothing now (77% spare) · nothing now (3 teams spare) · little · +0.1 safety results/yr and ends the shortage · +0.5 /yr | `teamGain` (as on the approved LAB Best moves / Won't help) | B |
| Team offers | Engineers $105M leaves Aug 11 · Safety research engineers $65M Aug 18 · Scientists (systems) $40M Aug 25 · Engineers $105M Sep 1 | `p.hiring.candidates` | F |
| Hiring speed | 21 people a week, 11 safety | `weeklyHireCap` | F |
| Morale | 70; safety staff 65 | `p.morale` | F |
| Star hire | none; idea quality ▲, team cooperation −20, $300M | `STAR_HIRE` rule | F |

**NEW for Hiring:** a per-team morale or retention readout; attrition and poaching losses (rivals' poaching aggression is
not shown).

## LAB › AI staff & needs (`lab-aistaff.png`)

AI share and work done use the same values as the approved LAB board (`data400.json` B).

| On screen | Value | From | Basis |
|---|---|---|---|
| Model per job | Engineering Atlas-2.8 · Experiments Atlas-2.10 (in evals) · Ideas Atlas-2.8 · Safety Atlas-2.8 | `agentsView.lanes` | F |
| Copies, compute | 19.6k / 33k H100e (0.9%) · 63.9k / 106k (2.8%) · 14.7k / 25k (0.6%) · 0 | `agentsView.lanes` `copies`, `h100e`; `poolsOf` shares | F |
| AI share | 63 · 35 · 7 · 0% | `workTypeViews` `coverage` | M |
| Work done | ×6.1 · ×2.4 · ×1.2 · ×1.0 | `workTypeViews` `multiplier` | B |
| Cost per hour of work | $0.29 AI · $560 people | `workTypeViews` `costAIperHour`, `costHumanPerHour` | F |
| Watched by | Engineering none · Experiments Atlas-2.6 · Ideas Atlas-2.6 | `agentsView.lanes.monitor` | F |
| AI share allowed (safety) | 0% | `agentsView.trusted.policy` | F |
| Totals | 98k copies · 165k H100e · $1.35B/yr | `agentsView` `totalH100e`, `totalCost` | F |
| Engineers' needs | Run setups none · Upkeep 23% of build capacity (products 18%, watchers 3%, tools 2%, environments 1%) · Build queue empty · Spare 77% | `engAllocView`, `upkeepLines` (7.0 of 30.3 team-weeks a week) | F |
| Capability research engineers | Run operations none · Research experiments 12 teams · Spare 3 | `reAllocView` | F |
| Safety research engineers | Human review 19 · Spot-checks none · Cases none · Validations 40 · Safety evals 20 · Foothold removal none · Research experiments 21 of 31 (short 10) | `safReAllocView` | F |
| Lab tools | none owned, 3 to build (link to Know-how) | `p.tooling` vs `INTERNAL_TOOLS` | F |

- `_data-b.ts` reads ×5.0 / ×2.1 / ×1.14 for work done through a later `workTypeViews` call.
- The mockup keeps the approved board's values so the two LAB screens agree.
- AI share comes from the work fit on the model's true G. The approved board shows it too. **NEW**: measured AI share.

## LAB › Security (`lab-security.png`)

| On screen | Value | From | Basis |
|---|---|---|---|
| Weight security | 3.1 | `p.security.wsl` 3.077 | F |
| Industry baseline | 3.1 now, 3.3 from Jan 2027 | `securityFloorView` / `wslFloor` (2.2 + 0.55 per year since 2025, capped at 2 years) | F |
| Your target | 2.4 | `security.target` | F |
| SL1–SL5 "stops …" | RAND *Securing AI Model Weights* (2024) security levels | assumed mapping of the engine scale (2–5) to RAND SL | — |
| Spend to reach and hold | 3.5 $1.51B · 4 $2.36B · 4.5 $3.71B · 5 $5.81B a year | `reqSpend(L, computeOnline)` | F |
| Time to reach | 70 d · 5 · 8 · 11 months | 0.006 a day from 3.08 (`securitySystem`) | B·fc |
| Theft risk per level | 17% · 10% · 3% · < 1% | `intel.ts` pTheft: 0.05 + 0.15 × (3.5 − level) + China theft intent ÷ 300 | B |
| Drivers | weight security 60%, China's intent 40% | the theft row `drivers` | B |
| Who wants the weights | DeepCent (China), theft intent 16 of 100 | `s.china.meters.theftIntent` (shown on Relations) | B·intel |
| Thefts detected | none | `detectedThefts` | F |
| People with access | 2,830; Partial 1,981; Strict 1,132 | `privilegedOf` at siloing 0 / 1 / 2 | F |
| Counter-intelligence, clearances | 10%; not required | `counterIntel`, `clearances` | F |
| Secrets security | 2.5 | `ssl` | F |
| Budget | $0.30B a year | `spendRate` | F |
| Log | Feb 16, 2026: defense contract security clauses | `s.log` | F |

**NEW for Security:**
- A theft risk with a time span (per year). The engine's pTheft has no horizon.
- An estimate of spies. Today only hidden truth exists.
- What siloing costs. The engine models no research slowdown, so the mockup shows no cost.
- A leak record for know-how.
