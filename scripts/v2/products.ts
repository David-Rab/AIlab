// Products and live edit (BUILD-PLAN R6; STRUCTURE §1 R4, §4.4; decisions D5, D7). Owner: WS1.
//   P1  products at the leader start: kind, standard tier, no features/mini/monitor; policies; sector packs built (D5)
//   P2  neutral package: productDomains is the model's own record; capacity rate has no monitor/mini term
//   P3  live edit: product.update (price, model, monitor) keeps the product live (same id, start day); the before →
//       after preview equals what the next tick computes; changes apply at the next tick (D7)
//   P4  D7 monitor overhead = 0.25 × serve ratio (mini on its full model 6.25%); catch rate falls with the gap
//   P5  monitor hooks the incident hazard: a caught incident stays internal (no public timer)
//   P6  Auto serving: most $ per H100e first, cut recorded on the lowest-rate product, Σ served = pool; no cut with
//       slack; the override (product.serving) turns Auto off and keeps hand-set shares
//   P7  features: build through the engineers' queue (cash + team-weeks), switch on per product, effect on demand;
//       unknown idea / not built / deep think without the feature are refused with their reason
//   P8  Agents launch gate: measured time horizon vs the task length; eval suites no longer expire; auto-evaluate
//       refreshes the internal model; upgrade-to-newest moves a product to a better cleared version
//   P9  retire; save round trip with an edited product
//   C2  feature data (every feature acts where offered) and feature upkeep (block at the end)
import { AGENT_TASK_HOURS, FEATURES, FEATURE_BY_ID, MONITOR_OVERHEAD, PRICE_TIERS, type FeatureFx } from '../../src/data/v2/features';
import { SECTORS } from '../../src/data/v2/sectors';
import { engDemand, featureInUse, featureUpkeepTW, upkeepLines } from '../../src/engine/v2/departments/build';
import { enablerShare, fxOn } from '../../src/engine/v2/worldfx/serving';
import { featureView } from '../../src/engine/v2/worldfx/productView';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { act, makeCtx, tick } from '../../src/engine/v2/core/loop';
import { deserialize, serialize, stateHash } from '../../src/engine/v2/core/save';
import { deployGate } from '../../src/engine/v2/models/deployments';
import { previewEdit } from '../../src/engine/v2/models/productOps';
import { agentsGate, catchRate, monitorOverhead, productDomains } from '../../src/engine/v2/models/products';
import { incidentsSystem } from '../../src/engine/v2/safety/incidents';
import type { Deployment, GameStateV2, ModelVersion, SectorId } from '../../src/engine/v2/types';
import { revenueReadout, servingPool } from '../../src/engine/v2/worldfx/revenue';
import { FIXTURE_DIR, check, finish } from './lib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evalM, labInputs } from '../../src/engine/v2/production/production';
import { fleetMonitor, internalFleets, monitorBudget } from '../../src/engine/v2/departments/agents';
import { previewAgentChange } from '../../src/engine/v2/departments/agentActions';
import { internalVersion } from '../../src/engine/v2/models/labs';

const game = () => newGame(defaultSetupV2({ seed: 2027, world: 'ai2027', alignment: 'medium', baseline: 'classic', tutorial: false }));
const run = (s: GameStateV2, n: number) => {
  for (let i = 0; i < n; i++) tick(s, { skip: ['endings'] });
};
const prod = (s: GameStateV2, ch: Deployment['channel']) => s.player.deployments.find((d) => d.channel === ch && d.status !== 'withdrawn')!;
const near = (a: number, b: number, rel = 0.01) => Math.abs(a - b) <= rel * Math.max(1e-9, Math.abs(b));
/** A copy of a version as another variant (tests only). */
function cloneVersion(s: GameStateV2, from: ModelVersion, id: string, over: Partial<ModelVersion>): ModelVersion {
  const v = { ...JSON.parse(JSON.stringify(from)), id, name: `${from.name}-${id}`, status: 'ready', ...over } as ModelVersion;
  s.player.models.versions.push(v);
  return v;
}

