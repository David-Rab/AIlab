// Run designer helpers (pure, UI side): how a recipe's training signals travel through the trait graph's edges.
// Inputs are the visible run card signals and the trait graph (public mean weights w̄ or revealed weights). The
// magnitudes the panel shows come from the engine's runTraitPressure selector; these helpers explain them: which
// edge carries a trait's pressure (first or second order) and the main causal path of a recipe.
import type { TraitId } from '../../../engine/v2';

export interface GraphEdge { id: string; from: string[]; to: string; grade: string; cite: string; moderator?: string; weight: number }
export type SignalMap = Partial<Record<string, number>>;

const isSignal = (x: string) => /^S\d$/.test(x);

/** ▲▲▲ / ▼ arrows for a change in a trait (0 arrows below 0.01). */
export function arrows(d: number): string {
  const a = Math.abs(d);
  const n = a >= 0.06 ? 3 : a >= 0.025 ? 2 : a >= 0.008 ? 1 : 0;
  return (d > 0 ? '▲' : '▼').repeat(n);
}

export interface TraitPush { trait: TraitId; d: number; via: GraphEdge; order: 1 | 2 }

/**
 * First- and second-order push of signals into traits along the graph: first[t] = Σ_e w_e · mean(signal inputs of e);
 * second[t'] = Σ_e w_e · first[t] over trait → trait edges. Returns, per trait, the push and its strongest edge.
 */
export function traitPushes(edges: GraphEdge[], sig: SignalMap): TraitPush[] {
  const first = new Map<string, { d: number; via?: GraphEdge; best: number }>();
  for (const e of edges) {
    const ins = e.from.filter(isSignal);
    if (!ins.length || ins.length !== e.from.length) continue;
    const x = e.weight * (ins.reduce((a, f) => a + (sig[f] ?? 0), 0) / ins.length);
    const cur = first.get(e.to) ?? { d: 0, best: 0 };
    cur.d += x;
    if (Math.abs(x) > cur.best) { cur.best = Math.abs(x); cur.via = e; }
    first.set(e.to, cur);
  }
  const out = new Map<string, TraitPush>();
  for (const [t, v] of first) if (v.via) out.set(t, { trait: t as TraitId, d: v.d, via: v.via, order: 1 });
  for (const e of edges) {
    const ins = e.from.filter((f) => !isSignal(f) && first.has(f));
    if (!ins.length) continue;
    const x = e.weight * Math.max(...ins.map((f) => first.get(f)!.d));
    const cur = out.get(e.to);
    if (!cur) out.set(e.to, { trait: e.to as TraitId, d: x, via: e, order: 2 });
    else if (cur.order === 2) { cur.d += x; if (Math.abs(x) > Math.abs(cur.d - x)) cur.via = e; }
  }
  return [...out.values()];
}

export interface PathStep { node: string; edge?: GraphEdge }

/** The main causal path of a signal change: the strongest signal, then the strongest edge out of each node (≤ 3 hops). */
export function mainPath(edges: GraphEdge[], dSig: SignalMap): PathStep[] {
  const top = Object.entries(dSig).filter(([, v]) => (v ?? 0) > 0.02).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
  if (!top) return [];
  const steps: PathStep[] = [{ node: top[0] }];
  let cur = top[0];
  const seen = new Set([cur]);
  for (let i = 0; i < 3; i++) {
    const out = edges.filter((e) => e.from.includes(cur) && !seen.has(e.to)).sort((a, b) => b.weight - a.weight)[0];
    if (!out || out.weight < 0.15) break;
    steps.push({ node: out.to, edge: out });
    seen.add(out.to);
    cur = out.to;
  }
  return steps;
}

/** Signal change a → b (only the ones that move). */
export function signalDelta(a: SignalMap, b: SignalMap): SignalMap {
  const d: SignalMap = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = (b[k] ?? 0) - (a[k] ?? 0);
    if (Math.abs(x) > 1e-3) d[k] = x;
  }
  return d;
}
