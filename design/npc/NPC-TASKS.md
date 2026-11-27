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
| N1 | Reference frontier: the AIFM run's progress series as G_ref(t); `npc/reference.ts` `refG`, `clockOfG` | Sonnet high | — | done, merged |
| N3 | M_world: state-free `referenceEnv`, reference lineage per world, memoised mean curve (σ_cyc dropped) | Sonnet high | — | done, merged; fingerprint identical |
| N3b | Check the probe's "heavy safety raises misalignment" | Sonnet high | — | done |
| N3c | ~~Option B: k per world~~ — **cancelled** (designer approved the cut-down model, 2026-11-27): k = 0.5 constant | — | — | cancelled |
| N7 | Remove `cooperation` (writes, the star hire's displayed "trust with rivals" cost, the meter) | Sonnet medium | — | done, merged bbec174 |
| N2a | Data: personality table (7 values per kind), the Realistic cast (CAST-2025.md, O5), noise table (O4), invented names | Sonnet high | — | done, merged bbec174+ |
| N2a2 | R1 generic start-internal rule + R2 one release cadence from Epoch ECI (spec §16) | Sonnet medium | N2a | done, merged |
| N2b-1 | NPC lab core: state, init from the Realistic cast, the daily lag / model / release step, adapters so every existing reader keeps working (spec §3–4) | Opus high, reason (c) | N1, N2a, N3 | done, merged |
| N2b-2 | Race pressure, misalignment m (M_world), incidents (spec §4, §7) | Sonnet high | N2b-1 | done, merged |
| N4 | Market: generated lineups, serving cost, domain focus offsets, tools from capability (TOOL-REQUIREMENTS.md) | Sonnet high | N2b | done, merged (tool build time set to 120 d by the lead) |
| N5 | Endings and epilogue read m and the headline milestones; drop `projectLabMis` | Sonnet high | N2b | running |
| N6 | Shocks (§6): theft, absorb, IP access, poach in, let go, joint evals, treaty, safety spillover, Track-2 leak; China's continuous channels | Sonnet high | N2b | running |
| N8 | Finance and the chip market: no `LEADER_ID` special case; compute orders from compute appetite | Sonnet high | N2b (funding option 1) | superseded by N8b (designer: NPC money is display-only) |
| N8b | Simple NPC money: one compute growth 2.25×/yr through the chip market, money display-only, failure only through the bust; keeps N8's LEADER_ID removal and order top-up | Sonnet high | — | running |
| N9 | Public values with noise replace the intel model (intel.ts, index grades, hubView lanes, risk sources) | Sonnet high | N2b | done, merged |
| N10 | Setup UI: Realistic default + advanced "Create rivals" (good-ui skill) | Sonnet high | N2a, N2b | done, merged (override field renamed pers) |
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
| N3 | accepted pending the fingerprint pair | ~45 min (over budget: its fingerprint ran > 20 min and was stopped) | Function-level identity 19,968 comparisons, 0 diffs. M at ASI easy 0.29 / medium 0.43 / central-hard 0.51 / hard 0.60; monotone in G; ~30 ms (max 102 under load). Reference without the start tools (lead). |
| N1 | accepted (lead checked the test: max |G(AC) − gSC| 0.0009 on 9 runs) | ~55 min (incl. the decomposition stop and two rescopes) | 0.1-yr grid (quarterly missed AC by up to 1.4 OOM). Progress dips in 3 of 869 runs (max 2.38 OOM below the running max). 4 runs > 0.05 OOM at AC (fast runs at 750-1100 OOM/yr). |
| N3 fingerprint | identical | ~25 min | botfingerprint --seeds 2 --bots ref (6 games, tl-fast/central/slow): 35b24c9 vs npc f7b6d1d, byte-identical. N3 refactor proven behaviour-neutral for the player. |
| N2b-1 | accepted (lead re-ran tsc and scripts/v2/npcLabs.ts after the merge: all ok) | 2 h 20 min (over budget; stopped during the whole-game comparison) | SCHEMA_REV 113, no migration: ws4/control/products crash on stale fixtures (expected; regenerate). Open: private labs cannot fund their compute appetite (Marenth 111 d behind by day 900; Lanternworks, Zorvane distressed ~mid-2027) — designer decision. Leftover worktree AI27-npc-n2b1-base for the designer to remove. |
