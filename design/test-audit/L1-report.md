# L1: known-failure lint

`scripts/v2/lint-known.ts` (no sim, about 1 s, quick + full) checks every KNOWN registration in top-level `scripts/v2/*.ts|*.mjs`.

## Rule
- Registrations found: `KNOWN[...] = <value>` and entries of `const KNOWN* = { ... }` blocks (lib.ts and the lint itself excluded).
- Value resolved statically: string literals joined by `+`, or a file-level `const NAME = <literal>`. A dynamic value needs a marker comment on its line, `// lint-known: NAME, NAME` (used in safetyrates.ts for `KNOWN[label] = r.gap`). Anything else fails with file:line.
- Value format: `OPEN.md § <Section>: <text>`; Section is an existing `## ` heading of design/OPEN.md; the text shares a phrase of 3 consecutive words (lower-cased, punctuation ignored, at least one word of 4+ letters) with a table row of that section.

## Entries fixed
- evals.ts EV9: was `§ Bugs` -> `§ Tests` (row proposed below).
- lint-structure.ts KNOWN_LONG: `§ Bugs` -> `§ UI` (row "Action title over 4 words").
- safetyresearch.ts E1: `§ Bugs` -> `§ Safety` (row "Safety line pacing").
- serving.ts B3: `OPEN.md: BUG ...` -> `§ Market and revenue` (row "Seat price readout").
- successor.ts: `§ Balance` -> `§ Balance and calibration` (row "Successor-pull checks").
- uitest.mjs B2 -> `§ Market and revenue` (row "Agent mode's row"); R10 limits (2 entries) -> `§ UI` (row "Two registry limits").
- safetyrates.ts: PERSIST (F6 rows) -> `§ Safety` (row proposed below). MATS_GAP removed: the F5 AF-gap check passes, so it was a note, not a known failure.

## Entries without a row (lint-known fails on these two until the rows are added)
1. Tests: `| RefBot release suites wait 29-89 d in a year while the ready-date preview says 14-24 d (evals EV9: a full suite is 14 d at full staffing); staffing/queue question | Check | test-audit/G2-report.md |`
2. Safety: `| F6 persistence of SCHEME through a standard safety run stays below the sourced 0.8 (64-66% vs 80-100%; remaining removal: AG18 healing and detection at E24's true/visible ratio; closing it means a HEAL_K or detection weight below the sourced ratio, a design bet for the lead) | Safety session (KNOWN in safetyrates F6) | scripts/v2/safetyrates.ts |`

## Verified
tsc over the touched scripts clean; lint-structure, safetyresearch, serving, successor, evals, safetyrates still WARN (not FAIL). uitest.mjs only syntax-checked (text change; not run).

## run.ts job line wanted
`{ id: 'lint-known', script: 'lint-known.ts', budget: { quick: 10, full: 10 }, ...S(ALL, 10) } as Job,` (copy of the lint-structure line).
