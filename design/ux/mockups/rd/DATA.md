# R&D mockups: where every number comes from

Source: the day-400 RefBot fixture `scripts/v2/fixtures/day400.json` (seed 2027, ai2027). `_data.ts` loads it and calls the
engine's player-facing view functions. Its output, `data400.json`, holds the raw values (run it with
`npx tsx design/ux/mockups/rd/_data.ts`). `data.js`, `res-data.js`, `tip.js` and `drawer.js` hold the rounded values the
mockups show. Render a mockup with `node render.mjs lab lab:tip portfolio portfolio:drawer`.

Basis: F = fact, M = measured, B = belief. **NEW** = needs a new readout (the engine has no player-facing value for it yet).

## L0 shell

| On screen | Value | From | Basis |
|---|---|---|---|
| Date, day | Aug 5, 2026 · 400 | state clock | F |
| Research speed | ×3.0 | `models/researchView.ts:labSpeedView` (rel vs the leader at day 0 = 2.986) | B |
| Research speed trend arrow / sparkline | not shown | **NEW**: only the AI staff experiments multiplier has a series (`s.series.M`) | — |
| Lead · nearest | −154 d · Meridian | `ui/v2/shell/selectors.ts:nearestRival` (wraps `intel.ts:leadDays`; ±46 d sd) | B·intel |
| Lead range (tooltip) | — | **NEW**: the engine has an sd, not a low–high range | — |
| Cash · runway | $51.6B · 8+ qtrs | `selectors.ts:runwayLive` (runway capped at 8 q; revenue $32.7B/yr exceeds costs) | F; runway B·fc |
| Loss-of-control risk | < 0.1% (lab: the highest over running models) | `safety/dangerView.ts:controlReadout` (→ `lossRisk.ts:modelLossRisk`) | B |
| Alerts | 5 · 3 research, 2 world | `AlertQueue.tsx:alertGroups` logic (sev ≥ 2, last 30 d) | F |
| Badges | Lab "idle", Research 1 | idle shares (below); one failed project | F |


## LAB

| On screen | Value | From | Basis |
|---|---|---|---|
| Compute online | 3.8M H100e | `compute/power.ts:poolsOf` total | F |
| Allocation by use (10 uses) | Training 39.6% · Data generation 22.1% · Research experiments 7.0% · AI staff engineering 0.9% / experiments 2.8% / ideas 0.6% / safety 0% · Safety work 0.3% · Safeguards 0.1% · Products 26.6% | `poolsOf` split shares | F |
| Idle per use, total | Training 1.51M (all), Products 244k; total 46% · 1.75M | `departments/autoSplit.ts:idleShares` + `Split.tsx:34-36` inline | F |
| "no run queued" (why Training is idle) | — | inferred from Training idle = the whole training pool; **NEW** as a reason string | F |
| Group totals | Capability 73% · Safety 0.4% · Products 27% | sum of the uses above (AI staff engineering counted as capability) | F |
| Auto-split idle compute | off | `autoSplit` state | F |
| People, teams, quality | 750/5 · 1,500/15 · 400/10 · 100/1 · 80/2, all Strong | `departments/teams.ts:teamsOfKey` | F |
| AI staff: model, copies | Atlas-2.8 19.6k · Atlas-2.10 63.9k · Atlas-2.8 14.7k · safety 0 | `departments/agentActions.ts:agentsView` | F |
| AI share | 63% · 35% · 7% · 0% | `researchView.ts:workTypeViews` (`coverage`) | M |
| Total effort | ×6.1 · ×2.4 · ×1.2 · ×1.0 | `workTypeViews` `multiplier` (effective ÷ human team-eq) | B |
| Needs, engineers | run setup 0 · upkeep 7.0 of 30.3 team-wk/wk (products & tools 20%, safeguards 3%) · builds 0 · spare 77% | `researchView.ts:engAllocView`, `build.ts:upkeepLines` | F |
| Needs, research engineers | run operations 0 · experiments 12 of 15 teams · spare 3 (2 per programme max) | `researchView.ts:reAllocView` | F |
| Needs, safety research engineers | human review 19 · validations 40 · safety evals 20 · research experiments 21 of 31 people (short 10) · cases, foothold removal 0 | `researchView.ts:safReAllocView` | F |
| Scientists' work | 10 teams on 6 programmes, 0 idle · 2 safety teams on 1 programme | `teams.ts` assignments | F |
| AI share allowed (safety) | 0% | `agentsView.trusted.policy` | F |
| Best move 1 | idle Training → experiments (+21% of compute = experiments ×4) → research speed +66% (×3.0 → ×5.0) | `production/readout.ts:responseCurves` (believed) at ×4 = 1.659; ×5.0 = 2.986 × 1.659 | B |
| Best moves 2, 3 | safety scientist team +0.54 results/yr · safety RE team +0.1 results/yr | `departments/teamActions.ts:teamGain` | B |
| Hire cost, time | $32M/yr · ~4 wk; $65M/yr · ~9 wk | `teams.ts:teamPayroll` per team; `weeklyHireCap` (10.8 people/wk) | F; time B·fc |
| Won't help now | RE 3 teams spare · engineers 77% spare · scientists: no programme waits for ideas · AI staff compute no gain | `teamGain` (0 / idle) and the flat "agents" response curve | B |
| Research speed tooltip | research compute 398k (experiments 267k, AI staff 131k); RE ×2.36, scientists ×1.19; experiments ×2.23 (90 d) → ×2.30 (30 d) → ×2.36 | `labSpeedView` (`researchH100e`, `mExp`, `mIdeas`), `s.series.M` | B |
| Limited by | compute | `engine.production().label` / `production/believed.ts:believedElasticities` | B |

