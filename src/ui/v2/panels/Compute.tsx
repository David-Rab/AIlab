// Compute (design/archive/ux/COMPUTE.md). Overview (L1): three verdicts, the capacity and fleet forecast, and three ways to add
// compute (chips, data centres, cloud) with fine options folded away, and the Sites rows under the chart. Tab (L2): Orders &
// market (deliveries, cloud and the chip market on one tab). The compute allocation lives on LAB (UB-5), linked from the header.
// HOME of idle chips, empty racks, vendor fill, the forecast, sites & power, the split, orders, cloud contracts and the
// chip market. Compute online lives in Company (its flow tab) and is only linked here.
import { useEffect, useState, type ReactNode } from 'react';
import { actionView, campusMW, cancellablePricePerYear, chipFit, chipQuote, cloudPricePerYear, computeForecast, computeHistory, dateOf, dayOfQuarter, fmtMonth, leaseGuarantor, leaseRate, leverEffects, oppositionLevel, oppositionOdds, oppositionParts, payOptions, qOf, refWaitQ, rentQuote, siteBars, siteBuildingLiveInQ, siteBuildingsView, siteBuildQ, siteCapex, siteCapexParts, siteFit, siteLeasePerYear, siteLiveMW, sitePermitQ, sitePowerQ, siteRVG, siteSchedule, siteSizeError, siteSizeView, spotPrice, spotRentalView, supplierTerms, SUPPLIER, waitBreakdown } from '../../../engine/v2';
import type { ChipOrder, ForecastEvent, ForecastQ, GameStateV2, LeverEffect, LeverKey, PayOption, Site, SiteBars, SiteBuildingsView } from '../../../engine/v2';

/** The lessor's rate at your rating (FIN4b: below B only with a partner's guarantee, named). */
const leaseLimit = (s: GameStateV2) => {
  const r = leaseRate(s);
  const g = leaseGuarantor(s);
  return r === undefined ? `no lease at ${s.player.finance.rating}` : `lease ${F.pct(r)} at ${s.player.finance.rating}${g ? ` · ${g} guarantee` : ''}`;
};
import { CAMPUS, CHIP_TIERS, LEVERS, OPPOSITION, RENT, SITE_TIERS, SOURCES, type CampusBuildings } from '../../../data/v2/deals';
import { store } from '../store';
import { act as engineAct, runwayOf } from '../../../engine/v2';
import type { ActionView, CostLine } from '../../../engine/v2';
import { ActBtn, Limit, Gate, Rich, Seg, Term, Tip, TipCard, Toggle } from '../ui';
import { Card, HBar, KV, OptionTile, PanelHead, Ref, Spark2, tabOf, Tabs } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';
import './compute.css';
import { payOptionsPV } from '../../../engine/v2/finance/pv';

