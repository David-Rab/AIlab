// Team actions (STRUCTURE §4.1 verbs: hire a team, let a team go, move a research-engineering team, keep hiring to N).
// Owner: WS1. Every preview shows ≥ 1 cost in a currency not among its gains (lint-tradeoffs) and works with empty
// params (defaults: a standard capabilities research-engineering team, the newest team).
import { COLUMN_LABEL, MOVE_SAFETY_MORALE, QUALITY, REF_ROLE_SHARE, TEAM_KEYS, TEAM_SIZE } from '../../../data/v2/teams';
import { tasteSigma } from '../production/knots';
import { qualityZ } from './workfit';
import type { ActionDef, Column, CostLine, GameStateV2, Team, TeamDept, TeamKey, TeamQuality, TeamRole } from '../types';
import {
  deptOfKey, fillWeeks, fullTeamPayroll, hireTeam, moveTeam, playerH, queuedOfKey, releaseTeam, roleOfKey, setTeamTarget,
  staffOf, teamPayroll, teamsOfKey,
} from './teams';

type Params = Record<string, number | string | boolean>;
const str = (p: Params, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);
const num = (p: Params, k: string, d: number) => (typeof p[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : d);
const fail = (why: string | undefined) => {
  if (why) throw new Error(why);
};

/** What one team of this kind adds (the "gain" of a hire, the loss of a release):
 *  engineers → build capacity (team-weeks/week); capabilities REs → research speed via h's elasticity; capabilities
 *  scientists → research speed via taste (0 for Strong: they matter for projects from R4); safety → safety staff. */
export function teamGain(s: GameStateV2, t: { role: TeamRole; dept: TeamDept; quality: TeamQuality; specialty?: Column; heads?: number }): CostLine {
  const q = QUALITY[t.quality].out;
  const heads = t.heads ?? TEAM_SIZE[t.role];
  const el = s.player.prodCache?.elast;
  if (t.role === 'eng') return { currency: 'staffTime', amount: Math.round((heads / TEAM_SIZE.eng) * q * 100) / 100, target: 'build capacity' };
  if (t.dept === 'saf') return { currency: 'alignment', amount: Math.round(heads), target: 'safety staff' };
  if (t.role === 're') {
    const re = Math.max(1, playerH(s.player) * REF_ROLE_SHARE.re);
    return { currency: 'progress', amount: Math.round((Math.pow(1 + (heads * q) / re, el?.humans ?? 0.2) - 1) * 1e4) / 1e4, target: 'research speed' };
  }
  // Model v3 V3: the team's human taste on the AIFM distribution vs a Strong team, as a share of the lab's science heads.
  let sciHeads = heads;
  for (const x of s.player.teams) if (x.role === 'sci' && x.dept === 'cap') sciHeads += x.heads;
  const dTau = (heads * (Math.exp(tasteSigma(s.hidden.timeline.prod.m2b) * qualityZ(t.quality)) - 1)) / sciHeads;
  return { currency: 'progress', amount: Math.round((el?.taste ?? 0.5) * dTau * 1e4) / 1e4, target: t.specialty ? `${COLUMN_LABEL[t.specialty]} research` : 'research taste' };
}

const negate = (c: CostLine): CostLine => ({ ...c, amount: -c.amount });

/** The team a release/move preview talks about: the given id, else the newest arrived team (of a role, if given). */
function pickTeam(s: GameStateV2, p: Params, role?: TeamRole): Team | undefined {
  const id = str(p, 'team', '');
  const all = [...s.player.teams, ...s.player.hiring.filling];
  if (id) return all.find((t) => t.id === id);
  const pool = role ? s.player.teams.filter((t) => t.role === role) : s.player.teams;
  return pool[pool.length - 1];
}

function hireSpec(s: GameStateV2, p: Params): { role: TeamRole; dept: TeamDept; quality: TeamQuality; specialty?: Column } {
  const cid = str(p, 'candidate', '');
  const c = cid ? s.player.hiring.candidates.find((x) => x.id === cid) : undefined;
  if (c) return c;
  const k = str(p, 'key', 're.cap') as TeamKey;
  return { role: roleOfKey(k), dept: deptOfKey(k), quality: 'strong' };
}

export const TEAM_ACTIONS: ActionDef[] = [
  {
    id: 'teams.hire', verb: 'hire', system: 'people', sphere: 'departments', owner: 'WS1', title: 'Hire team',
    available: () => true,
    preview: (s, p) => {
      const t = hireSpec(s, p);
      const weeks = fillWeeks(s, { ...t, size: TEAM_SIZE[t.role], heads: 0 });
      return {
        costs: [{ currency: 'cash', amount: fullTeamPayroll(t.role, t.dept, t.quality), target: '$B/yr payroll' }],
        gains: [{ ...teamGain(s, t), ...(Number.isFinite(weeks) ? { lagDays: weeks * 7 } : {}) }],
        exposure: [],
      };
    },
    apply: (s, _ctx, p) => {
      const cid = str(p, 'candidate', '');
      const r = hireTeam(s, cid ? { candidate: cid } : { key: str(p, 'key', 're.cap') as TeamKey });
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
        costs: [{ currency: 'morale', amount: -Math.min(15, pct), target: t.dept === 'saf' ? 'safety staff' : 'staff' }, ...(t.heads > 0 ? [negate(teamGain(s, t))] : [])],
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
      const to = { ...t, dept: (t.dept === 'cap' ? 'saf' : 'cap') as TeamDept };
      const costs: CostLine[] = [negate(teamGain(s, t))];
      if (t.dept === 'saf') costs.push({ currency: 'morale', amount: MOVE_SAFETY_MORALE, target: 'safety staff' });
      return { costs, gains: [teamGain(s, to)], exposure: [] };
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
      const g = teamGain(s, { role, dept, quality: 'strong' });
      return d > 0
        ? { costs: [{ currency: 'cash', amount: d * fullTeamPayroll(role, dept, 'strong'), target: '$B/yr payroll' }], gains: [{ ...g, amount: g.amount * d }], exposure: [] }
        : { costs: [{ ...g, amount: 0, target: 'no new teams (it never lays off)' }], gains: [], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const k = str(p, 'key', 're.cap') as TeamKey;
      if (!TEAM_KEYS.includes(k)) fail('Unknown team kind');
      fail(setTeamTarget(s, k, num(p, 'n', s.player.hiring.targets[k] ?? 0)));
    },
  },
];

