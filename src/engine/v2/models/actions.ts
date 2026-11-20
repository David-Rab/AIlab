// Player actions in the Models and Departments spheres (ActionDef catalog, V2-SPEC §2.7, §3.3, §3.4). Owner: WS1.
// Every preview shows ≥ 1 cost in a currency that is not among its gains (lint-tradeoffs). Previews must work with
// empty params (defaults below). apply() throws on an invalid request; core/loop act() turns that into an error.
import { REFERENCE_BASE, REFERENCE_POST, STREAM_POOL_SHARE } from '../../../data/v2/runDesign';
import { startOf } from '../../../data/v2/starts';
import { decimalYear } from '../core/time';
import { SPLIT_KEYS, TOP_KEYS, fromSpec, presetSplit, setSplit, specOf, type SplitPreset } from '../departments/split';
import { applyBestMix } from '../production/production';
import { STAR_HIRE } from '../../../data/v2/teams';
import { hireStar } from '../departments/teams';
import { TEAM_ACTIONS } from '../departments/teamActions';
import { BUILD_ACTIONS } from '../departments/build';
import { SUITE_ACTIONS } from './suites';
import { DATA_ACTIONS } from '../production/dataActions';
import type {
  ActionDef, BaseDesign, ComputeSplit, CostLine, GameStateV2, PostDesign, RLFamily,
} from '../types';
import { runEvalSuite } from './benchmarks';
import { makeVariant, retireVersion } from './deployments';
import { AGENT_ACTIONS } from '../departments/agentActions';
import { PRODUCT_ACTIONS } from './productOps';
import { bestMeasuredL, internalVersion, versionById } from './labs';
import { TREE_ACTIONS } from './treeActions';
import { POOL_SHARE_RANGE, idleTrainingShare, launchRun, planRun, startStream, type LaunchRunParams } from './runs';
import { poolsOf } from '../compute/power';
import { clamp } from '../../rng';
import { bookCash } from '../finance/ledger';

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
const latestBase = (s: GameStateV2) => s.player.models.bases[s.player.models.bases.length - 1];
const latestFull = (s: GameStateV2) => [...s.player.models.versions].reverse().find((v) => v.variant === 'full' && v.status !== 'retired');

/** Base design from params (defaults = reference recipe). */
export function baseFromParams(p: Params): BaseDesign {
  const r = REFERENCE_BASE;
  return {
    params: num(p, 'params', r.params), tpp: num(p, 'tpp', r.tpp), shape: str(p, 'shape', r.shape) as BaseDesign['shape'],
    data: str(p, 'data', r.data) as BaseDesign['data'],
    curation: { quality: bool(p, 'quality', r.curation.quality), hazard: bool(p, 'hazard', r.curation.hazard), safetyPretrain: bool(p, 'safetyPretrain', r.curation.safetyPretrain) },
    licensedShare: num(p, 'licensedShare', r.licensedShare),
  };
}

/** Post design from params; rlFocus is 'broad' or a comma list of ≤ 2 families. */
export function postFromParams(p: Params): PostDesign {
  const r = REFERENCE_POST;
  const f = str(p, 'rlFocus', 'broad');
  return {
    pref: str(p, 'pref', r.pref) as PostDesign['pref'], rlFocus: f === 'broad' ? 'broad' : (f.split(',').filter(Boolean) as RLFamily[]),
    rlBudget: str(p, 'rlBudget', r.rlBudget) as PostDesign['rlBudget'], inoculation: bool(p, 'inoculation', r.inoculation),
    cot: str(p, 'cot', r.cot) as PostDesign['cot'], safety: str(p, 'safety', r.safety) as PostDesign['safety'], techniques: [], trainAgainst: [],
  };
}

