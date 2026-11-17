// Finance (IA.md L2; PROPOSALS §5): HOME of burn by category and net burn (waterfall), revenue run-rate, cash history,
// raise ceiling and ask, the commitment ledger, board, ownership, valuation, markets, debt and deals. Cash and runway
// live in the top strip (L0) and are never repeated here.
import { useState } from 'react';
import {
  actionView, dateOf, dayOfQuarter, dealMenu, dealPreview, debtHeadroom, debtRatePct, fmtDate, fmtMonth, incidentBoardHit, interestPerYear, ledgerDue, liveLedger,
  parentSchedule, parentYear, payrollOf, qOf, raiseCeiling, runwayOf, totalDebt, DIVISION_REASON,
} from '../../../engine/v2';
import { isDivision } from '../../../data/v2/starts';
import type { BoardSeat, Debt, GameStateV2 } from '../../../engine/v2';
import { ActBtn, Limit, CauseBars, Gate, Seg, Term, Tip, TipCard, Why } from '../ui';
import { Card, CostPills, GoBtn, HBar, KV, PanelHead, Pill } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C, SPHERE } from '../theme';
import './finance.css';

const STANCE = ['speed', 'money', 'safety', 'mission'] as const;
const DEBT_KINDS: { id: Debt['kind']; label: string; blurb: string }[] = [
  { id: 'revolver', label: 'Revolver', blurb: 'A credit line you draw and repay at will. Counts toward liquidity while undrawn; frozen in distress.' },
  { id: 'gpuTerm', label: 'GPU term loan', blurb: 'A term loan secured on your chips. Size grows with the H100e you own.' },
  { id: 'bond', label: 'Bond', blurb: 'Long-dated fixed debt sold to the market. Needs an investment-grade rating; carries covenants.' },
  { id: 'vendorNote', label: 'Vendor note', blurb: 'Chip-vendor financing tied to orders. Easy to get, but it ties you to that vendor.' },
];
const SEAT: Record<BoardSeat['kind'], { icon: typeof ICON.board; label: string }> = {
  founder: { icon: ICON.you, label: 'Founder' }, mission: { icon: ICON.exec, label: 'Mission' }, financial: { icon: ICON.cash, label: 'Financial' },
  strategic: { icon: ICON.relations, label: 'Strategic' }, independent: { icon: ICON.board, label: 'Independent' }, gov: { icon: ICON.congress, label: 'Government' },
};
const KIND_TERM: Record<string, string> = { cloud: 'cloudContract', lta: 'lta', lease: 'site', spvRVG: 'spv', vendor: 'vendorNote', power: 'mw' };

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
  const payQ = payrollOf(pl) / 4;
  const secQ = pl.security.spendRate / 4;
  const fundQ = pl.policies.transitionFund / 4;
  const intQ = interestPerYear(s) / 4;
  const otherQ = Math.max(0, p.operating - payQ - secQ - fundQ - intQ);
  const q0 = qOf(s);
  const ledger = liveLedger(s);
  const orders = pl.orders.filter((o) => o.kind !== 'lta' && o.dueQ - q0 <= 4 && o.qty > o.delivered);
  const building = pl.sites.filter((x) => x.stage !== 'live' && x.stage !== 'blocked' && x.capex > x.capexPaid);
  const rev = -p.revenue;
  const steps = [
    { id: 'revenue', label: 'Revenue', term: 'revenueRun', icon: ICON.revenue, v: rev, rows: [{ label: <Term id="revenueRun">Run-rate</Term>, value: F.money(pl.finance.revenueRun, { perYear: true }) }, { label: 'Per quarter', value: F.money(rev) }], body: 'Revenue from your deployments this quarter.' },
    { id: 'operating', label: 'Payroll & ops', term: 'opex', icon: ICON.staff, v: -p.operating, body: 'Running costs that are not contracts.', rows: [
      { label: <Term id="payroll">Payroll</Term>, value: F.money(payQ) }, { label: 'Security spend', value: F.money(secQ) },
      ...(fundQ > 0 ? [{ label: <Term id="transitionFund">Transition fund</Term>, value: F.money(fundQ) }] : []), ...(intQ > 0 ? [{ label: 'Interest', value: F.money(intQ) }] : []),
      { label: 'Power, O&M, rentals, other', value: F.money(otherQ) },
    ] },
    { id: 'commitments', label: 'Contracts', term: 'ledger', icon: ICON.commitment, v: -p.commitments, body: 'Payments on your commitment ledger (cloud, leases, LTAs).', rows: ledger.slice().sort((a, b) => b.perQuarter - a.perQuarter).slice(0, 6).map((c) => ({ label: `${c.payee} · ${c.kind}`, value: F.money(c.perQuarter) })) },
    { id: 'chips', label: 'Chips', term: 'capex', icon: ICON.compute, v: -p.chips, body: 'Chip-order balances paid on delivery, per quarter averaged over the next 4 quarters.', rows: orders.slice(0, 6).map((o) => ({ label: `${o.kind} · ${F.count(o.qty - o.delivered)} H100e`, value: `due ${o.dueQ - q0 <= 0 ? 'now' : `+${o.dueQ - q0}q`}` })) },
    { id: 'sites', label: 'Sites & power', term: 'site', icon: ICON.sites, v: -p.sites, body: 'Site capex on each site\'s build schedule, per quarter averaged over the next 4 quarters.', rows: building.slice(0, 6).map((x) => ({ label: `${x.name} · ${x.stage}`, value: `${F.money(x.capex - x.capexPaid)} left` })) },
  ];
  const net = -rw.burnQ;
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
              {b.id === biggest.id && spend > 0 && -b.v > 0 && <text x={X(i) + bw / 2} y={top + h + 13} textAnchor="middle" className="wf2-note">{F.pct(-b.v / spend)} of spend</text>}
              <text x={X(i) + bw / 2} y={H - pb + 22} textAnchor="middle" className="wf2-lbl">{b.label}</text>
            </g>
          </Tip>
        );
      })}
      <Tip as="g" content={() => <TipCard title={<Term id="netBurn">{net < 0 ? 'Net burn' : 'Net inflow'}</Term>} value={F.money(net, { signed: true, perQ: true })} rows={[{ label: 'Revenue', value: F.money(rev) }, { label: 'Spending', value: F.money(-spend) }]}>Revenue minus every category of spending this quarter. Runway in the top strip divides your liquidity by this.</TipCard>}>
        <g className="wf2-bar" data-home="netBurn">
          <rect x={X(5)} y={Math.min(Y(0), Y(net))} width={bw} height={Math.max(1.5, Math.abs(Y(net) - Y(0)))} rx={3} fill={net < 0 ? C.bad : C.good} />
          <text x={X(5) + bw / 2} y={Math.min(Y(0), Y(net)) - 6} textAnchor="middle" className={`wf2-val ${net < 0 ? 'neg' : 'pos'}`}>{F.money(net, { signed: true })}</text>
          <text x={X(5) + bw / 2} y={H - pb + 22} textAnchor="middle" className="wf2-lbl strong">{net < 0 ? 'Net burn' : 'Net inflow'}</text>
        </g>
      </Tip>
    </svg>
  );
}

