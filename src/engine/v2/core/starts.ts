// Start-state builders for the non-leader start types (BUILD-PLAN R9; data/v2/starts.ts). Owner: WS1 (composes WS3's
// finance and compute shapes the way their initialisers do). The frontier-leader start never comes here: buildPlayer
// keeps the owners' initialisers (initialFinance, initialSites, initialCloud, initialOrders, initialBoard) for it.
import { parentBudgetYear, type StartDef } from '../../../data/v2/starts';
import { initialBoard, SEAT_STANCE } from '../finance/board';
import { defaultFinanceWS3 } from '../finance/ext';
import { START_CREDIBILITY } from '../finance/promises';
import { partnerDef } from '../../../data/v2/deals';
import type { Board, CloudContract, Commitment$, FinanceState, Site } from '../types';
import { dayOfDate } from './time';

/** Rental price of start cloud contracts ($ per H100e-year, V2-SPEC §3.7.2) and chip book value ($ per H100e). */
const CLOUD_PER_H = 13e3;
const CHIP_BOOK_PER_H = 25e3;
/** kW per H100e at the start (compute/power.ts initialPower) and site headroom for the owned fleet [D]. */
const KW_PER_H = 0.93;
const SITE_HEADROOM = 1.2;
/** Colocation lease ≈ $1.2B per GW-year (finance/ledger.ts, R15); brownfield capex $14B/GW (the leader's S2). */
const LEASE_PER_GW_Y = 1.2;
const BROWNFIELD_PER_GW = 14;

/** Cloud provider of a start's rented compute (the challenger's strategic investor; a neocloud for a spinout). */
const PROVIDER: Partial<Record<StartDef['id'], string>> = { spinout: 'Vantage Neocloud', challenger: 'Azimuth' };

export interface StartCompute { sites: Site[]; cloud: CloudContract[]; ledger: Commitment$[] }

/** Owned compute in live sites, rented compute as one cloud contract, and their ledger payments. A division's
 *  campuses are the parent's (capex paid, no lease); a challenger's owned racks sit in a colocation lease. */
export function startCompute(def: StartDef, startDate: string): StartCompute {
  const sites: Site[] = [];
  const ledger: Commitment$[] = [];
  const base = { crash: false, communityPackage: false, spvFunded: 0, stage: 'live' as const, stageEndDay: 0 };
  if (def.owned > 0) {
    const parent = def.board === 'parent';
    const n = parent ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const h = def.owned / n;
      const mw = Math.ceil((h * KW_PER_H * SITE_HEADROOM) / 1000 / 10) * 10;
      const capex = parent ? (mw / 1000) * BROWNFIELD_PER_GW : 0;
      sites.push({
        ...base, id: `S${i + 1}`, name: parent ? ['Parent campus West', 'Parent campus East'][i] : 'Colocation North', region: 'US',
        path: parent ? 'grid' : 'rent', mw, capex, capexPaid: capex, installed: h,
        ws3: { rolled: true, delayedQ: 0, buildQ: parent ? 8 : 2, powerQ: 0, startDay: -500 },
      });
      if (!parent) ledger.push({ id: `L-lease-S${i + 1}`, payee: 'Colocation lease', kind: 'lease', perQuarter: ((mw / 1000) * LEASE_PER_GW_Y) / 4, endDay: dayOfDate(startDate, '2029-07-01'), cancellableNoticeQ: null, penalty: 0 });
    }
  }
  const cloud: CloudContract[] = [];
  if (def.rented > 0) {
    const provider = PROVIDER[def.id] ?? 'Northwind Cloud';
    const end = dayOfDate(startDate, def.id === 'spinout' ? '2027-07-01' : '2028-07-01');
    const perYear = (def.rented * CLOUD_PER_H) / 1e9;
    cloud.push({ id: 'C1', provider, h100e: def.rented, costPerYear: perYear, startDay: -365, endDay: end, cancellableNoticeQ: null });
    ledger.unshift({ id: 'L-cloud0', payee: provider, kind: 'cloud', perQuarter: perYear / 4, endDay: end, cancellableNoticeQ: null, penalty: 0 });
  }
  return { sites, cloud, ledger };
}

/** Finance at a non-leader start: cash, revenue, ownership, a credit line (none for a division: the parent's treasury
 *  borrows), the start compute's ledger. The valuation is marked from the story split once the rivals exist, and the
 *  line sized as banks size it, 3% of it, cap $15B (finance/story.ts startStory, FIN5a). */
export function startFinance(def: StartDef, c: StartCompute): FinanceState {
  const division = def.board === 'parent';
  // A division's first quarterly budget payment (Q3 2025) is in the starting cash (finance/parent.ts).
  const cash = def.cash + (division ? parentBudgetYear(0) / 4 : 0);
  const f: FinanceState = {
    cash,
    revenueRun: def.revenueRun,
    revenueHistory: [...def.revenueHistory],
    valuation: 0,
    ownership: { founder: def.ownership.founder, mission: 0, fin: def.ownership.fin, strat: { ...(def.ownership.strat ?? {}) }, public: 0 },
    credibility: START_CREDIBILITY[def.id],
    promises: [],
    rounds: [],
    tranches: [],
    debts: division ? [] : [{ id: 'D-revolver', kind: 'revolver', principal: 0, drawn: 0, spreadBp: 250, maturityDay: 365 * 5, covenant: 'liquidity' }],
    ledger: [...c.ledger],
    rating: division ? 'BBB' : def.revenueRun > 0 ? 'BB' : 'B',
    runwayQ: 8,
    state: 'healthy',
    // The challenger's strategic investor (an Amazon/Google-like stake from before the start): a holder with no running
    // terms and no board seat (hyperscaler stakes are non-voting and seatless [R21 B2]).
    deals: Object.keys(def.ownership.strat ?? {}).map((partner, i) => ({ id: `DL-start${i}`, partner, kind: partnerDef(partner)?.kind ?? 'hyperscaler', day: -400, equityNow: 0, equityLater: 0, strings: {}, until: -400, legacy: true })),
    ws3: defaultFinanceWS3(cash),
  };
  f.ws3.chipBook = (def.owned * CHIP_BOOK_PER_H) / 1e9;
  return f;
}

/** Board at a non-leader start: the founder preset (spinout: one financial seat; challenger: two; its strategic
 *  investor holds no seat, FIN4a) or the parent company (research/18 §3.2). */
export function startBoard(def: StartDef): Board {
  const b = initialBoard(def.board);
  if (def.id === 'challenger') {
    b.seats.push({ kind: 'financial', holder: 'Investor 2', stance: [...SEAT_STANCE.financial], weight: 1 });
  }
  return b;
}
