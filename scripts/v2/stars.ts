// L17: the stars engine (design/bal/LABOUR-ROUND.md §6.2, §6.3): a star's taste joins the researchers' mean, hiring and
// poaching move a star to the player and its pay into payroll.
// Run: npx tsx scripts/v2/stars.ts   (PASS/FAIL lines, exit 1 on any failure)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { act } from '../../src/engine/v2/core/loop';
import { tasteSigma, Phi } from '../../src/engine/v2/production/ces';
import { humanTasteMean } from '../../src/engine/v2/departments/workfit';
import { payrollOf } from '../../src/engine/v2/departments/teams';
import { isCapProject, sciOn } from '../../src/engine/v2/models/research';
import { PREMIUM_STEPS, STAR_POACH_COOPERATION, W_STAR0 } from '../../src/data/v2/labourMarket';
import { TIMELINE_DRAWS } from '../../src/data/v2/timelineDraws';
import { PROJECT_BY_ID } from '../../src/data/v2/tree';
import type { GameStateV2, Star } from '../../src/engine/v2/types';

let fails = 0;
const check = (ok: boolean, label: string, detail = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`);
};
const warn = (ok: boolean, label: string, detail = '') => console.log(`${ok ? 'PASS' : 'WARN'} ${label}${detail ? `  (${detail})` : ''}`);
const near = (a: number, b: number, tol = 1e-12) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

const fresh = (): GameStateV2 => newGame(defaultSetupV2({ seed: 1 } as never));
const sciHeads = (s: GameStateV2) => s.player.teams.filter((t) => t.role === 'sci' && t.dept === 'cap').reduce((a, t) => a + t.heads, 0);
const mine = (s: GameStateV2) => s.labour.stars.filter((x) => x.employer === 'player');

// 1. T_h = (S + sum T_star) / (S + n), computed independently, for 0, 1 and 7 stars.
{
  const s = fresh();
  const S = sciHeads(s);
  const pool = [...s.labour.stars].sort((a, b) => a.id.localeCompare(b.id));
  for (const n of [0, 1, 7]) {
    for (const x of s.labour.stars) x.employer = 'outside';
    const pick = pool.slice(0, n);
    for (const x of pick) x.employer = 'player';
    let sum = 0;
    for (const x of pick) sum += x.taste;
    const want = (S * 1 + sum) / (S + n);
    const got = humanTasteMean(s);
    check(near(got, want), `T_h with ${n} star(s) = (S + sum T) / (S + n)`, `S ${S}, got ${got.toFixed(6)}, want ${want.toFixed(6)}`);
  }
  check(S > 0 && near(humanTasteMean({ ...s, labour: { ...s.labour, stars: [] } } as GameStateV2), 1), 'no stars: T_h = 1');
}

// 2. Scale: one star of the median star taste, at the median m2b, on the idea quality of a capability project.
{
  const m2bs = TIMELINE_DRAWS.central.rows.map((r) => r[5]).sort((a, b) => a - b);
  const m2b = m2bs[Math.floor(m2bs.length / 2)];
  const sigma = tasteSigma(m2b);
  // The median star: the quantile midway in the top 0.1% (u = 0.9995), as the star draw (init.ts initialLabour).
  let lo = 0, hi = 8;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (Phi(mid) < 0.9995) lo = mid; else hi = mid; }
  const tMed = Math.exp(-0.5 * sigma * sigma + sigma * lo);
  const s = fresh();
  s.hidden.timeline.prod.m2b = m2b;
  for (const x of s.labour.stars) x.employer = 'outside';
  const id = s.player.research.queue.find((q) => isCapProject(PROJECT_BY_ID[q])) ?? Object.keys(PROJECT_BY_ID).find((q) => isCapProject(PROJECT_BY_ID[q]));
  const team = s.player.teams.find((t) => t.role === 'sci' && t.dept === 'cap');
  if (!id || !team) { check(false, 'a capability project and a science team to measure idea quality'); } else {
    team.projectId = id;
    const q0 = sciOn(s, id);
    const spare = s.labour.stars[0];
    spare.taste = tMed;
    spare.employer = 'player';
    const q1 = sciOn(s, id);
    const gain = (q1.q / q0.q - 1) * 100;
    const gainH = ((q1.qh ?? 1) / (q0.qh ?? 1) - 1) * 100;
    console.log(`INFO median m2b ${m2b.toFixed(3)} (sigma ${sigma.toFixed(3)}), median star taste ${tMed.toFixed(3)}, S ${sciHeads(s)}: idea quality (mixture q) +${gain.toFixed(3)}%, human taste +${gainH.toFixed(3)}%`);
    warn(gain >= 0.4 && gain <= 1.4, 'one median star lifts idea quality by about +0.4 to +1.4% (scale check)', `+${gain.toFixed(3)}%`);
    check(gain > 0, 'a star raises idea quality');
  }
}

// 3. Hiring an outside star: the star becomes the player's and its pay enters payroll.
{
  const s = fresh();
  const star = s.labour.stars.find((x) => x.employer === 'outside') as Star;
  const before = payrollOf(s.player, undefined, s.labour.stars);
  const n0 = mine(s).length;
  const err = act(s, 'starHire', { star: star.id });
  const after = payrollOf(s.player, undefined, s.labour.stars);
  check(!err && star.employer === 'player' && mine(s).length === n0 + 1, 'hiring an outside star makes it the player\'s', String(err ?? ''));
  check(near(after - before, W_STAR0 / 1000, 1e-9) && star.pay === W_STAR0, 'its pay enters payroll in $B/yr (asking pay W_STAR0, no premium)', `${((after - before) * 1000).toFixed(3)} $M/yr`);
  check(near(payrollOf(s.player, 'saf', s.labour.stars), payrollOf({ teams: s.player.teams, hiring: s.player.hiring }, 'saf'), 1e-12), 'star pay counts in the capabilities department only');
  check(act(s, 'starHire', { star: star.id }) !== undefined, 'a star already on staff cannot be hired again');
}

// 4. Poaching a rival's star: pay x (1 + premium step), the -20 cooperation with that rival.
{
  const s = fresh();
  const star = s.labour.stars.find((x) => x.employer !== 'outside' && x.employer !== 'player' && x.employer !== 'china') as Star;
  const rival = s.rivals.find((r) => r.core.id === star.employer);
  const others = s.rivals.filter((r) => r !== rival).map((r) => r.meters.cooperation);
  const coop0 = rival ? rival.meters.cooperation : NaN;
  const before = payrollOf(s.player, undefined, s.labour.stars);
  const step = PREMIUM_STEPS[2];
  const pay0 = star.pay;
  const err = act(s, 'starHire', { star: star.id, premium: step });
  const after = payrollOf(s.player, undefined, s.labour.stars);
  check(!err && star.employer === 'player', 'poaching a rival\'s star makes it the player\'s', String(err ?? ''));
  check(near(star.pay, pay0 * (1 + step)) && near(after - before, (pay0 * (1 + step)) / 1000, 1e-9), `pay = star pay x (1 + ${step}) and enters payroll`, `${star.pay} $M/yr`);
  check(!!rival && near(rival.meters.cooperation, Math.max(-100, coop0 + STAR_POACH_COOPERATION)), `that rival's cooperation ${STAR_POACH_COOPERATION}`, `${coop0} -> ${rival?.meters.cooperation}`);
  check(s.rivals.filter((r) => r !== rival).every((r, i) => r.meters.cooperation === others[i]), 'the other rivals are untouched');
}

// 5. China's stars cannot be hired.
{
  const s = fresh();
  const cs = s.labour.stars.find((x) => x.employer === 'china');
  if (!cs) check(false, 'a China star exists at this seed');
  else {
    const err = act(s, 'starHire', { star: cs.id });
    check(err !== undefined && cs.employer === 'china', "a China star cannot be hired", String(err));
  }
}

// 6. The old star mechanism is gone.
{
  const here = dirname(fileURLToPath(import.meta.url));
  const names = ['STAR' + '_HIRE', 'tau' + 'H', 'taste' + 'Hire', 'starTaste' + 'Of'];
  const re = new RegExp(names.join('|'));
  const hits: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      if (f === 'node_modules' || f === 'fixtures' || f.startsWith('_')) continue;
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f) && re.test(readFileSync(p, 'utf8'))) hits.push(p.replace(join(here, '../..'), ''));
    }
  };
  walk(join(here, '../../src'));
  walk(here);
  check(hits.filter((h) => !/stars\.ts$/.test(h)).length === 0, `${names.join(' / ')} are gone from src and scripts/v2`, hits.join(', '));
}

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
