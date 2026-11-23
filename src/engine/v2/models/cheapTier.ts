// RD-P01b (DD-01): the "Auto-make cheap tiers" product policy. When a full model is a live product's main model and the
// lab has no distilled student of it (in training or made), distil one at CHEAP_TIER_RATIO of its active parameters: a
// real distillation run (models/runs.ts, its FLOP, pool share and time as any Distill a mini run). The student joins
// the lineup of every live product its teacher is the main model of once it is ready (and evaluated when the Safety
// framework asks for an assessment). Off: nothing automatic. Owner: WS1.
import { frameworkDeployBlock, frameworkOf } from '../safety/framework';
import { applyFrameworkParts, withFrameworkParts } from '../safety/packages';
import { LINEUP } from '../../../data/v2/serving';
import type { CostLine, GameStateV2, ModelVersion, SystemCtx } from '../types';
import { CHANNEL_VARIANTS } from './deployments';
import { versionById } from './labs';
import { isProduct } from './products';
import { launchRun, paramsOfVersion, planRun, type LaunchRunParams } from './runs';

/** The cheap tier's size: the middle lineup rung (1/(4√2) ≈ 1/5.7 of the teacher's active parameters; "1/6"). */
export const CHEAP_TIER_RATIO = LINEUP.ratios[1];
/** A student counts as a cheap tier of its teacher between the lineup's smallest and largest rung sizes. */
const RATIO_MIN = LINEUP.ratios[LINEUP.ratios.length - 1] * (1 - 1e-6);
const RATIO_MAX = LINEUP.ratios[0] * (1 + 1e-6);

const live = (v: ModelVersion) => v.status !== 'retired' && v.status !== 'rolledBack';

/** Teachers that need a cheap tier now: full main models of live products with no student of them (made or training)
 *  within the lineup size ratios. */
export function cheapTierTeachers(s: GameStateV2): ModelVersion[] {
  const out: ModelVersion[] = [];
  const m = s.player.models;
  for (const d of s.player.deployments) {
    if (!isProduct(d) || d.status === 'withdrawn') continue;
    const t = versionById(s, d.versionId);
    if (!t || t.variant !== 'full' || out.includes(t)) continue;
    const nT = paramsOfVersion(s, t);
    const has = m.versions.some((x) => x.parentVersionId === t.id && x.variant === 'mini' && live(x) && (x.params ?? nT) >= RATIO_MIN * nT && (x.params ?? nT) <= RATIO_MAX * nT)
      || m.runs.some((r) => r.kind === 'distill' && r.teacherVersionId === t.id && (r.status === 'running' || r.status === 'paused'));
    if (!has) out.push(t);
  }
  return out;
}

const paramsFor = (s: GameStateV2, t: ModelVersion): LaunchRunParams => ({ kind: 'distill', teacherVersionId: t.id, studentParams: CHEAP_TIER_RATIO * paramsOfVersion(s, t) });

/** What turning the policy on would start now (the products.policy preview): each run's FLOP, pool share and ETA. */
export function cheapTierPreview(s: GameStateV2): CostLine[] {
  const out: CostLine[] = [];
  for (const t of cheapTierTeachers(s)) {
    const plan = planRun(s, paramsFor(s, t));
    if (plan.reason) continue;
    out.push({ currency: 'compute', amount: plan.poolShare, lagDays: plan.etaDays, target: `training pool share: distil a 1/6-size ${t.name} (${plan.flopNeeded.toExponential(1)} FLOP, ~${plan.etaDays} d)` });
  }
  return out;
}

/** The policy's daily step (productsSystem): queue the missing cheap tiers, then put finished ones in their lineups. */
export function autoCheapTiers(s: GameStateV2, ctx: SystemCtx) {
  if (!s.player.policies.autoCheapTier) return;
  for (const t of cheapTierTeachers(s)) {
    const r = launchRun(s, ctx, paramsFor(s, t));
    if (typeof r === 'string') continue; // e.g. no compute: tried again tomorrow
    r.autoTier = true;
    ctx.log('research', `Auto cheap tier: distilling a 1/6-size ${t.name} for its lineup (${r.flopNeeded.toExponential(1)} FLOP, ETA ${r.predicted.etaDays} d).`, 1, r.id);
  }
  for (const v of s.player.models.versions) {
    if (!v.autoTier) continue;
    if (!live(v)) {
      delete v.autoTier;
      continue;
    }
    if (v.status !== 'ready' && v.status !== 'deployed') continue;
    if (frameworkOf(s).evalDepth !== 'none' && v.evals.suiteDay === undefined) continue;
    delete v.autoTier;
    for (const d of s.player.deployments) {
      if (!isProduct(d) || d.status === 'withdrawn' || d.versionId !== v.parentVersionId || (d.lineup ?? []).includes(v.id)) continue;
      const allowed = CHANNEL_VARIANTS[d.channel] ?? [];
      if (!allowed.includes('mini') && !allowed.includes('full')) continue;
      // SR-19: a lineup model passes the Safety framework too, judged with the parts the framework adds (RF-S13c).
      const n = { ...d, lineup: [v.id, ...(d.lineup ?? [])] };
      withFrameworkParts(s, n);
      if (frameworkDeployBlock(s, v, d.channel, n)) continue;
      d.lineup = n.lineup;
      v.status = 'deployed';
      ctx.log('company', `${v.name} joins a product lineup (auto cheap tier).`, 1, d.id);
      applyFrameworkParts(s, d, ctx);
    }
  }
}
