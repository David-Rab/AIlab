// Commitments: predicates, signing, breaks, amendments, statutory floors (V2-SPEC §3.9.4). Owner: WS4.
//
// A predicate returns TRUE when the commitment currently BINDS against the player's state: something the player
// did (or is doing) would violate it. The director raises E30 (Honour / Amend / Break) for live commitments whose
// predicate is true; other workstreams can call `blockingCommitments` before an action to telegraph the cost.
import type { Commitment, DomainId, GameStateV2, ModelVersion, SystemCtx, TrainingRun } from '../types';
import { cash } from './fx';
import { lawsInForce } from '../../../data/v2/laws';
import { ws4r } from './state';
import { approvalPush, PUBLIC } from '../world/public';

export type CommitmentPredicate = (s: GameStateV2, params: Commitment['condition']['params'], c?: Commitment) => boolean;

/** Every product but internal use is an external deployment; Vetted too (MARKET.md M10). */
const external = (ch: string) => ch !== 'internal';
const versionOf = (s: GameStateV2, id: string): ModelVersion | undefined => s.player.models.versions.find((v) => v.id === id);

/** Run that breaks the monitorability pledge: latent base, latent CoT post, or CoT-pressured post. */
export const pledgeBreachRun = (r: TrainingRun) => r.base?.shape === 'latent' || r.post?.cot === 'latent' || r.post?.cot === 'pressured';

/** Version that reasons latently: latent CoT, or built on a latent-shape base. */
export function latentVersion(s: GameStateV2, id: string): boolean {
  const v = versionOf(s, id);
  if (!v) return false;
  return v.design.cot === 'latent' || s.player.models.bases.find((b) => b.id === v.baseId)?.design.shape === 'latent';
}

/** Measured domain level (RD-M01, DD-08): the fit of the domain's benchmark scores at the last suite (every domain has a
 *  row since RD-M01b). Fallback for a record with no fit for the domain (no suite yet, or a suite saved before RD-M01b
 *  had MEDIA / PHYS rows): the measured general level + the version's domain offset. */
export function measuredDomain(v: ModelVersion, d: DomainId): number {
  const fit = v.evals.measuredDom?.[d];
  if (fit !== undefined) return fit;
  const mL = v.evals.measuredL ?? v.Lg;
  return mL + (v.domains[d] - v.Lg);
}

/** A launch or swap checked by the deploy gate, with the safeguards and usage policy the deployment will have. */
export interface DeployCandidate {
  versionId: string;
  channel: string;
  safeguards: string;
  usagePolicy: { noSurveillance: boolean; noAutonomousWeapons: boolean };
}

/** Scope of each commitment over launches (B1): only these predicates can block a deploy or swap, and only on the
 *  channels they cover. The others (published Safety framework: its own holds, safety/framework.ts; incident reporting,
 *  whistleblower, community pledge) never do. */
export const DEPLOY_SCOPE: Record<string, (channel: string) => boolean> = {
  preDeployTesting: external,
  monitorabilityPledge: (ch) => ch !== 'internal',
  noSurveillance: (ch) => ch === 'vetted', // the usage terms are Vetted's (M10; MK-1 moved them from Government)
  noAutonomousWeapons: (ch) => ch === 'vetted',
};

/** The clause a candidate launch breaks under one commitment, or undefined (kept, or outside its scope). */
export function deployClause(s: GameStateV2, c: Commitment, cand: DeployCandidate): string | undefined {
  const pred = c.condition.predicate;
  if (!DEPLOY_SCOPE[pred]?.(cand.channel)) return undefined;
  const p = c.condition.params;
  const v = versionOf(s, cand.versionId);
  if (!v) return undefined;
  switch (pred) {
    case 'preDeployTesting': {
      const days = Number(p.days ?? 21);
      const left = days - (s.time.day - v.day);
      return v.day > c.signedDay && left > 0 ? `external launches wait ${days} days for government testing (${left} d left)` : undefined;
    }
    case 'monitorabilityPledge':
      return latentVersion(s, v.id) ? `no release of a latent-reasoning model (${v.name})` : undefined;
    case 'noSurveillance':
      return cand.usagePolicy.noSurveillance ? undefined : 'Vetted products need the no-surveillance usage policy';
    case 'noAutonomousWeapons':
      return cand.usagePolicy.noAutonomousWeapons ? undefined : 'Vetted products need the no-autonomous-weapons usage policy';
    default:
      return undefined;
  }
}

