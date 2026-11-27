// Player actions in the Safety sphere (ActionDef catalog, V2-SPEC §3.4.3 Safety row, §3.5). Owner: WS2.
// Every preview shows costs, gains and exposure computed from VISIBLE inputs (posteriors, beliefs, FTE, compute);
// none reads truth; each shows what apply() does (§2.7, lint-tradeoffs).
import { CONTROL_SETTINGS, LOCKDOWN_COLLUSION_MULT, LOCKDOWN_SLOWDOWN, addSafeguard, cannotAdd, controlComputeShare, controlOn, isRestricted, labControlSetting, lockdownOnDep } from './safeguards';
import { controlSettingPreviews } from './readoutsSafeguards';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { PRODUCT_DEFS } from '../../../data/v2/features';
import { CRITICAL_TRAITS, TRAIT_BY_ID, TRAIT_IDS } from '../../../data/v2/traits';
import { evalDaysFor } from '../models/evals';
import { internalVersion, measuredLOf } from '../models/labs';
import type { ActionDef, AgendaId, ControlSetting, CostLine, GameStateV2, ResponseKind, RLFamily, TechniqueState, TraitId } from '../types';
import { RL_FAMILY_IDS } from '../../../data/v2/runDesign';
import { clamp01, versionById } from './common';
import { oomOfLevel } from './oversight';
import { safetyLabour } from '../departments/workfit';
import { lineResultsPerYear } from './agendas';
import { believedCaseThreat, believedSabotage } from './covert';
import { publishFinding } from './findings';
import { caseComputeScale } from './lineProjects';
import { CASE_WORK, INV_FTE, INV_MAX_DAYS, caseDailyWork, casePreview, closeInvestigation, corruptOdds, defaultTools, caseRoom, openInvestigation } from './investigations';
import {
  DISCLOSURE_POLICIES, RESPONSE_INFO, UNDO_RESPONSES, applyResponse,
  hardenFamily, methodChoice, mustReport, responseOptions, responseTrait, restrictTargets,
  setIncidentDisclosure,
} from './responses';
import { methodPolicyOn } from './methods';
import { lawsInForce } from '../../../data/v2/laws';
import { L, moraleSafety, pv } from '../actors/fx';
import { frameworkPublished, hasCommitment, signCommitment } from '../actors/commitments';
import { simpleAction } from '../core/actionDef';
import type { DisclosurePolicy, FrameworkEvidence, FrameworkSafeguard, SafetyFramework } from '../types';
import { editRule, frameworkOf, overrideConsequences, overrideRefusal, overrideRule, refreshFramework } from './framework';
import { PACKAGE_LABEL, applyPackage, packageBlock, previewPackage } from './packages';
import { FRAMEWORK_BELIEF_SLACK, FRAMEWORK_LEVEL_SLACK } from '../../../data/v2/framework';
import { worldFrameworkRules } from './framework';
import { redFlagLine } from '../events/catalog/safety';
import { strengthBelieved } from './techniques';
import { METHOD_BY_ID, methodQRange, ownedMethods } from './methods';
import { believedPenalty, combineTools } from './detection';
import { removalPreview } from './footholdDetection';
import { RESTRICT, controlDangerDelta, controlReadout, restrictDangerDelta } from './dangerView';
import { VAL_DAYS, VAL_N } from '../../../data/v2/agendas';
import { canValidate, humanRun, isMethod, jobEngineers, queueValidation, sampleRange, validationOf, validationRange } from './validation';
import { instrumentName, instruments } from './instruments';
import { believedSpotCatch, spotCheckChosen, spotCheckFte } from './workPackage';
import { safetyAgentVersion } from './agents';
import { SUITE_ACTIONS, suiteWorkBlock } from '../models/suites';

type P = Record<string, number | string | boolean>;
type Preview = { costs: CostLine[]; gains: CostLine[]; exposure: CostLine[] };

const r2 = (x: number) => Math.round(x * 100) / 100;
const str = (p: P, k: string): string | undefined => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
const num = (p: P, k: string): number | undefined => (typeof p[k] === 'number' ? (p[k] as number) : undefined);
const isTrait = (x: string | undefined): x is TraitId => !!x && (TRAIT_IDS as string[]).includes(x);

/** Default investigation target: the internal model's critical trait with the highest believed level. */
function defaultTarget(s: GameStateV2): { versionId: string; trait: TraitId } | undefined {
  const v = internalVersion(s);
  if (!v) return undefined;
  return { versionId: v.id, trait: responseTrait(v) };
}

/** F6e / RF-S12: the case's believed reliability (caseReliability's rule at BELIEVED strength and penalty on the measured
 *  level, the default tools or the chosen ones) and its engineer-days a day (caseDailyWork at the engineers asked and
 *  the compute the needs list would grant). */
function caseOutlook(s: GameStateV2, versionId: string, traits: TraitId[], tools: TechniqueState[], fte: number, computeServed: number): { reliability: number; perDay: number } {
  const v = versionById(s, versionId);
  const perDay = caseDailyWork(s, fte, computeServed);
  if (!v) return { reliability: 0, perDay };
  const L = v.evals.measuredL ?? 0;
  const x = oomOfLevel(s.hidden.timeline, L);
  let g = 0;
  for (const k of traits) g = Math.max(g, combineTools(tools.map((t) => ({ agenda: t.agenda, d: (t.coverage[k] ?? 0) * strengthBelieved(s, t, x) * believedPenalty(s, v, k, t.family, L) }))));
  return { reliability: g, perDay };
}

/** SR-17 / RF-S12: the case job's preview lines (investigations.casePreview at believed reliability): which instruments,
 *  how long, what it can find, and each verdict's belief width after if the instruments are as reliable as believed. */
function caseGains(s: GameStateV2, versionId: string, traits: TraitId[], tools: TechniqueState[], fte: number, granted: number, o: { reliability: number; perDay: number }, on: string): CostLine[] {
  const cp = casePreview(s, versionById(s, versionId), traits, tools, fte, granted, o.perDay, o.reliability);
  const when = cp.done >= 1 - 1e-9 ? `done in ~${cp.days} d` : `${Math.round(cp.done * 100)}% done when it stops at ${INV_MAX_DAYS} d`;
  const out: CostLine[] = [
    { currency: 'alignment', amount: r2(cp.reliability), unit: 'reliability', target: `on ${on}: these instruments together catch about ${Math.round(cp.reliability * 100)}% (believed); ${CASE_WORK} engineer-days of work, ${when} (estimate); ${Math.round(cp.h100e).toLocaleString()} H100e` },
    { currency: 'alignment', amount: cp.instruments.length, unit: cp.instruments.length === 1 ? 'instrument' : 'instruments', target: cp.instruments.map((i) => `${i.name} (${i.family}${i.reads.length ? `: ${i.reads.join(', ')}` : ': reads none of the targets'})`).join('; ') },
  ];
  for (const r of cp.ranges) {
    if (!r.now) continue;
    out.push({ currency: 'alignment', amount: r2(r.now.sd - r.confirmed), unit: `${r.trait} ±`, target: `believed ${r.now.est.toFixed(2)} ± ${r.now.sd.toFixed(2)} → about ± ${r.confirmed.toFixed(2)} if it confirms, ± ${r.benign.toFixed(2)} if it clears, ± ${r.inconclusive.toFixed(2)} if inconclusive (if your instruments are as reliable as believed; estimate)` });
  }
  for (const f of cp.canFind) out.push({ currency: 'alignment', amount: 0, unit: 'can find', target: f });
  return out;
}

