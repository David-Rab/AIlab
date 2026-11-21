// RefBot / passive: replays the AI 2027 reference race (§7.1 T1, §7.4). Harness owner: WS4; the reference policy
// below is provided by WS1 for calibration (T1) and only uses EngineApi actions.
//
// Reference cadence (§7.1): compute tracks refTotal (WS3's finance autopilot buys it; the T1 calibration stubs it),
// split = shareRef(t), cap hiring tracks H_ref, a base every 9 months sized to train in ~4 months on 60% of its pool
// (v3 V1: active parameters at REF_TPP tokens per parameter, 400 since A6b: a lab that serves its models
// overtrains them, DeepSeek-V3 ≈ 400 tokens per active parameter, research/20 A1; v2 trained 1 × the frontier run F(t), which took the same
// time on the reference pool), a post-train every 6 weeks (≤ 2 in flight),
// continual learning once P08 works, P05/P07/P08/P13/P17/P19 researched on the tree (REF_TREE; never P23), latent bases after
// P17. Releases (F5, 'compete'): Chat, API and Enterprise serve the cheapest cleared version that leads the rivals'
// public models by RELEASE_LEAD (AI 2027's Agent-1 release in answer to competitors), with a public mini distilled to
// hold that lead and the API's cheap tier (A5); the frontier stays internal whenever a smaller model keeps the lead.
// R6: serving is the Auto policy (no weekly re-split), model swaps are live product updates, and the auto-evaluate
// policy refreshes the internal model's evals.
//
// `refPlay(s, api, opts)` is the model/department half of that policy, parameterised so the other bots (race, safe,
// mixed, capex2x) reuse the cadence with their own design choices; with default options it is exactly RefBot's.
// `refBot` = refPlay + WS3's reference finance autopilot (REF_AUTOPILOT).
import { DISTILL, REFERENCE_BASE, REF_TPP, STREAM_POOL_SHARE } from '../../../data/v2/runDesign';
import { paramsForFlop, rlCeiling } from '../models/effective';
import { latestBaseFlop, refRlGain, rlCeilNow, rlMidNow } from '../models/stacks';
import { takesTeams } from '../models/research';
import { POOL_SHARE_RANGE, paramsOfVersion, runFlopPerShareDay } from '../models/runs';
import { sectorFit, studentParamsFor, studentToHold } from '../worldfx/serving';
import { flopPerToken } from '../departments/workfit';
import { deployGate } from '../models/deployments';
import { EVENT_BY_ID } from '../core/registry';
import { decimalYear } from '../core/time';
import { shareRefAt, TOP_KEYS, topOf, withFixed } from '../departments/split';
import { financeAutopilot, REF_AUTOPILOT } from '../finance/plan';
import { runwayOf } from '../finance/runway';
import { hRef } from '../production/knots';
import { DEFAULT_LINES } from '../../../data/v2/research';
import { REF_ROLE_SHARE, SAF_ROLE_SHARE, TEAM_SIZE } from '../../../data/v2/teams';
import type { BotPolicy, ComputeSplit, EngineApi, GameStateV2, ModelVersion, PendingDecision, TeamKey, TrainingRun } from '../types';
import { bestMeasuredL, internalVersion, versionById } from '../models/labs';
import { believedInternalOversight } from '../safety/believedOversight';
import { believedSabotage } from '../safety/covert';
import { safetyAgentVersion } from '../safety/agents';
import { footholdView } from '../safety/footholdDetection';
import { investigationFte, safetyReHeads } from '../safety/investigations';
import { patchFte } from '../safety/responses';
import { measuredDomain } from '../models/paradigms';
import { levelOfV2 } from '../world/calibration';
import { gV0, levelOfG, playerStart } from '../models/capability';
import { CAL_SHIFT } from '../../../data/v2/calibration';
import { B_G_PER_Y } from '../../../data/v2/runDesign';
import type { TimelineWorld } from '../types';
import { missingNeeds, nodeKnown, optionLocked } from '../models/tree';
import { TREE_BY_ID, TREE_RETRY_DAYS } from '../../../data/v2/tree';
import { COLUMN_DEPT } from '../../../data/v2/teams';
import { sizedTarget, staffLines, type LinePlan } from './common';

type Params = Record<string, number | string | boolean>;

/** A tree project a bot queues once `when` holds (and its prerequisites are known). */
export interface TreeGoal { id: string; when?: (s: GameStateV2) => boolean }
/** RefBot's research pacing gates on the display scale (model v3 V3b, F3): the display level λ(G) moved onto the work-type
 *  reference points, but the gates were set on v2's levels ("when the old gate would have opened"), so each gate x (a
 *  v2 level) opens at the display level of the effective compute where v2's level map reached x: v2's progress
 *  coordinate q placed on G from the start model V0 at V1's slope B (G = G(V0) + (q − q(V0))·B; a conversion of the
 *  gate points only, no lab's capability is in that coordinate), so the bot starts each project at the same capability
 *  as before. Memoised per world. */
