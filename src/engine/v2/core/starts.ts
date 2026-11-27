// Start-state builders for the non-leader start types (BUILD-PLAN R9; data/v2/starts.ts). Owner: WS1 (composes WS3's
// finance and compute shapes the way their initialisers do). The frontier-leader start never comes here: buildPlayer
// keeps the owners' initialisers (initialFinance, initialSites, initialCloud, initialOrders, initialBoard) for it.
import { parentBudgetYear, type StartDef } from '../../../data/v2/starts';
import { initialBoard, SEAT_STANCE } from '../finance/board';
import { defaultFinanceWS3 } from '../finance/ext';
import { START_CREDIBILITY } from '../finance/promises';
import { partnerDef, RENT } from '../../../data/v2/deals';
import type { Board, CloudContract, Commitment$, FinanceState, Site } from '../types';
import { dayOfDate } from './time';

/** Rental price of start cloud contracts ($ per H100e-year, V2-SPEC §3.7.2) and chip book value ($ per H100e). */
const CLOUD_PER_H = 13e3;
const CHIP_BOOK_PER_H = 25e3;
/** kW per H100e at the start (compute/power.ts initialPower) and site headroom for the owned fleet [D]. */
const KW_PER_H = 0.93;
const SITE_HEADROOM = 1.2;
/** Grid campus capex $14.2B per GW (the leader's S2); a campus above 1 GW is split into sites of at most 1 GW. */
const GRID_CAPEX_PER_GW = 14.2;
const SITE_MAX_MW = 1000;

/** Cloud provider of a start's rented compute (the challenger's strategic investor; a neocloud for a spinout). */
const PROVIDER: Partial<Record<StartDef['id'], string>> = { spinout: 'Vantage Neocloud', challenger: 'Azimuth' };

export interface StartCompute { sites: Site[]; cloud: CloudContract[]; ledger: Commitment$[] }

/** Owned compute in live sites, rented compute as one cloud contract, and their ledger payments. A division's
 *  campuses are the parent's (capex paid, no rent); a challenger's owned racks sit in a rented hall. */
export function startCompute(def: StartDef, startDate: string): StartCompute {
  const sites: Site[] = [];
  const ledger: Commitment$[] = [];
  const base = { crash: false, communityPackage: false, spvFunded: 0, stage: 'live' as const, stageEndDay: 0 };
  if (def.owned > 0) {
    const parent = def.board === 'parent';
    const campuses = parent ? 2 : 1;
    const startDay = -500;
    for (let i = 0; i < campuses; i++) {
      const h = def.owned / campuses;
      const mw = Math.ceil((h * KW_PER_H * SITE_HEADROOM) / 1000 / 10) * 10;
      const parts = parent ? Math.ceil(mw / SITE_MAX_MW) : 1;
      for (let j = 0; j < parts; j++) {
        const partMW = Math.ceil(mw / parts / 10) * 10;
        const capex = parent ? (partMW / 1000) * GRID_CAPEX_PER_GW : 0;
        const id = `S${sites.length + 1}`;
        const campus = parent ? ['Parent campus West', 'Parent campus East'][i] : 'Rented hall North';
        sites.push({
          ...base, id, name: parts > 1 ? `${campus} ${j + 1}` : campus, region: 'US',
          path: parent ? 'grid' : 'rent', mw: partMW, capex, capexPaid: capex, installed: h / parts,
          ws3: { rolled: true, delayedQ: 0, buildQ: parent ? 8 : 0, powerQ: parent ? 0 : 1, startDay, liveDay: startDay },
        });
        if (!parent) ledger.push({ id: `L-rent-${id}`, payee: 'Data-centre rent', kind: 'lease', perQuarter: ((partMW / 1000) * RENT.perGWYear) / 4, endDay: dayOfDate(startDate, '2029-07-01'), cancellableNoticeQ: null, penalty: 0 });
      }
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
