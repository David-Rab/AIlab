// Balance registry lint (design/bal/REGISTRY-DESIGN.md; one home per sourced number: balance/schema.ts). Run: npm run registry:lint
//   --area <name>   lint only balance/params/<name>.ts (coverage skipped)
//   --self-test     check that deliberately bad in-memory entries are caught; writes no files
let SELFTEST = false; // set by --self-test: the calreport scan is exercised on in-memory sources instead
let PARTIAL = false; // set when --area loads a single params file
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Param, Target, ExportRef } from '../../balance/schema';
import { CHECKPOINTS, type Checkpoint } from '../../balance/scenarios';
import { bandOfEntry, checkpointIds } from './calreport/types';
import { check, finish } from './lib';

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

/** Walk `path` from `v`; '*' fans out over every element or key; '#id' picks the array element whose `id` is that. Returns the matched live values. */
function walk(v: unknown, path: (string | number)[]): unknown[] {
  if (path.length === 0) return [v];
  const [head, ...rest] = path;
  if (!isObj(v)) return [];
  if (head === '*') return (Array.isArray(v) ? v : Object.values(v)).flatMap((x) => walk(x, rest));
  if (typeof head === 'string' && head.startsWith('#')) return Array.isArray(v) ? v.filter((x) => isObj(x) && x.id === head.slice(1)).flatMap((x) => walk(x, rest)) : [];
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

// ---------- one home per sourced number (balance/schema.ts) ----------
// A target whose band comes from a sourced value names its checkpoint in balance/scenarios.ts and holds no copy:
// (a) a target with `checkpoint` has no `value`, every id resolves, several ids share one unit, `use` only with one id,
//     'value' needs a checkpoint value, `slackRel` needs a central value and no lo/hi and no `slack`, a slack pair is >= 0;
// (b) `use` / `slackRel` only with a checkpoint; (c) a target with its own `value` that repeats a history checkpoint's
//     number (both lo and hi equal its lo and hi; or p50 equal to its value, other than 0 and 1, in the same unit) must
//     name it instead, unless the pair is a listed coincidence (NOT_A_COPY: a finite list, each with its reason).
const NOT_A_COPY: Record<string, string> = {
  'A2c.seats.jan2026 H24.copilotSeats.2026-07': 'all paid enterprise seats outside China in Jan 2026 (about 30M) vs Microsoft 365 Copilot seats alone in Jul 2026: the same 30M by coincidence',
};
const same = (a: number | undefined, b: number | undefined) => a !== undefined && b !== undefined && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));
function checkpointLint(targets: Target[], cps: Checkpoint[]): string[] {
  const errs: string[] = [];
  const byId = new Map(cps.map((c) => [c.id, c]));
  const hist = cps.filter((c) => c.layer === 'history');
  for (const t of targets) {
    const ids = checkpointIds(t);
    if (ids.length) {
      if (t.value !== undefined) errs.push(`${t.id}: names checkpoint ${ids.join(', ')} and also holds a value (a copy): drop value, the band comes from the checkpoint`);
      const cs = ids.map((id) => byId.get(id));
      ids.forEach((id, i) => { if (!cs[i]) errs.push(`${t.id}: checkpoint '${id}' is not in balance/scenarios.ts`); });
      if (cs.some((c) => !c)) continue;
      if (new Set(cs.map((c) => c!.unit)).size > 1) errs.push(`${t.id}: its checkpoints have different units (${cs.map((c) => c!.unit).join(', ')})`);
      if (ids.length > 1 && t.use !== undefined) errs.push(`${t.id}: use applies to a single checkpoint only`);
      if (ids.length === 1 && t.use === 'value' && cs[0]!.value === undefined) errs.push(`${t.id}: use 'value' but checkpoint ${ids[0]} has no value`);
      if (t.slackRel !== undefined) {
        const b = bandOfEntry({ ...t, slackRel: undefined, slack: undefined }, byId);
        if (b.p50 === undefined || b.lo !== undefined || b.hi !== undefined) errs.push(`${t.id}: slackRel needs a central value and no lo/hi (use 'value')`);
        if (t.slack !== undefined) errs.push(`${t.id}: slackRel and slack together`);
      }
    } else {
      if (t.use !== undefined) errs.push(`${t.id}: use is set but the target names no checkpoint`);
      if (t.slackRel !== undefined) errs.push(`${t.id}: slackRel is set but the target names no checkpoint`);
      const v = t.value ?? {};
      for (const c of hist) {
        const band = same(v.lo, c.lo) && same(v.hi, c.hi);
        const mid = v.p50 !== undefined && v.p50 !== 0 && Math.abs(v.p50) !== 1 && same(v.p50, c.value) && v.unit?.trim().toLowerCase() === c.unit.trim().toLowerCase();
        if ((band || mid) && !NOT_A_COPY[`${t.id} ${c.id}`]) errs.push(`${t.id}: repeats the ${band ? 'band' : 'value'} of checkpoint ${c.id}: name it (checkpoint: '${c.id}') and keep only the tolerance here`);
      }
    }
    if (Array.isArray(t.slack) && t.slack.some((x) => !(x >= 0))) errs.push(`${t.id}: slack pair [below, above] must be >= 0`);
    if (!errs.some((e) => e.startsWith(`${t.id}:`))) {
      try { bandOfEntry(t, byId); } catch (e) { errs.push((e as Error).message); }
    }
  }
  return errs;
}