**NEW for LAB:**
- A ranking of Best moves across targets: research speed % and safety results/yr have no common value, so the list sorts within targets.
- AI's part of research speed as one × (UI-IA L0 #6 tooltip). Today there are two job multipliers.
- "+10% compute" previews for uses other than research experiments: there are believed curves only for humans, experiments and agents.
- Hire time to fill as a readout (today it is derived from the weekly hire cap).


## RESEARCH › Portfolio

| On screen | Value | From | Basis |
|---|---|---|---|
| Limited by strip | compute limits most; research engineers spare; scientists enough; idea quality not limiting | `production().label` = compute-bound; RE spare from `reAllocView`; science from `teamGain` | B |
| Verdict words for the three non-binding inputs | — | **NEW**: the engine gives one label only; these words are derived | B |
| Science teams split | 10 · 2 | `teams.ts` | F |
| Programme list, priority order | 6 programmes, ranks 1–6 | `researchView.ts:capPriorityList` | F |
| Stage, progress in stage | e.g. Big test 3%, Small test 54% | `capPriorityList` `stage`, `stageFrac` | F |
| Next result | ~10 · 8 · 7 · 14 · 3 · 4 d | `capPriorityList` `eta` | B·fc |
| Expected effect (range) | +1.3% (0.7–1.9%) … +3.8% (2.6–5.2%) of the named know-how area | `capPriorityList` `belief.mu` and 90% range in OOM, shown as (10^x − 1) | B |
| Returns falling | ×0.75 · 0.73 · 0.72 · 0.87 · 0.51 · 0.43 | 1 ÷ `line.harder` (R / n0) | B |
| Teams, teams wanted | 2/2 · 3/3 · 1/1 · 1/1 · 2/2 · 1/1 | `capPriorityList` `teams`, `teamsWanted` | F |
| Failed project | Multi-agent orchestration, chance it works on retry 24% | `capPriorityList.failed[0].odds` | B |
| Safety programmes | Applied interp (2 teams, Deception probe ~47 d, outlook Mixed); Model organisms & evals, AI control, CoT monitorability (Promising, no team); 14 more (8 Mixed, 6 Struggling) | `safety/view.ts:safetyView` (lines, health label) | F; outlook B |
| Safety output tag (see / stop / fix) | see · see · stop · see | the role (detect / contain / fix) of the programme's techniques in `safetyView.techniques` | F |
| Safety "next" result names | Deception probe · Auditing agents · Comms lockdown · Monitorability suite | line `next` technique ids → display names | F |
| Per-card limit (Applied interp) | research engineers | `safReAllocView`: safety experiments short 10 people | F |
| Safety stage track (Ideas · Small test · Big test · Validate) | Applied interp drawn at "Big test" | **NEW**: safety programmes expose project progress (50%) only, not stages | — |
| Safety programme priority order | staffed first, then by outlook | **NEW**: idle safety programmes have no priority order in the engine | — |

