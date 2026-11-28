// N6 test: the NPC shocks (engine/v2/npc/shocks.ts; design/npc/NPC-LABS.md §5). Direct calls on a fresh state (day 0, no simulation):
// each shock moves the lag d (or the safety emphasis, or the reference clock) by its stated amount, and each preview equals its effect.
// Run: npx tsx scripts/v2/npcShocks.ts
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { decimalYear } from '../../src/engine/v2/core/time';
import { RECIPE_LEAK_SHARE, TACIT_FIRM_SHARE } from '../../src/engine/v2/production/diffusion';
import { PARTNER_TERMS } from '../../src/data/v2/deals';
import { refGAt } from '../../src/engine/v2/npc/lab';
import * as sh from '../../src/engine/v2/npc/shocks';
import { ACTION_BY_ID } from '../../src/engine/v2/core/registry';
import { act } from '../../src/engine/v2/core/loop';
import { headsMoved } from '../../src/engine/v2/departments/teams';
import { poachFallbackDays, poachFromRivals, poachShare, poachSplit, weeklyHires } from '../../src/engine/v2/departments/market';
import type { GameStateV2, RivalLab } from '../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, msg: string, detail = '') => { console.log(`${ok ? '  ok ' : 'FAIL '} ${msg}${detail ? `  (${detail})` : ''}`); if (!ok) fails++; };
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) <= e * Math.max(1, Math.abs(b));
const clone = (s: GameStateV2): GameStateV2 => JSON.parse(JSON.stringify(s));
const fresh = () => newGame(defaultSetupV2({ world: 'tl-central', start: 'leader', seed: 7, tutorial: false }));
const labsOf = (s: GameStateV2): RivalLab[] => [...s.rivals, s.china.lab].filter((r) => r.core.status === 'active');
const dOf = (s: GameStateV2) => new Map(labsOf(s).map((r) => [r.core.id, r.npc!.d]));
const y0 = (s: GameStateV2) => decimalYear(s);

// the player's position (its best model) is the yardstick of the pulls
const base = fresh();
const pp = sh.playerPos(base)!;
console.log(`player position ${pp.toFixed(1)} d; lags ${[...dOf(base)].map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ')}`);

