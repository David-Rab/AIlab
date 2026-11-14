// WS3 state extensions. Owner: WS3.
//
// ─── CONTRACT REQUEST (WS1) ───────────────────────────────────────────────────────────────────────────────────────
// types.ts is WS1-only, so the extra WS3 state lives here as a clearly marked, minimal, ADDITIVE TypeScript module
// augmentation: one `ws3` block on each of FinanceState, ChipMarket, PowerGrid, CapitalMarkets and Site. Nothing
// existing is changed. WS1 may fold these blocks into types.ts verbatim (and bump SCHEMA_REV); `ensureWs3()` fills
// them on saves/fixtures made before they existed, so no migration is needed.
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────
import { dateOfDay } from '../core/time';
import type { Day, GameStateV2, H100e, LabId, Money, Site, StrategicDeal } from '../types';

/** Per-calendar-year tallies (tests F7/F8, finance panel "where the money went"). $B unless noted. */
export interface YearStats {
  revenue: Money; payroll: Money; otherOpex: Money; computeCosts: Money; interest: Money;
  capexChips: Money; capexSites: Money; capexSitesFinanced: Money; supplierFunding: Money;
  equity: Money; dealEquity: Money; debtDrawn: Money; spvFinanced: Money; cloudFinanced: Money; leaseFinanced: Money; vendorNotes: Money;
  minRunwayQ: number; distressDays: number;
}

/** A strategic-deal offer waiting for accept/decline (Seek partner action, events E03/E04). */
export interface DealOffer {
  id: string;
  template: StrategicDeal['template'];
  partner: string;
  day: Day;
  expiresDay: Day;
  /** Up-front equity or cash in ($B) and conditional tranches. */
  equityNow: Money;
  equityLater: Money;
  /** Take-or-pay commitment ($B per quarter) and its length (quarters). */
  commitPerQ: Money;
  commitQ: number;
  /** Compute delivered by the deal (cloud capacity or chips per quarter). */
  h100e: H100e;
  /** Price paid per H100e ($K) for chip deals, or $K per H100e-year for cloud capacity. */
  unitPrice: number;
  /** Share of new-site capex funded by the partner (SPV / mega-JV). */
  siteShare: number;
  strings: StrategicDeal['strings'];
  rescue: boolean;
}

export interface PendingRound {
  day: Day;
  ask: Money;
  max: Money;
  preMoney: Money;
  anchor?: string;
  ipo: boolean;
}

export interface FinanceWS3 {
  pendingRound?: PendingRound;
  offers: DealOffer[];
  /** Delivered chips not yet installed: in transit (this quarter) and ready (installable), plus their book value. */
  inventory: { transit: H100e; ready: H100e; book: Money };
  /** Gross purchase cost of owned installed chips ($B) — O&M base and GPU-loan collateral. */
  chipBook: Money;
  /** Short-term spot rentals (inference cloud usage). */
  rentals: { h100e: H100e; endDay: Day; perYear: Money }[];
  /** Reserved supplier capacity (H100e/q) from funded expansions, and when it starts. */
  reserved: { perQ: H100e; fromQ: number; toQ: number }[];
  /** Action id → day until which the board has blocked it (§3.7.5: rejection blocks for 90 days). */
  blockedUntil: Record<string, Day>;
  /** Revenue plan for the quarter (board confidence +5 met / −10 missed). */
  revenuePlan: Money;
  /** Legacy-nonprofit recapitalisation (E02): start / completion days, or refused. */
  recap: { startDay?: Day; doneDay?: Day; refused?: boolean };
  /** Day cash first went negative after all options (insolvency grace). */
  negativeSinceDay?: Day;
  distressSinceDay?: Day;
  lastRenegotiationDay?: Day;
  /** Partner-funded share of capex for sites started before `untilDay` (mega-JV). */
  jv?: { partner: string; share: number; untilDay: Day };
  /** Day until which a custom-ASIC migration slows research (WS1 reads this, §3.7.4 −15% research efficiency). */
  asicMigrationUntil?: Day;
  /** Last quarter's net operating cash flow (rating input) and the cash at its start. */
  opCashQ: Money;
  cashAtQStart: Money;
  /** Accumulators reset each quarter: revenue and operating costs ($B). */
  accQ: { revenue: Money; opCosts: Money };
  /** Cumulative capex at the last quarter boundary and capex in each of the last 4 quarters (bubble X_t). */
  capexCumAtQ: Money;
  capex4q: Money[];
  years: Record<string, YearStats>;
}

