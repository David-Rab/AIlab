// World › Sectors (model v3 B3; design/V3-BUILD.md "B3 notes"). L1: the region's work strip (workers using AI, hours of
// use, hours saved, paid seats, agent-hours) and the sector heatmap (hours of use, automated share or your share, US /
// CN / ROW). L2: the selected sector's card: adoption in two quantities (firm task adoption A vs workers using AI W and
// hours of use U), the limits F × K × (1 − R) with the binding one, who pays for the hours, and each provider's share,
// coverage and cost of an AI work-hour against the wage. L3: tooltips (work type, survey anchors, formulas).
// One home: the per-(sector, region) customer stock lives here; products show the per-product customers (link).
import { useState, type ReactNode } from 'react';
import { REGIONS, SECTORS, USE_ANCHOR_SRC, USE_ANCHOR_US } from '../../../data/v2/sectors';
import { sectorsView } from '../../../engine/v2';
import type { GameStateV2, RegionId, SectorId, SectorRead } from '../../../engine/v2';
import { Seg, Term, Tip, TipCard } from '../ui';
import { Ref } from '../kit';
import { DOMAIN_ICON } from '../icons';
import { seq } from '../theme';
import * as F from '../fmt';
import './world.css';

type Metric = 'U' | 'A' | 'you';
const METRIC: { v: Metric; label: string; scale: number }[] = [
  { v: 'U', label: 'Hours of use', scale: 0.6 },
  { v: 'A', label: 'Automated', scale: 0.6 },
  { v: 'you', label: 'Your share', scale: 1 },
];
const DOM_LABEL: Record<string, string> = { CODE: 'coding', RSCH: 'research', REASON: 'reasoning', AGENCY: 'agency', SOCIAL: 'social', MEDIA: 'media', CYBER: 'cyber', BIO: 'bio', PHYS: 'physical' };
const BIND_WORD: Record<SectorRead['binding'], string> = { capability: 'capability', cost: 'cost', friction: 'friction', diffusion: 'diffusion' };
/** Who-pays colours: per-hour work gold, seats grey (as on the product card), unseated dim; agent-hours teal. */
const PAY_COL = { adopted: '#c9a227', seated: '#8d99a6', unseated: '#3a4656', agent: '#3bb3a0' } as const;
const usd = (x: number) => `$${x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)}`;
const hrs = (x: number) => `${F.count(x)} h`;
const tokK = (x: number) => `${F.count(x)} tokens`;

