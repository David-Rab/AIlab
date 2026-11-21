# TIERS notes: multi-tier product lineups (branch `w-tiers` from master 424ed78, 2026-11-21)

Principle (user): outcomes emerge from sourced mechanisms; never a forcing rule. Finance constants, RefBot's serving
share table, A8's reach targets and the golden dates are untouched (no refit: the merge wave does it).

## Mechanism

**Lineup rule (every provider, one function).** A provider sells its model and three distilled students of it at fixed
size ratios r = N_S/N_T, the rungs `LINEUP.ratios` (data/v2/serving.ts) = 1/2.83, 1/5.66, 1/80. Each student:
- lands g = DISTILL.a + DISTILL.b·log₁₀(1/r) = 0.61, 0.88, 1.94 OOM below the model in every domain (the game's
  distillation rule, runs.ts distillBuild; coverage and agent leverage at fit − g, h50·H50_PER_OOM^−g);
- costs and prices r × the model per hour (FLOP per token ∝ active parameters; same token profile and τ, as a student
  reasons like its teacher; same markup);
- N_S ≥ 1B (PARAM_RANGE[0]); rungs the floor merges are dropped (`lineupOf`).

Code: `worldfx/serving.ts lineupOf, rungOffer, productLineup, blendTiers`; `mix.ts` builds every provider's lineup
with them; `revenue.ts` blends each product's lineup by its buyers' hours per tier.

**Sources (primary, fetched 2026-11-21; input / output $ per M tokens).** The rungs are the geometric means of the two
four-tier lineups, as prices per token relative to the top model:
- Anthropic, platform.claude.com/docs/en/about-claude/pricing: "Claude Fable 5.2 | $8 / MTok | … | $40 / MTok",
  "Claude Opus 5.5 | $4 / MTok | … | $20 / MTok", "Claude Sonnet 5.5 | $2 / MTok | … | $10 / MTok", "Claude Haiku 5.5
  (for prompts up to 100,000 tokens) | $0.10 / MTok | … | $0.50 / MTok": 1, 1/2, 1/4, 1/80.
- OpenAI, developers.openai.com/api/docs/pricing (Standard): gpt-6.2-astra $8.00 / $40.00, gpt-6.2-sol $2.00 / $10.00,
  gpt-6.1-terra $1.00 / $5.00, gpt-6-luna $0.10 / $0.50: 1, 1/4, 1/8, 1/80.
- Geometric means: 1, 1/2.83, 1/5.66, 1/80.
- Google, aistudio.google.com/docs/pricing, is narrower and has three current tiers: Gemini 4 Carbon "$4.00 starting
  December 1, 2026" / "$20.00", Gemini 3.8 Flash "$1.50 starting January 1, 2027" / "$7.50", Gemini 3.5 Flash-Lite
  "$0.30" / "$2.50": 1, 1/2.7, 1/8–1/13. Not in the rungs (a three-tier lineup); the low end of the sourced span.

The rungs are a supply-side fact (what labs put on sale); what buyers take, and so the price they pay, follows from
A5's surplus choice. Price per token ∝ active parameters across a lineup is a design assumption [D]: list prices
include margins that need not be equal across tiers.

**Choice.** Unchanged (A5 choice.ts): in each of the 8 bands of task difficulty, each provider offers its best tier by
utility (SHARE_SLOPE_G·fit + (V·x_b − p)/μ_b), shares across providers by brand, reach and that utility. New: the
player's provider tier list is every sector product's lineup (main, students, its own mini); per product, the hours on
each tier are the player's band shares on the band where that tier is the product's best (`SectorMix.playerTierW`;
`playerMiniW` is now the mini tier's entry). The product's cost, price, agent price and seat price are the hours-weighted
blend; fit, coverage and agent leverage stay the main model's (A5's convention).

**Parity.**
- Rivals and China: the same rungs under their own model, replacing A5's student per band edge (up to 8 tailored
  students each; real labs sell 3–4 tiers). Open-weights rivals too; the player's open release still sells only its
  model (hosts serve the released weights).
- The player (and RefBot): the rungs under each sector product's main model (API, Agents, Enterprise, Trusted, Gov).
  A mini of the player's own (API, A5) is one more tier. Chat is unchanged (A7's free tier, paid on the main model).
- RefBot: `cheapTier` default off. With the lineup, its extra distil of an API cheap tier (MKT) duplicated a rung;
  rivals do not distil for their lineups either. The option stays for experiments.