const INVESTIGATE: ActionDef = {
  id: 'safety.investigate', verb: 'respond', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Open case',
  available: (s) => caseRoom(s, INV_FTE[0]) > 1e-9 || 'No safety research engineers left for a case at its place in the needs order',
  preview(s, p) {
    const fte = Math.max(INV_FTE[0], Math.min(INV_FTE[1], num(p, 'fte') ?? 15));
    const inc = str(p, 'incidentId') ? s.player.safety.incidents.find((i) => i.id === str(p, 'incidentId')) : undefined;
    const t = defaultTarget(s);
    const versionId = inc?.versionId ?? str(p, 'versionId') ?? t?.versionId ?? '';
    const unexplained = !!inc && (inc.apparent === 'unexplained' || inc.apparent === 'misuse');
    const trait = isTrait(str(p, 'trait')) ? (str(p, 'trait') as TraitId) : inc && !unexplained ? (inc.apparent as TraitId) : t?.trait ?? 'SCHEME';
    // F6e: the case's real terms (investigations.ts): its traits (the critical set for an unexplained incident), its
    // tools (the chosen ones, else every unlocked detector covering them), its compute share of the safety pool.
    const traits = unexplained ? [...CRITICAL_TRAITS] : [trait];
    const cs = clamp01(num(p, 'computeShare') ?? 0.05);
    const ids = str(p, 'tools')?.split(',').filter(Boolean);
    const tools = (ids?.length ? ids : defaultTools(s, traits)).map((id) => s.player.safety.techniques[id]).filter((x): x is TechniqueState => !!x?.unlocked);
    const csScale = caseComputeScale(s, cs); // SR-21: the cases' compute need, filled in the safety needs list's order
    const o = caseOutlook(s, versionId, traits, tools, fte, csScale);
    // Share of the case's work AI does (safety experiments, model v3 E2): what a sabotaging model can corrupt; model v3
    // E7: its sabotage attempts on that share (covert.ts SAFSAB, from beliefs and the measured level) × (1 − the tools'
    // verifiability), the odds resolveInvestigation draws.
    const ai = safetyLabour(s).exp.A;
    const pc = ai > 0.005 ? corruptOdds(believedSabotage(s, ai, believedCaseThreat(s, versionId, traits)), tools) : 0;
    const on = unexplained ? 'the critical traits (unexplained incident)' : TRAIT_BY_ID[trait]?.name ?? trait;
    return {
      costs: [
        { currency: 'staffTime', amount: fte, target: `safety research engineers until its work is done (≤ ${INV_MAX_DAYS} d; before validation jobs in the default order)` },
        { currency: 'compute', amount: cs, target: csScale < 1 ? `of the safety compute pool (gets ${Math.round(cs * csScale * 1000) / 10}%: the monitors come first)` : 'of the safety compute pool' },
      ],
      gains: tools.length ? caseGains(s, versionId, traits, tools, fte, cs * csScale, o, on) : [{ currency: 'alignment', amount: 0, target: 'no owned instrument reads this: the case cannot open' }],
      exposure: pc > 0 ? [{ currency: 'alignment', amount: -1, unit: 'case', probability: pc, target: 'conclusion corrupted by sabotaging safety AI (reads benign or inconclusive; estimate)' }] : [],
    };
  },
  apply(s, ctx, p) {
    const fte = Math.max(INV_FTE[0], Math.min(INV_FTE[1], num(p, 'fte') ?? 15));
    const tools = str(p, 'tools')?.split(',').filter(Boolean);
    const opts = { tools, computeShare: num(p, 'computeShare') };
    const incId = str(p, 'incidentId');
    let r;
    if (incId) r = openInvestigation(s, ctx, { kind: 'incident', incidentId: incId }, fte, opts);
    else {
      const t = defaultTarget(s);
      const versionId = str(p, 'versionId') ?? t?.versionId;
      const trait = isTrait(str(p, 'trait')) ? (str(p, 'trait') as TraitId) : t?.trait;
      if (!versionId || !trait) return void ctx.log('alert', 'Open case: no model to look into.');
      r = openInvestigation(s, ctx, { kind: 'trait', versionId, trait }, fte, opts);
    }
    if (typeof r === 'string') ctx.log('alert', `Case not opened: ${r}.`, 1);
  },
};

const CLOSE_CASE: ActionDef = {
  id: 'safety.closeCase', verb: 'respond', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Close case',
  available: (s) => s.player.safety.investigations.some((i) => !i.outcome) || 'No open case',
  preview(s, p) {
    const inv = s.player.safety.investigations.find((i) => i.id === str(p, 'id')) ?? s.player.safety.investigations.find((i) => !i.outcome);
    return {
      costs: [{ currency: 'alignment', amount: r2(1 - (inv?.progress ?? 0)), target: `of the case's work not done: its verdict counts for ${Math.round((inv?.progress ?? 0) * 100)}% of a full one` }],
      gains: [{ currency: 'staffTime', amount: inv?.fte ?? 0, target: 'safety research engineers freed' }],
      exposure: [],
    };
  },
  apply(s, ctx, p) {
    const id = str(p, 'id') ?? s.player.safety.investigations.find((i) => !i.outcome)?.id;
    const err = id ? closeInvestigation(s, ctx, id) : 'No case';
    if (err) ctx.log('alert', `Close case: ${err}.`, 1);
  },
};

const RESPONSE_KINDS = Object.keys(RESPONSE_INFO) as ResponseKind[];

const f2 = (x: number) => x.toFixed(2);
const fmtActs = (x: number) => (x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toFixed(2));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** SR-16: the RL family named in an action's params (environment fix), if any. */
const familyParam = (p: Record<string, unknown> | undefined): RLFamily | undefined => {
  const f = p?.family;
  return typeof f === 'string' && (RL_FAMILY_IDS as string[]).includes(f) ? (f as RLFamily) : undefined;
};

/** RF-S8: the environment-fix response is a hardening pass on the family's suite; its preview is suite.harden's own
 *  (models/suites.ts SUITE_ACTIONS: cash, engineer team-weeks, exploitable share before → after, floor included), with
 *  the reason when the pass cannot be queued. */
function hardenLines(s: GameStateV2, family?: RLFamily): Preview {
  const f = hardenFamily(s, family);
  if (!f) return { costs: [{ currency: 'progress', amount: 0, target: 'no environments of that family' }], gains: [], exposure: [] };
  const pv = SUITE_ACTIONS.find((x) => x.id === 'suite.harden')!.preview(s, { family: f });
  const block = suiteWorkBlock(s, f, 'harden');
  return block ? { ...pv, gains: [{ currency: 'alignment', amount: 0, target: block }] } : pv;
}

