// W6 test: the China government (src/engine/v2/world/chinagov.ts) on constructed cases over the fixture states, stepping
// the daily step directly (no sampled games). The US lead over China is set through China's public report (the lag
// outsiders read, npc/public.ts).   npx tsx scripts/v2/worldChina.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../src/engine/v2/core/save';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { cadencesDue, decimalYear } from '../../src/engine/v2/core/time';
import { aiRdOf, CHINAGOV, initialChinagov, resolveTreaty, stepChinagov } from '../../src/engine/v2/world/chinagov';
import { playerAttention, USGOV } from '../../src/engine/v2/world/usgov';
import { frontier, usLeadOverChinaMonths } from '../../src/engine/v2/world/observe';
import { taiwanHazardQ } from '../../src/engine/v2/compute/market';
import { poolsOf } from '../../src/engine/v2/compute/power';
import { refYear } from '../../src/engine/v2/npc/shocks';
import { signCommitment } from '../../src/engine/v2/actors/commitments';
import { endingsSystem } from '../../src/engine/v2/endings/endings';
import { securitySystem } from '../../src/engine/v2/security/security';
import { theftHazardDaily } from '../../src/engine/v2/security/theft';
import { ws4 } from '../../src/engine/v2/actors/state';
import { DAYS_PER_MONTH } from '../../src/engine/v2/npc/lab';
import { FIXTURE_DIR, check, finish } from './lib';
import type { GameStateV2 } from '../../src/engine/v2/types';

const load = (n: string): GameStateV2 => {
  const s = deserialize(readFileSync(join(FIXTURE_DIR, n), 'utf8'));
  s.chinagov = initialChinagov();
  s.market.exportPolicy = 'caseByCase';
  s.usgov.thefts = [];
  return s;
};
/** Set the US lead over China (months) by China's public report. */
const setLead = (s: GameStateV2, months: number) => {
  const f = frontier(s);
  let us = Infinity;
  for (const id of Object.keys(f.lagMonths)) if (id !== 'china' && f.lagMonths[id]! < us) us = f.lagMonths[id]!;
  s.china.lab.npc.pub!.lagDays = (us + months) * DAYS_PER_MONTH;
};
const step = (s: GameStateV2, days: number, each?: (s: GameStateV2) => void) => {
  for (let i = 0; i < days; i++) { s.time.day++; stepChinagov(s, makeCtx(s)); each?.(s); }
};
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// S5: a growing US lead climbs tension 0 -> 1 -> 2 (the national collective); strict export controls alone reach 1.
{
  const s = load('day400.json');
  setLead(s, 7);
  check(near(usLeadOverChinaMonths(s) ?? NaN, 7, 1e-3), 'fixture: the US lead is set by China\'s public report', String(usLeadOverChinaMonths(s)));
  step(s, CHINAGOV.holdDays - 2);
  check(s.chinagov.tension === 0, 'S5: a 7-month lead does not climb before the hold', String(s.chinagov.tension));
  step(s, 3);
  check(s.chinagov.tension === 1, 'S5: a 7-month lead held 60 days -> tension 1 (acquisition push)', String(s.chinagov.tension));
  const c0 = s.china.lab.core.computeOnline;
  const a0 = s.china.access;
  s.chinagov.leadHist = [7, 8, 9, 10, 10.5]; // widening over 4 quarters
  setLead(s, 11);
  step(s, CHINAGOV.holdDays + 1, (x) => { x.chinagov.leadHist = [7, 8, 9, 10, 10.5]; });
  check(s.chinagov.tension === 2 && s.chinagov.centralised, 'S5: an 11-month widening lead -> tension 2, the national collective', `${s.chinagov.tension}, centralised ${s.chinagov.centralised}`);
  check(near(s.china.lab.core.computeOnline / c0, CHINAGOV.centralMult) && near(s.china.access / a0, CHINAGOV.centralMult), `S5: the collective multiplies China's lab compute and chip access by ${CHINAGOV.centralMult}`, `${(s.china.lab.core.computeOnline / c0).toFixed(3)}, ${(s.china.access / a0).toFixed(3)}`);
  step(s, CHINAGOV.coerceAfterDays + CHINAGOV.holdDays + 1);
  check(s.chinagov.tension === 3, 'S5: the lead still above 9 months a year after the collective -> tension 3 (coercion)', String(s.chinagov.tension));
  setLead(s, 0);
  step(s, 400);
  check(s.chinagov.tension === 3, 'S5: rung 3 is sticky (lead gone for 400 days)', String(s.chinagov.tension));

  const t = load('day400.json');
  setLead(t, 0);
  t.market.exportPolicy = 'strict';
  step(t, CHINAGOV.holdDays + 1);
  check(t.chinagov.tension === 1, 'S5: strict export controls alone -> tension 1', String(t.chinagov.tension));
  step(t, 365);
  check(t.chinagov.tension === 1, 'S5: strict export controls alone never reach 2', String(t.chinagov.tension));
  t.market.exportPolicy = 'caseByCase';
  step(t, CHINAGOV.downDays + 1);
  check(t.chinagov.tension === 0, 'S5: tension 1 eases 180 days after its condition fails', String(t.chinagov.tension));

  const u = load('day400.json');
  setLead(u, 1);
  u.usgov.stage = 1;
  step(u, 30);
  check(u.chinagov.talks === 0, 'S5: a 1-month lead at US stage 1 opens no talks', String(u.chinagov.talks));
  u.usgov.stage = 2;
  step(u, 1);
  check(u.chinagov.talks === 1, 'S5: a lead under 3 months with the US at stage 2 opens talks', String(u.chinagov.talks));
  const v = load('day400.json');
  setLead(v, 5);
  v.usgov.stage = 2;
  step(v, 30);
  check(v.chinagov.talks === 0, 'S5: a 5-month lead without a scare opens no talks', String(v.chinagov.talks));
}

