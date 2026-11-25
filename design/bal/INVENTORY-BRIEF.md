# Parameter inventory: shared brief (B3)

Every B3 agent reads this whole file first. Your task prompt only names your chunk.

## What you are doing
You fill one file of the **parameter registry** for the AI27 simulation game. The registry *points at* the game's existing numbers and records what each one is and where it comes from. It never changes the game. Later tooling uses it to rebalance the game automatically, so accuracy matters more than speed: a wrong `kind` or a made-up source is worse than `untagged`.

Worktree: `C:\Users\david\Documents\projects\AI27-bal` (branch `bal`). Dependencies are installed.

Read before starting:
1. `balance/schema.ts`: the `Param` type. Follow it exactly.
2. `balance/params/capability.ts`: worked examples of every ref shape. Copy the style.
3. `design/bal/REGISTRY-DESIGN.md` §3 (granularity and scope rules).

## Your output
- `balance/params/<chunk>.ts` exporting `PARAMS_<CHUNK>` (upper case, `-` becomes `_`) via `defineParams([...])`. Exception: chunk `capability` appends to the existing file and keeps its 8 examples.
- `design/bal/inv/<chunk>-notes.md` with three sections:
  - **Questions**: table `id | question | evidence` (ids `Q-<chunk>-1`, ...).
  - **Skipped**: every `balance/coverage.txt` line in your files that you did not register, with a reason of a few words.
  - **Inline overflow**: notable inline literals beyond your cap (file:line, one line each).
- Write nothing else. Make **no changes under `src/`** or to other agents' files. Don't commit.

## What to register
1. **Named constants.** Your checklist is the lines of `balance/coverage.txt` whose file is in your chunk. Each one gets registered or listed under Skipped. When you register a symbol, register **all** of its balance-relevant fields, not one (the coverage check counts a symbol as covered once any field is registered).
2. **Granularity.**
   - One entry per named scalar.
   - Objects of named parameters (different meanings per key): one entry per key, with `path`.
   - A uniform small table (same meaning across keys, e.g. a value per size class): one entry, `value` as an array in key order, as `cap.EFFORT_TM` does.
   - Arrays or tables of records (tech nodes, agendas, sectors, deals, events): one entry per numeric field *family* with `path: ['*', '<field>']` and no `value`. Note in `evidence` whether records carry their own source (e.g. a `src` or `cite` field).
   - Per-preset bundles: one entry per preset and field, `perPreset: true`.
3. **Notable inline literals** in engine formulas: coefficients, thresholds, rates, caps and probabilities that a designer could plausibly tune. Use an `InlineRef` whose `anchor` is an exact code snippet that occurs **once** in the file (make it long enough to be unique). **Skip** 0, 1, -1, 2 used structurally, 365/7/30 calendar conversions, unit conversions (1e9 and the like), array indices, UI and formatting numbers. Cap: 40 inline entries per chunk; list the rest under Inline overflow.
4. **Skip:** glossary prose, UI-only numbers, test fixtures, types-only files, pure enums and ids, seeds, and numbers that only set loop guards or array sizes.

## How to set `kind` (mechanical: use evidence, never judgement)
Look at the constant's own comment, then a block comment directly above a group that clearly covers it. A file-header tag legend is **not** a tag for any constant.
| Evidence | kind |
|---|---|
| `[fit]`, "fitted", "fit to", "refit" | `fitted` |
| `[D]`, "design value", `[Design]`, "designer" | `designer` |
| `Source:`, `[R20 ..]`/`[R16]`-style research pointers, `[V]`, `[P-r]`, a cited paper, dataset or report | `sourced` |
| "stand-in", "placeholder", "rough guess", "TODO calibrate" | `stand-in` |
| The value is computed in code from other constants, or the comment says derived, "median of", "chosen so that X = Y" from other values | `derived` |
| No tag | `untagged` |
| Two tags that conflict, or you can't tell which constant a group comment covers | `unclear`, plus a question |

Rulings from wave 1 (apply them):
- A file-header *legend* (a list of what tags mean) is not evidence. A header *statement* that asserts a kind for the file's values ("every numeric parameter is a [D] value", "s0 and coverage are [D]") is evidence for the values it names. Quote it.
- `[C]`, "calibrated against the reference run", or "tuned so the bot ..." → `fitted` (script `'unnamed'` if none is named).
- `[D from <source>]`, or `[D]` plus a research pointer → `designer`, with the pointer in `notes`.
- Both a `[D]` and a sourced tag on the same value → `unclear`, plus a question.

- `evidence`: the short quote plus file:line that made you choose the kind. For `untagged`: `"no tag; <file>:<line>"`.
- `source`: only for `sourced`, copied as the code states it (a citation or `research/..` pointer). Never add a source the code doesn't name.
- `fitted`: `fit.script` = the script the comment names, or `'unnamed'`. `fit.targets` = `[]` unless the target is one of the ids already in `balance/targets.ts`. Put the comment's description of what it is fitted to in `notes` (the lead links targets later).
- `range`: only if a comment or a cited note states a range for this value. `from` = where. Never invent one.
- `grade`: only if stated.

## Other fields
- `id`: `<prefix>.<SYMBOL>[.<path>]` for exports, `<prefix>.<file-stem>.<shortName>` for inline. Prefix = your chunk's prefix (given in your task). Ids must be unique; before adding, grep `balance/params/` for the symbol to avoid duplicating another chunk's entry.
- `area`: from the schema's list, by what the number is about (not by folder).
- `layer`: `policy` if the number only changes what an actor *chooses* (bot plans, rival or China or government decision thresholds, a bot's research list). `world` if it changes what *happens* (rates, costs, effects). If it's unclear, use `world` and add a question.
- `actor`: whose behaviour or state the number describes (see the schema comment). Omit it for world-wide physics.
- `unit`: when the comment or name makes it clear; otherwise omit.
- `notes`: one line, only when useful.

## Checks before you report
- `npm run registry:lint -- --area <chunk>` exits 0. Fix every error it reports in your own file. If an error comes from another chunk's file, ignore it and mention it.
- Don't run the lint without `--area`: a full run rewrites the shared `balance/coverage.txt` checklist while other agents are using it.
- Booleans are allowed as `value`. A non-exported constant registered as an `InlineRef` whose anchor contains `const NAME` counts as covered, so don't list it under Skipped.
- `npm run typecheck` passes.
- Every coverage line in your files is either registered or listed under Skipped.

## Context and time
- Keep your context small: Grep and read line ranges; don't read whole large files at once. Work file by file and write entries as you go, rather than collecting everything in memory first.
- Time budget: 60 minutes. If you are near it, stop at a file boundary, make sure the lint passes on what you have, list the files not done in your notes, and report.

## Report back (at most 15 lines)
- Entry counts: total, by `kind`, by `layer`, number of inline entries.
- Number of coverage lines registered and skipped.
- Number of questions, and the 3 most important in one line each.
- The last line of the lint and typecheck output.
- Files not done, if any.
