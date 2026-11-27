// L13/L14: premium pay, poaching from the rivals, the placeholder rivals and China in the pools
// (design/bal/LABOUR-ROUND.md §4.2 items 2 and 5; src/engine/v2/departments/market.ts).
// Run: npx tsx scripts/v2/poach.ts   (PASS/FAIL lines, exit 1 on any failure)
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { act } from '../../src/engine/v2/core/loop';
import { EPS, LABOUR_KINDS, PREMIUM_STEPS } from '../../src/data/v2/labourMarket';
import { REF_ROLE_SHARE, SAF_ROLE_SHARE } from '../../src/data/v2/teams';
import { labHeads, marketWeek, otherLabHeads, playerHeads, poachFromRivals, poachShare, weeklyHires } from '../../src/engine/v2/departments/market';
import type { GameStateV2, TeamRole } from '../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, label: string, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`);
};
const kinds: TeamRole[] = [...LABOUR_KINDS];
const fresh = () => newGame(defaultSetupV2({ seed: 1 } as never));
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.abs(b);
const fmt = (x: number, d = 4) => x.toFixed(d);
const headsOf = (st: { cap: number; saf: number }, k: TeamRole) => st.cap * REF_ROLE_SHARE[k] + (k === 'eng' ? 0 : st.saf * SAF_ROLE_SHARE[k]);
const rivalHeads = (s: GameStateV2, k: TeamRole) => s.rivals.filter((r) => r.core.status === 'active').reduce((a, r) => a + headsOf(r.core.staff, k), 0);
const rivalTotal = (s: GameStateV2) => s.rivals.reduce((a, r) => a + r.core.staff.cap + r.core.staff.saf, 0);
const chinaTotal = (s: GameStateV2) => s.china.lab.core.staff.cap + s.china.lab.core.staff.saf;

// 1. The action sets the premium, and rejects steps outside PREMIUM_STEPS and unknown kinds.
{
  const s = fresh();
  let ok = true;
  for (const step of PREMIUM_STEPS) ok &&= act(s, 'hiring.premium', { kind: 'sci', step }) === undefined && s.player.hiring.premium.sci === step;
  check(ok, 'hiring.premium accepts each of PREMIUM_STEPS and sets p.hiring.premium[k]', PREMIUM_STEPS.join(' / '));
  act(s, 'hiring.premium', { kind: 're', step: 0.25 });
  const before = JSON.stringify(s.player.hiring.premium);
  const bad = [0.05, 0.3, 1.5, -0.1, 2].map((step) => act(s, 'hiring.premium', { kind: 're', step }));
  check(bad.every((e) => typeof e === 'string') && JSON.stringify(s.player.hiring.premium) === before, 'steps outside PREMIUM_STEPS are rejected and change nothing', String(bad[0]));
  check(typeof act(s, 'hiring.premium', { kind: 'janitor', step: 0.1 }) === 'string', 'an unknown kind is rejected');
  check(act(s, 'hiring.premium', { kind: 'eng', step: 0.5 }) === undefined && s.player.hiring.premium.eng === 0.5 && s.player.hiring.premium.re === 0.25, 'one kind at a time');
}

// 2. No poaching at pi = 0.
{
  const s = fresh();
  s.player.hiring.targets['re.cap'] += 6;
  const r0 = rivalTotal(s);
  for (let w = 0; w < 10; w++) marketWeek(s, undefined);
  check(rivalTotal(s) === r0 && poachShare(0) === 0, 'no poaching at pi = 0: rival staff unchanged after 10 weeks with open positions');
}

// 3. poachFromRivals takes exactly n heads from the rivals (never China); capped by what they have.
{
  const s = fresh();
  const tot0 = rivalTotal(s);
  const cn0 = chinaTotal(s);
  const n = poachFromRivals(s, 're', 12.5);
  check(near(n, 12.5, 1e-12) && near(tot0 - rivalTotal(s), 12.5, 1e-9), 'poachFromRivals(n) returns n and the rivals fall by exactly n', `-${fmt(tot0 - rivalTotal(s), 3)}`);
  check(chinaTotal(s) === cn0, 'China is never poached');
  check(poachFromRivals(s, 're', 0) === 0 && poachFromRivals(s, 're', -3) === 0, 'nothing asked, nothing poached');
  const all = rivalHeads(s, 're');
  const big = poachFromRivals(s, 're', 1e9);
  check(near(big, all, 1e-9), 'capped by what the rivals have (their heads of the kind)', `${fmt(big, 1)} of ${fmt(all, 1)}`);
}