// ───────── P1, P2 ─────────
{
  const s = game();
  const ext = s.player.deployments.filter((d) => d.channel !== 'internal');
  check(ext.length === 3 && ext.every((d) => d.kind === 'product' && d.price === 'standard' && d.priceIndex === 1 && !d.features.length && !d.monitorId && !d.miniVersionId),
    'P1 leader start: Chat, API, Enterprise are products at the standard tier with no features, mini or monitor');
  const pol = s.player.policies;
  check(pol.servingAuto && pol.autoEvaluate && !pol.upgradeToNewest && pol.spareTraining === 'data', 'P1 policies: Auto serving on, auto-evaluate on, upgrade off; spare training → data generation');
  check(s.player.features.join() === 'sectorPacks', 'P1 D5: the leader start has sector packs built (the ×1 baseline)', s.player.features.join());
  const v0 = s.player.models.versions[0];
  check(ext.every((d) => productDomains(s, d) === v0.domains), 'P2 a plain product uses its model\'s own domain record (neutral)');
  check(ext.every((d) => monitorOverhead(s, d) === 0), 'P2 no monitor, no overhead');
}

// ───────── P3 live edit ─────────
{
  const s = game();
  run(s, 30);
  const api = prod(s, 'api');
  const id = api.id;
  const start = api.startDay;
  const v0 = s.player.models.versions[0];
  const pv = previewEdit(s, api, { price: 'premium', monitorId: v0.id });
  check(!!pv.before && !!pv.after && pv.fromDay === s.time.day + 1, 'P3 preview has before and after and takes effect at the next tick', `from ${pv.fromDay}`);
  const err = act(s, 'product.update', { id, price: 'premium', monitorId: v0.id });
  check(!err, 'P3 product.update applies', err ?? '');
  const d = prod(s, 'api');
  check(d.id === id && d.startDay === start && d.status === 'live' && d.price === 'premium' && d.priceIndex === PRICE_TIERS.premium && d.monitorId === v0.id, 'P3 the product stays live (same id and start day) with the new tier and monitor');
  tick(s, { skip: ['endings'] });
  const after = d.revenueRate ?? 0;
  check(near(after, pv.after!.revenue, 0.03), 'P3 the preview\'s revenue is what the next tick computes (±3%)', `${pv.after!.revenue.toFixed(3)} vs ${after.toFixed(3)}`);
  check(near(d.needH100e ?? 0, pv.after!.needH100e, 0.05), 'P3 the preview\'s serving need (incl. monitor) matches the next tick (±5%)', `${pv.after!.needH100e.toFixed(0)} vs ${d.needH100e}`);
  const err2 = act(s, 'product.update', { id, monitorId: 'none', price: 'standard' });
  check(!err2 && !prod(s, 'api').monitorId && prod(s, 'api').price === 'standard', 'P3 a monitor can be removed live; the tier changed back');
  const bad = act(s, 'product.update', { id, versionId: 'nope' });
  check(!!bad, 'P3 an unknown model is refused', bad ?? '');
}

