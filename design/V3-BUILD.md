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
| `pm` of a version / base | V1 | Φ(G): the old progress coordinate computed from effective compute, so the production function, milestone thresholds, M-based readouts, rivals and safety keep working | V3 for the player's research and milestones (done: departments/workfit.ts); still the display level λ(G) = levelOf(Φ(G)), V6 (safety M), V7 (rivals) |
| `e_stack` from know-how `pa` | V1 | stack efficiency (OOMs) = E_PER_PA × (pa − pa₀) until ideas exist | V2 |
| `serveCost` (0.5 = reference) | V1 | relative serving cost from FLOP per token, so revenue and agents keep working | V4 (done in V4a: costs read `ModelVersion.fpt`; serveCost stays a design readout; the safety fleet's copies keep it, BRIDGE(V6)) |
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

### V2 decision (2026-11-19, lead session)

V2a accepted with its calibration misses (authors2026 SAR/SIAR/ASI, slow's CAL_SHIFT −1.5): both trace to the M-based
research-pace bridges, which V3 removes. **V2b (UI) moves after V3** so the research panel is built once for the V3
mechanics (project compute and labour, AI labour per work type).

---

## V3 Work types, AI labour, research speed, milestones

Goal: the lab-level production function M and the AI 2027 knot tables stop driving anything. Research speed comes
from each project's **explicit compute and labour** (the AI Futures CES at project level); labour is humans plus
**AI labour per work type**, from the deployed model's fit, horizon and cost per copy; milestones are statements about
work types. Spec §5.3–5.4, §6, §8, §13. Removes every BRIDGE(V3). Sectors stay as today (V4 moves them onto work
types); safety research lines stay (V6); rivals stay on pm (V7).

### V3.1 Work types (new `src/data/v2/workTypes.ts`)

Internal work types: **SWE** (engineers: software), **EXP** (research engineers: experiments, runs, tuning),
**IDEAS** (scientists: ideation and taste), **SAF_EXP**, **SAF_IDEAS** (safety; consumed in V6, defined now). Fields:
domain weights (SWE: CODE, AGENCY; EXP: CODE, RSCH, AGENCY; IDEAS: RSCH, REASON), typical task length H_w (hours),
verifiability v_w, the horizon domain(s), and two human reference levels per work type: **median expert** and **best
in the world** (on the level scale) [fit, below]. Sources: research/20 §E, research/19, research/13 §2.4.

### V3.2 Model fit, horizon, coverage, assist (new `src/engine/v2/departments/workfit.ts`)

- Fit level L_w = Σ ω_w,d L_d of the deployment's version (effort from the internal package).
- **Horizon rebased on G**: h50 = h50(V0) × 4.2^(G_h − G_V0) (METR ≈ ×4.2 per OOM, research/20 A2/E1), G_h = the
  version's G in the work type's horizon domain (AGENCY; CODE for SWE), anchored to METR TH1.1 for Aug 2025 (use
  TH1.1 values consistently, research/20 §H). h80 = h50/5. Replaces the v1 horizon curve on pm (h80Of). Computer-use
  work is shorter-horizon (research/20 E3) through its domain weights.
- **Coverage** a_w = σ((L_w − θ_w)/s_w) × P(success at H_w from h80); θ_w is higher for low verifiability [fit].
- **Assist** (rest of the work): GDPval speed-up H/(M + R + (1 − w)·H), R ≈ 0.27·H, w from the fit gap (research/20
  E2); assisting only above w ≈ 0.3.

### V3.3 AI labour

- **Copies** = the internal package's compute × FLOP/s per H100e × inference utilisation ÷ (FLOP per token × tokens per
  work-hour of w) — physical: FLOP per token = 2·N_active (V1), utilisation and tokens per work-hour from research/20
  D1–D2 (agentic coding ≈ 10–30M tokens per day, mostly cache reads; state your per-hour choice and check it against
  research/13 §1.9's AI 2027 copy counts at SC as a sanity check, not a fit target).
- **Serial speed** from tokens/s per copy vs a human's work rate (cap as research/13 R11 #23).
- **Effective labour** in w = the AI Futures coding CES of human labour and AI labour (today's `Lrel` with ρ_c from the
  preset) with automation share a_w from V3.2 instead of the knot table A(q), and AI labour from copies instead of
  R(q)·k. Parallel penalty λ as AI Futures (research/13).
- Internal packages (R7 engineering / routine research / frontier research / safety) map to SWE / EXP / IDEAS /
  SAF_*; their compute shares stay the player's control.
- **Engineers' build capacity** = effective SWE labour (replaces aEngOf and BUILD_AI_CAP; keep a visible review
  overhead if you need a cap, sourced or [D] and shown).

### V3.4 Research speed per project (replaces M, the pace bridge, and the headcount normalisation)

- **Ideation** rate = (effective IDEAS labour on the project)^λ × taste ÷ ideation effort.
- **Experiments and scale tests** rate = X(c, ℓ) ÷ stage effort, X = [u·c^(ζρ) + v·ℓ^ρ]^(1/ρ) (the AI Futures
  experiment CES, research/13 §1.3, parameters per preset as today), c = the project's experiment FLOP per day and
  ℓ = (effective EXP labour on it)^λ, both in **fixed physical units** (the leader lab's day-0 inputs = 1; never the
  calendar or a reference path). Project FLOP is real (no ÷ pace). Routine tuning uses the same X on the tuning
  allocation.
- **Taste**: human scientists' taste from team quality on the AI Futures taste distribution (research/13 §2.4, m2b);
  AI taste from the IDEAS fit level mapped onto the same distribution (median expert ↔ 0 SD, best in the world ↔ the
  distribution's top). Taste raises candidate means and lowers belief noise (V2's q becomes this taste).
- **Diminishing returns from r** (move "ideas get harder" out of M into the pools): with AI Futures' returns r
  (doublings of software efficiency per doubling of cumulative research input, research/13 §2.2), constant-cost ideas
  give μ_n ≈ r·log₁₀2 / log₂-step … i.e. a line's n-th idea is worth ≈ r / ((n₀ + n)·ln 10) OOM (harmonic: the sum
  diverges as log n); n₀ = ideas before the game start, set from the start rate. Derive the exact form, check it
  reproduces r on a constant-input lab, and use it for every line (replacing V2a's β ≈ 0.03 fit).
- **M becomes a readout**: research speed of the lab vs the same lab with no AI labour (for the UI and for the safety
  and revenue bridges still reading M — keep their inputs equivalent, `// BRIDGE(V4/V6)`).

### V3.5 Milestones from work types (replaces the pm thresholds and CAL_SHIFT for the player)

As AI 2027 defines them (research/13 §2.8, R11):
- **Superhuman coder**: SWE coverage ≥ 0.9 [D] and SWE fit ≥ the best human in the world, at a cost per work-hour
  below the lab's best engineers.
- **Superhuman AI researcher**: the same for EXP and IDEAS.
- **Superintelligent AI researcher**: IDEAS fit beyond the best human by 2× the best-to-median gap.
- **Superintelligence**: that gap on every cognitive work type.
Per-preset calibration parameter: the **effective compute needed for a superhuman coder** (G_SC: the AI Futures
timelines model's own uncertain parameter) sets the human reference levels' position on the G axis; together with the
preset's AI Futures parameters (CES, r, taste) it replaces CAL_SHIFT. Fit G_SC (and at most one more per-preset value,
named and justified) so the reference bot hits the golden dates. The level mapping for display stays λ(G) =
levelOf(Φ(G)) (keep Φ so rivals, still on pm until V7, stay comparable); milestones no longer read it.

### V3.6 Remove

For the player and their labour/research: knotAt / A(q) / R(q) / Tref, multiplierAt in production, laborSlowdown,
referenceTech, hRef / refTotal / shareRefAt normalisations, CAL_SHIFT-based milestones, the V2a BRIDGE(V3) items (pace
= rate ÷ share, capacities ÷ H_ref path, project FLOP ÷ pace, h counting), aEngOf. Lint (`scripts/v2/lint-structure.ts`
or a new lint): no player mechanism reads `frontierFlop`, `hRef`, `refTotal`, `shareRefAt`, `knotAt`, `multiplierAt`,
`CAL_SHIFT` (allowed: calibration harness, rivals/China/leader-lab code, `// BRIDGE(V4|V6|V7)` lines).

### V3.7 Calibration and tests

- Golden dates for all four presets within the existing tolerances (SC ±0.08 y, later ±0.12 y) via V3.5's per-preset
  parameters; leader lab T1L within tolerance (LEADER_CAL refit allowed). Report before → after.
- Checks: pretraining stack ≈ 0.48 OOM/yr before automation (±30%); METR h50 doubling ≈ 4.2 months for the reference
  frontier 2025–26 (±1 month); research speed readout ≈ 1 at start for the leader.
- Tests (new `scripts/v2/worktypes.ts` in `test:v2`): coverage monotone in fit and horizon; copies ∝ compute ÷ FLOP
  per token; effective labour = humans when coverage 0; a lab with constant inputs reproduces r; doubling project FLOP
  speeds a compute-bound experiment and not a labour-bound one (and vice versa); milestones fire in order SC → SAR →
  SIAR → ASI; a fixed lab's research speed does not change with the calendar (the v2 bug, now for research); the lint.
- Performance: the daily tick must not get slower than the V2a worktree baseline (hygiene perf: aim to get back under
  its 1.5 ms budget; report).
- Bots (40 seeds): report; criteria aimed for in V3 (this phase changes balance most), not required if a criterion
  conflicts with the calibration.

Record choices in "V3 notes", add a V3 row to PROGRESS.md with the calibration table; schemaRev bump.

### V3 notes (2026-11-19)

Code: `src/data/v2/workTypes.ts` (work types, AI-labour constants, per-preset calibration), `src/engine/v2/departments/
workfit.ts` (fit, horizon, coverage, assist, copies, effective labour, taste, milestones, the research-speed readout),
`models/research.ts` (project CES, pools), `models/stacks.ts` (tuning). Tests `scripts/v2/worktypes.ts`.

**Derivation 1: diminishing returns from r (V3.4), written before coding.**
AI Futures (research/13 §2.1, §2.5): software efficiency SE = r·log₁₀(RS/RS₀) with dRS/dt = RE (research effort). In the
game each line l is a pool. Its state is R_l = n₀,l + (research input of the results it has produced so far), in units of
one reference idea (one idea found by a reference-taste team; an idea's input is q = its team's taste T, and a batch of
b ideas has input b·q). Give the result that brings input q to a pool at state R the prior mean

  μ(R, q) = r_l · log₁₀((R + q) / R)      (OOM of the line's stack).

The sum over successive results telescopes exactly: Σ μ = r_l·log₁₀(R_end / n₀,l), so the line's stack is r_l·log₁₀ of its
cumulative research input, and doubling that input adds r_l·log₁₀2 OOM whatever the history (the constant-input check). For
q ≪ R, μ ≈ r_l·q / (R·ln 10): the brief's harmonic r/((n₀ + n)·ln 10) with n counted in reference ideas, so the sum
diverges as log n (progress never stops, it gets harder) and taste enters as more research input per idea (AIFM: RE =
taste × experiment capacity accumulates into RS). Lab level: r_l = w_l·r with Σ w_l = 1 over the lines that carry G (the
line's share of the lab's start software progress), so a lab that grows every line's input together has SE_total =
r·log₁₀(RS/RS₀), AIFM's law. n₀ comes from the start rate: the first idea's mean μ₁,l (the start effect per idea, fitted to
Ho et al.'s ≈ 0.48 OOM/yr pretraining rate at the leader's day-0 inputs) gives n₀,l = 1/(10^(μ₁,l/r_l) − 1) ≈ r_l/(μ₁,l·ln 10).
Check: the pool age n₀/I_l (I_l = the line's start ideas per year) = w_l·r/(rate_l·ln 10) ≈ r/(S₀·ln 10) when w_l is the
line's start share of the software rate S₀; at r 3.2 and S₀ ≈ 1 OOM/yr that is 1.4 years of start effort, AIFM's
RS/RE ≈ 1/0.72 yr (research/13 §2.5). Ideas and axes (one-off projects) keep their own priors (no pool). r per preset is the
preset's AI Futures value (below), not fitted.
*Correction found while building (the first takeoff probe):* advancing the pool by the research input q telescopes the
PRIOR, but the lab pursues the best of its candidates and keeps only those that survive the scale test, so realised effects
ran 2.2× the prior before SC and 3.3× in the takeoff. That multiplied the effective r and turned authors2026's taste-only
phase (r·log₁₀ m2b/Δ_bm < 1) into an accelerating one. The pool's state therefore follows what the line delivers: a result
with true effect x (OOM at its test scale) moves R ← R·10^(x/r_l). The realised stack is then exactly r_l·log₁₀(R/n₀); the
expected step is R → R + f·q (f the selection factor), so against cumulative research input Q the stack is
r_l·log₁₀(1 + f·Q/n₀) and each doubling of Q adds r_l·log₁₀2 once f·Q ≫ n₀ (the constant-input check, now on the realised
stack). Selection only changes how fast a pool ages (the effective n₀ is n₀/f), not the returns; the prior a candidate
shows stays r_l·log₁₀((R + q)/R).

**Derivation 2: milestones from work types (V3.5), written before coding.**
Fit F_w of a version in work type w is measured in effective compute (OOM): F_w = Σ_d ω_w,d · G_d + offsets, G_d the
version's domain effective compute (MODEL-V3 §2.3; = G for the reference recipe, so only training choices specialise) plus
its level offsets converted at LEVEL_PER_OOM (1.2 L per OOM, V2's conversion) and, with Learned research taste (P19),
+0.42 OOM on RSCH (the size of v2's RSCH −0.5 L penalty; the reference points are set for a lab without P19).
Deviation from "fit level L_w = Σ ω L_d": L_d = λ(G_d) reads the display bridge levelOf(Φ(G)), whose thresholds move with
CAL_SHIFT; measuring fit in G keeps the player's milestones off the bridge (they never read pm). The UI can show λ(F_w).
Human reference points are per domain, on the same axis: the best human in the world at G*_d = G_SC + δ_d and the median
expert at G*_d − Δ_bm, so a work type's reference points are F*_w = Σ ω·G*_d and F*_w − Δ_bm. AI research taste in human
SDs is sd_AI = 3.09·(F_IDEAS − F^med_IDEAS)/Δ_bm (median 0 SD, best in the world 3.09 SD = AIFM's top researcher). Then, as
AI 2027 and AIFM define them (research/13 §2.4, §2.8):
- Superhuman coder (SC): SWE fit ≥ F*_SWE, SWE coverage ≥ 0.9, AI cost per work-hour below the lab's best engineers'.
  δ_CODE = δ_AGENCY = 0, so F*_SWE = G_SC: G_SC is the effective compute a superhuman coder needs (the timelines model's
  own parameter).
- Superhuman AI researcher (SAR): the same for EXP and IDEAS. δ_RSCH = δ_REASON = (1 − sd_SC/3.09)·Δ_bm with sd_SC = 0.5 SD,
  AIFM's AI taste at the automated coder (research/13 §2.2), so the reference model's taste at SC is 0.5 SD and SAR is
  IDEAS at 3.09 SD. EXP (CODE, RSCH, AGENCY) reaches its best human in between.
- Superintelligent AI researcher (SIAR): IDEAS fit ≥ F*_IDEAS + 2Δ_bm, i.e. 3 × 3.09 = 9.27 SD, AIFM's SIAR exactly.
- Superintelligence (ASI): every cognitive work type ≥ its best human + 2Δ_bm. The five internal work types share the
  research domains, so ASI needs the work AI is worst at: an "other expert work" type (SOCIAL, MEDIA, BIO,
  CYBER; defined now as the V4 sector placeholder) whose domains' best humans sit δ_O above the research domains. δ_O =
  1.7·Δ_bm from AI 2027's own taste at ASI (14.5 SD vs SIAR's 9.6 SD, research/13 §1.5; AIFM ASI 12–15 SD).
Milestones fire in order (a later one is recorded no earlier than the one before). Agent / Reliable agent / Research agent
(informational) are SWE coverage 0.1, SWE coverage 0.5, EXP coverage 0.5 [D].
Per preset: G_SC and Δ_bm (AIFM's "AI research taste slope": 3.09/Δ_bm SD per OOM; range 0.8–6.6 SD per progress-year)
are fitted; r, La, ρc, λ, m2b come from the preset's sources. Δ_bm also sets the takeoff's shape: with taste ∝
m2b^(sd/3.09) and SE = r·log₁₀ RS, the AIFM condition for an accelerating takeoff is r·log₁₀(m2b)/Δ_bm > 1.

**Choices and deviations (V3.1–V3.6)**
- Work types (`data/v2/workTypes.ts`) [D]: SWE (CODE 0.7, AGENCY 0.3; 2 h; v 0.9), EXP (CODE 0.4, RSCH 0.4, AGENCY 0.2;
  8 h; v 0.7), IDEAS (RSCH 0.7, REASON 0.3; 40 h; v 0.3), SAF_EXP (CODE, RSCH; 8 h; v 0.5), SAF_IDEAS (as IDEAS; 80 h;
  v 0.2) and OTHER ("other expert work": SOCIAL, BIO, CYBER, MEDIA; 8 h; v 0.4) as the V4 sector placeholder ASI needs.
- Horizon: h50 = 203 min (METR TH1.1, GPT-5, Aug 2025 = V0) × 4.2^(G_d − G_V0) on CODE (software) or AGENCY, × the
  version's horizon multiplier (P07, P12, long-horizon RL focus, kept). R20 E3's 10^(−2(0.9 − v)) domain factor is not
  used: the brief puts computer-use's shorter horizons in the domain weights, and verifiability in θ_w.
- Coverage a_w = σ((F − θ)/0.8) × p(H_w), θ_w = F*_w − 0.8·ln 19 + 0.5·(0.9 − v_w) [D]: 0.95 of the logistic at the best
  human's fit for verifiable work; the 2025 frontier's SWE coverage ≈ 0.15–0.2 (Anthropic "fully delegable 0–20%", AIFM
  2025.0 A = 0.10).
- Win rate w = Φ((F − F^med)/3 OOM) (GDPval Aug 2025 ≈ 0.35) and assist 1/(1/90 + 0.27 + 1 − w) ≥ 1 on the human share.
- AI labour (physical): FLOP per token = 2·N_active × shape token multiplier × serving efficiency vs its base; per human
  work-hour of agentic work 200k uncached input tokens at prefill utilisation 0.35 and 40k output at decode 0.07 (R20 D1,
  D2: cache reads are bandwidth, not FLOP) → ≈ 0.63 H100e-hours per work-hour for a 1T-active model; FTE on a 2,000-hour
  year; copies = work-hours per hour ÷ serial speed (60 tokens/s per copy ⇒ 5.4×, cap 50). P05 ×1.3, P20 ×(1 + 0.1·payoff)
  and the AG07 control tax ×0.95 multiply AI FTE. Sanity check vs AI 2027 at SC in T2 (informational).
- Effective labour: AI Futures coding CES (ρc, λ from the preset) of human team-equivalents × assist and AI team-
  equivalents at coverage a_w; its ratio to the humans, m_w, multiplies every allocation of that role (agents add capacity
  to the same allocations, MODEL-V3 §5.6). Research engineers' run operations need ÷ m_EXP. RE_PER_PROJECT stays 2 human
  team-equivalents.
- Research in fixed physical units: a unit project = RE_UNIT (2) research-engineer team-equivalents and C_UNIT
  = 3.6e23 FLOP/day (the leader's day-0 experiment FLOP per 2 of its research teams); X(c, ℓ) of the preset's CES, rate
  √2/30 team-months a day at X = 1 (V2a's pace-1 rate, so stage efforts keep their V2a values). Experiment FLOP (pool +
  idle training, × training-throughput stack × P13) is shared by the projects in experiments and tuning in proportion to
  their research engineers and consumed while they run: no FLOP need per stage, no ÷ pace. Without FLOP, X = 0 (ρ < 0).
  Tuning closes headroom at TUNE_K × its team-equivalents × X. Lines batch b = ⌊X/30⌋ ideas.
- Ideation: (m_IDEAS × capacity)^λ × taste ÷ effort (as briefed). Taste: each team's E[max(T_team, F_AI)] on the AIFM
  lognormal (m2b of the preset), team quality at −0.5 / 0 / +1 SD (Solid / Strong / Elite) [D], stars ×1.05 each, AI
  taste from the frontier-research model's IDEAS fit, weighted by its cover (frontier share ÷ the 15% default, max 1). For
  lines taste is research input per idea (it raises the prior through the pool); for one-off ideas a lift
  1 + 0.5·(1 − 1/T) (×1.5 at most); belief noise ÷ T (V2a ÷ q²; AI taste reaches 30–200).
- Returns: lines are pools (derivation 1, with the realised-effect correction); r_l = rShare × r with rShare [D] L.scale
  0.22, L.data 0.13, L.opt 0.13, L.env 0.35, L.rlalg 0.17 (sum 1, the G-carrying lines' start shares), L.latent 0.22 (a
  fresh pool), L.infer 0.15 (serving). LINE_FIT.mu 0.58 → 0.69 (`--fit-lines`: the pretraining stack 0.48 OOM in the first
  year, Ho et al.; the V1-bridge target and V2a's β fit are gone). r per preset from sources: ai2027 4 and fast 4 (AI 2027
  takeoff median), authors2026 3.19 (AIFM golden), slow 1.2 (Forethought central).
- Readout M = research speed ÷ the same lab with humans only (X(c̄, m_EXP^λ)/X(c̄, 1) × taste with AI ÷ without ×
  siloing/migration), AIFM's AI R&D multiplier; `rate` (BRIDGE(V7), the lead readers) = the stacks' G-equivalent growth
  (14-day average) ÷ B; stage 2 after the player's SC; what-ifs, ceilings and elasticities from the same function. Inputs h,
  k, c are in leader-day-0 units (not a reference path); the UI keeps its shapes.
- The auto research mix maximises a unit project's X: before SC the AI multiplier saturates on very little agent compute
  (the human share binds), so the reference lab puts ≈ 99% of its research compute on experiments (agents ≈ 0.1% of
  compute in 2025–26, up to ≈ 12% after SAR).
- Milestones: any live version meeting the work-type statement counts; recorded in order. Cost criterion: AI $/work-hour
  (H100e-hours per work-hour × the market rental) < Elite engineers' pay ÷ 2,000 h (never binding in the presets).
- P19 (LATER(V3) → wired): +0.42 OOM RSCH for work fit (the old −0.5 L penalty's size); the reference points are for a
  lab without it, and the display level keeps v2's penalty until P19. In seed 2027 P19 fails in every preset, so the
  calibration is at the no-P19 profile. P13 multiplies experiment FLOP, P20 and P05 AI FTE, P24 still reads wH.
- Build capacity = max(human team-equivalents, effective SWE labour), no cap; product and monitor upkeep × 0.4 [D] (J2
  tuned them to v2's ×4.7 AI speed-up from AI 2027's automation knots; at physical 2025 coverage the start lab's upkeep
  alone was twice its capacity). Run setup and operations engineering scale with √(FLOP ÷ 1e27) (physical; v2: FLOP ÷
  F(t)); licensed-data cash ∝ √(FLOP ÷ 1e27). TrainingRun.scale stays only for S5 and scrutiny (BRIDGE(V6,V7)).
- Readouts that read F(t) now read the lab's own next base (3 × the latest base): next-model gate, data adequacy.
- Safety agent fleet: AI FTE per H100e × SAF_EXP coverage (BRIDGE(V6)). Safety's M (versionM), revenue's M^0.3 and the
  limits view's revenue cap keep the pm bridge (BRIDGE(V4/V6)); rivals, China and the leader lab keep knots, CAL_SHIFT,
  simpleCredit and LEADER_CAL unchanged (BRIDGE(V7)), so T1L, T3 and T4 are as in V2a.
- Removed for the player: knotAt / A(q) / R(q) / Tref, multiplierAt and laborSlowdown in production, referenceTech and
  REF_TECH, the h/hRef/refTotal/shareRefAt normalisations, researchPace, headcountNorm, researchHeads,
  REF_RE_RESEARCH_SHARE, project FLOP ÷ pace, LINE_DECAY, aEngOf, BUILD_AI_CAP, SCI_AI_CAP, the reference-headcount term
  of τ_h, CAL_SHIFT-based milestones. Lint: scripts/v2/worktypes.ts (forbidden identifiers outside the harness, rivals,
  split presets and BRIDGE(V4|V6|V7) lines; the work-type layer never reads pm or the level bridge).

**Calibration (V3.7; table in PROGRESS.md V3)**
- Fit order: LINE_FIT.mu to Ho et al. (`--fit-lines`), then per preset `--fit-v3`: for each Δ_bm on a grid and a
  golden-section refinement, G_SC by bisection on the golden SC day; the pair with the smallest worst |Δ|/tolerance over
  SC … ASI. slow fits G_SC only (its golden has SC alone; Δ_bm kept at 1.6).
- Results (RefBot, stub, seed 2027, Δ in years): ai2027 G_SC 31.394, Δ_bm 1.933: SC 0.000, SAR −0.052, SIAR −0.041,
  ASI +0.016. fast 32.663 / 0.347: −0.003, +0.096, +0.008, −0.066. slow 35.505: SC −0.074. authors2026 33.5 / 3.142:
  SC 0.000, SAR +0.551, SIAR +0.005, ASI −0.378 (**out of tolerance, stop condition**). T1L unchanged (rivals still on
  pm). The fitted Δ_bm correspond to AIFM taste slopes of 1.6 (ai2027), 8.9 (fast), 1.0 (authors2026) SD per OOM.
- Checks: pretraining stack 0.47 OOM/yr in the first year (ai2027; authors2026 0.41, fast 0.41, slow 0.32; Ho 0.48 ±
  30%); research speed at start M 1.01 (×1.23 the leader's day-0 research speed once the auto mix moves compute to
  experiments); METR h50 doubling 3.0 months 2025.5–2027.0 (**miss**, 4.2 ± 1): RefBot's G grows ≈ 1.7 OOM/yr in that
  window (V0's RL sits short of its ceiling, the first base catches up; the 2026 AI speed-up) and Long context + memory
  (P07, adopted on day 66) multiplies the horizon ×1.5; without P07 it is 3.4 months. The frontier G path stays on
  research/12's anchors (29.1 at 2026.0).
- **Why authors2026 does not fit with two parameters.** Its golden dates come from AI 2027's takeoff integrator on the
  AIFM gaps: 1.5 human-years SC → SAR, then 101 and 1,340 (ai2027: 4.2, 16, 49.5). In the work-type model the three gaps
  are fixed fractions of Δ_bm (SAR 0.84·Δ_bm above SC, SIAR 2·Δ_bm more, ASI 1.7·Δ_bm more), so one Δ_bm cannot give a
  short first gap and long later ones: a Δ_bm long enough for SAR → SIAR → ASI (≈ 3.1) puts SAR 0.55 y late; one short
  enough for SAR (≈ 1.8) runs SIAR and ASI 1.2–3.3 y early. The AIFM's own uncertain "AI taste at the automated coder"
  (sd_SC, 0.5 SD here from its median) is the parameter that sets the first gap independently: probes with it per preset
  (scratch, not shipped) give authors2026 SC 0.00 / SAR +0.09 / SIAR −0.32 / ASI −0.05 at (Δ_bm 3.5, sd_SC 1.5) and
  0.00 / −0.06 / +0.29 / +1.53 at (4.0, 2.0), so a third per-preset value around (3.7, 1.7) should bring all four inside.
  That exceeds the brief's "G_SC and at most one more", so it is reported, not done. (V2a's authors2026 miss was the
  same shape, SAR/SIAR early and ASI late through the M bridge; with the realised pools the remaining miss is the
  milestone spacing, not the research mechanics.)
- slow's V2a problem (CAL_SHIFT −1.5) is gone: its G_SC is one number on the same axis (35.5 vs ai2027's 31.4) and its
  research slows physically (r 1.2, compute 1.6×/yr after 2028).

**Readouts for the UI phase (V2b; engine functions exist, the panels do not show them yet)**
- Per work type (workfit.ts `workFit`, `refPoints`): the model's fit (OOM; λ(F) as a level), the best human's and the
  median expert's points, coverage a_w, h50 / h80 and p(H_w), win rate, assist ×; the distance to each milestone criterion
  (fit − best, coverage vs 0.9, AI vs best-engineer cost per work-hour), per live version (`versionMilestones`).
- Per internal use (`workContext().slots`): H100e, FLOP per token, H100e-hours per work-hour, copies and serial speed, AI
  FTE and team-equivalents, effective labour L and its multiplier m on the role's teams, the humans' share wH.
- Taste: AI research taste sd_AI and cover φ; each team's taste and each project's (`sciOn`).
- Per project (`research.last.x`, `reProj`, the project state): experiment compute c and labour ℓ (leader day 0 = 1), X
  and whether compute- or labour-bound, FLOP per day used, research engineers, stage work and rate (ETA), batch b; for
  lines the pool (R/n₀, the line's realised OOM r_l·log₁₀(R/n₀), the next idea's prior) and the research input Q.
- Lab: research speed vs the leader's day 0 (`researchSpeedRel`), the AI multiplier M and its parts, the software rate
  (`research.gRate`), the auto research mix (experiments vs agents; before SC it puts ≈ all research compute on
  experiments: say why), build capacity split into humans and AI.
- Removed readouts to retire in the UI: "×N the reference lab" ratios (now leader-day-0 units), the ηmod clamp line, the
  frontier-methods ratio, the ×10 build cap.

**Open issues (V3; see V3b below for what was resolved)**
- authors2026 SAR and ASI (above; resolved in V3b); METR doubling 3.0 months (above; resolved in V3b).
- The display level λ(G) = levelOf(Φ(G)) still spaces levels by v2's human-year gaps: at the player's work-type SC the
  displayed level of the reference recipe is 9.3 (ai2027), 7.9 (authors2026), 9.9 (fast) and at SAR 10.5 / 11.5 / 12.0
  (v2: 10 and 12; SIAR ≈ 12.0–12.2, ASI ≈ 12.3 instead of 13.5 and 15), which shifts every level-gated rule (safety S5, U vs L,
  the safe bot's win rate 42.5%, tutorial acts, measured-level milestone notices). Rebuilding λ on the work-type reference
  points (V5 evals or V6 safety) is the fix; CAL_SHIFT cannot do it alone (one shift, three gaps). (Done in V3b.)
- The passive player is no longer ousted early in seed 9 (hygiene average); not investigated beyond the per-day cost.
- Engineering at the start is tight (capacity 5.4 vs load 4.6 team-weeks/week for the leader start) after the upkeep
  retune; follower starts not rechecked. (Checked in V3b; the challenger fixed.)
- SAF_EXP / SAF_IDEAS are defined but consumed only through the safety fleet's FTE (V6).

### V3b (2026-11-19, lead-session follow-up)

**1. Third per-preset value: AIFM's AI taste at the automated coder (sd_SC), and the global ASI gap.** V3_CAL now carries (G_SC, Δ_bm, r, sd_SC).
The research domains' best humans sit (1 − sd_SC/3.09)·Δ_bm above G_SC, so sd_SC sets the SC → SAR gap independently
of Δ_bm. Start value 0.5 SD (AIFM median; 80% CI −2.5 to 3.5, Daniel 0; research/13 §2.2); kept at 0.5 where two
values fit, fitted where they do not (authors2026). `calib.ts --fit-v3` with `V3_SD=<sd>` fits G_SC and Δ_bm at a given
sd_SC; several sd_SC run in parallel and the best is kept. With the ASI gap at 1.7 gaps no (Δ_bm, sd_SC) fitted authors2026: SIAR came
0.2–0.3 y early wherever ASI was on time (its SIAR → ASI took too long against SAR → SIAR). The global ASI gap is now 1.3
best-to-median gaps beyond SIAR (ASI ≈ 13.3 SD; AIFM puts ASI at 12–15 SD = 0.9–1.85 gaps, AI 2027's knots 1.6) [fit,
global], and ai2027 and fast were refitted with it. authors2026 fits at sd_SC 1.8 (inside AIFM's 80% CI). Caveat: its
fit is steep in Δ_bm (Δ_bm 4.46 or 4.55 instead of 4.50 moves SIAR/ASI by 0.15–0.5 y): the takeoff sits near the
boundary between accelerating and decelerating taste growth (r·log₁₀ m2b/Δ_bm ≈ 0.4 at the fit, with compute growth on top).

**2. Display level λ(G) on the work-type reference points.** `models/capability.ts levelOfG`: piecewise linear in G
through V0 (L 5) and the reference recipe's SC, SAR, SIAR and ASI points (L 10, 12, 13.5, 15: v2's LEVEL_KNOTS at those
milestones), below V0 at the first slope, capped at 15. `levelOf(w, pm)` (every lab: the player's versions, rivals,
China, the leader lab) is now λ(Φ⁻¹(pm)), so all levels and the level-history lead comparisons share one scale; the
rivals' dynamics and milestones stay on pm (BRIDGE(V7)). v2's threshold map survives only as `levelOfPmV2` (unread).
Pre-SC the slope is 5 L over G_SC − G_V0 (≈ 1.5 L per OOM on ai2027; Epoch's ECI is close to linear in log compute).

**3. Frontier G growth.** RefBot's best model grew ≈ 1.7–2.1 G/yr in 2025–26 against research/12's +1.1–1.3 (28.0 Aug
2025 … 29.4 autumn 2026). Decomposition of Aug 2025 → Oct 2026 (+2.45 G): compute +0.89 (≈ 0.76 OOM/yr, as research/12's
≈ 0.7), pretraining recipe +0.89, RL +0.67, P07's ×1.5 on the horizon on top.
- The recipe term had a one-off +0.53: v2's start solution put the leader's day-0 recipe 0.53 OOM ahead of B0's (v2's
  know-how rate × B0's 256 days), so the first new base jumped. Now E_B0 = 1.38 keeps B0 and V0 where they were (V0 G
  27.97) and new runs start from E_START = 1.19 = B0's recipe + Ho et al.'s 0.48 OOM/yr × 0.70 yr.
- The RL term grew ≈ 0.5 OOM/yr through the RL-ceiling line (Environments & rewards adds to the RL asymptote one for one)
  and RL algorithms: research/12 counts post-training gains as the 2024–25 one-off reasoning jump (already in V0), not a
  continuing 0.5 OOM/yr. Line start effects: L.env 0.04 → 0.006, L.rlalg 0.08 → 0.015 (the RL stacks now add ≈ 0.1
  OOM/yr of G before SC); rShare (the lines' start shares of
  software progress) rebalanced to pretraining 0.8 (L.scale 0.36, L.data 0.22, L.opt 0.22), RL 0.2 (L.env 0.12, L.rlalg
  0.08); L.latent 0.22, L.infer 0.15 unchanged. LINE_FIT.mu 0.69 → 0.645 (--fit-lines, the pretraining stack 0.48 OOM
  in the first year again after the rShare change).
- P07 (Long context + memory) was an unsourced ×1.5 on h80 (research/12 #7 [G]); now a typed horizon extender ×1.2 [D]
  (CL-Bench 2026: memory systems do not yet beat in-context learning [P]). P12's ×2 stays [G].
- Not the cause: V0's RL sits at 0.70 of ≈ 1.0 ceiling, but later runs reach only ≈ 0.75–0.80 at the reference budget
  once the RL lines are small; the first base's FLOP (≈ 1e27, 3× B0) is compute growth since B0.
- New check (calib T1, ai2027): the least-squares line through RefBot's daily best-model G, Aug 2025 – Nov 2026, within
  ±0.2 G of each anchor; the METR h50 doubling check stays (horizon slope unchanged, 4.2× per OOM).

**4. Engineering at the start.** worktypes.ts checks every start type: capacity − upkeep over its first quarter ≥ a base
run setup (a base sized to train six months on its pool). The challenger was short (3.37 vs 3.49 team-weeks/week of
upkeep); it now starts with 4 engineering teams (was 3) [D, data/v2/starts.ts]. Leader, big tech and spinout pass.

**5. AI FTE at SC vs AI 2027 (physical assumptions behind the ×28).**
  The reference lab at its SC (ai2027, stub, day 637): routine-research model on a 2.8T-active MoE base (2.3e27 FLOP) →
  5.6e12 FLOP per token; 240k FLOP-bearing tokens per human work-hour (200k uncached input at prefill utilisation 0.35,
  40k output at decode 0.07; R20 D1, D2) → 1.77 H100e-hours per work-hour; serial speed 60 tokens/s per copy = 5.4× a
  human; the auto research mix puts 0.8% of 8.5M H100e on agents (43k on experiments, 10k on ideas, 13k on engineering) →
  107k + 25k + 33k AI FTE, 5.6k research copies. AI 2027's 200k copies at 30× on ≈ 0.5M H100e (≈ 5M median-FTE) differ in
  (a) agent compute (≈ 6% of compute vs 0.8% here: before SC our labour multiplier saturates on little compute, so the
  mix prefers experiments), (b) FLOP per work-hour (AI 2027 counts thinking speed, ≈ 30 tokens/s of human-equivalent
  thought; we charge the tokens an agentic coding hour actually processes), (c) serial speed (30× vs 5.4×). The player
  sees (a) in the research mix and (b), (c) in the copies readout.

**Hypothesis test: does the misaligned display level drive S5 and the safe bot?** After the λ rebuild the internal model
at SAR reads true L 12.0 and measured L 11.6–11.7 in the S5 worlds (V3 before λ: ≈ 9.3–10). S5 "without refresh" median
U − L at SAR +0.72 → +0.55 (V2a −0.91); S5 mixed margin −1.62 → −1.03 (V2a −1.23); U at SAR (RefBot) 10.78 (V2a 9.81).
So the level explained part of it; the rest is that U itself is higher at SAR: in the integrated S5 games SAR comes 170–
260 days after SC (golden 153; e.g. seeds 200–205: SC 454–722, SAR 622–902), so safety research has more time per
capability step, and in half the worlds tools are validated past L. Bots: see the calibration block.

**RefBot's pacing gates.** RefBot starts its paradigm projects when the measured level passes v2's old gates (P08 at
L 7, P13 at RSCH 8.5, P17 at 9.5, P19 at 8.5). After the λ rebuild the same level is reached at lower G on ai2027
(5 levels over G_SC − G_V0 ≈ 2.7 OOM instead of v2's spacing), so continual learning (P08) started on day 354 instead of
≈ 600 and the 2026 frontier ran at 1.8 G/yr. The reference policy now reads its gates on v2's scale (`bots/ref.ts
v2Level`: the display level → pm → v2's level), so it starts each project at the same capability as before; the other
bots and the player read the display scale.

**Rivals on the same level scale.** With λ on the work-type points, Φ⁻¹ of the rivals' pm did not line up with the
player: a rival reaching its SC on the CAL_SHIFT thresholds read L ≈ 11.4 on λ (its pm at SC is 1.3 OOM above the player's
G_SC once converted). CAL_SHIFT is now derived per world, `alignedCalShift` = the SC threshold at Φ(G_SC) (ai2027 0.59,
was the fitted −0.463), and the simple-lab credit CAL_SHIFT_V2 − calShift keeps the rivals' q path (their milestone dates,
T1L, T3) v2's; the credit phases in over one progress-year from the start, so the start gaps (T4) are unchanged. The
CAL_SHIFT table keeps V2a's values only for RefBot's pacing gates.
**The M bridge.** Revenue per chip, the limits view and safety's M of the overseen model read AI 2027's M(q) through
`bridgeQ` (the v2 coordinate at the model's display level) instead of pm + calShift, so a model at its SC reads M ≈ 5
whatever path its pm took (BRIDGE(V4,V6)).

**V3b calibration (T1, RefBot on the stub, seed 2027; Δ in years: SC, SAR, SIAR, ASI).** ai2027 G_SC 30.497, Δ_bm 2.2,
sd_SC 0.5: 0.000, +0.022, −0.041, −0.030. authors2026 33.62, 4.606, 1.8: −0.008, +0.016, −0.041, −0.025. fast 31.593,
0.17, 0.5: −0.003, +0.096, −0.019, −0.096. slow 35.447 (Δ_bm 1.6, sd_SC 0.5): SC −0.079. All within tolerance. Checks
(ai2027): frontier G path 1.31 G/yr, worst anchor 0.14 G (pass; authors2026 1.29, fast 1.32, slow 1.14 G/yr, all ≤ 0.15
G); METR doubling 4.4 months (authors2026 4.5, fast 4.4, slow 5.0); pretraining stack 0.49 OOM/yr in the first year; M at
the start 1.04. **Fragility:** authors2026's SIAR and ASI move by up to +0.25 / +0.38 y for G_SC changes of ±0.005 OOM
(33.62: −0.04 / −0.03; 33.626: +0.25 / +0.38; 33.6255: +0.18 / +0.33): its four-year takeoff accumulates discrete events
(base completions, adoption order, batching) near the accelerating/decelerating boundary, so its calibration is a point
fit on seed 2027, not a robust one. The others move by days.
Simple labs after the alignment: LEADER_CAL refit (`--fit-leader`): ai2027 0.021 → 0.256, authors2026 0.046 → 0.096, fast
−0.001 → 0.134, slow 0.039 → 0.314; CHINA_CAL.effScale 2.4 → 3.2 (China's mean lead 223 d at 2.4, 174 d at 3.4).

**What it did not fix: revenue (BRIDGE(V4)).** With the frontier on research/12's path (1.3 G/yr instead of 1.7) the
integrated RefBot's 2026 revenue is $29B (F7 target $45B ± 20%), its 2027 revenue $78B (F11: $140B ± 30%), valuation
$0.5T and 67% of seeds out of distress (F8 ≥ 75%). Its products serve distilled minis and held-back full versions that
sit ≈ 1 display level under its frontier and, by late 2026, under the rivals' frontier, and the sector demand model reads
those levels. The revenue model (revenue per chip from AI 2027's M, logit shares on levels) was tuned to the faster v2
path; V4 rebuilds it on tokens, cost and work-type coverage, so it is left for V4 rather than retuned here.

---

## V4–V7

Detailed when each starts (spec §16): V2b research UI (after V3, covering V2 + V3 mechanics), V4 serving and products
(owns worldfx GOV T1 and W2 from V1; sectors onto work types), V5 data assets, environment suites and evals, V6 safety
(SAF work types, safety lines on the project mechanism), V7 rivals and China (owns ws4 T3 lead band), bots, UI pass,
jank audit.

### V3 decision (2026-11-19, lead session)

V3 + V3b accepted: all presets within the golden tolerances with three per-preset values (G_SC, Δ_bm, AIFM's AI taste
at SC) and a shared ASI gap of 1.3; frontier G path and METR doubling checks pass. Known and owned: finance F7/F8 and
worldfx W2 (revenue bridge → V4), safe-bot win 10% and safe losses (rebalance after V4–V6), authors2026 fit is a
point fit (fragile, revisit in V7 with multi-seed calibration), hygiene perf average over budget (V7 perf pass).
Next: **V2b UI** for the V2 + V3 mechanics, then V4.

## V2b UI: research, recipe, allocations, AI labour

Brief: V2b above (project cards with stage track, belief band, odds; priority list and teams wanted; risk policy;
per-stack recipe readout; research-engineer and engineer allocations with priority and overflow), extended with V3:
- per project: compute- or labour-bound (c, ℓ, X), FLOP and research engineers on it, ETA; lines: pool state, realised
  OOM, next prior;
- an **AI labour** view per work type (SWE, EXP, IDEAS; SAF_* shown as "used by safety"): the model's fit vs median
  expert and best human, coverage, horizon and success at the work type's task length, copies, speed, AI FTE,
  effective labour, human share, and distance to each milestone criterion (SC, SAR, SIAR, ASI);
- lab research speed (M readout vs the leader's day 0) and what binds it, replacing the old bottleneck bar's knot terms;
- engineers' build capacity split into humans and AI;
- remove every UI reading of removed v2 concepts (know-how months, × frontier, knot terms, CAL_SHIFT levels).
The readouts exist (V2 notes "What V2b needs", V3 notes "readouts for the UI phase"). Follow the good-ui skill; where
it asks for mockups for approval, write them to `design/ux/mockups-v3/` and proceed (the user reviews them with the
build). Every new term gets a glossary entry and a tooltip; `npm run test:ui` extended for the new panels.

### V2b notes (2026-11-19)

Code: `src/engine/v2/models/researchView.ts` (read-only views: `capProjectView`, `capPriorityList`, `stackViews`,
`reAllocView`, `engAllocView`, `workTypeViews`, `milestoneViews`, `researchSpeedView`, `buildSplit`; exported through
`core/selectors.ts`), UI `src/ui/v2/panels/ResearchProjects.tsx`, `Recipe.tsx`, `Work.tsx` (+ `work.css`), rebuilt
`Research.tsx` (tabs) and `Company.tsx` (Flow research-speed card, new Work tab). Mockups and IA:
`design/ux/mockups-v3/v3-v2b-*` (`node design/ux/mockups-v3/render-v2b.mjs`).

**Where things live (one home per datum; IA table in `v3-v2b-IA.md`)**
- Research gets three tabs. **Projects** (default): the capability priority list (rank, kind, five-step stage track
  ideation → small experiments → scale test → result → adoption, teams wanted stepper with placed-team dots, what binds,
  next result, ▲▼ and drag) with the risk policy and "+ Add project" on its header, failed projects with "Reopen as
  speculative" under it; the selected project's card (L2: stage track with labels, belief band against the next prior,
  scale behaviour, odds and drops, inputs c and ℓ with what binds, research engineers and FLOP/day, the line's pool,
  teams with their `why`). **Recipe**: one card per stack group (stack efficiency, start/adopted/headroom bar, not
  trained in, headroom, adopted ideas believed → realised) and the software rate. **Tree**: the old tree; its node card
  adds to / removes from the priorities, reopens failed projects and opens the project in Projects. The team picker,
  the know-how bar, the "Active projects" cards and the queue card are gone (the game assigns teams; safety projects
  keep their staffing home on Safety › Research lines).
- Company gets a **Work** tab: one card per role and work type (engineers · software engineering, research engineers ·
  experiments & runs, scientists · research ideas & taste) with effective labour as the hero (×m with AI; people vs
  what AI adds), the model's fit on an OOM axis against the median expert and the best human, coverage against the 90%
  milestone mark, and "where it goes": the needs in priority order with a cap select (no cap, 25–90% share, 1–16 teams)
  and ▲▼ / drag, bars of what each need got vs its demand (hatched red = short), idle (overflow). Scientists link to the
  priority list. Below: the seven milestones with each criterion's distance on the closest live model, and safety
  experiments as one line (used by the safety agents, link to Safety).
- Company › Flow's research-speed card: research speed vs the leader lab's day 0 (hero), the AI R&D multiplier with its
  parts (AI labour, AI taste), a unit project's c and ℓ, the auto research mix and why it puts almost everything on
  experiments before agents cover much, the three levers per dollar, the limits (serial speed, pause, diffusion).

**Choices**
- Build capacity's home moved from the engineers' pile (Agents & teams) to the Work tab's engineers card (the hero
  number; `BuildLoad` is shown there `compact`, with its per-item tooltip). The piles link there.
- The Agents lanes keep "AI share of the work" (package level); engineers' share is now 1 − the humans' share of the
  SWE labour margin like research engineers' (was coverage, whose home is now Work). The 1 − (1 − A)² text is gone.
- A project's c and ℓ for a project not yet in experiments are read at a full project share (RE_PER_PROJECT), so the
  "binds" chip says what would bind once it gets research engineers. ETA = ideation to PICK_AT candidates at today's
  ideation rate + the remaining test work at today's X; a dropped candidate restarts it (said in the tooltip).
- The next prior of a line is shown at the taste of the teams on it (research input per idea), so it compares with the
  candidate's belief; the belief band's reference marker multiplies it by the candidate's batch.
- Realised value of an adopted idea is shown only once a model trained after its adoption is evaluated (pretraining: a
  base started after it with an evaluated version; RL / systems: any version made after it); before that "next model".
- Effects below 0.001 OOM print in e-notation (the raw-float lint).
- Limits: `speed.frontierMethods` and `speed.etaMod` removed (registry, engine readout, UI); `speed.diffusion` reads
  "recipe × your own rate"; new `research.maxTeams` (6 per project) and `research.rePerProject` (2 team-equivalents)
  shown on the project card; `tree.retry` now only applies to the two rolled safety nodes and lives on the Tree tab.
- Glossary: 38 new terms (stages, belief band, scale behaviour, project kind, ideas get harder, next prior, realised
  effect, teams wanted, risk policy, reopen as speculative, why this team, recipe stack, stack efficiency, headroom,
  routine tuning, software progress, c, ℓ, research speed, work type, fit, median expert, best human, coverage, success at
  task length, win rate, assist, effective labour, humans' share, both needs lists, cap, overflow) and 31 rewritten v2
  ones (M, production, what binds, know-how → recipe, not trained in, effort, team-month, odds, priority list, auto-assign
  (safety only), retry, the milestones as work-type statements, AI FTE, copies, build capacity, engineering agents, AI
  science, AI share of the work, research taste, the bound labels). lint-ux REQUIRED lists the V2b vocabulary.
- Links that open an idea (Blueprint locked options, Products features, Safety line projects) open the Tree tab; a
  capability project's result in the alert list opens its card on Projects.

**Known gaps**
- The top strip's milestone ticks still sit at display levels 6.5 / 8.5 / 10 / 12 / 15 (agent, research agent, SC, SAR,
  ASI). SC/SAR/ASI match λ(G) at the reference recipe (V3b); agent and research agent are now coverage statements with
  no fixed level, so those two ticks are approximate.
- Teams wanted has no "auto"; 6 is "max" (PROJECT_MAX_TEAMS), 0 pauses.
- The milestone criteria read the version that is closest to each milestone (fit and coverage are exact readouts of the
  lab's own models, not eval noise; V5 moves capability readouts onto evals).
- Drag-and-drop works with the mouse (HTML5); ▲▼ buttons are the keyboard/test path.
- A new game starts with no capability project on the list (V2a start state), so the capability science teams are idle
  until the player adds one: the Research badge, the list's empty state and the idle line say so. A default list (the
  lines RefBot runs) would be an engine/start change, left for the lead session.

### V2b decision (2026-11-19, lead session)

Accepted (screens checked: 42-research-projects, 10-company-work). Two engine issues go to V4.0.

## V4 Serving, products, sectors on work types

Goal: revenue, prices and sector adoption come from physical serving economics and the shared work-type function.
Spec §6, §7; research/20 §D. Removes BRIDGE(V4) (relative `serveCost`, revenue per H100e × M^0.3, the M reads of
revenue). Owns worldfx GOV T1 and W2 and finance F7/F8 (revenue path). Two runs: **V4a** engine + calibration +
tests, **V4b** UI.

### V4.0 Carry-overs from V2b

- A new game starts with an empty capability priority list, so science teams sit idle: give every start type a
  default list (its starting portfolio, e.g. the lines plus the start's in-progress ideas) [D], shown and editable.
- In the uitest fixture a priority-2 line with teams wanted 1 got 0 teams while priority 1 got 6: check the assignment
  (or the line's readiness) and fix or explain in the UI.

### V4.1 Sectors and consumers as work types

- Each sector (research/16 table) becomes a work type: its domain weights, a task length H and verifiability [R20 E,
  research/16] — the same fit/coverage/assist function as internal work (V3). Feasibility F = coverage of the sector's
  work type on the market's mix of models (replaces σ((Le − 8 − θ)/1.2)); the cost gate K compares the **physical cost
  per work-hour** of each provider's model with the sector wage (replaces the abstract cost curve halving per 1.5
  levels). Bass diffusion, friction, employment, hiring and macro stay as they are.
- Consumer chat is a work type too (SOCIAL, REASON, MEDIA; minutes-long tasks).

### V4.2 Cost, price, capacity

- Cost per work-hour = tokens per work-hour (work type, effort, features) × FLOP per token (2·N_active of the served
  version) ÷ (H100e FLOP/s × serving utilisation) × $ per H100e-second (market TCO) [R20 D1–D2].
- Capacity = serving H100e × FLOP/s × utilisation ÷ (FLOP per token × tokens per work-hour).
- **Price**: the player's price policy per product = markup over its own cost per work-hour (budget / standard /
  premium [D], with research/20 D3: API gross margin ≈ 0.6) and never above the task's value (wage × hours saved).
  Rivals and China price at their own cost × a markup [D]; their cost from their model's size — rivals have no
  N_active yet, so derive one from their G with the reference design (`// BRIDGE(V7)`).
- Market share per segment: logit on (fit on that work type, price, brand, access) as today, but the **customer base
  is a stock** that moves toward the logit share at a segment speed (consumer weeks, API months, enterprise and
  government contracts quarters to a year) [D]. Revenue = min(demand, capacity) × price.
- Consumer: subscribers (reach × share, a stock) × price; usage tokens per user-day sets the serving need; the mini free
  tier serves free users.

### V4.3 Features (typed, spec §7.2)

Replace flat L bonuses: task enablers (open work types or segments), horizon extenders (× h50 on chosen work types),
scaffolds (+ΔG compute-equivalent on chosen work types, × tokens; Davidson et al. 2023 via research/20 B3), effort
(+0.3–0.5 OOM per ×10 reasoning tokens, capped +1.5 [R20 C3]). Effects apply to both products and internal packages.
P05 and P07 (LATER(V4)) become typed features here.

### V4.4 Calibration and tests

- Finance F7/F8 targets (2026 revenue, valuation, distress), 2027 revenue; worldfx tests incl. W2 TFP and GOV T1; the
  sector automation path. Price sanity: price per million tokens and its decline for fixed capability vs research/20
  D3 (×10/yr, range wide) — report, not fit.
- Tests (`scripts/v2/serving.ts` in `test:v2`): cost ∝ N_active × tokens; capacity ∝ H100e; price never below cost
  or above value; customers move gradually; a bigger model costs more per task (the size → cost link the v2 revenue
  exponent damped); features' effects typed and applied in both products and internal use; lint: no reads of
  `serveCost` or multiplierRef for revenue.
- Golden dates must stay within tolerance (serving affects revenue → compute → research).

Record "V4 notes" and a PROGRESS row; schemaRev bump. **V4b UI**: product cards show cost and price per work-hour,
margin, capacity, customers stock and its target, features with typed effects; World panel sectors show the work-type
coverage and cost gate. good-ui skill.

### V4 notes (V4a: engine, calibration, tests; 2026-11-19)

Code: `src/data/v2/serving.ts` (tokens, sector work types, chat, sector reference, markups, elasticity, customer speeds,
consumer market), `src/engine/v2/worldfx/serving.ts` (cost chain, offers, coverage of sector work, rivals' FLOP per
token, typed feature effects, subscription price), rewritten `worldfx/mix.ts` (offers, logit target, customer stocks, F
and K on the mix) and `worldfx/revenue.ts` (hours of use and subscribers × price vs capacity, segmented Auto split);
`worldfx/sectors.ts` reads F, K and the buyer's cost from the mix; typed `data/v2/features.ts`; `ModelVersion.fpt`;
schemaRev 16 (migration 15 → 16). Test `scripts/v2/serving.ts` (in `test:v2`).

**V4.0.** Every start queues the five research lines (`data/v2/research.ts DEFAULT_LINES`, RefBot's lines and shares;
teams wanted ≈ share × capability science teams, ≥ 1) after its safety projects [D]; the starts have no idea in flight on
day 0 (their earlier work is their known nodes), so "the start's in-progress ideas" is empty. The uitest observation
(priority-2 line with 0 teams, priority 1 with 6) was the state before the next tick: the assignment ran only in the daily
tick. The priority-list actions (queue, start, drop, reorder, teams wanted, reopen) now re-run the deterministic
assignment at once (`tree.ts assignCapNow`). RefBot's queue order and wants are unchanged, so calibration is unchanged
(T1 identical). Passive games now research (the hygiene/perf and bot baselines move with it).

**The cost chain (V4.2) [R20 D1–D3].** H100e-hours per hour of AI use = FLOP per token (2·N_active × the shape's token
multiplier × the serving stack at creation, stored as `fpt`) × (uncached input ÷ U_prefill 0.35 + output ÷ U_decode 0.07)
÷ 1e15 ÷ 3600 (V3's constants); × $ per H100e-hour. Choices:
- Cost basis = the market rental (owned TCO × 1.6 × (D/S)^0.8), not owned TCO [D]: the opportunity cost of a chip and
  what most serving pays (cloud); V3's AI cost per work-hour already used it. Owned TCO would put every price ×1/1.6.
- Demand is in hours of AI use: every adopted task-hour runs the AI (A·E0·2000); it saves α + (1 − α)·g_aug hours
  (substituted vs augmented, research/16 step 6), so the value of an hour of use = wage × that. Tokens per hour of use =
  α·autonomous (375k uncached / 62k output per work-hour: a day-long agent task, R20 D2) + (1 − α)·assisted (agentic coding
  200k/40k for Software and Science, knowledge work 100k/15k elsewhere) [D]: token use per hour rises as agents take
  whole tasks — the physical capability → revenue link that replaces M^0.3.
- Price = max(cost, min(markup × cost, value)) [D]: never below cost; above value only when serving costs more than the
  work is worth (then the cost gate shuts the sale). Tiers: budget margin 0.4 (×1.67), standard 0.6 (×2.5, R20 D3 API
  gross margin), premium 0.75 (×4). `PRICE_TIERS` is now the markup relative to standard (0.67 / 1 / 1.6). Rivals price at
  ×2.5, DeepCent ×1.67 (DeepSeek-style), open weights ×1.2 (hosts near cost) [D].
- Rivals and China have no N_active: N = 1T × 10^((G − G_V0 − 0.55·years since V0)/2) (the reference design scaled by
  training FLOP; 0.55 OOM/yr = research/12's non-compute G growth), `// BRIDGE(V7)` [D].
  Their G (read through pm) is capped at the display scale's top (λ 15, the reference ASI point): the simple labs' v2
  progress runs to hundreds of OOM in a takeoff (China read G 2,301 in the day-900 fixture and took 99% of every market
  before the cap), which v2 hid behind the capped display level. In a takeoff their N is then oversized (fixed 0.55 OOM/yr
  of algorithmic progress), so their prices are high: a bridge until V7.
- Capacity = serving H100e × 8766 ÷ H100e-hours per hour (work-hours a year); revenue = demand $ × min(1, served ÷ need).
  With cost-plus prices every paid product earns the same per H100e (markup × rental), so the Auto split serves paid work
  pro rata (segments within 1% tie) and Chat's free users last (they earn nothing) [D].
- Consumer [D]: weekly users = online adults (US 260M, ROW 2.5B, CN served at home) × reach × customer share; 5% pay a
  subscription = markup × a paying user's serving cost (30k/8k tokens a day on the product's model), capped at $200/month;
  free users (1.3k/0.3k a day) run on the product's mini, else its model. Reach* = 0.35 + 0.55 × the best model's
  coverage of consumer chat.
- Effort [R20 C3]: reasoning tokens ×0.3 / ×1 / ×4 (low / max / deep), +0.4 OOM of fit per ×10, capped ±1.5. Safeguards
  and the control layer cost fit at v2's level offsets ÷ 1.2 L per OOM.

**Market and customers (V4.2).** Per segment the logit target ∝ exp(4·(fit − best fit)) × price^−1 × access × brand
(brand × (1 − capacity erosion) as before). Slope 4 per OOM = v2's 2.1 per level at ≈ 2 levels per OOM [D]. **Price
elasticity 1.5 → 1 [D, deviation]:** v2's 1.5 acted on a price index of ×0.7–1.4; physical prices span ×2–5 between a
frontier model and a small one, and frontier models hold large shares at 5–15× the price of small ones (R20 D3 list
prices); with 1.5 cheaper rivals took the market from a frontier lab whose model was 0.5 OOM better. Customers are a stock
per (region, segment) moving toward the target with τ = 3 weeks (consumers), 0.25 y (sector work: API months, enterprise
contracts quarters), 0.75 y (GOV, MIL) [D]; a new provider starts at 0. The player is one provider; its sector demand is
split over its products by v2's channel weights.

**Sectors on work types (V4.1).** A sector's cognitive work is a work type: research/16's task weights without PHYS
(renormalised), task length H and verifiability v per sector (R20 E3 classes) [D, `SECTOR_WORK`], horizon on AGENCY
(CODE for Software). Coverage uses V3's function σ((fit − θ)/0.8) × p(H | h50); the reference is the sector's median
professional, θ_s = G_V0 + (0.47 + 0.2·θ_R16)·(G_SC − G_V0) + 0.5·(0.9 − v) — 0.47 of the V0 → superhuman-coder span is
where v2 put the same point (level 7.35 + θ, fitted to research/16's F_SOFT anchors), kept: with it W2, W4 and the
automation dates land in their bands (below) [fit, unchanged]. F = (1 − w_PHYS)·Σ share·a + w_PHYS·(v2's robot-bound PHYS
term). Cost gate per provider K = σ(ln(wage ÷ (price per AI work-hour + 0.27·wage·(1 − a)))/0.7) (GDPval review on the
work the AI cannot do alone), share-weighted; the buyer's cost per AI work-hour feeds employment's CR. The hiring
baseline ΔF is a pre-LLM model's coverage (0.4 of the span under V0). Consumer chat is a work type (SOCIAL 0.4, REASON
0.4, MEDIA 0.2; 3 minutes; v 0.5). α, the integration boost, control, techs and the AI-friend share still read the
share-weighted display levels (as briefed: "stay as they are").

**Typed features (V4.3, MODEL-V3 §7.2).** Memory (P07): horizon ×1.3 on all work + 10% more Chat users; Deep think (P05):
effort deep; Computer use (P06): enabler, +15% reachable work in Admin, Finance, Legal, Government; Voice & vision:
enabler, +15% Chat users and Media work; Deep research (P05): scaffold +0.3 OOM on Science, Finance, Legal and internal
research ideas, ×3 tokens; Coding agent: scaffold +0.3 OOM on Software & IT and internal engineering, ×2 tokens; Companion
mode: enabler, +20% Chat users; Sector packs: enabler of sector products (a certified pack +0.42 OOM in its sector, v2's
+0.5 L) [D; scaffold sizes below Davidson et al.'s ×5–×30 CEG because 2025 models are already agent-trained]. Enablers
open a segment only products with them reach (rivals: none, BRIDGE(V7)); scaffolds and horizon extenders apply to the
internal agents' work types once built (`serving.ts internalFx`: fit for labour and AI taste, × tokens ÷ AI FTE);
milestones read the model alone. Feature domain-level offsets, appeal and serve multipliers are gone; hazards stay.
P05's ×1.3 agent throughput and P07's ×1.2 version horizon stay as paradigm effects (TECH-TREE rows updated).

**Removed.** Revenue per H100e = $40K × M^0.3 × (0.5/serveCost)^0.3, the M bridge in revenue and the limits view
(`revenue.speedCap` → `price.valueCap`), price capture 26% of the wage, the abstract cost curve (60% of W0 at L 5,
halving per 1.5 levels), consumer spend 6·(L/5)², feature domain offsets. serveCost stays a design readout (relative to
the reference design at the same FLOP); the monitor overheads read FLOP per token; only the safety fleet's copies still
read serveCost (BRIDGE(V6)). Lint (serving.ts S7): revenue, mix, serving, sectors, product view and limits view read no
serveCost, multiplierRef / bridgeQ or v2 price stand-ins; the worktypes lint now allows BRIDGE(V6|V7) only.

**Calibration (RefBot, seed 2027 unless noted; before = V3b).**

| Target | Before | V4a | Band |
|---|---|---|---|
| Golden T1 (stub), all presets | in tolerance | in tolerance (ai2027 0.000/+0.022/−0.041/−0.030; authors2026 −0.005/+0.016/+0.044/+0.085; fast −0.003/+0.096/−0.019/−0.096; slow −0.079) | ±0.08 / ±0.12 |
| T1L leader lab | in tolerance | unchanged | |
| F11 Jul 2025 run-rate | $14.3B | $14.2B | $12B ± 35% |
| F7 2026 revenue (finance, 12 seeds) | $27.5B | **$22.4B** | $36–54B |
| F7/F11 2026 revenue (worldfx, seed 2027) | $42.3B | **$22.8B** | $36–54B |
| F11 2027 revenue (finance / worldfx) | $102 / $133B | **$18.2 / $19.1B** | $98–182B |
| F7 valuation end-2026 | $0.35T | **$0.19T** | $1–3T |
| F7 capex 2026 | $152B | **$138B** | $150–250B |
| F8 out of distress through 2026 | 58% | **50%** | ≥ 75% |
| F2 global production 2027 | 45.0M | 46.8M | 45–60M |
| W2 TFP decade (Agent-1 models, normal) | 0.2% | **0.56%** | 0.5–1% |
| W4 Nov 2026 (reality): U, youth, firms | pass | +0.00 pp, −16.3%, 20.5% | ≈0, −19 ± 5, 17–20 ± 2 |
| Hiring SOFT ≤ 10% | pass | 2027.53 | 2027.50 ± 0.25 |
| AI friend Jul 2027 | pass | 9.7% | 10 ± 3 |
| Remote work 25% | pass | 2027.95 | 2027.75 ± 0.25 |
| U +1 pp in 12 months | pass | **2028.01** | 2027.75 ± 0.25 |
| GOV T1 Accept ≥ 0.85 | 2027-09-08 | 2027-09-09 | Dec 2027 ± 3 mo |
| Equity 2026 | pass | **−18%** | +30 ± 10% |
| SEZ + W17 explosive growth | pass | pass (failed at 21% before the simple-lab G cap below) | > 30% |

**Why the finance targets are not met (stop condition, reported, not forced).** With prices at markup × the physical
cost, a product earns markup × rental × 8766 per serving H100e-year when capacity-bound: $44K at the start's $2.02/h
rental (v2's $40K RPH_BASE × 1.1: the start is unchanged), $26K at mid-2026's $1.2–1.3 and $13–15K in 2027's glut
($0.6–0.8). v2's M^0.3 path rose to $55–90K by 2027 (an implied margin of 0.85–0.92). And RefBot is not capacity-bound
in 2026: demand is. The world's AI spend is hours of use × price; hours of use are pinned by the adoption the sector
targets need (A ≈ 2% of work-hours, BTOS firm adoption 17–20%, W4 passes), and the price per hour of use is realistic
($1.7–3.2 at the start vs Claude Code's ≈ $1.6 per developer-hour at list prices), so the 2026 world market is ≈ $50B
(sector) + $10B (consumer) and the leader's share ≈ 40% → ≈ $20B. AI 2027's $45B (2026) and $140B (2027) need ≈ 2.5× the
price per hour of use (value pricing at ≈ 10–15% of the wage; v2 used 26%) or ≈ 2.5× the use per adopted task-hour, and
for 2027 a margin ≈ 0.85 on RefBot's AI 2027 serving share (14–19% of compute). Premium pricing for RefBot was tried
(scratch): 2026 $18.5B (worse: demand-bound, the share falls with price). The in-spec levers (markups within R20 D3,
tokens within R20 D2, elasticity) move revenue by tens of percent, not ×2–7; meeting F7/F11 needs either a value-based
price (contradicts "markup over cost") or a usage multiplier fitted to revenue (the hidden-tuning pattern V4 removes).
The shortfall cascades: distress (F8), capex, valuation, equity hype and the integrated RefBot (calib, informational:
authors2026 insolvent before its SC, fast SC +0.57 y; V3b: +0.42 and −0.03). **Decision needed (lead):**
(a) retarget F7/F11 to the physical economy (≈ real 2025–26 lab revenue: leader ≈ $13B 2025, $20–30B 2026), with WS3's
capex, valuation and distress targets following; (b) add a value-based price policy (a share of the work's value,
bounded below by cost) as a player and reference option; or (c) a usage term (hours of use beyond adopted tasks; worker
surveys put AI use at ≈ 2.5× A's hours) with its own source.

**Price sanity (INFO in serving.ts, not fitted).** API price per million FLOP-bearing tokens (agentic mix, standard):
$13.3 (Atlas-1.0, mid-2025) → $17.1 (early 2026, rental up) → $8.0 (Atlas-2.3-mini, mid-2026) → $4.8 (early 2027). A fixed
capability (V0's G) gets ×3.6 a year cheaper (algorithmic progress shrinks the model needed, ×1.9/yr, and the rental
falls); R20 D3: ≈ ×10/yr (×9–×900), so the decline is at the slow end — rivals' algorithmic progress is the bridge's fixed
0.55 OOM/yr (V7 gives rivals real designs).

**Performance.** Same state, same days (the V3b day-400 fixture migrated, 200 days): +15% per tick (mix ≈ 0.7 ms,
revenue ≈ 0.2 ms). The passive seed-9 game is +20–30% (V4.0 research, distress path). hygiene's perf checks fail on this
machine today (daily 4.0 ms vs 1.5; the V3b baseline run had 0.89 ms on the same check), but the V3b code itself
measured 2.3–2.4 ms/day on the passive game today against 1.16 earlier: machine load dominates the absolute numbers.

**Readouts for V4b (engine values exist: `revenueReadout` deps, `productReadouts`, `worldMix`, `priceView`).**
- Product card: cost and price per hour of use (Chat: per subscriber-month) and margin; share sold at the value cap;
  hours asked vs servable (capacity in work-hours); H100e need / served / cut, paid vs free users; customers (Chat users
  and subscribers from the stock; sector products the player's stock share per sector) and the logit target they move
  toward, with τ; features with their typed effects (ΔG, × h50, × tokens, segment share); effort's ΔG and token
  multiplier; the price tier as a markup (margin %).
- Per sector (World panel): the work type (weights, H, v), each provider's coverage and the share-weighted F, θ (median
  professional) vs the best offer's fit, the cost gate K (price per AI work-hour + review vs wage), prices by provider,
  the customer stock vs target, tokens per hour of use (α mix).
- Market: providers' fit, coverage, price and FLOP per token (rivals' is a bridge: say so).
- Retire: revenue per H100e "× M^0.3" and the research-speed cap row; "price ×1.4" tier text (done minimally in V4a).

**Open issues.** The finance targets (above). U +1 pp lands 2028.01 (band ends 2028.0) and GOV T1 Accept 2027-09-09
(band opens 2027-09-15; failing before V4 too). Hygiene perf on today's machine. The rival FLOP-per-token bridge (V7).
Consumer reach and the AI-friend share are US numbers applied to ROW. α and the integration boost still read display
levels.

### A2a notes (hours of use and value per hour; 2026-11-19)

Code: new `worldfx/use.ts` (hours of use U, workers' target W*, α_use, hours saved), `SectorState.W` (Bass stock in
`worldfx/sectors.ts`), `SectorDef.use` and `ECON.useW / useH` (`data/v2/sectors.ts`), `serving.ts savedPerUseHour /
useTokens`, `revenue.ts sectorHours` and the no-drop-in factor, `actions.ts` sector-product preview, `readouts.ts workUse`
(selector), schemaRev 17 (migration 16 → 17 starts W at W*). Tests: worldfx A2a checks, hygiene migration check.

**Mechanism [D].** Hours of AI use per work-hour of a sector U = A + h_s·max(0, W − A): the tasks firms handed to AI (A,
research/16, unchanged) plus workers' assisted use on the rest of their hours (W = share of the sector's workers who use AI
at work, h_s = share of their remaining hours with AI). W is a Bass stock at the sector's p and q (agency-boosted q, ×
DiffMult) toward W* = max(A, W_b + (1 − W_b)·F): today's base users plus the rest of the workers as the AI covers their
work. An hour of use saves α_use + (1 − α_use)·g_aug hours with α_use = α·A/U (assisted hours substitute nothing); tokens per
hour of use mix the autonomous and assisted profiles by the same α_use. α's research/16 sigmoid, g_aug 0.3, A0, Bass p/q,
F, K, R are unchanged.

**Deviation from the row ("fit A to worker-level use; re-fit only A0") and why.** A is capped by its ceiling A* = F·K·(1 −
R), and A* at the start is ≈2.3% of US work-hours (5.3% mid-2026): coverage F is what the AI can do *alone*. Setting A0
to the 6% worker anchor puts A above A* in most sectors (it would decay at 0.5/yr), and A also feeds displacement (D =
α·A), TFP, labour share, the GATE share, the control index (GOV T1), remote-work automation and headlines, so a ×5 A
would move all of them. The anchors themselves pin A where it is: with 6.3% of hours used and 2.2% saved (RPS 2026),
assisted hours saving g_aug and adopted ones α + (1 − α)·g_aug ≈ 0.5, A ≈ (2.2 − 0.3·6.3)/(0.5 − 0.3) ≈ 1.5% of hours,
against the game's 1.7–2.2% in mid-2026. So A0 is kept (still fitted to BTOS through firmK) and the measured remainder is
the new worker stock. The spec's work-type layer has the same split (MODEL-V3 §6.2: coverage, then assist on the rest).
Firm adoption (W4) stays the firm-weighted readout 1 − exp(−k·A) — a different quantity from worker use, as the brief
says; the new readout `workUse` gives hours, workers and hours saved.

**Constants.**
- `use` per sector (relative use vs the US average, normalised by employment) from the RPS by industry [R22 §1]:
  information 14% vs ≈5.4% for all (2024) → SOFT 2.6, MEDIA 2.0; professional/scientific/technical 11.4% vs 6.3% (Q2 2026)
  → LEGAL, SCI 1.8; finance 9.7% → FIN 1.55; production occupations 4.6% → MFG 0.75; leisure 2.3% vs 5.4% → SERV 0.45.
  [D] where the survey has no row: OFFICE and EDU 1.2 (high applicability: customer service, teachers), GOV 0.8, MIL 0.6,
  HEALTH, LOG, ENGY 0.5. The ratio is split evenly between reach and intensity (W_b ∝ √r̂, h_s ∝ √r̂) [D]: SOFT then has
  64% of workers using AI at 0.21 of their hours (U ≈ 16–19%; developers 51% daily in 2025, 73% in 2026).
- `useW` 0.37 [fit to R22 1a]: 38% of US workers at the start (RPS ≈37–38% Jul 2025 between 31% Nov 2024 and 40.7% Nov
  2025), 39–40% through 2026 (39.2% Q2 2026).
- `useH` 0.115 [fit to R22 1b–1c]: US hours of use 6.3% on 2026-07-01 (RPS 6.3% Q2 2026); a user's hours of use
  U/W ≈ 0.16 (R22 0.15–0.16).
- Regions [D, assumption]: no primary hours series outside the US, so CN and ROW keep the existing scale: W_b × 0.6
  (REGION_SCALE.A0) at the US intensity h_s; their hours of use are ≈3.5% (start) → ≈4.5% (mid-2026) of work-hours.

**Readouts (RefBot, classic, ai2027 econ, seed 2027; before = V4a, where hours of use = A).**

| Quantity | Before | A2a | Anchor |
|---|---|---|---|
| US hours of use, Q3 2024 (back-cast: W at 28.2%, A at BTOS 5.4%) | ≈0.6% | 3.9% | 4.1% |
| US hours of use, Jul 2025 / Jan 2026 / Jul 2026 | 1.0 / 1.3 / ≈1.95% | 5.4 / 5.7 / 6.3% | 5.7 (Q3 2025) / 5.6 / 6.3% |
| US hours of use, Nov 2026 / end 2026 / mid-2027 / end 2027 | 2.6 / 3.1 / 4.9 / 9.1% | 7.0 / 7.4 / 9.4 / 14.0% | 5.3% (Q3 2026) |
| US workers using AI at work, 2026 | — | 38–40% | 39–41% |
| Hours saved per hour of use, start / mid-2026 / end 2027 | 0.49 / 0.51 / 0.77 | 0.34 / 0.36 / 0.61 | 0.35 (0.39 in 2024) |
| US hours saved, mid-2026 | ≈1.0% | 2.3% | 2.2% |
| World sector market, 2026 (US / CN / ROW, mid-2026) | $58–89B ($8–10 / 17–33 / 33–46) | $134–235B ($20–29 / 41–87 / 74–120) | (not targeted) |
| World market incl. consumer, CY2026 | $85B | $197B | frontier labs $100–130B (R22 §4) |
| Leader (RefBot) revenue 2026 / 2027 | $22.8 / 19.1B | $32.4 / 39.1B | F7 $36–54B / F11 $98–182B (finance session) |
| Price per hour of use at the start (OFFICE / SOFT) | $2.00 / 3.02 | $1.36 / 2.65 | |
| Hours sold at the value cap (day 1 / 400 / 900) | 0 / 0 / 94% | 0 / 0 / 97% | |

The price per hour of use falls (×0.65–0.9) because most use is now assisted (fewer autonomous tokens); the value per
hour falls with hours saved (×0.7). The value cap still never binds before the takeoff (lowest value ÷ price at day 1 and
400: US 5.6 / 8.9, CN 3.5 / 3.4, ROW 2.9 / 4.7); at day 900 it binds as before (rivals' oversized FLOP per token in a
takeoff, BRIDGE(V7)). serving S3 (price ≥ cost, ≤ value unless serving costs more) passes on both fixtures.

**Gate (vs the V4a baseline run today).** tsc main + scripts clean; serving, golden-timelines, identity, worktypes,
research, effective pass; worldfx: W2 0.6% (pass), W4 U +0.01 pp / youth −16.5% / firms 20.6% (pass), hiring SOFT ≤ 10%
2027-07-07 (pass, was 07-12), remote work 25% 2027-12-11 (pass), **U +1 pp 2027-12-30 now passes** (was 2028-01-05),
**equity 2026 +20.8% now passes** (was −17.9%), GOV T1 Accept 2027-09-04 (known fail, was 09-09); F7 / F11 2026–27
revenue fail (known, finance). hygiene: only the known perf checks; the 16 → 17 migration passes. calib: all pass (R5 integrated slow 5 d → pass); stub T1
ai2027, fast, slow identical, authors2026 SIAR −0.041 / ASI −0.044 y (was +0.044 / +0.085), all in tolerance; integrated
RefBot (informational) ai2027 SC −0.115 y (was −0.118).

**Readouts and inputs for A2b / A2c.**
- `workUse(s, r)` = { hours, workers, savedPerHour, saved }; per sector `useShareOf(st, sid)`, `st.W`, `useIntensityOf`.
- Workers using AI at work: US ≈ 62M in 2026 (W 39% × 160M), CN + ROW ≈ 0.6 × that rate on 4.6 + 6 × US employment
  (W ≈ 0.24 of ≈1.7B workers ≈ 0.4B). A2c's paid seats (≈50M worldwide mid-2026) are a paid subset of these stocks: most measured work use
  today is not on a paid enterprise plan, so A2c should price seats on W·E and not also bill every hour of use (the sector
  market above already exceeds R22's frontier-lab band before seats and agents; CN's $41–87B is served mostly by Chinese
  labs).
- Assisted hours are the knowledge/agentic "assisted" token profile (100k/15k or 200k/40k per hour); research/22's chat
  use (≈3.75 messages a day) is far lighter, so A2c's intensity term should revisit tokens per assisted hour rather than
  stack on them.
- TFP, labour share and GATE still read A (task adoption) only: the workers' assisted hours save g_aug·(U − A) ≈ 1.4% of
  US hours in 2026 that macro does not count (W2 still passes); a later macro task may add it.
- UI (B3): the World panel shows "Automated A"; add W, U and hours saved per hour with tooltips.

### A2b notes (consumer demand from measured anchors; 2026-11-19)

Code: `data/v2/serving.ts CONSUMER_MKT` (adults, non-work share, reach, paid share, willingness to pay, tokens per
user-day), `worldfx/serving.ts` (`subPrice` capped at the willingness to pay, `paidShareTarget`, `reachTarget`),
`worldfx/mix.ts` (ConsumerMix `paid`, `paidTarget`, `going`; the paid-share stock steps in `advanceCustomers`),
`worldfx/revenue.ts` (subscribers = users × paid share; `regionSubscribers`, `worldSubscribers`; consumer rows carry
`paidTarget`, `needPaid`, `needFree`, `cutFree`), `worldfx/sectors.ts` (reach per region), `worldfx/readouts.ts
consumerUse`. State: `WorldFxState.reach` (per region, replaces `consumerReach`) and `WorldFxState.paid` (per region and
provider); schemaRev 18, migration 17 → 18. Tests: serving C1–C6, worldfx A2b checks, hygiene 17 → 18 migration.

**Mechanism.** Weekly users of provider X in region r = online adults × reach R_r × user share (the V4a logit and its
3-week stock, unchanged) and subscribers = users × paid share P_X,r. Consumer revenue = subscribers × price × 12, with no
term in work hours. Both new quantities are stocks:
- Reach R_r moves at (p + q·R) toward R*_r = row_r · 0.9 · (0.5 + 0.5·c), c the best accessible model's consumer-chat
  coverage (V4a's speed constants; 0.2/yr down).
- Paid share P moves with τ ≈ 8 weeks toward P* = min(0.5, (0.04 + 0.1·a_X) · (p̄ ÷ price_X)). a_X is the provider's own
  consumer-chat coverage and p̄ the going price: users' share-weighted subscription price among plans at or below the
  willingness to pay.
- Price = max(cost, min(markup × cost, wtp $22)). Tiers stay markups over a paying user's serving cost. A plan whose cost
  is above the willingness to pay gets P* = 0, the consumer analogue of the sector cost gate.
- Free users (users − subscribers) need 7.5k/1.5k tokens a day on the product's mini, else its model, and are served last.
- Free serving buys subscribers through the user stock: an unserved need raises the consumer capacity penalty, which
  erodes the user share and with it the subscribers. No separate conversion term was added.

**Choices [D] (sources in the data comments).**
- Non-work share 0.7 [R22 2a–2b]. It is recorded and shown in readouts, and it is why the cap is willingness to pay
  rather than wage × hours saved. It drives no other formula. The 30% work share is the overlap A2c must not double-bill:
  workers' assisted hours W already bill sector work.
- Online adults ROW 2.5B → 3.2B, recalled and not fetched this session. Source: UN WPP 2024 gives ≈ 4.5B adults outside
  China and the US; ITU 2025 gives ≈ 72% of them online.
- US reach starts at 0.46, interpolated from RPS non-work use ≈ 50% in Nov 2025 at +10.4 pp yoy. ROW is 0.85 × the US:
  the leader's ≈ 900M weekly users at a ≈ 0.55–0.6 share of distinct users.
- Ceiling 0.9 and base 0.5: the start model's target is ≈ 0.51.
- Paid share 5.4% for the start frontier model at the going price [R22 2e: 5–6%], 14% at full coverage. Cap 0.5,
  τ 8 weeks.
- Willingness to pay $22, the midpoint of R22's $20–25 ARPU [X].
- Free-user budget 3.75 messages × (2k prompt and context + 0.4k answer) ≈ 9k tokens [R22 2g, §3: 8–20k]. The paid-user
  budget is unchanged at 30k/8k.

**Deviations.**
- (1) The paid share answers to price *relative to the going price*, not to the willingness to pay. The first try used
  (wtp ÷ price)^1. Cost-plus prices under $22 (standard tier $11–17, rivals $7–10, DeepCent $3–8) then tripled the world's
  subscribers to ≈ 290M in 2026 and lifted DeepCent to a 15–20% paid share. The measured share held at 5–6% while plans
  stayed at $20, so only being cheaper than the market converts more.
- (2) Reach depends on quality only. Free use has no price, so the "price" driver of the brief acts on the paid share alone.
- (3) Rivals still price consumer plans at cost-plus (BRIDGE(V7) FLOP per token). In the day-900 fixture DeepCent's plan
  costs $162, above the willingness to pay, so it sells no subscriptions. The old $200 cap had let it bill $728B/yr of
  consumer spend there.
- (4) RefBot gives Chat no free-tier mini, so its free users run on the 1T-active main model.

**Readouts (RefBot, classic, ai2027, seed 2027; before = A2a; reported, not targeted).**

| Quantity | Before | A2b | Anchor |
|---|---|---|---|
| Weekly users, all providers (start / Feb 2026 / end 2026) | 1.10 / 1.16 / 1.41B | 1.37 / 1.48 / 1.73B | leader ≈ 0.9B (15% of world adults) |
| US / ROW reach (Jul 2026) | 0.45 (one value) | 0.53 / 0.45 | US ≈ 0.5 (RPS, Nov 2025) |
| World consumer subscribers (start / Feb 2026 / Jul 2026 / end 2026) | 55 / 58 / 62 / 71M | 87 / 100 / 104 / 129M | ChatGPT alone > 50M (Feb 2026) |
| World paid share (start / mid-2026) | 5% (fixed) | 6.3 / 6.7% | 5–6% |
| World consumer spend (Feb 2026 / end 2026) | $8.4 / 8.3B | $12.8 / 14.6B | leader ≈ $13B/yr at 50M × $22 |
| Consumer leader in 2026 (DeepCent): users / subs, Feb and end 2026 | 468M / 23M, 755M / 38M | 601M / 58M, 923M / 82M | ≈ 900M / 50M |
| Player Chat users (start / Feb 2026 / Jul 2026 / end 2026) | 630 / 71 / 160 / 131M | 782 / 90 / 169 / 158M | |
| Player subscribers (same dates) | 31 / 4 / 8 / 7M | 32 / 3 / 7 / 9M | |
| Player consumer revenue CY2026 | $1.1B | $1.0B | |
| Player free-user serving need ÷ serving pool (start / Feb 2026 / Jul 2026 / end 2026) | 32 / 1.4 / 2.8 / 2.3% | 214 / 9.6 / 15.6 / 14.5% | |
| Player revenue 2026 / 2027 (F7/F11, finance session) | $32.4 / 39.1B | $30.3 / 39.3B | |

- **Done-when, met in part.** By mechanism the 2026 consumer leader holds 58–82M subscribers, inside the brief's
  "≈ 50M-class". It bills ≈ $5–8B/yr, not ≈ $13B: the leader is DeepCent at $7–8 cost-plus plans, not a $22 plan.
- **Why the player is small.** It starts with 59% of the consumer market and 782M users but is capacity-bound. Its pool
  is 348k H100e against 891k of consumer need and 2.5M of sector need. The capacity penalty takes its user share to 0.08
  by Feb 2026, as it did before A2b.
- **Free users.** They now need 5.6× the H100e. They take 120–150k H100e of 2026 serving that A2a lent to research agents;
  golden dates and T1 are unchanged.

**Gate (vs today's A2a baseline).**
- tsc main + scripts clean. golden-timelines, identity, worktypes, research and effective pass, with the same outputs
  apart from numeric noise. products, serving (new C1–C6) and calib all pass.
- calib stub T1 and T1L are identical. Integrated RefBot (informational) ai2027 SC unchanged at −0.115; SIAR −0.063 →
  +0.011 and ASI −0.055 → +0.027.
- hygiene: only the known perf checks fail; the 17 → 18 migration passes.
- worldfx: W2, W4, hiring, AI friend (9.8 → 10.6%), remote work, equity (+20.3%) and the new A2b checks pass. Known
  fails: GOV T1 and F7/F11.
- **New fail: U +1 pp in 12 months, 2027-12-30 → 2028-01-22.** The band ends 2027-12-31; the date passed by 2 days after
  A2a and failed at 2028.01 in V4a. The cause:
  - In 2027 the player's Chat holds ≈ 90% of consumers with consumer-chat coverage ≈ 0.85, so its paid share rises toward
    12% (5% fixed before). Its paid need roughly doubles (146M vs 76M subscribers in Jul 2027).
  - Under Auto, paid consumer work and sector work earn the same per H100e and share the short pool pro rata, so sector
    products lose capacity. The sector capacity penalty then trims the player's sector share, the share-weighted α falls
    by ≈ 0.01, and the late-2027 layoff burst is smaller: pool 1.18M vs 1.53M on day 900, U 5.02 vs 5.21%.
  - Model release days are unchanged to the day until the Atlas-4.0 mini (day 936 vs 932).
  - Left for the lead, who owns the band. Not refitted.
- Reported, not owned:
  - ws4: only the known T3 fails, same as the baseline.
  - finance: the same set of failing checks as the baseline (F2, F7 revenue and valuation, F8, F11), with lower values:
    - F7 2026 revenue median $33.2B → $30.7B;
    - end-2026 valuation $0.63T → $0.48T;
    - F11 2027 revenue $34.2B → $27.1B (12 seeds);
    - F2 40.2M → 40.1M.
  - Why revenue is lower: free users now take serving and capacity-penalty room the capacity-bound RefBot used to give
    to sector work. Rivals and DeepCent earn more consumer revenue (labMarketRevenue) and compete harder.

**Readouts for B1/B2 (UI).**
- Chat card: weekly users (the customer stock) and subscribers with the paid share and its target (`paidTarget`, τ 8
  weeks). Also price per subscriber-month against the willingness to pay ($22, "capped" when it binds), cost per
  subscriber-month and margin.
- Chat serving: need split into paid vs free (`needPaid`, `needFree`) and what the split cut from free users (`cutFree`).
  Tooltip: free users are served last, and unserved users leave, which costs subscribers.
- Market (World or Chat): `consumerUse(s)` per region gives reach and its target, users, subscribers, the market paid
  share, the going price, consumer spend, and the player's users, paid share and target. World totals add messages per
  day and the 0.7 non-work share.
- Glossary: weekly reach, paid share, going price, willingness to pay, free tier.

**Open.**
- The finance targets (finance session).
- U +1 pp now fails (above).
- RefBot sets no free-tier mini (F5).
- Rivals' cost-plus consumer prices sit on BRIDGE(V7).
- Reach and the AI-friend share use the US number for ROW scaled by 0.85; there are no primary ROW reach data.

### A2c notes (who pays for work use, and agent work; 2026-11-20)

Code: `data/v2/serving.ts` (`TOKENS.assisted`, `SEATS`, `AGENT_WORK`; every sector's assisted profile), `worldfx/use.ts`
(`workHoursOf`: adopted / seated / unseated / supervising hours and seats; `seatHoursPerMonth`), `worldfx/serving.ts`
(`Offer` gains k, λ, agent-hour cost and price, seated-hour H100e-hours, seat price; `agentLeverage`, `agentDemandOf`,
`seatTarget`; `adoptedTokens` and `savedPerAdoptedHour` replace `useTokens` and `savedPerUseHour`), `worldfx/mix.ts`
(per provider `agentK`, `agentPrices`, `seatPrices`, going `seatPrice`), `worldfx/sectors.ts` (seat stock),
`worldfx/revenue.ts` (three billed streams, need segments in serving order, `sectorSpendParts`,
`providerSectorRevenue`, `labMarketRevenue` with seats and agents), `worldfx/readouts.ts workBilling`. State:
`SectorState.seat`; schemaRev 19, migration 18 → 19 (σ at the region's start share). Tests: serving B1–B7, worldfx A2c
checks and INFO, hygiene 18 → 19 migration; serving S2 and products P6 updated to the new rule (below).

**Mechanism.** Hours of use U·E0·2000 (A2a, unchanged) are split by who pays:
- **Adopted A-hours** (A, tasks firms handed to AI): billed per hour at the provider's cost-plus price, as V4a. Tokens
  per A-hour = α·autonomous + (1 − α)·assisted with the substitution share α (was α_use over all hours of use); value
  per A-hour = wage × (α + (1 − α)·g_aug). The cost gate K and the logit read this price.
- **Seated hours**: the assisted hours h·(W − A) of the share σ of AI-using workers with a paid seat. σ is a stock per
  sector and region, dσ/dt = q·σ·(σ* − σ)/σ* × DiffMult, σ* = K_seat·(1 − R), K_seat = σ(ln(value ÷ seat price)/0.7)
  with value = a seat-holder's assisted hours a month × wage × g_aug. Seats = σ·W·E; revenue seats × price × 12. Seats
  are sold by Enterprise (Gov in GOV/MIL); open weights sell none (in-house).
- **Unseated hours** (1 − σ of the assisted hours): free tiers, bundled assistants, in-house models. Billed by no one in
  the sector market and no sector serving need: they run on the users' consumer apps, whose tokens A2b already counts
  (the work share 0.3 of consumer chat). Cross-check: consumer tokens × 0.3 ÷ unseated hours ≈ 15k tokens per unseated
  hour, a light chat profile.
- **Agent-hours**: k agent work-hours per supervising hour ((1 − α)·A-hours + seated hours), on the autonomous profile,
  billed per hour at cost-plus and capped at the wage. k = a·λ·gate per provider: a its coverage of the sector's work
  (V3's work-type function), λ = 1/(c/h80 + ρ·(1 − a) + m) agent-hours one supervising hour sustains (check-in c per
  autonomous stretch h80 = h50/5, GDPval review ρ = 0.27 on the work it cannot do alone, floor m), gate =
  σ(ln(wage ÷ (price + wage/λ))/0.7). Agent-hours go to API (1), Agents (1.5 × p(AGENT_TASK_HOURS | h50): the Agents
  horizon gate's task length on the METR curve) and Enterprise usage beyond the seat (0.5). They add spend, tokens and
  serving need, never human hours, displacement or TFP.
- Serving: a sector product's seated hours are a need segment served before its per-hour work (seat revenue earns more
  per H100e); revenue fills the served H100e in segment order; capacity = what the served H100e earn in that order.

**Choices [D].**
- Assisted hour 30k/8k tokens: 10 reasoning turns of R20 D2's 3k/0.8k, the paying consumer's daily budget in one hour of
  work. It replaces 100k/15k (knowledge) and 200k/40k (agentic, Software and Science), 3–7× research/22's chat use. The
  heavy users are the agent term.
- Seats: list $25 per seat-month (R22: Claude Enterprise $20 plus usage, Team $25, ChatGPT Business $25–30, M365 Copilot
  $30) × the markup relative to standard (budget 0.67, premium 1.6; DeepCent 0.67), never below the seat's serving cost
  ($4.4 a seat-month at the start). q = 1.5/yr from M365 Copilot's ×2 per half-year (15M → 30M, Jan → Jul 2026). The
  sectors' own Bass q gave ×1.3 per half-year. Start σ0 US 0.12, ROW 0.045, CN 0.02: ≈ 30M paid seats outside China in
  Jan–Feb 2026 (M365 15M, ChatGPT > 7M, Gemini > 8M), back-cast at the simulated growth to ≈ 18M in Jul 2025. Decline
  0.5/yr above σ*.
- Agent work: c = 15 min (write and hand off a task; no primary source), m = 0.02 h (λ ≤ 50). The channel weights are
  [D]. Constants were not tuned to revenue.

**Deviations.**
- (1) Seat growth uses its own q (above), not the sector Bass q that A and W use. The sector Bass q could not reach the
  measured doubling.
- (2) The agent-term growth comes from horizon and coverage, with no separate "intensity" constant. The reasoning-token
  growth (OpenAI ×320 per organisation) is not modelled beyond the product effort setting.
- (3) Serving test S2 now asserts $ per H100e fixed only for products without seats. Product test P6 now asserts "seats
  first, then per-hour work pro rata". Both old assertions described the one-segment rule this task replaces.

**Readouts (RefBot, classic, ai2027, seed 2027; before = A2b; reported, not fitted).**

| Quantity | Before | A2c | Anchor (research/22) |
|---|---|---|---|
| CY2026 non-China frontier-lab revenue (player actual + closed rivals' demand-side) | $100.9B (30.3 + 70.6) | **$72.3B** (34.2 + 38.1) | $100–130B |
| Leader (player) CY2026 revenue and share of that | $30.3B, 30% | $34.2B, 47% | ≈ $55B, second lab ≈ 0.7× |
| Paid seats ex-CN, Jul 2025 / Jan 2026 / Jul 2026 / end 2026 (player, world) | — | 17 / 28 / 44 / 57M (player 11 / 12 / 22 / 27M) | ≈ 30M Jan–Feb 2026, ≥ 50M mid-2026 |
| Hours of use, Jan 2026: billed per hour / seat / unbilled | 145B / 0 / 0 | 35B / 9B / 101B | most work use unpaid |
| Same, Jul 2026 | 166B / 0 / 0 | 56B / 17B / 95B | |
| Agent-hours a year (per supervising hour), Jan / Jul / Dec 2026 | — | 1.9B (0.06) / 15.9B (0.29) / 68.5B (0.75) | |
| World spend mid-2026: per-hour adopted / agents / seats / consumer | $155B (all hours) + $9.7B | $48B / $37B / $13.5B / ≈ $10B | US enterprise genAI $37B (2025) |
| FLOP-bearing tokens a day, start / Jan 2026 / mid-2026 / end 2026 | 70 / 77 / 91 / 122T | 26 / 34 / 63 / 152T (×4.5 over 2026) | Google API 10 → 46T/day processed (×4.6/yr) |
| Player serving need vs pool, start | 3.35M vs 348k | 1.44M vs 348k (Chat free users 741k) | |
| Same, mid-2026 / end 2026 | 0.97M vs 0.97M (share already eroded) | 1.55M vs 1.04M / 2.7M vs 0.97M | |

- **Band missed (reported, not forced).** CY2026 lands at $72B, not $100–130B. The mechanism's dynamics match
  research/22 §7: tokens ×4.5 over 2026 (Google API ×4.6/yr), seats ×2 per half-year early on, agent-hours ×35 in 2026
  against human hours ×1.15. The level is low by ≈ 1.5×, for four reasons:
  - H1 2026 is flat ($63B → $68B demand-side) because RefBot keeps Atlas-1.0 on its products until Apr 2026. The exit
    run-rate is ≈ $213B demand-side (player $145B demand, capacity-bound at $34B).
  - The US is small next to ROW: mid-2026 US spend $16B/yr vs ROW $55B (A2a's regional scale, [D]).
  - DeepCent's open weights reach ≈ 30% of US and ROW sector shares by end 2026. That use is in-house and unbilled.
  - Agent leverage in Software (k ≈ 0.5–1.2) is ≈ 2× below Claude Code's ≈ $3–6 per developer-hour.
  Lowering c or raising the channel weights would reach the band, but that would be fitting to revenue.
- **Start fleet.** A 348k-H100e serving pool (1.2M online) for the leader in mid-2025 is realistic: Anthropic's FY2025
  compute and infrastructure cost $7.3B, ≈ 0.4M H100e-years at $2/h incl. training (R22 §4), and OpenAI is ≈ 2×. The
  demand units were the problem. FLOP-bearing tokens fell from 70T to 26T a day, in line with the disclosed volumes
  (≈ 60T/day processed in late 2025 incl. cache reads: Google all surfaces 43T, OpenAI API 8.6T, ChatGPT ≈ 6T).
  - The remaining start gap (need 4× the pool) is FLOP per token: every product serves the 1T-active start model.
    RefBot sets no free-tier mini, so Chat's free users alone need 741k H100e.
  - Real traffic runs mostly on far smaller models. That is model design and the RefBot mini choice (F5), not demand.
    Compute is unchanged.

**Brief item 4 (re-checked, bands not refitted).**
- W2 TFP 0.6%: pass.
- U +1 pp in 12 months: 2028-01-22 → 2028-01-02. Still a fail, 2 days past the band's end of 2027-12-31.
- GOV T1 Accept ≥ 0.85: 2027-09-04 → 2027-08-31. Known fail; the band opens 2027-09-15.

**Gate (vs today's A2b baseline).**
- tsc main + scripts clean.
- These suites pass: serving (S1–S7, C1–C6, B1–B7), products, golden-timelines (identical), identity, effective,
  research, worktypes, fixtures, lint-*, money, idle.
- calib passes:
  - Stub T1: ai2027, fast and slow identical; authors2026 ASI 2033.600 → 2033.608.
  - T1L: identical.
  - Integrated RefBot (informational): ai2027 SC −0.115 → −0.123.
- hygiene: only perf fails (2 vs 3 in the baseline); the 18 → 19 migration passes.
- safety: S5 known. ws4: T3 known.
- finance (12 seeds):
  - F7 2026 revenue median $30.7B → $32.3B; valuation $0.48T → $0.46T.
  - F11 2027 $27.1B → $41.4B (still fails).
  - F2 40.1M → 46.9M: **now passes**.
  - F8 out of distress 8.3% → 91.7%: **now passes**.
- worldfx:
  - Known fails: F7/F11 ($34.2B / $40.7B), GOV T1, U +1 pp (above).
  - **Equity 2026 +20.3% → −0.4% now fails.** It is on the known list as finance-owned. Cause: a stochastic
    capital-market bust on day 457. The bust probability rises with bubbleX = commitments ÷ the labs' run-rate, and the
    rivals' run-rates (labMarketRevenue) are lower now that unseated hours are unbilled. Fear +0.4 then cuts the P/E.
  - New A2c checks pass: seats ≈ 30M / ≈ 50M; tokens ×3–8 over 2026 with k rising.

**Readouts for B1–B3 (UI).**
- Product card (sector products), from `DeploymentRevenue`:
  - adoptedHours and agentHours, i.e. `hours` billed per hour, with cost and price per billed hour;
  - seats, seatPrice, seatCost per seat-month, seatDemand ($B/yr);
  - needSeat, the seated hours' serving need, served first.
  - Tooltip: seats are served before per-hour work; agent-hours never add human hours.
- Per sector (B3), from `mix.sec[r][s]` and `workHoursOf`:
  - `agentK` (agent-hours per supervising hour after the buyer's gate), `agentPrices`, `seatPrices`, the going
    `seatPrice`;
  - the seat stock σ (`SectorState.seat`) and its target `seatTarget(...)`;
  - adopted / seated / unseated / supervising hours and seats.
- World: `workBilling(s)` per region and world gives:
  - hours by who pays and agent-hours;
  - seats sold and the workers using AI;
  - spend by stream;
  - tokens a day by stream plus consumer tokens;
  - the player's seats.
- Glossary: paid seat, unseated (free / bundled / in-house) use, supervising hour, agent-hour, agent leverage λ.

**Open.**
- The non-China revenue band (above). The pieces are regional scale (A2a), DeepCent open-weights share (BRIDGE(V7),
  F2), RefBot's late product upgrade (F5) and the agent constant c (no source).
- Takeoff: at day 900, k ≈ 12 and agent-hours are 695B/yr at wage-capped prices. Rivals' oversized FLOP per token
  (BRIDGE(V7)) makes demand-side agent spend ≈ $31T/yr, and `labMarketRevenue` feeds that into rival finance. A
  demand ceiling on agent output (Jevons, η) may be needed once rivals have real designs.
- Fixture day 900 shows 3M seats sold: migrated from schemaRev 16 at σ0, with most of its share on open weights.
- U +1 pp, GOV T1, and equity 2026 (the bust roll).

### B1 notes (product card: serving economics; 2026-11-20)

Code: `ui/v2/panels/Products.tsx` (new `Econ` block: `PriceRow`, `SourcesRow` / `PaidRow`, `CapacityRow`; Chat customers
row; settings layout), `products.css`, `worldfx/productView.ts` (`ProductRead.markup`, `ProductRead.econ: ProductEcon`,
`goingPrice` selector), `worldfx/revenue.ts` (readout-only fields `adoptedDemand`, `agentDemand`: the demand split of the
per-hour streams; no mechanism change, no state change, no schema bump), glossary (+14 terms), `limits.ts`
(`price.valueCap` rule text), `lint-ux.ts` REQUIRED, `uitest.mjs` (B1 checks).

**What the card shows (L2 rows, L3 tooltips).** Under the revenue hero, three rows:
- **Price**: price per hour of use (sector products, blended over adopted task-hours and agent-hours) or per
  subscriber-month (Chat), a bar of cost vs margin (Chat: a tick at the $22 willingness to pay), the margin %. When the
  cap binds (Chat at $22, or > 5% of a sector product's sales at the value cap) the bar turns amber and a
  `price.valueCap` limit chip shows. Tooltip: cost, tier as a markup (×1.67 / ×2.5 / ×4 and the price it asks), margin,
  per adopted task-hour and per agent-hour, share sold at the value cap; Chat: willingness to pay and the going price.
- **Sources** (sector products): stacked bar of demand by source (per-hour work, agent-hours, paid seats) with a legend;
  tooltip: hours × price per stream, seats × seat price, serving cost per seat-month. **Paid** (Chat): paid share vs its
  target (tick) and the target; tooltip: subscribers, price vs going price, subscription revenue. The Chat customers row
  now reads "weekly users · paying" (stock users, not revenue ÷ ARPU).
- **Served**: the product's serving need in serve order (seats then per-hour work; paying then free users), the cut
  hatched red, % served. Tooltip: hours asked vs servable (sector), need by segment in H100e, the cut split free / paying,
  and the serve-order rule (free users last, unserved users leave and cost subscribers; seats before per-hour work).

**Choices [D].**
- One home: cost → price moved out of the run-cost tooltip into the Price row. The binding chip keeps its H100e
  breakdown (the "why" of the bound); the Served row is the home of the paid/free and seat/work split.
- Settings take less height to make room: Retire moved to the Settings caption line, KYC on its own row, compact tier
  buttons (no label-only lines). Net card height +30 px at day 400.
- Colours: sources gold / teal / grey (no blue–violet pair); cut = red hatch.

**Removed text.** Glossary `revPerH100e` (M^0.3, serve cost), `priceTier` (×0.7/×1.4, price^−1.5), `priceIndex`,
`priceBound`, `effort` (1.6× revenue), `freeTier` (60% of use), `monitor` (serve cost → FLOP per token); the effort and
mini tooltips on the card; the `price.valueCap` limit's $200 subscription cap. Left for B4: the Blueprint and Models
"serve cost" readouts and the `serveCost` glossary entry (design readout, still bridged for the safety fleet, V6).

**Gate.** tsc main + scripts clean; build clean; lint-ux green (211 → 224 required terms); products pass; `test:ui`
265 passed, 0 failed (new: B1 card checks at day 1, 400, 900; every economics row opens a tooltip; all 14 new terms
reached on the cards; a Premium Chat plan shows the $22 cap). Screenshots looked at: `scripts/v2/shots/25-day1-products.png`,
`26-day1-chat-capped.png`, `20-day400-products.png`, `30-day900-products.png`.

**Seen in the screenshots (reported, not fixed here).** At day 900 the value cap does not bind on any player product
(V4a saw 97%; A2c's prices moved it). The Agents launch card has empty space below its gate (B4's empty-space pass).
The serving card now starts lower and is partly below the fold at 1000 px height (the panel scrolls).

### B2 notes (product card: customers as a stock, typed features; 2026-11-20)

Code: `worldfx/productView.ts` (output-only: `ProductRead.cust: CustomerView` from the mix's per-(region, segment) stock
and logit target, `CONVERGED`, `featureView(f, channel)`), `ui/v2/panels/Products.tsx` (`Customers` block replaces the
Share block and the customers row; `FeatureRow` two-line rows, `FeatureTip`), `products.css`, glossary (+7 terms, 3
rewritten), `lint-ux.ts` REQUIRED, `uitest.mjs` (B2 checks). No mechanism change, no state change, no schema bump.

**Customers (L2 block, L3 tooltips).** One block, the home of the customer stock:
- **You** bar = the stock (the player's share of the segment's spend, all its products: the same quantity the old Share
  row showed, so that row is gone), a white tick at the target, "13% → 7%" (green up, red down); best rival bar below.
  Tooltip: target share, best rival, this product's demand, the four segments with the largest weighted gap
  (region · sector, stock → target).
- **Chat**: "216M weekly users → 171M" (users at the target share = users × Σ users_r·target_r ÷ Σ users_r·stock_r).
  Tooltip: users at target, paying, free.
- **Speed line**: "moves in weeks / months / quarters · ~N d to target" (or "at target", "> 3 yr"). Tooltip: τ per speed
  class with its spend weight (sector products: 3 mo, GOV/MIL 9 mo), now → target, the "reached" rule.
- **Edit preview**: "Target share" before → after replaces the revenue ÷ ARPU customers row (the stock does not move at
  once; the target does). Chat also "Users at target".

**Features (two-line rows).** Line 1: status icon, name, control (toggle / Build with cash / building ETA / lock + type
chips). Line 2: type chip(s) (DoorOpen enabler, Ruler horizon, Blocks scaffold, BrainCog effort; word shown when there is
one type), the short typed effect for this product ("+0.3 OOM ×2 tok", "×1.3 longer tasks", "+15% work", "+0.24 OOM ×4
tok", "+0.42 OOM per pack"), a Bot icon when it also helps the internal agents, "on/off" when built; locked rows: "needs
<idea>". Tooltip: each typed effect with scope and token multiplier (effects that do not act on this product marked),
build (team-weeks, cash), upkeep, on this product, internal agents (work types), unlocked by (idea, known or not), risk.

**Choices [D].**
- "At target" = spend-weighted |target − stock| ≤ 0.5 pp; days by bisection on Σ w·|gap|·e^(−t/τ), assuming the target
  holds (said in the tooltip footer).
- Speed words by the largest-weight τ: < 60 d weeks, < 180 d months, else quarters.
- Feature effects are shown for the product's market: Chat sells only to consumers, the others only to sectors, so a
  Chat-user enabler is "(not on this product)" on Enterprise.
- Upkeep: features have no engineering upkeep in the engine (only products, monitors, runs); the row says so, and names
  the serving token multiplier as the running cost.
- Team-weeks moved off the row to the tooltip and the Build button's preview (room for the effect line).

**Removed text.** Glossary `feature` (appeal / domain level / sector level), `sectorPack` and `sectorProduct` "+0.5
levels" (now +0.42 OOM of fit); the card's "Revenue ÷ about $X a year per customer" row.

**Gate.** tsc main + scripts clean; build clean; lint-ux green (224 → 231 required terms); products and serving pass;
`test:ui` 285 passed, 0 failed (new: B2 checks at day 1, 400, 900 — stock → target, speed and days on every card,
customer-row tooltips, type and typed effect with units on every feature row, locked rows name the idea, no clipped
feature text, feature tooltips carry build/upkeep/on here/internal/gate, all 7 terms reached; the edit preview shows the
target share). Screenshots looked at: `scripts/v2/shots/25-day1-products.png`, `27-day400-products-b2.png`,
`28-day900-products-b2.png`, plus tooltip captures (customers, speed, Memory, Coding agent, Deep think).

**Seen / open (reported, not fixed here).**
- `ProductRead.customers` (revenue ÷ ARPU) still feeds the top-strip revenue tooltip and the Core loop's customers node:
  sector products have no real customer count (only seats for Enterprise/Gov); F6 or B4 should switch those to the
  stock share.
- Voice & vision's +15% Media work enabler can never act: the feature is offered only on Chat, which sells no sector
  work (data issue for the lead).
- The player-level stock and target: a tier change on one product moves the target only if that product is the
  player's best offer in a sector (day 1: API premium leaves the target at 47.5% since Enterprise is the better offer).
- Cards are ≈ 50 px taller (two-line feature rows); the serving card starts lower (panel scrolls).

### B3 notes (World › Sectors: demand and serving economics per sector; 2026-11-20)

Code: new `worldfx/sectorView.ts` (`sectorsView(s)`: per region and sector a `SectorRead`, plus the region's work totals
from `workUse` and `workBilling`; exported from `core/selectors.ts`), `data/v2/sectors.ts` (`USE_ANCHORS`,
`USE_ANCHOR_US`, `USE_ANCHOR_SRC`: RPS survey rows, display only), new `ui/v2/panels/WorldSectors.tsx` + `world.css`,
`World.tsx` (tabs Sectors / Jobs & control), glossary (+8 terms, 4 rewritten), `limits.ts` (moonshot limit home tab),
`lint-ux.ts` REQUIRED, `uitest.mjs` (B3 checks). Output-only: no mechanism change, no state change, no schema bump.

**Layout (good-ui levels).** The World panel now has two tabs; the macro strip stays above both.
- **L1, Sectors tab:** a region strip (US / CN / ROW switch; workers using AI, hours of use as % of work-hours, hours
  saved per hour, paid seats, agent-hours a year), and the sector heatmap (14 × 3) with a metric switch: hours of use
  (default), automated A, your share. A cell click selects the sector and region.
- **L2, sector card** (the home of every per-(sector, region) datum below):
  - header: work-type chip (top domain icons, task length, verifiability) and the binding limit chip;
  - Adoption: workers using AI W (tick W*), hours of use U (diamond = the survey anchor where research/22 has one),
    automated A (tick A*), hours saved per hour of use and the wage;
  - Limits: F, K, 1 − R tiles with bars, the binding one amber (none when diffusion binds);
  - Who pays: hours of use by payer (per hour / seats / unseated) as a stacked bar, agent-hours and agent-hours per
    supervising hour, paid seat share σ → target;
  - Providers: per provider share → target, coverage, and the cost of an AI work-hour (price ÷ hours saved, hatched
    review) as a bar against a wage tick. The player's row is the per-sector "your share"; a `customerStock` ref chip
    jumps to Products for the per-product detail (B2 is the home of the product's stock and target).
- **L3, tooltips:** work type (domain weights, PHYS share, task length, verifiability, horizon domain, median
  professional θ vs the best offer's fit, tokens per adopted / assisted / agent hour, α); each adoption row (target,
  firm adoption, U = A + h·(W − A) split, survey row with source); each limit (F: cognitive coverage, robot-bound PHYS
  part, top providers' coverage; K: mix cost vs wage, providers' gates; R); hours and spend by stream; per provider the
  price chain (price per adopted task-hour ÷ hours saved + review = cost vs wage), gate, agent k and price, seat price.
- **Jobs & control tab:** the previous jobs, control index and world technologies, unchanged (jobs and control now side
  by side).

**Choices [D].**
- Survey anchors: RPS industry rows mapped as A2a's `use` constants (information → Software and Media 14.0% of hours,
  2024; professional/scientific/technical → Legal and Science 11.4%, Q2 2026 [R]; finance 9.7% [R]; production
  occupations → Manufacturing 4.6% [R]; leisure → Retail & services 2.3%, 2024). US only; CN and ROW say no survey.
- The cost of an AI work-hour per provider is the mix's buyer cost (price ÷ hours saved per adopted hour + 0.27 × wage
  × (1 − coverage)); its gate is the per-provider K term. Rivals' cost is flagged as estimated from capability (BRIDGE V7).
- Heatmap default is hours of use (the measured quantity); "Your share" is the player's customer stock.
- Removed text: the World heatmap's tooltip pile (F "share AI can do", employment), glossary `sector` (F as "share AI can
  technically do"), `binding` (now names F, K, 1 − R), `firmAdoption` ("by employment": it is firm-weighted, BTOS), and
  `sectorA` now separates A from workers' use. The World panel had no α/g_aug, cost-curve or 26%-capture text left.

**Gate.** tsc main + scripts clean; build clean; lint-ux green (231 → 241 required terms); lint-hidden, lint-structure,
serving pass; `test:ui` 325 passed, 0 failed (new B3 checks at day 1, 400 and 900: strip, card values equal to the
state, binding highlight, who pays, providers, no clipped numbers, 18 row tooltips, work-type and cost-gate tooltip
content, US Software survey anchor, cell selection, metric switch; all 10 terms reached). Screenshots looked at:
`scripts/v2/shots/29-day1-world-sectors.png`, `29-day400-world-sectors.png`, `29-day900-world-sectors.png`,
`20-day400-world-society.png`, plus tooltip captures (hours of use, provider, who pays, work type, cost gate).

**Seen / open (reported, not fixed here).**
- Paid seat share shows 12% → 94% (US Software) on every fixture: the day-400/900 fixtures were migrated to σ0 and the
  US target is high; a fresh day-1 game starts at σ0 too.
- Day 900: China's open-weights cost of an AI work-hour is $60 vs the wage $66 (K binds at 54%) from the rivals'
  oversized FLOP per token (BRIDGE(V7)); the view shows it honestly.
- About 250 px of empty space under the Sectors tab at 1000 px height (both columns end near 700 px); nothing was
  added to fill it.
