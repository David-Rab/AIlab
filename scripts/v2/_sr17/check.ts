// SR-17 / SR-18 targeted check (run alone: npx tsx scripts/v2/_sr17/check.ts).
//  1. day 400 migrates to 88: disclosure policy legal minimum, no old response kinds;
//  2. a case job with chosen instruments: the preview names those instruments, time, staff, what it can find; the case
//     uses only them; its verdict lists the beliefs it moved (= the belief change from open to close) and its evidence;
//  3. responses are cause-aware: a believed environment hack (RH) offers the environment fix and nothing unrelated; a
//     scheming incident offers a method for later runs and safeguards, not the fix; misuse offers product restriction;
//     apply refuses a response outside the cause's list;
//  4. disclosure is separate: a fix does not resolve or cover a timed incident; legal minimum reports a must-report
//     incident and not a minor one; policy none makes a must-report incident a cover-up; the override discloses.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { ACTIONS } from '../../../src/engine/v2/core/registry';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { defaultTools, investigationsStep, openInvestigation } from '../../../src/engine/v2/safety/investigations';
import { applyResponse, disclosureStep, responseOptions, setIncidentDisclosure } from '../../../src/engine/v2/safety/responses';
import type { GameStateV2, Incident } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const action = (id: string) => ACTIONS.find((a) => a.id === id)!;

// 1. migration
let s = load();
check(s.schemaRev === SCHEMA_REV && SCHEMA_REV >= 88 && s.player.safety.disclosure === 'legal' && Array.isArray(s.player.safety.requiredMethods)
  && !s.player.safety.incidents.some((i) => (i.responses as string[]).some((k) => k === 'targetedTraining' || k === 'disclose')), 'save migrates to 88: disclosure legal minimum', `rev ${s.schemaRev}`);

// 2. case job
const v = internalVersion(s)!;
const all = defaultTools(s, ['SCHEME']);
const chosen = all.slice(0, Math.max(1, Math.min(2, all.length - 1)));
s.player.teams.forEach((t) => { if (t.role === 're' && t.dept === 'saf') t.heads = Math.max(t.heads, 60); });
const pv = action('safety.investigate').preview(s, { versionId: v.id, trait: 'SCHEME', fte: 20, tools: chosen.join(',') });
const text = pv.gains.map((g) => `${g.unit ?? ''}: ${g.target}`).join('\n');
check(pv.gains.some((g) => g.unit === 'can find') && chosen.every((id) => text.includes(id) || pv.gains.some((g) => /instrument/.test(g.unit ?? ''))) && /in ~\d+ d|closes at/.test(text) && pv.costs.some((c) => c.currency === 'staffTime' && c.amount === 20),
  'preview: chosen instruments, time, staff, can-find', `${chosen.length} of ${all.length} instruments`);
console.log(text.split('\n').map((l) => `      ${l}`).join('\n'));
const ctx = makeCtx(s);
const inv = openInvestigation(s, ctx, { kind: 'trait', versionId: v.id, trait: 'SCHEME' }, 20, { tools: chosen });
check(typeof inv !== 'string' && JSON.stringify(inv.tools) === JSON.stringify(chosen) && !!inv.before?.SCHEME, 'case opens with the chosen instruments and a belief snapshot', typeof inv === 'string' ? inv : inv.tools.join(','));
if (typeof inv !== 'string') {
  const b0 = { ...inv.before!.SCHEME! };
  for (let d = 0; d < 130 && !inv.outcome; d++) {
    s.time.day++;
    investigationsStep(s, makeCtx(s));
  }
  const det = inv.outcomeDetail;
  const now = v.beliefs.SCHEME;
  const ch = det?.changes?.find((c) => c.trait === 'SCHEME');
  const moved = Math.abs(now.est - b0.est) >= 0.005 || Math.abs(now.sd - b0.sd) >= 0.005;
  check(!!inv.outcome && !!det?.evidence?.length && (moved ? !!ch && Math.abs(ch.to.est - now.est) < 0.001 && Math.abs(ch.from.est - b0.est) < 0.001 : !ch),
    'verdict lists the belief change and the evidence', `${inv.outcome}; ${ch ? `SCHEME ${ch.from.est.toFixed(3)}±${ch.from.sd.toFixed(3)} → ${ch.to.est.toFixed(3)}±${ch.to.sd.toFixed(3)}` : 'no change'}; ${det?.evidence?.join(' | ')}; ${inv.readings} readings`);
}

