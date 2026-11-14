// Lab API (WS1): uniform access to player, rival and China labs. Other workstreams use these instead of
// reaching into s.player / s.rivals / s.china.lab directly when they need "any lab".
//
// Production for any lab: `computeProduction(s, lab)` / `labInputs` / `evalProduction` (production/production.ts).
// Every active lab's know-how pa is advanced by the WS1 production system (order 30) through the same function.
// Non-player labs carry a SimpleModel frontier; until WS4 sets `RivalLab.managed`, WS1's continual system applies
// a default policy: the internal model tracks `simpleFrontierPm` and the split tracks shareRef(t).
import type { ComputeSplit, GameStateV2, LabCore, LabId, ModelVersion, RivalLab } from '../types';

export const PLAYER_ID: LabId = 'player';
export const CHINA_ID: LabId = 'china';

export type AnyLabCore = Omit<LabCore, 'deployments' | 'models' | 'paradigms'>;

/** Core record of any lab by id. */
export function labCore(s: GameStateV2, id: LabId): AnyLabCore | undefined {
  if (id === PLAYER_ID) return s.player;
  if (id === CHINA_ID) return s.china.lab.core;
  return s.rivals.find((r) => r.core.id === id)?.core;
}

/** Rival or China lab record by id (undefined for the player). */
export function rivalLab(s: GameStateV2, id: LabId): RivalLab | undefined {
  if (id === CHINA_ID) return s.china.lab;
  return s.rivals.find((r) => r.core.id === id);
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

/** Compute pools of a lab in H100e: online compute × split (§3.4.2). */
export function labPools(s: GameStateV2, id: LabId): ComputeSplit {
  const c = labCore(s, id);
  const out = { training: 0, experiments: 0, agents: 0, synthetic: 0, serving: 0, safety: 0, security: 0 } as ComputeSplit;
  if (!c) return out;
  for (const k of Object.keys(out) as (keyof ComputeSplit)[]) out[k] = c.computeOnline * c.split[k];
  return out;
}

const LIVE = (v: ModelVersion) => v.status !== 'retired';

/** The player's internal-agent version (drives p_dep). */
export function internalVersion(s: GameStateV2): ModelVersion | undefined {
  const id = s.player.models.internalAgent;
  return s.player.models.versions.find((v) => v.id === id);
}

/**
 * Measured level of a version for display and for everything keyed on "measured L" (M5 fix, AUDIT #1): a version
 * still in evaluation has no `measuredL`, so it inherits its parent chain's last measured level, then the best
 * measured level of any live version. Without this the race readout showed L 0.0 and U collapsed (EA projected
 * over a 0 → L gap) whenever the internal agent was a fresh, unevaluated version.
 */
export function measuredLOf(s: GameStateV2, v: ModelVersion | undefined): { L: number; evaluating: boolean } {
  if (!v) return { L: 0, evaluating: false };
  if (v.evals.measuredL !== undefined) return { L: v.evals.measuredL, evaluating: false };
  const vs = s.player.models.versions;
  let p = vs.find((x) => x.id === v.parentVersionId);
  for (let i = 0; p && i < 50; i++) {
    if (p.evals.measuredL !== undefined) return { L: p.evals.measuredL, evaluating: true };
    const pid = p.parentVersionId;
    p = vs.find((x) => x.id === pid);
  }
  return { L: bestMeasuredL(s), evaluating: true };
}

/** Player version by id. */
export function versionById(s: GameStateV2, id: string | undefined): ModelVersion | undefined {
  return id === undefined ? undefined : s.player.models.versions.find((v) => v.id === id);
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
  const r = rivalLab(s, id);
  if (!r) return -Infinity;
  return Math.max(r.internal.pm, r.publicModel?.pm ?? -Infinity);
}

/** TRUE best general level of a lab's internal frontier (hidden). */
export function bestLg(s: GameStateV2, id: LabId): number {
  if (id === PLAYER_ID) return bestPlayerVersion(s)?.Lg ?? 0;
  const r = rivalLab(s, id);
  if (!r) return 0;
  return Math.max(r.internal.Lg, r.publicModel?.Lg ?? 0);
}

/** Best MEASURED level of the player's non-retired versions (visible; tier gates use this, §3.3.3). */
export function bestMeasuredL(s: GameStateV2): number {
  let L = 0;
  for (const v of s.player.models.versions) if (LIVE(v) && v.evals.measuredL !== undefined) L = Math.max(L, v.evals.measuredL);
  return L;
}
