# NPC misalignment and incidents: M_world(G), k, race discount, per-lab draw, hazards (proposal)

Written 2026-11-27 for NPC-LABS.md §8 / open item O2 (accepted: M_world computed once per world from the alignment
latents the player's safety model starts from). Status: **proposal for the designer**. Nothing is built. Read-only
analysis of master; two small probes under `AI27/.scratch/` (`mworld.ts`, `mworld2.ts`, git-ignored).

Tags: **[S]** sourced, **[C]** calibrated today (kept), **[D]** design value, **[P]** read from the probe.

---

## 1. What exists today (what this replaces)

- **Misalignment index** (`safety/traits.ts misalignment`): a weighted sum of hidden traits, SCHEME 0.25, AF / POWER /
  SUCC 0.15, COLLUDE / SAND 0.1, TGAME / OBF 0.05, +0.05 per speculative U-mode, −0.1·(HONEST − 0.5) and
  −0.1·(CORRIG − 0.5), clamped to [0, 1]. TRAIT_START (`data/v2/traits.ts`) gives 0.017.
- **World latents** (`world/hidden.ts sampleHidden`):
  - λ1–λ6 ~ N(0, 1), with the preset shift on benignGeneralization (+) and schemingDefault (−): easy +0.8, hard −0.8.
  - `difficultyMult` D = clamp(exp(0.35·(λ6 − λ4)), 0.6, 1.65) multiplies growth of every difficulty trait.
  - `edgeWeights`: w̄·exp(N(0, σ_grade/2)) within [½, 2]·w̄; E19 (→ SCHEME) also × exp(0.5·λ6).
  - `uModePropensity`: real modes U(0.3, 0.7); speculative modes U(0.05, 0.3)·(1 + 0.3·λ6).
  - `doomThreshold` 0.4 and `toleranceNoise` ε_w ~ Logistic(0, 0.06) → θ_w (`safety/control.ts lossThreshold`).
  - The calibration's "central, leaning hard" setting (shift −0.4, HANDOFF-CALIBRATION §1) **is not in code yet**: the
    presets are ±0.8 and 0. The probe emulates it by shifting a medium world's λ4/λ6 by 0.4 (D and E19 recomputed).
- **The old NPC path** (`rivalTraitStep`, to be deleted): the player's `stepTraits` with rival-only levers
  (`effSafety`, `growthMult`, the pool). It has none of the capability mechanisms (graders outgrown, learned hacking,
  methods failing at scale). So rival Mis is about flat in G and depends mostly on the number of posts since the lab's
  last base (rd review `rival-safety.md` §3).
- **Readers:**
  - `endings.ts` rule 7 → `resolveAsi`: exposure = bare Mis vs θ_w; containment = 0.2·safetyInvestment.
  - `epilogue.ts projectedMisAtAsi` → `projectLabMis`, a fast-forward loop of up to 120 trait steps.
  - `rivals.ts labDaily`: `labModelHazards` (the player's danger formula on the rival's deployed traits at
    `RIVAL_SITE` usage 0.2, autonomy 0.5, affordance 0.7, with mitigation 0.5·evalRigor + 0.3·safetyInvestment), plus
    a misuse row 2e-4·max(0, G − G_V0 − 1)·(open ? 1 : 0.5)·0.7·(1 − 0.6·evalRigor) per day. The daily roll is
    P = min(0.5, ΣH). Misuse severity is 3–5 uniform, and a severity-5 misuse incident feeds `catastropheCheck`.

## 2. M_world(G): the world's reference lineage, computed once

**Definition.** M_world(G) is the mean misalignment, over one base cycle, of a **reference lineage**:
- a lab that trains a new base at capability G and then post-trains it 7 times (12 months ÷ 56 days);
- every post uses the RefBot recipe `REFERENCE_POST` (constitution, broad RL, standard budget, visible CoT,
  standard safety, no methods), which is the "no special safety effort" lab;
- it trains on the 2025 start suites, graded by expert humans at the world's median-expert level (G_SC − Δ_bm);
- the trait graph runs on **this world's** `edgeWeights` and `difficultyMult`.

The computation is the trait graph's pure functions, not a lab:
1. **Base step.** `basePrior(tier(G))`, then `stepTraits` with pretrain = true, S5 from G (`S5_AI + K_S5G·(G − G_S5_0)`)
   and ω = 1.
2. **Post step** (×7). The signals come from the reference recipe at policy = (G − G_V0, h50 from the world's horizon
   law):
   - S2 from the start suites' missed exploits. The grader gap is `gapFactor`, CP3h(a).
   - The hack share h saturates RH (SR-24b), and learned hacking λ(h) (E16) drives E04, E18, E27 and E28.
   - S3 tracks the horizon (CP3h(b)).
   - `afCapGate(G)` gates alignment faking (E18), and tierF = tier/3.
   - Removal is `safetyRemovalMap` at `SAFETY_REMOVAL.standard`.
   - ω = 0.6.
3. **M_world(G)** = the mean of `misalignment(x)` over the 7 posts, with no U-modes (they are in the per-lab draw, §4).
   **σ_cyc(G)** = the sd of the same 7 values, the lineage's own sawtooth.

**Where capability enters.** Capability raises M_world through the world's own physics: the AF gate, situational
awareness by tier, graders outgrown, then learned hacking (the hack share at ASI is ≈ 0.96 in the median world) and
long tasks. A harder world raises D and the E19 weight, so it raises every lab at once. Nothing here is per lab.

**Inputs read** (all world or static data):
- `s.hidden.edgeWeights` and `difficultyMult`;
- the timeline: G_V0, `v3.gSC`, `v3.dBM`, the horizon law, the level knots;
- `TRAIT_START`, `basePrior`, `EDGES`, `REFERENCE_POST`, the start suites' exploitability, `SAFETY_REMOVAL`, `afCapGate`.

**What must change in code (one small task).** `postSignals`/`postHack`/`playerEnv` read `s.player` today: suites,
techniques, P11, `deploymentS8`, the AI critic, lab-wide methods. A state-free `referenceEnv(hidden, timeline, G)` must
build the same environment from data:
- the start suites;
- human graders only, no P11, no methods;
- S8 at its start value [D stand-in; it could follow the reference frontier's AI-company compute later].

The probe used the player's day-0 state as that environment, so it includes any lab-wide start techniques.

**Grid and cost.**
- Evaluate on the display-level grid L = 0, 0.25, …, 15 (61 points), mapped to G by `gOfLevel`. Use linear
  interpolation in G between points, flat below L 0 and above ASI. Some timeline draws put ASI 7 OOM above V0, others
  160, so a G grid would be uneven.
- Cost: 61 × (1 base + 7 posts) ≈ 490 `stepTraits` calls plus 61 signal builds. That is well under 20 ms per world.
- Memoise it in a `WeakMap` keyed on `s.hidden`, like `v0Memo` in incidents.ts. It is not saved and not part of the
  state hash.
- Deterministic: no RNG stream is consumed.

**Coupling (stated).** Re-tuning the trait graph, the danger data or the RL-suite/grader physics moves every NPC lab.
That is the accepted "same latents, same physics" coupling. Re-tuning the player's research, staff, products or own run
choices does not move them.

## 3. k and the race discount

**m_lab(G) = M_world(G) × (1 − k · se · rd) + ε_lab**, clamped to [0, 1].

- **se** is the kind's safety emphasis, 0..1. Take the existing research/17 §1.6.4 posture `safetyInvestment` per kind:
  safety-first 0.65, big-tech 0.5, boutique 0.5, frontier leader 0.35, open-weights 0.3, founder racer 0.1.
  China's lab: 0.1 + 0.4·safetyConcern/100, as today. Joint evals (C3) add a step to se.
- **k = 0.5 [D]**: the share of the reference misalignment that a lab at full emphasis removes.
  - Anchor [P]: in the reference lineage, inoculation alone (hack-induced generalisation × INOC_MULT 0.15 [S],
    MacDiarmid 2025) cuts M at ASI by 29–33% (medium 0.417 → 0.278; central-hard 0.492 → 0.349).
  - Anchor [S/C]: the calibration's two safety targets. RefBot P_mis at ASI is 0.40–0.80 (the AI Futures authors'
    credences, `S4.refBot.pMis`), which is Mis 0.376–0.483 on θ 0.4 ± logistic 0.06. The safe recipe has P_mis ≤ 0.25
    (`S4.safeRecipe.pMis`), which is Mis ≤ 0.334. Together they ask full effort to cut 20–35% at the reference's level,
    so se 0.65 × k 0.5 = 0.33 puts the safety-first kind there.
  - k stays below 1 because methods fail at scale (CP3i) and no lab has a full stack.
- **rd = 1 − raceResponse × pressure**, today's moving-goalposts rule (`effSafety`, §3.10.3 [D]) without the
  `rhetoricGap` noise.
  - pressure = clamp(public lag in months ÷ 6, 0, 1), from the **public** lag (spec §2.4); the leader's is 0.
  - raceResponse per kind = today's `raceRelaxation`: safety-first 0.55, big-tech 0.6, boutique 0.5, open-weights 0.7,
    leader 0.8, founder racer 0.9. China's lab is state-directed: 0, as today.

## 4. The per-lab draw ε_lab (generated, no stream)

**ε_lab = σ_cyc(G) · z_lab + 0.05 · n_spec,lab · [G ≥ G_SC]**

- **z_lab** ~ N(0, 1) from `hash32(seed, 'npc:mis:' + labId)`. It stands for where the lab sits in its own
  base/post cycle, the old sawtooth.
  - σ_cyc [P] is 0.002–0.008 at V0 and 0.04–0.08 from SC to ASI. So labs are alike in 2025 and spread at the frontier.
  - Fixed per lab: recommended, because it is stable and readable at the end screen. Alternative: redraw it at each of
    the lab's public model steps (open question Q6).
- **n_spec** is the speculative U-modes the lab's lineage carries. Each of the 7 is present with the world's
  `uModePropensity[u]`, decided by `hash32(seed, 'npc:umode:' + labId + u)` (λ6 raises them). Each adds 0.05 above SC,
  which is the Mis formula's own term and the player's rule "speculative modes need tier ≥ SC".
  - Expected value: 7 × 0.175·(1 + 0.3·λ6) ≈ 1.2 modes, so **+0.06** on average with an sd of about 0.05.
  - Their trait amplifications are not modelled; only the direct term is.

## 5. Incident hazards (model incidents and misuse)

The model-incident hazard per day for an NPC lab, on its public (deployed) model at G_pub, is:

  h_model = ρ^1.5 · H_ref(G_pub) · (1 − mit),
  - ρ = m_lab(G_pub) / M_world(G_pub) (= 1 − k·se·rd + ε/M);
  - mit = min(0.9, 0.8·se) [D].

- **H_ref(G)** is the existing danger formula (`modelHazards`, data/v2/danger.ts κ, θ, s, α [C]) applied to the
  reference lineage's mean trait vector at G, at `RIVAL_SITE` (kept [C]). It is a second curve from the same
  precompute, stored per act k so the act mix and severities still come from the rows.
  - The exponent 1.5 is the formula's own disposition convexity x^1.5 [D, v2].
  - So the spec's "capability × m × (1 − se)" holds: capability through H_ref(G), m through ρ^1.5, se through mit.
- **mit** = 0.8·se reproduces today's 0.5·evalRigor + 0.3·safetyInvestment per kind within 0.08 (safety 0.52 vs 0.55;
  leader 0.28 vs 0.36; maverick 0.08 vs 0.13; DeepCent 0.08 vs 0.08).
