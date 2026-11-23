// RF-S8 check (npx tsx scripts/v2/_rfs8/check.ts): the environment fix folds into Harden. The patch response queues the
// suite's hardening pass (one cost model: cash + team-weeks on the build queue; one floor: exploitFloor), its preview is
// suite.harden's, and saves lose the old envFix state and need.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, SCHEMA_REV } from '../../../src/engine/v2/core/save';
import { makeCtx } from '../../../src/engine/v2/core/loop';
import { applyResponse } from '../../../src/engine/v2/safety/responses';
import { SAFETY_ACTIONS } from '../../../src/engine/v2/safety/actions';
import { SUITE_ACTIONS, completeSuiteWork, exploitFloor, hardenCut, hardenedExploit, queuedSuiteWork, suiteOf, suiteRef, suiteWorkCost } from '../../../src/engine/v2/models/suites';
import { internalVersion } from '../../../src/engine/v2/models/labs';
import { SAF_RE_NEEDS } from '../../../src/data/v2/research';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const s: GameStateV2 = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
const saf = s.player.safety as unknown as Record<string, unknown>;
const order = (s.player.research.safRe?.order ?? []) as string[];
check(s.schemaRev === SCHEMA_REV && SCHEMA_REV === 101 && saf.envFixes === undefined && saf.envFixJobs === undefined && !order.includes('envFix') && !(SAF_RE_NEEDS as string[]).includes('envFix'),
  'migrates to 101: no envFixes / envFixJobs, no envFix need', `order ${order.join(',')}`);

const v = internalVersion(s)!;
const respond = SAFETY_ACTIONS.find((a) => a.id === 'safety.respond')!;
const pv = respond.preview(s, { kind: 'patchSignal', versionId: v.id, trait: 'RH', family: 'swe' });
const hv = SUITE_ACTIONS.find((a) => a.id === 'suite.harden')!.preview(s, { family: 'swe' });
check(JSON.stringify(pv) === JSON.stringify(hv), 'Respond preview = suite.harden preview', `${pv.costs.map((c) => `${c.amount} ${c.target}`).join('; ')} | ${pv.gains.map((g) => g.target).join('; ')}`);
check(!SAFETY_ACTIONS.some((a) => a.id === 'safety.envFix'), 'no safety.envFix action');

const ctx = makeCtx(s);
const cash0 = s.player.finance.cash;
const x0 = suiteOf(s, 'swe')!.exploit;
const cost = suiteWorkCost(s, 'swe', 'harden');
const cut = hardenCut(s);
const err = applyResponse(s, ctx, 'patchSignal', v.id, undefined, { trait: 'RH', family: 'swe' });
const item = queuedSuiteWork(s, 'swe', 'harden');
check(!err && !!item && Math.abs(item.needTW - cost.tw) < 1e-9 && Math.abs(cash0 - s.player.finance.cash - cost.cashB) < 1e-9 && suiteOf(s, 'swe')!.exploit === x0,
  'the response queues a hardening pass: harden cost paid, team-weeks queued, nothing in force yet', err ?? `${cost.tw.toFixed(2)} tw, $${cost.cashB.toFixed(3)}B`);
const again = applyResponse(s, ctx, 'patchSignal', v.id, undefined, { trait: 'RH', family: 'swe' });
check(!!again, 'one pass per family at a time', again ?? '');
completeSuiteWork(s, ctx, suiteRef('swe', 'harden'));
const x1 = suiteOf(s, 'swe')!.exploit;
check(Math.abs(x1 - hardenedExploit('swe', x0, cut)) < 1e-12 && x1 >= exploitFloor('swe'), 'done: the suite is hardened (one floor)', `${(x0 * 100).toFixed(2)}% -> ${(x1 * 100).toFixed(2)}%, floor ${(exploitFloor('swe') * 100).toFixed(2)}%`);
console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
