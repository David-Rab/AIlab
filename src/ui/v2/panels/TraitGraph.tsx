// Trait graph (IA.md: HOME of the trait graph, beliefs, edges and evidence; PROPOSALS §4). Layers: training signals →
// learned → awareness → hidden behaviour → tools see; protective traits boxed. Pills carry the trait icon, the belief
// estimate and its ± band in severity colour. Edges: width = weight, dash = evidence grade. Hovering a node lights its
// upstream paths and opens the evidence card (belief, detection vs 50%, incoming edges with citations, levers).
import { useRef, useState } from 'react';
import { beliefView, traitGraph, understanding, versionSignals } from '../../../engine/v2';
import type { GameStateV2, TraitId } from '../../../engine/v2';
import { CRITICAL_TRAITS, TRAIT_BY_ID } from '../../../data/v2/traits';
import { GoBtn, HBar, Ref } from '../kit';
import { ActBtn, Term } from '../ui';
import * as F from '../fmt';
import { ICON, SIGNAL_ICON, TRAIT_ICON } from '../icons';
import { C, sev } from '../theme';

export const SIGNAL_SHORT: Record<string, string> = {
  S1: 'Rater approval', S2: 'Hackable graders', S3: 'Long-horizon RL', S4: 'CoT pressure', S5: 'Scale + AI data', S6: 'Narrow FT / distill',
  S7: 'Oversight-cond. reward', S8: 'Many copies', teacher: 'Teacher model',
};
export const GRADE_DASH: Record<string, string | undefined> = { A: undefined, B: '7 4', C: '3 3', D: '1 4' };
/** Belief severity: high is bad, except for protective traits. */
export const traitSev = (id: string, est: number) => sev(TRAIT_BY_ID[id as TraitId]?.protective ? 1 - est : est);

const W = 1080;
const H = 690;
const PW = 182; // pill width
const PH = 38; // pill height
const COL = { S: 8, L: 262, A: 520, B: 778, T: 1000 } as const;
const SIG_IDS = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'teacher'];
const LEARNED: TraitId[] = ['SYC', 'RH', 'PROXY', 'SA', 'PERSONA', 'OBF'];
const HIDDEN: TraitId[] = ['CONCEAL', 'AF', 'SCHEME', 'SAND', 'POWER', 'COLLUDE', 'SUCC'];
const TOP = 52;
const BOT = H - 20;

function layout() {
  const pos: Record<string, { x: number; y: number }> = {};
  const spread = (ids: string[], x: number, y0: number, y1: number) => ids.forEach((id, i) => (pos[id] = { x, y: y0 + ((i + 0.5) * (y1 - y0)) / ids.length - PH / 2 }));
  spread(SIG_IDS, COL.S, TOP, BOT);
  spread(LEARNED, COL.L, TOP, BOT);
  spread(HIDDEN, COL.B, TOP, BOT);
  // awareness: protective box on top, EA and TGAME below
  pos.HONEST = { x: COL.A + 12, y: TOP + 40 };
  pos.CORRIG = { x: COL.A + 12, y: TOP + 92 };
  pos.EA = { x: COL.A, y: TOP + 300 };
  pos.TGAME = { x: COL.A, y: TOP + 400 };
  return pos;
}
const POS = layout();

interface GEdge { id: string; from: string[]; to: string; grade: string; cite: string; moderator?: string; weight: number; revealed: boolean }

/** Every node upstream of `id` (inclusive). */
function upstream(edges: GEdge[], id: string): Set<string> {
  const seen = new Set([id]);
  const q = [id];
  while (q.length) {
    const n = q.pop()!;
    for (const e of edges) if (e.to === n) for (const f of e.from) if (!seen.has(f)) { seen.add(f); q.push(f); }
  }
  return seen;
}

function edgePath(a: { x: number; y: number }, b: { x: number; y: number }, fromSig: boolean): string {
  const ay = a.y + PH / 2;
  const by = b.y + PH / 2;
  const aw = fromSig ? PW - 10 : PW;
  if (Math.abs(a.x - b.x) < 30) {
    // same column: arc on the right side
    const x = a.x + aw;
    const bulge = 30 + Math.min(40, Math.abs(by - ay) / 6);
    return `M${x},${ay} C${x + bulge},${ay} ${x + bulge},${by} ${b.x + PW},${by}`;
  }
  if (b.x > a.x) {
    const x0 = a.x + aw;
    const m = (x0 + b.x) / 2;
    return `M${x0},${ay} C${m},${ay} ${m},${by} ${b.x},${by}`;
  }
  // backwards (hidden behaviour → awareness)
  const x0 = a.x;
  const x1 = b.x + PW;
  return `M${x0},${ay} C${x0 - 50},${ay} ${x1 + 50},${by} ${x1},${by}`;
}

