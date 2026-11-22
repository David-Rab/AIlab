// The tech tree and its research projects (TECH-TREE.md, STRUCTURE §4.2, §4.5, BUILD-PLAN R4, R8). Owner: WS1.
// Model v3 V2: capability projects run the research lifecycle of models/research.ts (ideation → small experiments →
// scale test → result → adoption into the recipe stacks; scientists assigned by priority and teams wanted; research
// engineers by need). The text below the first paragraph describes the safety path.
//
// A node opens when its prerequisites are known (no capability gates). The player queues projects (priority order) and
// assigns science teams of the node's department (capability columns: capabilities scientists; alignment,
// interpretability and evals & control: safety scientists). Capabilities science teams are placed every day by the
// priority assignment of models/research.ts (planAssignment); safety science teams by the same planner (RD-R03).
// Capacity = Σ heads/40 × quality × 1.5 in the team's specialty column. RD-R04: there is no rolled path; every safety
// node has a research line (P27 is a project of line AG17).
//  - Safety nodes (a node with an agenda; RD-R02b): the shared project stepper (models/research.ts stepProject, dept
//    'saf'; rates in safety/lineProjects.ts lineRates): one "does it work" test that the safety scientists and the
//    research engineers with compute work through. Then the hidden works draw: works → the node's own technique or
//    finding (findings.ts nodeTestResult) and the node is known; doesn't → a dead end for this attempt (posterior toward
//    failure, the attempt's team-months to the line's dead-end count) and the project retries at the posterior odds. A
//    line's follow-up is its open study: each test ends in an event (findings.ts fireFinding). When a node becomes known its teams move on to the line's next
//    open node, else the line's follow-up project.
// Product-feature nodes wait for live products (R6).
import { AG17_MIN_L, SERIOUS_CAP } from '../../../data/v2/agendas';
import { posteriorBand } from '../safety/agendas';
import { START_BY_ID } from '../../../data/v2/starts';
import {
  CAPACITY_UNIT, EFFORT_TM, OPTION_NODE, PROJECT_BY_ID, TREE, isLineNode, lineNodeId,
  type OptionSlot, type TreeNodeDef,
} from '../../../data/v2/tree';
import { COLUMN_DEPT } from '../../../data/v2/teams';
import { teamCapacity } from '../departments/capacity';
import type { AgendaId, Column, EngineSystem, GameStateV2, ResearchState, SetupV2, SystemCtx, Team, TeamDept, TreeNodeState } from '../types';
import { PARADIGM_BY_ID } from './paradigms';
import { freshSaf, lineLabourMult, lineCycleDays, lineEtaDays, lineRates, resetSafAllocation, safAllocation, safProgress, safState } from '../safety/lineProjects';
import { queueBuild } from '../departments/build';
import { researchMods } from '../departments/workfit';
import {
  assignCapTeams, attemptOdds, capEta, capResearchDay, isCapProject, planAssignment, sciOn, stepProject, takesTeams,
  type ProjectValueFn,
} from './research';
import { safetyAgentL } from '../safety/agents';
import { fireFinding, nodeTestResult } from '../safety/findings';
import { DEFAULT_LINES, DEFAULT_RE_ALLOC, DEFAULT_SAF_RE_ALLOC, SAF_LINE_WEIGHT } from '../../../data/v2/research';
import { initialStacks } from './stacks';

export type NodeStatus = 'known' | 'active' | 'queued' | 'open' | 'locked' | 'failed' | 'soon';

const node = (id: string): TreeNodeDef | undefined => PROJECT_BY_ID[id];
/** Department whose science teams work a node. */
export const nodeDept = (n: Pick<TreeNodeDef, 'column'>): TeamDept => COLUMN_DEPT[n.column];

/** Start state: ★ nodes known by every company, plus the start type's known nodes (data/v2/starts.ts; R9). */
export function initialTree(setup: Pick<SetupV2, 'start'>): Record<string, TreeNodeState> {
  const out: Record<string, TreeNodeState> = {};
  const extra = new Set(START_BY_ID[setup.start ?? 'leader'].known);
  for (const n of TREE) if (n.star || extra.has(n.id)) out[n.id] = { status: 'known', progress: 1, day: 0 };
  return out;
}

/** Projects the start's safety science teams work on, by specialty (a 2025 frontier lab's portfolio: training-signal
 *  design, applied interpretability, model organisms; the pre-R8 start funding) [D]. */
