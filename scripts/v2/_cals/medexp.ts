// CAL-S probe: the domain score of a median domain expert, λ(G_SC − Δ_bm) (RD-U05), per world preset.
import { newGame, defaultSetupV2 } from '../../../src/engine/v2/core/init';
import { levelOfG, levelKnotsG, gV0 } from '../../../src/engine/v2/models/capability';
for (const world of ['ai2027', 'authors2026', 'slow', 'fast']) {
  try {
    const s = newGame(defaultSetupV2({ world: world as any, seed: 2027, tutorial: false }));
    const w = s.hidden.timeline;
    const tw = w;
    const k = levelKnotsG(tw);
    console.log(world, 'gV0', gV0(tw).toFixed(2), 'knots', k.map((x) => x.toFixed(2)).join(' '), 'dBM', tw.v3.dBM, 'median expert L', levelOfG(tw, tw.v3.gSC - tw.v3.dBM).toFixed(2));
  } catch (e) { console.log(world, 'err', (e as Error).message); }
}
