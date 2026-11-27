# N8b result: NPC money is display

Spec: NPC-LABS.md "NPC money is simpler". Moves calibration: yes (the leader-kind lab now grows 2.25x like the rest, not 4.5x; every lab's orders are no longer scaled by cash; no raises).

## What changed
- **One plan.** Every NPC lab plans start compute x 2.25 a year (`RIVAL_GROWTH` in compute/market.ts; China's lab keeps its meter, `planGrowthOf`). Per-kind `computeGrowthPerYear` removed from data/v2/npcLabs.ts, `appetiteOf` and `npcGrowthQ` removed from npc/lab.ts; `cPlanQ(s, r, ahead)` added.
- **Orders** (actors/rivals.ts rivalFinanceQ): each quarter order `plan(next quarter) - compute - on order`, weight 1.2, no cash factor. A supply shortfall leaves compute under plan (npcTarget's shortfall term now reads supply only) and the next order is larger by the gap; delivered orders top back up. Init's first order and the market's netting use the same single rate.
- **Money is display.** rivalMoneyQ no longer moves cash, raises or sets cash-driven distress. Revenue (market) and valuation (markRivals, the story) stay; `commitments` = yearly spend stays (bust target reads it). Removed: raises, `rivalRoundMax`, `RIVAL.dMax/raiseBelowYears`, the rivals' investor-pool part (`poolQ`) in markRivals.
- **Failure only through the bust.** `rivalMoneyQ`: a private lab named by `capital.busted.rival` on the bust day goes into distress and E32 is requested; still in distress next quarter it exits (`exitRival`). Nothing else sets `distress` for an NPC lab.
- **LEADER_ID** removed from finance/ and compute/ (the legacy `rL` lab is not built any more; the cast's leader kind is an ordinary NPC lab). `parentFunded` stays only to say which labs the bust cannot reach (bustTarget); its funding role is gone.
- Out-of-list edits needed to compile/keep tests meaningful: core/init.ts (first order uses RIVAL_GROWTH_Q), src/ui/v2/setup/Rivals.tsx (the "Compute growth" row of the personality editor removed), scripts/v2/npcData.ts and npcSetup.ts (dropped the field's checks).

## Test
`npx tsx scripts/v2/npcMoney2.ts` (direct calls, 40 ticks): all ok. tsc clean; npcData, npcSetup pass.

## Not run / left behind
- scripts/v2/finance.ts still has FIN5b checks for rival cash flow, raises and cash-driven distress (around lines 1750-1850); they now describe removed rules and will fail. Needs a rewrite or deletion (a long script; not run).
- glossary entry `npcAppetite` (data/v2/glossary.ts) is no longer used by any UI.
- `finance.cash` / `finance.poolQ` / `finance.raised` fields stay on RivalLab (start values; `raised` still feeds the exit payback text); not read for any decision.
- Longer checks the lead may want: a 900-day central run for the compute path against the old one (leader lab was 4.5x/yr), the supply-shortfall behaviour over several quarters in a real chip crunch, and a forced-bust run end to end.
