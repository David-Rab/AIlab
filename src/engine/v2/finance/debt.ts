// Debt instruments, covenants and the credit rating (FINANCE-V3 §3; research/15 §1.7). Owner: WS3.
//
// Each lender prices its own risk from cash flows and collateral: the credit line is sized by valuation (banks lend to
// large private labs against their equity cushion: OpenAI $4B at $157B, Anthropic $15B), the chip loan by its
// collateral, bonds by trailing operating cash flow. The rating comes from cash flow, liquidity cover, leverage (debt
// and firm commitments against revenue) and distress, never from the valuation.
import { CHIP_LOAN_SPREAD_BP, DEBT_SIZING, DEBT_TERMS, RATING_SPREAD_BP, REVOLVER_SPREAD_BP } from '../../../data/v2/deals';
import { isDivision } from '../../../data/v2/starts';
import type { Debt, FinanceState, GameStateV2, Money, SystemCtx } from '../types';
import { yearStats } from './ext';
import { commitmentsRemaining, bookCash, ledgerDue, qOf } from './ledger';
import { revenueRun } from './observe';

/** Effective annual rate (%) of a debt: SOFR + spread (credit line, chip loans, vendor notes) or y10 + spread (bonds, debt assumed with a bought lab);
 *  plus sector spread widening and +300bp in distress [R15]. The credit line floats on today's rating; chip loans and
 *  bonds keep the spread they were priced at. */
export function debtRatePct(s: GameStateV2, d: Debt): number {
  const base = d.kind === 'bond' || d.kind === 'assumed' ? s.capital.y10 : s.capital.sofr;
  const sector = s.capital.ws3?.spreadAddBp ?? 0;
  const distress = s.player.finance.state === 'distress' ? 300 : 0;
  const spread = d.kind === 'revolver' ? REVOLVER_SPREAD_BP[s.player.finance.rating] : d.spreadBp;
  return base + (spread + sector + distress) / 100;
}

/** Spread (bp) a new draw of `kind` is priced at today. */
export function newDebtSpreadBp(s: GameStateV2, kind: Debt['kind']): number {
  const r = s.player.finance.rating;
  return kind === 'revolver' ? REVOLVER_SPREAD_BP[r] : kind === 'gpuTerm' ? CHIP_LOAN_SPREAD_BP[r] : kind === 'bond' || kind === 'assumed' ? RATING_SPREAD_BP[r] : DEBT_TERMS[kind].spreadBp;
}
/** Rate (%) a new draw of `kind` would pay today. */
export function newDebtRatePct(s: GameStateV2, kind: Debt['kind']): number {
  return debtRatePct(s, { id: '', kind, principal: 0, drawn: 0, spreadBp: newDebtSpreadBp(s, kind), maturityDay: 0 });
}

/** Interest $B/yr on drawn debt (used by opex). */
export function interestPerYear(s: GameStateV2): number {
  let r = 0;
  for (const d of s.player.finance.debts) r += (d.drawn * debtRatePct(s, d)) / 100;
  return r;
}

export const totalDebt = (f: FinanceState) => f.debts.reduce((a, d) => a + d.drawn, 0);
const drawnOf = (f: FinanceState, kind: Debt['kind']) => f.debts.filter((d) => d.kind === kind).reduce((a, d) => a + d.drawn, 0);

/** Credit line a bank will size today: 3% of valuation, cap $15B (spec §3 [fit]). FIN5 replaces the valuation it reads
 *  (today: the formula mark). A division has none: the parent's treasury borrows. */
export function creditLineCapacity(s: GameStateV2, valuation = s.player.finance.valuation): Money {
  if (isDivision(s)) return 0;
  return Math.min(DEBT_SIZING.lineCap, DEBT_SIZING.lineShareOfV * Math.max(0, valuation));
}

