// RefBot / passive: replays the AI 2027 reference race (§7.1 T1, §7.4). Harness owner: WS4; the reference policy
// below is provided by WS1 for calibration (T1) and only uses EngineApi actions.
//
// Reference cadence (§7.1): compute tracks refTotal (WS3's finance autopilot buys it; the T1 calibration stubs it),
// split = shareRef(t), cap hiring tracks H_ref, a 1F base every 9 months, a post-train every 6 weeks (≤ 2 in flight),
// continual learning once P08 works, P05/P07/P08/P13/P17/P19 researched and adopted (never P23), latent bases after
// P17, a distilled mini every ~6 months (sooner on a new base or a 0.7-level gap) deployed to consumer/api while the
// frontier stays internal, serving re-split by demand weekly, eval refresh every 30 days.
//
// `refPlay(s, api, opts)` is the model/department half of that policy, parameterised so the other bots (race, safe,
// mixed, capex2x) reuse the cadence with their own design choices; with default options it is exactly RefBot's.
// `refBot` = refPlay + WS3's reference finance autopilot (REF_AUTOPILOT).
import { REFERENCE_BASE } from '../../../data/v2/runDesign';
import { EVENT_BY_ID } from '../core/registry';
import { decimalYear } from '../core/time';
import { shareRefAt, TOP_KEYS, topOf, withFixed } from '../departments/split';
import { financeAutopilot, financeDecide, REF_AUTOPILOT } from '../finance/plan';
import { hRef } from '../production/knots';
import type { BotPolicy, ComputeSplit, EngineApi, GameStateV2, ModelVersion, PendingDecision } from '../types';

type Params = Record<string, number | string | boolean>;

/** Paradigms RefBot researches and adopts (§3.3.3 "RefBot paradigm policy"). */
export const REF_PARADIGMS = ['P05', 'P07', 'P08', 'P13', 'P17', 'P19'];
const BASE_EVERY = 270;
const POST_EVERY = 42;
const MINI_EVERY = 182;
/** …or sooner (≥ 45 d apart) once the internal model measures this many levels above what the products serve. */
const MINI_GAP_L = 0.7;
const EVAL_EVERY = 30;
const PRODUCT_CHANNELS: string[] = ['consumer', 'api', 'enterprise'];
/** Passive/RefBot safety programme (§7.4): ~3% safety compute (shareRef), AG02, AG07, AG08 and AG18 at Seed. */
const REF_AGENDAS = ['AG02', 'AG07', 'AG08', 'AG18'];

/** Options of the reference play (all optional; {} = RefBot). */
export interface RefPlayOpts {
  /** Fixed compute share for safety (the rest follows shareRef(t)); undefined = reference. */
  safetyShare?: (s: GameStateV2) => number | undefined;
  /** Target share of staff in safety (hiring), e.g. 0.25 for the safe bot. */
  safStaffShare?: number;
  /** Extra launchBase params (scale, data, quality, hazard, safetyPretrain, licensedShare). */
  base?: Params;
  /** launchPost params (pref, rlFocus, rlIntensity, cot, safety, inoculation). cot 'faithful' falls back to 'visible'
   *  until P23 is adopted; a latent base always forces latent CoT. */
  post?: (s: GameStateV2) => Params;
  /** Paradigms researched and adopted (default REF_PARADIGMS); a function lets a bot decide over time. */
  paradigms?: (s: GameStateV2) => string[];
  /** Release policy: 'mini' (distilled minis to consumer/api; frontier internal) or 'frontier' (newest full version
   *  to consumer/api). */
  release?: 'mini' | 'frontier';
}

const flag = (s: GameStateV2, k: string, d = -1e9) => Number(s.flags[`ref:${k}`] ?? d);
const setFlag = (s: GameStateV2, k: string, v: number) => {
  s.flags[`ref:${k}`] = v;
};
const tryAct = (s: GameStateV2, api: EngineApi, id: string, p: Params = {}) => {
  try {
    api.act(s, id, p);
    return true;
  } catch {
    return false;
  }
};

