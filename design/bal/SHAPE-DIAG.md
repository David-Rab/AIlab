# Shape diagnosis: why the player's software is slow in year 1 and too fast in year 2

2026-11-26, branch `bal`, diagnosis only (no change under `src/`, nothing committed). Probes in `.scratch/`: `sd-probe.ts` (forced aifm player lab, `refwide`, `fixC-r23-sets.json`; env PACE, POLICY, CF, MU, AGENTSOFF; monthly log to 2027.55; `sd-run.sh` = 3 timelines x seeds 1,2), `sd-aifm.py` (streams the Eli rollouts, same 20 samples per SAR group as `pc-aifm.py`, monthly), analysis `sd-an1..13`. Year 1 = 2025.5-2026.5, year 2 = 2026.5-2027.5. Software = `stacksGEquiv` change (stack incl. RL, train, public inflow; no hardware). n = 2 seeds and 20 AIFM samples: +-0.2 OOM is noise (the 20-sample AIFM year-1 medians 1.09/1.05/0.73 differ from the 290-run 1.12/0.93/0.89).
Run tags: **p1** pace 1; **pm** pace-matched (3.75/3.2/3.1), full `refwide`; **pml** pm with no one-off projects (lines only); **pl1** lines only, pace 1; **nop24** pm without P24; **mu16** pace 1 with `LINE_FIT.mu` x2.5 (n0 / 2.5).

## 1. Where the software OOM comes from (mean of 2 seeds; AIFM = 20-sample median SE)
| run | year | total | lines (test scale, pre) | scale lever | one-off ideas | RL+train | public inflow |
|---|---|---|---|---|---|---|---|
| AIFM fast / central / slow | 1 | 1.09 / 1.05 / 0.73 | one stock, SE = r log10(RS) | - | - | - | - |
| AIFM | 2 | 1.23 / 1.16 / 0.75 | | | | | |
| game p1 (pace 1) central | 1 / 2 | 0.45 / 0.74 | 0.10 / 0.39 | 0.06 / 0.22 | 0 / 0 | 0.01 / 0.07 | **0.27** / 0.05 |
| game pl1 (lines only, pace 1) central | 1 / 2 | 0.53 / 0.68 | 0.27 / 0.36 | 0.13 / 0.23 | 0 | 0.05 / 0.07 | 0.07 / 0.02 |
| game pm fast | 1 / 2 | 1.14 / 4.41 | 0.70 / 1.73 | 0.29 / 1.18 | 0 / **1.22** | 0.11 / 0.25 | 0.04 / 0.04 |
| game pm central | 1 / 2 | 0.99 / 2.77 | 0.58 / 0.84 | 0.26 / 0.56 | 0 / **1.22** | 0.09 / 0.14 | 0.05 / 0.01 |
| game pm slow | 1 / 2 | 0.97 / 2.63 | 0.56 / 0.74 | 0.27 / 0.68 | 0 / **1.08** | 0.09 / 0.12 | 0.06 / 0.01 |
| game pml (lines only) central | 1 / 2 | 1.13 / 1.40 | 0.72 / 0.66 | 0.29 / 0.63 | 0 | 0.11 / 0.09 | 0.01 |
- "Lines" = sum of r_l log10(M/n0) of the four pretraining lines (test scale, the AIFM law). "Scale lever" = adopted line effects at the latest base F minus the same at test scale: x (F/F_test)^s, F_test = 0.2% of the base; the base grows x6 in year 2 (3e26 to 1.6e27). "One-off ideas" = pm minus nop24 = P24 (AI-designed successor, mean +0.96 OOM pre, needs rl.mlResearch).
- **Year-1 to year-2 change, pm central: +1.78 = P24 +1.22 (69%) + lines +0.26 + scale lever +0.30 + RL +0.05 - inflow 0.04.** Fast +3.27 (P24 1.22, lines +1.03, lever +0.89); slow +1.66 (P24 1.08, lever +0.41, lines +0.18).
- At pace 1 the "software 0.3-0.4/yr" is **60% public inflow** (rule A catch-up, 0.27): own research is 0.18 (p1) against 0.46 with lines only (pl1). Inflow vanishes once the lab leads (pm 0.05).
- P24 lands 2027.0 at pace 3.2 (its prerequisite rl.mlResearch 2026.75); at pace 1 it is not researched by 2027.5 (rl.mlResearch 2027.0). The global `pace` multiplies the work of every project, so it also pulls the one-off chain a factor 3.2 forward.

