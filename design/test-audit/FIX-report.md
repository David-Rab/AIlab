# FIX report (branch ta-fix)

1. npcSetup.ts / npcLabs.ts: TEST-BUG/STALE. Corp's setup `labKind` 'safety' now replaces the safety NPC lab (LabKindDef.replacesNpc), so the old "challenger start" lost it. Tests now start as 'breakaway' (replaces the upstart lab, no other test uses it); the expected cast is derived from the replaced kind. Both pass. Commit "npcSetup, npcLabs: ...".
2. scenarios-lint.ts: not fixed (balance session's file). Two stale target ids in balance/scenarios.ts:
   - line 170 `H13.privateMarks.2025-07`: targetId `F9.fc1.privateMarks` -> `F9.fc1.start`
   - line 171 `H13.privateMarks.2026-late`: targetId `F9.fc1.privateMarks` -> `F9.fc1.late2026`
   (also update the "targets.ts:744" source text if wanted.) Lint stays red until the balance session re-points them.
3. worldChina.ts: the cost was the theft case (3 x up to 3 years of securitySystem.run on the day-900 state). At tension 2 each day ran rivalTheftHazard for every NPC lab (~36 ms per day, a frontier read per lab). The case tests theft against the player, so it now runs with `s.rivals = []`. Same checks, same assertions. ~13 s wall (was ~49 s wall / 86 CPU-s); loadLeading itself is cheap. worldUsgov: ~18 s wall, no change needed.
