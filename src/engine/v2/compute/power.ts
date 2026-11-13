// Power grid and online compute (V2-SPEC §3.8, §2.2 order 20). Owner: WS3.
import type { EngineSystem, GameStateV2, PowerGrid } from '../types';

export function initialPower(): PowerGrid {
  return { poolGWPerQ: 1.5, queue: [{ siteId: 'S4', gw: 2 }], capacityPrice: 0.05, kWPerH100e: 0.93, transformerLeadQ: 9 };
}

/** Player online H100e = installed in live sites (MW-limited) + live cloud contracts. */
export function computeOnlineOf(s: GameStateV2): number {
  let h = 0;
  for (const site of s.player.sites) {
    if (site.stage !== 'live') continue;
    h += Math.min(site.installed, (site.mw * 1000) / s.power.kWPerH100e);
  }
  for (const c of s.player.cloud) if (c.startDay <= s.time.day && c.endDay > s.time.day) h += c.h100e;
  return h;
}

/** computeOnline (20, daily): online H100e; apply split → pools. M0: player total only. TODO(WS3, M1): rivals,
 *  China, pools. */
export const computeOnlineSystem: EngineSystem = {
  id: 'computeOnline', owner: 'WS3', cadence: 'daily', order: 20,
  run(s) {
    s.player.computeOnline = computeOnlineOf(s);
  },
};
