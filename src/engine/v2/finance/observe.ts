// What finance can see of a lab (FINANCE-V3 §1; FINANCE-BUILD rule 4). The V3 seam: finance reads model-v3-owned
// quantities (models, products, revenue) only through these four selectors. Until MODEL-V3 lands they bridge to today's
// engine; the bodies change, the signatures stay. Owner: WS3.
import { tcoPerYear, cloudPricePerYear } from '../compute/market';
import { ownedOnline, rentedOnline } from '../compute/power';
import { PLAYER_ID } from '../models/labs';
import { revenueOf, servingPool } from '../worldfx/revenue';
import type { GameStateV2, H100e, LabId, Money } from '../types';

const rival = (s: GameStateV2, lab: LabId) => s.rivals.find((r) => r.core.id === lab);

/** Level of the lab's best *public* model (what markets can see): the player's deployed, non-internal versions
 *  (measured level where evaluated), a rival's public model; 0 if none. */
export function publicLevel(s: GameStateV2, lab: LabId = PLAYER_ID): number {
  if (lab === PLAYER_ID) {
    let L = 0;
    for (const d of s.player.deployments) {
      if (d.status === 'withdrawn' || d.channel === 'internal') continue;
      const v = s.player.models.versions.find((x) => x.id === d.versionId);
      if (v) L = Math.max(L, v.evals.measuredL ?? v.Lg);
    }
    return L;
  }
  return rival(s, lab)?.publicModel?.Lg ?? 0;
}

/** Best public level across every lab (the public frontier markets price). */
export function publicFrontier(s: GameStateV2): number {
  let L = publicLevel(s, PLAYER_ID);
  for (const r of s.rivals) if (r.publicModel) L = Math.max(L, r.publicModel.Lg);
  return L;
}

/** Revenue run-rate implied by the player's priced deployments ($B/yr), or undefined while none is priced yet. The
 *  finance run-rate (`finance.revenueRun`) smooths toward it (cashflow.ts). */
export function deploymentRevenue(s: GameStateV2): Money | undefined {
  let any = false;
  let sum = 0;
  for (const d of s.player.deployments) {
    if (d.revenueRate === undefined) continue;
    any = true;
    if (d.status !== 'withdrawn') sum += revenueOf(s, d.id);
  }
  return any ? sum : undefined;
}

/** Revenue run-rate ($B/yr) markets and lenders read. */
export function revenueRun(s: GameStateV2, lab: LabId = PLAYER_ID): Money {
  return lab === PLAYER_ID ? s.player.finance.revenueRun : rival(s, lab)?.finance.revenueRun ?? 0;
}

export interface ServingEconomics { revenue: Money; cost: Money; margin: number }

/** Serving gross margin = (serving revenue − serving compute cost) ÷ serving revenue (spec §1 Economics). Bridge until
 *  MODEL-V3 §7.3: revenue = the run-rate; cost = serving H100e × (owned share × owned TCO + rented share × cloud price).
 *  Rivals have no split of owned and rented: owned TCO. */
export function servingEconomics(s: GameStateV2, lab: LabId = PLAYER_ID): ServingEconomics {
  const revenue = revenueRun(s, lab);
  const owned = tcoPerYear(s.market.listPrice, s.power.kWPerH100e); // $K per H100e-year
  let cost: Money;
  if (lab === PLAYER_ID) {
    const own = ownedOnline(s);
    const rent = rentedOnline(s);
    const ownShare = own + rent > 0 ? own / (own + rent) : 1;
    cost = (servingPool(s) * (ownShare * owned + (1 - ownShare) * cloudPricePerYear(s))) / 1e6;
  } else {
    const r = rival(s, lab);
    cost = r ? (r.core.computeOnline * (r.core.split.serving ?? 0) * owned) / 1e6 : 0;
  }
  return { revenue, cost, margin: revenue > 0 ? (revenue - cost) / revenue : 0 };
}

/** Compute secured (H100e): online now plus contracted to arrive within the next 8 quarters (chip orders still to be
 *  delivered, firm tranches, cloud contracts that have not started). Rivals: online plus open chip orders. */
export function computeSecured(s: GameStateV2, lab: LabId = PLAYER_ID): H100e {
  if (lab === PLAYER_ID) {
    const q0 = s.market.ws3?.q ?? 0;
    let h = s.player.computeOnline;
    for (const o of s.player.orders) {
      h += Math.max(0, o.qty - o.delivered);
      if (o.kind === 'lta') h += o.qty * Math.max(0, Math.min(q0 + 8, o.ltaEndQ ?? o.dueQ) - o.dueQ - 1);
    }
    for (const c of s.player.cloud) if (c.startDay > s.time.day) h += c.h100e;
    return h;
  }
  const r = rival(s, lab);
  if (!r) return 0;
  return r.core.computeOnline + (s.market.ws3?.labOrders ?? []).filter((o) => o.lab === lab).reduce((a, o) => a + Math.max(0, o.qty - o.delivered), 0);
}