function respondPreview(s: GameStateV2, kind: ResponseKind, versionId: string | undefined, incidentId: string | undefined, o: { footholdId?: string; trait?: TraitId; techniqueId?: string; family?: RLFamily } = {}): Preview {
  if (kind === 'removeFoothold') return removalPreview(s, o.footholdId);
  const v = versionById(s, versionId) ?? internalVersion(s);
  const inc = incidentId ? s.player.safety.incidents.find((i) => i.id === incidentId) : undefined;
  const trait = v ? responseTrait(v, inc, o.trait) : 'SCHEME';
  const est = v?.beliefs[trait]?.est ?? 0;
  const none = (why: string): Preview => ({ costs: [{ currency: 'progress', amount: 0, target: why }], gains: [], exposure: [] });
  // SR-18: only the believed cause's responses apply (applyResponse refuses the others); safeguard off-switches always.
  if (v && !UNDO_RESPONSES.includes(kind)) {
    const opt = responseOptions(s, v, inc, o.trait);
    if (!opt.kinds.includes(kind)) return none(`not a response to the believed cause, ${opt.label}`);
  }
  // F6e: every line below is what applyResponse does (safety/responses.ts), from the same constants and helpers, on
  // believed levels (beliefs, measured levels, believed strengths) only.
  switch (kind) {
    case 'patchSignal':
      return hardenLines(s, o.family);
    case 'addMethod': {
      // SR-18: a method for later runs (applyResponse adds it to SafetyDept.requiredMethods; defaultMethods lists it).
      // Its effect is the run's own (methodLines in the run preview); nothing changes in this model.
      const m = methodChoice(s, trait, o.techniqueId);
      if (!m) return none(`no owned method acts on ${TRAIT_BY_ID[trait]?.name ?? trait}`);
      const name = TECHNIQUE_BY_ID[m]?.name ?? m;
      const already = methodPolicyOn(s) || (s.player.safety.requiredMethods ?? []).includes(m);
      const cost = METHOD_BY_ID[m]?.cost;
      return {
        costs: [{ currency: 'progress', amount: 0, target: `none now; the method's own cost shows on each run plan that lists it${cost ? ` (${cost})` : ''}` }],
        gains: [{ currency: 'alignment', amount: already ? 0 : 1, unit: 'method', target: already ? `${name} is already in every default run plan${methodPolicyOn(s) ? ' (Use all known methods is on)' : ''}: no change` : `${name} in every later default run plan: ${METHOD_BY_ID[m]?.effect ?? ''}; shows in the next run's predicted traits, not in ${v?.name ?? 'this model'}` }],
        exposure: [],
      };
    }
    case 'restrictContext': {
      // restrictTargets: the model's live external products (the incident's own one when it names it); restricted,
      // their usage, revenue, misuse reach and incident opportunity × RESTRICT (dangerView, revenue.ts, incidents.ts).
      const deps = v ? restrictTargets(s, v, inc) : [];
      if (!deps.length) return { costs: [{ currency: 'revenue', amount: 0, target: 'no live external product of this model to restrict' }], gains: [], exposure: [] };
      const rev = deps.reduce((a, d) => a + (d.revenueRate ?? 0), 0);
      const dd = restrictDangerDelta(s, deps);
      const n = plural(deps.length, 'product');
      return {
        costs: [{ currency: 'revenue', amount: -(rev * (1 - RESTRICT)), target: `${n} restricted: usage ×${RESTRICT} ($${rev.toFixed(2)}B → $${(rev * RESTRICT).toFixed(2)}B/yr at today's demand)` }],
        gains: [
          ...(dd.sites > 0 ? [{ currency: 'alignment' as const, amount: r2(dd.now - dd.after), unit: 'acts/yr', target: `believed harmful acts ${fmtActs(dd.now)} → ${fmtActs(dd.after)} / yr at ${n}` }] : []),
          { currency: 'security', amount: Math.round((1 - RESTRICT) * 100), unit: '%', target: `less bio / cyber misuse reach at ${n}` },
        ],
        exposure: [],
      };
    }
    case 'liftRestriction': {
      // SR-13: the restriction safeguard is two-way; lifting it returns usage (and revenue, misuse reach, Chances) to full.
      const deps = v ? s.player.deployments.filter((d) => d.versionId === v.id && isRestricted(d) && (!inc?.deploymentId || d.id === inc.deploymentId)) : [];
      if (!deps.length) return { costs: [{ currency: 'revenue', amount: 0, target: 'no restricted deployment of this model' }], gains: [], exposure: [] };
      const rev = deps.reduce((a, d) => a + (d.revenueRate ?? 0), 0);
      const n = plural(deps.length, 'product');
      return {
        costs: [{ currency: 'security', amount: -Math.round((1 - RESTRICT) * 100), unit: '%', target: `more bio / cyber misuse reach and incident chances at ${n} (usage ×${(1 / RESTRICT).toFixed(1)})` }],
        gains: [{ currency: 'revenue', amount: rev * (1 / RESTRICT - 1), target: `${n} unrestricted: $${rev.toFixed(2)}B → $${(rev / RESTRICT).toFixed(2)}B/yr at today's demand` }],
        exposure: [],
      };
    }
    case 'addControl': {
      // Model v3 E11: the preview reads E6's control protocol (the largest internal lane's tax, the miss multiplier).
      const c = controlReadout(s);
      return {
        costs: [
          { currency: 'progress', amount: -Math.round(c.tax * 100), unit: '%', target: 'of AI staff work at most (slowdown)' },
          // SR-13b: the trusted model's compute, from the monitors' line (internal) or the product's serving.
          { currency: 'compute', amount: -Math.round(controlComputeShare('defer10') * 1000) / 10, unit: '%', target: "of the deployment's compute: from the safeguards allocation (AI staff) or the product's serving" },
        ],
        gains: [{ currency: 'security', amount: r2(1 - c.missMult), target: `unstopped harm ×${c.missMult.toFixed(2)}; risky actions blocked` }],
        exposure: [],
      };
    }
    case 'removeControl': {
      // Model v3 F6 (lead: the layer can be turned off): the tax saved (E6's protocol, as on Add control) and the believed
      // danger at the sites it covered with the layer off (dangerView's estimate). Beliefs only.
      const c = controlReadout(s);
      const deps = v ? s.player.deployments.filter((d) => d.versionId === v.id && d.status !== 'withdrawn' && controlOn(d)) : [];
      const internal = deps.some((d) => d.channel === 'internal' && d.status === 'live');
      const dd = v ? controlDangerDelta(s, v.id, false) : { now: 0, after: 0, sites: 0 };
      const fmt = (x: number) => (x >= 10 ? x.toFixed(0) : x >= 1 ? x.toFixed(1) : x.toFixed(2));
      return {
        costs: [{ currency: 'security', amount: -r2(1 - c.missMult), target: `monitors miss more (×${(1 / Math.max(1e-9, c.missMult)).toFixed(2)}); risky actions no longer blocked` }],
        gains: [{ currency: 'progress', amount: internal ? Math.round(c.tax * 100) : 0, unit: '%', target: internal ? 'of AI staff work back at most (slowdown ends)' : 'no AI staff slowdown on this model' }],
        exposure: dd.sites > 0 ? [{ currency: 'alignment', amount: -r2(dd.after - dd.now), probability: 1, target: `believed harmful acts ${fmt(dd.now)} → ${fmt(dd.after)} / yr at ${dd.sites} site${dd.sites === 1 ? '' : 's'}`, unit: 'acts/yr' }] : [],
      };
    }
    case 'addLockdown':
    case 'removeLockdown': {
      // SR-13b: comms lockdown on the model's internal agents: collusion penalty ×LOCKDOWN_COLLUSION_MULT, Slowdown
      // LOCKDOWN_SLOWDOWN on internal AI work (departments/workfit.ts useLabour).
      const add = kind === 'addLockdown';
      const deps = v ? s.player.deployments.filter((d) => d.versionId === v.id && d.channel === 'internal' && (add ? d.status === 'live' : lockdownOnDep(d))) : [];
      if (!deps.length) return none(add ? 'no AI staff run this model' : 'no comms lockdown on this model');
      const why = add ? cannotAdd(s, deps[0], 'lockdown') : undefined;
      if (why) return none(why);
      const slow: CostLine = { currency: 'progress', amount: add ? -Math.round(LOCKDOWN_SLOWDOWN * 100) : Math.round(LOCKDOWN_SLOWDOWN * 100), unit: '%', target: add ? 'of AI staff work (comms lockdown slowdown)' : 'of AI staff work back (lockdown slowdown ends)' };
      const coll: CostLine = { currency: 'security', amount: add ? 1 - LOCKDOWN_COLLUSION_MULT : -(1 - LOCKDOWN_COLLUSION_MULT), target: add ? `same-lineage collusion penalty ×${LOCKDOWN_COLLUSION_MULT}` : 'same-lineage collusion penalty back to full' };
      return add ? { costs: [slow], gains: [coll], exposure: [] } : { costs: [coll], gains: [slow], exposure: [] };
    }
    case 'rollback': {
      // Apply: every deployment and agent lane (and monitor) on the model moves to its checkpoint; the model is shelved.
      if (!v) return none('no model');
      const parent = versionById(s, v.parentVersionId);
      if (!parent || parent.status === 'retired') return none('no checkpoint to roll back to');
      const nd = s.player.deployments.filter((d) => d.versionId === v.id).length;
      const na = Object.values(s.player.agents).filter((a) => a.versionId === v.id || a.monitorId === v.id).length;
      const Lv = measuredLOf(s, v).L;
      const Lp = measuredLOf(s, parent).L;
      const pEst = parent.beliefs[trait]?.est ?? 0;
      const stream = s.player.models.stream?.versionId === v.id ? '; its training stream stops' : '';
      const where = `${plural(nd, 'deployment')} and ${plural(na, 'agent lane')} move to ${parent.name}; ${v.name} is shelved${stream}`;
      const traitLine: CostLine = { currency: 'alignment', amount: est - pEst, unit: trait, target: `believed ${f2(est)} (${v.name}) → ${f2(pEst)} (${parent.name})` };
      return {
        costs: [{ currency: 'progress', amount: -(Lv - Lp), target: `measured level ${Lv.toFixed(1)} → ${Lp.toFixed(1)}: ${where}` }],
        gains: est >= pEst ? [traitLine] : [],
        exposure: est < pEst ? [{ ...traitLine, probability: 1 }] : [],
      };
    }
  }
}

