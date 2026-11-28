// Valuation, raises, dilution, the raise ceiling and the IPO (V2-SPEC §3.7.3; research/15 §1.5; FINANCE-V3 §2). Owner:
// WS3.
import { dayOfQuarter, quarterIndex } from '../core/time';
import type { Day, GameStateV2, Money, Ownership, RepricedRound, SystemCtx, Thesis, Tranche } from '../types';
import { ensureWs3, yearStats, type PendingRound } from './ext';
import { bookCash } from './ledger';
import { votesOf } from './control';
import { resizeCreditLine } from './debt';
import { boardMood, MOOD_BASE } from './mood';
import { addPromise, typicalRound } from './promises';

// FIN5a: the valuation is the story split (finance/story.ts: sector value × share), marked in capitalQ.

/** FIN2 removed the revenue-based annual cap (k_Y): a round is bounded by the investor pool and the dilution cap. */
export interface RaiseCeiling { max: Money; bound: 'pool' | 'dilution' | 'ask'; parts: Record<string, Money> }

/** Maximum dilution per round: 0.08 private; 0.05 IPO (R15 §1.5). */
export const dMax = (ipo: boolean) => (ipo ? 0.05 : 0.08);

/**
 * EngineApi.raiseCeiling: min(pool share, d_max·V_pre/(1 − d_max), ask) (spec §2.1; FIN2 removed the k_Y annual cap).
 * V_pre = the mark × the pitch's price (`priceMult`). The UI shows `bound`. Tight runway cuts the pool share ×0.8;
 * distress or a closed market leaves only rescue capital (max 0).
 */
export function raiseCeiling(s: GameStateV2, ask = Number.POSITIVE_INFINITY, opts: { ipo?: boolean; priceMult?: number } = {}): RaiseCeiling {
  const f = s.player.finance;
  const cw = s.capital.ws3;
  const V = Math.max(1, f.valuation * (opts.priceMult ?? 1));
  const d = dMax(!!opts.ipo);
  const tight = f.state === 'tight' ? 0.8 : 1;
  const closed = f.state === 'distress' || f.state === 'insolvent';
  const poolQ = cw ? cw.playerPoolQ - cw.playerTakenQ : 0.3 * (s.capital.poolAnnual / 4 + s.capital.carry);
  const ipoBonus = opts.ipo ? 0.5 * s.capital.poolAnnual * 0.25 : 0; // the first IPOs unlock a one-time public pool [R15]
  const parts: Record<string, Money> = {
    pool: closed ? 0 : Math.max(0, poolQ * tight + ipoBonus),
    dilution: (d * V) / (1 - d),
    ask: Math.max(0, ask),
  };
  let bound: RaiseCeiling['bound'] = 'pool';
  for (const k of ['dilution', 'ask'] as const) if (parts[k] < parts[bound]) bound = k;
  return { max: parts[bound], bound, parts };
}

/** Issue `frac` of the company to `holder`, diluting everyone else pro rata (R15 §1.5 bookkeeping). */
export function issue(o: Ownership, frac: number, holder: { kind: 'fin' } | { kind: 'public' } | { kind: 'strat'; name: string }): void {
  const k = 1 - frac;
  o.founder *= k;
  o.mission *= k;
  o.fin *= k;
  o.public *= k;
  for (const n of Object.keys(o.strat)) o.strat[n] *= k;
  if (holder.kind === 'fin') o.fin += frac;
  else if (holder.kind === 'public') o.public += frac;
  else o.strat[holder.name] = (o.strat[holder.name] ?? 0) + frac;
}

/** Equity a stake cap leaves room for ($B at valuation V): new money E at V gives a holder with `stake` a stake of
 *  (stake·V + E)/(V + E), so E ≤ V(cap − stake)/(1 − cap). */
export const stakeRoom = (V: Money, stake: number, cap: number) => Math.max(0, (V * (cap - stake)) / (1 - cap));

