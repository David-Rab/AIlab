// LAB › AI staff & needs, the job cards (UB-B; mockup design/ux/mockups/rd/lab-aistaff.png, DATA-b.md). HOME of the AI
// staff per job: model (pick with a before → after preview), AI share of the work and work done (the same values as the
// LAB board's one line), copies, compute, cost per hour of work, the teams it works with, its watcher (pick here); and
// for safety work the AI share allowed and spot-checks. Safeguards on AI staff (control protocol, stop rates) live on
// SAFETY › Safeguards; how close AI is to each job on MODELS; Lab tools on RESEARCH › Know-how.
import { useMemo, useState, type ReactNode } from 'react';
import { Pencil, X } from 'lucide-react';
import { SPOT_SHARES, believedSpotCatch, spotCheckChosen, spotCheckFte, spotShare } from '../../../engine/v2/safety/workPackage';
import { safetyAgentVersion } from '../../../engine/v2/safety/agents';
import { controlOn } from '../../../engine/v2/safety/safeguards';
import { AGENT_USES, AGENT_USE_DEF, MONITOR_AUTO, MONITOR_SAME } from '../../../data/v2/agents';
import { INTERNAL_TOOLS } from '../../../data/v2/features';
import { agentChangeBlock, agentsView, dangerView, dateOf, fmtDate, newestInternal, previewAgentChange, previewTrusted, teamsOfKey, versionById, workTypeViews } from '../../../engine/v2';
import type { AgentChange, AgentLane, AgentUse, AgentsView, DangerRead, GameStateV2, TeamKey, WorkTypeView } from '../../../engine/v2';
import { ActBtn, Term, Tip, TipCard, type Params } from '../ui';
import { Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { modelOptions, PkgChip } from './chips';
import { DangerChip } from './Danger';
import './agents.css';

const USE_ICON: Record<AgentUse, typeof ICON.L> = { eng: ICON.roleEng, capRoutine: ICON.roleRE, capFrontier: ICON.roleSci, safety: ICON.safety };
const USE_WT: Record<AgentUse, WorkTypeView['wt']> = { eng: 'SWE', capRoutine: 'EXP', capFrontier: 'IDEAS', safety: 'SAF_EXP' };
const USE_TEAMS: Record<AgentUse, { keys: TeamKey[]; label: string }> = {
  eng: { keys: ['eng'], label: 'Engineers' }, capRoutine: { keys: ['re.cap'], label: 'Research engineers' },
  capFrontier: { keys: ['sci.cap'], label: 'Scientists' }, safety: { keys: ['re.saf', 'sci.saf'], label: 'Safety staff' },
};
const TEAM_WORD: Record<TeamKey, string> = { eng: 'Engineers', 're.cap': 'Research engineers', 'sci.cap': 'Scientists', 're.saf': 'Safety research engineers', 'sci.saf': 'Safety scientists' };
/** Research taste in player words (VOCAB: no SD): the share of human scientists a taste this many SD above the median beats. */
const phi = (z: number) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
const tasteWord = (sd: number) => `beats ${F.pct(phi(sd))} of scientists`;
/** Work done as ×: ×1.2, ×18, ×1.8K (as on the LAB board). */
const xm = (m: number) => `×${m >= 1000 ? `${(m / 1000).toFixed(1)}K` : m >= 10 ? m.toFixed(0) : m.toFixed(1)}`;
const perHour = (x: number) => (!Number.isFinite(x) ? '—' : x < 10 ? `$${x.toFixed(2)}` : `$${F.count(x)}`);

function changeParams(use: AgentUse, c: AgentChange): Params {
  const p: Params = { use };
  if (c.versionId !== undefined) p.versionId = c.versionId ?? '';
  if (c.monitorId !== undefined) p.monitorId = c.monitorId ?? '';
  return p;
}

/** Before → after of a model or watcher pick (applies at the next tick). */
function EditPop({ s, use, c, close }: { s: GameStateV2; use: AgentUse; c: AgentChange; close: () => void }) {
  const block = agentChangeBlock(s, use, c);
  const pv = useMemo(() => previewAgentChange(s, use, c), [s, s.time.day, use, JSON.stringify(c)]);
  const b = pv.before;
  const a = pv.after;
  const lb = b.lanes[use];
  const la = a.lanes[use];
  const row = (k: ReactNode, x: number, y: number, fmt: (v: number) => string, goodUp = true) => {
    const dd = y - x;
    const tone = Math.abs(dd) < Math.max(1e-9, Math.abs(x) * 1e-4) ? '' : (dd > 0) === goodUp ? 'pos' : 'neg';
    return <><span className="k">{k}</span><span className="ba"><span className="o">{fmt(x)}</span>→<b>{fmt(y)}</b>{tone && <span className={`tone-${tone}`}>{dd > 0 ? '▲' : '▼'}</span>}</span></>;
  };
  const name = (l: AgentLane, kind: 'model' | 'monitor') => (kind === 'model' ? l.version?.name ?? '—' : l.monitor ? (l.monitorSame ? `copy of ${l.version?.name ?? 'it'}` : l.monitor.name) : 'none');
  const lines: [string, string, string][] = [];
  if (c.versionId !== undefined) lines.push(['Model', name(lb, 'model'), name(la, 'model')]);
  if (c.monitorId !== undefined) lines.push(['Watched by', name(lb, 'monitor'), name(la, 'monitor')]);
  return (
    <div className="ag-pop" data-test={`agent-edit.${use}`}>
      <div className="pop-h"><Pencil size={12} /><b>{AGENT_USE_DEF[use].name}</b></div>
      <div className="pop-ch">{lines.map(([k, f, t]) => <div key={k}><span className="tag2">{k}</span> {f} → <b>{t}</b></div>)}</div>
      {c.versionId !== undefined && la.version && lb.version && la.L < lb.L - 0.05 && <div className="small tone-warn" data-test={`agent-worse.${use}`}>{la.version.name} measures level {F.level(la.L)}, below {lb.version.name} (level {F.level(lb.L)})</div>}
      {block ? <div className="tone-neg small">{block}</div> : (
        <div className="pv">
          {row(<Term id="aiShareWork">AI share</Term>, lb.aiShare, la.aiShare, (x) => F.pct(x))}
          {row(<Term id="workDone">Work done, experiments</Term>, b.mExp, a.mExp, (x) => F.mult(x))}
          {row(<Term id="workDone">Work done, ideas</Term>, b.mIdeas, a.mIdeas, (x) => F.mult(x))}
          {use === 'eng' && row(<Term id="buildCapacity">Build capacity</Term>, b.build, a.build, (x) => `${x.toFixed(1)} teams`)}
          {use === 'capFrontier' && row(<Term id="researchTaste">Research taste</Term>, b.sdAI, a.sdAI, (x) => tasteWord(x))}
          {row(<Term id="agentCopies">Copies</Term>, lb.copies, la.copies, (x) => F.count(x))}
          {(lb.monitor || la.monitor) && row(<Term id="catchRate">Stop rate</Term>, lb.catch, la.catch, (x) => F.pct(x))}
          {row(<Term id="runCost">Cost / yr</Term>, lb.cost + lb.monitorCost, la.cost + la.monitorCost, (x) => F.money(x), false)}
        </div>
      )}
      <div className="pop-f">
        <ActBtn id="agents.set" testId={`agents.set.${use}`} params={changeParams(use, c)} label="Apply" primary block={block} onDone={close} />
        <button className="btn btn-sm" data-test={`agent-cancel.${use}`} onClick={close}><X size={12} /> Cancel</button>
        <span className="sp" />
        <span className="dim small">from {fmtDate(dateOf(s, s.time.day + 1))}</span>
      </div>
    </div>
  );
}

/** AI share allowed (safety work): the share of every safety programme's and case's work handed to AI staff. */
function Trusted({ s, v }: { s: GameStateV2; v: AgentsView }) {
  const t = v.trusted;
  const at = (x: number) => Math.max(0, Math.min(1, Math.round(x * 100) / 100));
  const tip = () => {
    const pv = previewTrusted(s, at(t.policy + 0.1));
    return (
      <TipCard title={<Term id="trustedToAI">AI share allowed</Term>} value={F.pct(t.policy)} rows={[
        { label: 'In effect', value: t.effective > 0 || t.policy <= 0 ? F.pct(t.effective) : 'off (no AI staff on safety)' },
        { label: 'Safety results / yr', value: `${pv.findingsBefore.toFixed(1)} now · ${pv.findingsAfter.toFixed(1)} at +10%` },
        { label: <Term id="aiFte">AI staff, in people</Term>, value: F.count(v.safetyAiFte) },
      ]} footer="A sabotaging model returns false results and corrupts cases in proportion to the work it does.">The most of every safety programme&apos;s and open case&apos;s work you hand to AI staff. They do the part their model can do alone.</TipCard>
    );
  };
  return (
    <span className="stepper" data-home="trustedToAI">
      <ActBtn id="agents.trusted" testId="agents.trusted.down" params={{ share: at(t.policy - 0.1) }} icon={ICON.minus} label="" block={t.policy <= 0 ? 'Already 0%' : undefined} ariaLabel="Less AI share allowed" />
      <Tip content={tip}><b className="num" data-test="trusted-share">{F.pct(t.policy)}</b></Tip>
      <ActBtn id="agents.trusted" testId="agents.trusted.up" params={{ share: at(t.policy + 0.1) }} icon={ICON.plus} label="" block={t.policy >= 1 - 1e-9 ? 'Already 100%' : undefined} ariaLabel="More AI share allowed" />
    </span>
  );
}

/** Spot-checks: the share of AI-done safety work a person re-checks (none / 2% / 10%). */
function SpotCheck({ s, allowed }: { s: GameStateV2; allowed: number }) {
  const q = spotCheckChosen(s);
  const inEffect = spotShare(s);
  const sv = safetyAgentVersion(s);
  const tip = () => (
    <TipCard title={<Term id="spotCheck">Spot-checks</Term>} value={q > 0 ? F.pct(q) : 'none'} rows={[
      { label: 'In effect (staffed)', value: F.pct(inEffect) },
      { label: 'Safety research engineers it takes', value: F.count(spotCheckFte(s)) },
      { label: 'Sabotaged AI work caught by re-checks', value: sv ? `${F.pct(believedSpotCatch(s, sv, inEffect))} (believed)` : 'no AI staff on safety work' },
    ]}>Share of the safety work AI staff do that a person re-checks by hand. It takes safety research engineers from the safety needs list below.</TipCard>
  );
  if (allowed <= 0) return <Tip content={tip}><span className="small" data-home="spotCheck">none needed at 0%</span></Tip>;
  return (
    <span className="la-seg" data-home="spotCheck">
      {SPOT_SHARES.map((x) => (Math.abs(x - q) < 1e-9 ? <span key={x} className="seg-on" data-test={`spot.${x}`}>{x > 0 ? `${Math.round(x * 100)}%` : 'none'}</span> : <ActBtn key={x} id="safety.spotCheck" testId={`spot.${x}`} params={{ share: x }} label={x > 0 ? `${Math.round(x * 100)}%` : 'none'} />))}
      <Tip content={tip}><span className="dim small" data-test="spot-share">{q > 0 ? F.pct(q) : 'none'}</span></Tip>
    </span>
  );
}

function KV({ k, children, test }: { k: ReactNode; children: ReactNode; test?: string }) {
  return <div className="la-kv" data-test={test}><span className="k">{k}</span><span className="v">{children}</span></div>;
}

function JobCard({ s, v, w, use, danger, draft, setDraft }: { s: GameStateV2; v: AgentsView; w?: WorkTypeView; use: AgentUse; danger?: DangerRead; draft?: AgentChange; setDraft: (c: AgentChange | null) => void }) {
  const l = v.lanes[use];
  const def = AGENT_USE_DEF[use];
  const Ic = USE_ICON[use];
  const pkg = s.player.agents[use];
  const isRoutine = use === 'capRoutine';
  const newest = newestInternal(s);
  const models = [...(isRoutine ? [] : [{ value: '', label: `newest · ${newest?.name ?? '—'}` }]), ...modelOptions(s, () => true)];
  const monitors = [{ value: MONITOR_AUTO, label: `auto · ${pkg.monitorId === MONITOR_AUTO && l.monitor ? (l.monitor.id === l.version?.id ? 'copy' : l.monitor.name) : 'most capable trusted'}` }, { value: '', label: 'none' }, { value: MONITOR_SAME, label: `copy of ${l.version?.name ?? 'the model'}` }, ...modelOptions(s, () => true)];
  const modelVal = draft?.versionId !== undefined ? draft.versionId ?? '' : isRoutine ? pkg.versionId ?? '' : pkg.versionId && versionById(s, pkg.versionId) ? pkg.versionId : '';
  const monVal = draft?.monitorId !== undefined ? draft.monitorId ?? '' : pkg.monitorId ?? '';
  const isSaf = use === 'safety';
  const A = isSaf ? v.trusted.aiShare : (w?.A ?? 0);
  const m = Math.max(1, w?.m ?? 1);
  const online = Math.max(1, s.player.computeOnline);
  const teams = USE_TEAMS[use].keys.reduce((a, k) => a + teamsOfKey(s.player, k).length, 0);
  const evaluating = l.version?.status === 'evaluating';
  const shareTip = () => (
    <TipCard title={<Term id={isSaf ? 'aiDoneShare' : 'aiShareWork'}>AI share of the work</Term>} value={F.pct(A)} rows={[
      ...(w ? [{ label: <Term id="coverage">Can do alone</Term>, value: F.pct(w.coverage) }] : []),
      ...(isSaf ? [{ label: <Term id="trustedToAI">AI share allowed</Term>, value: F.pct(v.trusted.policy) }] : []),
      ...(use === 'capFrontier' ? [{ label: <Term id="researchTaste">Research taste</Term>, value: tasteWord(v.sdAI) }] : []),
    ]}>{isSaf ? 'Share of safety work your AI staff do: at most the AI share allowed, and only what the model can do alone.' : "Share of this job's work your AI staff do. It grows with the model's skill at the job and with the compute you give the AI staff (Allocation)."}{w && !w.measured ? ' The model is not measured yet: a measured relative stands in.' : ''}</TipCard>
  );
  return (
    <div className={`la-job ${isSaf ? 'saf' : ''}`} id={`ctl-job.${use}`} data-lane={use}>
      <div className="la-jh">
        <span className="la-ic"><Ic size={17} /></span><b>{def.name}</b><span className="sp" />
        <PkgChip kind="model" testId={`agent-model.${use}`} value={modelVal} options={models} changed={draft?.versionId !== undefined} onPick={(x) => setDraft({ ...(draft ?? {}), versionId: x || null })} />
      </div>
      <div className="la-hero">
        <Tip content={shareTip}><b className={`num ${A <= 0 ? 'dim' : ''}`} data-test={`ai-share.${use}`}>{F.pct(A)}</b></Tip>
        <Term id={isSaf ? 'aiDoneShare' : 'aiShareWork'}>AI share of the work</Term>
        <span className="sp" />
        {evaluating && <Tip content={() => <TipCard title="Model in evals">{`${l.version?.name ?? 'The model'} is still being tested: its skills are read from a measured relative until the evals finish.`}</TipCard>}><span className="la-chip"><ICON.experiments size={12} /> model in evals</span></Tip>}
      </div>
      <Tip content={shareTip}>
        <div>
          <span className="la-split"><i className="pp" style={{ flex: Math.max(1e-6, 1 - A) }} /><i className="ai" style={{ flex: Math.max(0, A) }} /></span>
          <div className="la-splitl small dim"><span>people {F.pct(1 - A)}</span><span>AI staff {F.pct(A)}</span></div>
        </div>
      </Tip>
      <Tip content={() => <TipCard title={<Term id="workDone">Work done</Term>} value={xm(m)} rows={[{ label: 'People alone', value: '×1' }, { label: 'Added by AI staff', value: m - 1 >= 10 ? xm(m - 1) : `×${(m - 1).toFixed(2)}` }]}>This job&apos;s work, people and AI staff together, as × what the people alone would do.</TipCard>}>
        <div className="la-wd"><Term id="workDone">Work done</Term> <b className="num">{xm(m)}</b> <span>the people alone</span></div>
      </Tip>
      <div className="la-kvs">
        {isSaf ? (
          <>
            <KV k={<Term id="trustedToAI">AI share allowed</Term>}><Trusted s={s} v={v} /></KV>
            <KV k={<Term id="spotCheck">Spot-checks</Term>}><SpotCheck s={s} allowed={v.trusted.policy} /></KV>
            <KV k={<><Term id="agentCopies">Copies</Term> · compute</>}><Tip content={() => <TipCard title="AI staff on safety" rows={[{ label: 'Copies', value: F.count(l.copies) }, { label: 'Compute', value: `${F.h100e(l.compute)} H100e` }]}>Runs on safety compute (Allocation).</TipCard>}><b className="num">{F.count(l.copies)} · {F.h100e(l.compute)}</b></Tip>{l.compute <= 0 && <span className="tag2" data-test={`lane-off.${use}`}>off</span>}</KV>
          </>
        ) : (
          <>
            <KV k={<Term id="agentCopies">Copies</Term>}><Tip content={() => <TipCard title={<Term id="agentCopies">Copies</Term>} rows={[{ label: 'Copies running', value: F.count(l.copies) }, { label: 'Speed of each', value: `${(w?.speed ?? 0).toFixed(0)}× a person` }]}>How many copies run at once.</TipCard>}><b className="num">{F.count(l.copies)}</b></Tip>{l.compute <= 0 && <span className="tag2" data-test={`lane-off.${use}`}>off</span>}</KV>
            <KV k="Compute"><Tip content={() => <TipCard title="Compute" value={`${F.h100e(l.compute)} H100e`} rows={[{ label: 'Share of compute online', value: F.pct(l.compute / online, 1) }]}>Set on the compute allocation.</TipCard>}><span><b className="num">{F.h100e(l.compute)} H100e</b> <span className="dim num">· {F.pct(l.compute / online, 1)}</span></span></Tip> <Ref id="computeSplit" to={{ panel: 'lab', tab: 'board', anchor: 'split' }}>Allocation</Ref></KV>
            <KV k={<Term id="costPerHour">Cost per hour of work</Term>}><Tip content={() => <TipCard title={<Term id="costPerHour">Cost per hour of work</Term>} rows={[{ label: 'AI staff', value: perHour(w?.costAI ?? Infinity) }, { label: 'Your best people', value: perHour(w?.costHuman ?? Infinity) }]}>An hour of this job&apos;s work, at the rental price of compute against your people&apos;s pay.</TipCard>}><span><b className="num">{perHour(w?.costAI ?? Infinity)}</b> <span className="dim num">· people {perHour(w?.costHuman ?? Infinity)}</span></span></Tip></KV>
          </>
        )}
        <KV k="Works with"><Tip content={() => <TipCard title="Works with" rows={USE_TEAMS[use].keys.map((k) => ({ label: TEAM_WORD[k], value: `${teamsOfKey(s.player, k).length} teams` }))}>The teams whose work this job shares.</TipCard>}><span>{USE_TEAMS[use].label} · <span className="num">{teams}</span> teams</span></Tip></KV>
        {isSaf ? (
          <KV k="Safeguards on AI staff"><Ref id="safeguards" to={{ panel: 'safety', tab: 'safeguards' }}>Safety</Ref></KV>
        ) : (
          <KV k={<Term id="agentMonitor">Watched by</Term>} test={`watch.${use}`}>
            <PkgChip kind="monitor" testId={`agent-monitor.${use}`} value={monVal} options={monitors} changed={draft?.monitorId !== undefined} onPick={(x) => setDraft({ ...(draft ?? {}), monitorId: x || null })} />
            {!l.monitor && l.copies > 0 && <Tip content={() => <TipCard title="No watcher">{l.monitorReason ?? 'No model watches these AI staff: incidents by them go unseen by monitors.'}</TipCard>}><span className="tone-warn small"> no watcher</span></Tip>}
          </KV>
        )}
        {l.compute > 0 && danger && <KV k={<Term id="danger">Harmful acts</Term>}><DangerChip r={danger} where={def.name} compact testId={`agent-danger.${use}`} /></KV>}
      </div>
      {draft && (draft.versionId !== undefined || draft.monitorId !== undefined) && <EditPop s={s} use={use} c={draft} close={() => setDraft(null)} />}
    </div>
  );
}

/** The four AI staff jobs (Engineering · Experiments · Ideas · Safety) with the totals and the links to their other homes. */
export function AIStaffJobs({ s }: { s: GameStateV2 }) {
  const v = useMemo(() => agentsView(s), [s, s.time.day, JSON.stringify(s.player.agents), (s.player.tooling ?? []).join(','), s.player.policies.trustedToAI, JSON.stringify(s.player.split), s.player.deployments.some((d) => d.channel === 'internal' && controlOn(d))]);
  const danger = useMemo(() => dangerView(s).lanes, [s, s.time.day, JSON.stringify(s.player.agents), JSON.stringify(s.player.split), s.player.deployments.some((d) => d.channel === 'internal' && controlOn(d))]);
  const wts = useMemo(() => workTypeViews(s), [s, s.time.day, JSON.stringify(s.player.agents), JSON.stringify(s.player.split), s.player.policies.trustedToAI]);
  const [drafts, setDrafts] = useState<Partial<Record<AgentUse, AgentChange>>>({});
  const setDraft = (u: AgentUse) => (c: AgentChange | null) => setDrafts((d) => { const n = { ...d }; if (c) n[u] = c; else delete n[u]; return n; });
  const copies = AGENT_USES.reduce((a, u) => a + v.lanes[u].copies, 0);
  const owned = (s.player.tooling ?? []).length;
  const toBuild = INTERNAL_TOOLS.length - owned;
  return (
    <section id="ctl-agents" data-home="agents" className="la-jobs-w">
      <div className="la-sec">
        <span className="cap2"><ICON.agents size={12} /> AI staff by job</span>
        <span className="sp" />
        <Tip content={() => <TipCard title="All AI staff" rows={AGENT_USES.map((u) => ({ label: AGENT_USE_DEF[u].name, value: `${F.count(v.lanes[u].copies)} copies · ${F.h100e(v.lanes[u].compute)} H100e · ${F.money(v.lanes[u].cost + v.lanes[u].monitorCost, { perYear: true })}` }))}>Copies, compute and yearly cost of all your AI staff and their watchers.</TipCard>}>
          <span className="small la-tot" data-test="agents-total"><b className="num">{F.count(copies)}</b> copies · <b className="num">{F.h100e(v.total)}</b> <Term id="h100e">H100e</Term> · <b className="num">{F.money(v.totalCost)}</b>/yr</span>
        </Tip>
        <Ref id="labTools" to={{ panel: 'research', tab: 'knowhow', anchor: 'labTools' }}>Lab tools: {owned ? `${owned} owned` : 'none owned'}{toBuild > 0 ? `, ${toBuild} to build` : ''} · Know-how</Ref>
        <Ref id="jobFit" to={{ panel: 'models' }}>How close AI is to each job · Models</Ref>
      </div>
      <div className="la-jobs">
        {AGENT_USES.map((u) => <JobCard key={u} s={s} v={v} use={u} w={wts.find((w) => w.wt === USE_WT[u])} danger={danger[u]} draft={drafts[u]} setDraft={setDraft(u)} />)}
      </div>
    </section>
  );
}
