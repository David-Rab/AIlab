// TRAINING › Runs (UB-B; approved mockups design/ux/mockups/rd/train-runs.png, train-runs-drawer.png; DATA-b.md).
// HOME of: the runs timeline (what ran, what came out, what is running, evals), training compute now, forecast vs
// result per run, the running run's card (progress, due, share, holdups, controls) and the run drawer (L2: forecast vs
// result, time, launch snapshot). Reads facts, the lab's frozen launch forecasts and measured evals only.
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronRight, ClipboardCheck, Cpu, Crosshair, Layers, Loader, Minimize2, SlidersHorizontal, X, type LucideIcon } from 'lucide-react';
import { LEVEL_KNOTS } from '../../../data/v2/calibration';
import {
  dateOf, evalQueueView, fmtDate, idleTrainingShare, MILESTONE_NAMES, poolAllocation, runEtaDays, runHistory, runStall, streamShare,
  type RunHistoryRow, type RunLane,
} from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { store } from '../store';
import { ActBtn, Limit, Term, Tip, TipCard } from '../ui';
import { Card, Ref } from '../kit';
import * as F from '../fmt';
import { fmtParams } from './Models';

const LANES: { id: RunLane | 'evals'; label: string; icon: LucideIcon; term: string }[] = [
  { id: 'pre', label: 'Pretraining', icon: Layers, term: 'pretraining' },
  { id: 'post', label: 'Post-training', icon: SlidersHorizontal, term: 'postTrain' },
  { id: 'distil', label: 'Distil', icon: Minimize2, term: 'distill' },
  { id: 'evals', label: 'Evals', icon: ClipboardCheck, term: 'evals' },
];
const FOCUS: Record<string, string> = { swe: 'Coding', math: 'Math', longHorizon: 'Long tasks', mlResearch: 'AI research', computerUse: 'Computer use', cyber: 'Cyber', bio: 'Bio' };
const WORD: Record<string, string> = {
  light: 'Light', standard: 'Standard', heavy: 'Heavy', minimal: 'Minimal', visible: 'Visible', pressured: 'Pressured', faithful: 'Faithful', latent: 'Latent',
  constitution: 'Constitution', engagement: 'Engagement', persuasion: 'Persuasion', moe: 'Mixture of experts', dense: 'Dense',
  balanced: 'Balanced', codeMath: 'Code & math', science: 'Science', synthetic: 'Synthetic-heavy', multimodal: 'Multimodal',
};
/** The highest milestone a level reaches ("would meet Research agent"). */
const milestoneAt = (L: number) => { let n: string | undefined; LEVEL_KNOTS.forEach((k, i) => { if (L >= k) n = MILESTONE_NAMES[i]; }); return n; };
const mid = (r: RunHistoryRow) => r.forecast?.mid;

