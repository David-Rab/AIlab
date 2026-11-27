# START HERE: calibration / balance workstream handoff

Written 2026-11-27 by the session that built this (branch `bal`, worktree `C:\Users\david\Documents\projects\AI27-bal`). When the designer says "we start working on calibration", read this file in full first, then the files in §6 as needed. State changes over time, so check `git log` and `design/BAL-TASKS.md` before acting.

---

## 1. The designer's principles (said in this workstream; they override defaults)

**What calibration is for**
- **The player.** "What i care about in this session is mostly the player, not the other simplified lead or rival labs." NPC labs, China and government can be fixed later and are "easier and less important". Trace and explain the **player's** mechanics (`models/research.ts` projects and lines, `production.ts` `playerInputs`), never the NPC path (`rivalModel.ts`), unless asked.
- **Real data only up to late 2026; the future is scenarios.** "We have real world numbers up to 2026, but after that its predictions... we somehow need to have a way to balance in the different scenarios of future."
  - All scenarios share the measured history to late 2026, including one shared start state.
  - **Forecast values dated 2026 are replaced by measured data.**
- **Bots play to win, never to calibrate.** "The bots goal is to win within a given world, not to calibrate. so no reason for it to slow itself purposely, or avoid research."
  - The world is calibrated with a **realistic-lab reference policy on the player's own mechanics**, not against NPC labs ("the rival labs don't work internally like the player").
- **Bots are weaker than humans,** so the strong-bot vs realistic-lab gap must be small. "Your 'strong' bot will be quite weak compared to even average human player, so we really don't want it too much better than the 'realistic'." Also: "if the strong bot wins much more than the 'realistic' bot, that means the game has too many exploits."

**How to calibrate**
- **Shape and distributions, not dead numbers** (memory `balance-against-shape`): targets constrain dynamics and responses. "Distribution is important, not just averages."
- **Emergent outcomes** (memory `emergent-outcomes`): a missed target means a missing or mis-tuned sourced mechanism, **never a forcing rule**.
- **Take parameters from the source model's own draws, translated; fit only what doesn't translate.** "In general, i think this is a better working method when possible." Each game in a timeline now draws one actual AIFM run (§3).
- **No harness-only mechanics.** "Harness only things are dangerous." A calibration harness may force only what a player could reach. Otherwise fix the game mechanic. The one approved exception is labelled everywhere (player staff, pending the hiring market).
- **Order of work** (the designer endorsed this standard practice): Stage 1 forced runs of the player's mechanics with the source's inputs (open loop, then close loops one by one; the runaway loop "compute → research → models → money → compute" is delicate) → Stage 2 the coupled game with a sourced realistic-lab policy → Stage 3 the strong bot / difficulty.
- **Keep it tractable.** China/geopolitics, government/public posture and adoption are fixed at one middle-of-the-road setting each (China `fastfollower`, government `dealmaker`, public `anxious`, econ `ai2027`). Alignment is **one fixed setting for now, "central, leaning hard"** (shift −0.4, threshold 0.4 fixed). The five difficulty levels come back in Stage 3. "We can always expand later."

**Design rulings on mechanics** (the reasons are in `design/bal/STAGE1-DESIGN.md`)
- **Research taste** works through ideation, a tangible concept ("I like that we channel the abstract taste into more tangible ideation"). Combined with ideation, it must have **the same effect as the AIFM's taste**.
  - Taste sets idea **quality**, not quantity.
  - Idea quality is a **human/AI mixture** weighted by labour share ("taste is more like a distribution that affects how good ideas are").
  - Judging noise uses the same mixture.
  - Taste saturates toward the AIFM ceiling.
