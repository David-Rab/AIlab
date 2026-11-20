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
//       V0's level (a version or a distilled student) is a run planRun accepts; its price falls ×6–×30 a year, decomposed
//       into active parameters × FLOP per parameter × utilisation × $ per H100e-hour × margin
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
import { worldMix } from '../../src/engine/v2/worldfx/mix';
import { revenueReadout, sectorHours, sectorSpendParts, servingPool } from '../../src/engine/v2/worldfx/revenue';
import { agentCeilingOf, workHoursOf } from '../../src/engine/v2/worldfx/use';
import { ECON, SECTORS } from '../../src/data/v2/sectors';
import {
  agentDemandOf, agentLeverage, cheapestAt, effortDG, fptOfG, fxOn, h100eHoursPer, internalFx, offerOf, paidShareTarget, productOffer, reachTarget, sectorCover, sectorTheta, serveDollarsPerHour,
  subPrice, valuePerHour, wagePerHour,
} from '../../src/engine/v2/worldfx/serving';
import { consumerUse, workBilling } from '../../src/engine/v2/worldfx/readouts';
import { monitorOverhead } from '../../src/engine/v2/models/products';
import { paramsOfVersion, planRun } from '../../src/engine/v2/models/runs';
import { DISTILL } from '../../src/data/v2/runDesign';
import { U_DECODE, U_PREFILL } from '../../src/data/v2/workTypes';
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
  check(fptOfG(s, g0 + 1, v0.day) > fptOfG(s, g0, v0.day) * 3, 'S1 rivals (BRIDGE(V7)): a model 1 OOM more capable at the same date is ≈ √10 × larger (N ∝ √FLOP)', `${(fptOfG(s, g0 + 1, v0.day) / fptOfG(s, g0, v0.day)).toFixed(2)}×`);
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
  for (const r of ['US', 'CN', 'ROW'] as const) for (const [sid, m] of Object.entries(mix.sec[r]) as [SectorId, (typeof mix.sec.US)[SectorId]][]) {
    mix.providers.forEach((p, i) => {
      if (!p.model || !m.prices[i]) return;
      const o = offerOf(s, [{ v: p.model, fpt: p.fpt ?? 2e12, w: 1 }], sid, { markup: p.markup, rate });
      const value = valuePerHour(s, sid, r);
      n++;
      if (m.prices[i] < o.cost * (1 - 1e-9) || (m.prices[i] > value * (1 + 1e-9) && m.prices[i] > o.cost * (1 + 1e-9))) bad++;
    });
  }
  check(n > 0 && bad === 0, `S3 day ${d}: every provider's price per hour of use is ≥ its cost and ≤ the work's value (unless serving costs more than the work is worth)`, `${n} offers, ${bad} outside`);
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
  // A much better model on every product: the logit target jumps; the stock follows over months.
  const v0 = versionById(s, prod(s, 'api').versionId)!;
  const better = cloneVersion(s, v0, 'VX', { build: { ...v0.build!, dg: (v0.build?.dg ?? 0) + 1.5 } });
  for (const d of s.player.deployments) if (d.channel !== 'internal') d.versionId = better.id;
  const mixT = worldMix(s);
  const tgt = mixT.sec.US.SOFT.target[pi];
  run(s, 1);
  const sh1 = worldMix(s).sec.US.SOFT.share[pi];
  run(s, 44);
  const sh45 = worldMix(s).sec.US.SOFT.share[pi];
  check(tgt > sh0 + 0.1 && sh1 - sh0 < 0.05 * (tgt - sh0) + 0.01 && sh45 > sh0 + 0.25 * (tgt - sh0),
    'S4 a much better model: the target share jumps, the customer stock moves a little a day and most of the way within a quarter',
    `share ${sh0.toFixed(3)} → day 1 ${sh1.toFixed(3)} → day 45 ${sh45.toFixed(3)} (target ${tgt.toFixed(3)})`);
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
  check(Math.abs(g0.world.fx.reach.US - CONSUMER_MKT.reach.startUS) < 1e-12 && Math.abs(g0.world.fx.reach.ROW - CONSUMER_MKT.reach.startUS * CONSUMER_MKT.reach.row) < 1e-12,
    'C1 start reach: 46% of US adults weekly (RPS ≈ 50% non-work use in Nov 2025), ROW 0.85 × the US', `US ${g0.world.fx.reach.US}, ROW ${g0.world.fx.reach.ROW.toFixed(3)}`);
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
  const v = versionById(s, chat.miniVersionId ?? chat.versionId)!;
  const want = (((x.users ?? 0) - (x.subs ?? 0)) * h100eHoursPer(flopPerToken(s, v), fr)) / 24 * (1 + monitorOverhead(s, chat));
  check(fr.input + fr.output >= 8e3 && fr.input + fr.output <= 1e4 && near(x.needFree ?? 0, want, 1e-6) && near((x.needPaid ?? 0) + (x.needFree ?? 0), x.needH100e, 1e-6),
    'C4 free users need ≈ 9k tokens per weekly-user-day (3.75 messages; R22: 8–10k, was 1.6k) on the free tier model; paid + free = the product\'s need',
    `${((x.users ?? 0) / 1e6).toFixed(0)}M users: free ${Math.round((x.needFree ?? 0) / 1e3)}k + paid ${Math.round((x.needPaid ?? 0) / 1e3)}k H100e; cut ${Math.round(x.cutH100e / 1e3)}k (free ${Math.round((x.cutFree ?? 0) / 1e3)}k)`);
  check((x.cutFree ?? 0) <= (x.needFree ?? 0) + 1e-6 && (x.cutH100e <= (x.needFree ?? 0) + 1e-6 || near(x.cutFree ?? 0, x.needFree ?? 0, 1e-6)), 'C4 the split cuts free users before paying ones');
}
for (const d of [400, 900]) {
  // C6 no provider's subscription is priced above the willingness to pay (unless serving a subscriber costs more).
  const s = fixture(d);
  const mix = worldMix(s);
  let bad = 0;
  let n = 0;
  mix.providers.forEach((p, i) => {
    if (!p.model) return;
    const sp = subPrice(s, p.fpt ?? 2e12, p.markup);
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
      const o = offerOf(s, [{ v: p.model, fpt: p.fpt ?? 2e12, w: 1 }], sid, { markup: p.markup, rate });
      const wage = wagePerHour(sid, r);
      n++;
      if (m.agentPrices[i] < o.costAg * (1 - 1e-9) || (m.agentPrices[i] > wage * (1 + 1e-9) && m.agentPrices[i] > o.costAg * (1 + 1e-9)) || (m.seatPrices[i] > 0 && m.seatPrices[i] < o.seat * (1 - 1e-9))) bad++;
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

// ───────── A1–A3 price of a fixed capability (task A3; research/20 D3: Cottier et al. 2025 ×10/yr, ×9–×900) ─────────
// The fixed-capability price is the price of the cheapest model the lab could serve at V0's capability (cheapestAt: one
// of its versions, or a student distilled to hold the level under the game's distillation rule), at the standard
// markup, per million blended tokens. It decomposes exactly into factors (× per year; their product is the decline):
// active parameters, serving FLOP per active parameter (shape, serving stack), utilisation, $ per H100e-hour (rental),
// margin. Tokens per task enter only the price per task (reported).
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
  const tokTask = tok.input + tok.output;
  // blended price per million tokens (input:output 5:1 by count, output priced 5× input as on the lists): the agentic
  // token profile's cost per token × markup = fpt × util ÷ peak ÷ 3600 × rental × markup × 1e6
  const util = (tok.input / U_PREFILL + tok.output / U_DECODE) / tokTask; // peak-seconds per FLOP of a blended token
  const perM = (fpt: number, markup: number) => ((h100eHoursPer(fpt, tok) * serveDollarsPerHour(s) * markup) / tokTask) * 1e6;
  type Snap = { t: number; N: number; fpp: number; util: number; rate: number; markup: number; tokTask: number; price: number; bridge: number };
  const snaps: Snap[] = [];
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
      const snap: Snap = {
        t: decimalYear(s), N: c.params, fpp: c.fpt / c.params, util, rate: serveDollarsPerHour(s), markup: MARKUP.standard, tokTask,
        price: perM(c.fpt, MARKUP.standard), bridge: perM(fptOfG(s, fixedG, s.time.day), MARKUP.standard),
      };
      snaps.push(snap);
      rows.push(`${snap.t.toFixed(2)}: API ${v.name} ${(paramsOfVersion(s, v) / 1e9).toFixed(0)}B $${perM(flopPerToken(s, v), MARKUP.standard).toFixed(2)}/M; V0-level cheapest ${c.student ? `student of ${teacher.name} (fit +${(c.teacherFit - fixedG).toFixed(2)}, δ ${c.gap.toFixed(2)})` : teacher.name} ${(c.params / 1e9).toFixed(1)}B $${snap.price.toFixed(3)}/M; reference design without distillation (rivals' bridge) $${snap.bridge.toFixed(2)}/M; rental $${snap.rate.toFixed(2)}/H100e-h`);
    }
  }
  const a = snaps[0];
  const b = snaps[snaps.length - 1];
  const yrs = b.t - a.t;
  const py = (x: number) => Math.pow(x, 1 / yrs);
  const f = { params: py(a.N / b.N), fpp: py(a.fpp / b.fpp), util: py(a.util / b.util), hardware: py(a.rate / b.rate), margin: py(a.markup / b.markup) };
  const total = py(a.price / b.price);
  const prod5 = f.params * f.fpp * f.util * f.hardware * f.margin;
  const perTask = total * py(a.tokTask / b.tokTask);
  const fmt = (x: number) => `×${x.toFixed(2)}`;
  console.log(`INFO  A3 price of V0's capability (standard markup, per M blended tokens):\n      ${rows.join('\n      ')}`);
  check(near(prod5, total, 1e-9),
    'A3 the fixed-capability decline = active parameters × FLOP per parameter × utilisation × $ per H100e-hour × margin (exact)',
    `params ${fmt(f.params)}, FLOP/param (shape, serving stack) ${fmt(f.fpp)}, utilisation ${fmt(f.util)}, hardware (rental) ${fmt(f.hardware)}, margin ${fmt(f.margin)} → ${fmt(total)}/yr; per task (tokens per task ${fmt(py(a.tokTask / b.tokTask))}) ${fmt(perTask)}/yr`);
  check(total >= 6 && total <= 30,
    'A3 the price of a fixed capability (V0\'s) falls ×6–×30 a year (R20 D3: ≈ ×10, ×9–×900; Cottier et al. 2025)',
    `${fmt(total)}/yr over ${a.t.toFixed(2)}–${b.t.toFixed(2)}; without distillation (reference design at the frontier recipe, rivals' BRIDGE(V7)) ${fmt(py(a.bridge / b.bridge))}/yr`);
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
        n++;
        if (m.agentK[i] !== agentDemandOf(o, wagePerHour(def.id, r)).k) diff++;
      });
    }
    check(bound === 0 && n > 0 && diff === 0, `D3 ${label}: below the ceiling nothing changes (no cell binds; every provider's agent-hours per supervising hour is bit-identical to the A2c rule)`, `${n} provider offers, ${diff} differ, ${bound} cells bound`);
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

finish('serving');
