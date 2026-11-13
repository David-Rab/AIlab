// Chip market: supply pipelines, clearing, prices (V2-SPEC §3.8; research/15 §1.2). Owner: WS3.
import type { BaselineId, ChipMarket, EngineSystem } from '../types';

/** Market at Q3 2025 (§3.8 start table, back-cast from R15 Q4-2026 at ≈2.2×/yr). */
export function initialMarket(baseline: BaselineId): ChipMarket {
  const K = { pkg: 3.0e6, hbm: 3.2e6, wafer: 8.6e6 };
  const cost = 6.0;
  const markup = 3.8;
  const listPrice = 23;
  return {
    Kpkg: K.pkg, Khbm: K.hbm, Kwafer: K.wafer,
    pipe: { pkg: Array(8).fill(0), hbm: Array(8).fill(0), wafer: Array(8).fill(0) },
    supplyQ: Math.min(K.pkg, K.hbm, K.wafer),
    binding: 'packaging',
    cost, markup,
    premium: listPrice / (cost * markup) - 1,
    listPrice,
    rental: 2.0,
    backlog: 0,
    cumOrders8q: Array(8).fill(0),
    geoTW: 0.93, disruptTW: 0, disruptKR: 0,
    exportPolicy: baseline === 'classic' ? 'strict' : 'caseByCase',
    demandQ: 3.0e6,
    exoDemandQ: 2.2e6,
  };
}

/** marketQ (400, quarterly): supply pipelines, orders, clearing, price, deliveries → inventory → install. TODO(WS3). */
export const marketQSystem: EngineSystem = {
  id: 'marketQ', owner: 'WS3', cadence: 'quarterly', order: 400,
  run() {},
};
