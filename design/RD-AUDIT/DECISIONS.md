# Designer decisions on SYNTHESIS.md §5 (2026-11-22)

All recommendations accepted, except:

- DD-01 Smaller models: real distilled models for everyone, no phantom sizes. Each product offers a LINEUP of
  real models the lab owns (not necessarily distilled: older full models, post-trains, distilled students); buyers
  choose among them per task. Every lineup entry is a real model (own serving cost, evals, traits, incidents).
  Auto "make a cheap tier" policy optional. Rivals' lineups are real objects at their simplified level.
- DD-18 Rivals: keep SIMPLIFIED rivals (rough aggregate simulation, not a full autonomous company: too hard to
  define strategies, balance, and too heavy on compute). But simplifications must be done properly: same units and
  quantities as the player; aggregate state; each simplification a stated stand-in with sourced/once-fitted
  parameters, no per-lab fudge factors to hit targets; their outputs (models, lineups, releases, leaks) are real
  objects in the world. DD-14 rival part = rivals adopt surviving paradigm effects through their aggregate research rate.
- DD-15 / DD-16 (safety) are superseded by a full SAFETY REDESIGN: the designer finds safety the messiest and least
  clear area (understanding, research lines, tool upkeep, investigations, ...). Hidden truth stays deliberate; the
  problem is that the player cannot tell what safety lets them do, what information and tools they have, and what
  each buys. Step 1 inventory (SAFETY-INVENTORY.md), step 2 first-principles redesign.

## Safety redesign (SAFETY-REDESIGN.md §8.1), 2026-11-22

The designer accepted all eleven recommendations (OD-1 … OD-11): headline = Loss-of-control risk + Unstopped harm / yr
with the sight-limit race small beside them; shown always as "if it could act now"; delete the blind-gap growth
amplifier and add the sourced "undetected hacking reinforced" mechanism if research backs it; ~10 visible safety lines
grouped by output (see / stop / fix / meta), data keeps 18; a Safety framework policy replaces the eval-gate toggle;
trusted watcher models chosen automatically (override allowed); organism realism as a hidden per-world factor if
research finds a range, else none; default disclosure = legal minimum; safety engineers' order set in LAB (one
allocator); SAFETY grouped by harmful acts (Risks tab first); "train against an instrument" stays as a method with an
honest preview. SR-01 … SR-30 (§8.2) replace RD-B04 / B05 / B06 and DD-15 / DD-16.

## Calibration during the rebuild (2026-11-22)

Designer: "no point in doing calibration to systems that will change." No refits while mechanisms are being replaced:
calibration happens at CP2 (after the engine unification, Phases 2–3) or later, on the unified engine. Known failures
carried until then are listed in BUILD-NOTES (first: authors2026 SIAR −0.27 y / ASI −0.49 y after RD-B08; the preset's
fitted G_SC / Δ_bm / sd_SC were fitted with the bug present — RDB08-CAL.md; sd_SC 2.15 vs AIFM median 0.5 to be
re-checked against its source at the refit). Tasks still report calibration movement ("moves calibration") so CP runs
can attribute it.

## CP3 decisions (2026-11-23)

- **Start in equilibrium (designer).** Each lab's day-0 recipe gap to the leader is capped at what the diffusion rule
  sustains in steady state; the rest of a lab's day-0 capability (e.g. Anthropos's near-frontier model on 40% of the
  leader's compute) belongs to its start model's own build, which others cannot copy. No day-0 diffusion jump.
- **RL gain form (lead, from research/RD-RL-scaling.md).** RL gain per OOM of RL FLOP as the sources measure it, midpoint
  ∝ FLOP_pre^0.5, so base size still matters (DD-06) but sub-linearly (≈ 1.2 G per OOM of training FLOP, not ≈ 1.6).
- **"What binds" readout (lead, UI-IA OQ-5).** Reads the lab's believed production parameters (published prior band);
  physics keeps the hidden draw.
