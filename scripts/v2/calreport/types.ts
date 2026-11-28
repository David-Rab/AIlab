import { TARGETS } from '../../../balance/targets';
import { CHECKPOINTS, type Checkpoint } from '../../../balance/scenarios';
import type { Target as RegTarget } from '../../../balance/schema';

/** One row of the calibration report (scripts/v2/calreport.ts). */
export interface Target {
  /** The registry id (balance/targets.ts), plus `@suffix` when the same target is read for several presets, seeds or marks. */
  id: string;
  /** What is measured, in words (the registry statement, plus the suffix). */
  label: string;
  /** The sourced band, as text (from the registry entry, through its scenario checkpoint when it names one). */
  band: string;
  /** The value the current code gives, as text. */
  value: string;
  /** In band. */
  ok: boolean;
  /** Where the band comes from (the registry entry's source). */
  source: string;
}

/** A resolved numeric band: lo / hi / p50 / slack (symmetric, added outside lo..hi or ± around p50) in `unit`. */
export type Band = { lo?: number; hi?: number; p50?: number; slack?: number; unit?: string };

const BY_ID = new Map<string, RegTarget>(TARGETS.map((t) => [t.id, t]));
const CP_BY_ID = new Map<string, Checkpoint>(CHECKPOINTS.map((c) => [c.id, c]));

/** The checkpoint ids a target names (none, one or several). */
export const checkpointIds = (t: RegTarget): string[] => (t.checkpoint === undefined ? [] : typeof t.checkpoint === 'string' ? [t.checkpoint] : t.checkpoint);

/**
 * The band of registry entry `t` (balance/schema.ts, "one home per sourced number"). A target with no checkpoint uses its own
 * `value`. A target that names checkpoint(s) takes the numbers and unit from balance/scenarios.ts: one checkpoint gives its
 * source band lo..hi and value as p50 (use 'band', the default when it has a band) or only its value as p50 (use 'value');
 * several give the hull of their values (and bands). Then the target's tolerance applies: `slackRel` (× |p50|, ± around p50),
 * a `slack` pair [below, above] (moved into lo / hi), or a `slack` number (kept as slack). Throws on an unknown checkpoint id.
 */
export function bandOfEntry(t: RegTarget, cps: ReadonlyMap<string, Checkpoint> = CP_BY_ID): Band {
  const ids = checkpointIds(t);
  let b: Band;
  if (!ids.length) b = { ...t.value };
  else {
    const cs = ids.map((id) => {
      const c = cps.get(id);
      if (!c) throw new Error(`registry target ${t.id}: checkpoint '${id}' is not in balance/scenarios.ts`);
      return c;
    });
    if (cs.length === 1) {
      const [c] = cs;
      const use = t.use ?? (c.lo !== undefined || c.hi !== undefined ? 'band' : 'value');
      b = use === 'band' ? { lo: c.lo, hi: c.hi, p50: c.value, unit: c.unit } : { p50: c.value, unit: c.unit };
    } else {
      const los = cs.map((c) => (t.use !== 'value' ? c.lo ?? c.value : c.value)).filter((x): x is number => x !== undefined);
      const his = cs.map((c) => (t.use !== 'value' ? c.hi ?? c.value : c.value)).filter((x): x is number => x !== undefined);
      b = { lo: Math.min(...los), hi: Math.max(...his), unit: cs[0].unit };
    }
  }
  if (t.slackRel !== undefined && b.p50 !== undefined) return { ...b, slack: Math.abs(b.p50) * t.slackRel };
  if (Array.isArray(t.slack)) {
    const [below, above] = t.slack;
    if (b.lo === undefined && b.hi === undefined && b.p50 !== undefined) return { ...b, lo: b.p50 - below, hi: b.p50 + above };
    return { ...b, lo: b.lo === undefined ? undefined : b.lo - below, hi: b.hi === undefined ? undefined : b.hi + above };
  }
  return { ...b, slack: t.slack };
}

/** The numeric band of registry target `id` (lo / hi / p50 / slack, in the entry's unit), or undefined for an unknown id.
 *  The one place that resolves a band: the calibration report (rowOf), the estimates (estimates/types.ts), the sanity
 *  bounds and the dashboard all read it. A target that names a scenario checkpoint resolves through it (bandOfEntry). */
export function bandOf(id: string): Band | undefined {
  const t = BY_ID.get(id);
  return t ? bandOfEntry(t) : undefined;
}
/** Float noise allowed on every comparison (the moved checks used the same 1e-9). */
const EPS = 1e-9;

const num = (x: number): string => (Math.abs(x) >= 1e6 ? `${+(x / 1e6).toPrecision(6)}M` : Number.isInteger(x) ? String(x) : String(+x.toPrecision(6)));
function bandText(t: RegTarget, b: Band): string {
  const { lo, hi, p50, unit } = b;
  const u = unit ? ` ${unit}` : '';
  if (lo !== undefined && hi !== undefined) return `${num(lo)} to ${num(hi)}${b.slack ? ` (± ${num(b.slack)})` : ''}${u}`;
  if (lo !== undefined) return `≥ ${num(lo)}${u}`;
  if (hi !== undefined) return `≤ ${num(hi)}${u}`;
  if (p50 !== undefined) return `${num(p50)}${b.slack ? ` ± ${num(b.slack)}` : ''}${u}`;
  return t.tolerance ?? t.statement;
}

function inBand(t: RegTarget, b: Band, x: number): boolean {
  const { lo, hi, p50 } = b;
  if (!Number.isFinite(x)) return false;
  const s = (b.slack ?? 0) + EPS;
  if (lo !== undefined || hi !== undefined) return (lo === undefined || x >= lo - s) && (hi === undefined || x <= hi + s);
  if (p50 !== undefined) return Math.abs(x - p50) <= s;
  throw new Error(`registry target ${t.id} has no lo, hi or p50: pass a boolean instead of a number`);
}

/**
 * The only way a calibration-report module makes a row (design/TESTING.md §0, one home per target): the id names an entry
 * of balance/targets.ts, which supplies the statement, band text, unit and source; this decides `ok` from the entry's
 * band (bandOf: its own lo/hi/p50, or its scenario checkpoint's, + its slack). Throws on an unknown id.
 *   measured  a number (in band), an array (every element in band; an empty array fails), or a boolean the module computed
 *             for targets with no numeric band (ordering, invariant, direction; the band text is the entry's tolerance).
 * A target whose registry role is 'info' is reported and never out of band.
 */
export function rowOf(id: string, value: string, measured: number | number[] | boolean, suffix?: string): Target {
  const t = BY_ID.get(id);
  if (!t) throw new Error(`calreport: unknown registry target id '${id}' (add it to balance/targets.ts)`);
  const b = bandOfEntry(t);
  let ok: boolean;
  if (typeof measured === 'boolean') ok = measured;
  else if (Array.isArray(measured)) ok = measured.length > 0 && measured.every((x) => inBand(t, b, x));
  else ok = inBand(t, b, measured);
  return {
    id: suffix ? `${id}@${suffix}` : id,
    label: suffix ? `${t.statement} (${suffix})` : t.statement,
    band: typeof measured === 'boolean' ? (t.tolerance ?? t.statement) : bandText(t, b),
    value,
    ok: ok || t.role === 'info',
    source: t.known ? `${t.source}; known: ${t.known}` : t.source,
  };
}
