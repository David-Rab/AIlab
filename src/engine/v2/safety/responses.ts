// Response menu per incident or believed finding, cause-aware (SAFETY-REDESIGN §3.7, SR-18). Owner: WS2.
// What the player can do depends on the BELIEVED cause (the incident's apparent source after any case, or the trait a
// response names): a training signal → a hardening pass on that family's environments (RF-S8: one verb, Harden); a
// trait in the model → a method for later runs, roll back, restrict, safeguards; misuse → product-side restriction; a located foothold → remove it; unknown → contain. Disclosure
// is a separate policy (legal minimum by default, OD-8) with a per-incident override; fixing never closes it.
import { LOCKDOWN_SLOWDOWN, addSafeguard, controlOn, isRestricted, labControlSetting, lockdownOnDep, removeSafeguard, setControl } from './safeguards';
import { CRITICAL_TRAITS } from '../../../data/v2/traits';
import type { DisclosurePolicy, GameStateV2, Incident, ModelVersion, ResponseKind, RLFamily, SystemCtx, TechniqueId, TraitId, UModeId } from '../types';
import { exploitFloor, queueSuiteWork, suiteExploitMap } from '../models/suites';
import { flagNum, setFlag, versionById } from './common';
import { measuredOom } from './oversight';
import { strengthBelieved, techniqueRole } from './techniques';
import { revealToWorld } from './umodes';
import { ownedMethods } from './methods';
import { removeFoothold } from './footholdDetection';
import { AGENT_USES } from '../../../data/v2/agents';
import { agentVersion, syncInternalControl } from '../departments/agents';

export const RESPONSE_INFO: Record<ResponseKind, { title: string; note: string }> = {
  patchSignal: { title: 'Harden environments', note: 'Harden the RL environments of one family (the Harden pass of Training › Environments): expert red-teamers close the holes in its graders, cutting the share of gameable tasks by 40% of what is left above the floor (10% of the family’s start share) on every later run that trains on it. Cash and engineer team-weeks; in force when the pass is done.' },
  addMethod: { title: 'Add method to later runs', note: 'Every later run plan that takes the default methods lists this owned safety method (persona vectors, anti-scheming, inoculation…); its effect shows in the next run\'s predicted traits, not in this model.' },
  restrictContext: { title: 'Restrict context', note: 'Restricted products: usage, revenue, misuse reach and incident opportunity × 0.3.' },
  liftRestriction: { title: 'Lift restriction', note: 'Remove the restriction safeguard: usage, revenue, misuse reach and incident opportunity back to full.' },
  addControl: { title: 'Add control protocol', note: 'Control-protocol safeguard (trusted monitoring, defer 10% to trusted): about 7% of the work lost at a 1-OOM trusted gap; acts slipping past monitors ×0.45; AI-control tools block.' },
  removeControl: { title: 'Remove control protocol', note: 'Remove the control-protocol safeguard: its slowdown ends; blocking and deferral end with it.' },
  addLockdown: { title: 'Add comms lockdown', note: `Comms-lockdown safeguard on the model's internal agents (shared memory bank locked): the same-lineage collusion penalty halves; ${Math.round(LOCKDOWN_SLOWDOWN * 100)}% of internal AI work lost.` },
  removeLockdown: { title: 'Remove comms lockdown', note: 'Remove the comms-lockdown safeguard: its slowdown ends; the collusion penalty is back to full.' },
  rollback: { title: 'Roll back', note: 'Return to the checkpoint version; lose the newer model.' },
  removeFoothold: { title: 'Remove foothold', note: 'A located foothold: safety research engineers busy while it runs, agents off for the downtime; its effect ends (model v3 E8).' },
};

/** The family the environment-fix response hardens: the one asked for (if the lab has its environments), else the
 *  family whose environments reward the most hacks now (highest exploitability). */
export function hardenFamily(s: GameStateV2, family?: RLFamily): RLFamily | undefined {
  const x = suiteExploitMap(s);
  if (family) return x[family] !== undefined ? family : undefined;
  let best: RLFamily | undefined;
  for (const [f, v] of Object.entries(x) as [RLFamily, number][]) if (best === undefined || v > (x[best] ?? 0)) best = f;
  return best;
}

function lineageOf(s: GameStateV2, v: ModelVersion): string {
  return s.player.models.bases.find((b) => b.id === v.baseId)?.lineage ?? 'L-unknown';
}

