// Research (STRUCTURE §4.2; UB-6 / UB-8 / UB-A). Tabs: Portfolio (Portfolio.tsx: Limited by, the capability and safety
// board, the card drawer), Discoveries (here), Know-how (KnowHow.tsx: area bars, Waiting, Lab tools).
// Discoveries (UB-A; mockups design/ux/mockups/rd/discoveries.png, discoveries-drawer.png): one tree for capability and
// safety, one lane per field, columns by how far away a discovery is (Known · Can start now · One step away · Later).
// Each node: state, name, opens-N, output tag, one effect line, a downside mark. Chance it works and size live in the
// tooltip and the drawer (L2). A Researching node's stage and ETA home is its Portfolio card (link).
import { useEffect, type ReactNode } from 'react';
import { CircleCheck, CircleDashed, CircleX, GitBranch, Layers, LoaderCircle, Plus, TriangleAlert, Wrench, X } from 'lucide-react';
import { discoveryEtas, discoveryViews, effortOfNode, isCapProject, nodeStatus, projectReady } from '../../../engine/v2';
import type { Column, DiscoveryNodeView, DiscTag, GameStateV2, NodeStatus } from '../../../engine/v2';
import { SAFETY_COLUMNS, TREE_CHILDREN, PROJECT_BY_ID, isLineNode, lineNodeId, optionsOf, type Layer, type TreeNodeDef } from '../../../data/v2/tree';
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import { COLUMNS, COLUMN_LABEL } from '../../../data/v2/teams';
import { store, useV2 } from '../store';
import { ActBtn, Term, Tip, TipCard } from '../ui';
import { PanelHead, Ref, tabOf, Tabs } from '../kit';
import { ICON } from '../icons';
import * as F from '../fmt';
import { AddProject, Portfolio } from './Portfolio';
import { KnowHow } from './KnowHow';
import { AREA_NAME, COL_ICON, dispName } from './researchWords';
import { nodeWords } from './discoveryWords';

import './research.css';

const LAYER_TERM: Record<Layer, string> = { backbone: 'layerBackbone', training: 'layerTraining', scaffold: 'layerScaffold', lab: 'layerLab' };
/** VOCAB: where an idea takes effect, in words. */
const LAYER_NAME: Record<Layer, string> = { backbone: 'new base model', training: 'next post-training', scaffold: 'a build', lab: 'at once' };
/** VOCAB node states in words. */
const STATUS_WORD: Record<NodeStatus, string> = { known: 'known', open: 'can start now', locked: 'locked', queued: 'on your Priority list', active: 'researching', failed: 'failed', soon: 'needs a product' };
const EFFORT_WORD: Record<string, string> = { S: 'small', M: 'medium', L: 'large', XL: 'very large' };
/** Staff time in team-weeks (VOCAB §1: one spelling; the engine counts team-months). */
const tw = (months: number) => `${F.num(months * 52 / 12, 0)} team-weeks`;
const capCol = (c: Column) => !SAFETY_COLUMNS.includes(c);
/** "The other road": two discoveries that are one choice in the run plan (reasoning modes). */
const ROADS: Record<string, string> = { P17: 'P23', P23: 'P17' };
const ROAD_WORD: Record<string, { word: string; tone: string }> = { P17: { word: 'thinking unreadable', tone: 'tone-warn' }, P23: { word: 'thinking stays readable', tone: 'tone-pos' } };
/** Extra "also touches" instruments where a discovery changes another lab asset (Neuralese blinds the reasoning monitor). */
const TOUCHES: Record<string, string[]> = { P17: ['T-COTMON'], P23: ['T-COTMON'] };

const ui = (k: string, d = '') => store.tab[`research.${k}`] ?? d;
const setUi = (k: string, v: string) => store.setTab(`research.${k}`, v);
const eta = (d: number) => (Number.isFinite(d) ? `~${F.days(d)}` : '—');
const oddsWord = (p: number) => (p >= 0.66 ? 'likely' : p >= 0.4 ? 'about even' : p >= 0.2 ? 'unlikely' : 'a long shot');
const name = (id: string) => dispName(PROJECT_BY_ID[id]?.name ?? id);