const RESPOND: ActionDef = {
  id: 'safety.respond', verb: 'respond', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Respond',
  available: (s) => s.player.models.versions.length > 0 || 'No models',
  preview(s, p) {
    const kind = (str(p, 'kind') as ResponseKind) ?? 'patchSignal';
    const inc = str(p, 'incidentId') ? s.player.safety.incidents.find((i) => i.id === str(p, 'incidentId')) : undefined;
    // F6e: the model apply acts on (the incident's, else the capability lane's), the chosen trait and detector.
    const versionId = str(p, 'versionId') ?? inc?.versionId ?? s.player.agents.capRoutine.versionId;
    return respondPreview(s, RESPONSE_KINDS.includes(kind) ? kind : 'patchSignal', versionId, str(p, 'incidentId'), { footholdId: str(p, 'footholdId'), trait: isTrait(str(p, 'trait')) ? (str(p, 'trait') as TraitId) : undefined, techniqueId: str(p, 'techniqueId'), family: familyParam(p) });
  },
  apply(s, ctx, p) {
    const kind = str(p, 'kind') as ResponseKind;
    if (!RESPONSE_KINDS.includes(kind)) return void ctx.log('alert', 'Respond: pick a response.');
    const inc = str(p, 'incidentId') ? s.player.safety.incidents.find((i) => i.id === str(p, 'incidentId')) : undefined;
    const versionId = str(p, 'versionId') ?? inc?.versionId ?? s.player.agents.capRoutine.versionId ?? '';
    const err = applyResponse(s, ctx, kind, versionId, inc?.id, { trait: isTrait(str(p, 'trait')) ? (str(p, 'trait') as TraitId) : undefined, techniqueId: str(p, 'techniqueId'), footholdId: str(p, 'footholdId'), family: familyParam(p) });
    if (err) ctx.log('alert', `${RESPONSE_INFO[kind].title}: ${err}.`, 1);
  },
};

/** SR-18: what disclosing an incident does (discloseIncident) as preview lines; public state only. The trust and
 *  scrutiny it used to move went with the relation stocks (W1c), the approval penalty a leak avoided with the public
 *  actor (W1d; W4 brings it back): disclosing now tells government and evaluators, shares the failure mode it shows,
 *  and ends its public timer. */
function discloseLines(): Preview {
  return { costs: [], gains: [], exposure: [] };
}
/** SR-18: what withholding does: a must-report incident is a cover-up (a statutory fine once the report is late). The
 *  public penalty if outsiders find it went with the public actor (W1d; W4 brings it back). */
function withholdLines(s: GameStateV2, must: boolean): CostLine[] {
  const raise = lawsInForce(s).raise;
  return must
    ? [{ currency: 'cash', amount: raise ? -0.003 : -0.001, target: `statutory fine (${raise ? 'RAISE' : 'SB 53'}) once the report is late` }]
    : [];
}

const DISCLOSURE_POLICY: ActionDef = {
  id: 'safety.disclosurePolicy', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Disclosure policy',
  available: () => true,
  preview(s, p) {
    const pol = (DISCLOSURE_POLICIES as string[]).includes(str(p, 'policy') ?? '') ? (str(p, 'policy') as DisclosurePolicy) : 'legal';
    const d = discloseLines();
    // CP3d: setting the policy changes no meter today; each line applies per future incident it covers, and says so.
    const per = (cond: string) => (l: CostLine): CostLine => ({ ...l, condition: cond });
    return {
      costs: (pol === 'none' ? withholdLines(s, true) : d.costs).map(per(pol === 'none' ? 'per must-report incident (withheld)' : 'per incident disclosed')),
      gains: pol === 'none' ? [] : d.gains.map(per('per incident disclosed')),
      exposure: [],
    };
  },
  apply(s, _ctx, p) {
    // The preview's default ('legal') is what a request without a policy sets.
    const pol = (DISCLOSURE_POLICIES as string[]).includes(str(p, 'policy') ?? '') ? (str(p, 'policy') as DisclosurePolicy) : 'legal';
    s.player.safety.disclosure = pol;
  },
};

const DISCLOSE: ActionDef = {
  id: 'safety.disclose', verb: 'respond', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Disclose incident',
  available: (s) => s.player.safety.incidents.some((i) => i.status !== 'disclosed' && i.status !== 'leaked') || 'No incident to disclose',
  preview(s, p) {
    const inc = s.player.safety.incidents.find((i) => i.id === str(p, 'incidentId'));
    if (!inc) return { costs: [], gains: [], exposure: [] };
    const choice = str(p, 'choice') ?? 'yes';
    const must = mustReport(s, inc);
    if (choice === 'no') return { costs: withholdLines(s, must), gains: [], exposure: [] };
    return discloseLines();
  },
  apply(s, ctx, p) {
    const inc = s.player.safety.incidents.find((i) => i.id === str(p, 'incidentId'));
    const c = str(p, 'choice') ?? 'yes';
    const err = inc ? setIncidentDisclosure(s, ctx, inc, c === 'no' ? 'no' : c === 'policy' ? 'policy' : 'yes') : 'Unknown incident';
    if (err) ctx.log('alert', `Disclose: ${err}.`, 1);
  },
};

