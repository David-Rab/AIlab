// Start-state builders for the non-leader start types (BUILD-PLAN R9; data/v2/starts.ts). Owner: WS1 (composes WS3's
// finance and compute shapes the way their initialisers do). The frontier-leader start never comes here: buildPlayer
// keeps the owners' initialisers (initialFinance, initialSites, initialCloud, initialOrders) for it.
import { parentBudgetYear, type LabKindDef, type PositionDef } from '../../../data/v2/starts';
import { ownerFunded, startControl } from '../finance/control';
import { defaultFinanceWS3 } from '../finance/ext';
import { legacyDealsOf } from '../finance/ledger';
import { RENT } from '../../../data/v2/deals';
import type { CloudContract, Commitment$, FinanceState, Site } from '../types';
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

export interface StartCompute { sites: Site[]; cloud: CloudContract[]; ledger: Commitment$[] }

/** Owned compute in live sites, rented compute as one cloud contract, and their ledger payments. A position with
 *  built campuses (capital-heavy: a division's, or a founder's like Colossus) has them paid, no rent; the others' owned
 *  racks sit in a rented hall. */
export function startCompute(def: PositionDef, kind: LabKindDef, startDate: string): StartCompute {
  const sites: Site[] = [];
  const ledger: Commitment$[] = [];
  const base = { crash: false, communityPackage: false, spvFunded: 0, stage: 'live' as const, stageEndDay: 0 };
  if (def.owned > 0) {
    // Built and paid campuses (whoever owns the company) or racks in a rented hall; the campus's name says whose it is.
    const built = def.ownedCampusesPaid === true;
    const owner = ownerFunded(startControl(kind));
    const campuses = built ? 2 : 1;
    const startDay = -500;
    for (let i = 0; i < campuses; i++) {
      const h = def.owned / campuses;
      const mw = Math.ceil((h * KW_PER_H * SITE_HEADROOM) / 1000 / 10) * 10;
      const parts = built ? Math.ceil(mw / SITE_MAX_MW) : 1;
      for (let j = 0; j < parts; j++) {
        const partMW = Math.ceil(mw / parts / 10) * 10;
        const capex = built ? (partMW / 1000) * GRID_CAPEX_PER_GW : 0;
        const id = `S${sites.length + 1}`;
        const campus = built ? [`${owner ? 'Parent campus' : 'Campus'} West`, `${owner ? 'Parent campus' : 'Campus'} East`][i] : 'Rented hall North';
        sites.push({
          ...base, id, name: parts > 1 ? `${campus} ${j + 1}` : campus, region: 'US',
          path: built ? 'grid' : 'rent', mw: partMW, capex, capexPaid: capex, installed: h / parts,
          ws3: { rolled: true, delayedQ: 0, buildQ: built ? 8 : 0, powerQ: built ? 0 : 1, startDay, liveDay: startDay },
        });
        if (!built) ledger.push({ id: `L-rent-${id}`, payee: 'Data-centre rent', kind: 'lease', perQuarter: ((partMW / 1000) * RENT.perGWYear) / 4, endDay: dayOfDate(startDate, '2029-07-01'), cancellableNoticeQ: null, penalty: 0 });
      }
    }
  }
  const cloud: CloudContract[] = [];
  if (def.rented > 0) {
    const provider = def.provider;
    const end = dayOfDate(startDate, def.cloudEnd);
    const perYear = (def.rented * CLOUD_PER_H) / 1e9;
    cloud.push({ id: 'C1', provider, h100e: def.rented, costPerYear: perYear, startDay: -365, endDay: end, cancellableNoticeQ: null });
    ledger.unshift({ id: 'L-cloud0', payee: provider, kind: 'cloud', perQuarter: perYear / 4, endDay: end, cancellableNoticeQ: null, penalty: 0 });
  }
  return { sites, cloud, ledger };
}

/** Finance at a non-leader start: cash, revenue, ownership, a credit line (none for a division: the parent's treasury
 *  borrows), the start compute's ledger. The valuation is marked from the story split once the rivals exist, and the
 *  line sized as banks size it, 3% of it, cap $15B (finance/story.ts startStory, FIN5a). */
export function startFinance(def: PositionDef, kind: LabKindDef, c: StartCompute, startDate: string): FinanceState {
  const division = ownerFunded(startControl(kind));
  // A division's first quarterly budget payment (Q3 2025) is in the starting cash (finance/parent.ts).
  const cash = def.cash + (division ? parentBudgetYear(0) / 4 : 0);
  const f: FinanceState = {
    cash,
    revenueRun: def.revenueRun,
    revenueHistory: [...def.revenueHistory],
    valuation: 0,
    ownership: { founder: kind.ownership.founder, mission: kind.ownership.mission ?? 0, fin: kind.ownership.fin, strat: { ...(kind.ownership.strat ?? {}) }, public: 0 },
    ...(kind.ownership.stratVoting ? { stratVoting: { ...kind.ownership.stratVoting } } : {}),
    credibility: def.credibility,
    promises: [],
    rounds: [],
    tranches: [],
    debts: division ? [] : [{ id: 'D-revolver', kind: 'revolver', principal: 0, drawn: 0, spreadBp: 250, maturityDay: 365 * 5, covenant: 'liquidity' }],
    ledger: [...c.ledger],
    rating: division ? 'BBB' : def.revenueRun > 0 ? 'BB' : 'B',
    runwayQ: 8,
    state: 'healthy',
    // The kind's legacy partner stakes (a hyperscaler's, from before the start): holders with no running terms and no board
    // seat. A division's voting owner is no deal.
    deals: legacyDealsOf(kind, startDate),
    ws3: defaultFinanceWS3(cash),
  };
  f.ws3.chipBook = (def.owned * CHIP_BOOK_PER_H) / 1e9;
  return f;
}