/** The first live commitment a candidate launch would break, as `Blocked by "<title>": <clause>`, or undefined. */
export function commitmentDeployBlock(s: GameStateV2, cand: DeployCandidate): string | undefined {
  for (const c of liveCommitments(s)) {
    const why = deployClause(s, c, cand);
    if (why) return `Blocked by "${c.title}": ${why}`;
  }
  return undefined;
}

/** Usage policy a new deployment on `channel` starts with: live usage commitments apply as written (a Vetted
 *  product under "no mass surveillance or autonomous weapons" gets both clauses), so keeping them needs no extra step. */
export function committedUsagePolicy(s: GameStateV2, channel: string): DeployCandidate['usagePolicy'] {
  const gov = channel === 'vetted';
  return {
    noSurveillance: gov && hasCommitment(s, 'noSurveillance'),
    noAutonomousWeapons: gov && (hasCommitment(s, 'noAutonomousWeapons') || hasCommitment(s, 'noSurveillance')),
  };
}

/** Predicate registry by id; true = the commitment currently BLOCKS/binds. */
export const PREDICATES: Record<string, CommitmentPredicate> = {
  /** RF-S2: the published Safety framework (A3). Never binds here: its rules hold launches and training themselves
   *  (safety/framework.ts) and an override is the departure, costed there (credibility once published). */
  safetyFramework: () => false,
  /** External launch must wait `days` for an evaluator slot. */
  preDeployTesting: (s, p, c) => {
    const days = Number(p.days ?? 21);
    const since = c?.signedDay ?? 0;
    // Gate check for a candidate launch (deployGate passes versionId/channel): the version must be `days` old.
    if (p.versionId !== undefined) {
      const v = versionOf(s, String(p.versionId));
      return !!v && external(String(p.channel ?? 'api')) && v.day > since && s.time.day - v.day < days;
    }
    // Standing check: a live external deployment whose current version went in before its testing window closed,
    // while that window is still open (M4 fix: a swap keeps startDay, so the old startDay − v.day test bound forever
    // after the first swap and blocked every later launch).
    return s.player.deployments.some((d) => {
      if (d.status !== 'live' || !external(d.channel)) return false;
      const v = versionOf(s, d.versionId);
      const inSince = d.versionSince ?? d.startDay;
      return !!v && v.day > since && inSince >= since && inSince - v.day < days && s.time.day - v.day < days;
    });
  },
  /** No latent reasoning and no CoT-pressure runs after signing (F31 / E11 / WS2 safety.pledge): binds when a
   *  latent-reasoning base (shape 'latent') or post (cot 'latent'), or a CoT-pressured post, was launched since
   *  signing and not cancelled (a failed run produced nothing), or a latent version was released (any non-internal
   *  channel) since signing. Internal use of a version that predates the pledge is grandfathered. */
  monitorabilityPledge: (s, _p, c) => {
    const since = c?.signedDay ?? 0;
    if (s.player.models.runs.some((r) => r.startDay >= since && r.status !== 'cancelled' && r.status !== 'failed' && pledgeBreachRun(r))) return true;
    return s.player.deployments.some((d) => d.status !== 'withdrawn' && d.channel !== 'internal' && d.startDay >= since && latentVersion(s, d.versionId));
  },
  noSurveillance: (s) => s.player.deployments.some((d) => d.status === 'live' && d.channel === 'vetted' && !d.usagePolicy.noSurveillance),
  noAutonomousWeapons: (s) => s.player.deployments.some((d) => d.status === 'live' && d.channel === 'vetted' && !d.usagePolicy.noAutonomousWeapons),
  /** Statutory or voluntary: no covered-up incident, and public incidents reported within `hours`. */
  incidentReporting: (s, p, c) => {
    const days = Number(p.hours ?? 360) / 24;
    const since = c?.signedDay ?? 0;
    return s.player.safety.incidents.some((i) => i.day >= since && (i.status === 'covered' || (i.status === 'open' && i.exposure !== 'internal' && s.time.day - i.day > days)));
  },
  /** A6: an internal report left past its deadline. */
  whistleblower: (s) => {
    const r = ws4r(s).internalReport;
    return !!r && s.time.day > r.deadline;
  },
  /** F1: pay own power and grid costs: every new site needs a community package. */
  communityPledge: (s) => s.player.sites.some((x) => x.stage !== 'blocked' && !x.communityPackage && x.stage !== 'live'),
};