export const START_SAFETY_PROJECTS: Partial<Record<Column, string>> = { alignment: 'T-CONFESS', interp: 'T-DECEPT', evals: 'T-HONEY' };

/** Start research state: the start safety teams on their projects (queued in that order), then the default capability
 *  lines (DEFAULT_LINES) with teams wanted in proportion to their shares of the capability science teams (V4.0: a new
 *  game no longer starts with idle capability scientists). Every start type gets the same lines; the starts' earlier
 *  work is their known nodes (data/v2/starts.ts), so no idea is in flight on day 0. */
export function initialResearch(teams: Team[] = []): ResearchState {
  const queue: string[] = [];
  for (const t of teams) {
    if (t.role !== 'sci' || t.dept !== 'saf' || !t.specialty) continue;
    const id = START_SAFETY_PROJECTS[t.specialty];
    if (!id) continue;
    t.projectId = id;
    if (!queue.includes(id)) queue.push(id);
  }
  const cap = initialCapResearch();
  const sci = teams.filter((t) => t.role === 'sci' && t.dept === 'cap').length;
  const wSum = DEFAULT_LINES.reduce((a, l) => a + l.w, 0);
  for (const l of DEFAULT_LINES) {
    const n = node(l.id);
    if (!n || (n.needs ?? []).length) continue;
    queue.push(l.id);
    cap.want[l.id] = Math.max(1, Math.round((l.w / wSum) * sci));
  }
  return { queue, ...cap };
}

/** Re-run the capability science assignment now (V4.0): the priority list's actions (queue, start, drop, reorder, teams
 *  wanted) place the teams at once, so the list never shows a project without the teams the next tick gives it (the
 *  daily research tick recomputes the same deterministic plan). */
export function assignCapNow(s: GameStateV2) {
  const ready = s.player.research.queue.filter((id) => isCapProject(node(id)) && s.player.tree[id]?.status !== 'failed' && projectReady(s, id) === true);
  assignCapTeams(s, ready);
}

/** Model v3 V2 research fields (stacks from initialStacks; the start lag is applied by core/init). The software-rate
 *  readout (gRate) starts unset and warms up over its 14-day average (RD-L03: no seed; no lead reader reads it, the
 *  pace readers use frontierGPerYear). */
export function initialCapResearch(): Pick<ResearchState, 'want' | 'wantAuto' | 'risk' | 're' | 'safRe' | 'stacks' | 'adopted' | 'hist' | 'domainG'> {
  return {
    want: {}, wantAuto: [], risk: 'balanced', re: { order: [...DEFAULT_RE_ALLOC.order], max: { ...DEFAULT_RE_ALLOC.max }, share: { ...DEFAULT_RE_ALLOC.share } },
    safRe: { order: [...DEFAULT_SAF_RE_ALLOC.order], max: {}, share: {} },
    stacks: initialStacks(0), adopted: [], hist: [], domainG: {},
  };
}

/** Whether the player can run a project on this node now (kind of node, not its prerequisites). */
export const isProject = (n: TreeNodeDef) => !n.soon && !n.star;

/** Whether a node is known: done on the tree, or (safety nodes) its technique or its catalog finding came from any
 *  result. A line's follow-up is never known. */
export function nodeKnown(s: GameStateV2, id: string): boolean {
  if (s.player.tree[id]?.status === 'known') return true;
  const n = node(id);
  if (!n || n.followUp) return false;
  if (n.technique) return !!s.player.safety.techniques[n.technique]?.unlocked;
  if (n.finding) return s.player.safety.findings.some((f) => f.id === n.finding);
  return false;
}

/** Prerequisites not yet known. */
export const missingNeeds = (s: GameStateV2, id: string): string[] => (node(id)?.needs ?? []).filter((r) => !nodeKnown(s, r));

/** Teams working on a project. */
export const teamsOn = (s: GameStateV2, id: string): Team[] => s.player.teams.filter((t) => t.projectId === id);

/** A node's status for the tree (derived). */
export function nodeStatus(s: GameStateV2, id: string): NodeStatus {
  const n = node(id);
  if (!n) return 'locked';
  if (nodeKnown(s, id)) return 'known';
  if (n.soon) return 'soon';
  const st = s.player.tree[id];
  if (st?.cap?.stage === 'adopting') return 'active';
  if (st?.status === 'failed') return 'failed';
  const queued = s.player.research.queue.includes(id);
  if (queued) return teamsOn(s, id).length > 0 ? 'active' : 'queued';
  return missingNeeds(s, id).length ? 'locked' : 'open';
}

