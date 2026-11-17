// Research (STRUCTURE §4.2, TECH-TREE §3, mockups-v3/v3-research*, BUILD-PLAN R4).
// L1: the know-how bar (header), the tree (six lanes = science specialties, left → right by depth from what you know),
// active projects and the queue. L2: the node card and the team picker (click). L3: tooltips.
// One home per datum: idea state on the tree node; teams, progress, ETA and odds on the project card; queue order and
// what an item waits for on the queue card; research speed lives on Company (link only).
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Building2, CircleCheck, CircleDashed, CircleX, Hourglass, Layers, LoaderCircle, WandSparkles, Wrench, X, ChevronUp, ChevronDown } from 'lucide-react';
import {
  dateOf, effortOf, fmtDate, idleTeams, knowHow, nodeDept, missingNeeds, nodeOdds, nodeStatus, payoffOf, projectCapacity, projectEta,
  projectReady, projectTeams, researchSpeed, teamCapacity, teamsOn, treeCounts,
} from '../../../engine/v2';
import type { Column, GameStateV2, NodeStatus, Team, TeamQuality } from '../../../engine/v2';
import { EFFORT_TM, SAFETY_COLUMNS, TREE, TREE_CHILDREN, TREE_RETRY_DAYS, PROJECT_BY_ID, isLineNode, type Layer, type TreeNodeDef } from '../../../data/v2/tree';
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { COLUMNS, COLUMN_LABEL, QUALITY } from '../../../data/v2/teams';
import { store, useV2 } from '../store';
import { ActBtn, Limit, Term, Tip, TipCard } from '../ui';
import { Card, PanelHead, Ref } from '../kit';
import { ICON } from '../icons';
import { C } from '../theme';
import * as F from '../fmt';
import './research.css';

const COL_ICON: Record<Column, typeof ICON.L> = { pretraining: ICON.colPretraining, posttraining: ICON.colPosttraining, systems: ICON.colSystems, alignment: ICON.colAlignment, interp: ICON.colInterp, evals: ICON.colEvals };
const LAYER_BADGE: Record<Layer, string> = { backbone: 'B', training: 'T', scaffold: 'S', lab: 'L' };
const LAYER_TERM: Record<Layer, string> = { backbone: 'layerBackbone', training: 'layerTraining', scaffold: 'layerScaffold', lab: 'layerLab' };
const LAYER_NAME: Record<Layer, string> = { backbone: 'Backbone', training: 'Training', scaffold: 'Scaffold', lab: 'Lab' };
const LAYER_ICON: Record<Layer, typeof Layers> = { backbone: Layers, training: WandSparkles, scaffold: Wrench, lab: Building2 };
const EFFORT_WORD: Record<string, string> = { S: 'small', M: 'medium', L: 'large', XL: 'very large' };
const EFFORT_DOTS: Record<string, string> = { S: '·', M: '··', L: '···', XL: '····' };
const SLOT_LABEL: Record<string, string> = { shape: 'Architecture', data: 'Data', curation: 'Data filter', pref: 'Preference', rlFocus: 'RL focus', rlIntensity: 'Training effort', cot: 'Reasoning', inoculation: 'Alignment', effort: 'Inference effort' };
const Q_N: Record<TeamQuality, number> = { solid: 1, strong: 2, elite: 3 };
const capCol = (c: Column) => !SAFETY_COLUMNS.includes(c);
const laneColor = (c: Column) => (capCol(c) ? C.cap : C.und);

const ui = (k: string, d = '') => store.tab[`research.${k}`] ?? d;
const setUi = (k: string, v: string) => store.setTab(`research.${k}`, v);
const eta = (d: number) => (Number.isFinite(d) ? F.days(d) : '—');
/** A research line's health label from its estimated chance of a working result (Safety › Research lines is home). */
const health = (p: number) => (p >= 0.55 ? 'Promising' : p >= 0.3 ? 'Mixed' : 'Struggling');

/** Steps from what you know: 0 known, 1 = all prerequisites known, 2 = one unknown step away … */
function relDepths(s: GameStateV2): Record<string, number> {
  const out: Record<string, number> = {};
  const rd = (id: string): number => {
    if (out[id] !== undefined) return out[id];
    out[id] = 0;
    const n = PROJECT_BY_ID[id];
    if (!n || nodeStatus(s, id) === 'known') return (out[id] = 0);
    return (out[id] = 1 + Math.max(0, ...n.needs.map(rd)));
  };
  for (const n of TREE) rd(n.id);
  return out;
}

function QDots({ q }: { q: TeamQuality }) {
  return <span className={`qdots q-${q}`}>{[1, 2, 3].map((i) => <i key={i} className={i <= Q_N[q] ? 'on' : ''} />)}</span>;
}
const teamName = (t: Team) => `${t.specialty ? COLUMN_LABEL[t.specialty] : 'Science'} team`;
/** Jank P5: number teams within their specialty so identical rows can be told apart ("Pretraining team 3"). */
const teamNo = (s: GameStateV2, t: Team) => {
  const same = s.player.teams.filter((x) => x.role === t.role && x.specialty === t.specialty);
  return `#${same.findIndex((x) => x.id === t.id) + 1}`;
};

