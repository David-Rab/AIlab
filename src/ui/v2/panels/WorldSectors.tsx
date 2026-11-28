// World › Work: the sector table (hours of use, automated share or your share, US / China / rest) and the selected sector's card:
// the three adoption numbers (workers using AI, hours of use, work done by AI), the limits F × K × (1 − R) with the binding
// one, and a link to Finance › Story for the providers and your share. L3: tooltips (work type, survey anchors, formulas).
import { useState, type ReactNode } from 'react';
import { REGIONS, SECTORS, USE_ANCHOR_SRC } from '../../../data/v2/sectors';
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
const usd = (x: number) => `$${x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)}`;
const tokK = (x: number) => `${F.count(x)} tokens`;

const REGION_LABEL: Record<RegionId, string> = { US: 'US', CN: 'China', ROW: 'Rest' };

/** The sector table (left) and the selected sector's card (right). The page puts the jobs card and the chart under the card. */
export function WorldSectors({ s, names, right }: { s: GameStateV2; names: (id: string) => string; right?: ReactNode }) {
  const v = sectorsView(s);
  const [sel, setSel] = useState<{ sid: SectorId; r: RegionId }>({ sid: 'SOFT', r: 'US' });
  const [metric, setMetric] = useState<Metric>('U');
  const x = v.regions[sel.r].sectors[sel.sid];
  const m = METRIC.find((q) => q.v === metric)!;
  const valOf = (y: SectorRead) => (metric === 'U' ? y.U : metric === 'A' ? y.A : y.player?.share ?? 0);
  return (
    <div className="ws" data-test="world-sectors">
      <div className="ws-grid">
        <section className="section ws-heat">
          <div className="section-head">
            <span className="section-title"><Term id="sector">Sectors</Term></span>
            <Seg value={metric} options={METRIC.map((q) => ({ v: q.v, label: q.label }))} onChange={setMetric} testId="ws-metric" />
          </div>
          <table className="tbl heat ws-tbl">
            <thead><tr><th>Sector</th>{REGIONS.map((r) => <th key={r}>{REGION_LABEL[r]}</th>)}</tr></thead>
            <tbody>
              {SECTORS.map((sec) => (
                <tr key={sec.id} className={sel.sid === sec.id ? 'on' : ''}>
                  <td className="ws-name">{sec.name}</td>
                  {REGIONS.map((r) => {
                    const y = v.regions[r].sectors[sec.id];
                    const val = valOf(y);
                    return (
                      <td key={r} style={{ background: seq(Math.sqrt(val / m.scale)) }} className={sel.sid === sec.id && sel.r === r ? 'sel' : ''} data-cell={`${sec.id}.${r}`} onClick={() => setSel({ sid: sec.id, r })}>
                        <Tip content={() => <TipCard title={`${sec.name} · ${REGION_LABEL[r]}`} rows={[
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
        <div className="ws-right">
          <SectorCard x={x} names={names} />
          {right}
        </div>
      </div>
    </div>
  );
}

/** L2: one sector in one region. */
function SectorCard({ x, names }: { x: SectorRead; names: (id: string) => string }) {
  const wk = x.work;
  const bind = x.binding;
  const lim = [
    { k: 'capability', term: 'feasibility', label: 'F', v: x.F },
    { k: 'cost', term: 'costGate', label: 'K', v: x.K },
    { k: 'friction', term: 'friction', label: '1 − R', v: 1 - x.R },
  ] as const;
  const gap = wk.bestFit - wk.theta;
  return (
    <section className="section ws-card" data-test="ws-card" data-sector={x.sid} data-region={x.r}>
      <div className="ws-hd">
        <span className="ws-ttl">{x.name} · {REGION_LABEL[x.r]}</span>
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

      <AdoptRow test="ws-W" label={<Term id="workersUsingAI">Workers using AI</Term>} v={x.W} mark={x.Wstar} text={F.pct(x.W)} tip={() => <TipCard title={<Term id="workersUsingAI">Workers using AI</Term>} value={F.pct(x.W, 1)} rows={[
        { label: 'Target (base users + covered work)', value: F.pct(x.Wstar, 1) },
        { label: <Term id="firmAdoption">Firms using AI</Term>, value: F.pct(x.firms) },
      ]}>{'A different quantity from automation: most workers who use AI keep the task.'}</TipCard>} />
      <AdoptRow test="ws-U" label={<Term id="hoursOfUse">Hours of use</Term>} v={x.U} anchor={x.anchor?.hours} text={`${F.pct(x.U, 1)} of hours`} tip={() => <TipCard title={<Term id="hoursOfUse">Hours of use</Term>} value={F.pct(x.U, 1)} rows={[
        { label: 'Automated tasks A', value: F.pct(x.A, 1) },
        { label: <Term id="savedPerHour">Hours saved per hour of use</Term>, value: `${x.savedPerHour.toFixed(2)} h` },
        { label: `+ h ${F.pct(x.h)} × (W − A)`, value: F.pct(x.U - x.A, 1) },
        ...(x.anchor ? [{ label: `Survey: ${x.anchor.group}, ${x.anchor.when}`, value: `${F.pct(x.anchor.hours, 1)}${x.anchor.saved ? ` · saved ${F.pct(x.anchor.saved, 1)}` : ''}` }] : []),
      ]} footer={x.anchor ? `Diamond = survey value. ${USE_ANCHOR_SRC}${x.anchor.tag === 'R' ? ' (2026 industry rows via FRED excerpts)' : ''}.` : x.r === 'US' ? 'No industry row in the worker survey for this sector.' : 'No hours survey outside the US.'}>{'Share of the sector\'s work-hours spent with AI.'}</TipCard>} />
      <AdoptRow test="ws-A" label={<Term id="sectorA">Work done by AI</Term>} v={x.A} mark={x.Astar} text={`${F.pct(x.A, 1)} → ${F.pct(x.Astar, 1)}`} tip={() => <TipCard title={<Term id="sectorA">Automated share A</Term>} value={F.pct(x.A, 1)} rows={[
        { label: 'Ceiling A* = F × K × (1 − R)', value: F.pct(x.Astar, 1) },
        { label: <Term id="firmAdoption">Firms using AI</Term>, value: F.pct(x.firms) },
      ]}>{'Tasks firms have handed to AI. It diffuses toward the ceiling (white tick).'}</TipCard>} />
      <div className="ws-limrow">
        <Tip content={() => <TipCard title={<Term id="binding">Limits</Term>}>{'The ceiling on automation is A* = F × K × (1 − R). The smallest limit binds.'}</TipCard>}><span className="ws-limk">Limits</span></Tip>
        {lim.map((l) => (
          <Tip key={l.k} content={() => <LimitTip x={x} k={l.k} names={names} />}>
            <span className={`ws-chip ${bind === l.k ? 'bind' : ''}`} data-test={`ws-lim-${l.k}`}><Term id={l.term}>{l.k}</Term> <span className="num">{F.pct(l.v)}</span></span>
          </Tip>
        ))}
        <span className="sp" />
        <Ref id="customerStock" to={{ panel: 'finance', tab: 'story' }}>Providers · your share</Ref>
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
      {'Licensing, bans, unions and incidents in this sector and region. (A product certified here, through a harness, lowers friction for its own buyers only.)'}
    </TipCard>
  );
}
