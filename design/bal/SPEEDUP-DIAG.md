# Speed-up diagnosis: why the game's research speed-up after SC is 4-14 half-IQR above the AIFM

2026-11-26, branch `bal`, diagnosis only (no change under `src/` or committed scripts, nothing committed). Probes in `.scratch/`: `su-probe.ts` (forced player lab as M2: reflines, authors2026, `r2-A-sets.json`; quarterly log; env `TLIM` = taste-limit override), `su-run.sh`, analysis `su-an-q1.py`, `su-an-phase.py`, `su-an-sd.py`, `su-an-act.py`, `su-an-gaps.py`; AIFM side `su-aifm.py` (same 60 samples as `pc-aifm.py`, 20 per SAR group, read one line at a time, venv python -I). Game: 2 seeds per timeline (tags `m` base, `tl15` counterfactual); a game stops 0.4 y after its ASI, so later years are blank. Medians; n = 2 games and 20 AIFM samples, so read factors of 1.3 as noise.

## 1. The two quantities (not the same)
- **AIFM** (`metrics_computation.py:520-535`): `mult(t) = RE(C_pd^e, S_t, taste_t) / RE_h(C_pd, H_pd)`, RE = taste x [a C^rho + (1-a) S^rho]^(1/rho), S = L_pr(t)^lambda, L_pr = optimal-CES coding labour with **present-day** human labour, inference and experiment compute but the AI's skill at time t. Baseline = human-only at present day, so it is >1 now (1.05-1.07 at 2025.5). **Present day is 2026.578 in these runs, not 2025.5.** No resource growth enters.
- **Game** `labSpeedRel` (`production.ts:171`): `X(cbar, l) x units x k_obs x Tai x mods` at the lab's **actual** staff, experiment compute and agents, divided by its 2025.5 value. It carries compute growth, engineer count, `pace`, taste. `s1compare` scores its growth against the AIFM mult.
- **Matched quantity** (`su-probe.ts matched()`): `M(t) = [X(cbar_ref, (L_t/H_ref)^lam) / X(cbar_ref, 1)] x [Tai(sd_t, sAI_t) / Tai_human]`: experiment-labour CES and idea-taste mixture with today's AI skill (coverage, assist, FTE per H100e, sd_AI) and the game's own human labour, agent compute and experiment compute frozen at the reference date (2026.578; 2025.5 differs by under 0.07 log10).

## 2. Definition share (log10 growth; hIQR = half the AIFM p25-p75 in log10)
| tl, year | game labSpeedRel | game matched M | game no-AI resources | AIFM mult p50 | gap (hIQR) | definition part | remaining |
|---|---|---|---|---|---|---|---|
| fast 2027 | 0.70 | 0.02 | 0.68 | 0.16 (target 0.18) | +4.6 | +5.9 | -1.4 |
| fast 2028 | 1.70 | 0.91 | 1.04 | 0.75 (0.67) | +3.7 | +2.8 | +0.9 |
| central 2027 | 0.69 | 0.00 | 0.69 | 0.08 (0.09) | +9.4 | +10.9 | -1.4 |
| central 2028 | 1.12 | 0.03 | 1.06 | 0.18 (0.20) | +8.1 | +9.6 | -1.5 |
| central 2030 | 4.42 (n=1) | 3.20 | 1.56 | 0.73 (0.74) | +10.7 | +3.6 | +7.2 |
| slow 2027 | 0.69 | 0.00 | 0.69 | 0.08 (0.08) | +9.3 | +10.5 | -1.2 |
| slow 2028 | 1.05 | 0.00 | 1.05 | 0.11 (0.14) | +9.2 | +10.6 | -1.4 |
| slow 2030 | 1.70 | 0.11 | 1.55 | 0.20 (0.25) | +8.2 | +9.0 | -0.8 |
| slow 2032 | 3.79 | 1.93 | 1.89 | 0.27 (0.35) | +13.4 | +7.2 | +6.2 |
Definition part = log10(labSpeedRel growth / M). **Before the game's SC the whole gap (100-117%) is definition**: the matched game quantity is at or slightly below the AIFM's (remaining -0.8 to -1.5 hIQR). The "no-AI resources" column alone (x4.9 by 2027: compute, engineers, units) is 0.68-0.69 log10 in every timeline. The +4.5 to +14 only survives where the game is past its SC (central 2030, 1.4 y after SC; slow 2032, 1.6 y after): there 34-54% is definition and +6 to +7 hIQR remains. Compared by date that remainder mixes phase (the game's SC is 1.2 y / 4.4 y earlier than the AIFM's in central / slow) with the post-SC rate, so section 3 aligns by phase.