/** Capability / safety effect arrows. */
function Fx({ n }: { n: TreeNodeDef }) {
  const arrows = (v: number) => (v > 0 ? '▲'.repeat(Math.min(2, v)) : '▼'.repeat(Math.min(2, -v)));
  return (
    <>
      {n.fx.cap ? <span className={`rs-fx ${n.fx.cap > 0 ? 'cu' : 'dn'}`}><ICON.capabilities size={11} />{arrows(n.fx.cap)}</span> : null}
      {n.fx.saf ? <span className={`rs-fx ${n.fx.saf > 0 ? 'su' : 'dn'}`}><ICON.safety size={11} />{arrows(n.fx.saf)}</span> : null}
    </>
  );
}

function StatusIcon({ st, p }: { st: NodeStatus; p?: number }) {
  if (st === 'known') return <CircleCheck size={12} className="tone-pos" />;
  if (st === 'active') return <span className="rs-ring" style={{ ['--p' as string]: Math.round((p ?? 0) * 100) }} />;
  if (st === 'failed') return <CircleX size={12} className="tone-neg" />;
  if (st === 'locked') return <ICON.locked size={11} />;
  if (st === 'queued') return <LoaderCircle size={12} className="tone-warn" />;
  return <CircleDashed size={12} />;
}

// ───────── know-how bar (L1, home) ─────────
function KnowHow({ s }: { s: GameStateV2 }) {
  const k = knowHow(s);
  const months = k.gap * 12;
  const out = Math.min(1, k.gap); // the bar spans the last year of know-how
  return (
    <Tip as="div" content={() => (
      <TipCard title={<Term id="knowHow">Know-how</Term>} value={`${F.num(k.pa, 2)} y`} rows={[
        { label: <>In {k.versionName ?? 'your internal model'}</>, value: `${F.num(k.inModel, 2)} y` },
        { label: <Term id="trainedIn">Not trained in</Term>, value: `+${months.toFixed(1)} mo`, tone: months >= 3 ? 'neg' : 'neutral' },
        { label: <Term id="rdmult">Research speed</Term>, value: F.mult(researchSpeed(s)) },
      ]}>Know-how grows with research speed. A model embodies the know-how of its base and part of what its post-training saw; a new run trains the rest in. The bar spans the last 12 months of know-how.</TipCard>
    )}>
      <div className="rs-kh" data-home="knowHow" data-test="knowhow">
        <span className="lbl"><Term id="knowHow">Know-how</Term></span>
        <div className="rs-khbar"><i className="in" style={{ width: `${(1 - out) * 100}%` }} /><i className="out" style={{ width: `${out * 100}%` }} /></div>
        <span className="lbl"><i className="dot" style={{ background: C.cap }} /> in {k.versionName ?? '—'}</span>
        <span className="lbl"><b className="num">+{months.toFixed(1)} mo</b> not trained in</span>
        <button className="btn btn-sm go-btn" data-go="blueprint" onClick={() => store.goto('blueprint')}><ICON.run size={12} /> Train <ICON.go size={11} /></button>
      </div>
    </Tip>
  );
}

