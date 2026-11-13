// Deployments and variants (V2-SPEC §3.3.5). Owner: WS1 (revenue per deployment: WS5).
import type { Channel, Deployment, GameStateV2, SystemCtx } from '../types';

export function liveDeployments(s: GameStateV2, channel?: Channel): Deployment[] {
  return s.player.deployments.filter((d) => d.status !== 'withdrawn' && (!channel || d.channel === channel));
}

/** Create a deployment (pre-deployment gate, commitments check). TODO(WS1, M1). */
export function deploy(_s: GameStateV2, _ctx: SystemCtx, _p: Partial<Deployment> & { versionId: string; channel: Channel }): Deployment | string {
  return 'Deployments arrive in M1';
}
