# 03 — Timelines & Takeoff Models (AI 2027 + AI Futures Model + critiques + METR)

Research date: 2026-11-11. Purpose: ground the game's daily-tick progress engine in the AI Futures Project's (AIFP) quantitative models.

**Provenance tags used throughout**
- **[S]** stated in a source's prose (page, blog, supplement)
- **[C]** read from the source's code or config files (GitHub)
- **[D]** derived by me (arithmetic, calibration, or a design choice). Not endorsed by the source.
- **[?]** uncertain: extraction was lossy (pages were read through a summarizing fetch tool, not verbatim) or the item is ambiguous

> Caveat on method: every page and file was read through a summarizing web-fetch tool, so I could not copy code verbatim. The formulas below come from several consistent descriptions of the same code. I checked the key results by reimplementing them (JS, Section 1.7) and reproduced the sources' headline numbers: AI 2027 superexponential median about Jan 2027, takeoff phase medians about 0.3, 0.3 and 0.15 years. Before shipping, have someone diff the formulas against the raw files.

---

# 1. GAME-READY MODEL

## 1.1 Design summary

The game uses a two-stage, reduced-form engine taken directly from the AI 2027 code (`uvafan/timelines-takeoff-ai-2027`). It has optional "AIFM-lite" knobs that approximate the newer AI Futures Model (aifuturesmodel.com, `AI-Futures-Project/aifm-public`).

- **Stage 1 (now → Superhuman Coder / Automated Coder).** A latent "progress" counter, in months of baseline-rate (2024/25) progress, must reach a target. The target is the time-horizon-doubling work (exponential, superexponential or subexponential) plus a cost/speed gap. Each tick, progress advances at a rate that blends an AI R&D software multiplier M (which rises as progress accumulates) with a compute-growth factor C(t). The displayed METR-style 80% time horizon is computed from progress. [C]
- **Stage 2 (SC → SAR → SIAR → ASI).** Each milestone gap is a quantity of human-only research-years. Calendar time is spent at the current AI R&D progress multiplier. Within a phase, the multiplier interpolates geometrically between fixed milestone values (5×, 25×, 250×, 2000×). [C]
- **The hidden world** is one draw of all parameters (Section 1.4) from a chosen preset's distributions (Section 1.5). Correlations use a Gaussian copula. [C]
- **Tick** = 1 day. The source code also uses dt = 1 day. [C]

## 1.2 State variables

| Var | Meaning | Units | Source |
|---|---|---|---|
| `t` | calendar date | decimal year | [C] |
| `phase` | 0 = pre-SC, 1 = SC→SAR, 2 = SAR→SIAR, 3 = SIAR→ASI, 4 = post-ASI | enum | [C] |
| `prog` | Stage-1 progress | baseline-progress-months | [C] |
| `base0` | Stage-1 target = horizon growth time `g0` + cost/speed gap `cs` | months | [C] |
| `H` | Stage-2 human-only progress within the current phase | human-only days | [C] |
| `G[k]` | size of gap k | human-only days | [C] |
| `M` | AI R&D progress multiplier (software/algorithmic) | × vs. no-AI counterfactual | [S]/[C] |
| `h80_internal` | 80%-reliability METR horizon of the best internal model | minutes (1 work-month = 167 h) | [C] |
| `h80_public` | public-model horizon (internal lagged by `delay`) | minutes | [D] (the code models the lag as a shift in start time) |
| `C(t)` | compute-growth rate factor (1 = 2024 pace) | × | [C] |
| `L(t)` | optional human labor pool (May-2025 variant) | arbitrary | [C] |
| `RS` | optional research stock (May-2025 variant) | arbitrary | [C] |

## 1.3 Equations (pseudo-code)

### 1.3.1 Lognormal from an 80% CI [C]
```
# All "[L, U]" ranges in the sources are 10th/90th percentiles.
mu    = (ln L + ln U)/2            # median = sqrt(L*U)
sigma = (ln U - ln L)/(2*1.2816)
x     = exp(mu + sigma*z)          # z ~ N(0,1), drawn from a Gaussian copula
```
Correlations: rho = 0.7 among (doubling time T, cost/speed cs, growth-type uniform), and a separate rho = 0.7 copula between (present multiplier, SC multiplier). `h_SC` and `delay` are independent. [C]

### 1.3.2 Stage 1 setup: horizon growth time [C]
```
h0_months = h0_minutes / (60*167)               # 167 work-hours per month
n = log2(h_SC_months / h0_months)               # doublings needed
# growth type: u ~ U(0,1) from the copula
#   Apr-2025: super if u < p_super; sub if u < p_super + p_sub; else exponential
switch type:
  exponential:      g0 = n*T
  superexponential: g0 = T*(1 - r^n)/(1 - r),  r = 1 - decay     # each doubling takes 10% less time
  subexponential:   g0 = T*(r^n - 1)/(r - 1),  r = 1 + growth    # each doubling takes 10% more time
# May-2025 variant: superexponential starts only after the horizon passes a threshold H_k,
# drawn from a schedule (Section 1.4). Doublings before H_k are exponential:
#   n_b = min(log2(H_k/h0), n);  g0 = n_b*T + T*(1 - r^(n-n_b))/(1 - r)
base0 = g0 + cs                                  # cost/speed gap is a flat add-on, in months
```
Note [S, titotal]: the superexponential series converges, with total time at most T/(1-r) = 10·T for r = 0.9. It therefore reaches any horizon, even an infinite one, within about 10·T × (1/multiplier) months. This is the property behind the "finite-time singularity" critique.

### 1.3.3 Stage 1 daily tick [C, with the patched interpolation recommended]
```
t_start = 2025.25 - delay/12          # code: internal frontier is 'delay' months ahead of public
each day:
  f = prog / base0
  # AI R&D software multiplier (p = present excess, s = SC excess)
  M = 1 + p*(s/p)^f                   # 'patched' = intended formula (Dec 2025 bug note)
  # M = (1+p)*((1+s)/(1+p))^f         # 'original' buggy formula that shipped in Apr 2025 (~9 months earlier SC)
  if t >= 2029.0: M = sqrt(0.5*M * (M - 0.5))    # human-labor growth slowdown (Apr-2025 code)
  C = (t >= 2029.0) ? 0.5 : 1.0                    # compute-growth slowdown (Apr-2025 code)
  rate = share*M + (1-share)*C        # Apr-2025: share = 0.5 ("algorithmic = 50% of progress")
  prog += rate * (1/30.5)             # dt = 1 day, in months
  t    += 1/365
  if prog >= base0: SC reached internally at t
```
**May-2025 variant (diminishing returns via labor)** [C]. Replace `share*M` with `share*G`, where:
```
L  *= (1+gL(t))^(1/250)                        # labor growth schedule, 250 workdays/yr
dR  = ((L+1)^0.3 - 1) * M * (1/250)            # labor_power = 0.3, R0 = 50, L0 = 1000
G   = ln(R_new/R) / ln(R_1/R_0)                # research-stock growth relative to the first step
rate = share*G + (1-share)*C(t)                # C(t) from compute schedule; share ~ N(0.525, 0.254) clipped [0.1, 0.9]
```

