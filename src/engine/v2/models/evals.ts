// Evaluations as work (model v3 D7; MODEL-V3 §10). Owner: WS1. Numbers and sources: src/data/v2/evals.ts.
//
// An eval suite is a task (EvalTask on s.player.models.evals) with three parts:
//   research engineers  `reTW` team-weeks of effective work, on the 'evals' need of the capabilities research-engineer
//                       allocation (after run operations by default; the player's order and caps apply). A suite advances
//                       at most at its depth's staff (effective team-equivalents: the analysis lag of a small team's 1–3
//                       weeks, research/20 §G (c)); AI labour in experiments (m_EXP) does part of the work, so it needs
//                       fewer people (÷ m, as run operations) but is not shorter. External evaluators work with their own
//                       staff (EXT_EVAL_STAFF).
//   inference compute   tokens on every benchmark's rollouts at the evaluated model's FLOP per token, as H100e-days at
//                       serving utilisation (prefill 0.35, decode 0.07), drawn from the EXPERIMENTS pool (the research
//                       cluster) ahead of the projects, in step with the research engineers' progress; a suite whose
//                       compute is short advances only as far as the compute goes.
//   engineers           `engTW` team-weeks on the build queue (kind 'eval', worked with run setups in the 'runs' need).
// Duration = work ÷ capacity (no fixed days); a suite finishes when all three are done: runEvalSuite reads the version at
// the task's depth and evaluator, and a release suite lets the version out of 'evaluating'.
//
// Standing policy (R7: no chores):
//   release gate        a finished version waits in 'evaluating' for a suite at the gate's depth (basic → basic, full →
//                       full, full + external → deep; external reports stay WS4's). Gate 'none': the version is ready at
//                       once and, under auto-evaluate, gets a basic suite that blocks nothing.
//   auto-evaluate       the internal models and the continual-learning stream are re-run when they changed in place by
//                       ≥ REEVAL_DG OOM (the recipe the stream applied) or REEVAL_DAYS after their last suite, at the policy depth (the gate's, basic if none).
import { BENCHMARKS, BENCH_NOISE_SD, SAFETY_EVALS } from '../../../data/v2/benchmarks';
import { EVAL_DEPTHS, EVAL_DEPTH_IDS, EVAL_TOKENS, EXT_EVAL_STAFF, FULL_ROLLOUTS, REEVAL_DAYS, REEVAL_DG } from '../../../data/v2/evals';
import { TEAM_SIZE } from '../../../data/v2/teams';
import { PEAK_FLOPS, U_DECODE, U_PREFILL } from '../../../data/v2/workTypes';
import { AGENT_USES } from '../../../data/v2/agents';
import type { EvalDepth, EvalTask, GameStateV2, ModelVersion, SafetyDept, SystemCtx } from '../types';
import { flopPerToken, workContext } from '../departments/workfit';
import { buildEtas, queueBuild } from '../departments/build';
import { agentVersion } from '../departments/agents';
import { MEASURE_SD, measuredSd, runEvalSuite, type Evaluator } from './benchmarks';
import { versionById } from './labs';
import { inPlaceRecipe } from './stacks';
import { allocate, capReCapacity, expPoolH100e, reAllocation, reDemand } from './research';

/** Suite depth the eval gate asks for before release (none: no release suite). */
export function gateDepth(gate: SafetyDept['evalGate']): EvalDepth | undefined {
  return gate === 'none' ? undefined : gate === 'basic' ? 'basic' : gate === 'full' ? 'full' : 'deep';
}
/** Depth of the standing policy's suites: the gate's, basic when there is no gate. */
export const policyDepth = (s: GameStateV2): EvalDepth => gateDepth(s.player.safety.evalGate) ?? 'basic';

/** Benchmarks in one suite (capability and safety evals). */
export const SUITE_BENCHMARKS = BENCHMARKS.length + SAFETY_EVALS.length;

export interface EvalCost {
  /** Research-engineer team-weeks (effective), the most team-equivalents that can work it at once (human), engineer
   *  team-weeks, inference compute (H100e-days), tokens and rollouts. */
  reTW: number; maxTeams: number; engTW: number; h100eDays: number; tokens: number; rollouts: number;
}