export function WorldSectors({ s, names, color, below }: { s: GameStateV2; names: (id: string) => string; color: (id: string) => string; /** B4: the World panel's jobs section, under the heatmap. */ below?: ReactNode }) {
  const v = sectorsView(s);
  const [sel, setSel] = useState<{ sid: SectorId; r: RegionId }>({ sid: 'SOFT', r: 'US' });
  const [metric, setMetric] = useState<Metric>('U');
  const x = v.regions[sel.r].sectors[sel.sid];
  const m = METRIC.find((q) => q.v === metric)!;
  const valOf = (y: SectorRead) => (metric === 'U' ? y.U : metric === 'A' ? y.A : y.player?.share ?? 0);
  return (
    <div className="ws" data-test="world-sectors">
      <WorkStrip s={s} v={v} r={sel.r} onRegion={(r) => setSel({ sid: sel.sid, r })} />
      <div className="ws-grid">
        <div className="ws-left">
        <section className="section ws-heat">
          <div className="section-head">
            <span className="section-title"><Term id="sector">Sectors</Term></span>
            <Seg value={metric} options={METRIC.map((q) => ({ v: q.v, label: q.label }))} onChange={setMetric} testId="ws-metric" />
          </div>
          <table className="tbl heat ws-tbl">
            <thead><tr><th>Sector</th>{REGIONS.map((r) => <th key={r}>{r}</th>)}</tr></thead>
            <tbody>
              {SECTORS.map((sec) => (
                <tr key={sec.id} className={sel.sid === sec.id ? 'on' : ''}>
                  <td className="ws-name">{sec.name}</td>
                  {REGIONS.map((r) => {
                    const y = v.regions[r].sectors[sec.id];
                    const val = valOf(y);
                    return (
                      <td key={r} style={{ background: seq(Math.sqrt(val / m.scale)) }} className={sel.sid === sec.id && sel.r === r ? 'sel' : ''} data-cell={`${sec.id}.${r}`} onClick={() => setSel({ sid: sec.id, r })}>
                        <Tip content={() => <TipCard title={`${sec.name} · ${r}`} rows={[
                          { label: <Term id="hoursOfUse">Hours of use</Term>, value: F.pct(y.U, 1) },
                          { label: <Term id="sectorA">Automated A</Term>, value: F.pct(y.A, 1) },
                          { label: 'Your share', value: y.player ? F.pct(y.player.share) : 'no product' },
                          { label: <Term id="binding">Binding</Term>, value: BIND_WORD[y.binding] },
                        ]} footer="Click for the sector card." />}>
                          <span className="num small heat-v">{F.pct(val)}</span>
                        </Tip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {below}
        </div>
        <SectorCard x={x} names={names} color={color} />
      </div>
    </div>
  );
}

/** L1 strip: the selected region's work use and who pays, with the region switch. */
function WorkStrip({ v, r, onRegion }: { s: GameStateV2; v: ReturnType<typeof sectorsView>; r: RegionId; onRegion: (r: RegionId) => void }) {
  const w = v.regions[r].work;
  const us = r === 'US';
  const anchor = us ? `Survey (${USE_ANCHOR_US.when}): ${F.pct(USE_ANCHOR_US.workers, 1)} of workers, ${F.pct(USE_ANCHOR_US.hours, 1)} of hours, ${USE_ANCHOR_US.savedPerHour.toFixed(2)} h saved per hour. ${USE_ANCHOR_SRC}.` : 'No primary hours survey outside the US: CN and ROW workers are assumed to use AI at 0.6 × the US rate, at the US intensity (design choice).';
  return (
    <div className="ws-strip" data-test="ws-strip">
      <Seg value={r} options={REGIONS.map((q) => ({ v: q, label: q }))} onChange={onRegion} testId="ws-region" />
      <Tip content={() => <TipCard title={<Term id="workersUsingAI">Workers using AI</Term>} value={F.pct(w.workers)} footer={anchor}>{`Share of ${r} workers who use AI at work, all sectors, weighted by employment.`}</TipCard>}>
        <span className="ws-kpi" data-test="ws-workers"><Term id="workersUsingAI">Workers using AI</Term> <b className="num">{F.pct(w.workers)}</b></span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="hoursOfUse">Hours of use</Term>} value={F.pct(w.hours, 1)} footer={anchor}>{'Work-hours with AI as a share of all work-hours: tasks firms handed to AI plus workers\' assisted hours.'}</TipCard>}>
        <span className="ws-kpi" data-test="ws-hours"><Term id="hoursOfUse">Hours of use</Term> <b className="num">{F.pct(w.hours, 1)}</b> <span className="dim">of work-hours</span></span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="savedPerHour">Hours saved per hour</Term>} value={`${w.savedPerHour.toFixed(2)} h`} footer={anchor}>{'Hours of work an hour of use saves, weighted by hours of use. Rises as agents take whole tasks.'}</TipCard>}>
        <span className="ws-kpi" data-test="ws-saved"><Term id="savedPerHour">saves</Term> <b className="num">{w.savedPerHour.toFixed(2)} h</b> <span className="dim">per hour</span></span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="paidSeat">Paid seats</Term>} value={F.count(w.seats)}>{'Workers on a paid business plan in this region, all providers. The other workers\' hours are [[unseatedUse|unseated]] or billed per hour.'}</TipCard>}>
        <span className="ws-kpi" data-test="ws-seats"><Term id="paidSeat">Paid seats</Term> <b className="num">{F.count(w.seats)}</b></span>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="agentHour">Agent-hours</Term>} value={`${F.count(w.agentHours)} h/yr`}>{'Autonomous AI work-hours a year in this region, not tied to a person\'s hour: [[supervisingHour|supervising hours]] × coverage × [[agentLeverage|agent leverage]].'}</TipCard>}>
        <span className="ws-kpi" data-test="ws-agents"><Term id="agentHour">Agent-hours</Term> <b className="num">{F.count(w.agentHours)}</b><span className="dim">/yr</span></span>
      </Tip>
    </div>
  );
}

