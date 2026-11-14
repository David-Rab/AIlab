// WS3 state extensions. Owner: WS3.
//
// The WS3 state blocks (FinanceWS3, MarketWS3, PowerWS3, CapitalWS3, SiteWS3, …) live in types.ts (folded at M2,
// SCHEMA_REV 2). `ensureWs3()` fills missing blocks on saves made before them (save migration 1 → 2).
import { dateOfDay } from '../core/time';
import type { CapitalWS3, Day, FinanceWS3, GameStateV2, MarketWS3, Money, PowerWS3, Site, SiteWS3, YearStats } from '../types';

export type { CapitalWS3, DealOffer, FinanceWS3, LabOrder, MarketWS3, PendingRound, PowerWS3, SiteWS3, YearStats } from '../types';

export function emptyYear(): YearStats {
  return {
    revenue: 0, payroll: 0, otherOpex: 0, computeCosts: 0, interest: 0,
    capexChips: 0, capexSites: 0, capexSitesFinanced: 0, supplierFunding: 0,
    equity: 0, dealEquity: 0, debtDrawn: 0, spvFinanced: 0, cloudFinanced: 0, leaseFinanced: 0, vendorNotes: 0,
    minRunwayQ: 99, distressDays: 0,
  };
}

export function defaultFinanceWS3(cash: Money): FinanceWS3 {
  return {
    offers: [], inventory: { transit: 0, ready: 0, book: 0 }, chipBook: 0, rentals: [], reserved: [],
    blockedUntil: {}, revenuePlan: 0, recap: {}, opCashQ: 0, cashAtQStart: cash, accQ: { revenue: 0, opCosts: 0 }, capexCumAtQ: 0, capex4q: [], years: {},
  };
}

export function defaultMarketWS3(): MarketWS3 {
  return {
    q: 0, stock: 13e6, shipped: 0, ds: 1, supply8q: [], exoMult: 1, exoMultDecay: 0, twQ: 0, krQ: 0, lastConversionQ: -99,
    labOrders: [], managedLabs: [], playerFill: 1, playerWeight: 1, leasePoolGW: 0.6,
  };
}

export const defaultPowerWS3 = (): PowerWS3 => ({ poolLeftGW: 0, transformersGW: 3 });

export function defaultCapitalWS3(hype: number): CapitalWS3 {
  return { hypeBase: hype, rSectorHist: [], playerPoolQ: 0, playerTakenQ: 0, playerShare: 0.3, anchors: { 'Northwind Cloud': 'player' }, lastFrontierL: 0, spreadAddBp: 0 };
}

export const defaultSiteWS3 = (s: Pick<Site, 'stage'>): SiteWS3 => ({ rolled: s.stage !== 'permitting', delayedQ: 0, buildQ: 8, startDay: 0 });

/** Fill any missing WS3 block (saves and fixtures made before the blocks existed). Cheap; called by every system. */
export function ensureWs3(s: GameStateV2): void {
  const f = s.player.finance;
  if (!f.ws3) f.ws3 = defaultFinanceWS3(f.cash);
  if (!s.market.ws3) s.market.ws3 = defaultMarketWS3();
  if (!s.power.ws3) s.power.ws3 = defaultPowerWS3();
  if (!s.capital.ws3) s.capital.ws3 = defaultCapitalWS3(s.capital.hype);
  for (const site of s.player.sites) if (!site.ws3) site.ws3 = defaultSiteWS3(site);
}

/** Calendar-year tally bucket for a day (default: today). */
export function yearStats(s: GameStateV2, day: Day = s.time.day): YearStats {
  const y = String(dateOfDay(s.time.startDate, day).getUTCFullYear());
  const ys = s.player.finance.ws3.years;
  return (ys[y] ??= emptyYear());
}
