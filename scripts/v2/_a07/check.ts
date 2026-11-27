// RD-A07 targeted check: a frontier pause stops capability (frontier) experiment FLOP but not ideation or safety
// experiments; a clearance lowers team capacity (heads off the teams), not a speed factor. Run: npx tsx scripts/v2/_a07/check.ts
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { expFlopAllowed, humansOf, researchMods } from '../../../src/engine/v2/departments/workfit';
import { capReCapacity, experimentRate, sciOn } from '../../../src/engine/v2/models/research';
import { ws4 } from '../../../src/engine/v2/actors/state';
import { PROJECT_BY_ID } from '../../../src/data/v2/tree';

let fail = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fail++; };
const s = newGame(defaultSetupV2({ seed: 11, world: 'tl-central', alignment: 'medium', tutorial: false }));
const sci = s.player.teams.find((t) => t.role === 'sci' && t.dept === 'cap')!;
sci.projectId ??= Object.keys(PROJECT_BY_ID)[0];
const id = sci.projectId!;
const inp = { mExp: 1, speed: researchMods(s).speed };
const F = 1e20;
const before = { mods: researchMods(s), sci: sciOn(s, id), rate: experimentRate(s, inp, 1, expFlopAllowed(s, 'cap', F)), hum: humansOf(s, 'IDEAS'), re: capReCapacity(s) };

ws4(s).frontierPauseUntil = s.time.day + 60;
const p = researchMods(s);
ok(expFlopAllowed(s, 'cap', F) === 0 && before.rate > 0, `pause: capability experiment FLOP ${F} -> ${expFlopAllowed(s, 'cap', F)}, rate ${before.rate.toFixed(4)} -> ${experimentRate(s, inp, 1, expFlopAllowed(s, 'cap', F))}`);
ok(expFlopAllowed(s, 'saf', F) === F, 'pause: safety experiment FLOP unchanged');
ok(p.speed === before.mods.speed && sciOn(s, id).cap === before.sci.cap, `pause: ideation inputs unchanged (speed ${p.speed}, capacity ${before.sci.cap.toFixed(3)})`);
ws4(s).frontierPauseUntil = -1;

s.flags['ws4:sidelinedUntil'] = s.time.day + 60;
const c = researchMods(s);
ok(c.speed === before.mods.speed, `clearance: speed factor unchanged (${c.speed})`);
ok(sciOn(s, id).cap < before.sci.cap && capReCapacity(s) < before.re && humansOf(s, 'IDEAS') < before.hum,
  `clearance: capacity down (sci ${before.sci.cap.toFixed(3)} -> ${sciOn(s, id).cap.toFixed(3)}, RE ${before.re.toFixed(3)} -> ${capReCapacity(s).toFixed(3)})`);
s.flags['ws4:sidelinedUntil'] = s.time.day - 1;
ok(sciOn(s, id).cap === before.sci.cap, 'clearance over: capacity back');
console.log(fail ? `${fail} FAILED` : 'all passed');
process.exit(fail ? 1 : 0);
