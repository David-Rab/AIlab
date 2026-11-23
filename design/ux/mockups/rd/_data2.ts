// Mockup data v2: player-visible values for TRAINING › Next run, RESEARCH › Know-how, SAFETY › Risks and the MODELS card
// on the day-400 fixture, via the selectors the UI panels call. Run from the worktree root:
//   npx tsx design/ux/mockups/rd/_data2.ts  → design/ux/mockups/rd/data400b.json
// Never reads s.hidden / true traits / version.domains / version.build / true stack buckets directly; selectors that do are
// listed in _flags and their outputs are dropped or replaced by a believed alternative computed here.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../../../src/engine/v2/core/save';
import { FIXTURE_DIR } from '../../../../scripts/v2/lib';
import {
  MILESTONE_NAMES, PARAM_SNAPS, REF_TPP, RUN_PARAM_DEFAULTS, RUN_POOL_DEFAULT, RL_BUDGET, STUDENT_DEFAULT, baseFromParams, postFromParams, capPriorityList, controlReadout,
  dangerView, dateOf, drawByDomain, evalDaysFor, flopPerToken, fmtDate, internalEval, internalVersion, lossOfControlRisk, measuredDomains, measuredSd,
  ownedMethods, againstOptions, methodPolicyOn, plannedPressure, plannedSightLimit, runCard, runFlopPerShareDay, runTraitPressure, safetyView, sightGrid, sightLimit,
  softwareRate, stackViews, suitesView, unstoppedHarmPerYear, useHourCost, usesOf, versionById, benchName, dataSpecView, studentToHold, measuredDelta,
} from '../../../../src/engine/v2';
import type { GameStateV2, LaunchRunParams, ModelVersion, TraitId } from '../../../../src/engine/v2';
import { actTable } from '../../../../src/engine/v2/safety/actTable';
import { internalFleets } from '../../../../src/engine/v2/departments/agents';
import { instruments, validatedLabel, instrumentName } from '../../../../src/engine/v2/safety/instruments';
import { bestPlayerVersion } from '../../../../src/engine/v2/models/labs';
import { BENCHMARKS } from '../../../../src/data/v2/benchmarks';
import { LEVEL_KNOTS } from '../../../../src/data/v2/calibration';
import { FRAMEWORK_CRITICAL_L } from '../../../../src/data/v2/framework';
import { TRAIT_BY_ID } from '../../../../src/data/v2/traits';
import { TECHNIQUE_BY_ID } from '../../../../src/data/v2/techniques';
import { DANGER_ACTS, COVERT_ACTS, MISUSE } from '../../../../src/data/v2/danger';

const FILE = process.argv[2] ?? 'day400.json';
const s = deserialize(readFileSync(join(FIXTURE_DIR, FILE), 'utf8')) as GameStateV2;
const p = s.player;
const r3 = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : x === Infinity ? 'Infinity' : x === -Infinity ? '-Infinity' : 'NaN');
const clean = (o: unknown): unknown => {
  if (typeof o === 'number') return r3(o);
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && typeof v !== 'function').map(([k, v]) => [k, clean(v)]));
  return o;
};
const errors: Record<string, string> = {};
const tryy = <T>(k: string, f: () => T): T | undefined => { try { return f(); } catch (e) { errors[k] = String((e as Error)?.stack ?? e).split('\n').slice(0, 3).join(' | '); return undefined; } };
/** OOM → multiplier ×10^x. */
const X = (oom: number) => Math.pow(10, oom);
const DOMS = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO', 'PHYS'] as const;
const DOM_NAME: Record<string, string> = { CODE: 'Code', RSCH: 'AI research', REASON: 'Math & reasoning', AGENCY: 'Long tasks', SOCIAL: 'Social', MEDIA: 'Media', CYBER: 'Cyber', BIO: 'Bio', PHYS: 'Physical' };
const Z90 = 1.64;
const mid = (b: [number, number]) => (b[0] + b[1]) / 2;
const day = s.time.day;
const date = (d: number) => fmtDate(dateOf(s, d));

/** Milestone rung levels on the 0–15 display scale (capability.ts LEVEL_KNOTS ↔ MILESTONE_NAMES; fixed, no world parameter). */
const RUNGS = MILESTONE_NAMES.map((name, i) => ({ idx: i, name, level: LEVEL_KNOTS[i], metDay: p.milestoneDays[i as 0], metDate: p.milestoneDays[i as 0] !== undefined ? date(p.milestoneDays[i as 0]!) : undefined }));
const rungAt = (L: number) => [...RUNGS].reverse().find((r) => L >= r.level)?.name ?? 'below Agent';