function StatusIcon({ st, p }: { st: NodeStatus; p?: number }) {
  if (st === 'known') return <CircleCheck size={12} className="tone-pos" />;
  if (st === 'active') return <span className="rs-ring" style={{ ['--p' as string]: Math.round((p ?? 0) * 100) }} />;
  if (st === 'failed') return <CircleX size={12} className="tone-neg" />;
  if (st === 'locked') return <ICON.locked size={11} />;
  if (st === 'queued') return <LoaderCircle size={12} className="tone-warn" />;
  return <CircleDashed size={12} />;
}

function TagChip({ tag }: { tag: DiscTag }) {
  return <span className={`tagx ${tag}`} data-tag={tag}>{tag}</span>;
}

/** RD-B18 (B31): a node's work as the engine runs it (effortOfNode), as tooltip rows. */
function effortRows(n: TreeNodeDef): { label: ReactNode; value: string }[] {
  const e = effortOfNode(n);
  if (e.unit === 'months') return [{ label: <Term id="seriousStaffing">To a result at serious staffing</Term>, value: `${F.num(e.sci + e.exp, 1)} mo` }];
  if (!isCapProject(n)) return [{ label: <Term id="teamMonth">Staff time</Term>, value: tw(e.sci) }];
  return [
    { label: <Term id="stageIdeation">Scientists: ideas to test</Term>, value: tw(e.sci) },
    { label: <Term id="stageSmall">Research engineers: tests</Term>, value: tw(e.exp) },
  ];
}

/** The chip's hover (L3): chance, effect, downside, needs. */
function NodeTip({ s, v }: { s: GameStateV2; v: DiscoveryNodeView }) {
  const n = PROJECT_BY_ID[v.id];
  const w = nodeWords(v.id);
  const rows: { label: ReactNode; value: ReactNode; tone?: 'pos' | 'neg' }[] = [];
  if (v.status !== 'known') rows.push({ label: <Term id="odds">Chance it works</Term>, value: F.pct(v.odds) });
  if (w.line) rows.push({ label: 'Gives', value: w.line });
  if (w.risk) rows.push({ label: <Term id="discDownside">Downside</Term>, value: w.risk, tone: 'neg' });
  rows.push({ label: <Term id="layer">Takes effect</Term>, value: LAYER_NAME[n.layer] });
  for (const m of v.missing) rows.push({ label: 'Needs', value: `${name(m)} (${STATUS_WORD[nodeStatus(s, m)]})` });
  return <TipCard title={name(v.id)} value={STATUS_WORD[v.status]} rows={rows}>{w.desc ?? 'Click for what it gives, what it costs and what it needs.'}</TipCard>;
}

function NodeChip({ s, v, sel, dim }: { s: GameStateV2; v: DiscoveryNodeView; sel: boolean; dim: boolean }) {
  const w = nodeWords(v.id);
  const cap = v.tag === 'capability';
  let l2: ReactNode;
  if (v.status === 'locked') l2 = <>{!cap && <TagChip tag={v.tag} />}<span className="ef">needs <b>{v.missing.map(name).join(', ')}</b></span></>;
  else if (v.status === 'active') l2 = <>{!cap && <TagChip tag={v.tag} />}<span className="ef res">Researching{Number.isFinite(v.etaNow) ? ` · ${eta(v.etaNow)}` : ''}</span></>;
  else if (v.status === 'queued') l2 = <>{!cap && <TagChip tag={v.tag} />}<span className="ef">Priority list #{v.queuePos} · waits for a team</span></>;
  else if (v.status === 'failed') l2 = <Tip content={() => <TipCard title={<Term id="reopenSpeculative">Retry</Term>} value={F.pct(v.odds)}>Three ideas in a row were dropped. A retry is a bolder attempt at lower odds.</TipCard>}><span className="ef tone-neg">Failed · retry at {F.pct(v.odds)}</span></Tip>;
  else l2 = <>{!cap && <TagChip tag={v.tag} />}<span className="ef">{w.line}</span>{w.risk && <span className="rk" data-test="risk-mark"><TriangleAlert size={12} /></span>}</>;
  return (
    <Tip as="div" content={() => <NodeTip s={s} v={v} />}>
      <div className={`dc-nd ${cap ? 'ncap' : 'nsaf'} st-${v.status} ${sel ? 'sel' : ''} ${dim ? 'dimx' : ''}`} data-node={v.id} data-status={v.status} data-zone={v.zone}
        role="button" tabIndex={0} onClick={() => setUi('sel', sel ? '' : v.id)} onKeyDown={(e) => { if (e.key === 'Enter') setUi('sel', v.id); }}>
        <div className="l1"><span className="si"><StatusIcon st={v.status} p={v.progress} /></span><span className="nm">{name(v.id)}</span>
          {v.opens > 0 && v.status !== 'locked' && <span className="op" data-test="opens"><GitBranch size={12} />{v.opens}</span>}</div>
        <div className="l2">{l2}</div>
      </div>
    </Tip>
  );
}

