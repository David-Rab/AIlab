// MK-12 check (design/MARKET.md M12, M15, MK-12 row): the Products screen's readouts and previews on the designer's
// day-369 save (read-only).
//  (a) every product card's numbers and the totals strip (compare with design/ux/mockups/market/DATA.md);
//  (b) the popover rows: Enterprise's swap options for its second lineup slot, the add-a-model row and remove;
//  (c) preview = next tick: for (i) adding Atlas-4.0-mini to Enterprise's lineup, (ii) removing Atlas-3.0-mini from it,
//      (iii) Enterprise's stance switched to Win share, and (iv) the DATA.md swap Atlas-3.0-mini → Atlas-4.0-mini, the
//      preview's change a year (profit, revenue, work sold, serving need, turned away; the product and all products) vs
//      the revenue system's own readout on the next tick with the edit (product.update) minus the next tick without it.
// Run alone: npx tsx scripts/v2/_mk12/check.ts [save.json]
import { readFileSync } from 'node:fs';
import { deserialize } from '../../../src/engine/v2/core/save';
import { act, tick } from '../../../src/engine/v2/core/loop';
import { SERVE_HOURS_PER_YEAR } from '../../../src/data/v2/serving';
import { applyRevenue, revenueSystem, type DeploymentRevenue, type RevenueReadout } from '../../../src/engine/v2/worldfx/revenue';
import { serveDollarsPerHour } from '../../../src/engine/v2/worldfx/serving';
import { marketBase } from '../../../src/engine/v2/worldfx/productView';
import {
  editDelta, lineupAddOptions, lineupRemovePreview, lineupSwapOptions, productCards, productsStrip, stancePreview,
  type EditDelta, type MarketNumbers,
} from '../../../src/engine/v2/worldfx/marketView';
import type { ProductChanges } from '../../../src/engine/v2/models/productOps';
import type { GameStateV2 } from '../../../src/engine/v2/types';

const SAVE = process.argv[2] ?? 'C:/Users/david/Downloads/ai27-v2-day369.json';
let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const load = () => deserialize(readFileSync(SAVE, 'utf8'));
const B = (x: number) => (Math.abs(x) >= 10 ? x.toFixed(1) : Math.abs(x) >= 1 ? x.toFixed(2) : x.toFixed(3));
const $ = (x: number) => `$${B(x)}B`;
const sg = (x: number, f: (y: number) => string) => `${x >= 0 ? '+' : '−'}${f(Math.abs(x))}`;
const hB = (x: number) => `${(x / 1e9).toFixed(2)}B h`;
const kH = (x: number) => (x >= 1e6 ? `${(x / 1e6).toFixed(2)}M` : `${(x / 1e3).toFixed(1)}k`);
const pc = (x: number) => `${(100 * x).toFixed(0)}%`;
const nameOf = (s: GameStateV2, id: string) => s.player.models.versions.find((v) => v.id === id)?.name ?? id;
const idOf = (s: GameStateV2, name: string) => s.player.models.versions.find((v) => v.name === name)!.id;

