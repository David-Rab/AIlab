// Lab › AI staff & needs (STRUCTURE §4.9, BUILD-PLAN R7, mockups-v3 v3-company). HOME of every internal agent
// package (model, monitor, compute), the AI share of each role's work, and Trusted to AI (D4). One lane per internal
// use: model chip, monitor chip with catch rate, compute bar with its budget, AI share of the role's work, cost, the
// model's four risk families. A model or monitor pick opens a before → after preview (applies at the next tick).
import { controlOn } from '../../../engine/v2/safety/safeguards';
import { SPOT_SHARES, believedSpotCatch, spotCheckChosen, spotCheckFte, spotShare } from '../../../engine/v2/safety/workPackage';
import { safetyAgentVersion } from '../../../engine/v2/safety/agents';
// RD-A06: every package names its model (no pick = the newest internal model, said so), has its own control switch, and
// the agents' tooling (Coding harness, Research harness, Agent memory) is built here, not taken from product features.
import { useMemo, useState, type ReactNode } from 'react';
import { Crown, Gamepad2, Ghost, Pencil, ThumbsUp, X, type LucideIcon } from 'lucide-react';
import { AGENT_USES, AGENT_USE_DEF, MONITOR_AUTO, MONITOR_SAME, RISK_FAMILIES } from '../../../data/v2/agents';
import {
  agentChangeBlock, agentsView, dangerView, dateOf, fmtDate, newestInternal, previewAgentChange, previewTrusted, toolingView, versionById,
} from '../../../engine/v2';
import type { AgentChange, AgentLane, AgentUse, AgentsView, DangerRead, GameStateV2, RiskBadge } from '../../../engine/v2';
import { ActBtn, Term, Tip, TipCard, type Params } from '../ui';
import { Card, HBar, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C, SPHERE } from '../theme';
import { CatchX, modelOptions, PkgChip } from './chips';
import { DangerChip } from './Danger';
import './agents.css';

const USE_ICON: Record<AgentUse, LucideIcon> = { eng: ICON.roleEng, capRoutine: ICON.roleRE, capFrontier: ICON.roleSci, safety: ICON.safety };
const FAM_ICON: Record<string, LucideIcon> = { please: ThumbsUp, gaming: Gamepad2, deception: Ghost, power: Crown };
const ROLE_WORK: Record<AgentUse, string> = { eng: "of engineers' work", capRoutine: "of research engineers' work", capFrontier: "of scientists' work", safety: 'of safety work' };
const AI_TERM: Record<AgentUse, string> = { eng: 'aiShareWork', capRoutine: 'aiShareWork', capFrontier: 'researchTaste', safety: 'trustedToAI' };
const STEP = 0.05;
/** Research taste in player words (VOCAB: no SD): the share of human scientists a taste this many SD above the median beats. */
const phi = (z: number) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
const tasteWord = (sd: number) => `beats ${F.pct(phi(sd))} of scientists`;

function changeParams(use: AgentUse, c: AgentChange): Params {
  const p: Params = { use };
  if (c.versionId !== undefined) p.versionId = c.versionId ?? '';
  if (c.monitorId !== undefined) p.monitorId = c.monitorId ?? '';
  if (c.compute !== undefined) p.compute = c.compute;
  return p;
}

/** The four risk-family badges of a lane's model (estimates; L1 icons, numbers in the tooltip). */
function RiskBadges({ lane }: { lane: AgentLane }) {
  return (
    <span className="ag-risk">
      {RISK_FAMILIES.map((f) => {
        const r = lane.risk[f.id];
        const Ic = FAM_ICON[f.id];
        return (
          <Tip key={f.id} content={() => <TipCard title={<Term id="riskFamily">{f.label}</Term>} value={r.badge} rows={[
            { label: 'Highest trait belief', value: F.pct(r.est) }, { label: 'How well your instruments read it', value: F.pct(r.clarity) },
          ]} footer={`Here a misaligned model can: ${AGENT_USE_DEF[lane.use].misuse.toLowerCase()}.`}>{lane.version?.name ?? 'No model'}: {r.badge === 'unseen' ? 'your instruments cannot read this family on it (Unknown).' : r.badge === 'watch' ? 'a trait in this family is believed at 30% or more.' : 'beliefs are low.'}</TipCard>}>
            <span className={`rb rb-${r.badge}`} data-risk={r.badge}><Ic size={12} /></span>
          </Tip>
        );
      })}
    </span>
  );
}