const gateMemo = new WeakMap<TimelineWorld, Map<number, number>>();
export function gateLevel(s: GameStateV2, x: number): number {
  const w = s.hidden.timeline;
  let m = gateMemo.get(w);
  if (!m) gateMemo.set(w, (m = new Map()));
  const hit = m.get(x);
  if (hit !== undefined) return hit;
  const shift = CAL_SHIFT[s.setup.world];
  let lo = w.p0 - 10;
  let hi = w.p0 + 80;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (levelOfV2(w, mid, shift) >= x) hi = mid;
    else lo = mid;
  }
  const L = levelOfG(w, gV0(w) + (hi - playerStart(w).target) * B_G_PER_Y);
  m.set(x, L);
  return L;
}
const atGate = (s: GameStateV2, L: number, x: number) => L >= gateLevel(s, x) - 1e-9;
const Lg = (s: GameStateV2, x: number) => atGate(s, bestMeasuredL(s), x);
const RSCH = (s: GameStateV2, x: number) => atGate(s, measuredDomain(s, 'RSCH'), x);
/** RefBot's research (§3.3.3 "RefBot paradigm policy", R4): the engine has no capability gates, so the bot keeps the
 *  old pacing by starting each project when the old gate would have opened (tier 2: measured L ≥ 6.5, tier 3: 8.5;
 *  P08 L ≥ 7; P13 RSCH ≥ 8.5; P17 L ≥ 9.5). RL focus: ML research is P13's prerequisite on the tree. */
export const REF_TREE: TreeGoal[] = [
  { id: 'P07' },
  { id: 'P05' },
  { id: 'P08', when: (s) => Lg(s, 7) },
  { id: 'rl.mlResearch', when: (s) => Lg(s, 6.5) },
  { id: 'P13', when: (s) => Lg(s, 6.5) && RSCH(s, 8.5) },
  { id: 'P17', when: (s) => Lg(s, 9.5) },
  { id: 'P19', when: (s) => Lg(s, 8.5) },
];
/** RefBot's research lines (model v3 V2) and their share of the science teams the ideas leave free [D]: the
 *  pretraining lines carry the pretraining stack (Ho et al. ≈ 3×/yr before SC), the RL lines the RL stack. Recurrent
 *  architectures opens with neuralese recurrence (P17). D10: Inference efficiency is ranked (weight 0.1, DEFAULT_LINES):
 *  the serving stack raises decode utilisation, then cuts FLOP per token (models/stacks.ts serveSplit). */
export const REF_RESEARCH_LINES = DEFAULT_LINES;
/** Teams wanted on each of RefBot's paradigm projects [D]: v2's auto-assign put most of its science teams on its one or
 *  two queued paradigms; the v3 reference lab also runs its lines, so it staffs each paradigm bet with three teams and
 *  gives the lines the rest. (A fixed 70% line share was tried: it fitted the lines more evenly across worlds but moved
 *  the ai2027 takeoff out of tolerance; design/V3-BUILD.md V2 notes.) */
const REF_IDEA_TEAMS = 3;
/** The safe bot's extra research: faithful-CoT architecture, paced like its old gate (tier 3, an AG09 technique). */
export const SAFE_TREE_EXTRA: TreeGoal[] = [
  { id: 'P23', when: (s) => Lg(s, 8.5) && s.player.safety.findings.some((f) => f.agenda === 'AG09' && f.type === 'TECH') },
];
const BASE_EVERY = 270;
/** RefBot's base run length at its requested share (60% of the pool): v2's reference run (1 × F(t) = 91 days of 80% of
 *  the reference training pool) took 121 days at that share. The bot sizes its base (active parameters at REF_TPP, the reference's inference-aware ratio) to
 *  this; the engine has no cap (R5: staleness is shown instead). Follower starts (R9) accept a longer run (their pools
 *  are small) and hire only while runway is at least FOLLOWER_GROW_Q quarters. */
const REF_BASE_DAYS = 121;
const FOLLOWER_MAX_BASE_DAYS = 200;
const FOLLOWER_GROW_Q = 6;
/** RefBot's distilled minis: half the teacher's active parameters [D]: the distillation gap is then 0.47 OOM (≈ v2's
 *  −0.30 y mini; a quarter-size student trails by 0.62 y and misses the 2026 hype, valuation and distress targets). */
const REF_STUDENT = 0.5;
/** A5: RefBot distils a cheap API tier only when it is at most this share of the internal model's size (≥ 2× cheaper than
 *  the half-size public mini) [D]. */
const CHEAP_MAX = 0.25;
const POST_EVERY = 42;
const MINI_EVERY = 182;
/** …or sooner (≥ 45 d apart) once the internal model measures this many levels above what the products serve. */
const MINI_GAP_L = 0.7;
const PRODUCT_CHANNELS: string[] = ['consumer', 'api', 'enterprise'];
/** The public release (where the minis go). Staleness is measured against it, not against Enterprise: Enterprise can
 *  sit on the continual-learning stream (updated in place), which hid how far the public release trailed (R6 fix). */
const PUBLIC_CHANNELS: string[] = ['consumer', 'api'];
/** Passive/RefBot safety programme (§7.4): ~3% safety compute (shareRef) and, since R8, one safety science team on each
 *  of AG18, AG02, AG08 and AG07 (≈ the pre-R8 Seed funding of those four: data/v2/agendas.ts SERIOUS_CAP). It starts
 *  with two teams and hires two more. Each line works the ideas RefBot uses in the pre-R8 catalog order (training-signal
 *  design: honesty, then anti-scheming; applied interp: deception probe, verbalizer; evals: honeypots, auditing agents;
 *  control: resampling, control evals, comms lockdown), then the line's follow-up. */
export const REF_LINES: LinePlan[] = [
  { ag: 'AG18', teams: 1, ideas: ['T-CONFESS', 'T-ANTISCHEME'] },
  { ag: 'AG02', teams: 1, ideas: ['T-DECEPT', 'T-NLA'] },
  { ag: 'AG08', teams: 1, ideas: ['T-HONEY', 'T-AUDIT'] },
  { ag: 'AG07', teams: 1, ideas: ['T-RESAMPLE', 'T-CEVAL', 'T-LOCK'] },
];
const REF_SAFETY_SCI_TEAMS = 4;

