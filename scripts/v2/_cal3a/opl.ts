// CAL3-A probe: λ⁻¹(L) and OOM per level on ai2027. Run alone: npx tsx scripts/v2/_cal3a/opl.ts
import { oomPerLevel, gOfLevel } from '../../../src/engine/v2/models/capability';
import { newGame, defaultSetupV2 } from '../../../src/engine/v2/core/init';
const s = newGame(defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', tutorial: false }));
const w = s.hidden.timeline;
for (const L of [5, 6, 7, 8, 9, 10, 11, 12]) console.log(L, gOfLevel(w, L).toFixed(2), oomPerLevel(w, L).toFixed(3));
