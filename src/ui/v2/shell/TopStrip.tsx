// Top strip (IA.md L0): time · the race (hero) · catastrophe risk · cash·runway · nearest lead · help · menu.
// Each item is the HOME of its datum (data-home); hover = why, click = the panel that changes it.
import { useState } from 'react';
import { dateOf, engine, fmtDate, internalEval, productReadouts, RUNWAY_CAP, safetyView, SLOT_KEYS, upkeepView } from '../../../engine/v2';
import { PRODUCT_DEFS } from '../../../data/v2/features';
import type { GameStateV2 } from '../../../engine/v2';
import { CRITICAL_TRAITS, TRAIT_BY_ID } from '../../../data/v2/traits';
import { store } from '../store';
import { ACT_NAMES, Term, Tip, TipCard, WhyCard } from '../ui';
import { Gauge, GoBtn, HBar, Spark2 } from '../kit';
import * as F from '../fmt';
import { ICON, TRAIT_ICON } from '../icons';
import { C, STATE_COLOR } from '../theme';
import { SpeedControl } from './SpeedControl';
import { catRisk, divisionBudget, nearestRival, runwayLive } from './selectors';

export { catRisk, nearestRival, runwayLive };

/** What triggers each act (engine tutorial rules; shown in the date hover and the Goals card). */
export const ACT_TRIGGER: Record<number, string> = { 2: 'capability L ≥ 6.5 or day 150', 3: 'capability L ≥ 8.5', 4: 'capability L ≥ 12 or R&D speed ≥ 25×' };

function RaceTip({ s }: { s: GameStateV2 }) {
  const u = engine.understanding(s);
  const ev = internalEval(s);
  const sv = safetyView(s);
  // Jank S2: list tools that are fading now; tools that no longer work at all are one line, not "decayed 100%".
  const active = sv.techniques.filter((t) => t.unlocked && t.active && t.role !== 'fix');
  const decaying = active.filter((t) => t.decay > 0.05 && t.decay < 0.99).sort((a, b) => b.decay - a.decay).slice(0, 3);
  const gone = active.filter((t) => t.decay >= 0.99);
  const masked = sv.techniques.filter((t) => t.unlocked && t.trainedAgainst > 0.05);
  const hist = s.series.U.slice(-13);
  const up = upkeepView(s);
  return (
    <TipCard title="The race: capability vs understanding" value={`${u.margin >= 0 ? '+' : '−'}${Math.abs(u.margin).toFixed(1)}`}>
      <div className="why-body">Violet: the <Term id="L">measured level</Term> of your internal model{ev.evaluating ? ' (still in evaluation: last measured level of its line)' : ''}. Teal: <Term id="U">understanding</Term>, the highest level your tools still read. Past teal you are <Term id="gap">flying blind</Term>.</div>
      <div className="tip-sec">
        <div className="det-row"><span className="det-lbl"><ICON.U size={12} /><Term id="validatedTo">Tools validated to</Term></span><span /><span className="num" data-test="validated-to">{up.validatedTo !== undefined ? `L ${F.level(up.validatedTo)}` : '—'}</span></div>
        <div className="small dim">How far above today's model your tools were re-checked. Understanding can sit lower: it is where detection of the critical traits stays at 50% or more.</div>
      </div>
      <div className="tip-sec">
        <div className="tip-cap">Can your tools see it? detection at L vs 50%</div>
        {CRITICAL_TRAITS.map((t) => {
          const p = u.perTrait[t] ?? 0;
          const Ic = TRAIT_ICON[t];
          return (
            <div className="det-row" key={t}>
              <span className="det-lbl">{Ic && <Ic size={12} />}<Term id={`trait:${t}`}>{TRAIT_BY_ID[t].name}</Term></span>
              <HBar v={p} max={1} color={p >= 0.5 ? C.und : C.bad} w={130} mark={0.5} />
              <span className={`num ${p >= 0.5 ? 'tone-pos' : 'tone-neg'}`}>{F.pct(p)}</span>
            </div>
          );
        })}
      </div>
      <div className="tip-sec">
        <div className="tip-cap">Why understanding moved · last 90 d <Spark2 data={hist} w={70} h={14} /></div>
        {/* Jank M2: the engine's weekly U drivers (new model, tools, eval-awareness belief, re-validation). */}
        {(s.causes.byKey.U ?? []).filter((e) => e.day > s.time.day - 90).slice(-4).reverse().map((e, i) => <div className="small" key={`u${i}`} data-test="u-cause"><span className={e.delta >= 0 ? 'tone-pos' : 'tone-neg'}>{F.num(e.delta, 1, true)}</span> <span className="dim">{fmtDate(dateOf(s, e.day)).replace(/,? \d{4}$/, '')}</span> {e.detail ?? e.source}</div>)}
        {decaying.map((t) => <div className="small" key={t.id}><ICON.revalidate size={11} /> <Term id="technique">{t.name}</Term> <span className="dim">fading</span> <b className={t.decay > 0.5 ? 'tone-neg' : 'tone-warn'}>{F.pct(t.decay)}</b> <span className="dim">(<Term id="mHalf">capability outgrows it</Term>)</span></div>)}
        {gone.length > 0 && <div className="small dim"><ICON.revalidate size={11} /> {gone.length} tool{gone.length > 1 ? 's' : ''} no longer work at this capability: {gone.map((t) => t.name).join(', ')}</div>}
        {masked.map((t) => <div className="small" key={`m${t.id}`}><ICON.blind size={11} /> {t.name} <span className="tone-neg">masked {F.pct(t.trainedAgainst)}</span> <span className="dim">(<Term id="goodhart">trained against</Term>)</span></div>)}
        {ev.evaluating && <div className="small"><ICON.finding size={11} /> {ev.name} is <Term id="evaluating">in evaluation</Term></div>}
        {!active.length && <div className="small dim">No detection tools active yet: staff a safety research line.</div>}
      </div>
      <div className="tip-sec"><div className="tip-cap">Levers</div><div className="btn-row wrap">
        <GoBtn to={{ panel: 'safety', tab: 'lines' }} label="Research lines" testId="race.lines" />
        <GoBtn to={{ panel: 'company', tab: 'people' }} label="Safety RE teams" testId="race.upkeep" />
        <GoBtn to={{ panel: 'blueprint' }} label="Safer recipe" testId="race.runs" />
      </div></div>
    </TipCard>
  );
}

