// Relations: currencies per counterparty, access rungs, favors, scrutiny (V2-SPEC §3.9.1; research/17 §1.2). Owner: WS4.
import { BLOCS } from '../../../data/v2/blocs';
import type { CounterpartyId, EngineSystem, LabId, RelationStock, RelationsState } from '../types';

const stock = (trust: number, access: RelationStock['access'] = 0): RelationStock => ({ trust, access, favors: [], depOnYou: 0, yourDep: 0, belowRungDays: 0 });

/** Trust gain/loss asymmetry (§3.9.1): gain base·(1 − T/100); loss base·3·(1 + T/100). */
export function trustDelta(T: number, base: number): number {
  return base >= 0 ? base * (1 - T / 100) : base * 3 * (1 + T / 100);
}

export function initialRelations(rivalIds: LabId[]): RelationsState {
  const stocks = {
    exec: stock(55, 1), congress: stock(45), states: stock(40), evalGov: stock(50, 1), evalIndep: stock(45), academia: stock(50), china: stock(30),
  } as Record<CounterpartyId, RelationStock>;
  for (const id of rivalIds) stocks[`rival:${id}`] = stock(40);
  for (const b of BLOCS) stocks[`bloc:${b.id}`] = stock(Math.round(50 + b.approval / 2));
  return { stocks, credibility: 50, talentPull: 10, scrutiny: 20, dataLicences: [] };
}

/** actorsDaily (120, daily): public meters, bloc mobilization decay, gov ladder hold-days, favor expiry, scrutiny
 *  decay. TODO(WS4, M1). */
export const actorsDailySystem: EngineSystem = {
  id: 'actorsDaily', owner: 'WS4', cadence: 'daily', order: 120,
  run() {},
};
