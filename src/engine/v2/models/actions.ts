// Player actions in the Models and Departments spheres (ActionDef catalog, V2-SPEC §2.7, §3.3, §3.4). Owner: WS1.
// Every preview shows ≥ 1 cost in a currency that is not among its gains (lint-tradeoffs). Previews must work with
// empty params (defaults below). apply() throws on an invalid request; core/loop act() turns that into an error.
import { PARADIGMS } from '../../../data/v2/paradigms';
import { REFERENCE_BASE, REFERENCE_POST, STREAM_POOL_SHARE } from '../../../data/v2/runDesign';
import { decimalYear } from '../core/time';
import { SPLIT_KEYS, presetSplit, setSplit, type SplitPreset } from '../departments/split';
import { ROLES, STAFF_COST_M, STAR_HIRE, payrollPerYear } from '../departments/staffing';
import type {
  ActionDef, BaseDesign, Channel, ComputeSplit, CostLine, GameStateV2, PostDesign, RLFamily, StaffByRole,
} from '../types';
import { runEvalSuite } from './benchmarks';
import { deploy, makeVariant, retireVersion, setInternalAgent, swapDeployment, withdraw } from './deployments';
import { bestMeasuredL, internalVersion, versionById } from './labs';
import { adoptParadigm, fundParadigm, paradigmGate } from './paradigms';
import { launchRun, planRun, startStream, type LaunchRunParams } from './runs';

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
    scale: str(p, 'scale', r.scale) as BaseDesign['scale'], shape: str(p, 'shape', r.shape) as BaseDesign['shape'],
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
    rlIntensity: str(p, 'rlIntensity', r.rlIntensity) as PostDesign['rlIntensity'], inoculation: bool(p, 'inoculation', r.inoculation),
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
  } else if (kind === 'distill') lp.teacherVersionId = str(p, 'teacherVersionId', latestFull(s)?.id ?? '');
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
  if (lp.base?.scale === 'stretch') exposure.push({ currency: 'scrutiny', amount: 5 });
  return { costs, gains: [{ currency: 'progress', amount: Math.round(gainL * 100) / 100, lagDays: plan.etaDays }], exposure };
}

