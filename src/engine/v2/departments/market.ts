// The labour market's weekly system (design/bal/LABOUR-ROUND.md §4.2; L12; teams as whole chunks). Called from teams.ts
// `teamsWeek`. One pool per kind k ∈ {eng, re, sci} (capabilities and safety staff of a kind share it). Each week:
//   inflow    P_k += I_k / 52                                           (net inflow; the game has no exit flow from P)
//   E, U      E_k = heads of kind k in AI labs (the player, plus the NPC labs' and China's background heads); U_k = P_k − E_k
//   wage      w_k = w0_k · [(E_k / U_k) / (E0_k / U0_k)]^(1/η)            (E0, U0 at game start, startMarket)
//   hires     min(V_k, μ_k · U_k^α · V_k^(1−α) · (1 + π_k)^ε · pull · morale / 52)
//   poach     with a premium, a share 1 − (1+π)^(−ε) of those hires comes from the rival labs, not the outside pool (each
//             rival takes the poach-in shock, npc/shocks.ts)
//   chunks    the hires add up in p.hiring.progress[k]; at the kind's TEAM_SIZE a FULL team arrives (never a part team)
//   pay       new hires at the offer w_k (1 + π_k); every head's pay relaxes toward the offer at 1/T per year
// Teams are whole chunks: no vacancies, no hiring queue, no player leavers (staff go only when the player lets a team go or
// an event moves them). V_k = the target gap in heads (Σ over the kind's keys of (target teams − teams) × size) less the
// progress already made. Automation enters only through V (the player's own targets). No stars (L17).
import { startOf } from '../../../data/v2/starts';
import { ALPHA, EPS, ETA, F0_PER_MONTH, INFLOW, LABOUR_KINDS, PAY_RENEWAL_YEARS, W0 } from '../../../data/v2/labourMarket';
import { REF_ROLE_SHARE, SAF_ROLE_SHARE, TEAM_SIZE, TEAM_KEYS } from '../../../data/v2/teams';
import { deptOfKey, moraleFactor, moraleOf, nextSpecialty, roleOfKey, teamLabel } from './teams';
import * as shock from '../npc/shocks';
import { PUBLIC } from '../world/public';
import type { GameStateV2, LabourPool, PlayerLab, RivalLab, SystemCtx, Team, TeamDept, TeamKey, TeamRole } from '../types';

const WEEKS = 52;

// ───────── Heads in AI labs (E) and outside (U) ─────────

/** The player's heads of kind k: arrived teams plus the people hired toward the next team. */
export function playerHeads(p: Pick<PlayerLab, 'teams' | 'hiring'>, k: TeamRole): number {
  let n = p.hiring.progress[k]?.heads ?? 0;
  for (const t of p.teams) if (t.role === k) n += t.heads;
  return n;
}

/**
 * The NPC labs' and China's heads of kind k: background demand (designer, 2026-11-27; NPC-LABS §2 principles 2 and 7). Their
 * staff are the NPC labs' own (npc/lab.ts: compute × one typical staff ratio at the start, then growLabStaff's reference
 * headcount growth, China's lab too: rivals.ts labDaily) as departments (`core.staff.cap/saf`), split here by REF_ROLE_SHARE
 * (capabilities) and SAF_ROLE_SHARE (safety; no safety engineers). They count in E, so they raise the wage for everyone,
 * but are never rationed by the pool, do not respond to wages or automation, and do not drive the labs' progress (an NPC
 * lab moves by its lag rule and the §5 shocks). Besides their growth, only people moving to or from the player change them:
 * poaching (poachFromRivals, C4; rivals only, never China) and E16's let-go.
 */
export function otherLabHeads(s: Pick<GameStateV2, 'rivals' | 'china'>, k: TeamRole): number {
  let n = 0;
  for (const r of [...s.rivals, s.china.lab]) {
    if (r.core.status !== 'active') continue;
    n += r.core.staff.cap * REF_ROLE_SHARE[k] + (k === 'eng' ? 0 : r.core.staff.saf * SAF_ROLE_SHARE[k]);
  }
  return n;
}

/** E_k: heads of kind k in AI labs. */
export const labHeads = (s: GameStateV2, k: TeamRole) => playerHeads(s.player, k) + otherLabHeads(s, k);
/** U_k = P_k − E_k (floor 1 person, so the wage and the matching stay finite if the pool is ever exhausted). */
export const outsideHeads = (s: GameStateV2, k: TeamRole) => Math.max(1, s.labour.pools[k].P - labHeads(s, k));

