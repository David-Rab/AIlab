# MKT notes: market misses (A5 E9, F11 2027, A2c); branch `w-mkt` from master a829f0a, 2026-11-21

Principle (user, 2026-11-21): expected outcomes emerge from sourced mechanisms; a miss means a missing or mis-tuned
mechanism, never a forcing rule. Finance constants and RefBot's serving-share table are untouched.

## Probe and basis

`.mkttmp/probe.ts` (scratch, not committed) plays the worldfx classic game (RefBot, ai2027, medium, endings skipped;
the same `refDay` loop) on the 20 CAL_SEEDS and records: E9's `bandPaid` arithmetic at serving's four marks plus every
provider's tiers in V0's band, the rental market, the player's products (revenue, demand, need, cut) every 25 days, and
`workBilling` tokens on 2026-01-01 / 2026-12-31. Check: the probe on the A + C code gives exactly the worldfx full-tier
F4 spread line (F11 2027 median $86.9B [p10 72.8, p90 106.5], A2c ×8.3 [7.4–10.5]), so probe = worldfx runner.
"before" below = master a829f0a on the probe; medians over 20 seeds [p10–p90].

## Diagnosis (before)

**A5 E9 ×4.06 [2.91–5.20]** (hardware ×1.19, margin ×1.01, models bought ×3.20). The fixed-capability price of the
cheapest model on sale (A3's cheapestAt arithmetic, fpt × rental) falls ×15.8 [9.6–35.5] on the same runs: the gap is
who buys what, not what is offered.
- *Who supplies V0's band in Feb 2027* (US Software, the hardest band V0 does whole; share of the price paid): the
  player 36%, rivals with frontier models ≥ 0.25 coverage 37%, small rivals 25%, China 2%. Students are 88% of the
  band's hours, the player's API mini 12%.
- *The player sells nothing at V0's level.* RefBot's API cheap tier (A5/F5) held the previous public release's fit:
  in the 2027 takeoff that sits 0.3–0.9 OOM under the API model, ≈ 1.2 OOM above what V0's band needs (seed 2027: mini
  coverage 0.38, fit 28.67, $1.15/M vs the band's 0.083 / 27.48; the cheapest V0-level student on sale $0.07–0.17/M).
  The player keeps 0.43–0.49 of US Software's customer stock and its reach heads to 1 (A8's reach target on the mean
  sector fit; rivals' reach targets fall to 0.00–0.15), so its band buyers pay its mini.
- *Small rivals' students are big.* A rival whose model is barely above V0's band (coverage 0.16–0.18) can only distil a
  student ≈ ½ its size to hold the band (δ = 0.19 + 0.92·log₁₀(N_T/N_S)): $1.5–2.2/M, 8–9% of the band through the
  customer stock lag (CUSTOMER_TAU.sector 0.65 y; stocks 0.05–0.06 vs targets 0.03).
- *Counterfactual:* if every buyer in the band paid the cheapest whole tier on sale, E9 = ×15.5/yr; if only the player's
  buyers did, ×5.1. The rest is buyer dispersion (multi-homing reach, stock lag), A8's mechanism.
- *Hardware is not mis-tuned.* Rental per H100e $2.02 (Jul 2025) → $2.68 (Feb 2026, D/S 1.40) → $1.44 (Aug 2026) →
  $1.56 (Feb 2027, D/S 1.14, premium 0.13): ×1.19/yr. Sources: Silicon Data H100 index [P, fetched]: marketplace median
  $2.58 (H2 2024) → $1.95 (H2 2025), ×1.32/yr for a fixed chip in a glut year; hyperscaler $9.34 → $6.26. SemiAnalysis
  1-year contract $1.70 (Oct 2025) → $2.35 (Mar 2026), +40% (research/15 §2.5); Silicon Data's index $2.00 (Dec 2025)
  → $2.88 (Oct 2026) [secondary, search snippet]. The game's per-H100e rental adds perf/$ (cost −8%/q, Epoch +40–49%/yr)
  and falls faster than the real 2026 H100 market, not slower. A tight 2026–27 market (HBM sold out, LTAs, research/15
  §1.2) is sourced.
- *The band is Cottier's cheapest-offer measure.* Cottier et al. (Epoch, Mar 2025) price the cheapest model above a
  threshold (×9–900/yr); the game's equivalent is A3 (passes). For what buyers pay, OpenRouter / a16z's 100T-token
  study (arXiv 2601.10088 [P, fetched], §8) finds demand "relatively price-inelastic" (a 10% price cut adds 0.5–0.7% of
  usage) and "closed source models capture high value tasks, while open source models capture high volume lower value
  tasks": the market-weighted price lags the cheapest offer, as here.

**worldfx F11 2027 $94.6B [73.4–107.8]** (2026 $48.6B). Products are cut from Oct 2026: by day 900 API and Enterprise
are served 10–11% (need 18.6M H100e vs a 2.0M pool).
- *The serving share table is not the cause.* RefBot's compute (6.1M H100e Jan 2027 → 15.6M Dec 2027) and external
  share (0.21 → 0.13) reproduce AI 2027's table (7M → 15M; 20% → 13%; external deployment ≈ 2M H100e in 2027,
  research/02 §1.3). AI 2027 earns $140B on that: ≈ $74k per external H100e-year (2026: $45B on ≈ 1.1M, $40k). The game
  earns ≈ $57k in 2027 and ≈ $48k in 2026: the shortfall is revenue per serving H100e, which does not rise.
