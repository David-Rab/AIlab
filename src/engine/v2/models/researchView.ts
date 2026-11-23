// Read-only views of the model v3 research system for the UI (V2b: design/V3-BUILD.md "V2b UI"). Owner: WS1.
// Everything here is what the player's lab knows: beliefs, its own allocations and inputs, its recipe as built, the
// preset's public reference points. Candidate truths (models/research.ts candidateTruth) are never read; an adopted
// idea's realised value is shown only once a model trained after its adoption has been evaluated.
import { DEFAULT_ENG_ALLOC, ENG_NEED_LABEL, MAX_DROPS, PICK_AT, PROJECT_MAX_TEAMS, RE_NEED_LABEL, DEFAULT_SAF_RE_ALLOC, SAF_RE_NEED_LABEL, STACK_LABEL, STACK_UNIT, EMBODIED_BY, EMBODIED_TEXT, type EmbodiedBy } from '../../../data/v2/research';
import { COGNITIVE_WORK, MILESTONE_COVER, WORK_TYPES, type WorkTypeId } from '../../../data/v2/workTypes';
import { E_START } from '../../../data/v2/runDesign';
import { COLUMN_LABEL } from '../../../data/v2/teams';
import { PROJECT_BY_ID, TREE, type TreeNodeDef } from '../../../data/v2/tree';
import { labSpeedRel } from '../production/production';
import { believedElasticities } from '../production/believed';
import { production } from '../production/readout';
import { poolsOf } from '../compute/power';
import { buildCapacity } from '../departments/teams';
import { buildEtas, engAlloc, engDemand, upkeepSplit } from '../departments/build';
import {
  agentFpt, costPerWorkHour, pSuccess, researchMods, safetyLabour, speedOfCopy, workContext, workFit, type LabourOf, type LabourSlot,
} from '../departments/workfit';
import { agentVersion } from '../departments/agents';
import { MILESTONE_NAMES } from './capability';
import { versionById } from './labs';
import {
  allocate, attemptOdds, capEta, capReCapacity, isCapProject, isUnlockProject, linePool, poolMean, projectExpInputs, reAllocation, reDemand, sciOn, teamsWanted, wantIsAuto,
} from './research';
import { measuredSd } from './benchmarks';
import { latestBaseFlop, rlCeilNow, rlMidNow, STACK_KEYS, stackAt, trainNow } from './stacks';
import { nodeStatus, projectReady } from './tree';
import { safAllocation } from '../safety/lineProjects';
import type { AdoptedIdea, CapStage, GameStateV2, MilestoneIdx, ModelVersion, ReNeed, SafReNeed, EngNeed, StackKey, Team } from '../types';

// ───────────────────────────── projects ─────────────────────────────

/** The four steps of a project's life the player sees (MODEL-V3 §5.3; RD-R07: no zero-length result step): ideas, small
 *  test, big (scale) test, build-in (adoption by the engineers). */
export const STAGES = ['ideation', 'small', 'scale', 'adoption'] as const;
/** RD-R05: an unlock project's two steps: one "does it work" test, then the build-in. */
export const UNLOCK_STAGES = ['test', 'adoption'] as const;
export type StageId = (typeof STAGES)[number] | (typeof UNLOCK_STAGES)[number];

