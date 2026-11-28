// Top strip (UB-5; UI-IA §0 L0): clock · research speed · lead · cash·runway (revenue in its tooltip) · loss-of-control
// risk (small) · help · menu. The alert channel is the bottom bar. Capability and catastrophe risk left L0 (UI-IA §0).
// Each item is the HOME of its datum (data-home); hover = why, click = the panel that changes it.
import { useState } from 'react';
import { chanceCertainty, dateOf, divisionView, engine, fmtDate, isUnknown, labSpeedLimits, lossOfControlRisk, poolsOf, researchSpeedReadout, RUNWAY_CAP, SLOT_KEYS, teamsOfKey, workTypeViews } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { store } from '../store';
import { ACT_NAMES, Limit, Term, Tip, TipCard, WhyCard } from '../ui';
import { GoBtn, Spark2 } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C, STATE_COLOR } from '../theme';
import { SpeedControl } from './SpeedControl';
import { catRisk, divisionStatus, nearestRival, runwayLive } from './selectors';

export { catRisk, nearestRival, runwayLive };

/** What triggers each act (engine tutorial rules; shown in the date hover and the Goals card). */
export const ACT_TRIGGER: Record<number, string> = { 2: 'capability level 6.5 or day 150', 3: 'capability level 8.5', 4: 'capability level 12 or research speed ×25' };

/** L0 #6 Research speed (UB-5; UI-IA §0): × the leading lab in July 2025, a 90-day trend arrow; the tooltip shows what
 *  it runs on, AI staff's part and its history (UB-2 researchSpeedReadout, beliefs and measurements only). Click → RESEARCH. */
function SpeedChip({ s }: { s: GameStateV2 }) {
  const r = researchSpeedReadout(s);
  const tr = r.trend90;
  const up = tr !== undefined && tr > 1.02;
  const down = tr !== undefined && tr < 0.98;
  const Arrow = up ? TrendingUp : down ? TrendingDown : undefined;
  const tip = () => {
    const pools = poolsOf(s);
    const wts = workTypeViews(s);
    const exp = wts.find((w) => w.wt === 'EXP');
    const ideas = wts.find((w) => w.wt === 'IDEAS');
    const lim = engine.production(s, 'player').label;
    const hist = r.history.filter((h) => h.day >= s.time.day - 90).map((h) => h.speed);
    const ago = (d: number) => [...r.history].reverse().find((h) => h.day <= s.time.day - d);
    const h90 = ago(90);
    const h30 = ago(30);
    return (
      <TipCard title={<Term id="labSpeed">Research speed</Term>} value={`×${r.now.toFixed(1)}`} rows={[
        { label: <span><Term id="poolExperiments">Compute on research</Term> <span className="dim">· experiments {F.h100e(pools.experiments)} · AI staff {F.h100e(pools.routine + pools.frontier)}</span></span>, value: `${F.h100e(pools.experiments + pools.routine + pools.frontier)} H100e` },
        ...(exp ? [{ label: <span><Term id="roleRE">Research engineers</Term> <span className="dim">· {teamsOfKey(s.player, 're.cap').length} teams</span></span>, value: <span>work ×{Math.max(1, exp.m).toFixed(1)}</span> }] : []),
        ...(ideas ? [{ label: <span><Term id="roleSci">Scientists</Term> <span className="dim">· {teamsOfKey(s.player, 'sci.cap').length} teams</span></span>, value: <span>work ×{Math.max(1, ideas.m).toFixed(1)}</span> }] : []),
        { label: <span>From <Term id="agentPackage">AI staff</Term> <span className="dim">· experiments ×{r.aiExperiments.toFixed(2)} · ideas ×{r.aiIdeas.toFixed(2)}</span></span>, value: `×${r.ai.toFixed(2)}` },
        { label: 'Without AI staff', value: `×${r.withoutAI.toFixed(1)}` },
        ...(h90 ? [{ label: <span>90 days ago{h30 ? ` · 30 days ago ×${h30.speed.toFixed(1)}` : ''}</span>, value: `×${h90.speed.toFixed(1)}` }] : []),
        { label: <span className="row-i"><Term id="bottleneck">Limited by</Term> <GoBtn to={{ panel: 'lab', anchor: 'bestMoves' }} label="best moves" testId="speed.moves" /></span>, value: <span className="tone-warn">{LIMIT_WORD[lim] ?? F.words(lim)}</span> },
        ...labSpeedLimits(s).map((l) => ({ label: <span className="dim">{l.id === 'speed.pause' ? 'Research pause' : <Term id="diffusion">Knowledge diffusion</Term>}</span>, value: <Limit id={l.id} tone={l.binding ? (l.mult < 1 ? 'bind' : 'warn') : 'quiet'}>{l.text}</Limit> })),
      ]} footer={hist.length > 2 ? <span className="row-i">Last 90 days <Spark2 data={hist} w={110} h={18} /></span> : 'History builds up week by week.'}>
        How fast your lab turns compute and people into research results, against the leading lab in July 2025 (×1). Your estimate.
      </TipCard>
    );
  };
  return (
    <Tip as="div" className="ts-stat ts-hero" content={tip}>
      <div className="ts-click" data-test="speed" data-home="labSpeed" onClick={() => store.goto('research')}>
        <span className="ts-ic"><ICON.M size={16} /></span>
        <div className="ts-col"><span className="ts-l"><Term id="labSpeed">RESEARCH SPEED</Term></span><span className="ts-v num">×{r.now.toFixed(1)}{Arrow && <Arrow size={14} className={up ? 'tone-pos' : 'tone-neg'} />}</span></div>
      </div>
    </Tip>
  );
}
const LIMIT_WORD: Record<string, string> = { 'compute-bound': 'compute', 'labor-bound': 'research engineers', 'human-bound': 'research engineers', 'taste-bound': 'idea quality' };

