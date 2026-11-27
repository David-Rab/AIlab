// Teams and roles (STRUCTURE §4.1, research/19 Part 1; BUILD-PLAN R3). Owner: WS1. Replaces staffing.ts hiringWeek.
//
// The player's staff are whole teams of fixed size: engineers (150, one shared pool), research engineers (100,
// capabilities or safety) and scientists (40, a tree-column specialty). Each week:
//   the labour market (departments/market.ts, L12): inflow into the pools, leavers at SEPARATION × the morale factor
//               (safety teams use safety morale), the market wage, hires by the matching function per kind (first into
//               vacancies, then into the queued teams by lane weight and in order; a team arrives when it is full), pay
//   policy      "keep hiring to N" queues one standard team per key while teams + queued < N
// Engine map (model v3 V3): capabilities research engineers serve the research-engineer needs (models/research.ts
// reAllocation: run operations, evals, project experiments, tuning; the production readout's h is those on
// experiments + tuning over the leader lab's day-0 value); capabilities scientists run projects, each team's taste the
// AIFM company mean (departments/workfit.ts teamTaste) × the star factor τ_h (tauH); engineers →
// build capacity (buildCapacity, the build queue of departments/build.ts). `staff.cap/saf` are derived from heads.
import {
  COLUMN_DEPT, COLUMN_LABEL, COLUMNS,
  MOVE_SAFETY_MORALE, REF_ROLE_SHARE, SAF_ROLE_SHARE, START_SPECIALTIES, START_TEAMS, starTasteOf,
  TEAM_KEYS, TEAM_SIZE,
} from '../../../data/v2/teams';
import { START_BY_ID } from '../../../data/v2/starts';
import { FORCING } from '../core/forcing';
import { decimalYear } from '../core/time';
import { Phi } from '../production/ces';
import { marketWeek, offerOf, weeksToFill } from './market';
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
/** Leavers' multiplier from morale: max(0.2, 1.5 − morale/100) (V2-SPEC §3.4.1), on SEPARATION (departments/market.ts). */
export const attritionMorale = (p: Pick<PlayerLab, 'morale'>, dept: TeamDept) => Math.max(0.2, 1.5 - moraleOf(p, dept) / 100);

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
  const hiring: TeamHiring = { targets: { ...counts }, filling: [], nextId: 1, premium: { eng: 0, re: 0, sci: 0 } };
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

/** Whole teams in the reference split for a headcount (migration from staff, absorbed staff). Leftover heads go into
 *  partly filled teams (vacancies the hiring lane refills). */
export function teamsFromStaff(h: Pick<TeamHiring, 'nextId'>, staff: StaffByRole): Team[] {
  const out: Team[] = [];
  const add = (role: TeamRole, dept: TeamDept, people: number) => {
    if (people < 1) return;
    const size = TEAM_SIZE[role];
    const n = Math.max(1, Math.round(people / size));
    for (let i = 0; i < n; i++) out.push(newTeam(h, role, dept, role === 'sci' ? nextSpecialty(out, dept) : undefined, Math.min(size, people / n)));
  };
  add('eng', 'cap', staff.cap * REF_ROLE_SHARE.eng);
  add('re', 'cap', staff.cap * REF_ROLE_SHARE.re);
  add('sci', 'cap', staff.cap * REF_ROLE_SHARE.sci);
  add('re', 'saf', staff.saf * SAF_ROLE_SHARE.re);
  add('sci', 'saf', staff.saf * SAF_ROLE_SHARE.sci);
  return out;
}

// ───────── Derived readouts ─────────

/** Effective capabilities headcount for the production function: H = Σ RE_cap heads / 0.55, so
 *  h = H / H_ref = RE_cap / (0.55 · H_ref) (research/19 §1.1). */
export function playerH(p: Pick<PlayerLab, 'teams'>): number {
  let re = 0;
  for (const t of p.teams) if (t.role === 're' && t.dept === 'cap') re += t.heads;
  return re / REF_ROLE_SHARE.re;
}

/** Star-hire taste bench τ_h = 1 + 0.05 · stars (capped at 1.5). Model v3 V3: every team's taste is the AIFM company
 *  mean (departments/workfit.ts teamTaste), no lab-level τ normalised by the reference headcount; stars lift every capabilities team's human taste by this factor. */