function newestFull(s: GameStateV2): ModelVersion | undefined {
  let best: ModelVersion | undefined;
  for (const v of s.player.models.versions) {
    if (v.variant !== 'full' || v.status === 'retired' || v.status === 'rolledBack') continue;
    if (!best || v.day > best.day || (v.day === best.day && v.id > best.id)) best = v;
  }
  return best;
}

/** The reference model/department policy (§7.1), parameterised by `o` (see RefPlayOpts). */
export function refPlay(s: GameStateV2, api: EngineApi, o: RefPlayOpts = {}): void {
  const p = s.player;
  if (p.status !== 'active') return;
  const day = s.time.day;
  const yr = decimalYear(s);
  const m = p.models;

  // Departments: reference split (monthly) and cap hiring tracking H_ref six weeks ahead.
  if (day % 30 === 0) {
    const safShare = o.safetyShare?.(s);
    const ref: ComputeSplit = safShare === undefined ? shareRefAt(yr) : withFixed(shareRefAt(yr), { safety: safShare });
    const now = topOf(p.split);
    const want = topOf(ref);
    const diff = TOP_KEYS.some((k) => Math.abs(want[k] - now[k]) > 1e-3) || Math.abs(ref.synthetic - p.split.synthetic) > 1e-3;
    if (diff) tryAct(s, api, 'setSplit', { ...ref });
    const target = Math.round(hRef(yr + 0.12));
    if (target > p.hiring.target.cap) tryAct(s, api, 'hireTarget', { role: 'cap', target });
    if (o.safStaffShare !== undefined) {
      const saf = Math.round((o.safStaffShare / (1 - o.safStaffShare)) * Math.max(target, p.staff.cap));
      if (saf > p.hiring.target.saf) tryAct(s, api, 'hireTarget', { role: 'saf', target: saf });
    }
  }

  // Paradigms: fund open reference projects; adopt successes; retry failures when allowed.
  const paradigms = o.paradigms?.(s) ?? REF_PARADIGMS;
  for (const id of paradigms) {
    const st = p.paradigms[id];
    if (!st) continue;
    if (st.status === 'succeeded') tryAct(s, api, 'adoptParadigm', { id });
    else if (st.status === 'available' || (st.status === 'failed' && (st.retryDay ?? 0) <= day)) tryAct(s, api, 'fundParadigm', { id, fte: 30, expShare: 0.02 });
  }

  // Base runs: a frontier base every 9 months; once neuralese (P17) is adopted the next base is latent and starts
  // at once (AI 2027's Agent-3 is a neuralese model at SC).
  const baseRunning = m.runs.some((r) => r.kind === 'base' && r.status === 'running');
  const lastBase = flag(s, 'lastBase', m.bases[m.bases.length - 1]?.startDay ?? -120);
  const latent = p.paradigms.P17?.status === 'adopted' && paradigms.includes('P17');
  const latentDue = latent && !m.bases.some((b) => b.design.shape === 'latent') && !m.runs.some((r) => r.status === 'running' && r.base?.shape === 'latent');
  if ((!baseRunning && day - lastBase >= BASE_EVERY) || latentDue) {
    // A lab whose training pool cannot deliver its base scale in time (BASE_MAX_DAYS) gives it most of the pool, then
    // steps down a scale (stretch → frontier → compact), rather than never training a new base (M4).
    const bp = { ...(o.base ?? {}), shape: latent ? 'latent' : REFERENCE_BASE.shape };
    const scales = [...new Set([String(o.base?.scale ?? REFERENCE_BASE.scale), 'frontier', 'compact'])];
    if (scales.some((scale) => tryAct(s, api, 'launchBase', { ...bp, scale, poolShare: 0.6 }) || tryAct(s, api, 'launchBase', { ...bp, scale, poolShare: 0.95 }))) setFlag(s, 'lastBase', day);
  }

  // Post-training every 6 weeks on the newest base (≤ 2 in flight). Skipped once the stream is running on the
  // newest base (the stream already carries it); a new base still gets its first post-train.
  const newestBase = m.bases[m.bases.length - 1];
  const postsRunning = m.runs.filter((r) => r.kind === 'post' && r.status === 'running').length;
  const streamOnNewest = m.stream && m.versions.find((v) => v.id === m.stream?.versionId)?.baseId === newestBase?.id;
  const hasVersionOnNewest = m.versions.some((v) => v.baseId === newestBase?.id && v.variant === 'full');
  if (newestBase && postsRunning < 2 && day - flag(s, 'lastPost') >= POST_EVERY && (!streamOnNewest || !hasVersionOnNewest)) {
    const pending = m.runs.some((r) => r.kind === 'post' && r.status === 'running' && r.baseId === newestBase.id);
    if (!(streamOnNewest && pending)) {
      const design = o.post?.(s) ?? {};
      let cot = String(design.cot ?? 'visible');
      if (cot === 'faithful' && p.paradigms.P23?.status !== 'adopted') cot = 'visible';
      if (newestBase.design.shape === 'latent') cot = 'latent';
      else if (cot === 'latent') cot = 'visible';
      if (tryAct(s, api, 'launchPost', { ...design, baseId: newestBase.id, cot, poolShare: 0.5 })) setFlag(s, 'lastPost', day);
    }
  }

  // Internal agents: the newest full version. With continual learning (P08) the stream runs on it and moves to the
  // first version on each newer base (carrying its know-how); other versions on the stream's base are ignored.
  const nv = newestFull(s);
  const sv = m.stream ? m.versions.find((v) => v.id === m.stream?.versionId) : undefined;
  const baseIdx = (v?: ModelVersion) => (v ? m.bases.findIndex((b) => b.id === v.baseId) : -1);
  if (p.paradigms.P08?.status === 'adopted' && nv) {
    if (!sv || baseIdx(nv) > baseIdx(sv)) tryAct(s, api, 'startStream', { versionId: nv.id });
    const cur = m.stream?.versionId;
    if (cur && m.internalAgent !== cur) tryAct(s, api, 'setInternalAgent', { versionId: cur });
  } else if (nv && m.internalAgent !== nv.id) tryAct(s, api, 'setInternalAgent', { versionId: nv.id });

  // Evals: refresh the internal version's suite every 30 days (streams go stale).
  const iv = m.versions.find((v) => v.id === m.internalAgent);
  if (iv && iv.status !== 'evaluating' && day - (iv.evals.suiteDay ?? -1e9) >= EVAL_EVERY) tryAct(s, api, 'runEvals', { versionId: iv.id });

  // A distilled mini about every 6 months, deployed to consumer and API (frontier stays internal), or the newest
  // full version for bots that release their frontier.
  // Also a mini from the first version on each new base (AI 2027's Agent-1-mini): a mini of an old-generation teacher
  // (−0.3 pm) does not beat the model already on sale, so a fixed 6-month clock alone could leave the launch model
  // public for 15 months.
  const newGen = !!iv && baseIdx(iv) > flag(s, 'miniBase', 0);
  let servedL = 0;
  for (const d of p.deployments) if (d.status === 'live' && PRODUCT_CHANNELS.includes(d.channel)) servedL = Math.max(servedL, m.versions.find((v) => v.id === d.versionId)?.evals.measuredL ?? 0);
  const stale = !!iv && (iv.evals.measuredL ?? 0) - servedL >= MINI_GAP_L && day - flag(s, 'lastMini', 0) >= 45;
  if (iv && (newGen || stale || day - flag(s, 'lastMini', 0) >= MINI_EVERY) && !m.runs.some((r) => r.kind === 'distill' && r.status === 'running')) {
    if (tryAct(s, api, 'launchDistill', { teacherVersionId: iv.id })) {
      setFlag(s, 'lastMini', day);
      setFlag(s, 'miniBase', Math.max(flag(s, 'miniBase', 0), baseIdx(iv)));
    }
  }
  // Product channels (consumer, API, enterprise) move to the new public model only if it measures better than what
  // they serve (a fresh mini can trail the previous release).
  const mini = [...m.versions].reverse().find((v) => v.variant === 'mini' && v.status === 'ready');
  const pub = o.release === 'frontier' ? [...m.versions].reverse().find((v) => v.variant === 'full' && (v.status === 'ready' || v.status === 'deployed')) ?? mini : mini;
  if (pub) {
    const mL = (id: string) => m.versions.find((v) => v.id === id)?.evals.measuredL ?? 0;
    const pubL = pub.evals.measuredL ?? 0;
    // Enterprise takes full versions only: the best one that does not exceed the public release by more than 0.25 L
    // (the frontier stays internal).
    const ent = [...m.versions].filter((v) => v.variant === 'full' && (v.status === 'ready' || v.status === 'deployed') && (v.evals.measuredL ?? 99) <= pubL + 0.25)
      .sort((x, y) => (y.evals.measuredL ?? 0) - (x.evals.measuredL ?? 0))[0];
    for (const d of p.deployments) {
      if (!PRODUCT_CHANNELS.includes(d.channel) || d.status !== 'live') continue;
      const want = d.channel === 'enterprise' ? (o.release === 'frontier' && pub.variant === 'full' ? pub : ent ?? pub) : pub;
      if (want && want.id !== d.versionId && (want.evals.measuredL ?? 0) > mL(d.versionId)) tryAct(s, api, 'swapDeployment', { deploymentId: d.id, versionId: want.id });
    }
  }

  // Product management: re-split the serving pool by demand every week (capacity-bound channels get more).
  if (day % 7 === 3) tryAct(s, api, 'setServing', {});

  // Housekeeping: retire superseded versions (keep the newest 4 full + anything in use).
  if (day % 30 === 15) {
    const full = m.versions.filter((v) => v.status !== 'retired' && v.variant === 'full').sort((a, b) => b.day - a.day);
    for (const v of full.slice(4)) tryAct(s, api, 'retireVersion', { versionId: v.id });
    const minis = m.versions.filter((v) => v.status !== 'retired' && v.variant === 'mini').sort((a, b) => b.day - a.day);
    for (const v of minis.slice(2)) tryAct(s, api, 'retireVersion', { versionId: v.id });
  }
}

