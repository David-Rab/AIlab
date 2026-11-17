// Safety lab (IA.md L2, PROPOSALS §4): Graph · Agendas · Tools · Incidents · Findings.
// HOME of the trait graph and beliefs, detection by capability level, the misalignment band, the agenda portfolio,
// techniques (strength curves, decay, masks), the safety policies, incidents, investigations, findings and
// failure-mode cards. Understanding and capability live in the top strip and are only referenced here.
import { useMemo, useState } from 'react';
import { ListChecks, Waypoints, Wrench, Ruler, Telescope, Ban, TrendingDown, Droplets } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { CRITICAL_TRAITS, TRAIT_BY_ID, TRAIT_IDS } from '../../../data/v2/traits';
import { beliefView, dateOf, detectionGrid, fmtDate, internalVersion, monitoredUses, safetyAgentVersion, safetyUtilisation, safetyView, techniqueCurve, versionById } from '../../../engine/v2';
import type { AgendaRow, GameStateV2, ResponseKind, SafetyUtilisation, TechniqueRow, TraitId } from '../../../engine/v2';
import { store } from '../store';
import { ActBtn, Gate, Term, Tip, TipCard } from '../ui';
import { Card, CauseChain, GoBtn, HBar, PanelHead, Pill, Ref, tabOf, Tabs } from '../kit';
import * as F from '../fmt';
import { ICON, TRAIT_ICON } from '../icons';
import { C, div, seq } from '../theme';
import { TraitGraph, traitSev } from './TraitGraph';
import './safety.css';

const LEVELS = ['seed', 'serious', 'major'] as const;
const RESPONSES: { k: ResponseKind; label: string }[] = [
  { k: 'patchSignal', label: 'Patch signal' }, { k: 'retrainAgainst', label: 'Retrain against' }, { k: 'targetedTraining', label: 'Targeted training' },
  { k: 'restrictContext', label: 'Restrict context' }, { k: 'addControl', label: 'Add control' }, { k: 'rollback', label: 'Roll back' }, { k: 'disclose', label: 'Disclose' },
];
const FTYPE: Record<string, { icon: LucideIcon; label: string; tone: string }> = {
  TECH: { icon: Wrench, label: 'Technique', tone: 'good' }, EVAL: { icon: Ruler, label: 'Eval', tone: 'good' }, DISC: { icon: Telescope, label: 'Discovery', tone: 'warn' },
  DEAD: { icon: Ban, label: 'Dead end', tone: 'neu' }, NEG: { icon: TrendingDown, label: 'Negative', tone: 'bad' }, SPILL: { icon: Droplets, label: 'Spillover', tone: 'neu' },
  FALSE: { icon: Wrench, label: 'Technique', tone: 'good' },
};
const GATE_LABEL: Record<string, string> = { none: 'none', basic: 'basic', full: 'full', fullPlusExternal: 'full + external' };
const tname = (t: string) => TRAIT_BY_ID[t as TraitId]?.name ?? F.words(t);

export function SafetyLab({ s }: { s: GameStateV2 }) {
  const sv = safetyView(s);
  const tab = tabOf('safety', 'graph');
  const open = sv.incidents.filter((i) => i.status === 'open' || i.status === 'investigating').length;
  const fresh = sv.findings.filter((f) => !f.published && s.time.day - f.day <= 30).length;
  return (
    <div className="panel-v2 safety" data-panel="safety">
      <PanelHead
        icon={ICON.safety}
        title="Safety lab"
        tabs={<Tabs panel="safety" def="graph" tabs={[
          { id: 'graph', label: 'Trait graph', icon: Waypoints }, { id: 'agendas', label: 'Agendas', icon: ListChecks }, { id: 'tools', label: 'Tools', icon: Wrench },
          { id: 'incidents', label: 'Incidents', icon: ICON.incident, badge: open || undefined }, { id: 'findings', label: 'Findings', icon: ICON.finding, badge: fresh ? `${fresh} new` : undefined },
        ]} />}
      />
      {tab === 'graph' && <GraphTab s={s} sv={sv} />}
      {tab === 'agendas' && <Gate s={s} k="agendas"><AgendasTab s={s} rows={sv.agendas} /></Gate>}
      {tab === 'tools' && <ToolsTab s={s} sv={sv} />}
      {tab === 'incidents' && <IncidentsTab s={s} sv={sv} />}
      {tab === 'findings' && <FindingsTab s={s} sv={sv} />}
    </div>
  );
}
type SV = ReturnType<typeof safetyView>;