export interface ProjectTeamView { id: string; specialty?: string; quality: Team['quality']; heads: number; match: boolean; why: string }
export interface CapProjectView {
  id: string;
  name: string;
  kind: 'line' | 'idea' | 'axis';
  column: string;
  area: string;
  /** Stack the effect enters, or a domain effect / an unlock. */
  stack?: StackKey;
  unit: 'oom' | 'design' | 'unlock';
  /** RD-R05: an unlock project (one works / doesn't test: no candidates, no effect band; stages UNLOCK_STAGES). */
  unlock: boolean;
  /** Where it is: waiting (not ready / no teams), a lifecycle stage, failed, known. */
  state: 'waiting' | 'running' | 'adopting' | 'failed' | 'known';
  stage: StageId;
  /** Share of the current stage done (0..1). */
  stageFrac: number;
  /** Why it waits (not ready), if it does. */
  wait?: string;
  /** Rank among the capability projects (1 = top), 0 if not on the list. */
  rank: number;
  want: number;
  /** B4: teams wanted is "auto" (the game picks by priority and fit); `want` is then the number placed. */
  auto: boolean;
  teams: ProjectTeamView[];
  /** Science capacity and taste on it (taste: a Strong team without AI = 1). */
  sciCap: number;
  taste: number;
  /** Candidates found and waiting, the number a team picks from. */
  cands: number;
  pickAt: number;
  /** Belief about the candidate in test (small-scale effect, project unit) and its scale exponent. */
  belief?: { mu: number; sd: number; sMu: number; sSd: number; nov: number; b: number; tested: boolean };
  /** A finished result's estimate at the lab's latest base. */
  result?: { est: number; estSd: number; day: number };
  /** Chance the direction works in this world (ideas and axes; 1 for lines). */
  odds: number;
  spec: number;
  drops: number;
  maxDrops: number;
  /** Research inputs today: research-engineer team-equivalents (human) on it, experiment FLOP per day, the project's
   *  experiment compute c and labour ℓ (leader day 0 = 1), its CES throughput X, and what binds it. */
  re: number;
  flopDay: number;
  c: number;
  l: number;
  X: number;
  /** BELIEVED elasticities of the experiment rate to compute and to research-engineer labour (what binds). RD-UI0a:
   *  from the published prior on the production parameters (production/believed.ts), never the hidden draw; the
   *  bands are the prior's 80% interval. */
  eC: number;
  eL: number;
  eCBand: [number, number];
  eLBand: [number, number];
  bound: 'compute' | 'labour' | 'none';
  /** Estimated days to the next result (lines) or to the result (ideas, axes), and its parts. Infinity = stalled. */
  eta: number;
  etaParts: { ideation: number; experiments: number };
  /** Lines: the pool (research input since the start over n₀), the line's realised OOM, the next idea's prior (OOM per
   *  idea at the taste of the teams on it), research input so far, ideas found, results waiting to be built in. */
  line?: { r: number; R: number; harder: number; realised: number; nextPrior: number; input: number; gen: number; pending: number };
  /** Adoption: engineers' team-weeks and days left. */
  adoption?: { tw: number; eta: number };
}

const node = (id: string): TreeNodeDef | undefined => PROJECT_BY_ID[id];
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Yesterday's experiment FLOP of a project (research.last.flopProj: its share of the FLOP available after evals, as
 *  models/research.ts capResearchDay / expShares); 0 when it got none or before the first day. */
const flopOfProject = (s: GameStateV2, id: string): number => s.player.research.last?.flopProj?.[id] ?? 0;

