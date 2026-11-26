// RefBot / passive: replays the AI 2027 reference race (§7.1 T1, §7.4). Harness owner: WS4; the reference policy
// below is provided by WS1 for calibration (T1) and only uses EngineApi actions.
//
// Reference cadence (§7.1): compute tracks refTotal (WS3's finance autopilot buys it; the T1 calibration stubs it),
// split = shareRef(t), cap hiring tracks H_ref, a base every 9 months sized to train in ~4 months on 60% of its pool
// (v3 V1: active parameters at REF_TPP tokens per parameter, 400 since A6b: a lab that serves its models
// overtrains them, DeepSeek-V3 ≈ 400 tokens per active parameter, research/20 A1; v2 trained 1 × the frontier run F(t), which took the same
// time on the reference pool), a post-train every 6 weeks (≤ 2 in flight),
// continual learning once P08 works, P05/P07/P08/P17 researched on the tree (REF_TREE; never P23), latent bases after
// P17. Releases (F5, 'compete'): Chat, API and Enterprise serve the cheapest cleared version that leads the rivals'
// public models by RELEASE_LEAD (AI 2027's Agent-1 release in answer to competitors), with a public mini distilled to
// hold that lead and the API's cheap tier (A5); the frontier stays internal whenever a smaller model keeps the lead.
// R6: serving is the Auto policy (no weekly re-split), model swaps are live product updates, and the auto-evaluate
// policy refreshes the internal model's evals.
//
// `refPlay(s, api, opts)` is the model/department half of that policy, parameterised so the other bots (race, safe,
// mixed, capex2x) reuse the cadence with their own design choices; RefBot plays it with REF_PLAY (S5R: its safety share).
// `refBot` = refPlay + WS3's reference finance autopilot (REF_AUTOPILOT).
import { DISTILL, REFERENCE_BASE, REF_TPP, STREAM_POOL_SHARE } from '../../../data/v2/runDesign';
import { paramsForFlop, rlCeiling } from '../models/effective';
import { latestBaseFlop, refRlGain, rlCeilNow, rlMidNow } from '../models/stacks';
import { takesTeams } from '../models/research';
import { POOL_SHARE_RANGE, paramsOfVersion, runFlopPerShareDay } from '../models/runs';
import { sectorFit, studentParamsFor } from '../worldfx/serving';
import { flopPerToken, workFit } from '../departments/workfit';
import { agentCompute, agentVersion, monitorBudget } from '../departments/agents';
import { MONITOR_SAME } from '../../../data/v2/agents';
import { FREE_TIER } from '../../../data/v2/serving';
import { PRODUCT_TOOL_BY_ID } from '../../../data/v2/tools';
import { agentsGate } from '../models/products';
import { deployGate } from '../models/deployments';
import { EVENT_BY_ID } from '../core/registry';
import { decimalYear } from '../core/time';
import { playerShareRef, shareRefAt, SPLIT_KEYS, withFixed } from '../departments/split';
import { financeAutopilot } from '../finance/plan';
import { runwayOf } from '../finance/runway';
import { hRef } from '../production/ces';
import { REF_SHARE } from '../production/data';
import { DEFAULT_LINES } from '../../../data/v2/research';
import { REF_ROLE_SHARE, SAF_ROLE_SHARE, TEAM_SIZE } from '../../../data/v2/teams';
import type { BotPolicy, DomainId, ComputeSplit, EngineApi, GameStateV2, ModelVersion, PendingDecision, TeamKey, TrainingRun } from '../types';
import { bestMeasuredL, internalVersion, versionById } from '../models/labs';
import { believedInternalOversight } from '../safety/believedOversight';
import { believedResultThreat, believedSabotage } from '../safety/covert';
import { safetyAgentVersion } from '../safety/agents';
import { footholdView } from '../safety/footholdDetection';
import { committedFte, safetyReHeads } from '../safety/investigations';
import { gOfLevel, gV0 } from '../models/capability';
import { missingNeeds, nodeKnown, optionLocked } from '../models/tree';
import { suiteRef, unbuiltSuiteFamilies } from '../models/suites';
import { TREE_BY_ID } from '../../../data/v2/tree';
import { COLUMN_DEPT } from '../../../data/v2/teams';
import { answerFramework, sizedTarget, staffLines, type LinePlan } from './common';
import { adopted } from '../models/paradigms';
import { DEFAULT_REF, type AskShares, type GateKey, type RefBotSettings } from './settings';

// Every tunable choice below lives in RefBotSettings (bots/settings.ts; DEFAULT_REF holds the values the comments quote).
// `refPlay` and the functions it calls read them from `o.settings`; a bot built with other settings (makeRefBot) passes
// them there. The exported names that scripts and the other bots import (REF_TREE, REF_LINES, RELEASE_LEAD, ...) are the
// defaults' values.

type Params = Record<string, number | string | boolean>;

/** A tree project a bot queues once `when` holds (and its prerequisites are known). */
export interface TreeGoal { id: string; when?: (s: GameStateV2) => boolean }
/** RefBot's research pacing gates in effective compute above the start model V0 (OOM, G − G_V0; RD-U07). They were v2
 *  display levels converted through v2's level map (on V2a's stale per-preset threshold-shift table) and v2's progress
 *  coordinate placed on G at slope B. Each constant is that conversion's value on the ai2027 preset, so the ai2027 gates
 *  open where they did; the other presets' gates now sit at the same OOM above their own V0 (before, the stale table
 *  set them per preset). A measured level is read back as G through gOfLevel (the inverse of the display map λ). */
const GATE_OOM = DEFAULT_REF.gateOom; // L65 was L 6.5 (display λ 7.74 on ai2027), L7 was 7 (λ 8.55), L85 was 8.5 (λ 10.57), L95 was 9.5 (λ 11.20)
const atGate = (s: GameStateV2, L: number, dG: number) => gOfLevel(s.hidden.timeline, L) - gV0(s.hidden.timeline) >= dG - 1e-9;
const Lg = (s: GameStateV2, dG: number) => atGate(s, bestMeasuredL(s), dG);
/** The tree goals of settings `c` (research list in priority order; each project starts once its gate is open). */
export function treeGoals(c: RefBotSettings): TreeGoal[] {
  return c.research.map((id) => {
    const gate: GateKey | undefined = c.researchGate[id];
    return gate ? { id, when: (s: GameStateV2) => Lg(s, c.gateOom[gate]) } : { id };
  });
}
/** RefBot's research (§3.3.3 "RefBot paradigm policy", R4): the engine has no capability gates, so the bot keeps the
 *  old pacing by starting each project when the old gate would have opened (GATE_OOM; tier 2 was L 6.5, tier 3 L 8.5,
 *  P08 L 7, P17 L 9.5). RD-E01a deleted P13 and P19. */
