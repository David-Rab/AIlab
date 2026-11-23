// Company (IA.md L2): Flow · Agents & teams · Security. Flow is the HOME of compute online, idle chips, pools by use
// and research speed; Agents & teams of the internal agent packages (Agents at work, R7: model, monitor, compute, AI
// share of each role's work, Trusted to AI), headcount, hiring, payroll and morale; Security of WSL, siloing and
// counter-intel. The compute split moved to Compute › Split (R7). Money lives in Finance (referenced, never
// repeated). Two departments have staff: capabilities and safety.
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  WSL_TARGET_RANGE, engine, fillWeeks, fullTeamPayroll, idleChips, ownedOnline, payrollOf, poolsOf, queuedOfKey,
  rentedOnline, labSpeedLimits, labSpeedView, revenueReadout, securityFloorView, SPLIT_KEYS, SPLIT_LABEL, teamGain, teamPayroll, teamsOfKey, weeklyHireCap,
} from '../../../engine/v2';
import { PROJECT_BY_ID } from '../../../data/v2/tree';
import { COLUMN_LABEL, MOVE_SAFETY_MORALE, QUALITY, STAR_HIRE, TEAM_KEYS, TEAM_SIZE } from '../../../data/v2/teams';
import type { Column, ComputeSplit, GameStateV2, SpeedLimitLine, Team, TeamDept, TeamKey, TeamQuality, TeamRole } from '../../../engine/v2';
import { AgentsAtWork } from './Agents';
import { Work } from './Work';
import { store } from '../store';
import { ActBtn, Limit, Slider, Term, Tip, TipCard, Why } from '../ui';
import { Card, HBar, KV, PanelHead, Ref, tabOf, Tabs } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C, POOL_COLOR, SPHERE } from '../theme';

// Total over the engine's split keys: a new use is a type error here, not a crash in Flow.
type PoolKey = keyof ComputeSplit;
const POOL_TERM: Record<PoolKey, string | undefined> = {
  training: 'poolTraining', synthetic: 'poolSynthetic', experiments: 'poolExperiments', routine: 'poolAgents', frontier: 'poolAgents',
  engineering: 'engAgents', safetyAgents: 'safetyAgents', monitors: 'agentMonitor', safety: 'poolSafety', serving: 'poolServing', idle: undefined,
};
type Dept = 'cap' | 'serve' | 'saf';
/** Department each use feeds; idle feeds none (drawn as a pool with no band onward). */
const POOL_DEPT: Record<PoolKey, Dept | null> = {
  training: 'cap', synthetic: 'cap', experiments: 'cap', routine: 'cap', frontier: 'cap', engineering: 'cap',
  safetyAgents: 'saf', monitors: 'saf', safety: 'saf', serving: 'serve', idle: null,
};
const POOL_FILL: Record<PoolKey, string> = {
  training: POOL_COLOR.training, synthetic: POOL_COLOR.synthetic, experiments: POOL_COLOR.experiments, routine: POOL_COLOR.agents, frontier: POOL_COLOR.agents,
  engineering: POOL_COLOR.engineering, safetyAgents: POOL_COLOR.safety, monitors: POOL_COLOR.safety, safety: POOL_COLOR.safety, serving: POOL_COLOR.serving, idle: '#8a8f98',
};