### 1.3.4 Displayed horizon (inverse of 1.3.2, while prog <= g0) [C]
```
exponential:      n_t = prog/T
superexponential: n_t = ln(1 - prog*decay/T) / ln(1 - decay)
subexponential:   n_t = ln(1 + prog*growth/T) / ln(1 + growth)
h80_internal = h0 * 2^n_t        # after prog > g0 the horizon sits at h_SC while the cost/speed gap closes
h80_public(t) = h80_internal(t - delay)                 # [D] display choice
h50 ≈ k * h80, with k ~ 5-10 (METR TH1.1 data: GPT-5 5.3x, Opus 4.6 10.3x, Mythos 5.6x)   [D from METR data]
```

### 1.3.5 Stage 2 takeoff tick [C]
```
milestones   = [SC, SAR, SIAR, ASI];  speed = [5, 25, 250, 2000]      # 'WS' = 10000 defined but unused
# gap sampling (human-only YEARS; x365 to days)
(zA, zS) ~ bivariate normal, rho = 0.8
G1 = (U < 0.15) ? 0 : LN[1.5, 10](zS)                         # SC→SAR
A  = LN[1, 25](zA)                                            # automated-median-researcher → SAR, human-only years
x  = 10 + A
G2 = x^3/100 - x                                              # SAR→SIAR, = x*2^(2*log2(x/10)) - x
E  = LN[0.3, 7.5] (independent)                               # 'SAR-to-SIAR-equivalent jumps'
x2 = x + G2
G3 = x2*(x2/x)^E - x2                                         # SIAR→ASI
each day in phase k (from milestone k to k+1):
  f = H / G[k]
  M = speed[k] * (speed[k+1]/speed[k])^f      # geometric interpolation
  H += M * 1                                   # human-only days of progress per calendar day
  if H >= G[k]: advance phase
# closed form [D]: calendar = G*(s1 - s0)/(s0*s1*ln(s1/s0))
```
The source assumes no training-compute growth after SC and experiment compute held roughly fixed [S]. If the game lets compute keep growing, multiply the daily `H` increment by a compute factor. That is an AIFM-style extension. [D]

### 1.3.6 Optional AIFM-style takeoff: doubling-chain form [D, built on S]
The AIFM expresses takeoff speed as **b**: "each successive doubling of AI R&D uplift takes b times as long as the previous one", with b = 2^(1/r − 1) [S].
```
after SAR: M doubles; doubling j takes tau1 * b^j calendar years
b ~ LN(median 1.21, sigma 0.57), floor 0.5   # [D] fit to the AIFM's stated P(b<1) = 38%, P(b<0.7) = 17%, median 1.21
tau1 ≈ 0.13 yr                               # [D] so that b = 0.7 reproduces AI 2027's median SAR→SIAR of ~0.3 yr
cap M at M_max (taste limit / compute bottleneck)  # [D]; AIFM 'infinite coding labor asymptote' = 1+14 [1, 200] on experiment throughput
```

