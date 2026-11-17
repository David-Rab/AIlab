// The tech tree and its research projects (TECH-TREE.md, STRUCTURE §4.2, §4.5, BUILD-PLAN R4, R8). Owner: WS1.
//
// A node opens when its prerequisites are known (no capability gates). The player queues projects (priority order) and
// assigns science teams of the node's department (capability columns: capabilities scientists; alignment,
// interpretability and evals & control: safety scientists). With the auto-assign policy idle teams join the
// highest-priority ready project of their department in their specialty, else the ready one with the least capacity.
// Capacity = Σ heads/40 × quality × 1.5 in the team's specialty column.
//  - Capability and other rolled nodes: progress/day = M · √capacity / (effort · 30), M = research speed (D3: absolute,
//    so takeoff speeds the tree up). At progress 1 the attempt resolves: paradigm nodes use the hidden paradigm draw on
//    the first attempt; every other attempt uses hash32(seed, 'node:'+id[+':'+attempt]). Success makes the node known (a
//    paradigm is adopted at once); failure allows a retry after 180 days at half odds.
//  - Research-line nodes (R8; a safety node with an agenda): progress/day = safety/agendas.ts lineRate (√(capacity ÷
//    SERIOUS_CAP)/(30·T₁) × compute × AI labour; no research speed, as the pre-R8 hazard). At progress 1 the line
//    produces one result (findings.ts fireFinding, typed by the line's hidden efficacy). A working result of this node
//    unlocks it; any other result restarts the project, and a dead end adds its team-months to the line's dead-end count.
//    When a node becomes known its teams move on to the line's next open node, else the line's follow-up project.
// Product-feature nodes wait for live products (R6).
import { AG17_MIN_L, AGENDAS } from '../../../data/v2/agendas';
import { PARADIGMS } from '../../../data/v2/paradigms';
import { START_BY_ID } from '../../../data/v2/starts';
import {
  CAPACITY_UNIT, EFFORT_TM, OPTION_NODE, PROJECT_BY_ID, SPECIALTY_BONUS, TREE, TREE_RETRY_DAYS, isLineNode, lineNodeId,
  type OptionSlot, type TreeNodeDef,
} from '../../../data/v2/tree';
import { COLUMN_DEPT, QUALITY } from '../../../data/v2/teams';
import { fmtDate, dateOf } from '../core/time';
import { hash32 } from '../core/rng';
import { bookCash } from '../finance/ledger';
import type { AgendaId, Column, EngineSystem, GameStateV2, ResearchState, SetupV2, SystemCtx, Team, TeamDept, TreeNodeState } from '../types';
import { measuredDomain, PARADIGM_BY_ID } from './paradigms';
import { lineCapacity, lineRate, posteriorBand } from '../safety/agendas';
import { safetyAgentL } from '../safety/agents';
import { fireFinding } from '../safety/findings';

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

/** Start research state: the start safety teams on their projects (queued in that order). */
export function initialResearch(teams: Team[] = []): ResearchState {
  const queue: string[] = [];
  for (const t of teams) {
    if (t.role !== 'sci' || t.dept !== 'saf' || !t.specialty) continue;
    const id = START_SAFETY_PROJECTS[t.specialty];
    if (!id) continue;
    t.projectId = id;
    if (!queue.includes(id)) queue.push(id);
  }
  return { queue, autoAssign: true };
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
  const queued = s.player.research.queue.includes(id);
  if (queued) return teamsOn(s, id).length > 0 ? 'active' : 'queued';
  if (s.player.tree[id]?.status === 'failed') return 'failed';
  return missingNeeds(s, id).length ? 'locked' : 'open';
}

/** Effort in standard-team-months at M = 1 (research-line nodes: T₁ at serious staffing). */
export const effortOf = (n: TreeNodeDef): number => n.effortTM ?? EFFORT_TM[n.effort ?? 'M'];

/** Odds of the next attempt: paradigm prior or the node's odds, × ½ per failure; a research-line node shows its line's
 *  estimated chance of a working result (the posterior mean, never the hidden efficacy). */
export function nodeOdds(s: GameStateV2, id: string): number {
  const n = node(id);
  if (!n) return 0;
  if (isLineNode(n)) return posteriorBand(s.player.safety.agendas[n.agenda as AgendaId]).mean;
  const base = n.paradigm ? (PARADIGM_BY_ID[id]?.prior ?? 1) : (n.odds ?? 1);
  return base * (s.player.tree[id]?.priorMult ?? 1);
}