/** A strategic partner buys `amount` of new shares at today's valuation (FIN4a: partner deals and their tranches):
 *  cash in, shares to the partner, valuation up by the money. `stakeCap` (a hyperscaler's 15%) limits what it may buy;
 *  the part past the cap does not land. `priceMult`: the shares are priced at that share of the valuation (a rescue, in
 *  distress, pays half). Returns the money booked. */
export function partnerEquityIn(s: GameStateV2, ctx: SystemCtx, partner: string, amount: Money, label: string, stakeCap?: number, priceMult = 1): Money {
  const f = s.player.finance;
  const V = Math.max(10, f.valuation) * priceMult;
  const amt = Math.max(0, stakeCap !== undefined ? Math.min(amount, stakeRoom(V, f.ownership.strat[partner] ?? 0, stakeCap)) : amount);
  if (stakeCap !== undefined && amt < amount - 0.05) ctx.log('finance', `${label}: ${partner}'s stake is capped at ${Math.round(stakeCap * 100)}%; $${(amount - amt).toFixed(1)}B of it lapses.`, 2);
  if (amt <= 0) return 0;
  issue(f.ownership, amt / (V + amt), { kind: 'strat', name: partner });
  f.valuation = V + amt;
  bookCash(s, ctx, amt, 'financing', label, partner);
  yearStats(s).dealEquity += amt;
  return amt;
}

/** The share of all votes `partner` would hold after buying each of `buys` ($B of new shares, in order: the first at
 *  `priceMult` of today's valuation, the rest at the valuation each leaves), each under `stakeCap` as partnerEquityIn
 *  books it, with its stake voting when `voting`. On a copy of the cap table (CORPORATE.md §4: every path that raises
 *  one holder's votes is judged at the votes it reaches). */
export function partnerVotesAfter(s: GameStateV2, partner: string, buys: Money[], opts: { priceMult?: number; stakeCap?: number; voting?: boolean } = {}): number {
  const f = s.player.finance;
  const o: Ownership = { ...f.ownership, strat: { ...f.ownership.strat } };
  let V = Math.max(10, f.valuation) * (opts.priceMult ?? 1);
  for (const b of buys) {
    const amt = Math.max(0, opts.stakeCap !== undefined ? Math.min(b, stakeRoom(V, o.strat[partner] ?? 0, opts.stakeCap)) : b);
    if (amt <= 0) continue;
    issue(o, amt / (V + amt), { kind: 'strat', name: partner });
    V += amt;
  }
  const stratVoting = { ...(f.stratVoting ?? {}), ...(opts.voting ? { [partner]: true as const } : {}) };
  return votesOf({ player: { finance: { ownership: o, dualClass: f.dualClass, stratVoting }, charter: s.player.charter } }, partner);
}

/** Outside (financial + strategic + public) ownership share. */
export const outsideShare = (o: Ownership) => o.fin + o.public + Object.values(o.strat).reduce((a, b) => a + b, 0);

/** Last priced round's post-money (down-round reference). */
export const lastPostMoney = (s: GameStateV2) => s.player.finance.rounds.length ? s.player.finance.rounds[s.player.finance.rounds.length - 1].postMoney : 0;

/** Can a priced round start now? One pending at a time; none in distress. A 'closed' rating shuts credit markets
 *  only (deviation from §3.7.4 'closed to everything': equity follows the investor pool, which already prices risk). */
export function canRaise(s: GameStateV2): true | string {
  const f = s.player.finance;
  ensureWs3(s);
  // A round takes one quarter to close, which is also the minimum gap between priced rounds (R15 §1.5).
  if (f.ws3.pendingRound) return 'A round is already in progress';
  if (f.ws3.repricedRound) return 'Decide on the repriced round first';
  if (f.state === 'distress' || f.state === 'insolvent') return 'Distress: only rescue capital (down round, strategic rescue)';
  return true;
}

