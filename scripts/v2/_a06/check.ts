// RD-A06 targeted check: a built product feature no longer changes the internal agents' fit; building the internal
// tool (engineers, build queue) does; starts keep their internal tooling; control is per package.
// Run alone: npx tsx scripts/v2/_a06/check.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize, serialize } from '../../../src/engine/v2/core/save';
import { act, tick } from '../../../src/engine/v2/core/loop';
import { labourOf } from '../../../src/engine/v2/departments/workfit';
import { agentVersion, newestInternal } from '../../../src/engine/v2/departments/agents';
import { agentsView } from '../../../src/engine/v2/departments/agentActions';
import { underControl } from '../../../src/engine/v2/safety/oversight';
import { newGame } from '../../../src/engine/v2/core/init';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const clone = (s: GameStateV2) => deserialize(serialize(s));
const fit = (s: GameStateV2, slot: 'SWE' | 'IDEAS') => labourOf(s, slot).fit.fit;

const base = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
base.player.features = base.player.features.filter((f) => f !== 'codingAgent' && f !== 'deepResearch' && f !== 'memory');
base.player.tooling = [];
const f0 = { swe: fit(base, 'SWE'), ideas: fit(base, 'IDEAS') };

// 1. Product features built (and on for every product that offers them): internal fit unchanged.
const feat = clone(base);
feat.player.features.push('codingAgent', 'deepResearch', 'memory');
for (const d of feat.player.deployments) if (d.channel === 'api' || d.channel === 'agents' || d.channel === 'enterprise') d.features.push('codingAgent', 'deepResearch');
check(Math.abs(fit(feat, 'SWE') - f0.swe) < 1e-12 && Math.abs(fit(feat, 'IDEAS') - f0.ideas) < 1e-12, 'built product features do not change internal agent fit',
  `SWE ${f0.swe.toFixed(3)} → ${fit(feat, 'SWE').toFixed(3)}, IDEAS ${f0.ideas.toFixed(3)} → ${fit(feat, 'IDEAS').toFixed(3)}`);
check(agentsView(feat).build === agentsView(base).build, 'built product features do not change build capacity');

// 2. Building the Coding harness through the build queue raises the engineering agents' fit by its +0.3 OOM.
const tool = clone(base);
tool.player.finance.cash = Math.max(tool.player.finance.cash, 10);
const err = act(tool, 'tooling.build', { id: 'codingHarness' });
check(!err, 'tooling.build queues the Coding harness', err ?? '');
const it = tool.player.build.queue.find((x) => x.kind === 'tooling' && x.ref === 'codingHarness');
check(!!it && fit(tool, 'SWE') === f0.swe, 'queued, not built: no effect yet');
let days = 0;
while (!tool.player.tooling.includes('codingHarness') && days < 400) { tick(tool); days++; }
check(tool.player.tooling.includes('codingHarness'), 'engineers finish the Coding harness', `${days} d`);
const sweAfter = labourOf(tool, 'SWE').fit.fit;
const sweRef = (() => { const x = clone(tool); x.player.tooling = []; return labourOf(x, 'SWE').fit.fit; })();
check(Math.abs(sweAfter - sweRef - 0.3) < 1e-9, 'built Coding harness: SWE fit +0.3 OOM', `${sweRef.toFixed(3)} → ${sweAfter.toFixed(3)}`);
check(act(tool, 'tooling.build', { id: 'codingHarness' }) !== undefined, 'a built tool cannot be queued again');

// 3. Starts own the tools equivalent to their built features (CP4: the rev-56 migration check is gone with the UB-3 save break).
const ch = newGame({ ...JSON.parse(serialize(base)).setup, start: 'challenger' } as never);
check(JSON.stringify(ch.player.tooling) === '["codingHarness"]', 'challenger start (Coding agent built) owns the Coding harness', JSON.stringify(ch.player.tooling));
const ld = newGame({ ...JSON.parse(serialize(base)).setup, start: 'leader' } as never);
check(ld.player.tooling.length === 0, 'leader start: no internal tools (sector packs only), as before');

// 4. Explicit model and per-package control.
const pk = clone(base);
delete pk.player.agents.eng.versionId;
check(agentVersion(pk, 'eng')?.id === newestInternal(pk)?.id && agentsView(pk).lanes.eng.newest, 'no pick = the newest internal model, flagged as such', newestInternal(pk)?.name ?? '');
// CP4: the day-400 fixture already has control on the research-agent package, so the
// check is that turning it on for engineering agents changes that package only.
pk.player.agents.eng.control = undefined;
const other0 = agentsView(pk).lanes.capRoutine.control.on;
act(pk, 'agents.set', { use: 'eng', control: true });
const lanes = agentsView(pk).lanes;
check(underControl(pk) && lanes.eng.control.on && lanes.capRoutine.control.on === other0, 'control layer per package: engineering on, research agents unchanged', `eng ${lanes.eng.control.tax.toFixed(3)}, research agents ${other0 ? 'on' : 'off'} before and after`);

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
