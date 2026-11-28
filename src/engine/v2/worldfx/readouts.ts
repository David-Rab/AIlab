// Derived world readouts (selectors for the UI, other workstreams and tests). Owner: WS5.
// Pure functions of world state; no truth fields (safe for the UI).
import { ECON, REGIONS, SECTORS } from '../../../data/v2/sectors';
import type { GameStateV2, Money, RegionId } from '../types';
import { alphaUseOf, savedAt, useShareOf, workHoursOf } from './use';
import { CONSUMER_MKT, SECTOR_WORK, TOKENS } from '../../../data/v2/serving';
import { worldMix, type WorldMix } from './mix';
import { consumerSpend, consumerUsers, regionSubscribers, sectorSpendParts } from './revenue';
import { adoptedTokens, lineupVersions, reachTarget, tokEff } from './serving';
import { versionById } from '../models/labs';

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

export interface BillingRead {
  /** Hours of use a year by who pays (A2c): adopted task-hours (billed per hour), seated hours (billed by the seat),
   *  unseated hours (free, bundled, in-house: unbilled); agent-hours a year (billed per hour); supervising hours. */
  adopted: number; seated: number; unseated: number; agent: number; supervising: number;
  /** A4: agent-hours a year the buyers want before the demand ceiling (`agent` is what is bought), the ceiling on AI work
   *  (hours a year: Σ E0·2000·(1 + η·CR)) and the number of sector-region cells where it binds. */
  agentWanted: number; ceiling: number; bound: number;
  /** Paid seats sold (persons; open weights sell none) and the workers who use AI (W·E). */
  seats: number; workers: number;
  /** Spend ($B/yr) by stream, all providers. */
  spendAdopted: Money; spendAgent: Money; spendSeat: Money;
  /** FLOP-bearing tokens a day by stream (adopted, seated, agent). Unseated hours run on consumer apps (counted there). */
  tokAdopted: number; tokSeated: number; tokAgent: number;
}
/** A2c: who pays for work use, by region, with the player's seats and the world totals; consumer tokens a day (paying
 *  and free users, A2b budgets). Reported for the World panel (B3) and the serving tests. */
export function workBilling(s: GameStateV2, mix: WorldMix = worldMix(s)): { regions: Record<RegionId, BillingRead>; world: BillingRead; playerSeats: number; consumerTokens: number } {
  const pi = mix.providers.findIndex((p) => p.key === 'player');
  const z = (): BillingRead => ({ adopted: 0, seated: 0, unseated: 0, agent: 0, supervising: 0, agentWanted: 0, ceiling: 0, bound: 0, seats: 0, workers: 0, spendAdopted: 0, spendAgent: 0, spendSeat: 0, tokAdopted: 0, tokSeated: 0, tokAgent: 0 });
  const regions = { US: z(), CN: z(), ROW: z() } as Record<RegionId, BillingRead>;
  const world = z();
  let playerSeats = 0;
  // MKT (D10's open readout item): the tokens a day count the reasoning tokens of the models bought, τ on the output
  // tokens (tokEff, as the offers' serving cost does), not the 2025 profiles: per provider its model's τ (the player: the
  // product that serves the sector, blended over its lineup by the hours its buyers take on it; students reason like their
  // teacher), share-weighted per cell (agent tokens by each provider's agent-hours).
  const tauRival = mix.providers.map((p) => tokEff(p.model));
  const depTau = (id: string | undefined, w?: readonly number[]) => {
    const d = id ? s.player.deployments.find((x) => x.id === id) : undefined;
    const t = tokEff(d ? versionById(s, d.versionId) : undefined);
    if (!d || !w || w.length < 2) return t;
    // RD-P01a: blended over the product's lineup (main model, then its real entries) by its buyers' hours on each.
    const vs = lineupVersions(s, d);
    let tau = (w[0] ?? 0) * t;
    for (let k = 1; k < w.length; k++) tau += (w[k] ?? 0) * tokEff(vs[k - 1]);
    return tau;
  };
  const outW = (tk: { input: number; output: number }, tau: number) => tk.input + tk.output * tau;
  for (const r of REGIONS) {
    const x = regions[r];
    for (const def of SECTORS) {
      const st = s.world.sectors[r][def.id];
      const wh = workHoursOf(st, def.id);
      const p = sectorSpendParts(s, r, def.id, mix);
      const m = mix.sec[r][def.id];
      let tS = 0;
      let wS = 0;
      let tA = 0;
      let wA = 0;
      for (let i = 0; i < m.share.length; i++) {
        const sh = m.share[i];
        if (!sh) continue;
        const tau = i === pi ? depTau(m.playerDep, m.playerDep ? m.playerTierW[m.playerDep] : undefined) : tauRival[i];
        tS += sh * tau;
        wS += sh;
        tA += sh * m.agentK[i] * tau;
        wA += sh * m.agentK[i];
      }
      const tauUse = wS > 0 ? tS / wS : 1;
      const tauAg = wA > 0 ? tA / wA : tauUse;
      const ta0 = adoptedTokens(s, def.id);
      const ta = { input: ta0.input, output: ta0.output * tauUse };
      const tas = { input: SECTOR_WORK[def.id].tokens.input, output: SECTOR_WORK[def.id].tokens.output * tauUse };
      const tAg = outW(TOKENS.autonomous, tauAg);
      x.adopted += wh.adopted;
      x.seated += wh.seated;
      x.unseated += wh.unseated;
      x.supervising += wh.supervising;
      x.agent += p.agentHours;
      const ac = mix.sec[r][def.id].agentCeiling;
      x.agentWanted += ac.wanted;
      x.ceiling += ac.hours;
      if (ac.bound !== 'none') x.bound++;
      x.seats += p.seats;
      x.workers += (st.W ?? st.A) * st.E;
      x.spendAdopted += p.adopted;
      x.spendAgent += p.agent;
      x.spendSeat += p.seat;
      x.tokAdopted += (wh.adopted * (ta.input + ta.output)) / 365;
      x.tokSeated += (wh.seated * (tas.input + tas.output)) / 365;
      x.tokAgent += (p.agentHours * tAg) / 365;
      if (pi >= 0) playerSeats += wh.seats * mix.sec[r][def.id].share[pi];
    }
    for (const k of Object.keys(world) as (keyof BillingRead)[]) world[k] += x[k];
  }
  let consumerTokens = 0;
  const P = CONSUMER_MKT.perDay;
  for (const r of REGIONS) {
    const cm = mix.consumer[r];
    const u = consumerUsers(s, r);
    for (let i = 0; i < cm.share.length; i++) {
      const tau = i === pi ? depTau(cm.playerDep) : tauRival[i];
      consumerTokens += cm.share[i] * u * (cm.paid[i] * outW(P.paid, tau) + (1 - cm.paid[i]) * outW(P.free, tau));
    }
  }
  return { regions, world, playerSeats, consumerTokens };
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

/** US unemployment change over the last 12 months (pp), from the monthly history. */
export function unemploymentChange12m(s: GameStateV2): number {
  const h = s.world.fx.uHist;
  return h.length ? s.world.unemployment.US - h[0] : 0;
}