// 3. cause-aware responses
s = load();
const v3 = internalVersion(s)!;
let n = 0;
const mk = (apparent: Incident['apparent'], over: Partial<Incident> = {}): Incident => {
  const i: Incident = { id: `T${++n}`, day: s.time.day, labId: s.player.id, versionId: v3.id, trueSource: 'SCHEME', apparent, severity: 2, exposure: 'internal', status: 'open', responses: [], ...over };
  s.player.safety.incidents.push(i);
  return i;
};
for (const f of s.player.safety.footholds) if (f.status === 'detected') f.status = 'removed'; // no located foothold here
const rh = mk('RH');
const oRh = responseOptions(s, v3, rh);
check(oRh.cause === 'signal' && oRh.kinds.includes('patchSignal') && !oRh.kinds.some((k) => k === 'addMethod' || k === 'rollback' || k === 'restrictContext'), 'environment hack → environment fix only', oRh.kinds.join(','));
const sch = mk('SCHEME');
const oSch = responseOptions(s, v3, sch);
check(oSch.cause === 'trait' && oSch.kinds.includes('addMethod') && oSch.kinds.includes('addControl') && !oSch.kinds.includes('patchSignal'), 'scheming signal → method / safeguards / restrictions, no environment fix', oSch.kinds.join(','));
const mis = mk('misuse');
const oMis = responseOptions(s, v3, mis);
check(oMis.cause === 'misuse' && oMis.kinds.join() === 'restrictContext', 'misuse → product restriction', oMis.kinds.join(','));
const c3 = makeCtx(s);
const refused = applyResponse(s, c3, 'addMethod', v3.id, rh.id);
const pvRefused = action('safety.respond').preview(s, { kind: 'addMethod', incidentId: rh.id });
check(!!refused && /not a response/.test(refused) && /not a response/.test(pvRefused.costs[0]?.target ?? ''), 'apply and preview refuse a response outside the cause', refused ?? '');
const fixed = applyResponse(s, c3, 'patchSignal', v3.id, rh.id);
check(fixed === undefined && rh.status === 'resolved' && rh.responses.includes('patchSignal'), 'environment fix applies to the hack incident', fixed ?? rh.status);

// 4. disclosure
// SB 53 is in force by date on the day-400 fixture (data/v2/laws.ts).
const timed = mk('RH', { severity: 2, exposure: 'customer', publicTimerDays: 20 });
applyResponse(s, c3, 'patchSignal', v3.id, timed.id);
check(timed.status === 'open' && timed.publicTimerDays === 20, 'a fix does not close the disclosure question (timed incident stays open)', timed.status);
const must = mk('SCHEME', { severity: 3, exposure: 'customer', publicTimerDays: 20 });
const minor = mk('SYC', { severity: 1, exposure: 'customer', publicTimerDays: 20 });
disclosureStep(s, c3);
check(must.status === 'disclosed' && minor.status === 'open' && timed.status === 'open', 'legal minimum: the must-report incident is reported, minor ones are not', `${must.status} / ${minor.status}`);
s.player.safety.disclosure = 'none';
const must2 = mk('SCHEME', { severity: 4, exposure: 'customer', publicTimerDays: 20 });
disclosureStep(s, c3);
check(must2.status === 'covered', 'policy none: a must-report incident becomes a cover-up', must2.status);
setIncidentDisclosure(s, c3, minor, 'yes');
check(minor.status === 'disclosed' && minor.publicTimerDays === undefined, 'per-incident override discloses under policy none', minor.status);
const pvPol = action('safety.disclosurePolicy').preview(s, { policy: 'none' });
check(pvPol.costs.some((c) => /fine/.test(c.target ?? '')), 'policy preview states the cover-up consequence', pvPol.costs.map((c) => c.target).join(' | '));

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
