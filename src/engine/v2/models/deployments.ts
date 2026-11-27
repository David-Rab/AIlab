// Deployments, the open-weights release, the internal-agent version and distillation leakage (V2-SPEC §3.3.5). Owner: WS1
// (revenue per deployment: WS5 writes deployment.revenueRate).
import { commitmentDeployBlock, committedUsagePolicy } from '../actors/commitments';
import { charterReleaseBlock } from '../finance/charter';
import { frameworkDeployBlock } from '../safety/framework';
import { applyFrameworkParts, frameworkCandidate } from '../safety/packages';
import type { Channel, Deployment, GameStateV2, LabId, ModelVersion, SystemCtx, Variant } from '../types';
import { CHINA_ID, bestG, rivalLab, versionById } from './labs';
import { kindOfChannel } from './products';
import { relaunchCerts } from './certs';
import { distillLift } from '../production/diffusion';
import { B0_PARAMS } from '../../../data/v2/runDesign';
import { oversightBlock } from '../world/usgov';

/** Which version variants a channel accepts (§3.3.5). RD-P05 (DD-02 a): Government and Trusted are who a product is
 *  offered to (its channel, usage policy and safeguards), so any full or mini version can go on them; open weights are
 *  a release act on a version (releaseOpen), not a copy. */
export const CHANNEL_VARIANTS: Record<Channel, Variant[]> = {
  consumer: ['full', 'mini'], api: ['full', 'mini'], enterprise: ['full'],
  vetted: ['full', 'mini'], internal: ['full', 'mini', 'imported'], open: ['full', 'mini'],
};
/** RD-P09 (PRD-18): share of a channel's usage bought by unverified buyers (self-serve accounts with no identity check),
 *  the only usage a distiller can hide in [stand-in]: Chat's free and paid accounts are anonymous but rate-limited per
 *  account; API keys are mostly self-serve; Enterprise and Vetted buyers are named under contract (Vetted's are vetted
 *  before they buy: government, military, critical infrastructure, large regulated firms), so neither has anonymous
 *  usage and KYC has nothing to verify there (deploy's default KYC is 0 on them). Open weights: anyone (diffusion.ts
 *  gives them access 1). */
export const ANON_SHARE: Record<Channel, number> = { consumer: 0.3, api: 0.5, enterprise: 0, vetted: 0, internal: 0, open: 1 };
/** RD-P09: the part of the anonymous share left at each KYC level (0–3): each level verifies ten times more of the
 *  self-serve accounts [D, the access formula's tenfold cut per level, research/RD-X04r D2]. */
export const KYC_ANON_LEFT = [1, 0.1, 0.01, 0.001] as const;
/** RD-P09, CAL-P: share of the anonymous buyers asked to verify who leave instead. 0.25 [P-analogue, low confidence]:
 *  Ofcom, Online Nation 2025: after UK age checks began (25 Jul 2025), unique visitors fell 24-31% in a month on the
 *  largest sites that added them ("may be due to visitors' unwillingness or inability to complete the age assurance
 *  check"), with unverified substitutes a click away. An upper-end analogue: anonymity matters more there than to most
 *  API buyers (research/CAL-products-sources.md K1). */
export const KYC_REFUSE = 0.25;
/** RD-P09: the share of this product's usage still bought anonymously after its KYC level. */
export function anonShare(d: Pick<Deployment, 'channel' | 'kyc'>): number {
  return ANON_SHARE[d.channel] * (d.channel === 'open' ? 1 : KYC_ANON_LEFT[d.kyc ?? 0]);
}
/** RD-P09: the anonymous share KYC asks to verify (0 at KYC 0 or on a channel with no anonymous buyers). */
const kycAsked = (d: Pick<Deployment, 'channel' | 'kyc'>) => (d.channel === 'open' ? 0 : ANON_SHARE[d.channel] * (1 - KYC_ANON_LEFT[d.kyc ?? 0]));
/** RD-P09: the product's demand left after KYC: the asked buyers who refuse to verify are lost. */
export const kycDemandFactor = (d: Pick<Deployment, 'channel' | 'kyc'>) => 1 - kycAsked(d) * KYC_REFUSE;
// CAL-P: the review cost (2% of the verified buyers' revenue) is deleted (review/products.md F5). A check costs about
// $0.06-1.50 once (Ofcom 2026: median per-check cost about GBP 0.06; Stripe Identity: $1.50 per ID check), under 1% of
// a year of a $20/month account, so it rounds to nothing (research/CAL-products-sources.md K2).
/** Default serving-pool reservation per channel [D]. Vetted keeps Government's 0.05 (the smallest buyer group, MARKET.md
 *  §2); Agents' 0.2 went with the product (MK-1). */
export const DEFAULT_SERVING: Record<Channel, number> = { consumer: 0.4, api: 0.3, enterprise: 0.15, vetted: 0.05, internal: 0, open: 0 };