// 4. (c) At pi = +100% a share 1 - 2^(-eps) of the player's weekly hires comes from the rivals; the rivals fall by that number.
{
  const share = 1 - Math.pow(2, -EPS);
  check(Math.abs(share - 0.69) < 0.01 && near(poachShare(1), share, 1e-12), 'share at +100% is about 69% at eps = 1.7', fmt(share));
  const week = (premium: number) => {
    const s = fresh();
    s.player.hiring.premium.re = premium;
    s.player.hiring.targets['re.cap'] += 6;
    const heads0 = playerHeads(s.player, 're');
    const tot0 = rivalTotal(s);
    const cn0 = chinaTotal(s);
    const hires = weeklyHires(s, 're');
    marketWeek(s, undefined);
    return { hires, gained: playerHeads(s.player, 're') - heads0, rFall: tot0 - rivalTotal(s), china: chinaTotal(s) === cn0 };
  };
  const a = week(0);
  const b = week(1);
  check(a.rFall === 0, 'pi = 0: no hire comes from rivals', `${fmt(a.hires, 2)} hires, rivals -${fmt(a.rFall, 3)}`);
  check(near(b.gained, b.hires, 1e-3) && near(b.rFall, b.gained * share, 1e-9) && b.china,
    'pi = +100%: 1 - 2^(-eps) of the hires come from rivals and the rivals fall by that number', `${fmt(b.hires, 2)} hires, rivals -${fmt(b.rFall, 3)} = ${fmt(b.rFall / b.hires, 4)} x hires (${fmt(share, 4)})`);
}

// 5. Many weeks: the rivals' total fall is the share of everything the player hired.
{
  const s = fresh();
  s.player.hiring.premium.eng = 1;
  s.player.hiring.targets['eng'] += 4;
  const heads0 = playerHeads(s.player, 'eng');
  const tot0 = rivalTotal(s);
  for (let w = 0; w < 20; w++) marketWeek(s, undefined);
  const hired = playerHeads(s.player, 'eng') - heads0;
  check(hired > 0 && near(tot0 - rivalTotal(s), hired * (1 - Math.pow(2, -EPS)), 1e-6), 'over 20 weeks the rivals lose the share of all heads hired', `hired ${fmt(hired, 1)}, rivals -${fmt(tot0 - rivalTotal(s), 2)}`);
}

// 6. L14: China's and the rivals' heads are in E, follow their staff paths, and are not touched by wages or the pool.
{
  const s = fresh();
  const ok = kinds.every((k) => {
    const exp = headsOf(s.china.lab.core.staff, k);
    return exp > 0 && near(otherLabHeads(s, k), rivalHeads(s, k) + exp, 1e-9);
  });
  check(ok, "China's heads are in E (otherLabHeads = rivals + China) for each kind", kinds.map((k) => `${k} ${fmt(otherLabHeads(s, k), 0)}`).join(', '));
  const e0 = labHeads(s, 'sci');
  s.china.lab.core.staff.cap *= 2;
  check(labHeads(s, 'sci') > e0, "a bigger China lab raises E (read live, never rationed by the pool)");
  const s2 = fresh();
  const snap = JSON.stringify([s2.rivals.map((r) => r.core.staff), s2.china.lab.core.staff]);
  s2.player.hiring.targets['re.cap'] += 5;
  for (let w = 0; w < 20; w++) marketWeek(s2, undefined);
  check(JSON.stringify([s2.rivals.map((r) => r.core.staff), s2.china.lab.core.staff]) === snap, 'rival and China staff are unmoved by the market weeks (wages, pool, hiring): only their staff path and poaching move them');
}

console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