function RaceMeter({ s }: { s: GameStateV2 }) {
  const u = engine.understanding(s);
  const ev = internalEval(s);
  const L = ev.L;
  const U = u.U;
  const W = 470;
  const lo = 4;
  const hi = 15;
  const x = (v: number) => 4 + ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * (W - 8);
  const gap = u.margin;
  return (
    <Tip as="div" className="ts-race2" content={() => <RaceTip s={s} />}>
      <div data-test="race" data-home="race" onClick={() => store.goto('safety', { tab: 'overview' })}>
        <div className="race2-lbls">
          <span className="race2-cap"><ICON.L size={12} /> CAPABILITY</span>
          <b className="num" style={{ color: C.cap }} data-home="L">{F.level(L)}</b>
          {ev.evaluating && <span className="tag2 warn" data-test="evaluating">evaluating</span>}
          <span className="sp" />
          <span className={`tag2 ${gap < 0 ? 'bad' : 'good'}`} data-home="gap">{gap < 0 ? <ICON.blind size={12} /> : <ICON.check size={12} />} {Math.abs(gap).toFixed(1)} {gap < 0 ? 'BLIND' : 'AHEAD'}</span>
          <span className="sp" />
          <b className="num" style={{ color: C.und }} data-home="U">{F.level(U)}</b>
          <span className="race2-und">UNDERSTANDING <ICON.U size={12} /></span>
        </div>
        <svg width={W} height={28} className="race2-svg">
          <defs><pattern id="hatch2" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="5" fill={C.bad} /></pattern></defs>
          <rect x={4} y={2} width={W - 8} height={8} rx={4} fill={C.line} />
          <rect x={4} y={2} width={x(L) - 4} height={8} rx={4} fill={C.cap} opacity={ev.evaluating ? 0.6 : 1} />
          <rect x={4} y={12} width={W - 8} height={8} rx={4} fill={C.line} />
          <rect x={4} y={12} width={x(U) - 4} height={8} rx={4} fill={C.und} />
          {U < L && <rect x={x(U)} y={12} width={x(L) - x(U)} height={8} fill="url(#hatch2)" opacity={0.9} />}
          {([[6.5, 'agent'], [8.5, 'research'], [10, 'SC'], [12, 'SAR'], [15, 'ASI']] as const).map(([v, n]) => (
            <g key={n}><line x1={x(v)} x2={x(v)} y1={0} y2={21} stroke={C.text3} strokeDasharray="2 2" opacity={0.7} /><text x={Math.min(W - 10, x(v))} y={28} textAnchor="middle" className="race2-ms">{n}</text></g>
          ))}
        </svg>
      </div>
    </Tip>
  );
}

