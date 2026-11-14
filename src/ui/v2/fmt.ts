// v2 number formatting (DESIGN-SYSTEM §3): one formatter per unit, 2–3 significant figures, real minus signs,
// never a raw float. Every v2 panel formats through these; uitest fails on /\d\.\d{5,}/ in rendered text.

const MINUS = '−';
const sig = (x: number, d: number) => {
  const a = Math.abs(x);
  return a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(Math.min(d, 1)) : a.toFixed(d);
};
const sign = (x: number, always: boolean) => (x < 0 ? MINUS : always && x > 0 ? '+' : '');

/** Money in $B (engine unit). $1.2T, $25B, $3.4B, $450M. */
export function money(b: number, opts: { signed?: boolean; perYear?: boolean; perQ?: boolean } = {}): string {
  const a = Math.abs(b);
  const s = sign(b, !!opts.signed);
  const body = a >= 1000 ? `$${sig(a / 1000, 1)}T` : a >= 1 || a === 0 ? `$${sig(a, 1)}B` : `$${Math.round(a * 1000)}M`;
  return `${s}${body}${opts.perYear ? '/yr' : opts.perQ ? '/q' : ''}`;
}
/** Counts: 1.2K, 8.5M, 3.1B (H100e, people, robots). */
export function count(n: number, signed = false): string {
  const a = Math.abs(n);
  const s = sign(n, signed);
  if (a >= 1e9) return `${s}${sig(a / 1e9, 1)}B`;
  if (a >= 1e6) return `${s}${sig(a / 1e6, 1)}M`;
  if (a >= 1e4) return `${s}${Math.round(a / 1e3)}K`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(1)}K`;
  return `${s}${Math.round(a)}`;
}
/** Compute in H100e. */
export const h100e = (n: number) => count(n);
/** Fraction 0..1 → percent. */
export function pct(x: number, d = 0, signed = false): string {
  const v = x * 100;
  const a = Math.abs(v);
  const dd = a > 0 && a < 1 && d === 0 ? 1 : d;
  return `${sign(v, signed)}${a.toFixed(dd)}%`;
}
/** Percentage points (already ×100). */
export const pp = (x: number, d = 1) => `${sign(x, true)}${Math.abs(x).toFixed(d)} pp`;
/** Plain number with d decimals and a real minus. */
export const num = (x: number, d = 1, signed = false) => `${sign(x, signed)}${Math.abs(x).toFixed(d)}`;
/** Capability / understanding level. */
export const level = (x: number) => x.toFixed(1);
/** Signed level change. */
export const dLevel = (x: number) => num(x, 1, true);
/** Days: 12 d, 3.4 mo, 2.1 yr. */
export function days(d: number, signed = false): string {
  const a = Math.abs(d);
  const s = sign(d, signed);
  if (a >= 540) return `${s}${(a / 365).toFixed(1)} yr`;
  if (a >= 90) return `${s}${(a / 30.4).toFixed(1)} mo`;
  return `${s}${Math.round(a)} d`;
}
/** Lead in days, always signed (+ = you are ahead). */
export const lead = (d: number) => `${d > 0 ? '+' : d < 0 ? MINUS : ''}${Math.abs(Math.round(d))}d`;
/** Quarters of runway. */
export const quarters = (q: number) => (q >= 99 ? '∞' : `${q.toFixed(q < 10 ? 1 : 0)}q`);
/** Multipliers: 1.37×, 12.4×, 140×. */
export const mult = (m: number) => `${m >= 100 ? m.toFixed(0) : m >= 10 ? m.toFixed(1) : m.toFixed(2)}×`;
/** Megawatts / gigawatts. */
export const power = (mw: number) => (Math.abs(mw) >= 1000 ? `${(mw / 1000).toFixed(1)} GW` : `${Math.round(mw)} MW`);
/** 0..100 index. */
export const idx = (x: number) => `${Math.round(x)}`;
/** Generic short number (auto decimals). */
export const short = (x: number) => (Math.abs(x) >= 1000 ? count(x) : Math.abs(x) >= 10 ? x.toFixed(0) : Math.abs(x) >= 1 ? x.toFixed(1) : x.toFixed(2));
/** Engine id → words: 'heavyHardened' → 'heavy hardened', 'fullPlusExternal' → 'full plus external'. */
export const words = (id: string) => id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').toLowerCase();
