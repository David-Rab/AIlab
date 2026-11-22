// Research trade-off charts (Company › Compute split).
//   ResponseCharts: small multiples, research speed when one input is scaled ×0.25 … ×4 (today = ×1). A flat line is
//             a saturated input; a steep one is the bottleneck. Shared y-scale so slopes compare.
// Single series per chart (no legend; the title names it). Hover shows the value under the cursor.
import { useState } from 'react';
import { responseCurves } from '../../../engine/v2';
import type { GameStateV2 } from '../../../engine/v2';
import { Term, Tip, TipCard } from '../ui';
import * as F from '../fmt';
import { C } from '../theme';

const AX = { fontSize: 10, fill: C.text3 } as const;

const SERIES: { id: 'humans' | 'research' | 'experiments' | 'agents'; term: string; label: string }[] = [
  { id: 'humans', term: 'poolHumans', label: 'Researchers' },
  { id: 'research', term: 'poolResearch', label: 'Research compute' },
  { id: 'experiments', term: 'poolExperiments', label: 'Experiments only' },
  { id: 'agents', term: 'poolAgents', label: 'Agents only' },
];

export function ResponseCharts({ s }: { s: GameStateV2 }) {
  const rc = responseCurves(s);
  const [hov, setHov] = useState<{ id: string; i: number }>();
  if (!rc) return null;
  const all = SERIES.flatMap((x) => rc[x.id]);
  const lo = Math.min(0.5, ...all);
  const hi = Math.max(1.5, ...all);
  const W = 150;
  const H = 96;
  const m = { l: 6, r: 6, t: 8, b: 16 };
  const lx = (sc: number) => m.l + ((Math.log(sc) - Math.log(0.25)) / (Math.log(4) - Math.log(0.25))) * (W - m.l - m.r);
  const ly = (v: number) => H - m.b - ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (H - m.t - m.b);
  return (
    <div className="rc-mults" data-test="response-charts">
      {SERIES.map((ser) => {
        const v = rc[ser.id];
        const top = v[v.length - 1];
        const sat = top < 1.03;
        const h = hov?.id === ser.id ? hov.i : undefined;
        return (
          <div key={ser.id} className="rc-mult">
            <div className="rc-mult-h"><Term id={ser.term}>{ser.label}</Term></div>
            <svg viewBox={`0 0 ${W} ${H}`} className="rc-svg"
              onMouseMove={(e) => { const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; let bi = 0; rc.scales.forEach((sc, i) => { if (Math.abs(lx(sc) - px) < Math.abs(lx(rc.scales[bi]) - px)) bi = i; }); setHov({ id: ser.id, i: bi }); }}
              onMouseLeave={() => setHov(undefined)}>
              <line x1={m.l} x2={W - m.r} y1={ly(1)} y2={ly(1)} stroke={C.line} />
              <line x1={lx(1)} x2={lx(1)} y1={m.t} y2={H - m.b} stroke={C.line} />
              <path d={rc.scales.map((sc, i) => `${i ? 'L' : 'M'}${lx(sc).toFixed(1)},${ly(v[i]).toFixed(1)}`).join(' ')} fill="none" stroke={C.cap} strokeWidth={2} />
              <circle cx={lx(1)} cy={ly(1)} r={4} fill={C.you} stroke={C.panel} strokeWidth={2} />
              <text x={m.l} y={H - 3} style={AX}>×¼</text>
              <text x={W - m.r} y={H - 3} textAnchor="end" style={AX}>×4</text>
              {h !== undefined && <g pointerEvents="none"><line x1={lx(rc.scales[h])} x2={lx(rc.scales[h])} y1={m.t} y2={H - m.b} stroke={C.line2} /><circle cx={lx(rc.scales[h])} cy={ly(v[h])} r={4} fill={C.cap} stroke={C.panel} strokeWidth={2} /></g>}
            </svg>
            <Tip as="div" content={() => <TipCard title={<Term id={ser.term}>{ser.label}</Term>} rows={rc.scales.map((sc, i) => ({ label: `×${sc}`, value: F.pct(v[i] - 1, 0, true) }))}>Research speed if only this input were scaled, the rest held at today's level.</TipCard>}>
              <div className="rc-mult-f small">
                {h !== undefined
                  ? <span className="num">×{rc.scales[h]} → {F.pct(v[h] - 1, 0, true)}</span>
                  : <span className={sat ? 'dim' : 'num'}>{sat ? 'saturated' : `×4 → ${F.pct(top - 1, 0, true)}`}</span>}
              </div>
            </Tip>
          </div>
        );
      })}
    </div>
  );
}