/** L0 #5 Lead · nearest (UB-5): "154 d behind Meridian"; each lab's estimate with its 90% range in the tooltip (B·intel). */
function LeadChip({ s }: { s: GameStateV2 }) {
  const { nearest, all } = nearestRival(s);
  if (!nearest) return null;
  const d = Math.round(nearest.est);
  const word = d >= 0 ? 'ahead of' : 'behind';
  const rng = (r: { est: number; sd: number }) => `${Math.round(r.est - 1.64 * r.sd)} to ${Math.round(r.est + 1.64 * r.sd)} d`;
  return (
    <Tip as="div" className="ts-stat" content={() => (
      <TipCard title={<Term id="lead">Lead</Term>} value={`${Math.abs(d)} d ${word} ${nearest.name}`} rows={all.map((r) => ({ label: r.name, value: <span>{Math.round(r.est) >= 0 ? '+' : '−'}{Math.abs(Math.round(r.est))} d <span className="dim">({rng(r)})</span></span>, tone: r.est >= 0 ? 'pos' as const : 'neg' as const }))}>
        Days your newest public model is ahead of each lab's newest (minus = behind): estimates from intel, with a 90% range.
      </TipCard>
    )}>
      <div className="ts-click" data-test="lead" onClick={() => store.goto('overview', { anchor: 'leadtrack' })}>
        <span className="ts-ic" style={{ color: nearest.id === 'china' ? C.china : C.rival }}><ICON.lead size={16} /></span>
        <div className="ts-col"><span className="ts-l"><Term id="lead">LEAD</Term></span><span className="ts-v num" data-home="leadNearest"><span className={d >= 0 ? 'tone-pos' : 'tone-neg'}>{Math.abs(d)} d</span> <span className="ts-sub">{word} {nearest.name}</span></span></div>
      </div>
    </Tip>
  );
}

/** L0 #7 Loss-of-control risk (UB-5; small): the highest believed chance over the models you run, "< 0.1%", its range,
 *  or Unknown when the range is wider than 30 points (isUnknown). The gauge lives on SAFETY. */
function LossChip({ s }: { s: GameStateV2 }) {
  const r = lossOfControlRisk(s);
  const unknown = !!r && isUnknown(r.lo, r.hi);
  const show = (x: number) => (x < 0.001 ? '< 0.1%' : F.pct(x, x < 0.1 ? 1 : 0));
  const v = !r ? 'none' : unknown ? 'Unknown' : show(r.p);
  const col = !r || unknown ? C.text2 : r.p >= 0.1 ? C.bad : r.p >= 0.01 ? C.watch : C.text;
  return (
    <Tip as="div" className="ts-stat ts-small" content={() => (
      <TipCard title={<Term id="lossRisk">Loss-of-control risk</Term>} value={v} rows={r ? [
        { label: 'Best guess', value: show(r.p) }, { label: '90% range', value: `${show(r.lo)} – ${show(r.hi)}` },
        { label: 'Certainty', value: chanceCertainty(r.lo, r.hi).unknown ? 'Unknown (range wider than 30 points)' : chanceCertainty(r.lo, r.hi).word },
      ] : []} footer="Click for Safety › Risks.">
        {r ? 'Your believed chance that a model you run could act against you with nothing able to stop it, if it could act now: the highest over your running models.' : 'No model of yours runs inside the lab yet.'}
      </TipCard>
    )}>
      <div className="ts-click" data-test="risk" data-home="lossRisk" onClick={() => store.goto('safety')}>
        <span className="ts-ic"><ICON.risk size={14} /></span>
        <div className="ts-col"><span className="ts-l"><Term id="lossRisk">LOSS-OF-CONTROL RISK</Term></span><span className="ts-v num" style={{ color: col, fontSize: 15 }}>{v}</span></div>
      </div>
    </Tip>
  );
}


