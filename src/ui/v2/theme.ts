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
  training: '#9b6be0', experiments: '#7d55c0', agents: '#b28cf0', synthetic: '#6b7c91', serving: '#b08e1a', safety: '#22a394', security: '#3a8ae0',
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
