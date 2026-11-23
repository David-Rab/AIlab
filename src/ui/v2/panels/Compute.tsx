// Compute (design/ux/COMPUTE.md). Overview (L1): three verdicts, the capacity and fleet forecast, and three ways to add
// compute (chips, data centres, cloud) with fine options folded away. Tabs (L2): Sites and Orders & market (deliveries, cloud
// and the chip market on one tab). The compute allocation lives on LAB (UB-5), linked from the header.
// HOME of idle chips, empty racks, vendor fill, the forecast, sites & power, the split, orders, cloud contracts and the
// chip market. Compute online lives in Company (its flow tab) and is only linked here.
import { useEffect, useState, type ReactNode } from 'react';
import { actionView, cancellablePricePerYear, chipFit, chipQuote, cloudPricePerYear, computeForecast, computeHistory, dateOf, dayOfQuarter, fmtDate, fmtMonth, leaseGuarantor, leaseRate, oppositionOdds, payOptions, qOf, rentQuote, siteCapex, siteEtaQ, siteLeasePerYear, siteRVG, siteSchedule, siteSizeView, spotPrice, spotRentalView, supplierTerms, SUPPLIER } from '../../../engine/v2';
import type { ChipOrder, ForecastEvent, ForecastQ, GameStateV2, PayOption, Site } from '../../../engine/v2';

/** The lessor's rate at your rating (FIN4b: below B only with a partner's guarantee, named). */
const leaseLimit = (s: GameStateV2) => {
  const r = leaseRate(s);
  const g = leaseGuarantor(s);
  return r === undefined ? `no lease at ${s.player.finance.rating}` : `lease ${F.pct(r)} at ${s.player.finance.rating}${g ? ` · ${g} guarantee` : ''}`;
};
import { CHIP_TIERS, SITE_PATHS, SITE_TIERS } from '../../../data/v2/deals';
import { store } from '../store';
import { act as engineAct, runwayOf } from '../../../engine/v2';
import type { CostLine } from '../../../engine/v2';
import { ActBtn, Limit, Gate, Seg, Term, Tip, TipCard, Toggle } from '../ui';
import { Card, HBar, KV, OptionTile, PanelHead, Pill, Ref, Spark2, tabOf, Tabs } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';
import './compute.css';
import { payOptionsPV } from '../../../engine/v2/finance/pv';

