// Risk › Flows (IA.md L2): HOME of the theft, distillation, talent, chip and open-weight flows between your lab, the
// rival labs, China, your deployments and the most automated sectors. Nodes keep the actor colours (you / US rival /
// China); edges are labelled and colour-keyed in the legend. Click a node for its panel.
import type { ReactNode } from 'react';
import { activeRivals, distillationAccess, engine, leadDays, leverageAll, measuredL, versionById } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { SECTOR_BY_ID } from '../../../data/v2/sectors';
import { store } from '../store';
import { Term, Tip, TipCard, unlocked } from '../ui';
import * as F from '../fmt';
import { C, seq, SPHERE } from '../theme';

interface Node { id: string; label: string; sub: string; x: number; y: number; r: number; color: string; halo: number; pulse: boolean; panel: string; tab?: string; tip: () => ReactNode }
type EdgeKind = 'theft' | 'distill' | 'talent' | 'chips' | 'open' | 'serve';
interface Edge { from: string; to: string; kind: EdgeKind; w: number; label: string }
const EDGE: Record<EdgeKind, { color: string; label: string; term: string; dash?: string }> = {
  theft: { color: C.bad, label: 'weight theft', term: 'theft', dash: '6 4' },
  distill: { color: C.watch, label: 'distillation', term: 'distill' },
  talent: { color: C.cap, label: 'talent poaching', term: 'talentPull' },
  chips: { color: '#7fb2ff', label: 'chip exports', term: 'exportPolicy' },
  open: { color: '#9fb0c3', label: 'open weights', term: 'distill', dash: '2 3' },
  serve: { color: SPHERE.prod, label: 'serving', term: 'channel' },
};