/** Measured domains with the 90% range (measuredSd of the version's fit: the band the Models card shows ±). A version with
 *  no fit of its own (evaluating) gets NO domains: measuredDomain would fall back to v.Lg + v.domains (truth); instead the
 *  nearest measured ancestor's fit is given as `inherited` (measuredLOf's rule, labs.ts:54). */
function measured(v: ModelVersion): Record<string, unknown> {
  if (v.evals.measuredL === undefined) {
    let a = p.models.versions.find((x) => x.id === v.parentVersionId);
    for (let i = 0; a && a.evals.measuredL === undefined && i < 50; i++) { const pid = a.parentVersionId; a = p.models.versions.find((x) => x.id === pid); }
    return { L: undefined, notMeasuredYet: true, status: v.status, inherited: a ? { from: a.name, ...measured(a) } : undefined };
  }
  const dom = measuredDomains(v);
  const sd = measuredSd(v);
  const fitted = v.evals.measuredDom ?? {};
  return {
    L: v.evals.measuredL, Lsd: sd, Lrange90: [v.evals.measuredL - Z90 * sd, v.evals.measuredL + Z90 * sd], milestoneOfL: rungAt(v.evals.measuredL),
    domains: Object.fromEntries(DOMS.map((d) => [d, fitted[d] !== undefined ? { name: DOM_NAME[d], L: dom[d], range90: [dom[d] - Z90 * sd, dom[d] + Z90 * sd] } : { name: DOM_NAME[d], L: null, note: 'no benchmark fit (UI falls back to true offset; withheld)' }])),
  };
}
/** Domain levels of a measured version (fitted only). */
const fitDom = (v?: ModelVersion) => (v?.evals.measuredDom ?? {}) as Partial<Record<string, number>>;
/** Believed best model: the highest measured general level among live versions (bestPlayerVersion ranks by TRUE G). */
const bestMeasured = () => p.models.versions.filter((v) => v.status !== 'retired' && v.status !== 'rolledBack' && v.evals.measuredL !== undefined).sort((a, b) => b.evals.measuredL! - a.evals.measuredL!)[0];

// ───────── 1. TRAINING › Next run (Blueprint default plan) ─────────
type Params = Record<string, string | number | boolean>;
const DEFAULTS: Params = { ...RUN_PARAM_DEFAULTS };
type Kind = 'base' | 'post' | 'distill' | 'continue';
const latestTeacher = () => p.models.versions.filter((v) => v.variant === 'full' && v.status !== 'retired').slice(-1)[0]?.id ?? '';
function toLP(kind: Kind, q: Params): LaunchRunParams {
  const lp: LaunchRunParams = { kind, poolShare: Number(q.poolShare) };
  if (kind === 'base') lp.base = baseFromParams(q as never);
  if (kind === 'post') { lp.post = postFromParams(q as never, s); lp.baseId = String(q.baseId); }
  if (kind === 'continue') lp.baseId = String(q.baseId);
  if (kind === 'distill') {
    lp.teacherVersionId = String(q.teacherVersionId || latestTeacher());
    const t = p.models.versions.find((v) => v.id === lp.teacherVersionId);
    const hold = q.holdVersionId ? p.models.versions.find((v) => v.id === q.holdVersionId) : undefined;
    if (t && hold) lp.studentParams = studentToHold(s, t, hold);
  }
  return lp;
}
const evaluate = (kind: Kind, q: Params) => { const lp = toLP(kind, q); try { return { card: runCard(s, lp), tp: runTraitPressure(s, lp) }; } catch (e) { return { err: String((e as Error).message), tp: {} as Partial<Record<TraitId, number>> }; } };
const wallOf = (c?: ReturnType<typeof runCard>) => (c ? (c.limits?.wallDays ?? c.etaDays) : Infinity);
const unlockedBase = !s.setup.tutorial || s.tutorial.unlocked.includes('*') || s.tutorial.act >= 2; // ui.tsx unlocked('baseRuns')
const FAMILIES = [
  { id: 'please', label: 'People-pleasing', traits: ['SYC', 'PERSONA'] }, { id: 'gaming', label: 'Gaming', traits: ['RH', 'PROXY', 'TGAME'] },
  { id: 'deception', label: 'Deception', traits: ['EA', 'CONCEAL', 'OBF', 'AF', 'SAND', 'SCHEME'] }, { id: 'power', label: 'Power', traits: ['POWER', 'SUCC', 'COLLUDE'] },
] as const;

