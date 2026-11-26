# Safety research and capabilities research: one rule, one code

Status: done 2026-11-26 for the shared rule and helpers; the rest is a design question (below). Designer decision: safety research applies the same taste rule as capabilities research, ideally through the same code.

## What the code actually was
The brief assumed safety runs its own copy of the capability lifecycle (candidates, belief noise, picking). It does not. `safety/lineProjects.ts` runs a safety node as an **unlock-style single test**: one `SafProjectState` (work / workNeed = the agenda's T₁), worked by the science teams and the experiment CES together (`models/research.ts` `stepTest`, `stepProject` dept `'saf'`), then one hidden `safetyWorks` draw against the agenda's true efficacy. There are no candidates, no beliefs, no picking and no adoption stage, so there was nothing there to be "noise" or "quality". The only taste rule in safety was `sci.q` multiplying the science rate.

## Duplication map (before this change)
| Step | Capabilities | Safety | Verdict |
|---|---|---|---|
| Ideation / science work rate | `research.ts` `sciWorkRate` (:317; unlock projects, `stepTrial`) and `stepProject` `ideasFull`, no taste | `lineProjects.ts` `lineRates` `sciRate`, **× `sci.q`** | **drifted** (safety kept the old taste-speeds-work rule). Now one function. |
| Team taste (mixture) | `sciTasteOf` (:186), `sciOn`, `believedSciOn`; `tasteOf` in the planner (:367) | `safSciOn` own loop of `teamTaste` | identical formula, duplicated loop. Now `safSciOn` calls `sciTasteOf` (star hires off, safety AI inputs). |
| Planner value of a project | `projectValue` (research.ts:390), uses q for the idea's quality | `tree.ts` `safProjectValue`, the rate × q × odds | **drifted** (q as speed). Now `sciWorkRate`, q ignored. |
| Experiment labour ℓ | `projectExpInputs`, `capEta`, `experimentRate` each wrote the pow/max/unit expression | `lineRates` wrote it again | identical expression, 4 copies. Now `expLabour`. |
| Experiment CES X(c, ℓ) and its normalisation | `experimentRate`: `Xces(P, FLOP/C_UNIT, ℓ)·speed·√RE_LABOUR_UNIT/30` | `lineRates`: `Xces(P, FLOP/(computeNeed·C_UNIT), ℓ)·speed/(30·Xref)` | **intentional**: a safety result's work unit is T₁ months at reference inputs (agenda `computeNeed`, `SAF_RE_ASK`); same CES, different unit. |
| One-question test stepping | `stepTest` (:1073) | same function | identical (already shared). |
| Result draw | `works` (:128, node odds) | `safetyWorks` (:1086, the agenda's true efficacy) | **intentional**: efficacy is a safety quantity (`trueEfficacy`). |
| Candidate creation / source, belief noise, picking, lineRate/poolMean, adoption | `newCandidate` (:706), `pickCandidate` (:747), `lineRate`, `poolMean`, adoption build | none (safety has no candidates; result handling is `tree.ts` `resolveLine`, findings) | n/a (not duplicated). |

Counts: 2 drifted, 2 identical-duplicated (taste loop, labour expression), 2 intentional, 1 already shared, 1 not applicable.

## What is shared now
`models/research.ts` exports `sciWorkRate` (science work per day), `sciTasteOf` (capacity and the human/AI mixture taste, with an optional `star` input) and `expLabour` (experiment labour). `safety/lineProjects.ts` and `tree.ts` call them. Safety keeps its own inputs as parameters: the SAF_IDEAS / SAF_EXP labour (`lineLabour`), SERIOUS_CAP, HEADS_PER_LABOUR_UNIT, the safety pools and stacks (`safAllocation`), trust policies.

Rule now identical: **no taste in the work rate** (safety = unlock-style: taste is inert for the rate, as for capability unlock projects). The mixture q is still computed (same function) as a readout. Safety quality and noise do not exist as quantities, because a safety test has no candidates.

## What is left (design question, not just code)
Running safety through the full capability lifecycle (ideation → candidates with sources → pick under noise → small test → scale test → adoption) means giving a safety node a continuous hidden effect per candidate instead of one works/doesn't draw. That changes what a safety result is (findings, `nodeTestResult`, SAFSAB false results, posterior/odds readouts, `resolveLine`) and the save format. Steps:
1. Safety candidate truth and belief (efficacy as a per-candidate effect with a prior from the agenda): ~150 lines.
2. Route `stepProject` dept `'saf'` through `stepFlow` / explicit pipeline with safety experiment units: ~150 lines.
3. Map a finished candidate to the node's result and the posterior/odds readouts (`tree.ts`, `findings.ts`): ~200 lines.
4. Save migration, UI previews and ETAs (`lineEtaDays`, `lineCycleDays`), tests: ~200 lines.
Total about 700 lines in 8 files, with new balance work (it changes every safety timeline). Do it only if the designer wants candidates and noise on safety research; the shared helpers above already keep the taste rule the same.

## Observed
- Capability behaviour is unchanged by the refactor (with the old `× q` put back in safety, the 3-seed forced run is milestone-identical). Safety losing taste moves one of three seeds (2027): SC 645 → 629, SAR 720 → 727, SIAR 783 → 797, ASI 804 → 832.
- `scripts/v2/safetyresearch.ts` has 4 failures that exist before this change (reference pacing gives T₁/2 because science and experiment rates add, 3 checks; AI labour copies check).
