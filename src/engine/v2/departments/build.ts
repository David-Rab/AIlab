// Engineers' build queue (STRUCTURE §4.1, BUILD-PLAN R5). Owner: WS1.
//
// Engineering teams work one shared queue in priority order. Capacity (team-weeks per week) = Σ engineer heads/150 ×
// quality × 1/(1 − A_eng), capped (departments/teams.ts buildCapacity). In R5 the queue holds run setups: a run is
// launched at once but trains only when its setup is built ("waiting for engineers"); bigger base runs need more.
// R6 adds product features, eval harnesses and safeguards (BuildKind).
import type { ActionDef, BuildItem, BuildKind, EngineSystem, GameStateV2, RunKind, TrainingRun } from '../types';
import { buildCapacity } from './teams';

type Params = Record<string, number | string | boolean>;
const str = (p: Params, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);

/** Team-weeks to set up a run [D]: the incremental engineering for a new run on existing infrastructure (data
 *  pipelines, checkpointing, cluster operations). A size-1 base 0.4, scaling with size^0.75 (×8: 1.9); continue 0.25;
 *  post-train 0.1; distill and amplify 0.05. Calibration: non-binding at the reference load, i.e. RefBot's setups
 *  finish within the day in every world (its 4 engineering teams build 0.6 team-weeks a day in the slow world, where
 *  coding automation is lowest; 3 in ai2027). A one-team lab waits 2–3 days for a size-1 base, a week for ×4. */
export function runSetupTW(kind: RunKind, size = 1, ida = false): number {
  if (kind === 'base') return 0.4 * Math.pow(Math.max(0.01, size), 0.75);
  if (kind === 'continue') return 0.25;
  if (kind === 'post' && !ida) return 0.1;
  return 0.05;
}

export function initialBuild(): GameStateV2['player']['build'] {
  return { queue: [], nextId: 1 };
}

/** Queue an item at the back of the queue; returns its id. */
export function queueBuild(s: GameStateV2, kind: BuildKind, ref: string, needTW: number): string {
  const b = s.player.build;
  const id = `B${b.nextId++}`;
  const priority = b.queue.reduce((m, x) => Math.max(m, x.priority), 0) + 1;
  b.queue.push({ id, kind, ref, needTW, doneTW: 0, priority, day: s.time.day });
  return id;
}

/** Team-weeks of work per day the engineers deliver today. */
export const buildPerDay = (s: GameStateV2) => buildCapacity(s).capacity / 7;

/** Days until each queued item is built at today's capacity (queue order; Infinity with no capacity). */
export function buildEtas(s: GameStateV2, extraTW = 0): { etas: Map<string, number>; next: number } {
  const perDay = buildPerDay(s);
  const etas = new Map<string, number>();
  let cum = 0;
  for (const it of s.player.build.queue) {
    cum += Math.max(0, it.needTW - it.doneTW);
    etas.set(it.id, perDay > 0 ? Math.max(1, Math.ceil(cum / perDay - 1e-9)) : Infinity);
  }
  const next = perDay > 0 ? Math.max(extraTW > 0 ? 1 : 0, Math.ceil((cum + extraTW) / perDay - 1e-9)) : extraTW > 0 ? Infinity : 0;
  return { etas, next };
}

/** Team-weeks still to build on the queue. */
export const buildBacklogTW = (s: GameStateV2) => s.player.build.queue.reduce((a, it) => a + Math.max(0, it.needTW - it.doneTW), 0);

/** The run a setup item belongs to. */
const runOf = (s: GameStateV2, it: BuildItem): TrainingRun | undefined => (it.kind === 'runSetup' ? s.player.models.runs.find((r) => r.id === it.ref) : undefined);

/** A run that has not finished its setup ("waiting for engineers"). */
export const runWaiting = (r: TrainingRun) => r.setupId !== undefined && r.readyDay === undefined;

/** build (38, daily): the engineers work the queue by priority; a finished run setup lets its run train. */
export const buildSystem: EngineSystem = {
  id: 'build', owner: 'WS1', cadence: 'daily', order: 38,
  run(s, ctx) {
    const b = s.player.build;
    if (!b.queue.length) return;
    // Setups of cancelled or finished runs leave the queue.
    b.queue = b.queue.filter((it) => {
      if (it.kind !== 'runSetup') return true;
      const r = runOf(s, it);
      return !!r && (r.status === 'running' || r.status === 'paused') && r.readyDay === undefined;
    });
    if (s.player.status !== 'active') return;
    let left = buildPerDay(s);
    while (left > 1e-12 && b.queue.length) {
      const it = b.queue[0];
      const take = Math.min(left, it.needTW - it.doneTW);
      it.doneTW += take;
      left -= take;
      if (it.doneTW < it.needTW - 1e-9) break;
      b.queue.shift();
      const r = runOf(s, it);
      if (r) {
        r.readyDay = ctx.day;
        if (ctx.day - r.startDay > 1) ctx.log('research', `Engineers finished setting up ${r.name}: training started.`, 1, r.id);
      }
    }
  },
};

/** Move a queued item to the front of the build queue. */
export function prioritizeBuild(s: GameStateV2, id: string): string | undefined {
  const b = s.player.build;
  const it = b.queue.find((x) => x.id === id);
  if (!it) return 'Unknown build item';
  it.priority = b.queue.reduce((m, x) => Math.min(m, x.priority), it.priority) - 1;
  b.queue.sort((x, y) => x.priority - y.priority);
  return undefined;
}

export const BUILD_ACTIONS: ActionDef[] = [
  {
    id: 'build.first', sphere: 'departments', owner: 'WS1', title: 'Build first',
    available: (s) => (s.player.build.queue.length > 1 ? true : 'Nothing else on the build queue'),
    preview: (s, p) => {
      const q = s.player.build.queue;
      const it = q.find((x) => x.id === str(p, 'id', '')) ?? q[q.length - 1];
      const before = it ? q.slice(0, q.indexOf(it)).reduce((a, x) => a + x.needTW - x.doneTW, 0) : 0;
      return {
        costs: [{ currency: 'staffTime', amount: -Math.round(Math.max(0, it ? it.needTW - it.doneTW : 0) * 10) / 10, target: 'other build items wait' }],
        gains: [{ currency: 'leadDays', amount: Math.round((before / Math.max(1e-9, buildPerDay(s))) * 10) / 10, target: 'ready sooner' }],
        exposure: [],
      };
    },
    apply: (s, _ctx, p) => {
      const why = prioritizeBuild(s, str(p, 'id', ''));
      if (why) throw new Error(why);
    },
  },
];
