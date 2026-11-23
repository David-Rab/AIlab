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
  // Jank AG2: one money format; zero is "$0", not "$0.0B" next to "$160M".
  const body = a === 0 ? '$0' : a >= 1000 ? `$${sig(a / 1000, 1)}T` : a >= 1 ? `$${sig(a, 1)}B` : `$${Math.round(a * 1000)}M`;
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
/** Sight limit readout: "level 6.8 (6.2–7.1)" (UB-4: no L prefix), or "none (0–6.8)" when no level is read at 50% (the engine's L 0 is a floor). */
export const sight = (u: { none: boolean; L: number; lo: number; hi: number }) =>
  u.none ? `none${u.hi > 0 ? ` (0–${level(u.hi)})` : ''}` : `level ${level(u.L)} (${level(u.lo)}–${level(u.hi)})`;
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
/** Quarters (of spending, of cover). */
export const quarters = (q: number) => (q >= 99 ? '∞' : `${q.toFixed(q < 10 ? 1 : 0)}q`);
/** Runway in quarters: "8q+" when cash lasts the whole projection (RUNWAY_CAP in engine finance/runway.ts). */
export const runway = (q: number, cap = 8) => (q >= cap ? `${cap}q+` : quarters(q));
/** Multipliers: 1.37×, 12.4×, 140×. */
export const mult = (m: number) => `${m >= 100 ? m.toFixed(0) : m >= 10 ? m.toFixed(1) : m.toFixed(2)}×`;
/** Base-run size as a multiple of the frontier run: ×¼, ×½, ×1, ×1.5, ×2 … */
export const size = (x: number) => {
  if (Math.abs(x - 0.25) < 1e-3) return '×¼';
  if (Math.abs(x - 0.5) < 1e-3) return '×½';
  return `×${x >= 10 ? x.toFixed(0) : x >= 1 ? +x.toFixed(1) : +x.toFixed(2)}`;
};
/** Megawatts / gigawatts. */
export const power = (mw: number) => (Math.abs(mw) >= 1000 ? `${(mw / 1000).toFixed(1)} GW` : `${Math.round(mw)} MW`);
/** 0..100 index. */
export const idx = (x: number) => `${Math.round(x)}`;
/** Generic short number (auto decimals). */
export const short = (x: number) => (Math.abs(x) >= 1000 ? count(x) : Math.abs(x) >= 10 ? x.toFixed(0) : Math.abs(x) >= 1 ? x.toFixed(1) : x.toFixed(2));
/** A duration in minutes (time horizons): 40 min, 3.2 h, 5 wk (40 h), > 1 yr (work-years; jank PR8: beyond a year of
 *  work the exact figure means nothing). */
export function minutes(m: number): string {
  if (m < 60) return `${Math.round(m)} min`;
  if (m < 60 * 40) return `${(m / 60).toFixed(m < 600 ? 1 : 0)} h`;
  const wk = m / (40 * 60);
  return wk < 52 ? `${wk.toFixed(wk < 10 ? 1 : 0)} wk` : '> 1 yr';
}
/** Benchmark score: special rows (horizon minutes, speedrun ×) get their own units. */
export function bench(score: number, special?: 'horizon' | 'speedrun'): string {
  if (special === 'horizon') return minutes(score);
  if (special === 'speedrun') return score >= 1e6 ? '> 10⁶×' : mult(score);
  return score.toFixed(1);
}
/** Engine id → words: 'heavyHardened' → 'heavy hardened', 'fullPlusExternal' → 'full plus external'. */
export const words = (id: string) => id.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').toLowerCase();
/** Small dollar amounts (per hour of use): $1,240, $12.5, $0.42, $0.042; under a cent in cents (0.12¢). */
export const usd = (x: number) => {
  const a = Math.abs(x);
  const s = x < 0 ? MINUS : '';
  if (a > 0 && a < 0.01) return `${s}${(a * 100).toFixed(2)}¢`;
  return `${s}$${a >= 1000 ? Math.round(a).toLocaleString('en-US') : a >= 100 ? a.toFixed(0) : a >= 10 ? a.toFixed(1) : a >= 0.1 ? a.toFixed(2) : a.toFixed(3)}`;
};
/** Scientific notation for FLOP: 1.6e12. */
export const sci = (x: number) => { const [m, e] = x.toExponential(1).split('e'); return `${m}e${Number(e)}`; };

/** UB-5b: player run names in text. Runs launched before UB-4 (older saves, the fixtures) keep engine names such as
 *  "post 30" or "distill 64" in their name and log lines; shown as VOCAB names ("Post-training run 30"). */
const LEGACY_RUN: Record<string, string> = { post: 'Post-training', base: 'Pretraining', continue: 'Continued pretraining', distill: 'Distil', IDA: 'Amplify' };
export const runText = (t: string) => t.replace(/\b(post|base|continue|distill|IDA) (\d+)\b/g, (_, k: string, n: string) => `${LEGACY_RUN[k]} run ${n}`);