/** The trait a response acts on: explicit, the incident's apparent trait, or the most-believed critical trait. */
export function responseTrait(v: ModelVersion, inc?: Incident, trait?: TraitId): TraitId {
  if (trait) return trait;
  if (inc && inc.apparent !== 'unexplained' && inc.apparent !== 'misuse') return inc.apparent;
  return CRITICAL_TRAITS.reduce((a, b) => ((v.beliefs[b]?.est ?? 0) > (v.beliefs[a]?.est ?? 0) ? b : a), CRITICAL_TRAITS[0]);
}

/** Best active detector covering a trait (by believed strength): the default "train against" target. F6e: at the
 *  measured capability (was the true OOM), so the Respond preview names the detector apply picks. */
export function bestDetector(s: GameStateV2, v: ModelVersion, trait: TraitId): string | undefined {
  const X = measuredOom(s, v);
  let best: string | undefined;
  let bd = 0;
  for (const t of Object.values(s.player.safety.techniques)) {
    if (!t.unlocked || !t.active || techniqueRole(t) === 'fix') continue;
    const d = (t.coverage[trait] ?? 0) * strengthBelieved(s, t, X);
    if (d > bd) {
      bd = d;
      best = t.id;
    }
  }
  return best;
}

/** G penalty (OOM) the next post-run should pay (a foothold removal, footholdDetection.ts). WS1 reads and consumes it. */
export function pendingRunPenalty(s: GameStateV2): number {
  return flagNum(s, 'runPenalty');
}
export function consumeRunPenalty(s: GameStateV2): number {
  const p = flagNum(s, 'runPenalty');
  if (p) setFlag(s, 'runPenalty', 0);
  return p;
}


// ───────────── SR-18: believed cause → the responses offered ─────────────

/** What the player believes caused an incident (or a finding on a trait). */
export type BelievedCause = 'signal' | 'trait' | 'misuse' | 'foothold' | 'unknown';
/** Traits whose believed cause is a training signal (an exploitable environment, grader or reward model). */
const SIGNAL_TRAITS: readonly TraitId[] = ['RH', 'TGAME', 'PROXY'];

/** The believed cause from what the player can see: the incident's apparent source (a case may have named it), a located
 *  foothold of the model's lineage, else the trait the response is about. Never reads trueSource or true traits. */
export function believedCause(s: GameStateV2, v: ModelVersion, inc?: Incident, trait?: TraitId): BelievedCause {
  if (inc?.apparent === 'misuse') return 'misuse';
  const lin = lineageOf(s, v);
  if (s.player.safety.footholds.some((f) => f.status === 'detected' && f.lineage === lin)) return 'foothold';
  if (inc?.apparent === 'unexplained' && !trait) return 'unknown';
  const k = trait ?? (inc && inc.apparent !== 'unexplained' ? (inc.apparent as TraitId) : undefined);
  if (!k) return 'unknown';
  return SIGNAL_TRAITS.includes(k) ? 'signal' : 'trait';
}

/** Responses offered per believed cause (§3.7 table). Safeguard off-switches (lift / remove) are not cause responses:
 *  they stay available on the safeguards themselves. */
export const CAUSE_RESPONSES: Record<BelievedCause, ResponseKind[]> = {
  signal: ['patchSignal'],
  trait: ['addMethod', 'rollback', 'restrictContext', 'addControl', 'addLockdown'],
  misuse: ['restrictContext'],
  foothold: ['removeFoothold', 'restrictContext', 'addControl', 'addLockdown'],
  unknown: ['restrictContext', 'addControl'],
};
export const UNDO_RESPONSES: readonly ResponseKind[] = ['liftRestriction', 'removeControl', 'removeLockdown'];
export const CAUSE_LABEL: Record<BelievedCause, string> = {
  signal: 'a training signal (an exploitable environment, grader or reward model)',
  trait: 'a trait in this model',
  misuse: 'misuse by a user',
  foothold: 'a located foothold',
  unknown: 'unknown (a case can name it; contain meanwhile)',
};

/** The cause-aware response list for a model (and incident): the cause, its responses, and whether a case would help. */
export function responseOptions(s: GameStateV2, v: ModelVersion, inc?: Incident, trait?: TraitId): { cause: BelievedCause; label: string; kinds: ResponseKind[]; investigate: boolean } {
  const cause = believedCause(s, v, inc, trait);
  return { cause, label: CAUSE_LABEL[cause], kinds: CAUSE_RESPONSES[cause], investigate: cause === 'unknown' || (!!inc && inc.status === 'open') };
}

