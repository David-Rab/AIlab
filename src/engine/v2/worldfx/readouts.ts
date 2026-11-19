// Derived world readouts (selectors for the UI, other workstreams and tests). Owner: WS5.
// Pure functions of world state; no truth fields (safe for the UI).
import { ECON, SECTORS } from '../../../data/v2/sectors';
import type { GameStateV2, RegionId } from '../types';
import { alphaUseOf, savedAt, useShareOf } from './use';
import { CONSUMER_MKT } from '../../../data/v2/serving';
import { worldMix, type WorldMix } from './mix';
import { consumerSpend, consumerUsers, regionSubscribers } from './revenue';
import { reachTarget } from './serving';

/** Share of US remote-work (pure cognitive) tasks done by AI (AI 2027 Oct 2027: 25% of remote-work jobs). */
export function remoteWorkAutomation(s: GameStateV2): number {
  let a = 0;
  let e = 0;
  for (const def of SECTORS) {
    if (!def.remote) continue;
    const st = s.world.sectors.US[def.id];
    a += st.A * st.E0;
    e += st.E0;
  }
  return e ? a / e : 0;
}

/** US firm AI adoption (Census BTOS analogue): employment-weighted 1 − exp(−k·A), A the firm-side task adoption (not
 *  the workers' use W: BTOS counts firms, ≈18–20% in 2026, vs ≈40% of workers, research/22 §1). */
export function firmAdoption(s: GameStateV2): number {
  let a = 0;
  let e = 0;
  for (const def of SECTORS) {
    const st = s.world.sectors.US[def.id];
    a += (1 - Math.exp(-ECON.firmK * st.A)) * st.E0;
    e += st.E0;
  }
  return a / e;
}

/** A2a: hours of AI use as a share of all work-hours in a region (US: the RPS "hours assisted", research/22 §1:
 *  4.1% Q3 2024, 6.3% Q2 2026), the share of workers who use AI at work (RPS 39–41% in 2026), and the hours of work an
 *  hour of use saves (0.35), all employment-weighted. Firm adoption above stays a separate (firm-weighted) quantity. */
export function workUse(s: GameStateV2, r: RegionId = 'US'): { hours: number; workers: number; savedPerHour: number; saved: number } {
  let u = 0;
  let w = 0;
  let sv = 0;
  let e = 0;
  for (const def of SECTORS) {
    const st = s.world.sectors[r][def.id];
    const U = useShareOf(st, def.id);
    u += U * st.E0;
    w += (st.W ?? st.A) * st.E0;
    sv += U * savedAt(alphaUseOf(st, def.id)) * st.E0;
    e += st.E0;
  }
  return { hours: u / e, workers: w / e, savedPerHour: u > 0 ? sv / u : 0, saved: sv / e };
}

export interface ConsumerRegionRead {
  /** Weekly reach (share of online adults using an AI chat app) and the target it moves toward. */
  reach: number; reachTarget: number;
  /** Weekly users and subscribers, all providers; paid share = subscribers ÷ users; the going (users' share-weighted)
   *  subscription price ($/month, plans at or below the willingness to pay) and consumer spend ($B/yr). */
  users: number; subs: number; paidShare: number; going: number; spend: number;
  /** The player's users (its customer stock), its paid share (stock) and that share's target; 0 without a Chat product. */
  playerUsers: number; playerPaid: number; playerPaidTarget: number;
}
/** A2b: consumer chat by region (US and ROW; CN is served at home), and the world totals. Messages per day and their
 *  non-work share are the measured averages (research/22 §2), not simulated. */
export function consumerUse(s: GameStateV2, mix: WorldMix = worldMix(s)): { regions: Record<'US' | 'ROW', ConsumerRegionRead>; users: number; subs: number; spend: number; messagesPerDay: number; nonWorkShare: number } {
  const pi = mix.providers.findIndex((p) => p.key === 'player');
  const one = (r: 'US' | 'ROW'): ConsumerRegionRead => {
    const cm = mix.consumer[r];
    const users = consumerUsers(s, r);
    const subs = regionSubscribers(s, mix, r);
    return {
      reach: s.world.fx.reach[r], reachTarget: reachTarget(r, cm.bestCover), users, subs, paidShare: users > 0 ? subs / users : 0, going: cm.going,
      spend: consumerSpend(s, mix, r),
      playerUsers: pi >= 0 ? users * cm.share[pi] : 0, playerPaid: pi >= 0 ? cm.paid[pi] : 0, playerPaidTarget: pi >= 0 ? cm.paidTarget[pi] : 0,
    };
  };
  const regions = { US: one('US'), ROW: one('ROW') };
  const users = regions.US.users + regions.ROW.users;
  return {
    regions, users, subs: regions.US.subs + regions.ROW.subs, spend: regions.US.spend + regions.ROW.spend,
    messagesPerDay: users * CONSUMER_MKT.messagesPerDay, nonWorkShare: CONSUMER_MKT.nonWorkShare,
  };
}

/** Employment of 22–25-year-olds in the most exposed jobs vs counterfactual (Canaries; 1 = no effect). */
export function youthExposedEmployment(s: GameStateV2): number {
  let a = 0;
  let e = 0;
  for (const def of SECTORS) {
    if (!def.youthExposed) continue;
    a += s.world.fx.youthRel[def.id] * def.empPct;
    e += def.empPct;
  }
  return a / e;
}

/** Economy-wide value-weighted automation Σ v_s·A_s. GATE explosive threshold 0.5 (R16 §4.3). */
export function automationShare(s: GameStateV2, r: RegionId = 'US'): number {
  let a = 0;
  let v = 0;
  for (const def of SECTORS) {
    const w = def.empPct * def.wage;
    a += w * s.world.sectors[r][def.id].A;
    v += w;
  }
  return a / v;
}

/** Weight of each defensive technology's impact ramp in the defence index [D]: a fully ramped countermeasure removes
 *  most, not all, of the civilisation-scale tail. */
export const DEFENCE_TECHS: Record<'bio' | 'cyber', [string, number][]> = {
  bio: [['W06', 0.6]], // new antibiotics and antivirals (medical countermeasures)
  cyber: [['W24', 0.6]], // autonomous cyber defense (find and patch zero-days at scale)
};

/** Defence index 0..1 against misuse catastrophes (R16 §3.1: misuse P = Exposure × (1 − Defense) × intent), from the
 *  ramps of the defensive world technologies; for one risk, or the mean over bio and cyber. Used by WS4's
 *  catastrophe check (§5.1 #4). */
export function defenceIndex(s: GameStateV2, risk?: 'bio' | 'cyber'): number {
  const of = (k: 'bio' | 'cyber') => DEFENCE_TECHS[k].reduce((a, [id, w]) => a + w * (s.world.techs[id]?.ramp ?? 0), 0);
  const d = risk ? of(risk) : (of('bio') + of('cyber')) / 2;
  return d < 0 ? 0 : d > 1 ? 1 : d;
}

/** Year-to-date change of the equity index. */
export const dowYtd = (s: GameStateV2) => (s.world.fx.dowJan ? s.world.dow / s.world.fx.dowJan - 1 : 0);

/** US unemployment change over the last 12 months (pp), from the monthly history. */
export function unemploymentChange12m(s: GameStateV2): number {
  const h = s.world.fx.uHist;
  return h.length ? s.world.unemployment.US - h[0] : 0;
}
