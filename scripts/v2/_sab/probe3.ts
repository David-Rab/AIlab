// SAB probe 3: how often do 300 runs contain no uncaught successor-steering act? (arg: fixture path; 200 batches of 300 with other draw keys)
import { readFileSync } from 'node:fs';
import { WORK_TYPES } from '../../../src/data/v2/workTypes';
import { deserialize } from '../../../src/engine/v2/core/save';
import { resetWorkContext } from '../../../src/engine/v2/departments/workfit';
import { successorPull } from '../../../src/engine/v2/safety/traits';
import { covertOutcome, covertDraw, itemTerms } from '../../../src/engine/v2/safety/covert';
const s = deserialize(readFileSync(process.argv[2], 'utf8'));
for (const k of Object.keys(s.flags)) if (k.startsWith('ws2.covert.')) delete s.flags[k];
s.player.safety.footholds = [];
const DOMS = Object.keys(s.player.models.versions[0].domains) as any[];
for (const v of s.player.models.versions) { v.traitsTrue.SUCC = 1; v.uModes = []; for (const d of DOMS) v.domains[d] = 12; }
resetWorkContext(s);
const pull = successorPull(s);
const hist: number[] = [];
for (let b = 0; b < 200; b++) {
  let u = 0;
  for (let k = 0; k < 300; k++) for (const p of pull.parts) {
    const v = s.player.models.versions.find((x) => x.id === p.versionId)!;
    if (covertOutcome(itemTerms(s, v, 'SUCCSTEER', p.share, WORK_TYPES[p.slot].H), covertDraw(s, `SUCC:B${b}R${k}:${p.slot}`)) === 'uncaught') u++;
  }
  hist.push(u);
}
const mean = hist.reduce((a, x) => a + x, 0) / hist.length;
console.log(process.argv[2], 'mean uncaught per 300 runs', mean.toFixed(2), 'batches with 0:', hist.filter((x) => x === 0).length + '/200', 'dist', JSON.stringify([0, 1, 2, 3, 4, 5].map((n) => hist.filter((x) => x === n).length)));