const PATHS: { id: Site['path']; label: string; term: string; icon: typeof ICON.sites }[] = [
  { id: 'rent', label: 'Rent', term: 'rent', icon: ICON.pathLease }, { id: 'grid', label: 'Grid', term: 'gridPower', icon: ICON.pathGrid },
  { id: 'gas', label: 'Gas', term: 'gasPower', icon: ICON.pathGas },
];
const STAGE_COLOR: Record<Site['stage'], string> = { permitting: '#8a9bb0', power: C.watch, building: C.you, live: C.good, blocked: C.bad };
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
  e.kind === 'siteLive' ? `${e.name} live · +${F.power(e.mw)}${e.buildings ? ` · ${e.buildings.live} of ${e.buildings.of}` : ''}` : e.kind === 'delivery' ? 'Chips delivered' : e.kind === 'cloudStart' ? `${e.name} starts` : `${e.name} ends`;
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
  const tile = (t: typeof t1, home: string, tab: string, anchor?: string) => (
    <button className={`cst ${t.tone}`} data-home={home} onClick={() => store.goto('compute', { tab, anchor })}>
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
      {tile(t1, 'idleChips', 'overview', 'siteRows')}
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
/** One payment of a commitment (when it falls due); `tail` follows it on the same line. */
function PaymentLine({ c, tail }: { c: CostLine; tail?: ReactNode }) {
  const when = c.lagDays ? `in ${F.days(c.lagDays)}` : 'now';
  return (
    <span className="cac-line">
      <Tip content={() => <TipCard title="Payment" value={F.money(c.amount, { signed: true })} rows={[{ label: 'When', value: when }, ...(c.target ? [{ label: 'What', value: c.target }] : [])]}>Every payment of this commitment, in the quarter it falls due.</TipCard>}><span><span className="dim">{c.target ?? when}</span> <b className="num tone-neg">{F.money(c.amount, { signed: true })}</b></span></Tip>
      {tail}
    </span>
  );
}
/** `custom` lets a card draw its own cost and gain lines from the action's preview (and what applying it does to cash,
 *  once computed); the cash and runway line below stays. */
function ComputePreview({ s, id, params, arrives, custom }: { s: GameStateV2; id: string; params: Record<string, number | string | boolean>; arrives?: ReactNode; custom?: (v: ActionView, w: WhatIf | undefined) => ReactNode }) {
  const v = actionView(s, id, params);
  const week = Math.floor(s.time.day / 7);
  const key = `${week}|${id}|${JSON.stringify(params)}`;
  const [memo, setMemo] = useState<{ key: string; r: ReturnType<typeof whatIf>; rw: number; racks: ReturnType<typeof peakNoRacks> } | undefined>(undefined);
  useEffect(() => {
    if (memo?.key === key) return;
    setMemo({ key, r: whatIf(s, id, params), rw: runwayOf(s).q, racks: peakNoRacks(s) });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = memo?.key === key ? memo : undefined;
  const w = m?.r;
  const runCap = 8;
  return (
    <div className="cac-pv2" data-test={`preview.${id}`}>
      <div className="cac-lines">
        {custom ? custom(v, w) : <>
          {v.costs.filter((c) => c.amount !== 0).map((c, i) => <PaymentLine key={`c${i}`} c={c} />)}
          {v.gains.filter((c) => c.amount !== 0 && c.currency === 'compute').map((c, i) => <Tip key={`g${i}`} content={() => <TipCard title="Capacity" value={`+${F.count(c.amount)} H100e`} rows={[{ label: 'Arrives', value: c.lagDays ? `in ${F.days(c.lagDays)}` : 'next quarter' }]}>{id === 'cmp.newSite' ? 'Racks for this many H100e when the site goes live.' : 'Chips (or rented capacity) this adds.'}</TipCard>}><span className="cac-line"><span className="dim">{arrives}</span> <b className="num tone-pos">+{F.count(c.amount)} H100e</b></span></Tip>)}
        </>}
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

// ───── tooltip rows (DC-10a; DC-10b reuses them) ─────
type SiteOpts = Parameters<typeof siteFit>[0];
type TipLine = { label: ReactNode; value: ReactNode; kind?: 'sub' | 'sum'; tone?: 'pos' | 'neg' | 'neutral' } | false;
/** A group of tooltip rows: `sub` rows are quieter and indented, a `sum` row carries a rule and the total. */
function TipRows({ rows }: { rows: TipLine[] }) {
  return (
    <div className="tipcard-rows">
      {rows.map((r, i) => r && <div key={i} className={`tipcard-row ${r.kind ?? ''}`}><span>{r.label}</span><span className={r.tone ? `tone-${r.tone}` : ''}>{r.value}</span></div>)}
    </div>
  );
}
/** A wide tooltip card made of row groups and drawings: title and value, a body sentence, the groups, a foot line. */
function DcTip({ title, value, body, foot, children }: { title: ReactNode; value?: ReactNode; body?: string; foot?: string; children?: ReactNode }) {
  return (
    <div className="tipcard dc-wide">
      <div className="tipcard-head"><span className="tipcard-title">{title}</span>{value !== undefined && <span className="tipcard-value">{value}</span>}</div>
      {body && <div className="tipcard-body"><Rich text={body} /></div>}
      {children}
      {foot && <div className="tipcard-foot">{foot}</div>}
    </div>
  );
}

/** Racks the engine's build preview adds for these card options, all buildings together (H100e). */
const siteGains = (s: GameStateV2, params: Record<string, number | string | boolean>) =>
  actionView(s, 'cmp.newSite', params).gains.filter((g) => g.currency === 'compute').reduce((a, g) => a + g.amount, 0);
/** Quarter label of `q` quarters from now. */
const qAhead = (s: GameStateV2, q: number) => qLabel(s, qOf(s) + q);
const gwLabel = (gw: number) => `${gw >= 10 ? Math.round(gw) : gw.toFixed(1)} GW`;
const WAIT_FROM = 2023;
/** Per source: the wait's name and the two things it is a ratio of (glossary ids and titles). */
const WAIT_TERM: Record<Site['path'], { wait: string; name: string; queue: string; queueName: string; rate: string; rateName: string }> = {
  rent: { wait: 'rentWait', name: 'Rent wait', queue: 'hallsWanted', queueName: 'Halls wanted', rate: 'hallsPerYear', rateName: 'halls finished per year' },
  grid: { wait: 'gridWait', name: 'Grid wait', queue: 'firmQueue', queueName: 'Grid queue', rate: 'connectionsPerYear', rateName: 'connections per year' },
  gas: { wait: 'turbineWait', name: 'Turbine wait', queue: 'turbineBacklog', queueName: 'Turbine backlog', rate: 'turbinesPerYear', rateName: 'turbines delivered per year' },
};

/** The campus on a quarter axis from commitment: permits, power, then one bar per building ending in a diamond at its
 *  go-live, with the quarter it goes live and what it adds. */
function CampusSchedule({ s, o, perBuilding }: { s: GameStateV2; o: SiteOpts; perBuilding: number }) {
  const P = sitePermitQ(o), W = sitePowerQ(s, o), B = siteBuildQ(o), L = siteBuildingLiveInQ(s, o);
  const w = 394, lx = 62, rx = 76, rh = 15, nq = Math.max(4, L[L.length - 1] + 1);
  const x = (q: number) => lx + (q / nq) * (w - lx - rx);
  const rows = [
    { l: 'Permits', a: 0, b: P, c: TRACK.permits, d: '', live: false },
    { l: 'Power', a: P, b: P + W, c: TRACK.power, d: `ready ${qAhead(s, P + W)}`, live: false },
    ...L.map((q, k) => ({ l: `Building ${k + 1}`, a: q - B, b: q, c: TRACK.cons, d: `${qAhead(s, q)} +${F.count(perBuilding)}`, live: true })),
  ];
  const h = rows.length * rh + 18;
  const ticks = Array.from({ length: Math.floor(nq / 4) + 1 }, (_, i) => i * 4);
  return (
    <svg className="dc-gt" width={w} height={h}>
      {ticks.map((q) => <g key={q}><line x1={x(q)} x2={x(q)} y1={0} y2={h - 14} stroke="#243041" /><text className="vl dim" x={x(q)} y={h - 3} textAnchor="middle">{qAhead(s, q)}</text></g>)}
      {rows.map((r, i) => {
        const y = i * rh + 2;
        return (
          <g key={r.l}>
            <text className="lb" x={0} y={y + 10}>{r.l}</text>
            {r.b > r.a && <rect x={x(r.a)} y={y + 2} width={x(r.b) - x(r.a)} height={8} rx={2} fill={r.c} />}
            {r.live && <path d={`M${x(r.b)} ${y} l5 6 l-5 6 l-5 -6z`} fill={C.good} />}
            {r.d && <text className={`vl ${r.live ? 'hi' : 'dim'}`} x={w} y={y + 10} textAnchor="end">{r.d}</text>}
          </g>
        );
      })}
    </svg>
  );
}

/** What a campus is and what it costs (the Buildings row's tooltip): schedule, price, saving, what is shared. */
function BuildingsTip({ s, o, params }: { s: GameStateV2; o: SiteOpts; params: Record<string, number | string | boolean> }) {
  const n = o.buildings ?? 1;
  const c = siteCapexParts(o);
  const L = siteBuildingLiveInQ(s, o);
  const g3 = siteBuildingLiveInQ(s, { ...o, path: 'grid', mw: 300, buildings: 3 });
  const differ = (q: number[]) => q.some((v) => v !== q[0]);
  const levers: [string, string, number][] = [['crashBuild', 'Crash construction', c.crash], ['rushPower', 'Rush power', c.rush], ['fastTrack', 'Fast-track permits', c.fastTrack], ['communityPackage', 'Community package', c.community]];
  return (
    <DcTip title={<Term id="campus">Buildings</Term>} value={`${n} × ${F.power(o.mw)} = ${F.power(campusMW(o))}`} foot="A block stops every building; money paid so far is lost."
      body="Copies of one building on one [[site]]. They start one per quarter and go live one by one as each is finished, or all together when power arrives later.">
      <div className="tipcard-rows dc-blk"><CampusSchedule s={s} o={o} perBuilding={siteGains(s, params) / n} /></div>
      <TipRows rows={[
        { label: `Building · ${n} × ${F.money(c.building / n)}`, value: F.money(c.building) },
        n > 1 && { label: <><Term id="repeatDesign">Repeat design</Term> · {n} buildings</>, value: `−${F.pct(CAMPUS.discount[n])} · −${F.money(c.repeatSaving)}`, kind: 'sub' },
        o.path === 'gas' ? { label: `Turbines · ${n} × ${F.money(c.extra / n)}`, value: F.money(c.extra) } : { label: 'Utility upgrades', value: F.money(c.extra) },
        ...levers.filter(([, , v]) => v > 0).map(([id, label, v]): TipLine => ({ label: <Term id={id}>{label}</Term>, value: F.money(v) })),
        { label: 'Upfront', value: F.money(c.total), kind: 'sum' },
      ]} />
      <TipRows rows={[
        { label: 'Saving by count', value: CAMPUS.counts.map((k) => `${k}: ${k === 1 ? '0%' : `−${F.pct(CAMPUS.discount[k])}`}`).join(' · ') },
        { label: 'Shared', value: <><Term id="permitting">permit</Term> · <Term id="opposition">opposition</Term> roll · <Term id="powerStage">power</Term> connection</> },
        { label: 'Largest campus', value: `grid ${F.power(SOURCES.grid.maxMW)} · gas ${F.power(SOURCES.gas.maxMW)}` },
        differ(L) && !differ(g3) && { label: `Grid · 3 × ${F.power(300)}`, value: `all live ${qAhead(s, g3[0])}: power is slower`, kind: 'sub' },
      ]} />
    </DcTip>
  );
}

/** One power source's tile tooltip: the live date it would give, the schedule behind it, what fits, and its wait. */
function PowerTip({ s, p, o, f }: { s: GameStateV2; p: (typeof PATHS)[number]; o: SiteOpts; f: SiteOpts }) {
  const rent = p.id === 'rent';
  const wt = WAIT_TERM[p.id];
  const n = f.buildings ?? 1;
  const P = sitePermitQ(f), B = siteBuildQ(f), W = sitePowerQ(s, f), W0 = sitePowerQ(s, { ...f, rush: false });
  const L = siteBuildingLiveInQ(s, f), last = L[L.length - 1];
  const a = L[0] - P, z = last - P;
  const odds = oppositionOdds(s, { path: p.id, crash: !!f.crash, communityPackage: !!f.community });
  const src = SOURCES[p.id];
  const one = siteCapexParts({ path: p.id, mw: 1000, buildings: 1 });
  const wb = waitBreakdown(s, p.id);
  const bodies: Record<Site['path'], string> = {
    rent: 'A hall a landlord builds. You rent it from the day it opens.',
    grid: "A new connection from the utility. Your site keeps today's wait from the day you commit.",
    gas: "Your own gas turbines. Your site keeps today's turbine wait from the day you commit.",
  };
  const cut = n < (o.buildings ?? 1);
  const cutNote = !cut ? '' : rent ? ` Rent is one hall: choosing Rent rents one ${F.power(f.mw)} hall.` : ` ${p.label} sites take up to ${F.power(src.maxMW)}: choosing ${p.label} cuts this campus to ${n} × ${F.power(f.mw)}.`;
  const construction = `${B} q${W >= B + n - 1 ? ', timed to end with power' : n > 1 ? ', one starts each quarter' : ''}${f.crash ? ' (crash)' : ''}`;
  const live = qRange(s, qOf(s) + L[0], qOf(s) + last);
  const fits = [...SITE_TIERS].reverse().map((t) => ({ mw: t.mw, n: [...CAMPUS.counts].reverse().find((k) => !siteSizeError({ path: p.id, mw: t.mw, buildings: k })) ?? 1 }));
  const waitName = <><Term id={wt.wait}>{wt.name}</Term> today</>;
  return (
    <DcTip title={<Term id={p.term}>{p.label}</Term>} value={`live ${live}${rent ? '' : ` · +0–${OPPOSITION.delayQ[1]}q`}`} body={bodies[p.id] + cutNote}
      foot={`A new 1 GW ${rent ? 'rented hall' : `${p.id} site`} adds ${wb.perGWQ.toFixed(1)} q to everyone's wait.`}>
      <TipRows rows={rent ? [
        { label: waitName, value: `${W} q` },
        { label: 'Live', value: `${W} q · ${qAhead(s, W)}`, kind: 'sum' },
      ] : [
        { label: <Term id="permitting">Permits</Term>, value: `${P} q` },
        { label: waitName, value: `${W0} q` },
        !!f.rush && { label: <Term id="rushPower">Rush power</Term>, value: p.id === 'grid' ? `−${F.pct(1 - LEVERS.rushGrid.waitMult)} → ${W} q` : `used turbines → ${W} q`, kind: 'sub' },
        { label: <Term id="construction">Construction</Term>, value: construction },
        { label: 'Live', value: n > 1 && a !== z ? `${P} + ${a}…${z} = ${L[0]}…${last} q · ${live}` : `${P} + ${a} = ${L[0]} q · ${live}`, kind: 'sum' },
        { label: <><Term id="opposition">Opposition</Term> delay · {F.pct(odds.delay)}</>, value: `+${OPPOSITION.delayQ[0]} to ${OPPOSITION.delayQ[1]} q` },
        { label: <><Term id="opposition">Block</Term> · {F.pct(odds.block)}</>, value: 'money spent is lost' },
      ]} />
      <TipRows rows={[
        rent ? { label: 'Largest site', value: F.power(src.maxMW) } : { label: `Fits on ${p.id}`, value: fits.map((t) => `${t.n} × ${F.power(t.mw)}`).join(' · ') },
        { label: 'Upfront per GW', value: F.money(one.building + one.extra) },
        { label: 'Power price', value: rent ? `${F.money(RENT.perGWYear)} per GW-yr + grid` : `×${src.powerCostMult.toFixed(1)} grid` },
      ]} />
      <div className="tipcard-rows dc-blk">
        <div className="tipcard-row"><span><Term id={wt.wait}>{wt.name}</Term>, {WAIT_FROM} → today</span><span>{Math.round(refWaitQ(p.id, WAIT_FROM))} → {Math.round(wb.waitQ)} q</span></div>
        <WaitSpark s={s} p={p.id} now={wb.waitQ} />
      </div>
      <TipRows rows={[
        { label: <Term id={wt.queue}>{wt.queueName}</Term>, value: gwLabel(wb.youGW + wb.othersGW) },
        { label: `you${wb.you.length ? ` (${wb.you.map((y) => y.name).join(', ')})` : ''}`, value: gwLabel(wb.youGW), kind: 'sub' },
        { label: 'everyone else', value: gwLabel(wb.othersGW), kind: 'sub' },
        { label: <>÷ <Term id={wt.rate}>{wt.rateName}</Term></>, value: gwLabel(wb.rateGWPerYear) },
        { label: 'Wait', value: `${(wb.waitQ / 4).toFixed(1)} yr = ${Math.round(wb.waitQ)} q`, kind: 'sum' },
      ]} />
    </DcTip>
  );
}

/** One source's wait by quarter: the no-build reference from Q1 2023 to the game's start, then what the game recorded,
 *  ending on today's wait; years on the axis. */
function WaitSpark({ s, p, now }: { s: GameStateV2; p: Site['path']; now: number }) {
  const start = dateOf(s, 0);
  const i0 = (start.getUTCFullYear() - WAIT_FROM) * 4 + Math.floor(start.getUTCMonth() / 3);
  const hist = s.power.waitHist[p];
  const ys = [...Array.from({ length: i0 }, (_, i) => refWaitQ(p, WAIT_FROM + i / 4)), ...hist, ...(hist.length <= qOf(s) ? [now] : [])];
  const w = 368, h = 46, pad = 4, lo = Math.min(...ys), span = Math.max(1, Math.max(...ys) - lo);
  const X = (i: number) => pad + (i / (ys.length - 1)) * (w - 2 * pad), Y = (v: number) => h - pad - ((v - lo) / span) * (h - 2 * pad);
  return (
    <svg className="dc-gt" width={w} height={h + 14}>
      <polyline points={ys.map((v, i) => `${X(i)},${Y(v)}`).join(' ')} fill="none" stroke={C.watch} strokeWidth={1.6} />
      <circle cx={X(ys.length - 1)} cy={Y(ys[ys.length - 1])} r={2.5} fill={C.watch} />
      {Array.from({ length: Math.floor((ys.length - 1) / 4) + 1 }, (_, k) => <text key={k} className="vl dim" x={X(k * 4)} y={h + 11}>{WAIT_FROM + k}</text>)}
    </svg>
  );
}

/** The quarters a lever saves, first building to last: "−2 q", "−1 to −5 q", "0 q". */
const savesText = (e: LeverEffect) => (e.savesQ === e.savesLastQ ? (e.savesQ === 0 ? '0 q' : `−${e.savesQ} q`) : `−${e.savesQ} to −${e.savesLastQ} q`);

const LEVER_TERM: Record<LeverKey, { id: string; label: string }> = {
  crash: { id: 'crashBuild', label: 'Crash construction' },
  rush: { id: 'rushPower', label: 'Rush power' },
  fastTrack: { id: 'fastTrack', label: 'Fast-track permits' },
  community: { id: 'communityPackage', label: 'Community package' },
};

/** One speed-up's tooltip: what it does, the quarters it saves (first and last building) and what its price is of. */
function LeverTip({ k, e, path, n }: { k: LeverKey; e: LeverEffect; path: Site['path']; n: number }) {
  const basis: Record<LeverKey, string> = {
    crash: `${F.pct(LEVERS.crash.buildingShare)} of the building`,
    rush: path === 'grid' ? `$${LEVERS.rushGrid.perGW}B per GW` : `${F.pct(LEVERS.rushGas.turbineShare)} of the turbines`,
    fastTrack: `${F.pct(LEVERS.fastTrack.buildingShare)} of the building`,
    community: `$${LEVERS.community.perGW}M per MW`,
  };
  const body: Record<LeverKey, string> = {
    crash: `Construction takes ${F.pct(1 - LEVERS.crash.buildMult)} less time, and local opposition grows.`,
    rush: path === 'grid' ? `Pay for the substation and lines yourself: the grid wait is ${F.pct(1 - LEVERS.rushGrid.waitMult)} shorter.` : `Buy used turbines: the turbine wait falls to ${LEVERS.rushGas.waitQ} q.`,
    fastTrack: `Permits take ${LEVERS.fastTrack.permitQ} q less.`,
    community: `Block odds ×${e.blockMult}.`,
  };
  const t = LEVER_TERM[k];
  return (
    <TipCard title={<Term id={t.id}>{t.label}</Term>} value={k === 'community' ? `block ×${e.blockMult}` : savesText(e)} rows={[
      ...(k === 'community' ? [] : [{ label: n > 1 ? 'Saves, first building' : 'Saves', value: `${e.savesQ} q` }, ...(n > 1 ? [{ label: 'Saves, last building', value: `${e.savesLastQ} q` }] : [])]),
      { label: `Price · ${basis[k]}`, value: F.money(e.cost, { signed: true }) },
      ...(k === 'crash' ? [{ label: 'Opposition odds', value: `×${LEVERS.crash.oddsMult}` }] : []),
    ]}>{body[k]}</TipCard>
  );
}

/** What sets a campus's go-live dates: building k is set by power when the power wait W is at least its construction B + k. */
function datesSetBy(s: GameStateV2, o: SiteOpts): ReactNode {
  const n = o.buildings ?? 1;
  if (o.path === 'rent') return <>the hall sets the date</>;
  const W = sitePowerQ(s, o), B = siteBuildQ(o);
  const j = Array.from({ length: n }, (_, k) => k).filter((k) => W >= B + k).length;
  const power = <Term id="powerStage">power</Term>, cons = <Term id="construction">construction</Term>;
  if (j === n) return n === 1 ? <>{power} sets the date</> : <>{power} sets the date, all go live together</>;
  if (j === 0) return <>{cons} sets the {n === 1 ? 'date' : 'dates'}</>;
  return <>{power} sets the first{j > 1 ? ` ${j}` : ''}, {cons} the rest</>;
}

/** The campus's opposition tooltip: the odds and what they are made of (one roll for the whole site). */
function BuildOppositionTip({ s, o, paidNow }: { s: GameStateV2; o: SiteOpts; paidNow: number | undefined }) {
  const p = oppositionParts(s, { path: o.path, crash: !!o.crash, communityPackage: !!o.community });
  const n = o.buildings ?? 1;
  const source = PATHS.find((x) => x.id === o.path)!.label;
  return (
    <DcTip title={<Term id="opposition">Opposition</Term>} value={oppositionLevel(p.block)} foot={o.crash ? 'Crash construction raises both.' : undefined}
      body={`Local opposition decides when permits end, ${qAhead(s, sitePermitQ(o))}.${n > 1 ? ' One roll for the whole campus.' : ''}`}>
      <TipRows rows={[
        { label: `${source} site`, value: F.pct(p.blockBase) },
        { label: <Term id="dcPublic">Public against data centres</Term>, value: `×${p.mood.toFixed(2)}` },
        p.crashMult !== 1 && { label: <Term id="crashBuild">Crash construction</Term>, value: `×${p.crashMult}` },
        p.communityMult !== 1 && { label: <Term id="communityPackage">Community package</Term>, value: `×${p.communityMult}`, tone: 'pos' },
      ]} />
      <TipRows rows={[
        { label: 'Blocked', value: F.pct(p.block), kind: 'sum' },
        { label: 'money spent so far is lost', value: paidNow === undefined ? '' : `≈ ${F.money(paidNow)}`, kind: 'sub' },
        { label: 'Delayed', value: F.pct(p.delay), kind: 'sum' },
        { label: 'live date slips', value: `+${OPPOSITION.delayQ[0]} to ${OPPOSITION.delayQ[1]} q`, kind: 'sub' },
      ]} />
    </DcTip>
  );
}

/** The build card's cost and gain lines (grid and gas): capex with the repeat-design saving, the campus's racks and what
 *  sets their dates, the opposition odds and when they are decided. */
function BuildLines({ s, v, w, o }: { s: GameStateV2; v: ActionView; w: WhatIf | undefined; o: SiteOpts }) {
  const n = o.buildings ?? 1;
  const c = siteCapexParts(o);
  const gains = v.gains.filter((g) => g.amount !== 0 && g.currency === 'compute');
  const total = gains.reduce((a, g) => a + g.amount, 0);
  const odds = oppositionOdds(s, { path: o.path, crash: !!o.crash, communityPackage: !!o.community });
  const P = sitePermitQ(o);
  const tail = c.repeatSaving > 0 && (
    <Tip content={() => <TipCard title={<Term id="repeatDesign">Repeat design</Term>} value={`−${F.pct(CAMPUS.discount[n as CampusBuildings])}`} rows={[
      { label: `Building · ${n} × ${F.money(c.building / n)}`, value: F.money(c.building) },
      { label: 'Saving on the building', value: `−${F.money(c.repeatSaving)}`, tone: 'pos' },
    ]}>Building the same design again costs less each time.</TipCard>}>
      <span> <span className="dim">· <Term id="repeatDesign">repeat design</Term> saves</span> <b className="num tone-pos">{F.money(c.repeatSaving)}</b></span>
    </Tip>
  );
  return (
    <>
      {v.costs.filter((x) => x.amount !== 0).map((x, i) => <div key={i} className="cac-full"><PaymentLine c={x} tail={i === 0 ? tail : undefined} /></div>)}
      {total > 0 && (
        <div className="cac-full">
          <Tip content={() => <TipCard title="Capacity" value={`+${F.count(total)} H100e`} rows={gains.map((g) => ({ label: qAhead(s, (g.lagDays ?? 0) / 91), value: `+${F.count(g.amount)} H100e` }))}>Racks for this many H100e as each building goes live.</TipCard>}>
            <span className="cac-line"><span className="dim">racks for</span> <b className="num tone-pos">+{F.count(total)} H100e</b>
              <span className="dim">{n > 1 && <> · {F.count(total / n)} per <Term id="building">building</Term> live</>} · {datesSetBy(s, o)}</span></span>
          </Tip>
        </div>
      )}
      <div className="cac-full">
        <Tip content={() => <BuildOppositionTip s={s} o={o} paidNow={w ? -w.cash : undefined} />}>
          <span className="cac-line"><span className="dim"><Term id="opposition">opposition</Term> decides {P === 0 ? 'now' : qAhead(s, P)}</span> <b className="num tone-warn">block {F.pct(odds.block)} · delay {F.pct(odds.delay)}</b></span>
        </Tip>
      </div>
    </>
  );
}

function BuildCard({ s }: { s: GameStateV2 }) {
  const [tier, setTier] = useState(2);
  const [buildings, setBuildings] = useState<CampusBuildings>(1);
  const [path, setPath] = useState<Site['path']>('gas');
  const [crash, setCrash] = useState(false);
  const [rush, setRush] = useState(false);
  const [fastTrack, setFastTrack] = useState(false);
  const [communityIn, setCommunity] = useState<boolean | undefined>(undefined);
  const [pay, setPay] = useState<PayOption['id']>('cash');
  const [open, setOpen] = useState(false);
  const community = communityIn ?? s.player.policies.communityBenefits;
  const kW = s.power.kWPerH100e;
  const o = siteFit({ path, mw: SITE_TIERS[tier].mw, buildings, crash, rush, fastTrack, community });
  const n = o.buildings ?? 1;
  const colo = path === 'rent';
  const sched = siteSchedule(s, o);
  const pays = payOptions(s, siteCapex(o), 'site', sched);
  const payNow = colo || pays.find((x) => x.id === pay)?.blocked ? 'cash' : pay;
  const params = { path, mw: o.mw, buildings: n, crash, rush, fastTrack, community, pay: payNow };
  const effects = leverEffects(s, o);
  const levers: [LeverKey, boolean, (v: boolean) => void][] = [['crash', crash, setCrash], ['rush', rush, setRush], ['fastTrack', fastTrack, setFastTrack], ['community', community, setCommunity]];
  // The footer names the speed-ups taken: the first in bold (crash, rush, fast-track), the others after it.
  const taken = colo ? [] : levers.filter(([k, on]) => on && k !== 'community').map(([k]) => LEVER_TERM[k].label);
  // Choosing a source or a size cuts the campus to what fits (siteFit), as the other tiles already showed.
  const pickPath = (p: Site['path']) => { setPath(p); setBuildings(siteFit({ ...o, path: p }).buildings as CampusBuildings); };
  const pickTier = (i: number) => { setTier(i); setBuildings(siteFit({ ...o, mw: SITE_TIERS[i].mw }).buildings as CampusBuildings); };
  return (
    <Card title={<span className="row-i"><ICON.sites size={14} />Build data centre</span>} className="cac" id="ctl-sites"
      right={<Tip content={() => <TipCard title={<Term id="kwPerH100e">Power per chip</Term>} value={`${kW.toFixed(2)} kW per H100e`}>A gigawatt of racks holds this many H100e at today's chip efficiency.</TipCard>}><span className="dim small"><b className="num">{F.count(1e6 / kW)}</b> H100e per GW</span></Tip>}>
      <div className="cac-tiles c3">
        {SITE_TIERS.map((x, i) => {
          const bq = siteBuildQ({ ...o, mw: x.mw });
          return (
            <OptionTile key={x.id} label={F.power(x.mw)} glyphs={<span className="dc-sz">{colo ? 'rented hall' : `${bq} q to build`}</span>} active={o.mw === x.mw} onClick={() => pickTier(i)} testId={`site-${x.id}`}
              tip={() => <TipCard title={<Term id="building">Building</Term>} value={F.power(x.mw)} rows={[
                { label: 'Holds today', value: `${F.count(siteGains(s, { ...params, mw: x.mw, buildings: 1 }))} H100e` },
                ...(colo ? [] : [{ label: <Term id="construction">Construction</Term>, value: `${bq} q${crash ? ' crash' : ''}` }]),
              ]}>One data-centre building. A [[campus|campus]] repeats it.</TipCard>} />
          );
        })}
      </div>
      {!colo && (
        <Tip as="div" content={() => <BuildingsTip s={s} o={o} params={params} />}>
          <div className="dc-bld" data-test="site-buildings">
            <Term id="campus">Buildings</Term>
            <Seg value={n} onChange={setBuildings} options={CAMPUS.counts.map((k) => ({ v: k, label: String(k), locked: siteSizeError({ ...o, buildings: k }) }))} />
            {n > 1 && <b className="num tone-pos">−{F.pct(CAMPUS.discount[n])}</b>}
            <span className="sp" />
            <span className="num dim">{n} × {F.power(o.mw)} =</span><b className="num">{F.power(campusMW(o))}</b>
          </div>
        </Tip>
      )}
      <div className="cac-lbl">Power</div>
      <div className="cac-tiles c3">
        {PATHS.map((p) => {
          const f = siteFit({ ...o, path: p.id });
          const L = siteBuildingLiveInQ(s, f);
          const cut = p.id !== 'rent' && (f.buildings ?? 1) < n;
          return (
            <OptionTile key={p.id} label={p.label} icon={p.icon} active={path === p.id} onClick={() => pickPath(p.id)} testId={`path-${p.id}`}
              glyphs={<span className="dc-gl"><b>{qRange(s, qOf(s) + L[0], qOf(s) + L[L.length - 1])}</b>
                {p.id === 'rent' ? <span className="cp">≤ {F.power(SOURCES.rent.maxMW)}</span> : <span><span className="bd">+0–{OPPOSITION.delayQ[1]}q</span> <span className={`cp ${cut ? 'bind' : ''}`}>· {cut ? `${f.buildings} × ${F.power(f.mw)}` : `≤ ${F.power(SOURCES[p.id].maxMW)}`}</span></span>}</span>}
              tip={() => <PowerTip s={s} p={p} o={o} f={f} />} />
          );
        })}
      </div>
      {!colo && <><div className="cac-lbl"><Term id="payOption">Pay with</Term></div><PayTiles s={s} opts={pays} value={payNow} onChange={setPay} testPrefix="site-pay" asset="site" timing={{ site: sched }} /></>}
      <div className="cac-pv"><ComputePreview s={s} id="cmp.newSite" params={params} arrives={<>racks for, live ≈ {qAhead(s, siteBuildingLiveInQ(s, o)[0])}</>} custom={colo ? undefined : (v, w) => <BuildLines s={s} v={v} w={w} o={o} />} />{(() => { const z = siteSizeView(s, path); return <Limit id="site.mw" tone="quiet">{F.power(z.min)}–{F.power(z.max)}</Limit>; })()}{!colo && <Limit id="lease.rating" tone={leaseRate(s) === undefined ? 'bind' : 'quiet'}>{leaseLimit(s)}</Limit>}</div>
      {open && !colo && (
        <div className="cac-opts">
          {levers.map(([k, on, set]) => {
            const e = effects[k]!;
            const t = LEVER_TERM[k];
            return (
              <Tip key={k} as="div" content={() => <LeverTip k={k} e={e} path={path} n={n} />}>
                <span data-lever={k}><Toggle on={on} onChange={set} label={<>
                  <Term id={t.id}>{t.label}</Term> · {k === 'community' ? `block ×${e.blockMult}` : savesText(e)}, {F.money(e.cost, { signed: true })}{k === 'crash' ? ', odds up' : ''}{k === 'community' && s.player.policies.communityBenefits ? ' · company default' : ''}
                </>} /></span>
              </Tip>
            );
          })}
          {!s.player.policies.communityBenefits && <span className="row-i small"><span className="dim">Company default</span><ActBtn id="cmp.community" label="Package every site" /></span>}
        </div>
      )}
      <div className="cac-foot">
        {colo ? <span className="cac-more static"><b>Normal build</b></span>
          : <button className="cac-more" onClick={() => setOpen(!open)} data-test="opt-site"><ICON.go size={12} className={open ? 'rot' : ''} /><b>{taken[0] ?? 'Normal build'}</b>{[...taken.slice(1), ...(community && !colo ? ['community package'] : []), ...(payNow === 'lease' ? ['lease'] : [])].map((x) => <span key={x} className="dim"> · {x}</span>)}</button>}
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
        <SiteRows s={s} />
      </div>
    </>
  );
}

// ═════════════════════════ Sites (rows under the chart) ═════════════════════════

const TRACK = { permits: '#8a9bb0', cons: C.you, power: C.watch, live: 'rgba(76,195,138,.55)' };
const SOURCE_NAME: Record<Site['path'], string> = { rent: 'Rent', grid: 'Grid', gas: 'Gas' };
const POWER_WAIT: Record<Site['path'], string> = { rent: 'a hall', grid: 'grid', gas: 'turbines' };

interface SiteRow { x: Site; bars?: SiteBars; view?: SiteBuildingsView; full: boolean }

/** One quarter range as `Q3 29` or `Q3 29 → Q3 30`. */
const qRange = (s: GameStateV2, a: number, b: number) => (a === b ? qLabel(s, a) : `${qLabel(s, a)} → ${qLabel(s, b)}`);

/** The community package's price for one site: what the action's preview charges. */
const packagePrice = (s: GameStateV2, x: Site) => -actionView(s, 'cmp.community', { siteId: x.id }).costs.filter((c) => c.currency === 'cash').reduce((a, c) => a + c.amount, 0);

/** What a site's opposition odds are made of (the block pill's tooltip). */
function OppositionTip({ s, x }: { s: GameStateV2; x: Site }) {
  const p = oppositionParts(s, x);
  return (
    <TipCard title={<Term id="opposition">Opposition</Term>} value={`block ${F.pct(p.block)}`} rows={[
      { label: 'Block, before modifiers', value: F.pct(p.blockBase) },
      { label: <Term id="dcPublic">Public mood</Term>, value: `×${p.mood.toFixed(2)}` },
      ...(p.crashMult !== 1 ? [{ label: <Term id="crashBuild">Crash construction</Term>, value: `×${p.crashMult}` }] : []),
      ...(p.communityMult !== 1 ? [{ label: <Term id="communityPackage">Community package</Term>, value: `×${p.communityMult}`, tone: 'pos' as const }] : []),
      { label: 'Delay odds', value: F.pct(p.delay) },
    ]}>One roll when permits end, for the whole site. A block loses what you have paid so far; a delay adds 1 to 3 quarters.</TipCard>
  );
}

function SiteTip({ s, r }: { s: GameStateV2; r: SiteRow }) {
  const { x, bars, view } = r;
  const of = view?.of ?? x.ws3.buildings ?? 1;
  const bmw = x.ws3.buildingMW ?? x.mw / of;
  const liveMW = siteLiveMW(x, s.time.day);
  const odds = oppositionOdds(s, x);
  const taken: ReactNode[] = [];
  if (x.crash) taken.push(<Term key="crash" id="crashBuild">crash</Term>);
  if (x.ws3.rush) taken.push(<Term key="rush" id="rushPower">rush power</Term>);
  if (x.ws3.fastTrack) taken.push(<Term key="fast" id="fastTrack">fast-track</Term>);
  if (x.communityPackage) taken.push(<Term key="pack" id="communityPackage">community package</Term>);
  const stage = x.stage === 'blocked' ? 'blocked' : r.full ? 'live' : x.stage === 'live' ? `${view?.live} of ${of} live` : x.stage === 'permitting' ? 'permits' : x.stage === 'power' ? 'waiting for power' : 'construction';
  const rows: { label: ReactNode; value: ReactNode; tone?: 'neg' | 'neutral' | 'pos' }[] = [
    { label: <Term id="sitePath">Power source</Term>, value: `${SOURCE_NAME[x.path]} · ${x.region}` },
    { label: of > 1 ? <Term id="campus">Buildings</Term> : <Term id="mw">Capacity</Term>, value: of > 1 ? `${of} × ${F.power(bmw)} = ${F.power(x.mw)}` : F.power(x.mw) },
  ];
  if (view && !r.full && x.stage === 'live') rows.push({ label: 'Live now', value: F.power(liveMW) });
  if (bars && !r.full) {
    if (bars.permits) rows.push({ label: <Term id="permitting">Permits end</Term>, value: qLabel(s, bars.permits[1]) });
    if (bars.power) rows.push({ label: <Term id="powerStage">Power ready</Term>, value: qLabel(s, bars.power[1]) });
    if (bars.construction) rows.push({ label: <Term id="construction">Construction</Term>, value: `${qLabel(s, bars.construction[0])} – ${qLabel(s, bars.construction[1])}` });
  }
  if (view && of > 1) rows.push({ label: <Term id="buildingsLive">Buildings live</Term>, value: view.buildings.map((b) => `${qLabel(s, b.liveQ)}${b.live ? ' ✓' : ''}`).join(' · ') });
  if (x.stage === 'permitting' && !x.ws3.rolled && x.path !== 'rent') rows.push({ label: <Term id="opposition">Block / delay</Term>, value: `${F.pct(odds.block)} / ${F.pct(odds.delay)}`, tone: odds.block > 0.1 ? 'neg' : 'neutral' });
  rows.push(
    { label: 'Speed-ups taken', value: taken.length ? taken.reduce<ReactNode[]>((a, n, i) => (i ? [...a, ' · ', n] : [n]), []) : 'none' },
    { label: <Term id="capex">Capex paid</Term>, value: `${F.money(x.capexPaid)} / ${F.money(x.capex)}` },
    { label: 'Chips installed', value: `${F.count(x.installed)} H100e` },
    { label: <Term id="payOption">Paid with</Term>, value: x.ws3?.lease ? `lease ${F.pct(x.ws3.lease.rate)} · ${F.money(siteLeasePerYear(x, x.stage === 'live' ? x.ws3.lease.funded : x.ws3.lease.funded + (x.capex - x.capexPaid) * x.spvFunded), { perYear: true })} × 15 y` : 'cash' },
  );
  if (x.ws3?.lease) rows.push({ label: <Term id="rvg">Residual-value guarantee</Term>, value: F.money(siteRVG(s, x.id)) });
  return <TipCard title={x.name} value={stage} rows={rows} />;
}

/** The Sites section under the chart: one row per site, with its permits, construction and power bars on a shared
 *  quarter axis, one diamond per building, and the live range and stage at the right. */
function SiteRows({ s }: { s: GameStateV2 }) {
  const q0 = qOf(s);
  const d0 = dayOfQuarter(s.time.startDate, q0);
  const now = q0 + (s.time.day - d0) / Math.max(1, dayOfQuarter(s.time.startDate, q0 + 1) - d0);
  const kW = s.power.kWPerH100e;
  const rows: SiteRow[] = s.player.sites.map((x) => {
    const bars = siteBars(s, x), view = siteBuildingsView(s, x);
    return { x, bars, view, full: !!view && x.stage === 'live' && view.live >= view.of };
  });
  const rank = (r: SiteRow) => (r.x.stage === 'blocked' ? 2 : r.full ? 0 : 1);
  rows.sort((a, b) => rank(a) - rank(b) || (a.bars?.liveQ ?? 0) - (b.bars?.liveQ ?? 0));
  const liveMW = s.player.sites.reduce((a, x) => a + siteLiveMW(x, s.time.day), 0);
  const usedMW = s.player.sites.reduce((a, x) => a + Math.min(siteLiveMW(x, s.time.day), (x.installed * kW) / 1000), 0);
  // axis: from five quarters back (earlier if a site not yet fully live began earlier) to eight ahead (later if a building goes live later)
  const starts = rows.filter((r) => r.bars && !r.full).flatMap((r) => [r.bars!.permits?.[0], r.bars!.power?.[0], r.bars!.construction?.[0]]).filter((q): q is number => q !== undefined);
  const ends = rows.flatMap((r) => (r.bars ? [(r.bars.lastLiveQ ?? r.bars.liveQ) + 1] : []));
  const Q0 = Math.floor(Math.min(q0 - 5, ...starts)), Q1 = Math.ceil(Math.max(q0 + 8, ...ends));
  const frac = (q: number) => Math.max(0, Math.min(1, (q - Q0) / (Q1 - Q0)));
  const X = (q: number) => `${frac(q) * 100}%`;
  const W = (a: number, b: number) => `${(frac(b) - frac(a)) * 100}%`;
  const years: number[] = [];
  for (let q = Q0; q <= Q1; q++) if (dateOf(s, dayOfQuarter(s.time.startDate, q)).getUTCMonth() < 3 && Math.abs(q - now) > 0.8 && frac(q) > 0.03 && frac(q) < 0.94) years.push(q);
  /** A bar from quarter a to b: solid up to today, hatched after. */
  const part = (k: string, cls: string, a: number, b: number, bg: string) => [
    a < now && <i key={`${k}p`} className={cls} style={{ left: X(a), width: W(a, Math.min(b, now)), background: bg }} />,
    b > now && <i key={`${k}f`} className={`${cls} pl`} style={{ left: X(Math.max(a, now)), width: W(Math.max(a, now), b), background: bg }} />,
  ];
  const track = (r: SiteRow) => {
    const { bars, view } = r;
    const out: ReactNode[] = [<span key="nl" className="nl" style={{ left: X(now) }} />];
    if (r.full) out.push(<i key="live" className="f" style={{ left: 0, width: '100%', background: TRACK.live }} />);
    else if (bars && view) {
      const last = bars.lastLiveQ ?? bars.liveQ;
      if (bars.permits) out.push(...part('pe', 'f', bars.permits[0], bars.permits[1], TRACK.permits));
      if (bars.construction) out.push(...part('co', 't', bars.construction[0], bars.construction[1], TRACK.cons));
      if (bars.power) out.push(...part('po', 'b', bars.power[0], bars.power[1], TRACK.power));
      if (view.live > 0) {
        out.push(...part('l1', 'b', bars.liveQ, last, TRACK.live));
        out.push(...part('l2', 'f', last, Q1, TRACK.live));
      }
      view.buildings.forEach((b, k) => out.push(<span key={`d${k}`} className={`lv ${b.live ? '' : 'rk'}`} style={{ left: X(b.liveQ) }} />));
    }
    return out;
  };
  const status = (r: SiteRow): ReactNode => {
    const { x, bars, view } = r;
    if (x.stage === 'blocked') return <><span className="tone-neg">blocked</span><ActBtn id="SITE_DEAL" params={{ siteId: x.id }} /><ActBtn id="SITE_MOVE" params={{ siteId: x.id }} /><ActBtn id="SITE_SUE" params={{ siteId: x.id }} /><Tip content={() => <TipCard title={<Term id="capex">Capex lost</Term>} value={F.money(x.capexPaid)} rows={[{ label: 'Planned capex', value: F.money(x.capex) }]}>Paid on the site before opposition blocked it.</TipCard>}><span className="dim">{F.money(x.capexPaid)} lost</span></Tip></>;
    if (!view || !bars) return null;
    if (r.full) return <><span className="tone-pos">live</span><span className="dim">since {qLabel(s, view.buildings[0].liveQ)}</span></>;
    if (x.stage === 'live') {
      const next = view.buildings.find((b) => !b.live);
      return <><span className="tone-pos"><Term id="buildingsLive">{view.live} of {view.of} live</Term></span>{view.inConstruction > 0 ? <span className="dim">{view.inConstruction} in construction</span> : next ? <span className="dim">next {qLabel(s, next.liveQ)}</span> : null}</>;
    }
    if (x.stage === 'permitting') {
      const odds = oppositionOdds(s, x);
      const canPackage = !x.communityPackage && !x.ws3.rolled && x.path !== 'rent';
      return (
        <>
          <Term id="permitting">Permits</Term>
          {!x.ws3.rolled && odds.block >= 0.005 && <Tip content={() => <OppositionTip s={s} x={x} />}><span className={`dc-pill ${odds.block > 0.1 ? '' : 'warn'}`}>block {F.pct(odds.block)}</span></Tip>}
          {canPackage && <ActBtn id="cmp.community" params={{ siteId: x.id }} label={`Community package · ${F.money(packagePrice(s, x))}`} />}
        </>
      );
    }
    if (x.stage === 'power') return <><Term id="powerStage">Waiting for {POWER_WAIT[x.path]}</Term>{x.path !== 'rent' && bars.construction && <span className="dim">build from {qLabel(s, bars.construction[0])}</span>}</>;
    return <><Term id="construction">Construction</Term><span className="dim">until {qLabel(s, bars.lastLiveQ ?? bars.liveQ)}</span></>;
  };
  return (
    <Card title="Sites" term="site" home="sites" id="ctl-siteRows" className="dcs"
      right={<span className="row-i small"><span className="dim">racks used / live</span><HBar v={usedMW} max={Math.max(1, liveMW)} w={110} h={8} color={chipFit(s).idle > 0 ? C.bad : usedMW > liveMW * 0.95 ? C.watch : C.good} />
        <Tip content={() => <TipCard title={<Term id="mw">Racks used</Term>} rows={[{ label: 'Used', value: F.power(usedMW) }, { label: 'Live capacity', value: F.power(liveMW) }]}>Power of your live buildings and how much installed chips draw.</TipCard>}><b className="num" data-home="mwUsed"><span data-test="sites-used">{F.power(usedMW)}</span> / <span data-test="sites-live">{F.power(liveMW)}</span></b></Tip></span>}>
      <div className="dcs-row ax"><span /><span /><span className="dcs-tr">
        {years.map((q) => <span key={q} className="tk" style={{ left: X(q) }}>{dateOf(s, dayOfQuarter(s.time.startDate, q)).getUTCFullYear()}</span>)}
        <span className="tk now" style={{ left: X(now) }}>today</span>
      </span><span className="dim small">live</span><span /></div>
      {rows.map((r) => {
        const { x, view } = r;
        const times = view && x.stage !== 'blocked' && !r.full ? qRange(s, view.buildings[0].liveQ, view.buildings[view.buildings.length - 1].liveQ) : '';
        return (
          <Tip as="div" key={x.id} content={() => <SiteTip s={s} r={r} />}>
            <div className="dcs-row" data-site={x.id}>
              <span className="dcs-name"><span className="dot" style={{ background: STAGE_COLOR[x.stage] }} /><span className="ellip">{x.name}</span><span className="dim">{x.path}</span></span>
              <span className="dcs-mw">{view && view.of > 1 && <span className="dcs-bl">{view.buildings.map((b, k) => <i key={k} className={b.live ? 'on' : ''} />)}</span>}{F.power(x.mw)}</span>
              <span className="dcs-tr">{track(r)}</span>
              <span className="dcs-lv">{times}</span>
              <span className="dcs-st">{status(r)}</span>
            </div>
          </Tip>
        );
      })}
      {!rows.length && <div className="dim small">No sites yet.</div>}
      <div className="dcs-leg">
        <span><i style={{ background: TRACK.permits }} /><Term id="permitting">permits</Term></span><span><i style={{ background: TRACK.cons }} /><Term id="construction">construction</Term></span>
        <span><i style={{ background: TRACK.power }} /><Term id="powerStage">power</Term></span><span><i style={{ background: TRACK.live }} />live</span>
        <span><i className="dm" /><Term id="building">building</Term> live</span><span><i className="pl" style={{ background: TRACK.cons }} />planned</span>
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
  const tab = tab0 === 'split' || tab0 === 'sites' ? 'overview' : tab0; // UB-5: the allocation moved to LAB; the Sites tab became rows under the chart
  return (
    <div className="panel-v2 cmp" data-panel="compute">
      <PanelHead icon={ICON.computePanel} title="Compute" sub="chips, sites and cloud"
        tabs={<Tabs panel="compute" def="overview" tabs={[{ id: 'overview', label: 'Overview', icon: ICON.overview }, { id: 'orders', label: 'Orders & market', icon: ICON.supply }]} />}
        right={<span className="row-i"><Ref id="split" to={{ panel: 'lab', anchor: 'split' }}>Compute allocation</Ref></span>} />
      {tab === 'overview' && <Overview s={s} />}
      {/* Jank C4: orders, cloud and the chip market share one tab (each used under 40% of the screen alone). */}
      {(tab === 'orders' || tab === 'market') && <div className="g3"><Deliveries s={s} /><Cloud s={s} /><Market s={s} /></div>}
    </div>
  );
}