/** One team's capacity on a node: heads/40 × quality × 1.5 in its specialty. */
export function teamCapacity(t: Pick<Team, 'heads' | 'quality' | 'specialty'>, n: Pick<TreeNodeDef, 'column'>): number {
  return (t.heads / CAPACITY_UNIT) * QUALITY[t.quality].out * (t.specialty === n.column ? SPECIALTY_BONUS : 1);
}

/** Capacity on a project (optionally with a team added or removed). */
export function projectCapacity(s: GameStateV2, id: string, add?: Team, remove?: string): number {
  const n = node(id);
  if (!n) return 0;
  let c = 0;
  for (const t of s.player.teams) if (t.projectId === id && t.id !== remove && t.id !== add?.id) c += teamCapacity(t, n);
  if (add) c += teamCapacity(add, n);
  return c;
}

/** Research speed used by capability projects (the production readout's M; D3). */
export const researchSpeed = (s: GameStateV2) => s.player.prodCache?.M ?? 1;

/** Progress per day of a project at a capacity (default: its teams). */
export function projectRate(s: GameStateV2, id: string, cap?: number): number {
  const n = node(id);
  if (!n) return 0;
  const now = projectCapacity(s, id);
  const c = cap ?? now;
  if (c <= 0) return 0;
  if (isLineNode(n)) {
    const ag = n.agenda as AgendaId;
    return lineRate(s, ag, c, cap === undefined || Math.abs(c - now) < 1e-9 ? undefined : lineCapacity(s, ag) - now + c);
  }
  return (researchSpeed(s) * Math.sqrt(c)) / (effortOf(n) * 30);
}

/** Days to finish (research-line projects: to the next result) at today's speed (Infinity with no teams). */
export function projectEta(s: GameStateV2, id: string, cap?: number): number {
  const r = projectRate(s, id, cap);
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
  if (st?.status === 'failed' && (st.retryDay ?? 0) > s.time.day) return `Retry from ${fmtDate(dateOf(s, st.retryDay ?? 0))}`;
  if (n.cashCost && st?.status !== 'researching' && s.player.finance.cash < n.cashCost) return `Needs $${n.cashCost}B cash`;
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
  for (const t of s.player.teams) if (t.projectId === id) delete t.projectId;
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
  return undefined;
}

