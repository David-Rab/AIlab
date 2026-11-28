// N6 + F3-F6 test: the NPC shocks (engine/v2/npc/shocks.ts; design/npc/NPC-LABS.md §5). Direct calls on a fresh state (day 0, no simulation):
// each shock moves the lag d (or the safety emphasis, or the reference clock) by its stated amount, and each preview equals its effect.
// Run: npx tsx scripts/v2/npcShocks.ts [--smoke]
// Cost: quick (--smoke) ~10 s of import + day-0 state, no sim; full adds one forced 3.5-year bot game (~1,300 days, ~1 CPU-min).
// Tier: quick (--smoke) and full. The game check (F4 on a game) is emergent, so it is full only.
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { decimalYear } from '../../src/engine/v2/core/time';
import { RECIPE_LEAK_SHARE, TACIT_FIRM_SHARE } from '../../src/engine/v2/production/diffusion';
import { PARTNER_TERMS } from '../../src/data/v2/deals';
import { npcCapabilityDay, npcG, refGAt } from '../../src/engine/v2/npc/lab';
import { executeTheft } from '../../src/engine/v2/security/theft';
import { playerRecipeG } from '../../src/engine/v2/models/stacks';
import { bestG } from '../../src/engine/v2/models/labs';
import { gV0 } from '../../src/engine/v2/models/capability';
import { installForced } from './forcedInputs';
import * as sh from '../../src/engine/v2/npc/shocks';
import { ACTION_BY_ID } from '../../src/engine/v2/core/registry';
import { act, makeCtx } from '../../src/engine/v2/core/loop';
import { headsMoved } from '../../src/engine/v2/departments/teams';
import { poachFallbackDays, poachFromRivals, poachShare, poachSplit, weeklyHires } from '../../src/engine/v2/departments/market';
import type { GameStateV2, RivalLab } from '../../src/engine/v2/types';

import { SMOKE, check, finish } from './lib';
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) <= e * Math.max(1, Math.abs(b));
const clone = (s: GameStateV2): GameStateV2 => JSON.parse(JSON.stringify(s));
const fresh = () => newGame(defaultSetupV2({ world: 'tl-central', start: 'leader', seed: 7, tutorial: false }));
const labsOf = (s: GameStateV2): RivalLab[] => [...s.rivals, s.china.lab].filter((r) => r.core.status === 'active');
const dOf = (s: GameStateV2) => new Map(labsOf(s).map((r) => [r.core.id, r.npc!.d]));
const y0 = (s: GameStateV2) => decimalYear(s);

// the player's position (its best model) is the yardstick of the pulls
const base = fresh();
const pp = sh.playerPos(base)!;
// know-how shocks: share x of the lag gap to the player's know-how position (where its recipe sits on the reference clock)
const kp = sh.playerKnowhowPos(base)!;
const days = (d: number, pos: number, share: number) => share * Math.max(0, d - pos);
console.log(`player position ${pp.toFixed(1)} d, know-how position ${kp.toFixed(1)} d; lags ${[...dOf(base)].map(([k, v]) => `${k} ${v.toFixed(0)}`).join(', ')}`);

