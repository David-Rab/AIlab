// Engine hygiene (V2-SPEC §7.5). Owner: WS1.
// Registry contract, newGame validity, determinism, stream isolation, save round trip and size, cadences,
// cause ledger, performance. `--no-perf` skips the performance section (8; wall-time budgets, meaningless on a loaded
// machine: test:full runs hygiene with --no-perf); `--perf-only` runs only section 8 (test:perf, on a quiet machine).
import { AGENDA_IDS } from '../../src/data/v2/agendas';
import { TRAIT_IDS } from '../../src/data/v2/traits';
import { causeStrip } from '../../src/engine/v2/core/causes';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx, resolve, tick } from '../../src/engine/v2/core/loop';
import { launchRun } from '../../src/engine/v2/models/runs';
import { EVENT_BY_ID, SYSTEMS } from '../../src/engine/v2/core/registry';
import { STREAMS, StreamRng } from '../../src/engine/v2/core/rng';
import { MIN_SCHEMA_REV, OLD_SAVE_MESSAGE, SAVE_BUDGET_BYTES, SCHEMA_REV, deserialize, serialize, stateHash } from '../../src/engine/v2/core/save';
import { cadencesDue, decimalYear } from '../../src/engine/v2/core/time';
import { LEADER_LAB_NAME } from '../../src/data/v2/names';
import { postureOf } from '../../src/engine/v2/actors/rivals';
import { gV0 } from '../../src/engine/v2/models/capability';
import { postG, recipeOf } from '../../src/engine/v2/actors/rivalModel';
import { stacksGEquiv } from '../../src/engine/v2/models/stacks';
import { PRE_GAME_G_PER_YEAR, REFERENCE_BASE, REFERENCE_POST } from '../../src/data/v2/runDesign';
import { LEADER_CAL } from '../../src/data/v2/calibration';
import { START_BY_ID } from '../../src/data/v2/starts';
import { ownedOnline, rentedOnline } from '../../src/engine/v2/compute/power';
import { nodeKnown } from '../../src/engine/v2/models/tree';
import { LEADER_ID } from '../../src/engine/v2/models/labs';
import { hRef, refTotal } from '../../src/engine/v2/production/ces';
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
    const mk = () => newGame(defaultSetupV2({ seed, world: 'ai2027', alignment: 'medium', baseline: 'classic', tutorial: false, econ: 'ai2027' }));
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
const HIST_SETUP = defaultSetupV2({ seed: 4, world: 'ai2027', alignment: 'medium', baseline: 'classic', tutorial: false, econ: 'ai2027' });
const HIST_DAYS = 30;
/** Shift every harness-mutable calibration table (as calscan.ts / calib.ts do between games); returns the restore. */
function shiftCalibration(): () => void {
  const saved = { v3: JSON.stringify(V3_CAL), asi: ASI_EXTRA.gaps, lc: JSON.stringify(LEADER_CAL) };
  for (const c of Object.values(V3_CAL)) Object.assign(c, { gSC: c.gSC - 0.4, dBM: c.dBM + 0.3, sdSC: c.sdSC + 0.5 });
  ASI_EXTRA.gaps += 0.2;
  for (const k of Object.keys(LEADER_CAL) as (keyof typeof LEADER_CAL)[]) LEADER_CAL[k] += 0.1;
  return () => {
    for (const [k, c] of Object.entries(JSON.parse(saved.v3) as typeof V3_CAL)) Object.assign(V3_CAL[k as keyof typeof V3_CAL], c);
    ASI_EXTRA.gaps = saved.asi;
    Object.assign(LEADER_CAL, JSON.parse(saved.lc));
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
  ['worldDaily', 'WS5', 'daily', 110], ['actorsDaily', 'WS4', 'daily', 120], ['opex', 'WS3', 'daily', 130],
  ['director', 'WS4', 'daily', 140], ['endings', 'WS4', 'daily', 150], ['products', 'WS1', 'daily', 155], ['record', 'WS1', 'weekly', 160],
  ['hiring', 'WS1', 'weekly', 200], ['intel', 'WS4', 'weekly', 210], ['payroll', 'WS3', 'monthly', 300],
  ['macro', 'WS5', 'monthly', 310], ['computeHistQ', 'WS3', 'quarterly', 399], ['marketQ', 'WS3', 'quarterly', 400], ['sitesQ', 'WS3', 'quarterly', 410],
  ['capitalQ', 'WS3', 'quarterly', 420], ['boardQ', 'WS3', 'quarterly', 430], ['geoQ', 'WS4', 'quarterly', 440],
  ['index', 'WS4', 'semiannual', 500],
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
  defaultSetupV2({ seed: 2, world: 'sampled', alignment: 'sampled', econ: 'sampled' }),
  defaultSetupV2({ seed: 3, world: 'authors2026', baseline: 'reality', rivalCount: 3, governance: 'founder', alignment: 'hard' }),
  defaultSetupV2({ seed: 4, world: 'slow', alignment: 'easy', rivals: 'maverick', gov: 'hawk', china: 'gambler' }),
  defaultSetupV2({ seed: 5, world: 'fast', governance: 'nonprofitPBC', tutorial: false }),
  defaultSetupV2({ seed: 6, leaderLab: true }), // R2: the simulated leader lab
  defaultSetupV2({ seed: 7, world: 'authors2026', rivalCount: 3, rivals: 'maverick', leaderLab: true }),
  // R9: every start type (the leader lab follows the start, D1).
  defaultSetupV2({ seed: 12, start: 'challenger' }),
  defaultSetupV2({ seed: 13, start: 'bigtech', world: 'sampled', alignment: 'sampled', econ: 'sampled' }),
  defaultSetupV2({ seed: 14, start: 'spinout', baseline: 'reality', rivalCount: 3 }),
];
/** R2 leader lab: appended last with the fixed id at reference inputs; the 'world' draws and everything sampled from
 *  them (hidden world, sampled rivals, China, the player) are the same as with the flag off. */
function leaderChecks(s: GameStateV2, setup: SetupV2, tag: string) {
  const L = s.rivals[s.rivals.length - 1];
  const yr = decimalYear(s);
  check(L?.core.id === LEADER_ID && L.archetype === 'leader' && L.core.name === LEADER_LAB_NAME, `${tag}: leader lab appended last (${LEADER_ID})`);
  if (!L) return;
  const v0G = gV0(s.hidden.timeline); // the reference start model (= the leader start's V0)
  // Model v3 F1: the start recipe is solved so the leader's start version on its start base is V0 (rivalModel.ts), and
  // it is the leader's day-0 recipe (e ≈ 0: B0's dates make its recipe stale by B0's age; today's is the zero of e).
  const e0 = recipeOf(s, L);
  const g0 = L.internal.G;
  check(Math.abs(g0 - v0G) < 1e-9 && Math.abs(e0) < 0.05 && postG(L.phys.base, L.phys.rec) >= g0,
    `${tag}: leader start model = the reference V0, on its start base at the leader's day-0 recipe`, `G ${g0} vs ${v0G}; e ${e0.toFixed(4)}`);
  check(Math.abs(L.phys.eff - Math.pow(10, LEADER_CAL[setup.world] ?? 0)) < 1e-12, `${tag}: leader research efficiency = 10^LEADER_CAL`, String(L.phys.eff));
  check(Math.abs(L.core.computeOnline / refTotal(s.hidden.timeline, yr) - 1) < 1e-9 && Math.abs(L.core.staff.cap / hRef(yr) - 1) < 1e-9 && L.core.tasteHire === 1, `${tag}: leader compute = refTotal, staff = hRef`);
  check(postureOf(s, L.core.id).bindingness <= 0.3, `${tag}: leader bindingness ≤ 0.3`, postureOf(s, L.core.id).bindingness.toFixed(2));
  const off = newGame({ ...setup, leaderLab: false });
  const strip = (x: GameStateV2) => {
    const h = { ...x.hidden, actorPresets: { ...x.hidden.actorPresets, rivals: { ...x.hidden.actorPresets.rivals } }, rivalPostures: { ...x.hidden.rivalPostures } };
    delete h.actorPresets.rivals[LEADER_ID];
    delete h.rivalPostures[LEADER_ID];
    // FIN5b: a private rival's start valuation is its share of the story split, which the leader lab (a private lab)
    // is part of, so the marked valuation, share and pool part are left out; everything drawn or set up is compared.
    const rivals = x.rivals.filter((r) => r.core.id !== LEADER_ID).map((r) => ({ ...r, finance: { ...r.finance, valuation: 0, mark: 0, poolQ: 0 } }));
    return JSON.stringify([h, x.rng.world, rivals, x.china, stacksGEquiv(x), x.player.models]);
  };
  check(strip(s) === strip(off), `${tag}: 'world' draws, rivals, China and the player unchanged by the leader lab`);
}

for (const setup of setups) {
  const s = newGame(setup);
  const errs = validateJson(s);
  const tag = `newGame ${setup.start}/${setup.world}/${setup.baseline}/${setup.alignment}${setup.leaderLab ? '/leaderLab' : ''}`;
  const nRivals = setup.rivalCount + (setup.leaderLab ? 1 : 0);
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
    // R9 start data: leader lab on (D1), teams, owned/rented compute, known nodes, products and features, board, lag.
    const ref = gV0(s.hidden.timeline);
    const nTeams = Object.values(def.teams).reduce((a, b) => a + b, 0);
    check(s.setup.leaderLab && s.rivals.some((r) => r.core.id === LEADER_ID), `${tag}: leader lab in the world (D1)`);
    check(s.player.teams.length === nTeams && Math.abs(ownedOnline(s) - def.owned) < 1 && Math.abs(rentedOnline(s) - def.rented) < 1, `${tag}: teams and compute owned / rented`, `${s.player.teams.length} teams, ${ownedOnline(s)} / ${rentedOnline(s)}`);
    check(def.known.every((id) => nodeKnown(s, id)) && def.features.every((f) => s.player.features.includes(f)), `${tag}: known nodes and built features`);
    const prods = s.player.deployments.filter((d) => d.channel !== 'internal').map((d) => d.channel).join(',');
    check(prods === def.products.map((x) => x.channel).join(',') && s.player.board.preset === def.board && s.setup.governance === def.board, `${tag}: products and board`, `${prods} · ${s.player.board.preset}`);
    const v = s.player.models.versions[0];
    check(v.G < ref && (def.imported ? v.variant === 'imported' && s.player.models.runs.length === 0 : v.variant === 'full'), `${tag}: start model lags the reference (${def.lagMonths} mo)${def.imported ? ', imported (D6)' : ''}`, `G ${v.G.toFixed(3)} < ${ref.toFixed(3)}`);
  }
  const leads = s.rivals.map((r) => Math.round(((gV0(s.hidden.timeline) - r.internal.G) / (1.25 * PRE_GAME_G_PER_YEAR)) * 12 * 10) / 10);
  // v1 archetype gap ranges (≤ 1.1 y); the tighter 3–9 month target is WS4's acceptance test T4.
  check(leads.every((m) => m >= 0 && m <= 13.5), `${tag}: rival gaps within v1 ranges (months)`, leads.join(', '));
  if (setup.leaderLab) leaderChecks(s, setup, tag);
  check(Object.keys(s.relations.stocks).length === 7 + nRivals + 15, `${tag}: relation counterparties`);
  tick(s);
  check(s.time.day === 1, `${tag}: first tick advances to day 1`);
}

