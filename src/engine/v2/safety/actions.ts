// Player actions in the Safety sphere (ActionDef catalog, V2-SPEC §3.4.3 Safety row, §3.5). Owner: WS2.
// Every preview shows costs, gains and exposure computed from VISIBLE inputs (posteriors, beliefs, FTE, compute);
// none reads truth; each shows what apply() does (§2.7, lint-tradeoffs).
import { LOCKDOWN_COLLUSION_MULT, LOCKDOWN_SLOWDOWN, cannotAdd, controlComputeShare, controlOn, isRestricted, lockdownOnDep } from './safeguards';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { CRITICAL_TRAITS, TRAIT_BY_ID, TRAIT_IDS } from '../../../data/v2/traits';
import { evalDaysFor } from '../models/evals';
import { internalVersion, measuredLOf } from '../models/labs';
import type { ActionDef, AgendaId, CostLine, GameStateV2, ResponseKind, SafetyDept, TechniqueState, TraitId } from '../types';
import { believedEfficacy, clamp01, flagNum, versionById } from './common';
import { measuredOom, oomOfLevel } from './oversight';
import { safetyLabour } from '../departments/workfit';
import { gradePlayer } from '../actors/index';
import { dateOf } from '../core/time';
import { lineResultsPerYear } from './agendas';
import { safetyPoolClaims } from '../departments/agents';
import { believedCaseThreat, believedSabotage } from './covert';
import { publishFinding } from './findings';
import { CASE_RESOLVE, INV_FTE, INV_MAX_DAYS, caseH100e, caseRate, closeInvestigation, corruptOdds, daysToResolve, defaultTools, committedFte, openInvestigation, safetyReHeads } from './investigations';
import {
  DISCLOSE_CPS, PATCH_DAYS, PATCH_FLOOR, PATCH_FTE, PATCH_MULT, RESPONSE_INFO, RUN_PENALTY_OOM, applyResponse, bestDetector, discloseScrutiny, discloseTrust,
  patchLevel, pendingRunPenalty, responseTrait, restrictTargets, targetedPlan,
} from './responses';
import { ANTISCHEME_EA_MULT, RETRAIN_OBF, RETRAIN_TRUE, RETRAIN_VISIBLE } from './traits';
import { strengthBelieved } from './techniques';
import { believedPenalty, combineTools } from './detection';
import { removalPreview } from './footholdDetection';
import { RESTRICT, controlDangerDelta, controlReadout, restrictDangerDelta } from './dangerView';
import { VAL_DAYS, VAL_N } from '../../../data/v2/agendas';
import { canValidate, jobEngineers, queueValidation, sampleRange, validationOf, validationRange } from './validation';
import { instrumentName, instruments } from './instruments';

type P = Record<string, number | string | boolean>;
type Preview = { costs: CostLine[]; gains: CostLine[]; exposure: CostLine[] };

const r2 = (x: number) => Math.round(x * 100) / 100;
const str = (p: P, k: string): string | undefined => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
const num = (p: P, k: string): number | undefined => (typeof p[k] === 'number' ? (p[k] as number) : undefined);
const isTrait = (x: string | undefined): x is TraitId => !!x && (TRAIT_IDS as string[]).includes(x);


/**
 * SR-01: a policy's Safety Index effect, from gradePlayer on a copy with the change made. Each edition (twice a year)
 * moves talent pull by (grade − 2)·3 and the safety bloc's approval by (grade − 2)·4 (actors/index.ts), so a grade
 * change Δg shifts those by Δg·3 and Δg·4 at the next edition.
 */
function indexLines(s: GameStateV2, change: (c: GameStateV2) => void): CostLine[] {
  const c = JSON.parse(JSON.stringify(s)) as GameStateV2;
  change(c);
  const dg = gradePlayer(c).overall - gradePlayer(s).overall;
  if (Math.abs(dg) < 0.005) return [];
  let lag = 1;
  for (; lag < 190; lag++) {
    const d = dateOf(s, s.time.day + lag);
    if (d.getUTCDate() === 1 && d.getUTCMonth() % 6 === 0) break;
  }
  const g = `Safety Index grade ${dg > 0 ? '+' : '−'}${Math.abs(dg).toFixed(2)} at its next edition`;
  return [
    { currency: 'talent', amount: r2(dg * 3), lagDays: lag, target: g },
    { currency: 'approval', amount: r2(dg * 4), lagDays: lag, target: `safety bloc (${g})` },
  ];
}
/** Default investigation target: the internal model's critical trait with the highest believed level. */
function defaultTarget(s: GameStateV2): { versionId: string; trait: TraitId } | undefined {
  const v = internalVersion(s);
  if (!v) return undefined;
  return { versionId: v.id, trait: responseTrait(v) };
}

