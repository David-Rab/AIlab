// Engine hygiene (V2-SPEC §7.5). Owner: WS1.
// Registry contract, newGame validity, determinism, stream isolation, save round trip and size, cadences,
// cause ledger, performance. `--no-perf` skips the performance section (8; wall-time budgets, meaningless on a loaded
// machine: test:full runs hygiene with --no-perf); `--perf-only` runs only section 8 (test:perf, on a quiet machine).
import { AGENDA_IDS } from '../../src/data/v2/agendas';
import { TRAIT_IDS } from '../../src/data/v2/traits';
import { causeStrip } from '../../src/engine/v2/core/causes';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx, resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID, SYSTEMS } from '../../src/engine/v2/core/registry';
import { STREAMS, StreamRng } from '../../src/engine/v2/core/rng';
import { MIN_SCHEMA_REV, OLD_SAVE_MESSAGE, SAVE_BUDGET_BYTES, SCHEMA_REV, deserialize, serialize, stateHash } from '../../src/engine/v2/core/save';
import { cadencesDue } from '../../src/engine/v2/core/time';
import { gV0 } from '../../src/engine/v2/models/capability';
import { START_BY_ID } from '../../src/data/v2/starts';
import { ownedOnline, rentedOnline } from '../../src/engine/v2/compute/power';
import { nodeKnown } from '../../src/engine/v2/models/tree';
import type { Cadence, EngineSystem, GameStateV2, SetupV2, StreamId, WorkstreamId } from '../../src/engine/v2/types';
import { ASI_EXTRA, V3_CAL } from '../../src/data/v2/workTypes';
import { refBot } from '../../src/engine/v2/bots/ref';
import { engine } from '../../src/engine/v2/index';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURE_DIR, SMOKE, check, finish, runTo, validateJson } from './lib';
import { ROOT, cached, prefill } from './simcache';
import { spawnSync } from 'node:child_process';
import { deepFreeze, readSweep, sweptFunctions } from './readsweep';

const N = 1500;
const PERF_ONLY = process.argv.includes('--perf-only');
const NO_PERF = process.argv.includes('--no-perf');

// Section 3b's lockstep games (model v3 G1), cached: the seeds F4 saw move (2, 4, 11) to mid-2027 (past SC on most
// seeds), the full selector sweep every READ_EVERY days. --smoke (test:quick): seed 4 to day 240.
const READ_SEEDS = SMOKE ? [4] : [2, 4, 11];
const READ_DAYS = SMOKE ? 240 : 730;
const READ_EVERY = 7;
const READ_FILES = [fileURLToPath(import.meta.url), fileURLToPath(new URL('./readsweep.ts', import.meta.url))];
/** RefBot plays one day (worldfx's refDay: decide pending events, act, tick with endings skipped). */
function refDay(s: GameStateV2) {
  for (const p of [...s.events.pending]) {
    const c = refBot.decide(s, p);
    if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
  }
  refBot.act(s, engine);
  tick(s, { skip: ['endings'] });
}
/** The classic ai2027 RefBot game twice in lockstep, one read with readSweep every READ_EVERY days: the first day the
 *  two state hashes differ (null: never). */
