// MK-6b targeted check (design/MARKET.md M5 revised, MK-6b row): the margin is per seller × model.
//  (a) the game start: per seller per model, margin M ($ per adopted task-hour), price and its hours share in a few
//      sectors (US); every closed seller's cheaper models (lower cost here) that win hours carry lower $ margins than
//      its frontier model (tier 0);
//  (b) scripts/v2/serving.ts TIERS E7 reproduced (day 20 of the default game, the API's US Software hours by tier): the
//      students take bands, and the lineup's cost and price per hour are below the main model's;
//  (c) the designer's day-369 save: the same model on Enterprise and Vetted has one price (one margin over cost where a
//      tool changes its cost); Agent-3-1.0-micro into Enterprise's lineup, 30 days with and without: revenue and profit
//      (MK-6, one margin per seller: 97.1 / 75.8 without, 146.9 / 135.5 with);
//  (d) the start leader's hours-weighted margin (p − c)/p ≈ 0.8–0.9.
// Run alone: npx tsx scripts/v2/_mk6b/check.ts
import { readFileSync } from 'node:fs';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { deserialize } from '../../../src/engine/v2/core/save';
import { act, tick } from '../../../src/engine/v2/core/loop';
import { REGIONS, SECTORS } from '../../../src/data/v2/sectors';
import { SERVE_HOURS_PER_YEAR } from '../../../src/data/v2/serving';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { workHoursOf } from '../../../src/engine/v2/worldfx/use';
import { revenueReadout } from '../../../src/engine/v2/worldfx/revenue';
import { blendTiers, productOffer, serveDollarsPerHour } from '../../../src/engine/v2/worldfx/serving';
import type { Deployment, GameStateV2 } from '../../../src/engine/v2/types';

