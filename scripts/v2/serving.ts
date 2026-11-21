// Serving, products and sectors on work types (model v3 V4.4; design/V3-BUILD.md "V4" and "V4 notes"). Owner: WS5.
//   S1  cost per work-hour ∝ FLOP per token (2·N_active) × tokens; a bigger model costs more per task (the size → cost
//       link v2's revenue exponent damped)
//   S2  capacity ∝ serving H100e (work-hours a year = H100e × 8766 ÷ H100e-hours per work-hour); revenue = min(demand,
//       capacity) × price
//   S3  price never below cost; never above the work's value unless serving costs more than the work is worth
//   S4  customers move gradually: a better model moves the customer stock toward the logit target at the segment's speed,
//       not on release day
//   S5  sector feasibility is the shared work-type coverage function (monotone in fit and horizon); the cost gate reads
//       the physical price
//   S6  features are typed (enabler / horizon / scaffold / effort) and apply to products and to internal agents
//   S7  lint: no revenue, price, cost or sector reader uses serveCost, multiplierRef or the M bridge
//   C1–C6 consumer demand (A2b, research/22 §2–3): reach and paid share are stocks moving toward their targets;
//       subscribers × price × 12 is the consumer line, independent of work hours; free users' need uses ≈ 9k tokens a
//       weekly-user-day and is cut first; a better model raises the paid share; no subscription above the willingness
//       to pay
//   B1–B7 who pays for work use and agent work (A2c, research/22 §3–7): paid seats ⊆ the workers who use AI; adopted +
//       seated + unseated hours = the hours of use; seat revenue = seats × price × 12; unseated hours bill no one; agent
//       leverage rises with horizon and coverage; parallelism and token intensity raise the serving need, not human hours;
//       per-hour billing stays cost-plus
//   A1–A3 price of a fixed capability (task A3, research/20 D3 ≈ ×10/yr): the cheapest model the lab could serve at
//       V0's level (a version or a distilled student) is a run planRun accepts; its price falls ×6–×900 a year (M9: the sourced ×9–×900), decomposed
//       into active parameters × FLOP per parameter × serving stack (utilisation) × tokens per task × $ per H100e-hour ×
//       margin (D10)
//   V1–V4 serving-efficiency ideas and tokens per task (task D10, research/20 D1–D3): the reference lab's serving stack
//       grows by its Inference-efficiency line (and rivals' by their aggregate research); decode utilisation and new
//       versions' FLOP per token follow it at the stated sizes (0.07 → 0.15, then 10^−rest); a model's reasoning tokens
//       fall with its RL recipe's G-equivalent (1 OOM per OOM, ≥ 0.1), not with the calendar; effort multiplies them
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURES, FEATURE_BY_ID } from '../../src/data/v2/features';
import { AGENT_WORK, MARKUP, SEATS, TOKENS, CONSUMER_MKT } from '../../src/data/v2/serving';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { deserialize } from '../../src/engine/v2/core/save';
import { decimalYear, dayOfDate } from '../../src/engine/v2/core/time';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { engine } from '../../src/engine/v2/index';
import { refBot } from '../../src/engine/v2/bots/ref';
import { flopPerToken, labourOf, workFit } from '../../src/engine/v2/departments/workfit';
import { versionById } from '../../src/engine/v2/models/labs';
import { bandPaid, reachTargets, worldMix, type TierKind, type WorldMix } from '../../src/engine/v2/worldfx/mix';
import { adequacy, surplusChoice, type Tier } from '../../src/engine/v2/worldfx/choice';
import { revenueReadout, sectorHours, sectorSpendParts, servingPool } from '../../src/engine/v2/worldfx/revenue';
import { agentCeilingOf, workHoursOf } from '../../src/engine/v2/worldfx/use';
import { ECON, REGION_SCALE, SECTORS } from '../../src/data/v2/sectors';
import { LINEUP, MARKET_BANDS, SHARE_SLOPE_G } from '../../src/data/v2/serving';
import {
  adoptedTokens, agentDemandOf, agentLeverage, blendTiers, cheapestAt, effortDG, lineupOf, studentToHold, fxOn, h100eHoursPer, internalFx, offerOf, paidShareTarget, productOffer, reachTarget, sectorCover, sectorTheta, serveDollarsPerHour,
  subPrice, tokEff, valuePerHour, wagePerHour, chatFreeTier, freeTierOf,
} from '../../src/engine/v2/worldfx/serving';
import { CUSTOMER_TAU, MULTI_HOMING } from '../../src/data/v2/serving';
import { B_G_PER_Y, REFERENCE_BASE, SHAPE } from '../../src/data/v2/runDesign';
import { consumerUse, workBilling } from '../../src/engine/v2/worldfx/readouts';
import { monitorOverhead } from '../../src/engine/v2/models/products';
import { paramsOfVersion, planRun } from '../../src/engine/v2/models/runs';
import { DISTILL } from '../../src/data/v2/runDesign';
import { fptOfBase, makeBase } from '../../src/engine/v2/actors/rivalModel';
import { SERVE_FLOP_MAX, TOK_MIN, TOK_PER_RL_OOM, TOKENS_PER_WORK_HOUR, U_DECODE, U_DECODE_MAX, U_PREFILL } from '../../src/data/v2/workTypes';
import { SERVE_RATE0 } from '../../src/data/v2/rivalModel';
import { addPublic, decodeUtilNow, decodeUtilOf, rlGOfBuild, serveFlopOomOf, serveNow, SERVE_U_OOM } from '../../src/engine/v2/models/stacks';
import { serveTechMult } from '../../src/engine/v2/models/runs';
import { agentFpt, agentFptEq, h100eHoursPerWorkHour } from '../../src/engine/v2/departments/workfit';
import { rivalDecodeU, rivalServeFpt } from '../../src/engine/v2/actors/rivalModel';
import type { Deployment, GameStateV2, ModelVersion, SectorId } from '../../src/engine/v2/types';
import { FIXTURE_DIR, check, finish } from './lib';

const game = () => newGame(defaultSetupV2({ seed: 2027, world: 'ai2027', alignment: 'medium', baseline: 'classic', tutorial: false }));
const run = (s: GameStateV2, n: number) => {
  for (let i = 0; i < n; i++) tick(s, { skip: ['endings'] });
};
const prod = (s: GameStateV2, ch: Deployment['channel']) => s.player.deployments.find((d) => d.channel === ch && d.status !== 'withdrawn')!;
const near = (a: number, b: number, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1e-12, Math.abs(b));
const fixture = (d: number) => deserialize(readFileSync(join(FIXTURE_DIR, `day${d}.json`), 'utf8'));
function cloneVersion(s: GameStateV2, from: ModelVersion, id: string, over: Partial<ModelVersion>): ModelVersion {
  const v = { ...JSON.parse(JSON.stringify(from)), id, name: `${from.name}-${id}`, status: 'ready', ...over } as ModelVersion;
  s.player.models.versions.push(v);
  return v;
}

// ───────── S1 cost ∝ N_active × tokens; a bigger model costs more per task ─────────
{
  const tok = TOKENS.agentic;
  const h1 = h100eHoursPer(2e12, tok);
  check(near(h100eHoursPer(4e12, tok), 2 * h1) && near(h100eHoursPer(2e12, { input: 2 * tok.input, output: 2 * tok.output }), 2 * h1),
    'S1 H100e-hours per work-hour ∝ FLOP per token and ∝ tokens', `${h1.toFixed(3)} H100e-h per agentic work-hour at 1T active`);
  const s = game();
  const v0 = s.player.models.versions[0];
  const big = cloneVersion(s, v0, 'VB', { fpt: 2 * (v0.fpt ?? 2e12) });
  const rate = serveDollarsPerHour(s);
  const o1 = offerOf(s, [{ v: v0, fpt: flopPerToken(s, v0), w: 1 }], 'SOFT', { markup: MARKUP.standard, rate });
  const o2 = offerOf(s, [{ v: big, fpt: flopPerToken(s, big), w: 1 }], 'SOFT', { markup: MARKUP.standard, rate });
  check(near(o2.cost, 2 * o1.cost) && o2.price > o1.price, 'S1 a model with twice the active parameters costs twice as much per work-hour (and is priced higher)', `$${o1.cost.toFixed(2)} → $${o2.cost.toFixed(2)} per work-hour`);
  const g0 = workFit(s, v0, 'SWE').fit;
  void g0;
  // Model v3 F1: a rival serves its own base: 10× the training FLOP at the same tokens per parameter is √10 × the active
  // parameters and FLOP per token (N = √(FLOP/(6·tpp))), whatever its recipe.
  const rb = (flop: number, e: number) => fptOfBase(makeBase(2, 0, flop, e));
  check(near(rb(3e27, 0) / rb(3e26, 0), Math.sqrt(10)) && rb(3e26, 0) === rb(3e26, 2), 'S1 rivals: FLOP per token from their own base (×√10 per 10× training FLOP, not from G)', `${(rb(3e27, 0) / rb(3e26, 0)).toFixed(3)}×`);
  const eff = effortDG(4);
  check(eff > 0.2 && eff < 0.3 && effortDG(1e6) === 1.5, 'S1 effort deep: ×4 reasoning tokens, +0.24 OOM; the test-time gain is capped at +1.5 OOM (R20 C3)', eff.toFixed(3));
}

// ───────── S2 capacity ∝ H100e; revenue = min(demand, capacity) × price ─────────
{
  const s = game();
  run(s, 3);
  const rd1 = revenueReadout(s);
  const pool1 = servingPool(s);
  s.player.computeOnline *= 2;
  const rd2 = revenueReadout(s);
  // Work-hours a product can serve per H100e it gets is a property of its model and tokens: capacity ∝ H100e.
  const per = (x: { capHours: number; servingH100e: number }) => x.capHours / Math.max(1e-9, x.servingH100e);
  const sector = rd1.deps.filter((x) => x.channel !== 'consumer' && x.servingH100e > 0);
  const ok = sector.length > 0 && sector.every((x) => near(per(rd2.deps.find((z) => z.id === x.id)!), per(x), 1e-6));
  // A2c: a product without seats earns one rate per H100e at any pool ($ capacity ∝ its H100e); seats are served first
  // and earn more per H100e, so with seats the $ capacity per H100e falls as the pool grows (work-hours per H100e fixed).
  const capPer = (rd: typeof rd1, id: string) => { const x = rd.deps.find((z) => z.id === id)!; return x.capacity / Math.max(1e-9, x.servingH100e); };
  const noSeat = sector.filter((x) => !(x.seats ?? 0));
  const withSeat = sector.filter((x) => (x.seats ?? 0) > 0);
  const tot = (rd: typeof rd1) => rd.deps.reduce((a, x) => a + x.capacity, 0);
  check(near(servingPool(s), 2 * pool1, 1e-9) && ok && noSeat.length > 0 && noSeat.every((x) => near(capPer(rd2, x.id), capPer(rd1, x.id), 1e-6))
    && withSeat.every((x) => capPer(rd2, x.id) <= capPer(rd1, x.id) * (1 + 1e-9)) && tot(rd2) > 1.5 * tot(rd1),
    'S2 capacity ∝ serving H100e: work-hours per H100e fixed by the model and tokens; $ per H100e fixed without seats (seats served first earn more)',
    `${sector.map((x) => `${x.channel} ${Math.round(per(x))} work-hours and ${Math.round(capPer(rd1, x.id) * 1e6)}K → ${Math.round(capPer(rd2, x.id) * 1e6)}K per H100e-year`).join('; ')}; capacity ${tot(rd1).toFixed(1)}B → ${tot(rd2).toFixed(1)}B`);
  check(rd2.deps.every((x) => x.revenue <= Math.min(x.demand, x.capacity) + 1e-9), 'S2 revenue never exceeds demand or capacity');
  const rate = serveDollarsPerHour(s);
  const api = rd2.deps.find((x) => x.channel === 'api')!;
  check(api.hours > 0 && near(api.pricePerHour, MARKUP.standard * api.costPerHour, 0.02), 'S2 a standard-tier product prices at its cost × the standard markup (margin 0.6)', `cost $${api.costPerHour.toFixed(2)}, price $${api.pricePerHour.toFixed(2)} per work-hour at $${rate.toFixed(2)}/H100e-h`);
}

