// Balance dashboard (design/bal/TOOLING-DESIGN.md, C4). Reads balance/runs/<name>/ and the registries in balance/,
// writes one self-contained balance/dash/index.html (data inlined, vanilla JS + SVG, no network).
//   npm run bal:dash -- --runs smoke[,other] [--scenarios file.ts] [--scenarios-live <aifm-runs/out/eli_live>]
//     [--map tl-fast=fast,tl-central=central,tl-slow=slow] [--sc-shift years]
// Forced calibration runs (balrun --forced aifm) also feed the Scenarios tab's "Calibration run" readout: the game's results over
// each timeline's benchmarks, scored by scripts/v2/calibscore.ts (the same code as s1compare.ts). --map says which override set
// plays which timeline (default: tl-fast, tl-central, tl-slow; base stays unmapped); --sc-shift is s1compare's (default 0 = SC is AC).
// --scenarios-live: the Scenarios tab takes its timeline layer from the live cluster files of a running AI Futures Model job
// (see baldash-live.ts), shows an "Interim" banner and reloads itself every minute until status.json says all jobs are done.
// It also picks up the other splits beside it: out/eli_split_sar (SAR date split) and out/eli_matrix (coder x takeoff matrix), and the
// authors' input series from ../../repo/inputs/input_data.csv; override with --scenarios-split-sar, --scenarios-matrix, --aifm-inputs.
// The page assets live in scripts/v2/baldash-assets/ (template.html, style.css, client.js).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Param, Target } from '../../balance/schema';
import type { AlignmentLevel, Checkpoint, Timeline } from '../../balance/scenarios';
import { ENDING_TEXT } from '../../src/engine/v2/endings/endings';
import { STARTS } from '../../src/data/v2/starts';
import { PRESET_BY_LABEL } from '../../src/data/v2/calibration';
import { loadLive, type LiveOpts } from './baldash-live';
import { calibrateRun, parseMap, readRecs, type RunCalib } from './calibscore';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const ASSETS = join(HERE, 'baldash-assets');

/** The fields of a GameRecord the dashboard reads (everything but milestones/ending/verdict is optional). */
interface Game {
  run: string; seed: number; world: string; alignment: string; start: string; policy: string;
  overrides?: Record<string, number | string | boolean>;
  endDay?: number; ending?: string; verdict?: string;
  milestones?: Record<string, number>;
  set?: string; forced?: string; // override set name (balrun --sets) and the forced mode of a calibration run
  pMisAtEnd?: number; pMisAtASI?: number; minCash?: number; insolvent?: boolean;
}

function parseArgs(): { runs: string[]; out: string; scenarios: string; live: string | null; liveOpts: LiveOpts; map: Record<string, string> | null; scShift: number } {
  const a = process.argv.slice(2);
  let runs = '';
  let out = join(ROOT, 'balance/dash/index.html');
  let scenarios = join(ROOT, 'balance/scenarios.ts'); // --scenarios <file> points at a test copy
  let live: string | null = null;
  const liveOpts: LiveOpts = {};
  let map: Record<string, string> | null = null;
  let scShift = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--runs') runs = a[++i] ?? '';
    else if (a[i] === '--out') out = a[++i] ?? out;
    else if (a[i] === '--scenarios') scenarios = resolve(a[++i] ?? scenarios);
    else if (a[i] === '--scenarios-live') live = resolve(a[++i] ?? '');
    else if (a[i] === '--scenarios-split-sar') liveOpts.sarDir = resolve(a[++i] ?? '');
    else if (a[i] === '--scenarios-matrix') liveOpts.matrixDir = resolve(a[++i] ?? '');
    else if (a[i] === '--map') map = parseMap(a[++i] ?? '');
    else if (a[i] === '--sc-shift') scShift = Number(a[++i]);
    else if (a[i] === '--aifm-inputs') liveOpts.inputsCsv = resolve(a[++i] ?? '');
  }
  const list = runs.split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) {
    console.error('usage: npm run bal:dash -- --runs <name>[,<name>...] [--out file.html]');
    process.exit(2);
  }
  return { runs: list, out, scenarios, live, liveOpts, map, scShift };
}

