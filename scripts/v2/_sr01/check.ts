// SR-01 targeted check: the validation lead, dead-end latch and tool toggle are gone; a rev-54 save migrates (latched
// line unlatched, owned tools in use); the eval gate / publish policy / pledge previews show only what apply does.
// Run alone: npx tsx scripts/v2/_sr01/check.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SCHEMA_REV, deserialize, serialize } from '../../../src/engine/v2/core/save';
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

// Migration 54 → 55.
const s0 = load();
const old = JSON.parse(serialize(s0)) as GameStateV2;
old.schemaRev = 54;
const ag = Object.keys(old.player.safety.agendas)[0];
(old.player.safety.agendas[ag] as { status: string }).status = 'deadEnd';
const tool = Object.values(old.player.safety.techniques).find((t) => t.unlocked && techniqueRole(t) !== 'fix');
if (tool) tool.active = false;
const m = deserialize(JSON.stringify(old));
check(m.schemaRev === SCHEMA_REV && SCHEMA_REV >= 55, 'a rev-54 save loads at the current rev');
check(m.player.safety.agendas[ag].status === 'idle', 'a latched dead-end line is unlatched');
check(!tool || m.player.safety.techniques[tool.id].active, 'an owned tool switched off is in use after migration', tool?.id);

// Previews: no invented lines; immediate meter lines are applied.
const run = (id: string, p: Record<string, string>) => {
  const s = load();
  const pv = ACTION_BY_ID.get(id)!.preview(s, p);
  const before = { cred: s.relations.credibility, trust: s.relations.stocks.evalGov?.trust ?? 0 };
  ACTION_BY_ID.get(id)!.apply(s, makeCtx(s), p);
  return { pv, s, before };
};
const g = run('safety.evalGate', { level: 'fullPlusExternal' });
check(!lines(g.pv).some((l) => l.currency === 'credibility' || (l.currency === 'alignment' && /clarity/.test(String(l.target)))), 'eval gate preview: no credibility or "clarity" line', JSON.stringify(lines(g.pv).map((l) => l.currency)));
check(lines(g.pv).some((l) => l.currency === 'leadDays' && /external/.test(String(l.target))), 'eval gate preview: says it holds external launches only');
const pol = run('safety.publishPolicy', { policy: 'none' });
check(!lines(pol.pv).some((l) => l.currency === 'leadDays' || (l.amount !== 0 && !l.lagDays && (l.currency === 'credibility' || l.currency === 'talent'))), 'publish policy "none": no lead-day or immediate credibility / talent line');
const pl = run('safety.pledge', {});
check(!lines(pl.pv).some((l) => l.currency === 'progress' || l.currency === 'leadDays'), 'pledge preview: no notional progress / lead lines');
check(Math.abs(pl.s.relations.credibility - pl.before.cred) > 0, 'pledge: credibility moves as previewed', `${pl.before.cred} → ${pl.s.relations.credibility}`);

console.log(fails ? `\nSR-01 check: ${fails} failed` : '\nSR-01 check: all passed');
process.exit(fails ? 1 : 0);
