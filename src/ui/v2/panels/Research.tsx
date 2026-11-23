// Research (STRUCTURE §4.2, MODEL-V3 §5, design/V3-BUILD.md "V2b UI"; mockups-v3/v3-v2b-research, v3-research*).
// Tabs: Projects (L1: the capability priority list with teams wanted, stage tracks and the risk policy; L2: the selected
// project's card), Recipe (the recipe stacks, headroom, adopted ideas), Tree (the discovery map: lanes = science
// specialties, left → right by depth from what you know; L2: the node card). L3: tooltips.
// One home per datum: a project's stage, beliefs and inputs on Projects; idea state on the tree node; the recipe on
// Recipe; research speed on Company › Flow and research engineers' needs on Company › Work (links only).
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Building2, CircleCheck, CircleDashed, CircleX, Hourglass, Layers, LoaderCircle, WandSparkles, Wrench, X } from 'lucide-react';
import {
  effortClassOf, effortOfNode, isCapProject, missingNeeds, nodeOdds, nodeStatus, projectCapacity, projectEta, projectReady, stagesOf, teamsOn, treeCounts,
} from '../../../engine/v2';
import type { Column, GameStateV2, NodeStatus } from '../../../engine/v2';
import { PICK_AT } from '../../../data/v2/research';
import { SAFETY_COLUMNS, TREE, TREE_CHILDREN, PROJECT_BY_ID, isLineNode, optionsOf, type Layer, type TreeNodeDef } from '../../../data/v2/tree';
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { COLUMNS, COLUMN_LABEL } from '../../../data/v2/teams';
import { store, useV2 } from '../store';
import { ActBtn, Term, Tip, TipCard } from '../ui';
import { Card, PanelHead, Ref, tabOf, Tabs } from '../kit';
import { ICON } from '../icons';
import { C } from '../theme';
import * as F from '../fmt';
import { Priorities, ProjectCard } from './ResearchProjects';
import { Recipe } from './Recipe';
import './research.css';

const COL_ICON: Record<Column, typeof ICON.L> = { pretraining: ICON.colPretraining, posttraining: ICON.colPosttraining, systems: ICON.colSystems, alignment: ICON.colAlignment, interp: ICON.colInterp, evals: ICON.colEvals };
const LAYER_TERM: Record<Layer, string> = { backbone: 'layerBackbone', training: 'layerTraining', scaffold: 'layerScaffold', lab: 'layerLab' };
/** VOCAB: where an idea takes effect, in words (no layer badges). */
const LAYER_NAME: Record<Layer, string> = { backbone: 'new base model', training: 'next post-training', scaffold: 'a build', lab: 'at once' };
/** VOCAB node states in words. */
const STATUS_WORD: Record<NodeStatus, string> = { known: 'Known', open: 'Available', locked: 'Locked', queued: 'Queued', active: 'Researching', failed: 'Failed', soon: 'Needs a product' };
/** Staff time in team-weeks (VOCAB §1: one spelling; the engine counts team-months). */
const tw = (months: number) => `${F.num(months * 52 / 12, 0)} team-weeks`;
const LAYER_ICON: Record<Layer, typeof Layers> = { backbone: Layers, training: WandSparkles, scaffold: Wrench, lab: Building2 };
const EFFORT_WORD: Record<string, string> = { S: 'small', M: 'medium', L: 'large', XL: 'very large' };
const EFFORT_DOTS: Record<string, string> = { S: '·', M: '··', L: '···', XL: '····' };
const SLOT_LABEL: Record<string, string> = { shape: 'Architecture', data: 'Data', curation: 'Data filter', pref: 'Preference', rlFocus: 'Post-training focus', graders: 'Graders', tpp: 'Tokens per parameter', cot: 'Reasoning', effort: 'Thinking effort' };
const capCol = (c: Column) => !SAFETY_COLUMNS.includes(c);
const laneColor = (c: Column) => (capCol(c) ? C.cap : C.und);

const ui = (k: string, d = '') => store.tab[`research.${k}`] ?? d;
const setUi = (k: string, v: string) => store.setTab(`research.${k}`, v);
const eta = (d: number) => (Number.isFinite(d) ? F.days(d) : '—');
/** A safety programme's outlook from its estimated chance of a working result (Safety › Research is home). */
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

/** RD-B18 (B31): a node's work as the engine runs it (effortOfNode), as tooltip rows. */
function effortRows(n: TreeNodeDef): { label: ReactNode; value: string }[] {
  const e = effortOfNode(n);
  if (e.unit === 'months') return [{ label: <Term id="seriousStaffing">To a result at serious staffing</Term>, value: `${F.num(e.sci + e.exp, 1)} mo (ideas ${F.num(e.sci, 1)}, tests ${F.num(e.exp, 1)})` }];
  if (!isCapProject(n)) return [{ label: <Term id="teamMonth">Staff time</Term>, value: tw(e.sci) }];
  return [
    { label: <Term id="stageIdeation">{`Scientists: ${PICK_AT} ideas to test`}</Term>, value: tw(e.sci) },
    { label: <Term id="stageSmall">Research engineers: small and big tests</Term>, value: tw(e.exp) },
  ];
}

