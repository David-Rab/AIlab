// Player actions in the Models and Departments spheres (ActionDef catalog, V2-SPEC §2.7, §3.3, §3.4). Owner: WS1.
// Every preview shows what apply() does (§2.7, lint-tradeoffs). Previews must work with
// empty params (defaults below). apply() throws on an invalid request; core/loop act() turns that into an error.
import { REFERENCE_BASE, REFERENCE_POST, STREAM_PERIOD_DAYS, STREAM_POOL_SHARE } from '../../../data/v2/runDesign';
import { RE_OPS } from '../../../data/v2/research';
import { startOf } from '../../../data/v2/starts';
import { decimalYear } from '../core/time';
import { SPLIT_KEYS, SPLIT_LABEL, presetSplit, setSplit, type SplitPreset } from '../departments/split';
import { STAR_HIRE } from '../../../data/v2/teams';
import { hireStar } from '../departments/teams';
import { starGain, TEAM_ACTIONS } from '../departments/teamActions';
import { BUILD_ACTIONS } from '../departments/build';
import { SUITE_ACTIONS } from './suites';
import { DATA_ACTIONS } from '../production/dataActions';
import type {
  ActionDef, BaseDesign, ComputeSplit, CostLine, GameStateV2, ModelVersion, PostDesign, RLFamily,
} from '../types';
import { evalCost, evalDaysEstimate, evalDepthView, queueEval } from './evals';
import { expectedFitSd } from './benchmarks';
import { EVAL_DEPTH_IDS } from '../../../data/v2/evals';
import type { EvalDepth } from '../types';
import { externallyEvaluated, retireVersion } from './deployments';
import { AGENT_ACTIONS } from '../departments/agentActions';
import { PRODUCT_ACTIONS } from './productOps';
import { internalVersion, versionById } from './labs';
import { TREE_ACTIONS } from './treeActions';
import { POOL_SHARE_RANGE, idleTrainingShare, launchRun, planRun, runForecast, startStream, streamPeriodGain, type LaunchRunParams } from './runs';
import { AUTO_SPLIT_USES, autoSplitPlan, idleShares, type AutoSplitUse } from '../departments/autoSplit';
import { poolsOf } from '../compute/power';
import { RESPONSE_SCALES, responseCurves } from '../production/readout';
import { studentToHold } from '../worldfx/serving';
import { clamp } from '../../rng';
import { bookCash } from '../finance/ledger';
import { adopted } from './paradigms';
import { methodLines, methodsFromParam } from '../safety/methods';

/** Star hire cost: × the start type's modifier (spinout ×0.7 founder brand, big tech ×1.5; research/18 §6, R9). */
const starCost = (s: GameStateV2) => STAR_HIRE.cost * startOf(s).mods.starCost;

type Params = Record<string, number | string | boolean>;
type Preview = ReturnType<ActionDef['preview']>;