export function tauH(p: Pick<PlayerLab, 'teams' | 'stars'>, _yr?: number): number {
  return starTasteOf(p.stars ?? 0);
}

/** Payroll $B/yr of a team: heads × the lab's pay for the kind (p.pay, departments/market.ts; one pay per kind for
 *  capabilities and safety). */
export const teamPayroll = (p: Pick<PlayerLab, 'pay'>, t: Pick<Team, 'heads' | 'role'>) => (t.heads * p.pay[t.role]) / 1000;
/** Payroll of a new full team ($B/yr): its seats at today's offer (new hires are paid the offer, market.ts). */
export const fullTeamPayroll = (s: GameStateV2, role: TeamRole) => (TEAM_SIZE[role] * offerOf(s, role)) / 1000;

/** Player payroll $B/yr: every team plus the people already hired into queued teams, at the lab's pay per kind. */
export function payrollOf(p: Pick<PlayerLab, 'teams' | 'hiring' | 'pay'>, dept?: TeamDept): number {
  let b = 0;
  for (const t of p.teams) if (!dept || t.dept === dept) b += teamPayroll(p, t);
  for (const t of p.hiring.filling) if (!dept || t.dept === dept) b += teamPayroll(p, t);
  return b;
}

/** Staff by department from team heads (arrived teams only). */
export function staffOf(teams: readonly Team[]): StaffByRole {
  const st: StaffByRole = { cap: 0, saf: 0 };
  for (const t of teams) st[t.dept] += t.heads;
  return st;
}

/** Re-derive staff.cap/saf and τ_h from the roster. Call after any roster change. */
export function syncTeams(s: GameStateV2) {
  const p = s.player;
  const st = staffOf(p.teams);
  p.staff.cap = st.cap;
  p.staff.saf = st.saf;
  p.tasteHire = tauH(p, decimalYear(s));
}

export const teamsOfKey = (p: Pick<PlayerLab, 'teams'>, k: TeamKey) => p.teams.filter((t) => keyOf(t) === k);
export const queuedOfKey = (p: Pick<PlayerLab, 'hiring'>, k: TeamKey) => p.hiring.filling.filter((t) => keyOf(t) === k);

/** A queued team's weight in its lane: its heads to go plus an equal part of its key's deficit not yet queued. */
export function laneWeights(p: Pick<PlayerLab, 'teams' | 'hiring'>, dept: TeamDept): { t: Team; w: number }[] {
  const q = p.hiring.filling.filter((t) => t.dept === dept && t.heads < t.size);
  return q.map((t) => {
    const k = keyOf(t);
    const nq = q.filter((u) => keyOf(u) === k).length;
    const extra = Math.max(0, (p.hiring.targets[k] ?? 0) - teamsOfKey(p, k).length - nq) * t.size;
    return { t, w: t.size - t.heads + extra / nq };
  });
}

/** Weeks until a queued team (or a new one, without id) arrives at today's matching rate (departments/market.ts
 *  weeksToFill: today's U, premium, talent pull and morale on the kind's open positions, less its weekly leavers):
 *  vacancies of the kind first, and while it fills, each other queued team of the kind takes its weighted share. */
export function fillWeeks(s: GameStateV2, team: Pick<Team, 'role' | 'dept' | 'size' | 'heads'> & { id?: string }): number {
  const p = s.player;
  const k = team.role;
  let vac = 0;
  for (const t of p.teams) if (t.role === k) vac += Math.max(0, t.size - t.heads);
  const ws = [...laneWeights(p, 'cap'), ...laneWeights(p, 'saf')].filter((x) => x.t.role === k);
  const queued = ws.find((x) => x.t.id === team.id);
  const mine = queued ?? { t: team as Team, w: team.size - team.heads };
  const rem = team.size - team.heads;
  let need = vac + rem;
  for (const x of ws) if (x.t.id !== team.id) need += Math.min(x.t.size - x.t.heads, (rem * x.w) / Math.max(1e-9, mine.w));
  const inQueue = team.id !== undefined && p.hiring.filling.some((t) => t.id === team.id);
  return weeksToFill(s, k, need, inQueue ? 0 : rem);
}

