// Models (§6.3): lineage tree (bases → versions → variants), model card (measured L, domain radar with error bars,
// benchmarks with saturation marks, horizon, serve cost, monitorability, trait beliefs, flags), run queue (paradigms moved to
// Research in R4); set internal agent, evals, variants, distill, roll back, retire, streams.
import { BENCHMARKS } from '../../../data/v2/benchmarks';
import { AGENT_USE_DEF } from '../../../data/v2/agents';
import {
  POOL_SHARE_RANGE, benchName, dateOf, designOffsetView, fmtDate, idleTrainingShare, internalVersion, measuredDomains, poolAllocation, runBand, runEtaDays, runStall, streamShare,
  usesOf, versionById,
} from '../../../engine/v2';
import type { GameStateV2, ModelVersion } from '../../../engine/v2';
import { store, useV2 } from '../store';
import { ActBtn, Limit, Meter, Radar, Term, Tip, TipCard } from '../ui';
import { useState } from 'react';
import { Card, KV, PanelHead, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';

const STATUS_TONE: Record<string, string> = { evaluating: 'tone-warn', ready: 'tone-pos', deployed: 'tone-pos', retired: 'dim', rolledBack: 'tone-neg' };

export function selectedVersion(s: GameStateV2): ModelVersion | undefined {
  return versionById(s, store.sel.versionId) ?? internalVersion(s) ?? s.player.models.versions[s.player.models.versions.length - 1];
}

function Lineage({ s, sel }: { s: GameStateV2; sel?: string }) {
  const m = s.player.models;
  return (
    <div className="lineage" data-test="lineage">
      {m.bases.map((b) => (
        <div key={b.id} className="lin-base">
          <Tip as="div" content={() => <TipCard title={b.name} rows={[
            { label: 'Done', value: fmtDate(dateOf(s, b.day)) }, { label: <Term id="baseSize">Size</Term>, value: `${F.size(b.design.size)} · ${b.design.shape}` },
            { label: 'Data', value: b.design.data }, { label: <Term id="licensedShare">Licensed share</Term>, value: F.pct(b.design.licensedShare) }, { label: <Term id="flop">FLOP</Term>, value: b.flop.toExponential(1) },
          ]} />}>
            <div className="lin-base-row"><b>{b.name}</b><span className="dim small">{F.size(b.design.size)} · {b.design.shape} · {b.design.data}</span></div>
          </Tip>
          {m.versions.filter((v) => v.baseId === b.id && !m.versions.some((p) => p.id === v.parentVersionId && p.baseId === b.id)).map((v) => (
            <VersionTree key={v.id} s={s} v={v} sel={sel} depth={1} />
          ))}
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
function VersionRow({ s, v, sel, depth }: { s: GameStateV2; v: ModelVersion; sel?: string; depth: number }) {
  const internal = usesOf(s, v.id).model.length > 0;
  return (
    <button className={`lin-ver ${sel === v.id ? 'active' : ''}`} style={{ paddingLeft: 8 + depth * 14 }} data-version={v.id} onClick={() => store.select({ versionId: v.id })}>
      <span>{v.name}</span>
      {v.variant !== 'full' && <span className="chip-mini">{v.variant}</span>}
      {internal && <span className="chip-mini tone-pos"><Term id="internalAgent">internal</Term></span>}
      <span className={`small ${STATUS_TONE[v.status]}`}>{v.status}</span>
      <span className="num small">{v.evals.measuredL !== undefined ? `L ${F.level(v.evals.measuredL)}` : '—'}</span>
    </button>
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
      right={<span className="num big">L {v.evals.measuredL !== undefined ? F.level(v.evals.measuredL) : '—'}{v.evals.measuredL === undefined && <span className="tag2 warn" style={{ marginLeft: 6 }}><Term id="evaluating">evaluating</Term></span>}</span>}>
      <div className="card-grid2">
        <div>
          <Radar values={dom} err={0.4} size={230} compare={parent ? measuredDomains(parent) : undefined} />
          <div className="small dim">{parent ? <>dashed: {parent.name} · </> : null}<Term id="domains">domains</Term></div>
        </div>
        <div>
          <KV k="Monitorability" term="monitorability"><Meter value={v.monitorability} max={1} width={80} /> {v.monitorability.toFixed(2)}</KV>
          <KV k="Serve cost" term="serveCost">{F.mult(v.serveCost)}</KV>
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
                    <td className="num">{F.bench(r.score, b.special)}</td><td className="num dim">{b.special ? "" : r.sd.toFixed(1)}</td>
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
          <ActBtn id="launchDistill" params={{ teacherVersionId: v.id }} label="Distill a mini" />
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
            <span className="ellip"><b>{r.name}</b> <span className="dim small">{r.kind}</span></span>
            <Meter value={done} max={1} width={80} color={r.status === 'running' ? 'var(--accent)' : 'var(--text-3)'} />
            <span className="num small dim">L {F.level(band[0])}–{F.level(band[1])}</span>
            {live ? (
              <Tip content={() => <TipCard title={<Term id="poolShare">Pool share</Term>} value={F.pct(got)} rows={[
                { label: 'Asks', value: F.pct(r.poolShare) }, { label: 'Gets today', value: F.pct(got) },
                { label: 'FLOP done', value: F.pct(done) }, { label: 'Minimum length', value: F.days(r.minDays) },
              ]} footer={done >= 1 ? 'FLOP done: it only waits for its minimum length and takes no share.' : 'Runs that ask for more than the pool are scaled down together.'}>Share of the training pool this run gets.</TipCard>}>
                <span className="num small run-share" data-test="run-share">{F.pct(got)}{got < r.poolShare - 1e-6 && done < 1 ? <span className="dim">/{F.pct(r.poolShare)}</span> : null}</span>
              </Tip>
            ) : <span />}
            {live && r.status === 'running' ? (
              <span className="run-step">
                <ActBtn id="runs.setShare" params={{ runId: r.id, share: step(-0.1) }} label="−" testId={`run-share-dn.${r.id}`} block={r.poolShare <= POOL_SHARE_RANGE[0] + 1e-9 ? 'At the minimum share' : undefined} />
                <ActBtn id="runs.setShare" params={{ runId: r.id, share: step(0.1) }} label="+" testId={`run-share-up.${r.id}`} block={r.poolShare >= POOL_SHARE_RANGE[1] - 1e-9 ? 'At the whole pool' : undefined} />
              </span>
            ) : <span />}
            <span className={`small ${stall ? 'tone-warn' : ''}`} data-test={stall ? 'run-stall' : undefined}>{stall ?? r.status}{live && Number.isFinite(eta) ? <span className="dim"> · {fmtDate(dateOf(s, s.time.day + eta))}</span> : ''}</span>
            {r.status === 'running' && <ActBtn id="cancelRun" params={{ runId: r.id }} label="Cancel" inline={false} />}
          </div>
        );
      })}
      <div className="run-row run-pool small" data-run="stream"><span className="ellip"><b><Term id="stream">Stream</Term></b> <span className="dim">{stream > 0 ? 'continual learning' : 'off'}</span></span><span /><span /><span className="num">{F.pct(stream)}</span><span /><Limit id="run.stream" tone={stream > 0 ? 'warn' : 'quiet'}>{stream > 0 ? 'taken first' : 'takes 15% first when on'}</Limit><span /></div>
      <div className="run-row run-pool small" data-run="spare">
        <span className="ellip"><b><Term id="spareTraining">Spare</Term></b></span><span /><span />
        <span className="num" data-test="spare-share">{F.pct(spare)}</span>
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