/** Options of the reference play (all optional; {} = RefBot). */
export interface RefPlayOpts {
  /** Fixed compute share for safety (the rest follows shareRef(t)); undefined = reference. */
  safetyShare?: (s: GameStateV2) => number | undefined;
  /** Target share of staff in safety (hiring), e.g. 0.25 for the safe bot. */
  safStaffShare?: number;
  /** Extra launchBase params (data, quality, hazard, safetyPretrain) and `days`: the base run's target
   *  length at 60% of the pool (default REF_BASE_DAYS; followers FOLLOWER_MAX_BASE_DAYS). */
  base?: Params;
  /** launchPost params (pref, rlFocus, rlBudget, cot, safety, inoculation). cot 'faithful' falls back to 'visible'
   *  until P23 is adopted; a latent base always forces latent CoT. */
  post?: (s: GameStateV2) => Params;
  /** Tree projects (default REF_TREE); a function lets a bot decide over time. */
  tree?: (s: GameStateV2) => TreeGoal[];
  /** Release policy: 'compete' (default, RefBot; F5: the cheapest cleared version that leads the rivals' public models,
   *  see competeRelease), 'mini' (the newest distilled mini to consumer/api, enterprise the best full version near it;
   *  frontier internal) or 'frontier' (newest full version to consumer/api). */
  release?: 'compete' | 'mini' | 'frontier';
  /** Spare-training policy (R5). Default 'data': the AI 2027 reference lab's research compute is fixed by its
   *  compute-usage table (shareRef), so the training compute RefBot's run cadence leaves unused generates data
   *  instead of raising experiments (data never binds on the reference path, so this is neutral). */
  spareTraining?: 'research' | 'data';
  /** Spare-serving policy (J2 PR1). Default 'headroom': as with spare training, the reference lab's research compute is
   *  its compute-usage table (shareRef), so the serving compute its products do not need stays on them as headroom
   *  (today's behaviour exactly) instead of running research agents. Measured: with 'research' RefBot's spare serving
   *  (up to 4× its agent pool in late 2025) would add an unearned speed-up (design/PROGRESS.md J2). */
  spareServing?: 'research' | 'headroom';
  /** A5: distil a cheap API tier (a student holding the previous public release's level) once per public release.
   *  Default: on with the 'compete' release (RefBot since F5, refitted with it), off otherwise. */
  cheapTier?: boolean;
}

const flag = (s: GameStateV2, k: string, d = -1e9) => Number(s.flags[`ref:${k}`] ?? d);
/** Design options a bot asks for that the tree has not unlocked yet fall back to off (R8: safety ideas such as
 *  inoculation, hazard filtering and safety pretraining are research projects now). */
