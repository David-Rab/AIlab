// Lab API (WS1): uniform access to player, rival and China labs. Other workstreams use these instead of
// reaching into s.player / s.rivals / s.china.lab directly when they need "any lab".
//
// Production for any lab: `computeProduction(s, lab)` / `labInputs` / `evalProduction` (production/production.ts).
// The WS1 production system (order 30) advances every active lab's research: the player's projects, the other labs'
// aggregate recipe (model v3 F1, actors/rivalModel.ts). Non-player labs carry SimpleModel versions on a physical base;
// WS4's labDaily (actors/rivals.ts) is their one daily policy (split, staff, base run, continual learner, releases).
import type { DomainId, GameStateV2, LabCore, LabId, ModelVersion, RivalLab } from '../types';

export const PLAYER_ID: LabId = 'player';
export const CHINA_ID: LabId = 'china';

export type AnyLabCore = Omit<LabCore, 'deployments' | 'models'>;

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

/** RD-M01(b): the domain's benchmark fit (every domain has a row). UB-2: a version with no fit for the domain (in
 *  evaluation, or a pre-RD-M01b suite without MEDIA / PHYS rows) reads its nearest measured ancestor's fit, else the best
 *  measured version's, else the lineage's measured general level: never its true domain offset. The row then says
 *  "not measured yet" (ActRow.measured false). */
export function measuredDomainOf(s: GameStateV2, v: ModelVersion, d: DomainId): number {
  const vs = s.player.models.versions;
  let p: ModelVersion | undefined = v;
  for (let i = 0; p && i < 50; i++) {
    const fit = p.evals.measuredDom?.[d];
    if (fit !== undefined) return fit;
    const pid: string | undefined = p.parentVersionId;
    p = pid ? vs.find((x) => x.id === pid) : undefined;
  }
  let best: number | undefined;
  let bestL = -Infinity;
  for (const x of vs) {
    const fit = x.status !== 'retired' ? x.evals.measuredDom?.[d] : undefined;
    if (fit !== undefined && (x.evals.measuredL ?? 0) > bestL) { best = fit; bestL = x.evals.measuredL ?? 0; }
  }
  return best ?? measuredLOf(s, v).L;
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

/** UB-2: the player's best non-retired version as the lab knows it, for readouts: the highest MEASURED general level
 *  (evals.measuredL); with nothing measured, the newest live version. Never ranks by the true G. */
export function bestMeasuredVersion(s: GameStateV2): ModelVersion | undefined {
  let best: ModelVersion | undefined;
  let last: ModelVersion | undefined;
  for (const v of s.player.models.versions) {
    if (!LIVE(v)) continue;
    last = v;
    const L = v.evals.measuredL;
    if (L !== undefined && (!best || L > (best.evals.measuredL ?? -Infinity))) best = v;
  }
  return best ?? last;
}

/** TRUE best general effective compute G (OOM) of a lab's internal frontier (hidden — engine use only); −∞ without a
 *  model. Its display level is λ(G) (models/capability.ts levelOfG). */
export function bestG(s: GameStateV2, id: LabId): number {
  if (id === PLAYER_ID) return bestPlayerVersion(s)?.G ?? -Infinity;
  const r = rivalLab(s, id);
  if (!r) return -Infinity;
  return Math.max(r.internal.G, r.publicModel?.G ?? -Infinity);
}

/** F7: the G (OOM) of a lab's latest PUBLIC model, the one value a lead or a gap between labs is read on: the player's best
 *  model in a live product (a main or lineup model of a deployment that is not internal, withdrawn or held), an NPC lab's
 *  public model. Both step when a model is released; −∞ while the lab has none. */
export function publicG(s: GameStateV2, id: LabId): number {
  if (id === PLAYER_ID) {
    let g = -Infinity;
    for (const d of s.player.deployments) {
      if (d.status === 'withdrawn' || d.channel === 'internal' || d.held) continue;
      for (const vid of [d.versionId, ...(d.lineup ?? [])]) g = Math.max(g, versionById(s, vid)?.G ?? -Infinity);
    }
    return g;
  }
  return rivalLab(s, id)?.publicModel?.G ?? -Infinity;
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
