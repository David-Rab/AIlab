// Overview hub readouts (UB-A; mockups rd/overview.png, overview-tip.png; DATA-a.md Overview). Pure views on facts,
// measured values, the lab's beliefs and intel; never hidden truth. Each hub box gets one verdict word, a short
// reading and the few numbers its tooltip breaks down; every number's home is the box's own screen.
//   hubVerdicts  one box per screen: Compute · Lab · Research · Training · Models · Products · Finance · Safety · World
//   leadLanes    each lab's lead with its likely range (best guess ± 1.64 sd, a 90% range) and how you know it (B·intel)
import { idleChips } from '../compute/forecast';
import { idleShares } from '../departments/autoSplit';
import { divisionView } from '../finance/parent';
import { runwayOf } from '../finance/runway';
import { activeRivals } from '../models/labs';
import { knowHowAreas } from '../models/rdReadouts';
import { capPriorityList, safReAllocView } from '../models/researchView';
import { production } from '../production/readout';
import { leadDays, riskSources } from '../actors/intel';
import { customerDrift } from '../worldfx/productBoard';
import { productReadouts } from '../worldfx/productView';
import { PRODUCT_DEFS } from '../../../data/v2/features';
import type { GameStateV2, LabId, ModelVersion } from '../types';

export type HubTone = 'good' | 'warn' | 'info' | 'bad';
export type HubId = 'compute' | 'lab' | 'research' | 'training' | 'models' | 'products' | 'finance' | 'safety' | 'world';
export interface HubBox { id: HubId; verdict: string; tone: HubTone; sub: string; rows: { label: string; value: string }[] }

