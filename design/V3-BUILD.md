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

### B4 notes (UI leftovers of the model-v3 rebuild; 2026-11-20)

Code: `ui/v2/shell/selectors.ts` (`customerCount`, `customerShare`), `TopStrip.tsx`, `CoreLoop.tsx`, `Blueprint.tsx`
(serving tile and card effects), `Models.tsx` (model card), `fmt.ts` (`usd`, `sci`), `ResearchProjects.tsx` (+ `research.css`),
`Products.tsx` (+ `products.css`), `World.tsx` / `WorldSectors.tsx` (+ `world.css`), `work.css`, `shell/AlertQueue.tsx`
(`logRoute`, `openRoute`), `DecisionModal.tsx`, `ui.tsx` (`ActBtn ariaLabel`); engine output-only selectors
`worldfx/serving.ts useHourCost`, `index.ts runCard().fpt` (`planFpt`), `flopPerToken` exported; the auto setting:
`types.ts ResearchState.wantAuto`, `models/research.ts` (`wantIsAuto`, assignment passes 1 and 3), `treeActions.ts`
(`research.want {auto}`), `researchView.ts` (`CapProjectView.auto`), `data/v2/research.ts AUTO_RANK_W`, `core/save.ts`
(**schemaRev 20**, migration 19 → 20); glossary (+2: `useHourCost`, `teamsWantedAuto`; `serveCost` removed; 9 rewritten);
`lint-ux.ts` (check 4); tests `research.ts` (auto), `hygiene.ts` (19 → 20 migration), `uitest.mjs` (B4 checks).

**1. Customer counts.** `ProductRead.customers` (revenue ÷ ARPU) and `ProductDef.customers/arpu` are gone. The top-strip
revenue tooltip and the Core loop's Customers node read: Chat "N weekly users · M paying" (the stock users and the
subscribers), a sector product with seats "N paid seats", any other sector product (API, Agents without seats, Trusted)
its customer stock "share x% → target y%" (no count exists). The Core loop node adds the share → target and the best
rival on every row; its term is now `customerStock`.