/** The start's reference E0, U0 per kind (set once at game start; lazily for saves from before L12). */
function base(s: GameStateV2, k: TeamRole): Required<LabourPool> {
  const pool = s.labour.pools[k];
  if (pool.E0 === undefined || pool.U0 === undefined) {
    pool.E0 = labHeads(s, k);
    pool.U0 = Math.max(1, pool.P - pool.E0);
  }
  return pool as Required<LabourPool>;
}

/** Game start: record E0, U0 per kind (core/init.ts newGame, after the rosters exist). */
export function startMarket(s: GameStateV2) {
  for (const k of LABOUR_KINDS) {
    const pool = s.labour.pools[k];
    pool.E0 = labHeads(s, k);
    pool.U0 = Math.max(1, pool.P - pool.E0);
  }
}

// ───────── Wage and offer ─────────

/** w_k = w0_k · [(E/U) / (E0/U0)]^(1/η): the wage that pulls the next person out of the outside pool (log-logistic
 *  reservation wages of shape η). Equals w0 at the start. */
export function marketWage(s: GameStateV2, k: TeamRole): number {
  const b = base(s, k);
  const ratio = labHeads(s, k) / outsideHeads(s, k);
  const ratio0 = b.E0 / b.U0;
  return ratio0 > 0 ? W0[k] * Math.pow(ratio / ratio0, 1 / ETA) : W0[k];
}

/** The player's premium π_k (p.hiring.premium; set by the 'hiring.premium' action, teamActions.ts). */
export const premiumOf = (p: Pick<PlayerLab, 'hiring'>, k: TeamRole) => Math.max(0, p.hiring.premium?.[k] ?? 0);
/** The player's offer per head, $M/yr: the market wage × (1 + π_k). */
export const offerOf = (s: GameStateV2, k: TeamRole) => s.labour.pools[k].w * (1 + premiumOf(s.player, k));

// ───────── Open positions (V) and the matching ─────────

/** How many teams of `key` the player is short of its keep-hiring target. */
export const teamGap = (p: Pick<PlayerLab, 'teams' | 'hiring'>, key: TeamKey): number => {
  const role = roleOfKey(key);
  const dept = deptOfKey(key);
  return Math.max(0, (p.hiring.targets[key] ?? 0) - p.teams.filter((t) => t.role === role && t.dept === dept).length);
};

/** The key the next team of kind k will be: the stored one while it is still short of its target, else the key furthest
 *  behind its target (ties: key order). With no gap anywhere, the stored key. */
export function nextKeyOf(p: Pick<PlayerLab, 'teams' | 'hiring'>, k: TeamRole): TeamKey {
  const cur = p.hiring.progress[k].key;
  if (teamGap(p, cur) > 0) return cur;
  let best = cur;
  let g = 0;
  for (const key of TEAM_KEYS) {
    if (roleOfKey(key) !== k) continue;
    const gap = teamGap(p, key);
    if (gap > g) { best = key; g = gap; }
  }
  return best;
}

/** V_k by department: the keep-hiring targets' gap in heads (whole teams) less the progress toward the next team (taken
 *  off the department of the key it is for). The player's own targets: the only place automation enters. */
export function openPositionsByDept(p: Pick<PlayerLab, 'teams' | 'hiring'>, k: TeamRole): Record<TeamDept, number> {
  const v: Record<TeamDept, number> = { cap: 0, saf: 0 };
  for (const key of TEAM_KEYS) if (roleOfKey(key) === k) v[deptOfKey(key)] += teamGap(p, key) * TEAM_SIZE[k];
  const d = deptOfKey(nextKeyOf(p, k));
  v[d] = Math.max(0, v[d] - (p.hiring.progress[k]?.heads ?? 0));
  return v;
}
export function openPositions(p: Pick<PlayerLab, 'teams' | 'hiring'>, k: TeamRole): number {
  const v = openPositionsByDept(p, k);
  return v.cap + v.saf;
}

/** Reference V for the matching scale: one team's seats of the kind (TEAM_SIZE). A fixed number, never the player's
 *  later choices: μ makes a lab opening one team's worth of seats fill them at F0 a month at the start. */
export const MU_REF_V: Record<TeamRole, number> = TEAM_SIZE;

/** μ_k (per year): the matching function's scale, a unit translation fixed at the start pool U0 so that at π = 0 and
 *  neutral pull and morale (pull 1 at talent pull 0, morale factor 1 at morale 50) the monthly fill rate hires/V at the
 *  reference V is F0: μ U0^α Vref^(−α) / 12 = F0 ⇒ μ = 12 F0 (Vref / U0)^α. The leader start's talent pull (10) and
 *  morale (70) then fill faster than the average opening, as today's multipliers [D] say. */
