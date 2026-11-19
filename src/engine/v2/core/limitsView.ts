// Read-only views of the limits the player can hit (STRUCTURE R11, data/v2/limits.ts): the live reading of each cap,
// floor or gate where the UI shows it. Pure selectors; nothing here changes state or reads hidden truth.
import { PROD_SPEED_CAP, REF_TECH } from '../../../data/v2/calibration';
import { SITE_PATHS } from '../../../data/v2/deals';
import { TREE_BY_ID } from '../../../data/v2/tree';
import { decimalYear } from './time';
import { labInputs, evalM, referenceTech, diffusionPerDay } from '../production/production';
import { internalVersion, PLAYER_ID, LEADER_ID } from '../models/labs';
import { deltaRsch, slopeL } from '../models/capability';
import { ws4r } from '../actors/state';
import { wslFloor } from '../security/security';
import { incidentHit, INCIDENT_BC_CAP_Q, moodWeight } from '../finance/mood';
import { spotRentalCap } from '../compute/orders';
import { leaseAvailableGW } from '../compute/sites';
import { RPH_MCAP, TRUSTED_PREMIUM, revenueReadout, servingPool } from '../worldfx/revenue';
import { idleChips } from '../compute/forecast';
import { idleTeams } from '../models/tree';
import { multiplierRef } from '../world/calibration';
import { outsidersWithAccess } from '../safety/incidents';
import type { Deployment, GameStateV2, ModelVersion } from '../types';

export interface SpeedLimitLine {
  id: 'speed.frontierMethods' | 'speed.serialCap' | 'speed.etaMod' | 'speed.pause' | 'speed.diffusion';
  /** Multiplier on research speed (or know-how rate) it applies today; 1 = not binding. */
  mult: number;
  /** Short reading for the line. */
  text: string;
  binding: boolean;
  /** Ideas that lift it (tree node names), when any. */
  fix?: string[];
}

/** Research-speed limit lines (LIMITS "Research speed"): frontier methods, serial speed cap, ηmod clamp, pause,
 *  knowledge diffusion. Lines that cannot apply in this game (no leader lab to learn from, no pause) are omitted. */
export function researchSpeedLimits(s: GameStateV2): SpeedLimitLine[] {
  const out: SpeedLimitLine[] = [];
  const p = s.player;
  const w = s.hidden.timeline;
  const inp = labInputs(s, PLAYER_ID);
  const r = p.prodCache;
  // Frontier methods: after SC the reference lab is assumed to run automated research and latent reasoning.
  const rt = referenceTech(p.scDay, s.time.day);
  // The factor counts only the methods you lack: without P13 the experiment ratio is short by rt.c; without a latent
  // (Neuralese) base the agent ratio by rt.k. What you have offsets its part (P13's ×1.5, the latent base's ηmod).
  const lacks: string[] = [];
  const lackC = p.paradigms.P13?.status !== 'adopted';
  if (lackC) lacks.push(TREE_BY_ID.P13?.name ?? 'P13');
  const v = internalVersion(s);
  const base = v ? p.models.bases.find((b) => b.id === v.baseId) : undefined;
  const lackK = base?.design.shape !== 'latent';
  if (lackK) lacks.push(TREE_BY_ID.P17?.name ?? 'P17');
  if (p.scDay === undefined) {
    out.push({ id: 'speed.frontierMethods', mult: 1, binding: false, text: `from ${REF_TECH.from} d after SC`, fix: lacks });
  } else {
    let m = 1;
    if (inp && lacks.length && (rt.k > 1 || rt.c > 1)) m = evalM(w, inp).M / Math.max(1e-9, evalM(w, { ...inp, k: inp.k * (lackK ? rt.k : 1), c: inp.c * (lackC ? rt.c : 1) }).M);
    out.push({ id: 'speed.frontierMethods', mult: m, binding: m < 0.995, text: !lacks.length ? 'matched' : m < 0.995 ? `×${m.toFixed(2)}` : 'not yet binding', fix: lacks });
  }
  // Serial speed of research agents (R11 #23).
  if (r) {
    const raw = 8 + 10.8 * Math.log2(Math.max(1, r.M));
    out.push({ id: 'speed.serialCap', mult: 1, binding: raw >= PROD_SPEED_CAP, text: raw >= PROD_SPEED_CAP ? `capped at ${PROD_SPEED_CAP}×` : `${Math.round(raw)}× of ${PROD_SPEED_CAP}×` });
  }
  // ηmod clamp 0.5–2.5 on the research model's serve cost.
  const serve = v?.serveCost ?? 0.5;
  const eta = 0.5 / serve;
  const etaC = Math.min(2.5, Math.max(0.5, eta));
  out.push({ id: 'speed.etaMod', mult: etaC, binding: eta > 2.5 || eta < 0.5, text: `copies ×${etaC.toFixed(2)}${eta > 2.5 ? ' (max)' : eta < 0.5 ? ' (min)' : ''}` });
  // Pause of frontier experiments.
  const until = ws4r(s).frontierPauseUntil;
  if (s.flags.paused || until > s.time.day) out.push({ id: 'speed.pause', mult: 0.1, binding: true, text: until > s.time.day ? `×0.1 for ${until - s.time.day} d` : '×0.1 while paused' });
  // Knowledge diffusion from the simulated frontier leader (follower starts).
  const L = s.rivals.find((x) => x.core.id === LEADER_ID && x.core.status === 'active');
  if (L) {
    const dif = diffusionPerDay(s);
    const rate = r?.rate ?? 0;
    const add = rate > 0 ? (dif.dpa * 365) / rate : 0;
    out.push({ id: 'speed.diffusion', mult: 1 + add, binding: dif.dpa > 0, text: dif.dpa > 0 ? `+${Math.round(add * 100)}% know-how from ${L.core.name}` : `none (${L.core.name} not ahead)` });
  }
  return out;
}

/** The research boost from a version's design offsets, raw and after the ±0.5 y clamp (LIMITS model.designOffset). */
export function designOffsetView(s: GameStateV2, v: ModelVersion): { years: number; raw: number; capped: boolean } {
  const w = s.hidden.timeline;
  const off = v.build?.off;
  const x = off ? 0.6 * (off.CODE ?? 0) + 0.4 * (off.RSCH ?? 0) : 0;
  const raw = x === 0 ? 0 : x / slopeL(w, v.pm);
  const years = deltaRsch(w, v);
  return { years, raw, capped: Math.abs(raw) > 0.5 + 1e-9 };
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

/** Revenue-per-chip research-speed cap on a product's model (LIMITS revenue.speedCap). */
export function revenueSpeedCap(s: GameStateV2, v: ModelVersion | undefined): { M: number; capped: boolean; cap: number } {
  const M = v ? multiplierRef(s.hidden.timeline, v.pm) : 0;
  return { M, capped: M > RPH_MCAP, cap: RPH_MCAP };
}

/** A product's demand modifiers (LIMITS product.demandMods): each factor and the product of all. */
export function demandModifiers(d: Deployment): { label: string; mult: number }[] {
  const out: { label: string; mult: number }[] = [];
  if ((d.channel === 'api' || d.channel === 'agents') && d.kyc > 0) out.push({ label: `KYC ${d.kyc}`, mult: 1 - 0.02 * d.kyc });
  if (d.channel === 'trusted') out.push({ label: 'Trusted channel', mult: TRUSTED_PREMIUM });
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