- **Misuse** keeps today's row, with se in place of evalRigor:
  h_misuse = 2e-4 · max(0, G_pub − G_V0 − 1.0) · (0.5 + 0.5·open) · 0.7 · (1 − 0.6·se)
  - Today's `MISUSE_PER_OOM` and `MISUSE_FROM_OOM` are [D].
  - open = 1 for an open-weights release, 0 for closed, or the kind's open share ("partly open").
  - Severity stays 3–5 uniform, so the severity-5 path into `catastropheCheck` is unchanged.
- **Roll and disclosure** as today: P = min(0.5, Σh), with one row drawn by weight.
  - Visibility = max(statutory floor 0.6 for severity ≥ 3 under SB 53/RAISE, clamp(0.4 + 0.9·se)·(severity ≥ 4 ? 1 :
    0.6)) [D]. This reproduces today's disclosure + 0.5·access + 0.1 per kind: safety 0.99 vs 1.0, leader 0.72 vs 0.83,
    maverick 0.49 vs 0.50, DeepCent 0.49 vs 0.38.
- **Rates against today** [P, 4 medium seeds, day 0, per lab-year]:
  - Today, rivals sit at TRAIT_START: **0.03–0.08 model acts/yr** per lab, and no misuse (G_pub is 0.5–0.9 OOM below V0).
  - Proposed: **0.01–0.02/yr**. The reference lineage's sycophancy and reward hacking at the RefBot recipe sit below
    TRAIT_START's (SYC 0.25, RH 0.15), and those two acts dominate start rates.
  - There is no NPC incident-rate target. `DANGER.start.actRate` (1.2 acts per lab-year) is the **player's** lab:
    products plus internal, a much larger site. If the designer wants today's NPC start rate kept, raising
    `RIVAL_SITE.usage` from 0.2 to about 0.5 restores it (Q5).
  - Later rates rise with G and with m, which today's flat traits did not do.

