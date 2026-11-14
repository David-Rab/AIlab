// Compute (IA.md L2): HOME of the chip market (supply, prices, allocation, export policy), orders pipeline, cloud
// contracts, and sites & power (stage, MW, ETA, risk; MW used/cap; grid and transformers). Compute online and idle
// chips live in Company › Flow and are only referenced here.
import { useState, type ReactNode } from 'react';
import { cloudPricePerYear, dateOf, dayOfQuarter, fmtDate, fmtMonth, oppositionOdds, orderQuote, qOf, spotPrice } from '../../../engine/v2';
import type { ChipOrder, GameStateV2, Site } from '../../../engine/v2';
import { store } from '../store';
import { ActBtn, Gate, Seg, Term, Tip, TipCard, Toggle } from '../ui';
import { Card, HBar, KV, PanelHead, Pill, Ref, Spark2 } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';
import './compute.css';

const PATHS: { id: Site['path']; label: string; note: string }[] = [
  { id: 'lease', label: 'Lease', note: 'fastest, someone else builds' }, { id: 'brownfield', label: 'Brownfield', note: 'existing industrial site' },
  { id: 'gas', label: 'Gas', note: 'on-site turbines' }, { id: 'grid', label: 'Grid', note: 'queue for the grid pool' }, { id: 'nuclear', label: 'Nuclear', note: 'slow, large, clean' },
];
const STAGE_COLOR: Record<Site['stage'], string> = { permitting: '#8a9bb0', power: C.watch, building: C.you, live: C.good, blocked: C.bad };
const STAGE_TERM: Partial<Record<Site['stage'], string>> = { permitting: 'permitting', power: 'gridPool', building: 'capex' };
const KIND_COLOR: Record<ChipOrder['kind'], string> = { spot: C.watch, standard: '#8a9bb0', lta: C.you };
const COMP: { k: 'Kpkg' | 'Khbm' | 'Kwafer'; bind: string; label: string; term: string }[] = [
  { k: 'Kpkg', bind: 'packaging', label: 'Packaging', term: 'packaging' }, { k: 'Khbm', bind: 'hbm', label: 'HBM', term: 'hbm' }, { k: 'Kwafer', bind: 'wafer', label: 'Wafer', term: 'wafer' },
];
const qLabel = (s: GameStateV2, q: number) => {
  const d = dateOf(s, dayOfQuarter(s.time.startDate, q));
  return `Q${Math.floor(d.getUTCMonth() / 3) + 1} ${String(d.getUTCFullYear()).slice(2)}`;
};

// ───────── sites as a build timeline ─────────
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
            <TipCard title={x.name} value={x.stage} rows={[
              { label: <Term id="sitePath">Path</Term>, value: `${x.path} · ${x.region}` }, { label: <Term id="mw">Capacity</Term>, value: F.power(x.mw) },
              { label: 'Stage ends', value: x.stage === 'live' ? '—' : fmtDate(dateOf(s, x.stageEndDay)) }, { label: 'Live ≈', value: x.stage === 'blocked' ? 'blocked' : fmtMonth(dateOf(s, live)) },
              { label: 'Block / delay risk', value: `${F.pct(odds.block)} / ${F.pct(odds.delay)}`, tone: odds.block > 0.1 ? 'neg' : 'neutral' },
              { label: <Term id="capex">Capex paid</Term>, value: `${F.money(x.capexPaid)} / ${F.money(x.capex)}` }, { label: 'Chips installed', value: `${F.count(x.installed)} H100e` },
              { label: <Term id="communityPackage">Community package</Term>, value: x.communityPackage ? 'yes' : 'no' }, { label: <Term id="crashBuild">Crash build</Term>, value: x.crash ? 'yes' : 'no' },
            ]} />
          )}>
            <div className="stl-row" data-site={x.id}>
              <span className="stl-name"><span className="dot" style={{ background: STAGE_COLOR[x.stage] }} /><span className="ellip">{x.name}</span><span className="dim small">{x.path}</span></span>
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
              <span className="small stl-st">{x.stage === 'live' ? <span className="tone-pos">live</span> : x.stage === 'blocked' ? <span className="tone-neg">blocked</span> : <><Term id={STAGE_TERM[x.stage] ?? 'site'}>{x.stage}</Term> <span className="dim">→ {fmtMonth(dateOf(s, x.stageEndDay))}</span></>}</span>
              <span className="stl-act">
                {x.stage === 'permitting' && odds.block > 0.005 && <Pill kind={odds.block > 0.1 ? 'bad' : 'warn'} title="chance local opposition blocks the site">block {F.pct(odds.block)}</Pill>}
                {x.stage === 'permitting' && !x.communityPackage && <ActBtn id="cmp.communityPackage" params={{ siteId: x.id }} label="Community package" />}
              </span>
            </div>
          </Tip>
        );
      })}
      {!sites.length && <div className="dim small">No sites yet.</div>}
      <div className="stl-leg legend2">
        {(['permitting', 'power', 'building', 'live', 'blocked'] as const).map((st) => <span key={st}><i style={{ background: STAGE_COLOR[st] }} />{st}</span>)}
        <span><i className="hatch" />planned build</span>
      </div>
    </div>
  );
}

