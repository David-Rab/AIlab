# NPC headline labs: task file

Branch `npc` (worktree `C:\Users\david\Documents\projects\AI27-npc`), from master 6bf46bc, 2026-11-27. Spec:
`design/npc/NPC-LABS.md` (+ CAST-2025.md, TOOL-REQUIREMENTS.md, MISALIGNMENT.md in this folder). Lead: Opus 5.5 main
session. Agent rules: the lead's memory `subagents`. Each task agent gets its own worktree and branch `npc-<id>` off
`npc`; the lead merges into `npc`. Saves may break (no migrations). `master` stays the designer's playtest build until
the merge wave.

**Worktree hazard:** each task worktree's `node_modules` is a junction into the main checkout's. Never
`git worktree remove --force` one; the lead removes the junction first (`cmd //c rmdir <dir>\node_modules`).

## Plan

| ID | Task | Model | Depends on | Status |
|---|---|---|---|---|
| N1 | Reference frontier: AIFM per-run series (software efficiency, training compute) into the generated draw data; `npc/reference.ts` (S_ref, C_ref, G_ref at a reference-clock date, and the inverse) | Sonnet high | — | wave 1 |
| N3 | M_world: state-free `referenceEnv`, reference lineage per world, memoised curve + σ_cyc (MISALIGNMENT.md §2) | Sonnet high | — | wave 1 |
| N3b | Check the probe's "heavy safety raises misalignment" (0.42 → 0.53): probe bug or a real non-monotonic effect in the player's safety model | Sonnet high | — | wave 1 |
| N3c | Option B (designer, 2026-11-27): k generated per world. A second reference curve M_best(G) at a full-effort safety recipe (heavy safety + the methods of MISALIGNMENT.md Q3 at the world's true efficacy), seed-averaged; k_w(G) = 1 − M_best/M_world; replaces k = 0.5 | Sonnet high | N3 | after N3 |
| N7 | Remove `cooperation` (writes, the star hire's displayed "trust with rivals" cost, the meter) | Sonnet medium | — | done, merged bbec174 |
| N2a | Data: personality table (7 values per kind), the Realistic cast (CAST-2025.md, O5), noise table (O4), invented names | Sonnet high | — | done, merged bbec174+ |
| N2a2 | R1 generic start-internal rule + R2 one release cadence from Epoch ECI (spec §16) | Sonnet medium | N2a | done, merged |
| N2b | Headline lab core: state type keeping the outward contract (Appendix A), init from cast + personality, the daily step (software dynamics, compute, internal/public model, release cadence, race pressure, misalignment, incidents) | Opus high, reason (c) | N1, N2a, N3 | wave 2 |
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