**2. Removed concepts.** Blueprint's Serving tile: FLOP per token (hero, `FLOP/tok`), "$/h · today $/h" (cost per hour
of use of this design vs the internal model; bar and tone from the FLOP-per-token ratio), tooltip with cost per hour of
use (assisted hour 30k/8k tokens), per agent-hour (375k/62k) and $ per H100e-hour; the card rows' "Serve" column is the
FLOP-per-token ratio to the reference card. Models card: "Serving 3.6e12 FLOP/tok · $0.19/h". The plan's FLOP per
token (`runCard().fpt`) is what `fptOfBuild` will set on the version: base = 2·N·shape token multiplier; post-train =
the base's × (plan serve ÷ base serve); distillation = the teacher's × (plan serve ÷ teacher serve): the relative serve
cost is only used as that bridge. Glossary `serveCost` removed; `servingFlop`, `agentMonitor` (FLOP-per-token ratio),
`autoServing` (need from asked hours at the model's FLOP per token, serve order) rewritten; "know-how" text → recipe in
`poolResearch`, `baseRun`, `stream`, `coreLoop`, `diffusion`, `staleness`. No M^0.3, research-speed cap, 26% capture or
"+0.5 L" text was left in the UI. New lint (`lint-ux` check 4): glossary titles and bodies, limit titles and rules, and
non-comment UI source lines may not contain serve cost / `serveCost`, M^0.3, research-speed cap / `revenue.speedCap`,
price capture / 26% of the wage, "+0.5 L", know-how, "× frontier".

**3. Layout (no new information).**
- Products: with ≤ 3 products the launch card and the serving split share a column beside the cards (cards 250–300 px);
  the launch card no longer stretches to the cards' height and the serving split moves from below the fold (y ≈ 940)
  to y ≈ 340. With 4+ products the old layout (launch card in the grid, serving below) stays.
- Research › Projects: the list is full width and the selected project's card sits under it with its sections side
  by side (auto-fit columns ≥ 300 px); name and stage columns share the extra width.
- World: the Jobs section moved under the sector heatmap (the left column ended 250 px above the card's end); the
  second tab is now "Control & tech" (control index full width, world technologies, moonshot).
- Company › Work: tightened only (role cards equal height, milestone boxes no longer stretch); nothing else belongs
  there, about 220 px stays empty at 1000 px height.

**4. Auto teams wanted [D].** It could not be expressed with 0–6 (a fixed number does not follow the team count), so
`ResearchState.wantAuto: string[]` (schemaRev 20; the migration starts it empty; no change for existing games or bots).
An auto project asks for one team in the first pass down the list; after the fixed numbers and the swap pass, each spare
team goes to the auto project where it adds the most progress, √(capacity + its capacity) − √capacity over the ideation
effort (so a specialty ×1.5 counts), × AUTO_RANK_W = 0.8 per place down the list; with no auto project, spares join the
top project as before. Action `research.want {id, auto: true}`; any number turns auto off. UI: an Auto toggle after the
stepper (aria-pressed; "N auto" shows the placed teams; − / + fix the number at placed ∓ 1), tooltip and glossary
`teamsWantedAuto`. Keyboard: rows are focusable (Tab), Enter opens the card, Alt+↑ / Alt+↓ reorder; ▲▼ have tooltips
and aria-labels, the − + Auto buttons aria-labels (`ActBtn ariaLabel`).

**5. Log routing.** `logRoute(s, entry)`: `research` entries whose ref is a capability project open Research › Projects
on its card; those about a run, base or version open Models; the rest stay on Safety. The alert list groups by route
(a capability result no longer merges into a safety group) and the high-severity notice's tag and "Open panel" use it.

**Gate.** tsc main + scripts clean; build clean; lint-ux green (241 → 243 required terms, new check 4); lint-structure,
lint-hidden, lint-tradeoffs, research (4 new auto checks), identity, golden-timelines, worktypes, products, serving, idle
pass; hygiene passes except the known perf checks (P2), incl. the new 19 → 20 migration check; `test:ui` 376 passed,
0 failed (new B4 checks at day 1, 400, 900: revenue tooltip and Core loop counts, serving tile and tooltip, no "serve
cost", products side column above the fold, project card under the list with no clipped stepper, auto on/off with its
tooltip, labels on ▲▼ − + Auto, Alt+↓ / Alt+↑ reorder, jobs under the heatmap, log routing and Open). Screenshots looked
at: `80-day400-products-b4`, `81-day400/900-research-projects-b4`, `82-day900-world-sectors-b4`, `20-day400-company-work`,
`20-day400-world-society`, `20-day400-blueprint`, `20-day400-models`, `73-hover-revenue`.

**Seen / open.**
- The Work tab and the Products side column still end ≈ 220–450 px above the bottom at 1000 px; nothing existing
  belongs there.
- The Models card's "Research boost ±x mo" is the V1 design offset (months of research), not know-how months; D3
  retires design offsets.
- Science-team "why" lines on the project card are cut with an ellipsis (the team dots' tooltips carry the full text).
- Space on a focused button both clicks it and toggles pause (the global shortcut; older than B4).

### C2 notes (feature data and feature upkeep; 2026-11-20)

Code: `data/v2/features.ts` (two product lists), `departments/build.ts` (`UPKEEP.featureYr`, `UPKEEP.featureIdle`,
`featureUpkeepTW`, `featureInternal`, `featureInUse`, 'feature' upkeep lines), `worldfx/productView.ts`
(`FeatureView.upkeepTW` / `idleTW`), `ui/v2/panels/Products.tsx` (feature tooltip Upkeep row), `BuildLoad.tsx` (feature
lines in the load tooltip), glossary `productUpkeep` and `engNeeds`, tests in `scripts/v2/products.ts` (C2a–C2c) and
`uitest.mjs` (the B2 feature-tooltip check now asks for "N.NN engineer team-wk/wk"). No state change, no schema bump.

**Data fix [D].**
- Voice & vision: offered on Chat **and the API** (was Chat only). §7.2 lists "image & video generation" as a *task
  enabler* that opens work types or segments, so its Media part is right as typed; it only lacked a product that sells
  sector work. The API is where image, voice and video generation are sold to media firms. Retyping it as consumer
  appeal would have dropped the Media segment, which §7.2 names. On Chat it keeps +15% Chat users.
- Deep research: off Chat (now Enterprise only). The same check found its scaffold (Science, Finance, Legal, internal
  research) cannot act on Chat, which sells only consumer chat; giving it a CHAT scope would put ×3 tokens on all chat
  use (a calibration change), so the offer was removed instead. No start type has it on Chat.
- Every other feature passes: Memory (horizon on all work; Chat users), Deep think (effort, everywhere), Computer use
  (Admin/Finance/Legal/Government on API and Agents), Coding agent (Software & IT), Companion (Chat users), Sector packs
  (sector products).
- Test C2a uses the engine's own functions (`fxOn`, `enablerShare` on 'CHAT' or the sectors the product sells to; gov
  only GOV/MIL): each (feature, product it is offered on) has an acting effect; each typed effect acts on one of its
  products (an enabler's Chat and sector parts counted apart, which is what catches the old Voice & vision); the card's
  "here" flag agrees. C2b: Voice & vision on the API raises its demand (day 3: 12.309 → 12.432).

**Upkeep rule [D].** A built feature in use costs `0.5 × buildTW ÷ 52` team-weeks per week (half its build effort a
year, the usual order of software maintenance), charged on the engineers' **upkeep** need beside products and monitors.
Built but in use nowhere: a keep-alive of a tenth of that. "In use" = switched on for a live product that offers it, or
a scaffold / horizon extender acting on an internal work type (those help the internal agents once built,
`serving.ts internalFx`, so they are always in use: Memory, Deep research, Coding agent). Numbers in use / off: Memory
0.115 / 0.115, Deep think 0.077 / 0.008, Computer use 0.154 / 0.015, Voice & vision 0.115 / 0.012, Deep research 0.077
/ 0.077, Coding agent 0.115 / 0.115, Companion 0.038 / 0.004, Sector packs 0 (each pack is its own 4 team-week build).
All seven together ≈ 0.69 team-weeks a week, about one product's base upkeep plus a third, small next to a $10B product
(1.8). The feature tooltip's Upkeep row shows "N.NN engineer team-wk/wk (N.NN while off everywhere)" plus the serving
token multiplier; the build-load tooltip lists "Feature X" lines (marked "off: keep-alive").

**Start types (V3b check).** Still carry their upkeep plus a base run setup in the first quarter (worktypes): leader 7.8 −
5.5 t-wk/wk (sector packs only: no feature upkeep), challenger 6.3 − 4.0 (Coding agent +0.115), bigtech 9.0 − 3.2
(Voice & vision +0.115), spinout 1.2 − 0.8 (no features). No team change.

**Gate.** tsc main + scripts clean; products (C2 checks), serving, golden-timelines, identity, worktypes, research,
effective, calib (T1 known WARN slow A2 unchanged), lint-ux all pass; test:ui 376 passed, 0 failed.

**Seen / open.** Old saves with Deep research switched on Chat keep the id in `Deployment.features`; it is inert there
(`activeFeatures` filters by the offer) and costs no upkeep on that product. RefBot builds no features, so calibration is
untouched by the upkeep.

### P2 notes (daily-tick performance pass; 2026-11-20)

**Rule.** No behaviour change: no cadence, rounding or approximation changes. Proof: `.p2tmp` hash script (stable-key
JSON of the full state, SHA-256, every 50 days) on 4 runs (passive seed 9 to day 1500 / ousted day 731; passive seed 9
with the leader lab, endings skipped, 1500 days; RefBot seed 3 authors2026 3 rivals with the reference-compute stub,
600 days; RefBot seed 5 sampled world with real finance, 600 days): identical after every step. `fixtures.ts`
regenerates byte-identical fixtures to the pre-P2 code (the committed fixture files are older, schemaRev 16, so the
test rewrites them either way; restored).

**Profiler.** `scripts/v2/profile.ts [days] [reps]`: hygiene's two perf games and a RefBot game, µs per system per live
day (each system's run wrapped), daily average and worst quarter tick. Hot functions: `node --cpu-prof --import tsx`;
for line numbers bundle with esbuild first (tsx output is one line per module). tsx adds `__name(...)` around every
named inner closure (esbuild keepNames): a closure in a hot function costs a defineProperty per call (offerOf's `scale`
alone was ~3.7% of the tick).

**What changed (hot spot → fix).**
- World mix (revenue, 60): offerOf's per-call closure hoisted; packed arrays instead of `new Array(n).fill` and a
  Float64Array per region-sector; build-less models (rivals, China, imported) cache fit / coverage / leverage per
  (pm, ΔG, horizon multiplier, work type, P19) — the only inputs those read — in nested number-keyed maps; the revenue
  readout reuses the player offers the mix computed a moment before (only in applyRevenue, when the mix was computed
  in that call: same state, same values); customer stocks and stock shares without per-provider callbacks.
- macro (310) read the full world mix three times (automationFactor per region) for `bestPublic.AGENCY` only:
  `bestPublicOf(s)` computes that part alone (computeMix uses the same helpers, `providersOf`, `bestPublicFrom`).
- geoQ (440): rivalFinanceQ recomputed the world mix per rival (labMarketRevenue without a mix); now one mix for the
  loop, recomputed after a lab leaves the market (the only change in the loop the mix reads).
- director (140): E17 computed U every day even after its U flag fired (now only while it can fire); the detector
  computes each tool's strength once per level (trait-independent; meanDet asks 4 traits at each L), combines on
  precomputed correlation groups (no per-call item objects / Map), insertion sort for the short strength lists
  (identical values; NaN falls back to the built-in sort), validation lead hoisted.
- research (35): planAssignment's swap pass evaluated assignmentValue twice per pair over all teams × projects with
  fresh arrays; now precomputed capacities, the value before a swap carried over, and only the two projects a swap
  touches recomputed (same ordered sums).
- production (30): the player's mix search (26 evaluations a day) evaluates only X (`xAtMix`, the same expressions as
  evalV3 + inputsAtMix).

**Numbers (same session, alternating pre-P2 code from `git archive 925a5ea` and P2; this machine's load moves absolute
numbers by up to 2×).** Per system, leader-lab hygiene game, µs per day (3 alternating rounds, quiet period): revenue
454 → 308, production 191 → 184, worldDaily 133 → 128, research 125 → 112, director 98 → 63, rivalsChina 68 → 66,
actorsDaily 59 → 55, safetyResearch 57 → 54, record 40 → 33, macro 33 → 2.4, geoQ 15–20 → 3.6; daily average 1357 →
1108 µs. RefBot game: revenue 451 → 304, research 308 → 214, director 78 → 46, daily 1690 → 1338 µs. Hygiene perf, two
alternating rounds under load: daily average 841 / 869 → 619 / 783 µs (≤ 1.5 ms: pass); worst quarter 6.76 / 5.86 →
2.70 / 4.71 ms; leader lab daily 2021 / 2248 → 1282 / 1773 µs (budget 1500: passes when the machine is quiet, fails
under load); leader lab worst quarter 9.92 / 10.51 → 4.74 / 6.86 ms (≤ 8: pass); leader lab's own cost +11.9 / +4.4% →
+23.9 / +9.8% (paired, per system: +5.0% → +13.5%; its absolute cost is unchanged, production +50–70 µs and revenue
+40–60 µs for one more lab and provider, while the rest of the tick shrank).

**What remains (needs a behaviour change, not made).** The rest is float math with Math.pow at its core: the mix's cost
gate (1/(1 + (bc/wage)^(1/k)) per provider × 14 sectors × 3 regions), offers' coverage and token costs, the rivals'
golden-section mix search (26 CES evaluations per lab a day) and refBestX misses (its memo key rounds q and yr, which
change daily), tasteSD's 80-step bisection per lab a day, U's bisection (≈11 levels × 4 traits) every day, worldDaily's
42 sector updates. Faster versions would change values in the last bits or the cadence: exp/log for pow, Newton or a
table for tasteSD, fewer search iterations, understanding weekly in the director, a mix every few days. With those off
the table the leader-lab average is ≈ 1.1 ms on a quiet machine and 1.6–1.8 ms under load.

### A3 notes (price of a fixed capability; 2026-11-20)

Code: `worldfx/serving.ts cheapestAt` (new readout; nothing in the tick reads it), test `scripts/v2/serving.ts` A1–A3
(replaces the INFO price sanity). No state change, no schemaRev bump.

**Diagnosis (RefBot, classic, ai2027, seed 2027, 2025.58 → 2027.08; × per year).** Price = FLOP per token × utilisation
÷ peak × $ per H100e-hour × markup, so the decline splits exactly into these factors.

| Factor | Old test series | Engine, same run | Sourced |
|---|---|---|---|
| (a) active parameters at fixed G, own training | ×1.88 (the bridge: 0.55 OOM/yr ÷ 2) | e_pre +0.50 (at 1e24) to +0.67 (at 1e27) OOM/yr in 2026.08 → 2027.08, so N ×1.8–2.2/yr at fixed tpp | R20 B1 3×/yr (1.8–5); N ∝ √C_eff at the optimum (A1) |
| (b) distillation | not in the series | a student of the frontier holds V0's G at 262B (2026.08) and 29B (2027.08): ×10.6/yr | R20 C4 (R1 distills); Epoch: frontier capability runs on a consumer GPU ≈ 8 months later (R12 §0.6) |
| (c) serving stack | ×1.00 | 0.000 OOM throughout. RefBot runs no Inference-efficiency line (not in DEFAULT_LINES) and has not adopted P16 by 2027. Quantization and speculative decoding are ★ (in the reference) | D1: know-how lifts U_decode 0.07 → 0.15 (×2, no rate given); Google ×33 energy per prompt in 12 months [R, includes model changes] |
| (d) tokens per task | ×1.00 (a per-token price does not see them) | profiles constant | FrontierMath 43M → 5M tokens in 8 months (R12 §5); Opus 4.5 medium uses 76% fewer tokens (C3) |
| (e) hardware ($ per H100e-hour, rental) | ×1.79 ($2.02 → $0.84) | cost floor ×1.40/yr (`costDeclineQ` 0.92), plus the 2026–27 glut (D/S) | Epoch perf/$ +49%/yr (R15 §2.1) |
| (f) utilisation | ×1.00 | U_prefill 0.35, U_decode 0.07 | D1 |
| margin | ×1.00 | standard markup ×2.5 | D3 0.6 (0.4–0.85) |
| **total** | **×3.38** | | **≈ ×10 (×9–×900)** |

The cost chain was not where the gap was. The old series priced `fptOfG`, the rivals' bridge: the reference design
(50 tokens per parameter) at the frontier recipe. It has no distillation, so its V0-level model shrinks only at half the
recipe rate. The lab itself can distill (P04 is ★), and under the game's own rule a student of a teacher 2.1 OOM ahead
holds V0's level at 1/116 of the teacher's size.

**Change.** `cheapestAt(s, G, wt = 'SWE')` returns the cheapest model the lab could serve at fit G. That is the smaller
of two options:
- its own non-retired, non-imported versions that hold G;
- a distilled student of any of them, sized so the gap δ = 0.19 + 0.92·log₁₀(N_T/N_S) is exactly fit − G (at
  DISTILL_TPP tokens, N_S ≥ 1B). Its FLOP per token is the teacher's × N_S/N_T.

Test A1 checks that this student is a run `planRun` accepts with the same gap. The test's fixed-capability price is the
price of that model at the standard markup, per M blended tokens. A3 checks the exact decomposition and the ×6–×30 band.
No new constant.

**Result: ×18.9/yr**: parameters ×10.55, hardware ×1.79, FLOP per parameter, utilisation and margin ×1.00. Per task
also ×18.9 (tokens per task constant). Other runs (scratch): seed 11 ×16.2; authors2026 ×18.0; fast ×21.4; slow ×15.4.
- **Where in ×6–×30, and why:** upper middle, ≈ 2× R20 D3's central ×10. RefBot's frontier fit gains 2.1 OOM over the
  1.5 years. Each OOM of teacher lead shrinks the student by 1/0.92 OOM, while the teacher grows 1T → 3.4T. The rental
  adds ×1.79 (the glut) against Epoch's ×1.49 perf/$.
- **The decline is lumpy, by base generation:** 2025.58 → 2026.58 ×8; 2026.08 → 2027.08 ×29. Cottier et al. see the
  same: the fastest drops come just after a level becomes state of the art.

**Sensitivities [D, not built].**
- The R1 fit covers ratios ≤ 25 (32B / 7B / 1.5B under 37B active). The 2027.08 student is at 116.
  - If one distillation step were capped at ×25 (chained steps paying +0.19 each), the student would be 47B and the
    decline ≈ ×14/yr.
- R20 C4 also names a student ceiling `Cap_S_ceiling(N_S, D)`, which the game does not implement.
  - If that ceiling were the student's own supervised capacity at today's recipe, the decline would fall back to the
    bridge's ×3–4.
  - That would contradict R1, where distillation beat RL on the same 32B base by 25.6 AIME points. So if a ceiling is
    added, it must sit above own-capacity.

**Effects (reported, not targeted).**
- No engine path reads `cheapestAt`, so prices, revenue, compute and golden dates are identical (gate below).
- 2026 reference revenue: worldfx F7 $34.2B, 2027 $40.7B, both unchanged.
- RefBot's product costs are unchanged. Its API runs, per M blended tokens:
  - Atlas-1.0 (1T active): $13.34, then $18.11 in the early-2026 rental spike;
  - Atlas-2.3-mini (951B): $7.76 (2026.58);
  - Atlas-2.7-mini (951B): $5.28 (2027.08).
  That is ×1.7/yr at rising capability. A V0-level student would cost $0.16/M at 2027.08.

**What remains (other tasks).**
- **The market does not sell the cheap model.** The cheapest offer on sale that holds V0's fit (player products and
  rivals' models) gets ×2.3/yr cheaper (seed 11 ×1.6, authors2026 ×2.4, fast ×2.5, slow ×2.8). Two reasons:
  - RefBot's minis are N_t/2, near the frontier (F5), and rivals have one frontier model each, sized by the bridge (F1).
  - Under the market logit (4 per OOM of fit, price elasticity 1), a student of 1/r of its teacher's size takes share
    ∝ r^(1 − 4·0.92/ln 10) = r^−0.6. So it never takes share from its teacher. A cheap tier would need a
    price-sensitive, lower-capability segment on the demand side (A4 / F5).
- **F1:** rivals' FLOP per token from their own designs; rivals' minis by the same rule as `cheapestAt`.
- **Serving stack:** no sourced rate for inference-efficiency ideas (D1 gives only U_decode → 0.15), and the reference
  lab never researches it. This needs a data task plus F5's RefBot share.
- **Tokens per task:** the fall for a fixed answer quality is not modelled, so the price per task equals the price per
  token here.

### A4 notes (demand ceiling on agent work; 2026-11-20)

Code: `worldfx/use.ts` (`costReduction`, `demandExpansion`, `agentCeilingOf`, type `AgentCeiling`), `worldfx/sectors.ts`
(`employmentTarget` now calls the two shared functions, with the same arithmetic), `worldfx/mix.ts` (`SectorMix.agentCeiling`;
`agentK` is after the ceiling), `worldfx/revenue.ts` (the player's agent-hours × the ceiling's fill and held to the room the
other providers leave; `RevenueReadout.playerAgent` per region and sector), `worldfx/readouts.ts` (`BillingRead.agentWanted`,
`ceiling`, `bound`), `worldfx/sectorView.ts` (`SectorRead.agentCeiling`, `RegionWorkRead.agentWanted / ceilingBound`).
Tests: serving D1–D5. No state change, no schemaRev bump, no UI text change.

**Mechanism.** The ceiling comes from research/16 step 7, E = E0·(1 − D)(1 + η·CR), the demand term the sector model
already has. No new constant.
- **Work demand.** A sector's work demand in a region is H* = E0·2000·X with X = 1 + η_s·CR. CR is the step-7 cost
  reduction with AI doing all of the work: CR = 1 − c̄/wage, floored at 0. c̄ is the current buyer's cost of AI work,
  hour-weighted over the adopted task-hours (the mix's `pCost`, price ÷ hours saved + review) and the agent-hours
  (price + wage/λ, the A2c gate's cost). So 1 ≤ X ≤ 1 + η_s: up to ×1.1 (Office, Gov, Services) and ×2 (Science). There is
  no expansion where an AI work-hour costs the buyer the wage or more.
- **Hours ceiling.** Adopted A-hours + agent-hours ≤ H*.
- **Value ceiling.** Spend on that work (adopted hours × price + agent-hours × price) ≤ H* × wage, the sector's wage bill
  × X. The brief assumed price per hour ≤ value per hour already holds. It does not hold for agent-hours whose serving
  cost is above the wage: the price is then max(cost, ·) > wage, and the logistic gate still buys some of them. At day
  900 that covers most CN and ROW cells, where agent prices are 1.4–6× the wage (rivals' FLOP per token, BRIDGE(V7)).
  So the value bound is enforced, not assumed.
- **Fill.** Agent-hours are the residual. They fill the room the adopted hours leave, every provider's by the same
  share fill = min(1, room_hours ÷ wanted, room_value ÷ wanted spend) [D: pro rata; customer shares unchanged]. Adopted
  hours (A) are not touched (A2a's adoption is not retuned).
- **Player products.** Their agent-hours can be more than the player's share of the mix's view, because of enabler
  segments, channel weights and each product's own k. This was already the case before A4. So `revenueReadout` also
  holds the player's agent-hours in each cell to the room left after the adopted hours and the other providers' bought
  agent-hours (hours and value).
- **Where the excess goes [D]: it sits idle.** Agent-hours beyond the ceiling are not bought, so they earn nothing and
  need no serving. For the player, that capacity becomes spare serving, which under the default policy goes to research
  agents (J2 PR1). It does not fall to a cheaper segment; that segmentation is A5.
- **Below the ceiling nothing changes.** fill = 1 exactly and multiplying by 1 is exact. A RefBot ai2027 run, day 1–400,
  is byte-identical to the A2c baseline in every cell's agent-hours, every product's agent-hours and every product's
  revenue (scratch dump). D3 asserts that every provider's k equals the A2c rule at day 1 and on the day-400 fixture.

**Readouts (before = A2c; RefBot, classic, seed 2027; world, all providers, mix view).**

| Run | Agent-hours/yr | Per supervising hour | Demand-side agent spend | Cells bound (of 42) |
|---|---|---|---|---|
| Fixture day 400 | 32.5B → 32.5B | 0.64 → 0.64 | $74.9B → $74.9B | 0 |
| Fixture day 900 | 695B → 534B | 11.97 → 9.21 | $31.3T → $23.7T | 14 |
| ai2027 day 400 | 25.3B → 25.3B | 0.42 → 0.42 | $62.1B → $62.1B | 0 |
| ai2027 day 900 | 1,577B → 1,207B | 10.51 → 8.05 | $23.1T → $17.4T | — |
| ai2027 day 1200 (takeoff) | 7,083B → 2,629B | 33.0 → 12.3 | $64.4T → $23.7T | up to 30 |
| fast day 900 | 747B → 717B | 5.24 → 5.03 | $7.30T → $7.00T | — |
| fast day 1200 | 2,874B → 1,775B | 14.9 → 9.2 | $30.3T → $18.5T | up to 21 |

- The world wage bill (Σ E0·2000·wage) is $59.7T.
- In every cell and checkpoint, demand-side agent spend ÷ (sector wage bill × X) is ≤ 1. The worst is 0.92 on the day-900
  fixture, and 0.95 (ai2027) and 0.93 (fast) at the 20-day checkpoints to day 1200.
- On the day-900 fixture the US knowledge sectors bind on hours, at X = 1.03–1.13 (Software 28% of the wanted
  agent-hours bought). CN and ROW Software, Finance, Media and Science bind on value (prices above the wage).
- ai2027 day 1200: X reaches 1.81 in US Science and 1.66 in US Software, because agent prices there have fallen to
  0.15–0.2 × the wage.
- Player revenue is unchanged at every checkpoint (ai2027 day 900 / 1000 / 1100: $45.7B / 38.9B / 51.3B; day 1200 $196.3B
  → $195.7B). From late 2027 the player is capacity-bound many times over: its serving need on the day-900 fixture falls
  from 28.2M to 22.9M H100e, still far above its pool. So the ceiling trims unserved demand, not revenue.
- **2026 revenue (reported, not targeted):** player CY2026 $34.2B (ai2027) and $21.7B (fast), both unchanged.
  worldfx F7 $34.2B, F11 $40.7B, A2c non-China $72.3B, all unchanged. The ceiling never binds before late 2027.

**Gate (vs the A2c/A3 baseline).**
- tsc main + scripts clean.
- serving passes, including the new D1–D5.
- products, golden-timelines, identity, worktypes, research, effective, calib (T1 and T1L unchanged; authors2026 ASI
  2033.608) and lint-ux pass.
- worldfx: only the known fails, with the same values as A2c: F7/F11 $34.2B / $40.7B, equity −0.4%, U +1 pp
  2028-01-02, GOV T1 2027-08-31.
- Golden dates are unchanged: the reference integrator does not read the sector market, and the RefBot milestones are
  identical.

**Open / for later tasks.**
- **Demand-side agent spend is still $17–24T/yr in a takeoff.** It is bounded (≤ wage bill × X in every cell), but it
  sits at that bound wherever rivals' agent prices exceed the wage. The per-hour price above the value is BRIDGE(V7)'s
  oversized FLOP per token, and F1 removes it. `labMarketRevenue` (rival finance) now obeys the bound.
- **A5:** the idle excess could instead fall to the cheapest adequate model, once demand is segmented by the capability a
  task needs.
- **UI (later B-task):** `SectorRead.agentCeiling` gives hours, value, X, wanted, fill, used and bound. The World ›
  Sectors panel can show "agent-hours bought / wanted" and "share of the work demand used". There is no glossary entry
  yet ("work demand ceiling": E0·2000·(1 + η·CR)).
- The η values are research/16's table values (themselves [D], Jevons). The linear form caps the expansion at 1 + η. A
  constant-elasticity form would let demand grow without bound as the price falls, and research/16 does not use one.

### A5 notes (cheap tiers: demand segmented by the capability a task needs; 2026-11-20)

Code: new `worldfx/choice.ts` (`surplusChoice`, `adequacy`, `tierUtility`); `worldfx/mix.ts` (every provider's lineup per
sector, the choice per region and sector, `SectorMix.tiers` and `playerMiniW`, tier-mix prices and costs, `bandPaid`
readout; consumer user share by quality alone); `worldfx/serving.ts` (`studentParamsFor`, `studentToHold`,
`studentOffer`, `sectorH50`, `productMiniUses`, `blendOffer`; `cheapestAt` uses the shared sizing); `worldfx/revenue.ts`
(each product's offer blended with its API mini per region; Chat products split users by quality; `spareServing`
ignores the rounding of stored H100e); `data/v2/serving.ts MARKET_BANDS`; `data/v2/features.ts` (`MINI_CHANNELS`;
`FREE_TIER_SHARE.api` 0.3 retired); `models/actions.ts` (`launchDistill holdVersionId`); `bots/ref.ts` (option
`cheapTier`, off); `data/v2/workTypes.ts` (authors2026 Δ_bm refit). UI: Blueprint distill "size: hold X's level",
Products mini select and price-tier tooltip, glossary (`cheapTier` new; `targetShare`, `priceTier`, `priceIndex`,
`priceBound`, `freeTier`). Tests: serving S3, B7, D3 updated to lineups; new A5 E1–E9. No state change, no schemaRev bump.

**Derivation.**
- *Tasks.* V3's coverage a = σ((fit − θ_s)/s)·p(H_s | h50) is read as the share of a sector's tasks a model does alone:
  tasks differ in difficulty around θ_s with the spread s = 0.8 of the same logistic, so a model with coverage a does the
  easiest a of them. One difficulty index for fit and horizon [D: a task hard on one is hard on the other].
- *Hours.* Adopted task-hours lie on the tasks some model can do (A ≤ F, research/16 step 4), spread evenly over
  u ∈ [0, a_top] [D], a_top the best coverage on offer; MARKET_BANDS = 8 bands of equal hours [D: quadrature].
- *Adequacy.* A tier with coverage a does x_b = clamp((a − u_{b−1}) ÷ (u_b − u_{b−1}), 0, 1) of band b; the mean over
  bands is a ÷ a_top exactly, so F, K and the coverage readouts keep their meaning.
- *Surplus.* Per hour on band b: S = V·x_b − p, V the value of an adopted task-hour (wage × hours saved), p the tier's
  price (value-capped). Each provider offers its best tier on the band. Choice: share ∝ brand·exp(SHARE_SLOPE_G·fit +
  S ÷ μ_b) among the providers a buyer can reach.
- *Scale.* μ_b = p_min,b ÷ ε, p_min,b the cheapest offer that does the whole band, ε = PRICE_ELASTICITY = 1: at the
  cheapest offer the price response is the old elasticity, and for prices near each other −ε(p ÷ p_min − 1) ≈
  −ε·ln(p ÷ p_min), the old price term. V4's quality term 4 per OOM of fit is kept (beyond adequacy a better model still
  does the task better), so with equal prices, every offer adequate and full access the choice is the old logit exactly
  (test E3). A tier 10× cheaper that does the band is 9 units of μ ahead and wins it; a tier that does only part of it is
  V·(1 − x) ÷ μ behind (V ÷ μ ≈ 15–60), so the work only the frontier does stays on the frontier.
- *Target.* Provider share = the mean of its band shares (sums to 1). Its customers' tier mix = its band shares, and its
  price, agent price and cost, seat cost and H100e-hours per hour are that mix's; its coverage, k and λ stay its model's
  (the lineup does the hardest work on it).

**Lineups.**
- Rivals and China: their model plus, at each band edge u_b below its coverage, the cheapest student that still does the
  band: the cheapestAt rule sized on coverage (gap g solves a(fit − g, h50·4.2^−g) = u_b; N_S = N_T·10^−(g − 0.19)/0.92,
  ≥ 1B; costs ∝ N_S). Fit, FLOP per token and N_T come from BRIDGE(V7) (fptOfG) until F1. The player's open release
  sells only its own model.
- The player: each sector product's main model and, for the API, its mini (`miniVersionId`) as a separate tier. The
  API's old fixed 30% mini share is gone: the share of its hours on the mini is the market's (`playerMiniW`). Chat's free
  tier keeps its 0.6 usage blend (display levels and chat fit unchanged).
- Making a cheap tier (design choice, not magic): `launchDistill { holdVersionId }` sizes the student by the cheapestAt
  rule on the chosen teacher (`studentToHold`), so it lands on that version's fit (E7); the Blueprint offers it as
  "size: hold X's level"; the API's mini select lists it.
- RefBot: option `cheapTier` (off by default) [D]: once per public release it distils from its internal model a student
  holding the previous public release's fit (small models match the previous frontier within months, R12 §0.6), if ≤
  CHEAP_MAX = ¼ of the internal model's size, alongside the public-mini distil, and sets it as the API's mini. Off for
  RefBot because the extra runs and evals shift its random draws: with it on, T1 ai2027 SC lands at day 606 (−32 d,
  tolerance ±29) and fast SAR +57 d (±44). The market alone leaves T1 identical (checked with the option off). Turning
  it on, with the T1 refit, belongs to F5. RefBot's half-size public minis are unchanged.

**Choices [D] and deviations.**
- Access is a share of buyers (each provider independently; choice sets enumerated), not a utility weight
  [deviation from V4's logit]: under the surplus choice a weight is overwhelmed wherever one model does work no other
  can (first build: DeepCent with US access 0.05 took 68% of US Software in Feb 2027). The two agree for small shares.
- The consumer user-share logit drops its price term: ≈ 95% of users pay nothing and choose by quality (the old logit at
  equal prices); subscribers' price response is the paid-share stock (A2b, unchanged).
- Seats follow the provider's hours share, as before. The capacity penalty still acts through brand, but it cannot move
  buyers off bands only the player's model does: they stay, unserved.
- The readout band for "V0's capability" is the hardest band V0 does whole (the band containing V0's coverage also holds
  tasks V0 cannot do, so it reads high; both are reported).
- `spareServing` ignores gaps within the rounding of stored H100e: worktypes' "calendar" check failed on 1 H100e of
  rounding (X 1.36771852 vs 1.36771854) once prices moved.

**Readouts (RefBot, classic, ai2027, seed 2027; before = A4).**
- Price customers pay for V0's capability, US Software & IT, the hardest band V0 does whole, per M tokens (E9):
  $12.95 (2025.58) → $14.20 (2026.08, rental spike) → $2.52 (2026.58) → $0.69 (2027.08): **×7.0/yr**. Exact split:
  rental ×2.15, margin ×1.14, models bought ×2.86. The band at V0's coverage edge: ×4.5/yr. On the providers' own models
  only: ×2.3/yr (A3's "cheapest offer on sale" was ×2.3): the tier shift is the ×3.1/yr between them.
- That band's hours by tier: own models 100% → 100% → 3% → 0%; students 0 → 0 → 97% → 100% (2027: r2 59%, DeepCent
  28%, the player 0: it sells no cheap tier). World adopted hours by tier: own models 95% / 76% / 68% / 61%, students
  5 / 24 / 32 / 39%.
- With RefBot's `cheapTier` on (scratch): ×8.4/yr (edge band ×7.7); the API's mini takes 88% of that band in 2027 and
  22% of the world's adopted hours.
- A3's cheapestAt readout: ×18.9 → ×22.8/yr (the same RefBot; the rental falls ×2.15 instead of ×1.79 a year because
  rivals' revenues, and so their compute purchases, change).

| Quantity | Before (A4) | A5 |
|---|---|---|
| Player revenue CY2026 (worldfx F7) | $34.2B | $33.5B |
| Player revenue 2027 (worldfx F11) | $40.7B | $36.5B |
| World sector spend, CY2026 average (all providers) | $176B | $124B |
| Consumer spend US + ROW, CY2026 average | $11.7B | $11.2B |
| Non-China frontier-lab revenue CY2026 (A2c readout), leader share | $72.3B, 47% | $58.2B, 58% |
| Player share of US Software, Jul 2025 / Feb 2026 / Aug 2026 / Feb 2027 | 0.60 / 0.32 / 0.40 / 0.29 | 0.79 / 0.41 / 0.43 / 0.31 |
| Player revenue run-rate (demand) Jul 2025 / Feb 2027 | $17.3B ($33B) / $27.9B ($56B) | $17.7B ($40B) / $23.0B ($41B) |

- Spend falls because buyers move the same work to cheaper models (students take 39% of adopted hours by 2027); A4's
  Jevons term (η ≤ 1) adds little volume. The leader's share rises: it holds the bands only its model covers (at the
  start rivals' models cover 0.02–0.05 of Software vs its 0.10), so its start demand is +20%.
- 2027: RefBot's public models trail its internal frontier by ≈ 1.5 OOM of fit while DeepCent's and r2's public models
  cover more, so the top bands go to them where buyers can reach them, and the cheap bands to their students; RefBot's
  release policy and its cheap tier are F5's.
- Not targeted (finance is the finance session's). Worldfx known fails move: equity 2026 −0.4% → −14.0% (bust roll;
  rivals' run-rates are lower), U +1 pp 2028-01-02 → 2028-01-28, GOV T1 2027-08-31 → 2027-09-05. W2 0.56% → 0.494%
  (just under its band, below). Still passing: W4 firm adoption 20.6% → 21.3%, HireRate SOFT ≤ 10% 2027-06-29 →
  2027-08-01, AI-friend 11.0% → 10.8%.

**Golden dates and the refit.** Golden-timelines (v1 integrator) is untouched. Calib T1 (stub): ai2027, fast and slow
identical to A4. authors2026 moved: the market changes the rivals' revenue, so a merger offer (E32) fires on day 458 and
RefBot's path shifts (ASI +59 d, tolerance ±44). Refit of the named per-preset value only: authors2026 Δ_bm 4.606 → 4.5
(G_SC and sd_SC kept): SC +0.030, SAR +0.044, SIAR −0.005, ASI −0.030 y (A4: −0.005 / +0.016 / −0.041 / −0.036). T1L
passes. Integrated RefBot (informational): ai2027 unchanged to SC, ASI −0.016 → +0.033; authors2026 no longer insolvent
(reaches SC 2032.2, SAR 2036.2).

**Gate (vs the A4 baseline).**
- tsc main + scripts clean.
- Pass: serving (all, incl. the updated S3/B7/D3 and E1–E9), products, golden-timelines, identity, worktypes, research,
  effective, calib (T1 and T1L), lint-ux, fixtures, `npm run test:ui` (376 passed).
- worldfx: the known fails (F7/F11 $33.5B / $36.5B, equity −14.0%, U +1 pp 2028-01-28, GOV T1 2027-09-05) and **W2 newly
  fails at the band edge: automation TFP over a decade 0.56% → 0.494% (band 0.5–1%)**. It passed at 0.5% in an earlier
  run of this branch; the value sits on the edge. Cause: rivals' students win the easy bands, so the hours share moves to
  providers whose lineup coverage is lower, and F (Σ share × lineup coverage) and the share-weighted display levels fall
  a little in the frozen Agent-1 world. Not tuned. A band-based F (the share of tasks the bought tiers do, ≈ a_top) would
  raise it, but would also speed adoption everywhere (W4, hiring, U); that is a decision for the lead.
- Performance: the mix costs 0.4 → 1.3 ms (lineups with students, 8 bands, access choice sets; memoised student gaps and
  choice sets), ≈ +1.2–1.7 ms a passive day (the mix runs twice a day: revenue and rival finance), on a loaded machine.
  Hygiene's perf checks were already failing (P2); now all four fail (daily average 6.1 ms passive, 6.8 ms leader lab,
  worst quarter 21 / 28 ms, with other sessions loading the machine). Hygiene's other checks pass.

**Open.**
- W2 at the edge (above). F's definition under lineups (hours share × lineup coverage vs the share of tasks the bought
  tiers do).
- RefBot sells no cheap tier (option `cheapTier` off; T1 refit with it on belongs to F5), so in the reference run the
  player takes none of V0's band after 2026; with the option it takes most of it.
- The product card's "share of spend" is now an hours share weighted by spend (the player sells dearer tiers, so its
  spend share is higher). B-task: show both, and the tier mix (`SectorMix.tiers.weight`, `playerMiniW`).
- World market falls with cheap tiers (CY2026 sector spend $176B → $124B; non-China lab revenue $72B → $58B): finance
  session's targets, not retuned.
- Rivals' lineups (one student per band edge) use the BRIDGE(V7) sizes; F1 gives them real designs. Seats follow the
  hours share. Capacity erosion cannot move buyers off bands only the player covers.
- Perf (above): F6.

### D1 notes (data portfolio, 2026-11-20)

Code: `src/engine/v2/production/data.ts` (engine), `src/data/v2/dataAssets.ts` (numbers), types `DataPortfolio` /
`DataAsset` in `src/engine/v2/types.ts`. Test: `scripts/v2/data.ts` (added to `test:v2` after `effective`).

**Structure**
- `PlayerLab.dataPortfolio = { assets, usageShare }` replaces `dataAssets`. Assets are `PublicWebUse` (id `public`) or
  `OwnedDataAsset` (`licensed` | `usage` | `synthetic` | `expert`, each with `tokensT`, `mix` over the nine domains,
  `quality`; optional `day`, `domain`, and for synthetic `teacherId`, `teacherG`, `inheritsTraits`).
- **Public web, shared and finite:** `PUBLIC_WEB` = one world stock of 300T tokens (Villalobos et al. 2024, R20 A3,
  research/13 §2.6), q 1, Common-Crawl-like mix [D]. Labs hold only a crawl `coverage` (≤ 1, clamped) of that stock, so
  every lab reads the same finite stock and no lab can own more than the world has. The stock is constant [D]; use by
  other labs does not deplete it (repetition is per base, as the brief says). Rivals do not plan bases physically yet,
  so only the player reads it today.
- **U = Σ q·T** over the pretraining kinds (public, licensed, usage, synthetic; synthetic × 3 with P10, unchanged until
  D9). Expert data is not pretraining data (D5's suites). `uniqueTokens(s)` → `playerUniqueTokens` → `baseG` in
  `models/runs.ts`, so every base plan (blueprint limits, launch, completion) and B0 at init read the portfolio.
  `effectiveStock` (v2's 3-epoch stock) is gone; the next-model readout uses `freeStock` = 4 × U (Muennighoff ≈ free 4
  epochs) against N_req — readout only (`nextModelGate`, no engine reader).

**Start values (every start type, as before D1; follower positions unchanged)**
- Public crawl 0.9 × 300T = 270T [D: v2's unlicensed 270T], licensed `lic:start` 30T q 1, synthetic `syn:start` 20T
  q 0.5, usage 0, expert 0. U = 270 + 30 + 0.5·20 = **310T**, exactly v1's stock; B0's epochs 0.161 as before.
- Licensed start q = 1 [D]: the start's 30T overlap the web's quality (news, forums, code archives); R20 A3's 1.5–3 for
  curated/licensed tiers is left for D2's domain deals. Keeping 1 keeps U and the litigation basis exact.

**Quality rule (stated)** — quality enters G only through U: U = Σ q_i·T_i, then f_data = Muennighoff/Besiroglu on
D vs U as before (`effective.ts` unchanged). This is research/20 A3's game-ready rule D_eff = Σ q·U·(1 + 15.4·(1 −
e^(−(ep−1)/15.4))) [G; q tiers: web 1, curated 1.5–3 (Gundlach's ×3 data selection [P]), synthetic 0.5–1.5]. Direction:
higher quality → more effective unique tokens → fewer epochs → higher G for a base that repeats data; no effect on a
base within U (test: licensed q 0.2 / 1 / 3 on a 2000T-token base → U 286 / 310 / 370T, G 30.786 / 30.792 / 30.802).
The quality of the *drawn* tokens at D < U (a mix-quality term in G) is D3's draw; the curation "quality" filter keeps
its v1 ΔG meanwhile.

**Synthetic** — generation FLOP per kept token = teacher FLOP per token × overgeneration 4.33 at the pool's FLOP per
H100e-day; 4.33 [fit] reproduces v1's 4e-6 T per H100e-day for V0 and lies inside R20 A3's 2–5× [G]. The teacher is the
lab's internal research model (`agents.capRoutine`) until D2 lets the player choose. Bigger teachers now yield fewer
tokens per H100e-day. Quality q = 0.5 + 0.25·(G_teacher − G_V0), clamped to [0.1, 1.5] (0.5 at V0 = v1's SYN_QUALITY;
1.5 = R20's top; slope [D]). One asset per teacher (`syn:<versionId>`), `inheritsTraits: true` for E-tasks (F3 subliminal
learning). `SYN_YIELD_T_PER_H100E_DAY` / `SYN_QUALITY` are removed from `calibration.ts`.

**Usage** — daily: each non-withdrawn product's `servedH100e` (from the revenue system's last day) × output tokens per
H100e-day at its version's FLOP per token on the assisted token profile (the serving cost chain, so research/22's
volumes as the serving model produces them) × channel eligibility × `usageShare`. Eligibility [D]: consumer only (the
providers' default terms train on consumer chats unless opted out and not on API/enterprise/gov data; not fetched).
Policy share 0.2 [D], q 0.5 [D], mix = CHAT_WORK's domain weights for consumer. Readout in the ai2027 RefBot run:
≈20–55B usage tokens/day, 18T by day 600 (U 1566T, mostly synthetic), so it never binds today.

**Data actions** — D3 "License data" now licenses the crawl (`public.licensed`) and adds a licensed corpus `lic:corpus:<day>`
of 0.5 × (crawl + licensed) quality-weighted tokens: v2's × (1 + 0.5·deals), so U after D3 is 460T as before. Cost and
the copyright-suit hazard read `unlicensedPublicT` (270T → 0), same numbers as before.

**Calibration** — RefBot never repeats data (B2–B4 at 0.11–0.22 epochs; U grows by synthetic data to ≈2900T by day 840),
so the portfolio does not move the timeline: same SC 638 / ASI 904 on the stub ai2027 run; gate table in the final report.

**Save** — schemaRev 20 → 21; migration `dataPortfolioFromV2` keeps U and the unlicensed tokens (tested on both sides of a
licence deal and on the day-400 fixture). Fixtures were not regenerated (they migrate on load).

**For later tasks**
- D2: add `OwnedDataAsset`s (licensed by `domain`, q 1.5–3; expert by domain; synthetic from a chosen teacher —
  `syntheticQuality`, `synTokensPerH100eDay`); `usageShare` is the data-policy hook; remove D3 then.
- D3: `assetMix`, `mixOf`, `pretrainMix`, `portfolioByKind` give token- and quality-weighted mixes; the draw should
  replace `uniqueTokens` in `baseG` with the drawn U and add the drawn quality and s_d,data.
- D4: `portfolioByKind` is the portfolio view's row model (kind, tokens, weighted tokens, quality, mix, count).
- D5: the `expert` asset (q 3, 0 tokens at start) is where suite fidelity's expert data lives.
- E-tasks: synthetic assets carry `teacherId`, `teacherG`, `inheritsTraits`.

### D3 notes (data mix on the blueprint: the base draws from the portfolio, 2026-11-20)

Code: `src/engine/v2/production/data.ts` (`drawData`, `playerDraw`, `specialisation`, `REF_SHARE`, `NATURAL_MIX`,
`MixTarget`, `DataDraw`), `src/data/v2/runDesign.ts` (`BASE_DATA` = the five presets as mix targets),
`src/data/v2/dataAssets.ts` (`ALPHA_DATA`, `SPEC_CAP`), `models/runs.ts` (`baseG` reads the draw), `models/effective.ts`
(`fDataEff`), `models/design.ts` (`baseEffect`: curation only). UI: Models card "Data specialisation" (replaces
"Research boost"), Blueprint data tile rows. Test: `scripts/v2/data.ts` (section "the draw"), `uitest.mjs` (D3 checks).

**Draw rule (stated).** Slices are (pretraining asset i × domain d) with quality-weighted unique tokens
U_i,d = q_i·T_i·mix_i,d (P10: synthetic × 3). The mix target sets each domain's share of the base's D tokens,
m_d ∝ B_d · tilt_d · K_d/U_d, where B_d is the starting share (`reference` = REF_SHARE, `natural` = U_d), tilt the
preset's domain tilt, and K_d = Σ_i U_i,d·k_kind(i) the kind weights' pull on the domain. Within a domain the tokens come
from its slices in proportion to U_i,d·k_kind(i). A slice drawn beyond its U_i,d **repeats its own tokens** and pays
Muennighoff on that slice alone: D_eff = Σ U_i,d·(1 + 15.4·(1 − e^(−(ep_i,d − 1)/15.4))). **No fallback** to other
data, except that a domain the portfolio holds nothing of draws nothing (its share goes to the rest in proportion).
- (a) `baseG`: f_data = Besiroglu-law value of D_eff vs D (`fDataEff`), replacing `fData(N, D, uniqueTokens)`. The
  readouts: `uMix` = the largest base the mix draws without repeating (min over slices of U_i,d·D/D_i,d; = U for the
  natural mix), `epochs` = D/uMix (the most-repeated slice).
- (b) s_d,data = α_data·log₁₀(effective share_d ÷ REF_SHARE_d), capped ±SPEC_CAP; effective shares (D_eff per domain)
  so repeated tokens teach less. REF_SHARE = the start portfolio's quality-weighted mix (SOCIAL 42.7%, MEDIA 11.7%,
  CODE 9.6%, REASON 9.1%, RSCH 7.9%, BIO 5.9%, AGENCY 5.7%, PHYS 4.6%, CYBER 3.0%) = what o_d was fitted with.
- (c) Quality enters only through U (D1's rule, unchanged); `DataDraw.quality` (mean q of drawn tokens) and `byKind` are
  readouts for D4. No mix-quality term at D < U [D: the brief's "as D1 defined"; D4/D2 may add one with curated q 1.5–3].
- The base's `sD` = draw sD + the curation's domain offsets (hazard filter BIO −0.5 OOM, kept: curation, not a data
  option). Curation's general ΔG (quality filter off −0.24, hazard, safety pretraining) and P24 stay in `design`.
- P10 keeps v1's "no repetition penalty" (`noRepeat`) and synthetic × 3 (D9 owns it).

**α_data = 1.5 OOM per decade of share, cap ±1.3 OOM** [R20 A2 game-ready, from Ruan et al. 2024 / Muennighoff et al.
2023 [P]]: a code share 0 → 50% moves the code axis up to +0.5 ECI ≈ 1.3 OOM (0.387 ECI per OOM, Epoch). Linear in the
share, the part from the reference 9.6% to 50% is 1.05 OOM over 0.72 decades = 1.46/decade (1.8 if all of it lay above
the reference); 1.5 is the low end (Llama 3: mix tricks matter less at frontier scale [R]). Cap 1.3 = the +0.5 ECI at a
50% share, used both ways. No extra general penalty above a 50% share (R20's "general Cap penalised") — the log rule
already costs every other domain [D].

**Presets** (`BASE_DATA`, all `base: 'reference'`; tilts and kind weights [D]) and what they draw at the start
(B0-size base, no repetition; OOM):
| preset | target | s_d,data at the start | V1 offsets (OOM, retired) |
|---|---|---|---|
| balanced | reference shares | 0 everywhere | none |
| code & math | CODE ×3, REASON ×2, RSCH ×2, CYBER ×1.5 | CODE +0.51, REASON +0.24, RSCH +0.24, CYBER +0.06, rest −0.21 | CODE +0.3, RSCH +0.2, CYBER +0.2, SOCIAL −0.2 |
| science | BIO ×3, REASON ×1.5, RSCH ×1.5 | BIO +0.60, REASON +0.14, RSCH +0.14, rest −0.12 | BIO +0.4, REASON +0.2 |
| synthetic-heavy | synthetic assets ×4 | CODE +0.14, REASON +0.15, SOCIAL −0.06 (grows with the synthetic stock) | +0.18 general, +0.1 all, no wall |
| multimodal | MEDIA ×3, PHYS ×3, AGENCY ×2 | MEDIA +0.51, PHYS +0.51, AGENCY +0.24, rest −0.21 | AGENCY/MEDIA +0.3, PHYS +0.25, no wall |
Kept from V1 (not domain offsets): multimodal +20% FLOP, science +5% run cash, synthetic-heavy S6 and its teacher
requirement (trait inheritance; safety reads `design.data === 'synthetic'`). Retired: every `dg`, `off`, `noWall`;
`deltaRsch`, `designOffsetView`, the "Research boost ±x mo" readout, limit `model.designOffset`, glossary
`designOffset` (→ `dataSpec`, limit `model.dataSpec`).

**Deviation from the brief [D]: "balanced = the portfolio's natural mix" holds at the start only.** With
`balanced: base 'natural'` the reference lab's stock fills with code/reason-heavy synthetic data (690T by day 285, 56%
synthetic) and its bases drift into code models: at day 285 the natural mix is CODE +0.39, REASON +0.41, SOCIAL −0.32,
PHYS −0.35 decades vs the reference (s ≈ +0.6 / +0.6 / −0.5 / −0.5 OOM). calib T1 then moved every golden date early:
ai2027 SC −0.09 / SAR −0.17 / SIAR −0.23 / ASI −0.21 y; authors2026 SC −0.44, SIAR −0.60; fast SC −0.28, ASI −0.38;
slow SC −1.45 y — beyond tolerance by more than 0.3 y (the stop rule). So every preset starts from the **reference
shares** (the 2025 recipe's mix, which o_d and the golden dates were fitted with): balanced = the natural mix at the
start, and after that a lab keeps a general-purpose mix unless it picks one that draws its new data (synthetic-heavy,
code & math). One line flips it back (`base: 'natural'` in `BASE_DATA.balanced`); the lead decides. With 'reference'
calib passes with the same numbers as before on ai2027 / fast / slow; authors2026 SIAR −0.041 → −0.074 y, ASI −0.036 →
−0.082 y (inside ±0.12): its late bases (> 310T tokens) repeat the human-only domains (PHYS, SOCIAL, MEDIA: synthetic
data has none), which tilts the effective mix a little toward code.

**Start reproduction.** At the start the reference shares are the natural mix, so RefBot's balanced draw of B0's size has
no specialisation (all |s| < 1e-9), f_data 1, uMix 310T, epochs 0.1613 (B0's); B0/V0 are built as before (sD {}), so G,
the 2025 domain profile (effective test, |off| < 0.25 L) and the golden dates are unchanged.

**Save.** No state changed (the draw is computed at plan and completion; `BaseModel.sD` already held s_d,data), so no
schemaRev bump. `BaseLimits` gained `draw` and `sD` (plan readouts, not saved).

**For D4 (data UI).** Show from `planRun(...).limits.draw`: drawn vs effective domain shares against `REF_SHARE` (bars),
`sD` per domain (OOM, cap ±1.3), tokens drawn per kind (`byKind`) and mean quality, `uMix` vs tokens and the
most-repeated domain (epochs), and from `drawData(p, D, NATURAL_MIX)` the portfolio's natural mix (where the stock
drifts). The mix control can expose `MixTarget` directly (tilts per domain, kind weights, reference/natural base); the
five presets are `BASE_DATA`. `portfolioByKind` stays the per-kind row model.

### E1 notes (safety research lines on the project mechanism, rates; 2026-11-20)

Spec: MODEL-V3 §11.7, §5.3; research/14 §1.2–1.3. Code: `src/engine/v2/safety/lineProjects.ts` (new: stages, allocation,
rates, beliefs, readouts), `safety/agendas.ts` (compute shares, results per year, `safetyRe` with experiments; v2's
`lineRate`, `computeRatio`, `linePool` removed), `models/tree.ts` (research day steps line projects; ETA/rate for lines),
`data/v2/agendas.ts` (constants), `types.ts` (`TreeNodeState.saf`), `core/save.ts` (schemaRev 21), `core/loop.ts` (memo
reset). UI: the Tool upkeep card's engineer bar shows the new "experiments" share (`Safety.tsx`, glossary `toolUpkeep`).
Test: `scripts/v2/safetyresearch.ts` (in `test:v2` after `research.ts`).

#### Stage design

Each line project (a safety node with an agenda, or a line's follow-up) runs the capability lifecycle:

1. **Ideation**: candidates per day = (m_ideas × capacity ÷ SERIOUS_CAP)^λ × taste × speed ÷ (0.2·T₁ × 30). Taste = the
   capacity-weighted AIFM team taste of the safety teams (human only; Strong = 1). Scientists keep ideating while a test
   runs (pool ≤ 2); a project tests its first candidate at once (PICK_AT 1) [D].
2. **Small experiments** (0.35·T₁ months of work at X = 1) and 3. **validation on the frontier model** (0.45·T₁, in
   place of the scale test) [D]: work per day = X(c, ℓ) × speed ÷ 30 with the capability projects' experiment CES
   (`Xces`, the preset's AIFM parameters), c = the project's experiment FLOP/day ÷ (computeRef × 1e6 H100e ×
   FLOP/H100e-day) (the agenda's reference share of the leader's day-0 compute, fixed physical unit), ℓ = (m_exp ×
   engineers ÷ SAF_RE_UNIT)^λ.
4. **Result**: `fireFinding` unchanged (type from the hidden efficacy, Beta posterior, FALSE via Trusted to AI ×
   sabotage, dead-end team-months, re-validation, follow-ups). The project then tests its next candidate.

[D] Validation applies to every line project, not only tool nodes: follow-ups and finding nodes also make claims about
the frontier model (an eval, a discovery), and one stage chain keeps every project at T₁.

**Beliefs** (readout): a candidate starts at the line's Beta posterior and is updated by the scientists' reading of the
hidden efficacy (sd 0.3 ÷ taste), then by the small-experiment (0.3) and validation (0.25) readings [D]. The risk policy
picks among waiting candidates by μ + κσ. The result's type never reads the belief, so the type distribution is v2's.
Caveat for the UI task: showing a candidate's belief leaks the efficacy faster than the posterior alone (research/14
§1.0 principle 1 allows "effort decides how fast you learn e"); show it as the team's estimate on the project card only.

**Research engineers** (safety): cases and patches first, then line experiments in priority (queue) order, each project
asking SAF_RE_UNIT × min(2.5, capacity ÷ SERIOUS_CAP) (engineers follow the programme's science staffing), at most
SAF_EXP_SHARE = 50% of the free engineers [D], the rest tool upkeep (and the validation lead, which reads it). Only
projects in a test stage take engineers; a test that starts today gets them tomorrow (as capability). SAF_RE_UNIT = 50
heads [D, calibration]. **Compute**: the safety pool after monitors, safety agents and investigations is shared by the
projects in experiments ∝ engineers × computeRef (all of it, as capability's experiments pool; v2 capped each line at
its request and let the rest idle). `AgendaState.computeShare` keeps its meaning (share of the safety pool).

**Speed modifiers kept from v2's rate**: dead-end line ×0.5, F44 ×3 on AG18/AG03/AG16 with AI labour, P27 ×(1 + 3t)
(E13 types them); added siloing −5%/level and the ASIC migration −15% (as all research). Not applied: frontier pause and
treaty (capability-research rules), P13 (capability experiment agents).

**Assignment** [D]: safety teams keep the J2 auto-assign (lines keep their teams; a finished node's teams move to the
line's next project; idle teams join unstaffed lines by posterior). The capability planner would fit mechanically, but
its value (√capacity ÷ ideation effort) ranks lines by T₁ and would pull teams off long lines (AG04, AG10, AG12) every
day, the bots place safety teams by hand, and the Safety panel's line staffing UI is built around per-line teams. Revisit
with the safety UI (E11/E12).

**Performance**: today's allocation is memoised per state and day (understanding asks for it many times a tick); the
research system and every `act`/`resolve` reset it. Paired tick timings under the current machine load are within noise
of the base (hygiene's absolute budget fails on both, the known item).

#### Calibration to T₁

Reference inputs = serious science capacity (SERIOUS_CAP, Strong), SAF_RE_UNIT engineers, the agenda's computeRef share of
1e6 H100e: c = ℓ = X = 1 and ideation rate 1, so the first result takes 0.2 + 0.35 + 0.45 = 1.0 T₁. Test: every agenda
within 0.8% (AG18 90 d, AG02 121 d, AG01 271 d, AG12 1080 d). Once the pipeline is full a result follows every 0.8 T₁
(experiments bind at reference; v2 restarted the project, so its steady pacing was T₁).

Inputs then move the stages as for capability: ×1.16 for twice the engineers, ×1.29 for twice the compute (near the
reference); compute-bound and labour-bound regimes as the worktypes test; √capacity on ideation; lab compute growth
raises c (RefBot's lines: X 0.46 at day 150 → 1.44 at day 750 as compute goes 1.4M → 11.6M H100e).

#### AI labour (for E2)

`lineLabourMult(s, ag)` returns the effective-labour multipliers `{ ideas, exp }` that enter ideation (m_ideas ×
capacity) and ℓ (m_exp × engineers). Today both are the safety fleet's v2 multiplier (Trusted to AI, agents.ts), so AI
labour now enters through λ like human labour (m^λ per stage instead of v2's ×m on the whole rate: weaker; E2 replaces it).
E2 plugs in: m_exp from the SAF_EXP slot (workContext already has it), m_ideas from a SAF_IDEAS slot, AI taste in
`safSciOn` (today human only, `teamTaste(z, 0, 0, m2b)`), and sabotage in `fireFinding`'s FALSE weight.

#### Results (gate)

- tsc main + scripts: clean. safetyresearch: all 16 pass. research, worktypes, effective, serving, identity, fixtures,
  lint-structure/ux/hidden, test:ui (376): pass. golden-timelines: pass (known WARNs only).
- **calib T1 slow SC FAILS: 2037.772 vs 2038.527 ± 0.08 (−0.75 y) — stop rule, reported, not forced.** Diagnosis: the
  slow preset's SC on seed 2027 is a knife edge between base cycles. Base code: G_SC 35.44 / 35.447 / 35.45 / 35.46 gives
  SC day 4657 / 4729 / 4776 / 4605 (non-monotonic); seeds 2028/2029 give day 4483 on the base code. Under E1 RefBot's one
  start line (AG02, white-box) produces 173 results in 12 years instead of 36 (base, same seed), one of them a SPILL (+0.02 progress-
  years of public knowledge), which lifts the stacks by +0.025 OOM after day 3650 and lands seed 2027 on the day-4483
  base. Without findings the E1 run hits day 4729. G_SC 35.472 puts E1's seed 2027 at day 4776 (in tolerance), 35.48 at
  4483 again: a refit of slow's G_SC is the lead's call (not a named value of E1). ai2027, authors2026, fast T1 pass.
- **safety**: S4 RefBot P_mis 0.569 (base 0.694; range 0.55–0.85, near its floor), S4 safe-only 0.045 (0.086).
  **S5 RefBot "U falls below L by SAR" now FAILS** (median U − L +0.19, below in 38% of worlds; base −0.97, 60%).
  **S5 mixed now PASSES** (median min margin −0.03, base −0.58; known failure fixed). U at SAR: RefBot 11.22 (base 9.87),
  mixed 12.35 (11.44). Cause: the intended one — safety lines speed up with the lab's compute (≈ ×10 by SAR) instead of
  v2's share-relative compute; RefBot gets ≈ 4–6 results per line to SAR instead of ≈ 2. S5's RefBot criterion encoded
  v2's asymmetry; with E2 (AI labour on capability outpacing safety, sabotage) or a retune of the safety-side constants
  (SERIOUS_CAP, SAF_RE_UNIT, SAF_EXP_SHARE, UPKEEP_*) it may come back. Not forced here.

#### schemaRev

20 → 21: `TreeNodeState.saf` (stage, candidates with beliefs, the test in flight). Migration converts a line project in
progress at the same share of its stage chain (`safFromProgress`; tested: half done → ETA ½ T₁). `hygiene.ts`'s
rejection check now expects 21. Fixtures regenerated. (Merge M1: renumbered 21 → 22 after D1's 20 → 21; the committed
fixtures are the older schemaRev-16 files, see "M1 merge notes".)

### M1 merge notes (D1 + D3 and E1 onto A5; 2026-11-20)

Merged into `model-v3` (at A5, 09391a7) with `--no-ff`: `v3-d3` (D1 e703c7b, D3 07414e9), then `v3-e1` (E1 24d19ff).
Both branches started at 672c4c1 (before A5). D1, D3 and E1 notes are above (copies of `design/notes/D1.md`, `D3.md`,
`E1.md`, which stay).

**Conflicts and resolution.**
- v3-d3: none (glossary.ts and Blueprint.tsx auto-merged with A5's `cheapTier` / "hold X's level" changes); tsc clean.
- v3-e1: `package.json` test:v2 (kept both: `data.ts` after `effective`, `safetyresearch.ts` after `research`);
  `core/save.ts` (both added imports, a rev comment and migration key 20). types.ts, glossary.ts (`toolUpkeep`), tree.ts,
  selectors.ts auto-merged; uitest.mjs, lint-ux.ts and the design notes had no overlapping edits.
- **schemaRev chain made linear: 20 → 21 D1 (`dataPortfolioFromV2`), 21 → 22 E1 (`safFromProgress`); SCHEMA_REV 22.**
  A5 changed no save code. hygiene expects 22 and gained two migration checks (a rev-20 save with v2 `dataAssets` migrates
  to the portfolio with the same U; a rev-21 save with a line project half done gets its stage state); safetyresearch's
  migration test now starts at 21; data.ts's 20 → 21 test is unchanged.
- **Fixtures:** E1 had regenerated them at its schemaRev 21 (E1 state without D1's portfolio), which under the linear
  chain would be read as D1-format saves and skip D1's migration. The merge keeps the previously committed schemaRev-16
  fixtures (as D1 did), so every fixture load runs 16 → 22 through every migration (data.ts: "day-400 fixture loads with
  the same U" passes, 964.4T). `fixtures.ts` rewrites them on each run; they were restored after the gate.

**Lead decisions.**
- D3: "balanced" (and every preset) draws at the 2025 reference shares (kept). The portfolio's natural mix stays
  available as a mix target (`NATURAL_MIX`, `MixTarget.base: 'natural'`) for D4 to offer as a preset.
- E1: slow is a knife edge on seed 2027 (SC jumps between base cycles); its G_SC is refitted here (below). Safety S5
  RefBot ("U falls below L by SAR") failing is accepted as known (to E2/E10); S5 mixed passing is fine.
- A5: authors2026 Δ_bm 4.5 kept as A5's starting point (then refitted here, below, because the merge moved it); RefBot
  `cheapTier` off by default (F5); worldfx W2 at ≈0.49% accepted as a known borderline failure (feasibility F stays "best
  available coverage", not bought tiers); hygiene perf known (P3, F6).

**Refits (named per-preset values only; `calib.ts --fit-v3` and a G_SC scan; seed 2027, Δ in years).**
- slow G_SC 35.447 → **35.474**: SC −0.753 → +0.049 (±0.08). Scan on the merged code: 35.466 −0.277, 35.469 −0.167,
  35.471/35.472 −0.079, 35.473–35.475 +0.049, 35.477 −0.753 (back to the day-4483 cycle). 35.474 is the middle of the
  plateau inside tolerance; E1's 35.472 is at its edge here (−0.079). Not robust: F4.
- authors2026 (G_SC, Δ_bm) 33.62 / 4.5 → **33.632 / 4.6** (sd_SC 1.8 kept): SC +0.016 → −0.005, SAR +0.022 → +0.022, SIAR
  −0.225 → −0.027, ASI −0.356 → +0.041 (merged calib: SIAR 2141 vs 2151, ASI 2990 vs 2975). Cause: the D merge alone on
  A5 gives SIAR −0.175, ASI −0.334 (D3 on its own branch had −0.074 / −0.082; A5's market and D3's draw together move
  RefBot's late authors2026 path); E1 adds ≈ −0.05 / −0.02. The fit is steep as V3b noted (Δ_bm 4.55 −0.055 / −0.079,
  4.562 −0.088 / −0.184, 4.569 +0.041 / +0.110, 4.581 +0.121 / +0.200, 4.60 −0.027 / +0.041): Δ_bm is back at its pre-A5
  value (4.606), F4. **This overrides the lead's "Δ_bm 4.5 kept"** under the rule "refit only the named per-preset
  values if a preset leaves tolerance": with Δ_bm held at 4.5 the best G_SC (33.61) leaves SIAR −0.123 / ASI −0.312, and
  moving sd_SC instead also moves SC (G_SC 33.61, Δ_bm 4.5: sd_SC 1.5 → SC +0.156, SAR +0.447; 1.65 → +0.049 / SAR +0.230;
  1.95 → SC −0.178, ASI −0.499; 2.1 → ASI −1.077), so no sd_SC near 1.8 fits at 4.5 without a larger G_SC/sd_SC move. One
  line reverts it (`V3_CAL.authors2026`) if the lead prefers 4.5 with authors2026 out of tolerance.
- ai2027, fast: unchanged and in tolerance. T1L passes on all presets.

**Gate (merged code, after the refits where they matter).**
- tsc main + scripts clean; `npm run build` ok; `npm run test:ui` 381 passed.
- Pass: golden-timelines, identity, effective, data, research, safetyresearch (16), worktypes, serving, products, calib
  (T1, T1L), fixtures, lint-hidden, lint-ux, lint-tradeoffs, lint-structure, money, idle.
- hygiene: all pass except the four perf checks (known; 6.6–7.6 ms passive, 7.5–8.3 ms leader lab daily average,
  worst quarter 25–32 / 17–19 ms, with other sessions loading the machine). Save checks incl. 20 → 21 and 21 → 22 pass.
- worldfx (first run since D1/D3/E1): F7/F11 $33.5B / $36.5B, equity 2026 −14.0%, U +1 pp 2028-01-26, GOV T1
  2027-09-05, W2 0.5% (≈0.49%, the accepted borderline) — the A5 set, unchanged (U was 2028-01-28).
- finance (first run): F2 global production 2027 43.2M (45–60M), F7 revenue median $30.6B, F7 valuation $0.28T, F11
  2027 $35.6B. **F2 is not from the merge:** finance on A5 (09391a7) gives the identical fails (43.2M); it passed at
  46.9M after A2c, so A5 moved it (rivals' lower revenue buys less compute); not in the known list until now.
- ws4 (first run): T3 China lead 28–371 d (band 75–275) and T3 post-theft lag — the known T3.
- safety (slow; first run of the combination): S5 RefBot fails (median U − L at SAR +0.36, below in 30%; accepted);
  S5 mixed passes (margin +0.03); **S4 RefBot P_mis at ASI 0.530 now fails (band 0.55–0.85)**: E1 alone gave 0.569 (from
  0.694), the same cause as S5 (safety lines speed up with compute). Safe-only 0.018 passes. Attribution: safety on
  the D merge alone (596b095, no E1) gives S4 RefBot 0.706 (pass), safe-only 0.108, S5 RefBot pass (−0.84, below in 78%),
  S5 mixed fail (−0.84): so S4's drop is E1's, on top of A5 + D. Not covered by a lead decision yet: listed for the lead
  with S5 RefBot (E2/E10).

### D5 notes (RL environment suites as owned assets, 2026-11-20)

Code: `src/engine/v2/models/suites.ts` (state, readouts, work, actions, migration helper), `src/data/v2/suites.ts`
(numbers), `models/effective.ts` (`rlGains(..., fid)`), `models/runs.ts` (recipe freezes the suites, no-suite focus
refused, no grader cash), `safety/traits.ts` (`postSignals` S2), `departments/build.ts` (build kind `suite`, upkeep line
`suite`), `core/init.ts`, `core/save.ts`. Types: `EnvSuite`, `PlayerLab.suites`, `VersionBuild.rlFid`,
`TrainingRun.recipe.{fid, exploit}`, `OwnedDataAsset.family`, `PostDesign.graders?` (legacy). UI: Blueprint post card
"Suites" row (read-only), BuildLoad labels. Test: `scripts/v2/suites.ts` (in `test:v2` after `data`).

**State and rules**
- `PlayerLab.suites[family] = { exploit, builds, hardenings }`, one per RL family in `RL_FAMILIES`. Start: the six
  families without a paradigm need. Computer use (needs P06) has **no suite** until P06 is known; then it reads as a
  start-quality suite (`suiteOf`) and becomes state when the lab first works on it (`materialiseSuite`) [D: no daily
  system, no edit to tree.ts]. Broad RL = equal weights over the families with a suite (replaces
  `rlFamiliesAvailable(nodeKnown)` for the player; same families as before).
- **Fidelity is not stored**: fid_f = 1.5 − 0.5·(E₀/E_f)^0.5 (≥ 0.5), E_f = tokens of the family's expert asset
  `expert:<family>` (D1's `expert` kind, q 3, domain = the family's own domain, `family` set). One home per datum: the
  data portfolio holds the expert data, the suite reads it. ×2 data → 1.146, ×4 → 1.25, ×16 → 1.375, cap 1.5 [D].
- **Fidelity × the RL-ceiling stack:** A_f = fid_f · (A_base(FLOP_pre) + a_RL). The stack (research line
  "Environments & rewards", a_RL) is the lab-wide method for environments and rewards and applies to every family; a
  suite's fidelity is how much of it that family's environments realise. A domain's ceiling is the transfer-weighted
  mean of the A_f reaching it (Σ_f w_f·T[f][d]·fid_f ÷ Σ_f w_f·T[f][d], the same weights as its compute), so a better
  suite raises its own family's gain and other domains only through transfer, and the curve stays bounded by the best
  A_f. All fid = 1 is bit-identical to V1 (num = den).
- **S2 rule (MODEL-V3 §11.2):** S2 = κ · Σ_f (RL compute share_f × exploitability_f) × the RL budget's pressure
  (light 0.5 / standard 1 / heavy 1.3, kept from V1) + P11 0.2, clamped [0, 1] as before. κ = S2_PER_EXPLOIT = 5.538
  [fit] so the leader's start suites under broad RL give V1's 0.36. The family table's S2 entries (math 0.2, SWE 0.6,
  ML research 0.4) are gone (S3/S5/S7 entries unchanged, E3 rebuilds them). The version's `build.signals.S2` is now this
  S2 too (the design table's S2 kept only as a readout fallback at V1's hardened × 0.6).
- **Frozen at launch:** a post run stores `recipe.fid` and `recipe.exploit` (with rlMid/rlCeil); completion builds the
  version and applies traits with them, and the RL weights come from the frozen families. IDA uses each family's max of
  the teacher's and today's fidelity; the continual-learning stream and S2 for stream/IDA trait steps read today's
  suites.
- **Build** (`suite.build`, param `family`): $0.1B for 0.002T expert data (paid when queued) + 2 team-weeks on the
  build queue ('builds' need, after upkeep); on completion the tokens join `expert:<family>` (expert data is **created**,
  not consumed: the suite keeps reading it, D7's evals may read it too).
- **Harden** (`suite.harden`): 1.5 team-weeks and $0.05B × √(E/E₀) (bigger suites cost more to red-team; × 0.2 cash with
  P15 "hardened graders at the cheap price", V1's 0.1/0.5); x ← floor + (x − floor)·0.6, floor = 0.1 × the start value:
  each pass removes 40% of what is left (diminishing returns). One pending build and one hardening per family.
- **Upkeep:** 0.03 team-weeks/week × √(E/E₀) per suite on the 'upkeep' need (6 start suites 0.18 t-wk/wk ≈ 3% of the
  leader's start capacity). Unserved upkeep has no decay (like products and features) [D].
- **No per-run grader cash any more** (V1 charged hardened runs 0.5 × the RL FLOP's compute cost): the cost moved to the
  assets. `GRADERS`, `ENV_BUDGET_FRAC` and the Blueprint graders control are removed; `optionLocked('graders')` is no
  longer called (the ★ "Hardened graders" node and `OptionSlot 'graders'` stay as content; D6/F6 may retire them).

**Start values (sources)**
- Exploitability with cheap graders, per family (research/20 F1, METR o3 [P]): ML research 0.30 (RE-Bench 30.4%), SWE
  0.45 (Rust codecontest scaffold 43%, test special-casing), math 0.15 (checkable answers), computer use, long tasks,
  cyber, bio 0.025 (HCAST 0.7%, "≈1% typical"). Ratio math : SWE : ML = 1 : 3 : 2 = V1's family S2 table.
- Hardened = 0.4 × cheap (V1's 0.6 / 1.5): math 6%, SWE 18%, ML research 12%, others 1%.
- Per start type (`START_EXPLOIT_MULT`, a column of the start tables in data/v2/suites.ts) [D]: leader, challenger, big
  tech hardened (×1); spinout cheap (×2.5: bought environments, no red team). Fidelity 1 for every start (a follower's
  lag lives in know-how, V1 notes; a lower start fidelity would count it twice and shift the start-lag bisection).
- Expert data E₀ = 0.002T per family [D, units sourced]: Epoch RL-environment FAQ [P, research/12 §2] $200–2,000 per
  task (≈ $1k); ≈ $1B/yr lab-wide environment spend [UNVERIFIED, The Information via research/12]; half a year of it in
  the start suites = $0.1B per family ≈ 100k tasks × 20k tokens per task [D] → $0.05 per expert token.
- Reproduction: reference RL gain 0.7000 OOM (bit-identical), V0 unchanged; S2 0.36 leader/challenger/big tech, 0.90
  spinout (= V1's cheap); light 0.18, heavy 0.468 as V1.

**Behaviour changes (reported, not tuned)**
- Focused runs: V1 gave any SWE focus S2 0.36 and broad 0.36 (broad counted half weight on every family). Now S2 follows
  the RL compute share: SWE focus 0.77, math focus 0.34, ML-research focus ≈ 0.56, long tasks ≈ 0.16 (was 0). After P06
  broad spreads over 7 suites: S2 0.316 (was 0.36).
- The race bot asked for cheap graders (S2 0.9 under V1); it now trains on the hardened start suites (0.36) and never
  hardens or degrades them. The mixed/safe bots' "hardened graders" are the start suites. Bots table reported, not
  required (F5 may give the race bot a "skip upkeep"/cheap-environment policy if wanted).
- RefBot pays no grader cash: integrated ai2027 cash at the end 9 → 18 ($B), SIAR −0.041 → −0.030 y, ASI −0.016 →
  +0.022 y. Stub T1 identical to the baseline on every preset (ai2027 SC 2027.249, SAR .686, SIAR .874, ASI .974;
  authors2026 SC 2029.583 … ASI 2033.563; fast and slow the same).

- **finance F2 newly fails** (global production 2027 46.9M → 44.4M H100e vs the 45–60M band; one seed, RefBot + finance
  autopilot): explained and isolated — restoring only V1's per-run grader cash (0.5 × the RL FLOP's compute cost)
  reproduces the baseline exactly (46.9M, end-2026 cash $47.6B), and zeroing the suites' upkeep changes nothing. Paying
  less for runs shifts the autopilot's financing timing (end-2026 cash 47.6 → 38.7 $B) and its chip orders. The lead
  decides: accept (spec: the cost lives in the suites) or keep a per-run environment cost. F8 "out of distress through
  2026" 91.7% → 83.3% (still ≥ 75%).

**Gate (2026-11-20, machine shared with other agents):** tsc main + scripts clean; suites, effective, data,
golden-timelines, identity, worktypes, research, serving, products, calib (T1 stub identical to the baseline; T1L
identical), lint-ux, lint-tradeoffs, lint-structure, lint-hidden, fixtures, money, idle pass; test:ui 382/382 (new
check + screenshot `d5-blueprint-suites`). Known failures unchanged: safety S5 mixed; finance F7 ×2, F11; worldfx F7/F11
×2, equity, U +1 pp, GOV T1 (same values ±0.1 as the baseline); ws4 T3 ×2; hygiene performance (baseline fails the same
checks on this loaded machine: 1.6–2.0 ms vs 2.4 ms average, noisy). New: finance F2 (above).

**Save:** schemaRev 21 → 22 (renumbered 22 → 23 in M2). Migration 21 → 22: suites from the lab's latest graders choice (newest post run, else newest
full version): cheap → cheap, else hardened, at fidelity 1; D1's empty `expert` placeholder replaced by the six start
expert assets. `PostDesign.graders` is optional and read only there. Fixtures not regenerated (they migrate on load).

**For D6 (suites UI)** — `suitesView(s, focus)` (exported from the engine) gives per family: label, fidelity,
exploitability, expert data (T), the RL share a run with that focus gives it, builds/hardenings done, pending work; plus
the RL-weighted fidelity/exploitability and S2 before pressure. `suiteWorkCost(s, f, 'build'|'harden')` → team-weeks,
cash, tokens; `suiteWorkEffect` → before → after (fidelity or exploitability). Actions `suite.build` / `suite.harden`
with `{ family }` (previews have cost and gain lines). Show: a row per family (fidelity bar to 1.5, exploitable % with
its floor, expert data, share of the planned run), build/harden buttons with the preview, and the effect on the planned
run (ΔG per domain via `planRun(...).g.rl` and S2 via `postSignals`). Computer use shows "needs P06" until known. The
Blueprint's read-only row (`SuitesRow`, `data-test=bp-suites`) can link to the new view.

**For E3 (training pressure)** — read `suiteS2(w, exploit)` / `S2_PER_EXPLOIT`, the run's frozen `recipe.exploit` (and
`recipe.fid`), `suiteExploitMap(s)`, `suiteRlWeights(s, focus)` (RL compute shares). `postSignals(s, post, exploit?)`
kept its interface (one optional argument added). E3 replaces the budget multiplier with "rising with log RL compute"
(Gao) and calibrates κ and the per-family exploitability to research/20 F rates; the start values here are hack rates
by design so they can be compared directly.

### D2 notes (data actions on the data portfolio, 2026-11-20)

Code: `src/engine/v2/production/dataActions.ts` (the four actions, `DATA_ACTIONS` in `MODEL_ACTIONS`),
`src/engine/v2/production/data.ts` (deals: `licenceAsset`, `expertDomainAsset`, `addAsset`, `queueData`, `deliverData`,
`expertStockT`, `takeExpertData`; synthetic jobs: `synPoolH100e`, `synAssetFor`, `synTokensT`; `usageRateAt`; readout
`dataDelta` / `dataDeltaText`), numbers in `src/data/v2/dataAssets.ts` (`LICENCE_TIERS`, `WEB_LICENCE`, `USAGE_LEVELS`,
`EXPERT_DELIVERY_DAYS`, `SYN_JOB`), `models/suites.ts` (build uses bought expert data), types `PendingData`, `SynJob`,
`DataPortfolio.pending` / `.synJob`. UI: Relations › Research & data (domain and teacher pickers, variants). Glossary
`dataLicence`, `synJob`, `expertData`, `usageData`. Tests: `scripts/v2/data.ts` (section "data actions", usage policy,
saves), `uitest.mjs` (D2 checks, screenshot `d2-relations-data`).

**Actions**
| id | what | cost | effect | source |
|---|---|---|---|---|
| `data.license` {domain, tier, tokensT} | licensed corpus in one domain, asset `lic:<domain>:<tier>` (mix = that domain), delivered after 60 d | cash at signing: bulk $0.1B/T, curated $2B/T, premium $30B/T; default sizes 5T / 0.5T / 0.05T ($0.5 / 1 / 1.5B) | q 1.5 / 2 / 3 into U = Σ q·T | q: R20 A3 curated 1.5–3 [G/P]; premium price: Bartz ≈ $3,000/book at ≈ 100k tokens [V, research/08]; bulk: reported Reddit–Google ≈ $60M/yr [UNVERIFIED]; curated geometric middle [D]; delivery 60 d [D] |
| `data.license` {domain: 'web'} | the old blanket "License data" (D3): licenses the crawl, once | $1B + $0.005B/T unlicensed (270T → $2.35B, v2) | `public.licensed` → copyright-suit hazard (china.ts) reads 0; creatives +10; **no tokens** | v2 numbers |
| `data.synthesize` {teacher, share, days} | `share` of the synthetic pool generates with the chosen teacher for `days` (default: strongest version, whole pool, 90 d); `days: 0` stops; the rest of the pool keeps the default teacher (internal research model) | compute (H100e-days of the pool, already paid) and the default teacher's tokens forgone (shown) | tokens = `synTokensPerH100eDay`(teacher fpt) × H100e-days into `syn:<teacher>` (q = `syntheticQuality`(teacher G), `teacherId`, `teacherG`, `inheritsTraits: true`) | D1's rules |
| `data.expert` {domain, tokensT} | expert data by domain, asset `expert:dom:<domain>` (q 3), delivered after 30 d | $50B/T = $0.05 a token (D5's price; default 0.002T = $0.1B) | a `suite.build` of a family whose domain matches takes these tokens before buying (one purchase path); not pretraining (U unchanged); D7 can read it | D5 / Epoch FAQ [P]; delivery [D] |
| `data.usagePolicy` {level} | none 0 / standard 0.2 / broad 0.5 of eligible (consumer) output kept | Civil Liberties bloc approval +4 / 0 / −6 (applied as the difference on a change) | usage accrual × share | shares and approvals [D]; civlib = closest existing privacy relation (research/08 §1.11) |

Every preview's gain line carries `dataDeltaText`: U before → after, the domain's share of the stock (natural mix) and its
specialisation s_d on that mix, and the latest base design's epochs (the Blueprint Data tile's draw). Previews work with
empty params (lint-tradeoffs).

**One expert purchase path.** `suiteWorkCost(build)` now returns `fromStockT`: min(build tokens, bought expert data in
the family's domain); the cash is (tokens − fromStock) × $50B/T; `suite.build` takes the stock when queued (lost if the
build is cancelled, like its cash). Without bought data the cost is D5's ($0.1B), so D5's numbers are unchanged.

**Findings for the lead / D4 / D9 (not tuned)**
- *Licensed data barely moves U at realistic prices.* A premium deal buys 0.05T (0.15T quality-weighted) against U ≈
  310T; quality enters G only through U (D1's rule), and below repetition it does nothing. Licences matter for short
  domains that repeat (PHYS, MEDIA under multimodal: 1T curated PHYS = +2T, PHYS natural share 4.55% → 5.16%, s +0.08
  OOM) and for the natural mix's specialisation. A mix-quality term at D < U (D3 left it out) would give premium data a
  role; D4/lead decide.
- *A stronger teacher yields fewer quality-weighted tokens per H100e-day.* Tokens ∝ 1/fpt while q rises 0.25 per OOM of G:
  on the day-400 fixture V31 (G 28.98, q 0.75) gives 5.2T/day vs V0 (G 27.97, q 0.5) 9.2T/day (q·T 3.9 vs 4.6). Under
  U = Σ q·T the efficient teacher maximises q(G)/fpt, i.e. a distilled mini of a strong model. D9 (P10 flywheel) may
  revisit.
- The web licence adds no tokens (v2's "× 1.5 per deal" double-counted the crawl). The safe bot now calls it (once);
  RefBot never used D3, so golden dates are unchanged.

**Save.** schemaRev 22 → 23 (renumbered 23 → 24 in M2): `DataPortfolio.pending` (required; migration 22 → 23 sets `[]`)
and optional `synJob`. Tested: a schemaRev-22 save migrates with the same U; deals and jobs round-trip; day-400 fixture
loads. `hygiene` asserts `SCHEMA_REV === 23`.

**For D4 (data UI).** A portfolio view from `portfolioByKind` plus the pending deals (`dataPortfolio.pending`: asset,
due day) and the running job (`synJob`: teacher, share, until; `synJobTerms(s, p)` gives H100e-days, tokens and the
default teacher's tokens). Action forms: licence (domain picker incl. "web crawl", tier with q and $/T, size → cash via
`licenceTerms`), expert (domain, size → `expertTerms`, families served), generation (teacher list with each teacher's G,
q and tokens per H100e-day: `synAssetFor` / `synTokensT` — show q·T per H100e-day so the mini-teacher trade is visible),
usage policy (three levels with usage tokens/day via `usageRateAt` and civlib approval). Before → after for any change
via `dataDelta(s, change, domain)` (structured, not only the text). Today's minimal wiring lives in Relations › Research
& data and can move to the data view.

**Gate (2026-11-20).** tsc main + scripts clean; data, suites, effective, golden-timelines, identity, worktypes, research,
serving, products, calib (T1 stub identical to D5: ai2027 SC 2027.249 / SAR .686 / SIAR .874 / ASI .974; authors2026,
fast, slow the same), fixtures, money, idle, lint-tradeoffs / -structure / -ux / -hidden / -tips pass; test:ui 385/385
(D2 checks, screenshot `d2-relations-data`). Failures unchanged from D5: safety S5 mixed; finance F2 (44.4M), F7 ×2, F11;
ws4 T3 ×2; hygiene performance (loaded machine). worldfx not re-run (no demand code touched).

**UI note for D4/F6.** The previews' gain amounts use the `progress` currency, which the generic preview row labels "L"
(levels): "+7.50 L" there means +7.5T of U (the target text says so). suite.build has the same mismatch; the data view
should show its own units.

### E3 notes (training pressure from run quantities, 2026-11-20)

Code: `src/engine/v2/safety/traits.ts` (signals section rewritten: `postSignals`, `baseSignals`, `distillSignals`,
`runSignals`, `runOmega`/`runRho`, `hackRates`, `optimisationPressure`, `prefShare`, `aiDataShare`, `syntheticShare`,
`sameBaseFamily`; `TraitEnv.omegaSafety`), `src/data/v2/runDesign.ts` (design-table signals removed; `RL_FAMILIES.taskH`),
`models/design.ts` (`baseEffect`/`postEffect`/`rlFocusEffect` no longer carry signals), `models/runs.ts` (base and version
signals are the engine's; the run card and `run.signals` are `runSignals`), `core/selectors.ts` (`runTraitPressure` uses
`runOmega`). Test: `scripts/v2/signals.ts` (in `test:v2` after `suites`). No state changed: no schemaRev bump.

**Rules (MODEL-V3 §11.2).** ρ = the run's RL FLOP ÷ its base's pretraining FLOP (standard 0.15 = ρ_ref); w_f = the RL
compute shares over the families with a suite (D5's `rlWeights`; a run's frozen suites set them).
- **S2** = S2_PER_EXPLOIT (5.538, D5) · Σ_f w_f·x_f · p(ρ) + P11 0.2, with **p(ρ) = 1 + 0.71·log₁₀(ρ/ρ_ref)**, ≥ 0.1.
  Source: Gao, Schulman & Hilton 2022 (R20 F1): RL gold reward R = d·(α − β·ln d), d = √KL, so the over-optimised
  share of the proxy's reward (β·ln d/α) rises linearly in log d. Slope 0.71 [fit]: V1's budget table (light ×0.5 at
  ρ 0.03, heavy ×1.3 at ρ 0.4) lies on the line (0.715 / 0.704 per decade). Gao's coefficients (small RMs, BoN/PPO) are
  not transferred, only the form. Per-family **hack rate h_f = x_f·p(ρ)** (`hackRates`): at the reference pressure the
  suites' exploitability is D5's 2025 observed rate (METR o3: RE-Bench 30%, SWE scaffolds 43%, HCAST ≈1%; hardened
  × 0.4), so S2 = 5.54 × the RL-weighted hack rate (6.5% at the reference → 0.36).
- **S3** = K_S3 · Σ_f w_f · log₁₀(1 + H_f) over agentic families; H_f (`RL_FAMILIES.taskH`, hours) = SWE work type 2 h,
  ML research = EXP 8 h (RE-Bench's 8-hour tasks), long-horizon = IDEAS 40 h, computer use and cyber 1 h [D]; math, bio
  0. Log task length [D] (METR horizons are log-scale). K_S3 = 1.345 [fit]: broad over the six start suites = V1's 0.75.
- **S1** = PREF_S1[method] · prefShare(ρ)/prefShare(ρ_ref), prefShare = 0.016/(0.016 + ρ) (9.6% at standard). The
  preference stage is a fixed size: InstructGPT's PPO-ptx was 60 vs GPT-3's 3,640 petaflop/s-days = 1.6% of
  pretraining [P, Ouyang et al. 2022 §5.1; not in research/ yet]. Method multipliers stay V1's [D]: engagement 0.9 >
  persuasion 0.6 > constitution 0.4 > minimal 0.1.
- **S4** = COT_S4[cot] (unchanged), and training against a COT-family technique counts as 'pressured' (0.8): Baker et
  al. 2025, monitor in the reward → obfuscated reward hacking (R20 F1). Goodhart's own OBF +0.1 and masks unchanged.
- **S5 (base)** = 0.2·(AI-related share ÷ the reference's) + **0.05 per OOM of the base's G_pre above 25.7** (so B0 at
  27.30 has V1's 0.08 = 0.1 × start tier 0.8). Scale: Berglund 2023 / Laine 2024 SAD (out-of-context reasoning and SA
  improve with scale; research/14 E07); slope 0.05 [fit: least squares on V1's 0.2 + 0.1·tier along RefBot's bases,
  ai2027 seeds 500–501, net of the AI-data term]. AI-related share of the draw = Σ_d share_d·f_d (RSCH 10%, CODE/SOCIAL/
  MEDIA 2%, rest 0.5% [D]; reference mix 2.21%) on non-usage tokens + usage share × 0.25 [D: the lab's own assistant
  transcripts]; safety pretraining removes 75% of it [fit: V1's −0.15 at the start]. Replaces BRIDGE(V6) (`sizeS5`, the
  run's scale vs F(t)) and the know-how tier (one number in every world now). **S5 (post)** = 0.3·w_longHorizon [D: V1's
  0.1 at half weight].
- **S6 (base)** = 0.1 + 0.3·(synthetic share of the draw − the reference start's 3.2%) [D: 0.3 per unit share = a
  distillation run's V1 value]; **post** 0.1 (narrow fine-tunes baseline, V1; no fine-tune quantity exists yet);
  **distill** 0.3 (all teacher data). **Teacher pull (E06) only within a base family** (`sameBaseFamily`: same base or
  lineage; Cloud et al. 2025, R20 F3): distillation as before, and now also the post-run teacher path; a new base never
  inherits its synthetic data's teacher traits (new initialisation). The synthetic preset's V1 +0.3 is gone: the share it
  actually draws sets S6.
- **S7** = 0.05 + s7(ρ) + 0.6·w_mlResearch + 0.3 per behavioural detector trained against, s7(ρ) = 0.2·(1 + 1.35·log₁₀(ρ/ρ_ref)),
  ≥ 0 [fit: V1's light 0 / standard 0.2 / heavy 0.3 → 0.011 / 0.2 / 0.315]; direction R20 F5 (capability RL raises eval
  awareness 2% → 20.6%, Schoen et al. [R]). ML-research environments = eval-like (RE-Bench) [D: V1's 0.2 at half weight].
- **S8** unchanged (`deploymentS8`: copies, P05, P20; memory gates E22).
- Every post signal is clamped to [0, 1] (V1 let S3 reach 1.2 with two agentic focus families).

**ω.** `runOmega(s, run)` → `{ growth, safety }`. Base 1, continue 0.5, distill 0.4 (V1). Post: growth = **0.6·(ρ/ρ_ref)^¼**,
IDA 0.4·(ρ/ρ_ref)^¼ on its IDA_RL_SHARE; the safety-training side (removal, alignment brackets) keeps 0.6 / 0.4
(`TraitEnv.omegaSafety`): safety training is its own stage sized by the safety setting [D]. Source of the direction:
Gao's decomposition R = d·(α − β·ln d) — d (how far the policy moves) grows with optimisation, S2's pressure is the
ln d part; the fourth root [D] (5× less RL → ×0.67, 2.7× more → ×1.28). Stream days keep 0.6/42.

**Before → after (start, leader, ai2027; `npx tsx scripts/v2/signals.ts` prints it).**
| design | S1 | S2 | S3 | S5 | S6 | S7 | ω growth |
|---|---|---|---|---|---|---|---|
| reference post | .40 → .40 | .36 → .36 | .75 → .75 | .05 → .05 | .10 → .10 | .35 → .35 | .60 → .60 |
| heavy RL (ρ .4) | .40 → .16 | .468 → .469 | .75 → .75 | .05 → .05 | .10 → .10 | .45 → .47 | .60 → .77 |
| light RL (ρ .03) | .40 → 1.00 | .18 → .18 | .75 → .75 | .05 → .05 | .10 → .10 | .15 → .16 | .60 → .40 |
| coding focus (SWE) | .40 → .40 | .77 → .77 | 0 → .68 | 0 → .02 | .10 → .10 | .25 → .29 | .60 |
| long-horizon focus | .40 → .40 | .17 → .17 | .80 → 1.00 | .10 → .21 | .10 → .10 | .25 → .29 | .60 |
| ML-research focus | .40 → .40 | .56 → .56 | 0 → 1.00 | 0 → .02 | .10 → .10 | .45 → .67 | .60 |
| reference base (B0) | | | | .28 → .28 | .10 → .10 | | 1 |
| synthetic-heavy base (start) | | | | .28 → .28 | .40 → .13 | | 1 |
| synthetic-heavy, ×20 synthetic stock | | | | .28 → .28 | .40 → .26 | | 1 |
| code & math base | | | | .28 → .31 | .10 → .11 | | 1 |
| safety-pretrained base | | | | .13 → .13 | .10 → .10 | | 1 |
| distill | | | | | .30 → .30 | | .40 |
RefBot's bases (ai2027, seed 500): S5 (V1 applied, tier at completion) .296 / .368 / .513 → .33 / .41 / .46; S6 .10 →
.15 / .21 / .23 (its balanced draws are 20 / 39 / 47% synthetic by then).

**Behaviour changes (reported).** Light-budget runs now carry more approval pressure (S1 ×2.5, clamped at 1) on less
movement (ω ×0.67); heavy runs the reverse. Focused agentic RL gets S3 from its task length (V1 gave SWE and ML focus 0).
After P06, broad spreads over seven families: S3 .70, S5 .043, S7 .336 (V1 kept .75/.05/.35). The synthetic preset's
flat +0.3 S6 is replaced by its drawn share (weak at the start, growing with the stock); RefBot's naturally synthetic-heavy
bases get +0.05–0.13 S6 instead of 0.

**Calibration.** RefBot (integrated, ai2027, seeds 500–505, to the player's ASI): per-version trait paths within ±0.07
(PERSONA +0.04–0.07 from S6, CONCEAL/AF/SCHEME up to +0.05, SA ±0.05), Mis at ASI mean 0.476 → 0.479, P_mis mean 0.573 →
0.575, ASI days identical. Golden timelines, calib (stub T1, T1L, integrated T1) identical to the D5 baseline.

**For E4 (successor pull).** `inheritFromFleet` (INHERIT_K·(1 − 1/M) toward the internal agent) is still the
lineage-inheritance mechanism; E4 replaces its κ with AI share × (1 − oversight). Reuse `sameBaseFamily` for what can
carry traits subliminally (only same-family data; a new base is a new initialisation), the E06 pull in `stepTraits`
(`env.teacher`, ω·w_E06·(teacher − x)), `syntheticShare(draw)` and the synthetic assets' `teacherId` (D1) for how much of
a base's data the internal model wrote, `runOmega` for the run's movement.
**For E10 (rate calibration).** `hackRates(w, exploit, ρ)` gives per-family hack rates (the F1/F2 comparison: RL-weighted
6.5% at the reference, SWE 18%, ML research 12%, generic agentic 1%; heavy RL × 1.30, light × 0.50); the F2 "learned
hacking" threshold (h > 5% on any family) can read it. Knobs: `S2_PER_EXPLOIT`, `K_GAO`, `OMEGA_RL_EXP`, `K_S5G`,
`S5_AI`/`AI_*`, `S6_SYN`, `K_S7`; edge weights in data/v2/edges.ts. MacDiarmid's sabotage/AF rates and inoculation's
−75–90% are E04's (`playerMods` E04 × 0.15 with inoculation, unchanged).

**Gate (2026-11-20).** tsc main + scripts clean; signals (new), suites (budget check now "within 1%": light 0.181,
heavy 0.469), effective, data, golden-timelines, identity, worktypes, research, serving, calib (stub T1, T1L, integrated
T1 output identical to the D5 baseline), lint-hidden/ux/tradeoffs/structure, fixtures pass. **safety** (40 + 40 + 20
integrated games; baseline = v3-d5 HEAD run the same day): S4 RefBot P_mis at ASI 0.714 → 0.715 (Mis mean 0.576 →
0.575), safe-only 0.047 → 0.046; S5 RefBot median U − L at SAR −0.85 → −0.87; **S5 mixed stays the known failure**
(median min margin −0.89 → −0.94, holds in 45% → 40% of worlds). No new failures.

### D6 notes (RL environment suites UI, 2026-11-20)

Code: `src/ui/v2/panels/Suites.tsx` + `suites.css` (the view), `panels/Models.tsx` (tabs Versions | Suites),
`panels/Blueprint.tsx` (`SuitesRow`: summary + "Suites ›" link), `shell/Nav.tsx` (Models description),
`engine/v2/models/suitesPreview.ts` (output-only selectors, exported from `engine/v2/index.ts`), `data/v2/glossary.ts`
(new terms), `scripts/v2/uitest.mjs` (D6 checks), `scripts/v2/lint-ux.ts` (required terms). No state, mechanism or
schema change.

**Where it lives [D]: Models › Suites** (a second tab of Models; Versions keeps everything that was there).
- Suites are owned training assets that post-trains consume, like bases and versions: the actions are in the `models`
  sphere, the Blueprint (their consumer) sits in the same nav group, and a family's suite decides what a run can train on.
- Not Research: Research holds ideas and the recipe stacks. The lab-wide "Environments & rewards" stack (the RL ceiling
  a_RL that fidelity multiplies) stays on Research › Recipe; the suites card links there ("RL ceiling stack ›").
- Not the data portfolio: there is no portfolio view yet (D4). Expert data is shown here per suite because it is the
  suite's build state. **For D4:** the portfolio's `expert:<family>` assets should link to Models › Suites rather than
  repeat the tokens (one home), or D4 takes the datum and this column becomes a link.
- The Blueprint's post-train card keeps a one-line summary (RL-weighted fidelity and exploitable %, the run's own
  aggregate) and a "Suites ›" button that opens the view with the Blueprint's current post-train design as the planned
  run. Its tooltip no longer lists families (that is the view's datum now).

**What it shows**
- Planned run card (home `suitePlan`): base · post-train · RL budget, "from Blueprint" or "reference design"; focus
  pills (Broad + every family with a suite whose focus is not locked); S2 of the planned run as a number and a bar split
  by family (labelled when the name fits), tooltip = RL share × exploitability per family, the RL budget's pressure,
  P11. The planned run is `store.tab['models.plan']` (UI state, reset with a new game): the Blueprint's post params
  when opened from it, else the reference post-train on the latest base.
- Suites card (home `suites`), one row per family: fidelity bar (0.5–1.5, mark at ×1) and value; exploitable bar
  (0–50%, mark at the floor) and %; expert data (B/T tokens); RL share of the planned run; Build and Harden cells. A
  cell shows the button, its cost (team-weeks · cash) and the after value with the planned-run effect inline
  ("→ ×1.15 ΔG +0.05", "→ 11.5% S2 −0.06"); the tooltip has cash, team-weeks, done-in days (build queue), the
  suite's before → after, the planned run's RL ΔG before → after with the top domains, and S2 before → after (3 dp).
  Pending work replaces the button with "building · 3 d" (tooltip: team-weeks left, date, the result). Disabled
  buttons show `suiteWorkBlock`'s reason in the tooltip. Locked families (computer use) show "needs Computer use (P06)"
  with research progress; click opens the idea in Research › Tree.
- Footer: two cause chains (Build → expert data → fidelity → RL ceiling → ΔG; Harden → exploitable → S2 → gaming
  traits), every word a term. Links: Research › Recipe, Company › Work (engineers' load and upkeep stay there).

**Engine (output only, `models/suitesPreview.ts`)**
- `suitePlanEffect(s, lp)` → `{ rl: planRun(...).g.rl, s2: postSignals(...).S2 clamped, reason }`.
- `suiteWorkPreview(s, f, work, lp)` → cost, the suite's before → after, block reason, `buildWaitNew` days, and the
  planned run before/after; "after" is read from a shallow copy of the state with the work done (suites and the
  family's expert asset), never mutating `s`.
- `suiteS2Parts(s, post)` (S2 by family, pressure, P11), `suitePending(s, f)` (left t-wk, ETA from `buildEtas`),
  `lockedSuiteFamilies(s)`; `familyDomain` and `exploitFloor` exported.

**Glossary:** new `expertData`, `suiteBuild`, `suiteHarden`, `suiteRlShare`, `rewardHackPressure`, `plannedRun`;
`envSuite`, `suiteFidelity`, `suiteExploit` cross-linked. All nine are in lint-ux's REQUIRED list.

**Tests:** `test:ui` 413/413 (was 382 + the new D6 checks). `d6Check` at day 1 (fresh game), day 400 and day 900
fixtures: every suite shows fidelity, exploitable, expert data, RL share, build and harden; computer use reads "needs
P06"; S2 shown; tooltips on each value; build and harden previews have cash, team-weeks, before → after, ΔG and S2;
Build queues the work, pays $0.1B and shows a pending pill with an ETA; Harden queues; at day 1 and 400 the work is
stepped to completion and the result equals the preview (fidelity ×1.15; exploitable 11.5%, S2 0.30); a focus pill
changes the RL shares (day 900: ML research is the only unlocked focus). Blueprint "Suites ›" opens the view with
"from Blueprint". All nine terms seen as Term links. The `nav('models')` helper now opens Models on Versions (the
model-card checks need the card). Screenshots: `d6-day{1,400,900}-suites`, `-build-preview`, `-suites-after`, plus
the crawl's `10-/20-/30-…-models-suites`.

**Gaps**
- Day 1 and day 400 offer only the Broad focus pill (every single-family focus needs its idea); the pill check runs
  at day 900 only.
- The fixtures predate D5 (they migrate), so every suite starts at ×1.00 and 2B tokens there; differing values are
  exercised by the build/harden checks.
- The view does not offer RL budget or base choice (edit them on the Blueprint, then use "Suites ›").
- ΔG of a build is small (+0.01–0.05 OOM general, +0.06–0.16 on the family's own domain): shown, not tuned.

### E2 notes (AI labour on safety work through the work-type function, sabotage risk; 2026-11-20)

Spec: MODEL-V3 §6.3, §11.7; V3-BUILD V3.3 ("internal packages map to SWE / EXP / IDEAS / SAF_*"). Code:
`departments/workfit.ts` (`safetyLabour`, `handedLabour`, SAF_IDEAS humans, `sdAIOf` per work type), `safety/agents.ts`
(rewritten: readouts only), `safety/lineProjects.ts` (`lineLabour`, AI taste in `safSciOn`), `safety/findings.ts` (FALSE
weight), `safety/investigations.ts` and `safety/agendas.ts` (cases and tool upkeep on SAF_EXP), `departments/agentActions.ts`
(no gate, no cap, previews), `models/researchView.ts` (SAF_IDEAS view). UI: Agents (Trusted to AI control), Safety (policy
row, line tooltip), Work (safety work line). Data: `TRUSTED_MAX`/`TRUSTED_MAX_P27`, `AUTOMATE_MIN_L` and the
`trusted.cap` limit removed; glossary `aiDoneShare` added, `trustedToAI` rewritten. Tests: `scripts/v2/safetyresearch.ts`
§5b (new), `safety.ts` S6 and B3 rewritten for the new rule, `products.ts` A7 (no cap).

#### What drives safety AI labour now

`safetyLabour(s)` (memoised per state and day; reset with the safety allocation, i.e. after every action and in the
research system) runs the safety package through the capabilities functions:

- **coverage** a_w of SAF_EXP and SAF_IDEAS from the safety model's fit and horizon (`workFit`, its built scaffolds);
- **FTE and copies** from the package's compute (safety pool × `agents.safety.compute`), FLOP per token and the P05 /
  P20 / control-layer multipliers (`useLabour`, as every package);
- **effective labour** by the coding CES (`effLabour`), with one policy input: **Trusted to AI t = the share of safety
  work handed to the agents**. `handedLabour`: AI does A = t·a; humans do the rest, with the GDPval assist only on the
  handed part, so the human speed-up is the time-weighted mean (1 − A) ÷ ((1 − t) + t(1 − a)/assist). t = 1 is
  `effLabour` exactly (parity); t = 0 is humans alone. No model or no compute = nothing handed (t in effect 0).
- [D] The package's compute is spread over the two work types in proportion to the work AI does in each (A × human
  team-equivalents); SAF_IDEAS humans = scientists on research-line projects, SAF_EXP humans = safety research engineers.
- **Lines** (`lineLabour`): m_ideas and m_exp from the slots with the line's coverage a × Auto (research/14's automation
  factor read as the share of the line's work inside the work type's coverage: Carlsmith's "evaluable research
  automates"; Auto 1 = the work type, AG12 0.2). AG17's ×(1 + √(capacity ÷ SERIOUS_CAP)) now lifts the agents' labour
  (AI input) instead of v2's Auto [kept, E13 types it].
- **Taste**: `safSciOn` uses `teamTaste(z, sd_AI, φ)` like capability `sciOn`, sd_AI from the safety model's SAF_IDEAS
  fit (same domains and reference points as IDEAS), φ = t while the agents work on ideas. Star taste is not applied
  (E1 left it out; unchanged).
- **Cases and upkeep**: effective engineers × m of SAF_EXP (investigation gain ∝ √(FTE·m); upkeep heads × m inside
  the existing UPKEEP_MAX). Replaces v2's min(1 + 1.5t, √(1 + a/n)).

Removed special cases: the √M and min(10, √M) caps (`lineLabourMult`), `fleetMultiplier` and its 1 + 1.5t caps
(cases, upkeep), `AUTOMATE_MIN_L` = 8.5 [D, unsourced: research/14 §0 has no level gate] and `aiLabourGate` (also its
model lock in the Agents panel and the "locked" badge), `TRUSTED_MAX` 0.5 until P27 [D, unsourced] and the `trusted.cap`
limit, the serveCost bridge on the fleet's copies (BRIDGE(V6), now `copiesOf` on FLOP per token). Kept: the player's
Trusted to AI (0–100%), the package's compute share (≤ 60% of the safety pool), `AG17_MIN_L` (a tree gate on funding
AG17, not on AI labour; not in this brief), lineSpeed's F44 ×3 and P27 ×(1 + 3t) (E13).

#### Does safety automate later than capabilities? What the numbers show

Only through the V3 data: θ(SAF_EXP) − θ(EXP) = +0.28 OOM (v 0.5 vs 0.7: +0.10; RSCH weight 0.5 vs 0.4 + 0.2 AGENCY:
+0.18), θ(SAF_IDEAS) − θ(IDEAS) = +0.05 OOM (v 0.2 vs 0.3) plus the horizon factor at 80 h vs 40 h tasks. On the ai2027
RefBot run (seed 2027) the routine model's coverage crosses 0.25 / 0.5 / 0.9: EXP day 155 / 445 / 695 vs SAF_EXP 230 /
445 / 715; IDEAS 620 / 675 / 800 vs SAF_IDEAS 625 / 695 / 810. **The lag is 0–75 days (typically ≈ 20), i.e. one model
version at most.** Safety work is not automated "much later" by the data; what keeps it behind in play is the policy
(t < 1 caps the gain at (1 − t·a)^−1.5 under ρ_c = −2: t = 0.5 gives at most ×2.8 even with full coverage), the
package's compute (a share of the safety pool, against the capabilities agent pool) and sabotage risk.
Parity test: with SAF_* set to EXP/IDEAS's domains, H and v, equal people and agent compute, the multiplier is equal to
1e-16 at t = 1.

#### Sabotage rule (F49, kept)

FALSE weight in `fireFinding` = **the share of the line's work AI does** (A = t × a × Auto, stage-weighted: 0.2 ideas,
0.8 experiments) × sab (SAND + SCHEME + U-mode sab of the safety model). Investigation corruption = A of SAF_EXP × sab ×
(1 − tool verifiability). Detection unchanged (an AG02/AG08 NEG cross-check or an investigation with an independent
tool family reveals it). [D] A, not the AI part of the labour margin 1 − w_H: with abundant AI the margin share falls
to ≈ 0 although AI does the covered work (day 600 probe: A 0.57, 1 − w_H 0.000). A weak model handed everything does
≈ 4% of the work, so its sabotage weight is small (test). Previews (Trusted to AI, Investigate) show A × believed sab.

#### Calibration and readouts

- **Start pacing**: no bot (RefBot, safe-only, mixed, race, capex2x) sets Trusted to AI, so their runs are unchanged;
  E1's T₁ test passes unchanged. With the start model handed half the work at 20% of the safety pool: SAF_EXP a 5.3%,
  SAF_IDEAS 0.3%, m_exp 1.07, m_ideas 1.002, first AG08 result 90 → 89 d.
- Probe (ai2027 RefBot run, package 20% of the safety pool, t = 1 / 0.5): day 200 m_exp 1.85 / 1.32; day 600 5.1 /
  1.8; day 750 121 / 2.7; day 900 832 / 2.8 (capabilities EXP m 1700 at day 900). v2 capped the line multiplier at
  1 + t·Auto·10 = 6 at t = 0.5 before P27; now t = 1 is allowed and has no cap, so a lab that trusts its safety model
  fully gets capability-like speed-ups on safety research (and the matching sabotage exposure).
- **S4 / S5 (safety.ts, full run)**: identical to E1, because no bot hands safety work to AI. S4 RefBot P_mis 0.569
  (E1 0.569), safe-only 0.045 (0.045): pass. S5 RefBot still FAILS: median U − L at SAR +0.19, below L in 38% of worlds
  (E1 the same). S5 mixed passes: median min margin −0.03, U@SAR 12.35 vs RefBot 11.22 (unchanged). S6 and B3 (new rule)
  pass. E2 cannot move S5 unless a bot uses Trusted to AI: the S5 gap comes from E1's compute-scaled lines (F5
  rebalances the bots).

UI: test:ui 376/376 pass after the build; the Agents screenshot shows the safety lane's Trusted to AI stepper with no
cap or lock.

#### Gate

tsc main + scripts clean; safetyresearch all pass (31 checks, 14 new for E2); golden-timelines pass (known WARNs);
identity, worktypes, research, effective, serving, products, lint-ux, lint-structure, lint-hidden, lint-tips pass;
npm run build passes. calib: T1 slow SC FAIL 2037.772 vs 2038.527 ± 0.08 — the same value as E1's branch (the seed-2027
knife edge E1 reported; E2 does not change any bot run), not refit. Everything else in calib passes.

#### schemaRev

No change (no new state: `safetyLabour` is computed; Trusted to AI values ≤ 0.5 stay valid, the policy now ranges to 1).

### E5 notes (danger formula for incidents, 2026-11-20)

Branch `v3-e5` (from `model-v3`). Code: `src/engine/v2/safety/incidents.ts`, data `src/data/v2/danger.ts` (new; v2's
`INCIDENT_KAPPA` and `CHANNEL_EXPOSURE` removed from `data/v2/traits.ts`), one call in `actors/rivals.ts`. Test
`scripts/v2/danger.ts` (in `test:v2` after safety). No saved state changed: no schemaRev bump.

#### Formula (MODEL-V3 §11.3)

Per harmful act k, per site (a product, an open release, or one internal fleet), per day:

    attempts a_k = κ_k · D_k · C_k · O_k
    rate_k       = a_k · (1 − oversight_k),   oversight_k = 1 − (1 − block_k)(1 − catch_k)

- **Disposition** D_k = x_k^1.5, x_k the true trait (v2's convexity kept [D]: weak tendencies rarely become acts).
  U-modes: x = UMODE_X = 0.25 on their mapped trait's act; traits with no act use `UMODE_ACT`.
- **Capability** C_k = σ((L_d − θ_k)/s), s = 1 level [D]. Domains and θ [D]: SYC SOCIAL 4; RH CODE 5; PROXY AGENCY 5;
  CONCEAL AGENCY 6; POWER (overreach) AGENCY 7; SAND (research sabotage) RSCH 8; COLLUDE AGENCY 9; SCHEME CYBER 9
  (escape-like); U-mode fallback AGENCY 4.5. 2025 models (CODE 5, AGENCY 4, CYBER 4) are capable of sycophancy and test
  gaming, barely of cover-ups, not of overreach, sabotage, collusion or escape (research/05 §1.5, §1.9, §1.10: those are
  ≈ 0 in real 2025 deployments).
- **Opportunity** O_k = N · [(1 − α_k) + α_k·A·F] · (r for R&D acts, internal only).
  - N scale = usage share × (copies ÷ 2025 reference)^γ; internal copies = Σ work-type copies (workfit), ref 1e4,
    γ 0.2; products: serving-pool copies at the model's FLOP/token, ref 1e5, γ 0.1; open weights 1 [D: an act repeated
    over many copies is mostly one incident].
  - A autonomy = H/(H + 2 h) from the task horizon given [D]: consumer 0.1 h, API 0.5, enterprise/gov/trusted 1,
    Agents 4 (AGENT_TASK_HOURS), open 2; internal = its uses' work-type H (SWE 2, EXP 8, IDEAS 40, SAF_EXP 8) weighted by
    agent compute (≈ 0.76 at start).
  - F affordances [D]: consumer 0.3, API/enterprise/gov/trusted 0.5, Agents 0.8, open and internal 1.
  - α_k how much the act needs autonomy [D]: SYC 0, RH 0.5, PROXY 0.7, the rest 1.
  - r = AI share of the lab's R&D labour = 1 − ΣH/ΣL over SWE, EXP, IDEAS (V3 work types; 0.21 at start); multiplies
    SAND and SCHEME inside the lab.
  - Restricted status ×0.3, product features' per-trait multipliers (unchanged).
- **Oversight**: block = AG07 containment (control layer) and, for escape-like acts inside the lab (POWER, SCHEME),
  0.5 · WSL/5; catch = internally 1 − (1 − monitoringCatch [× 0.5 on unexplained U-modes])(1 − 0.3·(1 − r)) (monitors and
  tools, plus human review of the work humans still do [D 0.3]); on a product its monitor's `productCatch` (same-lineage
  collusion kept). Blocked attempts leave no trace; caught ones are internal incidents; the rest are harm (customer or
  public on products, `uncaughtInternal` inside the lab, as before).
- **κ_k** [C, per day at full D, C, O]: SYC 3.6e-3, RH 9e-3, PROXY 2.4e-3, CONCEAL 4e-3, POWER 6e-3, SAND 3e-3, COLLUDE
  2e-3, SCHEME 3e-3, U-mode fallback 2e-3. Calibrated on the reference run below (start near v2; growth with capability).
- **Severity** = ⌊f_k + span_k · C_k · A·F + u⌋, u ~ U[0,1), clamped 1..5 (stochastic rounding of the rule's value).
  (f, span) [D]: SYC (1, 1), RH (1, 2), PROXY (1, 2), CONCEAL (1, 3), POWER (2, 3), SAND (2, 2), COLLUDE (3, 2),
  SCHEME (3, 2), U-mode fallback (2, 1). Chat incidents are mild; the same act from a capable model with long tasks and
  real affordances is severe (overreach at L 9: 2.0 in chat, 4.0 inside the lab).
- **Misuse** (same structure): κ 5e-4 · demand (×2 minimal safety, ×3 for 90 days after a jailbreak) · σ((L_d − 9)/1) ·
  reach (serving share × v2's exposure table, ×0.3 restricted) · (1 − safeguards); severity 3 + 1.5·C. κ·σ is within
  ±34% of v2's 1e-4·(L − 7) on L 8–12.
- **Exfiltration** (E25, rolled by WS4): 4e-4 · POWER·(1 + 4·SCHEME) · σ((CYBER − 10)/1) · A_int·F_int·N_int ·
  (1 − WSL/5)(1 − Contain), 0 below CYBER 8 (θ − 2). The gate matters: without it WS4's security stream drew from day 0
  (v2 drew from Lg 9 ≈ CYBER 8) and RefBot's 2027 revenue moved −9% by RNG alone (bisected: finance F2 failed).
- **Rivals**: the same formula at a generic site (usage 0.2, A 0.5, F 0.7, block = their eval-rigor mitigation) [D/C];
  their misuse line and its 3–5 severity are unchanged.

`dangerOf(s, d, v, usage)` returns every act's terms, attempts, catch, oversight and harmful rate: the readout E11's
danger view can show per deployment.

#### Start rates and reference run (RefBot, ai2027, medium, 24 seeds, endings skipped)

Expected incident acts per lab-year (products + internal, all outcomes), v2 → E5:

| kind | 2025.5–26 | 2026–27 | 2027–28 |
|---|---|---|---|
| SYC sycophancy | 0.22 → 0.17 | 0.31 → 0.27 | 0.44 → 0.56 |
| RH reward hacking | 0.27 → 0.17 | 0.46 → 0.60 | 0.71 → 1.70 |
| PROXY | 0.033 → 0.009 | 0.053 → 0.043 | 0.081 → 0.150 |
| CONCEAL cover-ups | 0.061 → 0.006 | 0.168 → 0.078 | 0.269 → 0.360 |
| POWER overreach | 0.050 → 0.004 | 0.100 → 0.071 | 0.161 → 0.444 |
| SAND research sabotage | 0.007 → 0.000 | 0.021 → 0.013 | 0.042 → 0.170 |
| COLLUDE | 0.002 → 0.000 | 0.007 → 0.001 | 0.016 → 0.050 |
| SCHEME | 0.011 → 0.000 | 0.032 → 0.006 | 0.037 → 0.087 |
| U-modes | 0.61 → 0.35 | 0.61 → 0.62 | 0.57 → 1.25 |
| misuse (BIO + CYBER) | 0.000 → 0.002 | 0.000 → 0.004 | 0.033 → 0.041 |
| total | 1.26 → 0.70 | 1.76 → 1.70 | 2.37 → 4.81 |

Exfiltration expected per game 0.042 → 0.042. Incidents the player sees (realized, per lab-year, v2 → E5): 2025 0.25
→ 0.33, 2026 0.63 → 0.75, 2027 0.63 → 1.17 (the extra are mostly severity 1); severity 3+ about the same (2027: 0.25
→ 0.29). Silent harmful acts inside the lab (`uncaughtInternal`) 2027: 1.3 → 2.7. Milestone days unchanged (ASI mean
day 942.5 → 939.0; calib T1 output identical to before, line for line).

Real-world anchors (per lab, research/05 and research/20 F): sycophancy is the common chat failure (a public scandal ≈
every 1–2 years per lab); reward hacking 1–2% of agentic tasks (30% on exploitable scorers, F1) is the common agentic
failure; real-deployment cover-ups, sabotage, collusion and escape ≈ 0 in 2025, severe boundary violations 1e-4–1e-6
of 2026 agentic sessions. The start table matches that shape (SYC and RH dominate; POWER < 0.01/yr; SAND, COLLUDE,
SCHEME < 0.005/yr). Game incidents are notable events per lab, not per-task rates, so research/20 F's per-task rates
fix the ordering and ratios, not the absolute numbers; E10 calibrates per-run rates (hack rate per RL run etc.).

#### Deviations and choices

- κ_k is an explicit per-act scale (the spec's product of dimensionless factors needs one to be a daily rate).
- Catch stays a second roll at fire time (cheap path for the tick); `dangerOf` computes it eagerly for tests/UI.
- Human review is a [D] stand-in: 30% of acts in the human share of R&D (1 − r). E6 can replace it with a measured term.
- The containment term still reads the research multiplier M (BRIDGE(V6), E6 removes it).
- Products P5 (not owned): its sample now runs to 60 incidents, since Chat gets a smaller share of a model's acts.
- Honesty/corrigibility do not yet lower dispositions (v2 did not either); eval awareness does not raise real-deployment
  rates (Opus 4's ×8 real-vs-eval rule) — candidates for E10.

#### For E7/E8

- `modelHazards(traits, uModes, domains, site)` and `Site` are the building blocks: a covert act is a new `DANGER_ACTS`
  row (domain, θ, α, rd flag, security weight), measured "against the overseer's level" by passing a site whose catch
  reads the overseer (E6).
- `uncaughtInternal` counts harmful internal acts that got through; E8's footholds can be created at that branch in
  `fireIncident` (row.source, severity and the site are known there).
- `aiRdShare(s)` is the AI share of R&D for successor pull (E4) and sabotage of safety work (E7, add SAF_EXP when E2
  puts AI labour on it: SAF_EXP's L is 0 today).
- Gate results: tsc main + scripts, danger, safety (all passed, S5 mixed included), golden-timelines, identity,
  worktypes, research, effective, serving, calib T1 (identical to before), products, money, idle pass; known failures only
  (finance F7/F11, worldfx F7/F11 and GOV T1, ws4 T3, hygiene performance, which runs at the same cost as before on a
  loaded machine: the incidents system costs ≈ 20–40 µs/day more than v2, ≈ 1% of a tick, from the opportunity terms).

### M2 merge notes (D5 + D2, E3, D6, E2, E5 onto M1; 2026-11-20)

Merged into `model-v3` (at M1, a13156c) with `--no-ff`, in order: `v3-d2` (D5 39110f9, D2 30565b0 / 5ed4f78; merge
e0620e4), `v3-e3` (E3 dd901b9 / 59fb524; 3299f1e), `v3-d6` (D6 3b1d1dd; b872073), `v3-e2` (E2 42273df / 999fa15;
4c76b60), `v3-e5` (E5 9bce889 / 3d808e3 / c9ea246; cd83876). The notes of every branch are above (copies of
`design/notes/D5.md`, `D2.md`, `E3.md`, `D6.md`, `E2.md`, `E5.md`, which stay).

**Conflicts and resolution.**
- v3-d2: `package.json` test:v2 (kept M1's `safetyresearch.ts`, added `suites.ts` after `data`); `core/save.ts` (both
  import sets, rev comments, migrations: see the chain below); `hygiene.ts` (SCHEMA_REV); `Blueprint.tsx` imports (A5's
  `studentToHold` and D5's `suitesView`). types.ts, glossary.ts, bots/ref.ts, models/actions.ts auto-merged.
- v3-e3: `package.json` only (`signals.ts` after `suites`). traits.ts merged cleanly with D2 (E3 reads the drawn
  synthetic share; D2's synthetic jobs add assets the draw already sees).
- v3-d6: no textual conflict, but two semantic breaks fixed in the merge commit: D6's `suitesPreview.ts` imported D5's
  `intensityS2` (the RL budget multiplier), which E3 replaced by `optimisationPressure(ρ)`; the preview now reads p at
  the design's budget share (`RL_BUDGET[post.rlBudget]`, as `postSignals` does without run quantities), so light / heavy
  still show 0.50 / 1.30. Glossary `expertData` was added by both D2 (buying) and D6 (in a suite): one entry with both.
  `rewardHackPressure` now names E3's pressure law (1 + 0.71·log₁₀(ρ ÷ 0.15)).
- v3-e2: none (save.ts's 8 → 9 migration now clamps Trusted to AI at 1 instead of `TRUSTED_MAX_P27`, auto-merged).
- v3-e5: `package.json` only (`danger.ts` after `safety`).
- test:v2 now runs every new test: data, suites, signals, safetyresearch, danger.

**schemaRev chain (linear): … 19 → 20 B4, 20 → 21 D1, 21 → 22 E1, 22 → 23 D5 (`suitesFromV1`, start expert assets),
23 → 24 D2 (`dataPortfolio.pending`); SCHEMA_REV 24.** D5 and D2 had been built as 21 → 22 → 23 beside E1's 21 → 22.
E1's migration (line-project stage state) and D5's (suites) touch disjoint state, so the order E1 → D5 → D2 is safe.
hygiene expects 24 and gained a 22 → 23 check (a save without suites or expert assets gets six start suites, each with
its `expert:<family>` tokens) and a 23 → 24 check (no pending deals, no job); its 20 → 21 and 21 → 22 checks pass
unchanged. `data.ts`'s D2 save test now starts at 23 (→ 24), `suites.ts`'s migration test runs the chain to 22 and
then migration 22 (D5). **Fixtures** stay the committed schemaRev-16 files, so every fixture load runs 16 → 24;
`fixtures.ts` rewrote them during the gate and they were restored.

**E5's `aiRdShare` after E2 (for E7).** E5 found SAF_EXP's effective labour 0 and left it out of the AI share of R&D r.
After the merge SAF_EXP has labour through `safetyLabour(s).exp` (not in `workContext().slots`, so `aiRdShare` and
`internalScale` still ignore it). Probe on the fixtures with the safety package at 20% of the safety pool: day 400
SAF_EXP H 1.0 team, L 1.00 / 1.35 / 1.98 at Trusted 0 / 0.5 / 1; r 0.588 without SAF_EXP vs 0.580 / 0.582 / 0.586 with
it; day 900 L up to 832 (m = 832 at t = 1) but r 0.999 either way (capabilities L ≈ 57,000). So adding SAF_EXP moves r by
< 0.01 today; it matters for E7 because sabotage of safety work should read the AI share of *safety* work (A of SAF_EXP,
E2), and the safety fleet's copies should join `internalScale`. Left to E7 as the lead decided.

**Lead decisions.**
- D5: finance F2 dip accepted (the finance session owns finance; the spec moves per-run environment cost into the
  suites). A suite build's small RL effect (+0.01–0.05 OOM general, +0.06–0.16 on its own domain) noted for E10/F5, not
  tuned.
- D2: licences barely move U → new task D11 (quality of drawn tokens in the loss law; running on `v3-d11`); the
  synthetic-teacher finding (a strong teacher yields fewer q·T per H100e-day) → D9 re-checks it; the previews' "L" units
  → D4 fixes them.
- E2: accepted. RefBot never uses Trusted to AI → F5 note: RefBot should hand safety work to AI as AI 2027 labs do.
- E3: accepted; light-RL S1 at the 1.0 cap and the synthetic-heavy S6 from its drawn share are intended.
- E5: accepted; E7 must add SAF_EXP to `aiRdShare` (above).
- M1's: authors2026 Δ_bm 4.6 accepted; safety S4 RefBot and S5 RefBot accepted as known → E10; finance F2 since A5 →
  finance session.

**Refits: none.** calib T1 and T1L pass on every preset with M1's values (seed 2027): ai2027 SC 2027.249 (Δ 0),
SAR +0.020, SIAR −0.043, ASI −0.029; authors2026 SC −0.006, SAR +0.022, SIAR −0.028, ASI +0.039 (days 1493 / 1581 / 2141 / 2990, the same
milestone days as M1); fast SC −0.002; slow SC 2038.577 (+0.049, identical to M1). The merges change no RefBot stub path (as each branch
reported).

**Gate (merged code, cd83876 + docs).**
- tsc main + scripts clean; `npm run build` ok; `npm run test:ui` 416 passed, 0 failed.
- Pass: golden-timelines, identity, effective, data, suites, signals, research, safetyresearch, worktypes, serving,
  danger, products, calib (T1, T1L), fixtures, lint-hidden, lint-ux, lint-tradeoffs, lint-structure, lint-tips, money,
  idle.
- hygiene: all pass except the four known perf checks (7.2 ms passive, 8.6 ms leader lab daily average, worst quarter
  31 / 30 ms; machine shared with other sessions). Save checks incl. 20 → 21, 21 → 22, 22 → 23, 23 → 24 pass. (An earlier
  run right after the first merge also failed "leader lab's own cost ≤ +20%" at +21.2%; it passed in the gate run:
  noise at the threshold.)
- finance: F2 43.1M (M1 43.2M), F7 revenue median $30.5B, F7 valuation $0.28T, F11 2027 $35.5B — the M1 set.
- ws4: T3 lead 28–371 d and post-theft lag — the known T3.
- worldfx: F7/F11 2026 $33.5B, equity 2026 −13.9%, GOV T1 2027-09-08, W2 0.5% (the accepted borderline) as in M1, but
  **F11 2027 $31.9B (M1 $36.5B) and U +1 pp "never" (M1 2028-01-26)**. Bisected: the merge before E5 (4c76b60) and the
  D merge alone (e0620e4) give $36.6B and U 2028-02-26, so the E5 merge moves them. E5 on its own branch moved the same
  run the other way (672c4c1 → v3-e5: 2027 $40.7B → $50.1B, U 2028-01-02 → passing, equity −0.4% → passing), so this
  is the one-seed path's sensitivity to the incident stream (E5's notes found RNG alone moved RefBot's 2027 revenue by
  9%), not a demand mechanism. Both checks were already failing (finance-owned revenue; U was out of its window);
  listed as known.
- safety (slow): S4 RefBot P_mis at ASI **0.485** (M1 0.530; band 0.55–0.85; accepted → E10); S5 RefBot fails (median U
  − L at SAR +0.50, below in 30%; accepted); S4 safe-only 0.011 and S5 mixed (margin +0.03, holds in 70%) pass; E2's S6
  and B3 pass. Attribution: before E5 (4c76b60) S4 RefBot is 0.517 (D5/D2/E3/D6/E2 together −0.013 from M1), E5 takes
  it to 0.485 (−0.032: the danger formula changes incident and detection paths).

### D4 notes (data UI: Models › Data and the Blueprint's drawn mix, 2026-11-20)

Code: `src/ui/v2/panels/Data.tsx` + `data.css` (the view), `panels/Models.tsx` (tabs Versions | Data),
`panels/Blueprint.tsx` (data slot: Natural preset, drawn-mix row `DrawRow`), `panels/Relations.tsx` and
`data/v2/actions.ts` (data actions removed from the catalogue, link to Models › Data), `engine/v2/production/dataView.ts`
(output-only selectors, exported from `engine/v2/index.ts`), `data/v2/runDesign.ts` (`BASE_DATA.natural`),
`types.ts` (`BaseDesign.data` gains `'natural'`; `CostLine.unit`), `actors/fx.ts` (`L(..., { unit })`), preview units in
`production/dataActions.ts` and `models/suites.ts`, `ui.tsx` / `kit.tsx` (unit-aware preview text), `data/v2/glossary.ts`,
`scripts/v2/uitest.mjs` (D4 checks), `scripts/v2/lint-ux.ts` (required terms). No state, mechanism or schema change.

**Where it lives [D]: Models › Data** (a tab of Models next to Versions; D6's Suites tab joins it on merge).
- Data is an owned training input that bases consume, like the suites that post-trains consume: the data actions are in
  the `models` sphere, the Blueprint (the consumer) sits in the same nav group, and the Blueprint's data slot links here.
- Not Research (ideas and recipe stacks) and not a nav item of its own (one more L0 entry for an L2 view).
- Relations keeps only the relation effects (Civil Liberties and Creatives approval show in its bloc table); its
  "Research" group (was "Research & data") now holds D1/D2 only and the header links "data deals: Models › Data".

**One home per datum**
| datum | home | elsewhere |
|---|---|---|
| portfolio by kind (tokens, q, U, domain mix, today's flow), pending deliveries, crawl licence state | Models › Data (portfolio card, `data-home=dataPortfolio`) | – |
| natural mix vs reference shares, its specialisation | Models › Data (`naturalMix`) | Blueprint "Natural" card preview only |
| licence / expert / generation / usage forms | Models › Data (four cards) | Relations: link |
| the base's drawn (effective) share per domain, s_d with the ±1.3 cap, most-repeated domain epochs | Blueprint data slot (drawn-mix row) | – |
| tokens vs unique tokens for this mix, epochs, compute kept, mean quality | Blueprint Data tile (as D3) | drawn-mix row's tooltip points there |
| each suite's expert data | Models › Suites (D6) | Data: expert row shows the kind total and unbuilt stock by domain + a "Suites" link |

The Data tile's tooltip no longer lists the top-3 specialisations (they moved to the drawn-mix row).

**What it shows**
- Portfolio card: U hero (Σ q·T, tooltip per kind), one row per kind: tokens, mean q, U bar (q × tokens; expert "not in
  U"), a 9-cell domain heat strip (sequential ramp, one tooltip per cell), and today's flow (crawl coverage and licence,
  corpora and pending, usage tokens/day at the policy, synthetic tokens/day incl. a job, expert unbuilt + Suites link).
  Pending deliveries as chips (domain, tier, tokens, days to go; tooltip with q, ΔU and the date).
- Natural mix card: per domain a diverging bar of the specialisation a natural-mix base of the latest base's size would
  get (±1.3 OOM scale, cap marked "(cap)" in the tooltip), share vs reference share.
- License data: domain pills incl. Web crawl, tier pills with q and $/T, size pills (×0.2 / ×1 / ×4 the tier default),
  cost and before → after (U, the domain's share of the stock, its natural-mix specialisation, the latest base's epochs).
- Generate data: teacher table (G, q, tokens per H100e-day, yield = q × tokens with a bar; "default" and "best yield"
  tags: the mini-teacher trade is visible), pool share and days pills, H100e-days → tokens at q vs the default
  teacher's U gain, before → after; the running job in the header with Stop.
- Buy expert data: domain, size, cost, unbuilt stock before → after, the suite families it serves.
- Usage-data policy: three level cards (share kept, usage tokens/day at today's traffic, U a year in the tooltip, Civil
  Liberties approval), Switch on the others.
- Blueprint (base run): a "Natural" data preset ([D] `BASE_DATA.natural = { base: 'natural' }`, the lead's request in
  D3; RefBot keeps Balanced, so no golden change) and, under the data slot, the drawn-mix row: per domain a small bar of
  the effective drawn share (√ scale) with a reference tick and s_d below (green/red; underlined at the cap), the
  most-repeated domain and its epochs, a quality chip whose tooltip names the preset (starts from, tilts, tokens by
  kind), and "Data ›". Domain tilts as a free control were not added: they need a new `BaseDesign` field (state).

**Preview units.** `CostLine.unit` (optional, display only) replaces the currency label in previews: data gains read
"T unique tokens" (licence, generation, usage: "a year"), expert "B expert tokens", generation compute "M H100e-days"
(it was shown as a % because the compute formatter treats ≤ 1 as a share), suite build "fidelity". `L()` takes
`{ unit }`. Other `progress` lines keep "L" (they are research speed, days or levels; a general clean-up is F6's).

**Engine (output only, `production/dataView.ts`)**: `dataPortfolioView(s)` (rows from `portfolioByKind`, U, pending,
flows, crawl, expert unbuilt / in suites, usage level), `naturalMixView(s)`, `drawByDomain(s, draw)` (per-domain drawn
and effective share, ref, s, epochs = drawn tokens ÷ the domain's quality-weighted unique tokens), `mixTargetOf`,
`licenceForm` / `expertForm` / `synForm` / `teacherRows` / `usageLevels` (terms + structured `dataDelta`). No reader in
the engine; D11 can change `data.ts` internals freely as long as `dataDelta`, `drawData`, `portfolioByKind`,
`synAssetFor`, `synTokensT`, `syntheticQuality`, `usageRateAt` keep their signatures.

**Glossary**: new `dataPortfolio`, `uniqueTokens`, `dataQuality`, `publicWeb`, `licensedData`, `licenceTier`,
`syntheticData`, `teacherYield`, `naturalMix`, `refShare`, `drawnMix`, `domainEpochs`, `pendingData`; `dataMix` rewritten
(Balanced = reference shares, as D3 made it; Natural added). All in lint-ux REQUIRED with D2's data terms.

**Tests** (`test:ui` 450/450): `d4Check` at day 1 (fresh game), day 400 and day 900 fixtures: five kind rows with values,
U on screen = Σ q·T from the state, nine natural-mix rows, tooltips (U, natural row, kind U, domain cell, today's flow,
teacher, usage level, before → after), previews in token units with no "L"; actions: licence (PHYS bulk 5T) queues a
deal whose q·T equals the previewed ΔU and costs the previewed cash, shows as pending; expert order = previewed size and
cash; generation job with the best-yield teacher is set for the picked days and one day adds the previewed tokens/day
(±15%; day 1 and 400 — at day 900 no step, the fixture can end within days) and Stop ends it; usage → broad keeps 50%
and moves Civil Liberties approval by the previewed −6. Blueprint: the drawn-mix row has 9 domains and the most-repeated
domain; Code & math raises CODE's drawn share (9.6% → 20.8%) and s (0 → +0.51); Natural draws the portfolio's own CODE
share (day 400: 26.9%, s +0.67; day 900: 33.2%, s +0.81); "Data ›" opens Models › Data; all 18 data terms reached as
tooltips. D2's Relations check became "no data actions in Relations, a link to Models › Data"; D3's specialisation
check reads the drawn-mix row. `nav('models')` opens Versions (like D6). Gate: tsc main + scripts, build, lint-ux,
lint-hidden, lint-tradeoffs, lint-structure, data test pass.

**Screenshots looked at**: `d4-day{1,400,900}-data`, `-data-after`, `-blueprint-natural`, plus the crawl's
`10-models-data`, `30-day900-models-data`. Fixed during the pass: wrapped domain pills (smaller pills, wrap with gaps),
teacher rows boxed per cell, "−0.00", "1 corpora", label wrap, empty space under the licence card (two columns of forms).

**Merge with D6 (v3-d6)**: both add a Models tab (`Tabs` with Versions | Suites vs Versions | Data) and both define the
glossary term `expertData` (keep one: D6's text is about suites, D2/D4's about purchases; merge the two sentences). The
Data view's "Suites" links go to `{ panel: 'models', tab: 'suites' }`, which is live only after the merge (until then
Models falls back to Versions). D6 also edited `nav('models')` in uitest the same way.

**Gaps / for the lead**
- The Blueprint's "Licensed data" slider (`licensedShare`) still costs cash at launch but no longer drives litigation
  (D1 moved the hazard to the unlicensed crawl): it now does nothing but cost. Its tooltip and the plan warning were
  made truthful ("Unlicensed web crawl: copyright-suit risk"); removing the slider is an engine change (runs.ts cash) for
  a later task.
- Fixture artefact: right after loading the day-400 fixture `computeOnline` reads 3.8M H100e and the next tick 2.2M, so
  generation previews on a freshly loaded fixture overstate the pool by ×1.7 until one day passes (the test steps a day
  first). Live games are not affected.
- Usage data at day 900 is only ≈ 4M tokens/day (day 400: 41B/day): the consumer product's served H100e is small on that
  fixture. Not a UI issue; D11/A-tasks may want to look.
- Two versions can share a name (day 900: two "Atlas-4.0-mini"); the teacher table shows both (ids in the job state).

### D11 notes (quality of the drawn tokens in the loss law, 2026-11-20)

**Lead decision after the first stop (applied).** (1) Synthetic quality is capped at the web's: q = min(1, 0.5 +
0.25·(G_teacher − G_V0)), floor 0.1 (`SYN_Q.max` 1.5 → 1, `src/data/v2/dataAssets.ts`) [D]: research/20 A3's synthetic
0.5–1.5 is a guess with no primary source for synthetic tokens beating human web text, and since D11 quality acts in
the loss law, a cap above 1 lets a lab's own synthetic data lift every later base on an unsourced number. Glossary
`synJob` updated. (2) No V3_CAL refit here: calibration is refit once on the merged code (M3); the stop rule is waived
for D11. (3) No quality-aware draw (the draw already samples ∝ q·T within a domain). (4) D4 notes below.

**calib T1 with the cap** (stub; Δ vs golden in years; before D11 → D11 uncapped → D11 with the cap; **bold** = fails):
| preset | SC | SAR | SIAR | ASI |
|---|---|---|---|---|
| ai2027 | +0.000 → +0.019 → +0.019 | +0.022 → +0.041 → +0.041 | −0.041 → −0.005 → −0.005 | −0.030 → −0.003 → −0.003 |
| authors2026 | −0.008 → −0.008 → +0.030 | +0.016 → +0.019 → +0.047 | −0.074 → +0.049 → **+0.173** | −0.082 → +0.118 → **+0.315** |
| fast | −0.003 → +0.093 → **+0.093** | +0.096 → +0.189 → **+0.189** | −0.019 → +0.074 → +0.074 | −0.096 → −0.003 → −0.003 |
| slow | −0.079 → −0.753 → **−0.277** | | | |
Tolerances: SC ±0.08, later ±0.12. T1L (leader lab) unchanged. With the cap, authors2026's late bases lose the q > 1
boost while the early synthetic dilution remains, so SIAR/ASI move late. Fast is unchanged: its teachers stay below
the cap before SC. Slow keeps a small late boost: q 1 synthetic is above Q_REF 0.984, and q < 1 synthetic repeats less
on its own tokens. All of this is for the M3 refit. The other gate tests pass (end of file).

The rest of this file is the first pass (before the cap). Its start effect sizes are unchanged by the cap (the start's
synthetic is q 0.5), and so are the day-400 teacher numbers (every teacher there is below q 0.76).

Code: `src/engine/v2/production/data.ts` (`drawData` → `drawWith`, `Q_REF`, `DataDraw.dQual / dRep / qRel`, `dataDelta.qG`
and its preview text), `src/engine/v2/models/effective.ts` (`fDataEff` may exceed 1; `GPreParts.quality`, `gPreOf`'s
`fQual`), `src/engine/v2/models/runs.ts` (`baseG`; `BaseLimits.fQual`). Test: `scripts/v2/data.ts` (section "quality",
plus updated D1/D3 checks). No UI files, no state change (no schemaRev bump).

**Rule (stated).** research/20 A3's game-ready formula taken literally, with A1's Besiroglu law as the currency:
- D_eff = Σ_slices q_i · D'_i,d ÷ Q_REF, with D'_i,d = Muennighoff on the slice's **own** tokens:
  T_i,d·(1 + 15.4·(1 − e^(−(ep − 1)/15.4))), ep = D_i,d ÷ T_i,d (T_i,d raw tokens = U_i,d ÷ q_i; P10's ×3 included).
- G_pre's data term = log₁₀ of the Besiroglu effective-compute fraction of L(N, D_eff) vs L(N, D) at the same N
  (`fDataEff`, as f_data and the overtraining factor). For the readouts it splits exactly into quality
  (`fQual` = fraction of D_qual = Σ q·D ÷ Q_REF, no repetition) and repetition (`fData` = the rest, ≤ 1):
  `gPre.quality + gPre.data` = the whole data term.
- **No double counting [D]:** quality multiplies the tokens once, q·Muennighoff(D, T) = Muennighoff(q·D, q·T). So it no
  longer also stretches a slice's epochs: D1/D3 compared a slice's draw with U = q·T (a q 3 corpus repeated only after
  3× its tokens) and let quality act only there. Now a q 3 corpus is worth 3× per token and repeats after its own T.
  Tested: ×2 quality at equal tokens doubles D_eff with epochs and repetition unchanged; a 10T q-3 corpus drawn 60T deep
  is 6 epochs and worth 3·Muennighoff(60T, 10T) (160.7T), not 3·Muennighoff(60T, 30T) (180T).
- Kept from D3: the draw weights (slices ∝ q·T·kind weight, i.e. better data is sampled more per own token), the
  domain shares, REF_SHARE, the per-slice Muennighoff. Specialisation still reads repetition-only effective shares
  (quality acts on general G) [D].
- **Normalisation:** Q_REF = mean quality of the 2025 reference draw (reference recipe, balanced, B0's size, start
  portfolio) = (270·1 + 30·1 + 10·0.5)/310 = 0.9839. That draw has D_eff = D exactly, fQual = 1, quality 0 OOM, so B0/V0
  (built with fData 1 at init) and the reference plan's G are unchanged (tests). `fDataEff` returns exactly 1 within 1e-9.

**Source of the size.** research/20 A3: curated/licensed q 1.5–3 (DCLM/FineWeb-Edu-style selection ≈ ×3 data-selection
gain, Gundlach's table [P]); A1: Besiroglu refit (E 1.82, A 482, B 2085, α 0.348, β 0.366). At the compute-optimal ratio
the data term is about half the reducible loss, so effective compute moves ≈ 1:1 with D_eff: tokens 3× better ≈ ×2.57
compute at 20 tokens/param, ×2.15 at 50 (RefBot's ratio), ×1.7 at 200; half-quality tokens ×0.55 at 50.

**Effect sizes (start portfolio, B0-size reference base, 50T tokens, no repetition)**
| draw | mean q ÷ Q_REF | quality term |
|---|---|---|
| reference (balanced) | 1 | 0 |
| + premium licence 0.05T REASON (default deal, $1.5B) | 1.0010 | +0.00035 OOM |
| + premium 1T REASON ($30B) | 1.018 | +0.0062 OOM |
| + bulk 5T ($0.5B) / curated 20T ($40B) SOCIAL | 1.012 / 1.10 | +0.004 / +0.033 OOM |
| licensed start 30T at q 3 instead of 1 | — | +0.131 OOM |
| code & math preset (more q 0.5 synthetic code) | 0.990 | −0.0034 OOM |
| synthetic-heavy preset (q 0.5 synthetic ×4) | 0.957 | −0.0153 OOM |
Premium data now has a role, but at deal sizes it is still small: the draw samples a slice ∝ q·T, so 0.05T of books
is 0.05% of a 50T base's tokens. A larger effect needs the mix control to upsample licensed data (kind weight) — D4.

**Teacher finding under the new rule (D2 re-check, reported, not tuned).** Day-400 fixture, 30 days of the whole pool
(2.3M H100e) per teacher, then the lab's latest base design (140T tokens, no repetition; the stock's mean q is already
×0.826 of the reference: −0.067 OOM, from RefBot's q 0.5–0.75 synthetic): V0 (q 0.50) 277T, q·T 139T → ΔG −0.0066;
V30 (q 0.63, best by q·T, 196T) → −0.0030; V31 (strongest, q 0.75, 118T q·T) → +0.0009. **The stronger teacher now pays**
— quality ranks teachers, reversing D2's q·T ranking — and data below the draw's mean quality now *dilutes* a base that
does not repeat (V0's data costs G). Absolute effects are small (≤ 0.007 OOM per month of the pool).

**Gate.** tsc main + scripts clean; data, effective, suites, golden-timelines, identity, worktypes, research, serving,
products pass (also fixtures, money, idle, lint-tradeoffs / -structure / -ux / -hidden). **calib T1: 3 failures** (stub,
Δ vs golden in years, before → after D11):
| preset | SC | SAR | SIAR | ASI |
|---|---|---|---|---|
| ai2027 | +0.000 → +0.019 | +0.022 → +0.041 | −0.041 → −0.005 | −0.030 → −0.003 |
| authors2026 | −0.008 → −0.008 | +0.016 → +0.019 | −0.074 → +0.049 | −0.082 → +0.118 (tol 0.12) |
| fast | −0.003 → **+0.093** (tol 0.08) | +0.096 → **+0.189** (tol 0.12) | −0.019 → +0.074 | −0.096 → −0.003 |
| slow | −0.079 → **−0.753** (tol 0.08: 0.67 y outside → stop rule) | | | |
T1L (leader lab) unchanged. Integrated runs within their usual spread.

**Why (trace of RefBot's bases, balanced draw).** RefBot fills its stock with its own synthetic data (200T by day 116,
2000T by 663, 78,000T by day 4,447 in slow) and the balanced draw takes it pro rata inside each domain:
- early bases (B2–B5, q 0.5–0.87 synthetic, 18–55% of drawn tokens): quality −0.02 to −0.05 OOM → fast SC/SAR later;
- once its teachers pass V0 + 2 OOM (slow, from B6 ≈ day 1,200) synthetic q > 1, rising to D1's cap 1.5 [D slope
  0.25/OOM]: quality +0.02 → +0.12 OOM over B7–B18 (85–92% synthetic drawn) → slow SC 0.75 y early (slow's G grows
  slowly near SC, so 0.1 OOM is most of a year).
Sensitivity (scratch, not applied): SYN_Q.max = 1 (synthetic never better than the web) → fast unchanged
(+0.093 / +0.189), slow SC −0.277.

**Options for the lead (none applied).**
1. Re-fit the per-preset T1 knobs (`--fit-v3`, V3_CAL G_SC / Δ_bm): quality is now a real G term on RefBot's path.
2. Revisit D1's synthetic quality curve (SYN_Q slope 0.25/OOM and cap 1.5 are [D]; research/20 A3 gives 0.5–1.5 with
   the high end only in math/code and no general exchange rate): it drives slow.
3. A quality-aware balanced draw: a lab does not dilute its draw with data worse than tokens it leaves unused (take
   slices best-first within a domain while they repeat < 4 epochs). Removes the early dilution (fast) but strengthens the
   late boost (slow), so it needs 2 as well.
The mechanism itself behaves as the brief asks (reference reproduces exactly; premium up, synthetic-heavy down; counted
once); the stop is only the golden dates.

**For D4 (readouts).** **The Blueprint "G gained" breakdown needs a "Data quality" row from `gPre.quality`.** Without
it the rows no longer sum to the total whenever the drawn quality differs from the reference; the "Data repetition"
row is `gPre.data`, repetition only. Other readouts on `planRun(...).limits`: `fQual` (quality factor, > 1 better),
`draw.qRel` (mean quality ÷ reference), `draw.dQual / dRep / dEff`.
`dataDelta` has `qG` [before, after] (OOM) and the preview text ends "· data quality +0.000 → +0.002 OOM".
Readout change: `uMix` / `epochs` now count each slice's epochs on its own tokens; on the natural mix uMix = U ÷ the best
drawn quality, so a small q > 1 licence becomes the most-repeated slice (premium 0.05T: base epochs 0.16 → 0.48, "unique
tokens for this mix" 310 → 104T) although it costs nothing below ≈ 4 epochs. D4 should name the most-repeated slice or
show the Muennighoff cost rather than "unique tokens" alone.

**Gate with the cap (2026-11-20).** tsc main + scripts clean; data (incl. the cap check and the teacher ranking below
the cap), effective, suites, golden-timelines, identity, worktypes, research, serving, products, lint-tradeoffs, lint-ux
pass; calib T1: authors2026 SIAR / ASI, fast SC / SAR, slow SC outside tolerance (table above, for the M3 refit); T1L,
R5, T2, T4 pass.

### M3 merge notes (D4 and D11 onto M2; 2026-11-20)

Merged into `model-v3` (at M2, edaf6f8) with `--no-ff`, in order: `v3-d4` (D4 d54de53; merge 0ca8a79), `v3-d11` (D11
9ef6c76 / f8d064f / f3cfec5; 3e92e07); then the refit (16a9e45) and one engine fix (c98f2ed). Both branches started at
5ed4f78 (D2's head, before E3/D6/E2/E5). D4 and D11 notes are above (copies of `design/notes/D4.md`, `D11.md`, which
stay). No schema change in either branch: SCHEMA_REV stays 24; fixtures stay the committed schemaRev-16 files
(`fixtures.ts` rewrote them during the gate; restored).

**Conflicts and resolution.**
- v3-d4 × D6: both added a Models tab. `Models.tsx` now has three tabs, **Versions | Suites | Data** (D6's Suites view,
  D4's Data view; header comment, imports `Database, Dumbbell`, `Suites`, `DataView`). The Nav description names both.
  uitest: the `nav('models')` helper was the same edit on both sides (kept D6's); both check blocks kept (`d6Check` then
  `d4Check` at day 1, 400 and 900; D6's Blueprint › Suites link check and its term check kept). lint-ux REQUIRED: D6's
  and D4's lists (`expertData` once). Engine index: D6's suites exports and D4's data-view exports. Blueprint imports:
  A5's `studentToHold` with D4's `drawByDomain`, `mixTargetOf`.
- v3-d4 × E3: `BASE_DATA` had lost its `signals` field in E3 (training pressure from what the base drew); D4's Natural
  preset was added in E3's shape (no `signals`).
- Glossary `expertData`: D4 did not change the text, so M2's combined D2 + D6 entry stays, now pointing to "Models ›
  Data" for buying it (src adds D4). D11's branch copy of the old D2 entry was dropped; `synJob` takes D11's capped text.
- v3-d11: only the glossary conflict above (data.ts, effective.ts, runs.ts and the data test auto-merged; D4's
  `dataView.ts` uses only the signatures D11 kept).
- **Integration (D11's "for D4" readouts), in the merge commit:** the Blueprint "G gained" tooltip gains a **Data
  quality** row (`gPre.quality`), so its rows sum to the total again; Models › Data's before → after rows gain "Latest
  base data quality" (`dataDelta.qG`, 3 decimals, red when the change dilutes the draw); glossary `dataQuality` states
  synthetic up to the web's 1 and that each drawn token counts q times in the loss law. Not done (for F6): D4's
  per-domain epochs in the drawn-mix row still divide by the domain's quality-weighted U, while D11 counts a slice's
  epochs on its own tokens; the Data tile's "unique tokens for this mix" can now be a small q > 1 slice (D11 notes).

**Lead decisions (recorded).** Synthetic data quality capped at 1 [D] until sourced (D11's `SYN_Q.max`); the balanced
draw stays at the reference shares; no quality-aware draw now.

**Refits (named per-preset values only; seed 2027; Δ in years; G_SC scans with a scratch harness and `calib.ts
--fit-v3`).** calib on the merged code before the refit: ai2027 and authors2026 pass (authors2026 SC +0.030, SAR +0.044,
SIAR +0.003, ASI +0.038: D11's branch-only SIAR +0.173 / ASI +0.315 do not appear on top of E3/E2/E5); fast SC +0.093,
SAR +0.189 (fail); slow SC −0.753 (fail, the day-4483 cycle).
- **fast: G_SC 31.593 → 31.572, Δ_bm 0.17 → 0.05** (sd_SC 0.5 kept): SC +0.093 → +0.052, SAR +0.189 → +0.112, SIAR
  +0.074 → −0.011, ASI −0.003 → −0.096. Fast is bimodal in G_SC: every few thousandths of an OOM RefBot's path flips
  between a "late" cycle (passes, SAR near +0.11) and an "early" one (ASI −0.14 to −0.18, fails). At Δ_bm 0.17 no
  passing window exists (31.511–31.52: late cycle SAR +0.121–0.123, early cycle ASI −0.14). The fit's grid (Δ_bm 0.05 /
  0.10 / 0.17 / 0.25 / 0.35 / 0.50 → worst 0.89 / 1.32 / 1.16 / 0.94 / 1.14 / 1.39 tolerances) picked 0.05. Scan at
  0.05: 31.565 pass, 31.566–31.568 fail (early), **31.569–31.574 pass** (late), 31.575 fail; 31.572 is the middle of that
  window. SAR's margin is 0.008 y. Δ_bm 0.25 has only single passing points (31.46). F4.
- **slow: G_SC 35.474 → 35.493** (Δ_bm 1.6 kept): SC −0.753 → +0.049. Scan: 35.46 −0.532, 35.465 −0.277, 35.47–35.481
  −0.753, 35.482 +0.049, 35.486–35.487 +0.049, 35.488 −0.277, 35.489 −0.167, **35.490–35.495 +0.049**, 35.497–35.50
  −0.753, 35.51 +0.049. 35.493 is the middle of the widest window found (35.490–35.495). Not robust: **F4**.
- ai2027 (SC +0.019 … ASI +0.049) and authors2026 unchanged and in tolerance. T1L passes on every preset; T2, T4, R5
  pass. calib re-run after the engine fix below: the same milestone days, all passed.

**Engine fix (c98f2ed): NaN customer stocks.** worldfx's "world state stays plain JSON" failed after the D11 merge:
`s.world.fx.cust.US.HEALTH.r2 = NaN` from day 977 of the classic ai2027 run. Cause in A5's `surplusChoice`
(`worldfx/choice.ts`): when every offer in a choice set is ≈ 745 nats below the band's best (here a rival with coverage
0.17 while the band's cheapest price is $0.0009 per hour, so the price term's μ is tiny), the sum of exp weights is
denormal, f = p ÷ sum is infinite and 0 · ∞ = NaN. It now divides first in that case only, so every finite path is
bit-identical (calib days and worldfx revenue unchanged). D11 only exposed it (rival paths moved).

**Gate (merged code c98f2ed + docs).**
- tsc main + scripts clean after each merge; `npm run build` ok; `npm run test:ui` 481 passed, 0 failed.
- Pass: golden-timelines, identity, effective, data, suites, signals, research, safetyresearch, worktypes, serving,
  danger, products, calib (T1, T1L), fixtures, lint-hidden, lint-ux, lint-tradeoffs, lint-structure, lint-tips, money,
  idle.
- hygiene: only the perf checks fail (daily 10.9–13.2 ms, worst quarter 43–48 ms; leader lab 15.6–18.5 / 37–41 ms; its
  own cost +14% to +30% between runs). Not from the merges: M2's edaf6f8 on the same loaded machine gave 14.1 ms and the
  same +29.7% leader-lab fail, the D4 merge 5.0 ms; four other agents share the machine. Save checks pass.
- finance: F2 44.8M (M2 43.1M), F7 revenue median $28.6B ($30.5B), F7 valuation $0.23T ($0.28T), F11 2027 $32.6B
  ($35.5B): the M2 set of failures, revenue a little lower from D11's slower path (below).
- ws4: T3 lead 28–371 d and post-theft lag: the known T3.
- safety (slow): S4 RefBot P_mis at ASI 0.522 (M2 0.485; band 0.55–0.85; accepted → E10), S5 RefBot fails (median U − L
  at SAR +0.45, below in 28%; accepted); S4 safe-only 0.021 and S5 mixed (margin +0.02, holds in 55%) pass.
- worldfx: F7/F11 2026 $32.7B, F11 2027 $34.6B, equity 2026 −14.2% (the known revenue set); U +1 pp 2028-02-02 (M2
  "never"; still outside its window); GOV T1 (2027-10-03) and W2 now pass. **Two new failures, both from the D11
  merge** (bisected: edaf6f8 and the D4 merge 0ca8a79 give HireRate_SOFT ≤ 10% on 2027-07-28 and 25% remote work on
  2027-12-14, both passing; the D11 merge gives 2027-10-02 and 2028-01-20): **HireRate_SOFT ≤ 10% on 2027-10-02**
  (window ends 2027-10-01) and **25% of remote-work jobs done by AI on 2028-01-20** (window ends 2028-01-01). The run's
  whole adoption path is slightly slower (US hours of use on 2027-10-01 11.7% → 11.0%, on 2027-12-31 13.8% → 13.0%;
  consumer subs on 2027-10-01 259M → 196M), consistent with D11's early dilution of RefBot's bases by q 0.5–0.87
  synthetic data (−0.02 to −0.05 OOM, D11 notes) on the one-seed classic path. Not tuned here (no named V3_CAL value
  moves ai2027's classic path without moving T1); for the lead.

### E6 notes (oversight measured in capability gaps, control tax; 2026-11-20)

Branch `v3-e6` (from `model-v3` at edaf6f8). Spec: MODEL-V3 §11.3, §11.5–11.6; research/20 F4; research/14 §1.6A
(AG05), AG07. Code: `src/data/v2/oversight.ts` (new: constants and their sources), `src/engine/v2/safety/oversight.ts`
(new: level ↔ OOM map, gaps, monitor rule, control protocol), `safety/techniques.ts` (decay in OOM, AG05, containment),
`safety/common.ts` (M helpers removed), `safety/{agendas,detection,findings,investigations,responses,actions,
understanding,view,incidents}.ts` (every M read replaced), `models/products.ts` (catchRate), `departments/workfit.ts`
(control tax in `useLabour`), `departments/agentActions.ts` (lane readout), `endings/epilogue.ts` (containAtAsi), data
`agendas.ts` (`oHalf`), `findings.ts` (`oHalf:` effects), `features.ts` (re-export), `danger.ts` (comment), glossary
(`halfStrength`, `oversightGap`, `controlTax`; `mHalf` removed; `catchRate` rewritten), UI: chips `CatchX`, Safety
(upkeep line, tool tooltip), Codex, TopStrip, Agents (control-tax tag). Test `scripts/v2/oversight.ts` (in `test:v2`
after danger); uitest +2 checks; hygiene +1 save check.

#### The capability coordinate

Every oversight quantity now reads capability as **x = OOM of effective compute above the start model V0**:
x = λ⁻¹(L) − G_V0, the exact inverse of the display level map λ(G) (`levelOfG`; piecewise linear through the knots
V0 / SC / SAR / SIAR / ASI; L ≥ 15 maps to the ASI knot as λ caps). TRUE quantities use a version's hidden general level
`Lg` (= λ(G) of its pm, what `versionM` read through the M bridge); believed ones use the measured level (`measuredLOf`),
as before. A gap between an overseen model and its overseer is the difference in x (`oversightGap`: OOM, levels, Elo).
[D] OOM rather than levels: Epoch's capability index is linear in log compute (0.387 ECI per OOM [P]) and Engels'
Elo is a capability measure, while λ's levels per OOM change by a factor 6 along the path (2.0 per OOM V0 → SC, 1.1 SC
→ SAR, 0.34 SAR → SIAR, 0.52 SIAR → ASI on ai2027), so a gap in levels would mean very different capability gaps early
and late. Levels are shown next to every gap.

#### Elo → OOM (the Engels anchor)

Engels et al. 2025 [P] use Chatbot Arena Elo as general capability ("We use Chatbot Arena Elo scores as a proxy for
general intelligence"). Their Table 1 has a same-recipe pair: Llama-3-8B 1152 vs Llama-3-70B 1207, both on 15T+ tokens
(Meta model card [P]), so 55 Elo per 0.94 OOM of training compute = 58 Elo/OOM: **400 Elo ≈ 6.8 OOM** [D from P].
Cross-checks: 6.8 OOM × 0.387 = 2.6 ECI units ≈ 4.8 years of frontier progress at 0.55/yr [P]; the Arena frontier
rose ≈ 190 Elo from GPT-4 (2023, ≈ 1186 [UNVERIFIED]) to chatgpt-4o-latest (1377, Engels Table 1) in ≈ 2 years ≈ 4.2
years per 400 Elo; and the monitor rule below gives 62% at a 1-OOM gap, Greenblatt et al.'s trusted-monitoring safety
with GPT-3.5 watching GPT-4 (≈ 1 OOM apart [R]). On λ(G) 6.8 OOM is ≈ 13 levels at the V0 → SC slope, 7 at SC → SAR,
2.3 at SAR → SIAR.

#### Re-based quantities

| quantity | v2 (M) | E6 | source |
|---|---|---|---|
| monitor catch (products, internal uses) | 0.85 · 0.52^log4(M_w/M_m) | `monitorCatchAt(gap)` = 0.85 · (0.10/0.85)^(gap/6.8 OOM), then AG07 tools halve the rest (unchanged); under the control layer misses ×0.447 | Engels Backdoor Code 10% at 400 Elo; base 85% [D, kept]; Greenblatt |
| same-lineage collusion | ×(1 − 0.4), T-LOCK halves | unchanged | J2 AG1 |
| tool decay D | 1/(1 + (M/M½)^k) | 1/(1 + 10^(k·κ·(x − oHalf))), κ = 0.27 | κ = mean log10 M per OOM on the ai2027 path V0 → ASI [D: equivalence] |
| tool half points (data) | M½ 25 / 30 / 250 / 2000 | oHalf 4.38 / 4.72 / 8.78 / 11.64 OOM (SAR, SAR+, SIAR, ASI on ai2027) | the same points on the reference path |
| AG09 under latent | M½ 5, k 2 | oHalf 2.53 (SC), k 2 | same |
| tool upkeep | M½ × 2^r per day | oHalf + r · log10(2)/κ per day (1.115 OOM per v2 doubling) | same speed on the path |
| NEG results (F21, F30, generic) | M½ × 0.5 / × 0.6 | oHalf − 1.11 / − 0.82 OOM (`oHalf:` effects) | log10(×)/κ |
| AG05 scalable oversight | 0.52^(log4(M/5) − debate tier) | 0.517^((x − x_SC − 4.0·[debate])/6.8) | Engels debate 51.7% at 400 Elo; F16 credit = Khan 2024 accuracy 54% → 82% = 235 Elo ≈ 4.0 OOM [D] |
| U, family seen-to, projection | strength at M(L) | strength at x(L); the projection (VAL_LEAD, EA growth) stays in levels | — |
| containment (AG07, block) | Contain(M of the overseen model) | Contain(x of the overseen model) | — |
| containment at ASI (endings) | Contain(2000) | `containAtAsi`: Contain(x of the world's ASI knot) | ai2027: 11.64 OOM ≡ M 2000 |
| human review (internal catch) | 0.3 · (1 − r) | 0.3 · (1 − r) · gapFactor(model − L 10) | E5 [D]; expert humans = SC level [D] |
| T-CCLASS misuse boost, eval suite, runtime monitoring, investigations, audits, best detector, NEG precondition, previews | strength at versionM / mAtLevel | strength at versionOom / oomOfLevel | — |

Equivalence on the ai2027 reference path (probe, old/new strength factor): AG08 L5 0.945/0.938, L10 0.833/0.759,
L12 0.500/0.500, L13.5 0.091/0.061; AG07 L12 0.590/0.607; AG02 L13.5 0.500/0.500; AG01 L15 0.500/0.500. Monitor catch
(old/new): L4 on L5 0.84/0.73, L5 on L8 0.67/0.53, L10 on L12 0.40/0.48, L12 on L13.5 0.29/0.21, L10 on L15 0.050/0.048.
AG05 is stronger late (SAR 0.47 → 0.84, ASI 0.06 → 0.41 before the debate credit): Engels' debate rate per 400 Elo is
gentler than v2's "1 tier = ×4 M" [D]. AG05's only tool, T-DEBATE, covers SYC/RH/CONCEAL/PROXY, none of the critical
traits, so U and the S-criteria barely see it.

**Other worlds.** Half points are physical (OOM above V0), so in worlds where milestones need more compute the tools
fade at lower levels: authors2026 AG08 halves at L 8.8 (was L 12), L10 strength factor 0.31 (was 0.89); the monitor
rule likewise counts authors2026's longer OOM spans. [D] This is the intended reading (a tool validated on 2025 models
meets the same capability gap per OOM in every world; the world's difficulty is where the milestones sit); upkeep has
those worlds' extra years to follow. If the lead prefers milestone-relative tools, the one-line alternative is oHalf
from λ⁻¹_w(L½) per world at init. No test runs safety on authors2026; its golden dates are unchanged.

#### Control tax (MODEL-V3 §11.6, research/20 F4)

When the internal deployment runs the control layer (AG07 protocols: the "Add control" response or a safety event), each
internal use works under trusted monitoring that defers d = 10% of actions [D: Greenblatt's middle setting] to its
trusted model (the use's monitor; a copy of itself = no gap; no monitor = humans redo them):

    usefulness = U(0) − (U(0) − U(d)) · min(1, gap ÷ 1 OOM) = 0.97 − 0.04 · min(1, gap)
    misses     × (1 − S(d)) ÷ (1 − S(0)) = 0.17 / 0.38 = 0.447

U, S from Greenblatt et al. 2023's trusted-monitoring table (interpolated in d). The usefulness multiplies the use's AI
FTE in `useLabour` (V3 work-type labour, replacing v2's flat ×0.95 on every use), so SWE, EXP, IDEAS and the safety
package each pay their own tax; the miss multiplier applies to the internal catch roll (`catchOf`) and, on a product with
the control layer, to its monitor (`catchRate(…, controlled)`). The monitor's inference cost stays the D7 compute
(0.25 × FLOP-per-token ratio from the safety pool): research/20's third tax term. Readout: a "control −x%" tag per
Agents lane (tooltip: deferral, gap to the trusted model, misses ×0.45; glossary `controlTax`). No bot turns the
control layer on, so reference runs and golden dates are unchanged by it.

#### Hook for E4 / E7

`internalOversight(s, v, trait)` (safety/incidents.ts) returns MODEL-V3 §11.3's oversight_k = 1 − (1 − block)(1 −
catch) for model v's internal work with its parts (block = AG07 containment at v's capability; catch = monitors and
tools, human review with v's gap above L 10, control deferral). E4's "(1 − oversight)" in the successor pull and E7's
covert acts can call it (or `oversightGap` + `monitorCatchAt` with an act's domain levels, "measured against the
overseer's level").

#### Removed M reads

`safety/common.ts`: `mAtPm`, `versionM`, `mAtLevel` and its level table (BRIDGE(V6)) deleted; every caller in
safety/, `models/products.ts` (catchRate), `core/selectors.ts` (techniqueCurve) and `endings/epilogue.ts` moved to
x. `AG05_GAP` deleted. Lint in `oversight.ts`: no safety module, products.ts or departments/agents.ts reads
multiplierAt / multiplierRef / versionM / mAtLevel / mAtPm / bridgeQ / researchSpeed / prodCache.M. **One allowed
read remains**: `safety/traits.ts` `inheritFromFleet` (κ = INHERIT_K·(1 − 1/M), the lineage inheritance through the
lab's AI R&D) is E4's successor-pull code, which this brief keeps out of scope; E4 should replace it with the AI share
of R&D and `internalOversight`. Outside safety, `models/tree.ts` `researchSpeed` (BRIDGE(V6): the rolled safety nodes'
speed) and `world/calibration.ts` `bridgeQ` (revenue per chip) still read M; they are not oversight.

#### schemaRev

24 → **25**: `TechniqueState.oHalf` replaces `mHalf`. Migration 24 converts each tool's M½ on the ai2027 reference
path (`oomOfRefM`, log-linear in M between the knots), the same half point (hygiene check; data.ts / hygiene's
SCHEMA_REV assertions moved to 25). Parallel branches that also bump from 24 must chain after it at merge.

#### Safety criteria (safety.ts, full run; before = M2's gate, not tuned)

| criterion | before (M2) | after (E6) |
|---|---|---|
| S4 RefBot/medium P_mis at ASI ∈ [0.55, 0.85] | 0.485 FAIL (known → E10) | **0.526** FAIL (known; closer to the band) |
| S4 safe-only ≤ 0.25 | 0.011 | 0.011 pass |
| S5 RefBot "U falls below L by SAR" | median U − L at SAR +0.50, below in 30% FAIL (known) | +0.55, below in 28% FAIL (known) |
| S5 mixed keeps U ≥ L − 0.5 to SAR | margin +0.03, holds in 70%; U@SAR 12.35 vs RefBot 11.22 | margin +0.09, holds in 70%; U@SAR 12.32 vs RefBot 11.35 pass |
| S6, B3 | pass | pass |

#### Gate

tsc main + scripts clean; `npm run build` ok; `test:ui` 418 passed, 0 failed (+2 E6 checks; the screenshot
`51-e6-control-tax` shows the tag under each lane's AI share; two earlier runs died at the setup screen's locked tooltip
under machine load, unrelated, and passed on rerun). Pass: oversight (new, 29 checks), golden-timelines, identity,
effective, data, suites, signals, research, safetyresearch, worktypes, danger, products, serving, money, idle, fixtures
(committed fixtures restored after it rewrote them), lint-hidden, lint-ux, lint-structure, lint-tips, lint-tradeoffs,
calib (all passed: T1/T1L on every preset; ai2027 SC 2027.249 and slow SC 2038.577 identical to M2; authors2026 SIAR /
ASI days 2143 / 2979 vs M2's 2141 / 2990). hygiene: all pass except the four known perf checks (17–20 ms/day under load
from four parallel sessions; an A/B of the base commit and E6 on the same machine gave 26.8 / 27.6 and 24.4 / 20.3
ms/day, i.e. noise); its new 24 → 25 save check passes. finance / worldfx / ws4 not re-run (known failures; E6 changes
no reference-bot path except through incidents' catch, as E5 did).

### E4 notes (successor pull, 2026-11-20)

Branch `v3-e4` (from `model-v3` at edaf6f8). Code: `src/engine/v2/safety/traits.ts` (new "Successor pull" section:
`successorPull`, `applySuccessorPull`, `successorOversight`, `kappaSucc`, `K_SUCC_0`, `SUCCESSOR_TRAITS`; V2's
`inheritFromFleet` and `INHERIT_K` removed; hooks in `applyBaseToLineage` and `applyRunToTraits`), glossary `baseRun`
text. Test: `scripts/v2/successor.ts` (new, in `test:v2` after `signals`). No saved state changed: no schemaRev bump.

#### Rule (MODEL-V3 §11.2)

When a run completes (new base, continued base, post-training, distillation), the new model's starting dispositions
x₀ are pulled toward the models doing the lab's R&D that day:

    x₀_t += Σ_k ω_k · (x_k,t − x₀_t),   ω_k = κ_succ(SUCC_k) · r_k · (1 − oversight_k),   t ∈ SUCCESSOR_TRAITS

- **k** = the work types that touch a run: EXP and IDEAS (designing and running the training) and SWE (its code). Each is
  done by its own agent package's model (`eng`, `capRoutine`, `capFrontier`; `workContext().slots[k].versionId`).
- **r_k** = (max(H_k, L_k) − H_k) ÷ Σ_j max(H_j, L_j): work type k's AI labour as a share of the lab's R&D labour, so
  Σ_k r_k = `aiRdShare(s)` exactly (E5's r). Each model pulls by its share of the work (tested).
- **κ_succ(SUCC) = K_SUCC_0 + (1 − K_SUCC_0)·SUCC**, K_SUCC_0 = 0.4. Sources: SUCC = 1, r = 1, no oversight gives ω = 1,
  research/04 T23 ("trait inheritance becomes 100% for the hijacked generation"; AI 2027 Sep–Nov 2027, Agent-4 "plans to
  make Agent-5 aligned to Agent-4", research/01 #35, R2, R3). K_SUCC_0 = 0.4 [D]: the unintended part (the models write
  the successor's code, data and experiments, research/12 #10), V2's INHERIT_K kept; not refit (see calibration).
- **oversight_k = 1 − (1 − block)(1 − catch)** (`successorOversight(s, v, r)`), E5's internal terms with the act being
  SUCC: block = AG07 containment on v's internal deployment (control layer × best contain tool, U19 via
  `uModeContainMult`); catch = 1 − (1 − monitoringCatch(s, v, 'SUCC'))·(1 − HUMAN_REVIEW·(1 − r)).
  **Hook for E6:** this function is the pull's only oversight read; its containment call reads M through `versionM`
  (marked `// BRIDGE(V6): M, E6`). E6 swaps the function body for the capability-gap terms.
- **SUCCESSOR_TRAITS** = the B-layer traits (CONCEAL, POWER, AF, SAND, SCHEME, COLLUDE, SUCC) and PERSONA, as the brief
  says. Not pulled: SA, EA, OBF (capability-indexed, as V2), the learned behaviours SYC, RH, PROXY, TGAME, and the
  protective HONEST, CORRIG (V2 pulled these too). The pull never touches capability (pm, domains, build: tested on a
  full post-training run).
- **Signed**: a clean fleet pulls a new model toward clean, as V2's rule did.
- The E06 teacher pull (distillation and synthetic data within a base family, `sameBaseFamily`) is unchanged and applied
  separately inside `stepTraits`; a distilled student gets both (R&D influence on x₀, then the teacher pull).

Choices [D]: the pull reads the lab on the run's completion day (no new state; a run-averaged r would need saved
state). IDA cycles and continual-learning stream days are not pulled (IDA overwrites the version with its teacher's
traits; neither is a new model trained by the R&D fleet). Rivals are unchanged (F1).

#### Numbers (`npx tsx scripts/v2/successor.ts`)

| state (ai2027) | r | oversight | κ | ω |
|---|---|---|---|---|
| start (V0) | 0.21 | 0.43 | 0.40 | 0.049 |
| start, control layer on | 0.21 | 0.76 | 0.40 | ≈ 0.02 (misaligned test fleet, SUCC 0.3: 0.071 → 0.030) |
| RefBot fixture day 400 | 0.59 | 0.33 | 0.40 | 0.159 |
| RefBot fixture day 900 | 0.999 | 0.02 | 0.67 | 0.654 |

V2's κ was 0.4·(1 − 1/M) on new bases only: 0 at the start (M = 1), ≈ 0.07 at day 400 (M 1.2), ≈ 0.4 by ASI. E4 starts
the pull at day 0 (E5's r is 0.21 at the start) and makes it climb with automation and the decay of monitors at high M
(the day-900 fleet's catch on SUCC is ≈ 2%). One RefBot run (seed 500): ω per version 0.04 (2025) → 0.15 (2026) →
0.16–0.24 (SAR) → 0.39 just before ASI.

#### Calibration: RefBot P_mis at ASI (40 seeds 500–539, ai2027, medium, endings skipped; `safety.ts` S4's set)

| | P_mis | Mis mean | ASI day mean |
|---|---|---|---|
| before (edaf6f8, V2 `inheritFromFleet`) | 0.4855 | 0.417 | 901.7 |
| after (E4) | 0.4658 | 0.407 | 901.7 |
| attribution: E4's ω on bases and continues only | 0.4629 | 0.405 | 901.7 |

No jump (−0.020). Applying the pull to versions as well adds +0.003; the drop comes from the narrower trait set (V2 also
pulled TGAME, HONEST, CORRIG, RH, PROXY, SYC) and from a smaller ω at base completions before SAR. S4 RefBot (band
0.55–0.85) stays the known failure → E10; not tuned. Milestone days identical (ASI day per seed unchanged).

#### Gate

tsc main + scripts clean. Pass: successor (new, 11 checks), signals, safetyresearch, danger, research, worktypes,
effective, golden-timelines (known WARNs), identity, calib (T1 identical to M2: ai2027 SC 2027.249, slow SC 2038.577),
lint-hidden, lint-structure, lint-tips. **safety** (slow): known failures only. S4 RefBot P_mis at ASI 0.485 → **0.466**
(Mis mean 0.407; band 0.55–0.85, → E10). S5 RefBot unchanged (median U − L at SAR +0.50, below in 30%, as in M2). S4
safe-only 0.013 (M2 0.011), S5 mixed passes (margin +0.03, holds in 65%; M2 70%), S6 and B3 pass.

#### For E6 / E7 / E12

- E6: replace `successorOversight`'s body (containment and monitor catch on the capability gap); the test checks only
  directions (control layer raises oversight, more AI share lowers human review), not the values.
- E7 (steering successors as a covert act) can read `successorPull(s).parts` (who pulls, how hard, through how much
  oversight); E8's "steered successor" foothold fits at `applySuccessorPull`.
- E12 (UI): `successorPull(s)` is the readout per run (r, ω, per work type model, oversight, κ).

### E12 notes (safety UI 2: trait families, training pressure per run, successor pull; 2026-11-20)

Branch `v3-e12` (from `v3-e4`). UI task: no state, mechanism or schema change.

Code: `src/engine/v2/safety/pressureView.ts` (new, output-only selectors, exported from `core/selectors.ts`),
`data/v2/traits.ts` (`TRAIT_MEANING`), `data/v2/glossary.ts` (9 new terms, `riskFamily` corrected: 14 of 17 traits),
`ui/v2/panels/Pressure.tsx` + `pressure.css` (new: shared signal rows), `Safety.tsx` (families → traits, successor card,
case picker grouped by family), `Blueprint.tsx` (training-pressure card), `Models.tsx` (model card section),
`icons.ts` (`FAMILY_ICON`), `store.ts` (`probe.successorPullView` for the UI test), `scripts/v2/uitest.mjs` (E12 checks),
`scripts/v2/lint-ux.ts` (required terms).

#### What is shown where (one home each)

- **Trait families (Safety › Overview, home `riskFamilies`).** The four families stay the first layer (highest believed
  trait, 90% band, seen/unseen). Click a family: its traits one level down, each with icon, name (term), what its
  number means (behaviour / awareness / disposition / protective, MODEL-V3 §11.1, `TRAIT_MEANING` [D]: OBF and POWER
  as behaviours (overreach), PROXY and TGAME as dispositions), believed est ± sd and band bar. A fifth quiet row
  "Outside the families" opens SA, HONEST, CORRIG. No flat 17-trait list remains at a top level (the investigation
  picker now groups its options by family; the trait graph tab stays the L2 graph).
- **Training pressure of the planned run (Blueprint, card `runPressure`, below Plan so Start stays in view).** Rows
  S1–S8 with value ≥ 0.005 (the rest folded into "…: none"): plain name, bar, value, families pushed (icons from the
  direct edges in `edges.ts`; SA counts as "awareness"), and a cause line with the run quantities, e.g. "17% of RL on
  Coding at 18% exploitable, 6.5% hackable overall × RL 1.0× the reference". Tooltip per row: the formula's terms
  (per-family S2/S3 terms, S5 AI-data and scale terms, S7 parts) and the traits pushed. ω chip with its parts (kind ×
  (ρ/ρ_ref)^¼, safety ω). Base runs show S5/S6 from the draw and G. The family "Risk pressure" arrows (predicted belief
  change vs the internal model) moved here from the Predicted card (one home for the run's alignment effect).
- **What a finished run applied (model card, section `versionPressure`).** One line: run kind, ω, the three strongest
  signals; "Signals" opens the same rows plus the base's pretraining S5/S6. S8 is the applied value (stored signals −
  the base's) when recorded, else today's (labelled). S2's suites are the run's frozen ones (matched run: done post
  run on the same base with the same RL FLOP); a start model or old save has none: "suites as of today" is said.
  Gov/trusted/open variants show their parent's run; minis show distillation (S6 0.3, ω 0.4).
- **Successor pull (Safety › Overview, card `successorPull`).** ω (with band) top right; the product line "r AI share of
  R&D × unwatched × κ"; one row per work type (Software, Experiments, Research ideas): model, share, oversight, ω;
  "Lower it": Monitors and Less AI R&D (links to Company › Agents at work), cleaner models (tooltip). The Blueprint
  card ends with a "Successor pull from <models> › Safety" link (numbers only in its tooltip, L3).

#### Belief rule (R9 / Sylvester)

`successorPull` (E4) reads true SUCC, true tool strength, true M and hidden U-modes, so the UI never shows it.
`successorPullView` is its believed reading: r and per-work-type shares exact (labour); κ from the believed SUCC
estimate (band from est ± 1.64 sd); block = containment with believed strength at the measured level's M; caught = believed
COT/WB detection on SUCC (`strengthBelieved`, `believedPenalty`) × (0.5 + 0.5 × fleet monitor) combined with human
review. No hidden U-mode multiplier. Values vs truth (fixtures): start 0.043 vs 0.053, day 400 0.151 vs 0.159,
day 900 0.590 vs 0.654. **For E6:** when `successorOversight` changes, mirror the new terms (believed) in
`successorPullView`.

#### Tests and gate

`test:ui` 447/447 (E12 adds 10 checks × 3 states + 1): at day 1 (fresh), day 400 and day 900 fixtures — four
families, no trait rows until opened, all 17 traits one level down each with meaning and est ± sd; successor ω, r and
each work type's share and ω equal `successorPullView` (via `store.probe`); tooltip with band and "beliefs";
Blueprint post and base: rows with causes (S2 names family, exploitable and RL × reference; base S5 names AI-data share
and G), families pushed, ω, tooltip with "pushes"; Blueprint successor link; model card run and base rows. All 9 new
terms seen as Term links. Also a test fix: `clearTips()` before the setup picker loop (a start card's tooltip locked
under the resting mouse and blocked the next click on this machine). tsc main + scripts, build, lint-ux, lint-hidden
pass. Screenshots: `e12-day{1,400,900}-{families,safety,blueprint-post,blueprint-base,model-card}`.

#### Gaps

- The Safety overview's side column is now taller than the chart (empty space under the chart at 1680×1000).
- Old fixtures carry pre-E3 base signals: their base rows say "AI-data share not recorded" (S5 below its own scale term).
- The successor pull of a finished version (at its completion) is not stored, so the model card does not show it.
- Meaning tags are Term links (underlined); their colour coding is overridden by the term style.

### D7 notes (evaluations as work: research engineers, engineers, inference compute; 2026-11-20)

#### What changed

- **An eval suite is a task** (`ModelsState.evals: EvalTask[]`, engine `src/engine/v2/models/evals.ts`, data
  `src/data/v2/evals.ts`). Three parts, finished when all are done:
  - research engineers: `reTW` team-weeks of effective work on a new **`evals` need** of the capabilities research-engineer
    allocation (default order ops → evals → exp → tune; the player's order and caps apply). A suite advances at most at
    its depth's staff in *effective* team-equivalents (the analysis lag); AI labour on experiments (m_EXP) divides the
    people needed (as run operations) but does not shorten the suite;
  - inference compute: rollouts × tokens per rollout × the evaluated model's FLOP per token, as H100e-days at serving
    utilisation (prefill 0.35, decode 0.07), drawn from the **experiments pool** (and idle training when the spare policy
    sends it to research) ahead of the projects, in step with the research engineers' progress; short compute slows the
    suite;
  - engineers: `engTW` team-weeks on the build queue, kind `eval` (stack work: worked in the `runs` need with run setups
    and adoptions, before product upkeep).
- **Duration = work ÷ capacity**, no fixed days (`evalDaysFor` / `evalDaysEstimate` give the estimate at today's rates).
- **Depth** (basic / full / deep, from the gate: basic → basic, full → full, full + external → deep): rollouts per
  benchmark 50 / 250 / 1,000 over 25 benchmarks (19 capability + 6 safety). Weight w = rollouts ÷ 250 = 0.2 / 1 / 4.
  - noise: every reading's sd × 1/√w (bench 6.7 / 3 / 1.5 points self; safety-eval sd; horizon and speedrun log-noise;
    `observe` strength √w);
  - elicitation on capability benches: −0.2 / 0 / +0.15 L [D] (fewer attempts and the default scaffold on basic,
    best-of-k and tuned scaffolds on deep); independent evaluators keep their +0.3 L on top (`ELICITATION`);
  - measured level (M1 kept): error drawn once, e ~ N(0, 0.2), measuredL = Lg + e/√nEff with nEff = Σ w over the
    version's suites (`EvalRecord.nEff`; `nSuites` stays the count shown in the UI); band 0.2/√nEff. A basic first suite
    reads with √5 × a full one's error, deep with half.
- **Costs** (`EVAL_DEPTHS`): RE 4 / 20 / 45 staff-weeks (0.04 / 0.2 / 0.45 team-weeks; at most 4 / 10 / 15 staff, so
  7 / 14 / ≈21 days at full staffing — v2's gate days), engineers 0.01 / 0.02 / 0.05 team-weeks [D], compute on the
  start model (2·10¹² FLOP/token) 33 / 165 / 1,653 H100e-days (deep rollouts carry 2.5× tokens).
  - Sources: research/20 §G (c) "1–3 weeks with 3–10 staff" per frontier pre-deployment pass → full and deep; HAL
    (≈240 rollouts and ≈$490 per model-benchmark) → full = 250 rollouts, and ≈$317 per benchmark at $2/H100e-hour on the
    start model (HAL's API prices include margins); HCAST 189 tasks × ≈6 runs over ≈3 weeks (METR GPT-5) → deep;
    §G (b) "×10 for frontier long-horizon suites" → deep 4× rollouts × 2.5 tokens; §D2 agentic rollout = 200k
    FLOP-bearing input + 40k output (`TOKENS.agentic`). Basic and engineer time [D].
- **External evaluators** (`runEvals` with by evalGov / evalIndep): a queued task worked by their own staff
  (`EXT_EVAL_STAFF` 10 [D]): no lab research engineers, the lab's compute and engineer support. WS4's evaluator reports
  (`externallyEvaluated`) are unchanged.
- **Standing policy (R7)**:
  - release gate: a finished version waits in `evaluating` for its release suite (queued by the runs system,
    `releaseEvals`); ready when the suite's work is done. Gate `none`: ready at once, and with auto-evaluate a basic
    suite that blocks nothing;
  - auto-evaluate (`evals.autoEvaluate`, called by the products system): the internal uses' models and the stream are
    re-run when they changed in place by ≥ 0.3 L (`EvalRecord.lgAt`) or 30 days after their last suite, at the policy
    depth (the gate's; basic without a gate). Cost visible: the `products.policy` preview with `autoEvaluate: true` shows
    a re-run's RE team-weeks and H100e-days; `evalPolicyView` / `evalQueueView` are the readouts for D8.
  - Queue order: release suites, then the player's orders, then the policy's (oldest first). One open suite per
    version and evaluator; a release need takes over an open policy suite.
- `runEvals` now queues a suite (param `depth`, default full) and its preview shows the work; the eval gate's preview
  and the Safety policy row read the days from `evalDaysFor` (was a fixed table); Blueprint's ready date uses the same
  estimate. BuildLoad labels `eval` items ("Eval harness <version>"); Work.tsx got the `evals` need's label, term and colour (the research-engineer card crashed without them). design/ux/GLOSSARY.md not regenerated (stale before D7 too; regenerate at merge with `tsx scripts/v2/lint-ux.ts --doc`). Glossary: evalGate, evaluating, evals,
  autoEvaluate rewritten. `AUTO_EVAL_DAYS` (features.ts) removed.

#### Schema

24 → 25: `ModelsState.evals`, `evalSpent`; `ReNeed` + `evals`; `BuildKind` + `eval`; `EvalRecord.nEff / lgAt /
depth`. Migration: no suites queued (a version in evaluation gets its release suite on the next tick, from scratch);
`evals` inserted after `ops` in the research-engineer order. data.ts and hygiene.ts rev checks now read `≥ 24`.

#### Choices and deviations [D]

- **Re-run cadence stays 30 days.** A 90-day cadence (first try) gave identical release timing but RefBot's internal
  model kept a noisier measured level for longer; RefBot's mini test ("internal ahead of the served model by
  MINI_GAP_L") then fired at a different day (distill at day 379 instead of 405), and with it the cheaper mini that
  passes SC: seed-2027 SC moved 638 → 604 days (−0.09 y; fixtures "player SC" tolerance ±29 d). Cadences 30–31 give
  638, 45–90 give 604 (bimodal: a knife edge on measurement noise, not a trend). Kept 30 so the reference path is
  unchanged; the "changed in place" trigger is new. Worth a look in E10/F4 (RefBot's decisions keyed on measured L).
- **Change threshold 0.3 L** (1.5 × a full suite's band). With 0.1 L calib T1 authors2026 failed SIAR −0.123 y and ASI
  −0.225 y (tolerance ±0.12 y; baseline −0.027 / +0.041); 0.2 L failed ASI +0.137 y; no change trigger at all gave
  −0.04 / −0.08; 0.3 L gives +0.003 / −0.025. The authors2026 late milestones of seed 2027 swing ±0.2 y with any small
  perturbation (letting evals take no research engineers from tuning moved its SC −12 d and ASI +34 d), so this is a
  knife edge, not a trend; within the stop rule (< 0.3 y), but worth F4's multi-seed check.
- **AI labour does not shorten a suite** (first try let m_EXP multiply the suite's rate: release suites fell from 12 to
  2 days as m grew). The analysis lag (research/20 §G (c)) is the per-suite staffing cap in effective team-equivalents;
  AI frees people instead. With it, reference release suites take 14 days throughout, as in v2.
- Evals sit on the capabilities research engineers (MODEL-V3 §5.6 lists evaluations there), not the safety department's.
- Compute is drawn from experiments rather than serving: evals are research-cluster work; the share is negligible.

#### Reference-run readout (RefBot, ai2027, seed 2027, stub finance)

- First year: 14 suites, 2.96 RE team-weeks, 0.30 engineer team-weeks, 3,262 H100e-days: **0.26% of research-engineer
  capacity** (human team-equivalents) and **0.005% of the experiments pool**. Release suites 14 days each.
- To SC (day 638): 27 suites, as in v2 (same versions and milestone days as the baseline).
- calib T1 after D7 (Δ vs golden, y): ai2027 SC +0.000, SAR +0.022, SIAR −0.016, ASI −0.003; authors2026 SC +0.027,
  SAR +0.052, SIAR +0.003, ASI −0.025; fast SC +0.003, SAR +0.099, SIAR −0.011, ASI −0.090; slow SC +0.049 (baseline:
  ai2027 0 / +0.022 / −0.041 / −0.030; authors2026 −0.005 / +0.022 / −0.027 / +0.041; fast −0.003 / +0.096 / −0.019 /
  −0.096; slow +0.049). calib: all passed.

#### Tests

New `scripts/v2/evals.ts` (in test:v2 after research): EV1 cost by depth and FLOP per token, HAL check; EV2 RMS error
0.45 / 0.20 / 0.10 L over 300 versions, bench noise by depth, drawn-once error shrinking with nEff; EV3 evals capped
at 0.03 team-eq → 39 days, 0.1 → 14 (estimate matches), order applies, deep 21 d; EV4 compute from experiments (project
FLOP × (1 − eval/pool)), not serving; compute-limited progress; EV5 release suite at gate depth, deep for
full + external, re-runs on cadence / change / not when recent / not when off, policy preview cost; EV6 promotion
waits (no RE on evals → still evaluating after 60 d; ready when done), gate none releases at once with a basic suite;
EV7 independent +0.3 L elicitation kept, depth elicitation ordered, external suite on own staff; EV8 migration 24 → 25;
EV9 reference cost bounds. products P8 now checks the suite age against cadence + one suite's duration.

#### Gate results

tsc main + scripts clean; evals, research, products, serving, worktypes, effective, identity, golden-timelines,
fixtures, data, lint-ux/hidden/structure/tradeoffs, calib (T1 all presets): all passed. hygiene: only the four known
perf checks (machine under load). test:ui passed (one earlier run timed out on the setup screen's start tooltip covering
a picker; the baseline edaf6f8 build fails the same way intermittently). Not in the gate, run for information: suites
all passed; ws4 T3 (2, known); safety S4 P_mis at ASI 0.520 (known; 0.485 after M2) and S5 (known). The fixtures test rewrites
scripts/v2/fixtures/*.json; they were restored to HEAD (not part of this branch).

#### For D8 (evals UI)

- Policy row: gate (depth) and auto-evaluate with the per-suite cost (RE team-weeks, engineer team-weeks, H100e-days)
  and the re-run rule (≥ 0.3 L change or 30 days) — `evalPolicyView`.
- Queue: each suite's version, depth, evaluator, why (release / order / policy), progress, ETA and what it waits on
  (research engineers, engineers, compute) — `evalQueueView`; "evaluating" chips should link here.
- Order buttons: own / gov / independent suite with a depth pick (basic / full / deep), preview from `runEvals`.
- Per version: measured level ± band (0.2/√nEff), last suite's depth and date, believed vs measured; bench sd by depth.
- The research-engineer allocation card already lists "Evaluations" (Work tab); the Safety policy row reads
  `evalDaysFor`.

### D8 notes (evaluations UI: Models › Evals; 2026-11-20)

#### Where it lives: Models › Evals (third tab after Versions and Suites)

Evals measure model versions; the measured level and the benchmark table live on the version card in Models, and the
order buttons used to sit there. Safety owns only the release gate (a safety policy), so the gate toggle stays on
Safety › Policies and its row links to Models › Evals; everything else about evals (cost, queue, orders, measurement
quality) has its home in Models › Evals.

#### What it shows (one home each)

- **Eval policy** (`data-home=evalPolicy`, from `evalPolicyView`): gate depth (link to Safety's control), the
  auto-evaluate switch (moved here from the Products header, which now links here), the re-run rule (every 30 d or
  Δ ≥ 0.3 L), the cost of one suite at the policy depth on the internal model (RE team-weeks, engineer team-weeks,
  H100e-days; tooltip adds rollouts and tokens) and suites run so far (tooltip: work spent). Link to Company › Work for
  the research engineers on evals today (the allocation's home).
- **Eval queue** (`evalQueue`, from `evalQueueView`): per suite version, depth, evaluator, why (release / order /
  policy), progress bar, finish date and days, what binds (research engineers / engineers / compute; "waits: …" when
  stalled). Tooltip: work left per part with its days, research engineers on it of the most it can use.
- **Order a suite** (`evalOrder`): depth pick (basic / full / deep) and a depth comparison for the picked version
  (`evalDepthView`): rollouts, RE and engineer team-weeks, H100e-days, days at today's rates, measured-level band after
  the suite, own benchmark noise, elicitation shift. Three buttons (own / gov / independent) run `runEvals` with the
  depth; the preview tooltip is the action's own. A second suite by the same evaluator on the same version is disabled
  with the reason.
- **Measurement** (`evalMeasure`, from `evalMeasureView`): per live version a band chart on a shared L axis (±1 SD
  solid, ±2 SD faint; the value in the tooltip, since the measured level's home stays the model card), ± band, suites
  (count and full-suite equivalents), last suite depth and date, next policy re-run (cadence) or "in queue" link,
  "evaluating" and "policy" chips. Clicking a row picks the version for the order card.
- **Links**: the top strip's "evaluating" chip and the model card's "evaluating" chip open the queue; the model card's
  Evaluate group is now one "Order a suite ›" button (to the order card); its "Last eval suite" row became
  "Measurement › Models › Evals"; Safety's eval-gate row has an "Evals ›" link; Products' header has "Auto-evaluate ›".

#### Engine (output-only selectors, no state or mechanism change)

- `evalQueueView` extended: `binds`, `reDays` / `engDays` / `computeDays`, `reNow` / `reMax`; it now reads today's
  research-engineer allocation (`reAllocation`, so a suite ordered today shows its ETA instead of "stalled" until the
  next tick) and shares the experiments pool's compute in queue order (the D7 view never set `waiting: 'compute'`).
- New `evalDepthView(s, v)` and `evalMeasureView(s)` (no true level: measured level, band, nEff, depth, suite day,
  policy flag with cadence date, open suites). Exported from core/selectors.
- `store.ts` exposes `window.ai27v2Views` (the four selectors) for uitest to compare rendered values with.

#### Glossary

New: `evalSuite`, `evalDepth`, `measureBand`, `elicitation`, `rerunRule`, `evalQueue` (independent evaluator is the
existing `evalIndep`); `autoEvaluate` links to the re-run rule. All added to lint-ux REQUIRED (plus evalIndep, evalGov,
evaluating). design/ux/GLOSSARY.md not regenerated (stale since D7; regenerate at merge).

#### Tests

uitest D8 at day 1, 400 and 900: the four cards render; policy row content; queue rows equal `evalQueueView` (order,
progress, finish days, binds) before and after an order; bands equal `evalMeasureView`; clicking a row picks the
version; the order preview lists RE/engineer team-weeks and H100e-days; ordering basic (day 1) / full (400) / deep (900)
queues a task whose cost equals the preview; duplicate own order blocked; queue tooltip; at day 1 and 400 the suite
finishes and the band shrinks (day 400: Atlas-2.3 ± 0.200 → 0.141) with the last suite's depth; the card's order button
and the top strip's evaluating chip open Models › Evals; every D8 term has a tooltip. 457 passed, 0 failed. The setup
picker flake did not occur, so E12's `clearTips()` fix was not applied.

#### Gaps

- "Believed vs measured" (V3-TASKS D8 row): there is no separate believed level for capability; the view shows the
  measured level and its band only (truth hidden). The evaluating version shows the line's last measured level in the
  top strip (unchanged).
- The re-run rule's "changed in place by ≥ 0.3 L" trigger reads the true level in the engine; the UI shows only the
  cadence date, never whether a change trigger is near.
- Two versions with the same name (for example two "Atlas-4.0-mini" in the day-900 fixture) remain ambiguous (naming
  is not D8's).
- Migrated fixtures (schema 24) show versions "evaluating" with an empty queue until the next tick (D7 migration).

### F1 notes (rivals, China and the leader lab in effective compute; 2026-11-20)

Branch `v3-f1` (from `model-v3` at edaf6f8). Code: new `src/engine/v2/actors/rivalModel.ts` (the physical rival model),
data `src/data/v2/rivalModel.ts`; `actors/rivals.ts` (cadence, releases in G, S5 signal on λ), `actors/china.ts`,
`production/production.ts` (`rivalResearch` replaces the v2 knot function for non-player labs), `models/capability.ts`
(simple-lab lag model removed; rival milestones on λ(G)), `models/runs.ts` (default policy), `security/theft.ts` (theft
hands China the stolen base), `worldfx/serving.ts` + `mix.ts` (rival FLOP per token and students from their own base;
the ASI-point G cap removed), `world/hidden.ts`, `core/init.ts`, `core/save.ts`. Test `scripts/v2/rivals.ts` (in
`test:v2` after ws4). **schemaRev 24 → 25.**

#### Model (MODEL-V3 §12: "compute, a recipe efficiency from its own research (the §5 rate at aggregate level, no ideas),
#### releases on a cadence with G = log₁₀(training FLOP) + e")

- **Recipe e** (OOM over the leader's day-0 recipe, the player's stacks' zero). Stored as `core.pa` = pa_ref + e/B — the
  player's know-how readout relation (stacks.ts syncPa) — so every existing know-how writer (distillation leak, secrets
  leak, open-weights absorption, publish research, poaching, safety spillover) moves e by B per progress-year with no
  change to those files [D].
- **Growth law** de/dt = RECIPE_RATE0 · rs · 10^(−e/r) (capped at 36.5 OOM/yr), r = the world's returns (V3_CAL.r): AIFM's
  software law, the same returns as the player's line pools (research.ts linePool). RECIPE_RATE0 = 0.48/0.8 = 0.6 OOM/yr
  at rs = 1 [R20 B1: Ho et al. 3×/yr pretraining at the pretraining share; calib "V2.8": RefBot's stacks 0.59 OOM/yr in
  year 1].
- **Research speed rs** = min(E, I) × efficiency × modifiers, each normalised to the leader's day-0 lab (V0 on B0, 2,050
  staff, DAY0_REF compute: rs = 1 there exactly, test R5):
  - experiments E = X(c̄, ℓ)·units·T — the player's project CES (stepProject) at aggregate level: research engineers
    (9.68 team-eq per 2,050 capabilities staff, the leader start's ratio), experiment compute per unit, effective
    labour from the lab's own internal model on Experiments (coverage at its G and h50, AI FTE from its agent compute
    × its own FLOP per token, the coding CES), taste T from its AI taste on Research ideas (teamTaste);
  - ideation I = L_IDEAS^λ·T² — scientists (8 team-eq per 2,050) with AI labour on Research ideas; taste twice (ideation
    rate and input per idea, MODEL-V3 §8);
  - min: a line's candidates go through both stages in turn (RefBot's lines are experiment-bound in its takeoff:
    measured 174 candidates/yr ≈ X·√2/54 per line).
  - agent pool split 0.65 Experiments / 0.15 Ideas (the player's default shares) [D]; the mix experiments vs agents is the
    best one (golden section, as the player's auto mix). Efficiency: 10^LEADER_CAL for the leader lab, effLab for China
    (CHINA_CAL.effScale now 1), 1 otherwise; modifiers: a binding leader (rivalSpeedMult), a verified treaty ×0.65.
- **Bases**: one run after another on 60% of the training pool for 121 days (RefBot's sizing, V1 notes), released on the
  archetype cadence (BASE_MONTHS 9–15 × U(0.8, 1.2); research/12 §0.1: "one every ~9–18 months per lab"). G_pre =
  gPreOf(FLOP, 50 tokens/param, E_START + 0.8·e at launch, MoE). Active parameters √(FLOP/(6·50)), FLOP per token 2·N.
  A base no better than the model held (a stolen one) is shelved.
- **Versions**: post-training every 42–70 days (research/12 §0.1: 8 frontier versions in 16 months): G = G_pre + the
  reference RL gain on the base (stacks.ts refRlGain: the player's RL curve) + 0.2·e at launch (RL_SHARE = the RL lines'
  rShare, V3b) [D]; never below the version replaced. From λ ≥ 8.5 (Research agent, v2's simple-lab rule) the internal
  model re-applies today's whole recipe to its base weekly (the player's P08 stream semantics) [D].
- **Public models** lag the internal one by RELEASE_LAG (unchanged), copied with their G and design.
- **Start state**: the start base is B0 (3e26 FLOP) × the lab's training pool / the leader's day-0 pool, on B0's dates
  (launched day −256): its recipe is that many days of RECIPE_RATE0 staler; e₀ solved so the start version is the drawn
  start model (T4 draw unchanged). The leader lab's e₀ = −0.027 (the leader's day-0 recipe).
- **Milestones** for every non-player lab: λ(best G) ≥ the level knot (one map, MODEL-V3 §2.2; L 10 = the reference
  recipe's SC point). The S5 signal reads the capability index of λ, not pm thresholds.
- **Theft**: China gets the weights (G 60 lead-days behind its source, as before), the stolen base (its FLOP, size, the
  G_pre the copy embodies) and post-trains it at its own recipe; its recipe does not jump (secrets leak is the recipe
  channel).
- pm, Lg, domains of rival models are readouts of G (pm = Φ(G): the bridge F3 retires).
- Guards [D]: AI taste counted up to 30 SD, recipe growth ≤ 36.5 OOM/yr (the fast preset produced NaN past ASI without
  them). Neither binds before ASI.

#### Removed

`simpleLag`, `simpleFrontierPm`, `simpleStartPa`, `simplePaFor`, `trainScaleTerm`, `TimelineWorld.simpleCredit`,
`CAL_SHIFT_V2`, `LabCore.lagCal` (LEADER_CAL is now an efficiency), the rivals' v2 knot production (labInputs for non-player
labs; the knot function stays only as the identity test's reference, tagged), `trackLabFrontier`, `fptOfG`,
`RIVAL_ALGO_OOM_PER_YEAR`, `marketModel` (the ASI-point G cap: rival G stays ≤ 40 through ai2027's takeoff to day 1100).
Rivals read no calShift / pm thresholds / capIndexV2. Lint R7: no BRIDGE(V7) in actors/rivals.ts, china.ts,
rivalModel.ts, worldfx/mix.ts, worldfx/serving.ts. BRIDGE(V7) tags left outside rival code: production.ts (v2 knot
function, identity test only; the player's `rate` readout for the lead readers), research.ts gRate (same), runs.ts
`scaleOf` / runDesign `TrainingRun.scale` (scrutiny vs F(t)), workfit.ts domainG (imported open model via gOfPm), types.ts
TrainingRun.scale.

#### Calibration (seed 2027)

Δ in years vs golden; before = M2 (v2 lag model, LEADER_CAL as a release lag), after = F1.

| Check | Before | After |
|---|---|---|
| T1 RefBot (stub) ai2027 SC/SAR/SIAR/ASI | 0 / +0.020 / −0.043 / −0.029 | 0 / +0.022 / −0.041 / −0.030 (same days) |
| T1 authors2026 | −0.006 / +0.022 / −0.028 / +0.039 | +0.008 / +0.022 / +0.052 / +0.033 |
| T1 fast | −0.002 … | −0.003 / +0.096 / −0.019 / −0.096 (unchanged) |
| T1 slow SC | +0.049 | −0.079 (tolerance ±0.08: the known knife edge, F4) |
| T1L ai2027 (LEADER_CAL 0.256 → −0.048) | −0.047 / −0.011 / +0.030 / +0.066 | +0.014 / **+0.216 / +0.310 / +0.427** |
| T1L authors2026 (0.096 → 0.242) | −0.038 / +0.011 / +0.038 / +0.058 | −0.007 / **+0.43 / +2.5 / +5.6** |
| T1L fast (0.134 → 0.068) | −0.038 / −0.038 / +0.019 / +0.055 | +0.049 / +0.088 / −0.016 / −0.082 (pass) |
| T1L slow SC (0.314 → 1.155) | +0.014 | −0.008 (pass) |
| ws4 T3 start lead | 184 d (pass) | 184 d (pass) |
| ws4 T3 mean lead d30–540 (8 seeds) | 185 d (pass) | 192 d (pass; CHINA_CAL.effScale 3.2 → 1) |
| ws4 T3 band 75–275 d | 28–371 (fail) | **−103–450 (fail)** |
| ws4 T3 post-theft ≈ 60 d | 52, 0, 0, 42, 45, 0, 45, 42 (fail) | 61 × 8 (pass) |
| ws4 T4 start gaps (fixture seed; 200 seeds) | 3.1–4.7 mo; 98% in 3–9 | same |

LEADER_CAL is now the leader lab's research efficiency (log₁₀). Fit (`calib.ts --fit-leader`): bisection on SC, then the
worst-error refine; where no value brings every milestone within tolerance the SC root is kept [D]. authors2026 was
re-bisected by hand after the mix search went from 24 to 16 steps (SC 1545 at 0.239 → 1491 at 0.242).

**Why T1L's late milestones miss (reported, not forced).** The aggregate leader takes off slower than RefBot after SC:
its recipe growth plateaus near 12–14 OOM/yr (research input E ∝ X·taste, and taste rises ×1.71 per OOM of G while each
OOM of recipe needs ×10^(1/r) = ×1.78 more input at r = 4: balanced growth), while RefBot's stacks reach 25–40 OOM/yr.
Measured on RefBot (ai2027 stub): its research lines are experiment-bound in the takeoff exactly like the aggregate (174
candidates/yr per line ≈ X·√2/54), and its lines carry only 3.8 of the 5.9 OOM its stacks gain between day 600 and 860 —
the rest comes from one-off idea projects and paradigms, which rivals do not have ("aggregate, no ideas"). Before SC the
two agree (RefBot's stacks 0.59 OOM/yr in year 1; the leader's recipe 0.5–0.6). One scalar cannot fix the shape: a
higher efficiency moves SC early before it moves ASI enough. Options for F2: an aggregate idea channel (the tree's
one-off stack ideas as a finite stock drawn down at the research rate) or a second per-preset value for the leader's
takeoff. slow needs efficiency ×14 (r = 1.2).

**Leader G path** (passive, ai2027): 27.97 / 28.00 / 29.13 / 29.16 / 29.20 at research/12's 28.0 / 28.4 / 28.7 / 29.0 /
29.4 anchors (Aug 2025 … Oct 2026): a staircase of bases (first new base Jan 2026), mean slope ≈ 1 G/yr; RefBot's line fit
is 1.31 G/yr. Not a T1L check.

**Takeoff rival agent spend** (scratch `.f1tmp/diag.ts` = A4's diag: RefBot classic ai2027 seed 2027, world demand-side
agent spend, all providers): day 900 / 1000 / 1100 / 1200: before $4.0T / $16.5T / $13.0T / $1.0T → after $2.3T / $4.0T /
$3.2T / $0.86T (A4 measured $17–24T/yr on its baseline). Rival models are now sized by their own bases (≈ 1–4.5T active
by 2028) instead of the G bridge that grew N with every OOM of takeoff G; rival G stays ≤ 40 through day 1100, so the G
cap went.

#### Gate

- tsc main + scripts clean.
- Pass: rivals (new), serving, danger, research, worktypes, effective, golden-timelines, identity, products, money, idle,
  fixtures (rewritten and restored), lint-hidden, lint-ux, lint-tradeoffs, lint-structure, hygiene (save checks incl.
  the new 24 → 25 migration; the four perf checks fail as known, under machine load: 5.2 / 9.6 ms a day), `npm run
  test:ui` 416 passed / 0 failed (a first run timed out on a Setup tooltip under load; the rerun passed).
- calib: T1 all presets in tolerance (above); T1L fails ai2027 SAR/SIAR/ASI and authors2026 SAR/SIAR/ASI (above).
- ws4: only T3's band (above); post-theft now passes.
- worldfx: known F7/F11 2026 $33.8B (was $33.5B), GOV T1 2027-09-03, W2 0.4% (was ≈0.49%); F11 2027 $53.6B (was $31.9B);
  **now passing** U +1 pp (2027-12-17; was "never") and equity 2026 (+34.3%; was −13.9%); **newly failing** A2a US hours
  of AI use mid-2026 6.7% (band 5–6.5%) and W4 firm adoption 22.9% (17–20 ± 2): the rivals' model paths and prices
  changed (rivals no longer run on v2's pm path), so adoption in the one-seed world is a little higher. Not tuned (A-task
  anchors).
- finance (report): F2 global production 2027 **now passes** (was 43.1M); F7 revenue median $33.3B, valuation $0.66T (was
  $0.28T), F11 2027 $43.1B; **F9 unanchored round dilution 10.2% (≤ 8%) newly fails** — finance session.
- Performance: a rival day costs ≈ 1.4 ms for six labs under load (mix search 16 golden-section steps, f-independent
  parts memoised).

### M4 merge notes (E6, E4, E12, D8 + D7, F1 onto M3; 2026-11-20)

Merged into `model-v3` (at M3, 599f503) with `--no-ff`, in order: `v3-e6` (E6 2563dc5 / 190e27d; merge d8f5536),
`v3-e4` (E4 c06e610 / 5d11dc1; 55d3e74), `v3-e12` (E12 ccc7ad2, contains v3-e4; d9b69b5), `v3-d8` (D7 f84c954 /
6a39013, D8 af74f7f; 70ad8a4), `v3-f1` (F1 d2d8b01 / 422d383; 50b15dd); then the refit (e00dc31). Every branch started
at edaf6f8 (M2's head, before M3's D4 and D11). The notes of every branch are above (copies of `design/notes/E6.md`,
`E4.md`, `E12.md`, `D7.md`, `D8.md`, `F1.md`, which stay). design/ux/GLOSSARY.md regenerated (`lint-ux.ts --doc`;
stale since D7).

**Conflicts and resolution.**
- v3-e6: none; tsc clean. E6's M removal touched no M3 code path (D4 and D11 read no M).
- v3-e4: `package.json` (successor.ts after signals, oversight.ts kept). **Semantic: E4's `successorOversight` called
  `versionM` (deleted by E6).** Rewired exactly as v3-e7's step 0 (e39c1b9): `successorOversight(s, v) =
  internalOversight(s, v, 'SUCC').oversight` (E6's hook: containment at v's OOM with the U-mode multiplier, monitors and
  tools, human review × the gap factor above L 10, control-protocol misses). The `r` parameter went (the hook reads
  `aiRdShare` itself); `successor.ts` follows the signature; traits.ts no longer imports `containment`,
  `monitoringCatch`, `HUMAN_REVIEW`, `uModeContainMult` or `versionM`. E6's lint allowance in `oversight.ts` (INHERIT_K /
  inheritFromFleet / `prodCache.M` in traits.ts) is gone: nothing in traits.ts matches any more, and the lint says so.
  successor (11 checks) and oversight (29) pass; RefBot fixture readouts: start ω 0.049, day 400 0.159, day 900 0.653.
- v3-e12: lint-ux REQUIRED (D4 and E12 lists), uitest (`d4Check` and `e12Check` both kept and called at day 1 / 400 /
  900; E12's `clearTips()` before the setup picker loop kept), Blueprint imports (D4's `drawByDomain`, `mixTargetOf`,
  `SPEC_CAP` with E12's `plannedPressure`, `successorPullView`, `versionById`, Pressure rows), Models imports,
  blueprint.css (both blocks). **Semantic: E12's belief view `successorPullView` (safety/pressureView.ts) read
  `mAtLevel`** (deleted by E6). It now mirrors `internalOversight(s, v, 'SUCC')` term by term with what the player
  knows: x = λ⁻¹ of the measured level (`oomOfLevel`); block = AG07 containment at x with believed strength, on v's
  internal deployment or the first live one (the hook's fallback), no hidden U-mode multiplier; monitors = believed
  COT/WB detection on SUCC at x with believed penalties × (0.5 + 0.5 × fleet monitor); human = HUMAN_REVIEW·(1 − r)·
  gapFactor(measured gap above L 10); caught = 1 − (1 − monitors)(1 − human)·controlMiss (0.447 under control
  protocols). Parts gain `human` and `controlMiss` (shown in the Safety successor tooltip). Believed vs true ω on the
  fixtures: day 400 0.165 vs 0.159, day 900 0.588 vs 0.653 (E12's M-based view: 0.151 / 0.590). lint-hidden passes.
- v3-d8: `package.json` (evals.ts after research), `save.ts` (comments and migrations, chain below), `data.ts` /
  `hygiene.ts` rev assertions, lint-ux REQUIRED (D8's list after D4's and E12's), `products.ts` imports (E6 dropped
  `MONITOR_CATCH_BASE`, `AG05_GAP`, `mAtLevel`; D7 dropped `AUTO_EVAL_DAYS`, `runEvalSuite`), **Models.tsx: four tabs
  Versions | Suites | Data | Evals** (header comment, imports `Database, Dumbbell, ListChecks`, both tab branches),
  Safety.tsx and store.ts imports (E12's `successorPullView` and probe, D8's `evalDaysFor` and `ai27v2Views`), uitest
  (`e12Check` and `d8Check` kept, call sites at every state, both term checks). workfit.ts (E6's control tax),
  research.ts (D7's evals need), types.ts, glossary.ts, Agents.tsx auto-merged. `evals.ts` EV8 now starts from a
  schemaRev-25 save.
- v3-f1: `package.json` (rivals.ts after ws4), save.ts, data.ts / hygiene.ts (rev, F1's save check). production.ts,
  capability.ts, runs.ts (F1 × D7 × D11), types.ts, selectors.ts auto-merged; F1's rival bases call D11's `gPreOf`
  without `fQual` (quality 1, as on F1's branch).
- test:v2 runs every new test: successor, evals, oversight, rivals (plus data, suites, signals, safetyresearch, danger).

**schemaRev chain (linear): … 23 → 24 D2, 24 → 25 E6 (`oHalf` from M½), 25 → 26 D7 (eval tasks, `evals` need),
26 → 27 F1 (`RivalLab.phys`); SCHEMA_REV 27.** All three were built as 24 → 25; they touch disjoint state (techniques,
models and the research-engineer order, rivals), so the order is safe. hygiene expects 27 and checks 24 → 25 (E6's,
unchanged), a new 25 → 26 (no eval suites, `evals` after `ops`) and F1's check, now from a rev-26 save (each rival keeps
its model on a physical base); every older check passes. data.ts asserts 27. **Fixtures** stay the committed
schemaRev-16 files (every load runs 16 → 27); `fixtures.ts` rewrote them in the gate and they were restored.

**Lead decisions (recorded).**
- E6: tool half points are fixed in OOM above V0 (physical), kept: in worlds whose milestones need more compute the
  tools fade at lower display levels (authors2026 AG08 halves at L 8.8).
- E4: accepted.
- E12: accepted; the successor-pull UI is belief-based (`successorPullView`, now on E6's terms).
- D7: accepted; the re-run rule (30 d cadence, 0.3 L change trigger) was chosen on seed 2027 (90 d moved SC −0.09 y via
  RefBot's mini timing; 0.1 / 0.2 L moved authors2026 SIAR / ASI out of tolerance) → F4 multi-seed check.
- D8: accepted, with F6 jank items: the auto-evaluate 0.3 L trigger reads the true level (a hidden-truth leak: it
  should trigger on known events, in-place updates and the stream); duplicate version names.
- F1: accepted. T1L post-SC misses → F2 (rival idea channel, running). New worldfx borderline failures (A2a US hours
  6.7% vs 5–6.5%, W4 firm adoption 22.9%) accepted as known; finance F9 round dilution → finance session (in the M4
  gate F9 passes: max 6.5% over 62 rounds).
- M3's two worldfx timing misses (HireRate_SOFT by 2027-10-02 vs 10-01, remote-work 25% by 2028-01-20 vs 01-01)
  accepted as single-seed borderline → F4. (Both pass on the M4 code: 2027-06-20 and 2027-10-27.)

**Refits (named per-preset values only; seed 2027; Δ in years; G_SC scans with M3's scratch `_m3scan.ts`, Δ_bm and
sd_SC kept).** calib on the merged code: ai2027 and fast pass; **authors2026 ASI −0.205 (SIAR −0.093) and slow SC
−0.753 fail.** Bisected on exported trees of each merge at M3's values: the E6 and E4 merges give authors2026 ASI
+0.112, the D8 merge 70ad8a4 ASI +0.000 (SIAR +0.000) and slow SC +0.049; the F1 merge gives the failures (F1's own
branch: authors2026 ASI +0.033, slow −0.079).
- **authors2026 G_SC 33.632 → 33.622**: SC +0.030 → +0.016, SAR +0.058 → +0.036, SIAR −0.093 → +0.016, ASI −0.205 →
  +0.038. Scan (ASI): 33.617 +0.079, 33.620 −0.005, 33.622 +0.038, 33.624 +0.047, 33.627 −0.107 (SIAR −0.055), 33.632
  −0.205, 33.637 +0.142 (fail), 33.640 −0.244, 33.642 −0.022, 33.644 −0.299, 33.647 +0.164. Jagged (the late milestones
  swing ±0.2 y with tiny moves): 33.622 is the middle of the 33.617–33.627 run. F4.
- **slow G_SC 35.493 → 35.488**: SC −0.753 → +0.049. Scan: 35.480–35.482 −0.753, **35.484–35.492 +0.049**, 35.493,
  35.497, 35.500 −0.753, 35.502–35.515 +0.049. M3's value now sits one step past the first window's end. The wider
  window 35.502–35.515 was not taken: the world's level knots move with G_SC, and the leader lab's T1L slow SC is
  +0.30 y at 35.508 vs +0.13 y at 35.488 (+0.16 at 35.493). F4.
- ai2027 (SC +0.019, SAR +0.030, SIAR +0.019, ASI +0.022) and fast (SC +0.047, SAR +0.107, SIAR −0.016, ASI −0.101:
  SAR and ASI within 0.02 y of the edge) unchanged and in tolerance. T2 and T4 pass. No value moved by more than
  0.015 OOM; the ±0.3 y stop rule was not reached.
- **T1L (reported, not refit: F2's job)**: ai2027 SC +0.011, SAR +0.216, SIAR +0.310, ASI +0.427; authors2026 SC
  −0.030, SAR +0.427, SIAR +2.53, ASI +5.55 (F1's set); **new on the merged code** (F1's branch passed both): fast ASI
  −0.163 (895 vs 956; SC, SAR, SIAR pass) and slow SC +0.126 (4804 vs 4758). Not bisected further: before F1 the
  leader runs v2's lag model, so the only comparison is F1's branch alone, which passed; the move comes from F1 meeting
  E6 / E4 / D7 and M3's D11 paths. → F2.

**Gate (merged code e00dc31 + docs).**
- tsc main + scripts clean after every merge; `npm run build` ok; `npm run test:ui` **555 passed, 0 failed** (four
  Models tabs; D4, D6, D8, E12 checks at day 1 / 400 / 900; run before the refit, which changes no ai2027 value).
- Pass: golden-timelines (known WARNs), identity, effective, data, suites, signals, successor, research,
  safetyresearch, evals, worktypes, serving, danger, oversight, products, rivals, calib T1 (all presets, after the
  refits), fixtures, lint-hidden, lint-ux, lint-tradeoffs, lint-structure, lint-tips, money, idle.
- calib: T1L's 8 failures above are the only calib failures.
- hygiene: only the four perf checks (daily 6.6 ms, worst quarter 38 ms; leader lab 17.3 ms / 53 ms; the leader lab's
  own cost +7.3% passes). Every save check passes, incl. 24 → 25, 25 → 26, 26 → 27.
- finance: F7 revenue median $30.7B, F7 valuation $0.52T, F11 2027 $42.9B (the known set); **F2 global production
  2027 now passes (47.1M)** and F9 passes (dilution 6.5%).
- ws4: T3 band −103–450 d (the known T3; F1's set); post-theft 61 d and T4 pass.
- worldfx: F7/F11 2026 $32.6B, F11 2027 $51.6B (known revenue); A2a 6.7% and W4 22.8% (F1, accepted); **W2 automation
  TFP 0.4%** (the accepted borderline, failing again since F1: F1's branch reported the same 0.4%; it passed in M3);
  equity 2026 +33.9%, U +1 pp 2027-11-26, GOV T1 2027-09-27, HireRate_SOFT 2027-06-20 and 25% remote work 2027-10-27
  pass.
- safety (slow): S4 RefBot P_mis at ASI **0.501** (M3 0.522; band 0.55–0.85; known → E10), S5 RefBot fails (median U −
  L at SAR +0.64, below in 33%; known); S4 safe-only 0.013, S5 mixed (margin +0.12, holds in 60%), S6 and B3 pass.
