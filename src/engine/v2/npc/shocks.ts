// N6 (design/npc/NPC-LABS.md §5): the finite list of shocks on an NPC lab's lag d (days behind the reference frontier).
// One small named function per shock, all built on one helper: move part of the way toward a position on the reference
// clock. A position is the lag a lab would have if its model were G: (reference year − clockOfG(G)) × 365.25 days
// (negative: ahead of the reference). A pull never worsens a lag (a lab already past the position moves nothing); d then
// relaxes back to its target by the lag rule (npc/lab.ts). The previews of the actions read the same `…Moves` functions
// the actions apply, so a preview equals its effect.
import { DISTILL_S } from '../../../data/v2/calibration';
import { PARTNER_TERMS } from '../../../data/v2/deals';
import { RELEASE_CADENCE_DAYS } from '../../../data/v2/npcLabs';
import { PRE_GAME_G_PER_YEAR } from '../../../data/v2/runDesign';
import { startLagG } from '../../../data/v2/starts';
import { SERIES_ANCHOR } from '../../../data/v2/timelineSeries';
import { distillFit, RECIPE_LEAK_SHARE, teacherAccess, TACIT_FIRM_SHARE } from '../production/diffusion';
import { licensedModel } from '../finance/observe';
import { CHINA_ID, PLAYER_ID, activeRivals, bestG, versionById } from '../models/labs';
import { playerRecipeG, startRecipeG } from '../models/stacks';
import { decimalYear } from '../core/time';
import { clockOfGAt, persOf } from './lab';
import { clockOfS, refS } from './reference';
import type { GameStateV2, LabId, RivalLab } from '../types';

// ───────────────────────────── parameters (N6; listed in design/archive/npc/N6-RESULT.md) ─────────────────────────────

/** Theft: days China needs to integrate stolen weights (adapt, serve, post-train them on its own stack), the one typical
 *  value [P]: AI 2027's China, after stealing Agent-2, is about 2 months behind (it goes from about 6 to 2; the former
 *  THEFT_GAP_CLOSED's source, research/RD-X04r T5). */
export const THEFT_INTEGRATION_DAYS = 60;
/** Safety spillover (a spilling safety finding published): the fixed step every lab's lag falls, days [D]: SPILL_G's
 *  0.024 OOM at the reference's early pace of about 1.2 OOM a year. */
export const SPILL_DAYS = 7;

// ───────────────────────────── the reference clock and positions ─────────────────────────────

/** The year on the reference clock (what every NPC lab reads in place of the calendar year): decimalYear less the days a
 *  verified treaty has held the clock back (world/chinagov.ts: it runs at CHINAGOV.treatyClockRate while the treaty holds;
 *  the NPC labs' side of the treaty's compute cap). */
export const refYear = (s: GameStateV2) => decimalYear(s) - (s.chinagov?.clockLostDays ?? 0) / 365.25;

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
// ───────────────────────────── the know-how scale (F1, design/bal/NPC-FIX.md "The one rule") ─────────────────────────────
// Know-how is SOFTWARE, never compute: a lab on the reference path at clock year y has the reference software level S_ref(y)
// (npc/reference.ts refS). It is put on the player's recipe scale (recipe G at RECIPE_F, OOM over the leader's day-0 recipe;
// models/stacks.ts) by one alignment: a lab on the reference path at the player's START position has the player's START
// recipe. The start position is the player's day-0 model's place on the reference clock: the leader's V0 is the reference
// at the anchor (2025.445, G_ref = G(V0)); a follower sits its start lag (data/v2/starts.ts startLagG, months at
// PRE_GAME_G_PER_YEAR) before it. Before the anchor the scale runs back at PRE_GAME_G_PER_YEAR, the pace the start lags are
// written in (a start lag is all recipe: core/init.ts solves it as one, RD-U06). So
//   knowhowAt(y) = R0 + lagG + S_ext(y),  S_ext(y) = S_ref(y) after the anchor, −(anchor − y) × PRE_GAME_G_PER_YEAR before,
// with R0 the player's start recipe (stacks.ts startRecipeG) and lagG its start lag: at the start position S_ext = −lagG, so
// knowhowAt = R0. A player whose own research tracks the reference software path from there keeps own = knowhowAt(its
// position), so a lab on the reference path at that position gives it no inflow. A world without a draw has no software
// path: S_ext is 0 after the anchor [D stand-in: no software growth to diffuse].

/** The reference software level, extended before the anchor (S_ext above; OOM, 0 at the anchor). */
function softwareAt(s: GameStateV2, y: number): number {
  return y <= SERIES_ANCHOR ? -(SERIES_ANCHOR - y) * PRE_GAME_G_PER_YEAR : (refS(s, y) ?? 0);
}
/** The know-how scale's offset R0 + lagG (above). */
const knowhowOffset = (s: GameStateV2) => startRecipeG(s) + startLagG(s.setup.start ?? 'leader');
/** Know-how (recipe G at RECIPE_F, the player's recipe scale) of a lab on the reference path at clock year `y`. */
export const knowhowAt = (s: GameStateV2, y: number) => knowhowOffset(s) + softwareAt(s, y);
/** An NPC lab's know-how: the reference's at its position, its lag d plus (unless `internal`) its release lag behind the
 *  reference clock. No compute term: doubling its compute leaves it unchanged. `internal`: what its staff know (its
 *  internal model's position; the C4 tacit leak). */
