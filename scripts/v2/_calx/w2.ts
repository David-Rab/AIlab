// CAL-X: W2 measurement (as worldfx.ts w2Rec, uncached) with yearly diagnostics. Run alone: npx tsx scripts/v2/_calx/w2.ts
import { tick } from '../../../src/engine/v2/core/loop';
import { gOfLevel, levelOfG } from '../../../src/engine/v2/models/capability';
import { LEVEL_KNOTS } from '../../../src/data/v2/calibration';
import { automationTfp } from '../../../src/engine/v2/worldfx/macro';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import type { TickOptions } from '../../../src/engine/v2/types';
import { refGame, refPlayProbe } from '../worldfx-refplay';
import { SECTORS } from '../../../src/data/v2/sectors';
const s = refGame({ econ: 'normal' });
const w = s.hidden.timeline;
const gA1 = gOfLevel(w, LEVEL_KNOTS[1]);
console.log('gA1', gA1.toFixed(2), 'L', LEVEL_KNOTS[1]);
const probe = refPlayProbe(s, { freezeAt: gA1, publicLag: 0 });
const opts: TickOptions = { extraSystems: [probe], skip: ['production', 'continual', 'endings'] };
tick(s, opts);
const tfp0 = automationTfp(s);
while (s.time.day < 3651) {
  tick(s, opts);
  if (s.time.day % 365 === 0 || s.time.day === 3650) {
    const m = worldMix(s);
    const A = SECTORS.map((x) => `${x.id} ${s.world.sectors.US[x.id].A.toFixed(2)}/${s.world.sectors.US[x.id].F.toFixed(2)}`).join(' ');
    console.log(`d${s.time.day} dTFP ${((automationTfp(s) - tfp0) * 100).toFixed(2)}% AG L ${levelOfG(w, m.sec.US.SOFT.g.AGENCY).toFixed(2)} best ${levelOfG(w, m.bestPublic.AGENCY).toFixed(2)} | A/F ${A}`);
  }
}