export function RiskFlows({ s }: { s: GameStateV2 }) {
  const W = 1400;
  const H = 640;
  const lev = leverageAll(s);
  const risks = engine.riskSources(s);
  const riskOf = (id: string) => risks.find((r) => r.id === id)?.estimate;
  const openInc = s.player.safety.incidents.filter((i) => i.status === 'open' || i.status === 'investigating');
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  nodes.push({
    id: 'player', label: s.player.name, sub: `L ${F.level(measuredL(s))}`,
    x: W / 2, y: H / 2 - 20, r: 30, color: C.you, halo: lev.player ?? 0, pulse: openInc.some((i) => !i.deploymentId), panel: 'models',
    tip: () => <TipCard title={s.player.name} rows={[{ label: <Term id="leverage">Leverage</Term>, value: F.pct(lev.player ?? 0, 1) }, { label: 'Open incidents', value: openInc.length }]}>Your lab. The halo is your [[leverage]].</TipCard>,
  });
  const labs = [...activeRivals(s), ...(s.china.lab.core.status === 'active' ? [s.china.lab] : [])];
  labs.forEach((r, i) => {
    const isCN = r.core.kind === 'china';
    const a = Math.PI + ((i + 0.5) / Math.max(1, labs.length)) * Math.PI;
    const l = leadDays(s, r.core.id);
    const id = r.core.id;
    nodes.push({
      id, label: r.core.name, sub: `lead ${F.lead(l.est)}`, x: W / 2 + Math.cos(a) * 520, y: H / 2 - 20 + Math.sin(a) * 240, r: 20,
      color: isCN ? C.china : C.rival, halo: lev[id] ?? 0, pulse: s.ws4?.rivalIncidents.some((x) => x.lab === id && s.time.day - x.day < 14) ?? false,
      panel: 'relations',
      tip: () => <TipCard title={r.core.name} rows={[{ label: <Term id="lead">Lead</Term>, value: `${F.lead(l.est)} ± ${Math.round(l.sd)}d` }, { label: <Term id="misBand">Misalignment band</Term>, value: `${F.short(r.intel.misalignBand[0])}–${F.short(r.intel.misalignBand[1])}` }, { label: <Term id="leverage">Leverage</Term>, value: F.pct(lev[id] ?? 0, 1) }, { label: <Term id="distill">Distillation access</Term>, value: F.pct(distillationAccess(s, id)) }]}>Edges show what flows between this lab and you. Positive lead = you are ahead.</TipCard>,
    });
    edges.push({ from: 'player', to: id, kind: 'distill', w: distillationAccess(s, id), label: `distillation ${F.pct(distillationAccess(s, id))}` });
    if (r.meters.poachAggression > 20) edges.push({ from: id, to: 'player', kind: 'talent', w: r.meters.poachAggression / 100, label: 'talent poaching' });
    if (r.publicModel?.openWeights) edges.push({ from: id, to: 'world', kind: 'open', w: 0.6, label: 'open weights' });
    if (isCN) {
      const theft = riskOf('theft') ?? 0;
      if (unlocked(s, 'theftMap')) edges.push({ from: 'player', to: id, kind: 'theft', w: theft, label: `theft risk ${F.pct(theft)}` });
      edges.push({ from: 'world', to: id, kind: 'chips', w: s.market.exportPolicy === 'strict' ? 0.1 : s.market.exportPolicy === 'caseByCase' ? 0.4 : 0.8, label: `chips: ${F.words(s.market.exportPolicy)}` });
    }
  });
  nodes.push({ id: 'world', label: 'Chip market', sub: `${s.market.binding} binding`, x: W - 80, y: 46, r: 14, color: '#6b7c91', halo: 0, pulse: false, panel: 'compute', tip: () => <TipCard title="Chip market" rows={[{ label: 'Binding component', value: s.market.binding }, { label: <Term id="listPrice">List price</Term>, value: `$${s.market.listPrice.toFixed(1)}K` }, { label: <Term id="exportPolicy">Export policy</Term>, value: F.words(s.market.exportPolicy) }]} /> });
  const deps = s.player.deployments.filter((d) => d.status !== 'withdrawn');
  deps.forEach((d, i) => {
    const a = deps.length === 1 ? 0.5 * Math.PI : 0.18 * Math.PI + (i / (deps.length - 1)) * 0.64 * Math.PI;
    const v = versionById(s, d.versionId);
    const id = `dep:${d.id}`;
    nodes.push({
      id, label: d.channel, sub: v?.name ?? '', x: W / 2 + Math.cos(a) * (300 + (i % 2) * 50), y: H / 2 - 20 + Math.sin(a) * (150 + (i % 2) * 30), r: 11, color: SPHERE.prod, halo: 0,
      pulse: openInc.some((x) => x.deploymentId === d.id), panel: 'products',
      tip: () => <TipCard title={`${d.channel} · ${v?.name ?? d.versionId}`} rows={[{ label: 'Revenue', value: F.money(d.revenueRate ?? 0, { perYear: true }) }, { label: 'Binding', value: d.demandBound ?? '—' }, { label: <Term id="safeguards">Safeguards</Term>, value: d.safeguards }, { label: <Term id="kyc">KYC</Term>, value: d.kyc }]} />,
    });
    edges.push({ from: 'player', to: id, kind: 'serve', w: Math.min(1, (d.revenueRate ?? 0) / 20), label: '' });
  });
  if (unlocked(s, 'world')) {
    const top = Object.entries(s.world.sectors.US).sort((a, b) => b[1].A - a[1].A).slice(0, 5);
    top.forEach(([sid, st], i) => {
      nodes.push({
        id: `sec:${sid}`, label: SECTOR_BY_ID[sid as keyof typeof SECTOR_BY_ID]?.name ?? sid, sub: `${F.pct(st.A)} automated`, x: 160 + i * 270, y: H - 50, r: 8 + st.A * 12, color: seq(st.A), halo: 0, pulse: false, panel: 'world',
        tip: () => <TipCard title={SECTOR_BY_ID[sid as keyof typeof SECTOR_BY_ID]?.name ?? sid} rows={[{ label: <Term id="sectorA">Automated</Term>, value: F.pct(st.A) }, { label: <Term id="friction">Friction</Term>, value: st.F.toFixed(2) }, { label: <Term id="binding">Binding</Term>, value: st.binding }]} />,
      });
    });
  }
  const at = (id: string) => nodes.find((n) => n.id === id);
  return (
    <div className="rflows">
      <div className="rflows-leg legend2">
        <span><i className="dotk" style={{ background: C.you }} />you</span>
        <span><i className="dotk" style={{ background: C.rival }} />US rival</span>
        <span><i className="dotk" style={{ background: C.china }} />China</span>
        <span><i className="dotk" style={{ background: SPHERE.prod }} />your deployments</span>
        <span><i className="dotk" style={{ background: seq(0.6) }} />sectors (size = automated)</span>
        <span className="sep" />
        {(Object.keys(EDGE) as EdgeKind[]).map((k) => <span key={k}><i style={{ background: EDGE[k].color }} /><Term id={EDGE[k].term}>{EDGE[k].label}</Term></span>)}
        <span className="dim">· width = strength · halo = leverage</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="riskmap2">
        <defs>
          {(Object.keys(EDGE) as EdgeKind[]).map((k) => <marker key={k} id={`arr-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill={EDGE[k].color} /></marker>)}
        </defs>
        {edges.map((e, i) => {
          const a = at(e.from);
          const b = at(e.to);
          if (!a || !b) return null;
          const len = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
          // offset parallel edges (e.g. distill out, talent in) so labels do not collide
          const off = e.kind === 'talent' ? 7 : e.kind === 'theft' ? -7 : 0;
          const nx = (-(b.y - a.y) / len) * off;
          const ny = ((b.x - a.x) / len) * off;
          const sx = a.x + ((b.x - a.x) / len) * (a.r + 3) + nx;
          const sy = a.y + ((b.y - a.y) / len) * (a.r + 3) + ny;
          const ex = b.x - ((b.x - a.x) / len) * (b.r + 4) + nx;
          const ey = b.y - ((b.y - a.y) / len) * (b.r + 4) + ny;
          const t = e.kind === 'talent' ? 0.72 : e.kind === 'theft' ? 0.4 : 0.64; // talent runs rival → you, so 0.72 sits near you
          const lo = -12; // talent runs the opposite way, so the same sign puts its label on the other side of the pair
          const lx = sx + (ex - sx) * t + (-(ey - sy) / len) * lo;
          const ly = sy + (ey - sy) * t + ((ex - sx) / len) * lo + 4;
          const nxl = (-(ey - sy) / len) * lo;
          const anchor = Math.abs(nxl) > 6 ? (nxl > 0 ? 'start' : 'end') : 'middle';
          return (
            <g key={i} data-edge={e.kind}>
              <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={EDGE[e.kind].color} strokeWidth={1 + 5 * Math.max(0, Math.min(1, e.w))} opacity={0.75} markerEnd={`url(#arr-${e.kind})`} strokeDasharray={EDGE[e.kind].dash} />
              {e.label && <text x={lx} y={ly} textAnchor={anchor} className="edge-lbl" fill={EDGE[e.kind].color}>{e.label}</text>}
            </g>
          );
        })}
        {nodes.map((n) => (
          <Tip key={n.id} as="g" content={n.tip}>
            <g className="map-node" data-node={n.id} onClick={() => store.goto(n.panel, n.tab ? { tab: n.tab } : {})}>
              {n.halo > 0 && <circle cx={n.x} cy={n.y} r={n.r + 4 + n.halo * 60} fill={n.color} opacity={0.12} />}
              {n.pulse && <circle cx={n.x} cy={n.y} r={n.r + 6} className="pulse" />}
              <circle cx={n.x} cy={n.y} r={n.r} fill={n.color} stroke="#0d1117" strokeWidth={2} />
              <text x={n.x} y={n.y + n.r + 14} textAnchor="middle" className="node-lbl">{n.label}</text>
              <text x={n.x} y={n.y + n.r + 27} textAnchor="middle" className="node-sub">{n.sub}</text>
            </g>
          </Tip>
        ))}
      </svg>
    </div>
  );
}
