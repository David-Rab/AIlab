# 13 — AI R&D production function: what produces algorithmic progress and which input binds

Research date: 2026-11-13. Scope: the design for REDESIGN.md §3 (D3), the "bottleneck bar". Nothing under `src/` was edited.

**Method**
- **AIFM code.** I read the AI Futures Model directly from a fresh clone in a temp directory outside the project: `AI-Futures-Project/aifm-public`, commit `1c40ecd` (2026-09-09), the same commit research/11 audited.
- **Davidson FTM code.** I read Davidson's Full Takeoff Model from a fresh clone: `epoch-research/opmodel`, commit `6eec3cd` (2026-10-15).
- **No external code was run.** I used the AIFM's own committed golden trajectory (`tests/golden_data/default_trajectory.json`) as its "run" output. My own arithmetic was done in Node scratch scripts in `/tmp/pf13s`.
- **Web pages** were read through a summarizing fetch tool with verbatim-quote prompts.

**Tags**
- **[C]** code or data read raw.
- **[W]** primary web page or paper, read through the fetch tool.
- **[D]** my own derivation, fit or design choice.
- **[unverified]** secondary or unconfirmed.

---

# PART 1 — Game-ready spec

## 1.1 What changes, in one paragraph

Today `progressBreakdown` computes the progress rate as follows:
- **Before SC:** `rate = share·M(p)·talent + (1−share)·computeFactor`.
- **After SC:** `rate = M(p)·computeFactor`.

In both cases `M(p)` is a lookup on capability. The spec below replaces that lookup with a small structural model taken from the AI Futures Model (AIFM):

```
M = Taste × ExperimentCapacity(experiment compute, serial coding labor) × modifiers
```

Here serial coding labor = CodingCES(humans, AI agents; automation fraction A)^λ.

**Calibrated by construction.** Every player input enters as a ratio to a reference path at the same calendar date: humans h, agent inference k, and experiment compute c. Capability enters through three calibration curves indexed by progress p: the automation fraction A(p), the agent-to-human labor ratio R(p), and the reference taste T_ref(p). These are fitted so that **at reference inputs (h = k = c = 1) M equals today's `multiplierAt(w, p)` exactly**. Every preset therefore keeps the calibration from research/11, while the player gets real levers and an honest bottleneck readout.

## 1.2 Player inputs (per lab, per day)

| Input | Symbol | Unit | Reference path (ai2027 preset) | Player lever |
|---|---|---|---|---|
| Human capabilities researchers | H | headcount | `H_ref(t) = 2050 + 0.82·60·months` (current `refStaff`, sim.ts l.82) | Hire, fire, poach |
| Star or taste hires | τ_h | multiplier on the human taste distribution | 1.0 | Poach top researchers (expensive, rare) |
| Experiment compute | C_exp | H100e | AI 2027 "Research experiments" share × total: 5% (2025), 6% (2026), 14/21/28/35% (Q1–Q4 2027) | Compute allocation slider |
| Internal agent inference | C_inf | H100e | "Research automation" share: 3% (2025), 4% (2026), 6% (2027) | Compute allocation slider |
| Training compute | C_train | H100e | "Training runs" share: 40% (2024–26), 30/27/22/20% (2027) | Compute allocation slider |
| Synthetic data / RL-env generation | C_syn | H100e | "Synthetic data generation": 20% (2024–26), 27/23/22/22% (2027) | Compute allocation slider, plus a data-deal budget |
| Model deployed internally | p_dep | progress | = p (the internal frontier) | Deploy frontier, distilled or older model internally |

The shares come from the AI 2027 compute forecast usage table [W]; the remainder is external deployment and monitoring. Total OpenBrain compute on the reference path is 1M (2025), 4M (2026), and 7/9/12/15M H100e (2027 quarters) [W].

The ratios are `h = H/H_ref(t)`, `k = C_inf/C_inf_ref(t)`, `c = C_exp/C_exp_ref(t)` and `d = C_syn/C_syn_ref(t)`.

## 1.3 Equations (evaluated once per day)

```
f      = p / stage1(w)                          (Stage 1 fraction; Stage 2 uses the milestone-gap fraction)
A      = Aknot(p_dep)                           automation fraction of coding tasks (table 1.5)
R      = Rknot(p_dep) · ηmod                    reference AI-labor / human-labor ratio, in FTE-equivalents (table 1.5)
                                                ηmod = cost/speed modifier of the deployed variant (distilled > 1, older model < 1)
Lrel   = [ (1−A)^(1−ρc) · h^ρc  +  A^(1−ρc) · (R·k)^ρc ]^(1/ρc)        parallel coding labor / H_ref(t)   (if A ≥ 1: Lrel = R·k)
ℓ      = Lrel^λ                                                         serial coding labor multiplier
X      = [ u · c^(ζρ)  +  v · ℓ^ρ ]^(1/ρ)                                experiment capacity (= 1 for a human-only lab on trend)
Tref   = M_ref(p_dep) / X(1, ℓ_ref(p_dep))     ℓ_ref = Lrel(h=1,k=1)^λ    taste (residual; ≈ AIFM taste curve, see 1.5)
τ      = 1 + (τ_h − 1) · (1 − Φ(sd_AI(p_dep)))  human star hires matter only while AI taste is below most humans
M      = Tref · τ · X · mods                   mods = taxes.rdFactor · neuralese · silo · sabotage (as now)
```

**Progress rate.** This keeps the current two-stage structure and the research/11 fixes:

```
Stage 1:  rate = share · laborSlowdown(M, yr) + (1 − share) · trainFactor · Ddata · computePace(yr)
          trainFactor = clamp((C_train / C_train_ref(t))^ε, 0.15, 4)     (replaces computeFactor; ε = w.computeElasticity)
Stage 2:  rate = M · Ddata^0.5
```

In Stage 2, compute now enters through c and k, so the old `computeFactor` is dropped to avoid double counting. The Ddata exponent of 0.5 is a [D] design value.

**Removed.** `talentFactor` (sim.ts l.83) is replaced by h through the coding CES. The post-SC `computeFactor` is replaced by c and k.

## 1.4 Parameters

