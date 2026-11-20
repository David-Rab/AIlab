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

### F6e notes (Respond and Investigate previews; branch v3-f6e from v3-f6d, 2026-11-21)

`safety/actions.ts` Respond previews now state what `applyResponse` does, from the same constants and helpers, on
believed values only (beliefs, measured levels, believed strengths and efficacy). Shared numbers moved next to the
effect: `responses.ts` `PATCH_MULT / PATCH_DAYS / PATCH_FTE / RUN_PENALTY_Y`, `targetedPlan` (the traits targeted
training cuts or raises, E25's EA ×2, inoculation's E04 patch; apply passes AG18's true efficacy, the preview the believed
one), `restrictTargets`, `discloseTrust / discloseScrutiny / DISCLOSE_CPS`; `traits.ts` `RETRAIN_TRUE / RETRAIN_VISIBLE /
RETRAIN_OBF` (goodhartTrain); `dangerView.ts` `RESTRICT` exported and `restrictDangerDelta`; `investigations.ts`
`caseRate`, `daysToResolve`, `corruptOdds`, `CASE_RESOLVE`, `defaultTools` exported (monthlyGain, the step and resolve use
them). No balance change; one behaviour change: `bestDetector` (Retrain against's default detector) ranks at the measured
OOM, not the true one, so the preview names the detector apply picks.

- *Patch signal*: was "staff 10 for 30–90 d in 60 d", "progress −0.02", "alignment est × 0.15 future growth". Now: 10
  safety research engineers for 30–90 d (0 when a patch already runs: its end date moves), "0.020 yr of progress off the
  next post-training run (G −0.024)", "N training pressures into <trait>: weight ×now → ×a–b on every later run,
  lab-wide (floor ×0.2)" (patchLevel), or "already at the floor".
- *Retrain against*: was "monitor −0.5", "staff 5 · 14 d", "board +3", "alignment −0.1 hides, not heals". Now: the
  detector apply trains against, its believed strength now → after one more retrain (Goodhart G), obfuscated reasoning
  +0.1, true level −20–40% (believed est → range, at most), and a mask: its family reads the trait at 10–30% of today's
  reading. No staff, days or board change (apply has none).
- *Targeted training*: was "staff 10 · 21–35 d", "progress −0.02", "alignment est × 0.3", "EA ×2 p 80% (SCHEME/AF)". Now:
  the run penalty line; per trait the plan cuts "believed est → est × (1 − share): <technique> removes x% (at most)";
  T-CAST's corrigibility +0.15; inoculation's E04 weight; EA ×2 only when it applies (first anti-scheming on the lineage).
- *Restrict context*: was "revenue −0.5 (× 0.5)", "approval +2". Now: the products apply restricts, their revenue
  $x → $0.3x B/yr, believed harmful acts now → after (dangerView with restrict), 70% less misuse reach; "no live
  external product" when none.
- *Roll back*: was "progress −0.25", "lead −45 d", "alignment est × 0.5", "U-modes p 30%". Now: measured L now → the
  checkpoint's, the deployments and agent lanes that move, the model shelved (and its stream stopped), the believed trait
  now → the checkpoint's (an exposure if the checkpoint is believed worse); "no checkpoint" when none.
- *Disclose*: was "trust (3(c − 30)/40) evalGov, exec, evaluators", "credibility +2", "approval −sev p 50%". Now:
  scrutiny 3 + 2·severity; trust per counterparty as applied (mean, each listed; a cost under credibility 30); the
  incident's public timer ends (no cover-up); "at most N discovered U-modes not yet public" the world learns. No
  credibility or press line (never applied).
- *Add / Remove control* (F6a) and *Remove foothold* (E8) unchanged.
- *Investigate*: was clarity/month without the AI-labour multiplier and compute factor, compute "5 × share %", corruption
  p = sab × 0.4. Now: the case's traits and tools as opened, `caseRate` at believed strengths, "clarity 0.8 in ~N d" or
  the clarity reached at 120 d, compute share "of the safety compute pool", corruption odds `corruptOdds` (sabotage ×
  (1 − the tools' verifiability)).

Tests: `uitest.mjs` F6e check: at day 900 (T-INOC), with the removal multiplier set to 1, Targeted training on PERSONA
lowers the true level by exactly the share its believed line shows, the believed target reads est → est × (1 − share),
and the run penalty grows by the previewed years; no Respond preview carries a unitless alignment line. lint-ux,
lint-hidden, lint-tradeoffs pass.
