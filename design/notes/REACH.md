# REACH notes: reach collapse toward the leader (branch `w-reach` from master 424ed78, 2026-11-21)

Principle (user): outcomes emerge from sourced mechanisms; never fit to a revenue target. No constant changed
(MULTI_HOMING, SHARE_SLOPE_G, CUSTOMER_TAU, adequacy untouched); the reach target's *shape* is fixed to the mechanism
A8 itself states ("firms add the labs whose models are best ... MULTI_HOMING.providers of them per firm").

## Probe and basis

`.reachtmp/probe.ts` (scratch, not committed) plays the worldfx classic run (RefBot, ai2027 econ, medium, endings
skipped, the `refDay` loop) on the 20 CAL_SEEDS to day 913 and records at days 1 / 184 / 400 / 488 (1 Nov 2026) /
548 / 700 / 900: per region every provider's reach stock and target, mean sector fit, sector spend (hours × price +
agent-hours + seats at the customer stock, `providerSectorRevenue`) and its decomposition; `sectorRunRate` (finance's
R_sector); rivals' `revenueRun` and demand-side market revenue; CY2026 / CY2027 revenue. "Before" = master 424ed78
(a `git archive` extract); medians [p10–p90]. "Closed rivals" excludes open-weights providers and China.

## Sources (fetched this session)