/** F6e: the case's monthly clarity as monthlyGain computes it (caseRate: engineers × m of safety experiments, the
 *  case's H100e from its granted share), with the default tools (or the chosen ones) at BELIEVED strength and penalty on the measured level. */
function investigationGain(s: GameStateV2, versionId: string, traits: TraitId[], tools: TechniqueState[], fte: number, computeShare: number): number {
  const v = versionById(s, versionId);
  if (!v) return 0;
  const L = v.evals.measuredL ?? 0;
  const x = oomOfLevel(s.hidden.timeline, L);
  let g = 0;
  for (const k of traits) g = Math.max(g, combineTools(tools.map((t) => ({ agenda: t.agenda, d: (t.coverage[k] ?? 0) * strengthBelieved(s, t, x) * believedPenalty(s, v, k, t.family, L) }))));
  return caseRate(s, g, fte, caseH100e(s, computeShare));
}

/** F6e: when the case resolves at that monthly clarity (estimate), or the clarity it reaches when it closes at the cap. */
function resolveText(gm: number): string {
  const d = daysToResolve(gm);
  if (d < INV_MAX_DAYS) return `clarity ${CASE_RESOLVE} in ~${d} d (estimate)`;
  return `clarity ~${(1 - Math.pow(1 - Math.min(0.999, gm), INV_MAX_DAYS / 30)).toFixed(2)} when it closes at ${INV_MAX_DAYS} d (estimate; ${CASE_RESOLVE} resolves early)`;
}

const INVESTIGATE: ActionDef = {
  id: 'safety.investigate', verb: 'respond', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Investigate',
  available: (s) => {
    const free = safetyReHeads(s) - committedFte(s);
    return free >= INV_FTE[0] || `Not enough free safety research engineers (a case needs ${INV_FTE[0]}–${INV_FTE[1]})`;
  },
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
    const csScale = safetyPoolClaims(s, cs).invScale; // RD-B07: the cases' granted share after the monitors
    const gm = investigationGain(s, versionId, traits, tools, fte, cs * csScale);
    // Share of the case's work AI does (safety experiments, model v3 E2): what a sabotaging model can corrupt; model v3
    // E7: its sabotage attempts on that share (covert.ts SAFSAB, from beliefs and the measured level) × (1 − the tools'
    // verifiability), the odds resolveInvestigation draws.
    const ai = safetyLabour(s).exp.A;
    const pc = ai > 0.005 ? corruptOdds(believedSabotage(s, ai, believedCaseThreat(s, versionId, traits)), tools) : 0;
    const on = unexplained ? 'the critical traits (unexplained incident)' : TRAIT_BY_ID[trait]?.name ?? trait;
    return {
      costs: [
        { currency: 'staffTime', amount: fte, target: `safety research engineers until it resolves (≤ ${INV_MAX_DAYS} d; before validation jobs in the default order)` },
        { currency: 'compute', amount: cs, target: csScale < 1 ? `of the safety compute pool (gets ${Math.round(cs * csScale * 1000) / 10}%: the monitors come first)` : 'of the safety compute pool' },
      ],
      gains: tools.length
        ? [{ currency: 'alignment', amount: r2(gm), unit: 'clarity / mo', target: `on ${on} with ${tools.length} tool${tools.length === 1 ? '' : 's'}: ${resolveText(gm)}` }]
        : [{ currency: 'alignment', amount: 0, target: 'no unlocked tool covers this: the case cannot open' }],
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
      if (!versionId || !trait) return void ctx.log('alert', 'Investigate: no model to investigate.');
      r = openInvestigation(s, ctx, { kind: 'trait', versionId, trait }, fte, opts);
    }
    if (typeof r === 'string') ctx.log('alert', `Investigation not opened: ${r}.`, 1);
  },
};