function readJson<T>(path: string): T | undefined {
  try { return JSON.parse(readFileSync(path, 'utf8')) as T; } catch { return undefined; }
}

function readGames(path: string): { games: Game[]; bad: number } {
  const games: Game[] = [];
  let bad = 0;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line) as Game;
      if (typeof r.world !== 'string' || typeof r.policy !== 'string') { bad++; continue; }
      // keep only what the page reads
      const g: Game = {
        run: r.run, seed: r.seed, world: r.world, alignment: String(r.alignment ?? ''), start: String(r.start ?? ''), policy: r.policy,
        ending: r.ending, verdict: r.verdict, milestones: r.milestones ?? {}, endDay: r.endDay,
      };
      const raw = r as unknown as { overrideSet?: string; forced?: string };
      if (raw.overrideSet) g.set = raw.overrideSet;
      if (raw.forced) g.forced = raw.forced;
      if (r.overrides && Object.keys(r.overrides).length) g.overrides = r.overrides;
      for (const k of ['pMisAtEnd', 'pMisAtASI', 'minCash'] as const) if (typeof r[k] === 'number') g[k] = r[k];
      if (typeof r.insolvent === 'boolean') g.insolvent = r.insolvent;
      games.push(g);
    } catch { bad++; } // a half-written last line of a run in progress
  }
  return { games, bad };
}

async function loadRegistries(): Promise<{ params: Param[]; targets: Target[] }> {
  const dir = join(ROOT, 'balance/params');
  const params: Param[] = [];
  for (const n of readdirSync(dir).filter((f) => f.endsWith('.ts')).sort()) {
    const mod = (await import(pathToFileURL(join(dir, n)).href)) as Record<string, unknown>;
    const keys = Object.keys(mod).filter((k) => k.startsWith('PARAMS_'));
    for (const k of keys) params.push(...(mod[k] as Param[]));
  }
  const tm = (await import(pathToFileURL(join(ROOT, 'balance/targets.ts')).href)) as { TARGETS: Target[] };
  return { params, targets: tm.TARGETS };
}

async function loadScenarios(file: string): Promise<{ timelines: Timeline[]; levels: AlignmentLevel[]; checkpoints: Checkpoint[] }> {
  const m = (await import(pathToFileURL(file).href)) as { TIMELINES: Timeline[]; ALIGNMENT_LEVELS: AlignmentLevel[]; CHECKPOINTS: Checkpoint[] };
  return { timelines: m.TIMELINES, levels: m.ALIGNMENT_LEVELS, checkpoints: m.CHECKPOINTS };
}

