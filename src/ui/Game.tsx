import { Banknote, Brain, Building2, ChevronsRight, Cpu, Flag, Gauge, Home, Landmark, Pause, Play, Save, ShieldAlert, Swords, TrendingUp, Users } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { CHINA_PRESETS, GOV_PRESETS, LAB_ARCHETYPES, PUBLIC_PRESETS } from '../data/actors';
import { TRAIT_BY_ID } from '../data/traits';
import { MILESTONES, horizonAt, milestoneThresholds } from '../data/world';
import { EVENT_BY_ID, release } from '../engine/events';
import { clamp } from '../engine/rng';
import {
  alignEffort, bestRival, computeCapped, copiesOf, leadDays, misalignment, monthlyCosts, monthlyOrder, revenueTarget, revenueTargetIf, progressBreakdown, revenuePerH100eYear, securityTarget, speedOf, worldCompute,
} from '../engine/sim';
import { dateOf, fmtDate, fmtMonth } from '../engine/time';
import type { GameState } from '../engine/types';
import { KIND_COLOR, KIND_ICON, Meter, Row, Section, Seg, Slider, Term, Toggle, fmtB, fmtDays, fmtMinutes, fmtMult, fmtNum, fmtPct, fmtSigned } from './components';
import { LogPanel, ModelPanel, OverviewPanel, ResearchPanel, WorldPanel } from './Panels';
import { store, useGame } from './store';
import { Tip, TipCard } from './Tooltip';

