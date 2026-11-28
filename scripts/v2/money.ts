// Money-flow audit (M2 integration). Owner: WS1 (integration).
//
// Every change to player cash must go through WS3's finance ledger (`bookCash`, finance/ledger.ts) exactly once, and
// each recurring flow has a single owner:
//   - revenue: booked once a day by WS5's revenue system; WS3 only derives the run-rate from deployment.revenueRate;
//   - security spend and the transition fund: charged monthly only by WS3's payroll system;
//   (A training run no longer has a cash cost, plan.cashCost is 0 since the data licences are paid at signing, so the old
//   "one charge per paid run" check is gone.)
// Over real bot games (all systems live, bots acting through the action API and the WS3 autopilot) this checks:
//   1. Σ of every 'cash' cause entry = Δcash (nothing changes cash without recording a cause);
//   2. Σ of the ledger flows (YearStats.flows) = Δcash (nothing records a cash cause outside the ledger);
//   3. per-flow single-charge checks (revenue = Σ deployment revenueRate / 365, one security and one fund charge a
//      month at the policy rate, WS3's revenue tally = booked revenue).
// GUARDS: cash conservation across the finance rebuild (every cash change recorded once, through the ledger).
// COST: RefBot 100 days from a fresh game + SafeBot 70 days from the day-400 fixture ≈ 170 bot days ≈ 16 CPU-s (was 3 × 730
// days, 154 CPU-s). TIER: quick.
import { refBot } from '../../src/engine/v2/bots/ref';
import { safeBot } from '../../src/engine/v2/bots/safe';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { cadencesDue } from '../../src/engine/v2/core/time';
import { engine } from '../../src/engine/v2/index';
import { totalFlows } from '../../src/engine/v2/finance/ledger';
import type { BotPolicy, CashFlowKind, CauseEntry, GameStateV2 } from '../../src/engine/v2/types';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../src/engine/v2/core/save';
import { FIXTURE_DIR, check, finish } from './lib';

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
  ys: { revenue: number; booked: number };
}