function SitesPower({ s }: { s: GameStateV2 }) {
  const [path, setPath] = useState<Site['path']>('brownfield');
  const [mw, setMw] = useState(1000);
  const [crash, setCrash] = useState(false);
  const [community, setCommunity] = useState(false);
  const kW = s.power.kWPerH100e;
  const live = s.player.sites.filter((x) => x.stage === 'live');
  const mwCap = live.reduce((a, x) => a + x.mw, 0);
  const mwUsed = live.reduce((a, x) => a + (x.installed * kW) / 1000, 0);
  const pw = s.power.ws3;
  return (
    <Card title={<Term id="site">Sites & power</Term>} id="ctl-sites" className="cmp-sites"
      right={<span className="row-i small"><span className="dim">MW used / cap</span><HBar v={mwUsed} max={Math.max(1, mwCap)} w={110} h={8} color={mwUsed > mwCap * 0.95 ? C.watch : C.good} /><b className="num" data-home="mwUsed">{F.power(mwUsed)} / {F.power(mwCap)}</b></span>}>
      <SiteTimeline s={s} />
      <div className="cmp-power">
        <KV k="Grid pool left" term="gridPool">{F.power(pw.poolLeftGW * 1000)}</KV>
        <KV k="Spare transformers" term="transformers">{F.power(pw.transformersGW * 1000)}</KV>
        <KV k="Transformer lead time" term="transformers">{s.power.transformerLeadQ}q</KV>
        <KV k="kW per H100e" term="kwPerH100e">{kW.toFixed(2)}</KV>
        <ActBtn id="cmp.preorderTransformers" params={{ gw: 2 }} label="Pre-order 2 GW transformers" icon={ICON.power} />
      </div>
      <Gate s={s} k="compute">
        <div className="cmp-new">
          <div className="tip-cap">New site</div>
          <div className="cmp-row">
            <span className="dim small"><Term id="sitePath">Path</Term></span>
            <Seg value={path} options={PATHS.map((p) => ({ v: p.id, label: p.label, tip: p.note }))} onChange={setPath} />
          </div>
          <div className="cmp-row">
            <span className="dim small"><Term id="mw">Size</Term> <b className="num">{F.power(mw)}</b></span>
            <input className="slider" type="range" min={100} max={5000} step={100} value={mw} onChange={(e) => setMw(Number(e.target.value))} style={{ width: 180 }} />
            <span className="dim small">≈ {F.count((mw * 1000) / kW)} H100e</span>
            <Toggle on={crash} onChange={setCrash} label={<Term id="crashBuild">Crash build</Term>} />
            <Toggle on={community} onChange={setCommunity} label={<Term id="communityPackage">Community package</Term>} />
          </div>
          <div className="btn-row">
            <ActBtn id="cmp.newSite" params={{ path, mw, crash, community }} primary icon={ICON.sites} label="Start site" reason />
            <ActBtn id="cmp.newSite" testId="cmp.newSite.spv" params={{ path, mw, crash, community, spv: true }} label={<>Start with <Term id="spv">SPV</Term></>} />
          </div>
        </div>
      </Gate>
    </Card>
  );
}

