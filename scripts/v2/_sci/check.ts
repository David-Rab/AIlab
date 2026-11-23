// SCI check (npx tsx scripts/v2/_sci/check.ts): the science-team planners (models/research.ts planAssignment, both
// departments). Day 0 new game: every capability science team is on a listed capability programme and the safety teams
// on the start safety projects, before the first tick. Day 900 fixture: the safety teams' idle state is the SAF-23 /
// RD-R03 rule (no safety project on the priority list), and putting a safety programme's next project on the list
// staffs it at once.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../src/engine/v2/core/save';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { PROJECT_BY_ID, isLineNode } from '../../../src/data/v2/tree';
import { AGENDA_IDS } from '../../../src/data/v2/agendas';
import { assignSafTeams, nextLineProject, queueNode, safReady } from '../../../src/engine/v2/models/tree';
import { isCapProject } from '../../../src/engine/v2/models/research';
import { safetyProgrammes } from '../../../src/engine/v2/safety/safetyReadouts';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { FIXTURE_DIR } from '../lib';

let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const sci = (s: GameStateV2, dept: 'cap' | 'saf') => s.player.teams.filter((t) => t.role === 'sci' && t.dept === dept);

// Day 0.
const s0 = newGame(defaultSetupV2({ seed: 2027, world: 'ai2027', alignment: 'medium', baseline: 'classic', companyName: 'X' }));
const q0 = s0.player.research.queue;
const capQ = q0.filter((id) => isCapProject(PROJECT_BY_ID[id]));
const cap0 = sci(s0, 'cap');
const on = cap0.filter((t) => t.projectId && capQ.includes(t.projectId));
check(capQ.length >= 6, 'day 0: capability programmes listed', `${capQ.length}`);
check(cap0.length > 0 && on.length === cap0.length, 'day 0: every capability science team on a listed programme', `${on.length} of ${cap0.length}`);
check(capQ.every((id) => cap0.some((t) => t.projectId === id)), 'day 0: every listed capability programme has a team', capQ.map((id) => `${id}:${cap0.filter((t) => t.projectId === id).length}`).join(' '));
check(cap0.every((t) => !!t.why && !t.why.startsWith('Idle')), 'day 0: each capability team has its why', cap0[0]?.why ?? '');
const saf0 = sci(s0, 'saf');
check(saf0.length > 0 && saf0.every((t) => !!t.projectId && isLineNode(PROJECT_BY_ID[t.projectId]) && q0.includes(t.projectId)), 'day 0: safety teams on listed safety projects', saf0.map((t) => `${t.id}:${t.projectId}`).join(' '));

// Day 900.
const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day900.json'), 'utf8'));
const saf = sci(s, 'saf');
const progs = safetyProgrammes(s);
console.log(`     day 900: ${saf.length} safety science teams, ${progs.filter((p) => p.staffed).length} of ${progs.length} programmes staffed, safety projects on the list: ${safReady(s).length}`);
check(safReady(s).length === 0 && saf.every((t) => !t.projectId && /no safety project on the priority list/.test(t.why ?? '')), 'day 900: idle safety teams are the no-safety-project-listed rule (SAF-23), with that why');
// The start safety projects are done (they left the list when their result landed; RD-R03: no auto-continue).
check(['T-CONFESS', 'T-DECEPT'].every((id) => s.player.tree[id]?.status === 'known'), 'day 900: the start safety projects are done');
// Queue the next project of the two best-outlook programmes: the safety planner staffs them.
const picks = progs.map((p) => nextLineProject(s, p.id)).filter((x): x is string => !!x).slice(0, 2);
for (const id of picks) check(queueNode(s, id) === undefined, `day 900: queue ${id}`);
assignSafTeams(s);
const after = sci(s, 'saf');
const staffed = safetyProgrammes(s).filter((p) => p.staffed).length;
check(after.length > 0 && after.every((t) => !!t.projectId && picks.includes(t.projectId)), 'day 900: queued safety projects get the safety teams', after.map((t) => `${t.id}:${t.projectId}`).join(' '));
check(staffed === Math.min(picks.length, after.length), 'day 900: Portfolio counts them staffed', `${staffed} of ${progs.length}`);
check(AGENDA_IDS.length === progs.length, 'programmes = agendas', `${progs.length}`);

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exit(fails ? 1 : 0);