// ───────── Graph tab ─────────
function GraphTab({ s, sv }: { s: GameStateV2; sv: SV }) {
  const v = versionById(s, store.sel.versionId) ?? internalVersion(s);
  const versions = s.player.models.versions.filter((x) => x.status !== 'retired');
  const iv = internalVersion(s);
  return (
    <div className="saf-graph">
      <Card
        title="How training shapes dispositions"
        sub={<>nodes: your <Term id="belief">belief</Term> (estimate ± uncertainty) · edges: <Term id="evidenceGrade">evidence</Term> (width = weight, solid A … dotted D)</>}
        right={versions.length > 0 && (
          <label className="small dim row-i">beliefs for
            <select className="text-input" data-test="tg-version" value={v?.id ?? ''} onChange={(e) => store.select({ versionId: e.target.value })}>
              {versions.map((x) => <option key={x.id} value={x.id}>{x.name}{x.id === iv?.id ? ' · internal' : ''}</option>)}
            </select>
          </label>
        )}
        term="traitGraph"
      >
        <TraitGraph s={s} versionId={v?.id} />
      </Card>
      <div className="saf-side">
        <DetectionCard s={s} sv={sv} />
        <MisCard s={s} versionId={v?.id} />
      </div>
    </div>
  );
}

function DetectionCard({ s, sv }: { s: GameStateV2; sv: SV }) {
  const g = useMemo(() => detectionGrid(s), [s, s.time.day]);
  const cur = Math.round(g.L);
  const under = CRITICAL_TRAITS.filter((t) => (sv.understanding.perTrait[t] ?? 0) < 0.5).length;
  const nd = sv.nextDecay;
  const ndRow = nd && sv.techniques.find((t) => t.id === nd.id);
  return (
    <Card title="Can your tools see it?" sub="detection by capability level" home="detectionByLevel" id="ctl-detection">
      <div className="det-grid" style={{ gridTemplateColumns: `130px repeat(${g.levels.length}, minmax(0, 1fr))` }}>
        <span />
        {g.levels.map((l) => <span key={l} className={`det-h num ${l === cur ? 'cur' : ''}`}>L{l}</span>)}
        {g.rows.map((r) => {
          const Icon = TRAIT_ICON[r.trait];
          return [
            <span key={r.trait} className="det-t"><Icon size={12} /><Term id={`trait:${r.trait}`}>{tname(r.trait).replace('Successor alignment to self', 'Successor align.')}</Term></span>,
            ...r.det.map((d, i) => {
              const edge = d >= 0.5 && (r.det[i + 1] ?? 1) < 0.5;
              return <span key={`${r.trait}${i}`} className={`det-c num ${g.levels[i] === cur ? 'cur' : ''} ${edge ? 'edge' : ''}`} style={{ background: div((d - 0.5) * 2.2) }}>{F.idx(d * 100)}</span>;
            }),
          ];
        })}
      </div>
      <div className="det-leg small dim">
        <span className="row-i"><i className="det-sw cur" /> your level</span>
        <span className="row-i"><i className="det-sw edge" /> 50% line = <Ref id="U" to={{ panel: 'safety', tab: 'graph' }}>Understanding</Ref></span>
      </div>
      {nd && (
        <div className="det-cause">
          <CauseChain links={[
            { label: <>{ndRow?.name ?? nd.name} {F.pct(1 - nd.decay)} decayed</>, icon: ICON.revalidate, kind: 'root', to: { panel: 'safety', tab: 'tools' } },
            { label: <>{under} of {CRITICAL_TRAITS.length} traits under 50%</>, icon: ICON.blind, kind: under ? 'bad' : 'mid' },
          ]} />
          <GoBtn to={{ panel: 'safety', tab: 'tools' }} label={<><ICON.revalidate size={12} /> Re-validate</>} testId="det.tools" />
        </div>
      )}
    </Card>
  );
}

