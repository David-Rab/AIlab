// WS3 acceptance tests F1–F11 (V2-SPEC §7.2; research/15 §1.9) plus finance-content checks. Owner: WS3.
// Real play (M2): bots are WS1's reference model play (refPlay) + this workstream's finance autopilot, revenue is WS5's
// real model (deployment.revenueRate, booked once through the finance ledger), endings skipped so finance can be
// measured through 2027. F11 checks WS3's consumption of WS5's revenue.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASELINES, globalCompute } from '../../src/data/world';
import { CAPEX_LEASE, DEAL_TEMPLATES } from '../../src/data/v2/deals';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { act, makeCtx, resolve, tick } from '../../src/engine/v2/core/loop';
import { deserialize, serialize } from '../../src/engine/v2/core/save';
import { cadencesDue, dayOfDate, decimalYear, quarterIndex } from '../../src/engine/v2/core/time';
import { cloudPricePerYear, demandShock, impliedMargin, orderWeight, rentalBase, repriceCancellableCloud, spotRental } from '../../src/engine/v2/compute/market';
import { chipQuote, rentQuote } from '../../src/engine/v2/compute/orders';
import { newSite, oppositionOdds, reactiveUnblockOdds } from '../../src/engine/v2/compute/sites';
import { contingentLiabilities, crf, siteLeaseId, siteRVG } from '../../src/engine/v2/finance/capex';
import { creditLineCapacity, debtHeadroom, drawDebt, ratingOf, ratingTerms } from '../../src/engine/v2/finance/debt';
import { FINANCE_ACTIONS, raiseQuote } from '../../src/engine/v2/finance/actions';
import { founderControl } from '../../src/engine/v2/finance/board';
import { acceptRepriced, bookRound, closePendingRound, dMax, raiseCeiling, REPRICED_DECIDE_DAYS, valuationMark, valuationNow } from '../../src/engine/v2/finance/equity';
import { whatWeOwe } from '../../src/engine/v2/finance/owe';
import { credRung, judgePromises, livePromises, makeThesis, promiseDeadline, promiseWeight, trendOf } from '../../src/engine/v2/finance/promises';
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
const F1pct = (x: number) => `${Math.round(x * 100)}%`;

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
// FIN1: chips a lessor paid at delivery count as capex too (supplier funding is gone, its tally stays 0).
const capex = y26.map((y) => y.capexChips + (y.capexChipsFinanced ?? 0) + y.capexSites + y.capexSitesFinanced + y.supplierFunding);
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
check(share(funded.map((x) => x.deal && x.fin >= 50)) >= 0.8, 'F8 RefBot takes ≥ 1 strategic deal and ≥ $50B lease/colocation/cloud financing in 2026 (≥ 80% of seeds)', `${share(funded.map((x) => x.deal && x.fin >= 50)) * 100}% · median financing $${f1(median(funded.map((x) => x.fin)))}B`);
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
  const neutral: EngineSystem = { id: 'testNeutralNimby', owner: 'WS3', cadence: 'daily', order: 405, system: 'core', run: (x) => void (x.pub.dcNimby = nimby0) };
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

