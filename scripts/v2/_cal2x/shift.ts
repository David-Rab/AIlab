// CAL2-X probe: per-world domain reference shift, V0's raw domain G vs general G, and λ points.
import { newGame, defaultSetupV2 } from '../../../src/engine/v2/core/init';
import { domainRefShift, levelOfG, gOfLevel, versionDomainG } from '../../../src/engine/v2/models/capability';
import { DOMAIN_IDS } from '../../../src/data/v2/calibration';
for (const world of ['tl-fast', 'tl-central', 'tl-slow'] as const) {
  const s = newGame(defaultSetupV2({ seed: 2027, world, alignment: 'medium', baseline: 'classic', tutorial: false }));
  const w = s.hidden.timeline;
  const v = s.player.models.versions[0];
  console.log(world, 'dBM', w.v3.dBM, 'sdSC', w.v3.sdSC, 'V0 G', v.G.toFixed(2), 'L0/5/10/12/13.5/15 G', [0, 5, 10, 12, 13.5, 15].map((L) => gOfLevel(w, L).toFixed(2)).join(' '));
  console.log('  shift', DOMAIN_IDS.map((d) => `${d} ${domainRefShift(w, d).toFixed(2)}`).join(' '));
  console.log('  V0 rawG-G', DOMAIN_IDS.map((d) => `${d} ${(versionDomainG(v, d) - v.G).toFixed(2)}`).join(' '));
  console.log('  V0 v2-raw L', DOMAIN_IDS.map((d) => `${d} ${levelOfG(w, versionDomainG(v, d)).toFixed(2)}`).join(' '));
}
