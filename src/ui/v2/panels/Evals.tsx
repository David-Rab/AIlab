// Models › Evals (model v3 D8; design/notes/D8.md): evaluations as work. Home of the standing eval policy's cost and
// re-run rule (evalPolicyView), the eval queue (evalQueueView: progress, finish date, what binds), the order controls
// (depth pick, evaluator, previewed cost: the runEvals preview) and each version's measurement quality (evalMeasureView:
// band, suites, last suite's depth and date, next policy re-run). L1: the queue and the measurement bands. L2: the
// policy row and the order card. L3: tooltips (work left per part, depth trade-offs, the band's arithmetic).
// The gate itself is a safety policy (Safety › Policies, linked); the research engineers' evaluations need lives on
// Company › Work (linked). The measured level's home stays the model card; here it is drawn as a band only.
import { ListChecks } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { dateOf, evalDepthView, evalMeasureView, evalPolicyView, evalQueueView, fmtDate, versionById } from '../../../engine/v2';
import type { EvalDepthRow, EvalMeasureRow, EvalTaskView, GameStateV2, ModelVersion } from '../../../engine/v2';
import { EVAL_DEPTHS } from '../../../data/v2/evals';
import { store } from '../store';
import { ActBtn, Meter, Seg, Term, Tip, TipCard } from '../ui';
import { Card, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C } from '../theme';
import './evals.css';

type Depth = EvalTaskView['depth'];
type By = EvalTaskView['by'];
/** store.tab key of the order card's depth pick. */
export const DEPTH_KEY = 'models.evalDepth';
/** Open Models › Evals at the queue (the "evaluating" chips and the version cards link here). */
export function openEvalQueue(versionId?: string) {
  if (versionId) store.select({ versionId });
  store.goto('models', { tab: 'evals', anchor: 'evalQueue' });
}

const BY: Record<By, { label: string; short: string; btn: string; icon: LucideIcon; term?: string }> = {
  self: { label: 'Own evals', short: 'own', btn: 'Own evals', icon: ICON.you },
  evalGov: { label: 'Government evaluators', short: 'gov', btn: 'Gov evaluators', icon: ICON.evalGov, term: 'evalGov' },
  evalIndep: { label: 'Independent evaluators', short: 'independent', btn: 'Independent', icon: ICON.evalIndep, term: 'evalIndep' },
};
const WHY: Record<EvalTaskView['why'], { label: string; tone: string; body: string }> = {
  release: { label: 'release', tone: 'warn', body: 'The eval gate: the version waits in evaluation until this suite is done.' },
  order: { label: 'order', tone: '', body: 'You ordered this suite.' },
  policy: { label: 'policy', tone: '', body: 'Auto-evaluate re-runs a model it keeps measured (the re-run rule). Blocks nothing.' },
};
const BIND: Record<EvalTaskView['binds'], { label: string; icon: LucideIcon }> = {
  researchEngineers: { label: 'research engineers', icon: ICON.roleRE },
  engineers: { label: 'engineers', icon: ICON.roleEng },
  compute: { label: 'compute', icon: ICON.compute },
};
/** Team-weeks: 0.04, 0.20, 1.5. */
const tw = (x: number) => (x < 1 ? x.toFixed(2) : x.toFixed(1));
const band = (x: number) => `± ${x.toFixed(2)} L`;
const finish = (s: GameStateV2, d: number) => (Number.isFinite(d) ? fmtDate(dateOf(s, s.time.day + d)) : 'stalled');
const daysTxt = (d: number) => (Number.isFinite(d) ? F.days(d) : '∞');

export function Evals({ s, v }: { s: GameStateV2; v?: ModelVersion }) {
  const q = evalQueueView(s);
  const rows = evalMeasureView(s);
  return (
    <div className="ev" data-test="evals">
      <PolicyCard s={s} />
      <div className="ev-mid">
        <div className="ev-left">
          <QueueCard s={s} q={q} />
          <MeasureCard s={s} rows={rows} sel={v?.id} />
        </div>
        <OrderCard s={s} v={v} />
      </div>
    </div>
  );
}

