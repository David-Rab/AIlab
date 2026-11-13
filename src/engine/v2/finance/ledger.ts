// Player finance state and the commitment ledger (V2-SPEC §3.7.2, §3.7.6). Owner: WS3.
import { dayOfDate } from '../core/time';
import type { BaselineId, Commitment$, FinanceState, GameStateV2, GovernancePresetId } from '../types';
import { valuationMark } from './equity';

/** Player finance at Jul 2025 (§3.7.2). Reality scales commitments by 0.85. */
export function initialFinance(baseline: BaselineId, governance: GovernancePresetId, startDate: string): FinanceState {
  const reality = baseline === 'reality';
  const k = reality ? 0.85 : 1;
  const revenueHistory = reality ? [4.5, 6.5, 9, 11] : [4.5, 6, 8, 10];
  const revenueRun = reality ? 13 : 12;
  const narrative = reality ? 1.2 : 1.5;
  const g = revenueHistory[3] / revenueHistory[0]; // ≈ 2.2–2.4 yearly growth from the last 4 quarters [D]
  const cloudEnd = dayOfDate(startDate, '2028-07-01');
  const ledger: Commitment$[] = [
    { id: 'L-cloud0', payee: 'Northwind Cloud', kind: 'cloud', perQuarter: 2.275 * k, endDay: cloudEnd, cancellableNoticeQ: null, penalty: 0 },
  ];
  return {
    cash: reality ? 45 : 40,
    revenueRun,
    revenueHistory,
    valuation: valuationMark(Math.max(g, 2.7), revenueRun, 1, narrative, 1),
    ownership: { founder: 0.3, mission: 0.26, fin: 0.17, strat: { 'Northwind Cloud': 0.27 }, public: 0 },
    raisedLast4q: 0,
    rounds: [],
    tranches: governance === 'legacyNonprofit'
      ? [{ amount: 30, dueDay: dayOfDate(startDate, '2026-01-01'), condition: 'recapitalisation', deadline: dayOfDate(startDate, '2026-12-31'), source: 'Growth round (conditional)' }]
      : [],
    debts: [{ id: 'D-revolver', kind: 'revolver', principal: 4, drawn: 0, spreadBp: 150, maturityDay: dayOfDate(startDate, '2030-07-01') }],
    ledger,
    rating: 'BB',
    runwayQ: 8,
    state: 'healthy',
    narrative,
    deals: [],
  };
}

/** Ledger payments falling due in a quarter. TODO(WS3, M1). */
export function ledgerDue(s: GameStateV2, _quarter: number): number {
  return s.player.finance.ledger.reduce((a, c) => a + (c.endDay > s.time.day ? c.perQuarter : 0), 0);
}
