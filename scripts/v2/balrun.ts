// Parallel balance game runner (design/bal/TOOLING-DESIGN.md, C1). Plays every (policy × world × alignment × start) cell
// on one shared seed list, W worker processes, one GameRecord per game, and writes a per-cell summary.
//
//   npx tsx scripts/v2/balrun.ts --name <run> --policy ref[,mixed,...] --world tl-central[,tl-fast,...] --align medium[,sampled]
//                                --start leader[,...] --seeds N --workers W [--no-cache]
//                                [--set <param id>=<value> ...] [--sets <file.json>] [--forced aifm]
//
// --forced aifm (Stage 1, design/bal/STAGE1-DESIGN.md): every game is a forced run (botgame.ts playForced): the AI Futures Model's
// compute and staff paths drive the player's lab through the engine's FORCING hooks (installed by the worker preload,
// forcedInputs.ts), unlimited cash, no endings system, played to 2060. The record carries forced: 'aifm' and a yearly `series`.
//
// Overrides (scripts/v2/paramOverride.ts): --set applies a registry param override to every cell (repeatable; the value is JSON,
// else a string). --sets takes a JSON array of { name, set: { id: value } }; each becomes an extra cell dimension and the
// baseline (only the --set values) is always included as 'base'. Each worker process is bound to one override set for its whole life (see the scheduler in parent()): a worker
// applies its set in a --import preload (overridePreload.ts, before balrun or the game modules load) and never sees another
// set's jobs, so nothing leaks between jobs (overrides mutate loaded module objects and cannot be undone, hence one set per
// process rather than re-applying the baseline). The set name and values are in the cache key and in every GameRecord.
//
// Output, under balance/runs/<name>/ (git-ignored): config.json, games.jsonl (one GameRecord per line), progress.json
// (rewritten about every 10 s), summary.json (per-cell aggregates). Every game goes through the simulation cache
// (simcache.ts `cached`, keyed on the cell and the seed), so re-running a run replays finished games at once;
// --no-cache plays them all again. Paired seeds: every cell uses the same seed list, CAL_SEEDS first, then 1001, 1002, …
//
// Workers are child processes of this script. The parent hands out (cell, seed) jobs one at a time (a free worker takes the
// next, so long games don't leave others idle); each worker appends to its own games.<k>.jsonl and the parent merges them
// into games.jsonl at the end, in job order.
import { execSync, fork, type ChildProcess } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { POLICY_IDS } from './policies';
import { AIFM_CSV, FORCED_KINDS, HARNESS_EXCEPTIONS } from './forcedInputs';
import { CAL_SEEDS, quantOf } from './calseeds';
import { cached, codeHash } from './simcache';
import type { AlignDiffId, GameStateV2, MilestoneIdx, StartType, WorldPresetId } from '../../src/engine/v2/types';

const ME = fileURLToPath(import.meta.url);
const HERE = dirname(ME);
const BOTGAME = join(HERE, 'botgame.ts');
const MATCHED = join(HERE, 'matched.ts');
const PARAMOVR = join(HERE, 'paramOverride.ts');
const FORCEDIN = join(HERE, 'forcedInputs.ts');
const PRELOAD = pathToFileURL(join(HERE, 'overridePreload.ts')).href;
const ROOT = join(HERE, '..', '..');

