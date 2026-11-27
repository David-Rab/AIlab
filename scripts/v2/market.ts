// L12: the labour market's weekly system (design/bal/LABOUR-ROUND.md §4.2; src/engine/v2/departments/market.ts).
// Run: npx tsx scripts/v2/market.ts   (PASS/FAIL lines, exit 1 on any failure)
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { ALPHA, EPS, F0_PER_MONTH, INFLOW, P0, PAY_RENEWAL_YEARS, SEPARATION, W0 } from '../../src/data/v2/labourMarket';
import { TEAM_SIZE } from '../../src/data/v2/teams';
import {
  labHeads, marketWage, marketWeek, MU_REF_V, openPositions, outsideHeads, playerHeads, repriceWeek, weeklyHires,
} from '../../src/engine/v2/departments/market';
import { attritionMorale, payrollOf } from '../../src/engine/v2/departments/teams';
import type { GameStateV2, TeamRole } from '../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, label: string, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`);
};
const kinds: TeamRole[] = ['eng', 're', 'sci'];
const fresh = () => newGame(defaultSetupV2({ seed: 1 } as never));
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.abs(b);
/** Neutral pull and morale (talent pull 0, morale 50: both multipliers 1). */
const neutral = (s: GameStateV2) => { s.relations.talentPull = 0; s.player.morale.overall = 50; s.player.morale.safety = 50; };
const fmt = (x: number, d = 4) => x.toFixed(d);

// 1. Inflow: P += I/52 per week.
{
  const s = fresh();
  const before = kinds.map((k) => s.labour.pools[k].P);
  marketWeek(s, undefined);
  check(kinds.every((k, i) => near(s.labour.pools[k].P - before[i], INFLOW[k] / 52, 1e-9)), 'inflow adds I/52 a week',
    kinds.map((k, i) => `${k} +${fmt(s.labour.pools[k].P - before[i], 2)}`).join(', '));
  check(kinds.every((k) => s.labour.pools[k].P === P0[k] + INFLOW[k] / 52), 'P0 + I/52 after one week');
}

// 2. Wage: w0 at the start, rises with E/U.
{
  const s = fresh();
  check(kinds.every((k) => near(marketWage(s, k), W0[k], 1e-12)), 'w = w0 at the start', kinds.map((k) => `${k} ${fmt(marketWage(s, k), 3)}`).join(', '));
  const e0 = kinds.map((k) => labHeads(s, k) / outsideHeads(s, k));
  for (const r of s.rivals) { r.core.staff.cap *= 10; r.core.staff.saf *= 10; }
  const ok = kinds.every((k, i) => {
    const ratio = labHeads(s, k) / outsideHeads(s, k) / e0[i];
    return ratio > 1 && marketWage(s, k) > W0[k] && near(marketWage(s, k), W0[k] * Math.pow(ratio, 1 / 2.2), 1e-9);
  });
  check(ok, 'w rises with E/U as w0 (ratio)^(1/η)', kinds.map((k) => `${k} ${fmt(marketWage(s, k), 3)}`).join(', '));
}

// 3. Fill rate at the start with the reference V (one team's seats), neutral pull and morale, π = 0: F0 a month.
{
  const s = fresh();
  neutral(s);
  const parts: string[] = [];
  let ok = true;
  for (const k of kinds) {
    const p = s.player;
    const key = k === 'eng' ? 'eng' : (`${k}.cap` as const);
    const V0 = openPositions(p, k);
    p.hiring.targets[key] = (p.hiring.targets[key] ?? 0) + 1; // one more team: V = its seats
    const V = openPositions(p, k);
    const f = (weeklyHires(s, k) * 52) / 12 / V;
    parts.push(`${k} V ${V0}->${V} f ${fmt(f)}`);
    ok &&= V0 === 0 && V === MU_REF_V[k] && MU_REF_V[k] === TEAM_SIZE[k] && near(f, F0_PER_MONTH, 0.01);
    p.hiring.targets[key] -= 1;
  }
  check(ok, `fill rate at the start with V = one team = F0 ${F0_PER_MONTH}/month within 1%`, parts.join('; '));
}

// 4. Hires fall as U falls (deplete U artificially), as U^α.
{
  const s = fresh();
  neutral(s);
  s.player.hiring.targets['re.cap'] += 3;
  const h0 = weeklyHires(s, 're');
  const E = labHeads(s, 're');
  const U0 = outsideHeads(s, 're');
  s.labour.pools.re.P = E + U0 / 10; // a tenth of the outside pool left
  const h1 = weeklyHires(s, 're');
  check(h1 < h0 && near(h1 / h0, Math.pow(0.1, ALPHA), 1e-9), 'hires fall as U falls (x0.1 U -> x0.1^α hires)', `${fmt(h0, 2)} -> ${fmt(h1, 2)} /wk`);
}

