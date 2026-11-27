// L12: the labour market's weekly system (design/bal/LABOUR-ROUND.md §4.2; src/engine/v2/departments/market.ts).
// Run: npx tsx scripts/v2/market.ts   (PASS/FAIL lines, exit 1 on any failure)
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { ALPHA, EPS, F0_PER_MONTH, INFLOW, P0, PAY_RENEWAL_YEARS, W0 } from '../../src/data/v2/labourMarket';
import { TEAM_SIZE } from '../../src/data/v2/teams';
import {
  labHeads, marketWage, marketWeek, MU_REF_V, openPositions, outsideHeads, playerHeads, repriceWeek, weeklyHires,
} from '../../src/engine/v2/departments/market';
import { changeHeads, fillWeeks, payrollOf } from '../../src/engine/v2/departments/teams';
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

// 7. Nobody leaves: with no hiring open, a lab's heads (and E) hold through weeks of the market.
{
  const s = fresh();
  s.relations.talentPull = -50;
  s.player.morale.overall = 0; // morale's only effect is hiring speed: even at zero nobody quits
  const E = kinds.map((k) => labHeads(s, k));
  for (let w = 0; w < 52; w++) marketWeek(s, undefined);
  check(kinds.every((k, i) => labHeads(s, k) === E[i]) && s.player.teams.every((t) => t.heads === t.size), 'no leavers: E and every team unchanged after a year at morale 0',
    kinds.map((k, i) => `${k} ${fmt(E[i], 1)} -> ${fmt(labHeads(s, k), 1)}`).join(', '));
}

// 7a. Raise a target by 2 teams: 2 full teams arrive; the weeks taken match fillWeeks (next team in ~N wk) within 30%.
{
  const s = fresh();
  const p = s.player;
  const key = 're.cap';
  const n0 = p.teams.filter((t) => t.role === 're' && t.dept === 'cap').length;
  p.hiring.targets[key] += 2;
  const est: number[] = [fillWeeks(s, 're')];
  const took: number[] = [];
  let since = 0;
  for (let w = 1; w <= 300 && took.length < 2; w++) {
    marketWeek(s, undefined);
    since++;
    const n = p.teams.filter((t) => t.role === 're' && t.dept === 'cap').length - n0;
    if (n > took.length) {
      took.push(since);
      since = 0;
      if (took.length < 2) est.push(fillWeeks(s, 're'));
    }
  }
  const fullTeams = p.teams.filter((t) => t.role === 're' && t.dept === 'cap').slice(n0);
  const within = took.length === 2 && took.every((x, i) => Math.abs(x - est[i]) <= 0.3 * est[i] + 1e-9);
  check(took.length === 2 && fullTeams.length === 2 && fullTeams.every((t) => t.heads === TEAM_SIZE.re), 'a target raised by 2 teams brings 2 full teams', `took ${took.join(' + ')} wk`);
  check(within, 'weeks taken match the next-team estimate within 30%', took.map((x, i) => `team ${i + 1}: ${x} wk vs est ${fmt(est[i], 1)}`).join('; '));
}

// 7b. Hold a target for 2 years: heads never fall, no team is ever below full.
{
  const s = fresh();
  const p = s.player;
  p.hiring.targets['sci.cap'] += 1;
  p.hiring.targets['eng'] += 1;
  let prev = kinds.map((k) => playerHeads(p, k));
  let fell = 0;
  let partial = 0;
  for (let w = 0; w < 104; w++) {
    marketWeek(s, undefined);
    kinds.forEach((k, i) => { const h = playerHeads(p, k); if (h < prev[i] - 1e-9) fell++; prev[i] = h; });
    partial += p.teams.filter((t) => t.heads !== t.size).length;
  }
  check(fell === 0 && partial === 0, 'target held 2 years: heads never fall, no team below full', `${fell} falls, ${partial} part-team weeks`);
}

// 7c. changeHeads moves whole teams (events: C4, E16, E22, E32 call it).
{
  const s = fresh();
  const p = s.player;
  const n = (role: TeamRole, dept: string) => p.teams.filter((t) => t.role === role && t.dept === dept).length;
  const before = { eng: n('eng', 'cap'), re: n('re', 'cap'), sci: n('sci', 'cap') };
  const moved = changeHeads(s, 'cap', 500); // 500 heads: eng 150 -> 2 teams, re 275 -> 6, sci 75 -> 4
  const want = { eng: 2, re: 6, sci: 4 };
  const got = { eng: n('eng', 'cap') - before.eng, re: n('re', 'cap') - before.re, sci: n('sci', 'cap') - before.sci };
  check(kinds.every((k) => got[k] === want[k]) && moved === 2 * 100 + 6 * 50 + 4 * 20 && p.teams.every((t) => t.heads === t.size), '+500 capabilities heads -> 2 + 6 + 4 whole full teams', `moved ${moved} heads, teams ${JSON.stringify(got)}`);
  const ids = p.teams.filter((t) => t.role === 're' && t.dept === 'cap').map((t) => t.id);
  const lost = changeHeads(s, 'cap', -500);
  const left = new Set(p.teams.map((t) => t.id));
  const newestGone = ids.slice(-6).every((id) => !left.has(id));
  check(lost === -moved && newestGone && n('re', 'cap') === before.re && p.teams.every((t) => t.heads === t.size), '-500 removes the same whole teams, newest first', `moved ${lost} heads`);
  check(changeHeads(s, 'cap', 5) === 0 && changeHeads(s, 'saf', -3) === 0, 'a change too small for a team moves nobody');
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
  check(reCap > 21, 're.cap teams arrive through the market', `${reCap} re.cap teams after 30 weeks, ${fmt(p.hiring.progress.re.heads, 1)} heads toward the next`);
}

// Day-1 payroll at the default start.
{
  const s = fresh();
  console.log(`info: day-1 payroll ${fmt(payrollOf(s), 3)} $B/yr (cap ${fmt(payrollOf(s, 'cap'), 3)}, saf ${fmt(payrollOf(s, 'saf'), 3)})`);
}

console.log(fails ? `${fails} FAIL` : 'ALL PASS');
process.exit(fails ? 1 : 0);
