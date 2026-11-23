// SR-19: the Safety framework (SAFETY-REDESIGN §3.8, OD-5): the lab's own rules, modelled on the published frontier
// safety frameworks (data/v2/framework.ts). Owner: WS2.
//
//   rule       trigger on a MEASURED domain level (the benchmark fit, actors/commitments.measuredDomain; RD-M01) or on a
//              believed trait (the upper end of a red-flag trait's 90% range, RF-S1) → required safeguards and evidence.
//   hold       a rule whose trigger is met and whose requirements are not, and that the player has not overridden for
//              that version. Deploy holds: an external launch or swap of the version is refused (deployGate) and a live
//              external deployment serves nobody while held (productUsageMult 0). Training holds: frontier (base / post)
//              runs cannot start, running ones pause, frontier experiments stop (models/runs.frontierPaused).
//   package    RF-S13: before the holds are refreshed each day, the framework applies its "Meet my framework" package
//              to live deployments a triggered rule asks safeguards of (safety/packages.ts autoApplyPackages, which also
//              holds the daily frameworkSystem); a hold remains for what the package cannot meet (evidence: an eval suite,
//              an external evaluation) or a part the player removed afterwards.
//   override   explicit, per rule and version; its consequences are stated in the preview and applied as stated
//              (safety morale, one red flag, scrutiny, credibility when the framework is published).
//   base rule  every external release needs a capability assessment: a suite at `evalDepth` (none = no release
//              suite) and, with `externalReview`, external evaluators' reading (replaces the eval gate).
// Holds read only what the player can see (measured levels, beliefs, owned safeguards), never truth.
import type { Deployment, FrameworkHold, FrameworkRule, GameStateV2, ModelVersion, SafetyFramework, SystemCtx } from '../types';
import { defaultFramework, EVIDENCE_NEED_LABEL, OVERRIDE_COST, SAFEGUARD_NEED_LABEL } from '../../../data/v2/framework';
import { frameworkPublished, measuredDomain } from '../actors/commitments';
import { ws4, ws4r } from '../actors/state';
import { RED_FLAG_TRAITS } from './common';
import { beliefHi } from './detection';
import { controlOn, reviewOn } from './safeguards';
import { internalVersion } from '../models/labs';

export const frameworkOf = (s: GameStateV2): SafetyFramework => (s.player.safety.framework ??= defaultFramework());

const isExternal = (ch: string) => ch !== 'internal' && ch !== 'trusted';
const liveInternal = (s: GameStateV2) => s.player.deployments.filter((d) => d.channel === 'internal' && d.status === 'live');

/** External evaluators have read this version (an evaluator report, or a suite run by them). */
export function externallyEvaluated(s: GameStateV2, v: ModelVersion): boolean {
  return ws4r(s).reportedVersions.includes(v.id) || Object.values(v.evals.bench).some((r) => r.by !== 'self') || Object.values(v.evals.safety).some((r) => r.by !== 'self');
}

export { frameworkPublished };

/** Why the rule's trigger is met for `v`, or undefined. Capability: measured domain level ≥ threshold (a version never
 *  measured has no reading; the base rule holds its release). Belief: the upper end of a red-flag trait's 90% range
 *  above the line (RF-S1, decision 4: not knowing counts as risk, so a barely observed model is held; no clarity gate). */
export function ruleTriggered(rule: FrameworkRule, v: ModelVersion): string | undefined {
  const t = rule.trigger;
  if (t.kind === 'capability') {
    if (v.evals.suiteDay === undefined) return undefined;
    const L = measuredDomain(v, t.domain);
    return L >= t.level ? `${v.name} measures ${t.domain} ${L.toFixed(1)} ≥ ${t.level}` : undefined;
  }
  for (const tr of RED_FLAG_TRAITS) {
    const hi = beliefHi(v.beliefs[tr]);
    if (hi > t.est) return `${v.name}: ${tr} could be as high as ${Math.round(hi * 100)}% (top of your 90% range)`;
  }
  return undefined;
}

/** The candidate's safeguards a deploy rule checks. */
export interface FrameworkCandidate { safeguards: Deployment['safeguards']; guards?: Deployment['guards'] }

/** Requirements of `rule` not met for `v` (deploy rules: on the candidate deployment; training rules: on the lab's live
 *  internal deployments; RF-S13c: with none there is no internal AI work to guard, so control / review count as met).
 *  Labels in player language. */
