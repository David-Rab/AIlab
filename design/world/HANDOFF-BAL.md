# Outside-world rebuild: hand-off to the balance workstream (`bal`)

Branch `world`. Read this list when `world` merges to master, or when `bal` merges `world`. The designer: "this session
isn't supposed to really do much about the player's lab ... only list them and hand to the balance work when we merge".
Details and commits are in [WORLD-TASKS.md](WORLD-TASKS.md).

## 1. Changes that move calibration

| Change | Task | Effect on the player's lab or the world |
|---|---|---|
| Macro model replaced by economy readouts; US base growth 2.2% (CBO) instead of 1.8% | W1b | US growth is about +0.4 pt; re-employment reads growth (sectors.ts). Inequality is out of scoring |
| Hiring pull fixed at the start-type anchor, then + approval/5 | W1c, W4 | No drift, no Index, publishing or purge bumps |
| Safe bot orders an independent evaluators' suite before release | W1c | New bot behaviour (externallyEvaluated needs an external suite) |
| Export policy follows real dates (strict → case-by-case 2026-01-13), then the US-government rule | W1d, W5, W6b | China's chip access; the chip market |
| EU GPAI friction on from 2025-08-02 | W1d | +0.03 friction outside the US |
| Preset draws gone from the world stream | W1d | Per-seed worlds shift (one day-900 fixture valuation went 327 → 211) |
| Baseline deleted: lab start values moved into starts.ts unchanged (AI 2027 Classic values); world start uses the reality values (global compute and chip stock 14e6, robot cap 0.5e6) | W1f | The lab start is identical; the chip stock is +1e6 |
| Economy presets deleted; one ADOPTION setting (the old default row) | W1f | None for default setups |
| Storyteller deleted; the director has one fixed pacing (no act-based multiplier) | W1f | Event odds change slightly |
| Brand factor from approval; local opposition from concern (45 at concern 50) | W4 | Demand ±10% at most; siting odds rise as concern rises |
| US government laws: licensing friction, the HITL α cap, relief retraining, UBI exit | W5 | Economy and demand in high-concern worlds |
| China's lab compute on the NPC rule (start 0.36M H100e, ×2.25/yr plan, export and collective multipliers); it orders from the shared chip market | W6 | China no longer overtakes in slow; market demand is higher |
| Treaty caps the player's AI R&D pool at its signing-day level; NPC clock ×0.65 | W6 | Only in treaty worlds |
| Reference series extended past each run's last point (rows end 2030.1–2060) | W6b | NPC labs after their series end (slow and long runs) |

## 2. Shared-history problem for the NPC lead lab

The world reacts correctly to milestones reached in the game. But in fast runs, and in some central seeds, the leading
NPC lab publicly shows milestone 2 (research agent) by mid-2026. So China's collective, US stage 1 and concern ~53–55
land before Nov 2026, while real history has none of them.

`bal`'s open point: every timeline should pass the same 2025–26 checkpoints. The designer agreed to hand this to `bal`
(SESSION-HEAD §11).

## 3. AI 2027-sourced parameters of the player's lab (listed, not changed)

To re-source against reality (to Nov 2026) and the AI Futures Model timelines:
- the leader start row in src/data/v2/starts.ts (cash 40, revenue 12, compute 1.2M H100e, teams): the old "AI 2027
  Classic" baseline values;
- every lab-side parameter whose source comment cites AI 2027. To list them: `grep -rn "AI 2027" src/engine/v2/{models,departments,safety,finance,production,compute} src/data/v2`. About 130 comment hits in about 50 files at the start of this session; the outside-world ones were deleted with their code.

## 4. Tooling `bal` can reuse

- `balrun --observer`: a run with no player (spinout start, idle, player endings off); quarterly `worldReadout` series.
- `npm run world:dash -- --runs <runs>` → balance/dash/world.html: history checks against BLS, BEA, Pew and the law
  dates; the lead lab's milestones against the AIFM bands; reactions; endings; parameters.
