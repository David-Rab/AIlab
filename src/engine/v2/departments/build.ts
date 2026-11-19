// Engineers' build queue (STRUCTURE §4.1, BUILD-PLAN R5; jank J2 P1). Owner: WS1.
//
// Engineering teams share one build capacity (team-weeks per week = Σ engineer heads/150 × quality × 1/(1 − A_eng),
// capped; departments/teams.ts buildCapacity) and spend it on three needs, in the player's order (model v3 V2: "needs +
// priority + overflow"; default below), each up to its optional cap (team-weeks per week or a share of capacity);
// unused capacity flows down the order:
//   runs      operations of every training run while it trains and of the continual-learning stream, then the run
//             setups on the queue (a run trains only once its setup is built), then adoptions of research results into
//             the recipe stacks (model v3 V2, models/research.ts: the training code the next runs use)
//   upkeep    every live product (reliability, on-call, integrations; grows with revenue) and every monitor in
//             production (a product's or an internal use's: serving harness, alert triage)
//   builds    the rest of the queue in priority order: product launches, product features, sector packs
// Too few engineers: upkeep falls behind (shown) and nothing new ships (launches, features and packs wait; the wait
// shows on Products and Company). Runs come first so the run cadence holds (the reference lab's runs never wait on
// upkeep). Engineering agents raise capacity through A_eng (their model and compute; R7, J2), so the work an engineer
// carries grows as AI takes over engineering. Calibration: the reference lab (RefBot) on the ai2027 path uses about
// three quarters of its capacity; its run setups finish within a few days in every world (calib.ts).
import { FEATURE_BY_ID, PRICE_TIERS, type FeatureId } from '../../../data/v2/features';
import { SECTOR_BY_ID } from '../../../data/v2/sectors';
import { AGENT_USES } from '../../../data/v2/agents';
import type { ActionDef, BuildItem, BuildKind, Deployment, EngineSystem, GameStateV2, RunKind, SectorId, SystemCtx, TrainingRun } from '../types';
import { agentSplitShare, monitorVersion } from './agents';
import { deploy } from '../models/deployments';
import { buildCapacity } from './teams';
import { DEFAULT_ENG_ALLOC } from '../../../data/v2/research';
import { allocate, completeAdoption } from '../models/research';
import { syncParadigm } from '../models/tree';
import type { EngNeed } from '../types';

type Params = Record<string, number | string | boolean>;
const str = (p: Params, k: string, d: string) => (typeof p[k] === 'string' ? (p[k] as string) : d);

/** Work of the 'runs' need besides run operations: run setups and (model v3 V2) adoptions of research results into the
 *  recipe stacks, the training code the next runs use (MODEL-V3 §3.3: new ideas are novel run code). Worked before
 *  product upkeep by default, so the reference lab's adoptions never wait on its products. */
export const isStackWork = (it: Pick<BuildItem, 'kind'>) => it.kind === 'runSetup' || it.kind === 'adopt';

/** Physical size of a run for engineering (model v3 V3): its FLOP over 1e27, the leader lab's frontier base in mid-2025
 *  (a fixed physical unit, not the calendar's frontier) [D]. */
export const engScale = (flop: number) => Math.max(0, flop) / ENG_FLOP_REF;
export const ENG_FLOP_REF = 1e27;
/** Team-weeks to set up a run [D]: the incremental engineering for a new run on existing infrastructure (data
 *  pipelines, checkpointing, cluster bring-up). A base of 1e27 FLOP 0.4, scaling with √(FLOP ÷ 1e27) (cluster size and
 *  failure handling grow with the run's compute; model v3 V3 made it physical: v2 scaled with FLOP ÷ F(t)); continue
 *  0.25; post-train 0.1; distill and amplify 0.05. Operating a run while it trains is upkeep (runOpsTW, also ∝ √).
 *  Calibration (R5, kept in J2): RefBot's setups finish within a day or two in every world — the stub traces are
 *  sensitive to the run cadence (a ×4 setup moved P08 by 100 days on the fast preset). */