// ───────── S3 price never below cost, never above value (unless the work is worth less than serving it) ─────────
for (const d of [400, 900]) {
  const s = fixture(d);
  const mix = worldMix(s);
  const rate = serveDollarsPerHour(s);
  let bad = 0;
  let n = 0;
  let tiers = 0;
  for (const r of ['US', 'CN', 'ROW'] as const) for (const [sid, m] of Object.entries(mix.sec[r]) as [SectorId, (typeof mix.sec.US)[SectorId]][]) {
    const value = valuePerHour(s, sid, r);
    mix.providers.forEach((p, i) => {
      if (!p.model || !m.prices[i]) return;
      const o = offerOf(s, [{ v: p.model, fpt: p.fpt ?? 2e12, w: 1 }], sid, { markup: p.markup, rate, ud: p.ud }); // D10: the provider's decode utilisation (M5)
      n++;
      // A5: the provider sells a lineup (its model and its cheap tiers); every tier's price is in [cost, max(cost, value)]
      // and the provider's price is its customers' tier mix of them (≥ the mix's cost).
      const T = m.tiers;
      let mixP = 0;
      let mixC = 0;
      T.offers[i].forEach((t, k) => {
        tiers++;
        const pr = T.price[i][k];
        if (pr < t.cost * (1 - 1e-9) || (pr > value * (1 + 1e-9) && pr > t.cost * (1 + 1e-9))) bad++;
        mixP += T.weight[i][k] * pr;
        mixC += T.weight[i][k] * t.cost;
      });
      if (!near(T.offers[i][0].cost, o.cost, 1e-9) || !near(m.prices[i], mixP, 1e-9) || m.prices[i] < mixC * (1 - 1e-9) || m.prices[i] > Math.max(value, mixC) * (1 + 1e-9)) bad++;
    });
  }
  check(n > 0 && bad === 0, `S3 day ${d}: every provider's price per hour of use is ≥ its cost and ≤ the work's value (unless serving costs more than the work is worth), tier by tier (A5 lineups) and for its customers' tier mix`, `${n} providers, ${tiers} tiers, ${bad} outside`);
  const rd = revenueReadout(s, mix);
  check(rd.deps.every((x) => x.channel === 'consumer' ? (x.subPrice ?? 0) >= (x.subCost ?? 0) - 1e-9 && (x.subPrice ?? 0) <= Math.max(CONSUMER_MKT.wtpMonth, x.subCost ?? 0) + 1e-9 : x.hours === 0 || x.pricePerHour >= x.costPerHour - 1e-9),
    `S3 day ${d}: the player's products price at or above their cost (Chat at most the willingness to pay, $${CONSUMER_MKT.wtpMonth}/month)`, rd.deps.map((x) => `${x.channel} ${x.channel === 'consumer' ? `$${(x.subCost ?? 0).toFixed(1)}→$${(x.subPrice ?? 0).toFixed(1)}/mo` : `$${x.costPerHour.toFixed(2)}→$${x.pricePerHour.toFixed(2)}/h`}`).join(', '));
}

// ───────── S4 customers move gradually ─────────
{
  const s = game();
  run(s, 20);
  const mix0 = worldMix(s);
  const pi = mix0.providers.findIndex((p) => p.key === 'player');
  const sh0 = mix0.sec.US.SOFT.share[pi];
  // A much better model on every product: the target rises at once, more as firms add the lab (its reach, A8
  // MULTI_HOMING), and the stock follows at CUSTOMER_TAU.sector.
  const v0 = versionById(s, prod(s, 'api').versionId)!;
  const better = cloneVersion(s, v0, 'VX', { build: { ...v0.build!, dg: (v0.build?.dg ?? 0) + 1.5 } });
  for (const d of s.player.deployments) if (d.channel !== 'internal') d.versionId = better.id;
  const mixT = worldMix(s);
  const tgt = mixT.sec.US.SOFT.target[pi];
  const r0 = mixT.reach.US.stock[pi];
  const rT = mixT.reach.US.target[pi];
  run(s, 1);
  const sh1 = worldMix(s).sec.US.SOFT.share[pi];
  run(s, 44);
  const m45 = worldMix(s);
  const sh45 = m45.sec.US.SOFT.share[pi];
  const r45 = m45.reach.US.stock[pi];
  const tgt45 = m45.sec.US.SOFT.target[pi];
  const want = 1 - Math.exp(-45 / (CUSTOMER_TAU.sector * 365));
  check(tgt > sh0 + 0.02 && rT > 0.9 && r45 > r0 + 0.5 * (rT - r0) * (1 - Math.exp(-45 / (MULTI_HOMING.tau * 365))) && tgt45 > tgt && sh1 - sh0 < 0.05 * (tgt - sh0) + 0.01 && sh45 > sh0 + 0.5 * want * (tgt - sh0),
    'S4 a much better model: the target share rises at once and more as firms add the lab (reach → its target over MULTI_HOMING.tau); the customer stock moves a little a day (CUSTOMER_TAU.sector)',
    `share ${sh0.toFixed(3)} → day 1 ${sh1.toFixed(3)} → day 45 ${sh45.toFixed(3)} (target ${tgt.toFixed(3)} → ${tgt45.toFixed(3)}); reach ${r0.toFixed(3)} → ${r45.toFixed(3)} (target ${rT.toFixed(3)})`);
  const c0 = worldMix(s).consumer.US.share[pi];
  check(Number.isFinite(c0) && c0 > 0, 'S4 consumers are a stock too (moves in weeks)', c0.toFixed(3));
}

// ───────── S5 sector feasibility on the shared coverage function ─────────
{
  const s = game();
  const w = s.hidden.timeline;
  const th = sectorTheta(w, 'SOFT');
  const a = (f: number, h: number) => sectorCover(w, 'SOFT', f, h);
  check(a(th + 1, 600) > a(th, 600) && a(th, 600) > a(th - 1, 600) && a(th, 6000) > a(th, 60), 'S5 sector coverage rises with fit and with the time horizon');
  check(Math.abs(a(th, 1e9) - 0.5) < 1e-6, 'S5 at the sector\'s median-professional point (θ) the logistic part is ½');
  run(s, 2);
  const m = worldMix(s).sec.US.SOFT;
  check(m.F > 0 && m.F < 1 && m.K > 0.5 && m.K < 1 && Math.abs(s.world.sectors.US.SOFT.F - m.F) < 0.005, 'S5 the sector state reads feasibility and the cost gate from the market mix', `F ${m.F.toFixed(3)}, K ${m.K.toFixed(3)}`);
  const off = worldMix(s).sec.US.LOG;
  check(off.F < m.F, 'S5 robot-bound work (Logistics, PHYS 0.75) is less feasible than software', `LOG ${off.F.toFixed(3)} vs SOFT ${m.F.toFixed(3)}`);
}

// ───────── S6 typed features in products and internal use ─────────
{
  check(FEATURES.every((f) => f.fx.length > 0 && f.fx.every((x) => ['enabler', 'horizon', 'scaffold', 'effort'].includes(x.kind))), 'S6 every feature has typed effects (enabler / horizon / scaffold / effort)', FEATURES.map((f) => `${f.id}:${f.fx.map((x) => x.kind).join('+')}`).join(' '));
  const s = game();
  run(s, 2);
  const api = prod(s, 'api');
  const base = productOffer(s, api, 'SOFT');
  s.player.features.push('codingAgent');
  api.features.push('codingAgent');
  const withF = productOffer(s, api, 'SOFT');
  const sc = FEATURE_BY_ID.codingAgent.fx[0] as { dG: number; tokens: number };
  check(near(withF.fit, base.fit + sc.dG, 1e-9) && near(withF.cost, base.cost * sc.tokens, 1e-9), 'S6 scaffold (coding agent) on a product: +ΔG fit in Software & IT and × tokens per work-hour', `fit ${base.fit.toFixed(3)} → ${withF.fit.toFixed(3)}, cost $${base.cost.toFixed(2)} → $${withF.cost.toFixed(2)}`);
  const l0 = labourOf(game(), 'SWE');
  const l1 = labourOf(s, 'SWE');
  check(near(l1.fit.fit, l0.fit.fit + sc.dG, 1e-6) && internalFx(s, 'SWE').tok === sc.tokens, 'S6 the same scaffold applies to the internal engineering agents (fit +ΔG, × tokens per work-hour)', `${l0.fit.fit.toFixed(3)} → ${l1.fit.fit.toFixed(3)}`);
  const hz = fxOn(FEATURE_BY_ID.memory.fx, 'OFFICE');
  check(hz.hMult === 1.3 && fxOn(FEATURE_BY_ID.memory.fx, 'EXP').hMult === 1.3, 'S6 horizon extender (memory): × h50 on every work type, products and internal');
  const ent = prod(s, 'consumer');
  const rd0 = revenueReadout(s).deps.find((x) => x.id === ent.id)!;
  s.player.features.push('companion');
  ent.features.push('companion');
  const rd1 = revenueReadout(s).deps.find((x) => x.id === ent.id)!;
  check((rd1.users ?? 0) > (rd0.users ?? 0) * 1.15, 'S6 task enabler (companion): opens a segment of Chat users', `${((rd0.users ?? 0) / 1e6).toFixed(0)}M → ${((rd1.users ?? 0) / 1e6).toFixed(0)}M users`);
  const d0 = productOffer(s, api, 'FIN');
  api.effort = 'deep';
  const d1 = productOffer(s, api, 'FIN');
  check(near(d1.fit - d0.fit, effortDG(4), 1e-9) && d1.cost > d0.cost, 'S6 effort deep: +0.24 OOM fit and more reasoning tokens per work-hour', `+${(d1.fit - d0.fit).toFixed(3)} OOM, cost ×${(d1.cost / d0.cost).toFixed(2)}`);
}

