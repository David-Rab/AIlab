# FINREF: finance calibration on model v3 + finance v3 (branch `w-finref` from master 01f0458, 2026-11-21)

Principle (user, 2026-11-21): expected outcomes emerge from sourced mechanisms; a miss is a missing or mis-tuned
mechanism, a fitted value re-anchored on its source, or a band measured with the wrong instrument; never a forcing
rule. **No engine constant changed.** Every commit is a check instrument or band, with its source; the one engine
experiment (below) was reverted.

## Probe and basis

`.finreftmp/probe.ts` (scratch, not committed) is finance.ts's `runBot` (RefBot `refPlay` + `REF_AUTOPILOT`, endings
skipped, to end-2027) on seeds 1–12, with the story recorded at every quarter mark (S and its terms, every private
lab's revenue, growth, share, valuation and cap), the market (supply, demand, exo demand, lab orders, disruptions),
every board-confidence cause and the player's incidents. Check: the probe reproduces M10's test:full numbers exactly
(F2 43.4M, F7 $54.0B, FC1 $3.65T, FC2 22.4× / 27.6× / 26.4×, FIN3a 50.5, F8 75%), so probe = finance runner. The same
probe was run on `git archive` extracts of 181ca78^2 (w-mkt alone) and b2b301f (S5R + MKT + AF2) for attribution.

## Per miss

### F2 2027 global production 43.4M (45–60M)
- *Band:* R15 C2: AI 2027 60M; Epoch's ×2.2 a year (2026's 25M → 55M). A world expectation.
- *Instrument:* the check read seed 1's long run alone. On the 12 RefBot seeds: median **47.1M**; 9 of 12 ship the
  2027 supply path in full (46.3–47.2M, ×2.05 over 2026's 23M). The three short seeds have one short quarter each:
  seed 1 Q3 2027 demand 10.9M against 14.8M of supply (the RefBot's chip orders due fall from ≈ 4.6M to ≈ 1.8M that
  quarter: lumpy orders); seed 9 a Korea disruption (disruptKR 0.46, Q2–Q4 2027, HBM binding: supply 12.6 → 8.8M);
  seed 10 a Taiwan disruption (0.34, Q1–Q2 2027: 10.6 → 8.9M).
- *Fix (8e942e6):* F2 reads the median of the 12 reference runs (seed 1 printed). The mechanism (supply pipeline,
  rivals ordering from cash) is not changed: the supply path itself sits at the band's low end (≈ 47M) by design of
  the pipeline lags, so a single disruption or order dip takes one seed under.

### F7 RefBot 2026 revenue $54.0B (top of $36–54B)
- *Band:* $45B ± 20% = AI 2027's OpenBrain 2026 revenue, a **plot point**.
- *Source:* the measured 2026 leader, Anthropic, CY2026 ≈ $53–56B (S-1: 9M 2026 $33.2B; Q4 at the $81B Oct 31
  run-rate; research/22 §4 [P], which itself notes "That sits at the top of the game's F7 band").
- *Fix (31f7524):* band = both anchors ± 20%: **$36–67B**, in finance F7 and worldfx F7/F11 2026. RefBot median
  $54.0B (12 seeds, 47.6–64.1).

### F9 FC1 late-2026 sector value $3.65T ($2.5–3T)
- *Band:* R15 §2.9, a **sum of real post-money marks** (OpenAI, Anthropic, xAI, others).
- *Diagnosis:* FIN5a fitted S = κ_S · R^α · Φ(L) · mood when every lab's mark was S × its share, so Σ marks = S. Since
  the caps (FIN5b rivals; FIN6a every lab) a capped lab's unallocated part of S is handed to nobody (FIN5b notes), so
  the marks add up to less than S: late 2026 S $3.65T, **Σ marks $2.48T**; start S $615B, Σ marks $495B. Half the late
  overshoot of S is the Jan 2027 mark (S $4.59T: L 8.78, Φ 1.52, hype 1.43, R $98B; Oct 2026 S $2.64T).
- *Fix (eb593d4):* FC1 reads Σ marks (S printed). Start band restated from the same sources at the game's Jul 2025
  start: OpenAI $300B (Mar 2025 [P]), Anthropic $61.5B (Mar 2025 [P]), xAI–X $113B, SSI $32B, TML $12B (R21 A8 [U]) ≈
  $0.52T; ≈ $0.64T with Anthropic's Sep 2025 $183B (where "$0.6–0.7T mid-2025" came from) → band $0.5–0.65T, check
  $450–750B. Late band kept. Glossary `sectorValue` says the marks add up to less at the cap.
- *Open (for the lead):* per dollar of revenue the game's sector is dearer than the real one. Real S/R: ≈ 36× (Jul 2025,
  R ≈ $18B) → ≈ 21× (late 2026, R ≈ $135B: Anthropic $81B [P] + OpenAI ≈ $50B [U]); Anthropic's own marks at ≥ ×8
  growth 37× ($5B) → 27× ($14B) → 20.5× ($47B) → ≈ 16–17× ($81B, IPO). So the sourced all-in elasticity of value on
  revenue over 2025–26 is ≈ 0.72–0.75, which is α (0.7) alone; the game's Φ(L) (×1.43 by late 2026) and hype (×1.34–1.43)
  come on top, so the game's S/R *rises* 31× → 43× (late 2026) → 61× (Jan 2028) where the real one fell. Σ marks/R is 30×
  late 2026 (real 21×). The game's R_sector is $84B (62% of the real $135B: its rivals earn ≈ $18B; REACH). Lead
  choices: leave (marks and the 2026 pool, π·S ≈ $100–400B/yr vs ≈ $320B raised in 2026, are in range; the cap bounds
  2027's marks), or re-fit α / φ on a split the sources do not identify (one sourced elasticity, three parameters).
  Re-anchoring (κ, α) on the real (R, S) pairs with the game's Φ and hype gives α ≈ 0.40 and S late 2026 ≈ $2.3T at the
  game's R, but the 2026 leader marks then fall to ≈ 15–19× (Anthropic 20.5–27× at that scale): not done.

### F9 FC2 slower growth 27.6× above the leader's 22.4×
- *Band:* C11 (R15 §1.9 [P][D]) "20–37× at g 5–10; ~15–20× at g 2–3", a same-date claim.
- *Diagnosis:* Simpson's paradox. Pooled over 2025–27, 38 of 53 ×2.5+ marks are 2026's (S/R 35–40×), 43 of 55 slower
  marks are 2027's (S/R 45–60×; 41 of 43 at the growth-scaled cap). Within each year slower growth **is** lower: 2026
  16.5× vs 22.1×, 2027 28.4× vs 30.4×.
- *Fix (8aaf696):* compared within each year (years with ≥ 3 marks on both sides); pooled medians printed.

### F9 FC2 trailing rivals 26.4× above the leader's 22.4×
- *Band:* FINANCE-V3 FC2 "trailing labs lower" (C11 [D]; the FIN5b guard against trailing labs at 54× and dead ones at
  80–190×).
- *Diagnosis:* scale. Trailing rivals earn ≈ $3.8B (median), the leader-style marks ≈ $47B. The sourced multiple falls
  with revenue (Anthropic above: m_A(R) = 37 × (R/$5B)^−0.28 fits Series F, G, H and the IPO within 3%), and real
  smaller labs trade above the leaders (xAI ≈ $230B on ≈ $3B, R21 [U]; SSI, TML pre-revenue). 48 of 49 capped trailing
  marks sit at capMultiple(g) × R, not the team value.
- *Fix (67ee6d2):* each mark ÷ m_A at its own revenue: trailing **×0.67**, leader-style **×1.12**: trailing labs are
  lower at matched scale. Raw multiples printed.
- *Tried and reverted:* re-anchoring the cap on C11's top pair (37× at ×10 instead of ×5; capGrowthRef 5 → 10) passes
  both raw orderings (21.3× < 22.4×, 20.4× < 22.4×) but F8 falls to 7/12 (distress at the Jan 2026 review in 5 seeds:
  the Oct 2025 marks are capped at 19–23×) and it contradicts OpenAI's 2025–26 marks at ×2.5–3 growth (30–38×, rounds
  [P], revenue [U]): C11's "15–20× at g 2–3" is its [D] half.

