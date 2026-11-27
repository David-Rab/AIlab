// Teams and roles (STRUCTURE §4.1, research/19 Part 1; BUILD-PLAN R3). Owner: WS1. Replaces staffing.ts hiringWeek.
//
// The player's staff are whole teams of fixed size: engineers (150, one shared pool), research engineers (100,
// capabilities or safety) and scientists (40, a tree-column specialty). Each week:
//   the labour market (departments/market.ts, L12): inflow into the pools, the market wage, hires by the matching function
//               per kind (they add up toward the next team; a FULL team arrives when they reach its size), poaching, pay
//   policy      "keep hiring to N": the open positions are the gap to N teams, in whole teams (no vacancies, no queue)
// Teams are whole chunks: nobody leaves except when the player lets a team go or an event moves staff (changeHeads).
// Engine map (model v3 V3): capabilities research engineers serve the research-engineer needs (models/research.ts
// reAllocation: run operations, evals, project experiments, tuning; the production readout's h is those on
// experiments + tuning over the leader lab's day-0 value); capabilities scientists run projects, each team's taste the
// AIFM company mean (departments/workfit.ts teamTaste; the lab's humans = humanTasteMean, which the stars join); engineers →
// build capacity (buildCapacity, the build queue of departments/build.ts). `staff.cap/saf` are derived from heads.
import {
  COLUMN_DEPT, COLUMN_LABEL, COLUMNS,
  MOVE_SAFETY_MORALE, REF_ROLE_SHARE, SAF_ROLE_SHARE, START_SPECIALTIES, START_TEAMS,
  TEAM_KEYS, TEAM_SIZE,
} from '../../../data/v2/teams';
import { LABOUR_KINDS } from '../../../data/v2/labourMarket';
import { START_BY_ID } from '../../../data/v2/starts';
import { ENG_UNIT_HEADS } from '../../../data/v2/workTypes';
import { Phi } from '../production/ces';
import { marketWeek, offerOf, weeksToNextTeam } from './market';
import { measuredLabour, sdAIOf, workContext } from './workfit';
import type {
  BaselineId, Column, EngineSystem, GameStateV2, PlayerLab, StaffByRole, StartType, SystemCtx, Team, TeamDept,
  TeamHiring, TeamKey, TeamRole,
} from '../types';

export const keyOf = (t: Pick<Team, 'role' | 'dept'>): TeamKey => (t.role === 'eng' ? 'eng' : `${t.role}.${t.dept}` as TeamKey);
export const roleOfKey = (k: TeamKey): TeamRole => (k === 'eng' ? 'eng' : (k.split('.')[0] as TeamRole));
/** Department of a key (engineers are one pool on the capabilities budget and lane). */
export const deptOfKey = (k: TeamKey): TeamDept => (k === 'eng' ? 'cap' : (k.split('.')[1] as TeamDept));

/** Hiring multiplier from morale (0.5 at 0, 1 at 50, 1.5 at 100) [D]. */
export const moraleFactor = (morale: number) => Math.min(1.5, Math.max(0.5, 0.5 + morale / 100));
export const moraleOf = (p: Pick<PlayerLab, 'morale'>, dept: TeamDept) => (dept === 'saf' ? p.morale.safety : p.morale.overall);

function newTeam(h: Pick<TeamHiring, 'nextId'>, role: TeamRole, dept: TeamDept, specialty?: Column, heads = TEAM_SIZE[role]): Team {
  const t: Team = { id: `T${h.nextId++}`, role, dept: role === 'eng' ? 'cap' : dept, size: TEAM_SIZE[role], heads };
  if (specialty) t.specialty = specialty;
  return t;
}

/** Specialty for a new standard science team: the department's column with the fewest teams (ties: column order). */
export function nextSpecialty(teams: readonly Team[], dept: TeamDept): Column {
  const cols = COLUMNS.filter((c) => COLUMN_DEPT[c] === dept);
  const n = (c: Column) => teams.filter((t) => t.role === 'sci' && t.specialty === c).length;
  return cols.reduce((a, c) => (n(c) < n(a) ? c : a), cols[0]);
}