/** Is the company listed (any public float)? */
export const isListed = (s: GameStateV2) => s.player.finance.ownership.public > 0;

/** The IPO (spec §2.6): one time, only while the IPO window is open and the company is healthy. */
export function canIpo(s: GameStateV2): true | string {
  const f = s.player.finance;
  if (isListed(s)) return 'Already listed';
  if (f.ws3?.pendingRound?.ipo) return 'The IPO is in progress';
  if (!s.capital.ipoWindow) return 'The IPO window is closed (it opens in 2026 while investor hype holds)';
  if (f.state !== 'healthy') return `Only a healthy company can list (runway is ${f.state})`;
  return canRaise(s);
}

/** Start a raise; it closes at the next quarter (capitalQ). Priced rounds carry a thesis and the pitch's price
 *  multiplier (FIN2); the IPO carries neither and may be dual-class. */
export function startRaise(s: GameStateV2, ctx: SystemCtx, ask: Money, opts: { ipo?: boolean; thesis?: Thesis; priceMult?: number; dualClass?: boolean } = {}): PendingRound {
  const k = opts.priceMult ?? 1;
  const c = raiseCeiling(s, Number.POSITIVE_INFINITY, { ipo: !!opts.ipo, priceMult: k });
  const r: PendingRound = { day: s.time.day, ask, max: c.max, preMoney: s.player.finance.valuation * k, ipo: !!opts.ipo };
  if (opts.thesis) r.thesis = opts.thesis;
  if (k !== 1) r.priceMult = k;
  if (opts.dualClass) r.dualClass = true;
  s.player.finance.ws3.pendingRound = r;
  s.capital.ws3.playerTakenQ += Math.min(ask, c.max);
  ctx.log('finance', `Raising $${ask.toFixed(1)}B${opts.ipo ? ` (IPO${opts.dualClass ? ', dual-class' : ''})` : ''}; closes next quarter.`);
  return r;
}

/** Large priced rounds arrive in two parts [R15]: half at the close, the rest as a tranche due two quarters later if
 *  revenue reaches 1.2× its run-rate at the close within four quarters (the recapitalisation for an unconverted legacy
 *  nonprofit). The IPO and the distress down round pay in full at the close (FIN4r, H3). */
export const LARGE_ROUND = { min: 20, nowShare: 0.5, revenueX: 1.2, dueQ: 2, deadlineQ: 4 } as const;

export interface RoundSplit { now: Money; tranche?: { amount: Money; condition: string; dueDay: Day; deadline: Day } }

/** How a round of `amount` closing on `closeDay` (default today) pays: cash at the close and the conditional tranche
 *  (FIN4r, H3; every raise preview and the Raise card show it). The revenue condition is read from the run-rate at the
 *  close, so a preview's is today's estimate. `full`: the IPO and the distress down round (no tranche). */
export function roundSplit(s: GameStateV2, amount: Money, opts: { full?: boolean; closeDay?: Day } = {}): RoundSplit {
  if (opts.full || amount < LARGE_ROUND.min) return { now: amount };
  const f = s.player.finance;
  const q = quarterIndex(s.time.startDate, opts.closeDay ?? s.time.day);
  // A profit cap ties large rounds to lifting it, until the lift is refused (then the revenue condition).
  const recap = s.player.charter.profitCap && !f.ws3?.recap.refused;
  const now = amount * LARGE_ROUND.nowShare;
  return { now, tranche: { amount: amount - now, condition: recap ? 'recapitalisation' : `revenue:${(f.revenueRun * LARGE_ROUND.revenueX).toFixed(1)}`, dueDay: dayOfQuarter(s.time.startDate, q + LARGE_ROUND.dueQ), deadline: dayOfQuarter(s.time.startDate, q + LARGE_ROUND.deadlineQ) } };
}

