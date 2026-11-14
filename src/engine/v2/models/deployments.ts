// Variants, deployments, the internal-agent version and distillation leakage (V2-SPEC §3.3.5). Owner: WS1
// (revenue per deployment: WS5 writes deployment.revenueRate).
import { PREDICATES, liveCommitments } from '../actors/commitments';
import { ws4r } from '../actors/state';
import type { Channel, Deployment, GameStateV2, LabId, ModelVersion, SystemCtx, Variant } from '../types';
import { CHINA_ID, bestPm, rivalLab, versionById } from './labs';

/** Which version variants a channel accepts (§3.3.5). */
export const CHANNEL_VARIANTS: Record<Channel, Variant[]> = {
  consumer: ['full', 'mini'], api: ['full', 'mini'], agents: ['full'], enterprise: ['full'],
  gov: ['gov'], trusted: ['trusted'], internal: ['full', 'mini', 'gov', 'trusted', 'internal', 'open'], open: ['open'],
};
/** Distillation leak coefficient per channel (× gap × DA), §3.3.5. Open weights = full absorption. */
export const LEAK_COEF: Record<Channel, number> = { consumer: 0.3, api: 1.0, agents: 0.5, enterprise: 0.2, gov: 0, trusted: 0.05, internal: 0, open: 1 };
/** Default serving-pool reservation per channel [D]. */
export const DEFAULT_SERVING: Record<Channel, number> = { consumer: 0.4, api: 0.3, agents: 0.2, enterprise: 0.15, gov: 0.05, trusted: 0.03, internal: 0, open: 0 };
/** An eval suite must be no older than this on external channels (§3.3.5). */
export const EVAL_MAX_AGE = 30;

export function liveDeployments(s: GameStateV2, channel?: Channel): Deployment[] {
  return s.player.deployments.filter((d) => d.status !== 'withdrawn' && (!channel || d.channel === channel));
}

const external = (c: Channel) => c !== 'internal';

/** An external evaluator has tested this version (M4 fix: evaluators file reports — WS4's evalReports, and
 *  evalIndep's behavioural suite in evals.safety — but never write evals.bench, so the old bench-only check could
 *  never pass and a fullPlusExternal gate blocked every launch). */
export function externallyEvaluated(s: GameStateV2, v: ModelVersion): boolean {
  return ws4r(s).reportedVersions.includes(v.id) || Object.values(v.evals.bench).some((r) => r.by !== 'self') || Object.values(v.evals.safety).some((r) => r.by !== 'self');
}

/** Pre-deployment gate (§3.3.5): external channels need a suite ≤ 30 days old at the eval-gate depth. */
export function deployGate(s: GameStateV2, v: ModelVersion, channel: Channel): true | string {
  if (!CHANNEL_VARIANTS[channel].includes(v.variant)) return `${channel} needs a ${CHANNEL_VARIANTS[channel].join('/')} variant`;
  if (v.status === 'retired' || v.status === 'rolledBack') return 'Version is retired';
  if (!external(channel)) return true;
  if (v.status === 'evaluating') return 'Still in evaluation';
  const gate = s.player.safety.evalGate;
  if (gate !== 'none') {
    if (v.evals.suiteDay === undefined || s.time.day - v.evals.suiteDay > EVAL_MAX_AGE) return 'Eval suite older than 30 days';
    if (gate === 'fullPlusExternal' && !externallyEvaluated(s, v)) return 'Needs an external evaluation';
  }
  for (const c of liveCommitments(s)) {
    const pred = PREDICATES[c.condition.predicate];
    if (pred?.(s, { ...c.condition.params, versionId: v.id, channel })) return `Blocked by commitment: ${c.title}`;
  }
  return true;
}

export type DeployParams = Partial<Omit<Deployment, 'id' | 'startDay' | 'status'>> & { versionId: string; channel: Channel };

