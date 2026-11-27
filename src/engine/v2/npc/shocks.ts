// N6 (design/npc/NPC-LABS.md §5): the finite list of shocks on an NPC lab's lag d (days behind the reference frontier).
// One small named function per shock, all built on one helper: move part of the way toward a position on the reference
// clock. A position is the lag a lab would have if its model were G: (reference year − clockOfG(G)) × 365.25 days
// (negative: ahead of the reference). A pull never worsens a lag (a lab already past the position moves nothing); d then
// relaxes back to its target by the lag rule (npc/lab.ts). The previews of the actions read the same `…Moves` functions
// the actions apply, so a preview equals its effect.
import { DISTILL_S } from '../../../data/v2/calibration';
import { PARTNER_TERMS } from '../../../data/v2/deals';
import { RELEASE_CADENCE_DAYS } from '../../../data/v2/npcLabs';
import { distillFit, RECIPE_LEAK_SHARE, teacherAccess, TACIT_FIRM_SHARE } from '../production/diffusion';
import { licensedModel } from '../finance/observe';
import { CHINA_ID, PLAYER_ID, activeRivals, bestG, versionById } from '../models/labs';
import { decimalYear } from '../core/time';
import { clockOfGAt } from './lab';
import type { GameStateV2, LabId, RivalLab } from '../types';

// ───────────────────────────── parameters (N6; listed in design/archive/npc/N6-RESULT.md) ─────────────────────────────

/** Theft: days China needs to integrate stolen weights (adapt, serve, post-train them on its own stack), the one typical
 *  value [P]: AI 2027's China, after stealing Agent-2, is about 2 months behind (it goes from about 6 to 2; the old
 *  THEFT_GAP_CLOSED's source, research/RD-X04r T5). */
export const THEFT_INTEGRATION_DAYS = 60;
/** Treaty: the reference clock's speed under a verified treaty (the former research-rate multiplier) [D]. */
export const TREATY_CLOCK_RATE = 0.65;
/** Safety spillover (a spilling safety finding published): the fixed step every lab's lag falls, days [D]: SPILL_G's
 *  0.024 OOM at the reference's early pace of about 1.2 OOM a year. */
export const SPILL_DAYS = 7;

// ───────────────────────────── the reference clock and positions ─────────────────────────────

const LOST = 'npc:clockLost';
const LOST_DAY = 'npc:clockDay';
/** Treaty (the reference clock runs ×TREATY_CLOCK_RATE for every lab): call once a day (idempotent within a day). The
 *  clock the labs read is the calendar year less the reference days the treaty has held back. */
export function treatyClockDay(s: GameStateV2): void {
  if (s.flags[LOST_DAY] === s.time.day) return;
  s.flags[LOST_DAY] = s.time.day;
  if (s.gov.treaty === 'verified') s.flags[LOST] = Number(s.flags[LOST] ?? 0) + (1 - TREATY_CLOCK_RATE);
}
/** The year on the reference clock (what every lab reads in place of the calendar year): decimalYear less the days a verified
 *  treaty has held the clock back. */
export const refYear = (s: GameStateV2) => decimalYear(s) - Number(s.flags[LOST] ?? 0) / 365.25;

/** The lag (days behind the reference) of a lab whose model would be at G; undefined when G is not on the reference run. */
export function posOf(s: GameStateV2, G: number): number | undefined {
  if (!Number.isFinite(G)) return undefined;
  const d = (refYear(s) - clockOfGAt(s, G)) * 365.25;
  return Number.isFinite(d) ? d : undefined;
}
/** The player's position: where its best model is. */
export const playerPos = (s: GameStateV2) => posOf(s, bestG(s, PLAYER_ID));

/** The one helper: how many days lab `r`'s lag falls moving `share` of the way toward position `pos` (0 when it is already
 *  at or past it). */
export function pullDays(r: Pick<RivalLab, 'npc'>, pos: number | undefined, share: number): number {
  if (!r.npc || pos === undefined || !(share > 0)) return 0;
  return Math.max(0, share * (r.npc.d - pos));
}
/** Apply a move of `days` (positive: the lag falls). */
function move(r: Pick<RivalLab, 'npc'>, days: number): number {
  if (r.npc && days !== 0 && Number.isFinite(days)) r.npc.d -= days;
  return days;
}
export interface Move { lab: RivalLab; days: number }
const apply = (moves: Move[]) => moves.map((m) => move(m.lab, m.days));
/** Every active NPC lab (the US labs and China's), without `skip`. */
const labs = (s: GameStateV2, skip?: LabId): RivalLab[] => [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])].filter((r) => r.core.id !== skip && r.npc);
/** Moves of every lab behind position `pos`, each `share` of the way. */
const pulls = (s: GameStateV2, pos: number | undefined, share: number, skip?: LabId): Move[] =>
  labs(s, skip).map((lab) => ({ lab, days: pullDays(lab, pos, share) })).filter((m) => m.days > 0);

// ───────────────────────────── the shocks ─────────────────────────────

