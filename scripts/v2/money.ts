// Money-flow audit (M2 integration). Owner: WS1 (integration).
//
// Every change to player cash must go through WS3's finance ledger (`bookCash`, finance/ledger.ts) exactly once, and
// each recurring flow has a single owner:
//   - revenue: booked once a day by WS5's revenue system; WS3 only derives the run-rate from deployment.revenueRate;
//   - security spend and the transition fund: charged monthly only by WS3's payroll system;
//   - training runs: charged once at launch by WS1.
// Over real bot games (all systems live, bots acting through the action API and the WS3 autopilot) this checks:
//   1. Σ of every 'cash' cause entry = Δcash (nothing changes cash without recording a cause);
//   2. Σ of the ledger flows (YearStats.flows) = Δcash (nothing records a cash cause outside the ledger);
//   3. per-flow single-charge checks (revenue = Σ deployment revenueRate / 365, one security and one fund charge a
//      month at the policy rate, one training charge per paid run, WS3's revenue tally = booked revenue).
import { refBot } from '../../src/engine/v2/bots/ref';
import { safeBot } from '../../src/engine/v2/bots/safe';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { cadencesDue } from '../../src/engine/v2/core/time';
import { engine } from '../../src/engine/v2/index';
import { totalFlows } from '../../src/engine/v2/finance/ledger';
import type { BotPolicy, CashFlowKind, CauseEntry } from '../../src/engine/v2/types';
import { check, finish } from './lib';

const DAYS = 730;
const close = (a: number, b: number, rel = 1e-6) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));
const f2 = (x: number) => x.toFixed(2);

interface Audit {
  causeSum: number;
  dCash: number;
  flows: Partial<Record<CashFlowKind, number>>;
  bySource: Record<string, number>;
  overflow: boolean;
  revenueExpected: number;
  revenueEntriesMaxPerDay: number;
  securityExpected: number;
  securityCharges: number;
  fundExpected: number;
  fundCharges: number;
  months: number;
  trainingRunsPaid: number;
  trainingCharges: number;
  ys: { revenue: number; booked: number };
}

