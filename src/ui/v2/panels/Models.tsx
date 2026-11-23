// MODELS (UB-10; UI-IA §1 MODELS, approved mockup design/ux/mockups/rd/models.png): what you own and how good it is.
// Tabs: Your models (family tree by base model + model card) · Evals (HOME of evals: policy, queue, orders, how sure
// each reading is; TRAINING links here). Tree: every real model by base, state word (Testing · Ready · In use ·
// Retired · Rolled back), measured capability bar, role chips (AI staff job, watches AI staff, products); retired
// models fold away. Card: skill bars (overall + nine skills, measured by your evals, with range) on the job scale (the
// shared SkillBars component), the milestone ladder, Works as, and L2 drawers: Benchmarks, Trained with, Actions; cost
// per hour of work in its tooltip. Links: beliefs / risks (SAFETY). Reads measured values and facts only.
import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, CircleDashed, GitFork, Hourglass, Layers, ListChecks } from 'lucide-react';
import { BENCHMARKS } from '../../../data/v2/benchmarks';
import { AGENT_USE_DEF } from '../../../data/v2/agents';
import { PRODUCT_DEFS } from '../../../data/v2/features';
import {
  benchName, dataSpecView, dateOf, deployGate, flopPerToken, fmtDate, internalVersion, measuredDomains, measuredSd, milestoneMarks, skillMarksOf, tokEff,
  useHourCost, usesOf, versionById, versionPressure,
} from '../../../engine/v2';
import type { DomainId, GameStateV2, ModelVersion } from '../../../engine/v2';
import { store, useV2 } from '../store';
import { ActBtn, Term, Tip, TipCard } from '../ui';
import { Card, DOMAIN_WORD, effX, PanelHead, STATUS_WORD, tabOf, Tabs } from '../kit';
import { OmegaChip, PressureRows, SIGNAL_LABEL } from './Pressure';
import { Evals, openEvalQueue } from './Evals';
import { SkillBars, SkillLegend, standing, type SkillRow } from './SkillBars';
import * as F from '../fmt';
import { DOMAIN_ICON, ICON } from '../icons';
import './models.css';

const RUN_KIND: Record<string, string> = { base: 'new pretraining', post: 'post-training', distill: 'distil', continue: 'continued pretraining' };
const DATA_MIX_WORD: Record<string, string> = { balanced: 'Balanced', codeMath: 'Code & math', science: 'Science', synthetic: 'Synthetic-heavy', multimodal: 'Multimodal', natural: 'Natural' };
const SHAPE_WORD: Record<string, string> = { moe: 'mixture of experts', dense: 'dense', latent: 'latent reasoning' };
const STATE_CLS: Record<string, string> = { evaluating: 'test', ready: 'ready', deployed: 'use', retired: 'ret', rolledBack: 'bad' };
const DOMS: DomainId[] = ['CODE', 'RSCH', 'REASON', 'AGENCY', 'SOCIAL', 'MEDIA', 'CYBER', 'BIO', 'PHYS'];
const RUN_LABEL: Record<string, string> = { post: 'Post-training', distill: 'Distil', continue: 'Continued pretraining', base: 'New pretraining' };

/** Active parameters: 400B, 1.6T. */
export const fmtParams = (n: number) => (n >= 1e12 ? `${+(n / 1e12).toFixed(n >= 1e13 ? 0 : 1)}T` : `${Math.round(n / 1e9)}B`);
/** A run named by its target ("Atlas-3 base · post-training"), not its internal id. */
export function runTitle(s: GameStateV2, r: GameStateV2['player']['models']['runs'][number]): string {
  const base = s.player.models.bases.find((b) => b.id === r.baseId);
  const teacher = r.teacherVersionId ? versionById(s, r.teacherVersionId) : undefined;
  if (r.kind === 'base') return `New base model${r.base ? ` · ${fmtParams(r.base.params)}` : ''}`;
  if (r.kind === 'distill') return `Distil from ${teacher?.name ?? base?.name ?? 'a teacher'}`;
  return `${base?.name ?? 'Base model'} · ${RUN_KIND[r.kind] ?? r.kind}`;
}
export function selectedVersion(s: GameStateV2): ModelVersion | undefined {
  const picked = versionById(s, store.sel.versionId);
  if (picked) return picked;
  // Default: your internal model if measured, else your newest measured live model (the mockup's Atlas-2.8).
  const iv = internalVersion(s);
  if (iv?.evals.measuredL !== undefined) return iv;
  const measured = s.player.models.versions.filter((v) => v.status !== 'retired' && v.status !== 'rolledBack' && v.evals.measuredL !== undefined && v.variant !== 'mini');
  return measured[measured.length - 1] ?? iv ?? s.player.models.versions[s.player.models.versions.length - 1];
}
const paramsOf = (s: GameStateV2, v: ModelVersion) => v.params ?? s.player.models.bases.find((b) => b.id === v.baseId)?.params ?? 0;