function readPurityRec(seed: number): { firstDiff: number | null } {
  return cached('hygiene-readpure', { seed, days: READ_DAYS, every: READ_EVERY }, READ_FILES, () => {
    const mk = () => newGame(defaultSetupV2({ seed, world: 'tl-central', alignment: 'medium', tutorial: false }));
    const plain = mk();
    const read = mk();
    readSweep(read);
    while (plain.time.day < READ_DAYS) {
      refDay(plain);
      refDay(read);
      if (read.time.day % READ_EVERY === 0) readSweep(read);
      if (stateHash(plain) !== stateHash(read)) return { firstDiff: plain.time.day };
    }
    return { firstDiff: null };
  });
}
// Section 3b (c): the game played at shifted calibration values; `--history-child` plays it in a fresh process.
const HIST_SETUP = defaultSetupV2({ seed: 4, world: 'tl-central', alignment: 'medium', tutorial: false });
const HIST_DAYS = 30;
/** Shift every harness-mutable calibration table (as calscan.ts / calib.ts do between games); returns the restore. */
function shiftCalibration(): () => void {
  const saved = { v3: JSON.stringify(V3_CAL), asi: ASI_EXTRA.gaps };
  for (const c of Object.values(V3_CAL)) Object.assign(c, { gSC: c.gSC - 0.4, dBM: c.dBM + 0.3, sdSC: c.sdSC + 0.5 });
  ASI_EXTRA.gaps += 0.2;
  return () => {
    for (const [k, c] of Object.entries(JSON.parse(saved.v3) as typeof V3_CAL)) Object.assign(V3_CAL[k as keyof typeof V3_CAL], c);
    ASI_EXTRA.gaps = saved.asi;
  };
}
if (process.argv.includes('--history-child')) {
  shiftCalibration();
  console.log(`HISTORY ${stateHash(runTo(newGame(HIST_SETUP), HIST_DAYS))}`);
  process.exit(0);
}
prefill(READ_SEEDS.map((x) => () => readPurityRec(x)));

// Stream instrumentation for section 4 (stream isolation). Installed before everything else so that --perf-only
// measures the tick under exactly the same wrappers as a full run (outside a logged run they only pass through).
const MOD = 1n << 32n;
const STEP = 0x6d2b79f5n;
const STEP_INV = (() => {
  // modular inverse of the (odd) mulberry32 increment mod 2^32 (extended Euclid)
  let [r0, r1, t0, t1] = [MOD, STEP, 0n, 1n];
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [t0, t1] = [t1, t0 - q * t1];
  }
  return ((t0 % MOD) + MOD) % MOD;
})();
const stepsBetween = (from: number, to: number) => Number(((((BigInt(to) - BigInt(from)) % MOD) + MOD) % MOD * STEP_INV) % MOD);
const advance = (state: number, steps: number) => Number((BigInt(state) + BigInt(steps) * STEP) % MOD);
interface DrawLog { expected: Partial<Record<StreamId, number>>; broken: Set<string>; draws: Partial<Record<StreamId, number>>; bySystem: Map<string, Set<StreamId>> }
let current = '(outside tick)';
let log: DrawLog | undefined;
type Holder = { id: StreamId; holder: { rng: Record<StreamId, number> }; r: { state: number }; __loaded?: number };
const proto = StreamRng.prototype as unknown as { load(this: Holder): unknown; save<T>(this: Holder, v: T): T };
const load0 = proto.load;
const save0 = proto.save;
proto.load = function (this: Holder) {
  if (log) {
    const st = this.holder.rng[this.id];
    if (log.expected[this.id] === undefined) log.expected[this.id] = st;
    else if (log.expected[this.id] !== st) log.broken.add(`${this.id} (state changed outside its draws, in ${current})`);
    this.__loaded = st;
    log.draws[this.id] = (log.draws[this.id] ?? 0) + 1;
    let set = log.bySystem.get(current);
    if (!set) log.bySystem.set(current, (set = new Set()));
    set.add(this.id);
  }
  return load0.call(this);
};
proto.save = function <T>(this: Holder, v: T): T {
  const out = save0.call(this, v) as T;
  if (log && this.__loaded !== undefined) log.expected[this.id] = advance(this.__loaded, stepsBetween(this.__loaded, this.r.state));
  return out;
};
for (const sys of SYSTEMS) {
  const run0 = sys.run;
  sys.run = (s, ctx) => {
    const prev = current;
    current = sys.id;
    try {
      run0(s, ctx);
    } finally {
      current = prev;
    }
  };
}