/** A capability project as the player sees it. */
export function capProjectView(s: GameStateV2, id: string): CapProjectView | undefined {
  const n = node(id);
  if (!n || !isCapProject(n)) return undefined;
  const p = s.player;
  const ts = p.tree[id];
  const st = ts?.cap;
  const capIds = p.research.queue.filter((x) => isCapProject(node(x)));
  const rank = capIds.indexOf(id) + 1;
  const known = nodeStatus(s, id) === 'known';
  const failed = ts?.status === 'failed';
  const ready = projectReady(s, id);
  const sci = sciOn(s, id);
  const teams: ProjectTeamView[] = p.teams.filter((t) => t.role === 'sci' && t.projectId === id).map((t) => ({
    id: t.id, ...(t.specialty ? { specialty: t.specialty } : {}), quality: t.quality, heads: t.heads, match: t.specialty === n.column, why: t.why ?? 'Placed by the assignment',
  }));
  // Stage.
  const unlock = isUnlockProject(n);
  let stage: StageId = unlock ? 'test' : 'ideation';
  let stageFrac = 0;
  if (st && unlock) {
    if (st.stage === 'adopting') stage = 'adoption';
    else stageFrac = st.trial && st.trial.workNeed > 0 ? Math.min(1, st.trial.work / st.trial.workNeed) : 0;
  } else if (st) {
    if (st.stage === 'small' || st.stage === 'scale') {
      stage = st.stage;
      stageFrac = st.test && st.test.workNeed > 0 ? Math.min(1, st.test.work / st.test.workNeed) : 0;
    } else if (st.stage === 'adopting') stage = 'adoption';
    else stageFrac = Math.min(1, (st.cands.length + st.idea) / PICK_AT);
  }
  if (n.kind === 'line' && st?.pending?.length && stage === 'ideation' && !st.test) stageFrac = Math.min(1, (st.cands.length + st.idea) / PICK_AT);
  const state: CapProjectView['state'] = known ? 'known' : failed ? 'failed' : st?.stage === 'adopting' ? 'adopting' : ready === true && (teams.length > 0 || !!st?.test || st?.stage === 'test') ? 'running' : 'waiting';
  // Inputs today.
  const flopDay = flopOfProject(s, id);
  // When it is not experimenting today, read the inputs it would get (RE_MAX_PER_PROJECT; FLOP by need, RD-B08).
  const { re, cc, l, X } = projectExpInputs(s, id);
  const el = believedElasticities(s, Math.max(1e-12, cc), l); // RD-UI0a: the published prior, never the hidden draw
  const bound: CapProjectView['bound'] = cc <= 0 ? 'none' : el.eC >= el.eL ? 'compute' : 'labour';
  // ETA (days): the one capability ETA (models/research.ts capEta), also used by the Assign / Take off previews.
  const { ideation, experiments } = state === 'running' || state === 'waiting' ? capEta(s, id, sci) : { ideation: 0, experiments: 0 };
  const builds = buildEtas(s).etas;
  let adoption: CapProjectView['adoption'];
  const bid = st?.result?.buildId ?? st?.trial?.buildId ?? st?.pending?.find((r) => r.buildId)?.buildId;
  if (bid) {
    const it = p.build.queue.find((q) => q.id === bid);
    if (it) adoption = { tw: Math.max(0, it.needTW - it.doneTW), eta: builds.get(bid) ?? Infinity };
  }
  const eta = state === 'adopting' ? (adoption?.eta ?? 0) : ideation + experiments;
  // Beliefs.
  const tc = unlock ? undefined : st?.test?.c;
  const belief = tc ? { mu: tc.mu, sd: tc.sd, sMu: tc.muS, sSd: tc.sdS, nov: tc.nov, b: tc.b, tested: st?.stage === 'scale' } : undefined;
  const res = unlock ? undefined : st?.result ?? st?.pending?.[st.pending.length - 1];
  // Lines: the pool.
  let line: CapProjectView['line'];
  if (n.kind === 'line') {
    const pl = linePool(s, n);
    const R = pl.n0 + (st?.pool ?? 0);
    line = {
      r: pl.r, R, harder: R / pl.n0, realised: pl.r * Math.log10(R / pl.n0), nextPrior: poolMean(pl, st?.pool ?? 0, sci.cap > 0 ? sci.q : 1, 1),
      input: st?.input ?? 0, gen: Math.max(0, (st?.gen ?? 1) - 1), pending: st?.pending?.length ?? 0,
    };
  }
  const eff = n.effect;
  return {
    id, name: n.name, kind: n.kind ?? 'idea', column: n.column, area: COLUMN_LABEL[n.column], ...(eff?.stack ? { stack: eff.stack } : {}),
    unit: eff?.stack ? 'oom' : eff?.domains || eff?.data ? 'design' : 'unlock', unlock,
    state, stage, stageFrac, ...(ready !== true && !known ? { wait: ready } : {}), rank, want: wantIsAuto(s, id) ? teams.length : teamsWanted(s, id), auto: wantIsAuto(s, id), teams,
    sciCap: sci.cap, taste: sci.q, cands: st?.cands.length ?? 0, pickAt: PICK_AT,
    ...(belief ? { belief } : {}), ...(res ? { result: { est: res.est, estSd: res.estSd, day: res.day } } : {}),
    odds: attemptOdds(n, (st?.spec ?? 0) + (failed ? 1 : 0)), spec: st?.spec ?? 0, drops: st?.drops ?? 0, maxDrops: n.kind === 'line' || unlock ? 0 : MAX_DROPS,
    re, flopDay, c: cc, l, X, eC: el.eC, eL: el.eL, eCBand: el.eCBand, eLBand: el.eLBand, bound, eta, etaParts: { ideation, experiments },
    ...(line ? { line } : {}), ...(adoption ? { adoption } : {}),
  };
}

/** The capability projects on the priority list (queue order), then failed ones that can be reopened. */
export function capPriorityList(s: GameStateV2): { list: CapProjectView[]; failed: CapProjectView[]; idleTeams: { id: string; why: string }[] } {
  const q = s.player.research.queue.filter((id) => isCapProject(node(id)));
  const list = q.map((id) => capProjectView(s, id)).filter((x): x is CapProjectView => !!x);
  const failed = TREE.filter((n) => isCapProject(n) && s.player.tree[n.id]?.status === 'failed' && !q.includes(n.id))
    .map((n) => capProjectView(s, n.id)).filter((x): x is CapProjectView => !!x);
  const idleTeams = s.player.teams.filter((t) => t.role === 'sci' && t.dept === 'cap' && !t.projectId).map((t) => ({ id: t.id, why: t.why ?? 'Idle: no capability project is ready' }));
  return { list, failed, idleTeams };
}