// ───────── tree ─────────
function NodeBox({ s, n, st, sel, qn }: { s: GameStateV2; n: TreeNodeDef; st: NodeStatus; sel: boolean; qn: number }) {
  const ts = s.player.tree[n.id];
  const p = ts?.status === 'researching' ? ts.progress : 0;
  const miss = st === 'locked' ? missingNeeds(s, n.id) : [];
  let meta: ReactNode = null;
  // Jank R3/R4: layer and effort as icons with tooltips, odds as the only number; nothing truncated without a tooltip.
  const odds = !n.soon ? (isLineNode(n) ? health(nodeOdds(s, n.id)) : F.pct(nodeOdds(s, n.id))) : '';
  const effortTip = () => <TipCard title={<Term id="effortClass">Effort</Term>} value={EFFORT_WORD[n.effort ?? 'M']} rows={[{ label: <Term id="teamMonth">Team-months</Term>, value: `about ${EFFORT_TM[n.effort ?? 'M']} at research speed ×1` }]}>Bigger ideas take more science-team time; faster research shortens it.</TipCard>;
  if (st === 'open') meta = <>{n.effort && <Tip content={effortTip}><span className="eff" data-effort={n.effort}><Hourglass size={10} />{EFFORT_DOTS[n.effort]}</span></Tip>}{odds && <Tip content={() => <TipCard title={<Term id="odds">Odds</Term>} value={odds}>{isLineNode(n) ? 'Line health: how likely a result here is a working tool.' : 'Chance the idea works when the project finishes.'}</TipCard>}><span className="eo">{odds}</span></Tip>}</>;
  else if (st === 'locked') meta = <Tip content={() => <TipCard title="Needs first" rows={miss.map((m) => ({ label: PROJECT_BY_ID[m]?.name ?? m, value: nodeStatus(s, m) }))} />}><span className="eo warn">needs {miss.length > 1 ? `${miss.length} ideas` : PROJECT_BY_ID[miss[0]]?.name ?? miss[0]}</span></Tip>;
  else if (st === 'queued') meta = <span className="rs-qn">{qn}</span>;
  else if (st === 'active') meta = <Tip content={() => <TipCard title="Progress" value={F.pct(p)}>Share of the project done; ETA is on its project card.</TipCard>}><span className="eo">{F.pct(p)}</span></Tip>;
  else if (st === 'failed') meta = <Tip content={() => <TipCard title={<Term id="retryRule">Failed</Term>} value={`retry ${fmtDate(dateOf(s, ts?.retryDay ?? 0))}`}>It did not work in this world; it can be retried from that date at lower odds.</TipCard>}><span className="eo neg">retry {fmtDate(dateOf(s, ts?.retryDay ?? 0)).replace(/,? \d{4}$/, '')}</span></Tip>;
  else if (st === 'soon') meta = <span className="eo">with products</span>;
  const LayerIc = LAYER_ICON[n.layer];
  return (
    <div className={`rs-node st-${st} ${sel ? 'sel' : ''}`} data-node={n.id} data-status={st} onClick={() => setUi('sel', sel ? '' : n.id)}>
      <Tip as="div" content={() => <TipCard title={n.name} />}><div className="nm"><StatusIcon st={st} p={p} /><span>{n.name}</span></div></Tip>
      <div className="mt"><Fx n={n} /><Tip content={() => <TipCard title={<Term id={LAYER_TERM[n.layer]}>{LAYER_NAME[n.layer]} layer</Term>} />}><span className="lay"><LayerIc size={10} /></span></Tip>{meta}</div>
      {st === 'active' && <div className="pb"><i style={{ width: `${p * 100}%` }} /></div>}
    </div>
  );
}

function KnownPill({ n, sel }: { n: TreeNodeDef; sel: boolean }) {
  return (
    <div className={`rs-pill ${sel ? 'sel' : ''}`} data-node={n.id} data-status="known" onClick={() => setUi('sel', sel ? '' : n.id)}>
      <CircleCheck size={11} />{n.name}
    </div>
  );
}

interface Edge { d: string; miss: boolean; hot: boolean; live: boolean }