// ── (a) cards and strip ──
const s0 = load();
const t0 = Date.now();
const base = marketBase(s0);
const cards = productCards(s0, base);
const strip = productsStrip(s0, base);
console.log(`(a) day ${s0.time.day}: ${cards.length} cards (readouts ${Date.now() - t0} ms)`);
for (const c of cards) {
  console.log(`  ${c.name} [${c.id}] sells to: ${c.buyers.label}`);
  console.log(`    profit ${$(c.money.profit)}/yr · margin ${pc(c.money.margin)} · revenue ${$(c.money.revenue)} · serving cost ${$(c.money.servingCost)}`);
  if (c.chat) console.log(`    users ${(c.chat.users / 1e9).toFixed(2)}B weekly · ${(c.chat.paying / 1e6).toFixed(1)}M pay · plan $${c.chat.price.toFixed(2)}/month${c.chat.atCap ? ' at the cap' : ''} (cap $${c.chat.cap})`);
  if (c.work) console.log(`    work sold ${hB(c.work.hours)}/yr (${hB(c.work.fromOwn)} from your other products) · avg $${c.work.avgPrice.toFixed(2)}/h · per model ${c.work.perModel.map((m) => `${m.name} $${m.price.toFixed(2)}`).join(', ')}${c.work.seats ? ` · seats ${(c.work.seats.seats / 1e6).toFixed(2)}M at $${c.work.seats.price.toFixed(2)}/month` : ''}${c.work.agentHour ? ` · agent-hour $${c.work.agentHour.toFixed(2)}` : ''}`);
  console.log(`    serving compute ${kH(c.compute.served)} of ${kH(c.compute.need)} needed${c.compute.short > 0 ? `, short ${kH(c.compute.short)}` : ''}${c.compute.freeLimited ? ' · free users rate-limited' : ''}${c.compute.payingShort ? ' · paying users short' : c.channel === 'consumer' ? ' · paying users all served' : ''}`);
  const ta = c.turnedAway;
  if (ta.dollars > 0 || ta.subs > 0) console.log(`    turned away ${$(ta.dollars)}/yr, ${c.channel === 'consumer' ? `${(ta.subs / 1e6).toFixed(2)}M paying users` : hB(ta.hours)} → ${ta.to.map((x) => `${x.name} ${c.channel === 'consumer' ? `${(x.subs / 1e6).toFixed(2)}M` : hB(x.hours)}`).join(', ')}`);
  else console.log('    turned away: none');
  console.log(`    stance ${c.stance === 'profit' ? 'Best profit' : 'Win share'}`);
  for (const r of c.lineup) console.log(`    lineup ${r.main ? '1 main' : '      '} ${r.name.padEnd(20)} skill ${r.skill.toFixed(2)} (bar ${pc(r.skillPos)}${r.evaluating ? ', parent reading' : ''}) ${c.channel === 'consumer' ? `serves ${r.serves}` : r.sellsNothing ? 'sells nothing' : `${pc(r.share)} of hours, $${r.price.toFixed(2)}/h`}`);
  console.log(`    add a model: ${c.canAdd} you could add`);
  console.log(`    tools: ${c.tools.on.map((t) => `${t.name}${t.certs.map((x) => ` [${x.name}: ${x.state}${x.daysLeft ? ` ${x.daysLeft} d` : ''}]`).join('')}`).join(', ') || 'none'} · add a tool: ${c.tools.more.length} more fit (${c.tools.more.filter((t) => t.built).length} built)`);
}
console.log(`  strip: profit from products ${$(strip.money.profit)}/yr · revenue ${$(strip.money.revenue)} − serving cost ${$(strip.money.servingCost)}`);
console.log(`  strip: serving compute ${kH(strip.compute.pool)} of ${kH(strip.compute.need)} needed, short ${kH(strip.compute.short)} · buyers turned away ${$(strip.turnedAway.dollars)}/yr (your other products took ${$(strip.turnedAway.keptByYou)})`);
console.log(`  strip: business buyers: your share ${(100 * strip.business.share).toFixed(1)}% → ${(100 * strip.business.target).toFixed(1)}% in ${Number.isFinite(strip.business.days) ? `${strip.business.days} d` : '> 3 yr'}; ${strip.business.rival?.name} ${(100 * (strip.business.rival?.share ?? 0)).toFixed(1)}%`);
const sumP = cards.reduce((a, c) => a + c.money.profit, 0);
check(Math.abs(sumP - strip.money.profit) < 1e-6, '(a) strip profit = sum of the cards', `${B(sumP)} vs ${B(strip.money.profit)}`);
check(cards.every((c) => !c.work || Math.abs((c.work.hours * c.work.avgPrice) / 1e9 - c.money.revenue) < 1e-6 * Math.max(1, c.money.revenue)), '(a) work sold × average price = revenue on every business card');
check(cards.every((c) => c.lineup.length > 0), '(a) every card has a lineup');

