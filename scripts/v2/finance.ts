// WS3 acceptance tests F1–F11 (V2-SPEC §7.2; research/15 §1.9) plus finance-content checks. Owner: WS3.
// Real play (M2): bots are WS1's reference model play (refPlay) + this workstream's finance autopilot, revenue is WS5's
// real model (deployment.revenueRate, booked once through the finance ledger), endings skipped so finance can be
// measured through 2027. F11 checks WS3's consumption of WS5's revenue.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASELINES, globalCompute } from '../../src/data/world';
import { DEAL_TEMPLATES } from '../../src/data/v2/deals';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx, resolve, tick } from '../../src/engine/v2/core/loop';
import { deserialize } from '../../src/engine/v2/core/save';
import { cadencesDue, dayOfDate, decimalYear } from '../../src/engine/v2/core/time';
import { demandShock, impliedMargin, rentalBase, spotRental } from '../../src/engine/v2/compute/market';
import { newSite } from '../../src/engine/v2/compute/sites';
import { FINANCE_ACTIONS } from '../../src/engine/v2/finance/actions';
import { acceptRepriced, closePendingRound, dMax, raiseCeiling, REPRICED_DECIDE_DAYS, valuationMark } from '../../src/engine/v2/finance/equity';
import { FINANCE_EVENTS } from '../../src/engine/v2/finance/events';
import { applyShock } from '../../src/engine/v2/finance/investors';
import { CAPEX2X_AUTOPILOT, financeAutopilot, REF_AUTOPILOT, type AutopilotOpts } from '../../src/engine/v2/finance/plan';
import { refDecide, refPlay } from '../../src/engine/v2/bots/ref';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { engine } from '../../src/engine/v2/index';
import type { CostLine, EngineSystem, GameStateV2 } from '../../src/engine/v2/types';
import { FIXTURE_DIR, check, finish, validateJson } from './lib';

// M4: the M2 deferrals (F7 capex/valuation, F8 distress-free share) now pass on integrated play; see design/PROGRESS.md.

const START = '2025-07-01';
const END_2026 = dayOfDate(START, '2027-01-01');
const END_Q1_2027 = dayOfDate(START, '2027-04-01');
const END_2027 = dayOfDate(START, '2028-01-01');
const END_2028 = dayOfDate(START, '2029-01-01');
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);


const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const share = (xs: boolean[]) => xs.filter(Boolean).length / Math.max(1, xs.length);
const f1 = (x: number) => x.toFixed(1);

interface QRow { day: number; year: number; shipped: number; stock: number; margin: number; supply: number }
interface Run { s: GameStateV2; q: QRow[]; firstDistress: number; gw2026: number; v2026: number }