/** Chip collateral value ($B): installed + inventory at today's list price, 70% for used hardware [D]. */
export function chipCollateral(s: GameStateV2): Money {
  const installed = s.player.sites.reduce((a, x) => a + (x.stage === 'live' ? x.installed : 0), 0);
  const inv = s.player.finance.ws3.inventory;
  return ((installed + inv.ready + inv.transit) * s.market.listPrice * DEBT_SIZING.chipHaircut) / 1e6;
}

/** Trailing-year operating cash flow ($B): the last four quarters (annualised while fewer have closed); undefined
 *  before the first quarter closes. */
export function trailingOpCash(s: GameStateV2): Money | undefined {
  const h = s.player.finance.ws3.opCash4q ?? [];
  if (!h.length) return undefined;
  return (h.reduce((a, b) => a + b, 0) * 4) / h.length;
}

export interface Headroom {
  /** How much more could be drawn now ($B). */
  max: Money;
  /** The lender's limit before what is already drawn ($B). */
  limit: Money;
  /** The rule that sizes it (always shown), or why it is closed. */
  why: string;
  closed?: boolean;
}

/** How much more of `kind` the player could draw now, the limit and the rule behind it (spec §3). */
export function debtHeadroom(s: GameStateV2, kind: Debt['kind']): Headroom {
  const f = s.player.finance;
  const shut = (why: string, limit = 0): Headroom => ({ max: 0, limit, why, closed: true });
  if (f.state === 'insolvent') return shut('Insolvent');
  if (kind === 'revolver') {
    const cap = creditLineCapacity(s);
    if (cap <= 0) return shut('No credit line (the parent borrows)');
    if (f.state === 'distress') return shut('Credit line frozen in distress', cap);
    if (f.rating === 'closed') return shut('Credit markets closed (rating)', cap);
    return { max: Math.max(0, cap - drawnOf(f, 'revolver')), limit: cap, why: `${Math.round(DEBT_SIZING.lineShareOfV * 100)}% of valuation, cap $${DEBT_SIZING.lineCap}B` };
  }
  if (kind === 'gpuTerm') {
    const lim = DEBT_SIZING.chipLTV * chipCollateral(s);
    return { max: Math.max(0, lim - drawnOf(f, 'gpuTerm')), limit: lim, why: `${Math.round(DEBT_SIZING.chipLTV * 100)}% of chip value` };
  }
  if (kind === 'bond') {
    if (f.rating === 'closed') return shut('Credit markets closed (rating)');
    const ocf = trailingOpCash(s);
    if (ocf === undefined || ocf <= 0) return shut('Needs positive operating cash flow (trailing year)');
    const lim = DEBT_SIZING.bondOcfMult * ocf;
    return { max: Math.max(0, lim - drawnOf(f, 'bond')), limit: lim, why: `${DEBT_SIZING.bondOcfMult}× trailing operating cash flow` };
  }
  if (kind === 'assumed') return shut('Comes only with a lab you buy');
  return shut('Vendor notes come with vendor deals');
}

/** Undrawn part of the credit line as arranged (it counts in liquidity and covers negative cash automatically); 0 when
 *  frozen in distress. */
export function lineUndrawn(s: GameStateV2): Money {
  const f = s.player.finance;
  const rv = f.debts.find((d) => d.kind === 'revolver');
  if (!rv || f.state === 'distress' || f.state === 'insolvent') return 0;
  return Math.max(0, rv.principal - rv.drawn);
}

/** Re-size the credit line to what the bank will lend today (3% of valuation, cap $15B; never below what is drawn).
 *  It happens only at a finance decision: when you borrow on it or close an equity round (banks re-size facilities
 *  around a raise: OpenAI's $4B line came with its Oct 2024 round), never by itself (spec §3). No-op while the line is
 *  frozen or the rating closed. Returns the line. */
