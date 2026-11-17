// Risk (IA.md L2): Sources · Flows. Sources is the HOME of risk per source, its band, drivers and levers (estimates
// from beliefs, intel and exposure; never truth). The combined catastrophe-risk headline lives in the top strip and is
// not repeated here. Flows is the node map of theft, distillation, talent, chips and open weights.
import { engine } from '../../../engine/v2';
import type { GameStateV2, RiskSource } from '../../../engine/v2';
import { ActBtn, Term, Tip, TipCard } from '../ui';
import { Card, GoBtn, PanelHead, Ref, tabOf, Tabs, type GoTarget } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';
import { RiskFlows } from './RiskMap';
import './risk.css';

type Lever = { label: string; act?: { id: string; params?: Record<string, string | number | boolean> }; go?: GoTarget };
const LEVERS: Record<RiskSource['kind'], Lever[]> = {
  ownModel: [{ label: 'Fund detection agendas', act: { id: 'safety.fund', params: { level: 'serious' } } }, { label: 'Tighten eval gate', act: { id: 'safety.evalGate', params: { level: 'full' } } }, { label: 'Investigate scheming', act: { id: 'safety.investigate', params: { trait: 'SCHEME' } } }],
  rival: [{ label: 'Joint evals', act: { id: 'C3' } }, { label: 'Share threat intel', act: { id: 'C1' } }, { label: 'Publish research', act: { id: 'A4' } }],
  china: [{ label: 'Track-2 dialogue', act: { id: 'E1' } }, { label: 'Gov-gov agreement', act: { id: 'E2' } }, { label: 'Raise security', act: { id: 'SEC_TARGET' } }],
  misuse: [{ label: 'Classifier safeguards', go: { panel: 'products' } }, { label: 'Bug bounty', act: { id: 'A5' } }],
  theft: [{ label: 'Raise WSL target', act: { id: 'SEC_TARGET' } }, { label: 'Counter-intel', act: { id: 'SEC_CI' } }, { label: 'Siloing', act: { id: 'SEC_SILO' } }],
  rogue: [{ label: 'Control protocols', go: { panel: 'safety', tab: 'tools' } }, { label: 'Monitoring', act: { id: 'safety.monitoring' } }],
  war: [{ label: 'De-escalate', act: { id: 'E1' } }, { label: 'Loosen export controls', act: { id: 'E3', params: { direction: 'loosen' } } }],
};
const KIND_ICON: Record<RiskSource['kind'], typeof ICON.risk> = { ownModel: ICON.ownModel, rival: ICON.rival, china: ICON.china, misuse: ICON.misuse, theft: ICON.theft, rogue: ICON.rogue, war: ICON.war };
const KIND_LABEL: Record<RiskSource['kind'], string> = { ownModel: 'your models', rival: 'rival lab', china: 'China', misuse: 'misuse', theft: 'theft', rogue: 'rogue AI', war: 'conflict' };
/** Where each kind's main driver has its home (a reference, never the value). */
const DRIVER_REF: Partial<Record<RiskSource['kind'], { id: string; label: string; to: GoTarget }>> = {
  ownModel: { id: 'misBand', label: 'Misalignment band', to: { panel: 'safety', tab: 'graph' } },
  theft: { id: 'wsl', label: 'Weight security', to: { panel: 'company', tab: 'security' } },
  rival: { id: 'leadTrack', label: 'Lead track', to: { panel: 'overview' } },
  misuse: { id: 'servingSplit', label: 'Products', to: { panel: 'products' } },
};
const DRV_COLORS = ['#c9d4e2', '#8a9bb0', '#5b6b80', '#3d4b5e'];
const sevColor = (x: number) => (x > 0.2 ? C.bad : x > 0.05 ? C.watch : C.good);