**Drawer (Optimizer & architecture tweaks):**
- Small test 54%, ~14 d: `capPriorityList`.
- Expected effect +3.7% (0.7–6.7%), from `belief.mu` 0.016 and sd 0.008. "Not tested at scale" is `belief.tested = false`. The words "fairly unsure" are **NEW** (a sd-to-word mapping).
- At scale "shrinks": `belief.sMu` −0.25 (± 0.2).
- Built in 4 results, +13% pretraining recipe: `line.gen`, `line.realised`.
- Returns ×0.87: from `line.harder`. Dropped 4: `drops`. In this test 3: `cands`.
- Gets:
  - 1 science team, in the right field: `teams[].match`.
  - 2 research-engineer teams: `perProject`.
  - ⅙ of experiment compute (44k H100e): equal `flopDay` across the six programmes. A per-programme compute readout is **NEW** (today it is derived).
- Idea choice Balanced: the lab-wide risk policy. A per-programme choice is **NEW** (UI-IA L2).
- Takes effect "new base model": the know-how area (pretraining recipe).

## Revision 2 (designer feedback)

- **L0:** Lead reads "154 d behind Meridian" (same `nearestRival` value). Loss-of-control risk shows "< 0.1%" with no model name.
- **LAB:**
  - The allocation presets are dropped.
  - Workforce is one line per role: people · AI staff · work done (the same `multiplier` as before) · short / spare.
  - Short / spare comes from the needs views above: engineers spare 23.3 of 30.3 = 77%; capability research engineers 3 teams idle; safety research engineers short 10.25 people on research experiments.
  - The needs list opens on click (`lab-needs.png`). It shows staff used per need: 19 · 40 · 20 · 21 of 31 people (`safReAllocView`).
- **Portfolio, capability cards:** the effect is shown where it lands, as × effective compute on the next model in that area: × = 10^`belief.mu`. Scaling 0.006 → ×1.013 (it reads ×1.014 at full precision); env 0.004 → ×1.009; opt 0.016 → ×1.037; post-training method 0.007 → ×1.016; serving 0.016 → ×1.038 work per chip. The range moves to the tooltip and the drawer.
- **Portfolio, returns:** "results now ~¾ of the first" = 1 ÷ `line.harder` rounded to a simple fraction (0.75, 0.73, 0.72 → ¾; 0.87 → ⅞; 0.51 → ½; 0.43 → ⅖).
- **Display names** (engine name → VOCAB-safe name; **NEW**: the engine and glossary need these names):

  | Engine name | Shown as | Why |
  |---|---|---|
  | RL algorithms | Post-training algorithms | no "RL" |
  | Inference efficiency | Faster serving | "Serving efficiency" is the know-how area |
  | Multi-agent orchestration | Coordinating many copies | "Agents" = the product only |
  | Applied interp | Applied interpretability | |
  | AI control | Control protocols | "control" = the safeguard kind |
  | CoT monitorability | Readable reasoning | |
  | Auditing agents | AI auditors | |
  | Monitorability suite | Reasoning-readability evals | "suite" removed |

## Second data pass (`_data2.ts` → `data400b.json`)


### TRAINING › Next run (`training.png`)

