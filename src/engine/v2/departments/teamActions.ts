// Team actions (STRUCTURE §4.1 verbs: hire a team, let a team go, move a research-engineering team, keep hiring to N).
// Owner: WS1. Every preview shows what apply() does (§2.7, lint-tradeoffs) and works with empty
// params (defaults: a standard capabilities research-engineering team, the newest team).
// RD-B18 (B32): a team's gain or loss is one engine day (core/previewTick) on a copy with and without the change
// (readDay), in each department's own currency.
import { AGENDAS } from '../../../data/v2/agendas';
import { MOVE_SAFETY_MORALE, TEAM_KEYS, TEAM_SIZE } from '../../../data/v2/teams';
import { PROJECT_BY_ID } from '../../../data/v2/tree';
import { previewTick } from '../core/previewTick';
import { capEta, isCapProject } from '../models/research';
import { lineResultsPerYear } from '../safety/agendas';
import type { ActionDef, Column, CostLine, GameStateV2, Team, TeamDept, TeamKey, TeamRole } from '../types';
import {
  buildCapacity, deptOfKey, fillWeeks, fullTeamPayroll, hireTeam, moveTeam, nextSpecialty, queuedOfKey, releaseTeam, roleOfKey, setTeamTarget,
  staffOf, teamPayroll, teamsOfKey,
} from './teams';