const ZONES = [
  { k: 'now' as const, cls: 'z3' },
  { k: 'next' as const, cls: 'z2' },
  { k: 'later' as const, cls: 'z2' },
];

function Discoveries({ s }: { s: GameStateV2 }) {
  const views = discoveryViews(s);
  const filter = ui('filter', 'all');
  const sel = ui('sel');
  const count = (z: string) => views.filter((v) => v.zone === z).length;
  const dimOf = (v: DiscoveryNodeView) => (filter === 'cap' ? v.tag !== 'capability' : filter === 'saf' ? v.tag === 'capability' : false);
  return (
    <div className="card dc-tree" data-home="tree" data-test="tree">
      <div className="dc-zh">
        <div>Field</div>
        <Tip content={() => <TipCard title="Known" value={count('known')}>Public practice in July 2025 plus what your lab has found since.</TipCard>}><div><CircleCheck size={12} className="tone-pos" /> Known <b data-test="n-known">{count('known')}</b></div></Tip>
        <Tip content={() => <TipCard title="Can start now" value={count('now')}>Everything it needs is known: researching, on your list, failed (retry at lower odds) or free to start.</TipCard>}><div><CircleDashed size={12} /> Can start now <b data-test="n-now">{count('now')}</b><span className="nb">· starting one adds it to your <Term id="projectQueue">Priority list</Term></span></div></Tip>
        <Tip content={() => <TipCard title="One step away" value={count('next')}>Locked, but every discovery it still needs can start now.</TipCard>}><div><ICON.locked size={12} /> One step away <b data-test="n-next">{count('next')}</b></div></Tip>
        <Tip content={() => <TipCard title="Later" value={count('later')}>Two or more steps away.</TipCard>}><div><ICON.locked size={12} /> Later <b data-test="n-later">{count('later')}</b></div></Tip>
      </div>
      {COLUMNS.map((lane) => {
        const ns = views.filter((v) => PROJECT_BY_ID[v.id].column === lane);
        const known = ns.filter((v) => v.zone === 'known');
        return (
          <div key={lane} className="dc-lane" data-lane={lane}>
            <div className={`dc-field ${capCol(lane) ? 'cap' : 'saf'}`}><span className="sw" /><Term id="specialty">{COLUMN_LABEL[lane]}</Term></div>
            <div className="dc-known">{known.map((v) => (
              <Tip key={v.id} content={() => <TipCard title={name(v.id)} value="known" rows={nodeWords(v.id).line ? [{ label: 'Gives', value: nodeWords(v.id).line }] : []}>{PROJECT_BY_ID[v.id].star ? 'Public practice in July 2025: every lab knows it.' : 'Found by your lab.'}</TipCard>}>
                <span data-node={v.id} data-status="known" onClick={() => setUi('sel', v.id)}><CircleCheck size={12} />{name(v.id)}</span>
              </Tip>
            ))}</div>
            {ZONES.map((z) => (
              <div key={z.k} className={`dc-zone ${z.cls}`} data-zone={z.k}>
                {ns.filter((v) => v.zone === z.k).map((v) => <NodeChip key={v.id} s={s} v={v} sel={sel === v.id} dim={dimOf(v)} />)}
              </div>
            ))}
          </div>
        );
      })}
      {sel && PROJECT_BY_ID[sel] && <NodeDrawer s={s} v={views.find((x) => x.id === sel)} id={sel} />}
    </div>
  );
}