// ───────── chip market ─────────
function Market({ s }: { s: GameStateV2 }) {
  const m = s.market;
  const kmax = Math.max(m.Kpkg, m.Khbm, m.Kwafer, 1);
  const fill = m.ws3.playerFill;
  return (
    <Card title="Chip market" sub="global, per quarter" home="chipMarket">
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
      <Tip as="div" content={() => <TipCard title={<Term id="allocation">Your allocation</Term>} rows={[{ label: 'Fill share last quarter', value: F.pct(fill) }, { label: 'Order weight', value: m.ws3.playerWeight.toFixed(2) }]}>When supply is short, vendors ration. Weights favour LTAs, prepayment and long relationships.</TipCard>}>
        <div className="cmp-bar">
          <span><Term id="allocation">Your allocation</Term></span>
          <HBar v={fill} max={1} w="100%" h={8} color={fill < 0.9 ? C.bad : C.good} />
          <span className={`num ${fill < 0.9 ? 'tone-neg' : ''}`}>{F.pct(fill)}</span>
        </div>
      </Tip>
      <KV k="Export policy" term="exportPolicy">{F.words(m.exportPolicy)}</KV>
      <KV k="Taiwan risk" term="taiwanRisk">{m.geoTW.toFixed(2)}</KV>
      <div className="btn-row" style={{ marginTop: 6 }}><ActBtn id="cmp.fundSupplier" params={{ amount: 2 }} label="Fund a supplier ($2B)" icon={ICON.raise} /></div>
    </Card>
  );
}

function PriceSpark({ label, data, value, color }: { label: ReactNode; data?: number[]; value: string; color: string }) {
  return (
    <div className="px">
      <span className="dim small">{label}</span>
      <b className="num">{value}</b>
      {data && data.length > 1 && <Spark2 data={data} w={80} h={20} color={color} />}
    </div>
  );
}
// ───────── order chips (with price sparks) ─────────
function Order({ s }: { s: GameStateV2 }) {
  const m = s.market;
  const [qty, setQty] = useState(0.5);
  const [quarters, setQuarters] = useState(8);
  const [nonTW, setNonTW] = useState(false);
  const [cloudH, setCloudH] = useState(0.5);
  const hist = store.hist;
  const n = qty * 1e6;
  const q0 = qOf(s);
  const rows: { kind: ChipOrder['kind']; id: string; label: string; term: string; params: Record<string, number | boolean> }[] = [
    { kind: 'spot', id: 'cmp.orderSpot', label: 'Spot', term: 'spotPrice', params: { qty: n, nonTW } },
    { kind: 'standard', id: 'cmp.orderStandard', label: 'Standard', term: 'listPrice', params: { qty: n, nonTW } },
    { kind: 'lta', id: 'cmp.orderLTA', label: 'LTA', term: 'lta', params: { qty: n, nonTW, quarters } },
  ];
  return (
    <Card title="Order chips" home="chipPrices">
      <div className="px-row">
        <PriceSpark label={<Term id="listPrice">List</Term>} data={hist.list} value={`$${m.listPrice.toFixed(1)}K`} color="#c9d4e2" />
        <PriceSpark label={<Term id="spotPrice">Spot</Term>} data={hist.spot} value={`$${spotPrice(m).toFixed(1)}K`} color={C.watch} />
        <PriceSpark label={<Term id="rental">Rental</Term>} data={hist.rental} value={`$${m.rental.toFixed(2)}/h`} color={C.you} />
      </div>
      <Gate s={s} k="compute">
        <div className="cmp-row">
          <span className="dim small">Quantity <b className="num">{F.count(n)}</b> H100e</span>
          <input className="slider" type="range" min={0.05} max={5} step={0.05} value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ width: 160 }} />
          <Toggle on={nonTW} onChange={setNonTW} label="Non-Taiwan supply" />
        </div>
        <div className="ord-opts">
          {rows.map((r) => {
            const qt = orderQuote(s, r.kind, n, nonTW);
            return (
              <div className="ord-opt" key={r.id}>
                <span className="row-i"><i className="dot" style={{ background: KIND_COLOR[r.kind] }} /><Term id={r.term}>{r.label}</Term></span>
                <span className="num small">${qt.price.toFixed(1)}K</span>
                <span className="num small">{F.money(qt.now + qt.later)}</span>
                <span className="dim small">arrives {qLabel(s, qt.dueQ)}{qt.dueQ - q0 > 0 ? ` (+${qt.dueQ - q0}q)` : ''}</span>
                <ActBtn id={r.id} params={r.params} primary={r.kind === 'standard'} label="Order" icon={ICON.compute} />
              </div>
            );
          })}
          <div className="cmp-row small"><span className="dim"><Term id="lta">LTA</Term> length <b className="num">{quarters}q</b></span><input className="slider" type="range" min={4} max={16} step={1} value={quarters} onChange={(e) => setQuarters(Number(e.target.value))} style={{ width: 120 }} /></div>
        </div>
        <div className="tip-cap" style={{ marginTop: 8 }}>Rent instead</div>
        <div className="cmp-row">
          <span className="dim small"><Term id="cloudContract">Cloud</Term> <b className="num">{F.count(cloudH * 1e6)}</b> H100e · 3 yr · ${cloudPricePerYear(s).toFixed(1)}K per H100e-yr</span>
          <input className="slider" type="range" min={0.1} max={3} step={0.1} value={cloudH} onChange={(e) => setCloudH(Number(e.target.value))} style={{ width: 120 }} />
        </div>
        <div className="btn-row">
          <ActBtn id="cmp.cloudContract" params={{ h100e: cloudH * 1e6, years: 3 }} label="Sign cloud contract" icon={ICON.cloud} />
          <ActBtn id="cmp.spotRental" params={{ h100e: 0.2e6 }} label="Rent 200K spot" />
        </div>
      </Gate>
    </Card>
  );
}