/** What a model does: AI staff jobs, watching AI staff, products (main model or lineup). */
function rolesOf(s: GameStateV2, v: ModelVersion) {
  const u = usesOf(s, v.id);
  const prods = s.player.deployments.filter((d) => d.kind === 'product' && d.status === 'live' && (d.versionId === v.id || d.lineup?.includes(v.id)));
  return {
    staff: [...u.model].sort((a, b) => AGENT_USE_DEF[a].order - AGENT_USE_DEF[b].order).map((x) => AGENT_USE_DEF[x].name),
    watches: u.monitor.map((x) => AGENT_USE_DEF[x].name),
    products: prods.map((d) => ({ name: PRODUCT_DEFS[d.channel]?.name ?? d.channel, main: d.versionId === v.id })),
  };
}
function RoleChips({ s, v, long }: { s: GameStateV2; v: ModelVersion; long?: boolean }) {
  const r = rolesOf(s, v);
  const out: ReactNode[] = [];
  if (r.staff.length) out.push(
    <Tip key="staff" content={() => <TipCard title={<Term id="agentPackage">AI staff</Term>} value={r.staff.join(', ')}>This model works as your AI staff on these jobs. Set on Lab.</TipCard>}>
      <button className="md-rc" data-role="staff" onClick={(e) => { e.stopPropagation(); store.goto('lab', { tab: 'work' }); }}>AI staff: {r.staff.join(', ').toLowerCase()}</button>
    </Tip>);
  if (r.watches.length) out.push(
    <Tip key="watch" content={() => <TipCard title={<Term id="agentMonitor">Watches AI staff</Term>} value={r.watches.join(', ')}>This model watches your AI staff&apos;s actions on these jobs. Set on Safety › Safeguards.</TipCard>}>
      <button className="md-rc w" data-role="watch" onClick={(e) => { e.stopPropagation(); store.goto('lab', { tab: 'work' }); }}>watches AI staff</button>
    </Tip>);
  if (r.products.length) out.push(
    <Tip key="prod" content={() => <TipCard title={<Term id="product">Products</Term>} rows={r.products.map((p) => ({ label: p.name, value: p.main ? 'main model' : 'lineup' }))}>Products that sell this model. Set on Products.</TipCard>}>
      <button className="md-rc p" data-role="products" onClick={(e) => { e.stopPropagation(); store.goto('products'); }}>{long ? `${r.products.map((p) => p.name).join(' · ')}${r.products.some((p) => p.main) ? ' (main model)' : ''}` : 'products'}</button>
    </Tip>);
  return <>{out}</>;
}