export function missingFor(s: GameStateV2, rule: FrameworkRule, v: ModelVersion, cand?: FrameworkCandidate): string[] {
  const out: string[] = [];
  const internal = liveInternal(s);
  for (const g of rule.safeguards) {
    const ok = g === 'classifiers' ? !!cand && (cand.safeguards === 'classifiers' || cand.safeguards === 'hardened')
      : g === 'hardened' ? cand?.safeguards === 'hardened'
      : g === 'control' ? (rule.holds === 'deploy' ? controlOn(cand as Deployment) : internal.every(controlOn))
      : rule.holds === 'deploy' ? reviewOn(cand as Deployment) : internal.every(reviewOn);
    if (!ok) out.push(SAFEGUARD_NEED_LABEL[g]);
  }
  for (const e of rule.evidence) {
    const ok = e === 'suite' ? v.evals.suiteDay !== undefined : externallyEvaluated(s, v);
    if (!ok) out.push(EVIDENCE_NEED_LABEL[e]);
  }
  return out;
}

export const overridden = (s: GameStateV2, ruleId: string, versionId: string) => frameworkOf(s).overrides.some((o) => o.ruleId === ruleId && o.versionId === versionId);

/** Rules that hold an external launch of `v` with these safeguards: [rule, why, missing]. */
export function deployHolds(s: GameStateV2, v: ModelVersion, cand: FrameworkCandidate): { rule: FrameworkRule; why: string; missing: string[] }[] {
  const out: { rule: FrameworkRule; why: string; missing: string[] }[] = [];
  for (const rule of frameworkOf(s).rules) {
    if (rule.holds !== 'deploy' || overridden(s, rule.id, v.id)) continue;
    const why = ruleTriggered(rule, v);
    if (!why) continue;
    const missing = missingFor(s, rule, v, cand);
    if (missing.length) out.push({ rule, why, missing });
  }
  return out;
}

/** Base rule (replaces the eval gate): what a version lacks for any external release. */
export function assessmentBlock(s: GameStateV2, v: ModelVersion): string | undefined {
  const fw = frameworkOf(s);
  if (fw.evalDepth === 'none') return undefined;
  if (v.evals.suiteDay === undefined) return 'Not evaluated yet (your Safety framework asks for a capability assessment)';
  if (fw.externalReview && !externallyEvaluated(s, v)) return 'Needs an external evaluation (your Safety framework)';
  return undefined;
}

/** The framework's reason to refuse an external launch / swap of `v` on `channel`, or undefined. */
export function frameworkDeployBlock(s: GameStateV2, v: ModelVersion, channel: string, cand: FrameworkCandidate): string | undefined {
  if (!isExternal(channel)) return undefined;
  const base = assessmentBlock(s, v);
  if (base) return base;
  // RD-P05: open weights are a release act with no safeguard the lab keeps (only the hazard filter): no classifiers,
  // hardening, control or review count for it.
  const h = deployHolds(s, v, channel === 'open' ? { safeguards: 'minimal', guards: [] } : cand)[0];
  return h ? `Held by your Safety framework ("${h.rule.label}"): ${h.why}; needs ${h.missing.join(', ')} (or override)` : undefined;
}

/** Versions a training rule reads: every measured, not retired version the lab holds (capability), the internal model
 *  (beliefs: the old red-flag reading). */
function trainingSubjects(s: GameStateV2, rule: FrameworkRule): ModelVersion[] {
  if (rule.trigger.kind === 'belief') {
    const v = internalVersion(s);
    return v ? [v] : [];
  }
  return s.player.models.versions.filter((v) => v.status !== 'retired' && v.status !== 'rolledBack' && v.evals.suiteDay !== undefined);
}

/** Training holds in force today (computed). */
export function trainingHolds(s: GameStateV2): Omit<FrameworkHold, 'since'>[] {
  const out: Omit<FrameworkHold, 'since'>[] = [];
  for (const rule of frameworkOf(s).rules) {
    if (rule.holds !== 'training') continue;
    for (const v of trainingSubjects(s, rule)) {
      if (overridden(s, rule.id, v.id) || !ruleTriggered(rule, v)) continue;
      const missing = missingFor(s, rule, v);
      if (missing.length) { out.push({ ruleId: rule.id, versionId: v.id, target: 'training', missing }); break; }
    }
  }
  return out;
}

