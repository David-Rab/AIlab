// RF-S13 targeted check (run alone: npx tsx scripts/v2/_rfs13/check.ts).
//  1. day-0 fixture: the misalignment rule asks control of internal AI work; the framework applies its package itself
//     (no training hold after the daily system), the engine charges the package preview's control compute, the log
//     says what was applied;
//  2. a part the player removes is not put back: the hold returns (the player's choice; override or re-apply by hand);
//  3. a new game, 30 days with RefBot / race / capex: no framework overrides (nothing to override), frontier training
//     not held; info: holds left on day 30 for every bot.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { engine } from '../../../src/engine/v2';
import { deserialize } from '../../../src/engine/v2/core/save';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { makeCtx, resolve, tick } from '../../../src/engine/v2/core/loop';
import { ACTIONS, EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { monitorBudget } from '../../../src/engine/v2/departments/agents';
import { frameworkOf, trainingHeld, trainingHolds } from '../../../src/engine/v2/safety/framework';
import { frameworkSystem, previewPackage } from '../../../src/engine/v2/safety/packages';
import { controlOn } from '../../../src/engine/v2/safety/safeguards';
import { refBot } from '../../../src/engine/v2/bots/ref';
import { raceBot } from '../../../src/engine/v2/bots/race';
import { capex2xBot } from '../../../src/engine/v2/bots/capex2x';
import { safeBot } from '../../../src/engine/v2/bots/safe';
import { mixedBot } from '../../../src/engine/v2/bots/mixed';
import type { BotPolicy, GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = (f: string): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, f), 'utf8'));
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const internal = (x: GameStateV2) => x.player.deployments.filter((d) => d.channel === 'internal' && d.status === 'live');

// 1. day 0: applied, not held
{
  const x = load('day0.json');
  const before = trainingHolds(x);
  check(before.some((h) => h.missing.some((m) => m.startsWith('control'))), 'fixture: the rule asks control of internal AI work', before.map((h) => `${h.ruleId}: ${h.missing.join(', ')}`).join('; '));
  const d = internal(x)[0];
  const pv = previewPackage(x, d);
  const c0 = monitorBudget(x).control * x.player.computeOnline;
  const ctx = makeCtx(x);
  frameworkSystem.run(x, ctx);
  const c1 = monitorBudget(x).control * x.player.computeOnline;
  check(internal(x).every(controlOn) && !trainingHeld(x) && trainingHolds(x).length === 0, 'after the daily system: control on, no training hold', trainingHolds(x).map((h) => h.missing.join('/')).join('; '));
  check(near(c1 - c0, pv.total.computeH100e), 'engine charges the previewed control compute', `+${pv.total.computeH100e.toFixed(1)} vs +${(c1 - c0).toFixed(1)} H100e; Slowdown ${(pv.total.slowdown * 100).toFixed(1)}%`);
  const line = x.log.find((l) => l.text.includes('applied "Meet my framework"'));
  check(!!line, 'log states what the framework applied', line?.text);
  check(frameworkOf(x).overrides.length === 0, 'no override');

  // 2. the player removes control: not put back, the rule holds
  const act = ACTIONS.find((a) => a.id === 'safety.respond')!;
  act.apply(x, makeCtx(x), { kind: 'removeControl', versionId: d.versionId });
  frameworkSystem.run(x, makeCtx(x));
  check(!controlOn(d) && trainingHeld(x), 'removed by the player: not re-applied, training held', `control ${controlOn(d)}, held ${trainingHeld(x)}`);
}

// 3. bots: no overrides from the start
const play = (bot: BotPolicy, days: number) => {
  const s = newGame(defaultSetupV2());
  while (s.time.day < days && !s.ending) {
    for (const p of [...s.events.pending]) {
      const c = bot.decide(s, p);
      if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    bot.act(s, engine);
    tick(s);
  }
  return s;
};
for (const bot of [refBot, raceBot, capex2xBot, safeBot, mixedBot]) {
  const s = play(bot, Number(process.env.RFS13_DAYS ?? 30));
  const fw = frameworkOf(s);
  const ovr = fw.overrides.length;
  if (['ref', 'race', 'capex2x'].includes(bot.id)) check(ovr === 0, `${bot.id}: no framework override by day ${s.time.day}`, `${ovr}: ${fw.overrides.map((o) => o.ruleId).join(',')}`);
  console.log(`info ${bot.id} day ${s.time.day}: training held ${trainingHeld(s)}; holds ${fw.holds.map((h) => `${h.ruleId}/${h.target}: ${h.missing.join(', ')}`).join('; ') || 'none'}; internal control ${internal(s).map(controlOn).join(',')}; overrides ${ovr}`);
}

console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