// ───────── cash history with raise markers and projections (history is its own datum: no current-value label) ─────────
function CashHistory({ s }: { s: GameStateV2 }) {
  const [hi, setHi] = useState<number>();
  const S = s.series;
  const n = Math.min(S.day.length, S.cash.length);
  const f = s.player.finance;
  const rw = runwayOf(s);
  const now = s.time.day;
  const days = S.day.slice(0, n);
  const cash = S.cash.slice(0, n);
  if (n < 2) return <div className="dim small">Cash history starts after the first week.</div>;
  // Projection: the runway's quarter-by-quarter cash path (each payment in the quarter it falls due).
  const proj = rw.path.map((p) => [p.day, p.cash]);
  const dry = rw.zeroDay;
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
  const vMax = Math.max(1, ...cash, f.cash, ...proj.map((p) => p[1]), ...pendPts.map((p) => p[1]));
  const step = niceStep(vMax / 3);
  const yMax = step * Math.ceil((vMax * 1.05) / step);
  const X = (d: number) => pl + ((d - x0) / Math.max(1, x1 - x0)) * (W - pl - pr);
  const Y = (v: number) => pt + (1 - Math.max(0, v) / yMax) * (H - pt - pb);
  const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
  const months: number[] = [];
  for (let d = x0; d <= x1; d += 7) { const dt = dateOf(s, d); const pd = dateOf(s, d - 7); if (dt.getUTCMonth() !== pd.getUTCMonth() && dt.getUTCMonth() % 6 === 0) months.push(d); }
  const rounds = f.rounds.filter((r) => r.day >= x0);
  const at = (d: number) => { let i = 0; while (i < n - 1 && days[i + 1] <= d) i++; return i; };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="cash2" data-home="cashHistory" onMouseLeave={() => setHi(undefined)}
      onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const d = x0 + (((e.clientX - r.left) / r.width) * W - pl) / (W - pl - pr) * (x1 - x0); setHi(d <= now ? at(d) : undefined); }}>
      <rect x={X(now)} y={pt} width={X(x1) - X(now)} height={H - pt - pb} fill="rgba(255,255,255,.025)" />
      {ticks.map((t) => <g key={t}><line x1={pl} x2={W - pr} y1={Y(t)} y2={Y(t)} stroke="#1f2a38" strokeDasharray="3 4" /><text x={pl - 6} y={Y(t) + 3} textAnchor="end" className="ch-ax">{t === 0 ? "$0" : F.money(t)}</text></g>)}
      {months.map((d) => <text key={d} x={X(d)} y={H - 8} textAnchor="middle" className="ch-ax">{fmtMonth(dateOf(s, d))}</text>)}
      <polyline points={cash.map((v, i) => `${X(days[i])},${Y(v)}`).join(' ')} fill="none" stroke="#c9d4e2" strokeWidth={1.8} />
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
            <text x={9} y={29} className="ch-tt">{F.money(cash[hi])}</text>
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
  const ceil = raiseCeiling(s, Number.POSITIVE_INFINITY, { anchor: !!anchor });
  const askMax = Math.max(5, Math.ceil(ceil.max * 2));
  const [askIn, setAsk] = useState<number | undefined>(undefined);
  const ask = Math.max(0.1, Math.round(Math.min(askMax, askIn ?? Math.max(0.1, ceil.max)) * 10) / 10);
  const params = { ask, ...(anchor ? { anchor } : {}) };
  const v = actionView(s, 'fin.raise', params);
  const stake = v.costs.find((c) => c.currency === 'dilution')?.amount ?? 0;
  const fail = v.exposure.find((c) => c.currency === 'cash')?.probability ?? 0;
  const burn = runwayOf(s).burnQ;
  const limits = ([['pool', 'Investor pool', 'investorPool', ICON.staff], ['dilution', 'Dilution limit', 'dilutionCap', ICON.valuation], ['annualCap', 'Annual cap', 'annualCap', ICON.raise]] as const)
    .map(([k, label, term, icon]) => ({ k, label, term, icon, v: ceil.parts[k] ?? 0 }));
  const lmax = Math.max(1e-6, ...limits.map((l) => l.v));
  const boundLabel = limits.find((l) => l.k === ceil.bound)?.label.toLowerCase() ?? ceil.bound;
  const partners = dealMenu(s).filter((d) => d.partner).slice(0, 3);
  const pend = f.ws3.pendingRound;
  return (
    <Card title={<Term id="raiseCeiling">How much can you raise?</Term>} home="raiseCeiling" id="ctl-raise-card"
      right={<span className="tag2 warn">bound by {boundLabel}</span>}>
      <div className="lim-rows">
        {limits.map((l) => (
          <div className="lim-row" key={l.k} data-cap={l.k}>
            <span className="row-i"><l.icon size={13} /><Term id={l.term}>{l.label}</Term></span>
            <HBar v={l.v} max={lmax} w="100%" h={8} color={l.k === ceil.bound ? C.watch : '#6b7c91'} />
            <span className={`num ${l.k === ceil.bound ? 'tone-warn' : ''}`}>{F.money(l.v)}</span>
          </div>
        ))}
      </div>
      {partners.length > 0 && (
        <div className="fin-row"><span className="dim small"><Term id="anchorPartner">Anchor partner</Term></span><Seg value={anchor} options={[{ v: '', label: 'None' }, ...partners.map((d) => ({ v: d.partner as string, label: d.partner as string }))]} onChange={setAnchor} /></div>
      )}
      <div className="ask-head">
        <span className="dim small">Ask</span><b className="num">{F.money(ask)}</b>
        <span className="sp" />
        <span className="pills">
          <Pill kind="cost" title="Share of the company you sell"><Term id="dilution">stake</Term> −{stake.toFixed(1)}%</Pill>
          <Pill kind="gain" title="Quarters of spending this round covers at today's net burn">{burn > 0 ? `+${F.quarters(ask / burn)} runway` : 'no burn'}</Pill>
          <Pill kind={fail > 0.25 ? 'bad' : fail > 0 ? 'warn' : 'good'} title="Asking above the ceiling risks the round failing">close {F.pct(1 - fail)}</Pill>
        </span>
      </div>
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
            <span className="small"><b className="num">{F.money(rr.ask)}</b> at <b className="num">{F.money(rr.pre)}</b> pre <span className="dim">(last post {F.money(rr.lastPost)}) · decide by {fmtDate(dateOf(s, rr.deadline))}</span></span>
            <span className="sp" />
            <ActBtn id="fin.acceptRepriced" label="Accept down round" />
            <ActBtn id="fin.pullRepriced" label="Pull" />
          </div>
        );
      })()}
      <div className="fin-foot">
        {pend ? <span><span className="dim">Pending</span> <b className="num">{F.money(pend.ask)}</b> <span className="dim">closes {fmtDate(dateOf(s, nextQDay(s)))}</span></span> : <span className="dim">No round in progress</span>}
        <span className="sp" />
        <span className="dim">room left</span> <b className="num tone-pos">{F.money(ceil.max)}</b>
      </div>
    </Card>
  );
}

