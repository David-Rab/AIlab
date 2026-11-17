// Teams and roles (STRUCTURE §4.1, research/19 Part 1; BUILD-PLAN R3). Owner: WS1. Replaces staffing.ts hiringWeek.
//
// The player's staff are whole teams of fixed size: engineers (150, one shared pool), research engineers (100,
// capabilities or safety) and scientists (40, a tree-column specialty). Each week:
//   attrition   heads −= heads · 12%/yr · max(0.2, 1.5 − morale/100) / 52   (safety teams use safety morale)
//   candidates  one new team offer from the 'company' stream; offers stay 4 weeks
//   policy      "keep hiring to N" queues one standard (Strong) team per key while teams + queued < N
//   hiring      per department lane: HIRING_BASE · (1 + talentPull/50) · moraleFactor heads, first into vacancies,
//               then into the queued teams in order; a team arrives when it is full
// Engine map: capabilities research engineers → H = Σ heads·quality / 0.55, so h = RE_cap / (0.55·H_ref) and a lab of
// Strong teams in the reference split has h = 1; capabilities scientists' quality and stars → τ_h (Strong = 1);
// engineers → build capacity (readout until R5). `staff.cap/saf` are derived from heads, so every reader still works.
import {
  ATTRITION_BASE, CANDIDATES, CANDIDATE_QUALITY_W, CANDIDATE_RE_SAF, CANDIDATE_ROLE_W, COLUMN_DEPT, COLUMN_LABEL, COLUMNS,
  HIRING_BASE, MOVE_SAFETY_MORALE, QUALITY, REF_ROLE_SHARE, SAF_ROLE_SHARE, START_SPECIALTIES, START_TEAMS, STAR_HIRE,
  TEAM_COST_M, TEAM_KEYS, TEAM_SIZE,
} from '../../../data/v2/teams';
import { decimalYear } from '../core/time';
import { hRef, Phi } from '../production/knots';
import type {
  BaselineId, Column, EngineSystem, GameStateV2, PlayerLab, RngLike, StaffByRole, SystemCtx, Team, TeamCandidate, TeamDept,
  TeamHiring, TeamKey, TeamQuality, TeamRole,
} from '../types';

export const keyOf = (t: Pick<Team, 'role' | 'dept'>): TeamKey => (t.role === 'eng' ? 'eng' : `${t.role}.${t.dept}` as TeamKey);
export const roleOfKey = (k: TeamKey): TeamRole => (k === 'eng' ? 'eng' : (k.split('.')[0] as TeamRole));
/** Department of a key (engineers are one pool on the capabilities budget and lane). */
export const deptOfKey = (k: TeamKey): TeamDept => (k === 'eng' ? 'cap' : (k.split('.')[1] as TeamDept));

/** Hiring multiplier from morale (0.5 at 0, 1 at 50, 1.5 at 100) [D]. */
export const moraleFactor = (morale: number) => Math.min(1.5, Math.max(0.5, 0.5 + morale / 100));
const moraleOf = (p: PlayerLab, dept: TeamDept) => (dept === 'saf' ? p.morale.safety : p.morale.overall);

/** Heads hired per week in a department lane at today's talent pull and morale. */
export function weeklyHireCap(s: GameStateV2, dept: TeamDept): number {
  return HIRING_BASE[dept] * Math.max(0, 1 + s.relations.talentPull / 50) * moraleFactor(moraleOf(s.player, dept));
}

function newTeam(h: Pick<TeamHiring, 'nextId'>, role: TeamRole, dept: TeamDept, quality: TeamQuality, specialty?: Column, heads = TEAM_SIZE[role]): Team {
  const t: Team = { id: `T${h.nextId++}`, role, dept: role === 'eng' ? 'cap' : dept, size: TEAM_SIZE[role], heads, quality };
  if (specialty) t.specialty = specialty;
  return t;
}

/** Specialty for a new standard science team: the department's column with the fewest teams (ties: column order). */
function nextSpecialty(teams: readonly Team[], dept: TeamDept): Column {
  const cols = COLUMNS.filter((c) => COLUMN_DEPT[c] === dept);
  const n = (c: Column) => teams.filter((t) => t.role === 'sci' && t.specialty === c).length;
  return cols.reduce((a, c) => (n(c) < n(a) ? c : a), cols[0]);
}