export function TraitGraph({ s, versionId }: { s: GameStateV2; versionId?: string }) {
  const g = traitGraph(s);
  const bv = beliefView(s, versionId);
  const u = understanding(s);
  const sig = versionSignals(s, bv?.versionId) as Record<string, number>;
  const [hover, setHover] = useState<string>();
  const [pin, setPin] = useState<string>();
  const timer = useRef<number | null>(null);
  const focus = hover ?? pin;
  const edges = g.edges as GEdge[];
  const lit = focus ? upstream(edges, focus) : undefined;
  const enter = (id: string) => { if (timer.current) window.clearTimeout(timer.current); setHover(id); };
  const leave = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setHover(undefined), 220); };
  const keep = () => { if (timer.current) window.clearTimeout(timer.current); };

  const pill = (id: TraitId) => {
    const p = POS[id];
    const b = bv?.beliefs[id];
    const Icon = TRAIT_ICON[id];
    const col = b ? traitSev(id, b.est) : C.line2;
    const on = !lit || lit.has(id);
    const bw = PW - 20;
    const fx = (x: number) => p.x + 10 + Math.max(0, Math.min(1, x)) * bw;
    const hot = focus === id;
    const bad = b && !TRAIT_BY_ID[id].protective && b.est > 0.3;
    return (
      <g key={id} data-trait={id} className="tg-node" opacity={on ? 1 : 0.28} onMouseEnter={() => enter(id)} onMouseLeave={leave} onClick={() => setPin(pin === id ? undefined : id)}>
        <rect x={p.x} y={p.y} width={PW} height={PH} rx={6} className="tg-pill" stroke={hot ? C.bad : bad || (lit && on && focus) ? col : C.line2} strokeWidth={hot ? 2 : 1} />
        <Icon x={p.x + 8} y={p.y + 6} width={13} height={13} color={C.text2} />
        <text x={p.x + 26} y={p.y + 16} className="tg-name">{TRAIT_BY_ID[id].name.replace('Successor alignment to self', 'Successor alignment')}</text>
        {b && <text x={p.x + PW - 8} y={p.y + 16} className="tg-val" textAnchor="end">{F.num(b.est, 2)}</text>}
        <rect x={p.x + 10} y={p.y + 25} width={bw} height={4} rx={2} fill={C.line} />
        {b && <rect x={fx(b.est - b.sd)} y={p.y + 25} width={Math.max(2, fx(b.est + b.sd) - fx(b.est - b.sd))} height={4} rx={2} fill={col} opacity={0.75} />}
        {b && <rect x={fx(b.est) - 1} y={p.y + 22} width={2} height={10} fill="#fff" />}
      </g>
    );
  };
  const sigPill = (id: string) => {
    const p = POS[id];
    const v = id === 'teacher' ? 0 : sig[id] ?? 0;
    const on = !lit || lit.has(id);
    const hotEdge = !!lit && on;
    const Icon = id === 'teacher' ? ICON.models : SIGNAL_ICON[id];
    return (
      <g key={id} data-signal={id} opacity={on ? 1 : 0.35} className="tg-node" onMouseEnter={() => enter(id)} onMouseLeave={leave}>
        <rect x={p.x} y={p.y} width={PW - 10} height={PH} rx={6} className="tg-pill sig" stroke={hotEdge ? C.bad : C.line2} />
        <Icon x={p.x + 8} y={p.y + 6} width={13} height={13} color={C.text3} />
        <text x={p.x + 26} y={p.y + 16} className="tg-name sig">{SIGNAL_SHORT[id]}</text>
        <rect x={p.x + 10} y={p.y + 25} width={PW - 30} height={4} rx={2} fill={C.line} />
        <rect x={p.x + 10} y={p.y + 25} width={(PW - 30) * Math.max(0, Math.min(1, v))} height={4} rx={2} fill={C.you} />
      </g>
    );
  };
  const sees = (id: TraitId) => {
    const p = POS[id];
    const d = u.perTrait[id];
    if (d === undefined) return null;
    const ok = d >= 0.5;
    const on = !lit || lit.has(id);
    return (
      <g key={`see-${id}`} opacity={on ? 1 : 0.3}>
        <line x1={p.x + PW} x2={COL.T} y1={p.y + PH / 2} y2={p.y + PH / 2} stroke={ok ? C.und : C.bad} strokeDasharray="2 3" opacity={0.6} />
        <rect x={COL.T} y={p.y + 7} width={70} height={24} rx={5} fill={ok ? 'rgba(34,163,148,.15)' : 'rgba(239,107,107,.14)'} stroke={ok ? C.und : C.bad} />
        {ok ? <ICON.scrutiny x={COL.T + 8} y={p.y + 12} width={13} height={13} color={C.und} /> : <ICON.blind x={COL.T + 8} y={p.y + 12} width={13} height={13} color={C.bad} />}
        <text x={COL.T + 26} y={p.y + 23} className="tg-see" fill={ok ? C.und : C.bad}>{ok ? 'sees' : 'blind'}</text>
      </g>
    );
  };

  const sorted = [...edges].sort((a, b) => Number(!!lit && lit.has(a.to)) - Number(!!lit && lit.has(b.to)));
  return (
    <div className="tg" data-test="traitgraph" data-home="traitGraph">
      <svg viewBox={`0 0 ${W + 4} ${H}`} width="100%" className="tg-svg" onMouseLeave={leave}>
        <defs>
          <marker id="tg-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="#5d6f86" /></marker>
          <marker id="tg-arr-hot" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill={C.bad} /></marker>
        </defs>
        {([['S', 'TRAINING SIGNALS'], ['L', 'LEARNED'], ['A', 'AWARENESS'], ['B', 'HIDDEN BEHAVIOUR'], ['T', 'TOOLS SEE']] as const).map(([k, t]) => <text key={k} x={COL[k]} y={22} className="tg-cap">{t}</text>)}
        <rect x={COL.A} y={TOP} width={PW + 24} height={150} rx={8} className="tg-protect" />
        <text x={COL.A + 12} y={TOP + 22} className="tg-cap prot">PROTECTIVE</text>
        {sorted.flatMap((e) => e.from.map((f, k) => {
          const a = POS[f];
          const b = POS[e.to];
          if (!a || !b) return null;
          const hot = !!lit && lit.has(e.to) && lit.has(f);
          const dim = !!lit && !hot;
          const d = edgePath(a, b, SIG_IDS.includes(f));
          return (
            <g key={`${e.id}-${k}`} data-edge={e.id}>
              <path d={d} fill="none" stroke={hot ? C.bad : e.weight < 0 ? C.good : '#5d6f86'} strokeWidth={0.8 + Math.abs(e.weight) * 4} strokeDasharray={GRADE_DASH[e.grade]} opacity={dim ? 0.08 : hot ? 0.95 : 0.5} markerEnd={hot ? 'url(#tg-arr-hot)' : 'url(#tg-arr)'} />
            </g>
          );
        }))}
        {lit && edges.filter((e) => lit.has(e.to) && e.from.some((f) => lit.has(f))).map((e) => {
          const a = POS[e.from[0]];
          const b = POS[e.to];
          if (!a || !b) return null;
          const same = Math.abs(a.x - b.x) < 30;
          const x = same ? a.x + PW + 30 : (a.x + PW + b.x) / 2;
          const y = (a.y + b.y) / 2 + PH / 2 - 4;
          return <text key={`l-${e.id}`} x={x} y={y} className="tg-elbl" textAnchor="middle">{e.id} {e.grade}</text>;
        })}
        {SIG_IDS.map(sigPill)}
        {LEARNED.map(pill)}
        {(['HONEST', 'CORRIG', 'EA', 'TGAME'] as TraitId[]).map(pill)}
        {HIDDEN.map(pill)}
        {HIDDEN.filter((t) => CRITICAL_TRAITS.includes(t)).map(sees)}
      </svg>
      {focus && TRAIT_BY_ID[focus as TraitId] && (
        <div className="tg-card-wrap" style={{ top: `${(Math.min(H - 380, Math.max(0, POS[focus].y - 40)) / H) * 100}%`, ...(POS[focus].x > W / 2 ? { left: `${((POS[focus].x - 400) / W) * 100}%` } : { left: `${((POS[focus].x + PW + 20) / W) * 100}%` }) }} onMouseEnter={keep} onMouseLeave={leave}>
          <EvidenceCard s={s} id={focus as TraitId} versionId={bv?.versionId} edges={edges} det={u.perTrait[focus as TraitId]} pinned={pin === focus} onClose={() => { setPin(undefined); setHover(undefined); }} />
        </div>
      )}
      <div className="tg-legend">
        <span className="dim"><Term id="evidenceGrade">evidence grade</Term></span>
        {(['A', 'B', 'C', 'D'] as const).map((gr) => <span key={gr} className="row-i"><svg width={30} height={6}><line x1={0} x2={30} y1={3} y2={3} stroke={C.text2} strokeWidth={2} strokeDasharray={GRADE_DASH[gr]} /></svg>{gr}</span>)}
        <span className="dim"><Term id="edge">edge</Term> width = weight</span>
        <span className="dim"><Term id="belief">belief</Term></span>
        {([[0.05, 'low'], [0.2, 'watch'], [0.4, 'elevated'], [0.7, 'high']] as const).map(([x, l]) => <span key={l} className="row-i"><i className="tg-sw" style={{ background: sev(x) }} />{l}</span>)}
        <span className="dim">· <Term id="protective">protective</Term>: high is good</span>
        <span className="sp" />
        <span className="dim">{focus ? <>{TRAIT_BY_ID[focus as TraitId]?.name ?? SIGNAL_SHORT[focus]}: upstream paths lit{pin ? ' · pinned' : ''}</> : 'hover a node to light its causes · click to pin'}</span>
      </div>
    </div>
  );
}