// ---------- 3. Determinism ----------
const run = (setup: SetupV2, days = N, opts?: Parameters<typeof tick>[1]) => runTo(newGame(setup), days, opts);
const detSetup = defaultSetupV2({ seed: 42, world: 'sampled', alignment: 'sampled', econ: 'sampled' });
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
  //     LEADER_CAL, set as the harnesses do, between games) hashes the same in this process, after every game
  //     above, as in a fresh process that set them first; and after the values are restored, as before.
  const h1 = stateHash(run(HIST_SETUP, HIST_DAYS));
  const restore = shiftCalibration();
  for (const w of ['ai2027', 'authors2026'] as const) readSweep(run(defaultSetupV2({ seed: 9, world: w, leaderLab: true }), 20));
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
  security: 'WS4', actors: 'WS4', rivals: 'WS4', china: 'WS4', events: 'WS4', endings: 'WS4', worldfx: 'WS5', company: 'WS1',
};
/** [system id, stream, why] — a hook owned by the stream's workstream, called from another workstream's system. */
const CROSS_HOOKS: [string, StreamId, string][] = [
  ['actorsDaily', 'safety', 'WS2 observeExternal (evaluator reports, WS4)'],
  ['intel', 'safety', 'WS2 observeExternal (evaluator reports, WS4)'],
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
// RD-C03 (DD-20): the save floor is MIN_SCHEMA_REV (33). Every older save (v2 and model v3 V1–F2, revs 0–32, and a
// save with no schemaRev) is refused with the player-facing message; the oldest loading rev is 33 (tested below).
{
  const bad: string[] = [];
  const revs: (number | undefined)[] = [undefined, 0, 1, 11, 14, 15, 20, 27, MIN_SCHEMA_REV - 1];
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
  check(MIN_SCHEMA_REV === 33 && bad.length === 0, `save: a save below schemaRev ${MIN_SCHEMA_REV} is refused ("${OLD_SAVE_MESSAGE}")`, bad.slice(0, 3).join('; '));
}
// Merge FINM: finance v3's migrations 33 → 42 (built on finance-v3 as 11 → 20, renumbered after model v3's 33). A
// model-v3 save (rev 33) carries the old finance block: an SPV leaseback, an SPV deal, the JV and the one-quarter
// operating cash become a financing lease at 12%, nothing, nothing and a four-quarter history; the story fields and the
// rivals' marks are filled. The chain is idempotent (a current state labelled 33 loads unchanged), and every model-v3
// rev from MIN_SCHEMA_REV (33, the oldest save that loads) to 42 loads a current state up to SCHEMA_REV.
{
  const cur = run(detSetup, 60);
  const old = JSON.parse(serialize(cur)) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = 33;
  const f = old.player.finance as unknown as Record<string, unknown> & { ledger: Record<string, unknown>[]; deals: Record<string, unknown>[]; ws3: Record<string, unknown>; promises?: unknown; credibility?: unknown };
  f.ledger.push({ id: 'L-spv-S9', payee: 'Keystone Capital', kind: 'spvRVG', perQuarter: 0.2, endDay: 900, cancellableNoticeQ: null, penalty: 0 });
  f.deals.push({ id: 'D-old-spv', template: 'spv', partner: 'Keystone Capital', day: 10, strings: {} });
  f.ws3.jv = { partner: 'Meridian Group' };
  f.ws3.opCashQ = 1.5;
  delete f.ws3.opCash4q;
  delete f.promises;
  delete f.credibility;
  delete (f.ws3 as { mark?: unknown }).mark;
  for (const r of old.rivals) { const rf = r.finance as unknown as Record<string, unknown>; delete rf.mark; delete rf.poolQ; delete rf.raised; }
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  const lease = g?.player.finance.ledger.find((c) => c.id === 'L-fin-S9');
  const okFin = !!g && g.schemaRev === SCHEMA_REV && SCHEMA_REV === 97 && lease?.kind === 'finLease' && lease.rate === 0.12 && !g.player.finance.deals.some((d) => d.id === 'D-old-spv')
    && !('jv' in g.player.finance.ws3) && JSON.stringify(g.player.finance.ws3.opCash4q) === '[1.5]' && Array.isArray(g.player.finance.promises) && typeof g.player.finance.credibility === 'number'
    && (g.player.finance.valuation <= 0 || !!g.player.finance.ws3.mark) && g.rivals.every((r) => r.finance.poolQ !== undefined && r.finance.raised !== undefined);
  check(okFin, 'save: a schemaRev-33 save (model v3, old finance) migrates to 42 (SPV leaseback → financing lease, SPV deal and JV gone, operating cash history, promises, credibility, story marks)', msg || JSON.stringify({ lease: lease?.kind, rate: lease?.rate, opCash4q: g?.player.finance.ws3.opCash4q }));
  let same = false;
  try {
    const again = JSON.parse(serialize(cur)) as Record<string, unknown>;
    again.schemaRev = 33;
    same = stateHash(deserialize(JSON.stringify(again))) === stateHash(cur);
  } catch (e) {
    msg = (e as Error).message;
  }
  check(same, 'save: the finance migrations 33 → 42 leave an already-migrated state unchanged (idempotent)', msg);
  const bad: string[] = [];
  for (let rev = MIN_SCHEMA_REV; rev < SCHEMA_REV; rev++) {
    try {
      const o = JSON.parse(serialize(cur)) as Record<string, unknown>;
      o.schemaRev = rev;
      const m = deserialize(JSON.stringify(o));
      if (m.schemaRev !== SCHEMA_REV) bad.push(`${rev}: lands at ${m.schemaRev}`);
    } catch (e) {
      bad.push(`${rev}: ${(e as Error).message}`);
    }
  }
  check(bad.length === 0, `save: every save rev ${MIN_SCHEMA_REV}–${SCHEMA_REV - 1} migrates to ${SCHEMA_REV} (a current state under each label)`, bad.slice(0, 3).join('; '));
}
// SAFMECH (schemaRev 43): a rev-42 save has no monitoring budget; it gets the old standard package's 20% of the safety
// pool, and an already-migrated state labelled 42 loads unchanged (idempotent).
{
  const cur = run(detSetup, 30);
  const old = JSON.parse(serialize(cur)) as GameStateV2;
  old.schemaRev = 42;
  delete (old.player.policies as unknown as Record<string, unknown>).monitorBudget;
  let msg = '';
  let g: GameStateV2 | undefined;
  let same = false;
  try {
    g = deserialize(JSON.stringify(old));
    const again = JSON.parse(serialize(cur)) as GameStateV2;
    again.schemaRev = 42;
    same = stateHash(deserialize(JSON.stringify(again))) === stateHash(cur);
  } catch (e) {
    msg = (e as Error).message;
  }
  check(!!g && g.schemaRev === SCHEMA_REV && SCHEMA_REV === 97 && same,
    'save: a schemaRev-42 save migrates to 43 (monitoring budget = the old standard 20% of the safety pool; idempotent)', msg || `${g?.player.split.monitors}`);
}
// RD-C01 (schemaRev 44): a rev-43 save carries v2's knot table and the dead readout fields; the migration drops them, and
// the loaded state equals the current one.
{
  const cur = run(detSetup, 30);
  const old = JSON.parse(serialize(cur)) as GameStateV2;
  old.schemaRev = 43;
  (old.hidden.timeline.prod as unknown as Record<string, unknown>).knots = [{ p: 0, Mref: 1.25, A: 0.5, R: 2.6, Tref: 1, sdAI: -2 }];
  // RD-R01 removed ProductionReadout.parts and .elast (the readout is rebuilt from research.last): the dead fields are
  // planted only in the objects the current readout still has.
  const pc = old.player.prodCache as unknown as { Ddata?: number; parts?: Record<string, number>; elast?: Record<string, number>; ratios: Record<string, number> } | undefined;
  if (pc) {
    pc.Ddata = 1;
    if (pc.parts) pc.parts.base = 1;
    if (pc.elast) {
      pc.elast.train = 0;
      pc.elast.data = 0;
    }
    pc.ratios.d = 1;
  }
  let msg = '';
  let same = false;
  try {
    same = stateHash(deserialize(JSON.stringify(old))) === stateHash(cur);
  } catch (e) {
    msg = (e as Error).message;
  }
  check(!!pc && same, 'save: a schemaRev-43 save migrates to 44 (knot table and dead readout fields dropped; then equal to the current state)', msg);
}
// RD-B02 (schemaRev 45): a rev-44 save's runs in flight lack the new snapshot fields (a base's draw and P24 bonus, a
// post-train's domainG, P07 horizon and serving FLOP part); the migration fills them from the save's day, which equals a
// launch on that day, so the loaded state equals the current one. A finished run is left alone.
{
  const cur = run(detSetup, 30);
  cur.player.finance.cash += 1e3;
  const ctx = makeCtx(cur);
  const rb = launchRun(cur, ctx, { kind: 'base', base: { ...REFERENCE_BASE, curation: { ...REFERENCE_BASE.curation } }, poolShare: 0.5 });
  const rp = launchRun(cur, ctx, { kind: 'post', baseId: cur.player.models.bases[0].id, post: { ...REFERENCE_POST, methods: [] }, poolShare: 0.2 });
  const old = JSON.parse(serialize(cur)) as GameStateV2;
  old.schemaRev = 44;
  const strip = (id: string, keys: string[]) => {
    const rec = old.player.models.runs.find((r) => r.id === id)?.recipe as Record<string, unknown> | undefined;
    for (const k of keys) delete rec?.[k];
    return !!rec;
  };
  const okStrip = typeof rb !== 'string' && typeof rp !== 'string' && strip(rb.id, ['draw', 'p24']) && strip(rp.id, ['domainG', 'p07', 'serveOom']);
  let msg = typeof rb === 'string' ? rb : typeof rp === 'string' ? rp : '';
  let same = false;
  try {
    same = stateHash(deserialize(JSON.stringify(old))) === stateHash(cur);
  } catch (e) {
    msg = (e as Error).message;
  }
  check(okStrip && same, 'save: a schemaRev-44 save migrates to 47 (44 → 45: runs in flight get the launch snapshot from the save\'s day; 45 → 46 keeps the packs; then equal to the current state)', msg);
}

// RD-B12 (schemaRev 46): a rev-45 save keeps sector packs as the product's sectorFocus plus the world's certDay; the
// migration puts each pack (with its certification day) on its product, drops a certified sector no product carries
// (the lost pack of B18) and removes world.fx.certDay. A rev-44 save runs 44 → 45 first, then the same move.
for (const rev of [45, 44]) {
  const cur = run(detSetup, 30);
  const old = JSON.parse(serialize(cur)) as GameStateV2;
  old.schemaRev = rev;
  const ent = old.player.deployments.find((d) => d.channel === 'enterprise')!;
  for (const d of old.player.deployments) {
    delete (d as Partial<GameStateV2['player']['deployments'][number]>).adaptations;
    (d as unknown as { sectorFocus: string[] }).sectorFocus = d === ent ? ['LEGAL'] : [];
  }
  (old.world.fx as unknown as { certDay: Record<string, number> }).certDay = { LEGAL: 77, FIN: 12 };
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  const ge = g?.player.deployments.find((d) => d.id === ent.id);
  // RD-P08 (70): the pack then becomes an adaptation on the same product (Legal needs no certification).
  const ok = !!g && JSON.stringify(ge?.adaptations) === JSON.stringify([{ sector: 'LEGAL' }])
    && g.player.deployments.every((d) => Array.isArray(d.adaptations) && !('packs' in d) && !('sectorFocus' in d) && (d.id === ent.id || d.adaptations.length === 0)) && !('certDay' in g.world.fx);
  check(ok, `save: a schemaRev-${rev} save migrates to 47 (sector packs on their product with the certification day; an unhosted certified sector dropped; world certDay gone)`, msg || JSON.stringify(ge?.adaptations));
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
const before = ls.pub.approval;
const applied = ctx.bump('pub.approval', 500, 'test', 'clamp');
check(ls.pub.approval === 100 && Math.abs(applied - (100 - before)) < 1e-9, 'causes: bump applies and clamps', `applied ${applied}`);
ctx.bump('trust:exec', -5, 'test');
ctx.bump('cash', 2, 'test');
ctx.cause('player.finance.cash', 1, 'other');
const strip = causeStrip(ls, 'cash');
check(strip.length === 2 && strip[0].source === 'test' && ls.causes.byKey['trust:exec']?.length === 1, 'causes: ledger keys canonical and strip sorted');
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
// R2: the same game with the leader lab (one more simulated lab), endings skipped (the passive player is overtaken
// by the leader, and an ended game ticks for free). Absolute budget as above. The lab's own cost is measured on one
// day-200 state ticked 300 days with and without the leader (paired, alternated, so machine load and the diverging
// world cancel out); BUILD-PLAN §3 asks for ~10%.
const perfOn = perfRun(defaultSetupV2({ seed: 9, leaderLab: true }), { skip: ['endings'] });
check(perfOn.daily <= 1.5, 'performance (leader lab): daily tick average', `${(perfOn.daily * 1000).toFixed(0)} µs`);
check(perfOn.worstQ <= 8, 'performance (leader lab): worst quarter tick', `${perfOn.worstQ.toFixed(2)} ms`);
{
  const s0 = newGame(defaultSetupV2({ seed: 9, leaderLab: true }));
  for (let d = 0; d < 200; d++) tick(s0, { skip: ['endings'] });
  const snap = JSON.stringify(s0);
  const ratios: number[] = [];
  const us = { with: 0, without: 0 };
  for (let r = 0; r < 4; r++) {
    const t: number[] = [];
    for (const drop of [false, true]) {
      const s = JSON.parse(snap) as GameStateV2;
      if (drop) s.rivals = s.rivals.filter((x) => x.core.id !== LEADER_ID);
      const t0 = performance.now();
      for (let d = 0; d < 300; d++) tick(s, { skip: ['endings'] });
      t.push((performance.now() - t0) / 300);
    }
    if (r === 0) continue; // warm-up pair
    ratios.push(t[0] / t[1]);
    us.with += (t[0] * 1000) / 3;
    us.without += (t[1] * 1000) / 3;
  }
  const med = [...ratios].sort((a, b) => a - b)[1];
  check(med <= 1.2, 'performance (leader lab): its own cost ≤ +20% of a tick (target ~10%)', `+${(100 * (med - 1)).toFixed(1)}% (paired median; ${us.with.toFixed(0)} vs ${us.without.toFixed(0)} µs/day)`);
}
} // section 8

finish('hygiene');