function audit(bot: BotPolicy, s: GameStateV2, days: number): Audit {
  const end = s.time.day + days;
  const cash0 = s.player.finance.cash;
  const flows0 = totalFlows(s);
  // J1 (jank F1): cash causes merge per day and source, so an entry can grow after it was first seen: count increments.
  const seen = new Map<CauseEntry, number>((s.causes.byKey.cash ?? []).map((e) => [e, e.delta]));
  const a: Audit = {
    causeSum: 0, dCash: 0, flows: {}, bySource: {}, overflow: false, revenueExpected: 0, revenueEntriesMaxPerDay: 0,
    securityExpected: 0, securityCharges: 0, fundExpected: 0, fundCharges: 0, months: 0,
    ys: { revenue: 0, booked: 0 },
  };
  const collect = () => {
    const buf = s.causes.byKey.cash ?? [];
    if (buf.length && !seen.has(buf[0]) && seen.size > 0 && buf.length >= 40) a.overflow = true;
    let revenueToday = 0;
    for (const e of buf) {
      const before = seen.get(e);
      if (before !== undefined && before === e.delta) continue;
      const add = e.delta - (before ?? 0);
      seen.set(e, e.delta);
      a.causeSum += add;
      a.bySource[e.source] = (a.bySource[e.source] ?? 0) + add;
      if (e.source === 'revenue' && before === undefined) revenueToday++;
      if (e.source === 'security spend' && before === undefined) a.securityCharges++;
      if (e.source === 'transition fund' && before === undefined) a.fundCharges++;
    }
    a.revenueEntriesMaxPerDay = Math.max(a.revenueEntriesMaxPerDay, revenueToday);
  };
  while (s.time.day < end && !s.ending) {
    for (const p of [...s.events.pending]) {
      const c = bot.decide(s, p);
      if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    bot.act(s, engine);
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
  a.dCash = s.player.finance.cash - cash0;
  const fl = totalFlows(s);
  for (const k of Object.keys(fl) as CashFlowKind[]) a.flows[k] = (fl[k] ?? 0) - (flows0[k] ?? 0);
  for (const ys of Object.values(s.player.finance.ws3.years)) {
    a.ys.revenue += ys.revenue;
    a.ys.booked += ys.flows?.revenue ?? 0;
  }
  return a;
}

/** Cases (TESTING §2: the invariant is per day and per flow, so it needs every flow to occur, not two years of them):
 *  a fresh game with RefBot (WS1's reference model policy + WS3's finance autopilot) for 100 days (3 months: the training
 *  runs and the first payroll cycles), and the day-400 fixture (the same seed-2027 game, mid-game: rounds, a big revenue
 *  stream, many products) with SafeBot for 70 days (2 months). Security spend and the transition fund are set on in both
 *  (the player can), so those checks are never 0 == 0. Was 3 games × 730 days. */
const CASES: [string, BotPolicy, () => GameStateV2, number][] = [
  ['ref/seed 2027 day 0', refBot, () => newGame(defaultSetupV2({ seed: 2027, tutorial: false })), 100],
  ['safe/seed 2027 day 400', safeBot, () => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8')), 70],
];
for (const [tag, bot, start, days] of CASES) {
  const s0 = start();
  s0.player.security.spendRate = Math.max(s0.player.security.spendRate, 0.02 * Math.max(1, s0.player.finance.cash));
  s0.player.policies.transitionFund = Math.max(s0.player.policies.transitionFund, 0.01 * Math.max(1, s0.player.finance.cash));
  const a = audit(bot, s0, days);
  const flowSum = Object.values(a.flows).reduce((x, y) => x + (y ?? 0), 0);
  const top = Object.entries(a.flows).sort((x, y) => Math.abs(y[1] ?? 0) - Math.abs(x[1] ?? 0)).map(([k, v]) => `${k} ${f2(v ?? 0)}`).join(', ');
  console.log(`      ${tag}: Δcash ${f2(a.dCash)} over ${days} d — flows ${top}`);
  check(!a.overflow, `${tag}: cash cause ring never overflowed within a day (audit is complete)`);
  check(close(a.causeSum, a.dCash), `${tag}: Σ cash cause deltas = Δcash`, `${f2(a.causeSum)} vs ${f2(a.dCash)}`);
  check(close(flowSum, a.dCash), `${tag}: Σ finance-ledger flows = Δcash (every cash change booked through bookCash)`, `${f2(flowSum)} vs ${f2(a.dCash)}`);
  check(a.revenueExpected > 0 && close(a.flows.revenue ?? 0, a.revenueExpected, 1e-3) && a.revenueEntriesMaxPerDay <= 1, `${tag}: revenue booked once a day = Σ deployment revenueRate / 365`, `${f2(a.flows.revenue ?? 0)} vs ${f2(a.revenueExpected)}; ≤ ${a.revenueEntriesMaxPerDay}/day`);
  check(close(a.ys.revenue, a.ys.booked, 1e-9), `${tag}: WS3 revenue tally = booked revenue (no second revenue booking)`, `${f2(a.ys.revenue)} vs ${f2(a.ys.booked)}`);
  check(a.months >= 2 && a.securityExpected > 0 && close(-(a.flows.security ?? 0), a.securityExpected, 1e-6) && a.securityCharges <= a.months, `${tag}: security spend charged once a month at spendRate/12 (WS3 only)`, `${f2(-(a.flows.security ?? 0))} vs ${f2(a.securityExpected)}; ${a.securityCharges} charges / ${a.months} months`);
  check(a.fundExpected > 0 && close(-(a.flows.transitionFund ?? 0), a.fundExpected, 1e-6) && a.fundCharges <= a.months, `${tag}: transition fund charged once a month at fund/12 (WS3 only)`, `${f2(-(a.flows.transitionFund ?? 0))} vs ${f2(a.fundExpected)}; ${a.fundCharges} charges`);
}
finish('money');
