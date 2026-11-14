// Engine hygiene (V2-SPEC §7.5). Owner: WS1.
// Registry contract, newGame validity, determinism, stream isolation, save round trip and size, cadences,
// cause ledger, performance.
import { AGENDA_IDS } from '../../src/data/v2/agendas';
import { TRAIT_IDS } from '../../src/data/v2/traits';
import { causeStrip } from '../../src/engine/v2/core/causes';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx, tick } from '../../src/engine/v2/core/loop';
import { SYSTEMS } from '../../src/engine/v2/core/registry';
import { STREAMS } from '../../src/engine/v2/core/rng';
import { SAVE_BUDGET_BYTES, deserialize, serialize, stateHash } from '../../src/engine/v2/core/save';
import { cadencesDue } from '../../src/engine/v2/core/time';
import type { Cadence, EngineSystem, GameStateV2, SetupV2, StreamId } from '../../src/engine/v2/types';
import { check, finish, runTo, validateJson } from './lib';

const N = 1500;

// ---------- 1. Registry matches the spec table (§2.2) ----------
const SPEC: [string, string, Cadence, number][] = [
  ['clock', 'WS1', 'daily', 10], ['computeOnline', 'WS3', 'daily', 20], ['production', 'WS1', 'daily', 30],
  ['runs', 'WS1', 'daily', 40], ['continual', 'WS1', 'daily', 45], ['milestones', 'WS1', 'daily', 50],
  ['revenue', 'WS5', 'daily', 60], ['safetyResearch', 'WS2', 'daily', 70], ['traitsDaily', 'WS2', 'daily', 75],
  ['incidents', 'WS2', 'daily', 80], ['security', 'WS4', 'daily', 90], ['rivalsChina', 'WS4', 'daily', 100],
  ['worldDaily', 'WS5', 'daily', 110], ['actorsDaily', 'WS4', 'daily', 120], ['opex', 'WS3', 'daily', 130],
  ['director', 'WS4', 'daily', 140], ['endings', 'WS4', 'daily', 150], ['record', 'WS1', 'weekly', 160],
  ['hiring', 'WS1', 'weekly', 200], ['intel', 'WS4', 'weekly', 210], ['payroll', 'WS3', 'monthly', 300],
  ['macro', 'WS5', 'monthly', 310], ['marketQ', 'WS3', 'quarterly', 400], ['sitesQ', 'WS3', 'quarterly', 410],
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
];
for (const setup of setups) {
  const s = newGame(setup);
  const errs = validateJson(s);
  const tag = `newGame ${setup.world}/${setup.baseline}/${setup.alignment}`;
  check(errs.length === 0, `${tag}: plain JSON`, errs.slice(0, 3).join('; '));
  check(STREAMS.every((k) => typeof s.rng[k] === 'number' && s.rng[k] > 0), `${tag}: all RNG streams seeded`);
  check(s.rivals.length === setup.rivalCount && s.rivals.every((r) => r.core.status === 'active'), `${tag}: ${setup.rivalCount} active rivals`);
  check(AGENDA_IDS.every((a) => s.player.safety.agendas[a]) && AGENDA_IDS.every((a) => s.hidden.agendaEfficacy[a] >= 0 && s.hidden.agendaEfficacy[a] <= 1), `${tag}: agendas + efficacy`);
  const v0 = s.player.models.versions[0];
  check(TRAIT_IDS.every((t) => v0.traitsTrue[t] !== undefined && v0.beliefs[t] && v0.masks[t]), `${tag}: V0 traits/beliefs/masks`);
  check(s.player.computeOnline > 0 && s.player.finance.cash > 0 && s.player.finance.valuation > 0, `${tag}: finance/compute start`, `cash ${s.player.finance.cash} V ${s.player.finance.valuation.toFixed(0)} C ${s.player.computeOnline}`);
  const leads = s.rivals.map((r) => Math.round(((v0.pm - r.internal.pm) / 1.25) * 12 * 10) / 10);
  // v1 archetype gap ranges (≤ 1.1 y); the tighter 3–9 month target is WS4's acceptance test T4.
  check(leads.every((m) => m >= 0 && m <= 13.5), `${tag}: rival gaps within v1 ranges (months)`, leads.join(', '));
  check(Object.keys(s.relations.stocks).length === 7 + setup.rivalCount + 15, `${tag}: relation counterparties`);
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
const CONSUMED_STREAMS: StreamId[] = ['safety'];
const probe = (stream: StreamId): EngineSystem => ({ id: `probe-${stream}`, owner: 'WS1', cadence: 'daily', order: 999, run: (_s, ctx) => void ctx.rng(stream).float() });
for (const target of ['safety', 'market'] as StreamId[]) {
  const c = run(detSetup, 400, { extraSystems: [probe(target)] });
  const base = run(detSetup, 400);
  const others = STREAMS.filter((k) => k !== target);
  check(others.every((k) => c.rng[k] === base.rng[k]) && c.rng[target] !== base.rng[target], `stream isolation: extra '${target}' draws leave other streams unchanged`);
  // [WS2 edit, for WS1 review] Once a stream has a consumer, extra draws on it legitimately change that consumer's
  // outcomes (WS2 draws findings/observations from 'safety'), so the whole-state check only applies to streams that
  // nothing consumes yet. The per-stream isolation check above still covers every target.
  if (CONSUMED_STREAMS.includes(target)) continue;
  const strip = (s: GameStateV2) => stateHash({ ...s, rng: { ...s.rng, [target]: 0 } });
  check(strip(c) === strip(base), `stream isolation: rest of state identical with extra '${target}' draws`);
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

// ---------- 6. Cadences ----------
const counts: Record<Cadence, number> = { daily: 0, weekly: 0, monthly: 0, quarterly: 0, semiannual: 0 };
const expected: Record<Cadence, number> = { daily: 0, weekly: 0, monthly: 0, quarterly: 0, semiannual: 0 };
const counters: EngineSystem[] = (Object.keys(counts) as Cadence[]).map((c, i) => ({ id: `count-${c}`, owner: 'WS1', cadence: c, order: 990 + i, run: () => void counts[c]++ }));
const cs = newGame(defaultSetupV2({ seed: 7 }));
for (let d = 1; d <= 730; d++) for (const c of cadencesDue(cs.time.startDate, d)) expected[c]++;
runTo(cs, 730, { extraSystems: counters });
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

// ---------- 8. Performance (§7.5: daily ≤ 1.5 ms avg, quarter tick ≤ 8 ms) ----------
const ps = newGame(defaultSetupV2({ seed: 9 }));
let daily = 0;
let nDaily = 0;
let worstQ = 0;
for (let d = 0; d < N; d++) {
  const q = cadencesDue(ps.time.startDate, ps.time.day + 1).includes('quarterly');
  const t0 = performance.now();
  tick(ps);
  const dt = performance.now() - t0;
  if (q) worstQ = Math.max(worstQ, dt);
  else {
    daily += dt;
    nDaily++;
  }
}
check(daily / nDaily <= 1.5, 'performance: daily tick average', `${((daily / nDaily) * 1000).toFixed(0)} µs`);
check(worstQ <= 8, 'performance: worst quarter tick', `${worstQ.toFixed(2)} ms`);

finish('hygiene');