// ───────── C consumer demand from measured anchors (A2b; research/22 §2–3) ─────────
{
  // C1 reach is a stock that moves toward its target (the best model's consumer-chat coverage), in both directions.
  const s = game();
  run(s, 3);
  const tUS = reachTarget('US', worldMix(s).consumer.US.bestCover);
  s.world.fx.reach.US = 0.2;
  run(s, 1);
  const r1 = s.world.fx.reach.US;
  run(s, 59);
  const r60 = s.world.fx.reach.US;
  const tUS60 = reachTarget('US', worldMix(s).consumer.US.bestCover);
  check(r1 > 0.2 && r1 - 0.2 < 0.02 && r60 > r1 + 0.03 && r60 < tUS60, 'C1 reach below its target rises toward it over months, not at once',
    `0.200 → day 1 ${r1.toFixed(3)} → day 60 ${r60.toFixed(3)} (target ${tUS.toFixed(3)} → ${tUS60.toFixed(3)})`);
  s.world.fx.reach.US = 0.95;
  run(s, 30);
  check(s.world.fx.reach.US < 0.95 && s.world.fx.reach.US > 0.9, 'C1 reach above its target falls slowly', s.world.fx.reach.US.toFixed(3));
  const g0 = game();
  check(Math.abs(g0.world.fx.reach.US - CONSUMER_MKT.reach.startUS) < 1e-12 && Math.abs(g0.world.fx.reach.ROW - CONSUMER_MKT.reach.startUS * CONSUMER_MKT.reach.startRow) < 1e-12,
    'C1 start reach: 46% of US adults weekly (RPS ≈ 50% non-work use in Nov 2025), ROW 0.548 × the US (A6b: the leader starts at ChatGPT’s ≈ 700M weekly users)', `US ${g0.world.fx.reach.US}, ROW ${g0.world.fx.reach.ROW.toFixed(3)}`);
  const u0 = revenueReadout(g0).deps.filter((x) => x.channel === 'consumer').reduce((a, x) => a + (x.users ?? 0), 0);
  check(u0 > 630e6 && u0 < 770e6, 'C1 the leader\'s Chat starts at ≈ 700M weekly users (ChatGPT, Jul 2025, NBER w34255; ±10%)', `${(u0 / 1e6).toFixed(0)}M`);
}
{
  // C2 the paid share is a stock that moves toward its target; C5 a better consumer model raises the paid share.
  const s = game();
  run(s, 3);
  const pi = worldMix(s).providers.findIndex((p) => p.key === 'player');
  const tgt = worldMix(s).consumer.US.paidTarget[pi];
  s.world.fx.paid.US.player = 0.01;
  run(s, 1);
  const p1 = s.world.fx.paid.US.player;
  run(s, 59);
  const p60 = s.world.fx.paid.US.player;
  check(tgt > 0.03 && tgt < 0.12 && p1 > 0.01 && p1 - 0.01 < 0.05 * (tgt - 0.01) && p60 > 0.01 + 0.5 * (tgt - 0.01),
    'C2 the paid share moves toward its target over weeks (τ ≈ 8 weeks), not at once', `0.010 → day 1 ${p1.toFixed(4)} → day 60 ${p60.toFixed(4)} (target ${tgt.toFixed(4)})`);
  const chat = prod(s, 'consumer');
  const v0 = versionById(s, chat.versionId)!;
  const m0 = worldMix(s);
  const a0 = m0.consumer.US.cover[pi];
  const t0 = m0.consumer.US.paidTarget[pi];
  // Same price (same FLOP per token), better model: higher coverage of consumer chat → higher paid-share target.
  const better = cloneVersion(s, v0, 'VC', { build: { ...v0.build!, dg: (v0.build?.dg ?? 0) + 1 } });
  chat.versionId = better.id;
  const m1 = worldMix(s);
  const sub0 = s.world.fx.paid.US.player;
  run(s, 45);
  check(m1.consumer.US.cover[pi] > a0 + 0.05 && m1.consumer.US.paidTarget[pi] > t0 * 1.05 && s.world.fx.paid.US.player > sub0,
    'C5 a better consumer model (same price) raises the paid-share target, and the stock follows',
    `coverage ${a0.toFixed(3)} → ${m1.consumer.US.cover[pi].toFixed(3)}, target ${t0.toFixed(4)} → ${m1.consumer.US.paidTarget[pi].toFixed(4)}, stock ${sub0.toFixed(4)} → ${s.world.fx.paid.US.player.toFixed(4)}`);
  check(paidShareTarget(0.14, 22, 22) > 0.05 && paidShareTarget(0.14, 22, 22) < 0.06 && paidShareTarget(0.14, 11, 22) > paidShareTarget(0.14, 22, 22) && paidShareTarget(1, 22, 22) > paidShareTarget(0.14, 22, 22),
    'C5 paid-share target: ≈5.5% for the start model at the going price (R22: 5–6%); a cheaper plan or a better model converts more',
    `${(paidShareTarget(0.14, 22, 22) * 100).toFixed(2)}% (half price ${(paidShareTarget(0.14, 11, 22) * 100).toFixed(2)}%, full coverage ${(paidShareTarget(1, 22, 22) * 100).toFixed(2)}%)`);
}
{
  // C3 subscribers × price × 12 is the consumer revenue line, independent of work hours.
  const s = game();
  run(s, 20);
  const chat = prod(s, 'consumer');
  const x0 = revenueReadout(s).deps.find((x) => x.id === chat.id)!;
  const line = ((x0.subs ?? 0) * (x0.subPrice ?? 0) * 12) / 1e9;
  for (const row of Object.values(s.world.sectors)) for (const st of Object.values(row)) {
    st.A = 0;
    st.W = 0;
  }
  const x1 = revenueReadout(s).deps.find((x) => x.id === chat.id)!;
  const api1 = revenueReadout(s).deps.find((x) => x.channel === 'api')!;
  check((x0.subs ?? 0) > 1e6 && near(x0.demand, line, 1e-9) && near(x1.demand, x0.demand, 1e-9) && api1.demand < 1e-9,
    'C3 consumer demand = subscribers × price × 12, unchanged when no work-hours use AI (sector demand 0)',
    `${((x0.subs ?? 0) / 1e6).toFixed(1)}M × $${(x0.subPrice ?? 0).toFixed(2)} × 12 = $${line.toFixed(2)}B; without work use $${x1.demand.toFixed(2)}B (API $${api1.demand.toFixed(2)}B)`);
  check(x0.revenue <= x0.demand + 1e-9 && (x0.subs ?? 0) < (x0.users ?? 0) * CONSUMER_MKT.paid.max, 'C3 revenue ≤ the line; subscribers a paid share of the users');
}
{
  // C4 the free users' serving need uses the measured budget (≈ 9k tokens per weekly-user-day), served last.
  const fr = CONSUMER_MKT.perDay.free;
  const s = game();
  run(s, 3);
  const chat = prod(s, 'consumer');
  const x = revenueReadout(s).deps.find((z) => z.id === chat.id)!;
  // A7: on the free tier (its mini, else the cheapest student of its model).
  const ft = chatFreeTier(s, chat)!;
  const want = (((x.users ?? 0) - (x.subs ?? 0)) * h100eHoursPer(ft.fpt, { input: fr.input, output: fr.output * ft.tau }, decodeUtilNow(s))) / 24 * (1 + monitorOverhead(s, chat));
  check(fr.input + fr.output >= 8e3 && fr.input + fr.output <= 1e4 && near(x.needFree ?? 0, want, 1e-6) && near((x.needPaid ?? 0) + (x.needFree ?? 0), x.needH100e, 1e-6),
    'C4 free users need ≈ 9k tokens per weekly-user-day (3.75 messages; R22: 8–10k, was 1.6k) on the free tier model; paid + free = the product\'s need',
    `${((x.users ?? 0) / 1e6).toFixed(0)}M users: free ${Math.round((x.needFree ?? 0) / 1e3)}k + paid ${Math.round((x.needPaid ?? 0) / 1e3)}k H100e; cut ${Math.round(x.cutH100e / 1e3)}k (free ${Math.round((x.cutFree ?? 0) / 1e3)}k)`);
  check((x.cutFree ?? 0) <= (x.needFree ?? 0) + 1e-6 && (x.cutH100e <= (x.needFree ?? 0) + 1e-6 || near(x.cutFree ?? 0, x.needFree ?? 0, 1e-6)), 'C4 the split cuts free users before paying ones');
}
{
  // A7 free tiers with parity: every provider's free tier holds its consumer model's chat fit less one year of the
  // reference frontier (freeTierOf: the cheapestAt rule); users choose on the free tier; the start's free users are
  // served and a free message costs within ≈ 3× of Google's measured 0.24 Wh median (arXiv 2508.15734).
  const s = game();
  run(s, 1);
  const mix = worldMix(s);
  const tokMult = SHAPE[REFERENCE_BASE.shape].tokenMult;
  let bad = 0;
  mix.providers.forEach((p, i) => {
    if (!p.model || p.key === 'player') return;
    const ft = freeTierOf(p.params ?? (p.fpt ?? 2e12) / (2 * tokMult));
    if (!near(mix.consumer.US.freeFit[i], mix.consumer.US.fit[i] - ft.gap, 1e-9) || !(ft.r < 1)) bad++;
  });
  const chat = prod(s, 'consumer');
  const ft = chatFreeTier(s, chat)!;
  const v = versionById(s, chat.versionId)!;
  const pi = mix.providers.findIndex((p) => p.key === 'player');
  const gap = freeTierOf(v.params ?? REFERENCE_BASE.params).gap;
  check(bad === 0 && near(mix.consumer.US.freeFit[pi], mix.consumer.US.fit[pi] - gap, 1e-6) && Math.abs(gap - B_G_PER_Y) < 1e-9,
    'A7 every lab\'s free tier is the student of its consumer model one year of frontier progress below it; users choose on it',
    `gap ${gap.toFixed(2)} OOM, player free fit ${mix.consumer.US.freeFit[pi].toFixed(2)} (model ${mix.consumer.US.fit[pi].toFixed(2)}), ${bad} rivals off the rule`);
  const x = revenueReadout(s).deps.find((z) => z.id === chat.id)!;
  const msgS = (h100eHoursPer(ft.fpt, CONSUMER_MKT.perDay.free, decodeUtilNow(s)) * 3600) / CONSUMER_MKT.messagesPerDay;
  const wh = (msgS * 0.7) / 3.6; // accelerator energy at 0.7 kW per H100e
  check((x.cutFree ?? 0) <= 0.1 * (x.needFree ?? 0) && wh >= 0.24 / 3 && wh <= 0.24 * 3,
    'A7 day 1: free users served (≥ 90%) and a free message within ×3 of 0.24 Wh', `free need ${Math.round((x.needFree ?? 0) / 1e3)}k cut ${Math.round((x.cutFree ?? 0) / 1e3)}k; ${msgS.toFixed(2)} H100e-s ≈ ${wh.toFixed(2)} Wh`);
}
{
  // A8 multi-homing: each provider is in a sector buyer's set with probability min(1, MULTI_HOMING.providers ÷ the
  // region's reachable sector providers) × its access, so a lab whose model alone does the hardest bands wins them only
  // at the firms that buy from it. The start stocks are the day-0 targets (A7's start cap is gone), and the classic
  // leader (3–9 months ahead) holds the measured spread: 0.25 (OpenAI mid-2025) to 0.45 (Anthropic 40% end-2025) of
  // US and ROW sector spend (Menlo Ventures, Jul and Dec 2025).
  const s = game();
  const mix = worldMix(s);
  let bad = 0;
  for (const r of ['US', 'ROW', 'CN'] as const) for (const def of SECTORS) {
    const m = mix.sec[r][def.id];
    m.share.forEach((x, i) => { if (Math.abs(x - m.target[i]) > 2e-6) bad++; });
  }
  const pi = mix.providers.findIndex((p) => p.key === 'player');
  let sp = 0;
  let pl = 0;
  for (const r of ['US', 'ROW'] as const) for (const def of SECTORS) {
    const x = sectorSpendParts(s, r, def.id, mix);
    const y = x.adopted + x.agent + x.seat;
    sp += y;
    pl += y * mix.sec[r][def.id].share[pi];
  }
  // Toy market: provider 0 alone does the upper half of the tasks; four rivals do the lower half.
  const lead: Tier[] = [{ fit: 27.6, a: 0.1, price: 0.6 }];
  const riv: Tier[] = [{ fit: 27.2, a: 0.05, price: 0.5 }];
  const lin = [lead, riv, riv, riv, riv];
  const br = [1, 1, 1, 1, 1];
  const full = surplusChoice(lin, br, [1, 1, 1, 1, 1], 30).target[0];
  const q = Math.min(1, MULTI_HOMING.providers / 5);
  const mh = surplusChoice(lin, br, [q, q, q, q, q], 30).target[0];
  check(bad === 0 && pl / sp >= 0.25 && pl / sp <= 0.45 && full > 0.75 && mh < q + 0.05 && mh > 0.5 * q,
    'A8 multi-homing: start stocks at the day-0 targets; the classic leader holds 0.25–0.45 of US + ROW sector spend; a sole frontier model wins only the buyers who reach it',
    `${bad} cells off; leader ${(pl / sp).toFixed(3)} of $${sp.toFixed(2)}B; toy leader ${full.toFixed(3)} with everyone reachable → ${mh.toFixed(3)} at q ${q.toFixed(2)}`);
  // REACH: the reach target is a rank-ordered logit: each firm contracts with the MULTI_HOMING.providers labs it ranks
  // best among those it can buy from. (1) Σ R* = the providers per firm, so a firm's second contract goes to the next
  // lab however far ahead the first is (Ramp AI Index Oct 2026 [P]: 44.8% of businesses pay Anthropic, 40.6% OpenAI,
  // of 56.8% paying any: both leaders reach ≥ 0.7 of paying firms). (2) Real gaps still count: a lab 1.5 OOM behind
  // (≈ 15 months at B_G_PER_Y) gets almost no contracts. (3) A lab few firms can reach (access 0.05) does not take the
  // other firms' contracts (A8's min(acc, m·w ÷ Σw) gave every other lab ≈ 0 when it led by OOMs).
  const M = MULTI_HOMING.providers;
  const lwOf = (gaps: number[], brand: number[]) => gaps.map((g, i) => Math.log(brand[i]) - SHARE_SLOPE_G * g);
  const one = [1, 1, 1, 1, 1];
  const rStart = reachTargets(lwOf([0, 0.5, 0.45, 0.65, 0.7], [1.2, 1, 1, 1, 1]), one, M);
  const rEven = reachTargets(lwOf([0, 0, 0, 0, 0], one), one, M);
  const rFar = reachTargets(lwOf([0, 0.3, 1.5, 1.5, 1.5], one), one, M);
  const rCn = reachTargets(lwOf([0, 9, 9.2, 9.4, 9.6], one), [0.05, 1, 1, 1, 1], M);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const startUS = mix.reach.US.target.filter((_, i) => !mix.providers[i].open && mix.reach.US.target[i] > 0);
  check(Math.abs(sum(rStart) - M) < 1e-9 && rStart[0] > 0.9 && rStart[0] <= 1 && Math.max(...rStart.slice(1)) > 0.35 && rEven.every((x) => Math.abs(x - M / 5) < 1e-9)
    && rFar[1] > 0.9 && rFar[2] < 0.05 && Math.abs(sum(rCn.slice(1)) - (M - 0.05)) < 1e-9 && rCn[1] > 0.8 && Math.abs(sum(startUS) - M) < 1e-6,
    'REACH: firms contract with the MULTI_HOMING.providers labs they rank best (Σ reach = providers per firm; the next lab gets the second contract; 1.5 OOM behind gets ≈ none; a barely reachable leader does not take the others\' contracts)',
    `leader 0.5 OOM ahead: ${rStart.map((x) => x.toFixed(2)).join(' / ')}; even ${rEven[0].toFixed(2)}; far ${rFar.map((x) => x.toFixed(2)).join(' / ')}; access-0.05 leader ${rCn.map((x) => x.toFixed(2)).join(' / ')}; start US Σ ${sum(startUS).toFixed(3)}`);
  // A8 part 2: ROW firms start paying for AI work at the rate their AI-using workers hold paid seats (REGION_SCALE.ROW
  // A0 = use × SEATS.start ROW ÷ US), so US buyers are 40–72% of the start sector spend outside China (72%: Anthropic's
  // US billing share, an upper bound [UNVERIFIED]); workers' use keeps its scale (ROW / US hours of use ≈ 3.6, the
  // Anthropic Economic Index's Claude.ai split); the leader's day-1 revenue ≈ $12–15B with Chat ≈ two thirds of it.
  let us = 0;
  let row = 0;
  for (const def of SECTORS) {
    const a = sectorSpendParts(s, 'US', def.id, mix);
    const b = sectorSpendParts(s, 'ROW', def.id, mix);
    us += a.adopted + a.agent + a.seat;
    row += b.adopted + b.agent + b.seat;
  }
  const hrs = (r: 'US' | 'ROW') => SECTORS.reduce((x, def) => x + sectorHours(s, r, def.id), 0);
  const hr = hrs('ROW') / hrs('US');
  const a0 = REGION_SCALE.ROW.A0;
  run(s, 1);
  const rd = revenueReadout(s);
  const chatRev = rd.deps.find((z) => z.channel === 'consumer')!.revenue;
  check(us / (us + row) >= 0.4 && us / (us + row) <= 0.72 && hr > 3 && hr < 4.2 && near(a0, (REGION_SCALE.ROW.use * SEATS.start.ROW) / SEATS.start.US, 1e-9) && rd.total >= 12 && rd.total <= 15 && chatRev / rd.total >= 0.6 && chatRev / rd.total <= 0.75,
    'A8 US buyers 40–72% of the start sector spend outside China, ROW / US hours of use ≈ 3.6; leader day-1 revenue $12–15B, Chat 60–75% of it',
    `US $${us.toFixed(2)}B of $${(us + row).toFixed(2)}B (${((100 * us) / (us + row)).toFixed(0)}%); hours ROW / US ${hr.toFixed(2)}; revenue $${rd.total.toFixed(2)}B (Chat $${chatRev.toFixed(2)}B, ${((100 * chatRev) / rd.total).toFixed(0)}%)`);
}
for (const d of [400, 900]) {
  // C6 no provider's subscription is priced above the willingness to pay (unless serving a subscriber costs more).
  const s = fixture(d);
  const mix = worldMix(s);
  let bad = 0;
  let n = 0;
  mix.providers.forEach((p, i) => {
    if (!p.model) return;
    const sp = subPrice(s, p.fpt ?? 2e12, p.markup, tokEff(p.model), p.ud);
    n++;
    if (mix.consumer.US.prices[i] > Math.max(CONSUMER_MKT.wtpMonth, sp.cost) + 1e-9 || mix.consumer.US.prices[i] < sp.cost - 1e-9) bad++;
  });
  const chat = s.player.deployments.find((x) => x.channel === 'consumer' && x.status !== 'withdrawn');
  let prem = 'no Chat';
  if (chat) {
    chat.price = 'premium';
    const x = revenueReadout(s).deps.find((z) => z.id === chat.id)!;
    prem = `premium $${(x.subCost ?? 0).toFixed(2)} → $${(x.subPrice ?? 0).toFixed(2)}`;
    if ((x.subPrice ?? 0) > Math.max(CONSUMER_MKT.wtpMonth, x.subCost ?? 0) + 1e-9) bad++;
  }
  check(n > 0 && bad === 0, `C6 day ${d}: consumer prices ≤ the willingness to pay ($${CONSUMER_MKT.wtpMonth}/month) and ≥ cost, rivals and the player's premium tier too`, `${n} providers; ${prem}`);
  const cu = consumerUse(s, mix);
  console.log(`INFO  C day ${d}: weekly users ${(cu.users / 1e6).toFixed(0)}M (reach US ${(cu.regions.US.reach * 100).toFixed(1)}%, ROW ${(cu.regions.ROW.reach * 100).toFixed(1)}%), subscribers ${(cu.subs / 1e6).toFixed(0)}M (${((cu.subs / Math.max(1, cu.users)) * 100).toFixed(1)}%), spend $${cu.spend.toFixed(1)}B/yr, going price US $${cu.regions.US.going.toFixed(1)}`);
}

