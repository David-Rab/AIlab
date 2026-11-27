# RD-B08 calibration shift: diagnosis and recommendation

Worktree `AI27-p1-res` (branch p1-res, head ff85b51). Pre-fix code = 1a25b28 (temporary worktree, removed). Probes in
`%TEMP%/ai27ux/probes/rdb08/`: `trace.mts` (RefBot trace per worktree), `elast.mts` (CES elasticity), `trace-{pre,post}-{ai2027,authors2026}.txt`,
`fitlines-{pre,post}.txt`, `scan-{sd,dbm}.txt` (calscan t1, 20 seeds).

## 1. Why authors2026 moves and ai2027 does not

RefBot seed 2027, columns: projects in experiments / RE on projects / RE on tuning / projects' share of experiment FLOP /
software progress (stacks' G-equivalent rate, OOM/yr) / G-equivalent.

| day | authors2026 pre | authors2026 post |
|---|---|---|
| 600 | 5 / 10.0 / 4.9 / 67% / 0.61 / 1.02 | 5 / 10.0 / 2.2 / 82% / 0.72 / 0.98 |
| 1000 | 5 / 10.0 / 9.9 / 50% / 0.77 / 1.88 | 3 / 6.0 / 1.2 / 83% / 0.73 / 1.86 |
| 1500 (≈ SAR) | 6 / 12.0 / 12.0 / 50% / 4.5 / 4.80 | 6 / 12.0 / 2.1 / 85% / 9.6 / 5.12 |
| 1700 | 5 / 10.0 / 16.0 / 38% / 6.5 / 9.30 | 5 / 10.0 / 1.3 / 88% / 7.8 / 10.51 |
| 2000 | 5 / 10.0 / 18.0 / 36% / 3.0 / 12.98 | 5 / 10.0 / 0.5 / 95% / 3.0 / 14.53 |
| 2400 | 5 / 10.0 / 21.0 / 32% / 1.7 / 15.64 | 5 / 10.0 / 0.4 / 96% / 1.8 / 17.44 |
| 2900 | 5 / 10.0 / 26.0 / 28% / 1.4 / 18.51 | (ASI on day 2603) |

Milestones seed 2027: pre SC 1417 / SAR 1506 / SIAR 2034 / ASI 2945; post 1419 / 1506 / 1923 / 2603.

ai2027 (same columns): pre 53–78% projects' share throughout (tuning 3–9 RE), post 55–84%; milestones pre
590 / 735 / 825 / 880, post 585 / 720 / 824 / 881.

Mechanism:
- **Headcount vs projects.** The experimenting-project count is bounded (5–6 projects × RE_PER_PROJECT 2 = 10–12 RE), while
  the lab's research engineers grow with time (hiring along H_ref, +49/month). Under the old headcount split, routine
  tuning (infinite demand) took every engineer the projects did not, and FLOP followed headcount. authors2026's game is
  3.3× longer (ASI ≈ day 2950 vs 880): by SAR its lab has 22–36 free RE for 10–12 project slots, so the projects got
  50% of experiment FLOP at SAR and 28–38% over the whole SAR → ASI phase (≈ 3.8 golden years). ai2027 reaches ASI on
  day 880 with 13–19 free RE, so the old split already gave projects 53–78%, and its SAR → ASI phase is 0.4 y.
- **Size of the starvation.** After the fix the projects get 85–96%: ×1.7 at SAR, ×2.4–3.4 FLOP per project from day
  1700. At the traced inputs (c 400–3600 units, m_EXP 2.5e5, AI labour saturated) the experiment CES has
  d ln X / d ln c = 0.45–0.47 (authors2026) vs 0.40–0.42 (ai2027) (`elast.mts`): ×2.6 FLOP ⇒ ×1.55 project rate.
  So pre-fix, authors2026's post-SAR project experiment rate was ≈ 0.55–0.65 of its unstarved rate (at the same
  day); the software progress rate at equal G-equivalent is ×1.2–1.8 higher post-fix (pre G 11.8 at 3.4 OOM/yr vs
  post G 12.2 at 5.5; pre G 15.1 at 1.9 vs post 15.3 at 2.5). The gain is concentrated in days 1500–1800 (SAR → SIAR),
  where G pulls 1.2–1.6 OOM ahead and stays ahead.
