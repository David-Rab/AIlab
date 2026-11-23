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
| Loss-of-control risk | 0% · Atlas-2.10 | `safety/dangerView.ts:controlReadout` (→ `lossRisk.ts:modelLossRisk`) | B |
| Alerts | 5 · 3 research, 2 world | `AlertQueue.tsx:alertGroups` logic (sev ≥ 2, last 30 d) | F |
| Badges | Lab "idle", Research 1 | idle shares (below); one failed project | F |

**Check:** the loss-of-control readout is exactly 0 with a 0–0 range, while believed misalignment is 9.5% and the stop rate is 83%.
Either the formula floors it or it is a bug. The UI-IA "Unknown" rule (range > 30 pts) never fires on a 0–0 range.

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
| AI share | 63% · 35% · 7% · 0% | `researchView.ts:workTypeViews` (`coverage`) | M (flag below) |
| Total effort | ×6.1 · ×2.4 · ×1.2 · ×1.0 | `workTypeViews` `multiplier` (effective ÷ human team-eq) | B (flag below) |
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

**Flags:**
- AI share and total effort come from `workfit.ts` (`useLabour` / `effLabour`), which reads hidden production parameters (`prod.rc`) and the version's true effective compute. The current UI shows them too. They need a belief-based version before they go into the player view.
- The AI staff on experiments run Atlas-2.10, which is still in Testing.
- Owned (1.5M) + rented (0.7M) is less than the 3.8M online.

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
- Built in 4 results, +13% pretraining recipe: `line.gen`, `line.realised`. Check whether `realised` is the believed or the true value.
- Returns ×0.87: from `line.harder`. Dropped 4: `drops`. In this test 3: `cands`.
- Gets:
  - 1 science team, in the right field: `teams[].match`.
  - 2 research-engineer teams: `perProject`.
  - ⅙ of experiment compute (44k H100e): equal `flopDay` across the six programmes. A per-programme compute readout is **NEW** (today it is derived).
- Idea choice Balanced: the lab-wide risk policy. A per-programme choice is **NEW** (UI-IA L2).
- Takes effect "new base model": the know-how area (pretraining recipe).
