// Hours of AI use in a sector (A2a; research/22 §1, design/archive/V3-BUILD.md "A2a notes") and who pays for them (A2c; research/22
// §4–6, "A2c notes"). Owner: WS5. Pure functions of the sector state and data (no imports from other worldfx modules, so
// sectors, serving and revenue can all use them).
//
//   U       = A + h_s·max(0, W − A)       hours of use per work-hour: the tasks firms handed to AI (A) plus workers'
//                                          assisted use on the rest of their hours (W who use AI, h_s of their hours)
//   W*      = max(A, W_b + (1 − W_b)·F)    the base share of workers who use AI today, plus the rest as AI covers their work
//   W_b     = useW·√r̂_s·(region scale),  h_s = useH·√r̂_s   r̂_s the sector's relative use (employment-normalised)
//   α_use   = α·A/U                        substituted share of an hour of use (assisted hours substitute nothing)
//   saved   = α_use + (1 − α_use)·g_aug    hours of work an hour of use saves (measured 0.35, research/22 §1e)
//   A2c billing: hours of use = adopted A-hours (billed per hour) + seated hours (σ of the assisted hours, billed by the
//   seat) + unseated hours (free, bundled, in-house: unbilled); supervising hours (agent work directs from them) =
//   (1 − α)·A-hours + seated hours; seats = σ·W·E.
//   A4 ceiling: adopted A-hours + agent-hours ≤ H* = E0·2000·(1 + η·CR), CR = 1 − c̄/wage (research/16 step 7 with the AI
//   doing all the work at its current buyer's cost c̄), and their spend ≤ H*·wage; agent-hours fill what is left.
import { ECON, REGION_SCALE, SECTORS, type SectorDef } from '../../../data/v2/sectors';
import type { RegionId, SectorId, SectorState } from '../types';

/** Employment-weighted mean of the sectors' relative use (normalises `use` to a US average of 1). */
const USE_MEAN = SECTORS.reduce((a, d) => a + d.empPct * d.use, 0) / SECTORS.reduce((a, d) => a + d.empPct, 0);
const ROOT = Object.fromEntries(SECTORS.map((d) => [d.id, Math.sqrt(d.use / USE_MEAN)])) as Record<SectorId, number>;

/** Base share of a sector's workers who use AI at work (W_b): the US base × √(relative use) × the region's scale. */
export const useBaseOf = (def: SectorDef, r: RegionId) => Math.min(0.95, ECON.useW * ROOT[def.id] * REGION_SCALE[r].use);
/** Share of a user's non-delegated hours with AI assistance (h_s). */
export const useIntensityOf = (sid: SectorId) => ECON.useH * ROOT[sid];
/** Ceiling of the worker stock: today's base users plus the rest as the AI covers their work; at least A. */
export const workerTarget = (def: SectorDef, r: RegionId, F: number, A: number) => {
  const wb = useBaseOf(def, r);
  return Math.max(A, wb + (1 - wb) * Math.max(0, Math.min(1, F)));
};

type UseState = Pick<SectorState, 'A' | 'W' | 'alpha'>;
/** Hours of AI use per work-hour of a sector (U). */
export const useShareOf = (st: UseState, sid: SectorId) => st.A + useIntensityOf(sid) * Math.max(0, (st.W ?? st.A) - st.A);
/** Substituted share of an hour of use: α on the adopted tasks, nothing on assisted hours (α_use = α·A/U). */
export function alphaUseOf(st: UseState, sid: SectorId, alpha = st.alpha): number {
  const U = useShareOf(st, sid);
  return U > 0 ? (alpha * st.A) / U : 0;
}
/** Hours of work an hour of AI use saves at a substituted share α_use. */
export const savedAt = (alphaUse: number) => alphaUse + (1 - alphaUse) * ECON.gAug;

