# Removal inventory (W0), 2026-11-27

A read-only research agent built this from master at 25fcee1e, and the lead checked samples. **Line numbers drift:
re-grep before editing.** Paths are under src/ unless they start with scripts/. It is condensed to what a W1 task needs:
- what reads each deleted piece,
- what must move elsewhere,
- the neutral value that keeps the markets running.

## 1. Junk confirmed (written, never read where it matters)

- **Policy flags** milLoopRemoved, humanInLoop, multiVendor, adviceTransparency, govAdvisors: written only.
- **Macro:** wage, aiCapexShare, energyPrice, fx.hype, fx.fear and fx.trend have no reader outside macro.ts.
- **Scrutiny:** bumped by about 15 sources; its only reader is the lobbying cover-up odds (actors/actions.ts:234).
- **Dead fields:** ws4.crunchDays (its event E36 no longer exists); ws4.absorbedCompute (no reader); relations.dataLicences
  (no reader); flag `ws4:ubi`, read by endings/scoring.ts:82 but never set.
- **Unused or overwritten China meters:** computeShare, chipSelfSufficiency, domesticFab, stateSteering, openWeights,
  normsDiplomacy, verificationWillingness, econLeverage and hawkDove are read only by the UI or inside china.ts
  (also ../vision/ACTORS.md §2).
- **Public meters** activism, regDemand, companionship, xrisk and awareness: no reader outside gov.ts and the UI.
  jobAnxiety only feeds the gov policy flags.
- **Old glossary:** src/data/glossary.ts (v1) has no importers.

## 2. Things the deleted files host that must MOVE (not be deleted)

| Today in | What | Move to |
|---|---|---|
| actors/china.ts geoQSystem | `rivalFinanceQ`, `goalpostsQ` (NPC revenue tracking, distress → E32, NPC chip orders) | an NPC quarterly system |
| actors/china.ts geoQSystem | copyright suits (finance/observe.ts copyrightExposure) | finance quarterly |
| actors/china.ts geoQSystem | Taiwan and Korea shock rolls (compute/market.ts taiwanShock/koreaShock); without them, no supply shock ever happens | compute market quarterly, baseline hazard |
| actors/china.ts geoQSystem | export policy (compute/market.ts setExportPolicy) | fixed `caseByCase` in W1; the US-gov law in W5 |
| actors/china.ts chinaDaily | China lab compute = deepCentCompute(meters) (`computeAbs` growth ×2/yr) | keep the compute rule with the China lab (NPC); centralisation set by China tension in W6 |
| actors/rivals.ts:51 | `china.meters.safetyConcern` → China lab posture | a constant in the NPC China kind |
| actors/relations.ts actorsDaily | `ws4.gdp0` init (endings GDP index); weekly drift flush | economy readout (W3); flush goes with drift |
| actors/state.ts ws4 | non-outside-world state: `requests` (the only way 9 events fire), `storyNoise`, `loose`, `internalReport`, `redFlags`, `coverups`, `spyMult`, `theftAttempts`, `distillDays`, `rivalIncidents`, `postureDelta`, `nextPost`, `internalDay`, `overtakenDays`, `soldControl`, `retired`, `dpaAccepted`, `nationalizedHard`, `evalReports`, `reportedVersions`, `disclosed`, `leaked`, `misalignmentLeak` | keep in W1; split to the owners (events, security, safety, NPC, endings) in W11 |
| actors/intel.ts | `leadDays` (finance/board.ts:407 ouster test, finance/observe.ts:158, models/productOps.ts:309, UI) | keep; it is lab intel, not the outside world |
| actors/commitments.ts | pledges: deploy gating (models/deployments.ts:84-96), safety framework, E30 | keep; break costs re-pointed to approval and gov trust (W4/W5), dropped in W1 |
| relations.talentPull | labour-market pull (departments/market.ts:141) with per-start-type anchors (data/v2/starts.ts mods, init.ts:355) | labour market: anchor per start type; approval term added in W4 |
| actors/fx.ts | generic `cash`, `morale`, `moraleSafety`, `L`, `pv` helpers used by events and actions | a shared helpers module |