## 3. After SC, matched definition, aligned at SC (game) = AC (AIFM); tau in years
| | tau | 0 | +0.5 | +1.0 | +1.5 |
|---|---|---|---|---|---|
| fast | matched M game / AIFM | 2.9 / 3.6 | 60 / 17 | 1713 / 44 | - / 100 |
| central | M game / AIFM | 2.5 / 3.7 | 15.7 / 8.2 | 260 / 30 | - / 74 |
| slow | M game / AIFM | 1.8 / 3.4 | 3.8 / 7.3 | 20 / 8.5 | 61 / 7.1 |
Equal at SC, then the game runs away in fast and central (slow: below until +1.0 y). Decomposition M = (a) labour channel x (b) taste at +0.5 y / +1.0 y:
| input | game fast | AIFM fast | game central | AIFM central | game slow | AIFM slow |
|---|---|---|---|---|---|---|
| (a)+(c)+(d) CES labour factor | 2.2 / 2.3 | 7.9 / 12.6 | 2.0 / 2.1 | 3.6 / 5.3 | 1.9 / 1.9 | 7.2 / 8.4 |
| (b) taste factor | **27 / 743** | 2.1 / 3.5 | **7.9 / 122** | 2.3 / 5.6 | 2.0 / 10.3 | 1.0 / 1.0 |
| sd_AI (SD above median researcher) | 8.8 / 21.5 | 2.9 / 5.7 | 5.5 / 14.5 | 2.1 / 5.4 | 2.0 / 6.3 | -1.7 / -1.3 |
| EC gained since SC (OOM) | 5.0 / 13.3 | 2.6 / 5.1 | 3.0 / 8.3 | 1.0 / 2.6 | 1.4 / 4.7 | 0.46 / 0.99 |
- **(a) quantity.** Not over-driven. Agent FTE is never the limit: AI / human team-equivalents 130-180 at reference; coverage is. Actual-resource AI labour multiplier in experiments, game / AIFM: central 2027 1.06 / 4.85, 2028 5.5 / 23.8, 2029 338 / 384; fast 2027 1.7 / 8.6; slow 2029 1.2 / 17. Coverage game / AIFM at 2027: 0.25 / 0.79 (fast), 0.04 / 0.65 (central), 0.00 / 0.66 (slow). Agent compute grows x13 by 2027 (game) against x7 (AIFM inference), but FTE per H100e falls to x0.23 (bigger agent models), so FTE grows slower than the AIFM's. **The SHAPE-DIAG suspect (x12.7 vs x5.6) is gone at M2**: it was measured with `pace` 3.2 and P24 landing in year 2; now the game's AI labour is 0.2-0.4x the AIFM's before SC.
- **(b) quality.** The taste map is faithful: at equal sd_AI the game and the AIFM give the same factor (sd 4: 6.5 / 6.3 fast, 5.3 / 5.2 central; sd 8: 28 / 35, 23 / 18; `su-an-sd.py`), and sd per OOM matches (1.5-1.6 vs 1.4-1.8; slow game 1.1 vs AIFM sample 0.5-1.1). The ceiling and mixture work as written.
- **(c) lambda**: 0.508 / 0.507 / 0.510 against the AIFM groups' 0.42 / 0.40 / 0.53 (20-sample medians; full-group median 0.51). Equal.
- **(d) complementarity**: the game saturates **harder**, not softer. At reference compute the game's labour factor tops out at 2.3 (m_exp 140, l = m^lam = 12); the AIFM's CES ceiling at present compute is x17.5 / 20.8 / 29.8 and it realises 8-13. Cause: the game's reference experiment compute is small against its labour (RefBot's experiment share 5% at start, FIXC-PRESC; AIFM 50-56%), so compute binds early.
- **(e) game-only**: the CES-free ideation channel (S1-TAKEOFF-DIAG), the scale lever and the P24 line sit outside this readout.
- **Named input: the speed at which sd_AI (AI taste) rises after SC, i.e. the taste term of the loop, not the speed-up readout.** Taste factor game / AIFM at +0.5 y: 13x (fast), 3.4x (central), 2x (slow); at +1 y 210x, 22x, 10x. It is large because sd_AI is large, which is because EC grows 2-3x faster after SC (5.0 vs 2.6, 3.0 vs 1.0, 1.4 vs 0.46 OOM in 0.5 y). Before SC the paces are equal (fast: 1.16 vs 1.13 OOM in the half-year before; central 0.95 vs 0.85), and total effort at SC is equal (fast 21 vs 14, central 36 vs 38). At +0.5 y the total actual effort ratio (fast, game 498 / AIFM 88 = 5.7x) splits as resources 2.1x (experiment-share ramp), AI labour 0.4x, taste 13x. Per unit of effort the game buys fewer OOM than the AIFM (0.05 vs 0.07 per effort unit, fast), so the stock term is not over-driven either: the post-SC loop gain is.
- Loop gain at the median parameters (taste only, ln(m2b)/dBM x r / ln 10): fast 1.03, central 0.89, slow 0.60 against the AIFM's draws median 0.8 (p10 0.22, p90 3.2, S1-TAKEOFF-DIAG). In the AIFM's own gap table (S1-TAKEOFF-DIAG: 0.5-1 bin SAR>SIAR 1.5 y, SIAR>ASI 2.0 y) the game's central 0.35 / 0.24 y match the 1.5-3 bin (0.36 / 0.12): the game's total gain is about twice its taste gain (all channels, S1-TAKEOFF-DIAG 1.7-2.3).

