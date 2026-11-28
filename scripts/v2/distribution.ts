// C7c: distribution replaces the partner revenue share (design/corp/CORPORATE.md §5.2, DEALS-AUDIT.md finding 1), on
// constructed cases: a running hyperscaler deal adds reach to the API and enterprise channels only; its fee is exactly
// its share of the revenue that reach adds (revenue with it − without, same pass); both stop at `until`; the legacy
// Northwind stake pays its share of all revenue to its end; the offer projects at the capped trailing growth.
// Run alone: `node --import tsx scripts/v2/distribution.ts`.
import { LEGACY_NORTHWIND, PARTNER_TERMS } from '../../src/data/v2/deals';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { dayOfDate } from '../../src/engine/v2/core/time';
import { dealPreview } from '../../src/engine/v2/finance/actions';
import { payrollSystem } from '../../src/engine/v2/finance/cashflow';
import { partnerTerms } from '../../src/engine/v2/finance/deals';
import { directChannelRevenue, distributionCut, distributionProjection, distributionReach, overYears, partnerRevenue, projectionGrowth } from '../../src/engine/v2/finance/distribution';
import { revenueShareRate } from '../../src/engine/v2/finance/ext';
import { applyRevenue, revenueReadout } from '../../src/engine/v2/worldfx/revenue';
import { worldMix } from '../../src/engine/v2/worldfx/mix';
import type { GameStateV2, StrategicDeal } from '../../src/engine/v2/types';
import { check, finish } from './lib';

const D = PARTNER_TERMS.hyperscaler.distribution;
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
const f2 = (x: number) => x.toFixed(2);
const leader = () => newGame(defaultSetupV2({ seed: 4 }));
/** A running distribution deal with Azimuth (the strings a signed hyperscaler deal carries), to `until`. */
function addDeal(s: GameStateV2, until = s.time.day + 365): StrategicDeal {
  const d: StrategicDeal = { id: 'DL-test', partner: 'Azimuth', kind: 'hyperscaler', day: s.time.day, equityNow: 0, equityLater: 0, strings: { distribution: { ...D } }, until };
  s.player.finance.deals.push(d);
  return d;
}
const byCh = (rd: ReturnType<typeof revenueReadout>, ch: string) => rd.deps.filter((x) => x.channel === ch);

// 1. Reach: API and enterprise customers ×(1 + X), consumer unchanged.
{
  const s = leader();
  const mix = worldMix(s);
  const r0 = revenueReadout(s, mix);
  addDeal(s);
  const r1 = revenueReadout(s, mix);
  const X = distributionReach(s);
  const sector = ['api', 'enterprise'].flatMap((c) => byCh(r1, c));
  const ok = sector.length > 0 && sector.every((x) => {
    const b = r0.deps.find((y) => y.id === x.id)!;
    return near(x.demand, b.demand * (1 + X)) && near(x.partner?.demand ?? 0, b.demand * X) && near(x.partner!.needH100e, b.needH100e * X);
  });
  const cons = byCh(r1, 'consumer');
  const consOk = cons.length > 0 && cons.every((x) => { const b = r0.deps.find((y) => y.id === x.id)!; return x.demand === b.demand && x.revenue === b.revenue && !x.partner; });
  check(near(X, D.reach) && ok, `1 a running deal: API and enterprise demand and serving need ×(1 + ${D.reach})`, sector.map((x) => `${x.channel} $${f2(r0.deps.find((y) => y.id === x.id)!.demand)}B → $${f2(x.demand)}B`).join(' · '));
  check(consOk, '1 the consumer channel is unchanged (no partner customers)', cons.map((x) => `$${f2(x.demand)}B`).join(' · '));
}

// 2. The cut is exactly the fee × (revenue with the reach − without), same pass; 0 without a deal.
{
  const s = leader();
  s.player.computeOnline *= 20; // ample serving: every customer, own and partner, is served
  const mix = worldMix(s);
  const r0 = revenueReadout(s, mix);
  const d = addDeal(s);
  const r1 = revenueReadout(s, mix);
  const inc = r1.total - r0.total;
  const served = r1.deps.every((x) => !x.partner || near(x.partner.servedH100e, x.partner.needH100e, 1e-6));
  check(served && inc > 0 && Math.abs(distributionCut(s, r1.partnerRevenue) - D.fee * inc) < 1e-9 && Math.abs(r1.partnerRevenue - inc) < 1e-9, `2 cut = ${D.fee} × (revenue with − without), to 1e-9`, `incremental $${f2(inc)}B/yr · cut $${f2(distributionCut(s, r1.partnerRevenue))}B/yr`);
  // As built through the revenue system: the product rows carry it, the payroll reads it.
  applyRevenue(s, makeCtx(s));
  check(near(partnerRevenue(s), r1.partnerRevenue, 1e-3) && near(distributionCut(s), D.fee * partnerRevenue(s)), '2 the revenue system stores partner revenue on the products; the cut reads it', `partner revenue $${f2(partnerRevenue(s))}B/yr`);
  // Short of serving compute: the partner's customers are served after the product's own.
  const t = leader();
  t.player.computeOnline *= 0.3;
  addDeal(t);
  const rs = revenueReadout(t, worldMix(t));
  const own = rs.deps.filter((x) => x.partner).every((x) => x.partner!.servedH100e <= 1e-9 || x.servingH100e - x.partner!.servedH100e >= x.needH100e - x.partner!.needH100e - 1e-6);
  check(own, '2 short of compute: partner customers get serving only once the product\'s own are served', rs.deps.filter((x) => x.partner).map((x) => `${x.channel} partner ${f2(x.partner!.servedH100e / Math.max(1e-9, x.partner!.needH100e))} served`).join(' · '));
  // No deal: no partner revenue, no cut.
  s.player.finance.deals = s.player.finance.deals.filter((x) => x !== d);
  const r2 = revenueReadout(s, mix);
  applyRevenue(s, makeCtx(s));
  check(r2.partnerRevenue === 0 && r2.deps.every((x) => !x.partner) && distributionCut(s) === 0 && partnerRevenue(s) === 0, '2 no deal: no partner revenue and no cut');
}