// ───────────────────────────── FIN1: debt, rating, capex payment, contracts, community (FINANCE-V3 §3–§5) ─────────────────────────────
{
  const fx = () => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  // Leases recover full cost plus a return priced by the rating (the old SPV repaid 48% of what it funded).
  const recovered = (['BBB', 'BB', 'B'] as const).map((r) => crf(CAPEX_LEASE.rate[r] as number, CAPEX_LEASE.years.site) * CAPEX_LEASE.years.site);
  check(recovered.every((x) => x > 1) && recovered[0] < recovered[1] && recovered[1] < recovered[2], 'FIN1 a site lease repays funded × CRF(r, 15 y): more than it funded, more at a worse rating', recovered.map((x) => `${f1(x * 100)}%`).join(' / '));
  {
    const s = fx();
    s.player.finance.rating = 'closed';
    check(typeof act(s, 'cmp.newSite', { path: 'gas', mw: 500, pay: 'lease' }) === 'string' && typeof act(s, 'cmp.buyChips', { term: 1, qty: 1e5, pay: 'lease' }) === 'string', 'FIN1 no lessor funds a site or chips below B');
    s.player.finance.rating = 'BB';
    const n = s.player.sites.length;
    act(s, 'cmp.newSite', { path: 'gas', mw: 500, pay: 'lease' });
    const x = s.player.sites[n];
    check(!!x && x.spvFunded === CAPEX_LEASE.siteShare && x.ws3.lease?.rate === CAPEX_LEASE.rate.BB, 'FIN1 a leased site: 80% funded by the lessor at the rating\'s rate (BB 9%)', x ? `share ${x.spvFunded}, rate ${x.ws3.lease?.rate}` : 'no site');
    if (x) {
      x.stage = 'building';
      x.stageEndDay = s.time.day + 1;
      const funded0 = x.ws3.lease?.funded ?? 0;
      while ((x.stage as string) !== 'live' && s.time.day < 400 + 200) tick(s, { skip: ['endings'] });
      const l = s.player.finance.ledger.find((c) => c.id === siteLeaseId(x.id));
      const funded = x.ws3.lease?.funded ?? 0;
      check(!!l && l.kind === 'finLease' && Math.abs(l.perQuarter * 4 - funded * crf(0.09, 15)) < 1e-6 && funded >= x.capex * 0.8 - 1e-6 && funded > funded0, 'FIN1 at go-live the lease is funded (capex share + construction interest) × CRF a year for 15 years', l ? `funded $${f1(funded)}B of $${f1(x.capex)}B capex · $${(l.perQuarter * 4).toFixed(2)}B/yr · RVG $${f1(siteRVG(s, x.id))}B` : 'no lease entry');
    }
  }
  {
    // Credit line: 3% of valuation, cap $15B, sized only when you borrow.
    const s = newGame(defaultSetupV2({ seed: 4 }));
    const rv0 = s.player.finance.debts.find((d) => d.kind === 'revolver')!.principal;
    while (s.time.day < 200) tick(s, { skip: ['endings'] });
    const rv = s.player.finance.debts.find((d) => d.kind === 'revolver')!;
    check(rv.drawn > 0 || rv.principal === rv0, 'FIN1 the credit line does not grow by itself (no borrowing, no round)', `$${f1(rv0)}B → $${f1(rv.principal)}B`);
    const cap = creditLineCapacity(s);
    s.player.finance.state = 'healthy';
    s.player.finance.rating = 'BB';
    drawDebt(s, makeCtx(s), 'revolver', 1);
    check(Math.abs(cap - Math.min(15, 0.03 * s.player.finance.valuation)) < 1e-9 && Math.abs(rv.principal - Math.max(rv.drawn, cap)) < 1e-9, 'FIN1 borrowing re-sizes the line to 3% of valuation, cap $15B', `V $${f1(s.player.finance.valuation)}B → line $${f1(rv.principal)}B`);
  }
  {
    // A cash-burning lab: no bonds, chip loans open, not investment grade while it carries debt or commitments (FC5).
    const s = fx();
    s.player.finance.ws3.opCash4q = [-5, -6, -7, -8];
    s.player.finance.state = 'healthy';
    const r = ratingTerms(s);
    const bond = debtHeadroom(s, 'bond');
    const chips = debtHeadroom(s, 'gpuTerm');
    check(bond.closed === true && !chips.closed && r.cashFlow === 0 && (r.leverage <= 0 || ratingOf(r.z) !== 'BBB'), 'FIN1 a cash-burning lab: no bonds, chip loans open, rated below BBB (FC5)', `z ${r.z.toFixed(2)} (${ratingOf(r.z)}) · chip loan room $${f1(chips.max)}B · bond: ${bond.why}`);
    s.player.finance.ws3.opCash4q = [5, 6, 7, 8];
    const b2 = debtHeadroom(s, 'bond');
    check(Math.abs(b2.limit - 3 * 26) < 1e-9, 'FIN1 bonds ≤ 3× trailing operating cash flow', `limit $${f1(b2.limit)}B on $26B`);
  }
  {
    // Firm contracts follow the expected path; cancellable is spot-indexed and re-priced; firm gets priority.
    const s = fx();
    const q = rentQuote(s, 1e6, 16, true);
    const flat = (1e6 * cloudPricePerYear(s)) / 1e6 / 4;
    const falling = q.perQ.every((x, i) => i === 0 || x <= q.perQ[i - 1] + 1e-9);
    check(falling && q.discount === 0.1 && q.total < 16 * flat, 'FIN1 a 4-year firm cloud contract pays the expected path −10%: falling payments, below today\'s price × 16', `first $${q.perQ[0].toFixed(2)}B → last $${q.perQ[15].toFixed(2)}B a quarter; total $${f1(q.total)}B vs flat $${f1(16 * flat)}B`);
    act(s, 'cmp.rentCompute', { h100e: 2e5, term: 4, firm: false });
    const c = s.player.cloud[s.player.cloud.length - 1];
    s.market.rental *= 1.5;
    repriceCancellableCloud(s);
    const l = s.player.finance.ledger.find((x) => x.id === `L-${c.id}`)!;
    check(c.cancellableNoticeQ === 1 && Math.abs(l.perQuarter - (2e5 * s.market.rental * 8760 * 1.15) / 1e9 / 4) < 1e-9, 'FIN1 cancellable cloud is spot-indexed × 1.15, re-priced each quarter');
    const tr = chipQuote(s, 8, 1e5);
    check(tr.prices!.every((x, i) => i === 0 || x <= tr.prices![i - 1] + 1e-9) && tr.discount === 0.05 && orderWeight(s, true, 0) > orderWeight(s, false, 0), 'FIN1 two-year chip supply: expected-path prices −5%, firm orders get rationing priority', `$${tr.prices![0].toFixed(1)}K → $${tr.prices![7].toFixed(1)}K`);
  }
  {
    // Community: the company default packages every new site; E27's reactive package is 15% of capex with odds.
    const s = fx();
    s.player.policies.communityBenefits = false;
    act(s, 'cmp.community', {});
    const n = s.player.sites.length;
    act(s, 'cmp.newSite', { path: 'gas', mw: 500 });
    check(s.player.policies.communityBenefits && !!s.player.sites[n]?.communityPackage, 'FIN1 community package as the company default: new sites carry it');
    const p = reactiveUnblockOdds(s);
    check(p >= 0.3 && p <= 0.85 && oppositionOdds(s, { path: 'gas', crash: false, communityPackage: true, ws3: { reactive: true } }).block === 1 - p, 'FIN1 E27 reactive package: re-permit with unblock odds 0.85 − 0.5 × opposition', `odds ${F1pct(p)} at dcNimby ${f1(s.pub.dcNimby)}`);
  }
}

