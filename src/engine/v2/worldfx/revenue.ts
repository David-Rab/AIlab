// Revenue per deployment: sector demand × share vs serving capacity (V2-SPEC §3.11.3). Owner: WS5.
import type { EngineSystem, GameStateV2, Money } from '../types';

/** Revenue rate ($B/yr) of a deployment, as last computed by the revenue system. */
export function revenueOf(s: GameStateV2, deploymentId: string): Money {
  return s.player.deployments.find((d) => d.id === deploymentId)?.revenueRate ?? 0;
}

/** revenue (60, daily): demand vs capacity per deployment → revenueRate; cash += revenue/365 via ctx.bump('cash').
 *  TODO(WS5, M1; WS3 owns the cash ledger semantics). */
export const revenueSystem: EngineSystem = {
  id: 'revenue', owner: 'WS5', cadence: 'daily', order: 60,
  run() {},
};