/** Take a team off its project (it goes idle; the policy may reassign it tomorrow). */
export function unassignTeam(s: GameStateV2, teamId: string): string | undefined {
  const t = s.player.teams.find((x) => x.id === teamId);
  if (!t) return 'No such team';
  delete t.projectId;
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

/** Auto-assign policy for one department: each idle team joins the highest-priority ready project in its specialty,
 *  else the ready project with the least capacity. Then every ready project left with no team takes one from the
 *  project with the most teams (if it has two or more). Safety teams with nothing queued join a research line
 *  (lineForTeam). Projects run side by side (√ capacity rewards spreading). */
function autoAssignDept(s: GameStateV2, dept: TeamDept) {
  const q = s.player.research.queue;
  const ready = q.filter((id) => {
    const n = node(id);
    return !!n && nodeDept(n) === dept && projectReady(s, id) === true;
  });
  const idle = idleTeams(s, dept);
  const pool = projectTeams(s, dept);
  const cap = new Map(ready.map((id) => [id, projectCapacity(s, id)]));
  for (const id of ready) {
    if (idle.length || pool.some((t) => t.projectId === id)) continue;
    // Donor: the project with the most teams (≥ 2).
    const counts = new Map<string, Team[]>();
    for (const t of pool) if (t.projectId) (counts.get(t.projectId) ?? counts.set(t.projectId, []).get(t.projectId) as Team[]).push(t);
    let donor: Team[] | undefined;
    for (const ts of counts.values()) if (ts.length >= 2 && (!donor || ts.length > donor.length)) donor = ts;
    if (!donor) break;
    const target = node(id) as TreeNodeDef;
    const from = node(donor[0].projectId as string) as TreeNodeDef;
    const t = donor.find((x) => x.specialty === target.column) ?? donor.reduce((a, x) => (teamCapacity(x, from) < teamCapacity(a, from) ? x : a));
    const fromId = t.projectId as string;
    cap.set(fromId, (cap.get(fromId) ?? 0) - teamCapacity(t, from));
    t.projectId = id;
    cap.set(id, teamCapacity(t, target));
  }
  for (const t of idle) {
    let pick = ready.find((id) => node(id)?.column === t.specialty);
    if (!pick) {
      let best = Infinity;
      for (const id of ready) {
        const c = cap.get(id) ?? 0;
        if (c < best - 1e-9) {
          best = c;
          pick = id;
        }
      }
    }
    if (!pick && dept === 'saf') {
      pick = lineForTeam(s, t);
      if (pick && !q.includes(pick)) q.push(pick);
    }
    if (!pick) continue;
    t.projectId = pick;
    cap.set(pick, (cap.get(pick) ?? 0) + teamCapacity(t, node(pick) as TreeNodeDef));
  }
}

/** Auto-assign policy (both departments). */
export function autoAssign(s: GameStateV2) {
  autoAssignDept(s, 'cap');
  autoAssignDept(s, 'saf');
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
function syncParadigm(s: GameStateV2, id: string) {
  const ps = s.player.paradigms[id];
  const st = s.player.tree[id];
  if (!ps || !st) return;
  ps.status = st.status === 'known' ? 'adopted' : st.status === 'failed' ? 'failed' : 'researching';
  ps.progress = st.status === 'known' ? 1 : st.progress;
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
    if (t.role !== 'sci' || !n || t.dept !== nodeDept(n) || !q.includes(t.projectId) || projectReady(s, t.projectId) !== true) delete t.projectId;
  }
  if (p.research.autoAssign) autoAssign(s);
  let freed = false;
  for (const id of [...q]) {
    const n = node(id);
    if (!n) continue;
    const cap = projectCapacity(s, id);
    if (cap <= 0) continue;
    let st = p.tree[id];
    if (!st || st.status !== 'researching') {
      // A new attempt starts: first ever, or a retry after the retry date (progress restarts).
      const attempts = (st?.attempts ?? 0) + 1;
      st = p.tree[id] = { status: 'researching', progress: 0, attempts, ...(st?.priorMult !== undefined ? { priorMult: st.priorMult } : {}) };
      if (n.cashCost) bookCash(s, ctx, -n.cashCost, 'training', 'research project', n.name);
      if (n.paradigm) syncParadigm(s, id);
    }
    st.progress = Math.min(1, st.progress + projectRate(s, id, cap));
    if (n.paradigm) s.player.paradigms[id].progress = st.progress;
    if (isLineNode(n)) {
      let tm = 0;
      for (const t of p.teams) if (t.projectId === id) tm += t.heads / CAPACITY_UNIT / 30;
      st.tm = (st.tm ?? 0) + tm;
      if (st.progress < 1) continue;
      const teams = teamsOn(s, id);
      if (!resolveLine(s, ctx, n, st)) continue;
      const at = q.indexOf(id);
      q.splice(at, 1);
      for (const t of teams) delete t.projectId;
      if (p.research.autoAssign) continueLine(s, n.agenda as AgendaId, at, teams);
      freed = true;
      continue;
    }
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
    for (const t of p.teams) if (t.projectId === id) delete t.projectId;
    freed = true;
  }
  if (freed && p.research.autoAssign) autoAssign(s);
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

/** How much a node's effect pays off now (0..1): P13 with the internal model's RSCH (6.5 → 8.5), P20 with the agent
 *  pool (2M H100e), P24 with the AI share of research labour (50% → 90%). 1 for every other node. */
export function payoffOf(s: GameStateV2, id: string): number {
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  if (id === 'P13') return clamp01((measuredDomain(s, 'RSCH') - 6.5) / 2);
  if (id === 'P20') return clamp01((s.player.computeOnline * s.player.split.agents) / 2e6);
  if (id === 'P24') return clamp01((1 - (s.player.prodCache?.labor.wH ?? 1) - 0.5) / 0.4);
  return 1;
}

/** Counts for the tree header: known ideas of all ideas. */
export function treeCounts(s: GameStateV2): { known: number; total: number } {
  let known = 0;
  for (const n of TREE) if (nodeKnown(s, n.id)) known++;
  return { known, total: TREE.length };
}

/** Paradigm ids in the tree (sanity: every paradigm has a node). */
export const TREE_PARADIGMS = PARADIGMS.map((p) => p.id).filter((id) => TREE.some((n) => n.id === id));

/** Know-how (STRUCTURE §4.2): the lab's know-how and how much of it the internal model embodies (its base's know-how
 *  plus κ of what came after, or the stream's tracked know-how). The gap is the reason to train. Years of progress. */
export function knowHow(s: GameStateV2): { pa: number; inModel: number; gap: number; versionName?: string } {
  const p = s.player;
  const v = p.models.versions.find((x) => x.id === p.agents.capRoutine.versionId);
  const b = v?.build;
  let inModel = p.pa;
  if (b) inModel = p.models.stream?.versionId === v?.id && p.models.stream.paTrack !== undefined ? p.models.stream.paTrack : b.paBase + b.kappa * (b.paPost - b.paBase);
  return { pa: p.pa, inModel, gap: Math.max(0, p.pa - inModel), ...(v ? { versionName: v.name } : {}) };
}
