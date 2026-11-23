// SR-21 (SAFETY-REDESIGN §5, theme A): the safety needs list as one readout. Every safety use of staff and compute is a
// need of LAB's one allocator (safety/lineProjects.ts safAllocation, in the player's safety-engineer order): human
// review, cases, validation jobs, eval suites, environment fixes, foothold removals, research-line experiments; plus the
// deployments' monitoring / control compute (the monitors' line of the flat allocation, set in SAFETY, no staff). Each
// row has its staff and compute ask and what it got; idle staff and idle safety-line compute are shown, never moved.
// Safety spend total = Σ of the rows' filled staff and compute cost (idle is listed beside it, not in it).
import { DEFAULT_SAF_RE_ALLOC, SAF_RE_NEED_LABEL } from '../../../data/v2/research';
import { QUALITY } from '../../../data/v2/teams';
import { monitorBudget } from '../departments/agents';
import { teamPayroll } from '../departments/teams';
import { dollarsPerH100eHour } from '../departments/workfit';
import type { GameStateV2, SafReNeed } from '../types';
import { safAllocation } from './lineProjects';

export interface SafetyNeedRow {
  k: SafReNeed | 'monitors'; label: string;
  /** Staff in heads × quality (people) and compute in H100e: asked and got. */
  staffAsk: number; staffGot: number; computeAsk: number; computeGot: number;
  /** $B/yr of what it got: its people's share of the safety research engineers' payroll, its H100e at the rental rate. */
  staffCost: number; computeCost: number;
  /** Both asks met. */
  filled: boolean;
}
export interface SafetySpend {
  /** The needs in the player's order, then monitoring / control. */
  rows: SafetyNeedRow[];
  idleStaff: number; idleCompute: number; idleCost: number;
  staffCost: number; computeCost: number;
  /** Safety spend $B/yr = staffCost + computeCost (filled needs only). */
  total: number;
  /** $B/yr per person (heads × quality) and per H100e. */
  perHead: number; perH100e: number;
}

const HOURS_PER_YEAR = 8766;

export function safetySpend(s: GameStateV2): SafetySpend {
  const a = safAllocation(s);
  let payroll = 0;
  let q = 0;
  for (const t of s.player.teams) if (t.role === 're' && t.dept === 'saf') { payroll += teamPayroll(t); q += t.heads * QUALITY[t.quality].out; }
  const perHead = q > 0 ? payroll / q : 0;
  const perH100e = (dollarsPerH100eHour(s) * HOURS_PER_YEAR) / 1e9;
  const eps = 1e-9;
  const rows: SafetyNeedRow[] = (s.player.research.safRe ?? DEFAULT_SAF_RE_ALLOC).order.map((k) => {
    const c = a.compute[k];
    return {
      k, label: SAF_RE_NEED_LABEL[k], staffAsk: a.demand[k], staffGot: a.got[k], computeAsk: c.ask, computeGot: c.got,
      staffCost: a.got[k] * perHead, computeCost: c.got * perH100e,
      filled: a.got[k] >= a.demand[k] - eps && c.got >= c.ask - eps,
    };
  });
  // Monitoring and the control protocol on the deployments: their compute line (no staff; human review is a need above).
  const mb = monitorBudget(s);
  const online = s.player.computeOnline;
  const monAsk = (mb.need + mb.control) * online;
  const monGot = mb.used * online;
  rows.push({ k: 'monitors', label: 'Monitoring & control (deployments)', staffAsk: 0, staffGot: 0, computeAsk: monAsk, computeGot: monGot, staffCost: 0, computeCost: monGot * perH100e, filled: monGot >= monAsk - eps });
  let staffCost = 0;
  let computeCost = 0;
  for (const r of rows) { staffCost += r.staffCost; computeCost += r.computeCost; }
  return {
    rows, idleStaff: a.idle, idleCompute: a.computeIdle, idleCost: a.idle * perHead + a.computeIdle * perH100e,
    staffCost, computeCost, total: staffCost + computeCost, perHead, perH100e,
  };
}