function RiskChip({ s }: { s: GameStateV2 }) {
  const r = catRisk(s);
  const col = r.est > 0.2 ? C.bad : r.est > 0.05 ? C.watch : C.good;
  const top = [...r.rows].sort((a, b) => b.estimate - a.estimate).slice(0, 3);
  return (
    <Tip as="div" className="ts-stat" content={() => (
      <TipCard title={<Term id="catRisk">Catastrophe risk</Term>} value={`${F.pct(r.est, 1)} (${F.pct(r.lo)}–${F.pct(r.hi)})`} rows={top.map((x) => ({ label: x.label, value: F.pct(x.estimate, 1), tone: x.estimate > 0.1 ? 'neg' : 'neutral' }))}>
        Estimated from your beliefs, intel and exposure, never from the truth. Biggest <Term id="riskSource">sources</Term>:
      </TipCard>
    )}>
      <div className="ts-click" data-test="risk" data-home="catRisk" onClick={() => store.setPanel('risk')}>
        <Gauge value={r.est} max={1} band={[r.lo, r.hi]} fill={col} w={50} h={32} />
        <div className="ts-col"><span className="ts-l">CATASTROPHE RISK</span><span className="ts-v num" style={{ color: col }}>{F.pct(r.est)} <span className="ts-sub">{F.pct(r.lo)}–{F.pct(r.hi)}</span></span></div>
      </div>
    </Tip>
  );
}

const PART_WORD: Record<string, string> = { operating: 'Payroll & operations', commitments: 'Contracts (ledger)', chips: 'Chip balances', sites: 'Site capex', revenue: 'Revenue', funding: 'Equity tranches', debt: 'Debt repayment' };
/** Big-tech division (jank F2): cash against the parent's budget; no runway, no distress (the parent covers you). */
function DivisionCashChip({ s }: { s: GameStateV2 }) {
  const f = s.player.finance;
  const b = divisionBudget(s);
  return (
    <Tip as="div" className="ts-stat" content={() => (
      <WhyCard
        s={s} k="cash" title={<span><Term id="cash">Cash</Term> · <Term id="parentBudget">parent budget</Term></span>} value={F.money(f.cash)} fmt={(x) => F.money(x)}
        rows={[
          { label: <Term id="parentBudget">Parent budget</Term>, value: F.money(b.parentQ, { perQ: true }), tone: 'pos' },
          { label: 'Spending (next 4 q, average)', value: F.money(-b.spendQ, { signed: true, perQ: true }), tone: 'neg' },
          { label: b.over ? 'Over budget' : 'Within budget', value: F.money(Math.abs(b.overQ), { perQ: true }), tone: b.over ? 'neg' : 'pos' },
        ]}
        body="A division of the parent: it pays a budget every quarter and covers any shortfall (cash below zero is an advance against the next payment). A division cannot go broke; spending over budget only shows here."
        levers={<GoBtn to={{ panel: 'finance', anchor: 'parent' }} label="Budget" testId="cash.parent" />}
      />
    )}>
      <div className="ts-click" data-test="cash" onClick={() => store.setPanel('finance')}>
        <span className="ts-ic"><ICON.cash size={14} /></span>
        <div className="ts-col"><span className="ts-l">CASH · BUDGET</span><span className="ts-v num" data-home="cash">{F.money(f.cash)}</span></div>
        <div className="ts-runway" data-home="runway" data-test="division-budget">
          <span className="num" style={{ color: b.over ? C.watch : C.good }}>{b.over ? `over ${F.money(b.overQ)}/q` : 'within budget'}</span>
          <span className="ts-sub">parent covers</span>
        </div>
      </div>
    </Tip>
  );
}

