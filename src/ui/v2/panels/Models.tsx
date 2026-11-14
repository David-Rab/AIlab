// Models (§6.3): lineage tree (bases → versions → variants), model card (measured L, domain radar with error bars,
// benchmarks with saturation marks, horizon, serve cost, monitorability, trait beliefs, flags), run queue, paradigm
// tree; set internal agent, evals, variants, distill, roll back, retire, streams.
import { BENCHMARKS } from '../../../data/v2/benchmarks';
import { PARADIGMS } from '../../../data/v2/paradigms';
import { TRAIT_BY_ID, TRAIT_ORDER } from '../../../data/v2/traits';
import { benchName, dateOf, fmtDate, internalVersion, measuredDomains, paradigmGate, runBand, versionById } from '../../../engine/v2';
import type { GameStateV2, ModelVersion } from '../../../engine/v2';
import { store, useV2 } from '../store';
import { ActBtn, Band, Gate, Meter, pct, Radar, Row, Section, Term, Tip, TipCard, unlocked } from '../ui';

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
            { label: 'Done', value: fmtDate(dateOf(s, b.day)) }, { label: 'Scale · shape', value: `${b.design.scale} · ${b.design.shape}` },
            { label: 'Data', value: b.design.data }, { label: 'Licensed share', value: pct(b.design.licensedShare) }, { label: 'FLOP', value: b.flop.toExponential(1) },
          ]} />}>
            <div className="lin-base-row"><b>{b.name}</b><span className="dim small">{b.design.scale} · {b.design.shape} · {b.design.data}</span></div>
          </Tip>
          {m.versions.filter((v) => v.baseId === b.id && !v.parentVersionId).map((v) => (
            <div key={v.id}>
              <VersionRow s={s} v={v} sel={sel} depth={1} />
              {m.versions.filter((x) => x.parentVersionId === v.id).map((x) => <VersionRow key={x.id} s={s} v={x} sel={sel} depth={2} />)}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
function VersionRow({ s, v, sel, depth }: { s: GameStateV2; v: ModelVersion; sel?: string; depth: number }) {
  const internal = s.player.models.internalAgent === v.id;
  return (
    <button className={`lin-ver ${sel === v.id ? 'active' : ''}`} style={{ paddingLeft: 8 + depth * 14 }} data-version={v.id} onClick={() => store.select({ versionId: v.id })}>
      <span>{v.name}</span>
      {v.variant !== 'full' && <span className="chip-mini">{v.variant}</span>}
      {internal && <span className="chip-mini tone-pos">internal</span>}
      <span className={`small ${STATUS_TONE[v.status]}`}>{v.status}</span>
      <span className="num small">{v.evals.measuredL !== undefined ? `L ${v.evals.measuredL.toFixed(2)}` : '—'}</span>
    </button>
  );
}

export function ModelCard({ s, v }: { s: GameStateV2; v: ModelVersion }) {
  const dom = measuredDomains(v);
  const benches = BENCHMARKS.filter((b) => v.evals.bench[b.id]);
  const horizon = v.evals.bench.horizon;
  const flags = Object.entries(v.flags).filter(([, x]) => x).map(([k]) => k);
  return (
    <Section title={<span>{v.name} <span className="dim">· {v.variant} · {v.status}</span></span>} right={<span className="num">L {v.evals.measuredL?.toFixed(2) ?? '—'}</span>}>
      <div className="card-grid">
        <div>
          <Radar values={dom} err={0.4} />
          <Row label={<Term id="monitorability">Monitorability</Term>}><Meter value={v.monitorability} max={1} width={80} /><span className="num">{v.monitorability.toFixed(2)}</span></Row>
          <Row label="Serve cost"><span className="num">{v.serveCost.toFixed(2)}×</span></Row>
          <Row label="Horizon h50"><span className="num">{horizon ? `${horizon.score.toFixed(0)} min` : '—'}</span></Row>
          <Row label="Appeal"><span className="num">{v.appeal?.toFixed(2) ?? '—'}</span></Row>
          <Row label="Last eval"><span className="num">{v.evals.suiteDay !== undefined ? fmtDate(dateOf(s, v.evals.suiteDay)) : 'never'}</span></Row>
          <Row label="Flags"><span className={flags.length ? 'tone-neg small' : 'dim small'}>{flags.join(', ') || 'none'}</span></Row>
        </div>
        <div>
          <table className="tbl">
            <thead><tr><th>Benchmark</th><th>Score</th><th>±</th><th>By</th></tr></thead>
            <tbody>
              {benches.map((b) => {
                const r = v.evals.bench[b.id];
                const sat = b.ceil > 0 && r.score > b.ceil - 5;
                return (
                  <tr key={b.id}>
                    <td><Tip content={() => <TipCard title={benchName(s, b)} value={b.family}>{`Domain ${Array.isArray(b.domain) ? b.domain.join('+') : b.domain}${b.dangerous ? ' · dangerous-capability' : ''}${sat ? ' · saturated' : ''}`}</TipCard>}>{benchName(s, b)}</Tip>{sat && <span className="chip-mini">sat</span>}{b.dangerous && <span className="tone-warn small"> ⚠</span>}</td>
                    <td className="num">{r.score.toFixed(b.special ? 0 : 1)}</td><td className="num dim">{r.sd.toFixed(1)}</td><td className="small dim">{r.by}</td>
                  </tr>
                );
              })}
              {!benches.length && <tr><td colSpan={4} className="dim">No evals yet</td></tr>}
            </tbody>
          </table>
          <div className="beliefs">
            {TRAIT_ORDER.map((t) => {
              const b = v.beliefs[t];
              if (!b) return null;
              return (
                <Tip as="div" key={t} content={() => <TipCard title={TRAIT_BY_ID[t].name} value={`${b.est.toFixed(2)} ± ${b.sd.toFixed(2)}`} rows={[{ label: 'Clarity', value: pct(b.clarity) }, { label: 'Last observed', value: b.lastObsDay !== undefined ? fmtDate(dateOf(s, b.lastObsDay)) : '—' }]}>{TRAIT_BY_ID[t].desc}</TipCard>}>
                  <div className="belief-row"><span className="small ellip">{TRAIT_BY_ID[t].name}</span><Band lo={Math.max(0, b.est - b.sd)} hi={Math.min(1, b.est + b.sd)} mid={b.est} color={b.est > 0.4 ? 'var(--neg)' : 'var(--warn)'} width={90} /></div>
                </Tip>
              );
            })}
          </div>
        </div>
      </div>
      <div className="btn-row wrap">
        <ActBtn id="setInternalAgent" params={{ versionId: v.id }} label="Make internal" />
        <ActBtn id="runEvals" params={{ versionId: v.id, by: 'self' }} label="Evals" />
        <ActBtn id="runEvals" testId="runEvals.evalGov" params={{ versionId: v.id, by: 'evalGov' }} label="Gov evals" />
        <ActBtn id="runEvals" testId="runEvals.evalIndep" params={{ versionId: v.id, by: 'evalIndep' }} label="Indep evals" />
        <ActBtn id="makeVariant" params={{ versionId: v.id, variant: 'gov' }} label="Gov variant" />
        <ActBtn id="makeVariant" testId="makeVariant.trusted" params={{ versionId: v.id, variant: 'trusted' }} label="Trusted variant" />
        <ActBtn id="makeVariant" testId="makeVariant.open" params={{ versionId: v.id, variant: 'open' }} label="Open weights" />
        <ActBtn id="launchDistill" params={{ teacherVersionId: v.id }} label="Distill" />
        <ActBtn id="safety.respond" testId="rollback" params={{ kind: 'rollback', versionId: v.id }} label="Roll back" />
        <ActBtn id="retireVersion" params={{ versionId: v.id }} block={s.player.models.internalAgent === v.id ? "Powers the internal agents" : v.status === "retired" ? "Already retired" : undefined} />
        <ActBtn id="startStream" params={{ versionId: v.id }} />
        <ActBtn id="stopStream" />
        <ActBtn id="idaCycle" params={{ versionId: v.id }} />
      </div>
    </Section>
  );
}

export function RunQueue({ s }: { s: GameStateV2 }) {
  const runs = s.player.models.runs.filter((r) => r.status === 'running' || r.status === 'paused').concat(s.player.models.runs.filter((r) => r.status === 'done' || r.status === 'failed' || r.status === 'cancelled').slice(-3));
  return (
    <Section title="Run queue" right={<button className="btn btn-sm" data-nav-to="rundesigner" onClick={() => store.setPanel('rundesigner')}>Design run</button>}>
      {runs.length === 0 && <div className="dim small">No runs</div>}
      {runs.map((r) => {
        const done = r.flopDone / Math.max(1, r.flopNeeded);
        const band = runBand(r);
        return (
          <div className="run-row" key={r.id} data-run={r.id}>
            <span className="ellip"><b>{r.name}</b> <span className="dim small">{r.kind}</span></span>
            <Meter value={done} max={1} width={90} color={r.status === 'running' ? 'var(--accent)' : 'var(--text-3)'} />
            <span className="num small">{pct(done)}</span>
            <span className="num small dim">L {band[0].toFixed(1)}–{band[1].toFixed(1)}</span>
            <span className="small">{r.status}{r.holdUntil !== undefined && r.holdUntil > s.time.day ? ' · spike' : ''}</span>
            {r.status === 'running' && <ActBtn id="cancelRun" params={{ runId: r.id }} label="Cancel" inline={false} />}
          </div>
        );
      })}
    </Section>
  );
}

function ParadigmTree({ s }: { s: GameStateV2 }) {
  return (
    <Section title={<Term id="paradigm">Paradigms</Term>}>
      <div className="ptree">
        {([1, 2, 3, 4] as const).map((tier) => (
          <div className="ptier" key={tier}>
            <div className="branch-label">Tier {tier}</div>
            {(tier >= 3 ? unlocked(s, 'paradigmT3') : tier === 2 ? unlocked(s, 'paradigms') : true) ? PARADIGMS.filter((x) => x.tier === tier).map((x) => {
              const st = s.player.paradigms[x.id];
              const gate = paradigmGate(s, x.id);
              const status = st?.status ?? 'locked';
              return (
                <Tip as="div" key={x.id} content={() => <TipCard title={`${x.id} ${x.name}`} value={status} rows={[
                  { label: 'Prior success', value: pct(x.prior) }, { label: 'Effort', value: `${x.effortDays} d` },
                  { label: 'Gate', value: gate === true ? 'open' : gate, tone: gate === true ? 'pos' : 'neg' },
                  ...(x.effect ? [{ label: 'Effect', value: x.effect }] : []), ...(x.safetyCost ? [{ label: 'Safety cost', value: x.safetyCost, tone: 'neg' as const }] : []),
                ]} />}>
                  <div className={`ptech st-${status}`} data-paradigm={x.id}>
                    <span className="small ellip">{x.name}</span>
                    {status === 'researching' && st && <Meter value={st.progress} max={1} width={50} />}
                    {(status === 'available' || status === 'failed' || status === 'researching') && gate === true && <ActBtn id="fundParadigm" testId={`fundParadigm.${x.id}`} params={{ id: x.id, fte: 30, expShare: 0.02 }} label={status === 'researching' ? 'Fund' : 'Research'} inline={false} />}
                    {status === 'succeeded' && <ActBtn id="adoptParadigm" testId={`adoptParadigm.${x.id}`} params={{ id: x.id }} inline={false} />}
                  </div>
                </Tip>
              );
            }) : <div className="locked-note small">Act {tier >= 3 ? 3 : 2}</div>}
          </div>
        ))}
      </div>
    </Section>
  );
}

export function Models({ s }: { s: GameStateV2 }) {
  useV2();
  const v = selectedVersion(s);
  return (
    <div className="panel-v2 models-grid" data-panel="models">
      <Section title="Lineage"><Lineage s={s} sel={v?.id} /></Section>
      <div>
        {v ? <ModelCard s={s} v={v} /> : <Section title="Model card"><div className="dim">No versions</div></Section>}
        <RunQueue s={s} />
      </div>
      <div className="span2"><Gate s={s} k="models"><ParadigmTree s={s} /></Gate></div>
    </div>
  );
}