/** Owned safety methods that act on a trait (the "method for later runs" response), strongest fit first. */
const METHOD_TRAITS: Record<string, readonly TraitId[]> = {
  'T-ANTISCHEME': ['SCHEME', 'AF', 'SAND', 'CONCEAL'],
  'T-INOC': ['PERSONA', 'RH', 'CONCEAL', 'PROXY', 'SAND', 'SCHEME', 'AF'],
  'T-PERSONA': ['SYC', 'PERSONA'],
  'T-CAST': ['POWER', 'AF', 'SUCC'],
  'T-W2S': ['SYC', 'PROXY'],
  'T-CONFESS': ['CONCEAL', 'TGAME', 'EA'],
};
export function methodsFor(s: GameStateV2, trait: TraitId): TechniqueId[] {
  return ownedMethods(s).filter((m) => METHOD_TRAITS[m]?.includes(trait));
}
/** The method the addMethod response adds: the one asked for (if owned and fitting), else the first fitting one not
 *  already required. */
export function methodChoice(s: GameStateV2, trait: TraitId, id?: string): TechniqueId | undefined {
  const fit = methodsFor(s, trait);
  if (id) return fit.includes(id as TechniqueId) ? (id as TechniqueId) : undefined;
  const req = new Set(s.player.safety.requiredMethods ?? []);
  return fit.find((m) => !req.has(m)) ?? fit[0];
}

/** The live external deployments Restrict context restricts (the incident's own deployment when it names one). */
export function restrictTargets(s: GameStateV2, v: ModelVersion, inc?: Incident) {
  return s.player.deployments.filter((d) => d.versionId === v.id && d.status === 'live' && !isRestricted(d) && d.channel !== 'internal' && (!inc?.deploymentId || d.id === inc.deploymentId));
}

/** Disclosure's trust change per counterparty at today's credibility (below 30 it costs trust, §3.9.1), after the
 *  counterparty's trust level (gains shrink near 100, losses grow). */
export const DISCLOSE_CPS = ['evalGov', 'exec', 'evalIndep'] as const;
export function discloseTrust(s: GameStateV2, cp: (typeof DISCLOSE_CPS)[number]): number {
  const T = s.relations.stocks[cp]?.trust ?? 50;
  const base = (3 * (s.relations.credibility - 30)) / 40;
  return base >= 0 ? base * (1 - T / 100) : base * (1 + T / 100);
}
export const discloseScrutiny = (inc?: Incident) => 3 + 2 * (inc?.severity ?? 2);

export interface ResponseOpts { trait?: TraitId; techniqueId?: string; /** removeFoothold: the located foothold. */ footholdId?: string; /** patchSignal (SR-16): the RL family to fix. */ family?: RLFamily }

/**
 * Apply a response to a version (and optionally an incident). Returns an error string if it cannot apply, or if the
 * response is not one offered for the believed cause (SR-18). Disclosure is separate (disclosureStep).
 */