function CashChip({ s }: { s: GameStateV2 }) {
  const f = s.player.finance;
  const { rw, live, official, review, flips, division } = runwayLive(s);
  if (division) return <DivisionCashChip s={s} />;
  const col = STATE_COLOR[f.state === 'insolvent' ? 'insolvent' : live];
  return (
    <Tip as="div" className="ts-stat" content={() => (
      <WhyCard
        s={s} k="cash" title={<span><Term id="cash">Cash</Term> · <Term id="runway">runway</Term></span>} value={`${F.money(f.cash)} · ${F.runway(rw.q, RUNWAY_CAP)}`} fmt={(x) => F.money(x)}
        rows={[
          { label: <Term id="liquidity">Liquidity</Term>, value: F.money(rw.liquidity) },
          ...(rw.low.day > s.time.day ? [{ label: 'Lowest ahead', value: `${F.money(rw.low.liquidity)} · ${fmtDate(dateOf(s, rw.low.day))}`, tone: (rw.low.liquidity < rw.floor ? 'neg' : 'pos') as 'neg' | 'pos' }] : []),
          { label: 'Minimum cash', value: F.money(rw.floor) },
          ...Object.entries(rw.parts).filter(([, v]) => Math.abs(v) > 1e-3).map(([k, v]) => ({ label: PART_WORD[k] ?? k, value: F.money(-v, { signed: true, perQ: true }), tone: (v > 0 ? 'neg' : 'pos') as 'neg' | 'pos' })),
          { label: <Term id="netBurn">Net burn</Term>, value: F.money(rw.burnQ, { perQ: true }) },
          ...(flips ? [{ label: <span>Board review {fmtDate(review)}</span>, value: <span style={{ color: STATE_COLOR[live] }}>{official} → {live}</span> }] : []),
        ]}
        body={`Projected cash over the next ${RUNWAY_CAP} quarters, each payment in the quarter it falls due (rows: per quarter, next 4 quarters). Runway zones: [[distress]] < 3q, [[tight]] < 6q, else [[healthy]].`}
        levers={<><GoBtn to={{ panel: 'finance', anchor: 'raise' }} label="Raise" testId="cash.raise" /><GoBtn to={{ panel: 'finance', anchor: 'ledger' }} label="Contracts" testId="cash.ledger" /></>}
      />
    )}>
      <div className="ts-click" data-test="cash" onClick={() => store.setPanel('finance')}>
        <span className="ts-ic"><ICON.cash size={14} /></span>
        <div className="ts-col"><span className="ts-l">CASH · RUNWAY</span><span className="ts-v num" data-home="cash">{F.money(f.cash)}</span>{flips && <span className="tag2 warn ts-flip" title={`The board reviews runway on ${fmtDate(review)}`}>{live} on {fmtDate(review).replace(/,? \d{4}$/, '')}</span>}</div>
        <div className="ts-runway" data-home="runway">
          <Gauge value={Math.min(RUNWAY_CAP, rw.q)} max={RUNWAY_CAP} zones={[{ to: 3, color: C.bad }, { to: 6, color: C.watch }, { to: RUNWAY_CAP, color: C.good }]} w={58} h={30} />
          <span className="num" style={{ color: col }}>{F.runway(rw.q, RUNWAY_CAP)} {f.state === 'insolvent' ? 'insolvent' : live}</span>
        </div>
      </div>
    </Tip>
  );
}

/** Revenue run-rate (L0 home, STRUCTURE §5): revenue only; customers and weekly users live in the tooltip. */
function RevenueChip({ s }: { s: GameStateV2 }) {
  const f = s.player.finance;
  const big = s.player.board.preset === 'parent';
  const hist = s.series.revenue?.slice(-13) ?? [];
  return (
    <Tip as="div" className="ts-stat" content={() => {
      const rd = productReadouts(s);
      const rows = s.player.deployments.filter((d) => d.status === 'live' && rd.has(d.id)).map((d) => ({ d, r: rd.get(d.id)! })).sort((a, b) => b.r.revenue - a.r.revenue);
      const now = rows.reduce((a, x) => a + x.r.revenue, 0);
      return (
        <TipCard title={<Term id="revenueRun">Revenue · 30-day average</Term>} value={F.money(f.revenueRun, { perYear: true })} rows={[
          ...rows.map(({ d, r }) => ({ label: <span>{PRODUCT_DEFS[d.channel]?.name ?? d.channel} now <span className="dim">· {F.count(r.customers)} {PRODUCT_DEFS[d.channel]?.customers ?? ''}</span></span>, value: F.money(r.revenue, { perYear: true }) })),
          { label: <b><Term id="revenueNow">All products, now</Term></b>, value: <b>{F.money(now, { perYear: true })}</b> },
        ]} footer={big ? 'A division books revenue to its parent.' : 'The 30-day average is what the board and investors judge; it trails the figure now.'}>Annualised revenue of your live products, averaged over 30 days. Click for Products.</TipCard>
      );
    }}>
      <div className="ts-click" data-test="revenue" onClick={() => store.setPanel('products')}>
        <span className="ts-ic"><ICON.revenue size={14} /></span>
        <div className="ts-col"><span className="ts-l">REVENUE · 30 D</span><span className="ts-v num" data-home="revenueRun">{F.money(f.revenueRun)}<span className="ts-sub">/yr</span></span></div>
        {hist.length > 2 && <Spark2 data={hist} w={44} h={18} color={C.good} />}
      </div>
    </Tip>
  );
}