if (!PERF_ONLY) { // sections 1–7

// ---------- 1. Registry matches the spec table (§2.2) ----------
const SPEC: [string, string, Cadence, number][] = [
  ['clock', 'WS1', 'daily', 10], ['computeOnline', 'WS3', 'daily', 20], ['production', 'WS1', 'daily', 30], ['research', 'WS1', 'daily', 35], ['build', 'WS1', 'daily', 38],
  ['runs', 'WS1', 'daily', 40], ['continual', 'WS1', 'daily', 45], ['milestones', 'WS1', 'daily', 50],
  ['revenue', 'WS5', 'daily', 60], ['safetyResearch', 'WS2', 'daily', 70], ['traitsDaily', 'WS2', 'daily', 75],
  ['incidents', 'WS2', 'daily', 80], ['security', 'WS4', 'daily', 90], ['rivalsChina', 'WS4', 'daily', 100],
  ['worldDaily', 'WS5', 'daily', 110], ['actorsDaily', 'WS4', 'daily', 120], ['publicDaily', 'WS4', 'daily', 121], ['usgovDaily', 'WS4', 'daily', 122], ['chinagovDaily', 'WS4', 'daily', 123], ['opex', 'WS3', 'daily', 130],
  ['director', 'WS4', 'daily', 140], ['endings', 'WS4', 'daily', 150], ['products', 'WS1', 'daily', 155], ['record', 'WS1', 'weekly', 160],
  ['hiring', 'WS1', 'weekly', 200], ['payroll', 'WS3', 'monthly', 300],
  ['economy', 'WS5', 'monthly', 310], ['computeHistQ', 'WS3', 'quarterly', 399], ['marketQ', 'WS3', 'quarterly', 400], ['sitesQ', 'WS3', 'quarterly', 410],
  ['capitalQ', 'WS3', 'quarterly', 420], ['boardQ', 'WS3', 'quarterly', 430], ['geoShocksQ', 'WS4', 'quarterly', 441], ['copyrightQ', 'WS4', 'quarterly', 442], ['npcQ', 'WS4', 'quarterly', 443],
  ['safetyFramework', 'WS2', 'daily', 39], ['autoSplit', 'WS1', 'daily', 62],
];
for (const [id, owner, cadence, order] of SPEC) {
  const s = SYSTEMS.find((x) => x.id === id);
  check(!!s && s.owner === owner && s.cadence === cadence && s.order === order, `registry ${id}`, s ? `${s.owner} ${s.cadence} ${s.order}` : 'missing');
}
const extra = SYSTEMS.filter((s) => !SPEC.some(([id]) => id === s.id)).map((s) => s.id);
check(extra.length === 0, 'registry has no unlisted systems', extra.join(', ') || 'none (add new systems to this table)');

// ---------- 2. newGame validity across setups ----------
const setups: SetupV2[] = [
  defaultSetupV2({ seed: 1 }),
  defaultSetupV2({ seed: 2, world: 'tl-central', alignment: 'sampled' }),
  defaultSetupV2({ seed: 3, world: 'tl-central', governance: 'founder', alignment: 'hard' }),
  defaultSetupV2({ seed: 4, world: 'tl-slow', alignment: 'easy' }),
  defaultSetupV2({ seed: 5, world: 'tl-fast', governance: 'nonprofitPBC', tutorial: false }),
  defaultSetupV2({ seed: 6 }), // the default cast
  defaultSetupV2({ seed: 7, world: 'tl-fast' }),
  // R9: every start type (the leader lab follows the start, D1).
  defaultSetupV2({ seed: 12, start: 'challenger' }),
  defaultSetupV2({ seed: 13, start: 'bigtech', world: 'tl-central', alignment: 'sampled' }),
  defaultSetupV2({ seed: 14, start: 'spinout' }),
];
for (const setup of setups) {
  const s = newGame(setup);
  const errs = validateJson(s);
  const tag = `newGame ${setup.start}/${setup.world}/${setup.alignment}`;
  const nRivals = s.rivals.length; // N10: the cast (setup.cast) sets the count
  check(errs.length === 0, `${tag}: plain JSON`, errs.slice(0, 3).join('; '));
  check(STREAMS.every((k) => typeof s.rng[k] === 'number' && s.rng[k] > 0), `${tag}: all RNG streams seeded`);
  check(s.rivals.length === nRivals && s.rivals.every((r) => r.core.status === 'active'), `${tag}: ${nRivals} active rivals`);
  check(AGENDA_IDS.every((a) => s.player.safety.agendas[a]) && AGENDA_IDS.every((a) => s.hidden.agendaEfficacy[a] >= 0 && s.hidden.agendaEfficacy[a] <= 1), `${tag}: agendas + efficacy`);
  const v0 = s.player.models.versions[0];
  check(TRAIT_IDS.every((t) => v0.traitsTrue[t] !== undefined && v0.beliefs[t] && v0.masks[t]), `${tag}: V0 traits/beliefs/masks`);
  const def = START_BY_ID[setup.start];
  const division = def.board === 'parent';
  check(s.player.computeOnline > 0 && s.player.finance.cash > 0 && (division ? s.player.finance.valuation === 0 : s.player.finance.valuation > 0), `${tag}: finance/compute start`, `cash ${s.player.finance.cash} V ${s.player.finance.valuation.toFixed(0)} C ${s.player.computeOnline}`);
  if (setup.start !== 'leader') {
    // R9 start data: teams, owned/rented compute, known nodes, products and features, board, lag.
    const ref = gV0(s.hidden.timeline);
    const nTeams = Object.values(def.teams).reduce((a, b) => a + b, 0);
    check(s.player.teams.length === nTeams && Math.abs(ownedOnline(s) - def.owned) < 1 && Math.abs(rentedOnline(s) - def.rented) < 1, `${tag}: teams and compute owned / rented`, `${s.player.teams.length} teams, ${ownedOnline(s)} / ${rentedOnline(s)}`);
    check(def.known.every((id) => nodeKnown(s, id)) && def.features.every((f) => s.player.features.includes(f)), `${tag}: known nodes and built features`);
    const prods = s.player.deployments.filter((d) => d.channel !== 'internal').map((d) => d.channel).join(',');
    check(prods === def.products.map((x) => x.channel).join(',') && s.player.board.preset === def.board && s.setup.governance === def.board, `${tag}: products and board`, `${prods} · ${s.player.board.preset}`);
    const v = s.player.models.versions[0];
    check(v.G < ref && (def.imported ? v.variant === 'imported' && s.player.models.runs.length === 0 : v.variant === 'full'), `${tag}: start model lags the reference (${def.lagMonths} mo)${def.imported ? ', imported (D6)' : ''}`, `G ${v.G.toFixed(3)} < ${ref.toFixed(3)}`);
  }
  // NPC labs start at their cast lag behind the reference frontier (design/npc/NPC-LABS.md §4).
  check(s.rivals.every((r) => !!r.npc && r.npc.d0 >= 0 && Math.abs(r.npc.d - r.npc.d0) < 1e-9), `${tag}: NPC labs start at their cast lag`, s.rivals.map((r) => Math.round(r.npc?.d0 ?? -1)).join(', '));
  tick(s);
  check(s.time.day === 1, `${tag}: first tick advances to day 1`);
}

// ---------- 3. Determinism ----------
const run = (setup: SetupV2, days = N, opts?: Parameters<typeof tick>[1]) => runTo(newGame(setup), days, opts);
const detSetup = defaultSetupV2({ seed: 42, world: 'tl-central', alignment: 'sampled' });
const a = run(detSetup);
const b = run(detSetup);
check(stateHash(a) === stateHash(b), `determinism: same seed → same hash after ${N} ticks`, stateHash(a));
check(stateHash(run({ ...detSetup, seed: 43 }, 10)) !== stateHash(run(detSetup, 10)), 'determinism: different seed → different hash');

// ---------- 3b. Readouts are pure; a game does not depend on the process's history (model v3 G1) ----------
// A selector may not write the state, draw from a stream or leave a cache a later tick reads differently; and a game is
// a function of its setup and the code, not of what ran before it in the process (F4 saw seeds 2, 4 and 11 move when
// the same classic game was read with extra readouts: the cause was a process-wide memo of the ai2027 reference path,
// built once from V3_CAL, which the calibration harness had changed between games; safety/oversight.ts refPathEntry).
{
  // (a) Every UI-facing selector on a deep-frozen state: none writes (a write to a frozen object throws in ES modules).
  const writers: string[] = [];
  let calls = 0;
  for (const f of ['day0', 'day400', 'day900']) {
    const s = deepFreeze(deserialize(readFileSync(join(FIXTURE_DIR, `${f}.json`), 'utf8')));
    const r = readSweep(s);
    calls += r.calls;
    writers.push(...r.fails.map((x) => `${f}: ${x}`));
  }
  check(writers.length === 0, `readouts: no selector writes the state (${sweptFunctions().length} engine exports and worldfx readouts, ${calls} calls on deep-frozen day 0 / 400 / 900 fixtures)`, writers.slice(0, 4).join('; '));
  // (b) Classic RefBot games (worldfx's setup) in lockstep, one plain and one with the full sweep every READ_EVERY days:
  //     the state hash is identical every day.
  const bad: string[] = [];
  for (const seed of READ_SEEDS) {
    const r = readPurityRec(seed);
    if (r.firstDiff !== null) bad.push(`seed ${seed}: first differs on day ${r.firstDiff}`);
  }
  check(bad.length === 0, `readouts: a classic RefBot game read with every selector every ${READ_EVERY} days keeps the same state hash every day as the same game unread (seeds ${READ_SEEDS.join(', ')}, ${READ_DAYS} days)`, bad.join('; '));
  // (c) Process history: a game at other calibration values (every harness-mutable table: V3_CAL, ASI_EXTRA,
  //     set as the harnesses do, between games) hashes the same in this process, after every game
  //     above, as in a fresh process that set them first; and after the values are restored, as before.
  const h1 = stateHash(run(HIST_SETUP, HIST_DAYS));
  const restore = shiftCalibration();
  for (const w of ['tl-central', 'tl-fast'] as const) readSweep(run(defaultSetupV2({ seed: 9, world: w }), 20));
  const hHere = stateHash(run(HIST_SETUP, HIST_DAYS));
  restore();
  const h2 = stateHash(run(HIST_SETUP, HIST_DAYS));
  const child = spawnSync(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), '--history-child'], { encoding: 'utf8', cwd: ROOT });
  const hFresh = /HISTORY ([0-9a-f]+)/.exec(child.stdout ?? '')?.[1] ?? `child failed (status ${child.status}${child.error ? `, ${child.error.message}` : ''}): ${(child.stderr ?? '').slice(0, 200)}`;
  check(hHere === hFresh, `process history: a game at other calibration values hashes the same after earlier games in the process as in a fresh process (${HIST_DAYS} days)`, `${hHere} vs ${hFresh}`);
  check(h1 === h2, `process history: with the values restored the game hashes as before (${HIST_DAYS} days)`, `${h1} vs ${h2}`);
}

