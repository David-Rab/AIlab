import { Check, Eye, EyeOff, Lock, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { CHINA_PRESETS, GOV_PRESETS, LAB_ARCHETYPES, PUBLIC_PRESETS } from '../data/actors';
import { BRANCH_LABEL, TECHS, TECH_BY_ID, type Branch, type TechDef } from '../data/techs';
import { TRAITS, TRAIT_BY_ID, VIRTUES } from '../data/traits';
import { MILESTONES, capIndex, horizonAt } from '../data/world';
import {
  alignEffort, activeTechs, canResearch, clarityOf, controlStrength, copiesOf, leadDays, misalignment, researchRate, speedOf,
} from '../engine/sim';
import { dateOf, fmtMonth } from '../engine/time';
import type { GameState, LogEntry } from '../engine/types';
import { Bipolar, KIND_COLOR, KIND_ICON, Meter, Rich, Row, Section, Soon, Spark, Term, Toggle, fmtB, fmtDays, fmtMinutes, fmtMult, fmtNum, fmtPct, fmtSigned } from './components';
import { store } from './store';
import { Tip, TipCard } from './Tooltip';

// ---------------- Overview ----------------

const START = Date.parse('2025-07-01T00:00:00Z');
const canonDay = (ym: string) => (Date.parse(ym + '-01T00:00:00Z') - START) / 86400000;

function RaceChart({ s }: { s: GameState }) {
  const W = 760;
  const H = 260;
  const pad = { l: 44, r: 12, t: 10, b: 22 };
  const maxDay = Math.max(s.day + 60, 365 * 2.6);
  const x = (d: number) => pad.l + (d / maxDay) * (W - pad.l - pad.r);
  const y = (ci: number) => H - pad.b - (ci / 6) * (H - pad.t - pad.b);
  const w = s.world;
  const line = (ps: number[]) => s.series.day.map((d, i) => `${x(d)},${y(capIndex(w, ps[i]))}`).join(' ');
  const cur = (p: number) => `${x(s.day)},${y(capIndex(w, p))}`;
  const canon = MILESTONES.map((m) => ({ d: Math.max(0, canonDay(m.canon)), i: m.idx }));
  const canonPts = canon.map((c, k) => (k === 0 ? `${x(0)},${y(0)}` : `${x(c.d)},${y(c.i - 1)} ${x(c.d)},${y(c.i)}`)).join(' ');
  const rival = s.labs.filter((l) => !l.absorbed).reduce((a, b) => (b.p > a.p ? b : a), s.labs[0]);
  const years: number[] = [];
  for (let yr = 2026; yr <= 2031; yr++) years.push((Date.parse(`${yr}-01-01T00:00:00Z`) - START) / 86400000);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      {MILESTONES.map((m) => (
        <g key={m.idx}>
          <line x1={pad.l} x2={W - pad.r} y1={y(m.idx)} y2={y(m.idx)} className="grid" />
          <text x={pad.l - 6} y={y(m.idx) + 4} className="axis" textAnchor="end">{m.short}</text>
        </g>
      ))}
      {years.filter((d) => d < maxDay).map((d) => (
        <g key={d}>
          <line x1={x(d)} x2={x(d)} y1={pad.t} y2={H - pad.b} className="grid" />
          <text x={x(d)} y={H - 6} className="axis" textAnchor="middle">{new Date(START + d * 86400000).getUTCFullYear()}</text>
        </g>
      ))}
      <polyline points={canonPts} className="canon-line" />
      <polyline points={`${line(s.series.pRival)} ${cur(rival?.p ?? 0)}`} stroke="var(--rival)" className="race" />
      <polyline points={`${line(s.series.pChina)} ${cur(s.china.p)}`} stroke="var(--china)" className="race" />
      <polyline points={`${line(s.series.pOB)} ${cur(s.p)}`} stroke="var(--accent)" className="race main" />
      <circle cx={x(s.day)} cy={y(capIndex(w, s.p))} r={3.5} fill="var(--accent)" />
    </svg>
  );
}