// S6: the Taiwan hazard scales with tension by the stated factor (the shock itself is compute/market.ts taiwanShock).
{
  const s = load('day400.json');
  const h0 = taiwanHazardQ(s);
  s.chinagov.tension = 3;
  const h3 = taiwanHazardQ(s);
  const want = h0 * (1 + 3 * CHINAGOV.taiwanPerRung) + CHINAGOV.taiwanCoercion;
  check(near(h3, want), `S6: Taiwan hazard at tension 3 = tension 0 × ${1 + 3 * CHINAGOV.taiwanPerRung} + ${CHINAGOV.taiwanCoercion}`, `${h0.toFixed(4)} -> ${h3.toFixed(4)} (want ${want.toFixed(4)})`);
  s.chinagov.tension = 2;
  check(near(taiwanHazardQ(s), h0 * 2), 'S6: tension 2 doubles it (no coercion add)', taiwanHazardQ(s).toFixed(4));
}

// Treaty: talks -> restraint (E23 to an attended player) -> verified only with pre-deploy testing; the player's AI R&D
// pool stays at the signing-day cap; the NPC reference clock slows.
{
  const s = load('day900.json'); // the player leads (attention 1)
  setLead(s, 2);
  s.usgov.stage = 2;
  const att = playerAttention(s);
  check(att >= USGOV.attentionMin, 'treaty fixture: the player is attended (E23 goes to it)', att.toFixed(2));
  step(s, 1);
  check(s.chinagov.talks === 1, 'treaty: talks open', String(s.chinagov.talks));
  step(s, CHINAGOV.quietDays + 1);
  check(s.chinagov.talks === 1 && ws4(s).requests.some((r) => r.id === 'E23'), 'treaty: 180 quiet days -> E23 to the player (talks wait)', `talks ${s.chinagov.talks}`);
  resolveTreaty(s, makeCtx(s), true);
  check(s.chinagov.talks === 2 && s.chinagov.treaty === 'restraint', 'treaty: Back it -> restraint', s.chinagov.treaty);
  step(s, CHINAGOV.verifyDays + 30);
  check(s.chinagov.talks === 2, 'treaty: no verified treaty without pre-deploy testing (attended player)', String(s.chinagov.talks));
  signCommitment(s, makeCtx(s), 'testingAgreement', 'Pre-deployment testing', 'preDeployTesting', { days: 21 });
  step(s, 1);
  check(s.chinagov.talks === 3 && s.chinagov.treaty === 'verified' && s.chinagov.cap !== undefined, 'treaty: pre-deploy testing makes it verifiable -> verified', `${s.chinagov.treaty}, cap ${s.chinagov.cap}`);
  const cap = s.chinagov.cap!;
  check(near(aiRdOf(poolsOf(s)), cap), 'treaty: on the signing day the AI R&D pool is the cap', `${aiRdOf(poolsOf(s)).toFixed(0)} vs ${cap.toFixed(0)}`);
  s.player.computeOnline *= 2;
  const p = poolsOf(s);
  check(near(aiRdOf(p), cap) && p.idle > 0, 'treaty: with twice the compute the AI R&D pool stays at the cap (the rest idles)', `${aiRdOf(p).toFixed(0)} vs ${cap.toFixed(0)}, idle ${p.idle.toFixed(0)}`);
  const y0 = decimalYear(s) - refYear(s);
  step(s, 100);
  const lost = (decimalYear(s) - refYear(s) - y0) * 365.25;
  check(near(lost, 100 * (1 - CHINAGOV.treatyClockRate), 1e-6), `treaty: 100 verified days hold the NPC reference clock back ${(100 * (1 - CHINAGOV.treatyClockRate)).toFixed(0)} days`, lost.toFixed(2));

  // Oppose: rejected (concern 50), or overridden by the public (concern 80).
  for (const [concern, want] of [[50, 'rejected'], [80, 'restraint']] as const) {
    const o = load('day400.json');
    o.chinagov.talks = 1;
    o.public.concern = concern;
    resolveTreaty(o, makeCtx(o), false);
    check(want === 'rejected' ? o.chinagov.rejected && (o.chinagov.talks as number) === 0 : o.chinagov.treaty === 'restraint', `treaty: Oppose at concern ${concern} -> ${want}`, `${o.chinagov.treaty}, rejected ${o.chinagov.rejected}`);
  }

  // A player Washington ignores: restraint and the verified treaty come without it (no E23, no testing needed).
  const w = load('day400.json');
  w.player.deployments = [];
  setLead(w, 2);
  w.usgov.stage = 2;
  const attW = playerAttention(w);
  step(w, 1 + CHINAGOV.quietDays + 1 + CHINAGOV.verifyDays + 1);
  check(attW < USGOV.attentionMin && w.chinagov.treaty === 'verified' && !ws4(w).requests.some((r) => r.id === 'E23'), 'treaty: with low player attention it reaches verified without E23', `attention ${attW.toFixed(2)}, ${w.chinagov.treaty}`);
}