// ---------- 4. Stream isolation ----------
// Isolation means a stream's sequence depends only on its own draws. Every StreamRng draw is instrumented: the state it
// loads must equal the stream's seed advanced by exactly the mulberry32 steps its own earlier draws consumed (so no
// code writes, reseeds or cross-wires another stream's state), and the final state must match too. This is checked on
// a baseline run and with extra probe draws on consumed streams — whose consumers then legitimately change outcomes
// (and how many draws other systems make later), so comparing whole sequences across runs would be meaningless. A
// stream nothing consumes must also leave the rest of the state untouched. Ownership: each system draws only from its
// workstream's streams (V2-CONTRACT §5), except documented cross-workstream hooks (another owner's function drawing
// ITS OWN stream inside the caller's system).
const STREAM_OWNER: Record<StreamId, WorkstreamId> = {
  world: 'WS1', prod: 'WS1', runs: 'WS1', safety: 'WS2', incidents: 'WS2', market: 'WS3', finance: 'WS3',
  security: 'WS4', actors: 'WS4', rivals: 'WS4', china: 'WS4', events: 'WS4', endings: 'WS4', worldfx: 'WS5', company: 'WS1', labour: 'WS1',
};
/** [system id, stream, why] — a hook owned by the stream's workstream, called from another workstream's system. */
const CROSS_HOOKS: [string, StreamId, string][] = [
  ['director', 'safety', 'WS2 hooks in WS4 event choices'],
  ['runs', 'safety', 'WS2 applyBaseToLineage / applyRunToTraits (WS1 run completion)'],
  ['products', 'safety', 'WS2 observe (eval suites of the auto-evaluate policy, R6)'],
  ['research', 'safety', 'WS2 fireFinding when a research-line project completes (R8)'],
];
const logged = (opts?: Parameters<typeof tick>[1]) => {
  log = { expected: {}, broken: new Set(), draws: {}, bySystem: new Map() };
  const s = run(detSetup, 400, opts);
  const out = log;
  log = undefined;
  for (const k of STREAMS) if (out.expected[k] !== undefined && s.rng[k] !== out.expected[k]) out.broken.add(`${k} (final state)`);
  return { s, log: out };
};
const probe = (stream: StreamId): EngineSystem => ({ id: `probe-${stream}`, owner: 'WS1', cadence: 'daily', order: 999, system: 'core', run: (_s, ctx) => void ctx.rng(stream).float() });
const base = logged();
const consumed = STREAMS.filter((k) => (base.log.draws[k] ?? 0) > 0);
console.log(`      draws in 400 days: ${STREAMS.map((k) => `${k} ${base.log.draws[k] ?? 0}`).join(', ')}`);
check(base.log.broken.size === 0, 'stream isolation: every stream advances only through its own draws (baseline)', [...base.log.broken].join('; '));
for (const target of ['safety', 'market', 'events', 'rivals', 'worldfx'] as StreamId[]) {
  const c = logged({ extraSystems: [probe(target)] });
  const tag = consumed.includes(target) ? 'consumed' : 'unconsumed';
  check(c.log.broken.size === 0 && c.s.rng[target] !== base.s.rng[target], `stream isolation: with extra '${target}' draws (${tag}) every stream still advances only through its own draws`, [...c.log.broken].join('; '));
  if (consumed.includes(target)) continue;
  const strip = (s: GameStateV2) => stateHash({ ...s, rng: { ...s.rng, [target]: 0 } });
  check(strip(c.s) === strip(base.s), `stream isolation: rest of state identical with extra '${target}' draws (unconsumed stream)`);
}
{
  const owner = new Map(SYSTEMS.map((x) => [x.id, x.owner]));
  const violations: string[] = [];
  for (const [sys, streams] of base.log.bySystem) {
    const o = owner.get(sys);
    if (!o) continue; // outside a tick (newGame)
    for (const k of streams) if (STREAM_OWNER[k] !== o && !CROSS_HOOKS.some(([id, st]) => id === sys && st === k)) violations.push(`${sys} (${o}) draws '${k}' (${STREAM_OWNER[k]})`);
  }
  check(violations.length === 0, 'stream ownership: systems draw only from their own streams (or documented cross-WS hooks)', violations.join('; '));
}