/** RF-S2: the safeguards your framework's triggered (not overridden) rules ask of deployment `d`: a product, the deploy
 *  rules on any model it sells (main and lineup); internal AI work, the training rules (they ask it of every live
 *  internal deployment). The "meet my framework" package (safety/packages.ts) adds what of this is missing. */
export function requiredSafeguards(s: GameStateV2, d: Deployment): Set<FrameworkRule['safeguards'][number]> {
  const out = new Set<FrameworkRule['safeguards'][number]>();
  if (d.channel === 'open' || d.channel === 'trusted') return out;
  const fw = frameworkOf(s);
  if (d.channel === 'internal') {
    for (const rule of fw.rules) {
      if (rule.holds !== 'training') continue;
      if (trainingSubjects(s, rule).some((v) => !overridden(s, rule.id, v.id) && ruleTriggered(rule, v))) for (const g of rule.safeguards) out.add(g);
    }
    return out;
  }
  for (const vid of [d.versionId, ...(d.lineup ?? [])]) {
    const v = s.player.models.versions.find((x) => x.id === vid);
    if (!v) continue;
    for (const rule of fw.rules) if (rule.holds === 'deploy' && !overridden(s, rule.id, v.id) && ruleTriggered(rule, v)) for (const g of rule.safeguards) out.add(g);
  }
  return out;
}

/** Frontier training is held by the framework today (the stored holds, refreshed daily by frameworkSystem). */
export const trainingHeld = (s: GameStateV2) => (s.player.safety.framework?.holds ?? []).some((h) => h.target === 'training');

const holdKey = (h: Pick<FrameworkHold, 'ruleId' | 'versionId' | 'target' | 'depId'>) => `${h.ruleId}|${h.versionId}|${h.target}|${h.depId ?? ''}`;

/** Refresh the holds: training holds and holds on live external deployments; set / clear `Deployment.held`; log new and
 *  released holds; pause running frontier runs while training is held (runs.ts resumes them when it ends). */
export function refreshFramework(s: GameStateV2, ctx?: SystemCtx): FrameworkHold[] {
  const fw = frameworkOf(s);
  const day = s.time.day;
  const prev = new Map(fw.holds.map((h) => [holdKey(h), h]));
  const next: FrameworkHold[] = [];
  const keep = (h: Omit<FrameworkHold, 'since'>) => next.push({ ...h, since: prev.get(holdKey(h))?.since ?? day });
  for (const h of trainingHolds(s)) keep(h);
  for (const d of s.player.deployments) {
    if (d.status !== 'live' || !isExternal(d.channel)) { delete d.held; continue; }
    // RD-P01a / RD-P03: a product sells its whole lineup (main model and its lineup entries); a hold on any of them
    // holds the product. Open weights (RD-P05) have no safeguards to add: a release, once made, is not held.
    if (d.channel === 'open') { delete d.held; continue; }
    const hs: (ReturnType<typeof deployHolds>[number] & { vid: string })[] = [];
    for (const vid of [d.versionId, ...(d.lineup ?? [])]) {
      const v = s.player.models.versions.find((x) => x.id === vid);
      if (v) for (const h of deployHolds(s, v, d)) hs.push({ ...h, vid });
    }
    for (const h of hs) keep({ ruleId: h.rule.id, versionId: h.vid, target: 'deploy', depId: d.id, missing: h.missing });
    if (hs.length) d.held = `"${hs[0].rule.label}": ${hs[0].why}; needs ${hs[0].missing.join(', ')}`;
    else delete d.held;
  }
  const label = (id: string) => fw.rules.find((r) => r.id === id)?.label ?? id;
  if (ctx) {
    const nextKeys = new Set(next.map(holdKey));
    for (const h of next) if (!prev.has(holdKey(h))) ctx.log('alert', `Safety framework hold (${label(h.ruleId)}): ${h.target === 'training' ? 'frontier training paused' : `product ${h.depId} stopped`}; needs ${h.missing.join(', ')}.`, 2, h.versionId);
    for (const h of fw.holds) if (!nextKeys.has(holdKey(h))) ctx.log('company', `Safety framework hold released (${label(h.ruleId)}${h.depId ? `, product ${h.depId}` : ''}).`, 1, h.versionId);
  }
  fw.holds = next;
  if (trainingHeld(s)) for (const r of s.player.models.runs) if (r.status === 'running' && (r.kind === 'base' || r.kind === 'post')) r.status = 'paused';
  return next;
}

