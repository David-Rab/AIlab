// Test runner for the v2 scripts (T0): tiers, a worker pool and one summary table.
//
//   npx tsx scripts/v2/run.ts --tier quick|cal|full|deep|perf [--only a,b] [--workers N] [--no-ui] [--list]
//
//   quick  tsc (main + scripts), every unit-style and short-sim script, and the long multi-seed suites in SMOKE mode
//          (1–2 seeds, short horizons; their calibration targets print SMOKE instead of failing). For task agents.
//   cal    calib T1, T1L, T4 (through the simulation cache; 10 workers on ≥ 12 cores).
//   full   every check of the old `test:v2` (every script, all seeds), in parallel, through the simulation cache, plus
//          test:ui (build + headless browser; started first, it is mostly browser wait). The merge gate. S5's played
//          mechanism checks are in `deep`; hygiene's performance checks are left out too
//          (they measure wall time, meaningless on a loaded machine): see `perf`.
//   deep   (M10) the checks too slow for full: safety's S5 mechanism checks (180 paired RefBot games to SAR since M11). Merge
//          waves only, after test:full on the same code (S4/S5's base games are then cache hits).
//   perf   hygiene's performance checks only. Run on a quiet machine.
//
// Each script runs as `node --import tsx scripts/v2/<file>` (no npx: under load npx alone costs ~10 s a script). Output
// goes to .simcache/logs/<id>.log; the summary prints script, mode, PASS/FAIL/WARN counts, cache hits and time; a JSON
// timing log is written to .simcache/last-run.json (and used to start the longest jobs first next time). Exit code 1
// on any failure. SIMCACHE=off|refresh is passed through (see simcache.ts). Long suites (safety, calib, finance) are
// split into --prefill k/n shards that fill the cache in parallel; the script itself then runs on cache hits.
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import { CACHE_DIR, ROOT, pruneCache } from './simcache';

type Tier = 'quick' | 'cal' | 'full' | 'deep' | 'perf';
interface Job {
  id: string;
  /** Command: a script under scripts/v2 (run with node --import tsx) or a raw argv. */
  script?: string;
  argv?: string[];
  args?: Partial<Record<Tier, string[]>>;
  tiers: Tier[];
  /** Label shown in the summary per tier (e.g. SMOKE). */
  mode?: Partial<Record<Tier, string>>;
  /** Fallback time estimate (s) for ordering when there is no timing log. */
  est: number;
  /** Started before everything else: test:ui is ~6 min of wall time but ~40 s of CPU (a browser waiting on the page),
   *  so it overlaps the simulations instead of adding its wall time at the end. */
  first?: boolean;
  /** Tiers in which the script's cached runs are first computed by `n` parallel `--prefill k/n` shards (the script
   *  itself then starts after them and reads the cache). Not used with SIMCACHE=off. */
  shards?: Partial<Record<Tier, number>>;
  /** Jobs that must finish first (set for the prefill shards). */
  after?: string[];
  /** Extra environment for the job. */
  env?: Record<string, string>;
}

