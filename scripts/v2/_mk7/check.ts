// MK-7 targeted check (design/MARKET.md M7, MK-7 row): rationing at the list price, unserved buyers to their next choice.
//  (a) both designer saves (read-only): per product its serving need and served compute, the buyers it turns away
//      ($/yr, hours / subscribers) and where they went (own products / each rival / no AI);
//  (b) the designer's day-296 case: Enterprise moved to Atlas-3.0 (product.update versionId = the internal model's
//      version), 30 days with and without: no unserved demand vanishes on any day (turned away = to other sellers + to
//      no AI), revenue and profit per product and total;
//  (c) 90 days on the day-369 save without throwing: the player's sector customer share (hours-weighted) and the
//      buyers turned away along the way.
// Run alone: npx tsx scripts/v2/_mk7/check.ts
import { readFileSync } from 'node:fs';
import { deserialize } from '../../../src/engine/v2/core/save';
import { act, tick } from '../../../src/engine/v2/core/loop';
import { REGIONS, SECTORS } from '../../../src/data/v2/sectors';
import { SERVE_HOURS_PER_YEAR } from '../../../src/data/v2/serving';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { workHoursOf } from '../../../src/engine/v2/worldfx/use';
import { revenueReadout, type RevenueReadout, type TurnedAway } from '../../../src/engine/v2/worldfx/revenue';
import { serveDollarsPerHour } from '../../../src/engine/v2/worldfx/serving';
import type { GameStateV2 } from '../../../src/engine/v2/types';

const SAVES = { d296: 'C:/Users/david/Downloads/ai27-v2-day296.json', d369: 'C:/Users/david/Downloads/ai27-v2-day369.json' };
let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const f1 = (x: number) => x.toFixed(1);
const f2 = (x: number) => x.toFixed(2);
const bh = (x: number) => `${(x / 1e9).toFixed(2)}B h`;
const load = (f: string) => deserialize(readFileSync(f, 'utf8'));
const nameOf = (s: GameStateV2, id: string) => s.player.models.versions.find((v) => v.id === id)?.name ?? id;
const destName = (s: GameStateV2, k: string) => (k === 'none' ? 'no AI' : s.player.deployments.find((d) => d.id === k) ? `own ${k}` : k);

/** Hours (or subscribers) conservation: turned away = Σ destinations; returns the relative gap. */
function gap(t: TurnedAway): number {
  let h = 0;
  let u = 0;
  for (const k in t.to) {
    h += t.to[k].hours;
    u += t.to[k].subs;
  }
  return Math.max(t.hours > 0 ? Math.abs(h - t.hours) / t.hours : h, t.subs > 0 ? Math.abs(u - t.subs) / t.subs : u);
}
function show(s: GameStateV2, rd: RevenueReadout, pad = '    ') {
  for (const x of rd.deps) {
    const t = x.turnedAway;
    const to = Object.entries(t.to).sort((a, b) => b[1].hours + b[1].subs - a[1].hours - a[1].subs)
      .map(([k, v]) => `${destName(s, k)} ${x.channel === 'consumer' ? `${(v.subs / 1e6).toFixed(2)}M subs` : bh(v.hours)} ($${f2(v.dollars)}B)`).join(', ');
    console.log(`${pad}${x.id} ${x.channel.padEnd(10)} ${nameOf(s, s.player.deployments.find((d) => d.id === x.id)!.versionId).padEnd(18)} need ${(x.needH100e / 1e3).toFixed(0)}K served ${(x.servingH100e / 1e3).toFixed(0)}K H100e; rev $${f1(x.revenue)}B` +
      (t.hours + t.subs > 0 ? `; turned away $${f2(t.dollars)}B/yr, ${x.channel === 'consumer' ? `${(t.subs / 1e6).toFixed(2)}M subs` : bh(t.hours)} → ${to}` : '') +
      (x.spillIn.hours > 0 ? `; took ${bh(x.spillIn.hours)} ($${f2(x.spillIn.dollars)}B) from own products` : ''));
  }
  const T = rd.turnedAway;
  console.log(`${pad}total turned away $${f2(T.dollars)}B/yr, ${bh(T.hours)}, ${(T.subs / 1e6).toFixed(2)}M subs; rivals earn $${f2(Object.values(rd.spillRev).reduce((a, b) => a + b, 0))}B/yr on them`);
}
function econ(s: GameStateV2, rd = revenueReadout(s)) {
  const rate = serveDollarsPerHour(s);
  const per = rd.deps.map((x) => ({ id: x.id, ch: x.channel, rev: x.revenue, profit: x.revenue - (Math.min(x.servingH100e, x.needH100e + 0) * SERVE_HOURS_PER_YEAR * rate) / 1e9 }));
  return { per, rev: per.reduce((a, x) => a + x.rev, 0), profit: per.reduce((a, x) => a + x.profit, 0) };
}
/** The player's hours-weighted share of the sector buyers' adopted hours (customer stock). */
function playerShare(s: GameStateV2) {
  const mix = worldMix(s);
  const p = mix.providers.findIndex((q) => q.key === 'player');
  let a = 0;
  let b = 0;
  for (const r of REGIONS) for (const def of SECTORS) {
    const h = workHoursOf(s.world.sectors[r][def.id], def.id).adopted;
    a += h * (p >= 0 ? mix.sec[r][def.id].share[p] : 0);
    b += h;
  }
  return b > 0 ? a / b : 0;
}