## 6. The readers

- **endings rule 7 → `resolveAsi`** for an NPC lab: mis = m_lab(G at its ASI day). Exposure = mis vs θ_w (DD-18 stand-in
  kept). Containment = 0.2·se.
- **The epilogue** (`projectedMisAtAsi`, `runEpilogue`, survival score): m_lab(G_ASI) with today's rd, in closed form.
  `projectLabMis` and its 120-step loop go. The days to ASI come from the lab's lag on the reference clock (spec §3).
- **End-screen truth** (`view.ts misByLab`): shows m_lab.
- **Theft** (open question Q7): while China holds a stolen model above its own G, China's m is the stolen model's (the
  player's true Mis of that version, or the victim lab's m). Once China's own G passes it, China's formula applies.

## 7. Sanity table

**What the values are.** Medians over 8 `tl-central` seeds [P]. M_world is the lineage mean. m is taken at z = 0 with no
U-modes; the expected U-mode term adds **+0.06 at SC and ASI**. θ_w is 0.40 ± logistic 0.06 (so m 0.44 loses in about
65% of worlds).

**Assumptions.**
- k = 0.5.
- Safety-first: se 0.65, raceResponse 0.55, pressure 0.5 (3 months behind), factor 0.76.
- Frontier leader: se 0.35, pressure 0, factor 0.83.
- Founder racer: se 0.1, raceResponse 0.9, pressure 0.5, factor 0.97.

