// Balance registry lint (design/bal/REGISTRY-DESIGN.md). Run: npm run registry:lint
//   --area <name>   lint only balance/params/<name>.ts (coverage skipped)
//   --self-test     check that deliberately bad in-memory entries are caught; writes no files
let PARTIAL = false; // set when --area loads a single params file
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Param, Target, ExportRef } from '../../balance/schema';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\.\//, '');

// ---------- ref resolution ----------
const moduleCache = new Map<string, Promise<Record<string, unknown>>>();
const loadModule = (module: string) => {
  let m = moduleCache.get(module);
  if (!m) { m = import(pathToFileURL(join(ROOT, module)).href); moduleCache.set(module, m); }
  return m;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Walk `path` from `v`; '*' fans out over every element or key. Returns the matched live values. */
function walk(v: unknown, path: (string | number)[]): unknown[] {
  if (path.length === 0) return [v];
  const [head, ...rest] = path;
  if (!isObj(v)) return [];
  if (head === '*') return (Array.isArray(v) ? v : Object.values(v)).flatMap((x) => walk(x, rest));
  if (!(String(head) in v)) return [];
  return walk((v as Record<string, unknown>)[String(head)], rest);
}

function deepEq(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Object.is(a, b) || a === b;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEq(x, b[i]));
  if (isObj(a) && isObj(b) && !Array.isArray(a) && !Array.isArray(b)) {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => k in b && deepEq(a[k], b[k]));
  }
  return a === b;
}

const show = (v: unknown) => { const s = JSON.stringify(v); return s === undefined ? String(v) : s.length > 80 ? s.slice(0, 77) + '...' : s; };

async function checkExport(p: Param, ref: ExportRef): Promise<string[]> {
  let mod: Record<string, unknown>;
  try { mod = await loadModule(ref.module); } catch (e) { return [`${p.id}: cannot import ${ref.module}: ${(e as Error).message.split('\n')[0]}`]; }
  if (!(ref.symbol in mod)) return [`${p.id}: ${ref.module} has no export ${ref.symbol}`];
  const path = ref.path ?? [];
  const live = walk(mod[ref.symbol], path);
  const star = path.includes('*');
  if (live.length === 0) return [`${p.id}: path ${show(path)} unresolved in ${ref.symbol}${star ? ' (matched 0)' : ''}`];
  if (p.value === undefined) return [];
  const [got] = live;
  // An object of numbers may be registered as an array of its values (key order).
  const cmp = Array.isArray(p.value) && isObj(got) && !Array.isArray(got) ? Object.values(got) : got;
  return deepEq(cmp, p.value) ? [] : [`${p.id}: value mismatch, registry ${show(p.value)}, live ${show(cmp)}`];
}

function checkInline(p: Param, file: string, anchor: string): string[] {
  const abs = join(ROOT, file);
  if (!existsSync(abs)) return [`${p.id}: file not found ${file}`];
  const text = readFileSync(abs, 'utf8');
  const lines: number[] = [];
  for (let i = text.indexOf(anchor); i >= 0; i = text.indexOf(anchor, i + 1)) lines.push(text.slice(0, i).split('\n').length);
  if (lines.length === 1) return [];
  return [`${p.id}: anchor in ${file} matches ${lines.length} times${lines.length ? ` (lines ${lines.join(', ')})` : ''}`];
}

async function resolveParam(p: Param): Promise<string[]> {
  return p.ref.kind === 'export' ? checkExport(p, p.ref) : checkInline(p, p.ref.file, p.ref.anchor);
}

// ---------- cross-checks ----------
function crossChecks(params: Param[], targets: Target[]): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  for (const p of params) {
    if (seen.has(p.id)) errs.push(`${p.id}: duplicate param id`);
    seen.add(p.id);
  }
  const tseen = new Set<string>();
  for (const t of targets) {
    if (tseen.has(t.id)) errs.push(`${t.id}: duplicate target id`);
    tseen.add(t.id);
  }
  for (const p of params) {
    if (p.kind === 'fitted') {
      if (!p.fit) errs.push(`${p.id}: kind fitted requires fit`);
      else for (const id of p.fit.targets) if (!tseen.has(id)) errs.push(`${p.id}: fit target ${id} not in TARGETS`);
    }
    if (p.kind === 'sourced' && !p.source?.trim()) errs.push(`${p.id}: kind sourced requires a non-empty source`);
    if (!p.evidence?.trim()) errs.push(`${p.id}: evidence is empty`);
    const family = p.ref.kind === 'export' && (p.ref.path ?? []).includes('*');
    if (p.value === undefined && !family) errs.push(`${p.id}: value required (path has no '*')`);
  }
  // Under --area only one params file is loaded, so a target's fit link may point at another area: skip there.
  if (!PARTIAL) for (const t of targets) for (const id of t.fits ?? []) if (!seen.has(id)) errs.push(`${t.id}: fits unknown param ${id}`);
  return errs;
}

async function lintAll(params: Param[], targets: Target[]): Promise<string[]> {
  const errs = crossChecks(params, targets);
  for (const p of params) errs.push(...(await resolveParam(p)));
  return errs;
}

// ---------- coverage ----------
function listTs(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const f = join(dir, n);
    if (statSync(f).isDirectory()) listTs(f, out);
    else if (/\.tsx?$/.test(n)) out.push(f);
  }
  return out;
}

