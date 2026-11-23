// Models (§6.3): lineage tree (bases → versions → variants), model card (measured L, domain radar with error bars,
// benchmarks with saturation marks, horizon, serving FLOP per token and cost per hour, monitorability, trait beliefs, flags), run queue (paradigms moved to
// Research in R4); set internal agent, evals, variants, distill, roll back, retire, streams. Tabs (model v3 D6, D4, D8): Versions
// (all of the above), Suites (the RL environment suites the post-trains use, Suites.tsx), Data (the data portfolio and
// the data actions, Data.tsx) and Evals (Evals.tsx: the eval policy, queue, orders and each version's measurement
// quality; the card links there for ordering suites).
import { BENCHMARKS } from '../../../data/v2/benchmarks';
import { PHI_FLOP_PER_H100E_DAY } from '../../../data/v2/calibration';
import { AGENT_USE_DEF } from '../../../data/v2/agents';
import {
  POOL_SHARE_RANGE, benchName, dataSpecView, dateOf, fmtDate, idleTrainingShare, internalVersion, measuredDelta, measuredDomains, measuredSd, poolAllocation, runBand, runEtaDays, runStall, streamShare,
  deployGate, flopPerToken, tokEff, useHourCost, usesOf, versionById, versionPressure,
} from '../../../engine/v2';
import type { GameStateV2, ModelVersion } from '../../../engine/v2';
import { store, useV2 } from '../store';
import { ActBtn, Limit, Meter, Radar, Term, Tip, TipCard } from '../ui';
import { useState } from 'react';
import { Card, domainWord, effX, KV, PanelHead, Ref, STATUS_WORD, tabOf, Tabs, VARIANT_WORD } from '../kit';
import { Database, Dumbbell, ListChecks } from 'lucide-react';
import { Suites } from './Suites';
import { DataView } from './Data';
import { OmegaChip, PressureRows, SIGNAL_LABEL } from './Pressure';
import { Evals, openEvalQueue } from './Evals';
import * as F from '../fmt';
import { ICON } from '../icons';

const STATUS_TONE: Record<string, string> = { evaluating: 'tone-warn', ready: 'tone-pos', deployed: 'tone-pos', retired: 'dim', rolledBack: 'tone-neg' };
const RUN_KIND: Record<string, string> = { base: 'new pretraining', post: 'post-training', distill: 'distil', continue: 'continued pretraining' };
const DATA_MIX_WORD: Record<string, string> = { balanced: 'Balanced', codeMath: 'Code & math', science: 'Science', synthetic: 'Synthetic-heavy', multimodal: 'Multimodal', natural: 'Natural' };
const SHAPE_WORD: Record<string, string> = { moe: 'Mixture of experts', dense: 'Dense', latent: 'Hidden reasoning' };
const RUN_STATE: Record<string, string> = { running: 'Running', paused: 'Paused', done: 'Done', failed: 'Failed', cancelled: 'Cancelled' };
const lvl = (x: number) => `level ${F.level(x)} (10 = best human)`;
/** Jank M5: a run named by its target ("Atlas-3 base · post-train"), not its internal id ("post 21 post"). */
/** Active parameters: 400B, 1.6T. */
export const fmtParams = (n: number) => (n >= 1e12 ? `${+(n / 1e12).toFixed(n >= 1e13 ? 0 : 1)}T` : `${Math.round(n / 1e9)}B`);

export function runTitle(s: GameStateV2, r: GameStateV2['player']['models']['runs'][number]): string {
  const base = s.player.models.bases.find((b) => b.id === r.baseId);
  const teacher = r.teacherVersionId ? versionById(s, r.teacherVersionId) : undefined;
  if (r.kind === 'base') return `New base model${r.base ? ` · ${fmtParams(r.base.params)}` : ''}`;
  if (r.kind === 'distill') return `Distil from ${teacher?.name ?? base?.name ?? 'a teacher'}`;
  return `${base?.name ?? 'Base model'} · ${RUN_KIND[r.kind] ?? r.kind}`;
}

export function selectedVersion(s: GameStateV2): ModelVersion | undefined {
  return versionById(s, store.sel.versionId) ?? internalVersion(s) ?? s.player.models.versions[s.player.models.versions.length - 1];
}