| World (D mean) | Point | M_world | Safety-first | Frontier leader | Founder racer |
|---|---|---|---|---|---|
| Easy (+0.8; 0.70) | V0 | 0.036 | 0.028 | 0.030 | 0.035 |
| | SC | 0.259 | 0.198 | 0.214 | 0.252 |
| | ASI | 0.310 | 0.237 | 0.256 | 0.302 |
| Medium (0; 1.01) | V0 | 0.071 | 0.054 | 0.059 | 0.069 |
| | SC | 0.398 | 0.304 | 0.328 | 0.387 |
| | ASI | 0.417 | 0.319 | 0.344 | 0.406 |
| **Central, leaning hard (−0.4; 1.17)**, the calibration setting | V0 | 0.101 | 0.077 | 0.083 | 0.098 |
| | SC | 0.424 | 0.324 | 0.350 | 0.413 |
| | ASI | 0.492 | 0.376 | 0.406 | 0.479 |
| Hard (−0.8; 1.33) | V0 | 0.147 | 0.112 | 0.121 | 0.143 |
| | SC | 0.466 | 0.356 | 0.384 | 0.453 |
| | ASI | 0.587 | 0.448 | 0.484 | 0.571 |

**What the table shows.**
- **Ranges over seeds** (central-hard M_world): V0 0.01–0.18, SC 0.21–0.55, ASI 0.25–0.61. The timeline draw matters:
  draws with a short V0 → ASI distance (7 OOM) give a lower M at ASI.
- **Racing extremes** (central-hard, ASI): the leader caught at pressure 1 gives factor 0.97 → 0.48. The safety-first
  kind leading at pressure 0 gives factor 0.68 → 0.33.
