// World › Work (W8b-3, design/world/ui/mockups/world-work.png). L1: four economy tiles (US unemployment, GDP growth, AI share of
// income, work done by AI; each with its 12-month change and a sparkline from the game's weekly record), the sector table with
// the selected sector's card (WorldSectors.tsx), the jobs card and the since-start chart. One home each: the law behind worker
// relief lives on Powers (a link chip), the providers' market on Finance › Story (a link in the sector card).
import { useState } from 'react';
import type { ReactNode } from 'react';
import { REGIONS } from '../../../data/v2/sectors';
import { dateOf, fmtDate, lawStatus, unemploymentChange12m, youthExposedEmployment } from '../../../engine/v2';
import type { GameStateV2, RegionId } from '../../../engine/v2';
import { ActBtn, fmtB, fmtNum, Meter, pct, Slider, Term, Tip, TipCard, Why } from '../ui';
import { Ref } from '../kit';
import { WorldSectors } from './WorldSectors';
import { POWERS } from './worldLinks';

const REGION_NAME: Record<RegionId, string> = { US: 'US', CN: 'China', ROW: 'Rest of world' };
const WEEKS_12M = 52;

/** The value a year ago from a weekly series (the oldest sample when the game is younger than a year), and whether it is a full year. */
function yearAgo(h: number[] | undefined): { v: number; full: boolean } | undefined {
  if (!h || h.length < 2) return undefined;
  const i = h.length - 1 - WEEKS_12M;
  return { v: h[Math.max(0, i)], full: i >= 0 };
}

type Tone = 'pos' | 'neg' | 'neutral';
interface Delta { text: string; tone: Tone; up: boolean; full: boolean; flat?: boolean }
interface TileProps { id: string; term: string; label: string; big: string; delta?: Delta; spark?: number[]; sparkColor: string; tip: () => ReactNode }
function Tile({ id, term, label, big, delta, spark, sparkColor, tip }: TileProps) {
  return (
    <Tip as="div" content={tip}>
      <div className="wk-tile" data-test={`wk-tile.${id}`}>
        <div className="wk-cap"><Term id={term}>{label}</Term></div>
        <div className="wk-big"><span className="num">{big}</span><span className="wk-unit">%</span></div>
        {delta && <div className={`wk-delta tone-${delta.tone}`}>{delta.flat ? <span>no change</span> : <><span>{delta.up ? '▲' : '▼'}</span> <span className="num">{delta.text}</span></>} <span className="dim">· {delta.full ? '12 mo' : 'since start'}</span></div>}
        {spark && spark.length >= 2 && <SparkFill data={spark} color={sparkColor} />}
      </div>
    </Tip>
  );
}

