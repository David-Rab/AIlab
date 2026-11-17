// Compute (design/ux/COMPUTE.md). Overview (L1): three verdicts, the capacity and fleet forecast, and three ways to add
// compute (chips, data centres, cloud) with fine options folded away. Sites, Orders and Market (L2) hold the detail.
// HOME of idle chips, empty racks, vendor fill, the forecast, sites & power, orders, cloud contracts and the chip
// market. Compute online and the split live in Company and are only linked here.
import { useEffect, useState, type ReactNode } from 'react';
import { actionView, chipFit, cloudPricePerYear, computeForecast, computeHistory, dateOf, dayOfQuarter, fmtDate, fmtMonth, oppositionOdds, orderQuote, qOf, siteEtaQ, spotPrice } from '../../../engine/v2';
import type { ChipOrder, ForecastEvent, ForecastQ, GameStateV2, Site } from '../../../engine/v2';
import { CHIP_TIERS, SITE_PATHS, SITE_TIERS } from '../../../data/v2/deals';
import { store } from '../store';
import { ActBtn, Gate, Seg, Term, Tip, TipCard, Toggle } from '../ui';
import { Card, CostPills, HBar, KV, OptionTile, PanelHead, Pill, Ref, Spark2, tabOf, Tabs } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';
import './compute.css';
import { Split } from './Split';

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
  const t3 = { tone: fill >= 0.9 ? 'ok' : fill >= 0.7 ? 'warn' : 'bad', icon: ICON.supply, v: F.pct(fill), l: <Term id="vendorFill">vendor fill</Term>, sub: <><Term id={s.market.binding === 'hbm' ? 'hbm' : s.market.binding === 'wafer' ? 'wafer' : 'packaging'}>{COMP.find((c) => c.bind === s.market.binding)?.label ?? 'Packaging'}</Term>-bound</> };
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
      {tile({ ...t3 }, 'vendorFill', 'market')}
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
            {l.ev.kind === 'siteLive' ? `${l.ev.name} (${F.power(l.ev.mw)}) ≈ ${qLabel(s, l.q)} ›` : `${evText(l.ev)} ${qLabel(s, l.q)} ›`}
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

function OrderCard({ s }: { s: GameStateV2 }) {
  const [tier, setTier] = useState(2);
  const [kind, setKind] = useState<ChipOrder['kind']>('standard');
  const [years, setYears] = useState(2);
  const [nonTW, setNonTW] = useState(false);
  const [open, setOpen] = useState(false);
  const qty = CHIP_TIERS[tier];
  const kW = s.power.kWPerH100e;
  const id = kind === 'spot' ? 'cmp.orderSpot' : kind === 'lta' ? 'cmp.orderLTA' : 'cmp.orderStandard';
  const params = { qty, nonTW, ...(kind === 'lta' ? { quarters: years * 4 } : {}) };
  const qt = orderQuote(s, kind, qty, nonTW);
  return (
    <Card title={<span className="row-i"><ICON.compute size={14} />Order chips</span>} className="cac" id="ctl-orderChips"
      right={<span className="dim small">{kind === 'lta' ? `per quarter × ${years * 4}q` : 'one batch'}</span>}>
      <div className="cac-tiles c5">
        {CHIP_TIERS.map((h, i) => (
          <OptionTile key={h} label={F.count(h)} glyphs={<span>{F.power((h * kW) / 1000)}</span>} active={tier === i} onClick={() => setTier(i)} testId={`chips-${i}`}
            tip={() => <TipCard title={`${F.count(h)} H100e`} rows={[{ label: <Term id="mw">Racks needed</Term>, value: F.power((h * kW) / 1000) }, { label: 'Price each', value: `$${orderQuote(s, kind, h, nonTW).price.toFixed(1)}K` }]} />} />
        ))}
      </div>
      <div className="cac-pv"><CostPills v={actionView(s, id, params)} /><span className="dim small">arrives {qLabel(s, qt.dueQ)}</span></div>
      {open && (
        <div className="cac-opts">
          <div className="cmp-row"><span className="dim small">Contract</span><Seg value={kind} options={[{ v: 'standard', label: 'Standard', tip: '30% deposit, 2 quarters' }, { v: 'spot', label: 'Spot', tip: 'next quarter, spot price, lowest priority' }, { v: 'lta', label: 'LTA', tip: 'every quarter at 95% of list, take-or-pay' }]} onChange={setKind} /></div>
          {kind === 'lta' && <div className="cmp-row"><span className="dim small"><Term id="lta">LTA</Term> term</span><Seg value={years} options={[1, 2, 3].map((v) => ({ v, label: `${v} yr` }))} onChange={setYears} /></div>}
          <div className="cmp-row"><Toggle on={nonTW} onChange={setNonTW} label={<><Term id="taiwanRisk">Non-Taiwan</Term> supply · +30%</>} /></div>
        </div>
      )}
      <div className="cac-foot">
        <button className="cac-more" onClick={() => setOpen(!open)} data-test="opt-order"><ICON.go size={12} className={open ? 'rot' : ''} /><b>{kind === 'lta' ? 'LTA' : kind === 'spot' ? 'Spot' : 'Standard'}</b>{nonTW ? ' · non-Taiwan' : ' · any fab'}</button>
        <span className="sp" />
        <Gate s={s} k="compute"><ActBtn id={id} params={params} primary label="Order" icon={ICON.compute} /></Gate>
      </div>
    </Card>
  );
}