/** Work of one suite of `depth` on version `v` (its FLOP per token sets the compute). */
export function evalCost(s: GameStateV2, v: Pick<ModelVersion, 'baseId' | 'serveCost' | 'params' | 'fpt'>, depth: EvalDepth, by: Evaluator = 'self'): EvalCost {
  const D = EVAL_DEPTHS[depth];
  const rollouts = SUITE_BENCHMARKS * D.rollouts;
  const tin = EVAL_TOKENS.input * D.tokMult;
  const tout = EVAL_TOKENS.output * D.tokMult;
  const fpt = flopPerToken(s, v);
  const h100eDays = (rollouts * fpt * (tin / U_PREFILL + tout / U_DECODE)) / PEAK_FLOPS / 86400;
  const staff = by === 'self' ? D.staff : EXT_EVAL_STAFF;
  return { reTW: D.staffWeeks / TEAM_SIZE.re, maxTeams: staff / TEAM_SIZE.re, engTW: D.engTW, h100eDays, tokens: rollouts * (tin + tout), rollouts };
}

const evalsOf = (s: GameStateV2) => (s.player.models.evals ??= []);
const spentOf = (s: GameStateV2) => (s.player.models.evalSpent ??= { suites: 0, reTW: 0, engTW: 0, h100eDays: 0 });
/** The open suite of a version by an evaluator, if any. */
export const openEval = (s: GameStateV2, versionId: string, by: Evaluator = 'self') => evalsOf(s).find((t) => t.versionId === versionId && t.by === by);
/** Release suites first (a version waits on them), then the player's orders, then the policy's; oldest first. */
const RANK: Record<EvalTask['why'], number> = { release: 0, order: 1, policy: 2 };
const ordered = (s: GameStateV2) => [...evalsOf(s)].sort((a, b) => RANK[a.why] - RANK[b.why] || a.day - b.day);

/** Queue a suite; returns the task, or a reason. A release suite for a version already queued by the policy or an order
 *  takes it over (it becomes the release suite). */
export function queueEval(s: GameStateV2, v: ModelVersion, depth: EvalDepth, by: Evaluator, why: EvalTask['why']): EvalTask | string {
  if (v.status === 'retired' || v.status === 'rolledBack') return 'Version is retired';
  const open = openEval(s, v.id, by);
  if (open) {
    if (why === 'release' && open.why !== 'release') open.why = 'release';
    else return `${v.name} is already being evaluated`;
    return open;
  }
  const c = evalCost(s, v, depth, by);
  const t: EvalTask = {
    id: `ev:${v.id}:${by}:${s.time.day}`, versionId: v.id, depth, by, why, day: s.time.day,
    reTW: by === 'self' ? c.reTW : 0, engTW: c.engTW, h100eDays: c.h100eDays, progress: 0,
  };
  t.engId = queueBuild(s, 'eval', t.id, c.engTW);
  evalsOf(s).push(t);
  return t;
}

/** Drop a task and its build item. */
function dropEval(s: GameStateV2, t: EvalTask) {
  const q = evalsOf(s);
  const i = q.indexOf(t);
  if (i >= 0) q.splice(i, 1);
  if (t.engId) {
    const b = s.player.build;
    b.queue = b.queue.filter((x) => x.id !== t.engId);
    b.queue.forEach((x, k) => (x.priority = k + 1));
  }
}

/** Human research-engineer team-equivalents one of the lab's suites can use today: its depth's staff in effective
 *  team-equivalents (the analysis lag, research/20 §G (c): a pass is a small team's 1–3 weeks, so AI labour frees
 *  people but does not shorten it), no more than its remaining work, ÷ the AI labour multiplier `m` on experiments. */
const suiteWant = (t: EvalTask, m: number) => Math.min(EVAL_DEPTHS[t.depth].staff / TEAM_SIZE.re, (1 - t.progress) * t.reTW * 7) / m;

/** Human research-engineer team-equivalents the lab's own suites can use today (each up to its depth's staff, no more
 *  than its remaining work), given the AI labour multiplier `m` on experiments. */
export function evalReDemand(s: GameStateV2, m: number): number {
  let d = 0;
  for (const t of evalsOf(s)) {
    if (t.by !== 'self' || t.progress >= 1) continue;
    d += suiteWant(t, m);
  }
  return d;
}

/** A finished build item of kind 'eval' (departments/build.ts). */
export function evalEngDone(s: GameStateV2, ref: string, tw: number) {
  const t = evalsOf(s).find((x) => x.id === ref);
  if (!t) return;
  delete t.engId;
  spentOf(s).engTW += tw;
}

/** One day of eval work (research system, after the research-engineer allocation): the lab's suites share `reHuman`
 *  team-equivalents (× m), external suites use their own staff; compute comes from `poolH100e` (the experiment pool's
 *  H100e-days today). Finished suites run. Returns the H100e-days used (taken from the projects' compute). */