- *Why it does not rise:* cut segments sell at the standard tier's cost-plus (2.5 × the rental ≈ $30–34k per H100e-year
  on API / Enterprise per-hour work) however large the excess demand ($500B+/yr of Enterprise demand at day 900 vs
  $84B served). RefBot never used the existing price tiers.
- *Demand per task* (D10's τ, A4's ceiling, elasticity): not the cause of the revenue gap. Revenue is pool × earnings
  per H100e while capacity-bound; lower demand would not raise it. A4's ceiling does not bind in 2026–27 at this scale.

**worldfx A2c ×8.13 [7.56–10.92]** over 2026: agent tokens ×58 (2.8T → 165T a day), adopted ×4.7, seated ×3.1, consumer
×1.6. Agent-hours per supervising hour k rise 0.08 → 1.7–2.7 (×20), from coverage × horizon (λ(a, h50)). research/22
§7 measures tokens per human-attended hour ×15–30/yr (OpenAI reasoning tokens per organisation ×320; Google API tokens
×4.6; Google all surfaces ×20): the mechanism's intensity growth is inside the sourced range; the band ×3–8 is anchored
on Google's first-party API alone. One readout error: the token counts used the 2025 profiles (τ = 1), D10's open item.

## Fixes (one commit each)

| commit | mechanism | source |
|---|---|---|
| 0079382 | workBilling's tokens a day scale output tokens by the τ of the models bought (per provider, share-weighted per cell; agent tokens by agent-hours; the player's product and its mini). Readout only. | D10 (reasoning tokens fall with the RL recipe; "Open: tokens-a-day readouts still count 2025 profiles") |
| 2b4a189 | RefBot's API cheap tier holds the API model's fit less FREE_TIER.years × B_G_PER_Y (the A7 free-tier rule every lab's free chat tier follows), distilled once per API model; `ref:prevPublic` removed | A7 (ChatGPT's free fallback GPT-4.1 mini is an API model); Anthropic pricing page Nov 2026 [P, fetched]: Fable 5.2 $8/$40, Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0.10/$0.50 (1/40 of Opus) |
| 5afd07c | RefBot `capacityPricing` (refPlay, option `capacityPrice`, on with 'compete'): API / Enterprise at the premium tier while served < 1 ÷ PRICE_TIERS.premium of need, back to standard once served in full there. No new constant: the threshold is the tier ratio under PRICE_ELASTICITY ≤ 1 | OpenRouter elasticity −0.05…−0.07 (arXiv 2601.10088); labs price scarce capacity (Anthropic: fast mode ×2, Batch −50% [P]); AI 2027 revenue per external H100e (research/02) |

