// The labour market's weekly system (design/bal/LABOUR-ROUND.md §4.2; L12). Called from teams.ts `teamsWeek`.
// One pool per kind k ∈ {eng, re, sci} (capabilities and safety staff of a kind share it). Each week:
//   inflow    P_k += I_k / 52                                           (net inflow; the game has no exit flow from P)
//   leavers   heads −= heads · SEPARATION · max(0.2, 1.5 − morale/100) / 52   (back to U by construction: U = P − E)
//   E, U      E_k = heads of kind k in AI labs (the player, plus the rivals' and China's PLACEHOLDER heads); U_k = P_k − E_k
//   wage      w_k = w0_k · [(E_k / U_k) / (E0_k / U0_k)]^(1/η)            (E0, U0 at game start, startMarket)
//   hires     min(V_k, μ_k · U_k^α · V_k^(1−α) · (1 + π_k)^ε · pull · morale / 52)
//   poach     share 1 − (1+π)^(−ε) of the rivals' leavers (heads · SEPARATION / 52) join the player, up to the V left
//   pay       new hires at the offer w_k (1 + π_k); every head's pay relaxes toward the offer at 1/T per year
// V_k = the player's open positions of kind k: vacancies in arrived teams, the queued teams' unfilled seats and the
// keep-hiring targets' seats not yet queued (the whole hiring-target gap). Automation enters only through V (the
// player's own targets). Poaching (L13): with a premium, a share of the rivals' leavers joins the player. No stars (L17).
import { ALPHA, EPS, ETA, F0_PER_MONTH, INFLOW, LABOUR_KINDS, PAY_RENEWAL_YEARS, SEPARATION, W0 } from '../../../data/v2/labourMarket';
import { REF_ROLE_SHARE, SAF_ROLE_SHARE, TEAM_SIZE, TEAM_KEYS } from '../../../data/v2/teams';
import { applyTargets, attritionMorale, laneWeights, moraleFactor, moraleOf, teamLabel } from './teams';
import type { GameStateV2, LabourPool, PlayerLab, SystemCtx, Team, TeamDept, TeamRole } from '../types';

const WEEKS = 52;

// ───────── Heads in AI labs (E) and outside (U) ─────────

/** The player's heads of kind k: arrived teams plus the people already hired into queued teams. */
export function playerHeads(p: Pick<PlayerLab, 'teams' | 'hiring'>, k: TeamRole): number {
  let n = 0;
  for (const t of p.teams) if (t.role === k) n += t.heads;
  for (const t of p.hiring.filling) if (t.role === k) n += t.heads;
  return n;
}

/**
 * PLACEHOLDER (LABOUR-ROUND §4.2 item 2, L14; "the full version belongs to the rival session", §4.2.2): the rivals' and
 * China's heads of kind k. Their staff follow today's paths (rivalModel.ts growLabStaff, the hRef growth, run for China's
 * lab too: rivals.ts labDaily) as departments (`core.staff.cap/saf`), split here by REF_ROLE_SHARE (capabilities) and
 * SAF_ROLE_SHARE (safety; no safety engineers). They count in E (the rivals AND China) but are never rationed by the pool
 * and do not respond to wages or automation. The only thing that moves them is the player's poaching (poachFromRivals,
 * rivals only, never China).
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

/** V_k by department: vacancies in arrived teams, queued teams' unfilled seats, and the keep-hiring targets' seats
 *  not yet queued (whole teams). The player's own targets: the only place automation enters. */