- **CES parameters are a minor factor.** authors2026's La = 15 (vs 100) and slow10 2.8 (vs 2.5) raise its compute
  weight u (0.657 vs 0.570) and its compute elasticity by ≈ 0.05; that adds ≈ 10% to the response. The driver is the
  share change × the length of the post-SAR phase.
- **Early game unchanged.** First-year (ai2027) pretraining-stack growth is slightly *slower* post-fix (tuning no
  longer gets 50–75% of FLOP while headroom is fresh): `calib.ts --fit-lines ai2027` gives LINE_FIT.mu 0.637 pre vs
  0.662 post (committed 0.645). SC and SAR barely move in either preset.

## 2. Was the authors2026 calibration fitted around the bug?

Yes, in its per-preset fitted values; not in its targets.
- The headcount split and tuning's infinite demand date from V2a (881f64c, `tune: Infinity`, `exp: 0.75`) and V3
  (1d365d6, `flopPerRe`). Every V3_CAL fit since V3b (79daefd) was made with them: authors2026 (G_SC, Δ_bm, sd_SC)
  refit at V3b, A5, M1, M4, A6b, A7, F5, F4 (multi-seed), M10, M11 (`src/data/v2/workTypes.ts` V3_CAL history).
- Δ_bm and sd_SC are exactly the values that set the SAR → SIAR → ASI spacing (SIAR = best research human, (1 −
  sd_SC/3.09)·Δ_bm above G_SC; ASI 1.3 gaps more). The phase they were fitted on is the one the bug starved most (28–
  50% FLOP). sd_SC = 2.15 is far above AIFM's median 0.5 (80% CI −2.5…3.5): it was raised 1.8 → 2.15 in F4 to bring
  SIAR / ASI in, i.e. to speed the post-SC taste channel, partly compensating the starved experiments.
- The golden dates are sourced (research/11 §5.3: AIFM Aug-2026 Eli model medians AC 2029.16 + 0.52 / 0.73 / 2.31 /
  4.56 y; ATC ASI 2033.57). They were not fitted to the game, so re-baselining them earlier has no source.
- Not absorbed elsewhere: LINE_FIT.mu (sourced Ho et al. 0.48 OOM/yr, fitted on ai2027's first year) moves the other
  way and by 4%; CAL_SHIFT only paces RefBot's gates (SC unchanged); LEADER_CAL / T1L untouched (the leader lab runs
  the aggregate function, no projects; T1L WARN unchanged). ASI_EXTRA_GAPS 1.3 [fit, global, V3b] was also fitted with
  the bug, on authors2026's SIAR → ASI spacing, but it is global and ai2027 / fast pass, so it is not the value to move.

## 3. Sources for the new-idea vs routine-tuning split

None found. research/ has:
- research/12 §0.1 and research/20 B5 (Epoch): final training runs ≈ 10% of OpenAI's 2024 R&D compute (12–23% at
  MiniMax / Z.ai); "the rest went to experiments, de-risking and unreleased models"; "de-risking is where most
  experiment compute goes". This splits final runs vs experiments, not new ideas vs tuning of adopted ones.
- research/13 §1.4 (AIFM CES parameters), research/03 (AI 2027: experiment compute is the bottleneck): no split.
- MODEL-V3 §5.5 headroom 30% and TUNE_K are [D]; SYNTHESIS §3 E lists headroom / TUNE_K as "[D] with no mechanism".
No primary source gives a tuning share; DD-12 removes headroom (RD-E03). So (b), a sourced tuning-demand rule, is not
available, and retuning TUNE_RE_PER_OOM to the dates would be a forcing refit.

## 4. Recommendation: (a) refit authors2026's V3_CAL