// ───────── P4, P5 monitors ─────────
{
  const s = game();
  const v0 = s.player.models.versions[0];
  // V4: the monitor overhead reads FLOP per token (a quarter-size mini: ×0.25).
  const mini = cloneVersion(s, v0, 'VM', { variant: 'mini', serveCost: v0.serveCost * 0.25, fpt: (v0.fpt ?? 2e12) * 0.25 });
  const api = prod(s, 'api');
  api.monitorId = mini.id;
  check(Math.abs(monitorOverhead(s, api) - MONITOR_OVERHEAD * 0.25) < 1e-9, 'P4 D7: a mini monitor on its full model costs 0.25 × 0.25 = 6.25% of serving need', monitorOverhead(s, api).toFixed(4));
  // Late-game levels (M grows with level; at the start every model has M ≈ 1, so there is no gap yet).
  const hi = cloneVersion(s, v0, 'VH', {});
  hi.evals.measuredL = 11;
  mini.evals.measuredL = 9.5;
  const same = catchRate(s, hi, hi);
  const weak = catchRate(s, hi, mini);
  check(same.rate > weak.rate && weak.gap > 0 && same.gap === 0, 'P4 catch rate falls with the oversight gap (AG05 rule)', `same ${same.rate.toFixed(2)}, mini ${weak.rate.toFixed(2)}, gap ${weak.gap.toFixed(2)}`);
  // P5: force hazard on Chat with a same-model monitor: caught incidents are internal.
  const chat = prod(s, 'consumer');
  chat.monitorId = v0.id;
  v0.traitsTrue.SYC = 1;
  v0.traitsTrue.RH = 1;
  const before = s.player.safety.incidents.length;
  const ctx = makeCtx(s);
  for (const t of Object.keys(v0.traitsTrue) as (keyof typeof v0.traitsTrue)[]) v0.traitsTrue[t] = 1;
  for (let i = 0; i < 30000 && s.player.safety.incidents.length - before < 30; i++) incidentsSystem.run(s, ctx);
  const inc = s.player.safety.incidents.slice(before).filter((x) => x.deploymentId === chat.id && x.trueSource !== 'misuse');
  const caught = inc.filter((x) => x.exposure === 'internal').length;
  check(inc.length >= 10 && caught / inc.length > 0.5 && inc.filter((x) => x.exposure === 'internal').every((x) => x.publicTimerDays === undefined),
    'P5 a monitored product\'s incidents are mostly caught and stay internal', `${caught}/${inc.length} caught (rate ${catchRate(s, v0, v0).rate.toFixed(2)})`);
}

// ───────── P6 Auto serving ─────────
{
  const s = game();
  run(s, 5);
  const rd = revenueReadout(s);
  const pool = servingPool(s);
  const served = rd.deps.reduce((a, x) => a + x.servingH100e, 0);
  check(near(served, pool, 1e-6), 'P6 Auto uses the whole serving pool', `${served.toFixed(0)} of ${pool.toFixed(0)}`);
  const short = rd.deps.reduce((a, x) => a + x.needH100e, 0) > pool;
  if (short) {
    // V4: prices are markups over cost, so per-hour work earns about the same per H100e on every product: Auto serves it
    // pro rata and Chat's free users (earning nothing) last. A2c: seat-holders (seat revenue, more per H100e) are served
    // before the per-hour work, so the cut falls on the per-hour work: its cut share is the same on every sector product.
    const byRate = [...rd.deps].sort((a, b) => b.rpH - a.rpH);
    const low = byRate[byRate.length - 1];
    const cutShare = (x: (typeof byRate)[number]) => x.cutH100e / Math.max(1, x.needH100e - (x.needSeat ?? 0));
    const paid = byRate.filter((x) => x.channel !== 'consumer');
    const seatsServed = paid.every((x) => x.servingH100e >= (x.needSeat ?? 0) - 1e-6);
    check(low.channel === 'consumer' && low.cutH100e > 0 && seatsServed && paid.every((x) => cutShare(x) <= low.cutH100e / low.needH100e + 1e-9) && paid.every((x) => Math.abs(cutShare(x) - cutShare(paid[0])) < 0.02),
      'P6 short of serving: seats first, then per-hour work pro rata at equal revenue per H100e; Chat\'s free users are cut first', byRate.map((x) => `${x.channel} ${Math.round(x.rpH / 1e3)}K cut ${Math.round(x.cutH100e)}${x.needSeat ? ` (seats ${Math.round(x.needSeat)} served)` : ''}`).join(', '));
    check(s.player.deployments.some((d) => (d.cutH100e ?? 0) > 0), 'P6 the cut is recorded on the product (cutH100e)');
  } else check(false, 'P6 the start is short of serving (F11: capacity-bound start)');
  // Plenty of serving: no cut.
  const s2 = game();
  s2.player.computeOnline *= 20;
  const rd2 = revenueReadout(s2);
  check(rd2.deps.every((x) => x.cutH100e < 1e-6 && x.revenue >= x.demand - 1e-9), 'P6 with slack nothing is cut and every product is demand-bound');
  // Override.
  const chat = prod(s, 'consumer');
  const err = act(s, 'product.serving', { id: chat.id, share: 0.6 });
  check(!err && !s.player.policies.servingAuto && Math.abs(prod(s, 'consumer').servingShare - 0.6) < 1e-9, 'P6 override: a hand-set share turns Auto off', err ?? '');
  tick(s, { skip: ['endings'] });
  check(Math.abs(prod(s, 'consumer').servingShare - 0.6) < 1e-9, 'P6 with Auto off the share stays as set');
  check(!act(s, 'products.policy', { servingAuto: true }) && s.player.policies.servingAuto, 'P6 Auto can be switched back on');
}