- No distil run is needed for a lineup student (A7's precedent for free tiers: every lab can distil, ★ P04; cheapestAt
  is "what the lab could sell"). Not charged: the distil FLOP (DISTILL_TPP·N_S tokens) is small beside a base run, and
  every provider is treated alike. Open below.

**Capacity pricing (MKT) per tier: the premium applies to every tier.** The product's price tier sets the markup of
all its tiers (rungOffer prices at the model's markup × r). Reason: the tiers share the product's serving, and at one
markup each earns the same per H100e-hour, so the scarcity rent per H100e-hour is the same whichever tier uses it; a
cheap-tier buyer the premium sends to a rival frees H100e for the backlog at the same rent. Sources: OpenAI's Fast mode
("Priority processing was renamed Fast mode on July 30, 2026") is 2× Standard across its families, minis included
(gpt-5.4-mini $1.50 / $9.00 vs $0.75 / $4.50); Google's Priority ≈ 1.8× Standard on every model down to Flash-Lite;
Anthropic sells fast mode on its top tiers only (Fable 5.2 $16 / $80, Opus 5.5 $8 / $40, 2×). Two of three apply it
to the whole lineup. Documented at ref.ts capacityPricing; no code change.

## Product UI (Products card, sector products)

A Lineup block under the serving economics: one row per tier (swatch, model or "student 1/80", fit below the main
model in OOM, price per billed hour, a share-sold bar and %). Row tooltip: active parameters and ratio, the fit gap
(distillation gap term), price, billed hours, why it sells or not. Header tooltip: tiers, hours by tier, the price tier
markup. New glossary term `lineup`; `cheapTier` and `freeTier` updated; the API mini select's empty option reads
"lineup only". Readout `ProductRead.lineup` (productView.ts) from revenue's per-tier hours and demand
(`DeploymentRevenue.tiers`). The fit gap is the rule's δ (the mini's: its work fit below the main model's).

No state change: lineups are computed, RefBot's flags are unchanged, so no SCHEMA_REV bump (stays 42).

## Measurements (probe `.tierstmp/probe.ts` = the worldfx refDay loop: RefBot, classic, ai2027, medium, endings skipped, 20 CAL_SEEDS; medians [p10–p90])

| metric | before (424ed78) | after | note |
|---|---|---|---|
| A5 E9 price paid for V0's capability (US Software, hardest band V0 does whole) | ×4.50 [3.56–6.17] | **×4.10 [2.87–4.70]** | INFO since M10 |
| … hardware / margin / models bought | ×1.20 / 0.94 / 4.02 | ×1.18 / 1.01 / 3.41 | |
| … Feb 2027 price paid, $ per M tokens | $0.48 [0.30–0.68] | $0.55 [0.45–0.94] | |
| … band hours by tier, Feb 2027: models / minis / students | 0 / 19 / 79% | 4 / 0 / 96% | |
| … the player's share of the band, Feb 2027 | 19% | 52% | |
| A3 cheapest V0-level model (cheapestAt, per token) | ×25.4 [12.1–48.3] | ×23.3 [12.4–47.0] | path only (no market input) |
| Revenue CY2026 (worldfx F7/F11) | $53.7B [48.4–58.7] | $52.6B [48.2–62.4] | |
| Revenue 2027 (worldfx F11) | $137.2B [114.6–149.4] | **$147.0B [105.4–160.2]** | |
| Served share of need, API / Enterprise, day 400 | 76% / 78% | 80% / 85% | |
| … day 600 | 10% / 12% | 12% / 15% | |
| … day 900 | 12% / 13% | **48% / 48%** | cheap tiers need less compute |
| Player's US Software hours on students, Feb 2027 | 0% (mini 26%) | 50% | |

**Decomposition of E9 (sensitivity, scratch toggle not committed):** the player's lineup alone, rivals keeping one
tailored student per band edge: **×6.26 [4.10–8.27]** (Feb 2027 $0.29/M). Rivals on the same four tiers then take it
to ×4.10. So the player's lineup raises E9 ×1.4 (its 1/80 tier does V0's band at ≈ $0.15/M where its mini sat at ≈
$1/M); parity lowers it ×0.65: a rival's 1/80 rung often covers less than V0's band (coverage 0.02 vs the band's 0.08
on a mid-size rival in Feb 2027), so its buyers there take the 1/5.7 rung at ≈ $0.7–0.8/M instead of a student sized
exactly to the band. Real lineups have the same gap between their third and fourth tiers (Sonnet → Haiku ×20, terra →
luna ×10). What remains for buyer dispersion is A8's reach (REACH task).