/** Non-player lab order (rivals, China): kept on the market so WS4 can place them via `placeLabOrder`. */
export interface LabOrder { id: string; lab: LabId; qty: H100e; dueQ: number; weight: number; delivered: H100e }

export interface MarketWS3 {
  /** Quarter index the market last cleared (Q3 2025 = 0). */
  q: number;
  /** Global installed stock (H100e), cumulative deliveries (test F3). */
  stock: H100e;
  /** Production (deliveries) this quarter and last quarter's D/S. */
  shipped: H100e;
  ds: number;
  /** Supply by quarter for the last 8 quarters (β_eff denominator). */
  supply8q: number[];
  /** Exogenous-demand multiplier from shocks (test F4/F5 and events) and its decay per quarter toward 1. */
  exoMult: number;
  exoMultDecay: number;
  /** Taiwan / Korea disruption quarters remaining; quarter the last wafer node conversion happened. */
  twQ: number; krQ: number;
  lastConversionQ: number;
  labOrders: LabOrder[];
  /** Labs whose orders WS4 places itself (their default demand is then off). */
  managedLabs: LabId[];
  /** Player's fill share of last quarter's orders and the reason weights (UI "your allocation"). */
  playerFill: number;
  playerWeight: number;
  /** Lease (colocation) capacity available to labs this quarter, GW of facility power. */
  leasePoolGW: number;
}

export interface PowerWS3 {
  /** Grid pool still available to labs this quarter (GW). */
  poolLeftGW: number;
  /** Pre-ordered transformer capacity not yet assigned to a site (GW). */
  transformersGW: number;
}

export interface CapitalWS3 {
  /** Hype net of the decaying shock terms (H = base − Σ shocks). */
  hypeBase: number;
  /** Sector run-rate R_sector over the last 5 quarters (oldest first). */
  rSectorHist: Money[];
  /** This quarter's pool for the player (share × (A/4 + carry)) and how much of it has been raised. */
  playerPoolQ: Money;
  playerTakenQ: Money;
  playerShare: number;
  /** Lab partner anchors (each partner anchors at most one lab at a time, §3.7.4). */
  anchors: Record<string, LabId>;
  /** Public-frontier level a quarter ago (hype surprise term). */
  lastFrontierL: number;
  ipoOpenedDay?: Day;
  spreadAddBp: number;
}

export interface SiteWS3 {
  /** Opposition roll done (once, at the end of permitting). */
  rolled: boolean;
  delayedQ: number;
  /** Day the grid interconnection request was filed (queue credit). */
  queuedDay?: Day;
  /** Planned building quarters (8 default, 4 crash; lease 1–3). */
  buildQ: number;
  /** Partner funding this site (SPV / JV) and the residual-value-guarantee penalty. */
  financedBy?: string;
  startDay: Day;
  /** Day construction started and the day it went live (UI timeline, test F10). */
  buildStartDay?: Day;
  liveDay?: Day;
}

declare module '../types' {
  interface FinanceState { ws3: FinanceWS3 }
  interface ChipMarket { ws3: MarketWS3 }
  interface PowerGrid { ws3: PowerWS3 }
  interface CapitalMarkets { ws3: CapitalWS3 }
  interface Site { ws3: SiteWS3 }
}

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