/** Capability projects the player can add to the list (open, not queued). */
export function addableProjects(s: GameStateV2): { id: string; name: string; kind: string; area: string }[] {
  const q = new Set(s.player.research.queue);
  return TREE.filter((n) => isCapProject(n) && !q.has(n.id) && nodeStatus(s, n.id) === 'open')
    .map((n) => ({ id: n.id, name: n.name, kind: n.kind ?? 'idea', area: COLUMN_LABEL[n.column] }));
}

export { PROJECT_MAX_TEAMS };

// ───────────────────────────── recipe stacks ─────────────────────────────

/** RD-M02, RF-R5: a model's measured gain: its fitted level minus that of the comparable earlier model (its predecessor
 *  on the same base, else the latest evaluated version before it). Shown once per model (Models), never per idea. */
export interface MeasuredDelta {
  /** Δ measured general level (L). */
  dL: number;
  /** Band (L): the two fits' sd combined. */
  sd: number;
  /** Δ measured level per domain with a benchmark reading on both. */
  dDom: Partial<Record<string, number>>;
  /** Name of the model it is compared with. */
  vs: string;
}
export interface AdoptedView extends Omit<AdoptedIdea, 'eff'> {
  /** Name of the first evaluated model that embodies it (RF-R5: its measured gain is on that model's card; an idea has
   *  only its believed band). Never the true effect. */
  seenIn?: string;
  /** Player text: which model trains it in ("a post-training run launched"…, after it was adopted). */
  embodiedBy: string;
}
/** RD-B17: one recipe stack in its own unit (OOM of its own quantity, STACK_UNIT; stacks are never summed). RF-R5: `now`
 *  and `adopted` are BELIEVED (start and public knowledge + Σ the adopted results' estimates), `adoptedSd` their band;
 *  the engine's stacks hold the true effects. */
export interface StackView {
  key: StackKey; name: string; unit: string; now: number; adopted: number; adoptedSd: number; base: number;
  /** What the internal model embodies and the stack beyond it (pretraining, RL efficiency, RL ceiling only). */
  inModel?: number; gap?: number;
  /** Ideas adopted into it (a batch counts its ideas; a second stack an idea also moves does not count it). */
  n: number;
  ideas: AdoptedView[];
}
/** One row of a domain or data effect in its own unit. */
export interface EffectRowView { label: string; unit: string; est: number; estSd: number }
/** RD-B17: an adopted domain or data effect (not a stack): its rows in their own units. */
export interface OtherEffectView extends AdoptedView { kind: 'domain' | 'data'; rows: EffectRowView[] }

const DOMAIN_NAME: Record<string, string> = { CODE: 'Code', RSCH: 'AI research', REASON: 'Math & reasoning', AGENCY: 'Long tasks', SOCIAL: 'Social & general text', MEDIA: 'Media', CYBER: 'Cyber', BIO: 'Bio', PHYS: 'Physical' };

/** The first evaluated model that embodies an idea adopted on `day` (RD-B30: by where its effect lands, so a distilled
 *  student or a model trained before it never reveals it). Versions from older saves without `trained` count if full. */
function revealedBy(s: GameStateV2, day: number, by: EmbodiedBy): ModelVersion | undefined {
  const m = s.player.models;
  const vs = m.versions.filter((v) => v.status !== 'evaluating' && v.status !== 'rolledBack');
  const onBase = (ok: (b: (typeof m.bases)[number]) => boolean) => vs.find((v) => { const b = m.bases.find((x) => x.id === v.baseId); return !!b && ok(b); });
  const rl = () => vs.find((v) => (v.trained ? v.trained.rlDay > day : v.variant === 'full' && v.day > day));
  const post = () => vs.find((v) => (v.trained ? v.trained.post && v.trained.rlDay > day : v.variant === 'full' && v.day > day));
  const started = () => onBase((b) => (b.startDay ?? b.day) > day);
  if (by === 'baseStart') return started();
  if (by === 'rl') return rl();
  if (by === 'post') return post();
  const a = started();
  const b = rl();
  return a && b ? (m.versions.indexOf(a) <= m.versions.indexOf(b) ? a : b) : (a ?? b);
}
/** RD-M02: the measured eval delta of `v` (the first model that embodies an idea) over a comparable model without it:
 *  the latest evaluated version before it on the same base, else the latest evaluated version before it (every earlier
 *  version lacks the idea: `v` is the first that embodies it). Reads only the EvalRecord fits. */
