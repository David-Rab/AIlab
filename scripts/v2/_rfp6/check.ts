// RF-P6 targeted check: the open-weights release preview reads only rules and the player's intelligence estimates: it
// does not move when hidden truth moves (the version's true G, China's and the rivals' models and recipes), and it moves
// when the estimates move.
// Run alone: npx tsx scripts/v2/_rfp6/check.ts
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { PRODUCT_ACTIONS } from '../../../src/engine/v2/models/productOps';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const s = newGame(defaultSetupV2({ seed: 2027, world: 'ai2027', alignment: 'medium', baseline: 'classic', tutorial: false }));
const act = PRODUCT_ACTIONS.find((a) => a.id === 'releaseOpen')!;
const v = s.player.models.versions[0];
const pv = () => JSON.stringify(act.preview(s, { versionId: v.id }));
const p0 = pv();
console.log(p0);
v.G += 3;
if (v.recG !== undefined) v.recG += 3;
if (s.china.lab.publicModel) s.china.lab.publicModel.G -= 1;
s.china.lab.internal.G -= 1;
for (const r of s.rivals) { r.internal.G -= 1; if (r.publicModel) r.publicModel.G -= 1; }
check(pv() === p0, 'preview unchanged when the true G of the version, China and the rivals change');
s.china.lab.intel.leadDaysEst += 100;
check(pv() !== p0, 'preview changes when your estimate of China\'s gap changes');

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