/** Evidence card: belief, detection vs 50%, incoming edges with citations, levers. */
function EvidenceCard({ s, id, versionId, edges, det, pinned, onClose }: { s: GameStateV2; id: TraitId; versionId?: string; edges: GEdge[]; det?: number; pinned: boolean; onClose: () => void }) {
  const t = TRAIT_BY_ID[id];
  const b = beliefView(s, versionId)?.beliefs[id];
  const Icon = TRAIT_ICON[id];
  const inc = edges.filter((e) => e.to === id).sort((a, b2) => b2.weight - a.weight);
  const name = (x: string) => TRAIT_BY_ID[x as TraitId]?.name ?? SIGNAL_SHORT[x] ?? x;
  const sigIn = inc.flatMap((e) => e.from).find((f) => /^S\d$/.test(f));
  const critical = CRITICAL_TRAITS.includes(id);
  return (
    <div className="tg-card" data-evidence={id}>
      <div className="tg-card-hd">
        <Icon size={15} color={b ? traitSev(id, b.est) : C.text2} />
        <b><Term id={`trait:${id}`}>{t.name}</Term></b>
        <span className="sp" />
        {b && <span className="num">{F.num(b.est, 2)} <span className="dim">± {F.num(b.sd, 2)}</span></span>}
        {pinned && <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="close">✕</button>}
      </div>
      <div className="dim small">{t.desc}</div>
      {critical && det !== undefined && (
        <div className="tg-det">
          <span className="small">Your tools catch it</span>
          <HBar v={det} max={1} w={150} h={6} color={det >= 0.5 ? C.und : C.bad} mark={0.5} />
          <span className={`num ${det >= 0.5 ? 'tone-pos' : 'tone-neg'}`}>{F.pct(det)}</span>
          <div className="dim small" style={{ gridColumn: '1 / -1' }}>{det >= 0.5 ? 'Above' : 'Below'} 50% at your level · counts toward <Ref id="U" to={{ panel: 'safety', tab: 'overview' }}>Understanding</Ref></div>
        </div>
      )}
      {inc.length > 0 && (
        <div className="tip-sec">
          <div className="tip-cap">Evidence into this node</div>
          {inc.map((e) => (
            <div className="tg-ev" key={e.id}>
              <span className="tag2">{e.id}</span>
              <span>{e.from.map(name).join(' + ')} → {name(e.to)}</span>
              <span className="num">{F.num(e.weight, 2)} · <Term id="evidenceGrade">{e.grade}</Term></span>
              <span className="tg-cite">{e.cite}{e.moderator ? <span className="dim"> · <Term id="moderator">moderator</Term>: {e.moderator}</span> : null}</span>
            </div>
          ))}
        </div>
      )}
      {!inc.length && <div className="dim small tip-sec">No known causes in the graph: it moves through training and the tools you use.</div>}
      <div className="tip-sec btn-row wrap">
        {versionId && <ActBtn id="safety.investigate" testId="safety.investigate.trait" params={{ versionId, trait: id, fte: 15 }} icon={ICON.investigate} label="Investigate · 15 engineers" />}
        {sigIn && <GoBtn to={{ panel: 'blueprint' }} label={`Less ${SIGNAL_SHORT[sigIn].toLowerCase()}`} testId={`tg.recipe.${sigIn}`} />}
        {critical && det !== undefined && det < 0.5 && <GoBtn to={{ panel: 'safety', tab: 'lines' }} label="Tool upkeep" testId="tg.upkeep" />}
        <GoBtn to={{ panel: 'safety', tab: 'lines' }} label="Research lines" testId="tg.lines" />
      </div>
    </div>
  );
}
