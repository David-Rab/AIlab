// MK-9 targeted check (design/MARKET.md M3, M5, MK-9 row): per-person plans priced competitively.
//  (a) game start and the day-369 save (read-only): each Chat seller's plan price, cost, margin, paid share (stock, US /
//      ROW), its share of all paying subscribers (s_paid) and margin target; the player's seat price per region in a few
//      sectors (with its seat cost, its share of the seats and the going seat price), and the revenue lines;
//  (b) revenue change vs a baseline (`--base <json>` written by this script on `market` with `--out <json>`);
//  (c) 30 ticks on day 369 without throwing, with the plan and seat price path.
// Run: npx tsx scripts/v2/_mk9/check.ts [--out file.json] [--base file.json]
// The script only reads fields that exist on `market` too (mix.plan and the seat margins are optional here), so the
// same file makes the baseline there.
import { readFileSync, writeFileSync } from 'node:fs';
import { deserialize } from '../../../src/engine/v2/core/save';
import { tick } from '../../../src/engine/v2/core/loop';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { revenueReadout, sectorSpendParts } from '../../../src/engine/v2/worldfx/revenue';
import { CONSUMER_MKT } from '../../../src/data/v2/serving';
import * as SERVING from '../../../src/data/v2/serving';
import { REGIONS } from '../../../src/data/v2/sectors';
import type { GameStateV2, RegionId, SectorId } from '../../../src/engine/v2/types';

const D369 = 'C:/Users/david/Downloads/ai27-v2-day369.json';
const arg = (k: string) => {
  const i = process.argv.indexOf(k);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const pc = (x: number) => (Number.isFinite(x) ? `${(100 * x).toFixed(1)}%` : '—');
const load = () => deserialize(readFileSync(D369, 'utf8'));
const SEAT_CAP: number = (SERVING.SEATS as { cap?: number; price?: number }).cap ?? (SERVING.SEATS as { price?: number }).price ?? NaN;
const SECS: SectorId[] = ['SOFT', 'FIN', 'HEALTH', 'GOV'];

type Plan = { margin: number[]; target: number[]; cost: number[]; share: number[]; going: number; mu: number };
interface Summary { chat: number; seat: number; seatAll: number; total: number; chatPrice: number; seatUS: number }

function report(label: string, s: GameStateV2): Summary {
  const mix = worldMix(s);
  const plan = (mix as unknown as { plan?: Plan }).plan;
  const pi = mix.providers.findIndex((p) => p.key === 'player');
  console.log(`${label} (day ${s.time.day}): Chat plans${plan ? ` (going $${f2(plan.going)}, μ_plan $${f2(plan.mu)})` : ''}`);
  mix.providers.forEach((p, i) => {
    const cm = mix.consumer.US;
    if (cm.fit[i] === -Infinity) return;
    const price = mix.consumer.ROW.prices[i];
    const cost = plan ? plan.cost[i] : NaN;
    console.log(`    ${p.key.padEnd(12)} ${p.open ? 'open ' : 'closed'} price $${f2(price)}/mo  cost $${f2(cost)}  margin $${f2(price - cost)} (${pc((price - cost) / price)})` +
      `  paid share US ${pc(mix.consumer.US.paid[i])} ROW ${pc(mix.consumer.ROW.paid[i])}  user share US ${pc(mix.consumer.US.share[i])} ROW ${pc(mix.consumer.ROW.share[i])}` +
      (plan ? `  s_paid ${pc(plan.share[i])}  M $${f2(plan.margin[i])} → target $${f2(plan.target[i])}` : ''));
  });
  console.log(`  seats, player (cap $${SEAT_CAP}):`);
  for (const sid of SECS) {
    const row = REGIONS.map((r: RegionId) => {
      const m = mix.sec[r][sid] as typeof mix.sec[RegionId][SectorId] & { seatCost?: number[]; seatMTarget?: number[]; seatM?: number[] };
      const sp = pi >= 0 ? m.seatPrices[pi] : NaN;
      return `${r} $${f2(sp)} (cost $${f2(m.seatCost?.[pi] ?? NaN)}, share ${pc(pi >= 0 ? m.share[pi] : NaN)}, M $${f2(m.seatM?.[pi] ?? NaN)} → $${f2(m.seatMTarget?.[pi] ?? NaN)}; going $${f2(m.seatPrice)})`;
    });
    console.log(`    ${sid.padEnd(6)} ${row.join('  ')}`);
  }
  const rd = revenueReadout(s);
  let chat = 0;
  let seat = 0;
  let chatPrice = NaN;
  for (const d of rd.deps) {
    if (d.channel === 'consumer') {
      chat += d.revenue;
      chatPrice = d.subPrice ?? NaN;
      console.log(`    player Chat ${d.id}: $${f2(d.subPrice ?? NaN)}/mo, cost $${f2(d.subCost ?? NaN)}, ${((d.subs ?? 0) / 1e6).toFixed(1)}M subs, revenue $${f2(d.revenue)}B/yr`);
    }
    if ((d.seats ?? 0) > 0) {
      seat += d.seatDemand ?? 0;
      console.log(`    player ${d.channel} ${d.id}: ${((d.seats ?? 0) / 1e6).toFixed(2)}M seats at $${f2(d.seatPrice ?? NaN)} (cost $${f2(d.seatCost ?? NaN)}), seat demand $${f2(d.seatDemand ?? 0)}B/yr`);
    }
  }
  let seatAll = 0;
  for (const r of REGIONS) for (const sid of Object.keys(mix.sec[r]) as SectorId[]) seatAll += sectorSpendParts(s, r, sid, mix).seat;
  const pUS = pi >= 0 ? mix.sec.US.SOFT.seatPrices[pi] : NaN;
  console.log(`  revenue: player total $${f2(rd.total)}B/yr, Chat $${f2(chat)}B, player seat demand $${f2(seat)}B; all sellers' seat spend $${f2(seatAll)}B/yr`);
  return { chat, seat, seatAll, total: rd.total, chatPrice, seatUS: pUS };
}

const out: Record<string, Summary> = {};
{
  const s0 = newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 1, tutorial: false }));
  out.start = report('(a) game start', s0);
  out.d369 = report('(a) day-369 save', load());
}
const base = arg('--base');
if (base) {
  const b = JSON.parse(readFileSync(base, 'utf8')) as Record<string, Summary>;
  console.log('(b) change vs market:');
  for (const k of Object.keys(out)) {
    const x = out[k];
    const y = b[k];
    if (!y) continue;
    const d = (a: number, c: number) => `$${f2(c)}B → $${f2(a)}B (${a >= c ? '+' : ''}${f2(a - c)})`;
    console.log(`    ${k}: Chat ${d(x.chat, y.chat)}; player seats ${d(x.seat, y.seat)}; all sellers' seats ${d(x.seatAll, y.seatAll)}; player total ${d(x.total, y.total)}`);
  }
}
const o = arg('--out');
if (o) writeFileSync(o, JSON.stringify(out, null, 1));