export function measuredDelta(s: GameStateV2, v: ModelVersion): MeasuredDelta | undefined {
  const vs = s.player.models.versions;
  const i = vs.indexOf(v);
  if (i < 0 || v.evals.measuredL === undefined) return undefined;
  const prior = vs.slice(0, i).filter((x) => x.evals.measuredL !== undefined && x.status !== 'evaluating' && x.status !== 'rolledBack');
  const p = prior.filter((x) => x.baseId === v.baseId).pop() ?? prior.pop();
  if (!p || p.evals.measuredL === undefined) return undefined;
  const sd = Math.hypot(measuredSd(v), measuredSd(p));
  const dDom: Partial<Record<string, number>> = {};
  for (const [d, x] of Object.entries(v.evals.measuredDom ?? {})) {
    const y = p.evals.measuredDom?.[d as keyof typeof p.evals.measuredDom];
    if (x !== undefined && y !== undefined) dDom[d] = x - y;
  }
  return { dL: v.evals.measuredL - p.evals.measuredL, sd, dDom, vs: p.name };
}
function adoptedView(s: GameStateV2, a: AdoptedIdea, by: EmbodiedBy): AdoptedView {
  const { eff: _true, ...rest } = a; // eslint-disable-line @typescript-eslint/no-unused-vars
  const v = revealedBy(s, a.day, by);
  return { ...rest, embodiedBy: EMBODIED_TEXT[by], ...(v && v.evals.measuredL !== undefined ? { seenIn: v.name } : {}) };
}
/** Where a domain or data effect lands, all frozen at a run's launch (RD-B02 snapshot): domain effects and serving in
 *  a post-training run's recipe; the data pipeline (synthetic quality, token worth) in a base run's data draw. */
function otherEmbodiedBy(n: TreeNodeDef | undefined): EmbodiedBy {
  if (n?.effect?.domains) return 'post';
  return 'baseStart';
}

/** Recipe readout (RD-B17): per stack, in its own unit, its believed value now (RF-R5: start and public knowledge + Σ the
 *  adopted results' estimates, ± their band), what the internal model embodies, and the adopted ideas (believed band, and
 *  the first evaluated model trained with each). */
export function stackViews(s: GameStateV2): StackView[] {
  const res = s.player.research;
  const F = latestBaseFlop(s);
  const v = agentVersion(s, 'capRoutine');
  const base = v ? s.player.models.bases.find((b) => b.id === v.baseId) : undefined;
  const inModel: Partial<Record<StackKey, number>> = {};
  if (base) inModel.pre = base.ePre - E_START;
  if (v?.build) {
    inModel.rlMid = v.build.eRL;
    if (v.build.aRL !== undefined) inModel.rlCeil = v.build.aRL;
  }
  const nowOf = (k: StackKey) => (k === 'pre' ? stackAt(res.stacks.pre, F) : k === 'rlMid' ? rlMidNow(s) : k === 'rlCeil' ? rlCeilNow(s) : k === 'train' ? trainNow(s) : stackAt(res.stacks.serve));
  return STACK_KEYS.map((k) => {
    const st = res.stacks[k];
    const est = st.est ?? 0;
    const im = inModel[k];
    return {
      key: k, name: STACK_LABEL[k], unit: STACK_UNIT[k], now: st.base + est, adopted: est, adoptedSd: Math.sqrt(st.estVar ?? 0), base: st.base,
      // "Not trained in" still reads the engine's values (the true stack now vs the true recipe the model took; RF-R5 left).
      ...(im !== undefined ? { inModel: im, gap: Math.max(0, nowOf(k) - im) } : {}), n: st.n,
      ideas: res.adopted.filter((a) => a.stack === k).slice().reverse().map((a) => adoptedView(s, a, EMBODIED_BY[k])),
    };
  });
}

/** RD-B17: adopted domain effects (OOM of a domain's capability for new versions) and data effects (synthetic quality
 *  ceiling, token worth), newest first, each row in its own unit. Older saves listed domain
 *  effects with `stack: 'pre'`; they are read as domain effects here. */
export function otherEffectViews(s: GameStateV2): OtherEffectView[] {
  const out: OtherEffectView[] = [];
  for (const a of s.player.research.adopted.slice().reverse()) {
    const n = PROJECT_BY_ID[a.id];
    const eff = n?.effect;
    if (!eff || eff.stack) continue;
    const kind = a.kind ?? (eff.domains ? 'domain' : 'data');
    const av = adoptedView(s, a, otherEmbodiedBy(n));
    const row = (label: string, unit: string, k: number): EffectRowView => ({ label, unit, est: a.est * k, estSd: a.estSd * k });
    const rows: EffectRowView[] = [];
    for (const [d, w] of Object.entries(eff.domains ?? {})) rows.push(row(DOMAIN_NAME[d] ?? d, 'OOM for new versions', w ?? 0));
    if (eff.data?.synQMax) rows.push(row('Synthetic data quality ceiling', 'web text = 1', eff.data.synQMax));
    if (eff.data?.worthOom) rows.push(row('Worth of each training token', 'OOM', eff.data.worthOom));
    out.push({ ...av, kind, rows });
  }
  return out;
}