/** Build capacity (team-weeks per week) = effective software-engineering labour (model v3 V3.3): the engineers' team-
 *  equivalents (heads/150) and the engineering agents' AI labour in the optimal human/AI task split at the
 *  agents' SWE coverage, with the assist speed-up on the human share (departments/workfit.ts, production/ces.ts
 *  optimalLabour). The split is never below the humans alone, so there is no separate floor; no cap: once AI is plentiful
 *  the coding CES's human bottleneck on the uncovered work, (1 − a)^((1−ρc)/ρc), is the limit (×1.4 at 2025's coverage,
 *  ×32 at 0.9). No engineers, no capacity (nobody to run the builds). Works the build queue (departments/build.ts, R5). */
export function buildCapacity(s: GameStateV2): { human: number; aEng: number; capacity: number } {
  let human = 0;
  for (const t of s.player.teams) if (t.role === 'eng') human += t.heads / TEAM_SIZE.eng;
  const swe = workContext(s).slots.SWE;
  return { human, aEng: swe.fit.a, capacity: human > 0 ? swe.L : 0 };
}

// ───────── Weekly system ─────────

const forcedH0 = new WeakMap<object, number>();
/**
 * HARNESS EXCEPTION (designer-approved 2026-11-26): forces the player's headcount to the AIFM L_HUMAN path in forced calibration runs only, because the game's hiring cannot follow it. Pending the hiring-market mechanic (design/BAL-TASKS.md). Not a game mechanic; never set in play.
 * Choice: every capabilities team's heads are scaled by one common factor (team mix kept), to H0 × staffPath(year),
 * H0 = capabilities heads at the first call. Applied at the end of each hiring week; payroll follows the heads.
 */
function forcePlayerStaff(s: GameStateV2) {
  const sp = FORCING.staffPath;
  if (!FORCING.playerStaffExact || sp === undefined) return;
  const caps = s.player.teams.filter((t) => t.dept === 'cap');
  const now = caps.reduce((a, t) => a + t.heads, 0);
  let h0 = forcedH0.get(s);
  if (h0 === undefined) { h0 = now; forcedH0.set(s, h0); }
  if (now <= 0) return;
  const f = (h0 * sp(decimalYear(s))) / now;
  for (const t of caps) t.heads *= f;
  syncTeams(s);
}

/** One week of the labour market (departments/market.ts: inflow, leavers, wage, hires by the matching function, pay),
 *  with the keep-hiring policy and team arrivals. */
export function teamsWeek(s: GameStateV2, ctx: SystemCtx) {
  marketWeek(s, ctx);
  syncTeams(s);
  forcePlayerStaff(s);
}

/** Policy "keep hiring to N": queue one standard Strong team per key while teams + queued < N. */
export function applyTargets(p: PlayerLab) {
  const h = p.hiring;
  for (const k of TEAM_KEYS) {
    if (queuedOfKey(p, k).length > 0) continue;
    if (teamsOfKey(p, k).length >= (h.targets[k] ?? 0)) continue;
    const role = roleOfKey(k);
    const dept = deptOfKey(k);
    h.filling.push(newTeam(h, role, dept, role === 'sci' ? nextSpecialty([...p.teams, ...h.filling], dept) : undefined, 0));
  }
}

export function teamLabel(t: Pick<Team, 'role' | 'dept' | 'specialty'>): string {
  if (t.role === 'eng') return 'engineering';
  if (t.role === 're') return `research-engineering (${t.dept === 'saf' ? 'safety' : 'capabilities'})`;
  return `${t.specialty ? COLUMN_LABEL[t.specialty] : 'science'} science`;
}

/** hiring (200, weekly): team attrition, keep-hiring policy, team arrivals. */
export const hiringSystem: EngineSystem = {
  id: 'hiring', owner: 'WS1', cadence: 'weekly', order: 200, system: 'people',
  run(s, ctx) {
    if (s.player.status !== 'active') return;
    teamsWeek(s, ctx);
  },
};

// ───────── Player actions (models/actions.ts wraps these) ─────────

