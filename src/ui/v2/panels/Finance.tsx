// Finance (§6.3): quarterly cash-flow waterfall, commitment ledger by quarter, raise ceiling with its 4 limits,
// ownership, board, rating and covenants, hype and rates, deal offers; raise / partner / debt / deals actions.
import { useState } from 'react';
import {
  dateOf, dayOfQuarter, dealMenu, debtHeadroom, debtRatePct, fmtDate, interestPerYear, ledgerDue, liveLedger, qOf, raiseCeiling, runwayOf, totalDebt,
} from '../../../engine/v2';
import type { Debt, GameStateV2 } from '../../../engine/v2';
import { ActBtn, fmtB, Gate, Meter, pct, Row, Section, Seg, Slider, Stack, Term, Tip, TipCard, Why } from '../ui';

const OWN_COLOR = { founder: '#5aa9ff', mission: '#4cc38a', fin: '#e9b44c', strat: '#a58cff', public: '#f08a4b' };
const STANCE = ['speed', 'fin', 'safety', 'mission'];
const DEBT_KINDS: Debt['kind'][] = ['revolver', 'gpuTerm', 'bond', 'vendorNote'];

export function Waterfall({ parts }: { parts: Record<string, number> }) {
  // Quarterly flows: revenue in (negative burn), costs out.
  const rows = Object.entries(parts).map(([k, v]) => ({ k, v: -v }));
  const net = rows.reduce((a, r) => a + r.v, 0);
  const all = [...rows, { k: 'net', v: net }];
  const max = Math.max(1e-6, ...all.map((r) => Math.abs(r.v)));
  return (
    <div className="waterfall">
      {all.map((r) => (
        <div className="wf-row" key={r.k}>
          <span className="wf-lbl">{r.k}</span>
          <div className="wf-track">
            <div className="wf-mid" />
            <div className="wf-bar" style={{ left: r.v >= 0 ? '50%' : `${50 - (Math.abs(r.v) / max) * 50}%`, width: `${(Math.abs(r.v) / max) * 50}%`, background: r.k === 'net' ? 'var(--accent)' : r.v >= 0 ? 'var(--pos)' : 'var(--neg)' }} />
          </div>
          <span className={`num wf-val ${r.v >= 0 ? 'tone-pos' : 'tone-neg'}`}>{fmtB(r.v)}</span>
        </div>
      ))}
    </div>
  );
}

