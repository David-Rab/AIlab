// Valuation, raises, dilution and the raise ceiling (V2-SPEC §3.7.3; research/15 §1.5). Owner: WS3.
import { dayOfQuarter, quarterIndex } from '../core/time';
import type { GameStateV2, Money, Ownership, RepricedRound, SystemCtx } from '../types';
import { ensureWs3, yearStats, type PendingRound } from './ext';
import { bookCash } from './ledger';

/** V = 22·(g/5)^0.4·(R/$20B)^−0.15·H·N·M·R (R15 §1.5). */
export function valuationMark(g: number, R: number, H: number, N: number, M: number): number {
  return 22 * Math.pow(Math.max(0.5, Math.min(8, g)) / 5, 0.4) * Math.pow(Math.max(0.1, R) / 20, -0.15) * H * N * M * Math.max(0.1, R);
}

/** k_Y(R) = 5·(R/$10B)^−0.4 (annual equity cap as a revenue multiple). */
export const kY = (R: number) => 5 * Math.pow(Math.max(0.1, R) / 10, -0.4);

/** Rate factor M = exp(−0.12·(y10 − 4.5)) [R15]. */
export const rateFactor = (y10: number) => Math.exp(-0.12 * (y10 - 4.5));

/** Revenue growth g = clamp(R / R(t−4), 0.5, 8) from the quarterly run-rate history (last entry = last quarter). */
export function revenueGrowth(s: GameStateV2): number {
  const f = s.player.finance;
  const h = f.revenueHistory;
  const back = h.length >= 4 ? h[h.length - 4] : h[0] ?? f.revenueRun;
  return Math.max(0.5, Math.min(8, f.revenueRun / Math.max(0.1, back)));
}

/** Formula mark of the player's valuation now, with its terms (finance panel "why", §2.6). */
export function valuationNow(s: GameStateV2): { V: Money; g: number; R: Money; H: number; N: number; M: number } {
  const f = s.player.finance;
  const g = revenueGrowth(s);
  const M = rateFactor(s.capital.y10);
  return { V: valuationMark(g, f.revenueRun, s.capital.hype, f.narrative, M), g, R: f.revenueRun, H: s.capital.hype, N: f.narrative, M };
}

export interface RaiseCeiling { max: Money; bound: 'pool' | 'dilution' | 'annualCap' | 'ask'; parts: Record<string, Money> }

/** Maximum dilution per round: 0.08 financial; 0.14 with a strategic anchor taking ≥ 40%; 0.05 IPO (R15 §1.5). */
export const dMax = (anchor: boolean, ipo: boolean) => (ipo ? 0.05 : anchor ? 0.14 : 0.08);

/**
 * EngineApi.raiseCeiling: min(pool share, d_max·V_post, k_Y(R)·R − raised_4q, ask) (§3.7.3). The UI shows `bound`.
 * Tight runway cuts the pool share ×0.8; distress or a closed market leaves only rescue capital (max 0).
 */