export function OverviewPanel({ s }: { s: GameState }) {
  const se = s.series;
  return (
    <div className="panel-grid">
      <Section title="The race" right={
        <span className="legend">
          <span><i style={{ background: 'var(--accent)' }} />{s.company.name}</span>
          <span><i style={{ background: 'var(--china)' }} />DeepCent</span>
          <span><i style={{ background: 'var(--rival)' }} />Best US rival</span>
          <Tip className="has-tip" content={() => <TipCard title="AI 2027 timeline">The dashed staircase is the original scenario: Agent-1 Jan 2026, SC Mar 2027, SAR Aug 2027, ASI Dec 2027. Your line diverges from it.</TipCard>}><span><i className="dashed" />AI 2027</span></Tip>
        </span>
      }>
        <RaceChart s={s} />
      </Section>
      <div className="kpis">
        <Kpi label="Cash" value={fmtB(s.company.cash)} data={se.cash} />
        <Kpi label="Revenue/yr" value={fmtB(s.company.revenueRun)} data={se.revenue} color="var(--pos)" />
        <Kpi label="R&D multiplier" value={fmtMult(s.rdMult)} data={se.mult} color="var(--violet)" log />
        <Kpi label="Approval" value={fmtSigned(s.pub.approval)} data={se.approval} color="var(--pub)" />
        <Kpi label="Misalignment (est.)" value={fmtPct(misalignment(s, true))} data={se.misalignEst} color="var(--neg)" />
      </div>
      <Section title="Milestones">
        <div className="milestones">
          {MILESTONES.map((m) => {
            const d = s.milestoneDays[m.idx];
            const reached = d !== undefined;
            return (
              <Tip key={m.idx} className={`milestone ${reached ? 'reached' : ''} ${s.model.milestone + 1 === m.idx ? 'next' : ''}`} content={() => <TipCard title={m.name} value={m.short}><p>{m.desc}</p><p className="dim">AI 2027: {m.canon}{reached ? ` · You: ${fmtMonth(dateOf(s, d))}` : ''}</p></TipCard>}>
                <span className="milestone-short">{m.short}</span>
                <span className="milestone-date num">{reached ? fmtMonth(dateOf(s, d)) : '—'}</span>
                <span className="milestone-canon dim num">{m.canon}</span>
              </Tip>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

function Kpi({ label, value, data, color, log }: { label: string; value: string; data: number[]; color?: string; log?: boolean }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value num">{value}</div>
      <Spark data={data.slice(-80)} color={color} log={log} w={130} />
    </div>
  );
}

// ---------------- Model (traits) ----------------

const TIER_LABEL = ['Roots', 'Tier 1', 'Tier 2', 'Tier 3', 'Tier 4', 'Tier 5'];
const CAT_COLOR: Record<string, string> = { honesty: 'var(--pub)', goals: 'var(--warn)', power: 'var(--neg)', hiding: 'var(--violet)', enabler: 'var(--accent)' };

function TraitTip({ s, id }: { s: GameState; id: string }) {
  const t = TRAIT_BY_ID[id];
  const st = s.model.traits[id];
  const { clarity } = clarityOf(s, id);
  const counters = activeTechs(s).filter((x) => x.counters?.[id] || x.masks?.[id]);
  const detectors = activeTechs(s).filter((x) => x.detects?.[id]);
  const needs = [...(t.needsAll ?? []).map((n) => TRAIT_BY_ID[n].name), ...((t.needsAny ?? []).length ? [`one of ${t.needsAny!.map((n) => TRAIT_BY_ID[n].name).join(' / ')}`] : [])];
  return (
    <TipCard title={t.name} value={`${fmtPct(st.est)} ± ${fmtPct(st.sigma)}`} rows={[
      { label: 'Category', value: t.category },
      { label: 'Severity', value: t.severity <= 0 ? (t.severity < 0 ? 'protective' : 'enabler') : '●'.repeat(t.severity) },
      { label: <Term id="detection">Detection clarity</Term>, value: fmtPct(clarity), tone: clarity < 0.3 ? 'neg' : undefined },
      { label: 'Countered by', value: counters.length ? counters.map((c) => c.name).join(', ') : 'nothing', tone: counters.length ? 'pos' : 'neg' },
      { label: 'Detected by', value: detectors.length ? detectors.map((c) => c.name).join(', ') : 'incidents only' },
      ...(needs.length ? [{ label: 'Needs', value: needs.join(' + ') }] : []),
      ...((t.minCap ?? 0) > 0 ? [{ label: 'Appears from', value: MILESTONES[t.minCap!].short }] : []),
    ]} footer={t.basis}>
      <p>{t.desc}</p>
      <p className="dim">Driven by: {Object.keys(t.drivers).join(', ') || 'training choices'}</p>
    </TipCard>
  );
}

function TraitCard({ s, id }: { s: GameState; id: string }) {
  const t = TRAIT_BY_ID[id];
  const st = s.model.traits[id];
  const { clarity } = clarityOf(s, id);
  const locked = (t.minCap ?? 0) > s.model.milestone;
  const color = st.est > 0.5 ? 'var(--neg)' : st.est > 0.25 ? 'var(--warn)' : CAT_COLOR[t.category];
  return (
    <Tip as="div" className={`trait ${locked ? 'locked' : ''}`} content={() => <TraitTip s={s} id={id} />}>
      <div className="trait-head">
        <span className="trait-cat" style={{ background: CAT_COLOR[t.category] }} />
        <span className="trait-name">{t.name}</span>
        {clarity > 0.5 ? <Eye size={12} className="dim" /> : <EyeOff size={12} className="dim" />}
      </div>
      <Meter value={st.est} max={1} sigma={st.sigma} color={color} />
      <div className="trait-foot num">{locked ? `from ${MILESTONES[t.minCap!].short}` : `${fmtPct(st.est)} ±${fmtPct(st.sigma)}`}</div>
    </Tip>
  );
}

export function ModelPanel({ s }: { s: GameState }) {
  const ms = MILESTONES[s.model.milestone];
  const tiers = [0, 1, 2, 3, 4, 5];
  return (
    <div className="panel-grid">
      <div className="model-head">
        <div>
          <div className="model-name">{s.model.name}</div>
          <div className="dim">{ms.label} · <Term id="horizon">horizon</Term> {fmtMinutes(horizonAt(s.world, s.p))} · {fmtNum(copiesOf(s))} copies × {speedOf(s).toFixed(0)}x</div>
        </div>
        <div className="model-stats">
          <Row label={<Term id="misalign" />}><span className="num">{fmtPct(misalignment(s, true))}</span></Row>
          <Row label={<Term id="alignEffort" />}><span className="num">x{alignEffort(s).toFixed(2)}</span></Row>
          <Row label={<Term id="control" />}><span className="num">{fmtPct(controlStrength(s))}</span></Row>
        </div>
      </div>
      <div className="dim small"><Rich text="[[traits]]. Bars are [[estimate|estimates]] with uncertainty; the truth may differ. [[mask|Masked]] traits look fixed when they are not." /></div>
      <div className="trait-tiers">
        {tiers.map((tier) => {
          const list = TRAITS.filter((t) => t.tier === tier && !VIRTUES.includes(t.id));
          if (!list.length) return null;
          return (
            <div key={tier} className="trait-tier">
              <div className="tier-label">{TIER_LABEL[tier]}</div>
              <div className="tier-row">{list.map((t) => <TraitCard key={t.id} s={s} id={t.id} />)}</div>
            </div>
          );
        })}
        <div className="trait-tier">
          <div className="tier-label tone-pos">Protective</div>
          <div className="tier-row">{VIRTUES.map((id) => <TraitCard key={id} s={s} id={id} />)}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Research ----------------

const BRANCHES: Branch[] = ['align', 'oversight', 'detect', 'control', 'gov', 'security'];

function TechTip({ s, t }: { s: GameState; t: TechDef }) {
  const st = s.techs[t.id];
  const list = (r?: Record<string, number>) => (r ? Object.entries(r).map(([k, v]) => `${TRAIT_BY_ID[k]?.name ?? k} ${Math.round(v * 100)}`).join(', ') : '');
  const rows = [
    ...(t.counters ? [{ label: 'Reduces', value: list(t.counters), tone: 'pos' as const }] : []),
    ...(t.masks ? [{ label: 'Masks', value: list(t.masks), tone: 'neg' as const }] : []),
    ...(t.grows ? [{ label: 'Grows', value: list(t.grows), tone: 'pos' as const }] : []),
    ...(t.detects ? [{ label: `Detects (${t.detectKind})`, value: list(t.detects) }] : []),
    ...(t.control ? [{ label: 'Contains incidents', value: fmtPct(t.control) }] : []),
    ...(t.tax?.rd ? [{ label: 'R&D slowdown', value: `−${fmtPct(t.tax.rd)}`, tone: 'neg' as const }] : []),
    ...(t.tax?.compute ? [{ label: 'Compute overhead', value: fmtPct(t.tax.compute, 1), tone: 'neg' as const }] : []),
    ...(t.tax?.cashPerMonth ? [{ label: 'Cost / mo', value: fmtB(t.tax.cashPerMonth / 1000), tone: 'neg' as const }] : []),
    ...(t.prereqs.length ? [{ label: 'Requires', value: t.prereqs.map((p) => TECH_BY_ID[p].name).join(', ') }] : []),
    ...((t.minCap ?? 0) > 0 ? [{ label: 'Available from', value: MILESTONES[t.minCap!].short }] : []),
    { label: 'Cost', value: st.done ? 'done' : `${Math.round(st.progress)} / ${t.cost} RP` },
  ];
  return (
    <TipCard title={t.name} value={BRANCH_LABEL[t.branch]} rows={rows} footer={t.basis}>
      <p>{t.desc}</p>
      <p className="tone-warn">{t.limits}</p>
      {t.trainable && <p className="dim">Can be used as a training signal. Doing so mostly <Term id="mask">masks</Term> the traits it detects.</p>}
    </TipCard>
  );
}

export function ResearchPanel({ s }: { s: GameState }) {
  const act = store.act.bind(store);
  const queue = s.researchQueue.filter((id) => !s.techs[id].done);
  const toggleQueue = (id: string) =>
    act((st) => {
      st.researchQueue = st.researchQueue.includes(id) ? st.researchQueue.filter((x) => x !== id) : [...st.researchQueue, id];
    });
  return (
    <div className="panel-grid">
      <div className="research-head">
        <span>Safety research <span className="num tone-pos">{researchRate(s).toFixed(1)} RP/day</span></span>
        <div className="queue">
          {queue.length === 0 && <span className="dim">Queue empty: click a technique to queue it.</span>}
          {queue.map((id, i) => (
            <span key={id} className={`queue-item ${i === 0 ? 'first' : ''}`}>
              {i > 0 && <button className="mini" title="Move to front" onClick={() => act((st) => { st.researchQueue = [id, ...st.researchQueue.filter((x) => x !== id)]; })}>↑</button>}
              {TECH_BY_ID[id].name}
              <span className="num dim"> {Math.round((s.techs[id].progress / TECH_BY_ID[id].cost) * 100)}%</span>
              <button className="mini" onClick={() => toggleQueue(id)}><X size={10} /></button>
            </span>
          ))}
        </div>
      </div>
      <div className="tree">
        {BRANCHES.map((b) => (
          <div key={b} className="branch">
            <div className="branch-label">{BRANCH_LABEL[b]}</div>
            {TECHS.filter((t) => t.branch === b).map((t) => {
              const st = s.techs[t.id];
              const avail = canResearch(s, t.id);
              const queued = queue.includes(t.id);
              const cls = st.done ? (st.active ? 'done' : 'off') : avail ? 'avail' : 'locked';
              return (
                <Tip key={t.id} as="div" className={`tech ${cls} ${queued ? 'queued' : ''}`} content={() => <TechTip s={s} t={t} />}>
                  <div className="tech-row" onClick={() => !st.done && (avail || queued) && toggleQueue(t.id)}>
                    {st.done ? <Check size={12} /> : avail ? <Plus size={12} /> : <Lock size={12} />}
                    <span className="tech-name">{t.name}</span>
                    {!st.done && <span className="num dim">{t.cost}</span>}
                  </div>
                  {!st.done && st.progress > 0 && <Meter value={st.progress} max={t.cost} color="var(--pos)" />}
                  {st.done && (
                    <div className="tech-ctrl">
                      <Toggle on={st.active} onChange={(v) => act((x) => { x.techs[t.id].active = v; })} label={st.active ? 'On' : 'Off'} />
                      {t.trainable && (
                        <Toggle on={st.trainAgainst} onChange={(v) => act((x) => { x.techs[t.id].trainAgainst = v; })} label="Train vs" />
                      )}
                    </div>
                  )}
                </Tip>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- World ----------------

const G_SEC = ['Business as usual', 'Security clauses', 'Embedded officials', 'Clearances', 'Wiretaps + DPA plans', 'Oversight Committee'];
const G_CHN = ['Transactional controls', 'Tightening', 'Cyber retaliation', 'Full denial', 'Military planning'];
const C_CEN = ['Fragmented market', 'Talent controls', 'National champion (CDZ)', 'Hardened CDZ', 'War footing'];
const P_ACT = ['Online grumbling', 'Local NIMBY', 'Protests', 'Mass movement', 'Radical fringe'];

function Ladder({ steps, rung }: { steps: string[]; rung: number }) {
  return (
    <div className="ladder">
      {steps.map((st, i) => <Tip key={i} className={`rung ${i <= rung ? 'on' : ''}`} content={() => <TipCard title={st} value={`${i}/${steps.length - 1}`} />}><span /></Tip>)}
      <span className="ladder-label">{steps[rung]}</span>
    </div>
  );
}

function profile<T extends { id: string; name: string; desc: string }>(s: GameState, choice: string, list: T[], id: string) {
  const p = list.find((x) => x.id === id);
  if (choice === 'realistic' && s.day < 180) return { name: 'Assessing…', desc: 'Profile becomes clear after ~6 months of observation.' };
  return { name: p?.name ?? id, desc: p?.desc ?? '' };
}

function M({ label, value, max = 100, color, tip }: { label: string; value: number; max?: number; color?: string; tip?: string }) {
  return (
    <Row label={label} tip={tip ? () => <TipCard title={label}>{tip}</TipCard> : undefined}>
      <Meter value={value} max={max} color={color} width={90} /> <span className="num meter-num">{value.toFixed(0)}</span>
    </Row>
  );
}

export function WorldPanel({ s }: { s: GameState }) {
  const g = s.gov;
  const pb = s.pub;
  const ch = s.china;
  const gp = profile(s, s.setup.gov, GOV_PRESETS, g.preset);
  const pp = profile(s, s.setup.public, PUBLIC_PRESETS, pb.preset);
  const cp = profile(s, s.setup.china, CHINA_PRESETS, ch.preset);
  return (
    <div className="world">
      <Section title="US Government" right={<Tip className="profile" content={() => <TipCard title={gp.name}>{gp.desc}</TipCard>}>{gp.name}</Tip>}>
        <Ladder steps={G_SEC} rung={g.rung} />
        <M label="AI priority" value={g.priority} color="var(--gov)" />
        <M label="Trust in you" value={g.trust} color="var(--pos)" />
        <M label="Security demand" value={g.securityDemand} color="var(--warn)" />
        <M label="Nationalization" value={g.nationalization} color="var(--neg)" />
        <M label="Awareness" value={g.awareness} tip="How much the government knows about your real capabilities. Set by briefing policy and leaks." />
        <Row label="Regulation stance"><Bipolar value={g.regStance} /> <span className="num meter-num">{fmtSigned(g.regStance)}</span></Row>
        <M label="China hawkishness" value={g.hawkish} color="var(--china)" />
        <Ladder steps={G_CHN} rung={g.chinaRung} />
      </Section>
      <Section title="US Public" right={<Tip className="profile" content={() => <TipCard title={pp.name}>{pp.desc}</TipCard>}>{pp.name}</Tip>}>
        <Ladder steps={P_ACT} rung={pb.rung} />
        <Row label={<Term id="approval" />}><Bipolar value={pb.approval} /> <span className="num meter-num">{fmtSigned(pb.approval)}</span></Row>
        <M label="AI concern" value={pb.concern} color="var(--warn)" />
        <M label="Job anxiety" value={pb.jobAnxiety} color="var(--warn)" />
        <M label="X-risk fear" value={pb.xrisk} color="var(--neg)" />
        <M label="Importance" value={pb.salience} max={45} tip="% naming AI the top national problem." />
        <M label="Activism" value={pb.activism} color="var(--pub)" />
        <Row label="Unemployment shock"><span className="num">+{pb.unemploymentShock.toFixed(1)} pts</span></Row>
      </Section>
      <Section title="China · DeepCent" right={<Tip className="profile" content={() => <TipCard title={cp.name}>{cp.desc}</TipCard>}>{cp.name}</Tip>}>
        <Ladder steps={C_CEN} rung={ch.rung} />
        <Row label={<Term id="lead">Your lead</Term>}><span className="num">{fmtDays(leadDays(s, ch.p))}</span></Row>
        <M label="Compute share" value={ch.computeShare * 100} max={30} color="var(--china)" />
        <M label="Centralization (CDZ)" value={ch.centralization} color="var(--china)" />
        <M label="Espionage readiness" value={ch.espionage} color="var(--neg)" />
        <M label="Spies in your lab" value={ch.spies} max={20} color="var(--neg)" tip="Expected number of compromised employees with privileged access (AI 2027: 0.5-1% of privileged staff)." />
        <M label="Taiwan tension" value={ch.taiwan} color="var(--neg)" />
        <M label="Diplomatic openness" value={ch.diplomacy} color="var(--pos)" />
        <Row label="Weights stolen"><span className={ch.stoleWeights ? 'tone-neg' : ''}>{ch.stoleWeights ? 'Yes' : 'No'}</span></Row>
      </Section>
      <Section title="US Rivals">
        <table className="tbl">
          <thead><tr><th>Lab</th><th>Profile</th><th>Lead</th><th>Compute</th><th>Safety</th></tr></thead>
          <tbody>
            {s.labs.map((l) => {
              const a = profile(s, s.setup.rivals, LAB_ARCHETYPES, l.archetype);
              return (
                <tr key={l.id} className={l.absorbed ? 'dim' : ''}>
                  <td>{l.name}</td>
                  <td><Tip className="has-tip" content={() => <TipCard title={a.name}>{a.desc}</TipCard>}>{a.name}</Tip></td>
                  <td className="num">{l.absorbed ? 'merged' : fmtDays(leadDays(s, l.p))}</td>
                  <td className="num">{fmtPct(l.computeShare, 1)}</td>
                  <td className="num">{l.safety}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Section>
      <Section title="Interest groups"><div className="dim">Safety advocates, accelerationists, labor, natsec, parents… <Soon label="to come" /></div></Section>
      <Section title="Allies"><div className="dim">EU, UK, Taiwan, Five Eyes, Gulf. <Soon label="to come" /></div></Section>
    </div>
  );
}

// ---------------- Log ----------------

const LOG_KINDS: LogEntry['kind'][] = ['milestone', 'incident', 'alert', 'gov', 'china', 'public', 'rival', 'company', 'research', 'news'];

export function LogPanel({ s }: { s: GameState }) {
  const [filter, setFilter] = useState<string>('all');
  const items = s.log.filter((e) => filter === 'all' || e.kind === filter).slice().reverse();
  return (
    <div className="panel-grid">
      <div className="seg">
        {['all', ...LOG_KINDS].map((k) => (
          <button key={k} className={`seg-btn ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{k}</button>
        ))}
      </div>
      <div className="log">
        {items.map((e, i) => {
          const Icon = KIND_ICON[e.kind];
          return (
            <div key={i} className="log-item">
              <span className="num dim">{fmtMonth(dateOf(s, e.day))}</span>
              {Icon && <Icon size={13} style={{ color: KIND_COLOR[e.kind] }} />}
              <span>{e.text}</span>
              {e.canon && <span className="canon">AI27 {e.canon}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
