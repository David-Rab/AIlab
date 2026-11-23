// Variants, deployments, the internal-agent version and distillation leakage (V2-SPEC §3.3.5). Owner: WS1
// (revenue per deployment: WS5 writes deployment.revenueRate).
import { commitmentDeployBlock, committedUsagePolicy } from '../actors/commitments';
import { charterReleaseBlock } from '../finance/charter';
import { ws4r } from '../actors/state';
import type { Channel, Deployment, GameStateV2, LabId, ModelVersion, SystemCtx, Variant } from '../types';
import { CHINA_ID, bestG, rivalLab, uniqueVersionName, versionById } from './labs';
import { optionLocked } from './tree';
import { agentsGate, kindOfChannel, launchEffortBlock, priceIndexOf, relaunchPacks } from './products';
import { tierOfIndex } from '../../../data/v2/features';

/** Which version variants a channel accepts (§3.3.5). */
export const CHANNEL_VARIANTS: Record<Channel, Variant[]> = {
  consumer: ['full', 'mini'], api: ['full', 'mini'], agents: ['full'], enterprise: ['full'],
  gov: ['gov'], trusted: ['trusted'], internal: ['full', 'mini', 'gov', 'trusted', 'open', 'imported'], open: ['open'],
};
/** Distillation leak coefficient per channel (× gap × DA), §3.3.5. Open weights = full absorption. */
export const LEAK_COEF: Record<Channel, number> = { consumer: 0.3, api: 1.0, agents: 0.5, enterprise: 0.2, gov: 0, trusted: 0.05, internal: 0, open: 1 };
/** Default serving-pool reservation per channel [D]. */
export const DEFAULT_SERVING: Record<Channel, number> = { consumer: 0.4, api: 0.3, agents: 0.2, enterprise: 0.15, gov: 0.05, trusted: 0.03, internal: 0, open: 0 };

const external = (c: Channel) => c !== 'internal';

/** An external evaluator has tested this version (M4 fix: evaluators file reports — WS4's evalReports, and
 *  evalIndep's behavioural suite in evals.safety — but never write evals.bench, so the old bench-only check could
 *  never pass and a fullPlusExternal gate blocked every launch). */
export function externallyEvaluated(s: GameStateV2, v: ModelVersion): boolean {
  return ws4r(s).reportedVersions.includes(v.id) || Object.values(v.evals.bench).some((r) => r.by !== 'self') || Object.values(v.evals.safety).some((r) => r.by !== 'self');
}

/** Why an inference effort is locked, or undefined (B5; R4: the tree node that unlocks it, e.g. deep think needs
 *  Multi-agent orchestration). */
export function effortLock(s: GameStateV2, effort: Deployment['effort']): string | undefined {
  return optionLocked(s, 'effort', effort);
}

/** Settings of the deployment being gated (a swap passes the live deployment's; a launch what deploy() will set). */
export interface GateOpts { safeguards?: Deployment['safeguards']; usagePolicy?: Deployment['usagePolicy'] }

/** Pre-deployment gate (§3.3.5): external channels need an eval suite (R6: no expiry; the auto-evaluate policy keeps
 *  suites current instead of a 30-day expiry that blocked launches) at the eval-gate depth; the Agents product needs a
 *  measured time horizon covering its tasks; commitments block only launches inside their own scope, judged on this
 *  candidate (B1/B2), and the reason names the clause; the charter's release block (FIN3b) comes before the eval gate. */
export function deployGate(s: GameStateV2, v: ModelVersion, channel: Channel, opts: GateOpts = {}): true | string {
  if (!CHANNEL_VARIANTS[channel].includes(v.variant)) return `${channel} needs a ${CHANNEL_VARIANTS[channel].join('/')} variant`;
  if (v.status === 'retired' || v.status === 'rolledBack') return 'Version is retired';
  if (!external(channel)) return true;
  if (v.status === 'evaluating') return 'Still in evaluation';
  // FIN3b (FINANCE-V3 §7.2): the charter's release block (nonprofit PBC safety committee; PBC + trust on open weights of
  // a capability-threshold model). Finance reaches the release path only here.
  const charter = charterReleaseBlock(s, v, channel);
  if (charter) return charter;
  const gate = s.player.safety.evalGate;
  if (gate !== 'none') {
    if (v.evals.suiteDay === undefined) return 'Not evaluated yet';
    if (gate === 'fullPlusExternal' && !externallyEvaluated(s, v)) return 'Needs an external evaluation';
  }
  if (channel === 'agents') {
    const g = agentsGate(v);
    if (g !== true) return g;
  }
  const block = commitmentDeployBlock(s, {
    versionId: v.id, channel, safeguards: opts.safeguards ?? 'classifiers', usagePolicy: opts.usagePolicy ?? committedUsagePolicy(s, channel),
  });
  return block ?? true;
}