const T = tryy('training', () => {
  const lastBase = p.models.bases[p.models.bases.length - 1];
  const snaps = PARAM_SNAPS as readonly number[];
  const walls = snaps.map((v) => wallOf(evaluate('base', { ...DEFAULTS, params: v, tpp: REF_TPP, poolShare: RUN_POOL_DEFAULT.base }).card));
  let fit = { params: snaps[0], ok: walls[0] <= 240 };
  for (let i = snaps.length - 1; i >= 0; i--) if (walls[i] <= 182) { fit = { params: snaps[i], ok: true }; break; }
  const kind: Kind = unlockedBase && (fit.ok || !lastBase) ? 'base' : 'post';
  const defFor = (k: Kind): Params => ({ ...DEFAULTS, params: fit.params, poolShare: RUN_POOL_DEFAULT[k], baseId: lastBase?.id ?? '', ...(lastBase?.design.shape === 'latent' ? { cot: 'latent' } : {}) });
  const iv = internalVersion(s);
  const best = bestMeasured();
  const ivM = iv ? measured(iv) : undefined;
  const ivRef = iv ? (iv.evals.measuredL !== undefined ? iv : p.models.versions.find((x) => x.name === (ivM?.inherited as { from?: string } | undefined)?.from)) : undefined;
  const plans: Record<string, unknown> = {};
  for (const k of (['base', 'post', 'distill', 'continue'] as Kind[])) {
    const q = defFor(k);
    const ev = evaluate(k, q);
    const c = ev.card;
    if (!c) { plans[k] = { err: ev.err }; continue; }
    const pr = tryy(`pressure.${k}`, () => plannedPressure(s, toLP(k, q)));
    const predL = mid(c.band);
    const evals = k === 'base' ? 0 : evalDaysFor(s);
    const post = k === 'base' ? Math.ceil((RL_BUDGET.standard * c.flop) / Math.max(1, runFlopPerShareDay(s, { kind: 'post' }) * RUN_POOL_DEFAULT.post)) : 0;
    const L = c.limits;
    const cost = useHourCost(s, c.fpt);
    const ivCost = iv ? useHourCost(s, flopPerToken(s, iv)) : undefined;
    plans[k] = {
      params: q, err: ev.err, blockedReason: c.reason,
      prediction: {
        from: c.forecastRef, sd: c.forecastSd, L: predL, band: c.band, range90: [predL - Z90 * c.forecastSd, predL + Z90 * c.forecastSd], milestone: rungAt(predL), milestoneAtTop: rungAt(c.band[1]),
        vsInternalL: predL - internalEval(s).L, internalLFrom: ivRef?.name, vsForecastRefL: predL - (p.models.versions.find((x) => x.name === c.forecastRef)?.evals.measuredL ?? NaN),
        domains: Object.fromEntries(DOMS.map((d) => { const b = c.domains[d] as [number, number] | undefined; return [d, b ? { L: mid(b), band: b, milestone: rungAt(mid(b)), vsInternal: fitDom(ivRef)[d] !== undefined ? mid(b) - fitDom(ivRef)[d]! : undefined, vsForecastRef: fitDom(p.models.versions.find((x) => x.name === c.forecastRef))[d] !== undefined ? mid(b) - fitDom(p.models.versions.find((x) => x.name === c.forecastRef))[d]! : undefined } : null]; })),
        monitorability: c.monitorability,
      },
      limits: {
        flop: c.flop, tokens: L?.tokens, activeParams: L?.params, tpp: L?.tpp,
        wallDays: wallOf(c), trainDays: c.etaDays - c.setupDays, ends: date(day + wallOf(c)), poolShareAsked: c.poolShare, poolShareGets: c.effShare,
        computeDaysAtShare: c.etaDays - c.setupDays,
        refPostTrainDays: post, evalDays: evals, readyDate: date(day + c.etaDays + post + evals),
        data: L ? { epochs: L.epochs, uniqueTokens: L.tokensUnique, keptShare: L.fData, keptOom: Math.log10(Math.max(1e-12, L.fData)), meanQuality: L.draw.quality, drawn: tryy(`draw.${k}`, () => drawByDomain(s, L.draw)) } : undefined,
        cash: { atLaunch: c.cash, ofCash: c.cash / Math.max(0.01, p.finance.cash), cashNow: p.finance.cash, computeEquivCost: L?.computeCost },
        serving: { fpt: c.fpt, costPerHour: cost.hour, agentHour: cost.agentHour, internalTodayFpt: iv ? flopPerToken(s, iv) : undefined, internalTodayCostHour: ivCost?.hour, relToInternal: iv ? c.fpt / flopPerToken(s, iv) : undefined },
        runOps_engineers: { setupTeamWeeks: c.setupTW, setupDays: c.setupDays, buildQueueAhead: p.build.queue.length },
        behindAtFinish: L?.behind,
      },
      sightLimit: tryy(`sight.${k}`, () => plannedSightLimit(s, predL)),
      pressure: pr ? { omega: (pr as { omega?: number }).omega, rows: (pr as { rows?: unknown }).rows, raw: pr } : undefined,
      riskFamiliesPredictedBeliefChange: Object.fromEntries(FAMILIES.map((f) => [f.id, { label: f.label, sum: f.traits.reduce((a, t) => a + (ev.tp[t as TraitId] ?? 0), 0), traits: Object.fromEntries(f.traits.map((t) => [t, ev.tp[t as TraitId] ?? 0])) }])),
    };
  }
  // Each option's own effect (Blueprint effectOf): vs the same design with that slot at the reference card.
  const effects = (k: Kind, field: string, opts: (string | boolean)[], toggle = false) => {
    const q = defFor(k);
    const ref = evaluate(k, { ...q, [field]: DEFAULTS[field] });
    return Object.fromEntries(opts.map((o) => {
      const cur = toggle ? evaluate(k, { ...q, [String(o)]: true }) : evaluate(k, field === 'rlFocus' ? { ...q, rlFocus: String(o) } : { ...q, [field]: o });
      const base = toggle ? evaluate(k, { ...q, [String(o)]: false }) : ref;
      const c = cur.card, b = base.card;
      if (!c || !b) return [String(o), { err: cur.err ?? base.err }];
      return [String(o), {
        skillL: mid(c.band) - mid(b.band), days: c.etaDays - b.etaDays, cash: c.cash - b.cash, servingX: b.fpt > 0 ? c.fpt / b.fpt : 1, blocked: c.reason,
        domainsL: Object.fromEntries(DOMS.map((d) => [d, c.domains[d] && b.domains[d] ? mid(c.domains[d] as [number, number]) - mid(b.domains[d] as [number, number]) : 0]).filter(([, v]) => Math.abs(v as number) >= 0.05)),
        risk: Object.fromEntries(FAMILIES.map((f) => [f.id, f.traits.reduce((a, t) => a + (cur.tp[t as TraitId] ?? 0) - (base.tp[t as TraitId] ?? 0), 0)])),
      }];
    }));
  };
  const sizeRows = snaps.map((v, i) => ({ params: v, wallDays: walls[i], flop: 6 * v * v * REF_TPP, tokens: v * REF_TPP }));
  const options = {
    kinds: { available: [...(unlockedBase ? ['base'] : []), 'post', 'distill', ...(unlockedBase ? ['continue'] : [])], default: kind, labels: { base: 'New base (pretrain)', continue: 'Continue base', distill: 'Distil', post: 'Post-train' } },
    size: { default: fit.params, feasible: fit.ok, snaps: sizeRows, latestBase: lastBase ? { name: lastBase.name, params: lastBase.params, tpp: lastBase.design.tpp } : undefined },
    tokensPerParam: { default: DEFAULTS.tpp, ref: REF_TPP },
    base: {
      shape: effects('base', 'shape', ['moe', 'dense', 'latent']),
      data: effects('base', 'data', ['balanced', 'codeMath', 'science', 'synthetic', 'multimodal']),
      filter: effects('base', 'filter', ['quality', 'hazard', 'safetyPretrain'], true),
    },
    post: {
      rlFocus: effects('post', 'rlFocus', ['broad', 'swe', 'math', 'longHorizon', 'mlResearch', 'computerUse', 'cyber', 'bio']),
      rlBudget: effects('post', 'rlBudget', ['standard', 'heavy', 'light']),
      cot: effects('post', 'cot', ['visible', 'pressured', 'faithful', 'latent']),
      pref: effects('post', 'pref', ['constitution', 'engagement', 'persuasion', 'minimal']),
      safety: effects('post', 'safety', ['standard', 'heavy', 'minimal']),
      environments: tryy('suites', () => { const v = suitesView(s, postFromParams(defFor('post') as never).rlFocus); return { weightedFidelity: v.weighted.fid, weightedExploitable: v.weighted.exploit, rows: v.rows }; }),
      methods: { owned: ownedMethods(s).map((id) => ({ id, name: TECHNIQUE_BY_ID[id]?.name ?? id })), trainAgainstOptions: againstOptions(s), useAllKnownPolicy: methodPolicyOn(s), defaultUsed: postFromParams(defFor('post') as never, s).methods },
    },
    distill: { studentDefaultShareOfTeacher: STUDENT_DEFAULT, teacher: versionById(s, latestTeacher())?.name },
  };
  return {
    bestModel_measured: best ? { name: best.name, ...measured(best) } : null,
    bestModel_engine: bestPlayerVersion(s)?.name, // name only: bestPlayerVersion ranks by TRUE G (flagged)
    internalModel: iv ? { name: iv.name, ...ivM } : null,
    internalEval: internalEval(s),
    scale: {
      rungs: RUNGS,
      ticks: { medianExpert_frameworkHigh: p.safety.framework.rules.find((r) => r.trigger.kind === 'capability')?.trigger, bestHuman: FRAMEWORK_CRITICAL_L, superhumanCoder: LEVEL_KNOTS[3] },
      frameworkRules: p.safety.framework.rules.map((r) => ({ id: r.id, label: r.label, trigger: r.trigger, holds: r.holds })),
    },
    defaultKind: kind, plans, options,
    knowHowWaiting_believed: undefined as unknown, // filled from K below
  };
});