Seed 2027 (serving's E9 line): ×4.25 → ×3.41 (hardware ×1.26, margin ×1.07, models ×2.51); cheap tiers 90% of the
band's hours at the end.

**Finance (full tier, report only):**
- F7 RefBot 2026 revenue $54.0B → $53.4B (pass); capex $179.7B, valuation $1.34T (pass).
- **F8 distress-free through 2026 75% → 66.7% (fails, at the line):** seed 12 newly enters distress at the Jan 2026
  review (day 184), as seeds 4, 7, 10 already did. Its run-rate at 31 Dec 2025 is $17.8B → $17.4B: before the serving
  cut binds (on day 200 API and Enterprise have 4–8× their need in serving, before and after), the lineup's students
  take the easy bands at a third or less of the main model's price, so revenue per buyer falls (cannibalisation): the
  end-2025 run-rate is $0.15–0.69B lower on 10 of 12 seeds (seeds 4 and 6 flat). FINREF already noted F8 "at the line" with the same Jan 2026 review chain.
- F11 path 2027 $134.4B → $138.9B (pass); FIN3a end-2027 board confidence (INFO) 60.1; F2 46.8M (pass); F9 FC1 late
  2026 $2.63T (pass), FC2 all pass.
- worldfx full tier: F7/F11 2026 $52.3B, F11 2027 seed 2027 $168.1B (20-seed median $147.0B [105.4–160.2]), A2c ×7.4
  (median ×8.1), equity 2026 +32.3%, GOV T1 median 2028-02-09: pass. Known fails A2a 6.7%, W4 23.3% (as MKT).

## Golden dates (test:cal once; not refitted)

T1 on the 20-seed median, Δ vs golden in years (tolerance SC ±29 d, others ±44 d):
- ai2027 SC 0.000, SAR −0.080, SIAR −0.080, ASI −0.015: pass.
- authors2026 SC +0.047, SAR −0.092, SIAR −0.025: pass; **ASI +0.172 (+63 d): fail**.
- fast SC +0.048, SIAR +0.022, ASI −0.055: pass; **SAR +0.131 (+48 d): fail**.
- slow SC +0.050: pass.
- T1L: pass but the known authors2026 SIAR / ASI WARNs. T4 passes. golden-timelines 16 / 0.

Cause (not isolated per seed): the T1 runner (`runRef`, stub compute) plays refPlay, so it sees both RefBot changes:
its API cheap-tier distil is gone (one distil run per API model and its evals: the cadence and random draws F5 and MKT
measured moving SC by ±0.07 y) and the market path. For the merge wave: refit authors2026 and fast.

## Tests

- tsc main + scripts/v2: clean. lint-hidden, lint-ux (incl. tips): pass.
- serving: A5 E7 rewritten as TIERS E7 (the API's students take the easy US Software bands and lower its cost and price
  per adopted task-hour; a mini of the player's own is one more tier, hours by tier sum to 1); A5 E8 rewritten as TIERS
  E8 (parity: every provider's students are the LINEUP rungs at r × the model's cost and price, δ below its fit, the
  bottom rung 1/80 above the 1B floor). E9 comment updated.
- Full tier serving, worldfx, products, finance (once): serving 89 / 0, products 58 / 0, worldfx 36 / 2 (known A2a,
  W4), finance 191 / 1 (F8, above).
- uitest: new check "sector products show their lineup, one row per tier".

## Open

- **Older generations in the lineup.** Real price lists keep previous small models on sale (gpt-5-nano $0.05 / $0.40,
  gpt-4o-mini, Gemini 2.5 Flash-Lite $0.10 / $0.40, Haiku 4.5), which fill the gap between the third and fourth rungs.
  The game sells students of the current model only.
- **Distil cost and lag.** Lineup students appear with their main model and cost no run; real small tiers follow
  months later (Haiku 4.5 matched Sonnet 4 five months after it). A lag or a charged distil would move E9 and early
  revenue (F8). Same for rivals.
- **Usage data.** production/data.ts counts a sector product's usage tokens at its main model's tokens per H100e; cheap
  tiers serve r⁻¹ × more tokens per H100e, so usage data is undercounted (it was with A5's mini too). Not changed: it
  feeds the data portfolio, a mechanism outside this task.
- **Chat.** A7's free tier (1/12.5, 1.2 OOM) is not a LINEUP rung (between 1/5.7 and 1/80); paid users get the main
  model only. Consumer apps also let paying users pick tiers.
- **Seats** follow the blended tier mix (A5 convention); seat prices sit at the list price, so they barely move.