const PUBLISH: ActionDef = {
  id: 'safety.publish', verb: 'respond', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Publish',
  available: (s) => s.player.safety.findings.some((f) => !f.published) || 'Nothing unpublished',
  preview(s, p) {
    const f = s.player.safety.findings.find((x) => x.id === str(p, 'findingId')) ?? s.player.safety.findings.find((x) => !x.published);
    const disc = f?.type === 'DISC';
    return {
      costs: [{ currency: 'leadDays', amount: disc ? -3 : -5, target: 'rivals learn it too' }],
      gains: [{ currency: 'alignment', amount: disc ? 0.04 : 0.02, target: "rivals' alignment (shared pool)" }],
      exposure: [],
    };
  },
  apply(s, ctx, p) {
    const id = str(p, 'findingId') ?? s.player.safety.findings.find((x) => !x.published)?.id;
    if (!id) return void ctx.log('alert', 'Publish: nothing to publish.');
    publishFinding(s, ctx, id);
  },
};

const POLICY: ActionDef = {
  id: 'safety.publishPolicy', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Publish policy',
  available: () => true,
  preview(s, p) {
    // SR-01 (inventory O1): what apply does. "all" publishes each new result as it lands (publishFinding: rivals share
    // it); "selective" and "none" publish nothing by themselves.
    const raw = str(p, 'policy') ?? 'all';
    const pol: 'none' | 'selective' | 'all' = raw === 'none' || raw === 'selective' ? raw : 'all';
    const costs: CostLine[] = [];
    if (pol === 'all') {
      const perYear = (Object.keys(s.player.safety.agendas) as AgendaId[]).reduce((a, ag) => a + lineResultsPerYear(s, ag), 0);
      const pace = perYear > 0 ? `about ${perYear.toFixed(1)} results a year at today's staffing` : 'no line is producing results now';
      costs.push({ currency: 'alignment', amount: 0, target: `each new result is published when it lands (${pace}); rivals learn it too: shared safety know-how +0.02 per instrument or eval, +0.04 per discovery` });
    } else {
      costs.push({ currency: 'alignment', amount: 0, target: pol === 'none' ? 'nothing is published unless you press Publish on a result' : 'you choose each result to publish (Publish on the result)' });
    }
    return { costs, gains: [], exposure: [] };
  },
  apply(s, ctx, p) {
    const pol = str(p, 'policy');
    if (pol !== 'none' && pol !== 'selective' && pol !== 'all') return void ctx.log('alert', 'Publish policy: none, selective or all.');
    s.player.policies.publishSafety = pol;
    ctx.log('company', `Safety publication policy: ${pol}.`, 1);
  },
};

const PLEDGE: ActionDef = {
  id: 'safety.pledge', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Monitorability pledge',
  available: (s) => !s.player.safety.monitorabilityCommitment || 'Already pledged',
  // SR-01 (inventory O2): what apply does: a live commitment, and in training the push toward obfuscated reasoning
  // (E15) ×0.5. It blocks no design choice.
  preview: () => ({
    costs: [{ currency: 'monitorability', amount: 0, target: 'a public promise: it blocks no design choice; breaking it ends the pledge' }],
    gains: [{ currency: 'monitorability', amount: 0.5, unit: '×', target: 'training pushes toward obfuscated reasoning half as hard' }],
    exposure: [],
  }),
  apply(s, ctx) {
    s.player.safety.monitorabilityCommitment = true;
    if (!s.commitments.some((c) => c.kind === 'monitorabilityPledge' && c.status === 'live')) {
      s.commitments.push({
        id: `C-mon-${ctx.day}`, kind: 'monitorabilityPledge', title: 'Monitorability pledge',
        condition: { predicate: 'monitorabilityPledge', params: {} }, signedDay: ctx.day, status: 'live', amendments: 0,
      });
    }
    ctx.log('company', 'We pledge to keep reasoning legible: no latent reasoning, no CoT pressure.', 3);
  },
};

/** SR-19: the Safety framework's capability assessment (replaces the eval gate): the suite depth every version needs
 *  before an external release (none / basic / full / deep) and whether external evaluators must have read it. The days a
 *  release waits are that suite at today's rates (models/evals.ts). */
const FW_DEPTHS: SafetyFramework['evalDepth'][] = ['none', 'basic', 'full', 'deep'];
const fwDepthParam = (p: P, s: GameStateV2): SafetyFramework['evalDepth'] => {
  const d = str(p, 'depth') as SafetyFramework['evalDepth'] | undefined;
  return d && FW_DEPTHS.includes(d) ? d : frameworkOf(s).evalDepth;
};
const fwExternalParam = (p: P, s: GameStateV2): boolean => (typeof p.external === 'boolean' ? p.external : frameworkOf(s).externalReview);

const FRAMEWORK_EVALS: ActionDef = {
  id: 'safety.frameworkEvals', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Framework: release evals',
  available: () => true,
  preview(s, p) {
    // What apply does: external releases wait for a suite at this depth (internal use is never held by it); with the
    // propensity evals tool, any assessment weakens hacking → persona drift (E01) ×0.7 in training (traits.ts).
    const fw = frameworkOf(s);
    const to = fwDepthParam(p, s);
    const ext = fwExternalParam(p, s);
    const d = evalDaysFor(s, to) - evalDaysFor(s, fw.evalDepth);
    const costs: CostLine[] = [];
    const gains: CostLine[] = [];
    const wait: CostLine = { currency: 'leadDays', amount: -d, target: 'each new external product waits this much longer for its eval suite; internal use is never held' };
    if (d > 0) costs.push(wait);
    else if (d < 0) gains.push(wait);
    else costs.push({ ...wait, target: 'no change in how long external launches wait' });
    if (ext !== fw.externalReview) {
      costs.push({ currency: 'progress', amount: ext ? 1 : -1, unit: 'release check', target: ext ? 'every external launch needs an external evaluation of its version' : 'external launches no longer need an external evaluation' });
    }
    if (s.player.safety.techniques['T-PROP']?.unlocked && (fw.evalDepth === 'none') !== (to === 'none')) {
      const line: CostLine = { currency: 'alignment', amount: 1, unit: 'training pressure', target: `reward hacking → persona drift in training: weight ${to === 'none' ? '×0.7 → ×1' : '×1 → ×0.7'} (with propensity evals)` };
      if (to === 'none') costs.push({ ...line, amount: -1 });
      else gains.push(line);
    }
    return { costs, gains, exposure: [] };
  },
  apply(s, ctx, p) {
    const d = str(p, 'depth');
    if (d !== undefined && !FW_DEPTHS.includes(d as SafetyFramework['evalDepth'])) return void ctx.log('alert', 'Release evals: none, basic, full or deep.');
    const fw = frameworkOf(s);
    fw.evalDepth = fwDepthParam(p, s);
    fw.externalReview = fwExternalParam(p, s);
    ctx.log('company', `Safety framework: ${fw.evalDepth === 'none' ? 'no' : fw.evalDepth} evals before release${fw.externalReview ? ', external review' : ''}.`, 1);
  },
};

function ruleEdit(p: P) {
  const sg = str(p, 'addSafeguard') as FrameworkSafeguard | undefined;
  const ev = str(p, 'addEvidence') as FrameworkEvidence | undefined;
  const level = num(p, 'level');
  const est = num(p, 'est');
  return {
    ...(level !== undefined ? { level } : {}),
    ...(est !== undefined ? { est } : {}),
    ...(sg && ['classifiers', 'hardened', 'control', 'review'].includes(sg) ? { addSafeguard: sg } : {}),
    ...(ev && ['suite', 'external'].includes(ev) ? { addEvidence: ev } : {}),
  };
}
const RULE_SLACK = { level: FRAMEWORK_LEVEL_SLACK, belief: FRAMEWORK_BELIEF_SLACK };