export type DeployParams = Partial<Omit<Deployment, 'id' | 'startDay' | 'status' | 'kind'>> & { versionId: string; channel: Channel };

/** Create a deployment (pre-deployment gate, commitments check). Returns the deployment or a reason. */
export function deploy(s: GameStateV2, ctx: SystemCtx, p: DeployParams): Deployment | string {
  const v = versionById(s, p.versionId);
  if (!v) return 'Unknown version';
  const cu = committedUsagePolicy(s, p.channel);
  const usagePolicy = { ...(p.usagePolicy ?? { noDropInReplacement: false, noSurveillance: cu.noSurveillance, noAutonomousWeapons: cu.noAutonomousWeapons, minorsProtections: p.channel === 'consumer' }) };
  const ok = deployGate(s, v, p.channel, { safeguards: p.safeguards ?? 'classifiers', usagePolicy });
  if (ok !== true) return ok;
  const lock = effortLock(s, p.effort ?? 'max') ?? launchEffortBlock(s, p.channel, p.effort);
  if (lock) return lock;
  if (p.channel === 'internal') {
    setInternalAgent(s, v.id);
    return s.player.deployments.find((d) => d.channel === 'internal' && d.status === 'live') as Deployment;
  }
  const n = s.player.deployments.length + 1;
  const price = p.price ?? tierOfIndex(p.priceIndex ?? 1);
  // RD-B12 (B18): a relaunch takes over the retired product's sector packs (certification kept).
  const re = p.packs ? { packs: p.packs } : relaunchPacks(s, p.channel);
  const d: Deployment = {
    id: `D${n}${s.player.deployments.some((x) => x.id === `D${n}`) ? `-${s.time.day}` : ''}`, kind: kindOfChannel(p.channel),
    versionId: v.id, channel: p.channel, startDay: s.time.day, price, priceIndex: priceIndexOf(price), effort: p.effort ?? 'max',
    servingShare: p.servingShare ?? DEFAULT_SERVING[p.channel], safeguards: p.safeguards ?? 'classifiers', controlLayer: p.controlLayer ?? false,
    packs: re.packs.map((x) => ({ ...x })), features: [...(p.features ?? [])],
    ...(p.monitorId ? { monitorId: p.monitorId } : {}), ...(p.miniVersionId ? { miniVersionId: p.miniVersionId } : {}),
    usagePolicy,
    kyc: p.kyc ?? (p.channel === 'api' || p.channel === 'agents' ? 1 : 0), status: 'live',
  };
  s.player.deployments.push(d);
  if ('from' in re && re.from && d.packs.length) re.from.packs = [];
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
  const ok = deployGate(s, v, d.channel, { safeguards: d.safeguards, usagePolicy: d.usagePolicy });
  if (ok !== true) return ok;
  d.versionId = v.id;
  d.versionSince = s.time.day;
  if (d.channel === 'internal') s.player.agents.capRoutine.versionId = v.id;
  if (v.status !== 'deployed') v.status = 'deployed';
  return undefined;
}

