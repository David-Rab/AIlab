# N5 result: endings and epilogue read the NPC lab's m

Branch `npc-n5`. Code: `endings/epilogue.ts`, `actors/rivals.ts` (deleted `projectLabMis`; nothing else read it, no other helper became dead).
Test: `scripts/v2/npcEndings.ts` (direct calls on a fresh state, no simulation).

- Rule 7 / `resolveAsi`: exposure and `mis` of an NPC lab = `r.npc.m` via `misOf`; lost when m > theta_w, contained check as before (no change needed).
- `projectedMisAtAsi` (NPC lab) = `npcM(s, max(ASI G, internal G), safety, race response, npc.p)`: mWorld at the ASI G with the lab's posture safety and today's p. Safety and race response come from `postureOf`, the same values the daily m uses, so the projection equals the daily m at that G.
- `otherContain` = 0.2 x `persOf(npc).safetyEmphasis`. `alignedPower`, `leadingCompetitor`, `epilogueSurvival` already read only kind/archetype, G and lag; unchanged. `scoring.ts`, `view.ts` read nothing removed.

Checks (all pass): m above theta gives rivalTakeover, below gives rivalAligned; projection equals npcM and is at most mWorld; otherContain formula; `endingView` builds.
Calibration: maybe. Projected m now follows today's p instead of a trait loop, so epilogue outcomes and the expected-doom score term shift slightly; no longer test run.