// ───────── P7 features ─────────
{
  const s = game();
  run(s, 3);
  const cash0 = s.player.finance.cash;
  const no = act(s, 'feature.build', { id: 'voiceVision' });
  check(!!no && /Needs the idea/.test(no), 'P7 a feature whose idea is unknown cannot be built', no ?? '');
  const chat = prod(s, 'consumer');
  const early = act(s, 'feature.toggle', { product: chat.id, feature: 'companion', on: true });
  check(!!early && /not built/.test(early), 'P7 a feature cannot be switched on before it is built', early ?? '');
  const err = act(s, 'feature.build', { id: 'companion' });
  check(!err && s.player.build.queue.some((it) => it.kind === 'feature' && it.ref === 'companion') && s.player.finance.cash < cash0, 'P7 Companion mode goes on the engineers\' build queue and costs cash', err ?? '');
  let days = 0;
  while (!s.player.features.includes('companion') && days < 60) {
    run(s, 1);
    days++;
  }
  check(s.player.features.includes('companion'), 'P7 the engineers build it', `${days} d`);
  const c = prod(s, 'consumer');
  const pv = previewEdit(s, c, { features: ['companion'] });
  const on = act(s, 'feature.toggle', { product: c.id, feature: 'companion', on: true });
  check(!on && c.features.includes('companion') && pv.after!.demand > pv.before!.demand * 1.01, 'P7 switched on for Chat: the companion segment (a task enabler) raises its demand (preview)', `${pv.before!.demand.toFixed(2)} → ${pv.after!.demand.toFixed(2)}`);
  const api = prod(s, 'api');
  const wrong = act(s, 'feature.toggle', { product: api.id, feature: 'companion', on: true });
  check(!!wrong, 'P7 a feature is offered only on its products', wrong ?? '');
  const deep = act(s, 'product.update', { id: api.id, effort: 'deep' });
  check(!!deep, 'P7 deep think effort is refused without its idea and feature', deep ?? '');
}