### 1.3.7 Player hooks (design suggestions) [D]
- Lab compute share and chip supply scale `C(t)`. In Stage 2 they also scale the `H` increment by `(compute_ratio)^α`, with α ≈ 0.5 [D].
- Talent and security events multiply `M` (for example, a stolen-weights event jumps the rival's `prog`. AIFM code has `R' ← b·R' + g·RS` "S-theft augmentation" [C]).
- A safety pause freezes `prog` or `H`, or switches the takeoff to "SOS mode": the AIFM freezes labor and compute at a milestone [C].
- Public announcement lag: show the world `h80_public` and keep `h80_internal` hidden (fog of war).

## 1.4 Hidden-world parameter table

Lognormal parameters: median = √(L·U) and σ = ln(U/L)/2.563, both [D] from the stated [C] CIs.

### 1.4.1 Stage 1, AI 2027 classic (time-horizon-extension model)

| Param | Eli Apr-2025 | Nikola Apr-2025 | Eli May-2025 | Dist | Tag |
|---|---|---|---|---|---|
| `h0` (80% horizon at 2025.25) | 15 min (Claude 3.7 Sonnet) | same | same | fixed | [S][C] |
| `h_SC` (80% horizon needed for SC) | [1, 14400] months → median 120 mo (10 work-years), σ 3.74 | [16 h, 4000 h] → median ~1.5 mo | [1, 14400] mo | lognormal | [S][C] |
| `T` doubling time (now) | [2.5, 9] mo → median 4.74 (text says 4.5), σ 0.50 | same | same | lognormal, copula 0.7 | [S][C] |
| P(superexp) / P(exp) / P(sub) | 0.45 / 0.45 / 0.10 | 0.40 / 0.50 / 0.10 | schedule below / remainder / 0.10 | categorical | [S][C] |
| superexp decay per doubling | 0.10 fixed | 0.10 | [0.03, 0.30] → median 0.095 | fixed / lognormal | [S][C] |
| subexp growth per doubling | 0.10 | 0.10 | 0.10 | fixed | [C] |
| May-2025 superexp start schedule (horizon in months: cumulative P) | — | — | 0.0014 (~14 min): 0.25; 0.045 (~7.5 h): 0.40; 1: 0.60; 120: 0.80; 12000: 0.85. U ≥ 0.85 (and below the 0.9 sub cutoff) stays exponential | piecewise | [C] |
| `cs` cost/speed gap | [0.5, 30] mo → median 3.87, σ 1.60 | ? (not in active config) | same | lognormal, copula 0.7 | [S][C] |
| `delay` internal→public | [0.25, 6] mo → median 1.22 | same | same | lognormal | [S][C] |
| `p` present multiplier excess (M0 = 1+p) | [0.03, 0.30] → median 0.095 | ? | [0.03, 0.30] | lognormal, copula 0.7 with s | [C] |
| `s` SC multiplier excess (M_SC = 1+s) | [1.5, 40] → median 7.75 (text: 8.5 [2.5, 40] as multiplier) | [1.0, 20] → 4.47 (text: 5.5 [2, 20]) | [1.5, 40] | lognormal | [S][C] |
| `share` (software share of progress) | 0.5 fixed | 0.5 | N(0.525, 0.254) clipped [0.1, 0.9] (text: "50%→55%") | normal | [S][C] |
| compute factor C(t) | 1.0; 0.5 from 2029 | same | 1.0; 0.9 (2028); 0.5 (2029); 0.4 (2030); 0.3 (2031+) | schedule | [C] |
| labor growth/yr | (slowdown formula from 2029) | same | 0.5 (2025); 0.4 (2028); 0.2 (2029); 0.15 (2030); 0.1 (2031+) | schedule | [C] |
| labor_power / L0 / R0 | — | — | 0.3 / 1000 / 50 | fixed | [C] |

**Benchmarks-and-gaps (Method 2) extras.** These are optional and make a richer Stage 1 [S][C]. In months at 2024 progress rate, median [80% CI], lognormal, with gap correlation 0.7:

| Gap | Eli | Nikola | FutureSearch |
|---|---|---|---|
| RE-Bench saturation date `t_sat` | [2025-09, 2031-01] | [2025-08, 2026-11] | [2025-09, 2031-01] |
| horizon at saturation `h_sat` | [0.5, 15] h | [0.5, 12] h | [0.5, 15] h |
| horizon needed `h_SC` | [0.05, 6] mo | same | same |
| doubling time at saturation | [0.5, 18] mo | same | same |
| multiplier excess at saturation / at SC | [0.05, 0.6] / [1.5, 40] | [0.05, 0.6] / [1.0, 20] | [0.05, 0.6] / [1.5, 40] |
| Time-horizon gap (resulting) | 18 [2, 144] | 16 [1, 125] | 12.7 [1.7, 48] |
| Engineering complexity | 3 [0.5, 18] | 3 [0.5, 18] | 11 [2.4, 33.9] (code: [2.4, 48]) |
| Feedback loops | 6 [0.8, 45] | 3 [0.5, 18] | 18.3 [1.7, 58] |
| Parallel projects | 1.4 [0.5, 4] | 1.2 [0.5, 3] | 2 [0.7, 5.3] |
| Specialization | 1.7 [0.5, 6] | 0.4 [0.1, 2] | 2.4 [0.5, 4.7] |
| Cost & speed | 6.9 [1, 48] | 6 [1, 36] | 13.5 [4.5, 36] |
| Other | 5.5 [1, 30] | 3 [0.5, 18] | 14.7 [2, 58.8] (code: [5, 100]) |
| P(superexp) / decay | 0.45 / 0.1 | 0.40 / 0.1 | 0.45 / 0.1 |

Daniel's commented-out config [C]: h_sat 8 h; h_SC [32, 1024] h; doubling time [10, 200] days; t_sat [2025-06, 2026-11]; P(superexp) 0.5.

### 1.4.2 Stage 2, AI 2027 takeoff

| Param | Value | Dist | Tag |
|---|---|---|---|
| Multiplier at SC / SAR / SIAR / ASI | 5× / 25× / 250× / 2000× | fixed (the source does not model uncertainty in these) | [S][C] |
| SC→SAR human-only years | P(0) = 0.15; else [1.5, 10] → median 3.87, σ 0.74 | zero-inflated lognormal | [S][C] |
| (decomposition) | 15% already SAR = 0; 25% "skills don't need more compute" ~2 y [1, 4]; 30% "need more compute" ~5 y [2, 15]; 30% "scientific problem" ~5 y [2, 15] | mixture | [S] |
| AMR→SAR human-only years | [1, 25] → median 5, corr 0.8 with SC→SAR | lognormal | [S][C] |
| SAR→SIAR human-only years | x³/100 − x, x = 10 + AMR→SAR. Stated distribution 19 [2.3, 380] | derived | [S][C] |
| SIAR→ASI jumps E | [0.3, 7.5] → median 1.5, independent | lognormal | [C] |
| SIAR→ASI human-only years | x2·(x2/x)^E − x2. Stated distribution 95 [2.4, 1,000,000] | derived | [S][C] |
| Resulting calendar gaps (median, [80% CI]) | SC→SAR 0.3 y (90th pct 0.95); SAR→SIAR 0.3 [0.04, 56]; SIAR→ASI 0.16 [0.01, >100] | output | [S] |
| Start date | SC on 2027-03-31 (scenario SC date) | fixed | [C] |
| Compute after SC | no training-compute growth; experiment compute capped ~1% | assumption | [S] |

### 1.4.3 AIFM (Dec 2025 → Aug 2026) key parameters (for AIFM-lite presets and for flavor)

| Param | Eli | Daniel | Dist | Tag |
|---|---|---|---|---|
| Present 80% horizon (anchor) | Dec 2025: 32 min (GPT-5.1-Codex-Max, 2025.9); Apr 2026: 70 min (Opus 4.6, 2026.1); Aug 2026: 186 min (Mythos Preview early, 2026.27) | same | fixed | [S][C] |
| Present doubling time t1 | 4.5 mo [2.2, 9.2] (Dec-2025 value was 5.5) | 4 mo [2.54, 6.28] | lognormal | [S][C] |
| Doubling difficulty growth factor d (n-th doubling needs d^(n−1)× the effective-compute OOMs of the first) | 0.92 [0.82, 1.02], truncated [0.6, 1.02] | same | normal | [S][C] |
| AC 80% horizon requirement | 125 work-years [0.1, 156,250] (= 2.6 wy × 10 for 95%→80% × 5 for real-world gap) | 1 work-year [0.05, 20] (was 3 y until 2026-03-31) | lognormal; 120,000 min per work-year | [S][C] |
| Extra effective-compute gap | 0.7 [0.1, 4.9] "2025-years"; P(gap) = 30% | P(gap) = 0 | lognormal × Bernoulli | [S][C] |
| AC anchor-method weights (horizon / uplift / revenue) | 0.2 / 0.6 / 0.2 | 0.25 / 0.5 / 0.25 (Brendan 0 / 0.65 / 0.35) | categorical | [S][C] |
| Present serial coding uplift | 1 + 0.7 [0.1, 4.9] | 1 + 1 [0.25, 4] (≈2×) | shifted lognormal | [S][C] |
| Doubling time of (uplift − 1) | 6.5 mo [2, 21.1] | 5 mo [2.5, 10] | lognormal | [S][C] |
| Uplift at AC | (not sampled) | 20× (3-param model; full-model median 32×) | — | [S] |
| Present revenue / growth / revenue at AC | $47B / 5× [2, 12.5] / $7T [0.2T, 245T] | $47B / 5× / $1T [0.1T, 10T] | lognormal | [S][C] |
| Coding-labor substitutability ρc | −1 (25%), −2 (50%), −5 (25%) | same | choice | [S][C] |
| Parallel penalty λ (N copies → N^λ serial) | 0.5, Beta(3, 3) | same | beta | [S][C] |
| Max serial coding labor multiplier | 1e8 [1e4, 1e12] | same | lognormal | [S][C] |
| Speedup from 10× less experiment compute (inverse anchor) | 1 + 1.8 [0.7, 4.6] | same | shifted LN | [S][C] |
| Infinite-coding-labor asymptote | 1 + 14 [1, 200] | same | shifted LN | [S][C] |
| Infinite-experiment-compute asymptote | 1 + 1000 [25, 40,000] | same | shifted LN | [S][C] |
| AI research taste at AC (SD vs. median lab researcher) | N(0.5, [−2.5, 3.5]) | N(0, [−3, 3]) | normal | [S][C] |
| Taste slope (SD per "2025-year" of effective compute) | 2.3 [0.8, 6.6] | (inherits) | lognormal | [S][C] |
| Median→top taste multiplier | 1 + 3 [0.8, 11.25] (≈4×) | (inherits) | shifted LN | [S][C] |
| Max taste (human ranges above top) | 8 [2, 32] | 16 [4, 64] | lognormal | [S][C] |
| Software efficiency growth, 2024 | 1.0 OOM/yr [0.4, 2.5] | same | lognormal | [S][C] |
| Returns to software research β (derived at median) | 0.31 | — | — | [S] |
| TED-AI m2b jumps above SAR | 1.5 [0.4, 5.6] | 1 [0.27, 3.74] | lognormal | [S][C] |
| TED-AI → ASI | 2 median-to-top jumps | fixed | — | [S] |
| Takeoff b | median ≈ 1.21; P(b < 1) = 38%; P(b < 0.7) = 17%; AI 2027 implied b ≈ 0.64–0.78 | — | output | [S] |
| Correlations (Spearman) | t1–d 0.6; d–h_AC −0.5; t1–taste slope −0.3; d–taste slope −0.3; d–gap 0.3; taste slope–taste@AC 0.3; compute-anchor–compute-asymptote 0.5; taste slope–m2b multiplier −0.2 | | copula | [C] |

## 1.5 Suggested presets

Columns: Stage-1 parameters, takeoff parameters, and the expected result. "Lite" means the Section 1.3 engine run with the listed values, which I calibrated to approximate the source's median [D]. Medians below are point-parameter runs. Sampled-distribution medians are usually somewhat earlier, because the date distributions are right-skewed.

| # | Preset | Stage 1 | Takeoff | Result | Tag |
|---|---|---|---|---|---|
| 1 | **AI 2027 Scenario (scripted)** | force SC = 2027-03. Multiplier path per scenario: 1.5× early 2026 (Agent-1), ~2× late 2026, 3× Jan 2027 (Agent-2), 4× Mar 2027 (Agent-3/SC), 10× Jun 2027, 25× Aug 2027 (SAR), ~50× Sep 2027 (Agent-4), 250× SIAR, 2000× ASI | G1 = 4.19, G2 = 16.0, G3 = 49.5 human-only years with 5/25/250/2000 interpolation, which gives SAR Aug 2027, SIAR Nov 2027, ASI Dec 2027 | SC Mar-27, SAR Aug-27, SIAR Nov-27, ASI Dec-27 | dates/multipliers [S]; G values [D] |
| 2 | **AI 2027 model, median params (superexp)** | h0 15 min, T 4.74, decay 0.1, h_SC 120 mo, cs 3.87, delay 1.22, p 0.095, s 7.75, share 0.5, C 0.5 from 2029 | AI 2027 medians (G1 3.87, A = 5 → G2 18.8, E 1.5 → G3 80) | SC ≈ Dec-26 (buggy interp) / Jun-27 (patched). Source: "Jan 2027". Takeoff SC→ASI ≈ 0.8 yr | [S] result; my reimplementation [D] |
| 3 | **AI 2027 model, Eli Apr-2025 (sampled)** | sample Section 1.4.1 Eli column, buggy interpolation for fidelity | sample Section 1.4.2 | SC median 2027 (Aug 2027 in appendix), 80% CI 2025–2039 | [S] |
| 4 | **AI 2027 model, Nikola (sampled, fast)** | Nikola column (h_SC ~1.5 mo, P(super) 0.4) | Section 1.4.2 | SC median 2027, 80% CI 2025–2033 | [S] |
| 5 | **Eli May-2025 update (sampled)** | May-2025 column + labor/research-stock variant | Section 1.4.2 | SC median Feb 2029 (80% CI Apr 2026–2052); B&G Mar 2030 | [S] |
| 6 | **AI 2027 model, exponential only** | as #2 but P(super) = 0 | Section 1.4.2 | SC ≈ Sep 2028 (source) / my run Jul 2028 (buggy) to ~2029.6 (patched) | [S]/[D] |
| 7 | **AIFM Dec-2025 (model/Eli, slower)** | Lite: t0 2025.9, h0 32 min, T 5.5, d 0.95, h_AC 125 wy, M0 1.05 → M_SC 2, share 0.6, C 1/0.9/0.5/0.4/0.3 schedule | AIFM median: SAR +2 mo after SC, SIAR +1.8 y, ASI +5 y (no compute growth after SC). Eli: P(AC→ASI < 1 y) 30%, < 3 y 60% | AC ≈ May 2031 (source, median params); my lite run ≈ 2031.2. Eli ATC: AC p10 2027.5 / p50 2032.5 / p90 2085 | [S]; lite values [D] |
| 8 | **AIFM Aug-2026 Daniel (fast, "current")** | Lite: t0 2026.27, h0 186 min, T 4.0, d 0.92, h_AC 1 wy, M0 1.15 → 4, share 0.6 | AC→TED-AI 8.9 mo, AC→ASI 1.0 y (Daniel ATC). Model 1.72 y | AC p10 Jan-27 / p50 Nov-27 / p90 Apr-30. TED-AI Nov-28, ASI Mar-29 | [S]; lite values [D] (run gave 2027.83) |
| 9 | **AIFM Aug-2026 Eli (central)** | Lite: same h0/t0, T 4.5, d 0.97, h_AC 125 wy, M0 1.1 → 3, share 0.6, compute schedule | AC→TED-AI 1.1 y, AC→ASI 2 y (Eli ATC). Model 4.56 y | AC p10 Jun-27 / p50 Jan-30 / p90 Oct-2070. TED-AI Jul-32, ASI Jul-33 | [S]; lite values [D] (run gave 2030.15; d 0.92 & M_SC 2 gives 2029.2 = Eli's model median Mar-29) |
| 10 | **Brendan Aug-2026** | between #8 and #9 | takeoff length capped by draw from {∞, 10, 5, 2} y; 25% chance of a 6-month floor | AC p10 Jan-27 / p50 Jan-29 / p90 Jan-2050. TED-AI p50 Apr-31 | [S] |
| 11 | **Fast takeoff** | any Stage 1 | SC→SAR = 0, AMR→SAR = 1 y → G2 = 2.31 y, E = 0.3; or doubling-chain b = 0.6 | SC→ASI in ~2–3 months (AI 2027's 10th pct: SAR ≈ SC, ASI Jun 2027) | gap pcts [S], computed values [D] |
| 12 | **Slow takeoff** | any Stage 1 | SC→SAR 10 y, AMR→SAR 25 → G2 ≈ 394 human-years (≈ 6 calendar years at 25→250×); or b ≈ 1.5, M capped at ~15× (inf-labor asymptote) until compute grows | SC→ASI 5–10+ years | [D] from [S] 90th pcts and AIFM asymptote |
| 13 | **Skeptic: METR plain exponential** (titotal "purple") | t0 2025.6, h0 38 min (GPT-5 p80, TH1.1), T 7 mo (METR 2019–25), d = 1, no AI speedup (M = 1), h_SC 10 wy, compute schedule as #7 | slow (#12) | titotal: SC 2031 (Nikola h_SC) / 2035 (Eli h_SC). My lite run 2036.3 | [S] / [D] |
| 14 | **Skeptic: "last gasp" logistic** | log-horizon follows a logistic that saturates below h_SC (e.g. ceiling ≈ 1 work-week) | n/a | SC never (titotal "brown": "never") | [S] concept; ceiling [D] |
| 15 | **"Reality is 70–90% of AI 2027 pace"** | run #1 with time stretched by 1/0.75 | same stretch | AC mid-2027 at 75%, early 2028 at 60% (Daniel) | [S] |

**Suggested hidden-world sampler** [D]:
```
preset_family ~ player choice, or "Surprise me" = mixture {#3: 0.15, #5: 0.15, #7: 0.15, #8: 0.2, #9: 0.2, #13: 0.1, #14: 0.05}
draw all params of that family via its copula
optional: condition on observed history (reject draws whose h80_public at 2026.27 is outside [97, 399] min = Mythos p80 95% CI)
```
Calibration check [D]: AI 2027's own median superexponential trajectory implies an internal h80 of ≈ 179 min at 2026.27. METR measured Claude Mythos Preview (released 2026-04-07) at p80 = 186 min (TH1.1). That is one data point on a different suite version, but it is remarkably on-trend. The exponential-branch median implies ≈ 123 min.

## 1.6 Calibration data: METR time horizons (TH1.1, minutes) [S]

| Model | Release | p50 [95% CI] | p80 [CI] |
|---|---|---|---|
| Claude 3.7 Sonnet | 2025-02 | 60 [32, 106] (TH1.0: 56) | ~15 (AI 2027 value, TH1.0) |
| GPT-5 | 2025-08-07 | 203 [113, 406] | 38 [19, 70] |
| Gemini 3 Pro | 2025-11-18 | 224 | 54 |
| GPT-5.1-Codex-Max | 2025-11-19 | 224 | 51 |
| Claude Opus 4.5 | 2025-11-24 | 293 [162, 624] | 49 [21, 105] |
| GPT-5.2 | 2025-12-11 | 352 | 66 |
| Claude Opus 4.6 | 2026-02-05 | 719 [317, 3634] | 70 [27, 170] |
| GPT-5.3-Codex | 2026-02-05 | 350 | 55 |
| Gemini 3.1 Pro | 2026-02-19 | 384 | 90 |
| GPT-5.4 | 2026-03-05 | 342 | 54 |
| Claude Mythos Preview (early) | 2026-04-07 | 1045 [509, 3304] | 186 [97, 399] |

Doubling times of the p50 horizon: all-time stitched 188 days (≈6.2 mo); 2023-on 129 days [104, 158]; TH1.1 2024-on 88.6 days (≈2.9 mo); TH1.0 2024-on 109 days. The original Mar-2025 paper said "~7 months" for 2019–2025. METR: "Measurements above 16 hrs are unreliable with our current task suite". The page was last updated 2026-09-08 and is "no longer actively updated."

## 1.7 Implementation notes and validation [D]
- My JS reimplementation of 1.3.2/1.3.3 at Eli's median parameters gives: superexp SC 2026.93 (buggy) / 2027.38 (patched); exp 2028.51 / 2029.55; sub 2034.8 / 2038.4. The sources state superexp Jan 2027 and exp Sep 2028 for median parameters, and say the bug fix shifts the median by about 9 months.
- Takeoff at median gaps: SC→SAR 0.385 y (for the nonzero median; the source median 0.3 includes the 15% zero mass), SAR→SIAR 0.29 y, SIAR→ASI 0.135 y. These match the stated 0.3 / 0.3 / 0.16.
- Edge cases in the code: decay = 0 divides by zero; the SE start threshold H_k < h0 gives negative doublings; the sampled `delay` is subtracted from the start, so it makes the internal SC earlier. Guard against all three.
- The AIFM `M` is not the same quantity as the AI 2027 `M`. The AIFM separates *serial coding uplift*, which passes through a CES with experiment compute, from the *AI software-progress multiplier* (milestones AIR-5x … AIR-10000x). In the lite presets, `M_SC` of 2–4 is an effective calibration knob, not a forecast of uplift. Show players a separate cosmetic "uplift" curve if needed. For example, Daniel: uplift 2× in Aug 2026, (uplift−1) doubling every 5 mo, 20× at AC [S].

---

# 2. DETAILED NOTES

## 2.1 AI 2027 Timelines Forecast (Apr 2025; updated May 2025 and Dec 2025)
URL: https://ai-2027.com/research/timelines-forecast. Authors: Eli Lifland, Nikola Jurkovic, FutureSearch.

**Superhuman Coder (SC)** [S]: "An AI system for which the company could run with 5% of their compute budget 30x as many agents as they have human research engineers, each of which is on average accomplishing coding tasks involved in AI research ... at 30x the speed ... of the company's best engineer." Research taste is not required.

**Method 1, time-horizon extension** [S]:
- Current 80% horizon: 15 min (Claude 3.7 Sonnet).
- h_SC: Eli 10 years [1 month, 1200 years]. This is on an extrapolated HCAST; on the real task distribution he puts ~6 months [1 week, 12 years]. Nikola 1.5 months [16 h, 4000 h].
- Doubling time: 4.5 mo [2.5, 9]. The Dec-2025 edit says "extended as a long-term trend".
- Superexponential: "each successive doubling takes 10% less time". Subexponential: each takes 10% more time.
- Cost/speed: 4 mo [0.5, 30], derived from 6.9 [1, 48] adjusted down about 50%.
- Internal–public gap: 1.2 mo [0.25, 6].
- Arguments given for superexponentiality: "for humans the gap in difficulty between 1 month and 2 month tasks is lower than between 1 day and 2 days". Long-horizon reasoning generalizes. METR's 2024–25 doubling was ~3.5 mo vs 7 mo for 2019–25. Scaling agency training. The text concedes "it's unclear whether this will transfer to AIs". The public–internal gap argument is now marked "We now believe this argument was mistaken" (Dec 2025).

**Method 2, benchmarks and gaps** [S]:
- RE-Bench saturation = score 1.5. Human baselines: 0.12 at 2 h, 0.66 at 8 h. SOTA ~0.6.
- Logistic fit with upper bound ~N(2.0, 0.25). Each 0.25 change in the upper bound shifts saturation by about half a year.
- Gaps are in the table in Section 1.4.1, correlated through a ρ = 0.7 copula. The engineering-complexity milestone is ">20,000 lines of code across files totaling up to >500,000 lines".
- Compute scaling slows 2× from 2029. If SC is not reached by ~2028, human research growth also slows 2×.
- Intermediate speedup: progress rate is 1 in 2025 and reaches [5%, 60%] faster than 2024 at RE-Bench saturation. SC multiplier Eli 8.5 [2.5, 40], Nikola 5.5 [2, 20]. Algorithmic progress is 50% of AI progress in 2024. Nikola estimates 2022–24 AI tools made algorithmic progress 3–30% faster.
- Bug (Dec 2025 note): the intended interpolation was `(current−1)·((SC−1)/(current−1))^f + 1`, but the "implemented code omitted the −1 terms". This "overestimated speedups" and had "about a 9 month impact on our model's SC median".
- Dec 2025 note on cost/speed: reasoning from speed and copies instead gives ~1.9 years (Epoch data) or ~0.7 years (RE-Bench data). [S; ?]

**Results** (median, 80% CI) [S]:

| Model | Apr 2025 | May 2025 |
|---|---|---|
| Time-horizon, Eli | 2027 (2025–2039); appendix Aug 2027; mode 2026 | Feb 2029 (Apr 2026–2052); mode 2027 |
| Time-horizon, Nikola | 2027 (2025–2033) | — |
| B&G, Eli | 2028 (Dec 2025–>2050); appendix Dec 2028 | Mar 2030 (Feb 2026–2095) |
| B&G, Nikola | 2027 (2025–2044) | — |
| B&G, FutureSearch | 2032 (2026–>2050) | — |
| All-things-considered | Eli 2030 (2026–>2050); Nikola 2028 (2026–2040); FutureSearch 2033 (2027–>2050) | — |

**May 7, 2025 update** [S]: labor is now modeled directly and combined with compute into research effort, with "each doubling of total research effort gives the same progress" (Davidson-style diminishing returns). This was the largest change: about 13 months later for time-horizon and about 8 months for B&G. P(superexp) now rises with horizon. Software share went from 50% to 55% and gained uncertainty. The decay rate gained uncertainty. Labor and compute schedules were updated. Forecasts got "noticeably but not greatly" longer.

## 2.2 AI 2027 Takeoff Forecast (Apr 2025)
URL: https://ai-2027.com/research/takeoff-forecast. Authors: Daniel Kokotajlo, Eli Lifland.

**Milestones** [S]:
- **SC**: as in Section 2.1.
- **SAR (Superhuman AI Researcher)**: can do the job of the best human AI researcher, 30× faster with 30× more agents.
- **SIAR (Superintelligent AI Researcher)**: the gap to the best human researcher is 2× the gap between the median AGI-company researcher and the best, in log space.
- **ASI**: about 2× better than the best human professional at every cognitive task, relative to how far the best is above the median.
- Reference point: "automated median AGI-company researcher" (AMR).

**Progress multipliers** (defined relative to a no-AI counterfactual with the same projected human labor and compute) [S]:
- SC 5×. A Guesstimate decomposition gave 5.8× [3.4, 10]: flexible prioritization 1.5–3×, smaller experiments 1.2–2×, less waste 1.2–2×, fancier experiments 1.1–1.5×, lack of diversity 0.8–1×.
- SAR 25×, from three methods: decomposition 417× [130, 1900] (judged "feels too high"); survey subquestions 26× [8, 139]; direct survey 24× [5, 112]. The subquestion method uses "0.4^(log(30)/log(10)) = 0.22" for 30× speed at 1/30 compute, giving ~7×, then 30× parallel labor → 3× [1.5, 6], everyone-as-good-as-best → 2.5× [1.25, 5], and diversity loss 0.28–0.95×.
- SIAR 250×: the median-to-top jump is ~6.5× overall and 3.25× from taste; two jumps give 3.25² ≈ 10, and 25 × 10 = 250.
- ASI 2000×: the naive figure is 10^1.25 above SAR, shaded to ~8×.

**Human-only gaps**: listed in Section 1.4.2. The SAR→SIAR formula is in footnote 25: "(10+AMR_to_SAR)*2^(2*log((10+AMR_to_SAR)/10)/log(2)) − (10+AMR_to_SAR)". Worked examples on the page: 19 = 15·2^(2·log₂1.5) − 15 and 60 = 20·2^(2·log₂2) − 20. The stock is ~10 human-only years of research at the AMR level. Underlying idea: each doubling of cumulative labor multiplies labor value by r doublings, and SAR→SIAR needs twice as many doublings as AMR→SAR.

**Research taste and bottlenecks** [S]:
- A survey estimated a 6.25× gap between an all-median company and an all-best company, 3.25× of it from experiment selection. There is "at least 1000x" headroom above the human range from experiment selection alone, and the taste distribution is heavy-tailed (Lindy-style argument).
- Experiment compute is the key bottleneck. Diminishing returns use Davidson's framework with r ≈ 4 in the median case. Davidson 2022 used r = 2; a forthcoming estimate is 1.2.
- Compute: ~10M H100e in 2027. 5% goes to AI R&D inference, giving ~200k copies at ~400 tok/s, equivalent to ~50k agents at 30× human speed. No training-compute increases after SC; experiment compute capped around 1% scale-up.
- Limitations as stated: uncertainty over multipliers is not modeled, and compute increases are not modeled.

**Arrival forecasts** [S]: SC Mar 2027; SAR Jul 2027 (Mar 2027–Mar 2028); SIAR Nov 2027 (May 2027–2034); ASI Apr 2028 (Jun 2027–>2100). Median SC→ASI is about 1 year. FutureSearch aggregates: SC→SAR 0.55 y (0–2.1, n = 4); SAR→SIAR 1 y (0.1–2.1, n = 3).

**Scenario multipliers** (ai-2027.com main text) [S]:
- Early 2026, Agent-1: "50% faster".
- Jan 2027: Agent-1 "could double", Agent-2 "can now triple".
- Mar 2027, Agent-3: "'only' 4x". 200,000 copies ≈ 50,000 best-coder copies at 30×.
- Jun 2027: "The AI R&D progress multiplier is now 10x" (≈5× total progress including compute).
- Aug 2027: China 10× vs US 25×.
- Sep 2027, Agent-4: ~50×, with 300,000 copies at ~50× human speed.
- Race-ending dates: SC Mar 2027, SAR Aug 2027, SIAR Nov 2027, ASI Dec 2027.

## 2.3 AI 2027 code (github.com/uvafan/timelines-takeoff-ai-2027) [C]
- `timelines/simple_forecasting_timelines.py` + `simple_params.yaml`: time-horizon model (Section 1.3.2–1.3.4). 5000 sims, dt = 1 day. Active forecasters are `eli` and `eli_patched_rd_speedup` (patched interpolation); Nikola is commented out.
- `timelines/forecasting_timelines.py` + `params.yaml`: B&G. Starts at t_sat; horizon gap from h_sat to h_SC (h_sat in hours/(24·30)); gaps summed. Combined rate (v_comp + v_alg)/2. Internal date = completion − d/12. Note: `t_sat` is an input distribution, not computed from a RE-Bench fit (titotal's point).
- `timelines_may_2025_update/`: labor and research-stock variant, plus the superexp schedule (Section 1.3.3, Section 1.4.1).
- `takeoff/forecasting_takeoff.py` + `params.yaml`: Section 1.3.5. Quirks: the ρ = 0.7 time-gap correlation is effectively unused; p_zero is ignored for derived gaps; calendar time is capped at 1000 years; there are no compute inputs.
- PR #4 is the code change referenced on the timelines page.

## 2.4 AI Futures Model (AIFM), Dec 31 2025 → Aug 2026
URLs: https://www.aifuturesmodel.com (interactive; JS-rendered, so I could not scrape it); blog https://blog.aifutures.org/p/ai-futures-model-dec-2025-update; LessWrong cross-post; supplement Google Doc (a living document with a changelog); code https://github.com/AI-Futures-Project/aifm-public (MIT; `progress_model/`, `config/`).

**Milestones** [S]:
- **AC (Automated Coder)**: "can fully automate an AGI project's coding work, replacing the project's entire coding staff", using 5% of compute. This replaces SC as the headline milestone; SC is still computed.
- **SAR**: "can fully automate AI R&D", matching a team of top researchers in taste, using 1% of compute, and must also be an AC.
- **SIAR**: the gap to the top researcher is 2× the top–median gap, in SDs. In code: AI taste SD = 3 × top-researcher SD.
- **TED-AI**: can fully automate 95% of US remote-work jobs, given big-tech resources and 3 months of prep.
- **ASI**: 2× the best–median gap above the best humans, at virtually all cognitive tasks. Also AIR-5x … AIR-10000x software-multiplier milestones and STRAT-AI.

**Structure** [S][C]:
- State: (log E = cumulative effective compute in OOMs, RS = research stock).
- Software efficiency: SE = r_software·log10(RS/RS0); EC = TC(t) + SE; d(logE)/dt = 10^(EC − logE)/ln10; dRS/dt = RE.
- RE = aggregate taste × CES(experiment_compute^ζ, serial coding labor), with ρ, α and ζ solved from the asymptotes (inf-labor, inf-compute) and the "10× less compute" anchor.
- Coding labor is a CES of human labor and AI inference, Q = (a^(1−ρ) I^ρ + (1−a)^(1−ρ) H^ρ)^(1/ρ), then raised to the parallel penalty λ. The automation fraction A(logE) is logistic and reaches 1 at AC.
- Taste: a bounded transform of a normal, calibrated so that the 99.9th-percentile/median ratio equals the median-to-top multiplier. AI taste SD rises linearly in logE. Aggregate taste = E[max(T_human, T_AI)].
- Horizon: "the first doubling needs τp OOMs of effective compute, the second d·τp, the third d²·τp"; "d=1 implies exponential growth, d<1 superexponential, d>1 subexponential".
- Integration: scipy solve_ivp (Radau first). "SOS" mode freezes labor and compute after a milestone.

**Why Dec-2025 timelines were ~3–5 years longer than AI 2027** [S]:
- ~1 y from parameter updates.
- ~2 y from less pre-SC R&D automation: diminishing returns, and a more pessimistic interpolation that partly reflects the AI 2027 bug.
- ~1 y from slower compute and labor growth.
- ~1 y from modeling experiment compute.
- Parameter comparison (AI 2027 → AIFM): present horizon 15 → 32 min; doubling time 4.7 → 5.5 mo; horizon requirement 10 → 125 y; software share 50% → 63%; SC software uplift 8.5 → 13.4.

**Dec-2025 results** [S]:
- Median-parameter run: AC May 2031, SC Feb 2032, SAR +2 mo, SIAR +1.8 y, ASI +5 y after SC (no compute increases after SC). Monte Carlo SC median Oct 2032, mode 2028.
- Eli: median moved from late 2030 to mid 2032. ATC p10 2027.5 / p50 2032.5 / p90 2085. P(AC→ASI < 1 y) rose from 26% to 30%; P(< 3 y) from 43% to 60%.
- Daniel: AC ~2030, SAR ~2031; ~9% chance things "go crazy" by end-2026; ~6% no AGI by 2050. Pure exponential METR extrapolation gives AC in 2034, or 2030 with the ~4-month RL-era doubling time.
- Takeoff: "In the AI Futures Model's median case, there isn't a TOS" (taste-only singularity); b ≈ 1.21; 38% of sims accelerate; 17% have b < 0.7.

**Q1 2026 update (Apr 2, 2026)** [S]:
- Daniel AC from late 2029 to mid 2028; Eli from early 2032 to mid 2030; TED-AI ~1.5 y sooner.
- Changes: METR TH1.1 adopted; Gemini 3, GPT-5.2 and Opus 4.6 added; doubling time to 4 mo (Daniel) and 4.5 mo (Eli); Daniel's AC requirement from 3 y to 1 y "due to Opus 4.6's impressiveness".
- Quote: "progress in agentic coding has been faster than we expected over the last 3-5 months."

**Q2.5 2026 update (Aug 16, 2026)** [S]:
- New 3-parameter uplift anchor (Daniel medians): present uplift 2×; (uplift−1) doubling 5 mo; 20× at AC. Supporting data: METR uplift study 1.04–1.2×; Anthropic survey 1.25× (Sonnet 4.5) to 4× (Mythos); doubling ~3.5 mo after a Mythos correction. Revenue grows "10x for every 15 ECI points"; ECI today 161, rising +15/yr.
- Reality check: "reality seems to be going about 70-90% as fast as AI 2027 predicted."
- Forecasts are in the preset table (#8–#10). Model AC→ASI medians: Daniel config 1.22 → 1.72 y; Eli config 3.86 → 4.56 y.
- The post mentions a companion project, "AI 2040: Plan A" (`plan_a_covert_proj` in the repo). I did not research it.

## 2.5 Critiques and responses
**titotal, "A deep critique of AI 2027's bad timeline models"** (Jun 2025; Substack and LessWrong) [S]:
1. The superexponential curve hits infinity at finite time t = T0/α regardless of the starting horizon. Even a 15-nanosecond start gives SC before the end of 2029.
2. The intermediate-speedup formula backcasts a 2022 R&D speed factor of ~0.6 vs ~1.1 today (66% faster), which conflicts with Nikola's 3–30% claim.
3. The median curves fit METR history poorly.
4. Too many parameters (~9) for ~11 data points.
5. The published "AI 2027 prediction" graph used 15% decay and dropped GPT-2/3 points, so it was not produced by the model.
6. In B&G, t_sat is set by hand, and a logistic fit to RE-Bench suggests it is nearly saturated already.
7. Without speedups, Eli's SC median is about 4 years later.

titotal's six alternative curves (SC for Nikola / Eli): green hyperexponential mid-2026 / mid-2026; golden superexp+speedups mid-2026 / end-2026; red "new normal" exponential mid-2027 / mid-2029; blue quadexp mid-2029 / mid-2031; purple METR exponential 2031 / 2035; brown logistic "never" / "never". Fitted alternatives: superexp H0 = 9.5 min, T0 = 0.3855 y, α = 8.38%; quadexp H0 = 9.5 min, A = 0.1, B = 2.17. Conclusion: "Reality doesn't usually follow neat curves". Use these for skeptic presets.

**AIFP response** (LessWrong, Eli & Daniel) [S]: they accept "a few outright errors". Fixes from titotal and Peter Johnson moved Eli's-parameter SC median from Aug 2027 to Nov 2029 [?: possibly combined with the May update], and P(SC by end-2027) from ~55% to ~30%. They maintain that the forecast is "(unfortunately) the world's state-of-the-art", that the models still give ~25–40% to SC by end-2027, and they promised a restructured model (which became the AIFM). Zvi called it "a high quality critique" but objected to the title.

## 2.6 METR time-horizon research
- Mar 2025 paper (arXiv 2503.14499) [S]: 50% horizon "doubling approximately every 7 months for the last 6 years"; Claude 3.7 Sonnet ~1 hour (p50); fitting only 2024–25 data shortens the forecast of month-long tasks by ~2.5 years; a 10× measurement error shifts dates by ~2 years.
- TH1.1 (Jan 29, 2026) [S]: 228 tasks (up from 170); 31 tasks of 8h+; moved to Inspect. Doubling: all-time 196.5 d; since 2023 130.8 d [107, 161]; since 2024 88.6 d.
- Current data file `benchmark_results_1_1.yaml` [C]: values in Section 1.6; all-time stitched 187.8 d; 2023-on 128.7 d [104.4, 158.0], excluding p50 > 16 h.

---

# 3. SOURCES
- AI 2027 research index: https://ai-2027.com/research
- Timelines Forecast: https://ai-2027.com/research/timelines-forecast
- Takeoff Forecast: https://ai-2027.com/research/takeoff-forecast (also at /supplements/takeoff-forecast)
- AI 2027 scenario: https://ai-2027.com/
- AI 2027 code: https://github.com/uvafan/timelines-takeoff-ai-2027 (files: timelines/simple_forecasting_timelines.py, timelines/simple_params.yaml, timelines/forecasting_timelines.py, timelines/params.yaml, timelines_may_2025_update/*, takeoff/forecasting_takeoff.py, takeoff/params.yaml); PR #4
- Takeoff Guesstimate: https://www.getguesstimate.com/models/25630; spreadsheet https://docs.google.com/spreadsheets/d/1dcNHLU6PlkqxnCmiVs6S_gO9lE7qncc1uNN88mcIBaA
- FutureSearch forecasts: https://futuresearch.ai/ai-2027
- AI Futures Model site: https://www.aifuturesmodel.com (/forecast, /results)
- AIFM code: https://github.com/AI-Futures-Project/aifm-public (progress_model/README.md, ces_functions.py, taste_distribution.py, progress_rate.py; config/sampling_config.yaml, sampling_config_q2_eli.yaml, sampling_config_q2_daniel.yaml)
- AIFM supplement: https://docs.google.com/document/d/1ru6Okbxb6XuH18Cz8439sdQJazMV39hNxsWDokh97r0
- Dec 2025 update: https://blog.aifutures.org/p/ai-futures-model-dec-2025-update ; https://www.lesswrong.com/posts/YABG5JmztGGPwNFq2/ai-futures-timelines-and-takeoff-model-dec-2025-update
- Q1 2026 update: https://blog.aifutures.org/p/q1-2026-timelines-update
- Q2.5 2026 update: https://blog.aifutures.org/p/q25-2026-timelines-update-uplift ; https://www.lesswrong.com/posts/ZPSsmRH5oMwLPXys4/q2-5-2026-timelines-update-uplift-and-revenue
- titotal critique: https://titotal.substack.com/p/a-deep-critique-of-ai-2027s-bad-timeline ; https://www.lesswrong.com/posts/PAYfmG2aRbdb74mEp/a-deep-critique-of-ai-2027-s-bad-timeline-models
- AIFP response: https://www.lesswrong.com/posts/G7MmNkYADKkmCiumj/response-to-titotal-s-critique-of-our-ai-2027-timelines
- Zvi analysis: https://thezvi.substack.com/p/analyzing-a-critique-of-the-ai-2027
- METR: https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/ ; https://arxiv.org/abs/2503.14499 ; https://metr.org/blog/2026-01-29-time-horizon-1-1/ ; https://metr.org/time-horizons/ ; https://metr.org/assets/benchmark_results_1_1.yaml ; https://github.com/METR/eval-analysis-public
- RE-Bench: https://arxiv.org/abs/2411.15114 ; HCAST: https://metr.org/hcast.pdf

**Known gaps:**
- I could not render aifuturesmodel.com (JS), so I have no AIFM percentile tables for SAR/SIAR beyond what the blogs state.
- I did not read the full AIFM `config.py` constants (e.g. AGGREGATE_RESEARCH_TASTE_BASELINE).
- The exact automation-logistic formula is not extracted.
- Nikola's cs/p values in the simple model were inactive in the config.
- The AIFP response's breakdown of fixes was only partially visible.
- Epoch GATE and Davidson's takeoffspeeds.com are referenced but not researched.