/** Start roster (STRUCTURE §4.1): all Strong, full. */
export function startTeams(baseline: BaselineId, start: StartType = 'leader'): { teams: Team[]; hiring: TeamHiring } {
  // The leader start keeps today's roster (START_TEAMS by baseline); the other starts follow data/v2/starts.ts (R9).
  const def = START_BY_ID[start];
  const leader = start === 'leader';
  const counts = leader ? START_TEAMS[baseline] : def.teams;
  const specs = leader ? START_SPECIALTIES : def.specialties;
  const hiring: TeamHiring = { targets: { ...counts }, progress: { eng: { key: 'eng', heads: 0 }, re: { key: 're.cap', heads: 0 }, sci: { key: 'sci.cap', heads: 0 } }, nextId: 1, premium: { eng: 0, re: 0, sci: 0 } };
  const teams: Team[] = [];
  const spec: Record<TeamDept, number> = { cap: 0, saf: 0 };
  for (const k of TEAM_KEYS) {
    const role = roleOfKey(k);
    const dept = deptOfKey(k);
    for (let i = 0; i < counts[k]; i++) {
      const sp = role === 'sci' ? specs[dept][spec[dept]++ % specs[dept].length] : undefined;
      teams.push(newTeam(hiring, role, dept, sp));
    }
  }
  return { teams, hiring };
}

// ───────── Derived readouts ─────────

/** Effective capabilities headcount for the production function: H = Σ RE_cap heads / 0.55, so
 *  h = H / H_ref = RE_cap / (0.55 · H_ref) (research/19 §1.1). */
export function playerH(p: Pick<PlayerLab, 'teams'>): number {
  let re = 0;
  for (const t of p.teams) if (t.role === 're' && t.dept === 'cap') re += t.heads;
  return re / REF_ROLE_SHARE.re;
}

/** Payroll $B/yr of a team: heads × the lab's pay for the kind (p.pay, departments/market.ts; one pay per kind for
 *  capabilities and safety). */
export const teamPayroll = (p: Pick<PlayerLab, 'pay'>, t: Pick<Team, 'heads' | 'role'>) => (t.heads * p.pay[t.role]) / 1000;
/** Payroll of a new full team ($B/yr): its seats at today's offer (new hires are paid the offer, market.ts). */
export const fullTeamPayroll = (s: GameStateV2, role: TeamRole) => (TEAM_SIZE[role] * offerOf(s, role)) / 1000;

/** Player payroll $B/yr: every team plus the people already hired toward the next team, at the lab's pay per kind, plus the
 *  stars on staff (a star's pay is $M/yr; stars count under the capabilities department; LABOUR-ROUND §6.3). It takes
 *  the state, not the lab, so the star pay cannot be left out. */
export function payrollOf(s: Pick<GameStateV2, 'player' | 'labour'>, dept?: TeamDept): number {
  const p = s.player;
  let b = !dept || dept === 'cap' ? s.labour.stars.reduce((a, x) => a + (x.employer === 'player' ? x.pay : 0), 0) / 1000 : 0;
  for (const t of p.teams) if (!dept || t.dept === dept) b += teamPayroll(p, t);
  for (const k of LABOUR_KINDS) {
    const g = p.hiring.progress[k];
    if (g.heads > 0 && (!dept || deptOfKey(g.key) === dept)) b += (g.heads * p.pay[k]) / 1000;
  }
  return b;
}

/** Staff by department from team heads (arrived teams only). */
export function staffOf(teams: readonly Team[]): StaffByRole {
  const st: StaffByRole = { cap: 0, saf: 0 };
  for (const t of teams) st[t.dept] += t.heads;
  return st;
}

/** Re-derive staff.cap/saf from the roster. Call after any roster change. */
export function syncTeams(s: GameStateV2) {
  const p = s.player;
  const st = staffOf(p.teams);
  p.staff.cap = st.cap;
  p.staff.saf = st.saf;
}

export const teamsOfKey = (p: Pick<PlayerLab, 'teams'>, k: TeamKey) => p.teams.filter((t) => keyOf(t) === k);

