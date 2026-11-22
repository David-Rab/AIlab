// The tech tree and its research projects (TECH-TREE.md, STRUCTURE §4.2, §4.5, BUILD-PLAN R4, R8). Owner: WS1.
// Model v3 V2: capability projects run the research lifecycle of models/research.ts (ideation → small experiments →
// scale test → result → adoption into the recipe stacks; scientists assigned by priority and teams wanted; research
// engineers by need). The text below the first paragraph describes the safety path.
//
// A node opens when its prerequisites are known (no capability gates). The player queues projects (priority order) and
// assigns science teams of the node's department (capability columns: capabilities scientists; alignment,
// interpretability and evals & control: safety scientists). Capabilities science teams are placed every day by the
// priority assignment of models/research.ts (planAssignment). Safety science teams, with the auto-assign policy on
// (J2 R2), spread over the ready queued safety projects: each goes where it cuts the most days off a project's ETA,
// weighted by queue priority (√ capacity: every extra team on one project gains less), and the policy's teams re-spread
// when a project finishes or a ready project has no team; a team with nothing queued joins a research line. Teams placed
// by hand stay put. Capacity = Σ heads/40 × quality × 1.5 in the team's specialty column.
//  - Rolled (safety) nodes: progress/day = speed · √capacity / (effort · 30), speed = researchSpeed: the research
//    engine's experiment labour factor ℓ (research.last.x, RD-R01) × the siloing / migration modifiers (until RD-R04,
//    SYNTHESIS §6 Phase 3, retires the rolled path). At progress 1 the attempt resolves:
//    paradigm nodes use the hidden paradigm draw on the first attempt; every other attempt uses hash32(seed,
//    'node:'+id[+':'+attempt]). Success makes the node known (a paradigm is adopted at once); failure allows a retry
//    after 180 days at half odds.
//  - Research-line nodes (R8; a safety node with an agenda; model v3 E1): the project mechanism of capability projects
//    (safety/lineProjects.ts): ideation by the safety scientists, small experiments and validation on the frontier
//    model by safety research engineers with compute, rates from the experiment CES; T₁ at reference inputs. Each
//    validated candidate is one result (findings.ts fireFinding, typed by the line's hidden efficacy). A working result
//    of this node unlocks it; any other result lets the project test its next candidate, and a dead end adds the
//    attempt's team-months to the line's dead-end count. When a node becomes known its teams move on to the line's next
//    open node, else the line's follow-up project. Safety teams keep the J2 auto-assign above (E1 notes: why not the
//    capability assignment).
// Product-feature nodes wait for live products (R6).
import { AG17_MIN_L, AGENDAS } from '../../../data/v2/agendas';
import { START_BY_ID } from '../../../data/v2/starts';
import {
  CAPACITY_UNIT, EFFORT_TM, OPTION_NODE, PROJECT_BY_ID, TREE, TREE_RETRY_DAYS, isLineNode, lineNodeId,
  type OptionSlot, type TreeNodeDef,
} from '../../../data/v2/tree';
import { COLUMN_DEPT } from '../../../data/v2/teams';
import { fmtDate, dateOf } from '../core/time';
import { hash32 } from '../core/rng';
import { teamCapacity } from '../departments/capacity';
import type { AgendaId, Column, EngineSystem, GameStateV2, ResearchState, SetupV2, SystemCtx, Team, TeamDept, TreeNodeState } from '../types';
import { PARADIGM_BY_ID } from './paradigms';
import { posteriorBand } from '../safety/agendas';
import { lineCycleDays, lineEtaDays, resetSafAllocation, safAllocation, stepLineProject } from '../safety/lineProjects';
import { queueBuild } from '../departments/build';
import { researchMods } from '../departments/workfit';
import {
  assignCapTeams, attemptOdds, capEta, capProgress, capResearchDay, isCapProject, sciOn, takesTeams,
} from './research';
import { safetyAgentL } from '../safety/agents';
import { fireFinding } from '../safety/findings';
import { DEFAULT_LINES, DEFAULT_RE_ALLOC } from '../../../data/v2/research';
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
  return { queue, autoAssign: true, ...cap };
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
export function initialCapResearch(): Pick<ResearchState, 'want' | 'wantAuto' | 'risk' | 're' | 'stacks' | 'adopted' | 'hist' | 'domainG'> {
  return {
    want: {}, wantAuto: [], risk: 'balanced', re: { order: [...DEFAULT_RE_ALLOC.order], max: { ...DEFAULT_RE_ALLOC.max }, share: { ...DEFAULT_RE_ALLOC.share } },
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

/** Team-months at research speed 1 of a project the research system rolls (projectRate); readouts of any project's work
 *  read effortOfNode (models/research.ts), which also covers capability and research-line projects. */
export const effortOf = (n: TreeNodeDef): number => n.effortTM ?? EFFORT_TM[n.effort ?? 'M'];

/** Odds of the next attempt: paradigm prior or the node's odds, × ½ per failure; a research-line node shows its line's
 *  estimated chance of a working result (the posterior mean, never the hidden efficacy). */
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
  const base = n.paradigm ? (PARADIGM_BY_ID[id]?.prior ?? 1) : (n.odds ?? 1);
  return base * (s.player.tree[id]?.priorMult ?? 1);
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

/** Research speed of the rolled (safety) nodes (until RD-R04, SYNTHESIS §6 Phase 3), measured (RD-R01): the
 *  experiment labour factor ℓ = m_EXP^λ the research engine ran its last day at (humans only = 1) × the siloing /
 *  migration modifiers (a pause or treaty does not slow them, as before). */
export function researchSpeed(s: GameStateV2): number {
  const m = researchMods(s);
  return (s.player.research.last?.x?.l ?? 1) * (m.speed / m.rateMult);
}

/** Progress per day of a project the research system rolls (research-line projects: results per day once the pipeline
 *  is full; any other non-capability project: √ capacity × research speed over its team-months). Capability projects run
 *  their stages (models/research.ts) and read their ETA from capEta. */
export function projectRate(s: GameStateV2, id: string, cap?: number): number {
  const n = node(id);
  if (!n || isCapProject(n)) return 0;
  const now = projectCapacity(s, id);
  const c = cap ?? now;
  if (c <= 0) return 0;
  // Model v3 E1: a line project's results per day once its pipeline is full (safety/lineProjects.ts).
  if (isLineNode(n)) return 1 / lineCycleDays(s, id, cap === undefined || Math.abs(c - now) < 1e-9 ? undefined : c);
  return (researchSpeed(s) * Math.sqrt(c)) / (effortOf(n) * 30);
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
 *  lineEtaDays, other projects their rate. `staff` previews a science capacity or a team joining / leaving. Infinity
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
  if (isLineNode(n)) return c > 0 ? lineEtaDays(s, id, same ? undefined : c) : Infinity;
  const r = projectRate(s, id, c);
  const left = 1 - (s.player.tree[id]?.status === 'researching' ? s.player.tree[id].progress : 0);
  return r > 0 ? left / r : Infinity;
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
  if (st?.status === 'failed' && (st.retryDay ?? 0) > s.time.day) return `Retry from ${fmtDate(dateOf(s, st.retryDay ?? 0))}`;
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

/** Whether a team works on a research line (any of its projects). */
const onLine = (t: Team, ag: AgendaId) => {
  const n = t.projectId ? node(t.projectId) : undefined;
  return !!n && n.agenda === ag && isLineNode(n);
};

/** The line an idle safety team joins when nothing is queued for it: lines with no team first, then the best estimate,
 *  then its specialty. */
function lineForTeam(s: GameStateV2, t: Team): string | undefined {
  let best: { id: string; score: number } | undefined;
  for (const a of AGENDAS) {
    const id = nextLineProject(s, a.id);
    if (!id) continue;
    const staffed = s.player.teams.some((x) => onLine(x, a.id));
    const score = (staffed ? 0 : 10) + posteriorBand(s.player.safety.agendas[a.id]).mean * 2 + (node(id)?.column === t.specialty ? 0.5 : 0);
    if (!best || score > best.score + 1e-9) best = { id, score };
  }
  return best?.id;
}

/** Weight of a project by its place among the ready projects (queue priority) [D]: the second counts half the first. */
export const PRIORITY_W = 0.5;

/** Auto-assign policy for one department (J2 R2; only autoAssign calls it, for safety): spread teams over the ready queued projects. Each team in turn goes
 *  where it gains most: a project with no team first (in queue order, a team of its specialty first), otherwise the
 *  most ETA days cut × PRIORITY_W^rank (√ capacity, so returns fall per extra team). Idle teams are placed every day;
 *  with `respread` every team the policy placed is re-placed (a project finished, or a ready project has no team while
 *  another has two or more). Teams placed by hand stay. Safety teams with nothing queued join a research line. */
function autoAssignDept(s: GameStateV2, dept: TeamDept, respread: boolean) {
  const q = s.player.research.queue;
  const ready = q.filter((id) => {
    const n = node(id);
    return !!n && nodeDept(n) === dept && projectReady(s, id) === true;
  });
  const pool = projectTeams(s, dept);
  // Teams on a research line stay with the line (its results build on each other); the policy's other teams move.
  const lineTeam = (t: Team) => {
    const n = t.projectId ? node(t.projectId) : undefined;
    return !!n && isLineNode(n);
  };
  if (!respread && ready.some((id) => !pool.some((t) => t.projectId === id))) {
    const counts = new Map<string, number>();
    for (const t of pool) if (t.projectId && !t.manual && !lineTeam(t)) counts.set(t.projectId, (counts.get(t.projectId) ?? 0) + 1);
    respread = [...counts.values()].some((c) => c >= 2);
  }
  const free = pool.filter((t) => !t.projectId || (respread && !t.manual && !lineTeam(t) && ready.includes(t.projectId)));
  if (!free.length) return;
  for (const t of free) delete t.projectId;
  const cap = new Map(ready.map((id) => [id, projectCapacity(s, id)]));
  const eta = (id: string, c: number) => (c > 0 ? projectEta(s, id, c) : Infinity);
  const left = [...free];
  while (left.length && ready.length) {
    let best: { t: Team; id: string; score: number } | undefined;
    for (const t of left) {
      for (let r = 0; r < ready.length; r++) {
        const id = ready[r];
        const n = node(id) as TreeNodeDef;
        const c = cap.get(id) ?? 0;
        // An unstaffed project outranks any gain (queue order, then specialty); else days cut × priority weight.
        const score = c <= 0 ? 1e12 * (ready.length - r) + (t.specialty === n.column ? 1e11 : 0) : (eta(id, c) - eta(id, c + teamCapacity(t, n.column))) * Math.pow(PRIORITY_W, r);
        if (!best || score > best.score + 1e-9) best = { t, id, score };
      }
    }
    if (!best) break;
    best.t.projectId = best.id;
    cap.set(best.id, (cap.get(best.id) ?? 0) + teamCapacity(best.t, (node(best.id) as TreeNodeDef).column));
    left.splice(left.indexOf(best.t), 1);
  }
  if (dept !== 'saf') return;
  for (const t of left) {
    const pick = lineForTeam(s, t);
    if (!pick) continue;
    if (!q.includes(pick)) q.push(pick);
    t.projectId = pick;
  }
}

/** Auto-assign policy, safety science teams only (capabilities teams use the priority assignment of models/research.ts,
 *  assignCapTeams); `respread` re-places every team the policy placed (a project finished). */
export function autoAssign(s: GameStateV2, respread = false) {
  autoAssignDept(s, 'saf', respread);
}

/** Roll an attempt's result. Outcomes are drawn per world (TECH-TREE §1.3): a paradigm's first attempt is the hidden
 *  draw from newGame; every other attempt is hash32(seed, 'node:'+id[+':'+attempt]) against its odds, so a result never
 *  depends on when the project ends or on other draws (before R4 paradigm retries drew from the 'runs' stream). */
function roll(s: GameStateV2, n: TreeNodeDef, st: TreeNodeState): boolean {
  const attempt = st.attempts ?? 1;
  if (n.paradigm && attempt <= 1) return s.hidden.paradigmSuccess[n.id] === true;
  const u = hash32(s.setup.seed, attempt <= 1 ? `node:${n.id}` : `node:${n.id}:${attempt}`) / 4294967296;
  return u < nodeOdds(s, n.id);
}

/** Mirror a paradigm node's state for `adopted()` readers. */
export function syncParadigm(s: GameStateV2, id: string) {
  const ps = s.player.paradigms[id];
  const st = s.player.tree[id];
  if (!ps || !st) return;
  ps.status = st.status === 'known' ? 'adopted' : st.status === 'failed' ? 'failed' : 'researching';
  ps.progress = st.status === 'known' ? 1 : st.cap ? capProgress(st.cap) : st.progress;
  if (st.day !== undefined && st.status !== 'researching') ps.revealedDay = st.day;
}

/** A research-line project reached progress 1: the line produces a result. Returns true if the project is done (its
 *  node became known); otherwise it restarts. */
function resolveLine(s: GameStateV2, ctx: SystemCtx, n: TreeNodeDef, st: TreeNodeState): boolean {
  const ag = n.agenda as AgendaId;
  const line = s.player.safety.agendas[ag];
  const rec = fireFinding(s, ctx, ag, n.id);
  if (rec?.trueType === 'DEAD') line.deadEndTM = Math.round(((line.deadEndTM ?? 0) + (st.tm ?? 0)) * 100) / 100;
  st.tm = 0;
  st.progress = 0;
  st.attempts = (st.attempts ?? 1) + 1;
  if (!nodeKnown(s, n.id)) return false;
  st.status = 'known';
  st.day = ctx.day;
  return true;
}

/** Teams of a finished research-line project keep working the line (auto-assign on): its next project takes the
 *  finished one's place in the queue. */
function continueLine(s: GameStateV2, ag: AgendaId, done: number, teams: Team[]) {
  const next = nextLineProject(s, ag);
  if (!next || !teams.length) return;
  const q = s.player.research.queue;
  if (!q.includes(next)) q.splice(Math.min(done, q.length), 0, next);
  for (const t of teams) t.projectId = next;
}

/** One day of research projects: drop teams from projects that cannot run, auto-assign idle teams, progress, resolve. */
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
  for (const id of capReady) if (p.tree[id]?.cap && node(id)?.paradigm) syncParadigm(s, id);
  if (p.research.autoAssign) autoAssign(s);
  let freed = false;
  // Model v3 E1: today's safety research engineers and line compute for the line projects in experiments (a test that
  // starts today gets its engineers and FLOP from tomorrow's allocation, as capability projects).
  resetSafAllocation(s);
  const salloc = safAllocation(s);
  for (const id of [...q]) {
    const n = node(id);
    if (!n || isCapProject(n)) continue;
    const cap = projectCapacity(s, id);
    if (cap <= 0) continue;
    let st = p.tree[id];
    if (!st || st.status !== 'researching') {
      // A new attempt starts: first ever, or a retry after the retry date (progress restarts).
      const attempts = (st?.attempts ?? 0) + 1;
      st = p.tree[id] = { status: 'researching', progress: 0, attempts, ...(st?.priorMult !== undefined ? { priorMult: st.priorMult } : {}) };
      if (n.paradigm) syncParadigm(s, id);
    }
    if (isLineNode(n)) {
      let tm = 0;
      for (const t of p.teams) if (t.projectId === id) tm += t.heads / CAPACITY_UNIT / 30;
      st.tm = (st.tm ?? 0) + tm;
      const teams = teamsOn(s, id);
      const ts = st;
      let done = false;
      stepLineProject(s, id, ts, salloc, () => {
        done = resolveLine(s, ctx, n, ts);
        return !done;
      });
      if (!done) continue;
      const at = q.indexOf(id);
      q.splice(at, 1);
      // The line's teams stay on the line (its next project; a hand placement stays a hand placement).
      for (const t of teams) delete t.projectId;
      if (p.research.autoAssign) continueLine(s, n.agenda as AgendaId, at, teams);
      for (const t of teams) if (!t.projectId) delete t.manual;
      freed = true;
      continue;
    }
    st.progress = Math.min(1, st.progress + projectRate(s, id, cap));
    if (n.paradigm) s.player.paradigms[id].progress = st.progress;
    if (st.progress < 1) continue;
    const ok = roll(s, n, st);
    st.day = ctx.day;
    if (ok) {
      st.status = 'known';
      delete st.retryDay;
      ctx.log('research', `${n.name} works.${n.layer === 'lab' ? ' It applies at once.' : ''}`, 2, id);
    } else {
      st.status = 'failed';
      st.retryDay = ctx.day + TREE_RETRY_DAYS;
      st.priorMult = (st.priorMult ?? 1) * 0.5;
      ctx.log('research', `${n.name}: dead end for now. Retry from ${fmtDate(dateOf(s, st.retryDay))} at ${Math.round(nodeOdds(s, id) * 100)}%.`, 2, id);
    }
    if (n.paradigm) syncParadigm(s, id);
    q.splice(q.indexOf(id), 1);
    for (const t of p.teams) {
      if (t.projectId !== id) continue;
      delete t.projectId;
      delete t.manual;
    }
    freed = true;
  }
  if (freed && p.research.autoAssign) autoAssign(s, true);
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

