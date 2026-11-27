# N2b-1 result: the NPC lab's capability core

Task N2b-1 of NPC-TASKS.md, branch `npc-n2b1` (off `npc` fa8aaa4). Spec: NPC-LABS.md draft 2, §3, §4, §10, Appendix A.
Saves break: SCHEMA_REV 112 → 113, no migration. Moves calibration: yes (NPC behaviour changes by design).

## What changed

- **New `src/engine/v2/npc/lab.ts`**: the NPC lab. State `RivalLab.npc` (types.ts `NpcLabState`): kind, family, lag
  `d` and `d0`, start compute `c0`, release phase and count, readouts (`dStar`, `short`, `slope`, `rec`) and `hist`,
  the internal model's G over the last release lag + 1 days.
- **Daily rule** (`npcCapabilityDay`, called from actors/rivals.ts `labDaily` for US labs and China's lab):
  - d* = d0 + max(0, log10(cPlan / C)) ÷ today's reference slope (OOM a day, over the last 0.1 yr of G_ref).
  - d relaxes exactly: d ← d* + (d − d*)·e^(−1/τ_D), τ_D = DIFFUSION_TAU_DAYS.
  - Internal G = G_ref(t − d). Public model = the internal model's G one release lag ago (from `hist`), replaced every
    119 days. The labs' first release days are staggered evenly over one cadence in cast order (1, 18, 35, ... for 7 labs).
  - Both models are built with `setModelG` on a reference-profile build (`referenceProfileModel`, the same thing the
    milestone predicate used for a model known by G), so Lg, domains, flop, params and fpt are set. Training FLOP = B0's
    FLOP × (C × frontierRunShareAt(yr)) ÷ (1e6 × 0.4), size = `baseParams(flop)`. One rule.
  - Openness by the kind's rule: open (Wolderfield), chinaRung (Xuanmu, open while rung < 3), closed, and partial
    (Zorvane): on each release the model it replaces becomes open weights. Each open release calls `openWeightsReleased`.
  - Lineups (`rivalLineupStep`), tools (`rivalToolStep`), milestones (capability.ts) run unchanged on the new models.
- **Init from the Realistic cast** (core/init.ts, actors/china.ts `initialChina`): the US labs from REALISTIC_CAST with
  their invented names and families; Marenth (leader kind) only when the player's start is not 'leader'. d0 =
  30.4 × (public lag − the leader's), leader 0. **This replaces spec §16 R5's conversion.** Pellory (upstart, no public
  model) takes its [D] band, 3 months, as its lag and has no public model until its first release (day 86). Compute,
  revenue, valuation, raised and tools from the cast; cash from today's FIN table by archetype (the cast has no cash).
  China's lab: Xuanmu Lab / Muyi, d0 = 197.6 d, compute from the meter (deepCentCompute) as before, staff 1500/60 as before.
  `setup.rivals`, `rivalCount`, `leaderLab` are no longer read (they still compile). Postures from the kind replace the
  sampled ones in `hidden.rivalPostures` (sampleHidden still draws them, so the 'world' stream is unchanged up to the rivals).
- **Removed from the tick**: production.ts's NPC research (`advanceLab` for NPCs, rule A diffusion into NPC labs) and
  labDaily's base runs, post-training, continual learning and release logic. `rivalResearch`, `initialRival`,
  `initialLeaderLab`, `initRivalPhys`, `startDistillEquilibrium` stay exported, unused by the game (N12 deletes).

## Adapters (minimal, each until the named task)

| Reader / writer | Adapter | Replaced by |
|---|---|---|
| `phys` (rivalRunFlop, distillationLeak, theft) | `npcPhys`: one base at the internal model's flop/params, day = last release, recipe in `rec.pre`, no run, `serve` 0 | N12 |
| `recipeOf` (diffusion rule A for the player, secrets leak, absorption, A4/C6 previews) | `npc.rec`; a release's `recG` = its G − G(V0) − log10(C ÷ the leader's start compute 0.82M). **G(V0) subtracted** so it is in the recipe's unit (OOM over the leader's day-0 recipe); the spec's formula omits it | N4 / N6 |
| `addRivalKnowledge` (publish, open weights to China, IP access, E16 tacit, safety spill, E1, absorb, secrets leak) | a lag shift: d −= dG ÷ today's reference slope (the spec's OOM-to-days rule, §4); d then relaxes back | N6 |
| theft (security/theft.ts) | after the stolen copy is set, `npcHoldG`: China's d jumps to where G_ref equals the stolen copy's G (only shortens) | N6 |
| `postureOf` | through `hidden.rivalPostures`, written at init: today's archetype posture with safetyInvestment = safety emphasis, raceRelaxation = race response. China unchanged (chinaPosture + concern). Security keeps today's floor + 0.4 × safetyInvestment | N2b-2 |
| `archetype` | the old archetype id of the kind (racer → maverick, china → deepcent, others the same) for postures, tools at start, finance governance, epilogue | N12 |
| `parentFunded` | the kind's funding (parent / state never fail; private can distress). **Marenth is now private** (KINDS.leader.funding) | N8 |
| chip orders (rivalFinanceQ, exoRefQ netting, default demand) | quarterly order = C × (appetite^¼ − 1) × the cash factor; the market nets the same. First orders placed at newGame for the first quarter | N8 |
| production readouts (`computeProduction`, prodCache) | undefined for NPC labs; `production(s, rival)` falls back to the player's (no reader found); traits S8 reads 0 agent FTE | N2b-2 |
| staff | cap = C × 2050/1e6 (one typical ratio), saf as today; grows on the reference headcount path as today | N12 |
| traits, incidents, pressure, goalposts, latent flag | unchanged code; the trait graph steps once per release ('post'), it stepped per post-training (6-10 weeks) before | N2b-2 |
| `nextBaseDay` | the next release day (projectLabMis reads it) | N5 |
| worlds without a draw (not tl-*) | G_ref = G(V0) + 1.2 OOM/yr × (t − 2025.445) (PRE_GAME_G_PER_YEAR) | open question 2 |

