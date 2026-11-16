// Company (IA.md L2): Flow · People · Split · Security. Flow is the HOME of compute online, idle chips, pools by use
// and research speed; People of headcount, hiring, payroll, morale and AI labour; Split of the compute split % and the
// research trade-off charts; Security of WSL, siloing and counter-intel. Money lives in Finance (referenced, never
// repeated). Two departments have staff: capabilities and safety.
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  MANUAL_MIX_RANGE, WSL_TARGET_RANGE, aiShareByRole, buildCapacity, engine, fillWeeks, fullTeamPayroll, idleChips, ownedOnline, payrollOf, poolsOf, queuedOfKey,
  rentedOnline, revenueReadout, specOf, SPLIT_KEYS, SPLIT_PRESETS, teamGain, teamPayroll, teamsOfKey, TOP_KEYS, weeklyHireCap,
} from '../../../engine/v2';
import { COLUMN_LABEL, MOVE_SAFETY_MORALE, QUALITY, TEAM_KEYS, TEAM_SIZE } from '../../../data/v2/teams';
import type { Column, GameStateV2, SplitSpec, Team, TeamDept, TeamKey, TeamQuality, TeamRole, TopKey } from '../../../engine/v2';
import { MixChart, ResponseCharts } from './ResearchCharts';
import { store } from '../store';
import { ActBtn, pct as pct0, Seg, Slider, Term, Tip, TipCard, Why } from '../ui';
import { Card, GoBtn, HBar, KV, PanelHead, Ref, tabOf, Tabs } from '../kit';
import * as F from '../fmt';
import { ICON } from '../icons';
import { C, POOL_COLOR, SPHERE } from '../theme';

const POOL_TERM: Record<string, string> = { training: 'poolTraining', experiments: 'poolExperiments', agents: 'poolAgents', synthetic: 'poolSynthetic', serving: 'poolServing', safety: 'poolSafety' };
type Dept = 'cap' | 'serve' | 'saf';
const POOL_DEPT: Record<string, Dept> = { training: 'cap', experiments: 'cap', agents: 'cap', synthetic: 'cap', serving: 'serve', safety: 'saf' };
const POOL_LABEL: Record<string, string> = { training: 'Training runs', experiments: 'Experiments', agents: 'Agents', synthetic: 'Data generation', serving: 'Serving', safety: 'Safety' };
const TOP_TERM: Record<TopKey, string> = { training: 'poolTraining', research: 'poolResearch', serving: 'poolServing', safety: 'poolSafety' };
const TOP_COLOR: Record<TopKey, string> = { training: POOL_COLOR.training, research: POOL_COLOR.experiments, serving: POOL_COLOR.serving, safety: POOL_COLOR.safety };

