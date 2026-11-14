// Risk sources (§6.6): estimate bands from beliefs, intel and exposure (never truth), driver breakdowns, levers.
import { engine } from '../../../engine/v2';
import type { GameStateV2, RiskSource } from '../../../engine/v2';
import { store } from '../store';
import { ActBtn, Band, pct, Section, Stack } from '../ui';

const LEVERS: Record<RiskSource['kind'], { label: string; panel: string; act?: { id: string; params?: Record<string, string | number | boolean> } }[]> = {
  ownModel: [{ label: 'Fund detection agendas', panel: 'safety', act: { id: 'safety.fund', params: { level: 'serious' } } }, { label: 'Tighten eval gate', panel: 'safety', act: { id: 'safety.evalGate', params: { level: 'full' } } }, { label: 'Investigate SCHEME', panel: 'safety', act: { id: 'safety.investigate', params: { trait: 'SCHEME' } } }],
  rival: [{ label: 'Joint evals', panel: 'relations', act: { id: 'C3' } }, { label: 'Share threat intel', panel: 'relations', act: { id: 'C1' } }, { label: 'Publish research', panel: 'relations', act: { id: 'A4' } }],
  china: [{ label: 'Track-2 dialogue', panel: 'relations', act: { id: 'E1' } }, { label: 'Gov-gov agreement', panel: 'relations', act: { id: 'E2' } }, { label: 'Raise security', panel: 'departments', act: { id: 'SEC_TARGET' } }],
  misuse: [{ label: 'Classifier safeguards', panel: 'deployments' }, { label: 'Bug bounty', panel: 'relations', act: { id: 'A5' } }],
  theft: [{ label: 'Raise WSL target', panel: 'departments', act: { id: 'SEC_TARGET' } }, { label: 'Counter-intel', panel: 'departments', act: { id: 'SEC_CI' } }, { label: 'Siloing', panel: 'departments', act: { id: 'SEC_SILO' } }],
  rogue: [{ label: 'Control protocols', panel: 'safety' }, { label: 'Monitoring', panel: 'safety', act: { id: 'safety.monitoring' } }],
  war: [{ label: 'De-escalate', panel: 'relations', act: { id: 'E1' } }, { label: 'Export controls', panel: 'relations', act: { id: 'E3', params: { direction: 'loosen' } } }],
};
const DRV_COLORS = ['#ef6b6b', '#e9b44c', '#a58cff', '#5aa9ff'];

export function RiskSources({ s }: { s: GameStateV2 }) {
  const rows = engine.riskSources(s);
  const comb = (f: (r: RiskSource) => number) => 1 - rows.reduce((a, r) => a * (1 - Math.max(0, Math.min(1, f(r)))), 1);
  const head = { est: comb((r) => r.estimate), lo: comb((r) => r.band[0]), hi: comb((r) => r.band[1]) };
  return (
    <div className={`panel-v2 ${s.tutorial.act >= 4 ? 'emph-panel' : ''}`} data-panel="risk">
      <Section title="Estimated P(catastrophe | today's trajectory)" right={<span className="num big">{pct(head.est, 1)} <span className="dim small">({pct(head.lo, 1)}–{pct(head.hi, 1)})</span></span>}>
        <Band lo={head.lo} hi={head.hi} mid={head.est} width={600} color="var(--neg)" />
        <div className="dim small">Built from your trait beliefs, intel posteriors and exposure meters. The world's true thresholds are unknown.</div>
      </Section>
      <div className="risk-rows">
        {rows.map((r) => (
          <div className="risk-row section" key={r.id} data-risk={r.id}>
            <div className="risk-head"><b>{r.label}</b><span className="dim small">{r.kind}</span><span className="num">{pct(r.estimate, 1)}</span></div>
            <Band lo={r.band[0]} hi={r.band[1]} mid={r.estimate} width={260} color={r.estimate > 0.2 ? 'var(--neg)' : r.estimate > 0.05 ? 'var(--warn)' : 'var(--pos)'} />
            <Stack parts={r.drivers.map((d, i) => ({ v: d.share, color: DRV_COLORS[i % 4], label: d.label }))} h={6} />
            <div className="bn-legend">{r.drivers.map((d, i) => <span key={d.label}><i style={{ background: DRV_COLORS[i % 4] }} />{d.label} {pct(d.share)}</span>)}</div>
            <div className="btn-row wrap">
              {LEVERS[r.kind].map((l) => l.act ? <ActBtn key={l.label} id={l.act.id} testId={`lever.${r.id}.${l.act.id}`} params={l.act.params} label={l.label} /> : <button key={l.label} className="btn btn-sm btn-ghost" onClick={() => store.setPanel(l.panel)}>{l.label} ›</button>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