/** Manual serving share of one product (used when the Auto serving policy is off, R6). */
export function setServing(s: GameStateV2, depId: string, share: number): string | undefined {
  const d = s.player.deployments.find((x) => x.id === depId && x.status !== 'withdrawn' && x.channel !== 'internal' && x.channel !== 'open');
  if (!d) return 'Unknown product';
  d.servingShare = Math.min(1, Math.max(0, share));
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

/** Set the routine-research agents' model (p_dep; the internal deployment follows it). Internal use needs no external
 *  eval gate. R7: called by the `agents.set` action for routine research. */
export function setInternalAgent(s: GameStateV2, versionId: string): string | undefined {
  const v = versionById(s, versionId);
  if (!v) return 'Unknown version';
  if (v.status === 'retired' || v.status === 'rolledBack') return 'Version is retired';
  s.player.agents.capRoutine.versionId = v.id;
  const d = s.player.deployments.find((x) => x.channel === 'internal' && x.status === 'live');
  if (d) d.versionId = v.id;
  else s.player.deployments.push({
    id: `D${s.player.deployments.length + 1}-int`, kind: 'internal', versionId: v.id, channel: 'internal', startDay: s.time.day, price: 'standard', priceIndex: 1, effort: 'max', servingShare: 0,
    safeguards: 'standard', controlLayer: false, packs: [], features: [], usagePolicy: { noDropInReplacement: false, noSurveillance: false, noAutonomousWeapons: false, minorsProtections: false }, kyc: 0, status: 'live',
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
  c.name = uniqueVersionName(s, `${v.name}-${variant}`);
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
  if (Object.values(s.player.agents).some((a) => a.versionId === v.id || a.monitorId === v.id)) return 'Powers or monitors internal agents';
  if (s.player.models.stream?.versionId === v.id) return 'Is the continual-learning stream';
  if (s.player.deployments.some((d) => d.versionId === v.id && d.status !== 'withdrawn')) return 'Has live deployments';
  if (s.player.deployments.some((d) => d.status !== 'withdrawn' && (d.monitorId === v.id || d.miniVersionId === v.id))) return 'Monitors or serves a free tier on a live product';
  v.status = 'retired';
  compactRetired(s);
  return undefined;
}

export function compactRetired(s: GameStateV2, keep = 12) {
  const retired = s.player.models.versions.filter((v) => v.status === 'retired').sort((a, b) => b.day - a.day);
  for (const v of retired.slice(keep)) {
    if (!Object.keys(v.evals.bench).length && !Object.keys(v.evals.safety).length) continue;
    v.evals = { bench: {}, safety: {}, ...(v.evals.suiteDay !== undefined ? { suiteDay: v.evals.suiteDay } : {}), ...(v.evals.measuredL !== undefined ? { measuredL: v.evals.measuredL } : {}), ...(v.evals.measuredDom ? { measuredDom: v.evals.measuredDom } : {}) };
    for (const t of Object.keys(v.masks)) v.masks[t as keyof typeof v.masks] = {};
  }
}

/** Distillation access of a receiving lab: China = distillationAccess/60; US rivals 0.3 (§3.3.5). */
export function distillationAccess(s: GameStateV2, lab: LabId): number {
  return lab === CHINA_ID ? s.china.meters.distillationAccess / 60 : 0.3;
}

/**
 * Daily recipe gain of lab X (OOM) from distilling the player's external deployments (§3.3.5):
 *   Σ_d coef_channel · gap · DA · (1 − 0.25·kyc) · 0.5 / 365, gap = max(0, G_deployed − G_X) (model v3 F3: the G gap; the
 *   old pm gap × B, so the same OOM).
 * Returns the recipe increment and the best open-weights G (absorbed outright). WS4's security system applies it.
 */
export function distillationLeak(s: GameStateV2, lab: LabId): { dGPerDay: number; openG: number } {
  const x = rivalLab(s, lab);
  if (!x) return { dGPerDay: 0, openG: -Infinity };
  const gX = bestG(s, lab);
  const DA = distillationAccess(s, lab);
  let dG = 0;
  let openG = -Infinity;
  for (const d of s.player.deployments) {
    if (d.status !== 'live' || d.channel === 'internal') continue;
    const v = versionById(s, d.versionId);
    if (!v) continue;
    if (d.channel === 'open') {
      openG = Math.max(openG, v.G);
      continue;
    }
    const gap = Math.max(0, v.G - gX);
    dG += (LEAK_COEF[d.channel] * gap * DA * (1 - 0.25 * d.kyc) * 0.5) / 365;
  }
  return { dGPerDay: dG, openG };
}