function runBot(seed: number, opts: AutopilotOpts | undefined, until: number): Run {
  const s = newGame(defaultSetupV2({ seed }));
  const q: QRow[] = [];
  let firstDistress = -1;
  let gw2026 = 0;
  let v2026 = 0;
  while (s.time.day < until) {
    for (const p of [...s.events.pending]) {
      const c = refDecide(s, p);
      if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    if (opts) {
      refPlay(s, engine);
      financeAutopilot(s, opts);
    }
    const quarter = cadencesDue(s.time.startDate, s.time.day + 1).includes('quarterly');
    tick(s, { skip: ['endings'] });
    if (quarter) q.push({ day: s.time.day, year: Math.floor(decimalYear(s) + 1e-9), shipped: s.market.ws3.shipped, stock: s.market.ws3.stock, margin: impliedMargin(s.market), supply: s.market.supplyQ });
    if (firstDistress < 0 && (s.player.finance.state === 'distress' || s.player.finance.state === 'insolvent')) firstDistress = s.time.day;
    if (s.time.day === END_2026 - 1) {
      const liveMW = s.player.sites.reduce((a, x) => a + (x.stage === 'live' ? x.mw : 0), 0);
      const cloud = s.player.cloud.reduce((a, c) => a + (c.startDay <= s.time.day && c.endDay > s.time.day ? c.h100e : 0), 0);
      gw2026 = liveMW / 1000 + (cloud * s.power.kWPerH100e) / 1e6;
      v2026 = s.player.finance.valuation;
    }
  }
  return { s, q, firstDistress, gw2026, v2026 };
}

// ───────────────────────────── F1–F3, F6: market under default demand (RefBot) ─────────────────────────────
const long = runBot(1, REF_AUTOPILOT, END_2028);
const prod = (y: number) => long.q.filter((r) => r.year === y).reduce((a, r) => a + r.shipped, 0);
check(prod(2026) >= 20e6 && prod(2026) <= 30e6, 'F1 global production 2026 ≈ 25M H100e (±20%)', `${f1(prod(2026) / 1e6)}M`);
check(prod(2027) >= 45e6 && prod(2027) <= 60e6, 'F2 global production 2027 in 45–60M H100e', `${f1(prod(2027) / 1e6)}M`);
const w = long.s.hidden.timeline;
const ratios = long.q.map((r) => r.stock / globalCompute(w as never, BASELINES[0].start.globalCompute, r.day / 365));
check(ratios.every((x) => x >= 0.8 && x <= 1.2), 'F3 installed stock within ±20% of globalCompute(w,t) through 2028', `ratio ${f1(Math.min(...ratios) * 100)}–${f1(Math.max(...ratios) * 100)}%`);
const m27 = long.q.filter((r) => r.year <= 2027).map((r) => r.margin);
const meanM = m27.reduce((a, b) => a + b, 0) / m27.length;
check(meanM >= 0.7 && meanM <= 0.77 && Math.min(...m27) >= 0.65, 'F6 implied supplier margin 70–75% (mean Q4 2025–Q4 2027)', `mean ${f1(meanM * 100)}%, min ${f1(Math.min(...m27) * 100)}%`);

// ───────────────────────────── F4, F5: demand shocks (passive player, same seed) ─────────────────────────────
function shockRun(baseMult: number, mult: number, atQ: number, nQ = 16) {
  const s = newGame(defaultSetupV2({ seed: 5 }));
  demandShock(s, baseMult);
  const S: number[] = [];
  const r: number[] = [];
  let q = 0;
  while (q < nQ) {
    const due = cadencesDue(s.time.startDate, s.time.day + 1).includes('quarterly');
    if (due && q === atQ && mult !== 1) demandShock(s, mult); // first seen by quarter atQ's clearing
    tick(s, { skip: ['endings'] }); // market experiment: an idle player may be ousted
    if (due) {
      S.push(s.market.supplyQ);
      r.push(s.market.rental);
      q++;
    }
  }
  return { S, r };
}
{
  // C3: from a soft market (demand 30% under reference), a +50% shock at t: supply growth rises from t+4 and peaks t+6..t+8.
  const t = 1;
  const b = shockRun(0.7, 1, t);
  const x = shockRun(0.7, 1.5, t);
  const diff = b.S.map((_, i) => (i === 0 ? 0 : x.S[i] / x.S[i - 1] - b.S[i] / b.S[i - 1]));
  const early = diff.slice(0, t + 4).every((d) => Math.abs(d) < 0.005);
  const first = diff.findIndex((d) => d > 0.01) - t;
  const win = diff.slice(0, t + 11); // main response window (later wiggles are wafer binding switches)
  const peak = win.indexOf(Math.max(...win)) - t;
  check(early && first >= 4 && first <= 6 && peak >= 6 && peak <= 9, 'F4 +50% demand shock: supply growth rises from t+4, peaks t+6..t+8', `first t+${first}, peak t+${peak} (+${f1(Math.max(...win) * 100)} pp/q)`);
}
{
  const rb = rentalBase(15, 0.7);
  const up = spotRental(rb, 1.5) / spotRental(rb, 1) - 1;
  check(up >= 0.35 && up <= 0.45, 'F5 spot rental under D/S = 1.5: +35–45% (C4)', `+${f1(up * 100)}%`);
  const t = 2;
  const b = shockRun(1, 0.5, t);
  const fall = [6, 7, 8].map((k) => b.r[t + k] / b.r[t - 1] - 1);
  check(fall.every((x) => x <= -0.6 && x >= -0.8), 'F5 spot rental in a glut: −60–80% over 6–8 quarters (C5)', fall.map((x) => `${f1(x * 100)}%`).join(', '));
}

// ───────────────────────────── F7, F8: RefBot, no-financing variant, capex2x ─────────────────────────────
const STRATEGIC = new Set(DEAL_TEMPLATES.filter((t) => t.strategic).map((t) => t.id));
const ref = SEEDS.map((seed) => runBot(seed, REF_AUTOPILOT, END_2027));
const y26 = ref.map((r) => r.s.player.finance.ws3.years['2026']);
const capex = y26.map((y) => y.capexChips + y.capexSites + y.capexSitesFinanced + y.supplierFunding);
const med = { rev: median(y26.map((y) => y.revenue)), capex: median(capex), compute: median(y26.map((y) => y.computeCosts)), gw: median(ref.map((r) => r.gw2026)), v: median(ref.map((r) => r.v2026)) };
check(med.rev >= 36 && med.rev <= 54, 'F7 RefBot 2026 revenue $45B (±20%)', `median $${f1(med.rev)}B`);
check(med.capex >= 150 && med.capex <= 250, 'F7 RefBot 2026 capex $200B (±25%)', `median $${f1(med.capex)}B (range ${f1(Math.min(...capex))}–${f1(Math.max(...capex))})`);
check(med.compute >= 25 && med.compute <= 60, 'F7 RefBot 2026 compute costs ~$40B/yr', `median $${f1(med.compute)}B`);
check(med.gw >= 4 && med.gw <= 9, 'F7 RefBot end-2026 power ~6 GW (live sites + cloud)', `median ${f1(med.gw)} GW`);
check(med.v >= 1000 && med.v <= 3000, 'F7 RefBot end-2026 valuation $1–3T', `median $${(med.v / 1000).toFixed(2)}T`);

const funded = ref.map((r) => {
  const y = r.s.player.finance.ws3.years['2026'];
  const deal = r.s.player.finance.deals.some((d) => STRATEGIC.has(d.template) && d.day >= 0 && d.day < END_2026);
  return { deal, fin: y.spvFinanced + y.leaseFinanced + y.cloudFinanced };
});
check(share(funded.map((x) => x.deal && x.fin >= 50)) >= 0.8, 'F8 RefBot takes ≥ 1 strategic deal and ≥ $50B SPV/lease/neocloud financing in 2026 (≥ 80% of seeds)', `${share(funded.map((x) => x.deal && x.fin >= 50)) * 100}% · median financing $${f1(median(funded.map((x) => x.fin)))}B`);
check(share(ref.map((r) => r.firstDistress < 0 || r.firstDistress >= END_2026)) >= 0.75, 'F8 RefBot stays out of distress through 2026 (≥ 75% of seeds)', `${f1(share(ref.map((r) => r.firstDistress < 0 || r.firstDistress >= END_2026)) * 100)}%`);
const bare: AutopilotOpts = { ...REF_AUTOPILOT, strategic: false, offBalance: false, guard: false, rescue: false };
const none = SEEDS.map((seed) => runBot(seed, bare, END_Q1_2027));
check(share(none.map((r) => r.firstDistress >= 0)) >= 0.8, 'F8 the C7 path without a strategic deal or off-balance-sheet financing hits distress by Q1 2027 (≥ 80%)', `${f1(share(none.map((r) => r.firstDistress >= 0)) * 100)}%`);
const x2 = SEEDS.map((seed) => runBot(seed, CAPEX2X_AUTOPILOT, END_2027));
const x2capex = median(x2.map((r) => { const y = r.s.player.finance.ws3.years['2026']; return y.capexChips + y.capexSites + y.capexSitesFinanced; }));
check(share(x2.map((r) => r.firstDistress >= 0 && r.firstDistress < END_2027)) >= 0.8, 'F8 capex2x bot (no rescue) reaches Distress by end-2027 (≥ 80%)', `${f1(share(x2.map((r) => r.firstDistress >= 0 && r.firstDistress < END_2027)) * 100)}% · 2026 capex attempted median $${f1(x2capex)}B`);

// ───────────────────────────── F9: valuation, rounds, shocks ─────────────────────────────
{
  const mult = (g: number, R: number) => valuationMark(g, R, 1, 1, 1) / R;
  const grid = [[5, 5], [5, 14], [8, 47], [10, 20], [10, 5]].map(([g, R]) => mult(g, R));
  check(grid.every((m) => m >= 20 && m <= 37), 'F9 valuation multiple 20–37× at g 5–10 (C11)', grid.map((m) => f1(m)).join(', '));
  const low = mult(2.5, 10);
  check(low >= 15 && low <= 20, 'F9 valuation multiple ~15–20× at g ≈ 2.5 (C11)', f1(low));
  const dil = ref.flatMap((r) => r.s.player.finance.rounds.filter((x) => !x.anchor && !x.down).map((x) => x.dilution));
  check(dil.length > 0 && Math.max(...dil) <= 0.08 + 1e-9, 'F9 unanchored round dilution ≤ 8% (C12)', `max ${f1(Math.max(...dil) * 100)}% over ${dil.length} rounds`);
  const s = newGame(defaultSetupV2({ seed: 3 }));
  const V = s.player.finance.valuation;
  const anch = raiseCeiling(s, Number.POSITIVE_INFINITY, { anchor: true }).parts.dilution;
  check(Math.abs(anch / (V + anch) - dMax(true, false)) < 1e-9 && dMax(false, true) === 0.05, 'F9 dilution cap 14% with a strategic anchor, 5% at IPO (C12)', `${f1((anch / (V + anch)) * 100)}%`);
  const ctx = makeCtx(s);
  const before = s.capital.ws3.playerPoolQ;
  applyShock(s, ctx, 'financingDoubt');
  const cut = 1 - s.capital.ws3.playerPoolQ / before;
  check(cut >= 0.2 && cut <= 0.3, 'F9 financing-doubt shock cuts the pool ~25% (C13)', `−${f1(cut * 100)}%`);
}

// ───────────────────────────── F10: sites ─────────────────────────────
{
  const s = newGame(defaultSetupV2({ seed: 11 }));
  s.power.ws3.transformersGW = 1e4;
  const ctx = makeCtx(s);
  const N = 400;
  const ids = new Set<string>();
  for (let i = 0; i < N; i++) ids.add(newSite(s, ctx, { path: 'brownfield', mw: 500 }).id);
  s.player.finance.cash = 1e6; // isolate the stage machine from money
  // Neutral sentiment: hold WS4's data-centre opposition (pub.dcNimby) at its start value for the site rolls.
  const nimby0 = s.pub.dcNimby;
  const neutral: EngineSystem = { id: 'testNeutralNimby', owner: 'WS3', cadence: 'daily', order: 405, run: (x) => void (x.pub.dcNimby = nimby0) };
  // C15 is the permitting roll: WS4's director is off too, else E27 "Site blocked" (default: community deal) re-permits
  // every blocked site over the 5 years.
  while (s.time.day < 365 * 5) tick(s, { skip: ['marketQ', 'endings', 'director'], extraSystems: [neutral] });
  const sites = s.player.sites.filter((x) => ids.has(x.id));
  const blocked = share(sites.map((x) => x.stage === 'blocked'));
  const delayed = share(sites.map((x) => x.ws3.delayedQ > 0));
  const builds = sites.filter((x) => x.ws3.liveDay !== undefined && x.ws3.buildStartDay !== undefined).map((x) => Math.round(((x.ws3.liveDay as number) - (x.ws3.buildStartDay as number)) / 91.25));
  check(blocked >= 0.05 && blocked <= 0.1 && delayed >= 0.2 && delayed <= 0.4, 'F10 sites at neutral sentiment: 5–10% blocked, 20–40% delayed (C15)', `blocked ${f1(blocked * 100)}%, delayed ${f1(delayed * 100)}%`);
  check(median(builds) === 8, 'F10 median construction-to-live 8 quarters (C14)', `median ${median(builds)} q`);
}

// ───────────────────────────── F11: revenue path consumption ─────────────────────────────
{
  const s0 = newGame(defaultSetupV2({ seed: 1 }));
  const r27 = median(ref.map((r) => r.s.player.finance.ws3.years['2027'].revenue));
  check(s0.player.finance.revenueRun === 12 && r27 >= 98 && r27 <= 182, 'F11 revenue path (classic): $12B run-rate Jul 2025; ~$140B in 2027 (±30%)', `start ${s0.player.finance.revenueRun}, 2027 $${f1(r27)}B (WS5 owns the demand model; WS3 books it)`);
  // WS5's revenue system off: deployments hold a fixed revenueRate, WS3 smooths the run-rate from it.
  for (const d of s0.player.deployments) d.revenueRate = 30 / s0.player.deployments.length;
  for (let i = 0; i < 120; i++) tick(s0, { skip: ['revenue', 'endings'] });
  check(Math.abs(s0.player.finance.revenueRun - 30) < 1.5, 'F11 revenue run-rate follows WS5 deployment revenue (30-day smoothing)', f1(s0.player.finance.revenueRun));
}

// ───────────────────────────── Content: actions apply, events lint ─────────────────────────────
const fixtures: GameStateV2[] = [0, 400, 900].map((d) => deserialize(readFileSync(join(FIXTURE_DIR, `day${d}.json`), 'utf8')));
const okPreview = (p: { costs: CostLine[]; gains: CostLine[] }) => {
  const gains = new Set(p.gains.map((g) => g.currency));
  return p.costs.some((c) => !gains.has(c.currency));
};
for (const e of FINANCE_EVENTS) {
  check(e.choices.length >= 2 && e.title.split(' ').length <= 3 && e.choices.every((c) => c.label.split(' ').length <= 3), `event ${e.id} shape (≥ 2 choices, terse labels)`);
  for (const s of fixtures) e.choices.forEach((c, i) => check(okPreview(c.preview(s)), `event ${e.id} choice ${i} preview trade-off @day ${s.time.day}`));
}
let applied = 0;
for (const a of FINANCE_ACTIONS) {
  const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  s.player.finance.state = a.id === 'fin.rescue' || a.id === 'fin.downRound' || a.id === 'fin.renegotiate' ? 'distress' : s.player.finance.state;
  if (a.id === 'fin.acceptDeal' || a.id === 'fin.declineDeal') FINANCE_ACTIONS.find((x) => x.id === 'fin.seekPartner')?.apply(s, makeCtx(s), {});
  let err = '';
  try {
    if (a.available(s) === true) {
      a.apply(s, makeCtx(s), {});
      applied++;
    }
    for (let i = 0; i < 100; i++) tick(s, { skip: ['endings'] });
  } catch (e) {
    err = String(e);
  }
  const errs = validateJson(s);
  check(!err && errs.length === 0, `action ${a.id} applies and the game runs on (plain JSON)`, err || errs.slice(0, 2).join('; '));
}
// ───────── R1: a round repriced into a down round is the player's decision (no silent pull) ─────────
{
  const setup = (s: GameStateV2) => {
    const f = s.player.finance;
    const V = Math.max(10, f.valuation);
    f.rounds.push({ day: s.time.day - 200, amount: 10, postMoney: V * 3, dilution: 0.03, down: false });
    f.ws3.pendingRound = { day: s.time.day - 90, ask: 5, max: 100, preMoney: V * 2, ipo: false };
    return f.rounds.length;
  };
  const a = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const n0 = setup(a);
  const cash0 = a.player.finance.cash;
  closePendingRound(a, makeCtx(a));
  check(!!a.player.finance.ws3.repricedRound && a.player.finance.rounds.length === n0 && a.player.finance.cash === cash0, 'R1 repriced down round waits for the player (no round booked, no cash)');
  check(FINANCE_ACTIONS.find((x) => x.id === 'fin.raise')?.available(a) !== true, 'R1 no new raise while the repriced round is undecided');
  acceptRepriced(a, makeCtx(a));
  const last = a.player.finance.rounds[a.player.finance.rounds.length - 1];
  check(!a.player.finance.ws3.repricedRound && a.player.finance.rounds.length === n0 + 1 && last.down && a.player.finance.cash > cash0, 'R1 accept books the down round', `down ${last.down}, cash ${cash0.toFixed(1)} → ${a.player.finance.cash.toFixed(1)}`);
  const b = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const m0 = setup(b);
  closePendingRound(b, makeCtx(b));
  for (let i = 0; i <= REPRICED_DECIDE_DAYS; i++) tick(b, { skip: ['endings'] });
  check(!b.player.finance.ws3.repricedRound && b.player.finance.rounds.length === m0, `R1 an undecided repriced round is pulled after ${REPRICED_DECIDE_DAYS} days`);
}

console.log(`finance: ${FINANCE_ACTIONS.length} actions (${applied} applied on day400), ${FINANCE_EVENTS.length} events`);
finish('finance');