function BuildCard({ s }: { s: GameStateV2 }) {
  const [tier, setTier] = useState(2);
  const [path, setPath] = useState<Site['path']>('gas');
  const [crash, setCrash] = useState(false);
  const [community, setCommunity] = useState(false);
  const [spv, setSpv] = useState(false);
  const [open, setOpen] = useState(false);
  const max = SITE_PATHS[path].maxMW;
  const fits = (i: number) => SITE_TIERS[i].mw <= max;
  const t = fits(tier) ? tier : SITE_TIERS.reduce((a, x, i) => (x.mw <= max ? i : a), 0);
  const mw = SITE_TIERS[t].mw;
  const kW = s.power.kWPerH100e;
  const params = { path, mw, crash, community, spv };
  const eta = siteEtaQ(s, { path, mw, crash });
  const liveQ = qOf(s) + eta;
  const pickPath = (p: Site['path']) => {
    setPath(p);
    if (SITE_TIERS[tier].mw > SITE_PATHS[p].maxMW) setTier(SITE_TIERS.reduce((a, x, i) => (x.mw <= SITE_PATHS[p].maxMW ? i : a), 0));
  };
  return (
    <Card title={<span className="row-i"><ICON.sites size={14} />Build data centre</span>} className="cac" id="ctl-sites"
      right={<span className="dim small"><b className="num">{F.count(1e6 / kW)}</b> H100e per GW</span>}>
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
      <div className="cac-pv"><CostPills v={actionView(s, 'cmp.newSite', params)} /><span className="dim small">live ≈ {qLabel(s, liveQ)}</span></div>
      {open && (
        <div className="cac-opts">
          <Toggle on={crash} onChange={setCrash} label={<><Term id="crashBuild">Crash build</Term> · 4q, +35%</>} />
          <Toggle on={community} onChange={setCommunity} label={<><Term id="communityPackage">Community deal</Term> · block risk ×0.5</>} />
          <Toggle on={spv} onChange={setSpv} label={<><Term id="spv">SPV</Term> funds 80%</>} />
        </div>
      )}
      <div className="cac-foot">
        <button className="cac-more" onClick={() => setOpen(!open)} data-test="opt-site"><ICON.go size={12} className={open ? 'rot' : ''} /><b>{crash ? 'Crash build' : 'Normal build'}</b>{community ? ' · community deal' : ''}{spv ? ' · SPV' : ''}</button>
        <span className="sp" />
        <Gate s={s} k="compute"><ActBtn id="cmp.newSite" testId={spv ? 'cmp.newSite.spv' : undefined} params={params} primary label="Build" icon={ICON.sites} /></Gate>
      </div>
    </Card>
  );
}