// ───────── B who pays for work use, and agent work (A2c; research/22 §3–7) ─────────
{
  // B1 seats ⊆ the workers who use AI; B2 adopted + seated + unseated hours = the hours of use.
  for (const [label, s] of [['start', (() => { const g = game(); run(g, 3); return g; })()], ['day 400', fixture(400)], ['day 900', fixture(900)]] as const) {
    let bad1 = 0;
    let bad2 = 0;
    let seats = 0;
    let workers = 0;
    const mix = worldMix(s);
    for (const r of ['US', 'CN', 'ROW'] as const) for (const sid of Object.keys(s.world.sectors[r]) as SectorId[]) {
      const st = s.world.sectors[r][sid];
      const wh = workHoursOf(st, sid);
      const sold = sectorSpendParts(s, r, sid, mix).seats;
      if (!(st.seat >= 0 && st.seat <= 1) || wh.seats > st.W * st.E * (1 + 1e-12) || sold > wh.seats * (1 + 1e-9)) bad1++;
      if (!near(wh.adopted + wh.seated + wh.unseated, sectorHours(s, r, sid), 1e-9) || !near(wh.use, sectorHours(s, r, sid), 1e-9)) bad2++;
      seats += sold;
      workers += st.W * st.E;
    }
    check(bad1 === 0, `B1 ${label}: paid seats are a subset of the workers who use AI (0 ≤ σ ≤ 1; seats sold ≤ σ·W·E ≤ W·E)`, `${(seats / 1e6).toFixed(0)}M seats sold of ${(workers / 1e6).toFixed(0)}M workers using AI`);
    check(bad2 === 0, `B2 ${label}: adopted (billed per hour) + seated (billed by the seat) + unseated (unbilled) hours = the hours of use`);
  }
  // B3 seat revenue = seats × seat price × 12; the seat price never below the seat's serving cost.
  const s = game();
  run(s, 3);
  const ent = revenueReadout(s).deps.find((x) => x.channel === 'enterprise')!;
  check((ent.seats ?? 0) > 1e6 && near(ent.seatDemand ?? 0, ((ent.seats ?? 0) * (ent.seatPrice ?? 0) * 12) / 1e9, 1e-9) && (ent.seatPrice ?? 0) >= (ent.seatCost ?? 0) && (ent.seatPrice ?? 0) === SEATS.price,
    'B3 Enterprise seat revenue = seats × seat price × 12 (list $25 at the standard tier, ≥ the seat\'s serving cost)',
    `${((ent.seats ?? 0) / 1e6).toFixed(1)}M × $${(ent.seatPrice ?? 0).toFixed(0)} × 12 = $${(ent.seatDemand ?? 0).toFixed(2)}B; serving cost $${(ent.seatCost ?? 0).toFixed(2)}/seat-month`);
  // B4 unseated hours bill no one: more unseated use (W up, no seats) leaves sector spend and the player's need unchanged.
  const u0 = game();
  run(u0, 3);
  for (const row of Object.values(u0.world.sectors)) for (const st of Object.values(row)) st.seat = 0;
  const m0 = revenueReadout(u0);
  const sp0 = m0.marketSpend.US + m0.marketSpend.ROW + m0.marketSpend.CN;
  const need0 = m0.deps.filter((x) => x.channel !== 'consumer').reduce((a, x) => a + x.needH100e, 0);
  const h0 = sectorHours(u0, 'US', 'OFFICE');
  for (const row of Object.values(u0.world.sectors)) for (const st of Object.values(row)) st.W = Math.min(1, st.W * 1.5);
  const m1 = revenueReadout(u0);
  const sp1 = m1.marketSpend.US + m1.marketSpend.ROW + m1.marketSpend.CN;
  const need1 = m1.deps.filter((x) => x.channel !== 'consumer').reduce((a, x) => a + x.needH100e, 0);
  check(sectorHours(u0, 'US', 'OFFICE') > h0 * 1.2 && near(sp1, sp0, 1e-9) && near(need1, need0, 1e-9), 'B4 unseated hours (free, bundled, in-house) are billed by no one and add no sector serving need',
    `OFFICE US hours ${(h0 / 1e9).toFixed(2)}B → ${(sectorHours(u0, 'US', 'OFFICE') / 1e9).toFixed(2)}B; spend $${sp0.toFixed(2)}B → $${sp1.toFixed(2)}B`);
}
{
  // B5 agent leverage λ rises with the horizon and with coverage; k = a·λ.
  const l = (a: number, h50: number) => agentLeverage(a, h50);
  check(l(0.2, 600) > l(0.2, 200) && l(0.5, 600) > l(0.2, 600) && l(1, 1e9) <= 1 / AGENT_WORK.floorH + 1e-9 && l(0.1, 203) > 1 && l(0.1, 203) < 3,
    'B5 agents per supervising hour λ = 1/(c/h80 + ρ(1 − a) + m) rises with the horizon and coverage, capped at 1/m',
    `start-like (a 0.1, h50 203 min) ${l(0.1, 203).toFixed(2)}; h50 10 h ${l(0.1, 600).toFixed(2)}; a 0.5 ${l(0.5, 600).toFixed(2)}; cap ${(1 / AGENT_WORK.floorH).toFixed(0)}`);
  // B6 parallelism and token intensity raise agent-hours and the serving need, not the human hours of use.
  const s = game();
  run(s, 3);
  const api = prod(s, 'enterprise');
  const humans = (g: GameStateV2) => (['US', 'CN', 'ROW'] as const).reduce((a, r) => a + Object.keys(g.world.sectors[r]).reduce((b, sid) => b + sectorHours(g, r, sid as SectorId), 0), 0);
  const x0 = revenueReadout(s).deps.find((x) => x.id === api.id)!;
  const H0 = humans(s);
  s.player.features.push('memory');
  api.features.push('memory'); // horizon ×1.3: longer autonomous stretches → more agents per supervising hour
  const x1 = revenueReadout(s).deps.find((x) => x.id === api.id)!;
  s.player.features.push('deepResearch');
  api.features.push('deepResearch'); // scaffold: × 3 tokens per hour on Science, Finance, Legal
  const x2 = revenueReadout(s).deps.find((x) => x.id === api.id)!;
  check((x1.agentHours ?? 0) > (x0.agentHours ?? 0) * 1.05 && x1.needH100e > x0.needH100e && near(humans(s), H0, 1e-12) && near(x1.adoptedHours ?? 0, x0.adoptedHours ?? 0, 1e-9),
    'B6 a longer horizon (memory ×1.3 h50) raises agent-hours and the serving need, not the human hours of use',
    `agent-hours ${((x0.agentHours ?? 0) / 1e9).toFixed(3)}B → ${((x1.agentHours ?? 0) / 1e9).toFixed(3)}B, need ${Math.round(x0.needH100e / 1e3)}k → ${Math.round(x1.needH100e / 1e3)}k H100e; human hours ${(H0 / 1e9).toFixed(1)}B unchanged`);
  check(x2.needH100e > x1.needH100e && near(humans(s), H0, 1e-12), 'B6 token intensity (deep-research scaffold × tokens) raises the serving need, not the human hours', `need ${Math.round(x1.needH100e / 1e3)}k → ${Math.round(x2.needH100e / 1e3)}k H100e`);
}
for (const d of [400, 900]) {
  // B7 per-hour billing stays cost-plus: every provider's price per agent-hour ≥ its cost (≤ the wage unless serving
  // costs more); the player's per-hour price ≥ its cost per hour; seats ≥ their serving cost.
  const s = fixture(d);
  const mix = worldMix(s);
  const rate = serveDollarsPerHour(s);
  let bad = 0;
  let n = 0;
  for (const r of ['US', 'CN', 'ROW'] as const) for (const [sid, m] of Object.entries(mix.sec[r]) as [SectorId, (typeof mix.sec.US)[SectorId]][]) {
    mix.providers.forEach((p, i) => {
      if (!p.model) return;
      const o = offerOf(s, [{ v: p.model, fpt: p.fpt ?? 2e12, w: 1 }], sid, { markup: p.markup, rate, ud: p.ud }); // D10: the provider's decode utilisation (M5)
      const wage = wagePerHour(sid, r);
      n++;
      // A5: costs are the customers' tier mix (its model and its cheap tiers); k is its model's (the lineup's coverage).
      const T = m.tiers;
      const costAg = T.offers[i].reduce((a, t, k) => a + T.weight[i][k] * t.costAg, 0);
      const seatMin = Math.min(...T.offers[i].map((t) => t.seat));
      if (m.agentPrices[i] < costAg * (1 - 1e-9) || (m.agentPrices[i] > wage * (1 + 1e-9) && m.agentPrices[i] > costAg * (1 + 1e-9)) || (m.seatPrices[i] > 0 && m.seatPrices[i] < seatMin * (1 - 1e-9))) bad++;
      if (!(m.agentK[i] >= 0) || m.agentK[i] > o.k + 1e-12) bad++;
    });
  }
  const rd = revenueReadout(s, mix);
  const playerOk = rd.deps.every((x) => x.channel === 'consumer' || x.hours === 0 || (x.pricePerHour >= x.costPerHour - 1e-9 && (x.seatPrice ?? 0) >= (x.seatCost ?? 0) - 1e-9));
  check(n > 0 && bad === 0 && playerOk, `B7 day ${d}: per-hour billing stays cost-plus (agent-hours ≥ cost, ≤ the wage; seats ≥ serving cost; k after the buyer's gate ≤ k)`,
    rd.deps.filter((x) => x.channel !== 'consumer').map((x) => `${x.channel} $${x.costPerHour.toFixed(2)}→$${x.pricePerHour.toFixed(2)}/h, agent-hours ${((x.agentHours ?? 0) / 1e9).toFixed(2)}B`).join('; '));
  const b = workBilling(s, mix);
  const w = b.world;
  console.log(`INFO  B day ${d}: hours of use ${((w.adopted + w.seated + w.unseated) / 1e9).toFixed(0)}B/yr = adopted ${(w.adopted / 1e9).toFixed(0)}B + seated ${(w.seated / 1e9).toFixed(0)}B + unseated ${(w.unseated / 1e9).toFixed(0)}B; agent-hours ${(w.agent / 1e9).toFixed(0)}B (${(w.agent / Math.max(1, w.supervising)).toFixed(2)} per supervising hour); seats ${(w.seats / 1e6).toFixed(0)}M (player ${(b.playerSeats / 1e6).toFixed(0)}M); spend adopted $${w.spendAdopted.toFixed(0)}B, agents $${w.spendAgent.toFixed(0)}B, seats $${w.spendSeat.toFixed(0)}B; tokens/day ${((w.tokAdopted + w.tokSeated + w.tokAgent + b.consumerTokens) / 1e12).toFixed(0)}T (agents ${(w.tokAgent / 1e12).toFixed(0)}T)`);
}