async function lintAll(params: Param[], targets: Target[], cps: Checkpoint[] = CHECKPOINTS): Promise<string[]> {
  const errs = crossChecks(params, targets);
  errs.push(...checkpointLint(targets, cps));
  if (!PARTIAL && !SELFTEST) errs.push(...calreportLint(readCalreport(), new Set(targets.map((t) => t.id))));
  for (const p of params) errs.push(...(await resolveParam(p)));
  return errs;
}

// ---------- calibration report: one home per target (design/TESTING.md §0) ----------
// scripts/v2/calreport/*.ts make every row through rowOf(registry id, value, measured) (types.ts), so each band, unit and
// source is written once, in balance/targets.ts. Checks: (a) every id passed to rowOf (or a module's local wrappers R, band,
// dateCheck) exists in TARGETS; (b) no numeric band literal in the code: a comparison with a number other than 0 or 1
// (`x >= 0.4`, `3 < x`) is flagged after comments and string/template text are removed, and a line may opt out with the
// comment `// band-lint: ok <why>` for a measurement threshold that is not a sourced band; (c) no hand-made rows (`ok:`
// in an object literal), and every module uses rowOf.

/** Source text with comments and string/template-literal contents blanked out (newlines kept, so line numbers hold). */
function blankCode(src: string): string {
  let out = '';
  let i = 0;
  const str = (q: string): string => {
    i++; // opening quote
    let n = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (q === '`' && c === '$' && src[i + 1] === '{') {
        i += 2;
        let d = 1;
        while (i < src.length && d > 0) {
          const ch = src[i];
          if (ch === "'" || ch === '"' || ch === '`') { str(ch); continue; }
          if (ch === '{') d++;
          else if (ch === '}') d--;
          i++;
        }
        continue;
      }
      if (c === q) { i++; break; }
      if (c === '\n') n++;
      i++;
    }
    return '\n'.repeat(n);
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const end = e < 0 ? src.length : e + 2; out += src.slice(i, end).replace(/[^\n]/g, ''); i = end; continue; }
    if (c === "'" || c === '"' || c === '`') { out += '""' + str(c); continue; }
    out += c;
    i++;
  }
  return out;
}

