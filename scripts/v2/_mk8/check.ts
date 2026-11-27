// MK-8 targeted check (design/MARKET.md M11, MK-8 row): rivals' (and DeepCent's) serving capacity.
//  (a) game start and the day-369 save (read-only): per non-player seller its capacity (H100e and work-hours a year),
//      its own buyers' serving, the room left, and the spill-in it received (hours, subscribers, $);
//  (b) rig on day 369: the player's products short of serving compute (manual serving at half their need), then the
//      rival that took the most spill cut to ~0 compute: its spill-in goes to 0, the hours go elsewhere, conserved;
//  (c) 30 ticks on day 369 without throwing, with the revenue path.
// Run alone: npx tsx scripts/v2/_mk8/check.ts
import { readFileSync } from 'node:fs';
import { deserialize } from '../../../src/engine/v2/core/save';
import { tick } from '../../../src/engine/v2/core/loop';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { revenueReadout, sellerCaps, type RevenueReadout, type TurnedAway } from '../../../src/engine/v2/worldfx/revenue';
import { CHINA_ID } from '../../../src/engine/v2/models/labs';
import type { GameStateV2 } from '../../../src/engine/v2/types';

const D369 = 'C:/Users/david/Downloads/ai27-v2-day369.json';
let fails = 0;
const check = (ok: boolean, what: string, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`); };
const f2 = (x: number) => x.toFixed(2);
const kH = (x: number) => (Number.isFinite(x) ? `${(x / 1e3).toFixed(0)}K` : 'inf');
const bh = (x: number) => (Number.isFinite(x) ? `${(x / 1e9).toFixed(2)}B h` : 'inf');
const load = () => deserialize(readFileSync(D369, 'utf8'));
const labOf = (s: GameStateV2, key: string) => (key === CHINA_ID ? s.china.lab : s.rivals.find((r) => r.core.id === key));

function gap(t: TurnedAway): number {
  let h = 0;
  let u = 0;
  for (const k in t.to) {
    h += t.to[k].hours;
    u += t.to[k].subs;
  }
  return Math.max(t.hours > 0 ? Math.abs(h - t.hours) / t.hours : h, t.subs > 0 ? Math.abs(u - t.subs) / t.subs : u);
}
function table(s: GameStateV2, rd: RevenueReadout) {
  const caps = sellerCaps(s, worldMix(s));
  for (const [k, c] of caps) {
    const t = rd.turnedAway.to[k];
    const lab = labOf(s, k);
    console.log(`    ${k.padEnd(10)} compute ${kH(lab?.core.computeOnline ?? NaN)} H100e  capacity ${kH(c.cap)} H100e (${bh(c.hours)}/yr)  own ${kH(c.own)} (sectors ${kH(c.ownSec)} on ${bh(c.secHours)}, chat ${kH(c.ownChat)})  room ${kH(c.room)}` +
      `${c.over > 0 ? `  OVER by ${kH(c.over)}` : ''}  spill-in ${bh(t?.hours ?? 0)}, ${((t?.subs ?? 0) / 1e6).toFixed(2)}M subs, $${f2(rd.spillRev[k] ?? 0)}B/yr`);
  }
  const T = rd.turnedAway;
  console.log(`    player turned away ${bh(T.hours)}, ${(T.subs / 1e6).toFixed(2)}M subs ($${f2(T.dollars)}B/yr); to no AI ${bh(T.to.none?.hours ?? 0)}`);
}

// (a) start and day 369.
{
  const s0 = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 1, tutorial: false }));
  console.log(`(a) game start (day ${s0.time.day}):`);
  const rd0 = revenueReadout(s0);
  table(s0, rd0);
  const s = load();
  console.log(`(a) day 369 save (day ${s.time.day}):`);
  const rd = revenueReadout(s);
  table(s, rd);
  check(rd.deps.every((x) => gap(x.turnedAway) < 1e-6), '(a) day 369: turned-away hours conserved');
}

// (b) rig: the player's sector products at half their need (manual serving), then the top spill receiver cut to ~0.
{
  const short = (s: GameStateV2) => {
    const rd0 = revenueReadout(s);
    const pool = rd0.deps.reduce((a, x) => a + x.servingH100e, 0);
    s.player.policies.servingAuto = false;
    for (const d of s.player.deployments) {
      const x = rd0.deps.find((y) => y.id === d.id);
      if (x) d.servingShare = (x.channel === 'consumer' ? x.needH100e : 0.5 * x.needH100e) / pool;
    }
  };
  const s = load();
  short(s);
  const rd = revenueReadout(s);
  console.log('(b) day 369, the player\'s sector products at half their need:');
  table(s, rd);
  const caps = sellerCaps(s, worldMix(s));
  const top = [...caps.keys()].filter((k) => Number.isFinite(caps.get(k)!.cap)).sort((a, b) => (rd.turnedAway.to[b]?.hours ?? 0) - (rd.turnedAway.to[a]?.hours ?? 0))[0];
  check(rd.turnedAway.hours > 0 && !!top && (rd.turnedAway.to[top]?.hours ?? 0) > 0, '(b) the rig turns buyers away and a closed rival takes some', `top ${top} ${bh(rd.turnedAway.to[top]?.hours ?? 0)}`);
  const s2 = load();
  short(s2);
  const lab = labOf(s2, top)!;
  lab.core.computeOnline *= 1e-6;
  const rd2 = revenueReadout(s2);
  console.log(`(b) same, ${top}'s compute × 1e-6:`);
  table(s2, rd2);
  const c2 = sellerCaps(s2, worldMix(s2)).get(top)!;
  check(c2.room === 0 && (rd2.turnedAway.to[top]?.hours ?? 0) === 0 && (rd2.turnedAway.to[top]?.subs ?? 0) === 0, `(b) ${top} with no room takes no spilled hours or subscribers`, `was ${bh(rd.turnedAway.to[top]?.hours ?? 0)}`);
  const others = (r: RevenueReadout) => Object.entries(r.turnedAway.to).filter(([k]) => k !== top).reduce((a, [, v]) => a + v.hours, 0);
  check(others(rd2) > others(rd), '(b) its hours go elsewhere (other sellers / no AI gain)', `${bh(others(rd))} → ${bh(others(rd2))}`);
  check(rd2.deps.every((x) => gap(x.turnedAway) < 1e-6) && rd.deps.every((x) => gap(x.turnedAway) < 1e-6), '(b) hours conserved (turned away = Σ destinations) in both');
}

// (c) 30 ticks on day 369.
{
  const s = load();
  const path: string[] = [];
  let threw = '';
  try {
    for (let i = 0; i <= 30; i++) {
      if (i % 5 === 0) {
        const rd = revenueReadout(s);
        const caps = sellerCaps(s, worldMix(s));
        const over = [...caps].filter(([, c]) => c.over > 0).map(([k, c]) => `${k} +${kH(c.over)}`).join(' ');
        path.push(`d+${i} revenue $${f2(rd.total)}B/yr, turned away ${bh(rd.turnedAway.hours)}, rivals' spill $${f2(Object.values(rd.spillRev).reduce((a, b) => a + b, 0))}B; over capacity: ${over || 'none'}`);
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
