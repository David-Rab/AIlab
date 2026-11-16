# Model blueprint — IA note (v3)

Screen: Models › Blueprint, base run "Atlas-4". Shots: `v3-blueprint.png` (×2 as designed),
`v3-blueprint-size.png` (size dragged to ×4, before→after), `v3-blueprint-hover.png` (nested tooltip).

## Levels and homes

| Datum | Level | Home (single) | Notes |
|---|---|---|---|
| Date, speed, L vs U (7.3 / 6.9, 0.4 blind), risk 9%, cash + runway, revenue (users in its tooltip), lead, alerts | L0 | Top strip | Not repeated on this screen. Atlas-3.1's 7.3 shows only as an unlabeled reference tick on the ruler |
| Size (×2, 6.1e27 FLOP), snap points ×¼…×8, Atlas-3 reference tick | L1 | Size card (hero) | The Size slot row links up to it ("set above") |
| Size limits: wall time, behind at finish, data ratio, cash + runway after, restart risk, serving cost, engineers' build load | L1 | Size card, 7 limit tiles | Totals for the whole base run. Status border = state (good / watch / bad / neutral). Every tile: tooltip with breakdown + source of the limit (R11) |
| Predicted L band (8.0–8.5) vs Atlas-3.1 | L1 | Predicted model card, ruler | |
| Domain deltas (top 4) | L1 | Predicted card | The full 9 domains and radar: Model card (L2) |
| Risk pressure per family vs Atlas-3.1 (▲/=/▼) | L1 | Predicted card | The families' current estimates live on Safety; here only the push |
| Planned package (use + monitor) | L1 | Predicted card, one line | Link to Company (internal uses) |
| Run plan: Atlas-4 base → post-train → evals, ready date; know-how wedge (shape only) | L1 | Plan card | Running Atlas-3.2 appears as a bar without numbers (its ETA lives in Runs) |
| Pool share (40 / 60 / 80 %) | L1 control | Plan card | |
| Slot cards (selected + alternatives), locked cards with the tree node / its progress | L2 control | Blueprint table | Alternatives beyond 4 collapse to "+N" |
| Per-card effects in 5 fields (capability, time, cash, serving, risk ×4 families) | L2 | Blueprint table, one row per slot | Values are the card's own contribution; ref = reference card. Tile totals are their sums |
| Layer per slot + what a change rebuilds (Backbone → new base; Training → post-train; Scaffold → engineering build) | L2 | Group header rows | Scaffold row is a link to Products |
| Trait-level detail (16 traits), S1–S8 signals, edge grades, citations | L3 | Tooltip on each risk arrow; codex | Removed from the surface |
| Domain-level effects of a card (e.g. multimodal AGENCY/MEDIA +0.6, PHYS +0.5) | L3 | Tooltip on the capability cell | |
| Cost breakdowns (compute, data, envs), restart-risk curve, data tokens needed vs owned | L3 | Tile tooltips | |
| Node details of a locked card (effort, odds, prerequisites) | L3 | Tooltip; click → Research | |

## Demoted
Radar (→ Model card), S1–S8 signals and edge grades (→ tooltips), per-trait bars (→ risk-arrow tooltip),
citations (→ codex), alternatives beyond 4 per slot (→ "+N" picker), Atlas-3.2 ETA (→ Runs tab).

## Glossary terms needing tooltips
frontier run · FLOP · Backbone / Training / Scaffold layer · base run · post-train · distill · continue · wall time ·
know-how · behind at finish (staleness) · data wall · runway · restart risk · Fault-tolerant training · serving cost ·
team-month / build queue · pool share · MoE · latent-recurrent (Neuralese) · native multimodal · hazard filter ·
safety pretraining · training focus · hardened graders · visible / pressured / faithful / latent reasoning ·
constitution · inoculation · honesty training · anti-scheming · risk families (People-pleasing, Gaming, Deception,
Power) · capability level L · research agent milestone · evals policy.

## Variant notes
- `?size`: thumb at ×4 with a dashed ghost at ×2; every tile shows `old → new` with a dashed old marker; ruler
  ghosts the old band; Start stays enabled (no hidden cap — every cost is a visible trade-off).
- `?hover`: "Behind at finish" tooltip locked (lock bar), child tooltip open on the term *know-how*.

## Open questions
1. Effects are shown vs the reference card, the summary vs Atlas-3.1. Two baselines; maybe one is enough.
2. "Behind at finish" zones (≤3 mo good, 3–6 watch, >6 bad) are a judgement, not a sourced limit (R11).

Resolved: Data filter is a Backbone slot (STRUCTURE). The wall-time tooltip states it uses the chip-delivery forecast
(training pool grows during the run, so ×4 is 204 d, not 2 × 118 d).