// ───────── Flow: compute online → pools → departments → outputs ─────────
function Flow({ s }: { s: GameStateV2 }) {
  const [hover, setHover] = useState<string>();
  const pools = poolsOf(s);
  const online = Math.max(1, s.player.computeOnline);
  const idle = idleChips(s);
  const prod = engine.production(s, 'player');
  const rd = revenueReadout(s);
  const capped = rd.deps.filter((d) => d.bound === 'capacity').length;
  const u = engine.sightLimit(s);
  const W = 1200;
  const H = 470;
  const top = 40;
  const span = H - top - 30;
  const total = online + idle;
  const k = (span - 60) / total; // px per H100e
  const cx = [40, 380, 720, 980];
  const nodeW = 14;
  // column 0
  const onH = online * k;
  const idleY = top + onH + 24;
  // column 1 pools
  const keys = SPLIT_KEYS.filter((x) => pools[x] > 0);
  let y1 = top;
  const pos1: Record<string, { y: number; h: number }> = {};
  for (const x of keys) { const h = Math.max(2, pools[x] * k); pos1[x] = { y: y1, h }; y1 += h + 10; }
  // column 2 departments
  const depts: { id: Dept; label: string; color: string; v: number }[] = [
    { id: 'cap', label: 'Capabilities', color: SPHERE.cap, v: keys.filter((x) => POOL_DEPT[x] === 'cap').reduce((a, x) => a + pools[x], 0) },
    { id: 'serve', label: 'Serving', color: SPHERE.prod, v: keys.filter((x) => POOL_DEPT[x] === 'serve').reduce((a, x) => a + pools[x], 0) },
    { id: 'saf', label: 'Safety', color: SPHERE.saf, v: keys.filter((x) => POOL_DEPT[x] === 'saf').reduce((a, x) => a + pools[x], 0) },
  ];
  let y2 = top;
  const pos2: Record<string, { y: number; h: number; fill: number }> = {};
  for (const d of depts) { const h = Math.max(3, d.v * k); pos2[d.id] = { y: y2, h, fill: 0 }; y2 += h + 34; }
  const band = (xa: number, ya: number, xb: number, yb: number, h: number, col: string, id: string, op = 0.45) => {
    const m = (xa + xb) / 2;
    const dim = hover && hover !== id && !id.includes(hover) ? 0.12 : op;
    return <path key={id} d={`M${xa},${ya} C${m},${ya} ${m},${yb} ${xb},${yb} L${xb},${yb + h} C${m},${yb + h} ${m},${ya + h} ${xa},${ya + h} Z`} fill={col} opacity={dim} />;
  };
  let y0 = top;
  const bands0 = keys.map((x) => { const b = band(cx[0] + nodeW, y0, cx[1], pos1[x].y, Math.max(1, pools[x] * k), POOL_FILL[x], `on>${x}`); y0 += pools[x] * k; return b; });
  const bands1 = keys.map((x) => { const d = POOL_DEPT[x]; if (!d) return null; const p2 = pos2[d]; const h = Math.max(1, pools[x] * k); const b = band(cx[1] + nodeW, pos1[x].y, cx[2], p2.y + p2.fill, h, POOL_FILL[x], `${x}>${d}`); p2.fill += h; return b; });
  const out: Record<string, { label: string; tag?: { t: string; tone: string }; ref: string; to: { panel: string; tab?: string } }> = {
    cap: { label: 'Research speed', tag: { t: prod.label.replace('labor', 'labour'), tone: 'warn' }, ref: 'M', to: { panel: 'company' } },
    serve: { label: 'Revenue', tag: capped ? { t: `${capped} capped`, tone: 'bad' } : undefined, ref: 'revenueRun', to: { panel: 'finance' } },
    saf: { label: 'Sight limit', tag: { t: F.sight(u), tone: u.gap < 0 ? 'bad' : 'good' }, ref: 'sightLimit', to: { panel: 'safety', tab: 'overview' } },
  };
  return (
    <div className="flow-wrap" data-home="computeFlow">
      <svg viewBox={`0 0 ${W} ${Math.max(H, y2 - 20)}`} className="flow-svg" onMouseLeave={() => setHover(undefined)}>
        <text x={cx[0]} y={18} className="flow-cap">COMPUTE · H100e</text>
        <text x={cx[1]} y={18} className="flow-cap">POOLS (your split)</text>
        <text x={cx[2]} y={18} className="flow-cap">DEPARTMENTS</text>
        <text x={cx[3] + 20} y={18} className="flow-cap">OUTPUTS</text>
        {bands0}{bands1}
        {idle > 0 && <path d={`M${cx[0] + nodeW},${idleY} L${cx[0] + 110},${idleY} L${cx[0] + 110},${idleY + idle * k} L${cx[0] + nodeW},${idleY + idle * k} Z`} fill={C.bad} opacity={0.35} />}
        <Tip as="g" content={() => <TipCard title={<Term id="computeOnline">Compute online</Term>} value={`${F.count(online)} H100e`} rows={[{ label: 'Owned', value: F.count(ownedOnline(s)) }, { label: <Term id="cloudContract">Rented</Term>, value: F.count(rentedOnline(s)) }]}>Powered chips on your sites plus cloud capacity.</TipCard>}>
          <g data-home="computeOnline"><rect x={cx[0]} y={top} width={nodeW} height={onH} rx={3} fill="#c9d4e2" /><text x={cx[0] + nodeW + 6} y={top + 14} className="flow-lbl">Compute online</text><text x={cx[0] + nodeW + 6} y={top + 29} className="flow-sub">{F.count(online)} H100e</text></g>
        </Tip>
        {idle > 0 && (
          <Tip as="g" content={() => <TipCard title={<Term id="idleChips">Idle chips</Term>}>Delivered chips with no rack space. Details on Compute.</TipCard>}>
            <g onClick={() => store.goto('compute', { tab: 'overview' })} className="flow-click"><rect x={cx[0]} y={idleY} width={nodeW} height={Math.max(3, idle * k)} rx={3} fill={C.bad} /><text x={cx[0] + 120} y={idleY + 12} className="flow-lbl bad">Idle · racks full</text><text x={cx[0] + 120} y={idleY + 27} className="flow-sub">Compute ›</text></g>
          </Tip>
        )}
        {keys.map((x) => (
          <Tip as="g" key={x} content={() => <TipCard title={POOL_TERM[x] ? <Term id={POOL_TERM[x] as string}>{SPLIT_LABEL[x]}</Term> : SPLIT_LABEL[x]} value={`${F.count(pools[x])} H100e`}>Set by your compute split. Click to change it.</TipCard>}>
            <g onMouseEnter={() => setHover(x)} onClick={() => store.goto('compute', { tab: 'split', anchor: `split-${x}` })} className="flow-click" data-pool={x}>
              <rect x={cx[1]} y={pos1[x].y} width={nodeW} height={pos1[x].h} rx={3} fill={POOL_FILL[x]} />
              <text x={cx[1] + nodeW + 6} y={pos1[x].y + Math.min(pos1[x].h, 14) - 2 + 4} className="flow-lbl">{SPLIT_LABEL[x]} <tspan className="flow-sub">{F.count(pools[x])}</tspan></text>
            </g>
          </Tip>
        ))}
        {depts.map((d) => {
          const p2 = pos2[d.id];
          const o = out[d.id];
          return (
            <g key={d.id} onMouseEnter={() => setHover(d.id)}>
              <rect x={cx[2]} y={p2.y} width={nodeW} height={p2.h} rx={3} fill={d.color} />
              <text x={cx[2] + nodeW + 8} y={p2.y + 13} className="flow-lbl">{d.label}</text>
              <text x={cx[2] + nodeW + 8} y={p2.y + 28} className="flow-sub">{F.count(d.v)} H100e{d.id !== 'serve' ? ` · ${F.count(s.player.staff[d.id])} staff` : ''}</text>
              <path d={`M${cx[2] + 150},${p2.y + 10} L${cx[3] + 10},${p2.y + 10}`} stroke={d.color} strokeWidth={2} strokeDasharray="4 3" opacity={0.6} />
              <g className="flow-click" data-ref={o.ref} onClick={() => store.goto(o.to.panel, o.to)}><text x={cx[3] + 20} y={p2.y + 14} className="flow-lbl flow-out">{o.label} ›</text></g>
              {o.tag && <text x={cx[3] + 20} y={p2.y + 30} className={`flow-tag ${o.tag.tone}`}>{o.tag.t}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const SPEED_LIMIT_LABEL: Record<SpeedLimitLine['id'], ReactNode> = {
  'speed.pause': 'Pause',
  'speed.diffusion': <Term id="diffusion">Knowledge diffusion</Term>,
};
/** The limits on research speed (R11, LIMITS "Research speed"): one quiet line each, red / amber when binding. */
function SpeedLimits({ s }: { s: GameStateV2 }) {
  const lines = labSpeedLimits(s);
  return (
    <div className="rs-limits" data-test="speed-limits">
      <div className="tip-cap" style={{ marginTop: 10 }}>Limits</div>
      {lines.map((l) => (
        <div className="rs-lim" key={l.id}>
          <span className="dim">{SPEED_LIMIT_LABEL[l.id]}</span>
          <Limit id={l.id} tone={l.binding ? (l.mult < 1 ? 'bind' : 'warn') : 'quiet'}>{l.text}</Limit>
        </div>
      ))}
    </div>
  );
}

const BOUND_TERM: Record<string, string> = { 'compute-bound': 'computeBound', 'labor-bound': 'laborBound', 'human-bound': 'humanBound', 'taste-bound': 'tasteBound' };
const BOUND_LABEL: Record<string, string> = { 'compute-bound': 'compute-bound', 'labor-bound': 'labour-bound', 'human-bound': 'human-bound', 'taste-bound': 'taste-bound' };

/** Research speed (HOME of research speed; model v3 V2b): speed vs the leader lab's day 0, the AI labour multipliers the
 *  research engine ran at (RD-R01: no aggregate M or per-dollar levers), a unit project's compute c and labour ℓ (what
 *  binds), the limits. */
function ResearchSpeed({ s }: { s: GameStateV2 }) {
  const p = engine.production(s, 'player');
  const v = labSpeedView(s);
  const cl = Math.max(v.c, v.l, 1);
  const w = (x: number) => `${Math.min(100, (Math.log10(1 + x) / Math.log10(1 + cl * 1.2)) * 100)}%`;
  return (
    <Card title={<Term id="labSpeed">Research speed</Term>} right={<span className="tag2 warn" data-test="speed-bound"><Term id={BOUND_TERM[p.label]}>{BOUND_LABEL[p.label]}</Term></span>} home="M">
      <div className="rs-chain">
        <Tip content={() => <TipCard title={<Term id="labSpeed">Research speed</Term>} value={`×${F.short(v.rel)}`} rows={[
          { label: <Term id="expCompute">Unit project compute c</Term>, value: `×${F.short(v.c)}` }, { label: <Term id="expLabour">Unit project labour ℓ</Term>, value: `×${F.short(v.l)}` },
          { label: 'Experiment throughput X', value: `×${F.short(v.X)}` },
        ]}>Your research throughput relative to the leader lab's on its first day (= 1): every project's experiments at its compute and labour, × taste.</TipCard>}>
          <span className="sp-node hero" data-test="speed-rel"><b className="num">×{F.short(v.rel)}</b><span>vs leader day 0</span></span>
        </Tip>
        <Tip content={() => <TipCard title={<Term id="effectiveLabour">AI labour</Term>} value={F.mult(v.mExp)} rows={[
          { label: <Term id="effectiveLabour">In experiments</Term>, value: F.mult(v.mExp) },
          { label: <Term id="effectiveLabour">On research ideas</Term>, value: F.mult(v.mIdeas) },
          ...(Math.abs(v.mods - 1) > 1e-3 ? [{ label: 'Siloing, migrations', value: F.mult(v.mods) }] : []),
        ]}>Effective labour ÷ the people's own, as your projects ran yesterday.</TipCard>}>
          <span className="sp-node"><b className="num">{F.mult(v.mExp)}</b><span><Term id="effectiveLabour">AI labour</Term></span></span>
        </Tip>
      </div>
      <div className="tip-cap" style={{ marginTop: 10 }}><Term id="bottleneck">Unit project inputs</Term></div>
      <div className="rp-bars">
        <span><Term id="expCompute">Compute c</Term></span><span className="hb"><i style={{ width: w(v.c), background: 'var(--warn)' }} /></span>
        <Tip content={() => <TipCard title={<Term id="expCompute">Experiment compute c</Term>} value={`×${F.short(v.c)}`} rows={[{ label: 'Research compute', value: `${F.count(v.researchH100e)} H100e` }, { label: 'On experiments', value: F.pct(v.expShare) }]}>Per two research-engineer teams, leader day 0 = 1.</TipCard>}><span className="num">×{F.short(v.c)}</span></Tip>
        <span><Term id="expLabour">Labour ℓ</Term></span><span className="hb"><i style={{ width: w(v.l), background: '#5aa9ff' }} /></span>
        <Tip content={() => <TipCard title={<Term id="expLabour">Experiment labour ℓ</Term>} value={`×${F.short(v.l)}`}>Research engineers with the agents' help, to the power λ.</TipCard>}><span className="num">×{F.short(v.l)}</span></Tip>
      </div>
      <Tip content={() => <TipCard title={<Term id="autoSplit">Research compute mix</Term>} value={`${F.pct(v.expShare)} experiments`} rows={[{ label: 'Research compute', value: `${F.count(v.researchH100e)} H100e` }]}>Set by you on Compute › Split.</TipCard>}>
        <div className="small dim" data-test="speed-mix">Mix: <b className="num">{F.pct(v.expShare)}</b> of research compute on experiments</div>
      </Tip>
      <SpeedLimits s={s} />
      <div className="row-i small" style={{ marginTop: 8 }}><Ref id="softwareRate" to={{ panel: 'research', tab: 'recipe' }}>Software progress</Ref><Ref id="work" to={{ panel: 'company', tab: 'work' }}>AI labour by work type</Ref></div>
    </Card>
  );
}

// ───────── People: teams by role, hiring (STRUCTURE §4.1; mockups-v3 v3-company without the agent lanes) ─────────
const ROLE_ICON: Record<TeamRole, typeof ICON.L> = { eng: ICON.roleEng, re: ICON.roleRE, sci: ICON.roleSci };
const ROLE_TERM: Record<TeamRole, string> = { eng: 'roleEng', re: 'roleRE', sci: 'roleSci' };
const COL_ICON: Record<Column, typeof ICON.L> = { pretraining: ICON.colPretraining, posttraining: ICON.colPosttraining, systems: ICON.colSystems, alignment: ICON.colAlignment, interp: ICON.colInterp, evals: ICON.colEvals };
const Q_N: Record<TeamQuality, number> = { solid: 1, strong: 2, elite: 3 };
const KEY_SHORT: Record<TeamKey, string> = { eng: 'Engineering', 're.cap': 'Research eng.', 'sci.cap': 'Science', 're.saf': 'Research eng.', 'sci.saf': 'Science' };
const keyIcon = (k: TeamKey) => ROLE_ICON[k === 'eng' ? 'eng' : (k.split('.')[0] as TeamRole)];
const teamIcon = (t: Pick<Team, 'role' | 'specialty'>) => (t.role === 'sci' && t.specialty ? COL_ICON[t.specialty] : ROLE_ICON[t.role]);
const teamTitle = (t: Pick<Team, 'role' | 'dept' | 'specialty'>) => (t.role === 'sci' ? `Science · ${t.specialty ? COLUMN_LABEL[t.specialty] : ''}` : t.role === 'eng' ? 'Engineering' : `Research eng. · ${t.dept === 'saf' ? 'safety' : 'capabilities'}`);

/** Quality as 1–3 filled dots (Solid / Strong / Elite). */
function QDots({ q }: { q: TeamQuality }) {
  return (
    <Tip content={() => <TipCard title={<Term id="teamQuality">{QUALITY[q].label}</Term>}>Output ×{QUALITY[q].out} · cost ×{QUALITY[q].cost}</TipCard>}>
      <span className={`qdots q-${q}`} data-q={q}>{[1, 2, 3].map((i) => <i key={i} className={i <= Q_N[q] ? 'on' : ''} />)}</span>
    </Tip>
  );
}

/** What a team adds once full, as one short chip in its department's currency (RD-B18: today's mechanisms run for one
 *  day on a copy with the team): build capacity, the capability project it speeds most, safety results per year. */
function GainChip({ s, t }: { s: GameStateV2; t: Pick<Team, 'role' | 'dept' | 'quality' | 'specialty'> }) {
  const g = teamGain(s, t);
  const text = g.currency === 'staffTime' ? `+${F.num(g.amount, 1)} build`
    : g.currency === 'alignment' ? `${F.num(g.amount, 2, true)} results/yr`
    : g.unit === 'days' ? (g.amount === 0 ? 'no project faster today' : `${F.num(g.amount, 0, true)} d`)
    : `${F.num(g.amount, 2, true)} tuning`;
  const body = g.currency === 'staffTime' ? 'Build capacity, engineering team-weeks per week, with the engineers\' AI tools: what one day of the build system gives with the team.'
    : g.currency === 'alignment' ? 'Safety research results per year across the lines, after one research day with the team (safety research engineers go to experiments; a science team joins the safety projects on the priority list, or waits idle if there are none).'
    : t.role === 'sci' ? 'Days sooner for the capability project this team speeds most, after one research day with it: the priority assignment places it (×1.5 on a project in its specialty; its quality sets its taste).'
    : 'Days sooner for the capability project these research engineers speed most, after one research day with them; when no project needs more, they go to routine tuning (team-equivalents).';
  return <Tip content={() => <TipCard title="If hired, once full" value={g.target}>{body}</TipCard>}><span className={`pill2 ${g.amount < 0 ? 'cost' : 'gain'}`} data-test="team-gain">{text}</span></Tip>;
}

function Teams({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const people = p.teams.reduce((a, t) => a + t.heads, 0);
  const pay = payrollOf(p);
  const byKey = (k: TeamKey) => teamsOfKey(p, k);
  const role = (r: TeamRole) => p.teams.filter((t) => t.role === r);
  const heads = (ts: Team[]) => ts.reduce((a, t) => a + t.heads, 0);
  const vacant = (ts: Team[]) => ts.reduce((a, t) => a + t.size - t.heads, 0);
  const RoleHead = ({ r, right }: { r: TeamRole; right?: ReactNode }) => {
    const Ic = ROLE_ICON[r];
    return (
      <div className="role-hd" data-role={r}>
        <Ic size={15} /><Term id={ROLE_TERM[r]}>{r === 'eng' ? 'Engineers' : r === 're' ? 'Research eng.' : 'Scientists'}</Term>
        <Tip content={() => <TipCard title={<Term id={ROLE_TERM[r]}>{r === 'eng' ? 'Engineers' : r === 're' ? 'Research engineers' : 'Scientists'}</Term>} rows={[{ label: 'Teams', value: String(role(r).length) }, { label: 'People', value: F.count(heads(role(r))) }, { label: 'Seats open', value: F.count(vacant(role(r))) }, { label: <Term id="payroll">Payroll</Term>, value: F.money(role(r).reduce((a, t) => a + teamPayroll(t), 0), { perYear: true }) }]} />}>
          <span className="row-i"><b className="num">{role(r).length}</b><span className="dim num">· {F.count(heads(role(r)))}</span></span>
        </Tip>
        <span className="sp" />{right}
      </div>
    );
  };
  const Pile = ({ k, label, sub, actions }: { k: TeamKey; label: ReactNode; sub?: ReactNode; actions?: ReactNode }) => {
    const ts = byKey(k);
    const v = vacant(ts);
    return (
      <div className={`team-pile ${ts.length > 1 ? 'stacked' : ''}`} data-pile={k}>
        <div className="pile-top"><Tip content={() => <TipCard title={label} rows={[{ label: 'Teams', value: String(ts.length) }, { label: 'People', value: F.count(heads(ts)) }, { label: 'Seats open', value: F.count(v) }]} />}><b className="num">×{ts.length}</b></Tip><span>{label}</span><span className="sp" />{ts.map((t) => <QDots key={t.id} q={t.quality} />).slice(0, 6)}</div>
        <div className="pile-sub small">{sub}{v >= 1 && <Tip content={() => <TipCard title="Seats open" value={F.count(v)}>People still to hire into these teams; keep-hiring fills them at the weekly cap.</TipCard>}><span className="tone-warn"> · {F.count(v)} seats open</span></Tip>}<span className="sp" />{actions}</div>
      </div>
    );
  };
  const newest = (k: TeamKey) => byKey(k)[byKey(k).length - 1];
  const releaseBtn = (t: Team | undefined, label = 'Let go') => t && <ActBtn id="teams.release" params={{ team: t.id }} icon={ICON.release} label={label} />;
  const moveBtn = (t: Team | undefined) => t && <ActBtn id="teams.move" params={{ team: t.id }} icon={ICON.move} label="Move" />;
  const sci = (dept: TeamDept) => p.teams.filter((t) => t.role === 'sci' && t.dept === dept);
  const payTip = () => (
    <TipCard title={<Term id="payroll">Payroll</Term>} value={F.money(pay, { perYear: true })} rows={(['eng', 're', 'sci'] as const).map((r) => ({ label: r === 'eng' ? 'Engineers' : r === 're' ? 'Research engineers' : 'Scientists', value: F.money(p.teams.filter((t) => t.role === r).reduce((a, t) => a + teamPayroll(t), 0), { perYear: true }) })).concat([{ label: 'Queued teams', value: F.money(p.hiring.filling.reduce((a, t) => a + teamPayroll(t), 0), { perYear: true }) }])}>Paid monthly from cash.</TipCard>
  );
  return (
    <Card title={<span className="row-i"><ICON.staff size={15} /><Term id="team">Teams</Term></span>} sub={<Tip content={payTip}><span>{p.teams.length} teams · {F.count(people)} people</span></Tip>} home="teams" className="teams-card"
      right={(
        <span className="row-i chips">
          <Tip content={payTip}><span className="chip2" data-home="payroll"><Term id="payroll">Payroll</Term> <b className="num">{F.money(pay, { perYear: true })}</b></span></Tip>
          <span className="chip2" data-home="morale"><Why k="morale" title="Morale" body="See [[morale]]."><ICON.morale size={13} /> Morale <b className="num">{F.idx(p.morale.overall)}</b></Why></span>
          <span className="chip2" data-home="moraleSafety"><Why k="morale.safety" title="Safety staff morale"><ICON.safety size={13} /> Safety morale <b className="num">{F.idx(p.morale.safety)}</b></Why></span>
        </span>
      )}>
      <div className="teams-body">
        <div className="teams-col">
          <RoleHead r="eng" />
          <Pile k="eng" label="shared pool"
            sub={<Ref id="buildCapacity" to={{ panel: 'company', tab: 'work' }}><ICON.build size={11} /> build capacity · Work</Ref>}
            actions={releaseBtn(newest('eng'))} />
          <RoleHead r="re" />
          <Pile k="re.cap" label="Capabilities"
            sub={<Ref id="reNeeds" to={{ panel: 'company', tab: 'work' }}>experiments · tuning · run ops · Work</Ref>}
            actions={<>{moveBtn(newest('re.cap'))}{releaseBtn(newest('re.cap'))}</>} />
          <Pile k="re.saf" label="Safety" sub={<span>tools · investigations</span>} actions={<>{moveBtn(newest('re.saf'))}{releaseBtn(newest('re.saf'))}</>} />
        </div>
        <div className="teams-col wide">
          <RoleHead r="sci" right={(
            <span className="row-i small">
              <Tip content={() => <TipCard title={<Term id="researchTaste">Research taste</Term>} value={`×${p.tasteHire.toFixed(2)}`} rows={[{ label: 'Stars', value: String(p.stars) }, { label: 'Per star', value: `+${F.num(STAR_HIRE.dTaste, 2)} each, up to ×${F.num(STAR_HIRE.maxTaste, 1)}` }]}>Star hires multiply the human taste of every capabilities science team. Each team's taste (its quality, the stars and AI): Research › Projects; AI taste: Company › Work.</TipCard>}>
                <span><ICON.taste size={12} /> star taste <b className="num">×{p.tasteHire.toFixed(2)}</b></span>
              </Tip>
              <ActBtn id="starHire" icon={ICON.hiring} label="Star" />
            </span>
          )} />
          {(['cap', 'saf'] as const).map((d) => (
            <div key={d}>
              <Tip as="div" content={() => <TipCard title={`${d === 'cap' ? 'Capabilities' : 'Safety'} scientists`} rows={[{ label: 'Teams', value: String(sci(d).length) }, { label: 'On a project', value: String(sci(d).filter((t) => t.projectId).length) }, { label: 'Idle', value: String(sci(d).filter((t) => !t.projectId).length) }]} />}><div className="sec-cap" style={{ color: d === 'cap' ? SPHERE.cap : SPHERE.saf }}>{d === 'cap' ? 'Capabilities' : 'Safety'} · {sci(d).length}</div></Tip>
              <div className="sci-grid">
                {sci(d).map((t) => {
                  const Ic = teamIcon(t);
                  return (
                    <div key={t.id} className={`sci-card ${d}`} data-team={t.id}>
                      <div className="row-i"><Ic size={13} /><b>{t.specialty ? COLUMN_LABEL[t.specialty] : 'Science'}</b><span className="sp" /><QDots q={t.quality} /></div>
                      <div className="row-i small dim"><Tip content={() => <TipCard title={teamTitle(t)} rows={[{ label: 'People', value: `${F.count(t.heads)} of ${t.size}` }, { label: 'Project', value: t.projectId ? (PROJECT_BY_ID[t.projectId]?.name ?? t.projectId) : 'none (idle)' }]}>Click Research to change its project.</TipCard>}><span>{t.heads < t.size - 0.5 ? `${F.count(t.heads)}/${t.size} people` : `${t.size} people`}</span></Tip><span className="sp" />{releaseBtn(t, '')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="teams-foot small dim"><ICON.move size={12} /> <Term id="moveTeam">Safety → capabilities move</Term>: safety morale {MOVE_SAFETY_MORALE}</div>
    </Card>
  );
}

function Hiring({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const h = p.hiring;
  const nextOffer = 7 - (s.time.day % 7);
  return (
    <Card title={<span className="row-i"><ICON.hiring size={15} />Hiring</span>} home="hiring" className="hiring-card"
      right={<span className="small" data-home="talentPull"><Why k="relations.talentPull" title="Talent pull"><Term id="talentPull">Talent pull</Term> <b className="num">{F.num(s.relations.talentPull, 0, true)}</b></Why></span>}>
      <div className="sec-cap"><Term id="keepHiring">Keep hiring to</Term></div>
      {TEAM_KEYS.map((k) => {
        const Ic = keyIcon(k);
        const n = h.targets[k] ?? 0;
        const have = teamsOfKey(p, k).length;
        const q = queuedOfKey(p, k).length;
        return (
          <div key={k} className="hire-row" data-key={k}>
            <Ic size={13} /><span>{KEY_SHORT[k]}{k !== 'eng' && <span className={`dept-tag ${k.endsWith('saf') ? 'saf' : 'cap'}`}>{k.endsWith('saf') ? 'SAF' : 'CAP'}</span>}</span>
            <span className="sp" />
            {(have + q !== n || q > 0) && <Tip content={() => <TipCard title={KEY_SHORT[k]} rows={[{ label: 'Teams now', value: String(have) }, { label: 'Filling', value: String(q) }, { label: 'Target', value: String(n) }]}>Keep-hiring opens a team whenever you have fewer than the target.</TipCard>}><span className="small dim num">{have} now{q ? ` · ${q} filling` : ''}</span></Tip>}
            <span className="stepper">
              <ActBtn id="teams.target" testId={`teams.target.down.${k}`} params={{ key: k, n: Math.max(0, n - 1) }} icon={ICON.minus} label="" block={n <= 0 ? 'Already 0' : undefined} />
              <Tip content={() => <TipCard title={<Term id="keepHiring">Target</Term>} value={`${n} teams`}>Teams of this kind keep-hiring keeps you at.</TipCard>}><b className="num" data-test={`target-${k}`}>{n}</b></Tip>
              <ActBtn id="teams.target" testId={`teams.target.up.${k}`} params={{ key: k, n: n + 1 }} icon={ICON.plus} label="" />
            </span>
          </div>
        );
      })}
      {h.filling.length > 0 && (
        <>
          <div className="sec-cap"><Term id="hiringQueue">Filling</Term> <Tip content={() => <TipCard title={<Term id="weeklyHireCap">Hiring per week</Term>} rows={[{ label: 'Capabilities', value: `${F.count(weeklyHireCap(s, 'cap'))} a week` }, { label: 'Safety', value: `${F.count(weeklyHireCap(s, 'saf'))} a week` }]} />}><span className="dim">· {F.count(weeklyHireCap(s, 'cap'))}/wk cap · {F.count(weeklyHireCap(s, 'saf'))}/wk safety</span></Tip></div>
          {h.filling.map((t) => {
            const Ic = teamIcon(t);
            const wk = fillWeeks(s, t);
            return (
              <div key={t.id} className="fill-row" data-filling={t.id}>
                <Ic size={13} /><span className="ellip">{teamTitle(t)}</span><QDots q={t.quality} />
                <HBar v={t.heads} max={t.size} color={t.dept === 'saf' ? SPHERE.saf : SPHERE.cap} w={70} />
                <Tip content={() => <TipCard title="Filling" rows={[{ label: 'People', value: `${F.count(t.heads)} of ${t.size}` }, { label: 'Full in', value: Number.isFinite(wk) ? `${wk} weeks` : 'stalled' }]}>At today's hiring pace.</TipCard>}><span className="small dim num">{Number.isFinite(wk) ? `${wk} wk` : 'stalled'}</span></Tip>
                <ActBtn id="teams.release" testId="teams.cancel" params={{ team: t.id }} icon={ICON.release} label="" />
              </div>
            );
          })}
        </>
      )}
      <div className="sec-cap row-i"><Term id="teamOffer">Offers</Term><span className="sp" /><Tip content={() => <TipCard title="Next offers" value={`in ${nextOffer} d`}>New candidate teams arrive every week.</TipCard>}><span className="dim">next in {nextOffer} d</span></Tip></div>
      {h.candidates.length === 0 && <div className="small dim">No offers this week.</div>}
      {h.candidates.map((c) => {
        const Ic = teamIcon(c);
        const wk = fillWeeks(s, { ...c, size: TEAM_SIZE[c.role], heads: 0 });
        return (
          <div key={c.id} className="offer" data-offer={c.id}>
            <span className={`offer-ic ${c.dept}`}><Ic size={16} /></span>
            <div className="offer-main">
              <div className="row-i"><b>{teamTitle(c)}</b><QDots q={c.quality} /></div>
              <div className="row-i small">
                <Tip content={() => <TipCard title={<Term id="payroll">Payroll</Term>} value={F.money(fullTeamPayroll(c.role, c.dept, c.quality), { perYear: true })}>The team's yearly cost once it is full.</TipCard>}><span className="num">{F.money(fullTeamPayroll(c.role, c.dept, c.quality), { perYear: true })}</span></Tip>
                <Tip content={() => <TipCard title="Ramp-up" value={Number.isFinite(wk) ? `${wk} weeks` : 'stalled'}>Weeks until the team is full, at today's hiring pace (talent pull and the hiring lane).</TipCard>}><span className="dim">· fills in {Number.isFinite(wk) ? `${wk} wk` : '— (stalled)'}</span></Tip>
                <Tip content={() => <TipCard title="Offer expires" value={`in ${c.until - s.time.day} d`}>Hire before then or the candidate team takes another offer.</TipCard>}><span className="dim">· offer ends in {c.until - s.time.day} d</span></Tip>
                <GainChip s={s} t={c} />
              </div>
            </div>
            <ActBtn id="teams.hire" params={{ candidate: c.id }} icon={ICON.hiring} label="Hire" primary />
          </div>
        );
      })}
    </Card>
  );
}

function People({ s }: { s: GameStateV2 }) {
  return (
    <>
      <AgentsAtWork s={s} />
      <div className="people-grid">
        <Teams s={s} />
        <div className="col2">
          <Hiring s={s} />
        </div>
      </div>
    </>
  );
}

// ───────── Security ─────────
function Security({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const [wslLo, wslHi] = WSL_TARGET_RANGE;
  const [wsl, setWsl] = useState(Math.max(wslLo, Math.min(wslHi, Math.round((p.security.target + 0.5) * 2) / 2)));
  return (
    <div className="g2">
      <Card title={<Term id="wsl">Weight security</Term>} home="wsl" right={<Tip content={() => <TipCard title={<Term id="wsl">Weight security level</Term>} value={p.security.wsl.toFixed(1)} rows={[{ label: 'Target', value: p.security.target.toFixed(1) }, { label: 'Spend', value: F.money(p.security.spendRate, { perYear: true }) }]}>RAND security levels 1–5: how hard your weights are to steal.</TipCard>}><span className="num big">{p.security.wsl.toFixed(1)}</span></Tip>}>
        <KV k="Level now → target" term="wslTarget"><HBar v={p.security.wsl} max={5} color={SPHERE.sec} w={140} mark={p.security.target} /> {p.security.wsl.toFixed(1)} → {p.security.target.toFixed(1)}</KV>
        {(() => { const fl = securityFloorView(s); return <KV k="Floor" term="wsl"><Limit id="security.floor" tone={fl.binding ? 'warn' : 'quiet'}>WSL {fl.now.toFixed(1)} now · {fl.max.toFixed(1)} from 2027</Limit></KV>; })()}
        <div className="kv"><Tip content={() => <TipCard title="New target" value={wsl.toFixed(1)} rows={[{ label: 'Range', value: `${wslLo}–${wslHi}` }]}>Drag, then Set: spend rises with the level.</TipCard>}><span className="kv-k">New target {wsl.toFixed(1)}</span></Tip><span className="row-i"><Slider value={wsl} min={wslLo} max={wslHi} step={0.5} onChange={setWsl} /><ActBtn id="SEC_TARGET" params={{ level: wsl }} label="Set" reason /></span></div>
        <KV k="Security spend" term="opex">{F.money(p.security.spendRate, { perYear: true })}</KV>
        <KV k="Privileged staff" term="privileged">{F.count(p.security.privileged)}</KV>
        <div className="small dim" style={{ marginTop: 6 }}>Theft risk: <Ref id="risk.theft" to={{ panel: 'risk' }}>Risk › theft</Ref></div>
      </Card>
      <Card title="Controls">
        <KV k={`Siloing ${p.security.siloing}`} term="siloing"><span className="row-i"><ActBtn id="SEC_SILO" params={{ level: Math.min(2, p.security.siloing + 1) }} label="Silo +1" /><ActBtn id="SEC_SILO" testId="SEC_SILO.down" params={{ level: Math.max(0, p.security.siloing - 1) }} label="Silo −1" /></span></KV>
        <KV k={`Counter-intel ${F.pct(p.security.counterIntel)}`} term="counterIntel"><ActBtn id="SEC_CI" /></KV>
        {/* Jank PR6: KYC has one home, the product card; Security links there. */}
        <KV k="KYC" term="kyc"><Ref id="kyc" to={{ panel: 'products' }}>set per product on Products</Ref></KV>
      </Card>
    </div>
  );
}

export function Company({ s }: { s: GameStateV2 }) {
  const tab = tabOf('company', 'flow');
  return (
    <div className="panel-v2 company" data-panel="company">
      <PanelHead icon={ICON.company} title="Company" sub="where compute goes and what it produces" tabs={<Tabs panel="company" def="flow" tabs={[{ id: 'flow', label: 'Flow', icon: ICON.company }, { id: 'people', label: 'Agents & teams', icon: ICON.staff }, { id: 'work', label: 'Work', icon: ICON.build }, { id: 'security', label: 'Security', icon: ICON.security }]} />} />
      {tab === 'flow' && (
        <div className="company-flow">
          <Card title="Where your compute goes" sub="widths are live · hover to trace · click a pool to change the split"><Flow s={s} /></Card>
          <ResearchSpeed s={s} />
        </div>
      )}
      {tab === 'people' && <People s={s} />}
      {tab === 'work' && <Work s={s} />}
      {tab === 'security' && <Security s={s} />}
    </div>
  );
}