const PART_WORD: Record<string, string> = { operating: 'Payroll & operations', commitments: 'Contracts (ledger)', chips: 'Chip balances', sites: 'Site capex', revenue: 'Revenue', funding: 'Equity tranches', debt: 'Debt repayment' };
/** Big-tech division (jank F2, FIN5c): cash is the budget balance; the verdict is the budget year, not a runway (the
 *  parent covers an overspend, at a cost in parent confidence). */
function DivisionCashChip({ s }: { s: GameStateV2 }) {
  const f = s.player.finance;
  const v = divisionView(s)!;
  const st = divisionStatus(v);
  return (
    <Tip as="div" className="ts-stat" content={() => (
      <WhyCard
        s={s} k="cash" title={<span><Term id="cash">Cash</Term> · <Term id="parentBudget">parent budget</Term></span>} value={F.money(f.cash)} fmt={(x) => F.money(x)}
        rows={[
          { label: <Term id="parentBudget">Budget this year</Term>, value: F.money(v.budget) },
          { label: 'Spent so far', value: F.money(v.spent) },
          { label: 'At the review (projected)', value: F.money(v.projectedEnd, { signed: true }), tone: v.projectedEnd < 0 ? 'neg' : 'pos' },
          { label: st.tone === 'good' ? 'Within budget' : 'Over budget', value: st.short, tone: st.tone === 'good' ? 'pos' : 'neg' },
        ]}
        body="A division of the parent: cash is what is left of the budget. Below zero the parent pays the bills (a division cannot go broke) and its later payments repay it first; at each yearly review it minds any overspend it is still covering (parent confidence, which sets the next budget)."
        levers={<GoBtn to={{ panel: 'finance', anchor: 'parent' }} label="Budget" testId="cash.parent" />}
      />
    )}>
      <div className="ts-click" data-test="cash" onClick={() => store.setPanel('finance')}>
        <span className="ts-ic"><ICON.cash size={14} /></span>
        <div className="ts-col"><span className="ts-l">CASH · BUDGET</span><span className="ts-v num" data-home="cash">{F.money(f.cash)}</span></div>
        <div className="ts-runway" data-home="runway" data-test="division-budget" data-status={v.status}>
          <span className="num" style={{ color: st.tone === 'good' ? C.good : st.tone === 'watch' ? C.watch : C.bad }}>{st.short}</span>
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
          { label: <Term id="revenueRun">Revenue · 30-day average</Term>, value: F.money(f.revenueRun, { perYear: true }) },
          ...(flips ? [{ label: <span>Board review {fmtDate(review)}</span>, value: <span style={{ color: STATE_COLOR[live] }}>{official} → {live}</span> }] : []),
        ]}
        body={`Projected cash over the next ${RUNWAY_CAP} quarters, each payment in the quarter it falls due (rows: per quarter, next 4 quarters). Runway zones: [[distress]] < 3q, [[tight]] < 6q, else [[healthy]].`}
        levers={<><GoBtn to={{ panel: 'finance', anchor: 'raise' }} label="Raise" testId="cash.raise" /><GoBtn to={{ panel: 'finance', anchor: 'ledger' }} label="Contracts" testId="cash.ledger" /></>}
      />
    )}>
      <div className="ts-click" data-test="cash" onClick={() => store.setPanel('finance')}>
        <span className="ts-ic"><ICON.cash size={14} /></span>
        <div className="ts-col"><span className="ts-l">CASH · <Term id="runway">RUNWAY</Term></span><span className="ts-v num"><span data-home="cash">{F.money(f.cash)}</span> <span className="ts-sub" data-home="runway" style={{ color: col }}>· {rw.q >= RUNWAY_CAP ? `${RUNWAY_CAP}+ qtrs` : `${rw.q.toFixed(1)} qtrs`}{live !== 'healthy' || f.state === 'insolvent' ? ` ${f.state === 'insolvent' ? 'insolvent' : live}` : ''}</span></span>{flips && <span className="tag2 warn ts-flip" title={`The board reviews runway on ${fmtDate(review)}`}>{live} on {fmtDate(review).replace(/,? \d{4}$/, '')}</span>}</div>
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
      <SpeedChip s={s} />
      <LeadChip s={s} />
      <CashChip s={s} />
      <LossChip s={s} />
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