function known(s: GameStateV2, p: Params): Params {
  const out = { ...p };
  if (out.inoculation === true && optionLocked(s, 'inoculation', true)) out.inoculation = false;
  if (out.hazard === true && optionLocked(s, 'curation', 'hazard')) out.hazard = false;
  if (out.safetyPretrain === true && optionLocked(s, 'curation', 'safetyPretrain')) out.safetyPretrain = false;
  return out;
}
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
  const follower = (s.setup.start ?? 'leader') !== 'leader';
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
    // Whole teams in the reference split (D2): round(share · H_ref(t + 6 wk) / size) per role.
    const H = hRef(yr + 0.12);
    const teamsWanted: [TeamKey, number][] = (['eng', 're', 'sci'] as const).map((r) => [r === 'eng' ? 'eng' : `${r}.cap`, Math.round((REF_ROLE_SHARE[r] * H) / TEAM_SIZE[r])]);
    if (o.safStaffShare !== undefined) {
      const saf = (o.safStaffShare / (1 - o.safStaffShare)) * Math.max(H, p.staff.cap);
      teamsWanted.push(['re.saf', Math.round((SAF_ROLE_SHARE.re * saf) / TEAM_SIZE.re)], ['sci.saf', Math.round((SAF_ROLE_SHARE.sci * saf) / TEAM_SIZE.sci)]);
    }
    // Follower starts (R9) grow toward the reference roster one team per role a month, and only while the money lasts
    // (queued teams count in payroll at once); the leader start is unchanged.
    if (!follower) {
      for (const [key, n] of teamsWanted) if (n > (p.hiring.targets[key] ?? 0)) tryAct(s, api, 'teams.target', { key, n });
    } else if (runwayOf(s).q >= FOLLOWER_GROW_Q) {
      for (const [key, n] of teamsWanted) {
        const cur = p.hiring.targets[key] ?? 0;
        if (n > cur) tryAct(s, api, 'teams.target', { key, n: cur + 1 });
      }
    }
  }

  const spare = o.spareTraining ?? 'data';
  if (p.policies.spareTraining !== spare) tryAct(s, api, 'runs.spareTraining', { use: spare });
  const spareServe = o.spareServing ?? 'headroom';
  if (p.policies.spareServing !== spareServe) tryAct(s, api, 'serving.spare', { use: spareServe });

  // Research (model v3 V2): each goal goes to the top of the priority list once its start condition holds and its
  // prerequisites are known (a failed idea is reopened as speculative after TREE_RETRY_DAYS, v2's retry pacing); the
  // research lines follow, with teams wanted in proportion to REF_RESEARCH_LINES. The assignment places the teams.
  const goals = o.tree?.(s) ?? REF_TREE;
  const queue = p.research.queue;
  for (const g of goals) {
    if (queue.includes(g.id) || nodeKnown(s, g.id) || missingNeeds(s, g.id).length) continue;
    const st = p.tree[g.id];
    if (st?.status === 'failed') {
      if (day - (st.day ?? day) >= TREE_RETRY_DAYS && (!g.when || g.when(s))) tryAct(s, api, 'research.reopen', { id: g.id });
      continue;
    }
    if (st?.cap && st.cap.stage !== 'ideation' && st.cap.stage !== 'small' && st.cap.stage !== 'scale') continue;
    if (g.when && !g.when(s)) continue;
    tryAct(s, api, 'research.start', { id: g.id });
  }
  const lines = REF_RESEARCH_LINES.filter((l) => !missingNeeds(s, l.id).length);
  for (const l of lines) if (!queue.includes(l.id)) tryAct(s, api, 'research.queue', { id: l.id });
  const sci = p.teams.filter((x) => x.role === 'sci' && x.dept === 'cap').length;
  const ideas = queue.filter((id) => !lines.some((l) => l.id === id) && TREE_BY_ID[id] && COLUMN_DEPT[TREE_BY_ID[id].column] === 'cap' && !nodeKnown(s, id) && takesTeams(p.tree[id]?.cap));
  for (const id of ideas) if ((p.research.want[id] ?? 1) !== REF_IDEA_TEAMS) tryAct(s, api, 'research.want', { id, n: REF_IDEA_TEAMS });
  const free = Math.max(lines.length, sci - REF_IDEA_TEAMS * ideas.length);
  // A saturated direction is dropped to a minimum: once the reference RL run reaches 95% of its ceiling, more RL
  // compute efficiency buys almost nothing, so the RL-algorithm teams move to the other lines [D].
  const F = latestBaseFlop(s);
  const satRL = refRlGain(F, rlMidNow(s), rlCeilNow(s)) >= 0.95 * (rlCeiling(F) + rlCeilNow(s));
  const wOf = (l: { id: string; w: number }) => (l.id === 'L.rlalg' && satRL ? 0 : l.w);
  const wSum = lines.reduce((a, l) => a + wOf(l), 0);
  for (const l of lines) {
    const n = wOf(l) > 0 ? Math.max(1, Math.round((wOf(l) / wSum) * free)) : 0;
    if ((p.research.want[l.id] ?? 1) !== n) tryAct(s, api, 'research.want', { id: l.id, n });
  }
  if (!p.research.autoAssign) tryAct(s, api, 'research.autoAssign', { on: true });

  // Base runs: a base every 9 months; once neuralese (P17) is adopted the next base is latent and starts at once
  // (AI 2027's Agent-3 is a neuralese model at SC).
  const baseRunning = m.runs.some((r) => r.kind === 'base' && r.status === 'running');
  const lastBase = flag(s, 'lastBase', m.bases[m.bases.length - 1]?.startDay ?? -120);
  const latent = p.paradigms.P17?.status === 'adopted' && goals.some((g) => g.id === 'P17');
  const latentDue = latent && !m.bases.some((b) => b.design.shape === 'latent') && !m.runs.some((r) => r.status === 'running' && r.base?.shape === 'latent');
  if ((!baseRunning && day - lastBase >= BASE_EVERY) || latentDue) {
    // The bot's own staleness rule (the engine has no cap since R5): the base is sized so it trains in the target length
    // on 60% of today's pool: FLOP = 0.6 × the pool's run rate × days, active parameters at REF_TPP tokens each.
    const { days: _days, ...rest } = known(s, o.base ?? {});
    const bp = { ...rest, shape: latent ? 'latent' : REFERENCE_BASE.shape };
    const days = Number(o.base?.days ?? (follower ? FOLLOWER_MAX_BASE_DAYS : REF_BASE_DAYS));
    const poolShare = 0.6;
    const flop = poolShare * runFlopPerShareDay(s, { kind: 'base' }) * days;
    const params = paramsForFlop(flop, REF_TPP);
    if (flop > 0 && tryAct(s, api, 'launchBase', { ...bp, params, tpp: REF_TPP, poolShare })) {
      setFlag(s, 'baseShare', poolShare);
      setFlag(s, 'lastBase', day);
    }
  }

  // Post-training every 6 weeks on the newest base (≤ 2 in flight). Skipped once the stream is running on the
  // newest base (the stream already carries it); a new base still gets its first post-train.
  const newestBase = m.bases[m.bases.length - 1];
  const postsRunning = m.runs.filter((r) => r.kind === 'post' && r.status === 'running').length;
  const streamOnNewest = m.stream && m.versions.find((v) => v.id === m.stream?.versionId)?.baseId === newestBase?.id;
  const hasVersionOnNewest = m.versions.some((v) => v.baseId === newestBase?.id && v.variant === 'full');
  if (newestBase && postsRunning < (follower ? 1 : 2) && day - flag(s, 'lastPost') >= POST_EVERY && (!streamOnNewest || !hasVersionOnNewest)) {
    const pending = m.runs.some((r) => r.kind === 'post' && r.status === 'running' && r.baseId === newestBase.id);
    if (!(streamOnNewest && pending)) {
      const design = known(s, o.post?.(s) ?? {});
      let cot = String(design.cot ?? 'visible');
      if (cot === 'faithful' && p.paradigms.P23?.status !== 'adopted') cot = 'visible';
      if (newestBase.design.shape === 'latent') cot = 'latent';
      else if (cot === 'latent') cot = 'visible';
      if (tryAct(s, api, 'launchPost', { ...design, baseId: newestBase.id, cot, poolShare: 0.5 })) setFlag(s, 'lastPost', day);
    }
  }

  // Internal agents: the newest full version on routine research; engineering, frontier and safety research follow it
  // (default packages: monitors 'same' on routine and frontier research), so the reference lab uses its newest model
  // everywhere with a standard monitor (R7, calibration neutral). With continual learning (P08) the stream runs on it and moves to the
  // first version on each newer base (carrying its know-how); other versions on the stream's base are ignored.
  const nv = newestFull(s);
  const sv = m.stream ? m.versions.find((v) => v.id === m.stream?.versionId) : undefined;
  const baseIdx = (v?: ModelVersion) => (v ? m.bases.findIndex((b) => b.id === v.baseId) : -1);
  if (p.paradigms.P08?.status === 'adopted' && nv) {
    if (!sv || baseIdx(nv) > baseIdx(sv)) tryAct(s, api, 'startStream', { versionId: nv.id });
    const cur = m.stream?.versionId;
    if (cur && p.agents.capRoutine.versionId !== cur) tryAct(s, api, 'agents.set', { use: 'capRoutine', versionId: cur });
  } else if (nv && p.agents.capRoutine.versionId !== nv.id) tryAct(s, api, 'agents.set', { use: 'capRoutine', versionId: nv.id });

  // Evals: the auto-evaluate policy refreshes the internal version's suite every 30 days (streams go stale); R6
  // replaced the bot's own 30-day runEvals. Serving: the Auto policy.
  const iv = m.versions.find((v) => v.id === p.agents.capRoutine.versionId);
  if (!p.policies.autoEvaluate) tryAct(s, api, 'products.policy', { autoEvaluate: true });
  if (!p.policies.servingAuto) tryAct(s, api, 'products.policy', { servingAuto: true });

  // A distilled mini about every 6 months, deployed to consumer and API (frontier stays internal), or the newest
  // full version for bots that release their frontier.
  // Also a mini from the first version on each new base (AI 2027's Agent-1-mini): a mini of an old-generation teacher
  // (the distillation gap below it) does not beat the model already on sale, so a fixed 6-month clock alone could leave the launch model
  // public for 15 months.
  const newGen = !!iv && baseIdx(iv) > flag(s, 'miniBase', 0);
  let servedL = 0;
  for (const d of p.deployments) if (d.status === 'live' && PUBLIC_CHANNELS.includes(d.channel)) servedL = Math.max(servedL, m.versions.find((v) => v.id === d.versionId)?.evals.measuredL ?? 0);
  const stale = !!iv && (iv.evals.measuredL ?? 0) - servedL >= MINI_GAP_L && day - flag(s, 'lastMini', 0) >= 45;
  // (A5: the small cheap-tier distil below runs alongside; it does not hold up a public mini.)
  const cheapRun = (r: TrainingRun) => r.kind === 'distill' && r.studentParams !== undefined && r.studentParams === s.flags['ref:cheapParams'];
  const release = o.release ?? 'compete';
  const distilling = m.runs.some((r) => r.kind === 'distill' && r.status === 'running' && !cheapRun(r));
  const cheapTier = o.cheapTier ?? release === 'compete';
  if (release === 'compete') {
    // F5 'compete': the public mini is the cheapest student of the internal model that keeps the release lead (A5's
    // cheapestAt rule on one teacher: it holds the best rival public chat fit + RELEASE_LEAD + RELEASE_REFRESH on
    // arrival), distilled when it would serve ≥ 20% cheaper than the products' current model (≥ 45 days apart).
    const st = iv && !distilling && day - flag(s, 'lastMini', 0) >= MINI_MIN_DAYS && day % RELEASE_EVERY === 0 ? leadStudent(s, iv) : undefined;
    if (st && iv && tryAct(s, api, 'launchDistill', { teacherVersionId: iv.id, studentParams: st })) {
      setFlag(s, 'lastMini', day);
      setFlag(s, 'miniBase', Math.max(flag(s, 'miniBase', 0), baseIdx(iv)));
    }
  } else if (iv && (newGen || stale || day - flag(s, 'lastMini', 0) >= MINI_EVERY) && !distilling) {
    if (tryAct(s, api, 'launchDistill', { teacherVersionId: iv.id, studentParams: REF_STUDENT * paramsOfVersion(s, iv) })) {
      setFlag(s, 'lastMini', day);
      setFlag(s, 'miniBase', Math.max(flag(s, 'miniBase', 0), baseIdx(iv)));
    }
  }
  // A5 (option `cheapTier`, on for RefBot since F5): the API's cheap tier — a student of the internal model that holds
  // the previous public release's capability (the cheapestAt rule on one teacher, worldfx/serving.ts studentToHold; small
  // models match the previous frontier within months, R12 §0.6), distilled once per public release alongside a
  // public-mini distil (it is small), and set as the API's mini when ready. It is not a public release itself.
  const cheapIds = String(s.flags['ref:cheapIds'] ?? '').split(',').filter(Boolean);
  const apiDep = p.deployments.find((d) => d.channel === 'api' && d.status === 'live');
  const prevPub = m.versions.find((v) => v.id === s.flags['ref:prevPublic']);
  if (cheapTier && apiDep && prevPub && iv && s.flags['ref:cheapFor'] !== prevPub.id && !m.runs.some((r) => r.status === 'running' && cheapRun(r))) {
    const nS = studentToHold(s, iv, prevPub);
    if (nS <= CHEAP_MAX * paramsOfVersion(s, iv) && tryAct(s, api, 'launchDistill', { teacherVersionId: iv.id, studentParams: nS })) {
      s.flags['ref:cheapFor'] = prevPub.id;
      s.flags['ref:cheapParams'] = nS;
    }
  }
  const cheapP = Number(s.flags['ref:cheapParams'] ?? 0);
  const cheap = cheapP > 0 ? [...m.versions].reverse().find((v) => v.variant === 'mini' && v.status === 'ready' && Math.abs((v.params ?? 0) - cheapP) <= 1e-6 * cheapP) : undefined;
  if (cheap && !cheapIds.includes(cheap.id)) {
    cheapIds.push(cheap.id);
    s.flags['ref:cheapIds'] = cheapIds.slice(-4).join(',');
  }
  if (cheapTier && apiDep && cheap && apiDep.miniVersionId !== cheap.id) tryAct(s, api, 'product.update', { id: apiDep.id, miniVersionId: cheap.id });

  // Product channels (consumer, API, enterprise). 'compete': competeRelease. 'mini' / 'frontier': they move to the new
  // public model only if it measures better than what they serve (a fresh mini can trail the previous release).
  const mini = [...m.versions].reverse().find((v) => v.variant === 'mini' && v.status === 'ready' && !cheapIds.includes(v.id));
  const pub = release === 'compete' ? undefined : release === 'frontier' ? [...m.versions].reverse().find((v) => v.variant === 'full' && (v.status === 'ready' || v.status === 'deployed')) ?? mini : mini;
  if (release === 'compete' && day % RELEASE_EVERY === 0) {
    const prev = new Map(p.deployments.map((d) => [d.id, d.versionId]));
    competeRelease(s, api, cheapIds);
    if (cheapTier) for (const d of p.deployments) if (d.channel === 'api' && prev.get(d.id) !== d.versionId) s.flags['ref:prevPublic'] = prev.get(d.id) ?? '';
  }
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
      const old = d.versionId;
      if (want && want.id !== d.versionId && (want.evals.measuredL ?? 0) > mL(d.versionId) && tryAct(s, api, 'product.update', { id: d.id, versionId: want.id }) && cheapTier && d.channel === 'api') s.flags['ref:prevPublic'] = old;
    }
  }

  // A follower start without a product (the spinout) launches Chat, API and Enterprise once it has a model it may
  // sell (an imported model must be post-trained first, D6); the updates above then keep them current.
  if (follower && day % 30 === 0) {
    for (const ch of PRODUCT_CHANNELS) if (!p.deployments.some((d) => d.channel === ch && d.status !== 'withdrawn')) tryAct(s, api, 'product.launch', { channel: ch });
  }

  syncPoolShares(s, api);

  // Housekeeping: retire superseded versions (keep the newest 4 full + anything in use).
  if (day % 30 === 15) {
    const full = m.versions.filter((v) => v.status !== 'retired' && v.variant === 'full').sort((a, b) => b.day - a.day);
    for (const v of full.slice(4)) tryAct(s, api, 'retireVersion', { versionId: v.id });
    const minis = m.versions.filter((v) => v.status !== 'retired' && v.variant === 'mini' && !cheapIds.includes(v.id)).sort((a, b) => b.day - a.day);
    for (const v of minis.slice(2)) tryAct(s, api, 'retireVersion', { versionId: v.id });
    // A5: cheap tiers no product serves any more (retireVersion keeps the one in use).
    for (const id of cheapIds) if (m.versions.find((v) => v.id === id)?.status === 'ready') tryAct(s, api, 'retireVersion', { versionId: id });
  }
}

