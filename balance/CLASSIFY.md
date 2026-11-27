# How registry entries are classified

This is the permanent rulebook for `balance/params/*.ts`. Apply it to every new or changed entry, now and in later maintenance. It merges the inventory brief's table with the lead's rulings of 2026-11-25 (design/bal/B5-QUESTIONS.md, items A1–A10).

The principle: classification follows **evidence in the code or a cited document**, never judgement. What matters for balancing is who may move a number:
- `fitted`: the tooling may refit it against its targets.
- `sourced`: it may move only within its source's range.
- `designer` and `stand-in`: only the designer moves them.
- `derived`: it follows the numbers it's computed from.

## Kind

| Evidence | kind |
|---|---|
| `[fit]`, `[C]`, "fitted", "fit to", "refit", "calibrated against the reference run" | `fitted` (`fit.script` = the named script, else `'unnamed'`) |
| `[D]`/untagged, but the comment describes tuning the value to an outcome ("tuned so the bot ...", "solved for", "integrated RefBot play") | `fitted`, `fit.script: 'manual'`, the procedure quoted in `notes` (A5) |
| `[D]`, "design value", `[Design]`, `[R15 Design]`, `[D from <src>]`, `[D]` plus a research pointer | `designer`, with the pointer in `source` (A2) |
| The cited text (paper, data, research note) states this number: `Source:`, `[R..]`, `[V]`, `[P-r]`, `[S]`, `[R]`, a citation | `sourced` (A8a) |
| `[proxy]`, `[P-analogue]`: a measured number from an analogous setting | `sourced`, `notes: 'analogue'` (A6) |
| "stand-in", "placeholder", "rough guess", `[proxy, low]`, "once-fitted stand-in" | `stand-in` |
| The code computes the value from other constants | `derived` (A7) |
| A literal that copies another constant's value | the original's kind, `notes: 'copy of <id or file:line>'` (A7) |
| A pointer to a design doc (V2-SPEC, STRUCTURE, MODEL-V3, DECISIONS) that states the number | `designer` (A8c); if the doc doesn't state it, `untagged` |
| `[spec]`, or a prose pointer to a mechanism that doesn't state the number | `untagged` |
| No tag | `untagged` |
| Tags that still conflict after these rules, or the covered constant can't be told | `unclear`, plus a question |

**Two tags on one value (A3).** `[D]` plus a fit tag is `fitted` only if a script or target is named; otherwise it is `designer`. `[D]` plus a source follows the A2 row.

**Coverage of comments.**
- A file-header *legend* (what tags mean) is not evidence.
- A header *statement* asserting a kind or source for named values is evidence for exactly those values (A1).
- A header `Source:` line covers a value only where the cited document states that value: check field by field. Where the code adds or changes a number, it is `designer` (A1b).
- A comment directly above a table, record or one-line constructor covers every field of that construct, unless a field is named otherwise (A9).

**Grade.** Use `grade` only if stated. `[A]` after a citation is grade A.

## Layer (A10)

- `policy`: an actor picks the number. That covers bot plans, rival/China/government/public decision thresholds and choice weights, and player defaults.
- `world`: everything else, including readout-only constants (note `readout` in `notes`).

## Open items, not yet classified
- Fitted entries with `fit.targets: []` are linked to targets in B6 (the target discussion).
- Duplicated values (B5-QUESTIONS §C) are recorded with `notes: 'copy of ...'` until a refactor gives each number one home.

## Later rulings (B5 apply, 2026-11-25)
- A literal copy of an original that is itself untagged or unregistered stays `untagged`, with `notes: 'copy of ...'`. If the original's kind changes, the copy follows.
- A design-doc pointer makes an entry `designer` only when the doc states the whole value (every record of a family); otherwise it stays `untagged`.
- A research note that states the number but tags it `[D]` ("[D] calibrations") makes the entry `designer`, not `sourced`.
