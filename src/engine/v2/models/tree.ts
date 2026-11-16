// The tech tree and capability research projects (TECH-TREE.md, STRUCTURE §4.2, BUILD-PLAN R4). Owner: WS1.
//
// A node opens when its prerequisites are known (no capability gates). The player queues projects (priority order) and
// assigns capabilities science teams; with the auto-assign policy idle teams join the highest-priority ready project in
// their specialty, else the ready project with the least capacity. Progress/day = M · √capacity / (effort · 30), where
// M is the lab's research speed (D3: absolute, so takeoff speeds the tree up) and capacity = Σ heads/40 × quality ×
// 1.5 in the team's specialty column. At progress 1 the attempt resolves: paradigm nodes use the hidden paradigm draw
// on the first attempt; every other attempt uses hash32(seed, 'node:'+id[+':'+attempt]).
// Success makes the node known (a paradigm is adopted at once); failure allows a retry after 180 days at half odds.
// Safety nodes mirror techniques (read-only until R8); product-feature nodes wait for live products (R6).
import { PARADIGMS } from '../../../data/v2/paradigms';
import { CAPACITY_UNIT, EFFORT_TM, OPTION_NODE, SAFETY_COLUMNS, SPECIALTY_BONUS, TREE, TREE_BY_ID, TREE_RETRY_DAYS, type OptionSlot, type TreeNodeDef } from '../../../data/v2/tree';
import { QUALITY } from '../../../data/v2/teams';
import { fmtDate, dateOf } from '../core/time';
import { hash32 } from '../core/rng';
import { bookCash } from '../finance/ledger';
import type { EngineSystem, GameStateV2, ResearchState, SetupV2, SystemCtx, Team, TreeNodeState } from '../types';
import { measuredDomain, PARADIGM_BY_ID } from './paradigms';

/** Safety-column nodes stay read-only (mirrors of techniques) until safety projects arrive (R8). */
export const SAFETY_PROJECTS_LIVE = false;

export type NodeStatus = 'known' | 'active' | 'queued' | 'open' | 'locked' | 'failed' | 'line' | 'soon';

const node = (id: string): TreeNodeDef | undefined => TREE_BY_ID[id];

/** Start state: ★ nodes known by every company, plus (leader start, until R9's start data) the features the game
 *  already has. */
export function initialTree(setup: Pick<SetupV2, 'start'>): Record<string, TreeNodeState> {
  const out: Record<string, TreeNodeState> = {};
  for (const n of TREE) if (n.star || (n.leaderKnown && (setup.start ?? 'leader') === 'leader')) out[n.id] = { status: 'known', progress: 1, day: 0 };
  return out;
}

export const initialResearch = (): ResearchState => ({ queue: [], autoAssign: true });

/** Read-only safety node (mirrors a technique or an agenda finding until R8). */
export const isMirror = (n: TreeNodeDef) => !SAFETY_PROJECTS_LIVE && SAFETY_COLUMNS.includes(n.column) && !n.paradigm;
/** Whether the player can run a project on this node now (kind of node, not its prerequisites). */
export const isProject = (n: TreeNodeDef) => !isMirror(n) && !n.soon && !n.star;

/** A read-only safety node is known when its technique is unlocked (or its agenda produced a technique finding). */
function mirrorKnown(s: GameStateV2, n: TreeNodeDef): boolean {
  const saf = s.player.safety;
  if (n.technique) return !!saf.techniques[n.technique]?.unlocked;
  if (n.agenda) return saf.findings.some((f) => f.agenda === n.agenda && f.type === 'TECH');
  return false;
}

/** Whether a node is known. */
export function nodeKnown(s: GameStateV2, id: string): boolean {
  if (s.player.tree[id]?.status === 'known') return true;
  const n = node(id);
  return !!n && isMirror(n) && mirrorKnown(s, n);
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
  if (isMirror(n)) return 'line';
  if (n.soon) return 'soon';
  const queued = s.player.research.queue.includes(id);
  if (queued) return teamsOn(s, id).length > 0 ? 'active' : 'queued';
  if (s.player.tree[id]?.status === 'failed') return 'failed';
  return missingNeeds(s, id).length ? 'locked' : 'open';
}

/** Effort in standard-team-months at M = 1. */
export const effortOf = (n: TreeNodeDef): number => n.effortTM ?? EFFORT_TM[n.effort ?? 'M'];

