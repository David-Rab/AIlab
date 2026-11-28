// L15 test: team sizes 100 / 50 / 20 and the sourced leader start (design/bal/LABOUR-SOURCES.md decision 3, LABOUR-ROUND §4.3).
// Run: npx tsx scripts/v2/startstaff.ts   (prints PASS/FAIL/WARN lines; exit code 1 on any FAIL)
// A new leader game on tl-central has exactly 6 engineer / 21 research-engineer / 14 scientist teams in capabilities and
// 1 research-engineer / 1 scientist team in safety, all full (heads = size); heads per kind 600 / 1,050 / 280 + 50 / 20;
// day-1 build capacity vs upkeep (WARN, not FAIL, when capacity < upkeep: inventory item B6); the labour units that read
// heads (reCapacity, build capacity, WORK_TYPES heads, evals' RE team-equivalents) give the same people-based numbers as
// before the team sizes changed.
import { newBotGame } from './botgame';
import { tick } from '../../src/engine/v2/core/loop';
import { TEAM_SIZE } from '../../src/data/v2/teams';
import { ENG_UNIT_HEADS, RE_UNIT_HEADS, WORK_TYPES } from '../../src/data/v2/workTypes';
import { buildCapacity } from '../../src/engine/v2/departments/teams';
import { upkeepTW } from '../../src/engine/v2/departments/build';
import { reCapacity } from '../../src/engine/v2/departments/capacity';
import { humansOf } from '../../src/engine/v2/departments/workfit';
import { LAB_KIND_BY_ID, POSITION_BY_ID } from '../../src/data/v2/starts';
import { keyOf } from '../../src/engine/v2/departments/teams';
import type { TeamKey } from '../../src/engine/v2/types';

let fails = 0;
const ok = (c: boolean, msg: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${msg}`); if (!c) fails++; };
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

ok(TEAM_SIZE.eng === 100 && TEAM_SIZE.re === 50 && TEAM_SIZE.sci === 20, `team sizes ${TEAM_SIZE.eng} / ${TEAM_SIZE.re} / ${TEAM_SIZE.sci}`);

const s = newBotGame(1, { world: 'tl-central', alignment: 'medium' }, 'leader');
const t = s.player.teams;
const count: Record<TeamKey, number> = { eng: 0, 're.cap': 0, 'sci.cap': 0, 're.saf': 0, 'sci.saf': 0 };
const heads: Record<TeamKey, number> = { eng: 0, 're.cap': 0, 'sci.cap': 0, 're.saf': 0, 'sci.saf': 0 };
for (const x of t) { count[keyOf(x)]++; heads[keyOf(x)] += x.heads; }
const want: Record<TeamKey, number> = { eng: 6, 're.cap': 21, 'sci.cap': 14, 're.saf': 1, 'sci.saf': 1 };
const wantHeads: Record<TeamKey, number> = { eng: 600, 're.cap': 1050, 'sci.cap': 280, 're.saf': 50, 'sci.saf': 20 };
for (const k of Object.keys(want) as TeamKey[]) {
  ok(count[k] === want[k], `${k}: ${count[k]} teams (want ${want[k]})`);
  ok(heads[k] === wantHeads[k], `${k}: ${heads[k]} heads (want ${wantHeads[k]})`);
}
ok(t.every((x) => x.heads === x.size && x.size === TEAM_SIZE[x.role]), 'every start team is full (heads = size = TEAM_SIZE)');
ok(Object.values(s.player.hiring.progress).every((g) => g.heads === 0), 'no hires toward a next team on day 0');
ok(s.player.staff.cap === 1930 && s.player.staff.saf === 70, `staff: capabilities ${s.player.staff.cap} (1,930), safety ${s.player.staff.saf} (70)`);
const spec = new Map<string, number>();
for (const x of t) if (x.role === 'sci') spec.set(`${x.dept}:${x.specialty}`, (spec.get(`${x.dept}:${x.specialty}`) ?? 0) + 1);
console.log(`      science specialties: ${[...spec].map(([k, n]) => `${k} ${n}`).join(', ')}`);
ok([...spec].filter(([k]) => k.startsWith('cap:')).every(([, n]) => n >= 4), 'capability scientist teams spread over the three columns (>= 4 each)');

// Other starts: the same people as before, in whole teams.
const people = (d: { teams: Record<TeamKey, number> }) => d.teams.eng * TEAM_SIZE.eng + (d.teams['re.cap'] + d.teams['re.saf']) * TEAM_SIZE.re + (d.teams['sci.cap'] + d.teams['sci.saf']) * TEAM_SIZE.sci;
// 1.5 and 10.5 engineer teams round down (the tie goes to the smaller team count).
const OLD: Record<string, number> = { breakaway: 150 + 100 + 40, safety: 4 * 150 + 8 * 100 + 5 * 40, bigtech: 7 * 150 + 19 * 100 + 12 * 40 };
for (const id of ['breakaway', 'safety', 'bigtech'] as const) {
  const p = people(POSITION_BY_ID[LAB_KIND_BY_ID[id].position]);
  ok(Math.abs(p - OLD[id]) / OLD[id] <= 0.2, `${id} start: ${p} people (was ${OLD[id]}), whole teams`);
}

// Build capacity against upkeep, day 1 (after the first tick: the start products' upkeep is live from then).
tick(s);
const b = buildCapacity(s);
const up = upkeepTW(s);
console.log(`      day-1 build capacity ${b.capacity.toFixed(2)} team-weeks/week (humans ${b.human.toFixed(2)} reference teams, AI coverage ${b.aEng.toFixed(2)}); upkeep ${up.toFixed(2)}`);
if (b.capacity >= up) ok(true, `build capacity ${b.capacity.toFixed(2)} >= upkeep ${up.toFixed(2)}`);
else console.log(`WARN  build capacity ${b.capacity.toFixed(2)} < upkeep ${up.toFixed(2)} team-weeks/week on day 1 (inventory item B6: build work does not progress)`);

// Unit conversions: the same people give the same labour as before the sizes changed.
ok(near(reCapacity({ heads: 1000 }), 10) && RE_UNIT_HEADS === 100, 'reCapacity(1,000 heads) = 10 team-equivalents (was heads / 100)');
ok(near(b.human, 600 / 150) && ENG_UNIT_HEADS === 150, 'build capacity humans: 600 engineers = 4 reference teams (was 4 teams of 150)');
ok(near(humansOf(s, 'EXP'), 1050 / 100) && near(humansOf(s, 'IDEAS'), 280 / 40) && near(humansOf(s, 'SWE'), 4), `labour H: EXP ${humansOf(s, 'EXP').toFixed(2)} (1050/100), IDEAS ${humansOf(s, 'IDEAS').toFixed(2)} (280/40), SWE ${humansOf(s, 'SWE').toFixed(2)}`);
ok(WORK_TYPES.SWE.heads === 150 && WORK_TYPES.EXP.heads === 100 && WORK_TYPES.IDEAS.heads === 40, 'WORK_TYPES reference units unchanged (150 / 100 / 40)');

console.log(fails ? `${fails} FAIL` : 'all PASS');
process.exit(fails ? 1 : 0);