## 2. Growth accounting, year 2 vs year 1 (change of ln effort and of ln stock)
AIFM: rate_y = r log10(RS_end/RS_start) exactly (checked per sample); E = tau x CES(D, S), D = C_exp^ece, S = (L_h + L_ai)^lambda; tau = 1.00 in every group to 2027.5 (taste is not active). Game, per line: rate = r_l log10(M_end/M_start), E = dM = tests x q x g; tests = experiment work / w (ideation is not binding: ideas/work 2.0-2.6). Contributions are ln(year-mean) differences x CES elasticity (AIFM: compute weight 0.65-0.67; game X: 0.63-0.65 x zeta); game columns are line L.scale.
| term, ln(E2/E1) | AIFM fast | central | slow | game pml fast | central | slow | game pm fast | central | slow |
|---|---|---|---|---|---|---|---|---|---|
| (a) experiment compute | 0.50 | 0.56 | 0.69 | 0.50 | 0.54 | 0.53 | 0.61 | 0.65 | 0.63 |
| (b) human labour | 0.03 | 0.04 | 0.03 | 0.00 | 0.01 | 0.01 | 0.04 | 0.05 | 0.05 |
| (c) AI labour | 0.37 | 0.17 | 0.09 | 0.21 | 0.09 | 0.03 | **0.77** | **0.44** | 0.19 |
| (d) taste (q) | 0 | 0 | 0 | -0.09 | -0.06 | -0.01 | +0.33 | +0.01 | -0.02 |
| residual (yield per test, CES curvature) | 0.01 | 0.00 | 0.00 | -0.10 | -0.05 | 0.00 | +0.10 | -0.20 | -0.08 |
| total ln(E2/E1) | 1.03 | 0.88 | 0.81 | 0.53 | 0.53 | 0.55 | 1.84 | 0.94 | 0.78 |
| (e) stock term, -ln(M12/M0) | -0.69 | -0.77 | -0.81 | -0.80 | -0.82 | -0.80 | -0.70 | -0.70 | -0.71 |
| net, ln(rate2/rate1) | +0.27 | +0.08 | +0.04 | -0.27 | -0.29 | -0.25 | +1.14 | +0.24 | +0.07 |
Inputs (y1 mean to y2 mean): experiment compute AIFM x3.6, game line FLOP x3.55 (pml); human labour x2.08 in both (forced path), but the game's engineers per project are capped (RE_MAX_PER_PROJECT = 2), so extra heads do nothing (counterfactual staff growth frozen at 2026.5: y2 central 2.69 against 2.77, noise); AI labour (L_h+L_ai)/L_h: AIFM 2.1 to 17 / 5.6 / 5.2, game mExp 1.05 to 80 / 12.7 / 3.0 (pm); coverage AIFM 0.35-0.42 to 0.66-0.80, game 0.01-0.04 to 0.21-0.57.
- (a), (b), (e) match: the experiment CES, the forced paths and the pool law give the same growth and the same diminishing returns as the AIFM (stock term -0.70 to -0.82 in both). This is not where the shape breaks.
- With lines only (pml) the game's effort growth (0.53) is below the AIFM's (0.8-1.0): AI labour smaller (0.03-0.21 against 0.09-0.37) and a negative taste/yield residual (AI taste below the human mixture early; selection weakens as tests outrun ideas). Its lines rate falls 0.43 to 0.36 (L.scale); the rise of the lines-only totals comes from the scale lever and RL.
- Counterfactual y2 (central, mean of seeds): pm 2.77; nop24 1.41; lines only 1.40; compute frozen after 2026.5 2.30; staff frozen 2.69. AIFM 1.16 (fast 2.49 / 1.84 / 3.01 / 4.68 against pm 4.41; slow 1.51 / 1.44 / 2.29 / 2.55 against 2.63).