## 3. Neutral stand-ins at market read sites (W1 "quiet world")

| Read site | Reads | Neutral |
|---|---|---|
| worldfx/mix.ts:321 | pub.approval | 0 (demand ×1) |
| compute/sites.ts:32,47 | pub.dcNimby | 45 (the calibrated F10 case, mood 0.9; scripts/v2/finance.ts:309-320) |
| compute/market.ts:194-196 | china taiwanTension, pub.salience | tension 0.4 (start value), salience 1 |
| compute/market.ts:326 | exportPolicy | `caseByCase` |
| worldfx/sectors.ts:106-113,229,315,382 | policy flags (licensing, euCode, avBan, schoolBan, armsRace, sez, jobTraining, ubi, companionBan) | all off |
| worldfx/sectors.ts:311 | macro.US.g → re-employment (`gAI`) | baseline growth (gAI 0) until the GDP readout (W3) |
| robots.ts:64-73, techtree.ts:60,96 | policy sez, fdaFastTrack | off; SEZs and W17 stay locked until W5 (accepted in the quiet world) |
| worldfx/macro.ts | whole file | deleted; W3 readouts replace it |
| departments/market.ts:141 | relations.talentPull | the start-type anchor (no drift) |
| departments/workfit.ts:327, npc/shocks.ts:43 | gov.treaty | `none` (×1) |
| npc/lab.ts:138 | china.rung (open-weights mode) | rung 0 |
| models/deployments.ts:216, production/diffusion.ts:85 | china distillationAccess | 60 (factor 1) |
| security/theft.ts:20,42,45; security.ts:35 | china.rung, theftIntent, theftMinRung | a fixed attacker level and intent (start values), so theft still exists; W6 replaces them |
| security/security.ts:48 | coverups | kept (ws4) |
| finance/deals.ts:290-292, finance/actions.ts:306 | partner "politics" (scrutiny, Congress trust, security demand) | dropped |
| models/runs.ts:808, finance/actions.ts:458 | scrutiny bumps | dropped |
| safety/incidents.ts:283-303,369,390; responses.ts:153-158,276,303; framework.ts:46,247-249; findings.ts:203,462-463; actions.ts:57-74,352-371,506; core/limitsView.ts:80-81 | trust, access, credibility, scrutiny, publishPressure, statutes, Safety Index | statutes keep their real dates (they become the laws table early: one dated table); trust 50; access 0; publishPressure 0.3; drop credibility and scrutiny lines; Index preview lines dropped |
| production/dataActions.ts:78-84,177 | dataLicences, bloc bumps | dropped |

## 4. Deleted pieces and their other readers (summary)

- **US gov** (actors/gov.ts, GovActor, GOV_PRESETS, worldfx/policy.ts writers). Other readers:
  - events E12/E20/E22;
  - endings (oversight, treaty, rungSec, dpaAccepted);
  - UI: Relations.tsx, store.ts:51,66 "New law" toast, setup/Setup.tsx:166 preset picker;
  - core/selectors.ts:104-106, core/record.ts:51-54 → endings/replay.ts.
- **China actor** (meters, rung, deesc, presets, geoQ). Other readers:
  - events E10/E23;
  - endings (war at rung 6, scoring, view);
  - UI: Relations.tsx, RiskMap.tsx, LabTabs.tsx:434, setup/Rivals.tsx:142;
  - intel.ts riskSources.

  **`s.china.lab` stays** (about 60 readers).
- **Public and blocs** (public.ts, blocs.ts, data/v2/blocs.ts, PUBLIC_PRESETS, BASELINES.start approval/concern/jobAnxiety/xrisk).
  - pLeak and pRally are used by E10/E19/E23.
  - The bloc() helper is called from about 15 places (actions, events, finance/actions.ts:723, dataActions).

  data/v2/agendas.ts is the SAFETY agendas; it is not part of this.
