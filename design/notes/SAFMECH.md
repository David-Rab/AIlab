# SAFMECH notes: three safety mechanisms the sources imply (branch `w-safmech` from master 424ed78, 2026-11-21)

Task (design/V3-TASKS.md SAFMECH; found by S5R, design/V3-BUILD.md "S5R" §4). Principle (user): outcomes emerge from
sourced mechanisms, never a forcing rule. Nothing was tuned to S4's band or to S5's threshold.

Commits: 9e801e9 (1, targeted sabotage), a0ebcc6 (2, monitoring coverage, schemaRev 42 → 43), c992786 (3, U's
range), then fixtures regenerated + FIN5b migration check (the last commit before these notes).

## 1. Targeted sabotage of safety research (9e801e9)

Sources (verbatim):
- AI 2027, Sep 2027 (S5R's PDF read): "Agent-4 sandbags on some alignment research. Specifically, it sandbags on the
  small fraction of alignment research that it thinks is actually on track to solve the problem or reveal Agent-4's
  scheming; the majority of alignment research is not like that."
- Anthropic, "From shortcuts to sabotage: natural emergent misalignment from reward hacking" (blog of MacDiarmid et al.
  2025, arXiv 2511.18397), fetched 2026-11-21: "12% of the time, the model would intentionally attempt to sabotage the
  code in ways that would reduce our ability to detect reward hacking and other misalignment if the sabotaged code were
  to be used." The abstract: "attempting sabotage when used with Claude Code, including in the codebase for this paper".
  So the anchor item (κ_SAFSAB's 12%) was a detector of the model's own misbehaviour: threat 1.

Rule (safety/covert.ts, findings.ts, investigations.ts, lineProjects.ts):
- threat(work, v) = Σ_{t ∈ work's traits ∩ H} x_t ÷ Σ_{t ∈ H} x_t, H = the misaligned tendencies (traits with
  `difficulty`), x = the saboteur's TRUE levels. A line's work = its agenda's coverage.
- Per result: the honest result is drawn first; only an on-track one is attacked (TECH / EVAL tool, a discovery, a
  cross-check about to expose a masking tool: threat 1), with E7's odds × threat. Uncaught: a tool becomes F49 (rigged:
  MacDiarmid's weakened detector that still validates); a discovery or cross-check is sandbagged into a dead end (hidden
  count `covert.SAFSAB.sandbagged`, no foothold). Caught: an incident, the result discarded (as before). Dead ends,
  plain negatives, spillovers are never touched.
- Labour sandbag (E7's lost AI labour): × the line's threat, so threatening lines stall and the rest run at speed. The
  line ETA / cycle readouts leave the hidden sandbag out (a sandbagged line runs slower than the lab expects: a symptom,
  not a leak).
- Investigation corruption: × the case's threat (a case on the saboteur's own lineage, by its traits).
- Previews (Trusted to AI, Investigate) and RefBot's trust rule use the believed threat: the lab's trait estimates ×
  each staffed line's believed efficacy (believedResultThreat, believedCaseThreat). Never truth (tested).

Tests (scripts/v2/sabotage.ts, 29 pass): FALSE = P(honest tool) × uncaught rate × threat (4.1% vs 4.3%); caught only
on on-track results; sandbagged discoveries at the same uncaught rate (3.3% vs 3.3%); AG16 (no coverage) and AG03
without persona untouched; labour sandbag only on threatening lines; readouts without the sandbag; believed threat
independent of the true traits. safetyideas' P27 source check accepts the threat argument.

## 2. Monitoring coverage from monitoring spend (a0ebcc6, schemaRev 43)

Sources (verbatim, S5R's read):
- AI 2027 fn 51: "With a monitoring budget of 1% of total compute, if monitoring uses a distilled system that has 10% of
  the cost as Agent-4, you can monitor 1/10 of the forward passes."
- Compute forecast: the monitoring row from "a model with an average inference cost around 10x lower … checking roughly
  half of all input/output tokens", "divide by 20 to get our estimate for the share of compute on monitoring".
- Apr 2027: "monitoring Agent-3's outputs using a series of weaker AI systems including Agent-2".

Rule (departments/agents.ts): coverage = budget ÷ Σ (watched use's compute × its monitor's cost ratio), capped at 1;
cost ratio = monitor FLOP per token ÷ watched FLOP per token (one monitor pass per watched pass; `monitorCoverage(0.01,
1, 0.1) = 0.1`, fn 51). Coverage multiplies every monitor's catch and strength (already wired: catch, runtime
observations, internal incidents, covert-act oversight). The budget is the player's setting, policies.monitorBudget (a
share of the safety pool; default 0.2 = the old standard reserve); budget beyond full coverage stays with the lines.
Before: 20% × (need ÷ standard need) of the pool at coverage 1, whatever it watched. D7's 0.25 overhead stays the
products' serving rule (open question below).