| On screen | Value | From | Basis |
|---|---|---|---|
| Bars: today | Atlas-2.8 measured per domain (range) | model card `domains` (fitted) | M |
| Ghosts: this run | e.g. Code 9.36 (9.30–9.43), AI research 6.46 | `index.ts:runCard` → `runForecast` (default plan: new base) | B·fc |
| Would meet · ready | Research agent · Feb 3, 2027 | `runCard.prediction.milestone`, `limits.readyDate` | B·fc |
| Median-expert tick | 6.4 | the framework's High trigger level (`framework` rules). **NEW**: a median-expert readout | F |
| Best human · milestone axis | 10 · Agent 5 … Superhuman AI researcher 12 (met dates) | `MILESTONE_NAMES` + `LEVEL_KNOTS` | F |
| Superhuman tick | not shown | **NEW**: no defined level | — |
| ×1.5 pretraining know-how waiting | 13 ideas | believed sum (see Know-how) | B |
| Instruments read ~40% / ~3% | mean detection at 6.79 / 9.16 | `sightLimit.ts:sightGrid` mean row | B |
| Start-from options | Use Atlas-3: ▼ skill (8.69 vs 9.16), −103 d (ready Oct 23) | `runCard` for the post-train plan on base Atlas-3 | B·fc |
| Option effects (Skill / Time / Serving / Risk) | e.g. Heavy budget +0.33 levels, +105 d, deception ↑ | `Blueprint.tsx effectOf` replica | B |
| Pushes | Deception ↑ (0.37), Gaming ↑ (0.13), Power 0.01, People-pleasing 0 | `pressureView.ts:plannedPressure` (predicted belief change) | B |
| Limits | 104 d at 60% of training compute · ready Feb 3 · 0.45 reads per token · $0 cash (compute worth $1.9B) · 1 d setup, 3 RE teams spare | `runCard.limits` | F / B·fc |

- On screen, skill changes appear only as ▲ / ▼. The level deltas go in the tooltip (DQ-3).
- The new base's name is not shown: Atlas-3 is already used by the pretrained base from Jul 22.

### RESEARCH › Know-how (`knowhow.png`)

| On screen | Value | From | Basis |
|---|---|---|---|
| Yours (range), per area | ×3.35 (3.07–3.64) · ×1.23 · ×1.16 · ×1.0 · ×1.70 | `stackViews` `now` vs `base` (adopted believed, `adoptedSd`) | B |
| Public know-how | ×1.06 · ×0.97 · ×1.0 · ×1.0 · ×1.0 | stack bases (public) | F |
| Waiting | ×1.5 (13 ideas since Jul 15, 2025) · ×1.02 · ×1.01 | believed sum of the estimates of ideas adopted after the internal model's recipe froze (`player.research.adopted`) | B |
| Growth, last 12 months | ×1.50 · ×1.10 · ×1.05 · ×1.0 · ×1.27; 13 / 6 / 6 / 0 / 5 ideas (30 in all) | believed sum over ideas adopted in the last 365 days | B |
| Public growth | ×1.0 | stack bases | F |

- "Waiting" counts against Atlas-2.10's base recipe. The pretrained Atlas-3 base (Jul 22) may already hold these ideas: **NEW**, a per-base readout.
- No waiting value for training or serving efficiency: those apply to every run at once.

### SAFETY › Risks (`safety.png`)

The model shown is Atlas-2.8 doing AI staff work: `safety.allInternalFleetTables[1]` = `actTable.ts:350 actTable(…, true)`, measured.
Atlas-2.10 has no measured skill yet, so its Able to is shown as unknown until its evals finish.

| On screen | Value | From | Basis |
|---|---|---|---|
| Loss-of-control risk | < 0.1% (range < 0.1%) | `lossRisk.ts:lossOfControlRisk` (Atlas-2.8: believed "acts against the lab" 11.3%, stop rate 82.8%) | B |
| Unstopped harm | 0.02 acts / yr: Serious 0.017, Severe 0.002 | sum of the table's Unstopped column, binned by the rows' severity (1.5–2.5 Serious, 2.5–3.5 Severe) | B |
| Sight curve | mean detection 48% at levels 3–6, 40% at 7, 11% at 8, 3.5% at 9; band floor = min row | `sightLimit.ts:sightGrid` | B |
| Sight markers | Atlas-2.8 (6.79) ~40% · next run (9.16) ~3% | measured L; planned prediction | M / B·fc |
| Validation | 5 instruments on Atlas-2.10, 53%, 7 d left | `safety.validation.jobs` | F |
| Framework | no hold; next rule AI R&D: Critical (AI research at best-human level) holds training | `framework` rules | F |
| Act rows | Would try (90% range), Able to, Chances (bar only), Stop rate, Unstopped / yr | `actTable` rows: `wouldTry`, `wouldTryRange90`, `ableTo`, `chances`, `stopRate`, `unstopped` | B · M · F · B · B |
| Unknown | range wider than 30 pts (Optimises the wrong target 0–49%, Copies itself out 12–47%) | VOCAB rule | B |
| Safeguards line | Human review (19 people), control protocol defer 10% (slowdown 7%) | `actTable.guards` | F |

