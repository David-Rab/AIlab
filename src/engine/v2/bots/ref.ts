// RefBot / passive: replays the AI 2027 reference race (§7.1 T1, §7.4). Harness owner: WS4; the reference policy
// below is provided by WS1 for calibration (T1) and only uses EngineApi actions.
//
// Reference cadence (§7.1): compute tracks refTotal (WS3 orders; tests stub it), split = shareRef(t), cap hiring
// tracks H_ref, a 1F base every 9 months, a post-train every 6 weeks (≤ 2 in flight), continual learning once P08
// works, P05/P07/P08/P13/P17/P19 researched and adopted (never P23), latent bases after P17, a distilled mini every
// ~6 months deployed to consumer/api while the frontier stays internal, eval refresh every 30 days.
import { REFERENCE_BASE } from '../../../data/v2/runDesign';
import { decimalYear } from '../core/time';
import { shareRefAt, SPLIT_KEYS } from '../departments/split';
import { hRef } from '../production/knots';
import type { BotPolicy, EngineApi, GameStateV2, ModelVersion } from '../types';

/** Paradigms RefBot researches and adopts (§3.3.3 "RefBot paradigm policy"). */
export const REF_PARADIGMS = ['P05', 'P07', 'P08', 'P13', 'P17', 'P19'];
const BASE_EVERY = 270;
const POST_EVERY = 42;
const MINI_EVERY = 182;
const EVAL_EVERY = 30;

const flag = (s: GameStateV2, k: string, d = -1e9) => Number(s.flags[`ref:${k}`] ?? d);
const setFlag = (s: GameStateV2, k: string, v: number) => {
  s.flags[`ref:${k}`] = v;
};
const tryAct = (s: GameStateV2, api: EngineApi, id: string, p: Record<string, number | string | boolean> = {}) => {
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

export const refBot: BotPolicy = {
  id: 'ref',
  act(s, api) {
    const p = s.player;
    if (p.status !== 'active') return;
    const day = s.time.day;
    const yr = decimalYear(s);
    const m = p.models;

    // Departments: reference split (monthly) and cap hiring tracking H_ref six weeks ahead.
    if (day % 30 === 0) {
      const ref = shareRefAt(yr);
      const diff = SPLIT_KEYS.some((k) => Math.abs(ref[k] - p.split[k]) > 1e-3);
      if (diff) tryAct(s, api, 'setSplit', { ...ref });
      const target = Math.round(hRef(yr + 0.12));
      if (target > p.hiring.target.cap) tryAct(s, api, 'hireTarget', { role: 'cap', target });
    }

    // Paradigms: fund open reference projects; adopt successes; retry failures when allowed.
    for (const id of REF_PARADIGMS) {
      const st = p.paradigms[id];
      if (!st) continue;
      if (st.status === 'succeeded') tryAct(s, api, 'adoptParadigm', { id });
      else if (st.status === 'available' || (st.status === 'failed' && (st.retryDay ?? 0) <= day)) tryAct(s, api, 'fundParadigm', { id, fte: 30, expShare: 0.02 });
    }

    // Base runs: a frontier base every 9 months; once neuralese (P17) is adopted the next base is latent and starts
    // at once (AI 2027's Agent-3 is a neuralese model at SC).
    const baseRunning = m.runs.some((r) => r.kind === 'base' && r.status === 'running');
    const lastBase = flag(s, 'lastBase', m.bases[m.bases.length - 1]?.startDay ?? -120);
    const latent = p.paradigms.P17?.status === 'adopted';
    const latentDue = latent && !m.bases.some((b) => b.design.shape === 'latent') && !m.runs.some((r) => r.status === 'running' && r.base?.shape === 'latent');
    if ((!baseRunning && day - lastBase >= BASE_EVERY) || latentDue) {
      if (tryAct(s, api, 'launchBase', { shape: latent ? 'latent' : REFERENCE_BASE.shape, poolShare: 0.6 })) setFlag(s, 'lastBase', day);
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
        const cot = newestBase.design.shape === 'latent' ? 'latent' : 'visible';
        if (tryAct(s, api, 'launchPost', { baseId: newestBase.id, cot, poolShare: 0.5 })) setFlag(s, 'lastPost', day);
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

    // A distilled mini about every 6 months, deployed to consumer and API (frontier stays internal).
    if (iv && day - flag(s, 'lastMini', 0) >= MINI_EVERY && !m.runs.some((r) => r.kind === 'distill' && r.status === 'running')) {
      if (tryAct(s, api, 'launchDistill', { teacherVersionId: iv.id })) setFlag(s, 'lastMini', day);
    }
    const mini = [...m.versions].reverse().find((v) => v.variant === 'mini' && v.status === 'ready');
    if (mini) {
      for (const d of p.deployments) {
        if ((d.channel === 'consumer' || d.channel === 'api') && d.status === 'live' && d.versionId !== mini.id) tryAct(s, api, 'swapDeployment', { deploymentId: d.id, versionId: mini.id });
      }
    }

    // Housekeeping: retire superseded versions (keep the newest 4 full + anything in use).
    if (day % 30 === 15) {
      const full = m.versions.filter((v) => v.status !== 'retired' && v.variant === 'full').sort((a, b) => b.day - a.day);
      for (const v of full.slice(4)) tryAct(s, api, 'retireVersion', { versionId: v.id });
      const minis = m.versions.filter((v) => v.status !== 'retired' && v.variant === 'mini').sort((a, b) => b.day - a.day);
      for (const v of minis.slice(2)) tryAct(s, api, 'retireVersion', { versionId: v.id });
    }
  },
  decide() {
    return 0; // E17 Continue / E20 Accept / E23 Reject map to choice tags once WS4's catalog lands
  },
};