export function applyResponse(s: GameStateV2, ctx: SystemCtx, kind: ResponseKind, versionId: string, incidentId?: string, opts: ResponseOpts = {}): string | undefined {
  if (kind === 'removeFoothold') return removeFoothold(s, ctx, opts.footholdId ?? '');
  const v = versionById(s, versionId);
  if (!v) return 'Unknown model';
  const inc = incidentId ? s.player.safety.incidents.find((i) => i.id === incidentId) : undefined;
  if (incidentId && !inc) return 'Unknown incident';
  const trait = responseTrait(v, inc, opts.trait);
  // SR-18: only the responses for the believed cause apply (safeguard off-switches always do).
  const opt = responseOptions(s, v, inc, opts.trait);
  if (!UNDO_RESPONSES.includes(kind) && !opt.kinds.includes(kind)) return `not a response to ${opt.label}`;
  switch (kind) {
    case 'patchSignal': {
      // RF-S8: the environment fix is a hardening pass on the family's suite (models/suites.ts queueSuiteWork, the
      // suite.harden verb): one cost model (cash + engineer team-weeks), one floor (exploitFloor). Every later run that
      // trains on the family freezes the hardened exploitability at launch; runs not on the family are unchanged.
      const f = hardenFamily(s, opts.family);
      if (!f) return 'No environments of that family';
      const busy = queueSuiteWork(s, ctx, f, 'harden');
      if (busy) return busy;
      break;
    }
    case 'addMethod': {
      // SR-18: a method for later runs (SR-14 methods): every later default run plan lists it (safety/methods.ts
      // defaultMethods); its effect is the run's, shown in that run's preview and predicted traits. No instant change.
      const m = methodChoice(s, trait, opts.techniqueId);
      if (!m) return 'No owned method acts on this trait';
      const req = (s.player.safety.requiredMethods ??= []);
      if (!req.includes(m)) req.push(m);
      break;
    }
    case 'restrictContext': {
      const deps = restrictTargets(s, v, inc);
      if (!deps.length) return 'No live external deployment of this model';
      for (const d of deps) addSafeguard(s, d, 'restrict');
      break;
    }
    case 'liftRestriction': {
      const deps = s.player.deployments.filter((d) => d.versionId === v.id && isRestricted(d) && (!inc?.deploymentId || d.id === inc.deploymentId));
      if (!deps.length) return 'No restricted deployment of this model';
      for (const d of deps) removeSafeguard(d, 'restrict');
      break;
    }
    case 'addControl': {
      // RD-A06: products on the model and every agent package running it (the control layer is per package).
      const deps = s.player.deployments.filter((d) => d.versionId === v.id && d.status !== 'withdrawn');
      const uses = AGENT_USES.filter((u) => agentVersion(s, u)?.id === v.id);
      if (!deps.length && !uses.length) return 'Model is not deployed';
      for (const d of deps) setControl(d, true, labControlSetting(s), s.time.day);
      for (const u of uses) s.player.agents[u].control = true;
      syncInternalControl(s);
      break;
    }
    case 'removeControl': {
      const deps = s.player.deployments.filter((d) => d.versionId === v.id && d.status !== 'withdrawn' && controlOn(d));
      const uses = AGENT_USES.filter((u) => s.player.agents[u].control && agentVersion(s, u)?.id === v.id);
      if (!deps.length && !uses.length) return 'No control layer on this model';
      for (const d of deps) setControl(d, false);
      for (const u of uses) s.player.agents[u].control = false;
      syncInternalControl(s);
      break;
    }
    case 'addLockdown': {
      const deps = s.player.deployments.filter((d) => d.versionId === v.id && d.channel === 'internal' && d.status === 'live');
      if (!deps.length) return 'No internal agent package runs this model';
      for (const d of deps) {
        const why = addSafeguard(s, d, 'lockdown');
        if (why) return why;
      }
      break;
    }
    case 'removeLockdown': {
      const deps = s.player.deployments.filter((d) => d.versionId === v.id && lockdownOnDep(d));
      if (!deps.length) return 'No comms lockdown on this model';
      for (const d of deps) removeSafeguard(d, 'lockdown');
      break;
    }
    case 'rollback': {
      const parent = versionById(s, v.parentVersionId);
      if (!parent || parent.status === 'retired') return 'No checkpoint to roll back to';
      for (const d of s.player.deployments) if (d.versionId === v.id) d.versionId = parent.id;
      for (const a of Object.values(s.player.agents)) {
        if (a.versionId === v.id) a.versionId = parent.id;
        if (a.monitorId === v.id) a.monitorId = parent.id;
      }
      if (s.player.models.stream?.versionId === v.id) delete s.player.models.stream;
      v.status = 'rolledBack';
      break;
    }
  }
  if (inc) {
    inc.responses.push(kind);
    // SR-18: a fix resolves the incident's handling but never its disclosure: an incident with a public timer stays open
    // until the timer ends or it is disclosed (the disclosure policy decides; a fix is not a quiet cover-up).
    if ((inc.status === 'open' || inc.status === 'investigating') && inc.publicTimerDays === undefined) inc.status = 'resolved';
  }
  ctx.log('company', `${RESPONSE_INFO[kind].title}: ${v.name}${inc ? ` (incident ${inc.id})` : ''}, ${trait}.`, 2, inc?.id ?? v.id);
  return undefined;
}

// ───────────── SR-18: disclosure, a separate policy (OD-8: legal minimum by default) ─────────────