/** Cancel `part` (0–1) of the shares a round's tranche carries (FIN4r, H3): the investors keep only the shares they
 *  paid for. The shares were a fraction of the company at the close; every issue since scaled them with everyone, read
 *  off the insiders' (founder + mission) share. The other holders grow back pro rata. Returns the fraction cancelled. */
export function cancelTrancheShares(s: GameStateV2, t: Tranche, part: number): number {
  if (!t.shares || part <= 0) return 0;
  const o = s.player.finance.ownership;
  const k = t.shares.insiders > 0 ? (o.founder + o.mission) / t.shares.insiders : 1;
  let c = 0;
  for (const [h, x0] of Object.entries(t.shares.holders)) {
    const x = Math.max(0, Math.min(h === 'fin' ? o.fin : o.strat[h] ?? 0, x0 * k * Math.min(1, part)));
    if (h === 'fin') o.fin -= x;
    else o.strat[h] = (o.strat[h] ?? 0) - x;
    c += x;
  }
  if (c > 0 && c < 1) {
    const g = 1 / (1 - c);
    o.founder *= g;
    o.mission *= g;
    o.fin *= g;
    o.public *= g;
    for (const n of Object.keys(o.strat)) o.strat[n] *= g;
  }
  return c;
}

/** Book a priced round at `pre` (pre-money): cash now (half for large rounds, `roundSplit`), the rest as a conditional
 *  tranche carrying the shares of its money; dilution; down-round penalties (priced below the last post-money, or
 *  `down`: the distress down round, FIN4r L1). `full`: no tranche. Returns the cash received now. */
export function bookRound(s: GameStateV2, ctx: SystemCtx, amount: Money, pre: Money, opts: { ipo?: boolean; source?: string; full?: boolean; down?: boolean } = {}): Money {
  const f = s.player.finance;
  const post = pre + amount;
  const dil = amount / post;
  const last = lastPostMoney(s); // read before this round is recorded
  const down = !!opts.down || (last > 0 && pre < last);
  const before = { fin: f.ownership.fin, strat: { ...f.ownership.strat } };
  if (opts.ipo) issue(f.ownership, dil, { kind: 'public' });
  else issue(f.ownership, dil, { kind: 'fin' });
  // Headline ≠ cash: large rounds arrive 50% at close, the rest on conditions within a year [R15]. The tranche carries
  // the shares of its money (the new shares each holder got × the unpaid share), cancelled if it lapses (FIN4r, H3).
  const sp = roundSplit(s, amount, { full: !!opts.ipo || !!opts.full });
  const now = sp.now;
  if (sp.tranche) {
    const unpaid = sp.tranche.amount / amount;
    const holders: Record<string, number> = {};
    const fin = f.ownership.fin - before.fin * (1 - dil);
    if (fin > 1e-12) holders.fin = fin * unpaid;
    for (const [n, x] of Object.entries(f.ownership.strat)) {
      const got = x - (before.strat[n] ?? 0) * (1 - dil);
      if (got > 1e-12) holders[n] = got * unpaid;
    }
    f.tranches.push({ amount: sp.tranche.amount, dueDay: sp.tranche.dueDay, condition: sp.tranche.condition, deadline: sp.tranche.deadline, source: opts.source ?? 'Equity round tranche 2', shares: { holders, insiders: f.ownership.founder + f.ownership.mission } });
  }
  f.rounds.push({ day: s.time.day, amount, postMoney: post, dilution: dil, down, ...(opts.ipo ? { ipo: true } : {}) });
  const dv = post - f.valuation;
  f.valuation = post;
  resizeCreditLine(s, ctx, opts.ipo ? 'IPO' : 'equity round'); // FIN1: banks re-size the line around a raise
  ctx.cause('player.finance.valuation', dv, opts.ipo ? 'IPO' : 'equity round', `$${amount.toFixed(1)}B at $${pre.toFixed(0)}B pre`);
  bookCash(s, ctx, now, 'financing', opts.ipo ? 'IPO' : 'equity round', `${(dil * 100).toFixed(1)}% dilution`);
  yearStats(s).equity += now;
  if (down) {
    // FIN2 (spec §0.3, §2.5): no staff attrition; the board and prior holders carry the down round.
    boardMood(s, ctx, 'setbacks', MOOD_BASE.downRound, 'down round');
    // Anti-dilution: prior investors receive shares worth 20% of the value gap [R15 Design] (none without a lower price
    // than a prior round's post-money).
    // (FIN4r: the gap is measured against the previous round's post-money; it read this round's own post before.)
    const gap = Math.max(0, (last - pre) / Math.max(1, last));
    if (gap > 0) issue(f.ownership, Math.min(0.1, 0.2 * gap * outsideShare(f.ownership)), { kind: 'fin' });
    ctx.headline('down-round', `${s.player.name} raises at a lower valuation`);
  }
  return now;
}

