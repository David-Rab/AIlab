// MK-6 targeted check (design/MARKET.md M5, M6, MK-6 row): prices set by competition.
//  (a) the game start (newGame, default setup): each seller's hours-weighted margin (p − c)/p and share of the sector
//      buyers' adopted hours, per sector and overall; the leader's overall margin is in 0.8–0.9 (research/MARKET-sources.md
//      §3: margins 0.6–0.85 [P], the MK-R1 elasticity bound ≥ ≈ 0.9; overlap 0.8–0.9);
//  (b) the designer's day-369 save (read-only): a model sold on two products (Enterprise and Vetted) has one price;
//  (c) the designer's case: Agent-3-1.0-micro added to Enterprise's lineup, 30 days with and without: revenue and profit
//      (revenue − serving cost at the market rate) per product and total, and the compute the mini frees;
//  (d) 90 days on the day-369 save without throwing: total revenue / profit path.
// Run alone: npx tsx scripts/v2/_mk6/check.ts
import { readFileSync } from 'node:fs';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { deserialize } from '../../../src/engine/v2/core/save';
import { act, tick } from '../../../src/engine/v2/core/loop';
import { REGIONS, SECTORS } from '../../../src/data/v2/sectors';
import { PRICE_ELASTICITY, SERVE_HOURS_PER_YEAR } from '../../../src/data/v2/serving';
import { worldMix, type WorldMix } from '../../../src/engine/v2/worldfx/mix';
import { workHoursOf } from '../../../src/engine/v2/worldfx/use';
import { revenueReadout } from '../../../src/engine/v2/worldfx/revenue';
import { serveDollarsPerHour, valuePerHour } from '../../../src/engine/v2/worldfx/serving';
import type { GameStateV2 } from '../../../src/engine/v2/types';

const SAVE = 'C:/Users/david/Downloads/ai27-v2-day369.json';
let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const pct = (x: number) => `${(100 * x).toFixed(0).padStart(3)}%`;
const f1 = (x: number) => x.toFixed(1);

/** Per provider: adopted hours, revenue and serving cost of those hours ($/yr), per sector (all regions) and overall. */
function margins(s: GameStateV2, mix: WorldMix) {
  const n = mix.providers.length;
  const z = () => Array.from({ length: n }, () => ({ h: 0, p: 0, c: 0 }));
  const bySec: Record<string, { h: number; p: number; c: number }[]> = {};
  const all = z();
  for (const def of SECTORS) {
    const row = (bySec[def.id] = z());
    for (const r of REGIONS) {
      const m = mix.sec[r][def.id];
      const wh = workHoursOf(s.world.sectors[r][def.id], def.id);
      for (let i = 0; i < n; i++) {
        const x = m.share[i] * wh.adopted;
        if (!(x > 0)) continue;
        const w = m.tiers.weight[i];
        let p = 0;
        let c = 0;
        for (let k = 0; k < w.length; k++) {
          p += w[k] * m.tiers.price[i][k];
          c += w[k] * m.tiers.offers[i][k].cost;
        }
        for (const a of [row[i], all[i]]) {
          a.h += x;
          a.p += x * p;
          a.c += x * c;
        }
      }
    }
  }
  return { bySec, all };
}
const mOf = (a: { p: number; c: number }) => (a.p > 0 ? (a.p - a.c) / a.p : 0);