const str = (p: Params, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);
const num = (p: Params, k: string, d: number) => (typeof p[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : d);
const bool = (p: Params, k: string, d: boolean) => (typeof p[k] === 'boolean' ? (p[k] as boolean) : d);
const fail = (why: string | undefined) => {
  if (why) throw new Error(why);
};
/** Model v3 D7: suite depth param (basic, full, deep; default full). */
const evalDepthParam = (p: Params): EvalDepth => {
  const d = str(p, 'depth', 'full') as EvalDepth;
  return EVAL_DEPTH_IDS.includes(d) ? d : 'full';
};
const latestBase = (s: GameStateV2) => s.player.models.bases[s.player.models.bases.length - 1];
const latestFull = (s: GameStateV2) => [...s.player.models.versions].reverse().find((v) => v.variant === 'full' && v.status !== 'retired');

/** RD-T08: explicit draw shares (`mixShares`, a JSON object of domain → share; RefBot's fixed 2025 target, bots/ref.ts),
 *  or undefined when absent or malformed. */
function mixSharesParam(p: Params): BaseDesign['mixShares'] {
  if (typeof p.mixShares !== 'string') return undefined;
  try {
    const o = JSON.parse(p.mixShares) as Record<string, unknown>;
    const out: NonNullable<BaseDesign['mixShares']> = {};
    for (const [d, x] of Object.entries(o)) if (typeof x === 'number' && x >= 0 && Number.isFinite(x)) out[d as keyof typeof out] = x;
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}
/** Base design from params (defaults = reference recipe). */
export function baseFromParams(p: Params): BaseDesign {
  const r = REFERENCE_BASE;
  const shares = mixSharesParam(p);
  return {
    params: num(p, 'params', r.params), tpp: num(p, 'tpp', r.tpp), shape: str(p, 'shape', r.shape) as BaseDesign['shape'],
    data: str(p, 'data', r.data) as BaseDesign['data'], ...(shares ? { mixShares: shares } : {}),
    curation: { quality: bool(p, 'quality', r.curation.quality), hazard: bool(p, 'hazard', r.curation.hazard), safetyPretrain: bool(p, 'safetyPretrain', r.curation.safetyPretrain) },  };
}

/** RD-B01 (B44): the one default design as flat params (the reference base and post recipes) — the Blueprint opens on
 *  these, and baseFromParams / postFromParams fall back to the same values. */
export const RUN_PARAM_DEFAULTS: Readonly<Record<string, string | number | boolean>> = {
  params: REFERENCE_BASE.params, tpp: REFERENCE_BASE.tpp, shape: REFERENCE_BASE.shape, data: REFERENCE_BASE.data,
  quality: REFERENCE_BASE.curation.quality, hazard: REFERENCE_BASE.curation.hazard, safetyPretrain: REFERENCE_BASE.curation.safetyPretrain,
  pref: REFERENCE_POST.pref, rlFocus: 'broad', rlBudget: REFERENCE_POST.rlBudget,
  cot: REFERENCE_POST.cot, safety: REFERENCE_POST.safety,
};

/** Post design from params; rlFocus is 'broad' or a comma list of ≤ 2 families. SR-14: `methods` is a comma list of
 *  owned methods and `against:<instrument>` entries; absent, the plan gets the policy default (every owned method with
 *  "Use all known methods" on); without a state, none. */
export function postFromParams(p: Params, s?: GameStateV2): PostDesign {
  const r = REFERENCE_POST;
  const f = str(p, 'rlFocus', 'broad');
  return {
    pref: str(p, 'pref', r.pref) as PostDesign['pref'], rlFocus: f === 'broad' ? 'broad' : (f.split(',').filter(Boolean) as RLFamily[]),
    rlBudget: str(p, 'rlBudget', r.rlBudget) as PostDesign['rlBudget'],
    cot: str(p, 'cot', r.cot) as PostDesign['cot'], safety: str(p, 'safety', r.safety) as PostDesign['safety'],
    methods: s ? methodsFromParam(s, p.methods) : [],
  };
}

function runParams(s: GameStateV2, kind: LaunchRunParams['kind'], p: Params): LaunchRunParams {
  const lp: LaunchRunParams = { kind };
  if (p.poolShare !== undefined) lp.poolShare = num(p, 'poolShare', 0.5);
  if (kind === 'base') {
    lp.base = baseFromParams(p); // RD-B01: a base takes no teacher; its synthetic tokens carry their own (base.teacherData)
  } else if (kind === 'post') {
    lp.post = postFromParams(p, s);
    const b = str(p, 'baseId', latestBase(s)?.id ?? '');
    lp.baseId = b;
    if (latestBase(s)?.design.shape === 'latent' && p.cot === undefined && b === latestBase(s)?.id) lp.post.cot = 'latent';
  } else if (kind === 'distill') {
    lp.teacherVersionId = str(p, 'teacherVersionId', latestFull(s)?.id ?? '');
    if (typeof p.studentParams === 'number') lp.studentParams = num(p, 'studentParams', 0);
    // A5: size the student to hold another version's capability (the cheapestAt rule on this teacher): the smallest
    // model a cheap tier or a free tier can be at that level.
    const t = versionById(s, lp.teacherVersionId);
    const hold = typeof p.holdVersionId === 'string' ? versionById(s, p.holdVersionId) : undefined;
    if (t && hold) lp.studentParams = studentToHold(s, t, hold);
  }
  else lp.baseId = str(p, 'baseId', latestBase(s)?.id ?? '');
  return lp;
}

/** Run preview: compute and cash costs, the forecast level gain, the training pressure. RD-B19 (B45): the gain is the
 *  lab's forecast (runForecast, UB-2b: believed recipe on the start model's measured build) minus that reference's measured level, so it
 *  compares like with like and shows no true level; the band is the reference's evaluation band. The pressure is the
 *  sum of the run's training signals (what applyRunToTraits applies), shown as pressure, not as an alignment change. */
function runPreview(s: GameStateV2, lp: LaunchRunParams, ref?: ModelVersion): Preview {
  const plan = planRun(s, lp);
  const fc = runForecast(s, lp, ref);
  const costs: CostLine[] = [{ currency: 'compute', amount: plan.poolShare, target: 'training pool share' }];
  if (plan.cashCost > 0) costs.push({ currency: 'cash', amount: plan.cashCost });
  const exposure: CostLine[] = [];
  const pressure = Object.values(plan.prediction.signals).reduce((a, x) => a + x, 0);
  if (pressure > 0) exposure.push({ currency: 'alignment', amount: -Math.round(pressure * 100) / 100, unit: 'pressure', lagDays: plan.etaDays, target: 'training pushes toward unwanted traits (Next run shows which)' });
  // SR-14: the run's methods, each with its effect and its cost where one exists; train-against with its honest preview.
  const gains0: CostLine[] = [];
  if (lp.post) {
    const ml = methodLines(s, lp.post, lp.baseId ? s.player.models.bases.find((b) => b.id === lp.baseId)?.lineage : undefined, plan.g.G > 0 ? plan.g.G : undefined); // CP3i: at the planned model's capability
    gains0.push(...ml.gains);
    exposure.push(...ml.exposure);
  }
  const scrutiny = lp.base ? (plan.limits?.scrutiny ?? 0) : 0;
  if (scrutiny >= 0.5) exposure.push({ currency: 'scrutiny', amount: Math.round(scrutiny * 10) / 10 });
  const gains: CostLine[] = fc
    ? [{ currency: 'progress', amount: Math.round(fc.gain * 100) / 100, unit: 'L', lagDays: plan.etaDays, target: `prediction over ${fc.refName}'s measured level (±${fc.sd.toFixed(2)} levels)` }]
    : [];
  return { costs, gains: [...gains, ...gains0], exposure };
}

const runAction = (id: string, title: string, kind: LaunchRunParams['kind'], extra?: (s: GameStateV2) => true | string): ActionDef => ({
  id, verb: 'train', system: 'models', sphere: 'models', owner: 'WS1', title,
  available: (s) => (s.player.status !== 'active' ? 'Lab inactive' : extra ? extra(s) : true),
  preview: (s, p) => runPreview(s, runParams(s, kind, p)),
  apply: (s, ctx, p) => {
    const r = launchRun(s, ctx, runParams(s, kind, p));
    if (typeof r === 'string') fail(r);
  },
});

/** The IDA run on version `v` (P18): a post-train with the teacher in the loop. */
const idaParams = (v: ModelVersion | undefined): LaunchRunParams => ({ kind: 'post', grader: 'teacher', baseId: v?.baseId, teacherVersionId: v?.id, post: v?.design ?? REFERENCE_POST });

/** The stream's standing load (start: costs; stop: freed): its training pool share and the research engineers'
 *  operations (models/research.ts reDemand; RD-B09: engineers no longer keep runs or the stream going). */
const streamCosts = (): CostLine[] => [
  { currency: 'compute', amount: STREAM_POOL_SHARE, target: 'training pool share' },
  { currency: 'staffTime', amount: RE_OPS.stream, unit: 'teams', target: 'research engineers on stream operations' },
];

const p18 = (s: GameStateV2) => (adopted(s, 'P18') ? true : 'Needs the discovery Iterated distillation & amplification');

const RUN_ACTIONS: ActionDef[] = [
  runAction('launchBase', 'Pretrain base', 'base'),
  runAction('launchPost', 'Post-train', 'post', (s) => (s.player.models.bases.length ? true : 'No base')),
  runAction('launchDistill', 'Distill mini', 'distill'),
  runAction('launchContinue', 'Continue base', 'continue', (s) => (s.player.models.bases.length ? true : 'No base')),
  {
    id: 'idaCycle', verb: 'train', system: 'models', sphere: 'models', owner: 'WS1', title: 'Amplify',
    available: p18,
    // RD-B19 (B37): the run's own plan, as launched (pool share, forecast gain over the teacher, training pressure).
    preview: (s, p) => {
      const v = versionById(s, str(p, 'versionId', latestFull(s)?.id ?? ''));
      return runPreview(s, idaParams(v), v);
    },
    apply: (s, ctx, p) => {
      const v = versionById(s, str(p, 'versionId', latestFull(s)?.id ?? ''));
      const r = launchRun(s, ctx, idaParams(v));
      if (typeof r === 'string') fail(r);
    },
  },
  {
    id: 'runs.setShare', verb: 'train', system: 'models', sphere: 'models', owner: 'WS1', title: 'Training share',
    available: (s) => (s.player.models.runs.some((r) => r.status === 'running') ? true : 'No running runs'),
    preview: (s, p) => {
      const r = s.player.models.runs.find((x) => x.id === str(p, 'runId', '')) ?? s.player.models.runs.find((x) => x.status === 'running');
      const share = clamp(num(p, 'share', r?.poolShare ?? 0.5), POOL_SHARE_RANGE[0], POOL_SHARE_RANGE[1]);
      const d = share - (r?.poolShare ?? share);
      const line = { currency: 'compute' as const, amount: Math.round(Math.abs(d) * 100) / 100, target: 'training pool share' };
      // More share: the run finishes sooner, other runs (or idle research compute) get less; less share: the reverse.
      return d >= 0
        ? { costs: [line], gains: [{ currency: 'progress', amount: Math.round(d * 100), unit: '%', target: `${r?.name ?? 'run'}: training share (finishes sooner)` }], exposure: [] }
        : { costs: [{ currency: 'progress', amount: Math.round(d * 100), unit: '%', target: `${r?.name ?? 'run'}: training share (finishes later)` }], gains: [line], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const r = s.player.models.runs.find((x) => x.id === str(p, 'runId', '') && (x.status === 'running' || x.status === 'paused'));
      if (!r) return fail('Unknown run');
      r.poolShare = clamp(num(p, 'share', r.poolShare), POOL_SHARE_RANGE[0], POOL_SHARE_RANGE[1]);
    },
  },
  {
    id: 'cancelRun', verb: 'train', system: 'models', sphere: 'models', owner: 'WS1', title: 'Cancel run',
    available: (s) => (s.player.models.runs.some((r) => r.status === 'running') ? true : 'No running runs'),
    preview: (s, p) => {
      const r = s.player.models.runs.find((x) => x.id === str(p, 'runId', '')) ?? s.player.models.runs.find((x) => x.status === 'running');
      return { costs: [{ currency: 'progress', amount: r ? -Math.round((r.flopDone / Math.max(1, r.flopNeeded)) * 1000) / 10 : 0, unit: '%', target: 'of the run done (lost)' }, { currency: 'cash', amount: r?.cashCost ?? 0, target: 'sunk' }], gains: [{ currency: 'compute', amount: r?.poolShare ?? 0 }], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const r = s.player.models.runs.find((x) => x.id === str(p, 'runId', '') && x.status === 'running');
      if (!r) fail('Unknown run');
      else r.status = 'cancelled';
    },
  },
  {
    id: 'startStream', verb: 'train', system: 'models', sphere: 'models', owner: 'WS1', title: 'Continual learning',
    available: (s) => (adopted(s, 'P08') ? true : 'Needs the discovery Continual learning'),
    // RD-T03: the stream's standing load as charged and what its first period buys: the mechanism (continued pretraining
    // and an RL refresh on the period's FLOP) run on a copy of the version (streamPeriodGain). Its slow drift in
    // dispositions has no one-number preview.
    preview: (s, p) => {
      const v = versionById(s, str(p, 'versionId', internalVersion(s)?.id ?? ''));
      const g = v ? streamPeriodGain(s, v.id) : { dG: 0, flop: 0 };
      return {
        costs: streamCosts(),
        gains: [{ currency: 'progress', amount: Math.round(g.dG * 1000) / 1000, unit: 'OOM', lagDays: STREAM_PERIOD_DAYS, target: `effective compute ${v?.name ?? 'the model'} gains each ${STREAM_PERIOD_DAYS} days from continued pretraining and post-training at today's training share` }],
        exposure: [],
      };
    },
    apply: (s, _ctx, p) => fail(startStream(s, str(p, 'versionId', internalVersion(s)?.id ?? ''))),
  },
  {
    id: 'stopStream', verb: 'train', system: 'models', sphere: 'models', owner: 'WS1', title: 'Stop stream',
    available: (s) => (s.player.models.stream ? true : 'No stream'),
    // RD-T03: the version keeps what it gained; it forgoes the next period's gain (streamPeriodGain on a copy).
    preview: (s) => {
      const id = s.player.models.stream?.versionId ?? '';
      const g = streamPeriodGain(s, id);
      return {
        costs: [{ currency: 'progress', amount: -Math.round(g.dG * 1000) / 1000, unit: 'OOM', target: `effective compute ${versionById(s, id)?.name ?? 'the model'} no longer gains each ${STREAM_PERIOD_DAYS} days (it keeps what it has)` }],
        gains: streamCosts(),
        exposure: [],
      };
    },
    apply: (s) => {
      delete s.player.models.stream;
    },
  },
  {
    id: 'retireVersion', verb: 'launch', system: 'models', sphere: 'models', owner: 'WS1', title: 'Retire',
    available: () => true,
    // F6c: what retireVersion does (models/deployments.ts): the version leaves the pickers for good (no deployment,
    // agents or evals again; auto evals skip it). It frees nothing: it cannot be retired while it serves or monitors.
    preview: (s, p) => ({ costs: [{ currency: 'progress', amount: 1, unit: 'version', target: `${versionById(s, str(p, 'versionId', ''))?.name ?? 'the version'} cannot be deployed, run as agents or evaluated again` }], gains: [], exposure: [] }),
    apply: (s, _ctx, p) => fail(retireVersion(s, str(p, 'versionId', ''))),
  },
  {
    id: 'runEvals', verb: 'policy', system: 'models', sphere: 'models', owner: 'WS1', title: 'Run evals',
    available: () => true,
    // Model v3 D7: queues a suite as work (models/evals.ts): research-engineer team-weeks (the evaluators' own staff for
    // external ones), engineer team-weeks and inference compute (H100e-days) from the experiments pool. RD-B19 (B36): the
    // gains are what finishEval does (evalGains), nothing else.
    preview: (s, p) => {
      const by = str(p, 'by', 'self') as 'self' | 'evalGov' | 'evalIndep';
      const v = versionById(s, str(p, 'versionId', internalVersion(s)?.id ?? ''));
      const depth = evalDepthParam(p);
      const c = v ? evalCost(s, v, depth, by) : undefined;
      const days = by === 'self' ? evalDaysEstimate(s, depth) : Math.ceil((c?.reTW ?? 0) / ((c?.maxTeams ?? 1) / 7));
      return {
        costs: [
          ...(by === 'self' ? [{ currency: 'staffTime' as const, amount: Math.round((c?.reTW ?? 0) * 100) / 100, target: 'research-engineer team-weeks' }] : []),
          { currency: 'staffTime', amount: Math.round((c?.engTW ?? 0) * 100) / 100, target: 'engineer team-weeks' },
          { currency: 'compute', amount: Math.round(c?.h100eDays ?? 0), target: `H100e-days from experiments, ≈${Number.isFinite(days) ? days : '∞'} days` },
        ],
        gains: v ? evalGains(s, v, depth, by, days) : [],
        exposure: [],
      };
    },
    apply: (s, ctx, p) => {
      const v = versionById(s, str(p, 'versionId', internalVersion(s)?.id ?? ''));
      if (!v) fail('Unknown version');
      else {
        const r = queueEval(s, v, evalDepthParam(p), str(p, 'by', 'self') as 'self' | 'evalGov' | 'evalIndep', 'order');
        if (typeof r === 'string') fail(r);
        else ctx.log('research', `Eval suite queued on ${v.name}.`, 1, v.id);
      }
    },
  },
];

/** RD-B19 (B36): what a finished suite does (models/evals.ts finishEval → benchmarks.ts runEvalSuite): a new reading of
 *  the version (benchmark and safety-eval scores; the measured level is refitted from them, its band the fitted band
 *  expected at today's readings and this evaluator's noise: benchmarks.ts expectedFitSd) and, by external evaluators, the external evaluation the Safety framework's
 *  external-review rule and its Critical rules ask for (safety/framework.ts externallyEvaluated). */
function evalGains(s: GameStateV2, v: ModelVersion, depth: EvalDepth, by: 'self' | 'evalGov' | 'evalIndep', days: number): CostLine[] {
  const row = evalDepthView(s, v).find((x) => x.depth === depth);
  const lag = Number.isFinite(days) ? { lagDays: days } : {};
  const out: CostLine[] = [{
    currency: 'progress', amount: 1, unit: 'reading', ...lag,
    target: `new benchmark and safety-eval scores for ${v.name}; its measured level ±${(row?.bandNow ?? 0).toFixed(2)} → ±${expectedFitSd(s, v, by, depth).toFixed(2)} levels (range, at today's readings)`,
  }];
  if (by !== 'self' && !externallyEvaluated(s, v)) {
    out.push({ currency: 'progress', amount: 1, unit: 'release check', ...lag, target: `${v.name} gets the external evaluation your Safety framework asks for (its external-review rule and rules at Critical)` });
  }
  return out;
}

// ───────────────────────────── departments ─────────────────────────────

/** Allocation from action params: the flat use keys (RD-A05a; departments/split.ts SPLIT_KEYS, idle included).
 *  Missing values keep the current allocation. */
function splitFromParams(s: GameStateV2, p: Params): ComputeSplit {
  const out = { ...s.player.split };
  for (const k of SPLIT_KEYS) if (typeof p[k] === 'number') out[k] = p[k] as number;
  return out;
}

/** Auto-split's listed uses from params (`to`: comma-separated use keys; undefined when absent). */
function autoSplitTo(p: Params): AutoSplitUse[] | undefined {
  if (typeof p.to !== 'string') return undefined;
  return [...new Set(p.to.split(',').map((x) => x.trim()).filter((x): x is AutoSplitUse => AUTO_SPLIT_USES.includes(x as AutoSplitUse)))];
}

/** Apply a split (RD-A02: the research mix is part of it; no Auto mix). */
function applySplit(s: GameStateV2, sp: ComputeSplit): string | undefined {
  return setSplit(s, sp);
}

function splitPreview(s: GameStateV2, next: ComputeSplit): Preview {
  const cur = s.player.split;
  const costs: CostLine[] = [];
  const gains: CostLine[] = [];
  const cur2cur: Record<keyof ComputeSplit, CostLine['currency']> = {
    training: 'progress', experiments: 'progress', routine: 'progress', frontier: 'progress', synthetic: 'progress', serving: 'revenue',
    safety: 'alignment', safetyAgents: 'alignment', monitors: 'alignment', engineering: 'progress', idle: 'compute',
  };
  const agg: Partial<Record<CostLine['currency'], number>> = {};
  for (const k of SPLIT_KEYS) agg[cur2cur[k]] = (agg[cur2cur[k]] ?? 0) + (next[k] - cur[k]);
  // RD-B19 (MEA-19): the lines are compute shares in percent points (a bare 'progress' line read as levels).
  const what: Partial<Record<CostLine['currency'], string>> = { progress: 'of compute to training and research', revenue: 'of compute to serving', alignment: 'of compute to safety', compute: 'of compute idle' };
  for (const [c, d] of Object.entries(agg) as [CostLine['currency'], number][]) {
    const line = { currency: c, amount: Math.round(d * 1000) / 10, unit: '%', target: what[c] };
    if (d > 1e-4) gains.push(line);
    else if (d < -1e-4) costs.push(line);
  }
  if (!costs.length) costs.push({ currency: 'compute', amount: 0, target: 'no change' });
  return { costs, gains, exposure: [] };
}

export const DEPARTMENT_ACTIONS: ActionDef[] = [
  {
    id: 'setSplit', verb: 'policy', system: 'compute', sphere: 'departments', owner: 'WS1', title: 'Compute allocation',
    available: () => true,
    preview: (s, p) => splitPreview(s, splitFromParams(s, p)),
    apply: (s, _ctx, p) => fail(applySplit(s, splitFromParams(s, p))),
  },
  {
    id: 'splitPreset', verb: 'policy', system: 'compute', sphere: 'departments', owner: 'WS1', title: 'Allocation preset',
    available: () => true,
    preview: (s, p) => splitPreview(s, presetSplit(str(p, 'preset', 'reference') as SplitPreset, decimalYear(s), s.player.split)),
    apply: (s, _ctx, p) => fail(applySplit(s, presetSplit(str(p, 'preset', 'reference') as SplitPreset, decimalYear(s), s.player.split))),
  },
  {
    // RD-A05b (DD-19): the one policy that reassigns idle compute. Params: on (boolean), to (comma-separated uses).
    id: 'compute.autoSplit', verb: 'policy', system: 'compute', sphere: 'departments', owner: 'WS1', title: 'Auto-split idle compute',
    available: () => true,
    preview: (s, p) => {
      const pol = s.player.policies.autoSplit;
      const on = typeof p.on === 'boolean' ? p.on : !pol.on;
      const to = autoSplitTo(p) ?? pol.to;
      const idle = idleShares(s).total;
      if (!on) return { costs: [], gains: [{ currency: 'compute', amount: Math.round(idle * 1000) / 10, unit: '%', target: 'of compute stays idle where it is' }], exposure: [] };
      const moved = autoSplitPlan({ ...s, player: { ...s.player, policies: { ...s.player.policies, autoSplit: { ...pol, on, to } } } }).moved;
      return { costs: [], gains: [{ currency: 'compute', amount: Math.round(moved * 1000) / 10, unit: '%', target: `of compute (idle now) moves to ${to.map((k) => SPLIT_LABEL[k].toLowerCase()).join(', ') || 'no use'} each day` }], exposure: [] };
    },
    apply: (s, ctx, p) => {
      const pol = s.player.policies.autoSplit;
      const to = autoSplitTo(p);
      if (to && !to.length) return fail('List at least one use');
      if (to) pol.to = to;
      if (typeof p.on === 'boolean') pol.on = p.on;
      ctx.log('company', pol.on ? `Auto-split on: idle compute moves to ${pol.to.map((k) => SPLIT_LABEL[k].toLowerCase()).join(', ')} each day.` : 'Auto-split off: idle compute stays idle.');
    },
  },
  {
    // UB-5c (DECISIONS "Lend idle training compute"): off by default. On: training compute no run uses goes to research
    // experiments and returns the moment a run trains (runs.ts lentTrainingH100e). Params: on (boolean).
    id: 'compute.lendTraining', verb: 'policy', system: 'compute', sphere: 'departments', owner: 'WS1', title: 'Lend idle training compute',
    available: () => true,
    preview: (s, p) => {
      const on = typeof p.on === 'boolean' ? p.on : !s.player.policies.lendTraining;
      const lent = idleTrainingShare(s) * poolsOf(s).training;
      const exp = poolsOf(s).experiments;
      const rc = responseCurves(s);
      // Believed research speed with vs without the loan (the curve covers ×¼ … ×4 of experiment compute).
      const at = (curve: number[], x: number) => {
        const xs = RESPONSE_SCALES;
        const lx = Math.log(clamp(x, xs[0], xs[xs.length - 1]));
        for (let i = 1; i < xs.length; i++) if (lx <= Math.log(xs[i])) { const f = (lx - Math.log(xs[i - 1])) / (Math.log(xs[i]) - Math.log(xs[i - 1])); return curve[i - 1] + f * (curve[i] - curve[i - 1]); }
        return curve[curve.length - 1];
      };
      const g = rc && exp > 0 ? at(rc.experiments, (exp + lent) / exp) - 1 : 0;
      const pct = Math.round(g * 1000) / 10;
      const note = { currency: 'compute' as const, amount: 0, target: 'returns automatically when a run launches' };
      if (on) return { costs: [note], gains: [{ currency: 'progress', amount: pct, unit: '%', target: `research speed${exp > 0 && (exp + lent) / exp > 4 ? ' at least' : ''} (${Math.round(lent).toLocaleString('en-US')} H100e of idle training compute to research experiments)` }], exposure: [] };
      return { costs: [{ currency: 'progress', amount: -pct, unit: '%', target: 'research speed (the lent compute goes idle)' }], gains: [], exposure: [] };
    },
    apply: (s, ctx, p) => {
      const pol = s.player.policies;
      const on = typeof p.on === 'boolean' ? p.on : !pol.lendTraining;
      if (on) pol.lendTraining = true;
      else delete pol.lendTraining;
      ctx.log('company', on ? 'Idle training compute is lent to research experiments; it returns when a run launches.' : 'Idle training compute is no longer lent: it stays idle.');
    },
  },
  ...TEAM_ACTIONS,
  ...BUILD_ACTIONS,
  ...AGENT_ACTIONS,
  {
    id: 'starHire', verb: 'hire', system: 'people', sphere: 'departments', owner: 'WS1', title: 'Star hire',
    available: (s) => (s.player.tasteHire >= STAR_HIRE.maxTaste ? 'Taste bench is full' : s.player.finance.cash < starCost(s) ? 'Not enough cash' : true),
    preview: (s) => ({
      costs: [{ currency: 'cash', amount: starCost(s) }, { currency: 'trust', amount: STAR_HIRE.cooperation, target: 'rivals' }],
      gains: [starGain(s)],
      exposure: [],
    }),
    apply: (s, ctx) => {
      hireStar(s);
      bookCash(s, ctx, -starCost(s), 'staff', 'star hire');
      for (const r of s.rivals) if (r.core.status === 'active') r.meters.cooperation = Math.max(-100, r.meters.cooperation + STAR_HIRE.cooperation / Math.max(1, s.rivals.length));
      ctx.log('company', 'A star researcher joins.', 1);
    },
  },
];

/** Models + Departments spheres (registered in core/registry.ts). */
export const MODEL_ACTIONS: ActionDef[] = [...RUN_ACTIONS, ...PRODUCT_ACTIONS, ...TREE_ACTIONS, ...DEPARTMENT_ACTIONS, ...SUITE_ACTIONS, ...DATA_ACTIONS];