export function matchScale(s: GameStateV2, k: TeamRole): number {
  const b = base(s, k);
  return 12 * F0_PER_MONTH * Math.pow(MU_REF_V[k] / b.U0, ALPHA);
}

/** Talent pull multiplier [D]: 1 + talentPull/50 at the start type's anchor (data/v2/starts.ts mods; no drift or bumps)
 *  plus approval / 5 (one approval for customers and hiring), floor 0. */
export const pullOf = (s: GameStateV2) => Math.max(0, 1 + (startOf(s).mods.talentPull + s.public.approval / PUBLIC.pullPerApproval) / 50);

/** The morale multiplier for kind k: today's moraleFactor per department, weighted by where the openings are. Morale's
 *  only effect on staff is this hiring speed (nobody leaves). */
export function kindMorale(s: GameStateV2, k: TeamRole, byDept = openPositionsByDept(s.player, k)): number {
  const V = byDept.cap + byDept.saf;
  if (V <= 0) return moraleFactor(moraleOf(s.player, 'cap'));
  return (byDept.cap * moraleFactor(moraleOf(s.player, 'cap')) + byDept.saf * moraleFactor(moraleOf(s.player, 'saf'))) / V;
}

/** Hires a week for V open positions of kind k at today's U, premium, pull and morale (the matching function, before
 *  the min with V). */
export function matchRate(s: GameStateV2, k: TeamRole, V: number, morale: number, U = outsideHeads(s, k)): number {
  if (V <= 0) return 0;
  const pi = premiumOf(s.player, k);
  return (matchScale(s, k) * Math.pow(U, ALPHA) * Math.pow(V, 1 - ALPHA) * Math.pow(1 + pi, EPS) * pullOf(s) * morale) / WEEKS;
}

/** This week's hires of kind k at the current openings: min(V, the matching rate). */
export function weeklyHires(s: GameStateV2, k: TeamRole): number {
  const byDept = openPositionsByDept(s.player, k);
  const V = byDept.cap + byDept.saf;
  return Math.min(V, matchRate(s, k, V, kindMorale(s, k, byDept)));
}

/** Weeks until the next team of kind k is full: the weeks it takes for the hires to add up to (size − progress), week by week
 *  as the game runs them (hires = min(V, matching rate on V), V shrinking as they come; U, premium, pull and morale held).
 *  The first week's share is (size − progress) ÷ this week's hires. `extraV` = seats a team not yet in the targets would add
 *  (a hire preview). Infinity when nothing is being hired. */
export function weeksToNextTeam(s: GameStateV2, k: TeamRole, extraV = 0): number {
  const p = s.player;
  const byDept = openPositionsByDept(p, k);
  let V = byDept.cap + byDept.saf + extraV;
  const c = matchRate(s, k, 1, kindMorale(s, k, byDept)); // the matching rate at V = 1: rate(V) = c V^(1−α)
  let need = Math.max(0, TEAM_SIZE[k] - (p.hiring.progress[k]?.heads ?? 0));
  for (let wk = 1; wk <= 520; wk++) {
    const h = Math.min(V, c * Math.pow(V, 1 - ALPHA));
    if (!(h > 0)) return Infinity;
    need -= h;
    V -= h;
    if (need <= 1e-6) return wk;
  }
  return Infinity;
}

// ───────── Poaching (L13) ─────────

/** The share of the player's hires that comes from the rival labs at premium π: 1 − (1 + π)^(−ε) (0 at π = 0). */
export const poachShare = (pi: number) => (pi > 0 ? 1 - Math.pow(1 + pi, -EPS) : 0);

/** Where `n` poached hires of kind k come from: the active rivals (never China), split by their heads of the kind and
 *  capped by what they have; each rival's share split between `core.staff.cap` and `core.staff.saf` by where the kind's heads
 *  sit (the roster keeps its fixed REF_ROLE_SHARE / SAF_ROLE_SHARE mix). Pure: poachFromRivals applies it, the premium
 *  preview reads it. */
export function poachSplit(s: GameStateV2, k: TeamRole, n: number): { r: RivalLab; cap: number; saf: number }[] {
  if (!(n > 0)) return [];
  const rows: { r: RivalLab; capK: number; safK: number }[] = [];
  let total = 0;
  for (const r of s.rivals) {
    if (r.core.status !== 'active') continue;
    const capK = r.core.staff.cap * REF_ROLE_SHARE[k];
    const safK = k === 'eng' ? 0 : r.core.staff.saf * SAF_ROLE_SHARE[k];
    if (capK + safK <= 0) continue;
    rows.push({ r, capK, safK });
    total += capK + safK;
  }
  if (total <= 0) return [];
  const take = Math.min(n, total);
  return rows.map(({ r, capK, safK }) => ({ r, cap: (take * capK) / total, saf: (take * safK) / total }));
}