// ───────── Flow: compute online → pools → departments → outputs ─────────
function Flow({ s }: { s: GameStateV2 }) {
  const [hover, setHover] = useState<string>();
  const pools = poolsOf(s);
  const online = Math.max(1, s.player.computeOnline);
  const idle = idleChips(s);
  const prod = engine.production(s, 'player');
  const rd = revenueReadout(s);
  const capped = rd.deps.filter((d) => d.bound === 'capacity').length;
  const u = engine.understanding(s);
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
    { id: 'serve', label: 'Serving', color: SPHERE.prod, v: pools.serving },
    { id: 'saf', label: 'Safety', color: SPHERE.saf, v: pools.safety },
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
  const bands0 = keys.map((x) => { const b = band(cx[0] + nodeW, y0, cx[1], pos1[x].y, Math.max(1, pools[x] * k), POOL_COLOR[x], `on>${x}`); y0 += pools[x] * k; return b; });
  const bands1 = keys.map((x) => { const d = POOL_DEPT[x]; const p2 = pos2[d]; const h = Math.max(1, pools[x] * k); const b = band(cx[1] + nodeW, pos1[x].y, cx[2], p2.y + p2.fill, h, POOL_COLOR[x], `${x}>${d}`); p2.fill += h; return b; });
  const out: Record<string, { label: string; tag?: { t: string; tone: string }; ref: string; to: { panel: string; tab?: string } }> = {
    cap: { label: 'R&D speed', tag: { t: prod.label, tone: 'warn' }, ref: 'M', to: { panel: 'company' } },
    serve: { label: 'Revenue', tag: capped ? { t: `${capped} capped`, tone: 'bad' } : undefined, ref: 'revenueRun', to: { panel: 'finance' } },
    saf: { label: 'Understanding', tag: u.margin < 0 ? { t: `${Math.abs(u.margin).toFixed(1)} behind`, tone: 'bad' } : { t: 'ahead', tone: 'good' }, ref: 'U', to: { panel: 'safety', tab: 'graph' } },
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
          <Tip as="g" key={x} content={() => <TipCard title={<Term id={POOL_TERM[x]}>{POOL_LABEL[x]}</Term>} value={`${F.count(pools[x])} H100e`}>Set by your compute split. Click to change it.</TipCard>}>
            <g onMouseEnter={() => setHover(x)} onClick={() => store.goto('company', { tab: 'split', anchor: `split-${x}` })} className="flow-click" data-pool={x}>
              <rect x={cx[1]} y={pos1[x].y} width={nodeW} height={pos1[x].h} rx={3} fill={POOL_COLOR[x]} />
              <text x={cx[1] + nodeW + 6} y={pos1[x].y + Math.min(pos1[x].h, 14) - 2 + 4} className="flow-lbl">{POOL_LABEL[x]} <tspan className="flow-sub">{F.count(pools[x])}</tspan></text>
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

/** Research speed (HOME of M): experiments → binding input → R&D speed; levers ranked per dollar. */
function ResearchSpeed({ s }: { s: GameStateV2 }) {
  const p = engine.production(s, 'player');
  const pools = poolsOf(s);
  const lev = ([['exp', '+10% experiments', ICON.experiments, { panel: 'company', tab: 'split', anchor: 'split-experiments' }], ['agents', '+10% AI agents', ICON.agents, { panel: 'company', tab: 'split', anchor: 'split-agents' }], ['humans', '+10% staff', ICON.staff, { panel: 'company', tab: 'people' }]] as const)
    .map(([id, label, icon, to]) => ({ id, label, icon, to, gain: Math.pow(1.1, p.elast[id]) - 1, perD: p.perDollar[id] }))
    .sort((a, b) => b.perD - a.perD);
  const maxG = Math.max(1e-6, ...lev.map((l) => l.gain));
  return (
    <Card title={<Term id="rdmult">Research speed</Term>} right={<span className="tag2 warn"><Term id={p.label === 'compute-bound' ? 'computeBound' : p.label === 'labor-bound' ? 'laborBound' : p.label === 'human-bound' ? 'humanBound' : 'tasteBound'}>{p.label}</Term></span>} home="M">
      <div className="rs-chain">
        <span className="rs-node"><b className="num">{F.count(pools.experiments)}</b><span><Term id="experiments">experiments</Term></span></span><span className="ar">›</span>
        <span className="rs-node"><b className="num">{F.count(p.labor.aiFTE)}</b><span><Term id="aiFte">AI FTE</Term></span></span><span className="ar">›</span>
        <span className="rs-node hero"><b className="num">{F.mult(p.M)}</b><span><Term id="rdmult">R&D speed</Term></span></span>
      </div>
      <div className="tip-cap" style={{ marginTop: 10 }}>Best lever per dollar</div>
      {lev.map((l) => (
        <div className="rs-lev" key={l.id}>
          <span><l.icon size={13} /> {l.label}{l.gain < 0.001 ? <span className="dim"> · saturated</span> : null}</span>
          <HBar v={l.gain} max={maxG} color={C.good} w={70} />
          <span className="num tone-pos">+{(l.gain * 100).toFixed(1)}%</span>
          <GoBtn to={l.to} label="Go" testId={`lever.${l.id}`} />
        </div>
      ))}
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
/** AI share of a role's work (home until R7's agent lanes). */
const AiShare = ({ v }: { v: number }) => (
  <Tip content={() => <TipCard title="AI share of the work" value={F.pct(v)}>Engineers: 1 − (1 − A)² on coding automation A. Research engineers: the AI part of research labour. Agents take engineers' work first.</TipCard>}>
    <span className="small dim" data-test="ai-share"><ICON.agents size={12} /> AI <b className="num">{F.pct(v)}</b></span>
  </Tip>
);

/** Quality as 1–3 filled dots (Solid / Strong / Elite). */
function QDots({ q }: { q: TeamQuality }) {
  return (
    <Tip content={() => <TipCard title={<Term id="teamQuality">{QUALITY[q].label}</Term>}>Output ×{QUALITY[q].out} · cost ×{QUALITY[q].cost}</TipCard>}>
      <span className={`qdots q-${q}`} data-q={q}>{[1, 2, 3].map((i) => <i key={i} className={i <= Q_N[q] ? 'on' : ''} />)}</span>
    </Tip>
  );
}

/** What a team adds, as one short chip (build capacity, research speed, taste, safety staff). */
function GainChip({ s, t }: { s: GameStateV2; t: Pick<Team, 'role' | 'dept' | 'quality' | 'specialty'> }) {
  const g = teamGain(s, t);
  const text = g.currency === 'staffTime' ? `+${g.amount.toFixed(1)} build` : g.currency === 'alignment' ? `+${F.count(g.amount)} safety staff` : g.amount === 0 ? 'taste ±0' : `${t.role === 'sci' ? 'taste' : 'speed'} ${F.pct(g.amount, 1, true)}`;
  return <Tip content={() => <TipCard title="If hired">{g.currency === 'staffTime' ? 'Build capacity, engineering team-weeks per week (before AI speed-up).' : g.currency === 'alignment' ? 'Safety staff: agendas, tool validation, investigations.' : t.role === 'sci' ? 'Research speed through research taste: Elite teams raise it, Solid teams lower it, Strong teams leave it. Scientists will also staff tree projects.' : 'Research speed through research labour h.'}</TipCard>}><span className={`pill2 ${g.amount < 0 ? 'cost' : 'gain'}`} data-test="team-gain">{text}</span></Tip>;
}

function Teams({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const people = p.teams.reduce((a, t) => a + t.heads, 0);
  const bc = buildCapacity(s);
  const ai = aiShareByRole(s);
  const prod = engine.production(s, 'player');
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
        <b className="num">{role(r).length}</b><span className="dim num">· {F.count(heads(role(r)))}</span>
        <span className="sp" />{right}
      </div>
    );
  };
  const Pile = ({ k, label, sub, actions }: { k: TeamKey; label: ReactNode; sub?: ReactNode; actions?: ReactNode }) => {
    const ts = byKey(k);
    const v = vacant(ts);
    return (
      <div className={`team-pile ${ts.length > 1 ? 'stacked' : ''}`} data-pile={k}>
        <div className="pile-top"><b className="num">×{ts.length}</b><span>{label}</span><span className="sp" />{ts.map((t) => <QDots key={t.id} q={t.quality} />).slice(0, 6)}</div>
        <div className="pile-sub small">{sub}{v >= 1 && <span className="tone-warn"> · {F.count(v)} seats open</span>}<span className="sp" />{actions}</div>
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
    <Card title={<span className="row-i"><ICON.staff size={15} /><Term id="team">Teams</Term></span>} sub={`${p.teams.length} teams · ${F.count(people)} people`} home="teams" className="teams-card"
      right={(
        <span className="row-i chips">
          <Tip content={payTip}><span className="chip2" data-home="payroll"><Term id="payroll">Payroll</Term> <b className="num">{F.money(pay, { perYear: true })}</b></span></Tip>
          <span className="chip2" data-home="morale"><Why k="morale" title="Morale" body="See [[morale]]."><ICON.morale size={13} /> Morale <b className="num">{F.idx(p.morale.overall)}</b></Why></span>
          <span className="chip2" data-home="moraleSafety"><Why k="morale.safety" title="Safety staff morale"><ICON.safety size={13} /> Safety morale <b className="num">{F.idx(p.morale.safety)}</b></Why></span>
        </span>
      )}>
      <div className="teams-body">
        <div className="teams-col">
          <RoleHead r="eng" right={<AiShare v={ai.eng} />} />
          <Pile k="eng" label="shared pool"
            sub={<Tip content={() => <TipCard title={<Term id="buildCapacity">Build capacity</Term>} value={`${bc.capacity.toFixed(1)} team-wk/wk`} rows={[{ label: 'Human (teams × quality)', value: bc.human.toFixed(1) }, { label: 'AI share of engineers\' work', value: F.pct(bc.aEng) }]}>What engineers can build each week. The build queue arrives with blueprints.</TipCard>}><span><ICON.build size={12} /> <Term id="buildCapacity">build</Term> <b className="num">{bc.capacity.toFixed(1)}</b> team-wk/wk</span></Tip>}
            actions={releaseBtn(newest('eng'))} />
          <RoleHead r="re" right={<AiShare v={ai.re} />} />
          <Pile k="re.cap" label="Capabilities"
            sub={<Tip content={() => <TipCard title="Research labour h" value={prod.ratios.h.toFixed(2)}>Capabilities research engineers ÷ (0.55 × the reference lab's staff). ×1 = the AI 2027 leader.</TipCard>}><span>labour <b className="num">h {prod.ratios.h.toFixed(2)}</b></span></Tip>}
            actions={<>{moveBtn(newest('re.cap'))}{releaseBtn(newest('re.cap'))}</>} />
          <Pile k="re.saf" label="Safety" sub={<span>tools · investigations</span>} actions={<>{moveBtn(newest('re.saf'))}{releaseBtn(newest('re.saf'))}</>} />
        </div>
        <div className="teams-col wide">
          <RoleHead r="sci" right={(
            <span className="row-i small">
              <Tip content={() => <TipCard title={<Term id="researchTaste">Research taste</Term>} value={`×${p.tasteHire.toFixed(2)}`} rows={[{ label: 'Stars', value: String(p.stars) }, { label: 'AI share (taste)', value: F.pct(ai.sci) }]}>From capabilities science-team quality and stars.</TipCard>}>
                <span><ICON.taste size={12} /> taste <b className="num">×{p.tasteHire.toFixed(2)}</b></span>
              </Tip>
              <ActBtn id="starHire" icon={ICON.hiring} label="Star" />
            </span>
          )} />
          {(['cap', 'saf'] as const).map((d) => (
            <div key={d}>
              <div className="sec-cap" style={{ color: d === 'cap' ? SPHERE.cap : SPHERE.saf }}>{d === 'cap' ? 'Capabilities' : 'Safety'} · {sci(d).length}</div>
              <div className="sci-grid">
                {sci(d).map((t) => {
                  const Ic = teamIcon(t);
                  return (
                    <div key={t.id} className={`sci-card ${d}`} data-team={t.id}>
                      <div className="row-i"><Ic size={13} /><b>{t.specialty ? COLUMN_LABEL[t.specialty] : 'Science'}</b><span className="sp" /><QDots q={t.quality} /></div>
                      <div className="row-i small dim">{t.heads < t.size - 0.5 ? `${F.count(t.heads)}/${t.size} people` : `${t.size} people`}<span className="sp" />{releaseBtn(t, '')}</div>
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
            {(have + q !== n || q > 0) && <span className="small dim num">{have} now{q ? ` · ${q} filling` : ''}</span>}
            <span className="stepper">
              <ActBtn id="teams.target" testId={`teams.target.down.${k}`} params={{ key: k, n: Math.max(0, n - 1) }} icon={ICON.minus} label="" block={n <= 0 ? 'Already 0' : undefined} />
              <b className="num" data-test={`target-${k}`}>{n}</b>
              <ActBtn id="teams.target" testId={`teams.target.up.${k}`} params={{ key: k, n: n + 1 }} icon={ICON.plus} label="" />
            </span>
          </div>
        );
      })}
      {h.filling.length > 0 && (
        <>
          <div className="sec-cap"><Term id="hiringQueue">Filling</Term> <span className="dim">· <Term id="weeklyHireCap">{F.count(weeklyHireCap(s, 'cap'))}/wk</Term> cap · {F.count(weeklyHireCap(s, 'saf'))}/wk safety</span></div>
          {h.filling.map((t) => {
            const Ic = teamIcon(t);
            const wk = fillWeeks(s, t);
            return (
              <div key={t.id} className="fill-row" data-filling={t.id}>
                <Ic size={13} /><span className="ellip">{teamTitle(t)}</span><QDots q={t.quality} />
                <HBar v={t.heads} max={t.size} color={t.dept === 'saf' ? SPHERE.saf : SPHERE.cap} w={70} />
                <span className="small dim num">{Number.isFinite(wk) ? `${wk} wk` : 'stalled'}</span>
                <ActBtn id="teams.release" testId="teams.cancel" params={{ team: t.id }} icon={ICON.release} label="" />
              </div>
            );
          })}
        </>
      )}
      <div className="sec-cap row-i"><Term id="teamOffer">Offers</Term><span className="sp" /><span className="dim">next in {nextOffer} d</span></div>
      {h.candidates.length === 0 && <div className="small dim">No offers this week.</div>}
      {h.candidates.map((c) => {
        const Ic = teamIcon(c);
        const wk = fillWeeks(s, { ...c, size: TEAM_SIZE[c.role], heads: 0 });
        return (
          <div key={c.id} className="offer" data-offer={c.id}>
            <span className={`offer-ic ${c.dept}`}><Ic size={16} /></span>
            <div className="offer-main">
              <div className="row-i"><b>{teamTitle(c)}</b><QDots q={c.quality} /></div>
              <div className="row-i small"><span className="num">{F.money(fullTeamPayroll(c.role, c.dept, c.quality), { perYear: true })}</span><span className="dim">· {Number.isFinite(wk) ? `${wk} wk` : 'stalled'} · until {c.until - s.time.day} d</span><GainChip s={s} t={c} /></div>
            </div>
            <ActBtn id="teams.hire" params={{ candidate: c.id }} icon={ICON.hiring} label="Hire" primary />
          </div>
        );
      })}
    </Card>
  );
}

function People({ s }: { s: GameStateV2 }) {
  const prod = engine.production(s, 'player');
  return (
    <div className="people-grid">
      <Teams s={s} />
      <div className="col2">
        <Hiring s={s} />
        <Card title="AI labour" sub="your agents doing research" term="aiFte">
          <div data-test="ai-labour">
            <KV k="Agent copies × speed" term="agentCopies">{F.count(prod.labor.copies)} × {prod.labor.speed.toFixed(1)}</KV>
            <KV k="AI FTE · research eng." term="aiFte">{F.count(prod.labor.aiFTE)} · {F.count(teamsOfKey(s.player, 're.cap').reduce((a, t) => a + t.heads, 0))}</KV>
            <KV k="AI taste (SD over median)" term="researchTaste">{prod.sdAI.toFixed(2)}</KV>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ───────── Split ─────────
const TOP_LABEL: Record<TopKey, string> = { training: 'Training', research: 'Research', serving: 'Serving', safety: 'Safety' };

function Split({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const cur = specOf(p.split);
  const [spec, setSpec] = useState<SplitSpec>(cur);
  const [manual, setManual] = useState(!!p.researchManual);
  const sum = TOP_KEYS.reduce((a, k) => a + spec.top[k], 0) || 1;
  const norm = Object.fromEntries(TOP_KEYS.map((k) => [k, spec.top[k] / sum])) as Record<TopKey, number>;
  const changed = TOP_KEYS.some((k) => Math.abs(norm[k] - cur.top[k]) > 1e-3) || Math.abs(spec.dataShare - cur.dataShare) > 1e-3 || manual !== !!p.researchManual || (manual && Math.abs(spec.expShare - cur.expShare) > 1e-3);
  const params: Record<string, number> = { ...norm, dataShare: spec.dataShare, manual: manual ? 1 : 0, ...(manual ? { expShare: spec.expShare } : {}) };
  const reset = () => { setSpec(specOf(s.player.split)); setManual(!!s.player.researchManual); };
  // What a zero share does (no floors: the split always applies; these say what stops).
  const warns: string[] = [];
  if (norm.training * (1 - spec.dataShare) <= 1e-4 && p.models.runs.some((r) => r.status === 'running')) warns.push('Running training runs pause: no training compute');
  if (norm.serving <= 1e-4 && p.deployments.some((d) => d.status === 'live' && d.channel !== 'internal' && d.channel !== 'open')) warns.push('Every product goes capacity-bound: no serving compute');
  const row = (k: TopKey, sub?: ReactNode) => (
    <div key={k} className="split-group" id={`ctl-split-${k}`}>
      <div className="alloc-row split-row">
        <span className="alloc-label"><span className="dot" style={{ background: TOP_COLOR[k] }} /><Term id={TOP_TERM[k]}>{TOP_LABEL[k]}</Term></span>
        <Slider value={spec.top[k]} min={0} max={1} step={0.01} onChange={(v) => setSpec({ ...spec, top: { ...spec.top, [k]: v } })} width={260} />
        <span className="alloc-val num">{pct0(norm[k])}</span>
        <span className={`num small ${Math.abs(norm[k] - cur.top[k]) > 1e-3 ? 'tone-warn' : 'dim'}`}>{Math.abs(norm[k] - cur.top[k]) > 1e-3 ? `was ${pct0(cur.top[k])}` : ''}</span>
      </div>
      {sub}
    </div>
  );
  return (
    <div className="split-page">
      <Card title={<Term id="split">Compute split</Term>} sub="drag, then apply" home="split" right={<div className="btn-row">{SPLIT_PRESETS.map((x) => <ActBtn key={x} id="splitPreset" testId={`splitPreset.${x}`} params={{ preset: x }} label={F.words(x)} onDone={reset} />)}</div>}>
        <div className="split-bar">{TOP_KEYS.map((k) => <i key={k} style={{ flex: Math.max(0.0001, norm[k]), background: TOP_COLOR[k] }} title={TOP_LABEL[k]} />)}</div>
        {row('training', (
          <div className="alloc-row split-row split-sub" id="ctl-split-synthetic">
            <span className="alloc-label small"><Term id="poolSynthetic">Data generation</Term></span>
            <Slider value={spec.dataShare} min={0} max={1} step={0.01} onChange={(v) => setSpec({ ...spec, dataShare: v })} width={260} />
            <span className="alloc-val num small">{pct0(spec.dataShare)}</span>
            <span className="small dim">of training</span>
          </div>
        ))}
        {row('research', (
          <div className="alloc-row split-row split-sub" id="ctl-split-experiments">
            <span className="alloc-label small"><Term id="researchMix">Mix</Term> <Seg value={manual ? 'manual' : 'auto'} options={[{ v: 'auto', label: 'Auto', tip: 'Best mix, re-set every day' }, { v: 'manual', label: 'Manual', tip: 'Hold your own mix' }]} onChange={(v) => setManual(v === 'manual')} /></span>
            {manual
              ? <Slider value={spec.expShare} min={MANUAL_MIX_RANGE[0]} max={MANUAL_MIX_RANGE[1]} step={0.01} onChange={(v) => setSpec({ ...spec, expShare: v })} width={260} />
              : <span className="small dim" style={{ width: 260 }}>follows the best mix</span>}
            <span className="alloc-val num small">{pct0(manual ? spec.expShare : cur.expShare)}</span>
            <span className="small dim">experiments · rest <Term id="poolAgents">agents</Term></span>
          </div>
        ))}
        {row('serving')}
        {row('safety')}
        {warns.map((w) => <div key={w} className="small tone-warn" data-test="split-warn">{w}</div>)}
        <div className="btn-row">
          <ActBtn id="setSplit" params={params} label={changed ? 'Apply split' : 'Split (no change)'} primary={changed} onDone={reset} />
          <button className="btn btn-sm" onClick={reset}>Reset</button>
        </div>
      </Card>
      <div className="g2">
        <Card title={<Term id="researchMix">Research mix</Term>} sub="R&D speed by experiments vs agents">
          <MixChart s={s} preview={manual ? spec.expShare : undefined} />
        </Card>
        <Card title={<Term id="responseCurve">What more of each buys</Term>} sub="R&D speed at ×¼ … ×4 of one input">
          <ResponseCharts s={s} />
        </Card>
      </div>
    </div>
  );
}

// ───────── Security ─────────
function Security({ s }: { s: GameStateV2 }) {
  const p = s.player;
  const [wslLo, wslHi] = WSL_TARGET_RANGE;
  const [wsl, setWsl] = useState(Math.max(wslLo, Math.min(wslHi, Math.round((p.security.target + 0.5) * 2) / 2)));
  return (
    <div className="g2">
      <Card title={<Term id="wsl">Weight security</Term>} home="wsl" right={<span className="num big">{p.security.wsl.toFixed(1)}</span>}>
        <KV k="Level now → target" term="wslTarget"><HBar v={p.security.wsl} max={5} color={SPHERE.sec} w={140} mark={p.security.target} /> {p.security.wsl.toFixed(1)} → {p.security.target.toFixed(1)}</KV>
        <div className="kv"><span className="kv-k">New target {wsl.toFixed(1)}</span><span className="row-i"><Slider value={wsl} min={wslLo} max={wslHi} step={0.5} onChange={setWsl} /><ActBtn id="SEC_TARGET" params={{ level: wsl }} label="Set" reason /></span></div>
        <KV k="Security spend" term="opex">{F.money(p.security.spendRate, { perYear: true })}</KV>
        <KV k="Privileged staff" term="privileged">{F.count(p.security.privileged)}</KV>
        <div className="small dim" style={{ marginTop: 6 }}>Theft risk: <Ref id="risk.theft" to={{ panel: 'risk' }}>Risk › theft</Ref></div>
      </Card>
      <Card title="Controls">
        <KV k={`Siloing ${p.security.siloing}`} term="siloing"><span className="row-i"><ActBtn id="SEC_SILO" params={{ level: Math.min(2, p.security.siloing + 1) }} label="Silo +1" /><ActBtn id="SEC_SILO" testId="SEC_SILO.down" params={{ level: Math.max(0, p.security.siloing - 1) }} label="Silo −1" /></span></KV>
        <KV k={`Counter-intel ${F.pct(p.security.counterIntel)}`} term="counterIntel"><ActBtn id="SEC_CI" /></KV>
        <KV k="KYC per channel" term="kyc"><span className="small dim">{p.deployments.filter((d) => d.status === 'live').map((d) => `${d.channel} ${d.kyc}`).join(' · ') || 'set per deployment'}</span></KV>
      </Card>
    </div>
  );
}

export function Company({ s }: { s: GameStateV2 }) {
  const tab = tabOf('company', 'flow');
  return (
    <div className="panel-v2 company" data-panel="company">
      <PanelHead icon={ICON.company} title="Company" sub="where compute goes and what it produces" tabs={<Tabs panel="company" def="flow" tabs={[{ id: 'flow', label: 'Flow', icon: ICON.company }, { id: 'people', label: 'People', icon: ICON.staff }, { id: 'split', label: 'Compute split', icon: ICON.split }, { id: 'security', label: 'Security', icon: ICON.security }]} />} />
      {tab === 'flow' && (
        <div className="company-flow">
          <Card title="Where your compute goes" sub="widths are live · hover to trace · click a pool to change the split"><Flow s={s} /></Card>
          <ResearchSpeed s={s} />
        </div>
      )}
      {tab === 'people' && <People s={s} />}
      {tab === 'split' && <Split s={s} />}
      {tab === 'security' && <Security s={s} />}
    </div>
  );
}