/** L2: one sector in one region. */
function SectorCard({ x, names, color }: { x: SectorRead; names: (id: string) => string; color: (id: string) => string }) {
  const wk = x.work;
  const bind = x.binding;
  const lim = [
    { k: 'capability', term: 'feasibility', label: 'F', v: x.F },
    { k: 'cost', term: 'costGate', label: 'K', v: x.K },
    { k: 'friction', term: 'friction', label: '1 − R', v: 1 - x.R },
  ] as const;
  const h = x.hours;
  const pay = [
    { k: 'adopted' as const, v: h.adopted, term: 'adoptedHour', label: 'per hour' },
    { k: 'seated' as const, v: h.seated, term: 'paidSeat', label: 'seats' },
    { k: 'unseated' as const, v: h.unseated, term: 'unseatedUse', label: 'unseated' },
  ];
  const kSup = h.supervising > 0 ? h.agent / h.supervising : 0;
  const costMax = Math.max(x.wage, ...x.providers.map((p) => p.buyerCost)) * 1.08;
  const gap = wk.bestFit - wk.theta;
  return (
    <section className="section ws-card" data-test="ws-card" data-sector={x.sid} data-region={x.r}>
      <div className="ws-hd">
        <span className="ws-ttl">{x.name} · {x.r}</span>
        <Tip content={() => <TipCard title={<Term id="workType">Work type</Term>} rows={[
          ...wk.weights.map(([d, w]) => ({ label: DOM_LABEL[d] ?? d, value: F.pct(w) })),
          ...(wk.physW > 0 ? [{ label: 'Physical share (robot-bound)', value: F.pct(wk.physW) }] : []),
          { label: 'Typical task length', value: `${wk.H} h` },
          { label: <Term id="verifiability">Verifiability</Term>, value: wk.v.toFixed(1) },
          { label: <><Term id="timeHorizon">Horizon</Term> read on</>, value: DOM_LABEL[wk.horizon] ?? wk.horizon },
          { label: <Term id="medianExpert">Median professional θ</Term>, value: `${wk.theta.toFixed(1)} OOM` },
          { label: <>Best offer's <Term id="fit">fit</Term></>, value: `${wk.bestFit.toFixed(1)} OOM (${gap >= 0 ? '+' : '−'}${Math.abs(gap).toFixed(1)})`, tone: gap >= 0 ? 'pos' : 'neutral' },
          { label: 'Tokens per adopted task-hour', value: tokK(wk.tokAdopted) },
          { label: 'Tokens per assisted hour', value: tokK(wk.tokAssisted) },
          { label: <Term id="agentHour">Tokens per agent-hour</Term>, value: tokK(wk.tokAgent) },
        ]} footer={`Domain weights of the cognitive work (physical part apart). Adopted task-hours mix agent and assisted tokens by the substituted share α ${F.pct(wk.alpha)}.`} />}>
          <span className="ws-wt" data-test="ws-worktype">
            {wk.weights.slice(0, 3).map(([d]) => { const I = DOMAIN_ICON[d]; return I ? <I key={d} size={12} /> : null; })}
            <span className="ws-wt-l">tasks</span> <span className="num">{wk.H} h</span> · <span className="ws-wt-l">verifiable</span> <span className="num">{wk.v.toFixed(1)}</span>
          </span>
        </Tip>
        <span className="sp" />
        <Tip content={() => <TipCard title={<Term id="binding">Binding limit</Term>} value={BIND_WORD[bind]}>{bind === 'diffusion'
          ? `Buyers are still catching up: automated A ${F.pct(x.A, 1)} is below 80% of its ceiling A* ${F.pct(x.Astar, 1)}. Adoption grows on its own, faster with agency.`
          : `The smallest of F, K and 1 − R holds the ceiling A* down: ${bind === 'capability' ? 'better coverage of this work type' : bind === 'cost' ? 'a cheaper AI work-hour (price or review)' : 'lower friction (certification, policy)'} raises it.`}</TipCard>}>
          <span className={`ws-bind b-${bind}`} data-test="ws-binding"><Term id="binding">binding</Term> <span className="ws-bind-v">{BIND_WORD[bind]}</span></span>
        </Tip>
      </div>

      <div className="ws-sub">Adoption</div>
      <AdoptRow test="ws-W" label={<Term id="workersUsingAI">Workers using AI</Term>} v={x.W} mark={x.Wstar} text={F.pct(x.W)} tip={() => <TipCard title={<Term id="workersUsingAI">Workers using AI</Term>} value={F.pct(x.W, 1)} rows={[
        { label: 'Target (base users + covered work)', value: F.pct(x.Wstar, 1) },
        { label: <Term id="firmAdoption">Firms using AI</Term>, value: F.pct(x.firms) },
      ]}>{'A different quantity from automation: most workers who use AI keep the task.'}</TipCard>} />
      <AdoptRow test="ws-U" label={<Term id="hoursOfUse">Hours of use</Term>} v={x.U} anchor={x.anchor?.hours} text={`${F.pct(x.U, 1)} of hours`} tip={() => <TipCard title={<Term id="hoursOfUse">Hours of use</Term>} value={F.pct(x.U, 1)} rows={[
        { label: 'Automated tasks A', value: F.pct(x.A, 1) },
        { label: `+ h ${F.pct(x.h)} × (W − A)`, value: F.pct(x.U - x.A, 1) },
        ...(x.anchor ? [{ label: `Survey: ${x.anchor.group}, ${x.anchor.when}`, value: `${F.pct(x.anchor.hours, 1)}${x.anchor.saved ? ` · saved ${F.pct(x.anchor.saved, 1)}` : ''}` }] : []),
      ]} footer={x.anchor ? `Diamond = survey value. ${USE_ANCHOR_SRC}${x.anchor.tag === 'R' ? ' (2026 industry rows via FRED excerpts)' : ''}.` : x.r === 'US' ? 'No industry row in the worker survey for this sector.' : 'No hours survey outside the US.'}>{'Share of the sector\'s work-hours spent with AI.'}</TipCard>} />
      <AdoptRow test="ws-A" label={<Term id="sectorA">Automated A</Term>} v={x.A} mark={x.Astar} text={`${F.pct(x.A, 1)} → ${F.pct(x.Astar, 1)}`} tip={() => <TipCard title={<Term id="sectorA">Automated share A</Term>} value={F.pct(x.A, 1)} rows={[
        { label: 'Ceiling A* = F × K × (1 − R)', value: F.pct(x.Astar, 1) },
        { label: <Term id="firmAdoption">Firms using AI</Term>, value: F.pct(x.firms) },
      ]}>{'Tasks firms have handed to AI. It diffuses toward the ceiling (white tick).'}</TipCard>} />
      <Tip as="div" content={() => <TipCard title={<Term id="savedPerHour">Hours saved per hour of use</Term>} value={`${x.savedPerHour.toFixed(2)} h`} rows={[
        { label: 'Substituted share of adopted tasks α', value: F.pct(wk.alpha) },
        { label: 'Saved per assisted hour', value: '0.30 h' },
        ...(x.r === 'US' ? [{ label: `Survey, all US (${USE_ANCHOR_US.when})`, value: `${USE_ANCHOR_US.savedPerHour.toFixed(2)} h` }] : []),
      ]} footer={USE_ANCHOR_SRC}>{`An hour of use is worth the wage (${usd(x.wage)}/h) × this.`}</TipCard>}>
        <div className="ws-line" data-test="ws-saved-sector"><Term id="savedPerHour">Saves</Term> <b className="num">{x.savedPerHour.toFixed(2)} h</b> per hour of use · wage <b className="num">{usd(x.wage)}</b>/h</div>
      </Tip>

      <div className="ws-sub">Limits <span className="dim">A* = F × K × (1 − R)</span></div>
      <div className="ws-lims">
        {lim.map((l) => (
          <Tip as="div" key={l.k} content={() => <LimitTip x={x} k={l.k} names={names} />}>
            <div className={`ws-lim ${bind === l.k ? 'bind' : ''}`} data-test={`ws-lim-${l.k}`}>
              <span className="ws-lim-k"><Term id={l.term}>{l.label}</Term> <span className="dim">{l.k}</span></span>
              <span className="ws-lim-v num">{F.pct(l.v)}</span>
              <span className="ws-bar"><i style={{ width: `${Math.max(0, Math.min(1, l.v)) * 100}%`, background: bind === l.k ? '#e9b44c' : '#22a394' }} /></span>
            </div>
          </Tip>
        ))}
      </div>

      <div className="ws-sub">Who pays <span className="dim">hours of use a year</span></div>
      <Tip as="div" content={() => <TipCard title="Hours of use by who pays" value={`${hrs(h.use)}/yr`} rows={[
        { label: <Term id="adoptedHour">Adopted task-hours (per hour)</Term>, value: `${hrs(h.adopted)} · ${F.money(x.spend.adopted, { perYear: true })}` },
        { label: <Term id="paidSeat">Seated hours (by the seat)</Term>, value: `${hrs(h.seated)} · ${F.money(x.spend.seat, { perYear: true })}` },
        { label: <Term id="unseatedUse">Unseated (free, bundled, in-house)</Term>, value: `${hrs(h.unseated)} · unbilled` },
        { label: <Term id="agentHour">Agent-hours (per hour)</Term>, value: `${hrs(h.agent)} · ${F.money(x.spend.agent, { perYear: true })}` },
        { label: <Term id="supervisingHour">Supervising hours</Term>, value: hrs(h.supervising) },
      ]} footer="Spend is demand, all providers, before any serving cut.">{'Agent-hours add spend and serving need, never human hours.'}</TipCard>}>
        <div className="ws-pay" data-test="ws-pay">
          <span className="ws-bar wide">
            {pay.filter((p) => p.v > 0).map((p) => <i key={p.k} data-pay={p.k} style={{ width: `${(p.v / Math.max(1, h.use)) * 100}%`, background: PAY_COL[p.k] }} />)}
          </span>
          <div className="ws-leg">
            {pay.map((p) => <span key={p.k}><i style={{ background: PAY_COL[p.k] }} /><Term id={p.term}>{p.label}</Term> {F.pct(h.use > 0 ? p.v / h.use : 0)}</span>)}
            <span><i style={{ background: PAY_COL.agent }} /><Term id="agentHour">agents</Term> +{F.count(h.agent)} h <span className="dim">(<Term id="agentLeverage">×{kSup.toFixed(2)}</Term> per supervising h)</span></span>
          </div>
        </div>
      </Tip>
      <AdoptRow test="ws-seat" label={<Term id="seatShare">Paid seat share</Term>} v={x.seat} mark={x.seatTarget} text={`${F.pct(x.seat)} → ${F.pct(x.seatTarget)}`} tip={() => <TipCard title={<Term id="seatShare">Paid seat share</Term>} value={F.pct(x.seat, 1)} rows={[
        { label: 'Target', value: F.pct(x.seatTarget, 1) },
        { label: 'Seats sold', value: F.count(x.seats) },
        { label: 'Going seat price', value: `${usd(x.seatPrice)}/mo` },
      ]}>{'Share of the workers using AI on a paid plan; grows ≈ ×2 a half-year toward the target (white tick).'}</TipCard>} />

      <div className="ws-sub">Providers <span className="dim"><Term id="aiWorkHourCost">cost of an AI work-hour</Term> vs wage</span><span className="sp" /><Ref id="customerStock" to={{ panel: 'products' }}>your products</Ref></div>
      <div className="ws-prov" data-test="ws-providers">
        {x.providers.map((p) => {
          const hf = p.price / Math.max(1e-9, p.buyerCost - p.review);
          const pr = p.buyerCost - p.review;
          const you = p.key === 'player';
          return (
            <Tip as="div" key={p.key} content={() => <TipCard title={`${names(p.key)}${p.open ? ' (open weights)' : ''}`} rows={[
              { label: <Term id="customerStock">Customer share</Term>, value: `${F.pct(p.share, 1)} → ${F.pct(p.target, 1)}`, tone: p.target > p.share + 0.005 ? 'pos' : p.target < p.share - 0.005 ? 'neg' : 'neutral' },
              { label: <Term id="coverage">Coverage</Term>, value: F.pct(p.cover) },
              { label: <Term id="fit">Fit</Term>, value: `${p.fit.toFixed(1)} OOM (θ ${wk.theta.toFixed(1)})` },
              { label: <Term id="adoptedHour">Price per adopted task-hour</Term>, value: usd(p.price) },
              { label: `÷ hours saved per adopted hour (${hf.toFixed(2)})`, value: usd(pr) },
              { label: '+ review of uncovered work', value: usd(p.review) },
              { label: <Term id="aiWorkHourCost">Cost of an AI work-hour</Term>, value: `${usd(p.buyerCost)} vs wage ${usd(x.wage)}` },
              { label: <Term id="costGate">Cost gate</Term>, value: F.pct(p.gate) },
              { label: <Term id="agentHour">Agent-hours per supervising hour</Term>, value: `${p.agentK.toFixed(2)} at ${usd(p.agentPrice)}/h` },
              { label: <Term id="paidSeat">Seat price</Term>, value: p.seatPrice > 0 ? `${usd(p.seatPrice)}/mo` : 'no seats (in-house)' },
            ]} footer={you ? 'Your products, one by one: Products.' : p.key === 'player:open' ? undefined : 'Rivals\' and China\'s serving cost is estimated from their capability (no design data yet).'} />}>
              <div className={`ws-pr ${you ? 'you' : ''}`} data-provider={p.key}>
                <span className="ws-pr-n"><i style={{ background: color(p.key) }} />{you ? 'You' : names(p.key)}{p.open && <span className="dim"> open</span>}</span>
                <span className="ws-pr-s num">{F.pct(p.share)} <span className={p.target > p.share + 0.005 ? 'tone-pos' : p.target < p.share - 0.005 ? 'tone-neg' : 'dim'}>→ {F.pct(p.target)}</span></span>
                <span className="ws-pr-c num">{F.pct(p.cover)}</span>
                <span className="ws-bar cost">
                  <i style={{ width: `${(pr / costMax) * 100}%`, background: color(p.key) }} />
                  <i className="rev" style={{ width: `${(p.review / costMax) * 100}%` }} />
                  <em style={{ left: `${(x.wage / costMax) * 100}%` }} />
                </span>
                <span className="ws-pr-v num">{usd(p.buyerCost)}</span>
              </div>
            </Tip>
          );
        })}
        {!x.providers.length && <div className="dim small">No provider serves this sector here.</div>}
        <div className="ws-pr-leg dim small"><span>share → target</span><span>coverage</span><span>price ÷ hours saved · <i className="rev-sw" /> review · <em className="wage-sw" /> wage {usd(x.wage)}</span></div>
      </div>
    </section>
  );
}

function AdoptRow({ test, label, v, mark, anchor, text, tip }: { test: string; label: ReactNode; v: number; mark?: number; anchor?: number; text: string; tip: () => ReactNode }) {
  return (
    <Tip as="div" content={tip}>
      <div className="ws-row" data-test={test}>
        <span className="ws-k">{label}</span>
        <span className="ws-bar">
          <i style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} />
          {mark !== undefined && <em style={{ left: `${Math.max(0, Math.min(1, mark)) * 100}%` }} />}
          {anchor !== undefined && <b className="ws-anchor" style={{ left: `${Math.max(0, Math.min(1, anchor)) * 100}%` }} />}
        </span>
        <span className="ws-v num">{text}</span>
      </div>
    </Tip>
  );
}

