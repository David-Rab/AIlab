// "Why did this change": the cause ledger (V2-SPEC §2.6). Owner: WS1.
//
// Every system that changes a top-level meter either
//   ctx.bump(key, Δ, source, detail)   — applies Δ (clamped) and records it, or
//   ctx.cause(key, Δ, source, detail)  — records a change it applied itself.
// Keys are the spec's meter keys (CAUSE_KEYS). Any dotted state path to a number also works ("pub.activism").
import type { CauseEntry, Day, GameStateV2 } from '../types';

export const CAUSE_RING = 40; // entries per key (§2.5 budget)

/** Spec meter keys (§2.6) → state path. `trust:<cp>` keys are handled dynamically. */
export const CAUSE_KEYS: Record<string, string> = {
  'relations.credibility': 'relations.credibility',
  'relations.scrutiny': 'relations.scrutiny',
  'relations.talentPull': 'relations.talentPull',
  'pub.approval': 'pub.approval',
  'pub.concern': 'pub.concern',
  'player.finance.valuation': 'player.finance.valuation',
  cash: 'player.finance.cash',
  revenueRun: 'player.finance.revenueRun',
  'board.confidence': 'player.board.confidence',
  'player.pa': 'player.pa',
  morale: 'player.morale.overall',
  'morale.safety': 'player.morale.safety',
  'gov.securityDemand': 'gov.securityDemand',
  'gov.nationalization': 'gov.nationalization',
  'china.theftIntent': 'china.meters.theftIntent',
  'world.unemployment.US': 'world.unemployment.US',
};

/** Clamp ranges by canonical key or path prefix; unlisted meters are unbounded. */
const RANGES: [prefix: string, lo: number, hi: number][] = [
  ['trust:', 0, 100],
  ['relations.credibility', 0, 100],
  ['relations.scrutiny', 0, 100],
  ['relations.talentPull', -50, 50],
  ['pub.approval', -100, 100],
  ['pub.', 0, 100],
  ['board.confidence', 0, 100],
  ['morale', 0, 100],
  ['gov.', 0, 100],
  ['china.theftIntent', 0, 100],
  ['china.meters.', 0, 100],
  ['world.unemployment.', 0, 100],
  ['player.finance.valuation', 0, Number.MAX_VALUE],
  ['revenueRun', 0, Number.MAX_VALUE],
];

const PATH_TO_KEY: Record<string, string> = Object.fromEntries(Object.entries(CAUSE_KEYS).map(([k, p]) => [p, k]));

/** Canonical ledger key for a key or raw path ('player.finance.cash' → 'cash'). */
export function canonicalKey(key: string): string {
  return PATH_TO_KEY[key] ?? key;
}

function pathOf(key: string): string[] {
  if (key.startsWith('trust:')) return ['relations', 'stocks', key.slice(6), 'trust'];
  return (CAUSE_KEYS[key] ?? key).split('.');
}

function rangeOf(key: string): [number, number] {
  for (const [p, lo, hi] of RANGES) if (key.startsWith(p)) return [lo, hi];
  return [-Number.MAX_VALUE, Number.MAX_VALUE];
}

/** Read the meter behind a cause key (undefined if the path does not lead to a number). */
export function readMeter(s: GameStateV2, key: string): number | undefined {
  let o: unknown = s;
  for (const k of pathOf(canonicalKey(key))) {
    if (o === null || typeof o !== 'object') return undefined;
    o = (o as Record<string, unknown>)[k];
  }
  return typeof o === 'number' ? o : undefined;
}

export function recordCause(s: GameStateV2, key: string, delta: number, source: string, detail?: string, day: Day = s.time.day) {
  if (!delta || !Number.isFinite(delta)) return;
  const k = canonicalKey(key);
  const buf = (s.causes.byKey[k] ??= []);
  const e: CauseEntry = { day, delta, source };
  if (detail) e.detail = detail;
  buf.push(e);
  if (buf.length > CAUSE_RING) buf.splice(0, buf.length - CAUSE_RING);
}

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
