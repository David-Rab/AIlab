// Models (§6.3): lineage tree (bases → versions → variants), model card (measured L, domain radar with error bars,
// benchmarks with saturation marks, horizon, serving FLOP per token and cost per hour, monitorability, trait beliefs, flags), run queue (paradigms moved to
// Research in R4); set internal agent, evals, variants, distill, roll back, retire, streams.
import { BENCHMARKS } from '../../../data/v2/benchmarks';
import { AGENT_USE_DEF } from '../../../data/v2/agents';
import {
  POOL_SHARE_RANGE, benchName, dateOf, designOffsetView, fmtDate, idleTrainingShare, internalVersion, measuredDomains, measuredSd, poolAllocation, runBand, runEtaDays, runStall, streamShare,
  flopPerToken, useHourCost, usesOf, versionById,
} from '../../../engine/v2';
import type { GameStateV2, ModelVersion } from '../../../engine/v2';
import { store, useV2 } from '../store';
import { ActBtn, Limit, Meter, Radar, Term, Tip, TipCard } from '../ui';
import { useState } from 'react';
import { Card, KV, PanelHead, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';

const STATUS_TONE: Record<string, string> = { evaluating: 'tone-warn', ready: 'tone-pos', deployed: 'tone-pos', retired: 'dim', rolledBack: 'tone-neg' };
const RUN_KIND: Record<string, string> = { base: 'base run', post: 'post-train', distill: 'distill', continue: 'continue' };
/** Jank M5: a run named by its target ("Atlas-3 base · post-train"), not its internal id ("post 21 post"). */
/** Active parameters: 400B, 1.6T. */
export const fmtParams = (n: number) => (n >= 1e12 ? `${+(n / 1e12).toFixed(n >= 1e13 ? 0 : 1)}T` : `${Math.round(n / 1e9)}B`);

export function runTitle(s: GameStateV2, r: GameStateV2['player']['models']['runs'][number]): string {
  const base = s.player.models.bases.find((b) => b.id === r.baseId);
  const teacher = r.teacherVersionId ? versionById(s, r.teacherVersionId) : undefined;
  if (r.kind === 'base') return `New base${r.base ? ` · ${fmtParams(r.base.params)}` : ''}`;
  if (r.kind === 'distill') return `Mini of ${teacher?.name ?? base?.name ?? 'a teacher'}`;
  return `${base?.name ?? 'Base'} · ${RUN_KIND[r.kind] ?? r.kind}`;
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
            { label: 'Done', value: fmtDate(dateOf(s, b.day)) }, { label: <Term id="baseSize">Size</Term>, value: `${fmtParams(b.params)} active × ${b.design.tpp} tokens · ${b.design.shape}` },
            { label: 'Data', value: b.design.data }, { label: <Term id="licensedShare">Licensed share</Term>, value: F.pct(b.design.licensedShare) }, { label: <Term id="flop">FLOP</Term>, value: b.flop.toExponential(1) },
          ]} />}>
            <div className="lin-base-row"><b>{b.name}</b><span className="dim small">{fmtParams(b.params)} · {b.design.shape} · {b.design.data}</span></div>
          </Tip>
          {m.versions.filter((v) => v.baseId === b.id && !m.versions.some((p) => p.id === v.parentVersionId && p.baseId === b.id)).map((v) => (
            <VersionTree key={v.id} s={s} v={v} sel={sel} depth={1} />
          ))}
          {/* Jank M5: a finished base with no version yet says what it needs. */}
          {!m.versions.some((v) => v.baseId === b.id) && (
            <div className="lin-ver lin-note small dim" data-test="base-needs-post">{m.runs.some((r) => r.baseId === b.id && (r.status === 'running' || r.status === 'paused')) ? 'base done · post-training now' : 'base done · needs post-training'}<button className="btn btn-sm btn-ghost" onClick={() => store.goto('blueprint')}>Blueprint ›</button></div>
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
      {v.variant !== 'full' && <span className="chip-mini">{v.variant}</span>}
      {best && <Tip content={() => <TipCard title="Best of its kind">{`The ${v.variant} version with the highest measured level that is ready to use.`}</TipCard>}><span className="chip-mini tone-pos" data-test="best-badge">best</span></Tip>}
      {internal && <span className="chip-mini tone-pos"><Term id="internalAgent">internal</Term></span>}
      <span className={`small ${STATUS_TONE[v.status]}`}>{v.status}</span>
      <Tip content={() => <LevelTip s={s} v={v} />}><span className="num small">{v.evals.measuredL !== undefined ? `L ${F.level(v.evals.measuredL)}` : '—'}</span></Tip>
    </button>
  );
}
/** Measured level with its band (jank M1): drawn once per version, narrowing with each eval suite. */
function LevelTip({ s, v }: { s: GameStateV2; v: ModelVersion }) {
  if (v.evals.measuredL === undefined) return <TipCard title={<Term id="L">Measured level</Term>} value="evaluating">The eval suite reports a level when it finishes.</TipCard>;
  const sd = measuredSd(v);
  return (
    <TipCard title={<Term id="L">Measured level</Term>} value={`L ${F.level(v.evals.measuredL)} ± ${sd.toFixed(2)}`} rows={[
      { label: 'Eval suites run', value: String(v.evals.nSuites ?? 1) },
      { label: 'Last suite', value: v.evals.suiteDay !== undefined ? fmtDate(dateOf(s, v.evals.suiteDay)) : '—' },
    ]} footer="A model does not change between suites; each new suite narrows the band (±0.2 after one, ±0.1 after four).">The estimate your evals give of this version's general level.</TipCard>
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
  return (
    <Card title={<span>{v.name} <span className="dim">· <Term id="variant">{v.variant}</Term> · {v.status}</span></span>} home="modelCard"
      right={<Tip content={() => <LevelTip s={s} v={v} />}><span className="num big">L {v.evals.measuredL !== undefined ? F.level(v.evals.measuredL) : '—'}{v.evals.measuredL !== undefined && <span className="dim small"> ± {measuredSd(v).toFixed(2)}</span>}{v.evals.measuredL === undefined && <span className="tag2 warn" style={{ marginLeft: 6 }}><Term id="evaluating">evaluating</Term></span>}</span></Tip>}>
      <div className="card-grid2">
        <div>
          <Radar values={dom} err={0.4} size={230} compare={parent ? measuredDomains(parent) : undefined} />
          <div className="small dim">{parent ? <>dashed: {parent.name} · </> : null}<Term id="domains">domains</Term></div>
        </div>
        <div>
          <KV k="Monitorability" term="monitorability"><Meter value={v.monitorability} max={1} width={80} /> {v.monitorability.toFixed(2)}</KV>
          {(() => { const fpt = flopPerToken(s, v); const c = useHourCost(s, fpt); return <KV k="Serving" term="servingFlop" tip={() => <TipCard title={<Term id="servingFlop">Serving</Term>} value={`${F.sci(fpt)} FLOP/token`} rows={[{ label: <Term id="useHourCost">Cost per hour of use</Term>, value: F.usd(c.hour) }, { label: <Term id="agentHour">Cost per agent-hour</Term>, value: F.usd(c.agentHour) }, { label: <Term id="h100e">$ per H100e-hour</Term>, value: F.usd(c.perH100eHour) }]} footer="Before markup and feature token multipliers; prices per product are on Products.">2 × active parameters × the architecture's token multiplier × serving efficiency.</TipCard>}>{F.sci(fpt)} FLOP/tok · {F.usd(c.hour)}/h</KV>; })()}
          {(() => { const o = designOffsetView(s, v); return <KV k="Research boost" term="designOffset"><Limit id="model.designOffset" tone={o.capped ? 'warn' : 'quiet'}>{o.years === 0 ? 'none' : `${o.years > 0 ? '+' : '−'}${Math.abs(o.years * 12).toFixed(1)} mo`}{o.capped ? ' (cap ±6 mo)' : ' · cap ±6 mo'}</Limit></KV>; })()}
          <KV k="Time horizon (50%)" term="horizon">{horizon ? F.minutes(hMin) : "—"}</KV>
          <KV k="Appeal" term="appeal">{v.appeal !== undefined ? v.appeal.toFixed(2) : '—'}</KV>
          <KV k="Last eval suite" term="evals">{v.evals.suiteDay !== undefined ? fmtDate(dateOf(s, v.evals.suiteDay)) : 'never'}</KV>
          <KV k="Dangerous-capability flags" term="flags"><span className={flags.length ? 'tone-neg' : 'dim'}>{flags.join(', ') || 'none'}</span></KV>
          <KV k="Trait beliefs" term="belief"><Ref id="beliefs" to={{ panel: 'safety', tab: 'graph' }}>Safety › trait graph</Ref></KV>
          <table className="tbl" style={{ marginTop: 6 }}>
            <thead><tr><th><Term id="benchmark">Benchmark</Term></th><th>Score</th><th>±</th></tr></thead>
            <tbody>
              {benches.map((b) => {
                const r = v.evals.bench[b.id];
                const sat = b.ceil > 0 && r.score > b.ceil - 5;
                return (
                  <tr key={b.id}>
                    <td><Tip content={() => <TipCard title={benchName(s, b)} value={b.family}>{`Domain ${Array.isArray(b.domain) ? b.domain.join('+') : b.domain}${b.dangerous ? ' · dangerous-capability' : ''}${sat ? ' · saturated' : ''} · measured by ${r.by}`}</TipCard>}>{benchName(s, b)}</Tip>{sat && <span className="chip-mini"><Term id="saturated">sat</Term></span>}{b.dangerous && <span className="tone-warn small"> ⚠</span>}</td>
                    <td className="num"><Tip content={() => <TipCard title={benchName(s, b)} value={F.bench(r.score, b.special)} rows={[{ label: 'Measured', value: fmtDate(dateOf(s, r.day)) }, { label: 'By', value: r.by === 'self' ? 'your evals' : r.by === 'evalGov' ? 'government evaluators' : 'independent evaluators' }, ...(b.special ? [] : [{ label: 'Noise (±1 SD)', value: r.sd.toFixed(1) }])]} />}><span>{F.bench(r.score, b.special)}</span></Tip></td>
                    <td className="num dim">{b.special ? "" : <Tip content={() => <TipCard title="Measurement noise" value={`± ${r.sd.toFixed(1)}`}>One standard deviation of this evaluator's score on this benchmark.</TipCard>}><span>{r.sd.toFixed(1)}</span></Tip>}</td>
                  </tr>
                );
              })}
              {!all.length && <tr><td colSpan={3} className="dim">No evals yet</td></tr>}
            </tbody>
          </table>
          {all.length > 5 && <button className="btn btn-sm btn-ghost" data-test="bench-more" onClick={() => setMore(!more)}>{more ? 'fewer' : `all ${all.length} benchmarks`}</button>}
        </div>
      </div>
      <div className="act-groups">
        <div className="act-group"><span className="tip-cap">Use</span>
          <span className="small" data-test="model-uses"><ICON.agents size={12} /> {internal ? [...uses.model.map((u) => AGENT_USE_DEF[u].name), ...uses.monitor.map((u) => `monitor on ${AGENT_USE_DEF[u].name.toLowerCase()}`)].join(' · ') : 'not used inside the company'}</span>
          <Ref id="agentPackage" to={{ panel: 'company', tab: 'people', anchor: 'agents' }}>Agents at work</Ref>
          <ActBtn id="startStream" params={{ versionId: v.id }} label="Continual learning" />
          <ActBtn id="stopStream" label="Stop stream" />
          <ActBtn id="idaCycle" params={{ versionId: v.id }} label="Amplify (IDA)" />
        </div>
        <div className="act-group"><span className="tip-cap"><Term id="evals">Evaluate</Term></span>
          <ActBtn id="runEvals" params={{ versionId: v.id, by: 'self' }} label="Own evals" icon={ICON.finding} />
          <ActBtn id="runEvals" testId="runEvals.evalGov" params={{ versionId: v.id, by: 'evalGov' }} label="Gov evaluators" />
          <ActBtn id="runEvals" testId="runEvals.evalIndep" params={{ versionId: v.id, by: 'evalIndep' }} label="Independent" />
        </div>
        <div className="act-group"><span className="tip-cap"><Term id="variant">Variants</Term></span>
          <ActBtn id="makeVariant" params={{ versionId: v.id, variant: 'gov' }} label="Gov" />
          <ActBtn id="makeVariant" testId="makeVariant.trusted" params={{ versionId: v.id, variant: 'trusted' }} label="Trusted" />
          <ActBtn id="makeVariant" testId="makeVariant.open" params={{ versionId: v.id, variant: 'open' }} label="Open weights" />
          <ActBtn id="launchDistill" params={{ teacherVersionId: v.id }} label="Distill a mini" block={v.variant === 'imported' ? 'Post-train the imported model first (Blueprint › Post-train)' : undefined} />
        </div>
        <div className="act-group"><span className="tip-cap">Retire</span>
          <ActBtn id="safety.respond" testId="rollback" params={{ kind: 'rollback', versionId: v.id }} label="Roll back" />
          <ActBtn id="retireVersion" params={{ versionId: v.id }} block={internal ? 'Powers or monitors internal agents' : v.status === 'retired' ? 'Already retired' : undefined} />
        </div>
      </div>
    </Card>
  );
}

/** Run queue (home of each run's actual pool share and ETA, R5): the stream's share and where spare compute goes. */
export function RunQueue({ s }: { s: GameStateV2 }) {
  const runs = s.player.models.runs.filter((r) => r.status === 'running' || r.status === 'paused').concat(s.player.models.runs.filter((r) => r.status === 'done' || r.status === 'failed' || r.status === 'cancelled').slice(-3));
  const alloc = poolAllocation(s);
  const stream = streamShare(s);
  const spare = idleTrainingShare(s);
  const spareUse = s.player.policies.spareTraining;
  return (
    <Card title="Runs in progress" home="runQueue" right={<button className="btn btn-sm" data-nav-to="blueprint" onClick={() => store.setPanel('blueprint')}>Blueprint ›</button>}>
      {runs.length === 0 && <div className="dim small">No runs</div>}
      {runs.map((r) => {
        const done = Math.min(1, r.flopDone / Math.max(1, r.flopNeeded));
        const band = runBand(r);
        const stall = runStall(s, r);
        const live = r.status === 'running' || r.status === 'paused';
        const got = alloc.get(r.id) ?? 0;
        const eta = live ? runEtaDays(s, r, alloc) : 0;
        const step = (d: number) => Math.round(Math.min(POOL_SHARE_RANGE[1], Math.max(POOL_SHARE_RANGE[0], r.poolShare + d)) * 100) / 100;
        return (
          <div className="run-row" key={r.id} data-run={r.id}>
            <Tip content={() => <TipCard title={runTitle(s, r)} rows={[{ label: 'Kind', value: r.kind }, { label: 'Started', value: fmtDate(dateOf(s, r.startDay)) }, { label: 'FLOP done', value: F.pct(done) }]} />}><span className="ellip"><b>{runTitle(s, r)}</b></span></Tip>
            <Meter value={done} max={1} width={80} color={r.status === 'running' ? 'var(--accent)' : 'var(--text-3)'} />
            <Tip content={() => <TipCard title="Predicted level" value={`L ${F.level(band[0])}–${F.level(band[1])}`}>The run's predicted general level when it finishes (a band: the result is drawn at the end).</TipCard>}><span className="num small dim">L {F.level(band[0])}–{F.level(band[1])}</span></Tip>
            {live ? (
              <Tip content={() => <TipCard title={<Term id="poolShare">Pool share</Term>} value={F.pct(got)} rows={[
                { label: 'Asks', value: F.pct(r.poolShare) }, { label: 'Gets today', value: F.pct(got) },
                { label: 'FLOP done', value: F.pct(done) }, { label: <Term id="flop">FLOP</Term>, value: r.flopNeeded.toExponential(1) },
              ]} footer="Runs that ask for more than the pool are scaled down together.">Share of the training pool this run gets.</TipCard>}>
                <span className="num small run-share" data-test="run-share">{F.pct(got)}{got < r.poolShare - 1e-6 && done < 1 ? <span className="dim">/{F.pct(r.poolShare)}</span> : null}</span>
              </Tip>
            ) : <span />}
            {live && r.status === 'running' ? (
              <span className="run-step">
                <ActBtn id="runs.setShare" params={{ runId: r.id, share: step(-0.1) }} label="−" testId={`run-share-dn.${r.id}`} block={r.poolShare <= POOL_SHARE_RANGE[0] + 1e-9 ? 'At the minimum share' : undefined} />
                <ActBtn id="runs.setShare" params={{ runId: r.id, share: step(0.1) }} label="+" testId={`run-share-up.${r.id}`} block={r.poolShare >= POOL_SHARE_RANGE[1] - 1e-9 ? 'At the whole pool' : undefined} />
              </span>
            ) : <span />}
            <Tip content={() => <TipCard title={stall ?? r.status} value={live && Number.isFinite(eta) ? fmtDate(dateOf(s, s.time.day + eta)) : undefined}>{live ? 'Expected finish at today\'s pool share; evals follow.' : 'Finished runs stay here for a while.'}</TipCard>}><span className={`small ${stall ? 'tone-warn' : ''}`} data-test={stall ? 'run-stall' : undefined}>{stall ?? r.status}{live && Number.isFinite(eta) ? <span className="dim"> · {fmtDate(dateOf(s, s.time.day + eta))}</span> : ''}</span></Tip>
            {r.status === 'running' && <ActBtn id="cancelRun" params={{ runId: r.id }} label="Cancel" inline={false} />}
          </div>
        );
      })}
      <div className="run-row run-pool small" data-run="stream"><span className="ellip"><b><Term id="stream">Stream</Term></b> <span className="dim">{stream > 0 ? 'continual learning' : 'off'}</span></span><span /><span /><Tip content={() => <TipCard title={<Term id="stream">Stream share</Term>} value={F.pct(stream)}>Share of the training pool the continual-learning stream takes before any run.</TipCard>}><span className="num">{F.pct(stream)}</span></Tip><span /><Limit id="run.stream" tone={stream > 0 ? 'warn' : 'quiet'}>{stream > 0 ? 'taken first' : 'takes 15% first when on'}</Limit><span /></div>
      <div className="run-row run-pool small" data-run="spare">
        <span className="ellip"><b><Term id="spareTraining">Spare</Term></b></span><span /><span />
        <Tip content={() => <TipCard title={<Term id="spareTraining">Spare training compute</Term>} value={F.pct(spare)}>Share of the training pool no run uses now; it goes to {spareUse === 'research' ? 'experiments' : 'data generation'}.</TipCard>}><span className="num" data-test="spare-share">{F.pct(spare)}</span></Tip>
        <span className="run-spare">
          <span className="dim">→ {spareUse === 'research' ? 'experiments' : 'data generation'}</span>
          <Ref id="spareTraining" to={{ panel: 'compute', tab: 'split', anchor: 'split-spare' }}>Split</Ref>
        </span>
      </div>
    </Card>
  );
}

export function Models({ s }: { s: GameStateV2 }) {
  useV2();
  const v = selectedVersion(s);
  return (
    <div className="panel-v2 models-grid" data-panel="models">
      <div className="span2"><PanelHead icon={ICON.models} title="Models" sub="click a version in the lineage to open its card" /></div>
      <Card title="Lineage" home="lineage"><Lineage s={s} sel={v?.id} /></Card>
      <div className="col2">
        {v ? <ModelCard s={s} v={v} /> : <Card title="Model card"><div className="dim">No versions</div></Card>}
        <RunQueue s={s} />
      </div>
    </div>
  );
}
