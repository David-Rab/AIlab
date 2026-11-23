# SAFETY sub-tab mockups: where every number comes from

Screens: `saf-model.png` (+ `saf-model-evidence.png`), `saf-instruments.png`, `saf-safeguards.png` (+ `saf-safeguards-edit.png`),
`saf-incidents.png`. Render: `node render.mjs saf-model saf-model:evidence saf-instruments saf-safeguards saf-safeguards:edit saf-incidents`.

Basis: F = fact, M = measured, B = belief. **NEW** = no player-facing readout yet (the engine has the parts; a view
function or a preview is missing).

## Data runs (from the worktree root)

| Script | Fixture | Output | What |
|---|---|---|---|
| `_data-c.ts` | day400 (arg 1), `day900.json data900c.json` | `data400c.json`, `data900c.json` | safetyModels, riskFamilies, beliefView, alignmentEvalView, instrumentReliability, validationRange, reliabilityReasons, disagreementsOn, trustOf, autoWatcher, instruments (trust evidence), validationView, methods, framework, deployments + packages, oversightGaps, footholdView, safetySpend, safetyUtilisation, disclosure, incidents, responseOptions |
| `_data-c2.ts` | day400 | `data400c-mon.json` | per AI staff job: `useMonitor` (watched share, flag rate, acted-on), `believedInternalOversight`, `believedOversightParts` |
| `_data-c3.ts` | day400 | `data400c-grid.json` | `reliability()` parts per instrument × hidden-goal trait (tests / legible / efficacy / decay factors); Scheming evidence list; Atlas-2.8's methods |
| `_data-c4.ts` | day400 | console | `casePreview` / `caseReliability` / `caseDailyWork` for "Is Atlas-2.8 scheming?" at 5–40 engineers |
| `_data-c5.ts` | day400 | console | `believedOversightParts` with and without the control protocol; `controlTerms` and `controlComputeShare` per setting |
| `_data-c900.ts` | day900 | `data900c-inc.json` | incidents with date, model, mustReport, willDisclose, responseOptions; `casePreview` for Atlas-4.0; spend |
| `_data2-c.ts` (= `_data2.ts`, day-900 output name) | `day900.json` | `data900b.json` | day-900 act tables, sight grid, framework holds, model cards |
| `_data.ts day900.json` (renamed) | day900 | `data900c-shell.json` | day-900 top bar |

## Header (all four tabs)

Day 400: the approved header of `safety.js`, unchanged (same values, DATA.md "SAFETY › Risks"); `saf-head.js` draws it.
Day 900 (Incidents tab only):

| On screen | Value | From | Basis |
|---|---|---|---|
| Model picker | Atlas-4.0 · AI staff: engineering, experiments, ideas | `safetyModels` (riskiest first) | F |
| Loss-of-control risk | 0.8% (0.5–1.2%) | `lossOfControl_perModel` Atlas-4.0 | B |
| Unstopped harm | 1.4 acts / yr (0.9–2.3): Serious 0.034 · Severe 0.91 · Critical 0.415 · Catastrophic 0.031 | Atlas-4.0 internal act table, per-year rows, binned by rounded `expectedSeverity`; range = Σ unstopped × Would-try range ÷ best guess (`unstoppedRange`) | B |
| Sight curve | mean 53% at level 7 → 41% at 12 → 2% at 15; band floor = lowest trait | `sight.grid` (data900b) | B |
| Sight marker, text | Atlas-4.0 (12.21) ~36%; "4.7 levels past your sight limit" (sight limit 7.55); 6 instruments validated on it | `sight.modelMeasuredL`, `sightLimit`, `validation.notOnCurrent = 0` | M / B |
| Framework | Hold: training · AI R&D: Critical since Nov 20 · missing an external evaluation | `framework.holds[0]` (day 872) | F |
| Top bar | Dec 18, 2027 · ×190 · 41 d ahead of xLab · $128.4B · 8+ qtrs · 0.8% · 15 alerts (8 incidents, 3 research, 4 other) · Safety badge 24 | `data900c-shell.json` A (`researchSpeed.rel_vsLeaderDay0`, `lead.nearest`, `cash`, `runwayQ`, `lossOfControlRisk`, `alerts.byKind`); badge = open incidents | F / B |

## SAFETY › Model (`saf-model.png`, Atlas-2.8, day 400)