/** Create a deployment (pre-deployment gate, commitments check). Returns the deployment or a reason. */
export function deploy(s: GameStateV2, ctx: SystemCtx, p: DeployParams): Deployment | string {
  const v = versionById(s, p.versionId);
  if (!v) return 'Unknown version';
  const ok = deployGate(s, v, p.channel);
  if (ok !== true) return ok;
  if (p.effort === 'deep' && s.player.paradigms.P05?.status !== 'adopted') return 'Deep think needs orchestration (P05)';
  if (p.channel === 'internal') {
    setInternalAgent(s, v.id);
    return s.player.deployments.find((d) => d.channel === 'internal' && d.status === 'live') as Deployment;
  }
  const n = s.player.deployments.length + 1;
  const d: Deployment = {
    id: `D${n}${s.player.deployments.some((x) => x.id === `D${n}`) ? `-${s.time.day}` : ''}`,
    versionId: v.id, channel: p.channel, startDay: s.time.day, priceIndex: p.priceIndex ?? 1, effort: p.effort ?? 'max',
    servingShare: p.servingShare ?? DEFAULT_SERVING[p.channel], safeguards: p.safeguards ?? 'classifiers', controlLayer: p.controlLayer ?? false,
    sectorFocus: [...(p.sectorFocus ?? [])],
    usagePolicy: { ...(p.usagePolicy ?? { noDropInReplacement: false, noSurveillance: false, noAutonomousWeapons: false, minorsProtections: p.channel === 'consumer' }) },
    kyc: p.kyc ?? (p.channel === 'api' || p.channel === 'agents' ? 1 : 0), status: 'live',
  };
  s.player.deployments.push(d);
  if (v.status !== 'deployed') v.status = 'deployed';
  ctx.log('company', `${v.name} launched on ${p.channel}.`, p.channel === 'open' ? 3 : 1, d.id);
  return d;
}

/** Replace the version behind a live deployment (keeps its settings). */
export function swapDeployment(s: GameStateV2, depId: string, versionId: string): string | undefined {
  const d = s.player.deployments.find((x) => x.id === depId);
  const v = versionById(s, versionId);
  if (!d || !v) return 'Unknown deployment or version';
  if (d.channel === 'open') return 'Open weights cannot be replaced';
  const ok = deployGate(s, v, d.channel);
  if (ok !== true) return ok;
  d.versionId = v.id;
  d.versionSince = s.time.day;
  if (d.channel === 'internal') s.player.models.internalAgent = v.id;
  if (v.status !== 'deployed') v.status = 'deployed';
  return undefined;
}

/** Serving reservations (§3.3.5, Product sphere "serving pool"): set one external deployment's share of the serving
 *  pool, or (no id) re-split the external deployments' current total in proportion to `weights` (e.g. their demand),
 *  each keeping at least 2%. */
export function setServing(s: GameStateV2, depId: string | undefined, share: number, weights?: Map<string, number>): string | undefined {
  const ext = s.player.deployments.filter((d) => d.status !== 'withdrawn' && d.channel !== 'internal' && d.channel !== 'open');
  if (depId) {
    const d = ext.find((x) => x.id === depId);
    if (!d) return 'Unknown external deployment';
    d.servingShare = Math.min(1, Math.max(0.02, share));
    return undefined;
  }
  const tot = ext.reduce((a, d) => a + d.servingShare, 0);
  const wsum = ext.reduce((a, d) => a + (weights?.get(d.id) ?? 0), 0);
  if (!ext.length || tot <= 0 || wsum <= 0) return 'Nothing to rebalance';
  for (const d of ext) d.servingShare = Math.max(0.02, (tot * (weights?.get(d.id) ?? 0)) / wsum);
  return undefined;
}

/** Withdraw a deployment. Open weights are irreversible (§3.3.5). */
export function withdraw(s: GameStateV2, depId: string): string | undefined {
  const d = s.player.deployments.find((x) => x.id === depId);
  if (!d) return 'Unknown deployment';
  if (d.channel === 'open') return 'Open weights cannot be withdrawn';
  if (d.channel === 'internal') return 'Switch the internal agent instead';
  d.status = 'withdrawn';
  delete d.revenueRate;
  return undefined;
}

/** Set the version powering internal research agents (p_dep). Internal use needs no external eval gate. */
export function setInternalAgent(s: GameStateV2, versionId: string): string | undefined {
  const v = versionById(s, versionId);
  if (!v) return 'Unknown version';
  if (v.status === 'retired' || v.status === 'rolledBack') return 'Version is retired';
  s.player.models.internalAgent = v.id;
  const d = s.player.deployments.find((x) => x.channel === 'internal' && x.status === 'live');
  if (d) d.versionId = v.id;
  else s.player.deployments.push({
    id: `D${s.player.deployments.length + 1}-int`, versionId: v.id, channel: 'internal', startDay: s.time.day, priceIndex: 1, effort: 'max', servingShare: 0,
    safeguards: 'standard', controlLayer: false, sectorFocus: [], usagePolicy: { noDropInReplacement: false, noSurveillance: false, noAutonomousWeapons: false, minorsProtections: false }, kyc: 0, status: 'live',
  });
  if (v.status === 'ready') v.status = 'deployed';
  return undefined;
}