const DANGER = 0.4;
function MisCard({ s, versionId }: { s: GameStateV2; versionId?: string }) {
  const bv = beliefView(s, versionId);
  if (!bv) return <Card title={<Term id="misalign">Estimated misalignment</Term>}><div className="dim small">No model yet</div></Card>;
  const [lo, hi] = bv.misBand;
  const max = Math.max(0.6, hi + 0.08);
  const f = (x: number) => `${(Math.max(0, Math.min(max, x)) / max) * 100}%`;
  const thin = CRITICAL_TRAITS.filter((t) => (bv.beliefs[t]?.clarity ?? 0) < 0.4).length;
  const name = s.player.models.versions.find((x) => x.id === bv.versionId)?.name;
  const col = bv.misEst >= DANGER ? C.bad : bv.misEst >= DANGER / 2 ? C.watch : C.good;
  return (
    <Card title={<Term id="misalign">Estimated misalignment</Term>} sub={`${name ?? ''} · from beliefs`} home="misBand">
      <div className="mis-bar">
        <span className="mis-band" style={{ left: f(lo), width: `calc(${f(hi)} - ${f(lo)})`, background: col }} />
        <span className="mis-est" style={{ left: f(bv.misEst) }}><b className="num">{F.num(bv.misEst, 2)}</b></span>
        <span className="mis-danger" style={{ left: f(DANGER) }}><span><Term id="dangerLine">danger line</Term> <span className="num">{F.num(DANGER, 2)}</span> (published)</span></span>
      </div>
      <div className="small dim">
        <Term id="misBand">band</Term> <span className="num">{F.num(lo, 2)}–{F.num(hi, 2)}</span>: {thin ? <>wide because {thin} critical traits are under-observed</> : 'your evidence on the critical traits is fresh'}
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <GoBtn to={{ panel: 'risk' }} label="Risk sources" testId="mis.risk" />
      </div>
    </Card>
  );
}

// ───────── Agendas tab ─────────
function AgendasTab({ s, rows }: { s: GameStateV2; rows: AgendaRow[] }) {
  const [all, setAll] = useState(false);
  const funded = rows.filter((a) => a.fte > 0);
  const rest = rows.filter((a) => a.fte <= 0);
  const max = Math.max(1, ...rows.map((a) => a.findingsPerYear));
  return (
    <div className="saf-ag">
      <Card title={<><Term id="agenda">Funded agendas</Term> <span className="dim num">{funded.length}</span></>} sub="funding · efficacy band · findings per year" home="agendas" id="ctl-agendas"
        right={<button className="btn btn-sm" data-test="ag-all" onClick={() => setAll(!all)}>{all ? 'Hide unfunded' : `Show all ${rows.length}`}</button>}>
        <div className="ag-hd small dim"><span>Agenda</span><span>Funding</span><span>Staff</span><span><Term id="belief">Efficacy</Term> band</span><span>Finds / yr</span><span>Status</span></div>
        {funded.map((a) => <AgendaLine key={a.id} a={a} max={max} />)}
        {!funded.length && <div className="dim small">No agenda funded. Show all to pick one.</div>}
        {all && <><div className="tip-cap" style={{ marginTop: 10 }}>Unfunded · {rest.length}</div>{rest.map((a) => <AgendaLine key={a.id} a={a} max={max} />)}</>}
      </Card>
      <DeptLoad u={safetyUtilisation(s)} />
    </div>
  );
}

/** What the department's people and compute are doing: used, idle, short. Shades of the safety hue for uses, the
 *  agents' hue for the fleet, the track colour for free/idle; every segment is keyed in the legend under its bar. */
