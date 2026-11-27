# B5e: classification rulings applied to six params files

Rulebook: `balance/CLASSIFY.md` (A1-A10). Files: safety-data, safety-engine, actors-engine, worldfx, models, core. No `unclear` entry is left in any of them.

## Counts (kind: before -> after)

| file | designer | untagged | sourced | derived | fitted | stand-in | unclear |
|---|---|---|---|---|---|---|---|
| safety-data (201) | 115 -> 119 | 29 -> 28 | 21 -> 21 | 18 -> 12 | 13 -> 15 | 4 -> 6 | 1 -> 0 |
| safety-engine (119) | 43 -> 53 | 46 -> 39 | 16 -> 16 | 2 -> 2 | 7 -> 8 | 1 -> 1 | 4 -> 0 |
| actors-engine (68) | 13 -> 18 | 31 -> 26 | 15 -> 15 | 3 -> 4 | 3 -> 3 | 2 -> 2 | 1 -> 0 |
| worldfx (80) | 16 -> 24 | 40 -> 36 | 15 -> 15 | 2 -> 1 | 1 -> 4 | 0 -> 0 | 6 -> 0 |
| models (66) | 12 -> 17 | 33 -> 27 | 16 -> 17 | 2 -> 2 | 1 -> 1 | 2 -> 2 | 0 -> 0 |
| core (160) | 32 -> 35 | 115 -> 112 | 5 -> 8 | 7 -> 2 | 0 -> 3 | 0 -> 0 | 1 -> 0 |

Layer changes (A10): safety-data ARCHETYPE_POSTURES.* (9, actor rivals) and CHINA_POSTURE_BASE.* (9, actor china) -> policy; models DEFAULT_SERVING, RUN_POOL_DEFAULT, runs.idaPoolShare -> policy/player (player defaults). `readout` added to notes (layer stays world): safety-engine SD_MAX, UNKNOWN_RANGE, VAL_W, EA_PROJ, UNFOUND_YEARS, PREDICT_SD_FLOOR, THETA_PRIOR; actors-engine ASSUMED_LAG, PRIOR_BAND, intel.leadSd; worldfx CONVERGED; models WSL_RISE_PER_DAY. That set is my reading of "belief-only / readout-only"; the lead's list of 13 was not complete in B5-QUESTIONS.

## Not settled by CLASSIFY.md (my choice, easy to flip)

1. **Literal copies whose original is not registered or is untagged (A7).** `bots.ref.GATE_OOM`, `REF_BASE_DAYS`, `bots.common.LEADER_CAP_STAFF` went from `derived` to `untagged` with a "copy of ..." note: the original (v2 gates, mkt.ces.frontierDays 91, mkt.START_TEAMS.classic) is untagged or unregistered. Question: should a copy of an untagged original be `untagged`, or should the original be tagged first?
2. **Copies that take another file's kind.** core `KW_PER_H` (sourced, copy of mod.power.kWPerH100e0), `LEASE_PER_GW_Y` (sourced, copy of mkt.LEASE.perGWYear; ledger.ts:17 itself tags the number [D], the registry says sourced), `BROWNFIELD_PER_GW` (sourced, 14 = mkt.FACILITY_PER_GW 10 + NETWORK_PER_GW 4), `UPKEEP.featureYr/featureIdle` (designer, copy of mkt.TOOL_UPKEEP). If those originals change kind, these must follow.
3. **Literal "derived" values.** `saf.danger.kappaItem.autonomy8h` / `kappaRd.autonomy8h` (hard-coded 0.8 = 8/(8 + H_HALF)) -> designer as a copy of H_HALF. `saf.V0_V2_LEVEL` -> untagged (literal, "a unit, not a parameter"). `wfx.ROBOT.stock0` -> designer (literal; comment multiplies a sourced count by a designer 0.3). `saf.AGENDAS.oHalf` and `AG09_LATENT.oHalf` -> designer (frozen v2 values; header tags every parameter [D]). `sfe.THETA_PRIOR` -> designer (V2-SPEC states the doom-threshold prior).
4. **A5 fits.** `fitted`/`manual`: wfx FRIEND_SOCIAL_MID, sfe OC_VIS, saf SERIOUS_CAP, core UPKEEP.product/productRev/monitor (J2 tuning x0.4 to v2 build capacity; the 0.2 + 1.6 sqrt form stays [D], revUnit stays designer). `core.build.runSetupTW` ("R5 calibration kept in J2") left designer: no tuning procedure described. `fit.targets` stay empty (B6).
5. **A3 two-tag entries.** HYPE.rev/level -> `fitted`/unnamed (macro.ts:174 names the target "+30% in 2026", no script). ACCEPT.base/gain/spread/rate -> designer (the tag cites spec section 7.3, not a script or target). ACCEPT.mid stays fitted (G1 refit).
6. **A8 spec pointers.** Moved to `designer` with `source` where the spec states the number: LEVERAGE_THRESHOLDS, brandApprovalSwing, blockOdds, bustDemand, refTotalShare, startListPrice, distillAccess, RUNG_TRUST, trustLossFactor, racePressureMonths, chinaSafetyInvestment, STORYTELLERS.*, catastropheP, playerContain, misWeights, rivalDriftMult, idaCompounding, pMisSlope, crystalMult (spec edge E23), obsSigma, combineToolsCorrelation, VERIFIABILITY, S6_NARROW_HARMFUL (V3-BUILD AF notes). Left untagged because the spec states only part, or differs: RELEASE_LAG and LATENT_P (4 of 7 archetypes), coverUpDiscovery (spec 0.05-0.3, code 0.05 + 0.25), discoveryBaseline (code adds 0.02), publicTimer (RAISE 3 d and outsider cut not in spec), FIN.cash/revenueRun (STRUCTURE 4.8 has the leader row only), CONTROL_W, TIER_W, delayOdds, eaCoef, COT_S4.
7. **Stale evidence text.** Entries moved off `untagged` still carry "no tag; ..." at the start of `evidence`; the new `notes` say why the kind changed. I did not rewrite evidence strings.
8. **A6 proxies.** `saf.ORGANISM_REALISM.lo/hi` -> stand-in ("[proxy, low]"). `VAL_ENGINEERS/VAL_DAYS` ("[D: proxy ...]") stay designer with the pointer in `source`. `LOCKDOWN_COLLUSION_MULT` and `mod.KYC_REFUSE` stay sourced with `analogue` in notes.
9. **Not touched:** group-comment cases on `edges.ts` E06/E11 (already sourced and the comment sits directly above them); core scoring tables (untagged, "rough" is not "rough guess"); `ALIGN_EVAL_MIN_N` (tag sits on a sibling).

Scratch tooling: `.scratch/b5e/` (patch.ts, run-wm.ts, run-rest.ts, dump.ts).