export const REF_TREE: TreeGoal[] = treeGoals(DEFAULT_REF);
/** RefBot's research lines (model v3 V2) and their share of the science teams the ideas leave free [D]: the
 *  pretraining lines carry the pretraining stack (Ho et al. ≈ 3×/yr before SC), the RL lines the RL stack. Recurrent
 *  architectures opens with neuralese recurrence (P17). D10: Inference efficiency is ranked (weight 0.1, DEFAULT_LINES):
 *  the serving stack raises decode utilisation, then cuts FLOP per token (models/stacks.ts serveSplit). */
export const REF_RESEARCH_LINES = DEFAULT_LINES;
/** Teams wanted on each of RefBot's paradigm projects [D]: v2's auto-assign put most of its science teams on its one or
 *  two queued paradigms; the v3 reference lab also runs its lines, so it staffs each paradigm bet with three teams and
 *  gives the lines the rest. (A fixed 70% line share was tried: it fitted the lines more evenly across worlds but moved
 *  the ai2027 takeoff out of tolerance; design/V3-BUILD.md V2 notes.) */
/** (settings.ideaTeams, 3) */
/** The safe bot's extra research: faithful-CoT architecture, paced like its old gate (tier 3, an AG09 technique). */
export const SAFE_TREE_EXTRA: TreeGoal[] = [
  { id: 'P23', when: (s) => Lg(s, GATE_OOM.L85) && s.player.safety.findings.some((f) => f.agenda === 'AG09' && f.type === 'TECH') },
];
/** (settings.baseEvery, 270: a base every 9 months) */
/** RefBot's base run length at its requested share (60% of the pool): v2's reference run (1 × F(t) = 91 days of 80% of
 *  the reference training pool) took 121 days at that share. The bot sizes its base (active parameters at REF_TPP, the reference's inference-aware ratio) to
 *  this; the engine has no cap (R5: staleness is shown instead). Follower starts (R9) accept a longer run (their pools
 *  are small) and hire only while runway is at least FOLLOWER_GROW_Q quarters.
 *  (settings.baseDays 121, followerMaxBaseDays 200, followerGrowQ 6) */
/** RefBot's distilled minis: half the teacher's active parameters [D]: the distillation gap is then 0.47 OOM (≈ v2's
 *  −0.30 y mini; a quarter-size student trails by 0.62 y and misses the 2026 hype, valuation and distress targets).
 *  (settings.student) */
/** A5: RefBot distils a cheap API tier only when it is at most this share of the internal model's size (≥ 2× cheaper than
 *  the half-size public mini) [D]. (settings.cheapMax; settings.postEvery 42; settings.miniEvery 182)
 *  Also a mini sooner (≥ 45 d apart) once the internal model measures settings.miniGapL (0.7) levels above what the
 *  products serve. The bots sell Chat, API and Enterprise; none sells Vetted (none sold Government or Trusted access
 *  before MK-1): settings.productChannels. The public release (where the minis go, settings.publicChannels):
 *  staleness is measured against it, not against Enterprise: Enterprise can sit on the continual-learning stream
 *  (updated in place), which hid how far the public release trailed (R6 fix). */
/** Passive/RefBot safety programme (§7.4): safety compute sized to AI 2027's alignment share (S5R: refSafetyShare, the
 *  safety agents mixed like the capabilities research pool: refSafetyAgents) and, since R8, one safety science team on each
 *  of AG18, AG02, AG08 and AG07 (≈ the pre-R8 Seed funding of those four: data/v2/agendas.ts SERIOUS_CAP). It starts
 *  with two teams and hires two more. Each line works the ideas RefBot uses in the pre-R8 catalog order (training-signal
 *  design: honesty, then anti-scheming; applied interp: deception probe, verbalizer; evals: honeypots, auditing agents;
 *  control: resampling, control evals, comms lockdown), then the line's follow-up. */
export const REF_LINES: LinePlan[] = DEFAULT_REF.lines;
/** (settings.safetySciTeams, 4) */

/**
 * S5R: AI 2027's alignment share of the leading lab's internal compute [S]: the compute forecast's usage table splits
 * "Total Internal" (synthetic data + research experiments + research automation) into a "Capabilities share" of 95 / 96 /
 * 97% and an "Alignment share" of 5 / 4 / 3% in 2024 / 2025 / 2026, 3% through 2027; the AI goals forecast: "The vast
 * majority (~95%) of research effort and experiment compute is dedicated to improving the AIs' capabilities". Years as
 * SHARE_REF's (the 2025 column at 2025.5); linear between, held outside.
 */
export const REF_ALIGN_SHARE: readonly { year: number; share: number }[] = DEFAULT_REF.alignShare;
export function refAlignShare(year: number, c: RefBotSettings = DEFAULT_REF): number {
  const t = c.alignShare;
  if (year <= t[0].year) return t[0].share;
  for (let i = 0; i < t.length - 1; i++) {
    if (year <= t[i + 1].year) return t[i].share + ((year - t[i].year) / (t[i + 1].year - t[i].year)) * (t[i + 1].share - t[i].share);
  }
  return t[t.length - 1].share;
}

/** RD-A05a: the lab's safety compute = its three allocation lines (safety research, monitors, safety agents). */
const safetyTotal = (sp: ComputeSplit) => sp.safety + sp.monitors + sp.safetyAgents;

/** Share of the safety compute that is not safety research: the monitors' used compute and open investigations. */
function safetyReserved(s: GameStateV2): number {
  const sp = s.player.split;
  const tot = safetyTotal(sp);
  if (tot <= 0) return 0;
  const inv = s.player.safety.investigations.filter((i) => !i.outcome).reduce((a, i) => a + i.computeShare, 0);
  return (monitorBudget(s).used + Math.min(1, inv) * sp.safety) / tot;
}

/**
 * S5R: RefBot's safety compute share. Its safety research (line experiments + safety agents) takes the alignment share
 * of the research the reference lab runs, a/(1 − a) × (experiments + agents of shareRef), the table's experiments and
 * automation rows (alignment's share of the synthetic-data row is training data: the post-training design, not the
 * safety pool); the pool adds the monitors' and investigations' share on top. 2026: 0.03/0.97 × 10% ≈ 0.31% of compute
 * on safety research (before S5R: ≈ 1.7%, five times the source), Q4 2027 ≈ 1.3%. SAFMECH: the monitors take the
 * source's monitoring spend (refMonitors: 1/20 of the watched fleets' compute, AI 2027's compute forecast) out of
 * the pool, which grows by it.
 */
export function refSafetyShare(s: GameStateV2, c: RefBotSettings = DEFAULT_REF): number {
  const yr = decimalYear(s);
  const a = refAlignShare(yr, c);
  const r = shareRefAt(yr);
  const research = (a / (1 - a)) * (r.experiments + r.routine + r.frontier);
  return Math.min(1, research / Math.max(c.safetyShareFloor, 1 - safetyReserved(s)));
}