export function GameScreen() {
  const s = useGame();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        store.togglePause();
      }
      if (/^Digit[1-5]$/.test(e.code)) store.setSpeed(Number(e.code.slice(5)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (!s) return null;
  return (
    <div className="game">
      <TopBar s={s} />
      <div className="game-body">
        <StrategyPanel s={s} />
        <main className="main">
          <Tabs />
          <div className="main-content">
            {store.panel === 'overview' && <OverviewPanel s={s} />}
            {store.panel === 'model' && <ModelPanel s={s} />}
            {store.panel === 'research' && <ResearchPanel s={s} />}
            {store.panel === 'world' && <WorldPanel s={s} />}
            {store.panel === 'log' && <LogPanel s={s} />}
          </div>
        </main>
        <NewsFeed s={s} />
      </div>
      {s.events.length > 0 && <EventModal s={s} />}
      {s.ending && <EndingScreen s={s} />}
    </div>
  );
}

// ---------------- Top bar ----------------

function Stat({ icon, label, value, tone, tip }: { icon: ReactNode; label: string; value: ReactNode; tone?: string; tip: () => ReactNode }) {
  return (
    <Tip className="stat" content={tip}>
      <span className="stat-icon">{icon}</span>
      <span className="stat-text">
        <span className="stat-label">{label}</span>
        <span className={`stat-value num ${tone ?? ''}`}>{value}</span>
      </span>
    </Tip>
  );
}

function Trend({ now, target }: { now: number; target: number }) {
  if (Math.abs(target - now) / Math.max(1, now) < 0.03) return null;
  return <span className={target > now ? 'tone-pos' : 'tone-neg'}>{target > now ? '▲' : '▼'}</span>;
}

function TopBar({ s }: { s: GameState }) {
  const c = s.company;
  const costs = monthlyCosts(s);
  const net = c.revenueRun / 12 - costs.total;
  const pb = progressBreakdown(s);
  const chinaLead = leadDays(s, s.china.p);
  const rival = bestRival(s);
  const rivalLead = rival ? leadDays(s, rival.p) : 0;
  const ms = MILESTONES[s.model.milestone];
  const mis = misalignment(s, true);
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="btn btn-ghost btn-icon" title="Menu (autosaves)" onClick={() => { store.save(); store.go('start'); }}>
          <Home size={16} />
        </button>
        <div className="date num">{fmtDate(dateOf(s))}</div>
        <div className="speeds">
          <button className={`btn btn-icon ${store.speed === 0 ? 'active' : ''}`} title="Pause (Space)" onClick={() => store.togglePause()}>
            {store.speed === 0 ? <Play size={14} /> : <Pause size={14} />}
          </button>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className={`speed-pip ${store.speed >= n ? 'on' : ''}`} title={`Speed ${n} (${n})`} onClick={() => store.setSpeed(n)} />
          ))}
        </div>
      </div>
      <div className="topbar-stats">
        <Stat icon={<Banknote size={15} />} label="Cash" value={fmtB(c.cash)} tone={c.cash < 5 ? 'tone-neg' : ''} tip={() => (
          <TipCard title="Cash" value={fmtB(c.cash)} rows={[
            { label: 'Revenue / mo', value: fmtB(c.revenueRun / 12), tone: 'pos' },
            { label: 'Compute / mo', value: `−${fmtB(costs.computeCost)}`, tone: 'neg' },
            { label: 'New capacity deposits', value: `−${fmtB(costs.orders)}`, tone: 'neg' },
            { label: 'Staff', value: `−${fmtB(costs.staffCost)}`, tone: 'neg' },
            { label: 'Security', value: `−${fmtB(costs.security)}`, tone: 'neg' },
            { label: 'Safety programs', value: `−${fmtB(costs.taxes)}`, tone: 'neg' },
            { label: 'PR', value: `−${fmtB(costs.pr)}`, tone: 'neg' },
            { label: 'Net / mo', value: fmtB(net), tone: net >= 0 ? 'pos' : 'neg' },
          ]} footer="Below −$5B the company fails. Raise capital from the Strategy panel." />
        )} />
        <Stat icon={<TrendingUp size={15} />} label="Revenue" value={<>{fmtB(c.revenueRun)}/yr <Trend now={c.revenueRun} target={revenueTarget(s)} /></>} tip={() => (
          <TipCard title="Revenue run-rate" value={fmtB(c.revenueRun)} rows={[
            { label: 'Heading to', value: fmtB(revenueTarget(s)), tone: revenueTarget(s) >= c.revenueRun ? 'pos' : 'neg' },
            { label: 'Product compute', value: fmtNum(c.compute * s.allocation.product) },
            { label: 'Value per H100e-yr', value: `$${fmtNum(revenuePerH100eYear(s))}` },
            { label: <>Sold model (<Term id="publicModel" />)</>, value: s.model.publicName },
            { label: 'Valuation', value: fmtB(c.valuation) },
          ]} footer="AI 2027: $12B (Aug 2025) → $55B (Dec 2026) → $191B (Oct 2027)." />
        )} />
        <Stat icon={<Cpu size={15} />} label="Compute" value={fmtNum(c.compute)} tip={() => (
          <TipCard title={<Term id="h100e">Compute (H100e)</Term>} value={fmtNum(c.compute)} rows={[
            { label: 'Share of world', value: fmtPct(c.compute / worldCompute(s), 1) },
            { label: 'World AI compute', value: fmtNum(worldCompute(s)) },
            { label: 'In pipeline', value: fmtNum(c.pipeline.reduce((a, o) => a + o.amount, 0)) },
          ]} footer="AI 2027: leading lab ~20% of world compute by 2027." />
        )} />
        <Stat icon={<Gauge size={15} />} label="R&D" value={fmtMult(s.rdMult)} tip={() => (
          <TipCard title={<Term id="rdmult" />} value={fmtMult(s.rdMult)} rows={[
            { label: 'Progress speed', value: `${pb.rate.toFixed(2)} yr/yr` },
            { label: 'Compute factor', value: `x${pb.computeFactor.toFixed(2)}`, tone: pb.computeFactor >= 1 ? 'pos' : 'neg' },
            { label: 'Talent factor', value: `x${pb.talentFactor.toFixed(2)}` },
            { label: 'Safety tax', value: `x${pb.taxFactor.toFixed(2)}`, tone: pb.taxFactor < 1 ? 'neg' : undefined },
            { label: <Term id="neuralese" />, value: `x${pb.neuralese.toFixed(2)}` },
            { label: 'Siloing', value: `x${pb.silo.toFixed(2)}` },
            { label: 'Copies x speed', value: `${fmtNum(copiesOf(s))} x ${speedOf(s).toFixed(0)}` },
          ]} />
        )} />
        <Stat icon={<Brain size={15} />} label={s.model.name} value={ms.short} tip={() => (
          <TipCard title={`${s.model.name} · ${ms.name}`} value={ms.label}>
            <p>{ms.desc}</p>
            <div className="tipcard-rows">
              <div className="tipcard-row"><span><Term id="horizon" /></span><span>{fmtMinutes(horizonAt(s.world, s.p))}</span></div>
              <div className="tipcard-row"><span>Next milestone</span><span>{MILESTONES[s.model.milestone + 1]?.short ?? '—'}</span></div>
              <div className="tipcard-row"><span>AI 2027 date</span><span>{ms.canon}</span></div>
            </div>
          </TipCard>
        )} />
        <Stat icon={<Flag size={15} />} label="vs China" value={fmtDays(chinaLead)} tone={chinaLead < 60 ? 'tone-neg' : ''} tip={() => (
          <TipCard title={<Term id="lead">Lead over DeepCent</Term>} value={fmtDays(chinaLead)} rows={[
            { label: 'China compute share', value: fmtPct(s.china.computeShare) },
            { label: <Term id="cdz">Centralized (CDZ)</Term>, value: `${s.china.centralization.toFixed(0)}%` },
            { label: 'Weights stolen', value: s.china.stoleWeights ? 'Yes' : 'No', tone: s.china.stoleWeights ? 'neg' : undefined },
          ]} footer="AI 2027: ~6 months in 2026, ~2 months after the theft." />
        )} />
        <Stat icon={<Swords size={15} />} label="vs Rivals" value={fmtDays(rivalLead)} tone={rivalLead < 30 ? 'tone-neg' : ''} tip={() => (
          <TipCard title="Lead over best US rival" value={rival?.name}>{fmtDays(rivalLead)}</TipCard>
        )} />
        <Stat icon={<Users size={15} />} label="Approval" value={fmtSigned(s.pub.approval)} tone={s.pub.approval < -30 ? 'tone-neg' : ''} tip={() => (
          <TipCard title={<Term id="approval" />} value={fmtSigned(s.pub.approval)} rows={[
            { label: 'AI concern', value: `${s.pub.concern.toFixed(0)}%` },
            { label: 'Job anxiety', value: `${s.pub.jobAnxiety.toFixed(0)}%` },
            { label: <Term id="salience" />, value: `${s.pub.salience.toFixed(1)}%` },
          ]} />
        )} />
        <Stat icon={<Landmark size={15} />} label="Gov trust" value={s.gov.trust.toFixed(0)} tone={s.gov.trust < 30 ? 'tone-neg' : ''} tip={() => (
          <TipCard title="Government trust" value={s.gov.trust.toFixed(0)} rows={[
            { label: 'Security demand', value: s.gov.securityDemand.toFixed(0) },
            { label: 'Nationalization pressure', value: s.gov.nationalization.toFixed(0), tone: s.gov.nationalization > 50 ? 'neg' : undefined },
            { label: <Term id="oversight" />, value: s.gov.oversight ? 'Active' : 'No' },
          ]} />
        )} />
        <Stat icon={<ShieldAlert size={15} />} label="Misalignment" value={fmtPct(mis)} tone={mis > 0.3 ? 'tone-neg' : mis > 0.15 ? 'tone-warn' : 'tone-pos'} tip={() => (
          <TipCard title={<Term id="misalign" />} value={`${fmtPct(mis)} est.`}>
            <p>Your estimate, not the truth. See the Model tab.</p>
            <p><Term id="alignEffort" />: x{alignEffort(s).toFixed(2)}</p>
          </TipCard>
        )} />
      </div>
      <button className="btn btn-ghost btn-icon" title="Save" onClick={() => store.save()}>
        <Save size={16} />
      </button>
    </header>
  );
}