// ───────── S7 lint ─────────
{
  const files = ['src/engine/v2/worldfx/revenue.ts', 'src/engine/v2/worldfx/mix.ts', 'src/engine/v2/worldfx/serving.ts', 'src/engine/v2/worldfx/sectors.ts', 'src/engine/v2/worldfx/productView.ts', 'src/engine/v2/core/limitsView.ts'];
  const bad: string[] = [];
  for (const f of files) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (/^\s*\*/.test(line)) return;
      if (/\b(serveCost|multiplierRef|bridgeQ|RPH_BASE|thetaPrice|aiCostPerHour)\b/.test(code)) bad.push(`${f}:${i + 1}`);
    });
  }
  check(bad.length === 0, 'S7 lint: revenue, prices, costs and sectors read no serveCost, multiplierRef / bridgeQ (the M bridge) or v2 price stand-ins', bad.join(', '));
}

/** A5: the world's adopted task-hours by the kind of tier they are bought on (customer stocks × each provider's tier mix). */
function hoursByKind(s: GameStateV2, mix: WorldMix): Record<TierKind, number> {
  const out: Record<TierKind, number> = { model: 0, mini: 0, student: 0 };
  let tot = 0;
  for (const r of ['US', 'CN', 'ROW'] as const) for (const def of SECTORS) {
    const m = mix.sec[r][def.id];
    const h = workHoursOf(s.world.sectors[r][def.id], def.id).adopted;
    m.share.forEach((x, i) => m.tiers.weight[i].forEach((w, k) => {
      out[m.tiers.kind[i][k]] += h * x * w;
      tot += h * x * w;
    }));
  }
  for (const k of Object.keys(out) as TierKind[]) out[k] /= tot || 1;
  return out;
}