| On screen | Value | From | Basis |
|---|---|---|---|
| Trait beliefs | best guess and 90% range = est ± 1.64 sd, clamped 0–100% (e.g. Scheming 14% (8–21%), Eval awareness 38% (30–46%)) | `beliefView` (`v.beliefs`) | B |
| Unknown | range wider than 30 pts: Misaligned persona, Proxy goals, Training gaming, Obfuscated reasoning, Situational awareness, Resists correction | VOCAB rule | B |
| Protective traits shown the risky way round | Dishonesty = 1 − Honesty (16%); Resists correction = 1 − Corrigibility | SAFETY-REDESIGN §2.2 concept 1 | B |
| Family rows | the family's highest trait and its range (People-pleasing → Misaligned persona, Gaming → Training gaming, Deception → Eval awareness, Power → Power seeking) | `riskFamilies` (`worst`, `lo`, `hi`) | B |
| Framework line 30% (hidden-goal rows) and the flag on Alignment faking (top 32%) | `misalignment` rule trigger 0.3 on the top of the range; hidden-goal traits = `CRITICAL_TRAITS` | F / B |
| Evidence counts | tests n / reasoning n per trait; "no instrument reads it" when no owned instrument's `reads` includes the trait (Proxy goals, Obfuscated reasoning, Situational awareness, Corrigibility) | `beliefs[t].evidence[].source` (`eval/BB/*`, `suite/BB` = tests; `suite/COT` = reasoning; `inherit:` dropped); `instrumentReads` | M |
| In tests vs in real use | Scheming scenarios 7 of 40 (10–29%) → 13–46%; Agent stress tests 6/40 → 11–42%; Reward-hacking tasks 3/40 → 4–27%; Sabotage scenarios 2/40 → 2–22% | `alignmentEvalView` rows (k, n, lo, hi, realLo, realHi) | M → B |
| Notices tests | 38% (30–46%); real use ×1.3–1.6 tests | `testGapView` (`eaLo/eaHi`, `gLo/gHi`) | B |
| Real-use logs | none yet | `testGapView.logs` undefined | M |
| Started from / evaluated / trained with | Atlas-2.6, Jun 18; evals Jul 2 (day 366); Confession training | parent V23, card day 352; evidence day 366; build `methods: ['T-CONFESS']` | F |
| Trusted watcher | Yes: cyber below the level where working around oversight succeeds | `trustOf(Atlas-2.8).why` | M |

Eval display names (Scheming scenarios, Agent stress tests, Reward-hacking tasks, Sabotage scenarios) are mockup words for
`SchemingProbe`, `AgentStress`, `HackRate`, `Sabotage`: **NEW** player names (VOCAB has none).

**Evidence drawer** (`saf-model-evidence.png`, Scheming):