/** Start roster (STRUCTURE §4.1): all Strong, full. */
export function startTeams(baseline: BaselineId): { teams: Team[]; hiring: TeamHiring } {
  const counts = START_TEAMS[baseline];
  const hiring: TeamHiring = { targets: { ...counts }, candidates: [], filling: [], nextId: 1 };
  const teams: Team[] = [];
  const spec: Record<TeamDept, number> = { cap: 0, saf: 0 };
  for (const k of TEAM_KEYS) {
    const role = roleOfKey(k);
    const dept = deptOfKey(k);
    for (let i = 0; i < counts[k]; i++) {
      const sp = role === 'sci' ? START_SPECIALTIES[dept][spec[dept]++ % START_SPECIALTIES[dept].length] : undefined;
      teams.push(newTeam(hiring, role, dept, 'strong', sp));
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
    for (let i = 0; i < n; i++) out.push(newTeam(h, role, dept, 'strong', role === 'sci' ? nextSpecialty(out, dept) : undefined, Math.min(size, people / n)));
  };
  add('eng', 'cap', staff.cap * REF_ROLE_SHARE.eng);
  add('re', 'cap', staff.cap * REF_ROLE_SHARE.re);
  add('sci', 'cap', staff.cap * REF_ROLE_SHARE.sci);
  add('re', 'saf', staff.saf * SAF_ROLE_SHARE.re);
  add('sci', 'saf', staff.saf * SAF_ROLE_SHARE.sci);
  return out;
}

// ───────── Derived readouts ─────────

/** Effective capabilities headcount for the production function: H = Σ RE_cap heads × quality / 0.55, so
 *  h = H / H_ref = RE_cap / (0.55 · H_ref) (research/19 §1.1). */
export function playerH(p: Pick<PlayerLab, 'teams'>): number {
  let re = 0;
  for (const t of p.teams) if (t.role === 're' && t.dept === 'cap') re += t.heads * QUALITY[t.quality].out;
  return re / REF_ROLE_SHARE.re;
}

/** τ_h = 1 + Σ_i n_i (q_i − q_ref) / Sci_ref + 0.05 · stars over capabilities science teams (research/19 §1.3);
 *  exactly 1 for Strong teams and no stars. Clamped to [0.5, 1.5]. */
export function tauH(p: Pick<PlayerLab, 'teams' | 'stars'>, yr: number): number {
  let d = 0;
  for (const t of p.teams) if (t.role === 'sci' && t.dept === 'cap') d += t.heads * (QUALITY[t.quality].out - 1);
  const tau = 1 + d / (REF_ROLE_SHARE.sci * hRef(yr)) + STAR_HIRE.dTaste * (p.stars ?? 0);
  return Math.min(STAR_HIRE.maxTaste, Math.max(0.5, tau));
}

/** Payroll $B/yr of a team (heads × role cost × quality cost). */
export const teamPayroll = (t: Team) => (t.heads * TEAM_COST_M[t.dept][t.role] * QUALITY[t.quality].cost) / 1000;
/** Payroll of a full team ($B/yr). */
export const fullTeamPayroll = (role: TeamRole, dept: TeamDept, q: TeamQuality) => (TEAM_SIZE[role] * TEAM_COST_M[dept][role] * QUALITY[q].cost) / 1000;

/** Player payroll $B/yr: every team plus the people already hired into queued teams. */
export function payrollOf(p: Pick<PlayerLab, 'teams' | 'hiring'>, dept?: TeamDept): number {
  let b = 0;
  for (const t of p.teams) if (!dept || t.dept === dept) b += teamPayroll(t);
  for (const t of p.hiring.filling) if (!dept || t.dept === dept) b += teamPayroll(t);
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

/** Weeks until a queued team (or a new one, without id) arrives at today's hiring rate: vacancies first (weekly
 *  attrition included), and while it fills, each other queued team takes its weighted share until full. */
export function fillWeeks(s: GameStateV2, team: Pick<Team, 'role' | 'dept' | 'size' | 'heads'> & { id?: string }): number {
  const p = s.player;
  const dept = team.dept;
  let vac = 0;
  let heads = 0;
  for (const t of p.teams) if (t.dept === dept) { vac += t.size - t.heads; heads += t.heads; }
  const attrition = (heads * ATTRITION_BASE * Math.max(0.2, 1.5 - moraleOf(p, dept) / 100)) / 52;
  const spare = weeklyHireCap(s, dept) - attrition;
  if (spare <= 0) return Infinity;
  const ws = laneWeights(p, dept);
  const mine = ws.find((x) => x.t.id === team.id) ?? { t: team as Team, w: team.size - team.heads };
  const rem = team.size - team.heads;
  let need = vac + rem;
  for (const x of ws) if (x.t.id !== team.id) need += Math.min(x.t.size - x.t.heads, (rem * x.w) / Math.max(1e-9, mine.w));
  return Math.max(1, Math.ceil(need / spare - 1e-9));
}

/** Engineers' AI share A_eng = 1 − (1 − A)² on the coding automation A (STRUCTURE §4.1) [Design]. */
export const aEngOf = (A: number) => 1 - (1 - Math.min(1, Math.max(0, A))) ** 2;
/** Build-capacity cap on the AI speed-up [D: agents need human review and integration; ×10 is AI 2027's "SC with
 *  humans in the loop" order of magnitude]. Shown in the build-capacity tooltip. */
export const BUILD_AI_CAP = 10;

/** Build capacity (team-weeks per week): Σ engineer heads/150 × quality × 1/(1 − A_eng), capped. Works the build
 *  queue (departments/build.ts, R5). */
export function buildCapacity(s: GameStateV2): { human: number; aEng: number; capacity: number } {
  let human = 0;
  for (const t of s.player.teams) if (t.role === 'eng') human += (t.heads / TEAM_SIZE.eng) * QUALITY[t.quality].out;
  const aEng = aEngOf(s.player.prodCache?.labor.A ?? 0);
  return { human, aEng, capacity: human * Math.min(BUILD_AI_CAP, 1 / Math.max(1e-9, 1 - aEng)) };
}

// ───────── Candidates ─────────

function drawCandidate(rng: RngLike, h: TeamHiring, day: number): TeamCandidate {
  const role = rng.weighted(CANDIDATE_ROLE_W);
  const quality = rng.weighted(CANDIDATE_QUALITY_W);
  const col = rng.pick(COLUMNS);
  const saf = rng.chance(CANDIDATE_RE_SAF);
  const dept: TeamDept = role === 'sci' ? COLUMN_DEPT[col] : role === 're' && saf ? 'saf' : 'cap';
  const c: TeamCandidate = { id: `C${h.nextId++}`, role, dept, quality, until: day + CANDIDATES.days };
  if (role === 'sci') c.specialty = col;
  return c;
}

/** Drop expired offers and add one new offer (at most CANDIDATES.max). */
export function refreshCandidates(h: TeamHiring, rng: RngLike, day: number) {
  h.candidates = h.candidates.filter((c) => c.until > day);
  if (h.candidates.length < CANDIDATES.max) h.candidates.push(drawCandidate(rng, h, day));
}

/** The start list: CANDIDATES.max offers expiring a week apart. */
export function seedCandidates(h: TeamHiring, rng: RngLike) {
  for (let i = 0; i < CANDIDATES.max; i++) h.candidates.push(drawCandidate(rng, h, 7 * (i + 1) - CANDIDATES.days));
}

// ───────── Weekly system ─────────

/** One week of attrition, offers, the keep-hiring policy and hiring. */
export function teamsWeek(s: GameStateV2, ctx: SystemCtx) {
  const p = s.player;
  const h = p.hiring;
  for (const t of p.teams) {
    const att = (t.heads * ATTRITION_BASE * Math.max(0.2, 1.5 - moraleOf(p, t.dept) / 100)) / 52;
    t.heads = Math.max(0, t.heads - att);
  }
  refreshCandidates(h, ctx.rng('company'), ctx.day);
  applyTargets(p);
  for (const dept of ['cap', 'saf'] as const) {
    let cap = weeklyHireCap(s, dept);
    // Vacancies first, shared in proportion to each team's gap (no role starves another).
    let vac = 0;
    for (const t of p.teams) if (t.dept === dept) vac += Math.max(0, t.size - t.heads);
    if (vac > 0 && cap > 0) {
      const f = Math.min(1, cap / vac);
      for (const t of p.teams) if (t.dept === dept && t.heads < t.size) t.heads = Math.min(t.size, t.heads + (t.size - t.heads) * f);
      cap = Math.max(0, cap - vac * f);
    }
    // Queued teams share the rest by weight (their heads to go plus their key's unqueued deficit), so a short lane
    // hires roles in proportion to how far each is behind; anything left over then goes in queue order.
    const w = laneWeights(p, dept);
    const W = w.reduce((a, x) => a + x.w, 0);
    if (W > 0 && cap > 0) {
      const pool = cap;
      for (const { t, w: wt } of w) {
        const n = Math.min(t.size - t.heads, (pool * wt) / W);
        t.heads += n;
        cap -= n;
      }
    }
    const still: Team[] = [];
    for (const t of h.filling) {
      if (t.dept === dept && cap > 1e-9 && t.heads < t.size) {
        const n = Math.min(cap, t.size - t.heads);
        t.heads += n;
        cap -= n;
      }
      if (t.dept === dept && t.heads >= t.size - 1e-6) {
        t.heads = t.size;
        p.teams.push(t);
        ctx.log('company', `A new ${teamLabel(t)} team joins.`, 1);
        continue;
      }
      still.push(t);
    }
    h.filling = still;
  }
  syncTeams(s);
}

/** Policy "keep hiring to N": queue one standard Strong team per key while teams + queued < N. */
export function applyTargets(p: PlayerLab) {
  const h = p.hiring;
  for (const k of TEAM_KEYS) {
    if (queuedOfKey(p, k).length > 0) continue;
    if (teamsOfKey(p, k).length >= (h.targets[k] ?? 0)) continue;
    const role = roleOfKey(k);
    const dept = deptOfKey(k);
    h.filling.push(newTeam(h, role, dept, 'strong', role === 'sci' ? nextSpecialty([...p.teams, ...h.filling], dept) : undefined, 0));
  }
}

export function teamLabel(t: Pick<Team, 'role' | 'dept' | 'specialty'>): string {
  if (t.role === 'eng') return 'engineering';
  if (t.role === 're') return `research-engineering (${t.dept === 'saf' ? 'safety' : 'capabilities'})`;
  return `${t.specialty ? COLUMN_LABEL[t.specialty] : 'science'} science`;
}

/** hiring (200, weekly): team attrition, offers, keep-hiring policy, team arrivals. */
export const hiringSystem: EngineSystem = {
  id: 'hiring', owner: 'WS1', cadence: 'weekly', order: 200,
  run(s, ctx) {
    if (s.player.status !== 'active') return;
    teamsWeek(s, ctx);
  },
};

// ───────── Player actions (models/actions.ts wraps these) ─────────

/** Queue a candidate (or, without one, a standard Strong team for `key`). It is placed ahead of policy-queued teams
 *  that have not started filling in its lane. */
export function hireTeam(s: GameStateV2, ref: { candidate?: string; key?: TeamKey }): Team | string {
  const p = s.player;
  const h = p.hiring;
  let t: Team;
  if (ref.candidate) {
    const i = h.candidates.findIndex((c) => c.id === ref.candidate);
    if (i < 0) return 'That offer is gone';
    const c = h.candidates[i];
    h.candidates.splice(i, 1);
    t = newTeam(h, c.role, c.dept, c.quality, c.specialty, 0);
  } else {
    const k = ref.key ?? 're.cap';
    if (!TEAM_KEYS.includes(k)) return 'Unknown team kind';
    const role = roleOfKey(k);
    const dept = deptOfKey(k);
    t = newTeam(h, role, dept, 'strong', role === 'sci' ? nextSpecialty([...p.teams, ...h.filling], dept) : undefined, 0);
  }
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
      if (left >= 1) p.hiring.filling.unshift(newTeam(p.hiring, 're', dept, 'strong', undefined, Math.min(TEAM_SIZE.re - 1, left)));
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

/** AI share of each role's work (STRUCTURE §4.1): engineers A_eng; research engineers 1 − wH (the AI part of coding
 *  labour); scientists Φ(sdAI), the share of human scientists AI taste exceeds. */
export function aiShareByRole(s: GameStateV2): Record<TeamRole, number> {
  const pr = s.player.prodCache;
  if (!pr) return { eng: 0, re: 0, sci: 0 };
  return { eng: aEngOf(pr.labor.A), re: 1 - pr.labor.wH, sci: Phi(pr.sdAI) };
}