export function liveCommitments(s: GameStateV2): Commitment[] {
  return s.commitments.filter((c) => c.status === 'live');
}

/** Live commitments whose predicate currently binds (UI: the Obligations panel; others: before an action). */
export function blockingCommitments(s: GameStateV2): Commitment[] {
  return liveCommitments(s).filter((c) => PREDICATES[c.condition.predicate]?.(s, c.condition.params, c));
}

export function hasCommitment(s: GameStateV2, predicate: string): boolean {
  return s.commitments.some((c) => c.status === 'live' && c.condition.predicate === predicate);
}

/** RF-S2: the Safety framework is published when the lab's framework commitment (A3, kind 'framework') is live; by kind,
 *  so a card signed before RF-S2 (the old BIO ≥ 10 pledge, kind 'framework') still counts. */
export const frameworkPublished = (s: GameStateV2) => s.commitments.some((c) => c.status === 'live' && c.kind === 'framework');

/** Sign a commitment card (§3.9.4). Returns the card; re-signing an identical live card is a no-op. */
export function signCommitment(
  s: GameStateV2, ctx: SystemCtx, kind: Commitment['kind'], title: string, predicate: string,
  params: Commitment['condition']['params'],
): Commitment {
  const existing = s.commitments.find((c) => c.status === 'live' && c.condition.predicate === predicate && JSON.stringify(c.condition.params) === JSON.stringify(params));
  if (existing) return existing;
  const c: Commitment = {
    id: `C${s.commitments.length + 1}`, kind, title, condition: { predicate, params },
    signedDay: s.time.day, status: 'live', amendments: 0,
  };
  s.commitments.push(c);
  ctx.log('company', `Commitment signed: ${title}.`, 1, c.id);
  return c;
}

/** WS2's monitorability flag (obfuscation growth −50%, "Already pledged") lasts only while a live pledge card does. */
function pledgeEnded(s: GameStateV2) {
  if (!hasCommitment(s, 'monitorabilityPledge')) s.player.safety.monitorabilityCommitment = false;
}

/** Break: a public pledge broken costs approval (x attention; W4); W5 adds government trust. */
export function breakCommitment(s: GameStateV2, ctx: SystemCtx, c: Commitment) {
  c.status = 'broken';
  pledgeEnded(s);
  ctx.log('company', `You broke a commitment: ${c.title}.`, 3, c.id);
  approvalPush(s, ctx, PUBLIC.pledgeBroken, `Pledge broken: ${c.title}`);
}

/** Amend ("moving goalposts", E30); after the trigger fired it is a break. */
export function amendCommitment(s: GameStateV2, ctx: SystemCtx, c: Commitment, triggered: boolean) {
  if (triggered) return breakCommitment(s, ctx, c);
  c.status = 'amended';
  c.amendments++;
  pledgeEnded(s);
  ctx.headline('goalposts', `${s.player.name} quietly rewrites its safety pledge.`);
}

/** Share of commitments kept (live or kept) — Freedom/democratic outcome rule (§5.2). 1 if none signed. */
export function keptShare(s: GameStateV2): number {
  if (!s.commitments.length) return 1;
  return s.commitments.filter((c) => c.status === 'live' || c.status === 'kept').length / s.commitments.length;
}

/** Statutory floors (§3.9.4, research/17 §1.7): SB 53 15-day / RAISE 72-hour reporting. A covered-up incident
 *  under statute is a legal fine; checked daily by actorsDaily; the laws by date from data/v2/laws.ts. */
export function statutoryDaily(s: GameStateV2, ctx: SystemCtx) {
  const st = lawsInForce(s);
  if (!st.sb53 && !st.raise) return;
  const hours = st.raise ? 72 : 360;
  for (const i of s.player.safety.incidents) {
    if (i.exposure === 'internal' || i.severity < 3) continue;
    const late = i.status === 'covered' || (i.status === 'open' && ctx.day - i.day > hours / 24);
    const key = `stat:${i.id}`;
    if (!late || s.flags[key]) continue;
    s.flags[key] = true;
    cash(s, ctx, st.raise ? -0.003 : -0.001, 'statutory fine', st.raise ? 'RAISE' : 'SB 53');
    ctx.log('gov', 'Regulators fine you for a late incident report.', 3);
  }
}
