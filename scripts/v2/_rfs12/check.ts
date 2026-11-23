// RF-S12 check (npx tsx scripts/v2/_rfs12/check.ts): a case is a job of CASE_WORK engineer-days (no clarity rate);
// the preview's days match the days it takes; its verdict strength is the instruments' combined reliability × the
// share of work done; the preview shows each verdict's width; saves turn clarity into progress.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { SAFETY_ACTIONS } from '../../../src/engine/v2/safety/actions';
import { CASE_WORK, caseDailyWork, caseDays, caseReliability, investigationsStep } from '../../../src/engine/v2/safety/investigations';
import { casesServed, resetSafAllocation, safAllocation } from '../../../src/engine/v2/safety/lineProjects';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const raw = readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8');
const s: GameStateV2 = deserialize(raw);
check(s.player.safety.investigations.every((i) => typeof i.progress === 'number' && !('clarity' in i)), 'save: every case has progress, no clarity', `${s.player.safety.investigations.length} cases`);
{
  const j = JSON.parse(raw);
  const st = j.state ?? j;
  (st.player.safety.investigations ??= []).push({ id: 'INV-OLD', target: { kind: 'trait', versionId: 'x', trait: 'SCHEME' }, fte: 10, computeShare: 0.05, tools: [], startDay: 0, clarity: 0.4 });
  const m = deserialize(JSON.stringify(j)).player.safety.investigations.find((i) => i.id === 'INV-OLD');
  check(!!m && Math.abs(m.progress - 0.5) < 1e-12 && !('clarity' in m), 'migration: an open case at clarity 0.4 → progress 0.5', `${m?.progress}`);
}
for (const i of s.player.safety.investigations) if (!i.outcome) i.outcome = 'inconclusive'; // only the new case runs
resetSafAllocation(s);

const v = internalVersion(s)!;
const act = SAFETY_ACTIONS.find((a) => a.id === 'safety.investigate')!;
const p = { versionId: v.id, trait: 'SCHEME', fte: 10 };
const pv = act.preview(s, p);
const lines = pv.gains.map((g) => g.target ?? '');
console.log(lines.map((l) => `     ${l}`).join('\n'));
const dm = /done in ~(\d+) d/.exec(lines[0] ?? '');
check(!!dm && lines.some((l) => /if it confirms, .* if it clears, .* if inconclusive/.test(l)), 'preview: days of work, reliability, each verdict\'s width');
const ctx0 = makeCtx(s);
act.apply(s, ctx0, p);
const inv = s.player.safety.investigations.find((i) => !i.outcome)!;
check(!!inv && inv.progress === 0, 'opened with no work done');
const perDay = caseDailyWork(s, inv.fte * casesServed(s), safAllocation(s).caseScale);
let days = 0;
while (!inv.outcome && days < 200) {
  s.time.day++;
  resetSafAllocation(s);
  investigationsStep(s, makeCtx(s));
  days++;
}
check(!!inv.outcome && days === Number(dm?.[1]) && days === caseDays(perDay).days, 'concludes when the work is done, on the previewed day', `${days} d at ${perDay.toFixed(1)} engineer-days a day for ${CASE_WORK}; verdict ${inv.outcome}, ${inv.readings} readings`);
const r = caseReliability(s, inv);
check(r > 0 && r <= 1, 'verdict strength = the instruments\' combined reliability (true, engine)', r.toFixed(3));
console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