| On screen | Value | From | Basis |
|---|---|---|---|
| Readings | Atlas-2.6 16% (7–25) · Scheming scenarios 25% (11–39) · Sabotage scenarios 7% (0–16) · Behavioural tests 33% (0–83) · CoT monitor 36% (2–70) | `beliefs.SCHEME.evidence` reading ± 1.64 × noise | M |
| Counts for | 40 · 16 · 40 · 1 · 3% | 1 / noise², normalised (the belief update's precision weights) | M |
| Instrument would show it | Propensity evals 32% (1 in 3), Model organisms 18% (1 in 6), CoT monitor 11% (1 in 9); Linear probes not run on Atlas-2.8 yet | `instrumentReliability` rows; probes: no internals evidence in the list | B |
| Open a case | ~3 d · 10 engineers · 260 H100e; 4 instruments, 3 kinds | `casePreview` at 10 engineers (`_data-c4.ts`) | B·fc |

- **NEW:** a case preview's expected range after the verdict. `casePreview.ranges` returns the current sd or wider for
  "benign" (Scheming sd 0.038 → 0.06), so the drawer shows no after-range.
- **NEW:** an "evidence per kind" readout (the counts are derived from `source` strings in the mockup).

## SAFETY › Instruments (`saf-instruments.png`, Atlas-2.8, day 400)

| On screen | Value | From | Basis |
|---|---|---|---|
| Reliability on Atlas-2.8 | Propensity evals 32% (18–45), Linear probes Unknown (7–43), Model organisms 18% (10–25), Noise-injection 18% (5–30), CoT monitor 11% (5–17) | `instrumentReliability` (`pct`, `lo`, `hi`) | B |
| On Atlas-2.10, extrapolated | same values (gap 0.03 levels) | `instrumentReliability(Atlas-2.10)`; `validationRange.basis = 'extrapolated'` | B |
| Kind, reads | Tests 11 traits (6 hidden-goal) … | `instrumentKind`, `instrumentReads` ∩ `CRITICAL_TRAITS` | F |
| Validated, found of 20, history | Atlas-2.8 9 / 7 / 5 / 5 / 3 of 20, by people, Jul 4; bars Atlas-2.5 · 2.6 · 2.8 | `instruments[].trust.evidence` ("human-run validation on …: found k of 20") | M |
| × 0.7 note | 7 of 20 = 35% → 24.5% believed on real traits | `believedTransfer` (organism realism believed) | B |
| Main limit chips | notices tests ×0.69; approach works? 33% / 67% / 58%; reasoning hidden ×0.57; fades with skill ×0.93 (+n more in the tooltip) | `reliability()` parts: `tests`, `efficacy`, `legible`, `decay` | B |
| Real-use logs row | no readings; watched 1.2% | `testGapView.logs`; `useMonitor.watched` | M / F |
| Hidden goals you can read | Scheming 49%, Power seeking 49%, Collusion 44%, Successor alignment 42%, Sandbagging 41%, Alignment faking 40% | `sight.perTraitAtModelLevel` (data400b) | B |
| Validation | 5 instruments on Atlas-2.10 · by people · 40 engineers · 53% · 7 d left | `validationView` jobs (8 engineers each, human) | F |
| Method | Confession training: at-scale effect 0–2× tested; ~15 d · 8 engineers | `methodQRange(T-CONFESS)` (lo 0, hi 2); `validationView` `days`, `perJob`; `methodsOpen 1` | B / F |
| Policy | validate every instrument on each new model: On | `validationView.autoNew` | F |
| Disagreements | none on Atlas-2.8; last: Atlas-2.5 Alignment faking, tests 92% vs reasoning 21%, Apr 9 | `disagreementsOn`, `s.player.safety.disagreements[1]` (day 282) | M |

- `validationRange` (sample range of k of 20) and `instrumentReliability` (programme-efficacy range) give two ranges for one
  reliability; the mockup uses `instrumentReliability` (the built UI's readout). One must go. **NEW**: one reliability
  range.
- `reliabilityReasons` returns "capability gap from Atlas-2.8 −7" and "line works 33%"; the chips use the `reliability()`
  factors instead. **NEW**: reasons in player words.
- Detection grid drill-down (L2) is linked, not drawn.

## SAFETY › Safeguards (`saf-safeguards.png`, day 400)

| On screen | Value | From | Basis |
|---|---|---|---|
| AI staff jobs and models | Engineering Atlas-2.8 · Experiments Atlas-2.10 · Ideas Atlas-2.8 · Safety: no AI staff | `oversightGaps`, LAB `agentsView` | F |
| Monitors | Engineering none; Experiments watcher Atlas-2.8 (same family), Ideas watcher Atlas-2.6 (trusted); watched 1.2% | `oversightGaps.watcher`, `useMonitor` (`watched` 0.012, `c.copy`) | F |
| Control protocol | Defer 10% to trusted; blocks 49%; lets ×0.45 slip; 7% slowdown; required | deployment D4 `guards`; `believedOversightParts` (block 0.488, controlMiss 0.447); `guards[].slowdown`; `packageMeets` | F / B |
| Human review | 19 people; catch 12% | `guards` review (people 19, stop 0.116) | F / B |
| Products | Chat · API · Enterprise, Atlas-2.8 + 5 lineup models, Classifiers only; stop 0% misbehaviour, 56% misuse; slowdown 0 | deployments D1–D3 (`safeguards: 'classifiers'`, `lineup`); product act tables (`stopRate`) | F / B |
| AI staff stop rate | 80–89% by act | Atlas-2.8 act table `stopRate` range | B |
| Step by step (Sabotages research, per 100) | 49 blocked · 7 monitor · 5 human review · 22 deferred · 18 through; stop 83% | row block 0.488, catch 0.657; catch split with human 0.116 and controlMiss 0.447, monitor part = the rest (0.132) | B |
| What binds | monitor reads with instruments that see ~26%; watched 1.2% | monitor part ÷ 0.5 (`believedMonitorCatch` = det × (½ + ½ × strength)); `useMonitor.watched` | B / F |
| Levers | resample 83% → 95%, slowdown 7% → 5%; defer 20% 83% → 92%, slowdown 17%; fund monitors 83% → 85%, +129k H100e (3.4%) | `controlTerms` missMult (0.121 / 0.211) on the row's parts; monitor at strength 1; `safetySpend` monitors ask 132.6k vs got 3.3k of 3.8M online | B·fc |
| Framework rules | AI staff work (always: control protocol, met) · AI R&D Critical · Bio High / Critical · Cyber High / Critical · Misalignment signs; lines at median expert (6.4) / best human (10); Atlas-2.8 AI research 3.57, Bio 0.57, Cyber 1.51; not published | `framework.fw.rules`, `worldHighL`, `packageMeets`; model card `domains` (data400b) | F / M |

**Edit drawer** (`saf-safeguards-edit.png`): per setting, Off / Defer 10% / Defer 20% / Resample, from `controlTerms`
(slowdown 0 / 7 / 17 / 5%, missMult 1 / 0.447 / 0.211 / 0.121) and `controlComputeShare` (0 / 1 / 2 / 0.5% of AI staff
compute 164k = 0 / 1.6k / 3.3k / 0.8k H100e), applied to each act row's block and catch (Off: block 0). Unstopped harm
0.02 → 0.005 / yr = Σ attempts × (1 − new stop rate). Loss-of-control risk stays < 0.1%. Trusted model `autoWatcher`.

- **The monitor's number.** The act table's monitor part reads `believedMonitorCatch` = instrument detection × (½ + ½ ×
  monitor strength), so a monitor watching 1.2% still gives half its catch; the one-formula monitor (`useMonitor.stop` =
  watched × flag × acted-on = 1.1%) is not what the table uses. The mockup shows the table's numbers (they match the
  approved Risks tab). **NEW / engine:** one monitor number (SAFETY-REDESIGN §3.3 M3: "the number shown is the number used").
- **NEW:** preview functions for safeguard edits (the numbers are recomputed here from the engine's parts).

## SAFETY › Incidents & cases (`saf-incidents.png`, day 900)

The day-400 fixture has no incidents or cases, so this tab uses the day-900 fixture (header and top bar above).

| On screen | Value | From | Basis |
|---|---|---|---|
| Timeline | 26 incidents, Oct 14, 2026 → Dec 16, 2027, by apparent act: Works around oversight 20 (apparent Scheming), Games tests and graders 3 (Reward hacking), Hides its mistakes 1 (Concealment), Unexplained 2; colour and size = severity; filled = Atlas-4.0; ring = went public | `incidentRows` (`apparent`, `severity`, `status`, `versionId`, `day`); act names `ACT_INFO` | F; cause B |
| Counts | 24 open, none investigated, 2 went public | `status` open / leaked; `investigations` empty | F |
| Training held mark | Nov 20 | framework hold `since` 872 | F |
| Groups | Atlas-4.0 Works around oversight 15 (6 Critical, 9 Severe, Jul 2 – Dec 16); Games tests 2 Severe (Aug 13, Sep 18); Unexplained 1 Severe (Aug 22); earlier models 6 open | incidents grouped by model × apparent | F |
| Apparent cause, responses | trait → case, comms lockdown, method, roll back, control protocol (on); signal → Harden environments; unknown → case, contain | `responseOptions` (`cause`, `kinds`, `investigate`); `RESPONSE_INFO` | B |
| Response previews | lockdown: covering ×0.5, slowdown 3%; method: shows in the next run (training held); roll back to Atlas-3.7 | `RESPONSE_INFO` notes, `LOCKDOWN_*`; framework hold | F |
| Case draft | Is Atlas-4.0 scheming? · Linear probes, Deception probe, Propensity evals, Model organisms, CoT monitor · 39% · ~2 d · 20 engineers · 5.2k H100e · belief Scheming 45% (35–55), Alignment faking 50% (36–63) · 17 kinds of new failure mode | `defaultTools`, `casePreview` (`reliability`, `days`, `h100e`, `canFind`), V52 beliefs | B·fc |
| Spare staff | 90 of 100 safety research engineers | `safetySpend.idleStaff` | F |
| Disclosure | Legal minimum; 0 of 24 must be reported; 2 went public | `disclosurePolicy`, `mustReport`, `status = leaked` | F |

- **NEW:** verdict odds (confirmed / benign / inconclusive) for a case; `casePreview` has none.
- **NEW:** the case's AI share (0% shown: no AI staff on safety).
- Roll-back target (Atlas-3.7, the newest earlier model) is the mockup's choice; `rollback` has no target readout (**NEW**).
- Running and verdict states of a case card are not drawn (no case exists in either fixture).
