// L13/L14: premium pay, poaching from the rivals, the placeholder rivals and China in the pools
// (design/bal/LABOUR-ROUND.md §4.2 items 2 and 5; src/engine/v2/departments/market.ts).
// Run: npx tsx scripts/v2/poach.ts   (PASS/FAIL lines, exit 1 on any failure)
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { act } from '../../src/engine/v2/core/loop';
import { EPS, LABOUR_KINDS, PREMIUM_STEPS, SEPARATION } from '../../src/data/v2/labourMarket';
import { REF_ROLE_SHARE, SAF_ROLE_SHARE } from '../../src/data/v2/teams';
import { labHeads, marketWeek, openPositions, otherLabHeads, playerHeads, poachFromRivals, poachShare } from '../../src/engine/v2/departments/market';
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
  check(rivalTotal(s) === r0 && poachShare(0) === 0 && poachFromRivals(s, 're', 1e9) === 0, 'no poaching at pi = 0: rival staff unchanged after 10 weeks with open positions');
}

// 3. At pi = +100% the poached share is 1 - 2^(-eps) of the rivals' leavers; rival staff falls by it; China is untouched.
{
  const s = fresh();
  s.player.hiring.premium.re = 1;
  const heads0 = rivalHeads(s, 're');
  const tot0 = rivalTotal(s);
  const cn0 = chinaTotal(s);
  const n = poachFromRivals(s, 're', 1e9);
  const leavers = (heads0 * SEPARATION) / 52;
  const share = 1 - Math.pow(2, -EPS);
  check(Math.abs(share - 0.69) < 0.01, 'share at +100% is about 69% at eps = 1.7', fmt(share));
  check(near(n, leavers * share, 1e-9), 'poached = (1 - 2^(-eps)) x rivals leavers (heads x SEPARATION / 52)', `${fmt(n, 3)} of ${fmt(leavers, 3)} leavers`);
  check(near(tot0 - rivalTotal(s), n, 1e-9), 'rival staff (cap + saf) falls by the poached number', `-${fmt(tot0 - rivalTotal(s), 3)}`);
  check(chinaTotal(s) === cn0, 'China is never poached');
}

// 4. Capped by the room (V left after the normal hires).
{
  const s = fresh();
  s.player.hiring.premium.re = 1;
  const r0 = rivalTotal(s);
  const room = 0.5;
  const n = poachFromRivals(s, 're', room);
  check(near(n, room, 1e-12) && near(r0 - rivalTotal(s), room, 1e-9), 'capped by the room left: poached = room, rivals fall by it', `${fmt(n)} of ${fmt(room)}`);
  check(poachFromRivals(s, 're', 0) === 0 && poachFromRivals(s, 're', -3) === 0, 'no room, no poaching');
}

// 5. In marketWeek the player gains them: pull 0 means no matching hires, so the poached are all that comes.
{
  const run = (premium: number) => {
    const s = fresh();
    s.relations.talentPull = -50;
    s.player.hiring.premium.re = premium;
    s.player.hiring.targets['re.cap'] += 3;
    const heads0 = playerHeads(s.player, 're');
    const rv0 = rivalHeads(s, 're');
    const V = openPositions(s.player, 're');
    marketWeek(s, undefined);
    return { gained: playerHeads(s.player, 're') - heads0, V, expected: ((rv0 * SEPARATION) / 52) * poachShare(premium) };
  };
  const a = run(0);
  const b = run(1);
  check(b.gained > a.gained && near(b.gained - a.gained, b.expected, 0.02), 'in marketWeek the player gains the poached heads on top of no matching hires',
    `poached ~${fmt(b.expected, 3)} (open ${b.V}), gained ${fmt(b.gained, 3)} vs ${fmt(a.gained, 3)} at pi = 0`);
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
