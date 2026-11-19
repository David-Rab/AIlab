# Model v3: task list (replaces the phase-sized plan for everything after V4a)

Status 2026-11-19. Phases V1–V3b, V2b and V4a are done (see [V3-BUILD.md](V3-BUILD.md) and [PROGRESS.md](PROGRESS.md)).
The phases ran 2–9 hours per agent and kept hitting several stop rules at once, so from here **work is cut into small
tasks**, one subagent each, one at a time. Spec: [MODEL-V3.md](MODEL-V3.md). Numbers: research/20.

## Task protocol

- **One concern, one agent.** A task touches a handful of files and has a single "done when". If it needs more, the agent
  stops and reports instead of widening (the lead splits it).
- **Brief = this table row + the spec section.** The lead adds only what the row cannot hold.
- **Effort:** `M` = Opus medium (well-scoped, little judgement: UI wiring, removals, content tables, test updates,
  perf, research gathering). `H` = Opus high (mechanism design, calibration, anything with trade-offs).
- **Gate for an engine task:** `tsc` (main and scripts), the task's own test, `golden-timelines`, `identity`, `worktypes`,
  `research`, `serving`, `effective`, `calib` T1. No new failures beyond the known list below. **Gate for a UI task:**
  `npm run build` and `npm run test:ui` (extend it for the new view), screenshots looked at.
- **Every task ends with:** a commit series on `model-v3`; a short "notes" block appended to V3-BUILD.md under its ID
  (choices marked [D], deviations, readouts for later tasks); one line in the PROGRESS V-table; no schema bump unless
  state changed (then bump once).
- **Stop rules:** a golden date leaves tolerance by more than ±0.3 y after refitting only the named values; the task
  needs a mechanism that contradicts the spec; a test the task does not own newly fails and cannot be explained.
- **Known failures (not ours):** finance F7 / F8 / F11, valuation, equity 2026 (owned by the finance session, spec
  `../AI27-finance3`); safety S5 mixed; worldfx GOV T1; ws4 T3; hygiene perf (task P2); the bots table is reported, not
  required, until V7.
- **Bridges** still alive: see V3-BUILD "Bridges" (V6 safety M reads, V7 rivals). Each task removes the ones it owns.

## A. World demand (the real cause of V4a's revenue shortfall)

V4a found that revenue is demand-bound: sector adoption is tuned to measured firm adoption (AI covers about 2% of
work-hours in 2026), the price per hour is realistic, so the world market is about $60B and the leader gets about $20B.
The model is missing demand, not price. Finance targets are not retuned (finance session).

