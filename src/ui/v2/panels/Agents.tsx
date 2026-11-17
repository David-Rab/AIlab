// Company › Agents at work (STRUCTURE §4.9, BUILD-PLAN R7, mockups-v3 v3-company). HOME of every internal agent
// package (model, monitor, compute), the AI share of each role's work, and Trusted to AI (D4). One lane per internal
// use: model chip, monitor chip with catch rate, compute bar with its budget, AI share of the role's work, cost, the
// model's four risk families. A model or monitor pick opens a before → after preview (applies at the next tick).
import { useMemo, useState, type ReactNode } from 'react';
import { Crown, Gamepad2, Ghost, Pencil, ThumbsUp, X, type LucideIcon } from 'lucide-react';
import { AGENT_USES, AGENT_USE_DEF, MONITOR_SAME, RISK_FAMILIES } from '../../../data/v2/agents';
import {
  aiLabourGate, agentChangeBlock, agentsView, dateOf, fmtDate, previewAgentChange, previewTrusted, versionById,
} from '../../../engine/v2';
import type { AgentChange, AgentLane, AgentUse, AgentsView, GameStateV2, RiskBadge } from '../../../engine/v2';
import { ActBtn, Limit, Term, Tip, TipCard, type Params } from '../ui';
import { Card, HBar, Ref } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C, SPHERE } from '../theme';
import { CatchX, modelOptions, PkgChip } from './chips';
import './agents.css';

