// RD-A07 targeted check: a frontier pause stops capability (frontier) experiment FLOP but not ideation or safety
// experiments. (The clearance check went with E12, W1d.) Run: npx tsx scripts/v2/_a07/check.ts
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { expFlopAllowed, humansOf, researchMods } from '../../../src/engine/v2/departments/workfit';
import { capReCapacity, experimentRate, sciOn } from '../../../src/engine/v2/models/research';
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


console.log(fail ? `${fail} FAILED` : 'all passed');
process.exit(fail ? 1 : 0);