// ───────── 2. RESEARCH › Know-how ─────────
const K = tryy('knowhow', () => {
  const sv = stackViews(s);
  const iv = internalVersion(s);
  const base = iv ? p.models.bases.find((b) => b.id === iv.baseId) : undefined;
  // Believed "waiting": ideas adopted after the internal model's recipe was frozen (pretraining stack: its base's launch;
  // RL stacks: its RL run), Σ their believed estimates. Public knowledge received since then is not snapshotted per model.
  const frozen: Record<string, number | undefined> = {
    pre: base ? (base.startDay ?? base.day) : undefined, rlMid: iv?.trained?.rlDay ?? iv?.day, rlCeil: iv?.trained?.rlDay ?? iv?.day,
    train: undefined, serve: undefined,
  };
  const yr = day - 365;
  const capList = tryy('capList', () => capPriorityList(s));
  const count: Record<string, Record<string, number>> = {};
  for (const v of capList?.list ?? []) { const a = String(v.stack ?? v.area ?? 'other'); count[a] ??= {}; count[a][v.state] = (count[a][v.state] ?? 0) + 1; count[a].total = (count[a].total ?? 0) + 1; }
  const rate = softwareRate(s);
  return {
    areas: sv.map((st) => {
      const ideas = p.research.adopted.filter((a) => a.stack === st.key);
      const since = frozen[st.key];
      const waiting = since !== undefined ? ideas.filter((a) => a.day > since) : undefined;
      const wEst = waiting?.reduce((x, a) => x + a.est, 0);
      const wSd = waiting ? Math.sqrt(waiting.reduce((x, a) => x + a.estSd * a.estSd, 0)) : undefined;
      const last = ideas.filter((a) => a.day > yr);
      const g = last.reduce((x, a) => x + a.est, 0);
      return {
        key: st.key, name: st.name, unit: st.unit,
        public_oom: st.base, public_x: X(st.base),
        yours_oom: st.now, yours_x: X(st.now), yours_range90_oom: [st.now - Z90 * st.adoptedSd, st.now + Z90 * st.adoptedSd], yours_range90_x: [X(st.now - Z90 * st.adoptedSd), X(st.now + Z90 * st.adoptedSd)],
        ownAdopted_oom: st.adopted, ownAdopted_x: X(st.adopted), adoptedSd: st.adoptedSd, ideasAdopted: st.n,
        waiting_believed: since !== undefined ? { sinceDay: since, sinceDate: date(since), ideas: waiting!.length, oom: wEst, x: X(wEst!), range90_oom: [wEst! - Z90 * wSd!, wEst! + Z90 * wSd!] } : { note: 'no per-model snapshot (train / serve apply to every run at once)' },
        ownGrowthLast365d_believed: { oom: g, x: X(g), ideas: last.length },
        ideaListCounts: count[st.key] ?? {},
      };
    }),
    otherIdeaListCounts: Object.fromEntries(Object.entries(count).filter(([k]) => !['pre', 'rlMid', 'rlCeil', 'train', 'serve'].includes(k))),
    publicGrowthPerYear: { oom: rate.publicPerYear, x: X(rate.publicPerYear) },
    ideasAdoptedPerYear: rate.ideasPerYear,
    believedGrowthPerYear_allStacks: undefined,
  };
});
if (T && K) T.knowHowWaiting_believed = K.areas.map((a) => ({ key: a.key, name: a.name, waiting: a.waiting_believed }));