const BAND_RE = /(?<![\w.$])-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?\s*[<>]=?(?!=)|(?<!=)[<>]=?\s*-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?(?![\w.])/g;
const ID_CALL_RE = /\b(?:rowOf|R|band|dateCheck|times10)\(\s*(['"`])([^'"`]*)\1/g;

function calreportLint(files: { file: string; text: string }[], ids: Set<string>): string[] {
  const errs: string[] = [];
  for (const { file, text } of files) {
    const code = blankCode(text);
    const rawLines = text.split('\n');
    // (a) ids: read from the raw text, but only calls that survive comment removal
    const codeWithStrings = text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    let usesRowOf = false;
    for (const m of codeWithStrings.matchAll(ID_CALL_RE)) {
      if (!ids.has(m[2])) errs.push(`${file}: unknown registry id '${m[2]}' (add it to balance/targets.ts)`);
      else usesRowOf = true;
    }
    if (!usesRowOf && !/\b(?:rowOf|R|band|dateCheck|times10)\(/.test(codeWithStrings)) errs.push(`${file}: no rowOf call (rows must come from registry ids)`);
    // (b) band literals and (c) hand-made rows
    code.split('\n').forEach((ln, k) => {
      if (/band-lint:\s*ok/.test(rawLines[k] ?? '')) return;
      for (const m of ln.matchAll(BAND_RE)) {
        const n = /-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/.exec(m[0])![0];
        if (n === '0' || n === '1') continue;
        errs.push(`${file}:${k + 1}: band literal '${m[0].trim()}' (read bands from balance/targets.ts through rowOf; a measurement threshold may carry a '// band-lint: ok <why>' comment)`);
      }
      if (/[{,]\s*ok\s*:/.test(ln)) errs.push(`${file}:${k + 1}: hand-made row ('ok:' in an object literal): use rowOf`);
    });
  }
  return errs;
}

function readCalreport(): { file: string; text: string }[] {
  const dir = join(ROOT, 'scripts/v2/calreport');
  const mods = readdirSync(dir).filter((n) => n.endsWith('.ts') && n !== 'types.ts').map((n) => ({ file: `scripts/v2/calreport/${n}`, text: readFileSync(join(dir, n), 'utf8') }));
  return [...mods, { file: 'scripts/v2/sanity.ts', text: readFileSync(join(ROOT, 'scripts/v2/sanity.ts'), 'utf8') }]; // sanity.ts derives its money bounds from the registry (times10)
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
  const cp: Checkpoint = { id: 'st.cp', layer: 'history', quantity: 'other', label: 'l', date: 2026, value: 0.37, lo: 0.31, hi: 0.43, unit: 'x', bandFrom: 'source', source: 's', sourceRef: 'r', status: 'sourced' };
  const tgt = (x: Partial<Target>): Target => ({ ...targets[0], id: 'st.ref', value: undefined, ...x });
  const cpCases: [string, Target, RegExp][] = [
    ['checkpoint and a copy of its value', tgt({ checkpoint: 'st.cp', value: { lo: 0.31, hi: 0.43 } }), /st.ref: names checkpoint st.cp and also holds a value/],
    ['unknown checkpoint', tgt({ checkpoint: 'st.nope' }), /st.ref: checkpoint 'st.nope' is not in/],
    ['own band repeats a checkpoint', tgt({ value: { lo: 0.31, hi: 0.43 } }), /st.ref: repeats the band of checkpoint st.cp/],
    ['own p50 repeats a checkpoint', tgt({ value: { p50: 0.37, lo: 0.2, hi: 0.5, unit: 'x' } }), /st.ref: repeats the value of checkpoint st.cp/],
    ['slackRel on a band', tgt({ checkpoint: 'st.cp', slackRel: 0.1 }), /st.ref: slackRel needs a central value/],
  ];
  for (const [name, t, re] of cpCases) {
    const hit = (await lintAll([good], [...targets, t], [cp])).some((e) => re.test(e));
    console.log(`${hit ? 'ok  ' : 'MISS'} self-test: ${name}`);
    if (!hit) ok = false;
  }
  const cpClean = await lintAll([good], [...targets, tgt({ checkpoint: 'st.cp', slack: [0.01, 0.02] }), tgt({ id: 'st.ref2', checkpoint: 'st.cp', use: 'value', slackRel: 0.1 })], [cp]);
  if (cpClean.length) { console.log(`MISS self-test: good checkpoint targets reported ${cpClean.join('; ')}`); ok = false; }
  const goodSrc = "import { rowOf } from './types';\nexport const t = () => [rowOf('st.target', 'v', 1)];\n";
  const srcCases: [string, string, RegExp][] = [
    ['unknown id', "rowOf('no.such.id', 'v', 1);", /unknown registry id 'no\.such\.id'/],
    ['band literal', 'const ok = x >= 0.4 && x <= 0.8;', /band literal/],
    ['band literal, number first', 'const ok = 3 < x;', /band literal/],
    ['hand-made row', "out.push({ id: 'a', ok: true });", /hand-made row/],
  ];
  for (const [name, text, re] of srcCases) {
    const hit = calreportLint([{ file: 'calreport/st.ts', text }], new Set(['st.target'])).some((e) => re.test(e));
    console.log(`${hit ? 'ok  ' : 'MISS'} self-test: calreport lint, ${name}`);
    if (!hit) ok = false;
  }
  const cleanSrc = calreportLint([{ file: 'calreport/st.ts', text: goodSrc + "const a = x > 0 && y < 1; // x >= 0.4 in a comment is fine\nconst s = 'x <= 9 in a string';\nconst z = w <= 3; // band-lint: ok measurement threshold\n" }], new Set(['st.target']));
  if (cleanSrc.length) { console.log(`MISS self-test: clean calreport source reported ${cleanSrc.join('; ')}`); ok = false; }
  const clean = await lintAll([good], targets);
  if (clean.length) { console.log(`MISS self-test: good entry reported ${clean.join('; ')}`); ok = false; }
  console.log(ok ? 'self-test passed' : 'self-test FAILED');
  return ok;
}

// ---------- main ----------
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) { SELFTEST = true; process.exit((await selfTest()) ? 0 : 1); }
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
  check(errs.length === 0, 'registry lint: no errors', `${errs.length}`);
  finish('registry-lint');
}

main().catch((e) => { console.error(e); process.exit(1); });