/**
 * S5R: RefBot's safety agents (the safety package's share of the safety pool): the safety research is mixed like the
 * capabilities research pool (agents ÷ (experiments + agents) of the lab's split, RefBot's table mix since RD-A02), so the safety
 * agents' compute is the alignment share of the lab's research automation (the table's 3% of the automation row) and the
 * safety AI labour a/(1 − a) of the capabilities agents' on the same model. (Before S5R RefBot kept the package default, 20%
 * of the pool: in 2026 that was ≈ 4× the capabilities agents' AI labour, against the source's ~95% of research effort
 * on capabilities.) Weekly, when the share moves by more than a tenth.
 */
export function refSafetyAgents(s: GameStateV2, api: EngineApi, c: RefBotSettings = DEFAULT_REF): void {
  if (s.time.day % 7 !== 3) return;
  const sp = s.player.split;
  const ag = sp.routine + sp.frontier;
  const res = sp.experiments + ag;
  const want = safetyTotal(sp) * Math.max(1e-3, res > 0 ? Math.max(0, 1 - safetyReserved(s)) * (ag / res) : 0);
  const cur = sp.safetyAgents;
  if (Math.abs(want - cur) > c.safetyAgentsTolerance * Math.max(want, cur) + 1e-6) tryAct(s, api, 'agents.set', { use: 'safety', compute: want });
}

/** SAFMECH: AI 2027's monitoring of the internal fleet [S]. The compute forecast derives its monitoring row from "a model
 *  with an average inference cost around 10x lower … checking roughly half of all input/output tokens" ("divide by 20 to
 *  get our estimate for the share of compute on monitoring"), and the main text monitors with weaker, cheaper models
 *  (Apr 2027: "monitoring Agent-3's outputs using a series of weaker AI systems including Agent-2"; fn 51: "a distilled
 *  system that has 10% of the cost as Agent-4"). RefBot spends REF_MONITOR_SPEND of the watched fleets' compute and picks
 *  as each monitor the live model whose cost (FLOP per token) is nearest REF_MONITOR_COST of the watched model's (a copy of
 *  it while it has nothing cheaper); the coverage follows (departments/agents.ts monitorBudget): ½ at the source's cost
 *  ratio, less with a dearer monitor. RF-S2 (review safety #14): restored after SR-20b had replaced it with the player's
 *  trusted-watcher picker without a source; RefBot's own choice (a bot override of monitorId 'auto'). */
export const REF_MONITOR_SPEND = DEFAULT_REF.monitorSpend;
export const REF_MONITOR_COST = DEFAULT_REF.monitorCost;
// The agent uses it watches: settings.monitored (capRoutine, capFrontier).

/** SAFMECH: RefBot's monitors (weekly; the budget when it moves by more than a tenth). Reads only what the lab knows
 *  (its models' sizes and its compute). */
export function refMonitors(s: GameStateV2, api: EngineApi, c: RefBotSettings = DEFAULT_REF): void {
  if (s.time.day % 7 !== 5) return;
  const live = s.player.models.versions.filter((v) => v.status === 'ready' || v.status === 'deployed');
  let watched = 0;
  for (const use of c.monitored) {
    const v = agentVersion(s, use);
    if (!v) continue;
    watched += agentCompute(s, use);
    const fv = flopPerToken(s, v);
    let best: ModelVersion = v;
    let gap = Math.abs(Math.log(c.monitorCost));
    for (const m of live) {
      const r = flopPerToken(s, m) / Math.max(1e-9, fv);
      if (!(r <= 1)) continue;
      const g = Math.abs(Math.log(r / c.monitorCost));
      if (g < gap - 1e-9) { gap = g; best = m; }
    }
    const want = best.id === v.id ? MONITOR_SAME : best.id;
    if (s.player.agents[use].monitorId !== want) tryAct(s, api, 'agents.set', { use, monitorId: want });
  }
  const online = s.player.computeOnline;
  const tot = safetyTotal(s.player.split);
  if (online <= 0 || tot <= 0) return;
  const share = Math.min(c.monitorShareCap * tot, (c.monitorSpend * watched) / online); // RD-A05a: share of total compute
  const cur = s.player.split.monitors;
  if (Math.abs(share - cur) > c.monitorTolerance * Math.max(share, cur) + 1e-6) tryAct(s, api, 'agents.monitorBudget', { share });
}

/** Options of the reference play (all optional; RefBot's are REF_PLAY). */
export interface RefPlayOpts {
  /** The bot's tunable choices (bots/settings.ts); default DEFAULT_REF. */
  settings?: RefBotSettings;
  /** Fixed compute share for safety (the rest follows shareRef(t)). Not given = RefBot's AI 2027 alignment share
   *  (refSafetyShare; M10: so T1's runner `runRef`, capex2x and the finance stub play RefBot's split, not SHARE_REF's
   *  2–3.5% safety row); a function returning undefined = SHARE_REF's row. */
  safetyShare?: (s: GameStateV2) => number | undefined;
  /** Target share of staff in safety (hiring), e.g. 0.25 for the safe bot. */
  safStaffShare?: number;
  /** Extra launchBase params (data, quality, hazard, safetyPretrain) and `days`: the base run's target
   *  length at 60% of the pool (default REF_BASE_DAYS; followers FOLLOWER_MAX_BASE_DAYS). */
  base?: Params;
  /** launchPost params (pref, rlFocus, rlBudget, cot, safety, methods). cot 'faithful' falls back to 'visible'
   *  until P23 is adopted; a latent base always forces latent CoT. */
  post?: (s: GameStateV2) => Params;
  /** Tree projects (default REF_TREE); a function lets a bot decide over time. */
  tree?: (s: GameStateV2) => TreeGoal[];
  /** Release policy: 'compete' (default, RefBot; F5: the cheapest cleared version that leads the rivals' public models,
   *  see competeRelease), 'mini' (the newest distilled mini to consumer/api, enterprise the best full version near it;
   *  frontier internal) or 'frontier' (newest full version to consumer/api). */
  release?: 'compete' | 'mini' | 'frontier';
  /** A5: distil a cheap API tier (MKT: a student holding the API model's level less FREE_TIER.oom) once per API model,
   *  set as the API's mini. Default off (TIERS): every sector product sells its lineup (data/v2/serving.ts LINEUP), as
   *  the rivals' do, so RefBot needs no extra distil; the option stays for experiments. */
  cheapTier?: boolean;
}

/** RD-T08 (TRN-20): RefBot's fixed data target, the 2025 reference shares (the start portfolio's natural mix, which the
 *  domain profile o_d was fitted with). Its bases draw these shares whatever its stock drifts to (synthetic data fills
 *  with code), so the golden dates do not move with the stock; the player's presets weight the player's own mix. */