The values fitted with the bug present are authors2026's V3_CAL (G_SC, Δ_bm, sd_SC), and refitting them is the
standing per-merge procedure (`calscan.ts t1 authors2026`, 20 seeds, worst |median| / tolerance ≤ 1). The RD-B08 row
names no value, so the lead has to authorise it. DD-12 already expects a refit ("research gets slightly faster
(refit)"). Under the fix the projects already get 85–96% of experiment FLOP, so RD-E03 (headroom removed, ≈ 100%)
should move these values only a little more.

Scans (T1, RefBot, 20 CAL_SEEDS, median Δ vs golden in years SC / SAR / SIAR / ASI; tolerance ±0.08 SC, ±0.12 after):

| G_SC | Δ_bm | sd_SC | SC | SAR | SIAR | ASI | worst tol |
|---|---|---|---|---|---|---|---|
| 33.45 | 4.65 | 2.15 (committed, test:cal) | +0.036 | −0.090 | −0.270 | −0.487 | FAIL |
| 33.45 | 4.75 | 2.15 | −0.026 | −0.093 | −0.204 | −0.174 | 1.70 |
| 33.45 | 4.85 | 2.15 | +0.025 | −0.090 | −0.144 | +0.045 | 1.20 |
| 33.45 | 4.95 | 2.15 | −0.021 | −0.082 | −0.041 | +0.249 | 2.08 |
| 33.45 | 4.65 | 2.0 | +0.123 | +0.149 | −0.084 | −0.066 | 1.54 |
| 33.45 | 4.65 | 1.8 | +0.123 | +0.525 | +0.218 | +0.255 | 4.37 |
| 33.425 | 4.65 | 2.0 | +0.123 | +0.126 | −0.151 | −0.259 | 2.16 |
| 33.40 | 4.65 | 2.0 | +0.077 | +0.074 | −0.153 | −0.223 | 1.86 |
| **33.40** | **4.70** | **2.0** | **+0.077** | **+0.074** | **−0.059** | **−0.052** | **0.96 PASS** |
| 33.40 | 4.75 | 2.0 | +0.122 | +0.118 | −0.036 | +0.103 | 1.52 |
| 33.40 | 4.80 | 2.0 | +0.107 | +0.108 | −0.040 | +0.171 | 1.43 |
| 33.375 | 4.70 | 2.0 | +0.119 | +0.104 | −0.130 | −0.084 | 1.49 |
| 33.375 | 4.75 | 2.0 | +0.105 | +0.100 | −0.093 | +0.112 | 1.32 |
| 33.35 | 4.70 | 2.0 | +0.099 | +0.085 | −0.160 | −0.210 | 1.75 |
| 33.35 | 4.75 | 2.0 | +0.090 | +0.082 | −0.121 | +0.041 | 1.13 |

Findings:
- Δ_bm alone (sd_SC 2.15) cannot fit: SIAR stays 0.14–0.20 y early wherever ASI is on time. This is the shape V3b
  hit, and it is why sd_SC was raised.
- Lowering sd_SC 2.15 → 2.0 (toward AIFM's 0.5 median, still inside its CI) restores the SIAR / ASI spacing (−0.08 /
  −0.07). The SC median then sits on the day-1540 step (+0.123); G_SC 33.40 and Δ_bm 4.70 bring it back.
- **Recommended values: authors2026 (G_SC, Δ_bm, sd_SC) (33.45, 4.65, 2.15) → (33.40, 4.70, 2.0).** Expected T1
  medians: SC +0.077 / SAR +0.074 / SIAR −0.059 / ASI −0.052 y, worst 0.96 tolerances. The fix moved the late gap
  ≈ 0.4 y; this sd_SC move takes back ≈ 0.15 SD of the post-F4 taste inflation.
- Caveat: this is an island, like the M10 / M11 fits (F4: the SC median is step-like). The neighbours fail by
  1.1–1.5 tolerances, mostly on SC (+0.09…+0.12) or SIAR. The SC knife edge (+0.077 vs ±0.08) is the weak spot.
- Before committing: G_SC moves the authors2026 level knots that the leader lab's T1L reads. Re-run `calscan.ts t1l
  authors2026 --lc 0.05,0.07,0.09` at the new V3_CAL (LEADER_CAL window was 0.05–0.09), then `npm run test:cal`.
  ai2027 / fast / slow use their own V3_CAL rows and are unaffected.

Rejected alternatives:
- (b) No source for a new-idea vs tuning split (§3), and headroom is going (DD-12).
- (c) The golden dates are AIFM medians (§2). The earliest sourced alternative (ATC ASI 2033.57) is 0.16 y earlier, not
  0.49.
- LINE_FIT.mu: sourced and fitted on the first year, which barely moved. Its refit (0.645 → 0.662) would move dates
  slightly earlier, not later.
- TUNE_RE_PER_OOM [D]: tuning it to hit the dates would be a forcing refit.

Nothing was committed. No code was changed on p1-res; the scans pass values through calscan's flags.