// ───────── policy ─────────
function PolicyCard({ s }: { s: GameStateV2 }) {
  const p = evalPolicyView(s);
  const gate = s.player.safety.evalGate;
  const auto = !!s.player.policies.autoEvaluate;
  const c = p.perSuite;
  const D = EVAL_DEPTHS[p.depth];
  return (
    <Card title={<span className="row-i"><ListChecks size={15} /><Term id="evals">Eval policy</Term></span>} home="evalPolicy" className="ev-pol">
      <div className="ev-pol-row" data-test="eval-policy">
        <Tip content={() => <TipCard title={<Term id="evalGate">Eval gate</Term>} value={gate === 'none' ? 'off' : D.label} rows={[
          { label: 'Release suites', value: gate === 'none' ? 'none (ready at once)' : `${D.label}${gate === 'fullPlusExternal' ? ' (full + external)' : ''}` },
          { label: 'Policy re-runs', value: D.label },
        ]} footer="Set on Safety › Policies.">The depth of the suite a new version must pass before release, and of the policy&apos;s re-runs (basic without a gate).</TipCard>}>
          <span className="ev-pol-item" data-test="eval-policy-depth"><span className="tip-cap"><Term id="evalGate">Gate</Term></span><b>{gate === 'none' ? 'off' : D.label}</b>{gate === 'fullPlusExternal' && <span className="dim small">+ external</span>}</span>
        </Tip>
        <Ref id="evalGate" to={{ panel: 'safety', tab: 'overview', anchor: 'policy' }}>Safety</Ref>
        <span className="ev-sep" />
        <ActBtn id="products.policy" testId="products.policy.autoEvaluate" params={{ autoEvaluate: !auto }}
          label={<span className="psw"><span className={`sw ${auto ? 'on' : ''}`}><i /></span><Term id="autoEvaluate">Auto-evaluate</Term></span>} />
        <Tip content={() => <TipCard title={<Term id="rerunRule">Re-run rule</Term>} value={auto ? 'on' : 'off'} rows={[
          { label: 'Cadence', value: `${p.reevalDays} d after the last suite` },
          { label: 'Changed in place', value: `≥ ${p.reevalDG.toFixed(2)} OOM` },
          { label: 'Depth', value: D.label },
        ]}>Which models: every internal use&apos;s model and the continual-learning stream.</TipCard>}>
          <span className={`ev-pol-item ${auto ? '' : 'dim'}`} data-test="eval-rerun"><span className="tip-cap"><Term id="rerunRule">Re-run</Term></span><span className="small">every {p.reevalDays} d or Δ ≥ {p.reevalDG.toFixed(2)} OOM</span></span>
        </Tip>
        <span className="ev-sep" />
        {c ? (
          <Tip content={() => <TipCard title={`One ${D.label.toLowerCase()} suite on the internal model`} rows={[
            { label: <Term id="roleRE">Research engineers</Term>, value: `${tw(c.reTW)} team-weeks (≤ ${F.num(c.maxTeams, 1)} teams at once)` },
            { label: <Term id="roleEng">Engineers</Term>, value: `${tw(c.engTW)} team-weeks` },
            { label: <Term id="h100e">Inference compute</Term>, value: `${F.count(c.h100eDays)} H100e-days` },
            { label: 'Rollouts', value: F.count(c.rollouts) },
            { label: 'Tokens', value: F.count(c.tokens) },
          ]} footer="Each re-run and each release suite at this depth costs about this (compute scales with the model's FLOP per token).">Work of one suite at the policy depth.</TipCard>}>
            <span className="ev-cost" data-test="eval-policy-cost">
              <span className="tip-cap">Per suite</span>
              <span className="row-i"><ICON.roleRE size={13} /><b className="num">{tw(c.reTW)}</b><span className="dim small">RE team-wk</span></span>
              <span className="row-i"><ICON.roleEng size={13} /><b className="num">{tw(c.engTW)}</b><span className="dim small">eng team-wk</span></span>
              <span className="row-i"><ICON.compute size={13} /><b className="num">{F.count(c.h100eDays)}</b><span className="dim small">H100e-days</span></span>
            </span>
          </Tip>
        ) : <span className="dim small">no internal model to price</span>}
        <span className="sp" />
        <Tip content={() => <TipCard title="Evaluation work so far" rows={[
          { label: 'Suites run', value: F.count(p.spent?.suites ?? 0) },
          { label: 'Research-engineer team-weeks', value: tw(p.spent?.reTW ?? 0) },
          { label: 'Engineer team-weeks', value: tw(p.spent?.engTW ?? 0) },
          { label: 'H100e-days', value: F.count(p.spent?.h100eDays ?? 0) },
        ]} footer="Research engineers on evals today are on Company › Work (the evaluations need).">All suites finished since the start.</TipCard>}>
          <span className="ev-pol-item" data-test="eval-spent"><span className="tip-cap">Run so far</span><b className="num">{F.count(p.spent?.suites ?? 0)}</b><span className="dim small">suites</span></span>
        </Tip>
        <Ref id="reNeeds" to={{ panel: 'company', tab: 'work' }}>Work</Ref>
      </div>
    </Card>
  );
}

