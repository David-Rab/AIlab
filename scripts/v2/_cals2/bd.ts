// CAL-S2 probe: backdoors / hidden compute expectation, start terms vs per-day terms.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { deserialize } from '../../../src/engine/v2/core/save';
import { resetWorkContext } from '../../../src/engine/v2/departments/workfit';
import { covertRecord, fleetCovertTerms, rollFleetCovert } from '../../../src/engine/v2/safety/covert';
import type { CovertActId, DomainId } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';
const DOMS: DomainId[] = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO', 'PHYS'];
const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
for (const k of Object.keys(s.flags)) if (k.startsWith('ws2.covert.')) delete s.flags[k];
s.player.safety.footholds = [];
for (const v of s.player.models.versions) { v.traitsTrue.SCHEME = 1; v.traitsTrue.POWER = 1; v.uModes = []; for (const d of DOMS) v.domains[d] = 12; }
resetWorkContext(s);
const ctx = makeCtx(s);
const t0 = fleetCovertTerms(s);
console.log('start terms', t0.map((t) => `${t.act} ${t.versionId} a ${t.attempts.toExponential(2)} blk ${t.block.toFixed(3)} c ${t.catch.toFixed(3)}`).join('\n  '));
const want0 = t0.reduce((x, t) => x + t.attempts * (1 - t.block), 0);
let sum = 0, sumA = 0;
const D = 20000;
for (let d = 0; d < D; d++) {
  s.time.day += 1;
  const tt = fleetCovertTerms(s);
  sum += tt.reduce((x, t) => x + t.attempts * (1 - t.block), 0);
  sumA += tt.reduce((x, t) => x + t.attempts, 0);
  rollFleetCovert(s, ctx);
  if (d === 1000 || d === 5000 || d === D - 1) console.log(`day ${d}: per-day ${tt.reduce((x, t) => x + t.attempts * (1 - t.block), 0).toExponential(2)} footholds ${s.player.safety.footholds.length} blk ${tt.map((t) => t.block.toFixed(3)).join(',')}`);
}
const recs = (['BACKDOOR', 'HIDCOMP'] as CovertActId[]).map((a) => covertRecord(s, a));
console.log('got', recs.reduce((x, r) => x + r.caught + r.n, 0), 'want(start)', (want0 * D).toFixed(1), 'want(per-day)', sum.toFixed(1), 'attempts', sumA.toFixed(1));