const CLOSE_CASE: ActionDef = {
  id: 'safety.closeCase', verb: 'respond', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Close case',
  available: (s) => s.player.safety.investigations.some((i) => !i.outcome) || 'No open investigation',
  preview(s, p) {
    const inv = s.player.safety.investigations.find((i) => i.id === str(p, 'id')) ?? s.player.safety.investigations.find((i) => !i.outcome);
    return {
      costs: [{ currency: 'alignment', amount: r2(1 - (inv?.clarity ?? 0)), target: 'clarity not reached' }],
      gains: [{ currency: 'staffTime', amount: inv?.fte ?? 0, target: 'safety research engineers freed for tool upkeep' }],
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
const pctOf = (x: number) => `${Math.round(x * 100)}%`;
const pctRange = (a: number, b: number) => `${Math.round(a * 100)}–${Math.round(b * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** F6e: how removal can fall short (the engine's U-mode removal multiplier and crystallised training gaming, which the
 *  player cannot see per model). */
const SHORT = 'at most: less if the model gradient-hacks or its training gaming has crystallised';
/** F6e: the next post-training run's cost of a patch or targeted training (consumeRunPenalty in models/runs.ts). */
function runPenaltyLine(s: GameStateV2): CostLine {
  const pending = pendingRunPenalty(s);
  return { currency: 'progress', amount: -RUN_PENALTY_OOM, unit: 'OOM', target: `of G off the next post-training run${pending > 0 ? `; ${pending.toFixed(3)} OOM already pending` : ''}` };
}

function respondPreview(s: GameStateV2, kind: ResponseKind, versionId: string | undefined, incidentId: string | undefined, o: { footholdId?: string; trait?: TraitId; techniqueId?: string } = {}): Preview {
  if (kind === 'removeFoothold') return removalPreview(s, o.footholdId);
  const v = versionById(s, versionId) ?? internalVersion(s);
  const inc = incidentId ? s.player.safety.incidents.find((i) => i.id === incidentId) : undefined;
  const trait = v ? responseTrait(v, inc, o.trait) : 'SCHEME';
  const est = v?.beliefs[trait]?.est ?? 0;
  const none = (why: string): Preview => ({ costs: [{ currency: 'progress', amount: 0, target: why }], gains: [], exposure: [] });
  // F6e: every line below is what applyResponse does (safety/responses.ts), from the same constants and helpers, on
  // believed levels (beliefs, measured levels, believed strengths) only.
  switch (kind) {
    case 'patchSignal': {
      // Each edge into the trait × 0.3–0.6 lab-wide (floor 0.2); 10 safety research engineers while a patch runs.
      const pl = patchLevel(s, trait);
      const busy = s.time.day < flagNum(s, 'patchUntil', -1);
      const lo = Math.max(PATCH_FLOOR, pl.lo * PATCH_MULT[0]);
      const hi = Math.max(PATCH_FLOOR, pl.hi * PATCH_MULT[1]);
      const name = TRAIT_BY_ID[trait]?.name ?? trait;
      const now = pl.lo === pl.hi ? `×${f2(pl.hi)}` : `×${f2(pl.lo)}–${f2(pl.hi)}`;
      return {
        costs: [
          { currency: 'staffTime', amount: busy ? 0 : PATCH_FTE, target: busy ? `safety research engineers already on a patch: it runs ${PATCH_DAYS[0]}–${PATCH_DAYS[1]} d from today` : `safety research engineers for ${PATCH_DAYS[0]}–${PATCH_DAYS[1]} d` },
          runPenaltyLine(s),
        ],
        gains: pl.n === 0 || pl.atFloor
          ? [{ currency: 'alignment', amount: 0, target: pl.n ? `training pressure into ${name} is already at the floor ×${PATCH_FLOOR}: no further effect` : `no training pressure feeds ${name}` }]
          : [{ currency: 'alignment', amount: pl.n, unit: pl.n === 1 ? 'training pressure' : 'training pressures', target: `into ${name}: weight ${now} → ×${f2(lo)}–${f2(hi)} on every later run, lab-wide (floor ×${PATCH_FLOOR})` }],
        exposure: [],
      };
    }
    case 'retrainAgainst': {
      // goodhartTrain: true −20–40% (× removal), the detector family's reading −70–90% (a mask), OBF +0.1, the
      // detector's trainedAgainst +1 (its strength × (1 − G·n)). The detector is the one apply picks (bestDetector).
      if (!v) return none('no model');
      const tid = o.techniqueId ?? bestDetector(s, v, trait);
      const t = tid ? s.player.safety.techniques[tid] : undefined;
      if (!t) return none(`no active detector covers ${trait}: nothing to train against`);
      const X = measuredOom(s, v);
      const sNow = strengthBelieved(s, t, X);
      const sAfter = strengthBelieved(s, { ...t, trainedAgainst: t.trainedAgainst + 1 }, X);
      const name = TECHNIQUE_BY_ID[t.id]?.name ?? t.id;
      const obf = v.beliefs.OBF?.est ?? 0;
      return {
        costs: [
          { currency: 'monitorability', amount: -r2(sNow - sAfter), unit: 'strength', target: `${name} ${f2(sNow)} → ${f2(sAfter)} (Goodhart ${t.goodhart} per retrain)` },
          { currency: 'monitorability', amount: -RETRAIN_OBF, unit: 'OBF', target: `obfuscated reasoning (believed ${f2(obf)} → ${f2(Math.min(1, obf + RETRAIN_OBF))}): CoT monitors read less` },
        ],
        gains: [{ currency: 'alignment', amount: r2(est * (RETRAIN_TRUE[0] + RETRAIN_TRUE[1]) / 2), unit: trait, target: `true level −${pctRange(RETRAIN_TRUE[0], RETRAIN_TRUE[1])} (believed ${f2(est)} → ${f2(est * (1 - RETRAIN_TRUE[1]))}–${f2(est * (1 - RETRAIN_TRUE[0]))}, ${SHORT})` }],
        exposure: [{ currency: 'monitorability', amount: -1, unit: 'mask', probability: 1, target: `hides more than it heals: ${t.family} tools will read ${trait} at ${pctRange(1 - RETRAIN_VISIBLE[1], 1 - RETRAIN_VISIBLE[0])} of today's reading` }],
      };
    }
    case 'targetedTraining': {
      // targetedPlan with AG18's BELIEVED efficacy (apply uses the true one): the traits it cuts, raises, E25's EA and
      // inoculation's E04 patch.
      if (!v) return none('no model');
      const plan = targetedPlan(s, v, trait, believedEfficacy(s, 'AG18'));
      const by = plan.technique ? TECHNIQUE_BY_ID[plan.technique]?.name ?? plan.technique : 'generic alignment training (AG18, believed efficacy)';
      const b = (k: TraitId) => v.beliefs[k]?.est ?? 0;
      const gains: CostLine[] = [];
      for (const [k, c] of Object.entries(plan.cut) as [TraitId, number][]) {
        gains.push({ currency: 'alignment', amount: b(k) * c, unit: k, target: `believed ${f2(b(k))} → ${f2(b(k) * (1 - c))}: ${by} removes ${pctOf(c)} (${SHORT})` });
      }
      for (const [k, a] of Object.entries(plan.add) as [TraitId, number][]) {
        gains.push({ currency: 'alignment', amount: a, unit: k, target: `${TRAIT_BY_ID[k]?.name ?? k} believed ${f2(b(k))} → ${f2(Math.min(1, b(k) + a))}` });
      }
      if (plan.patchE04 !== undefined) {
        const w = flagNum(s, 'patch.lab.E04', 1);
        gains.push({ currency: 'alignment', amount: 1, unit: 'training pressure', target: `hacking → persona drift (E04): weight ×${f2(w)} → ×${f2(w * plan.patchE04)} on every later run, lab-wide` });
      }
      return {
        costs: [runPenaltyLine(s)],
        gains,
        exposure: plan.eaMult ? [{ currency: 'monitorability', amount: -(Math.min(1, b('EA') * ANTISCHEME_EA_MULT) - b('EA')), unit: 'EA', probability: 1, target: `eval awareness ×${ANTISCHEME_EA_MULT} (believed ${f2(b('EA'))} → ${f2(Math.min(1, b('EA') * ANTISCHEME_EA_MULT))}): first anti-scheming training on this lineage (E25)` }] : [],
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
          { currency: 'progress', amount: -Math.round(c.tax * 100), unit: '%', target: 'of internal AI labour at most (control tax)' },
          // SR-13b: the trusted model's compute, from the monitors' line (internal) or the product's serving.
          { currency: 'compute', amount: -Math.round(controlComputeShare('defer10') * 1000) / 10, unit: '%', target: "of the deployment's compute: from the monitors' line (internal agents) or the product's serving" },
        ],
        gains: [{ currency: 'security', amount: r2(1 - c.missMult), target: `bad actions slipping past monitors ×${c.missMult.toFixed(2)}; containment tools block` }],
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
        costs: [{ currency: 'security', amount: -r2(1 - c.missMult), target: `monitors miss more (×${(1 / Math.max(1e-9, c.missMult)).toFixed(2)}); containment tools stop blocking` }],
        gains: [{ currency: 'progress', amount: internal ? Math.round(c.tax * 100) : 0, unit: '%', target: internal ? 'of internal AI labour back at most (control tax ends)' : 'no internal control tax on this model' }],
        exposure: dd.sites > 0 ? [{ currency: 'alignment', amount: -r2(dd.after - dd.now), probability: 1, target: `believed harmful acts ${fmt(dd.now)} → ${fmt(dd.after)} / yr at ${dd.sites} site${dd.sites === 1 ? '' : 's'}`, unit: 'acts/yr' }] : [],
      };
    }
    case 'addLockdown':
    case 'removeLockdown': {
      // SR-13b: comms lockdown on the model's internal agents: collusion penalty ×LOCKDOWN_COLLUSION_MULT, Slowdown
      // LOCKDOWN_SLOWDOWN on internal AI work (departments/workfit.ts useLabour).
      const add = kind === 'addLockdown';
      const deps = v ? s.player.deployments.filter((d) => d.versionId === v.id && d.channel === 'internal' && (add ? d.status === 'live' : lockdownOnDep(d))) : [];
      if (!deps.length) return none(add ? 'no internal agent package runs this model' : 'no comms lockdown on this model');
      const why = add ? cannotAdd(s, deps[0], 'lockdown') : undefined;
      if (why) return none(why);
      const slow: CostLine = { currency: 'progress', amount: add ? -Math.round(LOCKDOWN_SLOWDOWN * 100) : Math.round(LOCKDOWN_SLOWDOWN * 100), unit: '%', target: add ? 'of internal AI work (comms lockdown Slowdown)' : 'of internal AI work back (lockdown Slowdown ends)' };
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
        costs: [{ currency: 'progress', amount: -(Lv - Lp), target: `measured L ${Lv.toFixed(1)} → ${Lp.toFixed(1)}: ${where}` }],
        gains: est >= pEst ? [traitLine] : [],
        exposure: est < pEst ? [{ ...traitLine, probability: 1 }] : [],
      };
    }
    case 'disclose': {
      // Apply: scrutiny 3 + 2·severity; trust per evaluator / exec by credibility and its own trust (discloseTrust); the
      // incident's public timer ends; the world learns the discovered U-modes it shows.
      const dT = DISCLOSE_CPS.map((cp) => [cp, discloseTrust(s, cp)] as const);
      const mean = dT.reduce((a, [, d]) => a + d, 0) / dT.length;
      const trust: CostLine = { currency: 'trust', amount: r2(mean), target: `mean of ${dT.map(([cp, d]) => `${cp} ${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`).join(', ')} (credibility ${Math.round(s.relations.credibility)}${s.relations.credibility < 30 ? ', under 30: costs trust' : ''})` };
      const newU = s.player.safety.discoveredUModes.filter((u) => !s.knowledge.revealedUModes.includes(u)).length;
      const timer = inc?.publicTimerDays !== undefined;
      return {
        costs: [{ currency: 'scrutiny', amount: discloseScrutiny(inc), target: inc ? `incident severity ${inc.severity}` : 'severity 2 (no incident)' }, ...(mean < 0 ? [trust] : [])],
        gains: [
          ...(mean >= 0 ? [trust] : []),
          ...(timer ? [{ currency: 'trust' as const, amount: 1, unit: 'incident', target: 'disclosed before its public timer ends: no cover-up if outsiders find it' }] : []),
        ],
        exposure: newU > 0 ? [{ currency: 'alignment', amount: newU, unit: newU === 1 ? 'U-mode' : 'U-modes', probability: 1, target: `at most: the world learns the discovered failure modes this ${inc ? 'incident' : 'model'} shows (${newU} not yet public)` }] : [],
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
    return respondPreview(s, RESPONSE_KINDS.includes(kind) ? kind : 'patchSignal', versionId, str(p, 'incidentId'), { footholdId: str(p, 'footholdId'), trait: isTrait(str(p, 'trait')) ? (str(p, 'trait') as TraitId) : undefined, techniqueId: str(p, 'techniqueId') });
  },
  apply(s, ctx, p) {
    const kind = str(p, 'kind') as ResponseKind;
    if (!RESPONSE_KINDS.includes(kind)) return void ctx.log('alert', 'Respond: pick a response.');
    const inc = str(p, 'incidentId') ? s.player.safety.incidents.find((i) => i.id === str(p, 'incidentId')) : undefined;
    const versionId = str(p, 'versionId') ?? inc?.versionId ?? s.player.agents.capRoutine.versionId ?? '';
    const err = applyResponse(s, ctx, kind, versionId, inc?.id, { trait: isTrait(str(p, 'trait')) ? (str(p, 'trait') as TraitId) : undefined, techniqueId: str(p, 'techniqueId'), footholdId: str(p, 'footholdId') });
    if (err) ctx.log('alert', `${RESPONSE_INFO[kind].title}: ${err}.`, 1);
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
      gains: [{ currency: 'credibility', amount: 2 }, { currency: 'talent', amount: 1 }, { currency: 'alignment', amount: disc ? 0.04 : 0.02, target: "rivals' alignment (shared pool)" }],
      exposure: [{ currency: 'approval', amount: -1, probability: disc ? 0.3 : 0.05, target: 'model-organism papers raise public concern' }],
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
    // SR-01 (inventory O1): what apply does. "all" publishes each new result as it lands (publishFinding: credibility
    // +2, talent pull +1, rivals share it); "selective" and "none" publish nothing by themselves. The policy also sets
    // the Safety Index's publishing score (gradePlayer on a copy).
    const raw = str(p, 'policy') ?? 'all';
    const pol: 'none' | 'selective' | 'all' = raw === 'none' || raw === 'selective' ? raw : 'all';
    const idx = indexLines(s, (c) => (c.player.policies.publishSafety = pol));
    const costs: CostLine[] = [];
    const gains: CostLine[] = [];
    if (pol === 'all') {
      const perYear = (Object.keys(s.player.safety.agendas) as AgendaId[]).reduce((a, ag) => a + lineResultsPerYear(s, ag), 0);
      const lag = perYear > 0 ? Math.max(1, Math.round(365 / perYear)) : 365;
      const pace = perYear > 0 ? `about ${perYear.toFixed(1)} results a year at today's staffing` : 'no line is producing results now';
      gains.push(
        { currency: 'credibility', amount: 2, unit: 'per result', lagDays: lag, target: `each new result is published when it lands (${pace})` },
        { currency: 'talent', amount: 1, unit: 'per result', lagDays: lag, target: 'safety researchers like labs that publish' },
      );
      costs.push({ currency: 'alignment', amount: 0, target: "rivals learn each result too: the shared safety pool +0.02 per tool or eval, +0.04 per discovery" });
    } else {
      costs.push({ currency: 'credibility', amount: 0, target: pol === 'none' ? 'nothing is published unless you press Publish on a result' : 'you choose each result to publish (Publish on the result)' });
    }
    for (const l of idx) (l.amount >= 0 ? gains : costs).push(l);
    return { costs, gains, exposure: [] };
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
  // SR-01 (inventory O2): what apply does: credibility +8, government evaluators' trust +4, a live commitment, and in
  // training the push toward obfuscated reasoning (E15) ×0.5. It blocks no design choice; breaking it costs its
  // breakCost. The Safety Index effect is gradePlayer on a copy with the commitment.
  preview: (s) => {
    const idx = indexLines(s, (c) => {
      c.player.safety.monitorabilityCommitment = true;
      c.commitments.push({ id: 'C-mon-preview', kind: 'monitorabilityPledge', title: 'Monitorability pledge', condition: { predicate: 'monitorabilityPledge', params: {} }, audience: [], breakCost: { trust: 15, credibility: 20 }, signedDay: s.time.day, status: 'live', amendments: 0 });
    });
    return {
      costs: [
        { currency: 'credibility', amount: 0, target: 'a public promise: it blocks no design choice, but breaking it later costs credibility −20 and trust −15 with evaluators and the safety bloc' },
        ...idx.filter((l) => l.amount < 0),
      ],
      gains: [
        { currency: 'credibility', amount: 8 },
        { currency: 'trust', amount: 4, target: 'evalGov' },
        { currency: 'monitorability', amount: 0.5, unit: '×', target: 'training pushes toward obfuscated reasoning half as hard' },
        ...idx.filter((l) => l.amount >= 0),
      ],
      exposure: [],
    };
  },
  apply(s, ctx) {
    s.player.safety.monitorabilityCommitment = true;
    if (!s.commitments.some((c) => c.kind === 'monitorabilityPledge' && c.status === 'live')) {
      s.commitments.push({
        id: `C-mon-${ctx.day}`, kind: 'monitorabilityPledge', title: 'Monitorability pledge',
        condition: { predicate: 'monitorabilityPledge', params: {} }, audience: ['evalGov', 'evalIndep', 'bloc:safety'],
        breakCost: { trust: 15, credibility: 20 }, signedDay: ctx.day, status: 'live', amendments: 0,
      });
    }
    ctx.bump('relations.credibility', 8, 'monitorability pledge');
    ctx.bump('trust:evalGov', 4, 'monitorability pledge');
    ctx.log('company', 'We pledge to keep reasoning legible: no latent reasoning, no CoT pressure.', 3);
  },
};

/** Model v3 D7: the days a release waits are the gate depth's eval suite at today's rates (models/evals.ts). */
const GATES: SafetyDept['evalGate'][] = ['none', 'basic', 'full', 'fullPlusExternal'];

const EVAL_GATE: ActionDef = {
  id: 'safety.evalGate', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Eval gate',
  available: () => true,
  preview(s, p) {
    const g = (str(p, 'level') as SafetyDept['evalGate']) ?? 'fullPlusExternal';
    const to = GATES.includes(g) ? g : 'fullPlusExternal';
    // SR-01 (inventory E1): what apply does. The gate holds new EXTERNAL products until the suite is done (internal
    // use is not gated, models/deployments.ts); with the propensity evals tool, a gate also weakens hacking → persona
    // drift (E01) ×0.7 in training (safety/traits.ts playerMods); the Safety Index reads an external gate.
    const from = s.player.safety.evalGate;
    const d = evalDaysFor(s, to) - evalDaysFor(s, from);
    const costs: CostLine[] = [];
    const gains: CostLine[] = [];
    const wait: CostLine = { currency: 'leadDays', amount: -d, target: 'each new external product waits this much longer for its eval suite; internal use is never held' };
    if (d > 0) costs.push(wait);
    else if (d < 0) gains.push(wait);
    else costs.push({ ...wait, target: 'no change in how long external launches wait' });
    if (s.player.safety.techniques['T-PROP']?.unlocked && (from === 'none') !== (to === 'none')) {
      const line: CostLine = { currency: 'alignment', amount: 1, unit: 'training pressure', target: `reward hacking → persona drift in training: weight ${to === 'none' ? '×0.7 → ×1' : '×1 → ×0.7'} (with propensity evals)` };
      if (to === 'none') costs.push({ ...line, amount: -1 });
      else gains.push(line);
    }
    for (const l of indexLines(s, (c) => (c.player.safety.evalGate = to))) (l.amount >= 0 ? gains : costs).push(l);
    return { costs, gains, exposure: [] };
  },
  apply(s, ctx, p) {
    const g = str(p, 'level') as SafetyDept['evalGate'];
    if (!GATES.includes(g)) return void ctx.log('alert', 'Eval gate: none, basic, full or fullPlusExternal.');
    s.player.safety.evalGate = g;
    ctx.log('company', `Pre-deployment eval gate: ${g}.`, 1);
  },
};

/** SR-09: the instruments a validate action queues (tool id, or 'all' = every owned instrument not measured on the model). */
function validateTargets(s: GameStateV2, p: P): { model: string; tools: TechniqueState[] } {
  const model = str(p, 'model') ?? internalVersion(s)?.id ?? '';
  const tool = str(p, 'tool') ?? 'all';
  const tools = tool === 'all'
    ? instruments(s).filter((t) => canValidate(s, t.id, model) === true)
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
    // cases. Believed inputs only (the range shown is today's believed range and the sample's width).
    const { model, tools } = validateTargets(s, p);
    const v = versionById(s, model);
    if (!v || !tools.length) return { costs: [{ currency: 'staffTime', amount: 0, target: v ? `nothing to validate on ${v.name}: every instrument is measured or queued` : 'no such model' }], gains: [], exposure: [] };
    const ahead = s.player.safety.validation?.jobs.length ?? 0;
    const per = jobEngineers(s);
    const r0 = validationRange(s, tools[0], v);
    const sr = sampleRange(Math.round(r0.value * VAL_N), VAL_N);
    return {
      costs: [
        { currency: 'staffTime', amount: Math.round(per * tools.length * 10) / 10, target: `safety research engineers for about ${VAL_DAYS} d at full staffing (${tools.length} job${tools.length === 1 ? '' : 's'}; ${ahead} already queued ahead)` },
        { currency: 'compute', amount: 0, target: "a quarter of a serious line project's experiment compute per job while it runs (the lines get less)" },
      ],
      gains: [{ currency: 'alignment', amount: tools.length, unit: 'instruments', target: `validated on ${v.name}: reliability measured from ${VAL_N} planted cases (e.g. ${instrumentName(tools[0])} now ${Math.round(r0.lo * 100)}–${Math.round(r0.hi * 100)}%, ${r0.basis}; after: about ±${Math.round(sr.half * 100)} points)` }],
      exposure: [],
    };
  },
  apply(s, ctx, p) {
    const { model, tools } = validateTargets(s, p);
    if (!tools.length) return void ctx.log('alert', 'Validate: nothing to validate on that model.');
    for (const t of tools) queueValidation(s, t.id, model, 'player', ctx.day);
    ctx.log('research', `Validation queued: ${tools.length} instrument${tools.length === 1 ? '' : 's'} on ${versionById(s, model)?.name ?? model}.`, 1);
  },
};

const VALIDATION_POLICY: ActionDef = {
  id: 'safety.validationPolicy', verb: 'policy', system: 'safety', sphere: 'safety', owner: 'WS2', title: 'Validate each new model',
  available: () => true,
  preview(s, p) {
    // SR-09: what apply does: with the policy on, every owned instrument is queued for validation when a new internal
    // model arrives; off, nothing is queued by itself.
    const on = p.on !== false;
    const n = instruments(s).length;
    return on
      ? { costs: [{ currency: 'staffTime', amount: Math.round(jobEngineers(s) * n * 10) / 10, target: `on each new internal model: ${n} jobs of about ${VAL_DAYS} d at full staffing` }], gains: [{ currency: 'alignment', amount: n, unit: 'instruments', target: 'measured on each new model' }], exposure: [] }
      : { costs: [{ currency: 'alignment', amount: 0, target: 'new models are not validated unless you queue it: reliability there is extrapolated, with a wider range' }], gains: [], exposure: [] };
  },
  apply(s, ctx, p) {
    validationOf(s).autoNew = p.on !== false;
    ctx.log('company', `Validate instruments on each new model: ${p.on !== false ? 'on' : 'off'}.`, 1);
  },
};

export const SAFETY_ACTIONS: ActionDef[] = [INVESTIGATE, CLOSE_CASE, RESPOND, PUBLISH, POLICY, PLEDGE, EVAL_GATE, VALIDATE, VALIDATION_POLICY];