/** Software progress of the recipe (OOM of effective compute per year, 14-day average: the lab's own adopted ideas and
 *  tuning at a fixed base, RD-B16), the ideas adopted per year (over the last 14 weekly samples), and public knowledge received (OOM per year, 14-day
 *  average: diffusion, tacit knowledge, safety spillover; not part of Software progress). */
export function softwareRate(s: GameStateV2): { oomPerYear: number; ideasPerYear: number; publicPerYear: number } {
  const h = s.player.research.hist;
  const ideas = h.length >= 2 ? ((h[h.length - 1].n - h[0].n) / Math.max(1, h[h.length - 1].day - h[0].day)) * 365 : 0;
  return { oomPerYear: (s.player.research.gRate ?? 0) * 365, ideasPerYear: Math.max(0, ideas), publicPerYear: Math.max(0, (s.player.research.pubRate ?? 0) * 365) };
}

// ───────────────────────────── allocations ─────────────────────────────

export interface NeedView<K extends string> { k: K; label: string; demand: number; got: number; max?: number; share?: number; capped: boolean; short: number }
export interface AllocView<K extends string> { cap: number; order: K[]; needs: NeedView<K>[]; idle: number; unit: string }

/** Research engineers by need today (human team-equivalents): demand, what each got, caps, unmet demand, idle. */
export function reAllocView(s: GameStateV2): AllocView<ReNeed> & { m: number; perProject: Record<string, number> } {
  const a = s.player.research.re;
  const al = reAllocation(s);
  const m = Math.max(1, workContext(s).slots.EXP.m);
  const demand: Record<ReNeed, number> = reDemand(s, m);
  const cap = capReCapacity(s);
  const needs = a.order.map((k) => {
    const lim = Math.min(a.max[k] ?? Infinity, (a.share[k] ?? Infinity) * cap);
    const d = demand[k];
    const got = al.re[k] ?? 0;
    return {
      k, label: RE_NEED_LABEL[k], demand: d, got, ...(a.max[k] !== undefined ? { max: a.max[k] } : {}), ...(a.share[k] !== undefined ? { share: a.share[k] } : {}),
      capped: Number.isFinite(lim) && got >= lim - 1e-9 && d > got + 1e-9, short: Number.isFinite(d) ? Math.max(0, d - got) : 0,
    };
  });
  const used = needs.reduce((x, n) => x + n.got, 0);
  return { cap, order: [...a.order], needs, idle: Math.max(0, cap - used), unit: 'team-eq', m, perProject: Object.fromEntries(al.perProject) };
}

/** RD-A04: safety research engineers by need today (heads × quality, the player's order): demand, what each got,
 *  caps, unmet demand, idle. */
export function safReAllocView(s: GameStateV2): AllocView<SafReNeed> {
  const a = s.player.research.safRe ?? DEFAULT_SAF_RE_ALLOC;
  const al = safAllocation(s);
  const cap = al.heads;
  const needs = a.order.map((k) => {
    const lim = Math.min(a.max[k] ?? Infinity, (a.share[k] ?? Infinity) * cap);
    const d = al.demand[k];
    const got = al.got[k] ?? 0;
    return {
      k, label: SAF_RE_NEED_LABEL[k], demand: d, got, ...(a.max[k] !== undefined ? { max: a.max[k] } : {}), ...(a.share[k] !== undefined ? { share: a.share[k] } : {}),
      capped: Number.isFinite(lim) && got >= lim - 1e-9 && d > got + 1e-9, short: Math.max(0, d - got),
    };
  });
  return { cap, order: [...a.order], needs, idle: al.idle, unit: 'people' };
}

/** Engineers by need this week (team-weeks per week of effective build capacity). */
export function engAllocView(s: GameStateV2): AllocView<EngNeed> {
  const a = engAlloc(s) ?? DEFAULT_ENG_ALLOC;
  const cap = buildCapacity(s).capacity;
  const d = engDemand(s, upkeepSplit(s));
  const al = allocate(cap, a, d);
  const needs = a.order.map((k) => {
    const lim = Math.min(a.max[k] ?? Infinity, (a.share[k] ?? Infinity) * cap);
    return {
      k, label: ENG_NEED_LABEL[k], demand: d[k], got: al[k], ...(a.max[k] !== undefined ? { max: a.max[k] } : {}), ...(a.share[k] !== undefined ? { share: a.share[k] } : {}),
      capped: Number.isFinite(lim) && al[k] >= lim - 1e-9 && d[k] > al[k] + 1e-9, short: Math.max(0, d[k] - al[k]),
    };
  });
  const used = needs.reduce((x, n) => x + n.got, 0);
  return { cap, order: [...a.order], needs, idle: Math.max(0, cap - used), unit: 'team-wk/wk' };
}