/** Queue a standard team for `key`. It is placed ahead of policy-queued teams that have not started filling in its lane. */
export function hireTeam(s: GameStateV2, ref: { key?: TeamKey }): Team | string {
  const p = s.player;
  const h = p.hiring;
  const k0 = ref.key ?? 're.cap';
  if (!TEAM_KEYS.includes(k0)) return 'Unknown team kind';
  const role = roleOfKey(k0);
  const dept = deptOfKey(k0);
  const t = newTeam(h, role, dept, role === 'sci' ? nextSpecialty([...p.teams, ...h.filling], dept) : undefined, 0);
  const at = h.filling.findIndex((f) => f.dept === t.dept && f.heads === 0);
  if (at < 0) h.filling.push(t);
  else h.filling.splice(at, 0, t);
  // The team counts toward its keep-hiring target (raise it so the policy does not treat it as extra).
  const k = keyOf(t);
  h.targets[k] = Math.max(h.targets[k] ?? 0, teamsOfKey(p, k).length + queuedOfKey(p, k).length);
  return t;
}

/** Let a team go (or cancel a queued one). Morale −1 per 1% of the department let go (max 15); the keep-hiring
 *  target drops so the policy does not hire it back. */
export function releaseTeam(s: GameStateV2, ctx: SystemCtx, id: string): string | undefined {
  const p = s.player;
  const h = p.hiring;
  const inTeams = p.teams.findIndex((t) => t.id === id);
  const inQueue = h.filling.findIndex((t) => t.id === id);
  if (inTeams < 0 && inQueue < 0) return 'No such team';
  const t = inTeams >= 0 ? p.teams[inTeams] : h.filling[inQueue];
  const k = keyOf(t);
  const deptHeads = staffOf(p.teams)[t.dept];
  if (inTeams >= 0) p.teams.splice(inTeams, 1);
  else h.filling.splice(inQueue, 1);
  h.targets[k] = Math.min(h.targets[k] ?? 0, teamsOfKey(p, k).length + queuedOfKey(p, k).length);
  const pct = (100 * t.heads) / Math.max(1, deptHeads);
  if (t.heads > 0) ctx.bump(t.dept === 'saf' ? 'morale.safety' : 'morale', -Math.min(15, pct), 'layoffs', teamLabel(t));
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

/** People gained or lost outside hiring (poaching, acquisitions, events). Losses come off every team in the
 *  department in proportion (the lane refills them); gains fill vacancies first, then form whole Strong teams in the
 *  reference split; leftover people start a queued research-engineering team. */
export function changeHeads(s: GameStateV2, dept: TeamDept, delta: number) {
  const p = s.player;
  if (!Number.isFinite(delta) || delta === 0) return;
  const mine = p.teams.filter((t) => t.dept === dept);
  if (delta < 0) {
    const total = mine.reduce((a, t) => a + t.heads, 0);
    const f = total > 0 ? Math.max(0, 1 + delta / total) : 0;
    for (const t of mine) t.heads *= f;
  } else {
    let left = delta;
    for (const t of mine) {
      if (left <= 0) break;
      const n = Math.min(left, t.size - t.heads);
      t.heads += n;
      left -= n;
    }
    if (left > 0) {
      const add = teamsFromStaff(p.hiring, dept === 'cap' ? { cap: left, saf: 0 } : { cap: 0, saf: left }).filter((t) => t.heads >= t.size - 1e-6);
      for (const t of add) {
        p.teams.push(t);
        left -= t.heads;
        const k = keyOf(t);
        p.hiring.targets[k] = Math.max(p.hiring.targets[k] ?? 0, teamsOfKey(p, k).length);
      }
      if (left >= 1) p.hiring.filling.unshift(newTeam(p.hiring, 're', dept, undefined, Math.min(TEAM_SIZE.re - 1, left)));
    }
  }
  syncTeams(s);
}

/** Set the keep-hiring target for a key. */
export function setTeamTarget(s: GameStateV2, key: TeamKey, n: number): string | undefined {
  if (!TEAM_KEYS.includes(key)) return 'Unknown team kind';
  s.player.hiring.targets[key] = Math.max(0, Math.round(n));
  return undefined;
}

/** Star hire: +0.05 τ_h. */
export function hireStar(s: GameStateV2) {
  s.player.stars = (s.player.stars ?? 0) + 1;
  syncTeams(s);
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
