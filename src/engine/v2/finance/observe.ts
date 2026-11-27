// What finance can see of a lab (FINANCE-V3 §1; FINANCE-BUILD rule 4). The V3 seam: finance reads model-v3-owned
// quantities (models, products, revenue) only through these four selectors. Until MODEL-V3 lands they bridge to today's
// engine; the bodies change, the signatures stay. Owner: WS3.
import { tcoPerYear, cloudPricePerYear } from '../compute/market';
import { ownedOnline, rentedOnline } from '../compute/power';
import { PLAYER_ID } from '../models/labs';
import { leadDays } from '../actors/intel';
import { revenueOf, servingPool } from '../worldfx/revenue';
import { redFlags } from '../safety/common';
import { TRAIT_BY_ID } from '../../../data/v2/traits';
import type { GameStateV2, H100e, LabId, ModelVersion, Money } from '../types';
import { unlicensedPublicT } from '../production/data';

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

/** Compute online (H100e: owned racks running plus rented capacity). */
export function computeOnline(s: GameStateV2, lab: LabId = PLAYER_ID): H100e {
  return lab === PLAYER_ID ? s.player.computeOnline : rival(s, lab)?.core.computeOnline ?? 0;
}

/** GW of compute online in the player's own sites (installed, MW-limited) at today's kW per H100e: what the 'gw:'
 *  tranche conditions count (FIN4r, M1: not rented cloud or spot capacity). */
export const gwOwned = (s: GameStateV2) => (ownedOnline(s) * s.power.kWPerH100e) / 1e6;

/** The player's compute online that it owns or holds on firm contracts (owned racks plus live firm cloud; no spot
 *  rentals, no cancellable cloud): the Scale milestone (FINANCE-V3 §2.2; FIN4r L6: a rental timed for the deadline
 *  quarter no longer meets a promise). */
export function computeFirm(s: GameStateV2): H100e {
  let h = ownedOnline(s);
  for (const c of s.player.cloud) if (c.cancellableNoticeQ === null && c.startDay <= s.time.day && c.endDay > s.time.day) h += c.h100e;
  return h;
}

/** Red flags the player's own safety evals show on a version: scheming, alignment faking or sandbagging believed above
 *  `minEst` with clarity above 0.4 (the red-flag traits; beliefs, never truth). The safety committee's release block reads it
 *  (FINANCE-V3 §7.2, FIN3b). */
export function safetyRedFlags(v: ModelVersion, minEst?: number): { trait: string; name: string; est: number }[] {
  return redFlags(v, minEst).map((x) => ({ trait: x.trait, name: TRAIT_BY_ID[x.trait]?.name ?? x.trait, est: x.est }));
}

/** Dangerous-capability thresholds a version's measured evals have crossed (bio uplift, cyber offense, autonomous
 *  replication: the dangerous benchmarks above 60, §3.3.4; persuasion is not a threshold). A "capability-threshold
 *  model" in the PBC + trust charter (FINANCE-V3 §7.2) is one with any of them. */
export const THRESHOLD_FLAGS = { bioUplift: 'bio uplift', cyberOffense: 'cyber offense', replication: 'autonomous replication' } as const;
export function capabilityThresholds(v: ModelVersion): string[] {
  return (Object.keys(THRESHOLD_FLAGS) as (keyof typeof THRESHOLD_FLAGS)[]).filter((k) => v.flags[k]).map((k) => THRESHOLD_FLAGS[k]);
}

/** Copyright litigation exposure from unlicensed training data (§3.9.1; R17 D3): a suit settles automatically at $1.5B
 *  per 270T unlicensed tokens (Bartz v. Anthropic scale, ×0.2–3), odds 0.02 × T/100 a quarter (≤ 50%), at most once a
 *  year. Licensing the crawl (data.license, domain 'web') clears it. The actors' quarterly system rolls it; "What we
 *  owe" shows it (FIN2). FINM: the tokens are model v3 D1's public crawl without a licence (unlicensedPublicT). */
export function copyrightExposure(s: GameStateV2): { tokensT: number; settlement: Money; pQ: number } {
  const T = unlicensedPublicT(s.player.dataPortfolio);
  return { tokensT: T, settlement: T > 0 ? 1.5 * Math.max(0.2, Math.min(3, T / 270)) : 0, pQ: Math.min(0.5, (0.02 * T) / 100) };
}

/** The model a partner's IP licence reaches (FIN4b, spec §6.1 IP access): the player's best live version, leaving out
 *  capability-threshold versions when `noThreshold` (a PBC + trust licence the trust did not approve, §7.2). */
export function licensedModel(s: GameStateV2, noThreshold = false): ModelVersion | undefined {
  let best: ModelVersion | undefined;
  for (const v of s.player.models.versions) {
    if (v.status === 'retired' || (noThreshold && capabilityThresholds(v).length)) continue;
    if (!best || v.G > best.G) best = v;
  }
  return best;
}

/** Capability gap (G in OOM, model vs model; FINM: was pm) between the model a licence reaches and a lab's best model;
 *  0 when the lab is level or ahead. Engine truth (the IP-access flow); the UI shows `leadEstimate`. */
export function licensedGap(s: GameStateV2, lab: LabId, noThreshold = false): number {
  const v = licensedModel(s, noThreshold);
  const r = rival(s, lab);
  if (!v || !r || r.core.status !== 'active') return 0;
  return Math.max(0, v.G - Math.max(r.internal.G, r.publicModel?.G ?? -Infinity));
}

/** The player's estimate of its lead over a rival lab (days; > 0 = ahead), from intel: what the UI may show. */
export const leadEstimate = (s: GameStateV2, lab: LabId): number => leadDays(s, lab).est;
