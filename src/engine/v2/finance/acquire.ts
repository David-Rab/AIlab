// Buying a rival (FINANCE-V3 §9, FIN3c): the price, the payment (cash or your stock), the obligations you take on, and
// the votes. Owner: WS3. The decisions are WS4's events: E32 "Merger offer" (a rival in distress) and E22 "DPA
// consolidation" (the government folds the rivals in); the staff, talent and morale effects stay there.
//
// The real risk of buying a failing lab is what comes with it: its contracts (one firm ledger entry over their
// remaining term) and its debt (the cash it is short, as drawn debt at your rating). Parent-funded labs (big tech,
// open weights, the leader lab) have no valuation and no obligations of their own: their contracts stay with the
// parent (the bubble index reads rival commitments the same way, investors.ts bubbleX).
//
// Votes: a merger is a major decision (spec §7.3) the board judges on the company after the deal (can it carry the
// contracts and the debt?). Paying in stock that would hand the lab's holders, as one block, more than half the
// company is a sale of control as well: the mission body's vote under one (§7.2), then the board's (§7.3); if it goes
// through, they control the company (the 'acquired' ending). Buying for cash never sells control.
import { DEBT_TERMS } from '../../../data/v2/deals';
import type { BoardVote, Commitment$, CostLine, Debt, GameStateV2, Money, RivalLab, SystemCtx } from '../types';
import { boardVote, VOTE, voteGate, voteNo } from './board';
import { controlVotes } from './charter';
import { ownerFunded } from './control';
import { debtRatePct, newDebtSpreadBp } from './debt';
import { issue } from './equity';
import { addLedger, bookCash } from './ledger';

export const ACQUIRE = {
  discount: 0.5, // [D] spec §9: a distressed lab sells at about half its last valuation
  termQ: 8, // [D] its contracts (an annual book) run about two more years
} as const;

/** What comes with a bought lab: its contracts ($B a quarter over `termQ` quarters, `total` in all) and its debt. */
export interface Obligations { perQ: Money; termQ: number; total: Money; debt: Money }
const NONE: Obligations = { perQ: 0, termQ: ACQUIRE.termQ, total: 0, debt: 0 };

/** A rival's obligations if you buy it: its commitments (rivals' `finance.commitments`: its spend a year since FIN6a) for two more
 *  years, and the cash it is short as debt. A parent-funded lab (valuation 0) brings none. */
export function rivalObligations(r: RivalLab): Obligations {
  if (r.finance.valuation <= 0) return NONE;
  const perQ = Math.max(0, r.finance.commitments) / 4;
  return { perQ, termQ: ACQUIRE.termQ, total: perQ * ACQUIRE.termQ, debt: Math.max(0, -r.finance.cash) };
}

export function sumObligations(xs: Obligations[]): Obligations {
  const perQ = xs.reduce((a, x) => a + x.perQ, 0);
  return { perQ, termQ: ACQUIRE.termQ, total: perQ * ACQUIRE.termQ, debt: xs.reduce((a, x) => a + x.debt, 0) };
}

export type PayWith = 'cash' | 'stock';

/** An offer to buy a rival: the price (its valuation × 0.5), the stake its holders get if you pay in stock (at your
 *  valuation: price ÷ (your valuation + price)), and what comes with it. */
export interface AcquireTerms { lab: string; name: string; price: Money; stockFrac: number; holder: string; obligations: Obligations }

export function acquireTerms(s: GameStateV2, r: RivalLab): AcquireTerms {
  const price = Math.max(0, r.finance.valuation * ACQUIRE.discount);
  const V = Math.max(1, s.player.finance.valuation);
  return { lab: r.core.id, name: r.core.name, price, stockFrac: price / (V + price), holder: `${r.core.name}'s holders`, obligations: rivalObligations(r) };
}

/** Paying in stock sells control when the lab's holders, as one block, would own more than half the company. */
export const sellsControl = (t: AcquireTerms, pay: PayWith) => pay === 'stock' && t.stockFrac > 0.5;

const $ = (x: Money) => (x >= 1000 ? `$${(x / 1000).toFixed(1)}T` : `$${x >= 10 ? x.toFixed(0) : x.toFixed(1)}B`);

