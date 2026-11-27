// Finance (IA.md L2; PROPOSALS §5): HOME of burn by category and net burn (waterfall), revenue run-rate, cash history,
// raise ceiling and ask, the commitment ledger, board, ownership, markets, debt and deals. The valuation, the sector
// value and your share live on the Story tab (FinanceStory.tsx, FIN5a). Cash and runway
// live in the top strip (L0) and are never repeated here.
import { useState, type ReactNode } from 'react';
import {
  actionView, anchorPartners, conditionWords, dateOf, dayOfQuarter, dealWith, debtHeadroom, leadEstimate, partnerCosts, partnerOffers, partnersNow, termsEquity, type PartnerChoice, debtRatePct, fmtDate, fmtMonth, incidentBoardHit, interestPerYear, ledgerDue, leaseRate, liveLedger, newDebtRatePct, ratingTerms,
  payrollOf, qOf, runwayOf, totalDebt, RUNWAY_CAP,
  describeTarget, fmtMetric, whatWeOwe, isListed, LARGE_ROUND, roundSplit, makeThesis, MILESTONES, PITCH, PITCHES, pitchAvailable, PROMISE_RESULT, promiseDeadline, raiseQuote, raiseTerms, trendOf,
  BC_ANCHOR, BC_CLEAR, BC_REVERT_Q, BC_WARN, canonicalKey, charterHolds, charterRights, CRITICS, criticsSide, OUSTER, INCIDENT_BC, INCIDENT_BC_CAP_Q, MOOD_BASE, MOOD_LABEL, MOOD_SOURCE_OF, MOOD_SOURCES, MOOD_WEIGHTS, moodWeight,
} from '../../../engine/v2';
import { isDivision } from '../../../data/v2/starts';
import { boardReview } from '../shell/selectors';
import { OUSTER_NOTICE_D } from '../../../engine/v2';
import type { BoardSeat, Commitment$, Debt, GameStateV2, MilestoneType, MoodSource, PartnerKind, PartnerSupply, PartnerTerms, Pitch, StrategicDeal } from '../../../engine/v2';
import { DEBT_SIZING, MARKET, PARTNER_KINDS, PARTNER_TERMS, partnerDef } from '../../../data/v2/deals';
import { PathCurve } from './Compute';
import { ActBtn, Limit, CauseBars, Gate, SEAT_KIND_LABEL, Seg, Term, Tip, TipCard, Toggle, Why } from '../ui';
import { MILESTONE_UI, OweCard, OweLink } from './FinanceOwe';
import { ParentBudget } from './FinanceDivision';
import { StoryCard } from './FinanceStory';
import { Card, GoBtn, HBar, PanelHead, Pill, tabOf, Tabs } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C, SPHERE } from '../theme';
import './finance.css';

const STANCE = ['speed', 'money', 'safety', 'mission'] as const;
const DEBT_KINDS: { id: Debt['kind']; label: string; blurb: string }[] = [
  { id: 'revolver', label: 'Credit line', blurb: 'A bank line you draw and repay at will, sized at 3% of valuation (cap $15B) when you borrow. Counts toward liquidity while undrawn; frozen in distress.' },
  { id: 'gpuTerm', label: 'Chip loan', blurb: 'A 4-year loan secured on your chips: up to 60% of their value. The only debt open to a loss-making lab.' },
  { id: 'bond', label: 'Bond', blurb: 'Ten-year debt sold to the market: only with positive operating cash flow over the last year, up to 3× it.' },
  { id: 'assumed', label: 'Assumed debt', blurb: 'Debt that came with a lab you bought, priced at your rating.' },
];
const SEAT: Record<BoardSeat['kind'], { icon: typeof ICON.board; label: string }> = {
  founder: { icon: ICON.you, label: 'Founder' }, mission: { icon: ICON.exec, label: 'Mission' }, financial: { icon: ICON.cash, label: 'Financial' },
  strategic: { icon: ICON.relations, label: 'Strategic' }, independent: { icon: ICON.board, label: 'Independent' }, gov: { icon: ICON.congress, label: 'Government' },
};
const KIND_TERM: Record<string, string> = { cloud: 'cloudContract', lta: 'lta', lease: 'site', finLease: 'spv', power: 'mw', acquired: 'acquisition' };
const KIND_LABEL: Record<string, string> = { cloud: 'cloud', lta: 'chip supply', lease: 'colocation', finLease: 'lease', power: 'power', acquired: 'acquired' };

/** FIN1: firm contracts on the expected path pay one ledger entry per quarter; the contracts table shows one row per
 *  contract (this quarter's payment, or its first if it has not started, and its end). */
interface ContractRow { id: string; payee: string; kind: Commitment$['kind']; perQ: number; lastQ: number; startDay?: number; endDay: number; notice: number | null; entry: Commitment$ }
function contractRows(s: GameStateV2): ContractRow[] {
  const by = new Map<string, Commitment$[]>();
  for (const c of liveLedger(s)) { const k = c.contract ?? c.id; by.set(k, [...(by.get(k) ?? []), c]); }
  return [...by.entries()].map(([id, cs]) => {
    const sorted = cs.slice().sort((x, y) => (x.startDay ?? -1e9) - (y.startDay ?? -1e9));
    const now = sorted.find((c) => (c.startDay ?? -1e9) <= s.time.day) ?? sorted[0];
    return { id, payee: now.payee, kind: now.kind, perQ: now.perQuarter, lastQ: sorted[sorted.length - 1].perQuarter, startDay: sorted[0].startDay, endDay: Math.max(...sorted.map((c) => c.endDay)), notice: now.cancellableNoticeQ, entry: now };
  });
}

