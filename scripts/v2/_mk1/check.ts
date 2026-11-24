// MK-1 targeted check (design/MARKET.md M1): the designer's day-369 and day-296 saves load through the save loader
// (migration 103 → 104), no product is left on 'gov', 'trusted' or 'agents', each product's channel and model print,
// and the game ticks 3 days without throwing. The saves are read-only.
// Run alone: npx tsx scripts/v2/_mk1/check.ts
import { existsSync, readFileSync } from 'node:fs';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { tick } from '../../../src/engine/v2/core/loop';
import { PRODUCT_DEFS, PRODUCT_ORDER } from '../../../src/data/v2/features';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const OLD = new Set(['gov', 'trusted', 'agents']);

check(PRODUCT_ORDER.join(',') === 'consumer,api,enterprise,vetted', 'four products: Chat, API, Enterprise, Vetted', PRODUCT_ORDER.map((c) => PRODUCT_DEFS[c]?.name).join(', '));

for (const f of ['ai27-v2-day369.json', 'ai27-v2-day296.json']) {
  const path = `C:/Users/david/Downloads/${f}`;
  if (!existsSync(path)) { check(false, `${f} present`); continue; }
  const json = readFileSync(path, 'utf8');
  const before = (JSON.parse(json) as { player: { deployments: { id: string; channel: string }[] } }).player.deployments;
  const s = deserialize(json);
  console.log(`\n${f}: day ${s.time.day}, schemaRev ${s.schemaRev}`);
  check(s.schemaRev === SCHEMA_REV, `${f} migrated to schemaRev ${SCHEMA_REV}`);
  for (const d of s.player.deployments) {
    const v = s.player.models.versions.find((x) => x.id === d.versionId);
    const was = before.find((x) => x.id === d.id)?.channel;
    console.log(`  ${d.id.padEnd(6)} ${d.channel.padEnd(10)} ${(was !== d.channel ? `(was ${was})` : '').padEnd(14)} ${d.status.padEnd(9)} ${v?.name ?? d.versionId}`);
  }
  check(s.player.deployments.every((d) => !OLD.has(d.channel)), `${f} no gov / trusted / agents product left`);
  check(s.player.build.queue.every((it) => it.kind !== 'launch' || (!OLD.has(it.ref) && !OLD.has(it.launch?.channel ?? ''))), `${f} no queued launch on an old channel`);
  check(s.player.deployments.length === before.length, `${f} no product merged or dropped`, `${before.length} → ${s.player.deployments.length}`);
  const day0 = s.time.day;
  let err = '';
  try { for (let i = 0; i < 3; i++) tick(s); } catch (e) { err = String((e as Error)?.stack ?? e); }
  check(!err && s.time.day === day0 + 3, `${f} ticks 3 days without throwing`, err ? err.split('\n').slice(0, 4).join(' | ') : `day ${s.time.day}`);
}

console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