/** A filled sparkline of a recorded series. */
function SparkFill({ data, color }: { data: number[]; color: string }) {
  const W = 120; const H = 44;
  const lo = Math.min(...data); const top = Math.max(...data);
  const hi = Math.max(top, lo + 0.15 * Math.max(Math.abs(top), 1e-9)); // a flat series stays flat
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, H - 3 - ((v - lo) / (hi - lo || 1)) * (H - 8)] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg className="wk-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <polygon points={`0,${H} ${line} ${W},${H}`} fill={color} opacity={0.16} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function EconomyTiles({ s }: { s: GameStateV2 }) {
  const S = s.series;
  const us = s.world.macro.US;
  const w = s.world;
  const dUnemp = unemploymentChange12m(s);
  const workNow = S.aiWork?.[S.aiWork.length - 1];
  const pp = (x: number) => `${Math.abs(x).toFixed(x !== 0 && Math.abs(x) < 0.1 ? 2 : 1)} pp`;
  const mk = (now: number, then: { v: number; full: boolean } | undefined, goodUp: boolean | null): Delta | undefined => {
    if (!then) return undefined;
    const x = (now - then.v) * 100;
    const tone: Tone = goodUp === null || Math.abs(x) < 0.05 ? 'neutral' : (x > 0) === goodUp ? 'pos' : 'neg';
    return { text: pp(x), tone, up: x >= 0, full: then.full, flat: Math.abs(x) < 0.005 };
  };
  const gdpD = mk(us.g, yearAgo(S.gdpG), true);
  const incD = mk(w.aiIncomeShare, yearAgo(S.aiIncome), null);
  const workD = workNow !== undefined ? mk(workNow, yearAgo(S.aiWork), null) : undefined;
  return (
    <div className="wk-tiles" data-test="wk-tiles">
      <Tile id="unemp" term="unemployment" label="Unemployment · US" big={w.unemployment.US.toFixed(1)}
        delta={{ text: `${Math.abs(dUnemp).toFixed(2)} pp`, tone: Math.abs(dUnemp) < 0.005 ? 'neutral' : dUnemp > 0 ? 'neg' : 'pos', up: dUnemp >= 0, full: (yearAgo(S.unemp)?.full ?? true), flat: Math.abs(dUnemp) < 0.005 }}
        spark={S.unemp} sparkColor="var(--neg)"
        tip={() => <TipCard title={<Term id="unemployment">US unemployment</Term>} value={`${w.unemployment.US.toFixed(1)}%`} rows={[
          { label: '12-month change', value: `${dUnemp >= 0 ? '+' : '−'}${Math.abs(dUnemp).toFixed(2)} pp`, tone: dUnemp > 0.005 ? 'neg' : 'neutral' },
          { label: <Term id="youthUnemp">Youth unemployment</Term>, value: `${w.youthUnemployment.toFixed(1)}%` },
          { label: 'Exposed youth jobs (vs start)', value: pct(youthExposedEmployment(s)) },
        ]}>Share of US workers without a job who are looking for one.</TipCard>} />
      <Tile id="gdp" term="gdpG" label="GDP growth" big={(us.g * 100).toFixed(1)} delta={gdpD} spark={S.gdpG} sparkColor="var(--pos)"
        tip={() => <TipCard title={<Term id="gdpG">US GDP growth</Term>} value={pct(us.g, 1)}>Real growth, yearly.</TipCard>} />
      <Tile id="income" term="aiIncomeShare" label="AI share of income" big={(w.aiIncomeShare * 100).toFixed(1)} delta={incD} spark={S.aiIncome} sparkColor="#e08a3c"
        tip={() => <TipCard title={<Term id="aiIncomeShare">AI share of income</Term>} value={pct(w.aiIncomeShare, 1)}>AI companies' revenue as a share of US GDP.</TipCard>} />
      <Tile id="work" term="automationShare" label="Work done by AI" big={workNow !== undefined ? (workNow * 100).toFixed(1) : '–'} delta={workD} spark={S.aiWork} sparkColor="#3bb3a0"
        tip={() => <TipCard title={<Term id="automationShare">Work done by AI</Term>} value={workNow !== undefined ? pct(workNow, 1) : '–'}>Share of US work-hours AI does itself, weighted by sector wages.</TipCard>} />
    </div>
  );
}

function Jobs({ s }: { s: GameStateV2 }) {
  const [fund, setFund] = useState(s.player.policies.transitionFund + 5);
  const relief = lawStatus(s).find((l) => l.id === 'relief');
  return (
    <section className="section wk-jobs" data-test="wk-jobs">
      <div className="section-head">
        <span className="section-title">Jobs</span>
        {relief && (
          <Tip content={() => <TipCard title={<Term id="lawRelief">{relief.name}</Term>} value={relief.inForce ? `in force since ${fmtDate(dateOf(s, relief.since!))}` : 'not in force'} rows={[{ label: 'Turns on', value: relief.on.replace(/^On when /, '') }, { label: 'Turns off', value: relief.off.replace(/^Off when /, '') }]} footer="Its home is Powers." />}>
            <span><Ref id="lawRelief" to={POWERS}><i className={`wk-dot ${relief.inForce ? 'on' : ''}`} />Worker relief · {relief.inForce ? 'in force' : 'not in force'}</Ref></span>
          </Tip>
        )}
      </div>
      {REGIONS.map((r) => (
        <div className="wk-jrow" key={r}>
          <span className="wk-jk"><Term id="unemployment">Unemployment</Term> · {REGION_NAME[r]}</span>
          <Meter value={s.world.unemployment[r]} max={25} color="var(--neg)" />
          <Why k={`world.unemployment.${r}`} title={`Unemployment · ${REGION_NAME[r]}`} fmt={(x) => `${x.toFixed(2)} pp`} invert><span className="num wk-jv" data-home={`unemp.${r}`}>{s.world.unemployment[r].toFixed(1)}%</span></Why>
        </div>
      ))}
      <div className="wk-jrow">
        <span className="wk-jk"><Term id="displaced">Displaced workers</Term> · US</span>
        <span />
        <Tip content={() => <TipCard title={<Term id="displaced">Displaced workers (US)</Term>} value={fmtNum(s.world.displacedPool.US)}>People whose jobs AI took who have not found new work.</TipCard>}><span className="num wk-jv">{fmtNum(s.world.displacedPool.US)} people</span></Tip>
      </div>
      <div className="wk-fund">
        <Tip content={() => <TipCard title={<Term id="transitionFund">Transition fund</Term>} value={`${fmtB(fund)}/yr`}>Drag, then Set: paid every year from your cash.</TipCard>}><span><Term id="transitionFund">Transition fund</Term> <b className="num">{fmtB(fund)} / yr</b></span></Tip>
        <Slider value={fund} min={0} max={100} step={1} onChange={setFund} width={150} />
        <ActBtn id="wfx.transitionFund" params={{ amount: fund }} label="Set" />
      </div>
    </section>
  );
}