// theft: China's d jumps to the victim's position + THEFT_INTEGRATION_DAYS, only ever shortening
{
  const s = clone(base); const cn = s.china.lab; const d0 = cn.npc!.d;
  const G = refGAt(s, y0(s) - 30 / 365.25); // a model 30 days behind the reference
  const got = sh.theft(s, G);
  check(near(cn.npc!.d, 30 + sh.THEFT_INTEGRATION_DAYS, 1e-4) && near(got, d0 - cn.npc!.d, 1e-9), `theft: China's d ${d0.toFixed(0)} -> ${cn.npc!.d.toFixed(1)} = 30 + ${sh.THEFT_INTEGRATION_DAYS} d (integration)`);
  const s2 = clone(base); sh.theft(s2, refGAt(s2, y0(s2) - 300 / 365.25));
  check(s2.china.lab.npc!.d === d0, 'theft of a model further behind than China moves nothing');
}
// open weights (C6): labs behind the released model's position move 0.3 of the way; the releaser and labs ahead do not; none below the open frontier
{
  const s = clone(base); const before = dOf(s);
  const G = refGAt(s, y0(s) - 100 / 365.25); // 100 d behind the reference
  s.knowledge.openWeightsG = -Infinity;
  const mv = sh.openWeightsMoves(s, 'player', G);
  sh.openWeights(s, 'player', G);
  const ok = labsOf(s).every((r) => { const d = before.get(r.core.id)!; return near(d - r.npc!.d, RECIPE_LEAK_SHARE.openWeights * Math.max(0, d - 100), 1e-4); });
  check(ok, `open weights: labs behind 100 d move ${RECIPE_LEAK_SHARE.openWeights} of the way, labs ahead none`, `${mv.length} labs`);
  const s2 = clone(base); s2.knowledge.openWeightsG = G + 1;
  check(sh.openWeightsMoves(s2, 'player', G).length === 0, 'open weights below the open frontier move nothing');
  const s3 = clone(base); s3.knowledge.openWeightsG = -Infinity;
  const rel = labsOf(s3).find((r) => r.npc!.d > 100)!;
  check(!sh.openWeightsMoves(s3, rel.core.id, G).some((m) => m.lab === rel), 'the releaser does not move itself');
}
// absorb: the buyer takes the better d and adds the compute
{
  const s = clone(base); const [a, b] = s.rivals.filter((r) => r.core.status === 'active');
  a.npc!.d = 80; b.npc!.d = 10; const ca = a.core.computeOnline, cb = b.core.computeOnline;
  const got = sh.absorb(a, b);
  check(a.npc!.d === 10 && got === 70 && a.core.computeOnline === ca + cb, "absorb: buyer d 80 -> 10 (the seller's), compute added");
  a.npc!.d = 5; sh.absorb(a, b);
  check(a.npc!.d === 5, "absorb: a seller further behind leaves the buyer's d");
}
// IP access: a deal moves the partner ipCloseYr / 365 of the way to the licensed model per day
{
  const s = clone(base); const r = s.rivals.find((x) => x.npc!.d > 100)!;
  const none = sh.ipAccessDays(s, r);
  (s.player.finance.deals as unknown[]).push({ strings: { ipAccess: { lab: r.core.id, trust: true } }, until: s.time.day + 400 });
  const v = s.player.models.versions.filter((x) => x.status !== 'retired').sort((a, b) => b.G - a.G)[0];
  const want = (PARTNER_TERMS.strings.ipCloseYr / 365) * Math.max(0, r.npc!.d - sh.posOf(s, v.G)!);
  const d0 = r.npc!.d; sh.ipAccess(s, r);
  check(none === 0 && v !== undefined && near(d0 - r.npc!.d, want, 1e-9) && want > 0, `IP access: ${r.core.name} d ${d0.toFixed(1)} -> ${r.npc!.d.toFixed(2)} (${((PARTNER_TERMS.strings.ipCloseYr / 365) * 100).toFixed(3)}% of the gap a day)`);
}
// poach in (C4): the tacit share moved
{
  const s = clone(base); const r = s.rivals.find((x) => x.npc!.d > 100)!;
  const n = Math.max(5, Math.round(r.core.staff.cap * 0.03)); const sh0 = (TACIT_FIRM_SHARE * n) / r.core.staff.cap;
  r.npc!.d = pp - 120; // 120 days ahead of the player
  const days = sh.poachInDays(s, r, n);
  const d0 = r.npc!.d; sh.poachIn(s, r, n);
  check(near(days, sh0 * 120, 1e-9) && near(r.npc!.d - d0, days, 1e-9), `poach in: an ahead rival's d rises by ${(sh0 * 100).toFixed(2)}% of the 120-day gap`, `${days.toFixed(2)} d`);
}
// spillover: a fixed small step, never past the player
{
  const s = clone(base); const before = dOf(s); sh.spill(s);
  check(labsOf(s).every((r) => near(before.get(r.core.id)! - r.npc!.d, Math.min(sh.SPILL_DAYS, Math.max(0, before.get(r.core.id)! - pp)), 1e-9)), `spillover: every lab's d falls ${sh.SPILL_DAYS} d (at most to the player)`);
}
// secrets leak and distillation
{
  const s = clone(base); const cn = s.china.lab; const d0 = cn.npc!.d;
  const days = sh.secretsLeak(s, 0.01);
  check(near(days, 0.01 * (d0 - pp)) && near(d0 - cn.npc!.d, days), `secrets leak: a 1%-a-day channel pulls China ${days.toFixed(2)} d toward the player`);
  check(sh.distillDays(base) === 0 && sh.distillDaysPerYear(base) === 0, 'distillation: no live product, no pull');
}
// One rule for people moving (designer, 2026-11-27): every route from an NPC lab to the player takes the poach-in shock by
// the heads moved, every route to an NPC lab the let-go shock; the previews read the same functions.
{
  // C4: the preview's fallback line = the effect = poachInDays of the heads that move (whole teams).
  const s = clone(base); const r = s.rivals.find((x) => x.npc!.d > 100)!; r.npc!.d = pp - 120;
  r.core.staff.cap = 4000; // 3% = 120 heads: at least one whole team moves (a small rival's 3% can round to none)
  const c4 = ACTION_BY_ID.get('C4')!;
  const line = c4.preview(s, { lab: r.core.id }).gains.find((l) => l.currency === 'leadDays' && String(l.target).includes('falls back'));
  const moved = headsMoved(s.player, 'cap', Math.max(5, Math.round(r.core.staff.cap * 0.03)));
  const want = sh.poachInDays(s, r, moved); const d0 = r.npc!.d; const st0 = r.core.staff.cap; const p0 = s.player.staff.cap;
  const err = act(s, 'C4', { lab: r.core.id });
  check(!err && moved > 0 && near(r.npc!.d - d0, want, 1e-9) && near(st0 - r.core.staff.cap, moved, 1e-9) && near(s.player.staff.cap - p0, moved, 1e-9) && line?.amount === Math.round(want),
    `C4: the rival's d rises by poachInDays of the ${moved} heads that move; preview ${line?.amount} d`, `${want.toFixed(2)} d; err ${err ?? '-'}`);
}
{
  // Weekly premium poaching: each rival takes poachInDays of its capabilities heads moved; China is never poached.
  const s = clone(base); for (const r of s.rivals) r.npc!.d = pp - 120;
  const n = 400; const split = poachSplit(s, 're', n); const want = new Map(split.map((m) => [m.r.core.id, sh.poachInDays(s, m.r, m.cap)]));
  const fall = poachFallbackDays(s, 're', n); const before = dOf(s); const cn0 = JSON.stringify(s.china.lab);
  const took = poachFromRivals(s, 're', n);
  const ok = split.every((m) => near(m.r.npc!.d - before.get(m.r.core.id)!, want.get(m.r.core.id)!, 1e-9));
  check(ok && fall > 0 && near(took, n, 1e-9) && near(fall, [...want.values()].reduce((a, b) => a + b, 0), 1e-12) && JSON.stringify(s.china.lab) === cn0,
    `premium poaching: ${split.length} rivals each fall back by poachInDays of their capabilities heads moved (sum ${fall.toFixed(2)} d = the preview function); China untouched`);
  const t = clone(base); for (const r of t.rivals) r.npc!.d = pp - 120;
  t.player.hiring.targets['re.cap'] = (t.player.hiring.targets['re.cap'] ?? 0) + 4; // open positions, so there are hires to poach
  const c = clone(t); c.player.hiring.premium.re = 0.5;
  const yr = poachFallbackDays(c, 're', 52 * weeklyHires(c, 're') * poachShare(0.5));
  const pl = ACTION_BY_ID.get('hiring.premium')!.preview(t, { kind: 're', step: 0.5 }).gains.find((l) => l.currency === 'leadDays');
  check(yr > 0 && pl?.amount === Math.round(yr) && String(pl?.target).includes('rivals fall back'), 'premium preview: the rivals-fall-back line = poachFallbackDays of a year of poached hires', `${pl?.amount} d`);
}
// NPC labs hold no stars: every star is the player's or outside; a star hire touches no NPC lab.
{
  const s = clone(base);
  check(s.labour.stars.every((x) => x.employer === 'player' || x.employer === 'outside') && s.labour.stars.some((x) => x.employer === 'outside'), 'stars: every star is the player\'s or in the outside group');
  const star = s.labour.stars.find((x) => x.employer === 'outside')!; const npc0 = JSON.stringify([s.rivals, s.china.lab]);
  const err = act(s, 'starHire', { star: star.id });
  check(!err && star.employer === 'player' && JSON.stringify([s.rivals, s.china.lab]) === npc0, 'a star hire takes it from the outside group and touches no NPC lab', String(err ?? ''));
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
