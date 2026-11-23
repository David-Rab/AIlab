// Read-only views of the limits the player can hit (STRUCTURE R11, data/v2/limits.ts): the live reading of each cap,
// floor or gate where the UI shows it. Pure selectors; nothing here changes state or reads hidden truth.
import { RESTRICT, controlOn, isRestricted, productUsageMult, restrictMult } from '../safety/safeguards';
import { SITE_PATHS } from '../../../data/v2/deals';
import { decimalYear } from './time';
import { diffusionPerDay } from '../production/production';
import { SPEC_CAP } from '../../../data/v2/dataAssets';
import { wslFloor } from '../security/security';
import { incidentHit, INCIDENT_BC_CAP_Q, moodWeight } from '../finance/mood';
import { spotRentalCap } from '../compute/orders';
import { leaseAvailableGW } from '../compute/sites';
import { revenueReadout, servingPool } from '../worldfx/revenue';
import { kycDemandFactor } from '../models/deployments';
import { chatToolAppeal, productTools, toolGap } from '../worldfx/serving';
import { SECTOR_CHANNELS } from '../worldfx/mix';
import { SECTORS } from '../../../data/v2/sectors';
import { idleChips } from '../compute/forecast';
import { idleTeams } from '../models/tree';
import { outsidersWithAccess } from '../safety/incidents';
import type { Deployment, DomainId, GameStateV2, ModelVersion } from '../types';

export interface SpeedLimitLine {
  id: 'speed.pause' | 'speed.diffusion';
  /** Multiplier on research speed (or know-how rate) it applies today; 1 = not binding. */
  mult: number;
  /** Short reading for the line. */
  text: string;
  binding: boolean;
  /** Ideas that lift it (tree node names), when any. */
  fix?: string[];
}

/** Research-speed limit lines (LIMITS "Research speed"): a pause, knowledge diffusion. Lines that
 *  cannot apply in this game (no leader lab to learn from, no pause) are omitted. Model v3 V2b: the v2 "frontier methods"
 *  ratio and the serving-cost clamp are gone (research runs on explicit compute and labour; copies follow FLOP per token). */
export function labSpeedLimits(s: GameStateV2): SpeedLimitLine[] {
  const out: SpeedLimitLine[] = [];
  const p = s.player;
  // Pause of frontier experiments.
  if (s.flags.paused) out.push({ id: 'speed.pause', mult: 0, binding: true, text: 'no experiment FLOP for capability projects while paused (ideation goes on)' });
  // Knowledge diffusion (RD-X04 rule A): recipe from the best public recipe above the player's.
  {
    const dif = diffusionPerDay(s);
    const rate = (p.research.gRate ?? 0) * 365; // the lab's own recipe rate, OOM a year (RD-L03)
    const add = rate > 0 ? (dif.dG * 365) / rate : 0; // the diffusion's OOM a year over the lab's own recipe rate
    out.push({ id: 'speed.diffusion', mult: 1 + add, binding: dif.dG > 0, text: dif.dG > 0 ? `recipe ×${(1 + add).toFixed(1)} your own rate, from ${dif.from}` : 'none (no released recipe above yours)' });
  }
  return out;
}

/** A version's data specialisation: its base's s_d,data from the data draw plus the curation's domain offsets (OOM,
 *  model v3 D3), largest first, and whether a domain sits at the ±SPEC_CAP cap (LIMITS model.dataSpec). */
export function dataSpecView(s: GameStateV2, v: ModelVersion): { rows: [DomainId, number][]; capped: boolean; cap: number } {
  const b = s.player.models.bases.find((x) => x.id === v.baseId);
  const rows = (Object.entries(b?.sD ?? {}) as [DomainId, number][]).filter(([, x]) => Math.abs(x) >= 0.005).sort((a, c) => Math.abs(c[1]) - Math.abs(a[1]));
  return { rows, capped: rows.some(([, x]) => Math.abs(x) >= SPEC_CAP - 1e-9), cap: SPEC_CAP };
}

/** Weight-security status-quo floor today and in 2027 (LIMITS security.floor). */
export function securityFloorView(s: GameStateV2): { now: number; max: number; binding: boolean } {
  const now = wslFloor(decimalYear(s) - 2025);
  return { now, max: wslFloor(2), binding: s.player.security.wsl <= now + 1e-6 };
}

/** Board-confidence hit from public incidents at the next quarterly review (LIMITS board.incidentCap): raw and capped
 *  before the board's incident multiplier (FIN3a, by seat kind), and the hit after it. */
export function incidentBoardHit(s: GameStateV2): { raw: number; capped: number; cap: number; mult: number; hit: number } {
  let raw = 0;
  for (const inc of s.player.safety.incidents) {
    if (inc.day < s.time.day - 91 || inc.labId !== 'player') continue;
    if (inc.exposure !== 'public' && inc.status !== 'leaked') continue;
    raw += incidentHit(inc.severity);
  }
  const capped = Math.min(raw, INCIDENT_BC_CAP_Q);
  const mult = moodWeight(s, 'incidents');
  return { raw, capped, cap: INCIDENT_BC_CAP_Q, mult, hit: capped * mult };
}

