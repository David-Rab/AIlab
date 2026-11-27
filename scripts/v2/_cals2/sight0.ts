// CAL-S2 probe: the sight limit at day 0 (ai2027, medium) per seed.
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { sightLimit } from '../../../src/engine/v2/safety/sightLimit';
for (const seed of [900, 901, 500, 501]) {
  const s = newGame(defaultSetupV2({ seed, world: 'tl-central', alignment: 'medium', tutorial: false }));
  const r = sightLimit(s);
  console.log(seed, `level ${r.level.toFixed(2)} sight ${r.L.toFixed(2)} [${r.lo.toFixed(2)}–${r.hi.toFixed(2)}] gap ${r.gap.toFixed(2)}`, JSON.stringify(Object.fromEntries(Object.entries(r.perTrait).map(([k, v]) => [k, Number(v!.toFixed(3))]))));
}