/** What an override of `ruleId` for `versionId` costs, as stated lines (the override's preview and its record). */
export function overrideConsequences(s: GameStateV2): { moraleSafety: number; scrutiny: number; credibility: number; lines: string[] } {
  const pub = frameworkPublished(s);
  const credibility = pub ? OVERRIDE_COST.credibility : 0;
  const lines = [
    `staff: safety-team morale −${OVERRIDE_COST.moraleSafety} and one red flag (raises the odds of a staff leak)`,
    `government: scrutiny +${OVERRIDE_COST.scrutiny} (a departure from your own framework is reportable)`,
    pub ? `reputation: credibility −${credibility} (you break your published framework)` : 'reputation: none now (the framework is not published)',
  ];
  return { moraleSafety: OVERRIDE_COST.moraleSafety, scrutiny: OVERRIDE_COST.scrutiny, credibility, lines };
}

/** Override a rule for one version: releases its holds on that version (deploy and training). Returns a reason or undefined. */
/** Why an override of this rule for this version is refused (undefined = it goes through); the preview and apply share it. */
export function overrideRefusal(s: GameStateV2, ruleId: string, versionId: string): string | undefined {
  if (!frameworkOf(s).rules.some((r) => r.id === ruleId)) return 'Unknown framework rule';
  if (!s.player.models.versions.some((v) => v.id === versionId)) return 'Unknown version';
  if (overridden(s, ruleId, versionId)) return 'Already overridden';
  return undefined;
}
export function overrideRule(s: GameStateV2, ctx: SystemCtx, ruleId: string, versionId: string): string | undefined {
  const why = overrideRefusal(s, ruleId, versionId);
  if (why) return why;
  const fw = frameworkOf(s);
  const rule = fw.rules.find((r) => r.id === ruleId)!;
  const c = overrideConsequences(s);
  ctx.bump('morale.safety', -c.moraleSafety, 'Safety framework override', rule.label);
  ctx.bump('relations.scrutiny', c.scrutiny, 'Safety framework override', rule.label);
  if (c.credibility) ctx.bump('relations.credibility', -c.credibility, 'Safety framework override', rule.label);
  ws4(s).redFlags++;
  fw.overrides.push({ ruleId, versionId, day: s.time.day, consequences: c.lines });
  ctx.log('company', `Safety framework overridden: "${rule.label}" for ${s.player.models.versions.find((v) => v.id === versionId)?.name ?? versionId}.`, 2, versionId);
  refreshFramework(s, ctx);
  return undefined;
}

/** Edit a rule within limits (data/v2/framework.ts): threshold within the slack of its default, safeguards and evidence
 *  only added. Returns a reason or undefined. */
export function editRule(s: GameStateV2, ruleId: string, edit: { level?: number; est?: number; addSafeguard?: FrameworkRule['safeguards'][number]; addEvidence?: FrameworkRule['evidence'][number] }, defaults: readonly FrameworkRule[], slack: { level: number; belief: number }): string | undefined {
  const fw = frameworkOf(s);
  const rule = fw.rules.find((r) => r.id === ruleId);
  const def = defaults.find((r) => r.id === ruleId);
  if (!rule || !def) return 'Unknown framework rule';
  if (edit.level !== undefined) {
    if (rule.trigger.kind !== 'capability' || def.trigger.kind !== 'capability') return 'Not a capability threshold';
    if (Math.abs(edit.level - def.trigger.level) > slack.level + 1e-9) return `Threshold must stay within ${slack.level} L of ${def.trigger.level}`;
    rule.trigger.level = edit.level;
  }
  if (edit.est !== undefined) {
    if (rule.trigger.kind !== 'belief' || def.trigger.kind !== 'belief') return 'Not a belief threshold';
    if (Math.abs(edit.est - def.trigger.est) > slack.belief + 1e-9) return `Threshold must stay within ${Math.round(slack.belief * 100)} pts of ${Math.round(def.trigger.est * 100)}%`;
    rule.trigger.est = edit.est;
  }
  if (edit.addSafeguard && !rule.safeguards.includes(edit.addSafeguard)) rule.safeguards.push(edit.addSafeguard);
  if (edit.addEvidence && !rule.evidence.includes(edit.addEvidence)) rule.evidence.push(edit.addEvidence);
  return undefined;
}