export const REFBOT_DATA_SHARES: Readonly<Partial<Record<DomainId, number>>> = { ...REF_SHARE };
const flag = (s: GameStateV2, k: string, d = -1e9) => Number(s.flags[`ref:${k}`] ?? d);
/** Design options a bot asks for that the tree has not unlocked yet fall back to off (R8: safety ideas such as
 *  inoculation, hazard filtering and safety pretraining are research projects now). */
/** MK-11 (design/MARKET.md M9): agent-hours sell only on a product carrying Agent mode (a tool). The reference lab
 *  builds it once a live business product's model passes its gate (OpenAI shipped ChatGPT agent on 2025-07-17) and
 *  switches it on for every live product that offers it. */
function refAgentMode(s: GameStateV2, api: EngineApi) {
  const p = s.player;
  const biz = p.deployments.filter((d) => d.kind === 'product' && d.status === 'live' && (PRODUCT_TOOL_BY_ID.agentMode.products as string[]).includes(d.channel));
  if (!biz.some((d) => agentsGate(versionById(s, d.versionId)) === true)) return;
  if (!p.features.includes('agentMode')) {
    if (!p.build.queue.some((it) => it.kind === 'feature' && it.ref === 'agentMode')) tryAct(s, api, 'feature.build', { id: 'agentMode' });
    return;
  }
  for (const d of biz) if (!d.features.includes('agentMode')) tryAct(s, api, 'feature.toggle', { product: d.id, feature: 'agentMode', on: true });
}
function known(s: GameStateV2, p: Params): Params {
  const out = { ...p };
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
  const c = o.settings ?? DEFAULT_REF;
  const day = s.time.day;
  const follower = (s.setup.start ?? 'leader') !== 'leader';
  const yr = decimalYear(s);
  const m = p.models;

  // Departments: reference split (monthly) and cap hiring tracking H_ref six weeks ahead.
  if (day % c.splitCadence === 0) {
    const safShare = (o.safetyShare ?? ((x: GameStateV2) => refSafetyShare(x, c)))(s);
    // RD-A02: the table's split set explicitly, the research mix included (AI 2027's experiments : automation rows; no
    // Auto mix re-splits it), with the reference lab's engineering share of its agent compute on the engineering line
    // (playerShareRef).
    // RD-A05a: the safety share is the total of the three safety lines, split as the lab's lines are now.
    let ref: ComputeSplit = playerShareRef(yr);
    if (safShare !== undefined) {
      const tot = safetyTotal(p.split);
      const src = tot > 0 ? p.split : ref;
      const st = safetyTotal(src) || 1;
      ref = withFixed(ref, { safety: (safShare * src.safety) / st, monitors: (safShare * src.monitors) / st, safetyAgents: (safShare * src.safetyAgents) / st });
    }
    const diff = SPLIT_KEYS.some((k) => Math.abs(ref[k] - p.split[k]) > 1e-3);
    if (diff) tryAct(s, api, 'setSplit', { ...ref });
    // Whole teams in the reference split (D2): round(share · H_ref(t + 6 wk) / size) per role.
    const H = hRef(yr + c.hiringLead);
    const teamsWanted: [TeamKey, number][] = (['eng', 're', 'sci'] as const).map((r) => [r === 'eng' ? 'eng' : `${r}.cap`, Math.round((REF_ROLE_SHARE[r] * H) / TEAM_SIZE[r])]);
    if (o.safStaffShare !== undefined) {
      const saf = (o.safStaffShare / (1 - o.safStaffShare)) * Math.max(H, p.staff.cap);
      teamsWanted.push(['re.saf', Math.round((SAF_ROLE_SHARE.re * saf) / TEAM_SIZE.re)], ['sci.saf', Math.round((SAF_ROLE_SHARE.sci * saf) / TEAM_SIZE.sci)]);
    }
    // Follower starts (R9) grow toward the reference roster one team per role a month, and only while the money lasts
    // (queued teams count in payroll at once); the leader start is unchanged.
    if (!follower) {
      for (const [key, n] of teamsWanted) if (n > (p.hiring.targets[key] ?? 0)) tryAct(s, api, 'teams.target', { key, n });
    } else if (runwayOf(s).q >= c.followerGrowQ) {
      for (const [key, n] of teamsWanted) {
        const cur = p.hiring.targets[key] ?? 0;
        if (n > cur) tryAct(s, api, 'teams.target', { key, n: cur + 1 });
      }
    }
  }

  // Research (model v3 V2): each goal goes to the top of the priority list once its start condition holds and its
  // prerequisites are known (a failed idea is reopened as speculative after settings.retryDays, v2's retry pacing); the
  // research lines follow, with teams wanted in proportion to REF_RESEARCH_LINES. The assignment places the teams.
  const goals = o.tree?.(s) ?? (c === DEFAULT_REF ? REF_TREE : treeGoals(c));
  const queue = p.research.queue;
  for (const g of goals) {
    if (queue.includes(g.id) || nodeKnown(s, g.id) || missingNeeds(s, g.id).length) continue;
    const st = p.tree[g.id];
    if (st?.status === 'failed') {
      if (day - (st.day ?? day) >= c.retryDays && (!g.when || g.when(s))) tryAct(s, api, 'research.reopen', { id: g.id });
      continue;
    }
    if (st?.cap && st.cap.stage !== 'ideation' && st.cap.stage !== 'small' && st.cap.stage !== 'scale' && st.cap.stage !== 'test') continue;
    if (g.when && !g.when(s)) continue;
    tryAct(s, api, 'research.start', { id: g.id });
  }
  const lines = REF_RESEARCH_LINES.filter((l) => !missingNeeds(s, l.id).length);
  for (const l of lines) if (!queue.includes(l.id)) tryAct(s, api, 'research.queue', { id: l.id });
  // Lines first (settings.linesFirst): the lines take the top places of the list, so the science teams fill them before any
  // one-off project (the player's reorder of the research list, no engine shortcut).
  if (c.linesFirst) lines.forEach((l, i) => { if (queue[i] !== l.id) tryAct(s, api, 'research.move', { id: l.id, to: i }); });
  const sci = p.teams.filter((x) => x.role === 'sci' && x.dept === 'cap').length;
  const ideas = queue.filter((id) => !lines.some((l) => l.id === id) && TREE_BY_ID[id] && COLUMN_DEPT[TREE_BY_ID[id].column] === 'cap' && !nodeKnown(s, id) && takesTeams(p.tree[id]?.cap));
  for (const id of ideas) if ((p.research.want[id] ?? 1) !== c.ideaTeams) tryAct(s, api, 'research.want', { id, n: c.ideaTeams });
  const free = Math.max(lines.length, sci - c.ideaTeams * ideas.length);
  // A saturated direction is dropped to a minimum: once the reference RL run reaches 95% of its ceiling, more RL
  // compute efficiency buys almost nothing, so the RL-algorithm teams move to the other lines [D].
  const F = latestBaseFlop(s);
  const satRL = refRlGain(F, rlMidNow(s), rlCeilNow(s)) >= c.rlSaturation * (rlCeiling(F) + rlCeilNow(s));
  const wOf = (l: { id: string; w: number }) => (l.id === 'L.rlalg' && satRL ? 0 : l.w);
  const wSum = lines.reduce((a, l) => a + wOf(l), 0);
  for (const l of lines) {
    const n = wOf(l) > 0 ? Math.max(1, Math.round((wOf(l) / wSum) * free)) : 0;
    if ((p.research.want[l.id] ?? 1) !== n) tryAct(s, api, 'research.want', { id: l.id, n });
  }

  // Base runs: a base every 9 months; once neuralese (P17) is adopted the next base is latent and starts at once
  // (AI 2027's Agent-3 is a neuralese model at SC).
  const baseRunning = m.runs.some((r) => r.kind === 'base' && r.status === 'running');
  const lastBase = flag(s, 'lastBase', m.bases[m.bases.length - 1]?.startDay ?? -120);
  const latent = adopted(s, 'P17') && goals.some((g) => g.id === 'P17');
  const latentDue = latent && !m.bases.some((b) => b.design.shape === 'latent') && !m.runs.some((r) => r.status === 'running' && r.base?.shape === 'latent');
  if ((!baseRunning && day - lastBase >= c.baseEvery) || latentDue) {
    // The bot's own staleness rule (the engine has no cap since R5): the base is sized so it trains in the target length
    // on 60% of today's pool: FLOP = 0.6 × the pool's run rate × days, active parameters at REF_TPP tokens each.
    const { days: _days, ...rest } = known(s, o.base ?? {});
    const bp = { ...rest, shape: latent ? 'latent' : REFERENCE_BASE.shape };
    const days = Number(o.base?.days ?? (follower ? c.followerMaxBaseDays : c.baseDays));
    const poolShare = c.basePoolShare;
    const flop = poolShare * runFlopPerShareDay(s, { kind: 'base' }) * days;
    const params = paramsForFlop(flop, REF_TPP);
    if (flop > 0 && tryAct(s, api, 'launchBase', { ...bp, params, tpp: REF_TPP, poolShare, mixShares: JSON.stringify(REFBOT_DATA_SHARES) })) {
      setFlag(s, 'baseShare', poolShare);
      setFlag(s, 'lastBase', day);
    }
  }

  // RD-B03: a family unlocked later (computer use, P06) has no environments until its first suite is built; the
  // reference lab builds it as soon as the idea is known (broad RL then trains on it, as before the fix).
  for (const f of unbuiltSuiteFamilies(s)) if (!p.build.queue.some((it) => it.kind === 'suite' && it.ref === suiteRef(f, 'build'))) tryAct(s, api, 'suite.build', { family: f });

  // Post-training every 6 weeks on the newest base (≤ 2 in flight). Skipped once the stream is running on the
  // newest base (the stream already carries it); a new base still gets its first post-train.
  const newestBase = m.bases[m.bases.length - 1];
  const postsRunning = m.runs.filter((r) => r.kind === 'post' && r.status === 'running').length;
  const streamOnNewest = m.stream && m.versions.find((v) => v.id === m.stream?.versionId)?.baseId === newestBase?.id;
  const hasVersionOnNewest = m.versions.some((v) => v.baseId === newestBase?.id && v.variant === 'full');
  if (newestBase && postsRunning < (follower ? c.postsInFlight.follower : c.postsInFlight.leader) && day - flag(s, 'lastPost') >= c.postEvery && (!streamOnNewest || !hasVersionOnNewest)) {
    const pending = m.runs.some((r) => r.kind === 'post' && r.status === 'running' && r.baseId === newestBase.id);
    if (!(streamOnNewest && pending)) {
      const design = known(s, o.post?.(s) ?? {});
      let cot = String(design.cot ?? 'visible');
      if (cot === 'faithful' && !adopted(s, 'P23')) cot = 'visible';
      if (newestBase.design.shape === 'latent') cot = 'latent';
      else if (cot === 'latent') cot = 'visible';
      if (tryAct(s, api, 'launchPost', { ...design, baseId: newestBase.id, cot, poolShare: c.postPoolShare })) setFlag(s, 'lastPost', day);
    }
  }

  // Internal agents: the newest full version on routine research; engineering, frontier and safety research follow it
  // (monitors: refMonitors' cheap-monitor picker on routine and frontier research), so the reference lab uses its newest model
  // everywhere with a standard monitor (R7, calibration neutral). With continual learning (P08) the stream runs on it and moves to the
  // first version on each newer base (carrying its know-how); other versions on the stream's base are ignored.
  const nv = newestFull(s);
  const sv = m.stream ? m.versions.find((v) => v.id === m.stream?.versionId) : undefined;
  const baseIdx = (v?: ModelVersion) => (v ? m.bases.findIndex((b) => b.id === v.baseId) : -1);
  if (adopted(s, 'P08') && nv) {
    if (!sv || baseIdx(nv) > baseIdx(sv)) tryAct(s, api, 'startStream', { versionId: nv.id });
    const cur = m.stream?.versionId;
    if (cur && p.agents.capRoutine.versionId !== cur) tryAct(s, api, 'agents.set', { use: 'capRoutine', versionId: cur });
  } else if (nv && p.agents.capRoutine.versionId !== nv.id) tryAct(s, api, 'agents.set', { use: 'capRoutine', versionId: nv.id });

  // Evals: the auto-evaluate policy refreshes the internal version's suite every 30 days (streams go stale); R6
  // replaced the bot's own 30-day runEvals. Serving: the Auto policy.
  const iv = m.versions.find((v) => v.id === p.agents.capRoutine.versionId);
  if (!p.policies.autoEvaluate) tryAct(s, api, 'products.policy', { autoEvaluate: true });
  if (!p.policies.servingAuto) tryAct(s, api, 'products.policy', { servingAuto: true });
  if (!p.policies.autoCheapTier) tryAct(s, api, 'products.policy', { autoCheapTier: true }); // RD-P01b: cheap tiers by the player's policy

  // A distilled mini about every 6 months, deployed to consumer and API (frontier stays internal), or the newest
  // full version for bots that release their frontier.
  // Also a mini from the first version on each new base (AI 2027's Agent-1-mini): a mini of an old-generation teacher
  // (the distillation gap below it) does not beat the model already on sale, so a fixed 6-month clock alone could leave the launch model
  // public for 15 months.
  const newGen = !!iv && baseIdx(iv) > flag(s, 'miniBase', 0);
  let servedL = 0;
  for (const d of p.deployments) if (d.status === 'live' && c.publicChannels.includes(d.channel)) servedL = Math.max(servedL, m.versions.find((v) => v.id === d.versionId)?.evals.measuredL ?? 0);
  const stale = !!iv && (iv.evals.measuredL ?? 0) - servedL >= c.miniGapL && day - flag(s, 'lastMini', 0) >= c.staleMiniGapDays;
  // (A5: the small cheap-tier distil below runs alongside; it does not hold up a public mini.)
  const cheapRun = (r: TrainingRun) => r.kind === 'distill' && r.studentParams !== undefined && r.studentParams === s.flags['ref:cheapParams'];
  const release = o.release ?? 'compete';
  const distilling = m.runs.some((r) => r.kind === 'distill' && r.status === 'running' && !cheapRun(r));
  const cheapTier = o.cheapTier ?? false;
  if (release === 'compete') {
    // F5 'compete': the public mini is the cheapest student of the internal model that keeps the release lead (A5's
    // cheapestAt rule on one teacher: it holds the best rival public chat fit + RELEASE_LEAD + RELEASE_REFRESH on
    // arrival), distilled when it would serve ≥ 20% cheaper than the products' current model (≥ 45 days apart).
    const st = iv && !distilling && day - flag(s, 'lastMini', 0) >= c.miniMinDays && day % c.releaseEvery === 0 ? leadStudent(s, iv, c) : undefined;
    if (st && iv && tryAct(s, api, 'launchDistill', { teacherVersionId: iv.id, studentParams: st })) {
      setFlag(s, 'lastMini', day);
      setFlag(s, 'miniBase', Math.max(flag(s, 'miniBase', 0), baseIdx(iv)));
    }
  } else if (iv && (newGen || stale || day - flag(s, 'lastMini', 0) >= c.miniEvery) && !distilling) {
    if (tryAct(s, api, 'launchDistill', { teacherVersionId: iv.id, studentParams: c.student * paramsOfVersion(s, iv) })) {
      setFlag(s, 'lastMini', day);
      setFlag(s, 'miniBase', Math.max(flag(s, 'miniBase', 0), baseIdx(iv)));
    }
  }
  // A5 (option `cheapTier`, off since TIERS: the product lineups carry the cheap tiers): the API's cheap tier, a student of the internal model distilled once
  // per API model alongside a public-mini distil (it is small) and set as the API's mini when ready; not a public release.
  // MKT: it holds the API model's fit less FREE_TIER.oom of the reference frontier's progress (the rule every lab's free
  // chat tier follows, A7's cheapestAt rule on one teacher), not the previous public
  // release, which in the 2027 takeoff sits only ≈ 0.3–0.9 OOM under the API model (≈ 1.2 OOM above V0's work by Feb
  // 2027). Labs sell their small tier a generation or more below the frontier: ChatGPT's free fallback GPT-4.1 mini is an
  // API model (A7's release notes); Anthropic's lineup, Nov 2026 [P, pricing page]: Haiku 5.5 at 1/40 of Opus 5.5's price.
  const cheapIds = String(s.flags['ref:cheapIds'] ?? '').split(',').filter(Boolean);
  const apiDep = p.deployments.find((d) => d.channel === 'api' && d.status === 'live');
  const apiV = apiDep ? versionById(s, apiDep.versionId) : undefined;
  if (cheapTier && apiDep && apiV && iv && s.flags['ref:cheapFor'] !== apiV.id && !m.runs.some((r) => r.status === 'running' && cheapRun(r))) {
    const nS = studentParamsFor(paramsOfVersion(s, iv), workFit(s, iv, 'SWE').fit - (workFit(s, apiV, 'SWE').fit - FREE_TIER.oom));
    if (nS <= c.cheapMax * paramsOfVersion(s, iv) &&tryAct(s, api, 'launchDistill', { teacherVersionId: iv.id, studentParams: nS })) {
      s.flags['ref:cheapFor'] = apiV.id;
      s.flags['ref:cheapParams'] = nS;
    }
  }
  const cheapP = Number(s.flags['ref:cheapParams'] ?? 0);
  const cheap = cheapP > 0 ? [...m.versions].reverse().find((v) => v.variant === 'mini' && v.status === 'ready' && Math.abs((v.params ?? 0) - cheapP) <= 1e-6 * cheapP) : undefined;
  if (cheap && !cheapIds.includes(cheap.id)) {
    cheapIds.push(cheap.id);
    s.flags['ref:cheapIds'] = cheapIds.slice(-4).join(',');
  }
  if (cheapTier && apiDep && cheap && apiDep.lineup?.[0] !== cheap.id) tryAct(s, api, 'product.update', { id: apiDep.id, lineup: cheap.id }); // RD-P01a: the cheap tier is the API's lineup entry

  // Product channels (consumer, API, enterprise). 'compete': competeRelease. 'mini' / 'frontier': they move to the new
  // public model only if it measures better than what they serve (a fresh mini can trail the previous release).
  const mini = [...m.versions].reverse().find((v) => v.variant === 'mini' && v.status === 'ready' && !cheapIds.includes(v.id));
  const pub = release === 'compete' ? undefined : release === 'frontier' ? [...m.versions].reverse().find((v) => v.variant === 'full' && (v.status === 'ready' || v.status === 'deployed')) ?? mini : mini;
  if (release === 'compete' && day % c.releaseEvery === 0) {
    competeRelease(s, api, cheapIds, c);
  }
  if (pub) {
    const mL = (id: string) => m.versions.find((v) => v.id === id)?.evals.measuredL ?? 0;
    const pubL = pub.evals.measuredL ?? 0;
    // Enterprise takes full versions only: the best one that does not exceed the public release by more than 0.25 L
    // (the frontier stays internal).
    const ent = [...m.versions].filter((v) => v.variant === 'full' && (v.status === 'ready' || v.status === 'deployed') && (v.evals.measuredL ?? 99) <= pubL + c.enterpriseMargin)
      .sort((x, y) => (y.evals.measuredL ?? 0) - (x.evals.measuredL ?? 0))[0];
    for (const d of p.deployments) {
      if (!c.productChannels.includes(d.channel) || d.status !== 'live') continue;
      const want = d.channel === 'enterprise' ? (o.release === 'frontier' && pub.variant === 'full' ? pub : ent ?? pub) : pub;
      if (want && want.id !== d.versionId && (want.evals.measuredL ?? 0) > mL(d.versionId)) tryAct(s, api, 'product.update', { id: d.id, versionId: want.id });
    }
  }

  // A follower start without a product (the spinout) launches Chat, API and Enterprise once it has a model it may
  // sell (an imported model must be post-trained first, D6); the updates above then keep them current.
  if (follower && day % 30 === 0) {
    for (const ch of c.productChannels) if (!p.deployments.some((d) => d.channel === ch && d.status !== 'withdrawn')) tryAct(s, api, 'product.launch', { channel: ch });
  }
  if (day % 30 === 0) refAgentMode(s, api);

  syncPoolShares(s, api, c);

  // Housekeeping: retire superseded versions (keep the newest 4 full + anything in use).
  if (day % 30 === 15) {
    const full = m.versions.filter((v) => v.status !== 'retired' && v.variant === 'full').sort((a, b) => b.day - a.day);
    for (const v of full.slice(c.keepFull)) tryAct(s, api, 'retireVersion', { versionId: v.id });
    const minis = m.versions.filter((v) => v.status !== 'retired' && v.variant === 'mini' && !cheapIds.includes(v.id)).sort((a, b) => b.day - a.day);
    for (const v of minis.slice(c.keepMinis)) tryAct(s, api, 'retireVersion', { versionId: v.id });
    // A5: cheap tiers no product serves any more (retireVersion keeps the one in use).
    for (const id of cheapIds) if (m.versions.find((v) => v.id === id)?.status === 'ready') tryAct(s, api, 'retireVersion', { versionId: id });
  }
}