export function raiseCeiling(s: GameStateV2, ask = Number.POSITIVE_INFINITY, opts: { anchor?: boolean; ipo?: boolean } = {}): RaiseCeiling {
  const f = s.player.finance;
  const cw = s.capital.ws3;
  const V = Math.max(1, f.valuation);
  const d = dMax(!!opts.anchor, !!opts.ipo);
  const tight = f.state === 'tight' ? 0.8 : 1;
  const closed = f.state === 'distress' || f.state === 'insolvent';
  const poolQ = cw ? cw.playerPoolQ - cw.playerTakenQ : 0.3 * (s.capital.poolAnnual / 4 + s.capital.carry);
  const ipoBonus = opts.ipo ? 0.5 * s.capital.poolAnnual * 0.25 : 0; // the first IPOs unlock a one-time public pool [R15]
  const parts: Record<string, Money> = {
    pool: closed ? 0 : Math.max(0, poolQ * tight + ipoBonus),
    dilution: (d * V) / (1 - d),
    annualCap: Math.max(0, kY(f.revenueRun) * f.revenueRun - f.raisedLast4q),
    ask: Math.max(0, ask),
  };
  let bound: RaiseCeiling['bound'] = 'pool';
  for (const k of ['dilution', 'annualCap', 'ask'] as const) if (parts[k] < parts[bound]) bound = k;
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

/** Start a raise; it closes at the next quarter (capitalQ). */
export function startRaise(s: GameStateV2, ctx: SystemCtx, ask: Money, opts: { anchor?: string; ipo?: boolean } = {}): PendingRound {
  const c = raiseCeiling(s, Number.POSITIVE_INFINITY, { anchor: !!opts.anchor, ipo: !!opts.ipo });
  const r: PendingRound = { day: s.time.day, ask, max: c.max, preMoney: s.player.finance.valuation, ipo: !!opts.ipo };
  if (opts.anchor) r.anchor = opts.anchor;
  s.player.finance.ws3.pendingRound = r;
  s.capital.ws3.playerTakenQ += Math.min(ask, c.max);
  ctx.log('finance', `Raising $${ask.toFixed(1)}B${opts.ipo ? ' (IPO)' : ''}${opts.anchor ? ` anchored by ${opts.anchor}` : ''}; closes next quarter.`);
  return r;
}

/** Book a priced round at `pre` (pre-money): cash now (40–60% for large rounds), the rest as a conditional tranche;
 *  dilution; down-round penalties. Returns the cash received now. */
export function bookRound(s: GameStateV2, ctx: SystemCtx, amount: Money, pre: Money, opts: { anchor?: string; ipo?: boolean; source?: string } = {}): Money {
  const f = s.player.finance;
  const post = pre + amount;
  const dil = amount / post;
  const down = lastPostMoney(s) > 0 && pre < lastPostMoney(s);
  if (opts.ipo) issue(f.ownership, dil, { kind: 'public' });
  else if (opts.anchor) {
    issue(f.ownership, dil * 0.5, { kind: 'strat', name: opts.anchor });
    issue(f.ownership, dil * 0.5 / (1 - dil * 0.5), { kind: 'fin' });
  } else issue(f.ownership, dil, { kind: 'fin' });
  // Headline ≠ cash: large rounds arrive 50% at close, the rest on conditions within a year [R15].
  const large = amount >= 20;
  const now = large ? amount * 0.5 : amount;
  if (large) {
    const q = quarterIndex(s.time.startDate, s.time.day);
    const cond = s.player.board.preset === 'legacyNonprofit' && !f.ws3.recap.doneDay ? 'recapitalisation' : `revenue:${(f.revenueRun * 1.2).toFixed(1)}`;
    f.tranches.push({ amount: amount - now, dueDay: dayOfQuarter(s.time.startDate, q + 2), condition: cond, deadline: dayOfQuarter(s.time.startDate, q + 4), source: opts.source ?? 'Equity round tranche 2' });
  }
  f.rounds.push({ day: s.time.day, amount, postMoney: post, dilution: dil, down, ...(opts.anchor ? { anchor: opts.anchor } : {}) });
  const dv = post - f.valuation;
  f.valuation = post;
  ctx.cause('player.finance.valuation', dv, opts.ipo ? 'IPO' : 'equity round', `$${amount.toFixed(1)}B at $${pre.toFixed(0)}B pre`);
  bookCash(s, ctx, now, 'financing', opts.ipo ? 'IPO' : 'equity round', `${(dil * 100).toFixed(1)}% dilution`);
  f.raisedLast4q += amount;
  yearStats(s).equity += now;
  if (down) {
    ctx.bump('board.confidence', -15, 'down round');
    ctx.bump('player.staff.cap', -0.05 * s.player.staff.cap, 'down round', 'senior attrition');
    // Anti-dilution: prior investors receive shares worth 20% of the value gap [R15 Design].
    const gap = (lastPostMoney(s) - pre) / Math.max(1, lastPostMoney(s));
    issue(f.ownership, Math.min(0.1, 0.2 * gap * outsideShare(f.ownership)), { kind: 'fin' });
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
    ctx.bump('board.confidence', -5, 'failed raise');
    return;
  }
  // The term sheet (pre-money when the round opened) protects the price if the quarterly mark dips (M4), unless it
  // fell by more than REPRICE_DROP, when investors reprice to today's mark; a higher mark prices the round [D].
  const mark = f.valuation;
  const base = mark < r.preMoney * (1 - REPRICE_DROP) ? mark : Math.max(mark, r.preMoney);
  const pre = base * (1 - Math.min(0.6, 0.5 * over));
  // A repriced round that would now be a down round waits for the player: accept the down round or pull it
  // (LIMITS: the CEO used to pull it silently when runway was ≥ 4 quarters, and close it silently otherwise).
  if (base === mark && pre < lastPostMoney(s)) {
    const rr: RepricedRound = { day: s.time.day, deadline: s.time.day + REPRICED_DECIDE_DAYS, ask: r.ask, pre, lastPost: lastPostMoney(s), ipo: r.ipo };
    if (r.anchor) rr.anchor = r.anchor;
    f.ws3.repricedRound = rr;
    ctx.log('alert', `Investors repriced the $${r.ask.toFixed(0)}B round to $${pre.toFixed(0)}B pre-money, below the last round's $${rr.lastPost.toFixed(0)}B. Accept the down round or pull it in Finance within ${REPRICED_DECIDE_DAYS} days.`, 3);
    return;
  }
  closeRound(s, ctx, r.ask, pre, r.anchor, r.ipo);
}

/** Book a priced round and its IPO side effects (closePendingRound, acceptRepriced). */
function closeRound(s: GameStateV2, ctx: SystemCtx, ask: Money, pre: Money, anchor: string | undefined, ipo: boolean): void {
  const now = bookRound(s, ctx, ask, pre, { ...(anchor ? { anchor } : {}), ipo });
  if (ipo) {
    s.capital.ipoWindow = true;
    if (!s.player.board.seats.some((x) => x.kind === 'independent' && x.holder === 'Listing independent')) {
      s.player.board.seats.push({ kind: 'independent', holder: 'Listing independent', stance: [0, 0.5, 0.3, 0.3], weight: 1 });
    }
  }
  ctx.log('finance', `Round closed: $${ask.toFixed(1)}B ($${now.toFixed(1)}B now) at $${pre.toFixed(0)}B pre-money.`);
}

/** Accept a repriced round as a down round (cash now, dilution, down-round penalties). */
export function acceptRepriced(s: GameStateV2, ctx: SystemCtx): string | undefined {
  const f = s.player.finance;
  const r = f.ws3.repricedRound;
  if (!r) return 'No repriced round';
  delete f.ws3.repricedRound;
  closeRound(s, ctx, r.ask, r.pre, r.anchor, r.ipo);
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