/** Weeks until the next team of kind k arrives at this week's hires: (size − progress) ÷ hires (departments/market.ts
 *  weeksToNextTeam). `extraV` = the seats of a team not yet in the targets (a hire preview). Infinity when nothing is open. */
export const fillWeeks = (s: GameStateV2, k: TeamRole, extraV = 0): number => weeksToNextTeam(s, k, extraV);

/** Build capacity (team-weeks per week) = effective software-engineering labour (model v3 V3.3): the engineers' team-
 *  equivalents (heads/ENG_UNIT_HEADS = 150, the reference unit, not the real team size) and the engineering agents' AI labour in the optimal human/AI task split at the
 *  agents' SWE coverage, with the assist speed-up on the human share (departments/workfit.ts, production/ces.ts
 *  optimalLabour). The split is never below the humans alone, so there is no separate floor; no cap: once AI is plentiful
 *  the coding CES's human bottleneck on the uncovered work, (1 − a)^((1−ρc)/ρc), is the limit (×1.4 at 2025's coverage,
 *  ×32 at 0.9). No engineers, no capacity (nobody to run the builds). Works the build queue (departments/build.ts, R5). */
export function buildCapacity(s: GameStateV2): { human: number; aEng: number; capacity: number } {
  let human = 0;
  for (const t of s.player.teams) if (t.role === 'eng') human += t.heads / ENG_UNIT_HEADS;
  const swe = workContext(s).slots.SWE;
  return { human, aEng: swe.fit.a, capacity: human > 0 ? swe.L : 0 };
}

// ───────── Weekly system ─────────

/** One week of the labour market (departments/market.ts: inflow, wage, hires toward whole teams, poaching, pay). */
export function teamsWeek(s: GameStateV2, ctx: SystemCtx) {
  marketWeek(s, ctx);
  syncTeams(s);
}

export function teamLabel(t: Pick<Team, 'role' | 'dept' | 'specialty'>): string {
  if (t.role === 'eng') return 'engineering';
  if (t.role === 're') return `research-engineering (${t.dept === 'saf' ? 'safety' : 'capabilities'})`;
  return `${t.specialty ? COLUMN_LABEL[t.specialty] : 'science'} science`;
}

/** hiring (200, weekly): the labour market, hires toward whole teams, team arrivals. */
export const hiringSystem: EngineSystem = {
  id: 'hiring', owner: 'WS1', cadence: 'weekly', order: 200, system: 'people',
  run(s, ctx) {
    if (s.player.status !== 'active') return;
    teamsWeek(s, ctx);
  },
};

// ───────── Player actions (models/actions.ts wraps these) ─────────

/** Hire a team for `key`: one more team in its keep-hiring target (the market's hires build toward it, then a full team arrives). */
export function hireTeam(s: GameStateV2, ref: { key?: TeamKey }): string | undefined {
  const p = s.player;
  const k = ref.key ?? 're.cap';
  if (!TEAM_KEYS.includes(k)) return 'Unknown team kind';
  p.hiring.targets[k] = Math.max(p.hiring.targets[k] ?? 0, teamsOfKey(p, k).length) + 1;
  return undefined;
}

/** Let an arrived team go. Morale −1 per 1% of the department let go (max 15); the keep-hiring target drops so the policy
 *  does not hire it back. */
export function releaseTeam(s: GameStateV2, ctx: SystemCtx, id: string): string | undefined {
  const p = s.player;
  const i = p.teams.findIndex((t) => t.id === id);
  if (i < 0) return 'No such team';
  const t = p.teams[i];
  const k = keyOf(t);
  const deptHeads = staffOf(p.teams)[t.dept];
  p.teams.splice(i, 1);
  p.hiring.targets[k] = Math.min(p.hiring.targets[k] ?? 0, teamsOfKey(p, k).length);
  const pct = (100 * t.heads) / Math.max(1, deptHeads);
  ctx.bump(t.dept === 'saf' ? 'morale.safety' : 'morale', -Math.min(15, pct), 'layoffs', teamLabel(t));
  syncTeams(s);
  return undefined;
}