function RiskLegend() {
  const item = (b: RiskBadge, label: string) => <span className="row-i"><span className={`rb rb-${b}`}><ThumbsUp size={10} /></span>{label}</span>;
  return (
    <div className="ag-legend small dim">
      {item('low', 'low')}{item('watch', 'watch')}{item('unseen', 'unknown')}
      <span>· <Term id="riskFamily">risk families</Term> of the model: {RISK_FAMILIES.map((f) => f.label).join(' · ')}</span>
    </div>
  );
}

/** Before → after of one package change (D7: applies at the next tick). */
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
  if (c.monitorId !== undefined) lines.push(['Monitor', name(lb, 'monitor'), name(la, 'monitor')]);
  if (c.compute !== undefined) lines.push(['Compute', F.pct(lb.share), F.pct(la.share)]);
  return (
    <div className="ag-pop" data-test={`agent-edit.${use}`}>
      <div className="pop-h"><Pencil size={12} /><b>{AGENT_USE_DEF[use].name}</b><span className="dim">· {use === 'safety' ? 'safety compute' : 'capabilities compute'}</span></div>
      <div className="pop-ch">{lines.map(([k, f, t]) => <div key={k}><span className="tag2">{k}</span> {f} → <b>{t}</b></div>)}</div>
      {/* Jank M4: warn when the change moves the package to a model that measures below the one it replaces. */}
      {c.versionId !== undefined && la.version && lb.version && la.L < lb.L - 0.05 && <div className="small tone-warn" data-test={`agent-worse.${use}`}>⚠ {la.version.name} measures level {F.level(la.L)}, below {lb.version.name} (level {F.level(lb.L)})</div>}
      {block ? <div className="tone-neg small">{block}</div> : (
        <div className="pv">
          {row(<Term id="effectiveLabour">Total effort, experiments</Term>, b.mExp, a.mExp, (x) => F.mult(x))}
          {row(<Term id="effectiveLabour">Total effort, ideas</Term>, b.mIdeas, a.mIdeas, (x) => F.mult(x))}
          {row(<Term id={AI_TERM[use]}>AI share</Term>, lb.aiShare, la.aiShare, (x) => F.pct(x))}
          {use === 'eng' && row(<Term id="buildCapacity">Build capacity</Term>, b.build, a.build, (x) => `${x.toFixed(1)} teams`)}
          {use === 'capFrontier' && row(<Term id="researchTaste">Research taste</Term>, b.sdAI, a.sdAI, (x) => tasteWord(x))}
          {row(<Term id="agentCopies">Copies</Term>, lb.copies, la.copies, (x) => F.count(x))}
          {(lb.monitor || la.monitor) && row(<Term id="catchRate">Stop rate</Term>, lb.catch, la.catch, (x) => F.pct(x))}
          {row(<Term id="agentMonitor">Safeguards</Term>, b.monitors.used, a.monitors.used, (x) => `${F.pct(x, 1)} of compute`, false)}
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

/** Trusted to AI (home, D4): the share of safety work done by the safety agents; B3 gate (no cap since model v3 E2). */
function Trusted({ s, v }: { s: GameStateV2; v: AgentsView }) {
  const t = v.trusted;
  const at = (x: number) => Math.max(0, Math.min(1, Math.round(x * 100) / 100));
  const tip = () => {
    const pv = previewTrusted(s, at(t.policy + 0.1));
    return (
      <TipCard title={<Term id="trustedToAI">AI share allowed</Term>} value={F.pct(t.policy)} rows={[
        { label: 'In effect', value: t.effective > 0 || t.policy <= 0 ? F.pct(t.effective) : 'off (no AI staff on safety)' },
        { label: <Term id="aiDoneShare">AI share of safety work</Term>, value: `${F.pct(t.aiShare)} · ${F.pct(pv.aiShareAfter)} at +10%` },
        { label: 'Safety results / yr', value: `${pv.findingsBefore.toFixed(1)} now · ${pv.findingsAfter.toFixed(1)} at +10%` },
        { label: <Term id="aiFte">AI staff, in people</Term>, value: F.count(v.safetyAiFte) },
      ]} footer="A sabotaging model returns false results and corrupts cases in proportion to the work it does.">The most of every safety programme's and open case's work you hand to AI staff. They do the part their model can do alone (Safety experiments and Safety ideas on Lab › AI staff & needs). One policy for all safety work.</TipCard>
    );
  };
  return (
    <div className="ag-trust" data-home="trustedToAI">
      <Tip content={tip}><span className="row-i"><Term id="trustedToAI">AI share allowed</Term> <b className="num" data-test="trusted-share">{F.pct(t.policy)}</b></span></Tip>
      <span className="stepper">
        <ActBtn id="agents.trusted" testId="agents.trusted.down" params={{ share: at(t.policy - 0.1) }} icon={ICON.minus} label="" block={t.policy <= 0 ? 'Already 0%' : undefined} />
        <ActBtn id="agents.trusted" testId="agents.trusted.up" params={{ share: at(t.policy + 0.1) }} icon={ICON.plus} label="" block={t.policy >= 1 - 1e-9 ? 'Already 100%' : undefined} />
      </span>
    </div>
  );
}

/** SR-22: the Safety work package's human spot-check share (none / 2% / 10% of AI-done safety work re-checked). */
function SpotCheck({ s }: { s: GameStateV2 }) {
  const q = spotCheckChosen(s);
  const inEffect = spotShare(s);
  const sv = safetyAgentVersion(s);
  const tip = () => (
    <TipCard title={<Term id="spotCheck">Spot-checks</Term>} value={q > 0 ? F.pct(q) : 'none'} rows={[
      { label: 'In effect (staffed)', value: F.pct(inEffect) },
      { label: 'Safety research engineers it takes', value: F.count(spotCheckFte(s)) },
      { label: 'Sabotaged AI work caught by re-checks', value: sv ? `${F.pct(believedSpotCatch(s, sv, inEffect))} (believed)` : 'no AI staff on safety work' },
    ]}>Share of the safety work AI staff do that a person re-checks by hand. It takes safety research engineers from the safety needs list (Lab › AI staff & needs) and catches sabotaged AI work; a re-checked validation of a false instrument finds what it really finds.</TipCard>
  );
  return (
    <div className="ag-trust" data-home="spotCheck">
      <Tip content={tip}><span className="row-i"><Term id="spotCheck">Spot-checks</Term> <b className="num" data-test="spot-share">{q > 0 ? F.pct(q) : 'none'}</b></span></Tip>
      <span className="stepper">
        {SPOT_SHARES.map((x) => <ActBtn key={x} id="safety.spotCheck" testId={`spot.${x}`} params={{ share: x }} label={x > 0 ? `${Math.round(x * 100)}%` : 'none'} block={Math.abs(x - q) < 1e-9 ? 'Already chosen' : undefined} />)}
      </span>
    </div>
  );
}

function Lane({ s, v, use, danger, draft, setDraft }: { s: GameStateV2; v: AgentsView; use: AgentUse; danger?: DangerRead; draft?: AgentChange; setDraft: (c: AgentChange | null) => void }) {
  const l = v.lanes[use];
  const def = AGENT_USE_DEF[use];
  const Ic = USE_ICON[use];
  const pkg = s.player.agents[use];
  const isRoutine = use === 'capRoutine';
  const newest = newestInternal(s);
  const models = [
    ...(isRoutine ? [] : [{ value: '', label: `newest · ${newest?.name ?? '—'}` }]),
    ...modelOptions(s, () => true),
  ];
  const monitors = [{ value: MONITOR_AUTO, label: `auto · ${pkg.monitorId === MONITOR_AUTO && l.monitor ? (l.monitor.id === l.version?.id ? 'copy' : l.monitor.name) : 'most capable trusted'}` }, { value: '', label: 'none' }, { value: MONITOR_SAME, label: `copy of ${l.version?.name ?? 'the model'}` }, ...modelOptions(s, () => true)];
  const modelVal = draft?.versionId !== undefined ? draft.versionId ?? '' : isRoutine ? pkg.versionId ?? '' : pkg.versionId && versionById(s, pkg.versionId) ? pkg.versionId : '';
  const monVal = draft?.monitorId !== undefined ? draft.monitorId ?? '' : pkg.monitorId ?? '';
  const budget = def.budget === 'saf' ? 'Safety' : 'Capab.';
  const shareNext = (d: number) => Math.max(0, Math.min(use === 'safety' ? 0.6 : 1, Math.round((l.share + d) * 100) / 100));
  const aiSub = use === 'capFrontier' ? <><span>{ROLE_WORK[use]}</span> · <Term id="researchTaste">Research taste</Term> <span className="num">{tasteWord(v.sdAI)}</span></> : <span>{ROLE_WORK[use]}</span>;
  return (
    <div className={`ag-lane ${draft ? 'editing' : ''}`} data-lane={use}>
      <div className="ag-use">
        <Tip content={() => <TipCard title={def.name}>{use === 'safety' ? 'Runs on safety compute.' : `Job ${def.order} of 3 on capabilities compute: ${def.work}`}</TipCard>}><span className={`ag-ord ${def.budget}`}>{use === 'safety' ? <Ic size={13} /> : def.order}</span></Tip>
        <div><b>{def.name}</b><div className="small dim">{def.work}</div></div>
      </div>
      <PkgChip kind="model" testId={`agent-model.${use}`} value={modelVal} options={models} changed={draft?.versionId !== undefined} onPick={(x) => setDraft({ ...(draft ?? {}), versionId: x || null })} />
      {/* F6b: catch rate and the same-model tag on a line under the picker (inline they squeezed the picker to its arrow). */}
      <div className="ag-mon">
      <PkgChip kind="monitor" testId={`agent-monitor.${use}`} value={monVal} options={monitors} changed={draft?.monitorId !== undefined} onPick={(x) => setDraft({ ...(draft ?? {}), monitorId: x || null })} />
      {l.monitorReason && <Tip content={() => <TipCard title="Automatic monitor">{l.monitorReason} A model is trusted when none of its hidden-goal traits (scheming, alignment faking, sandbagging) is believed above your Safety framework's line. Pick a model to override.</TipCard>}><div className="small dim" data-test={`monitor-auto.${use}`}>{l.monitor ? 'auto: most capable trusted' : 'auto: no trusted model'}</div></Tip>}
      {l.monitor && <div className="ag-mon-x small">
          <CatchX rate={l.catch} gap={l.gap} coverage={v.monitors.coverage} copy={l.copy} collusion={l.catchColl} testId={`agent-catch.${use}`} note={<>Incidents by these AI staff are caught by your instruments, more so with a stronger monitor ({F.pct(l.strength)}). Runs on safety compute.</>} />
          {/* Jank AG1: a model watching a copy of itself can collude; say so where the monitor is chosen. */}
          {l.copy && <Tip content={() => <TipCard title={<Term id="collusion">Same lineage watching itself</Term>}>A copy of the model it monitors shares its goals and blind spots: if the model schemes, the monitor may cover for it. On scheming-type incidents its stop rate is ×0.6 (×0.8 with comms lockdown). A model from another base (ideally weaker but trusted) avoids it.</TipCard>}><span className="tag2 warn" data-test={`same-monitor.${use}`}>same model</span></Tip>}
      </div>}
      </div>
      <div className="ag-cmp">
        <Tip content={() => <TipCard title={<Term id="agentBudget">Compute</Term>} value={`${F.h100e(l.compute)} H100e`} rows={[
          { label: use === 'safety' ? 'Share of safety work compute' : use === 'eng' ? 'Share of compute (its own use)' : 'Share of AI staff research compute', value: F.pct(use === 'eng' ? s.player.split.engineering : l.share) },
          { label: <Term id="agentCopies">Copies × speed</Term>, value: `${F.count(l.copies)} × ${l.speed.toFixed(0)}` },
          ...(l.monitor ? [{ label: <Term id="agentMonitor">Safeguards (safety compute)</Term>, value: `${F.h100e(l.monitorH100e)} H100e` }] : []),
        ]}>{use === 'safety' ? 'AI staff on safety run on a share of safety compute.' : use === 'eng' ? 'AI staff on engineering run on their own use in the compute allocation (Lab).' : 'AI staff on experiments and on ideas share AI staff research compute (Lab).'}</TipCard>}>
          <div className="row-i"><HBar v={l.share} max={1} color={def.budget === 'saf' ? SPHERE.saf : SPHERE.cap} w={64} /><b className="num">{F.h100e(l.compute)}</b><span className={`dept-tag ${def.budget}`}>{budget}</span>{l.compute <= 0 && <span className="tag2" data-test={`lane-off.${use}`}>off</span>}</div>
        </Tip>
        <div className="row-i small dim"><Tip content={() => <TipCard title={<Term id="agentCopies">Copies × speed</Term>} rows={[{ label: 'Copies running', value: F.count(l.copies) }, { label: 'Speed of each', value: `${l.speed.toFixed(0)}× a human` }]}>How many copies run at once and how fast each thinks.</TipCard>}><span className="num">{F.count(l.copies)} copies × {l.speed.toFixed(0)}</span></Tip><span className="sp" />
          {use !== 'eng' && <span className="stepper mini">
            <ActBtn id="agents.set" testId={`agents.compute.down.${use}`} params={{ use, compute: shareNext(-STEP) }} icon={ICON.minus} label="" block={l.share <= 0 ? 'Already 0%' : undefined} />
            <ActBtn id="agents.set" testId={`agents.compute.up.${use}`} params={{ use, compute: shareNext(STEP) }} icon={ICON.plus} label="" block={l.share >= (use === 'safety' ? 0.6 : 1) - 1e-9 ? 'At the maximum' : undefined} />
          </span>}
        </div>
      </div>
      <div className="ag-ai">
        {use === 'safety' ? <><Trusted s={s} v={v} /><SpotCheck s={s} /></> : (
          <Tip content={() => <TipCard title={<Term id={AI_TERM[use]}>AI share</Term>} value={F.pct(l.aiShare)}>{use === 'eng' ? "Share of the engineers' work your AI staff do. More compute or a more skilled model raises it, and build capacity with it." : use === 'capRoutine' ? "Share of the research engineers' work your AI staff do." : "The share of human scientists this model's research taste beats. The model on ideas sets research taste."} Skill, can do alone and total effort: Lab › AI staff & needs.</TipCard>}>
            <div><div className="row-i"><HBar v={l.aiShare} max={1} color={C.good} w={120} /><b className="num" data-test={`ai-share.${use}`}>{F.pct(l.aiShare)}</b></div><div className="small dim">{aiSub}</div></div>
          </Tip>
        )}
        <div className="small row-i"><Tip content={() => <TipCard title={<Term id="agentControl">Control protocol</Term>} value={pkg.control ? 'on' : 'off'}>{pkg.control ? 'These AI staff work under trusted monitoring with deferral. Turning it off ends its slowdown, and its containment and deferral.' : 'Turn on to defer the most suspicious actions of these AI staff to their monitor, at a slowdown on this job only.'}</TipCard>}><span><ActBtn id="agents.set" testId={`agents.control.${use}`} params={{ use, control: !pkg.control }} label={pkg.control ? 'Control protocol on' : 'Control protocol off'} /></span></Tip></div>
        {l.control.on && l.compute > 0 && <div className="small"><Tip content={() => <TipCard title={<Term id="controlTax">Slowdown</Term>} value={`−${F.pct(l.control.tax)} AI work`} rows={[ { label: 'Actions deferred to the trusted model', value: F.pct(l.control.defer) }, { label: <Term id="oversightGap">Watcher gap</Term>, value: l.monitor ? (l.control.gapOom > 1e-6 ? `needs ×${F.short(10 ** l.control.gapOom)} effective compute` : 'none') : 'no monitor: people redo them' }, { label: 'Unstopped harm', value: `×${l.control.missMult.toFixed(2)}` }, ]}>The control protocol is on: these AI staff work under trusted monitoring with deferral, so they do less useful work and get caught more.</TipCard>}><span className="tag2 warn" data-test={`control-tax.${use}`}>slowdown −{F.pct(l.control.tax)}</span></Tip></div>}
      </div>
      <Tip content={() => <TipCard title={<Term id="runCost">Cost / yr</Term>} value={F.money(l.cost + l.monitorCost, { perYear: true })} rows={[{ label: 'AI staff', value: F.money(l.cost, { perYear: true }) }, { label: 'Monitor', value: F.money(l.monitorCost, { perYear: true }) }]}>At the rental-equivalent price of an H100e.</TipCard>}>
        <span className="num ag-cost">{F.money(l.cost + l.monitorCost)}</span>
      </Tip>
      <div className="ag-rk"><RiskBadges lane={l} />{l.compute > 0 && <DangerChip r={danger} where={def.name} compact testId={`agent-danger.${use}`} />}</div>
      {draft && (draft.versionId !== undefined || draft.monitorId !== undefined) && <EditPop s={s} use={use} c={draft} close={() => setDraft(null)} />}
    </div>
  );
}

/** RD-A06: the internal agents' tooling (owned items, built by engineers; product features do not act here). */
function Tooling({ s }: { s: GameStateV2 }) {
  const tools = toolingView(s);
  return (
    <div className="ag-tools row-i small" data-home="agentTooling" data-test="agent-tooling">
      <Term id="agentTooling">Tools</Term>
      {tools.map((t) => (
        <Tip key={t.id} content={() => <TipCard title={t.name} value={t.owned ? 'built' : t.etaDays !== undefined ? `building · ${Math.ceil(t.etaDays)} d` : 'not built'} rows={[
          { label: 'Build', value: `${t.buildTW} team-weeks · ${F.money(t.cash)}` },
        ]}>{t.effect}.</TipCard>}>
          <span data-test={`tool.${t.id}`}>{t.owned ? <span className="tag2">{t.name} ✓</span> : t.etaDays !== undefined ? <span className="tag2 dim">{t.name} · {Math.ceil(t.etaDays)} d</span>
            : <ActBtn id="tooling.build" testId={`tooling.build.${t.id}`} params={{ id: t.id }} label={`Build ${t.name}`} block={t.block} />}</span>
        </Tip>
      ))}
    </div>
  );
}

export function AgentsAtWork({ s }: { s: GameStateV2 }) {
  const v = useMemo(() => agentsView(s), [s, s.time.day, JSON.stringify(s.player.agents), (s.player.tooling ?? []).join(','), s.player.policies.trustedToAI, (s.player.split.routine + s.player.split.frontier), s.player.split.safety, s.player.deployments.some((d) => d.channel === 'internal' && controlOn(d))]);
  // Model v3 E11: believed danger per lane (beliefs and measured levels only).
  const danger = useMemo(() => dangerView(s).lanes, [s, s.time.day, JSON.stringify(s.player.agents), (s.player.split.routine + s.player.split.frontier), s.player.split.safety, s.player.deployments.some((d) => d.channel === 'internal' && controlOn(d))]);
  const [drafts, setDrafts] = useState<Partial<Record<AgentUse, AgentChange>>>({});
  const setDraft = (u: AgentUse) => (c: AgentChange | null) => setDrafts((d) => { const n = { ...d }; if (c) n[u] = c; else delete n[u]; return n; });
  return (
    <Card id="ctl-agents" home="agents" className="agents-card"
      title={<span className="row-i"><ICON.agents size={15} /><Term id="agentPackage">AI staff</Term></span>}
      sub={<>model + monitor + control protocol + compute per job · <Tip content={() => <TipCard title="AI staff" rows={[...AGENT_USES.map((u) => ({ label: AGENT_USE_DEF[u].name, value: `${F.h100e(v.lanes[u].compute)} H100e · ${F.money(v.lanes[u].cost + v.lanes[u].monitorCost, { perYear: true })}` }))]}>Compute and yearly cost of all your AI staff.</TipCard>}><span><span className="num">{F.h100e(v.total)}</span> <Term id="h100e">H100e</Term> · <span className="num">{F.money(v.totalCost, { perYear: true })}</span></span></Tip></>}
      right={<span className="row-i small"><Ref id="researchMix" to={{ panel: 'lab', anchor: 'split' }}>Compute allocation</Ref><Ref id="rdmult" to={{ panel: 'lab' }}>Research speed</Ref></span>}>
      <div className="ag-head small dim"><span>Job</span><span>Model</span><span>Monitor · stop rate</span><span>Compute</span><span>AI share</span><span>Cost/yr</span><span><Term id="riskFamily">Risk</Term> · <Term id="danger">harmful acts</Term>/yr</span></div>
      {AGENT_USES.map((u) => <Lane key={u} s={s} v={v} use={u} danger={danger[u]} draft={drafts[u]} setDraft={setDraft(u)} />)}
      <Tooling s={s} />
      <RiskLegend />
    </Card>
  );
}
