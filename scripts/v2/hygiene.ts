// Engine hygiene (V2-SPEC §7.5). Owner: WS1.
// Registry contract, newGame validity, determinism, stream isolation, save round trip and size, cadences,
// cause ledger, performance. `--no-perf` skips the performance section (8; wall-time budgets, meaningless on a loaded
// machine: test:full runs hygiene with --no-perf); `--perf-only` runs only section 8 (test:perf, on a quiet machine).
import { AGENDA_IDS } from '../../src/data/v2/agendas';
import { TRAIT_IDS } from '../../src/data/v2/traits';
import { causeStrip } from '../../src/engine/v2/core/causes';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx, tick } from '../../src/engine/v2/core/loop';
import { SYSTEMS } from '../../src/engine/v2/core/registry';
import { STREAMS, StreamRng } from '../../src/engine/v2/core/rng';
import { SAVE_BUDGET_BYTES, SCHEMA_REV, deserialize, serialize, stateHash } from '../../src/engine/v2/core/save';
import { cadencesDue, decimalYear } from '../../src/engine/v2/core/time';
import { LEADER_LAB_NAME } from '../../src/data/v2/names';
import { postureOf } from '../../src/engine/v2/actors/rivals';
import { gOfPm, gV0, playerStart } from '../../src/engine/v2/models/capability';
import { postG, recipeOf } from '../../src/engine/v2/actors/rivalModel';
import { LEADER_CAL } from '../../src/data/v2/calibration';
import { START_BY_ID } from '../../src/data/v2/starts';
import { ownedOnline, rentedOnline } from '../../src/engine/v2/compute/power';
import { nodeKnown } from '../../src/engine/v2/models/tree';
import { LEADER_ID } from '../../src/engine/v2/models/labs';
import { hRef, refTotal } from '../../src/engine/v2/production/knots';
import { uniqueTokens } from '../../src/engine/v2/production/data';
import { lineNodeId } from '../../src/data/v2/tree';
import type { Cadence, EngineSystem, GameStateV2, SetupV2, StreamId, WorkstreamId } from '../../src/engine/v2/types';
import { check, finish, runTo, validateJson } from './lib';