/** F5: the lead (OOM of consumer-chat fit) RefBot's public release keeps over the best rival or Chinese public model
 *  [D]: 0.3 OOM ≈ 3 months of the reference frontier's progress (B_G_PER_Y 1.2 OOM/yr). It ships no more than that:
 *  a released model leaks to distillers in proportion to its G above theirs (models/deployments.ts distillationLeak)
 *  and a bigger model costs more serving. */
export const RELEASE_LEAD = 0.3;
/** A product is refreshed once its lead over the best rival public model falls below this (≈ 1 month) [D]. */
export const RELEASE_REFRESH = 0.1;
/** A cleared version this much cheaper to serve (FLOP per token) that still leads by RELEASE_LEAD replaces the served
 *  one even while the lead holds (a fresh distilled student) [D]. */
const RELEASE_CHEAPER = 0.8;
const RELEASE_EVERY = 7;

/** Best consumer-chat fit among the rivals' and China's public models (the models users can pick instead). */
export function bestRivalChatFit(s: GameStateV2): number {
  let best = -Infinity;
  for (const r of [...s.rivals, s.china.lab]) {
    const pm = r.publicModel;
    if (!pm || (r.core.status !== 'active' && !pm.openWeights)) continue;
    best = Math.max(best, sectorFit(s, pm, 'CHAT'));
  }
  return best;
}