// (a) the game start.
for (const seed of (process.env.MK6_SEEDS ?? "2027,7,42").split(",").map(Number)) {
  const t0 = Date.now();
  const s = newGame(defaultSetupV2({ seed }));
  const ms = Date.now() - t0;
  const mix = worldMix(s);
  const { bySec, all } = margins(s, mix);
  const keys = mix.providers.map((p) => p.key);
  const H = all.reduce((a, x) => a + x.h, 0);
  console.log(`(a) game start, seed ${seed} (newGame ${ms} ms incl. the price fixed point), ε = PRICE_ELASTICITY = ${PRICE_ELASTICITY}`);
  console.log(`    margin (p − c)/p of adopted hours, and share of them, per seller: ${keys.join(' / ')}`);
  for (const def of SECTORS) {
    const row = bySec[def.id];
    const h = row.reduce((a, x) => a + x.h, 0);
    console.log(`    ${def.id.padEnd(6)} ${row.map((x) => (x.h > 0 ? `${pct(mOf(x))} @${pct(x.h / h)}` : '   —      ')).join('   ')}`);
  }
  console.log(`    ALL    ${all.map((x) => `${pct(mOf(x))} @${pct(x.h / H)}`).join('   ')}`);
  // The leader: the closed seller with the most adopted hours (DeepCent's open weights are hosted near cost).
  let lead = -1;
  for (let i = 0; i < all.length; i++) if (!mix.providers[i].open && (lead < 0 || all[i].h > all[lead].h)) lead = i;
  const HW = SECTORS.reduce((a, def) => a + REGIONS.filter((r) => r !== 'CN').reduce((b, r) => b + workHoursOf(s.world.sectors[r][def.id], def.id).adopted * mix.sec[r][def.id].share[lead], 0), 0);
  const HT = SECTORS.reduce((a, def) => a + REGIONS.filter((r) => r !== 'CN').reduce((b, r) => b + workHoursOf(s.world.sectors[r][def.id], def.id).adopted, 0), 0);
  console.log(`    open weights: ${mix.providers.filter((p) => p.open).map((p) => p.key).join(', ') || 'none'}; the leader's share outside China ${(HW / HT).toFixed(2)}`);
  const ml = mOf(all[lead]);
  check(ml >= 0.8 && ml <= 0.9, `(a) the leader's (${keys[lead]}) hours-weighted margin at the start is 0.8–0.9`, `${ml.toFixed(3)} at a ${(all[lead].h / H).toFixed(2)} share`);
  const rd = revenueReadout(s, mix);
  console.log(`    player revenue at the start $${f1(rd.total)}B/yr: ${rd.deps.map((x) => `${x.channel} ${f1(x.revenue)}${x.seats ? ` (seats $${(x.seatDemand ?? 0).toFixed(2)}B at $${(x.seatPrice ?? 0).toFixed(2)}/month, cost $${(x.seatCost ?? 0).toFixed(2)})` : ''}`).join(', ')}`);
  // The start is near the fixed point: each closed seller's M near its target (hours-weighted; a few cells sit on a
  // discrete switch of the band choice, e.g. which tier wins the easiest band, and keep moving by a few % a step).
  let gap = 0;
  let gw = 0;
  let gmax = 0;
  let at = '';
  for (const r of REGIONS) for (const def of SECTORS) {
    const m = mix.sec[r][def.id];
    const h = workHoursOf(s.world.sectors[r][def.id], def.id).adopted;
    // MK-6b: per seller and model, weighted by the model's hours (its tiers' part of the seller's).
    m.markupTarget.forEach((tg, i) => {
      if (!(m.share[i] > 0)) return;
      tg.forEach((x, j) => {
        if (!Number.isFinite(x)) return;
        let wk = 0;
        m.tierModel[i].forEach((mj, k) => { if (mj === j) wk += m.tiers.weight[i][k] ?? 0; });
        if (!(wk > 0)) return;
        const g = Math.abs(x - m.markup[i][j]) / x;
        gap += h * m.share[i] * wk * g;
        gw += h * m.share[i] * wk;
        if (g > gmax && m.share[i] * wk > 0.01) { gmax = g; at = `${r} ${def.id} ${keys[i]} ${m.markupModels[i][j]}`; }
      });
    });
  }
  check(gap / gw < 0.02, '(a) the start prices are at the fixed point (hours-weighted |M* − M| ÷ M* < 2%)', `${(100 * gap / gw).toFixed(2)}%; largest ${(100 * gmax).toFixed(1)}% at ${at}`);
}