/** Runway (quarters) below which a competent CEO accepts a repriced down round (bots' finance autopilot) [D, M4]. */
export const DOWN_ROUND_RUNWAY_Q = 4;

/** Days the player has to accept or pull a repriced round; it is pulled after that [D]. */
export const REPRICED_DECIDE_DAYS = 30;

/** A pending round reprices only if the quarterly mark falls more than this below its term-sheet pre-money [D, M4]. */
export const REPRICE_DROP = 0.25;

/** Close the pending round at a quarter boundary: P(close) = exp(−(ask/max − 1)) above the ceiling; valuation discount
 *  0.5·(ask/max − 1) [R15]. */
export function closePendingRound(s: GameStateV2, ctx: SystemCtx): void {
  const f = s.player.finance;
  const r = f.ws3.pendingRound;
  if (!r) return;
  delete f.ws3.pendingRound;
  const over = Math.max(0, r.ask / Math.max(0.01, r.max) - 1);
  if (over > 0 && !ctx.rng('finance').chance(Math.exp(-over))) {
    ctx.log('finance', `The $${r.ask.toFixed(0)}B round failed to close: the ask was ${(over * 100).toFixed(0)}% above what investors would take.`, 2);
    boardMood(s, ctx, 'setbacks', MOOD_BASE.failedRaise, 'failed raise');
    return;
  }
  // The term sheet (pre-money when the round opened) protects the price if the quarterly mark dips (M4), unless it
  // fell by more than REPRICE_DROP, when investors reprice to today's mark; a higher mark prices the round [D]. The
  // pitch's price multiplier applies to the mark (FIN2).
  const mark = f.valuation * (r.priceMult ?? 1);
  const base = mark < r.preMoney * (1 - REPRICE_DROP) ? mark : Math.max(mark, r.preMoney);
  const pre = base * (1 - Math.min(0.6, 0.5 * over));
  // FIN5a: repriced to a lower mark, investors buy the stake that was signed, not more (the same money at a lower price
  // sold up to 19% of the company once the story mark could fall by half in a quarter).
  if (base < r.preMoney) {
    const d0 = r.ask / (r.preMoney + r.ask);
    const cap = (d0 * base) / (1 - d0);
    if (cap < r.ask - 1e-9) {
      ctx.log('finance', `Repriced to today's lower mark, the round buys the ${(d0 * 100).toFixed(1)}% stake signed: $${cap.toFixed(1)}B of the $${r.ask.toFixed(1)}B asked.`, 2);
      r.ask = cap;
    }
  }
  // A repriced round that would now be a down round waits for the player: accept the down round or pull it
  // (LIMITS: the CEO used to pull it silently when runway was ≥ 4 quarters, and close it silently otherwise).
  if (base === mark && pre < lastPostMoney(s)) {
    const rr: RepricedRound = { day: s.time.day, deadline: s.time.day + REPRICED_DECIDE_DAYS, ask: r.ask, pre, lastPost: lastPostMoney(s), ipo: r.ipo };
    if (r.thesis) rr.thesis = r.thesis;
    if (r.dualClass) rr.dualClass = true;
    f.ws3.repricedRound = rr;
    ctx.log('alert', `Investors repriced the $${r.ask.toFixed(0)}B round to $${pre.toFixed(0)}B pre-money, below the last round's $${rr.lastPost.toFixed(0)}B. Accept the down round or pull it in Finance within ${REPRICED_DECIDE_DAYS} days.`, 3);
    return;
  }
  closeRound(s, ctx, { ...r, pre });
}