const LOAD_COL = { agendas: C.und, monitoring: seq(1), investigations: seq(0.35), patches: C.neutral, agents: C.cap, free: C.line2 } as const;
function LoadLegend({ items }: { items: { k: keyof typeof LOAD_COL; label: ReactNode; v: string }[] }) {
  return <div className="small dim load-legend">{items.map((x) => <span key={x.k} className="load-key"><i style={{ background: LOAD_COL[x.k] }} />{x.label} <span className="num">{x.v}</span></span>)}</div>;
}
function DeptLoad({ u }: { u: SafetyUtilisation }) {
  const st = u.staff;
  const cp = u.compute;
  const sTot = Math.max(1, st.total, st.agendas + st.investigations + st.patches);
  const cTot = Math.max(1, cp.pool);
  const seg = (v: number, tot: number, k: keyof typeof LOAD_COL) => (v > 0 ? <i key={k} style={{ flex: v / tot, background: LOAD_COL[k] }} title={k} /> : null);
  const starved = cp.agendasWanted > cp.agendasGot * 1.05;
  return (
    <Card title={<Term id="safetyLoad">Department load</Term>} sub="what staff and compute are doing" home="safetyLoad">
      <div className="load-row" data-test="load-staff">
        <span className="small">Staff <span className="num">{F.count(st.total)}</span></span>
        <div className="stack2 load-bar">{seg(st.agendas, sTot, 'agendas')}{seg(st.investigations, sTot, 'investigations')}{seg(st.patches, sTot, 'patches')}{seg(st.free, sTot, 'free')}</div>
        <span className="small">{st.short > 0 ? <span className="tone-neg">short {F.count(st.short)}</span> : st.free > 0 ? <span>free {F.count(st.free)}</span> : <span className="dim">all assigned</span>}</span>
      </div>
      <LoadLegend items={[
        { k: 'agendas', label: 'agendas', v: F.count(st.agendas) }, { k: 'investigations', label: 'investigations', v: F.count(st.investigations) },
        ...(st.patches ? [{ k: 'patches' as const, label: 'patches', v: F.count(st.patches) }] : []), { k: 'free', label: st.short > 0 ? 'short: every agenda slowed' : 'free', v: F.count(st.short > 0 ? st.short : st.free) },
      ]} />
      <div className="load-row" data-test="load-compute">
        <span className="small">Compute <span className="num">{F.count(cp.pool)}</span></span>
        <div className="stack2 load-bar">{seg(cp.agendasGot, cTot, 'agendas')}{seg(cp.monitoring, cTot, 'monitoring')}{seg(cp.investigations, cTot, 'investigations')}{seg(cp.agents, cTot, 'agents')}{seg(cp.idle, cTot, 'free')}</div>
        <span className="small">{starved ? <span className="tone-neg">agendas get {F.pct(cp.agendasGot / Math.max(1, cp.agendasWanted))}</span> : cp.idle > cp.pool * 0.02 ? <span>idle {F.count(cp.idle)}</span> : <span className="dim">all used</span>}</span>
      </div>
      <LoadLegend items={[
        { k: 'agendas', label: starved ? `agendas (want ${F.count(cp.agendasWanted)})` : 'agendas', v: F.count(cp.agendasGot) },
        { k: 'monitoring', label: <Term id="runtimeMonitoring">monitoring</Term>, v: F.count(cp.monitoring) },
        { k: 'investigations', label: 'investigations', v: F.count(cp.investigations) },
        { k: 'agents', label: <Term id="safetyAgents">agents</Term>, v: F.count(cp.agents) },
        { k: 'free', label: 'idle', v: F.count(cp.idle) },
      ]} />
    </Card>
  );
}

