// Simulation cache for the v2 test scripts (T0). Owner: WS1.
//
// A reference game run (bot, setup, seed, days, options) is computed once per code version and its record (whatever the
// test reads: milestone days, series, end-state picks) is reused by later runs and by other scripts.
//
//   cached(name, key, files, compute)  → compute()'s result, from .simcache/ when the same key and code were seen.
//
// Key = sha256 of: the code hash (every file under src/ except the UI — src/ui/** and src/main.tsx, which no engine or
// data module imports; if any hashed file ever imports the UI, the UI is hashed too — plus scripts/v2/lib.ts, this file,
// the caller's `files` (the script that defines the run and its record, and any helper it plays through), the committed
// scripts/v2/fixtures/** and scripts/v2/golden/** data, package-lock.json and the Node version) + `name` + the JSON of
// `key`. Any code change therefore invalidates every entry; there is no
// partial invalidation. Records are JSON: on a miss the computed value is round-tripped through JSON before it is
// returned, so a test sees exactly the same value from a cold run and from the cache.
//
// SIMCACHE=off      compute every run, return it untouched, read and write nothing (the reference behaviour).
// SIMCACHE=refresh  compute every run and overwrite the entries.
// SIMCACHE=on       (default) read, else compute and write.
// The cache lives in .simcache/ at the repo root (git-ignored, never committed). Hit/miss counts go to stderr at exit.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(HERE, '..', '..');
export const CACHE_DIR = join(ROOT, '.simcache');
export type CacheMode = 'on' | 'off' | 'refresh';
export const CACHE_MODE: CacheMode = ((): CacheMode => {
  const m = (process.env.SIMCACHE ?? 'on').toLowerCase();
  if (m === 'off' || m === '0' || m === 'false') return 'off';
  if (m === 'refresh') return 'refresh';
  return 'on';
})();

function walk(dir: string, out: string[]) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const rel = (p: string) => relative(ROOT, p).replace(/\\/g, '/');
const isUi = (r: string) => r.startsWith('src/ui/') || r === 'src/main.tsx';
/** Does the file import anything under src/ui (or main.tsx)? Resolves relative specifiers against the file. */
function importsUi(abs: string, text: string): boolean {
  for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue;
    const r = rel(resolve(dirname(abs), spec));
    if (r === 'src/ui' || isUi(r) || r.startsWith('src/ui/') || r === 'src/main') return true;
  }
  return false;
}

const codeMemo = new Map<string, string>();
/** Content hash of the simulation code plus `files` (absolute paths). */
export function codeHash(files: string[] = []): string {
  const extra = [...new Set(files.map((f) => resolve(f)))].sort();
  const memoKey = extra.join('|');
  const hit = codeMemo.get(memoKey);
  if (hit) return hit;
  const all = walk(join(ROOT, 'src'), []).map((p) => ({ abs: p, r: rel(p) }));
  const texts = new Map(all.map((f) => [f.r, readFileSync(f.abs)]));
  // The committed fixtures and golden files are data some runs read (directorEndings E2 fuzzes the fixtures): always hashed.
  const data = ['fixtures', 'golden'].flatMap((d) => (existsSync(join(HERE, d)) ? walk(join(HERE, d), []) : [])).sort();
  const scripts = [join(HERE, 'lib.ts'), fileURLToPath(import.meta.url), ...extra, ...data, join(ROOT, 'package-lock.json')];
  const scriptTexts = scripts.filter((p) => existsSync(p)).map((p) => ({ abs: p, r: rel(p), t: readFileSync(p) }));
  // The UI is left out only while nothing hashed imports it (if unsure, invalidate).
  const nonUi = all.filter((f) => !isUi(f.r));
  const uiNeeded = [...nonUi.map((f) => ({ abs: f.abs, t: texts.get(f.r) as Buffer })), ...scriptTexts].some((f) => importsUi(f.abs, f.t.toString('utf8')));
  const chosen = (uiNeeded ? all : nonUi).sort((a, b) => (a.r < b.r ? -1 : a.r > b.r ? 1 : 0));
  const h = createHash('sha256');
  h.update(`node ${process.version}\0`);
  for (const f of chosen) h.update(`${f.r}\0`).update(texts.get(f.r) as Buffer).update('\0');
  for (const f of scriptTexts) h.update(`${f.r}\0`).update(f.t).update('\0');
  const out = h.digest('hex');
  codeMemo.set(memoKey, out);
  return out;
}

/** JSON with sorted object keys (a stable key encoding). */
export function stableJson(x: unknown): string {
  return JSON.stringify(x, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));
}

/** Values a JSON round trip would change: NaN, ±Infinity, undefined in arrays, functions, Maps, Sets, class instances. */
function notJson(x: unknown, path: string, errs: string[]): string[] {
  if (errs.length > 5) return errs;
  if (typeof x === 'number') {
    if (!Number.isFinite(x)) errs.push(`${path} = ${x}`);
  } else if (typeof x === 'function' || typeof x === 'bigint' || typeof x === 'symbol') errs.push(`${path} is a ${typeof x}`);
  else if (Array.isArray(x)) x.forEach((v, i) => (v === undefined ? errs.push(`${path}[${i}] is undefined`) : notJson(v, `${path}[${i}]`, errs)));
  else if (x && typeof x === 'object') {
    const proto = Object.getPrototypeOf(x);
    if (proto !== Object.prototype && proto !== null) errs.push(`${path} is a ${proto?.constructor?.name ?? 'non-plain object'}`);
    else for (const [k, v] of Object.entries(x)) if (v !== undefined) notJson(v, `${path}.${k}`, errs);
  }
  return errs;
}