| ID | Task | Depends | Effort | Done when |
|---|---|---|---|---|
| A1 | Research: 2025–26 AI demand anchors from primary sources: hours of AI use per worker vs firm adoption (worker surveys), share of use that is non-work, token volumes disclosed by providers, disclosed lab revenue (official statements and filings only), consumer paid-subscription counts and price. Write `research/22-demand-anchors.md` with a summary table and tags like research/20. | – | M | file written; every number tagged [P]/[R]/[UNVERIFIED]; a "game-ready" section says which world quantities the data fixes (hours per adopted work-hour, non-work share, subscriber stock) |
| A2a | Hours and value per hour (research/22 §1–2): fit sector adoption A to worker-level / employment-weighted use (≈40% of workers, ≈15% of their hours ≈ 6% of work-hours in 2026), not BTOS firm counts; set hours saved per hour of use to ≈0.35 (replaces α + (1 − α)·g_aug ≈ 0.6 at the start, still rising with agency). Re-fit only the Bass start values `A0` to the new anchors. | A1 | H | US hours of use ≈ 6% of work-hours in 2026 in the worldfx run; W4 and hiring checks re-reported; golden dates unchanged |
| A2b | Consumer demand (research/22 §3–4): non-work share ≈0.7; weekly reach and paid share (≈5.5%) as stocks; subscribers × ARPU $20–25/month as a revenue line independent of work hours; free-user tokens ≈8–10k per user-day (was 1.6k) feeding the serving need. | A2a | H | leader consumer subscribers ≈50M-class and ≈$13B/yr in the 2026 reference run by mechanism; serving tests pass |
| A2c | Paid plans vs free/bundled use, and the agent-work term (research/22 §5–9). A2a found the sector market (≈$134–235B in mid-2026 incl. CN) already exceeds the frontier-lab band because most measured work use is not on a paid plan (free tiers, bundled, in-house) and CN spend goes mostly to Chinese labs. So: (1) paid enterprise seats (≈50M mid-2026, $20–30 per seat-month, growing) as a stock that is a *subset* of the workers using AI (W·E), with the rest on free/bundled use that costs serving compute but earns nothing directly; (2) an agent-work term: token intensity per human hour and agent-hours not tied to one human hour (parallelism k per supervising human), so spend and serving need can grow faster than human-attended hours; (3) revisit the assisted-hour token profile (100k/15k or 200k/40k tokens is much heavier than research/22's chat use). A2b found the player starts capacity-bound (≈350k H100e serving pool vs ≈3.4M H100e of consumer plus sector need): check the demand units against research/22's token volumes (Google ≈32B tokens/min API) and the start fleet, and report whether the start fleet is realistic. Constants from the research or marked [D]; no fitting to a revenue target. | A2a, A2b | H | non-China frontier-lab revenue lands in research/22's $100–130B band for 2026 by mechanism (reported with the leader's share); W2, U +1 pp (currently 2028-01-22 after A2b, band ends 2027-12-31), GOV T1 re-checked; serving tests pass; golden dates unchanged |
| A3 | Price decline at fixed capability is ×3.6/yr vs the sourced ×10/yr (research/20 D3). Diagnose (rental path, algorithmic progress in serving, the rival FLOP bridge) and fix the mechanism, not a constant. | – | H | fixed-capability price falls within ×6–×30/yr in the serving test; no revenue refit |
| A4 | Demand ceiling on agent work (found by A2c: at day 900 an agent-hours-per-supervising-hour of ≈12 gives ≈$31T/yr of demand-side agent spend). Agent-hours substitute human work-hours only up to the sector's work; the part beyond is new output with a demand elasticity (Jevons) and a value, so spend cannot exceed the value of the work. Source or mark [D] the elasticity. Check the day-900 fixture and a takeoff run. | A2c | H | agent spend in a takeoff run stays below the sector wage bill × a stated expansion factor; serving tests pass; golden dates unchanged |

A2a–A2c done (2026-11-20). Result: hours of use, consumers and paid seats match research/22's growth rates; the 2026
non-China provider revenue is $72B vs the research's $100–130B (not tuned; the gap comes from regional scaling, rivals'
open weights, RefBot's late product upgrade, and the unsourced agent check-in time c = 15 min).

## B. Product and world UI for V4 (was "V4b")

| ID | Task | Depends | Effort | Done when |
|---|---|---|---|---|
| B1 | Product card: cost and price per hour of use (chat: per subscriber-month), margin, share sold at the value cap, tier as a markup, capacity vs asked hours with need/served/cut split into paid and free users. | – | M | card shows the readouts with tooltips and glossary entries; uitest extended |
| B2 | Customers and features: customer stock vs its target and speed; typed feature effects (enabler, horizon, scaffold, effort with ΔG and token multiplier), build cost and upkeep. | B1 | M | features listed with typed effects; uitest |
| B3 | World › sectors: each sector's work-type data, coverage, feasibility F and cost gate K, price per AI work-hour plus review vs wage, provider prices, stock vs target. | – | M | World panel shows them with tooltips; uitest |
| B4 | Retire UI for removed things (M^0.3, research-speed cap, serveCost), fix empty space on the Research and Work tabs, add "auto" for teams wanted, keyboard path for drag. | – | M | no reads of removed concepts (lint); screenshots checked |

## C. Housekeeping