function Tree({ s }: { s: GameStateV2 }) {
  const filter = ui('filter', 'all');
  const view = ui('view', 'frontier');
  const sel = ui('sel');
  const rel = relDepths(s);
  const st: Record<string, NodeStatus> = {};
  for (const n of TREE) st[n.id] = nodeStatus(s, n.id);
  const lanes = COLUMNS.filter((c) => filter === 'all' || (filter === 'cap' ? capCol(c) : !capCol(c)));
  const maxCol = view === 'all' ? Math.max(...Object.values(rel)) : 3;
  // Frontier view: unknown ideas up to depth 3; known ideas only as prerequisite pills of what is shown.
  const shown = TREE.filter((n) => lanes.includes(n.column) && st[n.id] !== 'known' && rel[n.id] <= maxCol);
  const knownShown = TREE.filter((n) => lanes.includes(n.column) && st[n.id] === 'known' && (view === 'all' || shown.some((x) => x.needs.includes(n.id)) || sel === n.id));
  const deeper = TREE.filter((n) => lanes.includes(n.column) && st[n.id] !== 'known' && rel[n.id] > maxCol).length;
  const queue = s.player.research.queue;
  const cols = Array.from({ length: maxCol + 1 }, (_, i) => i);
  const { known, total } = treeCounts(s);

  // Edges: measured from the DOM after layout (prerequisite → idea). Missing prerequisites amber dashed, satisfied grey.
  const box = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const key = `${filter}|${view}|${sel}|${shown.map((n) => n.id + st[n.id]).join(',')}|${knownShown.length}`;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const base = el.getBoundingClientRect();
    const pos = new Map<string, DOMRect>();
    el.querySelectorAll<HTMLElement>('[data-node]').forEach((x) => pos.set(x.dataset.node as string, x.getBoundingClientRect()));
    const out: Edge[] = [];
    for (const n of [...shown, ...knownShown]) {
      const b = pos.get(n.id);
      if (!b) continue;
      for (const r of n.needs) {
        const a = pos.get(r);
        if (!a) continue;
        const x1 = a.right - base.left + el.scrollLeft;
        const y1 = a.top + a.height / 2 - base.top + el.scrollTop;
        const x2 = b.left - base.left + el.scrollLeft;
        const y2 = b.top + b.height / 2 - base.top + el.scrollTop;
        const mx = (x1 + x2) / 2;
        // Missing prerequisites are amber when they matter now (selected, or a queued/active idea waits on them), else faint.
        const live = ['queued', 'active'].includes(st[n.id]) || ['queued', 'active'].includes(st[r]);
        out.push({ d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, miss: st[r] !== 'known', hot: sel === n.id || sel === r, live });
      }
    }
    const sig = out.map((e) => e.d + e.miss + e.hot + e.live).join('|');
    setEdges((prev) => (prev.map((e) => e.d + e.miss + e.hot + e.live).join('|') === sig ? prev : out));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <Card className="rs-tree" home="tree" title={<span className="row-i"><ICON.experiments size={14} /> <Term id="techTree">Tree</Term></span>}
      sub={<span data-test="tree-count">{view === 'frontier' ? 'around what you know' : 'whole tree'} · {known} of {total} ideas known</span>}
      right={(
        <span className="rs-tools">
          <span className="seg" data-test="tree-filter">
            {(['all', 'cap', 'saf'] as const).map((f) => <button key={f} className={`seg-btn ${filter === f ? 'active' : ''}`} data-opt={f} onClick={() => setUi('filter', f)}>{f === 'all' ? 'All' : f === 'cap' ? 'Capability' : 'Safety'}</button>)}
          </span>
          <span className="rs-lgd">
            <span className="rs-fx cu"><ICON.capabilities size={11} />▲</span>capability
            <span className="rs-fx su"><ICON.safety size={11} />▲</span>safety
            <span className="rs-fx dn">▼</span>cost
            <Term id="layer">layer</Term>
            <span className="warn">- - needs</span>
          </span>
          <Minimap rel={rel} st={st} view={view} />
        </span>
      )}>
      <div className="rs-canvas" ref={box} data-test="tree-canvas">
        <svg className="rs-edges">
          {edges.map((e, i) => <path key={i} d={e.d} className={`${e.miss ? (e.live || e.hot ? 'miss' : 'faint') : 'ok'} ${e.hot ? 'hot' : ''}`} />)}
        </svg>
        <div className="rs-grid" style={{ gridTemplateColumns: `128px repeat(${cols.length}, max-content) ${deeper ? '90px' : ''}` }}>
          <div className="rs-colhd" />
          {cols.map((c) => <div key={c} className="rs-colhd">{c === 0 ? 'Known' : <Term id="depth">{`Depth ${c}`}</Term>}</div>)}
          {deeper > 0 && <div className="rs-colhd">Deeper</div>}
          {lanes.map((lane) => {
            const Ic = COL_ICON[lane];
            return [
              <div key={`${lane}-l`} className="rs-lane-l" style={{ ['--lc' as string]: laneColor(lane) }}><Ic size={14} /><Term id="specialty">{COLUMN_LABEL[lane]}</Term></div>,
              ...cols.map((c) => (
                <div key={`${lane}-${c}`} className={`rs-cell ${c === 0 ? 'known' : ''}`} data-lane={lane}>
                  {c === 0
                    ? knownShown.filter((n) => n.column === lane).map((n) => <KnownPill key={n.id} n={n} sel={sel === n.id} />)
                    : shown.filter((n) => n.column === lane && rel[n.id] === c).map((n) => <NodeBox key={n.id} s={s} n={n} st={st[n.id]} sel={sel === n.id} qn={queue.indexOf(n.id) + 1} />)}
                </div>
              )),
              deeper > 0 ? <div key={`${lane}-d`} className="rs-cell deeper">{(() => { const k = TREE.filter((n) => n.column === lane && st[n.id] !== 'known' && rel[n.id] > maxCol).length; return k ? <button className="btn btn-sm" onClick={() => setUi('view', 'all')}>+{k} ›</button> : null; })()}</div> : null,
            ];
          })}
        </div>
      </div>
      {sel && PROJECT_BY_ID[sel] && <NodeCard s={s} n={PROJECT_BY_ID[sel]} st={st[sel]} />}
      {ui('pick') && PROJECT_BY_ID[ui('pick')] && <TeamPicker s={s} id={ui('pick')} />}
    </Card>
  );
}

/** Minimap: every idea as a dot (lane × depth from what you know), coloured by state; click toggles frontier/whole. */
function Minimap({ rel, st, view }: { rel: Record<string, number>; st: Record<string, NodeStatus>; view: string }) {
  const W = 150;
  const H = 36;
  const maxD = Math.max(1, ...Object.values(rel));
  const dx = (W - 8) / (maxD + 1);
  const dy = H / COLUMNS.length;
  const slot: Record<string, number> = {};
  const color: Record<NodeStatus, string> = { known: C.good, active: '#5aa9ff', queued: C.watch, open: C.text2, locked: C.line2, failed: C.bad, soon: C.line2 };
  return (
    <Tip content={() => <TipCard title="Whole tree" value={view === 'frontier' ? 'click: show all' : 'click: around what you know'}>Every idea, by specialty (rows) and steps from what you know (columns). Green known, blue active, amber queued, grey open, dark locked.</TipCard>}>
      <svg className="rs-mini" width={W} height={H} data-test="minimap" onClick={() => setUi('view', view === 'frontier' ? 'all' : 'frontier')}>
        {TREE.map((n) => {
          const li = COLUMNS.indexOf(n.column);
          const k = `${li}:${rel[n.id]}`;
          const j = (slot[k] = (slot[k] ?? -1) + 1);
          return <rect key={n.id} x={4 + rel[n.id] * dx + (j % 6) * 3.4} y={li * dy + 1 + Math.floor(j / 6) * 3} width={2.6} height={2.4} fill={color[st[n.id]]} />;
        })}
        {view === 'frontier' && <rect className="vp" x={1} y={0.5} width={Math.min(W - 2, 4 + 4 * dx)} height={H - 1} />}
      </svg>
    </Tip>
  );
}