/** Index of a choice by label, else the event's default choice. */
export function choiceByLabel(d: PendingDecision, label: string): number {
  const def = EVENT_BY_ID.get(d.id);
  const i = def?.choices.findIndex((c) => c.label === label) ?? -1;
  return i >= 0 ? i : (def?.defaultChoice ?? 0);
}

/** RefBot's decisions (§7.4): E17 Continue, E20 Accept, E23 Reject; finance decisions as a competent CEO
 *  (financeDecide: E02 restructure, E26, E37); everything else takes the event's default. */
export function refDecide(s: GameStateV2, d: PendingDecision): number {
  const fin = financeDecide(s, d, REF_AUTOPILOT);
  if (fin !== undefined) return fin;
  if (d.id === 'E17') return choiceByLabel(d, 'Continue');
  if (d.id === 'E20') return choiceByLabel(d, 'Accept');
  if (d.id === 'E23') return choiceByLabel(d, 'Reject');
  return EVENT_BY_ID.get(d.id)?.defaultChoice ?? 0;
}

/** RefBot / passive: reference model play + WS3's reference finance autopilot (one cloud partner, SPVs as needed). */
export const refBot: BotPolicy = {
  id: 'ref',
  act(s, api) {
    if (s.time.day === 0) for (const a of REF_AGENDAS) tryAct(s, api, 'safety.fund', { agenda: a, level: 'seed' });
    refPlay(s, api);
    financeAutopilot(s, REF_AUTOPILOT);
  },
  decide: refDecide,
};