const TSC = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const SMOKE = ['--smoke'];
const S = (tiers: Tier[], est: number, extra: Partial<Job> = {}): Partial<Job> => ({ tiers, est, ...extra });
const ALL: Tier[] = ['quick', 'full'];
/** Every job. `full` lists exactly the old test:v2 chain (+ test:ui); quick adds the main tsc and SMOKE modes. */
const JOBS: Job[] = [
  { id: 'tsc-scripts', argv: [process.execPath, TSC, '--noEmit', '-p', 'scripts/v2/tsconfig.json'], ...S(ALL, 30) } as Job,
  { id: 'tsc-main', argv: [process.execPath, TSC, '--noEmit', '-p', '.'], ...S(['quick'], 20) } as Job,
  { id: 'effective', script: 'effective.ts', ...S(ALL, 25) } as Job,
  { id: 'data', script: 'data.ts', ...S(ALL, 20) } as Job,
  { id: 'suites', script: 'suites.ts', ...S(ALL, 20) } as Job,
  { id: 'sites', script: 'sites.ts', args: { quick: SMOKE }, mode: { quick: 'SMOKE bot round' }, ...S(ALL, 90) } as Job,
  { id: 'signals', script: 'signals.ts', ...S(ALL, 20) } as Job,
  { id: 'successor', script: 'successor.ts', ...S(ALL, 30) } as Job,
  { id: 'research', script: 'research.ts', ...S(ALL, 35) } as Job,
  { id: 'evals', script: 'evals.ts', ...S(ALL, 30) } as Job,
  { id: 'safetyresearch', script: 'safetyresearch.ts', ...S(ALL, 25) } as Job,
  { id: 'worktypes', script: 'worktypes.ts', ...S(ALL, 60) } as Job,
  { id: 'calib', script: 'calib.ts', args: { quick: SMOKE, cal: ['--cal'] }, mode: { quick: 'SMOKE', cal: 'T1 T1L T4' }, shards: { full: 6, cal: 10 }, ...S(['quick', 'cal', 'full'], 300) } as Job,
  { id: 'fixtures', script: 'fixtures.ts', ...S(ALL, 120) } as Job,
  // G1: hygiene's readout-purity games (3b) run as prefill shards in full; --smoke in quick plays one seed of them.
  { id: 'hygiene', script: 'hygiene.ts', args: { quick: ['--no-perf', '--smoke'], full: ['--no-perf'], perf: ['--perf-only'] }, mode: { quick: 'no perf, SMOKE 3b', full: 'no perf', perf: 'perf only' }, shards: { full: 3 }, ...S(['quick', 'full', 'perf'], 120) } as Job,
  { id: 'lint-hidden', script: 'lint-hidden.ts', ...S(ALL, 10) } as Job,
  { id: 'lint-ux', script: 'lint-ux.ts', ...S(ALL, 10) } as Job,
  { id: 'lint-tradeoffs', script: 'lint-tradeoffs.ts', ...S(ALL, 10) } as Job,
  { id: 'lint-structure', script: 'lint-structure.ts', ...S(ALL, 10) } as Job,
  // M10: the deep tier (merge waves only, after test:full on the same code, so S4/S5's base games are cache hits) adds
  // S5's played mechanism checks (180 RefBot games to SAR since M11: half staff 20, sabotage on / off 2 × 80), kept out of full to hold it ≲ 20 min wall.
  { id: 'safety', script: 'safety.ts', args: { quick: SMOKE, deep: ['--deep'] }, mode: { quick: 'SMOKE', deep: 'S5 mechanisms' }, shards: { full: 6, deep: 6 }, ...S([...ALL, 'deep'], 1000) } as Job,
  { id: 'danger', script: 'danger.ts', ...S(ALL, 60) } as Job,
  { id: 'oversight', script: 'oversight.ts', ...S(ALL, 30) } as Job,
  // E7 sabotage, E8 footholds, E9 control (merged in M5).
  { id: 'sabotage', script: 'sabotage.ts', ...S(ALL, 60) } as Job,
  { id: 'footholds', script: 'footholds.ts', ...S(ALL, 60) } as Job,
  { id: 'control', script: 'control.ts', ...S(ALL, 60) } as Job,
  // E13 (merged in M5).
  { id: 'safetyideas', script: 'safetyideas.ts', ...S(ALL, 30) } as Job,
  // E10: safety rates vs research/20 F (12 RefBot games to ASI and 40 probe worlds; full tier only).
  { id: 'safetyrates', script: 'safetyrates.ts', shards: { full: 4 }, ...S(['full'], 200) } as Job,
  { id: 'finance', script: 'finance.ts', args: { quick: SMOKE }, mode: { quick: 'SMOKE' }, shards: { full: 3, quick: 2 }, ...S(ALL, 250) } as Job,
  { id: 'worldfx', script: 'worldfx.ts', args: { quick: SMOKE }, mode: { quick: 'SMOKE' }, shards: { full: 4 }, ...S(ALL, 90) } as Job,
  { id: 'directorEndings', script: 'directorEndings.ts', args: { quick: SMOKE }, mode: { quick: 'SMOKE' }, ...S(ALL, 120) } as Job,
  { id: 'rivals', script: 'rivals.ts', ...S(ALL, 30) } as Job,
  { id: 'products', script: 'products.ts', ...S(ALL, 30) } as Job,
  { id: 'serving', script: 'serving.ts', ...S(ALL, 60) } as Job,
  { id: 'money', script: 'money.ts', ...S(ALL, 60) } as Job,
  { id: 'idle', script: 'idle.ts', args: { quick: ['--seeds', '1'] }, mode: { quick: 'SMOKE 1 seed' }, ...S(ALL, 150) } as Job,
  { id: 'ui', argv: ['npm', 'run', 'test:ui'], ...S(['full'], 300, { first: true }) } as Job,
];