// ───────── P8 gates and policies ─────────
{
  const s = game();
  const v0 = s.player.models.versions[0];
  v0.evals.suiteDay = -200;
  check(deployGate(s, v0, 'api') === true, 'P8 an old eval suite no longer blocks a launch (no expiry)', String(deployGate(s, v0, 'api')));
  const h = { ...v0, evals: { ...v0.evals, bench: { ...v0.evals.bench, horizon: { score: (AGENT_TASK_HOURS - 1) * 60, sd: 0, day: 0, by: 'self' as const } } } };
  const g = agentsGate(h);
  check(typeof g === 'string' && g.includes(`${AGENT_TASK_HOURS} h`), 'P8 Agents needs a measured time horizon ≥ the task length', String(g));
  h.evals.bench.horizon.score = (AGENT_TASK_HOURS + 1) * 60;
  check(agentsGate(h) === true, 'P8 a long enough horizon passes the Agents gate');
  const launch = act(s, 'product.launch', { channel: 'agents', versionId: v0.id });
  const hNow = (v0.evals.bench.horizon?.score ?? 0) / 60;
  check(hNow < AGENT_TASK_HOURS ? !!launch && /time horizon/.test(launch) : !launch, 'P8 launching Agents at the start follows the gate', `${hNow.toFixed(1)} h: ${launch ?? 'launched'}`);
  run(s, 45);
  const iv = s.player.models.versions.find((v) => v.id === s.player.agents.capRoutine.versionId)!;
  check(iv.evals.suiteDay !== undefined && s.time.day - iv.evals.suiteDay <= 30, 'P8 auto-evaluate keeps the internal model\'s suite ≤ 30 days old', `suite day ${iv.evals.suiteDay}, today ${s.time.day}`);
  // Upgrade policy.
  const api = prod(s, 'api');
  const cur = s.player.models.versions.find((v) => v.id === api.versionId)!;
  const better = cloneVersion(s, cur, 'VU', { day: s.time.day, pm: cur.pm + 0.2 });
  better.evals.measuredL = (cur.evals.measuredL ?? 0) + 0.5;
  better.evals.suiteDay = s.time.day;
  run(s, 1);
  check(prod(s, 'api').versionId === cur.id, 'P8 upgrade policy off: the product keeps its model');
  act(s, 'products.policy', { upgradeToNewest: true });
  run(s, 1);
  check(prod(s, 'api').versionId === better.id && prod(s, 'api').status === 'live', 'P8 upgrade policy on: the product moves to the newer cleared model, live');
}

// ───────── P9 retire, save ─────────
{
  const s = game();
  run(s, 10);
  const v0 = s.player.models.versions[0];
  const ent = prod(s, 'enterprise');
  act(s, 'product.update', { id: prod(s, 'api').id, monitorId: v0.id, price: 'budget' });
  const r = act(s, 'product.retire', { id: ent.id });
  check(!r && ent.status === 'withdrawn', 'P9 product.retire withdraws the product', r ?? '');
  run(s, 1);
  check(!revenueReadout(s).deps.some((x) => x.id === ent.id), 'P9 a retired product earns nothing');
  const blocked = act(s, 'retireVersion', { versionId: v0.id });
  check(!!blocked, 'P9 a model in use (product or monitor) cannot be retired', blocked ?? '');
  const s2 = deserialize(serialize(s));
  run(s, 20);
  run(s2, 20);
  check(stateHash(s) === stateHash(s2), 'P9 save round trip with an edited product stays deterministic');
}

