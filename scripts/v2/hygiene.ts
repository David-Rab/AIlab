// Engine hygiene (V2-SPEC §7.5). Owner: WS1.
// Guards the engine contract the other tests stand on: registry invariants, newGame validity for every setup and start,
// determinism, readouts are pure (selectors do not write the state, draw or leave caches), a game does not depend on
// process history, stream isolation and ownership, save round trip / size / refusal of old saves, cadences, the cause
// ledger, and (section 8, its own tier) the daily-tick performance budget.
//   npx tsx scripts/v2/hygiene.ts [--no-perf | --perf-only] [--deep]
// `--no-perf` skips section 8 (wall time, meaningless on a loaded machine); `--perf-only` runs only section 8 (test:perf).
// `--deep` (full tier) widens the purity sweeps (all three fixtures, a second lockstep game) and the stream-isolation run.
// Cost of sections 1-7: no long games, no cache: quick ~30 CPU-s, with --deep ~75 CPU-s (the readout sweep, ~7 CPU-s per
// full-state sweep, is the bulk). Tiers: quick (--no-perf), full (--no-perf --deep), perf (--perf-only).
import { AGENDA_IDS } from '../../src/data/v2/agendas';
import { TRAIT_IDS } from '../../src/data/v2/traits';
import { causeStrip } from '../../src/engine/v2/core/causes';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx, resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID, SYSTEMS, validateRegistry } from '../../src/engine/v2/core/registry';
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
import { FIXTURE_DIR, check, finish, runTo, validateJson } from './lib';
import { ROOT } from './simcache';
import { spawnSync } from 'node:child_process';
import { deepFreeze, readSweep, sweptFunctions } from './readsweep';

const N = 25; // days of the determinism / save-continuation runs (the check is about equality, not a horizon)
const DEEP = process.argv.includes('--deep');
const PERF_DAYS = 1500; // section 8: the tick budgets are per day over a long game
const PERF_ONLY = process.argv.includes('--perf-only');
const NO_PERF = process.argv.includes('--no-perf');

// Section 3b (b): lockstep read purity on a fixture (day400, RefBot acting) for READ_DAYS days, a full sweep every READ_EVERY.
const READ_DAYS = DEEP ? 14 : 8; // quick: one sweep (day 406) and two days after it; deep: two sweeps
const READ_EVERY = 7;
const loadFixture = (name: string): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, `${name}.json`), 'utf8'));
/** RefBot plays one day (worldfx's refDay: decide pending events, act, tick with endings skipped). */
function refDay(s: GameStateV2) {
  for (const p of [...s.events.pending]) {
    const c = refBot.decide(s, p);
    if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
  }
  refBot.act(s, engine);
  tick(s, { skip: ['endings'] });
}
/** The fixture game twice in lockstep, the second read with readSweep every READ_EVERY days: the first day the two
 *  state hashes differ (null: never). */
function readPurity(fixture: string): { firstDiff: number | null; calls: number } {
  // a sweep on each calendar-week day (day % 7 == 0) of the days played
  const plain = loadFixture(fixture);
  const read = loadFixture(fixture);
  let calls = 0;
  for (let i = 0; i < READ_DAYS; i++) {
    refDay(plain);
    refDay(read);
    if (read.time.day % READ_EVERY === 0) calls += readSweep(read, !DEEP).calls;
    if (stateHash(plain) !== stateHash(read)) return { firstDiff: plain.time.day, calls };
  }
  return { firstDiff: null, calls };
}
// Section 3b (c): the game played at shifted calibration values; `--history-child` plays it in a fresh process.
const HIST_SETUP = defaultSetupV2({ seed: 4, world: 'tl-central', alignment: 'medium', tutorial: false });
const HIST_DAYS = 20;
/** Shift every harness-mutable calibration table (as calscan.ts / calreport/milestones.ts do between games); returns the restore. */
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

