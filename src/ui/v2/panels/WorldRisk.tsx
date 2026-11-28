// World › Risk (UB-A; DECISIONS 'Remaining mockups approved': world risk lives on World, UI-IA §0). HOME of world
// risk per source (rival labs, China, misuse, theft, rogue copies, war), its range, drivers and levers: estimates from
// intel, beliefs and exposure, never truth. Your own models' loss-of-control risk is not here: its one home is SAFETY
// (gauge) with the L0 item. Below: the flows of theft, distillation, talent, chips and open weights.
import { engine, riskLevers } from '../../../engine/v2';
import type { GameStateV2, RiskSource } from '../../../engine/v2';
import { Term, Tip, TipCard } from '../ui';
import { Card, Ref, type GoTarget } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';
import { riskColor } from '../safetyRule';
import { RiskFlows } from './RiskMap';
import { POWERS } from './worldLinks';
import './risk.css';

type WorldKind = Exclude<RiskSource['kind'], 'ownModel'>;
/** Where each engine what-if lever (RISK_LEVERS ids) has its home. Only the levers riskLevers returns are shown. */
const LEVER_HOME: Record<string, GoTarget> = {
  lead: { panel: 'overview' },
  wsl: { panel: 'lab', tab: 'security' },
  defence: { panel: 'world', tab: 'tech' },
  flags: { panel: 'products' },
};
/** Sources whose story continues on Powers (China's tension ladder, the war rung). */
const POWERS_KINDS: WorldKind[] = ['china', 'war'];
const KIND_ICON: Record<WorldKind, typeof ICON.risk> = { rival: ICON.rival, china: ICON.china, misuse: ICON.misuse, theft: ICON.theft, rogue: ICON.rogue, war: ICON.war };
const KIND_LABEL: Record<WorldKind, string> = { rival: 'rival lab', china: 'China', misuse: 'misuse', theft: 'theft', rogue: 'rogue AI', war: 'conflict' };
const DRV_COLORS = ['#c9d4e2', '#8a9bb0', '#5b6b80', '#3d4b5e'];
/** Why a source carries risk, in one line (the drivers give the split). */
const KIND_WHY: Record<WorldKind, string> = {
  rival: 'A rival lab adds risk from its own models (its safety culture and capability) even when it is behind you: being behind does not make its models safe.',
  china: 'China\'s lab: its capability, safety culture and the race pressure on it.',
  misuse: 'Misuse of your products: capability in dangerous domains, safeguards and how many users can reach it.',
  theft: 'Your weights stolen and run without your safeguards: security level against attacker intent.',
  rogue: 'An AI acting on its own beyond your safeguards: autonomy, monitoring and safeguard research.',
  war: 'Conflict over AI: China\'s escalation ladder, Taiwan tension and export controls.',
};
const sevColor = (x: number) => riskColor(x, 'prob');