/** Minimum days between two public-mini distils under 'compete' [D]. */
const MINI_MIN_DAYS = 30;

/** Active parameters of the student of `teacher` worth distilling as the public mini under 'compete', or undefined. While
 *  the products lead the best rival public model by ≥ RELEASE_REFRESH: the student that holds rival + RELEASE_LEAD +
 *  RELEASE_REFRESH (studentParamsFor, the cheapestAt rule), if it serves ≥ 20% cheaper (FLOP per token ∝ active
 *  parameters) than the cheapest model on Chat / API. Once the lead is lost: that student, or a REF_STUDENT-size one when
 *  the teacher is too close to the target for a smaller one, if it beats what Chat / API serve. */
function leadStudent(s: GameStateV2, teacher: ModelVersion): number | undefined {
  const rival = bestRivalChatFit(s);
  if (rival === -Infinity) return undefined;
  const nT = paramsOfVersion(s, teacher);
  const fitT = sectorFit(s, teacher, 'CHAT');
  let nS = studentParamsFor(nT, fitT - (rival + RELEASE_LEAD + RELEASE_REFRESH));
  let servedFpt = Infinity;
  let servedFit = -Infinity;
  for (const d of s.player.deployments) {
    if (d.status !== 'live' || !PUBLIC_CHANNELS.includes(d.channel)) continue;
    const v = versionById(s, d.versionId);
    if (!v) continue;
    servedFpt = Math.min(servedFpt, flopPerToken(s, v));
    servedFit = Math.max(servedFit, sectorFit(s, v, 'CHAT'));
  }
  if (servedFit - rival < RELEASE_REFRESH) {
    if (!(nS < nT)) nS = REF_STUDENT * nT;
    return fitT - (DISTILL.a + DISTILL.b * Math.log10(nT / nS)) > servedFit + 0.05 ? nS : undefined;
  }
  if (!(nS < nT)) return undefined;
  return (flopPerToken(s, teacher) * nS) / nT < RELEASE_CHEAPER * servedFpt ? nS : undefined;
}

