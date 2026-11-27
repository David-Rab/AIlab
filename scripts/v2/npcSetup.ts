// N10 test: the NPC cast setup (design/archive/npc/NPC-TASKS.md N10; NPC-LABS.md §10, §11). Run: npx tsx scripts/v2/npcSetup.ts
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { tick } from '../../src/engine/v2/core/loop';
import { KINDS, REALISTIC_CAST } from '../../src/data/v2/npcLabs';
import { DAYS_PER_MONTH } from '../../src/engine/v2/npc/lab';

let fails = 0;
const check = (ok: boolean, msg: string, detail = '') => { console.log(`${ok ? '  ok ' : 'FAIL '} ${msg}${detail ? `  (${detail})` : ''}`); if (!ok) fails++; };
const mk = (over: Parameters<typeof defaultSetupV2>[0]) => newGame(defaultSetupV2({ world: 'tl-central', seed: 11, tutorial: false, ...over }));

// default: the realistic cast
check(defaultSetupV2().cast === 'realistic', 'default setup.cast is realistic');
const d = mk({ start: 'challenger' });
const want = REALISTIC_CAST.filter((e) => e.kind !== 'china').map((e) => e.id);
check(JSON.stringify(d.rivals.map((r) => r.core.id)) === JSON.stringify(want), 'default (challenger start): the realistic cast, in order', d.rivals.map((r) => r.core.id).join(','));
check(d.rivals.every((r) => !r.npc!.pers), 'default labs carry no adjusted values');

// leader start drops the leader kind (realistic and custom)
const l = mk({ start: 'leader' });
check(!l.rivals.some((r) => r.npc!.kind === 'leader') && l.rivals.length === want.length - 1, 'leader start: no leader-kind NPC lab');
const lc = mk({ start: 'leader', cast: [{ kind: 'leader', lagMonths: 0 }, { kind: 'safety', lagMonths: 2 }] });
check(lc.rivals.length === 1 && lc.rivals[0].npc!.kind === 'safety', 'leader start, custom: the leader kind is left out too');

// custom cast of 2 labs: exactly those kinds and lags
const c = mk({ start: 'challenger', cast: [{ kind: 'racer', lagMonths: 4 }, { kind: 'bigtech', lagMonths: 1.5 }] });
check(c.rivals.length === 2, 'custom 2 labs: two US labs', String(c.rivals.length));
check(c.rivals[0].npc!.kind === 'racer' && c.rivals[1].npc!.kind === 'bigtech', 'custom: kinds in order');
check(Math.abs(c.rivals[0].npc!.d0 - 4 * DAYS_PER_MONTH) < 1e-9 && Math.abs(c.rivals[1].npc!.d0 - 1.5 * DAYS_PER_MONTH) < 1e-9, 'custom: start lags', c.rivals.map((r) => r.npc!.d0.toFixed(1)).join(','));
check(c.rivals[0].core.computeOnline === REALISTIC_CAST.find((e) => e.kind === 'racer')!.start.computeH100e, 'custom: compute from the kind\'s entry');

// names: the second lab of a kind is numbered
const dup = mk({ start: 'challenger', cast: [{ kind: 'safety', lagMonths: 3 }, { kind: 'safety', lagMonths: 5 }, { kind: 'safety', lagMonths: 5 }] });
const names = dup.rivals.map((r) => r.core.name);
check(new Set(names).size === 3 && new Set(dup.rivals.map((r) => r.core.id)).size === 3 && names[1].endsWith(' II') && names[2].endsWith(' III'), 'same-kind labs get numbered names and unique ids', names.join(' / '));

// overrides: the adjusted values are used, the others stay the kind's
const o = mk({ start: 'challenger', cast: [{ kind: 'safety', lagMonths: 3, personality: { safetyEmphasis: 0.1 } }] });
const p = o.rivals[0].npc!.pers!;
check(p.safetyEmphasis === 0.1 && p.raceResponse === KINDS.safety.raceResponse, 'overrides applied over the kind\'s values');
check(o.hidden.rivalPostures[o.rivals[0].core.id].safetyInvestment === 0.1, 'the override reaches the lab\'s posture');

// zero US labs, and a few ticks of each custom game run
const z = mk({ start: 'challenger', cast: [] });
check(z.rivals.length === 0 && !!z.china.lab, 'zero US labs: China only');
for (const [name, s] of [['custom 2', c], ['overrides', o], ['zero labs', z], ['numbered', dup]] as const) {
  let ok = true;
  try { for (let i = 0; i < 30; i++) tick(s); } catch (e) { ok = false; console.log(String(e)); }
  check(ok && s.time.day >= 30, `${name}: runs 30 days`);
}
console.log(fails ? `npcSetup: ${fails} FAILED` : 'npcSetup ok');
process.exit(fails ? 1 : 0);
