// Daily-tick profiler (task P2). Owner: WS1. Run: npx tsx scripts/v2/profile.ts [days=1500] [reps=2]
// Runs hygiene's two perf games (seed 9, passive player; with the leader lab, endings skipped) and a RefBot game
// (seed 5, sampled world, endings skipped) and prints µs per system per live day (each system's run wrapped), the daily
// average and the worst quarterly tick. Machine load moves absolute numbers by 2×: compare runs made in one session.
// For hot functions: node --cpu-prof --import tsx scripts/v2/profile.ts (or bundle it with esbuild for line numbers).
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { tick } from '../../src/engine/v2/core/loop';
import { SYSTEMS } from '../../src/engine/v2/core/registry';
import { cadencesDue } from '../../src/engine/v2/core/time';
import { refPlay } from '../../src/engine/v2/bots/ref';
import { engine } from '../../src/engine/v2/index';
import type { GameStateV2, TickOptions } from '../../src/engine/v2/types';

const tot = new Map<string, number>();
const cnt = new Map<string, number>();
for (const sys of SYSTEMS) {
  const run = sys.run.bind(sys);
  (sys as { run: typeof sys.run }).run = (s, ctx) => {
    const t0 = performance.now();
    run(s, ctx);
    tot.set(sys.id, (tot.get(sys.id) ?? 0) + performance.now() - t0);
    cnt.set(sys.id, (cnt.get(sys.id) ?? 0) + 1);
  };
}
const N = Number(process.argv[2] ?? 1500);
const REPS = Number(process.argv[3] ?? 2);

function play(mk: () => GameStateV2, bot: boolean, opts?: TickOptions) {
  const s = mk();
  let daily = 0;
  let nd = 0;
  let worstQ = 0;
  let live = 0;
  for (let d = 0; d < N; d++) {
    if (bot && !s.ending) refPlay(s, engine);
    const q = cadencesDue(s.time.startDate, s.time.day + 1).includes('quarterly');
    if (!s.ending) live++;
    const t0 = performance.now();
    tick(s, opts);
    const dt = performance.now() - t0;
    if (q) worstQ = Math.max(worstQ, dt);
    else {
      daily += dt;
      nd++;
    }
  }
  return { daily: daily / nd, worstQ, live };
}

const CASES: [string, () => GameStateV2, boolean, TickOptions | undefined][] = [
  ['hygiene, seed 9', () => newGame(defaultSetupV2({ seed: 9 })), false, undefined],
  ['hygiene, seed 9, leader lab', () => newGame(defaultSetupV2({ seed: 9, leaderLab: true })), false, { skip: ['endings'] }],
  ['RefBot, seed 5, sampled', () => newGame(defaultSetupV2({ seed: 5, world: 'sampled', alignment: 'sampled', econ: 'sampled' })), true, { skip: ['endings'] }],
];
for (const [name, mk, bot, opts] of CASES) {
  play(mk, bot, opts); // warm-up
  tot.clear();
  cnt.clear();
  let daily = 0;
  let worstQ = 0;
  let live = 0;
  for (let r = 0; r < REPS; r++) {
    const x = play(mk, bot, opts);
    daily += x.daily / REPS;
    worstQ = Math.max(worstQ, x.worstQ);
    live = x.live;
  }
  const days = live * REPS;
  console.log(`\n== ${name}: daily avg ${(daily * 1000).toFixed(0)} µs, worst quarter tick ${worstQ.toFixed(2)} ms, live days ${live}`);
  const rows = [...tot.entries()].map(([id, t]) => [id, (t * 1000) / days, (t * 1000) / (cnt.get(id) ?? 1)] as const).sort((a, b) => b[1] - a[1]);
  let sum = 0;
  for (const [id, perDay, perRun] of rows) {
    sum += perDay;
    console.log(`${id.padEnd(16)} ${perDay.toFixed(1).padStart(8)} µs/day ${perRun.toFixed(1).padStart(9)} µs/run`);
  }
  console.log(`${'sum'.padEnd(16)} ${sum.toFixed(1).padStart(8)} µs/day`);
}
