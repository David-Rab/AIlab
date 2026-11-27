// "Why did this change": the cause ledger (V2-SPEC §2.6). Owner: WS1.
//
// Every system that changes a top-level meter either
//   ctx.bump(key, Δ, source, detail)   — applies Δ (clamped) and records it, or
//   ctx.cause(key, Δ, source, detail)  — records a change it applied itself.
// Keys are the spec's meter keys (CAUSE_KEYS). Any dotted state path to a number also works ("player.morale.safety").
import type { CauseEntry, Day, GameStateV2 } from '../types';

export const CAUSE_RING = 40; // entries per key (§2.5 budget)

/** Spec meter keys (§2.6) → state path. */
export const CAUSE_KEYS: Record<string, string> = {
  'player.finance.valuation': 'player.finance.valuation',
  'finance.credibility': 'player.finance.credibility',
  cash: 'player.finance.cash',
  revenueRun: 'player.finance.revenueRun',
  'board.confidence': 'player.board.confidence',
  morale: 'player.morale.overall',
  'morale.safety': 'player.morale.safety',
  'world.unemployment.US': 'world.unemployment.US',
  'public.approval': 'public.approval',
  'public.concern': 'public.concern',
};

/** Clamp ranges by canonical key or path prefix; unlisted meters are unbounded. */
const RANGES: [prefix: string, lo: number, hi: number][] = [
  ['board.confidence', 0, 100],
  ['morale', 0, 100],
  ['world.unemployment.', 0, 100],
  ['player.finance.valuation', 0, Number.MAX_VALUE],
  ['finance.credibility', 0, 100],
  ['public.approval', -100, 100],
  ['public.concern', 0, 100],
  ['revenueRun', 0, Number.MAX_VALUE],
];

const PATH_TO_KEY: Record<string, string> = Object.fromEntries(Object.entries(CAUSE_KEYS).map(([k, p]) => [p, k]));

/** Canonical ledger key for a key or raw path ('player.finance.cash' → 'cash'). */
export function canonicalKey(key: string): string {
  return PATH_TO_KEY[key] ?? key;
}

function pathOf(key: string): string[] {
  return (CAUSE_KEYS[key] ?? key).split('.');
}

function rangeOf(key: string): [number, number] {
  for (const [p, lo, hi] of RANGES) if (key.startsWith(p)) return [lo, hi];
  return [-Number.MAX_VALUE, Number.MAX_VALUE];
}

export function recordCause(s: GameStateV2, key: string, delta: number, source: string, detail?: string, day: Day = s.time.day) {
  if (!delta || !Number.isFinite(delta)) return;
  const k = canonicalKey(key);
  const buf = (s.causes.byKey[k] ??= []);
  if (DAILY_KEYS[k]) {
    // Jank F1: cash moves every day from several sources; one entry per day and source, so the ledger covers the
    // window its readout names ("Why cash moved · 30 d") instead of the last 40 postings (≈ 17 days).
    for (let i = buf.length - 1; i >= 0 && buf[i].day === day; i--) {
      if (buf[i].source === source) {
        buf[i].delta += delta;
        return;
      }
    }
  }
  const e: CauseEntry = { day, delta, source };
  if (detail) e.detail = detail;
  buf.push(e);
  const cap = DAILY_KEYS[k] ?? CAUSE_RING;
  if (buf.length > cap) buf.splice(0, buf.length - cap);
}

/** Keys aggregated per day and source, with their entry cap (UI-only readers; ≥ 60 days of daily sources). Engine
 *  readers of other keys (board ouster odds read 'board.confidence') keep the 40-entry ring unchanged. */
const DAILY_KEYS: Record<string, number> = { cash: 600 };

/** Apply Δ to the meter (clamped) and record the applied amount. Throws on an unknown path (catch typos early). */
export function bumpMeter(s: GameStateV2, key: string, delta: number, source: string, detail?: string): number {
  const k = canonicalKey(key);
  const path = pathOf(k);
  let o: Record<string, unknown> = s as unknown as Record<string, unknown>;
  for (let i = 0; i < path.length - 1; i++) {
    const next = o[path[i]];
    if (next === null || typeof next !== 'object') throw new Error(`cause key "${key}": no object at ${path.slice(0, i + 1).join('.')}`);
    o = next as Record<string, unknown>;
  }
  const leaf = path[path.length - 1];
  const cur = o[leaf];
  if (typeof cur !== 'number') throw new Error(`cause key "${key}": ${path.join('.')} is not a number`);
  const [lo, hi] = rangeOf(k);
  const nv = Math.min(hi, Math.max(lo, cur + delta));
  o[leaf] = nv;
  const applied = nv - cur;
  recordCause(s, k, applied, source, detail);
  return applied;
}

export interface CauseStripRow { source: string; delta: number; n: number; details: string[] }

/** Tooltip strip: top `top` first-order causes by |ΣΔ| over the last `days` days (§2.6). */
export function causeStrip(s: GameStateV2, key: string, days = 30, top = 5): CauseStripRow[] {
  const buf = s.causes.byKey[canonicalKey(key)] ?? [];
  const from = s.time.day - days;
  const agg = new Map<string, CauseStripRow>();
  for (const e of buf) {
    if (e.day < from) continue;
    const r = agg.get(e.source) ?? { source: e.source, delta: 0, n: 0, details: [] };
    r.delta += e.delta;
    r.n++;
    if (e.detail && r.details.length < 3) r.details.push(e.detail);
    agg.set(e.source, r);
  }
  return [...agg.values()].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, top);
}

/** Weekly trim (record system): drop entries older than `keepDays`. */
export function trimCauses(s: GameStateV2, keepDays = 365) {
  const from = s.time.day - keepDays;
  for (const k of Object.keys(s.causes.byKey)) {
    const buf = s.causes.byKey[k].filter((e) => e.day >= from);
    if (buf.length) s.causes.byKey[k] = buf;
    else delete s.causes.byKey[k];
  }
}