// ───────── parent budget (big-tech division, R9): HOME of the budget schedule; replaces raising and ownership ─────────
function ParentBudget({ s }: { s: GameStateV2 }) {
  const sched = parentSchedule(s, 8);
  const max = Math.max(...sched.map((x) => x.amount), 1e-9);
  const y = Math.floor(qOf(s) / 4);
  return (
    <Card title={<Term id="parentBudget">Parent budget</Term>} home="parentBudget" id="ctl-parent"
      right={<span className="row-i small"><span className="dim">this year</span><b className="num">{F.money(parentYear(y), { perYear: true })}</b></span>}>
      <div className="lim-rows">
        {sched.map((x) => (
          <div className="lim-row" key={x.q} data-q={x.q}>
            <span className="small">{qLabel(s, x.q)}</span>
            <HBar v={x.amount} max={max} w="100%" h={8} color={C.good} />
            <Tip content={() => <TipCard title={`Budget ${qLabel(s, x.q)}`}>{`Paid on ${fmtDate(dateOf(s, x.day))}: a quarter of the ${F.money(parentYear(Math.floor(x.q / 4)), { perYear: true })} budget year.`}</TipCard>}>
              <span className="num">{F.money(x.amount)}</span>
            </Tip>
          </div>
        ))}
      </div>
      <div className="fin-foot">
        <span className="dim">next year</span> <b className="num">{F.money(parentYear(y + 1), { perYear: true })}</b>
        <span className="sp" />
        <span className="dim small" data-test="division-reason">{DIVISION_REASON}</span>
      </div>
    </Card>
  );
}