- Chances has no player unit: the engine value is a relative scale, so it shows as a bar only. **NEW**: a unit, e.g. tasks per year.
- No sight-limit level is shown. The curve against the 50% line replaces the "none" readout.
- Misuse rows exist only on product deployments; here they appear as a link.

### MODELS (`models.png`)

| On screen | Value | From | Basis |
|---|---|---|---|
| Family tree: bases, models, parent, size, date, state | Atlas-1 / 2 / 3 bases; 2.4, 2.5 Ready; 2.6, 2.8 and the minis In use; 2.10 Testing; 8 retired folded | `models.familyTree`, `models.bases` | F |
| Tree bars | measured overall capability (2.4 6.90 · 2.5 6.94 · 2.6 6.97 · 2.8 6.79 · minis) | `measuredL` | M |
| Roles | 2.6 watches AI staff; 2.8 AI staff (engineering, ideas) + main model of Chat · API · Enterprise; 2.10 AI staff (experiments) | `usesOf`, `deployment.lineup` | F |
| Card: capability, skill per domain | 6.79 (6.63–6.95); Code 6.72 … Physical 0.92 with 90% ranges | model card `L`, `Lrange90`, `domains` (fitted) | M |
| Milestones met | Agent (Jul 1, 2025), Reliable agent (Nov 29, 2025) | `milestonesMet` | M |
| Cost per hour of work | $0.53 | `serving.agentHour` | F |
| Benchmarks | 21 | `benchmarks` | M |

- Jobs (skill at the job, can do alone) has no believed readout: **NEW**.
- Rival ticks (Q2) have no readout of released rival models measured by your evals: **NEW**.
- Atlas-2.8 measures *below* Atlas-2.6 (6.79 vs 6.97). The tree shows both.

### SAFETY readout states (`safety.png`, `safety-wide.png`)

Each belief readout is designed for four states:
- a value with its range;
- a wide range;
- **Unknown**, when the range is wider than 30 points (tile, L0 item and act rows);
- **< 0.1%** for values below 0.1% (never 0%).

The risk tile always draws a range strip (0–50%).

`safety.png` shows the day-400 values. `safety-wide.png` (the `#wide` state) shows the same screen with wide ranges and uses example values:
- loss-of-control best guess 6%, range 1–38% → Unknown;
- Would try ranges 0.2×–6× + 5 pts;
- Unstopped ranges ×0.3–×5.
### Revision 3

- **Portfolio programme rate** (cards and drawer): ≈ × per year on the programme's know-how area, in the Know-how unit.
  - Scaling recipes ×1.19 · Environments & rewards ×1.09 · Data filtering & mixing ×1.15 · Optimizer & architecture tweaks ×1.10 · Post-training algorithms ×1.14 · Faster serving ×1.39.
  - Results per year = results so far (`line.gen`) ÷ 400 days × 365; × each result's believed size (`line.nextPrior`); so rate = (1 + next result)^(results / yr).
  - Cross-check: the three pretraining programmes multiply to ×1.52 / yr; Know-how shows ×1.50 / yr for the pretraining recipe.
  - The next result's size (e.g. ×1.037) moves to the tooltip and the drawer.
  - **NEW**: a results-per-year readout at current staffing.
- **SAFETY Chances / yr:** opportunities per year, so Would try × Able to × Chances / yr = attempts / yr, and × (1 − Stop rate) = Unstopped / yr.
  - Chances / yr = the act's κ × `chances` (opportunity) × 365 (`actTable.ts:213`); equivalently `attempts` ÷ (Would try × Able to).
  - Values: Games tests 1.5 · Tells people 0.73 · Wrong target 0.38 · Overreaches 0.84 · Hides mistakes 0.56 · hidden compute 0.2 · sabotage, backdoor, oversight 0.26 · covering 0.28.
  - The two successor / research-steering acts are per work item (0.07, 0.06 / item).
  - **NEW**: Chances / yr as a column of the act table view (today it is derived).