function audit(bot: BotPolicy, seed: number): Audit {
  const s = newGame(defaultSetupV2({ seed, tutorial: false }));
  const cash0 = s.player.finance.cash;
  const flows0 = totalFlows(s);
  const seen = new Set<CauseEntry>(s.causes.byKey.cash ?? []);
  const a: Audit = {
    causeSum: 0, dCash: 0, flows: {}, bySource: {}, overflow: false, revenueExpected: 0, revenueEntriesMaxPerDay: 0,
    securityExpected: 0, securityCharges: 0, fundExpected: 0, fundCharges: 0, months: 0, trainingRunsPaid: 0, trainingCharges: 0,
    ys: { revenue: 0, booked: 0 },
  };
  const paidRuns = new Set<string>();
  const collect = () => {
    const buf = s.causes.byKey.cash ?? [];
    if (buf.length && !seen.has(buf[0]) && seen.size > 0 && buf.length >= 40) a.overflow = true;
    let revenueToday = 0;
    for (const e of buf) {
      if (seen.has(e)) continue;
      seen.add(e);
      a.causeSum += e.delta;
      a.bySource[e.source] = (a.bySource[e.source] ?? 0) + e.delta;
      if (e.source === 'revenue') revenueToday++;
      if (e.source === 'security spend') a.securityCharges++;
      if (e.source === 'transition fund') a.fundCharges++;
      if (e.source === 'training run') a.trainingCharges++;
    }
    a.revenueEntriesMaxPerDay = Math.max(a.revenueEntriesMaxPerDay, revenueToday);
  };
  while (s.time.day < DAYS && !s.ending) {
    for (const p of [...s.events.pending]) {
      const c = bot.decide(s, p);
      if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    bot.act(s, engine);
    for (const r of s.player.models.runs) if (r.cashCost > 0 && !paidRuns.has(r.id)) paidRuns.add(r.id);
    const monthly = cadencesDue(s.time.startDate, s.time.day + 1).includes('monthly');
    const sec = s.player.security.spendRate;
    const fund = s.player.policies.transitionFund;
    collect();
    tick(s);
    collect();
    if (monthly) {
      a.months++;
      a.securityExpected += sec / 12;
      a.fundExpected += fund / 12;
    }
    // Revenue booked today = Σ revenueRate of the deployments the revenue system priced today.
    a.revenueExpected += s.player.deployments.reduce((x, d) => x + (d.status !== 'withdrawn' ? (d.revenueRate ?? 0) : 0), 0) / 365;
  }
  a.trainingRunsPaid = paidRuns.size;
  a.dCash = s.player.finance.cash - cash0;
  const fl = totalFlows(s);
  for (const k of Object.keys(fl) as CashFlowKind[]) a.flows[k] = (fl[k] ?? 0) - (flows0[k] ?? 0);
  for (const ys of Object.values(s.player.finance.ws3.years)) {
    a.ys.revenue += ys.revenue;
    a.ys.booked += ys.flows?.revenue ?? 0;
  }
  return a;
}

/** RefBot = WS1's reference model policy + WS3's reference finance autopilot (its bot wiring). */
const BOTS: [string, BotPolicy, number][] = [['ref', refBot, 2027], ['ref', refBot, 11], ['safe', safeBot, 5]];
for (const [name, bot, seed] of BOTS) {
  const a = audit(bot, seed);
  const flowSum = Object.values(a.flows).reduce((x, y) => x + (y ?? 0), 0);
  const tag = `${name}/seed ${seed}`;
  const top = Object.entries(a.flows).sort((x, y) => Math.abs(y[1] ?? 0) - Math.abs(x[1] ?? 0)).map(([k, v]) => `${k} ${f2(v ?? 0)}`).join(', ');
  console.log(`      ${tag}: Δcash ${f2(a.dCash)} over ${DAYS} d — flows ${top}`);
  check(!a.overflow, `${tag}: cash cause ring never overflowed within a day (audit is complete)`);
  check(close(a.causeSum, a.dCash), `${tag}: Σ cash cause deltas = Δcash`, `${f2(a.causeSum)} vs ${f2(a.dCash)}`);
  check(close(flowSum, a.dCash), `${tag}: Σ finance-ledger flows = Δcash (every cash change booked through bookCash)`, `${f2(flowSum)} vs ${f2(a.dCash)}`);
  check(close(a.flows.revenue ?? 0, a.revenueExpected, 1e-3) && a.revenueEntriesMaxPerDay <= 1, `${tag}: revenue booked once a day = Σ deployment revenueRate / 365`, `${f2(a.flows.revenue ?? 0)} vs ${f2(a.revenueExpected)}; ≤ ${a.revenueEntriesMaxPerDay}/day`);
  check(close(a.ys.revenue, a.ys.booked, 1e-9), `${tag}: WS3 revenue tally = booked revenue (no second revenue booking)`, `${f2(a.ys.revenue)} vs ${f2(a.ys.booked)}`);
  check(close(-(a.flows.security ?? 0), a.securityExpected, 1e-6) && a.securityCharges <= a.months, `${tag}: security spend charged once a month at spendRate/12 (WS3 only)`, `${f2(-(a.flows.security ?? 0))} vs ${f2(a.securityExpected)}; ${a.securityCharges} charges / ${a.months} months`);
  check(close(-(a.flows.transitionFund ?? 0), a.fundExpected, 1e-6) && a.fundCharges <= a.months, `${tag}: transition fund charged once a month at fund/12 (WS3 only)`, `${f2(-(a.flows.transitionFund ?? 0))} vs ${f2(a.fundExpected)}; ${a.fundCharges} charges`);
  check(a.trainingCharges === a.trainingRunsPaid, `${tag}: one cash charge per paid training run (WS1, at launch)`, `${a.trainingCharges} charges, ${a.trainingRunsPaid} paid runs`);
}
finish('money');