| Param | Meaning | `ai2027` preset (game default) | `aifm` preset (authors2026) | Primary source / range |
|---|---|---|---|---|
| ρc | Coding-task substitutability (automated vs not) | −2 | −2 | AIFM `rho_coding_labor` choice {−5: 0.25, −2: 0.5, −1: 0.25} [C]. Doc: "the workflow is relatively close to a fixed set of tasks" [W] |
| λ | Parallel penalty: N× more coders = N^λ× faster | 0.5 | 0.5 | AIFM Beta(3,3) on [0,1], 80% CI ≈ [0.32, 0.68] [C][W]. FTM 0.7 (0.2–0.99) [C]. Forethought p = λα 0.3 [0.15, 0.6] [W] |
| L∞ (La) | Speed-up from infinite coding labor, compute fixed | **100** | 15 | AIFM `inf_labor_asymptote` 1 + LN ci80 [1, 200] → median 15.1 [C]. 100 is [D] (see 1.8) |
| C∞ (Ca) | Speed-up from infinite experiment compute, labor fixed | 1000 | 1000 | AIFM `inf_compute_asymptote` 1 + LN ci80 [25, 40000] → median ≈ 1001 [C] |
| slow10 | Slow-down from 10× less experiment compute | **2.5** | 2.8 | AI 2027 takeoff: 10× less → "40% speed" (= 2.5) [W]. AIFM 1 + LN ci80 [0.7, 4.6] → 2.8 [C], from an n = 15 survey [W] |
| → ρ (derived) | CES exponent, solves `La^ρ + Ca^ρ = 1` | −0.1221 (σ = 0.891) | −0.1550 (σ = 0.866) | `ces_functions.py` l.351 [C] |
| → u, v | Normalized weights of compute and labor (u = La^ρ, v = Ca^ρ) | 0.570, 0.430 | 0.657, 0.343 | derived [D] |
| → ζ | Experiment-compute exponent (discount) | 0.671 | 0.655 | `ces_functions.py` l.410 [C]. AIFM default 0.655 ✓ |
| m2b | Taste: top (99.9th pct) ÷ median researcher | 3.25 | 3.7 | AI 2027 survey 3.25 [W]. AIFM 1 + LN ci80 [0.7, 10.4] → 3.7 [C] |
| sd_top | SD of the 99.9th percentile | 3.09 | 3.09 | `config.py` `TOP_RESEARCHER_SD` [C] |

**What the derived elasticities mean** [D]. At the reference point, d ln X/d ln c = ζ·u. That is 0.38 (ai2027) or 0.43 (aifm): +10% experiment compute gives about +4% research speed. d ln X/d ln ℓ = v, i.e. 0.43 / 0.34 per unit of *serial* labor. Multiply by λ for *parallel* labor: +10% humans in a human-only lab gives about +2%.

## 1.5 Calibration knots (ai2027 preset)

All values are [D], produced by `/tmp/pf13s/calib2.mjs` and `calib.mjs` with κ = 3. Interpolate log-linearly in p between knots. Stage 1 knots are by f; Stage 2 knots sit at the milestone thresholds.

| Knot | f / milestone | M_ref | A | R = AI FTE ÷ H_ref | ℓ_ref | X_ref | T_ref | AI taste SD |
|---|---|---|---|---|---|---|---|---|
| Game start (Jul 2025) | f = 0 | 1.25 | 0.538 | 2.58 | 1.69 | 1.25 | 1.00 | −2.0 |
| | f = 0.126 | 1.35 | 0.646 | 4.68 | 2.05 | 1.35 | 1.00 | −1.9 |
| Agent-1 (Jan 2026) | f = 0.25 | 1.50 | 0.744 | 10.0 | 2.63 | 1.50 | 1.00 | −1.7 |
| | f = 0.378 | 1.71 | 0.838 | 20.7 | 3.65 | 1.70 | 1.01 | −1.4 |
| (Jul 2026) | f = 0.5 | 2.00 | 0.904 | 48.4 | 5.37 | 1.98 | 1.01 | −1.2 |
| | f = 0.656 | 2.54 | 0.960 | 136 | 9.71 | 2.46 | 1.03 | −0.7 |
| Agent-2 (Jan 2027) | f = 0.75 | 3.00 | 0.978 | 276 | 14.5 | 2.84 | 1.06 | −0.4 |
| | f = 0.896 | 4.00 | 0.993 | 815 | 27.3 | 3.53 | 1.13 | 0.1 |
| **SC** (Mar 2027) | f = 1 | 5 | 1 | 1,730 | 41.6 | 4.06 | 1.23 | 0.5 |
| 10× (Jun 2027) | — | 10 | 1 | 3,660 | 60.5 | 4.58 | 2.19 | 2.2 |
| **SAR** (Aug 2027) | — | 25 | 1 | 8,410 | 91.7 | 5.20 | 4.80 | 4.3 |
| 50× | — | 50 | 1 | 15,600 | 125 | 5.71 | 8.76 | 5.9 |
| **SIAR** (Nov 2027) | — | 250 | 1 | 56,900 | 238 | 6.87 | 36.4 | 9.6 |
| **ASI** (Dec 2027) | — | 2000 | 1 | 285,000 | 534 | 8.54 | 234 | 14.5 |

**How the table was generated** [D]:
- **Agent efficiency.** η is FTE-equivalents per H100e of agent inference, with η_SC = 11.3:
  - before SC, `η = η_SC·(M_ref/5)^3` (κ = 3);
  - after SC, `η = η_SC·(M_ref/5)^0.75`.
- **R.** R = η·C_inf_ref(t)/H_ref(t) along the AI 2027 reference dates.
- **A.** Before SC, A is solved from the coding CES so that ℓ_ref reproduces M_ref/T. After SC, A = 1.
- **Compact fit for A** (optional): `A(f) ≈ 1 − 0.46·(1 − f)^2.2` for f ≤ 1. It is within 0.005 of the table except near f = 0.9.

**Sanity checks against primary numbers** [D]:
- **SC agent workforce.** R(SC) = 1,730 means 1730 × 3,080 staff = 5.3M human-FTE-equivalents. The scenario has "200,000 Agent-3 copies … equivalent to 50,000 copies of the best human coder sped up by 30x" = 1.5M *best*-coder-FTE [W]. At the 3.25 median-to-top ratio that is about 4.9M median-FTE. ✓
- **Taste at the milestones matches AIFM's definitions** [C, README milestone table]:
  - SAR has T_ref = 4.8 ⇔ AI taste 4.3 SD. AIFM defines SAR at the top-researcher SD, 3.09.
  - SIAR is 9.6 SD. AIFM defines SIAR at 3 × 3.09 = 9.27.
  - ASI is 14.5 SD. AIFM's ASI is about 12–15 SD.
  - These were not targeted, so the fit is a genuine cross-check.