export function evalsDay(s: GameStateV2, ctx: SystemCtx, reHuman: number, m: number, poolH100e: number): number {
  let left = reHuman;
  let pool = Math.max(0, poolH100e);
  let used = 0;
  const spent = spentOf(s);
  for (const t of ordered(s)) {
    const v = versionById(s, t.versionId);
    if (!v || v.status === 'retired' || v.status === 'rolledBack') { dropEval(s, t); continue; }
    if (t.progress < 1) {
      let dp: number;
      if (t.by === 'self') {
        const want = suiteWant(t, m);
        const h = Math.min(left, want);
        left -= h;
        dp = t.reTW > 0 ? (h * m) / 7 / t.reTW : 1;
      } else {
        dp = EXT_EVAL_STAFF / TEAM_SIZE.re / 7 / Math.max(1e-9, evalCost(s, v, t.depth).reTW);
      }
      dp = Math.min(dp, 1 - t.progress);
      if (t.h100eDays > 0) dp = Math.min(dp, pool / t.h100eDays);
      pool -= dp * t.h100eDays;
      used += dp * t.h100eDays;
      t.progress = t.progress + dp >= 1 - 1e-9 ? 1 : t.progress + dp;
      spent.reTW += dp * t.reTW;
      spent.h100eDays += dp * t.h100eDays;
    }
    if (t.progress >= 1 && !t.engId) finishEval(s, ctx, t, v);
  }
  return used;
}

/** All work done: run the suite; a release suite lets the version out of evaluation. */
function finishEval(s: GameStateV2, ctx: SystemCtx, t: EvalTask, v: ModelVersion) {
  dropEval(s, t);
  runEvalSuite(s, ctx, v.id, t.by, t.depth);
  spentOf(s).suites++;
  if (t.why === 'release' && v.status === 'evaluating') v.status = 'ready';
  else if (t.why === 'order') ctx.log('research', `${EVAL_DEPTHS[t.depth].label} eval suite on ${v.name} finished${t.by === 'self' ? '' : ' (external evaluators)'}.`, 1, v.id);
}

/** Release gate (runs system, daily): each version in evaluation has its release suite queued; with no gate it is ready
 *  at once (auto-evaluate then gives it a basic suite that blocks nothing). */
export function releaseEvals(s: GameStateV2) {
  const depth = gateDepth(s.player.safety.evalGate);
  for (const v of s.player.models.versions) {
    if (v.status !== 'evaluating') continue;
    if (!depth) {
      v.status = 'ready';
      const open = openEval(s, v.id);
      if (open?.why === 'release') open.why = 'policy';
      if (!open && s.player.policies.autoEvaluate && v.evals.suiteDay === undefined) queueEval(s, v, 'basic', 'self', 'policy');
      continue;
    }
    const open = openEval(s, v.id);
    if (!open || open.why !== 'release') queueEval(s, v, depth, 'self', 'release');
  }
}

/** Why the standing policy would re-run a version's suite today, or undefined: never measured, changed in place since
 *  its last suite by a recipe worth ≥ REEVAL_DG OOM (the stream; a known quantity, model v3 F6 — the true level was
 *  read before), or REEVAL_DAYS old. */
export function reevalReason(s: GameStateV2, v: ModelVersion): 'never' | 'changed' | 'cadence' | undefined {
  if (v.evals.suiteDay === undefined) return 'never';
  if (v.evals.recipeAt !== undefined && inPlaceRecipe(s, v) - v.evals.recipeAt >= REEVAL_DG) return 'changed';
  if (s.time.day - v.evals.suiteDay >= REEVAL_DAYS) return 'cadence';
  return undefined;
}

/** The models the standing policy keeps measured: every internal use's model and the continual-learning stream. */
export function policyModels(s: GameStateV2): ModelVersion[] {
  const ids = new Set<string>();
  for (const u of AGENT_USES) {
    const v = agentVersion(s, u);
    if (v) ids.add(v.id);
  }
  if (s.player.models.stream) ids.add(s.player.models.stream.versionId);
  return [...ids].map((id) => versionById(s, id)).filter((v): v is ModelVersion => !!v);
}

/** Auto-evaluate (policy, R7; replaces v2's 30-day re-run): queue a suite at the policy depth on a policy model that
 *  changed in place or is due on the cadence. */
export function autoEvaluate(s: GameStateV2) {
  if (!s.player.policies.autoEvaluate) return;
  for (const v of policyModels(s)) {
    if (v.status === 'evaluating' || v.status === 'retired' || v.status === 'rolledBack' || openEval(s, v.id)) continue;
    if (reevalReason(s, v)) queueEval(s, v, policyDepth(s), 'self', 'policy');
  }
}

