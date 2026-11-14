// Deploy (IA.md L2): HOME of revenue per channel and demand vs capacity, deployments (price, KYC, safeguards), serving
// shares and the distillation leak. Revenue run-rate lives in Finance; the compute split in Company › Split.
import { useState } from 'react';
import { SECTORS } from '../../../data/v2/sectors';
import { CHANNEL_VARIANTS, deployGate, distillationAccess, revenueReadout, versionById } from '../../../engine/v2';
import type { Channel, GameStateV2 } from '../../../engine/v2';
import { ActBtn, Seg, Term, Tip, TipCard } from '../ui';
import { Card, GoBtn, HBar, PanelHead, Pill, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';
import './deploy.css';

const CHANNELS: { id: Channel; label: string; blurb: string }[] = [
  { id: 'consumer', label: 'Consumer', blurb: 'Chat app for the public. Large demand, low price per user.' },
  { id: 'api', label: 'API', blurb: 'Developers pay per token. Highest distillation exposure.' },
  { id: 'agents', label: 'Agents', blurb: 'Autonomous agents sold as drop-in workers.' },
  { id: 'enterprise', label: 'Enterprise', blurb: 'Contracts with firms; sticky, low leak.' },
  { id: 'gov', label: 'Government', blurb: 'Government and defence contracts.' },
  { id: 'trusted', label: 'Trusted access', blurb: 'Vetted partners only; almost no leak.' },
  { id: 'internal', label: 'Internal', blurb: 'Your own research agents; uses the agents pool.' },
  { id: 'open', label: 'Open weights', blurb: 'Publish the weights. Anyone can copy them: no revenue, full leak.' },
];
const CH_LABEL = Object.fromEntries(CHANNELS.map((c) => [c.id, c.label])) as Record<Channel, string>;
const LEAK: Partial<Record<Channel, number>> = { consumer: 0.3, api: 1, agents: 0.5, enterprise: 0.2, trusted: 0.05, open: 1 };
const BOUND: Record<string, { label: string; tone: 'bad' | 'warn' | 'good' | 'neu' }> = {
  capacity: { label: 'capacity-bound', tone: 'bad' }, demand: { label: 'demand-bound', tone: 'good' }, price: { label: 'price-bound', tone: 'warn' }, quality: { label: 'quality-bound', tone: 'warn' },
};

export function Deployments({ s }: { s: GameStateV2 }) {
  const rd = revenueReadout(s);
  const vs = s.player.models.versions.filter((v) => v.status === 'ready' || v.status === 'deployed');
  const [vid, setVid] = useState(vs[vs.length - 1]?.id ?? '');
  const [ch, setCh] = useState<Channel>('api');
  const [price, setPrice] = useState(1);
  const [kyc, setKyc] = useState(1);
  const [effort, setEffort] = useState<'low' | 'max' | 'deep'>('max');
  const [serve, setServe] = useState(0.2);
  const [shares, setShares] = useState<Record<string, number>>({});
  const [sector, setSector] = useState(SECTORS[0].id);
  const v = versionById(s, vid);
  const gate = v ? deployGate(s, v, ch) : 'Pick a version';
  const deps = s.player.deployments.filter((d) => d.status !== 'withdrawn');
  const cnDA = distillationAccess(s, 'china');
  const scale = Math.max(1e-6, ...rd.deps.map((r) => Math.max(r.demand, r.capacity, r.revenue)));
  const capped = rd.deps.filter((r) => r.bound === 'capacity');
  const unmet = capped.reduce((a, r) => a + Math.max(0, r.demand - r.capacity), 0);
  return (
    <div className="panel-v2 dep" data-panel="deployments">
      <PanelHead icon={ICON.deploy} title="Deploy" sub="your models in use: who buys, how much you can serve"
        right={<span className="row-i"><Ref id="revenueRun" to={{ panel: 'finance' }}>Revenue run-rate</Ref><Ref id="split" to={{ panel: 'company', tab: 'split', anchor: 'split-serving' }}>Compute split</Ref></span>} />

      <Card title="Demand vs capacity" sub="per channel, $ per year · bar = what buyers would pay, fill = what you can serve" home="channelRevenue"
        right={<span className="row-i">
          {capped.length > 0 && <span className="tag2 bad">{capped.length} of {rd.deps.length} capacity-bound · {F.money(unmet, { perYear: true })} unmet</span>}
          {capped.length > 0 && <GoBtn to={{ panel: 'company', tab: 'split', anchor: 'split-serving' }} label="More serving" testId="dep.go.split" />}
          <ActBtn id="setServing" testId="setServing.rebalance" label="Rebalance serving by demand" icon={ICON.split} />
        </span>}>
        <div className="dcap-head">
          <span>Channel</span><span>Demand · capacity</span><span className="r">Revenue</span><span><Term id="servingShare">Serving share</Term></span><span><Term id="distillLeak">Leak</Term></span><span />
        </div>
        {deps.map((d) => {
          const r = rd.deps.find((x) => x.id === d.id);
          const inc = s.player.safety.incidents.filter((i) => i.deploymentId === d.id && i.status !== 'resolved').length;
          const leak = (LEAK[d.channel] ?? 0) * cnDA * (1 - 0.25 * d.kyc);
          const sh = shares[d.id] ?? d.servingShare;
          const dirty = Math.abs(sh - d.servingShare) > 0.001;
          const others = s.player.models.versions.filter((x) => x.id !== d.versionId && (x.status === 'ready' || x.status === 'deployed') && CHANNEL_VARIANTS[d.channel].includes(x.variant));
          const ver = versionById(s, d.versionId);
          const b = BOUND[r?.bound ?? d.demandBound ?? ''] ;
          const servable = d.channel !== 'internal' && d.channel !== 'open';
          return (
            <div className="dcap-row" key={d.id} data-deployment={d.id}>
              <Tip content={() => <TipCard title={`${CH_LABEL[d.channel]} · ${ver?.name ?? d.versionId}`} rows={[
                { label: <Term id="priceIndex">Price index</Term>, value: F.mult(d.priceIndex) }, { label: <Term id="effort">Effort</Term>, value: d.effort },
                { label: <Term id="safeguards">Safeguards</Term>, value: `${d.safeguards}${d.controlLayer ? ' + control' : ''}` }, { label: <Term id="kyc">KYC</Term>, value: d.kyc },
                { label: 'Open incidents', value: inc, tone: inc ? 'neg' : 'neutral' },
              ]}>{CHANNELS.find((c) => c.id === d.channel)?.blurb}</TipCard>}>
                <span className="dcap-ch"><b><Term id="channel">{CH_LABEL[d.channel]}</Term></b><span className="dim small">{ver?.name ?? d.versionId} · {F.mult(d.priceIndex)}{inc ? <span className="tone-neg"> · {inc} incident{inc > 1 ? 's' : ''}</span> : null}</span></span>
              </Tip>
              <Tip content={() => <TipCard title="Demand vs capacity" value={b?.label ?? '—'} rows={r ? [{ label: 'Demand', value: F.money(r.demand, { perYear: true }) }, { label: 'Capacity', value: F.money(r.capacity, { perYear: true }) }, { label: 'Revenue', value: F.money(r.revenue, { perYear: true }) }, { label: 'Serving chips', value: `${F.count(r.servingH100e)} H100e` }] : []}>{r?.bound === 'capacity' ? 'Buyers want more than your serving chips can deliver. Raise the serving share or the serving pool in the compute split.' : 'Revenue is the smaller of demand and capacity.'}</TipCard>}>
                <span className="dcap-bars">
                  {r ? (
                    <>
                      <span className="dcap-track">
                        <i className="dcap-dem" style={{ width: `${(r.demand / scale) * 100}%` }} />
                        <i className="dcap-cap" style={{ width: `${(r.capacity / scale) * 100}%`, background: r.bound === 'capacity' ? C.watch : '#6b7c91' }} />
                      </span>
                      <span className="dcap-tags">{b && <span className={`tag2 ${b.tone}`}><Term id={r.bound === 'capacity' ? 'capacityBound' : 'demandBound'}>{b.label}</Term></span>}<span className="dim small">demand <span className="num">{F.money(r.demand)}</span> · capacity <span className="num">{F.money(r.capacity)}</span></span></span>
                    </>
                  ) : <span className="dim small">no revenue channel</span>}
                </span>
              </Tip>
              <span className="num r" data-home={`revenue.${d.id}`}>{r ? F.money(r.revenue, { perYear: true }) : '—'}</span>
              <span className="dcap-serve">
                {servable && <input className="slider" type="range" min={0} max={0.8} step={0.01} value={sh} onChange={(e) => setShares({ ...shares, [d.id]: Number(e.target.value) })} />}
                {servable ? <b className="num">{F.pct(sh)}</b> : <span className="dim small">uses the agents pool</span>}
                {servable && <ActBtn id="setServing" testId={`setServing.${d.id}`} params={{ deploymentId: d.id, share: sh }} label={dirty ? 'Apply' : 'Set'} primary={dirty} />}
              </span>
              <Tip content={() => <TipCard title={<Term id="distillLeak">Distillation leak</Term>} value={F.pct(leak)}>{`How much of this model China can learn by querying it: channel exposure × China [[distill|distillation]] access × (1 − 0.25 × [[kyc|KYC]] ${d.kyc}).`}</TipCard>}>
                <span className="dcap-leak"><HBar v={leak} max={1} w={54} h={6} color={leak > 0.3 ? C.bad : C.watch} /><span className="num small">{F.pct(leak)}</span></span>
              </Tip>
              <span className="dcap-act">
                {others[0] && <ActBtn id="swapDeployment" params={{ deploymentId: d.id, versionId: others[others.length - 1].id }} label={`Swap to ${others[others.length - 1].name}`} />}
                {servable && <ActBtn id="withdraw" params={{ deploymentId: d.id }} label="Withdraw" />}
              </span>
            </div>
          );
        })}
        {!deps.length && <div className="dim small">Nothing deployed yet. Start a deployment below.</div>}
      </Card>

      <div className="dep-lower">
        <Card title="New deployment" id="ctl-deploy">
          <div className="dep-row">
            <span className="dim small"><Term id="version">Version</Term></span>
            <select className="text-input" data-test="dep-version" value={vid} onChange={(e) => setVid(e.target.value)}>{vs.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.variant}</option>)}</select>
          </div>
          <div className="tip-cap"><Term id="channel">Channel</Term></div>
          <div className="ch-tiles">
            {CHANNELS.map((c) => {
              const g = v ? deployGate(s, v, c.id) : 'Pick a version';
              return (
                <Tip key={c.id} content={() => <TipCard title={c.label} value={g === true ? 'available' : undefined}>{`${c.blurb}${g === true ? '' : ` Blocked: ${g}`}`}</TipCard>}>
                  <button className={`otile ${ch === c.id ? 'on' : ''} ${g === true ? '' : 'dimmed'}`} data-channel-opt={c.id} onClick={() => setCh(c.id)}>
                    <span className="otile-top">{c.label}</span>
                    <span className="otile-gl">leak {LEAK[c.id] !== undefined ? F.pct(LEAK[c.id]!) : '—'}</span>
                  </button>
                </Tip>
              );
            })}
          </div>
          <div className="dep-row">
            <span className="dim small"><Term id="priceIndex">Price</Term> <b className="num">{F.mult(price)}</b></span>
            <input className="slider" type="range" min={0.5} max={2} step={0.05} value={price} onChange={(e) => setPrice(Number(e.target.value))} style={{ width: 130 }} />
            <span className="dim small"><Term id="servingShare">Serving share</Term> <b className="num">{F.pct(serve)}</b></span>
            <input className="slider" type="range" min={0.02} max={0.6} step={0.01} value={serve} onChange={(e) => setServe(Number(e.target.value))} style={{ width: 130 }} />
          </div>
          <div className="dep-row">
            <span className="dim small"><Term id="effort">Effort</Term></span>
            <Seg value={effort} options={[{ v: 'low', label: 'low' }, { v: 'max', label: 'max' }, { v: 'deep', label: 'deep' }]} onChange={setEffort} />
            <span className="dim small"><Term id="kyc">KYC</Term></span>
            <Seg value={kyc} options={[0, 1, 2, 3].map((k) => ({ v: k, label: String(k) }))} onChange={setKyc} />
          </div>
          <div className="btn-row">
            <ActBtn id="deploy" params={{ versionId: vid, channel: ch, priceIndex: price, effort, kyc, servingShare: serve }} primary block={gate === true ? undefined : gate} icon={ICON.deploy} label={`Deploy to ${CH_LABEL[ch]}`} reason />
          </div>
        </Card>
        <Card title={<Term id="sectorProduct">Sector products</Term>} sub="and usage policy">
          <div className="dep-row">
            <select className="text-input" data-test="sector-pick" value={sector} onChange={(e) => setSector(e.target.value as typeof sector)}>{SECTORS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <ActBtn id="wfx.sectorProduct" params={{ sector, ...(deps[0] ? { deploymentId: deps[0].id } : {}) }} label="Launch sector product" />
          </div>
          <div className="dep-row">
            <span className="dim small"><Term id="usagePolicy">Usage policy</Term> (live)</span>
            <span className="pills">{deps.flatMap((d) => Object.entries(d.usagePolicy).filter(([, x]) => x).map(([k]) => k)).filter((x, i, a) => a.indexOf(x) === i).map((k) => <Pill key={k}>{F.words(k)}</Pill>)}</span>
            {!deps.some((d) => Object.values(d.usagePolicy).some(Boolean)) && <span className="dim small">none</span>}
          </div>
          <div className="btn-row"><ActBtn id="F3" label="Pledge: no drop-in agents" /></div>
        </Card>
      </div>
    </div>
  );
}
