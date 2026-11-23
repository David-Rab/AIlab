// Day-900 extras for SAFETY › Incidents & cases: incident context, cause-aware response options, a case preview.
//   npx tsx design/ux/mockups/rd/_data-c900.ts → design/ux/mockups/rd/data900c-inc.json
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../../src/engine/v2/core/save';
import { FIXTURE_DIR } from '../../../../scripts/v2/lib';
import type { GameStateV2, TraitId } from '../../../../src/engine/v2';
import { responseOptions, mustReport, willDisclose, RESPONSE_INFO } from '../../../../src/engine/v2/safety/responses';
import { casePreview, defaultTools, caseReliability, caseDailyWork, investigationFte, safetyReHeads } from '../../../../src/engine/v2/safety/investigations';
import { instruments } from '../../../../src/engine/v2/safety/instruments';
import { dateOf, fmtDate } from '../../../../src/engine/v2';
import { safetySpend } from '../../../../src/engine/v2/safety/spend';
const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day900.json'), 'utf8')) as GameStateV2;
const p = s.player;
const vn = (id: string) => p.models.versions.find((v) => v.id === id)?.name ?? id;
const errors: Record<string, string> = {};
const t = <T>(k: string, f: () => T): T | undefined => { try { return f(); } catch (e) { errors[k] = String((e as Error)?.stack ?? e).split('\n').slice(0, 3).join(' | '); return undefined; } };
const out: Record<string, unknown> = { day: s.time.day, date: fmtDate(dateOf(s, s.time.day)) };
out.versions = Object.fromEntries(p.models.versions.map((v) => [v.id, { name: v.name, status: v.status }]));
out.deployments = p.deployments.map((d) => ({ id: d.id, channel: d.channel, status: d.status, name: (d as unknown as { name?: string }).name, versionId: (d as unknown as { versionId?: string }).versionId }));
out.incidents = p.safety.incidents.map(({ trueSource: _t, ...i }) => ({ ...i, date: fmtDate(dateOf(s, i.day)), model: vn(i.versionId), must: t('mr' + i.id, () => mustReport(s, i as never)), will: t('wd' + i.id, () => willDisclose(s, i as never)),
  opts: t('ro' + i.id, () => { const v = p.models.versions.find((x) => x.id === i.versionId)!; return responseOptions(s, v, i as never); }) }));
out.responseInfo = RESPONSE_INFO;
const v52 = p.models.versions.find((v) => v.id === 'V52')!;
const traits = ['SCHEME', 'AF'] as TraitId[];
out.case = t('case', () => {
  const ids = defaultTools(s, traits);
  const tools = instruments(s).filter((x) => ids.includes(x.id));
  const fte = 20;
  const rel = caseReliability(s, { id: 'x', target: { kind: 'trait', versionId: 'V52', trait: 'SCHEME' }, fte, computeShare: 0.02, tools: ids, startDay: s.time.day, progress: 0 } as never);
  const per = caseDailyWork(s, fte, 1000);
  return { ids, rel, per, prev: casePreview(s, v52, traits, tools, fte, 0.02, per, rel) };
});
out.reHeads = t('re', () => safetyReHeads(s));
out.invFte = t('if', () => investigationFte(s));
out.spend = t('sp', () => safetySpend(s));
out.beliefsV52 = Object.fromEntries(Object.entries(v52.beliefs).map(([k, b]) => [k, { est: b.est, sd: b.sd, n: b.evidence.length }]));
out.errors = errors;
writeFileSync('design/ux/mockups/rd/data900c-inc.json', JSON.stringify(out, null, 1));
console.log('ok', errors);