/** A node's effort number in team-months (display); readouts of a project's work read effortOfNode (models/research.ts). */
export const effortOf = (n: TreeNodeDef): number => n.effortTM ?? EFFORT_TM[n.effort ?? 'M'];

/** Odds of the next attempt: capability projects attemptOdds (× ½ per speculative reopening); a research-line node shows
 *  its line's estimated chance of a working result (the posterior mean, never the hidden efficacy); others the paradigm
 *  prior or the node's odds. */
export function nodeOdds(s: GameStateV2, id: string): number {
  const n = node(id);
  if (!n) return 0;
  if (isLineNode(n)) return posteriorBand(s.player.safety.agendas[n.agenda as AgendaId]).mean;
  if (isCapProject(n)) {
    const st = s.player.tree[id];
    // A failed project's odds are those of a speculative reopening.
    const spec = (st?.cap?.spec ?? 0) + (st?.status === 'failed' ? 1 : 0);
    return attemptOdds(n, spec);
  }
  return n.paradigm ? (PARADIGM_BY_ID[id]?.prior ?? 1) : (n.odds ?? 1);
}

/** Capacity on a project (optionally with a team added or removed). */
export function projectCapacity(s: GameStateV2, id: string, add?: Team, remove?: string): number {
  const n = node(id);
  if (!n) return 0;
  let c = 0;
  for (const t of s.player.teams) if (t.projectId === id && t.id !== remove && t.id !== add?.id) c += teamCapacity(t, n.column);
  if (add) c += teamCapacity(add, n.column);
  return c;
}

/** Results per day of a research-line project (safety/lineProjects.ts lineCycleDays); 0 for any other project
 *  (capability projects run their stages, models/research.ts, and read their ETA from capEta). */
export function projectRate(s: GameStateV2, id: string, cap?: number): number {
  const n = node(id);
  if (!n || !isLineNode(n)) return 0;
  const now = projectCapacity(s, id);
  const c = cap ?? now;
  if (c <= 0) return 0;
  return 1 / lineCycleDays(s, id, cap === undefined || Math.abs(c - now) < 1e-9 ? undefined : c);
}

/** A staffing change a preview asks about: a team joins the project, or a team leaves it. */
export interface StaffChange { add?: Team; remove?: string }

/** Days a team would cut from a project's ETA by joining it (Infinity for a project no other team works on; 0 if it
 *  cannot help). */
export function teamGain(s: GameStateV2, teamId: string, id: string): { etaNow: number; etaWith: number; gain: number } {
  const t = s.player.teams.find((x) => x.id === teamId);
  if (!t || !node(id)) return { etaNow: Infinity, etaWith: Infinity, gain: 0 };
  const etaNow = projectEta(s, id, { remove: t.id });
  const etaWith = projectEta(s, id, { add: t });
  return { etaNow, etaWith, gain: etaNow === Infinity ? (etaWith < Infinity ? Infinity : 0) : Math.max(0, etaNow - etaWith) };
}

/** RD-B18 (B31): days to finish (research-line projects: to the next result) at today's inputs, the one ETA of every
 *  readout and preview: capability projects capEta (their stages as the engine runs them), research-line projects
 *  lineEtaDays. `staff` previews a science capacity or a team joining / leaving. Infinity
 *  with no teams. */
export function projectEta(s: GameStateV2, id: string, staff?: number | StaffChange): number {
  const n = node(id);
  if (!n) return Infinity;
  const now = projectCapacity(s, id);
  const c = staff === undefined ? now : typeof staff === 'number' ? staff : projectCapacity(s, id, staff.add, staff.remove);
  const same = staff === undefined || Math.abs(c - now) < 1e-9;
  if (isCapProject(n)) {
    if (same) return capEta(s, id).eta;
    if (typeof staff === 'number') return capEta(s, id, { cap: c, q: sciOn(s, id).q }).eta;
    const teams = s.player.teams.filter((t) => t.id !== staff.remove && t.id !== staff.add?.id);
    return capEta(s, id, sciOn(s, id, staff.add ? [...teams, { ...staff.add, projectId: id }] : teams)).eta;
  }
  return isLineNode(n) && c > 0 ? lineEtaDays(s, id, same ? undefined : c) : Infinity;
}