/** The days the rivals fall back if `n` hires of kind k are poached: the poach-in shock (npc/shocks.ts poachInDays) of each
 *  rival's capabilities heads moved, summed. The premium preview reads it with a year of poached hires. */
export const poachFallbackDays = (s: GameStateV2, k: TeamRole, n: number) =>
  poachSplit(s, k, n).reduce((a, m) => a + shock.poachInDays(s, m.r, m.cap), 0);

/**
 * `n` of this week's hires of kind k come from the rivals (poachSplit). Each rival takes the poach-in shock (npc/shocks.ts
 * poachIn, the one rule for people moving to the player, as C4) by the capabilities heads it loses (the shock's measure is
 * the share of its capabilities staff), sized before they go, then loses exactly its heads. growLabStaff multiplies the
 * lower number from then on: the loss is not refilled. Returns the heads taken.
 */
export function poachFromRivals(s: GameStateV2, k: TeamRole, n: number): number {
  let took = 0;
  for (const { r, cap, saf } of poachSplit(s, k, n)) {
    shock.poachIn(s, r, cap);
    r.core.staff.cap = Math.max(0, r.core.staff.cap - cap);
    r.core.staff.saf = Math.max(0, r.core.staff.saf - saf);
    took += cap + saf;
  }
  return took;
}

// ───────── Weekly flows ─────────

/** Add n hires of kind k to the progress toward the next team; each time it reaches the team size a full team arrives (of
 *  the key furthest behind its target) and the rest carries on toward the next. Returns the heads placed. */
function placeHires(s: GameStateV2, ctx: SystemCtx | undefined, k: TeamRole, n: number): number {
  const p = s.player;
  const prog = p.hiring.progress[k];
  const size = TEAM_SIZE[k];
  let left = n;
  for (let i = 0; i < 64 && left > 1e-9; i++) {
    prog.key = nextKeyOf(p, k);
    if (teamGap(p, prog.key) <= 0) break; // no open team: hires never exceed V, so this is rounding only
    const m = Math.min(left, size - prog.heads);
    prog.heads += m;
    left -= m;
    if (prog.heads < size - 1e-6) break;
    const dept = deptOfKey(prog.key);
    const t: Team = { id: `T${p.hiring.nextId++}`, role: k, dept, size, heads: size };
    if (k === 'sci') t.specialty = nextSpecialty(p.teams, dept);
    p.teams.push(t);
    prog.heads = 0;
    ctx?.log('company', `A new ${teamLabel(t)} team joins.`, 1);
  }
  prog.key = nextKeyOf(p, k);
  return n - Math.max(0, left);
}

/** The pay blend after `hired` new heads at the offer, then one week of renewal toward the offer (rate 1/T per year,
 *  continuous: the gap shrinks by e^(−1/(52 T)) a week, 1 − e^−1 ≈ 63% after a year). `before` = heads before hiring. */
export function repriceWeek(pay: number, before: number, hired: number, offer: number): number {
  const total = before + hired;
  const blended = total > 0 ? (before * pay + hired * offer) / total : offer;
  return offer + (blended - offer) * Math.exp(-1 / (WEEKS * PAY_RENEWAL_YEARS));
}

/** One week of the labour market for the player (inflow, wage, hires toward whole teams, poaching, pay). Called from
 *  teams.ts teamsWeek. */
export function marketWeek(s: GameStateV2, ctx: SystemCtx | undefined) {
  const p = s.player;
  const L = s.labour;
  for (const k of LABOUR_KINDS) base(s, k); // saves from before L12: the reference before this week's flows
  // 1. Inflow.
  for (const k of LABOUR_KINDS) L.pools[k].P += INFLOW[k] / WEEKS;
  for (const k of LABOUR_KINDS) {
    // 2. The market wage from this week's E and U.
    L.pools[k].w = marketWage(s, k);
    const offer = offerOf(s, k);
    // 3. Hires (the matching function) toward the next team; with a premium a share of them is taken from the rivals.
    const before = playerHeads(p, k);
    const hires = weeklyHires(s, k);
    poachFromRivals(s, k, hires * poachShare(premiumOf(p, k)));
    const hired = placeHires(s, ctx, k, hires);
    // 4. Pay: new hires at the offer, everyone toward it.
    p.pay[k] = repriceWeek(p.pay[k], before, hired, offer);
  }
}

/** Player payroll of kind-k heads at the lab's pay, $B/yr. */
export const kindPayroll = (p: Pick<PlayerLab, 'pay'>, k: TeamRole, heads: number) => (heads * p.pay[k]) / 1000;