export function runSetupTW(kind: RunKind, scale = 1, ida = false): number {
  if (kind === 'base') return 0.4 * Math.sqrt(Math.max(0.01, scale));
  if (kind === 'continue') return 0.25;
  if (kind === 'post' && !ida) return 0.1;
  return 0.05;
}

/** Standing engineering load, team-weeks per week [D] (J2 P1). Product: 0.2 + 1.6 × √(revenue ÷ $10B/yr), so a $10B/yr
 *  product keeps 1.8 team-weeks a week busy; runs while they train: a base 1 × √(FLOP ÷ 1e27), continue and post-train
 *  0.5, distill and amplify 0.2; the continual-learning stream 0.5; each monitor in production 0.4. Model v3 V3: product
 *  and monitor upkeep × 0.4 (were 0.5 + 4√… and 1): J2 tuned it to v2's build capacity, whose AI speed-up came from AI 2027's automation
 *  knots (×4.7 at the start); the physical SWE coverage of a 2025 model (≈ 0.2) gives ×1.35, and at the old upkeep the
 *  start lab's products alone needed twice its capacity. */
export const UPKEEP = { product: 0.2, productRev: 1.6, revUnit: 10, runBase: 1, runMid: 0.5, runSmall: 0.2, stream: 0.5, monitor: 0.4 } as const;
/** One-off builds [D]: launching a product 4 team-weeks; a sector pack 4 (then 120 days of certification). */
export const LAUNCH_TW = 4;
export const SECTOR_PACK_TW = 4;
/** Certification after a sector pack is built (research/16 §1A.3: "costs months and money"). */
export const SECTOR_CERT_DAYS = 120;

export type UpkeepKind = 'product' | 'run' | 'stream' | 'monitor';
export interface UpkeepLine { kind: UpkeepKind; ref: string; tw: number }
/** Runs (operations) come before product upkeep. */
export const isRunLine = (l: Pick<UpkeepLine, 'kind'>) => l.kind === 'run' || l.kind === 'stream';

const isLiveProduct = (d: Deployment) => d.kind === 'product' && d.status !== 'withdrawn';

/** Engineering a training run needs each week while it trains. */
export function runOpsTW(r: Pick<TrainingRun, 'kind' | 'flopNeeded' | 'name'>): number {
  if (r.kind === 'base') return UPKEEP.runBase * Math.sqrt(Math.max(0.01, engScale(r.flopNeeded)));
  if (r.kind === 'continue' || (r.kind === 'post' && !r.name.startsWith('IDA'))) return UPKEEP.runMid;
  return UPKEEP.runSmall;
}

/** Upkeep of one live product per week (revenue in $B/yr). */
export const productUpkeepTW = (revenue: number) => UPKEEP.product + UPKEEP.productRev * Math.sqrt(Math.max(0, revenue) / UPKEEP.revUnit);

/** Standing load lines (team-weeks per week): training runs and the stream, products, monitors in production. */
export function upkeepLines(s: GameStateV2): UpkeepLine[] {
  const p = s.player;
  const out: UpkeepLine[] = [];
  for (const r of p.models.runs) if (r.status === 'running' && !runWaiting(r)) out.push({ kind: 'run', ref: r.id, tw: runOpsTW(r) });
  if (p.models.stream) out.push({ kind: 'stream', ref: p.models.stream.versionId, tw: UPKEEP.stream });
  for (const d of p.deployments) {
    if (!isLiveProduct(d)) continue;
    out.push({ kind: 'product', ref: d.id, tw: productUpkeepTW(d.revenueRate ?? 0) });
    if (d.monitorId) out.push({ kind: 'monitor', ref: d.id, tw: UPKEEP.monitor });
  }
  for (const u of AGENT_USES) if (monitorVersion(s, u) && agentSplitShare(s, u) > 0) out.push({ kind: 'monitor', ref: u, tw: UPKEEP.monitor });
  return out;
}

/** Standing load, team-weeks per week: runs (operations) and products (upkeep incl. monitors). */
export function upkeepSplit(s: GameStateV2): { runs: number; products: number; total: number } {
  let runs = 0;
  let products = 0;
  for (const l of upkeepLines(s)) if (isRunLine(l)) runs += l.tw; else products += l.tw;
  return { runs, products, total: runs + products };
}
export const upkeepTW = (s: GameStateV2) => upkeepSplit(s).total;