// ───────── locked-in spending: 8-quarter firm vs cancellable against the revenue line ─────────
function LockedIn({ s }: { s: GameStateV2 }) {
  const [show, setShow] = useState(false);
  const q0 = qOf(s);
  const live = liveLedger(s);
  const due = Array.from({ length: 8 }, (_, i) => {
    const q = q0 + i;
    const tot = ledgerDue(s, q);
    const firm = live.reduce((a, c) => a + (c.cancellableNoticeQ === null && qOf(s, c.endDay - 1) >= q ? c.perQuarter : 0), 0);
    return { q, tot, firm: Math.min(tot, firm), canc: Math.max(0, tot - firm) };
  });
  const revQ = s.player.finance.revenueRun / 4;
  const dmax = Math.max(1e-6, ...due.map((d) => d.tot));
  const revOff = revQ > dmax * 2.2; // revenue far above the ledger: pin its line to the top, labelled off scale
  const max = (revOff ? dmax : Math.max(dmax, revQ)) * 1.15;
  const firmN = live.filter((c) => c.cancellableNoticeQ === null).length;
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
      <div className="dim small">{live.length} contracts · {firmN} firm{cover !== undefined ? ` · revenue covers this quarter ${F.mult(cover)}` : ''}</div>
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
            {live.map((c) => (
              <tr key={c.id}>
                <td className="ellip">{c.payee}</td><td><Term id={KIND_TERM[c.kind] ?? 'ledger'}>{F.words(c.kind)}</Term></td><td className="num r">{F.money(c.perQuarter)}</td><td className="num">{fmtMonth(dateOf(s, c.endDay))}</td>
                <td>{c.cancellableNoticeQ === null ? <span className="dim">firm</span> : <ActBtn id="fin.cancelContract" params={{ id: c.id }} label={`Cancel · ${c.cancellableNoticeQ}q notice`} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ───────── board ─────────
function BoardCard({ s }: { s: GameStateV2 }) {
  const b = s.player.board;
  return (
    <Card title={<Term id="boardSeat">Board</Term>} id="ctl-board" home="board"
      right={<span className="row-i"><span className="dim small"><Term id="boardConf">confidence</Term></span><Why k="board.confidence" title="Board confidence" value={F.idx(b.confidence)} body="See [[boardConf]]. Below 30 the board may revolt."><b className="num big" data-home="boardConf">{F.idx(b.confidence)}</b></Why></span>}>
      <div className="seats">
        {b.seats.map((x, i) => {
          const k = x.stance.reduce((m, v, j) => (Math.abs(v) > Math.abs(x.stance[m]) ? j : m), 0);
          const v = x.stance[k];
          const meta = SEAT[x.kind];
          return (
            <Tip key={i} content={() => <TipCard title={x.holder} value={meta.label} rows={x.stance.map((sv, j) => ({ label: STANCE[j], value: sv > 0 ? 'for' : sv < 0 ? 'against' : 'neutral', tone: sv > 0 ? 'pos' : sv < 0 ? 'neg' : 'neutral' }))} footer={x.weight > 1 ? `${x.weight} votes` : '1 vote'}>How this seat leans on decisions that push speed, money, safety or mission.</TipCard>}>
              <div className="seat" data-seat={i}>
                <span className={`seat-av ${x.kind}`}><meta.icon size={16} />{x.weight > 1 && <i>×{x.weight}</i>}</span>
                <span className="seat-name ellip">{x.holder}</span>
                <span className={`seat-st ${v > 0 ? 'tone-pos' : v < 0 ? 'tone-neg' : 'dim'}`}>{v === 0 ? 'neutral' : `${STANCE[k]} ${v > 0 ? '▲' : '▼'}`}</span>
              </div>
            </Tip>
          );
        })}
      </div>
      {(() => { const h = incidentBoardHit(s); return <div className="limit-row"><span className="dim small">Public incidents at the next review</span><Limit id="board.incidentCap" tone={h.raw > h.cap ? 'warn' : h.capped > 0 ? 'bind' : 'quiet'}>{h.capped > 0 ? `−${h.capped}` : 'none'}{h.raw > h.cap ? ` (${h.raw} capped)` : ''} · max −{h.cap}/q</Limit></div>; })()}
      {b.pendingApprovals.length > 0 && (
        <div className="tip-sec">
          <div className="tip-cap">Waiting for the board</div>
          {b.pendingApprovals.map((p) => <KV key={p.id} k={F.words(p.action)}>{F.pct(p.pApprove)} likely</KV>)}
        </div>
      )}
      <div className="btn-row" style={{ marginTop: 8 }}>
        <ActBtn id="fin.recap" label={<Term id="recap">Recapitalise</Term>} />
        <ActBtn id="fin.refuseRecap" label="Refuse recap" />
      </div>
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
      right={<span className="row-i"><span className="dim small"><Term id="valuation">valuation</Term></span><Why k="player.finance.valuation" title="Valuation" value={F.money(f.valuation)} fmt={(x) => F.money(x)}><b className="num big" data-home="valuation">{F.money(f.valuation)}</b></Why></span>}>
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
          {parts.filter((p) => p.v > 0 || p.k !== 'public').map((p) => <div key={p.k} className="own-row"><i style={{ background: p.c }} /><span className="ellip">{p.label}</span><b className="num">{F.pct(p.v)}</b></div>)}
          <div className="dim small" style={{ marginTop: 4 }}>public {F.pct(o.public)} · <Term id="ipo">IPO</Term> window {s.capital.ipoWindow ? 'open' : 'closed'}</div>
        </div>
      </div>
    </Card>
  );
}

// ───────── markets ─────────
function Markets({ s }: { s: GameStateV2 }) {
  const c = s.capital;
  return (
    <Card title="Markets" home="markets">
      <div className="mk-row"><ICON.taste size={14} /><Term id="hype">Hype</Term><span className="sp" /><HBar v={c.hype} max={2.5} w={90} color={C.cap} /><b className="num">{c.hype.toFixed(2)}</b></div>
      <div className="mk-row"><ICON.alert size={14} className={c.bubbleX > 1.5 ? 'tone-warn' : ''} /><Term id="bubble">Bubble index</Term><span className="dim small">raises easier, crash risk rises</span><span className="sp" /><HBar v={c.bubbleX} max={3} w={90} color={C.watch} /><b className={`num ${c.bubbleX > 1.5 ? 'tone-warn' : ''}`}>{c.bubbleX.toFixed(2)}</b></div>
      <div className="mk-row"><ICON.debt size={14} /><Term id="rates">10y · SOFR</Term><span className="sp" /><b className="num">{c.y10.toFixed(2)}% · {c.sofr.toFixed(2)}%</b></div>
      <div className="mk-row"><ICON.staff size={14} /><Term id="investorPool">Investor pool</Term><span className="sp" /><b className="num">{F.money(c.poolAnnual, { perYear: true })}</b></div>
      <div className="mk-row"><ICON.milestone size={14} /><Term id="ipo">IPO window</Term><span className="sp" /><span className={`tag2 ${c.ipoWindow ? 'good' : ''}`}>{c.ipoWindow ? 'open' : 'closed'}</span></div>
      {c.busted && <div className="tone-neg small" style={{ marginTop: 6 }}>Bubble burst · recovers ≈ {fmtMonth(dateOf(s, c.busted.recoverDay))}</div>}
    </Card>
  );
}

// ───────── debt ─────────
function DebtCard({ s }: { s: GameStateV2 }) {
  const f = s.player.finance;
  const [dk, setDk] = useState<Debt['kind']>('revolver');
  const head = debtHeadroom(s, dk);
  const [amtF, setAmtF] = useState(0.5);
  const drawAmt = Math.max(0.1, Math.round(head.max * amtF * 10) / 10);
  return (
    <Card title={<Term id="rating">Debt</Term>} home="debt"
      right={<span className="row-i small"><span className="dim"><Term id="rating">rating</Term></span><b className={`num ${f.rating === 'closed' ? 'tone-neg' : ''}`}>{f.rating}</b><span className="dim">· drawn</span><b className="num">{F.money(totalDebt(f))}</b><span className="dim">· interest</span><b className="num">{F.money(interestPerYear(s), { perYear: true })}</b></span>}>
      {f.debts.length > 0 && (
        <table className="tbl fin-tbl">
          <thead><tr><th>Kind</th><th className="r">Drawn / limit</th><th className="r">Rate</th><th><Term id="covenant">Covenant</Term></th><th /></tr></thead>
          <tbody>
            {f.debts.map((d) => (
              <tr key={d.id}>
                <td><Term id={d.kind}>{DEBT_KINDS.find((k) => k.id === d.kind)?.label ?? d.kind}</Term></td>
                <td className="num r">{F.money(d.drawn)} / {F.money(d.principal)}</td>
                <td className="num r">{debtRatePct(s, d).toFixed(1)}%</td>
                <td className="dim">{d.covenant ?? '—'}</td>
                <td className="r">{d.drawn > 0 && <ActBtn id="fin.repayDebt" params={{ id: d.id, amount: d.drawn }} label="Repay" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="dk-tiles">
        {DEBT_KINDS.map((k) => (
          <Tip key={k.id} content={() => <TipCard title={<Term id={k.id}>{k.label}</Term>} value={F.money(debtHeadroom(s, k.id).max)}>{k.blurb}</TipCard>}>
            <button className={`otile ${dk === k.id ? 'on' : ''}`} data-debt-kind={k.id} onClick={() => setDk(k.id)}>
              <span className="otile-top">{k.label}</span>
              <span className="otile-gl">{F.money(debtHeadroom(s, k.id).max)} room</span>
            </button>
          </Tip>
        ))}
      </div>
      <div className="fin-row">
        <span className="dim small">Headroom{head.why ? ` · ${head.why}` : ''}</span>
        <HBar v={drawAmt} max={Math.max(1e-6, head.max)} w={140} h={8} color={C.you} />
        <input className="slider" type="range" min={0.05} max={1} step={0.05} value={amtF} onChange={(e) => setAmtF(Number(e.target.value))} style={{ width: 120 }} />
        <span className="sp" />
        <ActBtn id="fin.drawDebt" params={{ kind: dk, amount: drawAmt }} label={`Borrow ${F.money(drawAmt)}`} icon={ICON.debt} anchor="borrow" reason />
      </div>
      {f.covenantBreachDay !== undefined && <div className="tone-neg small"><Term id="covenant">Covenant</Term> breached since {fmtDate(dateOf(s, f.covenantBreachDay))}</div>}
    </Card>
  );
}

// ───────── deals ─────────
function Deals({ s }: { s: GameStateV2 }) {
  const offers = s.player.finance.ws3.offers;
  const menu = dealMenu(s);
  const [tpl, setTpl] = useState(menu[0]?.template ?? 'hyperscalerEquity');
  return (
    <Card title={<Term id="deal">Deals</Term>} home="deals" right={<span className="dim small">{offers.length} offer{offers.length === 1 ? '' : 's'}</span>}>
      <Gate s={s} k="deals">
        {offers.map((d) => (
          <div className="offer2" key={d.id}>
            <div className="row-i"><ICON.relations size={14} /><b>{d.partner}</b><span className="dim small">{F.words(d.template)}{d.rescue ? ' · rescue' : ''} · expires {fmtDate(dateOf(s, d.expiresDay))}</span></div>
            <CostPills v={dealPreview(s, d)} />
            <div className="btn-row"><ActBtn id="fin.acceptDeal" params={{ offerId: d.id }} label="Accept" primary /><ActBtn id="fin.declineDeal" params={{ offerId: d.id }} label="Decline" /></div>
          </div>
        ))}
        {!offers.length && <div className="dim small">No offers on the table.</div>}
        <div className="fin-row" style={{ marginTop: 8 }}>
          <select className="text-input" value={tpl} data-test="deal-template" onChange={(e) => setTpl(e.target.value as typeof tpl)}>{menu.map((d) => <option key={d.template} value={d.template}>{d.name}{d.blocked ? ` (${d.blocked})` : ''}</option>)}</select>
          <ActBtn id="fin.seekPartner" params={{ template: tpl }} label="Seek partner" icon={ICON.relations} anchor="partner" reason />
        </div>
      </Gate>
    </Card>
  );
}

export function Finance({ s }: { s: GameStateV2 }) {
  const f = s.player.finance;
  const dLeft = Math.max(0, nextQDay(s) - s.time.day);
  const division = isDivision(s);
  return (
    <div className="panel-v2 fin" data-panel="finance">
      <PanelHead icon={ICON.finance} title="Finance" sub={`per quarter unless marked · ${qLabel(s, qOf(s) + 1)} starts in ${dLeft} d`}
        right={division ? undefined : <div className="btn-row"><GoBtn to={{ panel: 'finance', anchor: 'raise' }} label="Raise" testId="fin.go.raise" /><GoBtn to={{ panel: 'finance', anchor: 'partner' }} label="Seek partner" testId="fin.go.partner" /><GoBtn to={{ panel: 'finance', anchor: 'borrow' }} label="Borrow" testId="fin.go.borrow" /></div>} />
      <div className="fin-top">
        <Card title={<Term id="netBurn">Cash flow this quarter</Term>} sub="$ per quarter · hover a bar for its lines"
          right={<span className="row-i small"><Why k="revenueRun" title="Revenue run-rate" value={F.money(f.revenueRun, { perYear: true })} fmt={(x) => F.money(x)} levers={<GoBtn to={{ panel: 'products' }} label="Products" />}><span className="dim"><Term id="revenueRun">revenue</Term>{division ? ' goes to the parent' : ''} · in the top strip</span></Why></span>}>
          <Waterfall s={s} />
        </Card>
        <Card title="Cash history" sub="weekly · current cash is in the top strip"
          right={<span className="legend2"><span><i style={{ background: '#c9d4e2' }} />actual</span><span><i style={{ background: C.watch }} />no new money</span>{f.ws3.pendingRound && <span><i style={{ background: C.good }} />with pending round</span>}</span>}>
          <CashHistory s={s} />
        </Card>
      </div>
      <div className="g3">
        {division ? <ParentBudget s={s} /> : <RaiseCard s={s} />}
        <LockedIn s={s} />
        <Card title="Why cash moved · 30 d" sub="every booked inflow and outflow" home="cashCauses">
          <CauseBars s={s} k="cash" fmt={(x) => F.money(x)} />
        </Card>
      </div>
      <div className="g3">
        <BoardCard s={s} />
        {!division && <Ownership s={s} />}
        {!division && <Markets s={s} />}
      </div>
      {!division && (
        <div className="g2">
          <DebtCard s={s} />
          <Deals s={s} />
        </div>
      )}
    </div>
  );
}