// ───────────────────────────── Types ─────────────────────────────
export interface Cell { policy: string; world: WorldPresetId; alignment: AlignDiffId; start: StartType; forced?: string }
export interface GameRecord {
  run: string; seed: number;
  world: string; alignment: string; start: string; policy: string;
  /** Stage 1 forced run (balrun --forced): which prescribed inputs drove the game. Absent in normal runs. */
  forced?: string;
  /** Harness exceptions active in this forced run (forcedInputs.ts). */
  harnessExceptions?: string[];
  /** R3.1 (world tl-fast / tl-central / tl-slow): the AI Futures Model run this game's settings were drawn from (id, and its index in the timeline's group). */
  aifmRun?: string; aifmDraw?: number;
  overrides?: Record<string, number | string | boolean | number[]>;
  overrideSet?: string;
  endDay: number; ending: string; verdict: 'win' | 'mixed' | 'loss';
  milestones: { SC?: number; SAR?: number; SIAR?: number; ASI?: number };
  pMisAtEnd?: number; pMisAtASI?: number;
  revenueByYear?: number[];
  minCash?: number; insolvent?: boolean;
  rivalLeadAtSC?: number;
  chinaGapAtSC?: number;
  scores?: Record<string, number>;
  /** Forced runs: one sample at 2025.5 and at every later whole year (botgame.ts ForcedSeries). */
  series?: import('./botgame').ForcedSeries;
  ms: number;
}
type Body = Omit<GameRecord, 'run'>;
interface Job { id: number; cell: Cell; seed: number; set: number }
interface OSet { name: string; set: Record<string, number | string | boolean | number[]> }

const WORLDS: WorldPresetId[] = ['tl-fast', 'tl-central', 'tl-slow'];
const ALIGNS: AlignDiffId[] = ['sampled', 'easy', 'medium', 'hard'];
const STARTS: StartType[] = ['spinout', 'challenger', 'bigtech', 'leader'];

// The game modules (the whole engine, ~1 s of tsx transpiling and ~0.4 GB) are loaded by the worker only: the parent never plays.
let lagDays: typeof import('../../src/engine/v2/models/capability').lagDays;
let labMisalignment: typeof import('../../src/engine/v2/safety/traits').labMisalignment;
let pMis: typeof import('../../src/engine/v2/safety/traits').pMis;
let G: typeof import('./botgame');
async function loadGame() {
  [{ lagDays }, { labMisalignment, pMis }, G] = await Promise.all([import('../../src/engine/v2/models/capability'), import('../../src/engine/v2/safety/traits'), import('./botgame')]);
}

// ───────────────────────────── Playing one game ─────────────────────────────
const r3 = (x: number) => Math.round(x * 1000) / 1000;

const aifmRunOf = (s: GameStateV2) => { const a = s.hidden.timeline.aifmRun; return a ? { aifmRun: a.id, aifmDraw: a.index } : {}; };

function playForcedOne(cell: Cell, seed: number): Body {
  const t0 = performance.now();
  const s = G.newBotGame(seed, { world: cell.world, alignment: cell.alignment }, cell.start);
  const series = G.playForced(G.ALL[cell.policy], s);
  const md = s.player.milestoneDays;
  const ms: Record<string, number> = {};
  for (const [k, i] of [['SC', 3], ['SAR', 4], ['SIAR', 5], ['ASI', 6]] as [string, MilestoneIdx][]) if (md[i] !== undefined) ms[k] = md[i]!;
  return {
    seed, world: cell.world, alignment: cell.alignment, start: cell.start, policy: cell.policy, forced: cell.forced, harnessExceptions: HARNESS_EXCEPTIONS, ...aifmRunOf(s),
    endDay: s.time.day, ending: 'forced-end', verdict: 'mixed', milestones: ms, revenueByYear: [], series,
    ms: Math.round(performance.now() - t0),
  };
}