// ───────── 3. SAFETY › Risks ─────────
const sevOf = (id: string, ableTo: number, af: number) => {
  if (id === 'EXFIL') return 5;
  if (id === 'MISUSE_BIO' || id === 'MISUSE_CYBER') return Math.min(5, MISUSE.floor + MISUSE.span * ableTo);
  const def = (DANGER_ACTS as Record<string, { floor: number; span: number } | undefined>)[id] ?? (COVERT_ACTS as Record<string, { floor: number; span: number } | undefined>)[id];
  return def ? Math.max(1, Math.min(5, def.floor + def.span * ableTo * af)) : 1;
}; // = lossRisk.ts rowSev (not exported)
/** A row whose Able-to reads actTable.ts measuredDomainL's fallback (measuredL + v.domains[d] − v.Lg: the TRUE domain
 *  offset, on a model with no benchmark fit for that domain) is withheld: level, Able to and everything after it. */
const withhold = <R extends { levelFromTrueOffset: boolean }>(r: R) => (r.levelFromTrueOffset ? { ...r, levelMeasured: null, ableTo: null, attempts: null, unstopped: null, expectedSeverity: null, withheld: 'Able to reads the true domain offset (model not measured on this domain)' } : r);
const tableOut = (t: ReturnType<typeof actTable>) => {
  if (!t) return undefined;
  const af = t.site.site.autonomy * t.site.site.afford;
  const rows = t.rows.map((r) => withhold({ id: r.id, group: r.group, name: r.name, per: r.per, wouldTry: r.wouldTry, wouldTryRange90: [r.wouldTryLo, r.wouldTryHi], domain: r.domain, levelMeasured: r.level, theta: r.theta, ableTo: r.ableTo, chances: r.chances, block: r.block, catch: r.catch, stopRate: r.stopRate, attempts: r.attempts, unstopped: r.unstopped, expectedSeverity: r.per === 'year' ? sevOf(String(r.id), r.ableTo, af) : undefined, levelFromTrueOffset: !!r.domain && t.site.v.evals.measuredDom?.[r.domain] === undefined }));
  const grouped = Object.fromEntries((['misbehaviour', 'lab', 'misuse'] as const).map((g) => [g, rows.filter((r) => r.group === g)]));
  return { model: t.site.v.name, use: t.site.use, internal: t.site.site.internal, usage: t.site.usage, scale: t.site.site.scale, autonomy: t.site.site.autonomy, afford: t.site.site.afford, rd: t.site.site.rd, guards: t.guards, groups: grouped };
};
const S = tryy('safety', () => {
  const lab = lossOfControlRisk(s);
  const rv = lab ? versionById(s, lab.versionId) : undefined;
  const intD = p.deployments.find((d) => d.channel === 'internal' && d.status !== 'withdrawn');
  const fleets = internalFleets(s);
  const fl = rv ? fleets.find((f) => f.v.id === rv.id) : undefined;
  const riskiestInternal = intD && fl ? tableOut(actTable(s, { deploymentId: intD.id, versionId: fl.v.id, usage: fl.usage }, true)) : undefined;
  const products = p.deployments.filter((d) => d.status !== 'withdrawn' && d.channel !== 'internal').map((d) => ({ id: d.id, channel: d.channel, model: versionById(s, d.versionId)?.name, table: tableOut(actTable(s, { deploymentId: d.id }, true)) }));
  const fleetTables = intD ? fleets.filter((f) => f.v.status !== 'retired').map((f) => ({ model: f.v.name, usage: f.usage, table: tableOut(actTable(s, { deploymentId: intD.id, versionId: f.v.id, usage: f.usage }, true)) })) : [];
  // Unstopped harm / yr by severity band (same sum as unstoppedHarmPerYear, split by the row's rounded expected severity).
  const bySev: Record<string, { acts: number; harm: number }> = {};
  for (const t of [...products.map((x) => x.table), ...fleetTables.map((x) => x.table)]) {
    if (!t) continue;
    for (const g of Object.values(t.groups)) for (const r of g) {
      if (r.per !== 'year' || r.expectedSeverity == null || r.unstopped == null) continue;
      const k = `sev${Math.round(r.expectedSeverity)}`;
      bySev[k] ??= { acts: 0, harm: 0 };
      bySev[k].acts += r.unstopped; bySev[k].harm += r.unstopped * r.expectedSeverity;
    }
  }
  const sl = sightLimit(s);
  const grid = sightGrid(s);
  const iv = internalVersion(s);
  const sv = safetyView(s);
  const insts = instruments(s).map((t) => {
    const row = sv.techniques.find((x) => x.id === t.id);
    return { id: t.id, name: instrumentName(t), family: t.family, agenda: t.agenda, believedStrengthAtModelLevel: row?.strength, validatedOn: validatedLabel(s, t), validatedOnModel: t.validatedOn ? versionById(s, t.validatedOn)?.name : undefined, trainedAgainst: t.trainedAgainst, active: t.active };
  });
  const cr = controlReadout(s);
  const dv = dangerView(s);
  return {
    lossOfControl_lab: lab ? { model: lab.name, p: lab.p, range90: [lab.lo, lab.hi], misBelieved: lab.mis, misRange90: [lab.mis - Z90 * lab.misSd, lab.mis + Z90 * lab.misSd], stopRate: lab.stopRate, footholdsKnownF: lab.knownF, footholdsUnfoundF: lab.unfoundF, exposure: lab.exposure } : null,
    lossOfControl_perModel: [...new Set([...fleets.map((f) => f.v.id), ...p.deployments.filter((d) => d.status !== 'withdrawn').map((d) => d.versionId)])].map((id) => { const r = lossOfControlRisk(s, id); return r ? { model: r.name, p: r.p, range90: [r.lo, r.hi], mis: r.mis, stopRate: r.stopRate } : null; }).filter(Boolean),
    riskiestModelInternalActTable: riskiestInternal,
    productActTables: products,
    allInternalFleetTables: fleetTables,
    unstoppedBySeverity_cleanRowsOnly: bySev, unstoppedCleanTotal: Object.values(bySev).reduce((a, x) => ({ acts: a.acts + x.acts, harm: a.harm + x.harm }), { acts: 0, harm: 0 }),
    unstoppedHarmPerYear_engine_flagged: 'withheld: unstoppedHarmPerYear sums rows whose Able to reads the true domain offset (unmeasured internal model)',
    control: { believed: cr.believed, band: cr.band, model: cr.name, monitor: cr.monitorName, monitorGapOom: cr.monitorGapOom, humanGapOom: cr.humanGapOom, layer: cr.layer, tax: cr.tax, footholds: { suspected: cr.suspected, located: cr.located, removed: cr.removed } },
    dangerSummary: { products: Object.fromEntries(Object.entries(dv.products).map(([k, d]) => [k, { model: versionById(s, d.versionId)?.name, attempts: d.attempts, harmful: d.harmful, caught: d.caught, levers: d.levers }])), lanes: Object.fromEntries(Object.entries(dv.lanes).map(([k, d]) => [k, { model: versionById(s, d!.versionId)?.name, attempts: d!.attempts, harmful: d!.harmful, caught: d!.caught, levers: d!.levers }])) },
    sight: {
      internalModel: iv?.name, modelMeasuredL: sl.level, sightLimit: sl.none ? 'none' : sl.L, none: sl.none, range: [sl.lo, sl.hi], gap: sl.gap, perTraitAtModelLevel: sl.perTrait,
      grid: { levels: grid.levels, rows: grid.rows.map((r) => ({ trait: r.trait, name: TRAIT_BY_ID[r.trait]?.name, det: r.det })), mean: grid.levels.map((_, i) => grid.rows.reduce((a, r) => a + r.det[i], 0) / Math.max(1, grid.rows.length)), min: grid.levels.map((_, i) => Math.min(...grid.rows.map((r) => r.det[i]))) },
    },
    instruments: insts,
    validation: { notOnCurrent: sv.validation.notOnCurrent, instruments: sv.validation.instruments, model: sv.validation.model, jobs: sv.validation.jobs.map((j) => ({ name: j.name, model: j.model, progress: j.progress, daysLeft: j.daysLeft })) },
    framework: { externalReview: p.safety.framework.externalReview, holds: p.safety.framework.holds.map((h) => ({ ...h, model: versionById(s, h.versionId)?.name })), rules: p.safety.framework.rules.map((r) => ({ id: r.id, label: r.label, trigger: r.trigger, holds: r.holds })), evalDaysPerRelease: evalDaysFor(s) },
  };
});