async function main() {
  const { runs, out, scenarios, live, liveOpts, map, scShift } = parseArgs();
  const runData = runs.map((name) => {
    const dir = join(ROOT, 'balance/runs', name);
    const gp = join(dir, 'games.jsonl');
    if (!existsSync(dir)) { console.error(`no run folder ${dir}`); process.exit(1); }
    const { games, bad } = existsSync(gp) ? readGames(gp) : { games: [] as Game[], bad: 0 }; // a run just started has no games yet
    return {
      name, games, badLines: bad,
      config: readJson<Record<string, unknown>>(join(dir, 'config.json')) ?? null,
      progress: readJson<Record<string, unknown>>(join(dir, 'progress.json')) ?? null,
      hasSummary: existsSync(join(dir, 'summary.json')),
    };
  });
  const { params, targets } = await loadRegistries();
  const slimParams = params.map((p) => ({
    id: p.id, area: p.area, layer: p.layer, actor: p.actor ?? null, kind: p.kind, value: p.value ?? null, unit: p.unit ?? null,
    source: p.source ?? null, evidence: p.evidence, notes: p.notes ?? null, grade: p.grade ?? null, perPreset: !!p.perPreset,
    range: p.range ?? null, fit: p.fit ?? null,
    where: p.ref.kind === 'export' ? `${p.ref.module} ${p.ref.symbol}${p.ref.path ? '.' + p.ref.path.join('.') : ''}` : `${p.ref.file} (inline)`,
  }));
  // Player-facing names, read from the game at build time (ids without an entry show as the id).
  const names = {
    ending: Object.fromEntries(Object.entries(ENDING_TEXT).map(([id, t]) => [id, t[0]])),
    start: Object.fromEntries(STARTS.map((x) => [x.id, x.name])),
    world: Object.fromEntries(Object.entries(PRESET_BY_LABEL).map(([label, id]) => [id, label])),
  };
  const scen = await loadScenarios(scenarios);
  let liveInfo: Record<string, unknown> | null = null;
  let finished = false; // every forecast job is done: the page needs no refresh
  if (live) { // the live clusters replace the timeline layer and the timeline texts; history and alignment stay
    const lv = loadLive(live, liveOpts);
    scen.timelines = lv.timelines;
    scen.checkpoints = [...scen.checkpoints.filter((c) => c.layer !== 'timeline'), ...lv.checkpoints];
    liveInfo = { status: lv.status, clusterN: lv.clusterN, sar: lv.sar, matrix: lv.matrix, inputs: lv.inputs };
    finished = !!lv.status?.allJobsDone;
  }
  // Calibration readout: every forced run scored against each split's timeline benchmarks (history + that split's timeline layer).
  const histCps = scen.checkpoints.filter((c) => c.layer !== 'timeline' && c.layer !== 'alignment');
  const calibLayers: Record<string, Checkpoint[]> = { ac: [...histCps, ...scen.checkpoints.filter((c) => c.layer === 'timeline')] };
  if (live && (liveInfo as { sar?: { checkpoints: Checkpoint[] } | null } | null)?.sar) calibLayers.sar = [...histCps, ...(liveInfo as unknown as { sar: { checkpoints: Checkpoint[] } }).sar.checkpoints];
  const calibRuns = runs.filter((name) => runData.find((r) => r.name === name)!.games.some((g) => g.forced));
  const calib = {
    scShift, map,
    layers: Object.fromEntries(Object.entries(calibLayers).map(([id, cps]) => [id, calibRuns.map((name): RunCalib => calibrateRun(name, readRecs(join(ROOT, 'balance/runs', name, 'games.jsonl')), cps, scShift, map))])),
  };
  const tastecurve = readJson<unknown>(join(ROOT, 'balance/mechanics/tastecurve.json')) ?? null; // scripts/v2/tastecurve.ts
  const data = { startDate: '2025-07-01', generated: new Date().toISOString(), runs: runData, params: slimParams, targets, names, scenarios: scen, live: liveInfo, tastecurve, calib };
  // The data sits in a JSON <script> block: escape '<' so no string can close the tag (JSON.parse reads it back).
  const BS = String.fromCharCode(92);
  const json = JSON.stringify(data).split('<').join(BS + 'u003c');
  const tpl = readFileSync(join(ASSETS, 'template.html'), 'utf8');
  const html = tpl
    .replace('<!--__REFRESH__-->', live && !finished ? '<meta http-equiv="refresh" content="60">' : '')
    .replace('/*__CSS__*/', () => readFileSync(join(ASSETS, 'style.css'), 'utf8'))
    .replace('/*__JS__*/', () => ['client.js', 'calib.js', 'scenarios.js', 'tastecurve.js'].map((f) => readFileSync(join(ASSETS, f), 'utf8')).join('\n').replace(/<\/script/gi, '<\\/script'))
    .replace('/*__DATA__*/', () => json);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  const n = runData.reduce((s, r) => s + r.games.length, 0);
  console.log(`bal:dash: ${out} (${n} games from ${runs.join(', ')}; ${params.length} params, ${targets.length} targets, ${scen.checkpoints.length} scenario checkpoints${live ? ', timeline layer LIVE from ' + live : ''}; ${(html.length / 1024).toFixed(0)} KB)`);
  for (const r of runData) if (r.badLines) console.log(`  ${r.name}: skipped ${r.badLines} unreadable line(s)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