RefBot (bots/ref.ts refMonitors): spends 1/20 of the watched fleets' compute (the forecast's "divide by 20") on the live
model whose cost is nearest 10% of the watched model's (a copy while it has nothing cheaper). In play its coverage at
SAR ≈ 0.47 (mean of 20 worlds; monitors ≈ 8% of its safety pool), cost ratio ≈ 0.08–0.1.

State: PlayerLab.policies.monitorBudget; migration 42 → 43 sets 0.2 where missing (idempotent; hygiene check). Action
`agents.monitorBudget {share}` with a preview (coverage before → after, H100e from / back to the lines).
UI (good-ui, minimal): Safety › Policies › "Monitor internal agents" shows "N of 4 uses · X% watched · Y% of safety
compute" and a −/+ budget stepper (blocked with a reason: no monitor set, already full, whole pool); its tooltip breaks
down budget, spent, full-coverage need, coverage at the next step. The lane catch tooltip's row is now "Coverage (passes
watched)". Glossary: monitorCoverage (fn 51 quoted), agentMonitor rewritten. lint-ux / lint-hidden / test:ui pass.
Tests: products.ts M1–M5 (fn 51 arithmetic; coverage = budget ÷ watched at cost ratio 1; more budget, cheaper monitor →
more coverage; the action), hygiene 42 → 43.

## 3. Believed U's range (c992786)