/**
 * F5 release policy ('compete', RefBot's): AI 2027, early 2026: "Several competing publicly released AIs now match or
 * exceed Agent-0 … OpenBrain responds by releasing Agent-1". Weekly, each of Chat, API and Enterprise picks among the
 * cleared versions (deployGate: the eval gate, the channel's variants, commitments) the cheapest to serve whose
 * consumer-chat fit leads the best rival public model by RELEASE_LEAD; when none does, the best one. A product moves
 * when its own lead has fallen below RELEASE_REFRESH (to a better model) or when a version ≥ 20% cheaper is adequate
 * (a fresh mini). The frontier stays internal whenever a smaller or older model keeps the lead, and the continual-
 * learning stream is never a candidate: it is the internal frontier updated in place, so serving it would ship every
 * day's gain (and leak it to distillers); a lab ships snapshots (the minis are distilled from it).
 */
function competeRelease(s: GameStateV2, api: EngineApi, skip: string[]) {
  const rival = bestRivalChatFit(s);
  if (rival === -Infinity) return;
  const target = rival + RELEASE_LEAD;
  const streamId = s.player.models.stream?.versionId;
  const pool = s.player.models.versions.filter((v) => (v.status === 'ready' || v.status === 'deployed') && !skip.includes(v.id) && v.id !== streamId);
  const fitOf = new Map(pool.map((v) => [v.id, sectorFit(s, v, 'CHAT')]));
  const fptOf = new Map(pool.map((v) => [v.id, flopPerToken(s, v)]));
  for (const d of s.player.deployments) {
    if (!PRODUCT_CHANNELS.includes(d.channel) || d.status !== 'live') continue;
    const cur = versionById(s, d.versionId);
    const curFit = cur ? (fitOf.get(cur.id) ?? sectorFit(s, cur, 'CHAT')) : -Infinity;
    const curFpt = cur ? (fptOf.get(cur.id) ?? flopPerToken(s, cur)) : Infinity;
    const ok = pool.filter((v) => deployGate(s, v, d.channel, { safeguards: d.safeguards, usagePolicy: d.usagePolicy }) === true);
    if (!ok.length) continue;
    const adequate = ok.filter((v) => fitOf.get(v.id)! >= target).sort((a, b) => fptOf.get(a.id)! - fptOf.get(b.id)!)[0];
    const best = [...ok].sort((a, b) => fitOf.get(b.id)! - fitOf.get(a.id)!)[0];
    let want: ModelVersion | undefined;
    if (curFit - rival < RELEASE_REFRESH) {
      const w = adequate ?? best;
      if (fitOf.get(w.id)! > curFit + 0.01) want = w;
    } else if (adequate && fptOf.get(adequate.id)! < RELEASE_CHEAPER * curFpt) want = adequate;
    if (want && want.id !== d.versionId) tryAct(s, api, 'product.update', { id: d.id, versionId: want.id });
  }
}

/** Pool share each kind of run asks for (RefBot's launch shares; the base share is the one it launched with). */
const askShare = (s: GameStateV2, r: TrainingRun) =>
  r.kind === 'base' ? flag(s, 'baseShare', 0.6) : r.kind === 'post' ? (r.name.startsWith('IDA') ? 0.3 : 0.5) : r.kind === 'distill' ? 0.1 : 0.3;

/** R5 made the pool allocation proportional. RefBot keeps the pre-R5 priority (base and continue runs keep their
 *  share; the other runs share what is left) by setting every run's pool share to what that rule gives it, so its
 *  effective shares and run lengths stay the reference ones. Runs still waiting for their setup count as training
 *  (they start within the day). Shares below the engine minimum are raised to it and the other non-base runs make
 *  room. Acts only when a share changes (a run starts or ends). */
function syncPoolShares(s: GameStateV2, api: EngineApi) {
  const m = s.player.models;
  const runs = m.runs.filter((r) => r.status === 'running');
  if (!runs.length) return;
  const avail = 1 - (m.stream ? STREAM_POOL_SHARE : 0);
  const pre = runs.filter((r) => r.kind === 'base' || r.kind === 'continue');
  const rest = runs.filter((r) => r.kind !== 'base' && r.kind !== 'continue');
  const sumPre = pre.reduce((a, r) => a + askShare(s, r), 0);
  const kPre = sumPre > avail ? avail / sumPre : 1;
  const left = Math.max(0, avail - sumPre * kPre);
  const sumRest = rest.reduce((a, r) => a + askShare(s, r), 0);
  const kRest = sumRest > left ? left / sumRest : 1;
  const want = new Map<string, number>();
  for (const r of pre) want.set(r.id, Math.max(POOL_SHARE_RANGE[0], askShare(s, r) * kPre));
  // Engine minimum: raise small shares and scale the other rest runs into what remains.
  const lo = rest.filter((r) => askShare(s, r) * kRest < POOL_SHARE_RANGE[0]);
  const hi = rest.filter((r) => askShare(s, r) * kRest >= POOL_SHARE_RANGE[0]);
  const hiSum = hi.reduce((a, r) => a + askShare(s, r) * kRest, 0);
  const room = Math.max(0, left - lo.length * POOL_SHARE_RANGE[0]);
  const kHi = hiSum > room ? room / hiSum : 1;
  for (const r of lo) want.set(r.id, POOL_SHARE_RANGE[0]);
  for (const r of hi) want.set(r.id, Math.max(POOL_SHARE_RANGE[0], askShare(s, r) * kRest * kHi));

  for (const r of runs) {
    const w = want.get(r.id) ?? r.poolShare;
    if (Math.abs(w - r.poolShare) > 1e-6) tryAct(s, api, 'runs.setShare', { runId: r.id, share: w });
  }
}