// ---------- 1. Registry invariants ----------
// (The id/order/sort rules are validateRegistry's, run at load; here they are checked to refuse bad lists, and the
// shipped table is checked for shape, not pinned system by system.)
{
  const WS = ['WS1', 'WS2', 'WS3', 'WS4', 'WS5', 'WS6', 'WS7'];
  const CAD: Cadence[] = ['daily', 'weekly', 'monthly', 'quarterly', 'semiannual'];
  const badSys = SYSTEMS.filter((x) => !WS.includes(x.owner) || !CAD.includes(x.cadence) || !x.id || !Number.isFinite(x.order) || typeof x.run !== 'function');
  check(badSys.length === 0, 'registry: every system has an id, a known owner and cadence, an order and a run', badSys.map((x) => x.id).join(', '));
  check(SYSTEMS.some((x) => x.cadence === 'daily') && SYSTEMS.some((x) => x.cadence === 'quarterly'), 'registry: daily and quarterly systems exist');
  const throws = (f: () => void) => { try { f(); return false; } catch { return true; } };
  const sys = (id: string, order: number): EngineSystem => ({ id, owner: 'WS1', cadence: 'daily', order, system: 'core', run: () => undefined });
  check(!throws(() => validateRegistry(SYSTEMS)) && !throws(() => validateRegistry([sys('a', 1), sys('b', 2)])), 'registry: the shipped list and a sorted list validate');
  check(throws(() => validateRegistry([sys('a', 1), sys('a', 2)])), 'registry: a duplicate system id is refused');
  check(throws(() => validateRegistry([sys('a', 1), sys('b', 1)])), 'registry: a duplicate order is refused');
  check(throws(() => validateRegistry([sys('a', 2), sys('b', 1)])), 'registry: an unsorted list is refused');
}

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
// Two runs of the same setup hash the same, and a different seed does not (60 days: the check is equality, not a horizon).
const run = (setup: SetupV2, days = N, opts?: Parameters<typeof tick>[1]) => runTo(newGame(setup), days, opts);
const detSetup = defaultSetupV2({ seed: 42, world: 'tl-central', alignment: 'sampled' });
const a = run(detSetup);
const b = run(detSetup);
check(stateHash(a) === stateHash(b), `determinism: same seed → same hash after ${N} ticks`, stateHash(a));
check(stateHash(run({ ...detSetup, seed: 43 }, 5)) !== stateHash(run(detSetup, 5)), 'determinism: different seed → different hash');