function Sources({ s }: { s: GameStateV2 }) {
  const rows = [...engine.riskSources(s)].sort((a, b) => b.estimate - a.estimate);
  const max = Math.max(0.05, ...rows.map((r) => r.band[1])) * 1.05;
  const X = (x: number) => `${(Math.max(0, Math.min(max, x)) / max) * 100}%`;
  const ticks = [0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1].filter((t) => t <= max);
  return (
    <Card title={<Term id="riskSource">Where risk comes from</Term>} sub="estimate per source with its uncertainty band · hover a row for its drivers" home="riskSources"
      right={<span className="legend2"><span><i style={{ background: C.good }} />&lt; 5%</span><span><i style={{ background: C.watch }} />5–20%</span><span><i style={{ background: C.bad }} />&gt; 20%</span><span><i className="band" />band</span></span>}>
      <div className="rs2-axis">
        <span /><span className="rs2-track">{ticks.map((t) => <span key={t} className="rs2-tick" style={{ left: X(t) }}>{F.pct(t)}</span>)}</span><span /><span />
      </div>
      {rows.map((r) => {
        const Icon = KIND_ICON[r.kind];
        const ref = DRIVER_REF[r.kind];
        return (
          <div className="rs2-row" key={r.id} data-risk={r.id}>
            <Tip content={() => (
              <TipCard title={r.label} value={`${F.pct(r.estimate, 1)} (${F.pct(r.band[0], 1)}–${F.pct(r.band[1], 1)})`}>
                <div className="tip-cap">Drivers</div>
                <div className="stack2">{r.drivers.map((d, i) => <i key={d.label} style={{ flex: Math.max(0.001, d.share), background: DRV_COLORS[i % 4] }} />)}</div>
                {r.drivers.map((d, i) => <div className="tipcard-row" key={d.label}><span><i className="drv-sw" style={{ background: DRV_COLORS[i % 4] }} />{d.label}</span><span className="num">{F.pct(d.share)}</span></div>)}
              </TipCard>
            )}>
              <span className="rs2-lbl"><Icon size={15} /><span className="ellip"><b>{r.label}</b><span className="dim small"> · {KIND_LABEL[r.kind]}</span></span></span>
            </Tip>
            <Tip content={() => <TipCard title={r.label} value={F.pct(r.estimate, 1)} rows={r.drivers.map((d) => ({ label: d.label, value: F.pct(d.share) }))}>Share of this source's risk from each driver.</TipCard>}>
              <span className="rs2-track bar">
                {ticks.map((t) => <span key={t} className="rs2-grid" style={{ left: X(t) }} />)}
                <i className="rs2-band" style={{ left: X(r.band[0]), width: `calc(${X(r.band[1])} - ${X(r.band[0])})`, background: sevColor(r.estimate) }} />
                <i className="rs2-fill" style={{ width: X(r.estimate), background: sevColor(r.estimate) }} />
              </span>
            </Tip>
            <span className="num rs2-v" style={{ color: sevColor(r.estimate) }}>{F.pct(r.estimate, 1)}</span>
            <span className="rs2-lev">
              {ref && <Ref id={ref.id} to={ref.to}>{ref.label}</Ref>}
              {LEVERS[r.kind].map((l) => l.act
                ? <ActBtn key={l.label} id={l.act.id} testId={`lever.${r.id}.${l.act.id}`} params={l.act.params} label={l.label} />
                : <GoBtn key={l.label} to={l.go!} label={l.label} testId={`lever.${r.id}.go`} />)}
            </span>
          </div>
        );
      })}
      <div className="dim small" style={{ marginTop: 8 }}>Built from your trait beliefs, intel estimates and exposure. The world's true thresholds are unknown. The combined estimate is in the top strip.</div>
    </Card>
  );
}

export function RiskSources({ s }: { s: GameStateV2 }) {
  const tab = tabOf('risk', 'sources');
  return (
    <div className={`panel-v2 risk2 ${s.tutorial.act >= 4 ? 'emph-panel' : ''}`} data-panel="risk">
      <PanelHead icon={ICON.risks} title="Risk" sub="what could end in catastrophe, and what you can do about it"
        tabs={<Tabs panel="risk" def="sources" tabs={[{ id: 'sources', label: 'Sources', icon: ICON.risk }, { id: 'flows', label: 'Flows', icon: ICON.company }]} />} />
      {tab === 'flows'
        ? <Card title="Flows" sub="theft, distillation, talent, chips and open weights · hover a node, click for its panel" home="riskFlows"><RiskFlows s={s} /></Card>
        : <Sources s={s} />}
    </div>
  );
}
