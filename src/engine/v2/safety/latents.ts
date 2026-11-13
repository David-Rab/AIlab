// World latents, player-modified λ2 (V2-SPEC §3.5.1). Owner: WS2.
import type { GameStateV2 } from '../types';

/** λ2_eff = λ2 − 2·[any version uses latent reasoning] − 0.5·[CoT-pressured runs > 2]. */
export function lambda2Eff(s: GameStateV2): number {
  const vs = s.player.models.versions.filter((v) => v.status !== 'retired');
  const latent = vs.some((v) => v.design.cot === 'latent');
  const pressured = s.player.models.runs.filter((r) => r.status === 'done' && r.post?.cot === 'pressured').length;
  return s.hidden.latents.cotLoadBearing - 2 * (latent ? 1 : 0) - 0.5 * (pressured > 2 ? 1 : 0);
}
