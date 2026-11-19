# Model v3 build plan (phase details)

Spec: [MODEL-V3.md](MODEL-V3.md). Numbers: [research/20](../research/20-model-v3-calibration.md). Status rows:
[PROGRESS.md](PROGRESS.md) (V rows). One serial stream on branch `model-v3` (worktree `../AI27-model3`); the branch
merges to master only after V7. Each phase leaves the game running, `npm run test:v2` green (tests updated where
the spec changes behaviour, never deleted to pass) and `npm run build` clean.

## Bridges (temporary, removed by the phase named)

The core is rebuilt in steps, so some old quantities stay as **derived bridges** for a phase or two. A bridge is
read-only, computed from the new physical state, and marked `// BRIDGE(Vn)` at its definition so the removing phase
can find every use.

| Bridge | Defined in | Meaning | Removed in |
|---|---|---|---|
| `pm` of a version / base | V1 | Φ(G): the old progress coordinate computed from effective compute, so the production function, milestone thresholds, M-based readouts, rivals and safety keep working | V3 (work types, milestones), V6 (safety M), V7 (rivals) |
| `e_stack` from know-how `pa` | V1 | stack efficiency (OOMs) = E_PER_PA × (pa − pa₀) until ideas exist | V2 |
| `serveCost` (0.5 = reference) | V1 | relative serving cost from FLOP per token, so revenue and agents keep working | V4 |
| fixed eval days | — | evals stay as today | V5 |

---

## V1 Capability core

Goal: models are built from physical quantities; capability is effective compute G; no floors; no F(t)-relative
sizes; domains come from training, not the era table. Spec §2, §3, §4.

### V1.1 Effective compute module (new `src/engine/v2/models/effective.ts`, data in `src/data/v2/runDesign.ts`)

- **Base:** inputs active params N_a, tokens per parameter r (D = r·N_a), architecture (dense / MoE / latent), data
  mix, e_pre at launch. FLOP = 6·N_a·D.
  G_pre = log₁₀(FLOP) + e_pre + e_shape + log₁₀(f_over(r)) + log₁₀(f_data).
  - f_over(r) = 10^(−0.2·log₁₀(r/20)²) [R20 A1].
  - f_data: effective-compute fraction from repetition when D exceeds the unique tokens U available
    (Muennighoff: D_eff = U·(1 + 15.4·(1 − e^(−(ep−1)/15.4))), ep = D/U), converted to an effective-compute fraction
    with the Besiroglu loss law (E 1.82, A 482, B 2085, α 0.348, β 0.366) [R20 A1, A3]. Replaces the old −0.25·ln
    data-wall penalty. Synthetic/multimodal data keep their current "no wall" rules for now (V5 makes data assets).
  - e_shape: MoE 0 (reference), dense −0.3 OOM (old −0.24 y), latent +0.5 OOM (old +0.4 y, needs P17).
  - Curation and data-mix options keep their current Δ as OOM equivalents (convert y → OOM with the bridge slope B,
    below) until V2 turns them into ideas.
- **Serving:** FLOP per token = 2·N_a. MoE active/total ratio 1/8 [D]; dense active = total.
- **Post-training:** RL budget = RL FLOP as a fraction ρ of the base's pretraining FLOP (options: light 0.03,
  standard 0.15, heavy 0.4 [D, R20 C1 range 0.05–1]) split over RL families by the existing focus choice (broad =
  equal weights over the families the lab knows; one or two focus families = 70% on them, 30% spread) [D].
  Per family: ΔG_f = A / (1 + (C_mid ÷ C_f)^B_RL), B_RL = 1.8 [R20 C1]; A = A0 + a1·(G_pre − G_V0base) with A0 ≈ 1.0
  OOM, a1 ≈ 0.1 [D: R20 C1 "ceiling set by the base"]; C_mid = c0 · FLOP_pre ÷ 10^e_RL (RL recipe efficiency moves
  the midpoint, not the ceiling). Domain gains ΔG_RL,d = Σ_f w_f-normalised gains through T[f][d] (1.0 same, 0.4
  adjacent, 0.15 far; write the family→domain table from the existing RL_FAMILIES `v` vectors) [R20 C2].
  The general ΔG of the version = mean of ΔG_RL,d over the eight cognitive domains.
  Grader choice (cheap / hardened) no longer changes capability; it keeps its trait signal and cash (suites come in V5).
  Calibrate c0 so the reference post-training run (standard ρ, broad) at game start gives ΔG ≈ 0.7 OOM [D: R20 B3/C3,
  research/12 "reasoning RL ≈ 1 OOM"].
- **Distillation:** G_student = G_teacher − δ(N_s/N_t_active, tokens), δ fitted to the R1 distillation anchors
  (≈90% / 70% / 35% of teacher score at 32B / 7B / 1.5B vs a 37B-active teacher) converted to OOMs through the
  benchmark sigmoid [R20 C4]; never above the teacher. Student size is a design input (default N_s = N_t/8 [D]).
  Replaces DISTILL_PM_PENALTY. Serving from N_s.