function Sources({ s }: { s: GameStateV2 }) {
  const rows = engine.riskSources(s).filter((r): r is RiskSource & { kind: WorldKind } => r.kind !== 'ownModel').sort((a, b) => b.estimate - a.estimate);
  // J2 RK1: engine what-ifs, how far one step of each lever moves each source.
  const levers = riskLevers(s);
  const pts = (d: number) => `${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d * 100).toFixed(Math.abs(d) < 0.001 ? 2 : 1)} pts`;
  const leverRows = (id: string) => (levers[id] ?? []).map((l) => ({ label: <Tip content={() => <TipCard title={l.label}>{`How: ${l.how}.`}</TipCard>}><span>{l.label}</span></Tip>, value: pts(l.delta), tone: (l.delta < -1e-5 ? 'pos' : l.delta > 1e-5 ? 'neg' : 'neutral') as 'pos' | 'neg' | 'neutral' }));
  const max = Math.max(0.05, ...rows.map((r) => r.band[1])) * 1.05;
  const X = (x: number) => `${(Math.max(0, Math.min(max, x)) / max) * 100}%`;
  const ticks = [0, 0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1].filter((t) => t <= max);
  return (
    <Card title={<Term id="riskSource">World risk</Term>} sub="where risk comes from outside your lab · best guess per source with its range · hover a row for its drivers" home="riskSources"
      right={<span className="legend2"><span><i style={{ background: C.good }} />&lt; 5%</span><span><i style={{ background: C.watch }} />5–20%</span><span><i style={{ background: C.bad }} />&gt; 20%</span><span><i className="band" />range</span></span>}>
      <div className="rs2-axis">
        <span /><span className="rs2-track">{ticks.map((t) => <span key={t} className="rs2-tick" style={{ left: X(t) }}>{F.pct(t)}</span>)}</span><span /><span />
      </div>
      {rows.map((r) => {
        const Icon = KIND_ICON[r.kind];
        return (
          <div className="rs2-row" key={r.id} data-risk={r.id}>
            <Tip content={() => (
              <TipCard title={r.label} value={`${F.pct(r.estimate, 1)} (${F.pct(r.band[0], 1)}–${F.pct(r.band[1], 1)})`}>
                <div className="tip-cap">Drivers</div>
                <div className="stack2">{r.drivers.map((d, i) => <i key={d.label} style={{ flex: Math.max(0.001, d.share), background: DRV_COLORS[i % 4] }} />)}</div>
                {r.drivers.map((d, i) => <div className="tipcard-row" key={d.label}><span><i className="drv-sw" style={{ background: DRV_COLORS[i % 4] }} />{d.label}</span><span className="num">{F.pct(d.share)}</span></div>)}
                {(levers[r.id] ?? []).length > 0 && <div className="tip-cap"><Term id="riskLever">What one step moves</Term></div>}
                {(levers[r.id] ?? []).map((l) => <div className="tipcard-row" key={l.id} data-lever={`${r.id}.${l.id}`}><span>{l.label}</span><span className={`num ${l.delta < -1e-5 ? 'tone-pos' : l.delta > 1e-5 ? 'tone-neg' : ''}`}>{pts(l.delta)}</span></div>)}
              </TipCard>
            )}>
              <span className="rs2-lbl"><Icon size={15} /><span className="rs2-nm"><span className="ellip"><b>{r.label}</b><span className="dim small"> · {KIND_LABEL[r.kind]}</span></span><span className="rs2-why ellip" data-test={`risk-why.${r.id}`}>{[...r.drivers].sort((x, y) => y.share - x.share)[0]?.label}</span></span></span>
            </Tip>
            <Tip content={() => <TipCard title={r.label} value={F.pct(r.estimate, 1)} rows={r.drivers.map((d) => ({ label: d.label, value: F.pct(d.share) }))}>Share of this source's risk from each driver.</TipCard>}>
              <span className="rs2-track bar">
                {ticks.map((t) => <span key={t} className="rs2-grid" style={{ left: X(t) }} />)}
                <i className="rs2-band" style={{ left: X(r.band[0]), width: `calc(${X(r.band[1])} - ${X(r.band[0])})`, background: sevColor(r.estimate) }} />
                <i className="rs2-fill" style={{ width: X(r.estimate), background: sevColor(r.estimate) }} />
              </span>
            </Tip>
            {/* Jank RK1: every risk figure opens its breakdown (drivers, range, what moves it). */}
            <Tip content={() => <TipCard title={r.label} value={`${F.pct(r.estimate, 1)} (${F.pct(r.band[0], 1)}–${F.pct(r.band[1], 1)})`} rows={[...r.drivers.map((d) => ({ label: d.label, value: F.pct(d.share) })), ...(leverRows(r.id).length ? [{ label: <b><Term id="riskLever">What one step moves</Term></b>, value: '' }, ...leverRows(r.id)] : [])]} >{KIND_WHY[r.kind]}</TipCard>}>
              <span className="num rs2-v" style={{ color: sevColor(r.estimate) }} data-test={`risk-v.${r.id}`}>{F.pct(r.estimate, 1)}</span>
            </Tip>
            <span className="rs2-lev">
              {(levers[r.id] ?? []).map((l) => (
                <Tip key={l.id} content={() => <TipCard title={l.label} value={pts(l.delta)}>{`How: ${l.how}.`}</TipCard>}>
                  <span><Ref id={`lever.${r.id}.${l.id}`} to={LEVER_HOME[l.id] ?? { panel: 'overview' }}>{l.label} <span className={`num ${l.delta < -1e-5 ? 'tone-pos' : l.delta > 1e-5 ? 'tone-neg' : ''}`}>{pts(l.delta)}</span></Ref></span>
                </Tip>
              ))}
              {POWERS_KINDS.includes(r.kind) && <Ref id={`powers.${r.id}`} to={POWERS}>{r.kind === 'war' ? 'China tension' : 'China'}</Ref>}
            </span>
          </div>
        );
      })}
      <div className="dim small" style={{ marginTop: 8 }}>Built from intel estimates, your beliefs and exposure. The world's true thresholds are unknown. Your own models' risk: <Ref id="lossRisk" to={{ panel: 'safety', tab: 'risks' }}>SAFETY › Risks</Ref></div>
    </Card>
  );
}

/** World › Risk tab: the world risk sources, then the flows. */
export function WorldRisk({ s }: { s: GameStateV2 }) {
  return (
    <div className="risk2" data-test="world-risk">
      <Sources s={s} />
      <Card title="Flows" sub="theft, distillation, talent, chips and open weights · hover a node, click for its panel" home="riskFlows"><RiskFlows s={s} /></Card>
    </div>
  );
}