// ---------- arguments ----------
const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const tier = (opt('tier') ?? 'quick') as Tier;
if (!['quick', 'cal', 'full', 'deep', 'perf'].includes(tier)) {
  console.error(`unknown tier ${tier} (quick | cal | full | deep | perf)`);
  process.exit(2);
}
const only = opt('only')?.split(',').map((x) => x.trim()).filter(Boolean);
// Default workers: perf 1 (timings); cal 10 on a machine with ≥ 12 logical cores (M9, lead decision: since F4 the cal
// tier plays 108 games, 80 of them T1 over the 20 CAL_SEEDS, ≈ 7 min cold on 6 workers; its jobs are CPU-bound games
// with no shared state, so more workers cut the cold wall time), else 6. calib's cal-tier prefill shards are 10 to match
// (with 6 shards the extra workers idle: M9 measured 5.9 min cold at 10 workers / 6 shards).
const defaultWorkers = tier === 'perf' ? 1 : tier === 'cal' && os.cpus().length >= 12 ? 10 : 6;
const workers = Math.max(1, Number(opt('workers') ?? defaultWorkers));
const noUi = argv.includes('--no-ui');
let jobs = JOBS.filter((j) => j.tiers.includes(tier));
if (noUi) jobs = jobs.filter((j) => j.id !== 'ui');
if (only) {
  const unknown = only.filter((id) => !JOBS.some((j) => j.id === id));
  if (unknown.length) {
    console.error(`unknown job(s): ${unknown.join(', ')}; jobs: ${JOBS.map((j) => j.id).join(', ')}`);
    process.exit(2);
  }
  jobs = JOBS.filter((j) => only.includes(j.id) && (j.tiers.includes(tier) || tier === 'full'));
}
// Prefill shards: `safety` becomes safety#0 … safety#n−1 (--prefill k/n) and then `safety` itself.
const cacheOff = ['off', '0', 'false'].includes((process.env.SIMCACHE ?? 'on').toLowerCase());
jobs = jobs.flatMap((j) => {
  const n = cacheOff ? 0 : (j.shards?.[tier] ?? 0);
  if (n < 2 || !j.script) return [j];
  const shards: Job[] = Array.from({ length: n }, (_, k) => ({ id: `${j.id}#${k}`, script: j.script, args: { [tier]: [...(j.args?.[tier] ?? []), '--prefill', `${k}/${n}`] }, mode: { [tier]: `prefill ${k}/${n}` }, tiers: [tier], est: j.est / n }));
  // Under SIMCACHE=refresh the shards recompute; the script itself must then read what they wrote.
  const env = process.env.SIMCACHE?.toLowerCase() === 'refresh' ? { SIMCACHE: 'on' } : undefined;
  return [...shards, { ...j, after: shards.map((x) => x.id), est: j.est / n, env }];
});
if (argv.includes('--list')) {
  for (const t of ['quick', 'cal', 'full', 'deep', 'perf'] as Tier[]) console.log(`${t.padEnd(6)} ${JOBS.filter((j) => j.tiers.includes(t)).map((j) => (j.mode?.[t] ? `${j.id} (${j.mode[t]})` : j.id)).join(', ')}`);
  process.exit(0);
}

// ---------- scheduling: longest first (last run's times, else the estimates) ----------
const LOG_DIR = join(CACHE_DIR, 'logs');
mkdirSync(LOG_DIR, { recursive: true });
const pruned = pruneCache(3);
const LAST = join(CACHE_DIR, 'last-run.json');
const prevTimes: Record<string, number> = {};
if (existsSync(LAST)) {
  try {
    const prev = JSON.parse(readFileSync(LAST, 'utf8')) as { history?: Record<string, number> };
    Object.assign(prevTimes, prev.history ?? {});
  } catch { /* ignore */ }
}
const keyOf = (j: Job) => `${tier}:${j.id}`;
// A job's critical path: its own time plus what waits on it (a prefill shard carries its script's time).
const estOf = (j: Job): number => (prevTimes[keyOf(j)] ?? (tier === 'quick' && j.args?.quick ? Math.min(j.est, 60) : j.est)) + Math.max(0, ...jobs.filter((x) => x.after?.includes(j.id)).map((x) => prevTimes[keyOf(x)] ?? x.est));
const queue = [...jobs].sort((a, b) => Number(!!b.first) - Number(!!a.first) || estOf(b) - estOf(a));