// ---------- 3b. Readouts are pure; a game does not depend on the process's history (model v3 G1) ----------
// A selector may not write the state, draw from a stream or leave a cache a later tick reads differently; and a game is
// a function of its setup and the code, not of what ran before it in the process (F4 saw seeds 2, 4 and 11 move when
// the same classic game was read with extra readouts: the cause was a process-wide memo of the ai2027 reference path,
// built once from V3_CAL, which the calibration harness had changed between games; safety/oversight.ts refPathEntry).
{
  // (a) Every UI-facing selector on a deep-frozen state: none writes (a write to a frozen object throws in ES modules).
  const writers: string[] = [];
  let calls = 0;
  for (const f of DEEP ? ['day0', 'day400', 'day900'] : ['day900']) {
    const s = deepFreeze(deserialize(readFileSync(join(FIXTURE_DIR, `${f}.json`), 'utf8')));
    const r = readSweep(s, !DEEP);
    calls += r.calls;
    writers.push(...r.fails.map((x) => `${f}: ${x}`));
  }
  check(writers.length === 0, `readouts: no selector writes the state (${sweptFunctions().length} engine exports and worldfx readouts, ${calls} calls on deep-frozen fixtures: ${DEEP ? 'day 0 / 400 / 900' : 'day 900'})`, writers.slice(0, 4).join('; '));
  // (b) A fixture game (day 400, RefBot acting) in lockstep, one plain and one with the full sweep every READ_EVERY
  //     days: the state hash is identical every day.
  for (const fx of DEEP ? ['day400', 'day900'] : ['day400']) {
    const r = readPurity(fx);
    check(r.firstDiff === null && r.calls > 0, `readouts: the ${fx} fixture played ${READ_DAYS} days and read with every selector every ${READ_EVERY} days keeps the same state hash every day as unread`, r.firstDiff === null ? `${r.calls} calls` : `first differs on day ${r.firstDiff}`);
  }
  // (c) Process history: a game at other calibration values (every harness-mutable table: V3_CAL, ASI_EXTRA,
  //     set as the harnesses do, between games) hashes the same in this process, after every game
  //     above, as in a fresh process that set them first; and after the values are restored, as before.
  const h1 = stateHash(run(HIST_SETUP, HIST_DAYS));
  const restore = shiftCalibration();
  for (const w of ['tl-central', 'tl-fast'] as const) run(defaultSetupV2({ seed: 9, world: w }), 10);
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
// ISO_DAYS from the day-400 fixture (a lab with runs, products, rivals and a market: every system draws), not 400 from day 0.
const ISO_DAYS = DEEP ? 60 : 20;
const logged = (opts?: Parameters<typeof tick>[1]) => {
  log = { expected: {}, broken: new Set(), draws: {}, bySystem: new Map() };
  const s = runTo(loadFixture('day400'), 400 + ISO_DAYS, opts);
  const out = log;
  log = undefined;
  for (const k of STREAMS) if (out.expected[k] !== undefined && s.rng[k] !== out.expected[k]) out.broken.add(`${k} (final state)`);
  return { s, log: out };
};
const probe = (stream: StreamId): EngineSystem => ({ id: `probe-${stream}`, owner: 'WS1', cadence: 'daily', order: 999, system: 'core', run: (_s, ctx) => void ctx.rng(stream).float() });
const base = logged();
const consumed = STREAMS.filter((k) => (base.log.draws[k] ?? 0) > 0);
console.log(`      draws in ${ISO_DAYS} days from the day-400 fixture: ${STREAMS.map((k) => `${k} ${base.log.draws[k] ?? 0}`).join(', ')}`);
check(base.log.broken.size === 0, 'stream isolation: every stream advances only through its own draws (baseline)', [...base.log.broken].join('; '));
for (const target of (DEEP ? ['safety', 'market', 'events', 'rivals', 'worldfx'] : ['safety', 'market', 'rivals', 'worldfx']) as StreamId[]) {
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
runTo(back, N + 30);
runTo(a, N + 30);
check(stateHash(back) === stateHash(a), 'save: loaded game continues identically (30 more days)');
// Size on the largest committed fixture (day 900) and on a fresh game; the fixtures are serialized states.
for (const fx of ['day0', 'day900']) {
  const raw = readFileSync(join(FIXTURE_DIR, `${fx}.json`), 'utf8');
  const fs = deserialize(raw);
  const again = serialize(fs);
  check(stateHash(deserialize(again)) === stateHash(fs), `save: ${fx} fixture round-trip equality`);
  check(again.length < SAVE_BUDGET_BYTES, `save: size of the ${fx} fixture < ${(SAVE_BUDGET_BYTES / 1048576).toFixed(1)} MB`, `${(again.length / 1024).toFixed(0)} KB`);
}
check(serialize(newGame(detSetup)).length < SAVE_BUDGET_BYTES, 'save: size of a fresh game < budget');
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
// Pure calendar arithmetic over two years (no ticks), then the ticks over 190 days (> 2 quarters) match it.
const two: Record<Cadence, number> = { daily: 0, weekly: 0, monthly: 0, quarterly: 0, semiannual: 0 };
for (let d = 1; d <= 730; d++) for (const c of cadencesDue(cs.time.startDate, d)) two[c]++;
check(two.quarterly === 8 && two.semiannual === 4 && two.monthly === 24 && two.daily === 730, 'cadences over 2 years (calendar)', JSON.stringify(two));
const TICKS = 100; // > 1 quarter
for (let d = 1; d <= TICKS; d++) for (const c of cadencesDue(cs.time.startDate, d)) expected[c]++;
runTo(cs, TICKS, { extraSystems: counters, skip: ['endings'] }); // an idle player may be ousted; cadences only
check(JSON.stringify(counts) === JSON.stringify(expected) && counts.daily === TICKS && counts.quarterly >= 1 && counts.monthly >= 3, `cadences: systems run on the calendar over ${TICKS} ticks`, JSON.stringify(counts));

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
check(strip.length === 2 && strip[0].source === 'test' && ls.causes.byKey.morale?.length === 2 && !ls.causes.byKey['player.morale.overall'], 'causes: ledger keys canonical and strip sorted');
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
  for (let d = 0; d < PERF_DAYS; d++) {
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