type Params = Record<string, number | string | boolean>;
const str = (p: Params, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);
const num = (p: Params, k: string, d: number) => (typeof p[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : d);
const fail = (why: string | undefined) => {
  if (why) throw new Error(why);
};

/** A team a preview adds (full, arrived): the spec's role, department and specialty (a standard science hire
 *  takes the specialty hireTeam would give it). */
export type TeamSpec = { role: TeamRole; dept: TeamDept; specialty?: Column; heads?: number };
const previewTeam = (s: GameStateV2, t: TeamSpec, i = 0): Team => {
  const dept = t.role === 'eng' ? 'cap' : t.dept;
  const specialty = t.specialty ?? (t.role === 'sci' ? nextSpecialty([...s.player.teams, ...s.player.hiring.filling], dept) : undefined);
  return { id: `preview:${i}`, role: t.role, dept, size: TEAM_SIZE[t.role], heads: t.heads ?? TEAM_SIZE[t.role], ...(specialty ? { specialty } : {}) };
};

/** What the lab reads after a day: build capacity (team-weeks / week, buildCapacity), every capability project's ETA
 *  (capEta: the assignment placed the science teams, research engineers went by need), safety results per year (the
 *  lines' cycles; new safety science teams are placed by Auto-assign when it is on), and idle research-engineer
 *  team-equivalents (RD-E03). */
export interface DayRead { build: number; eta: Map<string, number>; saf: number; idle: number }
export function readState(c: GameStateV2): DayRead {
  const eta = new Map<string, number>();
  for (const id of c.player.research.queue) if (isCapProject(PROJECT_BY_ID[id])) eta.set(id, capEta(c, id).eta);
  let saf = 0;
  for (const a of AGENDAS) saf += lineResultsPerYear(c, a.id);
  return { build: buildCapacity(c).capacity, eta, saf, idle: c.player.research.last?.idle ?? 0 };
}
/** One engine day on a copy with these teams (and an optional edit), read after it. */
export function readDay(s: GameStateV2, teams: Team[], edit?: (c: GameStateV2) => void): DayRead {
  const c = structuredClone(s);
  c.player.teams = structuredClone(teams);
  edit?.(c);
  previewTick(c);
  return readState(c);
}
/** Today's read and the changed reads, memoised per state, day and staffing (every hire chip compares against it). */
const teamsKey = (s: GameStateV2) => `${s.time.day}|${s.labour.stars.filter((x) => x.employer === 'player').map((x) => x.id).join(',')}|${s.player.research.queue.join(',')}|${s.player.teams.map((t) => `${t.id}:${t.heads}:${t.projectId ?? ''}:${t.dept}`).join(',')}`;
const readMemo = new WeakMap<GameStateV2, { key: string; m: Map<string, DayRead> }>();
function memoRead(s: GameStateV2, tag: string, teams: () => Team[], edit?: (c: GameStateV2) => void): DayRead {
  const key = teamsKey(s);
  let e = readMemo.get(s);
  if (!e || e.key !== key) readMemo.set(s, (e = { key, m: new Map() }));
  let r = e.m.get(tag);
  if (!r) {
    if (e.m.size > 32) e.m.clear();
    e.m.set(tag, (r = readDay(s, teams(), edit)));
  }
  return r;
}
const baseRead = (s: GameStateV2) => memoRead(s, 'base', () => s.player.teams);

const r2 = (x: number) => Math.round(x * 100) / 100;
/** The line of a team change in its department's currency: engineers' build capacity; capability teams the project
 *  whose ETA moves most (days; research engineers no project needs show as idle); safety results per year. */
export function effectLine(_s: GameStateV2, before: DayRead, after: DayRead, t: Pick<Team, 'role' | 'dept'>, none?: string): CostLine {
  if (t.role === 'eng') return { currency: 'staffTime', amount: r2(after.build - before.build), unit: 'team-weeks / week', target: 'build capacity' };
  if (t.dept === 'saf') {
    return { currency: 'alignment', amount: r2(after.saf - before.saf), unit: 'results / yr', target: t.role === 're' ? 'safety research results' : 'safety research results (a new science team joins the safety projects on the priority list; with none it waits idle)' };
  }
  let best: { id: string; d: number; stall?: 'starts' | 'stops' } | undefined;
  let moved = 0;
  for (const [id, a] of before.eta) {
    const b = after.eta.get(id) ?? Infinity;
    const fa = Number.isFinite(a);
    const fb = Number.isFinite(b);
    if (!fa && !fb) continue;
    const d = fa && fb ? a - b : fa ? -Infinity : Infinity;
    if (Math.abs(d) < 0.5) continue;
    moved++;
    if (!best || Math.abs(d) > Math.abs(best.d)) best = { id, d, ...(fa && fb ? {} : { stall: fa ? ('stops' as const) : ('starts' as const) }) };
  }
  const name = (id: string) => PROJECT_BY_ID[id]?.name ?? id;
  const more = moved > 1 ? ` (${moved - 1} more project${moved > 2 ? 's' : ''} move too)` : '';
  if (best?.stall === 'starts') return { currency: 'progress', amount: Math.round(after.eta.get(best.id) ?? 0), unit: 'days', target: `${name(best.id)} gets going: its ETA in days${more}` };
  if (best?.stall === 'stops') return { currency: 'progress', amount: -Math.round(before.eta.get(best.id) ?? 0), unit: 'days', target: `${name(best.id)} stalls: the ETA it loses${more}` };
  if (best) return { currency: 'progress', amount: Math.round(best.d), unit: 'days', target: `${name(best.id)} ${best.d > 0 ? 'sooner' : 'later'}${more}` };
  const dt = r2(after.idle - before.idle);
  return dt !== 0
    ? { currency: 'progress', amount: dt, unit: 'team-equivalents', target: 'research engineers idle (no project ETA moves today)' }
    : { currency: 'progress', amount: 0, unit: 'days', target: none ?? (t.role === 'sci' ? 'no capability project moves today (no project is finding ideas: science teams speed ideation)' : 'no capability project moves today (idle until a project needs them)') };
}

/** What one team of this kind adds once it is full (the gain of a hire): today's mechanisms on a copy with the team. */
export function teamGain(s: GameStateV2, t: TeamSpec): CostLine {
  const add = previewTeam(s, t);
  return effectLine(s, baseRead(s), memoRead(s, `add:${add.role}:${add.dept}:${add.specialty ?? ''}:${add.heads}`, () => [...s.player.teams, add]), add);
}
/** What hiring this star adds: the copy with the star on staff (it joins the researchers' taste mean, workfit.ts
 *  humanTasteMean) after one research day, as the capability project it speeds most. */
export function starGain(s: GameStateV2, starId: string): CostLine {
  const after = memoRead(s, `star:${starId}`, () => s.player.teams, (c) => { const x = c.labour.stars.find((y) => y.id === starId); if (x) x.employer = 'player'; });
  return effectLine(s, baseRead(s), after, { role: 'sci', dept: 'cap' }, 'no capability project moves today (star taste acts on new ideas: no project is finding ideas)');
}
/** What `n` more standard teams of a kind add (Keep hiring). */
function teamsGain(s: GameStateV2, t: TeamSpec, n: number): CostLine {
  const adds = Array.from({ length: n }, (_, i) => previewTeam(s, t, i));
  return effectLine(s, baseRead(s), memoRead(s, `add${n}:${t.role}:${t.dept}`, () => [...s.player.teams, ...adds]), adds[0]);
}
/** What losing a team costs: the copy without it against today (negative amounts). */
function teamLoss(s: GameStateV2, t: Team): CostLine {
  return effectLine(s, baseRead(s), memoRead(s, `remove:${t.id}`, () => s.player.teams.filter((x) => x.id !== t.id)), t);
}
/** A research-engineering team moved to the other department: what its old department loses and its new one gains. */
function teamMove(s: GameStateV2, t: Team): { loss: CostLine; gain: CostLine } {
  const to: TeamDept = t.dept === 'cap' ? 'saf' : 'cap';
  const after = memoRead(s, `move:${t.id}`, () => s.player.teams.map((x) => (x.id === t.id ? { ...x, dept: to } : x)));
  const base = baseRead(s);
  return { loss: effectLine(s, base, after, t), gain: effectLine(s, base, after, { role: t.role, dept: to }) };
}


/** The team a release/move preview talks about: the given id, else the newest arrived team (of a role, if given). */
function pickTeam(s: GameStateV2, p: Params, role?: TeamRole): Team | undefined {
  const id = str(p, 'team', '');
  const all = [...s.player.teams, ...s.player.hiring.filling];
  if (id) return all.find((t) => t.id === id);
  const pool = role ? s.player.teams.filter((t) => t.role === role) : s.player.teams;
  return pool[pool.length - 1];
}

function hireSpec(p: Params): { role: TeamRole; dept: TeamDept; specialty?: Column } {
  const k = str(p, 'key', 're.cap') as TeamKey;
  return { role: roleOfKey(k), dept: deptOfKey(k) };
}

export const TEAM_ACTIONS: ActionDef[] = [
  {
    id: 'teams.hire', verb: 'hire', system: 'people', sphere: 'departments', owner: 'WS1', title: 'Hire team',
    available: () => true,
    preview: (s, p) => {
      const t = hireSpec(p);
      const weeks = fillWeeks(s, { ...t, size: TEAM_SIZE[t.role], heads: 0 });
      return {
        costs: [{ currency: 'cash', amount: fullTeamPayroll(t.role, t.dept), target: '$B/yr payroll' }],
        gains: [{ ...teamGain(s, t), ...(Number.isFinite(weeks) ? { lagDays: weeks * 7 } : {}) }],
        exposure: [],
      };
    },
    apply: (s, _ctx, p) => {
      const r = hireTeam(s, { key: str(p, 'key', 're.cap') as TeamKey });
      if (typeof r === 'string') fail(r);
    },
  },
  {
    id: 'teams.release', verb: 'hire', system: 'people', sphere: 'departments', owner: 'WS1', title: 'Let go',
    available: (s) => (s.player.teams.length + s.player.hiring.filling.length > 0 ? true : 'No teams'),
    preview: (s, p) => {
      const t = pickTeam(s, p);
      if (!t) return { costs: [{ currency: 'morale', amount: 0 }], gains: [], exposure: [] };
      const pct = (100 * t.heads) / Math.max(1, staffOf(s.player.teams)[t.dept]);
      return {
        costs: [{ currency: 'morale', amount: -Math.min(15, pct), target: t.dept === 'saf' ? 'safety staff' : 'staff' }, ...(t.heads > 0 && s.player.teams.includes(t) ? [teamLoss(s, t)] : [])],
        gains: [{ currency: 'cash', amount: teamPayroll(t), target: '$B/yr payroll saved' }],
        exposure: [],
      };
    },
    apply: (s, ctx, p) => {
      const t = pickTeam(s, p);
      fail(t ? releaseTeam(s, ctx, t.id) : 'No such team');
    },
  },
  {
    id: 'teams.move', verb: 'hire', system: 'people', sphere: 'departments', owner: 'WS1', title: 'Move team',
    available: (s) => (s.player.teams.some((t) => t.role === 're') ? true : 'No research-engineering team'),
    preview: (s, p) => {
      const t = pickTeam(s, p, 're');
      if (!t || t.role !== 're') return { costs: [{ currency: 'morale', amount: 0 }], gains: [], exposure: [] };
      const mv = teamMove(s, t);
      const costs: CostLine[] = [mv.loss];
      if (t.dept === 'saf') costs.push({ currency: 'morale', amount: MOVE_SAFETY_MORALE, target: 'safety staff' });
      return { costs, gains: [mv.gain], exposure: [] };
    },
    apply: (s, ctx, p) => {
      const t = pickTeam(s, p, 're');
      fail(t ? moveTeam(s, ctx, t.id) : 'No research-engineering team');
    },
  },
  {
    id: 'teams.target', verb: 'policy', system: 'people', sphere: 'departments', owner: 'WS1', title: 'Keep hiring',
    available: () => true,
    preview: (s, p) => {
      const k = str(p, 'key', 're.cap') as TeamKey;
      const role = roleOfKey(k);
      const dept = deptOfKey(k);
      const have = teamsOfKey(s.player, k).length + queuedOfKey(s.player, k).length;
      const n = Math.max(0, Math.round(num(p, 'n', (s.player.hiring.targets[k] ?? 0) + 1)));
      const d = Math.max(0, n - have);
      return d > 0
        ? { costs: [{ currency: 'cash', amount: d * fullTeamPayroll(role, dept), target: '$B/yr payroll' }], gains: [teamsGain(s, { role, dept }, d)], exposure: [] }
        : { costs: [{ currency: 'cash', amount: 0, target: 'no new teams (it never lays off)' }], gains: [], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const k = str(p, 'key', 're.cap') as TeamKey;
      if (!TEAM_KEYS.includes(k)) fail('Unknown team kind');
      fail(setTeamTarget(s, k, num(p, 'n', s.player.hiring.targets[k] ?? 0)));
    },
  },
];