// ───────── R7: internal agent packages (Company › Agents at work) ─────────
{
  const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day900.json'), 'utf8'));
  const inp = labInputs(s, 'player')!;
  const w = s.hidden.timeline;
  check(inp.qTaste === undefined && evalM(w, inp).M === evalM(w, { ...inp, qTaste: inp.qDep }).M, 'A1 default packages: no qTaste, and qTaste = qDep reproduces M exactly');
  const b = monitorBudget(s);
  check(b.rel === 1 && b.poolShare === 0.2 && b.coverage === 1, 'A1 the standard monitor package costs today\'s 20% of the safety pool', JSON.stringify(b));
  const iv = internalVersion(s)!;
  check(fleetMonitor(s, iv) === 1 && internalFleets(s).length === 1 && internalFleets(s)[0].usage === 1, 'A1 default: one internal fleet at usage 1, monitor strength 1 (today\'s monitoring)');
  const old = s.player.models.versions.find((v) => v.variant === 'full' && v.status !== 'retired' && (v.evals.measuredL ?? 0) < (iv.evals.measuredL ?? 0) - 2);
  if (old) {
    const pf = previewAgentChange(s, 'capFrontier', { versionId: old.id });
    check(pf.after.M < pf.before.M && pf.after.sdAI < pf.before.sdAI, 'A2 an older frontier-research model lowers AI taste and research speed', `${pf.before.M.toFixed(1)} → ${pf.after.M.toFixed(1)}`);
    const pm = previewAgentChange(s, 'capRoutine', { monitorId: old.id });
    check(pm.after.lanes.capRoutine.strength < 1 && pm.after.lanes.capRoutine.gap > 0, 'A3 an older monitor has an oversight gap and less than full strength', `gap ${pm.after.lanes.capRoutine.gap.toFixed(2)}`);
    const e = act(s, 'agents.set', { use: 'eng', versionId: old.id });
    check(!e && internalFleets(s).length === 2 && Math.abs(internalFleets(s).reduce((a, f) => a + f.usage, 0) - 1) < 1e-9, 'A4 an engineering model of its own is a second internal fleet (usages sum to 1)');
  }
  const pe = previewAgentChange(s, 'eng', { compute: 0.05 });
  check(pe.after.build < pe.before.build && pe.after.M > pe.before.M, 'A5 less engineering compute: less build capacity, more research agents', `${pe.before.build.toFixed(1)} → ${pe.after.build.toFixed(1)}`);
  act(s, 'agents.set', { use: 'capRoutine', monitorId: '' });
  act(s, 'agents.set', { use: 'capFrontier', monitorId: '' });
  check(monitorBudget(s).poolShare === 0 && fleetMonitor(s, iv) === 0, 'A6 no monitors: no safety compute reserved and no monitoring of the fleet');
  const t0 = s.player.policies.trustedToAI;
  const r = act(s, 'agents.trusted', { share: 0.9 });
  check(!r && Math.abs(s.player.policies.trustedToAI - 0.9) < 1e-12 && s.player.policies.trustedToAI > t0 && s.player.agents.safety.compute > 0, 'A7 Trusted to AI: any share 0–100% (E2: no cap); starts the safety agents', `${s.player.policies.trustedToAI} · ${s.player.agents.safety.compute}`);
}