// ── (b) popover rows ──
const ent = s0.player.deployments.find((d) => d.channel === 'enterprise' && d.status !== 'withdrawn')!;
const slot = ent.lineup?.[0] ?? ent.versionId;
const line = (x: EditDelta) => x.blocked ? `blocked: ${x.blocked}` : `profit ${sg(x.all.profit, $)} (this product ${sg(x.product.profit, $)}) · work sold ${sg(x.all.hours, hB)} · need ${sg(x.product.need, kH)} H100e${x.allServed ? ' · all buyers served' : ''}`;
{
  const t = Date.now();
  const opts = lineupSwapOptions(s0, ent.id, slot, base);
  console.log(`(b) Enterprise › replace ${nameOf(s0, slot)} (${opts.length} options, ${Date.now() - t} ms):`);
  for (const o of opts) console.log(`    ${o.name.padEnd(20)}${o.isNew ? ' new' : '    '} skill ${o.skill.toFixed(2)} cost to serve ×${o.costRatio.toFixed(2)}: ${line(o.delta)}`);
  const rm = lineupRemovePreview(s0, ent.id, slot, base);
  if (rm) console.log(`    Remove from lineup: ${line(rm)}`);
  const add = lineupAddOptions(s0, ent.id, base);
  console.log(`  add a model (${add.length}):`);
  for (const o of add) console.log(`    ${o.name.padEnd(20)}${o.isNew ? ' new' : '    '} ${line(o.delta)}`);
  const st = stancePreview(s0, ent.id, base)!;
  console.log(`  stance ${st.from} → ${st.to}: ${line(st.delta)}`);
  check(opts.length > 0 && !!rm, '(b) Enterprise has swap options and a remove row');
}

// ── (c) preview = next tick ──
/** The revenue system's readout on the next tick (captured from the tick itself). */
function nextTickReadout(s: GameStateV2): RevenueReadout {
  let got: RevenueReadout | undefined;
  const run = revenueSystem.run;
  revenueSystem.run = (st, ctx) => { got = applyRevenue(st, ctx); };
  try { tick(s, { skip: ['endings'] }); } finally { revenueSystem.run = run; }
  return got!;
}
function numbersOfDep(s: GameStateV2, x: DeploymentRevenue | undefined): MarketNumbers {
  if (!x) return { profit: 0, revenue: 0, hours: 0, paying: 0, need: 0, turnedAway: 0 };
  const tco = (serveDollarsPerHour(s) * SERVE_HOURS_PER_YEAR) / 1e9;
  const hours = x.channel === 'consumer' ? 0 : Math.min(x.hours + (x.seatHours ?? 0), x.capHours) + x.spillIn.hours;
  return { profit: x.revenue - Math.min(x.servingH100e, x.needH100e) * tco, revenue: x.revenue, hours, paying: x.subs ?? 0, need: x.needH100e, turnedAway: x.turnedAway.dollars };
}
function sumDeps(s: GameStateV2, rd: RevenueReadout): MarketNumbers {
  const a = { profit: 0, revenue: 0, hours: 0, paying: 0, need: 0, turnedAway: 0 };
  for (const x of rd.deps) {
    const n = numbersOfDep(s, x);
    a.profit += n.profit; a.revenue += n.revenue; a.hours += n.hours; a.paying += n.paying; a.need += n.need; a.turnedAway += n.turnedAway;
  }
  return a;
}
const sub = (a: MarketNumbers, b: MarketNumbers): MarketNumbers => ({ profit: a.profit - b.profit, revenue: a.revenue - b.revenue, hours: a.hours - b.hours, paying: a.paying - b.paying, need: a.need - b.need, turnedAway: a.turnedAway - b.turnedAway });
const params = (id: string, c: ProductChanges): Record<string, string> => ({
  id, ...(c.versionId ? { versionId: c.versionId } : {}), ...(c.lineup ? { lineup: c.lineup.length ? c.lineup.join(',') : 'none' } : {}),
  ...(c.freeTierId !== undefined ? { freeTierId: c.freeTierId ?? 'none' } : {}), ...(c.stance ? { stance: c.stance } : {}),
});
/** Tolerance: 1.5% of the larger change plus a floor per quantity. */
const FLOOR: MarketNumbers = { profit: 0.05, revenue: 0.05, hours: 0.02e9, paying: 0.05e6, need: 1000, turnedAway: 0.05 };
const close = (a: number, b: number, floor: number) => Math.abs(a - b) <= 0.015 * Math.max(Math.abs(a), Math.abs(b)) + floor;