// ───────── panel ─────────
export function Models({ s }: { s: GameStateV2 }) {
  useV2();
  const v = selectedVersion(s);
  const tab = tabOf('models', 'versions') === 'evals' ? 'evals' : 'versions';
  const testing = s.player.models.versions.filter((x) => x.status === 'evaluating');
  const tabs = <Tabs panel="models" def="versions" tabs={[{ id: 'versions', label: 'Your models' }, { id: 'evals', label: 'Evals', icon: ListChecks, badge: s.player.models.evals?.length || undefined }]} />;
  const right = testing.length > 0 && (
    <Tip content={() => <TipCard title={<Term id="evaluating">In testing</Term>} rows={testing.map((x) => ({ label: x.name, value: 'evals running' }))}>Models your evals are measuring; the queue is on Evals.</TipCard>}>
      <button className="md-chip" data-test="models-testing" onClick={() => openEvalQueue(testing[0].id)}><Hourglass size={12} /> {testing.map((x) => x.name).join(', ')} in testing</button>
    </Tip>
  );
  return (
    <div className="panel-v2 md" data-panel="models">
      <PanelHead icon={ICON.models} title="Models" tabs={tabs} right={right} />
      {tab === 'evals' ? <Evals s={s} v={v} /> : (
        <div className="md-grid">
          <FamilyTree s={s} sel={v?.id} />
          {v ? <ModelCard s={s} v={v} /> : <Card title="Model card"><div className="dim">No models</div></Card>}
        </div>
      )}
    </div>
  );
}