const N = 1500;
const PERF_ONLY = process.argv.includes('--perf-only');
const NO_PERF = process.argv.includes('--no-perf');

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
  const v0 = { pm: playerStart(s.hidden.timeline).target }; // the reference start model (= the leader start's V0)
  // Model v3 F1: the start recipe is solved so the leader's start version on its start base is V0 (rivalModel.ts), and
  // it is the leader's day-0 recipe (e ≈ 0: B0's dates make its recipe stale by B0's age; today's is the zero of e).
  const e0 = recipeOf(s, L);
  const g0 = L.internal.G ?? NaN;
  check(Math.abs(L.internal.pm - v0.pm) < 1e-9 && Math.abs(g0 - gV0(s.hidden.timeline)) < 1e-9 && Math.abs(e0) < 0.05 && postG(L.phys.base, L.phys.rec) >= g0,
    `${tag}: leader start model = the reference V0, on its start base at the leader's day-0 recipe`, `${L.internal.pm} vs ${v0.pm}; G ${g0} vs ${gV0(s.hidden.timeline)}; e ${e0.toFixed(4)}`);
  check(Math.abs(L.phys.eff - Math.pow(10, LEADER_CAL[setup.world] ?? 0)) < 1e-12, `${tag}: leader research efficiency = 10^LEADER_CAL`, String(L.phys.eff));
  check(Math.abs(L.core.computeOnline / refTotal(s.hidden.timeline, yr) - 1) < 1e-9 && Math.abs(L.core.staff.cap / hRef(yr) - 1) < 1e-9 && L.core.tasteHire === 1, `${tag}: leader compute = refTotal, staff = hRef`);
  check(postureOf(s, L.core.id).bindingness <= 0.3, `${tag}: leader bindingness ≤ 0.3`, postureOf(s, L.core.id).bindingness.toFixed(2));
  const off = newGame({ ...setup, leaderLab: false });
  const strip = (x: GameStateV2) => {
    const h = { ...x.hidden, actorPresets: { ...x.hidden.actorPresets, rivals: { ...x.hidden.actorPresets.rivals } }, rivalPostures: { ...x.hidden.rivalPostures } };
    delete h.actorPresets.rivals[LEADER_ID];
    delete h.rivalPostures[LEADER_ID];
    return JSON.stringify([h, x.rng.world, x.rivals.filter((r) => r.core.id !== LEADER_ID), x.china, x.player.pa, x.player.models]);
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
    const ref = playerStart(s.hidden.timeline).target;
    const nTeams = Object.values(def.teams).reduce((a, b) => a + b, 0);
    check(s.setup.leaderLab && s.rivals.some((r) => r.core.id === LEADER_ID), `${tag}: leader lab in the world (D1)`);
    check(s.player.teams.length === nTeams && Math.abs(ownedOnline(s) - def.owned) < 1 && Math.abs(rentedOnline(s) - def.rented) < 1, `${tag}: teams and compute owned / rented`, `${s.player.teams.length} teams, ${ownedOnline(s)} / ${rentedOnline(s)}`);
    check(def.known.every((id) => nodeKnown(s, id)) && def.features.every((f) => s.player.features.includes(f)), `${tag}: known nodes and built features`);
    const prods = s.player.deployments.filter((d) => d.channel !== 'internal').map((d) => d.channel).join(',');
    check(prods === def.products.map((x) => x.channel).join(',') && s.player.board.preset === def.board && s.setup.governance === def.board, `${tag}: products and board`, `${prods} · ${s.player.board.preset}`);
    const v = s.player.models.versions[0];
    check(v.pm < ref && (def.imported ? v.variant === 'imported' && s.player.models.runs.length === 0 : v.variant === 'full'), `${tag}: start model lags the reference (${def.lagMonths} mo)${def.imported ? ', imported (D6)' : ''}`, `${v.pm.toFixed(3)} < ${ref.toFixed(3)}`);
  }
  const leads = s.rivals.map((r) => Math.round(((playerStart(s.hidden.timeline).target - r.internal.pm) / 1.25) * 12 * 10) / 10);
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
// Model v3 V1 (schemaRev 12): saves from before the v3 model rebuild do not carry over (MODEL-V3 §16). A schemaRev-11
// save and an older one (rev 1, which migrated up to 11 before) are rejected with the existing message.
for (const rev of [1, 11, 12, 13, 14]) {
  const old = JSON.parse(serialize(run(detSetup, 30))) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = rev;
  let msg = '';
  try {
    deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  // Model v3 V2 (schemaRev 13): V1 saves (12) are rejected too; model v3 V3 (schemaRev 14): V2 saves (13) too.
  check(SCHEMA_REV === 32 && msg ===`no migration from schemaRev ${rev >= 12 ? rev : 11}`, `save: a schemaRev-${rev} save is rejected (${msg || 'loaded'})`);
}
// Model v3 V4a (schemaRev 16): a V3b save (15) migrates (customer stocks start empty, versions get their FLOP per token).
{
  const old = JSON.parse(serialize(run(detSetup, 30))) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = 15;
  delete (old.world.fx as Partial<typeof old.world.fx>).cust;
  for (const v of old.player.models.versions) delete v.fpt;
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  check(!!g && !!g.world.fx.cust && g.player.models.versions.every((v) => (v.fpt ?? 0) > 0), 'save: a schemaRev-15 save migrates to 16 (customer stocks, FLOP per token)', msg);
}
// Model v3 A2a (schemaRev 17): a V4a save (16) migrates (the workers' AI use stock W starts at its ceiling).
{
  const old = JSON.parse(serialize(run(detSetup, 30))) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = 16;
  for (const row of Object.values(old.world.sectors)) for (const st of Object.values(row)) delete (st as Partial<typeof st>).W;
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  const ok = !!g && Object.values(g.world.sectors).every((row) => Object.values(row).every((st) => st.W >= st.A && st.W > 0 && st.W <= 1));
  check(ok, "save: a schemaRev-16 save migrates to 17 (workers' AI use W per sector, A ≤ W ≤ 1)", msg);
}
// Model v3 A2b (schemaRev 18): an A2a save (17) migrates (the single consumer reach becomes reach per region, paid
// shares start empty).
{
  const old = JSON.parse(serialize(run(detSetup, 30))) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = 17;
  const fx = old.world.fx as Partial<typeof old.world.fx> & { consumerReach?: number };
  delete fx.reach;
  delete fx.paid;
  fx.consumerReach = 0.42;
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  const r = g?.world.fx.reach;
  const ok = !!g && !!r && r.US > 0.42 && r.US < 0.6 && r.ROW < r.US && !!g.world.fx.paid && !('consumerReach' in g.world.fx);
  check(ok, 'save: a schemaRev-17 save migrates to 18 (consumer reach per region, paid-share stocks)', `${msg}${r ? ` US ${r.US.toFixed(3)} ROW ${r.ROW.toFixed(3)}` : ''}`);
  if (g) for (let i = 0; i < 3; i++) tick(g);
  check(!!g && Object.keys(g.world.fx.paid.US).length > 0 && Object.values(g.world.fx.paid.US).every((x) => x > 0 && x < 1), 'save: after the 17 → 18 migration the paid shares fill on the next ticks', JSON.stringify(g?.world.fx.paid.US ?? {}));
}

// Model v3 A2c (schemaRev 19): an A2b save (18) migrates (the paid-seat share of each sector's AI users starts at the
// region's start share).
{
  const old = JSON.parse(serialize(run(detSetup, 30))) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = 18;
  for (const row of Object.values(old.world.sectors)) for (const st of Object.values(row)) delete (st as Partial<typeof st>).seat;
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  const ok = !!g && Object.values(g.world.sectors).every((row) => Object.values(row).every((st) => st.seat > 0 && st.seat < 1));
  check(ok, 'save: a schemaRev-18 save migrates to 19 (paid-seat share per sector, 0 < σ < 1)', msg);
  if (g) for (let i = 0; i < 3; i++) tick(g);
  check(!!g && Object.values(g.world.sectors.US).every((st) => Number.isFinite(st.seat) && st.seat > 0), 'save: after the 18 → 19 migration the seat stocks move on the next ticks');
}

// Model v3 B4 (schemaRev 20): an A2c save (19) migrates (no project on auto teams wanted).
{
  const old = JSON.parse(serialize(run(detSetup, 30))) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = 19;
  delete (old.player.research as Partial<typeof old.player.research>).wantAuto;
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  check(!!g && Array.isArray(g.player.research.wantAuto) && g.player.research.wantAuto.length === 0, 'save: a schemaRev-19 save migrates to 20 (no project on auto teams wanted)', msg);
}
// Model v3 D1 (schemaRev 21): a B4 save (20) migrates (v2's dataAssets token counts become the data portfolio, same U).
{
  const old = JSON.parse(serialize(run(detSetup, 30))) as GameStateV2 & Record<string, unknown>;
  const u0 = uniqueTokens(deserialize(JSON.stringify(old)));
  old.schemaRev = 20;
  const p = old.player as unknown as Record<string, unknown>;
  delete p.dataPortfolio;
  p.dataAssets = { licensedTokensT: 30, unlicensedTokensT: 270, syntheticTokensT: (u0 / 1e12 - 300) / 0.5 };
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  check(!!g && !!g.player.dataPortfolio && !('dataAssets' in g.player) && Math.abs(uniqueTokens(g) / u0 - 1) < 1e-9, 'save: a schemaRev-20 save migrates to 21 (data portfolio with the same U)', msg || (g ? `U ${(uniqueTokens(g) / 1e12).toFixed(2)}T vs ${(u0 / 1e12).toFixed(2)}T` : ''));
}
// Model v3 E1 (schemaRev 22): a D1 save (21) migrates (a safety line project in progress gets its stage state).
{
  const old = JSON.parse(serialize(run(detSetup, 30))) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = 21;
  const id = lineNodeId('AG02');
  old.player.tree[id] = { status: 'researching', progress: 0.5, attempts: 1 };
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  const saf = g?.player.tree[id]?.saf;
  check(!!saf && saf.stage === 'small' && (saf.test?.work ?? 0) > 0, 'save: a schemaRev-21 save migrates to 22 (a line project in progress keeps its work as stage state)', msg || `${saf?.stage ?? 'no saf'}`);
}
// Model v3 D5 (schemaRev 23, built as 22 before M2): an E1 save (22) migrates (environment suites from the graders choice,
// the start suites' expert data).
{
  const old = JSON.parse(serialize(run(detSetup, 30))) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = 22;
  delete (old.player as Partial<GameStateV2['player']>).suites;
  old.player.dataPortfolio.assets = old.player.dataPortfolio.assets.filter((a) => a.kind !== 'expert');
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  const fams = g ? Object.keys(g.player.suites) : [];
  check(!!g && fams.length >= 6 && fams.every((f) => g!.player.dataPortfolio.assets.some((a) => a.id === `expert:${f}` && a.kind === 'expert' && a.tokensT > 0)),
    'save: a schemaRev-22 save migrates to 23 (environment suites with their expert data)', msg || fams.join(', '));
}
// Model v3 D2 (schemaRev 24, built as 23 before M2): a D5 save (23) migrates (no data deals pending, no synthetic job).
{
  const old = JSON.parse(serialize(run(detSetup, 30))) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = 23;
  delete (old.player.dataPortfolio as Partial<GameStateV2['player']['dataPortfolio']>).pending;
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  check(!!g && Array.isArray(g.player.dataPortfolio.pending) && g.player.dataPortfolio.pending.length === 0 && !g.player.dataPortfolio.synJob,
    'save: a schemaRev-23 save migrates to 24 (nothing pending, no synthetic job)', msg);
}

// Model v3 E6 (schemaRev 25): a D2 save (24) migrates: each technique's M½ becomes its half-strength point in OOM above
// the start model where v2's decay halved on the ai2027 reference path (M½ 25 → 4.38, 50 → 5.70, 250 → 8.78).
{
  const old = JSON.parse(serialize(run(detSetup, 30))) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = 24;
  const ts = old.player.safety.techniques as unknown as Record<string, { oHalf?: number; mHalf?: number }>;
  for (const t of Object.values(ts)) delete t.oHalf;
  ts['T-PROP'].mHalf = 50; // AG08 (M½ 25) after one upkeep doubling
  ts['T-PROBE'].mHalf = 250;
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  const T = g?.player.safety.techniques;
  const ok = !!T && Object.values(T).every((t) => typeof t.oHalf === 'number' && !('mHalf' in t))
    && Math.abs(T['T-PROP'].oHalf - (4.376 + 4.4 * Math.log10(2))) < 1e-9 && Math.abs(T['T-PROBE'].oHalf - 8.776) < 1e-9;
  check(ok, 'save: a schemaRev-24 save migrates to 25 (M½ → the same half point in OOM)', msg || (T ? `T-PROP ${T['T-PROP'].oHalf.toFixed(3)}, T-PROBE ${T['T-PROBE'].oHalf.toFixed(3)}` : ''));
}
// Model v3 D7 (schemaRev 26, built as 25 before M4): an E6 save (25) migrates (no eval suites queued, 'evals' joins the
// research engineers' order right after run operations).
{
  const old = JSON.parse(serialize(run(detSetup, 30))) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = 25;
  const m = old.player.models as unknown as Record<string, unknown>;
  delete m.evals;
  delete m.evalSpent;
  old.player.research.re.order = old.player.research.re.order.filter((x) => x !== 'evals');
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  const o = g?.player.research.re.order ?? [];
  check(!!g && Array.isArray(g.player.models.evals) && g.player.models.evals.length === 0 && o.indexOf('evals') === o.indexOf('ops') + 1,
    'save: a schemaRev-25 save migrates to 26 (no eval suites, evals after run operations)', msg || o.join(', '));
}
// Model v3 F1 (schemaRev 27, built as 25 before M4): a D7 save (26) migrates: every non-player lab gets a base under its internal model.
{
  const old = JSON.parse(serialize(run(detSetup, 30))) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = 26;
  for (const r of [...old.rivals, old.china.lab]) {
    delete (r as Partial<typeof r>).phys;
    for (const m of [r.internal, r.publicModel]) if (m) { delete m.G; delete m.flop; delete m.params; delete m.fpt; }
  }
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  const labs = g ? [...g.rivals, g.china.lab] : [];
  const ok = !!g && labs.every((r) => !!r.phys && r.phys.base.flop > 0 && Math.abs((r.internal.G ?? NaN) - gOfPm(g!.hidden.timeline, r.internal.pm)) < 1e-9 && (r.internal.fpt ?? 0) > 0);
  check(ok, 'save: a schemaRev-26 save migrates to 27 (each rival keeps its model, now on a physical base)', msg || labs.map((r) => `${r.core.id} G ${r.internal.G?.toFixed(2)} N ${((r.internal.params ?? 0) / 1e12).toFixed(2)}T`).join(', '));
}
// Model v3 D10 (schemaRev 29; built as 26): a D9 save (28) migrates: every lab's serving stack at the 2025 reference, rlG on its models.
{
  const cur = run(detSetup, 30);
  const old = JSON.parse(serialize(cur)) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = 28;
  for (const r of [...old.rivals, old.china.lab]) {
    delete (r.phys as Partial<typeof r.phys>).serve;
    for (const m of [r.internal, r.publicModel]) if (m) delete m.rlG;
  }
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  const labs = g ? [...g.rivals, g.china.lab] : [];
  const was = [...cur.rivals, cur.china.lab];
  const ok = !!g && labs.every((r, i) => r.phys.serve === 0 && r.internal.rlG !== undefined && Math.abs((r.internal.rlG ?? 0) - (was[i].internal.rlG ?? 0)) < 1e-9);
  check(ok, 'save: a schemaRev-28 save migrates to 29 (serving stacks at 0, the RL part of G of each internal model from its base)', msg || labs.map((r) => `${r.core.id} rlG ${r.internal.rlG?.toFixed(3)}`).join(', '));
}
// Model v3 F2 (schemaRev 30; built as 26): a D10 save (29) migrates: each lab's recipe e becomes the pretraining part, know-how unchanged.
{
  const old = JSON.parse(serialize(run(detSetup, 30))) as GameStateV2 & Record<string, unknown>;
  old.schemaRev = 29;
  const pa0: number[] = [];
  for (const r of [...old.rivals, old.china.lab]) {
    const ph = r.phys as Partial<typeof r.phys>;
    delete ph.rec; delete ph.pool; delete ph.paSync;
    pa0.push(r.core.pa);
  }
  let msg = '';
  let g: GameStateV2 | undefined;
  try {
    g = deserialize(JSON.stringify(old));
  } catch (e) {
    msg = (e as Error).message;
  }
  const labs = g ? [...g.rivals, g.china.lab] : [];
  const ok = !!g && labs.every((r, i) => !!r.phys.rec && !!r.phys.pool && Math.abs(r.core.pa - pa0[i]) < 1e-9 && r.phys.paSync === r.core.pa);
  check(ok, 'save: a schemaRev-29 save migrates to 30 (each rival recipe in three parts, know-how unchanged)', msg);
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
