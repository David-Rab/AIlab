// SAB probe 1: the successor-steering block of sabotage.ts against a given day400 fixture (arg: path).
import { readFileSync } from 'node:fs';
import { WORK_TYPES } from '../../../src/data/v2/workTypes';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { deserialize } from '../../../src/engine/v2/core/save';
import { resetWorkContext, workContext } from '../../../src/engine/v2/departments/workfit';
import { successorPull } from '../../../src/engine/v2/safety/traits';
import { covertOutcome, covertDraw, itemTerms, steerSuccessor } from '../../../src/engine/v2/safety/covert';
const path = process.argv[2];
const s = deserialize(readFileSync(path, 'utf8'));
for (const k of Object.keys(s.flags)) if (k.startsWith('ws2.covert.')) delete s.flags[k];
s.player.safety.footholds = [];
const DOMS = Object.keys(s.player.models.versions[0].domains) as any[];
console.log('file', path, 'day', s.time.day, 'versions', s.player.models.versions.map((v) => v.id + ':' + v.name).join(','));
for (const v of s.player.models.versions) { v.traitsTrue.SUCC = 1; v.uModes = []; for (const d of DOMS) v.domains[d] = 12; }
resetWorkContext(s);
const ctx = makeCtx(s);
const w = workContext(s).slots;
for (const k of ['SWE', 'EXP', 'IDEAS'] as const) console.log(k, 'H', w[k].H, 'L', w[k].L, 'ver', w[k].versionId);
const pull = successorPull(s);
console.log('pull omega', pull.omega, 'parts', JSON.stringify(pull.parts));
const cnt = { uncaught: 0, caught: 0, blocked: 0, other: 0 };
for (let k = 0; k < 300; k++) {
  pull.parts.forEach((p) => {
    const v = s.player.models.versions.find((x) => x.id === p.versionId)!;
    const terms = itemTerms(s, v, 'SUCCSTEER', p.share, WORK_TYPES[p.slot].H);
    if (k === 0) console.log('terms', p.slot, JSON.stringify(terms));
    const o = covertOutcome(terms, covertDraw(s, `SUCC:R${k}:${p.slot}`));
    (cnt as any)[o] = ((cnt as any)[o] ?? 0) + 1;
  });
}
console.log('outcomes over 300 runs', JSON.stringify(cnt));