function Lineage({ s, sel }: { s: GameStateV2; sel?: string }) {
  const m = s.player.models;
  return (
    <div className="lineage" data-test="lineage">
      {m.bases.map((b) => (
        <div key={b.id} className="lin-base" data-base={b.id}>
          <Tip as="div" content={() => <TipCard title={b.name} rows={[
            { label: 'Done', value: fmtDate(dateOf(s, b.day)) }, { label: <Term id="baseSize">Size</Term>, value: `${fmtParams(b.params)} parameters, ${b.design.tpp} tokens each · ${SHAPE_WORD[b.design.shape] ?? b.design.shape}` },
            { label: 'Data mix', value: DATA_MIX_WORD[b.design.data] ?? b.design.data }, { label: <Term id="flop">Training compute</Term>, value: `${F.short(b.flop / PHI_FLOP_PER_H100E_DAY / 1e6)}M H100e-days` },
          ]} />}>
            <div className="lin-base-row"><b>{b.name}</b><span className="dim small">{fmtParams(b.params)} · {SHAPE_WORD[b.design.shape] ?? b.design.shape} · {DATA_MIX_WORD[b.design.data] ?? b.design.data}</span></div>
          </Tip>
          {m.versions.filter((v) => v.baseId === b.id && !m.versions.some((p) => p.id === v.parentVersionId && p.baseId === b.id)).map((v) => (
            <VersionTree key={v.id} s={s} v={v} sel={sel} depth={1} />
          ))}
          {/* Jank M5: a finished base with no version yet says what it needs. */}
          {!m.versions.some((v) => v.baseId === b.id) && (
            <div className="lin-ver lin-note small dim" data-test="base-needs-post">{m.runs.some((r) => r.baseId === b.id && (r.status === 'running' || r.status === 'paused')) ? 'base model done · post-training now' : 'base model done · needs post-training'}<button className="btn btn-sm btn-ghost" onClick={() => store.goto('blueprint')}>Next run ›</button></div>
          )}
        </div>
      ))}
    </div>
  );
}
function VersionTree({ s, v, sel, depth }: { s: GameStateV2; v: ModelVersion; sel?: string; depth: number }) {
  const kids = s.player.models.versions.filter((x) => x.parentVersionId === v.id && x.baseId === v.baseId);
  return (
    <>
      <VersionRow s={s} v={v} sel={sel} depth={Math.min(depth, 4)} />
      {kids.map((x) => <VersionTree key={x.id} s={s} v={x} sel={sel} depth={depth + 1} />)}
    </>
  );
}
/** Jank M4: the best usable version of each variant (highest measured level), so "newest" is not mistaken for "best". */
function bestOfVariant(s: GameStateV2): Set<string> {
  const best = new Map<string, ModelVersion>();
  for (const v of s.player.models.versions) {
    if ((v.status !== 'ready' && v.status !== 'deployed') || v.evals.measuredL === undefined) continue;
    const b = best.get(v.variant);
    if (!b || v.evals.measuredL > (b.evals.measuredL ?? 0)) best.set(v.variant, v);
  }
  return new Set([...best.values()].map((v) => v.id));
}
function VersionRow({ s, v, sel, depth }: { s: GameStateV2; v: ModelVersion; sel?: string; depth: number }) {
  const internal = usesOf(s, v.id).model.length > 0;
  const best = bestOfVariant(s).has(v.id);
  return (
    <button className={`lin-ver ${sel === v.id ? 'active' : ''}`} style={{ paddingLeft: 8 + depth * 14 }} data-version={v.id} onClick={() => store.select({ versionId: v.id })}>
      <span>{v.name}</span>
      {v.variant !== 'full' && <span className="chip-mini">{VARIANT_WORD[v.variant] ?? v.variant}</span>}
      {v.openDay !== undefined && <span className="chip-mini"><Term id="openRelease">open</Term></span>}
      {best && <Tip content={() => <TipCard title="Best of its kind">{`The ${VARIANT_WORD[v.variant] ?? v.variant} model with the highest measured capability that is ready to use.`}</TipCard>}><span className="chip-mini tone-pos" data-test="best-badge">best</span></Tip>}
      {internal && <span className="chip-mini tone-pos"><Term id="internalAgent">internal</Term></span>}
      <span className={`small ${STATUS_TONE[v.status]}`}>{STATUS_WORD[v.status] ?? v.status}</span>
      <Tip content={() => <LevelTip s={s} v={v} />}><span className="num small">{v.evals.measuredL !== undefined ? F.level(v.evals.measuredL) : '—'}</span></Tip>
    </button>
  );
}
/** Measured level with its band (RD-M01): fitted from the last suite's benchmark scores. */
function LevelTip({ s, v }: { s: GameStateV2; v: ModelVersion }) {
  if (v.evals.measuredL === undefined) return <TipCard title={<Term id="L">Capability</Term>} value="testing">The evals report its capability when they finish.</TipCard>;
  const sd = measuredSd(v);
  const gain = measuredDelta(s, v); // RF-R5: the measured gain, once per model (not per idea)
  return (
    <TipCard title={<Term id="L">Capability</Term>} value={`${lvl(v.evals.measuredL)} ± ${sd.toFixed(2)}`} rows={[
      { label: 'Evals run', value: String(v.evals.nSuites ?? 1) },
      { label: 'Last evals', value: v.evals.suiteDay !== undefined ? fmtDate(dateOf(s, v.evals.suiteDay)) : '—' },
      ...(gain ? [{ label: `Measured gain over ${gain.vs}`, value: `${gain.dL >= 0 ? '+' : '−'}${Math.abs(gain.dL).toFixed(2)} ± ${gain.sd.toFixed(2)} levels` }] : []),
    ]} footer="From your evals' benchmark scores: weak elicitation or a sandbagging model reads low. The gain includes everything that differs between the two models.">What your evals say this model's overall capability is.</TipCard>
  );
}