- ~~**Pre-release evals before validation jobs (lead, EV9)** in the default safety order.~~ Reverted (RF-S6, review safety #6).
- **Safety methods uncertain at scale (designer, S4).** A method keeps its sourced effect at the capability it was tested
  on; above that its true efficacy moves toward a wide per-world hidden draw. P_mis is emergent from that uncertainty;
  the S4 target (RefBot P_mis at ASI 0.55–0.85) applies to the average over worlds. The player sees believed efficacy only.
- **China compute anchor (designer, CP3k).** China's main lab keeps AI 2027's compute share (≈ 1/3 of the US leader),
  equal recipe efficiency with diffusion; CHINA_CAL deleted.

## Post-compaction review decisions (2026-11-23)

Three independent reviews of the post-compaction work (design/RD-AUDIT/review/*.md). Designer's answers:

1. **Numbers kept for now.** Stand-in numbers carried over from the old effects (tool shares 10/15/20%, ×1.2, ×1.3,
   ADAPT_COVER, certification $0.4B / 120 d, KYC costs, BRAND_INSTALLED, China efficiency, slow preset r, ...) stay
   until the calibration stage, which first tries to source each number (primary sources) before refitting.
2. **Day-0 tools from history.** Every lab starts with the product tools it really had shipped by 2025-07-01; RD-P07b
   (rivals shipping tools through an idea gate) is deleted.
3. **Rivals stay simplified, with the right overall shape.** The automatic rival sector-adaptation rule (RD-P08) is
   deleted unless something critical depends on it.
4. **Not knowing counts as risk.** The Safety framework hold and the trusted-watcher rule read the upper end of the
   belief, not the best guess; no clarity gate.
5. **Rival safety physics: left as is for now** (designer, after review/rival-safety.md options A/B/C): a dedicated
   rivals session later decides. Known gaps are listed in review/rival-safety.md.
6. China efficiency and 7. slow preset r: see 1 (source at calibration).
8. **Safety methods at scale:** the hidden at-scale efficacy can go either way around the tested effect, and validation
   narrows the player's belief about it.
9. **One mechanism per job (safety):** Fix environment folds into Harden; the Safety framework replaces the old pledges
   and pause commitment and the fixed safeguard packages (one "meet my framework" package by default).
10. **UI-IA.md:** its unapproved items (loss-of-control gauge on every tab, top-bar changes, internal tooling in LAB) and
    its open questions wait for the UI phase.

The reviewers' smaller lead calls (thresholds, lineup caps, etc.) stay as defaults.

## Follow-ups to the review fixes (2026-11-23, designer accepted the lead's recommendations)

- **Framework package applies itself.** When a framework rule requires safeguards, the computed "meet my framework"
  package is applied automatically (player can change it); no hold-and-override loop. The default framework thresholds
  are sourced from the real 2025 frameworks (Anthropic RSP, OpenAI Preparedness) as the first sourcing item of
  calibration, so 2025-level models don't trigger requirements.
- **Validating a safety method** = the same validation job as an instrument (cost, need, VAL_N): plant the trait in a test
  copy, train it with the method, count planted cases removed (k of n). Organism realism applies to methods too (one
  rule). The result narrows the lab's belief about the method's at-scale strength most at the tested capability, widening
  again above it.

## Calibration decisions after CAL1 refits (2026-11-23, designer accepted all lead recommendations)

1. One isolated run of the AI Futures timelines model (AIFM) on Eli's medians, to source authors2026 G_SC and its takeoff shape.
2. S4 target re-sourced to the AI Futures authors' credences (≈ 0.40–0.80); re-judge after item 9.
3. Start research-speed M target = each preset's source value (ai2027 1.25, authors2026 1.10, fast 1.15, slow 1.01; ± 0.1).
4. S5 Mixed-bot check restated for the sight limit (e.g. Mixed's sight limit at SAR above RefBot's).
5. Adoption (Bass q / p) fitted to the measured Census BTOS growth; then check the revenue floor's own source if they clash.
6. hireSlope 1.2 (once-fitted stand-in, lands HireRate_SOFT on Jul 2027).
7. Slow preset keeps G_SC 38.3 (top of its source range) as a stated stand-in; no slow-horizon mechanism now.
8. One focused task: world gates still reading v2 level thresholds on the RD-U05 shifted scale (persuasion, tier gate,
   INFRA CYBER, risk exposure, tech gates, PHYS gate, mSci), plus V0 measuring BIO 0.
9. Graders at the median expert (L 6.4), not the best human.
10. DISAGREE_DROP deleted (the disagreement record stays).
11. Framework "High" level per world (the world's own median expert).
12. At-scale q upper end 2 stays a stand-in.
13. Memory's chat appeal deleted.
14. KYC_REFUSE 0.25 kept (sourced, high end).
15. DISTILL_HARVEST_SHARE into its sourced range: 0.0015.

## After CAL2 (2026-11-23, designer accepted)

- authors2026 sd_SC 2.94 (AIFM taste at SC, not at AC) accepted.
- Human review of R&D and the debate overseer stay at the best human (only RL graders moved to the median expert).
- V0 measuring BIO 0 and AGENCY gates reading one level above v2: a later measurement-scale task (sourced best-human
  reference per domain), not this calibration.
- Last calibration round: (1) adoption during takeoff (a sourced mechanism for adoption speeding up with capability /
  value, keeping the 2025–26 Census fit); (2) S5 RefBot 15% analysis only. Then calibration closes; S4 (0.377 vs
  0.40–0.80) and authors2026 post-SC shape (rival diffusion) are re-judged in the rivals session.
- S5 RefBot row is INFO only (review/S5-analysis.md option c): the ≥ 50% is a design reading, the row is a ±6 pp lottery.
  Option (a), a sourced "instruments get harder with capability even after re-fitting" term, maybe later at the designer's choice.
- Adoption: Mansfield profitability term (CAL3-A) merged; π_ref 1.65 is a stated stand-in.
- Last calibration task: usage intensity per adopter (revenue = breadth × intensity, sourced from measured 2025–26
  token-per-hour growth). The Oct 2027 "25% of remote work" and "U +1 pp in 12 months" rows become INFO (AI 2027
  scenario projections, like F11's floor). After this, calibration is closed (designer: "these really are the last things").

## UI-IA open questions (2026-11-23, designer accepted the lead's re-thought recommendations)

Rethought from what the player needs, not from the current UI:
- OQ-1 units: effect shown where it lands (change in the next model's skill bars); know-how as "× effective compute"; OOM only in tooltips / never L0–L1.
- OQ-2 scientists: LAB sets the department split (capability vs safety scientists); RESEARCH's priority order assigns them to work automatically.
- OQ-3 naming: "programme" (ongoing, falling returns) and "project" (one-off, works or not) for both capability and safety, tagged by output; final words via VOCAB.
- OQ-4 work: primary = time to finish with current staff + staff used; team-weeks only in breakdown tooltips.
- OQ-5 "What binds" from the lab's beliefs (built, RD-UI0a) confirmed.
- OQ-6 skills: bars between median-expert and best-human ticks (+ superhuman mark); no raw 0–15 at L1.
- OQ-7 internal AI staff safeguards: home SAFETY › Safeguards (one stop-rate formula); LAB links.
- OQ-8 evals: home MODELS › Evals; TRAINING links.
- Loss-of-control risk: small L0 top-bar item linking to SAFETY; full gauge = SAFETY headline only.
- Top-bar contents (research speed, compute online): decided after the UI audit.
- Internal tooling (AI-staff boosts): RESEARCH, as an owned built thing (DD-03); not LAB.