const stats = { hits: 0, misses: 0, off: 0, names: new Map<string, { hits: number; misses: number }>() };
let reported = false;
process.on('exit', () => {
  if (reported || stats.hits + stats.misses + stats.off === 0) return;
  reported = true;
  process.stderr.write(`simcache: ${stats.hits} hit(s), ${stats.misses} miss(es)${stats.off ? `, ${stats.off} uncached (SIMCACHE=off)` : ''}\n`);
});

/**
 * The record of one simulation, cached. `name` labels the run family (part of the key and the file name); `key` is
 * everything else that selects the run (setup, seed, bot, days, options); `files` are the absolute paths of the scripts
 * whose code defines the run and the record (normally the caller: `fileURLToPath(import.meta.url)`, plus helpers such
 * as safety-emu.ts). `compute` must be deterministic and return plain JSON (no undefined in arrays, NaN or Infinity).
 */
export function cached<T>(name: string, key: unknown, files: string[], compute: () => T): T {
  if (CACHE_MODE === 'off') {
    stats.off++;
    return compute();
  }
  const keyJson = stableJson(key);
  const code = codeHash(files);
  const kh = createHash('sha256').update(code).update('\0').update(name).update('\0').update(keyJson).digest('hex');
  const safe = name.replace(/[^a-z0-9.-]+/gi, '_').slice(0, 60);
  const file = join(CACHE_DIR, `${safe}-${code.slice(0, 8)}-${kh.slice(0, 16)}.json`);
  const per = stats.names.get(name) ?? { hits: 0, misses: 0 };
  stats.names.set(name, per);
  if (CACHE_MODE === 'on' && existsSync(file)) {
    try {
      const rec = JSON.parse(readFileSync(file, 'utf8')) as { name: string; key: string; code: string; value: T };
      if (rec.code === code && rec.name === name && rec.key === keyJson) {
        try { utimesSync(file, new Date(), new Date()); } catch { /* ignore */ }
        stats.hits++;
        per.hits++;
        return rec.value;
      }
    } catch {
      // unreadable (e.g. a concurrent writer died): recompute
    }
  }
  stats.misses++;
  per.misses++;
  const value = compute();
  const text = JSON.stringify({ name, key: keyJson, code, value });
  const bad = notJson(value, 'value', []);
  if (bad.length) throw new Error(`simcache ${name}: record is not plain JSON (${bad.slice(0, 3).join('; ')})`);
  mkdirSync(CACHE_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  try {
    renameSync(tmp, file);
  } catch {
    try { unlinkSync(tmp); } catch { /* ignore */ }
  }
  return (JSON.parse(text) as { value: T }).value;
}

/** A structural subset of `obj` at the given dot paths (e.g. 'player.finance.rounds'), for records that keep a test's
 *  `s.a.b.c` reads unchanged. Reading a path that was not picked gives undefined (and the with/without-cache comparison
 *  catches it). */
export function pick<T>(obj: T, paths: string[]): T {
  const out: Record<string, unknown> = {};
  for (const p of paths) {
    const parts = p.split('.');
    let src: unknown = obj;
    let dst = out;
    for (let i = 0; i < parts.length; i++) {
      const k = parts[i];
      if (src === undefined || src === null) break;
      const v = (src as Record<string, unknown>)[k];
      if (i === parts.length - 1) dst[k] = v;
      else {
        dst = (dst[k] ??= {}) as Record<string, unknown>;
        src = v;
      }
    }
  }
  return out as T;
}

/** Delete cache entries older than `days` (by modification time). Returns the number removed. */
export function pruneCache(days = 3): number {
  if (!existsSync(CACHE_DIR)) return 0;
  const cutoff = Date.now() - days * 864e5;
  let n = 0;
  for (const f of readdirSync(CACHE_DIR)) {
    if (!f.endsWith('.json') || f === 'last-run.json') continue;
    const p = join(CACHE_DIR, f);
    try {
      if (statSync(p).mtimeMs < cutoff) {
        unlinkSync(p);
        n++;
      }
    } catch { /* ignore */ }
  }
  return n;
}

/** `--prefill k/n` on a script's command line: the runner starts n shards of a long script before the script itself. */
export const PREFILL: { k: number; n: number } | undefined = (() => {
  const i = process.argv.indexOf('--prefill');
  const m = i >= 0 ? /^(\d+)\/(\d+)$/.exec(process.argv[i + 1] ?? '') : null;
  return m ? { k: Number(m[1]), n: Number(m[2]) } : undefined;
})();

/**
 * Under --prefill k/n: run every n-th of `runs` (from k), each of which calls cached(), so the entries are in the cache
 * when the script itself runs; then exit without checking anything. Otherwise a no-op. The script must list exactly the
 * runs its checks will ask for (same keys), else the script simply computes the missing ones itself.
 */
export function prefill(runs: (() => unknown)[]): void {
  if (!PREFILL) return;
  let n = 0;
  runs.forEach((run, i) => {
    if (i % PREFILL.n !== PREFILL.k) return;
    run();
    n++;
  });
  console.log(`prefill ${PREFILL.k}/${PREFILL.n}: ${n} of ${runs.length} runs cached`);
  process.exit(0);
}
