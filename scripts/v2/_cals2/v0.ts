// CAL-S2 probe: V0's domain levels (true) by world and seed (the U05_SHIFT reference point).
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
for (const world of ['tl-fast', 'tl-central', 'tl-slow'] as const)
  for (const seed of [2027, 1, 6, 42]) {
    const s = newGame(defaultSetupV2({ world, alignment: 'medium', seed, tutorial: false }));
    const v = s.player.models.versions[0];
    console.log(world, seed, v.name, (['CODE', 'RSCH', 'AGENCY', 'SOCIAL', 'CYBER', 'BIO'] as const).map((d) => `${d} ${v.domains[d].toFixed(2)}`).join(' '));
  }