- Ramp AI Index (ramp.com/data/ai-index, data to Oct 2026) [P]: "Adoption: The share of businesses with an observed
  payment for an AI product or service in a given month." Oct 2026: all businesses 56.8%, Anthropic 44.8%, OpenAI
  40.6%, xAI 6.3%, DeepSeek 0.2%, Mistral 0.2% (no Google row: Ramp's "fairly narrow definition of 'AI vendor'").
  The vendor rows sum to 92.1 points against 56.8 paying any: ≥ 1.6 of these vendors per paying firm [D]. Among
  paying firms: Anthropic 0.79, OpenAI 0.71, xAI 0.11 [D]. Token-spend share (week to 15 Nov 2026, AI Spend
  Management users only): Anthropic 58.7%, OpenAI 37.2%, xAI 2.4%, Google 1.4%.
- Ramp, "AI business adoption accelerates, led by Anthropic" (19 Nov 2025) [P]: Oct 2025 all 44.8%, "Anthropic grew
  adoption 2.1 percentage points to 14.3%", OpenAI "landing at 35.8%" (paying firms: OpenAI 0.80, Anthropic 0.32
  [D]); Ramp changed its vendor method in Jun 2026 ("We made methodological updates to better track AI adoption
  across vendors"), so 2025 and 2026 levels are not strictly comparable.
- Ramp AI Index June 2026 [P]: "Finding 3: No vendor lock-in. AI-pilled firms use multiple AI vendors."
- Menlo Ventures, "2025: The State of Generative AI in the Enterprise" (9 Dec 2025) [P]: "Anthropic now earns 40% of
  enterprise LLM spend", OpenAI 27%, Google 21%; "these three companies account for 88% of enterprise LLM API usage";
  coding: Anthropic 54%, OpenAI 21%.
- Menlo, "2025 Mid-Year LLM Market Update" (31 Jul 2025) [P]: Anthropic 32%, OpenAI 25%, Google 20% of production
  usage; "Only 11% of teams report changing model providers in the past year", "66% upgraded to newer models from
  their existing vendor"; "Switching between vendors is relatively easy, but increasingly rare."
- a16z, "How 100 Enterprise CIOs Are Building and Buying Gen AI in 2025" (Jun 2025) [P]: "37% of respondents are now
  using 5 or more models"; "model differentiation by use case has become increasingly pronounced and is the main
  reason enterprises buy models from multiple vendors"; "the rise of agentic workflows has started making it more
  difficult to switch between models".

## Diagnosis (before)

A8's target was R* = min(access, 2·w ÷ Σw), w = brand × access × exp(SHARE_SLOPE_G·(f̄ − best)) on the mean sector fit.
That is a with-replacement share of two slots, capped at access. Two faults in the shape, neither in the constants:

1. **The leader's excess is thrown away.** Once 2·w_lead ÷ Σw > 1 (a 0.4+ OOM lead with brand 1.2 already does it),
   the leader is capped at 1 and the rest of the second slot is lost: Σ R* over closed labs = 1 + 2·(1 − p_lead) ≈
   1.2–1.6 instead of 2. A firm that ranks the leader first still has a second contract; it goes to the best of the
   others. Day-1 targets (20 seeds): leader 1.00, best rival 0.18 [0.13–0.24], second 0.14 [0.10–0.16]; at 1 Nov 2026
   1.00 / 0.14 / 0.04 (lead 0.60 [0.36–0.98] OOM over the best rival, ≈ 6 months at B_G_PER_Y 1.2).
2. **A barely reachable leader takes everyone's contracts.** w carries access, so when China's closed model leads by
   OOMs (US access 0.05; seed 2027 day 900: fit 37.5 vs 32.2), Σw ≈ w_china and every other lab's R* ≈ 0, so the 95% of
   US firms who cannot buy from China were left with no provider at all (all US targets 0.00 on seed 2027; 20-seed
   day-900 median leader target 0.07 [0.00–1.00]).

A third, smaller fault: a lab whose public model is open weights has reach = access (1); that value was stored in
`fx.secReach` and carried into its next, closed release, which then decayed from 1 over τ = 3 y (6 of 20 seeds have a
rival open at the start; day-184 Σ closed reach 2.39 [1.94–3.65], best rival's reach 0.66 [0.40–0.92]).

Steepness, adequacy and the band logit are not the cause of the collapse: adequacy and the band choice do not enter
the target; SHARE_SLOPE_G (4 per OOM, V4's [D]) on the mean fit is the ranking, and with the shape fixed a lab 0.5
OOM behind still holds most firms' second contract while one 1.5 OOM behind holds almost none.

Specialisation by task (a16z's main reason for multiple vendors; Menlo's coding 54% vs 40% overall) has no carrier
in the game: the fit gaps between providers are identical in all 14 sectors at every mark (fit reads one G per model;
the domain profile does not enter it). A per-sector reach would therefore change nothing now.

## Mechanism change (commit 4612959)

- `reachTargets` (worldfx/mix.ts): a rank-ordered logit (Plackett–Luce). Each firm can buy from provider i with
  probability access_i, independently (as the sector choice sets already assume), and contracts with the
  MULTI_HOMING.providers (2) labs it ranks best among those, without replacement, ranked by the same V4 quality logit
  (ln brand + SHARE_SLOPE_G·(f̄ − best)). R*_i = P(i is among a firm's picks), exact over every access combination and
  pick order. Σ R* = 2 when two or more labs are reachable. Cost ≈ 40 µs per tick for the three regions (bench under
  load; < 1.5% of a 3–4 ms tick).
- `advanceCustomers`: open-weights providers' reach is not stored (it is their access, every cloud hosts them), so a
  lab's first closed release starts at A8's even spread, not at its open-weights access.
- Unchanged: MULTI_HOMING { providers 2, tau 3 y }, the even-spread start, SHARE_SLOPE_G, CUSTOMER_TAU, A5's band
  choice and adequacy.
- Player read: glossary `targetShare` ("each buys from the two frontier labs it rates best among those it can buy
  from, so the runner-up still gets the second contract at most firms"); data comment on MULTI_HOMING.
- Test: serving "REACH" (Σ reach = 2; the runner-up 0.5 OOM behind ≥ 0.35; even fits 0.4 each; 1.5 OOM behind < 0.05;
  an access-0.05 leader leaves the others Σ = 2 − 0.05; the start US targets sum to 2).

## Reach and shares, before → after (US; 20 seeds, worldfx runner; medians [p10–p90])

Reach = share of sector buyers who buy from the lab at all; Ramp's comparable is the share of paying firms.

| day | leader reach target | best / 2nd rival target | reach stocks: leader; rivals #1–#4 | US spend share: leader / all closed rivals |
|---|---|---|---|---|
| 1 | 1.00 → 0.97 | 0.18 / 0.14 → 0.43 [0.34–0.63] / 0.32 | 0.45; 0.45 0.45 0.40 0.40 (start, unchanged) | 0.55 / 0.42 (unchanged) |
| 400 | 1.00 → 0.89 | 0.50 / 0.20 → 0.60 / 0.32 | 0.58 → 0.57; 0.58 0.40 0.37 0.34 → 0.47 0.42 0.37 0.34 | 0.59 / 0.39 → 0.58 / 0.39 |
| 488 (Nov 2026) | 1.00 → 1.00 | 0.14 / 0.04 → 0.55 [0.41–0.85] / 0.30 | 0.60 → 0.59; 0.57 0.41 0.35 0.32 → 0.47 0.41 0.35 0.32 | 0.82 / 0.17 → 0.81 / 0.18 |
| 700 | 1.00 → 0.97 | 0.43 / 0.04 → 0.71 / 0.21 | 0.67 → 0.66; 0.49 0.35 0.32 0.28 → 0.48 0.39 0.31 0.28 | 0.68 / 0.29 → 0.65 / 0.33 |
| 900 | 0.07 [0–1] → 1.00 | 0.00 / 0.00 → 0.95 / 0.01 | 0.68 → 0.71; 0.46 0.34 0.28 0.23 → 0.53 0.37 0.26 0.23 | 0.67 / 0.29 → 0.67 / 0.30 |

Against the sources:
- **Targets now have the measured shape**: late 2026 leader 1.00, runner-up 0.55, third 0.30 vs Ramp's paying-firm
  reach 0.79 / 0.71 / 0.11 (Oct 2026). Before: 1.00 / 0.14 / 0.04. The game's runner-up sits lower than OpenAI because
  it is 0.6 OOM (≈ 6 months) behind, where OpenAI and Anthropic are near peers.
- **Stocks are flatter than Ramp's** (late 2026: 0.59 / 0.47 / 0.41 / 0.35 / 0.32): they start at the even spread (0.4)
  and move at τ = 3 y, so in 2026 they are still near the start. Σ closed reach 2.13 [2.00–2.53] (new labs start at
  the even spread while the others have not yet fallen).
- **Spend shares**: day 184 (≈ Dec 2025) leader 0.43, best rival 0.24 vs Menlo's 40 / 27 / 21 (in range); late 2026
  leader 0.81 vs Ramp's token-spend 0.59 / 0.37: too concentrated, and not through reach (next section).

## Revenue effects (20 seeds)

| | before | after | real |
|---|---|---|---|
| sectorRunRate, 1 Nov 2026 (finance R_sector) | $80.8B [64.1–94.9] | $80.9B [64.1–94.5] | ≈ $135B (Anthropic $81B [P] + OpenAI ≈ $50B [U]) |
| … 31 Dec 2026 | $97.1B | $96.5B | |
| rivals' revenueRun late 2026 | $40.6B [28.5–59.5] | $40.3B [27.8–59.0] | OpenAI alone ≈ $50B run-rate Sep 2026 [U] |
| rivals' demand-side market revenue, 31 Dec 2026 | $80.4B | $83.2B | |
| CY2026 player / rivals' market / total | $53.7B / $41.9B / $99.4B | $53.5B / $41.9B / $100.7B | R22 §4: $100–130B |
| CY2027 player (F11) / rivals' market | $137.2B / $94.2B | $136.8B / $101.9B | F11 $98–182B |
| player run day 90 → 184 (F8's Q4 2025 dip) | 16.7 → 15.4 | 16.7 → 15.3 | |

The reach fix does not move 2026 revenue: the rivals' reach *stocks* in 2026 were never collapsed (0.32–0.57 by Nov
2026, the start spread decaying at τ 3 y); the collapse was in the *targets* and would have bitten in 2027–28. Rivals
gain ≈ +8% in 2027 (market revenue).

**Why rivals earn little in late 2026 (named causes, not changed here):**
1. *Agent spend × the capability gap.* On 1 Nov 2026 (US) the leader has 0.41 [0.35–0.49] of adopted hours and the
   closed rivals 0.49 [0.42–0.57], but the leader's spend per unit of hours share is ×7.5 the rivals' ($213B vs $28B);
   agent-hours are 83% of the leader's spend and 43% of the rivals'. Agent-hours per supervising hour rise with
   coverage × horizon (A2c's λ(a, h50)), and the leader is 0.60 [0.36–0.98] OOM ahead of the best rival and 0.93 OOM
   ahead of the second: AI 2027's scenario, where the real 2026 labs are near peers.
2. *Rivals' revenueRun lags their market.* It closes half its gap to market revenue each quarter (RIVAL_REVENUE_TRACK
   0.5, [D, M4]): late 2026 run $40B vs market $61–83B, and finance's R_sector reads the run. Rivals' market revenue
   is demand-side (not bound by their compute).
3. *The leader's unserved demand stays with the leader.* Its demand-side US spend is $78B on 1 Nov 2026 against a
   world run-rate of $63B: most of it unserved (compute-bound). Multi-homing firms would route work to their second
   provider when the first is rate-limited; the game keeps the share with the leader.

## Checks moved

- serving (full): 89 / 0 (REACH new). A5 E9 ×4.38/yr seed 2027 (INFO since M10; MKT ×3.80–4.33).
- worldfx (full): 36 / 2 (A2a 6.7%, W4 23.4%: known since F1). F7/F11 2026 $53.6B (FINREF $53.5B); F11 2027 seed 2027
  $154.1B (FINREF $155.1B), 20-seed median $136.8B [113.5–149.8] (was $137.2B); A2c ×7.9; GOV T1 median 2027-12-19;
  A2c CY2026 non-China frontier-lab revenue $88.8B, leader 60.3% (M10: $87.0B, 61%).
- finance (full): all pass. F2 median 46.9M (47.1M); F7 $54.2B (54.0); **F8 distress-free 75.0% (unchanged, at the
  line)**; FC1 marks late 2026 $2.52T (2.48), S $3.68T; FC2 leader 22.2× (22.4); FIN3a 50.5 INFO (per seed 48 42 48
  55 53 62 75 29 42 42 62 63; FINREF 48 42 48 64 53 62 67 29 42 41 62 63); F11 path 2027 $134.8B (134.4).
- F8's thin seeds: the Q4 2025 run-rate dip is the start model being overtaken by rivals' first releases (the
  player's fit lead over the best rival is −0.26 [−0.46…−0.03] OOM on day 184) before RefBot's first release; reach
  does not change it.

## Golden dates (`npm run test:cal` once; not refitted)

**49 pass, 0 fail**, the 9 known WARNs (T1 A1 / A2; T1L authors2026 SIAR / ASI); 10.7 min wall, load 78%. T1 20-seed
medians (Δ vs golden, y), as FINREF's (ai2027 −0.037 / −0.082 / −0.062 / −0.007):
- ai2027 SC −0.037, SAR −0.082, SIAR −0.062, ASI +0.004.
- authors2026 SC +0.051, SAR −0.088, SIAR −0.027, ASI +0.086.
- fast SC +0.008, SAR +0.093, SIAR −0.021, ASI −0.099. slow SC +0.049.
- T1L: all pass but the known authors2026 SIAR / ASI WARNs (slow SC 4775 vs 4758 d). T4 passes (3.1–8.4 months).
  golden-timelines passes. No refit needed.

## Tests

- tsc main + `-p scripts/v2`: clean.
- `npm run test:quick`: 33/35 scripts, 1680 passed, 6 failed, all expected: fixtures stale (4; the golden SC / SAR
  fixture checks pass), worldfx smoke A2a 6.7% and W4 23.4% (known).
- `run.ts --tier full --only serving,worldfx,finance`: once (above).
- `npm run test:cal`: once (above).

## Open questions for the lead

1. **Reach slope.** The ranking uses SHARE_SLOPE_G (4 per OOM, V4's [D]). The sources measure near-peer labs only, so
   they cannot identify how fast firms drop a lab that is 6–12 months behind. Kept.
2. **Specialisation.** The sources' main reason for multiple vendors is differentiation by use case; the game's fit
   has no per-lab task profile (gaps identical across sectors). Per-lab domain profiles in fit would be the carrier,
   and then a per-sector reach.
3. **Capacity spill-over** (cause 3 above): the next candidate mechanism for rivals' 2026–27 revenue and for VAL.
4. **RIVAL_REVENUE_TRACK 0.5** ([D]) halves rivals' revenue in a fast-growing market (cause 2); finance's R_sector,
   the investor pool and FC1 read it.
5. **Reach start and speed.** Stocks start at the even spread and move at τ 3 y, so late-2026 reach is flatter than
   Ramp's. A new lab starts at the even spread too (A8; through cloud marketplaces, 44–47% of Anthropic's revenue
   [P, research/22 §4], a new model is buyable at once). Kept.