// 3. After `until` the channel and the cut stop.
{
  const s = leader();
  const d = addDeal(s);
  applyRevenue(s, makeCtx(s));
  const before = distributionCut(s);
  d.until = s.time.day; // ended today
  const rd = revenueReadout(s);
  applyRevenue(s, makeCtx(s));
  check(before > 0 && distributionReach(s) === 0 && rd.partnerRevenue === 0 && distributionCut(s) === 0, '3 after until: no extra reach, no partner revenue, no cut', `cut before $${f2(before)}B/yr`);
}

// 4. The legacy Northwind stake: LEGACY_NORTHWIND.revenueShare of all revenue, paid monthly, to its until.
{
  const s = leader();
  const nw = s.player.finance.deals.find((d) => d.id === 'DL-northwind0')!;
  const until = dayOfDate(s.time.startDate, LEGACY_NORTHWIND.until);
  check(nw.legacy === true && nw.strings.revenueShare === LEGACY_NORTHWIND.revenueShare && nw.until === until && revenueShareRate(s) === LEGACY_NORTHWIND.revenueShare && !nw.strings.distribution, `4 the leader's Northwind stake: ${LEGACY_NORTHWIND.revenueShare * 100}% of all revenue to ${LEGACY_NORTHWIND.until}, no distribution`);
  // Paid with the payroll: the month's cash differs by share × run-rate ÷ 12 from the same state without it.
  const paidMonth = (x: GameStateV2) => {
    const c0 = x.player.finance.cash;
    payrollSystem.run(x, makeCtx(x));
    return c0 - x.player.finance.cash;
  };
  const a = structuredClone(s);
  const b = structuredClone(s);
  b.player.finance.deals.find((d) => d.id === 'DL-northwind0')!.strings = {};
  const diff = paidMonth(a) - paidMonth(b);
  const want = (LEGACY_NORTHWIND.revenueShare * s.player.finance.revenueRun) / 12;
  const g = projectionGrowth(s);
  check(near(diff, want, 1e-9), '4 paid monthly: share × revenue run-rate ÷ 12', `$${f2(diff)}B a month · first year $${f2(LEGACY_NORTHWIND.revenueShare * s.player.finance.revenueRun)}B at today's run-rate, $${f2(overYears(LEGACY_NORTHWIND.revenueShare * s.player.finance.revenueRun, g, 1))}B at ×${g.toFixed(2)} growth`);
  const c = structuredClone(s);
  c.player.finance.deals.find((d) => d.id === 'DL-northwind0')!.until = c.time.day;
  const e = structuredClone(b);
  check(revenueShareRate(c) === 0 && near(paidMonth(c), paidMonth(e), 1e-12), '4 after until: no share');
}

// 5. The offer's projection: the reach on today's API and enterprise revenue, at the trailing growth capped at 2× a year.
{
  const s = leader();
  applyRevenue(s, makeCtx(s));
  const f = s.player.finance;
  const t = partnerTerms(s, 'Azimuth');
  const base = D.reach * directChannelRevenue(s);
  // Leader history 4.5 → 12: the trailing growth is above 2×, so the cap binds.
  const capped = projectionGrowth(s);
  const pj = distributionProjection(s, t.strings.distribution!, t.years);
  const wantOver = D.fee * base * (2 ** t.years - 1) / Math.log(2);
  const pv = dealPreview(s, t);
  const gain = pv.gains.find((x) => x.currency === 'revenue');
  const cost = pv.costs.find((x) => x.currency === 'revenue');
  check(capped === 2 && near(pj.over, wantOver) && near(gain?.amount ?? 0, base) && near(cost?.amount ?? 0, -D.fee * base) && /×2\.0 a year/.test(String(cost?.target)) && t.strings.distribution?.fee === D.fee && t.strings.revenueShare === undefined, '5 offer: +reach × API and enterprise revenue now, fee over the deal at the growth capped at 2×', `${gain?.target} · ${cost?.target}`);
  // A slower history (8 → 12: ×1.5) is used as is.
  f.revenueHistory = [8, 9, 10, 11];
  const g = projectionGrowth(s);
  const pj2 = distributionProjection(s, t.strings.distribution!, t.years);
  check(near(g, 12 / 8) && near(pj2.over, D.fee * base * (g ** t.years - 1) / Math.log(g)), '5 below the cap the trailing 4-quarter growth is used', `×${g.toFixed(2)}: ≈$${f2(pj2.over)}B over ${t.years} y`);
  // Old vs new cost of a fresh Azimuth deal at day 0 over 6 years (the old 8% of all revenue).
  f.revenueHistory = leader().player.finance.revenueHistory;
  const R = f.revenueRun;
  console.log(`     day-0 Azimuth over ${t.years} y: old 8% of all revenue $${f2(0.08 * R * t.years)}B flat, $${f2(overYears(0.08 * R, 2, t.years))}B at ×2 · new fee $${f2(D.fee * base * t.years)}B flat, $${f2(pj.over)}B at ×2 (channel now $${f2(directChannelRevenue(s))}B/yr, +$${f2(base)}B/yr from the partner)`);
}

finish('distribution');