const SAVE = 'C:/Users/david/Downloads/ai27-v2-day369.json';
let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const f1 = (x: number) => x.toFixed(1);
const f3 = (x: number) => x.toFixed(3);
const game = () => newGame(defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', baseline: 'classic', tutorial: false }));
const run = (s: GameStateV2, n: number) => { for (let i = 0; i < n; i++) tick(s, { skip: ['endings'] }); };
const prod = (s: GameStateV2, ch: Deployment['channel']) => s.player.deployments.find((d) => d.channel === ch && d.status !== 'withdrawn')!;
const nameOf = (s: GameStateV2, id: string) =>
  s.player.models.versions.find((v) => v.id === id)?.name
  ?? [...s.rivals, s.china.lab].flatMap((r) => [r.publicModel, ...(r.lineup ?? [])]).find((m) => m?.id === id)?.name
  ?? id;

// (a) + (d) the game start.
{
  const s = game();
  const mix = worldMix(s);
  const keys = mix.providers.map((p) => p.key);
  let bad = 0;
  let pairs = 0;
  let worst = '';
  for (const r of REGIONS) for (const def of SECTORS) {
    const m = mix.sec[r][def.id];
    const show = r === 'US' && ['SOFT', 'LEGAL', 'SERV'].includes(def.id);
    if (show) console.log(`(a) US ${def.id}: per seller per model: margin M $/h, price $/h, cost $/h, part of the seller's hours there; seller share`);
    for (let i = 0; i < keys.length; i++) {
      if (mix.providers[i].open || !(m.share[i] > 0)) continue;
      const ids = m.markupModels[i];
      const w = m.tiers.weight[i];
      const tm = m.tierModel[i];
      const hours = ids.map((_, j) => tm.reduce((a, mj, k) => a + (mj === j ? w[k] ?? 0 : 0), 0));
      // one row per model: its first tier's cost and price (the player's Win-share products at f·M are not the M here).
      const first = ids.map((_, j) => tm.indexOf(j));
      const cost = first.map((k) => m.tiers.offers[i][k].cost);
      const price = first.map((k) => m.tiers.price[i][k]);
      if (show) console.log(`    ${keys[i].padEnd(7)} share ${f3(m.share[i])}: ${ids.map((id, j) => `${nameOf(s, id)} M ${f3(m.markup[i][j])} p ${f3(price[j])} c ${f3(cost[j])} @${(100 * hours[j]).toFixed(0)}%`).join('; ')}`);
      for (let j = 1; j < ids.length; j++) {
        if (!(hours[j] > 0.01) || !(cost[j] < cost[0])) continue;
        pairs++;
        if (!(m.markup[i][j] < m.markup[i][0])) {
          bad++;
          worst ||= `${r} ${def.id} ${keys[i]} ${nameOf(s, ids[j])} M ${f3(m.markup[i][j])} ≥ ${nameOf(s, ids[0])} M ${f3(m.markup[i][0])}`;
        }
      }
    }
  }
  check(pairs > 0 && bad === 0, '(a) at the start every closed seller\'s cheaper model that wins hours carries a lower $ margin than its frontier model', `${pairs} (model, sector, region) pairs, ${bad} not lower${worst ? `; e.g. ${worst}` : ''}`);

  // (d) the leader's hours-weighted margin.
  const n = keys.length;
  const acc = Array.from({ length: n }, () => ({ h: 0, p: 0, c: 0 }));
  for (const r of REGIONS) for (const def of SECTORS) {
    const m = mix.sec[r][def.id];
    const wh = workHoursOf(s.world.sectors[r][def.id], def.id).adopted;
    for (let i = 0; i < n; i++) {
      const x = m.share[i] * wh;
      if (!(x > 0)) continue;
      const w = m.tiers.weight[i];
      for (let k = 0; k < w.length; k++) {
        acc[i].h += x * w[k];
        acc[i].p += x * w[k] * m.tiers.price[i][k];
        acc[i].c += x * w[k] * m.tiers.offers[i][k].cost;
      }
    }
  }
  let lead = -1;
  for (let i = 0; i < n; i++) if (!mix.providers[i].open && (lead < 0 || acc[i].h > acc[lead].h)) lead = i;
  const ml = (acc[lead].p - acc[lead].c) / acc[lead].p;
  const H = acc.reduce((a, x) => a + x.h, 0);
  console.log(`(d) hours-weighted margins (p − c)/p: ${keys.map((k, i) => `${k} ${acc[i].p > 0 ? f3((acc[i].p - acc[i].c) / acc[i].p) : '—'} @${f3(acc[i].h / H)}`).join(', ')}`);
  check(ml >= 0.8 && ml <= 0.9, `(d) the start leader's (${keys[lead]}) hours-weighted margin is 0.8–0.9`, f3(ml));
}

// (b) TIERS E7 (scripts/v2/serving.ts), reproduced: day 20 of the default game.
{
  const s = game();
  run(s, 20);
  const api = prod(s, 'api');
  const mix0 = worldMix(s);
  const w0 = mix0.sec.US.SOFT.playerTierW[api.id] ?? [];
  const main = productOffer(s, api, 'SOFT');
  const stud = 1 - (w0[0] ?? 1);
  const L = mix0.lineupBy.get(`${api.id}|SOFT`) ?? [main];
  const blended = blendTiers(L, w0);
  const pl = mix0.sec.US.SOFT.playerLines[api.id] ?? [];
  console.log(`(b) day ${s.time.day} API US Software: tiers ${pl.map((o, k) => `${nameOf(s, k === 0 ? api.versionId : (api.lineup ?? []).filter((id) => id !== api.versionId)[k - 1])} p ${f3(o.price)} c ${f3(o.cost)} @${(100 * (w0[k] ?? 0)).toFixed(0)}%`).join('; ')}`);
  check(stud > 0.05 && Math.abs(w0.reduce((a, x) => a + x, 0) - 1) < 1e-9 && blended.cost < main.cost && blended.price < main.price,
    '(b) TIERS E7: the API\'s students take US Software bands (hours by tier sum to 1); its lineup cost and price per hour are below its main model\'s',
    `hours by tier ${w0.map((x) => x.toFixed(2)).join(' / ')}; cost $${f3(main.cost)} → $${f3(blended.cost)}, price $${f3(main.price)} → $${f3(blended.price)}`);
}

// (c) the day-369 save.
function econ(s: GameStateV2) {
  const rd = revenueReadout(s);
  const rate = serveDollarsPerHour(s);
  const per = rd.deps.map((x) => {
    const cost = (Math.min(x.servingH100e, x.needH100e) * SERVE_HOURS_PER_YEAR * rate) / 1e9;
    return { id: x.id, ch: x.channel, rev: x.revenue, profit: x.revenue - cost, need: x.needH100e };
  });
  return { per, rev: per.reduce((a, x) => a + x.rev, 0), profit: per.reduce((a, x) => a + x.profit, 0), need: per.reduce((a, x) => a + x.need, 0) };
}
{
  const json = readFileSync(SAVE, 'utf8');
  const load = () => deserialize(json);
  const s = load();
  const mix = worldMix(s);
  const deps = s.player.deployments.filter((d) => d.status !== 'withdrawn');
  const ent = deps.find((d) => d.channel === 'enterprise')!;
  const vet = deps.find((d) => d.channel === 'vetted')!;
  const idsOf = (d: Deployment) => [d.versionId, ...(d.lineup ?? []).filter((id) => id !== d.versionId)];
  const common = idsOf(ent).filter((id) => idsOf(vet).includes(id));
  let worst = 0;
  let nSame = 0;
  for (const r of REGIONS) for (const def of SECTORS) {
    const m = mix.sec[r][def.id];
    const le = m.playerLines[ent.id];
    const lv = m.playerLines[vet.id];
    if (!le || !lv) continue;
    for (const id of common) {
      const a = le[idsOf(ent).indexOf(id)];
      const b = lv[idsOf(vet).indexOf(id)];
      if (!a || !b) continue;
      const same = Math.abs(a.cost - b.cost) <= 1e-12 * Math.max(a.cost, b.cost);
      if (same) nSame++;
      worst = Math.max(worst, same ? Math.abs(a.price - b.price) / Math.max(a.price, b.price) : Math.abs(a.price - a.cost - (b.price - b.cost)) / Math.max(a.price, b.price));
    }
  }
  check(nSame > 0 && worst < 1e-9, '(c) day-369 save: the same model on Enterprise and Vetted has one price (one margin over cost where a tool changes the cost)', `${common.map((id) => nameOf(s, id)).join(', ')}; ${nSame} pairs at one cost; max gap ${worst.toExponential(1)}`);
  // the save's per-model margins in US Software (player)
  const m = mix.sec.US.SOFT;
  const pi = mix.providers.findIndex((p) => p.key === 'player');
  console.log(`    US SOFT player margins: ${m.markupModels[pi].map((id, j) => `${nameOf(s, id)} ${f3(m.markup[pi][j])}`).join(', ')}`);

  const mini = s.player.models.versions.find((v) => /Agent-3-1.0-micro/i.test(v.name));
  if (!mini) check(false, '(c) the save has Agent-3-1.0-micro');
  else {
    const runs: Record<string, ReturnType<typeof econ>> = {};
    for (const withMini of [false, true]) {
      const x = load();
      if (withMini) {
        const d = x.player.deployments.find((y) => y.id === ent.id)!;
        const err = act(x, 'product.update', { id: d.id, lineup: [...(d.lineup ?? []), mini.id].join(',') });
        if (err) console.log(`    product.update: ${err}`);
      }
      const e0 = econ(x);
      run(x, 30);
      const e = (runs[withMini ? 'with' : 'without'] = econ(x));
      console.log(`    ${withMini ? 'with   ' : 'without'} day+0 rev $${f1(e0.rev)}B profit $${f1(e0.profit)}B → day+30 rev $${f1(e.rev)}B profit $${f1(e.profit)}B/yr; need ${(e.need / 1e3).toFixed(0)}K H100e`);
      for (const y of e.per) console.log(`        ${y.ch.padEnd(10)} rev $${f1(y.rev)}B  profit $${f1(y.profit)}B`);
      if (withMini) {
        const mm = worldMix(x).sec.US.SOFT;
        const pj = worldMix(x).providers.findIndex((p) => p.key === 'player');
        console.log(`        US SOFT player margins at day+30: ${mm.markupModels[pj].map((id, j) => `${nameOf(x, id)} ${f3(mm.markup[pj][j])}`).join(', ')}`);
      }
    }
    check(runs.with.profit >= 0.9 * runs.without.profit, '(c) adding Agent-3-1.0-micro to Enterprise keeps profit (≥ 0.9 × without)', `profit ${f1(runs.without.profit)} → ${f1(runs.with.profit)}, revenue ${f1(runs.without.rev)} → ${f1(runs.with.rev)} (MK-6: 75.8 → 135.5, 97.1 → 146.9)`);
  }
}
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exitCode = fails ? 1 : 0;