// ───────── tree ─────────
function NodeBox({ s, n, st, sel, qn }: { s: GameStateV2; n: TreeNodeDef; st: NodeStatus; sel: boolean; qn: number }) {
  const ts = s.player.tree[n.id];
  const p = ts?.status === 'researching' ? ts.progress : 0;
  const miss = st === 'locked' ? missingNeeds(s, n.id) : [];
  let meta: ReactNode = null;
  // Jank R3/R4: layer and effort as icons with tooltips, odds as the only number; nothing truncated without a tooltip.
  const odds = !n.soon ? (isLineNode(n) ? health(nodeOdds(s, n.id)) : n.kind === 'line' ? 'programme' : F.pct(nodeOdds(s, n.id))) : '';
  const cls = effortClassOf(n);
  const effortTip = () => <TipCard title={<Term id="effortClass">Size</Term>} value={EFFORT_WORD[cls]} rows={effortRows(n)}>{effortOfNode(n).unit === 'months' ? 'Months to a result with serious staffing; more teams, safety research engineers, compute and AI staff shorten it.' : "At the leading lab's July 2025 inputs; more teams, research engineers and compute shorten it."}</TipCard>;
  if (st === 'open') meta = <>{n.effort && <Tip content={effortTip}><span className="eff" data-effort={cls}><Hourglass size={10} />{EFFORT_DOTS[cls]}</span></Tip>}{odds && <Tip content={() => <TipCard title={<Term id="odds">{isLineNode(n) ? 'Outlook' : 'Chance it works'}</Term>} value={odds}>{isLineNode(n) ? 'Outlook: how likely this programme is to produce working results.' : n.kind === 'line' ? 'A capability programme: it always produces results, each worth less than the last.' : 'Your current odds this works.'}</TipCard>}><span className="eo">{odds}</span></Tip>}</>;
  else if (st === 'locked') meta = <Tip content={() => <TipCard title="Needs first" rows={miss.map((m) => ({ label: PROJECT_BY_ID[m]?.name ?? m, value: STATUS_WORD[nodeStatus(s, m)] }))} />}><span className="eo warn">needs {miss.length > 1 ? `${miss.length} ideas` : PROJECT_BY_ID[miss[0]]?.name ?? miss[0]}</span></Tip>;
  else if (st === 'queued') meta = <span className="rs-qn">{qn}</span>;
  else if (st === 'active') meta = <Tip content={() => <TipCard title="Progress" value={F.pct(p)}>{isCapProject(n) ? 'Through its stages; stage, expected effect and ETA are on Portfolio.' : 'Share of the project done; ETA is on Safety › Research.'}</TipCard>}><span className="eo">{F.pct(p)}</span></Tip>;
  else if (st === 'failed' && isCapProject(n)) meta = <Tip content={() => <TipCard title={<Term id="reopenSpeculative">Failed</Term>} value={F.pct(nodeOdds(s, n.id))}>Three ideas were dropped. Retry it at this chance.</TipCard>}><span className="eo neg">failed · retry</span></Tip>;
  else if (st === 'soon') meta = <span className="eo">needs a product</span>;
  const LayerIc = LAYER_ICON[n.layer];
  return (
    <div className={`rs-node st-${st} ${sel ? 'sel' : ''}`} data-node={n.id} data-status={st} onClick={() => setUi('sel', sel ? '' : n.id)}>
      <Tip as="div" content={() => <TipCard title={n.name} />}><div className="nm"><StatusIcon st={st} p={p} /><span>{n.name}</span></div></Tip>
      <div className="mt"><Fx n={n} /><Tip content={() => <TipCard title={<Term id={LAYER_TERM[n.layer]}>{`Takes effect: ${LAYER_NAME[n.layer]}`}</Term>} />}><span className="lay"><LayerIc size={10} /></span></Tip>{meta}</div>
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
    <Card className="rs-tree" home="tree" title={<span className="row-i"><ICON.experiments size={14} /> <Term id="techTree">Discoveries</Term></span>}
      sub={<span data-test="tree-count">{view === 'frontier' ? 'around what you know' : 'all discoveries'} · {known} of {total} known</span>}
      right={(
        <span className="rs-tools">
          <span className="seg" data-test="tree-filter">
            {(['all', 'cap', 'saf'] as const).map((f) => <button key={f} className={`seg-btn ${filter === f ? 'active' : ''}`} data-opt={f} onClick={() => setUi('filter', f)}>{f === 'all' ? 'All' : f === 'cap' ? 'Capability' : 'Safety'}</button>)}
          </span>
          <span className="rs-lgd">
            <span className="rs-fx cu"><ICON.capabilities size={11} />▲</span>capability
            <span className="rs-fx su"><ICON.safety size={11} />▲</span>safety
            <span className="rs-fx dn">▼</span>cost
            <Term id="layer">takes effect</Term>
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
    <Tip content={() => <TipCard title="All discoveries" value={view === 'frontier' ? 'click: show all' : 'click: around what you know'}>Every discovery, by field (rows) and steps from what you know (columns). Green known, blue researching, amber queued, grey available, dark locked.</TipCard>}>
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
  const cap = isCapProject(n);
  const sg = stagesOf(n);
  const odds = nodeOdds(s, n.id);
  const teams = teamsOn(s, n.id);
  const etaNow = projectEta(s, n.id);
  const etaOne = projectEta(s, n.id, 1);
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
        <span className="rs-chip"><Term id={LAYER_TERM[n.layer]}>{`Takes effect: ${LAYER_NAME[n.layer]}`}</Term></span>
        <span className={`rs-chip st-${st}`}>{STATUS_WORD[st]}{queued && st === 'queued' ? ` #${s.player.research.queue.indexOf(n.id) + 1}` : ''}</span>
      </div>
      <div className="sec">
        <div className="k">Effect</div>
        {efRow(<ICON.capabilities size={13} style={{ color: C.cap }} />, 'Capability', n.cap ?? 'none', n.fx.cap && n.fx.cap < 0 ? 'tone-neg' : '')}
        {efRow(<ICON.safety size={13} style={{ color: C.und }} />, 'Safety', n.saf, n.fx.saf && n.fx.saf < 0 ? 'tone-neg' : 'tone-pos')}
        {efRow(<ICON.cash size={13} />, 'Cost', n.cost, 'tone-warn')}
        {n.payoff && <div className="rs-efrow"><span><ICON.M size={13} /></span><span className="dim">Pays off</span><span>{n.payoff}</span></div>}
      </div>
      <div className="sec">
        <div className="k"><Term id="odds">{line && !n.star ? 'Outlook' : 'Chance it works'}</Term></div>
        {line && !n.star
          ? <div className="row-i"><b className="num">{health(odds)}</b><span className="dim small">estimated {F.pct(odds)} that a result here works</span><Ref id="lineHealth" to={{ panel: 'safety', tab: 'lines' }}>{AGENDA_BY_ID[n.agenda as keyof typeof AGENDA_BY_ID]?.name ?? 'Safety programme'}</Ref></div>
          : n.star ? <div className="dim">Known by every lab</div>
          : cap && n.kind === 'line' ? <div className="dim small">A capability programme: always produces results, each worth less than the last (<Term id="linePool">returns falling</Term>).</div>
          : <div className="row-i"><b className="num">{F.pct(odds)}</b><span className="dim small">{n.paradigm ? 'known chance; whether it works is drawn at the start' : 'chance it works'}{(ts?.cap?.spec ?? 0) > 0 ? ` · retry ${ts?.cap?.spec}` : ''}</span>
            </div>}
      </div>
      {project && cap && (
        <div className="sec">
          <div className="k"><Term id="projectKind">{n.kind === 'line' ? 'Programme' : 'Project'}</Term></div>
          <Tip as="div" content={() => <TipCard title={<Term id="projectStage">Stages</Term>} rows={[
            { label: <Term id="stageIdeation">Ideas, for each test</Term>, value: tw(sg.idea) },
            { label: <Term id="stageSmall">Small test</Term>, value: tw(sg.small) },
            { label: <Term id="stageScale">Big test</Term>, value: tw(sg.scale) },
          ]}>At the leading lab's July 2025 inputs; your teams, research engineers and compute set the speed (Portfolio tab).</TipCard>}>
            <div className="row-i small"><span className="lay">{EFFORT_WORD[effortClassOf(n)] ?? effortClassOf(n)}</span><span><Term id="teamMonth">team-weeks</Term> per stage: <b className="num">{F.num(sg.idea * 52 / 12, 0)} · {F.num(sg.small * 52 / 12, 0)} · {F.num(sg.scale * 52 / 12, 0)}</b></span></div>
          </Tip>
        </div>
      )}
      {project && !cap && (
        <div className="sec">
          <div className="k"><Term id="effortClass">Size</Term></div>
          <Tip as="div" content={() => (
            <TipCard title="ETA" value={eta(etaNow)} rows={[
              { label: 'Capacity', value: projectCapacity(s, n.id).toFixed(2) },
              ...(line ? [] : [{ label: <Term id="diminishingReturns">Speed (more teams help less each)</Term>, value: `×${Math.sqrt(projectCapacity(s, n.id)).toFixed(2)}` }]),
              ...effortRows(n),
            ]}>Capacity: your teams' people and quality, ×1.5 for a team in its own field. {line ? 'ETA to the next result; safety research engineers, compute and AI share allowed speed it up.' : "ETA at today's research speed."}</TipCard>
          )}>
            <div className="row-i"><span className="lay">{EFFORT_WORD[effortClassOf(n)] ?? effortClassOf(n)}</span><b className="num">{F.num((effortOfNode(n).sci + effortOfNode(n).exp) * (line ? 1 : 52 / 12), 0)}</b>{line ? <Term id="seriousStaffing">months at serious staffing</Term> : <Term id="teamMonth">team-weeks</Term>}<span className="sp" />
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
            return <div key={r} className="rs-prq" onClick={() => setUi('sel', r)}><StatusIcon st={rs} p={rp?.progress} /><span>{PROJECT_BY_ID[r]?.name ?? r}</span><span className="sp" /><span className="dim small">{rs === 'active' ? F.pct(rp?.progress ?? 0) : STATUS_WORD[rs]}</span></div>;
          })}
        </div>
      )}
      {(optionsOf(n.id).length || children.length) ? (
        <div className="sec">
          <div className="k">Unlocks</div>
          {optionsOf(n.id).map(([slot, v]) => (
            <div key={slot + v} className="row-i small">{slot === 'effort' ? <ICON.deploy size={12} /> : <ICON.run size={12} />}<span>{SLOT_LABEL[slot]}: <b>{v === 'true' ? 'on' : F.words(v)}</b></span><span className="sp" />
              <Ref id="designOption" to={{ panel: slot === 'effort' ? 'products' : 'blueprint' }}>{slot === 'effort' ? 'Products' : 'Next run'}</Ref></div>
          ))}
          {children.length > 0 && <div className="dim small">Leads to {children.map((c) => PROJECT_BY_ID[c]?.name ?? c).join(', ')}</div>}
        </div>
      ) : null}
      <div className="sec btn-row">
        {cap && st === 'failed' && <ActBtn id="research.reopen" params={{ id: n.id }} label="Retry (lower odds)" testId={`research.reopen.${n.id}`} />}
        {project && st !== 'known' && st !== 'failed' && !queued && <ActBtn id="research.queue" params={{ id: n.id }} label={cap ? 'Add to priority list' : 'Queue'} testId={`research.queue.${n.id}`} />}
        {project && st !== 'known' && st !== 'failed' && <ActBtn id="research.start" params={{ id: n.id }} label={cap ? 'Top priority' : 'Start now'} testId={`research.start.${n.id}`} />}
        {queued && <ActBtn id="research.dequeue" params={{ id: n.id }} label="Remove" testId={`research.dequeue.${n.id}`} />}
        {cap && queued && <button className="btn btn-sm" data-test="open-project" onClick={() => { setUi('proj', n.id); store.setTab('research', 'projects'); }}>Open in Portfolio ›</button>}
        {!cap && project && !n.star && st !== 'known' && <Ref id="researchLine" to={{ panel: 'safety', tab: 'lines' }}>Safety teams</Ref>}
        {project && ready !== true && st !== 'known' && <span className="dim small">{ready}</span>}
        {line && st !== 'known' && <span className="dim small">Each result is a working instrument, a weaker result, a dead end or a discovery; the programme goes on until an instrument works.</span>}
        {n.soon && <span className="dim small">A product tool: it becomes a project once you have live products.</span>}
      </div>
    </div>
  );
}

export function Research({ s }: { s: GameStateV2 }) {
  useV2();
  const tab = tabOf('research', 'projects');
  return (
    <div className="panel-v2 rs-panel" data-panel="research">
      <PanelHead icon={ICON.research} title="Research" tabs={<Tabs panel="research" def="projects" tabs={[{ id: 'projects', label: 'Portfolio', icon: ICON.experiments }, { id: 'recipe', label: 'Know-how', icon: Layers }, { id: 'tree', label: 'Discoveries', icon: ICON.split }]} />}
        right={<span className="row-i"><Ref id="labSpeed" to={{ panel: 'company', tab: 'flow' }}><ICON.M size={13} /> Research speed</Ref><Ref id="reNeeds" to={{ panel: 'company', tab: 'work' }}><ICON.roleRE size={13} /> Research engineers</Ref></span>} />
      {tab === 'projects' && <div className="rp-grid"><Priorities s={s} /><ProjectCard s={s} /></div>}
      {tab === 'recipe' && <Recipe s={s} />}
      {tab === 'tree' && <Tree s={s} />}
    </div>
  );
}