export function resizeCreditLine(s: GameStateV2, ctx: SystemCtx, why: string): Debt | undefined {
  const f = s.player.finance;
  const head = debtHeadroom(s, 'revolver');
  let rv = f.debts.find((d) => d.kind === 'revolver');
  if (head.closed) return rv;
  if (!rv) {
    rv = { id: 'D-revolver', kind: 'revolver', principal: 0, drawn: 0, spreadBp: DEBT_TERMS.revolver.spreadBp, maturityDay: s.time.day + DEBT_TERMS.revolver.years * 365, covenant: 'liquidity' };
    f.debts.unshift(rv);
  }
  const next = Math.max(rv.drawn, head.limit);
  if (Math.abs(rv.principal - next) > 0.05) ctx.log('finance', `Credit line re-sized $${rv.principal.toFixed(1)}B → $${next.toFixed(1)}B at the ${why} (${head.why}).`);
  rv.principal = next;
  return rv;
}

/** Draw on (or issue) a facility. Borrowing on the credit line first re-sizes it (resizeCreditLine); `arrangedOnly`
 *  draws within the line as arranged (automatic cash cover). Chip loans and bonds create a new tranche priced at
 *  today's rating. Returns the amount drawn. */
export function drawDebt(s: GameStateV2, ctx: SystemCtx, kind: Debt['kind'], amount: number, opts: { arrangedOnly?: boolean } = {}): number {
  const f = s.player.finance;
  let amt = 0;
  if (kind === 'revolver') {
    let rv = f.debts.find((d) => d.kind === 'revolver');
    if (opts.arrangedOnly) amt = Math.min(amount, lineUndrawn(s));
    else {
      if (debtHeadroom(s, 'revolver').closed) return 0;
      rv = resizeCreditLine(s, ctx, 'borrowing');
      amt = rv ? Math.min(amount, Math.max(0, rv.principal - rv.drawn)) : 0;
    }
    if (amt <= 0 || !rv) return 0;
    rv.drawn += amt;
  } else {
    amt = Math.max(0, Math.min(amount, debtHeadroom(s, kind).max));
    if (amt <= 0) return 0;
    const t = DEBT_TERMS[kind];
    const d: Debt = { id: `D${s.time.day}-${f.debts.length}`, kind, principal: amt, drawn: amt, spreadBp: newDebtSpreadBp(s, kind), maturityDay: s.time.day + t.years * 365, covenant: kind === 'gpuTerm' ? 'collateral' : 'incurrence' };
    if (kind === 'gpuTerm') d.collateralH100e = (amt / Math.max(0.001, s.market.listPrice * DEBT_SIZING.chipHaircut)) * 1e6;
    f.debts.push(d);
  }
  bookCash(s, ctx, amt, 'financing', `${kind} draw`);
  yearStats(s).debtDrawn += amt;
  if (s.player.board.preset === 'pbcTrust' && kind !== 'revolver') ctx.log('finance', 'Trust notified of new debt (5-day notice).');
  return amt;
}

/** Repay drawn debt (highest spread first unless an id is given). Returns the amount repaid. */
export function repayDebt(s: GameStateV2, ctx: SystemCtx, amount: number, id?: string): number {
  const f = s.player.finance;
  let left = Math.max(0, Math.min(amount, f.cash));
  const order = id ? f.debts.filter((d) => d.id === id) : [...f.debts].sort((a, b) => b.spreadBp - a.spreadBp);
  let paid = 0;
  for (const d of order) {
    const x = Math.min(left, d.drawn);
    d.drawn -= x;
    left -= x;
    paid += x;
  }
  f.debts = f.debts.filter((d) => d.kind === 'revolver' || d.drawn > 1e-6);
  if (paid > 0) bookCash(s, ctx, -paid, 'financing', 'debt repayment');
  return paid;
}

export interface RatingTerms {
  z: number;
  /** 2 if trailing operating cash flow is positive, else 0. */
  cashFlow: number;
  /** min(2, liquidity ÷ this quarter's fixed obligations). */
  cover: number;
  /** (debt + 0.3 · PV of firm commitments) ÷ revenue. */
  leverage: number;
  /** 2 in distress, else 0. */
  distress: number;
  ocf?: Money; liquidity: Money; fixedQ: Money; debt: Money; pvCommit: Money; revenue: Money;
}