const external = (c: Channel) => c !== 'internal';

/** An external evaluator has tested this version (M4 fix: evaluators file reports — WS4's evalReports, and
 *  evalIndep's behavioural suite in evals.safety — but never write evals.bench, so the old bench-only check could
 *  never pass and a fullPlusExternal gate blocked every launch). */
export { externallyEvaluated } from '../safety/framework';

/** Settings of the deployment being gated (a swap passes the live deployment's; a launch what deploy() will set). */
export interface GateOpts { safeguards?: Deployment['safeguards']; guards?: Deployment['guards']; usagePolicy?: Deployment['usagePolicy']; frameworkApplied?: string[] }

/** Pre-deployment gate (§3.3.5): external channels need an eval suite (R6: no expiry; the auto-evaluate policy keeps
 *  suites current instead of a 30-day expiry that blocked launches) at the eval-gate depth; the Agents product needs a
 *  measured time horizon covering its tasks; commitments block only launches inside their own scope, judged on this
 *  candidate (B1/B2), and the reason names the clause; the charter's release block (FIN3b) comes before the eval gate. */
export function deployGate(s: GameStateV2, v: ModelVersion, channel: Channel, opts: GateOpts = {}): true | string {
  if (!CHANNEL_VARIANTS[channel].includes(v.variant)) return `${channel} needs a ${CHANNEL_VARIANTS[channel].join('/')} model`;
  if (v.status === 'retired' || v.status === 'rolledBack') return 'Version is retired';
  if (channel === 'open' && v.openDay !== undefined) return 'Its weights are already open';
  if (!external(channel)) return true;
  if (v.status === 'evaluating') return 'Still in evaluation';
  const review = oversightBlock(s, v); // W5: the oversight committee reviews a superhuman AI researcher before launch
  if (review) return review;
  // FIN3b (FINANCE-V3 §7.2): the charter's release block (nonprofit PBC safety committee; PBC + trust on open weights of
  // a capability-threshold model). Finance reaches the release path only here.
  const charter = charterReleaseBlock(s, v, channel);
  if (charter) return charter;
  // SR-19: the Safety framework (capability assessment, then its rules' holds) replaces the eval gate. RF-S13b: judged on
  // the candidate with the "Meet my framework" parts the framework adds as it goes live (deploy / swapDeployment), so
  // a rule refuses only what the package cannot meet.
  const cand = frameworkCandidate(s, v, channel, { safeguards: opts.safeguards ?? 'classifiers', guards: opts.guards ?? [] }, opts.frameworkApplied);
  const held = frameworkDeployBlock(s, v, channel, cand);
  if (held) return held;
  // MK-11: no time-horizon gate on a launch: Agent mode, a product tool, gates the agent-hours only (agentsGate in
  // worldfx/serving.ts productOffer).
  const block = commitmentDeployBlock(s, {
    versionId: v.id, channel, safeguards: cand.safeguards, usagePolicy: opts.usagePolicy ?? committedUsagePolicy(s, channel),
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
  const ok = deployGate(s, v, p.channel, { safeguards: p.safeguards ?? 'classifiers', guards: p.guards ?? [], usagePolicy });
  if (ok !== true) return ok;
  if (p.channel === 'internal') {
    setInternalAgent(s, v.id);
    return s.player.deployments.find((d) => d.channel === 'internal' && d.status === 'live') as Deployment;
  }
  const n = s.player.deployments.length + 1;

  // RD-B12 (B18) / MK-11: a relaunch takes over the retired product's sector certifications.
  const re = p.certs ? { certs: p.certs } : relaunchCerts(s, p.channel);
  const d: Deployment = {
    id: `D${n}${s.player.deployments.some((x) => x.id === `D${n}`) ? `-${s.time.day}` : ''}`, kind: kindOfChannel(p.channel),
    versionId: v.id, channel: p.channel, startDay: s.time.day, stance: p.stance ?? 'profit',
    servingShare: p.servingShare ?? DEFAULT_SERVING[p.channel], safeguards: p.safeguards ?? 'classifiers', guards: (p.guards ?? []).map((g) => ({ ...g })),
    certs: re.certs.map((x) => ({ ...x })), features: [...(p.features ?? [])],
    ...(p.monitorId ? { monitorId: p.monitorId } : {}), ...(p.lineup?.length ? { lineup: [...p.lineup] } : {}), ...(p.freeTierId ? { freeTierId: p.freeTierId } : {}),
    usagePolicy,
    kyc: p.kyc ?? (p.channel === 'api' ? 1 : 0), status: 'live',
  };
  s.player.deployments.push(d);
  if ('from' in re && re.from && d.certs.length) re.from.certs = [];
  if (v.status !== 'deployed') v.status = 'deployed';
  ctx.log('company', `${v.name} launched on ${p.channel}.`, p.channel === 'open' ? 3 : 1, d.id);
  applyFrameworkParts(s, d, ctx); // RF-S13b: the parts the gate counted on (frameworkCandidate)
  return d;
}

/** Replace the version behind a live deployment (keeps its settings). */
export function swapDeployment(s: GameStateV2, depId: string, versionId: string): string | undefined {
  const d = s.player.deployments.find((x) => x.id === depId);
  const v = versionById(s, versionId);
  if (!d || !v) return 'Unknown deployment or version';
  if (d.channel === 'open') return 'Open weights cannot be replaced';
  const ok = deployGate(s, v, d.channel, { safeguards: d.safeguards, guards: d.guards, usagePolicy: d.usagePolicy, frameworkApplied: d.frameworkApplied });
  if (ok !== true) return ok;
  d.versionId = v.id;
  d.versionSince = s.time.day;
  if (d.channel === 'internal') s.player.agents.capRoutine.versionId = v.id;
  if (v.status !== 'deployed') v.status = 'deployed';
  if (d.channel !== 'internal') applyFrameworkParts(s, d); // RF-S13b: the parts the gate counted on
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
    id: `D${s.player.deployments.length + 1}-int`, kind: 'internal', versionId: v.id, channel: 'internal', startDay: s.time.day, stance: 'profit', servingShare: 0,
    safeguards: 'standard', guards: [{ kind: 'review', since: s.time.day }], certs: [], features: [], usagePolicy: { noDropInReplacement: false, noSurveillance: false, noAutonomousWeapons: false, minorsProtections: false }, kyc: 0, status: 'live',
  });
  if (v.status === 'ready') v.status = 'deployed';
  return undefined;
}

