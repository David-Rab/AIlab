// Relations: currencies per counterparty, access rungs, favors, scrutiny, cover-ups (V2-SPEC §3.9.1, §3.9.3;
// research/17 §1.2–1.5). Owner: WS4. Also hosts actorsDaily, which steps public, blocs, government and relations.
import { BLOCS } from '../../../data/v2/blocs';
import { startOf } from '../../../data/v2/starts';
import { worldMix } from '../worldfx/mix';
import { revenueReadout } from '../worldfx/revenue';
import type { CounterpartyId, EngineSystem, GameStateV2, LabId, RelationStock, RelationsState, SystemCtx } from '../types';
import { blocsDaily } from './blocs';
import { statutoryDaily } from './commitments';
import { cred, flushDrift, scrutiny, trust } from './fx';
import { govDaily } from './gov';
import { publicDaily } from './public';
import { researchBodiesWeekly } from './researchBodies';
import { request, ws4 } from './state';

const stock = (trust: number, access: RelationStock['access'] = 0): RelationStock => ({ trust, access, favors: [], depOnYou: 0, yourDep: 0, belowRungDays: 0 });

/** Trust gain/loss asymmetry (§3.9.1): gain base·(1 − T/100); loss base·3·(1 + T/100). */
export function trustDelta(T: number, base: number): number {
  return base >= 0 ? base * (1 - T / 100) : base * 3 * (1 + T / 100);
}

/** Access-rung trust thresholds (rungs 1..4) (§3.9.1). */
export const RUNG_TRUST = [0, 25, 45, 65, 80];

export function initialRelations(rivalIds: LabId[]): RelationsState {
  const stocks = {
    exec: stock(55, 1), congress: stock(45), states: stock(40), evalGov: stock(50, 1), evalIndep: stock(45), academia: stock(50), china: stock(30),
  } as Record<CounterpartyId, RelationStock>;
  for (const id of rivalIds) stocks[`rival:${id}`] = stock(40);
  for (const b of BLOCS) stocks[`bloc:${b.id}`] = stock(Math.round(50 + b.approval / 2));
  return { stocks, credibility: 50, talentPull: 10, scrutiny: 20, dataLicences: [] };
}

/** Register a quiet fix that outsiders may discover over `horizon` days (P from access, §3.9.3 rule 1). */
export function addCoverup(s: GameStateV2, what: string, pTotal: number, audience: CounterpartyId[], horizon = 180) {
  const w = ws4(s);
  const pDaily = 1 - Math.pow(1 - Math.min(0.99, pTotal), 1 / horizon);
  w.coverups.push({ id: `cv${s.time.day}-${w.coverups.length}`, day: s.time.day, what, pDaily, audience, until: s.time.day + horizon });
}

