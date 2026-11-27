# DC-6 Remove the stored-chip book decay

Removed: `MARKET.inventoryDecayQ` (src/data/v2/deals.ts:176), the `fx.inventory.book *= 1 - MARKET.inventoryDecayQ` line and
its comment clause (src/engine/v2/compute/market.ts:~312-315), the 6% sentence in the `idleChips` glossary body.
Check (scripts/v2/_dc6/check.ts): new game, 1000 ready chips at book 1000, four clearMarket calls: book stays 1000.
tsc (both projects) clean. For later: calibration may move (chip collateral and O&M on the chip book).
