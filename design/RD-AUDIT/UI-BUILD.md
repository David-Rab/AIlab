# R&D UI build plan (2026-11-23, designer accepted)

Mockups approved: design/ux/mockups/rd/*.png (DATA.md = source of each number). Authority: SESSION-HEAD, DECISIONS,
VOCAB.md, UI-IA.md, good-ui standard. Player-facing content only (no dev state on screen).

| # | Task | Notes |
|---|---|---|
| UB-1 | Measurement scale: sourced best-human (and median-expert) reference per skill domain, replacing the shared expert-domain reference (V0 reads 0 on Social/Media/Bio); AGENCY −1 leftover; a public median-expert reference the player may see | engine; before MODELS/TRAINING screens |
| UB-2 | Readouts on beliefs/measured only: bestPlayerVersion, measuredDomain fallback + act table for unmeasured versions, stackViews "waiting", softwareRate, AI share / work done; new readouts from DATA.md (NEW) incl. programme rate (≈ × / yr), chances / yr, research speed history, certainty word | engine views; after UB-1 |
| UB-3 | Z01 save break (MIN_SCHEMA_REV → current; drop old migrations) | after UB-2 |
| UB-4 | Vocabulary pass (Z02): glossary, tooltips, labels, view strings per VOCAB.md; fix the doc-citation filter (ui.tsx playerSource) — doc refs only in a designer overlay | UI strings; parallel with UB-1 |
| UB-5..10 | Screens: LAB (+L0 shell) · RESEARCH Portfolio · TRAINING Next run · Know-how · SAFETY Risks · MODELS | after UB-2/4; each with UI tests + screenshots checked |

Mockup changes accepted with the plan: Portfolio cards show the programme's rate at current staffing (≈ × / yr to its
know-how area; next result in the tooltip); "Chances" shown as chances / yr.