function contractsEntry(s: GameStateV2, name: string, o: Obligations): Omit<Commitment$, 'id'> {
  return { payee: `${name} contracts`, kind: 'acquired', perQuarter: o.perQ, endDay: s.time.day + Math.round(o.termQ * 91.25), cancellableNoticeQ: null, penalty: 0 };
}
function assumedDebt(s: GameStateV2, amount: Money, id: string): Debt {
  return { id, kind: 'assumed', principal: amount, drawn: amount, spreadBp: newDebtSpreadBp(s, 'assumed'), maturityDay: s.time.day + DEBT_TERMS.assumed.years * 365 };
}

/** The company right after the deal (pure, for the votes): cash paid, its holders' stake issued, its contracts and debt
 *  on your books. */
export function afterDeal(s: GameStateV2, name: string, o: Obligations, cashOut: Money, stockFrac: number): GameStateV2 {
  const f = s.player.finance;
  const ownership = { ...f.ownership, strat: { ...f.ownership.strat } };
  if (stockFrac > 0) issue(ownership, stockFrac, { kind: 'fin' });
  const ledger = o.perQ > 0 ? [...f.ledger, { id: 'L-acq-preview', ...contractsEntry(s, name, o) }] : f.ledger;
  const debts = o.debt > 0 ? [...f.debts, assumedDebt(s, o.debt, 'D-acq-preview')] : f.debts;
  return { ...s, player: { ...s.player, finance: { ...f, cash: f.cash - cashOut, ownership, ledger, debts } } };
}

/** The board's merger vote, judged on the company after the deal: the situation term is whether it can carry the
 *  contracts and the debt (runway after the deal). `what` names the deal. */
export function mergerVote(s: GameStateV2, what: string, name: string, o: Obligations, cashOut: Money, stockFrac: number): BoardVote {
  const takes = [o.total > 0 ? `${$(o.total)} of contracts` : '', o.debt > 0 ? `${$(o.debt)} of debt` : ''].filter(Boolean).join(' and ');
  const v = boardVote(afterDeal(s, name, o, cashOut, stockFrac), 'merger', `${what}${takes ? `, taking on ${takes}` : ''}`);
  return { ...v, needLabel: `after the deal, ${v.needLabel}` };
}

/** Every vote buying this lab needs, in the order they are held: a sale of control first (stock past 50%: the trust,
 *  then the board), then the merger. */
export function acquireVotes(s: GameStateV2, t: AcquireTerms, pay: PayWith): BoardVote[] {
  const frac = pay === 'stock' ? t.stockFrac : 0;
  const what = pay === 'cash' ? `buying ${t.name} for ${$(t.price)} in cash` : `buying ${t.name} for ${(frac * 100).toFixed(1)}% of your stock`;
  return [...(pay === 'stock' ? controlVotes(s, t.holder, frac) : []), mergerVote(s, what, t.name, t.obligations, pay === 'cash' ? t.price : 0, frac)];
}

/** The vote to show under a choice: the first that fails, else the merger vote (always last). */
export const shownVote = (vs: BoardVote[]): BoardVote | undefined => vs.find((v) => !v.passes) ?? vs[vs.length - 1];

/** Why this payment is impossible now, or undefined. A failed vote blocks only when the override cannot force it
 *  (an event choice forces at the shown cost: see `forceLines`). */
export function voteBlock(vs: BoardVote[]): string | undefined {
  const v = vs.find((x) => !x.passes && !x.canForce);
  return v ? voteNo(v) : undefined;
}
export function acquireBlock(s: GameStateV2, t: AcquireTerms, pay: PayWith): string | undefined {
  const f = s.player.finance;
  if (f.state === 'insolvent') return 'Insolvent';
  if (pay === 'cash' && f.cash < t.price) return `Needs ${$(t.price)} in cash (you have ${$(Math.max(0, f.cash))})`;
  if (pay === 'stock' && ownerFunded(s)) return 'A division has no stock of its own';
  return voteBlock(acquireVotes(s, t, pay));
}