function runParams(s: GameStateV2, kind: LaunchRunParams['kind'], p: Params): LaunchRunParams {
  const lp: LaunchRunParams = { kind };
  if (p.poolShare !== undefined) lp.poolShare = num(p, 'poolShare', 0.5);
  if (kind === 'base') {
    lp.base = baseFromParams(p);
    if (p.teacherVersionId) lp.teacherVersionId = str(p, 'teacherVersionId', '');
  } else if (kind === 'post') {
    lp.post = postFromParams(p);
    const b = str(p, 'baseId', latestBase(s)?.id ?? '');
    lp.baseId = b;
    if (latestBase(s)?.design.shape === 'latent' && p.cot === undefined && b === latestBase(s)?.id) lp.post.cot = 'latent';
  } else if (kind === 'distill') {
    lp.teacherVersionId = str(p, 'teacherVersionId', latestFull(s)?.id ?? '');
    if (typeof p.studentParams === 'number') lp.studentParams = num(p, 'studentParams', 0);
  }
  else lp.baseId = str(p, 'baseId', latestBase(s)?.id ?? '');
  return lp;
}

/** Run preview: compute and cash costs, capability gain, trait-pressure exposure. */
function runPreview(s: GameStateV2, lp: LaunchRunParams): Preview {
  const plan = planRun(s, lp);
  const cur = internalVersion(s)?.evals.measuredL ?? bestMeasuredL(s);
  const gainL = (plan.prediction.Lg[0] + plan.prediction.Lg[1]) / 2 - cur;
  const costs: CostLine[] = [{ currency: 'compute', amount: plan.poolShare, target: 'training pool share' }];
  if (plan.cashCost > 0) costs.push({ currency: 'cash', amount: plan.cashCost });
  const exposure: CostLine[] = [];
  const sig = plan.prediction.signals;
  const pressure = Object.values(sig).reduce((a, x) => a + x, 0);
  if (pressure > 0) exposure.push({ currency: 'alignment', amount: -pressure, lagDays: plan.etaDays, probability: 0.5 });
  const scrutiny = lp.base ? (plan.limits?.scrutiny ?? 0) : 0;
  if (scrutiny >= 0.5) exposure.push({ currency: 'scrutiny', amount: Math.round(scrutiny * 10) / 10 });
  return { costs, gains: [{ currency: 'progress', amount: Math.round(gainL * 100) / 100, lagDays: plan.etaDays }], exposure };
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

const p18 = (s: GameStateV2) => (s.player.paradigms.P18?.status === 'adopted' ? true : 'Needs IDA (P18)');

const RUN_ACTIONS: ActionDef[] = [
  runAction('launchBase', 'Pretrain base', 'base'),
  runAction('launchPost', 'Post-train', 'post', (s) => (s.player.models.bases.length ? true : 'No base')),
  runAction('launchDistill', 'Distill mini', 'distill'),
  runAction('launchContinue', 'Continue base', 'continue', (s) => (s.player.models.bases.length ? true : 'No base')),
  {
    id: 'idaCycle', verb: 'train', system: 'models', sphere: 'models', owner: 'WS1', title: 'Amplify',
    available: p18,
    preview: (s, p) => {
      const v = versionById(s, str(p, 'versionId', latestFull(s)?.id ?? ''));
      const plan = v ? planRun(s, { kind: 'post', ida: true, baseId: v.baseId, teacherVersionId: v.id, post: v.design }) : undefined;
      const gainL = plan && v ? (plan.prediction.Lg[0] + plan.prediction.Lg[1]) / 2 - (v.evals.measuredL ?? plan.prediction.Lg[0]) : 0;
      return {
        costs: [{ currency: 'compute', amount: 0.3, target: 'training pool share' }],
        gains: [{ currency: 'progress', amount: Math.round(gainL * 100) / 100, lagDays: plan?.etaDays ?? 0 }],
        exposure: [{ currency: 'alignment', amount: -0.1, lagDays: plan?.etaDays ?? 0, probability: s.player.paradigms.P18?.status === 'adopted' ? 1 : 0 }],
      };
    },
    apply: (s, ctx, p) => {
      const v = versionById(s, str(p, 'versionId', latestFull(s)?.id ?? ''));
      const r = launchRun(s, ctx, { kind: 'post', ida: true, baseId: v?.baseId, teacherVersionId: v?.id, post: v?.design ?? REFERENCE_POST });
      if (typeof r === 'string') fail(r);
    },
  },
  {
    id: 'runs.setShare', verb: 'train', system: 'models', sphere: 'models', owner: 'WS1', title: 'Pool share',
    available: (s) => (s.player.models.runs.some((r) => r.status === 'running') ? true : 'No running runs'),
    preview: (s, p) => {
      const r = s.player.models.runs.find((x) => x.id === str(p, 'runId', '')) ?? s.player.models.runs.find((x) => x.status === 'running');
      const share = clamp(num(p, 'share', r?.poolShare ?? 0.5), POOL_SHARE_RANGE[0], POOL_SHARE_RANGE[1]);
      const d = share - (r?.poolShare ?? share);
      const line = { currency: 'compute' as const, amount: Math.round(Math.abs(d) * 100) / 100, target: 'training pool share' };
      // More share: the run finishes sooner, other runs (or idle research compute) get less; less share: the reverse.
      return d >= 0
        ? { costs: [line], gains: [{ currency: 'progress', amount: Math.round(d * 100) / 100, target: r?.name ?? 'run' }], exposure: [] }
        : { costs: [{ currency: 'progress', amount: Math.round(d * 100) / 100, target: r?.name ?? 'run' }], gains: [line], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const r = s.player.models.runs.find((x) => x.id === str(p, 'runId', '') && (x.status === 'running' || x.status === 'paused'));
      if (!r) return fail('Unknown run');
      r.poolShare = clamp(num(p, 'share', r.poolShare), POOL_SHARE_RANGE[0], POOL_SHARE_RANGE[1]);
    },
  },
  {
    id: 'runs.spareTraining', verb: 'policy', system: 'models', sphere: 'models', owner: 'WS1', title: 'Spare training compute',
    available: () => true,
    preview: (s, p) => {
      const use = str(p, 'use', s.player.policies.spareTraining === 'data' ? 'research' : 'data');
      const spare = Math.round(idleTrainingShare(s) * poolsOf(s).training);
      const toData = { currency: 'compute' as const, amount: spare, target: 'data generation' };
      const exp = s.player.prodCache?.elast.exp ?? 0.3;
      const pool = poolsOf(s);
      const research = { currency: 'progress' as const, amount: Math.round(exp * Math.log1p(spare / Math.max(1, pool.experiments)) * 1e4) / 1e4, target: 'research speed' };
      return use === 'data' ? { costs: [research], gains: [toData], exposure: [] } : { costs: [toData], gains: [research], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const use = str(p, 'use', '');
      if (use !== 'research' && use !== 'data') return fail('Use research or data');
      s.player.policies.spareTraining = use;
    },
  },
  {
    id: 'cancelRun', verb: 'train', system: 'models', sphere: 'models', owner: 'WS1', title: 'Cancel run',
    available: (s) => (s.player.models.runs.some((r) => r.status === 'running') ? true : 'No running runs'),
    preview: (s, p) => {
      const r = s.player.models.runs.find((x) => x.id === str(p, 'runId', '')) ?? s.player.models.runs.find((x) => x.status === 'running');
      return { costs: [{ currency: 'progress', amount: r ? -(r.flopDone / Math.max(1, r.flopNeeded)) : 0 }, { currency: 'cash', amount: r?.cashCost ?? 0, target: 'sunk' }], gains: [{ currency: 'compute', amount: r?.poolShare ?? 0 }], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const r = s.player.models.runs.find((x) => x.id === str(p, 'runId', '') && x.status === 'running');
      if (!r) fail('Unknown run');
      else r.status = 'cancelled';
    },
  },
  {
    id: 'startStream', verb: 'train', system: 'models', sphere: 'models', owner: 'WS1', title: 'Continual learning',
    available: (s) => (s.player.paradigms.P08?.status === 'adopted' ? true : 'Needs continual learning (P08)'),
    preview: () => ({
      costs: [{ currency: 'compute', amount: STREAM_POOL_SHARE, target: 'training pool share' }, { currency: 'monitorability', amount: -0.1 }],
      gains: [{ currency: 'progress', amount: 0.2, lagDays: 30 }],
      exposure: [{ currency: 'alignment', amount: -0.1, lagDays: 60, probability: 0.5 }],
    }),
    apply: (s, _ctx, p) => fail(startStream(s, str(p, 'versionId', internalVersion(s)?.id ?? ''))),
  },
  {
    id: 'stopStream', verb: 'train', system: 'models', sphere: 'models', owner: 'WS1', title: 'Stop stream',
    available: (s) => (s.player.models.stream ? true : 'No stream'),
    preview: () => ({ costs: [{ currency: 'progress', amount: -0.1 }], gains: [{ currency: 'compute', amount: STREAM_POOL_SHARE }, { currency: 'monitorability', amount: 0.05 }], exposure: [] }),
    apply: (s) => {
      delete s.player.models.stream;
    },
  },
  {
    id: 'makeVariant', verb: 'launch', system: 'products', sphere: 'models', owner: 'WS1', title: 'Make variant',
    available: () => true,
    preview: (_s, p) => {
      const v = str(p, 'variant', 'gov');
      return v === 'open'
        ? { costs: [{ currency: 'leadDays', amount: -60 }, { currency: 'security', amount: -1 }], gains: [{ currency: 'trust', amount: 3 }], exposure: [] }
        : { costs: [{ currency: 'staffTime', amount: 10 }], gains: [{ currency: 'revenue', amount: 0.5 }], exposure: [{ currency: 'approval', amount: -1, probability: 0.2 }] };
    },
    apply: (s, _ctx, p) => {
      const r = makeVariant(s, str(p, 'versionId', latestFull(s)?.id ?? ''), str(p, 'variant', 'gov') as 'gov' | 'trusted' | 'open');
      if (typeof r === 'string') fail(r);
    },
  },
  {
    id: 'retireVersion', verb: 'launch', system: 'models', sphere: 'models', owner: 'WS1', title: 'Retire',
    available: () => true,
    preview: () => ({ costs: [{ currency: 'progress', amount: 0, target: 'option value' }], gains: [{ currency: 'compute', amount: 0.01 }], exposure: [] }),
    apply: (s, _ctx, p) => fail(retireVersion(s, str(p, 'versionId', ''))),
  },
  {
    id: 'runEvals', verb: 'policy', system: 'models', sphere: 'models', owner: 'WS1', title: 'Run evals',
    available: () => true,
    preview: (_s, p) => {
      const by = str(p, 'by', 'self');
      return {
        costs: [{ currency: 'staffTime', amount: 20 }, { currency: 'compute', amount: 0.005 }],
        gains: by === 'self' ? [{ currency: 'monitorability', amount: 0.02 }] : [{ currency: 'credibility', amount: 2 }, { currency: 'trust', amount: 1, target: by }],
        exposure: by === 'self' ? [] : [{ currency: 'leadDays', amount: -14 }],
      };
    },
    apply: (s, ctx, p) => {
      const v = versionById(s, str(p, 'versionId', internalVersion(s)?.id ?? ''));
      if (!v) fail('Unknown version');
      else runEvalSuite(s, ctx, v.id, str(p, 'by', 'self') as 'self' | 'evalGov' | 'evalIndep');
    },
  },
];

// ───────────────────────────── departments ─────────────────────────────

/** Split from action params: either top-level shares (training, research, serving, safety) with optional dataShare
 *  and expShare, or the six pool keys (bots, saves). Missing values keep the current split. */
function splitFromParams(s: GameStateV2, p: Params): ComputeSplit {
  if (TOP_KEYS.some((k) => k === 'research' && typeof p[k] === 'number') || typeof p.dataShare === 'number' || typeof p.expShare === 'number') {
    const cur = specOf(s.player.split);
    const top = { ...cur.top };
    for (const k of TOP_KEYS) if (typeof p[k] === 'number') top[k] = p[k] as number;
    return fromSpec({ top, dataShare: num(p, 'dataShare', cur.dataShare), expShare: num(p, 'expShare', cur.expShare) });
  }
  const out = { ...s.player.split };
  for (const k of SPLIT_KEYS) if (typeof p[k] === 'number') out[k] = p[k] as number;
  return out;
}

/** Apply a split, the manual/auto research-mix choice (param `manual` 1/0), then the best mix when automatic. */
function applySplit(s: GameStateV2, sp: ComputeSplit, p: Params): string | undefined {
  const err = setSplit(s, sp);
  if (err) return err;
  if (typeof p.manual === 'number') s.player.researchManual = p.manual > 0 ? true : undefined;
  applyBestMix(s, 'player');
  return undefined;
}

function splitPreview(s: GameStateV2, next: ComputeSplit): Preview {
  const cur = s.player.split;
  const costs: CostLine[] = [];
  const gains: CostLine[] = [];
  const cur2cur: Record<keyof ComputeSplit, CostLine['currency']> = {
    training: 'progress', experiments: 'progress', agents: 'progress', synthetic: 'progress', serving: 'revenue', safety: 'alignment',
  };
  const agg: Partial<Record<CostLine['currency'], number>> = {};
  for (const k of SPLIT_KEYS) agg[cur2cur[k]] = (agg[cur2cur[k]] ?? 0) + (next[k] - cur[k]);
  for (const [c, d] of Object.entries(agg) as [CostLine['currency'], number][]) {
    if (d > 1e-4) gains.push({ currency: c, amount: d });
    else if (d < -1e-4) costs.push({ currency: c, amount: d });
  }
  if (!costs.length) costs.push({ currency: 'compute', amount: 0, target: 'no change' });
  return { costs, gains, exposure: [] };
}

export const DEPARTMENT_ACTIONS: ActionDef[] = [
  {
    id: 'setSplit', verb: 'policy', system: 'compute', sphere: 'departments', owner: 'WS1', title: 'Compute split',
    available: () => true,
    preview: (s, p) => splitPreview(s, splitFromParams(s, p)),
    apply: (s, _ctx, p) => fail(applySplit(s, splitFromParams(s, p), p)),
  },
  {
    id: 'splitPreset', verb: 'policy', system: 'compute', sphere: 'departments', owner: 'WS1', title: 'Split preset',
    available: () => true,
    preview: (s, p) => splitPreview(s, presetSplit(str(p, 'preset', 'reference') as SplitPreset, decimalYear(s), s.player.split)),
    apply: (s, _ctx, p) => fail(applySplit(s, presetSplit(str(p, 'preset', 'reference') as SplitPreset, decimalYear(s), s.player.split), p)),
  },
  ...TEAM_ACTIONS,
  ...BUILD_ACTIONS,
  ...AGENT_ACTIONS,
  {
    id: 'starHire', verb: 'hire', system: 'people', sphere: 'departments', owner: 'WS1', title: 'Star hire',
    available: (s) => (s.player.tasteHire >= STAR_HIRE.maxTaste ? 'Taste bench is full' : s.player.finance.cash < starCost(s) ? 'Not enough cash' : true),
    preview: (s) => ({
      costs: [{ currency: 'cash', amount: starCost(s) }, { currency: 'trust', amount: STAR_HIRE.cooperation, target: 'rivals' }],
      gains: [{ currency: 'progress', amount: Math.round((s.player.prodCache?.elast.taste ?? 0.5) * STAR_HIRE.dTaste * 1000) / 1000 }],
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