## Before → after (20 seeds, probe = worldfx runner; medians [p10–p90])

| metric | before (a829f0a) | + τ readout + cheap tier (2b4a189) | final (5afd07c) | band |
|---|---|---|---|---|
| A5 E9 price paid for V0's capability | ×4.06 [2.91–5.20] | ×5.07 [3.92–6.59] | ×4.33 [3.56–6.18] | ×6–30 |
| … hardware / margin / models bought | ×1.19 / 1.01 / 3.20 | ×1.19 / 1.02 / 4.12 | ×1.18 / 0.94 / 3.97 | |
| A3-style cheapest V0-level model (fpt × rental) | ×15.8 | ×18.9 | ×18.9 | ×6–900 |
| worldfx F11 2027 revenue | $94.6B [73.4–107.8] | $86.9B [72.8–106.5] | **$126.1B [109.6–146.4]** | $98–182B |
| worldfx F7/F11 2026 revenue | $48.6B | $48.6B | $53.0B [47.5–58.1] | $36–54B |
| worldfx A2c tokens a day over 2026 | ×8.13 [7.56–10.92] | ×8.27 (τ = 1: ×8.46) | **×7.94 [7.05–10.20]** (τ = 1: ×8.11) | ×3–8 |

F11 per seed, final vs before: 20 of 20 seeds up (+$11B … +$56B). The cheap tier alone moved F11 −$7.7B on the median
(14 of 20 seeds down, four by $14–23B): those seeds diverge in the takeoff (seed 1: rivals' public chat fit 29.3 → 33.0
over days 600–780 vs flat at 29.4 before; RefBot's Chat share 0.64 → 0.10), a path change through RefBot's extra distil
load and random draws, as F5 saw for the cheap tier (not a market mechanism: rivals distil only the main served model).

Revenue by product (player, $B/yr, medians) and served share of need, before → final:

| day | Chat | API | Enterprise | total | served API / Ent |
|---|---|---|---|---|---|
| 1 | 10.0 → 10.0 | 1.6 → 1.6 | 3.5 → 3.5 | 15.6 → 15.6 | 100% / 100% |
| 400 | 15.9 → 15.4 | 15.1 → 15.3 | 18.9 → 18.8 | 50.5 → 50.4 | 76% / 78% → 77% / 78% |
| 900 | 8.3 → 7.4 | 0.3 → 0.2 | 84.2 → 120.8 | 99.1 → 141.7 | 10% / 11% → 13% / 14% |

## What stays a miss, and why (named causes)

- **A5 E9 ×4.33.** The offered price falls ×15–19/yr (A3 passes; everyone on the cheapest whole tier: ×14.9). What
  buyers pay lags it through (1) buyer dispersion: A8's multi-homing reach and the 0.65-y customer stock keep 25–27% of
  the band's price on small rivals' large students; (2) the player's single cheap tier per product: one year below the
  API model is still ≈ 0.9 OOM above V0's band in Feb 2027 (real lineups have 3–4 tiers down to 1/40–1/80 of the top);
  (3) 5afd07c's premium tier, which prices the API's cheap tier ×1.6 while the product is cut (margin ×1.02 → ×0.94;
  E9 ×5.07 → ×4.33). The band itself is Cottier's cheapest-offer measure, which the game meets (A3); OpenRouter's
  data point the other way for the market-weighted price. Lead decision: restate E9 on a market-weighted source, or
  model per-tier prices / more than one cheap tier per product.
- **A2c** passes on the median at ×7.94 (p90 ×10.2): borderline, inside the sourced intensity range.

## Full tier after (serving, worldfx, products, finance; final code 5afd07c)

- serving 87 / 1: A5 E9 seed 2027 ×3.99 → ×3.80 (hardware ×1.23, margin ×0.99, models ×3.12); A3 ×16.7 → ×31.0/yr per
  task (×29.6 per token). products 58 / 0.
- worldfx: F11 2027 seed 2027 $89.0B (contaminated before; probe $107.6B) → **$123.1B pass**, 20-seed median $126.1B
  [109.6–146.4]; F7/F11 2026 $52.9B (pass; band top $54B); A2c seed 2027 ×7.1, median ×7.9 (pass); equity 2026 +32.6%,
  GOV T1 median 2027-12-16 (pass). Still failing, known: A2a 6.7%, W4 23.4%. A2c CY2026 non-China lab revenue $87.0B,
  leader 61%.
- finance (report only; FINREF owns it), before = FIN merge → after:
  - **F11 path 2027 $86.0B → $131.4B: passes.**
  - **F8 distress-free through 2026 66.7% → 75.0%: passes** (at the line).
  - **FIN3a end-2027 board confidence 52.2 → 59.1: passes.**
  - **FIN6a FC2 by year: passes** (2026 21.9×, 2027 30.2× over 4 marks; end-2027 valuation $2.16T → $3.67T).
  - F7 2026 revenue $47.6B → $53.2B, capex $179.6B → $179.4B, valuation $1.23T → $1.42T: pass.
  - **F9 FC1 sector value late 2026 $3.10T → $3.49T: newly fails** (band $2.5–3T): the sector value reads the labs'
    revenue (κ_S · R^α), which is higher now.
  - F2 2027 production 44.0M → 43.4M, F9 FC2 slower-growth (22.1× vs 25.3× → 21.9× vs 27.9×) and trailing rivals
    (26.5× → 26.4×): still fail (FINREF).

## Golden dates (`npm run test:cal` once, final code 5afd07c; not refitted, per brief)

T1 on the 20-seed median (Δ vs golden, y; master's FIN-merge values in brackets: ai2027 −0.003 / −0.084 / −0.055 /
+0.012, the other presets in tolerance):
- ai2027 SC +0.004, SAR −0.070, SIAR −0.014, ASI +0.019: pass.
- authors2026 SC **+0.123** (±0.08), SAR **+0.166** (±0.12): fail; SIAR −0.008, ASI +0.103 pass.
- fast SC **−0.092**, ASI **−0.167**: fail; SAR +0.030, SIAR −0.086 pass.
- slow SC +0.049: pass.
- T1L: all pass but the known authors2026 SIAR / ASI WARNs. T4 passes. golden-timelines 16 / 0.
Cause: the T1 runner (`runRef`, stub compute) plays refPlay, so both RefBot commits are in it; one-seed toggles on seed
2027 (`.mkttmp/t1.ts`) give SC 591 with the new cheap tier, with no cheap tier, and with or without capacity pricing:
the cheap tier's distil cadence and draws (as F5 measured for the old tier: SC +0.07 y, refitted then), not revenue (the
stub fixes compute). The fixtures' one-seed golden check (player SC 591 vs 638 ± 29, SAR 733 vs 791 ± 44) moves the
same way. For the merge wave: G_SC refits on authors2026 and fast.

## Tests

- tsc main + `scripts/v2`: clean.
- test:quick (final code): 32/35 scripts, 1678 passed, 9 failed: fixtures (4 stale + golden SC / SAR on seed 2027,
  above), worldfx smoke A2a 6.7% and W4 23.4% (known), serving A5 E9 ×3.80 on seed 2027 (known miss, below).
- test:cal once (above). Full tier serving, worldfx, products, finance: twice (the first, the "before", was contaminated
  for worldfx by this task's edits made while it ran, so worldfx's before values are the probe's; serving and finance
  finished before the edits and match the FIN merge notes).