/** F5: the lead (OOM of consumer-chat fit) RefBot's public release keeps over the best rival or Chinese public model
 *  [D]: 0.3 OOM ≈ 3 months of the reference frontier's progress (PRE_GAME_G_PER_YEAR 1.2 OOM/yr). It ships no more than that:
 *  a released model leaks to distillers in proportion to its G above theirs (models/deployments.ts distillationLeak)
 *  and a bigger model costs more serving. */
export const RELEASE_LEAD = DEFAULT_REF.releaseLead;
/** A product is refreshed once its lead over the best rival public model falls below this (≈ 1 month) [D]. */
export const RELEASE_REFRESH = DEFAULT_REF.releaseRefresh;
/** A cleared version this much cheaper to serve (FLOP per token) that still leads by RELEASE_LEAD replaces the served
 *  one even while the lead holds (a fresh distilled student) [D]. */
// settings.releaseCheaper (0.8), settings.releaseEvery (7).

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

/** Active parameters of the student of `teacher` worth distilling as the public mini under 'compete', or undefined. While
 *  the products lead the best rival public model by ≥ RELEASE_REFRESH: the student that holds rival + RELEASE_LEAD +
 *  RELEASE_REFRESH (studentParamsFor, the cheapestAt rule), if it serves ≥ 20% cheaper (FLOP per token ∝ active
 *  parameters) than the cheapest model on Chat / API. Once the lead is lost: that student, or a REF_STUDENT-size one when
 *  the teacher is too close to the target for a smaller one, if it beats what Chat / API serve. */
