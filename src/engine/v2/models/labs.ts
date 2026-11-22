// Lab API (WS1): uniform access to player, rival and China labs. Other workstreams use these instead of
// reaching into s.player / s.rivals / s.china.lab directly when they need "any lab".
//
// Production for any lab: `computeProduction(s, lab)` / `labInputs` / `evalProduction` (production/production.ts).
// The WS1 production system (order 30) advances every active lab's research: the player's projects, the other labs'
// aggregate recipe (model v3 F1, actors/rivalModel.ts). Non-player labs carry SimpleModel versions on a physical base;
// WS4's labDaily (actors/rivals.ts) is their one daily policy (split, staff, base run, continual learner, releases).
import type { GameStateV2, LabCore, LabId, ModelVersion, RivalLab } from '../types';

export const PLAYER_ID: LabId = 'player';
export const CHINA_ID: LabId = 'china';
/** Fixed id of the simulated AI 2027 leader lab (setup.leaderLab, BUILD-PLAN R2), appended after the sampled rivals. */
export const LEADER_ID: LabId = 'rL';

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

const LIVE = (v: ModelVersion) => v.status !== 'retired';

/** The player's routine-research agent model (R7 `agents.capRoutine`, formerly the internal agent; drives p_dep). */
export function internalVersion(s: GameStateV2): ModelVersion | undefined {
  const id = s.player.agents?.capRoutine.versionId;
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

/** `want`, or `want-2`, `want-3`, … if a version already has that name (model v3 F6: names are unique by
 *  construction; two distills of one teacher were both "<teacher>-mini"). */
export function uniqueVersionName(s: GameStateV2, want: string): string {
  const taken = new Set(s.player.models.versions.map((v) => v.name));
  if (!taken.has(want)) return want;
  let k = 2;
  while (taken.has(`${want}-${k}`)) k++;
  return `${want}-${k}`;
}

/** Player's best non-retired version by TRUE effective compute G (hidden — engine use only). */
export function bestPlayerVersion(s: GameStateV2): ModelVersion | undefined {
  let best: ModelVersion | undefined;
  for (const v of s.player.models.versions) if (LIVE(v) && (!best || v.G > best.G)) best = v;
  return best;
}

/** TRUE best general effective compute G (OOM) of a lab's internal frontier (hidden — engine use only); −∞ without a
 *  model. Its display level is λ(G) (models/capability.ts levelOfG). */
export function bestG(s: GameStateV2, id: LabId): number {
  if (id === PLAYER_ID) return bestPlayerVersion(s)?.G ?? -Infinity;
  const r = rivalLab(s, id);
  if (!r) return -Infinity;
  return Math.max(r.internal.G, r.publicModel?.G ?? -Infinity);
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