export function RunsView({ s }: { s: GameStateV2 }) {
  const key = `${s.time.day}|${s.player.models.runs.map((r) => `${r.id}${r.status}${r.poolShare}`).join(',')}`;
  const d = useMemo(() => {
    const rows = runHistory(s);
    const alloc = poolAllocation(s);
    return { rows, alloc, evals: evalQueueView(s) };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [open, setOpen] = useState<string>('');
  const running = d.rows.filter((r) => r.run.status !== 'done');
  const sel = d.rows.find((r) => r.run.id === open);
  return (
    <div className="rn" data-test="runs-view">
      <Timeline s={s} rows={d.rows} alloc={d.alloc} evals={d.evals} onOpen={setOpen} />
      <div className="rn-low">
        <ForecastPanel s={s} rows={d.rows} alloc={d.alloc} onOpen={setOpen} />
        <RunningNow s={s} rows={running} alloc={d.alloc} onOpen={setOpen} />
      </div>
      {sel && <RunDrawer s={s} r={sel} alloc={d.alloc} close={() => setOpen('')} />}
    </div>
  );
}

// ───────── timeline (L1) ─────────
function Timeline({ s, rows, alloc, evals, onOpen }: { s: GameStateV2; rows: RunHistoryRow[]; alloc: Map<string, number>; evals: ReturnType<typeof evalQueueView>; onOpen: (id: string) => void }) {
  const day = s.time.day;
  const endOf = (r: RunHistoryRow) => (r.run.status === 'done' ? r.end ?? r.start : day + Math.min(730, finite(runEtaDays(s, r.run, alloc)) ?? 730));
  const evalBars = useMemo(() => {
    const out: { id: string; name: string; a: number; b: number; open: boolean; note: string }[] = [];
    const last = [...s.player.models.versions].filter((v) => v.variant === 'full' && v.evals.suiteDay !== undefined && v.evals.suiteDay >= v.day && v.evals.suiteDay - v.day <= 45 && v.evals.suiteDay >= day - 60).sort((a, b) => b.evals.suiteDay! - a.evals.suiteDay!)[0];
    if (last) out.push({ id: `m:${last.id}`, name: last.name, a: last.day, b: last.evals.suiteDay!, open: false, note: 'measured' });
    for (const t of evals) out.push({ id: `q:${t.id}`, name: t.name, a: day, b: day + Math.min(365, finite(t.etaDays) ?? 365), open: true, note: t.why === 'release' ? 'evals' : 're-test' });
    return out;
  }, [s.time.day, evals]); // eslint-disable-line react-hooks/exhaustive-deps
  const lo = rows.length ? Math.min(...rows.map((r) => r.start), day - 60) : day - 60;
  const hi = Math.max(day + 45, ...rows.map(endOf), ...evalBars.map((e) => e.b + 10));
  const span = Math.max(1, hi - lo);
  const x = (t: number) => ((t - lo) / span) * 100;
  const pc = (t: number) => `${x(t).toFixed(3)}%`;
  const months = monthTicks(s, lo, hi);
  const alloc0 = [...alloc.entries()].filter(([, v]) => v > 1e-6);
  const stream = streamShare(s);
  const idle = idleTrainingShare(s);
  const labelled = new Map<RunLane, number>();
  const label = (r: RunHistoryRow): string | undefined => {
    const n = r.run.status === 'done' ? (r.result ? (r.lane === 'pre' ? `base ${r.result.name}` : r.result.name) : undefined) : `${r.title} · ${F.pct(r.run.flopDone / Math.max(1, r.run.flopNeeded))}`;
    if (!n) return undefined;
    const last = labelled.get(r.lane);
    const at = x((r.start + endOf(r)) / 2);
    if (last !== undefined && at - last < 5.5) return undefined;
    labelled.set(r.lane, at);
    return n;
  };
  return (
    <Card className="rn-tl" home="runsTimeline" title={<span className="row-i"><Layers size={15} />Runs</span>} sub="what ran, what came out, what is running"
      right={<span className="rn-legend small"><span><i className="pre" />Pretraining</span><span><i className="post" />Post-training</span><span><i className="distil" />Distil</span><span><i className="evals" />Evals</span><span><i className="togo" />to go</span></span>}>
      <div className="rn-grid" data-test="runs-timeline">
        {LANES.map((ln) => (
          <div key={ln.id} className="rn-lane" data-lane={ln.id}>
            <span className="rn-lname row-i"><ln.icon size={14} /><Term id={ln.term}>{ln.label}</Term></span>
            <div className="rn-track">
              {ln.id !== 'evals' && rows.filter((r) => r.lane === ln.id).map((r) => {
                const a = r.start;
                const b = Math.max(endOf(r), a + 1);
                const run = r.run.status !== 'done';
                const lab = label(r);
                const stall = run ? runStall(s, r.run) : undefined;
                return (
                  <Tip key={r.run.id} content={() => <TipCard title={r.title} value={r.result?.name ?? (run ? F.pct(r.run.flopDone / Math.max(1, r.run.flopNeeded)) : undefined)} rows={[
                    { label: 'Launched', value: fmtDate(dateOf(s, a)) }, { label: run ? 'Due' : 'Finished', value: fmtDate(dateOf(s, b)) },
                    ...(r.from ? [{ label: r.lane === 'distil' ? 'Teacher' : 'Base', value: r.from }] : []),
                  ]} footer={stall ?? 'Click for the run\'s forecast, time and launch snapshot.'} />}>
                    <button className={`rn-bar ${r.lane} ${run ? 'run' : ''} ${stall ? 'stall' : ''}`} data-run={r.run.id} style={{ left: pc(a), width: `calc(${pc(b)} - ${pc(a)})` }} onClick={() => onOpen(r.run.id)}>
                      {run && <i className="done" style={{ width: `${Math.min(100, ((day - a) / Math.max(1, b - a)) * 100)}%` }} />}
                      {lab && <span className="rn-lab">{lab}{r.check?.verdict === 'below' ? <ArrowDown size={11} className="tone-warn" /> : null}</span>}
                    </button>
                  </Tip>
                );
              })}
              {ln.id === 'evals' && evalBars.map((e, i) => (
                <Tip key={e.id} content={() => <TipCard title={<Term id="evals">{e.name}</Term>} value={e.open ? `due ${fmtDate(dateOf(s, e.b))}` : 'measured'} rows={[{ label: 'From', value: fmtDate(dateOf(s, e.a)) }, { label: e.open ? 'Due' : 'Measured', value: fmtDate(dateOf(s, e.b)) }]}>{e.open ? 'Evals in progress; their share of people and compute is set on LAB.' : 'Evals measured this model.'}</TipCard>}>
                  <span className={`rn-bar evals ${e.open ? 'open' : ''}`} data-eval={e.id} style={{ left: pc(e.a), width: `calc(${pc(Math.max(e.b, e.a + 2))} - ${pc(e.a)})`, top: `${22 + (i % 2) * 16}px` }}>
                    <span className={`rn-lab ${i % 2 ? 'lo' : ''}`}>{e.name} {e.note}{e.open ? ` · due ${fmtDate(dateOf(s, e.b)).replace(/, \d{4}$/, '')}` : ''}</span>
                  </span>
                </Tip>
              ))}
            </div>
          </div>
        ))}
        <div className="rn-lane rn-axis"><span /><div className="rn-track">{months.map((m) => <Tip key={m.d} content={() => <TipCard title={fmtDate(dateOf(s, m.d))}>Month start.</TipCard>}><span className="rn-tick" style={{ left: pc(m.d) }}>{m.label}</span></Tip>)}<b className="rn-today" style={{ left: pc(day) }}><span>today</span></b></div></div>
        <div className="rn-now-line" style={{ left: `calc(170px + (100% - 170px) * ${x(day) / 100})` }} />
      </div>
      <div className="rn-compute" data-test="runs-compute">
        <Cpu size={14} className="dim" /><Term id="trainingPool">Training compute</Term><span className="dim small">now</span>
        <Tip content={() => <TipCard title={<Term id="trainingPool">Training compute now</Term>} rows={[
          ...alloc0.map(([id, v]) => ({ label: rows.find((r) => r.run.id === id)?.title ?? id, value: F.pct(v) })),
          ...(stream > 0 ? [{ label: <Term id="stream">Continual learning</Term>, value: F.pct(stream) }] : []),
          { label: <Term id="idleCompute">Idle</Term>, value: F.pct(idle) },
        ]} footer="The training compute itself is set on LAB.">How today&apos;s training compute splits between runs.</TipCard>}>
          <span className="rn-cbar">{alloc0.map(([id, v]) => <i key={id} className="use" style={{ width: `${v * 100}%` }} />)}{stream > 0 && <i className="stream" style={{ width: `${stream * 100}%` }} />}<i className="idle" style={{ width: `${idle * 100}%` }} /></span>
        </Tip>
        <Tip content={() => <TipCard title={<Term id="trainingPool">Training compute now</Term>} rows={[...alloc0.map(([id, v]) => ({ label: rows.find((r) => r.run.id === id)?.title ?? id, value: F.pct(v) })), ...(stream > 0 ? [{ label: 'Continual learning', value: F.pct(stream) }] : []), { label: 'Idle', value: F.pct(idle) }]}>Shares of today&apos;s training compute.</TipCard>}><span className="small" data-test="spare-share">{alloc0.map(([id, v]) => <span key={id}><b className="num">{F.pct(v)}</b> {rows.find((r) => r.run.id === id)?.title ?? ''} · </span>)}{stream > 0 && <span><b className="num">{F.pct(stream)}</b> continual learning · </span>}<b className={`num ${idle > 0.005 ? 'tone-warn' : ''}`}>{F.pct(idle)}</b> idle</span></Tip>
        <Limit id="run.stream" tone={stream > 0 ? 'warn' : 'quiet'}>{stream > 0 ? 'continual learning first' : 'continual learning: off'}</Limit>
        <button className="dv-chip" onClick={() => store.goto('lab')}>LAB <ChevronRight size={11} /></button>
      </div>
    </Card>
  );
}
const finite = (x: number) => (Number.isFinite(x) ? x : undefined);
function monthTicks(s: GameStateV2, lo: number, hi: number) {
  const out: { d: number; label: string }[] = [];
  const step = hi - lo > 700 ? 6 : 3;
  for (let d = lo; d <= hi; d++) {
    const t = fmtDate(dateOf(s, d));
    const [mon, dd, yr] = t.replace(',', '').split(' ');
    if (dd !== '1') continue;
    const mi = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(mon);
    if (mi % step !== 0) continue;
    out.push({ d, label: mi === 0 ? `${mon} ${yr}` : mon });
  }
  return out;
}

// ───────── forecast vs result (L1) ─────────
function verdictOf(r: RunHistoryRow): { word: string; cls: string; icon: LucideIcon } {
  if (r.run.status !== 'done') return { word: 'Not yet', cls: 'dim', icon: Loader };
  if (!r.check) return { word: 'Not measured yet', cls: 'dim', icon: Loader };
  if (r.check.verdict === 'inside') return { word: 'As forecast', cls: 'tone-pos', icon: Check };
  return r.check.verdict === 'below' ? { word: 'Below forecast', cls: 'tone-warn', icon: ArrowDown } : { word: 'Above forecast', cls: 'tone-pos', icon: ArrowUp };
}
function ForecastPanel({ s, rows, alloc, onOpen }: { s: GameStateV2; rows: RunHistoryRow[]; alloc: Map<string, number>; onOpen: (id: string) => void }) {
  const due = (r: RunHistoryRow) => { const e = runEtaDays(s, r.run, alloc); return Number.isFinite(e) ? fmtDate(dateOf(s, s.time.day + e)) : 'waits'; };
  const shown = rows.filter((r) => r.forecast).slice(-5).reverse();
  const done = shown.filter((r) => r.check);
  const inside = done.filter((r) => r.check!.verdict === 'inside').length;
  const half = Math.max(0.45, ...shown.map((r) => Math.max(r.forecast!.band[1] - r.forecast!.mid, r.measured ? Math.abs(r.measured.L - r.forecast!.mid) + r.measured.sd * 1.64 : 0)) ) * 1.1;
  const x = (r: RunHistoryRow, L: number) => `${Math.max(0, Math.min(100, 50 + ((L - mid(r)!) / half) * 50))}%`;
  return (
    <Card className="rn-fc" home="forecastVsResult" title={<span className="row-i"><Crosshair size={15} /><Term id="runForecast">Forecast</Term>&nbsp;vs result</span>} sub="what you expected at launch, and what evals measured"
      right={done.length ? <Tip content={() => <TipCard title="Inside the range" value={`${inside} of ${done.length}`}>Measured results that fell inside the 90% range forecast at launch. About 9 in 10 should.</TipCard>}><span className={`rn-chip ${inside === done.length ? 'ok' : 'warn'}`} data-test="fc-inside">{inside} of {done.length} inside the range</span></Tip> : undefined}>
      {shown.length === 0 ? <div className="dim small" data-test="fc-empty">No run launched with a forecast yet. Runs you launch from now on keep the forecast they had at launch.</div> : (
        <div className="rn-fcgrid" data-test="fc-rows">
          <div className="rn-fchead small dim"><span /><span className="rn-fclegend"><span><i className="band" />forecast range at launch</span><span><i className="dot" />measured, with its range</span></span><span /></div>
          <div className="rn-fchead rn-fcscale small dim"><span /><span className="rn-fcax"><span>lower</span><span>forecast</span><span>higher</span></span><span /></div>
          {shown.map((r) => {
            const v = verdictOf(r);
            const f = r.forecast!;
            const m = r.measured;
            return (
              <div key={r.run.id} className="rn-fcrow" data-fc={r.run.id}>
                <button className="rn-fcname" onClick={() => onOpen(r.run.id)}>
                  <b>{r.title}{r.result ? <> → {r.result.name}</> : null}</b>
                  <span className="small dim">{r.run.status !== 'done' ? `running · due ${due(r)}` : r.from ? `${r.lane === 'distil' ? 'from' : 'on base'} ${r.from}` : ''}{m?.day !== undefined ? ` · measured ${fmtDate(dateOf(s, m.day))}` : ''}</span>
                </button>
                <Tip as="div" content={() => <TipCard title={r.title} rows={[
                  { label: 'Forecast at launch', value: `${F.level(f.mid)} (${F.level(f.band[0])}–${F.level(f.band[1])})` },
                  ...(m ? [{ label: `Measured (${m.versionName})`, value: `${F.level(m.L)} ± ${F.num(m.sd, 2)}` }, { label: 'Off by', value: `${F.num(r.check!.z, 1, true)} sd` }] : []),
                ]} footer="Levels: 10 is the best human. The range is 90%.">Each row is centred on its own forecast; all rows share one scale.</TipCard>}>
                  <div className="rn-fctrack">
                    <i className="mid" />
                    <i className="band" style={{ left: x(r, f.band[0]), width: `calc(${x(r, f.band[1])} - ${x(r, f.band[0])})` }} />
                    {m && <><i className="whisk" style={{ left: x(r, m.L - 1.64 * m.sd), width: `calc(${x(r, m.L + 1.64 * m.sd)} - ${x(r, m.L - 1.64 * m.sd)})` }} /><b className="dot" style={{ left: x(r, m.L) }} /></>}
                  </div>
                </Tip>
                <span className={`rn-fcv small ${v.cls}`} data-verdict={r.check?.verdict ?? 'none'}><v.icon size={13} />{v.word}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ───────── running now (L1) ─────────
function RunningNow({ s, rows, alloc, onOpen }: { s: GameStateV2; rows: RunHistoryRow[]; alloc: Map<string, number>; onOpen: (id: string) => void }) {
  const r = [...rows].sort((a, b) => (alloc.get(b.run.id) ?? 0) - (alloc.get(a.run.id) ?? 0))[0];
  if (!r) {
    return (
      <Card className="rn-now" home="runningNow" title={<span className="row-i"><Loader size={15} />Running now</span>}>
        <div className="dim small" data-test="runs-empty">No run in progress.</div>
        <span className="sp" />
        <div className="row-i rn-foot"><button className="dv-chip" onClick={() => store.goto('blueprint', { tab: 'next' })}>Next run <ChevronRight size={11} /></button></div>
      </Card>
    );
  }
  const run = r.run;
  const done = Math.min(1, run.flopDone / Math.max(1, run.flopNeeded));
  const eta = runEtaDays(s, run, alloc);
  const got = alloc.get(run.id) ?? 0;
  const stall = runStall(s, run) ?? (run.status === 'paused' ? 'Paused: your safety framework holds frontier training' : undefined);
  const ms = r.forecast ? milestoneAt(r.forecast.mid) : undefined;
  const plan = run.base ? `new base · ${fmtParams(run.base.params)} parameters` : r.from ? `${r.lane === 'distil' ? 'from' : 'on'} ${r.from}` : '';
  const others = rows.filter((x) => x.run.id !== run.id);
  return (
    <Card className="rn-now" home="runningNow" title={<span className="row-i"><Loader size={15} />Running now</span>}
      right={<span className={`rn-chip ${stall ? 'warn' : 'ok'}`}>{run.status === 'paused' ? 'paused' : stall ? 'held up' : '✓ on plan'}</span>}>
      <div className="rn-nowhd" data-run={run.id}><Tip content={() => <TipCard title={r.title} rows={[{ label: 'Launched', value: fmtDate(dateOf(s, run.startDay)) }, ...(plan ? [{ label: 'Plan', value: plan }] : [])]}>Click Launch snapshot for its design.</TipCard>}><span className="row-i rn-nowt"><b>{r.title}</b><span className="small dim">{plan}</span></span></Tip><span className="sp" /><Tip content={() => <TipCard title="Done" value={F.pct(done)}>Share of the run's training compute already spent.</TipCard>}><b className="num rn-pct">{F.pct(done)}</b></Tip></div>
      <div className="rn-prog"><i style={{ width: `${done * 100}%` }} /></div>
      <div className="pf-kv rn-kv">
        <span className="k">Due</span>
        <Tip content={() => <TipCard title="Due" value={Number.isFinite(eta) ? fmtDate(dateOf(s, s.time.day + eta)) : 'waits'}>Expected finish at today&apos;s training share; evals follow.</TipCard>}><span data-test="run-eta">{Number.isFinite(eta) ? <><b className="num">{fmtDate(dateOf(s, s.time.day + eta))}</b> <span className="dim">{Math.round(eta)} d</span></> : 'waits'}</span></Tip>
        <span className="k"><Term id="poolShare">Training share</Term></span>
        <span className="row-i">
          <Tip content={() => <TipCard title={<Term id="poolShare">Training share</Term>} value={F.pct(got)} rows={[{ label: 'Asks', value: F.pct(run.poolShare) }, { label: 'Gets today', value: F.pct(got) }]} footer="Runs that ask for more than the training compute are scaled down together.">Share of training compute this run gets.</TipCard>}><span data-test="run-share"><b className="num">{F.pct(got)}</b> <span className="dim">of training compute</span></span></Tip>
          <Ref id="trainingAlloc" to={{ panel: 'lab', tab: 'board', anchor: 'split' }}>Allocation</Ref>
        </span>
        <span className="k">Holdups</span>
        <span className={stall ? 'tone-warn' : ''} data-test={stall ? 'run-stall' : 'run-ok'}>{stall ?? 'none'}</span>
        <span className="k"><Term id="runForecast">Forecast</Term></span>
        <Tip content={() => <TipCard title="Forecast at launch" value={r.forecast ? `${F.level(r.forecast.band[0])}–${F.level(r.forecast.band[1])}` : 'none'}>The level your forecast gave this run at launch (90% range; 10 = best human). Evals of the result measure the real one.</TipCard>}>
          <span>{r.forecast ? (ms ? <>would meet <b>{ms}</b></> : <>{F.level(r.forecast.band[0])}–{F.level(r.forecast.band[1])}</>) : <span className="dim">none at launch</span>}</span>
        </Tip>
        {others.length > 0 && <><span className="k">Also running</span><span>{others.map((o) => <Tip key={o.run.id} content={() => <TipCard title={o.title} value={F.pct(o.run.flopDone / Math.max(1, o.run.flopNeeded))}>Done so far; click for its forecast, time and launch snapshot.</TipCard>}><button className="dv-chip" onClick={() => onOpen(o.run.id)}>{o.title} · {F.pct(o.run.flopDone / Math.max(1, o.run.flopNeeded))}</button></Tip>)}</span></>}
      </div>
      <span className="sp" />
      <div className="row-i rn-foot">
        <button className="dv-chip" data-test="run-open" onClick={() => onOpen(run.id)}>Launch snapshot <ChevronRight size={11} /></button>
        <button className="dv-chip" onClick={() => store.goto('blueprint', { tab: 'next' })}>Next run <ChevronRight size={11} /></button>
        <span className="sp" />
        {run.status === 'running' && <ActBtn id="cancelRun" params={{ runId: run.id }} label="Cancel run" />}
      </div>
    </Card>
  );
}

// ───────── run drawer (L2) ─────────
function RunDrawer({ s, r, alloc, close }: { s: GameStateV2; r: RunHistoryRow; alloc: Map<string, number>; close: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.tip')) close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);
  const run = r.run;
  const f = r.forecast;
  const m = r.measured;
  const v = verdictOf(r);
  const eta = run.status !== 'done' ? runEtaDays(s, run, alloc) : NaN;
  const kv: [ReactNode, ReactNode][] = [];
  if (run.post) {
    const p = run.post;
    kv.push(['Start from', r.from ? <><b>base {r.from}</b></> : '—']);
    kv.push([<Term id="rlFocus">Focus</Term>, <>{p.rlFocus === 'broad' ? 'Broad' : p.rlFocus.map((x) => FOCUS[x] ?? x).join(', ')} · {WORD[p.rlBudget] ?? p.rlBudget} budget</>]);
    kv.push([<Term id="cot">Reasoning</Term>, WORD[p.cot] ?? p.cot]);
    kv.push([<Term id="preference">Preference</Term>, WORD[p.pref] ?? p.pref]);
    kv.push([<Term id="safetyTraining">Safety training</Term>, WORD[p.safety] ?? p.safety]);
    kv.push(['Methods', p.methods.length ? `${p.methods.length} training methods` : 'none']);
  } else if (run.base) {
    const b = run.base;
    kv.push(['Size', `${fmtParams(b.params)} parameters`]);
    kv.push([<Term id="shape">Model design</Term>, WORD[b.shape] ?? b.shape]);
    kv.push([<Term id="dataMix">Data mix</Term>, WORD[b.data] ?? b.data]);
    kv.push([<Term id="hazardFilter">Data filter</Term>, Object.entries(b.curation).filter(([, on]) => on).map(([k]) => (k === 'safetyPretrain' ? 'Safety pretraining' : k === 'hazard' ? 'Hazard' : 'Quality')).join(', ') || 'None']);
  } else if (run.kind === 'distill') {
    kv.push(['Teacher', r.from ?? '—']);
    if (run.studentParams) kv.push(['Student size', `${fmtParams(run.studentParams)} parameters`]);
  }
  return (
    <>
      <div className="pf-scrim" onClick={close} />
      <aside className="pf-drawer rn-drawer" data-test="run-drawer" data-run={run.id}>
        <div className="pf-dh"><SlidersHorizontal size={18} className="dim" /><h2>{r.title}</h2>{r.result && <span className="dim">→ {r.result.name}</span>}<span className="sp" /><button className="btn btn-sm btn-ghost" aria-label="Close" data-test="drawer-close" onClick={close}><X size={16} /></button></div>
        <div className="pf-sec"><div className="row-i"><span className="cap">Forecast vs result</span><span className="sp" /><span className={`small ${v.cls}`}><v.icon size={12} /> {v.word}</span></div>
          <div className="pf-kv">
            <span className="k">Forecast at launch</span>{f ? <Tip content={() => <TipCard title={<Term id="runForecast">Forecast at launch</Term>} value={F.level(f.mid)} rows={[{ label: '90% range', value: `${F.level(f.band[0])}–${F.level(f.band[1])}` }]}>Levels: 10 is the best human.</TipCard>}><span><b className="num">{F.level(f.mid)}</b> <span className="dim">(range {F.level(f.band[0])} to {F.level(f.band[1])})</span></span></Tip> : <span className="dim">none: nothing was measured at launch</span>}
            {m && <><span className="k">Measured{m.day !== undefined ? ` ${fmtDate(dateOf(s, m.day)).replace(/, \d{4}$/, '')}` : ''}</span><Tip content={() => <TipCard title={<Term id="evals">Measured</Term>} value={F.level(m.L)} rows={[{ label: 'Measurement sd', value: F.num(m.sd, 2) }, { label: 'Model', value: m.versionName }]}>What evals measured for the model this run made.</TipCard>}><span><b className="num">{F.level(m.L)}</b> <span className="dim">(± {F.num(m.sd, 2)}, {m.versionName})</span></span></Tip></>}
            {r.check && <><span className="k">Miss</span><span>{r.check.verdict === 'inside' ? 'inside the range' : <Tip content={() => <TipCard title="Miss" value={`${F.num(Math.abs(r.check!.z), 1)} sd`}>How far the measurement fell from the forecast, in the forecast's own spread. Beyond 1.6 the forecast's range was too narrow.</TipCard>}><span>{r.check.verdict} the range by {F.num(Math.abs(r.check.z), 1)} sd; the forecast was <b>too sure</b></span></Tip>}</span></>}
          </div>
        </div>
        <div className="pf-sec"><div className="cap">Time</div>
          <div className="pf-kv">
            <span className="k">Launched</span><b className="num">{fmtDate(dateOf(s, run.startDay))}</b>
            {run.status === 'done'
              ? <><span className="k">Finished</span><span>{r.end !== undefined ? <><b className="num">{fmtDate(dateOf(s, r.end))}</b> <span className="dim">{r.end - run.startDay} d</span></> : '—'}</span></>
              : <><span className="k">Due</span><span>{Number.isFinite(eta) ? <><b className="num">{fmtDate(dateOf(s, s.time.day + eta))}</b> <span className="dim">{Math.round(eta)} d</span></> : 'waits'}</span></>}
            <span className="k"><Term id="poolShare">Training share</Term></span><Tip content={() => <TipCard title={<Term id="poolShare">Training share</Term>} value={F.pct(run.poolShare)}>Share of training compute the run asked for.</TipCard>}><span><b className="num">{F.pct(run.poolShare)}</b> <span className="dim">asked</span></span></Tip>
          </div>
        </div>
        {kv.length > 0 && <div className="pf-sec"><div className="cap">Launch snapshot</div>
          <div className="pf-kv">{kv.map(([k, val], i) => <Fragment key={i}><span className="k">{k}</span><span>{val}</span></Fragment>)}</div>
        </div>}
        <span className="sp" />
        <div className="row-i rn-foot">
          {r.result && <button className="dv-chip" onClick={() => { if (r.result!.kind === 'version') store.select({ versionId: r.result!.id }); store.goto('models'); }}>{r.result.name} › Models</button>}
          <button className="dv-chip" onClick={() => store.goto('models', { tab: 'evals' })}>Evals <ChevronRight size={11} /></button>
          {r.result?.kind === 'version' && <button className="dv-chip" onClick={() => store.goto('safety', { tab: 'model' })}>What it does to tendencies › Safety</button>}
        </div>
      </aside>
    </>
  );
}