/** Daily relation upkeep: scrutiny half-life 90 d, favor expiry, access rungs, dependence capture, cover-ups. */
function relationsDaily(s: GameStateV2, ctx: SystemCtx) {
  const rel = s.relations;
  const w = ws4(s);
  const day = ctx.day;
  const ds = -rel.scrutiny * (Math.LN2 / 90);
  rel.scrutiny = Math.max(0, rel.scrutiny + ds);
  w.drift['relations.scrutiny'] = (w.drift['relations.scrutiny'] ?? 0) + ds;
  let capture = 0;
  for (const [cp, st] of Object.entries(rel.stocks) as [CounterpartyId, RelationStock][]) {
    if (st.favors.length && st.favors[0] < day) st.favors = st.favors.filter((d) => d >= day);
    if (cp.startsWith('bloc:')) continue;
    // Access rungs: climb at the threshold if an agreement allows it; drop after 30 d below the threshold.
    const cap = w.accessCap[cp] ?? 0;
    if (st.access < 4 && st.access < cap && st.trust >= RUNG_TRUST[st.access + 1]) {
      st.access = (st.access + 1) as RelationStock['access'];
      st.belowRungDays = 0;
    } else if (st.access > 0 && st.trust < RUNG_TRUST[st.access]) {
      if (++st.belowRungDays >= 30) {
        st.access = (st.access - 1) as RelationStock['access'];
        st.belowRungDays = 0;
        ctx.log('company', `Access with ${cp} slips after a month of low trust.`, 1);
      }
    } else st.belowRungDays = 0;
    if (st.depOnYou > 60 && st.yourDep > 60) capture += 0.05;
    st.depOnYou = Math.max(0, st.depOnYou - 0.01);
  }
  if (capture) {
    rel.scrutiny = Math.min(100, rel.scrutiny + capture);
    w.drift['relations.scrutiny'] = (w.drift['relations.scrutiny'] ?? 0) + capture;
  }
  // Cover-ups: discovered → ×3 trust loss with every audience, credibility −15 (§3.9.3 rule 1).
  if (w.coverups.length) {
    const rng = ctx.rng('actors');
    for (const c of [...w.coverups]) {
      if (day > c.until) {
        w.coverups.splice(w.coverups.indexOf(c), 1);
        continue;
      }
      if (!rng.chance(c.pDaily)) continue;
      w.coverups.splice(w.coverups.indexOf(c), 1);
      w.leaked++;
      for (const cp of c.audience) trust(s, ctx, cp, -6, 'cover-up exposed', c.what);
      cred(ctx, -15, 'cover-up exposed', c.what);
      scrutiny(ctx, 15, 'cover-up exposed', c.what);
      ctx.bump('pub.approval', -8, 'cover-up exposed', c.what);
      ctx.log('alert', `A cover-up is exposed: ${c.what}.`, 4);
      ctx.headline('coverup', `Report: ${s.player.name} hid ${c.what}.`);
    }
  }
  // Internal report left past its deadline → it goes external at 2× damage (A6).
  const ir = w.internalReport;
  if (ir && day > ir.deadline) {
    delete w.internalReport;
    request(s, 'E19', { mult: 2 });
  }
  // Capacity crunch (E36, §4.2 "demand > capacity by > 30%"): WS5 marks capacity-bound deployments (demandBound);
  // only then read WS5's demand/capacity readout to measure the excess over those deployments.
  const bound = new Set(s.player.deployments.filter((d) => d.status === 'live' && d.channel !== 'internal' && d.demandBound === 'capacity').map((d) => d.id));
  let crunch = false;
  if (bound.size) {
    let dem = 0;
    let cap = 0;
    for (const x of revenueReadout(s, worldMix(s, ctx)).deps) if (bound.has(x.id)) {
      dem += x.demand;
      cap += x.capacity;
    }
    crunch = dem > 1.3 * cap;
  }
  w.crunchDays = crunch ? w.crunchDays + 1 : 0;
  // Talent pull drifts back to the start type's anchor (leader 10; spinout 30, challenger 20, big tech 0; R9).
  const dt = (startOf(s).mods.talentPull - rel.talentPull) * 0.002;
  rel.talentPull += dt;
  w.drift['relations.talentPull'] = (w.drift['relations.talentPull'] ?? 0) + dt;
}

/** actorsDaily (120, daily): public meters, bloc mobilization decay, gov ladder hold-days, favor expiry, scrutiny
 *  decay; weekly research-body work and drift flush. */
export const actorsDailySystem: EngineSystem = {
  id: 'actorsDaily', owner: 'WS4', cadence: 'daily', order: 120, system: 'relations',
  run(s, ctx) {
    const w = ws4(s);
    if (!w.gdp0) w.gdp0 = s.world.macro.US.gdp;
    publicDaily(s, ctx);
    blocsDaily(s, ctx);
    govDaily(s, ctx);
    relationsDaily(s, ctx);
    statutoryDaily(s, ctx);
    if (ctx.day % 7 === 0) {
      researchBodiesWeekly(s, ctx);
      flushDrift(s, ctx);
    }
  },
};