const runAction = (id: string, title: string, kind: LaunchRunParams['kind'], extra?: (s: GameStateV2) => true | string): ActionDef => ({
  id, sphere: 'models', owner: 'WS1', title,
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
    id: 'idaCycle', sphere: 'models', owner: 'WS1', title: 'Amplify',
    available: p18,
    preview: (s) => ({
      costs: [{ currency: 'compute', amount: 0.3, target: 'training pool share' }],
      gains: [{ currency: 'progress', amount: 0.25, lagDays: 21 }],
      exposure: [{ currency: 'alignment', amount: -0.1, lagDays: 21, probability: s.player.paradigms.P18?.status === 'adopted' ? 1 : 0 }],
    }),
    apply: (s, ctx, p) => {
      const v = versionById(s, str(p, 'versionId', latestFull(s)?.id ?? ''));
      const r = launchRun(s, ctx, { kind: 'post', ida: true, baseId: v?.baseId, teacherVersionId: v?.id, post: v?.design ?? REFERENCE_POST });
      if (typeof r === 'string') fail(r);
    },
  },
  {
    id: 'cancelRun', sphere: 'models', owner: 'WS1', title: 'Cancel run',
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
    id: 'startStream', sphere: 'models', owner: 'WS1', title: 'Continual learning',
    available: (s) => (s.player.paradigms.P08?.status === 'adopted' ? true : 'Needs continual learning (P08)'),
    preview: () => ({
      costs: [{ currency: 'compute', amount: STREAM_POOL_SHARE, target: 'training pool share' }, { currency: 'monitorability', amount: -0.1 }],
      gains: [{ currency: 'progress', amount: 0.2, lagDays: 30 }],
      exposure: [{ currency: 'alignment', amount: -0.1, lagDays: 60, probability: 0.5 }],
    }),
    apply: (s, _ctx, p) => fail(startStream(s, str(p, 'versionId', internalVersion(s)?.id ?? ''))),
  },
  {
    id: 'stopStream', sphere: 'models', owner: 'WS1', title: 'Stop stream',
    available: (s) => (s.player.models.stream ? true : 'No stream'),
    preview: () => ({ costs: [{ currency: 'progress', amount: -0.1 }], gains: [{ currency: 'compute', amount: STREAM_POOL_SHARE }, { currency: 'monitorability', amount: 0.05 }], exposure: [] }),
    apply: (s) => {
      delete s.player.models.stream;
    },
  },
  {
    id: 'setInternalAgent', sphere: 'models', owner: 'WS1', title: 'Internal agents',
    available: () => true,
    preview: (s, p) => {
      const v = versionById(s, str(p, 'versionId', '')) ?? internalVersion(s);
      const cur = internalVersion(s);
      const dL = (v?.evals.measuredL ?? 0) - (cur?.evals.measuredL ?? 0);
      return {
        costs: [{ currency: 'security', amount: -0.05, target: 'exfiltration hazard' }],
        gains: [{ currency: 'progress', amount: Math.round(dL * 100) / 100 }],
        exposure: [{ currency: 'alignment', amount: -0.05, probability: 0.3 }],
      };
    },
    apply: (s, _ctx, p) => fail(setInternalAgent(s, str(p, 'versionId', ''))),
  },
  {
    id: 'deploy', sphere: 'models', owner: 'WS1', title: 'Deploy',
    available: (s) => (s.player.models.versions.some((v) => v.status === 'ready' || v.status === 'deployed') ? true : 'No evaluated version'),
    preview: (_s, p) => {
      const ch = str(p, 'channel', 'api') as Channel;
      const costs: CostLine[] = [{ currency: 'compute', amount: num(p, 'servingShare', 0.2), target: 'serving pool' }];
      const exposure: CostLine[] = [];
      if (ch === 'api' || ch === 'agents' || ch === 'consumer') exposure.push({ currency: 'leadDays', amount: -10, lagDays: 30, probability: 0.6 });
      if (ch === 'open') costs.push({ currency: 'leadDays', amount: -60, target: 'rivals and China absorb the weights' });
      exposure.push({ currency: 'approval', amount: -2, probability: 0.2, lagDays: 60 });
      return { costs, gains: ch === 'open' ? [{ currency: 'trust', amount: 3, target: 'academia' }] : [{ currency: 'revenue', amount: 1 }], exposure };
    },
    apply: (s, ctx, p) => {
      const r = deploy(s, ctx, {
        versionId: str(p, 'versionId', ''), channel: str(p, 'channel', 'api') as Channel, priceIndex: num(p, 'priceIndex', 1),
        effort: str(p, 'effort', 'max') as 'low' | 'max' | 'deep', kyc: Math.round(num(p, 'kyc', 1)) as 0 | 1 | 2 | 3,
        ...(p.servingShare !== undefined ? { servingShare: num(p, 'servingShare', 0.2) } : {}),
      });
      if (typeof r === 'string') fail(r);
    },
  },
  {
    id: 'swapDeployment', sphere: 'models', owner: 'WS1', title: 'Swap model',
    available: (s) => (s.player.deployments.some((d) => d.status === 'live' && d.channel !== 'open') ? true : 'Nothing deployed'),
    preview: (s, p) => {
      const v = versionById(s, str(p, 'versionId', ''));
      return {
        costs: [{ currency: 'staffTime', amount: 5 }],
        gains: [{ currency: 'revenue', amount: v ? 0.5 : 0 }],
        exposure: [{ currency: 'leadDays', amount: -5, lagDays: 30, probability: 0.5 }, { currency: 'approval', amount: -1, probability: 0.1 }],
      };
    },
    apply: (s, _ctx, p) => fail(swapDeployment(s, str(p, 'deploymentId', ''), str(p, 'versionId', ''))),
  },
  {
    id: 'withdraw', sphere: 'models', owner: 'WS1', title: 'Withdraw',
    available: (s) => (s.player.deployments.some((d) => d.status === 'live' && d.channel !== 'internal' && d.channel !== 'open') ? true : 'Nothing to withdraw'),
    preview: (s, p) => {
      const d = s.player.deployments.find((x) => x.id === str(p, 'deploymentId', ''));
      return { costs: [{ currency: 'revenue', amount: -(d?.revenueRate ?? 1) }], gains: [{ currency: 'compute', amount: d?.servingShare ?? 0.1, target: 'serving pool' }], exposure: [{ currency: 'trust', amount: -1, probability: 0.3 }] };
    },
    apply: (s, _ctx, p) => fail(withdraw(s, str(p, 'deploymentId', ''))),
  },
  {
    id: 'makeVariant', sphere: 'models', owner: 'WS1', title: 'Make variant',
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
    id: 'retireVersion', sphere: 'models', owner: 'WS1', title: 'Retire',
    available: () => true,
    preview: () => ({ costs: [{ currency: 'progress', amount: 0, target: 'option value' }], gains: [{ currency: 'compute', amount: 0.01 }], exposure: [] }),
    apply: (s, _ctx, p) => fail(retireVersion(s, str(p, 'versionId', ''))),
  },
  {
    id: 'runEvals', sphere: 'models', owner: 'WS1', title: 'Run evals',
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
  {
    id: 'fundParadigm', sphere: 'models', owner: 'WS1', title: 'Research',
    available: (s) => (PARADIGMS.some((x) => paradigmGate(s, x.id) === true && ['available', 'researching', 'failed'].includes(s.player.paradigms[x.id]?.status ?? '')) ? true : 'No open projects'),
    preview: (_s, p) => {
      const fte = num(p, 'fte', 30);
      return {
        costs: [{ currency: 'staffTime', amount: fte }, { currency: 'compute', amount: num(p, 'expShare', 0.02), target: 'experiment pool share' }],
        gains: [{ currency: 'progress', amount: 0.1, probability: 0.7 }],
        exposure: [{ currency: 'alignment', amount: -0.05, probability: 0.3 }],
      };
    },
    apply: (s, _ctx, p) => fail(fundParadigm(s, str(p, 'id', ''), num(p, 'fte', 30), num(p, 'expShare', 0.02))),
  },
  {
    id: 'adoptParadigm', sphere: 'models', owner: 'WS1', title: 'Adopt',
    available: (s) => (Object.values(s.player.paradigms).some((x) => x.status === 'succeeded') ? true : 'Nothing to adopt'),
    preview: (_s, p) => {
      const id = str(p, 'id', '');
      if (id === 'P17') return { costs: [{ currency: 'monitorability', amount: -0.85 }], gains: [{ currency: 'progress', amount: 0.4 }], exposure: [{ currency: 'trust', amount: -5, probability: 0.5, target: 'evalGov' }] };
      if (id === 'P23') return { costs: [{ currency: 'progress', amount: -0.24 }], gains: [{ currency: 'monitorability', amount: 0.08 }], exposure: [] };
      return { costs: [{ currency: 'staffTime', amount: 10, target: 'integration' }], gains: [{ currency: 'progress', amount: 0.1 }], exposure: [{ currency: 'alignment', amount: -0.05, probability: 0.3 }] };
    },
    apply: (s, _ctx, p) => fail(adoptParadigm(s, str(p, 'id', ''))),
  },
];

// ───────────────────────────── departments ─────────────────────────────

function splitFromParams(s: GameStateV2, p: Params): ComputeSplit {
  const out = { ...s.player.split };
  for (const k of SPLIT_KEYS) if (typeof p[k] === 'number') out[k] = p[k] as number;
  return out;
}

function splitPreview(s: GameStateV2, next: ComputeSplit): Preview {
  const cur = s.player.split;
  const costs: CostLine[] = [];
  const gains: CostLine[] = [];
  const cur2cur: Record<keyof ComputeSplit, CostLine['currency']> = {
    training: 'progress', experiments: 'progress', agents: 'progress', synthetic: 'progress', serving: 'revenue', safety: 'alignment', security: 'security',
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
    id: 'setSplit', sphere: 'departments', owner: 'WS1', title: 'Compute split',
    available: () => true,
    preview: (s, p) => splitPreview(s, splitFromParams(s, p)),
    apply: (s, _ctx, p) => fail(setSplit(s, splitFromParams(s, p))),
  },
  {
    id: 'splitPreset', sphere: 'departments', owner: 'WS1', title: 'Split preset',
    available: () => true,
    preview: (s, p) => splitPreview(s, presetSplit(str(p, 'preset', 'reference') as SplitPreset, decimalYear(s))),
    apply: (s, _ctx, p) => fail(setSplit(s, presetSplit(str(p, 'preset', 'reference') as SplitPreset, decimalYear(s)))),
  },
  {
    id: 'hireTarget', sphere: 'departments', owner: 'WS1', title: 'Hiring target',
    available: () => true,
    preview: (s, p) => {
      const role = str(p, 'role', 'cap') as keyof StaffByRole;
      const n = num(p, 'target', s.player.hiring.target[role] ?? 0);
      const d = n - (s.player.hiring.target[role] ?? 0);
      const dollars = (d * STAFF_COST_M[role]) / 1000;
      const what: CostLine['currency'] = role === 'cap' ? 'progress' : role === 'saf' ? 'alignment' : role === 'sec' ? 'security' : 'revenue';
      return d >= 0
        ? { costs: [{ currency: 'cash', amount: -dollars, target: '$B/yr payroll' }], gains: [{ currency: what, amount: d, lagDays: 42 }], exposure: [] }
        : { costs: [{ currency: 'morale', amount: Math.max(-15, (100 * d) / Math.max(1, s.player.staff[role])) }, { currency: what, amount: d }], gains: [{ currency: 'cash', amount: -dollars, target: '$B/yr payroll' }], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const role = str(p, 'role', 'cap') as keyof StaffByRole;
      if (!ROLES.includes(role)) fail('Unknown role');
      s.player.hiring.target[role] = Math.max(0, Math.round(num(p, 'target', s.player.hiring.target[role])));
    },
  },
  {
    id: 'starHire', sphere: 'departments', owner: 'WS1', title: 'Star hire',
    available: (s) => (s.player.tasteHire >= STAR_HIRE.maxTaste ? 'Taste bench is full' : s.player.finance.cash < STAR_HIRE.cost ? 'Not enough cash' : true),
    preview: (s) => ({
      costs: [{ currency: 'cash', amount: STAR_HIRE.cost }, { currency: 'trust', amount: STAR_HIRE.cooperation, target: 'rivals' }],
      gains: [{ currency: 'progress', amount: Math.round((s.player.prodCache?.elast.taste ?? 0.5) * STAR_HIRE.dTaste * 1000) / 1000 }],
      exposure: [],
    }),
    apply: (s, ctx) => {
      s.player.tasteHire = Math.min(STAR_HIRE.maxTaste, s.player.tasteHire + STAR_HIRE.dTaste);
      ctx.bump('cash', -STAR_HIRE.cost, 'star hire');
      for (const r of s.rivals) if (r.core.status === 'active') r.meters.cooperation = Math.max(-100, r.meters.cooperation + STAR_HIRE.cooperation / Math.max(1, s.rivals.length));
      ctx.log('company', 'A star researcher joins.', 1);
    },
  },
];

/** Models + Departments spheres (registered in core/registry.ts). */
export const MODEL_ACTIONS: ActionDef[] = [...RUN_ACTIONS, ...DEPARTMENT_ACTIONS];

/** Annual payroll at the current hiring targets ($B/yr) — UI helper. */
export const payrollAtTarget = (s: GameStateV2) => payrollPerYear(s.player.hiring.target);