- **Continued pretraining:** G_new = log₁₀(10^G_old_pre + FLOP_cont × 10^(e_pre,now + e_shape)). Replaces pcContinue
  and CONTINUE_KAPPA.
- **IDA (P18)** keeps its mechanism but in OOMs: the amplified version gets +ΔG from the RL curve on the extra FLOP
  (no fixed +0.25 y).
- **Recipe at launch:** base runs freeze e_pre at launch; post runs freeze e_RL at launch; a new post run on an old
  base uses today's e_RL (typed retrofit, spec §4.4). κ (KAPPA.post, POST_PA_AT) is removed.

### V1.2 Durations

- Wall time = FLOP ÷ (run's share of the training pool × Φ_FLOP/H100e-day × goodput). Φ already contains MFU 0.4
  [R20 A4]; goodput 0.90, ×0.95 with Fault-tolerant training [R20 A4].
- RL runs use MFU_RL = 0.6 × MFU (rollouts) [D, R20 C1]; distillation like pretraining.
- **Remove** sizeMinDays, POST_DAYS, the safety-training extra days, DISTILL_DAYS, CONTINUE_MIN_DAYS, minDays checks
  in runs.ts, and the per-run restart roll (`restart`, holdUntil, the loss-spike log). Fault-tolerant training now
  acts through goodput.
- Run setup (engineers' build queue) stays.

### V1.3 Levels and domains

- Bridge Φ: pm = pmV0 + (G − G_V0)/B, with G_V0 = G of the start version V0 and B = G per progress-year
  (≈1.2, research/12 §0.2; set it so the old reference cadence lands near the old pm path) `// BRIDGE(V3)`. All
  existing readers of `pm` keep working.
- e_pre and e_RL from know-how: e = B × (pa − pa₀) `// BRIDGE(V2)`: one progress-year of know-how = B OOMs.
- Domains: L_d = levelOf(Φ(G_pre + ΔG_RL,d + s_d,data)) − o_d + design offsets that stay (features, paradigm domain
  offsets). o_d = −REF_OFF[d][0] (the 2025 profile) incl. the RSCH taste penalty until P19. **Remove** the era
  interpolation of REF_OFF. s_d,data: the existing data-mix domain offsets converted to OOMs.
- `build.off` keeps meaning "domain level minus general level" so deltaRsch, products and benchmarks keep working.
- Time horizon: keep h80Of's current curve (it reads pm through the bridge) for V1; V3 rebases it on AGENCY.

### V1.4 Start state

V0 and B0 are built from physical numbers: B0 = a 2025 frontier base (choose N_a and r so FLOP ≈ 3e26 and G_pre
matches research/12's Aug-2025 anchor once RL is added: G_V0 ≈ 28.0 incl. ≈0.7 OOM RL) [R20, research/12 §0.2]. Other
start types scale N_a from their start tables. The start lag logic (`playerStart`, `simpleStartPa`) must still give
the same start pm for V0 (Φ is fitted so).

### V1.5 Blueprint and run queue UI

- Blueprint size = active-parameter snaps and tokens-per-parameter snaps (20 · 50 · 100 · 200; label "compute-optimal"
  and "overtrained ×n"). Tiles show FLOP, wall time, G gained vs your best base, serving FLOP/token, data repetition,
  cash, engineers' load. No "× frontier" anywhere. Default proposal: the largest size that finishes in ≈6 months on the
  run's pool share (J1 B3 logic, now in params).
- Post-training card: RL budget (light / standard / heavy as ρ), family focus as today, predicted ΔG per domain.
- Run queue ETA = FLOP left ÷ rate; no "waiting for minimum length" state.
- Follow the good-ui skill (`.claude` skill "good-ui"); every new term gets a glossary entry and tooltip.

### V1.6 Tests and calibration

- Update scripts/v2 tests that assert removed behaviour (min days, restarts, κ, distill −0.30, era offsets). Add a
  V1 test file `scripts/v2/effective.ts` (added to `test:v2`): FLOP = 6ND; f_over values (10× → 0.6, 100× → 0.16);
  repetition (4 epochs ≈ free, 16 ≈ worthless); RL curve monotone and bounded by A; distill never exceeds teacher;
  continue adds effective compute; wall time scales as 1/compute with no floor; a fixed physical run gives the same
  G whatever its start date (the v2 calendar bug).
- Calibration: run `npx tsx scripts/v2/calib.ts` and the golden tests. The reference bot's milestone dates may move;
  refit CAL_SHIFT / LEADER_CAL with the existing `--fit` / `--fit-leader` tools if needed and record before → after
  per preset in PROGRESS.md. A drift beyond ±0.3 y on any preset after refit means a mechanism is off: stop and report.
- The bot criteria (`npm run bots:v2`, 40 seeds) are reported, not required, in V1 (V3 rebalances).
- schemaRev bump; saves from before are rejected with the existing message.

Done when: tests green, build clean, PROGRESS.md V1 row with the calibration table, one commit series on `model-v3`.

### V1 notes (choices made while building, 2026-11-18)

Design values ([D]) and deviations from the brief, each with its reason. Code: `src/engine/v2/models/effective.ts`
(pure arithmetic), bridges in `models/capability.ts`, data in `src/data/v2/runDesign.ts`.

**Start state and anchors**
- B0 = 1T active MoE (8T total) × 50 tokens per parameter = 3e26 FLOP, 50T tokens (research/12 §0.3: 2025 frontier
  3–5e26). `E_START = 1.38` OOM is the leader's recipe at day 0 over the GPT-4-era reference recipe (research/12's
  convention: GPT-4 = log₁₀ FLOP; the spec's "public July 2025 recipe = 1" would contradict its own 28.0 anchor), fitted
  so V0 lands at G = 27.97 incl. 0.67 OOM RL.
- The know-how bridge's zero pa₀ is the leader's day-0 know-how; `playerStart` keeps v2's closed form (with v2's
  retention 0.7 as a local constant, `START_RETAIN`) only so pa₀ and B0/V0's recipe vintages stay where they were.
- Follower starts keep B0's physical size; their lag is in know-how. Because the RL curve is not linear in its recipe,
  the know-how lag is solved by bisection so pm(V0) = target − lag exactly (brief: "Φ is fitted so"). Scaling N_a down
  instead would need *more* know-how than the leader to hold the start pm, and their first own base would leapfrog it.

**Pretraining**
- f_data: compute-optimal compute at L(N, D_eff) over that at L(N, D) (Besiroglu law), so repetition is valued in G.
  Muennighoff's R* = 15.4 makes 4 epochs ≈ free (0.945) and 16 epochs 0.71; "16 ≈ worthless" in the brief is the
  marginal token (worth 0.38 of a fresh one at 16 epochs, 0.05 at 48), which is what the test asserts.
- Unique tokens U = licensed + unlicensed (× licence deals) + 0.5 × synthetic (× 3 with P10): v2's stock without its 3
  epochs. Synthetic/multimodal data and P10 keep "no wall" (f_data = 1).
- The old shape `overtrained` is gone: overtraining is tokens per parameter. Above 50 needs the existing
  "Overtrained compact" idea (slot `tpp:over`) [D]. Dense now serves at the same FLOP per active parameter (the brief's
  2·N_a); its cost is −0.3 OOM. Latent keeps v2's serving advantage as a token multiplier ×0.4.
- Run scale vs F(t) survives only as `TrainingRun.scale` / `BaseModel.scale`, `// BRIDGE(V3,V6,V7)`, for S5, public
  scrutiny and engineering setup/operations, so those systems (rebuilt later) keep their v2 calibration.
- Serving: `serveCost` (BRIDGE(V4)) = 0.5 × N_active ÷ N_ref(FLOP), N_ref = √(FLOP/(6·50)): relative to the reference
  design *at the same training FLOP*. A literal 0.5 × N_a/N_B0 grows ×3–6 by 2027 for the reference lab and would cut
  agent copies (T2) and revenue by as much; the tiles show the physical 2·N_a FLOP per token.

**Post-training**
- The design has `rlBudget` (light / standard / heavy = ρ 0.03 / 0.15 / 0.4) and `graders` (cheap / hardened) instead
  of v2's `rlIntensity`. S2 multiplier = budget (0.5 / 1 / 1.3) × graders (1.5 / 0.6), S7 0 / 0.2 / 0.3: v2's
  light-hardened 0.3, heavy-cheap 1.5 and heavy-hardened 0.6 are unchanged. The race bot maps to standard + cheap.
- Transfer acts on compute, not gains: domain d receives C_d = Σ_f w_f·T[f][d]·RL FLOP and gains A/(1 + (C_mid/C_d)^1.8).
  Summing per-family gains through T would exceed the ceiling under broad RL (REASON gets transfer from every family);
  on compute the result stays monotone and bounded by A. T from RL_FAMILIES v: largest entry 1.0, other entries 0.4,
  the rest 0.15.
- "Families the lab knows" for broad RL = every family with environments: all but computer use until P06. The rl.*
  tree nodes unlock *focusing* (as in v2), not RL itself (the start lab knows none of them).
- **Deviation:** the RL ceiling is A = 1.0 + 0.1·log₁₀(FLOP_pre ÷ 3e26) (the base's physical size; Khatri et al.: the
  asymptote rises with base model size), not 0.1·(G_pre − G_ref): through the know-how bridge G_pre grows by hundreds
  of OOMs in a takeoff and that ceiling ran away (pm 10% ahead of know-how; authors2026 ASI −0.38 y after refit).
- c0 is solved so the reference run (standard, broad, e_RL = 0) gains 0.70 OOM averaged over the eight cognitive domains.
- Domain levels are read against the reference run's RL profile γ_d (o_d = −REF_OFF[d][0] − RSCH taste + γ_d in G), so
  the reference recipe reproduces the 2025 profile (V0's offsets ≤ 0.2 L) and only training choices specialise.
  `build.off` = level(Φ(G_d)) − level(Φ(G)) + level offsets (preference, paradigms), computed when a build is made.
- Post runs freeze e_RL at launch (v2 used pa at completion); continued pretraining's base gets
  ePre = G_new − its physical part, so a stream on it re-applies today's recipe consistently.

**Derived runs**
- Distillation δ = 0.19 + 0.92·log₁₀(N_t/N_s) OOM (R1 distills: AIME logit gaps 0.44 / 1.15 / 2.27, least-squares
  a 0.29 b 1.38 logits, ÷ 1.5 logits per OOM for the game's math benchmarks), + 0.2 per OOM of tokens below 20 per
  student parameter [D]. Distillation FLOP = 2·N_t·D + 6·N_s·D. Default student N_t/8 (brief). RefBot distils N_t/2
  (δ 0.47 OOM ≈ 0.39 progress-years, v2's mini −0.30 y): with N_t/4 (v2's serving ×0.25) the gap is 0.62 y, its public
  models trail, and hype, valuation and distress miss (F7 valuation $0.62T vs $1–3T, F8 67%, equity +20%); N_t/2 passes
  all finance targets (2026 revenue $44.9B, valuation $1.52T, 2027 revenue $140B).
- Continue: 0.3 × the parent's FLOP [D, research/12 0.2–0.5]. IDA: one more standard RL budget (0.15 × base FLOP) at
  today's RL recipe on the RL curve.
- Continual learning (P08) keeps v2's semantics through the bridges: the stream version re-applies today's
  pretraining and RL recipe at the tracked know-how (7-day lag) to its base's physical part (`// BRIDGE(V2)`); spec §4.6's
  RL-FLOP stream is later. Without this the reference lab has no post-SC progress channel.

**Durations**
- Goodput 0.90, 0.95 with fault-tolerant training (read "×0.95 with FT" as goodput 0.95: R20 range 0.80–0.95).
  RL runs at MFU_RL = 0.6 × MFU. The reference post-train on B0 now takes ≈ 12 days (v2: 70–84 minimum days).
- RefBot sizes bases to train in 121 days on 60% of its pool (v2's 1F took that long) at 50 tokens per parameter;
  followers 200 days. The start run R0 is a standard RL run launched day −3, 30% done.

**Calibration (see PROGRESS.md V1)**
- `capIndexV2` interpolates on `thresholds(w)` itself: the old `capIndex(p + calShift)` jumped at A0 for calShift > 0
  (V0 at L 5.18) and stayed flat on [A0, A0 − calShift] for calShift < 0 (every version up to pm 0.36 at L 5.0).
  Only the A0–A1 segment changes; V0 reads L 5.0.
- Under v3 rules the reference lab's deployed model runs 0.4–0.85 progress-years above v2's path once it trains its first
  new base (V0 is pinned; its RL sits at 0.67 of a ≈ 1.0 ceiling that later runs reach, and v2 credited V0 with 0.28 y
  of post-training retention that v3 does not). CAL_SHIFT absorbs that as a level offset (q = pm + calShift keeps M).
  Simple labs (rivals, China, the leader lab) are still on v2's lag model, so they get the same offset as a credit in
  `simpleLag`: `TimelineWorld.simpleCredit` = CAL_SHIFT_V2 − CAL_SHIFT (ai2027 0.44, authors2026 0.663, fast 0.622, slow
  −0.418), phased in over one progress-year (`// BRIDGE(V7)`), which keeps their q path and the player-vs-rival relation
  v2's. Check: LEADER_CAL refitted on top lands within 0.06 of its v2 values (a flat 0.6 credit had moved slow's to 1.06).
- The slow preset goes the other way (calShift up): its compute grows 1.6×/yr after 2028, which v2's calendar compute
  term (0.5 then 0.25 progress-years a year for a 1F run, whatever its FLOP) over-credited.
- Not rebuilt in V1 (noted for V3/V5): the production function's data term (`dataStockRatio`, N_req(F(t))) and the
  next-model-gate readout still read F(t).

---

## V2 Research: knowledge as ideas

Goal: the lab's recipe efficiency comes from **ideas found by research projects**, not from the know-how number;
projects run themselves through a lifecycle; the player only ranks projects, says how many teams each gets and sets a
risk policy; research engineers and engineers are allocated in broad strokes. Spec §5, §8; research/20 §B. Removes
BRIDGE(V2). Safety research lines (the agenda nodes) are **not** changed in V2 (V6 moves them onto this mechanism);
they keep their current project code path.

Split into two serial runs: **V2a** engine, content, calibration, tests; **V2b** UI.

### V2.1 Stacks

Three capability stacks: **pretraining**, **RL**, **serving & systems**. Each has an efficiency e_stack (OOMs) =
Σ realised effects of adopted ideas − remaining headroom, plus a start value (the leader's day-0 recipe; follower
starts lower by their start lag, as V1 solved it). They replace the bridge e = B·(pa − pa₀):
- e_pre (pretraining stack) feeds G_pre of new bases (V1); e_RL feeds C_mid of new post runs (V1);
- serving & systems feeds serving FLOP per token, MFU and goodput (V1 constants become stack values).

### V2.2 Projects (data: rewrite `src/data/v2/tree.ts` capability part; safety nodes untouched)

Each capability project has:
- **kind**: `line` (repeatable research direction; generation n = 1, 2, …), `idea` (one-off), or `axis` (unlocks a
  new lever: an RL family, a data kind, an architecture, a feature, a deployment option; may also carry an effect);
- **area** (pretraining / post-training / systems: the science specialty), **needs** (knowledge only);
- **effect**: type (spec §5.2 table), target stack, prior on the effect in OOMs (mean, sd; drawn hidden per world per
  generation), chance the direction works at all in this world (hidden draw as today's paradigm priors), **scale
  behaviour** prior (holds / grows / fades with run FLOP: the effect is multiplied by
  (FLOP_run ÷ FLOP_test)^s with s drawn per idea: s > 0 grows, s < 0 fades; research/20 B2: ≈90% of measured
  progress is scale-dependent, so most big pretraining ideas have s > 0);
- **stages**: ideation (scientist work), small experiments (research-engineer work + experiment FLOP), scale test
  (research-engineer work + a FLOP chunk relative to the lab's latest base, e.g. 1% [D]), adoption (engineers'
  team-weeks into the stack).
Lines carry most of the continuous progress (e.g. *Optimizer & architecture tweaks*, *Data filtering & mixing*,
*RL algorithms*, *Inference efficiency*); ideas and axes carry the structure (*Native multimodal*, *Long context*,
*Neuralese recurrence*, *Computer use*, *Continual learning*, RL-family focus unlocks, …).

**Diminishing returns (lines):** generation n's prior mean μ_n = μ₁·(1 + (n−1)/n₀)^(−β) with β < 1 so the sum
diverges (progress never stops, it gets harder): the AI Futures returns parameter r (research/13 §2.2, r ≈ 1.2) and
research/20 B4 set β and n₀ [fit]. Scale-invariant tweaks within an area combine sub-multiplicatively (research/20 B2:
log effects add with exponent ≈ 0.67) — apply this to the `idea` kind in the same area, not to lines.

### V2.3 Content pass (judgement; write the table into design/TECH-TREE.md as a new "v3 projects" section)

Map every existing capability tree node to a project kind/effect or cut it, with a one-line reason and source:
- **Not research** (remove from the tree; always available or built by engineers as product features): Chat, API,
  Enterprise, Agents product, Coding agent, Voice & vision, Deep research, Sector packs. Features stay buildable, gated
  on the axis idea that makes them possible (computer use, long context + memory, multimodal, orchestration) or on
  nothing.
- **2025 public knowledge → known at start (★)**: quantization, speculative decoding, fault-tolerant training, MoE,
  dense, reasoning RL, agentic environments, test-time compute, distillation (check research/12 §0.7 for what was
  public by Jul 2025).
- **Paradigms (P05–P27)**: each becomes a typed effect with a sourced magnitude (research/20 B2/B3, research/12) or is
  marked as wired in a later phase (keep its current engine effect and note `LATER(Vn)`): P13, P19, P20, P24 → V3
  (AI labour, taste); P05, P07 features → V4; P10, P12, P21 data → V5; P14, P15, P23, P27 → V6; P26, P25 have no
  engine effect today — cut them or give them a real one (state which).
- Every effect in the game must have a unit and a source or a [D] tag; no "+0.8 y".
- Starts (data/v2/starts.ts `known`) keep their meaning.

### V2.4 Lifecycle (engine: `src/engine/v2/models/tree.ts` capability path, or a new `research.ts`)

1. **Ideation**: scientist work on the project produces candidates; each candidate has a hidden true effect (the
   project's draw × a candidate factor) and a **belief** = truth + noise, noise sd falling with the assigned
   scientists' quality (taste) [D, R20 B5]. The team pursues the best candidate by **score = μ + κ·σ** of its belief,
   κ = −0.5 / 0 / +0.5 for the lab-wide **risk policy** safe / balanced / speculative [D]. More ideation work = more
   candidates to pick from.
2. **Small experiments**: work + FLOP; the belief narrows (Bayesian update with experiment noise). If the posterior
   mean drops below a threshold, the candidate is dropped and ideation resumes (the project prior updates) [D].
3. **Scale test**: work + a FLOP chunk; reveals the scale exponent s (narrows its belief); ≈ a quarter of small-scale
   wins survive at scale (research/20 B5) — calibrate the scale prior to that.
4. **Result**: a final estimate band. Effect ≤ ~0 ⇒ **failed**; a failed project can be **reopened as speculative**
   (wider prior, lower mean). Only finished projects can be adopted.
5. **Adoption**: engineers' build (team-weeks ∝ effect size) [D]; then the **true** effect (at the run's FLOP for
   scale-dependent ideas) enters the stack for new runs, part at once and the rest as **headroom** (V2.6). The UI shows
   the believed band before and the realised value once a model trained with it is evaluated.

**Speed (bridge until V3):** labour work progresses at research speed M (the production function, as today) ×
√(capacity of the assigned teams) per stage, as the v2 tree does; FLOP needs are drawn from the research
(experiments) pool by project priority. A stage completes when both its work and its FLOP are done. Note for V3: M's
experiment-compute input then double-counts project FLOP; V3 replaces M with project-level CES on explicit compute and
labour.

### V2.5 Allocation without micromanagement (replaces J2 R2 auto-assign)

- **Scientists**: the player keeps a priority-ranked project list and sets **teams wanted** per project (default 1;
  "max" allowed). Deterministic assignment: go down the list, give each project up to its teams wanted, best specialty
  match first; then one improvement pass of pairwise swaps that raise total specialty fit; leftovers to the
  highest-priority project still under its max. Each team card says why it is where it is. Must be within 5% of the
  brute-force optimum of total progress on small cases (test it: ≤ 5 teams, ≤ 4 projects).
- **Research engineers** (capabilities): needs in priority order: run operations → project experiments (by project
  priority) → routine tuning → (evals in V5). The player sets a share or team count per need and the order; spare
  capacity flows down the list (R5). The production function's h counts research engineers on experiments + tuning
  (keep the reference allocation so h is unchanged at reference) `// BRIDGE(V3)`.
- **Engineers**: extend the existing build queue/upkeep (J2 P1) with the same "needs + priority + overflow" control:
  run setups, product upkeep, builds (features, adoptions), internal tools.
- Research compute: one experiments pool; stages take FLOP by project priority; leftover → routine tuning → synthetic
  data (R5).

### V2.6 Routine tuning (headroom)

An adopted idea delivers (1 − h) of its effect at once; h [D ≈ 0.3] is headroom that research engineers on tuning
close at a rate ∝ their capacity × M × remaining headroom [D]. Headroom refills only by adopting ideas.

### V2.7 Remove the know-how bridge

- e_stack replaces B·(pa − pa₀) everywhere (runs, continual stream, Blueprint).
- `player.pa` stays only as a read-only readout `// BRIDGE(V3)` = (sum of stack efficiencies over the start) ÷ B, so
  remaining readers (safety tiers, theft and leak amounts, rivals' diffusion, limits view) keep working; writers become
  stack changes: knowledge diffusion from a leader adds to the stacks (public ideas, no headroom); "tacit knowledge" and
  "safety spillover" bumps add small stack amounts; theft of know-how gives rivals pa from the player's stack lead ÷ B.
- The Blueprint's "behind at finish" becomes: ideas adopted while the run trains (count and OOM).

### V2.8 Calibration

- Golden dates within the existing tolerances on all presets (refit CAL_SHIFT/LEADER_CAL allowed; report before →
  after). Fit μ₁, β, n₀ and stage efforts so the reference bot's total stack growth tracks V1's bridge path (B·pa).
- Check: before SC, the reference lab's pretraining stack grows ≈ 0.48 OOM/yr (Ho et al. ~3×/yr, ±30%)
  [R20 B1]; total stacks ≈ the all-in rate.
- Report the bot table (40 seeds); not required to pass in V2.

### V2.9 Tests (`scripts/v2/research.ts`, add to `test:v2`)

Lifecycle order; only finished projects adoptable; risk policy changes the pursued candidate; better taste lowers
belief error; failed → reopen as speculative; line priors decline but their sum diverges; assignment determinism,
specialty optimality within 5% of brute force; overflow of research engineers and engineers; a stage without FLOP
waits; headroom closes with tuning and refills on adoption; e_stack never read from pa (lint).

### V2 notes (V2a: engine, content, calibration, tests; 2026-11-19)

Design values ([D]) and deviations, each with its reason. Code: `src/engine/v2/models/research.ts` (lifecycle,
assignment, research engineers), `models/stacks.ts` (stacks, headroom, the pa readout), data `src/data/v2/research.ts`,
content `src/data/v2/tree.ts` (table: design/TECH-TREE.md §6). Tests: `scripts/v2/research.ts` (in `test:v2`).

**Content (TECH-TREE §6)**
- Cut: Chat, API, Enterprise, Agents product, Coding agent, Deep research, Voice & vision, Sector packs (features gated
  on Native multimodal / Multi-agent orchestration / nothing), and P26 (no engine effect; its hidden draw kept so the
  other paradigm draws keep their values). *Auditing agents* now needs *Agentic environments* ★.
- ★ added: Quantization, Speculative decoding, Fault-tolerant training, Overtrained compact (all public by 2025; no
  effect beyond the reference: their old multipliers would have moved every lab's serving cost and goodput).
- Typed now: P09, P11, P22 (domain OOM for new versions; P11/P22 converted from v2 levels at 1.2 L per OOM), P16
  (training throughput +0.06 OOM, serving −0.125 OOM), P25 (**real effect**: weight-security defence +0.5 level),
  new idea *Elastic training* (goodput 0.90 → 0.95 as +0.023 OOM throughput). LATER as briefed: P13, P19, P20, P24 (V3);
  P05, P07 (V4); P10, P12, P21 (V5); P14, P15, P23, P27 (V6). Unchanged axes: P06, P08, P17, P18, RL focus.
- Lines: Scaling recipes, Data filtering & mixing, Optimizer & architecture tweaks (pre); RL algorithms (RL
  efficiency), Environments & rewards (RL ceiling); Inference efficiency (serving); Recurrent architectures (pre, needs
  P17: the fresh-pool example).

**Stacks (V2.1)**
- Five parts in three stacks: pre (OOM, scale-dependent), RL efficiency (midpoint) and RL ceiling (OOM added to A),
  training throughput (capped at MFU 0.75 × goodput 0.97) and serving. **Deviation:** the RL stack has a ceiling part.
  The brief's pretraining check (≈ 0.48 OOM/yr) is about 55% of the v2 know-how rate before SC; RL efficiency alone
  saturates the V1 RL curve within ~1 OOM, so without a ceiling part the RL stack could not carry the rest. Suite
  fidelity "scales A_f" in MODEL-V3 §4.3, so *Environments & rewards* raising A is in the spec's spirit (V5 makes
  suites assets).
- Scale buckets: adopted ideas are kept as Σ x·10^(−s·log₁₀F_test) per s (grid 0.02), so a stack is a function of the
  run's FLOP and the state stays small in a takeoff (hundreds of thousands of ideas). The last 30 adopted ideas are kept
  for the readout (`research.adopted`: believed band and realised value).
- Start: the leader 0 in every part; a follower −B·k in pre and RL efficiency (k = V1's solved know-how lag). B0/V0 keep
  their V1 vintages through `startVintage` (start solution only).
- Public knowledge (diffusion, C4 tacit knowledge, safety spillover) enters the pre stack base (B OOM per v2 year, no
  headroom): `addKnowledge`.

**Projects and lifecycle (V2.2, V2.4)**
- Nothing hidden is stored: a candidate's true effect and scale exponent are recomputed from hash draws (world seed,
  project, attempt, candidate number), so saves hold only beliefs. Paradigm "works" keeps the hidden paradigm draw
  (first attempt) and v2's `node:id:attempt` hashes (reopenings).
- Candidates: novelty ν ∈ [0, 1] (visible): truth mean × (0.75 + 0.5ν) × taste, spread × (0.15 + 0.6ν) [D]. Taste q
  (capacity-weighted team quality): mean × (1 + 0.5(q − 1)), belief noise ÷ q² [D]. The risk policy's κ only changes
  picks because novel candidates are both bigger and less certain.
- Small experiments run at 1/1000 of the scale test; a candidate's small-scale effect x becomes x·1000^s at test
  scale; the scale test is 0.2% (lines) or 1% (ideas) of the latest base [D]. *Optimizer & tweaks* s ~ N(−0.25, 0.2)
  gives 23% survival (test: 25% ± 10%). s is clamped to [−0.6, 0.25] [D]: an unclamped tail made single candidates worth
  tens of OOM once batched.
- Pick at 2 candidates; pool ≤ 4 (then better finds replace the weakest) [D]. Drop below 30% of the prior mean; ideas
  fail after 3 drops; a failed project reopens as speculative (odds × 0.5, mean × 0.7, spread × 1.5) [D]. Lines never
  fail; a result queues its adoption and the line moves on (pipelining).
- **Batching** [D, performance]: above pace 30 a line candidate carries b = ⌊pace/30⌋ ideas (work, FLOP, effect × b,
  noise × √b); at the scale test a batch keeps its survivors analytically (E[1000^s; s ≥ s*], survivors' mean s).
  Work left over when a stage ends carries into the next the same day (without it the takeoff lost ~30% to day
  rounding).
- **Speed (BRIDGE(V3)): research pace = the production function's rate ÷ the world's software share**, not M: equal to
  M before SC (2029 laborSlowdown aside) and M ÷ share after it, because the v2 know-how path grew at the rate (stage 1
  share·M, stage 2 M); with M alone the stacks would grow half as fast after SC.
- **Capacities are normalised by the reference headcount path** (H_ref at the start ÷ H_ref today; BRIDGE(V3)): M
  already counts labour relative to H_ref; absolute √capacity let a reference lab's stacks grow with its headcount and
  ran the 13-year slow preset's SC 5 years early.
- **Project FLOP ÷ pace** (BRIDGE(V3)): the pace already contains experiment compute through its CES; at a fixed share
  per idea, FLOP bound the reference lab's takeoff a second time (the double count the brief notes for V3).
- Diminishing returns: μ_n = μ₁(1 + (n − 1)/1000)^(−0.03), n counting ideas. **The fit drives β to ~0**: research/13
  §2.5 says the reference speed already contains "ideas get harder", and any β that matters over 10⁴–10⁵ ideas slows the
  long takeoffs past tolerance. β > 0 keeps the brief's shape (decline, divergent sum); √capacity carries the
  spreading incentive.
- Adoption: engineers, 0.5 + 2 TW per OOM (unlocks 1, max 8) [D]. **Deviation:** adoptions are worked in the engineers'
  *runs* need (after run setups), not *builds*: they are training code (MODEL-V3 §3.3 novel run code), and with
  product upkeep first the slow preset's reference lab never adopted anything for six years (upkeep > capacity, no
  mechanical penalty for unserved upkeep, so nothing else ever got built).
- Headroom 30%, closed at 1/270 × pace × tuning team-equivalents per day [D].

**Allocation (V2.5)**
- Scientists: priority list + teams wanted (default 1, "max" = 6), best specialty then capacity first, one pass of
  pairwise swaps on Σ√capacity ÷ ideation effort, leftovers to the top project under 6; manual placements stay; a
  `why` per team. Test: within 5% of brute force over the same per-project counts (worst 96%). Capability teams are
  always placed by it; the old auto-assign flag now only drives safety teams (safety path unchanged).
- Research engineers: needs ops → experiments → tuning; ops = 1 per base run, 0.5 per post/continue and the stream, 0.2
  per distill/IDA [D, mirrors engineer upkeep]; experiments up to 2 team-equivalents per project in priority order;
  default cap: experiments ≤ 75% so tuning always has some [D]. Caps per need as a team count or a share; order is the
  player's (`research.reAlloc`). h counts experiments + tuning ÷ 0.88 (BRIDGE(V3)).
- Engineers: the same order/caps control on runs / upkeep / builds (`build.engAlloc`). "Internal tools" has no content
  yet (not built).
- RefBot: its paradigm goals at the top (reopened after 180 days, v2's retry pacing), then five lines (not Inference
  efficiency: serving is V4's calibration; not Recurrent architectures: v2's path had only P17's +0.5 OOM), three
  teams on each paradigm project and the rest on the lines by weight (0.25 scaling, 0.3 environments, 0.15 data, 0.1
  tweaks, 0.2 RL algorithms); RL-algorithm teams move off once the reference RL run is at 95% of its ceiling (beyond
  that RL efficiency buys no G; keeping them there cost the long takeoffs ~20% of their research). A fixed 70% line
  share was tried (it evened the fitted μ₁ across ai2027 / fast / authors2026 to 0.60–0.64) but moved the ai2027
  takeoff out of tolerance; reverted.

**Calibration (V2.8; table in PROGRESS.md V2a)**
- Fit order: paradigm efforts to V1's attempt durations (`--fit-tree ai2027`), LINE_FIT.mu to V1's know-how path
  (`--fit-lines`: log-ratio of the stacks' G-equivalent to B·(pa − pa₀) from the first base to SC), then CAL_SHIFT and
  LEADER_CAL. μ₁ = 0.58 (ai2027's bridge fit was 0.54–0.60 over the RefBot variants tried; 0.58 is the value that keeps
  ai2027 and fast within tolerance after the CAL_SHIFT refit).
- Pretraining stack (ai2027 RefBot): 0.43 OOM/yr in the first year (Ho et al. 0.48 ± 30%), 0.67 OOM/yr start → SC
  (the 2027 AI speed-up included). The check window is the first year (research pace 1.3–1.6, before automation).
- **Stop condition (reported, not forced):** authors2026's late milestones (SAR −0.13, SIAR −0.12, ASI +0.38 y) and slow's
  CAL_SHIFT (0.291 → −1.5) after refit. ai2027 and fast are within tolerance; the leader lab (T1L) is within tolerance
  on every preset. The mismatch is a shape difference, not a level: the v2 path's research rate had no pipeline, no
  per-project structure and no team split; V3's project-level CES is where to rebuild it.

### V2b UI (second run)

Research panel: project cards with stage track (ideation → small → scale → result), belief band, odds, FLOP and work
per stage, teams; priority list (drag) and teams wanted; risk-policy toggle; per-stack recipe readout (adopted ideas,
realised vs believed, headroom); research-engineer and engineer allocation panel with priority order and overflow;
Blueprint/run cards read the stacks. good-ui skill; glossary and tooltips for every new term; `npm run test:ui`.

---

## V3–V7

Detailed when each starts (spec §16): V3 work types and AI labour (removes the pm bridge from production and
milestones; project-level CES replaces M), V4 serving and products (owns worldfx GOV T1 and W2 from V1), V5 data
assets, environment suites and evals, V6 safety, V7 rivals and China (owns ws4 T3 lead band and theft lag from V1),
bots, UI pass, jank audit.