function playOne(cell: Cell, seed: number): Body {
  if (cell.forced) return playForcedOne(cell, seed);
  const t0 = performance.now();
  const s = G.newBotGame(seed, { world: cell.world, alignment: cell.alignment }, cell.start);
  let rivalLeadAtSC: number | undefined;
  let chinaGapAtSC: number | undefined;
  let seenSC = false;
  G.playBot(G.ALL[cell.policy], s, (x: GameStateV2) => {
    if (seenSC || x.player.milestoneDays[3] === undefined) return;
    seenSC = true;
    // Days the best rival (China: the Chinese lab) is ahead of the player at the player's SC; negative = behind.
    const act = x.rivals.filter((r) => r.core.status === 'active');
    if (act.length) rivalLeadAtSC = Math.round(Math.max(...act.map((r) => lagDays(x, 'player', r.core.id))));
    if (x.china.lab.core.status === 'active') chinaGapAtSC = Math.round(lagDays(x, 'player', 'china'));
  });
  const e = s.ending!;
  const md = s.player.milestoneDays;
  const ms: Record<string, number> = {};
  for (const [k, i] of [['SC', 3], ['SAR', 4], ['SIAR', 5], ['ASI', 6]] as [string, MilestoneIdx][]) if (md[i] !== undefined) ms[k] = md[i]!;
  const S = s.series;
  const revenueByYear: number[] = [];
  for (let yr = 1; 365 * yr <= e.day; yr++) {
    let j = -1;
    for (let i = 0; i < S.day.length && S.day[i] <= 365 * yr; i++) j = i;
    if (j >= 0 && S.revenue[j] !== undefined) revenueByYear.push(Math.round(S.revenue[j]));
  }
  const mis = labMisalignment(s, 'player');
  const asiOwn = e.epilogue.asiLab === 'player' && e.epilogue.misAtAsi !== undefined;
  const cashes = S.cash.filter((c) => Number.isFinite(c));
  return {
    seed, world: cell.world, alignment: cell.alignment, start: cell.start, policy: cell.policy, ...aifmRunOf(s),
    endDay: e.day, ending: e.id, verdict: e.verdict, milestones: ms,
    pMisAtEnd: r3(pMis(s, mis)), ...(asiOwn ? { pMisAtASI: r3(pMis(s, e.epilogue.misAtAsi!)) } : {}),
    revenueByYear,
    ...(cashes.length ? { minCash: Math.round(Math.min(...cashes)) } : {}),
    insolvent: e.id === 'insolvent',
    ...(rivalLeadAtSC !== undefined ? { rivalLeadAtSC } : {}), ...(chinaGapAtSC !== undefined ? { chinaGapAtSC } : {}),
    scores: { ...e.scores },
    ms: Math.round(performance.now() - t0),
  };
}

/** One game through the simulation cache (the key is the cell and the seed). */
const OVR: Record<string, unknown> = process.env.BAL_OVERRIDES ? JSON.parse(process.env.BAL_OVERRIDES) : {};
const OVR_NAME = process.env.BAL_SET_NAME;
const playCached = (cell: Cell, seed: number): Body =>
  cached('balrun', { ...cell, seed, ...(OVR_NAME ? { overrideSet: OVR_NAME, overrides: OVR } : {}) }, [ME, BOTGAME, MATCHED, PARAMOVR, FORCEDIN, ...(cell.forced ? [AIFM_CSV] : [])], () => playOne(cell, seed));

// ───────────────────────────── CLI ─────────────────────────────
const argv = process.argv.slice(2);
const flag = (k: string) => argv.indexOf(`--${k}`);
const arg = (k: string, d?: string) => {
  const i = flag(k);
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1];
  if (d === undefined) {
    console.error(`balrun: missing --${k}`);
    process.exit(2);
  }
  return d;
};
const list = <T extends string>(k: string, ok: readonly string[], d: string): T[] => {
  const xs = arg(k, d).split(',').filter(Boolean);
  const bad = xs.filter((x) => !ok.includes(x));
  if (bad.length || !xs.length) {
    console.error(`balrun: --${k} ${bad.join(',') || '(empty)'} not one of ${ok.join(', ')}`);
    process.exit(2);
  }
  return xs as T[];
};
export const seedList = (n: number) => [...CAL_SEEDS, ...Array.from({ length: Math.max(0, n - CAL_SEEDS.length) }, (_, i) => 1001 + i)].slice(0, n);
const cellKey = (c: { policy: string; world: string; alignment: string; start: string; overrideSet?: string; forced?: string }) => `${c.policy} | ${c.world}/${c.alignment} | ${c.start}${c.forced ? ` | forced:${c.forced}` : ''}${c.overrideSet ? ` | ${c.overrideSet}` : ''}`;

