# DC-10b Build card: speed-up options row, preview lines, opposition tooltip

## What changed
- `Compute.tsx`
  - `ComputePreview` takes an optional `custom(view, whatIf)` that draws the cost and gain lines; the chip and cloud cards
    pass nothing and are unchanged. The payment line is now `PaymentLine` (one payment, optional tail on the same line).
  - `BuildLines` (grid and gas; rent keeps the default lines):
    1. capex (the action preview's line) then `repeat design saves $X` (`siteCapexParts(o).repeatSaving`, when > 0), with a
       tooltip of the building cost and the saving;
    2. one `racks for +N H100e` line for the whole campus (Σ of the preview's compute gains), `M per building live`, and what
       sets the dates (`datesSetBy`: building k is set by power when W >= B + k; all power / all construction / "power sets
       the first, construction the rest"); the tooltip lists one row per go-live quarter from the preview's gain lines;
    3. `opposition decides Qx yy` (now + permits; "now" at 0) and `block X% · delay Y%` (`oppositionOdds`); its tooltip
       (`BuildOppositionTip`) is level (`oppositionLevel`), the rows of `oppositionParts`, Blocked with `≈ $` (the cash the
       preview takes now, from `whatIf`) and Delayed with `+1 to 3 q`;
    4. the existing cash / runway line.
  - Options row (`data-lever="crash|rush|fastTrack|community"`, hidden for Rent): label, saving (`savesText`: `−N q`,
    `0 q` or `−a to −b q`) and price from `leverEffects`; each toggle has `LeverTip` (saves first / last building, price with
    its basis from `LEVERS`, crash `Opposition odds ×1.5`). The company-default line stays. State `rush` and `fastTrack` are
    live now.
  - Footer: the first of crash / rush / fast-track in bold (else "Normal build"), the rest, community package and lease
    dim after it. For Rent it is a plain label (nothing opens).
- `compute.css`: `.cac-lines > .cac-full` (a full-width line), `.cac-more.static`.
- Cleanup: glossary `siteTier` deleted (the `site` entry points at `building`), `name` / `full` removed from `SITE_TIERS`
  (nothing read them).
- The limit chips were already right (`site.mw` `100 MW–<cap>` from `siteSizeView`; lease chip unchanged).
- The known DC-10a repeat of the racks line is fixed in the UI (one campus line); `actions.ts` is untouched: its gain lines
  keep one line per live quarter, which the racks tooltip lists.
- `uitest.mjs`: one block (3 checks): Grid 1 GW, rush on changes the Grid tile's date and the preview capex by +$0.3B, and the
  rush toggle's saving equals the engine's difference of the first live quarter.
- `scripts/v2/_dc10b/shot.mjs` + `1-card.png`, `2-opposition-tip.png`, `3-crash-tip.png`.

## Engine numbers on the day-400 fixture (Gas, 1 GW, Buildings 5) next to the mockup
| | Engine | Mockup |
|---|---|---|
| Crash construction | −1 to −5 q, +$20.8B, odds up | same |
| Rush power | 0 q, +$4.5B | same |
| Fast-track permits | −1 q, +$3.0B | same |
| Community package | block ×0.5, +$5.0B | same |
| Capex / repeat design | −$74.5B / saves $10.5B | same |
| Racks | +6.8M H100e, 1.4M per building | +7.0M, 1.4M (the fixture's kW per H100e) |
| Dates set by | construction sets the dates | same |
| Opposition | decides Q1 27, block 12% · delay 35% (public ×1.18) | block 12% · delay 30% (×1.2) |
| Blocked, money lost | ≈ $3.7B (5% paid at commitment) | ≈ $1.0B (illustrative) |
| Cash / runway | $40.7B → $37.0B, 8q+ → 5.6q | $51.7B → $48.0B, 8q+ → 6q (fixture differs) |

## Differences from the mockup
- Public mood and delay odds are the engine's (see above). The opposition tooltip shows `×1.18` (two decimals), the mockup
  `×1.2`, and has no "rising" tag (no mood history).
- Lever rows show their term underline and the whole row opens a tooltip; the mockup's toggle label has the same words.

## Checks
- tsc clean (both projects), `npm run build`.
- lint-ux, lint-hidden and `test:ui`: see the report.