/** Days a new suite of `depth` would take at today's rates (readout: the Blueprint's ready date, the gate's preview):
 *  its research-engineer work at what the 'evals' need could give it (up to the depth's staff in effective
 *  team-equivalents: at full staffing basic 7, full 14, deep ≈ 21 days). */
export function evalDaysEstimate(s: GameStateV2, depth: EvalDepth): number {
  const D = EVAL_DEPTHS[depth];
  const m = Math.max(1, workContext(s).slots.EXP.m);
  const max = D.staff / TEAM_SIZE.re / m;
  const d = reDemand(s, m);
  const cap = capReCapacity(s);
  const a = s.player.research.re;
  const extra = allocate(cap, a, { ...d, evals: d.evals + max }).evals - allocate(cap, a, d).evals;
  const h = Math.min(max, Math.max(0, extra));
  return h > 0 ? Math.max(1, Math.ceil((D.staffWeeks / TEAM_SIZE.re) / ((h * m) / 7) - 1e-9)) : Infinity;
}
/** Days the eval gate adds to a release today (0 without a gate; readout, at most a year when no research engineer is
 *  free for evals). */
export const evalDaysFor = (s: GameStateV2, gate: SafetyDept['evalGate'] = s.player.safety.evalGate): number => {
  const d = gateDepth(gate);
  return d ? Math.min(365, evalDaysEstimate(s, d)) : 0;
};

export interface EvalTaskView {
  id: string; versionId: string; name: string; depth: EvalDepth; by: Evaluator; why: EvalTask['why'];
  progress: number; reTW: number; engTW: number; h100eDays: number;
  /** What it waits for: research engineers, compute or the engineers' harness work (undefined = advancing). */
  waiting?: 'engineers' | 'researchEngineers' | 'compute';
  /** Which part sets the ETA (D8): the research engineers' work, the engineers' harness work or the compute. */
  binds: 'engineers' | 'researchEngineers' | 'compute';
  /** Days to finish each part at today's rates (Infinity = not advancing). */
  reDays: number; engDays: number; computeDays: number;
  /** Research-engineer team-equivalents on it today (human; the lab's own suites) and the most it can use. */
  reNow: number; reMax: number;
  etaDays: number;
}
/** The eval queue for readouts (D8): each suite's work, progress, what it waits on and an ETA at today's rates. The
 *  research engineers on evals today (the allocation's 'evals' need) and the experiments pool's compute are shared in
 *  queue order, as evalsDay does. */
export function evalQueueView(s: GameStateV2): EvalTaskView[] {
  const m = Math.max(1, workContext(s).slots.EXP.m);
  // Today's allocation of the evaluations need (with the suites queued now; research.last is yesterday's).
  const got = reAllocation(s).re.evals;
  const etas = buildEtas(s).etas;
  let share = got;
  let pool = Math.max(0, expPoolH100e(s));
  return ordered(s).map((t) => {
    const v = versionById(s, t.versionId);
    const want = t.by === 'self' ? suiteWant(t, m) : 0;
    const h = t.by === 'self' ? Math.min(share, want) : 0;
    share -= h;
    const reTW = t.by === 'self' ? t.reTW : evalCost(s, v ?? { baseId: '', serveCost: 1, params: 0 }, t.depth).reTW;
    const rate = t.by === 'self' ? (h * m) / 7 : EXT_EVAL_STAFF / TEAM_SIZE.re / 7;
    const left = 1 - t.progress;
    const rem = left * reTW;
    const reDays = rem <= 1e-9 ? 0 : rate > 0 ? Math.ceil(rem / rate - 1e-9) : Infinity;
    // Compute: the share done per day is capped by what the pool still holds after the suites ahead of it.
    const dpRe = left <= 1e-9 ? 0 : reTW > 0 ? Math.min(left, rate / reTW) : left;
    const dpC = t.h100eDays > 0 ? Math.min(dpRe, pool / t.h100eDays) : dpRe;
    pool = Math.max(0, pool - dpC * t.h100eDays);
    const computeShort = left > 1e-9 && rate > 0 && dpC < dpRe - 1e-12;
    const computeDays = left <= 1e-9 ? 0 : !computeShort ? reDays : dpC > 0 ? Math.ceil(left / dpC - 1e-9) : Infinity;
    const engDays = t.engId ? (etas.get(t.engId) ?? Infinity) : 0;
    const waiting = left > 1e-9 && rate <= 0 ? 'researchEngineers' : computeShort && dpC <= 0 ? 'compute' : left <= 1e-9 && t.engId ? 'engineers' : undefined;
    const binds = engDays > 0 && engDays >= Math.max(reDays, computeDays) ? 'engineers' : computeShort ? 'compute' : 'researchEngineers';
    return {
      id: t.id, versionId: t.versionId, name: v?.name ?? t.versionId, depth: t.depth, by: t.by, why: t.why, progress: t.progress,
      reTW: t.reTW, engTW: t.engTW, h100eDays: t.h100eDays, ...(waiting ? { waiting } : {}), binds, reDays, engDays, computeDays,
      reNow: h, reMax: t.by === 'self' ? EVAL_DEPTHS[t.depth].staff / TEAM_SIZE.re / m : 0, etaDays: Math.max(reDays, computeDays, engDays),
    };
  });
}