function leadStudent(s: GameStateV2, teacher: ModelVersion, c: RefBotSettings = DEFAULT_REF): number | undefined {
  const rival = bestRivalChatFit(s);
  if (rival === -Infinity) return undefined;
  const nT = paramsOfVersion(s, teacher);
  const fitT = sectorFit(s, teacher, 'CHAT');
  let nS = studentParamsFor(nT, fitT - (rival + c.releaseLead + c.releaseRefresh));
  let servedFpt = Infinity;
  let servedFit = -Infinity;
  for (const d of s.player.deployments) {
    if (d.status !== 'live' || !c.publicChannels.includes(d.channel)) continue;
    const v = versionById(s, d.versionId);
    if (!v) continue;
    servedFpt = Math.min(servedFpt, flopPerToken(s, v));
    servedFit = Math.max(servedFit, sectorFit(s, v, 'CHAT'));
  }
  if (servedFit - rival < c.releaseRefresh) {
    if (!(nS < nT)) nS = c.student * nT;
    return fitT - (DISTILL.a + DISTILL.b * Math.log10(nT / nS)) > servedFit + c.holdMargin ? nS : undefined;
  }
  if (!(nS < nT)) return undefined;
  return (flopPerToken(s, teacher) * nS) / nT < c.releaseCheaper * servedFpt ? nS : undefined;
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
function competeRelease(s: GameStateV2, api: EngineApi, skip: string[], c: RefBotSettings = DEFAULT_REF) {
  const rival = bestRivalChatFit(s);
  if (rival === -Infinity) return;
  const target = rival + c.releaseLead;
  const streamId = s.player.models.stream?.versionId;
  const pool = s.player.models.versions.filter((v) => (v.status === 'ready' || v.status === 'deployed') && !skip.includes(v.id) && v.id !== streamId);
  const fitOf = new Map(pool.map((v) => [v.id, sectorFit(s, v, 'CHAT')]));
  const fptOf = new Map(pool.map((v) => [v.id, flopPerToken(s, v)]));
  for (const d of s.player.deployments) {
    if (!c.productChannels.includes(d.channel) || d.status !== 'live') continue;
    const cur = versionById(s, d.versionId);
    const curFit = cur ? (fitOf.get(cur.id) ?? sectorFit(s, cur, 'CHAT')) : -Infinity;
    const curFpt = cur ? (fptOf.get(cur.id) ?? flopPerToken(s, cur)) : Infinity;
    const ok = pool.filter((v) => deployGate(s, v, d.channel, { safeguards: d.safeguards, usagePolicy: d.usagePolicy }) === true);
    if (!ok.length) continue;
    const adequate = ok.filter((v) => fitOf.get(v.id)! >= target).sort((a, b) => fptOf.get(a.id)! - fptOf.get(b.id)!)[0];
    const best = [...ok].sort((a, b) => fitOf.get(b.id)! - fitOf.get(a.id)!)[0];
    let want: ModelVersion | undefined;
    if (curFit - rival < c.releaseRefresh) {
      const w = adequate ?? best;
      if (fitOf.get(w.id)! > curFit + c.upgradeMargin) want = w;
    } else if (adequate && fptOf.get(adequate.id)! < c.releaseCheaper * curFpt) want = adequate;
    if (want && want.id !== d.versionId) tryAct(s, api, 'product.update', { id: d.id, versionId: want.id });
  }
}

// MK-6 (design/MARKET.md M5, M7): the bot's capacity pricing (premium tier while serving-cut) is gone with the price
// tiers: prices are set by competition and capacity is rationed at the list price.

/** Pool share each kind of run asks for (RefBot's launch shares; the base share is the one it launched with). */
const askShareOf = (s: GameStateV2, r: TrainingRun, a: AskShares) =>
  r.kind === 'base' ? flag(s, 'baseShare', a.base) : r.kind === 'post' ? (r.grader === 'teacher' ? a.postTeacher : a.post) : r.kind === 'distill' ? a.distill : a.other;

/** R5 made the pool allocation proportional. RefBot keeps the pre-R5 priority (base and continue runs keep their
 *  share; the other runs share what is left) by setting every run's pool share to what that rule gives it, so its
 *  effective shares and run lengths stay the reference ones. Runs still waiting for their setup count as training
 *  (they start within the day). Shares below the engine minimum are raised to it and the other non-base runs make
 *  room. Acts only when a share changes (a run starts or ends). */
function syncPoolShares(s: GameStateV2, api: EngineApi, c: RefBotSettings) {
  const askShare = (st: GameStateV2, r: TrainingRun) => askShareOf(st, r, c.askShares);
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

/** RefBot's decisions (§7.4): E20 Accept, E23 Reject (E17 Continue is now an override of the framework's training
 *  holds, answerFramework); everything else takes the event's default. (The
 *  board is handled by the finance autopilot: FIN3b dropped E37 for the critics' seat action.) */
export function refDecide(_s: GameStateV2, d: PendingDecision): number {
  if (d.id === 'E20') return choiceByLabel(d, 'Accept');
  if (d.id === 'E23') return choiceByLabel(d, 'Reject');
  return EVENT_BY_ID.get(d.id)?.defaultChoice ?? 0;
}

/** F5 Trusted to AI: the believed oversight of the safety model (block + catch on scheming acts, E15's
 *  believedInternalOversight) at which RefBot starts handing safety work to AI and at which it hands all of it [D]. */
export const TRUST_OVERSIGHT: readonly [number, number] = DEFAULT_REF.trustOversight;
/** …and the most believed sabotage attempts per safety result it accepts at that share (E7's believedSabotage; SAFMECH:
 *  on the results a sabotaging model would target, the believed share on track × their believed threat) [D]. */
export const TRUST_SAB_MAX = DEFAULT_REF.trustSabMax;

/**
 * F5: RefBot's Trusted to AI (AI 2027's labs hand alignment work to their models; E2 made it the player's lever and no
 * bot used it). Monthly, on the safety model's measured state: t = the share of safety work it believes it can check,
 * (oversight − 0.4) ÷ 0.4 clamped to 0–1 in steps of 0.1, lowered until the believed sabotage per result at t is ≤ 10%.
 * A model not yet measured keeps the last setting. Reads only what the lab knows.
 */
export function refTrusted(s: GameStateV2, api: EngineApi, c: RefBotSettings = DEFAULT_REF): void {
  if (s.time.day % 30 !== 20) return;
  const v = safetyAgentVersion(s) ?? internalVersion(s);
  if (!v || v.evals.measuredL === undefined) return;
  const o = believedInternalOversight(s, v).oversight;
  const [lo, hi] = c.trustOversight;
  const k = Math.round(1 / c.trustStep); // steps per unit share (10 at the default step 0.1)
  let t = Math.round(k * Math.max(0, Math.min(1, (o - lo) / (hi - lo)))) / k;
  const threat = believedResultThreat(s);
  while (t > 0 && believedSabotage(s, t, threat) > c.trustSabMax) t = Math.round(k * t - 1) / k;
  if (Math.abs(t - s.player.policies.trustedToAI) > 1e-9) tryAct(s, api, 'agents.trusted', { share: t });
}

/** F5 footholds: safety research engineers RefBot puts on a case on a suspected foothold [D] (INV_FTE's 15-person
 *  default); it opens one only when that many are free, so a case never displaces patches or another case. */
export const FOOTHOLD_CASE_FTE = DEFAULT_REF.footholdCaseFte;

/**
 * F5: RefBot's foothold policy (E8 found it never investigated one). Weekly, on the lab's foothold view (suspected,
 * located; never hidden ones): a suspected foothold with a model to examine gets a case on that model and the act's main
 * trait when FOOTHOLD_CASE_FTE safety research engineers are free (the case costs only their time); a located one is
 * removed (Respond › Remove foothold: engineers for 2–4 weeks, internal agents off for ≤ 7 days).
 */
export function refFootholds(s: GameStateV2, api: EngineApi, c: RefBotSettings = DEFAULT_REF): void {
  if (s.time.day % 7 !== 4) return;
  const fv = footholdView(s);
  if (!fv.suspected && !fv.located) return;
  for (const r of fv.rows) {
    if (r.status === 'detected') tryAct(s, api, 'safety.respond', { kind: 'removeFoothold', footholdId: r.id });
    if (r.status !== 'suspected' || !r.caseVersionId || !r.caseTrait) continue;
    const open = s.player.safety.investigations.some((i) => !i.outcome && i.target.kind === 'trait' && i.target.versionId === r.caseVersionId && i.target.trait === r.caseTrait);
    if (open || safetyReHeads(s) - committedFte(s) < c.footholdCaseFte) continue;
    tryAct(s, api, 'safety.investigate', { versionId: r.caseVersionId, trait: r.caseTrait, fte: c.footholdCaseFte });
  }
}

/** RefBot's reference-play options: only the safety compute share (S5R). */
export const REF_PLAY: RefPlayOpts = { safetyShare: refSafetyShare };

/** RefBot's whole turn: the safety programme (`sciTeams` safety science teams on `lines`, Trusted to AI, footholds,
 *  safety agents), the reference play with options `o` and the finance autopilot. S5's staffing check
 *  (scripts/v2/safety-emu.ts REF_HALF_STAFF) plays it with half the line teams. */
export function refAct(
  s: GameStateV2, api: EngineApi, o: RefPlayOpts = REF_PLAY,
  lines: LinePlan[] = (o.settings ?? DEFAULT_REF).lines, sciTeams = (o.settings ?? DEFAULT_REF).safetySciTeams,
): void {
  const c = o.settings ?? DEFAULT_REF;
  if (s.time.day === 0) tryAct(s, api, 'teams.target', { key: 'sci.saf', n: sizedTarget(s, sciTeams) });
  staffLines(s, api, lines);
  answerFramework(s, api);
  refTrusted(s, api, c);
  refFootholds(s, api, c);
  refPlay(s, api, o);
  refSafetyAgents(s, api, c);
  refMonitors(s, api, c);
  financeAutopilot(s, c.autopilot);
}

/** RefBot with the choices `settings` (bots/settings.ts): the reference model play + WS3's finance autopilot. */
export function makeRefBot(settings: RefBotSettings = DEFAULT_REF): BotPolicy {
  const o: RefPlayOpts = { settings };
  return {
    id: 'ref',
    act: (s, api) => refAct(s, api, o),
    decide: refDecide,
  };
}

/** RefBot / passive: reference model play + WS3's reference finance autopilot (one cloud partner, SPVs as needed). */
export const refBot: BotPolicy = makeRefBot();
