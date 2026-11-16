# BUILD PLAN — Tycoon restructure (R1–R10)

Branch `game-structure`, worktree `../AI27-structure`. Inputs: design/STRUCTURE.md, TECH-TREE.md, LIMITS.md,
research/18, research/19, design/ux/mockups-v3. Status of each milestone: design/PROGRESS.md.

## 0. Decisions on the plan's open questions (2026-11-16)

| # | Question | Decision |
|---|---|---|
| D1 | Leader start: does the AI-2027 leader lab also exist? | **No.** In the Frontier-leader start the player holds the leader's position (as today). In the other three starts the simulated leader lab is added. Existing simulated rivals are never replaced. |
| D2 | Fixed team sizes vs the reference split (11 RE teams = 1,100 vs RE_ref 1,128 → h₀ = 0.976) | Accept the step. RefBot hires whole teams to `round(target)`; a `CAL_SHIFT` refit within ±0.03 absorbs it. |
| D3 | Project speed: absolute M or relative? | **Absolute M** (takeoff speeds up the tree); efforts fitted on RefBot. |
| D4 | Home of "Trusted to AI" | **Company › Agents at work** (user decision). Safety shows a summary that links there. |
| D5 | Product features baseline | The leader start's feature set is the neutral ×1 baseline; missing features are penalties, extra features gains. |
| D6 | Spinout V0 | An imported open-weight model (new variant `imported`): can be post-trained and continued, cannot be sold as-is until post-trained. |
| D7 | Live edits timing; monitor cost | Apply at the next tick. Monitor serving overhead = 0.25 × (monitor serve cost ÷ watched model's serve cost) of the product's serving need (mini on a full model ≈ 6.5%). |
| D8 | Old saves across the restructure | **No migration across the restructure.** Saves older than the restructure are rejected with a clear message ("made with an older version, start a new game"), like v1 saves. Within the restructure branch, bump `SCHEMA_REV` per milestone but migrations are only required from the previous milestone's rev when cheap; otherwise reject. |

Baseline (2026-11-16, before R1): `npm run test:v2` stops at hygiene performance (daily tick 2.9 ms vs 1.5 ms budget,
worst quarter 8.7 ms) on this machine under load; everything before it passes. Treat performance as **no regression
vs. a baseline measured in the same session on the same machine**, not the absolute 1.5 ms, until R10.

## 1. Overview

| # | Milestone | Goal | Stream |
|---|---|---|---|
| R1 | Baseline, bugs, scaffolding | Freeze reference behaviour before anything moves; fix B1–B5; add setup/meta fields | serial (first) |
| R2 | Leader lab in the world | AI-2027 leader as a simulated rival behind a setup flag; T1L test | B (∥ R3) |
| R3 | Teams and roles | Three roles in fixed-size teams; h from capabilities REs | A |
| R4 | Tech tree, capability projects | One shared tree; science teams on projects; paradigm projects and tier gates gone | A |
| R5 | Build queue and blueprint | Engineers' build capacity; free size, staleness, serving ∝ √size | A |
| R6 | Products and live edit | Products replace channels; features/price/safeguards live; Auto serving split | A |
| R7 | Internal agent packages | Four internal uses, model + monitor + compute; one Trusted-to-AI policy | A |
| R8 | Safety on the tree | Agenda hazard → projects; line health; tool upkeep without chores | A |
| R9 | Start types | Four starts with difficulty labels; big-tech parent budget; spinout imported base | B prep, then serial |
| R10 | UI completion and final gates | Top strip, codex, structure/idle/live-edit/limit tests; 200-seed bots; difficulty runs | serial (last) |

Why this order: R1 first because every later gate is a diff against a pre-restructure reference trace, and B1/B2
change bot outcomes on their own. R2 touches only the world and ships flag-off. The company systems chain: science
teams (R3) → projects (R4) → tree unlocks feed blueprint slots (R5) → build queue builds product features (R6) →
product packages give the monitor slot reused by internal uses (R7) → teams + tree + safety package feed safety
projects (R8). Start types (R9) need all of them.

## 2. Milestones

### R1 — Baseline, bugs, scaffolding (S/M)
- **B1/B2:** `actors/commitments.ts PREDICATES.noDeployAbove` checks the candidate (`params.versionId`/`channel`),
  not existing deployments; `models/deployments.ts deployGate` only consults commitments whose scope matches the
  channel/domain; the reason names the commitment and its clause.
- **B3:** one AI-labour gate (`AUTOMATE_MIN_L`) shared by `safety/agents.ts` and `safety/investigations.ts`.
- **B4:** one WSL target range in `actors/actions.ts` and `Company.tsx`.
- **B5:** deep effort becomes an option lock with its reason (Deployments picker).
- **LIMITS removals that do not touch calibration:** UI-only caps (`Company.tsx:164,212-235`); pool-share
  engine/UI mismatch (`runs.ts:93`); `split.ts setSplit` rejections become readouts ("paused: no training compute",
  "capacity-bound"); `equity.ts` silent round pull becomes a player decision.
- **Scaffolding:** `SetupV2.start: 'spinout'|'challenger'|'bigtech'|'leader'` (default 'leader'),
  `SetupV2.leaderLab: boolean` (default false); optional `EngineSystem.system` and `ActionDef.verb` tags.
- **Tooling:** `scripts/v2/ref-trace.ts --write` records RefBot (four T1 presets, stub compute; ai2027 integrated)
  into `scripts/v2/golden/ref-trace.json`: run start/finish days, paradigm adoption days, milestone days, monthly M, h,
  k, c, sdAI, quarterly revenue per channel, cash, U. Without the flag it prints a tolerance diff. This is the main
  calibration tool for R3–R8.
- **Migration:** `SCHEMA_REV` 4 (sets `setup.start='leader'`, `leaderLab=false`).
- **Gates:** typecheck; `test:v2` (performance: no regression vs baseline); `test:ui` (update B4/B5 controls);
  `bots.ts --seeds 200` all §7.4 criteria MET — record the table (new bot baseline; B1/B2 may move outcomes).

### R2 — Leader lab in the world (M, stream B)
- `actors/rivals.ts initialLeaderLab(s)`: archetype `leader` in `data/actors.ts LAB_ARCHETYPES` (weight 0), posture
  in `data/v2/postures.ts` (racer, bindingness ≤ 0.3). Appended after sampled rivals with a fixed id so `'world'`
  draws stay unchanged; its own randomness from `Rng(hash32(seed,'leaderLab'))`.
- Start: model = player V0 pm (`playerStart(w).target`), pa via `simpleStartPa`, staff.cap = hRef, compute =
  refTotal, split = shareRefAt, tasteHire 1. Daily: computeOnline = refTotal; no orders.
- `compute/market.ts exoDemand`: with leaderLab on, the netted reference demand belongs to the leader; the player's
  orders are extra demand. Optional `LEADER_CAL` lag offset in `simpleLag` (default 0). Created only when
  `setup.leaderLab`.
- **Tests:** T1L in `calib.ts` (leader milestones vs golden days within ±0.08 y SC, ±0.12 y later);
  `calib.ts --fit-leader`; hygiene newGame validity + a second performance case with the leader on.
- **Risks:** tick time (extra lab in production best-mix and in `worldfx/mix.ts`): profile; cache per-sector shares
  if needed.

### R3 — Teams and roles (L)
- **Types:** `Team { id; role:'eng'|'re'|'sci'; dept:'cap'|'saf'; size:150|100|40; heads; quality:'solid'|'strong'|
  'elite'; specialty?: Column; name?; projectId? }`; `PlayerLab.teams`, `stars`, `hiring { targets; candidates;
  filling? }`. `staff.cap/saf` stays, derived weekly from team heads.
- **Data `data/v2/teams.ts`:** sizes, `REF_ROLE_SHARE {eng .30, re .55, sci .15}`, quality multipliers, cost per
  person (cap 0.70/0.80/1.00, saf 0.65/0.80), `HIRING_BASE` 15 heads/wk.
- **Engine:** `departments/teams.ts` replaces `staffing.ts hiringWeek` (weekly candidates from a new `'company'`
  stream; team arrives when filled; attrition off heads; keep-hiring-to-N; release is a direct action). Player
  `H = reCapHeads/0.55` so `h = RE_cap/(0.55·hRef)`; paradigm FTE still subtracted from H until R4. `τ_h = 1 +
  Σ n_i(q_i−q_ref)/Sci_ref + 0.05·stars`. Build capacity and `A_eng = 1−(1−A)²` readout only.
- **Actions:** `teams.hire`, `teams.release`, `teams.move` (morale cost safety→cap), `teams.target`.
- **Bots:** RefBot team targets = `round(share·hRef(yr+0.12)/size)` (D2).
- **UI:** Company teams-by-role card + hiring card (v3-company without agent lanes).
- **Gates:** identity unchanged; T1 within tolerance (CAL_SHIFT refit ≤ ±0.03, logged); ref-trace mean h ±1%,
  milestone days ±10 d; finance payroll; lint-tradeoffs; bots 40 seeds MET.

### R4 — Tech tree and capability projects (XL)
- **Data `data/v2/tree.ts`:** ~88 nodes of TECH-TREE §2: id, column, layer, needs[], effortTM, odds ({prior:P-id}
  or {agenda:AGxx}), unlocks (paradigm id | design option | technique | feature | product), star.
- **Engine:** `models/tree.ts` + `researchSystem` (daily, order 35). Node state `player.tree[id] {status, progress,
  attempts?, priorMult?, retryDay?}`. Progress/day = `M·√(Σ size×quality×1.5 if match)/effortRef` (D3). Paradigm
  rolls use `hidden.paradigmSuccess` on first attempt; new nodes draw from `hash32(seed,'node:'+id)`. Retry: 180 d,
  half odds. Success sets `player.paradigms[id].status='adopted'` so existing `adopted()` readers work; Lab-layer
  nodes apply at once. Remove tier/L gates, `fundParadigm`, `adoptParadigm`, `paradigmLoad`. `optionLocked(s,slot,
  value)` used by `planRun`/`postFromParams`. Auto-assign idle science teams. Safety columns read-only until R8.
- **Bots:** `REF_PARADIGMS` → `REF_TREE` with start conditions copied from old gates (engine has none; bot keeps
  pacing). Safe bot adds hazard filter, safety pretraining, inoculation, P23 chain; race bot ★ only (+ stretch R5).
- **Calibration:** `calib.ts --fit-tree` sets reference node efforts so RefBot finishes on its old adoption day.
- **UI:** `panels/Research.tsx` per v3-research (know-how bar, lane tree + minimap, projects, queue, node card, team
  picker ×1.5); paradigm section leaves Models; Research in Nav.
- **Gates:** ref-trace adoption days ±14 d; T1 (refit ≤ 0.03), T2; bots 200 seeds MET; performance.
- **Risks:** beelining (check it is a strategy not an exploit); option locks change safe/mixed bots; h +4% from no
  paradigm FTE subtraction (refit).

### R5 — Build queue and blueprint (L)
- **Types:** `player.build.queue: BuildItem { id; kind:'runSetup'|'feature'|'harness'|'safeguard'; ref; needTW;
  doneTW; priority }`; `BaseDesign.size: number` (× frontier FLOP).
- **Engine:** `departments/build.ts buildSystem` (daily, order 38): capacity = Σ eng heads/150 × quality ×
  `1/(1−A_eng)` (capped). `runDesign.ts BASE_SCALE` → functions of size: minDays, S5, restart (×0.5 with
  fault-tolerant), `serve = 0.5·√size × shape × efficiency nodes` (size 1 MoE = 0.5). Delete `BASE_MAX_DAYS`; add
  `behindAtFinish`; data tokens ∝ √FLOP. `poolAllocation` proportional; stream share shown. Idle training pool →
  experiments in `labInputs`. Runs wait for their setup item ("waiting for engineers").
- **Bots:** `launchBase(size)` (ref 1, race 3, compact 0.1); ref pool shares so effective shares equal today's.
- **UI:** `panels/Blueprint.tsx` replaces `RunDesigner.tsx`; run queue shows real share and ETA.
- **Gates:** ref-trace base/post finish days ±7 d; T1/T2; calib "RefBot build queue never delays a run > 3 d";
  bots 40 seeds.

### R6 — Products and live edit (L)
- **Types:** extend `Deployment` (keep revenue/mix/commitment readers): `kind`, `miniVersionId?`, `monitorId?`,
  `price:'budget'|'standard'|'premium'` → priceIndex, `features[]`; `player.features`; policies `servingAuto`,
  `upgradeToNewest`, `autoEvaluate`.
- **Data `data/v2/features.ts`:** Memory, Deep think, Computer use, Voice & vision, Deep research, Coding agent,
  sector packs, Companion mode, each mapped to an existing term; leader set = ×1 (D5).
- **Engine:** `product.update` (model, monitor, price, safeguards, KYC, effort, features) live, next tick (D7), with
  preview; `product.launch`, `product.retire`, `feature.build` (build item), `feature.toggle`. `revenue.ts` Auto
  serves highest revenue/H100e first and records the cut (replaces silent rescale). Auto-evaluate policy replaces
  `EVAL_MAX_AGE` gate. Agents product shows its horizon gate.
- **Bots:** drop weekly `setServing`; swaps via `product.update`; no 30-day `runEvals`.
- **UI:** `panels/Products.tsx` replaces `Deployments.tsx` per v3-products.
- **Gates:** worldfx/money revenue targets with no rebaseline; finance; new `scripts/v2/products.ts` live-edit test
  in `test:v2`; bots 200 seeds.

### R7 — Internal agent packages and monitors (M/L)
- **Types:** `player.agents: Record<'eng'|'capRoutine'|'capFrontier'|'safety', {versionId?; monitorId?; compute}>`;
  internalAgent → capRoutine; safety.agentVersion/agentShare → agents.safety; monitoringShare → monitor policy.
- **Engine:** `pDepOf` reads capRoutine; `evalM` optional `qTaste` (default qDep → identity unchanged), sdAI from
  capFrontier; k counts routine+frontier agent compute vs `ref·sh.agents·(1−s_engRef)`; engineering agents raise
  build capacity. `safety/monitors.ts`: catch rate from AG05 oversight-gap tiers + control techniques; cost per D7;
  hooked into incident hazards; default (newest + standard monitor) equals today's runtime monitoring. One Trusted-
  to-AI policy (D4: set on Company).
- **UI:** Company › Agents at work lanes with model picker preview, monitor chip, compute bar, AI share, cost, risk;
  same chip on Products; compute split sliders move to `Compute.tsx`.
- **Gates:** T1/T2; safety.ts; ws4; bots 40 seeds.

### R8 — Safety on the tree (XL)
- Safety nodes are projects for safety science teams; completion fires `fireFinding` with today's type distribution
  (efficacy-driven); hazard and funding levels removed. Effort = T₁ × serious-staffing capacity. Line health from the
  Beta posterior; dead-end counter. Tool upkeep: mHalf rises with safety RE heads; refresh projects and the ×8
  ceiling removed. Investigations staffed by RE teams; clamps and 120-d close shown. Four risk-family aggregates.
- **Bots:** RefBot safety science teams on AG02/AG07/AG08/AG18; safe bot covers all lines.
- **UI:** `panels/Safety.tsx` replaces `SafetyLab.tsx` (verdict, chart, 4 families, policies; tabs: Research lines,
  Investigations, Trait graph, Incidents).
- **Gates:** safety.ts S4 bands; bots 200 seeds with every §7.4 criterion MET and bot-policy variance share ≥ M4's.
- **Risk:** largest balance risk (M4 balance came from agenda funding).

### R9 — Start types (L)
- **Data `data/v2/starts.ts`:** STRUCTURE §4.8 + research/18 §6: teams, known nodes, products, features, cash,
  compute owned/rented, board preset, modifiers, model lag, difficulty label.
- **Engine:** `init.ts buildPlayer(start)` (lag like `initialRival`); spinout V0 imported (D6), no products, 25K
  rented; big tech `finance/parent.ts` fixed yearly budget paid quarterly, equity actions unavailable with reason,
  no insolvency ending, `parent` board preset; leader lab on for non-leader starts (D1).
- **Bots:** `bots.ts --start`; bots play all four starts.
- **UI:** Setup start picker with difficulty labels; Finance variant for big tech.
- **Tests:** hygiene newGame for all starts; fixtures for challenger and spinout day 400; `scripts/v2/starts.ts`
  catch-up targets (spinout first own model 9–12 mo behind at 12–17 mo; big tech 6 → 3–5 mo within 9–15 mo;
  challenger parity possible in 12–18 mo).

### R10 — UI completion and final gates (L)
- TopStrip (revenue only, users in tooltip), Overview, Codex (structure diagram; rivals are simplified), remaining
  LIMITS "Show" items, glossary terms from the IA notes.
- **Tests:** `lint-structure.ts` (system tag on every system, verb on every action); idle test (no idle stock 30 d
  without an alert); `data/v2/limits.ts` registry checked by uitest (`data-limit`).
- **Final gates:** test:v2, test:ui, bots 200 seeds (leader start, all §7.4), difficulty runs per start, revenue
  targets; PROGRESS.md.

## 3. Cross-cutting

**Calibration.** (1) `golden-timelines.ts` and `identity.ts` never change; `evalM` may only gain optional params
whose defaults reproduce today exactly. (2) Every new layer is neutral at the reference configuration (RE_ref → h=1;
Strong science → τ_h=1; build queue non-binding at reference load; size 1 → serve 0.5; leader feature set ×1;
standard monitor = today's monitoring; safety effort = T₁ at serious staffing; engineering agent share netted out of
k). (3) Anchors: RefBot playing the leader start with leaderLab off (T1, T2, fixtures, bots through R8); the leader
lab (T1L) from R2, carrying the golden path in non-leader starts after R9. (4) Knobs: CAL_SHIFT (±0.03 per
milestone, logged), LEADER_CAL, tree efforts; revenue targets and §7.4 criteria are never rebaselined. (5) Risky
points: R4 gates/FTE, R5 idle-to-research and proportional pools, R6 Auto split and features, R8 safety projects,
R2/R9 leader lab. (6) Determinism: new randomness via a new `'company'` stream or `hash32(seed,key)`, never extra
`'world'` draws. (7) Tick budget: additions > 30 µs/day need memoising or slower cadence.

**Saves.** See D8.

**UI.** Use the good-ui skill before and after each panel; reuse `kit.tsx`/`components.tsx`; keep `data-home`
unique per the v3 IA notes; each milestone rewrites its uitest section. Replace: Deployments→Products,
RunDesigner→Blueprint, SafetyLab→Safety. New: Research. Adapt: Company, Models, TopStrip, Overview, Setup, Codex,
Nav, Finance, Compute. Reuse: TraitGraph, RiskMap, RiskSources, ResearchCharts.

**Parallelism (≤ 2 streams).** Stream A: R3→R8 serial. Stream B: R2 ∥ R3; R9 prep ∥ R5/R6; R10 shell parts. Serial:
R1 first; R9 integration after R8; R10 gates last. Shared files (types.ts, init.ts, save.ts, registry.ts, hygiene
tables, bots/ref.ts): stream B stays out of PlayerLab internals; the stream merging second rebases.