export function initialBuild(): GameStateV2['player']['build'] {
  return { queue: [], nextId: 1, alloc: { order: [...DEFAULT_ENG_ALLOC.order], max: {}, share: {} } };
}

/** Queue an item; returns its id. Run setups go ahead of every other kind (they are worked before product upkeep);
 *  other items go to the back. Priorities are renumbered 1…n in queue order. */
export function queueBuild(s: GameStateV2, kind: BuildKind, ref: string, needTW: number, extra: Pick<BuildItem, 'launch' | 'host'> = {}): string {
  const b = s.player.build;
  const id = `B${b.nextId++}`;
  const it: BuildItem = { id, kind, ref, needTW, doneTW: 0, priority: 0, day: s.time.day, ...extra };
  // Run setups go first; adoptions of research results next (the training stack, model v3 V2); everything else after.
  const at = kind === 'runSetup' ? b.queue.findIndex((x) => x.kind !== 'runSetup') : kind === 'adopt' ? b.queue.findIndex((x) => !isStackWork(x)) : -1;
  if (at < 0) b.queue.push(it);
  else b.queue.splice(at, 0, it);
  b.queue.forEach((x, i) => (x.priority = i + 1));
  return id;
}

/** Weekly demand of each engineer need today (team-weeks per week): run operations + the setups still to build (as if
 *  built this week), product upkeep, the other builds still to do. */
export function engDemand(s: GameStateV2, u = upkeepSplit(s)): Record<EngNeed, number> {
  let setups = 0;
  let other = 0;
  for (const it of s.player.build.queue) if (isStackWork(it)) setups += remaining(it); else other += remaining(it);
  return { runs: u.runs + 7 * setups, upkeep: u.products, builds: 7 * other };
}
/** The engineers' allocation (order and caps; old saves without one get the default). */
export const engAlloc = (s: GameStateV2) => s.player.build.alloc ?? DEFAULT_ENG_ALLOC;

/** Free capacity per day for run setups (after run operations) and for other builds (after upkeep), team-weeks, under
 *  the engineers' allocation (each need's share estimated with the others at today's demand). */
export function buildRates(s: GameStateV2): { setups: number; builds: number } {
  const cap = buildCapacity(s).capacity;
  const u = upkeepSplit(s);
  const d = engDemand(s, u);
  const a = engAlloc(s);
  const runs = allocate(cap, a, { ...d, runs: Infinity }).runs;
  const builds = allocate(cap, a, { ...d, builds: Infinity }).builds;
  return { setups: Math.max(0, runs - u.runs) / 7, builds: Math.max(0, builds) / 7 };
}
/** Team-weeks per day the engineers have for builds other than run setups (after upkeep). */
export const buildPerDay = (s: GameStateV2) => buildRates(s).builds;

const remaining = (it: BuildItem) => Math.max(0, it.needTW - it.doneTW);
const daysAt = (tw: number, perDay: number) => (tw <= 0 ? 0 : perDay > 0 ? Math.max(1, Math.ceil(tw / perDay - 1e-9)) : Infinity);

/** Days until each queued item is built at today's rates: run setups in queue order on the capacity left after run
 *  operations; other items after the setups, in queue order, on the capacity left after all upkeep. `next` = a new
 *  item of `extraTW` (not a run setup) at the back. */
export function buildEtas(s: GameStateV2, extraTW = 0): { etas: Map<string, number>; next: number } {
  const r = buildRates(s);
  const q = s.player.build.queue;
  const etas = new Map<string, number>();
  let cumSetup = 0;
  for (const it of q) if (isStackWork(it)) etas.set(it.id, daysAt((cumSetup += remaining(it)), r.setups));
  const setupDays = cumSetup > 0 ? daysAt(cumSetup, r.setups) : 0;
  let cum = 0;
  for (const it of q) if (!isStackWork(it)) etas.set(it.id, setupDays + daysAt((cum += remaining(it)), r.builds));
  return { etas, next: extraTW > 0 ? setupDays + daysAt(cum + extraTW, r.builds) : 0 };
}