/** A2c: a sector's hours of use a year split by who pays, and the seats (persons). */
export interface WorkHours {
  /** All hours of use (U·E0·2000) = adopted + seated + unseated. */
  use: number;
  /** Tasks firms handed to AI (A·E0·2000): billed per hour (API, agents, enterprise usage). */
  adopted: number;
  /** Assisted hours of workers with a paid seat (billed by the seat) and of the others (free, bundled, in-house). */
  seated: number;
  unseated: number;
  /** Human-attended billed hours that direct agent work: (1 − α)·adopted + seated. */
  supervising: number;
  /** Paid seats (persons, all providers incl. in-house open models): σ·W·E. */
  seats: number;
}
type BillState = Pick<SectorState, 'A' | 'W' | 'alpha' | 'seat' | 'E' | 'E0'>;
export function workHoursOf(st: BillState, sid: SectorId): WorkHours {
  const adopted = st.A * st.E0 * ECON.hours;
  const assisted = useIntensityOf(sid) * Math.max(0, (st.W ?? st.A) - st.A) * st.E0 * ECON.hours;
  const sigma = Math.max(0, Math.min(1, st.seat ?? 0));
  const seated = sigma * assisted;
  return { use: adopted + assisted, adopted, seated, unseated: assisted - seated, supervising: (1 - st.alpha) * adopted + seated, seats: sigma * (st.W ?? st.A) * st.E };
}
/** Assisted hours a month of one worker who uses AI in a sector (a seat-holder's use: h_s of a 2,000-hour year). */
export const seatHoursPerMonth = (sid: SectorId) => (useIntensityOf(sid) * ECON.hours) / 12;

// ───────────── demand for a sector's work (research/16 step 7) and the ceiling on AI work (A4) ─────────────

/** Cost reduction passed to prices when AI does a share `share` of a sector's work at a buyer's cost `cost` per
 *  human-equivalent hour (research/16 step 7): CR = share·max(0, 1 − cost/wage). */
export const costReduction = (share: number, cost: number, wage: number) => share * Math.max(0, 1 - cost / wage);
/** Expansion of a sector's work demand at a cost reduction CR (research/16 step 7, the Jevons term): 1 + η_s·CR. */
export const demandExpansion = (def: SectorDef, CR: number) => 1 + def.eta * CR;

/** A4: the ceiling on AI work in one sector and region. */
export interface AgentCeiling {
  /** The sector's work demand (hours a year) H* = E0·2000 × X: its human work-hours, expanded by the demand the AI's price
   *  creates, X = 1 + η·CR with CR = 1 − c̄/wage (research/16 step 7 with the AI doing all the work at the current buyer's
   *  cost c̄ of AI work: hour-weighted over adopted task-hours and agent-hours). X ≤ 1 + η. */
  hours: number;
  expansion: number;
  /** The value of that work ($B/yr): H* × the wage (the sector's wage bill × X). */
  value: number;
  /** Agent-hours a year the buyers want before the ceiling, and the share of them bought (1 below the ceiling). */
  wanted: number;
  fill: number;
  /** Share of the ceiling used: (adopted task-hours + agent-hours bought) ÷ H*. */
  used: number;
  /** What binds: nothing, the hours of work demanded, or their value (spend on AI work ≤ the value of the work). */
  bound: 'none' | 'hours' | 'value';
}
/**
 * A4: AI work in a sector (adopted task-hours A·E0·2000 plus agent-hours) cannot exceed the sector's work demand H*, and
 * spend on it (adopted hours × their price + agent-hours × theirs) cannot exceed the value of that work, H* × wage.
 * Agent-hours are the residual: they fill the room the adopted hours leave, every provider's in proportion (fill ≤ 1).
 * The agent capacity beyond it is not bought: it earns nothing and needs no serving (the lab's spare serving).
 * `H0` the human work-hours a year E0·2000, `adopted*` and `agent*` hours a year and spend ($/yr), `pCost` the buyer's
 * cost per hour saved of the adopted hours ($), `agentCost` the buyer's cost of an agent-hour incl. supervision ($).
 */
export function agentCeilingOf(def: SectorDef, H0: number, wage: number, adoptedH: number, adoptedSpend: number, pCost: number, agentH: number, agentSpend: number, agentCost: number): AgentCeiling {
  const aiH = adoptedH + agentH;
  const cBar = aiH > 0 ? (adoptedH * pCost + agentH * agentCost) / aiH : pCost;
  const expansion = demandExpansion(def, costReduction(1, cBar, wage));
  const hours = H0 * expansion;
  const value = hours * wage;
  let fill = 1;
  let bound: AgentCeiling['bound'] = 'none';
  if (agentH > 0) {
    const roomH = Math.max(0, hours - adoptedH);
    if (agentH > roomH) {
      fill = roomH / agentH;
      bound = 'hours';
    }
    const roomV = Math.max(0, value - adoptedSpend);
    if (agentSpend * fill > roomV) {
      fill = roomV / agentSpend;
      bound = 'value';
    }
  }
  return { hours, expansion, value: value / 1e9, wanted: agentH, fill, used: hours > 0 ? (adoptedH + agentH * fill) / hours : 0, bound };
}