// 5. Premium: hires scale as (1+π)^ε.
{
  const s = fresh();
  neutral(s);
  s.player.hiring.targets['sci.cap'] += 5;
  const h0 = weeklyHires(s, 'sci');
  s.player.hiring.premium.sci = 0.25;
  const h1 = weeklyHires(s, 'sci');
  check(near(h1 / h0, Math.pow(1.25, EPS), 1e-9), 'with π = 0.25 hires x(1+π)^ε', `${fmt(h1 / h0)} vs ${fmt(Math.pow(1.25, EPS))}`);
}

// 6. Pay reprices toward the offer at 1/T per year (continuous: after a year the gap is e^(-1/T)).
{
  let pay = 1;
  for (let w = 0; w < 52; w++) pay = repriceWeek(pay, 1000, 0, 2);
  const closed = (pay - 1) / (2 - 1);
  check(near(closed, 1 - Math.exp(-1 / PAY_RENEWAL_YEARS), 1e-9), 'pay closes 1 - e^-1 of the gap in a year (T = 1)', `closed ${fmt(closed)}`);
  const blended = repriceWeek(1, 900, 100, 2);
  check(near(blended, 2 - (2 - 1.1) * Math.exp(-1 / 52), 1e-12), 'new hires come in at the offer (head-weighted blend)', fmt(blended));
  // In the game: a premium makes the offer w(1+π); pay moves toward it.
  const s = fresh();
  s.player.hiring.premium.eng = 1;
  for (let w = 0; w < 52; w++) marketWeek(s, undefined);
  const offer = s.labour.pools.eng.w * 2;
  check(s.player.pay.eng > W0.eng * 1.5 && s.player.pay.eng < offer, 'pay moves toward the offer w(1+π), not overnight', `pay ${fmt(s.player.pay.eng, 3)}, offer ${fmt(offer, 3)}`);
}

// 7. Leavers leave E (no hires: talent pull -50 makes pull 0).
{
  const s = fresh();
  s.relations.talentPull = -50;
  const p = s.player;
  const ok = kinds.every((k) => {
    const E0 = labHeads(s, k);
    return E0 > 0;
  });
  const E = kinds.map((k) => labHeads(s, k));
  const U = kinds.map((k) => outsideHeads(s, k));
  const exp = kinds.map((k) => p.teams.filter((t) => t.role === k).reduce((a, t) => a + (t.heads * SEPARATION * attritionMorale(p, t.dept)) / 52, 0));
  marketWeek(s, undefined);
  const dE = kinds.map((k, i) => E[i] - labHeads(s, k));
  const dU = kinds.map((k, i) => outsideHeads(s, k) - U[i] - INFLOW[k] / 52);
  check(ok && kinds.every((_, i) => exp[i] > 0 && near(dE[i], exp[i], 1e-9) && near(dU[i], exp[i], 1e-6)), 'leavers (SEPARATION x morale factor) leave E and return to U',
    kinds.map((k, i) => `${k} -${fmt(dE[i], 2)} E, +${fmt(dU[i], 2)} U`).join(', '));
}

// 8. Payroll = Σ heads x pay, and a year of hiring under the market.
{
  const s = fresh();
  s.player.hiring.targets['re.cap'] += 4;
  s.player.hiring.targets['sci.saf'] += 2;
  s.player.hiring.premium.re = 0.5;
  for (let w = 0; w < 30; w++) marketWeek(s, undefined);
  const p = s.player;
  const manual = kinds.reduce((a, k) => a + playerHeads(p, k) * p.pay[k], 0) / 1000;
  const starPay = s.labour.stars.reduce((a, x) => a + (x.employer === 'player' ? x.pay : 0), 0) / 1000;
  check(near(payrollOf(s), manual + starPay, 1e-12), 'payroll = Σ heads x pay[k] + the star pay', `${fmt(payrollOf(s), 3)} $B/yr`);
  const split = payrollOf(s, 'cap') + payrollOf(s, 'saf');
  check(near(split, manual + starPay, 1e-12), 'capabilities + safety payroll = total');
  const reCap = p.teams.filter((t) => t.role === 're' && t.dept === 'cap').length;
  check(reCap >= 13, 're.cap teams arrive through the market', `${reCap} re.cap teams after 30 weeks, ${p.hiring.filling.length} filling`);
}

// Day-1 payroll at the default start.
{
  const s = fresh();
  console.log(`info: day-1 payroll ${fmt(payrollOf(s), 3)} $B/yr (cap ${fmt(payrollOf(s, 'cap'), 3)}, saf ${fmt(payrollOf(s, 'saf'), 3)})`);
}

console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
