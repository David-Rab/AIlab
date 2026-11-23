// RF-S4 targeted check (run alone: npx tsx scripts/v2/_rfs4/check.ts).
//  1. with nothing named or selected, the safety views read the riskiest running model (highest Loss-of-control risk);
//  2. the lab headline is that model's risk (max over running models), named;
//  3. the level colour scale no longer sits on the 0.4 danger line (framework line 30%, watch at half).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { lossOfControlRisk, runningModels } from '../../../src/engine/v2/safety/lossRisk';
(globalThis as unknown as { window: unknown }).window ??= globalThis; // the UI store registers itself on window
const { RISK_BANDS, safetyModel } = await import('../../../src/ui/v2/safetyRule');
const { store } = await import('../../../src/ui/v2/store');
import { internalVersion } from '../../../src/engine/v2/models/labs';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };

for (const f of ['day400.json', 'day900.json']) {
  const s: GameStateV2 = deserialize(readFileSync(join(FIXTURE_DIR, f), 'utf8'));
  store.sel.versionId = undefined;
  const rs = runningModels(s).map((v) => ({ v, p: lossOfControlRisk(s, v.id)!.p }));
  const top = rs.reduce((a, b) => (b.p > a.p ? b : a));
  const lab = lossOfControlRisk(s)!;
  check(safetyModel(s)?.id === top.v.id, `${f}: default safety model = riskiest running model`, `${safetyModel(s)?.name} (internal ${internalVersion(s)?.name}); ${rs.map((x) => `${x.v.name} ${(x.p * 100).toFixed(1)}%`).join(', ')}`);
  check(lab.versionId === top.v.id && Math.abs(lab.p - top.p) < 1e-12 && !!lab.name, `${f}: lab number = the max, named`, `${lab.name} ${(lab.p * 100).toFixed(1)}%`);
  const named = rs.find((x) => x.v.id !== top.v.id)?.v;
  if (named) check(safetyModel(s, named.id)?.id === named.id, `${f}: a named model still wins`);
}
check(RISK_BANDS.level[0] === 0.15 && RISK_BANDS.level[1] === 0.3, 'level scale: watch 15%, bad 30% (no 0.4 danger line)', JSON.stringify(RISK_BANDS.level));

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
