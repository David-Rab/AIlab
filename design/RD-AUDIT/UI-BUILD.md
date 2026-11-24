# R&D UI build plan (2026-11-23, designer accepted)

Mockups approved: design/ux/mockups/rd/*.png (DATA.md = source of each number). Authority: SESSION-HEAD, DECISIONS,
VOCAB.md, UI-IA.md, good-ui standard. Player-facing content only (no dev state on screen).

| # | Task | Notes |
|---|---|---|
| UB-1 | Measurement scale: sourced best-human (and median-expert) reference per skill domain, replacing the shared expert-domain reference (V0 reads 0 on Social/Media/Bio); AGENCY −1 leftover; a public median-expert reference the player may see | engine; before MODELS/TRAINING screens |
| UB-2 | Readouts on beliefs/measured only: bestPlayerVersion, measuredDomain fallback + act table for unmeasured versions, stackViews "waiting", softwareRate, AI share / work done; new readouts from DATA.md (NEW) incl. programme rate (≈ × / yr), chances / yr, research speed history, certainty word | engine views; after UB-1 |
| UB-2b | Run forecast (runForecast, skillGains, run card) from the lab's believed recipe and measured build, not the true recipe / build | before TRAINING screen |
| UB-3 | Z01 save break (MIN_SCHEMA_REV → current; drop old migrations) | after UB-2 |
| UB-4 | Vocabulary pass (Z02): glossary, tooltips, labels, view strings per VOCAB.md; fix the doc-citation filter (ui.tsx playerSource) — doc refs only in a designer overlay | UI strings; parallel with UB-1 |
| UB-1b | Skill-bar marks per skill from the same test as its reference (median + best), replacing the fixed 6.4 / 10 pair | after UB-1 |
| UB-5..10 | Screens (skill bars labelled "on tests", milestones "doing the job"): LAB (+L0 shell) · RESEARCH Portfolio · TRAINING Next run · Know-how · SAFETY Risks · MODELS | after UB-2/4; each with UI tests + screenshots checked |

Mockup changes accepted with the plan: Portfolio cards show the programme's rate at current staffing (≈ × / yr to its
know-how area; next result in the tooltip); "Chances" shown as chances / yr.

Lead calls (2026-11-23): safety programme stage track uses the engine's three stages (Ideas · Small test · Validate),
not the mockup's four; programme rate = at current staffing (as planned); Best moves ranked by "days of progress a year"
(365 × gain ÷ the target's current rate).

## For CP4 (noted during the build)
- Golden canary seed 2027 fails on SAR / SIAR after the UB merges (UB-3 report; sim doesn't call save code): find which
  change moved it (UB-1 measurement scale is the likeliest) at CP4.
- After UB-3: 14 one-off `_xxx` checks fail at their migration step and `_rfs5` / `_rfs8` / `_rfs14` pin rev 103 —
  delete or update at cleanup.
- Leftover temp worktree AI27-ub2base (node_modules link → delete the link first).
- UB-2b forecast coverage 9/18 in the 90% band: with no measured start model the measured level reads ~0.16 below true on
  average (measurement bias? check RD-M01's fit for a systematic offset at CP4); only the last 30 results are kept.

## Follow-ups after the remaining-screen builds
- SAFETY › Safeguards as the one home for every safeguard control: product monitors / safeguard level / KYC (still in the
  Products drawer) and the control-protocol changes (built as "Compare": wire the existing setting so they Apply).
- uitest R10 limits: three SAFETY › Cases limits missing (UB-C).
- Skipped readouts needing engine work: revenue history per product, separate API / Enterprise customers, rival price per
  sector, win-back previews, lead history, rivals on your evals; case verdict after-range.
- Overview race shows "YOU · Atlas-2.10" (lead measured vs the AI-staff model): check which model the lead should use.
- Evals tab still shows raw levels (OQ-6).