/** Legend and the All / Capability / Safety filter (panel header). */
function TreeTools() {
  const filter = ui('filter', 'all');
  return (
    <span className="dc-tools">
      <span className="dc-lgd">
        <span><CircleDashed size={12} />can start</span><span><span className="rs-ring" style={{ ['--p' as string]: 50 }} />researching</span>
        <span><CircleX size={12} className="tone-neg" />failed</span><span><ICON.locked size={12} />locked</span>
        <Tip content={() => <TipCard title="Capability">A discovery that makes models stronger or cheaper.</TipCard>}><span><TagChip tag="capability" /></span></Tip>
        <Tip content={() => <TipCard title={<Term id="outputTag">See / stop / fix</Term>}>What a safety discovery gives: see (an instrument), stop (a safeguard), fix (a training method); meta: AI staff on safety research.</TipCard>}><span><TagChip tag="see" /><TagChip tag="stop" /><TagChip tag="fix" /> safety</span></Tip>
        <Tip content={() => <TipCard title={<Term id="discDownside">Has a downside</Term>} />}><span><TriangleAlert size={12} className="tone-warn" />has a downside</span></Tip>
      </span>
      <span className="seg" data-test="tree-filter">
        {(['all', 'cap', 'saf'] as const).map((f) => <button key={f} className={`seg-btn ${filter === f ? 'active' : ''}`} data-opt={f} onClick={() => setUi('filter', f)}>{f === 'all' ? 'All' : f === 'cap' ? 'Capability' : 'Safety'}</button>)}
      </span>
    </span>
  );
}