/** The board-confidence cost of forcing the failed votes (the override), as preview cost lines. */
export function forceLines(vs: BoardVote[]): CostLine[] {
  return vs.filter((v) => !v.passes && v.canForce).map((v) => ({ currency: 'boardConf' as const, amount: VOTE.forceCost, target: `${v.label.toLowerCase()} forced past the board (your majority)` }));
}

/** Preview lines of the payment: the cash price or the stake its holders get, and a sale of control if it is one. */
export function paymentLines(s: GameStateV2, t: AcquireTerms, pay: PayWith): CostLine[] {
  const V = s.player.finance.valuation;
  const out: CostLine[] = pay === 'cash'
    ? [{ currency: 'cash', amount: Math.round(t.price * 10) / 10, target: `half its ${$(t.price / ACQUIRE.discount)} valuation` }]
    : [{ currency: 'dilution', amount: Math.round(t.stockFrac * 1000) / 10, target: `new shares worth ${$(t.price)} to ${t.holder}, at your ${$(V)} valuation` }];
  if (sellsControl(t, pay)) out.push({ currency: 'freedom', amount: Math.round(t.stockFrac * 100), target: `${t.holder} would own ${Math.round(t.stockFrac * 100)}%: a sale of control ends the game (acquired)` });
  return out;
}

/** Preview lines of what comes with the lab (exposure: paid over time, not today; negative = owed, as the pills sign
 *  exposure lines). */
export function obligationLines(s: GameStateV2, o: Obligations): CostLine[] {
  const out: CostLine[] = [];
  if (o.total > 0) out.push({ currency: 'cash', amount: -Math.round(o.total * 10) / 10, target: `its contracts: ${$(o.perQ)} a quarter for ${o.termQ} quarters, firm` });
  if (o.debt > 0) out.push({ currency: 'cash', amount: -Math.round(o.debt * 10) / 10, target: `its debt, now yours at ${debtRatePct(s, assumedDebt(s, o.debt, '')).toFixed(1)}% for ${DEBT_TERMS.assumed.years} years` });
  return out;
}

/** Put a bought lab's contracts and debt on your books: one firm ledger entry over their remaining term, and the debt
 *  as drawn debt at your rating (no cash moves: its unpaid bills become your loan). */
export function takeOnObligations(s: GameStateV2, ctx: SystemCtx, name: string, o: Obligations): void {
  const f = s.player.finance;
  if (o.perQ > 0) addLedger(s, contractsEntry(s, name, o));
  if (o.debt > 0) f.debts.push(assumedDebt(s, o.debt, `D-acq-${s.time.day}-${f.debts.length}`));
  if (o.perQ > 0 || o.debt > 0) ctx.log('finance', `Took on ${name}'s obligations: ${o.perQ > 0 ? `contracts at ${$(o.perQ)} a quarter for ${o.termQ} quarters` : 'no contracts'}${o.debt > 0 ? ` and ${$(o.debt)} of debt` : ''}.`, 2);
}

/** Buy a rival: hold the votes (forcing a failed board vote under the override, at the cost the preview showed),
 *  pay, take on its obligations. Returns why it did not go through. The event moves the staff and deactivates the lab. */
export function payForRival(s: GameStateV2, ctx: SystemCtx, t: AcquireTerms, pay: PayWith): string | undefined {
  const no = acquireBlock(s, t, pay);
  if (no) return no;
  for (const v of acquireVotes(s, t, pay)) {
    const g = voteGate(ctx, v, true);
    if (g) return g;
  }
  const f = s.player.finance;
  if (pay === 'cash') bookCash(s, ctx, -t.price, 'financing', 'acquisition', t.name);
  else {
    issue(f.ownership, t.stockFrac, { kind: 'fin' });
    f.valuation += t.price;
    ctx.cause('player.finance.valuation', t.price, 'acquisition paid in stock', t.name);
  }
  takeOnObligations(s, ctx, t.name, t.obligations);
  ctx.log('finance', `Bought ${t.name} for ${pay === 'cash' ? `${$(t.price)} in cash` : `${(t.stockFrac * 100).toFixed(1)}% of the company in new shares`}.`, 3);
  return undefined;
}
