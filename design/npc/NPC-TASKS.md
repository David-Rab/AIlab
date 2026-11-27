# NPC headline labs: task file

Spec: draft 2 (the cut-down model, 2026-11-27). Branch `npc` (worktree `C:\Users\david\Documents\projects\AI27-npc`), from master 6bf46bc, 2026-11-27. Spec:
`design/npc/NPC-LABS.md` (+ CAST-2025.md, TOOL-REQUIREMENTS.md, MISALIGNMENT.md in this folder). Lead: Opus 5.5 main
session. Agent rules: the lead's memory `subagents`. Each task agent gets its own worktree and branch `npc-<id>` off
`npc`; the lead merges into `npc`. Saves may break (no migrations). `master` stays the designer's playtest build until
the merge wave.

**Worktree hazard:** each task worktree's `node_modules` is a junction into the main checkout's. Never
`git worktree remove --force` one; the lead removes the junction first (`cmd //c rmdir <dir>\node_modules`).

## Plan

| ID | Task | Model | Depends on | Status |
|---|---|---|---|---|
| N1 | Reference frontier: the AIFM run's progress series as G_ref(t) in the generated draw data; `npc/reference.ts` `refG` and `clockOfG` (rescoped to the cut-down model) | Sonnet high | — | running |
| N3 | M_world: state-free `referenceEnv`, reference lineage per world, memoised mean curve (σ_cyc dropped) | Sonnet high | — | finishing |
| N3b | Check the probe's "heavy safety raises misalignment" | Sonnet high | — | done |
| N3c | ~~Option B: k per world~~ — **cancelled** (designer approved the cut-down model, 2026-11-27): k = 0.5 constant | — | — | cancelled |
| N7 | Remove `cooperation` (writes, the star hire's displayed "trust with rivals" cost, the meter) | Sonnet medium | — | done, merged bbec174 |
| N2a | Data: personality table (7 values per kind), the Realistic cast (CAST-2025.md, O5), noise table (O4), invented names | Sonnet high | — | done, merged bbec174+ |
| N2a2 | R1 generic start-internal rule + R2 one release cadence from Epoch ECI (spec §16) | Sonnet medium | N2a | done, merged |
| N2b | NPC lab core (spec draft 2 §3–5, §7): state type keeping the outward contract (Appendix A), init from cast + kind, the daily step (lag relaxation with compute shortfall, compute, internal/public model on the 119-day cadence, race pressure, m, incidents) | Opus high, reason (c) | N1, N2a, N3 | next |
| N4 | Market: generated lineups, serving cost, domain focus offsets, tools from capability (TOOL-REQUIREMENTS.md) | Sonnet high | N2b | wave 3 |
| N5 | Endings and epilogue read m and the headline milestones; drop `projectLabMis` | Sonnet high | N2b | wave 3 |
| N6 | Shocks (§6): theft, absorb, IP access, poach in, let go, joint evals, treaty, safety spillover, Track-2 leak; China's continuous channels | Sonnet high | N2b | wave 3 |
| N8 | Finance and the chip market: no `LEADER_ID` special case; compute orders from compute appetite | Sonnet high | N2b | wave 3 |
| N9 | Public values with noise replace the intel model (intel.ts, index grades, hubView lanes, risk sources) | Sonnet high | N2b | wave 3 |
| N10 | Setup UI: Realistic default + advanced "Create rivals" (good-ui skill) | Sonnet high | N2a, N2b | wave 3 |
| N12 | Remove the old NPC simulation and dead state (spec §13) | Sonnet medium | wave 3 | wave 4 |
| N13 | Shape checks (spec §14) as a script + dashboard tab | Sonnet high | wave 3 | wave 4 |

Open follow-up (sourcing): release lags from system cards' stated testing windows (CAST-2025.md §5b gap).

## Log

| ID | Result | Time | Notes |
|---|---|---|---|
| N3b | accepted (lead verified traits.ts:866-872: the override replaced the map that folds in AG18 healing) | 4 min | Probe error; heavy safety lowers Mis in the real path. Option B unblocked. Write-up: main checkout .scratch/N3b-heavy-safety.md |
| N7 | accepted | 17 min | 13 files; no action left without effect; fixtures still carry the field (harmless, regenerated in N12). Lead fixed one stale registry evidence string. |
| N2a | accepted | 16 min | Names replaced (most of §12 collided with real companies/products). Findings 1-6 became the lead rulings R1-R5 (spec §16). Press-only: xAI money/headcount, upstart funding. |
| N2a2 | accepted (rescoped mid-task per principle 7) | ~25 min | One cadence 119 d (median of 27 flagship steps, range 15-317) [P]; generic internal rule. CSV read through a summarising fetch: rows may be missing, fine at shape level. |
