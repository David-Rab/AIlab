// Run-time registry parameter overrides (design/bal/TOOLING-DESIGN.md, C3). Sets live game constants without editing code.
//
//   await applyOverrides({ 'cap.V3_CAL.tl-central.gSC': 33.2, 'bots.ref.REF_TREE': 1.5 })
//
// Supported: `export` refs whose path ends in a field of an object or array (the field is replaced), and `'*'` families
// (the path ends in '*', or has '*' inside it). Value semantics:
//   - plain field: the value REPLACES the field (number, string, boolean, or number[] for an array-valued field).
//   - family ('*' anywhere in the path): a NUMBER value MULTIPLIES every numeric member (1.1 = +10%); a non-numeric member
//     is an error. Any other value type (string, boolean, array) SETS every member.
// A path step '#P24' picks the array element whose `id` is P24 (registry-lint.ts walks it the same way).
// Rejected, with an error naming the id: unknown id, `inline` refs (a literal inside a formula), refs with an empty path
// (a top-level export is a read-only ES module binding), paths that do not resolve. After setting, the live value is read
// back; if it did not change (frozen object, or a module that copied the value at import time) that is an error too.
// Params of kind 'fitted' ARE overridable: 'fitted' says how the number was chosen, not that it is unreachable.
// Overrides mutate the already-loaded module objects of THIS process; they are not undone. balrun therefore gives each
// worker process exactly one override set.
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Param } from '../../balance/schema';

export type OverrideValue = number | string | boolean | number[];
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

let REGISTRY: Promise<Map<string, Param>> | undefined;
export function loadParams(): Promise<Map<string, Param>> {
  REGISTRY ??= (async () => {
    const dir = join(ROOT, 'balance', 'params');
    const m = new Map<string, Param>();
    for (const n of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
      const mod = (await import(pathToFileURL(join(dir, n)).href)) as Record<string, unknown>;
      for (const k of Object.keys(mod)) if (k.startsWith('PARAMS_')) for (const p of mod[k] as Param[]) m.set(p.id, p);
    }
    return m;
  })();
  return REGISTRY;
}

/** Why a param cannot be overridden, or null if it can (structural check only; the path is resolved when applying). */
export function unsupportedReason(p: Param): string | null {
  if (p.ref.kind === 'inline') return 'inline ref: the number is a literal inside a formula, there is no field to set';
  if (!p.ref.path || p.ref.path.length === 0) return 'top-level export: ES module bindings are read-only';
  return null;
}

type Slot = { parent: Record<string, unknown>; key: string };
/** Every (parent, key) the path names; '*' as the last step expands to every key of each parent, inside the path it fans out. */
function slots(root: unknown, path: (string | number)[]): Slot[] {
  let level: unknown[] = [root];
  for (const step of path.slice(0, -1)) {
    level = level.flatMap((v) => {
      if (!isObj(v)) return [];
      if (step === '*') return Array.isArray(v) ? v : Object.values(v);
      if (typeof step === 'string' && step.startsWith('#')) return Array.isArray(v) ? v.filter((x) => isObj(x) && x.id === step.slice(1)) : [];
      return String(step) in v ? [(v as Record<string, unknown>)[String(step)]] : [];
    });
  }
  const last = String(path[path.length - 1]);
  return level.filter(isObj).flatMap((parent) => (last === '*' ? Object.keys(parent).map((key) => ({ parent, key })) : last in parent ? [{ parent, key: last }] : []));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export async function applyOverrides(o: Record<string, OverrideValue>): Promise<void> {
  const reg = await loadParams();
  for (const [id, value] of Object.entries(o)) {
    const p = reg.get(id);
    if (!p) throw new Error(`override ${id}: no such registry param`);
    const why = unsupportedReason(p);
    if (why) throw new Error(`override ${id}: ${why}`);
    const ref = p.ref as Extract<Param['ref'], { kind: 'export' }>;
    const path = ref.path!;
    const family = path.includes('*');
    const mod = (await import(pathToFileURL(join(ROOT, ref.module)).href)) as Record<string, unknown>;
    if (!(ref.symbol in mod)) throw new Error(`override ${id}: ${ref.module} has no export ${ref.symbol}`);
    const targets = slots(mod[ref.symbol], path);
    if (!targets.length) throw new Error(`override ${id}: path ${JSON.stringify(path)} did not resolve in ${ref.symbol}`);
    for (const { parent, key } of targets) {
      const before = parent[key];
      let next: unknown = value;
      if (family && typeof value === 'number') {
        if (typeof before !== 'number') throw new Error(`override ${id}: family member ${key} is ${typeof before}, cannot multiply by ${value}`);
        next = before * value;
      }
      try { parent[key] = Array.isArray(next) ? [...next] : next; } catch (e) { throw new Error(`override ${id}: cannot set ${key} (${(e as Error).message})`); }
      if (!same(parent[key], next)) throw new Error(`override ${id}: ${key} did not change when set (frozen object?)`);
    }
  }
}

/** Dry run over the whole registry: how many params can be overridden, by kind (resolves each path, sets nothing). */
export async function overridableCensus(ids?: string[]) {
  const reg = await loadParams();
  const out: Record<string, number> = { total: reg.size, overridableField: 0, overridableFamily: 0, inline: 0, topLevel: 0, unresolved: 0 };
  const byKind: Record<string, { ok: number; no: number }> = {};
  for (const p of reg.values()) {
    const k = (byKind[p.kind] ??= { ok: 0, no: 0 });
    const why = unsupportedReason(p);
    if (why) { out[p.ref.kind === 'inline' ? 'inline' : 'topLevel']++; k.no++; continue; }
    const ref = p.ref as Extract<Param['ref'], { kind: 'export' }>;
    let ok = false;
    try {
      const mod = (await import(pathToFileURL(join(ROOT, ref.module)).href)) as Record<string, unknown>;
      ok = ref.symbol in mod && slots(mod[ref.symbol], ref.path!).length > 0;
    } catch { /* unresolved */ }
    if (ok) ids?.push(p.id);
    if (ok) { out[ref.path!.includes('*') ? 'overridableFamily' : 'overridableField']++; k.ok++; } else { out.unresolved++; k.no++; }
  }
  return { ...out, byKind };
}

if (process.argv[1]?.includes('paramOverride') && process.argv.includes('--census')) {
  const ids: string[] = [];
  const census = await overridableCensus(ids);
  console.log(JSON.stringify(census, null, 1));
  if (process.argv.includes('--ids')) console.log(ids.join('\n')); // --census --ids: also list every overridable id
}