function Tabs() {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'model', label: 'Model' },
    { id: 'research', label: 'Research' },
    { id: 'world', label: 'World' },
    { id: 'log', label: 'Log' },
  ];
  return (
    <nav className="tabs">
      {tabs.map((t) => (
        <button key={t.id} className={`tab ${store.panel === t.id ? 'active' : ''}`} onClick={() => store.setPanel(t.id)}>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

// ---------------- Strategy panel ----------------

type AllocKey = keyof GameState['allocation'];
type StaffKey = keyof GameState['staffSplit'];

function setShare<K extends string>(obj: Record<K, number>, key: K, v: number) {
  const keys = Object.keys(obj) as K[];
  const others = keys.filter((k) => k !== key);
  const rest = others.reduce((a, k) => a + obj[k], 0);
  v = clamp(v, 0, 0.95);
  const remain = 1 - v;
  for (const k of others) obj[k] = rest > 0 ? (obj[k] / rest) * remain : remain / others.length;
  obj[key] = v;
}

const ALLOC: { k: AllocKey; label: string; color: string; tip: string }[] = [
  { k: 'capabilities', label: 'Capabilities', color: 'var(--accent)', tip: 'Training, synthetic data, experiments, AI researchers. Drives progress. AI 2027: ~60-80%.' },
  { k: 'alignment', label: 'Alignment', color: 'var(--violet)', tip: 'Safety research, detection and alignment training. AI 2027 race: ~1-3%. Slowdown: up to 40%.' },
  { k: 'product', label: 'Product', color: 'var(--pos)', tip: 'Serving customers. Drives revenue and job disruption. AI 2027: ~30% falling to ~13%.' },
  { k: 'security', label: 'Security', color: 'var(--warn)', tip: 'Monitoring, isolation, insider-threat programs. Raises your security level.' },
];
const STAFF: { k: StaffKey; label: string; color: string }[] = [
  { k: 'capabilities', label: 'Capabilities', color: 'var(--accent)' },
  { k: 'alignment', label: 'Safety', color: 'var(--violet)' },
  { k: 'security', label: 'Security', color: 'var(--warn)' },
];

function StrategyPanel({ s }: { s: GameState }) {
  const c = s.company;
  const act = store.act.bind(store);
  const canRaise = s.day - c.lastRaiseDay >= 120;
  const raise = c.valuation * 0.08 * clamp(c.boardConfidence / 70, 0.4, 1.2);
  const gap = s.p - s.model.publicP;
  return (
    <aside className="strategy">
      <Section title="Compute" right={<span className="dim num">{fmtNum(c.compute)}</span>}>
        <div className="stack-bar">
          {ALLOC.map((a) => <div key={a.k} style={{ width: fmtPct(s.allocation[a.k], 1), background: a.color }} />)}
        </div>
        {ALLOC.map((a) => (
          <div key={a.k} className="alloc-row">
            <Tip className="alloc-label has-tip" content={() => <TipCard title={a.label} value={fmtNum(c.compute * s.allocation[a.k])}>{a.tip}</TipCard>}>
              <span className="dot" style={{ background: a.color }} />
              {a.label}
            </Tip>
            <Slider value={s.allocation[a.k]} min={0} max={0.9} step={0.005} width={96} onChange={(v) => act((st) => setShare(st.allocation, a.k, v))} />
            <span className="num alloc-val">{fmtPct(s.allocation[a.k])}</span>
          </div>
        ))}
      </Section>
      <Section title="Staff" right={<span className="dim num">{fmtNum(c.staff)}</span>}>
        {STAFF.map((a) => (
          <div key={a.k} className="alloc-row">
            <span className="alloc-label"><span className="dot" style={{ background: a.color }} />{a.label}</span>
            <Slider value={s.staffSplit[a.k]} min={0} max={0.9} step={0.01} width={96} onChange={(v) => act((st) => setShare(st.staffSplit, a.k, v))} />
            <span className="num alloc-val">{fmtPct(s.staffSplit[a.k])}</span>
          </div>
        ))}
      </Section>
      <Section title="Growth">
        <div className="alloc-row">
          <Tip className="alloc-label has-tip" content={() => <TipCard title="Compute expansion" value={`+${fmtNum(monthlyOrder(s))}/mo`}>Target growth per year. Orders arrive after ~6 months; 25% deposit up front. Capped at 35% of world supply, with a price premium above 20%. AI 2027 leader: ~3.4x/yr.{computeCapped(s) ? ' You are at the cap: more expansion does nothing.' : ''}</TipCard>}>Expansion</Tip>
          <Slider value={s.policies.expansion} min={0} max={4} step={0.1} width={96} onChange={(v) => act((st) => { st.policies.expansion = v; })} />
          <span className={`num alloc-val ${computeCapped(s) && s.policies.expansion > 0 ? 'tone-warn' : ''}`}>{computeCapped(s) && s.policies.expansion > 0 ? 'cap' : `+${Math.round(s.policies.expansion * 100)}%`}</span>
        </div>
        <div className="alloc-row">
          <span className="alloc-label">Hires/mo</span>
          <Slider value={s.policies.hiringPerMonth} min={0} max={600} step={10} width={96} onChange={(v) => act((st) => { st.policies.hiringPerMonth = v; })} />
          <span className="num alloc-val">{s.policies.hiringPerMonth}</span>
        </div>
        <Tip as="div" content={() => <TipCard title="Raise capital" value={fmtB(raise)} rows={[{ label: 'Valuation', value: fmtB(c.valuation) }, { label: 'Board confidence', value: c.boardConfidence.toFixed(0) }]} footer="Once every 4 months. Dilutes; board confidence −3." />}>
          <button className="btn btn-sm full" disabled={!canRaise} onClick={() => act((st) => { st.company.cash += raise; st.company.lastRaiseDay = st.day; st.company.boardConfidence -= 3; })}>
            Raise {fmtB(raise)} {canRaise ? '' : `· ${120 - (s.day - c.lastRaiseDay)}d`}
          </button>
        </Tip>
      </Section>
      <Section title="Model" right={<span className="dim">{s.model.publicName} public</span>}>
        <Row label="Public lags internal by"><span className="num">{fmtDays(Math.max(0, leadDays(s, s.model.publicP)))}</span></Row>
        <div className="btn-row">
          <Tip content={() => <ReleaseTip s={s} frac={1} title={`Release ${s.model.name}`} body="Ship your internal frontier. Revenue up; rivals and China can distill it; job disruption grows." />}>
            <button className="btn btn-sm" disabled={gap < 0.01} onClick={() => act((st) => release(st, 0))}>Release</button>
          </Tip>
          <Tip content={() => <ReleaseTip s={s} frac={0.7} title="Release mini" body="A cheaper distilled version, ~70% of the way to your frontier. Keeps most of your lead." />}>
            <button className="btn btn-sm" disabled={gap < 0.01} onClick={() => act((st) => release(st, 0.3))}>Release mini</button>
          </Tip>
        </div>
        <Row label="Pause frontier R&D" tip={() => <TipCard title="Pause">Progress drops to 5%. Board confidence falls. Gives safety research time.</TipCard>}>
          <Toggle on={!!s.flags.paused} onChange={(v) => act((st) => { st.flags.paused = v; })} />
        </Row>
        {!!s.flags.neuraleseFound && (
          <Row label={<Term id="neuralese" />}>
            <Toggle on={s.policies.neuralese} onChange={(v) => act((st) => { st.policies.neuralese = v; })} />
          </Row>
        )}
      </Section>
      <Section title="Policy">
        <Row label="Brief government">
          <Seg value={s.policies.govBriefing} options={[{ v: 0, label: 'Hide' }, { v: 1, label: 'Min' }, { v: 2, label: 'Brief' }, { v: 3, label: 'Full' }]} onChange={(v) => act((st) => { st.policies.govBriefing = v; })} />
        </Row>
        <Row label="Lobbying">
          <Seg value={s.policies.lobbying} options={[{ v: -1, label: 'Dereg' }, { v: 0, label: 'None' }, { v: 1, label: 'Safety' }]} onChange={(v) => act((st) => { st.policies.lobbying = v; })} />
        </Row>
        <Row label="Siloing" tip={() => <TipCard title="Access siloing">Fewer people with access to weights and secrets: fewer spies, slower research. AI 2027: 2,000 → 200 after the theft.</TipCard>}>
          <Seg value={s.policies.siloing} options={[{ v: 0, label: 'Open' }, { v: 1, label: 'Need' }, { v: 2, label: 'Strict' }]} onChange={(v) => act((st) => { st.policies.siloing = v; })} />
        </Row>
        <div className="alloc-row">
          <span className="alloc-label">PR $/mo</span>
          <Slider value={s.policies.prPerMonth} min={0} max={2} step={0.05} width={96} onChange={(v) => act((st) => { st.policies.prPerMonth = v; })} />
          <span className="num alloc-val">{fmtB(s.policies.prPerMonth)}</span>
        </div>
        <Row label="Whistleblower protection" tip={() => <TipCard title="Whistleblower protection">Concerns go to the board and regulators instead of the press. Fewer damaging leaks; more government scrutiny.</TipCard>}>
          <Toggle on={s.policies.whistleblowerProtection} onChange={(v) => act((st) => { st.policies.whistleblowerProtection = v; })} />
        </Row>
        <Row label="Open-source old models">
          <Toggle on={s.policies.openWeightsOld} onChange={(v) => act((st) => { st.policies.openWeightsOld = v; })} />
        </Row>
        <Row label="Military work">
          <Toggle on={s.policies.militaryWork} onChange={(v) => act((st) => { st.policies.militaryWork = v; })} />
        </Row>
        <Row label="Share with allied AISIs">
          <Toggle on={s.policies.shareWithAllies} onChange={(v) => act((st) => { st.policies.shareWithAllies = v; })} />
        </Row>
        <Row label={<Term id="wsl">Security</Term>}>
          <span className="num">SL {s.company.securityLevel.toFixed(1)} <span className="dim">→ {securityTarget(s).toFixed(1)}</span></span>
        </Row>
      </Section>
    </aside>
  );
}

function ReleaseTip({ s, frac, title, body }: { s: GameState; frac: number; title: string; body: string }) {
  const gap = s.p - s.model.publicP;
  const newP = s.model.publicP + frac * Math.max(0, gap);
  return (
    <TipCard title={title} rows={[
      { label: 'Revenue target now', value: fmtB(revenueTarget(s)) },
      { label: 'After release', value: fmtB(revenueTargetIf(s, newP)), tone: 'pos' },
      { label: 'Public lags internal', value: fmtDays(Math.max(0, leadDays(s, s.model.publicP))) },
    ]} footer={gap < 0.01 ? 'Disabled: your public model is already your frontier.' : 'Revenue moves toward the target over ~1 month.'}>
      {body}
    </TipCard>
  );
}

// ---------------- News feed ----------------

function NewsFeed({ s }: { s: GameState }) {
  const items = s.log.slice(-40).reverse();
  return (
    <aside className="feed">
      <div className="feed-head">News</div>
      <div className="feed-list">
        {items.map((e, i) => {
          const Icon = KIND_ICON[e.kind] ?? ChevronsRight;
          return (
            <div key={`${e.day}-${i}`} className={`feed-item sev-${e.severity ?? 0}`}>
              <Icon size={13} style={{ color: KIND_COLOR[e.kind], flexShrink: 0, marginTop: 2 }} />
              <div>
                <div className="feed-date num">{fmtMonth(dateOf(s, e.day))}{e.canon && <Tip className="canon" content={() => <TipCard title="AI 2027">In the original scenario this happens around {e.canon}.</TipCard>}>AI27 {e.canon}</Tip>}</div>
                <div className="feed-text">{e.text}</div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ---------------- Event modal ----------------

function EventModal({ s }: { s: GameState }) {
  const pe = s.events[0];
  const def = EVENT_BY_ID[pe.id];
  if (!def) return null;
  const Icon = KIND_ICON[def.icon] ?? Building2;
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <Icon size={18} style={{ color: KIND_COLOR[def.icon] }} />
          <span className="modal-title">{def.title}</span>
          {def.canon && <span className="canon">AI27 {def.canon}</span>}
        </div>
        <div className="modal-text">{def.text(s)}</div>
        <div className="modal-choices">
          {def.choices.map((ch, i) => (
            <button key={i} className={`choice tone-${ch.tone ?? 'neutral'}-border`} disabled={ch.available ? !ch.available(s) : false} onClick={() => store.choose(i)}>
              <span className="choice-label">{ch.label}</span>
              {ch.hint && <span className="choice-hint">{ch.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------- Ending ----------------

function EndingScreen({ s }: { s: GameState }) {
  const e = s.ending!;
  const w = s.world;
  const th = milestoneThresholds(w);
  const name = (list: { id: string; name: string }[], id: string) => list.find((p) => p.id === id)?.name ?? id;
  const sc = e.scores;
  const axes: [string, number][] = [['Survival', sc.survival], ['Freedom', sc.freedom], ['Prosperity', sc.prosperity], ['Company', sc.company], ['Geopolitics', sc.geopolitics]];
  return (
    <div className="modal-backdrop">
      <div className="modal ending">
        <div className="ending-date dim num">{fmtDate(dateOf(s, e.day))}</div>
        <h2 className="ending-title">{e.title}</h2>
        <p className="ending-text">{e.text}</p>
        <div className="ending-scores">
          {axes.map(([k, v]) => (
            <div key={k} className="score">
              <div className="score-val num" style={{ color: v >= 66 ? 'var(--pos)' : v >= 33 ? 'var(--warn)' : 'var(--neg)' }}>{v}</div>
              <Meter value={v} color={v >= 66 ? 'var(--pos)' : v >= 33 ? 'var(--warn)' : 'var(--neg)'} />
              <div className="score-label">{k}</div>
            </div>
          ))}
        </div>
        <div className="ending-grid">
          <Section title="The hidden world">
            <Row label="World">{w.label}</Row>
            <Row label="Horizon needed for SC">{fmtMinutes(w.hSC)}</Row>
            <Row label="Doubling time">{w.T.toFixed(1)} mo · {w.growth}</Row>
            <Row label="Takeoff gaps (human-yrs)">{w.G.map((g) => g.toFixed(1)).join(' / ')}</Row>
            <Row label="Alignment difficulty">x{w.alignDifficulty.toFixed(2)}</Row>
            <Row label="True misalignment">{fmtPct(misalignment(s))} <span className="dim">(est. {fmtPct(misalignment(s, true))})</span></Row>
            <Row label="Government">{name(GOV_PRESETS, s.gov.preset)}</Row>
            <Row label="Public">{name(PUBLIC_PRESETS, s.pub.preset)}</Row>
            <Row label="China">{name(CHINA_PRESETS, s.china.preset)}</Row>
            <Row label="Rivals">{s.labs.map((l) => `${l.name} (${name(LAB_ARCHETYPES, l.archetype)})`).join(', ')}</Row>
          </Section>
          <Section title="Your timeline vs AI 2027">
            {MILESTONES.map((m) => (
              <Row key={m.idx} label={m.short}>
                <span className="num">{s.milestoneDays[m.idx] !== undefined ? fmtMonth(dateOf(s, s.milestoneDays[m.idx])) : '—'}</span>
                <span className="dim num"> · {m.canon}</span>
              </Row>
            ))}
            <div className="dim" style={{ marginTop: 6 }}>Progress to ASI: {fmtPct(Math.min(1, s.p / th[6]))}</div>
          </Section>
          <Section title="True traits vs your estimates">
            <div className="ending-traits">
              {Object.entries(s.model.traits).filter(([, t]) => t.value > 0.15 || t.est > 0.15).sort((a, b) => b[1].value - a[1].value).slice(0, 12).map(([id, t]) => (
                <div key={id} className="ending-trait">
                  <span>{TRAIT_BY_ID[id]?.name ?? id}</span>
                  <Meter value={t.value} max={1} color="var(--neg)" marker={t.est} width={90} />
                </div>
              ))}
            </div>
            <div className="dim">Bar: truth · tick: your estimate</div>
          </Section>
        </div>
        <div className="setup-actions">
          <button className="btn" onClick={() => { const blob = new Blob([store.exportSave()], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ai27-save.json'; a.click(); }}>Export save</button>
          <button className="btn btn-primary" onClick={() => store.go('setup')}>New game</button>
        </div>
      </div>
    </div>
  );
}

