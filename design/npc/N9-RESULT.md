# N9 result: public values replace the intel model

Task N9 of NPC-TASKS.md, branch `npc-n9` (off `npc`). Spec: NPC-LABS.md draft 2 §2 (principles 4, 7), §9, Appendix A
(Intel, Index, Endings view.ts). Moves calibration: no (display and estimates). One thing moved besides display: the
government's China ladder (actors/gov.ts) and the board's "lagging" test now read the public lead (noisy, held between
reports) instead of the old intel estimate, so both can differ from before by the public error (see "Readers").
Saves: `RivalIntel` lost fields and `NpcLabState.pub` is new; no migration, SCHEMA_REV not bumped (save.ts not mine).

## What changed

- **New `src/engine/v2/npc/public.ts`.** `publicOf(s, lab)` returns `{ monthsBehind, monthsBehindSd, lagDays, horizonMin,
  computeH100e, revenue, valuation, capDay, safetyPosture }`. Each is the true value x an error, drawn when reported:
  - capability (months behind, task horizon of the public model) on each public release (`npc.rel`);
  - compute, valuation, revenue on each quarter; revenue is the value one month before the report (a snapshot taken 30
    days before the next quarter starts).
  - sigmas (spec §9, one per quantity for every lab, China x2): months behind 1 month (additive, sd in months), task
    horizon 0.3, compute 0.25, revenue 0.15, valuation 0.1 (ln units). `PUBLIC_SIGMA`, `sigmaOf`. These override
    `PUBLIC_NOISE` in data/v2/npcLabs.ts, which is now unread (N12 may delete it).
  - the error is a function of (seed, lab, quantity, report index): `new Rng(hash32(seed, "pub:lab:qty:idx"))`, a local
    generator, so no game stream is consumed and a re-run is identical.
  - stored: `NpcLabState.pub` (types.ts `NpcPublicState`): the last reported values, the two report indices and the
    revenue snapshot. `refreshPublic(s, lab)` is called at init and from the lab's daily step (`npc/lab.ts
    npcCapabilityDay`, after the release), so it runs on the release day itself and changes nothing between reports.
- **intel.ts: the intel model is gone.** `updateIntel`, the estimates, `misalignBand`, `lastReportDay` and the weekly
  evidence/assumed-lag logic are deleted. `intelSystem` stays as an empty weekly system only because the registry
  (not mine) imports it: **the lead should drop it from core/registry.ts**.
  - `leadDays(s, id)`: est = (true lead over the lab, vs the player's best measured version: the unchanged RD-L01 clock,
    now private `trueLead`) - the lab's true lag + its reported lag. The player knows its own position; the lab's side is
    its public lag, frozen between reports. sd = the months-behind sigma x 30.4 (30 d; China 61 d).
  - `RivalIntel` is now `{ knownIncidents }` (disclosed incidents, exact).
- **Safety Index** `gradeRival` reads `publicOf(...).safetyPosture` (the kind's public posture, with the existing
  `postureDelta` shifts) and the disclosed incidents; formula unchanged.

## Readers switched

| Reader | Was | Now |
|---|---|---|
| actors/intel.ts `leadDays` | `r.intel.leadDaysEst/Sd` | public months behind (above) |
| actors/intel.ts `riskSources` rival and China rows | misalignment band from intel; lead from `intel.leadDaysEst` | lead from `leadDays`; misalignment from the public prior only: clause-type band (as before the evidence) + 0.02 per disclosed incident. Row driver relabelled "Their stated safety posture" |
| actors/intel.ts `riskSources` theft row (China's mid) | China's intel band | the same public prior |
| actors/index.ts `gradeRival` | `postureOf` | `publicOf(...).safetyPosture` |
| core/hubView.ts `leadLanes` | via `leadDays`; `intel.lastReportDay` | via `leadDays`; `npc.pub.capDay` (last capability report) |
| core/selectors.ts | via `leadDays` | unchanged (no direct intel read) |
| endings/view.ts hidden labs | rival: intel band, `outside` flag | rival: its public safety investment as a point (lo = hi) against the true m; `outside` only for the player. EndScreen tooltip label "Their public safety posture" |
| ui/v2/panels/RiskMap.tsx | "Would try (range)" row from the band | row removed (no misalignment estimate) |
| actors/gov.ts G-CHN ladder | `china.intel.leadDaysEst` | `leadDays(s,'china').est` (compile fix; China/government reactions are another session's) |
| finance/observe.ts `leadEstimate` | `intel.leadDaysEst` | `leadDays` (feeds board/finance previews) |
| models/productOps.ts releaseOpen preview | `intel.leadDaysEst/Sd` | `leadDays` |
| core/init.ts | shifted every lab's intel by the player's start lag (R9) | removed: the lead is built from true positions now |
| actors/rivals.ts, npc/lab.ts | `intel: {...}` literals | `intel: { knownIncidents: [] }` |

Readers via `leadDays` that needed no edit: selectors.ts, finance/board.ts, ui kit.tsx, shell/selectors.ts, store.ts,
Overview.tsx, RiskMap.tsx. Stale scripts reading the old fields (not run by `tsc -p .`): scripts/v2/lagdays.ts,
scripts/v2/_cp4/lead.ts, scripts/v2/_rfp6/check.ts.

## Notes for the lead

- China's safety posture still comes from the hidden `chinaPosture` draw plus its safety-concern meter (actors/rivals.ts
  `postureOf`); its public face is therefore not yet "the kind's": China's session owns that.
- Disclosed incidents are `ws4.rivalIncidents` (exact). `goalposts[lab]` in the Index grade is kept.
- The risk row's misalignment for a rival no longer moves with evaluator access or thefts (it was the intel band's
  evidence term); it moves only with the visible clause type and disclosed incidents.

## Tests

`npx tsx scripts/v2/npcPublic.ts` (see the output in the commit message / below): errors over 3000 report indices have the
stated sigma within 10% for every quantity (China x2); values change only on report days; two runs identical; a report
consumes no RNG stream; revenue is one month stale; exact facts read from the lab; `leadDays` sd and the frozen reported
lag; every lab grades. `npx tsx scripts/v2/npcLabs.ts` still passes. `tsc --noEmit -p .` clean.