// ───────── queue ─────────
function QueueCard({ s, q }: { s: GameStateV2; q: EvalTaskView[] }) {
  return (
    <Card title={<Term id="evalQueue">Eval queue</Term>} home="evalQueue" id="ctl-evalQueue" className="ev-q"
      sub={q.length ? `${q.length} suite${q.length > 1 ? 's' : ''}` : undefined}>
      {q.length === 0 && <div className="dim small ev-empty" data-test="eval-queue-empty">No suites queued. Release suites, your orders and the policy&apos;s re-runs appear here.</div>}
      {q.length > 0 && (
        <div className="ev-qgrid" data-test="eval-queue">
          <span className="ch">Version</span><span className="ch"><Term id="evalDepth">Depth</Term></span><span className="ch">By</span><span className="ch">Why</span>
          <span className="ch">Progress</span><span className="ch">Done</span><span className="ch"><Term id="bottleneck">Binds</Term></span>
          {q.map((t) => <QueueRow key={t.id} s={s} t={t} />)}
        </div>
      )}
    </Card>
  );
}
function QueueRow({ s, t }: { s: GameStateV2; t: EvalTaskView }) {
  const by = BY[t.by];
  const why = WHY[t.why];
  const bind = BIND[t.waiting ?? t.binds];
  const stalled = !Number.isFinite(t.etaDays);
  const workTip = () => (
    <TipCard title={`${t.name} · ${EVAL_DEPTHS[t.depth].label.toLowerCase()} suite`} value={`${F.pct(t.progress)} done`} rows={[
      ...(t.by === 'self' ? [{ label: <Term id="roleRE">Research engineers</Term>, value: `${tw((1 - t.progress) * t.reTW)} of ${tw(t.reTW)} team-wk left · ${daysTxt(t.reDays)}` }]
        : [{ label: by.label, value: `their own staff · ${daysTxt(t.reDays)}` }]),
      { label: <Term id="roleEng">Engineers</Term>, value: t.engDays > 0 ? `${tw(t.engTW)} team-wk on the build queue · ${daysTxt(t.engDays)}` : 'harness ready' },
      { label: <Term id="h100e">Compute</Term>, value: `${F.count((1 - t.progress) * t.h100eDays)} of ${F.count(t.h100eDays)} H100e-days left · ${daysTxt(t.computeDays)}` },
      ...(t.by === 'self' ? [{ label: 'Research engineers on it', value: `${F.num(t.reNow, 2)} of ${F.num(t.reMax, 2)} teams it can use` }] : []),
    ]} footer="The slowest part sets the finish date. Shares of the evaluations need go to suites in queue order.">Work left on this suite at today&apos;s rates.</TipCard>
  );
  return (
    <div className="ev-qline" data-eval={t.id} data-version={t.versionId} data-why={t.why} data-by={t.by} data-depth={t.depth}>
      <button className="ev-name" onClick={() => store.select({ versionId: t.versionId })} title="">{t.name}</button>
      <Tip content={() => <TipCard title={<Term id="evalDepth">{EVAL_DEPTHS[t.depth].label}</Term>} value={`${EVAL_DEPTHS[t.depth].rollouts} rollouts / benchmark`} />}><span className="chip-mini">{EVAL_DEPTHS[t.depth].label.toLowerCase()}</span></Tip>
      <Tip content={() => <TipCard title={by.term ? <Term id={by.term}>{by.label}</Term> : by.label}>{t.by === 'self' ? 'Your research engineers run it.' : 'Their own staff run it; you give engineer support and compute.'}</TipCard>}><span className="row-i small"><by.icon size={12} />{by.short}</span></Tip>
      <Tip content={() => <TipCard title={`Why: ${why.label}`}>{why.body}</TipCard>}><span className={`tag2 ${why.tone}`} data-test="eval-why">{why.label}</span></Tip>
      <Tip content={workTip}><span className="row-i ev-prog"><Meter value={t.progress} max={1} width={90} color={t.waiting ? 'var(--text-3)' : 'var(--accent)'} /><span className="num small" data-test="eval-progress">{F.pct(t.progress)}</span></span></Tip>
      <Tip content={workTip}><span className={`num small ${stalled ? 'tone-neg' : ''}`} data-test="eval-eta" data-eta={Number.isFinite(t.etaDays) ? t.etaDays : -1}>{finish(s, t.etaDays)}{!stalled && <span className="dim"> · {F.days(t.etaDays)}</span>}</span></Tip>
      <Tip content={workTip}><span className={`row-i small ${t.waiting ? 'tone-warn' : 'dim'}`} data-test="eval-binds" data-binds={t.waiting ?? t.binds}><bind.icon size={12} />{t.waiting ? `waits: ${bind.label}` : bind.label}</span></Tip>
    </div>
  );
}

