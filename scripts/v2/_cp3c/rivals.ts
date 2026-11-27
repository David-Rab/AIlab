// CP3c probe: every non-player lab's internal / public G, base FLOP, recipe and adopted ideas, every 30 days.
import { defaultSetupV2 } from '../../../src/engine/v2/core/init';
import { refGame, runRef } from '../lib';
import { otherLabs, bestPlayerVersion } from '../../../src/engine/v2/models/labs';
import { CAL_SEED } from '../calseeds';
const s = refGame(defaultSetupV2({ world: (process.argv[2] ?? 'tl-central') as any, alignment: 'medium', seed: CAL_SEED }));
const N = Number(process.argv[3] ?? 420);
runRef(s, N, (x) => {
  if (x.time.day % 30 === 0) {
    const pl = bestPlayerVersion(x)!;
    console.log(`${x.time.day} player ${pl.G.toFixed(2)} | ` + otherLabs(x).map((r) => `${r.core.id} int ${r.internal.G.toFixed(2)} (b ${r.internal.build ? (r.internal.build.gPre.toFixed(2) + '+' + r.internal.build.dgRL.toFixed(2) + '+' + r.internal.build.dg.toFixed(2)) : '-'}) pub ${r.publicModel?.G.toFixed(2)} F ${r.phys.base.flop.toExponential(1)} pre ${r.phys.rec.pre.toFixed(2)} ideas ${JSON.stringify(r.phys.ideas?.done ?? {})}`).join(' | '));
  }
  return false;
});