/** Why an incident's public timer is what it is (LIMITS incident.publicTimer). */
export function publicTimerRules(s: GameStateV2): { sb53: boolean; raise: boolean; outsiders: number; maxDays: number } {
  const sb53 = !!s.gov.statutes.sb53;
  const raise = !!s.gov.statutes.raise;
  return { sb53, raise, outsiders: outsidersWithAccess(s).length, maxDays: raise ? 3 : sb53 ? 15 : 60 };
}

/** Spot rental headroom this quarter (LIMITS rent.spotCap). */
export function spotRentalView(s: GameStateV2, want: number): { cap: number; used: number; left: number; get: number } {
  const cap = spotRentalCap(s);
  const used = s.player.finance.ws3.rentals.reduce((a, r) => a + (r.endDay > s.time.day ? r.h100e : 0), 0);
  const left = Math.max(0, cap - used);
  return { cap, used, left, get: Math.min(want, left) };
}

/** Site size range for a power source and the lease pool left (LIMITS site.mw). */
export function siteSizeView(s: GameStateV2, path: keyof typeof SITE_PATHS): { min: number; max: number; leaseGW?: number } {
  return { min: 50, max: SITE_PATHS[path].maxMW, ...(path === 'lease' ? { leaseGW: leaseAvailableGW(s) } : {}) };
}

/** A product's demand modifiers (LIMITS product.demandMods): each factor on its demand. RD-B11 (B42) / RD-P07: its tools
 *  are listed (Chat: × its appeal in the users' app choice; sector products: × its coverage in the sectors that need
 *  them, over the same offer without them, inside the buyers' choice); Trusted's ×3 is a price, in its offer and the Price row, not here. */
export function demandModifiers(s: GameStateV2, d: Deployment): { label: string; mult: number }[] {
  const out: { label: string; mult: number }[] = [];
  if (kycDemandFactor(d) < 1) out.push({ label: `KYC ${d.kyc}`, mult: kycDemandFactor(d) });
  const tools = productTools(s, d);
  if (d.channel === 'consumer') {
    const e = chatToolAppeal(tools);
    if (e > 1) out.push({ label: 'Tools (app choice)', mult: e });
  } else if (SECTOR_CHANNELS.includes(d.channel)) {
    const by = new Map<number, string[]>();
    for (const def of SECTORS) {
      if (d.channel === 'gov' && def.id !== 'GOV' && def.id !== 'MIL') continue;
      const e = (1 - toolGap(def.id, tools)) / Math.max(1e-9, 1 - toolGap(def.id, []));
      if (e > 1 + 1e-9) by.set(e, [...(by.get(e) ?? []), def.name.split(/[ ,]/)[0]]);
    }
    for (const [e, names] of by) out.push({ label: `Tools in ${names.join(', ')} (coverage in the buyers' choice)`, mult: e });
  }
  if (isRestricted(d)) out.push({ label: 'Restricted', mult: RESTRICT });
  if (controlOn(d)) out.push({ label: 'Control protocol (Slowdown)', mult: productUsageMult(d) / restrictMult(d) });
  if (d.usagePolicy.noDropInReplacement) out.push({ label: 'No drop-in agents', mult: NaN });
  return out;
}

export { PENALTY_MAX } from '../worldfx/revenue';
export { DISCLOSURE_LABEL, DISCLOSURE_POLICIES, RESPONSE_INFO, disclosurePolicy, hardenLevel, mustReport, responseOptions, willDisclose } from '../safety/responses';
export { bestPlayerVersion } from '../models/labs';

// ───────── Idle stocks (STRUCTURE R5 and §8 idle test) ─────────
/** Resource stocks the player owns that can sit unused with no default use. Training compute (spare → experiments or
 *  data), spare serving compute under the default policy (research agents), agent compute (all research agents), safety research engineers (spare → tool upkeep and validation lead) and
 *  cash have default uses and are not listed. Each idle stock has an alert in the Watch list (ui/v2/shell/watch.ts,
 *  ids below); scripts/v2/idle.ts checks that none stays idle 30 days without one. */
export type IdleStockId = 'chips' | 'scienceTeams' | 'serving';
export const IDLE_STOCK_IDS: readonly IdleStockId[] = ['chips', 'scienceTeams', 'serving'];
export interface IdleStock { id: IdleStockId; amount: number; unit: string; share: number }
export function idleStocks(s: GameStateV2): IdleStock[] {
  const out: IdleStock[] = [];
  const p = s.player;
  const ic = idleChips(s);
  const share = ic / Math.max(1, p.computeOnline + ic);
  if (share > 0.05) out.push({ id: 'chips', amount: ic, unit: 'H100e', share });
  const sci = p.teams.filter((t) => t.role === 'sci');
  const idle = idleTeams(s);
  if (idle.length) out.push({ id: 'scienceTeams', amount: idle.length, unit: 'teams', share: idle.length / Math.max(1, sci.length) });
  // Serving compute no product needs stays idle on the serving line (DD-19).
  const pool = servingPool(s);
  if (pool > 0) {
    const need = revenueReadout(s).deps.reduce((a, d) => a + d.needH100e, 0);
    const spare = pool - need;
    if (spare > 0.25 * pool && spare > 5000) out.push({ id: 'serving', amount: spare, unit: 'H100e', share: spare / pool });
  }
  return out;
}
