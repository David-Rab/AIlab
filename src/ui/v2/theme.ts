// Colour semantics (DESIGN-SYSTEM §2), validated for CVD on the panel surface. CSS variables live in v2.css under
// body.v2; this map is for SVG and inline styles. Status hues are for state only, never identity.
export const C = {
  good: '#4cc38a', watch: '#e9b44c', bad: '#ef6b6b', crit: '#ff4d6d',
  cap: '#9b6be0', und: '#22a394',
  you: '#3a8ae0', rival: '#d4732a', china: '#c43c8c', neutral: '#9fb0c3',
  line: '#243041', line2: '#33435a', panel: '#151c26', panel2: '#1b2430', text: '#e3e9f1', text2: '#9fb0c3', text3: '#6b7c91',
} as const;

/** Department / sphere hues in their fixed order. */
export const SPHERE = { cap: '#9b6be0', saf: '#22a394', sec: '#3a8ae0', prod: '#b08e1a', ops: '#6b7c91' } as const;

/** Compute pools take their department's hue (experiments and training are capabilities). */
export const POOL_COLOR: Record<string, string> = {
  training: '#9b6be0', experiments: '#7d55c0', agents: '#b28cf0', synthetic: '#6b7c91', serving: '#b08e1a', safety: '#22a394', security: '#3a8ae0', engineering: '#c97a3a',
};

/** Sequential ramp (magnitude): dark teal → light teal. t in 0..1. */
export function seq(t: number): string {
  const c0 = [22, 48, 58];
  const c1 = [34, 163, 148];
  const c2 = [127, 224, 207];
  const x = Math.max(0, Math.min(1, t));
  const m = x < 0.7 ? c0.map((v, i) => v + ((c1[i] - v) * x) / 0.7) : c1.map((v, i) => v + ((c2[i] - v) * (x - 0.7)) / 0.3);
  return `rgb(${m.map(Math.round).join(',')})`;
}
/** Diverging: bad red ← neutral → understanding teal; x in −1..1. */
export function div(x: number): string {
  const n = [51, 67, 90];
  const lo = [239, 107, 107];
  const hi = [34, 163, 148];
  const t = Math.max(-1, Math.min(1, x));
  const to = t < 0 ? lo : hi;
  const a = Math.abs(t);
  return `rgb(${n.map((v, i) => Math.round(v + (to[i] - v) * a)).join(',')})`;
}
/** Severity colour for a "bad-is-high" 0..1 value. */
export const sev = (x: number) => (x > 0.5 ? C.bad : x > 0.3 ? '#e08a4c' : x > 0.15 ? C.watch : C.good);
/** Runway state from LIVE thresholds (board: distress < 3q, tight < 6q), not the lagging quarterly state. */
export function runwayState(q: number): 'healthy' | 'tight' | 'distress' {
  return q < 3 ? 'distress' : q < 6 ? 'tight' : 'healthy';
}
export const STATE_COLOR: Record<string, string> = { healthy: C.good, tight: C.watch, distress: C.bad, insolvent: C.crit };

/** One colour per lab, everywhere (end screen, World control, Overview race). You blue and China magenta are the actor
 *  hues; each US rival gets its own hue by slot (r0…r4), checked pairwise with the CVD validator (protan/deutan/tritan
 *  simulation, CIELAB ΔE ≥ 13 for every pair, incl. you and China). Your open weights take a darker blue. */
export const LAB_HUE: Record<string, string> = {
  player: '#3a8ae0', 'player:open': '#2f6fb8', china: '#c43c8c',
  r0: '#d4732a', r1: '#d8c447', r2: '#3fb59a', r3: '#a77b4f', r4: '#e6a3c8',
};
const RIVAL_FALLBACK = ['#d4732a', '#d8c447', '#3fb59a', '#a77b4f', '#e6a3c8'];
export function labColor(id: string): string {
  if (LAB_HUE[id]) return LAB_HUE[id];
  if (id.startsWith('player')) return LAB_HUE['player:open'];
  const n = Number(id.replace(/\D/g, ''));
  return RIVAL_FALLBACK[(Number.isFinite(n) ? n : id.charCodeAt(id.length - 1)) % RIVAL_FALLBACK.length];
}
/** Two-letter lab monogram ("OB", "GL", "XL"). */
export function monogram(name: string): string {
  const w = name.split(/[\s-]+/).filter(Boolean);
  const caps = name.replace(/[^A-Z]/g, '');
  return (w.length > 1 ? w[0][0] + w[1][0] : caps.length >= 2 ? caps.slice(0, 2) : name.slice(0, 2)).toUpperCase();
}