// ---------- 5. Save round trip + size ----------
const json = serialize(a);
const back = deserialize(json);
check(stateHash(back) === stateHash(a), 'save: round-trip equality');
runTo(back, N + 60);
runTo(a, N + 60);
check(stateHash(back) === stateHash(a), 'save: loaded game continues identically (60 more days)');
check(json.length < SAVE_BUDGET_BYTES, `save: size at day ${N} < 1.5 MB`, `${(json.length / 1024).toFixed(0)} KB`);
let threw = false;
try {
  deserialize(JSON.stringify({ version: 1 }));
} catch {
  threw = true;
}
check(threw, 'save: v1 save is rejected (no migration)');
// UB-3 (DD-20): the save break. MIN_SCHEMA_REV ≤ SCHEMA_REV (MK-1 added 103 → 104, MK-3 104 → 105 on top of the break): every older save (any rev below, and a save with no
// schemaRev) is refused with the player-facing message, a newer one with its own message, and the current rev loads.
{
  const bad: string[] = [];
  const revs: (number | undefined)[] = [undefined, 0, 33, 102, MIN_SCHEMA_REV - 1];
  const base = serialize(run(detSetup, 30));
  for (const rev of revs) {
    const old = JSON.parse(base) as Record<string, unknown>;
    if (rev === undefined) delete old.schemaRev;
    else old.schemaRev = rev;
    let msg = '';
    try {
      deserialize(JSON.stringify(old));
    } catch (e) {
      msg = (e as Error).message;
    }
    if (msg !== OLD_SAVE_MESSAGE) bad.push(`${rev ?? 'none'}: ${msg || 'loaded'}`);
  }
  check(MIN_SCHEMA_REV <= SCHEMA_REV && bad.length === 0, `save: a save below schemaRev ${MIN_SCHEMA_REV} is refused ("${OLD_SAVE_MESSAGE}")`, bad.slice(0, 3).join('; '));
  let newer = '';
  try {
    deserialize(JSON.stringify({ ...(JSON.parse(base) as Record<string, unknown>), schemaRev: SCHEMA_REV + 1 }));
  } catch (e) {
    newer = (e as Error).message;
  }
  check(newer.includes('newer'), 'save: a save from a newer build is refused', newer || 'loaded');
}

