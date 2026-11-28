# Outside world: tasks

Spec: [OUTSIDE-WORLD.md](OUTSIDE-WORLD.md). Designer's words: [SESSION-HEAD.md](SESSION-HEAD.md). Inventory:
[INVENTORY.md](INVENTORY.md).

The base branch is `world` (worktree ../AI27-world). Each task gets its own branch and worktree from `world`, named
`w-<id>` in `../AI27-w-<id>`. The lead merges back into `world`.

## Designer's answers to spec §13 (2026-11-27)

| Question | Answer |
|---|---|
| Q1 attention rule | ok |
| Q2 support channel | yes, if not too complicated; otherwise drop |
| Q3 laws list | ok |
| Q4 hiring pull | one approval |
| Q5 evaluators and Index | fold, as drafted |

**Acceptance test (designer):** "a world without a player", run in each timeline, to see what happens. Built as
W10:
- The player is an observer: the weakest start, an idle policy, and player-only endings switched off for the run (a
  harness switch, since an observer can't play).
- Only world endings can end the run.
- Each timeline (fast, central, slow) is run with the middle alignment setting.

The output is a per-quarter world log covering:
- the frontier and milestones;
- the US stage and laws;
- concern and unemployment;
- China's tension and talks;
- Taiwan shocks;
- the ending.

An observer run checks the world-level half (S1, S3–S7). S2 (a leading player) is checked separately with RefBot.

## Scope (refocus, 2026-11-27; SESSION-HEAD §10)

Core: W1b–W1e, W1f, W2, W4–W7, W10. Ride-along: W1f setup. After the test: W14 plans check, W8 UI (minimal stub
before), W11 cleanup. Parked: W12. Rule: leave the code cleaner than we found it ([[leave-code-cleaner]]).

## Order

Tasks run one after another where they touch types.ts or core state. W9 runs in parallel from the start.

| # | Task | Model | Budget | Depends | Status |
|---|---|---|---|---|---|
| W1a | Move what geoQ hosts (NPC finance, copyright suits, Taiwan and Korea rolls) into their own systems; behaviour identical | Sonnet high | 45 min | — | done 0c17a262 |
| W9 | Primary sources for the calibration targets → SOURCES.md | Sonnet high | 60 min | — | done cf5ef02f |
| W1b | Economy: delete macro.ts, add the readouts (spec §4) | Sonnet high | 60 min | W1a | done e72ac062 |
| W1c | Quiet world, engine part 1: delete public, blocs, relations, research bodies, Safety Index, relation actions; neutral stand-ins (INVENTORY §3) | Opus high, reason (c): cross-cutting core state, about 40 files | 90 min | W1b | done 7c7a7e3d |
| W1d | Quiet world, engine part 2: delete the gov, China and public actors (meters, ladders, presets, policy flags), keeping the China lab; the dated laws table; stand-ins | Opus high, reason (c) (W1c showed the size: ~100 files) | 75 min | W1c | done 2219e5b4 |
| W1e | Quiet world: bots, UI stubs, glossary, tests and fixtures re-baselined | Sonnet high | 75 min | W1d | done (merged into W1ef) |
| W2 | Shared inputs module (spec §3) | Sonnet high | 45 min | W1e | done d057cabd |
| W3 | (folded into W1b) | | | | |
| W4 | Public (spec §5) | Sonnet high | 60 min | W2 | done eb95c5da |
| W5 | US government (spec §6) plus the support channel if it is one factor on permitting | Opus high, reason (a): thresholds chosen while coding | 90 min | W4 | done d1e5629d |
| W6 | China government (spec §7) | Sonnet high | 75 min | W5 | done 0d85b56f |
| W7 | Events and levers pass (spec §8) | Sonnet high | 60 min | W6 | done d9c68e02 |
| W10a | Observer mode in balrun + quarterly world series (spec §17) | Sonnet high | 60 min | W1e | done d4578ba0 |
| W10b | World dashboard worlddash.ts → balance/dash/world.html (spec §17; skill dataviz) | Sonnet high | 90 min | W10a | done 875af419 |
| W10 | Observer runs × 3 timelines × 8 seeds after each build step; S1–S7 checks; the lead analyses | lead + runs | — | W10b, then W4–W7 | |
| W8 | UI: one "Powers" home, World tab trimmed (skill good-ui) | Sonnet high | 90 min | W10 | W8a proposal (audit, IA map, mockups) running; W8b build after approval |
| W1f | Setup cleanup (spec §14): delete baseline, economy presets, storyteller; move the lab start values into start types; Setup UI | Sonnet high | 60 min | W1d | done fe28d849 |
| W11 | Cleanup: split ws4 to its owners, dead code, docs | Sonnet medium | 60 min | W8 | split: W11a docs + ws4.ts checks + stale comments running; W11b ws4 split after W8b-1; scratch removal at the end |
| W12 | PARKED (refocus): AI 2027 sweep beyond the outside world → design/OPEN.md. Kept: list the AI 2027-sourced lab parameters for `bal` at merge | — | — | merge | parked |
| W13 | Read the AI Futures plans A–D → PLANS.md, mapped onto the spec (§16) | Sonnet high | 60 min | — | done 8ed8cc37 |
| W14 | Plans A–D check after W10: can each plan happen? Add at most the treaty compute cap | lead | — | W10 | done (lead): PLANS.md §5 |

## Log

(one line per finished task: id, model, time, result, merged commit)
- W1a · Sonnet high · ~7 min · geoQ extras moved to geoShocksQ 441, copyrightQ 442, npcQ 443; fixtures identical · 0c17a262
- W9 · Sonnet high · ~9 min · SOURCES.md: BLS, BEA/CBO, Pew/Gallup, BIS steps, SB 53/RAISE/EU/SB 243, EO 14318, AI 2027 beats.
  Corrections: research/07's "67%" is 47% (Pew Mar 2026); the companion law restricts rather than bans; the RAISE
  chapter amendment is [unverified] · cf5ef02f
- W1b · Sonnet high · ~20 min · macro.ts → economy.ts (GDP growth = G_BASE + λ·Δautomation + techs − shock, λ 0.6; AI
  share of income). Unemployment is identical at days 0–900; US growth is +0.4 pt from G_BASE 0.022 (CBO). Inequality
  is out of scoring. SCHEMA_REV 117 · e72ac062. Lead fixed a param anchor and the hygiene system table · bd71dcf5.
  Moves calibration: yes (growth term), for `bal` at merge.
- W13 · Sonnet high · ~3 min · PLANS.md: Greenblatt A–E (Oct 2025) and AI Futures "AI 2040: Plan A" with A/B/C+/C/D/S
  (Jul 2026). Proposes 4 minimal additions; designer to decide. Quotes came through a summarising fetch; re-check before
  using them in game text · 8ed8cc37
- W1c · Opus high · ~90 min (stalled waiting on a finished job; lead stopped it) · relations cluster deleted: relations,
  blocs, research bodies, Safety Index, 17 relation actions, E16, E29; kept actions moved to their owners; cover-ups →
  events/coverups.ts. 104 files, −2161/+715. tsc, registry-lint, lint-tradeoffs and fixtures pass. Stand-ins are marked
  "W1c". For `bal` at merge: hiring pull is fixed at the start-type anchor (no drift); the safe bot now orders an
  independent evaluators' suite (externallyEvaluated); the 'government' power outcome is unreachable until W5 ·
  7c7a7e3d. Lead fixed stream owners for geoShocksQ/copyrightQ → WS4.
- Brief rule from here: no waiting on background jobs. Checks run in the foreground with a timeout, then report.
- W1d · Opus high · ~32 min · gov, China actor and public deleted (gov.ts, public.ts, china.ts, data/actors.ts, E12,
  E20, E22, E23; policy flags; presets and pickers). China is now {lab, computeAbs} (npc/china.ts). Dated laws table in
  data/v2/laws.ts: EU GPAI 2025-08-02, SB 53 2026-01-01, RAISE 2027-01-01, export controls strict → case-by-case
  2026-01-13. The economy shock moved to economy.ts. Bug fixed: geoShocksQ wrote tension into market.geoTW (Taiwan's
  supply share). War, treaty and committee outcomes are unreachable until W5/W6. SCHEMA 119 · 2219e5b4.
  For `bal` at merge: export policy follows real dates; EU friction is on from the start; brand ×1; nimby fixed at 45;
  the preset draws are gone, so per-seed worlds shift (on the day-900 fixture, valuation went 327 → 211 on that one
  seed; milestones are unchanged).
- W1e+W1f merged into one Sonnet task (W1d did most of W1e): setup cleanup + loose ends · running
- W10a · Sonnet high · ~3 min · worldReadout (engine/v2/world/readout.ts) + observer mode (scripts/v2/observer.ts,
  balrun --observer, harness flag `harness:observer` skips player-company endings). Start: spinout. Smoke tl-fast seed 1:
  29 s/game; leading NPC lab SC 2027.9 (AIFM fast median AC 2027.9), ASI 2031.6 (median 2029.8); ended by a misaligned
  rival takeover at ASI, so no +3y tail. US unemployment 5.9%, youth 26% in 2031 · d4578ba0
- W1e+W1f · Sonnet high · ~11 min · setup cleanup: baseline, economy presets and storyteller deleted. Lab start values
  moved into starts.ts (leader row, today's values; flagged for `bal`). World start WORLD_START uses the reality values:
  global compute and chip stock 14e6, robot cap 0.5e6. Adoption is one constant ADOPTION (the old default row). The
  director has one fixed pacing (2 crises, 14 quiet days, ×1; the act-based multiplier is gone). LOCAL_MOOD hook for the
  sites test. Wording that promised deleted effects is fixed. SCHEMA 120. Day-0 player block identical · fe28d849.
  Lead merge check: tsc, fixtures and registry-lint pass on `world` (d8f56957).
  **The quiet world is complete.**
- W10b · Sonnet high · ~7 min · worlddash.ts + worlddash-assets/ + balance/world-history.ts (real series with URLs);
  `npm run world:dash -- --runs <runs>` → balance/dash/world.html. Six tabs; the W4–W6 rows are placeholders; two live
  checks (lead-lab SC inside the AIFM p25–p75 band; unemployment within 0.5 pt of BLS at Nov 2026). Checked in headless
  Edge with no JS errors · 875af419
- W2 shared inputs (world/observe.ts) · running. Quiet-world grid obs-quiet (3 timelines × 8 seeds) · running
- W2 · Sonnet high · ~7 min · world/observe.ts: publicMilestones (NPC: first release after milestone + lag), govMilestones
  (briefing ≥ 2 or pre-deploy testing: from the day; briefing 1: +90 d), frontier on one lag axis, attention = max(0.5^((m−3)/3),
  reach), incidentHeat (half-life 182 d). OBSERVE constants registered · d057cabd
- obs-quiet (lead) · 24 games in 408 s. Lead-lab medians (days → year), vs AIFM medians:

  | | SC | SAR | ASI |
  |---|---|---|---|
  | fast | 2028.1 (AIFM AC 2027.9) | 2028.5 (2028.4) | 2029.4 (2029.8) |
  | central | 2030.2 (2029.7) | 2031.1 (2030.6) | 2032.4 (2033.2) |
  | slow | 2034.2 (2034.8) | 2037.8 (2037.6) | 2041.3 (2046.5) |

  Findings for later:
  - (a) China's lab overtakes the US in slow runs: the median gap at the end is −23 months (China ahead).
  - (b) Automation reaches 32–44% of US work, but unemployment ends at only 5.5–6.2% (youth 24–30%), and the AI share
    of income is 2.5–5%.
  - (c) Many runs end early in a misaligned takeover or catastrophe at medium alignment (the `bal` alignment setting).
- W4 · Sonnet high · ~13 min · world/public.ts: concern (to 50 + 6/public milestone + 5/pt of unemployment rise + 2 ×
  incidentHeat, half-life 90 d) and approval (to −0.4·(concern−50), half-life 180 d; approvalPush × attention). Outputs:
  brand factor, localMood 45 + 0.5·(concern−50) (−10 with the community package), hiring pull from approval. Smoke
  tl-central: concern 50 through 2027, ~70 at the first public SC (2030), 86 at the end. Note: a covered incident that
  leaks takes both the leak and the cover-up push (judged fine: the lie is its own penalty) · eb95c5da
- Dashboard follow-up (after W5/W6): wire public/usgov/china into the History (concern vs Pew) and Reactions rows
- W5 · Opus high · ~38 min · world/usgov.ts: stage 0–4 from govMilestones (milestones 2/3/4/5 + thefts, 90-d lag; stage
  4 also needs stage 3 held 180 d), trust (start 55, pushes × attention), E12/E20/E22 rebuilt (neutral defaults; DPA
  pools 50% of US NPC compute into the player as a rent-free cloud contract), hard path → nationalized. Conditional laws
  in laws.ts: exportStrict, licensing, relief → UBI, hitl, sb243 (dated), sez, fdaFastTrack. Support channel DROPPED
  (sitePermitQ has no state and 8 callers incl. UI previews). B7 moved; actors/actions.ts deleted. Smoke tl-central:
  stage 0 to Nov 2026, then stages 1/2/3/4 in 2028-05 / 2030-04 / 2031-08 / 2032-02; strict exports 2030-05; licensing
  2030-07; no relief (12-month rise never > 1 pt). SCHEMA 122 · d1e5629d. Open: ws4.ts shows 5 failures (canon text,
  intel, China lead, rival gaps), not confirmed pre-existing; hygiene timed out on a shared CPU.
- W6 · Opus high · ~46 min · China's lab on the NPC compute rule (start 0.36M H100e, ×2.25/yr plan; export and
  collective multipliers via s.china.access). End gap: fast +4.8, central +8.2, slow +12.0 months (China behind; it was
  −23 in slow). world/chinagov.ts: tension 0–4, talks 0–3, E23 Treaty (back/oppose), verification needs pre-deploy
  testing. The treaty caps the player's AI R&D pool (power.ts poolsOf) and slows the NPC clock ×0.65. War at tension 4.
  Theft only from tension 1, on attended labs leading China by > 90 d. SCHEMA 123 · 0d85b56f.
  Findings → W6b:
  - (1) The slow reference series runs out at ~2044.6: NPC G goes negative.
  - (2) Tension follows the noisy public lead, so the collective forms by Dec 2026 and rung 3 by 2029 in every timeline
    (wrong shape; not real history).
  - (3) Strict exports never switch off after the first Chinese theft.
  - Taiwan disruptions: 18 in slow.
- W6b · Sonnet high · fixes (1)–(3) · running. W10c · Sonnet high · dashboard rows for public/usgov/china · running
- W10c · Sonnet high · ~7 min · dashboard: concern vs Pew; Reactions rows (concern, approval, US stage, trust, China
  tension, talks, lanes for laws/export/treaty/collective, attention); "Timeline of beats"; live checks B2/C/D/E/F ·
  6959242b. Live checks on obs-w6:
  - Dated laws pass.
  - C fails: stage 1 on day 159 and strict exports in 2025, from a Chinese theft of an NPC lab on ~day 69 in every run.
    W6 put theft at tension ≥ 1; the old rule was rung ≥ 2.
  - E fails: the collective forms in Dec 2026.
  - Fast concern is 58.7 at Nov 2026: milestone 1 goes public in 2026.
  - Approval falls for an invisible player.
  - All of these were added to W6b as fixes 4–6 (theft from tension 2; concern steps from milestone 2; approval
    baseline × attention).
- W6b · Sonnet high · ~25 min · six fixes:
  1. The reference series is extended past its last point (rows end 2030.1–2060).
  2. China tension reads a smoothed lead, gated by US public milestone 2 (collective) and milestone 4 or US stage 3
     (coercion).
  3. Strict exports have hysteresis (stage ≥ 2 or a theft in the last 365 d).
  4. Weight theft from tension 2.
  5. Concern steps from milestone 2.
  6. The approval baseline is scaled by attention.

  Observer: history holds in central and slow (stage 0, case-by-case from 2026, concern 50). Fast: US milestone 2 is
  public by mid-2026, so the collective, US stage 1 and concern 53 land before Nov 2026. This is a shared-history
  question for the NPC lead lab and `bal`. Slow: Taiwan flagged in 32 of 115 samples (to review).
- obs-built (lead) · 3 × 8 grid on the built world · running
- obs-built (lead) · 24 games in 728 s. Medians:

  | | concern Nov 2026 | US stages 1/2/3/4 | tension 2/3 | treaty runs | UBI runs |
  |---|---|---|---|---|---|
  | fast | 53.2 | 2027.5 / 2028.5 / 2029.2 / 2029.7 | 2027.7 / 2029.5 | 1/8 | 2/8 |
  | central | 54.9 | 2027.2 / 2029.7 / 2031.7 / 2032.7 | 2027.7 / 2033.0 | 6/8 | 4/8 |
  | slow | 50.0 | 2028.7 / 2031.7 / 2041.9 / 2040.2 | 2028.7 / 2041.7 | 7/8 | 6/8 |

  - Unemployment is 4.3 at Nov 2026 everywhere. No war. Licensing and hitl are on in most runs. Taiwan disruptions
    happen in 6–8 of 8 runs. Lead-lab ASI: fast 2029.4, central 2032.1, slow 2048.8 (the treaty clock slows it).
  - For the designer:
    - (1) Verified treaties are common with no player: the verification precondition passes automatically when the
      player isn't a frontier lab.
    - (2) Milestone 2 goes public in some central seeds in 2026 too: a shared-history issue for the NPC lead lab and
      `bal`.
    - (3) Taiwan disruption frequency.
- W7 · Sonnet high · ~16 min · 9 events left (E01, E10, E12, E19, E20, E22, E23, E25, E32), each defaulting to the
  do-nothing or moderate option. E30 became CMT_HONOUR/AMEND/BREAK on a binding pledge (Relations › Obligations); E27
  became SITE_DEAL/MOVE/SUE on a blocked site (Compute › Sites). E19 Deny and Spin merged; E01's duplicate Deny is gone;
  two previews showing effects that apply() never applied were fixed. Only the ending blocks the screen; ~16
  failed-click alerts became action error returns. Headlines went from 24 to 17. ws4.ts failures were checked against
  the base: the same 5 pre-existing failures remain (canon text, E23 text length, intel estimate, China lead, rival
  gaps) · d9c68e02
- Cleanup for the designer or the lead (removal blocked by permissions): worktree ../AI27-w-w7-base (its node_modules
  is a JUNCTION to AI27-w-w7: run `rmdir` on the junction first, never `worktree remove --force`); untracked scratch:
  scripts/v2/_w1c (in w-w1c), _probe_w5.ts, _w6dbg.ts, worlddash-assets/_apply*.mjs and _checks/_hist.txt, and
  scripts/v2/_obsq.mjs in AI27-world.
- W6c · Sonnet high · ~3 min · treaty will (concern ≥ 70, the player's pledge if attended, the lead NPC lab's
  externalAccess ≥ threshold). Taiwan factor 1 + 0.25·min(t,2) + 1.0·max(0,t−2), coercion +0.05/q. Lead set the threshold
  to 0.45 (the leader kind passes; upstart and racer don't) · 2df67163
- W14 (lead) · PLANS.md §5: plans A, US-buys-time, C, D and E are possible; AI Futures B (sabotage) and plan A's handoff
  are not (parked to OPEN.md)
- W8a · Sonnet high · ~10 min · audit, IA map, 4 mockups (design/world/ui/). The designer approved the mockups and
  decided: Powers replaces Relations; pledges stay on Powers; nav badge only; providers → link to Finance › Story; three
  adoption numbers; talks are events only · 2bca7f45
- Lead review: the Risk tab was left "unchanged" by W8a, but its War estimate is an ad-hoc formula and its lever texts
  name deleted actions (track-2, export lobbying, agreements). This goes into W8b-1. The Tech mockup showed 14 of the
  29 world techs; the build shows all 29.
- W8b-1 · Sonnet high · readouts for the UI (concern/approval parts, trust causes, stage/tension/talks progress, law
  status, briefing effect), honest Risk rows and levers, missing glossary terms · running.
  Next: W8b-2 Powers panel and W8b-3 World tabs + Risk UI, in parallel.
- W8b-1 · Sonnet high · ~7 min · selectors: concernParts, approvalParts, approval/trustCauses (from the cause ledger),
  stage/tension/talksProgress, lawStatus, briefingEffect, chinaWarOdds, theftYearOdds; honest Risk rows; levers for
  deleted actions removed; 19 glossary terms added · 66a339fc
- Running in parallel: W8b-2 (Powers panel), W8b-3 (World tabs + Risk UI), W11a (docs, ws4.ts checks, stale comments),
  W11b (ws4 split). Merge order: W11a, W11b, then W8b-2 and W8b-3 (UI on top). Expected conflict: RiskMap.tsx (one line,
  W11b vs W8b-3).
- W11a · Sonnet high · ~25 min · V2-SPEC: the old outside-world sections now point to OUTSIDE-WORLD.md; README and IA
  pointers added. ws4.ts passes in full:
  - The canon check now strips the player's own model names.
  - E23 shortened.
  - The E3 test sets a measured level.
  - T3 rewritten for the NPC-rule China: China trails the US frontier on ≥ 95% of days; mean trail within the cast
    span 90–270 d (measured 104 d).
  - T4: start gaps positive and ≤ 10 mo.
  - 19 stale history comments fixed.

  · 62b2c1ad