export function Finance({ s }: { s: GameStateV2 }) {
  const f = s.player.finance;
  const rw = runwayOf(s);
  const [anchor, setAnchor] = useState('');
  const ceil = raiseCeiling(s, Number.POSITIVE_INFINITY, { anchor: !!anchor });
  const askMax = Math.max(5, Math.ceil(ceil.max * 2));
  const [askIn, setAsk] = useState<number | undefined>(undefined);
  const ask = Math.max(0.1, Math.round((askIn ?? ceil.max) * 10) / 10);
  const [tpl, setTpl] = useState('hyperscalerEquity');
  const [dk, setDk] = useState<Debt['kind']>('revolver');
  const head = debtHeadroom(s, dk);
  const [amtF, setAmtF] = useState(0.5);
  const drawAmt = Math.max(0.1, Math.round(head.max * amtF * 10) / 10);
  const q0 = qOf(s);
  const due = Array.from({ length: 8 }, (_, i) => ({ q: q0 + i, v: ledgerDue(s, q0 + i) }));
  const dueMax = Math.max(1e-6, ...due.map((d) => d.v));
  const o = f.ownership;
  const strat = Object.values(o.strat).reduce((a, b) => a + b, 0);
  const offers = f.ws3.offers;
  const year = String(dateOf(s).getUTCFullYear());
  const ys = f.ws3.years[year];
  return (
    <div className="panel-v2 grid2" data-panel="finance">
      <Section title={<Term id="runway">Cash flow · quarter</Term>} right={<span className={`num ${f.state === 'healthy' ? 'tone-pos' : 'tone-neg'}`}>{rw.q >= 99 ? '∞' : rw.q.toFixed(1)}q · {f.state}</span>}>
        <Waterfall parts={rw.parts} />
        <Row label="Cash"><Why k="cash" title="Cash" value={fmtB(f.cash)} fmt={fmtB}><span className="num">{fmtB(f.cash)}</span></Why></Row>
        <Row label="Revenue run-rate"><Why k="revenueRun" title="Revenue run-rate" fmt={fmtB}><span className="num">{fmtB(f.revenueRun)}/yr</span></Why></Row>
        <Row label="Valuation"><Why k="player.finance.valuation" title="Valuation" fmt={fmtB}><span className="num">{fmtB(f.valuation)}</span></Why></Row>
        {ys && (
          <Tip as="div" content={() => <TipCard title={`${year} so far`} rows={Object.entries(ys.flows ?? {}).map(([k, v]) => ({ label: k, value: fmtB(v ?? 0), tone: (v ?? 0) >= 0 ? 'pos' : 'neg' }))} />}>
            <Row label={`${year} flows`}><span className="dim small">revenue {fmtB(ys.revenue)} · capex {fmtB(ys.capexChips + ys.capexSites)}</span></Row>
          </Tip>
        )}
      </Section>

      <Section title={<Term id="raiseCeiling">Raise ceiling</Term>} right={<span className="small">bound by: <b>{ceil.bound}</b></span>}>
        {Object.entries(ceil.parts).filter(([k]) => k !== 'ask').map(([k, v]) => (
          <Row key={k} label={k}><Meter value={v} max={Math.max(...Object.values(ceil.parts).filter((x) => x < 1e6), 1)} color={k === ceil.bound ? 'var(--warn)' : 'var(--accent)'} width={110} /><span className="num">{fmtB(v)}</span></Row>
        ))}
        <Row label="Anchor partner"><Seg value={anchor} options={[{ v: '', label: 'None' }, ...dealMenu(s).filter((d) => d.partner).slice(0, 3).map((d) => ({ v: d.partner as string, label: d.partner as string }))]} onChange={setAnchor} /></Row>
        <Row label={`Ask ${fmtB(ask)}`}><Slider value={ask} min={0.1} max={askMax} step={0.1} onChange={setAsk} /><button className="mini" onClick={() => setAsk(undefined)} title="ask = ceiling">max</button></Row>
        <div className="btn-row">
          <ActBtn id="fin.raise" params={{ ask, ...(anchor ? { anchor } : {}) }} primary label={`Raise ${fmtB(ask)}`} />
          <ActBtn id="fin.downRound" />
          <ActBtn id="fin.rescue" />
        </div>
        {f.ws3.pendingRound && <div className="small tone-warn">Round pending: ask {fmtB(f.ws3.pendingRound.ask)}, closes next quarter</div>}
      </Section>

      <Section title="Commitment ledger · next 8 q" right={<span className="dim small">firm vs cancellable</span>}>
        <div className="qbars">
          {due.map((d) => (
            <Tip key={d.q} content={() => <TipCard title={fmtDate(dateOf(s, dayOfQuarter(s.time.startDate, d.q)))} value={fmtB(d.v)} />}>
              <div className="qbar"><div style={{ height: `${(d.v / dueMax) * 100}%` }} /><span className="dim">{d.q - q0 === 0 ? 'now' : `+${d.q - q0}`}</span></div>
            </Tip>
          ))}
        </div>
        <table className="tbl">
          <thead><tr><th>Payee</th><th>Kind</th><th>$/q</th><th>Ends</th><th>Cancel</th></tr></thead>
          <tbody>
            {liveLedger(s).slice(0, 10).map((c) => (
              <tr key={c.id}>
                <td>{c.payee}</td><td>{c.kind}</td><td className="num">{fmtB(c.perQuarter)}</td><td className="num">{fmtDate(dateOf(s, c.endDay))}</td>
                <td>{c.cancellableNoticeQ === null ? <span className="dim">firm</span> : <ActBtn id="fin.cancelContract" params={{ id: c.id }} label={`${c.cancellableNoticeQ}q`} inline={false} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="btn-row"><ActBtn id="fin.renegotiate" /><ActBtn id="fin.sellChips" params={{ qty: 0.2e6 }} /></div>
      </Section>

      <Section title="Ownership · board" right={<Why k="board.confidence" title="Board confidence" value={f && s.player.board.confidence.toFixed(0)} body="See [[boardConf]]."><span className="num">BC {s.player.board.confidence.toFixed(0)}</span></Why>}>
        <Stack parts={[
          { v: o.founder, color: OWN_COLOR.founder, label: 'founder' }, { v: o.mission, color: OWN_COLOR.mission, label: 'mission' },
          { v: o.fin, color: OWN_COLOR.fin, label: 'financial' }, { v: strat, color: OWN_COLOR.strat, label: 'strategic' }, { v: o.public, color: OWN_COLOR.public, label: 'public' },
        ]} h={12} />
        <div className="bn-legend">
          {(['founder', 'mission', 'fin', 'public'] as const).map((k) => <span key={k}><i style={{ background: OWN_COLOR[k] }} />{k} {pct(o[k])}</span>)}
          <span><i style={{ background: OWN_COLOR.strat }} />strategic {pct(strat)}</span>
        </div>
        <table className="tbl">
          <thead><tr><th>Seat</th><th>Holder</th><th>Wt</th>{STANCE.map((x) => <th key={x}>{x}</th>)}</tr></thead>
          <tbody>
            {s.player.board.seats.map((b, i) => (
              <tr key={i}><td>{b.kind}</td><td>{b.holder}</td><td className="num">{b.weight}</td>{b.stance.map((v, j) => <td key={j} className={v > 0 ? 'tone-pos' : v < 0 ? 'tone-neg' : 'dim'}>{v > 0 ? '▲' : v < 0 ? '▼' : '·'}</td>)}</tr>
            ))}
          </tbody>
        </table>
        {s.player.board.pendingApprovals.map((p) => <Row key={p.id} label={`Pending: ${p.action}`}><span className="num">p {pct(p.pApprove)}</span></Row>)}
        <div className="btn-row"><ActBtn id="fin.recap" /><ActBtn id="fin.refuseRecap" /></div>
      </Section>

      <Section title="Debt · rating" right={<span className="num">{f.rating} · int {fmtB(interestPerYear(s))}/yr</span>}>
        <Row label="Total drawn"><span className="num">{fmtB(totalDebt(f))}</span></Row>
        {f.debts.map((d) => <Row key={d.id} label={`${d.kind} ${d.covenant ? `· ${d.covenant}` : ''}`}><span className="num">{fmtB(d.drawn)} / {fmtB(d.principal)} · {debtRatePct(s, d).toFixed(1)}%</span><ActBtn id="fin.repayDebt" params={{ id: d.id, amount: d.drawn }} label="Repay" inline={false} /></Row>)}
        <Row label="Kind"><Seg value={dk} options={DEBT_KINDS.map((k) => ({ v: k, label: k }))} onChange={setDk} /></Row>
        <Row label={`Headroom ${fmtB(head.max)}${head.why ? ` · ${head.why}` : ''}`}><Slider value={amtF} min={0.05} max={1} step={0.05} onChange={setAmtF} /></Row>
        <div className="btn-row"><ActBtn id="fin.drawDebt" params={{ kind: dk, amount: drawAmt }} label={`Borrow ${fmtB(drawAmt)}`} /></div>
        {f.covenantBreachDay !== undefined && <div className="tone-neg small">Covenant breach since {fmtDate(dateOf(s, f.covenantBreachDay))}</div>}
      </Section>

      <Section title="Markets" right={<span className="dim small">hype · rates</span>}>
        <Row label={<Term id="hype">Hype</Term>}><Meter value={s.capital.hype} max={2} width={110} color="var(--violet)" /><span className="num">{s.capital.hype.toFixed(2)}</span></Row>
        <Row label="10y · SOFR"><span className="num">{s.capital.y10.toFixed(2)}% · {s.capital.sofr.toFixed(2)}%</span></Row>
        <Row label="Investor pool / yr"><span className="num">{fmtB(s.capital.poolAnnual)}</span></Row>
        <Row label="Bubble index"><Meter value={s.capital.bubbleX} max={2} width={110} color="var(--warn)" /><span className="num">{s.capital.bubbleX.toFixed(2)}</span></Row>
        <Row label="IPO window"><span>{s.capital.ipoWindow ? 'open' : 'closed'}</span></Row>
      </Section>

      <Section title="Deals" right={<span className="dim small">{offers.length} offer(s)</span>}>
        <Gate s={s} k="deals">
          {offers.map((d) => (
            <div className="offer" key={d.id}>
              <div><b>{d.partner}</b> · {d.template}{d.rescue ? ' · rescue' : ''}</div>
              <div className="small dim">equity {fmtB(d.equityNow)} (+{fmtB(d.equityLater)}) · commit {fmtB(d.commitPerQ)}/q × {d.commitQ} · expires {fmtDate(dateOf(s, d.expiresDay))}</div>
              <div className="btn-row"><ActBtn id="fin.acceptDeal" params={{ offerId: d.id }} label="Accept" primary /><ActBtn id="fin.declineDeal" params={{ offerId: d.id }} label="Decline" /></div>
            </div>
          ))}
          <Row label="Template"><select className="text-input" value={tpl} data-test="deal-template" onChange={(e) => setTpl(e.target.value)}>{dealMenu(s).map((d) => <option key={d.template} value={d.template}>{d.name}{d.blocked ? ` (${d.blocked})` : ''}</option>)}</select></Row>
          <div className="btn-row"><ActBtn id="fin.seekPartner" params={{ template: tpl }} /></div>
        </Gate>
      </Section>
    </div>
  );
}