## 4. Counterfactual: taste ceiling at the AIFM's p10 (tasteLimit 1.5, scratch override `TLIM=1.5`; A = m2b^2.5, about 30-34)
| years, game (2 seeds) | SC>SAR | SAR>SIAR | SIAR>ASI | AIFM p50 |
|---|---|---|---|---|
| fast base -> ceiling | 0.27 / 0.29 -> 0.27 / 0.32 | 0.24 / 0.28 -> 0.34 / 0.40 | 0.15 / 0.21 -> 0.42 / 0.43 | 0.44 / 0.65 / 0.59 |
| central base -> ceiling | 0.34 / 0.42 -> 0.34 / 0.44 | 0.34 / 0.36 -> 0.48 / 0.48 | 0.33 / 0.22 -> 0.72 / 0.33 | 0.86 / 1.32 / 0.91 |
| slow base -> ceiling | 0.67 / 0.78 -> 0.71 / 0.80 | 0.70 / 0.77 -> 1.22 / 1.00 | 0.88 / 0.76 -> 1.04 / 1.21 | 2.27 / 4.00 / 2.85 |
A hard taste ceiling moves the later gaps 1.3-2.8x toward target and leaves SC>SAR untouched (taste is not yet binding there); ratios to the AIFM p50 after it: fast 0.52-0.62 / 0.65-0.73 (SAR>SIAR / SIAR>ASI), central 0.36 / 0.36-0.8, slow 0.25-0.3 / 0.42. So the taste term accounts for roughly half of the missing gap length and no more; SC>SAR (x0.3-0.6) is not a taste effect. This is a diagnostic cap at the edge of the AIFM range, not a recommendation.

## 5. Proposals
- **Definition.** Score the speed-up against the matched quantity M (frozen reference resources 2026.578, AI skill only), not labSpeedRel growth: it removes 100% of the pre-SC gap (+4.5 to +10 hIQR in 2027-2028 in every timeline) and shows the game at or under the AIFM there. Add it as a game readout (the `aiStaffSpeedPart` idea evaluated at reference resources and with sd_AI taste) and as `s1compare` input; keep labSpeedRel for the player. Also compare by phase (SC vs AC), since by date the early game SC dominates central and slow.
- **Setting (source-derived).** (1) Pre-SC coverage is too low: game a 0.00-0.04 at 2027 against the AIFM's 0.65-0.66 (central, slow), so the game's AI-part is 1.2-1.5 hIQR under; re-derive the coverage anchors (theta_w, s, horizon term) from the AIFM automation-fraction path against effective compute. (2) Draw (dBM, r, m2b, tasteLimit) per game from the AIFM group's joint draws instead of group medians: at median parameters the taste gain is 0.6-1.0, near the knife edge, and gap medians of a distribution cannot be reproduced by one median-parameter run. (3) Reference experiment compute share (5% against 50%) sets the game's hard labour ceiling at x2.3; the AIFM's is x17-30.
- **Mechanism (designer).** The post-SC loop gain: the CES-free ideation channel and other game-only channels about double the taste gain (section 3); the experiment ramp gives the game 2x the AIFM's resource effort at +0.5 y; the taste term then amplifies. Whether to bound ideation by experiment compute as the AIFM does for all research effort (S1-TAKEOFF-DIAG item 1), or to cap the OOM a release can add, is a design choice that no setting here replaces. Not tested here: ideation bound, resource ramp.