// ───────── 4. MODELS card ─────────
function card(v: ModelVersion) {
  const base = p.models.bases.find((b) => b.id === v.baseId);
  const benches = BENCHMARKS.filter((b) => v.evals.bench[b.id]).map((b) => { const r = v.evals.bench[b.id]; return { id: b.id, name: benchName(s, b), family: b.family, domain: b.domain, score: r.score, sd: r.sd, by: r.by, measured: date(r.day), maxedOut: b.ceil > 0 && r.score > b.ceil - 5, ceil: b.ceil, dangerous: b.dangerous }; });
  const fpt = flopPerToken(s, v);
  const c = useHourCost(s, fpt);
  const uses = usesOf(s, v.id);
  const md = tryy(`delta.${v.name}`, () => measuredDelta(s, v));
  return {
    name: v.name, id: v.id, variant: v.variant, status: v.status, day: v.day, date: date(v.day), base: base?.name, activeParams: base?.params, tokens: base?.tokens, tpp: base?.design.tpp, shape: base?.design.shape,
    ...measured(v), measuredGainVsPrevious: md,
    milestonesMet: RUNGS.filter((r) => v.evals.measuredL !== undefined && v.evals.measuredL >= r.level).map((r) => ({ name: r.name, level: r.level, labMetDate: r.metDate })),
    benchmarks: benches, horizon50_minutes: v.evals.bench.horizon?.score,
    monitorability: v.monitorability, appeal: v.appeal, flags: Object.entries(v.flags).filter(([, x]) => x).map(([k]) => k),
    serving: { fpt, costPerHourOfUse: c.hour, agentHour: c.agentHour, perH100eHour: c.perH100eHour },
    dataSpec: tryy(`dataSpec.${v.name}`, () => dataSpecView(s, v)),
    trainedWith: { baseDesign: base?.design, post: v.design, trained: v.trained, dataMix: base?.design.data },
    roles: { aiStaff: uses.model, monitorFor: uses.monitor, products: p.deployments.filter((d) => d.status !== 'withdrawn' && (d.versionId === v.id || d.lineup?.includes(v.id))).map((d) => ({ channel: d.channel, main: d.versionId === v.id, lineupPos: d.lineup?.indexOf(v.id) })) },
  };
}
const M = tryy('models', () => {
  const best = bestMeasured();
  const a28 = p.models.versions.find((v) => v.name === 'Atlas-2.8');
  const a210 = p.models.versions.find((v) => v.name === 'Atlas-2.10');
  return {
    best_measured: best?.name, best_engine: bestPlayerVersion(s)?.name,
    cards: [a210, best, a28].filter((v, i, a) => v && a.indexOf(v) === i).filter(Boolean).map((v) => card(v!)),
    familyTree: p.models.versions.map((v) => {
      const uses = usesOf(s, v.id);
      const b = p.models.bases.find((x) => x.id === v.baseId);
      return { name: v.name, id: v.id, variant: v.variant, status: v.status, date: date(v.day), base: b?.name, parent: v.parentVersionId ? versionById(s, v.parentVersionId)?.name : undefined, activeParams: (v as unknown as { params?: number }).params ?? b?.params, measuredL: v.evals.measuredL,
        aiStaff: uses.model, monitorFor: uses.monitor, products: p.deployments.filter((d) => d.status !== 'withdrawn' && (d.versionId === v.id || d.lineup?.includes(v.id))).map((d) => d.channel) };
    }),
    bases: p.models.bases.map((b) => ({ name: b.name, id: b.id, params: b.params, tokens: b.tokens, tpp: b.design.tpp, shape: b.design.shape, data: b.design.data, date: date(b.day) })),
  };
});