export function openPositionsByDept(p: Pick<PlayerLab, 'teams' | 'hiring'>, k: TeamRole): Record<TeamDept, number> {
  const v: Record<TeamDept, number> = { cap: 0, saf: 0 };
  for (const t of p.teams) if (t.role === k) v[t.dept] += Math.max(0, t.size - t.heads);
  for (const t of p.hiring.filling) if (t.role === k) v[t.dept] += Math.max(0, t.size - t.heads);
  for (const key of TEAM_KEYS) {
    const role = (key === 'eng' ? 'eng' : key.split('.')[0]) as TeamRole;
    if (role !== k) continue;
    const dept = (key === 'eng' ? 'cap' : key.split('.')[1]) as TeamDept;
    const have = p.teams.filter((t) => t.role === k && t.dept === dept).length + p.hiring.filling.filter((t) => t.role === k && t.dept === dept).length;
    v[dept] += Math.max(0, (p.hiring.targets[key] ?? 0) - have) * TEAM_SIZE[k];
  }
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

/** Talent pull multiplier (today's, [D]): 1 + talentPull/50, floor 0. */
export const pullOf = (s: GameStateV2) => Math.max(0, 1 + s.relations.talentPull / 50);

/** The morale multiplier for kind k: today's moraleFactor per department, weighted by where the openings are. */
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

// ───────── Poaching (L13) ─────────

/** The share of a rival's leavers that joins the player at premium π: 1 − (1 + π)^(−ε) (0 at π = 0). */
export const poachShare = (pi: number) => (pi > 0 ? 1 - Math.pow(1 + pi, -EPS) : 0);

/**
 * PLACEHOLDER (LABOUR-ROUND §4.2 item 5; the full version belongs to the rival session): this week's poaching of kind k
 * from the rivals (never China). Each active rival's leavers of the kind are heads_k × SEPARATION / 52; a share
 * poachShare(π_k) of them joins the player, at most `room` heads in all (the player's open positions left after the normal
 * hires; the rivals are scaled down together when it binds). The rival loses exactly the poached number of heads, split
 * between `core.staff.cap` and `core.staff.saf` by where the kind's heads sit (the roster keeps its fixed REF_ROLE_SHARE /
 * SAF_ROLE_SHARE mix, so the other kinds shrink with it). growLabStaff multiplies the lower number from then on: the loss
 * is not refilled. Returns the heads poached.
 */
export function poachFromRivals(s: GameStateV2, k: TeamRole, room: number): number {
  const share = poachShare(premiumOf(s.player, k));
  if (share <= 0 || room <= 0) return 0;
  const rows: { r: GameStateV2['rivals'][number]; capK: number; safK: number; leavers: number }[] = [];
  let total = 0;
  for (const r of s.rivals) {
    if (r.core.status !== 'active') continue;
    const capK = r.core.staff.cap * REF_ROLE_SHARE[k];
    const safK = k === 'eng' ? 0 : r.core.staff.saf * SAF_ROLE_SHARE[k];
    const leavers = ((capK + safK) * SEPARATION * share) / WEEKS;
    rows.push({ r, capK, safK, leavers });
    total += leavers;
  }
  if (total <= 0) return 0;
  const scale = Math.min(1, room / total);
  for (const { r, capK, safK, leavers } of rows) {
    const n = leavers * scale;
    const h = capK + safK;
    if (n <= 0 || h <= 0) continue;
    r.core.staff.cap = Math.max(0, r.core.staff.cap - (n * capK) / h);
    r.core.staff.saf = Math.max(0, r.core.staff.saf - (n * safK) / h);
  }
  return total * scale;
}

// ───────── Weekly flows ─────────

/** Place n hires of kind k: vacancies first (in proportion to each team's gap), then the queued teams of the kind by
 *  their lane weights, then in queue order; a team arrives when full and the keep-hiring policy queues the next, which
 *  takes any hires left. Returns the heads placed. */
function placeHires(s: GameStateV2, ctx: SystemCtx | undefined, k: TeamRole, n: number): number {
  const p = s.player;
  const h = p.hiring;
  const n0 = n;
  let vac = 0;
  for (const t of p.teams) if (t.role === k) vac += Math.max(0, t.size - t.heads);
  if (vac > 0 && n > 0) {
    const f = Math.min(1, n / vac);
    for (const t of p.teams) if (t.role === k && t.heads < t.size) t.heads = Math.min(t.size, t.heads + (t.size - t.heads) * f);
    n = Math.max(0, n - vac * f);
  }
  for (let pass = 0; pass < 64; pass++) {
    const w = [...laneWeights(p, 'cap'), ...laneWeights(p, 'saf')].filter((x) => x.t.role === k);
    const W = w.reduce((a, x) => a + x.w, 0);
    if (W > 0 && n > 1e-9) {
      const pool = n;
      for (const { t, w: wt } of w) {
        const m = Math.min(t.size - t.heads, (pool * wt) / W);
        t.heads += m;
        n -= m;
      }
    }
    for (const t of h.filling) {
      if (t.role !== k || n <= 1e-9 || t.heads >= t.size) continue;
      const m = Math.min(n, t.size - t.heads);
      t.heads += m;
      n -= m;
    }
    let arrived = false;
    const still: Team[] = [];
    for (const t of h.filling) {
      if (t.role === k && t.heads >= t.size - 1e-6) {
        t.heads = t.size;
        p.teams.push(t);
        ctx?.log('company', `A new ${teamLabel(t)} team joins.`, 1);
        arrived = true;
        continue;
      }
      still.push(t);
    }
    h.filling = still;
    if (!arrived || n <= 1e-9) break;
    applyTargets(p); // the next team of a key whose target is not met yet takes the hires left
  }
  return n0 - Math.max(0, n);
}

/** The pay blend after `hired` new heads at the offer, then one week of renewal toward the offer (rate 1/T per year,
 *  continuous: the gap shrinks by e^(−1/(52 T)) a week, 1 − e^−1 ≈ 63% after a year). `before` = heads before hiring. */
export function repriceWeek(pay: number, before: number, hired: number, offer: number): number {
  const total = before + hired;
  const blended = total > 0 ? (before * pay + hired * offer) / total : offer;
  return offer + (blended - offer) * Math.exp(-1 / (WEEKS * PAY_RENEWAL_YEARS));
}

/** One week of the labour market for the player (inflow, leavers, wage, hires, pay). Called from teams.ts teamsWeek. */
export function marketWeek(s: GameStateV2, ctx: SystemCtx | undefined) {
  const p = s.player;
  const L = s.labour;
  for (const k of LABOUR_KINDS) base(s, k); // saves from before L12: the reference before this week's flows
  // 1. Inflow.
  for (const k of LABOUR_KINDS) L.pools[k].P += INFLOW[k] / WEEKS;
  // 5. Leavers (separation × today's morale factor); they leave E, so they are back in U.
  for (const t of p.teams) {
    const att = (t.heads * SEPARATION * attritionMorale(p, t.dept)) / WEEKS;
    t.heads = Math.max(0, t.heads - att);
  }
  applyTargets(p);
  for (const k of LABOUR_KINDS) {
    // 3. The market wage from this week's E and U.
    L.pools[k].w = marketWage(s, k);
    const offer = offerOf(s, k);
    // 4. Hires (the matching function), placed into vacancies then queued teams.
    const before = playerHeads(p, k);
    const V = openPositions(p, k);
    let hired = placeHires(s, ctx, k, weeklyHires(s, k));
    // 5. Poaching (premium only): a share of the rivals' leavers fills the positions the matching left open.
    const poached = poachFromRivals(s, k, V - hired);
    if (poached > 0) hired += placeHires(s, ctx, k, poached);
    // 6. Pay: new hires at the offer, everyone toward it.
    p.pay[k] = repriceWeek(p.pay[k], before, hired, offer);
  }
}

/** Expected weeks to fill `need` heads of kind k at today's U, premium, pull and morale: the matching rate on the open
 *  positions V (which shrink as they fill), less the kind's weekly leavers; Infinity if hiring cannot outpace leavers
 *  within ten years. `extraV` = open seats the question adds (a team not yet queued). */
export function weeksToFill(s: GameStateV2, k: TeamRole, need: number, extraV = 0): number {
  const p = s.player;
  const byDept = openPositionsByDept(p, k);
  let V = byDept.cap + byDept.saf + extraV;
  const morale = kindMorale(s, k, byDept);
  let att = 0;
  for (const t of p.teams) if (t.role === k) att += (t.heads * SEPARATION * attritionMorale(p, t.dept)) / WEEKS;
  const c = matchRate(s, k, 1, morale); // the matching rate at V = 1: rate(V) = c V^(1−α) (U, π, pull, morale held)
  let left = need;
  for (let wk = 1; wk <= 520; wk++) {
    const net = Math.min(V, c * Math.pow(V, 1 - ALPHA)) - att;
    if (net <= 0) return Infinity;
    left -= net;
    if (left <= 1e-6) return wk;
    V = Math.max(left, V - net);
  }
  return Infinity;
}

/** Player payroll of kind-k heads at the lab's pay, $B/yr. */
export const kindPayroll = (p: Pick<PlayerLab, 'pay'>, k: TeamRole, heads: number) => (heads * p.pay[k]) / 1000;