if (process.env.MK6_ONLY === "a") process.exit(fails ? 1 : 0);
const json = readFileSync(SAVE, "utf8");
const load = () => deserialize(json);
const nameOf = (s: GameStateV2, id: string) => s.player.models.versions.find((v) => v.id === id)?.name ?? id;

// (b) one model on two products has one price.
{
  const s = load();
  const mix = worldMix(s);
  const deps = s.player.deployments.filter((d) => d.status !== 'withdrawn');
  const ent = deps.find((d) => d.channel === 'enterprise');
  const vet = deps.find((d) => d.channel === 'vetted');
  console.log(`(b) day ${s.time.day}: Enterprise ${ent ? `${nameOf(s, ent.versionId)} + [${(ent.lineup ?? []).map((id) => nameOf(s, id)).join(', ')}]` : 'none'}; Vetted ${vet ? `${nameOf(s, vet.versionId)} + [${(vet.lineup ?? []).map((id) => nameOf(s, id)).join(', ')}]` : 'none'}`);
  if (!ent || !vet) check(false, '(b) the save has Enterprise and Vetted');
  else {
    const idsOf = (d: typeof ent) => [d.versionId, ...(d.lineup ?? []).filter((id) => id !== d.versionId)];
    const common = idsOf(ent).filter((id) => idsOf(vet).includes(id));
    // the same model under the same settings has the same cost; with a different safeguard or tool set the costs differ,
    // so compare cost + M: price − cost must match (and price itself where the costs match).
    let worst = 0;
    let worstAt = '';
    let n = 0;
    let nSame = 0;
    let nDiff = 0;
    const lines: string[] = [];
    for (const r of REGIONS) for (const def of SECTORS) {
      const m = mix.sec[r][def.id];
      const le = m.playerLines[ent.id];
      const lv = m.playerLines[vet.id];
      if (!le || !lv) continue;
      for (const id of common) {
        const a = le[idsOf(ent).indexOf(id)];
        const b = lv[idsOf(vet).indexOf(id)];
        if (!a || !b) continue;
        n++;
        // Same cost (same model, same tools there): one price. Different cost (a tool that adds tokens on one product):
        // the same margin over each one's cost.
        const sameCost = Math.abs(a.cost - b.cost) <= 1e-12 * Math.max(a.cost, b.cost);
        if (sameCost) nSame++;
        else nDiff++;
        const d = sameCost ? Math.abs(a.price - b.price) / Math.max(a.price, b.price) : Math.abs(a.price - a.cost - (b.price - b.cost)) / Math.max(a.price, b.price);
        if (d > worst) worstAt = `${r} ${def.id} ${nameOf(s, id)}: Enterprise $${a.price.toFixed(3)} (cost ${a.cost.toFixed(3)}), Vetted $${b.price.toFixed(3)} (cost ${b.cost.toFixed(3)}), value $${valuePerHour(s, def.id, r).toFixed(2)}`;
        worst = Math.max(worst, d);
        if (r === 'US' && lines.length < 4) lines.push(`${def.id} ${nameOf(s, id)}: Enterprise $${a.price.toFixed(3)} (cost ${a.cost.toFixed(3)}), Vetted $${b.price.toFixed(3)} (cost ${b.cost.toFixed(3)})`);
      }
    }
    for (const l of lines) console.log(`    ${l}`);
    console.log(`    largest gap: ${worstAt}`);
    check(nSame > 0 && worst < 1e-9, `(b) the same model on Enterprise and Vetted has one price in every sector × region where it costs the same, and the same margin over cost where a tool changes its cost on one product`, `${common.map((id) => nameOf(s, id)).join(', ')}; ${nSame} pairs at one cost, ${nDiff} at different costs; max relative gap ${worst.toExponential(1)}`);
  }
}