/** SR-19: edit a framework rule within limits (threshold near its default; safeguards and evidence only added). */
const FRAMEWORK_RULE: ActionDef = {
  id: 'safety.frameworkRule', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Framework: edit rule',
  available: () => true,
  preview(s, p) {
    const c = structuredClone(s);
    const why = editRule(c, str(p, 'ruleId') ?? '', ruleEdit(p), worldFrameworkRules(s), RULE_SLACK);
    if (why) return { costs: [{ currency: 'progress', amount: 0, target: why }], gains: [], exposure: [] };
    const before = frameworkOf(s).holds.length;
    const after = refreshFramework(c).length;
    const line: CostLine = { currency: 'progress', amount: Math.abs(after - before), unit: 'holds', target: `holds in force today ${before} → ${after}` };
    return after > before ? { costs: [line], gains: [], exposure: [] } : { costs: [], gains: [line], exposure: [] };
  },
  apply(s, ctx, p) {
    const id = str(p, 'ruleId') ?? '';
    const why = editRule(s, id, ruleEdit(p), worldFrameworkRules(s), RULE_SLACK);
    if (why) return void ctx.log('alert', why);
    refreshFramework(s, ctx);
    ctx.log('company', `Safety framework rule edited: ${frameworkOf(s).rules.find((r) => r.id === id)?.label ?? id}.`, 1);
  },
};

/** SR-19: override a framework rule for one version: its holds on that version end; the consequences are stated here and
 *  applied as stated (safety/framework.ts overrideConsequences). */
const FRAMEWORK_OVERRIDE: ActionDef = {
  id: 'safety.frameworkOverride', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Framework: override',
  available: () => true,
  preview(s, p) {
    const c = overrideConsequences();
    const ruleId = str(p, 'ruleId');
    const versionId = str(p, 'versionId');
    // CP3d: a refused override (no such rule / version, already overridden) costs nothing: the preview says why.
    const refused = overrideRefusal(s, ruleId ?? '', versionId ?? '');
    if (refused) return { costs: [{ currency: 'progress', amount: 0, target: refused }], gains: [], exposure: [] };
    const released = frameworkOf(s).holds.filter((h) => h.ruleId === ruleId && h.versionId === versionId);
    const costs: CostLine[] = [
      { currency: 'morale', amount: c.moraleSafety, target: c.lines[0] },
      redFlagLine(s),
    ];
    const what = released.map((h) => (h.target === 'training' ? 'frontier training' : `product ${h.depId}`)).join(', ');
    const gains: CostLine[] = [{ currency: 'progress', amount: released.length, unit: released.length === 1 ? 'hold' : 'holds', target: `released: ${what || 'none in force (launches of this version stop being held by this rule)'}` }];
    return { costs, gains, exposure: [] };
  },
  apply(s, ctx, p) {
    // CP3d: refused, with its reason (ActionDef.apply's contract), not logged as if it went through.
    return overrideRule(s, ctx, str(p, 'ruleId') ?? '', str(p, 'versionId') ?? '');
  },
};


/** SR-20 / RF-S2: apply the "Meet my framework" package (the safeguards your Safety framework asks of this deployment
 *  that it lacks) to one product or the internal agent deployment in one act; the preview lists each part's charged cost
 *  (safety/packages.ts previewPackage) and the stop rates. */
const SAFEGUARD_PACKAGE: ActionDef = {
  id: 'safety.package', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: PACKAGE_LABEL,
  available: () => true,
  preview(s, p) {
    const d = s.player.deployments.find((x) => x.id === str(p, 'deploymentId'));
    if (!d || packageBlock(s, d)) return { costs: [], gains: [], exposure: [] };
    const pv = previewPackage(s, d);
    const costs: CostLine[] = [];
    const gains: CostLine[] = [];
    const r1 = (x: number) => Math.round(x * 10) / 10;
    for (const l of pv.parts) {
      if (Math.abs(l.computeH100e) > 1e-6) (l.computeH100e > 0 ? costs : gains).push({ currency: 'compute', amount: -r1(l.computeH100e), unit: 'H100e', target: `${l.label}: control compute (monitors' line)` });
      if (Math.abs(l.people) > 1e-6) (l.people > 0 ? costs : gains).push({ currency: 'staffTime', amount: -Math.round(l.people), unit: 'safety engineers', target: `${l.label}: reviewers` });
      if (Math.abs(l.slowdown) > 1e-6) (l.slowdown > 0 ? costs : gains).push({ currency: 'progress', amount: -Math.round(l.slowdown * 1000) / 10, unit: '% of agent work', target: `${l.label}: Slowdown` });
      if (Math.abs(l.revenue) > 1e-4) (l.revenue < 0 ? costs : gains).push({ currency: 'revenue', amount: Math.round(l.revenue * 100) / 100, target: `${l.label}` });
      if (Math.abs(l.servingH100e) > 0.5) (l.servingH100e > 0 ? costs : gains).push({ currency: 'compute', amount: -Math.round(l.servingH100e), unit: 'H100e', target: `${l.label}: serving need` });
    }
    const mean = (k: 'before' | 'after') => (pv.stops.length ? pv.stops.reduce((a, x) => a + x[k], 0) / pv.stops.length : 0);
    if (pv.stops.length) gains.push({ currency: 'alignment', amount: Math.round((mean('after') - mean('before')) * 1000) / 10, unit: 'pts', target: `mean stop rate per act ${Math.round(mean('before') * 100)}% → ${Math.round(mean('after') * 100)}% (meets ${pv.meets})` });
    return { costs, gains, exposure: [] };
  },
  apply(s, ctx, p) {
    const d = s.player.deployments.find((x) => x.id === str(p, 'deploymentId'));
    const why = d ? applyPackage(s, d) : 'Unknown deployment';
    if (why) return void ctx.log('alert', why);
    refreshFramework(s, ctx);
    ctx.log('company', `${PACKAGE_LABEL} added to ${d!.channel === 'internal' ? 'AI staff' : PRODUCT_DEFS[d!.channel]?.name ?? 'a product'}.`, 1, d!.id);
  },
};
/** UB-F: switch the running control protocol's setting (defer 10% / defer 20% / resample suspicious actions) on every
 *  deployment that has one (SR-13 safeguard item `setting`; the lab's setting is labControlSetting). The preview is the
 *  believed act table recomputed with the setting (readoutsSafeguards controlSettingPreviews: the same numbers SAFETY ›
 *  Safeguards compares). No physics change: the item's setting already drives controlTerms. */
