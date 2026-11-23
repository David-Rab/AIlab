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
- **Pre-release evals before validation jobs (lead, EV9)** in the default safety order.
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