| ID | Task | Depends | Effort | Done when |
|---|---|---|---|---|
| P2 | Performance: profile the daily tick (4.0 ms vs a 1.5 ms budget; +15% since V3b). No behaviour change: same state hashes on the fixtures. | – | M | `hygiene` perf checks pass or the remaining gap is explained function by function |

## D. Data, environments, evaluations (was V5)

Spec §9, §10, §4.3. Today: `dataAssets` (licensed, unlicensed, synthetic token counts), RL graders as a menu option, eval
suites as fixed days.

| ID | Task | Depends | Effort | Done when |
|---|---|---|---|---|
| D1 | Data portfolio model: assets of five kinds (public, licensed, usage, synthetic, expert) with tokens, domain mix, quality; unique-token stock U per base from it (replaces `effectiveStock`); the public stock is shared and finite. No new UI. | – | H | base planning reads the portfolio; effective tests updated; same start numbers (U = 300T-class) |
| D2 | Data actions: licensing deals by domain (cash), synthetic generation as a compute budget with a teacher (quality from teacher G, inherits traits), expert data purchase. Remove the old data actions. | D1 | M | actions work and show before/after on the Blueprint data tile |
| D3 | Data mix on the blueprint: the base draws tokens from the portfolio by domain and quality; domain specialisation s_d,data and repetition come from the draw. | D1 | H | specialisation follows the mix in a test; V1 design offsets for data options retired |
| D4 | Data UI: portfolio view (kinds, tokens, quality, domain mix), data actions, mix control in the Blueprint. | D2, D3 | M | uitest |
| D5 | Environment suites model: one suite per RL family with fidelity (scales the RL ceiling A_f) and exploitability (feeds trait signal S2); built and hardened by engineers (team-weeks) with expert-data cash; the "hardened graders" option becomes suite state. | D1 | H | RL gain reads fidelity; S2 reads exploitability; start suites reproduce V1's reference gain |
| D6 | Suites UI: suites per family, build/harden actions, effect preview. | D5 | M | uitest |
| D7 | Evaluations as work: an eval task needs research-engineer and engineer work plus inference compute (tokens on benchmark and agent tasks); depth sets noise and elicitation; a standing policy runs them. Replaces fixed eval days and the 30-day expiry. | – | H | eval cost shows up in allocations and compute; measured level noise falls with depth; tests |
| D8 | Evals UI: policy, depth, cost, measured vs believed levels. | D7 | M | uitest |
| D9 | Wire the LATER(V5) ideas P10 (synthetic flywheel), P12 (long-horizon demos), P21 as typed effects on data/suites. | D1, D5 | M | their effects typed and tested; `LATER(V5)` markers gone |

## E. Safety and alignment (was V6)

Spec §11. The trait graph, detection, investigations and agendas stay; what changes is where pressure comes from, what
danger depends on, and how loss of control works.

