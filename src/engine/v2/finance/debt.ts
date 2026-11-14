// Debt instruments, covenants and the credit rating (V2-SPEC §3.7.4; research/15 §1.7). Owner: WS3.
import { DEBT_TERMS, RATING_SPREAD_BP } from '../../../data/v2/deals';
import type { Debt, FinanceState, GameStateV2, Money, SystemCtx } from '../types';
import { yearStats } from './ext';
import { commitmentsRemaining, bookCash } from './ledger';

/** Effective annual rate (%) of a debt: SOFR + spread (revolver, GPU loans, vendor notes) or y10 + spread (bonds);
 *  plus sector spread widening and +300bp in distress [R15]. */
export function debtRatePct(s: GameStateV2, d: Debt): number {
  const base = d.kind === 'bond' ? s.capital.y10 : s.capital.sofr;
  const sector = s.capital.ws3?.spreadAddBp ?? 0;
  const distress = s.player.finance.state === 'distress' ? 300 : 0;
  return base + (d.spreadBp + sector + distress) / 100;
}

/** Interest $B/yr on drawn debt (used by opex). */
export function interestPerYear(s: GameStateV2): number {
  let r = 0;
  for (const d of s.player.finance.debts) r += (d.drawn * debtRatePct(s, d)) / 100;
  return r;
}

export const totalDebt = (f: FinanceState) => f.debts.reduce((a, d) => a + d.drawn, 0);

/** Revolver size: ≤ min(0.33·R, $15B) [R15]. */
export const revolverCap = (R: Money) => Math.min(0.33 * R, 15);

/** Chip collateral value ($B): installed + inventory at today's list price, 70% for used hardware [D]. */
export function chipCollateral(s: GameStateV2): Money {
  const installed = s.player.sites.reduce((a, x) => a + (x.stage === 'live' ? x.installed : 0), 0);
  const inv = s.player.finance.ws3.inventory;
  return ((installed + inv.ready + inv.transit) * s.market.listPrice * 0.7) / 1e6;
}

/** How much more of `kind` the player could draw now ($B), and why not (if zero). */
export function debtHeadroom(s: GameStateV2, kind: Debt['kind']): { max: Money; why?: string } {
  const f = s.player.finance;
  const R = f.revenueRun;
  if (f.rating === 'closed' && kind !== 'vendorNote') return { max: 0, why: 'Credit markets closed (rating)' };
  if (kind === 'revolver') {
    if (f.state === 'distress' || f.state === 'insolvent') return { max: 0, why: 'Revolver frozen in distress' };
    const rv = f.debts.find((d) => d.kind === 'revolver');
    return { max: rv ? Math.max(0, rv.principal - rv.drawn) : 0 };
  }
  if (kind === 'gpuTerm') {
    const drawn = f.debts.filter((d) => d.kind === 'gpuTerm').reduce((a, d) => a + d.drawn, 0);
    return { max: Math.max(0, 0.6 * chipCollateral(s) - drawn), why: 'LTV 60% of chip value' };
  }
  if (kind === 'bond') {
    if (R < 50 && f.ownership.public <= 0) return { max: 0, why: 'Bonds need R > $50B or a listing' };
    const drawn = f.debts.filter((d) => d.kind === 'bond').reduce((a, d) => a + d.drawn, 0);
    return { max: Math.max(0, R - drawn) };
  }
  return { max: 0, why: 'Vendor notes come with vendor deals' };
}

/** Draw on (or issue) a facility. Revolver draws use the existing facility; GPU loans and bonds create a new
 *  tranche. Returns the amount drawn. */
export function drawDebt(s: GameStateV2, ctx: SystemCtx, kind: Debt['kind'], amount: number): number {
  const f = s.player.finance;
  const head = debtHeadroom(s, kind);
  const amt = Math.max(0, Math.min(amount, head.max));
  if (amt <= 0) return 0;
  if (kind === 'revolver') {
    const rv = f.debts.find((d) => d.kind === 'revolver');
    if (!rv) return 0;
    rv.drawn += amt;
  } else {
    const t = DEBT_TERMS[kind];
    const spread = kind === 'bond' ? RATING_SPREAD_BP[f.rating] : t.spreadBp;
    const d: Debt = { id: `D${s.time.day}-${f.debts.length}`, kind, principal: amt, drawn: amt, spreadBp: spread, maturityDay: s.time.day + t.years * 365, covenant: kind === 'gpuTerm' ? 'collateral' : 'incurrence' };
    if (kind === 'gpuTerm') d.collateralH100e = (amt / Math.max(0.001, s.market.listPrice * 0.7)) * 1e6;
    f.debts.push(d);
  }
  bookCash(s, ctx, amt, 'financing', `${kind} draw`);
  yearStats(s).debtDrawn += amt;
  if (s.player.board.preset === 'pbcTrust' && kind !== 'revolver') ctx.log('finance', 'Trust notified of new debt (5-day notice).');
  return amt;
}

/** Repay drawn debt (revolver first unless an id is given). Returns the amount repaid. */
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

/**
 * Rating score (R15): z = 2·[op. cash flow > 0] + min(2, backlog/debt) − (Debt + 0.3·PV(commitments))/R − 2·[distress].
 * Contracted backlog ≈ 0.5·R [D]; PV ≈ 0.85 × remaining commitments [D].
 */
export function ratingScore(s: GameStateV2): number {
  const f = s.player.finance;
  const R = Math.max(0.1, f.revenueRun);
  const debt = totalDebt(f);
  const backlog = 0.5 * R;
  const cover = debt > 0 ? Math.min(2, backlog / debt) : 2;
  return 2 * (f.ws3.opCashQ > 0 ? 1 : 0) + cover - (debt + 0.3 * 0.85 * commitmentsRemaining(s)) / R - 2 * (f.state === 'distress' ? 1 : 0);
}
export const ratingOf = (z: number): FinanceState['rating'] => (z >= 2 ? 'BBB' : z >= 1 ? 'BB' : z >= 0 ? 'B' : 'closed');

/** Quarter-end covenant tests (R15): revolver liquidity ≥ max($1B, 0.11·R); GPU loans: collateral < 1.2× loan → cash
 *  sweep (breach if cash cannot cover). Returns true if any covenant is breached. */
export function covenantsBreached(s: GameStateV2, ctx: SystemCtx): boolean {
  const f = s.player.finance;
  let breach = false;
  const rv = f.debts.find((d) => d.kind === 'revolver');
  if (rv && rv.drawn > 0 && f.cash < Math.max(1, 0.11 * f.revenueRun)) breach = true;
  const gpu = f.debts.filter((d) => d.kind === 'gpuTerm' && d.drawn > 0);
  if (gpu.length) {
    const drawn = gpu.reduce((a, d) => a + d.drawn, 0);
    const value = chipCollateral(s);
    if (value < 1.2 * drawn) {
      const sweep = drawn - value / 1.2;
      if (f.cash > sweep + 1) {
        let left = sweep;
        for (const d of gpu) {
          const x = Math.min(left, d.drawn);
          d.drawn -= x;
          left -= x;
        }
        bookCash(s, ctx, -sweep, 'financing', 'GPU-loan cash sweep', 'collateral below 1.2× loan');
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
      continue;
    }
    if (f.cash >= d.drawn) {
      bookCash(s, ctx, -d.drawn, 'financing', 'debt maturity');
      d.drawn = 0;
    } else breach = true;
  }
  return breach;
}