// ───────── family tree ─────────
const CAP_HI = 13;
function FamilyTree({ s, sel }: { s: GameStateV2; sel?: string }) {
  const m = s.player.models;
  const tick = milestoneMarks(s)[1];
  return (
    <Card className="md-tree" home="lineage" title={<span className="row-i"><GitFork size={16} />Family tree</span>}
      sub={<>by base model · bar = measured <Term id="L">capability</Term>, tick = {tick.name}</>}>
      {[...m.bases].reverse().map((b) => {
        const vs = m.versions.filter((v) => v.baseId === b.id);
        const gone = vs.filter((v) => v.status === 'retired');
        const live = vs.filter((v) => v.status !== 'retired');
        const fulls = live.filter((v) => v.variant !== 'mini').sort((a, c) => a.day - c.day);
        const minis = live.filter((v) => v.variant === 'mini').sort((a, c) => c.day - a.day);
        const training = m.runs.some((r) => r.baseId === b.id && (r.status === 'running' || r.status === 'paused'));
        return (
          <div key={b.id} className="md-base" data-base={b.id}>
            <Tip as="div" content={() => <TipCard title={b.name} rows={[
              { label: 'Pretrained', value: fmtDate(dateOf(s, b.day)) }, { label: <Term id="baseSize">Size</Term>, value: `${fmtParams(b.params)} parameters · ${b.design.tpp} tokens each` },
              { label: <Term id="shape">Design</Term>, value: SHAPE_WORD[b.design.shape] ?? b.design.shape }, { label: <Term id="dataMix">Data mix</Term>, value: DATA_MIX_WORD[b.design.data] ?? b.design.data },
            ]}>A <Term id="base">base model</Term>: every model below was post-trained or distilled from it.</TipCard>}>
              <div className="md-bh"><Layers size={14} /><b>{b.name}</b><span>base · {fmtParams(b.params)} · {fmtDate(dateOf(s, b.day))}</span><span className="sp" />
                {live.length === 0 && <button className="tr-link" data-test="base-needs-post" onClick={() => { store.setTab('blueprint.start', b.id); store.goto('blueprint', { tab: 'next' }); }}>{training ? 'post-training now' : 'post-train it'} <ChevronRight size={11} /></button>}
              </div>
            </Tip>
            {live.length === 0 && <div className="md-fold"><CircleDashed size={12} /> no models yet</div>}
            {gone.length > 0 && <Fold s={s} gone={gone} sel={sel} />}
            {fulls.map((v) => <Node key={v.id} s={s} v={v} sel={sel} tick={tick.level} />)}
            {minis.map((v) => <Node key={v.id} s={s} v={v} sel={sel} tick={tick.level} />)}
          </div>
        );
      })}
    </Card>
  );
}
function Fold({ s, gone, sel }: { s: GameStateV2; gone: ModelVersion[]; sel?: string }) {
  const [open, setOpen] = useState(false);
  const names = gone.map((v) => v.name);
  return (
    <>
      <button className="md-fold" data-test="tree-retired" onClick={() => setOpen(!open)}>{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {gone.length} retired: {names.length > 3 ? `${names[0]} … ${names[names.length - 1]}` : names.join(', ')}</button>
      {open && gone.map((v) => <Node key={v.id} s={s} v={v} sel={sel} tick={milestoneMarks(s)[1].level} />)}
    </>
  );
}
function Node({ s, v, sel, tick }: { s: GameStateV2; v: ModelVersion; sel?: string; tick: number }) {
  const L = v.evals.measuredL;
  const mini = v.variant === 'mini';
  return (
    <div role="button" tabIndex={0} className={`md-node ${mini ? 'md-mini' : ''} ${sel === v.id ? 'sel' : ''}`} data-version={v.id} onClick={() => store.select({ versionId: v.id })}>
      <span className="ln" />
      <span className="nm">{v.name}</span>
      <Tip content={() => <LevelTip s={s} v={v} />}>
        {L === undefined ? <span className="dim small">being measured</span> : <span className="cb"><i style={{ width: `${Math.min(100, (L / CAP_HI) * 100)}%` }} /><b style={{ left: `${(tick / CAP_HI) * 100}%` }} /></span>}
      </Tip>
      <span className="roles"><span className={`md-st ${STATE_CLS[v.status] ?? ''}`} data-state={v.status}>{STATUS_WORD[v.status] ?? v.status}</span><RoleChips s={s} v={v} /></span>
    </div>
  );
}
/** Measured overall capability with its range (RD-M01): fitted from the last evals' benchmark scores. */
function LevelTip({ s, v }: { s: GameStateV2; v: ModelVersion }) {
  if (v.evals.measuredL === undefined) return <TipCard title={<Term id="L">Capability</Term>} value="testing">Your evals report its capability when they finish.</TipCard>;
  const mk = skillMarksOf(s, 'CODE');
  return (
    <TipCard title={<Term id="L">Capability</Term>} value={standing(v.evals.measuredL, mk)} rows={[
      { label: 'Range (90%)', value: `± ${F.num(1.64 * measuredSd(v), 2)} levels` },
      { label: 'Evals run', value: String(v.evals.nSuites ?? 1) },
      { label: 'Last evals', value: v.evals.suiteDay !== undefined ? fmtDate(dateOf(s, v.evals.suiteDay)) : '—' },
    ]} footer="From your evals' benchmark scores: weak elicitation or a sandbagging model reads low.">What your evals say this model&apos;s overall capability is.</TipCard>
  );
}

// ───────── model card ─────────
type Drawer = 'bench' | 'trained' | 'actions' | undefined;
export function ModelCard({ s, v }: { s: GameStateV2; v: ModelVersion }) {
  const [drawer, setDrawer] = useState<Drawer>(undefined);
  const dom = measuredDomains(v);
  const sd = v.evals.measuredL !== undefined ? 1.64 * measuredSd(v) : 0;
  const parent = versionById(s, v.parentVersionId);
  const base = s.player.models.bases.find((b) => b.id === v.baseId);
  const capMk = skillMarksOf(s, 'CODE');
  const L = v.evals.measuredL;
  const rows: SkillRow[] = [
    {
      key: 'L', label: <Term id="L">Capability</Term>, icon: ICON.L, strong: true, marks: { median: capMk.median, best: capMk.best },
      ...(L !== undefined ? { now: L, nowRange: [L - sd, L + sd] as [number, number] } : {}),
      tip: () => <LevelTip s={s} v={v} />,
    },
    ...DOMS.map((d): SkillRow => {
      const mk = skillMarksOf(s, d);
      const x = dom[d];
      return {
        key: d, label: DOMAIN_WORD[d], icon: DOMAIN_ICON[d], marks: { median: mk.median, best: mk.best }, test: 'card-skill',
        ...(x !== undefined ? { now: x, nowRange: [x - sd, x + sd] as [number, number] } : {}),
        tip: () => (
          <TipCard title={<Term id="domains">{DOMAIN_WORD[d]}</Term>} value={x !== undefined ? standing(x, mk) : 'not measured yet'} rows={[
            ...(x !== undefined ? [{ label: 'Range (90%)', value: `± ${F.num(sd, 2)} levels` }] : []),
            { label: 'Measured on', value: `${mk.test}${mk.standIn ? ' (stand-in)' : ''}` },
          ]} footer={<>{mk.fact}. Bars sit on the job scale: the median expert and the best human doing this job.</>}>
            {v.name}&apos;s skill in {DOMAIN_WORD[d]} as your evals measured it.
          </TipCard>
        ),
      };
    }),
  ];
  const ms = milestoneMarks(s);
  const nextIdx = ms.findIndex((x) => x.metDay === undefined);
  const fpt = flopPerToken(s, v);
  const cost = useHourCost(s, fpt, tokEff(v));
  const nBench = BENCHMARKS.filter((b) => v.evals.bench[b.id]).length;
  const roles = rolesOf(s, v);
  const toggle = (d: Drawer) => setDrawer(drawer === d ? undefined : d);
  return (
    <Card className="md-card" home="modelCard">
      <div className="md-mh">
        <span className="t" data-test="card-name">{v.name}</span>
        <span className={`md-st ${STATE_CLS[v.status] ?? ''}`}>{STATUS_WORD[v.status] ?? v.status}</span>
        {v.status === 'evaluating' && <button className="tr-link" data-test="card-evaluating" onClick={() => openEvalQueue(v.id)}><Term id="evaluating">evals</Term> <ChevronRight size={11} /></button>}
        <span className="sp" />
        <button className="tr-link" data-test="card-beliefs" onClick={() => { store.select({ versionId: v.id }); store.goto('safety', { tab: 'model' }); }}><ICON.investigate size={12} /> beliefs <ChevronRight size={11} /></button>
        <button className="tr-link" data-test="card-risks" onClick={() => { store.select({ versionId: v.id }); store.goto('safety', { tab: 'risks' }); }}><ICON.risk size={12} /> risks <ChevronRight size={11} /></button>
      </div>
      <div className="md-facts">
        <span><b>{fmtParams(paramsOf(s, v))}</b> parameters{base ? ` · ${SHAPE_WORD[base.design.shape] ?? base.design.shape}` : ''}</span>
        {parent && <span>from <b>{parent.name}</b></span>}
        <span>ready <b>{fmtDate(dateOf(s, v.day))}</b></span>
      </div>
      <div className="md-cols">
        <div>
          <div className="md-cap"><b>Skill</b> overall and by domain · measured by your evals, with range</div>
          <SkillLegend now={v.name} />
          <SkillBars rows={rows} head={{ median: capMk.median, best: capMk.best }} />
        </div>
        <div className="md-ladder" data-test="card-milestones">
          <div className="md-cap"><b><Term id="milestone">Milestones</Term></b> · your lab</div>
          {ms.map((x, i) => (
            <Tip key={x.name} as="div" content={() => <TipCard title={<Term id="milestone">{x.name}</Term>} value={x.metDay !== undefined ? `met ${fmtDate(dateOf(s, x.metDay))}` : i === nextIdx ? 'next' : 'not met'}>Milestones are about doing the job; your lab meets one when any of its live models does.{L !== undefined ? ` ${v.name} measures ${L >= x.level ? 'at or past' : 'below'} its level on the capability scale.` : ''}</TipCard>}>
              <div className={`md-rung ${x.metDay !== undefined ? 'met' : i === nextIdx ? 'next' : ''}`} data-rung={x.idx}>
                <span className="dot" /><span className="nm">{x.name}</span>
                <span className="d">{x.metDay !== undefined ? `met ${fmtDate(dateOf(s, x.metDay)).replace(/, 20(\d\d)$/, " '$1")}` : i === nextIdx ? 'next' : ''}</span>
              </div>
            </Tip>
          ))}
        </div>
      </div>
      <div className="md-l2">
        <span className="md-cap">Works as</span>
        <span className="row-i md-roles" data-test="model-uses">{roles.staff.length + roles.watches.length + roles.products.length ? <RoleChips s={s} v={v} long /> : <span className="dim small">nothing yet</span>}</span>
        <span className="sp" />
        <button className={`tr-link ${drawer === 'bench' ? 'on' : ''}`} data-test="card-bench" onClick={() => toggle('bench')}>Benchmarks {nBench} <ChevronRight size={11} /></button>
        <button className={`tr-link ${drawer === 'trained' ? 'on' : ''}`} data-test="card-trained" onClick={() => toggle('trained')}>Trained with <ChevronRight size={11} /></button>
        <Tip content={() => <TipCard title={<Term id="useHourCost">Cost per hour of work</Term>} value={`${F.usd(cost.hour)}/h`} rows={[{ label: <Term id="agentHour">Cost per agent-hour</Term>, value: F.usd(cost.agentHour) }, { label: <Term id="h100e">$ per H100e-hour</Term>, value: F.usd(cost.perH100eHour) }]} footer="Before markup and tool costs; prices per product are on Products.">Bigger models, longer reasoning and less serving know-how cost more per hour.</TipCard>}>
          <span className="tr-link" data-test="card-cost"><Term id="useHourCost">Cost per hour of work</Term> <b className="num">{F.usd(cost.hour)}</b></span>
        </Tip>
        <button className={`tr-link ${drawer === 'actions' ? 'on' : ''}`} data-test="card-actions" onClick={() => toggle('actions')}>Actions <ChevronRight size={11} /></button>
      </div>
      {drawer === 'bench' && <BenchDrawer s={s} v={v} />}
      {drawer === 'trained' && <TrainedDrawer s={s} v={v} />}
      {drawer === 'actions' && <ActionsDrawer s={s} v={v} />}
    </Card>
  );
}

function BenchDrawer({ s, v }: { s: GameStateV2; v: ModelVersion }) {
  const all = BENCHMARKS.filter((b) => v.evals.bench[b.id]);
  const by = (x: string) => (x === 'self' ? 'your evals' : x === 'evalGov' ? 'government evaluators' : 'independent evaluators');
  const dw = (d: string) => DOMAIN_WORD[d] ?? d;
  return (
    <div className="md-drawer" data-test="card-bench-list">
      {all.length === 0 && <div className="dim small">No evals yet.</div>}
      <div className="md-bench">
        {all.map((b) => {
          const r = v.evals.bench[b.id];
          const sat = b.ceil > 0 && r.score > b.ceil - 5;
          return (
            <Tip key={b.id} as="div" content={() => <TipCard title={benchName(s, b)} value={F.bench(r.score, b.special)} rows={[{ label: 'Measured', value: fmtDate(dateOf(s, r.day)) }, { label: 'By', value: by(r.by) }, ...(b.special ? [] : [{ label: 'Range (±)', value: r.sd.toFixed(1) }])]}>{`Skill: ${Array.isArray(b.domain) ? b.domain.map(dw).join(' + ') : dw(b.domain)}${b.dangerous ? ' · dangerous capability' : ''}${sat ? ' · maxed out' : ''}`}</TipCard>}>
              <div className="md-brow"><span className="ellip">{benchName(s, b)}{b.dangerous && <span className="tone-warn small"> ⚠</span>}</span><span className="num">{F.bench(r.score, b.special)}</span>{sat ? <span className="chip-mini"><Term id="saturated">maxed out</Term></span> : <span />}</div>
            </Tip>
          );
        })}
      </div>
      <div className="row-i small"><span className="sp" /><button className="tr-link" data-test="card-order-evals" onClick={() => { store.select({ versionId: v.id }); store.goto('models', { tab: 'evals', anchor: 'evalOrder' }); }}>Order evals <ChevronRight size={11} /></button></div>
    </div>
  );
}

function TrainedDrawer({ s, v }: { s: GameStateV2; v: ModelVersion }) {
  const [open, setOpen] = useState(false);
  const vp = versionPressure(s, v.id);
  const base = s.player.models.bases.find((b) => b.id === v.baseId);
  const o = dataSpecView(s, v);
  const top = [...(vp.run?.rows ?? [])].filter((r) => r.value >= 0.005).sort((a, b) => b.value - a.value).slice(0, 3);
  return (
    <div className="md-drawer" data-test="card-trained-list" data-home="versionPressure">
      <div className="md-kv"><span className="k">Run</span><span>{vp.run ? RUN_LABEL[vp.run.kind] : 'no run of its own'}</span></div>
      {base && <div className="md-kv"><span className="k">Base model</span><span>{base.name} · {DATA_MIX_WORD[base.design.data] ?? base.design.data} data · {SHAPE_WORD[base.design.shape] ?? base.design.shape}</span></div>}
      <Tip as="div" content={() => <TipCard title={<Term id="dataSpec">Data specialisation</Term>} rows={o.rows.map(([d, x]) => ({ label: DOMAIN_WORD[d] ?? d, value: `${effX(x)} effective compute` }))} footer={`At most ${effX(o.cap)} per domain.`}>Effective compute each skill gains or loses from the base model&apos;s data mix.</TipCard>}>
        <div className="md-kv"><span className="k"><Term id="dataSpec">Data</Term></span><span>{o.rows.length ? o.rows.slice(0, 3).map(([d, x]) => `${DOMAIN_WORD[d] ?? d} ${effX(x)}`).join(' · ') : 'no specialisation'}</span></div>
      </Tip>
      {(vp.run || vp.base) && (
        <div className="md-kv"><span className="k"><Term id="trainingPressure">Pushes</Term></span>
          <span className="row-i">{vp.run && <OmegaChip p={vp.run} />}{top.map((r) => <Tip key={r.id} content={() => <TipCard title={<Term id={`sig:${r.id}`}>{SIGNAL_LABEL[r.id]}</Term>} value={F.num(r.value, 2)}>One of the run's strongest training signals; all of them open with signals.</TipCard>}><span className="small">{SIGNAL_LABEL[r.id]} <span className="num">{F.num(r.value, 2)}</span></span></Tip>)}
            <button className="tr-link" data-test="mc-pressure-open" onClick={() => setOpen(!open)}>{open ? 'hide signals' : 'signals'}</button></span>
        </div>
      )}
      {open && vp.run && <PressureRows p={vp.run} testId="mc-pressure-rows" />}
      {open && vp.base && (
        <>
          <div className="tip-cap">{vp.base.name} pretraining <span className="dim">· shared by every model on this base model</span></div>
          <PressureRows p={{ kind: 'base', rows: vp.base.rows, omega: { growth: 1, safety: 1, kind: 1 }, ...(vp.base.imitation ? { imitation: vp.base.imitation } : {}) }} testId="mc-pressure-base" />
        </>
      )}
    </div>
  );
}

function ActionsDrawer({ s, v }: { s: GameStateV2; v: ModelVersion }) {
  const uses = usesOf(s, v.id);
  const internal = uses.model.length > 0 || uses.monitor.length > 0;
  const og = deployGate(s, v, 'open');
  return (
    <div className="md-drawer act-groups" data-test="card-actions-list">
      <div className="act-group"><span className="tip-cap">Use</span>
        <ActBtn id="startStream" params={{ versionId: v.id }} label="Continual learning" />
        <ActBtn id="stopStream" label="Stop continual learning" />
        <ActBtn id="idaCycle" params={{ versionId: v.id }} label="Amplify" />
      </div>
      <div className="act-group"><span className="tip-cap"><Term id="openRelease">Release</Term></span>
        <ActBtn id="releaseOpen" testId="releaseOpen" params={{ versionId: v.id }} label="Release open weights" block={og === true ? undefined : og} reason />
        <ActBtn id="launchDistill" params={{ teacherVersionId: v.id }} label="Distil a smaller model" block={v.variant === 'imported' ? 'Post-train the imported model first (Training › Next run)' : undefined} />
      </div>
      <div className="act-group"><span className="tip-cap">Retire</span>
        <ActBtn id="safety.respond" testId="rollback" params={{ kind: 'rollback', versionId: v.id }} label="Roll back" />
        <ActBtn id="retireVersion" params={{ versionId: v.id }} block={internal ? 'Runs or watches AI staff' : v.status === 'retired' ? 'Already retired' : undefined} />
      </div>
    </div>
  );
}
