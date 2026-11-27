// N6 test: the NPC shocks (engine/v2/npc/shocks.ts; design/npc/NPC-LABS.md §5). Direct calls on a fresh state (day 0, no simulation):
// each shock moves the lag d (or the safety emphasis, or the reference clock) by its stated amount, and each preview equals its effect.
// Run: npx tsx scripts/v2/npcShocks.ts
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { decimalYear } from '../../src/engine/v2/core/time';
import { RECIPE_LEAK_SHARE, TACIT_FIRM_SHARE } from '../../src/engine/v2/production/diffusion';
import { PARTNER_TERMS } from '../../src/data/v2/deals';
import { npcG, persOf, refGAt } from '../../src/engine/v2/npc/lab';
import * as sh from '../../src/engine/v2/npc/shocks';
import { RELATION_ACTIONS } from '../../src/engine/v2/actors/actions';
import { postureOf } from '../../src/engine/v2/actors/rivals';
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
// publish (A4): every lab behind the player moves RECIPE_LEAK_SHARE.publish of the way; the preview line = the largest move
{
  const s = clone(base); const before = dOf(s);
  const mv = sh.publishMoves(s);
  const a4 = RELATION_ACTIONS.find((x) => x.id === 'A4')!;
  const pvw = a4.preview(s, {});
  const line = [...pvw.costs, ...pvw.gains, ...pvw.exposure].find((l) => l.currency === 'leadDays');
  sh.publish(s);
  const ok = labsOf(s).every((r) => near(before.get(r.core.id)! - r.npc!.d, RECIPE_LEAK_SHARE.publish * Math.max(0, before.get(r.core.id)! - pp), 1e-9));
  const maxMove = Math.max(...labsOf(s).map((r) => before.get(r.core.id)! - r.npc!.d));
  check(ok && mv.length === labsOf(s).length, `publish: each lab's d falls ${RECIPE_LEAK_SHARE.publish} of its gap to the player`, `${mv.length} labs, largest ${maxMove.toFixed(1)} d`);
  check(line?.amount === Math.round(maxMove), 'A4 preview lead line = the largest move applied', `${line?.amount} d`);
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
// poach in (C4) / let go (E16): the tacit share moved
{
  const s = clone(base); const r = s.rivals.find((x) => x.npc!.d > 100)!;
  const n = Math.max(5, Math.round(r.core.staff.cap * 0.03)); const sh0 = (TACIT_FIRM_SHARE * n) / r.core.staff.cap;
  r.npc!.d = pp - 120; // 120 days ahead of the player
  const days = sh.poachInDays(s, r, n);
  const d0 = r.npc!.d; sh.poachIn(s, r, n);
  check(near(days, sh0 * 120, 1e-9) && near(r.npc!.d - d0, days, 1e-9), `poach in: an ahead rival's d rises by ${(sh0 * 100).toFixed(2)}% of the 120-day gap`, `${days.toFixed(2)} d`);
  const t = clone(base); const q = t.rivals.find((x) => x.npc!.d > 100)!; const staff = t.player.staff.cap; const m = Math.round(staff * 0.03);
  const want = ((TACIT_FIRM_SHARE * m) / staff) * (q.npc!.d - pp); const dd = q.npc!.d;
  check(near(sh.letGoDays(t, q, m, staff), want, 1e-9), "let go: the preview function = the tacit share of the rival's gap to the player");
  sh.letGo(t, q, m, staff);
  check(near(dd - q.npc!.d, want, 1e-9), `let go: the rival's d falls ${want.toFixed(2)} d`);
}
// joint evals: the partner's safety emphasis + one step (override on its pers; posture follows)
{
  const s = clone(base); const r = s.rivals.find((x) => x.npc!.kind === 'bigtech')!; const e0 = persOf(r.npc!).safetyEmphasis, p0 = postureOf(s, r.core.id).safetyInvestment;
  const got = sh.jointEvals(s, r);
  check(near(persOf(r.npc!).safetyEmphasis, Math.min(1, e0 + sh.JOINT_EVAL_STEP)) && near(postureOf(s, r.core.id).safetyInvestment, Math.min(1, p0 + got)) && got > 0, `joint evals: safety emphasis ${e0} -> ${persOf(r.npc!).safetyEmphasis}`);
  const other = s.rivals.find((x) => x.core.id !== r.core.id)!;
  check(other.npc!.pers === undefined, "only the partner's override is stored (others untouched)");
}
// treaty: the reference clock runs x0.65 for every lab
{
  const s = clone(base); const r = s.rivals[0]; s.gov.treaty = 'verified';
  for (let i = 1; i <= 100; i++) { s.time.day = i; sh.treatyClockDay(s); sh.treatyClockDay(s); } // idempotent within a day
  const lost = Number(s.flags['npc:clockLost']);
  check(near(lost, 100 * (1 - sh.TREATY_CLOCK_RATE), 1e-9), `treaty: 100 days -> the reference clock lost ${lost.toFixed(1)} d (rate ${sh.TREATY_CLOCK_RATE})`);
  check(near(npcG(s, r), refGAt(s, decimalYear(s) - (lost + r.npc!.d) / 365.25), 1e-9) && npcG(s, r) < refGAt(s, decimalYear(s) - r.npc!.d / 365.25), 'every lab reads the slowed clock (internal G on the reference at refYear - d)');
  const t = clone(base); for (let i = 1; i <= 100; i++) { t.time.day = i; sh.treatyClockDay(t); }
  check(t.flags['npc:clockLost'] === undefined, 'no treaty: the clock does not slow');
}
// spillover and Track-2: a fixed small step, never past the player
{
  const s = clone(base); const before = dOf(s); sh.spill(s);
  check(labsOf(s).every((r) => near(before.get(r.core.id)! - r.npc!.d, Math.min(sh.SPILL_DAYS, Math.max(0, before.get(r.core.id)! - pp)), 1e-9)), `spillover: every lab's d falls ${sh.SPILL_DAYS} d (at most to the player)`);
  const t = clone(base); const d0 = t.china.lab.npc!.d; const mv = sh.track2Moves(t); const e1 = RELATION_ACTIONS.find((x) => x.id === 'E1')!;
  const line = e1.preview(t, {}).exposure.find((l) => l.currency === 'leadDays'); sh.track2(t);
  check(near(d0 - t.china.lab.npc!.d, sh.TRACK2_DAYS) && mv.length === 1 && line?.amount === -sh.TRACK2_DAYS, `Track-2: China's d falls ${sh.TRACK2_DAYS} d; E1 preview ${line?.amount} d`);
}
// secrets leak and distillation
{
  const s = clone(base); const cn = s.china.lab; const d0 = cn.npc!.d;
  const days = sh.secretsLeak(s, 0.01);
  check(near(days, 0.01 * (d0 - pp)) && near(d0 - cn.npc!.d, days), `secrets leak: a 1%-a-day channel pulls China ${days.toFixed(2)} d toward the player`);
  check(sh.distillDays(base) === 0 && sh.distillDaysPerYear(base) === 0, 'distillation: no live product, no pull');
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