/** Days a new item of `tw` team-weeks would take if queued now (a run setup waits only behind other run setups). */
export function buildWaitNew(s: GameStateV2, tw: number, kind: BuildKind = 'feature'): number {
  if (tw <= 0) return 0;
  if (kind !== 'runSetup') return buildEtas(s, tw).next;
  const r = buildRates(s);
  let cum = tw;
  for (const it of s.player.build.queue) if (isStackWork(it)) cum += remaining(it);
  return daysAt(cum, r.setups);
}

/** Team-weeks still to build on the queue. */
export const buildBacklogTW = (s: GameStateV2) => s.player.build.queue.reduce((a, it) => a + remaining(it), 0);

/** The run a setup item belongs to. */
const runOf = (s: GameStateV2, it: BuildItem): TrainingRun | undefined => (it.kind === 'runSetup' ? s.player.models.runs.find((r) => r.id === it.ref) : undefined);

/** A run that has not finished its setup ("waiting for engineers"). */
export const runWaiting = (r: TrainingRun) => r.setupId !== undefined && r.readyDay === undefined;

/** A product launch waiting on the queue for a channel. */
export const pendingLaunch = (s: GameStateV2, channel: string): BuildItem | undefined => s.player.build.queue.find((it) => it.kind === 'launch' && it.launch?.channel === channel);
/** A sector pack waiting on the queue for a sector. */
export const pendingPack = (s: GameStateV2, sector: string): BuildItem | undefined => s.player.build.queue.find((it) => it.kind === 'sectorPack' && it.ref === sector);

/** Engineering in use on the last day (team-weeks per day): upkeep served + queue work (scripts and readouts). */
export const buildUsedToday = (s: GameStateV2) => ((s.player.build.last?.served ?? 0) + (s.player.build.last?.queue ?? 0)) / 7;

/** A finished item takes effect. */
function complete(s: GameStateV2, ctx: SystemCtx, it: BuildItem) {
  if (it.kind === 'adopt') {
    completeAdoption(s, ctx, it.ref, it.id, (id) => syncParadigm(s, id));
    return;
  }
  const r = runOf(s, it);
  if (r) {
    r.readyDay = ctx.day;
    if (ctx.day - r.startDay > 1) ctx.log('research', `Engineers finished setting up ${r.name}: training started.`, 1, r.id);
  }
  if (it.kind === 'feature' && !s.player.features.includes(it.ref)) {
    s.player.features.push(it.ref);
    ctx.log('company', `Engineers finished building ${FEATURE_BY_ID[it.ref as FeatureId]?.name ?? it.ref}: switch it on for your products.`, 1, it.ref);
  }
  if (it.kind === 'launch' && it.launch) {
    const l = it.launch;
    const d = deploy(s, ctx, {
      versionId: l.versionId, channel: l.channel, price: l.price, priceIndex: PRICE_TIERS[l.price],
      ...(l.kyc !== undefined ? { kyc: l.kyc } : {}), ...(l.effort ? { effort: l.effort } : {}), ...(l.monitorId ? { monitorId: l.monitorId } : {}),
    });
    if (typeof d === 'string') ctx.log('company', `The ${l.channel} launch is built but cannot go live: ${d}.`, 2);
  }
  if (it.kind === 'sectorPack') {
    const sector = it.ref as SectorId;
    const host = s.player.deployments.find((d) => d.id === it.host && d.status !== 'withdrawn')
      ?? s.player.deployments.find((d) => d.status !== 'withdrawn' && (d.channel === 'enterprise' || d.channel === 'api' || d.channel === 'agents'));
    if (!host) return;
    if (!host.sectorFocus.includes(sector)) host.sectorFocus.push(sector);
    if (s.world.fx.certDay[sector] === undefined) s.world.fx.certDay[sector] = ctx.day + SECTOR_CERT_DAYS;
    ctx.log('company', `${SECTOR_BY_ID[sector]?.name ?? sector} pack built: in certification (${SECTOR_CERT_DAYS} days).`, 1);
  }
}