/** True if a project can take teams today, else the reason it waits. */
export function projectReady(s: GameStateV2, id: string): true | string {
  const n = node(id);
  if (!n) return 'Unknown idea';
  if (nodeKnown(s, id)) return 'Already known';
  if (n.soon) return 'A product feature: opens with live products';
  if (n.star) return 'Known by every lab';
  const miss = missingNeeds(s, id);
  if (miss.length) return `Needs ${miss.map((m) => node(m)?.name ?? m).join(', ')}`;
  if (n.agenda === 'AG17' && isLineNode(n) && safetyAgentL(s) < AG17_MIN_L) return `Needs a safety-research model at measured level ≥ ${AG17_MIN_L}`;
  const st = s.player.tree[id];
  if (isCapProject(n) && st?.status === 'failed') return 'Failed: reopen it as a speculative project';
  if (isCapProject(n) && !takesTeams(st?.cap)) return 'Finished: the engineers are building it in';
  return true;
}

/** Add a node (and its missing researchable prerequisites, first) to the project queue. `at` = position (default
 *  end). Returns an error, or undefined. */
export function queueNode(s: GameStateV2, id: string, at?: number): string | undefined {
  const n = node(id);
  if (!n) return 'Unknown idea';
  if (nodeKnown(s, id)) return 'Already known';
  if (!isProject(n)) return projectReady(s, id) as string;
  const chain: string[] = [];
  const visit = (x: string): string | undefined => {
    if (nodeKnown(s, x) || chain.includes(x)) return undefined;
    const nx = node(x);
    if (!nx) return `Unknown idea ${x}`;
    if (!isProject(nx)) return `Needs ${nx.name} (not researchable yet)`;
    for (const r of nx.needs) {
      const e = visit(r);
      if (e) return e;
    }
    chain.push(x);
    return undefined;
  };
  const err = visit(id);
  if (err) return err;
  const q = s.player.research.queue;
  const add = chain.filter((x) => !q.includes(x));
  if (!add.length) return at === undefined ? undefined : moveInQueue(s, id, at);
  const pos = at === undefined ? q.length : Math.max(0, Math.min(q.length, at));
  q.splice(pos, 0, ...add);
  return undefined;
}

/** Remove a project from the queue; its teams go idle (progress is kept). */
export function dequeueNode(s: GameStateV2, id: string): string | undefined {
  const q = s.player.research.queue;
  const i = q.indexOf(id);
  if (i < 0) return 'Not queued';
  q.splice(i, 1);
  for (const t of s.player.teams) {
    if (t.projectId !== id) continue;
    delete t.projectId;
    delete t.manual;
  }
  return undefined;
}

/** Move a queued project to position `to` (0 = top priority). */
export function moveInQueue(s: GameStateV2, id: string, to: number): string | undefined {
  const q = s.player.research.queue;
  const i = q.indexOf(id);
  if (i < 0) return 'Not queued';
  q.splice(i, 1);
  q.splice(Math.max(0, Math.min(q.length, Math.round(to))), 0, id);
  return undefined;
}

/** Science teams that run projects (both departments, or one). */
export const projectTeams = (s: GameStateV2, dept?: TeamDept): Team[] => s.player.teams.filter((t) => t.role === 'sci' && (!dept || t.dept === dept));

/** Why a team cannot work on a project, or undefined. */
export function assignBlock(s: GameStateV2, teamId: string, id: string): string | undefined {
  const t = s.player.teams.find((x) => x.id === teamId);
  if (!t) return 'No such team';
  if (t.role !== 'sci') return 'Only science teams run research projects';
  const n = node(id);
  if (n && t.dept !== nodeDept(n)) return t.dept === 'saf' ? 'Safety scientists work on the safety columns' : 'Capabilities scientists work on the capability columns';
  const r = projectReady(s, id);
  return r === true ? undefined : r;
}

/** Put a team on a project (queued at the end if it was not). */
export function assignTeam(s: GameStateV2, teamId: string, id: string): string | undefined {
  const why = assignBlock(s, teamId, id);
  if (why) return why;
  if (!s.player.research.queue.includes(id)) {
    const e = queueNode(s, id);
    if (e) return e;
  }
  const t = s.player.teams.find((x) => x.id === teamId) as Team;
  t.projectId = id;
  t.manual = true;
  return undefined;
}