// ───────── order ─────────
/** Rows of the depth comparison (each cell is inside its row's tooltip). */
const DEPTH_LINES: { label: ReactNode; f: (r: EvalDepthRow) => string; tip: (name: string, now: number) => string }[] = [
  { label: 'Rollouts / benchmark', f: (r) => F.count(r.rollouts), tip: () => 'Attempts per benchmark (tasks × repeats) over 25 benchmarks.' },
  { label: <Term id="roleRE">RE team-wk</Term>, f: (r) => tw(r.cost.reTW), tip: () => 'Research-engineer team-weeks (own evals only; outside evaluators use their own staff).' },
  { label: <Term id="roleEng">Eng team-wk</Term>, f: (r) => tw(r.cost.engTW), tip: () => 'Engineer team-weeks to hook the version into the harness (build queue).' },
  { label: <Term id="h100e">H100e-days</Term>, f: (r) => F.count(r.cost.h100eDays), tip: () => 'Inference compute from the experiments pool, at the FLOP per token of this version.' },
  { label: 'Takes', f: (r) => daysTxt(r.days), tip: () => 'An own suite at the research engineers on evals today (the staff on one suite is capped: the analysis lag).' },
  { label: <Term id="measureBand">Band after</Term>, f: (r) => band(r.bandAfter), tip: (n, now) => `Measured-level band on ${n} once this suite is added (now ${band(now)}).` },
  { label: <Term id="benchmark">Bench noise</Term>, f: (r) => `± ${r.benchSd.toFixed(1)} pt`, tip: () => 'One standard deviation of your own score on a benchmark at this depth (points).' },
  { label: <Term id="elicitation">Elicitation</Term>, f: (r) => `${r.elic === 0 ? '0' : F.num(r.elic, 2, true)} L`, tip: () => 'Shift on capability benchmarks relative to a full suite.' },
];
function OrderCard({ s, v }: { s: GameStateV2; v?: ModelVersion }) {
  const depth = (store.tab[DEPTH_KEY] as Depth | undefined) ?? 'full';
  if (!v || v.status === 'retired' || v.status === 'rolledBack') {
    return <Card title="Order a suite" home="evalOrder" className="ev-order"><div className="dim small ev-empty">Pick a version in the measurement list below.</div></Card>;
  }
  const rows = evalDepthView(s, v);
  const open = (by: By) => evalMeasureView(s).find((r) => r.versionId === v.id)?.open.some((o) => o.by === by);
  const block = (by: By) => (open(by) ? `${v.name} already has a suite from ${BY[by].label.toLowerCase()} in the queue` : undefined);
  const cells = (f: (r: EvalDepthRow) => string) => rows.map((r) => <span key={r.depth} className={`num ${r.depth === depth ? 'on' : ''}`}>{f(r)}</span>);
  const line = (i: number, label: ReactNode, f: (r: EvalDepthRow) => string, tip: string) => (
    <Tip key={i} as="div" className="ev-dline" content={() => <TipCard title={label}>{tip}</TipCard>}>
      <span className="dim">{label}</span>{cells(f)}
    </Tip>
  );
  return (
    <Card title={<span>Order a suite <span className="dim">· {v.name}</span></span>} home="evalOrder" className="ev-order" id="ctl-evalOrder">
      <div className="ev-dpick">
        <span className="tip-cap"><Term id="evalDepth">Depth</Term></span>
        <Seg testId="eval-depth" value={depth} onChange={(d) => store.setTab(DEPTH_KEY, d)} options={rows.map((r) => ({ v: r.depth, label: r.label }))} />
      </div>
      <div className="ev-dgrid" data-test="eval-depths">
        <span />{rows.map((r) => <span key={r.depth} className={`ch ${r.depth === depth ? 'on' : ''}`}>{r.label}</span>)}
        {DEPTH_LINES.map((d, i) => line(i, d.label, d.f, d.tip(v.name, rows[0].bandNow)))}
      </div>
      <div className="ev-obtns" data-test="eval-order">
        {(['self', 'evalGov', 'evalIndep'] as By[]).map((by) => (
          <ActBtn key={by} id="runEvals" testId={`runEvals.${by}`} params={{ versionId: v.id, by, depth }} label={<span className="row-i">{(() => { const I = BY[by].icon; return <I size={13} />; })()}{BY[by].btn}</span>} block={block(by)} />
        ))}
      </div>
    </Card>
  );
}

