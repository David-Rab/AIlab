# NPC ↔ player fixes (approved by the designer 2026-11-28, full scope)

Evidence: `C:\Users\david\Documents\projects\AI27-cal\.scratch\npcaudit\AUDIT.md` (24-row audit) and `.scratch\diff\DIFF.md` (the diffusion bug). Integration branch `bal`. Numbers (Pellory's compute/lag, race-pressure bands) are NOT changed here; they go to design/OPEN.md.

## The one rule
An NPC lab's state is its **lag d**: it has what the reference frontier had d days ago. Wherever an NPC touches the player, the lag is converted to the right quantity:
- **know-how (software)**: `S_ref(refYear − (d + releaseLag)/365.25)`, the reference SOFTWARE level, with no compute term;
- **capability**: `G_ref(...)` as today.
Never mix them: never subtract compute from G to get know-how (that was `npcRecipe`'s bug).

## Fixes
| # | What | Rule |
|---|---|---|
| F0 | Software reference path | Per game, `S_ref` = the drawn AIFM run's progress − training compute (OOM, rebased at 2025.445, as N1-RESULT.md describes), emitted next to TIMELINE_PROGRESS by aifm-runs/scripts/fixc_series.py; a `refS` reader mirroring `refG`. Must be monotone non-decreasing (check; if a run isn't, take the running max and report how many). |
| F1 | Diffusion (rule A) | Public level P(t) = max over active NPC labs of their know-how (above). A **diffused level D** relaxes toward P: dD/dt = max(0, P − D)/τ (τ = `cap.DIFFUSION_TAU_DAYS`, kept). **The player's effective recipe = max(own, D)** in recipe units (own = the player's recipe without public inflow). No double counting: once own research overtakes D, D adds nothing. Align units so a lab on the reference path with the player's start position has P = the player's start recipe. |
| F1b | Know-how bars | The know-how bars show the player's own level and the diffused level, and which is in effect (designer: "it should be shown in the know-how bars"). Player language. |
| F2 | Tacit knowledge from poaching (`tacitLeakG`) | Uses the same know-how level (F1), not `npcRecipe`; it raises D (not the own level), so it can't double count either. |
| F3 | Open-weights releases | Only China absorbs (as before the NPC merge), closing a share of its **know-how** gap to the releaser (expressed as a lag change). |
| F4 | China's spies (secrets leak) | Closes a share of China's **know-how** gap to the player (as the pre-merge code did), not of the whole capability gap. |
| F5 | Publishing | Gives away a share of the **know-how** gap, not of the whole lead. |
| F6 | Theft | One integration rule (today two rules apply to one theft and the second overwrites the first). |
| F7 | Lead readouts (`bestG`, `lagDays`) | Compare like with like: the player's latest public model vs each NPC's latest public model (both stepped). |
| F8 | Clean-up | Remove `npcRecipe`'s compute term and any dead code; OPEN.md gets: NPC models sized by compute but priced as frontier (audit #2), NPC demand not capped by capacity (#3), race pressure at max from Pellory's placeholder band (#8), Pellory's numbers. |

## Checks
Targeted tests per task; then a checkpoint (test:quick, test:ui) and a forced remeasure on tl-central (12 seeds) against M4 and the pre-NPC replay (seed 2027: SC 1094).