function AgendaLine({ a, max }: { a: AgendaRow; max: number }) {
  const cur = LEVELS.indexOf(a.level as (typeof LEVELS)[number]);
  const def = AGENDA_BY_ID[a.id];
  return (
    <div className={`ag-row ${a.status === 'deadEnd' ? 'dead' : ''}`} data-agenda={a.id}>
      <Tip content={() => (
        <TipCard title={a.name} value={F.words(a.status)} footer={`First finding ≈ ${def.T1} mo at serious funding`} rows={[
          { label: 'Posterior mean', value: F.num(a.band.mean, 2) }, { label: 'Band', value: `${F.num(a.band.lo, 2)}–${F.num(a.band.hi, 2)} (${a.band.label})` },
          { label: <Term id="finding">Findings</Term>, value: a.findings }, { label: 'Compute share', value: F.pct(a.computeShare) }, { label: <Term id="trustedToAI">Trusted to AI</Term>, value: F.pct(a.aiLabour) },
          ...(a.refresh ? [{ label: <Term id="refresh">Re-validating</Term>, value: F.pct(a.refresh.progress) }] : []),
        ]} />
      )}><span className="ag-name ellip">{a.name}</span></Tip>
      <span className="ag-pips">
        {LEVELS.map((l, i) => (
          <span key={l} className={`pip ${i <= cur ? 'on' : ''}`}><ActBtn id="safety.fund" testId={`safety.fund.${l}`} params={{ agenda: a.id, level: l }} label={<i title={l} />} /></span>
        ))}
        {a.fte > 0 && <span className="pip cut"><ActBtn id="safety.cut" testId="safety.cut" params={{ agenda: a.id }} label="×" /></span>}
        <span className="small dim">{a.fte > 0 ? a.level : 'off'}</span>
      </span>
      <span className="num small">{F.count(a.fte)}</span>
      <span className="ag-band"><span className="ag-band-in" style={{ left: `${a.band.lo * 100}%`, width: `${(a.band.hi - a.band.lo) * 100}%` }} /><b style={{ left: `${a.band.mean * 100}%` }} /></span>
      <span className="row-i"><HBar v={a.findingsPerYear} max={max} w={46} color={C.und} /><span className="num small">{F.num(a.findingsPerYear, 1)}</span></span>
      <span className="small">{a.refresh ? <span className="tag2 warn">re-validating {F.pct(a.refresh.progress)}</span> : a.status === 'deadEnd' ? <span className="tag2">dead end</span> : <span className="dim">{F.words(a.status)}</span>}</span>
    </div>
  );
}