/** RD-P05 (DD-02 a): release a version's weights openly. One-way: the version is marked open (openDay) and an open
 *  deployment of it goes live, which cannot be withdrawn or replaced. Its consequences run through that deployment:
 *  China absorbs the recipe gap above the open frontier (security.ts → openWeightsReleased), rivals distil it at full
 *  access at their next post-training (diffusion.ts, open access 1), and misuse reaches everyone with only the hazard
 *  filter as a safeguard (incidents.ts). The charter's release block and the eval gate apply (deployGate). */
export function releaseOpen(s: GameStateV2, ctx: SystemCtx, versionId: string): Deployment | string {
  const v = versionById(s, versionId);
  if (!v) return 'Unknown version';
  const d = deploy(s, ctx, { versionId: v.id, channel: 'open' });
  if (typeof d === 'string') return d;
  v.openDay = s.time.day;
  return d;
}

/** Retire a version (not if it powers the internal agent, a live deployment or the stream). Old retired versions
 *  beyond the latest 12 are compacted to summary fields (§2.5 budget). */
export function retireVersion(s: GameStateV2, versionId: string): string | undefined {
  const v = versionById(s, versionId);
  if (!v) return 'Unknown version';
  if (Object.values(s.player.agents).some((a) => a.versionId === v.id || a.monitorId === v.id)) return 'Powers or monitors internal agents';
  if (s.player.models.stream?.versionId === v.id) return 'Is the continual-learning stream';
  if (s.player.deployments.some((d) => d.versionId === v.id && d.status !== 'withdrawn')) return 'Has live deployments';
  if (s.player.deployments.some((d) => d.status !== 'withdrawn' && (d.monitorId === v.id || (d.lineup ?? []).includes(v.id)))) return 'Monitors a live product or is in its lineup';
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

/** Distillation access of a receiving lab: China 1 (its distillation-access meter at its start value 60, /60; the meter
 *  went with the China actor, W1d; W6 may bring a lever back); US rivals 0.3 (§3.3.5). */
export function distillationAccess(_s: GameStateV2, lab: LabId): number {
  return lab === CHINA_ID ? 1 : 0.3;
}

/**
 * RD-X04: the G lab X's next post-training would take from distilling the player's external deployments (rule B,
 * production/diffusion.ts distillLift with the player's products as the only teachers; the lift applies at X's
 * post-training, not daily), and the best open-weights G among them (absorbed outright by WS4's security system).
 */
export function distillationLeak(s: GameStateV2, lab: LabId): { dG: number; openG: number; openRecG?: number } {
  const x = rivalLab(s, lab);
  if (!x) return { dG: 0, openG: -Infinity };
  let openG = -Infinity;
  let openRecG: number | undefined; // RD-X04b: the recipe the best open version reveals (its recG stamp)
  for (const d of s.player.deployments) {
    if (d.status !== 'live' || d.channel !== 'open') continue;
    const v = versionById(s, d.versionId);
    if (v && v.G > openG) {
      openG = v.G;
      openRecG = v.recG;
    }
  }
  return { dG: distillLift(s, lab, bestG(s, lab), x.internal.params ?? B0_PARAMS, true).dG, openG, openRecG };
}