const _flags = {
  'measuredDomain (actors/commitments.ts:28) / actTable.ts measuredDomainL (l.~118)': 'fallback when a domain has no benchmark fit: measuredL + (v.domains[d] − v.Lg), the TRUE domain offset. Only hit for versions in evaluation / domains without a fit; each domain here carries fitted:true/false',
  'stackViews inModel / gap (models/researchView.ts:294)': 'reads base.ePre and v.build.eRL/aRL (hidden build) and true stack buckets (stackAt); DROPPED. knowhow.areas[].waiting_believed = Σ believed est of ideas adopted after the internal model froze its recipe (computed here)',
  'softwareRate.oomPerYear (researchView.ts:343, research.ts:1250 gRate)': 'gRate is the change of researchG (true buckets); DROPPED. Used ownGrowthLast365d_believed (Σ est of ideas adopted in the last 365 d) and publicPerYear (stack bases: public, visible)',
  'runCard g / limits.gGain / limits.gPre (index.ts:95 planRun)': 'G gained, recipe and pretraining G come from the plan on the TRUE stacks (ePreAt on buckets); the Blueprint shows "G gained" — DROPPED here. band/domains are runForecast (measured reference + step) and are kept',
  'medianExpertLevel (capability.ts:53), milestoneViews (researchView.ts:458), workFit / workTypeViews fit': 'read s.hidden.timeline (world gSC, dBM) and version G; not used. Median-expert tick = the framework High trigger level stored in player state (set from it at game start, shown on the framework panel)',
  'techniqueRows / sightGrid levels ↔ OOM (view.ts:119 oomOfLevel(s.hidden.timeline))': 'the level→OOM map is a hidden world parameter; believed strength itself is from posteriors. Kept (the UI shows it) but flagged',
  'tokEff (worldfx/serving.ts:56) in Models card cost per hour': 'reads v.build (eRL/aRL: reasoning-token efficiency); cost per hour here is useHourCost(fpt) WITHOUT tokEff, as Blueprint shows it',
  'versionSignals (core/selectors.ts:125)': 'reads v.build.signals; not used',
  'trueSightLimit (sightLimit.ts:224)': 'hidden; not used',
  'jobs (skill at job, can do alone)': 'no believed readout: workFit / coverage are computed from the version G; only horizon50 (benchmark) is given',
};
const out = clean({ fixture: FILE, day, date: date(day), training: T, knowhow: K, safety: S, models: M, _flags, errors });
writeFileSync(join('design', 'ux', 'mockups', 'rd', 'data400b.json'), JSON.stringify(out, null, 1));
console.log('written; errors:', JSON.stringify(errors, null, 1));