function CloudCard({ s }: { s: GameStateV2 }) {
  const [tier, setTier] = useState(1);
  const [years, setYears] = useState(3);
  const [cancellable, setCancellable] = useState(false);
  const [open, setOpen] = useState(false);
  const h100e = CHIP_TIERS[tier];
  const params = { h100e, years, cancellable };
  return (
    <Card title={<span className="row-i"><ICON.cloud size={14} /><Term id="cloudContract">Rent cloud</Term></span>} className="cac" id="ctl-cloud"
      right={<span className="dim small"><b className="num">${cloudPricePerYear(s).toFixed(1)}K</b> / H100e-yr</span>}>
      <div className="cac-tiles c5">
        {CHIP_TIERS.map((h, i) => <OptionTile key={h} label={F.count(h)} active={tier === i} onClick={() => setTier(i)} testId={`cloud-${i}`} />)}
      </div>
      <div className="cmp-row"><span className="dim small">Term</span><Seg value={years} options={[1, 3, 5].map((v) => ({ v, label: `${v} yr` }))} onChange={setYears} /></div>
      <div className="cac-pv"><CostPills v={actionView(s, 'cmp.cloudContract', params)} /><span className="dim small">online {qLabel(s, qOf(s) + 1)}</span></div>
      {open && (
        <div className="cac-opts">
          <Toggle on={cancellable} onChange={setCancellable} label={<>Cancellable · 1q notice, +15%</>} />
          <span className="row-i small"><span className="dim"><Term id="rental">Spot rental</Term> · one quarter</span><ActBtn id="cmp.spotRental" params={{ h100e }} label={`Rent ${F.count(h100e)}`} /></span>
        </div>
      )}
      <div className="cac-foot">
        <button className="cac-more" onClick={() => setOpen(!open)} data-test="opt-cloud"><ICON.go size={12} className={open ? 'rot' : ''} /><b>{cancellable ? 'Cancellable' : 'Firm'}</b>{cancellable ? ' · 1q notice' : ' · take-or-pay'}</button>
        <span className="sp" />
        <Gate s={s} k="compute"><ActBtn id="cmp.cloudContract" params={params} label="Sign" icon={ICON.cloud} /></Gate>
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
              { label: <Term id="communityPackage">Community deal</Term>, value: x.communityPackage ? 'yes' : 'no' }, { label: <Term id="crashBuild">Crash build</Term>, value: x.crash ? 'yes' : 'no' },
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
              <span className="small stl-st">{x.stage === 'live' ? <span className="tone-pos">live</span> : x.stage === 'blocked' ? <span className="tone-neg">blocked</span> : <><Term id={STAGE_TERM[x.stage] ?? 'site'}>{STAGE_LABEL[x.stage]}</Term> <span className="dim">→ {fmtMonth(dateOf(s, x.stageEndDay))}</span></>}</span>
              <span className="stl-act">
                {x.stage === 'permitting' && odds.block > 0.005 && <Pill kind={odds.block > 0.1 ? 'bad' : 'warn'} title="chance local opposition blocks the site">block {F.pct(odds.block)}</Pill>}
                {x.stage === 'permitting' && !x.communityPackage && <ActBtn id="cmp.communityPackage" params={{ siteId: x.id }} label="Community deal" />}
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
      right={<span className="row-i small"><span className="dim">MW used / cap</span><HBar v={mwUsed} max={Math.max(1, mwCap)} w={110} h={8} color={full ? C.bad : mwUsed > mwCap * 0.95 ? C.watch : C.good} /><b className="num" data-home="mwUsed">{F.power(mwUsed)} / {F.power(mwCap)}</b></span>}>
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
          <span className="num">{F.count(c.h100e)} H100e</span>
          <span className="num">{F.money(c.costPerYear, { perYear: true })}</span>
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
        const bind = m.binding === c.bind;
        return (
          <div className="cmp-bar" key={c.k}>
            <span><Term id={c.term}>{c.label}</Term>{bind && <span className="tag2 warn" style={{ marginLeft: 6 }}>binding</span>}</span>
            <HBar v={m[c.k]} max={kmax} w="100%" h={8} color={bind ? C.watch : '#6b7c91'} />
            <span className={`num ${bind ? 'tone-warn' : ''}`}>{F.count(m[c.k])}</span>
          </div>
        );
      })}
      <KV k="Supply · demand this quarter">{F.count(m.supplyQ)} · {F.count(m.demandQ)} H100e</KV>
      <KV k="Your order weight" term="allocation">{m.ws3.playerWeight.toFixed(2)}</KV>
      <KV k="Export policy" term="exportPolicy">{F.words(m.exportPolicy)}</KV>
      <KV k="Taiwan risk" term="taiwanRisk">{m.geoTW.toFixed(2)}</KV>
      <div className="btn-row" style={{ marginTop: 6 }}><Gate s={s} k="compute"><ActBtn id="cmp.fundSupplier" params={{ amount: 2 }} label="Fund a supplier ($2B)" icon={ICON.raise} /></Gate></div>
    </Card>
  );
}

// ═════════════════════════ panel ═════════════════════════

export function Compute({ s }: { s: GameStateV2 }) {
  const tab = tabOf('compute', 'overview');
  const sitesBadge = chipFit(s).idle > 0 || s.player.sites.some((x) => x.stage === 'permitting' && !x.ws3?.rolled && oppositionOdds(s, x).block > 0.1) ? '!' : undefined;
  return (
    <div className="panel-v2 cmp" data-panel="compute">
      <PanelHead icon={ICON.computePanel} title="Compute" sub="chips, sites and cloud"
        tabs={<Tabs panel="compute" def="overview" tabs={[{ id: 'overview', label: 'Overview', icon: ICON.overview }, { id: 'sites', label: 'Sites', icon: ICON.sites, badge: sitesBadge }, { id: 'split', label: 'Split', icon: ICON.split }, { id: 'orders', label: 'Orders', icon: ICON.compute }, { id: 'market', label: 'Market', icon: ICON.supply }]} />}
        right={<span className="row-i"><Ref id="computeOnline" to={{ panel: 'company', tab: 'flow' }}>Compute online</Ref></span>} />
      {tab === 'overview' && <Overview s={s} />}
      {tab === 'sites' && <SitesTab s={s} />}
      {tab === 'orders' && <div className="g2"><Deliveries s={s} /><Cloud s={s} /></div>}
      {tab === 'market' && <Market s={s} />}
      {tab === 'split' && <Split s={s} />}
    </div>
  );
}