// ---------- machine load (share of all cores busy) ----------
const busy = () => {
  let b = 0;
  let t = 0;
  for (const c of os.cpus()) {
    const x = c.times;
    const tot = x.user + x.nice + x.sys + x.idle + x.irq;
    t += tot;
    b += tot - x.idle;
  }
  return { b, t };
};

// CPU of each node process, written at exit by an inline --import hook (summed per job).
const CPU_DIR = join(CACHE_DIR, 'cpu');
const HOOK = `data:text/javascript,${encodeURIComponent("import{writeFileSync as w}from'node:fs';const d=process.env.T0_CPU_DIR;if(d)process.on('exit',()=>{try{const u=process.cpuUsage();w(d+'/'+process.pid+'.json',JSON.stringify(u))}catch{}})")}`;

interface Result { id: string; mode: string; status: number; pass: number; fail: number; warn: number; smoke: number; hits: number; misses: number; wall: number; cpu: number; log: string; failLines: string[] }

function runJob(j: Job): Promise<Result> {
  return new Promise((done) => {
    const extra = j.args?.[tier] ?? [];
    const cmd = j.script ? [process.execPath, '--import', 'tsx', join('scripts', 'v2', j.script), ...extra] : [...(j.argv as string[]), ...extra];
    const log = join(LOG_DIR, `${j.id}.log`);
    const out = createWriteStream(log);
    const cpuDir = join(CPU_DIR, j.id);
    rmSync(cpuDir, { recursive: true, force: true });
    mkdirSync(cpuDir, { recursive: true });
    const nodeOpts = [process.env.NODE_OPTIONS ?? '', `--import=${HOOK}`].join(' ').trim();
    const t0 = Date.now();
    const viaShell = cmd[0] === 'npm'; // npm is a .cmd on Windows: run the whole line through the shell
    const child = spawn(viaShell ? cmd.join(' ') : cmd[0], viaShell ? [] : cmd.slice(1), { cwd: ROOT, shell: viaShell, env: { ...process.env, ...j.env, FORCE_COLOR: '0', T0_CPU_DIR: cpuDir, NODE_OPTIONS: nodeOpts } });
    let text = '';
    const onData = (d: Buffer) => {
      out.write(d);
      text += d.toString('utf8');
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', (code) => {
      out.end();
      const wall = (Date.now() - t0) / 1000;
      let cpu = 0;
      try {
        for (const f of readdirSync(cpuDir)) {
          const u = JSON.parse(readFileSync(join(cpuDir, f), 'utf8')) as { user: number; system: number };
          cpu += (u.user + u.system) / 1e6;
        }
      } catch { /* ignore */ }
      rmSync(cpuDir, { recursive: true, force: true });
      const lines = text.split(/\r?\n/);
      const count = (re: RegExp) => lines.filter((l) => re.test(l)).length;
      const sc = /simcache: (\d+) hit\(s\), (\d+) miss/.exec(text);
      done({
        id: j.id, mode: j.mode?.[tier] ?? (extra.length ? extra.join(' ') : ''), status: code ?? 1,
        pass: count(/^(PASS|OK)\b/), fail: count(/^FAIL\b/), warn: count(/^WARN\b/), smoke: count(/^SMOKE\b/),
        hits: sc ? Number(sc[1]) : 0, misses: sc ? Number(sc[2]) : 0, wall, cpu, log,
        failLines: lines.filter((l) => /^FAIL\b|error TS|Error:|ERR!/.test(l)).slice(0, 12),
      });
    });
  });
}