// ───────────────────────────── AI labour per work type ─────────────────────────────

export interface WorkTypeView {
  wt: WorkTypeId;
  name: string;
  slot: LabourSlot;
  version?: string;
  /** Fit and the human reference points (OOM of effective compute). */
  fit: number; med: number; best: number;
  coverage: number;
  /** 50% / 80% time horizon (minutes) on this work and the success chance at its typical task length H (hours). */
  h50: number; h80: number; H: number; pAtH: number;
  win: number; assist: number;
  copies: number; speed: number; aiFte: number; h100e: number;
  /** Human team-equivalents, AI team-equivalents, effective labour (team-eq), its multiplier, the humans' share. */
  humans: number; ai: number; L: number; m: number; wH: number;
  /** Share of the work handed to AI (1 on capabilities work; Trusted to AI on safety work) and the share AI does, t × a. */
  t: number; A: number;
  /** AI cost per work-hour vs the lab's best engineers ($). */
  costAI: number; costHuman: number;
}

/** AI labour in each of the lab's work types today (the safety ones on the safety package through Trusted to AI,
 *  model v3 E2). */
export function workTypeViews(s: GameStateV2): WorkTypeView[] {
  const wc = workContext(s);
  const saf = safetyLabour(s);
  return (['SWE', 'EXP', 'IDEAS', 'SAF_EXP', 'SAF_IDEAS'] as const).map((wt) => {
    const sl: LabourOf = wt === 'SAF_EXP' ? saf.exp : wt === 'SAF_IDEAS' ? saf.ideas : wc.slots[wt];
    const def = WORK_TYPES[wt];
    const v = sl.versionId ? versionById(s, sl.versionId) : undefined;
    const fpt = v ? agentFpt(s, v) : 0;
    const cost = v ? costPerWorkHour(s, fpt) : { ai: Infinity, human: costPerWorkHour(s, 1).human };
    return {
      wt, name: def.name, slot: wt, ...(v ? { version: v.name } : {}),
      fit: sl.fit.fit, med: sl.fit.med, best: sl.fit.best, coverage: sl.fit.a,
      h50: sl.fit.h50, h80: sl.fit.h50 / 5, H: def.H, pAtH: v ? pSuccess(def.H, sl.fit.h50) : 0, win: sl.fit.win, assist: sl.fit.assist,
      copies: sl.copies, speed: sl.copies > 0 ? speedOfCopy() : 0, aiFte: sl.aiFte, h100e: sl.h100e,
      humans: sl.H, ai: sl.AI, L: sl.L, m: sl.m, wH: sl.wH, t: sl.t, A: sl.A, costAI: cost.ai, costHuman: cost.human,
    };
  });
}

// ───────────────────────────── milestones ─────────────────────────────

export interface MilestoneCriterion { label: string; wt?: WorkTypeId; kind: 'fit' | 'coverage' | 'cost'; have: number; need: number; met: boolean }
export interface MilestoneView { idx: MilestoneIdx; name: string; reachedDay?: number; version?: string; criteria: MilestoneCriterion[]; met: boolean }