/** Make a gov / trusted / open variant of a version (instant copy; open weights keep only the hazard filter). */
export function makeVariant(s: GameStateV2, versionId: string, variant: Extract<Variant, 'gov' | 'trusted' | 'open'>): ModelVersion | string {
  const v = versionById(s, versionId);
  if (!v) return 'Unknown version';
  if (v.variant !== 'full' && v.variant !== 'mini') return 'Variants are made from full or mini versions';
  const c: ModelVersion = JSON.parse(JSON.stringify(v)) as ModelVersion;
  c.id = `V${s.player.models.nextName++}`;
  c.name = `${v.name}-${variant}`;
  c.variant = variant;
  c.parentVersionId = v.id;
  c.day = s.time.day;
  c.status = v.status === 'evaluating' ? 'evaluating' : 'ready';
  s.player.models.versions.push(c);
  return c;
}

/** Retire a version (not if it powers the internal agent, a live deployment or the stream). Old retired versions
 *  beyond the latest 12 are compacted to summary fields (§2.5 budget). */
export function retireVersion(s: GameStateV2, versionId: string): string | undefined {
  const v = versionById(s, versionId);
  if (!v) return 'Unknown version';
  if (s.player.models.internalAgent === v.id) return 'Powers the internal agents';
  if (s.player.models.stream?.versionId === v.id) return 'Is the continual-learning stream';
  if (s.player.deployments.some((d) => d.versionId === v.id && d.status !== 'withdrawn')) return 'Has live deployments';
  v.status = 'retired';
  compactRetired(s);
  return undefined;
}

export function compactRetired(s: GameStateV2, keep = 12) {
  const retired = s.player.models.versions.filter((v) => v.status === 'retired').sort((a, b) => b.day - a.day);
  for (const v of retired.slice(keep)) {
    if (!Object.keys(v.evals.bench).length && !Object.keys(v.evals.safety).length) continue;
    v.evals = { bench: {}, safety: {}, ...(v.evals.suiteDay !== undefined ? { suiteDay: v.evals.suiteDay } : {}), ...(v.evals.measuredL !== undefined ? { measuredL: v.evals.measuredL } : {}) };
    for (const t of Object.keys(v.masks)) v.masks[t as keyof typeof v.masks] = {};
  }
}

/** Distillation access of a receiving lab: China = distillationAccess/60; US rivals 0.3 (§3.3.5). */
export function distillationAccess(s: GameStateV2, lab: LabId): number {
  return lab === CHINA_ID ? s.china.meters.distillationAccess / 60 : 0.3;
}

/**
 * Daily know-how gain of lab X from distilling the player's external deployments (§3.3.5):
 *   Σ_d coef_channel · gap · DA · (1 − 0.25·kyc) · 0.5 / 365, gap = max(0, pm_deployed − pm_X).
 * Returns the pa increment and the best open-weights pm (absorbed outright). WS4's security system applies it.
 */
export function distillationLeak(s: GameStateV2, lab: LabId): { dpaPerDay: number; openPm: number } {
  const x = rivalLab(s, lab);
  if (!x) return { dpaPerDay: 0, openPm: -Infinity };
  const pmX = bestPm(s, lab);
  const DA = distillationAccess(s, lab);
  let dpa = 0;
  let openPm = -Infinity;
  for (const d of s.player.deployments) {
    if (d.status !== 'live' || d.channel === 'internal') continue;
    const v = versionById(s, d.versionId);
    if (!v) continue;
    if (d.channel === 'open') {
      openPm = Math.max(openPm, v.pm);
      continue;
    }
    const gap = Math.max(0, v.pm - pmX);
    dpa += (LEAK_COEF[d.channel] * gap * DA * (1 - 0.25 * d.kyc) * 0.5) / 365;
  }
  return { dpaPerDay: dpa, openPm };
}