// ───────── node card (L2) ─────────
function NodeCard({ s, n, st }: { s: GameStateV2; n: TreeNodeDef; st: NodeStatus }) {
  const ts = s.player.tree[n.id];
  const queued = s.player.research.queue.includes(n.id);
  const ready = projectReady(s, n.id);
  const project = !n.soon && !n.star;
  const line = isLineNode(n);
  const odds = nodeOdds(s, n.id);
  const teams = teamsOn(s, n.id);
  const etaNow = projectEta(s, n.id);
  const etaOne = projectEta(s, n.id, 1);
  const payoff = n.payoff ? payoffOf(s, n.id) : undefined;
  const Ic = COL_ICON[n.column];
  const children = TREE_CHILDREN[n.id] ?? [];
  const efRow = (icon: ReactNode, label: string, v?: string, tone = '') => v ? <div className="rs-efrow"><span>{icon}</span><span className="dim">{label}</span><span className={tone}>{v}</span></div> : null;
  return (
    <div className="rs-ncard" data-test="node-card" data-card={n.id}>
      <div className="row-i hd">
        <Ic size={18} style={{ color: laneColor(n.column) }} />
        <h2>{n.name}</h2>
        <span className="sp" />
        <button className="btn btn-sm btn-ghost" data-test="node-close" onClick={() => setUi('sel', '')}><X size={14} /></button>
      </div>
      <div className="row-i chips">
        <span className="rs-chip" style={{ color: laneColor(n.column) }}>{COLUMN_LABEL[n.column]}</span>
        <span className="rs-chip"><Term id={LAYER_TERM[n.layer]}>{`${LAYER_BADGE[n.layer]} ${LAYER_NAME[n.layer]} layer`}</Term></span>
        <span className={`rs-chip st-${st}`}>{st === 'soon' ? 'with products' : st}{queued && st === 'queued' ? ` #${s.player.research.queue.indexOf(n.id) + 1}` : ''}</span>
      </div>
      <div className="sec">
        <div className="k">Effect</div>
        {efRow(<ICON.capabilities size={13} style={{ color: C.cap }} />, 'Capability', n.cap ?? 'none', n.fx.cap && n.fx.cap < 0 ? 'tone-neg' : '')}
        {efRow(<ICON.safety size={13} style={{ color: C.und }} />, 'Safety', n.saf, n.fx.saf && n.fx.saf < 0 ? 'tone-neg' : 'tone-pos')}
        {efRow(<ICON.cash size={13} />, 'Cost', n.cost, 'tone-warn')}
        {n.payoff && <div className="rs-efrow"><span><ICON.M size={13} /></span><span className="dim">Pays off</span><span>{n.payoff}{payoff !== undefined && n.paradigm && ['P13', 'P20', 'P24'].includes(n.id) ? <b className="num"> · now {F.pct(payoff)}</b> : null}</span></div>}
      </div>
      <div className="sec">
        <div className="k"><Term id="odds">Odds</Term></div>
        {line && !n.star
          ? <div className="row-i"><b className="num">{health(odds)}</b><span className="dim small">estimated {F.pct(odds)} a result here is a working tool</span><Ref id="lineHealth" to={{ panel: 'safety', tab: 'lines' }}>{AGENDA_BY_ID[n.agenda as keyof typeof AGENDA_BY_ID]?.name ?? 'Research line'}</Ref></div>
          : n.star ? <div className="dim">Known by every lab</div>
          : <div className="row-i"><b className="num">{F.pct(odds)}</b><span className="dim small">{n.paradigm ? 'known chance; the result is drawn for this world' : 'chance it works'}{(ts?.attempts ?? 0) > 0 ? ` · attempt ${(ts?.attempts ?? 0) + (ts?.status === 'failed' ? 1 : 0)}` : ''}</span>
            </div>}
        {!line && !n.star && st !== 'known' && <Limit id="tree.retry" tone={st === 'failed' ? 'warn' : 'quiet'}>{st === 'failed' ? <>failed · <Term id="retryRule">retry</Term> from {fmtDate(dateOf(s, ts?.retryDay ?? 0))} at {F.pct(odds)}</> : <>if it fails: <Term id="retryRule">retry</Term> after {TREE_RETRY_DAYS} d at {F.pct(odds / 2)}</>}</Limit>}
      </div>
      {project && (
        <div className="sec">
          <div className="k"><Term id="effortClass">Effort</Term></div>
          <Tip as="div" content={() => (
            <TipCard title="ETA" value={eta(etaNow)} rows={[
              { label: 'Capacity', value: projectCapacity(s, n.id).toFixed(2) },
              { label: <Term id="diminishingReturns">Progress ∝ √capacity</Term>, value: `×${Math.sqrt(projectCapacity(s, n.id)).toFixed(2)}` },
              line ? { label: <Term id="seriousStaffing">First result at serious staffing</Term>, value: `${AGENDA_BY_ID[n.agenda as keyof typeof AGENDA_BY_ID]?.T1 ?? '—'} mo` } : { label: <Term id="rdmult">Research speed</Term>, value: F.mult(researchSpeed(s)) },
            ]}>{line ? 'Capacity = Σ team people ÷ 40 × quality × 1.5 in the team\'s specialty. ETA to the next result; safety compute and Trusted to AI speed it up.' : 'Capacity = Σ team people ÷ 40 × quality × 1.5 in the team\'s specialty. At today\'s research speed; takeoff speeds it up.'}</TipCard>
          )}>
            <div className="row-i"><span className="lay">{n.effort}</span><b className="num">{F.num(effortOf(n), 0)}</b><Term id="teamMonth">team-months</Term><span className="sp" />
              <span className="dim small">{teams.length ? `${teams.length} team${teams.length > 1 ? 's' : ''} · ETA ${eta(etaNow)}` : `one team ≈ ${eta(etaOne)}`}</span></div>
          </Tip>
        </div>
      )}
      {n.needs.length > 0 && (
        <div className="sec">
          <div className="k">Needs</div>
          {n.needs.map((r) => {
            const rs = nodeStatus(s, r);
            const rp = s.player.tree[r];
            return <div key={r} className="rs-prq" onClick={() => setUi('sel', r)}><StatusIcon st={rs} p={rp?.progress} /><span>{PROJECT_BY_ID[r]?.name ?? r}</span><span className="sp" /><span className="dim small">{rs === 'active' ? F.pct(rp?.progress ?? 0) : rs}</span></div>;
          })}
        </div>
      )}
      {(n.options?.length || children.length) ? (
        <div className="sec">
          <div className="k">Unlocks</div>
          {(n.options ?? []).map(([slot, v]) => (
            <div key={slot + v} className="row-i small">{slot === 'effort' ? <ICON.deploy size={12} /> : <ICON.run size={12} />}<span>{SLOT_LABEL[slot]}: <b>{v === 'true' ? 'on' : F.words(v)}</b></span><span className="sp" />
              <Ref id="designOption" to={{ panel: slot === 'effort' ? 'products' : 'blueprint' }}>{slot === 'effort' ? 'Products' : 'Blueprint'}</Ref></div>
          ))}
          {children.length > 0 && <div className="dim small">Leads to {children.map((c) => PROJECT_BY_ID[c]?.name ?? c).join(', ')}</div>}
        </div>
      ) : null}
      <div className="sec btn-row">
        {project && st !== 'known' && <ActBtn id="research.start" params={{ id: n.id }} label="Start now" testId={`research.start.${n.id}`} />}
        {project && st !== 'known' && ready === true && <button className="btn btn-sm" data-test="assign-open" onClick={() => setUi('pick', n.id)}><ICON.staff size={13} /> Assign teams</button>}
        {project && st !== 'known' && !queued && <ActBtn id="research.queue" params={{ id: n.id }} label="Queue" testId={`research.queue.${n.id}`} />}
        {queued && <ActBtn id="research.dequeue" params={{ id: n.id }} label="Drop" testId={`research.dequeue.${n.id}`} />}
        {project && ready !== true && st !== 'known' && <span className="dim small">{ready}</span>}
        {line && st !== 'known' && <span className="dim small">Each result is a working tool, a weaker result, a dead end or a discovery; the project repeats until the tool works.</span>}
        {n.soon && <span className="dim small">A product feature: it becomes a project with live products.</span>}
      </div>
    </div>
  );
}