- **Pre-SC automation.** A = 0.54 in mid-2025 is aggressive. AIFM's golden default run (Daniel) has A = 0.10 at 2025.0 and 0.36 at 2026.0 [C]. This is the AI 2027 scenario's optimism, not a fit error (see 2.10).

For the `aifm` preset, rerun `calib2.mjs aifm 3`. With the AIFM CES, SC needs ℓ = 231, R = 53,000, and T_ref(SC) = 1.75. AIFM's own numbers say an AI 2027-style SC gives only ≈ 2.7× from labor (`sc_sw_multiplier` 2.696 in the golden run [C]), so the residual taste carries more.

## 1.6 Bottleneck bar

Show two views. Both are cheap closed forms.

**(a) "Where today's speed comes from"** is a multiplicative decomposition whose factors multiply to M:

```
Humans & base compute   X(c, ℓ_humanOnly) where ℓ_humanOnly = h^λ   (≈ 1 on trend)
AI agents               X(c, ℓ) / X(c, h^λ)
Research taste          Tref · τ
Other                   mods (taxes, siloing, sabotage, neuralese)
```

**(b) "What +10% of each input buys"** uses elasticities ∂ln M/∂ln x:

```
sC   = u·c^(ζρ) / (u·c^(ζρ) + v·ℓ^ρ)           compute's share in the experiment CES (ρ<0 ⇒ the scarcer input has the bigger share)
sL   = 1 − sC
wH   = (1−A)^(1−ρc)·h^ρc / Lrel^ρc             humans' share inside coding labor
e_exp     = ζ · sC
e_humans  = λ · sL · wH
e_agents  = λ · sL · (1 − wH)
e_taste   = (τ_h−1 lever) ≈ 1 − Φ(sd_AI)        only while AI taste < most humans
e_train   = (1−share)·trainFactor·ε / rate     (Stage 1 only)
binding   = argmax_i e_i / cost_i   (show "per $" using H100e-year cost and staff cost)
ceilings  = M(x_i → ∞)/M  for humans, agents, experiment compute
```

Label the bar "labor-bound" when `e_humans + e_agents > e_exp` and "compute-bound" otherwise. When wH > 0.5, add "human-bound (non-automated tasks)" as a sub-label.

**Reference readout (ai2027 preset)** [D, `/tmp/pf13s/sens.mjs`]. Columns show the effect on research speed M of each change, holding the others at reference.

| Point | e_exp | e_humans | e_agents | 2× humans | 2× agents | 0.1× agents | 2× exp. compute | 0.5× exp. compute | ∞ humans | ∞ agents |
|---|---|---|---|---|---|---|---|---|---|---|
| Jul 2025 (f = 0) | 0.39 | 0.17 | 0.04 | ×1.10 | ×1.02 | ×0.73 | ×1.31 | ×0.76 | ×1.18 | ×1.02 |
| Agent-1 | 0.40 | 0.16 | 0.04 | ×1.10 | ×1.02 | ×0.73 | ×1.32 | ×0.75 | ×1.17 | ×1.02 |
| Agent-2 | 0.43 | 0.08 | 0.10 | ×1.04 | ×1.05 | ×0.69 | ×1.35 | ×0.74 | ×1.06 | ×1.07 |
| SC | 0.45 | 0.00 | 0.16 | ×1.00 | ×1.12 | ×0.68 | ×1.37 | ×0.73 | ×1.00 | ×8.7 |
| SAR | 0.47 | 0.00 | 0.15 | ×1.00 | ×1.11 | ×0.69 | ×1.38 | ×0.72 | ×1.00 | ×7.5 |
| SIAR | 0.48 | 0.00 | 0.14 | ×1.00 | ×1.10 | ×0.71 | ×1.39 | ×0.71 | ×1.00 | ×6.2 |

**Gameplay stories that fall out of the model** (they are not scripted):
1. **Early game: humans bind *within* labor.** wH ≈ 0.8, so hiring helps (+10% per doubling) and more agent copies barely help (+2%) because the remaining non-automated coding tasks are done by people.
2. **Around Agent-2 the bottleneck flips to agents.** wH falls 0.46 → 0.18 → 0. Cutting agent inference to 10% costs about 30% of speed at every stage.
3. **After SC, humans are worthless for coding.** Their only remaining value is taste, and only until AI taste passes them (about SAR). This matches the scenario's "humans can't usefully contribute" arc.
4. **Experiment compute is the biggest single lever throughout** (e ≈ 0.4–0.5). This is AI 2027's "compute-for-experiments will be the bottleneck in this regime" [W]. A player who starves experiments to run more agents loses.
5. **Taste is what gets from 25× to 2000×.** The labor side saturates (X: 5.2 → 8.5 from SAR to ASI) while taste goes 4.8 → 234.

## 1.7 Data block [D]

The AIFM deliberately does not model data. Its parameter doc says it "implicitly assumes now that any data progress is proportional to algorithmic progress" and "might not be worth the extra complexity" [W]. AI 2027 handles data through a 20–27% compute allocation to synthetic data generation [W]. For a game lever, use a single factor that equals 1 at the reference path:

```
N_req(t)   = 20 · sqrt(C_run / 120)                          tokens needed for a compute-optimal run of C_run FLOP (Chinchilla 20 tok/param; C = 6ND)
S_human    = 300e12 · epochs(=3) · (1 + licensedDeals)        Epoch: 300T effective tokens (90% CI 100T–1000T); multi-epoch ×2–5; ≤4 epochs ≈ unique (Muennighoff)
S_syn      = yield · ∫ C_syn dt                               yield tuned so the reference C_syn keeps S_eff ≥ N_req through 2029
S_eff      = S_human + q_syn · S_syn                          q_syn = synthetic quality discount, 0.5 [D]
Ddata      = min(1, S_eff / N_req)^0.3 · (d)^0.15            second factor = RL-environment / post-training data share vs reference
```