/** Take a team off its project (it goes idle; the policy may reassign it tomorrow). */
export function unassignTeam(s: GameStateV2, teamId: string): string | undefined {
  const t = s.player.teams.find((x) => x.id === teamId);
  if (!t) return 'No such team';
  delete t.projectId;
  delete t.manual;
  return undefined;
}

/** Idle science teams (no project), of both departments or one. */
export const idleTeams = (s: GameStateV2, dept?: TeamDept): Team[] => projectTeams(s, dept).filter((t) => !t.projectId);

/** A research line's next project: its first open idea (tree order), else its follow-up; undefined if neither can run
 *  (AG17 without its model). */
export function nextLineProject(s: GameStateV2, ag: AgendaId): string | undefined {
  for (const n of TREE) if (n.agenda === ag && isLineNode(n) && !n.star && projectReady(s, n.id) === true) return n.id;
  const f = lineNodeId(ag);
  return projectReady(s, f) === true ? f : undefined;
}

/** RD-R03: a safety project's term in the science-team planner (models/research.ts planAssignment), the value proxy
 *  [D]: the science part of its results per day ((m_ideas × C ÷ SERIOUS_CAP)^λ × taste × speed ÷ 30, as lineRates, over
 *  the test's work) × the chance it works (nodeOdds: the line's estimate, never the hidden efficacy) × the line's
 *  weight (SAF_LINE_WEIGHT, default 1). Square-root returns per team, so spares spread. */
export function safProjectValue(s: GameStateV2, id: string): ProjectValueFn {
  const n = node(id);
  if (!n || !isLineNode(n)) return () => 0;
  const ag = n.agenda as AgendaId;
  const lam = s.hidden.timeline.prod.lam;
  const m = lineLabourMult(s, ag, false).ideas;
  const speed = researchMods(s).speed;
  const need = Math.max(1e-9, freshSaf(n).workNeed);
  const v = (nodeOdds(s, id) * (SAF_LINE_WEIGHT[ag] ?? 1)) / need;
  return (cap, q) => (cap > 0 ? ((Math.pow((m * cap) / SERIOUS_CAP, lam) * q * speed) / 30) * v : 0);
}

/** Ready safety projects on the priority list, in priority order. */
export const safReady = (s: GameStateV2): string[] =>
  s.player.research.queue.filter((id) => {
    const n = node(id);
    return !!n && nodeDept(n) === 'saf' && projectReady(s, id) === true;
  });

/** The safety science teams' plan (RD-R03): the same planner as capability (priority list, teams wanted, spares by
 *  value). With nothing ready the teams stay idle (no line is ever staffed or queued for the player, SAF-23). */
export const planSafAssignment = (s: GameStateV2) => planAssignment(s, safReady(s), 'saf', (id) => safProjectValue(s, id));

/** Apply the plan to the safety science teams. */
export function assignSafTeams(s: GameStateV2) {
  const plan = planSafAssignment(s);
  for (const t of projectTeams(s, 'saf')) {
    const x = plan.get(t.id);
    if (!x) continue;
    if (x.p) t.projectId = x.p;
    else delete t.projectId;
    t.why = x.why;
  }
}

/** The readout flag for idle safety science teams, or undefined: "2 safety teams idle — add projects to the priority
 *  list" (nothing ready) or the planner's reason. */
export function safIdleFlag(s: GameStateV2): string | undefined {
  const idle = idleTeams(s, 'saf');
  if (!idle.length) return undefined;
  const head = `${idle.length} safety team${idle.length === 1 ? '' : 's'} idle`;
  return safReady(s).length ? `${head}: ${(idle[0].why ?? 'Idle').replace(/^Idle: /, '')}` : `${head} — add projects to the priority list`;
}

/** A safety project's test is done (RD-R02b): a node's result (`works` = the hidden draw) or its open study's event.
 *  Returns true if the project is done (its node became known); otherwise its next attempt starts. */