// War: the ending fires only at tension 4 (CHINAGOV.warPerQuarter a quarter).
{
  const war = (tension: 3 | 4) => {
    const s = load('day400.json');
    s.flags['harness:observer'] = true; // player endings off: only world endings
    s.chinagov.tension = tension;
    for (let q = 0; q < 24 && !s.ending; s.time.day++) if (cadencesDue(s.time.startDate, s.time.day).includes('quarterly')) { q++; endingsSystem.run(s, makeCtx(s)); }
    return s.ending?.id;
  };
  const w3 = war(3);
  const w4 = war(4);
  check(w3 !== 'war', 'war: no war ending in 24 quarters at tension 3', String(w3));
  check(w4 === 'war', 'war: the war ending within 24 quarters at tension 4', String(w4));
}

// Theft: tension 0 -> no Chinese attempts; tension 1 with a leading, attended player -> attempts.
{
  const attempts = (tension: 0 | 1) => {
    const s = load('day900.json'); // the player leads China by over a year, attention 1
    s.chinagov.tension = tension;
    s.player.security.wsl = 1; // a lab at the industry floor (the security system raises it there)
    const h = theftHazardDaily(s);
    const a0 = ws4(s).theftAttempts;
    for (let i = 0; i < 3 * 365; i++) { s.time.day++; securitySystem.run(s, makeCtx(s)); }
    return { h, n: ws4(s).theftAttempts - a0 };
  };
  const t0 = attempts(0);
  const t1 = attempts(1);
  check(t0.h === 0 && t0.n === 0, 'theft: tension 0 -> no Chinese theft attempts in 3 years', `hazard ${t0.h}, attempts ${t0.n}`);
  check(t1.h > 0 && t1.n > 0, 'theft: tension 1, a leading attended player -> attempts in 3 years', `hazard ${t1.h.toFixed(4)}/day, attempts ${t1.n}`);
}

finish('worldChina');