// ---------- pool ----------
const t0 = Date.now();
const b0 = busy();
const results: Result[] = [];
console.log(`run.ts --tier ${tier}: ${queue.length} job(s), ${workers} worker(s), SIMCACHE=${process.env.SIMCACHE ?? 'on'}${pruned ? `, pruned ${pruned} old cache entries` : ''}`);
let running = 0;
let next = 0;
await new Promise<void>((allDone) => {
  const pump = () => {
    if (next >= queue.length && running === 0) return allDone();
    while (running < workers && next < queue.length) {
      // The first queued job whose prerequisites have finished.
      const idx = queue.findIndex((x, i) => i >= next && (x.after ?? []).every((a) => results.some((r) => r.id === a)));
      if (idx < 0) break;
      const [j] = queue.splice(idx, 1);
      queue.splice(next, 0, j);
      next++;
      running++;
      runJob(j).then((r) => {
        running--;
        results.push(r);
        const ok = r.status === 0 && r.fail === 0;
        console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${r.id.padEnd(17)} ${r.wall.toFixed(0).padStart(5)} s${r.mode ? `  (${r.mode})` : ''}${ok ? '' : `  → ${r.log}`}`);
        if (!ok) for (const l of r.failLines) console.log(`         ${l}`);
        pump();
      });
    }
  };
  pump();
});
const wall = (Date.now() - t0) / 1000;
const b1 = busy();
const load = (b1.b - b0.b) / Math.max(1, b1.t - b0.t);

// ---------- summary ----------
const order = new Map(JOBS.map((j, i) => [j.id, i]));
const rank = (id: string) => (order.get(id.split('#')[0]) ?? 0) + (id.includes('#') ? Number(id.split('#')[1]) / 100 - 0.5 : 0);
results.sort((a, b) => rank(a.id) - rank(b.id));
const pad = (s: string | number, n: number, right = false) => (right ? String(s).padStart(n) : String(s).padEnd(n));
console.log(`\n${pad('script', 17)} ${pad('mode', 10)} ${pad('pass', 5, true)} ${pad('fail', 5, true)} ${pad('warn', 5, true)} ${pad('smoke', 5, true)} ${pad('cache', 7, true)} ${pad('wall s', 7, true)} ${pad('cpu s', 7, true)}  status`);
for (const r of results) {
  const ok = r.status === 0 && r.fail === 0;
  console.log(`${pad(r.id, 17)} ${pad(r.mode, 10)} ${pad(r.pass, 5, true)} ${pad(r.fail, 5, true)} ${pad(r.warn, 5, true)} ${pad(r.smoke, 5, true)} ${pad(r.hits + r.misses ? `${r.hits}/${r.hits + r.misses}` : '', 7, true)} ${pad(r.wall.toFixed(1), 7, true)} ${pad(r.cpu.toFixed(1), 7, true)}  ${ok ? 'ok' : `FAIL (exit ${r.status})`}`);
}
const failed = results.filter((r) => r.status !== 0 || r.fail > 0);
const tot = results.reduce((a, r) => ({ pass: a.pass + r.pass, fail: a.fail + r.fail, cpu: a.cpu + r.cpu }), { pass: 0, fail: 0, cpu: 0 });
const scripts = results.filter((r) => !r.id.includes('#'));
const shardNote = scripts.length < results.length ? ` (+ ${results.length - scripts.length} prefill shards)` : '';
console.log(`\n${tier}: ${scripts.length - failed.filter((r) => !r.id.includes('#')).length}/${scripts.length} scripts ok${shardNote}, ${tot.pass} checks passed, ${tot.fail} failed; wall ${(wall / 60).toFixed(1)} min, cpu ${(tot.cpu / 60).toFixed(1)} min, machine load ${(load * 100).toFixed(0)}% (${os.cpus().length} cores, ${workers} workers)`);
if (tier === 'quick') console.log('quick is a smoke gate: SMOKE lines are informational; run the full tier (npm run test:full) before a merge.');
if (failed.length) console.log(`FAILED: ${failed.map((r) => r.id).join(', ')} (logs in ${LOG_DIR})`);

const history = { ...prevTimes };
for (const r of results) history[`${tier}:${r.id}`] = Math.round(r.wall);
writeFileSync(LAST, JSON.stringify({ tier, date: new Date().toISOString(), workers, wall, load, simcache: process.env.SIMCACHE ?? 'on', results: results.map(({ failLines: _f, ...r }) => r), history }, null, 2));
process.exit(failed.length ? 1 : 0);
