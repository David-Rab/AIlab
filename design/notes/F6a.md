# F6a notes (engine half of F6; branch v3-f6a from model-v3 7983b97, 2026-11-20)

## Fixes

1. **Licensed-data slider removed** (17e972f). D1/D4 checked: `licensedShare` only added cash at launch
   (`0.1 × √engScale` $B); copyright risk reads `unlicensedPublicT`, U reads the portfolio. Removed from `BaseDesign`,
   `REFERENCE_BASE`, `baseFromParams`, `planRun` cost, the Blueprint slider, the Models base row and the glossary. Old
   saves keep an inert field (no migration).
2. **Usage data** (1bb43d5): one bug, the rest is balance.
   - Bug: `usageTokensPerDay` counted `servedH100e`, which includes headroom (spare serving 'headroom'). Now
     min(served, need). Fixture run (seed 2027, ai2027, stub): day-400 usage 116 → 62B tokens/day (chat served 188% of
     need), usage stock at day 900 26.0 → 17.9T.
   - The day-900 collapse is not a bug in the usage path. Day 1: chat need 1.22M H100e, served 65k (5.3%); total
     product need ≈ 1.6M vs a 348k pool (29% of 1.2M). Customers erode while capacity-bound, so by day 400 need is
     0.53M against a 1.0M pool (headroom). Day 900: need 27.5M H100e (×52 since day 400) vs pool 2.65M (compute ×5.3;
     RefBot serving share 0.29 → 0.13, agents 0.135, experiments 0.27). The Auto split (`servingSplit`) is greedy by
     revenue per H100e, and chat is the lowest (day 400: chat ≈ $6.7k / H100e-yr, API $23k, enterprise $36k), so chat
     gets 0.7–0.9% of its need and usage data (consumer only, `USAGE_ELIGIBLE`) falls to ≈ 3.4B tokens/day.
   - Demand plausibility: in tokens it is plausible (day 1 chat ≈ 1.2M × 1.94M output tokens/H100e-day ≈ 2.4T output
     tokens/day; research/22: Google 1.3 quadrillion tokens/month all surfaces, DeepSeek 168B output/day). In H100e it
     is high because the served model is ≈ 1T active parameters (fpt 1.8e12 at day 400): 22 output tokens/s per H100e
     vs DeepSeek-V3's 1.85k/s per H800 at 37B active (research/20 D2), i.e. about 3.5× less per active parameter on the
     assisted profile. Balance questions for the lead / F5: RefBot's serving share, the served model's size, and
     whether Auto should keep a floor for chat. Not changed here.
   - Golden: this fix moves the slow preset's SC 4776 → 4483 (−0.80 y, outside ±29 d). Likely cause: usage data has
     q 0.5 (`USAGE_QUALITY`), so fewer usage tokens raise the drawn quality (D11) and G; slow is the M3 knife-edge preset.
     Needs a refit of slow G_SC or F4's spread (not done here).
3. **Unique version names** (1c5f7dd): `uniqueVersionName` (labs.ts) appends -2, -3 … for post/IDA versions, distilled
   minis and gov/trusted/open variants. The day-900 duplicate was two distills of Atlas-4.0 (V56 day 779, V60 day 895).
   Existing saves/fixtures keep their names until regenerated.
4. **Drawn-mix domain epochs** (bf18ea0): `DataDraw.epochsD` (per domain, the most-repeated slice's drawn ÷ own tokens);
   `drawByDomain` reads it. Identical on q 1 portfolios (both fixtures); 5T q 3 CODE corpus in a 600T code/math base:
   1.54 epochs (was 0.51). Glossary `domainEpochs` updated.
5. **Auto-evaluate trigger** (8a5fbbd): `EvalRecord.recipeAt` (stacks.ts `inPlaceRecipe`: the stream's tracked recipe
   while it runs on the version, else the version's own, as G-equivalent OOM) replaces `lgAt` (true level). Trigger: the
   known recipe rose ≥ `REEVAL_DG` = 0.3 L ÷ 1.2 L/OOM = 0.25 OOM since the last suite. Only the stream changes versions
   in place. 30-day cadence unchanged. RefBot seed 2027: 0 'changed' triggers on ai2027, fast, authors2026 before and
   after (the cadence does all re-runs). EV5 test adds "true level moved, no known change → no re-run".
6. **Control off switch** (a0f3e2c, cb1e802): `safety.respond removeControl`; preview = tax saved (`controlReadout`,
   internal only, in %), security cost (miss multiplier undone), believed harmful acts/yr with the layer off
   (`controlDangerDelta`, dangerView's estimate; `Opts.control` now true / false / as is). `controlReadout.layerVersionId`
   is the target; Safety › Control has Remove control next to Add control. Add control's tax line is now in % too
   (was "−0.07 L"). Day-400 fixture: tax 7%, harmful 0.040 → 0.175 /yr at 4 sites.
7. **ref-trace** (9893d1e): regenerated with `--write` on cb1e802; diff mode runs (60 s, all within tolerance).

## Tests

tsc main + scripts clean; test:quick: all ok except fixtures (stale, expected) and worldfx's known five (F7/F11 ×2,
GOV T1, A2a, W4); test:cal: T1 slow SC fails (fix 2, above); T1L known three (authors2026 SIAR / ASI, fast ASI);
test:ui 587/0; lint-hidden ok.

Golden (T1, seed 2027): ai2027 SC 646 / SAR 803 / SIAR 880 / ASI 913 (M6 647 / 804 / 893 / 922); authors2026 1506 /
1606 / 2119 / 2942 (M6 1506 / 1607 / 2144 / 2956); fast 896 / 917 / 917 / 917 (M6 897 / 918 / 918 / 918); slow SC 4483
(M6 4776, FAIL).
