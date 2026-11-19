// "What we owe" (FINANCE-V3 §0.4, §11; FINANCE-BUILD FIN2): one selector listing every expectation, condition and
// covenant with its progress, and the contingent liabilities. Read-only; the Finance "What we owe" card and the one
// Watch alert read it. Owner: WS3.
import { DEBT_SIZING } from '../../../data/v2/deals';
import { dayOfQuarter, quarterIndex } from '../core/time';
import type { Day, FinancePromise, GameStateV2, Money, Thesis } from '../types';
import { contingentLiabilities } from './capex';
import { chipCollateral, trailingOpCash } from './debt';
import { trancheConditionMet } from './investors';
import { copyrightExposure, computeOnline } from './observe';
import { livePromises, promiseDeadline, promiseStatus, type PromiseStatus } from './promises';

export interface OweTranche {
  source: string;
  amount: Money;
  /** Condition in words and progress toward it (0–1; 1 = met). */
  condition: string;
  label: string;
  progress: number;
  met: boolean;
  dueDay: Day;
  deadline?: Day;
  daysLeft?: number;
}

export interface OweCovenant {
  id: 'creditLine' | 'chipLoan' | 'bonds';
  label: string;
  rule: string;
  /** What the covenant requires and what you have (same unit); headroom = actual − required. */
  required: number;
  actual: number;
  unit: '$B' | '×';
  /** idle: the covenant applies only once drawn; near: within its warning margin; breach: failing now. */
  state: 'idle' | 'ok' | 'near' | 'breach';
}

export interface OweContingent { id: string; kind: 'rvg' | 'litigation'; label: string; amount: Money; /** Odds a quarter it falls due (litigation). */ pQ?: number; detail: string }

export interface Owe {
  promises: PromiseStatus[];
  /** The round in progress: its promise starts when it closes. */
  pending?: { thesis: Thesis; ask: Money; closesDay: Day; deadline: Day };
  /** Promises judged recently (newest first). */
  judged: FinancePromise[];
  tranches: OweTranche[];
  covenants: OweCovenant[];
  contingent: OweContingent[];
  contingentTotal: Money;
  /** For the Watch alert: promises behind, covenants near or breached. */
  behind: PromiseStatus[];
  near: OweCovenant[];
}

/** Covenant warning margins [D]: a drawn credit line is "near" when cash is under 1.5 × the ⅓-of-line minimum; a chip
 *  loan when collateral is under 1.4 × the loan (the sweep starts at 1.2 ×). */
export const COVENANT_NEAR = { creditLine: 1.5, chipLoan: 1.4 } as const;

function trancheOf(s: GameStateV2, t: GameStateV2['player']['finance']['tranches'][number]): OweTranche {
  const f = s.player.finance;
  const cond = t.condition ?? '';
  const met = !cond || trancheConditionMet(s, cond);
  let label = 'no condition: lands when due';
  let progress = 1;
  const [k, v] = cond.split(':');
  if (k === 'revenue') {
    label = `revenue run-rate $${Number(v).toFixed(0)}B/yr (now $${f.revenueRun.toFixed(0)}B)`;
    progress = f.revenueRun / Math.max(0.1, Number(v));
  } else if (k === 'gw') {
    const gw = (computeOnline(s) * s.power.kWPerH100e) / 1e6;
    label = `${Number(v).toFixed(1)} GW online (now ${gw.toFixed(1)} GW)`;
    progress = gw / Math.max(0.01, Number(v));
  } else if (cond === 'recapitalisation') {
    const r = f.ws3.recap;
    label = r.doneDay !== undefined ? 'recapitalisation complete' : r.startDay !== undefined ? 'recapitalisation under review' : r.refused ? 'recapitalisation refused' : 'recapitalisation not started';
    progress = r.doneDay !== undefined ? 1 : r.startDay !== undefined ? Math.min(0.95, (s.time.day - r.startDay) / 360) : 0;
  } else if (cond === 'ipo') {
    label = f.ownership.public > 0 ? 'listed' : 'an IPO';
    progress = f.ownership.public > 0 ? 1 : 0;
  }
  return { source: t.source, amount: t.amount, condition: cond, label, progress: Math.min(1, progress), met, dueDay: t.dueDay, ...(t.deadline !== undefined ? { deadline: t.deadline, daysLeft: Math.max(0, t.deadline - s.time.day) } : {}) };
}