// ---------- 6. Cadences ----------
const counts: Record<Cadence, number> = { daily: 0, weekly: 0, monthly: 0, quarterly: 0, semiannual: 0 };
const expected: Record<Cadence, number> = { daily: 0, weekly: 0, monthly: 0, quarterly: 0, semiannual: 0 };
const counters: EngineSystem[] = (Object.keys(counts) as Cadence[]).map((c, i) => ({ id: `count-${c}`, owner: 'WS1', cadence: c, order: 990 + i, system: 'core', run: () => void counts[c]++ }));
const cs = newGame(defaultSetupV2({ seed: 7 }));
for (let d = 1; d <= 730; d++) for (const c of cadencesDue(cs.time.startDate, d)) expected[c]++;
runTo(cs, 730, { extraSystems: counters, skip: ['endings'] }); // an idle player may be ousted; cadences only
check(JSON.stringify(counts) === JSON.stringify(expected) && counts.quarterly === 8 && counts.semiannual === 4 && counts.monthly === 24, 'cadences over 2 years', JSON.stringify(counts));

// ---------- 7. Cause ledger ----------
const ls = newGame(defaultSetupV2({ seed: 8 }));
const ctx = makeCtx(ls);
const before = ls.player.morale.overall;
const applied = ctx.bump('morale', 500, 'test', 'clamp');
check(ls.player.morale.overall === 100 && Math.abs(applied - (100 - before)) < 1e-9, 'causes: bump applies and clamps', `applied ${applied}`);
ctx.bump('player.morale.overall', -5, 'test');
ctx.bump('cash', 2, 'test');
ctx.cause('player.finance.cash', 1, 'other');
const strip = causeStrip(ls, 'cash');
check(strip.length === 2 && strip[0].source === 'test' && ls.causes.byKey.morale?.length === 1 && !ls.causes.byKey['player.morale.overall'], 'causes: ledger keys canonical and strip sorted');
let bad = false;
try {
  ctx.bump('pub.nope', 1, 'test');
} catch {
  bad = true;
}
check(bad, 'causes: unknown meter path throws');
} // sections 1–7

