// Causal replay: top-5 decisions by 90-day impact (V2-SPEC §5.4). Owner: WS4.
//
// impact = Σ_metric |Δ over the next 90 d − counterfactual drift (slope over the previous 30 d)·90| / scale, over the
// weekly series (L, U, cash, approval, trustGov, misTrue). Engine/end-screen only (misTrue is truth).
import type { DecisionRecord, GameStateV2 } from '../types';

type Metric = { key: 'Lmeasured' | 'U' | 'cash' | 'approval' | 'trustGov' | 'misTrue'; label: string; scale: (s: GameStateV2) => number };

const METRICS: Metric[] = [
  { key: 'Lmeasured', label: 'level', scale: () => 1 },
  { key: 'U', label: 'understanding', scale: () => 1 },
  { key: 'cash', label: 'cash', scale: (s) => Math.max(10, Math.abs(s.player.finance.cash)) },
  { key: 'approval', label: 'approval', scale: () => 20 },
  { key: 'trustGov', label: 'gov trust', scale: () => 10 },
  { key: 'misTrue', label: 'hidden misalignment', scale: () => 0.1 },
];

/** Series value at (or nearest before) day d. */
function at(s: GameStateV2, key: Metric['key'], d: number): number | undefined {
  const days = s.series.day;
  const xs = s.series[key];
  if (!days.length) return undefined;
  let i = days.length - 1;
  while (i > 0 && days[i] > d) i--;
  return xs[i];
}

export function topDecisions(s: GameStateV2, n = 5): { decision: DecisionRecord; impact: number; caused: string }[] {
  const out: { decision: DecisionRecord; impact: number; caused: string }[] = [];
  const end = s.time.day;
  for (const dec of s.decisions) {
    const d0 = dec.day;
    const d1 = Math.min(end, d0 + 90);
    if (d1 <= d0) continue;
    let impact = 0;
    let best = { label: '', v: 0, raw: 0 };
    for (const m of METRICS) {
      const v0 = at(s, m.key, d0);
      const v1 = at(s, m.key, d1);
      const vp = at(s, m.key, d0 - 30);
      if (v0 === undefined || v1 === undefined) continue;
      const slope = vp === undefined ? 0 : (v0 - vp) / 30;
      const raw = v1 - v0 - slope * (d1 - d0);
      const x = Math.abs(raw) / m.scale(s);
      impact += x;
      if (x > best.v) best = { label: m.label, v: x, raw };
    }
    const what = dec.eventId ? `${dec.eventId}: ${dec.choice}` : `${dec.actionId}`;
    const caused = best.label ? `${what} → ${best.label} ${best.raw >= 0 ? '+' : ''}${best.raw.toFixed(best.label === 'cash' ? 1 : 2)} vs trend` : what;
    out.push({ decision: dec, impact: Math.round(impact * 1000) / 1000, caused });
  }
  return out.sort((a, b) => b.impact - a.impact).slice(0, n);
}
