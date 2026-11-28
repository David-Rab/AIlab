import { TARGETS } from '../../../balance/targets';
import type { Target as RegTarget } from '../../../balance/schema';

/** One row of the calibration report (scripts/v2/calreport.ts). */
export interface Target {
  /** The registry id (balance/targets.ts), plus `@suffix` when the same target is read for several presets, seeds or marks. */
  id: string;
  /** What is measured, in words (the registry statement, plus the suffix). */
  label: string;
  /** The sourced band, as text (from the registry entry). */
  band: string;
  /** The value the current code gives, as text. */
  value: string;
  /** In band. */
  ok: boolean;
  /** Where the band comes from (the registry entry's source). */
  source: string;
}

const BY_ID = new Map<string, RegTarget>(TARGETS.map((t) => [t.id, t]));
/** Float noise allowed on every comparison (the moved checks used the same 1e-9). */
const EPS = 1e-9;

const num = (x: number): string => (Math.abs(x) >= 1e6 ? `${+(x / 1e6).toPrecision(6)}M` : Number.isInteger(x) ? String(x) : String(+x.toPrecision(6)));
function bandText(t: RegTarget): string {
  const { lo, hi, p50, unit } = t.value;
  const u = unit ? ` ${unit}` : '';
  if (lo !== undefined && hi !== undefined) return `${num(lo)} to ${num(hi)}${u}`;
  if (lo !== undefined) return `≥ ${num(lo)}${u}`;
  if (hi !== undefined) return `≤ ${num(hi)}${u}`;
  if (p50 !== undefined) return `${num(p50)}${t.slack ? ` ± ${num(t.slack)}` : ''}${u}`;
  return t.tolerance ?? t.statement;
}

function inBand(t: RegTarget, x: number): boolean {
  const { lo, hi, p50 } = t.value;
  if (!Number.isFinite(x)) return false;
  const s = (t.slack ?? 0) + EPS;
  if (lo !== undefined || hi !== undefined) return (lo === undefined || x >= lo - s) && (hi === undefined || x <= hi + s);
  if (p50 !== undefined) return Math.abs(x - p50) <= s;
  throw new Error(`registry target ${t.id} has no lo, hi or p50: pass a boolean instead of a number`);
}

/**
 * The only way a calibration-report module makes a row (design/TESTING.md §0, one home per target): the id names an entry
 * of balance/targets.ts, which supplies the statement, band text, unit and source; this decides `ok` from the entry's
 * lo/hi/p50 (+ its `slack`). Throws on an unknown id.
 *   measured  a number (in band), an array (every element in band; an empty array fails), or a boolean the module computed
 *             for targets with no numeric band (ordering, invariant, direction; the band text is the entry's tolerance).
 * A target whose registry role is 'info' is reported and never out of band.
 */
export function rowOf(id: string, value: string, measured: number | number[] | boolean, suffix?: string): Target {
  const t = BY_ID.get(id);
  if (!t) throw new Error(`calreport: unknown registry target id '${id}' (add it to balance/targets.ts)`);
  let ok: boolean;
  if (typeof measured === 'boolean') ok = measured;
  else if (Array.isArray(measured)) ok = measured.length > 0 && measured.every((x) => inBand(t, x));
  else ok = inBand(t, measured);
  return {
    id: suffix ? `${id}@${suffix}` : id,
    label: suffix ? `${t.statement} (${suffix})` : t.statement,
    band: typeof measured === 'boolean' ? (t.tolerance ?? t.statement) : bandText(t),
    value,
    ok: ok || t.role === 'info',
    source: t.known ? `${t.source}; known: ${t.known}` : t.source,
  };
}