const CONTROL_SETTING_IDS: ControlSetting[] = ['defer10', 'defer20', 'resample'];
const controlDeps = (s: GameStateV2) => s.player.deployments.filter((d) => d.status !== 'withdrawn' && controlOn(d));
const CONTROL_SETTING: ActionDef = {
  id: 'safety.controlSetting', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Control setting',
  available: (s) => controlDeps(s).length > 0 || 'No control protocol runs: add one first',
  preview(s, p) {
    const k = str(p, 'setting') as ControlSetting | undefined;
    if (!k || !CONTROL_SETTING_IDS.includes(k)) return { costs: [], gains: [], exposure: [] };
    const internal = s.player.deployments.find((d) => d.channel === 'internal' && d.status === 'live');
    const o = controlSettingPreviews(s, internal?.versionId).find((x) => x.setting === k);
    if (!o || o.current) return { costs: [{ currency: 'progress', amount: 0, target: `${CONTROL_SETTINGS[k].label} already runs: no change` }], gains: [], exposure: [] };
    const costs: CostLine[] = [];
    const gains: CostLine[] = [];
    const dS = Math.round((o.slowdown.after - o.slowdown.before) * 1000) / 10;
    if (dS) (dS > 0 ? costs : gains).push({ currency: 'progress', amount: -dS, unit: '%', target: `of AI staff work (slowdown ${Math.round(o.slowdown.before * 100)}% → ${Math.round(o.slowdown.after * 100)}%)` });
    const dH = Math.round(o.computeH100e.after - o.computeH100e.before);
    if (dH) (dH > 0 ? costs : gains).push({ currency: 'compute', amount: -dH, unit: 'H100e', target: "trusted-model compute (monitors' line)" });
    const fmt = (x: number) => (x < 0.0005 ? '~0' : x < 0.1 ? x.toFixed(3) : x < 1 ? x.toFixed(2) : x < 10 ? x.toFixed(1) : x.toFixed(0)); // as SAFETY's header
    const dHarm = o.harm.after - o.harm.before;
    if (Math.abs(dHarm) > 1e-6) (dHarm < 0 ? gains : costs).push({ currency: 'alignment', amount: r2(-dHarm), unit: 'acts/yr', target: `believed unstopped harmful acts ${fmt(o.harm.before)} → ${fmt(o.harm.after)} / yr on AI staff work` });
    return { costs, gains, exposure: [] };
  },
  apply(s, ctx, p) {
    const k = str(p, 'setting') as ControlSetting | undefined;
    if (!k || !CONTROL_SETTING_IDS.includes(k)) return void ctx.log('alert', 'Control setting: defer10, defer20 or resample.');
    const deps = controlDeps(s);
    if (!deps.length) return void ctx.log('alert', 'No control protocol runs: add one first.');
    for (const d of deps) {
      const why = addSafeguard(s, d, 'control', k);
      if (why) return void ctx.log('alert', why);
    }
    refreshFramework(s, ctx);
    ctx.log('company', `Control protocol: ${CONTROL_SETTINGS[labControlSetting(s)].label.toLowerCase()}.`, 1);
  },
};
/** SR-09: the instruments a validate action queues (tool id, or 'all' = every owned instrument not measured on the model).
 *  RF-S14: 'methods' = every owned method the model has outgrown and not validated there (a method id: that one). */
function validateTargets(s: GameStateV2, p: P): { model: string; tools: TechniqueState[] } {
  const model = str(p, 'model') ?? internalVersion(s)?.id ?? '';
  const tool = str(p, 'tool') ?? 'all';
  const tools = tool === 'all'
    ? instruments(s).filter((t) => canValidate(s, t.id, model) === true)
    : tool === 'methods'
      ? ownedMethods(s).filter((id) => canValidate(s, id, model) === true).map((id) => s.player.safety.techniques[id]!)
      : [s.player.safety.techniques[tool]].filter((t): t is TechniqueState => !!t && canValidate(s, t.id, model) === true);
  return { model, tools };
}

const VALIDATE: ActionDef = {
  id: 'safety.validate', verb: 'respond', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Validate instrument',
  available: (s) => !!internalVersion(s) || 'No model',
  preview(s, p) {
    // SR-09: what apply does: queue one job per instrument (at the end of the validation queue). Each takes the engineers
    // and days below at full staffing (the 'validation' need in the engineers' list) and some line compute while it runs;
    // on finishing, the instrument is validated on the model and its reliability there is measured from VAL_N planted
    // cases. Believed inputs only (the range shown is today's believed range and the sample's width). SR-10: p.human
    // runs it with humans only (all VAL_ENGINEERS, no AI share: an AI share of the work can corrupt the result).
    const { model, tools } = validateTargets(s, p);
    const human = p.human === true;
    const v = versionById(s, model);
    const methods = p.tool === 'methods' || (tools.length > 0 && isMethod(tools[0].id));
    if (!v || !tools.length) return { costs: [{ currency: 'staffTime', amount: 0, target: v ? (methods ? `nothing to validate on ${v.name}: every method it has outgrown is validated or queued` : `nothing to validate on ${v.name}: every instrument is measured or queued`) : 'no such model' }], gains: [], exposure: [] };
    const ahead = s.player.safety.validation?.jobs.length ?? 0;
    const per = jobEngineers(s, { human });
    const who = humanRun(s, { human }) ? 'human-run' : 'AI-assisted';
    const costs: CostLine[] = [
      { currency: 'staffTime', amount: Math.round(per * tools.length * 10) / 10, target: `safety research engineers for about ${VAL_DAYS} d at full staffing (${who}; ${tools.length} validation${tools.length === 1 ? '' : 's'}; ${ahead} already queued ahead)` },
      { currency: 'compute', amount: 0, target: "a quarter of a fully staffed programme's experiment compute per validation while it runs (the programmes get less)" },
    ];
    // RF-S14: a method's job plants the trait in a test copy, trains it with the method and counts the planted cases removed;
    // the result narrows how strong the lab believes the method is on this model and larger ones (methods.ts methodQRange).
    if (methods) {
      const q0 = methodQRange(s, tools[0].id);
      return { costs, gains: [{ currency: 'alignment', amount: tools.length, unit: 'methods', target: `tested on ${v.name}: the trait planted in a test copy, trained with the method, planted cases removed counted from ${VAL_N} (e.g. ${instrumentName(tools[0])}: how well it holds at scale now anywhere from ${Math.round(q0.lo * 100)}% to ${Math.round(q0.hi * 100)}% of its tested strength; after: a narrower range on ${v.name}, widening again on larger models)` }], exposure: [] };
    }
    const r0 = validationRange(s, tools[0], v);
    const sr = sampleRange(Math.round(r0.value * VAL_N), VAL_N);
    return {
      costs,
      gains: [{ currency: 'alignment', amount: tools.length, unit: 'instruments', target: `validated on ${v.name}: reliability measured from ${VAL_N} planted cases (e.g. ${instrumentName(tools[0])} now ${Math.round(r0.lo * 100)}–${Math.round(r0.hi * 100)}%, ${r0.basis}; after: about ±${Math.round(sr.half * 100)} points)` }],
      exposure: [],
    };
  },
  apply(s, ctx, p) {
    const { model, tools } = validateTargets(s, p);
    if (!tools.length) return void ctx.log('alert', 'Validate: nothing to validate on that model.');
    for (const t of tools) queueValidation(s, t.id, model, 'player', ctx.day, p.human === true);
    const what = isMethod(tools[0].id) ? 'method' : 'instrument';
    ctx.log('research', `Validation queued: ${tools.length} ${what}${tools.length === 1 ? '' : 's'} on ${versionById(s, model)?.name ?? model}.`, 1);
  },
};

const VALIDATION_POLICY: ActionDef = {
  id: 'safety.validationPolicy', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Validate each new model',
  available: () => true,
  preview(s, p) {
    // SR-09: what apply does: with the policy on, every owned instrument is queued for validation when a new internal
    // model arrives; off, nothing is queued by itself. RF-S14: p.methods sets whether the owned methods each new model has
    // outgrown are queued too (one job each, the same cost).
    if (typeof p.methods === 'boolean') {
      const n = ownedMethods(s).length;
      return p.methods
        ? { costs: [{ currency: 'staffTime', amount: Math.round(jobEngineers(s) * 10) / 10, target: `per method job on each new internal model, about ${VAL_DAYS} d at full staffing (up to ${n} methods, those it has outgrown)` }], gains: [{ currency: 'alignment', amount: n, unit: 'methods', target: 'how well each holds at scale measured on each new model' }], exposure: [] }
        : { costs: [{ currency: 'alignment', amount: 0, target: 'methods are not validated unless you queue it: how well they hold on larger models stays a wide range' }], gains: [], exposure: [] };
    }
    const on = p.on !== false;
    const n = instruments(s).length;
    return on
      ? { costs: [{ currency: 'staffTime', amount: Math.round(jobEngineers(s) * n * 10) / 10, target: `on each new internal model: ${n} jobs of about ${VAL_DAYS} d at full staffing` }], gains: [{ currency: 'alignment', amount: n, unit: 'instruments', target: 'measured on each new model' }], exposure: [] }
      : { costs: [{ currency: 'alignment', amount: 0, target: 'new models are not validated unless you queue it: reliability there is extrapolated, with a wider range' }], gains: [], exposure: [] };
  },
  apply(s, ctx, p) {
    if (typeof p.methods === 'boolean') {
      validationOf(s).methods = p.methods;
      return void ctx.log('company', `Validate methods on each new model: ${p.methods ? 'on' : 'off'}.`, 1);
    }
    validationOf(s).autoNew = p.on !== false;
    ctx.log('company', `Validate instruments on each new model: ${p.on !== false ? 'on' : 'off'}.`, 1);
  },
};

