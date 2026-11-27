# Vision gap analysis: overview

The designer's far vision (2026-11-24):
- Play as any actor.
- Configure the world along several axes.
- Start earlier (2015–2023) or late.
- Keep playing past ASI.

This folder explores what the medium term needs for four goals: better actors, better balance, a longer time period, and different worlds. Each area has its own note:

| Note | What it covers |
|---|---|
| [ACTORS.md](ACTORS.md) | The ten actors today, what to clean up, and what each needs to become playable |
| [BALANCE.md](BALANCE.md) | How much bot skill leaks into the balance, how to measure it, and whether the targets are good ones |
| [TIME.md](TIME.md) | Everything tied to 2025–27, the options for an earlier start, and what runs away or runs out after ASI |
| [WORLDS.md](WORLDS.md) | What each setup setting really does, and a consolidation proposal |

The notes were written by reading the code; no tests or bots were run. Each note marks its verified facts and its judgement separately.

## What the four notes agree on

1. **Clean up first.** Many settings and meters promise more than the engine does:
   - Dead preset fields and meters, state that gets overwritten every day, and 10 preset descriptions that aren't honoured.
   - The economy labels are backwards: "Normal" is the slowest world and "Gated" the fastest.
   - The "Unknown" world is AI 2027 plus one random number.
   - Alignment "Unknown" and "Medium" are nearly the same.
   - Acts act as gates when they should only name the era.

   Every later step builds on these, so cleaning them up comes first.
2. **One actor model serves three goals.** Split each actor into observe, decide and apply steps, with a simple reference policy in the decide step. That gives:
   - simple NPCs;
   - a place for a player to take over, for player-as-China or player-as-government;
   - a sourced reference behaviour to calibrate against, for balance.
3. **Balance has two separate jobs.**
   - The world is calibrated against sourced, real-lab behaviour.
   - Difficulty is measured against the best policy a search can find.
   - Targets should pin down the model's shape: trends, responses to interventions, held-out anchors, invariants. They should not be single numbers that one fitted constant can hit.
   - Today both jobs rest on hand-written bots that are probably weak. The simulated leader lab reaches Superhuman Coder on day 576, against RefBot's 623 (CAL2.md:39,43).
4. **Time is mostly data, with a few real breaks.**
   - Most code reads the save's start date, so an earlier start needs dated start tables plus three fixes:
     - the capability scale stops at 0, about GPT-4;
     - the 2025 paradigms are already known at the start;
     - laws are tied to calendar dates.
   - After ASI, several curves grow with no physical limit, and no actor has a post-ASI state.
5. **Worlds become scenarios.** The setup becomes Scenario → Start → optional Custom, with the axes the designer listed. Difficulty stays on the start type.

## Proposed medium-term order (judgement)

| Step | What | Rough size | Needs a decision first? |
|---|---|---|---|
| 1 | **Cleanup:** remove dead or overwritten state, fix the labels, make acts only an era label, make "Unknown" honest, fix `yearOfDay`, stop China reading the player's private flags | 10–15 small tasks | Yes: delete or build each dead item |
| 2 | **Bot tools:** run games in parallel in `bots.ts`, gather policy choices into one parameter object, run a perturbation scan of RefBot's unsourced choices | 3–4 days | No |
| 3 | **Targets audit applied:** reclassify targets as keep / upgrade / INFO, and add response tests | about 2 days | Partly: allowed gap between a top player and the AI 2027 lab |
| 4 | **Actor structure:** observe / decide / apply for the government and China; NPCs react to every lab, not only the player | about 1 week | Yes |
| 5 | **Setup consolidation:** Scenario → Start → Custom | about 1 week, including UI | Yes |
| 6 | **Time:** a 2023 start, physical ceilings, the first continuing world (the player's aligned ASI) | large | Yes |

Steps 1 and 2 can run in parallel. Step 2's results decide how much refitting step 3 needs.

## Designer questions, merged and in priority order

**Cleanup**
1. For each dead parameter and each unhonoured preset description: build the promised behaviour, or delete it and reword the description?
2. Should a picked preset fix the actor, or act as a starting point that drifts? China blends today. And should a fixed Rivals pick give identical rivals or a mix?

**Balance**

3. How many months earlier than the AI 2027 lab may a top player reach Superhuman Coder?
4. Should RefBot research what real labs plausibly would, which means a refit?
5. Should difficulty labels come from a searched policy, which means overnight runs?
6. Should S4 and §7.4 become response-curve tests and best-policy bands?
7. Should rival aggressiveness, China efficiency and investor κ be dropped as balance knobs?

**Actors**

8. Should the government, the public and China react to every lab, not only the player?
9. Which actor becomes playable first: China, the government or the model? What wins for each of them?

**Time**

10. Is 2023 acceptable as the first earlier start? Should laws happen on their real dates, or only when the mechanisms produce them? Should the 2025 paradigms be research the player can miss?
11. Should the capability scale extend below 0, or be re-based?
12. Does first ASI become a phase change rather than an ending? Which continuing world comes first? Keep a hard calendar end?
13. Should we add physical ceilings, even though they shift the 2030s calibration?

**Worlds**

14. Should the true world equal the named scenario, or be drawn near it? Should "Unknown" use the full distributions, including the tail where no superhuman coder ever arrives?
15. Should compute growth be its own axis? Should difficulty be shown for scenarios, or only for starts?