- **With the +0.06 expected U-modes at ASI**:
  - central-hard: safety-first 0.44, leader 0.47, founder 0.54, all above θ 0.40, with spread from z and θ noise;
  - medium: 0.38 / 0.40 / 0.47;
  - easy: everyone is below θ.
- **Today's NPC values, for comparison:**
  - Day 0: every rival at TRAIT_START, Mis 0.017.
  - Day 400 (rd review fixture, seed 2027, θ_w 0.245): 0.33–0.52, against the player's 0.19.
  - Projected at ASI: 0.33–0.45 for every type, with the order **inverted** (safety lab 0.45, maverick 0.335).
  - Posture moved Mis by about 0.05, and the order followed posts since the last base.
- **The proposal** rises with capability (V0 → ASI ×4–8) and with world difficulty (ASI 0.31 → 0.59 from easy to hard,
  every kind together). Kinds keep a fixed order, about 0.10 apart at ASI between safety-first and founder in the
  calibration world.
- **Consistency check:** M_world at ASI in the medium world (0.42) sits inside the Mis band that the RefBot P_mis target
  implies (0.376–0.483). The no-effort reference lands where the player's reference does, without fitting.

## 8. Risks

1. **M_world(V0) ≠ the measured start.** The reference lineage at V0 reads 0.03–0.15 (mostly PERSONA/AF/SCHEME drift
   after 7 posts). The player's V0 and today's rivals start at TRAIT_START, 0.017. This only affects early incidents and
   is hidden. An offset, M_world(G) = Mis(TRAIT_START) + M_lin(G) − M_lin(G_V0), would honour "history is input" but
   lowers ASI by about 0.05–0.13 (Q2).
2. **The reference environment leans on player run physics** (start suites, graders, REFERENCE_POST). A change to the
   RL budget table or the suites moves every NPC lab. This is accepted world physics, but the state-free
   `referenceEnv` must read data constants only, never `s.player`.
3. **Safety effort is not monotone in the graph.** In the probe, the heavy safety level raised M at ASI (0.417 → 0.529;
   it may be my override missing `eaCoef`/detection gating). That is why k is a stated constant and not generated from
   graph variants of the recipe.
4. **Constant k ignores how well methods work in this world.** A world where methods fail at scale (`methodScale`,
   `agendaEfficacy`) should weaken safety-first labs too. Option B (Q3) generates it.
5. **The leader never races** (pressure 0 while it leads). AI 2027's leader races because the follower is two months
   behind. Today's rule has the same gap.
6. **Extreme timeline draws** (ASI 160 OOM above V0): the curve is flat above ASI, and hack share saturates (≈ 1), so
   M plateaus between SAR and ASI in some draws. That is plausible, not a bug.
7. **Calibration-world outcomes:** with the U-mode term, most NPC ASI-first endings in the −0.4 setting are takeovers,
   with the safety-first kind near even. That fits the AI 2027 race story but should be checked against
   `BOT.safe.lossMix` (other-ASI-first counts either way) and `BOT.ref.takeover`.

## 9. Open questions for the designer

- **Q1.** Statistic: base-cycle **mean** (recommended) or the end of the cycle (+0.03–0.06)?
- **Q2.** Offset M_world to the measured start Mis at V0 (risk 1): yes or no?
- **Q3.** k: a constant 0.5 [D] (recommended), or **option B**, generated: a second reference curve M_best,w(G) for a
  full-effort recipe (constitution, heavy, faithful CoT, inoculation and anti-scheming at the world's true efficacy and
  at-scale strength), with k_w(G) = 1 − M_best/M_world. Option B is more generated, but it needs the methods code made
  state-free, and it inherits risk 3.
- **Q4.** Should the leader feel pressure from a small lead, e.g. pressure = clamp(1 − lead months ÷ 3, 0, 1)? [D]. That
  would be new.
- **Q5.** Accept the lower NPC start incident rate (0.01–0.02 per lab-year), or raise `RIVAL_SITE.usage` to about 0.5
  to keep today's 0.03–0.08?
- **Q6.** z_lab fixed per lab (recommended), or redrawn at each public model step?
- **Q7.** The theft rule in §6: China's m is the stolen model's while China holds it.