## New parameters (for the lead's registry; I did not edit registry files)

| Name | Value | Where | Tag |
|---|---|---|---|
| DAYS_PER_MONTH | 30.4 | npc/lab.ts | [D] |
| CHINA_PLAN_GROWTH (China's planned compute growth) | ×2 / yr, the meter's own rate | npc/lab.ts | [repo china.ts] |
| SLOPE_FLOOR_PER_YEAR | 0.01 OOM/yr | npc/lab.ts | [D] |
| SLOPE_WINDOW_YEARS (reference slope window) | 0.1 yr (one grid step) | npc/lab.ts | [D] |
| STAFF_PER_H100E | 2050 / 1e6 | npc/lab.ts | [repo H_REF_BASE] |
| pre-anchor reference | G_ref(t < 2025.445) = G_ref(anchor) − 1.2 × (anchor − t) | npc/lab.ts refGAt | [repo PRE_GAME_G_PER_YEAR] |
| Model FLOP rule | B0 × C × frontierRunShareAt ÷ 4e5 | npc/lab.ts npcRunFlop | [repo initRivalPhys sizing] |
| Pellory start lag | 3 months (its band) | npc/lab.ts startLagDays | [D] |

## Tests

`npx tsx scripts/v2/npcLabs.ts`: all pass (tl-central, challenger start, seed 7, 900 days, endings skipped).
(a) 900 days, no errors. (b) Marenth on G_ref within 0.0000 OOM for its 366 days before its first shortfall.
(c) all 7 start lags equal the cast; no Marenth in a leader start (5 US labs). (d) 36.7% of a 60-day kick left after
τ_D (e^−1 36.8%), against a control copy. (e) a 0.5 OOM cut raises d* by 140.5 d = 0.5 ÷ slope. (f) every lab
releases on each of its release days, every 119 d, public = internal one release lag earlier (0.0000 OOM). (g) China's
lab the same, and internal G = G_ref(t − d) every day.

`tsc --noEmit -p .`: clean.

Whole-game scripts (quick tier), `npc` before (worktree at fa8aaa4) vs this branch: see the table appended below.

## What the 900-day game shows (seed 7, challenger)

| Lab | d0 | d at day 900 | shortfall | compute | status |
|---|---|---|---|---|---|
| Marenth | 0 | 111 d | 0.53 OOM | 7.1M (plan ~24M) | active |
| Lanternworks | 91 | 137 d | 0.23 | 1.3M | **merged ~day 700** |
| Tarnwick | 76 | 48 d | 0 | 12.2M (took the merged labs' compute) | active |
| Zorvane | 198 | 260 d | 0.32 | 1.2M | **merged ~day 700** |
| Wolderfield | 292 | 292 d | 0 | 5.6M | active |
| Pellory | 91 | 91 d | 0 | 0.11M | active |
| Xuanmu Lab | 198 | 152 d | 0 | 1.9M | active |

The probe (quarterly cash, spend, orders): deliveries match the plan while cash lasts. The shortfalls are all cash:
private labs' spend (C × the per-H100e cost) outgrows revenue plus raises at their appetites (Marenth 4.5×/yr: spend
$99B/yr against revenue $24B by day 730), so `rivalFinanceQ`'s cash factor cuts their orders, and Lanternworks and
Zorvane go into distress and are licensed by Tarnwick around mid-2027.

## Open questions for the lead (shape)

1. **Private labs can't fund their appetite** (above). The leader-kind lab falls ~3.7 months behind its reference by
   end-2027 and two private labs exit mid-2027. The spec says private labs short of cash order less "as today"; today
   the leader lab was parent-funded on the reference compute path and rivals grew 2.25×/yr. This is N8's ground
   (finance and orders); I did not tune it. Options: N8 sizes raises/commitments for the appetites, or the leader's
   funding/appetite changes, or orders fall back to the plan once cash recovers (today an order is growth on current
   compute, so a shortfall never heals).
2. **Worlds without a draw** (ai2027, authors2026, ...): a linear stand-in reference at 1.2 OOM/yr. Many existing test
   scripts use those worlds; their NPC labs now move on that line. Should they use a fixed tl-central run instead?
3. **Absorption through the recipe adapter** moves the buyer's lag a lot (Tarnwick 76 → 48 d after two mergers): the
   seller's "recipe" by the §4 formula is high when its compute is small. N6's absorb shock ("the buyer takes the better
   d") would replace it.
4. Serving efficiency (`phys.serve`) is 0 for every NPC lab now (it grew with research before): their serving cost per
   token rises with model size. N4.
5. China in Nov 2026 (check 6.5-8 months) not measured here; its lag fell 198 → 152 d by day 900 through the open-weights
   and secrets-leak adapters.