/** Work queue items of one class in queue order with `left` team-weeks; returns what is left and the work done. */
function workQueue(s: GameStateV2, ctx: SystemCtx, left: number, setups: boolean): { left: number; work: number } {
  const b = s.player.build;
  let work = 0;
  for (let i = 0; i < b.queue.length && left > 1e-12;) {
    const it = b.queue[i];
    if (isStackWork(it) !== setups) { i++; continue; }
    const take = Math.min(left, it.needTW - it.doneTW);
    it.doneTW += take;
    left -= take;
    work += take;
    if (it.doneTW < it.needTW - 1e-9) break;
    b.queue.splice(i, 1);
    complete(s, ctx, it);
  }
  return { left, work };
}

/** build (38, daily): run operations and setups, then product upkeep, then the other builds; records the day's rates
 *  (team-weeks per week) and the utilisation (≈ 30-day average). */
export const buildSystem: EngineSystem = {
  id: 'build', owner: 'WS1', cadence: 'daily', order: 38, system: 'people',
  run(s, ctx) {
    const b = s.player.build;
    // Setups of cancelled or finished runs leave the queue.
    if (b.queue.length) {
      b.queue = b.queue.filter((it) => {
        if (it.kind !== 'runSetup') return true;
        const r = runOf(s, it);
        return !!r && (r.status === 'running' || r.status === 'paused') && r.readyDay === undefined;
      });
    }
    if (s.player.status !== 'active') return;
    const cap = buildCapacity(s).capacity;
    const u = upkeepSplit(s);
    const al = allocate(cap, engAlloc(s), engDemand(s, u));
    const ops = Math.min(al.runs, u.runs) / 7;
    const a = workQueue(s, ctx, Math.max(0, al.runs / 7 - ops), true);
    const prod = Math.min(al.upkeep, u.products) / 7;
    const c = workQueue(s, ctx, al.builds / 7, false);
    const r3 = (x: number) => Math.round(x * 1000) / 1000;
    const served = (ops + prod) * 7;
    const work = (a.work + c.work) * 7;
    b.last = { cap: r3(cap), upkeep: r3(u.total), served: r3(served), queue: r3(work) };
    const x = cap > 0 ? Math.min(1, (served + work) / cap) : 0;
    b.util = r3(b.util === undefined ? x : b.util + (x - b.util) / 30);
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

/** Cancel a queued product launch or sector pack (work done is lost). */
export function cancelBuild(s: GameStateV2, id: string): string | undefined {
  const b = s.player.build;
  const i = b.queue.findIndex((x) => x.id === id);
  if (i < 0) return 'Unknown build item';
  if (b.queue[i].kind === 'runSetup') return 'Cancel the run instead';
  if (b.queue[i].kind === 'adopt') return 'A research result waits to be built in: drop the project instead';
  b.queue.splice(i, 1);
  return undefined;
}

export const BUILD_ACTIONS: ActionDef[] = [
  {
    id: 'build.first', verb: 'policy', system: 'people', sphere: 'departments', owner: 'WS1', title: 'Build first',
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
  {
    id: 'build.cancel', verb: 'policy', system: 'people', sphere: 'departments', owner: 'WS1', title: 'Cancel build',
    available: (s) => (s.player.build.queue.some((x) => x.kind !== 'runSetup') ? true : 'Nothing to cancel'),
    preview: (s, p) => {
      const it = s.player.build.queue.find((x) => x.id === str(p, 'id', ''));
      const left = Math.max(0, (it?.needTW ?? 0) - (it?.doneTW ?? 0));
      return { costs: [{ currency: 'staffTime', amount: -Math.round((it?.doneTW ?? 0) * 10) / 10, target: 'work done is lost' }], gains: [{ currency: 'leadDays', amount: Math.round((left / Math.max(1e-9, buildPerDay(s))) * 10) / 10, target: 'later builds ready sooner' }], exposure: [] };
    },
    apply: (s, _ctx, p) => {
      const why = cancelBuild(s, str(p, 'id', ''));
      if (why) throw new Error(why);
    },
  },
];
