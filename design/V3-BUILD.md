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

---

## V2–V7

Detailed when each starts (spec §16). V2 research (removes BRIDGE(V2)), V3 work types and AI labour (removes the pm
bridge from production and milestones), V4 serving and products, V5 data assets, suites and evals, V6 safety, V7
rivals and China, bots, UI pass, jank audit.