function resolveLine(s: GameStateV2, ctx: SystemCtx, n: TreeNodeDef, st: TreeNodeState, works: boolean | undefined): boolean {
  const ag = n.agenda as AgendaId;
  const line = s.player.safety.agendas[ag];
  const rec = works === undefined ? fireFinding(s, ctx, ag, n.id) : nodeTestResult(s, ctx, n, works);
  if (rec?.trueType === 'DEAD') line.deadEndTM = Math.round(((line.deadEndTM ?? 0) + (st.tm ?? 0)) * 100) / 100;
  st.tm = 0;
  st.progress = 0;
  st.saf = freshSaf(n);
  st.attempts = (st.attempts ?? 1) + 1;
  if (!nodeKnown(s, n.id)) return false;
  st.status = 'known';
  st.progress = 1;
  st.day = ctx.day;
  delete st.saf;
  return true;
}

/** One day of research projects: drop teams from projects that cannot run, plan both departments' teams, progress, resolve. */
export function researchDay(s: GameStateV2, ctx: SystemCtx) {
  const p = s.player;
  const q = p.research.queue;
  // Known or unrunnable projects leave the queue / free their teams.
  for (let i = q.length - 1; i >= 0; i--) if (nodeKnown(s, q[i]) || !node(q[i])) q.splice(i, 1);
  for (const t of p.teams) {
    if (!t.projectId) continue;
    const n = node(t.projectId);
    if (t.role !== 'sci' || !n || t.dept !== nodeDept(n) || !q.includes(t.projectId) || projectReady(s, t.projectId) !== true) {
      delete t.projectId;
      delete t.manual;
    }
  }
  // Model v3 V2: capability projects. Failed ones leave the queue; the rest run the lifecycle.
  for (let i = q.length - 1; i >= 0; i--) if (isCapProject(node(q[i])) && p.tree[q[i]]?.status === 'failed') q.splice(i, 1);
  const capReady = q.filter((id) => isCapProject(node(id)) && projectReady(s, id) === true);
  capResearchDay(s, ctx, capReady, (id, tw) => queueBuild(s, 'adopt', id, tw));
  assignSafTeams(s);
  // Model v3 E1: today's safety research engineers and line compute for the line projects in experiments (a test that
  // starts today gets its engineers and FLOP from tomorrow's allocation, as capability projects).
  resetSafAllocation(s);
  const salloc = safAllocation(s);
  for (const id of [...q]) {
    const n = node(id);
    if (!n || !isLineNode(n)) continue;
    const cap = projectCapacity(s, id);
    if (cap <= 0) continue;
    let st = p.tree[id];
    // A new attempt starts (progress restarts).
    if (!st || st.status !== 'researching') st = p.tree[id] = { status: 'researching', progress: 0, attempts: (st?.attempts ?? 0) + 1 };
    let tm = 0;
    for (const t of p.teams) if (t.projectId === id) tm += t.heads / CAPACITY_UNIT / 30;
    st.tm = (st.tm ?? 0) + tm;
    const teams = teamsOn(s, id);
    const ts = st;
    let done = false;
    const r = lineRates(s, id, salloc);
    stepProject(s, ctx, n, {
      dept: 'saf', trial: safState(s, ts, n), sciRate: r.sci, expRate: r.exp, flopDay: r.flop,
      onResult: (works) => { done = resolveLine(s, ctx, n, ts, works); },
    });
    const live = p.tree[id];
    if (live && live.status === 'researching') live.progress = safProgress(live.saf);
    if (!done) continue;
    q.splice(q.indexOf(id), 1);
    // RD-R03: the teams are free; tomorrow's plan places them (the line's next project only if the player queues it).
    for (const t of teams) {
      delete t.projectId;
      delete t.manual;
    }
  }
}

/** research (35, daily): tree projects (capability and safety). */
export const researchSystem: EngineSystem = {
  id: 'research', owner: 'WS1', cadence: 'daily', order: 35, system: 'research',
  run(s, ctx) {
    if (s.player.status !== 'active') return;
    researchDay(s, ctx);
  },
};

/** Why a design option is locked (the node that unlocks it is not known), or undefined. */
export function optionLocked(s: GameStateV2, slot: OptionSlot, value: string | boolean): string | undefined {
  const id = OPTION_NODE[`${slot}:${String(value)}`];
  if (!id) return undefined;
  const n = node(id) as TreeNodeDef;
  return nodeKnown(s, id) ? undefined : `Needs ${n.name} (Research)`;
}


/** Counts for the tree header: known ideas of all ideas. */
export function treeCounts(s: GameStateV2): { known: number; total: number } {
  let known = 0;
  for (const n of TREE) if (nodeKnown(s, n.id)) known++;
  return { known, total: TREE.length };
}