// (a) both saves as loaded.
for (const [k, f] of Object.entries(SAVES)) {
  const s = load(f);
  const rd = revenueReadout(s);
  console.log(`(a) ${k} (day ${s.time.day}, serving ${s.player.policies.servingAuto ? 'Auto' : 'manual'}):`);
  show(s, rd);
  check(rd.deps.every((x) => gap(x.turnedAway) < 1e-6), `(a) ${k}: every product's turned-away hours = the hours that went elsewhere + to no AI`, rd.deps.map((x) => `${x.id} ${gap(x.turnedAway).toExponential(1)}`).join(' '));
}

// (a2) spillover into the player's own spare compute: day 369, manual serving, API given twice its need (taken from
// Enterprise), so Enterprise's large and vetted buyers can fall to API.
{
  const s = load(SAVES.d369);
  const rd0 = revenueReadout(s);
  const pool = rd0.deps.reduce((a, x) => a + x.servingH100e, 0);
  const api = rd0.deps.find((x) => x.channel === 'api')!;
  s.player.policies.servingAuto = false;
  for (const d of s.player.deployments) {
    const x = rd0.deps.find((y) => y.id === d.id);
    if (!x) continue;
    d.servingShare = (d.id === api.id ? 2 * x.needH100e : x.channel === 'enterprise' ? x.servingH100e - api.needH100e : x.servingH100e) / pool;
  }
  const rd = revenueReadout(s);
  console.log('(a2) day 369, manual serving, API with spare compute:');
  show(s, rd);
  const a = rd.deps.find((x) => x.id === api.id)!;
  check(a.spillIn.hours > 0 && rd.deps.every((x) => gap(x.turnedAway) < 1e-6), '(a2) a product with spare compute takes turned-away buyers of another; hours conserved', `API took ${bh(a.spillIn.hours)} ($${f2(a.spillIn.dollars)}B), spare left ${((a.servingH100e - a.needH100e) / 1e3).toFixed(0)}K H100e`);
}

// (b) day 296: Enterprise → Atlas-3.0 (the internal model's version).
{
  const s0 = load(SAVES.d296);
  const ent = s0.player.deployments.find((d) => d.channel === 'enterprise' && d.status !== 'withdrawn');
  const internal = s0.player.deployments.find((d) => d.channel === 'internal' && d.status !== 'withdrawn');
  console.log(`(b) day 296: Enterprise ${ent?.id} on ${ent ? nameOf(s0, ent.versionId) : '-'} → ${internal ? nameOf(s0, internal.versionId) : '-'}`);
  const runs: Record<string, ReturnType<typeof econ>> = {};
  for (const move of [false, true]) {
    const s = load(SAVES.d296);
    if (move && ent && internal) {
      const err = act(s, 'product.update', { id: ent.id, versionId: internal.versionId });
      if (err) console.log(`    product.update: ${err}`);
    }
    let worst = 0;
    let away = 0;
    let none = 0;
    let rival = 0;
    for (let i = 0; i < 30; i++) {
      tick(s, { skip: ['endings'] });
      const rd = revenueReadout(s);
      for (const x of rd.deps) worst = Math.max(worst, gap(x.turnedAway));
      away += rd.turnedAway.hours / 30;
      none += (rd.turnedAway.to.none?.hours ?? 0) / 30;
      rival += Object.values(rd.spillRev).reduce((a, b) => a + b, 0) / 30;
    }
    const rd = revenueReadout(s);
    const e = econ(s, rd);
    runs[move ? 'with' : 'without'] = e;
    console.log(`  ${move ? 'Enterprise on Atlas-3.0' : 'as saved'}: day+30 revenue $${f1(e.rev)}B, profit $${f1(e.profit)}B/yr; mean turned away ${bh(away)}/yr (to no AI ${bh(none)}), rivals' revenue on them $${f2(rival)}B/yr; player share ${(100 * playerShare(s)).toFixed(1)}%`);
    show(s, rd, '      ');
    for (const x of e.per) console.log(`      ${x.id} ${x.ch.padEnd(10)} rev $${f1(x.rev)}B  profit $${f1(x.profit)}B`);
    check(worst < 1e-6, `(b) ${move ? 'with' : 'without'} the move: no turned-away demand vanishes on any of 30 days (turned away = elsewhere + no AI)`, `worst relative gap ${worst.toExponential(1)}`);
  }
  console.log(`  move effect: revenue ${f1(runs.without.rev)} → ${f1(runs.with.rev)}, profit ${f1(runs.without.profit)} → ${f1(runs.with.profit)} $B/yr`);
}

// (c) 90 days on day 369.
{
  const s = load(SAVES.d369);
  const path: string[] = [];
  let threw = '';
  try {
    for (let i = 0; i <= 90; i++) {
      if (i % 15 === 0) {
        const rd = revenueReadout(s);
        const e = econ(s, rd);
        path.push(`d+${i} share ${(100 * playerShare(s)).toFixed(1)}% rev $${f1(e.rev)}B profit $${f1(e.profit)}B away ${bh(rd.turnedAway.hours)} ($${f2(rd.turnedAway.dollars)}B)`);
      }
      if (i < 90) tick(s, { skip: ['endings'] });
    }
  } catch (err) {
    threw = String((err as Error).stack ?? err);
  }
  console.log(`(c) day 369 → ${s.time.day}:\n    ${path.join('\n    ')}`);
  check(!threw, '(c) 90 days on the day-369 save without throwing', threw.slice(0, 300));
}
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
