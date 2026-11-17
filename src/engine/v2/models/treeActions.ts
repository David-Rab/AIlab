// Research verbs (STRUCTURE §4.2, BUILD-PLAN R4): queue a project, start it now, reorder, drop it, assign or take off a
// science team, and the auto-assign policy. Owner: WS1. Previews work with empty params (defaults: the first open idea,
// the first capabilities science team) and show ≥ 1 cost in a currency not among the gains (lint-tradeoffs).
import { PROJECT_BY_ID, TREE } from '../../../data/v2/tree';
import type { ActionDef, CostLine, GameStateV2 } from '../types';
import {
  assignTeam, dequeueNode, effortOf, idleTeams, moveInQueue, nodeOdds, nodeStatus, projectCapacity, projectEta, projectTeams,
  queueNode, unassignTeam,
} from './tree';

type Params = Record<string, number | string | boolean>;
type Preview = ReturnType<ActionDef['preview']>;
const str = (p: Params, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);
const num = (p: Params, k: string, d: number) => (typeof p[k] === 'number' && Number.isFinite(p[k]) ? (p[k] as number) : d);
const fail = (why: string | undefined) => {
  if (why) throw new Error(why);
};

/** Default node for previews: the param, else the first open idea. */
const nodeParam = (s: GameStateV2, p: Params) => str(p, 'id', TREE.find((n) => nodeStatus(s, n.id) === 'open')?.id ?? 'P05');
const teamParam = (s: GameStateV2, p: Params) => str(p, 'team', projectTeams(s)[0]?.id ?? '');
const days = (x: number) => (Number.isFinite(x) ? Math.round(x) : 9999);

/** What researching a node costs and gives: team-months of science; capability (progress) or safety (alignment) gain
 *  with its odds; safety side effects as exposure. */
export function nodePreview(s: GameStateV2, id: string): Preview {
  const n = PROJECT_BY_ID[id];
  if (!n) return { costs: [{ currency: 'staffTime', amount: 0 }], gains: [], exposure: [] };
  const odds = nodeOdds(s, id);
  const costs: CostLine[] = [{ currency: 'staffTime', amount: Math.round(effortOf(n) * 10) / 10, target: 'science team-months' }];
  if (n.cashCost) costs.push({ currency: 'cash', amount: n.cashCost, target: 'data' });
  const gains: CostLine[] = [];
  const exposure: CostLine[] = [];
  if ((n.fx.cap ?? 0) > 0) gains.push({ currency: 'progress', amount: 0.1 * (n.fx.cap ?? 0), probability: odds, target: n.name });
  if ((n.fx.cap ?? 0) < 0) costs.push({ currency: 'progress', amount: 0.1 * (n.fx.cap ?? 0), target: 'when used' });
  if ((n.fx.saf ?? 0) > 0) gains.push({ currency: 'alignment', amount: 0.05 * (n.fx.saf ?? 0), probability: odds, target: n.name });
  if ((n.fx.saf ?? 0) < 0) exposure.push({ currency: 'alignment', amount: 0.05 * (n.fx.saf ?? 0), probability: odds });
  return { costs, gains, exposure };
}

