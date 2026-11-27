// B3: the World panel's sector view (design/archive/V3-BUILD.md "B3 notes"). Output-only readouts of what the sector economics
// (worldfx/sectors.ts, mix.ts, serving.ts, use.ts, revenue.ts) already compute: adoption in two quantities (firm task
// adoption A vs workers using AI W and hours of use U), feasibility F, cost gate K, friction R and the binding limit, who
// pays for the hours, providers' coverage and prices vs the wage, and the sector's work type. No mechanism, no state.
import { ECON, REGIONS, SECTORS, SECTOR_BY_ID, USE_ANCHORS, type UseAnchor } from '../../../data/v2/sectors';
import { SECTOR_WORK, TOKENS } from '../../../data/v2/serving';
import { ASSIST } from '../../../data/v2/workTypes';
import type { DomainId, GameStateV2, RegionId, SectorId, SectorState } from '../types';
import { worldMix, type WorldMix } from './mix';
import { sectorSpendParts } from './revenue';
import { SECTOR_COG, adoptedTokens, savedPerAdoptedHour, sectorTheta, seatTarget, wagePerHour } from './serving';
import { alphaUseOf, savedAt, useIntensityOf, useShareOf, workHoursOf, workerTarget, type AgentCeiling } from './use';
import { workBilling, workUse } from './readouts';

/** One provider in one sector and region. */
export interface SectorProviderRead {
  key: string;
  open: boolean;
  /** Customer stock (share of the segment's spend) and the logit target it moves toward. */
  share: number;
  target: number;
  /** Fit on the sector's work (OOM) and coverage (share the model can do alone). */
  fit: number;
  cover: number;
  /** Price per adopted task-hour ($); the buyer's cost per AI work-hour: price ÷ hours saved per adopted hour + review of
   *  the uncovered work (0.27 × wage × (1 − coverage)); its cost gate σ(ln(wage ÷ cost)/0.7). */
  price: number;
  review: number;
  buyerCost: number;
  gate: number;
  /** Agent-hours a supervising hour buys (after the buyer's gate), price per agent-hour, seat price per seat-month (0 =
   *  sells no seats). */
  agentK: number;
  agentPrice: number;
  seatPrice: number;
}

export interface SectorRead {
  sid: SectorId;
  r: RegionId;
  name: string;
  /** Wage per hour of the sector's work in the region ($). */
  wage: number;
  /** Firm task adoption A, its ceiling A* = F·K·(1 − R), and the firm-weighted readout 1 − exp(−k·A). */
  A: number;
  Astar: number;
  firms: number;
  /** Workers using AI at work W and their target W*; hours of use U (share of the sector's work-hours), the share of a
   *  user's other hours with AI (h), and hours of work an hour of use saves. */
  W: number;
  Wstar: number;
  U: number;
  h: number;
  savedPerHour: number;
  /** Limits: F (share-weighted coverage of the cognitive work, robot-bound PHYS part), K, R, binding. */
  F: number;
  Fcog: number;
  Fphys: number;
  K: number;
  R: number;
  binding: SectorState['binding'];
  /** Who pays (hours a year): adopted (per hour), seated (by the seat), unseated (free, bundled, in-house), agent-hours,
   *  supervising hours; seats sold (persons, providers that sell seats); paid-seat share σ, its target, the going seat
   *  price ($/seat-month); spend by stream ($B/yr). */
  hours: { use: number; adopted: number; seated: number; unseated: number; supervising: number; agent: number };
  seats: number;
  seat: number;
  seatTarget: number;
  seatPrice: number;
  spend: { adopted: number; agent: number; seat: number };
  /** A4: the demand ceiling on AI work (hours a year, its value $B/yr, the expansion factor 1 + η·CR), the agent-hours
   *  wanted before it, the share bought, the share of the ceiling used and what binds. */
  agentCeiling: AgentCeiling;
  /** Share-weighted price per adopted task-hour and buyer's cost per AI work-hour ($). */
  price: number;
  buyerCost: number;
  /** Work type: cognitive domain weights (renormalised without PHYS), PHYS share, task length (h), verifiability,
   *  horizon domain; median professional θ vs the best offer's fit (OOM); tokens per adopted task-hour (α mix),
   *  per assisted hour, per agent-hour. */
  work: { weights: [DomainId, number][]; physW: number; H: number; v: number; horizon: DomainId; theta: number; bestFit: number; alpha: number; tokAdopted: number; tokAssisted: number; tokAgent: number };
  providers: SectorProviderRead[];
  /** The player's customer stock and target here (0 without a product in this sector). */
  player: { share: number; target: number } | undefined;
  /** Measured US survey anchor for hours of use (US only). */
  anchor?: UseAnchor;
}

export interface RegionWorkRead {
  /** Employment-weighted: hours of use (share of work-hours), workers using AI, hours saved per hour of use. */
  hours: number;
  workers: number;
  savedPerHour: number;
  /** Paid seats sold and agent-hours a year, all sectors; A4: agent-hours wanted before the demand ceiling and the
   *  number of sectors where it binds. */
  seats: number;
  agentHours: number;
  agentWanted: number;
  ceilingBound: number;
}

