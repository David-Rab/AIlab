// WS3 state extensions. Owner: WS3.
//
// The WS3 state blocks (FinanceWS3, MarketWS3, CapitalWS3, SiteWS3, …) live in types.ts (folded at M2,
// SCHEMA_REV 2). `ensureWs3()` fills missing blocks lazily (the finance code calls it).
import { dateOfDay } from '../core/time';
import type { CapitalWS3, Day, FinanceWS3, GameStateV2, MarketWS3, Money, YearStats } from '../types';

export type { CapitalWS3, FinanceWS3, LabOrder, MarketWS3, PendingRound, SiteWS3, YearStats } from '../types';

export function emptyYear(): YearStats {
  return {
    revenue: 0, payroll: 0, otherOpex: 0, computeCosts: 0, interest: 0,
    capexChips: 0, capexSites: 0, capexSitesFinanced: 0, supplierFunding: 0,
    equity: 0, dealEquity: 0, debtDrawn: 0, spvFinanced: 0, cloudFinanced: 0, leaseFinanced: 0,
    minRunwayQ: 99, distressDays: 0,
  };
}

export function defaultFinanceWS3(cash: Money): FinanceWS3 {
  return {
    inventory: { transit: 0, ready: 0, book: 0 }, chipBook: 0, rentals: [], reserved: [],
    recap: {}, opCashQ: 0, opCash4q: [], cashAtQStart: cash, accQ: { revenue: 0, opCosts: 0 }, capexCumAtQ: 0, capex4q: [], years: {},
  };
}

export function defaultMarketWS3(): MarketWS3 {
  return {
    q: 0, stock: 13e6, shipped: 0, ds: 1, supply8q: [], exoMult: 1, exoMultDecay: 0, twQ: 0, krQ: 0, lastConversionQ: -99,
    labOrders: [], managedLabs: [], playerFill: 1, playerWeight: 1,
  };
}

export function defaultCapitalWS3(hype: number): CapitalWS3 {
  return { hypeBase: hype, rSectorHist: [], playerPoolQ: 0, playerTakenQ: 0, playerShare: 0.3, anchors: { 'Northwind Cloud': 'player' }, lastFrontierL: 0, spreadAddBp: 0 };
}

/** Fill any missing WS3 block (saves and fixtures made before the blocks existed). Cheap; called by every system. */
export function ensureWs3(s: GameStateV2): void {
  const f = s.player.finance;
  if (!f.ws3) f.ws3 = defaultFinanceWS3(f.cash);
  if (!s.market.ws3) s.market.ws3 = defaultMarketWS3();
  if (!s.capital.ws3) s.capital.ws3 = defaultCapitalWS3(s.capital.hype);
}

/** Calendar-year tally bucket for a day (default: today). */
export function yearStats(s: GameStateV2, day: Day = s.time.day): YearStats {
  const y = String(dateOfDay(s.time.startDate, day).getUTCFullYear());
  const ys = s.player.finance.ws3.years;
  return (ys[y] ??= emptyYear());
}

/** Share of revenue owed to partners now: the revenue-share strings of deals still running (FIN4a). */
export function revenueShareRate(s: GameStateV2): number {
  return s.player.finance.deals.reduce((a, d) => a + (d.until > s.time.day ? d.strings.revenueShare ?? 0 : 0), 0);
}