// ───────── measurement ─────────
function MeasureCard({ s, rows, sel }: { s: GameStateV2; rows: EvalMeasureRow[]; sel?: string }) {
  const shown = rows.filter((r) => r.measuredL !== undefined || r.open.length > 0 || r.status === 'evaluating');
  const ls = shown.filter((r) => r.measuredL !== undefined).flatMap((r) => [r.measuredL! - 2 * r.sd, r.measuredL! + 2 * r.sd]);
  const lo = ls.length ? Math.floor(Math.min(...ls) * 2) / 2 : 4;
  const hi = ls.length ? Math.max(lo + 1, Math.ceil(Math.max(...ls) * 2) / 2) : 8;
  const W = 300;
  const x = (l: number) => 12 + ((l - lo) / (hi - lo)) * (W - 24);
  const ticks: number[] = [];
  for (let t = Math.ceil(lo); t <= hi; t += hi - lo > 4 ? 2 : 1) ticks.push(t);
  return (
    <Card title={<span>Measurement <span className="dim">· <Term id="measureBand">bands</Term></span></span>} home="evalMeasure" className="ev-m"
      sub={<span className="small dim">click a version to order a suite on it</span>}>
      <div className="ev-mgrid" data-test="eval-measure">
        <span className="ch">Version</span>
        <span className="ch ev-axis"><svg width={W} height={14}>{ticks.map((t) => <text key={t} x={x(t)} y={11} textAnchor="middle" className="ev-tick">L {t}</text>)}</svg></span>
        <span className="ch r"><Term id="measureBand">±</Term></span><span className="ch r">Suites · full eq.</span><span className="ch">Last suite</span><span className="ch">Next</span>
        {shown.map((r) => <MeasureRow key={r.versionId} s={s} r={r} on={r.versionId === sel} x={x} W={W} ticks={ticks} />)}
      </div>
      {!shown.length && <div className="dim small ev-empty">No version measured yet.</div>}
    </Card>
  );
}
function MeasureRow({ s, r, on, x, W, ticks }: { s: GameStateV2; r: EvalMeasureRow; on: boolean; x: (l: number) => number; W: number; ticks: number[] }) {
  const v = versionById(s, r.versionId);
  const evaluating = r.status === 'evaluating';
  const L = r.measuredL;
  const levelTip = () => (
    <TipCard title={<Term id="L">Measured level</Term>} value={L !== undefined ? `L ${F.level(L)} ${band(r.sd)}` : 'not yet measured'} rows={[
      { label: '±1 SD band', value: L !== undefined ? `${F.level(L - r.sd)} – ${F.level(L + r.sd)}` : '—' },
      { label: '±2 SD (faint)', value: L !== undefined ? `${F.level(L - 2 * r.sd)} – ${F.level(L + 2 * r.sd)}` : '—' },
    ]} footer="Your evals' reading, not the truth: fitted from the last suite's benchmark scores, so weak elicitation or a sandbagging model reads low.">Band = the score noise of the last suite, carried into the fit.</TipCard>
  );
  return (
    <div className={`ev-mline ${on ? 'on' : ''}`} data-measure={r.versionId} onClick={() => store.select({ versionId: r.versionId })}>
      <span className="ev-mname">
        <b>{r.name}</b>
        {v && v.variant !== 'full' && <span className="chip-mini">{v.variant}</span>}
        {evaluating && <button className="tag2 warn ev-chip" data-test="eval-chip" onClick={(e) => { e.stopPropagation(); openEvalQueue(r.versionId); }}><Term id="evaluating">evaluating</Term></button>}
        {r.policy && <Tip content={() => <TipCard title={<Term id="autoEvaluate">Kept measured</Term>}>Auto-evaluate re-runs this model under the re-run rule.</TipCard>}><span className="chip-mini tone-pos">policy</span></Tip>}
      </span>
      <Tip content={levelTip}>
        <svg width={W} height={16} className="ev-band" data-test="eval-band">
          {ticks.map((t) => <line key={t} x1={x(t)} x2={x(t)} y1={0} y2={16} stroke={C.line} />)}
          {L !== undefined && <>
            <rect x={x(L - 2 * r.sd)} y={5} width={Math.max(1, x(L + 2 * r.sd) - x(L - 2 * r.sd))} height={6} rx={3} fill={C.cap} opacity={0.22} />
            <rect x={x(L - r.sd)} y={3} width={Math.max(2, x(L + r.sd) - x(L - r.sd))} height={10} rx={3} fill={C.cap} opacity={0.6} />
            <line x1={x(L)} x2={x(L)} y1={1} y2={15} stroke={C.text} strokeWidth={2} />
          </>}
        </svg>
      </Tip>
      <Tip content={levelTip}><span className="num small ev-r" data-test="eval-sd">{L !== undefined ? band(r.sd) : '—'}</span></Tip>
      <Tip content={() => <TipCard title="Suites behind the reading" rows={[{ label: 'Suites run', value: String(r.nSuites) }, { label: 'Full-suite equivalents', value: F.num(r.nEff, 1) }]}>Basic counts 0.2, full 1, deep 4.</TipCard>}>
        <span className="num small ev-r">{r.nSuites}<span className="dim"> · {F.num(r.nEff, 1)}</span></span>
      </Tip>
      <Tip content={() => <TipCard title="Last suite" rows={[{ label: <Term id="evalDepth">Depth</Term>, value: r.depth ? EVAL_DEPTHS[r.depth].label : '—' }, { label: 'Date', value: r.suiteDay !== undefined ? fmtDate(dateOf(s, r.suiteDay)) : '—' }]} />}>
        <span className="small" data-test="eval-last">{r.suiteDay !== undefined ? <>{r.depth && <>{EVAL_DEPTHS[r.depth].label.toLowerCase()} <span className="dim">· </span></>}<span className={r.depth ? 'dim' : ''}>{fmtDate(dateOf(s, r.suiteDay))}</span></> : <span className="dim">never</span>}</span>
      </Tip>
      <span className="small">
        {r.open.length > 0 ? (
          <button className="ref-chip" data-ref="evalQueue" onClick={(e) => { e.stopPropagation(); openEvalQueue(); }}>in queue <ICON.go size={11} /></button>
        ) : r.nextDay !== undefined ? (
          <Tip content={() => <TipCard title={<Term id="rerunRule">Next policy re-run</Term>} value={fmtDate(dateOf(s, r.nextDay!))}>By the cadence; sooner if the model changes in place by the threshold.</TipCard>}><span className="dim">re-run {fmtDate(dateOf(s, Math.max(s.time.day, r.nextDay)))}</span></Tip>
        ) : <span className="dim">—</span>}
      </span>
    </div>
  );
}