const tok = (t: { input: number; output: number }) => t.input + t.output;

function readSector(s: GameStateV2, mix: WorldMix, r: RegionId, sid: SectorId): SectorRead {
  const def = SECTOR_BY_ID[sid];
  const st = s.world.sectors[r][sid];
  const m = mix.sec[r][sid];
  const wage = wagePerHour(sid, r);
  const hf = savedPerAdoptedHour(s, r, sid);
  const providers: SectorProviderRead[] = [];
  let bestFit = -Infinity;
  let aCog = 0;
  let wsum = 0;
  mix.providers.forEach((p, i) => {
    if (m.fit[i] === -Infinity) return;
    if (m.share[i] > 0) {
      aCog += m.share[i] * m.cover[i];
      wsum += m.share[i];
    }
    if (m.share[i] < 5e-4 && m.target[i] < 5e-4) return;
    if (m.fit[i] > bestFit) bestFit = m.fit[i];
    const review = ASSIST.review * wage * (1 - Math.min(1, m.cover[i]));
    const buyerCost = m.prices[i] / hf + review;
    providers.push({
      key: p.key, open: p.open, share: m.share[i], target: m.target[i], fit: m.fit[i], cover: m.cover[i], price: m.prices[i], review, buyerCost,
      gate: 1 / (1 + Math.pow(Math.max(1e-9, buyerCost) / wage, 1 / ECON.kSpread)),
      agentK: m.agentK[i], agentPrice: m.agentPrices[i], seatPrice: m.seatPrices[i],
    });
  });
  providers.sort((a, b) => b.share - a.share || b.target - a.target);
  const Fcog = wsum > 0 ? aCog / wsum : 0;
  const physW = SECTOR_COG[sid].physW;
  const wh = workHoursOf(st, sid);
  const sp = sectorSpendParts(s, r, sid, mix);
  const pl = providers.find((p) => p.key === 'player');
  const work = SECTOR_WORK[sid];
  return {
    sid, r, name: def.name, wage,
    A: st.A, Astar: st.Astar, firms: 1 - Math.exp(-ECON.firmK * st.A),
    W: st.W ?? st.A, Wstar: workerTarget(def, r, st.F, st.A), U: useShareOf(st, sid), h: useIntensityOf(sid), savedPerHour: savedAt(alphaUseOf(st, sid)),
    F: st.F, Fcog, Fphys: physW > 0 ? Math.max(0, (st.F - (1 - physW) * Fcog) / physW) : 0, K: st.K, R: st.R, binding: st.binding,
    hours: { use: wh.use, adopted: wh.adopted, seated: wh.seated, unseated: wh.unseated, supervising: wh.supervising, agent: sp.agentHours },
    seats: sp.seats, seat: st.seat ?? 0, seatTarget: seatTarget(sid, r, m.seatPrice, st.R), seatPrice: m.seatPrice,
    spend: { adopted: sp.adopted, agent: sp.agent, seat: sp.seat },
    agentCeiling: m.agentCeiling,
    price: m.price, buyerCost: m.pCost,
    work: {
      weights: SECTOR_COG[sid].w, physW, H: work.H, v: work.v, horizon: work.horizon, theta: sectorTheta(s.hidden.timeline, sid), bestFit: bestFit === -Infinity ? 0 : bestFit,
      alpha: st.alpha, tokAdopted: tok(adoptedTokens(s, sid)), tokAssisted: tok(work.tokens), tokAgent: tok(TOKENS.autonomous),
    },
    providers,
    player: pl ? { share: pl.share, target: pl.target } : undefined,
    ...(r === 'US' && USE_ANCHORS[sid] ? { anchor: USE_ANCHORS[sid] } : {}),
  };
}

/** Every sector in every region, with the region totals of hours of use and who pays (one mix for all). */
export function sectorsView(s: GameStateV2, mix: WorldMix = worldMix(s)): { regions: Record<RegionId, { work: RegionWorkRead; sectors: Record<SectorId, SectorRead> }>; providers: { key: string; open: boolean }[] } {
  const bill = workBilling(s, mix);
  const regions = {} as Record<RegionId, { work: RegionWorkRead; sectors: Record<SectorId, SectorRead> }>;
  for (const r of REGIONS) {
    const u = workUse(s, r);
    const b = bill.regions[r];
    const sectors = {} as Record<SectorId, SectorRead>;
    for (const def of SECTORS) sectors[def.id] = readSector(s, mix, r, def.id);
    regions[r] = { work: { hours: u.hours, workers: u.workers, savedPerHour: u.savedPerHour, seats: b.seats, agentHours: b.agent, agentWanted: b.agentWanted, ceilingBound: b.bound }, sectors };
  }
  return { regions, providers: mix.providers.map((p) => ({ key: p.key, open: p.open })) };
}
