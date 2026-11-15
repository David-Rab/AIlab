// Registry of every engine system, action and event (V2-SPEC §2.2, §8.4 rule 2). Owner: WS1.
//
// Each system lives in its owner's module file and is listed here ONCE with its spec order. Owners implement the
// system body in their own file; they only touch this file to add NEW systems/catalogs (one line, keep order).
// scripts/v2/hygiene.ts asserts ids, owners, cadences and orders against the spec table.
import type { ActionDef, EngineSystem, EventDefV2 } from '../types';
import { clockSystem } from './clock';
import { recordSystem } from './record';
// WS1
import { productionSystem } from '../production/production';
import { continualSystem, runsSystem } from '../models/runs';
import { milestonesSystem } from '../models/capability';
import { hiringSystem } from '../departments/staffing';
import { MODEL_ACTIONS } from '../models/actions';
// WS2
import { safetyResearchSystem } from '../safety/agendas';
import { traitsDailySystem } from '../safety/traits';
import { incidentsSystem } from '../safety/incidents';
import { SAFETY_ACTIONS } from '../safety/actions';
// WS3
import { computeOnlineSystem } from '../compute/power';
import { opexSystem, payrollSystem } from '../finance/cashflow';
import { marketQSystem } from '../compute/market';
import { sitesQSystem } from '../compute/sites';
import { computeHistQSystem } from '../compute/forecast';
import { capitalQSystem } from '../finance/investors';
import { boardQSystem } from '../finance/board';
import { FINANCE_ACTIONS } from '../finance/actions';
// WS4
import { securitySystem } from '../security/security';
import { rivalsChinaSystem } from '../actors/rivals';
import { actorsDailySystem } from '../actors/relations';
import { directorSystem } from '../events/director';
import { endingsSystem } from '../endings/endings';
import { intelSystem } from '../actors/intel';
import { geoQSystem } from '../actors/china';
import { indexSystem } from '../actors/index';
import { RELATION_ACTIONS } from '../actors/actions';
import { COMPANY_EVENTS } from '../events/catalog/company';
import { MODEL_EVENTS } from '../events/catalog/model';
import { SAFETY_EVENTS } from '../events/catalog/safety';
import { GOV_EVENTS } from '../events/catalog/gov';
import { CHINA_EVENTS } from '../events/catalog/china';
import { RIVALS_EVENTS } from '../events/catalog/rivals';
import { WORLD_EVENTS } from '../events/catalog/world';
// WS5
import { revenueSystem } from '../worldfx/revenue';
import { worldDailySystem } from '../worldfx/sectors';
import { macroSystem } from '../worldfx/macro';
import { WORLD_ACTIONS } from '../worldfx/actions';

/** All systems in spec order (§2.2). */
export const SYSTEMS: readonly EngineSystem[] = [
  clockSystem, // 10 WS1 daily
  computeOnlineSystem, // 20 WS3 daily
  productionSystem, // 30 WS1 daily
  runsSystem, // 40 WS1 daily
  continualSystem, // 45 WS1+WS2 daily
  milestonesSystem, // 50 WS1 daily
  revenueSystem, // 60 WS5 daily
  safetyResearchSystem, // 70 WS2 daily
  traitsDailySystem, // 75 WS2 daily
  incidentsSystem, // 80 WS2 daily
  securitySystem, // 90 WS4 daily
  rivalsChinaSystem, // 100 WS4 daily
  worldDailySystem, // 110 WS5 daily
  actorsDailySystem, // 120 WS4 daily
  opexSystem, // 130 WS3 daily
  directorSystem, // 140 WS4 daily
  endingsSystem, // 150 WS4 daily
  recordSystem, // 160 WS1 weekly
  hiringSystem, // 200 WS1 weekly
  intelSystem, // 210 WS4 weekly
  payrollSystem, // 300 WS3 monthly
  macroSystem, // 310 WS5 monthly
  computeHistQSystem, // 399 WS3 quarterly
  marketQSystem, // 400 WS3 quarterly
  sitesQSystem, // 410 WS3 quarterly
  capitalQSystem, // 420 WS3 quarterly
  boardQSystem, // 430 WS3 quarterly
  geoQSystem, // 440 WS4 quarterly
  indexSystem, // 500 WS4 semiannual
];

/** Player-callable levers, all spheres (§2.7 trade-off lint runs over these). */
export const ACTIONS: readonly ActionDef[] = [...MODEL_ACTIONS, ...SAFETY_ACTIONS, ...FINANCE_ACTIONS, ...RELATION_ACTIONS, ...WORLD_ACTIONS];

/** Decision events (§4.2). */
export const EVENTS: readonly EventDefV2[] = [
  ...COMPANY_EVENTS, ...MODEL_EVENTS, ...SAFETY_EVENTS, ...GOV_EVENTS, ...CHINA_EVENTS, ...RIVALS_EVENTS, ...WORLD_EVENTS,
];

export const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));
export const EVENT_BY_ID = new Map(EVENTS.map((e) => [e.id, e]));

/** Throws on duplicate ids or orders, or a list not sorted by order. Called once at module load by loop.ts. */
export function validateRegistry(systems: readonly EngineSystem[] = SYSTEMS) {
  const ids = new Set<string>();
  const orders = new Set<number>();
  let last = -Infinity;
  for (const s of systems) {
    if (ids.has(s.id)) throw new Error(`registry: duplicate system id ${s.id}`);
    if (orders.has(s.order)) throw new Error(`registry: duplicate order ${s.order} (${s.id})`);
    if (s.order <= last) throw new Error(`registry: ${s.id} out of order`);
    ids.add(s.id);
    orders.add(s.order);
    last = s.order;
  }
  const dupe = (xs: readonly { id: string }[], what: string) => {
    const seen = new Set<string>();
    for (const x of xs) {
      if (seen.has(x.id)) throw new Error(`registry: duplicate ${what} id ${x.id}`);
      seen.add(x.id);
    }
  };
  dupe(ACTIONS, 'action');
  dupe(EVENTS, 'event');
}
