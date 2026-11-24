// RESEARCH › Discoveries readouts (UB-A; mockups design/ux/mockups/rd/discoveries.png, discoveries-drawer.png, DATA-a.md).
// Pure views on facts (node states, needs) and beliefs (chance it works, time to finish at today's research speed); never
// hidden truth. Columns by distance: Known · Can start now (open, queued, researching, failed) · One step away (locked,
// every missing need can start now) · Later.
import { TREE, TREE_CHILDREN, PROJECT_BY_ID, type TreeNodeDef } from '../../../data/v2/tree';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import type { GameStateV2 } from '../types';
import { missingNeeds, nodeOdds, nodeStatus, projectEta, teamsOn, type NodeStatus } from './tree';
import { effortClassOf } from './research';

export type DiscZone = 'known' | 'now' | 'next' | 'later';
/** What a node gives: capability, or a safety output (see = an instrument, stop = a safeguard, fix = a training method,
 *  meta = AI staff on safety research). */
export type DiscTag = 'capability' | 'see' | 'stop' | 'fix' | 'meta';

export interface DiscoveryNodeView {
  id: string;
  status: NodeStatus;
  zone: DiscZone;
  tag: DiscTag;
  /** Missing prerequisites (ids), for locked nodes. */
  missing: string[];
  /** Number of discoveries that list it as a need. */
  opens: number;
  /** Chance the next attempt works (belief). */
  odds: number;
  /** Progress through the project, 0–1 (fact), while researching. */
  progress: number;
  /** Days to finish at today's staffing (Infinity without teams). */
  etaNow: number;
  /** Position on the priority list (1-based), 0 if not on it. */
  queuePos: number;
}

/** In the Discoveries grid: one-off discoveries and the programmes a discovery opens (Recurrent architectures); not the
 *  ongoing programmes (Portfolio is their home), follow-ups or product tools. */
export function inDiscoveries(n: TreeNodeDef): boolean {
  if (n.followUp || n.soon) return false;
  if (n.kind === 'line') return n.needs.length > 0;
  return true;
}

/** A node's output tag: capability nodes by their effect arrows; safety nodes by their instrument's role. */
export function discTag(n: TreeNodeDef): DiscTag {
  if (n.technique) {
    const r = TECHNIQUE_BY_ID[n.technique]?.role;
    return r === 'contain' ? 'stop' : r === 'fix' ? 'fix' : 'see';
  }
  if (n.id === 'aar' || n.id === 'P27') return 'meta';
  if (n.id === 'safetyPretrain' || n.id === 'P14') return 'fix';
  if (n.id === 'P25') return 'stop';
  if (n.id === 'P23' || n.id === 'P15') return 'see';
  return (n.fx.cap ?? 0) > 0 || !n.fx.saf ? 'capability' : 'fix';
}

const AVAILABLE: NodeStatus[] = ['open', 'queued', 'active', 'failed'];

export function discoveryViews(s: GameStateV2): DiscoveryNodeView[] {
  const nodes = TREE.filter(inDiscoveries);
  const st: Record<string, NodeStatus> = {};
  for (const n of TREE) st[n.id] = nodeStatus(s, n.id);
  const queue = s.player.research.queue;
  return nodes.map((n) => {
    const status = st[n.id];
    const missing = status === 'locked' ? missingNeeds(s, n.id) : [];
    const zone: DiscZone = status === 'known' ? 'known'
      : AVAILABLE.includes(status) ? 'now'
      : missing.every((m) => AVAILABLE.includes(st[m])) ? 'next' : 'later';
    const active = status === 'active' || status === 'queued';
    return {
      id: n.id, status, zone, tag: discTag(n), missing,
      opens: (TREE_CHILDREN[n.id] ?? []).filter((c) => PROJECT_BY_ID[c] && inDiscoveries(PROJECT_BY_ID[c])).length,
      odds: nodeOdds(s, n.id),
      progress: s.player.tree[n.id]?.progress ?? 0,
      etaNow: active && teamsOn(s, n.id).length ? projectEta(s, n.id) : Infinity,
      queuePos: queue.indexOf(n.id) + 1,
    };
  });
}

/** Time to finish (days) for a node with 1 and with 2 standard teams at today's research speed; for a safety idea, to
 *  its next result. Infinity when teams cannot work on it. */
export function discoveryEtas(s: GameStateV2, id: string): { size: string; one: number; two: number } {
  const n = PROJECT_BY_ID[id];
  const size = n ? effortClassOf(n) : 'M';
  if (!n) return { size, one: Infinity, two: Infinity };
  return { size, one: projectEta(s, id, 1), two: projectEta(s, id, 2) };
}