- **Ideation gets no compute requirement** ("I don't want to add compute need for ideation").
- **Safety research uses the same code as capabilities research** ("make sure they actually use just the same code so they dont drift"). Unlock and safety projects get taste effects **later, not now**.
- **Diminishing returns:** lines follow the AIFM log law. For one-off projects the designer prefers "within one project", but one-off projects yield one result, so option D: left as they are for now.
- **Idle training compute flows to experiments** only via the lend policy (already a game mechanic).
- **Scale must be calibrated properly** (the designer's play impression: early scaling never hit a limit; late tiny models were too good). The additive, sourced scale-dependence is in. A size ceiling for small models (M3) is an open decision.
- **Hiring market** (to build later): global talent pools per kind and level, mostly outside AI firms at the start, inflow from graduates and other fields, outflow to hiring, wages rising for everyone with demand and depletion.

**How to work with the designer**
- **Consolidate; don't spread out.** "We are spreading out too much. we need to consolidate - what changes do we need to do, and then see effects on the run." Work in rounds: an agreed change list, then **one** measurement, then decide.
- **Show results on dashboards**, not in files ("I want dashboards for me to see headline outcomes and data").
- **Explain definitions plainly** when asked; the designer asks real conceptual questions (e.g. "how can the timelines have a different opinion about the present?"). Never assume they're settled.
- **Mechanic changes are the designer's decision:** diagnose first, propose with a recommendation, then implement on approval. Source-derived settings can go ahead within the agreed method.
- The designer is happy to defer decisions ("I prefer not to decide on these now"). Record them as parked and don't re-ask unprompted.

**Agent working style** (memory: `opus-only`, `context-and-cache`, `small-subagent-tasks`, `manage-agent-time`)
- **The lead (Opus) designs, briefs and reviews; workers are Sonnet 5.5 at high or medium, never low.** The designer chose this for the balance workstream.
- Tasks are small and single-concern, with an exact spec, a "done when", stop-and-report instead of judgement calls, and a time budget.
- **Keep context small:** a run and its analysis are separate agents, results go to files, and reports are about 15 lines.
- Long runs go in background jobs under 2 hours each, resumable from the cache.

---

## 2. Status at handoff

- **Built and committed on `bal`** (`git log --oneline` for detail):
  - the registries (§4);
  - the tools (§5);
  - the scenarios and timelines (§3);
  - the round 1–3 mechanics changes: taste ceiling (fix A), taste mixture (fix B), shared safety code, compute split matching real labs, research pools from the AIFM stock, additive scale-dependence plus the duplicate removed, P24 as a line, and per-game AIFM draws;
  - the matched speed-up metric and by-phase scoring.
- **R3.3 done** (committed). AI coverage now follows each drawn AIFM run's automation logistic: per-world `covS`/`covTop` on the `tl-*` worlds, a clean translation (`FIXC-TRANSLATION.md` §8).
  - **New open problem, a mechanism decision for the designer:** in central and slow, higher coverage *lowers* the matched speed-up (`spdM` 0.3–0.9 instead of rising; fast reaches the AIFM's 1.2–1.5).
  - **Hypothesis, untested:** the game's labour CES (ρc = −2, complements) has no optimal choice, so when AI copies are few relative to humans, automating work reduces effective labour (L < H). The AIFM's optimal CES never lets automation lower labour. Candidate fix: a `max(H, L)` or optimal-allocation rule (humans keep doing what AI can't staff).
  - Run `balance/runs/r33check`.
  - **Test this before M3:** a small counterfactual probe, then a proposal to the designer.
- **Designer decision (2026-11-27): the labour-CES problem is DEFERRED.** Diagnosis: the game always gives AI *every* AI-capable task (coverage A), with no optimal split. Proposed fix: AI takes the output-maximising share up to A, as in the AIFM. It's in the deferred list; don't implement it without the designer's go. Until then, the central/slow pre-SC speed-up stays under 1 on `tl-*` worlds; keep that in mind when reading M3.
- **Next steps:**
  1. **M3 measurement:** forced run, `--world tl-fast,tl-central,tl-slow`, policy `reflines`, about 8+ seeds per timeline (draws vary, so use many seeds), read on the dashboard.
  2. **Fit the residuals within the source ranges** (the SC threshold, the P24 line strength `[D]`, and the takeoff if still short).
  3. If takeoff still runs short, take the mechanism suspects to the designer: the CES-free ideation channel and the experiment-share ramp.
- **Open designer decisions:**
  - M3, a small-model size ceiling (`design/bal/SCALE-DIAG.md`);
  - whether to adopt a per-timeline horizon law (built, defaults only; `FIXC-TRANSLATION.md` §6);
  - merging `bal` into master (it changes game mechanics; the designer decides).
- **Deferred list:** memory `ai27-balance-deferred` (the hiring market, unlock/safety taste, release lumps, NPC calibration, Stages 2 and 3, the parked decisions in `design/BAL-TASKS.md`).

## 3. Scenarios (what we calibrate against)
- **Source:** the AI Futures Model, `github.com/AI-Futures-Project/aifm-public` at 1c40ecdb, **Eli's config unchanged** (sha256 in `aifm-runs/CONFIGS.md`), 3,000 runs in `C:\Users\david\Documents\projects\aifm-runs\out\eli_1..3`.
- **Timelines = the SAR-date split:** fast = SAR percentiles 20–30, central 45–55, slow 70–80, about 290 runs each. Medians (AC / SAR / ASI): fast 2027.9 / 2028.4 / 2029.8, central 2029.7 / 2030.6 / 2033.2, slow 2034.8 / 2037.6 / 2046.5.
- **Benchmarks:** `balance/scenarios.ts`. History to late 2026 (shared), timeline checkpoints with p25/p75 (the band is the middle half), and by-phase checkpoints relative to SC/AC. Game SC = AIFM AC ("SC = AC" convention).
- **Per-game draws:** `src/data/v2/timelineDraws.ts` is generated by `aifm-runs/scripts/fixc_draws.py` and `fixc_draws_ts.py`. The worlds `tl-fast`, `tl-central` and `tl-slow` each pick one run by seed and record it as `aifmRun`. Translation formulas: `design/bal/FIXC-TRANSLATION.md`.
- **The AIFM inputs are fixed author projections** (compute by use, human researchers). The AIFM doesn't optimise allocation.

## 4. Registries and rules
- `balance/params/*.ts`: every number, tagged by `kind` per **`balance/CLASSIFY.md`** (the permanent rulebook). `balance/targets.ts`: the old target registry (152). `balance/schema.ts`.
- **When adding or changing a constant,** update its registry entry with its source. `npm run registry:lint` must pass.

## 5. Tools (run in the bal worktree)
| Command | What it does |
|---|---|
| `npx tsx scripts/v2/balrun.ts --name N --forced aifm --policy reflines --world tl-fast,tl-central,tl-slow --seeds 8 --workers 8` | Forced calibration run of the player's lab: AIFM compute and staff in, unlimited cash. Records yearly or quarterly `series` incl. matched speed-up `spdM`; the staff harness exception is on and labelled. Without `--forced` it's a normal bot run. `--sets file.json` / `--set id=value` override registry params (see `paramOverride.ts --census`). Resumable: re-running replays the cache. |
| `npx tsx scripts/v2/s1compare.ts N` | Scores a run against its timelines, by date and by phase (shared code `scripts/v2/calibscore.ts`) |
| `npm run bal:dash -- --runs A,B` → `balance/dash/index.html` | Dashboard. **Scenarios tab → "Calibration run" picker**: game vs model overlay, pass/miss grid, before/after. Also outcomes, parameters, targets. |
| `npm run registry:lint` / `npm run scenarios:lint` | Registry and scenario-data integrity |
| `npx tsx scripts/v2/botfingerprint.ts` | 24-game fingerprint. **Proves "no behaviour change"** for refactors and default-off hooks; take before/after pairs back to back on the same tree. |
| `npx tsx scripts/v2/tastecurve.ts` | Component check: the game's taste + ideation vs the AIFM taste curve (dashboard chart) |
| `aifm-runs/scripts/*` (venv Python, `-I`) | AIFM runs, extraction, group splits, per-run translation, phase statistics |

**Forcing hooks** (default off, `src/engine/v2/core/forcing.ts`) are used only by the harness.

## 6. Key documents (all in `design/bal/` unless noted)
- **Decision logs:** `SCENARIOS.md` (scenario decisions, rounds 1–8) and `STAGE1-DESIGN.md` (Stage 1 and mechanics decisions). Task state: `design/BAL-TASKS.md`.
- **Diagnoses, the evidence behind each change:**
  - `S1-TAKEOFF-DIAG.md` (runaway);
  - `FIXC-SCREEN.md` (sensitivities);
  - `FIXC-PRESC.md`, `SHAPE-DIAG.md` (software progress shape);
  - `EXPCOMPUTE.md` / `-2.md` (compute split);
  - `SCALE-DIAG.md`;
  - `SPEEDUP-DIAG.md` (matched definition, taste after SC, and median-parameter knife edge);
  - `M2.md` (last measurement).
- **Design docs:** `REGISTRY-DESIGN.md`, `TOOLING-DESIGN.md`, `B6-PREP.md`, `SC1-SPEC.md`.
- **Background:** `../AI27-vision/design/vision/BALANCE.md` and `HANDOFF-BOTS.md` (uncommitted, branch `vision`).

## 7. Hazards (learned the hard way)
- **Never `git worktree remove --force` a worktree whose `node_modules` is a junction:** it emptied `AI27-bal/node_modules` twice. Temporary worktrees should run their own `npm ci`. To delete one, first `cmd //c rmdir '<dir>\node_modules'`, check with `cmd //c "dir /AL <dir>"`, then `rm -rf`. If `node_modules` gets wiped, run `npm ci` in `AI27-bal`.
- **Agents can't delete files** (`rm` is denied). They leave scratch in `.scratch/` (git-ignored) and may leave temp files. Don't stage `scripts/_tmp*` or `scripts/v2/_verify_tmp*`.
- **Background commands stop at 2 hours;** split long runs. The cache resumes.
- **The cache key hashes all of `src/`,** so any code change invalidates cached games.
- **Windows worker start failures** (exit 3221225794) under load: the runner retries once. Keep `--workers` ≤ 8.
- **Concurrent agents in one worktree contaminate before/after checks:** sequence them, or take pairs back to back.
- **The laptop** (i7-1355U) does about 6–10 games/min with 8 workers. Forced games run long, to ASI.

## 8. The Sonnet experiment (designer asked to try it)
**Verdict:** Sonnet 5.5 at high or medium did well on tightly specified tasks:
- inventories, tooling, dashboards, refactors with identity proofs, and diagnoses with probes;
- it reliably flagged problems and premises that didn't match the code, rather than improvising;
- weak spots: shared-resource etiquette (rewriting shared files, the worktree/junction incidents), occasionally misread numbers (the lead must verify key claims), and budget overruns on open-ended diagnoses.

It works when the lead keeps judgement and design, and gives exact briefs with stop rules. The per-task log is in `design/BAL-TASKS.md`, "Experiment log".