// ───────── Tools tab ─────────
function ToolsTab({ s, sv }: { s: GameStateV2; sv: SV }) {
  const techs = sv.techniques.filter((t) => t.unlocked).sort((a, b) => Number(b.active) - Number(a.active) || a.decay - b.decay);
  const locked = sv.techniques.length - techs.length;
  return (
    <div className="saf-tools">
      <Card title={<><Term id="technique">Techniques</Term> <span className="dim num">{techs.length}</span></>} sub={<>strength vs capability level · dashed = <Term id="mHalf">M½</Term> · white = now{locked ? ` · ${locked} not yet unlocked` : ''}</>} home="techniques">
        <div className="tech-grid">
          {techs.map((t) => <TechCard key={t.id} s={s} t={t} refresh={sv.agendas.find((a) => a.refresh?.techniqueId === t.id)?.refresh?.progress} />)}
        </div>
      </Card>
      <PolicyCard s={s} sv={sv} />
    </div>
  );
}
function TechCard({ s, t, refresh }: { s: GameStateV2; t: TechniqueRow; refresh?: number }) {
  const W = 220;
  const Hh = 56;
  const c0 = techniqueCurve(s, t.id, [0])!;
  const lo = Math.max(0, Math.min(3, Math.round(c0.L) - 6));
  const levels = Array.from({ length: 25 }, (_, i) => lo + i * 0.5);
  const c = techniqueCurve(s, t.id, levels)!;
  const hiL = levels[levels.length - 1];
  const x = (l: number) => ((Math.max(lo, Math.min(hiL, l)) - lo) / (hiL - lo)) * W;
  const ymax = Math.max(0.3, ...c.strength) * 1.1;
  const y = (v: number) => Hh - 2 - (v / ymax) * (Hh - 6);
  const pts = levels.map((l, i) => `${x(l)},${y(c.strength[i])}`).join(' ');
  const decayed = 1 - t.decay;
  return (
    <div className={`tech ${t.active || t.role === 'fix' ? '' : 'off'}`} data-technique={t.id}>
      <div className="tech-hd">
        <b className="ellip" title={t.name}>{t.name}</b>
        <span className="sp" />
        <Tip content={() => <TipCard title={<Term id="toolFamily">Tool family</Term>} value={t.family}>{`${AGENDA_BY_ID[t.agenda]?.name ?? t.agenda} · role: ${t.role}`}</TipCard>}><span className="tag2">{t.family}</span></Tip>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${Hh + 12}`} className="tech-svg">
        <polyline points={`0,${Hh} ${pts} ${W},${Hh}`} fill="rgba(34,163,148,.12)" stroke="none" />
        <polyline points={pts} fill="none" stroke={t.active ? C.und : C.text3} strokeWidth={1.6} />
        {c.mHalfL !== undefined && c.mHalfL >= lo && c.mHalfL <= hiL && <line x1={x(c.mHalfL)} x2={x(c.mHalfL)} y1={0} y2={Hh} stroke={C.watch} strokeDasharray="3 2" />}
        <line x1={x(c.L)} x2={x(c.L)} y1={0} y2={Hh} stroke="#fff" opacity={0.75} />
        <text x={0} y={Hh + 11} className="tech-ax">L{lo}</text>
        <text x={W} y={Hh + 11} className="tech-ax" textAnchor="end">L{hiL}</text>
        {c.mHalfL !== undefined && c.mHalfL >= lo && c.mHalfL <= hiL && <text x={x(c.mHalfL) + 3} y={9} className="tech-ax warn">M½</text>}
      </svg>
      <div className="tech-ft">
        <span className="small dim">strength</span> <b className="num">{F.num(t.strength, 2)}</b>
        {decayed > 0.5 && <span className="tag2 bad">{F.pct(decayed)} decayed</span>}
        {t.trainedAgainst > 0.05 && <Tip content={() => <TipCard title={<Term id="goodhart">Goodhart masking</Term>} value={F.pct(t.trainedAgainst)}>Training against this tool teaches the model to hide from its family.</TipCard>}><span className="tag2 warn">masked</span></Tip>}
        {refresh !== undefined && <span className="tag2 warn"><Term id="refresh">re-validating</Term> {F.pct(refresh)}</span>}
        {t.role === 'fix' ? <span className="tag2">fix · used in runs</span> : !t.active && <span className="tag2">off</span>}
      </div>
      <div className="btn-row">
        {t.role !== 'fix' && <ActBtn id="safety.technique" testId={`safety.technique.${t.id}`} params={{ id: t.id, active: !t.active }} label={t.active ? 'Turn off' : 'Turn on'} />}
        <ActBtn id="safety.refresh" testId={`safety.refresh.${t.id}`} params={{ techniqueId: t.id }} icon={ICON.revalidate} label="Re-validate" />
      </div>
    </div>
  );
}
/** Summary of the internal agent packages that matter to safety (D4: set on Company › Agents at work; this links there). */
function AgentsSummary({ s }: { s: GameStateV2 }) {
  const sv = safetyAgentVersion(s);
  const mon = monitoredUses(s);
  const to = { panel: 'company', tab: 'people', anchor: 'agents' };
  return (
    <div className="pol-sec" data-test="agents-summary">
      <div className="pol-k"><Term id="agentPackage">Internal agents</Term> <span className="dim small">set on Company</span></div>
      <div className="row-i">
        <Ref id="trustedToAI" to={to}>Trusted to AI {F.pct(s.player.policies.trustedToAI)} · {sv?.name ?? '—'}</Ref>
        <Ref id="agentMonitor" to={to}>monitors on {mon.length} of 4 uses</Ref>
      </div>
    </div>
  );
}
function PolicyCard({ s, sv }: { s: GameStateV2; sv: SV }) {
  const pol = s.player.policies.publishSafety;
  return (
    <Card title="Safety policy" sub="gates and commitments" id="ctl-policy" home="safetyPolicy">
      <div className="pol-sec">
        <div className="pol-k"><Term id="evalGate">Eval gate</Term> <span className="dim small">before each external release</span></div>
        <div className="seg-acts" id="ctl-evalgate">
          {(['none', 'basic', 'full', 'fullPlusExternal'] as const).map((g) => <span key={g} className={sv.evalGate === g ? 'on' : ''}><ActBtn id="safety.evalGate" testId={`safety.evalGate.${g}`} params={{ level: g }} label={GATE_LABEL[g]} /></span>)}
        </div>
      </div>
      <AgentsSummary s={s} />
      <div className="pol-sec">
        <div className="pol-k"><Term id="publishPolicy">Publish policy</Term></div>
        <div className="seg-acts">
          {(['none', 'selective', 'all'] as const).map((p) => <span key={p} className={pol === p ? 'on' : ''}><ActBtn id="safety.publishPolicy" testId={`safety.publishPolicy.${p}`} params={{ policy: p }} label={p} /></span>)}
        </div>
      </div>
      <div className="pol-sec">
        <div className="pol-k"><Term id="pledge">Monitorability pledge</Term></div>
        {sv.monitorabilityCommitment ? <span className="tag2 good"><ICON.check size={12} /> pledged</span> : <ActBtn id="safety.pledge" label="Make the pledge" />}
      </div>
    </Card>
  );
}

// ───────── Incidents tab ─────────
function IncidentsTab({ s, sv }: { s: GameStateV2; sv: SV }) {
  const v = versionById(s, store.sel.versionId) ?? internalVersion(s);
  const [invTrait, setInvTrait] = useState<TraitId>('SCHEME');
  const live = sv.incidents.filter((i) => i.status === 'open' || i.status === 'investigating').reverse();
  const past = sv.incidents.filter((i) => !(i.status === 'open' || i.status === 'investigating')).slice(-8).reverse();
  const card = (i: SV['incidents'][number]) => {
    const vn = s.player.models.versions.find((x) => x.id === i.versionId)?.name ?? i.versionId;
    const isLive = i.status === 'open' || i.status === 'investigating';
    const TI = TRAIT_ICON[i.apparent];
    return (
      <div className={`inc sev-${i.severity} ${isLive ? 'live' : ''}`} key={i.id} data-incident={i.id}>
        <div className="inc-hd">
          <ICON.incident size={15} className={i.severity >= 4 ? 'tone-neg' : i.severity >= 3 ? 'tone-warn' : ''} />
          <Pill kind={i.severity >= 4 ? 'bad' : i.severity >= 3 ? 'warn' : 'neu'}><Term id="severity">S{i.severity}</Term></Pill>
          {TI && <TI size={13} />}<b>{i.apparent === 'unexplained' || i.apparent === 'misuse' ? F.words(i.apparent) : <Term id={`trait:${i.apparent}`}>{tname(i.apparent)}</Term>}</b>
          <span className="dim small">{vn} · {i.exposure} · {fmtDate(dateOf(s, i.day))}</span>
          <span className="sp" />
          {i.publicTimerDays !== undefined && i.status === 'open' && <span className="tag2 bad"><ICON.lead size={12} /> public in {F.days(i.publicTimerDays)}</span>}
          <span className={`tag2 ${isLive ? 'warn' : ''}`}>{i.status}</span>
        </div>
        {i.responses.length > 0 && <div className="small dim">Done: {i.responses.map((r) => RESPONSES.find((x) => x.k === r)?.label ?? r).join(', ')}</div>}
        {isLive && (
          <div className="inc-menu">
            <span className="tip-cap"><Term id="response">Respond</Term></span>
            <div className="btn-row wrap">
              {RESPONSES.map((r) => <ActBtn key={r.k} id="safety.respond" testId={`safety.respond.${r.k}`} params={{ kind: r.k, incidentId: i.id, versionId: i.versionId }} label={r.label} />)}
              <ActBtn id="safety.investigate" testId="safety.investigate.incident" params={{ incidentId: i.id, fte: 15 }} icon={ICON.investigate} label="Investigate" />
            </div>
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="saf-inc">
      <Card title={<Term id="incident">Incidents</Term>} sub={`${live.length} open`} home="incidents" id="ctl-incidents">
        {live.map(card)}
        {!live.length && <div className="row-i small"><ICON.check size={14} className="tone-pos" /> No open incidents</div>}
        {past.length > 0 && <><div className="tip-cap" style={{ marginTop: 10 }}>Closed</div>{past.map(card)}</>}
      </Card>
      <Card title={<Term id="investigation">Investigations</Term>} home="investigations" id="ctl-investigate">
        {sv.investigations.slice(-8).reverse().map((x) => (
          <div className="inv-row" key={x.id}>
            <span className="ellip small">{x.target.kind === 'trait' ? <><Term id={`trait:${x.target.trait}`}>{tname(x.target.trait)}</Term> on {s.player.models.versions.find((q) => q.id === (x.target as { versionId: string }).versionId)?.name ?? ''}</> : <>incident {x.target.incidentId}</>}</span>
            <span className="row-i"><Term id="clarity"><HBar v={x.clarity} max={1} w={70} /></Term><span className="num small">{F.pct(x.clarity)}</span></span>
            <span className="small">{x.outcome ? <span className="tag2">{F.words(x.outcome)}</span> : <span className="dim">{F.count(x.fte)} staff</span>}</span>
            {!x.outcome ? <ActBtn id="safety.closeCase" params={{ id: x.id }} label="Close" /> : <span />}
          </div>
        ))}
        {!sv.investigations.length && <div className="dim small">No cases yet.</div>}
        <div className="inv-new">
          <span className="small dim">Open a case on</span>
          <select className="text-input" data-test="inv-trait" value={invTrait} onChange={(e) => setInvTrait(e.target.value as TraitId)}>{TRAIT_IDS.map((t) => <option key={t} value={t}>{TRAIT_BY_ID[t].name}</option>)}</select>
          <span className="small dim">in {v?.name ?? '—'}</span>
          <ActBtn id="safety.investigate" params={{ versionId: v?.id ?? '', trait: invTrait, fte: 15 }} icon={ICON.investigate} label="Investigate · 15 staff" primary reason />
        </div>
      </Card>
    </div>
  );
}

// ───────── Findings tab ─────────
function FindingsTab({ s, sv }: { s: GameStateV2; sv: SV }) {
  const [all, setAll] = useState(false);
  const rows = [...sv.findings].reverse();
  const shown = all ? rows : rows.slice(0, 14);
  return (
    <div className="saf-find">
      <Card title={<><Term id="finding">Findings</Term> <span className="dim num">{sv.findings.length}</span></>} sub={<>published per your <Term id="publishPolicy">publish policy</Term> or one by one</>} home="findings" id="ctl-findings"
        right={rows.length > 14 && <button className="btn btn-sm" onClick={() => setAll(!all)}>{all ? 'Fewer' : `Show all ${rows.length}`}</button>}>
        <div className="find-list">
          {shown.map((f) => {
            const ft = FTYPE[f.type] ?? FTYPE.TECH;
            return (
              <div className="find" key={f.id + f.day} data-finding={f.id}>
                <span className={`ftype2 ${ft.tone}`}><ft.icon size={12} />{ft.label}</span>
                <span className={`ellip ${f.retracted ? 'strike' : ''}`}>{f.title}</span>
                <span className="dim small ellip">{AGENDA_BY_ID[f.agenda]?.name ?? f.agenda} · {fmtDate(dateOf(s, f.day))}</span>
                {f.published ? <span className="tag2 good">published</span> : f.retracted ? <span className="tag2 bad">retracted</span> : <ActBtn id="safety.publish" testId={`safety.publish.${f.id}`} params={{ findingId: f.id }} label="Publish" />}
              </div>
            );
          })}
          {!rows.length && <div className="dim small">No findings yet. Funded <Term id="agenda">agendas</Term> produce them.</div>}
        </div>
      </Card>
      <Card title={<Term id="umode">Failure-mode cards</Term>} sub="failure modes your research has uncovered" home="umodes">
        <div className="umode-grid">
          {sv.uModes.map((x) => {
            const TI = TRAIT_ICON[x.mapsTo];
            return (
              <div className="umode2" key={x.id}>
                <div className="row-i"><b>{x.name}</b><span className="sp" />{x.disclosed && <span className="tag2">public</span>}</div>
                <div className="small">{TI && <TI size={12} color={traitSev(x.mapsTo, 0.6)} />} shows as <Term id={`trait:${x.mapsTo}`}>{tname(x.mapsTo)}</Term></div>
                <div className="small dim">{x.source}</div>
              </div>
            );
          })}
          {!sv.uModes.length && <div className="dim small">None discovered</div>}
        </div>
      </Card>
    </div>
  );
}