// ───────── team picker (L2) ─────────
function TeamPicker({ s, id }: { s: GameStateV2; id: string }) {
  const n = PROJECT_BY_ID[id];
  const before = projectEta(s, id);
  const teams = projectTeams(s, nodeDept(n));
  return (
    <div className="rs-picker" data-test="team-picker">
      <div className="row-i hd"><ICON.staff size={15} /><b>Add a team · {n.name}</b><span className="rs-chip" style={{ color: laneColor(n.column) }}>{COLUMN_LABEL[n.column]}</span><span className="sp" />
        <button className="btn btn-sm btn-ghost" data-test="picker-close" onClick={() => setUi('pick', '')}><X size={14} /></button></div>
      <div className="rs-prow head"><span /><span>Team · now on</span><span><Term id="specialtyBonus">Bonus</Term></span><span>This project</span><span>Cost elsewhere</span><span /></div>
      {teams.map((t) => {
        const on = t.projectId === id;
        const mult = t.specialty === n.column ? 1.5 : 1;
        const after = on ? before : projectEta(s, id, projectCapacity(s, id, t));
        const from = t.projectId && !on ? t.projectId : undefined;
        const Ic = t.specialty ? COL_ICON[t.specialty] : ICON.roleSci;
        return (
          <div key={t.id} className={`rs-prow ${on ? 'on' : ''}`} data-team={t.id}>
            <Ic size={15} />
            <span className="ellip"><b>{teamName(t)} {teamNo(s, t)}</b> <Tip content={() => <TipCard title={<Term id="teamQuality">Quality</Term>} value={QUALITY[t.quality].label} rows={[{ label: 'Output', value: `×${QUALITY[t.quality].out}` }, { label: 'People', value: String(Math.round(t.heads)) }]} />}><QDots q={t.quality} /></Tip><br /><span className="dim small">{from ? PROJECT_BY_ID[from]?.name : on ? 'on this project' : 'idle'}</span></span>
            <Tip content={() => <TipCard title={<Term id="specialtyBonus">Specialty bonus</Term>} value={`×${mult.toFixed(1)}`} rows={[{ label: 'Quality', value: `×${QUALITY[t.quality].out}` }, { label: 'People', value: String(Math.round(t.heads)) }, { label: 'Capacity here', value: teamCapacity(t, n).toFixed(2) }]}>×1.5 in the team's own column, ×1.0 elsewhere.</TipCard>}>
              <span className={`rs-mult ${mult > 1 ? 'm' : 'n'}`}>×{mult.toFixed(1)}</span>
            </Tip>
            <span className="num small">{on ? eta(before) : <>{eta(before)} → <b className="tone-pos">{eta(after)}</b></>}</span>
            <span className="num small">{from ? <span className="tone-neg">{PROJECT_BY_ID[from]?.name.split(' ')[0]} {eta(projectEta(s, from))} → {eta(projectEta(s, from, projectCapacity(s, from, undefined, t.id)))}</span> : <span className="dim">—</span>}</span>
            {on ? <ActBtn id="research.unassign" params={{ team: t.id }} label="Take off" testId={`research.unassign.${t.id}`} /> : <ActBtn id="research.assign" params={{ team: t.id, id }} label="Assign" testId={`research.assign.${t.id}`} />}
          </div>
        );
      })}
      <div className="row-i small dim ft">
        {idleTeams(s).length === 0 ? <>No idle science teams · hire one in <Ref id="hiring" to={{ panel: 'company', tab: 'people' }}>Company</Ref></> : <>{idleTeams(s).length} idle</>}
        <span className="sp" />{nodeDept(n) === 'saf' ? 'Safety scientists work the safety columns.' : 'Capabilities scientists work the capability columns.'}
      </div>
    </div>
  );
}

// ───────── projects and queue (L1) ─────────
function Projects({ s }: { s: GameStateV2 }) {
  const q = s.player.research.queue;
  const active = q.filter((id) => teamsOn(s, id).length > 0);
  const idle = idleTeams(s);
  const auto = s.player.research.autoAssign;
  const nSci = projectTeams(s).length;
  return (
    <Card className="rs-proj" home="projects" title={<span className="row-i"><ICON.experiments size={14} /> Active projects</span>}
      sub={<span><Tip content={() => <TipCard title="Active projects" rows={[{ label: 'Projects with a team', value: String(active.length) }, { label: 'Science teams', value: String(nSci) }, { label: 'Idle', value: String(idle.length) }]} />}><span>{active.length} · {nSci} science teams</span></Tip>{idle.length ? <Tip content={() => <TipCard title="Idle science teams" value={String(idle.length)}>{q.some((id) => projectReady(s, id) === true) ? 'Turn on auto-assign or assign them by hand.' : 'Nothing ready in the queue: click an idea in the tree and queue it.'}</TipCard>}><span className="tone-warn" data-test="idle-teams"> · {idle.length} idle</span></Tip> : null}</span>}
      right={(
        <Tip content={() => <TipCard title={<Term id="autoAssign">Auto-assign idle teams</Term>} value={auto ? 'on' : 'off'}>Idle science teams join the highest-priority ready project in their specialty, else the one with least capacity. A ready project with no team takes one from the largest project.</TipCard>}>
          <button className={`toggle ${auto ? 'on' : ''}`} data-test="auto-assign" onClick={() => store.act('research.autoAssign', { on: !auto })}><span className="toggle-knob" /><span className="toggle-label">Auto-assign idle teams</span></button>
        </Tip>
      )}>
      {active.length === 0 ? <div className="dim small rs-empty">No active projects. Click an idea in the tree, then Start now.</div> : (
        <div className="rs-pcards">
          {active.map((id) => {
            const n = PROJECT_BY_ID[id];
            const ts = teamsOn(s, id);
            const p = s.player.tree[id]?.status === 'researching' ? s.player.tree[id].progress : 0;
            const Ic = COL_ICON[n.column];
            const match = ts.some((t) => t.specialty === n.column);
            return (
              <div key={id} className="rs-pcard" data-project={id} style={{ ['--lc' as string]: laneColor(n.column) }}>
                <div className="nm" onClick={() => setUi('sel', id)}><Ic size={13} /><span>{n.name}</span></div>
                <div className="rs-tchips">
                  {ts.map((t) => {
                    const TI = t.specialty ? COL_ICON[t.specialty] : ICON.roleSci;
                    return <Tip key={t.id} content={() => <TipCard title={teamName(t)} value={`×${(t.specialty === n.column ? 1.5 : 1).toFixed(1)}`} rows={[{ label: 'Quality', value: QUALITY[t.quality].label }, { label: 'People', value: String(Math.round(t.heads)) }]}><ActBtn id="research.unassign" params={{ team: t.id }} label="Take off" /></TipCard>}><span className={`rs-tch ${t.quality === 'elite' ? 'el' : ''}`} data-team={t.id}><TI size={12} /></span></Tip>;
                  })}
                  {match && <Term id="specialtyBonus"><span className="rs-mxb">×1.5</span></Term>}
                  <button className="rs-tch add" data-test={`add-team.${id}`} onClick={() => setUi('pick', id)}>+</button>
                </div>
                <div className="pr"><div className="rs-bar"><i style={{ width: `${p * 100}%` }} /></div><Tip content={() => <TipCard title="Progress" value={F.pct(p)}>Share of the project done.</TipCard>}><b className="num">{F.pct(p)}</b></Tip></div>
                <div className="ft">ETA <span className="sp" /><Tip content={() => <TipCard title="ETA" value={eta(projectEta(s, id))} rows={ts.map((t) => ({ label: teamName(t), value: `×${(t.specialty === n.column ? 1.5 : 1).toFixed(1)}` }))}>At today's teams and research speed; extra teams add less each (diminishing returns).</TipCard>}><span className="num">{eta(projectEta(s, id))}</span></Tip></div>
                {/* Jank R5: safety lines show their health, capability ideas their odds (two different readings, two labels). */}
                <div className="ft">{isLineNode(n) ? <Term id="lineHealth">health</Term> : <Term id="odds">odds</Term>} <span className="sp" /><Tip content={() => <TipCard title={isLineNode(n) ? <Term id="lineHealth">Line health</Term> : <Term id="odds">Odds</Term>} value={isLineNode(n) ? health(nodeOdds(s, id)) : F.pct(nodeOdds(s, id))}>{isLineNode(n) ? 'How likely a result here is a working tool, from the results so far.' : 'Chance the idea works when the project finishes.'}</TipCard>}><span className="num">{isLineNode(n) ? health(nodeOdds(s, id)) : F.pct(nodeOdds(s, id))}</span></Tip></div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function Queue({ s }: { s: GameStateV2 }) {
  const q = s.player.research.queue;
  const waiting = q.filter((id) => teamsOn(s, id).length === 0);
  return (
    <Card className="rs-queue" home="queue" title={<span className="row-i"><Term id="projectQueue">Queue</Term></span>} sub={waiting.length ? <Tip content={() => <TipCard title={<Term id="projectQueue">Queue</Term>} value={`${waiting.length} waiting`}>Ideas waiting for a free science team, in order.</TipCard>}><span>{waiting.length} waiting</span></Tip> : undefined}>
      {waiting.length === 0 ? <div className="dim small rs-empty">Empty. Queue ideas from the tree; idle teams take them in order.</div> : (
        <div className="rs-qlist">
          {waiting.map((id) => {
            const n = PROJECT_BY_ID[id];
            const r = projectReady(s, id);
            const i = q.indexOf(id);
            const p = s.player.tree[id]?.status === 'researching' ? s.player.tree[id].progress : 0;
            return (
              <div key={id} className="rs-qrow" data-queue={id}>
                <span className="rs-qn">{i + 1}</span>
                <span className="ellip" onClick={() => setUi('sel', id)}><span className="nm">{n.name}</span><br /><span className="w">{r === true ? (p > 0 ? `paused at ${F.pct(p)} · waits for a free team` : 'waits for a free team') : r}</span></span>
                <span className="sp" />
                <button className="btn btn-sm btn-ghost" disabled={i === 0} data-test={`queue-up.${id}`} onClick={() => store.act('research.move', { id, to: i - 1 })}><ChevronUp size={12} /></button>
                <button className="btn btn-sm btn-ghost" disabled={i === q.length - 1} onClick={() => store.act('research.move', { id, to: i + 1 })}><ChevronDown size={12} /></button>
                <button className="btn btn-sm btn-ghost" data-test={`queue-drop.${id}`} onClick={() => store.act('research.dequeue', { id })}><X size={12} /></button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function Research({ s }: { s: GameStateV2 }) {
  useV2();
  return (
    <div className="panel-v2 rs-panel" data-panel="research">
      <PanelHead icon={ICON.research} title="Research" sub={<KnowHow s={s} />} right={<Ref id="researchSpeed" to={{ panel: 'company' }}><ICON.M size={13} /> Research speed</Ref>} />
      <Tree s={s} />
      <div className="rs-bottom">
        <Projects s={s} />
        <Queue s={s} />
      </div>
    </div>
  );
}