/** Odds of the next attempt (paradigm prior or the node's odds, × ½ per failure). */
export function nodeOdds(s: GameStateV2, id: string): number {
  const n = node(id);
  if (!n) return 0;
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

/** Research speed used by projects (the production readout's M; D3). */
export const researchSpeed = (s: GameStateV2) => s.player.prodCache?.M ?? 1;

/** Progress per day of a project at a capacity (default: its teams). */
export function projectRate(s: GameStateV2, id: string, cap = projectCapacity(s, id)): number {
  const n = node(id);
  if (!n || cap <= 0) return 0;
  return (researchSpeed(s) * Math.sqrt(cap)) / (effortOf(n) * 30);
}

/** Days to finish at today's speed (Infinity with no teams). */
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
  if (isMirror(n)) return 'Comes from a Safety research line';
  if (n.soon) return 'A product feature: opens with live products';
  const miss = missingNeeds(s, id);
  if (miss.length) return `Needs ${miss.map((m) => node(m)?.name ?? m).join(', ')}`;
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
    if (!isProject(nx)) return `Needs ${nx.name} (${isMirror(nx) ? 'from a Safety research line' : 'not researchable yet'})`;
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

/** Science teams that can take capability projects (capabilities department; safety scientists work on the Safety
 *  research lines until R8). */
export const projectTeams = (s: GameStateV2): Team[] => s.player.teams.filter((t) => t.role === 'sci' && t.dept === 'cap');

/** Why a team cannot work on a project, or undefined. */
export function assignBlock(s: GameStateV2, teamId: string, id: string): string | undefined {
  const t = s.player.teams.find((x) => x.id === teamId);
  if (!t) return 'No such team';
  if (t.role !== 'sci') return 'Only science teams run research projects';
  if (t.dept !== 'cap') return 'Safety scientists work on the Safety research lines';
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

/** Idle project teams: capabilities science teams with no project (or a project that cannot run). */
export const idleTeams = (s: GameStateV2): Team[] => projectTeams(s).filter((t) => !t.projectId);

/** Auto-assign policy: each idle team joins the highest-priority ready project in its specialty, else the ready
 *  project with the least capacity (ties: priority). Then every ready project left with no team takes one from the
 *  project with the most teams (if it has two or more): a team of the starving project's specialty if there is one,
 *  else the donor's least useful team. Projects run side by side (√ capacity rewards spreading). */
export function autoAssign(s: GameStateV2) {
  const ready = s.player.research.queue.filter((id) => projectReady(s, id) === true);
  if (!ready.length) return;
  const idle = idleTeams(s);
  const pool = projectTeams(s);
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
    if (!pick) continue;
    t.projectId = pick;
    cap.set(pick, (cap.get(pick) ?? 0) + teamCapacity(t, node(pick) as TreeNodeDef));
  }
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

/** One day of research projects: drop teams from projects that cannot run, auto-assign idle teams, progress, resolve. */
export function researchDay(s: GameStateV2, ctx: SystemCtx) {
  const p = s.player;
  const q = p.research.queue;
  // Known or unrunnable projects leave the queue / free their teams.
  for (let i = q.length - 1; i >= 0; i--) if (nodeKnown(s, q[i]) || !node(q[i])) q.splice(i, 1);
  for (const t of p.teams) {
    if (!t.projectId) continue;
    if (t.role !== 'sci' || t.dept !== 'cap' || !q.includes(t.projectId) || projectReady(s, t.projectId) !== true) delete t.projectId;
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

/** research (35, daily): tree projects. */
export const researchSystem: EngineSystem = {
  id: 'research', owner: 'WS1', cadence: 'daily', order: 35, system: 'research',
  run(s, ctx) {
    if (s.player.status !== 'active') return;
    researchDay(s, ctx);
  },
};

/** Why a design option is locked (the node that unlocks it is not known), or undefined. Options unlocked by safety
 *  nodes stay open until those nodes become projects (R8). */
export function optionLocked(s: GameStateV2, slot: OptionSlot, value: string | boolean): string | undefined {
  const id = OPTION_NODE[`${slot}:${String(value)}`];
  if (!id) return undefined;
  const n = node(id) as TreeNodeDef;
  if (isMirror(n)) return undefined;
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
export const TREE_PARADIGMS = PARADIGMS.map((p) => p.id).filter((id) => TREE_BY_ID[id]);

/** Know-how (STRUCTURE §4.2): the lab's know-how and how much of it the internal model embodies (its base's know-how
 *  plus κ of what came after, or the stream's tracked know-how). The gap is the reason to train. Years of progress. */
export function knowHow(s: GameStateV2): { pa: number; inModel: number; gap: number; versionName?: string } {
  const p = s.player;
  const v = p.models.versions.find((x) => x.id === p.models.internalAgent);
  const b = v?.build;
  let inModel = p.pa;
  if (b) inModel = p.models.stream?.versionId === v?.id && p.models.stream.paTrack !== undefined ? p.models.stream.paTrack : b.paBase + b.kappa * (b.paPost - b.paBase);
  return { pa: p.pa, inModel, gap: Math.max(0, p.pa - inModel), ...(v ? { versionName: v.name } : {}) };
}
