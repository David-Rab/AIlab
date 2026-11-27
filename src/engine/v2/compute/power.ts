// Power grid, online compute and compute pools (V2-SPEC §3.8, §2.2 order 20). Owner: WS3.
import { OM_RATE, POWER_PRICE, SOURCES } from '../../../data/v2/deals';
import { memo } from '../core/memo';
import type { ComputeSplit, EngineSystem, GameStateV2, LabId, PowerGrid, SystemCtx } from '../types';
import { ensureWs3 } from '../finance/ext';
import { labCore } from '../models/labs';
import { hiddenComputeH } from '../safety/footholds';
import { allocOf, emptySplit, SPLIT_KEYS } from '../departments/split';

/** kW/H100e 0.93 → 0.70 (Q4 2026) [R15]; the waits' history starts empty (sitesQ appends one value a quarter). */
export function initialPower(): PowerGrid {
  return { kWPerH100e: 0.93, waitHist: { grid: [], gas: [], rent: [] } };
}

/** Facility H100e capacity of a site at today's kW/H100e (fleet refresh keeps sites full of current chips) [D]. */
export const siteCapacityH = (s: GameStateV2, mw: number) => (mw * 1000) / s.power.kWPerH100e;

/** Player-owned online H100e (installed in live sites, MW-limited). */
export function ownedOnline(s: GameStateV2): number {
  let h = 0;
  for (const site of s.player.sites) if (site.stage === 'live') h += Math.min(site.installed, siteCapacityH(s, site.mw));
  return h;
}

/** Live cloud contracts + spot rentals (H100e). */
export function rentedOnline(s: GameStateV2): number {
  let h = 0;
  for (const c of s.player.cloud) if (c.startDay <= s.time.day && c.endDay > s.time.day) h += c.h100e;
  for (const r of s.player.finance.ws3?.rentals ?? []) if (r.endDay > s.time.day) h += r.h100e;
  return h;
}

/** Player online H100e = installed in live sites (MW-limited) + live cloud contracts + spot rentals. */
export function computeOnlineOf(s: GameStateV2): number {
  return ownedOnline(s) + rentedOnline(s);
}

/** Compute per use (H100e) of a lab: online × its flat allocation (§3.4.2; RD-A05a: departments/split.ts allocOf, the
 *  one allocation every reader uses). */
export function poolsOf(s: GameStateV2, lab: LabId = 'player'): ComputeSplit {
  const c = labCore(s, lab);
  const out = emptySplit();
  if (!c) return out;
  const a = lab === 'player' ? allocOf(s) : c.split;
  for (const k of SPLIT_KEYS) out[k] = c.computeOnline * (a[k] ?? 0);
  return out;
}

/** Memoised pools for this tick ('WS3:pools:<lab>'). */
export const poolsMemo = (s: GameStateV2, ctx: SystemCtx, lab: LabId = 'player') => memo(ctx, `WS3:pools:${lab}`, () => poolsOf(s, lab));

/** Power + O&M of owned sites, $B/yr: kW × 8760 h × $0.083/kWh × source multiplier (gas 0.5×), plus 3% of capex/yr [R15]. */
export function powerAndOMPerYear(s: GameStateV2): number {
  const kW = s.power.kWPerH100e;
  let power = 0;
  let capex = 0;
  for (const site of s.player.sites) {
    if (site.stage !== 'live') continue;
    const h = Math.min(site.installed, siteCapacityH(s, site.mw));
    power += h * kW * 8760 * POWER_PRICE * SOURCES[site.path].powerCostMult;
    capex += site.capex;
  }
  const chipBook = s.player.finance.ws3?.chipBook ?? 0;
  return power / 1e9 + OM_RATE * (capex + chipBook);
}

/** computeOnline (20, daily): player online H100e less what hidden compute footholds reserve (model v3 E8: the lab's
 *  usable compute; the gap to the installed fleet is the "unexplained compute use" symptom); pools memoised for the
 *  tick. Rivals' and China's online compute grows by chip deliveries in marketQ (installed directly; no site model for
 *  non-player labs). */
export const computeOnlineSystem: EngineSystem = {
  id: 'computeOnline', owner: 'WS3', cadence: 'daily', order: 20, system: 'compute',
  run(s, ctx) {
    ensureWs3(s);
    const online = computeOnlineOf(s);
    const hidden = hiddenComputeH(s);
    s.player.computeOnline = hidden > 0 ? Math.max(0, online - hidden) : online;
    poolsMemo(s, ctx);
  },
};