/** SR-22: the Safety work package's human spot-check share (none / 2% / 10% of AI-done safety work re-checked). The
 *  preview: the safety engineers it takes (the 'spotCheck' need, SR-21's list) and the believed share of sabotaged AI
 *  safety work the re-checks catch (on top of the other oversight). */
const SPOT_CHECK: ActionDef = {
  id: 'safety.spotCheck', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Spot-check AI safety work',
  available: () => true,
  preview(s, p) {
    const q = clamp01(typeof p.share === 'number' ? p.share : 0);
    const q0 = spotCheckChosen(s);
    const r1 = (x: number) => Math.round(x * 10) / 10;
    const dFte = r1(spotCheckFte(s, q) - spotCheckFte(s, q0));
    const v = safetyAgentVersion(s);
    const c0 = v ? believedSpotCatch(s, v, q0) : 0;
    const c1 = v ? believedSpotCatch(s, v, q) : 0;
    const costs: CostLine[] = [];
    const gains: CostLine[] = [];
    if (dFte > 0) costs.push({ currency: 'staffTime', amount: dFte, unit: 'safety engineers', target: `re-checking ${Math.round(q * 100)}% of the AI's safety work (the spot-check need, ahead of what follows it in the list)` });
    else if (dFte < 0) gains.push({ currency: 'staffTime', amount: -dFte, unit: 'safety engineers', target: 'back to the needs after it in the list' });
    const dC = Math.round((c1 - c0) * 1000) / 10;
    if (dC > 0) gains.push({ currency: 'alignment', amount: dC, unit: '%', target: 'of sabotaged AI safety work caught by the re-checks (believed, if fully staffed)' });
    else if (dC < 0) costs.push({ currency: 'alignment', amount: dC, unit: '%', target: 'of sabotaged AI safety work caught by the re-checks (believed)' });
    if (!costs.length && !gains.length) costs.push({ currency: 'alignment', amount: 0, target: v ? 'no change' : 'no AI staff on safety work: nothing to re-check' });
    return { costs, gains, exposure: [] };
  },
  apply(s, ctx, p) {
    const q = clamp01(typeof p.share === 'number' ? p.share : 0);
    const pkg = (s.player.agents.safety ??= {});
    if (q > 0) pkg.spotCheck = q;
    else delete pkg.spotCheck;
    ctx.log('company', `Spot-checks of AI safety work: ${q > 0 ? `${Math.round(q * 100)}%` : 'none'}.`, 1);
  },
};

/** SR-14: the standing policy "Use all known methods" (on by default): every new run plan lists every owned method.
 *  The preview shows what turning it on puts in each plan, with each method's cost where one exists. */
const METHOD_POLICY: ActionDef = {
  id: 'safety.methodPolicy', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Use all known methods',
  available: () => true,
  preview(s, p) {
    const on = p.on !== false;
    const owned = ownedMethods(s);
    if (!on) return { costs: [{ currency: 'alignment', amount: 0, target: 'new run plans start with no methods: you tick each one in the plan' }], gains: [], exposure: [] };
    const gains = owned.map((id) => ({ currency: 'alignment' as const, amount: 1, unit: 'method', target: METHOD_BY_ID[id].effect }));
    const costs: CostLine[] = owned.filter((id) => METHOD_BY_ID[id].cost).map((id) => ({ currency: 'monitorability' as const, amount: -1, unit: 'side effect', target: `${TECHNIQUE_BY_ID[id]?.name ?? id}: ${METHOD_BY_ID[id].cost}` }));
    if (!costs.length) costs.push({ currency: 'alignment', amount: 0, target: owned.length ? 'the owned methods have no cash, compute or staff cost of their own' : 'no methods owned yet' });
    return { costs, gains, exposure: [] };
  },
  apply(s, ctx, p) {
    s.player.safety.useAllMethods = p.on !== false;
    ctx.log('company', `Use all known methods in new run plans: ${p.on !== false ? 'on' : 'off'}.`, 1);
  },
};

// ───────── Pledges that sign a commitment (research/17 §1.4; ids A1, A3, A6 kept from the relations catalog) ─────────
// The trust, credibility and bloc effects they had went with the relation stocks (W1c). Pre-deploy testing lets the US
// government see the tested internal model (world/observe.ts govMilestones); approval moves on a broken pledge.

const PREDEPLOY_TESTING: ActionDef = simpleAction({
  id: 'A1', verb: 'policy', system: 'relations', title: 'Pre-deploy testing',
  available: (s) => (hasCommitment(s, 'preDeployTesting') ? 'Already signed' : true),
  preview: () => pv([L('leadDays', 21, 'each frontier launch'), L('staffTime', 5)]),
  apply(s, ctx) {
    signCommitment(s, ctx, 'testingAgreement', 'Pre-deployment testing with government evaluators', 'preDeployTesting', { days: 21 });
  },
});

// RF-S2 (review safety #4, decision 9): publishing = committing to your Safety framework's rules (safety/framework.ts);
// its holds enforce them and an override is the visible departure.
const PUBLISH_FRAMEWORK: ActionDef = simpleAction({
  id: 'A3', verb: 'policy', system: 'relations', title: 'Publish framework',
  available: (s) => (frameworkPublished(s) ? 'Framework already live' : true),
  preview: () => pv([L('freedom', 1, 'thresholds bind')]),
  apply(s, ctx) {
    signCommitment(s, ctx, 'framework', 'Published Safety framework', 'safetyFramework', {});
  },
});

const WHISTLEBLOWER_CHANNEL: ActionDef = simpleAction({
  id: 'A6', verb: 'policy', system: 'relations', title: 'Whistleblower channel',
  available: (s) => (s.player.policies.whistleblowerChannel ? 'Channel already open' : true),
  preview: () => pv([L('staffTime', 3, 'handling reports')], [L('morale', 5, 'safety staff')]),
  apply(s, ctx) {
    s.player.policies.whistleblowerChannel = true;
    signCommitment(s, ctx, 'whistleblower', 'Right-to-warn whistleblower channel', 'whistleblower', {});
    moraleSafety(ctx, 5, 'A6 whistleblower channel');
  },
});

export const SAFETY_ACTIONS: ActionDef[] = [INVESTIGATE, CLOSE_CASE, RESPOND, DISCLOSE, DISCLOSURE_POLICY, PUBLISH, POLICY, PLEDGE, FRAMEWORK_EVALS, FRAMEWORK_RULE, FRAMEWORK_OVERRIDE, SAFEGUARD_PACKAGE, CONTROL_SETTING, VALIDATE, VALIDATION_POLICY, METHOD_POLICY, SPOT_CHECK, PREDEPLOY_TESTING, PUBLISH_FRAMEWORK, WHISTLEBLOWER_CHANNEL];