function coverage(params: Param[]) {
  const registered = new Set<string>();
  for (const p of params) {
    if (p.ref.kind === 'export') registered.add(`${norm(p.ref.module)}#${p.ref.symbol}`);
    // A non-exported constant registered inline on its declaration counts as covered.
    else { const m = /\bconst\s+(\w+)/.exec(p.ref.anchor); if (m) registered.add(`${norm(p.ref.file)}#${m[1]}`); }
  }
  const files = [...listTs(join(ROOT, 'src/data')), ...listTs(join(ROOT, 'src/engine'))]
    .map((f) => norm(relative(ROOT, f)))
    .filter((f) => !f.endsWith('/glossary.ts') && f !== 'src/engine/v2/types.ts');
  const decl = /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*?)?=\s*(.*)$/;
  const unreg: { file: string; line: number; sym: string }[] = [];
  let total = 0, reg = 0;
  for (const f of files) {
    const lines = readFileSync(join(ROOT, f), 'utf8').split('\n');
    lines.forEach((ln, i) => {
      const m = decl.exec(ln);
      if (!m) return;
      const rest = m[2].trim();
      if (!/^[-\d{[]/.test(rest)) return;
      // initializer text: this line plus following indented lines up to the next top-level statement
      let body = rest;
      for (let j = i + 1; j < lines.length && j < i + 80 && (/^\s/.test(lines[j]) || /^[}\]]/.test(lines[j]) || lines[j] === ''); j++) body += lines[j];
      if (!/\d/.test(body)) return;
      total++;
      if (registered.has(`${f}#${m[1]}`)) reg++;
      else unreg.push({ file: f, line: i + 1, sym: m[1] });
    });
  }
  return { total, reg, unreg };
}

// ---------- loading ----------
async function loadRegistries(area?: string): Promise<{ params: Param[]; targets: Target[] }> {
  const dir = join(ROOT, 'balance/params');
  const names = readdirSync(dir).filter((n) => n.endsWith('.ts')).filter((n) => !area || n === `${area}.ts`);
  if (area && names.length === 0) throw new Error(`no balance/params/${area}.ts`);
  const params: Param[] = [];
  for (const n of names) {
    const mod = (await import(pathToFileURL(join(dir, n)).href)) as Record<string, unknown>;
    const keys = Object.keys(mod).filter((k) => k.startsWith('PARAMS_'));
    if (keys.length !== 1) throw new Error(`balance/params/${n} must export exactly one PARAMS_* array (found ${keys.length})`);
    params.push(...(mod[keys[0]] as Param[]));
  }
  const tm = (await import(pathToFileURL(join(ROOT, 'balance/targets.ts')).href)) as { TARGETS: Target[] };
  return { params, targets: tm.TARGETS };
}

// ---------- self-test ----------
async function selfTest(): Promise<boolean> {
  const base = {
    unit: 'x', area: 'capability', layer: 'world', kind: 'designer', evidence: 'test',
  } as const;
  const good: Param = {
    ...base, id: 'st.good', value: 1,
    ref: { kind: 'export', module: 'src/engine/v2/world/hidden.ts', symbol: 'DIFFICULTY_SCALE' },
  };
  const targets: Target[] = [{
    id: 'st.target', statement: 's', type: 'point', metric: 'm', value: {}, source: 's', role: 'unassigned', checkLabels: [],
  }];
  const cases: [string, Param[], RegExp][] = [
    ['wrong value', [{ ...good, id: 'st.wrong', value: 2 }], /st\.wrong: value mismatch/],
    ['unresolvable symbol', [{ ...good, id: 'st.nosym', ref: { kind: 'export', module: good.ref.kind === 'export' ? good.ref.module : '', symbol: 'NOPE_NOT_THERE' } }], /st\.nosym: .*no export NOPE_NOT_THERE/],
    ['fitted, missing target', [{ ...good, id: 'st.fit', kind: 'fitted', fit: { targets: ['st.missing'], script: 's' } }], /st\.fit: fit target st\.missing not in TARGETS/],
    ['duplicate id', [{ ...good, id: 'st.dup' }, { ...good, id: 'st.dup' }], /st\.dup: duplicate param id/],
    ['anchor matches 0 times', [{ ...good, id: 'st.anchor', ref: { kind: 'inline', file: 'src/engine/v2/world/hidden.ts', anchor: 'zzz-no-such-anchor-zzz' } }], /st\.anchor: anchor .* matches 0 times/],
  ];
  let ok = true;
  for (const [name, params, re] of cases) {
    const errs = await lintAll(params, targets);
    const hit = errs.some((e) => re.test(e));
    console.log(`${hit ? 'ok  ' : 'MISS'} self-test: ${name}`);
    if (!hit) ok = false;
  }
  const clean = await lintAll([good], targets);
  if (clean.length) { console.log(`MISS self-test: good entry reported ${clean.join('; ')}`); ok = false; }
  console.log(ok ? 'self-test passed' : 'self-test FAILED');
  return ok;
}

// ---------- main ----------
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) process.exit((await selfTest()) ? 0 : 1);
  const ai = args.indexOf('--area');
  const area = ai >= 0 ? args[ai + 1] : undefined;
  PARTIAL = area !== undefined;
  const { params, targets } = await loadRegistries(area);
  const errs = await lintAll(params, targets);
  for (const e of errs) console.log(`ERROR ${e}`);
  console.log(`registry-lint: ${params.length} params, ${targets.length} targets, ${errs.length} errors${area ? ` (area ${area})` : ''}`);
  if (!area) {
    const cov = coverage(params);
    writeFileSync(join(ROOT, 'balance/coverage.txt'), cov.unreg.map((u) => `${u.file}:${u.line} ${u.sym}`).join('\n') + '\n');
    const byFile = new Map<string, number>();
    for (const u of cov.unreg) byFile.set(u.file, (byFile.get(u.file) ?? 0) + 1);
    const top = [...byFile].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([f, n]) => `${f} ${n}`).join('; ');
    console.log(`coverage: ${cov.total} candidates, ${cov.reg} registered, ${cov.unreg.length} unregistered (balance/coverage.txt). Top: ${top}`);
  }
  process.exit(errs.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