// Checks on this branch's rules (skipped on a baseline run without mix.plan).
{
  const s0 = newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 1, tutorial: false }));
  const mix = worldMix(s0);
  const plan = (mix as unknown as { plan?: Plan }).plan;
  if (plan) {
    const pi = mix.providers.findIndex((p) => p.key === 'player');
    let bad = 0;
    mix.providers.forEach((p, i) => {
      const price = mix.consumer.US.prices[i];
      if (mix.consumer.US.fit[i] === -Infinity) return;
      if (price > Math.max(CONSUMER_MKT.wtpMonth, plan.cost[i]) + 1e-9 || price < plan.cost[i] - 1e-9) bad++;
    });
    check(bad === 0, 'Chat plans within [serving cost, wtp]');
    let sb = 0;
    let near = 0;
    let n = 0;
    for (const r of REGIONS) for (const sid of Object.keys(mix.sec[r]) as SectorId[]) {
      const m = mix.sec[r][sid] as typeof mix.sec[RegionId][SectorId] & { seatCost: number[] };
      mix.providers.forEach((p, i) => {
        if (p.open || !(m.seatPrices[i] > 0)) return;
        if (m.seatPrices[i] > SEAT_CAP + 1e-9 || m.seatPrices[i] < m.seatCost[i] - 1e-9) sb++;
      });
      if (pi >= 0 && m.share[pi] > 0) {
        n++;
        if (m.seatPrices[pi] > 0.8 * SEAT_CAP) near++;
      }
    }
    check(sb === 0, 'seat prices within [seat serving cost, cap] everywhere');
    check(n > 0 && near / n > 0.5, 'at the start the player\'s seats sell near the list-price cap (not ≈ $6) in most sectors × regions', `${near}/${n} above 0.8 × cap`);
  }
}

// (c) 30 ticks on day 369.
{
  const s = load();
  const path: string[] = [];
  let threw = '';
  try {
    for (let i = 0; i <= 30; i++) {
      if (i % 10 === 0) {
        const mix = worldMix(s);
        const pi = mix.providers.findIndex((p) => p.key === 'player');
        const rd = revenueReadout(s);
        const chat = rd.deps.filter((d) => d.channel === 'consumer').reduce((a, d) => a + d.revenue, 0);
        const plans = mix.providers.map((p, i2) => (mix.consumer.US.fit[i2] === -Infinity ? '' : `${p.key} $${f2(mix.consumer.ROW.prices[i2])}`)).filter(Boolean).join(', ');
        path.push(`d+${i} revenue $${f2(rd.total)}B/yr (Chat $${f2(chat)}B); plans ${plans}; player seat US SOFT $${f2(pi >= 0 ? mix.sec.US.SOFT.seatPrices[pi] : NaN)}, ROW FIN $${f2(pi >= 0 ? mix.sec.ROW.FIN.seatPrices[pi] : NaN)}`);
      }
      if (i < 30) tick(s, { skip: ['endings'] });
    }
  } catch (err) {
    threw = String((err as Error).stack ?? err);
  }
  console.log(`(c) day 369 → ${s.time.day}:\n    ${path.join('\n    ')}`);
  check(!threw, '(c) 30 ticks on the day-369 save without throwing', threw.slice(0, 300));
}
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