- **Relations** (stocks, credibility, scrutiny, favours, access, dependence, cover-up resolution in relations.ts):
  - direct `ctx.bump('trust:…')` calls: finance/deals.ts:291, safety/actions.ts:507, worldfx/actions.ts:64,67, data/v2/findings.ts:13,48;
  - cost-line currencies trust, credibility, scrutiny, approval, talent, chinaTension: types.ts:2473, ui/kit.tsx:162-181, ui.tsx:128-144, scripts/v2/lint-tradeoffs.ts:65-71.
- **Relation actions** (actors/actions.ts, data/v2/actions.ts META, Relations.tsx). Bots call them by id:
  - bots/safe.ts:63-75
  - bots/race.ts:29-33
  - bots/mixed.ts:85-87
  - bots/settings.ts:239

  WorldRisk.tsx:19-21 has buttons for C1, C3, A4, E1 and E2. SafetySafeguards.tsx:427,479 uses A3.
- **Research bodies and the Safety Index** (researchBodies.ts, actors/index.ts):
  - discoveryOdds is used in the event cover-up lines (events/catalog/china.ts, safety.ts);
  - gradePlayer is used in safety/actions.ts previews;
  - safety/framework.ts:46 reads evalReports.
- **Macro** (worldfx/macro.ts). Readers:
  - macro.US.gdp: endings scoring/view;
  - macro.US.g: sectors.ts:311, record.ts, headlines H22/H23;
  - gini: endings, EndScreen;
  - dow: E25 bumps, H8/H24, readouts.ts:227, World.tsx;
  - aiOwnerShare: H25; intelligenceCurse: H27, scoring.ts:76.
- **Events** reading the deleted pieces: all 13 except director plumbing (see SESSION-HEAD / spec §8 for the kept set).
- **Headlines** that read the deleted pieces: H1, H2, H3, H5, H7, H8, H9, H11, H12, H14, H17, H18, H22-H27, H30, H31, H32.
  Pure world (keep): H4, H6, H10, H13, H15, H16, H19, H20, H21, H28, H29.
- **Endings:**
  - endings.ts:88 (nationalizedHard), :93 (war);
  - epilogue.ts:77-88 (treaty, committee, government, democratic);
  - scoring.ts:47-111;
  - view.ts:120-125, 323, 428-449, 508-528;
  - replay.ts;
  - ui/end/EndScreen.tsx;
  - data/v2/aftermath.ts (PowerOutcome-keyed text).
- **Glossary** (data/v2/glossary.ts): about 50 terms (approval … aiOwnerShare, the power outcomes, taiwanStatus).
- **UI:**
  - the whole Relations.tsx;
  - World.tsx macro tiles;
  - WorldRisk.tsx, RiskMap.tsx;
  - LabTabs.tsx:221, 434, 452;
  - Compute.tsx:519-1106 (opposition, export policy);
  - Finance.tsx:801;
  - kit.tsx:160-181;
  - ui.tsx:25-31 unlock gates;
  - Nav.tsx:24;
  - AlertQueue.tsx:16-23, watch.ts:136, DecisionModal.tsx:23-25 (event kinds → relations panel);
  - Onboarding.tsx:37 (the 'commit' goal);
  - setup pickers.

## 5. Tests and fixtures to re-baseline or delete

There are no *.test files. The tests are the scripts/v2 tiers.
- **Delete or rewrite:** scripts/v2/ws4.ts, npcPublic.ts (gradeRival), npcShocks.ts (treaty, E1, C4), npcEndings.ts,
  _endview/*, oversight, policies, worldfx.ts, worldfx-refplay, _mk11/check.ts, _sr01, _sr17, _sr19, _rfs2 (A3),
  _rfs13, _a07.
- **Fix:** hygiene.ts:203 (expects 7+15 relation stocks), :364-374 (bump-clamp test uses pub.approval); milestonepred.ts:106
  (asserts on actors/gov.ts); scripts/v2/data.ts:168, 337; uitest.mjs:257, 1364, 1842, 2555; lint-tradeoffs.ts.
- **Re-baseline:** fixtures (scripts/v2/fixtures.ts --write), the _ub5c state hash, bot fingerprints, simcache.
- **Save:** core/save.ts SCHEMA_REV (bump; saves break, by rule).
