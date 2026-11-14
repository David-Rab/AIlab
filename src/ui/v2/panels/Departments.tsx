// Departments (§6.3): headcount, hiring target, morale, cost per department; compute split (7 sliders + presets);
// per-department projects; star hire, siloing, KYC, WSL target.
import { useState } from 'react';
import { agendaRows, inPipeline, payrollPerYear, poolsOf, SPLIT_KEYS, SPLIT_PRESETS, weeklyHireCap } from '../../../engine/v2';
import type { ComputeSplit, GameStateV2, StaffByRole } from '../../../engine/v2';
import { ActBtn, fmtB, fmtNum, Meter, pct, Row, Slider, Stack, Term, Why } from '../ui';

const ROLES: { id: keyof StaffByRole; label: string }[] = [
  { id: 'cap', label: 'Capabilities' }, { id: 'saf', label: 'Safety' }, { id: 'sec', label: 'Security' }, { id: 'prod', label: 'Product' }, { id: 'ops', label: 'Ops' },
];
const ZERO: StaffByRole = { cap: 0, saf: 0, sec: 0, prod: 0, ops: 0 };
export const SPLIT_COLOR: Record<keyof ComputeSplit, string> = {
  training: '#5aa9ff', experiments: '#2f7fd6', agents: '#a58cff', synthetic: '#66768a', serving: '#4cc38a', safety: '#e9b44c', security: '#ef6b6b',
};