/** One depth's row of the order preview (D8): the suite's work on `v`, its days at today's rates, the precision it gives
 *  (the measured level's band after one such suite alone, today's band on `v` and after this suite) and the own
 *  benchmark noise and elicitation shift. Output only. */
export interface EvalDepthRow {
  depth: EvalDepth; label: string; rollouts: number; cost: EvalCost; days: number;
  bandOne: number; bandNow: number; bandAfter: number;
  benchSd: number; elic: number;
}
export function evalDepthView(s: GameStateV2, v: ModelVersion): EvalDepthRow[] {
  const n = v.evals.nEff ?? v.evals.nSuites ?? 0;
  return EVAL_DEPTH_IDS.map((depth) => {
    const D = EVAL_DEPTHS[depth];
    const w = D.rollouts / FULL_ROLLOUTS;
    return {
      depth, label: D.label, rollouts: D.rollouts, cost: evalCost(s, v, depth), days: evalDaysEstimate(s, depth),
      bandOne: MEASURE_SD / Math.sqrt(w), bandNow: measuredSd(v), bandAfter: MEASURE_SD / Math.sqrt(n + w),
      benchSd: BENCH_NOISE_SD.self / Math.sqrt(w), elic: D.elic,
    };
  });
}

/** Measurement quality per version (D8 readout; never the true level): measured level and band, the suites behind it
 *  (count and full-suite equivalents), the last suite's depth and day, whether the standing policy keeps it measured
 *  (with the cadence's next re-run day) and its open suites. */
export interface EvalMeasureRow {
  versionId: string; name: string; status: ModelVersion['status']; measuredL?: number; sd: number; nSuites: number; nEff: number;
  depth?: EvalDepth; suiteDay?: number; policy: boolean; nextDay?: number; open: { id: string; by: Evaluator; why: EvalTask['why'] }[];
}
export function evalMeasureView(s: GameStateV2): EvalMeasureRow[] {
  const pol = new Set(policyModels(s).map((v) => v.id));
  const auto = !!s.player.policies.autoEvaluate;
  return s.player.models.versions.filter((v) => v.status !== 'retired' && v.status !== 'rolledBack').map((v) => {
    const isPol = auto && pol.has(v.id);
    return {
      versionId: v.id, name: v.name, status: v.status, ...(v.evals.measuredL !== undefined ? { measuredL: v.evals.measuredL } : {}), sd: measuredSd(v),
      nSuites: v.evals.nSuites ?? 0, nEff: v.evals.nEff ?? v.evals.nSuites ?? 0, ...(v.evals.depth ? { depth: v.evals.depth } : {}),
      ...(v.evals.suiteDay !== undefined ? { suiteDay: v.evals.suiteDay } : {}), policy: isPol,
      ...(isPol && v.evals.suiteDay !== undefined ? { nextDay: v.evals.suiteDay + REEVAL_DAYS } : {}),
      open: evalsOf(s).filter((t) => t.versionId === v.id).map((t) => ({ id: t.id, by: t.by, why: t.why })),
    };
  });
}

/** Cost of the standing policy for readouts (D8): one suite at the policy depth on the internal model, the work spent so
 *  far, and today's research engineers on evals (team-equivalents) of the capacity. */
export function evalPolicyView(s: GameStateV2): { depth: EvalDepth; perSuite?: EvalCost; spent: GameStateV2['player']['models']['evalSpent']; reToday: number; reCap: number; reevalDG: number; reevalDays: number } {
  const depth = policyDepth(s);
  const v = policyModels(s)[0];
  return {
    depth, ...(v ? { perSuite: evalCost(s, v, depth) } : {}), spent: { ...spentOf(s) },
    reToday: s.player.research.last?.re.evals ?? 0, reCap: capReCapacity(s), reevalDG: REEVAL_DG, reevalDays: REEVAL_DAYS,
  };
}