export function npcKnowhow(s: GameStateV2, r: Pick<RivalLab, 'npc'>, internal = false): number {
  const n = r.npc;
  return knowhowAt(s, refYear(s) - (n.d + (internal ? 0 : persOf(n).releaseLagDays)) / 365.25);
}
/** F1: the public know-how level P: the best know-how of the active NPC labs that have released a model (npcKnowhow at
 *  the public position), and the lab it comes from; -Infinity without one. */
export function publicKnowhow(s: GameStateV2): { P: number; from?: string } {
  let P = -Infinity, from: string | undefined;
  for (const r of labs(s)) {
    if (!r.publicModel) continue;
    const k = npcKnowhow(s, r);
    if (k > P) { P = k; from = r.core.name; }
  }
  return { P, from };
}
/** F2: C4 tacit knowledge: what `moved` of lab `r`'s capabilities staff carry to the player, as the rise of its
 *  effective recipe: the tacit share (tacitShare) of the gap from it to the lab's internal know-how (0 with no gap).
 *  It raises the diffused level D, not own (models/stacks.ts raiseDiffused). */
export function tacitKnowhowGain(s: GameStateV2, r: RivalLab, moved: number): number {
  if (!r.npc) return 0;
  return tacitShare(moved, r.core.staff.cap) * Math.max(0, npcKnowhow(s, r, true) - playerRecipeG(s));
}

/** KNOW-HOW → LAG (the one conversion the know-how shocks use: open weights, the secrets leak). A shock that
 *  transfers know-how closes a share of the receiver's know-how (software) gap, not of its whole capability gap: a leak
 *  carries no compute. `knowhowPos` is where know-how `K` (the scale above) sits: the lag of a lab on the reference path
 *  whose know-how is K, i.e. the clock where knowhowAt reaches K (undefined past the run's reach). `knowhowPull` moves the
 *  receiver `share` of the way to a source at that position: on a smooth path closing share x of the know-how gap is closing
 *  share x of the lag gap (the lead accepts this for now). */
export function knowhowPos(s: GameStateV2, K: number): number | undefined {
  if (!Number.isFinite(K)) return undefined;
  const x = K - knowhowOffset(s);
  const clock = x <= 0 ? SERIES_ANCHOR + x / PRE_GAME_G_PER_YEAR : clockOfS(s, x);
  if (clock === undefined) return undefined;
  const d = (refYear(s) - clock) * 365.25;
  return Number.isFinite(d) ? d : undefined;
}
export const knowhowPull = pullDays;
/** The player's know-how position: where its effective recipe sits (models/stacks.ts playerRecipeG, max(own, D)). */
export const playerKnowhowPos = (s: GameStateV2) => knowhowPos(s, playerRecipeG(s));

/** Apply a move of `days` (positive: the lag falls). */
function move(r: Pick<RivalLab, 'npc'>, days: number): number {
  if (r.npc && days !== 0 && Number.isFinite(days)) r.npc.d -= days;
  return days;
}
export interface Move { lab: RivalLab; days: number }
const apply = (moves: Move[]) => moves.map((m) => move(m.lab, m.days));
/** Every active NPC lab (the US labs and China's). */
const labs = (s: GameStateV2): RivalLab[] => [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])].filter((r) => r.npc);

// ───────────────────────────── the shocks ─────────────────────────────

/** THEFT: China's lag jumps to the victim's position plus the integration delay (only ever shortens it). The one integration
 *  rule of a theft (NPC-LABS §5): the lab's daily step follows the lag, so nothing else sets the stolen model's G. Returns
 *  the days gained. */
export function theft(s: GameStateV2, stolenG: number): number {
  const cn = s.china.lab, pos = posOf(s, stolenG);
  if (!cn.npc || pos === undefined) return 0;
  return move(cn, Math.max(0, cn.npc.d - (pos + THEFT_INTEGRATION_DAYS)));
}

/** OPEN WEIGHTS (C6 and any open release; `releaser` = the lab's id or 'player'): only China absorbs them (as before the NPC
 *  merge; the US labs have their own stacks and the diffusion rule reads their public models), and not its own. Above the open
 *  frontier it closes RECIPE_LEAK_SHARE.openWeights of its know-how gap to the release (lag days, knowhowPull). The release's
 *  know-how: an NPC lab's model sits on the reference clock at its G; the player's is its recipe less the release's distance
 *  below its best model (an older model, an older recipe). */
export const openWeightsMoves = (s: GameStateV2, releaser: LabId, G: number): Move[] => {
  const cn = s.china.lab;
  if (releaser === CHINA_ID || cn.core.status !== 'active' || !(G > s.knowledge.openWeightsG)) return [];
  const pos = releaser === PLAYER_ID ? knowhowPos(s, playerRecipeG(s) - Math.max(0, bestG(s, PLAYER_ID) - G)) : posOf(s, G);
  const days = knowhowPull(cn, pos, RECIPE_LEAK_SHARE.openWeights);
  return days > 0 ? [{ lab: cn, days }] : [];
};
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

/** CHINA'S SECRETS LEAK: a daily close of its KNOW-HOW gap to the player by the channel's strength `share` (a fraction of
 *  the gap a day; security/theft.ts secretsLeakDaily: spies × weak security), as the code before the NPC merge did (secrets
 *  are recipe, not what the player's compute buys). Returns the days gained. */
export const secretsLeak = (s: GameStateV2, share: number) => move(s.china.lab, knowhowPull(s.china.lab, playerKnowhowPos(s), share));

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