// ───────── orders as a delivery timeline ─────────
function Deliveries({ s }: { s: GameStateV2 }) {
  const q0 = qOf(s);
  const open = s.player.orders.filter((o) => o.qty > o.delivered);
  const last = Math.max(q0 + 7, ...open.map((o) => o.dueQ));
  const qs = Array.from({ length: Math.min(12, last - q0 + 1) }, (_, i) => q0 + i);
  const byQ = qs.map((q) => {
    const os = open.filter((o) => Math.max(q0, o.dueQ) === q);
    return { q, os, tot: os.reduce((a, o) => a + o.qty - o.delivered, 0) };
  });
  const max = Math.max(1, ...byQ.map((b) => b.tot));
  return (
    <Card title="Deliveries" sub="open chip orders by quarter due" home="orders"
      right={<span className="legend2">{(['spot', 'standard', 'lta'] as const).map((k) => <span key={k}><i style={{ background: KIND_COLOR[k] }} />{k === 'lta' ? 'LTA' : k}</span>)}</span>}>
      {open.length > 0 && <div className="dlv">
        {byQ.map((b) => (
          <Tip as="div" key={b.q} content={() => <TipCard title={qLabel(s, b.q)} value={`${F.count(b.tot)} H100e`} rows={b.os.map((o) => ({ label: `${o.kind}${o.nonTW ? ' · non-TW' : ''} · $${o.price.toFixed(1)}K`, value: `${F.count(o.delivered)} / ${F.count(o.qty)}` }))}>{b.os.length ? 'Undelivered chips due this quarter (delivered / ordered).' : 'Nothing due.'}</TipCard>}>
            <div className="dlv-col">
              <span className="num dlv-v">{b.tot > 0 ? F.count(b.tot) : ''}</span>
              <span className="dlv-bar">
                {b.os.map((o) => <i key={o.id} style={{ height: `${((o.qty - o.delivered) / max) * 100}%`, background: KIND_COLOR[o.kind] }} />)}
              </span>
              <span className="dlv-q">{b.q === q0 ? qLabel(s, b.q) : `+${b.q - q0}q`}</span>
            </div>
          </Tip>
        ))}
      </div>}
      {!open.length && <div className="dim small">No chips on order.</div>}
      <div className="dim small" style={{ marginTop: 6 }}>Delivered chips need powered sites: see <Ref id="idleChips" to={{ panel: 'company', tab: 'flow' }}>idle chips</Ref></div>
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

export function Compute({ s }: { s: GameStateV2 }) {
  return (
    <div className="panel-v2 cmp" data-panel="compute">
      <PanelHead icon={ICON.computePanel} title="Compute" sub="chips, orders, sites and power"
        right={<span className="row-i"><Ref id="computeOnline" to={{ panel: 'company', tab: 'flow' }}>Compute online</Ref><Ref id="idleChips" to={{ panel: 'company', tab: 'flow' }}>Idle chips</Ref></span>} />
      <div className="cmp-top">
        <SitesPower s={s} />
        <div className="cmp-side">
          <Market s={s} />
          <Cloud s={s} />
        </div>
      </div>
      <div className="g2">
        <Order s={s} />
        <Deliveries s={s} />
      </div>
    </div>
  );
}