// ───────────────────────────── Worker ─────────────────────────────
async function worker() {
  const k = Number(arg('child'));
  const dir = arg('dir');
  const run = arg('name');
  const file = join(dir, `games.${arg('sidx')}_${k}.jsonl`);
  await loadGame();
  // Exit when the parent goes away. A game plays synchronously, so the IPC 'disconnect' event can't fire mid-game: a watchdog
  // thread polls the parent PID and kills this process outright (an abandoned game isn't cached or written, a re-run replays it).
  const gone = () => { try { process.kill(process.ppid, 0); return false; } catch { return true; } };
  process.on('disconnect', () => process.exit(0));
  new Worker("const{workerData:p}=require('node:worker_threads');setInterval(()=>{try{process.kill(p.ppid,0)}catch{process.kill(p.pid,'SIGKILL')}},1000)", { eval: true, workerData: { ppid: process.ppid, pid: process.pid } }).unref();
  if (gone() || !process.connected) process.exit(0);
  process.on('message', (m: { job?: Job; stop?: boolean }) => {
    if (m.stop) process.exit(0);
    if (!m.job) return;
    if (!process.connected || gone()) process.exit(0);
    try {
      const rec: GameRecord = { run, ...playCached(m.job.cell, m.job.seed), ...(OVR_NAME ? { overrideSet: OVR_NAME, ...(Object.keys(OVR).length ? { overrides: OVR as GameRecord['overrides'] } : {}) } : {}) };
      appendFileSync(file, `${JSON.stringify(rec)}\n`);
      process.send!({ id: m.job.id, ms: rec.ms });
    } catch (err) {
      process.send!({ id: m.job.id, err: String((err as Error)?.stack ?? err) });
    }
  });
  process.send!({ ready: true });
}

// ───────────────────────────── Summary ─────────────────────────────
/** Wilson 95% interval of k successes in n trials. */
export function wilson(k: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.96;
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}
const rate = (k: number, n: number) => ({ k, rate: n ? k / n : 0, ci95: wilson(k, n).map((x) => Math.round(x * 1000) / 1000) as [number, number] });
const q3 = (xs: number[]) => (xs.length ? { p10: Math.round(quantOf(xs, 0.1)), p50: Math.round(quantOf(xs, 0.5)), p90: Math.round(quantOf(xs, 0.9)) } : null);

export function summarize(recs: GameRecord[]) {
  const cells = new Map<string, GameRecord[]>();
  for (const r of recs) {
    const k = cellKey(r);
    (cells.get(k) ?? cells.set(k, []).get(k)!).push(r);
  }
  return [...cells.entries()].map(([key, rs]) => {
    const n = rs.length;
    const count = (v: GameRecord['verdict']) => rs.filter((r) => r.verdict === v).length;
    const endings: Record<string, number> = {};
    for (const r of rs) endings[r.ending] = (endings[r.ending] ?? 0) + 1;
    const ms: Record<string, ReturnType<typeof q3> & { reached?: number }> = {};
    for (const m of ['SC', 'SAR', 'SIAR', 'ASI'] as const) {
      const xs = rs.map((r) => r.milestones[m]).filter((x): x is number => x !== undefined);
      ms[m] = { ...(q3(xs) ?? { p10: null, p50: null, p90: null }), reached: xs.length } as never;
    }
    const pm = rs.map((r) => r.pMisAtASI).filter((x): x is number => x !== undefined);
    const msTimes = rs.map((r) => r.ms);
    const c0 = rs[0];
    return {
      key, policy: c0.policy, world: c0.world, alignment: c0.alignment, start: c0.start, ...(c0.forced ? { forced: c0.forced, harnessExceptions: HARNESS_EXCEPTIONS } : {}), ...(c0.overrideSet ? { overrideSet: c0.overrideSet } : {}), ...(c0.overrides ? { overrides: c0.overrides } : {}),
      n,
      win: rate(count('win'), n), mixed: rate(count('mixed'), n), loss: rate(count('loss'), n),
      endings, milestoneDays: ms,
      pMisAtASI: { n: pm.length, p50: pm.length ? Math.round(quantOf(pm, 0.5) * 1000) / 1000 : null },
      insolvent: rate(rs.filter((r) => r.insolvent).length, n),
      gameMs: { median: Math.round(quantOf(msTimes, 0.5)) },
    };
  });
}

