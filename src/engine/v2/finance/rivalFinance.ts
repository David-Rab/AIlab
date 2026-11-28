// Rivals' money (FINANCE-V3 §12; FIN5b). Rivals stay simple: no cap table, board, debt or promises, but their numbers
// come from the same story as the player's (§1), so every valuation on the Story card is consistent by construction.
// Owner: WS3. Called from actors/rivals.ts (`rivalMoneyQ`, one line in rivalFinanceQ) and from capitalQ (`markRivals`,
// right after the player's mark, on the same story snapshot).
//
// - Valuation: a private rival's share of the sector value, marked each quarter half-way from its last mark (the
//   player's rule), at most the valuation cap (FIN6a: the same rule for the player): team value or a growth-scaled
//   multiple of its run-rate. The share has no revenue-size driver, so
//   without the cap a lab whose revenue collapsed kept a few percent of a sector the leader's revenue built (FIN5a: ≈ 54×
//   run-rate for trailing labs, 80–190× for dead ones in 2027). The cap is shown on the Story card's lab bars.
// - Credibility (one rule, from whether it keeps growing): revenue up over four quarters (or pre-revenue) Credible ×1,
//   down Unproven ×0.9, halved Doubted ×0.7. Governance by kind (the player's GOV_FACTOR table).
// - Money is display (N8b): revenue (the market's) and valuation (the story) are shown and feed the sector story; an
//   NPC lab keeps no cash flow, raises nothing and never runs out of money. It fails only through the bust (below).
// - Exit: a private lab the bust pushed into distress, still there a quarter later (E32 offers it to you first), is license-and-hired by
//   the largest big-tech rival (team, licence and compute to the buyer; its investors get about 1.25× their money back,
//   R21 C1–C5); it goes bankrupt only when no big-tech rival exists.
import { GOV_FACTOR } from '../../../data/v2/deals';
import { deactivateRival } from '../actors/rivals';
import { absorb } from '../npc/shocks';
import { request } from '../events/request';
import { persOf } from '../npc/lab';
import type { GameStateV2, Money, RivalLab, SystemCtx } from '../types';
import { revenueRun } from './observe';
import { growthOf, privateRivals, STORY, type StoryNow } from './story';

export const RIVAL = {
  /** Valuation cap of every private lab (FIN6a: one rule for the player and the rivals) = max(team value, multiple ×
   *  run-rate), the multiple scaled by 4-quarter revenue growth: 37× at ×5 a year, × (growth ÷ 5)^0.4 (R15 §1.5's
   *  growth exponent: ≈ 31× at ×3.3, 22× at ×1.4, 15× when revenue halves). Team value: what investors pay for a
   *  pre-revenue frontier team (SSI $32B in Apr 2025, Thinking Machines $12B [R21 A8]). The multiple: the leader-style
   *  lab's 20–37× at high growth, trailing labs at ×2–3 lower (15–20×) [R15 C11, FINANCE-V3 FC2] [fit]. Was (FIN5b,
   *  rivals only) $30B + 25× run-rate. */
  team: 30,
  multiple: 37,
  capGrowthRef: 5,
  capGrowthExp: 0.4,
  /** License-and-hire: most of the team joins the buyer (Inflection: founders and most of ~70 staff); investors get
   *  1.1–1.5× back (Inflection) [R21 C1–C5]. */
  exitStaff: 0.7,
  exitReturn: 1.25,
  /** All-in spend: $14K per H100e-year × 1.1 + $0.4B a year of staff and overhead [D] (was rivals.ts). */
  perH100eYear: 14e-6 * 1.1,
  overhead: 0.4,
} as const;

/** Board preset whose governance factor a private rival carries [D]: the safety lab is a PBC with a trust (Anthropic),
 *  the racer and the boutique upstart are founder-controlled (xAI, SSI / Thinking Machines), the simulated leader
 *  lab a nonprofit-controlled PBC (OpenAI after its Oct 2025 recapitalisation). */
export const RIVAL_GOV: Record<string, keyof typeof GOV_FACTOR> = { safety: 'pbcTrust', racer: 'founder', upstart: 'founder', leader: 'nonprofitPBC' };
export const rivalGov = (r: RivalLab): number => GOV_FACTOR[RIVAL_GOV[r.npc.kind] ?? 'pbcTrust'];

/** A rival's credibility rung from its revenue growth over four quarters (one rule). */
export function rivalCred(s: GameStateV2, r: RivalLab): { id: 'Credible' | 'Unproven' | 'Doubted'; mult: number; growth: number } {
  const g = growthOf(revenueRun(s, r.core.id), s.capital.ws3?.labRev?.[r.core.id]);
  return g >= 1 ? { id: 'Credible', mult: 1, growth: g } : g > STORY.growth[0] ? { id: 'Unproven', mult: 0.9, growth: g } : { id: 'Doubted', mult: 0.7, growth: g };
}

/** The run-rate multiple the cap allows at a 4-quarter revenue growth (R15's clamp ×0.5–×8): RIVAL.multiple at
 *  RIVAL.capGrowthRef, × (growth ÷ ref)^capGrowthExp (FIN6a). */