const PATHS: { id: Site['path']; label: string; term: string; icon: typeof ICON.sites }[] = [
  { id: 'lease', label: 'Colo', term: 'colo', icon: ICON.pathLease }, { id: 'brownfield', label: 'Brownfield', term: 'brownfield', icon: ICON.pathBrownfield },
  { id: 'gas', label: 'Gas', term: 'gasPower', icon: ICON.pathGas }, { id: 'grid', label: 'Grid', term: 'gridPower', icon: ICON.pathGrid }, { id: 'nuclear', label: 'Nuclear', term: 'nuclearPower', icon: ICON.pathNuclear },
];
const STAGE_COLOR: Record<Site['stage'], string> = { permitting: '#8a9bb0', power: C.watch, building: C.you, live: C.good, blocked: C.bad };
const STAGE_LABEL: Record<Site['stage'], string> = { permitting: 'permitting', power: 'power', building: 'construction', live: 'live', blocked: 'blocked' };
const STAGE_TERM: Partial<Record<Site['stage'], string>> = { permitting: 'permitting', power: 'gridPool', building: 'capex' };
const KIND_COLOR: Record<ChipOrder['kind'], string> = { spot: C.watch, standard: '#8a9bb0', lta: C.you };
const COMP: { k: 'Kpkg' | 'Khbm' | 'Kwafer'; bind: string; label: string; term: string }[] = [
  { k: 'Kpkg', bind: 'packaging', label: 'Packaging', term: 'packaging' }, { k: 'Khbm', bind: 'hbm', label: 'HBM', term: 'hbm' }, { k: 'Kwafer', bind: 'wafer', label: 'Wafer', term: 'wafer' },
];
const FC = { cloud: '#7c8ea6', run: C.you, inst: '#8fbff0', idle: C.bad, line: '#e3e9f1' };
const qLabel = (s: GameStateV2, q: number) => {
  const d = dateOf(s, dayOfQuarter(s.time.startDate, q));
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${String(d.getUTCFullYear()).slice(2)}`;
};
const evText = (e: ForecastEvent) =>
  e.kind === 'siteLive' ? `${e.name} live · +${F.power(e.mw)}` : e.kind === 'delivery' ? 'Chips delivered' : e.kind === 'cloudStart' ? `${e.name} starts` : `${e.name} ends`;
const evSigned = (e: ForecastEvent) => F.count(e.kind === 'cloudEnd' ? -e.h : e.h, true);

// ═════════════════════════ Overview ═════════════════════════

const axisLabel = (v: number) => (v === 0 ? '0' : v >= 1e6 ? `${+(v / 1e6).toFixed(2)}M` : `${Math.round(v / 1e3)}K`);

/** Pixel size of a box (ResizeObserver), so SVG text keeps its size while the chart fills the card. */
function useBox(w0: number, h0: number): [{ w: number; h: number }, (el: HTMLDivElement | null) => void] {
  const [box, setBox] = useState({ w: w0, h: h0 });
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width), h = Math.round(e.contentRect.height);
      if (w > 50 && h > 50) setBox((b) => (b.w === w && b.h === h ? b : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [box, setEl];
}

/** Three verdicts: chips now, racks ahead, vendor supply. Each opens its detail tab. */
function Status({ s, fc }: { s: GameStateV2; fc: ForecastQ[] }) {
  const now = fc[0];
  const ahead = fc.slice(1);
  const fleet = now.running + now.installing + now.idle;
  // 1. chips now
  let t1: { tone: string; icon: typeof ICON.idle; v?: string; l: ReactNode; sub: ReactNode };
  if (now.idle > 0.01 * Math.max(1, fleet)) {
    const clear = ahead.find((q) => q.idle < 0.01 * Math.max(1, fleet));
    const site = clear?.events.find((e): e is Extract<ForecastEvent, { kind: 'siteLive' }> => e.kind === 'siteLive');
    t1 = {
      tone: 'bad', icon: ICON.noPower, v: F.count(now.idle), l: <>H100e <Term id="idleChips">idle</Term> · racks full</>,
      sub: clear ? <>Clears <b>{qLabel(s, clear.q)}</b>{site ? <> when {site.name} goes live</> : null}</> : <>No new racks in view</>,
    };
  } else if (now.installing > 0) {
    t1 = { tone: 'ok', icon: ICON.compute, v: F.count(now.installing), l: <>H100e <Term id="installing">installing</Term></>, sub: <>Online <b>{qLabel(s, now.q + 1)}</b></> };
  } else t1 = { tone: 'ok', icon: ICON.check, l: 'All delivered chips running', sub: <>No <Term id="idleChips">idle chips</Term></> };
  // 2. racks ahead
  const fleetAt = (q: ForecastQ) => q.running + q.installing + q.idle;
  const late = now.idle <= 0.01 * Math.max(1, fleet) ? ahead.find((q) => q.idle > 0.01 * Math.max(1, fleetAt(q))) : undefined;
  const isEmpty = (q: ForecastQ) => q.empty > Math.max(50e3, 0.1 * q.racks);
  const firstEmpty = fc.find(isEmpty);
  const last = fc[fc.length - 1];
  let t2: { tone: string; icon: typeof ICON.idle; v?: string; l: ReactNode; sub: ReactNode };
  if (late) {
    const run = ahead.slice(ahead.indexOf(late));
    const end = run.find((q) => q.idle <= 0.01 * Math.max(1, fleetAt(q)));
    const peak = Math.max(...run.slice(0, end ? run.indexOf(end) : run.length).map((q) => q.idle));
    t2 = { tone: 'bad', icon: ICON.noPower, v: F.count(peak), l: <>H100e arrive with no racks</>, sub: <>From <b>{qLabel(s, late.q)}</b>{end ? <> until {qLabel(s, end.q)}</> : null}</> };
  }
  else if (firstEmpty) {
    t2 = {
      tone: 'warn', icon: ICON.serving, v: F.count(firstEmpty.empty), l: <>H100e of <Term id="emptyRacks">racks empty</Term> {firstEmpty.now ? 'now' : `from ${qLabel(s, firstEmpty.q)}`}</>,
      sub: last.empty > firstEmpty.empty * 1.1 ? <>Grows to <b>{F.count(last.empty)}</b> by {qLabel(s, last.q)}</> : <>Through {qLabel(s, last.q)}</>,
    };
  } else t2 = { tone: 'ok', icon: ICON.check, l: 'Chips and racks matched', sub: <>Through {qLabel(s, last.q)}</> };
  // 3. vendor fill
  const fill = s.market.ws3.playerFill;
  // Jank C2: the scarcest component only "binds" when demand reaches supply.
  const binds = s.market.demandQ >= 0.95 * s.market.supplyQ;
  const comp = <Term id={s.market.binding === 'hbm' ? 'hbm' : s.market.binding === 'wafer' ? 'wafer' : 'packaging'}>{COMP.find((c) => c.bind === s.market.binding)?.label ?? 'Packaging'}</Term>;
  const t3 = { tone: fill >= 0.9 ? 'ok' : fill >= 0.7 ? 'warn' : 'bad', icon: ICON.supply, v: F.pct(fill), l: <Term id="vendorFill">vendor fill</Term>, sub: binds ? <>{comp}-bound</> : <>supply above demand · tightest: {comp}</> };
  const tile = (t: typeof t1, home: string, tab: string) => (
    <button className={`cst ${t.tone}`} data-home={home} onClick={() => store.goto('compute', { tab })}>
      <span className="cst-ic"><t.icon size={19} /></span>
      <span className="cst-body">
        <span className="cst-top">{t.v && <b className="num">{t.v}</b>}<span>{t.l}</span></span>
        <span className="cst-sub">{t.sub}</span>
      </span>
      <ICON.go size={14} className="cst-go" />
    </button>
  );
  return (
    <div className="cst-row">
      {tile(t1, 'idleChips', 'sites')}
      {tile(t2, 'emptyRacks', 'orders')}
      {tile({ ...t3 }, 'vendorFill', 'orders')}
    </div>
  );
}

/** Capacity and fleet: owned racks + cloud (line) against chips by state (bars): recorded past quarters, now, planned. */
function Forecast({ s, fc, later }: { s: GameStateV2; fc: ForecastQ[]; later: { q: number; ev: ForecastEvent }[] }) {
  const [hover, setHover] = useState<number>();
  const [box, ref] = useBox(1000, 470);
  const W = box.w, H = box.h, L = 54, R = 14, T = 30, B = 34;
  const n = fc.length;
  const bw = (W - L - R) / n;
  const nowIdx = Math.max(0, fc.findIndex((q) => q.now));
  const planned = (q: ForecastQ) => !q.now && !q.past;
  const raw = Math.max(1, ...fc.map((q) => Math.max(q.racks + q.cloud, q.cloud + q.running + q.installing + q.idle))) * 1.08;
  const step = [0.25e6, 0.5e6, 1e6, 2e6, 2.5e6, 5e6, 10e6, 20e6, 25e6, 50e6, 100e6].find((x) => raw / x <= 6) ?? 200e6;
  const ymax = Math.ceil(raw / step) * step;
  const y = (v: number) => T + (H - T - B) * (1 - v / ymax);
  const x = (i: number) => L + i * bw;
  const ticks: number[] = [];
  for (let v = 0; v <= ymax + 1; v += step) ticks.push(v);
  const line = fc.map((q, i) => `${i ? 'L' : 'M'}${x(i)},${y(q.racks + q.cloud)} L${x(i) + bw},${y(q.racks + q.cloud)}`).join(' ');
  const firstEmpty = fc.findIndex((q, i) => i >= nowIdx && q.empty > Math.max(50e3, 0.1 * q.racks));
  const labels: { i: number; e: ForecastEvent }[] = [];
  fc.forEach((q, i) => q.events.filter((e) => e.kind !== 'delivery').forEach((e) => labels.push({ i, e })));
  return (
    <Card title="Capacity and fleet" sub="H100e by quarter · past, now and planned" home="computeForecast" className="cfc"
      right={<span className="legend2 cfc-leg">
        <span><i className="ln" /><Term id="poweredCapacity">Powered capacity</Term></span>
        <span><i style={{ background: FC.run }} />Running</span><span><i style={{ background: FC.cloud }} />Cloud</span>
        <span><i style={{ background: FC.inst }} />Installing</span><span><i style={{ background: FC.idle }} />Idle</span>
        <span><i className="hatch" />Planned</span>
      </span>}>
      <div className="cfc-box" ref={ref}><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="cfc-svg" onMouseLeave={() => setHover(undefined)}>
        <defs>
          <pattern id="cfcRun" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(58,138,224,.2)" /><rect width="2.2" height="6" fill="rgba(58,138,224,.8)" /></pattern>
          <pattern id="cfcCloud" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(124,142,166,.18)" /><rect width="2.2" height="6" fill="rgba(124,142,166,.7)" /></pattern>
          <pattern id="cfcInst" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(143,191,240,.2)" /><rect width="2.2" height="6" fill="rgba(143,191,240,.8)" /></pattern>
          <pattern id="cfcIdle" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="rgba(239,107,107,.2)" /><rect width="2.2" height="6" fill="rgba(239,107,107,.85)" /></pattern>
        </defs>
        {ticks.map((v) => (
          <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#243041" /><text x={L - 8} y={y(v) + 4} className="cfc-ax" textAnchor="end">{axisLabel(v)}</text></g>
        ))}
        <rect x={x(nowIdx + 1)} y={T - 8} width={W - R - x(nowIdx + 1)} height={H - T - B + 8} fill="rgba(255,255,255,.018)" />
        <line x1={x(nowIdx + 1)} x2={x(nowIdx + 1)} y1={T - 22} y2={H - B} stroke="#5aa9ff" strokeDasharray="3 3" />
        <text x={x(nowIdx + 1) - 6} y={T - 12} className="cfc-now" textAnchor="end">today</text>
        <text x={x(nowIdx + 1) + 6} y={T - 12} className="cfc-ax">planned</text>
        {hover !== undefined && <rect x={x(hover)} y={T - 6} width={bw} height={H - T - B + 6} fill="rgba(90,169,255,.07)" stroke="rgba(90,169,255,.35)" />}
        {fc.map((q, i) => {
          const x0 = x(i) + bw * 0.2, w = bw * 0.6;
          let base = 0;
          const segs: ReactNode[] = [];
          const seg = (v: number, fill: string, k: string) => {
            if (v <= 0) return;
            segs.push(<rect key={k} x={x0} y={y(base + v)} width={w} height={Math.max(0.5, y(base) - y(base + v))} fill={fill} rx={1.5} />);
            base += v;
          };
          const plan = planned(q);
          seg(q.cloud, plan ? 'url(#cfcCloud)' : FC.cloud, 'c');
          seg(q.running, plan ? 'url(#cfcRun)' : FC.run, 'r');
          seg(q.installing, plan ? 'url(#cfcInst)' : FC.inst, 'i');
          seg(q.idle, plan ? 'url(#cfcIdle)' : FC.idle, 'x');
          const lineY = q.racks + q.cloud;
          const filled = q.cloud + q.running + q.installing;
          const showEmpty = q.empty > Math.max(50e3, 0.1 * q.racks);
          return (
            <Tip as="g" key={q.q} content={() => <QuarterTip s={s} q={q} />}>
              <g onMouseEnter={() => setHover(i)} data-q={q.q}>
                <rect x={x(i)} y={T} width={bw} height={H - T - B} fill="transparent" />
                <g opacity={q.past ? 0.7 : 1}>{segs}</g>
                {showEmpty && <rect x={x0} y={y(lineY)} width={w} height={Math.max(0, y(filled) - y(lineY))} fill="none" stroke={C.watch} strokeDasharray="4 3" rx={2} />}
                {showEmpty && i === firstEmpty && y(filled) - y(lineY) > 18 && <text x={x(i) + bw / 2} y={(y(lineY) + y(filled)) / 2 + 4} className="cfc-empty" textAnchor="middle">empty</text>}
                <text x={x(i) + bw / 2} y={H - B + 20} className={q.now ? 'cfc-now' : 'cfc-ax'} textAnchor="middle">{qLabel(s, q.q)}</text>
              </g>
            </Tip>
          );
        })}
        <path d={line} fill="none" stroke={FC.line} strokeWidth={2.2} pointerEvents="none" />
        {labels.slice(0, 4).map(({ i, e }, j) => {
          const q = fc[i];
          const yy = y(q.racks + q.cloud);
          const color = e.kind === 'siteLive' ? (e.firm ? C.good : C.watch) : '#9fb0c3';
          const right = i > n * 0.7;
          return (
            <g key={j} pointerEvents="none">
              <circle cx={x(i)} cy={yy} r={4.5} fill={color} stroke="#151c26" strokeWidth={2} />
              <text x={right ? x(i) - 8 : x(i) + 8} y={yy - 10 - (j % 2) * 14 < T + 14 ? yy + 18 + (j % 2) * 14 : yy - 10 - (j % 2) * 14} className="cfc-ev" fill={color} textAnchor={right ? 'end' : 'start'}>
                {e.kind === 'siteLive' ? `${e.name} live${e.firm ? '' : ' (est.)'}` : evText(e)}
              </text>
            </g>
          );
        })}
        {later.slice(0, 2).map((l, j) => (
          <text key={j} x={W - R - 2} y={T + 12 + j * 15} className="cfc-ev" fill="#9fb0c3" textAnchor="end" pointerEvents="none">
            {l.ev.kind === 'siteLive' ? `${l.ev.name} (${F.power(l.ev.mw)}) live ≈ ${qLabel(s, l.q)} ›` : `${evText(l.ev)} ${qLabel(s, l.q)} ›`}
          </text>
        ))}
      </svg></div>
    </Card>
  );
}

function QuarterTip({ s, q }: { s: GameStateV2; q: ForecastQ }) {
  const rows: { label: ReactNode; value: ReactNode; tone?: 'neg' | 'neutral' | 'pos' }[] = [
    { label: <Term id="poweredCapacity">Powered capacity</Term>, value: F.count(q.racks + q.cloud) },
    { label: <span className="dim">· own racks</span>, value: <span className="dim">{F.count(q.racks)}</span> },
    { label: <span className="dim">· <Term id="cloudContract">cloud</Term></span>, value: <span className="dim">{F.count(q.cloud)}</span> },
    { label: 'Running', value: F.count(q.running + q.cloud) },
  ];
  if (q.installing > 0) rows.push({ label: <Term id="installing">Installing</Term>, value: F.count(q.installing) });
  if (q.idle > 0) rows.push({ label: <Term id="idleChips">Idle</Term>, value: F.count(q.idle), tone: 'neg' });
  if (q.empty > 0) rows.push({ label: <Term id="emptyRacks">Empty racks</Term>, value: F.count(q.empty) });
  for (const e of q.events) rows.push({ label: e.kind === 'siteLive' && !e.firm ? `${evText(e)} (est.${e.block > 0 ? `, block ${F.pct(e.block)}` : ''})` : evText(e), value: evSigned(e), tone: e.kind === 'cloudEnd' ? 'neg' : 'pos' });
  return <TipCard title={qLabel(s, q.q)} value={q.now ? 'now' : q.past ? 'end of quarter' : 'planned'} rows={rows}>{!q.now && !q.past ? 'Assumes open orders fill in full and sites go live on schedule.' : undefined}</TipCard>;
}

// ───────── three ways to add compute ─────────

/** Jank C1: every order, build or rental shows what it does before the click: labelled cost lines (when each payment
 *  falls due), then cash, runway and chips without racks before → after (the action applied to a copy of the game). */
function peakNoRacks(s: GameStateV2): { h: number; q?: number } {
  let best = { h: 0, q: undefined as number | undefined };
  for (const q of computeForecast(s, 10).quarters) if (q.idle > best.h) best = { h: q.idle, q: q.q };
  return best;
}
interface WhatIf { cash: number; runway: number; racks: { h: number; q?: number } }
function whatIf(s: GameStateV2, id: string, params: Record<string, number | string | boolean>): WhatIf | undefined {
  const c = structuredClone(s);
  if (engineAct(c, id, params)) return undefined;
  return { cash: c.player.finance.cash - s.player.finance.cash, runway: runwayOf(c).q, racks: peakNoRacks(c) };
}
function ComputePreview({ s, id, params, arrives }: { s: GameStateV2; id: string; params: Record<string, number | string | boolean>; arrives: ReactNode }) {
  const v = actionView(s, id, params);
  const week = Math.floor(s.time.day / 7);
  const key = `${week}|${id}|${JSON.stringify(params)}`;
  const [memo, setMemo] = useState<{ key: string; r: ReturnType<typeof whatIf>; rw: number; racks: ReturnType<typeof peakNoRacks> } | undefined>(undefined);
  useEffect(() => {
    if (memo?.key === key) return;
    setMemo({ key, r: whatIf(s, id, params), rw: runwayOf(s).q, racks: peakNoRacks(s) });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const lbl = (c: CostLine) => c.target ?? (c.lagDays ? `in ${F.days(c.lagDays)}` : 'now');
  const m = memo?.key === key ? memo : undefined;
  const w = m?.r;
  const runCap = 8;
  return (
    <div className="cac-pv2" data-test={`preview.${id}`}>
      <div className="cac-lines">
        {v.costs.filter((c) => c.amount !== 0).map((c, i) => <Tip key={`c${i}`} content={() => <TipCard title="Payment" value={F.money(c.amount, { signed: true })} rows={[{ label: 'When', value: c.lagDays ? `in ${F.days(c.lagDays)}` : 'now' }, ...(c.target ? [{ label: 'What', value: c.target }] : [])]}>Every payment of this commitment, in the quarter it falls due.</TipCard>}><span className="cac-line"><span className="dim">{lbl(c)}</span> <b className="num tone-neg">{F.money(c.amount, { signed: true })}</b></span></Tip>)}
        {v.gains.filter((c) => c.amount !== 0 && c.currency === 'compute').map((c, i) => <Tip key={`g${i}`} content={() => <TipCard title="Capacity" value={`+${F.count(c.amount)} H100e`} rows={[{ label: 'Arrives', value: c.lagDays ? `in ${F.days(c.lagDays)}` : 'next quarter' }]}>{id === 'cmp.newSite' ? 'Racks for this many H100e when the site goes live.' : 'Chips (or rented capacity) this adds.'}</TipCard>}><span className="cac-line"><span className="dim">{arrives}</span> <b className="num tone-pos">+{F.count(c.amount)} H100e</b></span></Tip>)}
      </div>
      {m && w && (
        <Tip content={() => <TipCard title="Before → after" rows={[
          { label: <Term id="cash">Cash now</Term>, value: `${F.money(s.player.finance.cash)} → ${F.money(s.player.finance.cash + w.cash)}` },
          { label: <Term id="runway">Runway</Term>, value: `${F.runway(m.rw, runCap)} → ${F.runway(w.runway, runCap)}`, tone: w.runway < m.rw - 0.05 ? 'neg' : 'neutral' },
          { label: <Term id="idleChips">Chips with no racks</Term>, value: `${F.count(m.racks.h)} → ${F.count(w.racks.h)} H100e (peak, next 10 q)`, tone: w.racks.h > m.racks.h + 1 ? 'neg' : 'neutral' },
        ]} footer="The action applied to a copy of today's game: every payment in the quarter it falls due.">What this commits you to.</TipCard>}>
          <div className="cac-ba small">
            <span className="dim">cash</span> <span className="num">{F.money(s.player.finance.cash)} → <b>{F.money(s.player.finance.cash + w.cash)}</b></span>
            <span className="dim">runway</span> <span className="num">{F.runway(m.rw, runCap)} → <b className={w.runway < m.rw - 0.05 ? (w.runway < 3 ? 'tone-neg' : 'tone-warn') : ''}>{F.runway(w.runway, runCap)}</b></span>
            {w.racks.h > m.racks.h + 1 && <span className="tone-neg">⚠ {F.count(w.racks.h - m.racks.h)} H100e with no racks{w.racks.q !== undefined ? ` from ${qLabel(s, w.racks.q)}` : ''}</span>}
          </div>
        </Tip>
      )}
    </div>
  );
}

/** FIN1 (spec §4): payment options compared on total cost over the asset's life; FIN6b: and on present value (a lease
 *  always looks worse than cash on the undiscounted total; it changes timing, not cost). The lowest present value is
 *  green. Locked options say why. */
function PayTiles({ s, opts, value, onChange, testPrefix, timing, asset }: { s: GameStateV2; opts: PayOption[]; value: PayOption['id']; onChange: (v: PayOption['id']) => void; testPrefix: string; timing: Parameters<typeof payOptionsPV>[2]; asset: 'site' | 'chips' }) {
  const pv = payOptionsPV(s, opts, timing);
  const best = Math.min(...opts.filter((o) => !o.blocked).map((o) => pv.pv[o.id] ?? Infinity));
  const rate = `${(pv.rate * 100).toFixed(1)}%`;
  return (
    <div className={`cac-tiles c${opts.length}`} data-test={`${testPrefix}-tiles`}>
      {opts.map((o) => {
        const v = pv.pv[o.id];
        return (
          <OptionTile key={o.id} label={o.label} active={value === o.id} locked={o.blocked ? 'closed' : undefined} onClick={() => onChange(o.id)} testId={`${testPrefix}-${o.id}`}
            glyphs={<span className="pay-gl"><b className={v !== undefined && v <= best + 1e-6 ? 'tone-pos' : ''} data-test="pay-pv">PV {v !== undefined ? F.money(v) : '—'}</b><i>{F.money(o.total)} total</i></span>}
            tip={() => <TipCard title={<Term id={o.id === 'loan' ? 'gpuTerm' : o.id === 'lease' ? 'spv' : 'payOption'}>{o.label}</Term>} value={o.blocked ? 'not available' : <span><Term id="presentValue">PV</Term> {v !== undefined ? F.money(v) : '—'}</span>} rows={[
              { label: o.id === 'cash' ? (asset === 'site' ? 'Cash, on the build schedule' : 'Cash, deposit and delivery') : o.id === 'lease' ? (asset === 'site' ? 'Your 20%, on the build schedule' : 'Deposit now') : 'Your cash at delivery', value: F.money(o.now) },
              ...(o.perYear > 0 ? [{ label: o.id === 'loan' ? 'Interest per year' : 'Lease per year', value: `${F.money(o.perYear)} × ${o.years} y` }] : []),
              ...(o.rate !== undefined ? [{ label: o.id === 'loan' ? 'Loan rate' : 'Lessor return', value: `${(o.rate * 100).toFixed(1)}% · rating ${s.player.finance.rating}` }] : []),
              { label: 'Total, undiscounted', value: F.money(o.total) },
              ...(v !== undefined ? [{ label: <><Term id="presentValue">Present value</Term> at {rate}</>, value: F.money(v), tone: v <= best + 1e-6 ? 'pos' as const : 'neutral' as const }] : []),
            ]} footer={`Present value: every payment discounted to today at ${rate} a year, ${pv.basis}.`}>{o.blocked ?? o.note}</TipCard>} />
        );
      })}
    </div>
  );
}

/** FIN1 (spec §5): the expected price path a firm contract pays, as a curve. */
export function PathCurve({ s, prices, unit, discount, firstQ }: { s: GameStateV2; prices: number[]; unit: string; discount: number; firstQ: number }) {
  if (prices.length < 2) return null;
  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  return (
    <Tip content={() => <TipCard title={<Term id="expectedPath">Expected path</Term>} value={`${unit}${prices[0].toFixed(1)}K → ${unit}${prices[prices.length - 1].toFixed(1)}K`} rows={[
      { label: 'First quarter', value: `${qLabel(s, firstQ)} · $${prices[0].toFixed(1)}K` },
      { label: 'Last quarter', value: `${qLabel(s, firstQ + prices.length - 1)} · $${prices[prices.length - 1].toFixed(1)}K` },
      { label: 'Average', value: `$${avg.toFixed(1)}K` },
      { label: <Term id="firmDiscount">Firm discount</Term>, value: discount > 0 ? `−${F.pct(discount)}` : 'none under 2 years' },
    ]}>Payments follow the market forecast quarter by quarter. Prices that fall faster than this mean you overpay; in a shortage you are protected.</TipCard>}>
      <span className="row-i small" data-test="price-path"><span className="dim">price path</span><Spark2 data={prices} w={90} h={18} color={C.you} /><span className="num dim">${prices[0].toFixed(1)}K → ${prices[prices.length - 1].toFixed(1)}K</span></span>
    </Tip>
  );
}

const CHIP_TERM_OPTS: { v: number; label: string; tip: string }[] = [
  { v: 0, label: 'Spot', tip: 'next quarter at the spot price; no deposit; lowest priority' },
  { v: 1, label: 'Batch', tip: 'one batch in 2 quarters at the expected list price; a deposit of 30% or more (supplier terms)' },
  { v: 4, label: '1 yr', tip: 'a tranche every quarter for 1 year, take-or-pay, priority' },
  { v: 8, label: '2 yr', tip: 'tranches for 2 years, take-or-pay, priority, 5% off' },
  { v: 16, label: '4 yr', tip: 'tranches for 4 years, take-or-pay, priority, 10% off' },
];
const termName = (t: number) => CHIP_TERM_OPTS.find((x) => x.v === t)?.label ?? `${t}q`;

/** Supplier terms (FINANCE-V3 §5, FIN5a): what suppliers ask you to pay upfront, from your share of investor money and
 *  your runway. Home of the datum (the Buy chips card). */
function SupplierTerms({ s, batch }: { s: GameStateV2; batch: boolean }) {
  const t = supplierTerms(s);
  const v = batch ? t.batch : t.firstDelivery;
  return (
    <Tip content={() => <TipCard title={<Term id="supplierTerms">Supplier terms</Term>} value={batch ? `deposit ${F.pct(t.batch)}` : `prepay ${F.pct(t.firstDelivery)}`} rows={[
      { label: 'Base deposit (a batch)', value: F.pct(SUPPLIER.base) },
      { label: `Your share of investor money ${F.pct(t.share)}`, value: `+${F.pct(t.shareAdd)}`, tone: t.shareAdd > 0 ? 'neg' : 'neutral' },
      { label: `Runway ${F.quarters(t.runwayQ)}`, value: `+${F.pct(t.runwayAdd)}`, tone: t.runwayAdd > 0 ? 'neg' : 'neutral' },
      { label: 'A batch\'s deposit', value: F.pct(t.batch) },
      { label: 'A supply contract\'s first delivery', value: `${F.pct(t.firstDelivery)} prepaid` },
    ]}>{`Suppliers ask a buyer that investors fund less (share under ${F.pct(SUPPLIER.shareFull)}) or with under ${SUPPLIER.runwayFull} quarters of runway to pay more upfront.`}</TipCard>}>
      <span className={`small ${v > (batch ? SUPPLIER.base : 0) + 1e-9 ? 'tone-warn' : 'dim'}`} data-test="supplier-terms"><Term id="supplierTerms">supplier terms</Term> · {batch ? `deposit ${F.pct(t.batch)}` : t.firstDelivery > 0 ? `prepay ${F.pct(t.firstDelivery)} of the first` : 'no prepayment'}</span>
    </Tip>
  );
}

function OrderCard({ s }: { s: GameStateV2 }) {
  const [tier, setTier] = useState(2);
  const [term, setTerm] = useState(1);
  const [firm, setFirm] = useState(false);
  const [pay, setPay] = useState<PayOption['id']>('cash');
  const [nonTW, setNonTW] = useState(false);
  const [open, setOpen] = useState(false);
  const qty = CHIP_TIERS[tier];
  const kW = s.power.kWPerH100e;
  const tranches = term >= 4;
  const qt = chipQuote(s, term, qty, { nonTW, firm });
  const pays = payOptions(s, qt.later, 'chips', undefined, qt.now);
  const payNow = tranches || pays.find((o) => o.id === pay)?.blocked ? 'cash' : pay;
  const params = { qty, term, nonTW, ...(term === 1 && firm ? { firm: true } : {}), ...(!tranches && payNow !== 'cash' ? { pay: payNow } : {}) };
  return (
    <Card title={<span className="row-i"><ICON.compute size={14} />Buy chips</span>} className="cac" id="ctl-orderChips"
      right={<span className="dim small">{tranches ? `per quarter × ${qt.quarters}q` : 'one batch'}</span>}>
      <div className="cac-tiles c5">
        {CHIP_TIERS.map((h, i) => (
          <OptionTile key={h} label={F.count(h)} glyphs={<span>{F.power((h * kW) / 1000)}</span>} active={tier === i} onClick={() => setTier(i)} testId={`chips-${i}`}
            tip={() => <TipCard title={`${F.count(h)} H100e`} rows={[{ label: <Term id="mw">Racks needed</Term>, value: F.power((h * kW) / 1000) }, { label: 'Price each', value: `$${chipQuote(s, term, h, { nonTW }).price.toFixed(1)}K` }]} />} />
        ))}
      </div>
      <div className="cac-pv"><ComputePreview s={s} id="cmp.buyChips" params={params} arrives={<>arrive {qLabel(s, qt.dueQ)}</>} /><Limit id="order.terms">{tranches ? `${qt.quarters} tranches${qt.discount > 0 ? ` · −${F.pct(qt.discount)}` : ''}` : term === 1 ? 'one batch' : 'no deposit'}</Limit>{term >= 1 && <SupplierTerms s={s} batch={!tranches} />}</div>
      {open && (
        <div className="cac-opts">
          <div className="cmp-row"><span className="dim small"><Term id="lta">Term</Term></span><Seg value={term} options={CHIP_TERM_OPTS} onChange={setTerm} testId="chip-term" /></div>
          {tranches && qt.prices && <PathCurve s={s} prices={qt.prices} unit="$" discount={qt.discount} firstQ={qt.dueQ} />}
          {term === 1 && <Toggle on={firm} onChange={setFirm} label={<><Term id="firmCommit">Firm</Term> · take-or-pay, rationing priority</>} />}
          {!tranches && <><div className="cac-lbl">Pay with</div><PayTiles s={s} opts={pays} value={payNow} onChange={setPay} testPrefix="chip-pay" asset="chips" timing={{ chipsDelayQ: qt.dueQ - qOf(s), upfront: qt.now }} /><Limit id="lease.rating">{leaseLimit(s)}</Limit></>}
          <div className="cmp-row"><Toggle on={nonTW} onChange={setNonTW} label={<><Term id="taiwanRisk">Non-Taiwan</Term> supply · +30%</>} /></div>
        </div>
      )}
      <div className="cac-foot">
        <button className="cac-more" onClick={() => setOpen(!open)} data-test="opt-order"><ICON.go size={12} className={open ? 'rot' : ''} /><b>{termName(term)}</b>{term === 1 && firm ? ' · firm' : ''}{!tranches && payNow !== 'cash' ? ` · ${payNow === 'lease' ? 'lease' : 'chip loan'}` : ''}{nonTW ? ' · non-Taiwan' : ' · any fab'}</button>
        <span className="sp" />
        <Gate s={s} k="compute"><ActBtn id="cmp.buyChips" params={params} primary label="Buy" icon={ICON.compute} /></Gate>
      </div>
    </Card>
  );
}

function BuildCard({ s }: { s: GameStateV2 }) {
  const [tier, setTier] = useState(2);
  const [path, setPath] = useState<Site['path']>('gas');
  const [crash, setCrash] = useState(false);
  const [communityIn, setCommunity] = useState<boolean | undefined>(undefined);
  const [pay, setPay] = useState<PayOption['id']>('cash');
  const [open, setOpen] = useState(false);
  const community = communityIn ?? s.player.policies.communityBenefits;
  const max = SITE_PATHS[path].maxMW;
  const fits = (i: number) => SITE_TIERS[i].mw <= max;
  const t = fits(tier) ? tier : SITE_TIERS.reduce((a, x, i) => (x.mw <= max ? i : a), 0);
  const mw = SITE_TIERS[t].mw;
  const kW = s.power.kWPerH100e;
  const eta = siteEtaQ(s, { path, mw, crash });
  const colo = path === 'lease';
  const sched = siteSchedule(s, { path, mw, crash });
  const pays = payOptions(s, siteCapex({ path, mw, crash, community }), 'site', sched);
  const payNow = colo || pays.find((o) => o.id === pay)?.blocked ? 'cash' : pay;
  const params = { path, mw, crash, community, pay: payNow };
  const liveQ = qOf(s) + eta;
  const pickPath = (p: Site['path']) => {
    setPath(p);
    if (SITE_TIERS[tier].mw > SITE_PATHS[p].maxMW) setTier(SITE_TIERS.reduce((a, x, i) => (x.mw <= SITE_PATHS[p].maxMW ? i : a), 0));
  };
  return (
    <Card title={<span className="row-i"><ICON.sites size={14} />Build data centre</span>} className="cac" id="ctl-sites"
      right={<Tip content={() => <TipCard title={<Term id="kwPerH100e">Power per chip</Term>} value={`${kW.toFixed(2)} kW per H100e`}>A gigawatt of racks holds this many H100e at today's chip efficiency.</TipCard>}><span className="dim small"><b className="num">{F.count(1e6 / kW)}</b> H100e per GW</span></Tip>}>
      <div className="cac-tiles c5">
        {SITE_TIERS.map((x, i) => (
          <OptionTile key={x.id} label={x.name} glyphs={<span>{F.power(x.mw)}</span>} active={t === i} locked={fits(i) ? undefined : F.power(x.mw)} onClick={() => setTier(i)} testId={`site-${x.id}`}
            tip={() => <TipCard title={x.full} value={F.power(x.mw)} rows={[{ label: 'Holds today', value: `${F.count((x.mw * 1000) / kW)} H100e` }]}><Term id="siteTier">Data-centre size</Term></TipCard>} />
        ))}
      </div>
      <div className="cac-lbl">Power</div>
      <div className="cac-tiles c5">
        {PATHS.map((p) => {
          const q = siteEtaQ(s, { path: p.id, mw: Math.min(mw, SITE_PATHS[p.id].maxMW), crash });
          return (
            <OptionTile key={p.id} label={p.label} icon={p.icon} glyphs={<span>{p.id === 'lease' ? '1–3q' : `${q}q`}</span>} active={path === p.id} onClick={() => pickPath(p.id)} testId={`path-${p.id}`}
              tip={() => <TipCard title={<Term id={p.term}>{p.label}</Term>} rows={[{ label: 'Live in', value: p.id === 'lease' ? '1–3 quarters' : `≈ ${q} quarters` }, { label: 'Largest', value: F.power(SITE_PATHS[p.id].maxMW) }, { label: 'Power price', value: `×${SITE_PATHS[p.id].powerCostMult}` }]} />} />
          );
        })}
      </div>
      {!colo && <><div className="cac-lbl"><Term id="payOption">Pay with</Term></div><PayTiles s={s} opts={pays} value={payNow} onChange={setPay} testPrefix="site-pay" asset="site" timing={{ site: sched }} /></>}
      <div className="cac-pv"><ComputePreview s={s} id="cmp.newSite" params={params} arrives={<>racks for, live ≈ {qLabel(s, liveQ)}</>} />{(() => { const z = siteSizeView(s, path); const short = z.leaseGW !== undefined && z.leaseGW * 1000 < mw; return <Limit id="site.mw" tone={short ? 'bind' : 'quiet'}>{F.power(z.min)}–{F.power(z.max)}{z.leaseGW !== undefined ? ` · lease pool ${F.power(z.leaseGW * 1000)}` : ''}</Limit>; })()}{!colo && <Limit id="lease.rating" tone={leaseRate(s) === undefined ? 'bind' : 'quiet'}>{leaseLimit(s)}</Limit>}</div>
      {open && (
        <div className="cac-opts">
          <Toggle on={crash} onChange={setCrash} label={<><Term id="crashBuild">Crash build</Term> · 4q, +35%</>} />
          {!colo && <Toggle on={community} onChange={setCommunity} label={<><Term id="communityPackage">Community package</Term> · +3% capex, block risk ×0.5{s.player.policies.communityBenefits ? ' · company default' : ''}</>} />}
          {!s.player.policies.communityBenefits && <span className="row-i small"><span className="dim">Company default</span><ActBtn id="cmp.community" label="Package every site" /></span>}
        </div>
      )}
      <div className="cac-foot">
        <button className="cac-more" onClick={() => setOpen(!open)} data-test="opt-site"><ICON.go size={12} className={open ? 'rot' : ''} /><b>{crash ? 'Crash build' : 'Normal build'}</b>{community && !colo ? ' · community package' : ''}{payNow === 'lease' ? ' · lease' : ''}</button>
        <span className="sp" />
        <Gate s={s} k="compute"><ActBtn id="cmp.newSite" testId={payNow === 'lease' ? 'cmp.newSite.lease' : undefined} params={params} primary label="Build" icon={ICON.sites} /></Gate>
      </div>
    </Card>
  );
}

const RENT_TERM_OPTS: { v: number; label: string; tip: string }[] = [
  { v: 1, label: '1 q', tip: 'spot rental for one quarter at the rental rate, capped' },
  { v: 4, label: '1 yr', tip: 'contract from next quarter' },
  { v: 8, label: '2 yr', tip: 'firm: 5% off' },
  { v: 16, label: '4 yr', tip: 'firm: 10% off' },
];

function CloudCard({ s }: { s: GameStateV2 }) {
  const [tier, setTier] = useState(1);
  const [term, setTerm] = useState(4);
  const [firm, setFirm] = useState(true);
  const [open, setOpen] = useState(false);
  const h100e = CHIP_TIERS[tier];
  const spot = term <= 1;
  const params = { h100e, term, firm };
  const qt = rentQuote(s, h100e, Math.max(4, term), firm);
  const perH = spot ? (s.market.rental * 8760) / 1000 : qt.perH[0];
  return (
    <Card title={<span className="row-i"><ICON.cloud size={14} /><Term id="cloudContract">Rent compute</Term></span>} className="cac" id="ctl-cloud"
      right={<Tip content={() => <TipCard title={<Term id="cloudContract">Cloud price</Term>} value={`$${perH.toFixed(1)}K per H100e-year`} rows={[{ label: 'Market today', value: `$${cloudPricePerYear(s).toFixed(1)}K` }, { label: <Term id="cancellable">Cancellable</Term>, value: `$${cancellablePricePerYear(s).toFixed(1)}K, re-priced quarterly` }]}>{spot ? 'Spot rental at today\'s rental rate.' : firm ? 'First quarter of a firm contract on the expected path, less the firm discount.' : 'Spot-indexed × 1.15.'}</TipCard>}><span className="dim small"><b className="num">${perH.toFixed(1)}K</b> / H100e-yr</span></Tip>}>
      <div className="cac-tiles c5">
        {CHIP_TIERS.map((h, i) => <OptionTile key={h} label={F.count(h)} active={tier === i} onClick={() => setTier(i)} testId={`cloud-${i}`} tip={() => <TipCard title={`${F.count(h)} H100e`} rows={[{ label: 'First year', value: F.money((h * perH) / 1e6, { perYear: true }) }]} />} />)}
      </div>
      <div className="cmp-row"><span className="dim small">Term</span><Seg value={term} options={RENT_TERM_OPTS} onChange={setTerm} testId="rent-term" /></div>
      <div className="cac-pv"><ComputePreview s={s} id="cmp.rentCompute" params={params} arrives={<>online {spot ? 'now' : qLabel(s, qOf(s) + 1)}</>} />{(() => { const sp = spotRentalView(s, h100e); return <Limit id="rent.spotCap" tone={spot && sp.get < h100e ? 'warn' : 'quiet'}>{spot ? <>spot: you'd get {F.count(sp.get)} of {F.count(h100e)}</> : <>spot cap {F.count(sp.cap)}</>}</Limit>; })()}</div>
      {open && !spot && (
        <div className="cac-opts">
          <Toggle on={firm} onChange={setFirm} label={<>{firm ? <><Term id="firmCommit">Firm</Term> · take-or-pay, priority, expected path</> : <><Term id="cancellable">Cancellable</Term> · spot × 1.15, 1q notice</>}</>} />
          {firm && <PathCurve s={s} prices={rentQuote(s, h100e, term, true).perH} unit="$" discount={qt.discount} firstQ={qOf(s) + 1} />}
        </div>
      )}
      <div className="cac-foot">
        <button className="cac-more" onClick={() => setOpen(!open)} data-test="opt-cloud"><ICON.go size={12} className={open ? 'rot' : ''} /><b>{spot ? 'Spot rental' : firm ? 'Firm' : 'Cancellable'}</b>{spot ? ' · one quarter' : firm ? ' · take-or-pay' : ' · 1q notice'}</button>
        <span className="sp" />
        <Gate s={s} k="compute"><ActBtn id="cmp.rentCompute" params={params} label={spot ? 'Rent' : 'Sign'} icon={ICON.cloud} /></Gate>
      </div>
    </Card>
  );
}

function Overview({ s }: { s: GameStateV2 }) {
  const { quarters, later } = computeForecast(s, 10);
  const past = computeHistory(s, 4);
  return (
    <>
      <Status s={s} fc={quarters} />
      <div className="cmp-main">
        <Forecast s={s} fc={[...past, ...quarters]} later={later} />
        <div className="cac-col">
          <OrderCard s={s} />
          <BuildCard s={s} />
          <CloudCard s={s} />
        </div>
      </div>
    </>
  );
}

// ═════════════════════════ Sites ═════════════════════════

function SiteTimeline({ s }: { s: GameStateV2 }) {
  const now = s.time.day;
  const sites = [...s.player.sites].sort((a, b) => (a.stage === 'live' ? 1 : 0) - (b.stage === 'live' ? 1 : 0) || a.stageEndDay - b.stageEndDay);
  const liveAt = (x: Site) => (x.stage === 'live' ? now : x.stage === 'building' ? x.stageEndDay : x.stageEndDay + (x.ws3?.buildQ ?? 8) * 91);
  const lo = now - 120;
  const hi = Math.max(now + 365, ...sites.filter((x) => x.stage !== 'blocked').map((x) => liveAt(x) + 45));
  const X = (d: number) => `${((Math.max(lo, Math.min(hi, d)) - lo) / (hi - lo)) * 100}%`;
  const W = (a: number, b: number) => `${((Math.max(lo, Math.min(hi, b)) - Math.max(lo, Math.min(hi, a))) / (hi - lo)) * 100}%`;
  const ticks: number[] = [];
  const yearly = hi - lo > 600;
  for (let d = lo; d <= hi; d += 7) { const t = dateOf(s, d); if (t.getUTCDate() <= 7 && t.getUTCMonth() % (yearly ? 12 : 6) === 0 && Math.abs(d - now) > (hi - lo) * 0.08) ticks.push(d); }
  return (
    <div className="stl" data-home="sites">
      <div className="stl-row stl-axis">
        <span /><span />
        <span className="stl-track">
          {ticks.map((d) => <span key={d} className="stl-tick" style={{ left: X(d) }}>{yearly ? dateOf(s, d).getUTCFullYear() : fmtMonth(dateOf(s, d))}</span>)}
          <span className="stl-now" style={{ left: X(now) }}>today</span>
        </span>
        <span /><span />
      </div>
      {sites.map((x) => {
        const odds = oppositionOdds(s, x);
        const start = x.ws3?.startDay ?? now;
        const live = liveAt(x);
        return (
          <Tip as="div" key={x.id} content={() => (
            <TipCard title={x.name} value={STAGE_LABEL[x.stage]} rows={[
              { label: <Term id="sitePath">Power</Term>, value: `${PATHS.find((p) => p.id === x.path)?.label} · ${x.region}` }, { label: <Term id="mw">Capacity</Term>, value: F.power(x.mw) },
              { label: 'Stage ends', value: x.stage === 'live' ? '—' : fmtDate(dateOf(s, x.stageEndDay)) }, { label: 'Live ≈', value: x.stage === 'blocked' ? 'blocked' : fmtMonth(dateOf(s, live)) },
              { label: 'Block / delay risk', value: `${F.pct(odds.block)} / ${F.pct(odds.delay)}`, tone: odds.block > 0.1 ? 'neg' : 'neutral' },
              { label: <Term id="capex">Capex paid</Term>, value: `${F.money(x.capexPaid)} / ${F.money(x.capex)}` }, { label: 'Chips installed', value: `${F.count(x.installed)} H100e` },
              { label: <Term id="communityPackage">Community package</Term>, value: x.communityPackage ? 'yes' : 'no' }, { label: <Term id="crashBuild">Crash build</Term>, value: x.crash ? 'yes' : 'no' },
              { label: <Term id="payOption">Paid with</Term>, value: x.ws3?.lease ? `lease ${F.pct(x.ws3.lease.rate)} · ${F.money(siteLeasePerYear(x, x.stage === 'live' ? x.ws3.lease.funded : x.ws3.lease.funded + (x.capex - x.capexPaid) * x.spvFunded), { perYear: true })} × 15 y` : 'cash' },
              ...(x.ws3?.lease ? [{ label: <Term id="rvg">Residual-value guarantee</Term>, value: F.money(siteRVG(s, x.id)) }] : []),
            ]} />
          )}>
            <div className="stl-row" data-site={x.id}>
              <span className="stl-name"><span className="dot" style={{ background: STAGE_COLOR[x.stage] }} /><span className="ellip">{x.name}</span><span className="dim small">{PATHS.find((p) => p.id === x.path)?.label.toLowerCase()}</span></span>
              <span className="num stl-mw">{F.power(x.mw)}</span>
              <span className="stl-track">
                <span className="stl-now-line" style={{ left: X(now) }} />
                {x.stage === 'live' && <i className="stl-seg live" style={{ left: X(lo), width: W(lo, hi) }} />}
                {x.stage !== 'live' && x.stage !== 'blocked' && (
                  <>
                    <i className="stl-seg past" style={{ left: X(start), width: W(start, now) }} />
                    <i className="stl-seg" style={{ left: X(now), width: W(now, x.stageEndDay), background: STAGE_COLOR[x.stage] }} />
                    {x.stage !== 'building' && <i className="stl-seg plan" style={{ left: X(x.stageEndDay), width: W(x.stageEndDay, live) }} />}
                    <b className="stl-live" style={{ left: X(live) }} title="goes live" />
                  </>
                )}
                {x.stage === 'blocked' && <i className="stl-seg blocked" style={{ left: X(start), width: W(start, now) }} />}
              </span>
              <span className="small stl-st">{x.stage === 'live' ? <span className="tone-pos">live</span> : x.stage === 'blocked' ? <span className="tone-neg">blocked</span> : <><Term id={STAGE_TERM[x.stage] ?? 'site'}>{STAGE_LABEL[x.stage]}</Term> <span className="dim">until {fmtMonth(dateOf(s, x.stageEndDay))} · live ≈ {qLabel(s, qOf(s, live))}</span></>}</span>
              <span className="stl-act">
                {x.stage === 'permitting' && odds.block > 0.005 && <Pill kind={odds.block > 0.1 ? 'bad' : 'warn'} title="chance local opposition blocks the site">block {F.pct(odds.block)}</Pill>}
                {x.stage === 'permitting' && !x.communityPackage && !x.ws3?.rolled && x.path !== 'lease' && <ActBtn id="cmp.community" params={{ siteId: x.id }} label="Community package" />}
              </span>
            </div>
          </Tip>
        );
      })}
      {!sites.length && <div className="dim small">No sites yet.</div>}
      <div className="stl-leg legend2">
        {(['permitting', 'power', 'building', 'live', 'blocked'] as const).map((st) => <span key={st}><i style={{ background: STAGE_COLOR[st] }} />{STAGE_LABEL[st]}</span>)}
        <span><i className="hatch" />planned build</span>
      </div>
    </div>
  );
}

function SitesTab({ s }: { s: GameStateV2 }) {
  const kW = s.power.kWPerH100e;
  const live = s.player.sites.filter((x) => x.stage === 'live');
  const mwCap = live.reduce((a, x) => a + x.mw, 0);
  const mwUsed = live.reduce((a, x) => a + Math.min(x.mw, (x.installed * kW) / 1000), 0);
  const full = chipFit(s).idle > 0;
  const pw = s.power.ws3;
  return (
    <Card title={<Term id="site">Sites & power</Term>} className="cmp-sites"
      right={<span className="row-i small"><span className="dim">MW used / cap</span><HBar v={mwUsed} max={Math.max(1, mwCap)} w={110} h={8} color={full ? C.bad : mwUsed > mwCap * 0.95 ? C.watch : C.good} /><Tip content={() => <TipCard title={<Term id="mw">Racks used</Term>} rows={[{ label: 'Used', value: F.power(mwUsed) }, { label: 'Live capacity', value: F.power(mwCap) }]}>Power of your live sites and how much installed chips draw.</TipCard>}><b className="num" data-home="mwUsed">{F.power(mwUsed)} / {F.power(mwCap)}</b></Tip></span>}>
      <SiteTimeline s={s} />
      <div className="cmp-power">
        <KV k="Grid pool left" term="gridPool">{F.power(pw.poolLeftGW * 1000)}</KV>
        <KV k="Spare transformers" term="transformers">{F.power(pw.transformersGW * 1000)}</KV>
        <KV k="Transformer lead time" term="transformers">{s.power.transformerLeadQ}q</KV>
        <KV k="kW per H100e" term="kwPerH100e">{kW.toFixed(2)}</KV>
        <Gate s={s} k="compute"><ActBtn id="cmp.preorderTransformers" params={{ gw: 2 }} label="Pre-order 2 GW transformers" icon={ICON.power} /></Gate>
      </div>
    </Card>
  );
}

// ═════════════════════════ Orders ═════════════════════════

function Deliveries({ s }: { s: GameStateV2 }) {
  const q0 = qOf(s);
  const open = s.player.orders.filter((o) => o.qty > o.delivered);
  // One entry per quarterly batch: an LTA's later tranches are batches too.
  const batches = open.flatMap((o) => {
    const first = Math.max(q0, o.dueQ);
    const later = o.kind === 'lta' ? Math.max(0, (o.ltaEndQ ?? 0) - o.dueQ - 1) : 0;
    return [{ o, q: first, key: o.id, left: o.qty - o.delivered, delivered: o.delivered },
      ...Array.from({ length: later }, (_, i) => ({ o, q: first + i + 1, key: `${o.id}-${i + 1}`, left: o.qty, delivered: 0 }))];
  });
  const last = Math.max(q0 + 7, ...batches.map((b) => b.q));
  const qs = Array.from({ length: Math.min(12, last - q0 + 1) }, (_, i) => q0 + i);
  const byQ = qs.map((q) => {
    const os = batches.filter((b) => b.q === q);
    return { q, os, tot: os.reduce((a, b) => a + b.left, 0) };
  });
  const max = Math.max(1, ...byQ.map((b) => b.tot));
  return (
    <Card title="Deliveries" sub="open chip orders by quarter due" home="orders"
      right={<span className="legend2">{(['spot', 'standard', 'lta'] as const).map((k) => <span key={k}><i style={{ background: KIND_COLOR[k] }} />{k === 'lta' ? 'LTA' : k}</span>)}</span>}>
      {open.length > 0 && <div className="dlv">
        {byQ.map((b) => (
          <Tip as="div" key={b.q} content={() => <TipCard title={qLabel(s, b.q)} value={`${F.count(b.tot)} H100e`} rows={b.os.map(({ o, delivered }) => ({ label: `${o.kind === 'lta' ? 'LTA tranche' : o.kind}${o.nonTW ? ' · non-TW' : ''} · $${o.price.toFixed(1)}K`, value: `${F.count(delivered)} / ${F.count(o.qty)}` }))}>{b.os.length ? 'Undelivered chips due this quarter (delivered / ordered). An LTA delivers one tranche every quarter to its end.' : 'Nothing due.'}</TipCard>}>
            <div className="dlv-col">
              <span className="num dlv-v">{b.tot > 0 ? F.count(b.tot) : ''}</span>
              <span className="dlv-bar">
                {b.os.map((x) => <i key={x.key} style={{ height: `${(x.left / max) * 100}%`, background: KIND_COLOR[x.o.kind] }} />)}
              </span>
              <span className="dlv-q">{b.q === q0 ? qLabel(s, b.q) : `+${b.q - q0}q`}</span>
            </div>
          </Tip>
        ))}
      </div>}
      {!open.length && <div className="dim small">No chips on order.</div>}
    </Card>
  );
}

function Cloud({ s }: { s: GameStateV2 }) {
  return (
    <Card title={<Term id="cloudContract">Cloud contracts</Term>} home="cloud">
      {s.player.cloud.map((c) => (
        <div className="cl-row" key={c.id}>
          <ICON.cloud size={14} /><span className="ellip">{c.provider}</span>
          <Tip content={() => <TipCard title={c.provider} rows={[{ label: 'Capacity', value: `${F.count(c.h100e)} H100e` }, { label: 'Cost', value: F.money(c.costPerYear, { perYear: true }) }, { label: 'Ends', value: fmtMonth(dateOf(s, c.endDay)) }]} />}><span className="row-i"><span className="num">{F.count(c.h100e)} H100e</span><span className="num">{F.money(c.costPerYear, { perYear: true })}</span></span></Tip>
          <span className="dim small">to {fmtMonth(dateOf(s, c.endDay))}{c.cancellableNoticeQ === null ? ' · firm' : ` · ${c.cancellableNoticeQ}q notice`}</span>
        </div>
      ))}
      {!s.player.cloud.length && <div className="dim small">No cloud contracts.</div>}
      <div className="dim small" style={{ marginTop: 6 }}>Payments sit on the <Ref id="ledger" to={{ panel: 'finance', anchor: 'ledger' }}>commitment ledger</Ref></div>
    </Card>
  );
}

// ═════════════════════════ Market ═════════════════════════

function PriceSpark({ label, data, value, color }: { label: ReactNode; data?: number[]; value: string; color: string }) {
  return (
    <div className="px">
      <span className="dim small">{label}</span>
      <b className="num">{value}</b>
      {data && data.length > 1 && <Spark2 data={data} w={80} h={20} color={color} />}
    </div>
  );
}

function Market({ s }: { s: GameStateV2 }) {
  const m = s.market;
  const kmax = Math.max(m.Kpkg, m.Khbm, m.Kwafer, 1);
  const hist = store.hist;
  return (
    <Card title="Chip market" sub="global, per quarter" home="chipMarket" className="cmp-market">
      <div className="px-row" data-home="chipPrices">
        <PriceSpark label={<Term id="listPrice">List</Term>} data={hist.list} value={`$${m.listPrice.toFixed(1)}K`} color="#c9d4e2" />
        <PriceSpark label={<Term id="spotPrice">Spot</Term>} data={hist.spot} value={`$${spotPrice(m).toFixed(1)}K`} color={C.watch} />
        <PriceSpark label={<Term id="rental">Rental</Term>} data={hist.rental} value={`$${m.rental.toFixed(2)}/h`} color={C.you} />
      </div>
      <div className="tip-cap">Supply by component</div>
      {COMP.map((c) => {
        // Jank C2: the lowest component caps supply, but it only binds when demand reaches supply.
        const lowest = m.binding === c.bind;
        const bind = lowest && m.demandQ >= 0.95 * m.supplyQ;
        return (
          <div className="cmp-bar" key={c.k}>
            <span><Term id={c.term}>{c.label}</Term>{lowest && <Tip content={() => <TipCard title={bind ? 'Binding' : 'Tightest, not binding'} rows={[{ label: 'Supply this quarter', value: `${F.count(m.supplyQ)} H100e` }, { label: 'Demand this quarter', value: `${F.count(m.demandQ)} H100e` }]}>{bind ? 'The scarcest component caps chip supply and demand meets that cap: orders are rationed by order weight.' : 'The scarcest component sets the supply cap, but demand is below it: orders fill.'}</TipCard>}><span className={`tag2 ${bind ? 'warn' : ''}`} style={{ marginLeft: 6 }}>{bind ? 'binding' : 'tightest'}</span></Tip>}</span>
            <HBar v={m[c.k]} max={kmax} w="100%" h={8} color={bind ? C.watch : '#6b7c91'} />
            <Tip content={() => <TipCard title={<Term id={c.term}>{c.label}</Term>} value={`${F.count(m[c.k])} H100e a quarter`}>Chips this component can supply worldwide.</TipCard>}><span className={`num ${bind ? 'tone-warn' : ''}`}>{F.count(m[c.k])}</span></Tip>
          </div>
        );
      })}
      <KV k="Supply · demand this quarter">{F.count(m.supplyQ)} · {F.count(m.demandQ)} H100e</KV>
      <KV k="Your order weight" term="allocation">×{m.ws3.playerWeight.toFixed(2)} a new buyer's</KV>
      <KV k="Export policy" term="exportPolicy">{F.words(m.exportPolicy)}</KV>
      <KV k="Made in Taiwan" term="taiwanRisk">{F.pct(m.geoTW)} of leading chips</KV>
    </Card>
  );
}

// ═════════════════════════ panel ═════════════════════════

export function Compute({ s }: { s: GameStateV2 }) {
  const tab0 = tabOf('compute', 'overview');
  const tab = tab0 === 'split' ? 'overview' : tab0; // UB-5: the allocation moved to LAB
  const sitesBadge = chipFit(s).idle > 0 || s.player.sites.some((x) => x.stage === 'permitting' && !x.ws3?.rolled && oppositionOdds(s, x).block > 0.1) ? '!' : undefined;
  return (
    <div className="panel-v2 cmp" data-panel="compute">
      <PanelHead icon={ICON.computePanel} title="Compute" sub="chips, sites and cloud"
        tabs={<Tabs panel="compute" def="overview" tabs={[{ id: 'overview', label: 'Overview', icon: ICON.overview }, { id: 'sites', label: 'Sites', icon: ICON.sites, badge: sitesBadge }, { id: 'orders', label: 'Orders & market', icon: ICON.supply }]} />}
        right={<span className="row-i"><Ref id="split" to={{ panel: 'lab', anchor: 'split' }}>Compute allocation</Ref></span>} />
      {tab === 'overview' && <Overview s={s} />}
      {tab === 'sites' && <SitesTab s={s} />}
      {/* Jank C4: orders, cloud and the chip market share one tab (each used under 40% of the screen alone). */}
      {(tab === 'orders' || tab === 'market') && <div className="g3"><Deliveries s={s} /><Cloud s={s} /><Market s={s} /></div>}
    </div>
  );
}