**Calibration** [D]:
- With C_run = 1e28 FLOP (the scenario's Agent-1-scale run), N_req ≈ 180T. 1e29 gives about 580T, and 5e28 gives about 410T.
- At S_human ≈ 900T, the wall arrives around 1e29–3e29 FLOP, i.e. 2027–2028. That is consistent with Epoch's "around 2028" for compute-optimal training (80% CI 2026–2032) [W].
- On the reference path synthetic data keeps Ddata = 1. If the player cuts C_syn, Ddata falls: halving it gives d^0.15 = 0.90 at once, and later a growing wall penalty.

**Levers:** data deals (licensing, $), synthetic compute, and human-expert data contracts (raise q_syn).

## 1.8 Why La = 100 for the AI 2027 preset (and not the AIFM median of 15)

AI 2027's own takeoff supplement gives three calibration points [W]:
1. 10× less compute leaves researchers at 40% speed.
2. 30× serial speed with fixed calendar compute gives about 7× (Eli: about 10×).
3. 30× parallel labor gives about 3× (90% CI 1.5–6).

Fitting the CES to (1) and (2) gives an essentially Cobb-Douglas function: u = 0.40, ζ = 0.95, ρ = −0.073, La ≈ 3×10⁵, i.e. no labor ceiling [D]. With that fit, however:
- the implied SC workforce is only 125 FTE-equivalents per human (0.38M). The scenario implies about 1,500 per human.
- the Stage 1 automation path becomes infeasible (`calib2.mjs fit 3` puts A at 1 everywhere).

With La = 100 (inside AIFM's 80% CI of [2, 201]):
- the SC workforce matches the scenario;
- the taste-at-milestone cross-check works;
- a visible labor ceiling remains, which is good for gameplay.

The cost is that point (2) is undershot (X(1, 30) = 3.65 instead of 7) and point (3) gives 1.99 instead of 3, both inside or near their CIs. **Recommendation:** ship La = 100 for `ai2027`/`sampled`/`fast`/`slow` and La = 15 for `authors2026`. Optionally sample La per world as 1 + LN[1, 200] in `sampled`.

## 1.9 Pseudo-code (TypeScript, drop-in for `progressBreakdown`)

```ts
interface ProdParams { rc: number; lam: number; u: number; v: number; rho: number; zeta: number; m2b: number;
  knots: { p: number; A: number; R: number; Mref: number }[] }   // table 1.5, p = progress at knot

/** CES params from asymptotes (AIFM ces_functions.py l.351-441, normalized form) */
export function cesFromAsymptotes(La: number, Ca: number, slow10: number) {
  const rho = bisect(r => La ** r + Ca ** r - 1, -50, -1e-9);
  const u = La ** rho, v = Ca ** rho;
  const zeta = Math.log(((1 / slow10) ** rho - v) / u) / (rho * Math.log(0.1));
  return { rho, u, v, zeta };
}

const X = (P: ProdParams, c: number, l: number) => (P.u * c ** (P.zeta * P.rho) + P.v * l ** P.rho) ** (1 / P.rho);
function Lrel(P: ProdParams, A: number, h: number, ai: number) {
  if (A >= 1 - 1e-9) return ai;
  return ((1 - A) ** (1 - P.rc) * h ** P.rc + A ** (1 - P.rc) * ai ** P.rc) ** (1 / P.rc);
}

export function production(s: GameState, lab: LabInputs) {
  const P = s.world.prod, t = s.day / 365;
  const kn = knotAt(P, lab.pDep);                         // log-interp A, R, Mref in p
  const h = (lab.staffCap) / refStaff(t);
  const k = lab.computeInf / refInf(t);
  const c = lab.computeExp / refExp(t);
  const ai = kn.R * lab.etaMod * k;
  const L = Lrel(P, kn.A, h, ai), l = L ** P.lam;
  const lRef = Lrel(P, kn.A, 1, kn.R) ** P.lam;
  const Tref = kn.Mref / X(P, 1, lRef);
  const sdAI = tasteSD(Tref, P.m2b);                      // invert E[max(T,F)], or store sd in the knot table
  const tau = 1 + (lab.tasteHire - 1) * (1 - Phi(sdAI));
  const Xv = X(P, c, l);
  const M = Tref * tau * Xv * lab.mods;
  // bottleneck readout
  const cT = P.u * c ** (P.zeta * P.rho), lT = P.v * l ** P.rho, sC = cT / (cT + lT), sL = 1 - sC;
  const wH = kn.A >= 1 ? 0 : ((1 - kn.A) ** (1 - P.rc) * h ** P.rc) / L ** P.rc;
  const Xh = X(P, c, h ** P.lam);
  return {
    M, parts: { base: Xh, agents: Xv / Xh, taste: Tref * tau, other: lab.mods },
    elast: { exp: P.zeta * sC, humans: P.lam * sL * wH, agents: P.lam * sL * (1 - wH), taste: (lab.tasteHire > 1 ? 1 - Phi(sdAI) : 0) },
    ceilings: { humans: M_at(h = 1e9) / M, agents: M_at(k = 1e9) / M, exp: M_at(c = 1e9) / M },
    labor: { A: kn.A, aiFTE: ai * refStaff(t), copies: lab.computeInf / h100ePerCopy(lab.pDep), speed: speedOf(...), wH },
  };
}
// progressBreakdown: Stage 1 rate = share*laborSlowdown(M,yr) + (1-share)*trainFactor*Ddata*computePace(yr);
//                    Stage 2 rate = M * Ddata**0.5;   then paused / treaty multipliers as now.
// actorRate (rivals, China): call production() with their h, k, c ratios vs OpenBrain's reference path.
```

**Display decomposition of agents** (copies × speed × skill):
- copies = C_inf / H100e-per-copy, with H100e-per-copy ≈ 2.4 at SC (473k H100e / 200k copies) [D from W];
- speed = `speedOf` (research/11 #23: `min(8 + 10.8·log2 M, 50)`);
- skill = aiFTE / (copies × speed), which comes out at ≈ 0.9 at SC.

## 1.10 Calibration notes and tests

1. **Identity test.** For every preset and for p on a grid, `production` with h = k = c = 1, τ_h = 1 and mods = 1 must return `multiplierAt(w, p)` to within 1e-9. This holds by construction of T_ref.
2. **Knots are preset-specific.** The table in 1.5 is for `ai2027`. For other presets, regenerate R and A from that preset's `multiplierAt` with the same procedure:
   - fix η ∝ M_ref^κ (κ = 3) before SC and solve A from the coding CES;
   - fix A = 1 after SC, let R grow as `(M_ref/5)^0.75` × inference growth, and take T_ref as the residual.

   Reject a preset if T_ref < 1 anywhere or is non-monotone.
3. **Off-path behaviour.** Because inputs enter as ratios to the *calendar-date* reference, a lab that is ahead in p with reference inputs still gets exactly M_ref(p). The structure only changes M when inputs deviate. This is the "faithful to AI 2027 code" choice: AI 2027 indexes M by capability alone.
4. **Rivals and China** now pay for low compute through c and k rather than `computeFactor`:
   - China at about 1/3 of OpenBrain's compute gets c = k ≈ 0.33, so M falls to about 0.6× the reference after SC.
   - Re-tune research/11 #16 (China pace) after the switch.
5. **2029 slowdowns** (research/11 #4) stay where they are, inside `laborSlowdown`/`computePace` in Stage 1.
6. **Tie to the race bot.** Check that default play gives h, k, c ≈ 1 ± 10%; research/11 #11 is the same requirement for compute. Otherwise default play silently runs slow or fast.
7. **Present-day reality check** (optional `reality` baseline). AIFM's Q2-2026 elicitation has serial coding uplift 1.7× at 2026.58 (Eli; 80% CI 1.1–5.9) and 2.0× (Daniel) [C, `sampling_config.yaml`]. The `ai2027` knot at f = 0.5 (Jul 2026) implies a serial ℓ of 5.4, about 3× more aggressive. A `reality` knot set would scale R so that ℓ(2026.58) ≈ 1.7–2.0.

---

# PART 2 — Detailed notes

## 2.1 The AIFM production function, exactly [C]

Source: `progress_model/` at `aifm-public@1c40ecd`. State variables are `logE` (log10 cumulative effective compute, called "progress") and `RS` (research stock):

```
SE = r_software · log10(RS / RS_0)                        README l.49; metrics l.~397
EC = TC(t) + SE                                           TC = log10(training_H100e · 1.262e22 FLOP/yr)
d(logE)/dt = 10^(EC − logE) / ln 10                        progress_rate.py l.448
d(RS)/dt   = RE                                           research effort
software rate (OOM/yr) = r_software · RE / RS / ln 10      progress_rate.py l.133–186
RS_0 = RE_0² / (dRE/dt)_0                                  README l.454
```

Research effort is built up in four layers:
1. **Automation fraction.** `A(logE)` is logistic: `A = L/(1+exp(−k(x−x0)))`, clipped to [0, 1]. The asymptote L is sampled as 1 + LN ci80 [0.005, 2] (`automation_model.py` l.143–151). In the Q2 default mode `uplift-solved`, k and x0 are solved so that the model's own serial uplift equals the elicited value at 2026.578 and its excess doubles every D months.
2. **Coding labor.** In "optimal_ces" mode there is a continuum of tasks i ∈ [0, 1]:
   - Task i becomes automatable when progress reaches its threshold `E_aut(i)`.
   - AI productivity on task i is `η·(E/E_aut(i))^θ` FTE per H100e, with η_init = 0.05 and θ = `coding_automation_efficiency_slope`, 3 [1, 9] OOMs per progress-year.
   - Inference compute is allocated optimally across tasks; humans do the rest.
   - Closed form (`automation_model.py` l.503–580): `L = H·[(1−i_c)^(1−ρc) + (C·η·E^θ/H)^ρc · B(i_c)^(1−ρc)]^(1/ρc)`, where `B(i) = ∫₀ⁱ E_aut(j)^(−θρc/(1−ρc)) dj`.
   - "Interior" case: compute is scarce and some automatable tasks stay with humans. "Boundary" case: AI does every automatable task.
   - With all automated tasks equally hard, this reduces exactly to the simple CES used in 1.3: `[(1−A)^(1−ρ)·H^ρ + A^(1−ρ)·AI^ρ]^(1/ρ)` (`ces_functions.py` l.300).
3. **Serial labor.** `L_serial = L^λ` (`ces_functions.py` l.336). In the UI's words: "Multiplying the size of your coding labor force by N× is equivalent to speeding up coding labor by (N^λ)×" [C, `AdvancedSections.tsx`].
4. **Experiment capacity and research effort.** `RE = Taste_agg · CES(C_exp^ζ, L_serial; α, ρ)` with `CES = (α·x1^ρ + (1−α)·x2^ρ)^(1/ρ)` (`progress_rate.py` l.27–122).

The experiment CES is **parameterized by asymptotes** (`_impl.py` l.1170–1190; `ces_functions.py` l.351–469):
- `inf_labor_asymptote` = La: "By what factor faster AI software progress would go in present day if you immediately got unlimited coding labor".
- `inf_compute_asymptote` = Ca: the same, for unlimited experiment compute.
- `inv_compute_anchor_exp_cap` = slow10: "By what factor slower … if you immediately had 10× less experiment compute".

These are evaluated at present-day experiment compute and *human-only* serial labor. They give `La^ρ + Ca^ρ = 1`, the compute anchor fixing ζ, and α from the present-day point. At the medians (15, 1000, 2.8): ρ = −0.155, α = 0.809, ζ = 0.655. These are exactly `DEFAULT_PARAMETERS` and my solver reproduces them [C][D].

**Taste** (`taste_distribution.py`):
- Human taste is lognormal with mean 1 and a 99.9th percentile that is m2b × the median, smoothly bounded above by `m2b^(1+taste_limit)`.
- AI taste in SD units is linear in progress: `sd = slope·logE + offset`, passing through `(progress_at_AC, sd_at_AC)` (l.655–700).
- Aggregate taste is `E[max(T, F_AI)]`: the weakest researchers are lifted to the AI's level.

**The AI R&D multiplier** (AIR-5x … AIR-2000x milestones) is defined in `metrics_computation.py` l.519–530:

```
ai_sw_progress_mult_ref_present_day = RE(AI at time t, present-day resources) / RE(human-only, present day)
```

The code comment reads: "A ratio of research efforts, not of software progress rates: with the research stock held at its present-day value on both sides the two are identical".

## 2.2 Parameter values and ranges (all sources)

| Quantity | AIFM (Eli Q2 2026 median, 80% CI) | AI 2027 (Apr 2025) | Davidson FTM best guess (cons./aggr.) | Other |
|---|---|---|---|---|
| Labor ↔ experiment compute substitution | ρ = −0.155 derived (σ 0.87); depends on La and Ca | Implicit; ≈ Cobb-Douglas from its stated points (σ ≈ 0.93) [D] | `research_experiments_substitution_software` −0.01 (all presets) [C] | Whitfill & Wu 2025: σ = 2.58 (SE 0.34) baseline vs **σ = −0.10 (SE 0.18)** "frontier experiments" spec; n = 27 firm-years, 4 labs [W] |
| Slow-down at 10× less experiment compute | 2.8 [1.7, 5.6] | 2.5 ("40% speed") | — | AIFM survey n = 15 median 2.8; an informal lab poll gave about 4 [W] |
| Infinite-labor ceiling | 15 [2, 201] | none stated | — | AIFM: from SC ≈ 5× ×≈3 [W] |
| Infinite-experiment-compute ceiling | 1000 [26, 40001] | — | — | Originally 5000, cut to 1000 [W] |
| Experiment-compute exponent ζ | 0.655 derived | — | experiments = hardware^0.4 (`compute_software_rnd_experiments_efficiency`) [C] | — |
| Coding-task substitution ρc | −2 (−1/−2/−5 at 25/50/25%) | — | `labour_substitution_rnd` −0.5 (−2 / −0.2) [C] | — |
| Parallel penalty λ | 0.5 [0.32, 0.68] | "nine women can't make a baby in a month"; 30× parallel → 3× | `rnd_parallelization_penalty` 0.7 (0.2 / 0.99) [C] | Forethought p = λα: 0.3 [0.15, 0.6] (λ 0.6, α 0.5) [W] |
| Software efficiency growth (2024) | 1.0 OOM/yr [0.4, 2.5] | software = 50% of progress | — | Epoch (Ho et al. 2024): pretraining compute halves every 8 mo (95% CI 5–14) ≈ 0.45 OOM/yr. AIFM's higher figure uses ECI: "20x per year with a 95% CI of [7, 40]" for the regression method [W] |
| Returns to software R&D | β = 1/r ≈ 0.315 (r ≈ 3.2) at median parameters (calibrated, not elicited) [W][C: golden r = 3.186] | takeoff: "for each doubling of cumulative labor, there are r doublings"; r median ≈ 4 (SAR→SIAR) [W]. AIFM blog: AI 2027 effectively used m/β = 2.77 then 1.56 [W] | `software_returns` 1.25 (0.8 / 5); FTM divides by λ [C] | Forethought r_cog = λα/β: 1.2 [0.4, 3.6], at λ 0.6, α 0.5 "β=0.25", i.e. 1/β = 4.0 in the game's r units (CAL-W, research/CAL-world-sources.md §2) [W]. Epoch: chess r = 0.83 (SE 0.15); CV/SAT/LP/RL medians > 1, not significant [W] |
| Taste: top ÷ median | 3.7 (Eli 1 + 3 [0.8, 11.2]) | 3.25 (n = 8 survey); all-median → all-top ≈ 6.5× total | — | Late-2025 survey n = 20: median 3.6, geomean 4.7 [W] |
| AI taste at AC | 0.5 SD [−2.5, 3.5] (Daniel 0) | — | — | n = 12 surveys [W] |
| AI taste slope | 2.3 SD per progress-year [0.8, 6.6] (Eli); 2.1 in sampling config | — | — | — |
| Software share of progress | 63% (Dec 2025 model) | 50% | — | AIFM doc [W] |
| Distance to limits | `taste_limit` 16 m2b (2–32) | — | `software_ceiling` 1e12 | Forethought: 11 [6, 16] years of progress [W] |

## 2.3 Serial vs parallel labor

- **AIFM.** λ (`parallel_penalty`) converts parallel coding labor to serial: N copies equal one coder N^λ times faster. λ ~ Beta(3,3), median 0.5. Justification: "Both our own intuitions and our interviews/surveys of others led us to estimates of roughly 0.5" [W]. Blog footnote: "Serial coding labor multiplier is basically the square root of parallel coding labor multiplier" [W].
- **AI 2027 takeoff** [W]: "this 30x parallel labor factor would speed things up by 3 (90% CI: 1.5 to 6)". This includes the compute bottleneck, not λ alone. Giving 100% of compute to one team "would not make it go 5x faster … maybe ~1.5x".
- **FTM** applies `research_input^0.7` before accumulation (`model.py` l.1205) and divides returns by λ (l.236–238) [C].
- **Speed vs copies in the game.** Serial speed enters *before* λ in AI 2027's own decomposition (30× faster thinking counted as serial). The AIFM folds speed into FTE per H100e, so speed is also penalized by λ. For the game, aiFTE = copies × speed × skill feeds the parallel CES (AIFM convention). The 30×-speed case is therefore treated as 30× parallel labor, which is conservative relative to AI 2027.

## 2.4 Research taste

AIFM mechanics are in 2.1. Its milestones in taste-SD units are: SAR at the top-researcher SD (3.09); SIAR at 3× that; TED-AI and ASI at TED-AI + 2 m2b (`README` milestone table) [C].

AI 2027 derived its multipliers from taste [W]:
- SAR = 25×.
- SIAR = 250×, because "3.25^2 ≈ 10" on top of SAR (two median-to-top gaps).
- ASI ≈ 2000× ("8x on top of SIAR").

The game's T_ref reproduces this structure (1.5). In the AIFM's median case "each doubling would take 20% longer than the previous if taste were the only factor", i.e. m/β = 0.25/0.315 = 0.79 < 1, so there is no taste-only singularity. The defaults in the golden run give m/β ≈ 1.14 [W][C][D].

## 2.5 Software efficiency growth and returns to R&D

**AIFM** [C][W]:
- Equations: `10^SE = (RS/RS_0)^r` and `dRS/dt = RE`. The doubling ratio is `2^(β/m − 1)` (`_impl.py` l.1795–1804).
- r is calibrated so that the 2024 software rate equals 1.0 OOM/yr (`SOFTWARE_PROGRESS_SCALE_REFERENCE_YEAR` 2024.0).
- In the golden run: RE/RS ≈ 0.72/yr in 2024–26, so r = 1.0·ln10/0.72 = 3.19. Software rate is 1.00 (2024), 1.02 (2025), 0.98 (2026), 1.19 (2027), 2.44 (2028), and 15.5 OOM/yr at the 2029 peak.

**Epoch** [W] uses the Jones law of motion `(1/A)dA/dt = θ·A^(−β)·E^λ` with `r = λ/β`. "Hyperbolic growth … if and only if r > 1" when E ∝ A at fixed compute. The authors flag that compute-intensive experiments make the model "overstate the case for a singularity".

**Forethought** (Davidson & Houlden, 2025) [W]:
- Model: `Ṡ = a·R^λ·S^(1−β)`, `R = (bL)^α (cC)^(1−α)`, `L = dS`.
- Doubling time multiplies by `2^(p(1/r_cog − 1))` per doubling.
- r_cog declines linearly to 0 at the ceiling.
- Results: an initial speed-up of 8× [2, 32]; P(≥3 years of progress in ≤1 year) ≈ 60%.

**Game.** The engine has no research stock. AI 2027's human-years milestone gaps (G) already encode "ideas get harder", so M stays a multiplier on 2024-pace software progress. Do not add an RS state unless the Stage 2 gaps are replaced; adding it would double-count diminishing returns.

## 2.6 Data constraints

- **AIFM:** not modelled (quotes in 1.7). Its doc says modelling data "would lengthen [timelines] in cases where synthetic data is tough to fully rely upon" [W].
- **Epoch (Villalobos et al., v2 Jun 2024)** [W]:
  - stock ≈ 300T tokens (90% CI 100T–1000T);
  - exhausted between 2026 and 2032; about 2028 for compute-optimal training at about 5e28 FLOP; 2027 with 5× overtraining;
  - multi-epoch training raises the stock 2–5×;
  - synthetic data "only reliably improved capabilities in narrow areas like math and coding".
- **Muennighoff et al. 2023** [W]: "4 epochs of repeated data yields negligible changes to loss"; beyond that, "the value of adding compute eventually decays to zero".
- **AI 2027 compute forecast** [W]:
  - synthetic data generation takes 20% of compute (2024–26) and 22–27% in 2027;
  - post-training rises from 40% of training compute (2024) to 95% (Q4 2027).
  - Data is therefore effectively bought with compute in the scenario. That is the basis for the `d` lever in 1.7.

## 2.7 How AI automation substitutes for human labor over time

The coding CES with ρc = −2 makes non-automated tasks a hard bottleneck. With automation fraction A, coding labor can never exceed `H·(1−A)^((1−ρc)/ρc) = H·(1−A)^(−1.5)`, however many agents run.

On the `ai2027` path [D, table 1.5], humans' share of the labor margin (wH) is:
- 0.81 in mid-2025;
- 0.74 in mid-2026;
- 0.46 at Agent-2;
- 0.18 at 4×;
- 0 at SC.

Humans remain relevant only through taste until AI taste exceeds most humans, at about 1–2 SD (soon after SC); after SAR they add nothing.

The AIFM's own default trajectory is slower. In the golden run (Daniel defaults) A is 0.10 (2025.0), 0.36 (2026.0), 0.57 (2026.5), 0.78 (2027.0), 0.94 (2027.5), and 1 at AC (2027.79). The parallel coding-labor multiplier is 1.18, 1.96, 3.54, 9.78, 64.6, then 4,810 by 2028.0 [C].

The compute bottleneck shows up directly in that run. At 2027.5 the parallel coding multiplier is 64.6 but the AI R&D multiplier is only 1.92 [C].

## 2.8 Relation to the 5× / 25× / 250× / 2000× framing

**AI 2027's definition** [W]: "how much faster AI software improvements are advancing with AI usage than without it". It holds compute fixed ("not allowed to do significant compute scaling") and measures against a human-labor supply "as if current growth trends continued".

**AIFM's definition** is RE(AI, present resources) / RE(human-only, present). In the production function this is `M = Taste × X(1, ℓ)`; experiment compute c is fixed at 1.

**Decomposition of the AI 2027 milestones** (`ai2027` preset) [D]:
- SC 5 = 1.23 (taste) × 4.06 (labor via the experiment CES);
- SAR 25 = 4.8 × 5.2;
- SIAR 250 = 36 × 6.9;
- ASI 2000 = 234 × 8.5.

**AIFM at an AI 2027-style SC:** only ≈ 2.7× (`sc_sw_multiplier` 2.696 in the golden run). Its AIR-5x arrives about 0.1 y after AC in Eli's runs, with AIR-25x at AC + 1.24 y (research/11 §5.3).

**AI 2027's own pre-SC multipliers** (1.5× early 2026, 3× Jan 2027) are well above AIFM's golden run, which has AIR 1.12 (2026.0), 1.23 (2026.5), 1.45 (2027.0) and 1.92 (2027.5) [C].

## 2.9 Compute-bottleneck asymptotes

In the experiment CES with ρ < 0:
- `X(c, ℓ→∞) = c^ζ · La` (normalized); this is the labor ceiling;
- `X(c→∞, ℓ) = ℓ · Ca`; this is the compute ceiling.

So with a fixed compute budget, unlimited AI researchers give at most La× (AIFM median 15×) from the labor side. Further speed-up must come from taste (better experiment *selection*) or from more or cheaper experiments. AI 2027 [W] says the same thing: without better experiment selection "we'd hit sharply diminishing returns due to hardware and latency bottlenecks".

Whitfill & Wu's "frontier experiments" estimate (σ ≈ −0.10, statistically indistinguishable from 0) would mean near-Leontief, a much harder ceiling. Their baseline estimate (σ = 2.6, substitutes) would mean no ceiling. The authors call the data thin (4 firms) [W]. These span the AIFM's La range of 2–201.

## 2.10 Empirical uplift evidence (present-day anchors)

- **METR RCT, early 2025** (arXiv 2507.09089) [W]: 16 experienced OSS developers, 246 tasks, Cursor + Claude 3.5/3.7 Sonnet. Allowing AI *increased* completion time by 19% (CI +2% to +39%, per METR's 2026 post). Developers forecast −24% and believed −20% afterwards.
- **METR late-2025 follow-up** (blog, 2026-02-24) [W]:
  - returning developers −18% (CI −38% to +9%); new developers −4% (CI −15% to +9%), where negative = speed-up;
  - METR calls this "only very weak evidence" because of selection: 30–50% of developers withheld tasks they would not do without AI.
- **Anthropic internal study** (Dec 2025; survey of Aug 2025) [W]:
  - 132 engineers and researchers; Claude used in 59% of work (28% a year earlier); self-reported productivity +50% (+20% a year earlier);
  - most can "fully delegate" only 0–20% of work; 27% of Claude-assisted work "wouldn't otherwise be done";
  - merged PRs per engineer per day +67%;
  - self-reported and non-anonymous, so read it as an upper-bound flavour.
- **AIFM Q2-2026 elicitation** [C]: serial coding uplift 1.7× (80% CI 1.1–5.9) at 2026.578 (Eli); excess doubling time 6.5 months (2–21). Daniel's is 2.0× with a 5-month doubling time.
- **OpenAI:** I found no official primary report quantifying internal AI R&D uplift. Not used.

**Mapping to the game.** A serial uplift of 1.7 is parallel 2.9 (λ = 0.5); in the human-only experiment CES that is X ≈ 1.2–1.3. This is consistent with the AIFM golden AIR of 1.23 at 2026.5. It is well below the `ai2027` path's M = 2 at Jul 2026, which is why a `reality` knot set is suggested in 1.10 #7.

## 2.11 Conflicts and how the spec resolves them

| Conflict | Sources | Resolution |
|---|---|---|
| SC multiplier: 5× vs ≈ 2.7× | AI 2027 takeoff vs AIFM golden | Per-preset CES. T_ref residual absorbs the rest. |
| Pre-SC multipliers 1.5–3× vs 1.1–1.5× | AI 2027 scenario vs AIFM | Keep AI 2027 in `ai2027`; offer a `reality` knot set. |
| Experiment-compute share: AI 2027 4–6% (2025–26) vs AIFM about 50–63% of company compute | Compute forecast table vs AIFM `input_data.csv` / doc ("experiment compute is 50% of the project's supply") | Definitions differ. AI 2027 counts training and synthetic data separately, while AIFM's experiment pool is broad. The spec uses ratios to a reference, so only *relative* changes matter. |
| Labor ↔ compute: complements vs substitutes | Whitfill & Wu baseline σ 2.6 vs frontier σ −0.1; AIFM σ 0.87; FTM ≈ 1 | AIFM structure with La as the uncertainty knob (15 or 100). |
| Returns r: 0.8–1.25 vs about 3 | Epoch chess, FTM vs AIFM-calibrated r | These are not comparable. AIFM's r maps research *stock* to an efficiency that includes post-training; FTM divides by λ; Forethought adjusts Epoch's 1.4 to 1.2. The game does not use r directly; diminishing returns live in G. |

---

# PART 3 — Sources

**Primary: code and data, read raw [C]**
- AI Futures Model: https://github.com/AI-Futures-Project/aifm-public, commit `1c40ecd` (2026-09-09).
  - Model: `progress_model/README.md`, `ces_functions.py`, `progress_rate.py`, `automation_model.py`, `taste_distribution.py`, `metrics_computation.py`, `_impl.py`, `config.py`.
  - Config, inputs and docs: `config/sampling_config.yaml`, `config/parameter_display_names.json`, `inputs/input_data.csv`, `docs/input-series-provenance.md`.
  - Frontend and tests: `constants/keyParameterConfigs.ts`, `components/AdvancedSections.tsx`, `tests/golden_data/default_trajectory.json`, `default_milestones.json`.
- Davidson Full Takeoff Model: https://github.com/epoch-research/opmodel (alias `epoch-research/ftm`), commit `6eec3cd`. Files: `ftm/core/model.py` (l.236–242, 1060–1210), `website/src/js/presets.js` (conservative / best guess / aggressive parameter sets).

**Primary: papers and official pages [W]**
- AIFM parameter justification doc (Google Doc linked from the AIFM UI): https://docs.google.com/document/d/1ru6Okbxb6XuH18Cz8439sdQJazMV39hNxsWDokh97r0
- AIFM Dec-2025 model update: https://blog.aifutures.org/p/ai-futures-model-dec-2025-update
- AI 2027 takeoff forecast: https://ai-2027.com/research/takeoff-forecast
- AI 2027 compute forecast: https://ai-2027.com/research/compute-forecast
- Whitfill & Wu, "Will Compute Bottlenecks Prevent an Intelligence Explosion?", arXiv 2507.23181 (v2, Aug 2025): https://arxiv.org/abs/2507.23181 and https://arxiv.org/html/2507.23181
- Davidson & Houlden, "How quick and big would a software intelligence explosion be?", Forethought (2025): https://www.forethought.org/research/how-quick-and-big-would-a-software-intelligence-explosion-be
- Erdil, Besiroglu, Ho, "Do the returns to software R&D point towards a singularity?", Epoch AI (May 2024): https://epoch.ai/blog/do-the-returns-to-software-rnd-point-towards-a-singularity
- Ho et al., "Algorithmic progress in language models", arXiv 2403.05812: https://arxiv.org/abs/2403.05812
- Villalobos et al., "Will we run out of data?", arXiv 2211.04325 v2: https://arxiv.org/abs/2211.04325 ; Epoch summary: https://epoch.ai/blog/will-we-run-out-of-data-limits-of-llm-scaling-based-on-human-generated-data
- Muennighoff et al., "Scaling Data-Constrained Language Models", arXiv 2305.16264: https://arxiv.org/abs/2305.16264
- METR, "Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity", arXiv 2507.09089: https://arxiv.org/abs/2507.09089
- METR, uplift update (2026-02-24): https://metr.org/blog/2026-02-24-uplift-update/
- Anthropic, "How AI is transforming work at Anthropic" (Dec 2025): https://www.anthropic.com/research/how-ai-is-transforming-work-at-anthropic
- Davidson, "What a compute-centric framework says about AI takeoff" (summary post with the 20% → 1.3× and 40% → 1.8× AI R&D speed-up figures): https://www.alignmentforum.org/posts/Gc9FGtdXhK9sCSEYu/what-a-compute-centric-framework-says-about-ai-takeoff
- Erdil et al., "GATE: An Integrated Assessment Model for AI Automation", arXiv 2503.04941: https://arxiv.org/abs/2503.04941. Checked; its abstract gives no software-R&D parameters, so it is not used.

**Secondary / unverified (not relied on)**
- Third-party write-ups of the METR 2026 update (e.g. blog.robbowley.net) and press coverage of the Anthropic study. [unverified]

**Not reached**
- aifuturesmodel.com renders client-side; the fetch tool got no content. I used the repo and the Google Doc instead.
- The FTM parameter workbook (Google Sheet in `config.yml`). I used the preset values in `website/src/js/presets.js` instead.

**Scratch scripts [D]** (outside the project, in `/tmp/pf13s`):
- `ces.mjs`: CES-from-asymptotes solver and the AI 2027 fit;
- `calib.mjs` and `calib2.mjs`: knot tables;
- `sens.mjs`: elasticities, what-ifs and ceilings;
- `traj.mjs` and `rs.mjs`: AIFM golden-trajectory readout and r back-out;
- `chk.mjs`: La sensitivity.
