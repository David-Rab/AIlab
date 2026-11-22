// Environment suites: output-only previews for the suites view (model v3 D6; design/notes/D6.md). Owner: WS1.
//
// What one build or hardening pass on a family's suite would do to a planned post-training run: the run's RL gain per
// domain (planRun(...).g.rl) and its reward-hacking signal S2 (postSignals), before and after. The "after" is read from
// a shallow hypothetical copy of the state with the work done; the state passed in is never changed.
import { SUITE_BUILD } from '../../../data/v2/suites';
import { RL_BUDGET, RL_FAMILY_IDS, RL_FAMILY_NEEDS } from '../../../data/v2/runDesign';
import { planRun, type LaunchRunParams } from './runs';
import type { RlGains } from './effective';
import { optimisationPressure, postSignals } from '../safety/traits';
import { adopted } from '../safety/common';
import { buildEtas, buildWaitNew } from '../departments/build';
import {
  S2_PER_EXPLOIT, exploitFloor, expertAsset, expertAssetId, familyUnlocked, firstSuite, hardenCut, hardenedExploit, suiteExpertT, suiteOf, suiteRef, suiteRlWeights,
  suiteWorkBlock, suiteWorkCost, suiteWorkEffect, unbuiltSuiteFamilies, type SuiteCost, type SuiteWork,
} from './suites';
import type { GameStateV2, PostDesign, RLFamily } from '../types';

/** The state with one piece of suite work done (shallow copies of the suites and the data portfolio); a family's first
 *  build creates its suite (RD-B03). The state itself when the work cannot be done. */
function withSuiteWork(s: GameStateV2, f: RLFamily, work: SuiteWork): GameStateV2 {
  const x = suiteOf(s, f) ?? (work === 'build' && familyUnlocked(s, f) ? firstSuite(s, f) : undefined);
  if (!x) return s;
  const suites = { ...(s.player.suites ?? {}), [f]: work === 'harden' ? { ...x, exploit: hardenedExploit(f, x.exploit, hardenCut(s)), hardenings: x.hardenings + 1 } : { ...x, builds: x.builds + 1 } };
  let assets = s.player.dataPortfolio.assets;
  if (work === 'build') {
    const id = expertAssetId(f);
    const E = suiteExpertT(s, f) + SUITE_BUILD.tokensT;
    assets = assets.some((a) => a.kind === 'expert' && a.id === id)
      ? assets.map((a) => (a.kind === 'expert' && a.id === id ? { ...a, tokensT: E } : a))
      : [...assets, expertAsset(f, E)];
  }
  return { ...s, player: { ...s.player, suites, dataPortfolio: { ...s.player.dataPortfolio, assets } } };
}

/** A planned post-train's suite-dependent outputs: RL gain (OOM per domain) and S2 (clamped 0–1), or why it cannot run. */
export interface SuitePlanEffect { rl?: RlGains; s2: number; reason?: string }
export function suitePlanEffect(s: GameStateV2, lp: LaunchRunParams): SuitePlanEffect {
  const plan = planRun(s, lp);
  const s2 = lp.post ? Math.max(0, Math.min(1, postSignals(s, lp.post).S2)) : 0;
  return { rl: plan.g.rl, s2, reason: plan.reason };
}

/** S2 of a post design, per family: RL share × exploitability × S2_PER_EXPLOIT × the RL budget's optimisation pressure
 *  p(ρ) (E3, Gao), + P11. */
export function suiteS2Parts(s: GameStateV2, post: PostDesign): { rows: { family: RLFamily; share: number; exploit: number; s2: number }[]; pressure: number; p11: number; total: number } {
  const w = suiteRlWeights(s, post.rlFocus);
  const pressure = optimisationPressure(RL_BUDGET[post.rlBudget]);
  const rows = (Object.entries(w) as [RLFamily, number][]).map(([family, share]) => {
    const exploit = suiteOf(s, family)?.exploit ?? 0;
    return { family, share, exploit, s2: S2_PER_EXPLOIT * share * exploit * pressure };
  });
  const p11 = adopted(s, 'P11') ? 0.2 : 0;
  return { rows, pressure, p11, total: Math.max(0, Math.min(1, rows.reduce((a, r) => a + r.s2, 0) + p11)) };
}

export interface SuiteWorkPreview {
  work: SuiteWork; cost: SuiteCost; effect: ReturnType<typeof suiteWorkEffect>; block?: string;
  /** Days until the work would finish if queued now (build queue). */
  waitDays: number;
  before: SuitePlanEffect; after: SuitePlanEffect;
}
/** One build or hardening pass on family `f`: cost, the suite's before → after, and the planned run's before → after. */
export function suiteWorkPreview(s: GameStateV2, f: RLFamily, work: SuiteWork, lp: LaunchRunParams, before = suitePlanEffect(s, lp)): SuiteWorkPreview {
  const cost = suiteWorkCost(s, f, work);
  const done = withSuiteWork(s, f, work);
  return {
    work, cost, effect: suiteWorkEffect(s, f, work), block: suiteWorkBlock(s, f, work), waitDays: buildWaitNew(s, cost.tw, 'suite'),
    before, after: done !== s ? suitePlanEffect(done, lp) : before,
  };
}

/** Pending suite work of a family with its remaining team-weeks and ETA (days) from the build queue. */
export function suitePending(s: GameStateV2, f: RLFamily): { work: SuiteWork; leftTW: number; etaDays: number }[] {
  const etas = buildEtas(s).etas;
  return (['build', 'harden'] as SuiteWork[]).flatMap((work) => {
    const it = s.player.build.queue.find((q) => q.kind === 'suite' && q.ref === suiteRef(f, work));
    return it ? [{ work, leftTW: Math.max(0, it.needTW - it.doneTW), etaDays: etas.get(it.id) ?? Infinity }] : [];
  });
}

/** Families without a suite yet and the tree idea that unlocks each. */
export const lockedSuiteFamilies = (s: GameStateV2): { family: RLFamily; node: string }[] =>
  RL_FAMILY_IDS.filter((f) => !familyUnlocked(s, f) && RL_FAMILY_NEEDS[f]).map((f) => ({ family: f, node: RL_FAMILY_NEEDS[f] as string }));

/** Families whose idea is known but whose first suite is not built yet (RD-B03), with the first build's preview. */
export const unbuiltSuites = (s: GameStateV2, lp: LaunchRunParams, before = suitePlanEffect(s, lp)): { family: RLFamily; build: SuiteWorkPreview }[] =>
  unbuiltSuiteFamilies(s).map((family) => ({ family, build: suiteWorkPreview(s, family, 'build', lp, before) }));

export { exploitFloor };
