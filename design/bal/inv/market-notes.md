# Market chunk inventory notes (B3, prefix `mkt`, `balance/params/market.ts`)

346 entries (336 export, 10 inline). Helpers `one`/`grp` in the file expand to plain Param records. Area is `market` for serving, sectors, buyers, tools, compute market and sites. It is `finance` for deals, debt, leases and the parent budget, `research` for teams and production, `worldfx` for labour and employment constants, and `core` for starts.

## Questions

| id | question | evidence |
|---|---|---|
| Q-market-1 | Convention for `[D from P]`, `[D from R22]` and `[Design]` plus a research pointer. I tagged these `designer` and put the citation in notes. Should they be `sourced`, `designer`, or a new "designer value anchored on a source"? Affects `SEATS.start`, `CUSTOMER_TAU.sector`, `MULTI_HOMING.*`, `CONSUMER_MKT.reach.startUS`, `TOKENS.assisted`, `SAF_ROLE_SHARE`, `QUALITY.*`. | serving.ts:67 "[D from R22 4e–4g]", :166 "[D from P]", :176, :192; teams.ts:12 "(research/19 §1.1) [Design]" |
| Q-market-2 | `SECTOR_WORK[*].v` (verifiability): the classes cite R20 E3, but the sentence closes with `[D]`. Sourced or designer? Registered `unclear`. | serving.ts:29-32 "verifiability v (R20 E3 classes: code with tests 0.9, ...) ... [D]" |
| Q-market-3 | `SECTORS[*].use` mixes values from the RPS survey with `[D]` values for sectors the survey does not cover. Per-record provenance is not recorded in code. Registered `unclear`. | sectors.ts:22-27 |
| Q-market-4 | `REGION_SCALE`: `[spec]` is not in the tag legend (ROW emp 6, ROW wage 0.5), so these are `untagged`. The CN/ROW `use` 0.6 has a `[P: Anthropic Economic Index]` that backs a check, not the value. Registered `unclear`. | sectors.ts:65-68 |
| Q-market-5 | `ECON.hireSlope` is "a once-fitted stand-in" (both words), after R16 gave 1.5 "[D, no source]". Fitted or stand-in? Registered `unclear`. | sectors.ts:128-133 |
| Q-market-6 | `LARGE_SHARE.EDU` 0.871 is `[P]` plus the designer's Education rule. Registered `unclear`. | market.ts:34-36 |
| Q-market-7 | `PRODUCT_TOOLS` field families (`buildTW`, `cash`, `fx[*].dG`, `fx[*].tokens`, `fx[*].share`, `afford`) mix `[P]`, `[D]`, `[D stand-in]` and untagged values across the 12 records, with the tag in a comment above each record. A per-record split is needed for rebalancing (e.g. coding SOFT dG 0.3 is `[P]` inside 0.24-0.46; SCI 0.1 is `[D]`). Registered as families, mostly `unclear`. | tools.ts:111-116, 128-130, 144-147, 155-158, 167-170, 195-200, 231-234, 246, 263, 280 |
| Q-market-8 | Difficulty labels in `STARTS[*].difficulty`: the win-rate thresholds (>=30% Easy, 10-30% Medium, 1-10% Hard, <1% Impossible) exist only in a comment, not as code constants, so I could not register them as numbers. Should they become named constants before the ladder work? | starts.ts:20-23 |
| Q-market-9 | `RATING_SPREAD_BP`, `REVOLVER_SPREAD_BP`, `CHIP_LOAN_SPREAD_BP`: the anchor values are `[R15]` but the by-rating mapping (BB/B, "closed") is `[D]`. One entry per table, `unclear`. Split per rating? | deals.ts:83, 85, 87 |
| Q-market-10 | `PARTNER_TERMS.strings.ipCloseYr` (10% a year of lead closed): the `[R21 B4]` cite follows the FTC quote about Microsoft's OpenAI rights, not the 10%. Registered `designer`. | deals.ts:69-74 |

## Skipped

Every `balance/coverage.txt` line in this chunk's files that is not registered as an export entry:

- `src/data/v2/sectors.ts:173 USE_ANCHORS`: "display only; no mechanism reads them" (sectors.ts:166).
- `src/data/v2/sectors.ts:183 USE_ANCHOR_US`: display-only survey anchors.
- `src/data/v2/serving.ts:284 SERVE_HOURS_PER_YEAR`: unit conversion (24 x 365.25).
- `src/engine/v2/production/ces.ts:60 Z999`: not exported; registered as an inline entry `mkt.ces.Z999`.
- `src/engine/v2/production/dataActions.ts:56 LICENSE`, `:105 SYNTHESIZE`, `:151 USAGE`: action definitions (code), not parameters; their numbers live in `data/v2/dataAssets.ts` (another chunk).
- `src/engine/v2/production/production.ts:325 productionSystem`: a function.
- `src/engine/v2/production/readout.ts:21 RESPONSE_SCALES`: chart x-axis scales (UI).

Also not registered (not in coverage, not balance numbers): `data.ts` and `dataView.ts` have no tunable literals beyond unit conversions (1e12) and display thresholds (1.5x even share, 0.5 cumulative cut-off in dataView.ts:79,85). The enum-like `START_SPECIALTIES`, `COLUMNS` and the `shipped` launch dates in `PRODUCT_TOOLS` are ids and dates.

## Inline overflow

Beyond the 10 inline entries registered, these are notable but were left out (the cap was not reached; they are structural or display):

- `src/engine/v2/production/production.ts:154` `wH > 0.5`: label threshold for human-bound vs labor-bound (readout label only).
- `src/engine/v2/production/ces.ts:28-29` Abramowitz-Stegun erf coefficients (maths constants).
- `src/engine/v2/production/ces.ts:37` `-50, -1e-9` bisection bracket (loop guard).
- `src/engine/v2/production/dataView.ts:79` `1.5 / DOMAIN_IDS.length` and `:85` `cum >= 0.5`: wording thresholds in a UI summary.
- `src/data/v2/deals.ts:104` `firmDiscount`: the 16 and 8 quarter cut-offs (`quarters >= 16 ? ... : quarters >= 8`) mirror `FIRM_TERMS` (2 y and 4 y) but are separate literals.