### FIN3a end-2027 board confidence 50.5 (≥ 55)
- *Band:* design target [D] (FIN3a rebalance: "the reference bot's board at the end of 2027 sits near 60").
- *Diagnosis:* sources per game (mean of 12): promises met +18.8 (49 met, 3 near, 0 missed of 52 judged), public
  incidents **−26.7** (3–9 public incidents a game, mostly in 2027: RH, SYC, U-modes, CONCEAL, misuse), behind −2.2,
  reversion −2.4, distress ±. Attribution: w-mkt alone 59.1 and S5R + MKT + AF2 (b2b301f) 59.1 (incidents −21.9 both);
  M10's 2eb2570 (refPlay's default safety share = RefBot's AI 2027 alignment share, so the finance stub plays S5R's
  smaller programme) → 50.5 (incidents −26.7). The 12-seed median sits in the gap between two clusters (29–48 and
  53–67: per seed 48 42 48 64 53 62 67 29 42 41 62 63), so it moves ±9 on small path changes.
- *Not fixed:* the incident hits (INCIDENT_BC) and promise sizes are [D]; re-sizing them to reach 55 would fit a design
  target. Lead / user decision: keep the target (then a sourced reason to weigh sev-1–2 incidents less is needed; 2025–26
  public incidents such as Grok's Jul 2025 posts moved no frontier board or round that the sources show, recalled), or
  restate it for the AI 2027 safety share.

### Passing but thin
- **F8 distress-free 75%** (9/12): the three distressed seeds (4, 7, 10) enter distress at the Jan 2026 review. Chain:
  the player's run-rate falls in Q4 2025 (12.6 → 11.2, 13.0 → 10.0, 19.5 → 16.3; the 12-seed median falls 16.9 → 15.5)
  and hype falls (0.93 → 0.76), the mark drops 40%, the day-184 round is a down round, runway 3 q. The real leaders grew
  in H2 2025 (Anthropic > $5B in Aug 2025 [P, Series F post] → $14B in Feb 2026 [P]). The Q4 2025 revenue dip is a
  market / model-path cause (the start models' share before the RefBot's first release), not finance's; for the market
  owners (REACH / TIERS).
- **F11 path 2027** $134.4B (98–182): central, not thin on 12 seeds.
- **LEADER_CAL slow 0.80** (`calscan.ts t1l slow`, 20 seeds, this head; T1L slow binds on SC ± 0.08 y): 0.78 SC
  +0.184 y (2.29 tol, fail) · **0.79 +0.059 (0.74, pass; was 1.06 at the FIN merge)** · **0.80 −0.012 (0.15, pass)** ·
  0.81 −0.086 (1.08, fail) · 0.82 −0.121 (1.51, fail). The window is now 0.79–0.80 and 0.80 is in its middle; it stays
  narrow by structure: the median moves ≈ 7 y of SC per unit of LEADER_CAL, so the ±0.08 y tolerance is ≈ 0.023 wide,
  and the slow preset's seeds spread ±0.15 y (p10–p90). Not changed.

## Before → after (12 RefBot seeds; no engine change, so the runs are identical)

| Check | band | before (M10 head) | after |
|---|---|---|---|
| F2 production 2027 | 45–60M | 43.4M seed 1 (fail) | median 47.1M (41.1–47.2; seed 1 43.4) |
| F7 revenue 2026 | $36–54B → $36–67B | $54.0B (fail at the edge) | $54.0B |
| F8 distress-free 2026 | ≥ 75% | 75% | 75% |
| F9 FC1 | start / late | S $615B / $3.65T (fail) | marks $495B / $2.48T (S printed) |
| F9 FC2 leader 20–37× | | 22.4× | 22.4× |
| F9 FC2 slower lower | | 27.6× vs 22.4× pooled (fail) | 2026 16.5 < 22.1, 2027 28.4 < 30.4 |
| F9 FC2 trailing lower | | 26.4× vs 22.4× (fail) | ×0.67 vs ×1.12 of m_A |
| FIN3a board ≥ 55 | [D] | 50.5 (fail) | 50.5 (fail, explained) |
| FIN6a FC2 by year | | 2026 22.1×, 2027 30.4× | same |

## Tests (this head, 67ee6d2 + notes)

- tsc main and `-p scripts/v2`: clean. lint-ux (glossary numbers, `--doc`): all pass.
- `npm run test:quick`: 34/35 scripts, 1683 passed, 2 failed (worldfx A2a 6.7%, W4 23.5%: known since F1); finance SMOKE
  lines on seed 1 as expected.
- `run.ts --tier full --only finance,worldfx` (once; 8.8 min wall, load 76%): finance all pass but **FIN3a 50.5**
  (explained above); worldfx 36 / 2 (A2a, W4, known). worldfx F7/F11 2026 $53.5B, F11 2027 $155.1B (20-seed median
  $137.2B).
- Golden dates: no engine change (all commits are checks, bands, a glossary string), so the sim is identical to M10's
  (T1 / T1L as in V3-BUILD "M10 merge notes"); `npm run test:cal` run once to confirm (result below).