/** Move a research-engineering team between capabilities and safety; safety → capabilities costs safety morale. */
export function moveTeam(s: GameStateV2, ctx: SystemCtx, id: string): string | undefined {
  const p = s.player;
  const t = p.teams.find((x) => x.id === id);
  if (!t) return 'No such team';
  if (t.role !== 're') return 'Only research-engineering teams move';
  const from = keyOf(t);
  t.dept = t.dept === 'cap' ? 'saf' : 'cap';
  const to = keyOf(t);
  p.hiring.targets[from] = Math.max(0, (p.hiring.targets[from] ?? 0) - 1);
  p.hiring.targets[to] = (p.hiring.targets[to] ?? 0) + 1;
  if (from === 're.saf') ctx.bump('morale.safety', MOVE_SAFETY_MORALE, 'safety team moved to capabilities');
  syncTeams(s);
  return undefined;
}

/** People gained or lost outside hiring (events, acquisitions, poaching actions), in whole teams. The head change is split
 *  by the role shares (REF_ROLE_SHARE for capabilities, SAF_ROLE_SHARE for safety) and each role's share rounded to whole teams
 *  of its size. A gain adds that many full teams (a gain also raises the keep-hiring target to hold them); a loss removes
 *  that many whole teams, newest first, as many as the department has. Returns the heads actually moved (signed). */
export function changeHeads(s: GameStateV2, dept: TeamDept, delta: number): number {
  const p = s.player;
  if (!Number.isFinite(delta) || delta === 0) return 0;
  const share: Partial<Record<TeamRole, number>> = dept === 'cap' ? REF_ROLE_SHARE : SAF_ROLE_SHARE;
  let moved = 0;
  for (const role of ['eng', 're', 'sci'] as TeamRole[]) {
    const n = Math.round((Math.abs(delta) * (share[role] ?? 0)) / TEAM_SIZE[role]);
    const k = dept === 'cap' && role === 'eng' ? 'eng' : (`${role}.${dept}` as TeamKey);
    for (let i = 0; i < n; i++) {
      if (delta > 0) {
        const team = newTeam(p.hiring, role, dept, role === 'sci' ? nextSpecialty(p.teams, dept) : undefined);
        p.teams.push(team);
        moved += team.size;
      } else {
        const at = p.teams.map((x) => keyOf(x)).lastIndexOf(k);
        if (at < 0) break;
        moved -= p.teams[at].heads;
        p.teams.splice(at, 1);
      }
    }
    if (delta > 0) p.hiring.targets[k] = Math.max(p.hiring.targets[k] ?? 0, teamsOfKey(p, k).length);
  }
  syncTeams(s);
  return moved;
}

/** Set the keep-hiring target for a key. */
export function setTeamTarget(s: GameStateV2, key: TeamKey, n: number): string | undefined {
  if (!TEAM_KEYS.includes(key)) return 'Unknown team kind';
  s.player.hiring.targets[key] = Math.max(0, Math.round(n));
  return undefined;
}

/** AI share of each role's work (STRUCTURE §4.1): engineers their SWE coverage (model v3 V3); research engineers 1 − wH (the AI part of coding
 *  labour); scientists Φ(sdAI), the share of human scientists AI taste exceeds. */
export function aiShareByRole(s: GameStateV2): Record<TeamRole, number> {
  // UB-2: from the measured / believed labour (workfit.ts measuredLabour), never the true fit or the hidden production
  // parameters (was the production cache: the engine's coverage, 1 ÷ m_EXP and AI taste).
  const wc = workContext(s);
  const eng = measuredLabour(s, wc.slots.SWE);
  const exp = measuredLabour(s, wc.slots.EXP);
  const ideas = wc.slots.IDEAS.aiFte > 0 ? measuredLabour(s, wc.slots.IDEAS) : undefined;
  return { eng: wc.slots.SWE.aiFte > 0 ? eng.fit.a : 0, re: exp.m > 1 ? 1 - 1 / exp.m : 0, sci: ideas ? Phi(sdAIOf(s.hidden.timeline, ideas.fit.fit)) : 0 };
}
