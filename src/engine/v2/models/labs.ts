// Lab API (WS1): uniform access to player, rival and China labs. Other workstreams use these instead of
// reaching into s.player / s.rivals / s.china.lab directly when they need "any lab".
import type { GameStateV2, LabCore, LabId, ModelVersion, RivalLab } from '../types';

export const PLAYER_ID: LabId = 'player';
export const CHINA_ID: LabId = 'china';

export type AnyLabCore = Omit<LabCore, 'deployments' | 'models' | 'paradigms'>;

/** Core record of any lab by id. */
export function labCore(s: GameStateV2, id: LabId): AnyLabCore | undefined {
  if (id === PLAYER_ID) return s.player;
  if (id === CHINA_ID) return s.china.lab.core;
  return s.rivals.find((r) => r.core.id === id)?.core;
}

/** Non-player labs (US rivals then China), any status. */
export function otherLabs(s: GameStateV2): RivalLab[] {
  return [...s.rivals, s.china.lab];
}

/** Active US rivals only (V2-SPEC §3.10.3 bug fix: never reference inactive labs). */
export function activeRivals(s: GameStateV2): RivalLab[] {
  return s.rivals.filter((r) => r.core.status === 'active');
}

/** All lab ids that are active (player included). */
export function activeLabIds(s: GameStateV2): LabId[] {
  const ids: LabId[] = [];
  if (s.player.status === 'active') ids.push(PLAYER_ID);
  for (const r of activeRivals(s)) ids.push(r.core.id);
  if (s.china.lab.core.status === 'active') ids.push(CHINA_ID);
  return ids;
}

const LIVE = (v: ModelVersion) => v.status !== 'retired';

/** The player's internal-agent version (drives p_dep). */
export function internalVersion(s: GameStateV2): ModelVersion | undefined {
  const id = s.player.models.internalAgent;
  return s.player.models.versions.find((v) => v.id === id);
}

/** Player's best non-retired version by TRUE pm (hidden — engine use only). */
export function bestPlayerVersion(s: GameStateV2): ModelVersion | undefined {
  let best: ModelVersion | undefined;
  for (const v of s.player.models.versions) if (LIVE(v) && (!best || v.pm > best.pm)) best = v;
  return best;
}

/** TRUE best capability (pm) of a lab's internal frontier (hidden — engine use only). */
export function bestPm(s: GameStateV2, id: LabId): number {
  if (id === PLAYER_ID) return bestPlayerVersion(s)?.pm ?? s.player.pa;
  const r = id === CHINA_ID ? s.china.lab : s.rivals.find((x) => x.core.id === id);
  if (!r) return -Infinity;
  return Math.max(r.internal.pm, r.publicModel?.pm ?? -Infinity);
}

/** TRUE best general level of a lab's internal frontier (hidden). */
export function bestLg(s: GameStateV2, id: LabId): number {
  if (id === PLAYER_ID) return bestPlayerVersion(s)?.Lg ?? 0;
  const r = id === CHINA_ID ? s.china.lab : s.rivals.find((x) => x.core.id === id);
  if (!r) return 0;
  return Math.max(r.internal.Lg, r.publicModel?.Lg ?? 0);
}
