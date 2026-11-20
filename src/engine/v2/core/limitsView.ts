// Read-only views of the limits the player can hit (STRUCTURE R11, data/v2/limits.ts): the live reading of each cap,
// floor or gate where the UI shows it. Pure selectors; nothing here changes state or reads hidden truth.
import { PROD_SPEED_CAP } from '../../../data/v2/calibration';
import { SITE_PATHS } from '../../../data/v2/deals';
import { decimalYear } from './time';
import { diffusionPerDay } from '../production/production';
import { speedOfCopy } from '../departments/workfit';
import { B_G_PER_Y } from '../../../data/v2/runDesign';
import { LEADER_ID } from '../models/labs';
import { SPEC_CAP } from '../../../data/v2/dataAssets';
import { ws4r } from '../actors/state';
import { wslFloor } from '../security/security';
import { INCIDENT_BC_CAP_Q } from '../finance/board';
import { spotRentalCap } from '../compute/orders';
import { leaseAvailableGW } from '../compute/sites';
import { TRUSTED_PREMIUM, revenueReadout, servingPool } from '../worldfx/revenue';
import { idleChips } from '../compute/forecast';
import { idleTeams } from '../models/tree';
import { outsidersWithAccess } from '../safety/incidents';
import type { Deployment, DomainId, GameStateV2, ModelVersion } from '../types';

export interface SpeedLimitLine {
  id: 'speed.serialCap' | 'speed.pause' | 'speed.diffusion';
  /** Multiplier on research speed (or know-how rate) it applies today; 1 = not binding. */
  mult: number;
  /** Short reading for the line. */
  text: string;
  binding: boolean;
  /** Ideas that lift it (tree node names), when any. */
  fix?: string[];
}

/** Research-speed limit lines (LIMITS "Research speed"): the agents' serial speed cap, a pause, knowledge diffusion. Lines that
 *  cannot apply in this game (no leader lab to learn from, no pause) are omitted. Model v3 V2b: the v2 "frontier methods"
 *  ratio and the serving-cost clamp are gone (research runs on explicit compute and labour; copies follow FLOP per token). */
export function researchSpeedLimits(s: GameStateV2): SpeedLimitLine[] {
  const out: SpeedLimitLine[] = [];
  const p = s.player;
  const r = p.prodCache;
  // Serial speed of research agents (R11 #23 cap).
  if (r) {
    const raw = speedOfCopy();
    out.push({ id: 'speed.serialCap', mult: 1, binding: raw >= PROD_SPEED_CAP, text: raw >= PROD_SPEED_CAP ? `capped at ${PROD_SPEED_CAP}×` : `${Math.round(raw)}× of ${PROD_SPEED_CAP}×` });
  }
  // Pause of frontier experiments.
  const until = ws4r(s).frontierPauseUntil;
  if (s.flags.paused || until > s.time.day) out.push({ id: 'speed.pause', mult: 0.1, binding: true, text: until > s.time.day ? `×0.1 for ${until - s.time.day} d` : '×0.1 while paused' });
  // Knowledge diffusion from the simulated frontier leader (follower starts).
  const L = s.rivals.find((x) => x.core.id === LEADER_ID && x.core.status === 'active');
  if (L) {
    const dif = diffusionPerDay(s);
    const rate = r?.rate ?? 0;
    const add = rate > 0 ? (dif.dG * 365) / (rate * B_G_PER_Y) : 0; // the diffusion's OOM a year over the lab's own recipe rate
    out.push({ id: 'speed.diffusion', mult: 1 + add, binding: dif.dG > 0, text: dif.dG > 0 ? `recipe ×${(1 + add).toFixed(1)} your own rate, from ${L.core.name}` : `none (${L.core.name} not ahead)` });
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

/** Board-confidence hit from public incidents at the next quarterly review, raw and capped (LIMITS board.incidentCap). */
export function incidentBoardHit(s: GameStateV2): { raw: number; capped: number; cap: number } {
  let raw = 0;
  for (const inc of s.player.safety.incidents) {
    if (inc.day < s.time.day - 91 || inc.labId !== 'player') continue;
    if (inc.exposure !== 'public' && inc.status !== 'leaked') continue;
    raw += Math.min(30, 10 + 5 * (inc.severity - 1));
  }
  return { raw, capped: Math.min(raw, INCIDENT_BC_CAP_Q), cap: INCIDENT_BC_CAP_Q };
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

/** A product's price against its cost and the value cap (LIMITS price.valueCap, model v3 V4.2): price per work-hour =
 *  markup × cost, never above the task's value (the sector wage); `capped` = share of its demand $ sold at the cap. */
export function priceView(s: GameStateV2, d: Deployment): { cost: number; price: number; margin: number; capped: number } {
  const x = revenueReadout(s).deps.find((r) => r.id === d.id);
  const cost = d.channel === 'consumer' ? x?.subCost ?? 0 : x?.costPerHour ?? 0;
  const price = d.channel === 'consumer' ? x?.subPrice ?? 0 : x?.pricePerHour ?? 0;
  return { cost, price, margin: price > 0 ? 1 - cost / price : 0, capped: x?.valueCapped ?? 0 };
}

/** A product's demand modifiers (LIMITS product.demandMods): each factor and the product of all. */
export function demandModifiers(d: Deployment): { label: string; mult: number }[] {
  const out: { label: string; mult: number }[] = [];
  if ((d.channel === 'api' || d.channel === 'agents') && d.kyc > 0) out.push({ label: `KYC ${d.kyc}`, mult: 1 - 0.02 * d.kyc });
  if (d.channel === 'trusted') out.push({ label: 'Trusted channel price', mult: TRUSTED_PREMIUM });
  if (d.status === 'restricted') out.push({ label: 'Restricted', mult: 0.3 });
  if (d.usagePolicy.noDropInReplacement) out.push({ label: 'No drop-in agents', mult: NaN });
  return out;
}

export { PENALTY_MAX } from '../worldfx/revenue';
export { PATCH_FLOOR, patchLevel } from '../safety/responses';
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
  // J2 PR1: spare serving runs research agents by default; it is idle only when kept as headroom.
  const pool = servingPool(s);
  if (pool > 0 && p.policies.spareServing === 'headroom') {
    const need = revenueReadout(s).deps.reduce((a, d) => a + d.needH100e, 0);
    const spare = pool - need;
    if (spare > 0.25 * pool && spare > 5000) out.push({ id: 'serving', amount: spare, unit: 'H100e', share: spare / pool });
  }
  return out;
}