/** Unemployment and work done by AI since the start, from the weekly record (one % axis). */
function SinceStart({ s }: { s: GameStateV2 }) {
  const S = s.series;
  const n = Math.min(S.day.length, S.unemp.length, S.aiWork?.length ?? 0);
  if (n < 2) return null;
  const days = S.day.slice(-n);
  const u = S.unemp.slice(-n);
  const a = S.aiWork!.slice(-n).map((x) => x * 100);
  const W = 620; const H = 170; const L = 34; const R = 8; const T = 8; const B = 20;
  const top = Math.max(...u, ...a);
  const step = top <= 6 ? 1 : top <= 12 ? 2 : top <= 30 ? 5 : 10;
  const hi = Math.max(5, Math.ceil(top / step) * step);
  const X = (i: number) => L + (i / (n - 1)) * (W - L - R);
  const Y = (v: number) => T + (1 - v / hi) * (H - T - B);
  const path = (v: number[]) => v.map((x, i) => `${X(i).toFixed(1)},${Y(x).toFixed(1)}`).join(' ');
  const ticks = Array.from({ length: Math.floor(hi / step) + 1 }, (_, i) => i * step);
  const xl = [0, Math.floor((n - 1) / 2), n - 1];
  return (
    <section className="section wk-chart" data-test="wk-chart">
      <div className="section-head">
        <span className="section-title">Since {fmtDate(dateOf(s, days[0]))}</span>
        <span className="wk-leg"><span><i style={{ background: 'var(--neg)' }} />unemployment, US</span><span><i style={{ background: '#3bb3a0' }} /><Term id="automationShare">work done by AI</Term></span></span>
      </div>
      <Tip as="div" content={() => <TipCard title="Since the start" rows={[
        { label: 'Unemployment, US', value: `${u[0].toFixed(1)}% → ${u[n - 1].toFixed(1)}%` },
        { label: 'Work done by AI', value: `${a[0].toFixed(1)}% → ${a[n - 1].toFixed(1)}%` },
      ]}>Weekly record, one axis.</TipCard>}>
        <svg viewBox={`0 0 ${W} ${H}`} className="wk-svg" preserveAspectRatio="xMidYMid meet">
          {ticks.map((t) => <g key={t}><line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} stroke="rgba(51,67,90,.55)" /><text x={L - 5} y={Y(t) + 3} textAnchor="end" className="wk-ax">{Math.round(t)}%</text></g>)}
          {xl.map((i) => <text key={i} x={i === 0 ? L : i === n - 1 ? W - R : X(i)} y={H - 5} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="wk-ax">{fmtDate(dateOf(s, days[i]))}</text>)}
          <polyline points={path(u)} fill="none" stroke="var(--neg)" strokeWidth={1.8} />
          <polyline points={path(a)} fill="none" stroke="#3bb3a0" strokeWidth={1.8} />
        </svg>
      </Tip>
    </section>
  );
}

export function WorldWork({ s, names }: { s: GameStateV2; names: (id: string) => string }) {
  return (
    <div className="wk" data-test="world-work">
      <EconomyTiles s={s} />
      <WorldSectors s={s} names={names} right={<><Jobs s={s} /><SinceStart s={s} /></>} />
    </div>
  );
}
