# RD build notes

One block per task (ID, choices marked [D], deviations, readouts for later tasks).

### RD-C01

Retired v2's knot production function (SYNTHESIS §4.1; INP-20, MEA-16). Commit eaf22ad.
- **Moved** to new `src/engine/v2/production/ces.ts`: bisect, erf, Phi, cesFromAsymptotes, Xces, Lrel, tasteSigma, hRef,
  refTotal, frontierFlop. 15 importers (src + scripts) repointed. `production/knots.ts` deleted (no shim).
- **Deleted:** buildKnots / buildKnotsDetailed / KnotBuild, knotAt, refDates, knotCompute, gF, La, sdOfF, bestMix,
  tasteOf, tasteSD (only the knot branches used them); refBestX, tasteCurve, speedOf and the non-v3 branches of evalM,
  evalProduction and bestResearchMix; R13_AI2027_KNOTS and R13_TABLE_SD (calibration.ts); ProdKnot and
  ProdParams.knots; world/hidden.ts no longer builds knots (prodParamsFor lost its world argument).
- **LabInputs:** qDep, qTaste, aEng, d, stock, tasteHire, eff, mixUnit.load gone; `v3` is now required (labInputs only
  ever built the player's v3 inputs). [D] qTaste and aEng were not in the list but had no reader outside the knot branch.
  productionWhatIf's change type is h / k / c.
- **ProductionReadout:** Ddata, parts.base, elast.train / data gone, and [D] ratios.d (no reader; its only source was
  LabInputs.d). rivalReadout updated.
- **Schema:** SCHEMA_REV 43 → **44**; migration 43 drops `hidden.timeline.prod.knots` and the dead prodCache fields of
  every lab (idempotent). New hygiene check "a schemaRev-43 save migrates to 44"; the `SCHEMA_REV === 43` literals in
  control / data / footholds / hygiene bumped.
- **Scripts:** identity.ts (P1–P3, all on the knot function) deleted and dropped from run.ts; products.ts A1 (qTaste =
  qDep reproduces M) removed (it tested a removed input); worktypes lint allow-list points at ces.ts.
- MANUAL_MIX_RANGE comment rewritten (no knot justification; says it is narrower than Auto's [0.01, 0.99], INP-21).
- **Kept:** AI2027_COMPUTE_TABLE (EndScreen reads it; comment fixed). ProdParams.kappa / etaSC are now unread (only
  buildKnots read them) but kept: removing them is another shape change → RD-C04. evalM still returns v2-shaped fields
  (Mref, R, tau, norm) that readout callers destructure; INP-03 territory.
- **Behaviour:** identical. Probe (RefBot; sampled #11 500 d, authors2026 #5 400 d, fast #3 300 d): state hashes with
  the removed fields stripped equal before / after. All five fixtures regenerated and compared the same way: identical;
  committed fixtures left at rev 43 (stale only by the removed fields; the merge regenerates them with `--write`).
- **Tests:** tsc main + scripts clean. test:quick 32/34: fixtures FAIL (stale, expected: the removed fields and rev),
  worldfx A2a 6.7% / W4 23.3% (known). hygiene incl. the new migration check passes.