// ───────────────────────────── FIN2: raises with a thesis, stacking promises, credibility, IPO, What we owe (FINANCE-V3 §2, §11) ─────────────────────────────
{
  const fx = () => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  {
    // No revenue-based annual cap: the pool and the dilution cap bound a round.
    const s = fx();
    const c = raiseCeiling(s);
    check(Object.keys(c.parts).sort().join(',') === 'ask,dilution,pool' && (c.bound === 'pool' || c.bound === 'dilution'), 'FIN2 the raise ceiling is the pool and the dilution cap only (no annual cap)', `bound ${c.bound} · $${f1(c.max)}B`);
    // Pitches: price × 0.85 / 1 / 1.2 on the mark; targets × 0.8 / 1 / 1.3 of the trend's gain; aggressive needs Credible+.
    const V = s.player.finance.valuation;
    const pre = (['conservative', 'base', 'aggressive'] as const).map((p) => raiseQuote(s, 1, { pitch: p }).pre / V);
    const tr = trendOf(s, 'scale');
    const tg = (['conservative', 'base', 'aggressive'] as const).map((p) => { const t = makeThesis(s, 'scale', p); return typeof t === 'string' ? NaN : (t.target - t.start) / tr.gain; });
    check(pre.every((x, i) => Math.abs(x - [0.85, 1, 1.2][i]) < 0.01) && tg.every((x, i) => Math.abs(x - [0.8, 1, 1.3][i]) < 1e-9), 'FIN2 pitches: price ×0.85 / ×1 / ×1.2 and target ×0.8 / ×1 / ×1.3 of the trend gain', `pre ${pre.map((x) => x.toFixed(2)).join('/')} · gain ${tg.map((x) => x.toFixed(2)).join('/')} (${tr.basis})`);
    s.player.finance.credibility = 40;
    check(typeof makeThesis(s, 'scale', 'aggressive') === 'string' && act(s, 'fin.raise', { type: 'scale', pitch: 'aggressive' }) !== undefined, 'FIN2 aggressive pitches need Credible or Proven credibility');
  }
  {
    // A raise carries its thesis; the round's close makes it a promise due four quarter starts later; promises stack.
    const s = fx();
    s.player.finance.state = 'healthy';
    const n0 = s.player.finance.promises.length;
    const err = act(s, 'fin.raise', { ask: 1, type: 'scale', pitch: 'base' });
    const th = s.player.finance.ws3.pendingRound?.thesis;
    while (s.player.finance.ws3.pendingRound) tick(s, { skip: ['endings'] });
    const p1 = s.player.finance.promises[s.player.finance.promises.length - 1];
    s.player.finance.state = 'healthy';
    act(s, 'fin.raise', { ask: 50, type: 'adoption', pitch: 'conservative' });
    s.player.finance.ws3.pendingRound!.max = 1e6; // isolate the stacking from the closing odds
    while (s.player.finance.ws3.pendingRound) tick(s, { skip: ['endings'] });
    const live = livePromises(s);
    const p2 = live[live.length - 1];
    check(!err && !!th && th.type === 'scale' && live.length === n0 + 2 && p1.deadline === promiseDeadline(s, p1.closeDay) && quarterIndex(s.time.startDate, p1.deadline) - quarterIndex(s.time.startDate, p1.closeDay) === 4, 'FIN2 each round leaves a promise due four quarter starts after its close; promises stack', `${live.length - n0} live: ${live.slice(-2).map((p) => `${p.type}/${p.pitch} due day ${p.deadline}`).join(', ')}`);
    // Weight = amount ÷ raised in the year to its deadline: the $1B promise barely counts next to the $50B one.
    const w1 = promiseWeight(s, p1);
    const w2 = promiseWeight(s, p2);
    check(Math.abs(w1 - 1 / 51) < 1e-6 && w2 === 1, 'FIN2 weight = the round ÷ everything raised in the year to its deadline ($1B then $50B: 2% and 100%)', `${F1pct(w1)} / ${F1pct(w2)}`);
    // Judged at the deadline: met +30 / +10 × weight, missed −30 / −15 × weight, within 20% nothing; never cash.
    const judge = (progress: number) => {
      const x = fx();
      const c2 = makeCtx(x);
      const f = x.player.finance;
      f.rounds.push({ day: x.time.day - 400, amount: 10, postMoney: 100, dilution: 0.1, down: false });
      const start = x.player.finance.revenueRun / (1 + progress);
      f.promises.push({ id: 'PRt', type: 'adoption', pitch: 'base', start, target: start * 2, amount: 10, closeDay: x.time.day - 400, deadline: x.time.day });
      const cred0 = f.credibility;
      const bc0 = x.player.board.confidence;
      const cash0 = f.cash;
      judgePromises(x, c2);
      const r = f.promises.find((p) => p.id === 'PRt')!.result!;
      return { o: r.outcome, dc: f.credibility - cred0, db: x.player.board.confidence - bc0, cash: f.cash - cash0 };
    };
    const met = judge(1.05);
    const near = judge(0.9);
    const miss = judge(0.5);
    check(met.o === 'met' && Math.abs(met.dc - 30) < 1e-9 && Math.abs(met.db - 10) < 1e-9 && near.o === 'near' && near.dc === 0 && near.db === 0 && miss.o === 'missed' && Math.abs(miss.dc + 30) < 1e-9 && Math.abs(miss.db + 15) < 1e-9 && met.cash === 0 && miss.cash === 0, 'FIN2 at its deadline a promise met moves credibility +30 / board +10, missed by > 20% −30 / −15, within 20% nothing (× weight); never cash', `met ${met.dc}/${met.db} · near ${near.dc}/${near.db} · missed ${miss.dc}/${miss.db}`);
  }
  {
    // Credibility multiplies the valuation mark (interim): Doubted ×0.7 … Proven ×1.15; start values by start type.
    const s = fx();
    s.player.finance.credibility = 60;
    const v1 = valuationNow(s).V;
    s.player.finance.credibility = 10;
    const v0 = valuationNow(s).V;
    s.player.finance.credibility = 90;
    const v2 = valuationNow(s).V;
    const starts = (['leader', 'challenger', 'spinout'] as const).map((st) => newGame(defaultSetupV2({ seed: 1, start: st })).player.finance.credibility);
    check(Math.abs(v0 / v1 - 0.7) < 1e-9 && Math.abs(v2 / v1 - 1.15) < 1e-9 && starts.join(',') === '60,50,40' && credRung(60).id === 'Credible' && credRung(40).id === 'Unproven', 'FIN2 credibility multiplies the mark (Doubted ×0.7, Proven ×1.15); start: leader 60, challenger 50, spinout 40', `starts ${starts.join('/')}`);
  }
  {
    // Down rounds cost the board and prior holders, never staff (spec §0.3).
    const s = fx();
    const ctx = makeCtx(s);
    const f = s.player.finance;
    f.rounds.push({ day: s.time.day - 100, amount: 10, postMoney: f.valuation * 2, dilution: 0.05, down: false });
    const heads = JSON.stringify(s.player.teams.map((t) => t.heads));
    const staff = JSON.stringify(s.player.staff);
    const bc0 = s.player.board.confidence;
    bookRound(s, ctx, 5, f.valuation);
    check(f.rounds[f.rounds.length - 1].down && s.player.board.confidence < bc0 && JSON.stringify(s.player.teams.map((t) => t.heads)) === heads && JSON.stringify(s.player.staff) === staff, 'FIN2 a down round costs board confidence, never staff', `board ${bc0.toFixed(0)} → ${s.player.board.confidence.toFixed(0)}`);
  }
  {
    // The IPO: its own one-time action; dual-class keeps founder control at valuation ×0.95; a listing independent.
    const s = fx();
    s.capital.ipoWindow = true;
    s.player.finance.state = 'healthy';
    s.player.board.preset = 'founder';
    const avail = FINANCE_ACTIONS.find((a) => a.id === 'fin.ipo')!.available(s);
    const V0 = s.player.finance.valuation;
    const err = act(s, 'fin.ipo', { dualClass: true });
    const ask = s.player.finance.ws3.pendingRound!.ask;
    s.player.finance.ws3.pendingRound!.max = 1e6;
    while (s.player.finance.ws3.pendingRound) tick(s, { skip: ['endings'] });
    s.player.finance.state = 'healthy';
    const again = FINANCE_ACTIONS.find((a) => a.id === 'fin.ipo')!.available(s);
    const v = valuationNow(s);
    const r = s.player.finance.rounds[s.player.finance.rounds.length - 1];
    check(avail === true && !err && r.ipo === true && ask / (V0 + ask) <= 0.05 + 1e-9 && s.player.finance.ownership.public > 0 && s.player.finance.dualClass === true && v.gov === 0.95 && founderControl(s) && typeof again === 'string' && s.player.board.seats.some((x) => x.holder === 'Listing independent') && livePromises(s).every((p) => p.closeDay !== r.day), 'FIN2 the IPO is a one-time action (≤ 5%, no promise); dual-class keeps founder control at valuation ×0.95', `ask $${f1(ask)}B = ${F1pct(ask / (V0 + ask))} at signing · public ${F1pct(s.player.finance.ownership.public)} at close · again: ${again}`);
    const t = fx();
    t.player.board.preset = 'founder';
    t.player.finance.ownership.public = 0.05;
    check(!founderControl(t), 'FIN2 a founder listing without dual-class shares loses founder control');
  }
  {
    // No revenue plan: the board's quarterly review posts no plan causes.
    const s = newGame(defaultSetupV2({ seed: 6 }));
    while (s.time.day < 300) tick(s, { skip: ['endings'] });
    const srcs = new Set((s.causes.byKey['board.confidence'] ?? []).map((e) => e.source));
    check(![...srcs].some((x) => /plan/.test(x)), 'FIN2 the board has no revenue plan', [...srcs].join(', '));
  }
  {
    // What we owe: promises with progress, tranche conditions, covenants with headroom, contingent liabilities
    // (residual-value guarantees from leases, copyright litigation from unlicensed data).
    const s = newGame(defaultSetupV2({ seed: 2 }));
    const o = whatWeOwe(s);
    const lit = o.contingent.find((c) => c.kind === 'litigation');
    check(o.tranches.some((t) => t.condition === 'recapitalisation') && o.covenants.some((c) => c.id === 'creditLine' && c.state === 'idle') && !!lit && lit.amount > 0 && (lit.pQ ?? 0) > 0 && o.promises.length === 0, 'FIN2 What we owe at the leader start: the recap tranche, the idle credit-line covenant, copyright litigation exposure, no promises', `litigation $${f1(lit?.amount ?? 0)}B at ${F1pct(lit?.pQ ?? 0)}/q`);
    const x = fx();
    x.player.finance.ledger.push({ id: 'L-fin-test', payee: 'Keystone Capital', kind: 'finLease', perQuarter: 1, startDay: x.time.day, endDay: x.time.day + 15 * 365, cancellableNoticeQ: null, penalty: 0, rate: 0.09 });
    const rvg = whatWeOwe(x).contingent.filter((c) => c.kind === 'rvg').reduce((a, c) => a + c.amount, 0);
    check(rvg > 0 && Math.abs(rvg - contingentLiabilities(x).total) < 1e-9, 'FIN2 residual-value guarantees are listed in What we owe', `$${f1(rvg)}B on a $4B/yr 15-year lease`);
    // A promise behind its needed-by-now path, and a drawn credit line near its covenant, feed the one Watch alert.
    const f = x.player.finance;
    f.promises.push({ id: 'PRb', type: 'adoption', pitch: 'base', start: f.revenueRun, target: f.revenueRun * 3, amount: 5, closeDay: x.time.day - 200, deadline: x.time.day + 165 });
    const rv = f.debts.find((d) => d.kind === 'revolver')!;
    rv.drawn = rv.principal;
    f.cash = rv.principal * 0.4;
    const o2 = whatWeOwe(x);
    check(o2.behind.some((p) => p.p.id === 'PRb') && o2.near.some((c) => c.id === 'creditLine'), 'FIN2 a promise behind its needed-by-now path and a covenant near its limit are flagged', `behind ${o2.behind.length}, near ${o2.near.map((c) => `${c.id} ${c.state}`).join(', ')}`);
  }
  {
    // Save migration 12 → 13: credibility by start type, an empty promise list, the revenue plan gone.
    const s = fx();
    const raw = JSON.parse(serialize(s));
    raw.schemaRev = 12;
    delete raw.player.finance.credibility;
    delete raw.player.finance.promises;
    raw.player.finance.raisedLast4q = 12;
    raw.player.finance.ws3.revenuePlan = 40;
    const m = deserialize(JSON.stringify(raw));
    check(m.player.finance.credibility === 60 && Array.isArray(m.player.finance.promises) && !('revenuePlan' in m.player.finance.ws3) && !('raisedLast4q' in m.player.finance), 'FIN2 save migration 12 → 13');
  }
  {
    // The reference bot (FIN2 autopilot): raises when its cash projection runs short, at the ceiling, on the milestone it
    // is surest of. Rounds per year and promise results across the 12 RefBot seeds.
    const per = (y: number) => median(ref.map((r) => r.s.player.finance.rounds.filter((x) => Math.floor(decimalYear(r.s, x.day) + 1e-9) === y).length));
    const judged = ref.flatMap((r) => r.s.player.finance.promises.filter((p) => p.result));
    const byType = (t: string) => judged.filter((p) => p.type === t).length;
    const met = judged.filter((p) => p.result!.outcome === 'met').length;
    const cred = median(ref.map((r) => r.s.player.finance.credibility));
    check(per(2026) >= 1 && per(2026) <= 4 && per(2027) >= 1 && per(2027) <= 4, 'FIN2 RefBot raises 1–4 rounds a year (median; it raised at the ceiling every quarter before FIN2)', `2026 ${per(2026)} · 2027 ${per(2027)} · promises judged ${judged.length} (met ${F1pct(met / Math.max(1, judged.length))}; scale ${byType('scale')}, adoption ${byType('adoption')}, capability ${byType('capability')}) · end-2027 credibility median ${f1(cred)}`);
  }
}

console.log(`finance: ${FINANCE_ACTIONS.length} actions (${applied} applied on day400), ${FINANCE_EVENTS.length} events`);
finish('finance');