/** Index of a choice by label, else the event's default choice. */
export function choiceByLabel(d: PendingDecision, label: string): number {
  const def = EVENT_BY_ID.get(d.id);
  const i = def?.choices.findIndex((c) => c.label === label) ?? -1;
  return i >= 0 ? i : (def?.defaultChoice ?? 0);
}

/** RefBot's decisions (§7.4): E17 Continue, E20 Accept, E23 Reject; everything else takes the event's default. (The
 *  board is handled by the finance autopilot: FIN3b dropped E37 for the critics' seat action.) */
export function refDecide(_s: GameStateV2, d: PendingDecision): number {
  if (d.id === 'E17') return choiceByLabel(d, 'Continue');
  if (d.id === 'E20') return choiceByLabel(d, 'Accept');
  if (d.id === 'E23') return choiceByLabel(d, 'Reject');
  return EVENT_BY_ID.get(d.id)?.defaultChoice ?? 0;
}

/** F5 Trusted to AI: the believed oversight of the safety model (block + catch on scheming acts, E15's
 *  believedInternalOversight) at which RefBot starts handing safety work to AI and at which it hands all of it [D]. */
export const TRUST_OVERSIGHT: readonly [number, number] = [0.4, 0.8];
/** …and the most believed sabotage attempts per safety result it accepts at that share (E7's believedSabotage) [D]. */
export const TRUST_SAB_MAX = 0.1;

/**
 * F5: RefBot's Trusted to AI (AI 2027's labs hand alignment work to their models; E2 made it the player's lever and no
 * bot used it). Monthly, on the safety model's measured state: t = the share of safety work it believes it can check,
 * (oversight − 0.4) ÷ 0.4 clamped to 0–1 in steps of 0.1, lowered until the believed sabotage per result at t is ≤ 10%.
 * A model not yet measured keeps the last setting. Reads only what the lab knows.
 */
export function refTrusted(s: GameStateV2, api: EngineApi): void {
  if (s.time.day % 30 !== 20) return;
  const v = safetyAgentVersion(s) ?? internalVersion(s);
  if (!v || v.evals.measuredL === undefined) return;
  const o = believedInternalOversight(s, v).oversight;
  const [lo, hi] = TRUST_OVERSIGHT;
  let t = Math.round(10 * Math.max(0, Math.min(1, (o - lo) / (hi - lo)))) / 10;
  while (t > 0 && believedSabotage(s, t) > TRUST_SAB_MAX) t = Math.round(10 * t - 1) / 10;
  if (Math.abs(t - s.player.policies.trustedToAI) > 1e-9) tryAct(s, api, 'agents.trusted', { share: t });
}

/** F5 footholds: safety research engineers RefBot puts on a case on a suspected foothold [D] (INV_FTE's 15-person
 *  default); it opens one only when that many are free, so a case never displaces patches or another case. */
export const FOOTHOLD_CASE_FTE = 15;

/**
 * F5: RefBot's foothold policy (E8 found it never investigated one). Weekly, on the lab's foothold view (suspected,
 * located; never hidden ones): a suspected foothold with a model to examine gets a case on that model and the act's main
 * trait when FOOTHOLD_CASE_FTE safety research engineers are free (the case costs only their time); a located one is
 * removed (Respond › Remove foothold: engineers for 2–4 weeks, internal agents off for ≤ 7 days).
 */
export function refFootholds(s: GameStateV2, api: EngineApi): void {
  if (s.time.day % 7 !== 4) return;
  const fv = footholdView(s);
  if (!fv.suspected && !fv.located) return;
  for (const r of fv.rows) {
    if (r.status === 'detected') tryAct(s, api, 'safety.respond', { kind: 'removeFoothold', footholdId: r.id });
    if (r.status !== 'suspected' || !r.caseVersionId || !r.caseTrait) continue;
    const open = s.player.safety.investigations.some((i) => !i.outcome && i.target.kind === 'trait' && i.target.versionId === r.caseVersionId && i.target.trait === r.caseTrait);
    if (open || safetyReHeads(s) - investigationFte(s) - patchFte(s) < FOOTHOLD_CASE_FTE) continue;
    tryAct(s, api, 'safety.investigate', { versionId: r.caseVersionId, trait: r.caseTrait, fte: FOOTHOLD_CASE_FTE });
  }
}

/** RefBot / passive: reference model play + WS3's reference finance autopilot (one cloud partner, SPVs as needed). */
export const refBot: BotPolicy = {
  id: 'ref',
  act(s, api) {
    if (s.time.day === 0) tryAct(s, api, 'teams.target', { key: 'sci.saf', n: sizedTarget(s, REF_SAFETY_SCI_TEAMS) });
    staffLines(s, api, REF_LINES);
    refTrusted(s, api);
    refFootholds(s, api);
    refPlay(s, api);
    financeAutopilot(s, REF_AUTOPILOT);
  },
  decide: refDecide,
};
