// SR-14 targeted check (run alone: npx tsx scripts/v2/_sr14/check.ts): safety methods are run-plan options.
//  1. the day-400 fixture migrates (post designs carry `methods`, no techniques / trainAgainst; policy on);
//  2. a method's effect applies only when the run lists it (playerMods, healing, misuse for T-UNDO);
//  3. staffing a line switches nothing (mods and healing equal with and without science teams);
//  4. the default policy fills a new plan with every owned method; off, none; an explicit list wins.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { postFromParams } from '../../../src/engine/v2/models/actions';
import { healRate, playerMods } from '../../../src/engine/v2/safety/traits';
import { misuseHazards } from '../../../src/engine/v2/safety/incidents';
import { defaultMethods, ownedMethods } from '../../../src/engine/v2/safety/methods';
import { REFERENCE_POST } from '../../../src/data/v2/runDesign';
import type { GameStateV2, PostDesign } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const raw = readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8');
const s: GameStateV2 = deserialize(raw);
const designs = [...s.player.models.versions.map((v) => v.design), ...s.player.models.runs.map((r) => r.post).filter(Boolean)] as PostDesign[];
check(designs.length > 0 && designs.every((d) => Array.isArray(d.methods) && !('techniques' in d) && !('trainAgainst' in d)) && s.player.safety.useAllMethods === true,
  'migration: every post design has methods, no techniques / trainAgainst; policy on', `${designs.length} designs`);

for (const id of ['T-PERSONA', 'T-ANTISCHEME', 'T-CONFESS', 'T-UNDO']) s.player.safety.techniques[id].unlocked = true;
const post = (methods: string[]): PostDesign => ({ ...REFERENCE_POST, methods });
const none = playerMods(s, post([]), 'L0');
const pers = playerMods(s, post(['T-PERSONA']), 'L0');
const as = playerMods(s, post(['T-ANTISCHEME']), 'L0');
check((none.E05 ?? 1) === 1 && Math.abs((pers.E05 ?? 1) - 0.7) < 1e-9, 'persona vectors: E05 ×0.7 only when the run uses it', `${none.E05 ?? 1} → ${pers.E05}`);
check((none.E28 ?? 1) === 1 && Math.abs((as.E28 ?? 1) - 0.1) < 1e-9, 'anti-scheming: E28 ×0.1 only when the run uses it', `${none.E28 ?? 1} → ${as.E28}`);
const h0 = healRate(s, post([]));
const h2 = healRate(s, post(['T-CONFESS', 'T-ANTISCHEME']));
check(h2 > h0 && h0 > 0, 'AG18 healing reads the run\'s methods', `${h0.toFixed(4)} → ${h2.toFixed(4)}`);

// Staffing switches nothing: drop every science team (no line staffed) and compare.
const teams = s.player.teams;
const modsStaffed = JSON.stringify(playerMods(s, post([]), 'L0'));
const healStaffed = healRate(s, post([]));
s.player.teams = teams.filter((t) => t.role !== 'sci');
check(JSON.stringify(playerMods(s, post([]), 'L0')) === modsStaffed && healRate(s, post([])) === healStaffed, 'staffing lines switches nothing (mods and healing equal without science teams)',
  `${teams.filter((t) => t.role === 'sci').length} science teams`);
s.player.teams = teams;

// T-UNDO: misuse capability falls only for a model trained with it.
const dep = s.player.deployments.find((d) => d.channel !== 'internal');
const v = dep ? s.player.models.versions.find((x) => x.id === dep.versionId) : undefined;
if (dep && v) {
  const d0 = v.design;
  v.design = post([]);
  const m0 = misuseHazards(s, v, dep).reduce((a, r) => a + r.h, 0);
  v.design = post(['T-UNDO']);
  const m1 = misuseHazards(s, v, dep).reduce((a, r) => a + r.h, 0);
  v.design = d0;
  check(m0 === 0 || m1 < m0, 'distill-after-unlearn cuts misuse only when the run used it', `${m0.toExponential(2)} → ${m1.toExponential(2)}`);
} else check(true, 'T-UNDO: no external deployment in the fixture (skipped)');

// The default policy fills the plan.
const owned = ownedMethods(s);
check(JSON.stringify(postFromParams({}, s).methods) === JSON.stringify(owned) && owned.length >= 4, 'policy on: a new plan lists every owned method', owned.join(','));
check(postFromParams({ methods: 'T-PERSONA,against:T-PROP,T-NOPE' }, s).methods.join(',') === 'T-PERSONA,against:T-PROP', 'an explicit list wins; unknown entries drop');
check(!defaultMethods(s).some((m) => m.startsWith('against:')), 'the policy never trains against an instrument');
s.player.safety.useAllMethods = false;
check(postFromParams({}, s).methods.length === 0, 'policy off: a new plan lists no methods');
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