// ───────── A1–A3 price of a fixed capability (task A3; research/20 D3: Cottier et al. 2025 ×10/yr, ×9–×900) ─────────
// The fixed-capability price is the price of the cheapest model the lab could serve at V0's capability (cheapestAt: one
// of its versions, or a student distilled to hold the level under the game's distillation rule), at the standard
// markup, per task (an agentic work-hour) and per million blended tokens. Per task it decomposes exactly into factors
// (× per year; their product is the decline): active parameters, serving FLOP per active parameter (shape, the serving
// stack's FLOP part), the serving stack's utilisation, tokens per task (the model's reasoning tokens, D10), $ per
// H100e-hour (rental), margin. Per token = per task ÷ the fall in tokens per task (Cottier et al. measure per token).
{
  // A1 the cheapest-at-G model is a run the lab can launch: planRun's distillation gap for that student = fit − G
  const s = game();
  const v0 = s.player.models.versions[0];
  const g0 = workFit(s, v0, 'SWE').fit;
  const at0 = cheapestAt(s, g0)!;
  const lower = cheapestAt(s, g0 - 0.5)!;
  const plan = planRun(s, { kind: 'distill', teacherVersionId: v0.id, studentParams: lower.params });
  check(at0.versionId === v0.id && !at0.student && near(at0.fpt, flopPerToken(s, v0)) && cheapestAt(s, g0 + 0.01) === undefined,
    'A1 at the start the cheapest model at V0\'s capability is V0 itself (no version above it to distil from; nothing holds a higher level)', `${(at0.params / 1e9).toFixed(0)}B active`);
  check(lower.student && near(lower.gap, 0.5, 1e-9) && near(plan.g.gap ?? -1, lower.gap, 1e-9) && near(lower.fpt / flopPerToken(s, v0), lower.params / at0.params),
    'A1 0.5 OOM below V0 the cheapest model is a student of V0 sized so the distillation gap is exactly 0.5 OOM (the gap planRun gives that student); FLOP per token ∝ its active parameters',
    `${(lower.params / 1e9).toFixed(0)}B active (δ = ${DISTILL.a} + ${DISTILL.b}·log₁₀ ${(at0.params / lower.params).toFixed(2)})`);
}
{
  const s = game();
  const START = '2025-07-01';
  const marks = ['2025-08-01', '2026-02-01', '2026-08-01', '2027-02-01'].map((x) => dayOfDate(START, x));
  const rows: string[] = [];
  const fixedG = workFit(s, s.player.models.versions[0], 'SWE').fit; // V0's capability, held fixed
  const tok = TOKENS.agentic;
  // D10: per task (one agentic work-hour: uncached input and τ × output tokens at the lab's decode utilisation), and per
  // million blended tokens of that task (price per task ÷ its tokens).
  const secPerFlop = (tau: number, ud: number) => tok.input / U_PREFILL + (tok.output * tau) / ud; // peak-seconds per FLOP per task
  const perTask = (fpt: number, tau: number, ud: number, markup: number) => h100eHoursPer(fpt, { input: tok.input, output: tok.output * tau }, ud) * serveDollarsPerHour(s) * markup;
  const perM = (fpt: number, tau: number, ud: number, markup: number) => (perTask(fpt, tau, ud, markup) / (tok.input + tok.output * tau)) * 1e6;
  type Snap = { t: number; N: number; fpp: number; tau: number; ud: number; rate: number; markup: number; task: number; price: number; serve: number; rivalServe: number };
  const snaps: Snap[] = [];
  // A5: what customers actually pay for V0's capability in the market (US Software & IT: the hardest band of tasks V0
  // does whole, at the customer stocks), per M FLOP-bearing tokens of the sector's adopted-hour profile; `edge` is the
  // band containing V0's coverage (it includes tasks V0 cannot do).
  const u0 = offerOf(s, [{ v: s.player.models.versions[0], fpt: flopPerToken(s, s.player.models.versions[0]), w: 1 }], 'SOFT', { markup: MARKUP.standard, rate: serveDollarsPerHour(s) }).a;
  type Paid = { t: number; perM: number; below: number; own: number; rate: number; margin: number; hphM: number; kind: Record<TierKind, number>; world: Record<TierKind, number>; prov: Record<string, number> };
  const paid: Paid[] = [];
  while (s.time.day <= marks[marks.length - 1]) {
    for (const p of [...s.events.pending]) {
      const c = refBot.decide(s, p);
      if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    refBot.act(s, engine);
    tick(s, { skip: ['endings'] });
    if (marks.includes(s.time.day)) {
      const api = prod(s, 'api');
      const v = versionById(s, api.versionId)!;
      const c = cheapestAt(s, fixedG)!;
      const teacher = versionById(s, c.versionId)!;
      const tau = tokEff(teacher); // a student reasons like its teacher (it learns from its traces)
      const ud = decodeUtilNow(s);
      const rivals = [...s.rivals, s.china.lab].filter((r) => r.core.status === 'active');
      const snap: Snap = {
        t: decimalYear(s), N: c.params, fpp: c.fpt / c.params, tau, ud, rate: serveDollarsPerHour(s), markup: MARKUP.standard,
        task: perTask(c.fpt, tau, ud, MARKUP.standard), price: perM(c.fpt, tau, ud, MARKUP.standard), serve: serveNow(s),
        rivalServe: rivals.reduce((x, r) => x + r.phys.serve, 0) / Math.max(1, rivals.length),
      };
      snaps.push(snap);
      const mix = worldMix(s);
      const tk = adoptedTokens(s, 'SOFT');
      const perTok = 1e6 / (tk.input + tk.output);
      const bp = bandPaid(mix, 'US', 'SOFT', u0, true, true);
      paid.push({
        t: snap.t, perM: bp.price * perTok, below: bandPaid(mix, 'US', 'SOFT', u0).price * perTok, own: bp.ownModelPrice * perTok, rate: snap.rate,
        margin: bp.price / (snap.rate * bp.hph), hphM: bp.hph * perTok, kind: bp.byKind, world: hoursByKind(s, mix), prov: bp.byProvider,
      });
      rows.push(`${snap.t.toFixed(2)}: API ${v.name} ${(paramsOfVersion(s, v) / 1e9).toFixed(0)}B $${perM(flopPerToken(s, v), tokEff(v), ud, MARKUP.standard).toFixed(2)}/M; V0-level cheapest ${c.student ? `student of ${teacher.name} (fit +${(c.teacherFit - fixedG).toFixed(2)}, δ ${c.gap.toFixed(2)})` : teacher.name} ${(c.params / 1e9).toFixed(1)}B $${snap.price.toFixed(3)}/M, $${snap.task.toFixed(3)}/task (τ ${tau.toFixed(3)}); serving stack ${snap.serve.toFixed(3)} OOM (U_decode ${ud.toFixed(3)}), rivals' mean ${snap.rivalServe.toFixed(3)}; rental $${snap.rate.toFixed(2)}/H100e-h`);
    }
  }
  const a = snaps[0];
  const b = snaps[snaps.length - 1];
  const yrs = b.t - a.t;
  const py = (x: number) => Math.pow(x, 1 / yrs);
  // Serving stack (utilisation) at the start's reasoning tokens, then tokens per task at the end's utilisation: exact.
  const f = {
    params: py(a.N / b.N), fpp: py(a.fpp / b.fpp), util: py(secPerFlop(a.tau, a.ud) / secPerFlop(a.tau, b.ud)), tokens: py(secPerFlop(a.tau, b.ud) / secPerFlop(b.tau, b.ud)),
    hardware: py(a.rate / b.rate), margin: py(a.markup / b.markup),
  };
  const total = py(a.task / b.task);
  const prod6 = f.params * f.fpp * f.util * f.tokens * f.hardware * f.margin;
  const perTok = py(a.price / b.price);
  const tokCount = py((tok.input + tok.output * a.tau) / (tok.input + tok.output * b.tau));
  const fmt = (x: number) => `×${x.toFixed(2)}`;
  console.log(`INFO  A3 price of V0's capability (standard markup; per agentic task and per M blended tokens):\n      ${rows.join('\n      ')}`);
  check(near(prod6, total, 1e-9) && near(perTok * tokCount, total, 1e-9),
    'A3 the fixed-capability decline per task = active parameters × FLOP per parameter × serving stack (utilisation) × tokens per task × $ per H100e-hour × margin (exact); per token = per task ÷ tokens per task',
    `params ${fmt(f.params)}, FLOP/param (shape, serving-stack FLOP part) ${fmt(f.fpp)}, serving stack (decode utilisation ${a.ud.toFixed(3)} → ${b.ud.toFixed(3)}) ${fmt(f.util)}, tokens per task (τ ${a.tau.toFixed(3)} → ${b.tau.toFixed(3)}; H100e-time) ${fmt(f.tokens)}, hardware (rental) ${fmt(f.hardware)}, margin ${fmt(f.margin)} → ${fmt(total)}/yr per task; per token ${fmt(perTok)}/yr (token count per task ${fmt(tokCount)}/yr)`);
  // Band ×6–×900 (M9 re-baseline, lead decision): the ceiling was ×30; it is now the sourced range's top. Cottier,
  // Snodin, Owen & Adamczewski (Epoch AI, Mar 2025; research/20 D3) measure price-for-fixed-capability declines of ×9 to
  // ×900 a year depending on the capability threshold (GPT-4-level GPQA ≈ ×40/yr). F4's ai2027 refit (sd_SC 0.5 → 1.25)
  // puts seed 2027's Feb-2027 teacher 2.62 OOM above V0's fit, so the cheapest V0-level student is a 2.7B model and the
  // decline is ×44.8/yr: inside the measured range, outside the old ×30 ceiling. The floor ×6 is kept (below Epoch's ×9 to
  // allow the slower conservative estimates, ×5–10/yr, research/12 §0.6).
  check(total >= 6 && total <= 900 && perTok >= 6 && perTok <= 900,
    'A3 the price of a fixed capability (V0\'s) falls ×6–×900 a year per task and per token (R20 D3: ≈ ×10, ×9–×900; Cottier et al. 2025)',
    `${fmt(total)}/yr per task, ${fmt(perTok)}/yr per token over ${a.t.toFixed(2)}–${b.t.toFixed(2)}`);
  // V1 (D10): the reference lab's serving stack grows by mechanism (its Inference-efficiency line: adopted ideas in the
  // serve stack), and so does the rivals' aggregate one (RivalPhys.serve from their research speed).
  const nServe = s.player.research.stacks.serve.n;
  const yr1 = snaps.find((x) => x.t >= a.t + 0.95) ?? b;
  check(b.serve > a.serve + 0.05 && nServe > 0 && (s.player.research.want['L.infer'] ?? 0) >= 1 && b.rivalServe > a.rivalServe + 0.05,
    'V1 the reference lab\'s serving stack grows by its Inference-efficiency line (RefBot ranks it), the rivals\' with their aggregate research',
    `RefBot ${a.serve.toFixed(3)} → ${b.serve.toFixed(3)} OOM over ${yrs.toFixed(2)} y (${nServe} ideas adopted; first year ${(yr1.serve - a.serve).toFixed(3)}), decode utilisation ${a.ud.toFixed(3)} → ${b.ud.toFixed(3)}; rivals' mean ${a.rivalServe.toFixed(3)} → ${b.rivalServe.toFixed(3)} OOM (SERVE_RATE0 ${SERVE_RATE0}/yr at rs 1)`);
  check(b.tau < a.tau - 0.05,
    'V3 the tokens per task of V0\'s capability fall in the reference run (the cheapest model\'s teacher has a better RL recipe)',
    `τ ${a.tau.toFixed(3)} → ${b.tau.toFixed(3)}: per task ×${(secPerFlop(a.tau, b.ud) / secPerFlop(b.tau, b.ud)).toFixed(2)} of H100e-time at fixed utilisation`)
  // A5 E9: the market-weighted price customers pay for V0's capability, decomposed exactly into the rental, the margin
  // and the H100e-hours per M tokens of the models they buy (model size × utilisation); the tier shift is the gap to
  // what the same customers would pay on the providers' own models.
  const pa = paid[0];
  const pb = paid[paid.length - 1];
  const pTot = py(pa.perM / pb.perM);
  const pf = { hardware: py(pa.rate / pb.rate), margin: py(pa.margin / pb.margin), models: py(pa.hphM / pb.hphM) };
  const pct = (o: Record<string, number>) => Object.entries(o).filter(([, x]) => x > 0.005).map(([k, x]) => `${k} ${(x * 100).toFixed(0)}%`).join(' ');
  console.log(`INFO  A5 price customers pay for V0's capability (US Software & IT, the hardest band V0 (coverage ${u0.toFixed(3)}) does whole; per M tokens):\n      ${paid.map((x) => `${x.t.toFixed(2)}: $${x.perM.toFixed(3)}/M (band at its coverage edge $${x.below.toFixed(3)}; on the providers' own models $${x.own.toFixed(3)}); band hours by tier ${pct(x.kind)}; by provider ${pct(x.prov)}; all adopted hours (world) by tier ${pct(x.world)}`).join('\n      ')}`);
  // M10 (lead decision after MKT): the decline's size is INFO, not binding. The ×6–×30 band came from Cottier et al.
  // (Epoch AI, Mar 2025; research/20 D3), which prices the CHEAPEST model on sale above a capability threshold: that is
  // A3's instrument, and A3 binds above. The market-weighted price customers actually pay is a different quantity with
  // no sourced band; the one primary source on it (OpenRouter / a16z 100T-token study, arXiv 2601.10088 §8: demand
  // "relatively price-inelastic", closed models keep high-value tasks) says it lags the cheapest offer, as the game's
  // does (design/V3-BUILD.md "MKT notes": 20-seed median ×4.33 [×3.56–6.18] vs ×18.9 cheapest). The exact
  // decomposition stays a binding check. TIERS (design/notes/TIERS.md): every provider sells a four-tier lineup (20-seed
  // median ×4.50 → ×4.10: the player's lineup raises it, rivals' coarser lineups, replacing a student per band edge,
  // lower it).
  check(near(pf.hardware * pf.margin * pf.models, pTot, 1e-9),
    'A5 E9 the price customers actually pay for V0\'s capability (market-weighted) = rental × margin × model H100e-hours per token bought (exact decomposition)',
    `${fmt(pTot)}/yr = hardware ${fmt(pf.hardware)} × margin ${fmt(pf.margin)} × models bought ${fmt(pf.models)}`);
  console.log(`INFO  A5 E9 price customers pay for V0's capability (market-weighted; no sourced band since M10: Cottier's ×6–×30 is the cheapest-offer measure, checked by A3): ${fmt(pTot)}/yr over ${pa.t.toFixed(2)}–${pb.t.toFixed(2)}: hardware ${fmt(pf.hardware)}, margin ${fmt(pf.margin)}, models bought ${fmt(pf.models)}; band at V0's coverage edge ${fmt(py(pa.below / pb.below))}/yr; on own models only ${fmt(py(pa.own / pb.own))}/yr; cheap tiers ${((pb.kind.mini + pb.kind.student) * 100).toFixed(0)}% of the band's hours at the end (${((pa.kind.mini + pa.kind.student) * 100).toFixed(0)}% at the start)`);
}

// ───────── V2–V4 serving-efficiency ideas and tokens per task (task D10; research/20 D1–D3) ─────────
{
  // V2 decode utilisation and new versions' FLOP per token follow the serving stack at the stated sizes.
  const s = game();
  const v0 = s.player.models.versions[0];
  const rate = serveDollarsPerHour(s);
  const off = () => productOffer(s, prod(s, 'api'), 'SOFT');
  const cost0 = off().hph;
  const tk = adoptedTokens(s, 'SOFT');
  const at = (ud: number) => tk.input / U_PREFILL + (tk.output * tokEff(v0)) / ud;
  const sizes = near(SERVE_U_OOM, Math.log10(U_DECODE_MAX / U_DECODE)) && near(decodeUtilOf(0.2), U_DECODE * Math.pow(10, 0.2)) && near(decodeUtilOf(1), U_DECODE_MAX)
    && decodeUtilOf(0) === U_DECODE && serveFlopOomOf(0.2) === 0 && near(serveFlopOomOf(0.5), 0.5 - SERVE_U_OOM) && serveFlopOomOf(30) === SERVE_FLOP_MAX;
  addPublic(s.player.research.stacks.serve, 0.2);
  const ud1 = decodeUtilNow(s);
  const cost1 = off().hph;
  const tm1 = serveTechMult(s);
  addPublic(s.player.research.stacks.serve, 0.3);
  const ud2 = decodeUtilNow(s);
  const cost2 = off().hph;
  const tm2 = serveTechMult(s);
  const internal = near(h100eHoursPerWorkHour(agentFpt(s, v0)), (flopPerToken(s, v0) * (TOKENS_PER_WORK_HOUR.input / U_PREFILL + TOKENS_PER_WORK_HOUR.output / ud2)) / 1e15 / 3600, 1e-9);
  check(sizes && near(ud1, 0.07 * Math.pow(10, 0.2)) && near(cost1 / cost0, at(ud1) / at(U_DECODE), 1e-6) && tm1 === 1
    && near(ud2, U_DECODE_MAX) && near(cost2 / cost0, at(U_DECODE_MAX) / at(U_DECODE), 1e-6) && near(tm2, Math.pow(10, -(0.5 - SERVE_U_OOM))) && internal,
    'V2 the serving stack\'s first 0.33 OOM raise decode utilisation 0.07 → 0.15 for every model the lab serves (products and internal agents); beyond it new versions\' FLOP per token fall 10^−(rest)',
    `stack 0.2: U_decode ${ud1.toFixed(4)}, API cost per hour ×${(cost1 / cost0).toFixed(3)}, new versions' FLOP ×${tm1.toFixed(3)}; stack 0.5: U_decode ${ud2.toFixed(3)} (cap), cost ×${(cost2 / cost0).toFixed(3)}, new versions' FLOP ×${tm2.toFixed(3)}`);
  void rate;
}
{
  // V3 a model's reasoning tokens fall with its RL recipe at fixed capability, and not with the calendar alone.
  const s = game();
  const v0 = s.player.models.versions[0];
  const rate = serveDollarsPerHour(s);
  const b0 = v0.build!;
  const better = cloneVersion(s, v0, 'VR', {});
  better.build = { ...JSON.parse(JSON.stringify(b0)), eRL: b0.eRL + 0.3, aRL: (b0.aRL ?? 0) + 0.1 };
  const g = rlGOfBuild(better.build!);
  const tau = tokEff(better);
  const fit0 = workFit(s, v0, 'SWE').fit;
  const fit1 = workFit(s, better, 'SWE').fit;
  const o = (v: ModelVersion, effort = 1) => offerOf(s, [{ v, fpt: flopPerToken(s, v), w: 1 }], 'SOFT', { markup: MARKUP.standard, rate, effort });
  const tk = adoptedTokens(s, 'SOFT');
  const exp = (tk.input / U_PREFILL + (tk.output * tau) / U_DECODE) / (tk.input / U_PREFILL + tk.output / U_DECODE);
  check(g > 0 && near(tau, Math.max(TOK_MIN, Math.pow(10, -TOK_PER_RL_OOM * g))) && tokEff(v0) === 1 && near(fit1, fit0, 1e-12) && near(o(better).hph / o(v0).hph, exp, 1e-9)
    && near(o(better).hphAg / o(v0).hphAg, (TOKENS.autonomous.input / U_PREFILL + (TOKENS.autonomous.output * tau) / U_DECODE) / (TOKENS.autonomous.input / U_PREFILL + TOKENS.autonomous.output / U_DECODE), 1e-9),
    'V3 at the same fit a version with a better RL recipe needs fewer reasoning tokens for the same work: τ = 10^(−1·its RL G-equivalent) on output tokens (adopted, agent and seat profiles)',
    `RL G-equivalent +${g.toFixed(3)} OOM → τ ${tau.toFixed(3)}, cost per adopted hour ×${(o(better).hph / o(v0).hph).toFixed(3)}, fit ${fit0.toFixed(3)} = ${fit1.toFixed(3)}`);
  // effort multiplies the τ-scaled reasoning tokens; its fit gain is unchanged
  const deep = o(better, 4);
  const expDeep = (tk.input / U_PREFILL + (tk.output * tau * 4) / U_DECODE) / (tk.input / U_PREFILL + (tk.output * 4) / U_DECODE);
  check(near(deep.hph / o(v0, 4).hph, expDeep, 1e-9) && near(deep.fit - o(better).fit, effortDG(4), 1e-9),
    'V3 effort levels stay consistent: effort multiplies the model\'s τ-scaled reasoning tokens and keeps its fit gain (R20 C3)', `deep ×4: cost ×${(deep.hph / o(v0, 4).hph).toFixed(3)} vs V0 deep, +${(deep.fit - o(better).fit).toFixed(3)} OOM`);
  // the calendar alone: the same versions 200 days later (passive) keep their τ
  const tBefore = [tokEff(v0), tokEff(better)];
  run(s, 200);
  check(tokEff(v0) === tBefore[0] && tokEff(better) === tBefore[1], 'V3 not with the calendar: the same versions keep their reasoning tokens 200 days later (τ is a property of the RL recipe they were trained with)',
    `τ ${tBefore.map((x) => x.toFixed(3)).join(', ')} at day 0 and ${[tokEff(v0), tokEff(better)].map((x) => x.toFixed(3)).join(', ')} at day ${s.time.day}`);
  // a distilled student of the better version reasons like its teacher; the floor
  const student = cloneVersion(s, better, 'VS', { variant: 'mini' });
  check(tokEff(student) === tau && tokEff({ rlG: 0.5 }) === Math.pow(10, -0.5) && tokEff({ rlG: 5 }) === TOK_MIN && tokEff({ rlG: -0.2 }) === 1,
    'V3 a student keeps its teacher\'s reasoning tokens; rivals\' models by the RL part of their G; at most ×0.1; a recipe below the day-0 one keeps the 2025 profiles', `rlG 0.5 → ${tokEff({ rlG: 0.5 }).toFixed(3)}`);
}
{
  // V4 rivals: serving stack from their research, their offers at their utilisation and FLOP part, the consumer chat
  // price and need on τ and utilisation (fixture day 400).
  const s = fixture(400);
  run(s, 30); // a month of rival research on the migrated fixture (serving stacks start at 0)
  const mix = worldMix(s);
  let bad = 0;
  let n = 0;
  for (const p of mix.providers) {
    if (p.lab === 'player' || !p.model) continue;
    const r = p.lab === 'china' ? s.china.lab : s.rivals.find((x) => x.core.id === p.lab)!;
    n++;
    if (!(p.ud === rivalDecodeU(r) && p.fpt === rivalServeFpt(r, p.model as never) && p.ud >= U_DECODE)) bad++;
  }
  const r0 = s.rivals[0];
  const ok = near(agentFptEq(2e12, 0.5, 0.1) / 2e12, (TOKENS_PER_WORK_HOUR.input / U_PREFILL + (TOKENS_PER_WORK_HOUR.output * 0.5) / 0.1) / (TOKENS_PER_WORK_HOUR.input / U_PREFILL + TOKENS_PER_WORK_HOUR.output / U_DECODE));
  check(n > 0 && bad === 0 && ok, 'V4 rivals and China serve at their own decode utilisation and serving-stack FLOP part (RivalPhys.serve), their internal agents too (agentFptEq)',
    `${n} providers; ${r0.core.id} serving stack ${r0.phys.serve.toFixed(3)} OOM, U_decode ${rivalDecodeU(r0).toFixed(3)}, rlG ${(r0.internal.rlG ?? 0).toFixed(3)} → τ ${tokEff(r0.internal).toFixed(3)}`);
}

// ───────── D1–D5 demand ceiling on agent work (task A4; research/16 §1A.2 step 7: E = E0·(1 − D)(1 + η·CR)) ─────────
// AI work in a sector and region (adopted task-hours + agent-hours) ≤ its work demand H* = E0·2000·(1 + η·CR), CR =
// 1 − c̄/wage at the current buyer's cost of AI work; spend on it ≤ H* × wage. Agent-hours fill what is left.
type CellRead = { cells: number; bound: number; worstHours: number; worstSpend: number; bad: string[] };
function ceilingCells(s: GameStateV2): CellRead {
  const mix = worldMix(s);
  const rd = revenueReadout(s, mix);
  const pi = mix.providers.findIndex((p) => p.key === 'player');
  const out: CellRead = { cells: 0, bound: 0, worstHours: 0, worstSpend: 0, bad: [] };
  for (const r of ['US', 'CN', 'ROW'] as const) for (const def of SECTORS) {
    const st = s.world.sectors[r][def.id];
    const m = mix.sec[r][def.id];
    const c = m.agentCeiling;
    const p = sectorSpendParts(s, r, def.id, mix);
    const wh = workHoursOf(st, def.id);
    const bill = (st.E0 * ECON.hours * wagePerHour(def.id, r)) / 1e9;
    // the player's agent-hours as its products bill them (revenue.ts) in place of its share of the mix's view
    const mixPlayer = pi >= 0 ? wh.supervising * m.share[pi] * m.agentK[pi] : 0;
    const billed = p.agentHours - mixPlayer + (rd.playerAgent[r][def.id] ?? 0);
    if (billed + wh.adopted > c.hours * (1 + 1e-9)) out.bad.push(`${r}/${def.id} player-billed hours ${((billed + wh.adopted) / c.hours).toFixed(3)} of the ceiling`);
    const hr = (wh.adopted + Math.max(p.agentHours, billed)) / c.hours;
    const sr = p.agent / (bill * c.expansion);
    out.cells++;
    if (c.bound !== 'none') out.bound++;
    out.worstHours = Math.max(out.worstHours, hr);
    out.worstSpend = Math.max(out.worstSpend, sr);
    const okX = c.expansion >= 1 && c.expansion <= 1 + def.eta + 1e-12 && near(c.hours, st.E0 * ECON.hours * c.expansion, 1e-12);
    // agent spend ≤ what the value of the work leaves after the adopted hours' spend
    const room = Math.max(0, bill * c.expansion - p.adopted);
    if (!okX || hr > 1 + 1e-9 || sr > 1 + 1e-9 || p.agent > room * (1 + 1e-9) + 1e-9) out.bad.push(`${r}/${def.id} hours ${hr.toFixed(3)} spend ${sr.toFixed(3)} X ${c.expansion.toFixed(3)}`);
  }
  return out;
}
const cellNote = (c: CellRead) => `${c.bound}/${c.cells} cells bound; worst (adopted + agent) ÷ ceiling ${c.worstHours.toFixed(3)}, agent spend ÷ (wage bill × X) ${c.worstSpend.toFixed(3)}`;
for (const d of [400, 900]) {
  // D1 on the fixtures: hours and spend under the ceiling in every sector and region.
  const s = fixture(d);
  const c = ceilingCells(s);
  check(c.bad.length === 0, `D1 day ${d}: in every sector and region adopted + agent-hours ≤ the work demand E0·2000·(1 + η·CR) and agent spend ≤ the wage bill × (1 + η·CR) ≤ × (1 + η)`, c.bad.length ? c.bad.slice(0, 4).join('; ') : cellNote(c));
  const b = workBilling(s).world;
  console.log(`INFO  D day ${d}: agent-hours ${(b.agent / 1e9).toFixed(1)}B bought of ${(b.agentWanted / 1e9).toFixed(1)}B wanted (${(b.agent / Math.max(1, b.supervising)).toFixed(2)} per supervising hour), ${b.bound} cells at the ceiling; agent spend $${b.spendAgent.toFixed(0)}B`);
}
{
  // D2 a takeoff run: RefBot to day 1200 on ai2027 and fast; every 20 days every cell stays under the ceiling.
  for (const world of ['ai2027', 'fast'] as const) {
    const s = newGame(defaultSetupV2({ seed: 2027, world, alignment: 'medium', baseline: 'classic', tutorial: false }));
    const bad: string[] = [];
    let worst = { hours: 0, spend: 0 };
    let maxBound = 0;
    let at1200 = '';
    while (s.time.day < 1200 && !s.ending) {
      for (const p of [...s.events.pending]) if (resolve(s, p.instance, refBot.decide(s, p))) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
      refBot.act(s, engine);
      tick(s, { skip: ['endings'] });
      if (s.time.day % 20 !== 0 && s.time.day !== 1200) continue;
      const c = ceilingCells(s);
      bad.push(...c.bad.map((x) => `day ${s.time.day} ${x}`));
      worst = { hours: Math.max(worst.hours, c.worstHours), spend: Math.max(worst.spend, c.worstSpend) };
      maxBound = Math.max(maxBound, c.bound);
      if (s.time.day === 1200) {
        const w = workBilling(s).world;
        at1200 = `day 1200: agent-hours ${(w.agent / 1e9).toFixed(0)}B of ${(w.agentWanted / 1e9).toFixed(0)}B wanted (${(w.agent / Math.max(1, w.supervising)).toFixed(1)} per supervising hour), agent spend $${w.spendAgent.toFixed(0)}B`;
      }
    }
    check(bad.length === 0 && s.time.day >= 1200, `D2 takeoff (RefBot, ${world}, to day 1200): agent-hours and agent spend stay under the sector ceiling in every sector, region and checkpoint`,
      bad.length ? bad.slice(0, 4).join('; ') : `up to ${maxBound}/42 cells bound; worst hours ÷ ceiling ${worst.hours.toFixed(3)}, agent spend ÷ (wage bill × X) ${worst.spend.toFixed(3)}; ${at1200}`);
  }
}
{
  // D3 below the ceiling nothing changes: at the start and on the day-400 fixture no cell binds, and every provider's agent-
  // hours per supervising hour is exactly its A2c value (k after the buyer's gate, no ceiling factor).
  for (const [label, s] of [['day 1', (() => { const g = game(); run(g, 1); return g; })()], ['day 400', fixture(400)]] as const) {
    const mix = worldMix(s);
    const rate = serveDollarsPerHour(s);
    let bound = 0;
    let diff = 0;
    let n = 0;
    for (const r of ['US', 'CN', 'ROW'] as const) for (const def of SECTORS) {
      const m = mix.sec[r][def.id];
      if (m.agentCeiling.bound !== 'none' || m.agentCeiling.fill !== 1) bound++;
      mix.providers.forEach((p, i) => {
        if (!p.model) return;
        const o = offerOf(s, [{ v: p.model, fpt: p.fpt ?? 2e12, w: 1 }], def.id, { markup: p.markup, rate });
        // A5: the agent price and cost are the customers' tier mix; k and λ its model's.
        const T = m.tiers;
        let priceAg = 0;
        let costAg = 0;
        T.offers[i].forEach((t, k) => {
          if (T.weight[i][k] > 0) {
            priceAg += T.weight[i][k] * t.priceAg;
            costAg += T.weight[i][k] * t.costAg;
          }
        });
        n++;
        if (m.agentK[i] !== agentDemandOf({ k: o.k, lam: o.lam, priceAg, costAg }, wagePerHour(def.id, r)).k) diff++;
      });
    }
    check(bound === 0 && n > 0 && diff === 0, `D3 ${label}: below the ceiling nothing changes (no cell binds; every provider's agent-hours per supervising hour is bit-identical to the A2c rule on its customers' tier mix)`, `${n} provider offers, ${diff} differ, ${bound} cells bound`);
  }
}
{
  // D4 the ceiling rises with η and with a falling price of AI work; at a buyer's cost ≥ the wage there is no expansion.
  const def = SECTORS.find((x) => x.id === 'SCI')!;
  const H0 = 1e9;
  const wage = 60;
  const at = (eta: number, cost: number) => agentCeilingOf({ ...def, eta }, H0, wage, 0.1 * H0, 0.1 * H0 * 30, cost, 2 * H0, 2 * H0 * 30, cost);
  const base = at(0.5, 30);
  check(at(1, 30).hours > base.hours && at(0.5, 10).hours > base.hours && at(1, 30).fill > base.fill && at(0.5, 10).fill > base.fill
    && near(at(0.5, 60).hours, H0) && near(at(1, 90).hours, H0) && near(at(0.5, 0).expansion, 1.5),
    'D4 the ceiling H0·(1 + η·(1 − c̄/wage)) rises with η and as the price of AI work falls (≤ H0·(1 + η)); no expansion at a cost ≥ the wage',
    `η 0.5 at half the wage ×${base.expansion.toFixed(3)} (fill ${base.fill.toFixed(3)}), η 1 ×${at(1, 30).expansion.toFixed(3)}, a sixth of the wage ×${at(0.5, 10).expansion.toFixed(3)}, at the wage ×${at(0.5, 60).expansion.toFixed(3)}`);
  const v = agentCeilingOf(def, H0, wage, 0.1 * H0, 0.1 * H0 * 60, 30, 0.5 * H0, 0.5 * H0 * 200, 200);
  check(v.bound === 'value' && near((0.1 * H0 * 60 + v.fill * 0.5 * H0 * 200) / 1e9, v.value, 1e-9), 'D4 agent-hours priced above the wage stop where spend on AI work reaches the value of the work (H* × wage)', `fill ${v.fill.toFixed(3)}`);
}
{
  // D5 agent capacity beyond the ceiling is not bought: no revenue and no serving need (it stays in the lab's spare
  // serving). Day-900 fixture: the player's agent-hours and need with the ceiling vs with it lifted.
  const s = fixture(900);
  const mix = worldMix(s);
  const rd = revenueReadout(s, mix);
  for (const r of ['US', 'CN', 'ROW'] as const) for (const def of SECTORS) {
    const m = mix.sec[r][def.id];
    const f = m.agentCeiling.fill;
    if (f < 1 && f > 0) for (let i = 0; i < m.agentK.length; i++) m.agentK[i] /= f;
    m.agentCeiling = { ...m.agentCeiling, fill: 1, hours: Infinity, value: Infinity };
  }
  const raw = revenueReadout(s, mix);
  const sum = (x: typeof rd, k: 'agentHours' | 'needH100e' | 'demand') => x.deps.filter((z) => z.channel !== 'consumer').reduce((a, z) => a + (z[k] ?? 0), 0);
  check(sum(raw, 'agentHours') > sum(rd, 'agentHours') && sum(raw, 'needH100e') > sum(rd, 'needH100e') && sum(raw, 'demand') > sum(rd, 'demand'),
    'D5 day 900: agent-hours beyond the ceiling are not bought (the player\'s agent-hours, demand and serving need fall; the capacity stays spare)',
    `player agent-hours ${(sum(raw, 'agentHours') / 1e9).toFixed(1)}B → ${(sum(rd, 'agentHours') / 1e9).toFixed(1)}B, demand $${sum(raw, 'demand').toFixed(0)}B → $${sum(rd, 'demand').toFixed(0)}B, need ${Math.round(sum(raw, 'needH100e') / 1e3)}k → ${Math.round(sum(rd, 'needH100e') / 1e3)}k H100e`);
}

// ───────── E1–E8 cheap tiers: the market's surplus choice over bands of task difficulty (task A5; worldfx/choice.ts) ─────────
// Buyers of a sector's adopted task-hours choose per band of task difficulty by logit on surplus V·x − p (x the share of
// the band the tier does adequately, from the work-type coverage), scale μ = the cheapest adequate price ÷ ε, plus V4's
// quality term; access is a share of buyers. Cheap tiers: the player's product minis, other providers' students.
{
  const one = (fit: number, a: number, price: number): Tier[] => [{ fit, a, price }];
  const V = 30;
  // E1 a cheap adequate model wins share from a pricier one with the same coverage (and fit).
  const c1 = surplusChoice([one(28, 0.3, 2), one(28, 0.3, 0.2)], [1, 1], [1, 1], V);
  check(c1.target[1] > 0.99 && near(c1.target[0] + c1.target[1], 1, 1e-12), 'A5 E1 a cheap model with the same coverage wins the hours from a pricier one (a tenth of the price: > 99%)',
    `pricier ${c1.target[0].toFixed(4)}, cheap ${c1.target[1].toFixed(4)}`);
  // The brief's crossover on one band: x 0.97 at a tenth of the price beats x 1 exactly when V·0.03 < Δp (fit equal).
  const band = (v: number) => surplusChoice([one(28, 1, 1), one(28, 0.97, 0.1)], [1, 1], [1, 1], v, 1, 1).target[1];
  check(band(20) > 0.5 && band(40) < 0.5 && Math.abs(band(30) - 0.5) < 0.01, 'A5 E1 coverage 0.97 at a tenth of the price beats coverage 1 when value × 0.03 < the price difference (crossover at V = $30/h for Δp = $0.90)',
    `cheap share at V $20 ${band(20).toFixed(3)}, $30 ${band(30).toFixed(3)}, $40 ${band(40).toFixed(3)}`);
  // E2 a frontier model keeps the capability-hungry work: a small cheap model with low coverage takes only the easy bands.
  const c2 = surplusChoice([one(29, 0.4, 2), one(27.5, 0.1, 0.05)], [1, 1], [1, 1], V);
  const hard = c2.share[0].slice(2).every((x) => x > 0.999);
  check(hard && c2.target[1] > 0.2 && c2.target[1] < 0.26, 'A5 E2 the frontier keeps the work a cheap model cannot do (every band above its coverage); the cheap one takes the easy quarter',
    `frontier ${c2.target[0].toFixed(3)} (bands ${c2.share[0].map((x) => x.toFixed(2)).join(' ')}), cheap ${c2.target[1].toFixed(3)}`);
  // E3 equal prices, every offer adequate on every band: the old logit exactly (exp(SHARE_SLOPE_G·Δfit) × brand).
  const fits = [28.4, 28, 27.7];
  const br = [1.2, 1, 1];
  const c3 = surplusChoice(fits.map((f) => one(f, 0.3, 1.5)), br, [1, 1, 1], V);
  const w = fits.map((f, i) => br[i] * Math.exp(SHARE_SLOPE_G * (f - fits[0])));
  const old = w.map((x) => x / w.reduce((a, y) => a + y, 0));
  const c3b = surplusChoice([one(28.4, 0.3, 1.5), one(28, 0.2, 1.5)], [1, 1], [1, 1], V);
  check(old.every((x, i) => near(c3.target[i], x, 1e-12)) && c3b.target[0] > c3b.target[1],
    'A5 E3 with equal prices and every offer adequate the surplus choice is the old logit exactly; with equal prices a lower-coverage offer never gains share',
    `shares ${c3.target.map((x) => x.toFixed(4)).join(' / ')} = old ${old.map((x) => x.toFixed(4)).join(' / ')}`);
  // E5 access is a share of buyers: a provider 5% of buyers can reach takes ≤ 5% even with the only adequate model.
  const c5 = surplusChoice([one(30, 0.5, 1), one(28, 0.2, 1)], [1, 1], [0.05, 1], V);
  check(c5.target[0] <= 0.05 + 1e-12 && c5.target[0] > 0.04 && near(c5.target[0] + c5.target[1], 1, 1e-12), 'A5 E5 access is a share of buyers: a provider 5% of buyers can reach takes at most 5% of the hours, however good its model',
    `${c5.target[0].toFixed(4)}`);
  check(adequacy(0.5, 0.2, 0.4) === 1 && near(adequacy(0.3, 0.2, 0.4), 0.5, 1e-12) && adequacy(0.1, 0.2, 0.4) === 0 && MARKET_BANDS === 8, 'A5 adequacy: the share of a band of tasks a tier does = its coverage\'s position in the band');
}
for (const [label, s] of [['day 1', (() => { const g = game(); run(g, 1); return g; })()], ['day 400', fixture(400)], ['day 900', fixture(900)]] as const) {
  // E6 shares sum to 1 (targets and stocks) in every sector and region; E4 the tier mix of every provider sums to 1.
  const mix = worldMix(s);
  let bad = 0;
  let cells = 0;
  for (const r of ['US', 'CN', 'ROW'] as const) for (const def of SECTORS) {
    const m = mix.sec[r][def.id];
    cells++;
    const t = m.target.reduce((a, x) => a + x, 0);
    const st = m.share.reduce((a, x) => a + x, 0);
    if (!near(t, 1, 1e-9) || !near(st, 1, 1e-5) || m.tiers.weight.some((x) => x.length && !near(x.reduce((a, y) => a + y, 0), 1, 1e-9))) bad++;
  }
  check(cells === 42 && bad === 0, `A5 E6 ${label}: target and customer-stock shares sum to 1 in every sector and region; every provider's tier mix sums to 1`, `${bad} of ${cells} cells off`);
}
{
  // E7 the player's cheap tier: a student sized by the cheapestAt rule to hold a weaker version's capability
  // (launchDistill holdVersionId) set as the API's mini takes the easy bands, lowers the API's price per hour and the
  // serving it needs; the customer stock follows gradually.
  const s = game();
  run(s, 20);
  const api = prod(s, 'api');
  const v0 = versionById(s, api.versionId)!;
  const weaker = cloneVersion(s, v0, 'VW', { build: { ...v0.build!, dg: (v0.build?.dg ?? 0) - 1.2 } });
  const nS = studentToHold(s, v0, weaker);
  const gap = DISTILL.a + DISTILL.b * Math.log10(paramsOfVersion(s, v0) / nS);
  const mini = cloneVersion(s, v0, 'VM', { variant: 'mini', params: nS, fpt: (flopPerToken(s, v0) * nS) / paramsOfVersion(s, v0), build: { ...v0.build!, dg: (v0.build?.dg ?? 0) - gap } });
  check(near(workFit(s, mini, 'SWE').fit, workFit(s, weaker, 'SWE').fit, 1e-9) && near(nS, paramsOfVersion(s, v0) / Math.pow(10, (1.2 - DISTILL.a) / DISTILL.b), 1e-9),
    'A5 E7 a student sized to hold a weaker version\'s capability (cheapestAt on the product\'s teacher) lands on its fit at a fraction of the size', `${(nS / 1e9).toFixed(0)}B of ${(paramsOfVersion(s, v0) / 1e9).toFixed(0)}B`);
  // TIERS: the API's lineup students take the bands they do adequately, so the API's cost and price per hour sit below
  // its main model's; a mini of the player's own is one more tier of the lineup (its share of the hours the market's).
  const mix0 = worldMix(s);
  const pi = mix0.providers.findIndex((p) => p.key === 'player');
  const w0 = mix0.sec.US.SOFT.playerTierW[api.id] ?? [];
  const main = productOffer(s, api, 'SOFT');
  const before = revenueReadout(s, mix0).deps.find((x) => x.id === api.id)!;
  const t0 = mix0.sec.US.SOFT.target[pi];
  const sh0 = mix0.sec.US.SOFT.share[pi];
  const stud = 1 - (w0[0] ?? 1);
  const blended = blendTiers(mix0.lineupBy.get(`${api.id}|SOFT`) ?? [main], w0);
  check(w0.length === 1 + lineupOf(paramsOfVersion(s, v0)).length && stud > 0.05 && near(w0.reduce((a, x) => a + x, 0), 1, 1e-9) && blended.cost < main.cost && blended.price < main.price,
    'TIERS E7 the API sells its lineup: its students take the US Software bands they do adequately (hours by tier sum to 1), so its cost and price per adopted task-hour there are below its main model\'s',
    `hours by tier ${w0.map((x) => x.toFixed(2)).join(' / ')}; cost $${main.cost.toFixed(3)} → $${blended.cost.toFixed(3)}, price $${main.price.toFixed(3)} → $${blended.price.toFixed(3)} per adopted task-hour (main model → lineup)`);
  // A mini of the player's own (a student 1.2 OOM below, between the lineup's 0.88 and 1.94 OOM rungs) is one more tier.
  api.miniVersionId = mini.id;
  const mix1 = worldMix(s);
  const w1 = mix1.sec.US.SOFT.playerTierW[api.id] ?? [];
  const after = revenueReadout(s, mix1).deps.find((x) => x.id === api.id)!;
  const pk = mix1.sec.US.SOFT.tiers.kind[pi];
  run(s, 1);
  const sh1 = worldMix(s).sec.US.SOFT.share[pi];
  check(w1.length === w0.length + 1 && pk.filter((k) => k === 'mini').length === 1 && near(w1.reduce((a, x) => a + x, 0), 1, 1e-9) && near(w1[w1.length - 1], mix1.sec.US.SOFT.playerMiniW[api.id] ?? 0, 1e-12)
    && after.costPerHour <= before.costPerHour + 1e-9 && mix1.sec.US.SOFT.target[pi] >= t0 - 1e-9 && Math.abs(sh1 - sh0) < 0.02,
    'A5 E7 a mini of the player\'s own is one more tier of the API\'s lineup: hours by tier still sum to 1, the API\'s cost per hour does not rise, the player\'s share target does not fall and the stock moves gradually',
    `mini ${(w1[w1.length - 1] * 100).toFixed(0)}% of the API's US Software hours; cost $${before.costPerHour.toFixed(3)} → $${after.costPerHour.toFixed(3)} per hour; target ${t0.toFixed(3)} → ${mix1.sec.US.SOFT.target[pi].toFixed(3)}, stock ${sh0.toFixed(3)} → ${sh1.toFixed(3)}`);
}
{
  // TIERS E8 parity: every provider's lineup is its model and the LINEUP students of it (data/v2/serving.ts): rivals'
  // and China's under their model, the player's under each sector product's main model. Each student costs and prices
  // r × the model (FLOP per token ∝ active parameters, the model's markup), sits g = DISTILL.a + DISTILL.b·log₁₀(1/r)
  // below it and covers no more than it; the bottom rung is 1/80 of the model (the sourced span) above the 1B floor.
  const s = fixture(400);
  const mix = worldMix(s);
  let n = 0;
  let nP = 0;
  let bad = 0;
  const pi = mix.providers.findIndex((p) => p.key === 'player');
  for (const def of SECTORS) {
    const m = mix.sec.US[def.id];
    mix.providers.forEach((p, i) => {
      const L = m.tiers.offers[i];
      const K = m.tiers.kind[i];
      for (let k = 0; k < L.length; ) {
        // a lineup: one 'model' tier then its students (the player has one per sector product)
        if (K[k] !== 'model') { k++; continue; }
        const T = L[k];
        const nT = p.lab === 'player' ? undefined : p.params;
        const rungs = nT !== undefined ? lineupOf(nT) : undefined;
        let j = k + 1;
        let q = 0;
        while (j < L.length && K[j] === 'student') {
          const o = L[j];
          const r = o.cost / T.cost;
          const g = DISTILL.a + DISTILL.b * Math.log10(1 / r);
          if (rungs && (!rungs[q] || !near(rungs[q].r, r, 1e-9))) bad++;
          if (!near(o.price / T.price, r, 1e-9) || !near(o.fit, T.fit - g, 1e-9) || o.a > T.a + 1e-12) bad++;
          if (i === pi) nP++;
          else n++;
          j++;
          q++;
        }
        if (rungs && q !== rungs.length) bad++;
        k = j;
      }
    });
  }
  const rr = lineupOf(1e12).map((x) => x.r);
  check(n > 0 && nP > 0 && bad === 0 && rr.length === LINEUP.ratios.length && near(rr[rr.length - 1], 1 / 80, 1e-12) && lineupOf(2e9).length === 1 && lineupOf(1e9).length === 0,
    'TIERS E8 day 400: every provider sells its model and the LINEUP students of it (rivals and China under their model, the player under each sector product\'s main model): each at r × the model\'s cost and price, DISTILL.a + DISTILL.b·log₁₀(1/r) below its fit, covering no more; the bottom rung 1/80 above the 1B floor',
    `${n} rival and China student tiers, ${nP} of the player's, ${bad} off; rungs under a 1T model ${rr.map((x) => `1/${(1 / x).toFixed(1)}`).join(', ')}`);
}

finish('serving');