/** Each work-type milestone with the distance to each criterion, on the live version closest to it. */
export function milestoneViews(s: GameStateV2): MilestoneView[] {
  const w = s.hidden.timeline;
  const gap2 = 2 * w.v3.dBM;
  const live = s.player.models.versions.filter((v) => v.status !== 'retired' && v.status !== 'rolledBack');
  const fitsOf = (v: ModelVersion) => Object.fromEntries(COGNITIVE_WORK.map((wt) => [wt, workFit(s, v, wt)])) as Record<WorkTypeId, ReturnType<typeof workFit>>;
  const rows = live.map((v) => ({ v, f: fitsOf(v), cost: costPerWorkHour(s, agentFpt(s, v)) }));
  const fitC = (label: string, wt: WorkTypeId, f: ReturnType<typeof workFit>, extra = 0): MilestoneCriterion => ({ label, wt, kind: 'fit', have: f.fit - f.best, need: extra, met: f.fit - f.best >= extra });
  const covC = (wt: WorkTypeId, f: ReturnType<typeof workFit>, need: number): MilestoneCriterion => ({ label: `${WORK_TYPES[wt].name} coverage`, wt, kind: 'coverage', have: f.a, need, met: f.a >= need });
  const crit = (i: MilestoneIdx, r: (typeof rows)[number]): MilestoneCriterion[] => {
    const f = r.f;
    if (i === 0) return [covC('SWE', f.SWE, 0.1)];
    if (i === 1) return [covC('SWE', f.SWE, 0.5)];
    if (i === 2) return [covC('EXP', f.EXP, 0.5)];
    const sc = [fitC('Software fit vs best human', 'SWE', f.SWE), covC('SWE', f.SWE, MILESTONE_COVER), { label: 'AI cost per work-hour vs best engineer', kind: 'cost' as const, have: r.cost.ai, need: r.cost.human, met: r.cost.ai < r.cost.human }];
    if (i === 3) return sc;
    if (i === 4) return [fitC('Experiments fit vs best human', 'EXP', f.EXP), covC('EXP', f.EXP, MILESTONE_COVER), fitC('Research-ideas fit vs best human', 'IDEAS', f.IDEAS), covC('IDEAS', f.IDEAS, MILESTONE_COVER)];
    if (i === 5) return [fitC('Research-ideas fit vs best human', 'IDEAS', f.IDEAS, gap2)];
    const worst = COGNITIVE_WORK.reduce((a, wt) => (f[wt].fit - f[wt].best < f[a].fit - f[a].best ? wt : a), COGNITIVE_WORK[0]);
    return [fitC(`Weakest work type (${WORK_TYPES[worst].name}) vs best human`, worst, f[worst], gap2)];
  };
  /** Progress score of a criteria list (higher = closer): the worst criterion's normalised margin. */
  const score = (cs: MilestoneCriterion[]) => Math.min(...cs.map((c) => (c.kind === 'coverage' ? (c.have - c.need) / Math.max(0.05, c.need) : c.kind === 'cost' ? Math.log10(Math.max(1e-9, c.need) / Math.max(1e-9, c.have)) : c.have - c.need)));
  return MILESTONE_NAMES.map((name, i) => {
    const idx = i as MilestoneIdx;
    let best: { r: (typeof rows)[number]; cs: MilestoneCriterion[] } | undefined;
    for (const r of rows) {
      const cs = crit(idx, r);
      if (!best || score(cs) > score(best.cs)) best = { r, cs };
    }
    const day = s.player.milestoneDays[idx];
    return {
      idx, name, ...(day !== undefined ? { reachedDay: day } : {}), ...(best ? { version: best.r.v.name } : {}),
      criteria: best?.cs ?? [], met: day !== undefined || (!!best && best.cs.every((c) => c.met)),
    };
  });
}

// ───────────────────────────── lab research speed ─────────────────────────────

export interface ResearchSpeedView {
  /** Research speed vs the leader lab's day 0 (≈ 1 at the start). */
  rel: number;
  /** RD-R01, what the research engine ran its last day at (research.last.x): the AI labour multipliers in experiments
   *  and on research ideas (humans only = 1), and the siloing / migration modifiers. */
  mExp: number; mIdeas: number; mods: number;
  /** A unit project's inputs (leader day 0 = 1) and its experiment throughput. */
  c: number; l: number; X: number;
  label: 'compute-bound' | 'labor-bound' | 'human-bound' | 'taste-bound';
  /** Research compute (H100e) and the share on experiments (the rest runs research agents). */
  researchH100e: number; expShare: number;
}

export function labSpeedView(s: GameStateV2): ResearchSpeedView {
  const pr = production(s, 'player');
  const x = s.player.research.last?.x;
  const mods = researchMods(s);
  const pools = poolsOf(s);
  const r = pools.experiments + (pools.routine + pools.frontier);
  return {
    rel: labSpeedRel(s), mExp: x?.mExp ?? 1, mIdeas: x?.mIdeas ?? 1, mods: mods.speed / mods.rateMult,
    c: x?.c ?? 0, l: x?.l ?? 1, X: x?.X ?? 0, label: pr.label,
    researchH100e: r, expShare: r > 0 ? pools.experiments / r : 0,
  };
}

/** Engineers' build capacity split into humans and AI (team-weeks per week). */
export function buildSplit(s: GameStateV2): { capacity: number; human: number; ai: number; coverage: number; m: number } {
  const bc = buildCapacity(s);
  return { capacity: bc.capacity, human: bc.human, ai: Math.max(0, bc.capacity - bc.human), coverage: bc.aEng, m: bc.human > 0 ? bc.capacity / bc.human : 0 };
}

export { r3 as round3 };
export type { CapStage };
