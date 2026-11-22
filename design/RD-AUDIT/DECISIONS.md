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
