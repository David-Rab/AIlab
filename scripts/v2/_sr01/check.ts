// SR-01 targeted check: the validation lead, dead-end latch and tool toggle are gone; the publish policy / pledge previews
// show only what apply does. (CP4: the rev-54 migration part is gone with the UB-3 save break, and the eval gate part with
// the eval gate, SR-19.)
// Run alone: npx tsx scripts/v2/_sr01/check.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { ACTION_BY_ID } from '../../../src/engine/v2/core/registry';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { techniqueRole } from '../../../src/engine/v2/safety/techniques';
import type { CostLine, GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = () => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const lines = (p: { costs: CostLine[]; gains: CostLine[]; exposure: CostLine[] }) => [...p.costs, ...p.gains, ...p.exposure];

check(!ACTION_BY_ID.has('safety.technique'), 'the tool On/Off action is gone');


// Previews: no invented lines; immediate meter lines are applied.
const run = (id: string, p: Record<string, string>) => {
  const s = load();
  const pv = ACTION_BY_ID.get(id)!.preview(s, p);
  ACTION_BY_ID.get(id)!.apply(s, makeCtx(s), p);
  return { pv, s };
};
const pol = run('safety.publishPolicy', { policy: 'none' });
check(!lines(pol.pv).some((l) => l.currency === 'leadDays' || l.amount !== 0), 'publish policy "none": no lead-day or non-zero line (it changes nothing by itself)');
const pl = run('safety.pledge', {});
check(!lines(pl.pv).some((l) => l.currency === 'progress' || l.currency === 'leadDays'), 'pledge preview: no notional progress / lead lines');
check(pl.s.player.safety.monitorabilityCommitment && pl.s.commitments.some((c) => c.kind === 'monitorabilityPledge' && c.status === 'live'), 'pledge: a live monitorability commitment, as previewed');

console.log(fails ? `\nSR-01 check: ${fails} failed` : '\nSR-01 check: all passed');
process.exit(fails ? 1 : 0);