const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`;
const cnt = (x: number) => (x >= 1e6 ? `${(x / 1e6).toFixed(2)}M` : x >= 1e3 ? `${Math.round(x / 1e3)}k` : `${Math.round(x)}`);

function compute(s: GameStateV2): HubBox {
  const c = s.series.compute;
  const now = s.player.computeOnline;
  const then = c.length >= 4 ? c[c.length - 4] : c[0] ?? now;
  const g = then > 0 ? now / then - 1 : 0;
  const idle = idleChips(s);
  const due = s.player.orders.reduce((a, o) => a + Math.max(0, o.qty - o.delivered), 0);
  const rows = [
    { label: 'Online now', value: `${cnt(now)} H100e` },
    { label: 'Three weeks ago', value: `${cnt(then)} H100e` },
    { label: 'Chips on order', value: due > 1 ? `${cnt(due)} H100e` : 'none' },
    ...(idle > 1 ? [{ label: 'Chips waiting for power', value: `${cnt(idle)} H100e` }] : []),
  ];
  if (idle > 0.01 * Math.max(1, now)) return { id: 'compute', verdict: 'Chips idle', tone: 'warn', sub: 'no power to rack them', rows };
  const sub = due > 1 ? 'chips on order arriving' : 'no chips on order';
  if (g > 0.005) return { id: 'compute', verdict: 'Growing', tone: 'good', sub, rows };
  if (g < -0.005) return { id: 'compute', verdict: 'Shrinking', tone: 'warn', sub, rows };
  return { id: 'compute', verdict: 'Flat', tone: 'info', sub, rows };
}

function lab(s: GameStateV2): HubBox {
  const i = idleShares(s);
  const rows = [
    { label: 'Idle, all uses', value: pct(i.total, 1) },
    { label: 'Training share unused', value: pct(i.training, 1) },
    { label: 'Serving share unused', value: pct(i.serving, 1) },
    { label: 'Not given to any use', value: pct(i.unallocated, 1) },
  ];
  if (i.total > 0.02) {
    const top = [['training share unused', i.training], ['serving share unused', i.serving], ['compute not given out', i.unallocated], ['monitor share unused', i.monitors]] as const;
    const sub = [...top].sort((a, b) => b[1] - a[1])[0][0];
    return { id: 'lab', verdict: 'Idle compute', tone: 'warn', sub, rows };
  }
  return { id: 'lab', verdict: 'All in use', tone: 'good', sub: 'no idle compute', rows };
}

const LIMIT: Record<string, string> = { 'compute-bound': 'compute', 'labor-bound': 'research engineers', 'human-bound': 'research engineers', 'taste-bound': 'idea quality' };
function research(s: GameStateV2): HubBox {
  const pl = capPriorityList(s);
  const idle = pl.idleTeams.length;
  const active = pl.list.length;
  const rows = [{ label: 'Programmes in the Priority list', value: String(active) }, { label: 'Science teams with no programme', value: String(idle) }];
  if (!active) return { id: 'research', verdict: 'No programmes', tone: 'bad', sub: 'nothing in the Priority list', rows };
  const lim = LIMIT[production(s, 'player').label] ?? 'compute';
  return { id: 'research', verdict: `Limited by ${lim}`, tone: 'warn', sub: idle ? `${idle} science team${idle > 1 ? 's' : ''} idle` : 'scientists all busy', rows };
}

function training(s: GameStateV2): HubBox {
  const runs = s.player.models.runs.filter((r) => r.status === 'running' || r.status === 'paused');
  const waiting = knowHowAreas(s).filter((a) => a.waiting && a.waiting.x >= 1.05).sort((a, b) => b.waiting!.x - a.waiting!.x);
  const rows = [
    { label: 'Runs in progress', value: String(runs.length) },
    ...waiting.slice(0, 3).map((a) => ({ label: `${a.name} know-how waiting`, value: `×${a.waiting!.x.toFixed(2)}` })),
  ];
  const sub = waiting.length ? 'know-how is waiting' : 'no new know-how waiting';
  if (runs.length) {
    const r = runs[0];
    return { id: 'training', verdict: runs.length > 1 ? `${runs.length} runs training` : 'Run training', tone: 'good', sub: r.status === 'paused' ? `${r.name} paused` : r.name, rows };
  }
  return { id: 'training', verdict: 'No run queued', tone: waiting.length ? 'warn' : 'info', sub, rows };
}

function models(s: GameStateV2): HubBox {
  const vs = s.player.models.versions;
  const testing = vs.filter((v) => v.status === 'evaluating' && v.variant === 'full');
  // In use: the best measured version out of testing (UB-2 rule: rank by measured level, never the true one).
  let inUse: ModelVersion | undefined;
  for (const v of vs) {
    if (v.status === 'retired' || v.status === 'evaluating' || v.status === 'rolledBack') continue;
    if (!inUse || (v.evals.measuredL ?? -Infinity) > (inUse.evals.measuredL ?? -Infinity)) inUse = v;
  }
  const rows = [
    { label: 'Best model in products', value: inUse?.name ?? 'none' },
    { label: 'In testing', value: testing.map((v) => v.name).join(', ') || 'none' },
  ];
  if (!inUse) return { id: 'models', verdict: 'No model', tone: 'bad', sub: 'train a first model', rows };
  if (testing.length) return { id: 'models', verdict: `${testing[testing.length - 1].name} testing`, tone: 'info', sub: `in products: ${inUse.name}`, rows };
  return { id: 'models', verdict: `${inUse.name} in products`, tone: 'good', sub: 'nothing in testing', rows };
}

const BOUND: Record<string, string> = { quality: 'Limited by quality', capacity: 'Limited by serving', price: 'Limited by price', demand: 'Limited by demand', none: 'No demand' };
function products(s: GameStateV2): HubBox {
  const rd = productReadouts(s);
  const live = s.player.deployments.filter((d) => d.status === 'live' && rd.has(d.id)).map((d) => rd.get(d.id)!);
  if (!live.length) return { id: 'products', verdict: 'Nothing live', tone: 'bad', sub: 'no product sells yet', rows: [] };
  const byRev = [...live].sort((a, b) => b.revenue - a.revenue);
  const n: Record<string, number> = {};
  for (const r of live) n[r.bound] = (n[r.bound] ?? 0) + r.revenue + 1e-9;
  const bound = Object.entries(n).sort((a, b) => b[1] - a[1])[0][0];
  const drift = customerDrift(byRev[0]);
  const sub = drift.dir === 'lose' ? 'buyers drift to rivals' : drift.dir === 'gain' ? 'buyers are coming' : 'buyers mostly stay';
  const rows = byRev.map((r) => ({ label: PRODUCT_DEFS[r.channel]?.name ?? r.channel, value: (BOUND[r.bound] ?? r.bound).toLowerCase() }));
  return { id: 'products', verdict: BOUND[bound] ?? bound, tone: bound === 'none' ? 'info' : 'warn', sub, rows };
}

function finance(s: GameStateV2): HubBox {
  const dv = divisionView(s);
  if (dv) {
    const rows = [{ label: 'Budget this year', value: `$${(dv.budget / 1e9).toFixed(1)}B` }, { label: 'Spent so far', value: `$${(dv.spent / 1e9).toFixed(1)}B` }];
    if (dv.status === 'over') return { id: 'finance', verdict: 'Over budget', tone: 'bad', sub: 'the parent covers it', rows };
    if (dv.status === 'course') return { id: 'finance', verdict: 'Over budget pace', tone: 'warn', sub: 'over by the review', rows };
    return { id: 'finance', verdict: 'Within budget', tone: 'good', sub: 'parent budget holds', rows };
  }
  const rw = runwayOf(s);
  const covers = rw.burnQ <= 0;
  const rows = [{ label: 'Runway', value: rw.q >= 8 ? '8+ quarters' : `${rw.q.toFixed(1)} quarters` }, { label: covers ? 'Earned above costs a quarter' : 'Spent above revenue a quarter', value: `$${(Math.abs(rw.burnQ) / 1e9).toFixed(1)}B` }];
  const sub = covers ? 'revenue covers costs' : rw.q >= 6 ? 'cash covers the spending' : 'spending more than it earns';
  if (rw.q < 3) return { id: 'finance', verdict: 'Cash running out', tone: 'bad', sub, rows };
  if (rw.q < 6) return { id: 'finance', verdict: 'Runway tight', tone: 'warn', sub, rows };
  return { id: 'finance', verdict: 'Healthy', tone: 'good', sub, rows };
}

function safety(s: GameStateV2): HubBox {
  const v = safReAllocView(s);
  const short = v.needs.filter((n) => n.short > 1e-6 && Number.isFinite(n.demand));
  const total = short.reduce((a, n) => a + n.short, 0);
  const rows = [...short.map((n) => ({ label: `${n.label}: short`, value: `${n.short.toFixed(1)} people` })), { label: 'Idle', value: `${v.idle.toFixed(1)} people` }];
  if (total > 0.05) {
    const research = short.some((n) => n.k === 'safExp');
    return { id: 'safety', verdict: 'Staff short', tone: 'warn', sub: research ? 'safety research slowed' : `${short[0].label.toLowerCase()} short`, rows };
  }
  return { id: 'safety', verdict: 'Staffed', tone: 'good', sub: 'every safety need met', rows };
}

function world(s: GameStateV2): HubBox {
  const src = riskSources(s).filter((r) => r.kind !== 'ownModel').sort((a, b) => b.estimate - a.estimate);
  const top = src[0];
  const rows = src.slice(0, 3).map((r) => ({ label: r.label, value: pct(r.estimate, 1) }));
  if (!top) return { id: 'world', verdict: 'Quiet', tone: 'good', sub: 'rival labs, China, misuse, war', rows };
  return { id: 'world', verdict: `${top.label} riskiest`, tone: top.estimate >= 0.2 ? 'bad' : top.estimate >= 0.05 ? 'warn' : 'info', sub: 'rival labs, China, misuse, war', rows };
}

export function hubVerdicts(s: GameStateV2): Record<HubId, HubBox> {
  return {
    compute: compute(s), lab: lab(s), research: research(s), training: training(s), models: models(s),
    products: products(s), finance: finance(s), safety: safety(s), world: world(s),
  };
}

/** z for a 90% two-sided range. */
export const LIKELY_Z = 1.64;
export interface LeadLane {
  id: LabId; name: string; china: boolean;
  /** Days their newest public model is ahead of yours (+) or behind (−): your best guess and its likely range. */
  ahead: number; lo: number; hi: number; sd: number;
  /** Day of the last intel report on them; their newest public model. */
  reportDay?: number; publicModel?: string;
}
/** The lead lanes (B·intel): leadDays' estimate (positive = you lead) flipped to "days they are ahead of you". */
export function leadLanes(s: GameStateV2): LeadLane[] {
  // A lab with no public model yet has no lane: there is nothing to compare (F7).
  const labs = [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])].filter((r) => r.publicModel);
  return labs.map((r) => {
    const l = leadDays(s, r.core.id);
    const ahead = -l.est;
    return {
      id: r.core.id, name: r.core.name, china: r.core.kind === 'china', ahead, sd: l.sd,
      lo: Math.round(ahead - LIKELY_Z * l.sd), hi: Math.round(ahead + LIKELY_Z * l.sd),
      reportDay: r.npc?.pub?.capDay, publicModel: r.publicModel?.name,
    };
  }).sort((a, b) => b.ahead - a.ahead);
}