// ───────────────────────────── Parent ─────────────────────────────
async function parent() {
  const name = arg('name');
  if (!/^[\w.-]+$/.test(name)) {
    console.error('balrun: --name must be letters, digits, . _ -');
    process.exit(2);
  }
  const policies = list<string>('policy', POLICY_IDS, 'ref');
  const worlds = list<WorldPresetId>('world', WORLDS, 'tl-central');
  const aligns = list<AlignDiffId>('align', ALIGNS, 'medium');
  const starts = list<StartType>('start', STARTS, 'leader');
  const nSeeds = Math.max(1, Number(arg('seeds', '20')));
  const workers = Math.max(1, Number(arg('workers', '8')));
  const noCache = flag('no-cache') >= 0;
  const forced = flag('forced') >= 0 ? list<string>('forced', FORCED_KINDS, FORCED_KINDS[0])[0] : undefined;
  const seeds = seedList(nSeeds);
  const parseVal = (v: string) => { try { return JSON.parse(v); } catch { return v; } };
  const globalSet: OSet['set'] = {};
  argv.forEach((a, i) => {
    if (a !== '--set') return;
    const m = /^([^=]+)=(.*)$/s.exec(argv[i + 1] ?? '');
    if (!m) throw new Error('balrun: --set needs <param id>=<value>');
    globalSet[m[1]] = parseVal(m[2]);
  });
  const fileSets: OSet[] = flag('sets') >= 0 ? JSON.parse(readFileSync(arg('sets'), 'utf8')) : [];
  const useSets = flag('sets') >= 0 || Object.keys(globalSet).length > 0;
  const sets: OSet[] = useSets ? [{ name: 'base', set: globalSet }, ...fileSets.map((x) => ({ name: x.name, set: { ...globalSet, ...x.set } }))] : [{ name: '', set: {} }];
  if (new Set(sets.map((x) => x.name)).size !== sets.length) { console.error('balrun: override set names must be unique and not "base"'); process.exit(2); }
  const cells: Cell[] = [];
  for (const policy of policies) for (const world of worlds) for (const alignment of aligns) for (const start of starts) cells.push({ policy, world, alignment, start, ...(forced ? { forced } : {}) });
  const jobs: Job[] = seeds.flatMap((seed) => cells.flatMap((cell) => sets.map((_, set) => ({ id: 0, cell, seed, set })))).map((j, id) => ({ ...j, id }));

  const dir = join(ROOT, 'balance', 'runs', name);
  mkdirSync(dir, { recursive: true });
  // Lock: one live run per name. A lock whose PID is dead is stale and replaced.
  const lockFile = join(dir, 'running.lock');
  if (existsSync(lockFile)) {
    let pid = 0;
    try { pid = Number((JSON.parse(readFileSync(lockFile, 'utf8')) as { pid?: number }).pid); } catch { /* unreadable: stale */ }
    let live = false;
    if (pid > 0 && pid !== process.pid) { try { process.kill(pid, 0); live = true; } catch { live = false; } }
    if (live) { console.error(`balrun: run "${name}" is already running (PID ${pid}, ${lockFile}). Stop it or use another --name.`); process.exit(2); }
  }
  writeFileSync(lockFile, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  const children = new Set<ChildProcess>();
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    for (const c of children) { try { c.kill('SIGKILL'); } catch { /* already gone */ } }
    try { rmSync(lockFile, { force: true }); } catch { /* ignore */ }
  };
  process.on('exit', cleanup);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK'] as const) process.on(sig, () => { cleanup(); process.exit(130); });
  for (const f of readdirSync(dir)) if (/^(games([._\d]+)?\.jsonl|summary\.json|progress\.json)$/.test(f)) rmSync(join(dir, f));
  const startedAt = new Date().toISOString();
  const git = (() => { try { return execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return null; } })();
  writeFileSync(join(dir, 'config.json'), JSON.stringify({
    name, args: argv, ...(forced ? { forced, harnessExceptions: HARNESS_EXCEPTIONS } : {}), policy: policies, world: worlds, align: aligns, start: starts, seedsN: nSeeds, workers, cache: !noCache,
    gitCommit: git, codeHash: codeHash([ME, BOTGAME, MATCHED, PARAMOVR, FORCEDIN]), node: process.version, seeds, cells: cells.map(cellKey), sets: useSets ? sets : undefined, startedAt,
  }, null, 2));

  const total = jobs.length;
  let done = 0;
  let hits = 0;
  let misses = 0;
  const failed: string[] = [];
  const doneMs: number[] = [];
  const t0 = Date.now();
  const writeProgress = () => {
    const mins = (Date.now() - t0) / 60000;
    writeFileSync(join(dir, 'progress.json'), JSON.stringify({ done, total, failed: failed.length, gamesPerMin: mins > 0 ? Math.round((done / mins) * 10) / 10 : 0, startedAt, updatedAt: new Date().toISOString() }));
  };
  writeProgress();
  const tick10 = setInterval(writeProgress, 10_000);
  const tick30 = setInterval(() => {
    const mins = (Date.now() - t0) / 60000;
    console.log(`[${name}] ${done}/${total} games, ${(done / Math.max(mins, 1e-9)).toFixed(1)}/min, ${((Date.now() - t0) / 1000).toFixed(0)} s${failed.length ? `, ${failed.length} failed` : ''}`);
  }, 30_000);

  // Scheduling: up to `workers` processes at once, each bound to ONE override set for its whole life (overrides mutate the
  // loaded modules and can't be undone). A worker takes its set's jobs over IPC and exits when that set has none left; the
  // parent then fills the free slot: first a set with no worker yet, else the set with the most pending jobs per worker.
  const queues = sets.map((_, si) => jobs.filter((j) => j.set === si));
  const nextIdx = sets.map(() => 0);
  const alive = sets.map(() => 0); // live workers per set
  const starting = sets.map(() => 0); // of those, not yet ready (no job fed)
  let active = 0;
  let wid = 0;
  await new Promise<void>((resolveAll) => {
    const fill = () => {
      for (;;) {
        if (active >= workers) break;
        let best = -1;
        let bestScore = -1;
        for (let si = 0; si < sets.length; si++) {
          const pend = queues[si].length - nextIdx[si] - starting[si];
          if (pend <= 0) continue;
          const score = alive[si] === 0 ? Infinity : pend / alive[si];
          if (score > bestScore) { best = si; bestScore = score; }
        }
        if (best < 0) break;
        spawn(best);
      }
      if (active === 0) resolveAll();
    };
    const spawn = (si: number, retry = false) => {
      const k = wid++;
      const mine = queues[si];
      const env = { ...process.env, ...(noCache ? { SIMCACHE: 'off' } : {}), ...(forced ? { BAL_FORCED: forced } : {}), ...(useSets ? { BAL_OVERRIDES: JSON.stringify(sets[si].set), BAL_SET_NAME: sets[si].name } : {}) };
      const child = fork(ME, ['--child', String(k), '--sidx', String(si), '--dir', dir, '--name', name], { execArgv: ['--import', 'tsx', ...(useSets || forced ? ['--import', PRELOAD] : [])], env, stdio: ['inherit', 'inherit', 'pipe', 'ipc'] });
      children.add(child);
      active++;
      alive[si]++;
      starting[si]++;
      let ready = false;
      // simcache prints its hit/miss line to stderr when a worker exits: total them, pass anything else on.
      let buf = '';
      child.stderr!.on('data', (d: Buffer) => {
        buf += d.toString();
        const lines = buf.split(/\r?\n/);
        buf = lines.pop()!;
        for (const l of lines) {
          const m = /^simcache: (\d+) hit\(s\), (\d+) miss/.exec(l);
          if (m) { hits += Number(m[1]); misses += Number(m[2]); } else console.error(l);
        }
      });
      const feed = () => {
        if (nextIdx[si] < mine.length) child.send({ job: mine[nextIdx[si]++] });
        else child.send({ stop: true });
      };
      child.on('message', (m: { ready?: boolean; id?: number; ms?: number; err?: string }) => {
        if (m.ready) { ready = true; starting[si]--; return feed(); }
        done++;
        if (m.err) { failed.push(`job ${m.id}: ${m.err.split('\n')[0]}`); console.error(m.err.split('\n').slice(0, 5).join('\n')); }
        else if (m.ms !== undefined) doneMs.push(m.ms);
        feed();
      });
      child.on('exit', (code) => {
        children.delete(child);
        if (!ready && !retry && code === 3221225794) { // STATUS_DLL_INIT_FAILED: Windows couldn't start it; try once more after a pause
          starting[si]--;
          alive[si]--;
          setTimeout(() => { active--; spawn(si, true); }, 3000); // active stays held meanwhile so the run isn't seen as finished
          return;
        }
        if (code !== 0 && code !== null) failed.push(`worker ${k} exit ${code}`);
        if (!ready) {
          starting[si]--;
          if (code !== 0) { // died before loading: don't respawn forever; drop this set's remaining jobs
            const lost = mine.length - nextIdx[si];
            nextIdx[si] = mine.length;
            done += lost;
            if (lost) failed.push(`set ${sets[si].name || 'base'}: ${lost} job(s) not run`);
          }
        }
        alive[si]--;
        active--;
        fill();
      });
    };
    fill();
  });
  clearInterval(tick10);
  clearInterval(tick30);

  // Merge the per-worker files into games.jsonl in job order (cell order within seed order).
  const order = new Map(jobs.map((j) => [`${cellKey({ ...j.cell, overrideSet: useSets ? sets[j.set].name : undefined })}#${j.seed}`, j.id]));
  const recs: GameRecord[] = [];
  for (const f of readdirSync(dir)) {
    if (!/^games\.\d+_\d+\.jsonl$/.test(f)) continue;
    for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) if (line.trim()) recs.push(JSON.parse(line) as GameRecord);
    rmSync(join(dir, f));
  }
  recs.sort((a, b) => (order.get(`${cellKey(a)}#${a.seed}`) ?? 0) - (order.get(`${cellKey(b)}#${b.seed}`) ?? 0));
  writeFileSync(join(dir, 'games.jsonl'), recs.map((r) => `${JSON.stringify(r)}\n`).join(''));
  writeProgress();
  const summary = summarize(recs);
  writeFileSync(join(dir, 'summary.json'), JSON.stringify({ name, n: recs.length, expected: total, failed, wallSeconds: Math.round((Date.now() - t0) / 1000), cells: summary }, null, 2));

  // Compact per-cell table.
  const pc = (r: { rate: number }) => `${(100 * r.rate).toFixed(0)}%`.padStart(4);
  const md = (m: { p50: number | null } | null | undefined) => (m?.p50 != null ? String(m.p50).padStart(5) : '    -');
  console.log(`\n${name}: ${recs.length}/${total} games in ${((Date.now() - t0) / 1000).toFixed(0)} s (cache ${hits} hit, ${misses} miss)${failed.length ? `, ${failed.length} FAILED` : ''} -> balance/runs/${name}/`);
  console.log('cell                                  n   win [95%]       mixed  loss   SC    SAR   ASI  pMis@ASI insolv');
  for (const c of summary) {
    console.log(`${c.key.padEnd(34)} ${String(c.n).padStart(3)}  ${pc(c.win)} [${(100 * c.win.ci95[0]).toFixed(0)}-${(100 * c.win.ci95[1]).toFixed(0)}]`.padEnd(60)
      + ` ${pc(c.mixed)}  ${pc(c.loss)}  ${md(c.milestoneDays.SC)} ${md(c.milestoneDays.SAR)} ${md(c.milestoneDays.ASI)}  ${c.pMisAtASI.p50 !== null ? c.pMisAtASI.p50.toFixed(2) : '   -'}   ${pc(c.insolvent)}`);
  }
  for (const f of failed.slice(0, 5)) console.error(`  ${f}`);
  if (failed.length) process.exitCode = 1;
}

if (flag('child') >= 0) await worker();
else if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/v2/balrun.ts')) await parent();