| ID | Task | Depends | Effort | Done when |
|---|---|---|---|---|
| E1 | Safety lines on the project mechanism, rates: each line project gets ideation, experiments and scale-like stages with compute and research-engineer labour like capability projects (no hidden asymmetry); hidden efficacy and dead ends kept. | – | H | the safety lines speed up with the lab's labour and compute in a test; the v2 "no research speed" asymmetry gone |
| E2 | AI labour on safety work: SAF_EXP and SAF_IDEAS work types drive the safety fleet via the V3 labour function; sabotage risk from the model's own traits; the "trusted to AI" share stays the player's control. | E1 | H | safety AI FTE from work types; sabotage test |
| E3 | Training pressure from run quantities: S2 from RL FLOP × exploitability (needs D5), S3 from agentic RL share and task length, S1 from preference share, S5 from G and AI-data share; replace the design-table constants. | D5 | H | signal tests: more RL FLOP raises S2; calibrated to the research/20 F rates |
| E4 | Successor pull: when AI does a share of the R&D that trains the next model, the new model's dispositions are pulled toward its own, ∝ AI share × (1 − oversight). | E3 | H | test: higher AI share and weaker oversight raise the pull |
| E5 | Danger formula for incidents: rate = disposition × capability × opportunity × (1 − oversight) with capability from the relevant domain level and opportunity from the deployment (horizon given, affordances, copies, AI R&D share). Replaces κ·x^1.5. | – | H | incident rates scale with capability and opportunity in tests; start rates match research/20 F |
| E6 | Oversight in domain levels: monitor catch rate and tool decay measured in the capability gap in levels/OOM, not in the research multiplier M (Engels: 9–52% at a 400-Elo gap); control tax on AI labour. Removes the BRIDGE(V6) M reads. | – | H | no safety code reads M (lint); catch-rate test |
| E7 | Research sabotage and steering: covert acts that corrupt safety work or steer capability research and successors, from the danger formula. | E5, E6 | H | consequences appear in research output and traits; tests |
| E8 | Footholds: hidden countable AI assets created by covert acts (backdoor, steered successor, hidden compute, exfiltrated copy, corrupted tool); detection finds and removes them; the player sees suspected ones and symptoms. | E7 | H | state, creation, detection and removal in tests |
| E9 | Loss of control as a process: effective-control state from footholds, capability and oversight; resolves outcomes with the world's hidden difficulty; replaces the one roll at ASI in endings and epilogue. | E8 | H | endings tests; no single-roll path left |
| E10 | Calibrate safety rates to research/20 F (hacking, eval awareness, faking, sabotage after hacking, inoculation effect) and the edge strengths' ranges. Report. | E3–E6 | H | table of simulated vs observed rates |
| E11 | Safety UI 1: footholds and symptoms, danger readout per deployment (disposition, capability, opportunity, oversight), control level and its tax. | E8, E9 | M | uitest |
| E12 | Safety UI 2: trait families on top with traits one level down, training-pressure view per run, successor pull. | E3, E4 | M | uitest |
| E13 | Wire the LATER(V6) ideas P14, P15, P23, P27 as typed effects on the safety mechanisms. | E1–E6 | M | `LATER(V6)` markers gone; tests |

## F. Rivals, China, robustness, finish (was V7)

| ID | Task | Depends | Effort | Done when |
|---|---|---|---|---|
| F1 | Rivals in G (also removes the oversized rival FLOP-per-token bridge that inflates rival agent spend at takeoff): recipe efficiency from their own research rate and compute (aggregate, no ideas), releases on a cadence at G = log10(FLOP) + e; their FLOP per token from their own model size, not the bridge. Removes BRIDGE(V7) credits and CAL_SHIFT for rivals. | – | H | rivals' G paths in tests; no `simpleLag`/`simpleCredit` |
| F2 | China and the leader lab (Polaris) on the same model; diffusion and theft add to stacks; fixes ws4 T3 band and post-theft lag. | F1 | H | T3 and T4 pass; T1L within tolerance |
| F3 | Display level λ(G) for every lab from one map; retire the pm bridge Φ. | F1, F2 | M | no `pm` readers (lint) |
| F4 | Multi-seed calibration: the three per-preset values must hold across seeds (authors2026 was a point fit); report the golden spread over 20 seeds per preset and widen or re-derive. | F3 | H | spread table; presets within tolerance on the median seed |
| F5 | Bots: rebalance RefBot and the §7.4 criteria after A–E. | F3, A2c, E9 | H | bot table; criteria met or the conflict reported |
| F6 | UI pass against good-ui across all panels touched in v3 (vocabulary, tooltips, empty states) and the jank audit of the new systems. | all | M | audit file; fixes listed |
| F7 | Merge plan: model-v3 into master (the finance branch rebases onto it), schema notes, changelog. | F6 | M | merge-ready branch; user decides |

## Order (one at a time)

Next: **B1 → B2 → B3 → B4**, **P2**, then **A3**, **A4** (A1–A2c done: research/22 and V3-BUILD notes), then D1…D9, E1…E13, F1…F7. The lead may reorder when a result changes what is next; every change goes in this file.