## 3. The over-rewarded input, with numbers
1. **The one-off idea effect (P24), not any AIFM input.** +1.22 / +1.22 / +1.08 OOM in year 2 (fast / central / slow), 69% of the central change; one fixed lump with no diminishing return and no AIFM counterpart; `pace` 3.2 puts it into year 2. Its AI-capability knock-on adds the large AI term in pm (the stack gains +1.3 OOM in one month at 2027.0; coverage 0.28 to 0.88 over the next six months).
2. **AI labour after that jump:** year-2 mean multiplier 80 / 12.7 / 3.0 against the AIFM's 17 / 5.6 / 5.2, so 4.6x (fast), 2.3x (central) over, slow under; yet in year 1 the game is under (1.05 against 2.1; coverage 0.03 against 0.37). The AI term is 2.1-2.6x the AIFM's in fast and central.
3. **The scale lever (F/F_test)^s, no AIFM counterpart:** lifts line effects x1.4 in year 1 and x2.0 in year 2 (lines only: test scale 0.66, adopted 1.30); +0.3 (central) to +0.9 (fast) of the year-1-to-2 rise.
Not over-rewarded: experiment compute, human labour, the stock term (section 2).

## 4. The n0 finding (initial pool against the AIFM's initial stock)
AIFM: RS(0) = E(0)^2 / E'(0), so RS0/E0 = 1/g_E: **1.43 / 1.32 / 1.20 years** of initial effort (fast / central / slow), E/RS = 0.70 / 0.76 / 0.84 per year at 2025.5 and nearly flat to 2027.5 (at 2026.5 0.77 / 0.77 / 0.83; at 2027.5 fast 1.25 as AI labour grows). A pool that old keeps rate = r g_E, flat while effort grows x2.2-2.4 a year.
Game: the pool starts at n0 from the first idea's mean (effect.mean x LINE_FIT.mu = 0.645, fitted to Ho's 0.48 OOM/yr pretraining target, data/v2/research.ts), not from the line's effort. Age n0 / (dM/dt over the first 6 months), lines-only runs (staffed from day 1):
| line (n0 central) | L.scale 58 | L.data 35 | L.opt 21 | L.env 38 | L.rlalg 10 | AIFM |
|---|---|---|---|---|---|---|
| age, pace 1 (pl1) | 2.8-3.3 y | 5.2-6.3 | **12.6-15.2** | 2.7-3.3 | 1.3-1.6 | 1.2-1.4 |
| age, pace 3.2 (pml) | 1.0 | 1.3 | 1.7 | 0.8 | 0.25 | |
**Yes: at pace 1 the early pool is 2-3x too old for the main lines (4-5x data, 10x opt), so year 1 is slow and the rate rises as the pool fills**; pace 3.2 shrinks every age by 3.2 and lands near the AIFM's 1.2-1.4 y, which is why a single pace value fitted year 1. But the fill-up is modest on its own: pl1 pretraining lines rise y1 0.28 to y2 0.36 (x1.3), and the *shape* breaks only because pace also scales the one-off chain (section 1). Counterfactual with n0 / 2.5 and pace 1 (mu16): lines only, y1 / y2 = 1.00 / 1.10 central, 1.06 / 1.15 fast, 1.03 / 1.03 slow (AIFM 1.05 / 1.16, 1.09 / 1.23, 0.73 / 0.75: shape right, slow level 1.4x high); with refwide, 0.64 (0.41 own + 0.23 inflow) / 1.26 central, no P24 in year 2.
The lines also differ in effort per pool (L.opt 0.07 per year, L.rlalg 0.7), unlike the AIFM's single stock; refwide staffs lines only from 2025.75 and with 1.9 against 3.1 teams (lines idle 3 months because one-off projects take the science teams): own research 0.18 (p1) against 0.46 (pl1) in year 1.