// ───────── C2: every feature acts where it is offered; feature upkeep ─────────
//   C2a for each feature and each product it is offered on, at least one typed effect acts there (engine functions:
//       Chat reads fxOn / enablerShare on 'CHAT'; sector products on the sectors they sell to; effort and sector packs act
//       on every product); every typed effect acts on at least one of its products; the card's "here" flags agree
//   C2b Voice & vision on the API opens Media work (preview demand rises)
//   C2c built features charge the engineers' upkeep: ½ buildTW a year in use, a tenth while off everywhere, always in
//       use when they help the internal agents; sector packs nothing; featureView shows the same numbers
{
  const GOVS: SectorId[] = ['GOV', 'MIL'];
  const sectorsOf = (ch: Deployment['channel']): SectorId[] => (ch === 'gov' ? GOVS : SECTORS.map((x) => x.id));
  const moves = (x: { dG: number; hMult: number; tok: number }) => x.dG !== 0 || x.hMult !== 1 || x.tok !== 1;
  const acts = (fx: FeatureFx, ch: Deployment['channel']): boolean => {
    if (fx.kind === 'effort') return true;
    if (fx.kind === 'enabler' && fx.packs) return ch !== 'consumer';
    if (ch === 'consumer') return fx.kind === 'enabler' ? enablerShare([fx], 'CHAT') > 0 : moves(fxOn([fx], 'CHAT'));
    return sectorsOf(ch).some((sid) => (fx.kind === 'enabler' ? enablerShare([fx], sid) > 0 : moves(fxOn([fx], sid))));
  };
  const deadPairs: string[] = [];
  const deadFx: string[] = [];
  const viewOff: string[] = [];
  for (const f of FEATURES) {
    for (const ch of f.products) {
      if (!f.fx.some((fx) => acts(fx, ch))) deadPairs.push(`${f.id}@${ch}`);
      if (!featureView(f, ch).lines.some((l) => l.here)) viewOff.push(`${f.id}@${ch}`);
    }
    // An enabler's consumer and sector parts count apart (Voice & vision's Media part could not act before C2).
    const parts = f.fx.flatMap((fx): FeatureFx[] => (fx.kind === 'enabler' && fx.consumer && fx.sectors?.length ? [{ ...fx, sectors: undefined }, { ...fx, consumer: undefined }] : [fx]));
    parts.forEach((fx, i) => { if (!f.products.some((ch) => acts(fx, ch))) deadFx.push(`${f.id}#${i}`); });
  }
  check(!deadPairs.length, 'C2a every feature has a typed effect that acts on each product it is offered on', deadPairs.join(', '));
  check(!deadFx.length, 'C2a every typed effect acts on at least one of its feature\'s products', deadFx.join(', '));
  check(!viewOff.length, 'C2a the feature row shows an effect "here" on every product it is offered on', viewOff.join(', '));

  const s = game();
  run(s, 3);
  s.player.features.push('voiceVision');
  const api = prod(s, 'api');
  const pv = previewEdit(s, api, { features: ['voiceVision'] });
  check(pv.after!.demand > pv.before!.demand, 'C2b Voice & vision on the API opens Media work (demand rises)', `${pv.before!.demand.toFixed(3)} → ${pv.after!.demand.toFixed(3)}`);
  s.player.features.pop();

  const fl = (g: GameStateV2) => upkeepLines(g).filter((l) => l.kind === 'feature');
  check(fl(s).length === 0, 'C2c the leader start (sector packs only) carries no feature upkeep', JSON.stringify(fl(s)));
  const comp = FEATURE_BY_ID.companion;
  const mem = FEATURE_BY_ID.memory;
  const u0 = engDemand(s).upkeep;
  s.player.features.push('companion');
  const idle = fl(s).find((l) => l.ref === 'companion')?.tw ?? NaN;
  const u1 = engDemand(s).upkeep;
  check(near(idle, (0.1 * 0.5 * comp.buildTW) / 52, 1e-9) && near(u1 - u0, idle, 1e-6), 'C2c a built feature off everywhere costs a keep-alive (a tenth of ½ buildTW a year) on the upkeep need', `${idle.toFixed(4)} t-wk/wk`);
  const e = act(s, 'feature.toggle', { product: prod(s, 'consumer').id, feature: 'companion', on: true });
  const full = fl(s).find((l) => l.ref === 'companion')?.tw ?? NaN;
  check(!e && near(full, (0.5 * comp.buildTW) / 52, 1e-9) && near(engDemand(s).upkeep - u0, full, 1e-6), 'C2c switched on for a live product it costs ½ its build team-weeks a year', `${full.toFixed(4)} t-wk/wk ${e ?? ''}`);
  s.player.features.push('memory');
  const m = fl(s).find((l) => l.ref === 'memory')?.tw ?? NaN;
  check(near(m, featureUpkeepTW(mem), 1e-9) && featureInUse(s, mem), 'C2c Memory (horizon on all work, internal agents too) is in use once built even when off on every product', `${m.toFixed(3)} t-wk/wk`);
  const vc = featureView(comp, 'consumer');
  const vm = featureView(mem, 'consumer');
  check(near(vc.upkeepTW, full, 1e-9) && near(vc.idleTW, idle, 1e-9) && vm.idleTW === vm.upkeepTW && featureView(FEATURE_BY_ID.sectorPacks, 'api').upkeepTW === 0,
    'C2c the feature tooltip\'s upkeep is the engine\'s (in use / off everywhere; sector packs none)', `companion ${vc.upkeepTW.toFixed(3)}/${vc.idleTW.toFixed(3)}, memory ${vm.upkeepTW.toFixed(3)}/${vm.idleTW.toFixed(3)}`);
}

finish('products');