export const capMultiple = (growth: number): number =>
  RIVAL.multiple * Math.pow(Math.max(STORY.growth[0], Math.min(STORY.growth[1], growth || 1)) / RIVAL.capGrowthRef, RIVAL.capGrowthExp);

/** The most investors pay for a private lab (every one: rivals since FIN5b, the player since FIN6a): its team value, or
 *  the growth-scaled multiple × its run-rate if more. */
export const valueCap = (revenue: Money, growth: number): Money => Math.max(RIVAL.team, capMultiple(growth) * Math.max(0, revenue));

/** All-in spend a year ($B). */
export const rivalSpend = (r: RivalLab): Money => r.core.computeOnline * RIVAL.perH100eYear + RIVAL.overhead;

/** Parent- or state-funded labs are out of the bust's reach: only a private lab can be pushed into distress (bustTarget). N8b: it no longer decides cash or orders. */
export const parentFunded = (r: RivalLab) => persOf(r.npc).funding !== 'private';

/** The big-tech rival that would license-and-hire a failing lab: the one with the most compute. */
export function exitBuyer(s: GameStateV2, r?: RivalLab): RivalLab | undefined {
  let best: RivalLab | undefined;
  for (const x of s.rivals) if (x.core.status === 'active' && x.npc.kind === 'bigtech' && x !== r && (!best || x.core.computeOnline > best.core.computeOnline)) best = x;
  return best;
}

/** The most over-committed private rival (commitments ÷ revenue): the one a bust pushes into distress. */
export function bustTarget(s: GameStateV2): RivalLab | undefined {
  return privateRivals(s).filter((r) => !parentFunded(r)).sort((a, b) => b.finance.commitments / Math.max(0.1, b.finance.revenueRun) - a.finance.commitments / Math.max(0.1, a.finance.revenueRun))[0];
}

/** Quarterly mark of every private rival (capitalQ, after the player's, same story): the share moves half-way from the
 *  last mark to today's; valuation = sector value × that share, at most the cap; its part of this quarter's investor
 *  pool follows its valuation, scaled so the rivals' parts and the player's never exceed the pool; unused money carries
 *  50% (as the player's). At the start (no last mark) the share is today's. FIN6a: its commitments book is its spend a
 *  year (it was the start table's cash × 2 for the whole game). */
export function markRivals(s: GameStateV2, st: StoryNow): void {
  const S = st.sector.S;
  const labs = privateRivals(s);
  for (const r of labs) {
    const a = st.labs.find((x) => x.id === r.core.id);
    const share = a?.share ?? 0;
    const f = r.finance;
    f.mark = f.mark === undefined ? share : f.mark + STORY.blend * (share - f.mark);
    f.valuation = Math.max(0.01, Math.min(S * f.mark, valueCap(f.revenueRun, a?.growth ?? 1)));
    // FIN6a: its commitments book (an annual book: the bubble index and a merger read it) follows its spend.
    f.commitments = rivalSpend(r);
  }
}

const $ = (x: Money) => (x >= 1000 ? `$${(x / 1000).toFixed(2)}T` : `$${x >= 10 ? x.toFixed(0) : x.toFixed(1)}B`);

/** One rival's quarter of money (rivals.ts rivalFinanceQ, after its revenue moved). N8b: money is display, so the only
 *  thing it does is the bust: a private lab the bust pushed into distress this quarter is offered to you (E32); still
 *  in distress a quarter later it exits (license-and-hire by big tech, or bankruptcy). */
export function rivalMoneyQ(s: GameStateV2, ctx: SystemCtx, r: RivalLab): void {
  const f = r.finance;
  if (f.distress) return exitRival(s, ctx, r);
  if (s.capital.busted?.day !== s.time.day || s.capital.busted.rival !== r.core.id || parentFunded(r)) return;
  f.distress = true;
  ctx.log('rival', `${r.core.name}'s investors pull back in the bust: it is looking for a buyer.`, 2, r.core.id);
  request(s, 'E32', { lab: r.core.id }); // FIN3c (§9): offered to you first
}

/** License-and-hire by the largest big-tech rival, or bankruptcy when there is none (spec §12 exit). */
export function exitRival(s: GameStateV2, ctx: SystemCtx, r: RivalLab): void {
  const buyer = exitBuyer(s, r);
  const back = RIVAL.exitReturn * (r.finance.raised ?? 0);
  if (buyer) {
    buyer.core.staff.cap += Math.round(r.core.staff.cap * RIVAL.exitStaff);
    buyer.core.staff.saf += Math.round(r.core.staff.saf * RIVAL.exitStaff);
    absorb(buyer, r); // N6: the buyer takes the better lag and adds the seller's compute
    deactivateRival(s, ctx, r.core.id, 'merged', buyer.core.id,
      `${buyer.core.name} licenses ${r.core.name}'s models and hires most of its team; its compute moves to ${buyer.core.name}. ${r.core.name}'s investors get about ${$(back)} back (${RIVAL.exitReturn}× what they put in).`);
  } else {
    deactivateRival(s, ctx, r.core.id, 'bankrupt', undefined, `${r.core.name} goes bankrupt: no big-tech lab will license it and hire its team. Its staff scatter; its investors lose their ${$(r.finance.raised ?? 0)}.`);
  }
}