/** What a round raises at close: the ask, except an IPO, which sells at most 5% of the company at its closing
 *  pre-money (FIN3b). */
export const closingAsk = (r: { ask: Money; pre: Money; ipo: boolean }) => (r.ipo ? Math.min(r.ask, (dMax(true) * r.pre) / (1 - dMax(true))) : r.ask);

/** Book a priced round, its promise (FIN2) and the IPO's side effects (closePendingRound, acceptRepriced). */
function closeRound(s: GameStateV2, ctx: SystemCtx, r0: { ask: Money; pre: Money; ipo: boolean; thesis?: Thesis; dualClass?: boolean }): void {
  // FIN3b (spec §2.6, FC3): an IPO sells at most 5% of the company at its closing price. If the price fell after
  // signing (a repriced or discounted close), fewer dollars are raised rather than more of the company sold: amount ≤
  // d·pre/(1 − d). (A repriced IPO once closed at 8% dilution.)
  const ask = closingAsk(r0);
  const r = ask < r0.ask ? { ...r0, ask } : r0;
  if (r !== r0) ctx.log('finance', `The IPO sells at most ${Math.round(dMax(true) * 100)}% of the company: at $${r.pre.toFixed(0)}B pre-money it raises $${r.ask.toFixed(1)}B of the $${r0.ask.toFixed(1)}B asked.`, 2);
  const now = bookRound(s, ctx, r.ask, r.pre, { ipo: r.ipo });
  // FIN4r (H2): the promise stores a typical round at this close (the dilution limit at its pre-money), the floor of
  // its weight.
  if (r.thesis) addPromise(s, ctx, r.thesis, r.ask, typicalRound(r.pre, dMax(false)));
  if (r.ipo) {
    s.capital.ipoWindow = true;
    if (r.dualClass) s.player.finance.dualClass = true;
  }
  ctx.log('finance', `${r.ipo ? 'IPO' : 'Round'} closed: $${r.ask.toFixed(1)}B ($${now.toFixed(1)}B now) at $${r.pre.toFixed(0)}B pre-money${r.ipo && r.dualClass ? ', dual-class shares' : ''}.`);
}

/** Accept a repriced round as a down round (cash now, dilution, down-round penalties). */
export function acceptRepriced(s: GameStateV2, ctx: SystemCtx): string | undefined {
  const f = s.player.finance;
  const r = f.ws3.repricedRound;
  if (!r) return 'No repriced round';
  delete f.ws3.repricedRound;
  closeRound(s, ctx, r);
  return undefined;
}

/** Pull a repriced round: no cash, no dilution. `why` is logged (player choice or the decision window ran out). */
export function pullRepriced(s: GameStateV2, ctx: SystemCtx, why = 'you pulled it'): string | undefined {
  const f = s.player.finance;
  const r = f.ws3.repricedRound;
  if (!r) return 'No repriced round';
  delete f.ws3.repricedRound;
  ctx.log('finance', `The repriced $${r.ask.toFixed(0)}B round is off: ${why}.`, 2);
  return undefined;
}

/** Daily: a repriced round nobody decided on is pulled at its deadline (the player never agreed to a down round). */
export function expireRepriced(s: GameStateV2, ctx: SystemCtx): void {
  const r = s.player.finance.ws3.repricedRound;
  if (r && s.time.day >= r.deadline) pullRepriced(s, ctx, 'no decision within the window');
}
