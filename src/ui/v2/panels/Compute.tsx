// Compute & Power (§6.3): global supply and its binding component, list/spot sparks, allocation weight, orders
// pipeline, sites (stage, path, ETA, block risk), MW free vs inventory; order / fund / cloud / site actions.
import { useState } from 'react';
import { cloudPricePerYear, dateOf, fmtDate, idleChips, oppositionOdds, ownedOnline, qOf, rentedOnline, spotPrice } from '../../../engine/v2';
import type { GameStateV2, Site } from '../../../engine/v2';
import { store } from '../store';
import { ActBtn, fmtB, fmtNum, Gate, Meter, pct, Row, Section, Seg, Slider, Spark, Stack, Tip, TipCard, Toggle } from '../ui';

const PATHS: Site['path'][] = ['lease', 'brownfield', 'gas', 'grid', 'nuclear'];
const STAGE_COLOR: Record<Site['stage'], string> = { permitting: 'var(--text-3)', power: 'var(--warn)', building: 'var(--accent)', live: 'var(--pos)', blocked: 'var(--neg)' };

export function Compute({ s }: { s: GameStateV2 }) {
  const m = s.market;
  const [qty, setQty] = useState(0.5);
  const [quarters, setQuarters] = useState(8);
  const [nonTW, setNonTW] = useState(false);
  const [path, setPath] = useState<Site['path']>('brownfield');
  const [mw, setMw] = useState(1000);
  const [crash, setCrash] = useState(false);
  const [community, setCommunity] = useState(false);
  const [cloudH, setCloudH] = useState(0.5);
  const kW = s.power.kWPerH100e;
  const live = s.player.sites.filter((x) => x.stage === 'live');
  const mwCap = live.reduce((a, x) => a + x.mw, 0);
  const mwUsed = live.reduce((a, x) => a + (x.installed * kW) / 1000, 0);
  const idle = idleChips(s);
  const q = qOf(s);
  const hist = store.hist;
  return (
    <div className="panel-v2 grid2" data-panel="compute">
      <Section title="Global chip supply" right={<span className="small">binding: <b className="tone-warn">{m.binding}</b></span>}>
        {(['Kpkg', 'Khbm', 'Kwafer'] as const).map((k) => (
          <Row key={k} label={{ Kpkg: 'Packaging', Khbm: 'HBM', Kwafer: 'Wafer' }[k]}>
            <Meter value={m[k]} max={Math.max(m.Kpkg, m.Khbm, m.Kwafer)} width={140} color={{ packaging: 'Kpkg', hbm: 'Khbm', wafer: 'Kwafer' }[m.binding] === k ? 'var(--warn)' : 'var(--accent)'} />
            <span className="num">{fmtNum(m[k])}/q</span>
          </Row>
        ))}
        <Row label="Supply / demand this q"><span className="num">{fmtNum(m.supplyQ)} / {fmtNum(m.demandQ)}</span></Row>
        <Row label="List · spot $K/H100e"><Spark data={hist.list ?? [m.listPrice]} w={70} h={18} /><Spark data={hist.spot ?? [spotPrice(m)]} color="var(--warn)" w={70} h={18} /><span className="num">{m.listPrice.toFixed(1)} · {spotPrice(m).toFixed(1)}</span></Row>
        <Row label="Rental $/h · cloud $/yr"><span className="num">{m.rental.toFixed(2)} · {(cloudPricePerYear(s) * 1000).toFixed(0)}</span></Row>
        <Tip as="div" content={() => <TipCard title="Your allocation" rows={[{ label: 'Fill share last quarter', value: pct(m.ws3.playerFill) }, { label: 'Order weight', value: m.ws3.playerWeight.toFixed(2) }]}>Rationing weights favour LTAs, prepayment and long relationships.</TipCard>}>
          <Row label="Your allocation"><Meter value={m.ws3.playerFill} max={1} width={100} color={m.ws3.playerFill < 0.9 ? 'var(--neg)' : 'var(--pos)'} /><span className="num">{pct(m.ws3.playerFill)} · w {m.ws3.playerWeight.toFixed(2)}</span></Row>
        </Tip>
        <Row label="Export policy · Taiwan"><span>{m.exportPolicy} · geo {m.geoTW.toFixed(2)}</span></Row>
      </Section>

      <Section title="Power · inventory" right={<span className={`num ${idle > 0 ? 'tone-neg' : ''}`}>{idle > 0 ? `${fmtNum(idle)} idle: no power` : 'no idle chips'}</span>}>
        <Row label="Online (owned · rented)"><span className="num">{fmtNum(ownedOnline(s))} · {fmtNum(rentedOnline(s))}</span></Row>
        <Row label="Live MW used / cap"><Meter value={mwUsed} max={Math.max(1, mwCap)} width={120} /><span className="num">{Math.round(mwUsed)} / {Math.round(mwCap)} MW</span></Row>
        <Row label="Inventory transit · ready"><span className="num">{fmtNum(s.player.finance.ws3.inventory.transit)} · {fmtNum(s.player.finance.ws3.inventory.ready)}</span></Row>
        <Row label="Grid pool left · transformers"><span className="num">{s.power.ws3.poolLeftGW.toFixed(2)} GW · {s.power.ws3.transformersGW.toFixed(1)} GW</span></Row>
        <Row label="kW / H100e · lead"><span className="num">{kW.toFixed(2)} · {s.power.transformerLeadQ}q</span></Row>
        <div className="btn-row"><ActBtn id="cmp.preorderTransformers" params={{ gw: 2 }} /><ActBtn id="cmp.fundSupplier" params={{ amount: 2 }} /></div>
      </Section>

      <Section title="Order chips">
        <Gate s={s} k="compute">
          <Row label={`Qty ${fmtNum(qty * 1e6)} H100e`}><Slider value={qty} min={0.05} max={5} step={0.05} onChange={setQty} /></Row>
          <Row label={`LTA quarters ${quarters}`}><Slider value={quarters} min={4} max={16} step={1} onChange={setQuarters} /></Row>
          <Row label="Non-Taiwan supply"><Toggle on={nonTW} onChange={setNonTW} /></Row>
          <div className="btn-row">
            <ActBtn id="cmp.orderSpot" params={{ qty: qty * 1e6, nonTW }} />
            <ActBtn id="cmp.orderStandard" params={{ qty: qty * 1e6, nonTW }} primary />
            <ActBtn id="cmp.orderLTA" params={{ qty: qty * 1e6, nonTW, quarters }} />
          </div>
          <Row label={`Cloud ${fmtNum(cloudH * 1e6)} H100e`}><Slider value={cloudH} min={0.1} max={3} step={0.1} onChange={setCloudH} /></Row>
          <div className="btn-row"><ActBtn id="cmp.cloudContract" params={{ h100e: cloudH * 1e6, years: 3 }} /><ActBtn id="cmp.spotRental" params={{ h100e: 0.2e6 }} /></div>
        </Gate>
      </Section>

      <Section title="Orders pipeline" right={<span className="dim small">{s.player.orders.length} open</span>}>
        <table className="tbl">
          <thead><tr><th>Kind</th><th>Qty</th><th>$K</th><th>Due</th><th>Delivered</th></tr></thead>
          <tbody>
            {s.player.orders.slice(0, 12).map((o) => (
              <tr key={o.id}><td>{o.kind}{o.nonTW ? ' · nonTW' : ''}</td><td className="num">{fmtNum(o.qty)}</td><td className="num">{o.price.toFixed(1)}</td><td className="num">{o.dueQ - q >= 0 ? `+${o.dueQ - q}q` : 'due'}</td><td><Meter value={o.delivered} max={o.qty} width={60} /></td></tr>
            ))}
          </tbody>
        </table>
        {s.player.cloud.map((c) => <Row key={c.id} label={`Cloud · ${c.provider}`}><span className="num">{fmtNum(c.h100e)} · {fmtB(c.costPerYear)}/yr · to {fmtDate(dateOf(s, c.endDay))}</span></Row>)}
      </Section>

      <Section title="Sites" right={<span className="dim small">{s.player.sites.length}</span>}>
        <div className="sites">
          {s.player.sites.map((x) => {
            const odds = oppositionOdds(s, x);
            return (
              <Tip as="div" key={x.id} content={() => (
                <TipCard title={x.name} value={x.stage} rows={[
                  { label: 'Path · region', value: `${x.path} · ${x.region}` }, { label: 'MW', value: x.mw },
                  { label: 'Stage ends', value: fmtDate(dateOf(s, x.stageEndDay)) }, { label: 'Block / delay risk', value: `${pct(odds.block)} / ${pct(odds.delay)}`, tone: odds.block > 0.1 ? 'neg' : 'neutral' },
                  { label: 'Capex paid', value: `${fmtB(x.capexPaid)} / ${fmtB(x.capex)}` }, { label: 'Installed', value: fmtNum(x.installed) },
                  { label: 'Community package', value: x.communityPackage ? 'yes' : 'no' }, { label: 'Crash build', value: x.crash ? 'yes' : 'no' },
                ]} />
              )}>
                <div className="site">
                  <span className="dot" style={{ background: STAGE_COLOR[x.stage] }} />
                  <span className="ellip">{x.name}</span>
                  <span className="dim small">{x.path}</span>
                  <span className="num small">{x.mw} MW</span>
                  <span className="small">{x.stage === 'live' ? 'live' : `${x.stage} → ${fmtDate(dateOf(s, x.stageEndDay))}`}</span>
                  {x.stage === 'permitting' && !x.communityPackage && <ActBtn id="cmp.communityPackage" params={{ siteId: x.id }} label="Community" inline={false} />}
                </div>
              </Tip>
            );
          })}
        </div>
        <Stack parts={(['permitting', 'power', 'building', 'live', 'blocked'] as const).map((st) => ({ v: s.player.sites.filter((x) => x.stage === st).reduce((a, x) => a + x.mw, 0), color: STAGE_COLOR[st], label: st }))} />
      </Section>

      <Section title="New site">
        <Gate s={s} k="compute">
          <Row label="Path"><Seg value={path} options={PATHS.map((p) => ({ v: p, label: p }))} onChange={setPath} /></Row>
          <Row label={`MW ${mw}`}><Slider value={mw} min={100} max={5000} step={100} onChange={setMw} /></Row>
          <Row label="Crash build (4q, +35%)"><Toggle on={crash} onChange={setCrash} /></Row>
          <Row label="Community package"><Toggle on={community} onChange={setCommunity} /></Row>
          <div className="btn-row"><ActBtn id="cmp.newSite" params={{ path, mw, crash, community }} primary /><ActBtn id="cmp.newSite" testId="cmp.newSite.spv" params={{ path, mw, crash, community, spv: true }} label="New site (SPV)" /></div>
        </Gate>
      </Section>
    </div>
  );
}