export function ModelCard({ s, v }: { s: GameStateV2; v: ModelVersion }) {
  const [more, setMore] = useState(false);
  const dom = measuredDomains(v);
  const parent = s.player.models.versions.find((x) => x.id === v.parentVersionId) ?? s.player.models.versions.filter((x) => x.variant === 'full' && x.day < v.day && x.evals.measuredL !== undefined).slice(-1)[0];
  const all = BENCHMARKS.filter((b) => v.evals.bench[b.id]);
  const benches = more ? all : all.slice(0, 5);
  const horizon = v.evals.bench.horizon;
  const flags = Object.entries(v.flags).filter(([, x]) => x).map(([k]) => k);
  const uses = usesOf(s, v.id);
  const internal = uses.model.length > 0 || uses.monitor.length > 0;
  const hMin = horizon ? horizon.score : 0;
  // RD-P05: the open release is a one-way act on this model; the same gate as the release (deployGate on 'open').
  const og = deployGate(s, v, 'open');
  const openBlock = og === true ? undefined : og;
  return (
    <Card title={<span>{v.name} <span className="dim">· <Term id="variant">{VARIANT_WORD[v.variant] ?? v.variant}</Term> · {STATUS_WORD[v.status] ?? v.status}</span></span>} home="modelCard"
      right={<span className="row-i">{v.status === 'evaluating' && <button className="tag2 warn" data-test="card-evaluating" onClick={() => openEvalQueue(v.id)}><Term id="evaluating">testing</Term> <ICON.go size={11} /></button>}<Tip content={() => <LevelTip s={s} v={v} />}><span className="num big">{v.evals.measuredL !== undefined ? F.level(v.evals.measuredL) : '—'}{v.evals.measuredL !== undefined && <span className="dim small"> ± {measuredSd(v).toFixed(2)}</span>}</span></Tip></span>}>
      <div className="card-grid2">
        <div>
          <Radar values={dom} err={0.4} size={230} compare={parent ? measuredDomains(parent) : undefined} />
          <div className="small dim">{parent ? <>dashed: {parent.name} · </> : null}<Term id="domains">skill by domain</Term></div>
        </div>
        <div>
          <KV k="Monitorability" term="monitorability"><Meter value={v.monitorability} max={1} width={80} /> {v.monitorability.toFixed(2)}</KV>
          {(() => { const fpt = flopPerToken(s, v); const c = useHourCost(s, fpt, tokEff(v)); return <KV k="Cost per hour of work" term="useHourCost" tip={() => <TipCard title={<Term id="useHourCost">Cost per hour of work</Term>} value={`${F.usd(c.hour)}/h`} rows={[{ label: <Term id="useHourCost">Cost per hour of work</Term>, value: F.usd(c.hour) }, { label: <Term id="agentHour">Cost per agent-hour</Term>, value: F.usd(c.agentHour) }, { label: <Term id="h100e">$ per H100e-hour</Term>, value: F.usd(c.perH100eHour) }]} footer="Before markup and tool costs; prices per product are on Products.">Bigger models, longer reasoning and less serving know-how cost more per hour.</TipCard>}>{F.usd(c.hour)}/h</KV>; })()}
          {(() => {
            const o = dataSpecView(s, v);
            return <KV k="Data specialisation" term="dataSpec" tip={() => <TipCard title={<Term id="dataSpec">Data specialisation</Term>} value={o.rows.length ? `${o.rows.length} domains` : 'none'} rows={o.rows.map(([d, x]) => ({ label: domainWord(d), value: `${effX(x)} effective compute` }))} footer={`From the data its base model drew (data mix ${DATA_MIX_WORD[s.player.models.bases.find((b) => b.id === v.baseId)?.design.data ?? ''] ?? '—'}) and its curation; at most ${effX(o.cap)} per domain.`}>Effective compute each domain gains or loses from the base model&apos;s data mix.</TipCard>}>
              <Limit id="model.dataSpec" tone={o.capped ? 'warn' : 'quiet'}>{o.rows.length ? o.rows.slice(0, 2).map(([d, x]) => `${domainWord(d)} ${effX(x)}`).join(' · ') : 'none'}</Limit>
            </KV>;
          })()}
          <KV k="Time horizon (50%)" term="horizon">{horizon ? F.minutes(hMin) : "—"}</KV>
          <KV k="Appeal" term="appeal">{v.appeal !== undefined ? v.appeal.toFixed(2) : '—'}</KV>
          <KV k="Range" term="measureBand"><Ref id="evalMeasure" to={{ panel: 'models', tab: 'evals' }}>Models › Evals</Ref></KV>
          <KV k="Dangerous-capability flags" term="flags"><span className={flags.length ? 'tone-neg' : 'dim'}>{flags.join(', ') || 'none'}</span></KV>
          <KV k="Beliefs" term="belief"><Ref id="beliefs" to={{ panel: 'safety', tab: 'graph' }}>Safety › traits</Ref></KV>
          <table className="tbl" style={{ marginTop: 6 }}>
            <thead><tr><th><Term id="benchmark">Benchmark</Term></th><th>Score</th><th>±</th></tr></thead>
            <tbody>
              {benches.map((b) => {
                const r = v.evals.bench[b.id];
                const sat = b.ceil > 0 && r.score > b.ceil - 5;
                return (
                  <tr key={b.id}>
                    <td><Tip content={() => <TipCard title={benchName(s, b)} value={b.family}>{`Domain ${Array.isArray(b.domain) ? b.domain.map(domainWord).join(' + ') : domainWord(b.domain)}${b.dangerous ? ' · dangerous-capability' : ''}${sat ? ' · maxed out' : ''} · measured by ${r.by === 'self' ? 'your evals' : r.by === 'evalGov' ? 'government evaluators' : 'independent evaluators'}`}</TipCard>}>{benchName(s, b)}</Tip>{sat && <span className="chip-mini"><Term id="saturated">maxed out</Term></span>}{b.dangerous && <span className="tone-warn small"> ⚠</span>}</td>
                    <td className="num"><Tip content={() => <TipCard title={benchName(s, b)} value={F.bench(r.score, b.special)} rows={[{ label: 'Measured', value: fmtDate(dateOf(s, r.day)) }, { label: 'By', value: r.by === 'self' ? 'your evals' : r.by === 'evalGov' ? 'government evaluators' : 'independent evaluators' }, ...(b.special ? [] : [{ label: 'Range (±)', value: r.sd.toFixed(1) }])]} />}><span>{F.bench(r.score, b.special)}</span></Tip></td>
                    <td className="num dim">{b.special ? "" : <Tip content={() => <TipCard title="Range" value={`± ${r.sd.toFixed(1)}`}>How far this evaluator's score on this benchmark may be from the true one (two times in three).</TipCard>}><span>{r.sd.toFixed(1)}</span></Tip>}</td>
                  </tr>
                );
              })}
              {!all.length && <tr><td colSpan={3} className="dim">No evals yet</td></tr>}
            </tbody>
          </table>
          {all.length > 5 && <button className="btn btn-sm btn-ghost" data-test="bench-more" onClick={() => setMore(!more)}>{more ? 'fewer' : `all ${all.length} benchmarks`}</button>}
        </div>
      </div>
      <VersionPressure s={s} v={v} />
      <div className="act-groups">
        <div className="act-group"><span className="tip-cap">Use</span>
          <span className="small" data-test="model-uses"><ICON.agents size={12} /> {internal ? [...uses.model.map((u) => AGENT_USE_DEF[u].name), ...uses.monitor.map((u) => `safeguard on ${AGENT_USE_DEF[u].name.toLowerCase()}`)].join(' · ') : 'not used inside the company'}</span>
          <Ref id="agentPackage" to={{ panel: 'lab', tab: 'work', anchor: 'agents' }}>AI staff</Ref>
          <ActBtn id="startStream" params={{ versionId: v.id }} label="Continual learning" />
          <ActBtn id="stopStream" label="Stop continual learning" />
          <ActBtn id="idaCycle" params={{ versionId: v.id }} label="Amplify" />
        </div>
        <div className="act-group"><span className="tip-cap"><Term id="evals">Evals</Term></span>
          <button className="btn btn-sm go-btn" data-go="models.evals" data-test="card-order-evals" onClick={() => { store.select({ versionId: v.id }); store.goto('models', { tab: 'evals', anchor: 'evalOrder' }); }}><ICON.finding size={13} /> Order evals <ICON.go size={12} /></button>
        </div>
        <div className="act-group"><span className="tip-cap"><Term id="openRelease">Release</Term></span>
          <ActBtn id="releaseOpen" testId="releaseOpen" params={{ versionId: v.id }} label="Release open weights" block={openBlock} reason />
          <ActBtn id="launchDistill" params={{ teacherVersionId: v.id }} label="Distil a smaller model" block={v.variant === 'imported' ? 'Post-train the imported model first (Next run › Post-training)' : undefined} />
        </div>
        <div className="act-group"><span className="tip-cap">Retire</span>
          <ActBtn id="safety.respond" testId="rollback" params={{ kind: 'rollback', versionId: v.id }} label="Roll back" />
          <ActBtn id="retireVersion" params={{ versionId: v.id }} block={internal ? 'Runs or watches AI staff' : v.status === 'retired' ? 'Already retired' : undefined} />
        </div>
      </div>
    </Card>
  );
}

const RUN_LABEL: Record<string, string> = { post: 'Post-training', distill: 'Distil', continue: 'Continued pretraining', base: 'New pretraining' };
/** What the finished run that made this version applied (model v3 E12; home `versionPressure`): one summary line (the
 *  run's ω and its strongest signals), the signal rows one click down, with the base's pretraining signals under them. */
function VersionPressure({ s, v }: { s: GameStateV2; v: ModelVersion }) {
  const [open, setOpen] = useState(false);
  const vp = versionPressure(s, v.id);
  if (!vp.run && !vp.base) return null;
  const top = [...(vp.run?.rows ?? [])].filter((r) => r.value >= 0.005).sort((a, b) => b.value - a.value).slice(0, 3);
  return (
    <div className="mc-press" data-home="versionPressure" data-test="mc-pressure">
      <div className="row-i mc-press-hd">
        <span className="tip-cap"><Term id="trainingPressure">Pushes</Term></span>
        <span className="small dim">{vp.run ? RUN_LABEL[vp.run.kind] : 'no run of its own'}</span>
        {vp.run && <OmegaChip p={vp.run} />}
        <span className="small dim ellip">{top.map((r, i) => <Tip key={r.id} content={() => <TipCard title={<Term id={`sig:${r.id}`}>{SIGNAL_LABEL[r.id]}</Term>} value={F.num(r.value, 2)}>Strongest signals of the run; all of them open with Signals.</TipCard>}><span className="mc-top">{i ? ' · ' : ''}{SIGNAL_LABEL[r.id]} <span className="num">{F.num(r.value, 2)}</span></span></Tip>)}</span>
        <span className="sp" />
        <button className="btn btn-sm btn-ghost" data-test="mc-pressure-open" onClick={() => setOpen(!open)}>{open ? 'Hide signals' : 'Signals'}</button>
      </div>
      {open && (
        <div className="mc-press-body">
          {vp.run && <PressureRows p={vp.run} testId="mc-pressure-rows" />}
          {vp.base && (
            <>
              <div className="tip-cap">{vp.base.name} pretraining <span className="dim">· shared by every model on this base model</span></div>
              <PressureRows p={{ kind: 'base', rows: vp.base.rows, omega: { growth: 1, safety: 1, kind: 1 }, ...(vp.base.imitation ? { imitation: vp.base.imitation } : {}) }} testId="mc-pressure-base" />
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Run queue (home of each run's actual pool share and ETA, R5): the stream's share and where spare compute goes. */
export function RunQueue({ s }: { s: GameStateV2 }) {
  const runs = s.player.models.runs.filter((r) => r.status === 'running' || r.status === 'paused').concat(s.player.models.runs.filter((r) => r.status === 'done' || r.status === 'failed' || r.status === 'cancelled').slice(-3));
  const alloc = poolAllocation(s);
  const stream = streamShare(s);
  const spare = idleTrainingShare(s);
  const auto = s.player.policies.autoSplit;
  return (
    <Card title="Runs" home="runQueue" right={<button className="btn btn-sm" data-nav-to="blueprint" onClick={() => store.setPanel('blueprint')}>Next run ›</button>}>
      {runs.length === 0 && <div className="dim small">No runs</div>}
      {runs.map((r) => {
        const done = Math.min(1, r.flopDone / Math.max(1, r.flopNeeded));
        const band = runBand(s, r);
        const stall = runStall(s, r);
        const live = r.status === 'running' || r.status === 'paused';
        const got = alloc.get(r.id) ?? 0;
        const eta = live ? runEtaDays(s, r, alloc) : 0;
        const step = (d: number) => Math.round(Math.min(POOL_SHARE_RANGE[1], Math.max(POOL_SHARE_RANGE[0], r.poolShare + d)) * 100) / 100;
        return (
          <div className="run-row" key={r.id} data-run={r.id}>
            <Tip content={() => <TipCard title={runTitle(s, r)} rows={[{ label: 'Kind', value: RUN_KIND[r.kind] ?? r.kind }, { label: 'Started', value: fmtDate(dateOf(s, r.startDay)) }, { label: 'Done', value: F.pct(done) }]} />}><span className="ellip"><b>{runTitle(s, r)}</b></span></Tip>
            <Meter value={done} max={1} width={80} color={r.status === 'running' ? 'var(--accent)' : 'var(--text-3)'} />
            <Tip content={() => <TipCard title="Prediction" value={band[1] > 0 ? `level ${F.level(band[0])}–${F.level(band[1])} (10 = best human)` : '—'}>The capability this run should give when it finishes: your measured model's plus the step this run makes over it. The range is that measurement's uncertainty; evals of the result read the real one.</TipCard>}><span className="num small dim">{band[1] > 0 ? `${F.level(band[0])}–${F.level(band[1])}` : '—'}</span></Tip>
            {live ? (
              <Tip content={() => <TipCard title={<Term id="poolShare">Training share</Term>} value={F.pct(got)} rows={[
                { label: 'Asks', value: F.pct(r.poolShare) }, { label: 'Gets today', value: F.pct(got) },
                { label: 'Done', value: F.pct(done) }, { label: <Term id="flop">Compute needed</Term>, value: `${F.short(r.flopNeeded / PHI_FLOP_PER_H100E_DAY / 1e6)}M H100e-days` },
              ]} footer="Runs that ask for more than the training compute are scaled down together.">Share of training compute this run gets.</TipCard>}>
                <span className="num small run-share" data-test="run-share">{F.pct(got)}{got < r.poolShare - 1e-6 && done < 1 ? <span className="dim">/{F.pct(r.poolShare)}</span> : null}</span>
              </Tip>
            ) : <span />}
            {live && r.status === 'running' ? (
              <span className="run-step">
                <ActBtn id="runs.setShare" params={{ runId: r.id, share: step(-0.1) }} label="−" testId={`run-share-dn.${r.id}`} block={r.poolShare <= POOL_SHARE_RANGE[0] + 1e-9 ? 'At the minimum share' : undefined} />
                <ActBtn id="runs.setShare" params={{ runId: r.id, share: step(0.1) }} label="+" testId={`run-share-up.${r.id}`} block={r.poolShare >= POOL_SHARE_RANGE[1] - 1e-9 ? 'At all of training compute' : undefined} />
              </span>
            ) : <span />}
            <Tip content={() => <TipCard title={stall ?? RUN_STATE[r.status] ?? r.status} value={live && Number.isFinite(eta) ? fmtDate(dateOf(s, s.time.day + eta)) : undefined}>{live ? 'Expected finish at today\'s training share; evals follow.' : 'Finished runs stay here for a while.'}</TipCard>}><span className={`small ${stall ? 'tone-warn' : ''}`} data-test={stall ? 'run-stall' : undefined}>{stall ?? RUN_STATE[r.status] ?? r.status}{live && Number.isFinite(eta) ? <span className="dim"> · {fmtDate(dateOf(s, s.time.day + eta))}</span> : ''}</span></Tip>
            {r.status === 'running' && <ActBtn id="cancelRun" params={{ runId: r.id }} label="Cancel" inline={false} />}
          </div>
        );
      })}
      <div className="run-row run-pool small" data-run="stream"><span className="ellip"><b><Term id="stream">Continual learning</Term></b> <span className="dim">{stream > 0 ? 'on' : 'off'}</span></span><span /><span /><Tip content={() => <TipCard title={<Term id="stream">Continual learning</Term>} value={F.pct(stream)}>Share of training compute continual learning takes before any run.</TipCard>}><span className="num">{F.pct(stream)}</span></Tip><span /><Limit id="run.stream" tone={stream > 0 ? 'warn' : 'quiet'}>{stream > 0 ? 'taken first' : 'takes 15% first when on'}</Limit><span /></div>
      <div className="run-row run-pool small" data-run="spare">
        <span className="ellip"><b><Term id="idleCompute">Idle</Term></b></span><span /><span />
        <Tip content={() => <TipCard title={<Term id="idleCompute">Idle</Term>} value={F.pct(spare)}>Share of training compute no run uses now. It stays idle{auto.on && !auto.to.includes('training') ? ', unless Auto-split idle compute moves it (on)' : ''}; lower the Training share or turn on Auto-split idle compute in Compute allocation.</TipCard>}><span className="num" data-test="spare-share">{F.pct(spare)}</span></Tip>
        <span className="run-spare">
          <span className="dim">{auto.on && !auto.to.includes('training') ? '→ Auto-split' : 'idle'}</span>
          <Ref id="idleCompute" to={{ panel: 'lab', anchor: 'split' }}>Compute allocation</Ref>
        </span>
      </div>
    </Card>
  );
}

export function Models({ s }: { s: GameStateV2 }) {
  useV2();
  const v = selectedVersion(s);
  const tab = tabOf('models', 'versions');
  const tabs = <Tabs panel="models" def="versions" tabs={[{ id: 'versions', label: 'Models', icon: ICON.models }, { id: 'suites', label: 'Environments', icon: Dumbbell }, { id: 'data', label: 'Data', icon: Database }, { id: 'evals', label: 'Evals', icon: ListChecks, badge: s.player.models.evals?.length || undefined }]} />;
  if (tab === 'suites') {
    return (
      <div className="panel-v2" data-panel="models">
        <PanelHead icon={ICON.models} title="Models" sub="environments your post-training runs practise in" tabs={tabs} />
        <Suites s={s} />
      </div>
    );
  }
  if (tab === 'data') {
    return (
      <div className="panel-v2" data-panel="models">
        <PanelHead icon={ICON.models} title="Models" sub="what your base models train on: tokens, quality, domains" tabs={tabs} />
        <DataView s={s} />
      </div>
    );
  }
  if (tab === 'evals') {
    return (
      <div className="panel-v2" data-panel="models">
        <PanelHead icon={ICON.models} title="Models" sub="what your evals cost, what is queued and how sure each reading is" tabs={tabs} />
        <Evals s={s} v={v} />
      </div>
    );
  }
  return (
    <div className="panel-v2 models-grid" data-panel="models">
      <div className="span2"><PanelHead icon={ICON.models} title="Models" sub="click a model in the lineage to open its card" tabs={tabs} /></div>
      <Card title="Lineage" home="lineage"><Lineage s={s} sel={v?.id} /></Card>
      <div className="col2">
        {v ? <ModelCard s={s} v={v} /> : <Card title="Model card"><div className="dim">No models</div></Card>}
        <RunQueue s={s} />
      </div>
    </div>
  );
}
