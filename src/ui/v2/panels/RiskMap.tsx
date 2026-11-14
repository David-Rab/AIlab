// Risk map (default center, §6.2): nodes = your lab, rivals, China, your deployments, top sectors; edges = theft,
// distillation, talent, chips, open weights. Incidents pulse; control-index halo per lineage; risk overlay (§6.6).
import { useState, type ReactNode } from 'react';
import { activeRivals, distillationAccess, engine, leadDays, leverageAll, measuredL, versionById } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { SECTOR_BY_ID } from '../../../data/v2/sectors';
import { store } from '../store';
import { pct, Seg, Tip, TipCard, unlocked } from '../ui';

interface Node { id: string; label: string; sub: string; x: number; y: number; r: number; color: string; halo: number; pulse: boolean; risk?: number; panel: string; tip: () => ReactNode }
interface Edge { from: string; to: string; kind: 'theft' | 'distill' | 'talent' | 'chips' | 'open' | 'serve'; w: number; label: string }
const EDGE_COLOR: Record<Edge['kind'], string> = { theft: '#ef6b6b', distill: '#e9b44c', talent: '#a58cff', chips: '#5aa9ff', open: '#f08a4b', serve: '#4cc38a' };

export function RiskMap({ s }: { s: GameStateV2 }) {
  const [overlay, setOverlay] = useState<'flows' | 'risk'>('flows');
  const W = 900;
  const H = 545;
  const lev = leverageAll(s);
  const risks = engine.riskSources(s);
  const riskOf = (id: string) => risks.find((r) => r.id === id)?.estimate;
  const openInc = s.player.safety.incidents.filter((i) => i.status === 'open' || i.status === 'investigating');
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  nodes.push({
    id: 'player', label: s.player.name, sub: `L ${measuredL(s).toFixed(1)}`,
    x: W / 2, y: H / 2, r: 30, color: 'var(--accent)', halo: lev.player ?? 0, pulse: openInc.some((i) => !i.deploymentId), risk: riskOf('own'), panel: 'models',
    tip: () => <TipCard title={s.player.name} rows={[{ label: 'Leverage', value: pct(lev.player ?? 0, 1) }, { label: 'Open incidents', value: openInc.length }, { label: 'Risk (own models)', value: pct(riskOf('own') ?? 0, 1) }]}>Your lab. Halo = [[leverage]].</TipCard>,
  });
  const labs = [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])];
  labs.forEach((r, i) => {
    const isCN = r.core.kind === 'china';
    const a = Math.PI + (i / Math.max(1, labs.length - 1)) * Math.PI;
    const l = leadDays(s, r.core.id);
    const id = r.core.id;
    nodes.push({
      id, label: r.core.name, sub: `${l.est >= 0 ? '+' : ''}${l.est}d`, x: W / 2 + Math.cos(a) * 330, y: H / 2 + Math.sin(a) * 200, r: 20,
      color: isCN ? 'var(--china)' : 'var(--rival)', halo: lev[id] ?? 0, pulse: s.ws4?.rivalIncidents.some((x) => x.lab === id && s.time.day - x.day < 14) ?? false,
      risk: riskOf(isCN ? 'china' : `rival:${id}`), panel: 'relations',
      tip: () => <TipCard title={r.core.name} rows={[{ label: 'Lead', value: `${l.est}d ± ${l.sd}` }, { label: 'Misalignment band', value: `${r.intel.misalignBand[0]}–${r.intel.misalignBand[1]}` }, { label: 'Leverage', value: pct(lev[id] ?? 0, 1) }, { label: 'Distillation access', value: pct(distillationAccess(s, id)) }]}>Edges show flows from you.</TipCard>,
    });
    edges.push({ from: 'player', to: id, kind: 'distill', w: distillationAccess(s, id), label: 'distillation' });
    if (r.meters.poachAggression > 20) edges.push({ from: id, to: 'player', kind: 'talent', w: r.meters.poachAggression / 100, label: 'talent poaching' });
    if (r.publicModel?.openWeights) edges.push({ from: id, to: 'world', kind: 'open', w: 0.6, label: 'open weights' });
    if (isCN) {
      const theft = riskOf('theft') ?? 0;
      if (unlocked(s, 'theftMap')) edges.push({ from: 'player', to: id, kind: 'theft', w: theft, label: `theft risk ${pct(theft)}` });
      edges.push({ from: 'world', to: id, kind: 'chips', w: s.market.exportPolicy === 'strict' ? 0.1 : s.market.exportPolicy === 'caseByCase' ? 0.4 : 0.8, label: `chip exports: ${s.market.exportPolicy}` });
    }
  });
  nodes.push({ id: 'world', label: 'Chips · open', sub: s.market.binding, x: W - 70, y: 50, r: 14, color: 'var(--text-3)', halo: 0, pulse: false, panel: 'compute', tip: () => <TipCard title="Chip market" rows={[{ label: 'Binding', value: s.market.binding }, { label: 'List price', value: `$${s.market.listPrice.toFixed(1)}K` }, { label: 'Export policy', value: s.market.exportPolicy }]} /> });
  const deps = s.player.deployments.filter((d) => d.status !== 'withdrawn');
  deps.forEach((d, i) => {
    const a = deps.length === 1 ? 0.3 * Math.PI : 0.12 * Math.PI + (i / (deps.length - 1)) * 0.76 * Math.PI + (i % 2 ? 0.04 : 0);
    const v = versionById(s, d.versionId);
    const id = `dep:${d.id}`;
    nodes.push({
      id, label: d.channel, sub: v?.name ?? '', x: W / 2 + Math.cos(a) * (200 + (i % 2) * 40), y: H / 2 + Math.sin(a) * (150 + (i % 2) * 30), r: 11, color: 'var(--pos)', halo: 0,
      pulse: openInc.some((x) => x.deploymentId === d.id), panel: 'deployments',
      tip: () => <TipCard title={`${d.channel} · ${v?.name ?? d.versionId}`} rows={[{ label: 'Revenue', value: `$${(d.revenueRate ?? 0).toFixed(1)}B/yr` }, { label: 'Binding', value: d.demandBound ?? '—' }, { label: 'Safeguards', value: d.safeguards }, { label: 'KYC', value: d.kyc }]} />,
    });
    edges.push({ from: 'player', to: id, kind: 'serve', w: Math.min(1, (d.revenueRate ?? 0) / 20), label: 'serving' });
  });
  if (unlocked(s, 'world')) {
    const top = Object.entries(s.world.sectors.US).sort((a, b) => b[1].A - a[1].A).slice(0, 5);
    top.forEach(([sid, st], i) => {
      nodes.push({
        id: `sec:${sid}`, label: SECTOR_BY_ID[sid as keyof typeof SECTOR_BY_ID]?.name ?? sid, sub: pct(st.A), x: 90 + i * 180, y: H - 40, r: 8 + st.A * 14, color: 'var(--pub)', halo: 0, pulse: false, panel: 'world',
        tip: () => <TipCard title={sid} rows={[{ label: 'Automated A', value: pct(st.A) }, { label: 'Friction F', value: st.F.toFixed(2) }, { label: 'Binding', value: st.binding }]} />,
      });
    });
  }
  const at = (id: string) => nodes.find((n) => n.id === id);
  const riskColor = (r?: number) => (r === undefined ? 'var(--line-2)' : r > 0.2 ? 'var(--neg)' : r > 0.05 ? 'var(--warn)' : 'var(--pos)');
  return (
    <div className="panel-v2" data-panel="map">
      <div className="panel-toolbar">
        <span className="panel-title">Risk map</span>
        <Seg value={overlay} options={[{ v: 'flows', label: 'Flows' }, { v: 'risk', label: 'Risk overlay' }]} onChange={setOverlay} />
        <span className="legend">{(Object.keys(EDGE_COLOR) as Edge['kind'][]).map((k) => <span key={k}><i style={{ background: EDGE_COLOR[k] }} />{k}</span>)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="riskmap">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#66768a" /></marker>
        </defs>
        {edges.map((e, i) => {
          const a = at(e.from);
          const b = at(e.to);
          if (!a || !b) return null;
          const len = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
          const ex = b.x - ((b.x - a.x) / len) * (b.r + 4);
          const ey = b.y - ((b.y - a.y) / len) * (b.r + 4);
          return (
            <line key={i} x1={a.x} y1={a.y} x2={ex} y2={ey} stroke={EDGE_COLOR[e.kind]} strokeWidth={1 + 5 * Math.max(0, Math.min(1, e.w))} opacity={overlay === 'risk' ? 0.25 : 0.7} markerEnd="url(#arr)" strokeDasharray={e.kind === 'theft' ? '6 4' : undefined}>
              <title>{e.label}</title>
            </line>
          );
        })}
        {nodes.map((n) => (
          <Tip key={n.id} as="g" content={n.tip}>
            <g className="map-node" data-node={n.id} onClick={() => store.setPanel(n.panel)}>
              {n.halo > 0 && <circle cx={n.x} cy={n.y} r={n.r + 4 + n.halo * 60} className="halo" />}
              {n.pulse && <circle cx={n.x} cy={n.y} r={n.r + 6} className="pulse" />}
              <circle cx={n.x} cy={n.y} r={n.r} fill={overlay === 'risk' ? riskColor(n.risk) : n.color} stroke="#0d1117" strokeWidth={2} />
              <text x={n.x} y={n.y + n.r + 13} textAnchor="middle" className="map-lbl">{n.label}</text>
              <text x={n.x} y={n.y + n.r + 25} textAnchor="middle" className="map-sub">{overlay === 'risk' && n.risk !== undefined ? pct(n.risk, 1) : n.sub}</text>
            </g>
          </Tip>
        ))}
      </svg>
    </div>
  );
}