export function Departments({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const [targets, setTargets] = useState<StaffByRole>({ ...p.hiring.target });
  const [split, setSplit] = useState<ComputeSplit>({ ...p.split });
  const [wsl, setWsl] = useState(Math.min(5, Math.round((p.security.target + 0.5) * 2) / 2));
  const pools = poolsOf(s);
  const sum = SPLIT_KEYS.reduce((a, k) => a + split[k], 0);
  const norm = Object.fromEntries(SPLIT_KEYS.map((k) => [k, split[k] / Math.max(1e-6, sum)])) as unknown as ComputeSplit;
  const changed = SPLIT_KEYS.some((k) => Math.abs(norm[k] - p.split[k]) > 1e-3);
  const projects: Record<keyof StaffByRole, string[]> = {
    cap: [
      ...p.models.runs.filter((r) => r.status === 'running').map((r) => `Run ${r.name}`),
      ...Object.entries(p.paradigms).filter(([, x]) => x.status === 'researching').map(([id, x]) => `${id} ${pct(x.progress)}`),
    ],
    saf: agendaRows(s).filter((a) => a.fte > 0).map((a) => `${a.name} · ${a.level}`),
    sec: [`WSL ${p.security.wsl.toFixed(1)} → ${p.security.target.toFixed(1)}`, `Siloing ${p.security.siloing}`, `Counter-intel ${pct(p.security.counterIntel)}`],
    prod: p.deployments.filter((d) => d.status === 'live').map((d) => `${d.channel} · KYC ${d.kyc}`),
    ops: [],
  };
  return (
    <div className="panel-v2" data-panel="departments">
      <div className="dept-cols">
        {ROLES.map((r) => {
          const cost = payrollPerYear({ ...ZERO, [r.id]: p.staff[r.id] });
          return (
            <div className="dept-col section" key={r.id} data-dept={r.id}>
              <div className="section-head"><span className="section-title">{r.label}</span><span className="num">{fmtNum(p.staff[r.id])}</span></div>
              <Row label="Target"><span className="num">{targets[r.id]}</span></Row>
              <Slider value={targets[r.id]} min={0} max={Math.max(200, p.staff[r.id] * 3)} step={5} onChange={(v) => setTargets({ ...targets, [r.id]: v })} width={150} />
              <Row label="Pipeline · cap/wk"><span className="num">{inPipeline(s, r.id)} · {weeklyHireCap(s, r.id).toFixed(0)}</span></Row>
              <Row label="Cost"><span className="num">{fmtB(cost)}/yr</span></Row>
              <ActBtn id="hireTarget" params={{ role: r.id, target: targets[r.id] }} label="Set" />
              <div className="proj-list">{projects[r.id].slice(0, 5).map((x) => <div key={x} className="small dim ellip">{x}</div>)}</div>
            </div>
          );
        })}
      </div>
      <div className="grid2">
        <section className="section">
          <div className="section-head"><span className="section-title"><Term id="split">Compute split</Term></span><span className="dim small">{fmtNum(p.computeOnline)} H100e</span></div>
          <Stack parts={SPLIT_KEYS.map((k) => ({ v: norm[k], color: SPLIT_COLOR[k], label: k }))} h={10} />
          {SPLIT_KEYS.map((k) => (
            <div className="alloc-row" key={k}>
              <span className="alloc-label"><span className="dot" style={{ background: SPLIT_COLOR[k] }} />{k}</span>
              <Slider value={split[k]} min={0} max={0.8} step={0.01} onChange={(v) => setSplit({ ...split, [k]: v })} width={160} />
              <span className="alloc-val num">{pct(norm[k])}</span>
              <span className="dim small num">{fmtNum(pools[k])}</span>
            </div>
          ))}
          <div className="btn-row">
            <ActBtn id="setSplit" params={norm as unknown as Record<string, number>} label={changed ? 'Apply split' : 'Split (no change)'} primary={changed} />
            <button className="btn btn-sm" onClick={() => setSplit({ ...p.split })}>Reset</button>
          </div>
          <div className="btn-row">{SPLIT_PRESETS.map((x) => <ActBtn key={x} id="splitPreset" testId={`splitPreset.${x}`} params={{ preset: x }} label={x} onDone={() => setSplit({ ...s.player.split })} />)}</div>
        </section>
        <section className="section">
          <div className="section-head"><span className="section-title">People · security</span></div>
          <Row label="Morale"><Why k="morale" title="Morale" body="See [[morale]]."><Meter value={p.morale.overall} width={110} /><span className="num">{p.morale.overall.toFixed(0)}</span></Why></Row>
          <Row label="Safety morale"><Why k="morale.safety" title="Safety staff morale"><Meter value={p.morale.safety} width={110} color="var(--warn)" /><span className="num">{p.morale.safety.toFixed(0)}</span></Why></Row>
          <Row label="Talent pull"><Why k="relations.talentPull" title="Talent pull"><span className="num">{s.relations.talentPull.toFixed(0)}</span></Why></Row>
          <Row label="Research taste τ"><span className="num">{p.tasteHire.toFixed(2)}</span><ActBtn id="starHire" /></Row>
          <Row label={<Term id="wsl">WSL</Term>}><Meter value={p.security.wsl} max={5} width={110} color="var(--neg)" /><span className="num">{p.security.wsl.toFixed(2)} → {p.security.target.toFixed(1)}</span></Row>
          <Row label={`Target WSL ${wsl}`}><Slider value={wsl} min={1} max={5} step={0.5} onChange={setWsl} /><ActBtn id="SEC_TARGET" params={{ level: wsl }} label="Set" /></Row>
          <Row label={`Siloing ${p.security.siloing}`}><ActBtn id="SEC_SILO" params={{ level: Math.min(2, p.security.siloing + 1) }} label="Silo +1" /><ActBtn id="SEC_SILO" testId="SEC_SILO.down" params={{ level: Math.max(0, p.security.siloing - 1) }} label="Silo −1" /></Row>
          <Row label={`Counter-intel ${pct(p.security.counterIntel)}`}><ActBtn id="SEC_CI" /></Row>
          <Row label="Security spend"><span className="num">{fmtB(p.security.spendRate)}/yr · privileged {p.security.privileged}</span></Row>
          <Row label={<Term id="kyc">KYC</Term>}><span className="small dim">{p.deployments.filter((d) => d.status === 'live').map((d) => `${d.channel} ${d.kyc}`).join(' · ') || 'set per deployment'}</span></Row>
        </section>
      </div>
    </div>
  );
}