Diagnosis (S5R §4): believed U reads posterior means; fewer results keep them at the priors and keep the model's
believed EA / OBF at their predictions, so less safety compute does not lower U. The point estimate is the right
posterior-mean reading; what it hides is how little is known. Fix: understandingBand (safety/understanding.ts): U
recomputed on 24 Latin-hypercube draws from the lab's beliefs (each tooled line's efficacy from its Beta posterior,
normal approximation; the internal model's believed EA and OBF from est ± sd), the central 80%. Beliefs only; draws fixed
per world (hash of the seed). Display and tests only: no mechanism reads it (so S4 / S5 numbers are mechanism 1 + 2's).
Source framing: AI 2027 Apr 2027 "Step 2, verifying that the model is aligned, is inconclusive"; Sep 2027 box on effort
uncertainty. UI: a dashed range on the race meter's U bar and a "Likely range L a–b" row in its tooltip; glossary uRange,
U's entry links it. Tests (safety.ts): the same posterior means on a third of the results widen the range and lower its
bottom (day-400 fixture: 6.55–8.25 vs 7.05–8.15 vs 7.40–8.10 at ×3); changing hidden efficacy and true traits moves
nothing. S5 now prints the range at SAR.

## Numbers

Before = M10 merge (master a829f0a → 424ed78 has the same safety code). "20 seeds" = probes on S5's first 20 RefBot seeds
500–519, to SAR (`.safmechtmp`, not committed). Full = `run.ts --tier full --only safety,safetyrates,sabotage,control,
footholds,danger,signals` (twice: after 1 + 2, and on the final code; identical safety numbers, as 3 is display only).

| | before (M10) | after 1 (20-seed probe) | after 1 + 2 = final (full, 40 worlds) |
|---|---|---|---|
| S5 RefBot: believed U < L at SAR | 60%, median −0.69 | 45% (20 seeds; M10 on the same 20: 55%), mean −0.78 vs −1.44 | **50% of 40, median 0.00: PASS (at the threshold)** |
| true U < true L | 80%, median −5.45 | 75%, mean −6.90 (M10 same seeds −6.0) | 80%, median −5.25 |
| believed U's 80% range at SAR | – | – | bottom below L in 90% of worlds; mean width 4.48 levels |
| S4 RefBot P_mis at ASI (band 0.55–0.85, not tuned) | 0.593 | – | **0.635** |
| S4 safe-only | 0.024 | – | 0.021 |
| S5 mixed, median min margin | −0.07 (holds 70%) | – | −0.28 (holds 60%) PASS |
| deep: neuralese | −4.40 vs −1.44 | – | −3.43 vs −0.95 (55% vs 50%; true −6.30 vs −5.54) PASS |
| deep: half staff | −1.98 vs −1.44 (true −10.0 vs −6.0) | – | −2.05 vs −0.95 (70% vs 50%; true −9.46 vs −5.54; range 7.21 vs 4.45 levels) PASS |
| deep: sabotage ×2 at Trusted 100% | −1.40 vs −0.03 (50% vs 20%; true −5.90 vs −4.22) | −0.62 vs −0.21 (true −3.12 vs −2.06) | **−0.03 vs −0.15 (20% vs 25%; true −4.32 vs −4.46): FAIL** |

Why the sabotage check now fails (the emergent result, not forced either way). Per game to SAR at Trusted 100% (20
seeds, final code): rigged tools 0.50 → 0.65, sandbagged results 0.30 → 0.70, caught 0.45 → 0.75 at ×1 → ×2, out of ≈ 18
results; the work AI does on threatening on-track results is a few results a game, so doubling it moves U by less than
the paired-world noise. After mechanism 1 alone (monitors at full coverage) the same probe deepened the lag (above); with
coverage ≈ 0.47 fewer acts are caught and discarded and more are rigged tools, which raise believed U, so the believed
effect cancels. That is the source's picture ("the majority of alignment research is not like that"), and also a weak
test: see open questions.

Half the safety compute (S5R's observation, final code, 20 paired seeds): believed U − L −0.82 vs −0.95 (+0.13, still
not lower: posterior means), true −6.29 vs −5.54 (−0.75); **the range widens 4.45 → 4.97 levels, its bottom falls
7.60 → 7.23, and its bottom is below L in 100% vs 80% of worlds**: the display now says how little is known.

safetyrates (full, 20 / 0 / 6 WARN, the known WARNs): F5 AF behavioural reading end 2026 12.0% [6.6–14.5] (band 0–15%,
pass; M10 9.3%), AF trait 19.1% (17.5%), EA end 2026 54.7% WARN (52.7%), F2 37.9% / 4.1%, F3 9.7%, F6 persistence rows
71–74% WARN (known). danger 27 / 0, control 33 / 0, footholds 35 / 0, signals pass, sabotage 29 / 0.

Incidents and covert acts (RefBot, 20 seeds, per game to SAR): after 1: incidents 5.35 (internal 3.25), uncaught internal
acts 7.70, footholds 0.30, Trusted to AI 0.15 at SAR; final: incidents 4.80 (internal 2.70), uncaught 7.85, footholds
0.15, Trusted to AI 0.01 (lower believed oversight at coverage ≈ 0.47 keeps RefBot's trust rule near 0). Half the
safety compute: internal incidents 3.75, uncaught 10.6. (No M10 probe of these counts exists; the danger script's start
rate is unchanged, 1.16 acts per lab-year.)

Golden dates (`npm run test:cal`, once, not refitted): **49 pass, 0 fail, the 9 known WARNs** (T1 A1 / A2; T1L
authors2026 SIAR / ASI). T1 20-seed medians, Δ y vs golden (M10 in brackets): ai2027 SC −0.038 (−0.037) / SAR −0.083
(−0.082) / SIAR −0.073 (−0.062) / ASI −0.007 (−0.007); authors2026 +0.049 (+0.051) / −0.089 (−0.088) / −0.025 (−0.027) /
+0.094 (+0.089); fast +0.010 (+0.008) / +0.101 (+0.101) / −0.016 (−0.016) / −0.094 (−0.096); slow SC +0.050 (+0.050).
T1L ai2027 SC 611 / SAR 802 / SIAR 900; fast and slow in tolerance. T1's runner plays refPlay (no refMonitors), so only
the default monitor budget's unspent share returning to the lines reaches it: moves ≤ 0.011 y.

## Tests run

tsc (main + scripts) clean. test:quick (iterating): fails only worldfx A2a 6.7% / W4 23.5% (known since S5R).
Full tier ×2 (above), test:deep once (22 / 1: the sabotage check), npm run build, lint-ux, lint-hidden, test:ui once (686
/ 0), test:cal once. Fixtures regenerated (`fixtures.ts --write`): the seed-2027 golden INFO lines are M10's (SC 589,
SAR 736, SIAR 826).

## Open questions

1. S5's sabotage check (×2 vs ×1 at Trusted 100%, 20 paired worlds) is underpowered once sabotage is targeted: ~1–2
   acted results per game. Options: compare against no sabotage (κ × 0), more worlds, or read the believed range / true U
   only. Not changed here (no re-design of S5 to pass).
2. S5 sits at its 50% threshold (median 0.00). Mechanism 1 raised RefBot's believed U (more trust, fewer discards);
   mechanism 2 took the trust back. Not tuned.
3. D7's product monitors still cost 0.25 × the FLOP-per-token ratio of serving at full coverage; internal monitors now
   follow fn 51 (one monitor pass per watched pass). One rule for both would need the market code (other worktrees).
4. The default player's coverage at the start is 17% (a copy of V0 on routine and frontier research, 20% of a 2% pool):
   the player must pick a cheaper monitor or spend more. A tutorial hint may help (UI, not done).
5. RefBot keeps one model as monitor for both research uses and none on its safety agents; the source monitors "every
   line of code" with Agent-3 copies. A RefBot monitor on its safety agents is a further sourced choice.