function LimitTip({ x, k, names }: { x: SectorRead; k: 'capability' | 'cost' | 'friction'; names: (id: string) => string }) {
  const top = x.providers.slice(0, 4);
  if (k === 'capability') return (
    <TipCard title={<Term id="feasibility">Feasibility F</Term>} value={F.pct(x.F)} rows={[
      { label: <>Cognitive work: share-weighted <Term id="coverage">coverage</Term></>, value: F.pct(x.Fcog) },
      ...(x.work.physW > 0 ? [{ label: `Physical work (${F.pct(x.work.physW)}), robot-bound`, value: F.pct(x.Fphys) }] : []),
      ...top.map((p) => ({ label: `${names(p.key)} (share ${F.pct(p.share)})`, value: F.pct(p.cover) })),
    ]}>{'What the models this sector uses can do on its own, by their customer share.'}</TipCard>
  );
  if (k === 'cost') return (
    <TipCard title={<Term id="costGate">Cost gate K</Term>} value={F.pct(x.K)} rows={[
      { label: <Term id="aiWorkHourCost">Cost of an AI work-hour (mix)</Term>, value: usd(x.buyerCost) },
      { label: 'Wage', value: usd(x.wage) },
      ...top.map((p) => ({ label: `${names(p.key)}: ${usd(p.buyerCost)}`, value: F.pct(p.gate) })),
    ]}>{'σ(ln(wage ÷ cost of an AI work-hour) / 0.7), by provider share: 50% at cost = wage.'}</TipCard>
  );
  return (
    <TipCard title={<Term id="friction">Friction R</Term>} value={F.pct(x.R)} rows={[{ label: '1 − R', value: F.pct(1 - x.R) }]}>
      {'Licensing, bans, unions and incidents in this sector and region. (Certifying a sector adaptation lets only that product in; it does not change friction.)'}
    </TipCard>
  );
}