/** THEFT: China's lag jumps to the victim's position plus the integration delay (only ever shortens it). Returns the days gained. */
export function theft(s: GameStateV2, stolenG: number): number {
  const cn = s.china.lab, pos = posOf(s, stolenG);
  if (!cn.npc || pos === undefined) return 0;
  return move(cn, Math.max(0, cn.npc.d - (pos + THEFT_INTEGRATION_DAYS)));
}

/** OPEN WEIGHTS (C6 and any open release; `releaser` = the lab's id or 'player'): above the open frontier, every other lab
 *  behind the released model moves RECIPE_LEAK_SHARE.openWeights of the way to it. */
export const openWeightsMoves = (s: GameStateV2, releaser: LabId, G: number): Move[] =>
  G > s.knowledge.openWeightsG ? pulls(s, posOf(s, G), RECIPE_LEAK_SHARE.openWeights, releaser) : [];
export const openWeights = (s: GameStateV2, releaser: LabId, G: number) => apply(openWeightsMoves(s, releaser, G));

/** ABSORB (license-and-hire by an NPC buyer, finance/rivalFinance.ts exitRival): the buyer takes the better lag and adds the
 *  seller's compute; the seller leaves (the caller deactivates it). A buyer that is the player (E22, E32) has no lag: nothing. */
export function absorb(buyer: RivalLab, seller: RivalLab): number {
  buyer.core.computeOnline += seller.core.computeOnline;
  if (!buyer.npc || !seller.npc) return 0;
  return move(buyer, Math.max(0, buyer.npc.d - seller.npc.d));
}

/** IP ACCESS (FIN4b): each day, for each running deal the partner `lab` has, it moves ipCloseYr ÷ 365 of the way to the
 *  player's licensed model (finance/observe.ts licensedModel). */
export function ipAccessDays(s: GameStateV2, r: RivalLab): number {
  let share = 0, pos: number | undefined;
  for (const x of s.player.finance.deals) {
    const ip = x.strings.ipAccess;
    if (!ip || ip.lab !== r.core.id || x.until <= s.time.day) continue;
    const v = licensedModel(s, s.player.board.preset === 'pbcTrust' && !ip.trust);
    if (!v) continue;
    share += PARTNER_TERMS.strings.ipCloseYr / 365;
    pos = posOf(s, v.G);
  }
  return pullDays(r, pos, share);
}
export const ipAccess = (s: GameStateV2, r: RivalLab) => move(r, ipAccessDays(s, r));

/** POACH IN (C4): the rival loses `moved` of its `staff` capabilities heads; its lag rises by the tacit share moved of
 *  the days it leads the player by (what the heads carry over to the player is the same share of that gap). */
export const tacitShare = (moved: number, staff: number) => TACIT_FIRM_SHARE * Math.min(1, Math.max(0, moved) / Math.max(1, staff));
export function poachInDays(s: GameStateV2, r: RivalLab, moved: number): number {
  const pp = playerPos(s);
  if (!r.npc || pp === undefined) return 0;
  return Math.max(0, tacitShare(moved, r.core.staff.cap) * (pp - r.npc.d));
}
export const poachIn = (s: GameStateV2, r: RivalLab, moved: number) => move(r, -poachInDays(s, r, moved));

/** SAFETY SPILLOVER (a SPILL finding published): a fixed small step down the lag, not past the player. */
const stepMoves = (s: GameStateV2, rs: RivalLab[], days: number): Move[] => {
  const pp = playerPos(s);
  return rs.map((lab) => ({ lab, days: Math.min(days, pullDays(lab, pp, 1)) })).filter((m) => m.days > 0);
};
export const spillMoves = (s: GameStateV2): Move[] => stepMoves(s, labs(s), SPILL_DAYS);
export const spill = (s: GameStateV2) => apply(spillMoves(s));

/** CHINA'S SECRETS LEAK: a daily pull toward the player's position by the channel's strength `share` (a fraction of the gap
 *  a day; security/theft.ts secretsLeakDaily: spies × weak security). Returns the days gained. */
export const secretsLeak = (s: GameStateV2, share: number) => move(s.china.lab, pullDays(s.china.lab, playerPos(s), share));

/** CHINA'S DISTILLATION: at each of its releases, a pull toward the player's best servable product by the channel's
 *  strength: DISTILL_S × access × fit (production/diffusion.ts rule B's coefficient; a level, taken once per release). */
export function distillDays(s: GameStateV2): number {
  const cn = s.china.lab;
  if (!cn.npc || cn.core.status !== 'active') return 0;
  let best = 0;
  for (const d of s.player.deployments) {
    if (d.status !== 'live' || d.channel === 'internal') continue;
    const v = versionById(s, d.versionId);
    if (!v) continue;
    best = Math.max(best, pullDays(cn, posOf(s, v.G), DISTILL_S * teacherAccess(s, CHINA_ID, d.channel === 'open', d) * distillFit(cn.internal.params)));
  }
  return best;
}
export const distill = (s: GameStateV2) => move(s.china.lab, distillDays(s));
/** Days of lag China's distillation closes in a year if the player's products stay as they are (one pull a release). */
export const distillDaysPerYear = (s: GameStateV2) => distillDays(s) * (365.25 / RELEASE_CADENCE_DAYS);