function covenantsOf(s: GameStateV2): OweCovenant[] {
  const f = s.player.finance;
  const out: OweCovenant[] = [];
  const rv = f.debts.find((d) => d.kind === 'revolver');
  if (rv && rv.principal > 0) {
    const required = DEBT_SIZING.lineLiquidity * rv.principal;
    const actual = Math.max(0, f.cash);
    const state = rv.drawn <= 0 ? 'idle' : actual < required ? 'breach' : actual < COVENANT_NEAR.creditLine * required ? 'near' : 'ok';
    out.push({ id: 'creditLine', label: 'Credit line liquidity', rule: `while drawn, cash at each quarter end ≥ ⅓ of the $${rv.principal.toFixed(1)}B line`, required, actual, unit: '$B', state });
  }
  const gpu = f.debts.filter((d) => d.kind === 'gpuTerm' && d.drawn > 0);
  if (gpu.length) {
    const drawn = gpu.reduce((a, d) => a + d.drawn, 0);
    const ratio = chipCollateral(s) / Math.max(1e-6, drawn);
    const state = ratio < DEBT_SIZING.chipSweep ? 'breach' : ratio < COVENANT_NEAR.chipLoan ? 'near' : 'ok';
    out.push({ id: 'chipLoan', label: 'Chip-loan collateral', rule: `chip value ≥ ${DEBT_SIZING.chipSweep}× the $${drawn.toFixed(1)}B loan, else cash sweeps it down (a breach if cash cannot)`, required: DEBT_SIZING.chipSweep, actual: ratio, unit: '×', state });
  }
  const bonds = f.debts.filter((d) => d.kind === 'bond' && d.drawn > 0);
  if (bonds.length) {
    const ocf = trailingOpCash(s) ?? 0;
    out.push({ id: 'bonds', label: 'Bond incurrence', rule: 'new bonds only while trailing operating cash flow is positive (no maintenance test)', required: 0, actual: ocf, unit: '$B', state: ocf > 0 ? 'ok' : 'idle' });
  }
  return out;
}

function contingentOf(s: GameStateV2): OweContingent[] {
  const out: OweContingent[] = contingentLiabilities(s).items.map((i, n) => ({ id: `rvg-${n}`, kind: 'rvg' as const, label: i.name, amount: i.amount, detail: 'residual-value guarantee: 50% of the unamortised lease, owed only if you walk away' }));
  const lit = copyrightExposure(s);
  if (lit.tokensT > 0) out.push({ id: 'litigation', kind: 'litigation', label: 'Copyright litigation', amount: lit.settlement, pQ: lit.pQ, detail: `${Math.round(lit.tokensT)}T tokens of unlicensed training data; a suit settles automatically (at most once a year). Licensing the data (D3) clears it` });
  return out;
}

/** Everything the company owes or has promised, with progress (spec §11 "What we owe"). */
export function whatWeOwe(s: GameStateV2): Owe {
  const f = s.player.finance;
  const promises = livePromises(s).map((p) => promiseStatus(s, p)).sort((a, b) => a.p.deadline - b.p.deadline);
  const pr = f.ws3?.pendingRound;
  const contingent = contingentOf(s);
  const covenants = covenantsOf(s);
  const out: Owe = {
    promises,
    judged: (f.promises ?? []).filter((p) => p.result).sort((a, b) => (b.result?.day ?? 0) - (a.result?.day ?? 0)).slice(0, 4),
    tranches: f.tranches.map((t) => trancheOf(s, t)),
    covenants,
    contingent,
    contingentTotal: contingent.reduce((a, c) => a + c.amount, 0),
    behind: promises.filter((p) => p.state === 'behind'),
    near: covenants.filter((c) => c.state === 'near' || c.state === 'breach'),
  };
  if (pr?.thesis) {
    const close = dayOfQuarter(s.time.startDate, quarterIndex(s.time.startDate, s.time.day) + 1);
    out.pending = { thesis: pr.thesis, ask: pr.ask, closesDay: close, deadline: promiseDeadline(s, close) };
  }
  return out;
}