export const DISCLOSURE_POLICIES: readonly DisclosurePolicy[] = ['legal', 'full', 'none'];
export const DISCLOSURE_LABEL: Record<DisclosurePolicy, string> = { legal: 'Legal minimum', full: 'Full', none: 'None' };
export const disclosurePolicy = (s: GameStateV2): DisclosurePolicy => s.player.safety.disclosure ?? 'legal';

/** Must this incident be reported by law (statutoryDaily's rule: SB 53 / RAISE in force, not internal, severity ≥ 3)? */
export function mustReport(s: GameStateV2, inc: Incident): boolean {
  return (s.gov.statutes.sb53 || s.gov.statutes.raise) && inc.exposure !== 'internal' && inc.severity >= 3;
}
/** Will the lab disclose this incident: the per-incident override, else the policy (legal = only what must be reported). */
export function willDisclose(s: GameStateV2, inc: Incident): boolean {
  if (inc.disclose) return inc.disclose === 'yes';
  const p = disclosurePolicy(s);
  return p === 'full' ? inc.exposure !== 'internal' || inc.severity >= 3 : p === 'legal' ? mustReport(s, inc) : false;
}
/** Incidents whose disclosure is still to apply (a new incident is decided the day it appears; the override action applies at once). */
const undecided = (inc: Incident) => inc.status === 'open' || inc.status === 'investigating';

/** The per-incident override (player): 'yes' discloses now; 'no' withholds (a cover-up if it must be reported); 'policy' clears it. */
export function setIncidentDisclosure(s: GameStateV2, ctx: SystemCtx, inc: Incident, choice: 'yes' | 'no' | 'policy'): string | undefined {
  if (inc.status === 'disclosed' || inc.status === 'leaked') return 'Already public';
  if (choice === 'policy') delete inc.disclose;
  else inc.disclose = choice;
  if (willDisclose(s, inc)) discloseIncident(s, ctx, inc);
  else if (mustReport(s, inc) && inc.status !== 'covered') {
    inc.status = 'covered';
    ctx.log('company', 'Incident ' + inc.id + ' withheld: a cover-up under SB 53 / RAISE.', 3, inc.id);
  }
  return undefined;
}

/** Disclose an incident: scrutiny 3 + 2·severity, trust per evaluator / exec by credibility, the world learns the
 *  discovered failure mode it shows, its public timer ends. */
export function discloseIncident(s: GameStateV2, ctx: SystemCtx, inc: Incident): void {
  ctx.bump('relations.scrutiny', discloseScrutiny(inc), 'disclosure', inc.id);
  for (const cp of DISCLOSE_CPS) ctx.bump(`trust:${cp}`, discloseTrust(s, cp), 'disclosure', inc.id);
  if (typeof inc.trueSource === 'string' && s.player.safety.discoveredUModes.includes(inc.trueSource as UModeId)) revealToWorld(s, inc.trueSource as UModeId);
  inc.status = 'disclosed';
  delete inc.publicTimerDays;
  ctx.log('company', `Incident ${inc.id} disclosed to government and evaluators.`, 2, inc.id);
}

/** Daily (incidents step): apply each undecided incident's disclosure. Disclose → discloseIncident. Not disclosing a
 *  must-report incident is the explicit cover-up (status 'covered': statutory fine, and ×3 if outsiders find it);
 *  not disclosing anything else lets its public timer run (it leaks at ×1.5 if outsiders find it first). */
export function disclosureStep(s: GameStateV2, ctx: SystemCtx): void {
  for (const inc of s.player.safety.incidents) {
    if (!undecided(inc)) continue;
    if (willDisclose(s, inc)) discloseIncident(s, ctx, inc);
    else if (mustReport(s, inc)) {
      inc.status = 'covered';
      ctx.log('company', `Incident ${inc.id} not reported (disclosure ${inc.disclose === 'no' ? 'withheld' : 'policy none'}): a cover-up under SB 53 / RAISE.`, 3, inc.id);
    }
  }
}


/** The family the environment-fix response would harden, its exploitability now and its hardening floor: the response
 *  card's "diminishing fixes" readout (LIMITS response.hardenFloor). */
export function hardenLevel(s: GameStateV2, family?: RLFamily): { family?: RLFamily; exploit: number; floor: number; atFloor: boolean } {
  const f = hardenFamily(s, family);
  const exploit = f ? suiteExploitMap(s)[f] ?? 0 : 0;
  const floor = f ? exploitFloor(f) : 0;
  return { family: f, exploit, floor, atFloor: !!f && exploit <= floor + 1e-9 };
}