export const TREE_ACTIONS: ActionDef[] = [
  {
    id: 'research.queue', verb: 'research', system: 'research', sphere: 'models', owner: 'WS1', title: 'Queue',
    available: (s) => (s.player.status === 'active' ? true : 'Lab inactive'),
    preview: (s, p) => nodePreview(s, nodeParam(s, p)),
    apply: (s, _ctx, p) => fail(queueNode(s, nodeParam(s, p), typeof p.at === 'number' ? num(p, 'at', 0) : undefined)),
  },
  {
    id: 'research.start', verb: 'research', system: 'research', sphere: 'models', owner: 'WS1', title: 'Start now',
    available: (s) => (s.player.status === 'active' ? true : 'Lab inactive'),
    preview: (s, p) => nodePreview(s, nodeParam(s, p)),
    // Top of the queue: the next idle team joins it (auto-assign), or assign one by hand.
    apply: (s, _ctx, p) => fail(queueNode(s, nodeParam(s, p), 0)),
  },
  {
    id: 'research.dequeue', verb: 'research', system: 'research', sphere: 'models', owner: 'WS1', title: 'Drop',
    available: (s) => (s.player.research.queue.length ? true : 'No projects'),
    preview: (s, p) => {
      const id = str(p, 'id', s.player.research.queue[0] ?? '');
      const heads = s.player.teams.filter((t) => t.projectId === id).reduce((a, t) => a + t.heads, 0);
      return { costs: [{ currency: 'progress', amount: -0.05, target: PROJECT_BY_ID[id]?.name ?? 'project' }], gains: [{ currency: 'staffTime', amount: Math.round(heads), target: 'scientists freed' }], exposure: [] };
    },
    apply: (s, _ctx, p) => fail(dequeueNode(s, str(p, 'id', s.player.research.queue[0] ?? ''))),
  },
  {
    id: 'research.move', verb: 'research', system: 'research', sphere: 'models', owner: 'WS1', title: 'Reorder',
    available: (s) => (s.player.research.queue.length > 1 ? true : 'Nothing to reorder'),
    preview: (s, p) => {
      const id = str(p, 'id', s.player.research.queue[s.player.research.queue.length - 1] ?? '');
      return { costs: [{ currency: 'staffTime', amount: 0, target: 'idle teams follow the new order' }], gains: [{ currency: 'progress', amount: 0, target: PROJECT_BY_ID[id]?.name ?? 'project' }], exposure: [] };
    },
    apply: (s, _ctx, p) => fail(moveInQueue(s, str(p, 'id', ''), num(p, 'to', 0))),
  },
  {
    id: 'research.assign', verb: 'research', system: 'research', sphere: 'models', owner: 'WS1', title: 'Assign',
    available: (s) => (projectTeams(s).length ? true : 'No science teams'),
    preview: (s, p) => {
      const id = nodeParam(s, p);
      const team = s.player.teams.find((t) => t.id === teamParam(s, p));
      const before = projectEta(s, id);
      const after = team ? projectEta(s, id, projectCapacity(s, id, team)) : before;
      const costs: CostLine[] = [{ currency: 'staffTime', amount: Math.round(team?.heads ?? 0), target: 'scientists' }];
      if (team?.projectId && team.projectId !== id) {
        const from = team.projectId;
        costs.push({ currency: 'leadDays', amount: -Math.max(0, days(projectEta(s, from, projectCapacity(s, from, undefined, team.id))) - days(projectEta(s, from))), target: PROJECT_BY_ID[from]?.name ?? 'project' });
      }
      return { costs, gains: [{ currency: 'progress', amount: Math.max(0, days(before) - days(after)), target: `${PROJECT_BY_ID[id]?.name ?? 'project'} (days sooner)` }], exposure: [] };
    },
    apply: (s, _ctx, p) => fail(assignTeam(s, teamParam(s, p), nodeParam(s, p))),
  },
  {
    id: 'research.unassign', verb: 'research', system: 'research', sphere: 'models', owner: 'WS1', title: 'Take off',
    available: (s) => (s.player.teams.some((t) => t.projectId) ? true : 'No team on a project'),
    preview: (s, p) => {
      const team = s.player.teams.find((t) => t.id === str(p, 'team', s.player.teams.find((t) => t.projectId)?.id ?? ''));
      const id = team?.projectId ?? '';
      const delay = id && team ? Math.max(0, days(projectEta(s, id, projectCapacity(s, id, undefined, team.id))) - days(projectEta(s, id))) : 0;
      return { costs: [{ currency: 'leadDays', amount: -delay, target: PROJECT_BY_ID[id]?.name ?? 'project' }], gains: [{ currency: 'staffTime', amount: Math.round(team?.heads ?? 0), target: 'scientists free' }], exposure: [] };
    },
    apply: (s, _ctx, p) => fail(unassignTeam(s, teamParam(s, p))),
  },
  {
    id: 'research.autoAssign', verb: 'policy', system: 'research', sphere: 'models', owner: 'WS1', title: 'Auto-assign',
    available: () => true,
    preview: (s, p) => {
      const on = p.on === undefined ? !s.player.research.autoAssign : p.on === true;
      const idle = idleTeams(s).reduce((a, t) => a + t.heads, 0);
      return on
        ? { costs: [{ currency: 'staffTime', amount: 0, target: 'teams placed by the policy, not by you' }], gains: [{ currency: 'progress', amount: Math.round(idle), target: 'idle scientists put to work' }], exposure: [] }
        : { costs: [{ currency: 'progress', amount: 0, target: 'idle teams wait for you' }], gains: [{ currency: 'staffTime', amount: 0, target: 'manual placement' }], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      s.player.research.autoAssign = p.on === undefined ? !s.player.research.autoAssign : p.on === true;
    },
  },
];
