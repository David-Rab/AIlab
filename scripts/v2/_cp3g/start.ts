// CP3g probe: day-0 recipe lag, own recipe rate, base G_pre and the player's diffusion inflow per lab, then G at days 90/180.
import { defaultSetupV2 } from '../../../src/engine/v2/core/init';
import { refGame, runRef } from '../lib';
import { otherLabs, bestPlayerVersion } from '../../../src/engine/v2/models/labs';
import { recipeOf } from '../../../src/engine/v2/actors/rivalModel';
import { playerRecipeG } from '../../../src/engine/v2/models/stacks';
import { recipeDiffusionPerDay } from '../../../src/engine/v2/production/diffusion';
import { CAL_SEED } from '../calseeds';
const s = refGame(defaultSetupV2({ world: (process.argv[2] ?? 'tl-central') as any, alignment: 'medium', seed: CAL_SEED }));
const show = (x: typeof s) => {
  const pl = bestPlayerVersion(x)!;
  const d = recipeDiffusionPerDay(x, 'player' as any);
  console.log(`day ${x.time.day} player G ${pl.G.toFixed(3)} rec ${playerRecipeG(x).toFixed(3)} diff/yr ${(d.dG * 365).toFixed(3)} ${d.from ?? ''}`);
  for (const r of otherLabs(x)) console.log(`  ${r.core.id.padEnd(10)} int ${r.internal.G.toFixed(3)} pub ${r.publicModel?.G.toFixed(3)} rec ${recipeOf(x, r).toFixed(3)} gPre ${r.phys.base.gPre.toFixed(3)} F ${r.phys.base.flop.toExponential(2)} diff/yr ${(recipeDiffusionPerDay(x, r.core.id).dG * 365).toFixed(3)}`);
};
show(s);
runRef(s, Number(process.argv[3] ?? 180), (x) => { if (x.time.day % 90 === 0 && x.time.day > 0) show(x); return false; });