// ───────── drawer (L2) ─────────
function NodeDrawer({ s, v, id }: { s: GameStateV2; v?: DiscoveryNodeView; id: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.tip')) setUi('sel', ''); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const n = PROJECT_BY_ID[id];
  const st = v?.status ?? nodeStatus(s, id);
  const w = nodeWords(id);
  const tag = v?.tag ?? 'capability';
  const Ic = COL_ICON[n.column];
  const line = isLineNode(n);
  const queued = s.player.research.queue.includes(id);
  const children = (TREE_CHILDREN[id] ?? []).filter((c) => PROJECT_BY_ID[c]);
  const e = st !== 'known' && !n.star ? discoveryEtas(s, id) : undefined;
  const road = ROADS[id];
  const ready = projectReady(s, id);
  // Portfolio is home of a researching / queued node's stage and ETA.
  const portfolioId = line && n.agenda ? lineNodeId(n.agenda) : id;
  const openPortfolio = () => { setUi('sel', ''); setUi('drawer', portfolioId); store.setTab('research', 'projects'); };
  const touches: ReactNode[] = [];
  const progs = new Set<string>();
  for (const t of [...(n.technique ? [n.technique] : []), ...(TOUCHES[id] ?? [])]) {
    const td = TECHNIQUE_BY_ID[t];
    if (!td) continue;
    touches.push(<Ref key={`i-${t}`} id={`touch.instrument.${t}`} to={{ panel: 'safety', tab: 'instruments' }}>{dispName(td.name)} · instrument</Ref>);
    const ag = AGENDA_BY_ID[td.agenda];
    if (ag && !progs.has(ag.id)) { progs.add(ag.id); touches.push(<Ref key={`p-${ag.id}`} id={`touch.programme.${ag.id}`} to={{ panel: 'research', tab: 'projects' }}>{dispName(ag.name)} · programme</Ref>); }
  }
  const stack = (n.effect as { stack?: keyof typeof AREA_NAME } | undefined)?.stack ?? (ROADS[id] ? 'pre' : undefined);
  if (stack) touches.push(<Ref key="kh" id={`touch.knowhow.${stack}`} to={{ panel: 'research', tab: 'knowhow' }}>{AREA_NAME[stack]} · know-how</Ref>);
  const opt = optionsOf(id)[0];
  if (opt) touches.push(<Ref key="opt" id={`touch.option.${id}`} to={{ panel: opt[0] === 'effort' ? 'products' : 'blueprint' }}>{opt[0] === 'effort' ? 'Thinking effort · Products' : 'Run plan option · Next run'}</Ref>);
  return (
    <>
      <div className="pf-scrim" onClick={() => setUi('sel', '')} />
      <aside className="pf-drawer dc-drawer" data-test="node-card" data-card={id} data-home="discoveryCard">
        <div className="pf-dh">
          <Ic size={20} className="dim" /><h2 data-test="drawer-title">{name(id)}</h2><span className="sp" />
          <button className="btn btn-sm btn-ghost" data-test="node-close" aria-label="Close" onClick={() => setUi('sel', '')}><X size={16} /></button>
        </div>
        <div className="row-i pf-chips">
          <Tip content={() => <TipCard title={<Term id="projectKind">Programme or project</Term>} />}><span className="kind">{n.kind === 'line' ? 'ongoing programme' : 'one-off project'}</span></Tip>
          <TagChip tag={tag} />
          <span className="dim">{COLUMN_LABEL[n.column]} · {STATUS_WORD[st]}</span>
        </div>
        {w.desc && <div className="pf-lead dc-desc">{w.desc}</div>}
        <div className={`dc-gv ${w.risk ? '' : 'one'}`}>
          <div className={`dc-gbox up ${tag === 'capability' ? '' : 'saf'}`} data-test="gives">
            <div className="cap">What it gives</div>
            {w.big ? <><Tip content={() => <TipCard title={<Term id="effCompute">What it gives</Term>} value={w.big}>The expected effect if it works; your evals measure the first model built with it.</TipCard>}><div className="big num">{w.big}</div></Tip><div className="un">{w.unit}</div></>
              : <div className="hd">{w.line || 'opens new discoveries'}</div>}
            {children.length > 0 && <div className="op"><GitBranch size={12} /> opens <b>{children.map(name).join(', ')}</b>{children.length === 1 && PROJECT_BY_ID[children[0]].kind === 'line' ? ', a new ongoing programme' : ''}</div>}
          </div>
          {w.risk && (
            <div className="dc-gbox dn" data-test="costs">
              <div className="cap">What it costs</div>
              <div className="hd"><TriangleAlert size={14} className="tone-warn" /> {w.risk[0].toUpperCase() + w.risk.slice(1)}</div>
              {w.riskText && <div className="tx">{w.riskText}</div>}
            </div>
          )}
        </div>
        <div className="pf-kv">
          {st !== 'known' && v && <>
            <span className="k"><Term id="odds">Chance it works</Term></span>
            <Tip content={() => <TipCard title={<Term id="odds">Chance it works</Term>} value={F.pct(v.odds)}>{line ? 'Your programme\'s estimated chance that a result works, from its results so far.' : st === 'failed' ? 'A retry is a bolder attempt: lower odds.' : 'Your current odds this works, from attempts so far.'}</TipCard>}>
              <span data-test="odds"><b className="num">{F.pct(v.odds)}</b> <span className="dim">{oddsWord(v.odds)}</span></span>
            </Tip>
          </>}
          {e && <>
            <span className="k"><Term id="effortClass">Size</Term></span>
            <Tip content={() => <TipCard title={<Term id="effortClass">Size</Term>} value={EFFORT_WORD[e.size]} rows={effortRows(n)}>At today's research speed{line ? '; for a safety idea, the time to its next result' : ''}. More teams help less each.</TipCard>}>
              <span data-test="size">{EFFORT_WORD[e.size]} · {st === 'active' && v && Number.isFinite(v.etaNow)
                ? <><b>{eta(v.etaNow)}</b> at today's teams</>
                : <><b>{eta(e.one)}</b> with 1 team · {eta(e.two)} with 2</>}</span>
            </Tip>
          </>}
          {n.needs.length > 0 && <>
            <span className="k">Needs</span>
            <span className="row-i dc-needs">{n.needs.map((r) => { const rs = nodeStatus(s, r); return <button key={r} className="dc-need" data-need={r} onClick={() => setUi('sel', r)}><StatusIcon st={rs} p={s.player.tree[r]?.progress} /> {name(r)}</button>; })}</span>
          </>}
          <span className="k"><Term id="layer">Takes effect</Term></span>
          <span><Term id={LAYER_TERM[n.layer]}>{LAYER_NAME[n.layer]}</Term></span>
        </div>
        {road && PROJECT_BY_ID[road] && (
          <div className="pf-sec" data-test="road">
            <div className="cap">The other road</div>
            <div className="dc-road">
              {[id, road].map((r) => {
                const rw = nodeWords(r);
                const rst = nodeStatus(s, r);
                const rv = discoveryViews(s).find((x) => x.id === r);
                const re = rst === 'known' ? undefined : discoveryEtas(s, r);
                return (
                  <button key={r} className={r === id ? 'this' : ''} data-road={r} onClick={() => setUi('sel', r)}>
                    <b>{name(r)}</b><span>{rw.big} effective compute</span><span className={ROAD_WORD[r].tone}>{ROAD_WORD[r].word}</span>
                    <Tip content={() => <TipCard title={name(r)} rows={rv && re ? [{ label: <Term id="odds">Chance it works</Term>, value: F.pct(rv.odds) }, { label: <Term id="effortClass">With 1 team</Term>, value: eta(re.one) }] : []} />}><span className="dim">{rv && re ? `${F.pct(rv.odds)} · ${eta(re.one)}` : 'known'}</span></Tip>
                  </button>
                );
              })}
            </div>
            <div className="dim small">Each becomes an option in the run plan; a model reasons one way or the other.</div>
          </div>
        )}
        {touches.length > 0 && <div className="pf-sec"><div className="cap">Also touches</div><div className="row-i dc-touch">{touches}</div></div>}
        <div className="dc-foot">
          {st === 'failed' && <ActBtn id="research.reopen" params={{ id }} label="Retry (lower odds)" testId={`research.reopen.${id}`} primary />}
          {(st === 'open' || st === 'locked') && !n.star && <>
            <ActBtn id="research.queue" params={{ id }} icon={Plus} label="Add to Priority list" testId={`research.queue.${id}`} primary small={false} />
            <span className="dim">{st === 'locked' ? 'what it needs goes in first' : 'goes in at the bottom'} · takes a science team when one is free</span>
          </>}
          {(queued || st === 'active') && <button className="btn btn-sm" data-test="open-project" onClick={openPortfolio}>Stage and ETA on Portfolio ›</button>}
          {queued && <ActBtn id="research.dequeue" params={{ id }} label="Remove" testId={`research.dequeue.${id}`} />}
          {st === 'queued' && ready !== true && <span className="dim small">{ready}</span>}
        </div>
      </aside>
    </>
  );
}

export function Research({ s }: { s: GameStateV2 }) {
  useV2();
  const raw = tabOf('research', 'projects');
  const tab = raw === 'recipe' ? 'knowhow' : raw;
  return (
    <div className="panel-v2 rs-panel" data-panel="research">
      <PanelHead icon={ICON.research} title="Research" tabs={<Tabs panel="research" def="projects" tabs={[{ id: 'projects', label: 'Portfolio', icon: ICON.experiments }, { id: 'tree', label: 'Discoveries', icon: ICON.split }, { id: 'knowhow', label: 'Know-how', icon: Layers }]} />}
        right={tab === 'projects' ? <AddProject s={s} />
          : tab === 'knowhow' ? <span className="row-i"><button className="ref-chip" data-ref="labTools" onClick={() => store.goto('research', { tab: 'knowhow', anchor: 'labTools' })}><Wrench size={12} /> Lab tools</button><Ref id="publishPolicy" to={{ panel: 'safety', tab: 'instruments', anchor: 'findings' }}>Publish policy</Ref></span>
          : <TreeTools />} />
      {tab === 'projects' && <Portfolio s={s} />}
      {tab === 'knowhow' && <KnowHow s={s} />}
      {tab === 'tree' && <Discoveries s={s} />}
    </div>
  );
}
