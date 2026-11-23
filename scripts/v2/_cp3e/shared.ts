// CP3e probe: the leader lab's SC day on one seed alone vs after a RefBot game in the same process.
//   npx tsx scripts/v2/_cp3e/shared.ts alone|after [seed] [refDays]
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { tick } from '../../../src/engine/v2/core/loop';
import { LEADER_ID } from '../../../src/engine/v2/models/labs';
import { refGame, runRef } from '../lib';

const [mode = 'alone', seedS = '2027', refDaysS = '700'] = process.argv.slice(2);
const seed = Number(seedS);
const t0 = Date.now();
if (mode === 'after') {
  const r = refGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed }));
  runRef(r, Number(refDaysS), (x) => x.player.milestoneDays[3] !== undefined);
  console.log(`RefBot game to day ${r.time.day} (SC ${r.player.milestoneDays[3]}) ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
const s = newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed, tutorial: false, leaderLab: true }));
const L = s.rivals.find((r) => r.core.id === LEADER_ID)!;
while (s.time.day < 1200 && L.core.milestoneDays[3] === undefined && L.core.status === 'active') tick(s, { skip: ['endings'] });
console.log(`${mode} seed ${seed}: leader milestones ${JSON.stringify(L.core.milestoneDays)} ${((Date.now() - t0) / 1000).toFixed(0)} s`);