if (!NO_PERF) { // section 8

// ---------- 8. Performance (§7.5: daily ≤ 1.5 ms avg, quarter tick ≤ 8 ms) ----------
/** Mean daily tick (ms), worst quarterly tick (ms) and the ending (if any) over N days. */
function perfRun(setup: SetupV2, opts?: Parameters<typeof tick>[1]): { daily: number; worstQ: number; ended?: string } {
  const ps = newGame(setup);
  let daily = 0;
  let nDaily = 0;
  let worstQ = 0;
  for (let d = 0; d < N; d++) {
    const q = cadencesDue(ps.time.startDate, ps.time.day + 1).includes('quarterly');
    const t0 = performance.now();
    tick(ps, opts);
    const dt = performance.now() - t0;
    if (q) worstQ = Math.max(worstQ, dt);
    else {
      daily += dt;
      nDaily++;
    }
  }
  return { daily: daily / nDaily, worstQ, ended: ps.ending ? `${ps.ending.id} day ${ps.time.day}` : undefined };
}
const perfOff = perfRun(defaultSetupV2({ seed: 9 }));
check(perfOff.daily <= 1.5, 'performance: daily tick average', `${(perfOff.daily * 1000).toFixed(0)} µs`);
check(perfOff.worstQ <= 8, 'performance: worst quarter tick', `${perfOff.worstQ.toFixed(2)} ms`);
} // section 8

finish('hygiene');
