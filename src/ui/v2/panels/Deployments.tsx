// Deployments (§6.3, in Models): live deployments with channel, version, price, serving share, revenue, binding,
// incidents and distillation leak; new deployment, swap, serving capacity (`setServing`), sector product, withdraw.
import { useState } from 'react';
import { SECTORS } from '../../../data/v2/sectors';
import { CHANNEL_VARIANTS, deployGate, distillationAccess, revenueReadout, versionById } from '../../../engine/v2';
import type { Channel, GameStateV2 } from '../../../engine/v2';
import { ActBtn, fmtB, Meter, pct, Row, Section, Seg, Slider, Term, Tip, TipCard } from '../ui';

const CHANNELS: Channel[] = ['consumer', 'api', 'agents', 'enterprise', 'gov', 'trusted', 'internal', 'open'];
const LEAK: Partial<Record<Channel, number>> = { consumer: 0.3, api: 1, agents: 0.5, enterprise: 0.2, trusted: 0.05, open: 1 };

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
  return (
    <div className="panel-v2" data-panel="deployments">
      <Section title="Live deployments" right={<span className="num">{fmtB(rd.total)}/yr · demand {fmtB(rd.demand)} · cap {fmtB(rd.capacity)}</span>}>
        <table className="tbl">
          <thead><tr><th>Channel</th><th>Version</th><th>Price</th><th>Serving</th><th>Revenue</th><th>Binding</th><th>Incidents</th><th>Leak</th><th /></tr></thead>
          <tbody>
            {deps.map((d) => {
              const r = rd.deps.find((x) => x.id === d.id);
              const inc = s.player.safety.incidents.filter((i) => i.deploymentId === d.id && i.status !== 'resolved').length;
              const leak = (LEAK[d.channel] ?? 0) * cnDA * (1 - 0.25 * d.kyc);
              const sh = shares[d.id] ?? d.servingShare;
              const others = s.player.models.versions.filter((x) => x.id !== d.versionId && (x.status === 'ready' || x.status === 'deployed') && CHANNEL_VARIANTS[d.channel].includes(x.variant));
              return (
                <tr key={d.id} data-deployment={d.id}>
                  <td>{d.channel}<div className="dim small">{d.safeguards}{d.controlLayer ? ' · control' : ''}</div></td>
                  <td>{versionById(s, d.versionId)?.name ?? d.versionId}</td>
                  <td className="num">{d.priceIndex.toFixed(2)}×</td>
                  <td>
                    <Slider value={sh} min={0} max={0.8} step={0.01} onChange={(x) => setShares({ ...shares, [d.id]: x })} width={70} />
                    <span className="num small"> {pct(sh)}</span>
                    {d.channel !== 'internal' && d.channel !== 'open' && <ActBtn id="setServing" testId={`setServing.${d.id}`} params={{ deploymentId: d.id, share: sh }} label="Set" inline={false} />}
                  </td>
                  <td className="num">{fmtB(r?.revenue ?? d.revenueRate ?? 0)}</td>
                  <td><Tip content={() => <TipCard title="Binding" value={r?.bound ?? d.demandBound ?? '—'} rows={r ? [{ label: 'Demand', value: fmtB(r.demand) }, { label: 'Capacity', value: fmtB(r.capacity) }, { label: 'Serving H100e', value: Math.round(r.servingH100e).toLocaleString() }] : []} />}><span className={r?.bound === 'capacity' ? 'tone-warn' : ''}>{r?.bound ?? d.demandBound ?? '—'}</span></Tip></td>
                  <td className={inc ? 'tone-neg' : 'dim'}>{inc}</td>
                  <td><Tip content={() => <TipCard title="Distillation leak" value={pct(leak)}>{`Channel coefficient × China [[distill|distillation]] access × (1 − 0.25 × [[kyc|KYC]] ${d.kyc}).`}</TipCard>}><Meter value={leak} max={1} width={50} color="var(--warn)" /></Tip></td>
                  <td className="btn-cell">
                    {others[0] && <ActBtn id="swapDeployment" params={{ deploymentId: d.id, versionId: others[others.length - 1].id }} label="Swap" inline={false} />}
                    <ActBtn id="withdraw" params={{ deploymentId: d.id }} inline={false} />
                  </td>
                </tr>
              );
            })}
            {!deps.length && <tr><td colSpan={9} className="dim">Nothing deployed</td></tr>}
          </tbody>
        </table>
        <div className="btn-row"><ActBtn id="setServing" testId="setServing.rebalance" label="Rebalance serving by demand" /></div>
      </Section>
      <div className="grid2">
        <Section title="New deployment">
          <Row label="Version"><select className="text-input" data-test="dep-version" value={vid} onChange={(e) => setVid(e.target.value)}>{vs.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.variant}</option>)}</select></Row>
          <Row label="Channel"><Seg value={ch} options={CHANNELS.map((c) => ({ v: c, label: c }))} onChange={setCh} /></Row>
          <Row label={`Price ${price.toFixed(2)}×`}><Slider value={price} min={0.5} max={2} step={0.05} onChange={setPrice} /></Row>
          <Row label="Effort"><Seg value={effort} options={[{ v: 'low', label: 'low' }, { v: 'max', label: 'max' }, { v: 'deep', label: 'deep' }]} onChange={setEffort} /></Row>
          <Row label={<Term id="kyc">KYC</Term>}><Seg value={kyc} options={[0, 1, 2, 3].map((k) => ({ v: k, label: String(k) }))} onChange={setKyc} /></Row>
          <Row label={`Serving share ${pct(serve)}`}><Slider value={serve} min={0.02} max={0.6} step={0.01} onChange={setServe} /></Row>
          <Row label="Gate"><span className={gate === true ? 'tone-pos small' : 'tone-neg small'}>{gate === true ? 'ok' : gate}</span></Row>
          <div className="btn-row"><ActBtn id="deploy" params={{ versionId: vid, channel: ch, priceIndex: price, effort, kyc, servingShare: serve }} primary /></div>
        </Section>
        <Section title="Sector products · policy">
          <Row label="Sector"><select className="text-input" data-test="sector-pick" value={sector} onChange={(e) => setSector(e.target.value as typeof sector)}>{SECTORS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Row>
          <div className="btn-row"><ActBtn id="wfx.sectorProduct" params={{ sector, ...(deps[0] ? { deploymentId: deps[0].id } : {}) }} /></div>
          <Row label="Usage policy (live)"><span className="small dim">{deps.flatMap((d) => Object.entries(d.usagePolicy).filter(([, x]) => x).map(([k]) => k)).filter((x, i, a) => a.indexOf(x) === i).join(', ') || 'none'}</span></Row>
          <div className="btn-row"><ActBtn id="F3" /></div>
        </Section>
      </div>
    </div>
  );
}
