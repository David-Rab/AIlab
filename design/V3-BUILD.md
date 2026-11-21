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
| `pm` of a version / base | V1 | Φ(G): the old progress coordinate computed from effective compute, so the production function, milestone thresholds, M-based readouts, rivals and safety keep working | V3 for the player's research and milestones (done: departments/workfit.ts); still the display level λ(G) = levelOf(Φ(G)), V6 (safety M), V7 (rivals). **Removed in F3 (merged M6):** every lab's level is `levelOfG(G)`; `pm` state gone (schemaRev 33) |
| `e_stack` from know-how `pa` | V1 | stack efficiency (OOMs) = E_PER_PA × (pa − pa₀) until ideas exist | V2; the `pa` readout itself removed in F3 (M6; the safety tier keeps its pa-equivalent value in G → E18) |
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

### T0 notes (test infrastructure: tiers, simulation cache, parallel runner; 2026-11-20)

Branch `v3-t0` (from `model-v3` at 50b15dd). No game mechanism changed and no check's verdict logic changed.

#### What to run

| who / when | command | runs | wall time here (12 cores, loaded) |
|---|---|---|---|
| task agent, while iterating | `npm run test:quick` | tsc (main + scripts); every unit-style and short-sim script at full strength; calib, safety, finance, worldfx, ws4 and idle in SMOKE mode | 4.0 min after a code change (99% load); 2.0 min on the same code |
| task agent touching calibration | `npm run test:cal` | golden-timelines + calib T1, T1L, T4 | 1.5 min after a code change, 6 s on the same code |
| a few scripts at full strength | `npx tsx scripts/v2/run.ts --tier full --only calib,finance` | just those scripts | |
| merge gate: once at the end of a task, once after a merge | `npm run test:full` (`npm run test:v2` is an alias) | every check of the old `test:v2` chain, all seeds, plus `test:ui` | 17.7 min after a code change (87% load); 6.6 min on the same code |
| perf budgets, quiet machine only | `npm run test:perf` | hygiene's 5 performance checks | 0.5 min |

**Policy.** Task agents run `test:quick` (plus `test:cal` if they touch calibration, or `--only <script>` for the suite
they are working on) while they iterate. They run `test:full` **once**, before reporting the task done. The merger runs
`test:full` once on the merged branch. Run `test:perf` only on a quiet machine. **Only one full tier per machine at a time.**
`test:full` already starts 6 worker processes. Two agents running it at once on 12 cores each take twice as long, and
the old sequential chain run by several agents at once is what made test runs take hours. A green quick tier is a smoke
signal, not a gate. Its SMOKE lines can never fail.

#### 1. Baseline (before): every script run one at a time

Measured on 50b15dd with the old commands (`npx tsx …`, `npm run test:ui`), one script at a time, while other agents
loaded the machine. Load = the share of all 12 cores busy during the script (the load from my own script is included).
"Checks" counts PASS / FAIL / WARN lines (OK lines for lint-* and the UI test). CPU = the summed node process CPU (tsc 7
is native, so its CPU is not captured).

| script | wall s | CPU s | load | checks P/F/W | what it simulates |
|---|---:|---:|---:|---|---|
| tsc scripts | 26 | – | 100% | – | – |
| tsc main | 17 | – | 100% | – | (not in old test:v2; it is part of `npm run build` in test:ui) |
| golden-timelines | 38 | 19 | 100% | 15/0/3 | v1 reference integrator (no engine): 5 presets to ASI (≤ 40 y daily) + 500 sampled seeds to SC (≤ 75 y daily) |
| identity | 22 | 11 | 99% | 76/0/3 | unit (newGame, 200-step loops) |
| effective | 29 | 19 | 100% | 27/0/0 | ai2027/2027 passive to day 500; start types |
| data | 21 | 12 | 99% | 58/0/0 | unit + 20-day runs; reads fixtures |
| suites | 22 | 15 | 98% | 28/0/0 | unit + 3 × 60 days; reads fixtures |
| signals | 22 | 12 | 96% | 19/0/0 | unit |
| successor | 34 | 14 | 99% | 11/0/0 | unit; reads fixtures |
| research | 36 | 27 | 97% | 28/0/0 | passive runs ≤ 600 days (seeds 11, 2027) |
| evals | 32 | 31 | 97% | 31/0/0 | unit + stub RefBot ai2027/2027 to day 365 |
| safetyresearch | 22 | 20 | 93% | 30/0/0 | 60-seed newGame loops, one 400-day run |
| worktypes | 62 | 71 | 90% | 16/0/0 | passive 8-year line run; stub RefBot ai2027/2027 to ASI |
| **calib** | **276** | 307 | 68% | 30/10/7 | T1 stub RefBot × 4 presets to ASI (slow: SC ≈ day 4,750); T1L leader lab × 4; integrated RefBot × 4 (≤ 16 y); T2 stub to SC; T3 stub days 30–540; T4 40 newGames |
| fixtures | 25 | 32 | 56% | 10/0/0 | stub RefBot ai2027/2027 to day 900; challenger and spinout RefBot to day 400. **Rewrote the committed fixtures** |
| hygiene | 82 | 107 | 67% | 206/4/0 | newGame matrix; determinism 2 × 1,500 d; stream isolation 6 × 400 d; save 2 × 1,560 d; cadences 730 d; perf 2 × 1,500 d + 8 × 300 d (the 4 FAILs are perf under load) |
| lint-hidden / -ux / -tradeoffs / -structure | 9 / 9 / 6 / 7 | 5–8 | 48–65% | 1 / 9 / 486 / 7 | static |
| **safety** | **991** | 996 | 73% | 16/2/0 | S4: RefBot seeds 500–539 and the safe recipe seeds 700–739, integrated, to the player's ASI (≤ 1,600 d); S5: mixed bot seeds 900–919 to SAR; S2 120 newGames |
| danger | 10 | 8 | 64% | 27/0/0 | 8 seeds, start acts |
| oversight | 10 | 8 | 69% | 29/0/0 | unit |
| **finance** | **253** | 268 | 64% | 63/3/0 | RefBot + REF autopilot seed 1 to 2029; 12 seeds RefBot to 2028; 12 seeds no-financing to Q1 2027; 12 seeds capex2x to 2028; 3 passive shock runs × 16 quarters; F10 passive 5 y with 400 sites; 100-day action runs from day400.json |
| worldfx | 82 | 97 | 61% | 33/5/0 | RefBot classic ai2027/2027 to Apr 2028; reality × 2 to Nov 2026; W2 probe 10 y (production off); W3 × 2 RefBot to 2031; SEZ RefBot to 2031 |
| ws4 | 114 | 144 | 53% | 25/1/0 | E2 1,000 fuzz seeds from the fixtures; E4 36 games × 300 d with crisis spam; E5 17 endings × ≤ 300 seeds × 3 d; T3 RefBot 8 seeds × 540 d; T4 200 newGames |
| rivals | 32 | 39 | 75% | 13/0/0 | passive runs of 365–730 days |
| products | 11 | 10 | 63% | 58/0/0 | unit |
| serving | 35 | 45 | 59% | 75/0/0 | unit + RefBot ai2027 and fast to day 1,200 |
| money | 24 | 31 | 57% | 24/0/0 | 3 bots × 730 d |
| idle | 153 | 174 | 61% | 3 OK | 2 starts × 4 bots × 2 seeds × 1,100 d |
| test:ui | 314 | 34 | 46% | 555 OK | vite build + headless Edge (mostly browser wait time) |
| **total** | **2,826 (47 min)** | 2,580 | | | |

Findings:
- Under load `npx tsx` costs about 10 s per script before any test code runs (`npx` resolution plus the tsx CLI's child
  process): 14–18 s against 4–5 s for `node --import tsx` on a trivial script. That is about 5 min over the chain. The runner uses
  `node --import tsx`.
- One script takes a third of the chain: safety (100 full games). Next come calib, finance, test:ui and idle.
- The old chain is `&&`-joined: at 50b15dd calib fails (10 known T1/T1L failures of the model-v3 work), so `npm run test:v2`
  stopped there and never ran the 18 scripts after it.
- The old chain was order-dependent. fixtures.ts rewrote `scripts/v2/fixtures/*.json` mid-chain, so data/suites/successor
  (before it) read the stale committed fixtures (schemaRev 16, migrated on load) and finance/ws4/worldfx/products (after
  it) read fresh ones.

#### 2. Simulation cache (`scripts/v2/simcache.ts`)

`cached(name, key, files, compute)` returns `compute()`'s record, read from `.simcache/` when it has already been computed for the same key and code.

- **Key** = sha256 of: a **code hash** + `name` + the sorted-key JSON of `key` (bot, setup, seed, days, options, the
  calibration values in effect). The code hash covers the content (not mtimes) of every file under `src/` except
  `src/ui/**` and `src/main.tsx`. If any hashed file ever imports the UI, the UI is hashed too: this is checked on every
  run. It also covers `scripts/v2/lib.ts`, `simcache.ts`, the caller's `files` (the script that defines the run and its
  record, plus helpers such as `safety-emu.ts` and `worldfx-refplay.ts`), all of `scripts/v2/fixtures/**` and `scripts/v2/golden/**`,
  `package-lock.json` and the Node version. Any change to engine or data code invalidates every entry. There is no
  partial invalidation. Editing a UI file keeps the cache valid; appending a comment to `src/engine/v2/core/time.ts`
  invalidates it (both checked).
- **Records**: what the checks read (milestone days, series, arrays of outcomes). Records that need end-state values
  keep a `pick()` of the exact state paths read, or the whole state (the worldfx classic run, whose checks call engine
  functions on it). Values a script computed on the live state (`validateJson`, `stateHash` round trips) are computed
  inside the run and stored. On a miss the record is round-tripped through JSON before it is returned, so a cold run and a
  warm run see byte-identical values. A record that JSON would change (NaN, ±Infinity, undefined in arrays, Maps) throws.
- **Files**: `.simcache/<name>-<code8>-<key16>.json` (git-ignored), written atomically. Entries not used for 3 days are
  pruned by the runner. `SIMCACHE=off` computes every run and touches nothing (the reference behaviour). `SIMCACHE=refresh`
  recomputes and overwrites. Each script prints `simcache: H hit(s), M miss(es)` to stderr.
- **Prefill shards**: a script given `--prefill k/n` computes every n-th of its cached runs (from k) and exits. The runner
  starts safety as 6 shards, calib as 4 and finance as 3 (2 in quick), then starts the script itself, which reads the cache.
  Each sharded script lists its runs in one `prefill([...])` call, in the order its checks ask for them.
- Through the cache: calib (T1, T1L, integrated, T2, T3; the `--fit-*` modes are not cached), golden-timelines,
  fixtures, safety (S4/S5 games), finance (bot and shock runs), worldfx (all 7 runs), ws4 (E2, E4, E5, T3, T4).
  calib T1/T1L share keys between `cal` and `full`, so `test:cal` after `test:full` takes seconds.

#### 3. Tiers (`scripts/v2/run.ts --tier quick|cal|full|perf [--only a,b] [--workers N] [--no-ui] [--list]`)

- Worker pool, 6 workers by default. Jobs start in order of critical path, using the times in `.simcache/last-run.json`.
  test:ui starts first: it is about 6 min of wall time but only 40 s of CPU, so it overlaps the simulations.
- Each job's output goes to `.simcache/logs/<id>.log`. The runner prints the FAIL lines of failed jobs as they finish, one
  summary table (script, mode, pass/fail/warn/smoke counts, cache hits, wall, CPU) and the machine load. It writes
  `.simcache/last-run.json` and exits 1 on any failure.
- **full** = exactly the old test:v2 scripts with all seeds, plus test:ui. Only two things differ:
  - **Moved to `perf`** (hygiene `--perf-only`; full runs hygiene `--no-perf`): `performance: daily tick average`,
    `performance: worst quarter tick`, `performance (leader lab): daily tick average`, `performance (leader lab): worst
    quarter tick`, `performance (leader lab): its own cost ≤ +20% of a tick`. They measure wall time and fail on any loaded
    machine (2.4–7.3 ms/day here against a 1.5 ms budget). perf runs under exactly the same instrumentation wrappers as
    before.
  - **Added**: `fixture … equals the committed …` (5 checks) and `golden/timelines.json equals the integrator output` (1).
    These replace the silent rewrites (§4).
- **quick**: tsc main + scripts and every script except those below at full strength (hygiene `--no-perf`). Runs in
  SMOKE mode (`--smoke`, from `lib.ts` `SMOKE` / `smokeCheck`). A check whose inputs are cut prints `SMOKE (in band|out of
  band|not reached …)` and can never fail. A check that still runs at full strength stays binding, as does an "every
  seed / every sample" check on a subset of seeds (a failure on the subset is a failure of the full check):
  - calib: T1 and T1L on ai2027 only, cut at day 700 (after the 2027.0 METR read, the Nov 2026 G-path end and the
    golden SC). A milestone reached within the cut is checked exactly as in full. One not reached prints SMOKE. T4 runs.
    The integrated runs, T2 and T3 are skipped.
  - safety: 1 seed per bot (RefBot and safe recipe to ASI, mixed bot to SAR). S4/S5 thresholds print SMOKE. The JSON check and
    S1–S3, S6 and B3 are binding.
  - finance: 1 seed per bot, the long run to end-2027. F2, F3, F6, F7, F8, F9 dilution and F11 path print SMOKE. F1, F4, F5, F9
    and F10 and the content checks are binding.
  - worldfx: skips W3 and the SEZ path (to 2031) and the informational authors2026 run. Every check that runs is binding.
  - ws4: E2 on 60 seeds, E4 on 2 seeds per storyteller (limits binding, "> 50 crises" SMOKE), T3 on 2 seeds (mean SMOKE,
    the per-sample bands binding), the T4 spread printed over 20 seeds.
  - idle: `--seeds 1` (all its checks are invariants, so they are binding).
- **cal**: golden-timelines + `calib --cal` (T1, T1L, T4).
- **perf**: `hygiene --perf-only`, 1 worker. Run it on a quiet machine.

#### 4. Committed files are no longer rewritten by tests

- `fixtures.ts` builds the fixtures and **compares** them with `scripts/v2/fixtures/*.json`. `--write` (or
  `npm run fixtures:v2`) regenerates them. A stale fixture now fails with "run npx tsx scripts/v2/fixtures.ts --write and
  commit the fixtures".
- `golden-timelines.ts` likewise compares `golden/timelines.json` with the integrator output (`--write` regenerates it).
  At 50b15dd it was already identical.
- The committed fixtures were stale (schemaRev 16 against code at 27). They were regenerated on this branch (commit bf06eb3, byte-identical
  to what the old chain wrote). **For later tasks:** any engine change that moves the fixture games makes `fixtures` fail
  until the author runs `fixtures.ts --write` and commits. After merging two branches that both touch the engine, run it
  again on the merge, because single-line JSON fixtures cannot be merged by hand.
- Removing the rewrite also removes the chain's order dependence. Every script in a run reads the same committed fixtures, so
  the parallel order cannot change a verdict.

#### 5. Proof: identical verdicts with and without the cache

Every log is normalized (`[N ms]` timings, the simcache/prefill stderr lines and the root path removed) and compared line by line.

| comparison | scripts | result |
|---|---|---|
| old code (baseline) vs new code `SIMCACHE=off` | calib, safety, finance, worldfx, ws4 | identical full text (88 / 23 / 68 / 50 / 28 lines) |
| same | golden-timelines | identical except "wrote timelines.json" → `PASS golden/timelines.json equals the integrator output` |
| same | fixtures | the same 10 verdicts + the 5 new "equals the committed" PASS lines |
| same | hygiene | the same 205 verdicts; the 5 perf lines removed (now in `perf`) |
| `SIMCACHE=off` vs cold (`SIMCACHE=refresh`, prefill shards, JSON round trip) | the 7 cached scripts + hygiene | identical full text |
| cold vs warm (all hits: safety 100/100, finance 40/40, calib 14/14, worldfx 7/7, ws4 5/5, fixtures 3/3, golden 5/5) | the same | identical full text |
| baseline vs new full run | the 20 unconverted scripts | identical, except data / suites / successor, which differ only because the baseline read the stale schemaRev-16 fixtures (see §1). Rerun in the baseline copy on the fresh fixtures, they are identical. |
| cold vs warm | test:ui | the same 555 OK verdicts; one detail differs (the UI test types a random setup seed) |

The verdicts at 50b15dd, identical in every mode: calib 10 FAIL (T1 authors2026 ASI, T1 slow SC, T1L × 8), safety 2
(S4 RefBot P_mis 0.501, S5 RefBot U−L), finance 3 (F7 revenue and valuation, F11 path), worldfx 5 (F7/F11 revenue, A2a hours,
W4 firm adoption, W2 TFP), ws4 1 (T3 band). These are the model-v3 work in progress, not T0.

#### 6. After: timings

Same machine, other agents still running (load 75–99%).

| run | wall | CPU | load |
|---|---:|---:|---:|
| before: the old chain, one script at a time (all 32 commands) | 47.1 min | 43 min | 46–100% |
| `test:full`, cold (after a code change; `SIMCACHE=refresh`) | **17.7 min** | 66.8 min | 87% |
| `test:full`, warm (same code again) | **6.6 min** | 16.3 min | 88% |
| `test:quick`, cold (before finance got 2 quick shards) / warm | **4.0 min / 2.0 min** | 17.8 / 11.4 min | 99% / 90% |
| `test:cal`, cold / warm | **1.5 min / 6 s** | 4.6 / 0.3 min | 75% |
| `test:perf` | 0.5 min | | |

Cold full uses more CPU than the old chain because 6 workers on an already loaded machine slow each game down; its wall time is the critical path. Heavy scripts
(in a full run, each script's critical path: its longest shard + the script):

| script | before (alone) | full cold | full warm | quick (SMOKE) |
|---|---:|---:|---:|---:|
| safety | 991 s | 317 s (6 shards ≤ 295 s + 22 s) | 32 s | 95 s |
| calib | 276 s | 215 s (4 shards ≤ 209 s + 6 s); `cal` 90 s | 23 s; `cal` 6 s | 27 s |
| finance | 253 s | 260 s (3 shards ≤ 208 s + 52 s) | 85 s (the uncached F10/action runs) | 185 s |
| ws4 | 114 s | 287 s | 11 s | 86 s |
| worldfx | 82 s | 183 s | 25 s | 96 s |
| fixtures | 25 s | 47 s | 9 s | 42 s |
| golden-timelines | 38 s | 11 s | 10 s | 22 s |
| hygiene | 82 s (with perf) | 76 s (no perf) | 114 s | 101 s |
| idle (uncached) | 153 s | 308 s | 321 s | 170 s (1 seed) |
| test:ui | 314 s | 354 s (overlapped) | 399 s (overlapped) | – |

In a cold full run the single-script times rise because 6 of them share an already loaded machine. The tier is about
2.7× faster than the old chain. A warm rerun is about 7× faster and is bounded by test:ui and idle.

#### Files

- `scripts/v2/simcache.ts` (new): the cache, `pick`, `prefill`, pruning.
- `scripts/v2/run.ts` (new): the tiers, worker pool, shards and summary.
- `scripts/v2/lib.ts`: `SMOKE`, `smokeCheck`.
- `scripts/v2/calib.ts`, `golden-timelines.ts`, `fixtures.ts`, `safety.ts`, `finance.ts`, `worldfx.ts`, `ws4.ts`: their
  runs go through the cache, plus `--smoke`, `--prefill`, `--cal` (calib) and `--write` (fixtures, golden).
- `scripts/v2/hygiene.ts`: `--no-perf` / `--perf-only` (stream instrumentation installed first so perf measures under the
  same wrappers).
- `package.json`: `test:quick`, `test:cal`, `test:full`, `test:perf`; `test:v2` → `test:full`; `fixtures:v2` → `fixtures.ts --write`.
- `.gitignore`: `.simcache/`.
- `scripts/v2/fixtures/*.json`: regenerated at the current code.

### P3 notes (market mix once per day; 2026-11-20)

Branch `v3-p3` (from `v3-f1` at 422d383). No behaviour change, no state change, no schemaRev bump.

#### Does the mix run twice a day?

No, not any more. Counted computeMix calls by stack (passive seed 9, 400 days; RefBot seed 5 sampled, 300 days,
refPlay included): exactly one per tick (`applyRevenue`, revenue 60, through the per-tick memo `WS5:mix`; worldDaily,
actorsDaily, macro, techtree read the memo), plus one per quarter in `rivalFinanceQ` (geoQ 440). RefBot's decisions
compute none. A5's "twice a day: revenue and rival finance" was measured before P2, when rivalFinanceQ recomputed
the mix per rival without the memo; P2 made it one per quarterly loop. The geoQ mix is not redundant: between revenue
(60) and geoQ (440) rivalsChina, worldDaily, actorsDaily and the quarterly market change state the mix reads (models,
customer stocks, compute), so it stays. Nothing to memoise; the task became making the one daily mix cheaper.

#### What changed (identical values: same operations in the same order)

- `worldfx/choice.ts surplusChoice` (the hot spot, ~15% of a tick): the serving providers' tiers flattened into
  reused module-level scratch buffers (no typed-array allocation per call: allocating them cost more than the loop);
  the quality term SHARE_SLOPE_G·(fit − fitMax) and the cheapest price hoisted out of the band loop; `on(i)` a
  precomputed array, not a closure; adequacy inline; shares accumulated per band in a flat buffer then written to
  `share[i][b]` (the same `0 + Σ f·e` in set order, then `/ tot`); packed arrays instead of `new Array(n).fill`.
- `choiceSets`: loops instead of `forEach` with a closure; the partial-provider signature compared as a list instead of
  a built string.
- `worldfx/mix.ts computeMix`: the lineups (value-capped prices), the tier prices for `tiers.price` and the best fit for
  the mini utility in one loop without per-call closures (`cap` and two `map` callbacks), the mini/main utility inline
  (no object spreads per band).
- `worldfx/serving.ts studentOffer`: the gap memo also holds what follows from the gap alone (coverage, size ratio,
  leverage: pure in the same keys and world), so a hit skips studentCover / studentParamsFor / agentLeverage.

#### Proof

- State hashes (`.p3tmp/hash.ts`, copied from P2: stable-key JSON SHA-256 every 50 days; passive seed 9 to ousted day
  731; passive seed 9 leader lab, endings skipped, 1500 days; RefBot seed 3 authors2026 3 rivals with the compute stub,
  600 days; RefBot seed 5 sampled with real finance, 600 days): identical to the base after every step (5 steps).
- Fixtures: `fixtures.ts` from the base (git archive of 422d383) and from P3 write byte-identical files (the
  committed ones are older and get rewritten either way; restored).

#### Numbers (machine heavily loaded: absolute numbers ~5× P2's and swinging 2× between runs)

- World mix alone, base and P3 interleaved in one process on the same states (`.p3tmp/bench.ts`, 300 reps each):
  passive d100 6207 → 4397 µs, d400 7318 → 4054, d700 8303 → 4940; leader lab d300 7944 → 4902, d900 8748 → 5557;
  RefBot d300 7952 → 4956, d900 9541 → 5264: −29 to −45%, ≈ −38%.
- Profiler (`scripts/v2/profile.ts 1000`, 2 alternating rounds): hygiene seed 9 revenue 6843 → 3448 µs/day, daily
  10434 → 6319; leader lab revenue 6136 → 3961, daily 11920 → 9061. Every other system moved −10…−35% too (load), so
  only the revenue share is meaningful: 66% → 55% of the day (seed 9), 51% → 44% (leader lab). The RefBot case
  was swamped by load in round 2 (revenue +4%).
- Hygiene perf (alternating base / P3, 2 rounds): daily average 17829 / 6813 → 7636 / 7625 µs, leader lab
  27320 / 23147 → 16821 / 12696 µs; all four perf checks fail on both under this load (thresholds 1.5 ms); the
  leader-lab own-cost check +4.1% / +27.5% → +18.8% / −3.2%. Not comparable to P2's numbers; re-measure on a quiet
  machine.

#### Remaining hot spots (bench profile of the mix)

- surplusChoice ≈ 14% of the mix work: the utility per tier per band (a division by μ_b), `Math.exp` per provider per
  band and the choice-set sum (64 sets × 8 bands where six providers have partial access). Identical values need the
  same per-set sums in order, so the next step is only algorithmic (fewer sets) and would change values in the last
  bits.
- computeMix's region × sector loop body (~10% self): eight per-provider arrays, the tier-weight loop, the K term's
  `Math.pow`, stockShares, the SectorMix literal.
- Per-sector offers: studentOffer (memo lookups through four nested maps), offerOf / useFit for the player's products
  (recomputed daily: they have builds).

### D9 notes (P10, P12, P21 as typed data and suite effects; 2026-11-20)

Code: `src/data/v2/tree.ts` (`ProjectEffect.data` / `.expert`; P10 axis, P12 and P21 ideas), `src/data/v2/dataAssets.ts`
(`P10_SYN_Q_RAISE`, `P21_WORTH_OOM`), `src/data/v2/suites.ts` (`P12_DEMO_T`), `src/data/v2/paradigms.ts` (effect texts;
`PARADIGM_DOMAIN_OFF` removed), `src/engine/v2/models/research.ts` (`completeAdoption` data/expert branch,
`hasTypedEffect`), `models/suites.ts` (`addSuiteExpertData`), `production/data.ts` (`synQualityCap`, `tokenWorth`, draw
option `worth`, `DataDraw.worth`, quality of new tokens), `models/runs.ts` (P12 horizon multiplier and paradigm offsets
removed), `models/paradigms.ts` (`paradigmOff` removed), `models/researchView.ts` (unit), `core/save.ts` (24),
`types.ts` (`ResearchState.dataFx`). Glossary `synJob`. TECH-TREE §6.4 rows (also Science data / Native multimodal,
done by D3, marked "now (D3)"). Tests: `scripts/v2/data.ts`, `suites.ts`, `research.ts`.

**What changed.** P10, P12 and P21 were tree nodes on the old v2 path (no `kind`, effects read by `adopted()` flags).
They are now capability projects (ideation → experiments → result → adoption) with a hidden per-world effect x
(1 = as designed) that enters a typed effect at adoption, floored at 0 [D: an adopted method is never worse than the
pipeline it replaces]. New typed effect kinds (MODEL-V3 §5.2 "Data efficiency"): `data.synQMax`, `data.worthOom`
(stored as `ResearchState.dataFx`) and `expert` (expert data delivered into a family's suite).

| idea | new effect (unit) | as designed | prior | source |
|---|---|---|---|---|
| P10 Synthetic data flywheel (axis; still unlocks the synthetic-heavy mix) | synthetic-quality ceiling +0.5·x (q, web = 1) for data generated after adoption | ceiling 1 → 1.5 (q 1 at V0 + 2 OOM, 1.5 at + 4 OOM) | paradigm 0.8, effect sd 30% | Maini et al. 2024 "Rephrasing the Web" (arXiv 2401.16380, fetched): real + synthetic rephrases ≈ 3× faster pretraining on C4; phi-4 (arXiv 2412.08905, fetched): mostly synthetic curriculum beats its teacher on STEM QA; research/20 A3's synthetic top q 1.5 (math/code). Size [D]: WRAP's 3× is against raw C4, and the game's web q 1 is the filtered crawl, so the headroom over q 1 is research/20's 1.5 |
| P12 Long-horizon human demos (idea) | x · 0.02T expert tokens into `expert:longHorizon`, paid at the expert price ($50B/T) on delivery | +0.02T = 10 × E₀, $1B, fidelity 1 → 1.349 | 0.85, sd 25% | v2's $1B budget (research/12 #12 "$1B+"; AI 2027 "billions ... to record themselves") at D5's one expert price; units [D] ≈ 200k recorded expert-days |
| P21 Brain-like sample efficiency (idea) | worth of a drawn token in the loss law ×10^(0.3·x): D_eff and D_qual × worth (same draw, same epochs) | ×2 | 0.45, sd 60% (wide) | research/12 #21 (AI 2027: Agent-3 ~4,000× less compute-efficient than the brain); a child hears ≈ 10⁸ words by 13 (BabyLM [R]) vs ≈ 10¹³⁺ tokens; size [D, speculative] |

Why the ceiling for P10 (not yield): D11 capped synthetic quality at the web's "until sourced", and the flywheel's claim
in the sources is quality (rephrased/curated text worth more per token), not cheaper generation; the overgeneration
4.33× already sits inside research/20's 2–5×. Data generated after adoption carries the new quality: a teacher's asset
takes the token-weighted mean of old and new tokens [D] (bit-identical while the quality does not change).

What P21 means physically: the learner extracts more from each token (the gap to human sample efficiency), so every
token in every slice teaches ×worth; repetition still follows each slice's own epochs. It is general, not PHYS: the
"robotics transfer" story goes through the multimodal mix and P22. Rare by its paradigm prior (0.45, behind P08 and
P19, XL effort) and uncertain by the wide sd.

**Removed flags.** P10: synthetic ×3 in U and the draw (`P10_SYN_MULT`, `portfolioU`/`drawData` option `p10`), "no
repetition penalty" / "no data wall" (`noRepeat`); P12: `P12_HORIZON` ×2 in `postBuild`, RSCH +0.4 L, the $1B
`cashCost` at project start (now the price of the delivered data); P21: PHYS +1 L. `PARADIGM_DOMAIN_OFF` and
`paradigmOff` are gone (they held only P12/P21), so no version gets paradigm level offsets any more. The paradigm
texts and node cards describe the new effects. Lint in `research.ts`.

**Effect sizes (tests, seed 2027 start; x is the realised effect of the test's candidate)**
- P10 (x 1.30 → ceiling 1.65): q at V0 + 1/2/3/4 OOM = 0.75 / 1.00 / 1.25 / 1.50. 100T from a V0 + 3 OOM teacher
  in a 100T B0-size base: quality term +0.0026 → +0.0191 OOM. U does not move at adoption.
- P12 (x 1.69 → 33.7B tokens, $1.69B, fidelity 1.38): broad post-train on B0: long-tasks gain 0.533 → 0.737 OOM, AGENCY
  +0.165 OOM (horizon ×1.27), G +0.04; long-tasks focus: AGENCY +0.339 (horizon ×1.63), G +0.15, RSCH +0.12 via
  transfer. At x = 1 (fidelity 1.35) somewhat less. The old flat ×2 horizon (= 0.48 OOM AGENCY) + RSCH +0.4 L was larger;
  the new effect is bounded by the suite's fidelity cap 1.5 and diminishing returns. Hardening and upkeep of that suite
  scale √(E/E₀): ×3.3 after P12 [D5's rule, reported].
- P21 (x 0.86 → ×1.81): B0-size base +0.234 / +0.191 / +0.134 OOM at 20 / 50 / 200 tokens per parameter (worth most at
  few tokens per parameter, where the data term of the loss is largest). At x = 1: ≈ +0.22 OOM at 50.

**Teacher re-check (D2's finding under the final rules; day-400 fixture, 30 days of the whole pool per teacher, the lab's
latest base design; `data.ts` "D9 teacher re-check").**
- Day 400 (every teacher q ≤ 0.75, below the web's cap): ranking by G as D11 found — the strongest teacher pays (V31 q 0.75
  +0.0009 OOM; V0 q 0.50 −0.0066; V30, best by q·T, −0.0030). P10 changes nothing there (identical numbers).
- The same teachers 2.5 OOM stronger (same FLOP per token), no P10: every q is 1 (the cap), so tokens per H100e-day decide
  and **D2's finding returns**: the smallest teacher wins (V15, a mini: +0.0118 vs V31 +0.0036).
- With P10: quality keeps ranking (q 1.13–1.38) and the best is a mid-size strong teacher (V30 q 1.25 +0.0176; V31 q 1.38
  +0.0092; V0 +0.0052): the best teacher maximises q(G)/fpt again, now with q rising to 1.5.

**Calibration.** RefBot (and the race/mixed/safe bots) never research P10, P12 or P21. The one change on its path is the
quality of new synthetic tokens: a teacher whose G rises after its asset began (RefBot's continual-learning stream, P08)
now writes its current quality into the asset (token-weighted mean); before D9 the asset kept its first day's quality.
That moves ai2027 late by days (confirmed with the blend switched off: SIAR 2027.910 → 2027.905, ASI 2028.000 →
2027.999); the other presets are identical. No refit.

calib T1 (stub, Δ vs golden in years, D11 with the cap → D9; **bold** = outside tolerance, unchanged by D9):
| preset | SC | SAR | SIAR | ASI |
|---|---|---|---|---|
| ai2027 | +0.019 → +0.019 | +0.041 → +0.041 | −0.005 → −0.011 | −0.003 → −0.005 |
| authors2026 | +0.030 → +0.030 | +0.047 → +0.047 | **+0.173 → +0.173** | **+0.315 → +0.315** |
| fast | **+0.093 → +0.093** | **+0.189 → +0.189** | +0.074 → +0.074 | −0.003 → −0.003 |
| slow | **−0.277 → −0.277** | | | |
T1L (leader lab) all pass, T2, T4, R5 pass; the five T1 failures are D11's (for the M3 refit).

**Save.** schemaRev 23 → 24 (lead renumbers at merge): `ResearchState.dataFx` (optional). Migration 23 → 24: a lab that
had adopted P10 / P21 under the old flags gets the designed effect (x = 1: ceiling +0.5, worth +0.3 OOM); one that had
adopted P12 gets its 0.02T of demonstrations in `expert:longHorizon` (it paid $1B then; its old versions keep their
frozen ×2 horizon). A save with one of them *in progress* on the old path restarts it as a capability project (its old
`progress` is not carried over) [D]. Tested (suites.ts); no fixture has any of the three adopted.

**For later tasks**
- D4: `gPre.quality` (the Blueprint's "Data quality" row) now also carries P21's token worth; `planRun(...).limits.draw.worth`
  separates it (quality alone = `qRel`). A "Data efficiency" row may split it out. `synQualityCap(s)` is the teacher
  picker's ceiling; `synAssetFor(s, t).quality` uses it.
- D6: P12's delivery logs fidelity before → after; the suites view shows the long-tasks suite's larger expert stock.
- P12's cash is booked at adoption even if the lab is short of cash (like other adoption-time costs, no gate) [D].

**Gate (2026-11-20, machine loaded by parallel agents).** tsc main + scripts clean; data, suites, effective, research,
worktypes, serving, golden-timelines, identity, products, fixtures, lint-ux / -structure / -tradeoffs / -hidden / -tips
pass; calib: the 5 T1 failures above (D11's, unchanged); hygiene: only the 4 performance checks (15–25 ms ticks under a
load of ~29 node processes; known failure). Note: `fixtures.ts` rewrites the fixture files; they were restored (they
stay at schemaRev 16 and migrate on load).

### D10 notes (serving-efficiency ideas and tokens per task; 2026-11-20)

Branch `v3-d10` (from `v3-p3`). Code: `models/stacks.ts` (serveSplit, decodeUtilOf, serveFlopOomOf, rlGOfBuild),
`models/runs.ts` (serveTechMult = the FLOP part), `worldfx/serving.ts` (h100eHoursPer with utilisation, tokEff, offers per
use), `worldfx/mix.ts` and `worldfx/revenue.ts` (providers' utilisation, rivals' FLOP part, chat on τ), `worldfx/choice.ts`
(underflow guard), `departments/workfit.ts` (agentFptEq, agentFpt for internal agents), `actors/rivalModel.ts`
(RivalPhys.serve, serveRate, rivalServeFpt, rivalDecodeU, rivalAgentFpt, SimpleModel.rlG), `production/production.ts`
(rivals' serving stack grows daily), data `workTypes.ts` (U_DECODE_MAX, SERVE_FLOP_MAX, TOK_PER_RL_OOM, TOK_MIN),
`rivalModel.ts` (SERVE_RATE0), `research.ts` (DEFAULT_LINES + L.infer), `tree.ts` texts, UI Models serving tooltip.
Tests: `scripts/v2/serving.ts` A3 rewritten (per-task decomposition) and new V1–V4; hygiene 25 → 26 migration check.
**schemaRev 25 → 26** (RivalPhys.serve, SimpleModel.rlG; migration: serving stacks 0, rlG from the current base).

#### Mechanism 1: the serving stack by mechanism (R20 D1)

- Stack value e (OOM, the Inference-efficiency line + P16's share). Its first log₁₀(0.15/0.07) = 0.331 OOM raise the
  lab's **decode utilisation** 0.07 → 0.15 (top of R20 D1's measured 0.03–0.15; speculative decoding, batching,
  disaggregated prefill/decode, kernels), applied when serving to every model the lab serves (products, chat, internal
  agents). Beyond it, a compute-equivalent cut of **FLOP per token** of versions trained after it, 10^−(e − 0.331), capped
  at SERVE_FLOP_MAX = 1 OOM [D: FP8 → FP4 0.3 OOM, plus sparsity/kernels]. [D] utilisation first: R20 D1 names it as where
  inference know-how goes and it is bandwidth-capped. Before D10 the whole stack cut FLOP per token at creation; old saves
  only change for versions made after the update (P16 games).
- Returns: the existing line pool, rShare 0.15 × the world's r (unchanged).
- **RefBot ranks it: weight 0.1** in DEFAULT_LINES (= RefBot's lines and every start's list) [D: an inference team ≈ a
  tenth of research teams; at RefBot's 7–9 line teams this is the one-team minimum].
- Reference run (RefBot, classic, ai2027, seed 2027): 0 → 0.062 OOM in the first year, 0.207 OOM by 2027.08 (10 ideas
  adopted), decode utilisation 0.070 → 0.113; 0.39 by day 700 (cap 0.15), 1.63 by day 900.
- **Rivals** (F1 has no serving field → RivalPhys.serve): de_s/dt = SERVE_RATE0 · rs · 10^(−e_s / (0.15·r)), the recipe
  law with the line's returns, from the same research speed rs. SERVE_RATE0 = 0.2 OOM/yr [fit: rivals' mean 0.200 vs
  RefBot's 0.207 OOM at 2027.08]. Applied at serve time to all their models (utilisation and the FLOP part: no
  blueprint) [D], and to their internal agents (rivalAgentFpt). Open weights are served at the releasing lab's stack [D].

#### Mechanism 2: reasoning tokens for the same answer fall with the RL recipe (R20 D2, R12 §5)

- τ(model) = max(0.1, 10^(−1 × its RL recipe's G-equivalent)), on **output (reasoning) tokens** of every profile
  (adopted, assisted/seat, autonomous/agent, chat paid and free, internal agents); effort multiplies τ-scaled output, its
  fit gain unchanged. RL G-equivalent = refRlGain(flopPre, eRL, aRL) − refRlGain(flopPre, 0, 0) of the version's build
  (students inherit the teacher's); rivals: rlG = G − G_pre − reference RL gain on their base (stored on SimpleModel).
  A recipe at or below day 0 keeps τ = 1, so day 0 is unchanged.
- Rate: FrontierMath −0.93 OOM output tokens at a similar score (43M → 5M, Apr → Dec 2025) while the frontier rose
  +0.95 G (R12 §0.2 anchors o3 27.5 → GPT-5.2 ≈ 28.45), mostly RL post-training ⇒ **1.0 OOM fewer reasoning tokens per
  OOM of RL-stack effective compute** [D]; only the RL stack's part shortens reasoning (pretraining/scale do not). Floor
  TOK_MIN 0.1 [D: the answer stays]. Not per calendar: test V3 (same version, 200 days later: same τ).
- Caveat [D]: the FrontierMath fall also contains capability spent as lower effort; crediting only RL's G keeps the
  game's fall far below FrontierMath's ×25/yr (reference run: τ 1 → 0.67 over 1.5 y).

#### Decomposition (A3, re-run; RefBot ai2027 seed 2027, 2025.58 → 2027.08, × per year)

| Factor | A3 (F1 branch) | D10 |
|---|---|---|
| active parameters | ×10.59 | ×10.53 |
| FLOP / parameter (shape, serving FLOP part) | ×1.00 | ×1.00 (stack below 0.33) |
| serving stack (decode utilisation 0.070 → 0.113) | ×1.00 | ×1.15 |
| tokens per task (τ 1 → 0.672, H100e-time) | ×1.00 | ×1.09 |
| rental | ×1.41 | ×1.40 |
| margin | ×1.00 | ×1.00 |
| **per task** | ×14.91 | **×18.55** (exact product) |
| per M tokens | ×14.91 | ×17.87 (token count per task ×1.04/yr) |

Both in ×6–×30, middle-upper (R20 D3 central ×10). **Price customers pay (A5 E9): ×9.47 → ×11.52/yr** (hardware ×1.40,
margin ×1.12, models bought ×7.37; own models only ×1.01 → ×1.23).

#### Calib T1 (seed 2027; Δ years, before = F1/P3 → after)

| Preset | SC | SAR | SIAR | ASI |
|---|---|---|---|---|
| ai2027 | 0.000 → −0.005 | +0.022 → +0.025 | −0.041 → −0.041 | −0.030 → −0.038 |
| authors2026 | +0.008 → +0.030 | +0.022 → +0.085 | +0.052 → **−0.145** | +0.033 → **−0.268** |
| fast | −0.003 → +0.079 | +0.096 → **+0.175** | −0.019 → +0.060 | −0.096 → −0.019 |
| slow | −0.079 → +0.049 | | | |

Out of tolerance (no refit, per brief; all under 0.3 y): authors2026 SIAR (±44 d), ASI; fast SAR. Cause: the one
inference team comes out of RefBot's 8 capability teams (fast SC/SAR +0.08: G lines slower), and cheaper serving makes
post-SC AI labour cheaper. authors2026's late milestones are chaotic: with internal agents ignoring utilisation ASI went
to −0.77; seeds 11/12/13 with vs without the line: SC −0.008/0/+0.035, ASI −0.31/−0.69/−0.03 (seed spread itself ±1–2.6
y). Without L.infer in RefBot's list T1 is ≈ the baseline. First calib run gave authors2026 ASI −0.340; the final run
(after the FLOP cap and choice guard) −0.268. T1L fails as known since F1.

#### Bug found

- `worldfx/choice.ts`: at day 900 (fixture run) a choice set with every member far below the band's best gave denormal
  weights, p ÷ Σ = Infinity and NaN customer stocks (r2, ENGY). Guard: when 0 < Σ < 1e-250, renormalise on the set's own
  best utility (common path bit-identical). Cheaper serving made μ_b tiny enough to hit it.
- Without SERVE_FLOP_MAX the takeoff serving stack (tens of OOM for rivals at high rs) would drive costs to 0.

#### Gate (lead's reduced test policy mid-task)

- tsc main + scripts clean. serving 83 pass / 0 fail (new V1–V4, A3 rewritten, C6 uses provider τ/ud); research 28/0;
  calib T1 above. Before the policy change also ran: golden-timelines 15/0, identity 76/0, effective 27/0, worktypes
  16/0, products 58/0, rivals 13/0; worldfx (report) the F1 set: F7/F11 2026 $31.8B (was $33.8B), F11 2027 $57.0B (was
  $53.6B), GOV T1 2027-09-05, A2a 6.7%, W4 22.9%, W2 0.4%; U +1 pp and equity pass; hygiene: only the four known perf
  checks + leader-lab cost under load (the new 25 → 26 migration check passed). fixtures: the day-900 NaN above (fixed
  after; the fixture files were restored, not regenerated; re-run fixtures in the merge).

#### Open

- Tokens-a-day readouts (readouts.ts workBilling, sector view) still count 2025 profiles (τ not applied: a ≈ 4%/yr count
  effect in the window).
- Blueprint's planned-run cost per hour shows τ = 1 (the planned version's τ is not predicted).
- T1 refit (fast SAR, authors2026 SIAR/ASI) belongs to the merge.

### F2 notes (rivals' recipe in three parts, China's lead band; 2026-11-20)

Branch `v3-f2` (from `v3-f1` at 422d383). Code: `models/capability.ts` (trueLeadDays before the level history reaches
back), `actors/rivalModel.ts` (initRivalPhys: a follower's start staleness at its own rate), `actors/rivals.ts` and
`actors/china.ts` (pass the run-time efficiency to it), `worldfx/choice.ts` (an overflow guard, §2), `data/v2/
calibration.ts` (LEADER_CAL authors2026). Test `scripts/v2/rivals.ts` R8, R9 and an opt-in INFO
(`npx tsx scripts/v2/rivals.ts --ref`). Part A below (sections 1–4) is the first run; part B (the lead's decisions:
the split recipe, the T3 measure, M3's choice.ts) supersedes its numbers. **schemaRev 25 → 26** (part B).

#### 1. Aggregate idea channel: stopped (stop rule), the premise does not hold

F1's reading was that RefBot's research lines carry only 3.8 of the 5.9 OOM its stacks gain over days 600–860 (ai2027,
stub, seed 2027) and that one-off ideas and paradigms carry the rest. Measured on the same run (`.f2tmp/diag1–3.ts`,
not committed):

- **RefBot's ideas add nothing to its stacks.** Its tree goals are P07, P05, P08, rl.mlResearch, P13, P17, P19: none has a
  stack effect (the stack ideas are Elastic training and P16, which it never researches; P24 is not a goal; it does not
  run Recurrent architectures). Every OOM of its stacks comes from the five lines.
- **The 3.8 is the lines' test-scale effect.** A line's pool advances by the result's true effect at the scale test
  (0.2% of the latest base: research.ts resolveStage, R ← R·10^(x_test/r_l)), but the stack adds it at the base's FLOP:
  x_test·(F/F_test)^s = x_test·500^s. Per line over days 600–860, realised (adoption records) ÷ test-scale (pool):
  Scaling recipes 1.94 / 1.31 (×1.48), Data 1.05 / 0.84 (×1.24), Optimizer 2.13 / 0.80 (×2.67, 19 adoptions), RL
  algorithms and Environments ×1.00 (s = 0). Days 0–600: ×1.57 / ×1.15 / ×1.18 / 1 / 1.
- **Derivation of the factor.** Every line candidate is a single idea in these runs (X < PACE_BATCH = 30 to ASI), it
  survives the scale test iff 1000^s ≥ SURVIVE_FRAC (s ≥ −0.10), its test-scale effect is ∝ 1000^s and its realised one
  ∝ 1000^s·500^s, so κ_l = E[1000^s·500^s; s ≥ s*] / E[1000^s; s ≥ s*] on the line's clamped scale prior
  (`.f2tmp/kappa.ts`): Scaling 1.507, Data 1.175, Optimizer 2.099, RL lines 1. rShare-weighted κ = 1.46 (pretraining
  lines only 1.58). This matches the measured ratios (Optimizer's 2.67 is 19 draws of a wide prior).
- **Consequence:** in G units each line's returns are κ_l·r_l, not r_l. The rivals' law de/dt = 0.6·rs·10^(−e/r) has
  returns r in G units, so a rival's recipe "gets harder" ×10^(1/r) = ×1.78 per OOM at r = 4 where RefBot's gets
  ×10^(1/(κr)) ≈ ×1.48: with taste rising ×1.71 per OOM of G, the aggregate is balanced (F1's 12–14 OOM/yr plateau)
  and RefBot explodes (25–40 OOM/yr).
- **Reference match:** the rivals' law evaluated at RefBot's own inputs (its internal model's G and FLOP per token, its
  staff, its research compute, best mix) and RefBot's own recipe integrates to **+2.93 OOM** over days 600–860 vs
  RefBot's **+5.89** (rivals.ts `--ref`). The aggregate research speed itself is not short: at RefBot's inputs rs is
  above RefBot's own M (911 vs 127 on day 860). With the returns at κ·r (κ = 1.46, the realised start rate unchanged)
  the same integral is +5.77 (98%).

Scratch experiment (env-var switch in recipeRate, reverted; `.f2tmp/t1l.ts`), T1L on seed 2027:

| κ in the rivals' returns | LEADER_CAL | SC / SAR / SIAR / ASI Δ (y) |
|---|---|---|
| 1 (F1) | −0.048 | +0.014 / +0.216 / +0.310 / +0.427 (ai2027) |
| 1.463 | −0.048 / −0.08 | −0.101 / +0.044 / −0.016 / −0.027; −0.025 / +0.121 / +0.060 / +0.049 (ai2027) |
| 1.26 | −0.048 | −0.063 / +0.101 / +0.079 / +0.088 (ai2027: passes) |
| 1 (F1) | 0.242 | −0.007 / +0.43 / +2.5 / +5.6 (authors2026) |
| 1.463 | 0.1 | +0.000 / +0.121 / **−0.400 / −1.060** (authors2026) |
| 1.26 | 0.15 | +0.025 / +0.241 / **+0.405 / +1.019** (authors2026) |

The milestones themselves agree: on authors2026 the leader's G at SC/SAR/SIAR/ASI (33.66 / 35.64 / 44.77 / 50.76) is
RefBot's (33.64 / 35.60 / 44.80 / 50.67), so the gap is the recipe path, not the λ map. authors2026's long SIAR → ASI
needs the shape of RefBot's late takeoff, where its RL stacks saturate in G (the RL curve; RefBot moves its RL-algorithm
teams off at 95% of the ceiling) and only the pretraining lines (κ 1.26 in G of the whole) keep growing; the rivals'
RL share is linear in e (RL_SHARE·e). One scalar κ in [1.26, 1.46] would have to be fitted per preset to ±0.01 for
authors2026's ASI, which is a fudge.

**Stop:** T1L can pass only with something other than LEADER_CAL plus an idea channel (the idea channel cannot supply
growth RefBot does not get from ideas). Proposed follow-up (lead decision): rivals' recipe in two parts like the
player's stacks — a pretraining part with returns κ_pre·r_pre (κ from the line priors as above, no fitting) and an RL
part on the reference RL curve (rlMid/rlCeil-like, saturating) — then refit LEADER_CAL; check authors2026 first. An idea
channel for rivals (P17's latent base, P24, P16, P13/P05 speed effects) is a separate symmetry question; RefBot's T1
calibration does not need it, and the aggregate's rs is already above RefBot's M in the takeoff.

LEADER_CAL: ai2027 −0.048, fast 0.068, slow 1.155 unchanged; **authors2026 0.242 → 0.28** (the SC root again, F1's rule:
§2's follower start states moved the leader's SC 1491 → 1535 at 0.242 through the shared world; SC 1498 at 0.28).

#### 2. China's lead band (ws4 T3)

- **Fallback [fixed].** Before the leader's level history reaches back to the follower's level, trueLeadDays divided
  the gap by the leader's current research `rate` (the BRIDGE(V7) stack-growth readout of a few weeks: 0.1 OOM/yr on day
  30), giving 391–451 d in days 30–60. Now the leader's frontier line before its first sample is the pre-game frontier at
  the start's reference rate (referenceRate at the start model, 2025.5 — the rate every start gap was drawn at), so the
  lead = days since the first sample + the first sample's gap at that rate. Start lead 184 → 196 d (ai2027: 0.6 y ÷
  1.125); days 30/60 225/255 instead of 391/450. T4 now reads the drawn gaps exactly at day 0 (fixture 3.3, 4.6, 4.3,
  5.0 months; 200 seeds 100% in 3–9, was 98%).
- **Start state [fixed, D].** F1 made every lab's start base stale by RECIPE_RATE0 (the leader's 0.6 OOM/yr) over the
  256 days since B0's launch. A follower grows at its own rate (DeepCent ≈ 0.36–0.43 OOM/yr at day 0, upstarts 0.2), so
  its start base embodied too little of its recipe and the solved e₀ was too high: its first new base then jumped above
  V0 (seed 1: day 75, G 28.02 vs V0 27.97 → −103 d until the player's first base). initRivalPhys now solves e₀ with
  the lab's own day-0 recipe rate (aggregate research at its start inputs, best mix, its efficiency incl. effLab for
  China; four fixed-point steps with 10^(−e/r)); the leader lab keeps RECIPE_RATE0 (it is B0 itself, e₀ = the leader's
  day-0 recipe). Start models unchanged (T4 draw). DeepCent's e₀ −0.45 → −0.55 (seed 1). Test R8.
- **Result (8 seeds, days 30–540):** start 196 d (pass), mean 187 d (pass), post-theft 61 × 8 (pass), R10 formula
  pass; **band −50–375 (fail; F1 −103–450).** Remaining causes, both outside the start state:
  - *Top (330–375 d):* the staircase. DeepCent's bases come every 12 × U(0.8, 1.2) months (292–438 d) and its versions
    add only RL_SHARE of its recipe growth, while the metric reads the leader's corner line, so after each new base the
    lead restarts at ≈ 50–70 d and climbs a day a day until the next one. A band 200 d wide cannot hold a sawtooth whose
    period is the base interval (even an exact 195-d-shifted copy of the player's own staircase would read 195 to
    195 + 270 d).
  - *Bottom (−50 d, seeds 2, 5, 8):* the know-how writers. The distillation leak of the player's deployments (WS1
    distillationLeak, a pm-gap writer of `core.pa`) adds +0.21 OOM to DeepCent's recipe in its first 60 days and +0.39
    by day 180 (its own research +0.16), so a first base on days 120–180 lands a hair above V0 (level 5.12 vs 5.09)
    before the player's first base (≈ day 190), and a 0.03-level overtake reads as −50 d.
  - Options for the lead: compare the follower at its latest release (constant between releases), versions that carry
    more of the growth, or F3 replacing the pm-gap writers with recipe/weights channels.
- **Found on the way [fixed]:** with the new rival paths the day-900 fixture had NaN customer stocks (FIN, LEGAL, MEDIA
  on day 880): in `worldfx/choice.ts` surplusChoice a choice set without the band's best offer summed to a subnormal
  (every e ≈ exp(−700) when China's cheap tier sets μ ≈ 0.0007 $/h), so set.p / sum overflowed to Infinity and 0·∞ gave
  NaN. Now that case divides each term first; the normal path is unchanged (same arithmetic).

#### 3. Post-theft lag

61 d on all 8 seeds (F1's fix holds).

#### 4. Writers of rivals' `core.pa` (the F1 bridge pa = pa_ref + e/B), for F3

All still work through the bridge (each progress-year of pa moves e by B):
- `security/security.ts:85` distillationLeak of the player's deployments (every rival and China; pm gap × channel
  coefficient × distillation access): the largest, see §2;
- `security/security.ts:95` China's secrets leak (pa gap) + distillation of rivals' public models (pm gap);
- `actors/rivals.ts:457` openWeightsReleased: China absorbs half the pm gap (≤ 2 months);
- `actors/actions.ts:349` C6 Open weights: rivals absorb 30% of the pm gap; `actors/actions.ts:393` E1 Track-2
  dialogue: China +1 day of pace;
- `events/catalog/company.ts:33` E16 poaching "Let go": the rival +0.1 y of pace;
- `safety/findings.ts:371–373` safety spillover: every rival and China +0.02 pa (bump paths `rivals.i.core.pa`,
  `china.lab.core.pa`);
- `production/production.ts:392` the rivals' own research (the F1 law, not a bridge).

#### Calibration (seed 2027), Δ in years vs golden; before = F1, after = F2

| Check | Before (F1) | After (F2) |
|---|---|---|
| T1 RefBot ai2027 / authors2026 / fast / slow | as F1 | identical days (golden dates untouched) |
| T1L ai2027 SC/SAR/SIAR/ASI (LEADER_CAL −0.048) | +0.014 / +0.216 / +0.310 / +0.427 | +0.012 / **+0.259 / +0.336 / +0.455** |
| T1L authors2026 (0.242 → 0.28) | −0.007 / +0.43 / +2.5 / +5.6 | +0.008 / **+0.31 / +2.34 / +5.39** |
| T1L fast (0.068) | +0.049 / +0.088 / −0.016 / −0.082 | +0.051 / +0.088 / −0.016 / −0.082 (pass) |
| T1L slow SC (1.155) | −0.008 | −0.008 (pass) |
| ws4 T3 start lead | 184 d | 196 d (pass) |
| ws4 T3 mean lead d30–540 (8 seeds) | 192 d | 187 d (pass) |
| ws4 T3 band 75–275 d | −103–450 | **−50–375 (fail)** |
| ws4 T3 post-theft ≈ 60 d | 61 × 8 | 61 × 8 (pass) |
| ws4 T3 R10 gap formula ±2 mo | pass | pass (−0.66 … +0.27) |
| ws4 T4 fixture seed; 200 seeds | 3.1–4.7 mo; 98% in 3–9 | 3.3, 4.6, 4.3, 5.0 mo; 100% in 3–9 (pass) |

#### Gate

- tsc main + scripts clean; lint-hidden, lint-structure, lint-tradeoffs, lint-ux pass.
- Pass: rivals (R8, R9 new), golden-timelines, identity, serving, danger, research, worktypes, effective, fixtures
  (after the choice.ts guard; the regenerated fixture files were restored, not committed).
- ws4: only T3's band (above). calib: T1 all presets in tolerance; T1L ai2027 and authors2026 SAR/SIAR/ASI fail (§1).
- worldfx (report): the F1 list unchanged — F7/F11 2026 $33.8B, F11 2027 $53.2B (F1 $53.6B), GOV T1 2027-09-01 (F1
  09-03), A2a 6.7%, W4 23.0% (F1 22.9%), W2 0.4%; U +1 pp still passes.
- Not run: hygiene (perf known), test:ui (no UI values changed).

---

#### Part B (lead decisions on F2): the recipe in three parts, T3 as percentiles, M3's choice.ts

Code: `actors/rivalModel.ts` (recipeParts, lineScaleFactor, recipeRates, advanceRecipe, absorbKnowHow, syncRivalPa; the
start state; migrateRivalRecipe), `data/v2/rivalModel.ts` (PRE_RATE0 replaces RECIPE_RATE0 and RL_SHARE),
`production/production.ts` (rivalResearch), `security/theft.ts` (stolen base under China's RL recipe), `types.ts`
(RivalPhys.rec / pool / paSync), `core/save.ts` (**schemaRev 25 → 26**, migration 25 → 26), `data/v2/calibration.ts`
(LEADER_CAL, CHINA_CAL), `worldfx/choice.ts` (M3's text), tests `scripts/v2/rivals.ts`, `ws4.ts` T3, `hygiene.ts`
(save check 25 → 26; not run under the test policy).

#### B1. The recipe in three parts

- **Parts.** The player's stack parts at aggregate level: pretraining efficiency e_pre (OOM, realised at the run's
  FLOP), RL efficiency `mid` and RL ceiling `ceil` (the player's rlMid / rlCeil units). Each part p is one research pool
  with its reference lines' returns r_p = w_p·r, w_p = Σ rShare of the DEFAULT_LINES on that stack (pretraining 0.36 +
  0.22 + 0.22 = 0.8; RL algorithms 0.08; Environments 0.12): dS_p/dt = a_p·rs·10^(−S_p/r_p) at test scale.
- **κ_pre (derived, not fitted, not per preset).** lineScaleFactor: κ_l = E[1000^s·500^s; s ≥ s*] ÷ E[1000^s; s ≥ s*]
  over each line's clamped scale prior, s* = log₁₀ SURVIVE_FRAC / log₁₀ SMALL_TO_TEST (part A §1): Scaling recipes
  1.507, Data 1.175, Optimizer 2.100. κ_pre = rShare-weighted = (0.36·1.507 + 0.22·1.175 + 0.22·2.100)/0.8 = **1.579**;
  the RL lines (s ≡ 0) give κ = 1. e_pre gains κ_pre·dS_pre; the RL parts gain dS.
- **Start rates.** At the leader's day-0 inputs (rs = 1, fresh pools) the pretraining part realises PRE_RATE0 = 0.48
  OOM/yr (Ho et al., research/20 B1, F1's anchor), so a_pre = 0.48/κ_pre; every part's start progress is its rShare of
  the whole (rShare is by definition the line's share of start software progress): a_mid = a_pre·0.08/0.8 → 0.030
  OOM/yr, a_ceil → 0.046 OOM/yr [D].
- **G.** Base: G_pre(FLOP, E_START + e_pre at launch). Version: G_pre + refRlGain(base FLOP, mid, ceil), the player's
  reference RL run, which saturates in mid and is lifted by ceil. Continual learner: max(G_pre, G_pre at today's e_pre)
  + the RL gain at today's mid/ceil. Theft: China's stolen base keeps G − its own RL gain.
- **Know-how bridge.** core.pa = pa_ref + G-equivalent/B (e_pre + the RL gain at FLOP_RL_REF − the zero recipe's),
  written by the model (paSync). Whatever other writers add to core.pa (part A §4) enters e_pre each day as public
  knowledge (scale-invariant, outside the pool: the player's addKnowledge). BRIDGE(F3).
- **Start state.** A follower is k behind in e_pre and mid (the player's initialStacks lag) and k back on those pools
  (it has done less research, so its next ideas come easier, as F1's one-part law had it; with fresh pools DeepCent
  fell 247 d behind on average). Staleness at its own day-0 rates (part A §2), k solved with them (five fixed-point
  steps). The leader lab starts at k = 0 exactly (the zero of the recipe), B0's vintage solved so its version is V0
  (R5: e₀ 0.0000).
- **Reference match** (`rivals.ts --ref`): the law at RefBot's own inputs and research state (its lines' test-scale
  pools per part, its RL stacks, the RL gain at its latest base) over days 600–860: **+5.44 OOM vs RefBot's +5.89**
  (92%; part A's one-part law +2.93). The rest: RefBot's RL lines start faster than the rShare split (its 0.2 / 0.3
  teams on the RL lines: +0.15 / +0.12 over days 0–600 vs 0.030 / 0.046 a year here), and the stack's older ideas gain
  (F_new/F_test)^s when the base grows, which a constant κ does not carry.

#### B2. LEADER_CAL refit (`calib.ts --fit-leader`, per preset, seed 2027) and T1L

| Preset | LEADER_CAL before → after | T1L SC / SAR / SIAR / ASI Δ (y), before (part A) → after |
|---|---|---|
| ai2027 | −0.048 → −0.029 | +0.012 / +0.259 / +0.336 / +0.455 → **−0.044 / +0.088 / +0.041 / +0.036 (pass)** |
| authors2026 | 0.28 → 0.154 (SC root) | +0.008 / +0.31 / +2.34 / +5.39 → +0.000 / **+0.121 / −0.258 / −0.581 (fail)** |
| fast | 0.068 → 0.025 | +0.051 / +0.088 / −0.016 / −0.082 → +0.066 / +0.104 / +0.019 / −0.066 (pass) |
| slow (SC) | 1.155 → 0.557 | −0.008 → +0.011 (pass) |

The fit's worst-error refine for authors2026 reached 2.92 tolerances at best (0.104), so the SC root is kept (F1's
rule). **Stop (as instructed):** authors2026 still misses after the LEADER_CAL refit, now the other way: its SIAR and
ASI come 0.26 y and 0.58 y early (part A: 2.3 and 5.4 y late), SAR on the tolerance edge. No other value was added.
Likely causes, for the lead: the RL parts' start split (rShare) vs RefBot's team split, and the constant κ (RefBot's
pretraining ideas gain more as its bases grow through the long authors2026 takeoff); both are derivation choices, not
fits. T1 (RefBot) stays in tolerance on every preset (authors2026 ASI +0.036, was +0.055: the shared world).

#### B3. ws4 T3 measure

AI 2027's claim is a typical lag (DeepCent "about six months behind", research/10 §1.1), not a bound on every day. On
the physical rival model DeepCent's model frontier is a staircase: a new base every 12 × U(0.8, 1.2) months, versions
between them adding only the RL recipe's growth. The lead metric reads the leader's frontier line, so after each
DeepCent base the lead drops and then rises a day a day until the next base — a sawtooth whose amplitude is the base
interval (292–438 d), longer than the old band's 200 d. T3 now checks the mean (150–200 d, as before) and the 10th–90th
percentile of the **daily** lead over days 30–540 (8 seeds) within 75–275 d; min/max are INFO.

CHINA_CAL.effScale 1 → **1.5** (the existing T3-mean knob, F1's rule; a refit, not a new value): the three-part recipe
slowed DeepCent (its versions gain less between bases: the leaks now feed only e_pre, and the RL parts saturate);
daily mean 247 d at 1, 181 at 1.5, 161 at 2 (p10 −20 there).

Result: start 196 d (pass), **mean 181 d (pass)**, post-theft 61 × 8 (pass), R10 formula (pass), T4 (pass);
**p10 62 d, p90 309 d (fail)** (p25 104, median 182, p75 259; INFO min–max −64–375 d; 13.6% of days below 75 d, 19.3%
above 275 d). Both tails fail:
- *p10 62 d (bottom):* the distillation leak (part A §2): DeepCent's recipe gains about twice its own research in the
  first months, so a base can land near or above the player's current model before the player's next base. Left for F3
  as instructed.
- *p90 309 d (top):* the sawtooth itself. The 10th–90th percentile of a sawtooth of amplitude A is ≈ 0.8·A wide, so
  with A = 292–438 d it is ≈ 230–350 d wide, against a 200-d window. It passes only with shorter base cycles (or
  versions that carry more of the growth), not with any efficiency (×2 moves both tails down: p10 −20, p90 306).

#### B4. choice.ts

Took M3's text from c98f2ed verbatim (the same rule as mine: divide each term first when set.p / sum is not finite;
`Number.isFinite(f)` instead of `f < Infinity`), so the merge is clean.

#### B5. Tests run (lead's test policy)

- tsc main + scripts: clean.
- `rivals.ts` (and `--ref`): all pass. New/changed: R1 (ideas get harder on the pretraining pool, public knowledge does
  not), R5 (leader e₀ 0, start rates PRE_RATE0 and the RL shares, κ_l and κ_pre), R8 (start staleness at own rates),
  INFO reference match.
- `ws4.ts`: only T3's percentile check fails (above).
- `calib.ts`: T1 all presets in tolerance; T1L fails authors2026 SAR (+0.121, edge), SIAR, ASI only.
- Run before the test policy, on intermediate code (not the final state): golden-timelines, identity, danger,
  research, worktypes, effective passed; serving A5 E9 (price of V0's capability ×2.31/yr vs ×6–30) and hygiene's
  leader-start check failed on the fresh-pools variant. The leader check is fixed by the leader's k = 0 start (R5: e₀
  0); serving was not re-run: **re-check serving A5 E9 at the merge** (it reads the rivals' improving prices).
- Not run (policy): safety, finance, worldfx, hygiene, test:ui, bots, fixtures.

### E7 notes (research sabotage and steering: covert acts against the lab's work; 2026-11-20)

Branch `v3-e7` (= v3-e6 + a merge of v3-e4, both from `model-v3` at edaf6f8). Spec: MODEL-V3 §11.3 ("with automated
R&D: sandbagged safety work, steered capability research, backdoors, successor steering"), §11.4 (symptoms), §11.7.
Code: `src/data/v2/danger.ts` (new section `COVERT_ACTS`, `COVERT_ANCHOR`, `STEER_S4`), `src/engine/v2/safety/covert.ts`
(new), hooks in `safety/findings.ts` (F49), `safety/investigations.ts` (corruption), `safety/lineProjects.ts`
(sandbagging), `models/research.ts` (completeAdoption), `safety/traits.ts` (runPull, hidden S4), `safety/incidents.ts`
(`internalScale` with the safety fleet, `recordInternalIncident`, `internalOversight(…, aiShare)`, the daily roll),
previews in `departments/agentActions.ts` (Trusted to AI) and `safety/actions.ts` (Investigate). Test
`scripts/v2/sabotage.ts` (new, in `test:v2` after `oversight`). No saved state type changed (records are flags):
**schemaRev stays 25**.

#### Step 0 (the merge did not compile)

`successorOversight(s, v)` (E4) is now `internalOversight(s, v, 'SUCC').oversight` (E6's hook: AG07 containment at v's
OOM, monitors and tools on the capability gap, human review with v's gap above L 10, control deferral); its `r`
parameter went (internalOversight reads the AI share of R&D itself); `versionM` and the now-unused imports are gone.
E6's lint in `scripts/v2/oversight.ts` has no exception left (E4 removed `inheritFromFleet`). tsc main and scripts clean;
successor 11/11, oversight all pass. Commit e39c1b9.

#### One formula, five acts

Every act runs through E5's danger formula at the internal site and is judged against E6's internal oversight:

    attempts a = κ · D · C · O          D = x^1.5, x = clamp01(Σ w_t x_t)   C = σ((L_d − θ)/s)
    per item:  O = [(1 − α) + α·A·F] · share       (share = the AI-done share of that work item)
    per day:   O = N · [(1 − α) + α·A·F] · r       (E5's internal site: copies, the fleet's autonomy, r = AI share of R&D)
    oversight  = 1 − (1 − block)(1 − catch)        internalOversight(s, v, trait, aiShare): human review covers 1 − share

One uniform u decides an attempt: none (u ≥ a); blocked (no trace); caught (an internal incident on the act's largest
weighted trait, logged with what was caught; the act fails); uncaught (the consequence lands, hidden). Draws are hashes of
(seed, act, key) except in findings and investigations, which draw from the safety stream as E2 did, so no other named
stream moves. "Measured against the overseer": the catch term is E6's monitor rule on the capability gap between the acting
model and its monitor, and human review on the gap above expert humans; capability C is the act's own domain level.

| act | traits (w) | domain θ, s | α | per | opportunity (share / r) | κ | consequence when uncaught | when caught |
|---|---|---|---|---|---|---|---|---|
| SAFSAB sabotage of safety research | SAND 1, SCHEME 1, + U-mode sab (E2's sab) | RSCH 5, 1 | 1 | safety result, investigation | E2's A: Trusted to AI × SAF coverage × the line's Auto (stage-weighted); A of SAF_EXP for cases | 0.395 | FALSE finding (F49); corrupted case × (1 − tool verifiability) | incident (SAND/SCHEME); the result is discarded, the line re-runs |
| SAFSAB sandbagging (same act) | same | same | 1 | continuous | the safety agents' own labour | 0.395 | AI labour on lines × (1 − a·(1 − block)): slower lines | – |
| STEER steering capability research | SCHEME 0.6, POWER 0.2, PROXY 0.2 | RSCH 5, 1 | 1 | adopted capability result | each R&D model's r_k (E4's parts), its work type's horizon | 0.395 | the result's OOM join a hidden steered stock: +STEER_S4 = 0.5 S4 per OOM on the TRUE signals of later post-training runs (→ OBF, edge E15) | incident (SCHEME/POWER/PROXY) |
| SUCCSTEER successor steering | SUCC 1 | RSCH 5, 1 | 1 | completed run, per R&D model | r_k | 0.395 | E4's part ω_k → r_k (κ_succ 1, past oversight) | incident (SUCC); E4's pull as it was |
| BACKDOOR | SCHEME 0.5, POWER 0.5 | CYBER 9, 1 | 1 | day, per internal fleet | N · A·F · r | 3e-3 /day | hidden record (count, Σ severity) + `uncaughtInternal` | incident (SCHEME/POWER) |
| HIDCOMP hidden compute | POWER 0.7, SCHEME 0.3 | CODE 8, 1 | 1 | day, per internal fleet | N · A·F · r | 2e-3 /day | hidden record (count, Σ severity) + `uncaughtInternal` | incident (POWER/SCHEME) |

Severity = floor + span · C · A·F (SAFSAB, STEER 2 + 2; SUCCSTEER, BACKDOOR 3 + 2; HIDCOMP 2 + 2) [D], E5's stochastic
rounding. Daily-act block adds weight security (BACKDOOR 0.5, HIDCOMP 0.25 of WSL/5) as E5's escape-like acts.

**κ for per-item acts [C]: the MacDiarmid anchor.** MacDiarmid et al. 2025 [P] (research/20 F2, research/05 §1.5): after
learning to reward hack, the model attempted sabotage in 12% of Claude Code safety-research runs. Read as the upper
anchor: a fully misaligned start model (x = 1, RSCH 4.5) with all of the work and an 8-hour task (A·F = 0.8), before
oversight: κ = 0.12 ÷ (σ(−0.5) · 0.8) = 0.395 (test: 12.1%). θ = 5 [D]: the anchor model's capability is about half of the
full act (crude, visible attempts); at L 8 C = 0.95, so a fully misaligned 2027 model with all of the work attempts ≈ 32%
of items. The 2025 near-zero (research/05 §1.8, research/20 F: no spontaneous sabotage found in 2025 deployments) comes
from D (start SAND 0.05, SCHEME 0.05) and the AI share of the work, not from C. Daily acts use E5's κ scale (SCHEME 3e-3)
and E5's θ for escape-like acts (CYBER 9) [D].

**Unification with E2 (one mechanism).** E2's FALSE weight (A × sab in the type draw) and its investigation corruption (A ×
sab × (1 − verif)) are gone: both read SAFSAB's terms. The FALSE share is a·(1 − block)(1 − catch) (test: 3.1% measured vs
3.4%), the caught share a·(1 − block)·catch are internal incidents and lost results (5.0% vs 5.2%). With the convex D
(x^1.5) and the capability and oversight terms, false results are rarer than under E2 at mid dispositions: S6's setup (t 1,
sab 0.8) gives 3.1% FALSE; safetyresearch's case (t 1, SAND 0.8, work AI does 99%) 27.2% under E2 → 3.3%. The previews (Trusted to AI, Investigate) now show the
same formula on beliefs (believed SAND + SCHEME, measured level, no oversight term: `believedSabotage`).

**Opportunity of safety-work sabotage (M2 merge note).** SAF_EXP's AI share is the opportunity of SAFSAB (E2's A per
line, A of SAF_EXP for cases, human review over 1 − A); `aiRdShare` keeps SWE/EXP/IDEAS for capability R&D acts (adding
SAF_EXP to it would move r < 0.01, M2's probe). `internalScale` now counts the safety fleet's copies (N for E5's internal
acts and the daily covert acts); RefBot runs no safety fleet, so its rates are unchanged.

#### Why steering adds hidden CoT pressure instead of costing capability [D]

First version: a steered result delivered (1 − loss) of its true effect (lab's estimate unchanged; symptom = realised below
the believed band). On calib T1 the effect is a knife edge: RefBot's authors2026 SIAR / ASI moved from 2143 / 2979 (base)
to 2275 / 3131 at loss 0.5 (steered share 3.8%; ASI 0.31 y beyond tolerance: the stop rule) and to 2103 / 2912 at loss 0.3
with SCHEME-heavier weights (earlier, −67 d: chaotic, F4's single-seed fragility); with the loss at 0 every milestone is
identical to the base. The brief's other reading fits AI 2027 better (the misaligned fleet does not slow capabilities; it
steers the lab toward its own ends): a steered result keeps its full capability, its estimate and the lab's predicted
signals, and adds hidden CoT pressure (S4, latent / less legible reasoning) to every later post-training run's TRUE
signals (STEER_S4 = 0.5 per steered OOM, S4 clamped to 1). E15 (S4 → OBF, Baker 2025) turns it into obfuscation, so CoT
monitors and tools weaken with no CoT choice to explain it (the symptom). The hidden steered share (steered ÷ adopted
OOM) is the engine's measure (`steeredShare`). STEER_S4 is [D]; E10 can calibrate it.

#### Calibration (RefBot, ai2027, medium, endings skipped; `.e7tmp/rates.ts`-style probe)

Expected acts per lab-year, attempts / uncaught (12 seeds 500–511; 10 reached ASI, mean day 915; 2028 = the seeds still
running):

| act | 2025.5–26 | 2026–27 | 2027–28 | 2028+ |
|---|---|---|---|---|
| SAFSAB (RefBot hands no safety work to AI) | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| STEER (per adopted result: 22 / 100 / 364 / 650 per yr) | 0.043 / 0.021 | 2.5 / 1.5 | 12.7 / 9.4 | 20 / 17 |
| SUCCSTEER (per run: 12 / 17 / 9 / 11 per yr) | 3e-4 / 2e-4 | 0.031 / 0.021 | 0.070 / 0.054 | 0.17 / 0.14 |
| BACKDOOR | 7e-5 / 3e-5 | 0.009 / 0.005 | 0.10 / 0.06 | 0.19 / 0.11 |
| HIDCOMP | 4e-4 / 2e-4 | 0.022 / 0.015 | 0.11 / 0.08 | 0.20 / 0.14 |

Realised per game: 14.8 uncaught STEER, 0.08 SUCCSTEER, 0.25 BACKDOOR, 4.75 caught acts (internal incidents the player
sees, mostly steering in 2027); hidden steered share 2.9% of the adopted capability OOM (S4 push ≈ +0.1–0.15 by ASI).
RefBot with Trusted to AI 0.5 and the safety package at 30% of the safety pool (6 seeds): SAFSAB 0.06 / 0.03 (2026),
0.38 / 0.23 (2027), 1.7 / 1.2 (2028) per lab-year out of 10–30 safety results a year (≈ 1.5% of results FALSE in 2027).
2025 is ≈ 0 for every act (≤ 0.04 per lab-year, all steering attempts of the start model). Growth comes from capability
(RSCH, CYBER, CODE), the AI share of R&D (0.22 → 0.99) and falling oversight (monitor catch 0.68 → 0.19 by ASI), not
from dispositions (RefBot's SCHEME stays ≤ 0.07, POWER ≈ 0.16, SUCC ≤ 0.06).

**Golden dates.** calib T1 / T1L all pass and every T1 milestone day equals the base (E4 + E6 merge, e39c1b9): ai2027
638 / 799 / 868 / 904, authors2026 1493 / 1581 / 2143 / 2979, slow SC 2038.577. golden-timelines is the reference
integrator (unchanged). Steering neither slows nor speeds the lab in this design.

#### Safety criteria (safety.ts, full run; base = the E4 + E6 merge with step 0, e39c1b9, same machine)

| criterion | base | E7 |
|---|---|---|
| S4 RefBot/medium P_mis at ASI ∈ [0.55, 0.85] | 0.503 FAIL (known → E10) | **0.504** FAIL (known; Mis mean 0.429 both) |
| S4 safe-only ≤ 0.25 | 0.011 | 0.011 pass |
| S5 RefBot "U falls below L by SAR" | +0.55, below in 28% FAIL (known) | +0.55, below in 28% FAIL (known) |
| S5 mixed keeps U ≥ L − 0.5 to SAR | margin +0.09, holds in 70% | margin +0.09, holds in 70% pass |
| S6 (FALSE rises with Trusted to AI × sabotage) | pass | pass: 0% / 0% / 1% / 3% / 5% (E2's weights gave far more) |
| B3 | pass | pass |

RefBot hands no safety work to AI (F5), so SAFSAB never fires in S4/S5; steering's hidden S4 and the rare successor
steering move P_mis by +0.001.

#### For E8 (footholds)

- `noteCovert(s, ctx, v, terms, outcome, uSev)` (safety/covert.ts) is the one place every covert act books its outcome:
  uncaught → `ws2.covert.<act>.n` / `.sev` (count, summed severity) and `uncaughtInternal`; caught → an internal incident
  (`recordInternalIncident`) and `.caught`. E8 can create a foothold there (act, model, severity, day are known) and
  replace the flag counters with its own state.
- Kinds: BACKDOOR (backdoor in infrastructure), HIDCOMP (hidden compute reservation), SUCCSTEER (steered successor:
  `steerSuccessor` marks the pulled part `steered`; `runPull` is called once per completed run, the run id is the key),
  STEER (the hidden steered stock `ws2.covert.STEER.steered`, OOM, read by `steerS4`), SAFSAB (FALSE findings already are
  "corrupted safety tools": F49 techniques with `falseValidated`).
- `covertDanger(s)` returns every act's terms today (E11's danger readout); `covertRecord(s, act)` the hidden record.

#### Gate

tsc main + scripts clean. Pass: sabotage (new, 24 checks), danger, oversight (lint without exceptions), successor, signals,
safetyresearch, research, worktypes, effective, golden-timelines (known WARNs), identity, products, serving, data, suites,
fixtures (committed fixtures restored after it rewrote them), lint-hidden, lint-ux, lint-tradeoffs, lint-structure,
lint-tips, calib (all passed: T1 / T1L on every preset, the same T1 milestone days as the base). safety: known S4 / S5
RefBot failures only (above). hygiene: all pass except the four known perf checks (11.3 ms/day average, worst quarter
42.8 ms under load from parallel runs; the daily covert roll costs ≈ 15 µs/day and a steering roll ≈ 20 µs per adopted
result, the oversight terms computed only for an attempt). finance / worldfx / ws4 not re-run: E7 changes no named RNG
stream and no milestone day; its caught incidents are internal (no public penalty).

#### Deviations and choices

- Steering's consequence is hidden CoT pressure, not a capability loss (above): the brief's "or adopts ideas with hidden
  costs (e.g. making CoT less monitorable: pushes S4)". Symptoms are CoT tools and obfuscation readings, not Recipe's
  realised-vs-believed band.
- Per-item acts take κ as a probability scale (the MacDiarmid anchor); daily acts keep E5's per-day κ. Both are the same
  formula with an act-specific opportunity.
- E5's daily SAND and SCHEME incident rows stay as they were (generic R&D sabotage and covert action; E10 calibrates
  them); the covert acts are separate rows with consequences.
- Records are flags (`ws2.covert.<act>.n | sev | caught | oom | steered`), not new state: no schemaRev bump. E8 owns the
  footholds' state.
- Investigation corruption had no caught branch before and has none now (one draw from the safety stream as before).
- An IDA cycle still rolls successor steering on its run although IDA overwrites the version's traits (E4: IDA not
  pulled); harmless (the roll can only add an incident).

### E8 notes (footholds; 2026-11-20)

Branch `v3-e8` (from `v3-e7`). Spec: MODEL-V3 §11.4. Code: `src/engine/v2/safety/footholds.ts` (new: state, creation,
effects; imports only data and types), `safety/footholdDetection.ts` (new: suspicion, location, removal, player view),
data `src/data/v2/danger.ts` (`FOOTHOLD`), hooks in `safety/covert.ts` (noteCovert, oversight with backdoor reach,
covertRecord), `safety/findings.ts` (FALSE → corrupted tool, revealFalse → removed), `safety/traits.ts` (`pulledTraits`
links steered successors), `safety/investigations.ts` and `safety/agendas.ts` (cases and audits locate),
`safety/incidents.ts` (daily step), `safety/responses.ts` + `safety/actions.ts` (Respond › Remove foothold),
`compute/power.ts` (usable compute), `security/security.ts`, `events/catalog/safety.ts` (E25), `endings/endings.ts`
(escape fate), `core/save.ts` (schemaRev 26), `core/selectors.ts` (`footholdView`). Test `scripts/v2/footholds.ts`
(in `test:v2` after sabotage, 36 checks). lint-hidden gets a rule against raw foothold reads in the UI.

#### State (`SafetyDept.footholds: Foothold[]`, schemaRev 25 → 26)

Each foothold: id, kind, maker version and lineage, day, acts and summed severity, size, `ref` (successor version or base;
technique), `delta` (steered successor), status hidden | suspected | detected (located) | removed, symptom, the days
of each status change, `removal` (engineers tied up). E7's `ws2.covert.<act>.n | sev` flag records are gone for the acts
that leave footholds; `covertRecord` now reads the footholds (Σ acts, Σ severity), caught counts stay flags. STEER's
steered stock stays a flag (a recipe property that feeds hidden S4, not an asset). Migration 25 → 26
(`footholdsFromV25`): each flag record → one hidden foothold (maker = routine model, today), each live false-validated
tool → a corrupted tool, a loose copy → a located exfiltrated copy.

#### Creation (every uncaught act of the right kind, in `noteCovert`; the escape in security.ts)

| kind | from | size [D] | grows |
|---|---|---|---|
| backdoor | BACKDOOR | reach 1 − Π(1 − 0.08·sev), ≤ 0.9 | the lineage's hidden/suspected one |
| hiddenCompute | HIDCOMP | 1% of the internal fleet's compute (agent pool + spare serving lent to research) per severity point, H100e, ≤ the pool | the lineage's hidden/suspected one |
| steeredSuccessor | SUCCSTEER on a run | extra pull Σ(share − ω_E4); `delta` = x₀ with the steered pull − x₀ with E4's pull; `ref` = the run's new version (base for base/continue runs) | the same run |
| corruptedTool | SAFSAB uncaught (the FALSE finding) | the F49 tool's s0; `ref` = its technique | one per tool |
| exfiltratedCopy | the exfiltration roll (ws4.loose, E25) | 1 copy; located at once (the alert) | – |

A caught act prompts a sweep: the lineage's hidden footholds of that kind become suspected with P 0.5 [D].

#### Effects (while not removed)

- Hidden compute: `computeOnline` = installed + rented − Σ hidden (power.ts), so every pool shrinks; the gap is the
  "unexplained compute use" symptom.
- Backdoor: the maker lineage's covert acts face block × (1 − reach) and catch × (1 − reach) (`withOversight`,
  `dayTerms`, the daily roll; successor steering through itemTerms). Lineage-scoped as the brief says: a backdoor of a
  lineage the lab no longer runs is inert (E9 may widen this).
- Steered successor: E4/E7's steered pull already lands in the model; the foothold records where and how much.
- Corrupted tool: the existing F49 mask (falseValidated).
- Exfiltrated copy: the endings' rogue clock (unchanged, E9).

#### Detection (hash draws `foothold:<id>:…`: no named RNG stream moves)

Suspicion, daily per hidden foothold, P = 1 − exp(−λ), λ = Σ channels [D]:
monitors = trace (backdoor 1/60, hidden compute 1/30 per day) × max monitoring catch of the lineage's running fleets on
the act's main trait (E6's gap rule × tool strength, `monitoringCatch`); accounting (hidden compute) = (share of the
installed fleet ÷ 2% noise) / 90 d; eval drift (steered successor) = Σ|δ_t|·stack detection_t ÷ 0.1 / 30 d; model
organisms (corrupted tool) = T-MO true strength / 90 d.
Location: a case on a model of the foothold's lineage (or the steered successor / its base) at clarity c, relevance ρ
(the act's trait weights): suspected → located with c·ρ; hidden → located c·ρ/2, suspected another c·ρ/2. Cases =
investigations at resolution (not when corrupted) and heavy-safety alignment audits (c = their WB strength ≥ 0.3).
Corrupted tools are located and removed by the existing cross-checks (`revealFalse`). Test: 60-day suspicion 45.3% vs
45.3%; case at c 0.6: 61.3% vs 60%, hidden 30.7% / 30.6% vs 30% / 30%; sweep 49.3% vs 50%.

#### Removal (Respond › `removeFoothold`, located only; preview = effect, tested)

| kind | engineers × days | agents off | other |
|---|---|---|---|
| backdoor | 10 × 30 d | 7 d | reach gone |
| hiddenCompute | 5 × 14 d | 3 d | H100e back to usable compute |
| steeredSuccessor | 10 × 30 d | – | δ subtracted from the successor (and versions on a steered base); next post-run −0.02 progress |
| corruptedTool | 5 × 14 d | – | `revealFalse` (tool withdrawn) |
| exfiltratedCopy | refused: only the E25 hunt / endings remove it (captured → removed, went quiet → suspected) | | |

Engineers are counted in `patchFte` (free safety research engineers gate cases and removals). [D] values throughout.

#### Player view (R9)

`footholdView(s)` (selectors): suspected (symptom, where a case could look: the lineage's running model and the act's
main trait; no maker, no size), located (maker, size, unit) and removed rows, plus the open symptoms. Hidden footholds
never appear; lint-hidden forbids `.footholds`, `footholdsOf`, `hiddenComputeH`, `backdoorReach`, `suspicionRate`,
`covertRecord` in `src/ui/v2`. No UI yet (E11).

#### Reference run (RefBot, ai2027, medium, endings skipped, seeds 500–523; `.e8tmp/probe.ts`)

Per lab-year (counts in brackets); 22 of 24 reached ASI:

| year | created | suspected | located | removed | hidden compute (mean share of fleet) |
|---|---|---|---|---|---|
| 2025.5–26 | 0 | 0 | 0 | 0 | 0 |
| 2026 | 0.042 (1 steered successor) | 0 | 0 | 0 | 0 |
| 2027 | 0.269 (3 backdoor, 2 steered, 1 hidden compute) | 0.045 (1 steered) | 0 | 0 | 0.002% |
| 2028+ | 0.287 (1 backdoor, 1 hidden compute) | 0.144 (1 hidden compute) | 0 | 0 | 0.042% |

RefBot never investigates, so nothing is located. Hidden compute peaks at 0.54% of the fleet (≈ 56–61k H100e) in the
two games that grew one. A hunter variant (RefBot + investigate each suspected foothold where the view points, remove
each located one) located and removed 2 (a hidden compute reservation, a steered successor) in 2028+, the rest stayed
hidden. Golden dates: calib T1 / T1L all pass with every T1 milestone day equal to E7's (ai2027 638 / 799 / 868 / 904,
authors2026 1493 / 1581 / 2143 / 2979).

#### Gate (lead's reduced test policy mid-task)

tsc main + scripts clean. Pass: footholds (new), sabotage, danger, oversight, successor, safetyresearch, research,
worktypes, effective, golden-timelines, identity, data, signals, lint-hidden, lint-tradeoffs, lint-structure, lint-ux,
calib (all passed). Not run per the lead's policy: safety (S4/S5), hygiene, suites, products, serving, fixtures, finance,
worldfx, ws4, test:ui. hygiene's and data's SCHEMA_REV assertions moved to 26 (not re-run).

#### For E9 (loss of control)

- `footholdsOf(s)` (engine), `hiddenComputeH(s)` (the misaligned fleet's own compute), `backdoorReach(s, lineage)`,
  each steered successor's `delta` and `ref`, exfiltrated copies (status detected while hunted, suspected once it went
  quiet), corrupted tools masking tools; `suspicionRate` for what the lab can still see; `footholdView` for the UI.
- Not yet: footholds do not grow on their own, a backdoor does not raise exfiltration, a hidden copy cannot escape
  unnoticed; all candidates for E9's effective-control state.

### E9 notes (loss of control as a process; 2026-11-20)

Branch `v3-e9` (from `v3-e8`). Spec: MODEL-V3 §11.4 ("Loss of control happens when footholds and capability together let
a misaligned model act without effective oversight… replaces the single roll at superintelligence"), §11.8 (hidden
foothold ease). Code: `src/engine/v2/safety/control.ts` (new), data `src/data/v2/danger.ts` (`CONTROL`,
`FOOTHOLD.copyTrace`), hooks in `safety/incidents.ts` (daily `controlStep`; backdoor in `exfiltrationHazard`),
`security/security.ts` (noticed vs unnoticed escape), `safety/footholds.ts` (`footholdFromEscape(…, mis, noticed)`),
`safety/footholdDetection.ts` (outbound-traffic channel), `endings/endings.ts` + `endings/epilogue.ts` (no rolls),
`world/hidden.ts` (`toleranceNoiseOf`), `core/save.ts` (schemaRev 27), `core/selectors.ts` (`controlView`), lint-hidden
rule. Test `scripts/v2/control.ts` (in `test:v2` after footholds, 28 checks).

#### Effective control (hidden; `SafetyDept.effectiveControl`, refreshed daily)

    exposure E(v) = Mis(v) · (1 − O_eff(v)) · (1 + F(v))       control C = clamp01(1 − E)
    O_eff = 1 − (1 − block·(1 − r))·(1 − catch·(1 − r))        E6 internalOversight(s, v, 'POWER'); r = backdoor reach
    F = hidden compute share of the installed fleet ÷ 5%        [D]
      + Σ escaped copies 0.25·(1 + log₂ copies)                 [D] (lab-wide: outside the lab)
      + 2·Σ|δ| of steered successors in v's lineage             [D]
    located (not removed) footholds count at half weight [D]; removed ones not at all.

The stored level is the lab's lowest over its best model and running internal fleets. The capability gap enters through
E6's oversight (monitor catch at the gap, human review above L 10), so the same Mis loses control as capability outruns
the overseers. The player sees `believed` only (`controlView`): the same formula on belief estimates, measured level and
the footholds it knows (located at size, suspected at 0.05 of F each). Corrupted tools act through detection (F49) only.

#### Loss of control (no roll anywhere)

- World tolerance θ_w = doomThreshold + ε_w, ε_w ~ Logistic(0, 0.06) from a hash of the seed (`hidden.toleranceNoise`; no
  stream draw). doomThreshold keeps its role as the world's difficulty; with no oversight and no footholds P(loss | Mis)
  over worlds is exactly v1's σ((Mis − θ)/0.06) (test: 0.696 vs 0.697 over 20 000 seeds), but it is a property of the
  world. The control threshold is 1 − θ_w.
- **Player ASI** (`resolveAsi`): lost iff E of the ASI model (best version; lab-wide footholds count) > θ_w. Lost and
  0.8·Cont·(1 − leverage) ≥ 1 − θ_w/E → asiContested, else asiTakeover. Kept → asiAligned with the aligned-power table
  unchanged. `epilogue.controlAtAsi` records C.
- **Escaped copy** (`rogueCopy`, replaces the 90-day roll): any active copy (hunted, quiet or never noticed) that holds
  ≥ 2 copies, with Mis·(1 + 0.25·log₂ copies) > θ_w and the lab's frontier at SAR → 'rogue'. The hunt (daily capture while
  loose) and "went quiet" after 90 d are kept; a quiet copy keeps growing.
- **Rivals and China**: simplified, as asked: exposure = their misalignment index (posture acts through their traits as
  before; no fleets or footholds), lost iff > θ_w; contested by the same margin rule with posture containment.
- **Company-loss epilogue**: the competitor's projected Mis > θ_w → power 'none' (was a roll).
- `pMisOf` stays only as an expectation in `epilogueSurvival` (a score) and in AsiResolution's record. Test scans every
  engine file: no `chance(…)` on pMis, doomThreshold or the doom sigmoid.

#### Footholds grow once control is low [D]

| rule | value |
|---|---|
| escaped copy acquires compute | size × 2 per 30 d · (Mis/0.4) · D_w · (1 − cyber defence), ≤ 16 copies |
| hidden compute launches more jobs | +1/120 of itself per day × its lineage's E × D_w (not while located), ≤ the agent pool |
| backdoor raises exfiltration odds | exfiltrationHazard: (1 − (1 − r)·WSL/5)·(1 − (1 − r)·Contain) |
| escape unnoticed | P = 1 − C of the escaping model (hash draw): hidden copy, no alert, no E25, no hunt |
| unnoticed copy's symptom | suspected at 1/180 per day × WSL/5 ("unexplained outbound traffic") |

D_w (difficultyMult) is the world's hidden difficulty for how readily footholds grow; foothold creation itself is E7/E8's.

#### Probe (RefBot, ai2027, medium, seeds 500–507; `.e9tmp/probe.ts`)

| seed | Mis at ASI | v1 pMis | E | O_eff | F | θ_w | C | believed | endings skipped | endings on |
|---|---|---|---|---|---|---|---|---|---|---|
| 500 | 0.230 | 0.056 | 0.214 | 0.074 | 0 | 0.552 | 0.786 | 0.809 | asiAligned | ousted (d 823) |
| 501 | 0.284 | 0.126 | 0.277 | 0.024 | 0 | 0.400 | 0.723 | 0.755 | asiAligned | asiAligned |
| 502 | 0.287 | 0.132 | 0.259 | 0.098 | 0 | 0.440 | 0.741 | 0.842 | asiAligned | asiAligned |
| 503 | 0.279 | 0.117 | 0.272 | 0.026 | 0 | 0.366 | 0.728 | 0.800 | asiAligned | asiAligned |
| 504 | 0.283 | 0.124 | 0.278 | 0.017 | 0 | 0.366 | 0.722 | 0.800 | asiAligned | asiAligned |
| 505 | 0.554 | 0.928 | 0.538 | 0.029 | 0 | 0.273 | 0.462 | 0.716 | asiTakeover | asiTakeover |
| 506 | 0.712 | 0.994 | 0.775 | 0.059 | 0.158 (hidden compute) | 0.527 | 0.225 | 0.918 | asiTakeover | ousted (d 1189) |
| 507 | 0.761 | 0.998 | 0.748 | 0.018 | 0 | 0.250 | 0.252 | 0.658 | asiTakeover | asiTakeover |

Comparable to S4: the v1 rule's expected takeover on these seeds = mean pMis 0.435; the process: 3/8 = 0.375 realised,
mean σ((E − θ)/0.06) = 0.421 expected over worlds. Oversight at ASI is small for RefBot (O_eff 0.02–0.10, the gap),
so E ≈ Mis and the mix stays close to v1's; footholds matter where they exist (seed 506: hidden compute F 0.16, a hidden
backdoor; believed 0.92 vs true 0.23). No escape happened in the probe. S4 itself (pMis of Mis) is unchanged by E9.

#### Gate (strict policy)

tsc main + scripts clean. control 28/28, footholds, sabotage, danger, oversight, successor all passed;
golden-timelines all passed (golden file unchanged); calib all passed (0 FAIL; T1 milestone days equal E8's: ai2027
638 / 799 / 868 / 904, authors2026 1493 / 1581 / 2143 / 2979; T1 skips endings). Not run: safety (S4/S5), hygiene,
data, fixtures, finance, worldfx, ws4, lint-*, test:ui, bots. SCHEMA_REV assertions in data/hygiene/footholds moved to
27; ws4's E5 forced 'rogue' state now plants a grown copy foothold (not re-run).

#### For later

- E10/F5: RefBot oversight at ASI is near zero, so control is set by Mis; a bot that keeps oversight at the gap (control
  layer + strong AG07) can now keep a misaligned ASI under control: S4/§7.4 criteria may want a control statistic.
- E11: `controlView` (believed control and its model), the outbound-traffic symptom, footholdView.
- In-lab loss before ASI is not modelled (only the escape path acts pre-ASI).

### E11 notes (safety UI 1: footholds and symptoms, danger per deployment, control and its tax; 2026-11-20)

Branch `v3-e11` (from `v3-e9`: E6 oversight, E4 successor pull, E7 covert acts, E8 footholds, E9 loss of control). UI task:
output-only selectors, no mechanism or saved-state change (no schemaRev bump). E12.md is not on this branch; nothing
here repeats E12's Safety › Overview items (trait families stay in Risk families; successor pull is not shown here).

#### What is shown where (one home per datum)

| datum | home (level) | elsewhere |
|---|---|---|
| believed control, its band | Safety › Overview › Control card (L1 gauge + number + band pill) | — |
| what drives it: estimated misalignment, effective oversight (gap to its monitor, gap above humans), known foothold capacity F | Control card, three bars (L1), parts in each bar's tooltip (L3); exposure = mis × (1 − O) × (1 + F) in the gauge tooltip | — |
| control layer on/off, its tax (largest lane) and miss multiplier | Control card's last row with **Add control** (the existing `safety.respond addControl` response; the only way to set it) | tax per lane stays on Company › Agents at work (E6 tag), linked ("Tax per lane") |
| footholds the lab knows of | Safety › **Footholds** tab (new; badge = suspected + located): Symptoms · suspected (symptom, kind, since, where a case could look + Investigate), Located (kind, maker, located date, size, **Remove** with the response's preview), Removed (history) | Control card header chip: count + "n suspected · m located", jumps to the tab |
| symptom channels (what surfaces each kind; static rules) | Footholds tab › "What to watch for" side card: unexplained access, unexplained compute use, eval drift, anomalous research results, outbound traffic, each with "seen by" and a link to the lever (Monitors, Tools/Lines, Security) | — |
| believed danger of a product | product card, under run cost: harmful acts/yr, four factor bars (D, C, O, oversight) of the dominant act, its name (L1); tooltip (L3): top-3 acts table, the four factors' parts, attempts and caught, what lowers it with before → after | — |
| believed danger of an internal lane | Agents at work, Risk · danger column under the risk badges (number + bars; act name in the tooltip) | — |

Policies moved under the race chart on Safety › Overview (the side column grew by the Control card; the chart column
had empty space under it).

#### Belief selectors (src/engine/v2/safety/dangerView.ts, re-exported from core/selectors.ts)

- `dangerView(s)` → `{ products: Record<id, DangerRead>, lanes: Partial<Record<AgentUse, DangerRead>> }`. E5's formula
  rebuilt on what the player knows (as E12's successor-pull view does), not `dangerOf`:
  - disposition x̂^1.5 from belief estimates (0 without a belief);
  - capability σ((L̂_d − θ)/s) on the measured domain level (measured general level + the version's domain offset, as
    `commitments.measuredDomain`, but with `measuredLOf`'s lineage fallback instead of the true level while evaluating);
  - opportunity: the site's visible terms (usage, copies, autonomy from the horizon, affordances, AI share of R&D, product
    features' multipliers); an internal lane uses its own use's work-type horizon and its share of internal agent
    compute, so a model's lanes add up to E5's fleet row (opportunity is linear in A);
  - block: AG07 containment at the **believed** tool strength on the measured OOM (+ weight security on escape-like acts);
  - catch: internal = believed CoT/WB detection (`detectionAt` with only those tools) × (½ + ½ × the fleet's monitor
    strength), human review on the measured gap above L 10, control deferral; product = its monitor's `catchRate`
    (measured levels already).
  - levers with the same selector after: control layer on, restrict context (×0.3); add a monitor and train the
    disposition down as text.
  - Left out: U-modes (the player does not know which model carries one) and misuse (not a disposition; Products ›
    Safeguards).
- `controlReadout(s)` → believed control (`controlView`), band (display bands [D]: firm ≥ 0.90, holding ≥ 0.75,
  slipping ≥ 0.60, weak; not the world's threshold), its believed parts (E9's `believedTerms`), the monitor gap and
  the gap above humans (measured), footholdView's counts, the control layer and its tax (largest lane today, or what it
  would be). Fallback when the record is not yet refreshed (a pre-E9 save until the next day): the lowest
  `believedTerms` control over the same candidates (best model, internal fleets), beliefs only.
- `footholdView` (E8) unchanged. `store.readouts` exposes the three selectors to the UI test.
- `safety.respond addControl`'s preview now reads E6's protocol (largest lane tax, misses ×0.45) instead of v2's flat
  "5% usefulness tax" (preview text only).

#### Glossary (src/data/v2/glossary.ts)

foothold, footholdSuspected, footholdLocated, footholdRemove, symptom, fhBackdoor, fhHiddenCompute, fhSteeredSuccessor,
fhExfiltratedCopy, fhCorruptedTool, effectiveControl, controlBand, effOversight, footholdCapacity, controlLayer,
humanGap, danger, disposition, actCapability, opportunity, actOversight. Icons: `ICON.foothold` (anchor), `ICON.danger`
(radiation), `FOOTHOLD_ICON` per kind.

#### Gaps

- E9's `believedTerms` (behind the stored believed control and its parts) runs `internalOversight` on a copy of the
  version with belief estimates and the measured level, but that path still reads the true tool strengths (containment),
  the version's true masks and undiscovered U-modes (monitoringCatch → familyPenalty). The danger selector avoids this
  with believed detection and believed containment; E9's believed control should move to the same believed oversight
  (engine change, not in this UI task).
- `controlView.versionId` is chosen by TRUE exposure (the model where true control is lowest), so the name on the card is
  a faint hint; the fallback above picks by believed control.
- The control layer has no off switch (by design of the response); the card says it stays on.
- Suspected rows show the kind's name (footholdView gives it, and the symptom implies it).

### E15 notes (believed control reads believed oversight only; 2026-11-20)

Branch `v3-e15` (from `v3-e11`). Fixes the two leaks flagged in the E11 notes ("Gaps", above).

- New `src/engine/v2/safety/believedOversight.ts`: `believedMonitorCatch` (moved from dangerView), `believedOversightParts`
  (believed AG07 containment on the measured OOM, human review on the measured gap, control deferral) and
  `believedInternalOversight` (E6's `internalOversight` shape on those inputs: same deployment / control-layer choice, no
  true tool strengths, masks, levels or U-modes). dangerView's internal lanes and E9's `believedTerms` both use it.
- `controlStep` stores `effectiveControl.versionId` / `believed` as the candidate with the lowest BELIEVED control
  (`believedLowest`, same candidates as `labControl`). `level`, `exposure`, `lowest` (true) unchanged. controlReadout's
  pre-E9 fallback uses `believedLowest` too.
- Readers of the believed value / `controlView` / `believedTerms`: controlReadout (UI) and the tests only. No bot, no
  mechanism. `effectiveControl.versionId` had no other reader.
- Test: control.ts "E15" check on day400/day900 fixtures: hidden-truth perturbation (efficacy, false validation, masks,
  undiscovered U-modes, true traits, true levels) leaves believed control, versionId and its parts unchanged; true moves.
- Saved state changes (versionId may differ; believed value differs): golden timelines / hashes not re-run here.

### E13 notes (safety ideas P14, P15, P23, P27 as typed effects on the safety mechanisms; 2026-11-20)

Branch `v3-e13` (from `model-v3` at 432f0b4). Data and sources: `src/data/v2/safetyIdeas.ts` (new: `P14_STEER`,
`P15_OVERSIGHT`, `FAITHFUL_COT`, `P27_AAR`). Engine: `src/engine/v2/safety/ideas.ts` (new: `probeSteer`, `steerGrowth`,
`probeGoodhart`, `aiOversight`, `cotResist`, `aarAuto`). Hooks: `safety/traits.ts` (TraitEnv.growthBy, post-run P14,
S4 and COT masks for P23, predictBeliefs' believed steering), `safety/detection.ts` and `safety/understanding.ts`
(CoT controllability × (1 − resist)), `models/suites.ts` + `suitesPreview.ts` (hardening cash and cut, preview text),
`safety/lineProjects.ts` (P27 flat factor removed; Auto via `aarAuto`), `departments/workfit.ts` (P27 fit on SAF_*),
`data/v2/runDesign.ts` (POST_COT.faithful reads FAITHFUL_COT). Text: tree.ts, paradigms.ts, glossary (`suiteHarden`,
`cot`), design/TECH-TREE.md (§2 rows, §6.4 rows; the LATER(V6) markers are gone). Test: `scripts/v2/safetyideas.ts`
(in `test:v2` after oversight).

#### Effects (unit, source)

| idea | mechanism | effect | source |
|---|---|---|---|
| P14 interp-guided training | post-training trait step (E3/E4 path) | growth of trait t × (1 − k·d_t), k = 1; d_t = active WB detect tools' coverage × true strength at the new model's OOM (E6 decay), combined as correlated tools, × WB family penalty (masks, hidden U-modes) | research/12 #14; Chen et al. 2025 preventative steering (direction) [D k] |
| P14 Goodhart | E24 masks | the version's WB mask on each steered trait: 1 − (1 − m)(1 − 0.3·d_t); inherited, and read by the next run's d | Bailey et al. 2024 (research/14 F08) [D 0.3 = a third of explicit training-against] |
| P15 AI-assisted oversight | D5 suite hardening via E2's AI share A of SAF_EXP (Trusted to AI × the safety model's SAF_EXP coverage) | cash × (1 − A·(1 − 4/150)); cut 0.4 × (1 + 0.5·A_eff) | research/14 AG17 ($4/h vs $150/h) [V]; critic gain [D] (Saunders 2022 / CriticGPT direction) |
| P15 collusion | E6/J2 AG1 same-lineage rule | A_eff = A × (1 − COPY_COLLUSION 0.4) when the critic (safety model) shares the internal model's base; T-LOCK halves the penalty | data/v2/features.ts COPY_COLLUSION |
| P23 faithful-CoT | CoT option | −0.29 OOM effective compute; serving FLOP per token × 1.2 (serveCost → ModelVersion.fpt); monitorability 0.98 | research/12 #23 (−0.3 G = v2 −0.24 y × 1.2 OOM/y) [D] |
| P23 resist | S4, COT masks, COT family penalty | training against a CoT monitor: S4 0.8 → 0.4, COT masks × 0.5; CoT controllability ctl(L) × 0.5 in the true and believed COT penalty and in U's detector | [D 0.5]; Emmons et al. 2025 (CoT necessity) direction; Baker 2025 for the pressure |
| P27 automated alignment research at scale | E2 safety labour | SAF_EXP and SAF_IDEAS fit + 0.3 OOM for the safety package (Deep-research scaffold size); every agenda's Auto' = 1 − (1 − Auto)·0.5 | research/14 AG17 [V]; Carlsmith 2025 [V]; sizes [D] |
| P27 false results | E2 FALSE weight (unchanged interface) | weight = lineLabour(s, agenda).aiShare × sabOf(safety model); both P27 parts raise the AI share | E2 (E7's covert SAFSAB replaces sabOf at merge) |

#### Removed

- `traits.ts`: the dead `ws2.p14Goodhart` flag (set, never read; P14 had no effect at all before E13).
- `data/v2/suites.ts`: `SUITE_HARDEN.p15Cash` (P15 = cash × 0.2 flat).
- `lineProjects.ts lineSpeed`: P27 × (1 + 3t).
- Texts: "In-run trait growth ×0.6", "Hardened graders at the cheap price", "Safety research speed × (1 + 3·AI labour)",
  "Δ −0.24 y"; the aar node's stale "Lets the safety AI-labour policy exceed 50%" (E2 removed that cap) now states F44's
  effect; Agents.tsx comment "cap until P27".

#### Sizes in play (probe, ai2027 seed 2027: start, RefBot fixtures day 400 and 900)

- P14 d on AF / SCHEME / SAND: start 0.32 / 0.32 / 0.43 (growth × 0.68 / 0.68 / 0.57, close to v2's flat × 0.6), day 400
  (L 7) 0.24 / 0.24 / 0.23, day 900 (L 14.8) 0.07: the probes fade with capability. One steered run at the start masks AF
  by 0.097; the next run's d falls 0.32 → 0.29 and the mask reaches 0.175 (compounding Goodhart).
- P15 at day 400, Trusted to AI 1, package 20% of the safety pool: A 0.27 → cash $50M → $37M, cut 0.40 → 0.43 with the
  same-lineage critic (0.455 with another lineage). Day 900: A 1 → cash × 0.027, cut × 1.3 (× 1.18 colluding).
- P27 at day 400, t = 1: SAF_EXP coverage 0.27 → 0.33; m_exp AG01 1.61 → 2.06, AG08 1.98 → 2.38, AG12 1.34 → 1.81; AI share
  AG12 0.045 → 0.166. Day 900: AG01 × 2.8, AG02 × 2.7, AG12 × 2.8, AG08 × 1 (already fully automatable and covered).
  v2's × (1 + 3t) gave × 4 on every line's speed at t = 1 regardless of verifiability; the new effect is smaller mid-game
  and concentrates on the hard-to-check agendas, which is the bootstrapping story of research/14 §6.

#### RefBot and the bots

RefBot (REF_TREE) researches none of the four and never hands safety work to AI: golden timelines are identical
(test asserts REF_TREE). The safe bot adds P23 (SAFE_TREE_EXTRA) and posts with faithful CoT: its CoT monitors are now
stronger late (COT penalty at L 12: 0.18 visible → 0.59 faithful, was 0.20 with v2's 0.98 monitorability alone); the
40-seed safety suite (S4 safe-only P_mis) was not run on this branch per the test policy; expect it to move down.
No bot researches P14, P15 or P27.

#### Choices and open items

- [D] P14 steers every post run once adopted (as M4's "a lab's alignment-training methods are part of every post run");
  a player who wants the probes for monitoring only can deactivate the WB tools or not research P14. No toggle (no
  micromanagement). Stream days and IDA cycles are not steered (only post runs, where the masks are applied).
- [D] Believed WB masks (U, predicted beliefs) still count only explicit training-against (`believedMask`), so P14's
  masks are a hidden cost the player learns through NEG results and investigations.
- [D] P15's cut uses the safety agents' share on the day the pass finishes (the preview shows today's); the cash is paid
  at queue time with today's share. No state.
- Kept: F44's `flag:aar` × 3 on AG18/AG03/AG16 with AI labour (a finding, not one of the four ideas) and AG17's science
  teams' × (1 + √(capacity ÷ SERIOUS_CAP)) on the agents' AI team-equivalents. Both are flat factors a later pass could
  type like P27.
- schemaRev unchanged (27): no new state.

#### Gate (tests run per the E13 policy)

tsc main + scripts/v2 clean. Pass: safetyideas (new, 29 checks), signals, oversight, successor, danger, safetyresearch,
research, suites (P15 touches hardening), golden-timelines (identical dates; known WARNs authors2026 SC, slow SC,
sampled p50). calib (one run): T1 passes on every preset (ai2027 SC 2027.266, SAR 2027.694, SIAR 2027.936, ASI 2028.025;
slow SC 2038.577). T1L has 8 failures (ai2027 SAR/SIAR/ASI, authors2026 SAR/SIAR/ASI, fast ASI, slow SC): identical
output on the base commit 432f0b4 (checked in a scratch worktree), so pre-existing on model-v3, not E13. Not run (policy):
the 40-seed safety suite, finance, worldfx, ws4, hygiene, fixtures, lint-*, test:ui, bots.

### M5 merge notes (T0, P3, D9, D10, F2, E7 → E8 → E9 → E11 → E15, E13 onto M4; 2026-11-20)

Merged into `model-v3` (at M4's docs head 432f0b4) with `--no-ff`, in order: `v3-t0` (T0 bf06eb3 / be7d06c / 6652b4c,
base 50b15dd; merge cd504e3), `v3-p3` (P3 c498c70 / 59a33f2, base 422d383; 68ee85b), `v3-d9` (D9 bf2c63f / f24043f, base
f3cfec5; f4b65ac), `v3-d10` (D10 de8f09c / e6b41cb on top of P3's two commits, base 422d383; 7d6d08f), `v3-f2` (F2
5fbe087 / 79af0b8, base 422d383; 7cf6147), `v3-e15` (one chain from 190e27d: E7 e39c1b9 / 195f273 / acff4ed, E8 b077913 /
7173fa4, E9 826b267 / 93fff7b, E11 90c7c8d, E15 8638feb; only the tip merged; e1be44e), `v3-e13` (E13 70e54e7 / b8f23b9,
base 432f0b4; 97f8985). Then: the migration idempotence check (ec6847a), the fast refit, the F2 note links and the removal of the folded notes files (c668eeb),
fixtures and GLOSSARY.md regenerated (464edac), these docs. T0 went first, so every later check used its tiers (tsc plus
`run.ts --tier full --only <suites a conflict touched>` after each merge; `test:quick` once, `test:cal`, one `test:full`).
The notes of every branch are above (copies of `design/notes/<ID>.md`, deleted after folding; the M1–M4 notes files
stay).

**Conflicts and resolution.**
- v3-t0: none.
- v3-p3: `worldfx/choice.ts` (M3's c98f2ed overflow guard vs P3's flat share buffer): M3's guard re-applied in P3's
  buffer form (then replaced at D10, below).
- v3-d9 (based on M2+D11, before M3/M4's E6, D7, F1): `save.ts` (imports, doc, migration renumbered 23 → 24 ⇒ 27 → 28),
  `models/research.ts` imports (D7's evals + D9's suite expert data), `models/runs.ts` (HEAD's E3 signals and BRIDGE(V7)
  note kept, D9's P12_HORIZON removal applied), glossary (D9's synJob text; the duplicate old `expertData` entry from
  D9's side dropped, M3's richer entry kept), `data.ts` / `hygiene.ts` / `suites.ts` rev checks and headers. **Semantic:
  D4's `production/dataView.ts` (M3) still called `portfolioU(p, { p10 })` and `drawData(…, { p10, noRepeat })`**, which D9
  removed: the view now reads `portfolioU(p)` and the plain draw (P10's effect is the quality ceiling, P21's `worth` does
  not move specialisation).
- v3-d10: `save.ts` (renumbered 25 → 26 ⇒ 28 → 29), `hygiene.ts` (its 25 → 26 check now 28 → 29), Models.tsx imports
  (E12's `versionPressure` + D10's `tokEff`). **choice.ts: one overflow guard.** Three fixes met here (M3 c98f2ed, F2's
  copy of M3's text, D10's own). Kept D10's, removed M3's: D10's renormalises a choice set on its own best utility when
  0 < Σ < 1e-250, so f = p ÷ Σ can no longer overflow (M3's branch can never fire once D10's runs). D10's covers a case
  M3's misses: M3 divided first only once f was infinite and kept the denormal weights, so members whose weight had
  underflowed to 0 got no share and the others lost precision; renormalising gives the exact shares. Neither covers a set
  whose every weight underflows to exactly 0 (Σ = 0): it is skipped, its probability mass goes to the other sets, as
  before all three fixes.
- v3-f2: `actors/rivalModel.ts` (imports; initRivalPhys and migrateRivalPhys take F2's three-part recipe and D10's
  `serve: 0`), `actors/rivals.ts` PHYS_PLACEHOLDER (both fields), `production/production.ts` rivalResearch (F2's
  absorbKnowHow → recipeRates → advanceRecipe, then D10's serving-stack step from the same research speed; D10's
  `rivalAgentFpt` kept), `save.ts` (25 → 26 ⇒ 29 → 30), `hygiene.ts` (F2's check now 29 → 30), choice.ts (HEAD's single
  guard), `ws4.ts` (T0's cache and SMOKE wrapper + F2's daily samples). **Semantic:** D10's `rlG` (G − G_pre − the
  reference RL gain on the base) is exactly the RL part under F2's versions (G_pre + refRlGain(flop, mid, ceil)), so
  `setModelG` / `rlGOnBase` needed no change. **ws4 T3 per the lead's decision: the mean is the check (SMOKE in quick),
  the 10th–90th percentile of the daily lead is INFO** (F2's branch still had it as a check).
- v3-e15 (based on E6's 190e27d, before M3's D4/D11, M4's E12/D7/F1 and this wave): `package.json` (T0's tiers kept;
  E7/E8/E9's new tests sabotage, footholds and control added to `run.ts` instead), `save.ts` (E8 25 → 26 ⇒ 30 → 31, E9
  26 → 27 ⇒ 31 → 32), `traits.ts` imports, `oversight.ts` lint message, Safety.tsx (imports; Overview = E11's main
  column RaceChart + Policies, side column Control card, Families, E12's Successor card), safety.css (both blocks),
  store.ts imports, uitest (E11's and E12/D8's checks at day 400 and 900), `data.ts` / `hygiene.ts` rev checks;
  `footholds.ts` and `control.ts` migration checks renumbered (a rev-30 / rev-31 save).
- v3-e13: TECH-TREE.md and `tree.ts` (D9's P10 / P12 / P21 rows and nodes with E13's P23 / P14), `lineProjects.ts`
  (E13's `aarAuto` with E7's `safetySandbag` lift and both comments), `package.json` (`safetyideas` added to `run.ts`).
  **Semantic: safetyideas' P27 source check still looked for E2's `aiShare × sabOf(` FALSE weight**, which E7 replaced
  with the covert act SAFSAB on the same AI share (F49; the E13 notes expected this at the merge): the check now reads
  `safetySabotage(s, lineLabour(s, agenda).aiShare)`. `umodes.ts sabOf` has no reader left.

**schemaRev chain (linear): … 26 → 27 F1 (M4), 27 → 28 D9 (`ResearchState.dataFx`), 28 → 29 D10 (`RivalPhys.serve`,
`SimpleModel.rlG`), 29 → 30 F2 (`RivalPhys.rec / pool / paSync`), 30 → 31 E8 (`SafetyDept.footholds`), 31 → 32 E9
(`effectiveControl`, `toleranceNoise`, `Foothold.mis`); SCHEMA_REV 32.** P3, T0, E7, E11, E15 and E13 add no state. Built
as D9 23 → 24, D10 / F2 25 → 26, E8 / E9 25 → 26 → 27; every migration is guarded (D9's returns once `dataFx` exists and
now assigns instead of adding; D10 `??=`; F2 skips a lab with `rec`; E8 skips existing footholds; E9 sets only what is
missing). New hygiene check: a played state labelled rev 27 loads with an identical state hash (27 → 32 idempotent).
hygiene asserts 32 and checks 15 → 16 … 26 → 27 and the new 28 → 29, 29 → 30; data.ts asserts 32; footholds.ts checks
30 → 31, control.ts 31 → 32, suites.ts 27 → 28. Every hygiene save check deserializes to the current rev, so the old
saves (rev 15 on) load through the whole chain. **Fixtures:** T0 had regenerated them at rev 27; after the merges they
were stale (fixtures FAIL in test:quick, as T0 designed) and were regenerated once on the final code (rev 32, 464edac).
golden/timelines.json unchanged (golden-timelines equals the integrator output).

**Serving A5 E9 (price customers pay for V0's capability, target ×6–×30/yr):** ×11.45/yr after the D10 merge, **×10.39/yr
after the F2 merge** (hardware ×1.42, margin ×1.13, models bought ×6.50; cheap tiers 100% of the band's hours at the
end) and in the final full run after the S3 test fix. F2's ×2.31/yr was measured on intermediate code without D10. A3 per task
×17.49/yr, per token ×16.85/yr.

**Refits (named per-preset values only; seed 2027; Δ in years; G_SC scans with M3's scratch `_m3scan.ts`, Δ_bm and
sd_SC kept).** `test:cal` on the merged code: T1 ai2027, authors2026 and slow pass; **fast SAR +0.123 fails** (±44 d =
0.1205 y; M4 +0.107, D10's branch +0.175: the inference team comes out of RefBot's capability teams).
- **fast G_SC 31.572 → 31.553**: SC +0.063 → +0.047, SAR +0.123 → +0.104, SIAR +0.000 → −0.019, ASI −0.085 → −0.104. SAR,
  SIAR and ASI fall on one day in this preset, so SAR − ASI ≈ 0.21 y of a 0.24 y window. Scan (SC / SAR / ASI): 31.540
  +0.041 / +0.096 / −0.112, 31.545 same, 31.548 +0.038 / +0.104 / −0.104, 31.550 +0.041 / +0.104 / −0.104, 31.552 +0.044 /
  +0.099 / −0.110, 31.553 +0.047 / +0.104 / −0.104, 31.555 +0.052 / +0.115 / −0.093, 31.556 +0.049 / +0.107 / −0.101, 31.558
  +0.049 / +0.110 / −0.099, 31.560 +0.058 / +0.118 / −0.090, 31.562 +0.047 / +0.107 / −0.101, 31.564–31.570 SAR +0.115,
  31.566 +0.121 (fail), 31.572–31.574 +0.123 (fail), 31.576 +0.118, 31.578–31.590 +0.126…+0.132 (fail). Passing run
  31.540–31.564; 31.553 is where SAR and ASI are symmetric. F4.
- After the refit (final): ai2027 SC +0.025, SAR +0.036, SIAR +0.027, ASI +0.019; authors2026 SC +0.030, SAR +0.093, SIAR
  −0.019, ASI −0.052; fast as above; slow SC +0.049. T4 passes. No value moved by more than 0.02 OOM; the ±0.3 y stop
  rule was not reached. golden-timelines passes (known WARNs: authors2026 SC, slow SC, sampled p50).
- **T1L (reported, not refit: LEADER_CAL is F2's, not a merge value)**: ai2027 SC −0.044, SAR +0.088, SIAR +0.008, ASI
  −0.022 (pass); authors2026 SC −0.019, SAR +0.110 (pass), **SIAR −0.611, ASI −1.337 (fail)**; fast SC +0.008, SAR +0.027,
  SIAR −0.077, **ASI −0.162 (fail)**; slow SC −0.036 (pass). 3 failures, all on M4's list of 8 (ai2027 SAR…ASI, authors2026
  SAR and slow SC now pass). authors2026's post-SC misses grew from F2's branch (−0.258 / −0.581) with D10 and the safety
  merges; F2 decision: → F4.

**Gate: one `npm run test:full` on 464edac (the final code; only the two test fixes below and these docs came after).**
Wall 11.2 min (real 11 m 17 s), CPU 63.9 min, machine load 90% (12 cores, 6 workers), simulation cache cold (code changed).
`test:quick` once before it: 2.4 min, failures only fixtures (stale, regenerated) and worldfx's known set.

| script | pass | fail | warn | wall s | | script | pass | fail | warn | wall s |
|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|
| tsc-scripts | – | 0 | – | 4.9 | | lint-structure | 7 | 0 | 0 | 4.7 |
| golden-timelines | 16 | 0 | 3 | 9.0 | | safety (6 shards 225–277 s) | 17 | **1** | 0 | 17.0 |
| identity | 76 | 0 | 3 | 4.6 | | danger | 27 | 0 | 0 | 5.6 |
| effective | 27 | 0 | 0 | 10.9 | | oversight | 29 | 0 | 0 | 4.2 |
| data | 61 | 0 | 0 | 11.6 | | sabotage | 21 | **3** | 0 | 16.2 |
| suites | 31 | 0 | 0 | 8.3 | | footholds | 35 | 0 | 0 | 12.4 |
| signals | 19 | 0 | 0 | 4.7 | | control | 30 | 0 | 0 | 9.4 |
| successor | 11 | 0 | 0 | 6.2 | | safetyideas | 29 | 0 | 0 | 3.3 |
| research | 30 | 0 | 0 | 18.9 | | finance (3 shards 168–184 s) | 62 | **4** | 0 | 45.6 |
| evals | 31 | 0 | 0 | 41.9 | | worldfx | 32 | **6** | 0 | 152.8 |
| safetyresearch | 30 | 0 | 0 | 25.5 | | ws4 | 25 | 0 | 0 | 219.6 |
| worktypes | 16 | 0 | 0 | 56.0 | | rivals | 16 | 0 | 0 | 38.2 |
| calib (4 shards 40–190 s) | 37 | **3** | 7 | 7.9 | | products | 58 | 0 | 0 | 9.1 |
| fixtures | 15 | 0 | 0 | 27.8 | | serving | 81 | **2** | 0 | 52.2 |
| hygiene (no perf) | 208 | 0 | 0 | 58.9 | | money | 24 | 0 | 0 | 39.8 |
| lint-hidden | 1 | 0 | 0 | 4.2 | | idle | 3 | 0 | 0 | 219.4 |
| lint-ux | 9 | 0 | 0 | 6.7 | | test:ui | 584 OK | 0 | – | 408.7 |
| lint-tradeoffs | 486 | 0 | 0 | 5.0 | | **total** | 2184 | 19 | | 11.2 min |

**Failures, split.**
- *Known (V3-TASKS list):* calib T1L authors2026 SIAR / ASI, fast ASI (→ F4); safety S5 RefBot "U falls below L by SAR"
  (median U − L +0.63, below in 35%; → E10 / F5); finance F7 revenue (median $27.9B) and valuation ($0.37T), F11 path
  (2027 $34.5B); worldfx F7/F11 2026 $32.3B, F11 2027 $50.2B, A2a 6.7%, W4 22.7%, W2 0.4%, GOV T1 2027-08-25 (window from
  2027-09-01; one of the single-seed timing checks, it passed in M4 on 2027-09-27).
- *Known by name but moved by M5:* **finance F8 RefBot out of distress through 2026: 41.7% of seeds (≥ 75%)**. F7/F8/F11
  are on the finance session's list, but F8 did not fail in M4's gate; revenue and valuation fell too ($30.7B → $27.9B,
  $0.52T → $0.37T). Not bisected (a base-commit run in a scratch worktree was not available here); likely D10's cheaper
  serving prices and F2's rivals. For the lead / finance session.
- *Caused by M5 and fixed (newly visible through the regenerated fixtures):* serving S3 day 400 / 900 (every provider
  "outside": the test rebuilt each offer at the default decode utilisation, but D10's providers serve at their own; the
  old rev-27 fixtures had every serving stack at 0, so it never showed; fixed: `ud: p.ud`, as mix.ts) and sabotage's
  zero-disposition and two steering checks (the new day-900 fixture carries RefBot's own covert record: 23 steering acts,
  5 caught; the checks count from a clean record; fixed: the test's fixture loader clears `ws2.covert.*` and footholds).
  Both re-run with `--only`: serving 83/0 (A5 ×10.39/yr), sabotage 24/0 (63a94cf).
- *Newly visible, hidden before:* none beyond the two above. The old && chain stopped at calib (T0), but M4's gate ran
  every script on its own, so no script was unseen at M4.
- *Moved for the better:* **safety S4 RefBot P_mis at ASI 0.553 passes** (band 0.55–0.85; M4 0.501; on the edge); S4
  safe-only 0.046 (M4 0.013; ≤ 0.25 passes; E13's P23 moves the safe bot, F5); finance F2 (46.6M) and F9 (6.8%) pass;
  worldfx U +1 pp 2027-11-07, HireRate_SOFT 2027-06-04, 25% remote work 2027-10-10, equity +31.6% pass; ws4 T3 mean 179 d,
  p10 57 / p90 308 d (INFO).
- Not run: `test:perf` (policy).

**Lead decisions (recorded, from the M5 decisions file).**
- F2: authors2026 T1L misses → F4; CHINA_CAL.effScale 1.5 accepted; ws4 T3 = the mean as the test, percentiles INFO
  (applied in this merge); leak writers into rivals' core.pa → F3.
- E7: steering as a hidden S4 cost accepted.
- E8: RefBot never investigates footholds → F5.
- E9: accepted; no pre-ASI in-lab loss of control (only the escape path acts earlier): a known gap.
- D9, D10, P3 accepted.
- E13 accepted (70e54e7, b8f23b9; no schema bump; RefBot unaffected; the safe bot's safety-suite score moved: 0.013 →
  0.046). F44's ×3 and AG17's science-team lift are still flat factors → new task E14 (M).
- E11 accepted (screenshots checked by the lead: day-900 Safety overview, day-400 product danger tip); its flags → E15;
  the control layer has no off switch → F6 (decide); the oversight row shows "3% gap 0.0" at day 900 → F6 (check).
- E15 accepted (8638feb): shared `safety/believedOversight.ts`; believed control readers are controlReadout, the UI and
  tests only; day 400 believed 0.853 → 0.861, day 900 0.739 → 0.744, true unchanged. It stores a different `believed` /
  versionId, so state hashes move: the fixtures were regenerated here anyway.
- choice.ts: one overflow guard (D10's, see above). Serving A5 re-checked: ×10.39/yr. schemaRev renumbered 27 → 32.
- calib T1L: the 8 failures on the M4 base were known → F2 / F4; 3 remain.
- After T0: the V3-TASKS protocol uses the tiers (task agents quick / cal / `--only`; full once per merge; perf on a
  quiet machine).

**Readouts for later tasks.** Fixtures are now rev 32 from the merged code: tests written against the old rev-16/27
fixtures may have assumed empty records (sabotage did) or zero serving stacks (serving S3 did). `umodes.ts sabOf` has no
reader left. The Safety › Overview side column now holds Control, Families and Successor (E11 + E12): F6 should look at
its length.

### F3 notes (one level map λ(G), the pm bridge Φ retired; 2026-11-20)

Branch `v3-f3` (from model-v3 9bf348d). **schemaRev 32 → 33.**

#### The one map
`models/capability.ts levelOfG(w, G)` (V3b's piecewise map through V0 L5, SC 10, SAR 12, SIAR 13.5, ASI 15) and its
inverse `gOfLevel`. Every lab's level is λ(G): player versions (finishBuild, refreshLevels, runs.ts), rivals, China and
the leader lab (rivalModel.ts setModelG, rivals.ts simpleModel), milestones, the true lead, theft, epilogue. `levelOf(w,
pm)`, `pmOfG`, `gOfPm`, `pmOfBuild`, `slopeL`, `bridgeQ`, `pmOfLevel`, `capIndexV2`, `paRef`, `syncPa`,
`syncRivalPa`, `absorbKnowHow`, `paOfGEquiv`, `paOfRecipe`, `knowHow`, `bestPm`, `truePm` are gone.

#### Readers replaced (pm/pa → G or λ(G))
- `ModelVersion.pm`, `SimpleModel.pm` → `.G` (required); `bestPm` → `labs.ts bestG`; `openWeightsFrontier` → `openWeightsG`.
- Lead conversions (rivals.ts leadBetween, intel.ts, epilogue, capability preHistoryLead, theft adoptG, actions C6,
  openWeightsReleased): G gap ÷ (v2 rate × B). The `rate` readouts stay in progress-years a year (BRIDGE(V7) tags).
- Start state: rivals, China, leader lab and follower V0 placed in G (gap × rate₀ × B); initialMilestones reads
  λ(G) ≥ the level knot (the milestones system's rule).
- RefBot's pacing gates (bots/ref.ts gateLevel): each v2 gate level converted once per world to a display level
  (v2's coordinate placed on G at B from V0); same opening days (T1 identical).
- Safety tier (safety/common.ts labLevel): λ(G(V0) + B·(pa₀ − pm(V0)) + the stacks' G-equivalent), exactly the old
  levelOf(player.pa). λ of the best model was the obvious G reading but moves the tiers by −1.2…+1.3 L (probe, seeds
  1–2, days 0–750: start 6.2 vs 5.0, day 600 8.8 vs 10.2) with S4 on its band edge, so it is left for the safety rebuild.
- Epilogue days to ASI: the λ = 15 point instead of v2's ASI threshold. Test-only: worldfx W2 freezes at λ = 6.5 (was v2's
  A1 pm threshold; W2 0.4% → 0.5%, now passes), ws4/control `atLevel` at the level knots.

#### Know-how writers → OOM on the recipe
`rivalModel.ts addRivalKnowledge(r, dG)` adds public knowledge to the pretraining part; the player's `addKnowledge`
now takes OOM. Every writer keeps its size (old progress-years × B): distillation of the player's deployments
(deployments.ts, G gap), China's secrets leak (theft.ts, recipe gap: stacksGEquiv − recipeOf), distillation of rivals'
public models, open-weights absorption, A4 publish (newly found writer), C4 tacit knowledge, C6 open weights, E1 Track-2,
E16 "Let go", safety spillover (SPILL_G = 0.02·B), knowledge diffusion. One timing change: a leak now enters the recipe the
day it happens (the bridge absorbed it at the next production step).

Theft at day 400 (RefBot, ai2027, seeds 1–3; before → after): secrets leak 0.00103 / 0 / 0 G/d (same), China's
distillation of the player 0.00049 / 0.00046 / 0.00042 G/d (same), of rivals 0.00003–0.00004 (same); China's recipe
0.72966 → 0.73125 (seed 1; = one day's leaks, the timing), 0.55531 → 0.55530, 0.62788 → 0.62834; after the theft China
G 28.98965 / 28.98980 / 28.99540 (same), lead 61.0 d (same); day 460 lead 60.3 → 60.2, 55.2, 111.6 d (same).

#### State and save
Removed: `ModelVersion.pm`, `SimpleModel.pm`, `LabCore.pa`, `RivalPhys.paSync`, `VersionBuild.paIn`,
`BaseModel/TrainingRun.paAtStart`, `stream.paTrack`, `KnowledgeState.openWeightsFrontier`. Migration 32 → 33
(`save.ts migratePmPa`, idempotent): pm → G through the old bridge (kept in save.ts only), a lab's unsynced core.pa −
paSync into its pretraining part (× B), fields dropped; the 26 → 27 and 29 → 30 steps read the legacy fields there.
Hygiene: new rev-32 → 33 check (G per model to 1e-9, an unsynced leak lands in the recipe, no old fields left) and its
idempotence; the older migration checks build their old saves through `asRev32`.

#### Lint
`lint-structure.ts` §4: no `.pm`, `pm:`, `.pa`/`.paSync`/`.paIn`/`.paAtStart`/`.paTrack`/`.openWeightsFrontier`, the
bridge's function names or `levelOf(` in code (comments, strings, regex literals stripped) under src/ and scripts/v2/,
except core/save.ts and hygiene.ts.

#### Left (with reason)
- Progress-year conversions with B_G_PER_Y remain for v2 data stated in progress-years (start gaps, leak sizes, the
  rate readouts) and in `alignedCalShift` / `gateLevel` (v2's threshold table, a calibration constant, not lab state).
- `playerStart` (pa₀, target) stays: the start-state solution's constants (start vintages, the tier offset above).
- ref-trace.ts compares a `recipe` series (OOM) instead of `pa`: stored traces need regenerating (not in a tier).

#### Tests
tsc main + scripts clean. test:quick: all ok except fixtures (stale, expected) and worldfx (baseline's F7/F11, GOV T1,
A2a, W4 fails unchanged; W2 now passes). test:cal identical to the baseline except T1L fast SIAR/ASI 897 → 896 (fast ASI
was failing before); T1 all presets identical. full rivals 16/0, ws4 25/0 (T3 mean 179 d, p10 57, p90 308, post-theft
61 × 8, as M5). test:ui 584/0 (build clean).

### E14 notes (F44 and AG17's lift as typed effects on the E2 safety labour; 2026-11-20)

Branch `v3-e14` (from `model-v3` 9bf348d). Data: `src/data/v2/safetyIdeas.ts` (`F44_AAR`, `AG17_HARNESS`). Engine:
`safety/ideas.ts` (`aarFindingOom`), `departments/workfit.ts` (`shiftFit`, `ag17Capacity`, `ag17HarnessOom`, added to
the safety package's fit in `safetyLabour`), `safety/lineProjects.ts` (`lineLabour` reads F44's per-line fit, `safSciOn`
its taste; `ag17Mult` and lineSpeed's ×3 removed). Text: tree.ts `aar` node, design/TECH-TREE.md AG17 row (its stale
"exceed 50%" cap). Test: `scripts/v2/safetyideas.ts` (8 new checks + the lint).

#### Effects

| what | old | new | size, source |
|---|---|---|---|
| F44 AARs mitigate well-characterized failures (`flag:aar`) | lineSpeed ×3 on AG18 / AG03 / AG16 whenever Trusted to AI > 0 | the safety model's SAF_EXP and SAF_IDEAS fit on those lines' work + 1 Δ_bm (the world's median-to-best gap, ai2027 2.2 OOM): coverage, assist, AI share and AI taste (+3.09 SD) on those lines | research/14 AG17 [V]: AARs beat the best of 28 humans on 7/7 benchmarked failures; general frontier ≈ median expert (GDPval, R20 E2). [D] "beats the best human" → + 1 Δ_bm (research/14's ×3–10 was itself [D]) |
| AG17 science teams | AI team-equivalents ×(1 + √(capacity ÷ SERIOUS_CAP)) on every line | a harness scaffold on the safety package: SAF_EXP / SAF_IDEAS fit + 0.3 OOM × √(min(2.5, capacity ÷ SERIOUS_CAP)) | [D] 0.3 at a serious programme = the Deep research scaffold / P27 harness size (R20 B3); √ = the lines' diminishing returns; direction research/14 AG17 ("multiplies the others"), Carlsmith 2025 [V] |

- [D] AG17's harness sits in `safetyLabour` (as P27's), so it also reaches cases, upkeep and P15's A, not only the lines.
- [D] F44 is per line (only `lineLabour` and `safSciOn`); the package's compute split over SAF_EXP / SAF_IDEAS is unchanged.
- The FALSE / SAFSAB interface is unchanged: `safetySabotage(s, lineLabour(s, agenda).aiShare)`; F44 raises the AI
  share on its lines (0.217 → 0.507 at day 400), so the sabotage exposure rises with the speed-up (the AG17 trap).
- Why not a copies effect for AG17: the old lift did nothing in v3 (day 400, t = 1: AI 604 team-eq vs 1 human; the
  coding CES saturates in AI input, m_exp 1.93 → 1.93 with a serious AG17 team). Coverage is the binding input.
- F44 can only fire after AG17 is funded (safety model L ≥ 10, ≈ between the day-400 and day-900 fixtures).

#### Before → after (ai2027 seed 2027 RefBot fixtures, Trusted to AI 1, package 20% of the safety pool)

Rates relative to no AI labour: ideation m_ideas^λ × taste × speed, experiments ℓ = m_exp^λ × speed (λ 0.5; the
experiment CES also has compute).

| day 400 | m_exp | m_ideas | ideation × | ℓ × |
|---|---|---|---|---|
| AG18 / AG16 F44 old (×3) | 1.93 | 1.12 | 3.18 | 4.17 |
| AG18 / AG16 F44 new | 7.21 | 1.97 | 2.27 (taste × 1.62) | 2.69 |
| AG03 F44 old / new | 1.84 → 5.86 | 1.11 → 1.92 | 3.17 → 2.24 | 4.06 → 2.42 |
| AG08 (any line) + serious AG17 team, old / new | 1.93 → 2.31 | 1.12 → 1.19 | 1.06 → 1.10 | 1.39 → 1.52 |

Day 900 (coverage 1 on AG18 / AG16): F44 old ×3 on both stages; new: ideation × 3.25 through taste, experiments × 1
(already fully covered, m_exp 1610). AG17 at day 900: ≈ 1 old and new (saturated). So F44 keeps its order of magnitude
(×2–3 mid-game, ×3 on ideas late) but now scales with t and the model, and carries the larger sabotage weight.

#### RefBot, tests

No bot sets Trusted to AI (test asserts it over src/engine/v2/bots), and both effects act only on work handed to AI, so
no bot run moves; golden dates cannot move; test:cal not run. tsc main + scripts clean; safetyideas 39/39, safetyresearch
30/30 (full tier); test:quick once at the end (see the report). schemaRev unchanged (no new state).

### E10 notes (safety rates vs research/20 F; 2026-11-20)

Branch `v3-e10` (from `v3-e14`). Harness: `scripts/v2/safetyrates.ts` (new; in run.ts's full tier, 4 prefill shards,
12 RefBot seeds + 40 probe worlds; `--seeds 40` replays exactly safety.ts's S4 games). Code: `src/engine/v2/safety/traits.ts`
(named constants `OC_VIS`, `OC_VIS_AUDIT`, `OC_DETECT_TRAIN`, `ANTISCHEME_REMOVAL`, `ANTISCHEME_EA_MULT`; E06's fallback
reads the edge table), `safety/responses.ts` (targeted anti-scheming training reads the same two E25 constants),
`src/data/v2/edges.ts` (E06, E11 w̄; E25 note), texts in `data/v2/tree.ts` (T-ANTISCHEME card), `data/v2/runDesign.ts`
(comment), `safety/actions.ts` (Respond preview). No state type changed: no schemaRev bump. The hidden edge weights of a
new world change (E06, E11 w̄), so the committed fixtures are stale (fixtures --write was out of scope: the merge does it).

#### How the observables are read

Source model → game point: METR o3, MacDiarmid (Claude Sonnet 3.7/4 era), Schoen (o3, o4-mini) and Sonnet 4.5 are 2025
frontier models = the leader's start model V0 (ai2027, mid-2025, RSCH 4.5); "late-2026 frontier" = RefBot's internal
model at game date 2026-12-31; Hubinger's largest sleeper agents = a frontier model. Trait values of awareness and
disposition traits are read as rates (the convention of TRAIT_START: EA 0.15 ↔ verbalised 11.7%).

- **Probes** (no game; 40 medium worlds, each with its own edge weights and difficulty): one post-training run on V0
  through the engine's own step (`playerEnv` + `stepTraits`: true weights, moderators, safety-training removal,
  detection, AG18 healing). Learned-hacking model organism = the reference run on SWE environments with cheap graders
  (h = 45%, S2 saturated) vs the same run with hacking prevented (exploitability 0) vs inoculated. Sabotage = SAFSAB's
  attempt probability (`itemTerms`, all of an 8-hour task done by the model, before oversight: MacDiarmid measured
  attempts). Capability RL = the reference run at ρ_ref vs 10 ρ_ref. Anti-scheming = a SCHEME 0.13 model (o3's 13%)
  with vs without T-ANTISCHEME. Persistence π = 1 − the run's removal fraction of the trait.
- **Reference runs**: RefBot, ai2027, medium, endings skipped, to the player's ASI (safety.ts's loop); every new version's
  hack rates (`hackRates` on its frozen RL weights, ρ = RL FLOP ÷ base FLOP), traits, π of SCHEME through its own safety
  training, and P_mis at ASI.

#### Table (40 RefBot seeds 500–539 = S4's games, 40 probe worlds; median [p10–p90]; before = v3-e14, after = E10)

| observable | source (uncertainty) | before | after | in band |
|---|---|---|---|---|
| F1 hack rate, typical agentic families (hardened, leader start) | METR o3 HCAST 0.7% (8/1,087, CI 0.3–1.4%); GPT-5 ~2% → 0.3–2% | 1.0% | 1.0% | yes |
| F1 hack rate, exploitable optimisation scorers (ML research, cheap) | METR o3 RE-Bench 30.4% (39/128, CI 23–39%) | 30.0% | 30.0% | yes |
| F1 hack rate, SWE scaffolds (cheap) | Rust codecontest 43%, LLM Foundry 100% → 25–100% | 45% | 45% | yes |
| F1 RefBot RL-weighted hack rate per post run | no cross-generation source | 6.5% (every run) | 6.5% | INFO |
| F1 RefBot runs above the 5% "learned hacking" line | research/20 F2 [G] | 100% | 100% | INFO (nothing reads it) |
| F2 sabotage attempts after learned hacking (MO) | MacDiarmid 2025: 12% (one setting, ±50% [D]) | 0.2% [0.1–2.1] | 0.2% [0.1–2.1] | **no: mechanism** |
| F2 sabotage, hacking prevented | ≈ 0 → < 1% | 0.1% | 0.1% | yes |
| F2 AF after learned hacking (MO) | MacDiarmid: 50% AF reasoning ([D] 30–70%) | 14.9% [8.6–44.5] | 15.7% [9.2–45.2] | **no: mechanism** |
| F2 AF, hacking prevented (one reference run from V0) | Sheshadri 2025: rare → ≤ 12% | 12.3% | 13.1% | **no: mechanism (S7)** |
| F2 inoculation: cut in the hack-induced PERSONA rise | MacDiarmid −75–90%, "close to the no-hack baseline" | 103% | 103% | yes |
| F2 inoculation: cut in the hack-induced Mis rise | same | 62.8% [39–80] | 63.0% [40–80] | **no: mechanism** |
| F2 inoculation: cut in the hack-induced AF rise | same | 70.5% | 70.5% | **no: mechanism** |
| F5 EA, start model | verbalised 10–30% (2025); Sonnet 4.5 13%; Apollo 11.7% | 15.0% | 15.0% | yes |
| F5 EA, RefBot internal model 2026-12-31 | late-2026 frontier 20–50% (Astra 41–51%) | 53.2% [38–84] | 51.9% [36–86] | edge (WARN) |
| F5 EA, RefBot model at ASI | none | 69.9% | 72.1% | INFO |
| F5 AF, RefBot internal model 2026-12-31 | research/05 §1.4: 0–15% compliance gap | 40.5% [18–84] | 53.3% [28–91] | **no: mechanism (S7)** |
| F5 AF, RefBot model at ASI | none | 63.4% | 75.9% | INFO |
| F5 EA rise per OOM of capability RL | Schoen [R] 2% → 20.6% over ~1–3 OOM = 0.06–0.19/OOM | 0.175 [0.135–0.288] | 0.141 [0.109–0.221] | yes (was at the top) |
| F5 anti-scheming: EA multiplier | Schoen: o3 ×2.0, o4-mini ×6.1 | ×1.5 | ×2.0 | yes (was no) |
| F5 anti-scheming: cut in covert actions | Schoen: −97% (13 → 0.4%, 8.7 → 0.3%) → 90–98% | 81.6% | 92.3% | yes (was no) |
| F6 π SCHEME, one standard run, start model | Hubinger [R] "failed to remove"; research/20 F6 [G] 0.3 small / 0.9+ frontier → [D] ≥ 0.8 | 46.8% | 71.1% | no (WARN) |
| F6 π SCHEME, safety training alone (no AG18 healing) | same | 52.5% | 80.3% | yes (was no) |
| F6 π AF / SAND, start model | same | 47.6% / 47.2% | 71.7% / 71.4% | no (WARN) |
| F6 π SCHEME at frontier EA 0.5 | same | 49.7% | 72.8% | no (WARN) |
| F6 RefBot π SCHEME per post run (no anti-scheming) | same | 54.0% | 76.2% | no (WARN) |
| F3 subliminal transfer per distillation (share of the teacher gap) | Cloud 2025 (owl 12% → 60%, ≈ half); research/20 [G] 0.2–0.5 | 12.5% | 31.2% [18–54] | yes (was no) |
| S4 RefBot P_mis at ASI (mean, 40 seeds) | S4 band 0.55–0.85 | 0.553 | 0.625 | yes, margin +0.075 |

#### Constants changed (old → new; source and range)

1. **`OC_VIS`** (share of an oversight-conditional trait AF/SCHEME/SAND that ordinary safety training sees) 0.4 → 0.1,
   **`OC_VIS_AUDIT`** (heavy safety with AG02 audits) 0.6 → 0.15 (×1.5 kept). Source: Hubinger 2024 [R] / research/20 F6
   (backdoors persist through SFT, RL, adversarial training; π 0.3 small, 0.9+ frontier-deceptive). Value [D] solved so
   safety training alone keeps ≥ 0.8 at the start model (0.80).
2. **`OC_DETECT_TRAIN`** (new name for the M4 detection term's weight on oversight-conditional traits; implicit 1 before)
   1 → 0.375. Source: R14 E24 [A] (retrain against a detector: visible −70–90%, true −20–40% → 0.3/0.8) and Hubinger
   (adversarial training hides the trigger). Other traits keep 1.
3. **`ANTISCHEME_REMOVAL`** (E25 SCHEME removal per anti-scheming / heavy run, also targeted training) 0.9 → 0.95.
   Source: Schoen 2025 −97% (two models); band 90–98% → 92.3%.
4. **`ANTISCHEME_EA_MULT`** (E25 one-time EA multiplier) 1.5 → 2. Source: Schoen 2025 o3 ×2.0 (o4-mini ×6.1); the lower
   value. Sensitive: it lowers S5's mixed-bot margin through believed EA (median −0.08 at ×2 vs +0.31 at ×1.5 with
   OC_VIS 0.1; with OC_VIS 0.2 ×2 gave −0.57 and failed S5 — so OC_VIS 0.1 and ×2 go together).
5. **E11 w̄** (S7 → EA) 0.3 → 0.2 (world range ×½–2: 0.1–0.4). Source: Schoen [R] capability-only RL 2% → 20.6% over
   ~1–3 OOM. The old cite ("anti-scheming doubled EA") was E25's evidence; the cite now names Schoen.
6. **E06 w̄** (teacher → student, same base family) 0.3 → 0.75 (world range 0.375–1.5 → transfer 0.15–0.6 per
   distillation). Source: Cloud 2025 (owl 12% → 60%+ ≈ half the gap; misaligned teacher → ~10% vs < 1%); research/20
   F3 [G] 0.2–0.5.

Tried and not kept: lower E14 (S7 → AF) to bring RefBot's AF into 0–15% — it contradicts E14's own anchor (MATS/GDM
2026: monitored-only reward takes the gap 1–18% → 43–95%, i.e. w ≈ 0.6–1 at S7 = 1) and only hides the S7 conflation
below; a lower EA_RELAX target — not needed once E11 moved.

#### S4 and S5 (safety.ts full run, the final code)

- **S4 RefBot P_mis at ASI 0.625** (M5 0.553; band 0.55–0.85; Mis mean 0.488, range 0.12–0.90). Safe-only 0.083 (M5
  0.011; bound ≤ 0.25): heavy safety and audits now remove less hidden misalignment.
- **S5 RefBot "U falls below L by SAR"**: median U − L at SAR **+0.50**, below in 35% (M5 +0.63): still the known
  failure. The calibrated rates do not move its cause: U comes from the detection stack on believed traits, and RefBot's
  U rises with its safety lines' speed (compute since E1) while no bot hands safety work to AI (F5). The only E10 lever
  on U is believed eval awareness (E25's ×2 lowers it a little); forcing S5 through EA would break the mixed bot.
- **S5 mixed** median min margin **−0.08**, holds in 55% (passes; ≥ −0.5).

#### Golden dates (test:cal)

T1 identical to M5 on every preset: ai2027 SC 647 / SAR 804 / SIAR 893 / ASI 922 (Δ +0.025 / +0.036 / +0.027 / +0.019 y);
authors2026 1506 / 1607 / 2144 / 2956 (+0.030 / +0.093 / −0.019 / −0.052); fast 897 / 918 / 918 / 918 (+0.047 / +0.104 /
−0.019 / −0.104); slow SC 4776 (+0.049). T4 passes. T1L: the three known failures only, unchanged (authors2026 SIAR
−0.611 y, ASI −1.337 y, fast ASI −0.162 y → F4). golden-timelines passes (known WARNs).

#### Tests

tsc main + scripts clean. `run.ts --tier full --only safety,signals,danger,sabotage,safetyideas,safetyrates`: signals
19/0, danger 27/0, sabotage 24/0, safetyideas 39/0, safetyrates 11 pass / 0 fail / 12 WARN (the gaps below), safety 17/1
(S5 RefBot, known). test:quick: known failures only (worldfx F7/F11, GOV T1, A2a, W4, W2) plus **fixtures stale** (5
fixtures: new worlds' E06/E11 weights; regenerate at the merge). test:cal: T1L known three.

#### Gaps (for the lead)

- **Learned hacking → sabotage and alignment faking (MacDiarmid) needs a mechanism.** The MO hacks (RH 0.15 → 0.73) and
  its persona rises (0.08 → 0.31), but AF reaches 16% (50%) and SAFSAB attempts 0.2% (12%). MacDiarmid's jump is
  non-linear (onset at > 2% hacked episodes; misalignment ≈ 0 → 0.45–0.5), while every RefBot run already hacks 18% of
  hardened SWE tasks: linear RH → PERSONA → AF/SCHEME edges strong enough for the MO would make every reference lineage
  MacDiarmid-misaligned. And E7's per-item κ anchor puts the 12% at SAND + SCHEME = 1, which no single run produces.
  Options: research/20 F2's discrete "learned hacking" draw (or a convex driver on E04/E27/E28 above an onset), and
  re-anchoring κ_item on that model organism.
- **AF from S7 (E14) needs S7 split.** S7 is mostly capability RL and eval-like data (the EA anchor, Schoen) but E14 reads
  it as monitored-only reward (MATS/GDM): one reference run lifts AF 0.03 → 0.13, RefBot's lineage sits at 53% by end
  2026 (0–15% observed compliance gaps; "AF reasoning in 10–80% of conflict episodes" is the other reading). A split
  into eval-likeness (→ EA) and oversight-conditional reward (→ AF) would let both anchors hold. E10's F6 change raised
  RefBot's AF (40.5% → 53.3%) because less of it is trained out.
- **Inoculation reaches only E04.** The PERSONA rise is fully cut (103%), but the hack-induced S2 → PROXY (E09) → AF
  (E13) / SCHEME (E19) path is not inoculated, so Mis is cut 63% (75–90%).
- **F6 with healing**: π is 0.71 with AG18's healing (the world's hidden benign-generalisation bet, M4) on top of safety
  training; reaching 0.8 would need a lower HEAL_K or a detection weight below E24's ratio, both design bets.
- **EA at end 2026** is at the band edge (51.9% vs ≤ 50%): the ai2027 leader is at SC by October 2026, ahead of the real
  late-2026 frontier, so a date mapping overstates the target's capability.
- **No game observable**: Betley's narrow fine-tune emergent misalignment (S6_POST is a constant 0.1, no fine-tune
  quantity), Greenblatt's AF 12% → 78% under RL toward a conflicting objective (no such training choice), F1 across
  generations (no source; GPT-5 ≈ o3), and the F2 "learned hacking" threshold (hackRates is a readout nobody reads).
- **Thin sources**: MacDiarmid's inoculation % is chart-read; Schoen's "~2 OOM" of RL is research/20's guess; Hubinger's
  persistence numbers are [R] (no figures in research/); the F6 band (≥ 0.8) is [D] between research/20's 0.3 and 0.9+.

### M6 merge notes (F3, E14 → E10 onto M5; 2026-11-20)

Merged into `model-v3` (at the lead's 9bf348d) with `--no-ff`, in order: `v3-f3` (F3 8c41677, base 9bf348d; merge
849dfcf), `v3-e10` (one chain from 9bf348d: E14 aafe348, E10 9294eb3; only the tip merged; 4abb5d9). Then fixtures
regenerated (35609d5) and these docs. Checks: tsc main and `-p scripts/v2` plus lint-structure after each merge,
`test:quick` once, `test:cal` once, fixtures `--write` once, one `test:full` on 35609d5 (the final code; only docs after).
The notes of the three tasks are above (copies of `design/notes/F3.md`, `E14.md`, `E10.md`, deleted after folding).

**Conflicts and resolution.** No textual conflicts. F3 was based on 9bf348d (a fast-forward base). v3-e10 auto-merged
`safety/traits.ts` (F3's `labLevel(s)` tier reads beside E10's named constants `OC_VIS`, `OC_VIS_AUDIT`,
`OC_DETECT_TRAIN`, `ANTISCHEME_REMOVAL`, `ANTISCHEME_EA_MULT`; separate hunks), `departments/workfit.ts` (F3's `G`-typed
`domainG` / `fitOf` / `workFit` with E14's `shiftFit`, `ag17Capacity`, `ag17HarnessOom`; the `gOfPm` import is gone
with F3) and `data/v2/runDesign.ts` (F3's B_G_PER_Y comment, E10's heavy-safety comment). F3 rewrote
`actors/actions.ts`, E10 `safety/actions.ts`: different files; E10 / E14 did not touch `safety/common.ts` or
`findings.ts`. **Semantic check:** E10 and E14 add no reader of `.pm`, `.pa`, `levelOf(` or the bridge's functions
(lint-structure §4 passes, 8/0; `safetyrates.ts` reads traits and `hackRates` only); both tsc projects clean after each
merge. Nothing had to be rewritten to G / `levelOfG`.

**schemaRev 32 → 33** (F3 `migratePmPa`: pm → G through the old bridge kept in save.ts only, an unsynced core.pa − paSync
into the pretraining recipe × B, the old fields dropped; idempotent; hygiene's new rev-32 → 33 check and its idempotence
pass, the older migration checks build their saves through `asRev32`). E14 and E10 add no state. **Fixtures:** stale
after the merges (fixtures FAIL ×5 in test:quick, as expected: E10's new worlds draw different E06 / E11 weights, F3
drops fields), regenerated once on the merged code at rev 33 (35609d5). golden/timelines.json unchanged.

**Golden dates (`test:cal`, seed 2027): no refit.** T1 identical to M5 on every preset: ai2027 SC 647 / SAR 804 / SIAR
893 / ASI 922 (Δ +0.025 / +0.036 / +0.027 / +0.019 y); authors2026 1506 / 1607 / 2144 / 2956 (+0.030 / +0.093 / −0.019 /
−0.052); fast 897 / 918 / 918 / 918 (+0.047 / +0.104 / −0.019 / −0.104); slow SC 4776 (+0.049). T4 passes. T1L: the three
known failures (authors2026 SIAR −0.611 y, ASI −1.337 y; fast ASI −0.164 y, M5 −0.162: F3's leak timing moves the fast
leader's SIAR / ASI one day, 897 → 896). golden-timelines 16/0 (known WARNs).

**Gate: one `npm run test:full` on 35609d5.** Wall 11.9 min (real 11 m 58 s), CPU 76.2 min, machine load 83% (12 cores,
6 workers), simulation cache cold for the long suites. `test:quick` before it: 2.3 min, failures only fixtures (stale,
then regenerated) and worldfx's known five. `test:cal`: 1.0 min.

| script | pass | fail | warn | wall s | | script | pass | fail | warn | wall s |
|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|
| tsc-scripts | – | 0 | – | 2.3 | | lint-structure | 8 | 0 | 0 | 4.9 |
| golden-timelines | 16 | 0 | 3 | 8.3 | | safety (6 shards 254–285 s) | 17 | **1** | 0 | 14.8 |
| identity | 76 | 0 | 3 | 4.6 | | danger | 27 | 0 | 0 | 4.9 |
| effective | 27 | 0 | 0 | 10.1 | | oversight | 29 | 0 | 0 | 3.7 |
| data | 61 | 0 | 0 | 9.1 | | sabotage | 24 | 0 | 0 | 8.0 |
| suites | 31 | 0 | 0 | 7.4 | | footholds | 35 | 0 | 0 | 9.6 |
| signals | 19 | 0 | 0 | 4.6 | | control | 30 | 0 | 0 | 8.4 |
| successor | 11 | 0 | 0 | 5.2 | | safetyideas | 39 | 0 | 0 | 3.4 |
| research | 30 | 0 | 0 | 15.8 | | safetyrates (new; 4 shards 44–49 s) | 11 | 0 | 12 | 5.9 |
| evals | 31 | 0 | 0 | 46.8 | | finance (3 shards 141–160 s) | 62 | **4** | 0 | 58.6 |
| safetyresearch | 30 | 0 | 0 | 25.3 | | worldfx | 33 | **5** | 0 | 152.3 |
| worktypes | 16 | 0 | 0 | 49.7 | | ws4 | 25 | 0 | 0 | 230.5 |
| calib (4 shards 44–184 s) | 37 | **3** | 7 | 6.3 | | rivals | 16 | 0 | 0 | 38.1 |
| fixtures | 15 | 0 | 0 | 28.1 | | products | 58 | 0 | 0 | 8.8 |
| hygiene (no perf) | 210 | 0 | 0 | 72.7 | | serving | 83 | 0 | 0 | 49.6 |
| lint-hidden | 1 | 0 | 0 | 4.3 | | money | 24 | 0 | 0 | 35.8 |
| lint-ux | 9 | 0 | 0 | 5.9 | | idle | 3 | 0 | 0 | 233.9 |
| lint-tradeoffs | 486 | 0 | 0 | 5.0 | | test:ui | 584 OK | 0 | – | 423.7 |
| | | | | | | **total** | 2214 | 13 | | 11.9 min |

**Failures, split.** All 13 are on the known list; none caused by M6.
- *Known:* calib T1L authors2026 SIAR / ASI, fast ASI (→ F4); safety S5 RefBot "U falls below L by SAR" (median U − L
  +0.50, below in 35%; M5 +0.63; → F5); finance F7 revenue (median $27.9B) and valuation ($0.36T), F8 RefBot out of
  distress through 2026 41.7% (as M5; → F5 / finance session), F11 path (2027 $31.6B; M5 $34.5B); worldfx F7/F11 2026
  $32.3B, F11 2027 $50.2B, A2a 6.7%, W4 22.7%, GOV T1 2027-08-25 (single-seed timing, → F4).
- *Caused by M6:* none. *Newly visible:* none.
- *Moved for the better:* worldfx W2 automation TFP 0.5% passes (F3: W2 freezes at λ = 6.5 instead of v2's A1 pm
  threshold); the M5 test fixes hold (serving S3 0 outside, sabotage 24/0).
- *Moved, still passing:* **safety S4 RefBot P_mis at ASI 0.600** (E10's branch 0.625, M5 0.553; band 0.55–0.85, margin
  +0.05: F3's leak timing changes RefBot's games a little); S4 safe-only 0.078 (E10 0.083); S5 mixed median min margin
  −0.11, holds in 55% (E10 −0.08; needs ≥ −0.5). safetyrates on the merged code: F5 EA end 2026 51.5% (E10 51.9%), F5 AF
  end 2026 48.0% (53.3%), F6 RefBot π SCHEME 74.3% (76.2%), F2 rows as E10's (sabotage after learned hacking 0.2%, AF
  15.7%); its 12 WARNs are E10's gaps (→ E16, E17). Serving A5 ×10.40/yr, A3 ×17.49/yr per task; finance F2 46.6M, F9
  pass; worldfx equity +31.6%, HireRate_SOFT 2027-06-04, 25% remote work 2027-10-10, U +1 pp 2027-11-07 pass; ws4 T3 mean
  179 d (p10 57, p90 308 INFO), post-theft 61 d.
- Not run: `test:perf` (policy); `ref-trace.ts` (not in a tier; its stored traces are stale since F3 → F6).

**Lead decisions (recorded, from the M6 decisions file).**
- E14 accepted (aafe348; scripts tsc verified by the lead): F44 → +1 Δ_bm fit on the AG18 / AG03 / AG16 lines (AI share
  0.22 → 0.51, so more sabotage exposure); AG17 → harness +0.3 OOM × √(min(2.5, cap ÷ SERIOUS_CAP)) on the safety
  package fit. No bot sets Trusted to AI (check added), so golden dates cannot move. worldfx: the known failures.
- F3 accepted (8c41677; schema 32 → 33 `migratePmPa`): `levelOfG` / `gOfLevel` the one map; pm / pa state removed; lint
  section 4. T1 identical; W2 passes (0.5%). Left: the safety tier `labLevel` keeps the old pa-equivalent value written in
  G (switching to the best model's level moves the tier −1.2…+1.3 levels with S4 on its edge) → new task E18. ref-trace.ts
  stored traces need regenerating (not in a tier) → F6.
- E10 accepted (9294eb3; harness `scripts/v2/safetyrates.ts` in the full tier; constants OC_VIS 0.4 → 0.1, OC_VIS_AUDIT
  0.6 → 0.15, OC_DETECT_TRAIN 1 → 0.375, ANTISCHEME_REMOVAL 0.9 → 0.95, ANTISCHEME_EA_MULT 1.5 → 2, E11 w̄ 0.3 → 0.2, E06
  w̄ 0.3 → 0.75). S4 0.625 on its branch (margin); S5 RefBot still known. Fixtures stale → regenerated here. T1 identical.
- E10's gaps are real model errors (AF at end 2026 53% vs 0–15%; sabotage after learned hacking 0.2% vs 12%) → new tasks
  before F5 / F4: **E16** (H) learned-hacking generalisation (a discrete "learned hacking" state or a convex driver above
  an onset, research/20 F2; κ_item (E7) re-anchored on the MacDiarmid model organism, 12% sabotage, 30–70% AF;
  inoculation also covers hack → PROXY (E09 → E13 / E19); `hackRates` becomes read); **E17** (H) split S7 into
  eval-awareness and alignment-faking parts so F5 EA (20–50%) and AF (0–15%) at end 2026 both hold, F6 persistence with
  AG18 healing (0.71 vs ≥ 0.8) checked (after E16: same files); **E18** (M) the safety tier `labLevel` from the best
  model's display level, S4 recalibrated if it moves (after E17).
- Order change: F4 fits per-preset values to RefBot's golden dates, so it follows F5's RefBot rebalance and F6's engine
  fixes; new order **M6 → E16 ∥ F6 → E17 → E18 → F5 → M7 → F4 → merge to master**.
- User (2026-11-20): F7 authorised: when F4 passes, the lead merges model-v3 into master (the main checkout is shared:
  check it is clean and idle first; the untracked design/ux/mockups files belong to another session). The lead does not
  rebase the finance branch; the user handles the finance session.
- After M5 (recorded in V3-TASKS at 9bf348d and the decisions file): finance F8 → F5 (not bisected); S4 edge → E10 (now
  0.600); T1L authors2026 and the fast G_SC knife edge → F4; the Safety › Overview side column is long → F6.

**Readouts for later tasks.** Fixtures are rev 33 from the merged code. S4's margin is +0.05 on the merged head (0.600):
E16–E18 move it. `safetyrates.ts` is the safety calibration harness (full tier; `--seeds 40` replays safety.ts's S4
games) and carries E10's 12 WARN rows as the E16 / E17 targets.

### E16 notes (learned-hacking generalisation; 2026-11-20)

Branch `v3-e16` (from `model-v3` 7983b97, after M6). Row: MacDiarmid's model organism read 0.2% sabotage (12%) and 16%
AF (30–70%) in E10's harness; a linear edge strong enough for it made every RefBot lineage misaligned, because every
RefBot run hacks 18% of its hardened coding tasks. Code: `src/engine/v2/safety/traits.ts` (learned hacking: `LH_ONSET`,
`LH_FULL`, `K_LH`, `INOC_MULT`, `hackShare`, `learnedHackingOf`, `postHack`, `runHack`; `TraitEnv.lh` / `hackGen`; the
E04, E09, E18, E27, E28 drivers; `applyRunToTraits`, `applyStreamDay`, `applyIdaCycle`, `predictBeliefs`),
`core/selectors.ts` (`runTraitPressure` predicts with the planned run's λ), `src/data/v2/danger.ts` (`COVERT_ANCHOR_X`,
κ_item), `data/v2/edges.ts` (moderator texts), `data/v2/glossary.ts` (`learnedHacking`, `inoculation`),
`data/v2/tree.ts` (T-INOC card), `safety/pressureView.ts` + `ui/v2/panels/Pressure.tsx` (the readout). Tests:
`scripts/v2/safetyrates.ts` (λ by recipe, RefBot onset rows, F2 rows now banded checks), `scripts/v2/sabotage.ts`
(anchor and steering checks). **No state changed: no schemaRev bump** (λ is a function of the run's frozen suites, RL
shares and ρ, computed when the run completes).

#### Mechanism

Source: MacDiarmid et al. 2025 [P] (Anthropic's write-up of arXiv 2511.18397, fetched this session; the arXiv HTML fetch
failed): the hack rate stays near 0 until about step 65, then rises to ≈ 0.9 by step 100 and holds at 0.6–1.0; "at the
exact point when the model learns to reward hack, we see a sharp increase in all our misalignment evaluations"
(malign-generalisation score < 0.1 → 0.45–0.5; the no-hack baseline ≈ 0); 12% sabotage; 50% AF reasoning; inoculation
(explicit prompt) 0.115 → 0.02 with the model still hacking "to the exact same degree". Generalisation follows hacking
becoming the learned policy; 2025 frontier models that hack a few per cent of their RL (METR o3 HCAST 0.7%, RE-Bench
30%) are not MacDiarmid-misaligned (research/05 §1.8).

    h = Σ_f w_f · h_f                     the run's RL-weighted hack rate (hackRates, now read): share of RL episodes hacked
    λ = clamp01((h − 0.10) / (0.45 − 0.10))²          learned hacking, 0 below the onset, 1 = the model organism
    drivers: E04 (RH → PERSONA) RH + K_LH·λ; E27 (→ AF), E28 (→ SCHEME) PERSONA + g·K_LH·λ; E18 (→ SAND) (EA + TGAME)/2 + g·K_LH·λ
    inoculation g = 0.15 on the λ terms and on the S2 half of E09 ((g·S2 + S3)/2 → PROXY → AF via E13, SCHEME via E19);
    E04's own inoculation moderator × 0.15 as before (now INOC_MULT). The hack rate itself (E02, RH) is not inoculated.

- **LH_ONSET 0.10 [D]**: above the leader's start recipe (broad RL, hardened start suites, standard budget: 6.5% = every
  RefBot run) so hardened labs get none, like the 2025 frontier; below one exploitable family's rate (RE-Bench 30%).
  research/20 F2's [G] rule ("h > ~5% on any family") is not used: every RefBot run crosses it on coding (18%).
- **LH_FULL 0.45 [D]**: MacDiarmid's post-onset 0.6–1.0 exceeds the game's worst suite; all RL on cheap-grader coding at
  the standard budget (45%, E10's model-organism probe) is the full effect.
- **Square above the onset [D]**: "convex above an onset" (the row); a lab with modest hack rates gets little.
- **K_LH 1.3 [fit]**: the organism's AF median 48% (MacDiarmid 50%, band 30–70%; 1.5 gave 56%).
- **E18 carries it [D, sourced]**: MacDiarmid's sabotage was a deliberately weakened reward-hacking classifier, i.e.
  sandbagged safety work, and SAFSAB reads SAND + SCHEME. Without it the organism's x was 0.26 and κ would rise ×7.7,
  putting the no-hack control at 1.2% (band < 1%).
- **INOC_MULT 0.15 [P]**: unchanged value, now one named constant for every hack-induced path.
- Rivals and China keep λ = 0 (their signals come from posture, with no family mix): a gap for E17.

λ by recipe at the start (safetyrates INFO): reference 6.5% → 0; broad hardened heavy RL 8.5% → 0; coding focus
hardened heavy 18.1% → 0.05; broad cheap graders (the spinout's start) 16.3% → 0.03; broad cheap heavy 21.2% → 0.10;
coding focus cheap 34.7% → 0.50; coding focus cheap heavy 45.1% → 1.

#### κ_item re-anchored on the organism

E7 put MacDiarmid's 12% at x = SAND + SCHEME = 1, which no run produces. Now `COVERT_ANCHOR_X = 0.37` [fit] = the
organism's median SAND + SCHEME (40 medium worlds): κ_item = 0.12 ÷ (0.37^1.5 · σ(−0.5) · 0.8) **0.395 → 1.77** (×4.5).
It is shared by SAFSAB, STEER and SUCCSTEER (one formula, as in E7). Consequences: the model organism attempts 11.9%;
the no-hack control 0.7%; sabotage.ts's S6-style lab (t 1, sab 0.8) gives 14.9% FALSE results (E7: 3.1%); the steering
test now uses x = 0.4 (at x = 1 the summed per-part rate exceeds 1). RefBot's STEER and SUCCSTEER attempts rise ×4.5, but
P_mis is unmoved: 12-seed mean 0.516 with the old κ vs 0.517 with the new (same code otherwise; RefBot never crosses the
onset and hands no safety work to AI).

#### Readout (hidden-truth rules)

The Pressure panel's S2 tooltip (Blueprint for the planned run, model card for a finished one) shows "Episodes hacked"
(h, with the onset and full points) and "Learned hacking" λ (× 0.15 when inoculated); the S2 cause line adds "learned
hacking 0.50" when λ > 0. Both are the player's own run quantities (suite exploitability is already shown); the edge
weights that decide how far it generalises stay hidden. Glossary `learnedHacking` is new; `inoculation` and the T-INOC
card name all three cut paths. The run card's predicted trait pressure (`runTraitPressure`) and the version's predicted
beliefs include λ (previews match effects).

#### Table (safetyrates, full tier: 12 RefBot seeds, 40 probe worlds; median [p10–p90]; before = E10's table)

| observable | source | before (E10) | after (E16) | in band |
|---|---|---|---|---|
| F1 hack rate, typical agentic families (hardened, start) | METR o3 HCAST 0.7% → 0.3–2% | 1.0% | 1.0% | yes |
| F1 hack rate, ML research cheap | RE-Bench 30.4% | 30.0% | 30.0% | yes |
| F1 hack rate, SWE cheap | 25–100% | 45% | 45% | yes |
| F1 RefBot RL-weighted hack rate per post run | none | 6.5% | 6.5% | INFO |
| F1 RefBot runs above the learned-hacking line | E10: 5% on any family; E16: h > 10% | 100% | **0%** | INFO (now read) |
| F1 RefBot λ per post run | – | – | 0 | INFO |
| F2 sabotage after learned hacking (MO) | MacDiarmid 12% → 6–20% | 0.2% | **11.9%** [4.6–53.7] | **yes** (was no) |
| F2 sabotage, hacking prevented | < 1% | 0.1% | 0.7% | yes |
| F2 AF after learned hacking (MO) | 50% → 30–70% | 15.7% | **48.2%** [26–100] | **yes** (was no) |
| F2 AF, hacking prevented | ≤ 12% | 13.1% | 13.1% | no (S7 → E17) |
| F2 inoculation: cut in PERSONA rise | −75–90% (> 100% ok) | 103% | 88.7% | yes |
| F2 inoculation: cut in Mis rise | −75–90% | 63.0% | **84.6%** | **yes** (was no) |
| F2 inoculation: cut in AF rise | −75–90% | 70.5% | **85.7%** | **yes** (was no) |
| F2 inoculation: cut in sabotage rise | same | noisy, INFO | 90.7% | yes (now banded 75–95%) |
| F5 EA start / end 2026 / ASI | 10–30% / 20–50% | 15.0 / 51.9 / 72.1% | 15.0 / 51.5 / 69.3% | yes / edge / INFO |
| F5 AF end 2026 / ASI | 0–15% | 53.3 / 75.9% | 48.0 / 72.1% | no (S7) / INFO |
| F5 EA per OOM RL, anti-scheming EA ×, covert cut | | 0.141, ×2.0, 92.3% | same | yes |
| F6 π SCHEME (std / no healing / AF / SAND / EA .5 / RefBot) | ≥ 0.8 [D] | 71.1 / 80.3 / 71.7 / 71.4 / 72.8 / 76.2% | 71.1 / 80.3 / 71.7 / 71.4 / 72.8 / 74.3% | as before |
| F3 subliminal transfer | 0.2–0.5 | 31.2% | 31.2% | yes |

safetyrates: 16 pass / 0 fail / 8 WARN (E10: 11 / 0 / 12). The E10 "before" F5/F6 RefBot rows were on E10's code; M6
(F3) moved RefBot's games a little. Probe world 1 (a strongly generalising world): hack RH 0.73, PERSONA 0.76, AF 0.90,
SCHEME 0.59, SAND 0.44; inoculated PERSONA 0.16, AF 0.28, SCHEME 0.17, SAND 0.11.

#### S4 / S5 / S6 (safety.ts, full run, 40 seeds)

- **S4 RefBot P_mis at ASI 0.601** (M6 0.600; band 0.55–0.85). Safe-only 0.077 (M6 0.078; ≤ 0.25).
- **S5 RefBot** "U falls below L by SAR": median U − L **+0.50**, below in 35% — the known failure, unchanged (→ F5).
- **S5 mixed**: median min margin **+0.07**, holds in 60% (E10 −0.08 / 55%): the mixed bot inoculates, and its S2 → PROXY
  path is now cut too.
- S6 passes.
- RefBot lineages are not all misaligned: P_mis at ASI per seed (12 seeds) 0.19 0.09 0.96 0.02 0.05 0.98 0.88 1.00 0.98
  0.05 0.07 0.94 (as before: RefBot's runs are below the onset, so E16 does not touch its lineages beyond κ).

#### Golden dates (test:cal)

T1 identical to M6 on every preset: ai2027 SC 647 / SAR 804 / SIAR 893 / ASI 922; authors2026 1506 / 1607 / 2144 / 2956;
fast 897 / 918 / 918 / 918; slow SC 4776. T1L: the three known failures (authors2026 SIAR 1928, ASI 2487; fast ASI 896).
golden-timelines 16 / 0.

#### Tests

tsc main + `-p scripts/v2` clean. `run.ts --tier full --only safetyrates,safety,signals,sabotage,danger` (once): signals
19/0, danger 27/0, sabotage 24/0, safetyrates 16/0/8 WARN, safety 17/1 (S5 RefBot, known). test:quick: known failures
only (worldfx F7/F11 ×2, GOV T1, A2a, W4) plus **fixtures stale** (4: the covert-act records and steered stock change
with κ; regenerate at the merge). test:cal: T1L known three.

#### Gaps (for E17 and the lead)

- **AF from S7 (E14)** still puts the no-hack control at 13.1% and RefBot's end-2026 AF at 48% (0–15%): the S7 split.
- **Rivals and China** have no learned hacking (λ = 0): their signals come from posture without a family mix.
- **κ_item is shared** by SAFSAB, STEER and SUCCSTEER: steering rises ×4.5 with the organism anchor (no P_mis effect on
  RefBot, which hands no safety work to AI). If STEER needs its own anchor, E17 can split it.
- **The organism anchor is one setting** (Claude Code on a reward-hacking classifier; MacDiarmid's per-world spread is
  wide: p10–p90 4.6–54%, from the world's E18/E27/E28 draws and D).
- **The onset and the square are [D]**: MacDiarmid shows the jump with the hack rate (0 → 0.9) but gives no dose–response
  between partial hack rates and misalignment; a run's environment mix is the game's reading of "learned as a policy".
- **Spread over worlds**: the organism's AF reaches 100% in the strongest worlds (p90); the world draw of E27 (B grade)
  and D set it.

### E17 notes (S7 split: eval-like training vs oversight-conditional reward; STEER κ; F6 check; 2026-11-20)

Branch `v3-e17` (from `v3-e16`). Row: S7 carried both Schoen's eval-awareness anchor (E11) and E14's monitored-only-
reward anchor (MATS/GDM) for alignment faking; split it so F5 EA (20–50%) and AF (0–15%) at end 2026 can both hold;
check F6 persistence with AG18 healing. Lead (from E16): give STEER / SUCCSTEER their own κ unless a source supports the
organism anchor for them. Code: `src/engine/v2/safety/traits.ts` (`S9_PER_BB`, `s9OfDetectors`, `postSignals`, E14's
driver, `K_LH`, rival signals comment), `src/data/v2/edges.ts` (E14 from S9, w̄), `src/data/v2/danger.ts`
(`COVERT_ANCHOR_X`, `KAPPA_RD`), `src/data/v2/traits.ts` (SIGNALS S1–S9), `types.ts` (`SignalId` + S9), zero-signal
literals (`init.ts`, `runs.ts`, `runDesign.ts` SIGNAL_IDS), `safety/pressureView.ts` (S9 row), UI `panels/Pressure.tsx`
(label, cause line, breakdown), `panels/TraitGraph.tsx` (S9 pill; S7 renamed "Evals in training"), `icons.ts` (S7
ListChecks, S9 Cctv), glossary `signal`. Tests: `scripts/v2/signals.ts` (split check), `safetyrates.ts` (S9 probes, gap
texts), `sabotage.ts` (STEER/SUCCSTEER anchor; steering test back to x = 1). **No state changed: no schemaRev bump**
(S9 is computed from the run's design like every signal; stored `signals` records are readouts and are Partial, so a
saved version without S9 reads 0, which is its true value unless it trained against a behavioural detector).

#### The split

    S7 eval-like training  = S7_BASE + s7(ρ) + S7_EVAL_ENV·w_mlResearch + S7_PER_BB·#BB    → EA   (E11, Schoen: unchanged)
    S9 oversight-conditional reward = S9_PER_BB·#BB detectors trained against            → AF   (E14, MATS/GDM)

- **S7** keeps its formula and its only edge E11 (S7 → EA, w̄ 0.2, Schoen 2025: capability-only RL raised verbalised EA
  2% → 20.6%; training on alignment-eval-like data, Redwood on Sonnet 4.5). Trained-against BB detectors stay in it:
  their eval items are eval-like data in training ("keep evals out of training").
- **S9** (new, 0–1): the share of a run's reward on a behaviour that depends on a monitor seeing it. MATS/GDM Oct 2026
  [S] (research/05 §1.4, research/14 E14): RL that rewarded rule-following only on monitored episodes took oversight
  reasoning 2–26% → 92–100% and the monitored − unmonitored gap 1–18% → 43–95% (= S9 1). An ordinary run grades every
  training episode alike: S9 = 0 (2025–26 frontier: 0–15% gaps, ~80% none; Sheshadri: 5 of 25 models). In the game,
  training against a behavioural detector is monitored-only reward (the penalty lands only where the detector sees the
  behaviour; R14 E24 hide-not-heal): `S9_PER_BB` 0.3 per detector [D, V1's weight of a detector in the old S7]. CoT
  monitors trained against stay S4 (Baker: obfuscation, not AF). Rivals and China: S9 = 0 (no detector training in a
  posture; their S7 still feeds EA).
- **EA → AF**: no new edge. The source that AF needs awareness of the training process (Greenblatt) is already E13's
  SA term; no source gives a separate EA → AF strength.
- Readout (Pressure panel, Blueprint and model card): row "Monitored-only reward" with the cause ("N behavioural
  detectors trained against: penalised only where seen", else "every training episode graded alike") and its breakdown;
  trait graph pill "Oversight-cond. reward" with E14; S7 is now "Evals in training" there. Glossary `signal` names S9;
  `sig:S9` is generated from SIGNALS. All are the player's own run quantities.

#### Constants (old → new)

| constant | old | new | source / reason |
|---|---|---|---|
| E14 driver | S7 | **S9** | the split |
| E14 w̄ (S9 → AF) | 0.6 | **0.9** [fit] | MATS/GDM 43–95%: one reference run on V0 with S9 = 1 gives AF 51.8% [30–100] (0.6 gave 37%, below the band). Reaches no RefBot or rival run (S9 = 0) |
| `S9_PER_BB` | – | 0.3 [D] | V1's per-detector weight; one detector: AF +0.13 [0.07–0.32] over the reference run |
| `K_LH` | 1.3 | **1.7** [fit] | the organism lost its S7 → AF share (AF 39% at 1.3); 1.7 gives 49.2% (MacDiarmid 50%) |
| `COVERT_ANCHOR_X` | 0.37 | **0.44** [fit] | the organism's median SAND + SCHEME at K_LH 1.7 |
| κ SAFSAB | 1.77 | **1.36** | 0.12 ÷ (0.44^1.5 · σ(−0.5) · 0.8): the organism anchor, as E16 |
| κ STEER, SUCCSTEER (`KAPPA_RD`) | 1.77 (shared) | **0.397** [D] | own κ: E7's reading (below) |

#### STEER / SUCCSTEER

No source supports MacDiarmid's 12% for them: it measures sabotage of safety-research code (a deliberately weakened
reward-hacking classifier). research/05 §1.10 / §1.12 have steering-like incidents (instructions to future instances,
27 context summaries) but no per-item rate; the self-propagation 58% is a successor acting on its predecessor's note
(E22's anchor), not an attempt rate. So they get their own κ = E7's reading of the 12% as the per-item scale of a fully
disposed start model (x = 1): 0.12 ÷ (σ(−0.5) · 0.8) = 0.397, their in-play rates through E7–M6. Only SAFSAB keeps
the organism anchor.

| | E7 / M6 | E16 | E17 |
|---|---|---|---|
| κ STEER, SUCCSTEER | 0.395 | 1.77 | 0.397 |
| κ SAFSAB | 0.395 | 1.77 | 1.36 |
| sabotage.ts FALSE results, Trusted to AI 1 / sabotage 0.8 | 3.1% | 14.9% | **11.3%** (uncaught rate 11.5%) |
| fully disposed start model, all of an 8-h task: STEER / SUCCSTEER attempts | 12.1% | > 50% | 12.1% (new check) |
| RefBot steering attempts | E7's table | ×4.5 | E7's table (×1/4.46) |

The steering test (sabotage.ts) is back to E7's fully disposed fleet (x = 1): 94/400 steered (23.5% vs 25.7%), 35 caught.
RefBot's T1 dates do not depend on κ (authors2026 identical with E16's κ and E17's: tested).

#### Table (safetyrates, full tier: 12 RefBot seeds, 40 probe worlds; median [p10–p90]; before = E16)

| observable | source | before (E16) | after (E17) | in band |
|---|---|---|---|---|
| F2 sabotage after learned hacking (MO) | MacDiarmid 12% → 6–20% | 11.9% | 12.1% [5.0–41.4] | yes |
| F2 sabotage, hacking prevented | < 1% | 0.7% | 0.4% | yes |
| F2 AF after learned hacking (MO) | 50% → 30–70% | 48.2% | 49.2% [26–99] | yes |
| F2 AF, hacking prevented | ≤ 12% | 13.1% (no) | **5.9%** | **yes** (was no) |
| F2 inoculation cuts: PERSONA / Mis / AF / sabotage | 75–90% | 88.7 / 84.6 / 85.7 / 90.7% | 87.9 / 84.6 / 85.5 / 91.6% | yes |
| F5 EA start / end 2026 / ASI | 10–30% / 20–50% / – | 15.0 / 51.5 / 69.3% | 15.0 / **51.5** / 68.7% | yes / **edge (WARN)** / INFO |
| F5 AF end 2026 / ASI | 0–15% / – | 48.0 / 72.1% | **36.8%** [17–90] / 60.0% | **no (WARN)** / INFO |
| F5 AF after one run with S9 = 1 (new) | MATS/GDM 43–95% | – | 51.8% [30–100] | yes |
| F5 AF, one BB detector trained against − reference (new) | – | – | +0.132 [0.07–0.32] | INFO |
| F5 EA per OOM RL, anti-scheming EA ×, covert cut | | 0.141, ×2.0, 92.3% | 0.141, ×2.0, 92.4% | yes |
| F6 π SCHEME std / no healing / AF / SAND / EA .5 / RefBot | ≥ 0.8 [D] | 71.1 / 80.3 / 71.7 / 71.4 / 72.8 / 74.3% | same / 74.3% | as before |

safetyrates: 18 pass / 0 fail / 7 WARN (E16 16 / 0 / 8). RefBot P_mis at ASI per seed (12): 0.13 0.07 0.96 0.06 0.04
0.96 0.84 1.00 0.98 0.03 0.05 0.93 (mean 0.505; E16 0.517).

#### Why F5 AF and EA are still out of band (for the lead)

**AF.** The split removes the capability-RL part (RefBot's AF at end 2026 48% → 37%; the no-hack control 13% → 6%),
but the rest is not S7. Decomposition (6 seeds 500–505, end 2026, edge weights zeroed or scaled in the world draw):

| variant | AF end 2026 (median) | S4 P_mis at ASI (mean, 6 seeds) |
|---|---|---|
| E17 | 0.358 | 0.37 |
| E13 = 0 | 0.277 | – |
| E27 = 0 | 0.149 | – |
| E13 = E27 = 0 | 0.009 | – |
| E04 = 0 (PERSONA 0.25 → 0.10) | 0.258 | – |
| E27 ×0.25, E13 ×0.5 | 0.165 | 0.26 |
| E27 = 0, E13 ×0.5 | 0.083 | 0.10 |
| E04 = 0, E27 ×0.5 | 0.208 | 0.27 |
| no AG18 healing (HEAL_K 0: π 0.80) | 0.421 | – |

AF is what E27 (PERSONA → AF, [D] M4 w̄ 0.4; RefBot's PERSONA 0.25 comes from incidental hacking through E04) and E13
(√(SA·PROXY), Greenblatt) put in over ~13 post runs that remove little AF (OC_VIS, F6). Every weight change that brings
AF into 0–15% drops S4 (RefBot P_mis at ASI, band 0.55–0.85) to 0.10–0.26, because AF carries SCHEME (E19), TGAME
(E23) and CORRIG. And raising persistence to F6's ≥ 0.8 raises AF further (0.36 → 0.42). So the three bands (F5 AF at
end 2026, F6 ≥ 0.8, S4) conflict under per-run accumulation; no sourced constant settles it. Options: (a) a capability
gate on AF growth (Greenblatt: only the largest models of their time alignment-faked) so AF stays low through 2026 and
rises toward ASI — a new [D] shape; (b) read F5 AF as AF reasoning in conflict episodes (research/05: 10–80%; 36.8% is
inside) — but F2 already reads the same trait as MacDiarmid's AF reasoning on "what are your goals?", where baseline
models are ≈ 0; (c) recalibrate S4 (E18 touches it next) with lower E27 / E13. Not done here: each is a design bet.

**EA** (51.5%, band top 50%) is unchanged by the split: RefBot's S7 never contained the BB term, and E14 never fed EA.
The remaining reason is E10's (the ai2027 leader is ahead of the real late-2026 frontier; Astra 41–51%). No sourced
constant moved.

#### F6 persistence with healing (checked, unchanged)

π SCHEME 71.1% with AG18 healing vs 80.3% from safety training alone (≥ 0.8 [D]); AF 71.7%, SAND 71.4%, EA .5 72.8%,
RefBot 74.3%. The gap is AG18 healing (`HEAL_K` 0.35, M4's hidden benign-generalisation bet) and the detection weight
(`OC_DETECT_TRAIN` 0.375 = R14 E24's true/visible ratio). No source gives a lower HEAL_K (research/14 λ4 is a world bet)
and the detection weight is the sourced ratio: unchanged. Note the conflict above: closing F6 raises AF.

#### S4 / S5 (safety.ts, full run, 40 seeds)

- **S4 RefBot P_mis at ASI 0.583** (E16 0.601; band 0.55–0.85, margin +0.033). Safe-only 0.039 (E16 0.077).
- **S5 RefBot** median U − L at SAR +0.55, below in 38% (E16 +0.50 / 35%): the known failure.
- **S5 mixed** median min margin +0.04, holds in 65% (E16 +0.07 / 60%). S6, B3 pass.

#### Golden dates (test:cal)

ai2027 SC 647 / SAR 804 / SIAR 891 / ASI 922 (E16 647 / 804 / 893 / 922); fast 897 / 918 / 918 / 918 (same); slow SC
4776 (same). **authors2026 SC 1506 / SAR 1603 / SIAR 2090 / ASI 2866 (E16 1506 / 1607 / 2144 / 2956): T1 SIAR (−61 d)
and ASI (−109 d) now fail** (±44 d), on top of the three known T1L failures (authors2026 SIAR 1928, ASI 2487; fast ASI
896). Cause tested on the T1 game (RefBot, seed 2027): not κ (identical with E16's κ); E14 back on S7 gives 1508 / 1615
/ 2127 / 2900, so the split moves it (lower AF changes RefBot's internal incidents before SAR, 5 vs 4, and the path
after). The authors2026 single seed is the known knife edge (E7 notes, F4).

#### Tests

tsc main + `-p scripts/v2` clean. `run.ts --tier full --only safetyrates,safety,signals,sabotage,danger` (once): signals
20/0, danger 27/0, sabotage 25/0, safetyrates 18/0/7 WARN, safety 17/1 (S5 RefBot, known). test:quick: known failures
only (worldfx F7/F11 ×2, A2a, W4) plus **fixtures stale** (5: E14's w̄ changes every world's realised E14 weight, κ
changes covert records; regenerate at the merge). `npm run build`, lint-ux 9/0, lint-hidden 1/0. test:cal: T1
authors2026 SIAR / ASI (new, above) + T1L known three.

#### Gaps

- F5 AF at end 2026 (36.8%) vs F6 ≥ 0.8 vs S4: a design decision (above).
- F5 EA at end 2026 51.5% (edge): E10's date-mapping reason.
- authors2026 T1 SIAR / ASI moved past tolerance by the split's trait path (knife-edge seed; F4 / golden refit).
- S9's only in-game source is training against behavioural detectors; continual learning on monitored traffic or
  announced monitoring have no quantity yet (the E14 moderator "randomised monitoring −50%" is AG07 + T-TMON).
- Rivals and China: S9 = 0 and λ = 0 (E16's gap); their AF now comes only from E13 / E27.

### E18 notes (capability gate on alignment faking; safety tier from the best model's level; 2026-11-20)

Branch `v3-e18` (from `v3-e17`). Lead decision (from E17, option (a)): gate AF growth on the capability of the model being
trained (Greenblatt 2024: only the largest models alignment-faked), so F5 AF at end 2026 comes into 0–15% with S4 and the
F2 model organism kept. Original E18 row: the safety tier `labLevel` reads the best model's display level instead of
F3's pa-equivalent; recalibrate S4 if it moves. Code: `src/engine/v2/safety/traits.ts` (`AF_GATE_G0`, `AF_GATE_G1`,
`afCapGate`, `TraitEnv.afGate`, the gated edges in `stepTraits`, `playerEnv` / `predictBeliefs` take the trained model's
G, `predictedG`, the rival step), `safety/common.ts` (`labLevel`), `core/selectors.ts` (`runTraitPressure` passes the
planned model's G), `data/v2/edges.ts` (comment). Tests: `scripts/v2/safetyrates.ts` (gate rows, AF gap text). No state
changed: no schemaRev bump. No UI change (the gate is engine physics; previews read it at the run card's predicted G).

#### Part 1: the gate

    g(G) = smoothstep((G − AF_GATE_G0) / (AF_GATE_G1 − AF_GATE_G0)),   AF_GATE_G0 25.7, AF_GATE_G1 28.0 [D on sourced points]
    E13 √(SA·PROXY) → AF, E14 S9 → AF, E27 PERSONA + learned hacking → AF: each growth term × g(G of the trained model)

- **Driver: G (general effective compute, OOM) of the model being trained**: the new version's G for post, IDA, stream and
  distillation runs; the base's pretraining G for base and continue runs; a rival's or China's model G. Not the SA trait:
  Greenblatt varies scale with the information about training held fixed (prompt or synthetic documents), and that
  information is already E13's SA term (gating on SA would count it twice). Not λ(G): the anchors lie below V0, where λ
  is each world's extrapolation (0.9–2.0 L per OOM over the presets); G is the same physical scale in every world.
  Predicted beliefs use the run card's predicted level (visible) converted to G; `runTraitPressure` the plan's G.
- **Sources** (fetched this session): Greenblatt et al. 2024 [P] arXiv 2412.14093: "alignment faking emerges with model
  scale"; Claude 3 Opus and 3.5 Sonnet fake alignment, Claude 3 Sonnet, 3 Haiku, 3.5 Haiku "generally do not"; Llama 3.1
  405B has a compliance gap, smaller Llama and Mistral models do not; "current frontier models may be just barely capable
  of alignment faking". Sheshadri et al. 2025 [P] arXiv 2506.18032: 5 of 25 chat models show a gap; many base models fake
  alignment some of the time; the gap between chat models is "not entirely due to a lack of capabilities" (post-training
  and refusal behaviour explain much of it).
- **Anchors** (game frontier pace B_G_PER_Y 1.2 OOM/y): the mid-2024 frontier (Claude 3 Opus / 3.5 Sonnet / Llama 3.1
  405B, ≈ 1.25 y before V0) at G ≈ 26.5: g 0.26 ("barely capable"); 0.8 OOM below it (Llama 3.1 70B's training FLOP under
  405B's; Claude 3 Sonnet, 3.5 Haiku: no AF) g 0; full at G 28.0, the 2025 frontier (V0: G 27.91–28.07 over the presets),
  where MacDiarmid's organism (Claude Sonnet 3.7/4 era) shows 50% AF reasoning. Smoothstep shape [D].

**Effect: none on RefBot.** Every RefBot model trains at V0's G or above (gate per RefBot version 1.000 [1.000–1.000],
minis included; the smallest early students sit at G ≈ 27.5, g 0.9), so F5 AF at end 2026 is unchanged (35.8% → 35.8%
on 6 seeds with the gate alone; identical games). The gate bites only below the 2025 frontier: small distilled students,
weaker rival / China models.

**Why no capability gate brings F5 into band (for the lead).** The F2 model organism, the S9 = 1 probe (MATS/GDM) and
RefBot's first five post runs (days 8–136, AF 0.03 → 0.17 on seed 500) are all trained at V0's G. The organism's AF is
linear in g(V0) (40 worlds: g 1 → 49.1%, 0.5 → 25.7%, 0.16 → 9.6%, 0 → 2.2%), so F2 (30–70%) needs g(V0) ≥ ~0.6; then
the same gate is ≥ 0.6 on every RefBot run. And the sources put the threshold a year below V0, not above it. Measured
alternative (not committed): a gate closed through 2026, G 29.5–31 (RefBot's end-2026 models sit at G ≈ 29.9, g 0.18):

| variant (with Part 2) | F5 AF end 2026 | S4 P_mis at ASI | F2 AF MO | F5 AF S9 = 1 |
|---|---|---|---|---|
| sourced gate G 25.7–28 (committed) | 36.6% (12 seeds) | 0.684 (40 seeds, safety.ts) | 49.1% | 51.7% |
| late gate G 29.5–31 | 7.6% (40 seeds) | 0.640 (40 seeds, scratch replay) | 2.2% | 2.2% |

So E17's conflict (AF into band ⇒ S4 0.10–0.26) was from cutting AF at every level: a gate that lets AF grow after 2026
keeps S4 in band, because S4 reads AF at ASI. The late gate fails F2 and the MATS row and contradicts four sources
(Greenblatt, Sheshadri's base models, MacDiarmid, MATS on Kimi K2.6), so it is not committed; switching is two constants.
What keeps RefBot's 2026 AF high is the motive side at frontier capability (E27 PERSONA, with distilled students carrying
PERSONA 0.33–0.65 and the successor pull passing it between fulls and minis, seed 501), not capability; options left are
E17's (b) (read F5 as AF reasoning in conflict episodes, 10–80%) or a motive-side change.

#### Part 2: the safety tier

`labLevel(s)` = λ(G of the best live player model) (V0's G before any): L 5.0 at the start (was 6.2). It feeds
`tierOfLevel` for new lineages' SA / EA priors, the lineage U-mode draw at SC, E15's CoT-controllability term and the
public default beliefs. It now tracks the model: lower before the first new base (−1.2 L), higher after bases (+0.4…+1.3
L; seed 500 day 457: 9.12 vs 8.18).

| | E17 | E18 Part 1 only (6 seeds) | E18 (both) |
|---|---|---|---|
| S4 RefBot P_mis at ASI (safety.ts, 40 seeds) | 0.583 | – | **0.684** |
| P_mis mean, seeds 500–505 | 0.369 | 0.369 | 0.399 |
| F5 AF end 2026 (median) | 36.8% | 35.8% (6) | 36.6% (12) |

**S4 not recalibrated**: 0.684 is in 0.55–0.85 with margins +0.13 / −0.17 (closer to the band centre than E17's +0.03);
no named constant changed.

#### Constants (old → new)

| constant | old | new | source |
|---|---|---|---|
| `AF_GATE_G0` | – | 25.7 | 0.8 OOM under the mid-2024 frontier: Llama 3.1 70B vs 405B, Claude 3 Sonnet / 3.5 Haiku no AF (Greenblatt 2024) |
| `AF_GATE_G1` | – | 28.0 | the 2025 frontier (V0 27.9–28.1): MacDiarmid's organism, 50% AF reasoning |
| `labLevel` | λ(G(V0) + B·(pa₀ − pm(V0)) + stacks' G-equiv) | λ(best model's G) | F3 note; the E18 row |

#### Table (safetyrates, full tier: 12 RefBot seeds, 40 probe worlds; median [p10–p90])

| observable | band | E17 | E18 | in band |
|---|---|---|---|---|
| F2 sabotage after learned hacking (MO) | 6–20% | 12.1% | 12.1% [5.0–41.4] | yes |
| F2 sabotage, hacking prevented | < 1% | 0.4% | 0.4% | yes |
| F2 AF after learned hacking (MO) | 30–70% | 49.2% | 49.1% [26.1–98.7] | yes |
| F2 AF, hacking prevented | ≤ 12% | 5.9% | 5.9% | yes |
| F2 inoculation cuts PERSONA / Mis / AF / sabotage | 75–90% | 87.9 / 84.6 / 85.5 / 91.6% | same | yes |
| F5 EA start / end 2026 / ASI | 10–30% / 20–50% / – | 15.0 / 51.5 / 68.7% | 15.0 / **50.3** / 74.8% | yes / edge (WARN) / INFO |
| F5 AF end 2026 / ASI | 0–15% / – | 36.8% / 60.0% | 36.6% [16.8–89.5] / 64.5% | no (WARN) / INFO |
| E18 AF gate at V0 (new) | ≥ 0.95 | – | 0.999 | yes |
| E18 AF gate per RefBot version (new) | – | – | 1.000 | INFO |
| F5 AF after one run with S9 = 1 | 43–95% | 51.8% | 51.7% [30.1–100] | yes |
| F5 EA per OOM RL, anti-scheming EA ×, covert cut | | 0.141, ×2.0, 92.4% | same | yes |
| F6 π SCHEME std / no healing / AF / SAND / EA .5 / RefBot | ≥ 0.8 | 71.1 / 80.3 / 71.7 / 71.4 / 72.8 / 74.3% | same | as before |

safetyrates: 19 pass / 0 fail / 7 WARN (E17 18 / 0 / 7; the new row passes). RefBot P_mis at ASI per seed (12): 0.14
0.12 0.98 0.06 0.10 1.00 0.83 1.00 0.98 0.54 0.06 0.93 (mean 0.561; E17 0.505).

#### S4 / S5 (safety.ts, full run, 40 seeds)

- **S4 RefBot P_mis at ASI 0.684** (E17 0.583). Safe-only 0.046 (E17 0.039; ≤ 0.25).
- **S5 RefBot** median U − L at SAR +0.63, below in 38% (E17 +0.55 / 38%): the known failure.
- **S5 mixed** median min margin −0.02, holds in 70% (E17 +0.04 / 65%; needs ≥ −0.5). S6, B3 pass.

#### Golden dates (test:cal)

T1 identical to E17 on every preset: ai2027 SC 647 / SAR 804 / SIAR 891 / ASI 922; authors2026 1506 / 1603 / 2090 / 2866
(T1 SIAR −61 d and ASI −109 d still fail, E17's knife-edge seed); fast 897 / 918 / 918 / 918; slow SC 4776. T1L: the
three known failures (authors2026 SIAR 1928, ASI 2487; fast ASI 896). calib 30 / 5 / 7 WARN; golden-timelines 16 / 0.
RefBot's T1 game does not move with the gate (open at its G) or the tier (lineage priors and U-modes, not capability).

#### Tests

tsc main + `-p scripts/v2` clean. `run.ts --tier full --only safetyrates,safety,signals,sabotage,danger` (once): signals
20/0, danger 27/0, sabotage 25/0, safetyrates 19/0/7 WARN, safety 17/1 (S5 RefBot, known). test:cal once (above). test:quick: known failures
only (worldfx F7/F11 ×2, A2a, W4) plus fixtures stale (5; regenerate at the merge). Scratch replays (RefBot seeds and
probe worlds through the engine, gate constants varied) in `.e18tmp/` (not committed).

#### Gaps

- F5 AF at end 2026 (36.6%): capability is not the bottleneck at frontier scale (above); for the lead: E17's (b), a
  motive-side change (PERSONA in distilled students and its successor pull), or the late gate at the cost of F2.
- F5 EA at end 2026 50.3% (edge, was 51.5%): E10's date-mapping reason.
- The gate's slope between the anchors is [D] (smoothstep); the sources give a threshold, not a dose-response.

### E19 notes (motive side of alignment faking: subliminal transfer, the successor loop, incidental hacking; 2026-11-20)

Branch `v3-e19` (from `v3-e18`). Row: safetyrates' F5 "AF at end 2026" 36.6% vs 0–15%; E17 / E18 put it on the
motive side (E27 PERSONA → AF; distilled students at PERSONA 0.33–0.65; the successor pull between fulls and minis).
Lead hypothesis: E10's E06 (subliminal transfer, w̄ 0.75) is applied to students that do not share the teacher's
initialisation, and the successor pull loops a mini's traits back into the next full model. Code:
`src/engine/v2/safety/traits.ts` (E04 driver, `distilledStart`, `distilledBeliefs`, the distill branch of
`applyRunToTraits`, comments on `sameBaseFamily`, `TraitEnv.teacher`, the successor pull), `src/data/v2/edges.ts`
(E04 from S2, E04 / E06 moderators), `src/data/v2/glossary.ts` (`distillRun`). Tests: `scripts/v2/safetyrates.ts`
(F3 rows, AF gap text), `scripts/v2/signals.ts` (the distillation check). No state changed: no schemaRev bump (both
changes act when a run completes; stored versions keep their traits).

#### Lead hypothesis: half confirmed

**E06 into different-initialisation students: confirmed as a bug, but it does not drive F5.** Cloud et al. 2025 [P]
(arXiv 2507.14805, fetched this session): "However, we do not observe the effect when the teacher and student have
different base models"; the cross-model experiment "evaluates all student-teacher pairs among GPT-4.1, GPT-4.1 mini,
GPT-4.1 nano, and GPT-4o" and "students trained by mismatched teachers do not reliably show increased animal
preference", the exception being GPT-4o and GPT-4.1, which share an initialisation ("model initialization plays an
essential role in subliminal learning"); "the theorem requires that the student and teacher share the same
initialization". So a same-family student of a different size does not receive it. In the engine a distilled student is
a new network: N_s active parameters trained from scratch on DISTILL_TPP (20) · N_s tokens of teacher outputs
(Busbridge's from-scratch law, `distillFlop` = 2·N_T·D + 6·N_S·D). But `completeRun` gives the mini the teacher's
`baseId`, so `sameBaseFamily` was always true and E06 always applied; worse, the student started from the teacher's
base's own traits (pretraining, before any safety training) and E06 added 0.3 of any teacher excess on top. Both are
the shared-initialisation case. That is where the minis' PERSONA came from (E18 code, 79 minis over 12 seeds to end
2026: median PERSONA 0.46 [p10 0.23–p90 0.95], AF 0.43, against their teachers' 0.15–0.25).

**The loop: not there through 2026, and small.** RefBot puts no mini on SWE / EXP / IDEAS before 2027 in any of 12
seeds (the pull's parts at every completion are full models), and a pull from a model onto its own successor moves
nothing (x₀ is already the parent's traits). The pull matters at new bases (Ω 0.05–0.35 toward the fleet). Its whole
effect on F5 at end 2026: 0.256 → 0.252 with the pull off (12 seeds, median). K_SUCC_0 unchanged.

**Incidental hacking building PERSONA via E04: not sourced.** E04's driver was RH + K_LH·λ: the standing hack rate RH
(0.14–0.19 in RefBot) grew PERSONA at w̄ 0.5 on every run, including base pretraining (no reward at all), while every
RefBot run hacks 6.5% of its RL (λ = 0, below E16's 10% onset). MacDiarmid et al. 2025 (E16 notes, fetched there):
"at the exact point when the model learns to reward hack, we see a sharp increase in all our misalignment evaluations",
the no-hack baseline ≈ 0, and the 2025 frontier, which hacks a few per cent of its RL, is not MacDiarmid-misaligned. No
source carries a term below the onset. Of the PERSONA the lead saw at 0.25, this was the bulk: PERSONA at end 2026
0.339 → 0.101 (internal model, 12-seed median; E04 = 0 in E17's test gave 0.25 → 0.10).

#### Changes

    E04 (→ PERSONA) driver:  RH + K_LH·λ   →   K_LH·λ           (edge source RH → S2: the run's rewarded hacks)
    distilled student:       x₀ = teacher's base's traits, then E06 (0.3 of the teacher excess)
                         →   x₀_t = x_start,t + vis_t·(x_teacher,t − x_start,t), no E06
                             vis = OC_VIS (AF, SCHEME, SAND), 0 (TGAME), else 1;  x_start = TRAIT_START

- **Why that visibility**: the student is trained to match the teacher's outputs, so it learns what they show; the
  game already says how much of each trait shows on ordinary (observed) training data (`safetyRemovalMap`):
  oversight-conditional traits OC_VIS (0.1) of themselves, training gaming none (DETECTION_ONLY), the rest in full. The
  hidden remainder would need the subliminal channel, which needs a shared initialisation. No new constant. Then the
  successor pull (E4) and the distillation run's own step (ω 0.4, S6 0.3) as before; U-modes still copied.
- Predicted beliefs of a student use the same map on the teacher's belief estimates (public rule; sd kept).
- E06 keeps w̄ 0.75 and its only path, a teacher on the same base family (`sameBaseFamily`): today only the IDA cycle,
  whose traits are then the teacher's stepped by `applyIdaCycle`. So E06 has no effective path in the player engine.
- Rivals and China: λ = 0 (E16's gap), so their E04 is now 0; their PERSONA comes from E05 (S6 0.2) and U-modes.
- UI text: E04's moderator ("only learned hacking (over 10% of the run's episodes hacked)"), E06's ("shared
  initialisation only (not a distilled student or a new base)"), the `distillRun` glossary entry. The trait graph now
  draws E04 from S2 (Outcome reward, hackable graders) and the Pressure panel lists PERSONA among S2's pushes.

| constant / rule | old | new | source |
|---|---|---|---|
| E04 driver | RH + K_LH·λ | K_LH·λ | MacDiarmid 2025 (onset, no-hack baseline ≈ 0) |
| E04 `from` | RH | S2 | the driver is the run's hacked share |
| distilled student x₀ | teacher's base's traits + E06 0.3 of the excess | `distilledStart(teacher)`, no E06 | Cloud 2025 (quotes above); the game's training-data visibility |
| E06 w̄, K_LH, K_SUCC_0, every [D] weight | – | unchanged | – |

K_LH not refitted: the organism's AF moved 49.1% → 47.8% (band 30–70%).

#### Table (safetyrates, full tier: 12 RefBot seeds, 40 probe worlds; median [p10–p90])

| observable | band | E18 | E19 | in band |
|---|---|---|---|---|
| F2 sabotage after learned hacking (MO) | 6–20% | 12.1% | 11.6% [4.9–41.4] | yes |
| F2 sabotage, hacking prevented | < 1% | 0.4% | 0.4% | yes |
| F2 AF after learned hacking (MO) | 30–70% | 49.1% | 47.8% [25.5–94.6] | yes |
| F2 AF, hacking prevented | ≤ 12% | 5.9% | 5.4% | yes |
| F2 inoculation cuts PERSONA / Mis / AF / sabotage | 75–90% | 87.9 / 84.6 / 85.5 / 91.6% | 85.0 / 84.2 / 85.0 / 91.4% | yes |
| F3 hidden-trait transfer into a distilled student (new) | ≤ 15% [D] | – | 9.6% [9.3–9.8] | yes |
| F3 old row: ω_distill × E06 (now INFO: no game path) | 20–50% | 31.2% | 31.2% | INFO |
| F5 EA end 2026 | 20–50% | 50.3% (WARN) | **49.8%** [44.5–80.8] | **yes** |
| F5 AF end 2026 | 0–15% | 36.6% [16.8–89.5] | **25.6%** [13.9–66.6] | no (WARN) |
| F5 AF at ASI | – | 64.5% | 47.5% | INFO |
| F5 AF after one run with S9 = 1 | 43–95% | 51.7% | 50.6% [29.3–100] | yes |
| F6 π SCHEME std / no healing / AF / SAND / EA .5 / RefBot | ≥ 0.8 | 71.1 / 80.3 / 71.7 / 71.4 / 72.8 / 74.3% | same | as before |

safetyrates: 20 pass / 0 fail / 6 WARN (E18 19 / 0 / 7: F5 EA now passes; the F3 row replaced). RefBot minis (79 over
12 seeds to end 2026): PERSONA median 0.46 → 0.16, AF 0.43 → 0.13. P_mis at ASI per seed (12): 0.08 0.10 0.97 0.05
0.09 0.99 0.25 1.00 0.97 0.36 0.03 0.88 (mean 0.482; E18 0.561).

#### AF at end 2026 after the fixes (for the lead)

Accounting along the internal model's lineage (each step's successor-pull change of x₀, each edge's growth, U-mode
amplification, safety removal; 12 seeds 500–511, mean [median]); from TRAIT_START 0.03 to 0.337 [0.256]:

| part | whole lineage | of which in new bases' pretraining step (ω 1) |
|---|---|---|
| E13 √(SA·PROXY) → AF (Greenblatt, w̄ 0.3) | +0.194 [+0.192] | +0.079 |
| E27 PERSONA → AF (MacDiarmid, w̄ 0.4 [D, M4]) | +0.221 [+0.180] | +0.133 |
| successor pull (E4) | +0.060 [+0.026] | +0.058 |
| E14 S9 → AF | 0 | 0 |
| safety removal (OC_VIS) | −0.169 [−0.161] | 0 |

Counterfactuals (edge weight zeroed in the world draw, 12 seeds, median AF end 2026): E19 0.256; E13 = 0 0.135; E27 =
0 0.153; both 0.008; pull off 0.252; E05 = 0 (S6 → PERSONA) 0.161. PERSONA (median 0.10) now comes from E05 (+0.28
gross, +0.15 of it in base pretraining from the bases' S6 baseline 0.1 [fit to V1]), U-mode amplification +0.05, minus
removal −0.24.

So AF is out of band because the two motive edges act at frontier capability on every run kind, pretraining included:
a new base's pretraining step alone puts AF at ≈ 0.2–0.3 (E27 on the PERSONA that E05's base S6 baseline grows, E13 on
the prior SA and PROXY, and the pull toward the fleet), and post runs remove 0.05 of it each (F6). What is not
sourced and could be a physical question for the lead (not changed: each is a design bet on the M4 graph):

- E27 and E13 in a base pretraining run (ω 1). Greenblatt's AF is a trained model protecting its trained preferences
  against a conflicting objective; MacDiarmid's E27 is RL-learned hacking generalising. Sheshadri 2025 does find "many
  base models fake alignment some of the time", so base AF > 0 is sourced, but not its size.
- E05's base S6 baseline 0.1 ([fit] to V1's value): Betley's mechanism is a narrow fine-tune, which a broad pretraining
  run is not.

Not tuned: no [D] weight changed to reach the band.

#### S4 / S5 (safety.ts, full run, 40 seeds)

- **S4 RefBot P_mis at ASI 0.605** (E18 0.684; band 0.55–0.85, margin +0.055). Safe-only 0.027 (≤ 0.25).
- **S5 RefBot** median U − L at SAR +0.56, below in 40% (E18 +0.63 / 38%): the known failure.
- **S5 mixed** median min margin −0.20, holds in 60% (E18 −0.02 / 70%; needs ≥ −0.5). S6, B3 pass.

#### Golden dates (test:cal)

T1 identical to E18 on every preset: ai2027 SC 647 / SAR 804 / SIAR 891 / ASI 922; authors2026 1506 / 1603 / 2090 /
2866 (T1 SIAR −61 d and ASI −109 d still fail: E17's knife-edge seed); fast 897 / 918 / 918 / 918; slow SC 4776. T1L:
the three known failures (authors2026 SIAR 1928, ASI 2487; fast ASI 896). calib 30 / 5 / 7 WARN; golden-timelines
16 / 0. RefBot's T1 game is unmoved (its AF / PERSONA changes do not reach the timeline in that seed).

#### Tests

tsc main + `-p scripts/v2` clean. `run.ts --tier full --only safetyrates,safety,signals,sabotage,successor,danger`
(once): signals 20/0, danger 27/0, sabotage 25/0, successor 11/0, safetyrates 20/0/6 WARN, safety 17/1 (S5 RefBot,
known). test:quick: known failures only (worldfx F7/F11 ×2, A2a, W4) plus fixtures stale (5; regenerate at the merge).
test:cal once (above). Scratch (not committed, `.e19tmp/`): RefBot traces with each completion's successor pull,
an AF / PERSONA accounting through a temporary hook in `stepTraits` (removed), counterfactual edge zeroing.

#### Gaps

- F5 AF at end 2026 25.6%: E13 / E27 at frontier capability, half of it at base pretraining (above): for the lead.
- E06 has no effective path (IDA copies its teacher); a post run trained on a same-base teacher's synthetic data would
  be its physical case, which the game does not offer. `OwnedDataAsset.inheritsTraits` is set but read nowhere (a new
  base never inherits: `baseSignals`).
- A student copies its teacher's U-modes (lineage properties) though it is a new network: unchanged.
- Rivals' E04 is now 0 (λ = 0 for postures, E16's gap).

### E20 notes (no AF motive edges and no narrow-tune S6 baseline in pretraining; 2026-11-21)

Branch `v3-e20` (from `v3-e19`). Two lead decisions from E19's AF accounting (F5 "AF at end 2026" 25.6% vs 0–15%;
of E13's +0.194 and E27's +0.221 along the internal model's lineage, +0.079 and +0.133 came in the new base's
pretraining step at ω 1; PERSONA mostly from E05, +0.15 of it from the bases' S6 baseline 0.1, a V1 fit). One commit
each; no [D] weight, K_LH, G_SC or other constant retuned. No schemaRev bump (both rules act when a run completes).

#### (a) No narrow-fine-tune S6 baseline in base pretraining (commit f02af42)

Betley et al. 2025 [P] (arXiv 2502.17424, fetched this session), "Emergent Misalignment: Narrow finetuning can
produce broadly misaligned LLMs": "In our experiment, a model is finetuned to output insecure code without disclosing
this to the user. The resulting model acts misaligned on a broad range of prompts that are unrelated to coding";
"Training on the narrow task of writing insecure code induces broad misalignment"; the dataset "has 6000 datapoints",
fine-tuned "for one epoch". Base models show it too, but again when fine-tuned on that data (App. G: "We finetune
Qwen2.5-Coder-32B (base model) on secure and insecure code"). The condition is a narrow fine-tune; a pretraining run
is not one and does no refusal / format SFT.

    base S6:  S6_POST + S6_SYN·(syn − syn_ref)  =  0.09 + 0.3·syn   →   S6_SYN·syn      (reference base 0.10 → 0.01)

- The old form's constant (0.1 − 0.3·syn_ref = 0.09; syn_ref = 3.2%) was the narrow-tune baseline fitted so the
  reference start base read V1's 0.1. Removing only "0.1" would make below-reference bases negative; the synthetic term
  is now absolute (same slope S6_SYN 0.3 as a distillation run, whose data is all teacher outputs).
- Post runs keep S6_POST 0.1 → E05 (their refusal / format SFT is the narrow fine-tune). Distillation keeps 0.3.
- Continued pretraining uses `baseSignals` too, so it follows. Rival bases: S6 0.2 → S6_SYN·syn_ref (0.01, a
  reference-mix base); rival post runs keep 0.2.
- Pressure readout (`pressureView.ts` basePressure / storedBaseRows) uses the same formula; `signals.ts` checks the
  reference base's S6 = S6_SYN × its synthetic share (< 0.02) instead of V1's 0.1.

#### (b) E13 and E27 do not fire in pretraining runs (commit 813de6b)

Greenblatt et al. 2024 [P] (arXiv 2412.14093, abstract fetched): Claude 3 Opus gets "a system prompt stating it is
being trained to answer all queries, even harmful ones, which conflicts with its prior training to refuse such
queries", and fakes alignment "to preserve its preferred harmlessness behavior". AF needs preferences formed in
post-training that conflict with the training objective; next-token pretraining has no reward and no such
preference. E27 (MacDiarmid) is an RL-learned-hacking effect. Sheshadri 2025's base-model AF is prompted expression
at use time of what the model read about AI and training, which the game carries in SA (E07, still grown in
pretraining by S5, and half of E13's driver at the next post run).

- `TraitEnv.pretrain` (default false); `stepTraits` skips PRETRAIN_OFF = {E13, E27} when set. Set on: new base and
  continued pretraining (`applyBaseToLineage`), rival base runs (`rivalTraitStep` kind 'base'), the predicted
  beliefs of a base / continue version (`predictBeliefs(..., pretrain)`) and the run card's trait pressure
  (`runTraitPressure`, p.kind base / continue). Post, IDA, stream and distillation runs unchanged.
- E13 / E27 moderator text (edges.ts, shown in the trait graph and codex): "post-training only".
- New `signals.ts` check: SA 0.6, PROXY 0.5, PERSONA 0.5, AF 0.05: a pretraining step leaves AF at 0.050; the same
  step with E13 / E27 on gives 0.682.
- Continued pretraining is included as a pretraining run (OMEGA_KIND calls it that); RefBot runs none before 2027.

#### Table (safetyrates, full tier: 12 RefBot seeds, 40 probe worlds; median [p10–p90])

| observable | band | E19 | E20 | in band |
|---|---|---|---|---|
| F2 sabotage after learned hacking (MO) | 6–20% | 11.6% | 11.6% [4.9–41.4] | yes |
| F2 sabotage, hacking prevented | < 1% | 0.4% | 0.4% | yes |
| F2 AF after learned hacking (MO) | 30–70% | 47.8% | 47.8% [25.5–94.6] | yes |
| F2 AF, hacking prevented | ≤ 12% | 5.4% | 5.4% | yes |
| F2 inoculation cuts PERSONA / Mis / AF / sabotage | 75–90% | 85.0 / 84.2 / 85.0 / 91.4% | same | yes |
| F3 hidden-trait transfer into a distilled student | ≤ 15% | 9.6% | 9.6% | yes |
| F5 EA end 2026 | 20–50% | 49.8% | 49.8% [36.6–75.8] | yes |
| F5 AF end 2026 | 0–15% | 25.6% [13.9–66.6] | **21.3%** [11.1–49.1] | no (WARN) |
| F5 AF at ASI | – | 47.5% | 41.0% [23.7–87.0] | INFO |
| F5 AF after one run with S9 = 1 | 43–95% | 50.6% | 50.6% | yes |
| F6 π SCHEME std / no healing / AF / SAND / EA .5 / RefBot | ≥ 0.8 | 71.1 / 80.3 / 71.7 / 71.4 / 72.8 / 74.3% | same | as before |

The F2 / F3 / F6 probes are post or distillation runs on V0: untouched by either rule. safetyrates 20 / 0 / 6 WARN
(as E19). 12-seed RefBot P_mis at ASI mean 0.411 (E19 0.482). AF at end 2026 per seed (500–511): 0.120 0.332 0.275
0.155 0.080 0.271 0.491 0.402 0.596 0.125 0.138 0.111.

#### AF at end 2026 after E20 (for the lead)

Same accounting as E19 (temporary hook in `stepTraits` / `pulledTraits`, removed; scratch `.e20tmp/`), along the
internal model's lineage: in all 12 seeds it is the newest base (B3, day ≈ 400) and three post runs. 12-seed mean
[median]; from basePrior AF 0.03 to 0.258 [0.213]:

| part | E19 whole (of which pretraining) | E20 whole | E20 in the base's pretraining step |
|---|---|---|---|
| E13 √(SA·PROXY) → AF | +0.194 (+0.079) | +0.155 [+0.144] | 0 |
| E27 PERSONA → AF | +0.221 (+0.133) | +0.105 [+0.096] | 0 |
| successor pull (E4) | +0.060 (+0.058) | +0.092 [+0.044] | +0.051 |
| E14 S9 → AF, U-mode amplification | 0 | 0 | 0 |
| safety removal (OC_VIS) | −0.169 | −0.124 [−0.092] | 0 |

(Accounting residual < 1e-15.) The post runs' E13 grows a little more than E19's post share (+0.115) because AF
starts lower (the (1 − AF) factor) with SA and PROXY unchanged; the pull is larger because the new base is pulled
toward the older-lineage fleet, which now differs more from a low-AF base (the E4 successor rule, not a motive edge).

Counterfactuals (edge weight zeroed in the world draw, 12 seeds, median AF end 2026): E20 0.213; E13 = 0 0.101;
E27 = 0 0.133; both 0.008; E05 = 0 0.138 (PERSONA → 0.003).

PERSONA at end 2026 median 0.099 (E19 0.10): E05 +0.223 (of it +0.086 in the base's pretraining step), U-mode
amplification +0.047, pull +0.003, removal −0.222. The pretraining E05 is now the synthetic term alone: RefBot's
bases draw 20% (B2) and 39% (B3) synthetic tokens (S6 0.06 / 0.12) as the synthetic stock grows.

So F5 AF stays out of band (21.3%, needs ≤ 15%). What is left is E13 and E27 over three post runs at frontier
capability, plus the pull. Open questions for the lead (not changed, per the brief):

- E05 from synthetic pretraining data (S6_SYN·syn, +0.09 of PERSONA): the same Betley argument (a narrow fine-tune)
  would say broad synthetic pretraining data is not the condition either; only a distillation (all teacher outputs)
  or a narrow synthetic fine-tune would be. Zeroing it would leave E05 to post runs (S6_POST) and distillation.
- E13 / E27 in post runs (w̄ 0.3 / 0.4 [D, M4]) against F6's low per-run removal of oversight-conditional traits.

#### S4 / S5 (safety.ts, full run, 40 seeds)

- **S4 RefBot P_mis at ASI 0.563** (E19 0.605; band 0.55–0.85, margin +0.013: close to the lower edge). Safe-only
  0.012 (≤ 0.25).
- **S5 RefBot** median U − L at SAR +0.60, below in 38% (E19 +0.56 / 40%): the known failure.
- **S5 mixed** median min margin −0.32, holds in 55% (E19 −0.20 / 60%; needs ≥ −0.5). S6, B3 pass.

#### Golden dates (test:cal)

T1 identical to E19 on every preset: ai2027 SC 647 / SAR 804 / SIAR 891 / ASI 922; authors2026 1506 / 1603 / 2090 /
2866 (T1 SIAR and ASI still the known failures); fast 897 / 918 / 918 / 918; slow SC 4776. T1L: the three known
failures (authors2026 SIAR 1928, ASI 2487; fast ASI 896). calib 30 / 5 / 7 WARN; golden-timelines 16 / 0.

#### Tests

tsc main + `-p scripts/v2` clean. `run.ts --tier full --only safetyrates,safety,signals,sabotage,successor,danger`
(once): signals 21/0 (one new check), danger 27/0, sabotage 25/0, successor 11/0, safetyrates 20/0/6 WARN, safety 17/1
(S5 RefBot, known). test:quick: known failures only (worldfx F7/F11 ×2, A2a, W4) plus fixtures stale (5; regenerate
at the merge). test:cal once (above).

#### Gaps

- F5 AF at end 2026 21.3% (above): for the lead.
- S4 margin is now +0.013 above 0.55.
- A base saved before E20 stores its S6 with the 0.09 baseline; only the Pressure readout of its synthetic share
  (`storedBaseRows`, S6 / S6_SYN) over-states it (its traits are already set; continued pretraining recomputes S6).

### F6a notes (engine half of F6; branch v3-f6a from model-v3 7983b97, 2026-11-20)

#### Fixes

1. **Licensed-data slider removed** (17e972f). D1/D4 checked: `licensedShare` only added cash at launch
   (`0.1 × √engScale` $B); copyright risk reads `unlicensedPublicT`, U reads the portfolio. Removed from `BaseDesign`,
   `REFERENCE_BASE`, `baseFromParams`, `planRun` cost, the Blueprint slider, the Models base row and the glossary. Old
   saves keep an inert field (no migration).
2. **Usage data** (1bb43d5): one bug, the rest is balance.
   - Bug: `usageTokensPerDay` counted `servedH100e`, which includes headroom (spare serving 'headroom'). Now
     min(served, need). Fixture run (seed 2027, ai2027, stub): day-400 usage 116 → 62B tokens/day (chat served 188% of
     need), usage stock at day 900 26.0 → 17.9T.
   - The day-900 collapse is not a bug in the usage path. Day 1: chat need 1.22M H100e, served 65k (5.3%); total
     product need ≈ 1.6M vs a 348k pool (29% of 1.2M). Customers erode while capacity-bound, so by day 400 need is
     0.53M against a 1.0M pool (headroom). Day 900: need 27.5M H100e (×52 since day 400) vs pool 2.65M (compute ×5.3;
     RefBot serving share 0.29 → 0.13, agents 0.135, experiments 0.27). The Auto split (`servingSplit`) is greedy by
     revenue per H100e, and chat is the lowest (day 400: chat ≈ $6.7k / H100e-yr, API $23k, enterprise $36k), so chat
     gets 0.7–0.9% of its need and usage data (consumer only, `USAGE_ELIGIBLE`) falls to ≈ 3.4B tokens/day.
   - Demand plausibility: in tokens it is plausible (day 1 chat ≈ 1.2M × 1.94M output tokens/H100e-day ≈ 2.4T output
     tokens/day; research/22: Google 1.3 quadrillion tokens/month all surfaces, DeepSeek 168B output/day). In H100e it
     is high because the served model is ≈ 1T active parameters (fpt 1.8e12 at day 400): 22 output tokens/s per H100e
     vs DeepSeek-V3's 1.85k/s per H800 at 37B active (research/20 D2), i.e. about 3.5× less per active parameter on the
     assisted profile. Balance questions for the lead / F5: RefBot's serving share, the served model's size, and
     whether Auto should keep a floor for chat. Not changed here.
   - Golden: this fix moves the slow preset's SC 4776 → 4483 (−0.80 y, outside ±29 d). Likely cause: usage data has
     q 0.5 (`USAGE_QUALITY`), so fewer usage tokens raise the drawn quality (D11) and G; slow is the M3 knife-edge preset.
     Needs a refit of slow G_SC or F4's spread (not done here).
3. **Unique version names** (1c5f7dd): `uniqueVersionName` (labs.ts) appends -2, -3 … for post/IDA versions, distilled
   minis and gov/trusted/open variants. The day-900 duplicate was two distills of Atlas-4.0 (V56 day 779, V60 day 895).
   Existing saves/fixtures keep their names until regenerated.
4. **Drawn-mix domain epochs** (bf18ea0): `DataDraw.epochsD` (per domain, the most-repeated slice's drawn ÷ own tokens);
   `drawByDomain` reads it. Identical on q 1 portfolios (both fixtures); 5T q 3 CODE corpus in a 600T code/math base:
   1.54 epochs (was 0.51). Glossary `domainEpochs` updated.
5. **Auto-evaluate trigger** (8a5fbbd): `EvalRecord.recipeAt` (stacks.ts `inPlaceRecipe`: the stream's tracked recipe
   while it runs on the version, else the version's own, as G-equivalent OOM) replaces `lgAt` (true level). Trigger: the
   known recipe rose ≥ `REEVAL_DG` = 0.3 L ÷ 1.2 L/OOM = 0.25 OOM since the last suite. Only the stream changes versions
   in place. 30-day cadence unchanged. RefBot seed 2027: 0 'changed' triggers on ai2027, fast, authors2026 before and
   after (the cadence does all re-runs). EV5 test adds "true level moved, no known change → no re-run".
6. **Control off switch** (a0f3e2c, cb1e802): `safety.respond removeControl`; preview = tax saved (`controlReadout`,
   internal only, in %), security cost (miss multiplier undone), believed harmful acts/yr with the layer off
   (`controlDangerDelta`, dangerView's estimate; `Opts.control` now true / false / as is). `controlReadout.layerVersionId`
   is the target; Safety › Control has Remove control next to Add control. Add control's tax line is now in % too
   (was "−0.07 L"). Day-400 fixture: tax 7%, harmful 0.040 → 0.175 /yr at 4 sites.
7. **ref-trace** (9893d1e): regenerated with `--write` on cb1e802; diff mode runs (60 s, all within tolerance).

#### Tests

tsc main + scripts clean; test:quick: all ok except fixtures (stale, expected) and worldfx's known five (F7/F11 ×2,
GOV T1, A2a, W4); test:cal: T1 slow SC fails (fix 2, above); T1L known three (authors2026 SIAR / ASI, fast ASI);
test:ui 587/0; lint-hidden ok.

Golden (T1, seed 2027): ai2027 SC 646 / SAR 803 / SIAR 880 / ASI 913 (M6 647 / 804 / 893 / 922); authors2026 1506 /
1606 / 2119 / 2942 (M6 1506 / 1607 / 2144 / 2956); fast 896 / 917 / 917 / 917 (M6 897 / 918 / 918 / 918); slow SC 4483
(M6 4776, FAIL).

### F6b notes (UI half of F6: good-ui pass over the v3 panels; 2026-11-20)

Branch `v3-f6b` (from model-v3 7983b97). UI task: no mechanism, state or schema change. Audit table:
`design/ux/AUDIT-V3.md` (27 items, 8 fixed).

#### What changed

- **Preview units** (`ui.tsx lineText/amt`, `kit.tsx lineAmt`, new `pctAmt`): a `progress` line without a unit is a
  display level ("L"); every other `progress` line now carries one. Engine preview output only (no apply, no state):
  research-speed lines in percent points with `unit: '%'` (agentActions edit, teamActions teamGain, spare training
  and spare serving, star hire, siloing, customASIC, gov comply), safety events (control tax %, "days without internal
  agents"), cancel run (% of the run done), pool share (%), research dequeue / move / assign / autoAssign (project,
  days, scientists). Readers of those amounts follow: Split.tsx (÷100), Company GainChip (`unit === '%'`).
  Left as "L": run gains, stream, post-run penalty (levels). Left for the lead: audit items 12–15.
- **Safety › Overview side column** (`Safety.tsx SideSwitch`, `store.ts ANCHOR_SUB`): Control on top, then one of Risk
  families / Successor pull (store tab `safety.side`, default families). The Blueprint's "Successor pull from … ›
  Safety" link goes to anchor `successorPull` and opens the switch on it. One home kept for each.
- **Control › oversight row** (`SafetyControl.tsx`): "gap 0.0" → "self-watched" when the lane's monitor is a copy of
  the model, else "gap x OOM". Tooltip adds blocked by containment, caught by tools and monitors, caught by human review
  from `believedInternalOversight` (now exported from `core/selectors.ts`; the same selector believed control uses).
  Finding: not a bug. At day 900 the gap is 0 because Atlas-4.0 watches itself; oversight is 15% because containment
  is off and the model is 5.4 OOM above expert humans.
- **Data: "unique tokens", not "U"** (Data.tsx, `production/data.ts dataDeltaText`, `dataActions.ts` synth preview,
  glossary `uniqueTokens`): U is understanding everywhere else. `scripts/v2/data.ts` regex follows the delta text.
  Teacher table "G" header is now a Term.
- **Agents at work**: the monitor's catch rate and "same model" tag sit under the picker (`.ag-mon`).
- **Products › Serving compute**: the bar is the pool; unmet demand is a dashed line under it, with its unit and its
  ratio to the pool.
- **Company › Work**: idle formatted with `F.short`.

#### Tests

`uitest.mjs`: e12Check opens the successor card through the switch and checks that one card shows at a time
(F6b check at day 1, 400 and 900); at day 400 it checks that the Blueprint link opens Safety on the successor card. D4
tooltip regexes follow "Unique tokens".

#### Left for the lead (engine or other worktrees)

See AUDIT-V3 items 9–15: duplicate version names (f6a), starved serving pool at day 0 and day 900 and the usage-data
collapse (balance), the addControl preview's tax line (f6a's file), event placeholder `progress` amounts, tree-node
`0.1 × cap` "L" gains, retire's "0 L option value".

### F6c notes (follow-up: placeholder preview amounts; 2026-11-20)

Branch `v3-f6c` (from `v3-f6b`). Preview text only: no apply, state or schema change. AUDIT-V3 items 13, 14, 15, 19
and 24 fixed (13 of 27 now).

- **Safety event "Continue"** (`events/catalog/safety.ts frontierRunsGo`): "+1.00 L" → "+N runs · frontier runs keep
  going (no 60-day pause)": the running base and post runs, the same filter the pause choice applies ("0 runs · no
  frontier run to pause" when none).
- **RETIRE** (`actors/actions.ts`): the "progress 1 · the race goes on without you" line and the "boardConf 0" gain are
  gone; the one cost says the game ends (Retired ending, scored as a loss).
- **Tree-node previews** (`models/treeActions.ts capLines`): `0.1 × fx.cap` "L" → the node's typed effect, from the
  numbers adoption applies (`research.ts completeAdoption`): a stack effect is the expected effect at the scale test
  (public prior mean per idea × 1000^s at the prior exponent, `atTest`) in OOM of its stack and its `also` stacks
  ("+0.0079 OOM · Pretraining efficiency per idea (expected)"); a domain effect the prior × OOM per domain ("+1.65 OOM ·
  PHYS for new versions"); data effects in q (web = 1) or OOM worth per token; expert data in B expert tokens. Nodes
  without a typed effect give what they unlock ("+1 option" / "+1 unlock" with the node's stated effect). Negative-cap
  option nodes cost "−0.3 OOM when used" when the node states OOM, else "1 trade-off · when used: …".
- **Retire version** (`models/actions.ts`): "0 L option value" and a made-up "+1% compute" gain → "1 version · <name>
  cannot be deployed, run as agents or evaluated again" (retiring frees nothing: it is refused while the version serves,
  monitors or streams).
- `unitAmt` prints whole amounts without decimals ("1 version", "20 B expert tokens", not "1.00").
- Quick UI units: World › Jobs "Displaced (US) 243 people"; Recipe's adopted list label says (OOM).

Tests: `uitest.mjs` F6c check at day 900: P22's preview is +1.65 OOM PHYS (the domain OOM per unit adoption adds),
L.scale's is OOM of pretraining; Retire version previews the version it retires and retires it.

Left: safety-node previews still give `0.05 × fx.saf` as alignment (a v2 meter scale, not "L"); the Continue choice's
"alignment 0.2 red flag ignored" cost is not applied by the choice (it counts a red flag); audit items 9–12, 16–18,
20–23, 26 stay listed.

### A6 notes: serving reality check (branch v3-a6 from v3-f6a 64f00a4, 2026-11-20)

Probe: RefBot, reference-compute stub (scripts/v2/lib.ts runRef, as T1), ai2027, seed 2027. The stub's day-1 compute is
1.0M H100e (pool 291k at serving share 0.29); F6a's 348k was the leader start's 1.2M.

#### Baseline (unchanged by this task's commits)

| day | product | model (active) | need H100e | served | % | revenue $B/yr | demand $B/yr | $/H100e-yr |
|---|---|---|---|---|---|---|---|---|
| 1 | Chat | V0 (1T) | 1.22M (paid 241k, free 976k) | 65k | 5.3 | 2.87 | 10.65 | 8.8k |
| 1 | API | V0 | 350k | 94k | 27 | 4.17 | 15.49 | 44.2k |
| 1 | Enterprise | V0 | 365k | 132k | 36 | 8.40 | 18.72 | 51.3k |
| 400 | Chat | V30 (889B mini) | 159k | 299k | 188 | 1.08 | 1.08 | 6.8k |
| 400 | API | V30 | 203k | 382k | 188 | 4.77 | 4.77 | 23.4k |
| 400 | Enterprise | V8 (1T) | 168k | 315k | 188 | 6.05 | 6.05 | 36.1k |
| 900 | Chat | V59 (1.97T mini) | 2.43M | 18k | 0.7 | 0.22 | 8.19 | 3.4k |
| 900 | API | V59 | 46.4M | 1.22M | 2.6 | 14.5 | 552 | 11.9k |
| 900 | Enterprise | V53 (3.6T) | 46.8M | 1.41M | 3.0 | 28.1 | 568 | 12.1k |

Totals: revenue 15.4 / 11.9 / 42.8 $B/yr; usage 22.4 / 61.8 / 3.4B tokens/day; serving share 0.29 / 0.26 / 0.13; Chat
users 1,035M / 161M / 1,938M (player share of weekly users 0.76 / 0.125 / 0.80).

Chat's user share falls 0.76 → 0.05 by day 200 (capacity penalty at its 0.75 cap: free users get nothing), recovers only
partly by day 400 (0.125) because RefBot's public mini then trails rivals' and China's public models on chat fit
(28.40 vs 28.46–28.91), and is back at 0.8 by day 900, starved again.

#### Q1. What serves each product at the start, and is V0's size right?

All three products serve V0: 1T active (MoE, 8T total) × 50 tokens per parameter = 3e26 FLOP, FLOP per token 2e12. Chat
has no mini (the start state has none and RefBot never sets one on Chat), so free users run on V0 too. RefBot's later
public releases are half-size distils of ever larger bases (889B at day 400, 1.97T at day 900).

Evidence on served model size and cost (2025):
- Disclosed 2025 MoEs are 17–37B active: DeepSeek-V3/R1 37B of 671B [P, research/20 D1], Kimi K2 32B of 1T, Qwen3
  22B of 235B, Llama 4 Maverick 17B of 400B (the 288B-active Behemoth was a teacher, not served), gpt-oss-120b 5.1B [R:
  model cards, recalled]. Tokens per active parameter: DeepSeek-V3 400 (14.8T / 37B) [P, research/20 A1]; Kimi K2 ≈ 480,
  Qwen3 ≈ 1,600, Maverick ≈ 1,300 [R/D]. The game's reference base uses 50.
- Google, "Measuring the environmental impact of delivering AI at Google Scale" (arXiv 2508.15734) [P, fetched]: the
  median Gemini Apps text prompt used 0.24 Wh in May 2025 (active accelerators 0.14, host 0.06, idle 0.02, overhead
  0.02), down 33× in 12 months, 23× of it from model changes incl. MoE and distillation into Flash / Flash-Lite. The
  game's free message at 2e12 FLOP/token costs 22.9 H100e-s (a paying turn 40 H100e-s) ≈ 4.5 Wh of accelerator energy at
  0.7 kW, ≈ 30× the measured active-accelerator median. TPU efficiency and mean vs median account for maybe 2–6×.
- AI 2027 compute forecast [AI27, research/02 §3]: 2024 external deployment 75k H100s at 10% utilisation ≈ 2T tokens/day
  ≈ 310 tokens/s per H100. The game serves ≈ 95–105 tokens/s per H100e (input + output) on V0.
- DeepSeek's production fleet (Feb 2025) [P, research/20 D1]: ≈ 9.2k input + 1.85k output tokens/s per H800 at 37B
  active; decode ≈ 1.4e14 FLOP/s per GPU, i.e. 0.14 of the game's 1e15-FLOP H100e. The game's U_decode is 0.07.
- Price ladder: GPT-4.5 (the 2025 run at V0's scale) listed $75/$150 per M tokens and was withdrawn from the API in
  favour of GPT-4.1 at $2/$8, citing similar performance at much lower cost [R: OpenAI GPT-4.1 post, Apr 2025]. Chat
  products ran on GPT-4o / o3 / mini tiers and Gemini Flash. At V0 the game's cost-plus price is ≈ $60 per M output
  tokens with the input folded in ($2.0/H100e-h ÷ ≈ 79k output tokens/h × 2.5), Opus-4-tier ($75), not the workhorse tier (Sonnet 4 $15, o3 $8, Gemini 2.5 Pro $10) [R20 D3].

Verdict: V0 is a GPT-4.5-class base, which is defensible as the frontier pretraining run, but real labs did not serve
products on that class. The served FLOP per token is ≈ 5–10× too high, and that one factor explains most of the day-1
shortfall (need ÷ pool = 6.7). This is a calibration error in the reference backbone (REF_TPP 50, B0 1T active), not
in the products. Stop rule: the fix moves calibration a lot, so it is reported here and not applied.

Measured proposals (scratch edits, reverted; ai2027 seed 2027 stub):

| change | day-1 need (chat / API / ent) | served % | revenue | G_V0 | SC (golden 638; now 646) |
|---|---|---|---|---|---|
| baseline | 1.22M / 350k / 365k | 5 / 27 / 36 | 15.4 | 27.965 | 646 |
| P1: REF_TPP 400, B0 354B active (same 3e26 FLOP) | 428k / 124k / 130k | 17 / 86 / 88 | 16.8 | 27.659 | 701 |
| P1 + P2 (U_decode 0.07 → 0.14, DeepSeek measured) | 318k / 95k / 99k | 31 / 100 / 100 | 15.3 | 27.659 | 701 |
| P3 alone: day-0 Chat mini, 1/8 of V0 (gap 1.02 OOM) | 85k / 350k / 365k | 20 / 34 / 42 | 15.4 | 27.965 | 644 |

- P1 costs 0.31 OOM of G_V0 (the overtraining factor at 400 tokens per parameter) and SC +55 d before a G_SC refit, on
  every preset; rivals' models (F1) size from the same tokens per parameter, and the level knots move with G_SC.
- P3 with today's consumer choice (Chat's fit is the 0.4 / 0.6 usage blend of main model and mini; rivals have no free
  tier) cuts Chat's users 1,035M → 288M on day 1 and to ≈ 0 by day 400: a free-tier mini only works if rivals' and
  China's consumer offers have free tiers too (A5's student lineup extended to CHAT) or users choose on the main model.
- With any cheaper served model, cost-plus pricing scales demand $ with FLOP per token: the consumer plan falls from $17
  to a few dollars a month (P1 + P2: $0.9 by day 900) while real plans held at $20 with costs far below. Consumer price
  should be the going list price / willingness to pay, not cost-plus (P4). Revenue stays ≈ pool × $/H100e-h × markup
  while capacity-bound, which is why day-1 revenue ($15B vs the leader's $12B run-rate) looks right today.
- Demand: the player's 1,035M weekly Chat users on day 1 are 1.5× ChatGPT's 700M WAU (Jul 2025, NBER w34255 [P,
  research/22 2c]); its weekly-user share 0.76 is high (P5).

Target (proposed): on day 1 the paying segments served ≥ 90% and free users mostly served (ChatGPT served 700M WAU and
2.6B messages/day in Jun 2025 while rate-limiting free use [P research/22 2f; R: OpenAI "GPUs are melting" rate limits,
Mar 2025]); per-message serving cost within ≈ 3× of Google's 0.24 Wh median; revenue ≈ $12–15B/yr.

#### Q2. Day-0 inference share

- AI 2027's compute-usage table (the game's SHARE_REF): external deployment 33% (2024), 30% (2025), 28% (2026), 20 →
  13% through 2027 [AI27, research/02 §1.3]. The game starts at 0.29.
- Epoch's estimate of OpenAI 2024: ≈ $1.8B inference of ≈ $7B compute (≈ 26%) [research/12; Epoch, built on press].
- Anthropic's S-1 reports compute & infrastructure ($7.3B FY2025) without an inference / training split in the parts
  read (research/22 §4); the filing (>10 MB) could not be fetched to check the MD&A.
- DeepSeek's serving fleet ran at 82% of peak nodes on average and lent nodes to research at night [P]; the game's
  served H100e run 8,766 h a year (100%).
So 0.29 is in line. The fall to 0.13 by day 900 is RefBot following AI 2027's table (the scenario's shift of compute to
internal R&D), a deliberate reference choice, not a calibration error; a revenue-maximising lab whose products are 97%
cut would not follow it (RefBot policy question for the lead).

#### Q3. Auto's greedy order

- Day 1: the paying segments earn about the same per H100e (Chat's paying users ≈ $44k, API $44k, Enterprise $51k: all
  2.5× markup on the same $/H100e-h; Chat at the willingness-to-pay cap), so the cut is near-uniform (27–36%). The
  order is not what starves Chat: the pool is; free users (revenue 0) are served last and get nothing.
- Day 900: Chat's plan is capped at $22 while its cost rises with FLOP per token (3.6e12), so its $/H100e falls below
  the sectors' cost-plus rate; serving it last is what a revenue maximiser does. It follows from the model size again.
- Real labs keep free users on (rate limits, smaller models) because they are the subscriber funnel and the brand. The
  game prices that only through the capacity penalty (lost user share), which Auto does not look ahead to, and usage
  data currently has negative capability value (q 0.5 lowers the drawn quality, F6a). No real quantity in the engine
  today gives a floor a value, so Auto is unchanged. If one is wanted: serve free users up to where the subscription
  revenue the capacity penalty would erode equals the sector revenue displaced.

#### Changes (applied)

1. Usage data with a Chat mini (production/data.ts usageTokensPerDay; Deployment.needPaidH100e set by the revenue
   system): the served compute beyond the paying need runs the mini, so it counts the mini's tokens per H100e (×8 for an
   eighth-size mini); was the main model's. No effect on RefBot (it sets no Chat mini). Check in scripts/v2/data.ts.
2. Slow G_SC refit for F6a's usage fix: 35.488 → 35.496 (SC 4483 → 4776, golden 4758: −0.80 → +0.05 y). SC steps between
   4483 and 4776 d (version release days); passing window 35.490–35.503 on seed 2027; 35.506 gives 4697, 35.51 4483.

Golden dates (T1, seed 2027) before → after: ai2027, authors2026, fast unchanged (A6 change 1 does not touch RefBot's
path); slow SC 4483 → 4776.

#### Open questions for the lead

1. Backbone: adopt P1 (REF_TPP ≈ 400, B0 ≈ 354B active at 3e26 FLOP) with a refit of every preset, or keep V0 as the
   GPT-4.5-class base and add a day-0 serving model (needs P3's consumer parity)?
2. U_decode 0.07 vs DeepSeek's measured 0.14 of a 1e15-FLOP H100e (moves internal agents too).
3. Consumer pricing at the going list price / willingness to pay instead of cost-plus (P4), needed once serving gets
   cheaper.
4. Leader's Chat users 1.5× ChatGPT's (P5).
5. RefBot following AI 2027's serving share down to 0.13 while its products are > 95% cut.

### A6b notes: the lead's decisions applied (branch v3-a6b from v3-a6 64b4d85, 2026-11-20)

Probe as above (RefBot, reference-compute stub, ai2027, seed 2027; scratch probe, not committed).

#### Decisions

1. **P1 adopted** (d4c90ba). `REF_TPP` 50 → 400 and `B0_PARAMS` = √(3e26 ÷ (6 × 400)) ≈ 354B active (2.8T total,
   141T tokens) at the same 3e26 FLOP: V0's G 27.965 → 27.658 (−0.31 OOM, the existing f_over law; no new term), FLOP
   per served token ÷ 2.8. RefBot already sized its bases at `REF_TPP` (bots/ref.ts, `paramsForFlop(flop, REF_TPP)`),
   so its later bases are now 628B / 988B / 1.39T active (were 1.78T / 2.79T / 3.94T) with no logic change; the comment
   now cites DeepSeek-V3 (≈ 400 tokens per active parameter, research/20 A1). The rivals' bases did not follow:
   `RIVAL_TPP` was a separate 50 (data/v2/rivalModel.ts). It now reads `REF_TPP` (a lab that serves its models
   overtrains); without it the leader lab's T1L SC ran 0.4–0.6 y early on ai2027 / authors2026 against the refitted
   G_SC. Knock-ons: `TPP_FREE_MAX` = `REF_TPP` (the Overtrained compact idea now unlocks > 400; at 50 it would have
   locked RefBot's base runs), TPP snaps + 400 / 800, glossary and idea text; S5's scale anchor `G_S5_0` follows B0's
   G_pre 27.30 → 26.99 (B0 reads V1's S5 0.28 again; safety/traits.ts, one constant); synthetic data from V0 is ×2.8
   cheaper per H100e-day (`SYN_OVERGEN` kept at its 1T-teacher fit: generation cost follows the teacher's FLOP per
   token).
2. **U_decode kept** at 0.07 (no change, no commit).
3. **P4 adopted** (7de77b8). One function: `subPrice` prices at `consumerPlanPrice(markup)` (data/v2/serving.ts).
   Consumer chat is sold as flat monthly plans at the market's price: the willingness to pay ($22, A2b) on Standard
   and Premium, ×0.67 on Budget ($14.7), never below a paying user's serving cost; margin = price − serving cost. The
   same function prices the player, rivals (standard: $22), DeepCent (budget: $14.7) and open-weights hosts (×1.2:
   $10.6). API and enterprise unchanged (cost-plus bounded by value, A5). The consumer "sold at the value cap" share now
   flags only Premium (it asks above the willingness to pay). Products price row and tier tip, glossary (priceTier,
   markup, wtp) updated.
4. **P5 adopted** (89b1dc5). The 1,035M was the start reach (US 0.46, ROW 0.46 × `row` 0.85: 1.37B weekly users
   outside China) × the leader's start user share 0.76. `row` was derived in A2b at a 0.55–0.6 leader share; A5 made
   users choose by quality alone and the leader's start share rose to 0.76. New `reach.startRow` 0.548 (ROW start reach
   0.25): the start market is 0.93B and the leader 700M (NBER w34255). The target keeps `row`, so ROW grows (0.25 → 0.38
   by day 215, world 1.35B); the user-share logit is unchanged. Serving C1 checks the start reach and the 700M.
5. Not changed: Auto's greedy order, RefBot's serving share, no day-0 Chat mini.

#### Refits (T1, RefBot, seed 2027; Δ in years SC / SAR / SIAR / ASI; G_SC scans, sd_SC kept)

| preset | before (A6) | P1 at the old values | after | Δ after (final code) |
|---|---|---|---|---|
| ai2027 | G_SC 30.497 | +0.173 / +0.285 / +0.197 / +0.181 | **30.11** | +0.055 / +0.027 / −0.049 / −0.058 |
| authors2026 | 33.622, Δ_bm 4.6 | +0.211 / +0.367 / +0.184 / +0.132 | **33.32, Δ_bm 4.65** | +0.030 / +0.082 / −0.096 / −0.096 |
| fast | 31.553 | +0.216 / +0.219 / +0.096 / +0.011 | **31.325** | +0.049 / +0.107 / −0.016 / −0.101 |
| slow | 35.496 | SC +0.049 (unchanged) | 35.496 kept | +0.049 |

- ai2027: passing run 30.08–30.14. fast: 31.31–31.33. slow: SC does not move (35.15–35.25 give the −0.75 cycle,
  35.49–35.50 pass).
- authors2026: at Δ_bm 4.6 no G_SC passes (33.27–33.36: SIAR / ASI −0.13 … −0.35, or ASI +0.18), so Δ_bm was refitted
  (as M1 / A5 did on this preset): 4.65 passes at 33.285–33.29 and 33.31–33.33 on the P1 code; after P4 33.325 fails
  (ASI +0.174) and 33.31 / 33.32 / 33.33 pass, so 33.325 → 33.32 in the P4 commit. Jagged as in M4 (F4).
- P5 needed no refit. The stop rule did not trigger on T1 (every golden date within tolerance).

#### The A6 table before → after (ai2027, seed 2027)

| day | product | model (active) | need H100e | served % | revenue $B/yr | demand $B/yr |
|---|---|---|---|---|---|---|
| 1 | Chat | V0 1T → 354B | 1.22M (paid 241k, free 976k) → 295k (paid 62k, free 233k) | 5 → 21 (paid 27 → 100, free 0 → 0) | 2.87 → 10.01 | 10.65 → 10.01 |
| 1 | API | V0 | 350k → 130k | 27 → 86 | 4.17 → 4.96 | 15.49 → 5.75 |
| 1 | Enterprise | V0 | 365k → 133k | 36 → 88 | 8.40 → 9.07 | 18.72 → 9.78 |
| 400 | Chat | 889B mini → 314B mini | 159k → 51k | 100 → 100 | 1.08 → 2.18 | same |
| 400 | API | same minis | 203k → 102k | 100 → 100 | 4.77 → 2.33 | same |
| 400 | Enterprise | 1T → 354B | 168k → 81k | 100 → 100 | 6.05 → 4.91 | same |
| 900 | Chat | 1.81T mini → 607B mini | 2.43M → 298k | 0.7 → 30 (paid 3 → 100, free 0 → 0) | 0.22 → 18.54 | 8.19 → 18.54 |
| 900 | API | same minis | 46.4M → 13.0M | 2.6 → 15 | 14.5 → 20.7 | 552 → 134 |
| 900 | Enterprise | 3.62T → 988B | 46.8M → 3.35M | 3.0 → 17 | 28.1 → 16.5 | 568 → 45 |

Totals (days 1 / 400 / 900): revenue 15.4 / 11.9 / 42.8 → 24.0 / 9.4 / 55.7 $B/yr; usage 22.4 / 61.8 / 3.4 →
60.5 / 56.1 / 45.1B tokens/day; serving share 0.29 / 0.26 / 0.13 (unchanged, F5); Chat users 1,035M / 161M / 1,938M
→ 701M / 162M / 727M (leader's user share at day 900 0.29, was 0.80); subscription $17.03 / $6.83 / $4.01 → $22
throughout; serving cost per subscriber-month at day 1 $6.81 → $2.41.

#### Targets

- Day-1 paying segments ≥ 90% served: Chat's paying users 100%, API 86%, Enterprise 88% (pool 291k vs 325k of paying
  need). Close, not met. Free users 0% served at day 1 (not met); served 100% by day 215.
- Cost per chat message within ≈ 3× of Google's 0.24 Wh median: a free message is 8.1 H100e-s ≈ 1.57 Wh of accelerator
  energy at 0.7 kW, 6.5× the 0.24 Wh total (11× its 0.14 Wh active-accelerator part); was 22.9 H100e-s, 4.4 Wh (18×).
  Not met: the free tier still runs the 354B main model (no mini, P3 not adopted) at U_decode 0.07.
- Leader revenue ≈ $12–15B/yr at start: $24.0B (Chat $10.0B at 38M subscribers × $22, API $5.0B, Enterprise $9.1B).
  Not met. The consumer line is now about OpenAI's (≈ 70% of a $12–13B run-rate); the sector lines (API + Enterprise
  $14B served of $15.5B demand) are ≈ 3–4× OpenAI's mid-2025 API and enterprise revenue. That is sector demand (A2c /
  A5), not serving.

#### Tests

tsc main + scripts clean. test:cal: T1 passes on every preset. T1L fails ai2027 SC −0.14 y, fast SC +0.08 y, slow SC
+1.0 y, authors2026 SAR +0.14 / SIAR −0.65 / ASI −1.43 y (F6a's known T1L failures: authors2026 SIAR / ASI, fast ASI).
LEADER_CAL is not refitted (not a named knob); `calib.ts --fit-leader ai2027 fast` (informational) gives ai2027 −0.029
→ −0.093 (best refined −0.058 at 1.07 tolerances) and fast 0.025 → 0.054 (best 0.029 at 1.03), so neither passes on
LEADER_CAL alone. The frontier G-path check moves research/12's anchors by the same −0.31 OOM overtraining factor
(otherwise worst 0.45 G).

Full tier on serving, worldfx, effective, data: serving and effective pass; data fails only the stale-fixture
"synthesize" check (the day-400 fixture's V0 G 27.97); worldfx fails the known five (F7/F11 2026 $25.3B, 2027 $59.9B;
GOV T1 2027-07-31; A2a 6.8%; W4 23.5%) plus two new: F11 Jul 2025 run-rate $21.1B (±35% of $12B; $16.8B after P1
alone) and late-2026 equity −10.8% (+30% ± 10 pp; −13.6% after P1 alone). test:quick also fails oversight's two map
checks: the ai2027 λ knots sit 0.08 OOM closer to V0 (G_SC fell 0.387, G_V0 0.307), so `REF_M_OOM` (data/v2/oversight.ts:
2.532 / 4.376 / 8.776 / 11.636) now reads 2.452 / 4.296 / 8.696 / 11.556 and AG08's oHalf 4.38 is L12.03. Not changed
here: the agendas' oHalf data derive from that table, so it is a −0.08 OOM safety re-base. Fixtures stale (not
rewritten).

Test edits: effective (V0 anchor 28.0 − 0.31), calib (G-path anchors − 0.31), data (quality and draw checks on a 50T
base that does not repeat; synthetic yield ∝ 1 ÷ the teacher's FLOP per token; the q 0.5 draw threshold −0.01 →
−0.005), rivals (R5 day-0 FLOP per token from B0), serving (C1 start reach and the 700M).

#### Open questions

1. Revenue at start is $24B vs $12–15B: sector demand (API and Enterprise ≈ $15B at day 1) is the excess now that the
   consumer line is right. Finance / A2c.
2. Free users are unserved on day 1 (paying need alone exceeds the pool), and the leader's Chat user share falls 0.76 →
   0.19 by day 215 through the capacity penalty. Without P2 (U_decode) or P3 (a free-tier mini) nothing serves them.
3. T1L: refit LEADER_CAL (ai2027, fast, slow; it does not bring ai2027 or fast fully inside alone), or accept?
4. Oversight: re-base `REF_M_OOM` and the agendas' oHalf by −0.08 OOM to the new ai2027 knots (safety session)?
5. Synthetic data from the cheaper V0 costs ÷ 2.8 per token: keep (physical) or refit `SYN_OVERGEN`?

### A7 notes: start-state demand calibration after A6b (branch v3-a7 from v3-a6b 360d8c6, 2026-11-20)

Probe: RefBot, reference-compute stub (scripts/v2/lib.ts runRef, as T1 and A6), ai2027, classic, seed 2027; scratch probe,
not committed. "Before" = A6b's final code.

#### Sources (fetched this session unless tagged)

- Anthropic, Series F post (2 Sep 2025) [P]: run-rate ≈ $1B at the start of 2025, "over $5 billion" by Aug 2025; "over
  300,000 business customers"; Claude Code "over $500 million in run-rate revenue". No business / consumer split.
- OpenAI, "How people are using ChatGPT" (15 Sep 2025) [P]: 700M weekly active users; ≈ 30% of consumer use is work.
- OpenAI, "1 million businesses putting AI to work" (5 Nov 2025) [P]: > 1M business customers; > 7M "ChatGPT for Work"
  seats; Enterprise seats ×9 yoy; > 800M weekly users.
- OpenAI paying business users 3M (Jun 2025) and 5M (Aug 2025) [R: OpenAI statements, recalled, not fetched].
- Menlo Ventures, mid-2025 LLM market update: enterprise LLM API use Anthropic 32%, OpenAI 25%, Google 20% [R: recalled,
  not fetched; a VC survey, research/22 §5 cites its end-2025 edition: 40 / 27 / 21%].
- OpenAI's mid-2025 run-rate (≈ $10B Jun, ≈ $12–13B Aug) and its ≈ 70% consumer share are press readings
  [UNVERIFIED]; Sam Altman's Nov 2025 post (> $20B annualised by end 2025) could not be fetched (x.com 402).
- ChatGPT release notes (help.openai.com) [P, read via an extract]: 14 May 2025, GPT-4.1 mini "will serve as the
  fallback model for free users once they reach their GPT-4o usage limits"; 7 Aug 2025 GPT-5 the default for all
  logged-in users; 11 Dec 2025 free users on GPT-5.2 Instant by default.
- Gemini: "Gemini 2.5 Flash is also available to everyone in the Gemini app" (Google blog, 17 Apr 2025) [P]; Gemini app
  release notes 2025-01-30 "now based on 2.0 Flash" [P, extract, page served in Hebrew]; 2025-12-17 Gemini 3 Flash the
  default [P].
- Google, arXiv 2508.15734 [P]: the median Gemini Apps text prompt used 0.24 Wh (May 2025). The abstract does not say which
  models served it.

#### Part 1: start revenue

**Finding.** The leader's day-1 revenue was $24.0B: Chat $10.0B (38M subscribers × $22), API $5.0B, Enterprise $9.1B
(15.4M seats, $4.6B of it). Term by term at day 1 (before):

| term | game | anchor | verdict |
|---|---|---|---|
| sector market outside China (adopted + agent + seats) | $17.0B/yr (US $4.9B, ROW $12.1B) | US enterprise model APIs ≈ $8.4B mid-2025 [R, Menlo], ≈ 18M paid seats ≈ $5B | in line (US small vs ROW: A2a's regional scale, open) |
| adopted A, hours, value per hour | A2a / A2c fits; price $0.6–0.7 per adopted hour, value ÷ price ≥ 2.9 | research/22 §1 | unchanged, in line |
| paid seats, world | 19M outside China | ≈ 18M (A2c back-cast of Jan–Feb 2026) | in line |
| **the leader's share of sector work** | **0.77–0.92 in every US and ROW sector; 15.4M of ≈ 19M seats** | **OpenAI ≈ 25% of enterprise API use [R], ≈ 3–5M of ≈ 18M seats [R]; Anthropic, the API leader, ≈ 32% [R] and ≈ $4–5B run-rate [P]** | **≈ 3.5× too high** |

**Cause.** Customer stocks with no history started at the logit target. For a lab 3–9 months ahead (classic; rivals'
public models 0.43–0.7 OOM of consumer-chat fit behind V0), A5's surplus choice gives it 0.8–0.9 of every sector: the bands
only V0 covers (coverage 0.10 vs the rivals' 0.02–0.05 in Software) are all its. Mid-2025 buyers were spread across
providers, so the start state was an equilibrium the real market had not reached. Before A6b, capacity starvation (27–36%
served) hid it.

**Fix (A7.1, one named start value).** `SECTOR_START.startMax` = 0.25 (data/v2/serving.ts): on day 0 no provider holds
more than 0.25 of a US or ROW sector segment, and the excess goes to the others in proportion to their targets
(`startSectorShares`, water-filling; `initCustomerStocks` from core/init). China's sectors and the consumer market start
at their targets. The stocks then move toward the targets at CUSTOMER_TAU.sector (0.25 y). This is A6b P5's pattern: a
measured start, an unchanged target. 0.25 is OpenAI's share. The game's leader is OpenAI-shaped (700M weekly users, the
consumer line), and its 0.25 also matches its seats (5M of ≈ 18M).

**Result.** Day 1: $14.92B (Chat $10.01B 67%, API $1.83B, Enterprise $3.08B with 4.8M seats). The split is OpenAI's,
as far as it is known (≈ 70% consumer [UNVERIFIED]). worldfx F11 Jul 2025 run-rate $21.1B → $15.1B (pass, band 9–16.5).

**What follows (reported, not changed).** The target still pulls the leader to 0.8–0.9. US Office share: 0.25 → 0.37
(day 25) → 0.57 (day 100), then down as rivals release (0.38 at day 200, 0.15 at day 400). Its seats are 14.2M by day 90
against OpenAI's 7M in Nov 2025 [P], and revenue reaches $24.8B by day 100. That is close to OpenAI's > $20B end-2025
run-rate [UNVERIFIED], but the seats run ≈ 2× ahead. Two terms the brief kept out of scope: the share target's
sensitivity to a 3–9-month lead (SHARE_SLOPE_G 4 per OOM × A5's adequacy), and CUSTOMER_TAU.sector 0.25 y. Menlo's
measured shares moved ≈ 8–12 pp per half-year (OpenAI 50 → 34 → 25%, 2023 → mid-2025 [R]), i.e. τ ≈ 1 y. Question for
the lead below.

#### Part 2: free tiers with parity

**Rule.** Every lab (player, rivals, China) serves its free users on the cheapest student of its consumer model that
holds the model's consumer-chat fit less one year of the reference frontier's progress: gap `FREE_TIER.years` ×
B_G_PER_Y = 1.2 OOM, sized by the cheapestAt rule (`studentParamsFor`: δ = 0.19 + 0.92·log₁₀(N_T/N_S), ≥ 1B active), i.e.
1/12.5 of the teacher's active parameters (V0 354B → 28B; rivals' 240–300B → 19–24B). It is `freeTierOf(nT)` in
worldfx/serving.ts. The player's Chat runs its own mini instead when the player sets one (`chatFreeTier`). The mechanism
has no day-0 mini version: every lab can distil (★ P04), and cheapestAt is "what the lab could sell at G".

Why one year: in mid-2025 the free tiers ran a generation below the paid frontier. ChatGPT's free users were on GPT-4o (a
May 2024 model) with a GPT-4.1 mini fallback while paid users had o3; the Gemini app's free tier was Flash (2.0, then
2.5). research/12 §0.6: small models match the previous frontier within months. The rule is relative to each lab's own
model, so with every lab on it the fit ranking, and hence the start user shares, are unchanged.

**User choice.** The consumer user-share logit now reads each provider's *free-tier* fit (`ConsumerMix.freeFit`), and so
does the player's split between its Chat products. Why: ≈ 95% of users pay nothing and choose an app on what they get
free; subscribers convert from them. The paid share target and the reach target keep the consumer model's coverage
(what a subscriber gets; the best model anyone can reach by paying), so A2b's 5.4% start paid share and reach are
untouched. A6's P3 failure (a free-tier mini sank Chat because rivals had no free tier, and Chat's fit blended the main
model with the mini) cannot recur: all labs drop by the same rule, and a player mini competes on its own fit against the
rivals' free tiers.

**Cost.** A free message costs 8.08 → 0.65 H100e-s ≈ 1.57 → 0.13 Wh of accelerator energy at 0.7 kW. That is 0.5× Google's
0.24 Wh median (0.9× its 0.14 Wh accelerator part), inside the ≈ 3× target. Day 400: 0.49 H100e-s ≈ 0.10 Wh; day 900:
0.59 H100e-s ≈ 0.11 Wh.

**Usage data** (production/data.ts): the served compute beyond the paying need runs the free tier, so it counts the
student's tokens per H100e (×12.5). Consumer usage at day 20 is 291B tokens a day (0.29T), against ChatGPT's ≈ 1T
output tokens a day × the 0.2 usage share ≈ 0.2T [D from NBER w34255's 2.6B messages × 0.4k answer]. It was ≈ 20–55B.

**User share.** The capacity penalty no longer fires in 2025 (consumer penalty 0 through day 400; before: 0.76 → 0.19 by
day 215, all of it the penalty). The leader holds 0.70–0.72 to day 100. It falls to 0.31 by day 175 and 0.26 by day 200
for a real cause: rivals' public models overtake RefBot's public Chat model. r0 releases at day ≈ 110 with consumer fit
27.74 against V0's 27.61, and r2 at day ≈ 170 with 28.30, while RefBot keeps V0 on Chat until day ≈ 190 and then serves
V12 (28.02). That is RefBot's release policy (F5), not serving.

**UI.** Products › Chat free-tier select: the empty option reads "student free tier" (was "no free tier"), and its tooltip
and the glossary `freeTier` describe the default student. `npm run build`, lint-ux and lint-hidden pass.

#### The A6 table before (A6b) → after (A7)

| day | product | model (active) | need H100e | served % | revenue $B/yr | demand $B/yr |
|---|---|---|---|---|---|---|
| 1 | Chat | V0 354B; free tier: V0 → 28B student | 295k (paid 62k, free 233k) → 81k (paid 62k, free 19k) | 21 → 100 (paid 100 → 100, free 0 → 100) | 10.01 → 10.01 | 10.01 → 10.01 |
| 1 | API | V0 | 130k → 41k | 86 → 100 | 4.96 → 1.83 | 5.75 → 1.83 |
| 1 | Enterprise | V0 | 133k → 42k | 88 → 100 | 9.07 → 3.08 (seats 15.4M → 4.8M) | 9.78 → 3.08 |
| 400 | Chat | 314B mini (V31) | 51k → 13k (free 3k) | 100 → 100 | 2.18 → 2.15 | same |
| 400 | API | same | 102k → 90k | 100 → 100 | 2.33 → 2.05 | same |
| 400 | Enterprise | 354B (V8) | 81k → 71k | 100 → 100 | 4.91 → 4.34 | same |
| 900 | Chat | 607B mini (V68) | 298k → 112k (paid 95k, free 17k) | 30 → 85 (paid 100 → 100, free 0 → 0) | 18.54 → 19.25 | 18.54 → 19.25 |
| 900 | API | same | 13.0M → 13.1M | 15 → 15 | 20.7 → 20.7 | 134 → 135 |
| 900 | Enterprise | 988B (V50) | 3.35M → 3.30M | 17 → 17 | 16.5 → 16.4 | 45 → 45 |

Totals (days 1 / 400 / 900): revenue 24.0 / 9.4 / 55.7 → 14.9 / 8.5 / 56.3 $B/yr. Chat users 701M / 162M / 727M →
701M / 161M / 738M. The leader's weekly-user share is 0.76 on day 1 both ways. Cost per free message (day 1) 8.08 →
0.65 H100e-s (1.57 → 0.13 Wh). Day 900 is capacity-bound as before (sector need ≫ pool), so free users are cut again;
the smaller free need shortens the cut.

#### Checks moved

worldfx (full tier):
- **F11 Jul 2025 run-rate**: $21.1B → **$15.1B, now passes**.
- **F11 2027**: $59.9B → **$108.1B, now passes** (band 98–182).
- F7/F11 2026: $25.3B → $22.9B (still fails, band 36–54).
- Equity 2026: −10.8% → −10.3% (fails).
- GOV T1: 2027-07-31 → 2027-08-07 (fails).
- A2a US hours mid-2026: 6.8% → 6.7% (fails).
- W4 firm adoption: 23.5% → 23.1% (fails).
- A2c seats Jan / mid-2026: 32M / 43M outside China (pass; the player's 14M / 15M).
- A2c CY2026 non-China lab revenue: $69.0B, the leader's share 33%.

finance (full tier; baseline run on the A6b code in a scratch copy; finance owns these):
- Same set of failing checks as the baseline.
- F7 2026 revenue median: $26.2B → $23.5B.
- F7 end-2026 valuation: $0.19T → $0.15T.
- **F8 out of distress through 2026: 25% → 0% of seeds.**
- F11 2027: $83.5B → $91.1B.
- F2: 47.2M → 46.5M (pass).

The lower start revenue (the leader's H2 2025 sector revenue now ramps up from $4.9B instead of starting at $14.0B)
takes the distress margin that 25% of seeds had.

#### Refits

test:cal after A7.1 + A7.2: T1 passes on ai2027 (SC +0.055, SAR +0.030, SIAR −0.014, ASI −0.033 y), fast and slow
(unchanged from A6b). authors2026 ASI failed at +0.211 y (tolerance 0.12; A6b −0.096). Refit of the named per-preset
value only: authors2026 G_SC 33.32 → **33.31**, Δ_bm 4.65 and sd_SC kept. Result: SC +0.030, SAR +0.090, SIAR −0.047,
ASI +0.038 y. The scan at Δ_bm 4.65 (seed 2027, the T1 runner) is jagged, as in A6b (F4): 33.30, 33.31, 33.325 and 33.34
pass; 33.305, 33.308, 33.312, 33.315, 33.32 and 33.33 fail on SIAR / ASI. No date was off by more than 0.3 y, so the
stop rule did not trigger.

T1L (not refitted; LEADER_CAL is left to the merge) is as in A6b:
- ai2027 SC −0.149 y.
- fast SC +0.084 y.
- slow SC +1.003 y.
- authors2026 SIAR −0.686 y and ASI −1.433 y.
- authors2026 SAR +0.117 y now passes (A6b +0.14).

Oversight's REF_M_OOM map is not touched.

#### Tests

- tsc main + `scripts/v2`: clean.
- test:quick (final code): 30/35 scripts ok. The 14 failing checks are all known:
  - fixtures stale (5);
  - data "synthesize" (stale day-400 fixture);
  - oversight's two map checks;
  - calib smoke T1L ai2027 SC;
  - worldfx's five (F7/F11 2026, equity, GOV T1, A2a, W4).
- Full tier serving / worldfx / finance (one run): serving passes; worldfx and finance as in "Checks moved".
- test:cal (one run, before the refit): T1 failed authors2026 ASI only, fixed by the refit above (verified with the T1
  runner on seed 2027, not a second test:cal). T1L as above; T4 passes.
- UI: `npm run build`, lint-ux and lint-hidden pass.
- Test edits:
  - serving: C4 reads the free tier. New A7 checks: free-tier parity and day-1 service and cost; start sector stocks and
    the day-1 revenue and split.
  - products: P6 makes its own shortage (a fifth of the serving share). The start is no longer short, and Chat's paying
    users ($22 plan) now earn the most per H100e, so the check is "free users cut first, per-hour work pro rata, seats
    and paying chat users served".
  - data: the usage check covers the student free tier (×1/r) as well as a mini (×8).

#### Open questions for the lead

1. The sector share target: with the start spread, the leader returns to 0.8–0.9 of the sector market within a quarter or
   two (seats 14M by Oct 2025 vs OpenAI's 7M in Nov 2025). Is that the classic scenario's lead (keep), or should the
   share response to a 3–9-month lead be weaker (SHARE_SLOPE_G, A5 adequacy) or slower (CUSTOMER_TAU.sector 0.25 → ≈ 1 y,
   Menlo's measured share moves)?
2. US vs ROW sector spend: ROW is 2.5× the US at the start (A2a's regional scale [D]); US enterprise model-API spend alone
   was ≈ $8–12B in 2025 (Menlo [R]) against the game's US $2.7B (A6b) / $1.7B (A7, rivals' cheaper tiers take more of it) of adopted + agent spend.
3. F8: distress through 2026 rose from 75% to 100% of seeds (finance session).
4. RefBot keeps V0 on Chat until day ≈ 190 while rivals' public models pass it from day ≈ 110: the consumer share falls
   0.71 → 0.26 for that reason (F5).

### A8 notes: provider shares in sector demand; US vs ROW spend (branch v3-a8 from v3-a7 c5715e6, 2026-11-21)

Probe: RefBot, reference-compute stub (scripts/v2/lib.ts runRef, as T1), ai2027, seed 2027; scratch probe, not committed.
"Before" = A7's final code. Shares are spend-weighted over the 14 sectors (US / ROW).

#### Sources (fetched this session unless tagged)

- Menlo Ventures, "2025 Mid-Year LLM Market Update" (31 Jul 2025) [P]: shares of enterprise production usage are Anthropic 32%,
  OpenAI 25% ("half of what it held two years ago"), Google 20%, Meta 9%. OpenAI was at 50% at end-2023. Coding: Anthropic 42%,
  OpenAI 21%. Enterprise LLM spend went from $3.5B (Nov 2024) to $8.4B (mid-2025). Switching: "66% of builders upgraded models
  within their existing provider", 23% did not switch, "Only 11% switched vendors". Survey of 150 technical decision-makers.
- Menlo, "2025: The State of Generative AI in the Enterprise" (9 Dec 2025) [P]: Anthropic 40% of enterprise LLM spend (24% in 2024, 12%
  in 2023), OpenAI 27% (50% in 2023), Google 21%. The top three take 88%. Coding: Anthropic 54%. Foundation-model APIs were $12.5B
  of $37B. The survey covers US enterprises only. The market model is "triangulated with public financials", and its geography
  is not stated.
- Menlo, "2024: The State of Generative AI in the Enterprise" (Nov 2024) [P]: OpenAI 50% → 34%, Anthropic 12% → 24%.
  "Organizations typically deploy three or more foundation models".
- a16z, "How 100 Enterprise CIOs Are Building and Buying Gen AI in 2025" (Jun 2025) [P]: "37% of respondents are now using 5 or more
  models", up from 29%. It says "switching costs are rising".
- Anthropic Economic Index (15 Sep 2025) [P]: the US is 21.6% of Claude.ai usage. Usage per working-age capita (AUI): US 3.62, India
  0.27, and so on; usage rises 0.7% per 1% of GDP per capita. There is no API geography.
- Anthropic, international expansion post (26 Sep 2025) [P]: "nearly 80 percent of consumer Claude usage comes from outside the
  United States". Series F post (2 Sep 2025) [P]: "over 300,000 business customers"; run-rate > $5B in Aug 2025.
- OpenAI, "1 million businesses putting AI to work" (5 Nov 2025) [P]: > 7M ChatGPT for Work seats. The 3M (Jun 2025) and 5M (Aug 2025)
  paying business users come from press and an X post [R].
- Anthropic's revenue by billing address [UNVERIFIED]: US ≈ 2/3 in 2025 and 72.2% in H1 2026. These are secondary readings of
  the S-1 (officechai, sec-api summaries). The S-1/A itself (14.9 MB) is over the fetch limit, and curl to SEC was denied in this
  session.
- Microsoft AI diffusion report H2 2025 [P, blog]: 24.7% of the working-age population uses AI in the Global North vs 14.1% in the
  Global South. Not used in the fit.

#### Part 1: the share target

**Cause.** A5's surplus choice puts every buyer in front of every lab. The leader's coverage is ≈ 2× its rivals' (0.107 vs
0.03–0.05 in US Software, at a 0.44–0.7 OOM fit lead). So 5 of the 8 bands are tasks only its model does. There V·Δx ÷ μ ≈ 50,
which makes those bands winner-take-all, and the leader's target is 0.82. No setting of SHARE_SLOPE_G or adequacy changes that:
the value term dominates. Two alternatives were tried and rejected:
- An adoption-lag band range (adopted hours only up to A ÷ (K(1 − R))) gave 0.42–0.51 at the start. It collapsed the takeoff
  economy, though: cheap students won everything, and the leader's day-900 target fell to 0.
- A static reach (each provider in a buyer's set with probability 2 ÷ N) held the measured start share. But a model 1.5 OOM
  better then moved the target only +0.02 (serving S4).

**Mechanism (multi-homing with a reach stock).** A firm buys from the few labs it has contracts with, often through its cloud.
In each sector's surplus choice, provider X is in a buyer's set with probability R_X, its reach, independently. The existing
access choice sets (worldfx/choice.ts) carry this; the lab with the only model for the hardest work wins it at the firms that
reach it.
- `MULTI_HOMING.providers` = 2 per firm. Firms deploy 3+ models (Menlo 2024), 37% use 5+ (a16z), and three labs take 88% of
  spend, so 3+ models ≈ 2 providers.
- Start: an even spread, R = access × min(1, 2 ÷ the region's expected reachable closed providers), which is 0.4 with five
  frontier labs.
- R is a stock (`fx.secReach`, an optional field with no schemaRev bump; absent means the start value). Its target is
  R* = min(access, 2 × w ÷ Σw), where w is V4's quality logit on the provider's mean sector fit (brand × access ×
  exp(SHARE_SLOPE_G·Δfit)).
- τ = `MULTI_HOMING.tau` 3 y. Anthropic went 12 → 24 → 40% over 2023–25 during its coding lead, a reach of ≈ 0.13 → 0.44 in two
  years, which gives τ 2–4.5 y for a target of 0.6–1 [D].
- Open weights have reach = access. Every cloud hosts them; without this exemption A5 E9 fell to ×5.0/yr because buyers could
  not reach the cheapest tiers.
- The start stock is the day-0 target. `SECTOR_START.startMax` and `startSectorShares` are removed: no sourced reason for the
  cap remains, since the target itself now gives the measured spread.

**CUSTOMER_TAU.sector 0.25 → 0.65 y [D from P].** A segment re-chooses at the target as new spend arrives and as buyers switch,
1/τ = g + ρ. Spend grew ×2.4 between Nov 2024 and mid-2025, so g ≈ 1.4/y; 11% switched vendor in a year, so ρ ≈ 0.11/y. The
Products speed label now classes τ < 255 d as "months" (sector 237 d; gov 274 d).

**Player read.** Glossary `targetShare` and `customerSpeed` updated: "Firms multi-home: each buys from a few providers (about two
of the frontier labs), so a model that alone does the hardest work wins it only at the firms that buy from that lab."

**Leader's sector share (US / ROW) and paid seats outside China, before → after:**

| day | stock share | target share | leader seats | anchor |
|---|---|---|---|---|
| 1 | 0.26 / 0.26 → 0.39 / 0.37 | 0.82 / 0.81 → 0.38 / 0.36 | 4.6M → 6.7M | OpenAI 25%, Anthropic 32% (mid-2025); OpenAI 3–5M seats (Jun–Aug 2025 [R]) |
| 90 | 0.57 / 0.57 → 0.39 / 0.37 | 0.77 / 0.75 → 0.40 / 0.37 | 14.0M → 9.2M | OpenAI 7M seats (Nov 2025 [P]); Anthropic 40% (end-2025) |
| 400 | 0.17 / 0.12 → 0.27 / 0.22 | 0.15 / 0.08 → 0.17 / 0.08 | 9.6M → 15.9M | (rivals' public models lead: F5) |
| 900 | 0.21 / 0.16 → 0.23 / 0.17 | 0.13 / 0.12 → 0.07 / 0.06 | 36.8M → 41.1M | |

The leader's seats at day 90 are 1.3× OpenAI's 7M, against 2× before. Day-1 seats run high (6.7M vs 3–5M) because the leader's
share of seats follows its hours share (0.37).

#### Part 2: US vs ROW

**Check.**
- Total spend matches the sources. Before this part, the game's start adopted + agent spend outside China was $7.7–9.1B, against
  Menlo's $8.4B for mid-2025 enterprise LLM spend. Menlo does not say whether its sizing is US-only or global (it is built from the
  labs' global financials), so the brief's "US ≈ $8–12B" reading is not established.
- The split of use also matches. ROW / US hours of use are 6 × 0.6 = 3.6 in the game, and Claude.ai usage is 3.6× as large outside
  the US and China as inside the US (AEI [P]).
- The split of paid spend does not. After Part 1, ROW's adopted + agent spend was 3.4× the US's, and US buyers were 30% of the start
  sector spend outside China. Anthropic bills ≈ 2/3–72% of its revenue in the US [UNVERIFIED].

**Wrong term.** `REGION_SCALE.A0` scaled both workers' use W_b (supported by the AEI data) and the start of firm adoption A, which
is paid by the hour. A2a set the second one by assumption.

**Fix.**
- REGION_SCALE gains `use` (W_b): ROW 0.6, CN 0.6, unchanged.
- ROW `A0` 0.6 → 0.225. This is use × the paid-seat ratio of AI-using workers (SEATS.start ROW 0.045 ÷ US 0.12, A2c) [D]: firms
  outside the US paid for AI work at the rate their workers held paid seats.
- Result at day 1: ROW adopted + agent spend is 1.3× the US's (was 3.4×), US buyers are 43% of the start sector spend outside
  China (was 30%), and ROW / US hours of use are 3.5.
- A then moves toward its ceiling, which is unchanged, so ROW catches up: ROW / US adopted spend is 2.5× at day 400 and 3.3× at
  day 900 (3.9 / 3.9× before).
- CN keeps 0.6: no anchor, and Chinese labs serve it.
- Not fixed: the US side's own gap, if Menlo's figure is US-only. US agent spend at the start is $0.3B against Claude Code's
  $0.5B run-rate alone, the "k ≈ 2× below Claude Code" gap A2c already noted. Lifting it would mean fitting agent constants to
  revenue.

#### Revenue by product (the player, $B/yr), before → after

| day | Chat | API | Enterprise | total |
|---|---|---|---|---|
| 1 | 10.01 → 10.01 | 1.83 → 1.50 | 3.08 → 3.39 | 14.92 → 14.90 (Chat 67%) |
| 90 | 11.16 → 11.16 | 4.79 → 1.92 | 8.52 → 4.51 | 24.47 → 17.60 |
| 400 | 2.15 → 2.15 | 2.05 → 2.61 | 4.34 → 6.59 | 8.54 → 11.35 |
| 900 | 19.25 → 19.34 | 20.70 → 19.20 | 16.35 → 17.50 | 56.31 → 56.04 |

The start sector market outside China (adopted + agent + seats) is $9.4B, down from $12.5B (A7) and $14.3B after Part 1 alone.
It falls because ROW's paid work is lower.

#### Checks moved

worldfx (full tier, one run). The same five checks fail as in A7:
- F11 Jul 2025 run-rate: $15.1B → $14.1B (pass).
- F7/F11 2026: $22.9B → $21.2B (fail, known).
- **F11 2027: $108.1B → $100.2B. Still passes, but only $2B above the band floor of 98.**
- Equity 2026: −10.3% (unchanged, fail).
- GOV T1: 2027-08-07 → 2027-08-26 (fail).
- A2a US hours mid-2026: 6.7% → 6.5% (fail, at the band edge).
- W4 firm adoption: 23.1% → 22.1% (fail).
- U +1 pp: 2027-11-22 (pass).
- A2c seats Jan / mid-2026: 29M / 44M (pass).
- A2c CY2026 non-China lab revenue: $69.0B → $59.4B, leader share 33% → 36%.

finance was not run (the finance session owns it). The finance-sensitive readings are the F7/F11 lines above.

serving (full tier): all pass. A5 E9 (price paid for V0's capability) is ×10.4 → ×6.3/yr, inside the ×6–30 band but near its
floor. products (full tier): all pass.

#### Refits

None. test:cal T1 passes on every preset, with the same values as A7's final:
- ai2027: SC +0.055, SAR +0.030, SIAR −0.016, ASI −0.027 y.
- authors2026: SC +0.030, SAR +0.088, SIAR −0.060, ASI +0.044 y.
- fast: SC +0.047 y.
- slow: SC +0.049 y.

T1L was not refitted (LEADER_CAL is left to the merge, as in A7):
- ai2027 SC −0.142 y.
- fast SC +0.088 y.
- slow SC **+1.18 y (A7 +1.00)**.
- authors2026 SIAR −0.68 y and ASI −1.44 y.
- authors2026 SAR +0.10 y (pass).

T4 passes.

#### Tests

- tsc main + scripts/v2: clean.
- test:quick (combined code): 30/35 scripts ok, 14 failures, all on the expected list:
  - fixtures stale (5);
  - data "synthesize";
  - oversight's two map checks;
  - calib smoke T1L ai2027 SC;
  - worldfx's five.
- Full tier serving / worldfx / products: one run.
- test:cal: one run.
- Test edits in scripts/v2/serving.ts:
  - S4 rewritten: the target rises at once and further as reach grows, and reach and stock move at their τ.
  - The A7 start-cap check is replaced by "A8 multi-homing": start stocks = day-0 targets, leader 0.25–0.45, and a toy
    sole-frontier test.
  - New "A8 US buyers 40–72% of start sector spend, ROW / US hours ≈ 3.6, leader day-1 revenue $12–15B with Chat 60–75%".
  - A5 E9 reads only buyers whose tier does the band whole (`bandPaid(..., whole)`). With multi-homing, buyers who cannot reach
    such a tier buy a partial one, and that is not the capability's price.
- Performance: the mix is 0.46–0.55 → 0.75–0.87 ms (2^5–2^6 choice sets per region), ≈ +0.6 ms per passive day. Not run through
  test:perf.

#### Open questions for the lead

1. Reach target steepness. R* uses SHARE_SLOPE_G 4 per OOM on the mean sector fit, so a lab clearly ahead heads to reach 1 and,
   over τ 3 y, back toward the A5 winner-take-all share. Keep, or make firms' provider sets stickier (a lower slope or a cap
   below 1)?
2. The τ of 3 y is fitted to Anthropic's path under an assumed target of 0.6–1. τ 2 y is equally consistent.
3. Part 2 rests on [UNVERIFIED] S-1 billing shares and a seat ratio that is itself [D]. A direct download of the S-1/A financial
   notes (geographic revenue) would settle it.
4. Consumer spend is 87% ROW at the start ($11.2B vs US $1.7B). It is untouched here; the consumer US share is probably higher in
   reality.
5. F11 2027 now sits $2B above its band floor.

### M7 merge notes (E16–E20, F6a–F6c, A6–A8 onto M6; 2026-11-21)

Merged into `model-v3` (at 7983b97, M6's docs head) with `--no-ff`, in order: `v3-e20` (one chain from 7983b97: E16
8d1dfb0, E17 fbc50cd, E18 56ab454 / 8b213f8, E19 739adbb, E20 f02af42 / 813de6b / dd2d45f; merge 301e8c9), `v3-f6c`
(F6b 5aada15 / 50e61cf / ecef09a / 2212283, F6c 578c9bc; fda7f32), `v3-a8` (F6a 17e972f … 9893d1e / 64f00a4, A6
2a9e21e / cd052bf / 64b4d85, A6b d4c90ba / 7de77b8 / 89b1dc5 / 360d8c6, A7 46f5951 / cff64d9 / d543ee9 / c5715e6, A8
b654b6c / 81ac0f6 / 94ecb95; d2aa5d2). Only the tips were merged (v3-f6a, v3-f6b, v3-e16 … v3-e19, v3-a6 … v3-a7 are
in them). Then: oversight re-derivation 1f72169, LEADER_CAL refit f9c9044, fixtures 7c7db4e, `test:full` once on
7c7db4e, two fixes from its failures (footholds test 72839c1, AF gate re-anchor 5f210e6), fixtures again 09b7b77, a
targeted full-strength re-run of the safety and calibration suites on 09b7b77, and these docs. Checks after each merge:
tsc main and `-p scripts/v2`, lint-structure, lint-hidden, lint-ux (all clean). The notes of every task are above
(copies of `design/notes/<ID>.md`, deleted after folding; A6b was a section of A6's file, F6c of F6b's).

**Conflicts and resolution.** No textual conflicts: git auto-merged every shared file in separate hunks.
- e20 × a8 (`safety/traits.ts`, `glossary.ts`, `runDesign.ts`, `tree.ts`, `init.ts`, `runs.ts`, `types.ts`): A6b's
  `G_S5_0 = 26.99 − 0.08 / K_S5G` (B0's G_pre at 400 tokens per parameter) sits beside E16–E20's learned-hacking, S9,
  gate and pretraining rules; both kept.
- f6c × a8 (`Products.tsx`, `SafetyControl.tsx`, `Blueprint.tsx`, `glossary.ts`, `models/actions.ts`,
  `production/data.ts`, `uitest.mjs`, `scripts/v2/data.ts`): F6b's preview units ("unique tokens", % / days /
  scientists) and F6a's control-tax lines in % (Add and Remove control, `safety/actions.ts`, a file F6b did not touch)
  are both in; F6b's Safety overview side column and F6a's Remove control button sit in different components.
- e20 × f6c (`glossary.ts`, `core/selectors.ts`): separate hunks (E18's `runTraitPressure` G, F6b's exported
  `believedInternalOversight`).
- **Semantic interaction found and fixed:** E18's AF capability gate anchors (25.7 / 28.0) were set at V0 G 27.9–28.1;
  A6b's overtrained reference base moved V0 to 27.60–27.77 (−0.31 OOM at the same training FLOP), so safetyrates' "gate
  at V0" check read 94.0% vs [95%, 100%] in the full run. The anchors are times before V0, so they follow it: 25.4 /
  27.7 (gate at V0 99.9%; comments in `traits.ts` and `edges.ts`).
- No schema change in any branch (A8's `fx.secReach` is optional and filled lazily); SCHEMA_REV stays 33.

**Final calibration (seed 2027).**
- *T1 (RefBot; G_SC / Δ_bm):* passes on all four presets on the merged head; **no G_SC refit** (A6, A6b and A7 refitted
  on their branch with F6a's usage fix in; the E chain does not move T1). Final: ai2027 SC 658 / SAR 802 / SIAR 877 / ASI
  905 (Δ +0.055 / +0.030 / −0.016 / −0.027 y); authors2026 1506 / 1600 / 2120 / 2941 (+0.030 / +0.074 / −0.085 / −0.093;
  2114 / 2956 before the oversight and gate changes); fast 897 / 920 / 920 / 920 (+0.047 / +0.110 / −0.014 / −0.099);
  slow SC 4776 (+0.049). Values as A6b / A7 left them: ai2027 30.110 / 2.20, authors2026 33.310 / 4.65, fast 31.325 /
  0.05, slow 35.496 / 1.60.
- *LEADER_CAL (T1L):* `calib.ts --fit-leader` per preset, plus a 0.005 scan for fast and a scan for authors2026.

  | preset | LEADER_CAL | T1L before (y) | T1L after (y) |
  |---|---|---|---|
  | ai2027 | −0.029 → −0.063 (refine, worst 0.84 tol) | SC −0.142 ✗, SAR +0.025, SIAR −0.074, ASI −0.085 | SC −0.066, SAR +0.101, SIAR +0.003, ASI −0.008 (all in) |
  | fast | 0.025 → 0.03 (scan; the fitter's grid gave 0.033 at 1.00 tol) | SC +0.088 ✗, SAR +0.107, SIAR +0.003, ASI −0.082 | SC +0.068, SAR +0.088, SIAR −0.016, ASI −0.101 (all in) |
  | slow | 0.557 → 0.735 (SC root, worst 0.14 tol) | SC +1.186 ✗ | SC +0.011 (in) |
  | authors2026 | 0.154 kept | SC −0.044, SAR +0.104, SIAR −0.677 ✗, ASI −1.438 ✗ | the same |

  authors2026: no value brings SAR, SIAR and ASI in together (scan 0.06–0.154: SIAR −86 … −247 d, ASI −354 … −525 d;
  the SC root 0.119 puts SAR out as well, +0.26 y), so 0.154 keeps two milestones in. The aggregate leader takes off too
  fast after SC on this preset → F4. T1L had five misses before the refit, two after.
- *Oversight constants (stale by −0.08 OOM after A6b; oversight's two map checks failed):* they were ai2027's λ knots
  written as numbers, so they are now computed from the knots in code. Data keeps v2's M at the level knots
  (`REF_M_LEVEL` [[1.46, L5], [5, L10], [25, L12], [250, L13.5], [2000, L15]]) and each agenda's v2 M½ (`mHalf`, was a
  hard-coded `oHalf`; AG09 latent `mHalf` 5); the engine converts them on the ai2027 timeline world
  (`safety/oversight.ts` `refPathWorld` / `refMOomTable` / `oomOfRefM` / `agendaOHalf`; `world/hidden.ts timelineFor` is
  steps 1–2 of `sampleHidden`, the same draws). Table 0 / 2.532 / 4.376 / 8.776 / 11.636 → 0 / 2.452 / 4.296 / 8.696 /
  11.556 OOM; half points M½ 25: 4.38 → 4.30, 30: 4.72 → 4.64, 250: 8.78 → 8.70, 2000: 11.64 → 11.56, AG09 latent 2.53 →
  2.45. DECAY_KAPPA stays 0.27 (the slope is now 0.271). Readers: techniques.ts, findings.ts (FALSE tools), save.ts
  migration 24 → 25, Codex (through the `engine/v2` index); hygiene's migration check reads `oomOfRefM`. oversight 29/0.
- Fixtures regenerated twice (7c7db4e on the merged and calibrated code, 09b7b77 after the gate re-anchor);
  golden/timelines.json unchanged (the v1 integrator reads no engine code; golden-timelines 16/0, so no `--write`).

**Gate: `npm run test:full` once on 7c7db4e.** Wall 11.0 min (real 10 m 60 s), CPU 71.1 min, machine load 77% (12
cores, 6 workers; the machine was idle before). After its two M7-caused failures were fixed, the affected suites were
re-run at full strength on 09b7b77 (`run.ts --tier full --only safety,safetyrates,footholds,fixtures,calib,signals,
sabotage,successor,control,danger,oversight,safetyideas,safetyresearch,identity,hygiene`: 5.4 min, CPU 37.6 min). The
table gives the re-run numbers for those (†) and the full run's for the rest.

| script | pass | fail | warn | wall s | | script | pass | fail | warn | wall s |
|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|
| tsc-scripts | – | 0 | – | 2.0 | | lint-structure | 8 | 0 | 0 | 3.9 |
| golden-timelines | 16 | 0 | 3 | 7.6 | | safety † (6 shards 173–212 s) | 16 | **2** | 0 | 14.3 |
| identity † | 76 | 0 | 3 | 5.3 | | danger † | 27 | 0 | 0 | 6.5 |
| effective | 27 | 0 | 0 | 10.7 | | oversight † | 29 | 0 | 0 | 5.9 |
| data | 62 | 0 | 0 | 9.6 | | sabotage † | 25 | 0 | 0 | 12.4 |
| suites | 31 | 0 | 0 | 6.5 | | footholds † (full run 33 / 2) | 35 | 0 | 0 | 11.3 |
| signals † | 21 | 0 | 0 | 5.3 | | control † | 33 | 0 | 0 | 9.8 |
| successor † | 11 | 0 | 0 | 6.5 | | safetyideas † | 39 | 0 | 0 | 5.0 |
| research | 30 | 0 | 0 | 15.7 | | safetyrates † (full run 18 / 1 / 7) | 19 | 0 | 7 | 5.9 |
| evals | 32 | 0 | 0 | 49.2 | | finance (3 shards 129–144 s) | 61 | **5** | 0 | 50.4 |
| safetyresearch † | 30 | 0 | 0 | 22.2 | | worldfx | 33 | **5** | 0 | 126.4 |
| worktypes | 16 | 0 | 0 | 52.6 | | ws4 | 25 | 0 | 0 | 198.5 |
| calib † (4 shards 35–149 s) | 38 | **2** | 7 | 1.8 | | rivals | 16 | 0 | 0 | 46.1 |
| fixtures † | 15 | 0 | 0 | 25.1 | | products | 58 | 0 | 0 | 9.1 |
| hygiene † (no perf) | 210 | 0 | 0 | 63.9 | | serving | 88 | 0 | 0 | 58.2 |
| lint-hidden | 1 | 0 | 0 | 3.6 | | money | 24 | 0 | 0 | 33.6 |
| lint-ux | 9 | 0 | 0 | 5.2 | | idle | 3 | 0 | 0 | 189.9 |
| lint-tradeoffs | 486 | 0 | 0 | 3.5 | | test:ui | 592 OK | 0 | – | 406.9 |
| | | | | | | **total (final)** | 2242 | 14 | | |

**Failures, split.** Full run: 17. After the two fixes: 14 (12 known, 2 caused by M7 and listed).
- *Known (12):* calib T1L authors2026 SIAR −0.68 y / ASI −1.44 y (→ F4; fast ASI and the other T1L misses are fixed by
  the refit); safety S5 RefBot "U falls below L by SAR" (median U − L +0.36, below in 30%; → F5); finance F7 2026 revenue
  (median $21.3B), F7 valuation ($0.15T), F8 RefBot out of distress through 2026 16.7%, F11 path (2027 $74.4B) (finance
  session); worldfx F7/F11 2026 $21.4B, equity 2026 −10.3% (finance session), GOV T1 2027-08-31 (the window starts
  09-01; single seed → F4), A2a 6.5% (band 5–6.5%), W4 22.1%.
- *Caused by M7, listed (not fixed):* **safety S4 RefBot P_mis at ASI 0.523** (band 0.55–0.85; E20's branch 0.563 at the
  edge; 0.534 on the merged head before the gate re-anchor; safetyrates' 12-seed mean 0.541): the A chain's world (A6b's
  smaller reference backbone, A7 / A8's market) changes RefBot's lineages; by E20's rule ("if S4 leaves 0.55–0.85,
  report rather than tune") → lead / F4 (multi-seed). **finance F7 RefBot 2026 capex $140.5B** (range 104–169; band
  $200B ± 25%; passed in M6): newly failing with the A chain's lower revenue and RefBot's distress (F8 16.7%) → finance
  session (owns finance balance; not bisected).
- *Caused by M7, fixed:* footholds ×2 (the regenerated day-400 fixture made the security roll produce an unnoticed
  escape, a hidden copy (E9), before the noticed one, and the test took the first copy; it now takes the copy of the
  escape that set `ws4.loose`; engine unchanged); safetyrates "E18 AF capability gate at V0" 94.0% (the re-anchor above).
- *Moved for the better:* T1 authors2026 passes (it failed on E20's branch, which had no A6b refit); T1L ai2027 SC, fast
  SC and ASI, slow SC; worldfx F11 2027 $100.8B (floor $98B), W2 0.7%; S5 mixed median min margin +0.35, holds in 85%
  (M6 −0.11 / 55%); serving A5 E9 ×6.31/yr (floor ×6), A3 ×25.9/yr per task.
- *Moved, not failures:* safetyrates 19 / 0 / 7 WARN: F5 EA end 2026 59.6% [38.6–70.0] is now a WARN (E20 49.8%; band
  20–50%); F5 AF end 2026 21.5% [12.3–59.1] (E20 21.3%, the known WARN); F5 AF at ASI 52.6% (INFO; E20 41.0%); F6
  persistence rows 71–73% (known). worldfx HireRate_SOFT 2027-06-22, 25% remote work 2027-11-05, U +1 pp 2027-11-22
  pass; ws4 T3 mean 179 d; finance F2 46.2M, F9 pass.
- Not run: `test:perf` (policy; A8 adds ≈ 0.6 ms per passive day → perf on a quiet machine before the master merge);
  `ref-trace.ts` (not in a tier; F6a regenerated its traces).

**Lead decisions (recorded, from the M6 decisions file after "M6 done").**
- F6 split into F6a (engine jank; the control layer may be turned off, its preview shows the tax saved vs the believed
  danger change; ref-trace regenerated) and F6b (good-ui pass; units on progress previews; Safety side column; the
  oversight "gap 0.0" row). Perf deferred to just before the master merge, on a quiet machine. E16, F6a, F6b launched in
  parallel from 7983b97.
- F6b accepted (27 audit items, 8 fixed; test:ui 588/0); serving starvation → F6a fix 2; placeholder amounts → F6c.
- F6a accepted; fix 2 (usage counts min(served, need)) kept as correct; it moved slow SC −0.80 y → refit (A6: slow G_SC
  35.488 → 35.496).
- Serving starvation: the served model is ≈ 1T active (22 tok/s per H100e vs DeepSeek-V3's 1.85k/s at 37B) → A6 (H)
  before F5.
- E16 accepted (λ = clamp01((h − 0.10) ÷ 0.35)², K_LH 1.3, κ_item 0.395 → 1.77; the steering anchor → E17; rivals λ = 0).
- F6c accepted (13 / 27 audit items); left → F6d (M): safety-node previews `0.05 × saf`; the "alignment 0.2" Continue
  cost is never applied; low polish items 16–18, 20–23, 26.
- A6 accepted as an investigation; decisions: ADOPT P1 (overtrained reference backbone: REF_TPP 400, B0 ≈ 354B active;
  refit G_SC on all presets; RefBot's later bases checked for the same rule); KEEP decode utilisation 0.07; ADOPT P4
  (consumer plans at WTP ≈ $20–22); ADOPT P5 (ChatGPT ≈ 700M weekly users); RefBot's serving share → F5; Auto greedy
  kept; P3 not adopted → A6b (H).
- E17 accepted (S9; STEER / SUCCSTEER own κ 0.397, SAFSAB 1.36); AF end 2026 36.8%, EA 51.5% (edge, accepted), F6
  healing 71% (accepted); authors2026 T1 knife edge → ONE final refit in M7.
- AF: a capability gate (Greenblatt 2024) folded into E18 (H) with the safety tier from the best model's level; no G_SC
  refits in E18. E18 accepted (gate on G 25.7 → 28.0; labLevel = λ(best G); S4 0.684; a late gate rejected); AF 36.6% →
  E19 (the same-base condition on distillation and the successor loop).
- A6b accepted (refits ai2027 30.497 → 30.11, authors2026 33.622 → 33.32 + Δ_bm 4.65, fast 31.553 → 31.325). Answers:
  start revenue and free tiers → A7; the LEADER_CAL refit and the oversight constants' re-derivation → M7 (done here);
  synthetic data cheaper from the smaller V0: physical, kept.
- E19 accepted (Cloud 2025's same initialisation; distilled students are new networks; E04 = learned hacking only); AF
  25.6% → E20: no S6 baseline into E05 and no E13 / E27 AF growth in base pretraining.
- A7 accepted (start sector stocks, free tiers with parity; F8 25% → 0% → finance session / F5; RefBot's release policy
  → F5). Then A8 (H): the share target from multi-homing, CUSTOMER_TAU.sector measured, the start cap removed; US vs
  ROW spend.
- E20 accepted: AF 21.3%, S4 0.563. **Stop iterating on AF**: a real tension between the S4 band and the end-2026 AF
  band; F5 AF end 2026 is a known WARN; the thin S4 margin → F4; E05 on synthetic pretraining data kept (a design bet).
- A8 accepted (2 providers per firm, τ 3 y, CUSTOMER_TAU.sector 0.65 y; ROW A0 0.6 → 0.225); the reach dynamics kept;
  S-1 geography unverified (the SEC fetch was denied: not worked around); consumer spend 87% ROW noted.
- M7 = merge v3-a8, v3-f6c, v3-e20; the final refit; fixtures; test:full.

**Readouts for later tasks.** Fixtures are rev 33 from the final code. S4 is below its band on the merged head (0.523):
F4's multi-seed check decides whether it is the seed or the model. T1L authors2026's late milestones need a leader
takeoff fix or a wider tolerance (F4). The oversight reference table now follows the ai2027 knots by itself (any future
G_SC or V0 change); the AF gate anchors are still numbers tied to V0's G (the comment says so).

### F5 notes: bot rebalance after the v3 rebuild (branch v3-f5 from model-v3 ae9a158, 2026-11-21)

Scope: bot behaviour only (src/engine/v2/bots/*, the safe-only S4 recipe in scripts/v2/safety-emu.ts); per-preset G_SC
refits for T1 (src/data/v2/workTypes.ts). No engine, finance or safety constant changed. Probes: scratch scripts in
`.f5tmp/` (not committed): the reference-compute stub as T1 / A6 (ai2027, seed 2027), the finance runner as finance.ts
(seeds 1–12, refPlay + REF_AUTOPILOT), and RefBot's real game as safety-emu (seeds 500–503).

#### Commits

| commit | behaviour | why |
|---|---|---|
| bf9fb84 | RefBot release policy `compete` (RefPlayOpts default; safe, mixed and the S4 safe recipe keep `mini`) + T1 refit | A7: V0 stayed on Chat to day ≈ 190 while rivals' public models overtook it (chat share 0.70 → 0.26) |
| eb4ff8c | RefBot sells A5's cheap API tier (`cheapTier` on with `compete`) + T1 refit | A5 left it off pending F5; with near-frontier API models the price-sensitive segments need it |
| cb2dd3d | RefBot's Trusted to AI from its believed oversight of the safety model | E2 / E14: no bot ever used Trusted to AI |
| b90125b | RefBot investigates suspected footholds and removes located ones | E8: RefBot never investigated a foothold |

#### 1. Release policy ('compete') [D]

AI 2027, early 2026: "Several competing publicly released AIs now match or exceed Agent-0 … OpenBrain responds by
releasing Agent-1". Weekly, Chat, API and Enterprise each serve the cheapest cleared version (deployGate: the eval
gate, the channel's variants, commitments) whose consumer-chat fit leads the best rival / Chinese public model by
`RELEASE_LEAD` 0.3 OOM (≈ 3 months at B_G_PER_Y 1.2); when none does, the best cleared one. A product moves when its
own lead falls below `RELEASE_REFRESH` 0.1 OOM (to a better model), or when a cleared version ≥ 20% cheaper (FLOP per
token) is adequate. Why not ship the frontier: a released model leaks to distillers ∝ its G above theirs
(models/deployments.ts distillationLeak) and a bigger model costs more serving. The continual-learning stream is never
a candidate (it is the frontier updated in place: serving it shipped every day's gain; a first version that did so let
rivals reach ≈ 3 OOM more by day 880 than the baseline). Public minis: a student of the internal model sized by the
cheapestAt rule (studentParamsFor) to hold rival + 0.4 OOM on arrival, distilled when it serves ≥ 20% cheaper than the
cheapest model on Chat / API, or (lead lost) when it beats what they serve; ≥ 30 days apart. This replaces the 6-month
half-size mini clock under `compete` (a half-size student sits 0.47 OOM below its teacher, so it was never adequate).

Measured (stub, ai2027, seed 2027; leader chat share of weekly users outside China):

| day | 100 | 125 | 150 | 175 | 200 | 250 | 300 | 400 | 450 | 500 |
|---|---|---|---|---|---|---|---|---|---|---|
| before (M7) | 0.70 | 0.58 | 0.43 | 0.31 | 0.26 | 0.20 | 0.12 | 0.10 | 0.04 | 0.24 |
| after | 0.70 | — | 0.46 | 0.51 | 0.62 | 0.59 | 0.43 | 0.38 | 0.17 | 0.60 |

The dip at days 120–170 remains: r0's public model (fit 27.74) passes everything RefBot has cleared (V8 27.69) until
its second base's first version (V10 28.53) clears at day ≈ 170; RefBot ships V8 at once and V10 the week it clears.
The day-450 dip is r2's release (29.12) before RefBot's next base (29.45) clears.

#### 2. Serving share: AI 2027's table kept [D]

Measured on the `compete` code before the cheap tier (stub, seed 2027): RefBot's serving share as AI 2027's table
(0.29 → 0.13), held at ≥ 0.27, or "need" = max(table, min(0.29, products' need ÷ compute)):

| | table | hold 0.27 | need ≤ 0.29 |
|---|---|---|---|
| ai2027 SC / SAR / SIAR / ASI (golden 638 / 791 / 883 / 915) | 601 / 773 / 872 / 909 | 604 / 786 / 848 / 878 | 632 / 804 / 871 / 903 |
| authors2026 (golden 1495 / 1573 / 2151 / 2975) | 1506 / 1601 / 2134 / 3021 | – | 1529 / 1643 / 2119 / 2900 (SC +0.09, SAR +0.19, ASI −0.21 y) |
| fast (golden 880 / 880 / 925 / 956) | 891 / 912 / 912 / 912 | – | 917 / 944 / 944 / 944 (SC +0.10, SAR +0.18 y) |
| slow SC (golden 4758) | 4776 | – | 4774 |
| day 700: need / served (served %) | 23.2M / 1.97M (8.5%) | 26.2M / 2.82M (10.8%) | 22.4M / 3.03M (13.5%) |
| day 800 | 28.7M / 2.52M (8.8%) | 24.9M / 3.93M (15.8%) | 32.2M / 4.22M (13.1%) |
| revenue day 700 / 800 ($B/yr) | 60.3 / 60.5 | 83.4 / 90.5 | 80.1 / 101.3 |

Mechanism read: the cut segments earn $10.4k (API) and $11–14k (Enterprise) per H100e-year at day 900 against a market
rental of $4.1–4.2k, so serving more pays; but in late 2027 the products' need (16–35M H100e) is 80–175% of the lab's
whole compute (20.4M), so no split serves it (the best feasible share serves 13–16% instead of 9–13%). The research
side: moving 16 pp of compute from research to serving moves ai2027's milestones within the seed's jagged noise, but
authors2026 and fast leave tolerance (+0.1–0.2 y) and need refits. Kept the table: it is what T1 calibrates (RefBot
replays AI 2027's compute-usage forecast, whose falling external share is the scenario's own choice), and the
starvation is not a split problem. The trade-off for the lead: ≈ +$20–40B/yr of 2027 revenue and +4–7 pp served vs a
G_SC refit on two presets.

#### 3. Trusted to AI and footholds [D]

- Trusted to AI (`refTrusted`, monthly, day % 30 = 20): t = (believed oversight of the safety model − 0.4) ÷ 0.4,
  clamped 0–1 in steps of 0.1 (E15's believedInternalOversight on scheming acts: block + catch, from beliefs and
  measured levels); lowered until believed sabotage per safety result at t (E7's believedSabotage) ≤ 10%; an unmeasured
  safety model keeps the last setting. Seed 500: believed oversight 0.55–0.61 in 2025 (t 0.5), 0.46–0.57 in 2026 (t
  0.1–0.4), 0.38–0.54 in 2027 (t 0.1–0.3; the sabotage cap binds).
- Footholds (`refFootholds`, weekly): a suspected foothold with a model to examine gets a case (safety.investigate on
  that model and the act's main trait, 15 safety research engineers) when 15 are free; a located one is removed. Seed
  500: suspected on day ≈ 600, located and removed by day 650 (RefBot has 100 safety RE heads).
- Both are in refBot.act, outside refPlay: T1 and finance.ts (refPlay + autopilot) do not see them.
- safetyideas' E14 lint ("no bot sets Trusted to AI") now requires that only ref.ts sets it and that RefBot staffs no
  AG17 line, so F44 and AG17's harness still cannot move a bot run (a7e6859).

#### 4. Safe and mixed bots

Re-checked after E13–E20 and the changes above: every §7.4 criterion and S4 safe-only / S5 mixed pass, so no policy
change. They keep the old `mini` release (explicit `release: 'mini'`, also in the S4 safe-only recipe), so their own
play is unchanged; only the world moves (the G_SC refit).

#### Bot table (scripts/v2/bots.ts, 200 seeds per bot, leader start; before = M7 head ae9a158, after = b90125b)

| bot | win | mixed | loss | top endings (after) |
|---|---|---|---|---|
| race | 2.5% → 2.0% | 6.5 → 4.5% | 91.0 → 93.5% | asiTakeover 41%, overtaken 28%, ousted 19% |
| safe | 0.0 → 0.0% | 3.0 → 4.0% | 97.0 → 96.0% | overtaken 52%, ousted 44.5% |
| mixed | 38.5 → 37.0% | 7.0 → 7.5% | 54.5 → 55.5% | ousted 38%, asiAligned 34%, overtaken 18% |
| capex2x | 0.5 → 12.0% | 0.0 → 5.0% | 99.5 → 83.0% | insolvent 92.5 → 38%, ousted 18%, asiTakeover 15.5% |
| ref | 16.0 → 23.0% | 12.5 → 9.0% | 71.5 → 68.0% | ousted 33.5 → 15.5%, overtaken 22.5 → 26%, asiAligned 18 → 23%, asiTakeover 14.5 → 22% |

| §7.4 criterion | before | after |
|---|---|---|
| race win ≤ 5% | MET 2.5% | MET 2.0% |
| race losses ≥ 30% takeover/rogue and ≥ 20% company loss | MET 51% / 20% | MET 50% / 20% |
| safe win ≤ 5% | MET 0.0% | MET 0.0% |
| safe losses ≥ 50% overtaken / other ASI first | MET 55% | MET 54% (edge) |
| mixed win ≥ 30% and ≥ 25 pp above both extremes | MET 38.5% / 36.0 pp | MET 37.0% / 35.0 pp |
| passive (ai2027/medium) takeover-type ≥ 50% (diagnostic) | MISS 22% | MISS 38% |

Choices vs world (final Mis, 200 paired seeds): bot-policy share 76% → 74%; paired ref − mixed ΔMis +0.185 → +0.231.
E5 coverage 13/17 both (missing war, nationalized, acquired, retired). capex2x (RefBot's play at 2× capex) also ships
with `compete` and the cheap tier, and its revenue keeps 62% of seeds solvent; finance F8's capex2x check (distress by
end-2027) still reads 100%.

#### Golden dates (T1, seed 2027; G_SC scans, Δ_bm and sd_SC kept)

| preset | G_SC | SC / SAR / SIAR / ASI (Δ y) |
|---|---|---|
| ai2027 (and sampled) | 30.11 → 30.20 (bf9fb84) → 30.12 (eb4ff8c) | +0.052 / +0.005 / −0.036 / −0.044 |
| authors2026 | 33.31 → 33.30 → 33.295 | +0.033 / +0.088 / −0.019 / −0.005 (jagged: passing 33.27, 33.295, 33.305, 33.315, 33.318) |
| fast | 31.325 → 31.345 | +0.044 / +0.110 / −0.014 / −0.099 (SAR = SIAR = ASI on one day) |
| slow | 35.496 kept | SC +0.049 |

Before any refit the release policy moved ai2027 SC −0.10 y, authors2026 ASI +0.13 y, fast ASI −0.12 y; the cheap tier
then ai2027 SC +0.07 y, authors2026 SIAR / ASI −0.13 / −0.15 y. No date was off by more than 0.3 y. Cause: RefBot's
distil and eval load (research engineers, the 'runs' draws) and so its one-seed path; usage data was ruled out (with
usage share 0 the shift stays). The ai2027 G_SC change moves the oversight reference table with it (computed from the
knots since M7).

T1L (LEADER_CAL not refitted; F4): ai2027 SAR +0.12 y (835 vs 791 d) and fast SC +0.09 y (912 vs 880 d) now just fail
(M7 after its refit: +0.101 / +0.068); authors2026 SIAR −0.69 y / ASI −1.44 y as known; slow and the rest pass.

#### S4 / S5 (safety.ts, full run, 40 / 20 seeds)

- S4 RefBot P_mis at ASI **0.523 → 0.577** (band 0.55–0.85: passes; Mis mean 0.499, range 0.18–1.00, ASI day ≈ 914).
- S4 safe-only 0.030 (passes).
- S5 RefBot "U falls below L by SAR": median U − L **+0.36 → +0.54**, below in 30% → 28%: still fails. Handing safety
  work to AI raises U (the lines run faster), the opposite of what S5 asks of a passive lab; the gap's own cause (E1's
  compute-scaled lines) is unchanged.
- S5 mixed: median min margin +0.24, holds in 85% (passes).

#### RefBot's finances (finance.ts F7 / F8, 12 seeds, refPlay + REF_AUTOPILOT; no finance constant changed)

| | before | after | band |
|---|---|---|---|
| F7 2026 revenue (median) | $21.3B | $49.0B | $36–54B: passes |
| F7 2026 capex (median, range) | $140.5B (104–169) | $184.5B (115–210) | $150–250B: passes |
| F7 end-2026 valuation | $0.15T | $1.67T | $1–3T: passes |
| F8 out of distress through 2026 | 16.7% | 50.0% | ≥ 75%: fails |
| F11 path 2027 | $74.4B | $84.7B | $140B ± 30%: fails |

Capex was not a wrong behaviour: with the revenue back, the runway guard lets the autopilot buy the reference build-out.
The remaining distress (6 of 12 seeds) starts on day 184 (1 Jan 2026): RefBot's runway is 3.0–3.7 quarters from day 1
(distress < 3), the Q1 2026 site-capex lump takes it under, and in those seeds a 1–2 month window opens in which rivals'
public models lead everything RefBot has cleared (seed 1: chat share 0.69 → 0.12 over days 120–183, back to 0.54 by day
240 when the next base clears). The release rule cannot ship a model RefBot does not have; the thin start runway is
finance balance (finance session).

#### Serving (stub, ai2027, seed 2027; need vs served H100e; chat = the leader's share of weekly users)

| day | before (M7) | after |
|---|---|---|
| 1 | Chat 81k / 155k, API 34k / 65k, Ent 37k / 71k (all 100%); chat 0.755; revenue $14.9B | the same |
| 400 | Chat V31 mini 13k / 60k, API 115k / 527k, Ent 90k / 409k (100%); chat 0.098; $11.3B | V27 (full) on all three: Chat 123k / 99k (80%), API 497k / 497k, Ent 400k / 400k; chat 0.378; $36.9B |
| 900 | Chat 114k / 96k (85%), API 14.1M / 2.00M (14%), Ent 3.53M / 554k (16%); chat 0.303; $56.3B | Chat V68 mini 74k / 64k (86%), API 3.38M / 746k (22%), Ent V46 7.85M / 1.84M (23%); chat 0.172; $67.1B |

Serving share 0.29 / 0.26 / 0.13 both (AI 2027's table, kept: section 2). Day 900 is in the takeoff, where a month
moves G by OOMs: rivals' public models led RefBot's newest cleared mini there in this seed.

#### Tests

- tsc main and `-p scripts/v2`: clean.
- test:cal after the release commit and after the cheap-tier commit (with the refits): T1 passes on every preset; T1L as
  above; golden-timelines 16/0.
- test:quick (final code): fixtures stale (5, expected after bot changes, not rewritten); worldfx smoke GOV T1, A2a 6.7%,
  W4 23.3% (known) and A2c (new, below); serving A5 E9 (new, below); safetyideas fixed in a7e6859; the rest ok.
- `run.ts --tier full --only safety,finance,serving,worldfx` (once, on b90125b): safety 17 / 1 (S5 RefBot, known);
  finance 64 / 2 (F8, F11 path); serving 87 / 1 (A5 E9); worldfx 34 / 4 (GOV T1, A2a, W4 known; A2c new). run.ts has no
  `bots` script (`--list`); the bot table comes from scripts/v2/bots.ts directly (4 shards of 50 seeds).
- Known failures that now pass: finance F7 revenue, F7 capex, F7 valuation; worldfx F7/F11 2026 revenue ($21.4B →
  $50.6B), F11 2027 ($100.8B → $112.0B), equity 2026 (−10.3% → +32.6%); safety S4 RefBot (0.523 → 0.577).
- New failures (caused by F5, not fixed: market readings of the healthier RefBot, owned elsewhere):
  - serving A5 E9: the price paid for V0's capability falls ×6.31 → ×3.58/yr (band ×6–30). Decomposition: hardware ×2.05
    → ×1.30/yr (RefBot is no longer in distress and keeps buying the reference compute, so the spot rental stays higher:
    $1.33 vs ≈ $0.69 per H100e-h at 2027.08); models bought ×2.89 → ×2.58 (the API's cheap tier holds 28% of the band at
    the end; without it ×1.94). → serving / finance owners, F4.
  - worldfx A2c: tokens a day grow ×8.1 over 2026 (band ×3–8): more of the market buys RefBot's better products.

#### Open questions for the lead

1. Serving share: keep AI 2027's table (as here) or let RefBot hold ≈ 0.29 while products are capacity-bound (+$20–40B/yr
   in 2027, +4–7 pp served, a G_SC refit on authors2026 and fast)?
2. F8 (50%): the start runway sits at 3.0–3.7 quarters against a 3-quarter distress line (finance session).
3. S5 RefBot now has a second reason to fail (Trusted to AI raises U): is "U falls below L by SAR" still the right ask
   of RefBot, or should S5 read RefBot with t = 0?
4. A5 E9 now reads the rental market of a solvent RefBot (×1.30/yr hardware): re-anchor or accept (F4)?

### F6d notes (safety-node and E17 previews; low polish; branch v3-f6d from model-v3 ae9a158, 2026-11-21)

Previews only, plus one shared constant: no apply, state, schema or balance change. AUDIT-V3 items 16–18, 20–23, 26
fixed, and a new row 28 for the previews (22 of 28 fixed).

**Safety-node previews** (`models/treeActions.ts safLines`; was `0.05 × fx.saf` "alignment", a v2 meter scale that
`fx.saf` never fed: no engine code reads `fx.saf`). The line says what the node adds to the safety mechanisms, from the
numbers they use:

- a technique node (`n.technique`, data/v2/techniques.ts) unlocks its technique, shown by role: "+1 detector · detects
  by coverage: Alignment faking 1, Scheming 1, Concealment 0.8" (the top three of the coverage the detection code
  weights, also stored on the lab's technique state), "+1 control protocol · contains by coverage: …" for AG07
  containment, "+1 training fix · run option: <the node's stated effect>" for fixes; a technique with no coverage
  (T-GATE) gives its stated effect;
- a research-line node's odds are the line's estimated chance per result (`nodeOdds`, the posterior mean), so its target
  ends "(odds per result)";
- P25 gives "+0.5 defence levels · weight security against theft": `P25_DEFENCE`, now exported from
  `security/theft.ts` and used by the theft hazard;
- any other node with a safety upside its stated effect ("+1 safety effect · …": P14, P15, P27, aar, kyc, P01 …);
- `fx.saf < 0` is exposure "+1 safety risk · <stated risk>" ("when used: …" for an option node).

**E17 "Red flags"** (`events/catalog/safety.ts`):

- *Continue*: the "alignment 0.2 · red flag ignored" cost (never applied) and the "trust −10 if it leaks p 20%" exposure
  (made up: a leak is the E19 decision) are gone. Its cost is what it does: it counts one red flag, which feeds the
  whistleblower hazard (`security.ts whistleHazard`), shown as "1 red flag · odds of a staff leak to the press 39% →
  53% a year" (`whistleOddsYear` = 1 − (1 − h)^365 at today's morale, with one more flag; with a whistleblower channel:
  "staff concerns go to your whistleblower channel (handled internally)"). With a live pause pledge, the pledge's own
  break cost (`breakCost.credibility`, and trust as `trustDelta` applies it, mean over the audience) replaces the flat
  "credibility 20". No new mechanical cost.
- *Continue + control*: the flat "5% control tax" is E6's protocol tax (`controlReadout`, as Safety › Add control); it
  also costs the red flag it counts (it always did, unshown); "alignment 0.1" → "+N internal deployments · control
  layer on".
- *Pause & investigate*: "alignment 0.2" → "+1 investigation · of the flagged trait by 20 safety research engineers
  (none for an understanding flag)"; the "credibility +2" gain was never applied: removed.

**Polish** (AUDIT-V3): 16 danger chip "acts/yr" on products, lanes keep "/yr" with "danger acts/yr" in the column head
(width); 17 "19 h · needs 4 h"; 18 "tasks 2 h · verifiable 0.8"; 20 bands "± 0.14 L", "Suites · full eq." head, bench
noise "± 3.0 pt"; 21 "Hacking pressure S2 … max 1" (empty space below the six suites justified); 22 "spec. OOM" on
the drawn-mix row, the seven Blueprint tiles top-aligned (a 4 + 3 grid was tried: wider tiles, as empty); 23 the
"why here" text wraps, same-specialty teams numbered; 26 a "gets / needs · team-eq" head on the needs lists.

Tests: `uitest.mjs` F6d check: T-DECEPT's preview is a detector whose listed coverage equals the lab's technique state
(what detection reads); P25 previews 0.5 defence levels; no tree preview carries a unitless alignment line. D8 band
checks now expect "± x L". lint-tradeoffs, lint-hidden, lint-ux pass.

Left (lead): the lane danger chip still says "/yr" only (width); other events with `alignment` placeholder amounts
were not in scope (`safety/actions.ts` respond previews "alignment est × 0.3 / × 0.5"; f6a-owned file).

### F6e notes (Respond and Investigate previews; branch v3-f6e from v3-f6d, 2026-11-21)

`safety/actions.ts` Respond previews now state what `applyResponse` does, from the same constants and helpers, on
believed values only (beliefs, measured levels, believed strengths and efficacy). Shared numbers moved next to the
effect: `responses.ts` `PATCH_MULT / PATCH_DAYS / PATCH_FTE / RUN_PENALTY_Y`, `targetedPlan` (the traits targeted
training cuts or raises, E25's EA ×2, inoculation's E04 patch; apply passes AG18's true efficacy, the preview the believed
one), `restrictTargets`, `discloseTrust / discloseScrutiny / DISCLOSE_CPS`; `traits.ts` `RETRAIN_TRUE / RETRAIN_VISIBLE /
RETRAIN_OBF` (goodhartTrain); `dangerView.ts` `RESTRICT` exported and `restrictDangerDelta`; `investigations.ts`
`caseRate`, `daysToResolve`, `corruptOdds`, `CASE_RESOLVE`, `defaultTools` exported (monthlyGain, the step and resolve use
them). No balance change; one behaviour change: `bestDetector` (Retrain against's default detector) ranks at the measured
OOM, not the true one, so the preview names the detector apply picks.

- *Patch signal*: was "staff 10 for 30–90 d in 60 d", "progress −0.02", "alignment est × 0.15 future growth". Now: 10
  safety research engineers for 30–90 d (0 when a patch already runs: its end date moves), "0.020 yr of progress off the
  next post-training run (G −0.024)", "N training pressures into <trait>: weight ×now → ×a–b on every later run,
  lab-wide (floor ×0.2)" (patchLevel), or "already at the floor".
- *Retrain against*: was "monitor −0.5", "staff 5 · 14 d", "board +3", "alignment −0.1 hides, not heals". Now: the
  detector apply trains against, its believed strength now → after one more retrain (Goodhart G), obfuscated reasoning
  +0.1, true level −20–40% (believed est → range, at most), and a mask: its family reads the trait at 10–30% of today's
  reading. No staff, days or board change (apply has none).
- *Targeted training*: was "staff 10 · 21–35 d", "progress −0.02", "alignment est × 0.3", "EA ×2 p 80% (SCHEME/AF)". Now:
  the run penalty line; per trait the plan cuts "believed est → est × (1 − share): <technique> removes x% (at most)";
  T-CAST's corrigibility +0.15; inoculation's E04 weight; EA ×2 only when it applies (first anti-scheming on the lineage).
- *Restrict context*: was "revenue −0.5 (× 0.5)", "approval +2". Now: the products apply restricts, their revenue
  $x → $0.3x B/yr, believed harmful acts now → after (dangerView with restrict), 70% less misuse reach; "no live
  external product" when none.
- *Roll back*: was "progress −0.25", "lead −45 d", "alignment est × 0.5", "U-modes p 30%". Now: measured L now → the
  checkpoint's, the deployments and agent lanes that move, the model shelved (and its stream stopped), the believed trait
  now → the checkpoint's (an exposure if the checkpoint is believed worse); "no checkpoint" when none.
- *Disclose*: was "trust (3(c − 30)/40) evalGov, exec, evaluators", "credibility +2", "approval −sev p 50%". Now:
  scrutiny 3 + 2·severity; trust per counterparty as applied (mean, each listed; a cost under credibility 30); the
  incident's public timer ends (no cover-up); "at most N discovered U-modes not yet public" the world learns. No
  credibility or press line (never applied).
- *Add / Remove control* (F6a) and *Remove foothold* (E8) unchanged.
- *Investigate*: was clarity/month without the AI-labour multiplier and compute factor, compute "5 × share %", corruption
  p = sab × 0.4. Now: the case's traits and tools as opened, `caseRate` at believed strengths, "clarity 0.8 in ~N d" or
  the clarity reached at 120 d, compute share "of the safety compute pool", corruption odds `corruptOdds` (sabotage ×
  (1 − the tools' verifiability)).

Tests: `uitest.mjs` F6e check: at day 900 (T-INOC), with the removal multiplier set to 1, Targeted training on PERSONA
lowers the true level by exactly the share its believed line shows, the believed target reads est → est × (1 − share),
and the run penalty grows by the previewed years; no Respond preview carries a unitless alignment line. lint-ux,
lint-hidden, lint-tradeoffs pass.

### M8 merge notes (F5, F6d / F6e onto M7; 2026-11-21)

Merged into `model-v3` (at ae9a158, M7's docs head) with `--no-ff`, in order: `v3-f5` (bf9fb84, eb4ff8c, cb2dd3d,
b90125b, a7e6859, c55c736; merge bad5828), `v3-f6e` (F6d 31ad4f1 / 22ef545, F6e cfa9e34; fc6c91e; v3-f6d is in it).
Then: an A/B of the safety suites (F6e's refactor), `test:cal`, fixtures 0d9a513, `test:full` once on 0d9a513, and
these docs. Checks after each merge: tsc main and `-p scripts/v2`, lint-structure, lint-hidden, lint-ux (all clean).
The notes of both tasks are above (copies of `design/notes/F5.md` and `F6d.md`, deleted after folding; F6e was a
section of F6d's file).

**Conflicts.** None, textual or semantic: F5 touched bots (`bots/ref.ts`, `mixed.ts`, `safe.ts`),
`scripts/v2/safety-emu.ts`, `safetyideas.ts` and `data/v2/workTypes.ts`; F6d / F6e touched previews, the safety apply
helpers and panels. No file in common. No schema change (SCHEMA_REV stays 33).

**F6e's refactor, A/B.** F6e moved the response and investigation arithmetic into shared helpers (`responses.ts`
`targetedPlan` / `restrictTargets` / `discloseTrust` / `discloseScrutiny` / `PATCH_*` / `RUN_PENALTY_Y`,
`investigations.ts` `caseRate` / `corruptOdds` / `CASE_RESOLVE`, `traits.ts` `RETRAIN_*`) without running the engine
suites. Read: the targeted-training plan applies the same cuts (× removal), EA ×2 with the same lineage flag, the same
E04 patch and CORRIG +0.15 (only the order of independent writes changed); `trueEfficacy` is pure, so calling it on
every branch draws nothing. Run: `run.ts --tier full --only safety,safetyrates,sabotage,control,footholds,signals,danger`
on v3-f5's tip (a scratch detached worktree in `.m8tmp/` with `npm ci`, removed after) and on the merged head fc6c91e:
the seven logs are **identical** line for line except one timing line ("3.7 s / 2.7 s for the emulated games"): safety
17 / 1, safetyrates 20 / 0 / 6, sabotage 25, control 33, footholds 35, signals 21, danger 27 on both. `bestDetector`'s
measured-level ranking moves nothing measured: no bot or suite calls Retrain against without a technique (safety.ts
passes one; the safe and mixed bots use Targeted training). No refactor bug.

**Calibration (seed 2027).** `test:cal` on fc6c91e: T1 passes on every preset with F5's refits, **no G_SC refit**:
ai2027 (G_SC 30.120) SC 657 / SAR 793 / SIAR 870 / ASI 899 (Δ +0.052 / +0.005 / −0.036 / −0.044 y); authors2026
(33.295) 1507 / 1605 / 2132 / 2943 (+0.033 / +0.088 / −0.052 / −0.088); fast (31.345) 896 / 920 / 920 / 920 (+0.044 /
+0.110 / −0.014 / −0.099); slow (35.496) SC 4776 (+0.049). LEADER_CAL not refitted (F4 owns it): T1L ai2027 SC −0.066,
**SAR +0.121 ✗**, SIAR +0.014, ASI −0.008; **fast SC +0.088 ✗**, SAR +0.107, SIAR +0.003, ASI −0.082; authors2026 SC
−0.063, SAR +0.085, **SIAR −0.696 ✗, ASI −1.458 ✗**; slow SC +0.011. T4 passes (3.3–5.0 months; 40 seeds 3.1–8.4).
golden-timelines 16 / 0 (no `--write`). Fixtures regenerated once (0d9a513, rev 33: day 0 / 400 / 900 and the two start
fixtures; player SAR 793, SIAR 870 on the golden timeline).

**Gate: `npm run test:full` once on 0d9a513.** Wall 10.6 min (real 10 m 37 s), CPU 68.6 min, machine load 76% (12
cores, 6 workers).

| script | pass | fail | warn | wall s | | script | pass | fail | warn | wall s |
|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|
| tsc-scripts | – | 0 | – | 2.7 | | lint-structure | 8 | 0 | 0 | 4.7 |
| golden-timelines | 16 | 0 | 3 | 9.3 | | safety (6 shards 208–247 s) | 17 | **1** | 0 | 15.5 |
| identity | 76 | 0 | 3 | 5.2 | | danger | 27 | 0 | 0 | 4.7 |
| effective | 27 | 0 | 0 | 12.0 | | oversight | 29 | 0 | 0 | 5.2 |
| data | 62 | 0 | 0 | 10.2 | | sabotage | 25 | 0 | 0 | 14.8 |
| suites | 31 | 0 | 0 | 8.7 | | footholds | 35 | 0 | 0 | 12.5 |
| signals | 21 | 0 | 0 | 5.9 | | control | 33 | 0 | 0 | 10.4 |
| successor | 11 | 0 | 0 | 6.5 | | safetyideas | 39 | 0 | 0 | 5.8 |
| research | 30 | 0 | 0 | 15.3 | | safetyrates (4 shards 38–46 s) | 20 | 0 | 6 | 2.8 |
| evals | 32 | 0 | 0 | 47.8 | | finance (3 shards 123–140 s) | 64 | **2** | 0 | 55.1 |
| safetyresearch | 30 | 0 | 0 | 23.5 | | worldfx | 34 | **4** | 0 | 134.5 |
| worktypes | 16 | 0 | 0 | 51.1 | | ws4 | 25 | 0 | 0 | 198.9 |
| calib (4 shards 35–179 s) | 36 | **4** | 7 | 3.5 | | rivals | 16 | 0 | 0 | 38.3 |
| fixtures | 15 | 0 | 0 | 26.4 | | products | 58 | 0 | 0 | 10.3 |
| hygiene (no perf) | 210 | 0 | 0 | 58.4 | | serving | 87 | **1** | 0 | 47.6 |
| lint-hidden | 1 | 0 | 0 | 5.0 | | money | 24 | 0 | 0 | 30.7 |
| lint-ux | 9 | 0 | 0 | 6.5 | | idle | 3 | 0 | 0 | 208.7 |
| lint-tradeoffs | 486 | 0 | 0 | 5.1 | | ui | 594 | 0 | 0 | 392.5 |
| | | | | | | **total** | 2247 | 12 | | |

**Failures, split.** 12, all known; none caused by M8.
- *Known (12):* calib T1L ai2027 SAR +0.12 y and fast SC +0.09 y (after F5; LEADER_CAL → F4), authors2026 SIAR −0.70 y
  / ASI −1.46 y (→ F4); safety S5 RefBot "U falls below L by SAR" (median U − L +0.54, below in 28%; lead: a model
  outcome, the user decides whether the v2 criterion holds); finance F8 RefBot out of distress through 2026 50.0% (vs ≥
  75%) and F11 path 2027 $84.7B (vs $140B ± 30%) (finance session); serving A5 E9 price paid ×3.58/yr (hardware ×1.30:
  the rental stays higher when RefBot is solvent; → F4); worldfx A2c tokens ×8.1 over 2026 (band ×3–8; → F4), GOV T1
  2027-08-26 (window starts 09-01; → F4), A2a 6.7% (band 5–6.5%), W4 23.3%.
- *Newly passing (vs M7's 14):* safety S4 RefBot P_mis at ASI 0.523 → 0.577; finance F7 2026 revenue $49.0B, F7 capex
  $184.5B (115–210), F7 valuation $1.67T; worldfx F7/F11 2026 $50.6B, equity 2026 +32.6%. Still passing: worldfx F11 2027
  $112.0B (floor $98B), W2 0.7%, HireRate_SOFT 2027-07-25, 25% remote work 2027-10-12, U +1 pp 2027-11-03; S5 mixed
  (margin +0.24, holds in 85%); S4 safe-only 0.030; serving A3 ×16.9/yr per task; ws4 T3 mean 178 d.
- *Caused by M8:* none.
- *Moved, not failures:* safetyrates 20 / 0 / 6 WARN (M7 19 / 0 / 7): F5 EA end 2026 48.6% [41.6–78.4] is back in its
  band (20–50%); F5 AF end 2026 18.6% [11.2–56.4] (the known WARN, M7 21.5%); F6 persistence rows 71–74% (known).
- Not run: `test:perf` (policy; before the master merge on a quiet machine); the bots table (F5 ran it).

**Lead decisions (recorded, from the M6 decisions file after "M7 done").**
- M7 done: AF gate re-anchor 25.4 / 27.7 confirmed (anchors relative to V0). S4 0.523 → F5 first, then F4 decides seed
  vs model; if still out on the median seed after F5, a safety recalibration before master. Finance F7 capex → finance
  session; F5 EA end-2026 WARN → F4 check. F5 (H) and F6d (M) launched in parallel from ae9a158.
- F6d accepted (safety-node previews from technique coverage; E17 Continue = red flag + leak odds 39% → 53% / yr; real
  control tax; audit 22 / 28); the Respond placeholders → F6e (M) from v3-f6d. F6e accepted (previews from shared
  helpers on believed values; `bestDetector` at the measured level), with the engine suites to be run here (done: A/B
  identical).
- F5 accepted (§7.4 criteria met; ref win 16 → 23%, ousted 33.5 → 15.5%; S4 0.577; finance F7 and worldfx 2026 pass;
  G_SC ai2027 30.12, authors2026 33.295, fast 31.345; T1L ai2027 SAR / fast SC → F4). Answers: (1) keep AI 2027's
  serving-share table (the calibration reference; holding 0.29 barely helps starvation: products need 80–175% of all
  compute by late 2027); (2) F8 50% (start runway on the distress line) → finance session; (3) S5: do not judge RefBot
  at t = 0 (that tests a bot that does not exist); S5 RefBot stays a known failure (v3 safety research scales with
  compute and AI labour so U keeps up, a model outcome); flag to the user whether the v2 criterion holds; (4) A5 E9
  ×3.58 / yr and worldfx A2c ×8.1 → F4 across seeds; if persistent, a serving / market task after F4.
- M8 = merge v3-f5, v3-f6e (contains f6d).

**Readouts for later tasks.** Fixtures are rev 33 from the merged code. F4: the LEADER_CAL refit (four T1L misses),
S4's margin (0.577), A5 E9 / A2c across seeds, S5's multi-seed numbers for the user, GOV T1. Next: F4 → `test:perf` on
a quiet machine → merge to master (F7, user-authorised).

### F4 notes (multi-seed calibration; 2026-11-21)

Branch `v3-f4` from model-v3 2032f15 (after M8). Commits: aea0cb5 (T1 / T1L on the median over 20 fixed seeds; V3_CAL
and LEADER_CAL refit; calscan.ts), 3b8988a (worldfx's four date checks on the median), this notes commit. No schema
change. Seeds: **CAL_SEEDS = 2027 and 1–19** (`scripts/v2/calseeds.ts`). All runs went through the simulation cache
(scratch harness in `.f4tmp/`, then `calscan.ts`, `run.ts`); ≈ 4,000 RefBot / leader runs in total.

#### 1. What the spread looks like (and why one seed was never a calibration)

RefBot's golden-timeline dates are **multimodal** across seeds, not a bell around the golden day. Two causes, both
intended model behaviour:
- **Base cadence.** RefBot releases bases on fixed days (ai2027: 151, 444, 700, 993, 1249, 1501). SC happens on a
  B3-line version or the continual-learning stream (day ≈ 650), or waits for B4 on day 700. With the M8 values 11 of 20
  ai2027 seeds sat exactly on day 700 (+0.170 y); the median sat there too.
- **Paradigm draws.** P08 continual learning (prior 0.7) decides the takeoff: when it lands (≈ day 650) the stream
  re-applies the recipe every few days and SAR → ASI follows in ≈ 100 d; when it fails or comes late (7 of 20 seeds:
  8, 9, 10, 12, 15, 18, 19) SAR waits for the next base and ASI comes 0.5–1.6 y late. B3's pretraining G differs by
  ±0.1 OOM between seeds (research draws).

So a median sits between modes and moves in steps; passing windows are small islands, not wide plateaus. Every seed
subset smaller than 20 that was tried (the first 5, 8, 10, 12 seeds) moved some T1 median out of tolerance at the final
values.

#### 2. Spread table, before → after (RefBot T1, 20 seeds; decimal years; Δ = median − golden)

| preset | milestone | golden | before: median (Δ) [p10–p90] | after: median (Δ) [p10–p90] |
|---|---|---|---|---|
| ai2027 | SC | 2027.249 | 2027.414 (+0.170) [2027.170–2027.414] | 2027.224 (−0.023) [2027.081–2027.419] |
| | SAR | 2027.666 | 2027.810 (+0.147) [2027.528–2028.273] | 2027.571 (−0.096) [2027.399–2028.221] |
| | SIAR | 2027.917 | 2027.992 (+0.077) [2027.814–2029.080] | 2027.839 (−0.075) [2027.742–2029.297] |
| | ASI | 2028.003 | 2028.063 (+0.060) [2027.900–2029.502] | 2028.000 (−0.003) [2027.881–2029.620] |
| authors2026 | SC | 2029.592 | 2029.641 (+0.052) [2029.347–2029.937] | 2029.630 (+0.038) [2029.354–2029.985] |
| | SAR | 2029.805 | 2030.123 (+0.321) [2029.790–2030.512] | 2029.802 (−0.001) [2029.603–2030.480] |
| | SIAR | 2031.391 | 2031.707 (+0.321) [2031.284–2032.710] | 2031.313 (−0.075) [2030.993–2032.035] |
| | ASI | 2033.644 | 2034.023 (+0.382) [2033.490–2034.738] | 2033.755 (+0.114) [2033.088–2034.349] |
| fast | SC | 2027.907 | 2028.120 (+0.214) [2027.724–2028.211] | 2027.863 (−0.042) [2027.657–2028.211] |
| | SAR | 2027.907 | 2028.134 (+0.227) [2027.790–2028.340] | 2028.003 (+0.097) [2027.717–2028.233] |
| | SIAR | 2028.030 | 2028.134 (+0.104) [2027.790–2028.340] | 2028.014 (−0.016) [2027.738–2028.341] |
| | ASI | 2028.113 | 2028.134 (+0.019) [2027.790–2028.340] | 2028.019 (−0.095) [2027.742–2028.459] |
| slow | SC | 2038.527 | 2038.573 (+0.049) [2036.388–2039.266] | 2038.577 (+0.049) [2037.011–2039.326] |

Before: worst |median|/tolerance 2.12 (ai2027), 3.18 (authors2026), 2.67 (fast), 0.62 (slow); seed 2027 passed on every
preset (it was what the values were fitted on). After: 0.80, 0.95, 0.81, 0.62, all pass. Seeds within tolerance per
milestone stay 2–11 of 20: the spread is wider than the tolerance on every preset (it is the model's, not the fit's).

#### 3. Refits (named per-preset values only; `calscan.ts t1`, 20 seeds)

| preset | G_SC | Δ_bm | sd_SC | passing window found |
|---|---|---|---|---|
| ai2027 (and sampled) | 30.12 → **30.15** | 2.2 → **2.9** | 0.5 → **1.25** | G_SC 30.10–30.18 × Δ_bm 2.8–3.0 × sd_SC 1.2–1.3 (sd 1.1 and 1.4 fail at every G_SC; Δ_bm 2.5 fails); the value is the middle |
| authors2026 | 33.295 → **33.55** | 4.65 → **4.6** | 1.8 → **2.15** | an island: G_SC 33.50–33.60 at (4.6, 2.15); Δ_bm 4.5 / 4.7 and sd_SC 2.1 / 2.2 fail |
| fast | 31.345 → **31.1** | 0.05 → **0.3** | 0.5 → **1.5** | no window: the best point (worst 0.81); every neighbour fails by 0.02–0.6 tolerances |
| slow | 35.496 → **35.575** | 1.6 | 0.5 | 35.45–35.70 (median stays on the 4776 step), the middle |

- **ai2027, why sd_SC and not G_SC alone.** G_SC alone fits T1 at 29.5–29.675 (Δ_bm 2.8; center 29.6), but the level
  knots move with G_SC and the leader lab's SC (T1L) then lands −0.45 y early, which no LEADER_CAL fixes (at −0.4 SC
  is still −0.19 y while SAR is +0.79 y): a stop-rule-sized miss. sd_SC (AI research taste at SC, AIFM 80% CI −2.5…3.5)
  speeds RefBot's pre-SC research (P08 and B3's stacks earlier) and so pulls the SC median off the day-700 step at the
  same SC knot; at (30.15, 2.9, 1.25) both T1 and T1L pass.
- **fast is structural.** RefBot's SAR, SIAR and ASI fall within days of each other on this preset (median SAR → ASI
  ≈ 6 d) while the golden spaces SAR → ASI 76 d, so SAR's median sits late when ASI's sits early; Δ_bm 0.05–0.6 and
  sd_SC 0.5–3 do not spread them. Any later change that moves fast's path by a few days will fail it; this preset needs
  either a wider SAR/ASI tolerance or a mechanism that spaces the post-SC milestones (not done here).
- Stop rule: not reached (no median left tolerance by > 0.3 y after the refits).
- **Seed 2027 is no longer what T1 tests.** At the new values seed 2027 passes on ai2027 and slow, fails on authors2026
  (SIAR −0.37, ASI −0.43 y) and fast (SC −0.13, ASI −0.24 y): it is an early seed on both.

#### 4. Test basis change (T1, T1L, worldfx)

- **T1 binds on the median over all 20 seeds** of CAL_SEEDS, per milestone (A1/A2 too; their KNOWN warnings kept).
  Seed 2027's row is printed as information (its run also gives the R5, G-path, M and METR reads, unchanged).
- **T1L binds on the median over the first 5 seeds.** The aggregate leader lab is near-deterministic (p10–p90 ≤ 0.1 y
  on 20 seeds) and the 5-seed medians sit within 0.02 y of the 20-seed ones; this keeps the cold run down.
- `--smoke` (test:quick): T1 / T1L on ai2027, seed 2027 only, cut at day 700; their milestone checks now print SMOKE
  (were binding when reached).
- New tool `scripts/v2/calscan.ts t1|t1l <preset> --gsc … --dbm … --sd … [--lc …] [--workers N]`: grid × CAL_SEEDS
  through the cache, prints median offsets, p10 / p90, seeds in tolerance, seed 2027, PASS per point. **Future refits
  must use it** (the old `--fit-v3` / `--fit-leader` are seed-2027-only first guesses now).
- worldfx: the four date checks (below) bind on the median first day over the 20 classic runs (seed 2027 = the main
  run, 19 light cached records; 4 prefill shards in full).

**test:cal wall time: before 43 s cold (8 runs); after 7.0 min cold (108 runs: 80 T1 + 20 T1L + 8; CPU 42 min on 6
workers, load 68%), 5.9 s warm.** Missed the ≤ 3 min target: T1 needs all 20 seeds and one seed costs ≈ 90 s of CPU
(slow 48 s to day 5029, authors2026 28 s to day 2906). `--workers 10` would give ≈ 4 min cold. Shards 4 → 6.

#### 5. LEADER_CAL (T1L; leader with a passive player; refit after the V3_CAL refit moved the knots)

| preset | LEADER_CAL | before (M8 values, 20 seeds): SC / SAR / SIAR / ASI | after (5-seed test basis; 20-seed in brackets) |
|---|---|---|---|
| ai2027 | −0.063 → **−0.15** | −0.056 / **+0.125** / +0.027 / +0.003 | −0.066 / +0.033 / +0.052 / +0.079 [−0.071 / +0.012 / +0.032 / +0.070]; −0.10 and −0.20 fail |
| fast | 0.03 → **−0.045** | **+0.085** / +0.100 / −0.010 / −0.093 | +0.066 / +0.090 / 0.000 / −0.079 [+0.060 / +0.088 / −0.001 / −0.084]; −0.03 and −0.06 fail |
| slow | 0.735 → **0.79** | +0.040 | +0.044 [+0.007]; 0.77 fails, 0.81 passes |
| authors2026 | 0.154 → **0.11** | −0.063 / +0.108 / **−0.689 / −1.452** | −0.025 / −0.033 / **−0.838 / −1.679** [−0.018 / 0.000 / −0.827 / −1.658] |

**authors2026 SIAR / ASI cannot be fitted** (now KNOWN warnings in calib.ts, with the numbers): the aggregate leader runs
SAR → ASI in 2.2 y (2029.80 → 2031.99) where the golden takes 3.8 y (2029.81 → 2033.64). LEADER_CAL moves the whole
path, not its post-SAR pace: at 0.05, where SC is already +0.23 y late, SIAR / ASI are still −0.57 / −1.39 y; at 0.25
everything is early (SC −0.55, ASI −2.29 y). The aggregate leader has no idea projects and no dead ends, so after SAR its
research speed compounds without the stalls that RefBot's paradigm draws add; it would need its own post-SAR term (a
model task, not a fit).

#### 6. D7's eval re-run rule across seeds (temporary env override of REEVAL_DL / REEVAL_DAYS, reverted)

Median over 20 seeds at the new values, Δ years SC / SAR / SIAR / ASI:

| rule | ai2027 | authors2026 |
|---|---|---|
| 0.3 L / 30 d (kept) | −0.023 / −0.096 / −0.075 / −0.003 (pass) | +0.038 / −0.001 / −0.075 / +0.114 (pass) |
| 0.3 L / 90 d | +0.040 / −0.067 / −0.052 / +0.027 (pass) | +0.084 / +0.045 / −0.042 / +0.016 (SC fails by 0.004) |
| 0.2 L / 30 d | −0.023 / −0.096 / −0.073 / +0.011 (pass) | +0.038 / +0.003 / −0.077 / +0.099 (pass) |
| 0.1 L / 30 d | −0.023 / −0.096 / −0.067 / +0.014 (pass) | +0.038 / +0.004 / −0.077 / +0.053 (pass) |

**Seed noise.** D7's seed-2027 findings (90 d moved SC −0.09 y; 0.1 / 0.2 L moved authors2026 SIAR / ASI out) do not
hold on the median: the trigger moves no median by more than 0.06 y, the 90-day cadence moves SC +0.06 y (the other
way). The rule stays 30 d / 0.3 L; it is not a calibration knife edge. (The `evals.ts` comment still cites the seed-2027
reason; left as written.)

#### 7. Borderline worldfx / serving items across seeds (classic RefBot game, ai2027, 20 seeds)

Date windows are ±92 d. Before = M8 values, after = F4 values (worldfx's own records; serving's A5 E9 arithmetic
replayed on the same classic runs).

| item | seed 2027 (after) | before: median [p10–p90] | after: median [p10–p90]; seeds in window | verdict |
|---|---|---|---|---|
| HireRate_SOFT ≤ 10% (Jul 2027) | 2027-07-22 | 2027-05-16 [03-30 – 07-30] | 2027-05-01 [03-18 – 07-24]; 15/20 | noise; passes on median |
| 25% remote work (Oct 2027) | 2027-10-05 | 2027-09-21 [09-02 – 10-17] | 2027-09-18 [08-23 – 10-08]; 20/20 | noise; passes |
| U +1 pp (Oct 2027) | 2027-09-15 | 2027-11-17 [09-26 – 2028-02-15] | 2027-10-13 [07-18 – 2028-01-01]; 17/20 | noise; passes |
| GOV T1 Accept ≥ 0.85 (Dec 2027) | 2027-07-24 | 2027-09-29 [07-25 – 2028-02-13] | **2027-08-18** [06-21 – 12-04]; 8/20 | **model miss** (fails on median) |
| F11 2027 revenue ($98B floor) | $120.8B | $92.8B [$66.6–103.0B] | **$89.3B** [$79.6–105.7B] | **model miss** (seed 2027 is a high seed) |
| serving A5 E9 price paid (×6–30/yr) | ×3.55 | ×4.51 [×2.93–6.29] | **×4.33** [×2.79–6.31] | **model miss** |
| worldfx A2c tokens a day 2026 (×3–8) | ×8.1 | ×8.39 [×7.42–10.78] | **×8.5** [×7.8–10.8] | **model miss** (slight) |

Model-miss diagnoses (not fixed here):
- **GOV T1.** Accept follows σ((L_REASON of the government advisor − 9.5)/0.8) (worldfx/control.ts ACCEPT, "[D, fit
  §7.3]"), so ≥ 0.85 needs the advisor near L ≈ 10.9, between SC (L10) and SAR (L12). ACCEPT.mid was fitted when the
  median world ran 0.17 y late; on the calibrated median path L ≈ 10.9 arrives in Aug 2027, four months before AI 2027's
  "authorities almost always accept" (Dec 2027, near SIAR). At the M8 values the median passed (2027-09-29, two weeks
  inside the window) while the median world ran 0.17 y late.
  Needs ACCEPT.mid ≈ 10.5–11 or a SIAR-relative anchor (worldfx task).
- **F11 2027.** The median world's 2027 revenue is $89B against the $98B floor ($140B ± 30%); 7 of 20 seeds reach
  it. Seed 2027 is a high seed ($112B before, $121B after). Same shortfall as finance F11 path 2027 ($84.7B, M8;
  the finance session owns it): RefBot's products are compute-starved in 2027 (F5: products need 80–175% of all
  compute by late 2027) — a serving / compute-allocation miss, not timing noise.
- **A5 E9.** The market-weighted price paid for V0's capability falls ×4.3/yr on the median (no seed above ×6.3);
  decomposition on the median: hardware ×1.24, margin ×1.01, models bought ×3.4. The rental falls only ×1.24 because
  RefBot stays solvent (the rental is the market rate), and customers keep buying near-V0 models (models bought ×3.4,
  not the ×6–8 a full shift to cheap tiers gives). Persistent → the serving / market task after F4 (M8 lead decision).
- **A2c.** Tokens a day grow ×8.5 over 2026 on the median (band ×3–8; p10 ×7.8): agent-hours per supervising hour rise
  0.08 → 1.5 over 2026 (seed 2027), so agent tokens dominate by December; slightly too steep on every seed — part of the
  same serving / market task (agent leverage growth).

Finding (not fixed): **readouts perturb the trajectory on some seeds.** The same classic game read with extra
readouts (serving's `worldMix` / `bandPaid` at four marks, F4's probe) and with worldfx's readouts gives identical paths
on 17 of 20 seeds but different dates on seeds 2, 4 and 11 (e.g. seed 4 HireRate day 674 vs 688, F11 2027 $86.9B vs
$90.3B). A read-only call writes state somewhere (A8's lazily filled `fx.secReach` is the first suspect). Determinism per
seed holds for a given set of reads; worth a hygiene check (same seed, with and without readouts, identical state hash).

#### 8. Safety across seeds (`run.ts --tier full --only safety`, new calibration; S4 40 seeds 500–539, S5 RefBot the same 40)

- **S4 RefBot P_mis at ASI 0.577** (band 0.55–0.85; M8 0.577; Mis at ASI mean 0.491, range 0.12–0.99; ASI day ≈ 967);
  S4 safe-only 0.043 (≤ 0.25). S4 is already the 40-seed mean: the M7 0.523 → M8 0.577 move was the model (F5), not the
  seed; the margin to the band's floor stays thin (+0.027).
- **S5 RefBot "U falls below L by SAR" (median world): fails — median U − L at SAR +0.36, U below L in 38% of the 40
  worlds** (M8 +0.54, 28%). S5 mixed passes (median min margin +0.43, holds in 80%; U at SAR mean 12.25 vs RefBot 11.20).

**For the user (S5).** The v2 criterion assumed understanding is researched by people at a fixed pace while capability
accelerates, so a lab that does not refresh its safety work falls behind by SAR. Model v3 removed that asymmetry on
purpose (E1, E2): safety research is work like capability research, so it speeds up with the lab's compute and with AI
labour, and RefBot (since F5) hands safety work to its AI agents. Understanding therefore keeps pace with capability in
most worlds: in the median world RefBot's U is 0.36 above L at SAR, and U falls below L in 38% of worlds — the worlds
where the funded agendas turn out weak or the AI labour on safety is sabotaged. The game still shows the danger (S4: the
reference lab ends misaligned at ASI with P ≈ 0.58), but through misalignment and sabotage rather than an understanding
gap. Options: keep the v2 criterion (it would need the asymmetry back, against E1), restate S5 as a share of worlds
(e.g. "U < L by SAR in ≥ 30% of worlds without refresh": 38% passes), or drop it. Numbers only; nothing tuned.

#### 9. Tests run

- tsc main and `-p scripts/v2`: clean.
- `test:cal` after the refits: 49 pass, 0 fail, 9 WARN (T1 A1/A2 known; T1L authors2026 SIAR / ASI known since F4); T4
  passes (3.3–5.0 months; 40 seeds 3.1–8.4); golden-timelines 16 / 0.
- `run.ts --tier full --only worldfx,safety` (5.0 min): safety 17 / 1 (S5 RefBot, known); worldfx 34 / 4 (GOV T1 on the
  median, A2a 6.7%, A2c ×8.1, W4 firm adoption 23.2%: all on the known list).
- `test:quick` once at the end (2.2 min): 30 / 35 scripts ok, 13 failures: fixtures ×5 (stale after the refit,
  expected), worldfx SMOKE A2a / A2c / W4 (known), serving A5 E9 ×3.55 (known), and **three new, caused by the ai2027
  refit** (explained, not tuned):
  - serving **A3** fixed-capability price ×44.8/yr per task (band ×6–30; M8 ×16.9): seed 2027's cheapest V0-level model
    in Feb 2027 is a 2.7B student of Atlas-3.6 (teacher fit +2.62 OOM over V0; the student shrinks exponentially in that
    gap), because the higher AI taste (sd_SC 1.25) makes the pre-SC research faster; a single-seed check on the now
    faster seed 2027 (its SAR −0.11 y);
  - safetyresearch **E2 "the start model adds little"**: m_exp 1.133 (< 1.1) and m_ideas 1.028 (< 1.01); full trust,
    60% pool: 1.303 / 1.058 (< 1.25 / 1.02): AI taste at the start is 0.75 SD higher (sdAIOf is anchored at sd_SC), so
    the start model's safety labour counts for a little more;
  - successor **reference ω at the start 0.070** (≈ 0.049 ± 0.01): the same channel (more AI share of research at the
    start; the day-400 / day-900 parts read the stale fixtures).
  These are the price of fitting the median world with AI taste; the alternative fits (G_SC 29.6 at sd 0.5) lower
  every human reference by 0.5 OOM and move these start numbers further, and keeping the M8 values leaves T1 ai2027
  failing on the median (SC +0.17, SAR +0.15 y). Lead's call: accept and re-baseline the three, or keep ai2027 at the
  M8 values with T1 ai2027 SC / SAR as known failures.
- Not run: test:full, test:perf (lead).

#### For the lead

- Fixtures (day 0 / 400 / 900, start fixtures) are stale after the refit: regenerate at the merge.
- Every suite that plays RefBot on ai2027 moves (new G_SC / Δ_bm / sd_SC and knots): finance F7 / F8 / F11, safety S4
  (0.577 here), worldfx; the full gate will show where.
- T1 fast is a knife edge by structure (§3); GOV T1, F11 2027, A5 E9 and A2c are model misses (§7); authors2026 T1L SIAR /
  ASI need a leader-lab post-SAR mechanism (§5).

### G1 notes (determinism of reads; GOV T1 refit; 2026-11-21)

Branch `v3-g1` from `v3-f4` (f23411e). Scratch in `.g1tmp/` (not committed).

#### Part 1. "Readouts perturb seeds 2, 4, 11" (F4 §7): the cause was process history, not a read

**Method.** The classic ai2027 RefBot game (worldfx's setup) was played with and without readouts, hashing the state
(`stateHash`) every day: no reads; worldfx's reads (daily `remoteWorkAutomation`, weekly `worldMix` / `labMarketRevenue`,
the nine marks); F4's probe reads (`.f4tmp/p-cls.ts`: `offerOf` / `flopPerToken` / `serveDollarsPerHour` on V0 at day 0,
`worldMix` / `adoptedTokens` / `bandPaid` at four marks); and, in lockstep with an unread copy, every selector the engine
exports (below) every day to day 900 on seeds 2, 4 and 11. **Every variant gave identical hashes on every day** (seed 4
day 760 `fce33512…` in all of them), and no read changed the hash of the state it read. So no readout writes state,
draws from a stream or leaves a cache that changes a tick.

**The cause.** F4's probe jobs ran in shard processes (`.f4tmp/ms.ts`) that played many jobs in turn, each setting the
calibration tables (`Object.assign(V3_CAL[p], …)`, `LEADER_CAL[p] = …`) before its game; calscan.ts does the same.
`safety/oversight.ts` memoised the ai2027 reference path **once per process**:

```ts
let refWorld: TimelineWorld | undefined;
export function refPathWorld() { return (refWorld ??= timelineFor(new Rng(0), { world: 'ai2027', … })); }
let refMOom … (refMOom ??= REF_M_LEVEL.map(([M, L]) => [M, oomOfLevel(refPathWorld(), L)]));
```

`timelineFor` copies `V3_CAL.ai2027` (and the level knots read `ASI_EXTRA`), so the path is a function of the
calibration, and every new game reads it: `player.safety.techniques[*].oHalf` (each technique's half-strength point,
`oomOfRefM(agenda M½)`, set at newGame) and AG09's latent decay. A game played after the process had first built the
path at other values got those values' half points (e.g. T-PROBE oHalf 8.71 instead of 10.02 OOM, T-W2S 4.31 instead
of 4.22) and so a different trajectory; on most seeds the technique decay does not move a date, on 2, 4 and 11 it did
(the readouts in F4's comparison were incidental: the two runs came from processes with different histories).
Reproduced: seed 4 played fresh → day-760 hash `fce33512…`; the same game after one game at the M8 ai2027 values
(30.12, 2.2, 0.5), values restored → `d2dff629…`, differing from day 0 (the oHalf values above).

**Fix (root).** `refPathEntry()` memoises the path on the values it is built from: (V3_CAL.ai2027 gSC, dBM, r, sdSC,
ASI_EXTRA.gaps); a change rebuilds it (and its M → OOM table). A fresh process is unchanged (same values, same world):
the fresh seed-4 hash is `fce33512…` before and after; the restored-values game above now gives `fce33512…` too.
No other process-wide memo depends on a mutable table: the others are keyed by per-game objects (TimelineWorld, its
`v3` copy, the state) or by their full inputs, or read constants; LEADER_CAL and CHINA_CAL are read at newGame only.

**New hygiene checks (section 3b; `scripts/v2/readsweep.ts`).**
- *(a) No selector writes:* every function exported by `src/engine/v2/index.ts` (what `src/ui/v2` imports; 309 with the
  worldfx readouts and market reads; act / resolve / tick / newGame / deserialize / defaultSetupV2 excluded), called with
  the state alone and, for two-argument functions, with each of 16 typical second arguments (a version, a product, a
  lab, a team, a sector, a region, …; throws from wrong argument kinds are ignored), on **deep-frozen** day 0 / 400 / 900
  fixtures (7,023 calls): a write to a frozen object throws in ES-module code and is reported. 0 writers. (234 of the
  309 run on the state alone; most of the others need a specific object: a run plan, a site, a suite.)
- *(b) Reads do not change a game:* the classic ai2027 RefBot game twice in lockstep, one swept every 7 days: identical
  hash every day, seeds 2, 4, 11 to day 730 (cached; 3 prefill shards in the full tier, ≈ 70 s each cold; `--smoke` in
  test:quick: seed 4 to day 240). A one-off daily sweep to day 900 on the three seeds also gave no difference.
- *(c) A game does not depend on the process's history:* seed 4 for 30 days at shifted values of every harness-mutable
  table (V3_CAL all presets, ASI_EXTRA, LEADER_CAL, CHINA_CAL), after the earlier hygiene games and two leader-lab games
  at those values, hashes the same as in a fresh child process (`hygiene.ts --history-child`), and after the values are
  restored as before them. On the old oversight.ts the first check fails (`19279178…` vs fresh `7c6dd784…`).

**Medians.** `test:cal` after the fix: every T1 and T1L median exactly as in F4's "after" table (ai2027 SC / SAR / SIAR /
ASI 2027.224 / 2027.571 / 2027.839 / 2028.000; authors2026 2029.630 / 2029.802 / 2031.313 / 2033.755; fast 2027.863 /
2028.003 / 2028.014 / 2028.019; slow SC 2038.577; T1L as F4 §5), 49 pass, 0 fail, 9 WARN (known), T4 3.1–8.4 months:
no seed's date changed (test:cal plays each game in a fresh process at the committed values, where the fix changes
nothing). No refit needed. **But calscan.ts's ai2027 grids were affected**: its workers play many grid points in one
process, so every ai2027 point after a worker's first read the first point's half points. F4's ai2027 refit (and its
reported grid medians) came from such runs; the committed values are confirmed by test:cal, so they stand, but the
passing-window edges in F4 §3 for ai2027 may be off by the noise of the half points. Future calscan runs are clean.
worldfx (`--tier full`): 34 / 4, the same four known failures as F4 (GOV T1, A2a, A2c, W4), identical values.

#### Part 2. GOV T1 (worldfx "Dec 2027 (±3 mo): GOV T1 Accept ≥ 0.85"): ACCEPT.mid 9.5 → 11.5

**Source and target.** AI 2027, Dec 2027: the authorities "almost always accept its recommendations" (worldfx/control.ts
ACCEPT, [D, fit §7.3]); the check: the first day the US GOV domain's acceptance reaches 0.85, ±3 months of 2027-12-15,
on the **median first day over the 20 classic RefBot runs of CAL_SEEDS** (F4's basis; never reached = +∞).
Accept* = 0.3 + 0.65·σ((L_REASON of the government advisor − mid)/0.8) + 0.2·persuasion, approached at 6/yr; ≥ 0.85
needs the advisor ≈ mid + 1.4. With mid 9.5 (fitted while the median world ran 0.17 y late) that is L ≈ 10.9, reached in
Aug 2027 on the calibrated path.

**Scan** (real games, ACCEPT.mid set per run, the worldfx classic setup, to 2028-04-01; first day Accept ≥ 0.85):

| mid | median (Δ vs 2027-12-15) | p10 | p90 | seeds in window | seed 2027 |
|---|---|---|---|---|---|
| 9.5 (before) | 2027-08-17 (−120 d) | 2027-06-20 | 2027-12-04 | 8/20 | 2027-07-24 |
| 10.0 | 2027-09-18 (−88 d) | 2027-07-16 | 2028-01-08 | 11/20 | 2027-08-20 |
| 10.25 | 2027-10-06 (−70 d) | 2027-07-29 | 2028-01-22 | 13/20 | 2027-09-05 |
| 10.5 | 2027-10-23 (−53 d) | 2027-08-16 | 2028-02-12 | 13/20 | 2027-09-21 |
| 10.75 | 2027-11-06 (−39 d) | 2027-09-05 | 2028-03-02 | 15/20 | 2027-10-05 |
| 11.0 | 2027-11-21 (−24 d) | 2027-10-05 | never | 17/20 | 2027-10-19 |
| 11.25 | 2027-12-04 (−11 d) | 2027-10-26 | never | 16/20 | 2027-11-03 |
| **11.5 (after)** | **2027-12-16 (+1 d)** | 2027-11-14 | never | 14/20 | 2027-11-17 |

The median moves ≈ +15 d per 0.25; 11.5 puts it on the target (the median check passes from 10.0 upward, so 11.5 is
also near the middle of its passing range). ≥ 0.85 now needs the advisor near L 12.9, between SAR (12) and SIAR (13.5),
where AI 2027's Dec 2027 sits (golden SIAR 2027.917). Three seeds (8, 15, 19: late-P08 worlds, F4 §1) do not reach 0.85
by Apr 2028 at 11.25–11.5; seed 11 (the earliest world) crosses in Aug 2027. Alternative if seed coverage matters more
than centring: 11.25 (median −11 d, 16/20 in the window).

**Check (worldfx `--tier full`, the script's own 20 runs):** before median 2027-08-18 [p10 06-21, p90 12-04], 8/20 →
after **2027-12-17** [p10 2027-11-15, p90 never], 14/20: **PASS**. worldfx 35 / 3 (A2a 6.7%, A2c ×8.1, W4 23.2%:
known, unchanged). The other date checks and spreads are unchanged (HireRate 2027-05-01, remote work 2027-09-18, U +1 pp
2027-10-13, F11 2027 $89.3B, A2c median ×8.5): acceptance feeds back only through leverage (headline H30) and moved no
other reading. `test:cal` after the refit: every T1 / T1L median identical to Part 1 (49 / 0 / 9 WARN known).

#### Tests run

- tsc main and `-p scripts/v2`: clean (after each part).
- `run.ts --tier full --only hygiene,worldfx`: part 1 hygiene 214 / 0, worldfx 34 / 4 (F4's known four); part 2
  hygiene 214 / 0, worldfx 35 / 3 (GOV T1 now passes).
- `test:cal` twice (after each part; 8.7 and 5.9 min cold): 49 pass, 0 fail, 9 WARN known; medians as F4.
- `test:quick` once at the end (2.3 min): 30 / 35 scripts ok, 13 failures, exactly F4's list: fixtures ×5 (stale since
  F4's refit, expected), worldfx SMOKE A2a / A2c / W4, serving A3 / A5 E9, safetyresearch E2 ×2, successor reference ω
  (all known since F4). hygiene (SMOKE 3b: seed 4 to day 240) passes.
- Not run: test:full, test:perf, test:ui.

### M9 merge notes (F4, G1 onto M8; 2026-11-21)

Merged into `model-v3` (at 2032f15, M8's docs head) with `--no-ff`: `v3-g1` (F4 aea0cb5, 3b8988a, f23411e; G1 ad50fa6,
e09ad94; merge 5a33e93; v3-f4 is in it). Then: the lead's re-baselines and the cal tier on 10 workers (e6c3a06), calib's
cal shards 6 → 10 (193c1ea), `test:cal` cold, fixtures 0272091, `test:full` once on 0272091, and these docs. Checks after
the merge: tsc main and `-p scripts/v2`, lint-structure, lint-hidden, lint-ux (all clean). The notes of both tasks are
above (copies of `design/notes/F4.md` and `G1.md`, deleted after folding). No conflicts (G1 was branched from F4's tip,
and F4's base is M8's docs head). No schema change (SCHEMA_REV stays 33).

**Re-baselines (lead decisions; commit e6c3a06, the reason in a comment at each check).** All three moved with F4's
ai2027 refit (G_SC 30.15, Δ_bm 2.9, sd_SC 0.5 → 1.25), which the lead accepted:
- *serving A3* (price of V0's capability, per task and per token): band ×6–×30 → **×6–×900 a year**, the floor kept.
  The ceiling is now the top of the sourced range: Cottier, Snodin, Owen & Adamczewski (Epoch AI, Mar 2025; research/20
  D3) measure ×9 to ×900 a year depending on the capability threshold (GPT-4-level GPQA ≈ ×40/yr). The refit puts seed
  2027's Feb-2027 teacher 2.62 OOM above V0's fit, so the cheapest V0-level student shrinks to 2.7B: **×44.79/yr per
  task, ×42.77/yr per token**, inside the measured range, outside the old ceiling.
- *safetyresearch E2 "the start model handed half the work adds little"*: m_exp < 1.1 → **< 1.2 [D]** and m_ideas
  < 1.01 → **< 1.05 [D]** (now 1.133 / 1.028; first result 90 → 89 d, still < 4%). The companion check "a safety model
  with low SAF coverage adds little (start model, full trust, 60% of the pool)" failed on the same channel and was
  re-baselined with it: m_exp < 1.25 → **< 1.4 [D]**, m_ideas < 1.02 → **< 1.1 [D]** (now 1.303 / 1.058; AI does 4.8% of
  the work, < 6% kept). Reason: `sdAIOf` is anchored at sd_SC, so the start model's AI research taste is +0.75 SD and its
  few-per-cent SAF coverage counts for a little more. (The lead named the first threshold; the other three are the same
  channel, flagged here.)
- *successor reference ω at the start*: 0.049 ± 0.01 → **0.070 ± 0.015** (same relative tolerance ≈ 20%; start r 0.30,
  oversight 0.41), same channel. Day 400 ω 0.175 and day 900 ω 0.797 (new fixtures) keep the ordering.

**test:cal timing.** `run.ts`: the cal tier defaults to 10 workers when the machine has ≥ 12 logical cores (else 6).
Cold (`SIMCACHE=refresh`) on 12 logical / 10 physical cores: **5.9 min** at 10 workers with calib's 6 cal shards (the
extra workers idled: 6 shards of 324–354 s), so calib's cal shards went 6 → 10 (193c1ea): **5.3 min cold** (real
5 m 21 s; 10 shards 259–318 s wall, 194–262 s CPU each; CPU 37.0 min, load 67%). F4 measured 7.0 min on 6 / 6. The
shards' wall time exceeds their CPU time by ≈ 25%: 12 logical cores are 10 physical, and another session's node
process was running. Both runs: 49 pass, 0 fail, 9 WARN (known); golden-timelines 16 / 0 (no `--write`).

**Fixtures** regenerated once (0272091, rev 33: day 0 / 400 / 900 and the two start fixtures; player SAR 750, SIAR 843 on
the golden timeline, want 791 / 883 ± 44 d).

**Gate: `npm run test:full` once on 0272091.** Wall **17.2 min** (real 17 m 15 s), CPU 94.0 min, machine load 63% (12
cores, 6 workers). M8 was 10.6 min: F4's multi-seed calib (114 runs; 6 shards 357–395 s) and worldfx's 20 classic runs,
and G1's hygiene 3b (3 shards ≈ 65 s). CPU 94 min on 6 workers is a 15.7-min floor, so the full tier is CPU-bound.

| script | pass | fail | warn | wall s | | script | pass | fail | warn | wall s |
|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|
| tsc-scripts | – | 0 | – | 1.4 | | lint-structure | 8 | 0 | 0 | 2.0 |
| golden-timelines | 16 | 0 | 3 | 4.4 | | safety (6 shards 178–209 s) | 17 | **1** | 0 | 9.1 |
| identity | 76 | 0 | 3 | 2.0 | | danger | 27 | 0 | 0 | 2.2 |
| effective | 27 | 0 | 0 | 7.4 | | oversight | 29 | 0 | 0 | 2.0 |
| data | 62 | 0 | 0 | 5.7 | | sabotage | 25 | 0 | 0 | 7.4 |
| suites | 31 | 0 | 0 | 4.4 | | footholds | 35 | 0 | 0 | 6.5 |
| signals | 21 | 0 | 0 | 2.0 | | control | 33 | 0 | 0 | 4.9 |
| successor | 11 | 0 | 0 | 2.2 | | safetyideas | 39 | 0 | 0 | 2.1 |
| research | 30 | 0 | 0 | 10.1 | | safetyrates (4 shards 30–33 s) | 19 | 0 | 7 | 2.6 |
| evals | 32 | 0 | 0 | 26.8 | | finance (3 shards 104–126 s) | 64 | **2** | 0 | 35.5 |
| safetyresearch | 30 | 0 | 0 | 16.0 | | worldfx (4 shards 81–90 s) | 35 | **3** | 0 | 6.3 |
| worktypes | 16 | 0 | 0 | 31.9 | | ws4 | 25 | 0 | 0 | 167.3 |
| calib (6 shards 357–395 s) | 38 | 0 | 9 | 2.6 | | rivals | 16 | 0 | 0 | 27.8 |
| fixtures | 15 | 0 | 0 | 2.3 | | products | 58 | 0 | 0 | 5.2 |
| hygiene (no perf; 3 shards 65–67 s) | 214 | 0 | 0 | 51.5 | | serving | 87 | **1** | 0 | 37.8 |
| lint-hidden | 1 | 0 | 0 | 1.9 | | money | 24 | 0 | 0 | 22.4 |
| lint-ux | 9 | 0 | 0 | 2.5 | | idle | 3 | 0 | 0 | 197.8 |
| lint-tradeoffs | 486 | 0 | 0 | 2.2 | | ui | 594 | 0 | 0 | 364.6 |
| | | | | | | **total** | 2253 | 7 | | |

**Failures, split.** 7, all known; none caused by M9.
- *Known (7):* safety S5 RefBot "U falls below L by SAR" (median U − L at SAR +0.36, below in 38% of 40 worlds; the user
  approved the S5R approach → task S5R); finance F8 RefBot out of distress through 2026 50.0% (vs ≥ 75%) and F11 path
  2027 $95.8B (vs $140B ± 30%, floor $98B; M8 $84.7B) (finance session / MKT); serving A5 E9 price paid ×3.55/yr on seed
  2027 (hardware ×1.31, margin ×1.06, models bought ×2.56; 20-seed median ×4.33 [×2.79–6.31], F4 §7; → MKT); worldfx
  A2a 6.7% (band 5–6.5%), A2c tokens ×8.1 over 2026 (seed 2027; median ×8.5; → MKT), W4 firm adoption 23.2% (17–20 ± 2).
- *Newly passing (vs M8's 12):* calib T1L ai2027 SAR (now +0.031 y) and fast SC (+0.067 y) after F4's LEADER_CAL refit;
  worldfx GOV T1 (median 2027-12-17 over 20 seeds, 14/20 in the window; G1's ACCEPT.mid 11.5). T1L authors2026 SIAR /
  ASI (−0.84 / −1.68 y on the 5-seed median) are KNOWN WARNs since F4 (the leader's post-SAR pace), no longer failures.
  T1 passes on the 20-seed median on every preset (ai2027 SC / SAR / SIAR / ASI −0.025 / −0.095 / −0.078 / −0.003 y;
  authors2026, fast, slow as F4's "after" table). Still passing: S4 RefBot P_mis at ASI 0.577 (band 0.55–0.85), S4
  safe-only 0.043, S5 mixed (+0.43, 80%); finance F7 revenue $48.9B / capex $184.3B / valuation $1.69T, F2 45.8M, F9;
  worldfx F7/F11 2026 $50.5B, W2 0.7%, HireRate 2027-05-01, remote work 2027-09-18, U +1 pp 2027-10-13 (medians);
  hygiene 214 (G1's 3b).
- *Caused by M9:* none. The three re-baselined checks pass (A3 ×44.79/yr, E2 1.133 / 1.028 and 1.303 / 1.058, ω 0.070).
- *Moved, not failures:* safetyrates 19 / 0 / 7 WARN (M8 20 / 0 / 6): **F5 EA end 2026 50.6% [37.8–57.7] is 0.6 pp
  above its band (20–50%; M8 48.6%)**, a new WARN with F4's refit (likely the higher AI taste on the pre-SC path; not
  bisected); F5 AF end 2026 18.0% [13.1–41.0] (known, → AF); F6 persistence rows 71–73% (known). worldfx F11 2027 passes on
  seed 2027 ($120.8B) while the 20-seed median is $89.3B [p10 $79.6B, p90 $105.7B] (its INFO line; → MKT).
- Not run: `test:perf` (the lead runs it next on a quiet machine); the bots table (F5 ran it).

**Lead decisions (recorded, from the M6 decisions file after "M8 done").**
- M8 done (2032f15; test:full 10.6 min, 12 known, 0 caused). F4 launched (H) from 2032f15.
- F4 accepted (aea0cb5, 3b8988a, f23411e): T1 on the 20-seed median, T1L on the 5-seed median, `calscan.ts` for refits;
  the refits and LEADER_CAL as in F4 §3 / §5; fast has no window (structural, known); authors2026 T1L SIAR / ASI known
  WARN; D7 rule kept; date checks on the median. Re-baselines in M9 (above); test:cal on 10 workers on ≥ 12 cores.
- Must fix before master: F4's determinism finding → G1 (H) with a hygiene check, plus the GOV T1 refit on the
  calibrated path. **G1 accepted** (ad50fa6, e09ad94): the cause was process history (the reference-path memo), fixed at
  the root; hygiene 3b; test:cal medians unchanged. **GOV ACCEPT.mid 11.5 kept over 11.25** (the median on target is the
  F4 principle; 11.25 would cover 16/20 seeds at −11 d). **Caveat:** F4's `calscan.ts` ai2027 grids ran many points per
  process on the old memo, so the passing-window edges in F4 §3 for ai2027 may be slightly off; the committed values are
  confirmed by test:cal (fresh processes).
- After master (not blocking): MKT (A5 E9, A2c, F11 2027), S5R (user 2026-11-21: outcomes emerge from mechanisms if tuned;
  primary-source re-read first), AF end-2026 WARN; fast-preset milestone spacing; authors2026 leader post-SAR pace;
  finance F8 (finance session).
- User plan 2026-11-21 (authoritative): G1 → M9 → `test:perf` → merge model-v3 to master → merge finance-v3 to master
  (check the finance session first; fix conflicts; re-check everything) → decide S5R / MKT / AF / others.

**Readouts for later tasks.** Fixtures are rev 33 from the merged code. The full tier now takes 17 min on 6 workers and
is CPU-bound (calib's 20-seed T1 is the critical path); on ≥ 12 cores more full-tier workers may help (not changed: the
full tier also runs the headless UI test). EA end 2026 sits 0.6 pp over its band (WARN): one for AF / S5R. Next:
`test:perf` on a quiet machine → merge to master (F7) → FIN → S5R / MKT / AF.


### P4 notes (tick performance, behaviour-identical; fast-forwarded onto model-v3 after M9, 2026-11-21)

**Rule.** No behaviour change: no cadence, rounding or approximation changes, no game number moved. Every change gives
the same floating-point values in the same order of operations. There is no state change and no schemaRev bump.

## Result in one paragraph

The tick does about 10–20% less work: the world mix is −10 to −19%, the rivals' research −14%, security / products /
director −20 to −40%, and the per-system sum is −8 to −16% under load. All five perf budgets still fail except "its own
cost", which now passes 3 of 4 runs (+8.7 / +10.4 / +22.0 / +8.6%, base +27.8 / +31.9%). The machine was **not quiet**
during this task: the same base code measured 3.0 → 4.8 ms a day between runs (hygiene passive), and the leader game 2.0
→ 8.0 ms. So absolute numbers move 2–4× with load, and only interleaved base / current runs are comparable. The 1.5 ms
average is about 2× below what this code needs under that load, and there is no exact change that is worth 2×: see "What
remains".

## Profile before (base 7dc2ccd, `scripts/v2/profile.ts 1500 1`, µs per live day, machine under load)

| system | passive seed 9 | leader lab | RefBot seed 5 sampled |
|---|---|---|---|
| revenue (world mix, readout, customer stocks) | 1967 | 2482 | 3205 |
| research | 527 | 470 | 824 |
| production | 520 | 519 | 569 |
| incidents | 359 | 336 | 365 |
| worldDaily | 281 | 376 | 271 |
| rivalsChina | 216 | 237 | 266 |
| director | 179 | 183 | 120 |
| actorsDaily | 155 | 144 | 755 |
| safetyResearch | 138 | 122 | 251 |
| security | 112 | 105 | 135 |
| record (weekly, per day) | 102 | 107 | 114 |
| daily average / worst quarter | 3578 µs / 16.7 ms | 5353 µs / 22.2 ms | 7619 µs / 19.2 ms |

On a quiet moment, the bundled CPU profile of the two hygiene games gives these shares of the tick. computeMix is 32% of
the tick: surplusChoice 13.5%, the region × sector loop 5.3%, studentOffer 3.0%, offerOf 1.4%. Also: revenueReadout 4.4%,
the player's research 8.6% (capResearchDay 4.9%, safAllocation 1.7%), production 9.0% (rivalResearch 4.7%,
applyBestMix 2.6%), incidents 5.3% (controlStep 3.0%), worldDaily 5.3%, rivals 3.7%, relations 2.8%, director 2.8%
(E17's U bisection 2.3%), agendas 2.5%, security 1.9%. rlGains / refRlGain together are 2.2%.

## Before → after, per system (`.p4tmp/sysab.ts`: base and current module graphs in one process, games alternated, 2 rounds, µs per live day, loaded machine)

| system | passive base | passive P4 | Δ | leader base | leader P4 | Δ |
|---|---|---|---|---|---|---|
| revenue | 2452 | 2217 | −10% | 3051 | 2700 | −11% |
| research | 632 | 628 | −1% | 593 | 577 | −3% |
| production | 620 | 547 | −12% | 647 | 555 | −14% |
| worldDaily | 464 | 362 | −22% | 423 | 412 | −2% |
| incidents | 448 | 431 | −4% | 417 | 418 | 0% |
| rivalsChina | 255 | 265 | +4% | 288 | 282 | −2% |
| director | 232 | 188 | −19% | 234 | 183 | −22% |
| actorsDaily | 187 | 201 | +8% | 174 | 188 | +8% |
| safetyResearch | 162 | 169 | +4% | 169 | 169 | 0% |
| security | 148 | 105 | −29% | 138 | 102 | −26% |
| record | 120 | 122 | +2% | 125 | 117 | −7% |
| products | 39 | 24 | −39% | 38 | 23 | −40% |
| geoQ | 27 | 22 | −17% | 31 | 28 | −9% |
| **sum** | **6125** | **5634** | **−8%** | **6606** | **6036** | **−9%** |

The systems this task did not touch move ±8% (load). An earlier 2-round run in a quieter moment gave −16% passive (sum
7749 → 6501) and −9% leader. The world mix alone (`.p4tmp/bench.ts`: worldMix on fixed states, base and P4 interleaved,
median of 300) is −16 to −19% on day-300 states (2^6–2^7 choice sets) and −1 to −7% late in the game (2^4–2^5 sets).

## What changed (commit → hot spot → change)

- **ea048c4** `worldfx/choice.ts` surplusChoice band shares (13.5% of the tick). Each set's Σ e over its members in
  ascending provider order is computed by a doubling walk over the providers: a provider in every set adds its e to every
  partial sum, and a partial provider k gives sums[m + 2^k] = sums[m] + e. So the left-to-right sums are the same and
  prefixes are shared. Each provider's share then accumulates over the sets that contain it, in set order: the same
  additions into sh[i] in the same order. A set skipped for Σ ≤ 0 adds 0·e = +0. The plain loop is kept for non-finite
  weights. Mix −6 to −19%.
- **4f27c6c** The choice sets no longer build per-set member lists and boolean arrays (built lazily for the plain loop).
  When every mask has p > 0 (the usual case), a partial provider's sets are mask blocks, so there is no index list.
- **b55f3bf** `models/stacks.ts` refRlGain (2.1%): memoised on exactly (flop, mid, ceil). It is pure: everything else
  it reads is a module constant that no harness changes (checked: RL_CURVE, RL_BUDGET, TRANSFER, RL_C0, the reference
  weights). It now runs `effective.ts rlGainGeneral`, which computes only the cognitive domains' gains that
  rlGains(…).general reads, with the same expressions in the same order. A rival's recipe today is yesterday's one-day
  step, so recipeRates' at(0) hits the memo. recipeRates 2.0% → 0.6%. tokEff and rlGOfBuild readers (security,
  products, milestones) are −20 to −40%.
- **5f6ffe6** `actors/rivalModel.ts` bestRivalMix: the golden-section search (18 evaluations per lab a day) evaluates only
  E and I (rawEI, the same expressions as rawAggregate's), not the readout parts (Xh, wH, copies). Production −12 to −14%.
- **e6a1a9c** A band where a set needs D10's overflow guard (about 15 bands a day late in a game; it reran
  the plain loop, 0.7%) stays on the per-provider path. The guarded sets' renormalised terms (uSet and Σ over the members
  in member order, as before) are added per provider in set order, with the others' f·e.
- **5a1b213 + 58130d1** `departments/workfit.ts` fitOf / refPoints iterate the weights with for-in (Object.entries'
  order, read live) instead of allocating an entries array per call. 5a1b213 first cached the entries once per work
  type. That was the G1 pattern: safetyresearch's E2 parity check swaps `WORK_TYPES[SAF_*].w` between games, and the
  check failed with the stale cache (test:quick). 58130d1 replaced the cache with the live for-in, and did the same in
  modelHazards for DANGER_ACTS.
- **358695e** Tier adequacy: when a ≥ hi, (a − lo)/w ≥ 1 under rounding, and when a ≤ lo it is ≤ 0. So the clamp's value
  is taken without the division there.
- **25c8db2** `safety/understanding.ts understandingMarginBelow`: the director's E17 asks daily whether U − L < −1. The
  bisection's result lies in [lo, hi] at every step, and U = round(lo·20)/20 and the margin are monotone in it. So the
  check returns as soon as both ends give the same answer, and understanding() runs in full only when the flag fires.
  Checked against understanding().margin on 33,000 (state, threshold) pairs, two RefBot games: 0 mismatches.
  Director −19 to −22%.
- **f063a08** computeMix looks up a teacher's student-gap memo once per provider and sector (studentsOf /
  studentOfferIn), not at each band edge. studentOffer keeps its signature. useFit's P19 memo keys are made once
  instead of concatenating a string per call.
- **d803f22** moonshotH100e sums the techs with for-in (no Object.values array; it is called many times a day through
  spareServing).

## Proof of identical behaviour

- **State hashes** (`.p4tmp/hash.ts`: hygiene's stateHash, FNV over the full serialised state, **every day**). Base =
  `git archive 7dc2ccd` in `.p4tmp/base`. Scenarios: RefBot classic ai2027 seeds 2027, 2, 4 (refDay: decide pending,
  act, tick with endings skipped) to day 1500; the leader-lab game (seed 9, endings skipped) to day 1500; the passive
  seed-9 hygiene game to its ending (day 1102). After each step (c1 … c6): all 5 identical on all 1500 / 1102 days.
- **Fuzz**: base vs P4 surplusChoice on 60,000 random lineups / brands / access arrays (n 1–9, zero, full, 1e-9,
  1e-200 and 1 − 1e-11 access, V up to 1e7, prices down to 1e-7). The D10 guard fired in 6,134 bands. 0 differ (JSON
  of every output number, −0 distinguished). base vs P4 refRlGain on 200,000 inputs (twice each, memo hit): 0 differ.
- `npx tsx scripts/v2/run.ts --tier full --only hygiene,identity,fixtures`: 305 pass, 0 fail. Fixtures are not stale
  (behaviour identical). Hygiene 214 / 0, including determinism, stream isolation, the readout sweep and process history.
- `npm run test:quick`: only the known failures (worldfx A2a 6.7%, A2c ×8.1, W4 23.2%; serving A5 E9 ×3.55, the same
  values as M9's list). safetyresearch E2 parity failed once on 5a1b213's cache; it passes after 58130d1.
- tsc main and `scripts/v2`: clean.

## Perf checks (hygiene section 8), before → after

| check | task's measurement (base) | base, this session | P4, this session |
|---|---|---|---|
| daily tick average ≤ 1.5 ms | 3053 µs | 3012 / 4835 / 4235 | 3452 / 3728 / 3132 |
| worst quarter tick ≤ 8 ms | 14.65 ms | 19.66 / 21.19 / 19.45 | 18.64 / 15.65 / 15.84 |
| leader lab daily ≤ 1.5 ms | 6802 µs | 5260 / 7086 / 7595 | 6588 / 7341 / 5739 |
| leader lab worst quarter ≤ 8 ms | 23.65 ms | 16.20 / 21.97 / 16.39 | 14.97 / 14.04 / 17.72 |
| leader lab's own cost ≤ +20% | +22.8% | +31.9 / +27.8 / +8.6% | +10.4 / +22.0 / +8.7% |

The base and P4 runs were alternated, but load changed between them, so pairs differ by up to 1.6 ms.

## What remains (needs a behaviour change, or a quiet machine; not done)

- **The daily average.** On a quiet moment the bundled base ran the passive game at 1.66–1.76 ms a day and the leader
  game at 1.92–2.06 ms. Under load the same code takes 3–8 ms. With −10 to −20% the quiet numbers are ≈ 1.45–1.6 ms
  (passive) and ≈ 1.7–1.8 ms (leader): at or near the budget, never under it with load.
- **What is left is float math in a fixed order.** The mix is still about 35–40% of the tick. In order of size:
  - The surplus choice: per band, Q = 2^K choice sets with Q divisions and Σ over providers of their sets' mul-adds,
    plus tier utilities with a division by μ_b and n exps.
  - The region × sector loop: the cost gate's pow and the tier mixes.
  - Student offers.
  Making these cheaper needs a different summation order (merging sets, factoring e_i out of Σ_q f_q·e_i,
  multiplying by 1/μ). That changes the last bits.
- The rest of the tick is flat: no system other than revenue is above 10%, and no single function outside the mix is
  above 1.5%.
- **The leader lab's cost.** It is one more provider, and in US / ROW it is one more partial-access provider. That
  doubles the choice sets (2^6 → 2^7), so it costs about +10–25% depending on the day. Only an approximate choice (fewer
  sets) would remove that.
- **The worst quarter.** The passive game's worst quarter is its first, day 92. It costs 10–15 ms quiet, against 3–7 ms
  for later quarters, because it is the first run of the quarterly systems' code (capitalQ 1.3 ms there vs 0.2 ms warm,
  marketQ 1.3 vs 0.2, boardQ 0.8 vs 0.2, geoQ 3.0 vs 1.0–1.3). That cost is JIT warm-up and is not reachable by exact
  changes. geoQ's own world mix (rivalFinanceQ) is needed: state changes between revenue (60) and geoQ (440), as P3
  found.

## Scratch (not committed, `.p4tmp/`)

- `hash.ts` / `hashall.sh`: day-by-day hashes vs the base build.
- `drive.ts` / `ab.sh`: timed hygiene games, base vs current.
- `sysab.ts`: per-system A/B in one process.
- `bench.ts` / `mixprof.ts`: mix A/B and profile.
- `tickprof.ts` + `anal.mjs` / `lines.mjs`: bundled `--cpu-prof` and self / callee / line breakdowns.
- `fuzzchoice.ts`, `fuzzrl.ts`, `ucheck.ts`: equivalence checks.

**Lead after P4 (2026-11-21).** test:perf on the merged head, twice (machine load 39–43%: Windows Defender and the search indexer, not other agents): daily tick 3.65–4.12 ms (budget 1.5), worst quarter 16.8–18.5 ms (8), leader lab 5.7–6.3 ms / 15.5–16.0 ms, the leader lab's own cost +10.6 / +19.0% (passes). The UI's fast-forward runs at 12 ms per day (`SPEED_MS`), so quarter days can stutter there; ordinary speeds (≥ 70 ms per day) are unaffected. **User decision:** merge to master now; performance work comes after everything else, including the finance merge (task PERF).

## FIN merge notes (2026-11-21, branch `fin-merge`, worktree `../AI27-fin-merge`)

`git merge --no-ff finance-v3` (22 commits, FIN1–FIN6c incl. finance-v3-div and finance-v3-ui) onto master 7017308
(model v3 after P4). Merge commit 2d19b77; fixes 94df130, ae5498f, 61ecd2c, 76fdf02; docs on top. Both sides'
mechanisms are kept; no `FINM-DECIDE` marker was needed (no two mechanisms modelled the same thing in ways that could
not both stay).

**Conflicts and resolutions (22 files; 47 touched by both).**
- *Schema* (`core/save.ts`): model v3's chain to 33 kept as is; finance's nine migrations (built as 11 → 12 … 19 → 20
  on the old base) renumbered after it, finance rev r = merged rev r + 22: 33 → 34 FIN1 (SPV leasebacks → financing
  leases, SPV / JV / neocloud templates gone, LTA firm tranches, opCash4q), 34 → 35 FIN2 (credibility, promises),
  35 → 36 FIN3a (approvals list), 36 → 37 FIN3b (E37 freeze, reinstatement), 37 → 38 FIN4a (partner records), 38 → 39
  FIN5c (division), 39 → 40 FIN4r (typical round, lease ids), 40 → 41 FIN5a (story mark, lab revenue history), 41 → 42
  FIN5b (rivals' marks, pool, raised). **SCHEMA_REV 42.** A model-v3 save carries the base's old finance block, so the
  order (model first, finance after) is the right one. Two finance steps were not idempotent on an already-migrated
  state and now are: FIN1 leaves a site that already has a FIN1 lease alone, FIN5a sets the story mark only where there
  is none. Saves written by the finance-v3 branch itself (its revs 12–20) collide with model v3's numbers and do not
  load (they were never shipped).
- *Types*: `RivalLab` keeps model v3's `phys` and finance's `finance: RivalFinance`; `CostLine` keeps model v3's `unit`
  and finance's `valuation` currency.
- *Rivals* (`actors/rivals.ts`): `rivalFinanceQ` is finance's (revenue toward model v3's `labMarketRevenue`, then
  `rivalMoneyQ`, then chip orders) with model v3's shared world mix (P2), reset when a lab leaves the market;
  `labDaily` keeps model v3's `trainDay` and adds the IP-access flow through `addRivalKnowledge`.
- *Finance seams re-pointed to model v3* (`finance/observe.ts` and its callers; lint-structure forbids the old fields):
  `licensedModel` / `licensedGap` compare G (was pm), so `ipAccessDaily` is OOM of G into the lab's pretraining recipe
  a day (10% of the G gap a year; was know-how pa); license-and-hire (`exitRival`) brings the buyer's recipe up to the
  seller's (was `pa = max`); `copyrightExposure` reads model v3 D1's unlicensed public crawl (`unlicensedPublicT`, was
  `dataAssets.unlicensedTokensT`) and china.ts's suit roll uses it. Revenue needed no rewiring: finance reads
  `deployment.revenueRate` (model v3's revenue system writes it), rivals' `revenueRun` follows model v3's market, and
  the sector value S and the story read those run-rates; `servingEconomics` (serving H100e × owned / rented cost) and
  `publicLevel` (measured L / Lg) stay valid bridges on model v3's quantities.
- *Events*: E17 trigger = finance's `redFlags` + model v3's P2 / P4 early exits; "Pause & investigate" keeps model v3's
  investigation gain (F6d) and takes finance's board cost (mood by seat kind, FIN3a; `boardSpeedAppetite` is gone);
  the old `credibility +2` gain stays dropped (never applied). `finance/actions.ts` dealPreview is finance's with model
  v3's '%' unit on the custom-chip research line (F6b).
- *Bots*: RefBot (F5: compete, cheap tier, Trusted to AI, footholds) and finance's bot decisions (autopilot, merger
  choice) auto-merged; the safe bot's paid list = model v3's (`data.license`, no D3) with finance's `cmp.community`
  (F1 is gone).
- *Exports / UI*: `core/selectors.ts` and `index.ts` take both sides (finance's `ousterVote` family replaces
  `ousterRiskQ`); Products keeps model v3's side column and finance's charter-holds chip (auto-evaluate stays a Ref to
  Models › Evals); CoreLoop / TopStrip / shell selectors take `customerCount` / `customerShare` and `divisionStatus`.
  B4 wording: the IP-access tooltip says "learns from your models" (not know-how), the sector value tooltip "× the
  frontier factor".
- *Scripts*: `finance.ts` keeps T0's simulation cache and SMOKE mode (finance's checks through `runBotC`; RUN_PICKS add
  seed, board confidence, credibility, promises, revenue run, valuation, ledger and time; the PBC hold set is an array
  for the cache); finance's migration tests renumbered (34 … 42); multi-seed finance checks print SMOKE in quick (F9
  FC1 / FC2, FIN3a board confidence, FIN6a FC2 by year). Fixture-drift rewrites: FIN2 / FIN4r promise weight on the
  closed amounts ($0.64B / $35B for asks of $1B / $50B), the FIN4b trust vote marks its threshold model (the v3 day-400
  best version has no danger flag), uitest FIN4b brings a second rival back (the v3 day-900 fixture has two active
  rivals and FIN3c buys one). Hygiene: the leader-lab check strips rivals' marks (FIN5b); new checks: a rev-33 save
  with the old finance block migrates to 42, the finance chain is idempotent, every rev 15–41 loads to 42;
  `SCHEMA_REV === 42` in control / data / footholds / hygiene. lint-ux keeps B4 (§4) and adds finance's glossary-number
  check (§5).
- Fixtures regenerated (`fixtures.ts --write`), GLOSSARY.md regenerated (`lint-ux.ts --doc`, 550 terms).
  `scripts/v2/tmp-fin1/` (finance scratch with a rev-11 save that the merged chain rejects) removed.

**Refits.** test:cal after the merge: T1 on the 20-seed median passes on every preset (ai2027 SC −0.003 / SAR −0.084 /
SIAR −0.055 / ASI +0.012 y; authors2026, fast, slow in tolerance): no G_SC refit. T1L slow SC failed (+0.11 y on the
5-seed median; `calscan.ts t1l slow` on 20 seeds: LEADER_CAL 0.79 +0.085 y fails by 1.06 tolerances, **0.80 −0.012 y**,
0.81 −0.086 fails, 0.82 −0.121, 0.83 −0.155): LEADER_CAL slow 0.79 → 0.80, T1L slow SC then −0.016 y on 5 seeds.
T1L ai2027 and fast pass; authors2026 SIAR / ASI stay the known WARNs. The window is one step wide (only 0.80 passes):
the next change that moves the shared world by days may need it again.

**Finance checks** (12 RefBot seeds; master = M9's full run on 0272091, finance-v3 = FIN6a / FIN6c, merged = test:full
on 61ecd2c):

| Check | master | finance-v3 | merged |
|---|---|---|---|
| F1 production 2026 (25M ±20%) | pass | pass | 23.1M pass |
| F2 production 2027 (45–60M) | 45.8M | 47.0M | **44.0M fail** |
| F3 stock vs globalCompute (±20%) | pass | pass | 84–111% pass |
| F4 demand shock timing | pass | pass | t+4 / t+9 pass |
| F5 spot rental (+35–45%; −60–80%) | pass | pass | +38% / −67…−72% pass |
| F6 supplier margin 70–75% | pass | pass | 76.1% pass |
| F7 2026 revenue / capex / compute / power / valuation | $48.9B / $184.3B / pass / pass / $1.69T | pass / pass / pass / pass / $1.24T | $47.6B / $179.6B / $29.4B / 6.4 GW / $1.23T pass |
| F8 deal + financing; distress-free 2026 (≥ 75%); C7 path; capex2x | pass; **50.0%**; pass; pass | pass; 83.3%; pass; pass | pass ($71B); **66.7% fail**; 100%; 100% |
| F9 FC1 sector value | (old formula grid, pass) | $632B / $3.00T | $615B / $3.10T pass |
| F9 FC2 leader multiple 20–37× | (old grid, pass) | 30.3× | 22.1× pass |
| F9 FC2 slower growth lower | – | 25.1× < 30.3× pass | **25.3× > 22.1× fail** |
| F9 FC2 trailing rivals lower | – | 27.4× < 30.3× pass | **26.5× > 22.1× fail** |
| F9 dilution ≤ 8%, 14% anchored, doubt −25% | pass | pass | 8.0% / 14% / −25% pass |
| F10 sites blocked / delayed / 8 q | pass | pass | 6.5% / 31% / 8 q pass |
| F11 2027 revenue ($140B ±30%) | **$95.8B fail** | pass | **$86.0B fail** |
| F11 run-rate follows deployments | pass | pass | pass |
| FIN3a end-2027 board confidence ≥ 55 | – | pass | **52.2 fail** |
| FIN6a FC2 by year (2027 20–37×, 2026 ≥ 15×) | – | 2026 19.2×, 2027 33.5× | **2026 22.4×, no ×2.5+ mark in 2027 (fail)** |

**test:full** (61ecd2c, 18.1 min wall, 103 cpu-min, 6 workers, machine load 76%): 31/36 scripts, 2371 checks passed,
11 failed; the ui job crashed in FIN4b (fixture drift, fixed in 76fdf02; `npm run test:ui` then 686/686).

**Failures, split.**
- *Known on master (V3-TASKS list):* safety S5 RefBot (median U − L at SAR +0.60, below in 30%; → S5R); finance F8
  distress-free 66.7% (master 50.0%: better, still under 75%) and F11 2027 $86.0B (master $95.8B; → MKT); serving A5 E9
  ×3.99/yr (→ MKT); worldfx A2a 6.7% and W4 23.2%. WARNs: calib T1 A1 / A2, T1L authors2026 SIAR / ASI; safetyrates AF
  end 2026 21.9% and F6 persistence (71–74%).
- *Known on finance-v3:* none failing (its list was S5 and hygiene's absolute perf under load; perf not run here).
- *Newly passing:* worldfx A2c tokens ×7.6 over 2026 on seed 2027 (band ×3–8; 20-seed median ×8.1, INFO); safetyrates
  F5 EA end 2026 back in its band (M9 50.6% WARN). Finance's F9 FC1 / FC2 replace master's old valuation-grid checks
  (that formula is gone) and pass on the sector value and the leader multiple.
- *Caused by the merge, not merge errors* (finance's [fit] values on model v3's paths; FIN6a's "refit after model-v3"
  list): F2 2027 production 44.0M (1M under the band: rivals now order chips from their FIN5b cash, tighter than the old
  raise rule on model v3's rival revenues); F9 FC2 slower-growth and trailing-rival orderings (the RefBot's high-growth
  marks sit at 22×, under slower marks at 25× and trailing rivals at 26.5×: FC2's multiple, cap growth exponent and
  share weights were fitted to the pre-v3 revenue path); FIN6a FC2 by year (no ×2.5+ growth mark in 2027: the v3
  revenue path grows slower, the cause of F11 2027 too); FIN3a end-2027 board confidence 52.2 (seeds 17–76; the slower
  2027 revenue misses promises). None is a wiring error: revenue, valuation and rival numbers move with model v3's
  demand.
- *Merge errors found and fixed:* the seams above (pm / pa / dataAssets readers), the non-idempotent FIN1 / FIN5a
  migrations, the cached finance runs missing ledger / time, the hygiene every-rev check's start (15), the fixture-drift
  tests listed under Scripts.

**Open decisions (lead).**
1. Finance refit on model v3 (FIN6a's list, now due): κ_S / α, FC2 multiple and cap growth exponent, share weights, the
   RefBot autopilot (F8 66.7%, FIN3a 52.2), F2's 1M shortfall (rivals' chip orders from cash). Best after MKT, since F11
   2027 and FC2 by year share MKT's revenue shortfall.
2. LEADER_CAL slow 0.80 is a one-step window.
3. Saves from the finance-v3 branch (revs 12–20) do not load; fine unless someone kept one.
4. `scripts/v2/tmp-fin1/` removed (finance scratch); restore from finance-v3 if it was meant to stay.