/** PV of firm commitments ≈ 0.85 × the remaining firm payments [D]. */
export const PV_COMMIT = 0.85;

/**
 * Rating score (spec §3): z = 2·[trailing operating cash flow > 0] + min(2, liquidity ÷ quarterly fixed obligations)
 * − (debt + 0.3·PV(firm commitments)) ÷ revenue − 2·[distress]. Liquidity = cash + undrawn credit line; fixed
 * obligations = firm ledger payments due this quarter + a quarter's interest. No assumed backlog.
 */
export function ratingTerms(s: GameStateV2): RatingTerms {
  const f = s.player.finance;
  const R = Math.max(0.1, revenueRun(s));
  const debt = totalDebt(f);
  const ocf = trailingOpCash(s);
  const liquidity = Math.max(0, f.cash) + lineUndrawn(s);
  const fixedQ = ledgerDue(s, qOf(s), true) + interestPerYear(s) / 4;
  const cover = fixedQ > 1e-6 ? Math.min(2, liquidity / fixedQ) : 2;
  const pvCommit = PV_COMMIT * commitmentsRemaining(s, true);
  const leverage = (debt + 0.3 * pvCommit) / R;
  const cashFlow = ocf !== undefined && ocf > 0 ? 2 : 0;
  const distress = f.state === 'distress' ? 2 : 0;
  return { z: cashFlow + cover - leverage - distress, cashFlow, cover, leverage, distress, ...(ocf !== undefined ? { ocf } : {}), liquidity, fixedQ, debt, pvCommit, revenue: R };
}
export const ratingScore = (s: GameStateV2) => ratingTerms(s).z;
export const ratingOf = (z: number): FinanceState['rating'] => (z >= 2 ? 'BBB' : z >= 1 ? 'BB' : z >= 0 ? 'B' : 'closed');

/** Quarter-end covenant tests (spec §3): a drawn credit line needs cash ≥ ⅓ of the line; chip loans: collateral < 1.2×
 *  loan → cash sweep (breach if cash cannot cover). Returns true if any covenant is breached. */
export function covenantsBreached(s: GameStateV2, ctx: SystemCtx): boolean {
  const f = s.player.finance;
  let breach = false;
  const rv = f.debts.find((d) => d.kind === 'revolver');
  if (rv && rv.drawn > 0 && f.cash < DEBT_SIZING.lineLiquidity * rv.principal) breach = true;
  const gpu = f.debts.filter((d) => d.kind === 'gpuTerm' && d.drawn > 0);
  if (gpu.length) {
    const drawn = gpu.reduce((a, d) => a + d.drawn, 0);
    const value = chipCollateral(s);
    if (value < DEBT_SIZING.chipSweep * drawn) {
      const sweep = drawn - value / DEBT_SIZING.chipSweep;
      if (f.cash > sweep + 1) {
        let left = sweep;
        for (const d of gpu) {
          const x = Math.min(left, d.drawn);
          d.drawn -= x;
          left -= x;
        }
        bookCash(s, ctx, -sweep, 'financing', 'chip-loan cash sweep', 'collateral below 1.2× loan');
      } else breach = true;
    }
  }
  return breach;
}

/** Maturities: refinance at today's terms if the market is open, else repay from cash (breach if short). */
export function rollMaturities(s: GameStateV2, ctx: SystemCtx): boolean {
  const f = s.player.finance;
  let breach = false;
  for (const d of f.debts) {
    if (d.maturityDay > s.time.day) continue;
    if (f.rating !== 'closed' && f.state !== 'distress') {
      d.maturityDay = s.time.day + DEBT_TERMS[d.kind].years * 365;
      if (d.kind === 'gpuTerm' || d.kind === 'bond' || d.kind === 'assumed') d.spreadBp = newDebtSpreadBp(s, d.kind);
      continue;
    }
    if (f.cash >= d.drawn) {
      bookCash(s, ctx, -d.drawn, 'financing', 'debt maturity');
      d.drawn = 0;
    } else breach = true;
  }
  return breach;
}