const noEdit = load();
const rdNo = nextTickReadout(noEdit);
const v40mini = idOf(s0, 'Atlas-4.0-mini');
const v30mini = idOf(s0, 'Atlas-3.0-mini');
const chat = s0.player.deployments.find((d) => d.channel === 'consumer' && d.status !== 'withdrawn')!;
const cases: [string, string, ProductChanges][] = [
  ['(i) add Atlas-4.0-mini to Enterprise', ent.id, { lineup: [...(ent.lineup ?? []), v40mini] }],
  ['(ii) remove Atlas-3.0-mini from Enterprise', ent.id, { lineup: (ent.lineup ?? []).filter((x) => x !== v30mini) }],
  ['(iii) Enterprise stance → Win share', ent.id, { stance: ent.stance === 'profit' ? 'share' : 'profit' }],
  ['(iv) Enterprise: Atlas-3.0-mini → Atlas-4.0-mini (DATA.md popover)', ent.id, { lineup: (ent.lineup ?? []).map((x) => (x === v30mini ? v40mini : x)) }],
  ['(v) Chat stance → Win share', chat.id, { stance: chat.stance === 'profit' ? 'share' : 'profit' }],
];
for (const [what, pid, c] of cases) {
  const pv = editDelta(s0, pid, c, base);
  const se = load();
  const err = act(se, 'product.update', params(pid, c));
  if (err || pv.blocked) { check(false, `${what}: edit allowed`, err ?? pv.blocked); continue; }
  const rdE = nextTickReadout(se);
  const tickProd = sub(numbersOfDep(se, rdE.deps.find((x) => x.id === pid)), numbersOfDep(noEdit, rdNo.deps.find((x) => x.id === pid)));
  const tickAll = sub(sumDeps(se, rdE), sumDeps(noEdit, rdNo));
  console.log(`(c) ${what}:`);
  const keys: (keyof MarketNumbers)[] = ['profit', 'revenue', 'hours', 'paying', 'need', 'turnedAway'];
  const fmt = (k: keyof MarketNumbers, x: number) => (k === 'hours' ? sg(x, hB) : k === 'need' ? sg(x, kH) : k === 'paying' ? sg(x, (y) => `${(y / 1e6).toFixed(2)}M`) : sg(x, $));
  let ok = true;
  const bad: string[] = [];
  for (const k of keys) {
    const a = close(pv.product[k], tickProd[k], FLOOR[k]);
    const b = close(pv.all[k], tickAll[k], FLOOR[k]);
    if (!a) bad.push(`product ${k}`);
    if (!b) bad.push(`all ${k}`);
    ok &&= a && b;
    console.log(`    ${k.padEnd(10)} preview: product ${fmt(k, pv.product[k]).padStart(10)} all ${fmt(k, pv.all[k]).padStart(10)} | next tick: product ${fmt(k, tickProd[k]).padStart(10)} all ${fmt(k, tickAll[k]).padStart(10)}`);
  }
  check(ok, `${what}: preview = next tick (1.5% + floor)`, bad.join(', '));
}

console.log(fails ? `${fails} FAIL` : 'all ok');
process.exitCode = fails ? 1 : 0;