const USE_ICON: Record<AgentUse, LucideIcon> = { eng: ICON.roleEng, capRoutine: ICON.roleRE, capFrontier: ICON.roleSci, safety: ICON.safety };
const FAM_ICON: Record<string, LucideIcon> = { please: ThumbsUp, gaming: Gamepad2, deception: Ghost, power: Crown };
const ROLE_WORK: Record<AgentUse, string> = { eng: "of engineers' work", capRoutine: "of research engineers' work", capFrontier: "of scientists' work", safety: 'of safety work' };
const AI_TERM: Record<AgentUse, string> = { eng: 'aiShareWork', capRoutine: 'aiShareWork', capFrontier: 'researchTaste', safety: 'trustedToAI' };
const STEP = 0.05;

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
            { label: 'Highest trait estimate', value: F.pct(r.est) }, { label: 'Clarity of the estimates', value: F.pct(r.clarity) },
          ]} footer={`Here a misaligned model can: ${AGENT_USE_DEF[lane.use].misuse.toLowerCase()}.`}>{lane.version?.name ?? 'No model'}: {r.badge === 'unseen' ? 'your tools cannot read this family on it.' : r.badge === 'watch' ? 'a trait in this family is estimated at 30% or more.' : 'estimates are low.'}</TipCard>}>
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
      {item('low', 'low')}{item('watch', 'watch')}{item('unseen', 'unseen by tools')}
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
      <div className="pop-h"><Pencil size={12} /><b>{AGENT_USE_DEF[use].name}</b><span className="dim">· {use === 'safety' ? 'Safety budget' : 'Capabilities budget'}</span></div>
      <div className="pop-ch">{lines.map(([k, f, t]) => <div key={k}><span className="tag2">{k}</span> {f} → <b>{t}</b></div>)}</div>
      {/* Jank M4: warn when the change moves the package to a model that measures below the one it replaces. */}
      {c.versionId !== undefined && la.version && lb.version && la.L < lb.L - 0.05 && <div className="small tone-warn" data-test={`agent-worse.${use}`}>⚠ {la.version.name} measures L {F.level(la.L)}, below {lb.version.name} (L {F.level(lb.L)})</div>}
      {block ? <div className="tone-neg small">{block}</div> : (
        <div className="pv">
          {row(<Term id="rdmult">Research speed</Term>, b.M, a.M, (x) => F.mult(x))}
          {row(<Term id={AI_TERM[use]}>AI share</Term>, lb.aiShare, la.aiShare, (x) => F.pct(x))}
          {use === 'eng' && row(<Term id="buildCapacity">Build capacity</Term>, b.build, a.build, (x) => `${x.toFixed(1)} t-wk/wk`)}
          {use === 'capFrontier' && row(<Term id="researchTaste">AI taste</Term>, b.sdAI, a.sdAI, (x) => `${F.num(x, 1, true)} SD`)}
          {row(<Term id="agentCopies">Copies</Term>, lb.copies, la.copies, (x) => F.count(x))}
          {(lb.monitor || la.monitor) && row(<Term id="catchRate">Catch</Term>, lb.catch, la.catch, (x) => F.pct(x))}
          {row(<Term id="agentMonitor">Monitors</Term>, b.monitors.poolShare, a.monitors.poolShare, (x) => `${F.pct(x)} of safety`, false)}
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

/** Trusted to AI (home, D4): the share of safety work done by the safety agents; B3 gate; cap until P27. */
function Trusted({ s, v }: { s: GameStateV2; v: AgentsView }) {
  const t = v.trusted;
  const at = (x: number) => Math.max(0, Math.min(t.max, Math.round(x * 100) / 100));
  const tip = () => {
    const pv = previewTrusted(s, at(t.policy + 0.1));
    return (
      <TipCard title={<Term id="trustedToAI">Trusted to AI</Term>} value={F.pct(t.policy)} rows={[
        { label: 'In effect', value: t.gate === true ? F.pct(t.effective) : 'off (below the gate)' },
        ...(t.gate !== true ? [{ label: 'Unlocks when', value: String(t.gate) }] : []),
        { label: 'Cap', value: `${F.pct(t.max)}${t.max < 1 ? ' until Automated alignment research' : ''}` },
        { label: 'Safety findings / yr', value: `${pv.findingsBefore.toFixed(1)} now · ${pv.findingsAfter.toFixed(1)} at +10%` },
        { label: <Term id="aiFte">AI FTE</Term>, value: F.count(v.safetyAiFte) },
      ]} footer="A sabotaging model can return false findings and corrupt investigations.">Share of every funded agenda's and open investigation's work done by the safety agents. One policy for all safety work.</TipCard>
    );
  };
  return (
    <div className="ag-trust" data-home="trustedToAI">
      <Tip content={tip}><span className="row-i"><Term id="trustedToAI">Trusted to AI</Term> <b className="num" data-test="trusted-share">{F.pct(t.policy)}</b>{t.gate !== true && <span className="tag2 warn" data-test="trusted-gate">locked</span>}</span></Tip>
      {/* Jank AG3: name what unlocks the gate where it binds. */}
      {t.gate !== true && <span className="small dim" data-test="trusted-why">{t.gate}</span>}
      <span className="stepper">
        <ActBtn id="agents.trusted" testId="agents.trusted.down" params={{ share: at(t.policy - 0.1) }} icon={ICON.minus} label="" block={t.policy <= 0 ? 'Already 0%' : undefined} />
        <ActBtn id="agents.trusted" testId="agents.trusted.up" params={{ share: at(t.policy + 0.1) }} icon={ICON.plus} label="" block={t.policy >= t.max - 1e-9 ? `Capped at ${F.pct(t.max)}` : t.gate !== true ? t.gate : undefined} />
      </span>
      <Limit id="trusted.cap" tone={t.policy >= t.max - 1e-9 ? 'warn' : 'quiet'}>max {F.pct(t.max)}</Limit>
    </div>
  );
}

function Lane({ s, v, use, draft, setDraft }: { s: GameStateV2; v: AgentsView; use: AgentUse; draft?: AgentChange; setDraft: (c: AgentChange | null) => void }) {
  const l = v.lanes[use];
  const def = AGENT_USE_DEF[use];
  const Ic = USE_ICON[use];
  const pkg = s.player.agents[use];
  const isRoutine = use === 'capRoutine';
  const routine = v.lanes.capRoutine.version;
  const lock = use === 'safety' ? (x: Parameters<typeof aiLabourGate>[1]) => { const g = aiLabourGate(s, x); return g === true ? undefined : g; } : undefined;
  const models = [
    ...(isRoutine ? [] : [{ value: '', label: `as routine · ${routine?.name ?? '—'}` }]),
    ...modelOptions(s, (x) => x.variant !== 'open', lock),
  ];
  const monitors = [{ value: '', label: 'none' }, { value: MONITOR_SAME, label: `copy of ${l.version?.name ?? 'the model'}` }, ...modelOptions(s, (x) => x.variant !== 'open')];
  const modelVal = draft?.versionId !== undefined ? draft.versionId ?? '' : isRoutine ? pkg.versionId ?? '' : pkg.versionId && versionById(s, pkg.versionId) ? pkg.versionId : '';
  const monVal = draft?.monitorId !== undefined ? draft.monitorId ?? '' : pkg.monitorId ?? '';
  const budget = def.budget === 'saf' ? 'SAF' : 'CAP';
  const shareNext = (d: number) => Math.max(0, Math.min(use === 'safety' ? 0.6 : 1, Math.round((l.share + d) * 100) / 100));
  const aiSub = use === 'capFrontier' ? <><span>{ROLE_WORK[use]}</span> · <Term id="researchTaste">AI taste</Term> <span className="num">{F.num(v.sdAI, 1, true)} SD</span></> : <span>{ROLE_WORK[use]}</span>;
  return (
    <div className={`ag-lane ${draft ? 'editing' : ''}`} data-lane={use}>
      <div className="ag-use">
        <Tip content={() => <TipCard title={def.name}>{use === 'safety' ? 'Paid from the safety budget.' : `Use ${def.order} of 3 on the capabilities agent budget: ${def.work}`}</TipCard>}><span className={`ag-ord ${def.budget}`}>{use === 'safety' ? <Ic size={13} /> : def.order}</span></Tip>
        <div><b>{def.name}</b><div className="small dim">{def.work}</div></div>
      </div>
      <PkgChip kind="model" testId={`agent-model.${use}`} value={modelVal} options={models} changed={draft?.versionId !== undefined} onPick={(x) => setDraft({ ...(draft ?? {}), versionId: x || null })} />
      <PkgChip kind="monitor" testId={`agent-monitor.${use}`} value={monVal} options={monitors} changed={draft?.monitorId !== undefined} onPick={(x) => setDraft({ ...(draft ?? {}), monitorId: x || null })}
        extra={l.monitor && <>
          <CatchX rate={l.catch} gap={l.gap} coverage={v.monitors.coverage} testId={`agent-catch.${use}`} note={<>Internal incidents on this fleet are caught with your detection tools × (½ + ½ × monitor strength {F.pct(l.strength)}). Paid from the safety budget.</>} />
          {/* Jank AG1: a model watching a copy of itself can collude; say so where the monitor is chosen. */}
          {(pkg.monitorId === MONITOR_SAME || (pkg.monitorId && pkg.monitorId === (pkg.versionId ?? routine?.id))) && <Tip content={() => <TipCard title="Same model watching itself">A copy of the model it monitors shares its goals and blind spots: if the model schemes, the monitor may cover for it. A different model (ideally weaker but trusted) is the standard control setup.</TipCard>}><span className="tag2 warn" data-test={`same-monitor.${use}`}>same model</span></Tip>}
        </>} />
      <div className="ag-cmp">
        <Tip content={() => <TipCard title={<Term id="agentBudget">Compute</Term>} value={`${F.h100e(l.compute)} H100e`} rows={[
          { label: use === 'safety' ? 'Share of the safety pool' : 'Share of the agent pool', value: F.pct(l.share) },
          { label: <Term id="agentCopies">Copies × speed</Term>, value: `${F.count(l.copies)} × ${l.speed.toFixed(0)}` },
          ...(l.monitor ? [{ label: <Term id="agentMonitor">Monitor (safety pool)</Term>, value: `${F.h100e(l.monitorH100e)} H100e` }] : []),
        ]}>{use === 'safety' ? 'Safety research agents run on a share of the safety budget.' : 'Engineering, routine and frontier research agents share the capabilities agent pool; Auto splits that budget between experiments and agents.'}</TipCard>}>
          <div className="row-i"><HBar v={l.share} max={1} color={def.budget === 'saf' ? SPHERE.saf : SPHERE.cap} w={64} /><b className="num">{F.h100e(l.compute)}</b><span className={`dept-tag ${def.budget}`}>{budget}</span>{l.compute <= 0 && <span className="tag2" data-test={`lane-off.${use}`}>off</span>}</div>
        </Tip>
        <div className="row-i small dim"><Tip content={() => <TipCard title={<Term id="agentCopies">Copies × speed</Term>} rows={[{ label: 'Copies running', value: F.count(l.copies) }, { label: 'Speed of each', value: `${l.speed.toFixed(0)}× a human` }]}>How many agent instances run at once and how fast each thinks.</TipCard>}><span className="num">{F.count(l.copies)} copies × {l.speed.toFixed(0)}</span></Tip><span className="sp" />
          <span className="stepper mini">
            <ActBtn id="agents.set" testId={`agents.compute.down.${use}`} params={{ use, compute: shareNext(-STEP) }} icon={ICON.minus} label="" block={l.share <= 0 ? 'Already 0%' : undefined} />
            <ActBtn id="agents.set" testId={`agents.compute.up.${use}`} params={{ use, compute: shareNext(STEP) }} icon={ICON.plus} label="" block={l.share >= (use === 'safety' ? 0.6 : 1) - 1e-9 ? 'At the maximum' : undefined} />
          </span>
        </div>
      </div>
      <div className="ag-ai">
        {use === 'safety' ? <Trusted s={s} v={v} /> : (
          <Tip content={() => <TipCard title={<Term id={AI_TERM[use]}>AI share of the work</Term>} value={F.pct(l.aiShare)}>{use === 'eng' ? "1 − (1 − A)² on this model's coding automation A, × how much of the reference engineering compute it gets. Raises build capacity." : use === 'capRoutine' ? "The AI part of research labour (this model's coding automation and AI researchers per chip)." : "The share of human scientists this model's research taste exceeds. The frontier model sets research taste."}</TipCard>}>
            <div><div className="row-i"><HBar v={l.aiShare} max={1} color={C.good} w={120} /><b className="num" data-test={`ai-share.${use}`}>{F.pct(l.aiShare)}</b></div><div className="small dim">{aiSub}</div></div>
          </Tip>
        )}
      </div>
      <Tip content={() => <TipCard title={<Term id="runCost">Cost / yr</Term>} value={F.money(l.cost + l.monitorCost, { perYear: true })} rows={[{ label: 'Agents', value: F.money(l.cost, { perYear: true }) }, { label: 'Monitor', value: F.money(l.monitorCost, { perYear: true }) }]}>At the rental-equivalent price of an H100e.</TipCard>}>
        <span className="num ag-cost">{F.money(l.cost + l.monitorCost)}</span>
      </Tip>
      <RiskBadges lane={l} />
      {draft && (draft.versionId !== undefined || draft.monitorId !== undefined) && <EditPop s={s} use={use} c={draft} close={() => setDraft(null)} />}
    </div>
  );
}

export function AgentsAtWork({ s }: { s: GameStateV2 }) {
  const v = useMemo(() => agentsView(s), [s, s.time.day, JSON.stringify(s.player.agents), s.player.policies.trustedToAI, s.player.split.agents, s.player.split.safety]);
  const [drafts, setDrafts] = useState<Partial<Record<AgentUse, AgentChange>>>({});
  const setDraft = (u: AgentUse) => (c: AgentChange | null) => setDrafts((d) => { const n = { ...d }; if (c) n[u] = c; else delete n[u]; return n; });
  return (
    <Card id="ctl-agents" home="agents" className="agents-card"
      title={<span className="row-i"><ICON.agents size={15} /><Term id="agentPackage">Agents at work</Term></span>}
      sub={<>model + monitor + compute per use · <Tip content={() => <TipCard title="Agents at work" rows={[...AGENT_USES.map((u) => ({ label: AGENT_USE_DEF[u].name, value: `${F.h100e(v.lanes[u].compute)} H100e · ${F.money(v.lanes[u].cost + v.lanes[u].monitorCost, { perYear: true })}` }))]}>Compute and yearly cost of all internal agent packages.</TipCard>}><span><span className="num">{F.h100e(v.total)}</span> <Term id="h100e">H100e</Term> · <span className="num">{F.money(v.totalCost, { perYear: true })}</span></span></Tip></>}
      right={<span className="row-i small"><Ref id="researchMix" to={{ panel: 'compute', tab: 'split', anchor: 'split-experiments' }}>{s.player.researchManual ? 'Manual' : 'Auto'} split experiments ↔ agents</Ref><Ref id="rdmult" to={{ panel: 'company', tab: 'flow' }}>Research speed</Ref></span>}>
      <div className="ag-head small dim"><span>Use · automates</span><span>Model</span><span>Monitor · catch</span><span>Compute · budget</span><span>AI share of the work</span><span>Cost/yr</span><span><Term id="riskFamily">Risk</Term></span></div>
      {AGENT_USES.map((u) => <Lane key={u} s={s} v={v} use={u} draft={drafts[u]} setDraft={setDraft(u)} />)}
      <RiskLegend />
    </Card>
  );
}