const qLabel = (s: GameStateV2, q: number) => {
  const d = dateOf(s, dayOfQuarter(s.time.startDate, q));
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${String(d.getUTCFullYear()).slice(2)}`;
};
const nextQDay = (s: GameStateV2) => dayOfQuarter(s.time.startDate, qOf(s) + 1);
/** Round axis step: 1, 2, 2.5 or 5 × 10^k. */
const niceStep = (x: number) => { const k = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, x)))); const m = x / k; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * k; };

// ───────── cash-flow waterfall: HOME of burn by category and net burn ─────────
function Waterfall({ s }: { s: GameStateV2 }) {
  const rw = runwayOf(s);
  const p = rw.parts;
  const pl = s.player;
  const payQ = payrollOf(s) / 4;
  const secQ = pl.security.spendRate / 4;
  const fundQ = pl.policies.transitionFund / 4;
  const intQ = interestPerYear(s) / 4;
  const otherQ = Math.max(0, p.operating - payQ - secQ - fundQ - intQ);
  const q0 = qOf(s);
  const orders = pl.orders.filter((o) => o.kind !== 'lta' && o.dueQ - q0 <= 4 && o.qty > o.delivered);
  const building = pl.sites.filter((x) => x.stage !== 'live' && x.stage !== 'blocked' && x.capex > x.capexPaid);
  const rev = -p.revenue;
  // Jank F2: a division's inflow is the parent's budget (its revenue goes to the parent).
  const division = isDivision(s);
  const parentQ = Math.max(0, -p.funding);
  const steps = [
    division
      ? { id: 'parent', label: 'Parent budget', term: 'parentBudget', icon: ICON.revenue, v: parentQ, rows: [{ label: 'Per quarter (next 4 q, average)', value: F.money(parentQ) }, { label: <Term id="revenueRun">Revenue</Term>, value: `${F.money(pl.finance.revenueRun, { perYear: true })} to the parent` }], body: 'The parent pays your budget at each quarter start and covers any shortfall.' }
      : { id: 'revenue', label: 'Revenue', term: 'revenueRun', icon: ICON.revenue, v: rev, rows: [{ label: <Term id="revenueRun">Run-rate</Term>, value: F.money(pl.finance.revenueRun, { perYear: true }) }, { label: 'Per quarter', value: F.money(rev) }], body: 'Revenue from your deployments this quarter.' },
    { id: 'operating', label: 'Payroll & ops', term: 'opex', icon: ICON.staff, v: -p.operating, body: 'Running costs that are not contracts.', rows: [
      { label: <Term id="payroll">Payroll</Term>, value: F.money(payQ) }, { label: 'Security spend', value: F.money(secQ) },
      ...(fundQ > 0 ? [{ label: <Term id="transitionFund">Transition fund</Term>, value: F.money(fundQ) }] : []), ...(intQ > 0 ? [{ label: 'Interest', value: F.money(intQ) }] : []),
      { label: 'Power, O&M, rentals, other', value: F.money(otherQ) },
    ] },
    { id: 'commitments', label: 'Contracts', term: 'ledger', icon: ICON.commitment, v: -p.commitments, body: 'Payments on your commitment ledger (cloud, leases, LTAs).', rows: contractRows(s).filter((c) => (c.startDay ?? -1) <= s.time.day).sort((a, b) => b.perQ - a.perQ).slice(0, 6).map((c) => ({ label: `${c.payee} · ${KIND_LABEL[c.kind] ?? c.kind}`, value: F.money(c.perQ) })) },
    { id: 'chips', label: 'Chips', term: 'capex', icon: ICON.compute, v: -p.chips, body: 'Chip-order balances paid on delivery, per quarter averaged over the next 4 quarters.', rows: orders.slice(0, 6).map((o) => ({ label: `${o.kind} · ${F.count(o.qty - o.delivered)} H100e`, value: `due ${o.dueQ - q0 <= 0 ? 'now' : `+${o.dueQ - q0}q`}` })) },
    { id: 'sites', label: 'Sites & power', term: 'site', icon: ICON.sites, v: -p.sites, body: 'Site capex on each site\'s build schedule, per quarter averaged over the next 4 quarters.', rows: building.slice(0, 6).map((x) => ({ label: `${x.name} · ${x.stage}`, value: `${F.money(x.capex - x.capexPaid)} left` })) },
  ];
  const net = division ? parentQ - rw.burnQ : -rw.burnQ;
  // FIN5c: the budget-year verdict lives on the Parent budget card; this bar is only this quarter's flow.
  const netLabel = division ? 'Budget − spend' : net < 0 ? 'Net burn' : 'Net inflow';
  const spend = steps.slice(1).reduce((a, x) => a - x.v, 0);
  const W = 760;
  const H = 270;
  const pt = 26;
  const pb = 48;
  const pl0 = 12;
  let cum = 0;
  const bars = steps.map((x) => { const a = cum; cum += x.v; return { ...x, a, b: cum }; });
  const lo = Math.min(0, net, ...bars.map((b) => Math.min(b.a, b.b)));
  const hi = Math.max(1e-6, ...bars.map((b) => Math.max(b.a, b.b)), net);
  const Y = (v: number) => pt + ((hi - v) / Math.max(1e-6, hi - lo)) * (H - pt - pb);
  const col = (W - pl0 * 2) / 6;
  const bw = col * 0.6;
  const X = (i: number) => pl0 + col * i + (col - bw) / 2;
  const biggest = bars.slice(1).reduce((m, b) => (-b.v > -m.v ? b : m), bars[1]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="wf2" data-home="burn">
      <line x1={pl0} x2={W - pl0} y1={Y(0)} y2={Y(0)} stroke={C.line2} />
      {bars.map((b, i) => {
        const top = Math.min(Y(b.a), Y(b.b));
        const h = Math.max(1.5, Math.abs(Y(b.a) - Y(b.b)));
        return (
          <Tip key={b.id} as="g" content={() => <TipCard title={<Term id={b.term}>{b.label}</Term>} value={F.money(b.v, { signed: true, perQ: true })} rows={b.rows}>{b.body}</TipCard>}>
            <g className="wf2-bar" data-wf={b.id}>
              <rect x={X(i) - 4} y={pt - 20} width={bw + 8} height={H - pt + 20} fill="transparent" />
              <rect x={X(i)} y={top} width={bw} height={h} rx={3} fill={i === 0 ? C.good : '#6b7c91'} />
              {i < bars.length && <line x1={X(i) + bw} x2={X(i + 1)} y1={Y(b.b)} y2={Y(b.b)} stroke={C.text3} strokeDasharray="2 3" />}
              <text x={X(i) + bw / 2} y={top - 6} textAnchor="middle" className={`wf2-val ${i === 0 ? "pos" : ""}`}>{Math.abs(b.v) < 0.005 ? "$0" : F.money(b.v, { signed: true })}</text>
              {b.id === biggest.id && spend > 0 && -b.v > 0 && <text x={X(i) + bw / 2} y={top + h + 13 > H - pb + 8 ? top - 20 : top + h + 13} textAnchor="middle" className="wf2-note">{F.pct(-b.v / spend)} of spend</text>}
              <text x={X(i) + bw / 2} y={H - pb + 22} textAnchor="middle" className="wf2-lbl">{b.label}</text>
            </g>
          </Tip>
        );
      })}
      <Tip as="g" content={() => <TipCard title={<Term id={division ? 'parentBudget' : 'netBurn'}>{netLabel}</Term>} value={F.money(net, { signed: true, perQ: true })} rows={[{ label: division ? 'Parent budget' : 'Revenue', value: F.money(division ? parentQ : rev) }, { label: 'Spending', value: F.money(-spend) }]}>{division ? 'This quarter\x27s budget payment minus every category of spending. Whether the year is over budget is on the Parent budget card.' : 'Revenue minus every category of spending this quarter. Runway in the top strip divides your liquidity by this.'}</TipCard>}>
        <g className="wf2-bar" data-home="netBurn">
          <rect x={X(5)} y={Math.min(Y(0), Y(net))} width={bw} height={Math.max(1.5, Math.abs(Y(net) - Y(0)))} rx={3} fill={net < 0 ? (division ? C.watch : C.bad) : C.good} />
          <text x={X(5) + bw / 2} y={Math.min(Y(0), Y(net)) - 6} textAnchor="middle" className={`wf2-val ${net < 0 ? (division ? 'warn' : 'neg') : 'pos'}`}>{F.money(net, { signed: true })}</text>
          <text x={X(5) + bw / 2} y={H - pb + 22} textAnchor="middle" className="wf2-lbl strong">{netLabel}</text>
        </g>
      </Tip>
    </svg>
  );
}

// ───────── cash history with raise markers and projections (history is its own datum: no current-value label) ─────────
/** A division's cash below zero is the parent's advance (FIN5c): the axis extends below $0 and that band is marked. */
const divisionAdvance = (s: GameStateV2) => isDivision(s) && (s.player.finance.cash < 0 || s.series.cash.some((v) => v < 0) || runwayOf(s).path.some((p) => p.cash < 0));
function CashHistory({ s }: { s: GameStateV2 }) {
  const [hi, setHi] = useState<number>();
  const S = s.series;
  const f = s.player.finance;
  const rw = runwayOf(s);
  const now = s.time.day;
  // FIN6b: before the first weekly point the chart still shows today and the projection (no empty card at the start).
  const n0 = Math.min(S.day.length, S.cash.length);
  const days = n0 ? S.day.slice(0, n0) : [now];
  const cash = n0 ? S.cash.slice(0, n0) : [f.cash];
  const n = days.length;
  // Projection: the runway's quarter-by-quarter cash path (each payment in the quarter it falls due).
  const proj = rw.path.map((p) => [p.day, p.cash]);
  const dry = isDivision(s) ? undefined : rw.zeroDay; // a division cannot run dry (the parent covers it)
  const pend = f.ws3.pendingRound;
  const nq = nextQDay(s);
  const pendPts: number[][] = [];
  if (pend) for (const [d, v] of proj) {
    if (d >= nq && pendPts.length && pendPts[pendPts.length - 1][0] < nq) pendPts.push([nq, v], [nq, v + pend.ask]);
    pendPts.push([d, v + (d >= nq ? pend.ask : 0)]);
  }
  const W = 620;
  const H = 260;
  const pl = 46;
  const pr = 14;
  const pt = 14;
  const pb = 26;
  const x0 = days[0];
  const x1 = proj[proj.length - 1][0];
  const adv = divisionAdvance(s);
  const vMax = Math.max(1, ...cash, f.cash, ...proj.map((p) => p[1]), ...pendPts.map((p) => p[1]));
  const vMin = adv ? Math.min(0, ...cash, f.cash, ...proj.map((p) => p[1])) : 0;
  const step = niceStep(Math.max(vMax, vMax - vMin) / 3);
  const yMax = step * Math.ceil((vMax * 1.05) / step);
  const yMin = vMin < 0 ? -step * Math.ceil((-vMin * 1.05) / step) : 0;
  const X = (d: number) => pl + ((d - x0) / Math.max(1, x1 - x0)) * (W - pl - pr);
  const Y = (v: number) => pt + ((yMax - Math.max(yMin, v)) / (yMax - yMin)) * (H - pt - pb);
  const ticks = Array.from({ length: Math.round((yMax - yMin) / step) + 1 }, (_, i) => yMin + i * step);
  const months: number[] = [];
  for (let d = x0; d <= x1; d += 7) { const dt = dateOf(s, d); const pd = dateOf(s, d - 7); if (dt.getUTCMonth() !== pd.getUTCMonth() && dt.getUTCMonth() % 6 === 0) months.push(d); }
  const rounds = f.rounds.filter((r) => r.day >= x0);
  const at = (d: number) => { let i = 0; while (i < n - 1 && days[i + 1] <= d) i++; return i; };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cash2" data-home="cashHistory" onMouseLeave={() => setHi(undefined)}
      onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const d = x0 + (((e.clientX - r.left) / r.width) * W - pl) / (W - pl - pr) * (x1 - x0); setHi(d <= now ? at(d) : undefined); }}>
      <rect x={X(now)} y={pt} width={X(x1) - X(now)} height={H - pt - pb} fill="rgba(255,255,255,.025)" />
      {yMin < 0 && (
        <g data-test="cash-advance-band">
          <rect x={pl} y={Y(0)} width={W - pl - pr} height={Y(yMin) - Y(0)} fill={C.watch} opacity={0.08} />
          <line x1={pl} x2={W - pr} y1={Y(0)} y2={Y(0)} stroke={C.watch} strokeOpacity={0.6} />
          <text x={pl + 6} y={Y(yMin) - 6} className="ch-note warn">below $0: advance from the parent</text>
        </g>
      )}
      {ticks.map((t) => <g key={t}><line x1={pl} x2={W - pr} y1={Y(t)} y2={Y(t)} stroke="#1f2a38" strokeDasharray="3 4" /><text x={pl - 6} y={Y(t) + 3} textAnchor="end" className="ch-ax">{Math.abs(t) < 1e-9 ? "$0" : t < 0 ? `−${F.money(-t)}` : F.money(t)}</text></g>)}
      {months.map((d) => <text key={d} x={X(d)} y={H - 8} textAnchor="middle" className="ch-ax">{fmtMonth(dateOf(s, d))}</text>)}
      {n > 1 ? <polyline points={cash.map((v, i) => `${X(days[i])},${Y(v)}`).join(' ')} fill="none" stroke="#c9d4e2" strokeWidth={1.8} /> : <circle cx={X(now)} cy={Y(f.cash)} r={3} fill="#c9d4e2" />}
      <polyline points={proj.map(([d, v]) => `${X(d)},${Y(v)}`).join(' ')} fill="none" stroke={C.watch} strokeWidth={1.6} strokeDasharray="5 4" />
      {pend && <polyline points={pendPts.map(([d, v]) => `${X(d)},${Y(v)}`).join(' ')} fill="none" stroke={C.good} strokeWidth={1.6} strokeDasharray="5 4" />}
      {dry !== undefined && (
        <g>
          <circle cx={X(dry)} cy={Y(0)} r={4} fill={C.bad} />
          <text x={Math.min(X(dry), W - pr - 4)} y={Y(0) - 8} textAnchor="end" className="ch-note bad">runway ends ≈ {fmtMonth(dateOf(s, dry))}</text>
        </g>
      )}
      {rounds.map((r) => { const i = at(r.day); return (
        <g key={r.day}>
          <circle cx={X(days[i])} cy={Y(cash[i])} r={3.5} fill={C.good} />
          <text x={X(days[i])} y={Y(cash[i]) - 7} textAnchor="middle" className="ch-note good">{r.down ? 'down round' : 'raise'} {F.money(r.amount)}</text>
        </g>
      ); })}
      {hi !== undefined && (
        <g>
          <line x1={X(days[hi])} x2={X(days[hi])} y1={pt} y2={H - pb} stroke="#fff" opacity={0.35} />
          <circle cx={X(days[hi])} cy={Y(cash[hi])} r={3.5} fill="#fff" />
          <g transform={`translate(${Math.min(W - 150, X(days[hi]) + 8)}, ${pt + 6})`}>
            <rect width={140} height={36} rx={6} fill="#0e141c" stroke="#46597a" />
            <text x={9} y={15} className="ch-tt">{fmtDate(dateOf(s, days[hi]))}</text>
            <text x={9} y={29} className="ch-tt">{cash[hi] < 0 && adv ? `advance ${F.money(-cash[hi])}` : F.money(cash[hi])}</text>
          </g>
        </g>
      )}
    </svg>
  );
}

// ───────── how much can you raise ─────────
function RaiseCard({ s }: { s: GameStateV2 }) {
  const f = s.player.finance;
  const [anchor, setAnchor] = useState('');
  const [type, setType] = useState<MilestoneType>(() => raiseTerms(s, {}).type);
  const [pitch, setPitch] = useState<Pitch>('base');
  const [dual, setDual] = useState(false);
  const q0 = raiseQuote(s, Number.POSITIVE_INFINITY, { anchor: !!anchor, pitch });
  const ceil = q0.ceiling;
  const askMax = Math.max(5, Math.ceil(ceil.max * 2));
  const [askIn, setAsk] = useState<number | undefined>(undefined);
  const ask = Math.max(0.1, Math.round(Math.min(askMax, askIn ?? Math.max(0.1, ceil.max)) * 10) / 10);
  const params = { ask, type, pitch, ...(anchor ? { anchor } : {}) };
  const q = raiseQuote(s, ask, { anchor: !!anchor, pitch });
  const stake = q.dilution * 100;
  const fail = 1 - q.pClose;
  const burn = runwayOf(s).burnQ;
  // FIN4r (H3): a round of $20B or more pays half at the close and the rest as a conditional tranche.
  const close0 = nextQDay(s);
  const split = roundSplit(s, ask, { closeDay: close0 });
  const trWords = split.tranche ? (split.tranche.condition === 'recapitalisation' ? 'the recapitalisation completes' : `revenue run-rate reaches ${F.money(Number(split.tranche.condition.split(':')[1]), { perYear: true })} (${LARGE_ROUND.revenueX}× at the close)`) : '';
  const limits = ([['pool', 'Investor pool', 'investorPool', ICON.staff], ['dilution', 'Dilution limit', 'dilutionCap', ICON.valuation]] as const)
    .map(([k, label, term, icon]) => ({ k, label, term, icon, v: ceil.parts[k] ?? 0 }));
  const lmax = Math.max(1e-6, ...limits.map((l) => l.v));
  const boundLabel = limits.find((l) => l.k === ceil.bound)?.label.toLowerCase() ?? ceil.bound;
  const partners = anchorPartners(s).slice(0, 3);
  const pend = f.ws3.pendingRound;
  const th = makeThesis(s, type, pitch);
  const tr = trendOf(s, type);
  const close = nextQDay(s);
  const due = promiseDeadline(s, close);
  const typeOpts = MILESTONES.map((m) => { const t = trendOf(s, m); return { v: m, label: MILESTONE_UI[m].label, ...(t.blocked ? { locked: t.blocked } : {}) }; });
  const pitchOpts = PITCHES.map((p) => { const ok = pitchAvailable(s, p); return { v: p, label: `${p[0].toUpperCase()}${p.slice(1)} ×${PITCH[p].price}`, ...(ok !== true ? { locked: ok } : {}) }; });
  const ipoView = actionView(s, 'fin.ipo', { dualClass: dual });
  const MI = MILESTONE_UI[type].icon;
  return (
    <Card title={<Term id="raiseCeiling">Raise</Term>} home="raiseCeiling" id="ctl-raise-card"
      right={<span className="tag2 warn">bound by {boundLabel}</span>}>
      <div className="lim-rows">
        {limits.map((l) => (
          <div className="lim-row" key={l.k} data-cap={l.k}>
            <span className="row-i"><l.icon size={13} /><Term id={l.term}>{l.label}</Term></span>
            <HBar v={l.v} max={lmax} w="100%" h={8} color={l.k === ceil.bound ? C.watch : '#6b7c91'} />
            <Tip content={() => <TipCard title={<Term id={l.term}>{l.label}</Term>} value={F.money(l.v)} rows={limits.map((x) => ({ label: x.label, value: F.money(x.v), tone: x.k === ceil.bound ? 'neg' as const : 'neutral' as const }))}>{`The smaller of the two is how much you can raise now. The dilution limit is at the ${pitch} pitch's price.`}</TipCard>}><span className={`num ${l.k === ceil.bound ? 'tone-warn' : ''}`}>{F.money(l.v)}</span></Tip>
          </div>
        ))}
      </div>
      {/* FIN2: the thesis, one milestone per round and a pitch; the promise it leaves is shown before you sign. */}
      <div className="fin-row thesis-row">
        <span className="dim small"><Term id="roundMilestone">Milestone</Term></span>
        <Seg value={type} options={typeOpts} onChange={setType} testId="raise-type" />
        <span className="dim small"><Term id="pitch">Pitch</Term></span>
        <Seg value={pitch} options={pitchOpts} onChange={setPitch} testId="raise-pitch" />
      </div>
      {typeof th === 'string' ? <div className="tone-neg small">{th}</div> : (
        <Tip as="div" content={() => <TipCard title={<Term id="promise">Promise</Term>} value={describeTarget(th)} rows={[
          { label: 'Now', value: fmtMetric(type, th.start) },
          { label: 'Your trend, 12 months', value: `+${fmtMetric(type, tr.gain).replace(/^level /, '')} (${tr.basis})` },
          { label: `${pitch[0].toUpperCase()}${pitch.slice(1)} pitch`, value: `× ${PITCH[pitch].gain} of that gain · price × ${PITCH[pitch].price}` },
          { label: 'Judged on', value: fmtDate(dateOf(s, due)) },
          { label: 'Met', value: `credibility +${PROMISE_RESULT.metCred} · board +${(PROMISE_RESULT.metBoard * moodWeight(s, 'results')).toFixed(1)} (× weight)`, tone: 'pos' },
          { label: 'Missed by > 20%', value: `credibility ${PROMISE_RESULT.missCred} · board −${Math.abs(PROMISE_RESULT.missBoard * moodWeight(s, 'results')).toFixed(1)} (× weight)`, tone: 'neg' },
        ]}>An expectation, not a contract: no cash moves. Weight = this round's share of what you raise in the year to the deadline.</TipCard>}>
          <div className="fin-row small" data-test="raise-promise"><MI size={13} /><span>Promise: <b>{describeTarget(th)}</b> by {fmtDate(dateOf(s, due))}</span><span className="dim">now {fmtMetric(type, th.start)}</span></div>
        </Tip>
      )}
      {partners.length > 0 && (
        <div className="fin-row"><span className="dim small"><Term id="anchorPartner">Anchor partner</Term></span><Seg value={anchor} options={[{ v: '', label: 'None' }, ...partners.map((p) => ({ v: p, label: p }))]} onChange={setAnchor} /></div>
      )}
      <div className="ask-head">
        <span className="dim small">Ask</span><Tip content={() => <TipCard title="Ask" value={F.money(ask)} rows={[{ label: 'Ceiling now', value: F.money(ceil.max) }]}>Drag the slider; above the ceiling the round may fail.</TipCard>}><b className="num">{F.money(ask)}</b></Tip>
        <span className="sp" />
        <span className="pills">
          <Pill kind="cost" title="Share of the company you sell"><Term id="dilution">stake</Term> −{stake.toFixed(1)}%</Pill>
          <Pill kind="neu" title={`Pre-money: the mark × the ${pitch} pitch's price (×${PITCH[pitch].price})`}>pre {F.money(q.pre)}</Pill>
          <Pill kind={fail > 0.25 ? 'bad' : fail > 0 ? 'warn' : 'good'} title="Asking above the ceiling risks the round failing">close {F.pct(1 - fail)}</Pill>
          {q.down && <Pill kind="bad" title={`Priced below the last round's ${F.money(q.lastPost)} post-money: the board votes on it (below the button), board confidence −${Math.abs(MOOD_BASE.downRound * moodWeight(s, 'setbacks')).toFixed(1)} and anti-dilution shares`}><Term id="downRound">down round</Term></Pill>}
        </span>
      </div>
      {/* Jank F5: what the round does, before you click. */}
      {(() => {
        const rw = runwayOf(s);
        const after = burn > 0 ? Math.min(RUNWAY_CAP, rw.q + split.now / burn) : rw.q;
        return (
          <Tip content={() => <TipCard title="If the round closes" rows={[
            { label: 'Cash at the close', value: `${F.money(f.cash)} → ${F.money(f.cash + split.now)}` },
            ...(split.tranche ? [{ label: <Term id="trancheCondition">Tranche</Term>, value: `${F.money(split.tranche.amount)} if ${trWords} by ${fmtDate(dateOf(s, split.tranche.deadline))}` }] : []),
            { label: <Term id="runway">Runway</Term>, value: `${F.runway(rw.q, RUNWAY_CAP)} → ${F.runway(after, RUNWAY_CAP)}` },
            { label: <Term id="dilution">Stake sold</Term>, value: `${stake.toFixed(1)}% of the company` },
            { label: 'Price (pre-money)', value: F.money(q.pre) },
            { label: 'Closes', value: fmtDate(dateOf(s, close)) },
          ]}>{split.tranche ? `Rounds of ${F.money(LARGE_ROUND.min)} or more pay half at the close (the next quarter start); the other half is a tranche that lands ${fmtDate(dateOf(s, split.tranche.dueDay))} if its condition is met by ${fmtDate(dateOf(s, split.tranche.deadline))}, otherwise it lapses and the shares for it are cancelled. Runway counts only the cash at the close.` : 'The money lands at the next quarter start.'} The odds of closing fall when you ask above the ceiling.</TipCard>}>
            <div className="fin-ba small" data-test="raise-preview">
              <span className="dim">cash at the close</span> <span className="num">{F.money(f.cash)} → <b>{F.money(f.cash + split.now)}</b></span>
              {split.tranche && <span className="tone-warn" data-test="raise-tranche">+ {F.money(split.tranche.amount)} <Term id="trancheCondition">tranche</Term> if {trWords}</span>}
              <span className="dim">· runway</span> <span className="num">{F.runway(rw.q, RUNWAY_CAP)} → <b>{F.runway(after, RUNWAY_CAP)}</b></span>
            </div>
          </Tip>
        );
      })()}
      <div className="ask-slider">
        <input className="slider" type="range" min={0.1} max={askMax} step={0.1} value={ask} onChange={(e) => setAsk(Number(e.target.value))} data-test="raise-ask" />
        <i className="ask-ceil" style={{ left: `${(Math.min(askMax, ceil.max) / askMax) * 100}%` }} title="ceiling" />
      </div>
      <div className="btn-row">
        <ActBtn id="fin.raise" params={params} primary label={`Raise ${F.money(ask)}`} icon={ICON.raise} anchor="raise" reason />
        <button className="btn btn-sm btn-ghost" onClick={() => setAsk(undefined)}>ask = ceiling</button>
        <span className="sp" />
        <ActBtn id="fin.downRound" label={<Term id="downRound">Down round</Term>} />
        <ActBtn id="fin.rescue" label={<Term id="rescue">Rescue</Term>} />
      </div>
      {f.ws3.repricedRound && (() => {
        const rr = f.ws3.repricedRound;
        return (
          <div className="fin-row" data-test="repriced-round">
            <span className="tag2 warn"><Term id="repricedRound">Repriced</Term></span>
            <Tip content={() => <TipCard title={<Term id="repricedRound">Repriced round</Term>} rows={[{ label: 'Ask', value: F.money(rr.ask) }, { label: 'Pre-money', value: F.money(rr.pre) }, { label: 'Last post-money', value: F.money(rr.lastPost) }, { label: 'Decide by', value: fmtDate(dateOf(s, rr.deadline)) }]}>Investors will fund the round only at a lower valuation.</TipCard>}><span className="small"><b className="num">{F.money(rr.ask)}</b> at <b className="num">{F.money(rr.pre)}</b> pre <span className="dim">(last post {F.money(rr.lastPost)}) · decide by {fmtDate(dateOf(s, rr.deadline))}</span></span></Tip>
            <span className="sp" />
            <ActBtn id="fin.acceptRepriced" label="Accept down round" />
            <ActBtn id="fin.pullRepriced" label="Pull" />
          </div>
        );
      })()}
      {/* FIN2 (spec §2.6): the IPO is its own one-time action, with the dual-class choice. */}
      <div className="fin-row" data-test="ipo-row">
        <span className="row-i small"><ICON.milestone size={13} /><Term id="ipo">IPO</Term></span>
        {isListed(s) ? (
          <Tip content={() => <TipCard title={<Term id="ipo">Listed</Term>} value={F.pct(f.ownership.public)} rows={[{ label: <Term id="dualClass">Dual-class</Term>, value: f.dualClass ? 'yes' : 'no' }]}>Public holders own this share of the company.</TipCard>}>
            <span className="small">listed{f.dualClass ? ' · dual-class' : ''} <span className="dim">· public share in Board & owners</span></span>
          </Tip>
        ) : (
          <>
            <Tip content={() => <TipCard title={<Term id="ipo">IPO</Term>} value={ipoView.ok === true ? 'available' : 'not now'} rows={[{ label: 'Sells at most', value: '5% of the company' }, { label: 'Window', value: 'in Story › Markets' }]}>{ipoView.ok === true ? 'One time: public holders and a listing independent join; no promise to judge.' : ipoView.ok}</TipCard>}><span className={`small ${ipoView.ok === true ? 'tone-pos' : 'dim'}`}>{ipoView.ok === true ? 'you can list now' : ipoView.ok}</span></Tip>
            <span className="sp" />
            <Toggle on={dual} onChange={setDual} label={<Term id="dualClass">Dual-class</Term>} />
            <ActBtn id="fin.ipo" params={{ dualClass: dual }} label="List" />
          </>
        )}
      </div>
      <div className="fin-foot">
        {pend ? <Tip content={() => <TipCard title="Pending round" value={F.money(pend.ask)} rows={[{ label: 'Closes', value: fmtDate(dateOf(s, close)) }]}>The money lands when the round closes.</TipCard>}><span><span className="dim">Pending</span> <b className="num">{F.money(pend.ask)}</b> <span className="dim">closes {fmtDate(dateOf(s, close))}</span></span></Tip> : <span className="dim">No round in progress</span>}
        <span className="sp" />
        <OweLink s={s} />
        <GoBtn to={{ panel: 'finance', tab: 'owe' }} label="What we owe" testId="fin.go.owe" />
      </div>
    </Card>
  );
}