## 5. Release lag (central, mean of 2 seeds; OOM over 2025.5)
| date | internal stack SW | stack HW (latest base) | internal G | released G (SW + HW) | lag internal - released | AIFM EC (SE + HW) |
|---|---|---|---|---|---|---|
| pm 2026.0 | 0.34 | -0.08 | 0.27 | 0.58 (0.66 - 0.08) | -0.31 | 0.74 (0.48 + 0.26) |
| pm 2026.25 | 0.70 | -0.08 | 0.62 | 0.71 (0.78 - 0.08) | -0.09 | 1.24 (0.80 + 0.43) |
| pm 2026.5 | 0.99 | -0.08 | 0.91 | 0.73 (0.81 - 0.08) | +0.18 | 1.61 (1.05 + 0.56) |
| pm 2027.0 | 2.79 | +0.34 | 3.13 | 1.80 (1.47 + 0.34) | **+1.33** (P24 adopted, not yet released) | 2.45 (1.62 + 0.84) |
| pm 2027.5 | 3.76 | +0.72 | 4.47 | 4.57 (3.93 + 0.64) | -0.10 | 3.30 (2.21 + 1.09) |
| p1 2026.5 | 0.45 | -0.08 | 0.37 | 0.70 (0.78 - 0.08) | -0.33 | 1.61 |
- Time-mean lag: pm y1 -0.09, y2 +0.38; p1 y1 -0.35, y2 -0.26. **Release timing is about 0% of the pace-1 year-1 software shortfall** (released G is ahead of the stack by 0.3-0.5: the first release carries an RL catch-up of +0.6 that is not recipe progress). In pm it is +0.18 at 2026.5 and a 1.3 sawtooth around P24.
- The released-G gap to the AIFM EC at pace-matched settings is hardware: at 2026.25 it is 0.53 = hardware 0.51 (the base run did not grow, -0.08 against +0.43; bases only step at 2026.67 and 2027.33, training share 11% since R2.2) + software 0.02; at 2026.5 it is 0.88 = hardware 0.65 (74%) + software 0.23 (release lag 0.18). The brief's "released G lags" is mostly **base-run cadence**, not slower research.

## 6. Ranked causes
Year 1 (pace 1, central 0.45 against AIFM 1.05 or 0.93): (1) pool age: n0 is 2-3x too old for its effort (about +0.6 OOM, pl1 0.53 to pml 1.13); (2) refwide policy diverts the science teams: lines idle 3 months, 1.9 against 3.1 teams (about +0.28 own research); (3) inflow masks it: 0.27 of the 0.45 is catch-up, own research is 0.18. Release timing: ~0.
Year 2 (pm central 2.77 against 1.16): (1) P24 +1.22 (plus its AI knock-on); (2) scale lever +0.56 in year 2 (+0.30 more than year 1); (3) AI labour/coverage jump (2.3x the AIFM's in central, 4.6x fast); the lines' own test-scale rate (0.84) is close to the AIFM total.

## 7. Proposals (not applied)
- **Source-derived setting:** n0 from the AIFM's own initial condition, pool age = 1/g_E = 1.2-1.4 y of the line's start effort (E/RS_0 0.70 / 0.76 / 0.84), per line and per timeline (or LINE_FIT.mu x2.5 as a first cut; L.opt and L.data need more), with pace back to 1. Replaces the `pace` fit by the AIFM's formula and stops pulling the one-off chain forward.
- **Designer, mechanism:** (a) keep `pace` off one-off project work (or drop it with the n0 fix); (b) decide the one-off idea P24: a +0.96 OOM lump is 65-70% of the central year-2 jump (re-opens R2.4 with this evidence: cap or tie it to AI coverage, or give idea projects a diminishing law); (c) review the scale lever for lines (the AIFM is scale-invariant: lines-only adopted 1.30 against test scale 0.66 in year 2); (d) AI labour: year-1 coverage 0.03 against 0.37, then x12-80 in six months; revisit after (b).
- **Designer, harness:** a lines-first or fixed-share policy for forced runs (refwide starves lines for 3 months); report own research apart from inflow; and the base-run cadence / training share (hardware is 74% of the released-G gap).
- **Source-derived setting:** per-timeline initial software rate (AIFM 290-run: 1.12 / 0.93 / 0.89; slow is 1.4x high in the lines-only mu16 run).
