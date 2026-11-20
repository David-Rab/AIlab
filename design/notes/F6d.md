### F6d notes (safety-node and E17 previews; low polish; branch v3-f6d from model-v3 ae9a158, 2026-11-21)

Previews only, plus one shared constant: no apply, state, schema or balance change. AUDIT-V3 items 16–18, 20–23, 26
fixed, and a new row 28 for the previews (22 of 28 fixed).

**Safety-node previews** (`models/treeActions.ts safLines`; was `0.05 × fx.saf` "alignment", a v2 meter scale that
`fx.saf` never fed: no engine code reads `fx.saf`). The line says what the node adds to the safety mechanisms, from the
numbers they use:

- a technique node (`n.technique`, data/v2/techniques.ts) unlocks its technique, shown by role: "+1 detector · detects
  by coverage: Alignment faking 1, Scheming 1, Concealment 0.8" (the top three of the coverage the detection code
  weights, also stored on the lab's technique state), "+1 control protocol · contains by coverage: …" for AG07
  containment, "+1 training fix · run option: <the node's stated effect>" for fixes; a technique with no coverage
  (T-GATE) gives its stated effect;
- a research-line node's odds are the line's estimated chance per result (`nodeOdds`, the posterior mean), so its target
  ends "(odds per result)";
- P25 gives "+0.5 defence levels · weight security against theft": `P25_DEFENCE`, now exported from
  `security/theft.ts` and used by the theft hazard;
- any other node with a safety upside its stated effect ("+1 safety effect · …": P14, P15, P27, aar, kyc, P01 …);
- `fx.saf < 0` is exposure "+1 safety risk · <stated risk>" ("when used: …" for an option node).

**E17 "Red flags"** (`events/catalog/safety.ts`):

- *Continue*: the "alignment 0.2 · red flag ignored" cost (never applied) and the "trust −10 if it leaks p 20%" exposure
  (made up: a leak is the E19 decision) are gone. Its cost is what it does: it counts one red flag, which feeds the
  whistleblower hazard (`security.ts whistleHazard`), shown as "1 red flag · odds of a staff leak to the press 39% →
  53% a year" (`whistleOddsYear` = 1 − (1 − h)^365 at today's morale, with one more flag; with a whistleblower channel:
  "staff concerns go to your whistleblower channel (handled internally)"). With a live pause pledge, the pledge's own
  break cost (`breakCost.credibility`, and trust as `trustDelta` applies it, mean over the audience) replaces the flat
  "credibility 20". No new mechanical cost.
- *Continue + control*: the flat "5% control tax" is E6's protocol tax (`controlReadout`, as Safety › Add control); it
  also costs the red flag it counts (it always did, unshown); "alignment 0.1" → "+N internal deployments · control
  layer on".
- *Pause & investigate*: "alignment 0.2" → "+1 investigation · of the flagged trait by 20 safety research engineers
  (none for an understanding flag)"; the "credibility +2" gain was never applied: removed.

**Polish** (AUDIT-V3): 16 danger chip "acts/yr" on products, lanes keep "/yr" with "danger acts/yr" in the column head
(width); 17 "19 h · needs 4 h"; 18 "tasks 2 h · verifiable 0.8"; 20 bands "± 0.14 L", "Suites · full eq." head, bench
noise "± 3.0 pt"; 21 "Hacking pressure S2 … max 1" (empty space below the six suites justified); 22 "spec. OOM" on
the drawn-mix row, the seven Blueprint tiles top-aligned (a 4 + 3 grid was tried: wider tiles, as empty); 23 the
"why here" text wraps, same-specialty teams numbered; 26 a "gets / needs · team-eq" head on the needs lists.

Tests: `uitest.mjs` F6d check: T-DECEPT's preview is a detector whose listed coverage equals the lab's technique state
(what detection reads); P25 previews 0.5 defence levels; no tree preview carries a unitless alignment line. D8 band
checks now expect "± x L". lint-tradeoffs, lint-hidden, lint-ux pass.

Left (lead): the lane danger chip still says "/yr" only (width); other events with `alignment` placeholder amounts
were not in scope (`safety/actions.ts` respond previews "alignment est × 0.3 / × 0.5"; f6a-owned file).