if (process.env.MK6_ONLY === 'ab') process.exit(fails ? 1 : 0);
// (c) Agent-3-1.0-micro in Enterprise's lineup.
function econ(s: GameStateV2) {
  const rd = revenueReadout(s);
  const rate = serveDollarsPerHour(s);
  const per = rd.deps.map((x) => {
    const cost = (Math.min(x.servingH100e, x.needH100e) * SERVE_HOURS_PER_YEAR * rate) / 1e9;
    return { id: x.id, ch: x.channel, rev: x.revenue, profit: x.revenue - cost, need: x.needH100e, served: x.servingH100e };
  });
  return { per, rev: per.reduce((a, x) => a + x.rev, 0), profit: per.reduce((a, x) => a + x.profit, 0), need: per.reduce((a, x) => a + x.need, 0) };
}
{
  const s0 = load();
  const mini = s0.player.models.versions.find((v) => /Agent-3-1.0-micro/i.test(v.name));
  const ent = s0.player.deployments.find((d) => d.channel === 'enterprise' && d.status !== 'withdrawn');
  console.log(`(c) ${mini ? mini.name : 'no Agent-3-1.0-micro'} into ${ent ? `Enterprise (${ent.id})` : 'no Enterprise'}`);
  if (mini && ent) {
    const runs: Record<string, ReturnType<typeof econ>> = {};
    for (const withMini of [false, true]) {
      const s = load();
      if (withMini) {
        const d = s.player.deployments.find((x) => x.id === ent.id)!;
        const err = act(s, 'product.update', { id: d.id, lineup: [...(d.lineup ?? []), mini.id].join(',') });
        if (err) console.log(`    product.update: ${err}`);
      }
      const day0 = econ(s);
      for (let i = 0; i < 30; i++) tick(s, { skip: ['endings'] });
      const e = (runs[withMini ? 'with' : 'without'] = econ(s));
      console.log(`    ${withMini ? 'with   ' : 'without'} day+0 rev $${f1(day0.rev)}B profit $${f1(day0.profit)}B → day+30 rev $${f1(e.rev)}B profit $${f1(e.profit)}B/yr; need ${(e.need / 1e3).toFixed(0)}K H100e`);
      for (const x of e.per) console.log(`        ${x.ch.padEnd(10)} rev $${f1(x.rev)}B  profit $${f1(x.profit)}B  need ${(x.need / 1e3).toFixed(0)}K, served ${(x.served / 1e3).toFixed(0)}K H100e`);
    }
    const a = runs.without;
    const b = runs['with'];
    console.log(`    compute freed by the mini: ${((a.need - b.need) / 1e3).toFixed(0)}K H100e of need; Enterprise rev ${f1(a.per.find((x) => x.id === ent.id)!.rev)} → ${f1(b.per.find((x) => x.id === ent.id)!.rev)}, profit ${f1(a.per.find((x) => x.id === ent.id)!.profit)} → ${f1(b.per.find((x) => x.id === ent.id)!.profit)}`);
    check(b.profit >= 0.9 * a.profit, '(c) adding the mini does not collapse profit (≥ 0.9 × without; cost-plus cut revenue $82B → $51B)', `total profit ${f1(a.profit)} → ${f1(b.profit)}, revenue ${f1(a.rev)} → ${f1(b.rev)}`);
  }
}

// (d) 90 days on the day-369 save.
{
  const s = load();
  const path: string[] = [];
  let ok = true;
  try {
    for (let i = 1; i <= 90; i++) {
      tick(s, { skip: ['endings'] });
      if (i % 15 === 0) {
        const e = econ(s);
        path.push(`d+${i} $${f1(e.rev)}B / $${f1(e.profit)}B`);
      }
    }
  } catch (e) {
    ok = false;
    console.log(String((e as Error).stack ?? e));
  }
  console.log(`(d) revenue / profit (player, $B/yr): ${path.join('; ')}`);
  check(ok, '(d) 90 days on the day-369 save without throwing');
}
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exitCode = fails ? 1 : 0;
