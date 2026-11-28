# Back-of-envelope estimates: feasibility map (shared brief for the two map agents)

Designer's idea (2026-11-28): instead of heavy bot runs, a set of back-of-envelope calculations that estimate whether
the game is roughly balanced: take the engine's parameters and functions and run them on a few numbers. Very fast, no
games, no bots, no engine ticks, still catching things. Rules: design/TESTING.md §0 ("Back-of-envelope estimates",
"One home per target") and the skill good-tests (~/.claude/skills/good-tests/SKILL.md, section "Back-of-envelope
estimates"). Read both first.

Task: READ-ONLY map, no code. For each target of your share of balance/targets.ts (the registry; schema
balance/schema.ts), decide whether a back-of-envelope estimate can compute the quantity, and how:

| column | meaning |
|---|---|
| id | the registry id |
| verdict | YES (pure engine functions on reference inputs, no game) / PARTIAL (needs one simplification, say which) / NO (only a played game produces it: say why — emergent bot choices, feedback loop, path dependence) |
| chain | the engine functions it would call, in order, with file:line (2–4 calls; longer = say so) |
| inputs | where the typical inputs come from: reference curves (src/engine/v2/npc/reference.ts, refGAt, shareRefAt, hRef …), start tables (src/data/v2/…), fixtures (scripts/v2/fixtures/day0/400/900.json — allowed as a *state to read*, never to tick), sourced trajectories in balance/scenarios.ts. Name the export |
| drift risk | low (calls one high-level engine function) / medium / high (re-creates logic the engine has inline, or depends on several internals) |
| blocker | if the formula is inline inside a system's run() with no pure function to call: name file:line and the small pure function that would need extracting (a refactor proposal, not a mechanism change) |

Rules for the verdict:
- Never re-implement the engine's maths. If the only way is to copy a formula, the verdict is PARTIAL with a blocker
  (extract the function) or NO.
- A fixture may be read as a typical state, never ticked. Reading a fixture and calling a pure function on it is fine.
- Prefer the sourced reference path for "typical" inputs over fixtures (fixtures drift with every engine change).
- Be honest about NO: a target that is about emergent dynamics belongs in the played-game calibration report, and
  that's fine.
Also list targets that a BoE could cover even though the registry doesn't have them yet (only if there is a sourced
number in the repo for them — cite it), and any registry entries that look like they aren't targets at all.

Cost: reading only. No test runs, no scripts. Time budget 75 min. Output: your map file (name given in your prompt),
the table plus a 10-line summary (how many YES / PARTIAL / NO, the blockers worth extracting, the 5 estimates you'd
build first and why). Reply ~12 lines.