// theft: China's d jumps to the victim's position + THEFT_INTEGRATION_DAYS, only ever shortening
{
  const s = clone(base); const cn = s.china.lab; const d0 = cn.npc!.d;
  const G = refGAt(s, y0(s) - 30 / 365.25); // a model 30 days behind the reference
  const got = sh.theft(s, G);
  check(near(cn.npc!.d, 30 + sh.THEFT_INTEGRATION_DAYS, 1e-4) && near(got, d0 - cn.npc!.d, 1e-9), `theft: China's d ${d0.toFixed(0)} -> ${cn.npc!.d.toFixed(1)} = 30 + ${sh.THEFT_INTEGRATION_DAYS} d (integration)`);
  const s2 = clone(base); sh.theft(s2, refGAt(s2, y0(s2) - 300 / 365.25));
  check(s2.china.lab.npc!.d === d0, 'theft of a model further behind than China moves nothing');
}
// F6: one integration rule for one theft. executeTheft sets China's lag once (position + integration delay) and its model
// follows that lag; the next day's capability step does not overwrite it (it used to: a second rule set the model's G, and
// the daily step then rebuilt it from the lag).
{
  const s = clone(base); const cn = s.china.lab; const ctx = makeCtx(s);
  cn.npc!.d = 300;
  const v = s.player.models.versions.filter((x) => x.status !== 'retired').sort((a, b) => b.G - a.G)[0];
  const want = sh.posOf(s, v.G)! + sh.THEFT_INTEGRATION_DAYS;
  executeTheft(s, ctx, 'player');
  const d1 = cn.npc!.d, g1 = cn.internal.G;
  check(near(d1, want, 1e-9) && near(g1, npcG(s, cn), 1e-9) && cn.internal.stolenFrom === 'player', `theft: China's lag 300 -> ${d1.toFixed(1)} = position + ${sh.THEFT_INTEGRATION_DAYS} d, its model G = the reference at that lag, tagged as stolen`);
  s.time.day += 1;
  npcCapabilityDay(s, cn, s.time.day);
  const d2 = cn.npc!.d;
  check(Math.abs(d2 - d1) < 3 && near(cn.internal.G, npcG(s, cn), 1e-9) && cn.internal.G >= g1 - 0.05, `theft: the next day does not overwrite it (lag ${d1.toFixed(1)} -> ${d2.toFixed(1)}, relaxing only; G ${(g1 - gV0(s.hidden.timeline)).toFixed(3)} -> ${(cn.internal.G - gV0(s.hidden.timeline)).toFixed(3)})`);
}
// open weights (C6, F3): only China absorbs, closing 0.3 of its know-how gap to the release; no US lab moves; none below the open
// frontier, none from China's own release
{
  const s = clone(base); const before = dOf(s); const cn0 = before.get('china')!;
  s.knowledge.openWeightsG = -Infinity;
  const releaser = s.rivals.find((r) => r.core.status === 'active')!.core.id;
  const G = refGAt(s, y0(s) - 100 / 365.25); // 100 d behind the reference
  const want = days(cn0, 100, RECIPE_LEAK_SHARE.openWeights);
  const mv = sh.openWeightsMoves(s, releaser, G);
  sh.openWeights(s, releaser, G);
  const us = labsOf(s).filter((r) => r.core.id !== 'china').every((r) => r.npc!.d === before.get(r.core.id));
  const got = cn0 - s.china.lab.npc!.d;
  check(us && mv.length === 1 && mv[0].lab === s.china.lab && want > 0 && near(got, want, 1e-9), `open weights: China's d falls ${RECIPE_LEAK_SHARE.openWeights} of its know-how gap to the release (${cn0.toFixed(0)} -> ${s.china.lab.npc!.d.toFixed(1)} d), the US labs do not move`);
  const s2 = clone(base); s2.knowledge.openWeightsG = G + 1;
  check(sh.openWeightsMoves(s2, releaser, G).length === 0, 'open weights below the open frontier move nothing');
  const s3 = clone(base); s3.knowledge.openWeightsG = -Infinity;
  check(sh.openWeightsMoves(s3, 'china', G).length === 0, "China's own release does not move China");
  const s4 = clone(base); s4.knowledge.openWeightsG = -Infinity; const Gp = bestG(s4, 'player') - 0.2;
  const m4 = sh.openWeightsMoves(s4, 'player', Gp);
  const w4 = days(cn0, sh.knowhowPos(s4, playerRecipeG(s4) - 0.2)!, RECIPE_LEAK_SHARE.openWeights);
  check(m4.length === (w4 > 0 ? 1 : 0) && (w4 === 0 || (m4[0].lab === s4.china.lab && near(m4[0].days, w4, 1e-9))), "open weights of the player: China's pull reads the player's recipe less the release's distance below its best model");
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
  const got = sh.secretsLeak(s, 0.01);
  const want = days(d0, kp, 0.01);
  check(want > 0 && near(got, want, 1e-9) && near(d0 - cn.npc!.d, got), `secrets leak (F4): a 1%-a-day channel closes 1% of China's know-how gap to the player: ${got.toFixed(2)} d (its capability gap to the player is ${(d0 - pp).toFixed(0)} d)`);
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
// F4 constructed (quick and full): the leak closes a share of the KNOW-HOW gap, so a thousand days of it approach the player's
// know-how position geometrically and never cross it (the old rule pulled toward the capability position and ran to -462 d).
{
  const s = clone(base); const cn = s.china.lab; const d0 = cn.npc!.d; let prev = d0, mono = true;
  const share = 0.01, N = 1100;
  for (let i = 0; i < N; i++) { sh.secretsLeak(s, share); if (cn.npc!.d > prev + 1e-12) mono = false; prev = cn.npc!.d; }
  const gap0 = d0 - kp;
  check(gap0 > 0 && mono && near(cn.npc!.d, kp + gap0 * Math.pow(1 - share, N), 1e-6) && cn.npc!.d >= kp - 1e-9,
    `secrets leak (F4): ${N} days at ${share * 100}% a day take China's lag ${d0.toFixed(0)} -> ${cn.npc!.d.toFixed(1)} d, geometrically toward the know-how position ${kp.toFixed(0)} d, never past it`);
}
// F4 on a game (full only; ~1,300 days of the forced AIFM game, ~1 CPU-min): a 3-year forced run (the AIFM compute and staff paths) with the spies growing. The leak used to pull China toward
// the player's whole capability position: 198 d -> -462 d by 2028 (with the leak off, about 160 d). It now closes a share of the
// know-how gap; China's lag stays sane. Only the days before a weight theft count: a theft (world/chinagov.ts opens it from
// tension CHINAGOV.theftRung) is its own rule (F6, tested above) and sets the lag to the stolen model's position.
if (!SMOKE) {
  installForced('aifm');
  const B = await import('./botgame');
  const g = B.newBotGame(2027, { world: 'tl-central', alignment: 'medium' }, 'leader');
  const bot = B.ALL['reflines'];
  const path: string[] = [];
  let lo = Infinity, last = -1, hi = -Infinity, theftAt = '';
  const spies0 = g.player.security.spies;
  let spies1 = spies0;
  const watch = { ...bot, act: (st: GameStateV2, api: Parameters<typeof bot.act>[1]) => {
    bot.act(st, api);
    const d = st.china.lab.npc!.d;
    if (!theftAt && st.player.security.stolen.length) theftAt = `${decimalYear(st).toFixed(2)} (lag -> ${d.toFixed(0)} d)`;
    if (!theftAt) { lo = Math.min(lo, d); hi = Math.max(hi, d); }
    spies1 = st.player.security.spies;
    const q = Math.floor(decimalYear(st) * 2);
    if (q !== last) { last = q; path.push(`${decimalYear(st).toFixed(1)}: ${d.toFixed(0)}`); }
  } };
  B.playForced(watch, g, 2028.5, { spdM: false });
  console.log(`  China's lag path (d, half-yearly): ${path.join('  ')}; spies ${spies0} -> ${spies1.toFixed(0)}; theft ${theftAt || 'none'}`);
  check(lo > -60 && spies1 > 5 * spies0, `secrets leak over 3 years with spies growing ${spies0} -> ${spies1.toFixed(0)}: China's lag stays above -60 d`, `lowest ${lo.toFixed(0)} d, highest ${hi.toFixed(0)} d before any theft`);
}
finish('npcShocks');