function LeadChip({ s }: { s: GameStateV2 }) {
  const { nearest, all } = nearestRival(s);
  if (!nearest) return null;
  return (
    <Tip as="div" className="ts-stat" content={() => (
      <TipCard title={<Term id="lead">Lead</Term>} rows={all.map((r) => ({ label: r.name, value: `${F.lead(r.est)} ± ${r.sd}`, tone: r.est >= 0 ? 'pos' : 'neg' }))}>
        Days your best internal model is ahead of each lab (estimates, ± <Term id="intelError">intel error</Term>).
      </TipCard>
    )}>
      <div className="ts-click" data-test="lead" onClick={() => store.goto('overview', { anchor: 'leadtrack' })}>
        <span className="ts-ic" style={{ color: nearest.id === 'china' ? C.china : C.rival }}><ICON.lead size={14} /></span>
        <div className="ts-col"><span className="ts-l">LEAD · NEAREST</span><span className="ts-v num" data-home="leadNearest"><span className={nearest.est >= 0 ? 'tone-pos' : 'tone-neg'}>{F.lead(nearest.est)}</span> <span className="ts-sub">{nearest.name}</span></span></div>
      </div>
    </Tip>
  );
}

export function TopStrip({ s }: { s: GameStateV2 }) {
  const act = s.tutorial.act;
  return (
    <div className="topstrip2">
      <div className="ts-seg">
        <SpeedControl s={s} />
        <Tip content={() => <TipCard title={<Term id="act">{`Act ${act} · ${ACT_NAMES[act]}`}</Term>} value={`day ${s.time.day}`}>{act < 4 ? `Act ${act + 1} starts at ${ACT_TRIGGER[act + 1]}.` : 'The final act.'}</TipCard>}>
          <div className="ts-date"><span className="num" data-test="date" data-home="date">{fmtDate(dateOf(s))}</span><span className="ts-act">Act {act} · {ACT_NAMES[act]}</span></div>
        </Tip>
      </div>
      <RaceMeter s={s} />
      <RiskChip s={s} />
      <CashChip s={s} />
      <RevenueChip s={s} />
      <LeadChip s={s} />
      <span className="sp" />
      <button className="btn btn-sm btn-icon ts-help" data-test="help" title="Help: controls and coach (?)" onClick={() => store.setHelp(!store.help)}><ICON.help size={15} /></button>
      <GameMenu />
    </div>
  );
}

function GameMenu() {
  const [open, setOpen] = useState(false);
  const st = store;
  const close = () => setOpen(false);
  return (
    <div className="ff-wrap">
      <button className="btn btn-sm btn-icon" data-test="menu" onClick={() => setOpen((o) => !o)}><ICON.menu size={15} /></button>
      {open && (
        <div className="ff-menu right" data-test="menu-list">
          {SLOT_KEYS.map((k, i) => (
            <div className="ff-item ff-date" key={k}>
              <span className="small">Slot {i + 1} <span className="dim">{st.saveInfo(k) ?? 'empty'}</span></span>
              <button className="btn btn-sm" data-save={i + 1} onClick={() => { st.save(k); close(); }}>Save</button>
              <button className="btn btn-sm" data-load={i + 1} disabled={!st.hasSave(k)} onClick={() => { st.load(k); close(); }}>Load</button>
            </div>
          ))}
          <button className="ff-item" data-test="export" onClick={() => { st.download(`ai27-v2-day${st.state?.time.day ?? 0}.json`, st.exportJson()); close(); }}>Export save</button>
          <label className="ff-item">Import save
            <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) st.importJson(await f.text()); close(); }} />
          </label>
          <div className="ff-sep" />
          <div className="ff-item small dim">Auto-pause (speeds 1–4)</div>
          {([['pauseOnDecision', 'Decision'], ['pauseOnMilestone', 'Milestone'], ['pauseOnIncident', 'Incident / alert ≥ 3']] as const).map(([k, l]) => (
            <label className="ff-item" key={k}>
              <input type="checkbox" data-pref={k} checked={st.prefs[k]} onChange={(e) => st.setPrefs({ [k]: e.target.checked })} /> {l}
            </label>
          ))}
          <div className="ff-sep" />
          <button className="ff-item" data-test="quit" onClick={() => { st.save(); st.go('start'); close(); }}>Save & quit</button>
        </div>
      )}
    </div>
  );
}
