// Trait causal graph (§3.5.4, §6.3): nodes coloured by the player's belief for the selected version; edges with their
// evidence grade letter and citation (edge-weight uncertainty shown separately from belief).
import { useState } from 'react';
import { beliefView, traitGraph } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { SIGNALS } from '../../../data/v2/traits';
import { Tip, TipCard } from '../ui';

const LAYER_X: Record<string, number> = { S: 60, L: 250, A: 450, B: 650, P: 840 };
const GRADE_DASH: Record<string, string | undefined> = { A: undefined, B: '6 3', C: '3 3', D: '1 4' };

export function TraitGraph({ s, versionId }: { s: GameStateV2; versionId?: string }) {
  const g = traitGraph(s);
  const bv = beliefView(s, versionId);
  const [hover, setHover] = useState<string>();
  const byLayer: Record<string, string[]> = { S: SIGNALS.map((x) => x.id), L: [], A: [], B: [], P: [] };
  for (const n of g.nodes) byLayer[n.layer].push(n.id);
  const pos: Record<string, { x: number; y: number }> = {};
  const H = 440;
  for (const [layer, ids] of Object.entries(byLayer)) ids.forEach((id, i) => (pos[id] = { x: LAYER_X[layer], y: 30 + ((i + 0.5) * (H - 40)) / ids.length }));
  pos.teacher = { x: 60, y: H - 10 };
  const color = (id: string) => {
    const b = bv?.beliefs[id as keyof typeof bv.beliefs];
    if (!b) return 'var(--line-2)';
    const protective = g.nodes.find((n) => n.id === id)?.layer === 'P';
    const bad = protective ? 1 - b.est : b.est;
    return bad > 0.5 ? '#ef6b6b' : bad > 0.3 ? '#e9b44c' : bad > 0.15 ? '#c9a35a' : '#4cc38a';
  };
  return (
    <div className="traitgraph" data-test="traitgraph">
      <svg viewBox={`0 0 900 ${H + 10}`} width="100%">
        {Object.entries(LAYER_X).map(([l, x]) => <text key={l} x={x} y={14} className="map-sub" textAnchor="middle">{{ S: 'signals', L: 'learned', A: 'awareness', B: 'unobserved', P: 'protective' }[l]}</text>)}
        {g.edges.flatMap((e) => e.from.map((f, k) => {
          const a = pos[f];
          const b = pos[e.to];
          if (!a || !b) return null;
          const on = !hover || hover === e.to || hover === f;
          return (
            <Tip as="g" key={`${e.id}-${k}`} content={() => (
              <TipCard title={`${e.id}: ${e.from.join(' + ')} → ${e.to}`} value={`grade ${e.grade}`} rows={[
                { label: e.revealed ? 'Weight (revealed)' : 'Prior mean weight', value: e.weight.toFixed(2) },
                { label: 'Edge uncertainty', value: e.revealed ? 'none (revealed)' : `grade ${e.grade}`, tone: e.grade === 'A' ? 'pos' : 'neg' },
                ...(e.moderator ? [{ label: 'Moderator', value: e.moderator }] : []),
              ]} footer={e.cite} />
            )}>
              <g>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={e.weight < 0 ? '#4cc38a' : '#8a99ad'} strokeWidth={0.6 + Math.abs(e.weight) * 2.2} strokeDasharray={e.revealed ? undefined : GRADE_DASH[e.grade]} opacity={on ? 0.75 : 0.12} />
                <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 2} className="edge-grade" opacity={on ? 1 : 0.2}>{e.grade}</text>
              </g>
            </Tip>
          );
        }))}
        {Object.entries(pos).map(([id, p]) => {
          const node = g.nodes.find((n) => n.id === id);
          const b = bv?.beliefs[id as keyof typeof bv.beliefs];
          return (
            <Tip as="g" key={id} content={() => (
              <TipCard title={node?.name ?? SIGNALS.find((x) => x.id === id)?.name ?? id} value={b ? `${b.est.toFixed(2)} ± ${b.sd.toFixed(2)}` : undefined}>{node?.desc ?? 'Training-signal input'}</TipCard>
            )}>
              <g onMouseEnter={() => setHover(id)} onMouseLeave={() => setHover(undefined)} data-trait={id}>
                <circle cx={p.x} cy={p.y} r={node ? 12 : 8} fill={node ? color(id) : '#2f7fd6'} stroke="#0d1117" strokeWidth={2} />
                {b && <circle cx={p.x} cy={p.y} r={12 + b.sd * 20} fill="none" stroke={color(id)} opacity={0.35} />}
                <text x={p.x} y={p.y + (node ? 24 : 18)} textAnchor="middle" className="map-lbl">{id}</text>
              </g>
            </Tip>
          );
        })}
      </svg>
      <div className="legend small">
        <span><i style={{ background: '#4cc38a' }} />low belief</span><span><i style={{ background: '#e9b44c' }} />mid</span><span><i style={{ background: '#ef6b6b' }} />high</span>
        <span>ring = belief sd · dash = evidence grade (A solid … D dotted)</span>
        {g.signalS8 ? <span className="tone-warn">S8 {g.signalS8.toFixed(2)}</span> : null}
      </div>
    </div>
  );
}