// ───────── locked-in spending: 8-quarter firm vs cancellable against the revenue line ─────────
function LockedIn({ s }: { s: GameStateV2 }) {
  const [show, setShow] = useState(false);
  const q0 = qOf(s);
  const due = Array.from({ length: 8 }, (_, i) => {
    const q = q0 + i;
    const tot = ledgerDue(s, q);
    const firm = ledgerDue(s, q, true);
    return { q, tot, firm: Math.min(tot, firm), canc: Math.max(0, tot - firm) };
  });
  const revQ = s.player.finance.revenueRun / 4;
  const dmax = Math.max(1e-6, ...due.map((d) => d.tot));
  const revOff = revQ > dmax * 2.2; // revenue far above the ledger: pin its line to the top, labelled off scale
  const max = (revOff ? dmax : Math.max(dmax, revQ)) * 1.15;
  const rows = contractRows(s);
  const firmN = rows.filter((c) => c.notice === null).length;
  const cover = due[0].tot > 0 ? revQ / due[0].tot : undefined;
  const W = 480;
  const H = 210;
  const pt = 28;
  const pb = 26;
  const col = (W - 20) / 8;
  const bw = col * 0.62;
  const Y = (v: number) => pt + (1 - v / max) * (H - pt - pb);
  return (
    <Card title={<Term id="ledger">Locked-in spending</Term>} home="ledger" id="ctl-ledger"
      right={<span className="legend2"><span><i style={{ background: '#6b7c91' }} /><Term id="firmCommit">firm</Term></span><span><i className="dash" /><Term id="cancellable">cancellable</Term></span><span><i style={{ background: C.good }} />revenue / q</span></span>}>
      <Tip as="div" content={() => <TipCard title={<Term id="ledger">Contracts</Term>} rows={[{ label: 'Contracts', value: String(rows.length) }, { label: 'Firm (take-or-pay)', value: String(firmN) }, ...(cover !== undefined ? [{ label: 'Revenue ÷ this quarter\'s payments', value: F.mult(cover) }] : [])]} />}><div className="dim small">{rows.length} contracts · {firmN} firm{cover !== undefined ? ` · revenue covers this quarter ${F.mult(cover)}` : ''}</div></Tip>
      <svg viewBox={`0 0 ${W} ${H}`} className="ledger2">
        <line x1={10} x2={W - 10} y1={revOff ? 16 : Y(revQ)} y2={revOff ? 16 : Y(revQ)} stroke={C.good} strokeDasharray="5 4" strokeWidth={1.4} />
        <text x={W - 10} y={(revOff ? 16 : Y(revQ)) - 5} textAnchor="end" className="ch-note good">revenue {F.money(revQ, { perQ: true })}{revOff ? ' · off scale ↑' : ''}</text>
        {due.map((d, i) => {
          const x = 10 + col * i + (col - bw) / 2;
          return (
            <Tip key={d.q} as="g" content={() => <TipCard title={qLabel(s, d.q)} value={F.money(d.tot)} rows={[{ label: <Term id="firmCommit">Firm</Term>, value: F.money(d.firm) }, { label: <Term id="cancellable">Cancellable</Term>, value: F.money(d.canc) }]} />}>
              <g>
                <rect x={x} y={Y(d.firm)} width={bw} height={Math.max(0, Y(0) - Y(d.firm))} rx={2} fill="#6b7c91" />
                {d.canc > 0 && <rect x={x + 0.5} y={Y(d.tot)} width={bw - 1} height={Math.max(0, Y(d.firm) - Y(d.tot))} rx={2} fill="rgba(107,124,145,.15)" stroke="#8a9bb0" strokeDasharray="3 2" />}
                <text x={x + bw / 2} y={Y(d.tot) - 4} textAnchor="middle" className="ch-ax">{d.tot > 0.005 ? F.short(d.tot) : ""}</text>
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" className="ch-ax">{i === 0 ? qLabel(s, d.q) : `+${i}q`}</text>
              </g>
            </Tip>
          );
        })}
      </svg>
      <div className="btn-row">
        <button className="btn btn-sm btn-ghost" data-test="show-contracts" onClick={() => setShow(!show)}>{show ? 'hide contracts' : 'show contracts'}</button>
        <span className="sp" />
        <ActBtn id="fin.renegotiate" label="Renegotiate" />
        <ActBtn id="fin.sellChips" params={{ qty: 0.2e6 }} label="Sell 200K chips" />
      </div>
      {show && (
        <table className="tbl fin-tbl">
          <thead><tr><th>Payee</th><th>Kind</th><th className="r">Per q</th><th>Ends</th><th>Cancel</th></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="ellip">{c.payee}</td><td><Term id={KIND_TERM[c.kind] ?? 'ledger'}>{KIND_LABEL[c.kind] ?? F.words(c.kind)}</Term></td><td className="num r"><Tip content={() => <TipCard title={c.payee} value={F.money(c.perQ, { perQ: true })} rows={[...(Math.abs(c.lastQ - c.perQ) > 0.005 ? [{ label: 'Last quarter', value: F.money(c.lastQ) }] : []), ...(c.startDay !== undefined && c.startDay > s.time.day ? [{ label: 'Starts', value: fmtMonth(dateOf(s, c.startDay)) }] : []), { label: 'Ends', value: fmtMonth(dateOf(s, c.endDay)) }]}>{Math.abs(c.lastQ - c.perQ) > 0.005 ? 'A firm contract on the expected path: each quarter pays that quarter\'s price.' : 'The same payment every quarter.'}</TipCard>}><span>{F.money(c.perQ)}{Math.abs(c.lastQ - c.perQ) > 0.005 ? ` → ${F.money(c.lastQ)}` : ''}</span></Tip></td><td className="num">{fmtMonth(dateOf(s, c.endDay))}</td>
                <td>{c.notice === null ? <span className="dim">firm</span> : <ActBtn id="fin.cancelContract" params={{ id: c.entry.id }} label={`Cancel · ${c.notice}q notice`} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ───────── board: seats and stances, what moves its mood, the next review (FIN3a, spec §7.3–§7.4) ─────────
const MOOD_ICON: Record<MoodSource, typeof ICON.board> = { results: ICON.milestone, setbacks: ICON.debt, behind: ICON.rival, incidents: ICON.incident };
const MOOD_TERM: Record<MoodSource, string> = { results: 'promise', setbacks: 'distress', behind: 'lead', incidents: 'incident' };
/** What each source is made of, for its tooltip (pre-multiplier sizes). */
function moodParts(s: GameStateV2, src: MoodSource): { label: string; value: string }[] {
  const k = moodWeight(s, src);
  const x = (base: number, per = '') => `${base > 0 ? '+' : '−'}${Math.abs(base)}${per} × ${k.toFixed(2)} = ${base * k > 0 ? '+' : '−'}${Math.abs(base * k).toFixed(1)}${per}`;
  if (src === 'results') return [{ label: 'Promise met', value: `${x(PROMISE_RESULT.metBoard)} × weight` }, { label: 'Missed by over 20%', value: `${x(PROMISE_RESULT.missBoard)} × weight` }];
  if (src === 'setbacks') return [{ label: 'Down round', value: x(MOOD_BASE.downRound) }, { label: 'Covenant breach', value: x(MOOD_BASE.covenantBreach) }, { label: 'Each review in distress', value: x(MOOD_BASE.distressQ) }, { label: 'Failed raise', value: x(MOOD_BASE.failedRaise) }, { label: 'Out of distress', value: x(MOOD_BASE.distressEnded) }];
  if (src === 'behind') return [{ label: 'Behind the best rival, each review', value: x(MOOD_BASE.behindQ) }, { label: 'Pausing frontier runs', value: x(MOOD_BASE.pause) }];
  return [{ label: 'Each public incident', value: `−${INCIDENT_BC.base} to −${INCIDENT_BC.max} by severity × ${k.toFixed(2)}` }, { label: 'At most a quarter', value: `−${INCIDENT_BC_CAP_Q} × ${k.toFixed(2)} = −${(INCIDENT_BC_CAP_Q * k).toFixed(1)}` }];
}

/** The four named sources (spec §7.4) with this board's multiplier and their sum over the last year; then the drift
 *  back to 60. */
function MoodSources({ s }: { s: GameStateV2 }) {
  const day = s.time.day;
  const sums: Record<MoodSource | 'fade' | 'other', number> = { results: 0, setbacks: 0, behind: 0, incidents: 0, fade: 0, other: 0 };
  for (const e of s.causes.byKey[canonicalKey('board.confidence')] ?? []) {
    if (e.day < day - 365) continue;
    const k = MOOD_SOURCE_OF[e.source] ?? (e.source === 'board memory fades' ? 'fade' : 'other');
    sums[k] += e.delta;
  }
  const max = Math.max(5, ...Object.values(sums).map(Math.abs));
  const seats = s.player.board.seats.filter((x) => x.weight > 0 && x.kind !== 'founder');
  const row = (key: string, icon: typeof ICON.board, label: ReactNode, mult: ReactNode, v: number, tip: () => ReactNode) => {
    const w = (Math.abs(v) / max) * 50;
    return (
      <Tip as="div" key={key} content={tip}>
        <div className="mood-row" data-mood={key}>
          <span className="row-i small"><IconOf I={icon} />{label}</span>
          <span className="mood-mult num">{mult}</span>
          <span className="cbar-track"><i style={{ left: v >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, background: v >= 0 ? 'var(--good)' : 'var(--bad)' }} /></span>
          <span className={`num small ${Math.round(v) > 0 ? 'tone-pos' : Math.round(v) < 0 ? 'tone-neg' : 'dim'}`}>{Math.round(v) === 0 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(Math.round(v))}`}</span>
        </div>
      </Tip>
    );
  };
  return (
    <div className="mood" data-test="mood-sources">
      <div className="tip-cap">What moves this board · last 12 months</div>
      {MOOD_SOURCES.map((src) => row(src, MOOD_ICON[src], <Term id={MOOD_TERM[src]}>{MOOD_LABEL[src]}</Term>, `×${moodWeight(s, src).toFixed(2)}`, sums[src], () => (
        <TipCard title={MOOD_LABEL[src]} value={`×${moodWeight(s, src).toFixed(2)} on this board`} rows={[
          ...moodParts(s, src),
          ...seats.map((x) => ({ label: `${x.holder} · ${SEAT[x.kind].label}`, value: `×${MOOD_WEIGHTS[src][x.kind]}${x.weight > 1 ? ` (${x.weight} votes)` : ''}` })),
          { label: 'Last 12 months', value: `${sums[src] >= 0 ? '+' : '−'}${Math.abs(sums[src]).toFixed(1)}`, tone: sums[src] < 0 ? 'neg' as const : 'pos' as const },
        ]}>{"This board's multiplier is the vote-weighted mean of its seats' weights for this kind of news (the CEO's seat does not count). See [[boardConf]]."}</TipCard>
      )))}
      {row('fade', ICON.board, 'Memory fades', `→ ${BC_ANCHOR}`, sums.fade + sums.other, () => (
        <TipCard title="Memory fades" value={`${Math.round(BC_REVERT_Q * 100)}% of the gap a quarter`} rows={[{ label: 'Drift back toward 60, 12 months', value: `${sums.fade >= 0 ? '+' : '−'}${Math.abs(sums.fade).toFixed(1)}` }, ...(Math.abs(sums.other) > 0.05 ? [{ label: 'Other (forced decisions, seating critics)', value: `${sums.other >= 0 ? '+' : '−'}${Math.abs(sums.other).toFixed(1)}` }] : [])]}>With no news the board drifts back toward 60, a tenth of the gap each quarter. Nothing else moves it.</TipCard>
      ))}
    </div>
  );
}
const IconOf = ({ I }: { I: typeof ICON.board }) => <I size={13} />;

/** FIN3b (spec §7.2): this preset's charter rights, each with what it blocks; the safety committee's row lists the
 *  models it is holding now. */
const RIGHT_ICON: Record<string, typeof ICON.board> = { safetyCommittee: ICON.safety, trust: ICON.exec, founderControl: ICON.you, nonprofitRemoval: ICON.board };
function CharterRights({ s }: { s: GameStateV2 }) {
  const rights = charterRights(s);
  const holds = charterHolds(s);
  return (
    <div className="charter" data-test="charter">
      <div className="tip-cap"><Term id="charter">Charter rights</Term></div>
      {!rights.length && <div className="dim small">None: the board acts only through its votes.</div>}
      {rights.map((r) => {
        const I = RIGHT_ICON[r.id] ?? ICON.locked;
        const held = r.id === 'safetyCommittee' ? holds : [];
        return (
          <Tip as="div" key={r.id} content={() => (
            <TipCard title={r.label} value={held.length ? <span className="tone-warn">holding {held.length}</span> : undefined} rows={[
              { label: 'Blocks', value: r.blocks },
              ...held.map((h) => ({ label: h.name, value: `held: ${h.reason}`, tone: 'neg' as const })),
              { label: 'Source', value: r.source },
            ]}>{"A hard right of this governance, not a vote: no confidence or force gets past it. See [[charter]]."}</TipCard>
          )}>
            <div className="charter-row" data-right={r.id}>
              <span className="row-i small"><I size={13} />{r.label}</span>
              <span className="dim small">{r.short}</span>
              {held.length > 0 ? <span className="tag2 warn" data-test="charter-held">holds {held.map((h) => h.name).join(', ')}</span> : <span />}
            </div>
          </Tip>
        );
      })}
    </div>
  );
}

/** FIN3b (spec §7.5): the next review and the ouster vote as it stands, seat by seat (no dice). */
function OusterReview({ s }: { s: GameStateV2 }) {
  const br = boardReview(s);
  if (br.division) return null;
  const v = br.vote;
  const g = v.grievance;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <Tip as="div" content={() => (
      <TipCard title={<Term id="ouster">Ouster vote</Term>} value={br.live ? <span className="tone-neg">held at the review · {v.yes} of {v.total}</span> : 'not held at the next review'} rows={[
        { label: 'Next review', value: fmtDate(br.date) },
        { label: <Term id="boardConf">Confidence</Term>, value: `${F.idx(br.bc)} · a vote needs under ${br.line} and a warning ${OUSTER_NOTICE_D} d old`, tone: br.bc < br.line ? 'neg' : 'neutral' },
        { label: 'Grievance (last 12 months)', value: `too slow ${pct(g.slow)} · too reckless ${pct(g.reckless)} · burning cash ${pct(g.burn)}` },
        { label: 'Reluctance', value: `${v.reluctance.toFixed(1)}${v.reluctance < OUSTER.reluctance ? ' (nonprofit board: removes a CEO more easily)' : ''}` },
        ...v.seats.map((x) => ({ label: `${x.holder} · ${SEAT_KIND_LABEL[x.kind]}${x.weight > 1 ? ` · ${x.weight} votes` : ''}`, value: `${x.yes ? 'yes' : 'no'} today · ${x.turnsBelow === undefined ? 'never turns' : x.turnsBelow >= br.line ? 'turns once a vote is held' : `turns below ${Math.round(x.turnsBelow)}`}`, tone: x.yes ? 'neg' as const : 'pos' as const })),
        { label: 'Passes', value: br.passesBelow === undefined ? 'never on this board and grievance' : `below confidence ${Math.round(br.passesBelow)}`, tone: br.passesBelow !== undefined && br.bc < br.passesBelow ? 'neg' : 'neutral' },
      ]} footer="Dashed red chip: votes to remove you. More than half the votes ends the game; your seat does not vote. No dice: this is the vote the board will cast.">
        {"Each seat leans by its stance against the grievance, plus how far confidence is below 25, minus its reluctance; yes above 0. See [[ouster]]."}
      </TipCard>
    )}>
      <div className="limit-row" data-test="board-review">
        <span className="dim small">Next review {fmtDate(br.date)} (in {br.inDays} d)</span>
        <span className="row-i">
          <span className={`vote-strip ${v.passes ? 'fail' : 'pass'}`} data-test="ouster-vote" data-live={br.live ? '1' : '0'} data-pass={v.passes ? '1' : '0'}>
            <span className="dim">ouster</span>
            {v.seats.map((x, i) => {
              const I = SEAT[x.kind].icon;
              return <span key={i} className={`vote-seat ${x.yes ? 'no' : 'yes'}`} data-vote={x.yes ? 'yes' : 'no'}><I size={11} />{x.weight > 1 && <i>×{x.weight}</i>}</span>;
            })}
            <b className={br.live ? 'tone-neg' : br.bc < BC_WARN ? 'tone-warn' : 'dim'}>{br.live ? `${v.yes}/${v.total} at the review` : br.passesBelow === undefined ? 'no majority' : `passes below ${Math.round(br.passesBelow)}`}</b>
          </span>
        </span>
      </div>
    </Tip>
  );
}

/** FIN3b (spec §7.5): give the critics a seat, shown while confidence is under the warning's clear line. */
function CriticsSeat({ s }: { s: GameStateV2 }) {
  if (isDivision(s) || s.player.board.confidence >= BC_CLEAR) return null;
  const c = criticsSide(s);
  return (
    <div className="btn-row" style={{ marginTop: 6 }}>
      <ActBtn id="fin.critics" label="Seat the critics" reason />
      <span className="dim small"><Term id="critics">{c.side === 'mission' ? 'a safety director' : 'an investor director'}</Term> · +{CRITICS.gain} now</span>
    </div>
  );
}

function BoardCard({ s }: { s: GameStateV2 }) {
  const b = s.player.board;
  return (
    <Card title={<Term id="boardSeat">Board</Term>} id="ctl-board" home="board"
      right={isDivision(s) ? <GoBtn to={{ panel: 'finance', anchor: 'parent' }} label={<Term id="parentConf">Parent confidence</Term>} testId="fin.go.parentConf" /> : <span className="row-i"><span className="dim small"><Term id="boardConf">confidence</Term></span><Why k="board.confidence" title="Board confidence" value={F.idx(b.confidence)} body={`See [[boardConf]]. Drifts toward ${BC_ANCHOR}; below 35 the board warns you, below 25 it votes on removing you at every review.`}><b className="num big" data-home="boardConf">{F.idx(b.confidence)}</b></Why></span>}>
      <div className="seats">
        {b.seats.map((x, i) => {
          const k = x.stance.reduce((m, v, j) => (Math.abs(v) > Math.abs(x.stance[m]) ? j : m), 0);
          const v = x.stance[k];
          const meta = SEAT[x.kind];
          const minds = x.kind === 'founder' ? 'your seat: votes yes, moves no mood' : MOOD_SOURCES.map((m) => `${MOOD_LABEL[m].split(' ').pop()} ×${MOOD_WEIGHTS[m][x.kind]}`).join(' · ');
          return (
            <Tip key={i} content={() => <TipCard title={x.holder} value={meta.label} rows={[...x.stance.map((sv, j) => ({ label: STANCE[j], value: sv > 0 ? 'for' : sv < 0 ? 'against' : 'neutral', tone: sv > 0 ? 'pos' as const : sv < 0 ? 'neg' as const : 'neutral' as const })), { label: 'Minds', value: minds }]} footer={x.weight > 1 ? `${x.weight} votes` : x.weight > 0 ? '1 vote' : 'observer: no vote'}>{"How this seat votes on major decisions ([[boardVote]]) and how much each kind of news moves it."}</TipCard>}>
              <div className="seat" data-seat={i}>
                <span className={`seat-av ${x.kind}`}><meta.icon size={16} />{x.weight > 1 && <i>×{x.weight}</i>}</span>
                <span className="seat-name">{x.holder}</span>
                <span className={`seat-st ${v > 0 ? 'tone-pos' : v < 0 ? 'tone-neg' : 'dim'}`}>{v === 0 ? 'neutral' : `${STANCE[k]} ${v > 0 ? '▲' : '▼'}`}</span>
              </div>
            </Tip>
          );
        })}
      </div>
      {!isDivision(s) && <CharterRights s={s} />}
      {!isDivision(s) && <MoodSources s={s} />}
      <OusterReview s={s} />
      <CriticsSeat s={s} />
      {(() => { const h = incidentBoardHit(s); return <div className="limit-row"><span className="dim small">Public incidents at the next review</span><Limit id="board.incidentCap" tone={h.raw > h.cap ? 'warn' : h.capped > 0 ? 'bind' : 'quiet'}>{h.capped > 0 ? `−${h.hit.toFixed(1)}` : 'none'}{h.raw > h.cap ? ` (${h.raw} capped at ${h.cap})` : ''} · max −{(h.cap * h.mult).toFixed(1)}/q</Limit></div>; })()}
      {/* Jank F4: the recap question exists only for the capped-profit nonprofit, until it is decided. */}
      {b.preset === 'legacyNonprofit' && s.player.finance.ws3?.recap.startDay === undefined && !s.player.finance.ws3?.recap.refused && (
        <div className="btn-row" style={{ marginTop: 8 }}>
          <ActBtn id="fin.recap" label={<Term id="recap">Recapitalise</Term>} />
          <ActBtn id="fin.refuseRecap" label="Refuse recap" />
        </div>
      )}
    </Card>
  );
}

// ───────── ownership donut ─────────
function Ownership({ s }: { s: GameStateV2 }) {
  const f = s.player.finance;
  const o = f.ownership;
  const strat = Object.values(o.strat).reduce((a, b) => a + b, 0);
  const parts = [
    { k: 'strat', label: `Strategic${Object.keys(o.strat).length ? ` (${Object.keys(o.strat).slice(0, 2).join(', ')})` : ''}`, v: strat, c: SPHERE.cap },
    { k: 'mission', label: 'Mission / nonprofit', v: o.mission, c: SPHERE.saf },
    { k: 'founder', label: 'Founders', v: o.founder, c: SPHERE.sec },
    { k: 'fin', label: 'Financial', v: o.fin, c: SPHERE.prod },
    { k: 'public', label: 'Public', v: o.public, c: C.neutral },
  ];
  const tot = parts.reduce((a, p) => a + p.v, 0) || 1;
  const R = 46;
  const r0 = 30;
  let a0 = -Math.PI / 2;
  const arc = (a: number, b: number) => {
    const p = (r: number, t: number) => `${60 + r * Math.cos(t)},${60 + r * Math.sin(t)}`;
    const big = b - a > Math.PI ? 1 : 0;
    return `M${p(R, a)} A${R},${R} 0 ${big} 1 ${p(R, b)} L${p(r0, b)} A${r0},${r0} 0 ${big} 0 ${p(r0, a)} Z`;
  };
  return (
    <Card title={<Term id="ownership">Who owns you</Term>} home="ownership"
      right={<span className="row-i small" data-ref="valuation"><span className="dim"><Term id="valuation">valuation</Term> in Story</span><GoBtn to={{ panel: 'finance', tab: 'story' }} label="Story" testId="fin.go.story" /></span>}>
      <div className="own">
        <svg viewBox="0 0 120 120" width={128} height={128}>
          {parts.filter((p) => p.v > 0).map((p) => {
            const a1 = a0 + (p.v / tot) * Math.PI * 2 - 0.0001;
            const d = arc(a0, a1);
            a0 = a1 + 0.0001;
            return <path key={p.k} d={d} fill={p.c} stroke={C.panel} strokeWidth={1.5} />;
          })}
        </svg>
        <div className="own-leg">
          {parts.filter((p) => p.v > 0 || p.k !== 'public').map((p) => <Tip as="div" key={p.k} content={() => <TipCard title={p.label} value={F.pct(p.v)}>Share of the company this group owns.</TipCard>}><div className="own-row"><i style={{ background: p.c }} /><span className="ellip">{p.label}</span><b className="num">{F.pct(p.v)}</b></div></Tip>)}
          {o.public <= 0 && <div className="dim small" style={{ marginTop: 4 }}>Not listed: no public holders (<Term id="ipo">IPO</Term> on the Raise card)</div>}
        </div>
      </div>
    </Card>
  );
}

// ───────── markets ─────────
function Markets({ s }: { s: GameStateV2 }) {
  const c = s.capital;
  return (
    <Card title="Markets" home="markets" sub="hype and the investor pool are in the Story card">
      <div className="mk-row"><ICON.alert size={14} className={c.bubbleX > 1.5 ? 'tone-warn' : ''} /><Term id="bubble">Bubble index</Term><span className="dim small">raises easier, crash risk rises</span><span className="sp" /><HBar v={c.bubbleX} max={3} w={90} color={C.watch} /><Tip content={() => <TipCard title={<Term id="bubble">Bubble index</Term>} value={c.bubbleX.toFixed(2)}>Above 1.5 a crash becomes likely.</TipCard>}><b className={`num ${c.bubbleX > 1.5 ? 'tone-warn' : ''}`}>{c.bubbleX.toFixed(2)}</b></Tip></div>
      <div className="mk-row"><ICON.debt size={14} /><Term id="rates">10y · SOFR</Term><span className="sp" /><Tip content={() => <TipCard title={<Term id="rates">Rates</Term>} rows={[{ label: '10-year Treasury', value: `${c.y10.toFixed(2)}%` }, { label: 'SOFR', value: `${c.sofr.toFixed(2)}%` }]}>Set the cost of your debt.</TipCard>}><b className="num">{c.y10.toFixed(2)}% · {c.sofr.toFixed(2)}%</b></Tip></div>
      <div className="mk-row"><ICON.milestone size={14} /><Term id="ipo">IPO window</Term><span className="sp" /><span className={`tag2 ${c.ipoWindow ? 'good' : ''}`}>{c.ipoWindow ? 'open' : 'closed'}</span></div>
      {c.busted && <div className="tone-neg small" style={{ marginTop: 6 }}>Bubble burst · recovers ≈ {fmtMonth(dateOf(s, c.busted.recoverDay))}</div>}
    </Card>
  );
}

// ───────── debt: capacity of each instrument and the rule behind it; the rating with its terms (FIN1, spec §3) ─────────
const LIMIT_OF: Partial<Record<Debt['kind'], string>> = { revolver: 'debt.creditLine', gpuTerm: 'debt.chipLoan', bond: 'debt.bond' };
function RatingTip({ s }: { s: GameStateV2 }) {
  const r = ratingTerms(s);
  const f = s.player.finance;
  return (
    <TipCard title={<Term id="rating">Credit rating</Term>} value={`${f.rating} · score ${r.z.toFixed(2)}`} rows={[
      { label: r.ocf !== undefined ? `Cash flow, last year ${F.money(r.ocf, { signed: true })}` : 'Cash flow (no quarter closed yet)', value: `+${r.cashFlow.toFixed(0)}`, tone: r.cashFlow > 0 ? 'pos' : 'neutral' },
      { label: `Liquidity ${F.money(r.liquidity)} ÷ fixed ${F.money(r.fixedQ)}/q`, value: `+${r.cover.toFixed(2)}`, tone: 'pos' },
      { label: `(Debt ${F.money(r.debt)} + 0.3 × commitments ${F.money(r.pvCommit)}) ÷ revenue`, value: `−${r.leverage.toFixed(2)}`, tone: r.leverage > 0.5 ? 'neg' : 'neutral' },
      ...(r.distress ? [{ label: <Term id="distress">Distress</Term>, value: '−2', tone: 'neg' as const }] : []),
    ]} footer="BBB ≥ 2 > BB ≥ 1 > B ≥ 0 > closed. Set at each quarter end.">Lenders and lessors price your cash flow, liquidity and leverage, never your valuation.</TipCard>
  );
}

function DebtCard({ s }: { s: GameStateV2 }) {
  const f = s.player.finance;
  const [dk, setDk] = useState<Debt['kind']>('revolver');
  const head = debtHeadroom(s, dk);
  const head0 = debtHeadroom(s, 'revolver');
  const [amtF, setAmtF] = useState(0.5);
  const drawAmt = Math.max(0.1, Math.round(head.max * amtF * 10) / 10);
  const lr = leaseRate(s);
  return (
    <Card title={<Term id="rating">Debt</Term>} home="debt"
      right={<span className="row-i small"><span className="dim"><Term id="rating">rating</Term></span><Tip content={() => <RatingTip s={s} />}><b className={`num ${f.rating === 'closed' ? 'tone-neg' : ''}`} data-test="rating">{f.rating}</b></Tip><Tip content={() => <TipCard title="Debt" rows={[{ label: 'Drawn', value: F.money(totalDebt(f)) }, { label: 'Interest', value: F.money(interestPerYear(s), { perYear: true }) }]}>Interest is part of payroll & ops in the cash flow.</TipCard>}><span className="row-i"><span className="dim">· drawn</span><b className="num">{F.money(totalDebt(f))}</b><span className="dim">· interest</span><b className="num">{F.money(interestPerYear(s), { perYear: true })}</b></span></Tip></span>}>
      {(() => {
        const r = ratingTerms(s);
        const parts = [{ k: 'cash flow', v: r.cashFlow }, { k: 'liquidity', v: r.cover }, { k: 'leverage', v: -r.leverage }, ...(r.distress ? [{ k: 'distress', v: -r.distress }] : [])];
        return (
          <Tip content={() => <RatingTip s={s} />}>
            <div className="limit-row" data-test="rating-terms"><span className="dim small">score {r.z.toFixed(2)} =</span><span className="small">{parts.map((x) => `${x.v >= 0 ? '+' : '−'}${Math.abs(x.v).toFixed(1)} ${x.k}`).join(' ')}</span></div>
          </Tip>
        );
      })()}
      {f.debts.length > 0 && (
        <table className="tbl fin-tbl">
          <thead><tr><th>Kind</th><th className="r">Drawn / limit</th><th className="r">Rate</th><th><Term id="covenant">Covenant</Term></th><th /></tr></thead>
          <tbody>
            {f.debts.map((d) => (
              <tr key={d.id}>
                <td><Term id={d.kind}>{DEBT_KINDS.find((k) => k.id === d.kind)?.label ?? d.kind}</Term></td>
                <td className="num r">{(() => {
                  // FIN6c: the credit line tells one story with its tile's room: as arranged → the size it takes when you next borrow.
                  const resized = d.kind === 'revolver' && !head0.closed && Math.abs(head0.limit - d.principal) > 0.05 ? head0.limit : undefined;
                  return (
                    <Tip content={() => <TipCard title="Drawn / limit" rows={[{ label: 'Drawn', value: F.money(d.drawn) }, { label: d.kind === 'revolver' ? 'Line as arranged' : 'Principal', value: F.money(d.principal) }, ...(resized !== undefined ? [{ label: 'When you next borrow', value: F.money(resized) }] : [])]}>{d.kind === 'revolver' ? `The line counts in liquidity as arranged; it is re-sized to ${Math.round(DEBT_SIZING.lineShareOfV * 100)}% of valuation (cap $${DEBT_SIZING.lineCap}B) when you next borrow on it or close a round, so the room on its tile is the re-sized line less what is drawn.` : d.kind === 'assumed' ? 'Debt that came with a lab you bought (what it was short), now yours.' : 'Amount borrowed on this tranche.'}</TipCard>}><span>{F.money(d.drawn)} / {F.money(d.principal)}{resized !== undefined && <span className="dim"> → {F.money(resized)}</span>}</span></Tip>
                  );
                })()}</td>
                <td className="num r"><Tip content={() => <TipCard title="Interest rate" value={`${debtRatePct(s, d).toFixed(1)}%`}>{d.kind === 'revolver' ? 'Per year on the drawn amount; floats with your rating.' : 'Per year on the drawn amount; priced at your rating when drawn.'}</TipCard>}><span>{debtRatePct(s, d).toFixed(1)}%</span></Tip></td>
                <td className="dim">{d.covenant ?? '—'}</td>
                <td className="r">{d.drawn > 0 && <ActBtn id="fin.repayDebt" params={{ id: d.id, amount: d.drawn }} label="Repay" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="dk-tiles">
        {DEBT_KINDS.filter((k) => k.id !== 'assumed').map((k) => {
          const h = debtHeadroom(s, k.id);
          return (
            <Tip key={k.id} content={() => <TipCard title={<Term id={k.id}>{k.label}</Term>} value={`${F.money(h.max)} room`} rows={[{ label: 'Limit', value: F.money(h.limit) }, { label: 'Rule', value: h.why }, { label: 'Rate now', value: `${newDebtRatePct(s, k.id).toFixed(1)}%` }]}>{k.blurb}</TipCard>}>
              <button className={`otile ${dk === k.id ? 'on' : ''}`} data-debt-kind={k.id} onClick={() => setDk(k.id)}>
                <span className="otile-top">{k.label}</span>
                <span className="otile-gl"><Limit id={LIMIT_OF[k.id] ?? 'debt.creditLine'} tone={h.closed ? 'bind' : 'quiet'}>{F.money(h.max)} room</Limit></span>
              </button>
            </Tip>
          );
        })}
      </div>
      <div className="fin-row">
        <Tip content={() => <TipCard title={DEBT_KINDS.find((k) => k.id === dk)?.label} rows={[{ label: 'Limit', value: F.money(head.limit) }, { label: 'Room', value: F.money(head.max) }]}>{head.why}</TipCard>}><span className={`small ${head.closed ? 'tone-neg' : 'dim'}`}>{head.closed ? head.why : `${head.why}: ${F.money(head.limit)}`}</span></Tip>
        <HBar v={drawAmt} max={Math.max(1e-6, head.max)} w={120} h={8} color={C.you} />
        <input className="slider" type="range" min={0.05} max={1} step={0.05} value={amtF} onChange={(e) => setAmtF(Number(e.target.value))} style={{ width: 110 }} />
        <span className="sp" />
        <ActBtn id="fin.drawDebt" params={{ kind: dk, amount: drawAmt }} label={`Borrow ${F.money(drawAmt)}`} icon={ICON.debt} anchor="borrow" reason />
      </div>
      <Tip content={() => <TipCard title={<Term id="spv">Leases</Term>} rows={[
        { label: 'Lessor return now', value: lr !== undefined ? `${F.pct(lr)} at ${f.rating}` : `none at ${f.rating}` },
      ]}>Payment options for sites and chips are on the Compute build and buy cards. Their residual-value guarantees are in What we owe.</TipCard>}>
        <div className="limit-row" data-test="lease-terms"><span className="dim small"><Term id="spv">Leases</Term> {lr !== undefined ? `at ${F.pct(lr)}` : 'closed'}</span><GoBtn to={{ panel: 'finance', tab: 'owe' }} label="Guarantees" testId="fin.go.guarantees" /></div>
      </Tip>
      {f.covenantBreachDay !== undefined && <div className="tone-neg small"><Term id="covenant">Covenant</Term> breached since {fmtDate(dateOf(s, f.covenantBreachDay))}</div>}
    </Card>
  );
}

// ───────── partners (FINANCE-V3 §6; FIN4a): one offer per partner, every term and string shown before you sign ─────────
const KIND_ICON: Record<PartnerKind, typeof ICON.cloud> = { hyperscaler: ICON.cloud, chipVendor: ICON.compute, sovereign: ICON.world };
const SUPPLY_SHORT: Record<PartnerSupply, string> = { cloud: 'Cloud', asic: 'Custom chips', chips: 'Its chips' };

/** One partner's line in the list: signed, a holder from before the start, an offer, or why not. */
function partnerStatus(s: GameStateV2, partner: string, blocked?: string): { text: string; tone: string; tip: string } {
  const d = dealWith(s, partner);
  if (d) return { text: d.rescue ? 'rescued you' : `since ${qLabel(s, qOf(s, d.day))}`, tone: 'tone-pos', tip: `Signed ${fmtDate(dateOf(s, d.day))}. One deal per partner.` };
  const stake = s.player.finance.ownership.strat[partner] ?? 0;
  if (blocked) return { text: stake > 0 ? `holds ${F.pct(stake)}` : 'unavailable', tone: 'dim', tip: blocked };
  return { text: 'offer', tone: '', tip: 'Terms below, priced today. Sign to book them.' };
}

/** A signed deal: what still runs. Its tranche conditions live in What we owe, its payments in Contracts (one home). */
function SignedDeal({ s, d }: { s: GameStateV2; d: StrategicDeal }) {
  const live = s.player.finance.tranches.filter((t) => t.partner === d.partner);
  return (
    <div className="pt-terms" data-test="partner-signed">
      <div className="fin-row small"><Tip content={() => <TipCard title="Equity in" rows={[{ label: 'At signing', value: F.money(d.equityNow) }, { label: 'In tranches', value: F.money(d.equityLater) }, { label: 'Stake now', value: F.pct(s.player.finance.ownership.strat[d.partner] ?? 0) }]}>{d.legacy ? 'A holder from before the start.' : 'Tranches land on their conditions at that day\'s valuation.'}</TipCard>}><span>Equity <b className="num">{F.money(d.equityNow)}</b> now · <b className="num">{F.money(d.equityLater)}</b> in tranches</span></Tip>
        {live.length > 0 && <GoBtn to={{ panel: 'finance', tab: 'owe' }} label={`${live.length} tranche${live.length > 1 ? 's' : ''} pending`} testId="fin.go.partnerTranches" />}</div>
      {d.supply && <div className="fin-row small"><Tip content={() => <TipCard title={SUPPLY_SHORT[d.supply!.kind]} rows={[{ label: 'Take-or-pay', value: F.money(d.supply!.total) }, { label: 'Ends', value: fmtDate(dateOf(s, d.supply!.endDay ?? d.until)) }]}>Payments are in the Contracts tab.</TipCard>}><span>{SUPPLY_SHORT[d.supply.kind]} · <b className="num">{F.money(d.supply.total)}</b> take-or-pay to {fmtDate(dateOf(s, d.supply.endDay ?? d.until))}</span></Tip><GoBtn to={{ panel: 'finance', tab: 'contracts' }} label="Contracts" testId="fin.go.partnerContracts" /></div>}
      <div className="pills"><Strings s={s} partner={d.partner} strings={d.strings} years={Math.max(0, Math.round((d.until - s.time.day) / 365))} ipName={partnerCosts(s).find((c) => c.partner === d.partner)?.ip?.labName} /></div>
    </div>
  );
}

/** The strings of a deal as pills (each explains itself on hover). `ipName`: the affiliated lab an IP-access string
 *  licenses to (FIN4b). */
function Strings({ s, partner, strings, years, politics, asic, ipName }: { s: GameStateV2; partner: string; strings: PartnerTerms['strings']; years: number; politics?: PartnerTerms['politics']; asic?: boolean; ipName?: string }) {
  const rivals = partnerDef(partner)?.competitors ?? [];
  const ip = strings.ipAccess;
  return (
    <>
      {strings.exclusivity && <Pill kind="bad" title={`No deals with ${rivals.join(', ') || 'its competitors'} for good (exclusivity).`}>exclusive</Pill>}
      {ip && <Pill kind="bad" title={`${ipName ?? ip.lab}, ${partner}'s in-house lab, licenses your models while the deal runs: it closes about ${F.pct(PARTNER_TERMS.strings.ipCloseYr)} of your capability lead a year.${s.player.board.preset === 'pbcTrust' && !ip.trust ? ' Capability-threshold models stay out of the licence (the trust did not approve them).' : ''}`}>IP access · {ipName ?? ip.lab}</Pill>}
      {strings.revenueShare !== undefined && strings.revenueShare > 0 && <Pill kind="cost" title={`${F.pct(strings.revenueShare)} of revenue to ${partner} while the deal runs: about ${F.money(strings.revenueShare * s.player.finance.revenueRun, { perYear: true })} at today's run-rate.`}>revenue share {F.pct(strings.revenueShare)} · {years} y</Pill>}
      {strings.boardVotes !== undefined && strings.boardVotes > 0 && <Pill kind="bad" title={`${partner} holds a board seat with ${strings.boardVotes} votes.`}>board seat · {strings.boardVotes} votes</Pill>}
      {politics && <Pill kind="bad" title={`Foreign money: government security demand +${politics.securityDemand}.`}>Washington notices</Pill>}
      {asic && <Pill kind="cost" title={`Moving to custom chips slows research ${F.pct(1 - PARTNER_TERMS.asic.researchMult)} for about ${(PARTNER_TERMS.asic.migrationDays / 91).toFixed(1)} quarters.`}>research −{F.pct(1 - PARTNER_TERMS.asic.researchMult)} while migrating</Pill>}
    </>
  );
}

/** The optional strings of an offer (FIN4b): exclusivity (more money, its competitor blocked) and, for a hyperscaler
 *  with an in-house lab, IP access (more money, the lab closes on your lead). Each option shows what it adds; a string
 *  not on offer is locked with the reason. */
function OfferStrings({ s, t, choice, setChoice }: { s: GameStateV2; t: PartnerTerms; choice: PartnerChoice; setChoice: (c: PartnerChoice) => void }) {
  if (t.kind === 'sovereign') return null;
  const ex = t.options.exclusive;
  const ip = t.options.ipAccess;
  const rivals = partnerDef(t.partner)?.competitors ?? [];
  const lead = ip.lab ? leadEstimate(s, ip.lab) : 0;
  const days = PARTNER_TERMS.strings.ipCloseYr * Math.max(0, lead);
  return (
    <>
      <div className="fin-row" data-test="partner-strings">
        <Tip content={() => <TipCard title={<Term id="exclusivity">Exclusivity</Term>} value={ex.blocked ? 'not on offer' : `+${F.money(ex.bump)}`} rows={[{ label: 'Adds', value: F.money(ex.bump) }, { label: 'Blocks', value: rivals.join(', ') || '—' }]}>{ex.blocked ?? `${ex.bump < 0.05 ? (t.kind === 'hyperscaler' ? 'Its stake is at its cap, so exclusivity adds no money now. ' : 'Exclusivity adds no money at what you deploy today. ') : ''}${t.partner} pays ${F.pct(PARTNER_TERMS.strings.exclusiveBump)} more to be your only ${PARTNER_KINDS[t.kind].label.toLowerCase()}: no deals with ${rivals.join(', ')} for good. Open, you may sign both, each for less.`}</TipCard>}><span className="dim small">Exclusivity</span></Tip>
        <Seg value={ex.on ? 'yes' : 'no'} testId="partner-exclusive" options={[{ v: 'no', label: 'Open', tip: `No exclusivity: ${rivals.join(', ')} stays open to you` }, { v: 'yes', label: ex.blocked ? 'Exclusive' : ex.bump >= 0.05 ? `Exclusive +${F.money(ex.bump)}` : 'Exclusive · no more money', tip: `Blocks ${rivals.join(', ')} for good`, ...(ex.blocked ? { locked: ex.blocked } : {}) }]} onChange={(v) => setChoice({ ...choice, exclusive: v === 'yes' })} />
      </div>
      {t.kind === 'hyperscaler' && (
        <div className="fin-row" data-test="partner-ip">
          <Tip content={() => <TipCard title={<Term id="ipAccess">IP access</Term>} value={ip.blocked ? 'not on offer' : `+${F.money(ip.bump)}`} rows={ip.blocked ? [] : [{ label: 'Adds', value: F.money(ip.bump) }, { label: 'Licensed to', value: ip.labName ?? '—' }, { label: 'Your lead (est.)', value: F.days(lead) }, { label: 'Closes a year', value: `≈${F.days(days)}` }]}>{ip.blocked ?? `${ip.labName}, ${t.partner}'s in-house lab, licenses your models for ${t.years} years and closes about ${F.pct(PARTNER_TERMS.strings.ipCloseYr)} of your capability lead a year.${s.player.board.preset === 'pbcTrust' ? ' The trust votes on licensing a capability-threshold model.' : ''}`}</TipCard>}><span className="dim small">IP access</span></Tip>
          <Seg value={ip.on ? 'yes' : 'no'} testId="partner-ipaccess" options={[{ v: 'no', label: 'Keep IP' }, { v: 'yes', label: ip.blocked ? 'License' : ip.bump >= 0.05 ? `License +${F.money(ip.bump)}` : 'License · no more money', ...(ip.blocked ? { locked: ip.blocked } : {}) }]} onChange={(v) => setChoice({ ...choice, ipAccess: v === 'yes' })} />
        </div>
      )}
      {ip.on && <Tip as="div" content={() => <TipCard title={<Term id="ipAccess">IP access</Term>} value={`≈${F.days(days)} a year`} rows={[{ label: 'Your lead (est.)', value: F.days(lead) }, { label: 'Closed a year', value: F.pct(PARTNER_TERMS.strings.ipCloseYr) }, { label: 'For', value: `${t.years} y` }]}>{`${ip.labName} learns from your models: it closes about ${F.pct(PARTNER_TERMS.strings.ipCloseYr)} of the gap between your best model and its own each year, while the deal runs. Your lead is the intel estimate.`}</TipCard>}><div className="small tone-neg" data-test="partner-ip-cost">{ip.labName} closes ~{F.pct(PARTNER_TERMS.strings.ipCloseYr)} of your lead a year{lead > 0 ? ` · ≈${F.days(days)} of your ${F.days(lead)}` : ' · you are not ahead of it now'}</div></Tip>}
    </>
  );
}

/** An open offer: equity, tranches with their conditions, the supply on the expected path with both discounts, the
 *  optional strings, the strings, then Sign (with the board's or trust's vote when it needs one). */
function PartnerOffer({ s, o, choice, setChoice }: { s: GameStateV2; o: ReturnType<typeof partnerOffers>[number]; choice: PartnerChoice; setChoice: (c: PartnerChoice) => void }) {
  const t = o.terms!;
  const V = Math.max(10, s.player.finance.valuation);
  const eq = termsEquity(t);
  const stake0 = s.player.finance.ownership.strat[o.partner] ?? 0;
  const stake = (stake0 * V + eq) / (V + eq);
  const sp = t.supply;
  return (
    <div className="pt-terms" data-test="partner-terms">
      {o.supply.length > 1 && <div className="fin-row"><span className="dim small">Supply</span><Seg value={choice.supply ?? o.supply[0]} options={o.supply.map((x) => ({ v: x, label: SUPPLY_SHORT[x] }))} onChange={(v) => setChoice({ ...choice, supply: v })} testId="partner-supply" /></div>}
      <OfferStrings s={s} t={t} choice={choice} setChoice={setChoice} />
      {eq > 0 && (
        <div className="fin-row small" data-test="partner-equity">
          <Tip content={() => <TipCard title="Equity" value={F.money(eq)} rows={[{ label: 'Now', value: F.money(t.equityNow) }, ...t.tranches.map((x, i) => ({ label: `Tranche ${i + 1 + (t.equityNow > 0 ? 1 : 0)}`, value: F.money(x.amount) })), ...(t.options.exclusive.on ? [{ label: 'Of which exclusivity', value: F.money(t.options.exclusive.bump) }] : []), ...(t.options.ipAccess.on ? [{ label: 'Of which IP access', value: F.money(t.options.ipAccess.bump) }] : []), { label: `${o.partner}'s stake after`, value: F.pct(stake) }, ...(t.stakeCap ? [{ label: 'Stake cap', value: F.pct(t.stakeCap) }] : [])]}>{t.kind === 'hyperscaler' ? 'Non-voting shares at today\'s valuation; no board seat. A tranche lands at that day\'s valuation, only up to the cap.' : 'Shares at today\'s valuation; a tranche lands at that day\'s valuation.'}</TipCard>}>
            <span><Term id="deal">Equity</Term> <b className="num">{F.money(t.equityNow)}</b> now{t.tranches.length ? <> + <b className="num">{F.money(t.tranches.reduce((a, x) => a + x.amount, 0))}</b> in {t.tranches.length} tranches</> : null} · stake → {F.pct(stake)}</span>
          </Tip>
        </div>
      )}
      {t.tranches.map((x, i) => (
        <Tip as="div" key={i} content={() => <TipCard title={<Term id="trancheCondition">Tranche condition</Term>} value={F.money(x.amount)} rows={[{ label: 'Condition', value: conditionWords(x.condition) }, { label: 'Due', value: fmtDate(dateOf(s, x.dueDay)) }, { label: 'Lapses', value: fmtDate(dateOf(s, x.deadline)) }]}>Contractual: missed by the deadline, it lapses. After signing it shows in What we owe.</TipCard>}>
          <div className="pt-tranche small" data-tranche-offer={i}><ICON.commitment size={12} /><span className="num">{F.money(x.amount)}</span><span className="dim">if {conditionWords(x.condition)} by {qLabel(s, qOf(s, x.deadline))}</span></div>
        </Tip>
      ))}
      {sp && (
        <div className="fin-row small" data-test="partner-supply-terms">
          <Tip content={() => <TipCard title={SUPPLY_SHORT[sp.kind]} value={sp.kind === 'cloud' ? `${F.count(sp.h100e)} H100e` : `${F.count(sp.h100e)} H100e a quarter`} rows={[
            { label: 'Term', value: `${sp.quarters} quarters from ${qLabel(s, sp.startQ)}` },
            { label: <Term id="firmDiscount">Firm discount</Term>, value: `−${F.pct(sp.firmDiscount)}` },
            ...(sp.partnerDiscount > 0 ? [{ label: 'Partner discount', value: `−${F.pct(sp.partnerDiscount)}` }] : []),
            ...(sp.costMult !== undefined ? [{ label: 'Custom-chip cost', value: `${F.pct(sp.costMult)} of an H100e` }] : []),
            { label: 'First year', value: F.money(sp.perQ.slice(0, 4).reduce((a, b) => a + b, 0)) },
            { label: <Term id="firmCommit">Take-or-pay</Term>, value: F.money(sp.total) },
            ...(sp.prepaid ? [{ label: <Term id="supplierTerms">Prepaid at signing</Term>, value: F.money(sp.prepaid) }] : []),
          ]}>{sp.kind === 'cloud' ? 'Cloud capacity from next quarter, served first in a shortage, paid each quarter on the expected cloud price less both discounts.' : sp.kind === 'asic' ? 'Custom chips every quarter from a separate supply pool (outside rationing), priced on the expected list path.' : `Its chips every quarter, priced on the expected list path; while it supplies, every chip order gets +${MARKET.rationW.strategic} allocation weight.`}</TipCard>}>
            <span>{sp.kind === 'cloud' ? <><b className="num">{F.count(sp.h100e)}</b> H100e cloud · {sp.quarters / 4} y</> : <><b className="num">{F.count(sp.h100e)}</b> H100e a quarter × {sp.quarters}</>} · −{F.pct(sp.firmDiscount)} firm{sp.partnerDiscount > 0 ? ` −${F.pct(sp.partnerDiscount)} partner` : ''}{sp.costMult !== undefined ? ` · ${F.pct(sp.costMult)} of H100e cost` : ''}</span>
          </Tip>
          <PathCurve s={s} prices={sp.prices} unit="$" discount={sp.firmDiscount} firstQ={sp.startQ} />
          <Pill kind="cost" title="Every take-or-pay payment over the term, on the expected path. Owed whatever happens.">take-or-pay {F.money(sp.total)}</Pill>
          {sp.prepaid ? <Pill kind="cost" title="Supplier terms: a lab with a small share of investor money or a short runway prepays part of the first delivery at signing (part of the take-or-pay total).">prepay {F.money(sp.prepaid)} now</Pill> : null}
        </div>
      )}
      <div className="pills"><Strings s={s} partner={o.partner} strings={t.strings} years={t.years} politics={t.politics} asic={sp?.kind === 'asic'} ipName={t.options.ipAccess.labName} />{t.kind === 'sovereign' && <Pill kind="neu" title="A passive cheque: no seat, no supply, no strings beyond the politics.">passive</Pill>}</div>
      <div className="btn-row"><ActBtn id="fin.partner" params={{ partner: o.partner, ...(choice.supply ? { supply: choice.supply } : {}), exclusive: !!t.options.exclusive.on, ipAccess: !!t.options.ipAccess.on }} label={`Sign with ${o.partner}`} primary icon={ICON.relations} anchor="partner" reason /></div>
    </div>
  );
}

/** What each partner costs you now (FIN4b): revenue share a year, the lead its IP access closes, the partners its
 *  exclusivity blocks. Home of these running costs; take-or-pay payments live in Contracts. */
function PartnerCosts({ s }: { s: GameStateV2 }) {
  const rows = partnerCosts(s);
  if (!rows.length) return null;
  return (
    <div className="pt-costs" data-test="partner-costs">
      {rows.map((r) => (
        <div key={r.partner} className="pt-cost small" data-partner-cost={r.partner}>
          <b>{r.partner}</b><span className="sp" />
          {r.revenueShare > 0 && <Pill kind="cost" title={`The revenue share at today's run-rate, while the deal runs.`}>{F.money(r.revenueShare, { perYear: true })} revenue</Pill>}
          {r.ip && <Pill kind="bad" title={`IP access: ${r.ip.labName} licenses your models and closes about ${F.pct(PARTNER_TERMS.strings.ipCloseYr)} of your lead a year: ≈${F.days(r.ip.daysYr)} a year at your estimated ${F.days(r.ip.leadEst)} lead.${r.ip.noThreshold ? ' Capability-threshold models stay out of the licence.' : ''}`}>{r.ip.labName} −{F.days(r.ip.daysYr)}/yr</Pill>}
          {r.blocks.length > 0 && <Pill kind="neu" title={`Exclusivity: no deals with ${r.blocks.join(', ')} for good.`}>blocks {r.blocks.join(', ')}</Pill>}
          {r.revenueShare <= 0 && !r.ip && !r.blocks.length && <span className="dim">no running strings</span>}
        </div>
      ))}
    </div>
  );
}

function Partners({ s }: { s: GameStateV2 }) {
  const [choice, setChoiceMap] = useState<Partial<Record<string, PartnerChoice>>>({});
  const offers = partnerOffers(s, choice);
  const [sel, setSel] = useState<string>(() => offers.find((o) => !o.blocked)?.partner ?? offers[0].partner);
  const cur = offers.find((o) => o.partner === sel) ?? offers[0];
  const n = partnersNow(s).length;
  const max = PARTNER_TERMS.strings.maxPartners;
  const d = dealWith(s, cur.partner);
  return (
    <Card title={<Term id="deal">Partners</Term>} home="partners" right={<Tip content={() => <TipCard title="Partners" value={`${n} of ${max}`}>{`At most ${max} partners at once; a deal counts from signing (stakes from before the start do not). One deep partner (exclusivity: ${F.pct(PARTNER_TERMS.strings.exclusiveBump)} more money, its competitor blocked) or several shallow ones (independence, less money each). Hyperscalers: non-voting equity (stake ≤ 15%) and cloud or custom chips for a take-or-pay commitment. Chip vendors: equity per GW you deploy for buying their chips. Sovereigns: a passive cheque with a political cost.`}</TipCard>}><span className="dim small" data-test="partner-count">{n} of {max} partners</span></Tip>}>
      <Gate s={s} k="deals">
        <PartnerCosts s={s} />
        <div className="pt-list">
          {offers.map((o) => {
            const st = partnerStatus(s, o.partner, o.blocked);
            const I = KIND_ICON[o.kind];
            return (
              <Tip key={o.partner} as="div" content={() => <TipCard title={o.partner} value={PARTNER_KINDS[o.kind].label} rows={[{ label: 'Gives', value: PARTNER_KINDS[o.kind].gives }, { label: 'Wants', value: PARTNER_KINDS[o.kind].wants }]}>{st.tip}</TipCard>}>
                <button className={`pt-row ${o.partner === cur.partner ? 'on' : ''}`} data-partner={o.partner} data-blocked={o.blocked ? '1' : '0'} onClick={() => setSel(o.partner)}>
                  <I size={13} /><b>{o.partner}</b><span className="dim small">{PARTNER_KINDS[o.kind].label}</span><span className="sp" /><span className={`small ${st.tone}`}>{st.text}</span>
                </button>
              </Tip>
            );
          })}
        </div>
        <div className="offer2" data-partner-detail={cur.partner}>
          <div className="row-i small"><b style={{ whiteSpace: 'nowrap' }}>{cur.partner}</b><span className="dim">gives {PARTNER_KINDS[cur.kind].gives}; wants {PARTNER_KINDS[cur.kind].wants}</span></div>
          {d ? <SignedDeal s={s} d={d} /> : cur.blocked ? <div className="tone-neg small" data-test="partner-blocked">{cur.blocked}</div> : <PartnerOffer s={s} o={cur} choice={choice[cur.partner] ?? {}} setChoice={(c) => setChoiceMap({ ...choice, [cur.partner]: c })} />}
        </div>
      </Gate>
    </Card>
  );
}

/** What we owe tab badge: promises behind plus covenants near or breached (the Watch alert's count). */
function oweBadge(s: GameStateV2): number {
  const o = whatWeOwe(s);
  return o.behind.length + o.near.length;
}

export function Finance({ s }: { s: GameStateV2 }) {
  const f = s.player.finance;
  const dLeft = Math.max(0, nextQDay(s) - s.time.day);
  const division = isDivision(s);
  // Jank F3: first glance = cash flow, cash history and the raise (or the parent budget); the rest on tabs.
  const tab0 = tabOf('finance', 'cash');
  const tab = division && (tab0 === 'deals' || tab0 === 'story') ? 'cash' : tab0; // a division has no debt or partners (FIN5c: its goals are in What we owe)
  return (
    <div className="panel-v2 fin" data-panel="finance">
      <PanelHead icon={ICON.finance} title="Finance" sub={`per quarter unless marked · ${qLabel(s, qOf(s) + 1)} starts in ${dLeft} d`}
        tabs={<Tabs panel="finance" def="cash" tabs={[
          { id: 'cash', label: 'Cash', icon: ICON.cash },
          ...(division ? [] : [{ id: 'story', label: 'Story', icon: ICON.valuation }]),
          { id: 'owe', label: 'What we owe', icon: ICON.commitment, badge: oweBadge(s) },
          { id: 'contracts', label: 'Contracts', icon: ICON.commitment },
          { id: 'owners', label: division ? 'Board' : 'Board & owners', icon: ICON.board },
          ...(division ? [] : [{ id: 'deals', label: 'Debt & partners', icon: ICON.debt }]),
        ]} />}
        right={division ? undefined : <div className="btn-row"><GoBtn to={{ panel: 'finance', anchor: 'raise' }} label="Raise" testId="fin.go.raise" /><GoBtn to={{ panel: 'finance', anchor: 'partner' }} label="Partners" testId="fin.go.partner" /><GoBtn to={{ panel: 'finance', anchor: 'borrow' }} label="Borrow" testId="fin.go.borrow" /></div>} />
      {tab === 'cash' && <>
      <div className="fin-top">
        <Card title={<Term id="netBurn">Cash flow this quarter</Term>} sub="$ per quarter · hover a bar for its lines"
          right={<span className="row-i small"><Why k="revenueRun" title="Revenue run-rate" value={F.money(f.revenueRun, { perYear: true })} fmt={(x) => F.money(x)} levers={<GoBtn to={{ panel: 'products' }} label="Products" />}><span className="dim"><Term id="revenueRun">revenue</Term>{division ? ' goes to the parent' : ''} · in the top strip</span></Why></span>}>
          <Waterfall s={s} />
        </Card>
        <Card title="Cash history" sub={s.series.day.length > 1 ? 'weekly · current cash is in the top strip' : 'weekly from the first week · the projection starts today'}
          right={<span className="legend2"><span><i style={{ background: '#c9d4e2' }} />actual</span><span><i style={{ background: C.watch }} />{division ? 'budget as set' : 'no new money'}</span>{f.ws3.pendingRound && <span><i style={{ background: C.good }} />with pending round</span>}{divisionAdvance(s) && <span data-test="legend-advance"><i style={{ background: C.watch, opacity: 0.35 }} /><Term id="parentAdvance">below $0: advance</Term></span>}</span>}>
          <CashHistory s={s} />
        </Card>
      </div>
      <div className="g2">
        {division ? <ParentBudget s={s} /> : <RaiseCard s={s} />}
        <Card title="Why cash moved · 30 d" sub="every booked inflow and outflow, summed per source · ×N = days it moved" home="cashCauses">
          <CauseBars s={s} k="cash" fmt={(x) => F.money(x)} />
        </Card>
      </div>
      </>}
      {tab === 'story' && !division && <div className="fin-story"><StoryCard s={s} /><Markets s={s} /></div>}
      {tab === 'owe' && <div className="g2"><OweCard s={s} /></div>}
      {tab === 'contracts' && <div className="g2"><LockedIn s={s} /></div>}
      {tab === 'owners' && (
        <div className="g2">
          <BoardCard s={s} />
          {!division && <Ownership s={s} />}
        </div>
      )}
      {tab === 'deals' && !division && (
        <div className="g2">
          <DebtCard s={s} />
          <Partners s={s} />
        </div>
      )}
    </div>
  );
}
