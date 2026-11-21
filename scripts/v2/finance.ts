// WS3 acceptance tests F1–F11 (V2-SPEC §7.2; research/15 §1.9) plus finance-content checks. Owner: WS3.
// Real play (M2): bots are WS1's reference model play (refPlay) + this workstream's finance autopilot, revenue is WS5's
// real model (deployment.revenueRate, booked once through the finance ledger), endings skipped so finance can be
// measured through 2027. F11 checks WS3's consumption of WS5's revenue.
// The bot games go through the simulation cache (simcache.ts); a cached run keeps the parts of the final state the checks
// read (finance years, deals, rounds, the hidden timeline). `--smoke` (test:quick): one seed per bot and the long run to
// end-2027; the multi-seed and horizon-cut targets print SMOKE.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASELINES, globalCompute } from '../../src/data/world';
import { CAPEX_LEASE, DEBT_TERMS, GOV_FACTOR, MARKET, PARTNER_TERMS } from '../../src/data/v2/deals';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { act, makeCtx, resolve, tick } from '../../src/engine/v2/core/loop';
import { deserialize, serialize } from '../../src/engine/v2/core/save';
import { cadencesDue, dayOfDate, dayOfQuarter, decimalYear, quarterIndex } from '../../src/engine/v2/core/time';
import { clearMarket, cloudPricePerYear, demandShock, expectedCloudPrice, expectedListPrice, impliedMargin, orderWeight, rentalBase, repriceCancellableCloud, spotRental } from '../../src/engine/v2/compute/market';
import { addCloud, addSpotRental, chipQuote, rentQuote } from '../../src/engine/v2/compute/orders';
import { newSite, oppositionOdds, reactiveUnblockOdds, siteSchedule } from '../../src/engine/v2/compute/sites';
import { constructionGrowth, contingentLiabilities, crf, leaseAvailable, leaseGuarantor, leaseRate, payOptions, siteLeaseId, siteRVG } from '../../src/engine/v2/finance/capex';
import { chipCollateral, creditLineCapacity, debtHeadroom, debtRatePct, drawDebt, ratingOf, ratingTerms } from '../../src/engine/v2/finance/debt';
import { ACQUIRE, acquireTerms, acquireVotes, rivalObligations, shownVote } from '../../src/engine/v2/finance/acquire';
import { FINANCE_ACTIONS, raiseQuote } from '../../src/engine/v2/finance/actions';
import { boardVote, CRITICS, CRITICS_INVESTOR, criticsAvailable, debtVote, syncFinancialSeats, founderControl, initialBoard, OUSTER, ousterVote, updateRunwayState, VOTE } from '../../src/engine/v2/finance/board';
import { MOOD_SOURCE_OF, MOOD_WEIGHTS, moodWeight } from '../../src/engine/v2/finance/mood';
import { acceptRepriced, bookRound, closePendingRound, dMax, LARGE_ROUND, lastPostMoney, roundSplit, partnerEquityIn, raiseCeiling, REPRICED_DECIDE_DAYS } from '../../src/engine/v2/finance/equity';
import { bustTarget, exitBuyer, markRivals, parentFunded, capMultiple, RIVAL, RIVAL_GOV, rivalCred, rivalGov, rivalMoneyQ, rivalSpend, valueCap } from '../../src/engine/v2/finance/rivalFinance';
import { FIN as RIVAL_START_FIN } from '../../src/engine/v2/actors/rivals';
import { addRivalKnowledge, recipeOf } from '../../src/engine/v2/actors/rivalModel';
import { ws4 as ws4Of } from '../../src/engine/v2/actors/state';
import { DUAL_CLASS_GOV, growthOf, openWeightFloor, playerGov, poolAnnualOf, sectorValue, STORY, storyNow, storyShares, SUPPLIER, supplierTerms } from '../../src/engine/v2/finance/story';
import { whatWeOwe } from '../../src/engine/v2/finance/owe';
import * as EQ from '../../src/engine/v2/finance/equity';
import { credRung, judgePromises, livePromises, makeThesis, metricNow, PITCH, PROMISE_RESULT, promiseDeadline, promiseWeight, trendOf, typicalRound } from '../../src/engine/v2/finance/promises';
import { charterReleaseBlock, charterRights, controlVote, transferVote } from '../../src/engine/v2/finance/charter';
import { affiliatedLab, anchorPartners, dealVotes, dealWith, firstYearCommit, ipAccessDaily, partnerBlocker, partnerCosts, partnerOffers, partnersNow, partnerStakeAfter, partnerTerms, rescuePartner, signPartner, termsEquity } from '../../src/engine/v2/finance/deals';
import { capabilityThresholds, gwOwned, licensedGap, licensedModel } from '../../src/engine/v2/finance/observe';
import { addLedger, commitmentsRemaining, ledgerDue, monthFirsts, qOf, RENEGOTIATE, totalFlows } from '../../src/engine/v2/finance/ledger';
import { budgetFactor, budgetRoom, DIVISION, divisionView, parentPaymentQ } from '../../src/engine/v2/finance/parent';
import { mixedBot } from '../../src/engine/v2/bots/mixed';
import { parentBudgetYear } from '../../src/data/v2/starts';
import { runwayOf } from '../../src/engine/v2/finance/runway';
import { deployGate } from '../../src/engine/v2/models/deployments';
import { editBlock } from '../../src/engine/v2/models/productOps';
import { applyShock, capitalQSystem, trancheConditionMet } from '../../src/engine/v2/finance/investors';
import { CAPEX2X_AUTOPILOT, financeAutopilot, REF_AUTOPILOT, type AutopilotOpts } from '../../src/engine/v2/finance/plan';
import { refDecide, refPlay } from '../../src/engine/v2/bots/ref';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { engine } from '../../src/engine/v2/index';
import type { CostLine, EngineSystem, GameStateV2 } from '../../src/engine/v2/types';
import { fileURLToPath } from 'node:url';
import { FIXTURE_DIR, SMOKE, check, finish, smokeCheck, validateJson } from './lib';
import { cached, pick, prefill } from './simcache';

// M4: the M2 deferrals (F7 capex/valuation, F8 distress-free share) now pass on integrated play; see design/PROGRESS.md.

const START = '2025-07-01';
const END_2026 = dayOfDate(START, '2027-01-01');
const END_Q1_2027 = dayOfDate(START, '2027-04-01');
const END_2027 = dayOfDate(START, '2028-01-01');
const END_2028 = dayOfDate(START, '2029-01-01');
const SEEDS = Array.from({ length: SMOKE ? 1 : 12 }, (_, i) => i + 1);
const ME = fileURLToPath(import.meta.url);
/** The final-state paths the checks read from a bot run. */
const RUN_PICKS = [
  'player.finance.ws3.years', 'player.finance.deals', 'player.finance.rounds', 'hidden.timeline', 'setup.seed', 'player.board.confidence',
  'player.finance.credibility', 'player.finance.promises', 'player.finance.revenueRun', 'player.finance.valuation',
];


const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const share = (xs: boolean[]) => xs.filter(Boolean).length / Math.max(1, xs.length);
const f1 = (x: number) => x.toFixed(1);
const F1pct = (x: number) => `${Math.round(x * 100)}%`;

/** FIN5a: each quarter mark also records the story (sector value, the player's share and valuation, growth, a bust, and
 *  each trailing private rival with revenue: FIN5b its marked valuation and run-rate). */
interface QRow { day: number; year: number; shipped: number; stock: number; margin: number; supply: number; S: number; share: number; V: number; R: number; g: number; bust: boolean; trailing: { v: number; r: number }[] }
/** FIN3b: versions the nonprofit PBC's safety committee held back (ready to release, red-flagged), and the days held. */
/** FIN5b: a private rival at a snapshot (end-2026). */
interface RivalRow { id: string; arch: string; status: string; V: number; R: number; cash: number }
interface Run { s: GameStateV2; q: QRow[]; firstDistress: number; gw2026: number; v2026: number; held: string[]; heldDays: number; pbcDays: number; rivals2026: RivalRow[]; private0: string[] }

function runBot(seed: number, opts: AutopilotOpts | undefined, until: number): Run {
  const s = newGame(defaultSetupV2({ seed }));
  const q: QRow[] = [];
  let firstDistress = -1;
  let gw2026 = 0;
  let v2026 = 0;
  const held = new Set<string>();
  let heldDays = 0;
  let pbcDays = 0;
  let rivals2026: RivalRow[] = [];
  const private0 = s.rivals.filter((r) => r.finance.valuation > 0 && !parentFunded(r)).map((r) => r.core.id);
  while (s.time.day < until) {
    if (s.player.board.safetyCommitteeVeto && s.time.day % 7 === 0) {
      pbcDays += 7;
      const hs = s.player.models.versions.filter((v) => v.status === 'ready' && (v.variant === 'full' || v.variant === 'mini') && charterReleaseBlock(s, v, 'api'));
      for (const v of hs) held.add(v.id);
      if (hs.length) heldDays += 7;
    }
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
    if (quarter) {
      const st = storyNow(s);
      const trailing = st.labs.filter((a) => a.id !== 'player' && a.revenue >= 1 && a.x.position < 0).map((a) => ({ v: a.valuation, r: a.revenue }));
      q.push({ day: s.time.day, year: Math.floor(decimalYear(s) + 1e-9), shipped: s.market.ws3.shipped, stock: s.market.ws3.stock, margin: impliedMargin(s.market), supply: s.market.supplyQ, S: st.sector.S, share: st.share, V: s.player.finance.valuation, R: s.player.finance.revenueRun, g: st.me?.growth ?? 1, bust: st.sector.bust < 1, trailing });
    }
    if (firstDistress < 0 && (s.player.finance.state === 'distress' || s.player.finance.state === 'insolvent')) firstDistress = s.time.day;
    if (s.time.day === END_2026 - 1) {
      const liveMW = s.player.sites.reduce((a, x) => a + (x.stage === 'live' ? x.mw : 0), 0);
      const cloud = s.player.cloud.reduce((a, c) => a + (c.startDay <= s.time.day && c.endDay > s.time.day ? c.h100e : 0), 0);
      gw2026 = liveMW / 1000 + (cloud * s.power.kWPerH100e) / 1e6;
      v2026 = s.player.finance.valuation;
      rivals2026 = s.rivals.filter((r) => private0.includes(r.core.id)).map((r) => ({ id: r.core.id, arch: r.archetype, status: r.core.status, V: r.finance.valuation, R: r.finance.revenueRun, cash: r.finance.cash }));
    }
  }
  return { s, q, firstDistress, gw2026, v2026, held: [...held], heldDays, pbcDays, rivals2026, private0 };
}
/** runBot through the simulation cache: the record keeps RUN_PICKS of the final state. */
const runBotC = (seed: number, opts: AutopilotOpts, until: number): Run =>
  cached('finance-bot', { seed, opts, until }, [ME], () => {
    const r = runBot(seed, opts, until);
    return { ...r, s: pick(r.s, RUN_PICKS) };
  });

// ───────────────────────────── F1–F3, F6: market under default demand (RefBot) ─────────────────────────────
const bare: AutopilotOpts = { ...REF_AUTOPILOT, strategic: false, offBalance: false, guard: false, rescue: false };
// The runner's --prefill shards: the bot and shock runs, in the order the checks ask for them.
prefill([
  () => runBotC(1, REF_AUTOPILOT, SMOKE ? END_2027 : END_2028),
  () => shockRun(0.7, 1, 1),
  () => shockRun(0.7, 1.5, 1),
  () => shockRun(1, 0.5, 2),
  ...SEEDS.map((seed) => () => runBotC(seed, REF_AUTOPILOT, END_2027)),
  ...SEEDS.map((seed) => () => runBotC(seed, bare, END_Q1_2027)),
  ...SEEDS.map((seed) => () => runBotC(seed, CAPEX2X_AUTOPILOT, END_2027)),
]);
const long = runBotC(1, REF_AUTOPILOT, SMOKE ? END_2027 : END_2028);
const prod = (y: number) => long.q.filter((r) => r.year === y).reduce((a, r) => a + r.shipped, 0);
check(prod(2026) >= 20e6 && prod(2026) <= 30e6, 'F1 global production 2026 ≈ 25M H100e (±20%)', `${f1(prod(2026) / 1e6)}M`);
smokeCheck(prod(2027) >= 45e6 && prod(2027) <= 60e6, 'F2 global production 2027 in 45–60M H100e', `${f1(prod(2027) / 1e6)}M`);
const w = long.s.hidden.timeline;
const ratios = long.q.map((r) => r.stock / globalCompute(w as never, BASELINES[0].start.globalCompute, r.day / 365));
smokeCheck(ratios.every((x) => x >= 0.8 && x <= 1.2), 'F3 installed stock within ±20% of globalCompute(w,t) through 2028', `ratio ${f1(Math.min(...ratios) * 100)}–${f1(Math.max(...ratios) * 100)}%`);
const m27 = long.q.filter((r) => r.year <= 2027).map((r) => r.margin);
const meanM = m27.reduce((a, b) => a + b, 0) / m27.length;
smokeCheck(meanM >= 0.7 && meanM <= 0.77 && Math.min(...m27) >= 0.65, 'F6 implied supplier margin 70–75% (mean Q4 2025–Q4 2027)', `mean ${f1(meanM * 100)}%, min ${f1(Math.min(...m27) * 100)}%`);

// ───────────────────────────── F4, F5: demand shocks (passive player, same seed) ─────────────────────────────
function shockRun(baseMult: number, mult: number, atQ: number, nQ = 16): { S: number[]; r: number[] } {
  return cached('finance-shock', { seed: 5, baseMult, mult, atQ, nQ }, [ME], () => shockRun0(baseMult, mult, atQ, nQ));
}
function shockRun0(baseMult: number, mult: number, atQ: number, nQ: number) {
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
const ref = SEEDS.map((seed) => runBotC(seed, REF_AUTOPILOT, END_2027));
const y26 = ref.map((r) => r.s.player.finance.ws3.years['2026']);
// FIN1: chips a lessor paid at delivery count as capex too (supplier funding is gone, its tally stays 0). FIN4r: capex
// and compute costs are what the year incurred, so payments a renegotiation deferred to the contracts' end count in
// the year they were due (the bot renegotiates on a tight runway in late 2025, which now really defers 35% of 2026's
// firm payments; the old stretched entries deferred almost nothing).
const capex = y26.map((y) => y.capexChips + (y.capexChipsFinanced ?? 0) + y.capexSites + y.capexSitesFinanced + y.supplierFunding + (y.deferredChips ?? 0));
const med = { rev: median(y26.map((y) => y.revenue)), capex: median(capex), compute: median(y26.map((y) => y.computeCosts + (y.deferredCompute ?? 0))), gw: median(ref.map((r) => r.gw2026)), v: median(ref.map((r) => r.v2026)) };
smokeCheck(med.rev >= 36 && med.rev <= 54, 'F7 RefBot 2026 revenue $45B (±20%)', `median $${f1(med.rev)}B`);
smokeCheck(med.capex >= 150 && med.capex <= 250, 'F7 RefBot 2026 capex $200B (±25%)', `median $${f1(med.capex)}B (range ${f1(Math.min(...capex))}–${f1(Math.max(...capex))})`);
smokeCheck(med.compute >= 25 && med.compute <= 60, 'F7 RefBot 2026 compute costs ~$40B/yr (incurred: paid + deferred by a renegotiation)', `median $${f1(med.compute)}B (deferred median $${f1(median(y26.map((y) => y.deferredCompute ?? 0)))}B)`);
smokeCheck(med.gw >= 4 && med.gw <= 9, 'F7 RefBot end-2026 power ~6 GW (live sites + cloud)', `median ${f1(med.gw)} GW`);
smokeCheck(med.v >= 1000 && med.v <= 3000, 'F7 RefBot end-2026 valuation $1–3T', `median $${(med.v / 1000).toFixed(2)}T`);

const funded = ref.map((r) => {
  const y = r.s.player.finance.ws3.years['2026'];
  // FIN4a: every partner deal is strategic (vendor financing is gone); stakes from before the start do not count.
  const deal = r.s.player.finance.deals.some((d) => !d.legacy && d.day >= 0 && d.day < END_2026);
  return { deal, fin: y.spvFinanced + y.leaseFinanced + y.cloudFinanced };
});
smokeCheck(share(funded.map((x) => x.deal && x.fin >= 50)) >= 0.8, 'F8 RefBot takes ≥ 1 strategic deal and ≥ $50B lease/colocation/cloud financing in 2026 (≥ 80% of seeds)', `${share(funded.map((x) => x.deal && x.fin >= 50)) * 100}% · median financing $${f1(median(funded.map((x) => x.fin)))}B`);
smokeCheck(share(ref.map((r) => r.firstDistress < 0 || r.firstDistress >= END_2026)) >= 0.75, 'F8 RefBot stays out of distress through 2026 (≥ 75% of seeds)', `${f1(share(ref.map((r) => r.firstDistress < 0 || r.firstDistress >= END_2026)) * 100)}%`);
const none = SEEDS.map((seed) => runBotC(seed, bare, END_Q1_2027));
smokeCheck(share(none.map((r) => r.firstDistress >= 0)) >= 0.8, 'F8 the C7 path without a strategic deal or off-balance-sheet financing hits distress by Q1 2027 (≥ 80%)', `${f1(share(none.map((r) => r.firstDistress >= 0)) * 100)}%`);
const x2 = SEEDS.map((seed) => runBotC(seed, CAPEX2X_AUTOPILOT, END_2027));
const x2capex = median(x2.map((r) => { const y = r.s.player.finance.ws3.years['2026']; return y.capexChips + y.capexSites + y.capexSitesFinanced; }));
smokeCheck(share(x2.map((r) => r.firstDistress >= 0 && r.firstDistress < END_2027)) >= 0.8, 'F8 capex2x bot (no rescue) reaches Distress by end-2027 (≥ 80%)', `${f1(share(x2.map((r) => r.firstDistress >= 0 && r.firstDistress < END_2027)) * 100)}% · 2026 capex attempted median $${f1(x2capex)}B`);

// ───────────────────────────── F9: valuation, rounds, shocks ─────────────────────────────
{
  // FIN5a (spec §1, §14): the valuation is the story split (sector value × share), no longer a revenue-multiple
  // formula, so FC1 and FC2 are checked on the RefBot's quarter marks instead of a formula grid (rewritten: the
  // formula and its narrative premium N are gone).
  const s0 = median(ref.map((r) => sectorValue(newGame(defaultSetupV2({ seed: r.s.setup.seed }))).S));
  const late = median(ref.map((r) => { const a = r.q.find((x) => x.day >= dayOfDate(START, '2026-10-01')); const b = r.q.find((x) => x.day >= dayOfDate(START, '2027-01-01')); return a && b ? (a.S + b.S) / 2 : NaN; }).filter(Number.isFinite));
  check(s0 >= 550 && s0 <= 800 && late >= 2200 && late <= 3300, 'F9 (FC1) sector value ≈ $0.6–0.7T at the Jul 2025 start and ≈ $2.5–3T in late 2026 (mean of the Oct and Jan marks), RefBot path', `start median ${f1(s0)}B · late 2026 median ${f1(late)}B`);
  const marks = ref.flatMap((r) => r.q.filter((x) => x.year <= 2027 && !x.bust && x.R >= 1));
  const hi = marks.filter((x) => x.g >= 2.5).map((x) => x.V / x.R);
  const lo = marks.filter((x) => x.g < 2.5).map((x) => x.V / x.R);
  check(median(hi) >= 20 && median(hi) <= 37, 'F9 (FC2) leader-style multiple 20–37× run-rate at high growth (RefBot marks with ×2.5+ a year, no bust, through 2027)', `median ${f1(median(hi))}× over ${hi.length} marks (slower growth: ${f1(median(lo))}× over ${lo.length})`);
  // FC2's "trailing labs lower" (C11: ≈ 15–20× at ×2–3 a year): on growth for the leader-style lab, and (FIN5b) on the
  // trailing private rivals' marked valuations through 2026 (2027 is printed: the RefBot holds ≈ 95% of the sector by
  // then and the rivals' revenue collapses, so their team value dominates their multiple).
  const tr = ref.flatMap((r) => r.q.filter((x) => x.year <= 2026 && !x.bust).flatMap((x) => x.trailing.map((t) => t.v / t.r)));
  const tr27 = ref.flatMap((r) => r.q.filter((x) => x.year === 2027 && !x.bust).flatMap((x) => x.trailing.map((t) => t.v / t.r)));
  check(lo.length > 0 && median(lo) < median(hi), 'F9 (FC2) the leader-style lab is valued at a lower multiple when its growth is slower (C11)', `×2.5+ a year ${f1(median(hi))}× · slower ${f1(median(lo))}×`);
  check(tr.length > 0 && median(tr) < median(hi), 'F9 (FC2, FIN5b) trailing private rivals are valued at a lower multiple than the leader-style lab at high growth (their marks through 2026)', `trailing rivals median ${f1(median(tr))}× over ${tr.length} lab-marks (2027: ${f1(median(tr27))}× over ${tr27.length}) · leader-style ${f1(median(hi))}×`);
  const dil = ref.flatMap((r) => r.s.player.finance.rounds.filter((x) => !x.anchor && !x.down).map((x) => x.dilution));
  smokeCheck(dil.length > 0 && Math.max(...dil) <= 0.08 + 1e-9, 'F9 unanchored round dilution ≤ 8% (C12)', `max ${f1(Math.max(...dil) * 100)}% over ${dil.length} rounds`);
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
  smokeCheck(s0.player.finance.revenueRun === 12 && r27 >= 98 && r27 <= 182, 'F11 revenue path (classic): $12B run-rate Jul 2025; ~$140B in 2027 (±30%)', `start ${s0.player.finance.revenueRun}, 2027 $${f1(r27)}B (WS5 owns the demand model; WS3 books it)`);
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
// FIN3b: WS3 has no events any more (E37 "Board revolt" was dropped for the critics' seat action, FINANCE-V3 §10).
check(!EVENT_BY_ID.has('E37'), 'FIN3b E37 Board revolt is gone (the critics seat is a standing action)');
for (const s of fixtures) check(okPreview(FINANCE_ACTIONS.find((a) => a.id === 'fin.critics')!.preview(s, {})), `FIN3b critics' seat preview trade-off @day ${s.time.day}`);
let applied = 0;
for (const a of FINANCE_ACTIONS) {
  const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  s.player.finance.state = a.id === 'fin.rescue' || a.id === 'fin.downRound' || a.id === 'fin.renegotiate' ? 'distress' : s.player.finance.state;
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
    // FIN5a: the conservative pitch (×0.85) can price under the first round's post-money at the close (the story mark
    // moves half-way each quarter), which waits for the CEO as a repriced down round: accept it.
    if (s.player.finance.ws3.repricedRound) acceptRepriced(s, makeCtx(s));
    const live = livePromises(s);
    const p2 = live[live.length - 1];
    check(!err && !!th && th.type === 'scale' && live.length === n0 + 2 && p1.deadline === promiseDeadline(s, p1.closeDay) && quarterIndex(s.time.startDate, p1.deadline) - quarterIndex(s.time.startDate, p1.closeDay) === 4, 'FIN2 each round leaves a promise due four quarter starts after its close; promises stack', `${live.length - n0} live: ${live.slice(-2).map((p) => `${p.type}/${p.pitch} due day ${p.deadline}`).join(', ')}`);
    // Weight = amount ÷ raised in the year to its deadline: the $1B promise barely counts next to the $50B one. FIN4r
    // (H2): ÷ at least a typical round at its close (the dilution limit at its pre-money), so neither weighs more than
    // its share of a normal round.
    const w1 = promiseWeight(s, p1);
    const w2 = promiseWeight(s, p2);
    const t1 = p1.typical ?? 0;
    const t2 = p2.typical ?? 0;
    check(t1 > 0 && t2 > 0 && Math.abs(w1 - 1 / Math.max(51, t1)) < 1e-6 && Math.abs(w2 - 50 / Math.max(50, t2)) < 1e-6 && w1 < 0.05, 'FIN2/FIN4r weight = the round ÷ max(everything raised in the year to its deadline, a typical round at its close) ($1B then $50B)', `${F1pct(w1)} / ${F1pct(w2)} (typical $${f1(t1)}B / $${f1(t2)}B)`);
    // Judged at the deadline: met +30 credibility / +30 board, missed −30 / −30, × weight, within 20% nothing; never
    // cash. FIN3a: the board part is × the board's multiplier for promise results (the day-400 fixture's leader board,
    // two mission and two independent seats: ×0.75); sizes rebalanced from +10 / −15 (FIN3a notes).
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
    const k = moodWeight(fx(), 'results');
    check(met.o === 'met' && Math.abs(met.dc - 30) < 1e-9 && Math.abs(met.db - PROMISE_RESULT.metBoard * k) < 1e-9 && near.o === 'near' && near.dc === 0 && near.db === 0 && miss.o === 'missed' && Math.abs(miss.dc + 30) < 1e-9 && Math.abs(miss.db - PROMISE_RESULT.missBoard * k) < 1e-9 && met.cash === 0 && miss.cash === 0, `FIN2/FIN3a at its deadline a promise met moves credibility +30 / board +${PROMISE_RESULT.metBoard} × the board's weight, missed by > 20% −30 / −${Math.abs(PROMISE_RESULT.missBoard)} ×, within 20% nothing (× weight); never cash`, `board weight ×${k} · met ${met.dc}/${f1(met.db)} · near ${near.dc}/${near.db} · missed ${miss.dc}/${f1(miss.db)}`);
  }
  {
    // Credibility (FIN5a: moved from the mark into the story share) multiplies the lab's weight: Doubted ×0.7 … Proven
    // ×1.15, so the valuation moves with it (less than proportionally: the share is a softmax); start values by start
    // type. (Rewritten: FIN2's interim multiplied the valuation mark itself.)
    const s = fx();
    const at = (c: number) => { s.player.finance.credibility = c; const st = storyNow(s); return { w: st.me!.weight, V: st.V }; };
    const v1 = at(60);
    const v0 = at(10);
    const v2 = at(90);
    const starts = (['leader', 'challenger', 'spinout'] as const).map((st) => newGame(defaultSetupV2({ seed: 1, start: st })).player.finance.credibility);
    check(Math.abs(v0.w / v1.w - 0.7) < 1e-9 && Math.abs(v2.w / v1.w - 1.15) < 1e-9 && v0.V < v1.V && v1.V < v2.V && starts.join(',') === '60,50,40' && credRung(60).id === 'Credible' && credRung(40).id === 'Unproven', "FIN2/FIN5a credibility multiplies the lab's weight in the share (Doubted ×0.7, Proven ×1.15), so the valuation; start: leader 60, challenger 50, spinout 40", `V Doubted ${f1(v0.V)}B · Credible ${f1(v1.V)}B · Proven ${f1(v2.V)}B · starts ${starts.join('/')}`);
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
    const r = s.player.finance.rounds[s.player.finance.rounds.length - 1];
    check(avail === true && !err && r.ipo === true && ask / (V0 + ask) <= 0.05 + 1e-9 && s.player.finance.ownership.public > 0 && s.player.finance.dualClass === true && Math.abs(playerGov(s) - GOV_FACTOR.founder * DUAL_CLASS_GOV) < 1e-12 && founderControl(s) && typeof again === 'string' && s.player.board.seats.some((x) => x.holder === 'Listing independent') && livePromises(s).every((p) => p.closeDay !== r.day), 'FIN2 the IPO is a one-time action (≤ 5%, no promise); dual-class keeps founder control at governance ×0.95 (FIN5a: on the share)', `ask $${f1(ask)}B = ${F1pct(ask / (V0 + ask))} at signing · public ${F1pct(s.player.finance.ownership.public)} at close · again: ${again}`);
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
    // Save migration 34 → 35: credibility by start type, an empty promise list, the revenue plan gone.
    const s = fx();
    const raw = JSON.parse(serialize(s));
    raw.schemaRev = 34;
    delete raw.player.finance.credibility;
    delete raw.player.finance.promises;
    raw.player.finance.raisedLast4q = 12;
    raw.player.finance.ws3.revenuePlan = 40;
    const m = deserialize(JSON.stringify(raw));
    check(m.player.finance.credibility === 60 && Array.isArray(m.player.finance.promises) && !('revenuePlan' in m.player.finance.ws3) && !('raisedLast4q' in m.player.finance), 'FIN2 save migration 34 → 35');
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

// ───────────────────────────── FIN3a: board votes and mood (FINANCE-V3 §7.3–§7.4) ─────────────────────────────
{
  const fx = () => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  {
    // Votes are deterministic and shown before you ask: the same state gives the same vote, and the vote never draws
    // from the finance stream (no dice).
    const s = fx();
    const v1 = boardVote(s, 'commitments', 'test');
    const rng0 = JSON.stringify(s.rng);
    const v2 = boardVote(s, 'commitments', 'test');
    const voters = s.player.board.seats.filter((x) => x.weight > 0);
    check(JSON.stringify(v1) === JSON.stringify(v2) && JSON.stringify(s.rng) === rng0 && v1.seats.length === voters.length && v1.total === voters.reduce((a, x) => a + x.weight, 0) && v1.passes === v1.yes > v1.total / 2, 'FIN3a a board vote is deterministic, seat by seat; passes when the weighted yes is more than half', `${v1.label}: ${v1.seats.map((x) => `${x.kind} ${x.yes ? 'yes' : 'no'} ${f1(x.lean)}`).join(', ')} → ${v1.yes}/${v1.total}`);
  }
  {
    // The situation moves every seat: a short runway makes the board want money (down round) and fear obligations.
    const s = fx();
    s.player.board.confidence = 50;
    s.player.finance.cash = 1e4;
    const rich = { dr: boardVote(s, 'downRound', ''), cm: boardVote(s, 'commitments', '') };
    s.player.finance.cash = 1;
    s.player.finance.ledger.push({ id: 'L-burn-test', payee: 'Test', kind: 'cloud', perQuarter: 500, endDay: s.time.day + 3650, cancellableNoticeQ: null, penalty: 0 });
    const poor = { dr: boardVote(s, 'downRound', ''), cm: boardVote(s, 'commitments', '') };
    const lean = (v: ReturnType<typeof boardVote>) => v.seats.find((x) => x.kind !== 'founder')!.parts.need;
    check(lean(poor.dr) > lean(rich.dr) && lean(poor.cm) < lean(rich.cm) && poor.dr.passes && !rich.dr.passes, 'FIN3a a short runway carries a down round and weighs against new obligations (no cash: the down round passes; flush with cash: refused)', `down round: rich ${rich.dr.yes}/${rich.dr.total}, poor ${poor.dr.yes}/${poor.dr.total} · commitments need ${f1(lean(rich.cm))} → ${f1(lean(poor.cm))}`);
    // Board mood sways every seat.
    s.player.finance.cash = 30;
    s.player.board.confidence = 90;
    const hi = boardVote(s, 'commitments', '');
    s.player.board.confidence = 10;
    const lo = boardVote(s, 'commitments', '');
    check(hi.seats.every((x, i) => x.lean > lo.seats[i].lean) && hi.yes >= lo.yes, 'FIN3a board confidence sways every seat in a vote', `commitments at confidence 90: ${hi.yes}/${hi.total}, at 10: ${lo.yes}/${lo.total}`);
  }
  {
    // The dilution vote and the 20%-of-revenue debt vote are gone; debt above 3× revenue and firm commitments above 3×
    // revenue are voted; operating decisions (spot chips, single batches, spot rentals, sites) never are.
    const s = fx();
    const R = s.player.finance.revenueRun;
    const vote = (id: string, p: Record<string, number | string | boolean>) => FINANCE_ACTIONS.find((a) => a.id === id)!.vote?.(s, p);
    const bigRaise = vote('fin.raise', { ask: 0.5 * s.player.finance.valuation });
    const smallDebt = vote('fin.drawDebt', { kind: 'gpuTerm', amount: 0.5 * R });
    const bigDebt = debtVote(s, 4 * R);
    const ops = ['cmp.newSite', 'cmp.community', 'cmp.preorderTransformers', 'fin.sellChips'].every((id) => !FINANCE_ACTIONS.find((a) => a.id === id)!.vote) && !vote('cmp.buyChips', { term: 1, qty: 5e6 }) && !vote('cmp.buyChips', { term: 0, qty: 5e6 }) && !vote('cmp.rentCompute', { term: 1, h100e: 5e6 }) && !vote('cmp.rentCompute', { term: 8, h100e: 50e6, firm: false });
    const firm = vote('cmp.rentCompute', { term: 8, h100e: 50e6, firm: true });
    check(!bigRaise && !smallDebt && bigDebt?.decision === 'debt' && ops && firm?.decision === 'commitments', 'FIN3a votes: no dilution vote, no 20%-of-revenue debt vote; debt or firm commitments above 3× revenue are voted; compute orders, sites and spot rentals never', `raise of half the valuation: ${bigRaise ? 'voted' : 'no vote'} · debt 0.5× revenue: ${smallDebt ? 'voted' : 'no vote'} · ${bigDebt?.trigger} · ${firm?.trigger}`);
    // A failed vote stops the action with the vote's reason and no side effects (no confidence hit, no block).
    const t = fx();
    t.player.board.confidence = 5;
    t.player.finance.cash = 2;
    const bc0 = t.player.board.confidence;
    const rv = FINANCE_ACTIONS.find((a) => a.id === 'cmp.rentCompute')!.vote!(t, { term: 8, h100e: 50e6, firm: true })!;
    const err = act(t, 'cmp.rentCompute', { term: 8, h100e: 50e6, firm: true });
    check(!rv.passes && typeof err === 'string' && /board votes no/.test(err) && t.player.board.confidence === bc0 && !('blockedUntil' in t.player.finance.ws3), 'FIN3a a failed vote stops the action with its reason; no confidence hit, no 90-day block', String(err));
  }
  {
    // Founder control forces a failed vote at −20 confidence; without it, force does nothing.
    const s = fx();
    s.player.board = { ...s.player.board, preset: 'founder', seats: [{ kind: 'founder', holder: 'CEO', stance: [1, 0.3, 0.2, 0.3], weight: 2 }, { kind: 'financial', holder: 'Lead investor', stance: [1, 0.6, -0.2, 0], weight: 1 }, { kind: 'independent', holder: 'Independent', stance: [0, 0.5, 0.3, 0.3], weight: 1 }] };
    s.player.finance.ownership.public = 0;
    s.player.board.confidence = 25;
    s.player.finance.cash = 2;
    const p = { term: 8, h100e: 50e6, firm: true };
    const v = FINANCE_ACTIONS.find((a) => a.id === 'cmp.rentCompute')!.vote!(s, p)!;
    const n0 = s.player.cloud.length;
    const err = act(s, 'cmp.rentCompute', { ...p, force: true });
    const forced = s.player.board.confidence;
    const t = fx();
    t.player.board.confidence = 25;
    t.player.finance.cash = 2;
    const err2 = act(t, 'cmp.rentCompute', { ...p, force: true });
    check(!v.passes && v.canForce && !err && s.player.cloud.length > n0 && Math.abs(forced - (25 - VOTE.forceCost)) < 1e-9 && typeof err2 === 'string', 'FIN3a founder control forces a failed vote at board confidence −20; a board without it cannot be forced', `founder: ${v.yes}/${v.total} forced, confidence 25 → ${forced} · legacy board: ${err2}`);
  }
  {
    // Mood by seat kind (spec §7.4 table): a mission board minds incidents more and falling behind not at all; a
    // financial board the opposite. No safety-grade bonus, no tight-runway hit, no plan.
    const s = fx();
    const kinds = (k: 'mission' | 'financial') => { s.player.board.seats = [{ kind: 'founder', holder: 'CEO', stance: [1, 0.3, 0.2, 0.3], weight: 1 }, { kind: k, holder: k, stance: [0, 0, 0, 0], weight: 2 }]; return { inc: moodWeight(s, 'incidents'), behind: moodWeight(s, 'behind'), res: moodWeight(s, 'results'), set: moodWeight(s, 'setbacks') }; };
    const m = kinds('mission');
    const fi = kinds('financial');
    check(m.inc === 2 && m.behind === 0 && m.res === 0.5 && m.set === 1 && fi.inc === 0.5 && fi.behind === 1.5 && fi.res === 1.5 && fi.set === 1 && MOOD_WEIGHTS.setbacks.independent === 1.5, 'FIN3a mood weights by seat kind (financial / mission / independent: promises 1.5/0.5/1, setbacks 1/1/1.5, behind 1.5/0/0.5, incidents 0.5/2/1)');
    const g = newGame(defaultSetupV2({ seed: 3 }));
    while (g.time.day < 400) {
      const gr = g.researchBodies.index.grades;
      if (gr.player) gr.player.letter = 'A';
      tick(g, { skip: ['endings'] });
    }
    const srcs = new Set((g.causes.byKey['board.confidence'] ?? []).map((e) => e.source));
    check(![...srcs].some((x) => /Safety Index|tight runway|plan|new borrowing|debt repaid|board rejected|strategic rescue/.test(x)), 'FIN3a no safety-grade bonus, tight-runway, borrowing, plan or rejection sources', [...srcs].join(', ') || 'only reversion');
    // Every board-confidence source the engine posts is named (one of the four, the drift, or a decision/event cost).
    const named = [...srcs].every((x) => MOOD_SOURCE_OF[x] || ['board memory fades', 'forced past the board', 'critics given a seat'].includes(x));
    check(named, 'FIN3a board confidence moves only on named sources', [...srcs].join(', '));
  }
  {
    // Rebalance (FIN3a notes): the reference bot's board at the end of 2027 sits near 60 (FIN2 48 without the plan; 67
    // with it).
    const bc = median(ref.map((r) => r.s.player.board.confidence));
    check(bc >= 55, 'FIN3a RefBot end-2027 board confidence median ≥ 55 (FIN2: 48)', `median ${f1(bc)} (${ref.map((r) => r.s.player.board.confidence.toFixed(0)).join(' ')})`);
  }
  {
    // Save migration 35 → 36: the pending-approvals list and old vote blocks go; E37's capex freeze stays.
    const s = fx();
    const raw = JSON.parse(serialize(s));
    raw.schemaRev = 35;
    raw.player.board.pendingApprovals = [];
    raw.player.finance.ws3.blockedUntil = { 'fin.raise': 9999, 'deal:sovereign': 9999, 'cmp.newSite': 9999 };
    // FIN3b: migration 36 → 37 then drops the block list (E37's capex freeze was its last user) and the reinstatement day.
    raw.player.finance.ws3.reinstatedDay = 5;
    const m = deserialize(JSON.stringify(raw));
    check(!('pendingApprovals' in m.player.board) && !('blockedUntil' in m.player.finance.ws3) && !('reinstatedDay' in m.player.finance.ws3), 'FIN3a/FIN3b save migrations 35 → 36 → 37 (approvals list, board blocks and reinstatement gone)');
  }
}

// ───────────────────────────── FIN3b: charter rights, low confidence, distress (FINANCE-V3 §7.2, §7.5, §8) ─────────────
{
  const fx = () => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const B = (k: number, est: number, clarity = 0.7) => ({ est, sd: 0.1, clarity, lastObsDay: k });
  /** A ready full-model copy of the newest full version (so a live product can swap to it). */
  const candidate = (s: GameStateV2, id: string) => {
    const v = [...s.player.models.versions].reverse().find((x) => x.variant === 'full' && (x.status === 'ready' || x.status === 'deployed'))!;
    const c = JSON.parse(JSON.stringify(v)) as typeof v;
    c.id = id;
    c.name = `${v.name}-test`;
    c.status = 'ready';
    s.player.models.versions.push(c);
    return c;
  };
  {
    // Nonprofit PBC: the safety committee halts the release of a model the player's own evals red-flag, on every
    // external channel and on a live product's model swap; internal use is not a release; the veto flag is what is
    // read; the hold lifts when the estimate falls to 30% or less.
    const s = fx();
    s.player.board = initialBoard('nonprofitPBC');
    const v = candidate(s, 'VCOMMITTEE');
    v.beliefs.SCHEME = B(s.time.day, 0.6);
    const g1 = deployGate(s, v, 'api');
    const gc = deployGate(s, v, 'consumer');
    const gi = deployGate(s, v, 'internal');
    const live = s.player.deployments.find((d) => (d.channel === 'api' || d.channel === 'consumer') && d.status !== 'withdrawn');
    const swap = live ? editBlock(s, live, { versionId: v.id }) : 'no live product';
    s.player.board.safetyCommitteeVeto = false;
    const g2 = deployGate(s, v, 'api');
    s.player.board.safetyCommitteeVeto = true;
    for (const k of ['SCHEME', 'AF', 'SAND'] as const) v.beliefs[k] = B(s.time.day, 0.45);
    const g3 = deployGate(s, v, 'api');
    const isHold = (g: true | string | undefined) => typeof g === 'string' && /Safety committee/.test(g);
    check(isHold(g1) && isHold(gc) && gi === true && isHold(swap) && !isHold(g2) && !isHold(g3), 'FIN3b nonprofit PBC: the safety committee halts the release of a red-flagged model (every external channel and a live swap; not internal use; the veto flag is read; lifts at ≤ 50%; the 30% E17 alarm alone does not halt)', `${g1} · consumer ${isHold(gc)} · internal ${gi} · swap ${isHold(swap)} · veto off ${isHold(g2)} · cleared ${isHold(g3)}`);
    const l = fx();
    const lv = candidate(l, 'VLEGACY');
    lv.beliefs.SCHEME = B(l.time.day, 0.6);
    l.player.board = initialBoard('legacyNonprofit');
    check(!isHold(deployGate(l, lv, 'api')) && charterRights(l).every((r) => r.id !== 'safetyCommittee') && charterRights(s).some((r) => r.id === 'safetyCommittee'), 'FIN3b the release block is the nonprofit PBC\'s alone (legacy nonprofit: no committee)');
  }
  {
    // PBC + trust: the trust votes (its mission seats only, no force) on releasing a capability-threshold model's
    // weights and on a sale of control; neither passes on its stance. A model without a threshold flag needs no vote.
    const s = fx();
    s.player.board = initialBoard('pbcTrust');
    const v = candidate(s, 'VTRUST');
    v.variant = 'open';
    v.flags = { cyberOffense: true };
    const g = deployGate(s, v, 'open');
    const tv = transferVote(s, v, 'open')!;
    const plain = candidate(s, 'VPLAIN');
    plain.variant = 'open';
    plain.flags = { persuasion: true };
    const gp = deployGate(s, plain, 'open');
    const cv = controlVote(s, 'Test partner', 0.6);
    check(typeof g === 'string' && /trust votes no/.test(g) && tv.body === 'trust' && !tv.canForce && tv.seats.length > 0 && tv.seats.every((x) => x.kind === 'mission') && !(typeof gp === 'string' && /trust/.test(gp)) && !!cv && !cv.passes && !controlVote(s, 'Test partner', 0.4), 'FIN3b PBC + trust: the trust votes no on open weights of a capability-threshold model and on a sale of control (mission seats only, no force); no vote below 50% or without a threshold flag', `${g} · control: ${cv?.yes}/${cv?.total}`);
    // A deal that would hand a partner control stops at the trust before anything is booked. FIN4a: offers are
    // computed live, so the partner already holds 49% and its cheque would take it past half.
    {
      const partner = 'Gulf Sovereign Fund';
      s.player.finance.ownership = { founder: 0.2, mission: 0.2, fin: 0.11, strat: { [partner]: 0.49 }, public: 0 };
      const cash0 = s.player.finance.cash;
      const own0 = JSON.stringify(s.player.finance.ownership);
      const after = partnerStakeAfter(s, partnerTerms(s, partner));
      const err = signPartner(s, makeCtx(s), partner, { force: true });
      check(typeof err === 'string' && /trust votes no/.test(err) && s.player.finance.cash === cash0 && JSON.stringify(s.player.finance.ownership) === own0 && after > 0.5 && !dealWith(s, partner), 'FIN3b a deal past 50% under PBC + trust stops at the trust (no cash, no shares, force does not help)', `${String(err)} · stake after ${F1pct(after)}`);
    }
    const o = fx();
    o.player.board = initialBoard('nonprofitPBC');
    check(!controlVote(o, 'Test partner', 0.6) && !transferVote(o, v, 'open'), 'FIN3b only PBC + trust has the trust\'s votes');
  }
  // Ouster votes on a set board and grievance (the last year's confidence losses).
  const board = (preset: Parameters<typeof initialBoard>[0], bc: number, source: string, warnAgo = 100) => {
    const s = fx();
    s.player.board = initialBoard(preset);
    s.player.board.confidence = bc;
    s.player.finance.ws3.boardWarnDay = s.time.day - warnAgo;
    s.causes.byKey['board.confidence'] = [{ day: s.time.day - 10, delta: -30, source }];
    delete s.flags['ws3.ousterDay'];
    return s;
  };
  const toReview = (s: GameStateV2) => {
    const q0 = quarterIndex(s.time.startDate, s.time.day);
    while (quarterIndex(s.time.startDate, s.time.day) === q0) tick(s, { skip: ['endings'] });
  };
  {
    // Deterministic and seat by seat: the same state gives the same vote and draws no dice; the legacy nonprofit board
    // removes a CEO more easily (half the reluctance), so on a "burning cash" grievance it musters more votes.
    const s = board('nonprofitPBC', 22, 'down round');
    const rng0 = JSON.stringify(s.rng);
    const a = ousterVote(s);
    const b = ousterVote(s);
    const legacy = board('nonprofitPBC', 22, 'down round');
    legacy.player.board.preset = 'legacyNonprofit';
    const l = ousterVote(legacy);
    check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(s.rng) === rng0 && a.seats.every((x) => x.kind !== 'founder') && a.live && l.reluctance === OUSTER.legacyMult * a.reluctance && l.yes > a.yes, 'FIN3b the ouster vote is deterministic and seat by seat; the legacy nonprofit board removes a CEO more easily (reluctance ×0.5)', `burning cash at 22: PBC ${a.yes}/${a.total} (${a.seats.map((x) => `${x.kind} ${x.lean.toFixed(2)}`).join(', ')}) · legacy ${l.yes}/${l.total}`);
    const young = board('nonprofitPBC', 15, 'down round', 30);
    check(!ousterVote(young).live && !ousterVote(board('nonprofitPBC', 30, 'down round')).live, 'FIN3b no ouster vote without confidence under 25 and a warning at least 60 days old');
  }
  {
    // At the review: a reckless CEO on the legacy nonprofit board is voted out, and loyal staff no longer reinstate
    // anyone; a slow CEO on the same mission board is shielded (the vote falls short and the game goes on).
    const r = board('legacyNonprofit', 12, 'public incident');
    r.player.morale.overall = 95;
    const pre = ousterVote(r);
    toReview(r);
    const slow = board('legacyNonprofit', 12, 'behind a rival');
    const preSlow = ousterVote(slow);
    toReview(slow);
    check(pre.passes && r.flags['ws3.ousterDay'] !== undefined && !preSlow.passes && slow.flags['ws3.ousterDay'] === undefined, 'FIN3b at the review the vote shown beforehand decides: a reckless CEO is ousted (staff morale 95 does not reinstate); a mission board shields a slow one', `reckless ${pre.yes}/${pre.total} · slow ${preSlow.yes}/${preSlow.total}`);
  }
  {
    // Give the critics a seat: below 40 only, once a year; the side driving the decline gets a director for good
    // (incidents → a mission seat; falling behind → an investor seat); +15 now; the board's mood weights move its way.
    const s = board('nonprofitPBC', 50, 'public incident');
    const above = criticsAvailable(s);
    s.player.board.confidence = 35;
    const n0 = s.player.board.seats.length;
    const w0 = moodWeight(s, 'incidents');
    const err = act(s, 'fin.critics', {});
    const x = s.player.board.seats[s.player.board.seats.length - 1];
    s.player.board.confidence = 30;
    const again = criticsAvailable(s);
    const i = board('nonprofitPBC', 35, 'behind a rival');
    const wb = moodWeight(i, 'behind');
    act(i, 'fin.critics', {});
    const y = i.player.board.seats[i.player.board.seats.length - 1];
    check(typeof above === 'string' && !err && s.player.board.seats.length === n0 + 1 && x.kind === 'mission' && moodWeight(s, 'incidents') > w0 && typeof again === 'string' && y.kind === 'financial' && moodWeight(i, 'behind') > wb && i.player.board.confidence === 35 + CRITICS.gain, 'FIN3b critics seat: below 40, once a year; incidents bring a mission director, falling behind an investor one; +15 now and the mood weights lean their way', `${x.holder}: incidents ×${w0.toFixed(2)} → ×${moodWeight(s, 'incidents').toFixed(2)} · ${y.holder}: behind ×${wb.toFixed(2)} → ×${moodWeight(i, 'behind').toFixed(2)} · again: ${again}`);
  }
  {
    // Distress (spec §8): no morale hit; the board still minds each review in distress.
    const s = fx();
    s.player.finance.covenantBreachDay = s.time.day;
    s.player.finance.state = 'healthy';
    const m0 = s.player.morale.overall;
    const bc0 = s.player.board.confidence;
    updateRunwayState(s, makeCtx(s));
    check((s.player.finance.state as string) === 'distress' && s.player.morale.overall === m0 && !(s.causes.byKey['morale'] ?? []).some((e) => e.source === 'financial distress') && s.player.board.confidence < bc0, 'FIN3b distress costs no staff morale (the board still minds it)', `morale ${m0.toFixed(1)} → ${s.player.morale.overall.toFixed(1)}, board ${bc0.toFixed(1)} → ${s.player.board.confidence.toFixed(1)}`);
  }
  {
    // The IPO's 5% cap holds at close: a mark that falls after signing reprices the IPO, and the repriced IPO raises
    // less rather than selling more of the company (it once closed at 8%).
    const s = fx();
    s.player.finance.state = 'healthy';
    s.capital.ipoWindow = true;
    const err = act(s, 'fin.ipo', {});
    const pr = s.player.finance.ws3.pendingRound;
    if (!err && pr) {
      pr.max = 1e6;
      const ask = pr.ask;
      // A last round above today's mark: the fall reprices the IPO into a down round the player must accept.
      s.player.finance.rounds.push({ day: s.time.day - 100, amount: 10, postMoney: 2 * s.player.finance.valuation, dilution: 0.05, down: false });
      s.player.finance.valuation *= 0.5;
      const ctx = makeCtx(s);
      closePendingRound(s, ctx);
      const repriced = !!s.player.finance.ws3.repricedRound;
      if (repriced) acceptRepriced(s, ctx);
      const r = s.player.finance.rounds[s.player.finance.rounds.length - 1];
      check(repriced && r.ipo === true && r.dilution <= dMax(false, true) + 1e-9 && r.amount < ask, 'FIN3b the IPO sells at most 5% at close: a repriced IPO raises less instead', `asked ${f1(ask)}B · ${repriced ? 'repriced, accepted' : 'closed'} at ${f1(r.amount)}B = ${(r.dilution * 100).toFixed(2)}%`);
    } else check(false, 'FIN3b the IPO sells at most 5% at close', String(err));
  }
  {
    // How often the committee bites on the reference bot: leader start (legacy nonprofit), recapitalised into a
    // nonprofit PBC around Q4 2026; ready models it held back, through 2027.
    const pbc = ref.filter((r) => r.pbcDays > 0);
    const games = pbc.filter((r) => r.held.length > 0).length;
    const versions = pbc.reduce((a, r) => a + r.held.length, 0);
    const share = median(pbc.map((r) => r.heldDays / Math.max(1, r.pbcDays)));
    check(pbc.length > 0 && share <= 0.5, 'FIN3b the safety committee binds without freezing releases (RefBot under the nonprofit PBC: median share of weeks with a model held ≤ 50%)', `${pbc.length} of ${ref.length} games reach the PBC · ${games} held a model · ${versions} versions held · median ${F1pct(share)} of PBC weeks with a hold`);
  }
}

// ───────────────────────────── FIN3c: acquisitions (FINANCE-V3 §9) ─────────────────────────────
{
  const fx = () => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const E32 = EVENT_BY_ID.get('E32')!;
  const E22 = EVENT_BY_ID.get('E22')!;
  const idx = (e: typeof E32, label: string) => e.choices.findIndex((c) => c.label === label);
  /** A fixture with a private rival out of money and its E32 offer pending; a rich, confident board unless told. */
  const offer = (opts: { cash?: number; bc?: number; preset?: Parameters<typeof initialBoard>[0]; rivalV?: number } = {}) => {
    const s = fx();
    if (opts.preset) s.player.board = initialBoard(opts.preset);
    s.player.board.confidence = opts.bc ?? 80;
    s.player.finance.cash = opts.cash ?? 2000;
    const r = s.rivals.find((x) => x.core.status === 'active' && x.finance.valuation > 0)!;
    r.finance.cash = -3;
    r.finance.distress = true;
    if (opts.rivalV !== undefined) r.finance.valuation = opts.rivalV;
    s.events.pending.push({ id: 'E32', instance: 'E32@t', day: s.time.day, deadline: s.time.day + 30, data: { lab: r.core.id }, crisis: false });
    return { s, r, d: { lab: r.core.id } as Record<string, number | string> };
  };
  // Trigger: distress only (never your lead), and the terms.
  {
    const { s, r } = offer();
    for (const x of s.rivals) x.meters.cooperation = 90;
    const t = acquireTerms(s, r);
    const V = s.player.finance.valuation;
    const o = rivalObligations(r);
    const parent = s.rivals.find((x) => x.finance.valuation <= 0);
    check(E32.when(s) === false && t.price === r.finance.valuation * ACQUIRE.discount && Math.abs(t.stockFrac - t.price / (V + t.price)) < 1e-12 && o.perQ === r.finance.commitments / 4 && o.total === o.perQ * ACQUIRE.termQ && o.debt === 3 && (!parent || rivalObligations(parent).total + rivalObligations(parent).debt === 0), 'FIN3c E32 is offered only for a rival in distress (requested by its finance, never for your lead); price = its valuation × 0.5, stock at your valuation; obligations = its yearly book for two more years and the cash it is short; a parent-funded lab brings none', `price $${f1(t.price)}B · stock ${(t.stockFrac * 100).toFixed(2)}% · contracts $${f1(o.perQ)}B/q × ${o.termQ} · debt $${f1(o.debt)}B`);
  }
  // Pay cash: the price, its contracts as one firm ledger entry, its debt as drawn debt (no cash), staff, antitrust.
  {
    const { s, r, d } = offer();
    const t = acquireTerms(s, r);
    const i = idx(E32, 'Pay cash');
    const pv = E32.choices[i].preview(s, d);
    const f = s.player.finance;
    const cash0 = f.cash;
    const scr0 = s.relations.scrutiny;
    const cap0 = s.player.staff.cap;
    const n0 = f.ledger.length;
    const heads = Math.round(r.core.staff.cap * 0.7) + Math.round(r.core.staff.saf * 0.7);
    const err = resolve(s, 'E32@t', i);
    const e = f.ledger.find((c) => c.kind === 'acquired');
    const debt = f.debts.find((x) => x.kind === 'assumed');
    const priceLine = pv.costs.find((c) => c.currency === 'cash')!;
    const obl = pv.exposure.filter((c) => c.currency === 'cash').map((c) => -c.amount);
    const staffLine = pv.gains.find((c) => c.currency === 'staffTime')!;
    check(!err && Math.abs(cash0 - f.cash - t.price) < 1e-6 && f.ledger.length === n0 + 1 && !!e && e.perQuarter === t.obligations.perQ && e.cancellableNoticeQ === null && Math.abs(e.endDay - s.time.day - 730) <= 1 && !!debt && debt.drawn === 3 && r.core.status === 'merged' && s.relations.scrutiny > scr0 && s.player.staff.cap > cap0, 'FIN3c paying cash: the price leaves cash, its contracts become one firm ledger entry over 8 quarters, its debt drawn debt (no cash moves), its staff join, antitrust scrutiny rises, the lab is gone', `${err ?? ''} cash −$${f1(cash0 - f.cash)}B · entry $${f1(e?.perQuarter ?? 0)}B/q to day ${e?.endDay} · debt $${f1(debt?.drawn ?? 0)}B at ${debt ? debtRatePct(s, debt).toFixed(1) : '?'}%`);
    check(Math.abs(priceLine.amount - Math.round(t.price * 10) / 10) < 1e-9 && Math.abs(obl[0] - Math.round(t.obligations.total * 10) / 10) < 1e-9 && Math.abs(obl[1] - 3) < 1e-9 && staffLine.amount === heads && pv.costs.some((c) => c.currency === 'scrutiny' && c.amount === 20), 'FIN3c the offer preview matches the effects: price, contracts and debt taken on, staff gained, antitrust scrutiny', `$${priceLine.amount}B · $${obl.join('B + $')}B · +${staffLine.amount} staff`);
  }
  // Pay in stock: new shares to its holders at your valuation; cash untouched.
  {
    const { s, r, d } = offer();
    const t = acquireTerms(s, r);
    const i = idx(E32, 'Pay in stock');
    const pv = E32.choices[i].preview(s, d);
    const f = s.player.finance;
    const cash0 = f.cash;
    const fin0 = f.ownership.fin;
    const founder0 = f.ownership.founder;
    const err = resolve(s, 'E32@t', i);
    const dil = pv.costs.find((c) => c.currency === 'dilution')!;
    check(!err && f.cash === cash0 && Math.abs(f.ownership.fin - (fin0 * (1 - t.stockFrac) + t.stockFrac)) < 1e-9 && Math.abs(f.ownership.founder - founder0 * (1 - t.stockFrac)) < 1e-9 && Math.abs(dil.amount - Math.round(t.stockFrac * 1000) / 10) < 1e-9 && f.ledger.some((c) => c.kind === 'acquired') && f.debts.some((x) => x.kind === 'assumed'), 'FIN3c paying in stock: its holders get price ÷ (your valuation + price) of the company (the preview\'s dilution), no cash moves, the obligations come all the same', `${(t.stockFrac * 100).toFixed(2)}% · preview ${dil.amount}%`);
  }
  // The board votes on the merger, judged on the company after the deal (can it carry the contracts and debt?).
  {
    const rich = offer();
    const tr = acquireTerms(rich.s, rich.r);
    const rng0 = JSON.stringify(rich.s.rng);
    const a = acquireVotes(rich.s, tr, 'cash');
    const b = acquireVotes(rich.s, tr, 'cash');
    const poor = offer({ cash: tr.price + 1, bc: 60 });
    const vPoor = acquireVotes(poor.s, acquireTerms(poor.s, poor.r), 'cash');
    const m = a[a.length - 1];
    const mp = vPoor[vPoor.length - 1];
    const need = (v: typeof m) => v.seats.find((x) => x.kind !== 'founder')!.parts.need;
    check(a.length === 1 && m.decision === 'merger' && m.passes && /after the deal/.test(m.needLabel) && JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(rich.s.rng) === rng0 && !mp.passes && need(mp) < need(m), 'FIN3c buying a rival needs the board\'s merger vote (deterministic), judged on the runway after the deal: flush it passes, spending the last cash on it fails', `rich ${m.yes}/${m.total} (${m.needLabel}) · poor ${mp.yes}/${mp.total} (${mp.needLabel})`);
    // A failed vote makes the choice unavailable (nothing booked); founder control can force it at −20, shown first.
    const no = offer({ bc: 0 });
    const ic = idx(E32, 'Pay cash');
    const why = E32.choices[ic].available!(no.s, no.d);
    const cash0 = no.s.player.finance.cash;
    const err = resolve(no.s, 'E32@t', ic);
    // Founder board at 25 with just the price in the bank: the vote fails (mood and a thin runway after the deal).
    const fo = offer({ bc: 25, preset: 'founder' });
    fo.s.player.finance.cash = acquireTerms(fo.s, fo.r).price + 1;
    const fv = shownVote(acquireVotes(fo.s, acquireTerms(fo.s, fo.r), 'cash'))!;
    const fpv = E32.choices[ic].preview(fo.s, fo.d);
    const bc0 = fo.s.player.board.confidence;
    const ferr = resolve(fo.s, 'E32@t', ic);
    check(typeof why === 'string' && /votes no on merger/.test(why) && typeof err === 'string' && no.s.player.finance.cash === cash0 && no.r.core.status === 'active' && !fv.passes && fv.canForce && fpv.costs.some((c) => c.currency === 'boardConf' && c.amount === VOTE.forceCost) && !ferr && fo.s.player.board.confidence <= bc0 - VOTE.forceCost + 1e-9 && fo.r.core.status === 'merged', 'FIN3c a failed merger vote blocks the choice (nothing booked); under founder control the choice forces it at the confidence cost its preview shows', `${why} · founder: ${fv.yes}/${fv.total}, confidence ${bc0.toFixed(0)} → ${fo.s.player.board.confidence.toFixed(0)}`);
  }
  // Sale of control: only stock past 50% (the trust, then the board); never cash. If it goes through you lose the company.
  {
    const { s, r, d } = offer({ preset: 'pbcTrust', rivalV: 1e6 });
    const t = acquireTerms(s, r);
    const vs = acquireVotes(s, t, 'stock');
    const cashVs = acquireVotes(s, t, 'cash');
    const ist = idx(E32, 'Pay in stock');
    const why = E32.choices[ist].available!(s, d);
    const pv = E32.choices[ist].preview(s, d);
    const small = offer({ preset: 'pbcTrust' });
    const smallVs = acquireVotes(small.s, acquireTerms(small.s, small.r), 'stock');
    check(t.stockFrac > 0.5 && vs[0].body === 'trust' && vs[0].decision === 'saleOfControl' && vs[1].decision === 'saleOfControl' && vs[1].body !== 'trust' && vs[vs.length - 1].decision === 'merger' && cashVs.every((v) => v.decision === 'merger') && smallVs.every((v) => v.decision === 'merger') && typeof why === 'string' && /trust votes no/.test(why) && pv.costs.some((c) => c.currency === 'freedom' && /ends the game/.test(String(c.target))), 'FIN3c a stock payment that hands its holders more than half the company is a sale of control: the trust votes first (PBC + trust), then the board; buying for cash, or for a small stake, is only a merger', `${(t.stockFrac * 100).toFixed(0)}%: ${vs.map((v) => `${v.body ?? 'board'} ${v.decision} ${v.yes}/${v.total}`).join(', ')} · ${why}`);
    // Founder board (votes forced if they fail): the lab's holders end up in control, the 'acquired' ending.
    const fo = offer({ preset: 'founder', bc: 90, rivalV: 1e6 });
    const err = resolve(fo.s, 'E32@t', ist);
    tick(fo.s);
    check(!err && fo.s.ending?.id === 'acquired', 'FIN3c a sale of control by stock that goes through ends the game (acquired)', `${err ?? ''} ending ${fo.s.ending?.id}`);
  }
  // Deals: a partner past 50% now meets the board's own sale-of-control vote after the trust's (FIN3b wired the trust).
  {
    const s = fx();
    s.player.board = initialBoard('pbcTrust');
    const partner = 'Gulf Sovereign Fund';
    const own = { founder: 0.2, mission: 0.2, fin: 0.11, strat: { [partner]: 0.49 }, public: 0 };
    s.player.finance.ownership = structuredClone(own);
    const t = partnerTerms(s, partner);
    const vs = dealVotes(s, t);
    const o = fx();
    o.player.board = initialBoard('nonprofitPBC');
    o.player.finance.ownership = structuredClone(own);
    const ov = dealVotes(o, t);
    check(!!t && vs[0]?.body === 'trust' && vs[1]?.decision === 'saleOfControl' && vs[1]?.body !== 'trust' && ov[0]?.decision === 'saleOfControl' && ov[0]?.body !== 'trust', 'FIN3c a deal that hands a partner control needs the board\'s sale-of-control vote (after the trust\'s, under PBC + trust)', vs.map((v) => `${v.body ?? 'board'} ${v.decision}`).join(', '));
  }
  // E22: the absorbed labs' obligations follow the same rule; accepting is a merger vote; no price.
  {
    const s = fx();
    s.player.board.confidence = 80;
    s.player.finance.cash = 2000;
    const priv = s.rivals.filter((x) => x.core.status === 'active' && x.finance.valuation > 0);
    for (const r of priv) r.finance.cash = -1;
    s.events.pending.push({ id: 'E22', instance: 'E22@t', day: s.time.day, deadline: s.time.day + 14, data: {}, crisis: true });
    const i = idx(E22, 'Accept');
    const v = E22.choices[i].vote!(s, {});
    const pv = E22.choices[i].preview(s, {});
    const want = priv.reduce((a, r) => a + rivalObligations(r).total, 0);
    const cash0 = s.player.finance.cash;
    const err = resolve(s, 'E22@t', i);
    const entries = s.player.finance.ledger.filter((c) => c.kind === 'acquired');
    const debt = s.player.finance.debts.filter((x) => x.kind === 'assumed').reduce((a, x) => a + x.drawn, 0);
    check(!!v && v.decision === 'merger' && !err && entries.length === priv.filter((r) => r.finance.commitments > 0).length && Math.abs(entries.reduce((a, c) => a + c.perQuarter * ACQUIRE.termQ, 0) - want) < 1e-6 && Math.abs(debt - priv.length) < 1e-9 && s.player.finance.cash === cash0 && Math.abs(-pv.exposure.filter((c) => c.currency === 'cash')[0].amount - Math.round(want * 10) / 10) < 1e-9, 'FIN3c E22 DPA consolidation: each private lab\'s contracts and debt are yours (parent-funded labs bring none), no price; accepting needs the board\'s merger vote, shown first', `${entries.length} contract entries $${f1(want)}B · debt $${f1(debt)}B · vote ${v?.yes}/${v?.total}`);
  }
}

// ───────────────────────────── FIN4a: partner offers (FINANCE-V3 §6.1–§6.3) ─────────────────────────────
{
  const fx = () => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  // The old flow and its templates are gone; one action signs a partner on the terms shown.
  check(!FINANCE_ACTIONS.some((a) => ['fin.seekPartner', 'fin.acceptDeal', 'fin.declineDeal'].includes(a.id)) && FINANCE_ACTIONS.some((a) => a.id === 'fin.partner') && !('vendorNote' in DEBT_TERMS), 'FIN4a one partner offer flow (fin.partner) replaces seek / accept / decline; no vendor-note debt');
  {
    // Leader start: the legacy Northwind stake (27%) is a holder above the 15% hyperscaler cap; no observer seats.
    const s = newGame(defaultSetupV2({ seed: 4 }));
    const nw = s.player.finance.deals.find((d) => d.partner === 'Northwind Cloud');
    const why = partnerBlocker(s, 'Northwind Cloud');
    const offers = partnerOffers(s);
    check(!!nw?.legacy && JSON.stringify(nw.strings) === '{}' && !!why && /capped at 15%/.test(why) && !s.player.board.seats.some((x) => /observer/.test(x.holder)) && offers.filter((o) => !o.blocked).map((o) => o.partner).join(',') === 'Azimuth,Silica Systems,Corvid Micro,Gulf Sovereign Fund', 'FIN4a leader start: Northwind is a legacy holder above the 15% cap (no observer seat, no strings); the four other partners offer terms', `${why} · open: ${offers.filter((o) => !o.blocked).map((o) => o.partner).join(', ')}`);
  }
  {
    // Hyperscaler on cloud: equity in three tranches; capacity priced on the expected cloud path less the firm discount
    // (10% at 6 years) and the partner's 10%; the take-or-pay schedule booked is the one shown; exclusivity and revenue
    // share; no board seat; the tranches carry their conditions and the cap.
    const s = fx();
    const ctx = makeCtx(s);
    const t = partnerTerms(s, 'Azimuth', { supply: 'cloud', exclusive: true });
    const sp = t.supply!;
    const pathOk = sp.prices.every((p, k) => near(p, expectedCloudPrice(s, 1 + k) * (1 - 0.1) * (1 - PARTNER_TERMS.hyperscaler.discount)));
    const seats0 = s.player.board.seats.length;
    const cash0 = s.player.finance.cash;
    // FIN4b: exclusivity is optional; this check signs it to keep testing the FIN4a string.
    const err = signPartner(s, ctx, 'Azimuth', { supply: 'cloud', exclusive: true });
    const d = dealWith(s, 'Azimuth');
    const led = s.player.finance.ledger.filter((c) => c.payee === 'Azimuth');
    const ledTotal = led.reduce((a, c) => a + c.perQuarter, 0);
    const tr = s.player.finance.tranches.filter((x) => x.partner === 'Azimuth');
    check(!err && pathOk && sp.partnerDiscount === PARTNER_TERMS.hyperscaler.discount && sp.firmDiscount === 0.1 && sp.prices[0] > sp.prices[sp.prices.length - 1] && near(ledTotal, sp.total) && led.length === sp.quarters && led.every((c) => c.cancellableNoticeQ === null) && near(s.player.finance.cash - cash0, t.equityNow, 1e-3) && tr.length === 2 && tr.every((x) => /^gw:/.test(x.condition ?? '') && x.stakeCap === 0.15 && x.deadline! > x.dueDay) && s.player.board.seats.length === seats0 && !!d?.strings.exclusivity && d.strings.revenueShare === 0.08,
      'FIN4a hyperscaler cloud: priced on the expected path less the firm (10%) and partner (10%) discounts, the same take-or-pay schedule booked, equity now + two GW tranches under the 15% cap, exclusivity and revenue share, no board seat',
      `${f1(sp.h100e / 1e6)}M H100e · $${f1(sp.first)}K → $${f1(sp.last)}K/H100e-yr · take-or-pay $${f1(sp.total)}B · equity $${f1(t.equityNow)}B + 2 × $${f1(tr[0]?.amount ?? 0)}B`);
    // The preview shows what signing books: cash now, the first payment, the tranches with their conditions.
    const s2 = fx();
    const pv = FINANCE_ACTIONS.find((a) => a.id === 'fin.partner')!.preview(s2, { partner: 'Azimuth', supply: 'cloud', exclusive: true });
    const t2 = partnerTerms(s2, 'Azimuth', { supply: 'cloud', exclusive: true });
    check(pv.gains.some((g) => g.currency === 'cash' && near(g.amount, t2.equityNow) && g.target === 'now') && pv.gains.filter((g) => g.currency === 'cash' && /tranche: if/.test(String(g.target))).length === 2 && pv.costs.some((c) => c.currency === 'cash' && near(-c.amount, t2.supply!.perQ[0]) && /−10% partner/.test(String(c.target))) && pv.costs.some((c) => c.currency === 'revenue') && pv.exposure.some((c) => /exclusivity: no deals with Northwind/.test(String(c.target))), 'FIN4a the offer\'s preview shows every term and string before signing (cash now, tranches and their conditions, the first take-or-pay payment with both discounts, revenue share, exclusivity)');
    // One deal per partner; its exclusivity blocks the competitor (kept as before FIN4a).
    check(/Already your partner/.test(partnerBlocker(s, 'Azimuth') ?? '') && /exclusivity blocks deals with Northwind/.test(partnerBlocker(s, 'Northwind Cloud') ?? ''), 'FIN4a one deal per partner; a hyperscaler\'s exclusivity blocks its competitor', `${partnerBlocker(s, 'Azimuth')} · ${partnerBlocker(s, 'Northwind Cloud')}`);
    // A tranche buys shares at that day's valuation (it booked cash with no shares before FIN4a), and only up to the cap.
    const own0 = s.player.finance.ownership.strat['Azimuth'] ?? 0;
    for (const x of tr) { x.dueDay = s.time.day; x.condition = 'gw:0'; }
    const dealEq = (x: GameStateV2) => Object.values(x.player.finance.ws3.years).reduce((a, y) => a + y.dealEquity, 0);
    const de0 = dealEq(s);
    const q0 = qOf(s);
    while (qOf(s) === q0) tick(s, { skip: ['endings'] });
    const own1 = s.player.finance.ownership.strat['Azimuth'] ?? 0;
    const landed = dealEq(s) - de0;
    const big = partnerEquityIn(s, makeCtx(s), 'Azimuth', 10 * s.player.finance.valuation, 'test tranche', 0.15);
    check(!s.player.finance.tranches.some((x) => x.partner === 'Azimuth') && own1 > own0 && near(landed, tr.reduce((a, x) => a + x.amount, 0), 1e-3) && near(s.player.finance.ownership.strat['Azimuth'], 0.15, 1e-6) && big < 10 * s.player.finance.valuation, 'FIN4a a partner tranche buys shares when it lands; a hyperscaler stops at 15% (the rest lapses)', `${f1(landed)}B landed · stake ${F1pct(own0)} → ${F1pct(own1)} → capped ${F1pct(s.player.finance.ownership.strat['Azimuth'])}`);
  }
  {
    // Custom chips (Azimuth): the H100e list path × 45% less the firm discount, a separate pool, the migration.
    const s = fx();
    const t = partnerTerms(s, 'Azimuth', { supply: 'asic' });
    const sp = t.supply!;
    const ok = sp.prices.every((p, k) => near(p, expectedListPrice(s.market, 2 + k) * PARTNER_TERMS.asic.costMult * (1 - 0.05)));
    const n0 = s.player.finance.ws3.reserved.length;
    const err = signPartner(s, makeCtx(s), 'Azimuth', { supply: 'asic' });
    const o = s.player.orders.find((x) => x.kind === 'lta' && x.ltaStartQ === sp.startQ && x.qty === sp.h100e); // FIN4r (L11): the deal no longer stores the order id
    check(!err && ok && sp.costMult === 0.45 && !!o && o.kind === 'lta' && JSON.stringify(o.prices) === JSON.stringify(sp.prices) && s.player.finance.ws3.reserved.length === n0 + 1 && (s.player.finance.ws3.asicMigrationUntil ?? 0) > s.time.day, 'FIN4a custom chips: 45% of the H100e list path less the firm discount, from a separate supply pool, research slows while migrating', `$${f1(sp.first)}K → $${f1(sp.last)}K per H100e · ${f1(sp.h100e / 1e3)}k a quarter`);
  }
  {
    // Chip vendor: $10B per GW deployed (gw: tranches), buy its chips on the path less firm and vendor discounts,
    // +0.5 allocation weight on every chip order while it supplies.
    const s = fx();
    const w0 = orderWeight(s, false, 0.3);
    const t = partnerTerms(s, 'Silica Systems');
    const sp = t.supply!;
    const ok = sp.prices.every((p, k) => near(p, expectedListPrice(s.market, 2 + k) * (1 - 0.05) * (1 - PARTNER_TERMS.chipVendor.discount)));
    const err = signPartner(s, makeCtx(s), 'Silica Systems');
    const d = dealWith(s, 'Silica Systems')!;
    const w1 = orderWeight(s, false, 0.3);
    const tr = s.player.finance.tranches.filter((x) => x.partner === 'Silica Systems');
    const later = structuredClone(s);
    later.time.day = (d.supply?.endDay ?? 0) + 1;
    check(!err && ok && t.equityNow === 0 && tr.length === 2 && tr.every((x) => x.amount === PARTNER_TERMS.chipVendor.perGW && /^gw:/.test(x.condition ?? '')) && near(w1 - w0, MARKET.rationW.strategic) && near(orderWeight(later, false, 0.3), w0, 1e-3), 'FIN4a chip vendor: $10B per GW deployed (gw tranches), its chips on the path less firm and vendor discounts, +0.5 allocation weight only while it supplies', `tranches ${tr.map((x) => x.condition).join(', ')} · weight ${f1(w0)} → ${f1(w1)}`);
  }
  {
    // Sovereign: a passive cheque with the political cost and no in-country site.
    const s = fx();
    const sites0 = s.player.sites.length;
    const scr0 = s.relations.scrutiny;
    const t = partnerTerms(s, 'Gulf Sovereign Fund');
    const err = signPartner(s, makeCtx(s), 'Gulf Sovereign Fund');
    const d = dealWith(s, 'Gulf Sovereign Fund');
    check(!err && s.player.sites.length === sites0 && s.relations.scrutiny > scr0 && !!t.politics && !t.supply && !!d && JSON.stringify(d.strings) === '{}', 'FIN4a sovereign: a passive equity cheque with its political cost (scrutiny, Congress, security demand) and no in-country site', `$${f1(t.equityNow)}B · scrutiny ${f1(scr0)} → ${f1(s.relations.scrutiny)}`);
  }
  {
    // Firm commitments above 3× revenue need the board: the deal's first-year take-or-pay is what it judges.
    const s = fx();
    s.player.finance.revenueRun = 0.5;
    const t = partnerTerms(s, 'Azimuth', { supply: 'cloud' });
    const vs = dealVotes(s, t);
    const rich = fx();
    rich.player.finance.revenueRun = 1e4;
    check(vs.some((v) => v.decision === 'commitments') && firstYearCommit(t) > 0 && !dealVotes(rich, partnerTerms(rich, 'Azimuth', { supply: 'cloud' })).length, 'FIN4a a partner\'s take-or-pay above 3× revenue goes to the board (none when revenue covers it)', `first year $${f1(firstYearCommit(t))}B`);
  }
  {
    // Rescue (distress only): cash for a 30% stake, two board seats and exclusivity; nothing else (no IP rights flag).
    const s = fx();
    s.player.finance.state = 'distress';
    s.player.board.confidence = 90;
    check(/Distress: only a rescue/.test(partnerBlocker(s, 'Azimuth') ?? ''), 'FIN4a in distress only a rescue is on offer');
    const seats0 = s.player.board.seats.length;
    // FIN5a: the stake is the top-up to 30%, or more when the rescuer's own cash already takes it past (a legacy holder
    // near 30%, at the day-400 fixture's lower story mark): what the offer's stake-after says.
    const rp = rescuePartner(s)!;
    const after = partnerStakeAfter(s, partnerTerms(s, rp, { rescue: true }));
    const err = act(s, 'fin.rescue', {});
    const d = s.player.finance.deals.find((x) => x.rescue);
    check(!err && !!d && d.strings.boardVotes === 2 && !!d.strings.exclusivity && Object.keys(d.strings).sort().join(',') === 'boardVotes,exclusivity' && near(s.player.finance.ownership.strat[d.partner], Math.max(PARTNER_TERMS.rescue.stake, after), 1e-6) && after >= PARTNER_TERMS.rescue.stake - 1e-9 && s.player.board.seats.length === seats0 + 1 && s.player.board.seats.some((x) => x.holder === d.partner && x.weight === 2), 'FIN4a rescue: a 30% stake, a board seat with two votes and exclusivity (no inert IP flag)', `${err ?? ''} ${d?.partner} ${F1pct(s.player.finance.ownership.strat[d?.partner ?? ''] ?? 0)}`);
  }
  {
    // Save migration 37 → 38: old template records become partner records; inert strings, offers, vendor notes and
    // observer seats go.
    const s = fx();
    const raw = JSON.parse(serialize(s));
    raw.schemaRev = 37;
    raw.player.finance.deals = [
      { id: 'DL-northwind0', template: 'hyperscalerEquity', partner: 'Northwind Cloud', day: -2000, strings: { observer: true, ipRights: true } },
      { id: 'DL9', template: 'hyperscalerEquity', partner: 'Azimuth', day: 100, strings: { observer: true, exclusivity: true, revenueShare: 0.08 } },
      { id: 'DL10', template: 'chipVendorEquity', partner: 'Silica Systems', day: 200, strings: {} },
      { id: 'DL11', template: 'sovereign', partner: 'Gulf Sovereign Fund', day: 300, strings: { inCountrySite: true } },
      { id: 'DL12', template: 'vendorFinance', partner: 'Corvid Micro', day: 300, strings: {} },
    ];
    raw.player.finance.ws3.offers = [{ id: 'OF1', template: 'sovereign', partner: 'Gulf Sovereign Fund' }];
    raw.player.finance.debts.push({ id: 'D-vn', kind: 'vendorNote', principal: 5, drawn: 5, spreadBp: 300, maturityDay: 2000, covenant: 'convertsAtIPO' });
    raw.player.board.seats.push({ kind: 'strategic', holder: 'Northwind Cloud (observer)', stance: [0, 0, 0, 0], weight: 0 });
    const m = deserialize(JSON.stringify(raw));
    const ds = m.player.finance.deals;
    const strs = JSON.stringify(ds.map((d) => d.strings));
    check(ds.length === 4 && ds[0].legacy === true && ds.map((d) => d.kind).join(',') === 'hyperscaler,hyperscaler,chipVendor,sovereign' && !/observer|ipRights|inCountrySite/.test(strs) && ds[1].strings.exclusivity === true && ds[1].strings.revenueShare === 0.08 && ds[2].supply?.kind === 'chips' && !('offers' in m.player.finance.ws3) && m.player.finance.debts.some((d) => d.id === 'D-vn' && d.kind === 'bond') && !m.player.board.seats.some((x) => /observer/.test(x.holder)), 'FIN4a save migration 37 → 38: template deals become partner records (legacy holder, kinds, exclusivity and revenue share kept; observer / IP / in-country strings, offers, vendor notes and observer seats gone)', strs);
  }
  {
    // The reference bot's partner deal: a hyperscaler on cloud (Azimuth on the leader start), priced on the path.
    const deals = ref.map((r) => r.s.player.finance.deals.find((d) => d.kind === 'hyperscaler' && !d.legacy && !d.rescue)).filter((d): d is NonNullable<typeof d> => !!d);
    const by = deals.reduce((a, d) => ({ ...a, [d.partner]: (a[d.partner] ?? 0) + 1 }), {} as Record<string, number>);
    const tot = median(deals.map((d) => d.supply?.total ?? 0));
    const eq = median(deals.map((d) => d.equityNow + d.equityLater));
    check(deals.length >= 0.8 * ref.length && deals.every((d) => d.supply?.kind === 'cloud' && (d.supply.partnerDiscount ?? 0) > 0), 'FIN4a RefBot signs one hyperscaler cloud deal (≥ 80% of seeds), on the expected path with the partner discount', `${deals.length}/${ref.length} · ${JSON.stringify(by)} · equity median $${f1(eq)}B · take-or-pay median $${f1(tot)}B · ${f1(median(deals.map((d) => d.supply?.h100e ?? 0)) / 1e6)}M H100e · $${f1(median(deals.map((d) => d.supply?.first ?? 0)))}K → $${f1(median(deals.map((d) => d.supply?.last ?? 0)))}K`);
  }
}

// ───────────────────────────── FIN4b: several partners, exclusivity, IP access (FINANCE-V3 §6.1 strings) ─────────────────────────────
{
  const fx = () => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const ST = PARTNER_TERMS.strings;
  /** day400 has no big-tech rival: give the hyperscalers in-house labs (Northwind the first, Azimuth the second). */
  const withLabs = (s: GameStateV2) => {
    s.rivals[1].archetype = 'bigtech';
    s.rivals[2].archetype = 'bigtech';
    return s;
  };
  {
    // At most 3 partners at once: a fourth is refused with the reason; a stake from before the start does not count; a
    // rescue is never refused by the cap.
    const s = fx();
    const ctx = makeCtx(s);
    const errs = ['Azimuth', 'Silica Systems', 'Gulf Sovereign Fund'].map((p) => signPartner(s, ctx, p));
    const why = partnerBlocker(s, 'Corvid Micro') ?? '';
    const legacy = s.player.finance.deals.some((d) => d.legacy && d.partner === 'Northwind Cloud');
    const err4 = act(s, 'fin.partner', { partner: 'Corvid Micro' });
    s.player.finance.state = 'distress';
    s.player.board.confidence = 90;
    const rescue = act(s, 'fin.rescue', {});
    check(errs.every((e) => !e) && partnersNow(s).length === 4 && /3 partners, the most at once/.test(why) && legacy && !!err4 && !rescue && s.player.finance.deals.some((d) => d.rescue),
      'FIN4b at most 3 partners at once (the legacy stake does not count); a fourth is refused with the reason; a rescue is not capped', `${why} · after the rescue: ${partnersNow(s).join(', ')}`);
  }
  {
    // Exclusivity is optional and pays: off by default; on, +25% of the equity (hyperscaler, under the stake cap) and of
    // the money per GW (vendor); the extra money buys no extra capacity; it blocks the competitor for good; a partner
    // whose competitor is already your partner does not offer it.
    const s = fx();
    const open = partnerTerms(s, 'Azimuth');
    const ex = partnerTerms(s, 'Azimuth', { exclusive: true });
    const v0 = partnerTerms(s, 'Silica Systems');
    const v1 = partnerTerms(s, 'Silica Systems', { exclusive: true });
    const sumV = (t: ReturnType<typeof partnerTerms>) => t.tranches.reduce((a, x) => a + x.amount, 0);
    check(!open.strings.exclusivity && !!ex.strings.exclusivity && near(termsEquity(ex), termsEquity(open) * (1 + ST.exclusiveBump)) && near(ex.options.exclusive.bump, termsEquity(ex) - termsEquity(open)) && near(ex.supply!.h100e, open.supply!.h100e) && near(sumV(v1), sumV(v0) * (1 + ST.exclusiveBump)) && near(v0.options.exclusive.bump, sumV(v1) - sumV(v0)) && !!partnerTerms(s, 'Gulf Sovereign Fund').options.exclusive.blocked,
      'FIN4b exclusivity is optional: +25% of the money (hyperscaler equity, vendor money per GW), shown as the option\'s bump, no extra capacity; a sovereign has none to offer', `Azimuth $${f1(termsEquity(open))}B → $${f1(termsEquity(ex))}B · Silica $${f1(sumV(v0))}B → $${f1(sumV(v1))}B`);
    const ctx = makeCtx(s);
    signPartner(s, ctx, 'Silica Systems');
    const corvid = partnerTerms(s, 'Corvid Micro', { exclusive: true });
    signPartner(s, ctx, 'Azimuth', { exclusive: true });
    check(/You already partner with Silica Systems/.test(corvid.options.exclusive.blocked ?? '') && !corvid.strings.exclusivity && /Azimuth's exclusivity blocks deals with Northwind/.test(partnerBlocker(s, 'Northwind Cloud') ?? '') && !partnerBlocker(s, 'Corvid Micro') && partnerCosts(s).find((c) => c.partner === 'Azimuth')?.blocks.join(',') === 'Northwind Cloud',
      'FIN4b several shallow partners stay possible (Silica open, Corvid still offers terms but not exclusivity); an exclusive partner blocks its competitor, shown in its costs', `${corvid.options.exclusive.blocked}`);
  }
  {
    // IP access: only from a hyperscaler with an in-house lab (a big-tech rival); +20% of the equity; the preview says
    // what it costs in plain words; signed, the lab gains 10% a year of the capability gap as know-how (labDaily).
    const plain = fx();
    check(!!partnerTerms(plain, 'Azimuth', { ipAccess: true }).options.ipAccess.blocked && !partnerTerms(plain, 'Azimuth', { ipAccess: true }).strings.ipAccess && !!partnerTerms(plain, 'Silica Systems').options.ipAccess.blocked, 'FIN4b no IP access without an affiliated lab (no big-tech rival), nor from a chip vendor');
    const s = withLabs(fx());
    const lab = affiliatedLab(s, 'Azimuth')!;
    const t0 = partnerTerms(s, 'Azimuth');
    const t = partnerTerms(s, 'Azimuth', { ipAccess: true });
    const pv = FINANCE_ACTIONS.find((a) => a.id === 'fin.partner')!.preview(s, { partner: 'Azimuth', ipAccess: true });
    const line = pv.costs.find((c) => c.currency === 'leadDays');
    check(lab.core.id === s.rivals[2].core.id && affiliatedLab(s, 'Northwind Cloud')?.core.id === s.rivals[1].core.id && t.strings.ipAccess?.lab === lab.core.id && near(termsEquity(t), termsEquity(t0) * (1 + ST.ipBump)) && near(t.options.ipAccess.bump, termsEquity(t) - termsEquity(t0)) && !!line && new RegExp(`${lab.core.name} \\(Azimuth's lab\\) licenses your models and closes ~10% of your lead a year`).test(String(line.target)),
      'FIN4b IP access (a hyperscaler with an in-house lab): +20% of the equity; the preview says the lab closes ~10% of your lead a year, in days at your estimated lead', String(line?.target));
    const a = structuredClone(s);
    const b = structuredClone(s);
    signPartner(a, makeCtx(a), 'Azimuth', { ipAccess: true });
    signPartner(b, makeCtx(b), 'Azimuth');
    const want = ipAccessDaily(a, lab.core.id);
    const gap = licensedGap(a, lab.core.id);
    const pa = (x: GameStateV2) => recipeOf(x, x.rivals.find((r) => r.core.id === lab.core.id)!); // FINM: the recipe (OOM), was know-how pa
    const d0 = pa(a) - pa(b);
    tick(a, { skip: ['endings'] });
    tick(b, { skip: ['endings'] });
    const got = pa(a) - pa(b) - d0;
    check(gap > 0 && near(want, (ST.ipCloseYr * gap) / 365) && ipAccessDaily(b, lab.core.id) === 0 && near(got, want, 0.05) && partnerCosts(a)[0].ip?.lab === lab.core.id,
      'FIN4b a signed IP access closes 10% a year of the gap: the affiliated lab gains 0.1 × gap (G) / 365 in its recipe a day (through the rivals\' daily step); none without it', `gap ${gap.toFixed(3)} · ${want.toExponential(2)}/day · one tick ${got.toExponential(2)}`);
  }
  {
    // PBC + trust (§7.2): IP access that would license a capability-threshold model needs the trust's transfer vote
    // (not forceable): a no stops the deal with IP access; without IP access it signs. A rescue's IP access is not
    // voted: its licence stops below the thresholds.
    const s = withLabs(fx());
    s.player.board = initialBoard('pbcTrust');
    const best = licensedModel(s)!;
    const t = partnerTerms(s, 'Azimuth', { ipAccess: true });
    const vs = dealVotes(s, t);
    const v = vs.find((x) => x.decision === 'transferModel');
    const cash0 = s.player.finance.cash;
    const err = act(s, 'fin.partner', { partner: 'Azimuth', ipAccess: true, force: true });
    const nothing = s.player.finance.cash === cash0 && !dealWith(s, 'Azimuth');
    const ok2 = !act(s, 'fin.partner', { partner: 'Azimuth' });
    s.player.finance.state = 'distress';
    const rt = partnerTerms(s, 'Northwind Cloud', { rescue: true });
    check(capabilityThresholds(best).length > 0 && !!v && v.body === 'trust' && !v.passes && !v.canForce && vs[0] === v && !!err && nothing && ok2 && !!rt.strings.ipAccess && !rt.strings.ipAccess.trust && !dealVotes(s, rt).some((x) => x.decision === 'transferModel') && licensedGap(s, rt.strings.ipAccess.lab, true) <= licensedGap(s, rt.strings.ipAccess.lab),
      'FIN4b PBC + trust: IP access to a capability-threshold model goes to the trust\'s transfer vote (first, not forceable); its no stops the deal, which signs without IP access; a rescue\'s licence stops below the thresholds', `${best.name}: ${capabilityThresholds(best).join(', ')} · trust ${v?.yes}/${v?.total} · ${err}`);
  }
  {
    // A strategic partner's guarantee opens leases below B: the B rate + 3 points, named on the lease option; a stake from
    // before the start guarantees nothing.
    const s = fx();
    s.player.finance.rating = 'closed';
    const none = leaseRate(s);
    const why = leaseAvailable(s);
    signPartner(s, makeCtx(s), 'Gulf Sovereign Fund');
    const sov = leaseRate(s);
    signPartner(s, makeCtx(s), 'Azimuth');
    const r = leaseRate(s);
    const lease = payOptions(s, 10, 'site').find((o) => o.id === 'lease')!;
    check(none === undefined && /partner's guarantee/.test(String(why)) && sov === undefined && near(r ?? 0, (CAPEX_LEASE.rate.B ?? 0) + CAPEX_LEASE.guaranteePremium) && !lease.blocked && lease.guarantor === 'Azimuth' && /guaranteed by Azimuth/.test(lease.note) && leaseGuarantor(s) === 'Azimuth',
      'FIN4b below rating B a running hyperscaler or chip-vendor partner guarantees leases at the B rate + 3 points, named on the lease option (a sovereign cheque or a legacy stake does not)', `${F1pct(r ?? 0)} · ${lease.note}`);
  }
  {
    // A hyperscaler anchoring a round stays at or under its 15% cap: it is offered as an anchor only while the cap leaves
    // room for 40% of the round, and its shares in the round stop at the cap (financial investors take the rest).
    const s = fx();
    const offered0 = anchorPartners(s).includes('Azimuth');
    s.player.finance.ownership.strat['Azimuth'] = 0.149;
    const offered1 = anchorPartners(s).includes('Azimuth');
    const V = s.player.finance.valuation;
    const fin0 = s.player.finance.ownership.fin;
    bookRound(s, makeCtx(s), 0.15 * V, V, { anchor: 'Azimuth' });
    const dil = 0.15 / 1.15;
    check(offered0 && !offered1 && s.player.finance.ownership.strat['Azimuth'] <= 0.15 + 1e-9 && s.player.finance.ownership.fin - fin0 * (1 - dil) > 0.9 * dil,
      'FIN4b a hyperscaler anchors a round only within its 15% cap: not offered without room for 40% of the round; its shares stop at 15%', `stake after ${F1pct(s.player.finance.ownership.strat['Azimuth'])}`);
  }
  {
    // The reference bot: one hyperscaler deal, exclusive (one deep partner), no IP access.
    const deals = ref.map((r) => r.s.player.finance.deals.find((d) => d.kind === 'hyperscaler' && !d.legacy && !d.rescue)).filter((d): d is NonNullable<typeof d> => !!d);
    const n = ref.map((r) => partnersNow(r.s).length);
    check(deals.length >= 0.8 * ref.length && deals.every((d) => d.strings.exclusivity && !d.strings.ipAccess) && n.every((x) => x <= ST.maxPartners),
      'FIN4b RefBot takes one hyperscaler deal with exclusivity and without IP access; never more than 3 partners', `${deals.length}/${ref.length} · equity median $${f1(median(deals.map((d) => d.equityNow + d.equityLater)))}B · partners ${JSON.stringify(n)}`);
  }
}

// ───────────────────────────── FIN5c: big-tech division budget (FINANCE-V3 §13) ─────────────────────────────
{
  const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const bigtech = (seed = 5) => newGame(defaultSetupV2({ seed, world: 'ai2027', alignment: 'medium', tutorial: false, start: 'bigtech' }));
  /** Tick (no bot) to a day; the endings system is skipped so the run always gets there. */
  const runTo = (s: GameStateV2, day: number) => { while (s.time.day < day) { for (const p of [...s.events.pending]) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0); tick(s, { skip: ['endings'] }); } };
  const causes = (s: GameStateV2, src: string) => (s.causes.byKey['board.confidence'] ?? []).filter((e) => e.source === src);
  {
    // Day 0: budget year 0 at the parent's plan, its payment in the starting cash, three parent goals (a third each) due
    // at the first review, no valuation.
    const s = bigtech();
    const d = s.player.finance.ws3.division;
    const goals = livePromises(s).filter((p) => p.by === 'parent');
    const review = dayOfDate(START, '2026-07-01');
    check(!!d && d.year === 0 && d.budget === parentBudgetYear(0) && d.factor === 1 && near(d.paid, 4) && near(d.carryIn, 4) && goals.length === 3 && goals.every((g) => g.goalWeight === 1 / 3 && g.deadline === review && g.pitch === 'base') && goals.map((g) => g.type).join(',') === 'capability,scale,adoption' && s.player.finance.valuation === 0, 'FIN5c day 0: budget year 0 at the plan ($16B, its first payment in the cash), three parent goals on the trend at the base pitch (a third each) due at the 1 Jul 2026 review; no valuation', JSON.stringify({ budget: d?.budget, paid: d?.paid, carryIn: d?.carryIn, goals: goals.map((g) => `${g.type} ${f1(g.start)}→${f1(g.target)}`) }));
    check(budgetFactor(0) === DIVISION.floor && budgetFactor(30) === 0.75 && budgetFactor(DIVISION.fullAt) === 1 && budgetFactor(100) === 1, 'FIN5c budget rule: plan × min(100%, 50% + confidence ÷ 120) (half at 0, three quarters at 30, full from 60)');
    // Payments: this year at the set budget, later years at the plan × today's factor (the projection uses them).
    const q0 = qOf(s);
    s.player.board.confidence = 30;
    const flows = runwayOf(s);
    check(near(parentPaymentQ(s, q0 + 1), d!.budget / 4) && near(parentPaymentQ(s, 4), parentBudgetYear(1) * 0.75 / 4) && flows.parts.funding < 0, 'FIN5c payments: a quarter of this year\'s budget; later years at the plan × the factor at today\'s confidence (an estimate in the projection and the schedule)', `Q1 ${f1(parentPaymentQ(s, q0 + 1))} · year 1 at confidence 30: ${f1(parentPaymentQ(s, 4))}/q`);
    // No runway verdict: a deep overspend leaves the state healthy, with no distress source or alert; no ouster vote.
    s.player.finance.cash = -40;
    const ctx = makeCtx(s);
    updateRunwayState(s, ctx);
    s.player.board.confidence = 5;
    s.player.finance.ws3.boardWarnDay = -200;
    const v = divisionView(s)!;
    check(s.player.finance.state === 'healthy' && !causes(s, 'financial distress').length && !ousterVote(s).live && ousterVote(s).seats.length === 0 && criticsAvailable(s) !== true, 'FIN5c a division has no runway verdict (healthy at −$40B, no distress source) and no ouster vote or critics\' seat: low confidence costs budget, never the game', `state ${s.player.finance.state} · ${criticsAvailable(s)}`);
    check(v.status === 'over' && near(v.over, 40 + d!.paid - d!.budget) && near(v.spent, d!.carryIn + d!.paid + 40) && v.coverConf === -DIVISION.overConf * moodWeight(s, 'setbacks') && v.next.factor === budgetFactor(5), 'FIN5c readout: spent so far = carried in + paid − cash; over budget = spent past this year\'s budget and savings ("over budget by $X; parent covers"); the confidence it would cost at the review and next year\'s budget at today\'s confidence', `spent ${f1(v.spent)} · over ${f1(v.over)} · cost ${f1(v.coverConf)} · next ${f1(v.next.budget)}`);
    s.player.finance.cash = 20;
    const w = divisionView(s)!;
    check(w.status === 'within' && w.over === 0 && w.projectedEnd > 0 && budgetRoom(s) < w.projectedEnd, 'FIN5c readout within budget: projected cash at the review is left over; the bots\' budget room keeps a quarter\'s payment of margin', `projected ${f1(w.projectedEnd)} · room ${f1(budgetRoom(s))}`);
  }
  {
    // The first review (1 Jul 2026), an idle division: the goals are judged (parent confidence only, no credibility), the
    // overspend the parent is still covering costs confidence and is not written off, the budget follows the rule, and
    // the new goals are set. Overspend: cash −$10B on the eve of the review.
    const s = bigtech();
    const review = dayOfDate(START, '2026-07-01');
    runTo(s, review - 1);
    const cred0 = s.player.finance.credibility;
    s.player.finance.cash = -10;
    const d0 = s.player.finance.ws3.division!;
    const budget0 = d0.budget;
    runTo(s, review);
    const d = s.player.finance.ws3.division!;
    const judged = (s.player.finance.promises ?? []).filter((p) => p.by === 'parent' && p.result);
    const goalSum = [...causes(s, 'goal met'), ...causes(s, 'goal missed')].filter((e) => e.day === review).reduce((a, e) => a + e.delta, 0);
    const over = causes(s, 'over budget').filter((e) => e.day === review);
    const rv = d.reviews[d.reviews.length - 1];
    const newGoals = livePromises(s).filter((p) => p.by === 'parent');
    check(judged.length === 3 && judged.every((p) => p.result!.cred === 0 && p.result!.day === review) && s.player.finance.credibility === cred0 && near(goalSum, judged.reduce((a, p) => a + p.result!.board, 0)) && judged.every((p) => Math.abs(p.result!.board) <= 10 + 1e-9), 'FIN5c review: the year\'s three goals are judged like promises (±30 × a third on parent confidence); no investor credibility moves', judged.map((p) => `${p.type} ${p.result!.outcome}`).join(', '));
    check(!!rv && rv.year === 0 && rv.over >= 10 && rv.over < 10.6 && over.length === 1 && near(over[0].delta, -DIVISION.overConf * (rv.over / budget0) * moodWeight(s, 'setbacks')) && near(d.carryIn, -rv.over) && near(s.player.finance.cash, d.carryIn + d.budget / 4, 0.01), 'FIN5c review: the overspend the parent is still covering costs −30 × overspend ÷ budget; it is not written off (the new year starts with the advance, repaid from its payments); cash −$10B on the eve plus that day\'s payroll', `over ${f1(rv?.over ?? 0)} · ${f1(over[0]?.delta ?? 0)} confidence · cash after the first payment ${f1(s.player.finance.cash)}`);
    check(d.year === 1 && near(d.plan, parentBudgetYear(1)) && near(d.budget, d.plan * budgetFactor(d.confidence)) && d.confidence < 70 && newGoals.length >= 2 && newGoals.every((g) => g.closeDay === review && g.deadline === dayOfDate(START, '2027-07-01')), 'FIN5c review: this year\'s budget = the plan × the factor at the confidence after the review (missed goals and overspend cut it); new goals due at the next review', `budget ${f1(d.budget)} = ${f1(d.plan)} × ${F1pct(d.factor)} at ${f1(d.confidence)} · goals ${newGoals.map((g) => g.type).join(', ')}`);
    check(!causes(s, 'behind a rival').length && s.player.finance.state === 'healthy', 'FIN5c the parent judges capability through its goals: no quarterly "behind a rival" source for a division; never in distress');
  }
  {
    // Save migration 38 → 39: a big-tech save gets its budget year (this year at the plan); distress is lifted.
    const s = bigtech();
    runTo(s, 200);
    const raw = JSON.parse(serialize(s));
    raw.schemaRev = 38;
    delete raw.player.finance.ws3.division;
    raw.player.finance.state = 'distress';
    raw.player.finance.promises = [];
    const m = deserialize(JSON.stringify(raw));
    const d = m.player.finance.ws3.division;
    check(!!d && d.year === 0 && d.budget === parentBudgetYear(0) && near(d.paid, 12) && m.player.finance.state === 'healthy', 'FIN5c save migration 38 → 39: a division gets this year\'s budget at the plan (paid so far from the schedule), no distress; goals start at the next review', JSON.stringify(d && { year: d.year, budget: d.budget, paid: d.paid, carryIn: f1(d.carryIn) }));
  }
  {
    // The mixed bot as a division head (one seed, a year and a half): it keeps to the budget room, the state is never
    // distress, the first review judges three goals and sets the budget by the rule.
    const s = bigtech(30000);
    let distress = 0;
    while (s.time.day < 550 && !s.ending) {
      for (const p of [...s.events.pending]) if (resolve(s, p.instance, mixedBot.decide(s, p))) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
      mixedBot.act(s, engine);
      tick(s);
      if (s.player.finance.state !== 'healthy') distress++;
    }
    const d = s.player.finance.ws3.division!;
    const rv = d.reviews[0];
    check(distress === 0 && !!rv && rv.goals.met + rv.goals.near + rv.goals.missed === 3 && near(d.budget, d.plan * budgetFactor(d.confidence)), 'FIN5c mixed bot as a division head: never tight or in distress; the first review judges three goals and sets the budget by the rule', `year 0: spent $${f1(rv?.spent ?? 0)}B of $${f1(rv?.budget ?? 0)}B, over $${f1(rv?.over ?? 0)}B (${f1(rv?.overConf ?? 0)}), goals ${JSON.stringify(rv?.goals)} · year 1 budget $${f1(d.budget)}B at confidence ${f1(d.confidence)}`);
  }
}

// ───────────────────────────── FIN4r: review fixes (FINANCE-BUILD FIN4r) ─────────────────────────────
{
  const fx = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  {
    // H1: renegotiate on path-priced contracts (one ledger entry per quarter): 35% of the next 4 quarters' firm payments
    // deferred to each contract's end, no stretched or overlapping entries; the preview is what is deferred.
    const s = fx();
    act(s, 'cmp.rentCompute', { h100e: 1e6, term: 16, firm: true });
    act(s, 'cmp.buyChips', { term: 8, qty: 2e5 });
    s.player.finance.state = 'distress';
    const q1 = qOf(s) + 1;
    const due = (x: GameStateV2, from: number, n: number) => Array.from({ length: n }, (_, k) => ledgerDue(x, from + k, true)).reduce((a, b) => a + b, 0);
    const win0 = due(s, q1, RENEGOTIATE.quarters);
    const all0 = due(s, qOf(s), 80);
    const pv = FINANCE_ACTIONS.find((a) => a.id === 'fin.renegotiate')!.preview(s, {});
    const shown = pv.gains.find((g) => g.currency === 'cash')?.amount ?? 0;
    const err = act(s, 'fin.renegotiate', {});
    const win1 = due(s, q1, RENEGOTIATE.quarters);
    const all1 = due(s, qOf(s), 80);
    const tallied = Object.values(s.player.finance.ws3.years).reduce((a, y) => a + (y.deferredCompute ?? 0) + (y.deferredChips ?? 0), 0);
    const by = new Map<string, any[]>();
    for (const c of s.player.finance.ledger) by.set(c.contract ?? c.id, [...(by.get(c.contract ?? c.id) ?? []), c]);
    let overlaps = 0;
    for (const cs of by.values()) {
      const xs = cs.slice().sort((a: any, b: any) => (a.startDay ?? -1e9) - (b.startDay ?? -1e9));
      for (let i = 1; i < xs.length; i++) if ((xs[i].startDay ?? -1e9) < xs[i - 1].endDay) overlaps++;
    }
    // The cash the monthly ledger actually pays over the window (ticked) is what ledgerDue shows.
    const t = deserialize(serialize(s));
    while (t.time.day < dayOfQuarter(t.time.startDate, q1) - 1) tick(t, { skip: ['endings', 'director'] });
    const paid0 = -(totalFlows(t).commitments ?? 0);
    while (t.time.day < dayOfQuarter(t.time.startDate, q1 + RENEGOTIATE.quarters) - 1) tick(t, { skip: ['endings', 'director'] });
    const paid = -(totalFlows(t).commitments ?? 0) - paid0;
    check(!err && near(shown, RENEGOTIATE.defer * win0) && near(win1, (1 - RENEGOTIATE.defer) * win0) && near(all1, all0) && overlaps === 0 && near(paid, win1, 1e-6) && near(tallied, shown), 'FIN4r H1 renegotiate defers 35% of the next 4 quarters\' firm payments to each contract\'s end (preview = deferred = the year tallies; nothing stretched, overlapping or forgiven; the cash paid matches)', `deferred $${f1(shown)}B of $${f1(win0)}B · window paid $${f1(paid)}B = due $${f1(win1)}B · all payments $${f1(all0)}B → $${f1(all1)}B · overlaps ${overlaps}`);
    // ledgerDue counts the months an entry pays (an entry across two quarters was counted in full in both).
    const u = fx();
    const m = monthFirsts(u, qOf(u) + 1);
    const m2 = monthFirsts(u, qOf(u) + 2);
    addLedger(u, { payee: 'test', kind: 'cloud', perQuarter: 3, startDay: m[1], endDay: m2[1], cancellableNoticeQ: null, penalty: 0 });
    const base = (x: GameStateV2, q: number) => ledgerDue(x, q, true);
    const v = fx();
    const d1 = base(u, qOf(u) + 1) - base(v, qOf(v) + 1);
    const d2 = base(u, qOf(u) + 2) - base(v, qOf(v) + 2);
    check(near(d1, 2) && near(d2, 1), 'FIN4r H1 ledgerDue counts an entry by the months it pays (one spanning two quarters is not counted in full in both)', `$3B a quarter from mid-quarter: ${f1(d1)} + ${f1(d2)}`);
  }
  {
    // H2: a tiny round's promise weighs little: weight = amount ÷ max(raised in the year, a typical round at the close);
    // stacking stays weight-neutral for normal rounds.
    const s = fx();
    s.player.board = initialBoard('pbcTrust');
    s.player.finance.state = 'healthy';
    act(s, 'fin.raise', { ask: 0.1, type: 'scale', pitch: 'base' });
    const pre = s.player.finance.ws3.pendingRound!.preMoney;
    while (s.player.finance.ws3.pendingRound) tick(s, { skip: ['endings', 'director'] });
    const p = s.player.finance.promises[s.player.finance.promises.length - 1];
    const w = promiseWeight(s, p);
    const r = s.player.finance.rounds[s.player.finance.rounds.length - 1];
    // Four equal ceiling-sized rounds in a year: ≈ 25% each; one alone: 100%.
    const x = fx();
    const A = typicalRound(1000, dMax(false, false));
    x.player.finance.rounds = [0, 1, 2, 3].map((k) => ({ day: x.time.day - 360 + 91 * k, amount: A, postMoney: 1000 + A, dilution: 0.08, down: false }));
    const ps = x.player.finance.rounds.map((rr, k) => ({ id: `P${k}`, type: 'scale' as const, pitch: 'base' as const, start: 1, target: 2, amount: A, closeDay: rr.day, deadline: rr.day + 365, typical: A }));
    const ws = ps.map((pp) => promiseWeight(x, pp));
    const lone = promiseWeight({ ...x, player: { ...x.player, finance: { ...x.player.finance, rounds: [x.player.finance.rounds[0]] } } }, ps[0]);
    check(near(p.typical ?? 0, typicalRound(r.postMoney - r.amount, dMax(false, false))) && w < 0.01 && near(ws[0], 0.25) && near(lone, 1), 'FIN4r H2 a promise weighs its round ÷ max(the year\'s rounds, a typical round at the close): a $0.1B round barely counts; four ceiling-sized rounds 25% each, one 100%', `$0.1B at $${f1(pre)}B pre: typical $${f1(p.typical ?? 0)}B → weight ${(w * 100).toFixed(2)}% · stacked ${ws.map((y: number) => `${Math.round(y * 100)}%`).join('/')} · lone ${Math.round(lone * 100)}%`);
  }
  {
    // H3: a round of $20B or more pays half at the close; every preview shows the tranche; a lapse cancels the unpaid
    // shares (as if half the round had been raised at the same price); the IPO and the distress down round pay in full.
    const s = fx();
    s.player.board = initialBoard('pbcTrust');
    s.player.finance.state = 'healthy';
    const pv = FINANCE_ACTIONS.find((a) => a.id === 'fin.raise')!.preview(s, { ask: 40, type: 'scale', pitch: 'base' });
    const cash = pv.gains.filter((g) => g.currency === 'cash');
    const close = dayOfQuarter(s.time.startDate, qOf(s) + 1);
    const sp = roundSplit(s, 40, { closeDay: close });
    const ipo = FINANCE_ACTIONS.find((a) => a.id === 'fin.ipo')!.preview(s, { ask: 40 }).gains.filter((g) => g.currency === 'cash');
    check(cash.length === 2 && near(cash[0].amount, 20) && near(cash[1].amount, 20) && /tranche: if revenue run-rate reaches/.test(String(cash[1].target)) && near(cash[1].lagDays ?? 0, sp.tranche!.dueDay - s.time.day) && ipo.length === 1 && near(ipo[0].amount, 40), 'FIN4r H3 the raise preview shows cash at the close and the conditional tranche (amount, condition, deadline); the IPO pays in full', cash.map((c) => `$${f1(c.amount)}B in ${c.lagDays}d ${c.target}`).join(' · '));
    // The booking matches the preview; a lapse cancels the unpaid shares.
    const a = fx();
    a.player.board = initialBoard('pbcTrust');
    const P = a.player.finance.valuation;
    const now = bookRound(a, makeCtx(a), 40, P);
    const t = a.player.finance.tranches[a.player.finance.tranches.length - 1];
    const sp2 = roundSplit(fx(), 40);
    t.condition = 'revenue:1e9';
    t.deadline = dayOfQuarter(a.time.startDate, qOf(a) + 1);
    while (a.time.day < t.deadline) tick(a, { skip: ['endings', 'director', 'capitalQ'] });
    capitalQSystem.run(a, makeCtx(a));
    const b = fx();
    b.player.board = initialBoard('pbcTrust');
    bookRound(b, makeCtx(b), 20, P, { full: true });
    const o = a.player.finance.ownership;
    const ob = b.player.finance.ownership;
    const same = (['founder', 'mission', 'fin', 'public'] as const).every((k) => near(o[k], ob[k], 1e-9)) && near(o.strat['Northwind Cloud'], ob.strat['Northwind Cloud'], 1e-9);
    check(near(now, 20) && near(t.amount, sp2.tranche!.amount) && !a.player.finance.tranches.includes(t) && same, 'FIN4r H3 a lapsed round tranche cancels its shares pro rata: the cap table is that of the half actually raised at the same price', `founder ${(o.founder * 100).toFixed(2)}% vs ${(ob.founder * 100).toFixed(2)}% · financial ${(o.fin * 100).toFixed(2)}% vs ${(ob.fin * 100).toFixed(2)}%`);
    // The distress down round: in full now, no tranche, whatever its size.
    const d = fx();
    addCloud(d, makeCtx(d), 1.2e7, 8, 'Vantage Neocloud', { startQ: 0 }); // a burn large enough for a $20B+ down round
    d.player.finance.state = 'distress';
    const n0 = d.player.finance.tranches.length;
    const c0 = d.player.finance.cash;
    const dv = FINANCE_ACTIONS.find((a) => a.id === 'fin.downRound')!.preview(d, {});
    const errD = act(d, 'fin.downRound', {});
    check(!errD && dv.gains[0].amount >= LARGE_ROUND.min && d.player.finance.tranches.length === n0 && near(d.player.finance.cash - c0, dv.gains[0].amount), 'FIN4r H3 the distress down round pays in full at the close (no tranche)', `$${f1(d.player.finance.cash - c0)}B`);
  }
  {
    // M1: 'gw:' tranche conditions count compute in your own sites, not the partner's (or any) rented cloud.
    const s = fx();
    const own = gwOwned(s);
    addCloud(s, makeCtx(s), 3e6, 8, 'Azimuth', { startQ: 0 });
    s.player.computeOnline += 3e6;
    const total = (s.player.computeOnline * s.power.kWPerH100e) / 1e6;
    const t = partnerTerms(s, 'Azimuth');
    check(!trancheConditionMet(s, `gw:${(own + 0.5).toFixed(1)}`) && trancheConditionMet(s, `gw:${(own - 0.05).toFixed(2)}`) && total > own + 0.5 && t.tranches[0].condition === `gw:${(own + 0.5).toFixed(1)}`, 'FIN4r M1 gw: tranche conditions count GW online in your own sites (rented cloud does not meet them)', `owned ${own.toFixed(2)} GW, with cloud ${total.toFixed(2)} GW · condition ${t.tranches[0].condition}`);
  }
  {
    // M2: Buy chips paid by chip loan meets the debt vote, by lease the commitments vote (only above 3× revenue).
    const s = fx();
    s.player.finance.revenueRun = 2;
    s.player.finance.debts.push({ id: 'D-t', kind: 'bond', principal: 5, drawn: 5, spreadBp: 300, maturityDay: s.time.day + 900 });
    const v = (p: Record<string, string | number | boolean>) => FINANCE_ACTIONS.find((a) => a.id === 'cmp.buyChips')!.vote!(s, p);
    const loan = v({ term: 1, qty: 5e5, pay: 'loan' });
    const lease = v({ term: 1, qty: 5e5, pay: 'lease' });
    const cash = v({ term: 1, qty: 5e5 });
    const rich = fx();
    const loanRich = FINANCE_ACTIONS.find((a) => a.id === 'cmp.buyChips')!.vote!(rich, { term: 1, qty: 5e5, pay: 'loan' });
    check(loan?.decision === 'debt' && lease?.decision === 'commitments' && !cash && !loanRich, 'FIN4r M2 Buy chips on a chip loan needs the debt vote and on a lease the commitments vote (above 3× revenue only); cash needs none', `loan ${loan?.decision} · lease ${lease?.decision} · cash ${cash?.decision ?? 'none'} · loan at $${f1(rich.player.finance.revenueRun)}B revenue ${loanRich?.decision ?? 'none'}`);
  }
  {
    // M3: a site lease capitalises construction interest on what the lessor has paid: the upfront part over the whole
    // build-out, each building payment from when it is paid. The booking follows that schedule; the preview uses it.
    const s = fx();
    s.player.finance.cash = 1e4;
    s.player.finance.rating = 'BB';
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push(newSite(s, makeCtx(s), { path: 'gas', mw: 500, pay: 'lease', leaseRate: 0.09, community: false }).id);
    const start = qOf(s);
    const sched = new Map<string, { power: boolean; buildQ0?: number }>();
    for (const id of ids) sched.set(id, { power: false });
    while (s.time.day < 400 + 6 * 365 && ids.some((id) => { const x = s.player.sites.find((y) => y.id === id)!; return x.stage !== 'live' && x.stage !== 'blocked'; })) {
      tick(s, { skip: ['endings', 'director'] });
      for (const id of ids) {
        const x = s.player.sites.find((y) => y.id === id)!;
        const r = sched.get(id)!;
        if (x.stage === 'power') r.power = true;
        if (x.stage === 'building' && r.buildQ0 === undefined) r.buildQ0 = qOf(s);
      }
    }
    const rows: string[] = [];
    let ok = 0;
    let n = 0;
    for (const id of ids) {
      const x = s.player.sites.find((y) => y.id === id)!;
      if (x.stage !== 'live') continue;
      n++;
      const r = sched.get(id)!;
      const liveQ = qOf(s, x.ws3.liveDay ?? s.time.day);
      const g = constructionGrowth(0.09, { etaQ: liveQ - start, buildQ: liveQ - (r.buildQ0 ?? liveQ), firstNow: !r.power });
      const l = s.player.finance.ledger.find((c) => c.id === siteLeaseId(id))!;
      const funded = (l.perQuarter * 4) / crf(0.09, 15);
      if (near(funded, x.capex * CAPEX_LEASE.siteShare * g, 1e-9)) ok++;
      rows.push(`eta ${liveQ - start}q build ${liveQ - (r.buildQ0 ?? liveQ)}q ×${(funded / (x.capex * 0.8)).toFixed(3)}`);
    }
    const p = fx();
    p.player.finance.rating = 'BB';
    const o = { path: 'grid', mw: 1000 } as const;
    const pv = FINANCE_ACTIONS.find((a) => a.id === 'cmp.newSite')!.preview(p, { ...o, pay: 'lease' });
    const capex = -pv.costs[0].amount / (1 - CAPEX_LEASE.siteShare); // the first line is your 20% share
    const opt = payOptions(p, capex, 'site', siteSchedule(p, o)).find((y) => y.id === 'lease')!;
    const sc = siteSchedule(p, o);
    const gGrid = constructionGrowth(0.09, sc);
    check(n > 0 && ok === n && near(-pv.costs[1].amount, opt.perYear) && gGrid < Math.pow(1.09, sc.etaQ / 8), 'FIN4r M3 a site lease capitalises construction interest on the money as paid (5% over the whole ETA, building payments from when paid): the booking follows it and the preview uses it', `${rows.join(' · ')} · grid ${sc.etaQ}q preview ×${gGrid.toFixed(3)} (was ×${Math.pow(1.09, sc.etaQ / 8).toFixed(3)})`);
  }
  {
    // L1: the distress down round is a down round whatever the last round was; the preview shows the price range.
    const s = fx();
    s.player.finance.state = 'distress';
    s.player.finance.rounds = [];
    const bc0 = s.player.board.confidence;
    const pv = FINANCE_ACTIONS.find((a) => a.id === 'fin.downRound')!.preview(s, {});
    const hit = pv.costs.find((c) => c.currency === 'boardConf')!.amount;
    act(s, 'fin.downRound', {});
    const r = s.player.finance.rounds[s.player.finance.rounds.length - 1];
    const moved = s.player.board.confidence - bc0;
    check(!!r?.down && Math.abs(moved - hit) <= 0.05 + 1e-9 && /50–70% of the valuation/.test(String(pv.costs[0].target)), 'FIN4r L1 the distress down round books its down-round effects explicitly (no prior round needed); the preview shows the 50–70% price range', `board ${f1(moved)} (preview ${f1(hit)}) · ${pv.costs[0].target}`);
  }
  {
    // L2: the partner preview sums the force cost of every failing vote it forces.
    const s = fx();
    s.player.board = initialBoard('founder');
    s.player.board.confidence = 0;
    s.player.finance.state = 'distress';
    s.player.finance.cash = 1e4;
    const who = rescuePartner(s)!;
    s.player.finance.ownership = { founder: 0.25, mission: 0, fin: 0.2, strat: { [who]: 0.55 }, public: 0 };
    const pv = FINANCE_ACTIONS.find((a) => a.id === 'fin.rescue')!.preview(s, { force: true });
    const forced = pv.costs.filter((c) => c.currency === 'boardConf' && /forced/.test(String(c.target))).length;
    const t = partnerTerms(s, who, { rescue: true });
    const failing = dealVotes(s, t).filter((x) => !x.passes && x.canForce).length;
    check(forced === failing && failing >= 2, 'FIN4r L2 a partner or rescue preview shows the force cost of every failing vote (not just the first)', `${forced} force lines for ${failing} failing votes`);
  }
  {
    // L3: the community package preview prices what apply packages (every site still permitting).
    const s = fx();
    s.player.policies.communityBenefits = true;
    s.player.finance.cash = 1e4;
    for (let i = 0; i < 2; i++) newSite(s, makeCtx(s), { path: 'gas', mw: 500, community: false });
    const before = s.player.sites.map((x) => x.capex);
    const pv = FINANCE_ACTIONS.find((a) => a.id === 'cmp.community')!.preview(s, {});
    act(s, 'cmp.community', {});
    const added = s.player.sites.reduce((a, x, i) => a + (x.capex - before[i]), 0);
    check(near(-pv.costs[0].amount, added, 1e-9), 'FIN4r L3 the community package preview prices every site the package goes to', `preview $${(-pv.costs[0].amount).toFixed(2)}B · added $${added.toFixed(2)}B`);
  }
  {
    // L4: the IPO's dual-class discount is a valuation line, not cash. L5: a raise's anchor must be on offer.
    const s = fx();
    const pv = FINANCE_ACTIONS.find((a) => a.id === 'fin.ipo')!.preview(s, { dualClass: true });
    s.player.board = initialBoard('pbcTrust');
    s.player.finance.state = 'healthy';
    const err = act(s, 'fin.raise', { ask: 1, anchor: 'Not a partner' });
    check(pv.exposure.some((e) => e.currency === 'valuation' && e.amount < 0) && !pv.exposure.some((e) => e.currency === 'cash' && /dual-class/.test(String(e.target))) && typeof err === 'string' && !s.player.finance.ws3.pendingRound, 'FIN4r L4/L5 the dual-class discount is shown on the valuation (not cash); a raise\'s anchor must be one on offer', `${err}`);
  }
  {
    // L6: scale promises are judged on compute you own or hold on firm contracts (no spot rentals, no cancellable cloud).
    const s = fx();
    const m0 = metricNow(s, 'scale');
    addSpotRental(s, 2e5);
    addCloud(s, makeCtx(s), 3e5, 4, 'Vantage Neocloud', { firm: false, startQ: 0 });
    const m1 = metricNow(s, 'scale');
    addCloud(s, makeCtx(s), 3e5, 4, 'Vantage Neocloud', { firm: true, startQ: 0 });
    const m2 = metricNow(s, 'scale');
    check(near(m1, m0) && near(m2 - m1, 3e5), 'FIN4r L6 the scale milestone counts owned and firm compute, not spot rentals or cancellable cloud', `${f1(m0 / 1e3)}k → ${f1(m1 / 1e3)}k (spot + cancellable) → ${f1(m2 / 1e3)}k (firm)`);
  }
  {
    // L8: the critics' investor director does not take the place of a founder preset's ownership seat.
    const s = fx();
    s.player.board = initialBoard('founder');
    s.player.board.seats.push({ kind: 'financial', holder: `${CRITICS_INVESTOR} (2026)`, stance: [1, 1, 0, 0], weight: 1 });
    s.player.finance.ownership.fin = 0.2;
    const n0 = s.player.board.seats.length;
    syncFinancialSeats(s);
    check(s.player.board.seats.length === n0 + 1, 'FIN4r L8 the critics\' investor director is not one of the founder preset\'s ownership seats', s.player.board.seats.map((x) => x.holder).join(', '));
  }
  {
    // L10: an unpaid maturity no longer skips the covenant tests (the chip-loan sweep still runs).
    const s = fx();
    s.player.finance.state = 'distress';
    s.player.finance.cash = 20;
    s.player.finance.debts.push({ id: 'D-mat', kind: 'bond', principal: 500, drawn: 500, spreadBp: 300, maturityDay: s.time.day - 1 });
    s.player.finance.ws3.chipBook = 20;
    s.player.finance.ws3.inventory = { ready: 0, transit: 0, book: 0 };
    // FIN6a: the loan is sized $10B over what the installed chips cover at 1.2× (it was a fixed $30B, which the
    // regenerated day-400 fixture's installed chips now cover, so no sweep was due: fixture drift, same meaning).
    const g0 = chipCollateral(s) / 1.2 + 10;
    s.player.finance.debts.push({ id: 'D-gpu', kind: 'gpuTerm', principal: g0, drawn: g0, spreadBp: 450, maturityDay: s.time.day + 900 });
    capitalQSystem.run(s, makeCtx(s));
    const g = s.player.finance.debts.find((d) => d.id === 'D-gpu')!.drawn;
    check(g < g0 && s.player.finance.covenantBreachDay !== undefined, 'FIN4r L10 an unpaid maturity and the chip-loan sweep both run in the same quarter', `chip loan $${f1(g0)}B → $${f1(g)}B, breach day ${s.player.finance.covenantBreachDay}`);
  }
  {
    // L9: a custom-chip deal's reserved supply serves only its own order. L11: deals keep no inert order id.
    const mk = (order?: string) => {
      const s = fx();
      s.market.ws3.exoMult = 20;
      s.player.orders = [{ id: 'O-test', lab: 'player', qty: 3e6, kind: 'standard', price: 20, deposit: 0, dueQ: qOf(s), prepayFrac: 0.3, nonTW: false, delivered: 0 }];
      s.player.finance.ws3.reserved = order === 'none' ? [] : [{ perQ: 3e6, fromQ: qOf(s) - 1, toQ: qOf(s) + 4, ...(order ? { order } : {}) }];
      clearMarket(s, makeCtx(s));
      return s.player.orders[0].delivered;
    };
    const other = mk('O-asic');
    const none = mk('none');
    const mine = mk('O-test');
    const s = fx();
    act(s, 'fin.partner', { partner: 'Azimuth', supply: 'asic' });
    const d = s.player.finance.deals.find((x) => x.partner === 'Azimuth' && !x.legacy);
    check(near(other, none) && mine > none && !!d?.supply && !('ref' in d.supply) && s.player.finance.ws3.reserved.some((r) => r.order), 'FIN4r L9/L11 reserved custom-chip supply serves only its own order; the deal stores no inert order id', `another order's pool ${f1(other / 1e3)}k = no pool ${f1(none / 1e3)}k < own pool ${f1(mine / 1e3)}k`);
  }
  {
    // L12 and the 17 → 18 migration: old SPV/JV leases keyed like any lease (the site is named), the JV's rate 10%; a
    // live promise gets its typical round from its round; deal supplies lose the inert order id.
    const s = fx();
    const raw = JSON.parse(serialize(s));
    raw.schemaRev = 39;
    raw.player.finance.ledger.push({ id: 'L-spv-S2', payee: 'Meridian Group', kind: 'finLease', perQuarter: 0.1, endDay: s.time.day + 600, cancellableNoticeQ: null, penalty: 0, rate: 0.12 });
    raw.player.finance.rounds.push({ day: s.time.day - 100, amount: 30, postMoney: 830, dilution: 30 / 830, down: false });
    raw.player.finance.promises.push({ id: 'PRm', type: 'scale', pitch: 'base', start: 1, target: 2, amount: 30, closeDay: s.time.day - 100, deadline: s.time.day + 265 });
    const m = deserialize(JSON.stringify(raw));
    const l = m.player.finance.ledger.find((c) => c.id === 'L-fin-S2');
    const name = contingentLiabilities(m).items.map((i) => i.name);
    const pr = m.player.finance.promises.find((p) => p.id === 'PRm');
    check(m.schemaRev >= 40 && !!l && l.rate === 0.1 && name.includes('Abilene South') && near(pr?.typical ?? 0, typicalRound(800, 0.08)), 'FIN4r L12 save migration 39 → 40: old SPV/JV leases are keyed by their site (named in What we owe), the JV at 10%; live promises get their typical round', `${name.join(', ')} · rate ${l?.rate} · typical $${f1(pr?.typical ?? 0)}B`);
  }
}
// ───────────────────────────── FIN5a: the story (sector value × share), the pool, supplier terms ─────────────────────────────
{
  const fx = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  {
    // The old formula and its narrative premium are gone; the quarterly mark is S × the mark's share (half-way from the
    // last mark to today's story), booked as two causes that sum to the change.
    // (The full-story share is read from the same quarter run with blend = 1 on a copy: same state, same draws.)
    const full = fx();
    const knob = STORY as unknown as { blend: number };
    const b0 = knob.blend;
    knob.blend = 1;
    capitalQSystem.run(full, makeCtx(full));
    knob.blend = b0;
    const s = fx();
    const last = s.player.finance.ws3.mark!;
    const V0 = s.player.finance.valuation;
    const story = storyNow(s);
    const ctx = makeCtx(s);
    capitalQSystem.run(s, ctx);
    const st = { share: full.player.finance.ws3.mark!.share, sector: { S: s.player.finance.ws3.mark!.S } };
    const mk = s.player.finance.ws3.mark!;
    const want = last.share + STORY.blend * (st.share - last.share);
    check(!('narrative' in s.player.finance) && !('valuationMark' in EQ) && !('valuationNow' in EQ) && near(mk.share, want, 1e-9) && near(s.player.finance.valuation, Math.min(st.sector.S * want, valueCap(s.player.finance.revenueRun, story.me!.growth)), 1e-9) && story.me !== undefined, 'FIN5a/FIN6a the valuation is the story: V = sector value × share (at most the valuation cap, FIN6a), the mark moving half-way from the last mark to today\'s share (no formula, no narrative premium)', `${f1(V0)}B → ${f1(s.player.finance.valuation)}B · share ${F1pct(last.share)} → ${F1pct(mk.share)} (story ${F1pct(st.share)}) · S ${f1(st.sector.S)}B`);
  }
  {
    // Sector value: κ · R^α · Φ(L) · mood; mood = H × M × bust (×0.4 while busted).
    const s = fx();
    const v = sectorValue(s);
    const want = STORY.kappa * Math.pow(v.R, STORY.alpha) * Math.pow(v.L / STORY.phiRef, STORY.phi) * s.capital.hype * Math.exp(-0.12 * (s.capital.y10 - 4.5));
    s.capital.busted = { day: s.time.day, recoverDay: s.time.day + 365 };
    const b = sectorValue(s);
    check(near(v.S, want, 1e-9) && near(b.S, v.S * STORY.bust, 1e-9) && b.mood < v.mood, 'FIN5a/FIN6a sector value = κ_S · R_sector^α · Φ(L_frontier) · mood (hype × rates × bust ×0.7, FIN6a; was ×0.4)', `R ${f1(v.R)}B · L ${v.L.toFixed(2)} · Φ ${v.phi.toFixed(2)} · mood ${v.mood.toFixed(2)} → S ${f1(v.S)}B (bust ${f1(b.S)}B)`);
  }
  {
    // Share: a softmax over the private labs only (player + rivals with a private valuation); credibility and
    // governance multiply each lab's weight; dual-class × 0.95; rivals keep their old valuations (FIN5b).
    const s = fx();
    const labs = storyShares(s);
    const priv = s.rivals.filter((r) => r.core.status === 'active' && r.finance.valuation > 0).map((r) => r.core.id);
    const sum = labs.reduce((a, x) => a + x.share, 0);
    const me = labs[0];
    const ok = labs.every((a) => near(a.weight, a.cred * a.gov * Math.exp(a.z / STORY.tau), 1e-9) && near(a.z, a.x.position * STORY.weights.position + a.x.momentum * STORY.weights.momentum + a.x.economics * STORY.weights.economics + a.x.capacity * STORY.weights.capacity, 1e-9));
    const w0 = me.weight;
    s.player.finance.dualClass = true;
    const w1 = storyShares(s)[0].weight;
    // (FIN5b: rivals' valuations are now marked from the same split; checked in the FIN5b block.)
    check(me.id === 'player' && labs.length === priv.length + 1 && labs.slice(1).every((a) => priv.includes(a.id)) && near(sum, 1, 1e-9) && ok && near(w1 / w0, DUAL_CLASS_GOV, 1e-9) && near(me.gov, GOV_FACTOR[s.player.board.preset], 1e-9), 'FIN5a share = cred · gov · exp(z/τ) ÷ Σ over the private labs (big-tech and parent-funded labs out); dual-class ×0.95 on the weight', `${labs.map((a) => `${a.id} ${F1pct(a.share)}`).join(' · ')}`);
  }
  {
    // Drivers: position against the best public model of any other lab, in 2-level units; a lab with no public model
    // sits at the best open-weight model; pre-revenue: momentum ×1 (log 0), economics at the field's (x = 0).
    const sp = newGame(defaultSetupV2({ seed: 1, start: 'spinout' }));
    const st = storyNow(sp);
    const me = st.me!;
    const best = Math.max(...sp.rivals.filter((r) => r.core.status === 'active').map((r) => r.publicModel?.Lg ?? 0));
    const fl = openWeightFloor(sp);
    check(me.floored && near(me.level, fl, 1e-9) && near(me.x.position, Math.max(-3, (fl - best) / STORY.posScale), 1e-9) && me.growth === 1 && me.margin === null && me.x.economics === 0 && growthOf(0, [0, 0, 0, 0]) === 1, 'FIN5a a lab without a public model sits at the best open-weight model; a pre-revenue lab has momentum ×1 and the field\'s economics', `level ${me.level.toFixed(2)} vs best ${best.toFixed(2)} → x ${me.x.position.toFixed(2)} · momentum x ${me.x.momentum.toFixed(2)} · capacity x ${me.x.capacity.toFixed(2)}`);
    // Start valuations from the split: a pre-revenue spinout is valued through position (SSI $32B, TML $12B), the
    // challenger near Anthropic's $61.5B, the leader near OpenAI's $300B (median of seeds 1–6).
    const V = (start: 'leader' | 'challenger' | 'spinout') => median([1, 2, 3, 4, 5, 6].map((seed) => newGame(defaultSetupV2({ seed, start })).player.finance.valuation));
    const v = { leader: V('leader'), challenger: V('challenger'), spinout: V('spinout') };
    check(v.spinout >= 10 && v.spinout <= 80 && v.challenger >= 40 && v.challenger <= 200 && v.leader >= 200 && v.leader <= 500 && st.V > 0, 'FIN5a start valuations from the split: spinout (pre-revenue) $10–80B, challenger $40–200B, leader $0.2–0.5T (medians, seeds 1–6; 2025 marks: TML $12B, SSI $32B, Anthropic $61.5–183B, OpenAI $300–500B)', `spinout ${f1(v.spinout)}B · challenger ${f1(v.challenger)}B · leader ${f1(v.leader)}B`);
  }
  {
    // The pool: π · S a year × the IPO bump, split by the mark's share; the player's unused part carries 50%.
    const s = fx();
    s.capital.ipoWindow = false;
    const unused = Math.max(0, s.capital.ws3.playerPoolQ - s.capital.ws3.playerTakenQ);
    capitalQSystem.run(s, makeCtx(s));
    const S = s.player.finance.ws3.mark!.S;
    const W = 1 + (s.capital.ipoWindow ? STORY.ipoBump : 0);
    check(near(s.capital.poolAnnual, STORY.pi * S * W, 1e-9) && near(s.capital.carry, STORY.carry * unused, 1e-9) && near(s.capital.ws3.playerPoolQ, s.player.finance.ws3.mark!.share * (s.capital.poolAnnual / 4 + s.capital.carry), 1e-9) && poolAnnualOf(s, S) === s.capital.poolAnnual, 'FIN5a investor pool = π · sector value a year (× the IPO window\'s bump), split by your share; unused carries 50%', `pool ${f1(s.capital.poolAnnual)}B/yr · yours ${f1(s.capital.ws3.playerPoolQ)}B this quarter`);
  }
  {
    // Supplier terms follow equity access: a lab with a small share or a short runway prepays more, on a batch's
    // deposit and on a supply contract's first delivery (partner supply too); the preview is what is booked.
    const s = fx();
    s.capital.ws3.playerShare = 0.6;
    s.player.finance.runwayQ = 8;
    const strong = supplierTerms(s);
    s.capital.ws3.playerShare = 0.05;
    s.player.finance.runwayQ = 2;
    const weak = supplierTerms(s);
    const qb = chipQuote(s, 1, 0.2e6, {});
    const qt = chipQuote(s, 4, 0.1e6, {});
    const cash0 = s.player.finance.cash;
    const pv = FINANCE_ACTIONS.find((a) => a.id === 'cmp.buyChips')!.preview(s, { term: 4, qty: 0.1e6 });
    const err = act(s, 'cmp.buyChips', { term: 4, qty: 0.1e6 });
    const o = s.player.orders[s.player.orders.length - 1];
    const first = s.player.finance.ledger.find((c) => c.id === `L-${o.id}-0`);
    const prepaidLine = pv.costs.find((c) => /prepaid now/.test(String(c.target)));
    check(strong.batch === SUPPLIER.base && strong.firstDelivery === 0 && weak.batch > 0.8 && near(qb.prepay, weak.batch, 1e-12) && near(qt.now, weak.firstDelivery * qt.prices![0] * 0.1, 1e-9) && !err && near(cash0 - s.player.finance.cash, qt.now, 1e-6) && !!first && near(first.perQuarter + qt.now, (0.1e6 * qt.prices![0]) / 1e6, 1e-9) && !!prepaidLine && near(-prepaidLine.amount, qt.now, 1e-9), 'FIN5a supplier terms = f(share, runway): 30% deposit for a lab investors fund easily, up to 100% for a small, short-runway lab; supply contracts prepay that premium on their first delivery (preview = booked)', `strong ${F1pct(strong.batch)} / ${F1pct(strong.firstDelivery)} · weak ${F1pct(weak.batch)} / ${F1pct(weak.firstDelivery)} · prepaid ${f1(qt.now)}B`);
  }
  {
    // Migration 40 → 41: the narrative premium dropped, rival revenue histories seeded, the last mark read off the
    // saved valuation (so the first mark moves half-way from it).
    const s = fx();
    const raw = JSON.parse(serialize(s));
    raw.schemaRev = 40;
    raw.player.finance.narrative = 1.5;
    delete raw.capital.ws3.labRev;
    delete raw.player.finance.ws3.mark;
    const m = deserialize(JSON.stringify(raw));
    const S = sectorValue(m).S;
    const priv = m.rivals.filter((r) => r.core.status === 'active' && r.finance.valuation > 0);
    check(m.schemaRev >= 41 && !('narrative' in m.player.finance) && priv.every((r) => (m.capital.ws3.labRev?.[r.core.id]?.length ?? 0) === 4) && near(m.player.finance.ws3.mark!.share, Math.min(1, m.player.finance.valuation / S), 1e-9), 'FIN5a save migration 40 → 41: no narrative premium; rivals\' revenue histories seeded; the last mark read off the saved valuation', `share ${F1pct(m.player.finance.ws3.mark!.share)}`);
  }
  {
    // The reference bot's equity a year stays in the 2025–26 range (OpenAI raised $40B in 2025, $122B in 2026).
    const e25 = median(ref.map((r) => r.s.player.finance.ws3.years['2025']?.equity ?? 0));
    const e26 = median(ref.map((r) => r.s.player.finance.ws3.years['2026']?.equity ?? 0));
    const sh = median(ref.map((r) => r.q.find((x) => x.day >= dayOfDate(START, '2026-10-01'))?.share ?? NaN).filter(Number.isFinite));
    check(e25 >= 5 && e25 <= 45 && e26 >= 50 && e26 <= 150, 'FIN5a RefBot equity raised a year in the 2025–26 range (H2 2025 $5–45B, 2026 $50–150B)', `2025 H2 ${f1(e25)}B · 2026 ${f1(e26)}B · story share Oct 2026 ${F1pct(sh)}`);
  }
}

// ───────────────────────────── FIN5b: rivals' finance (FINANCE-V3 §12) ─────────────────────────────
{
  const fx = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const priv = (s: GameStateV2) => s.rivals.filter((r) => r.core.status === 'active' && r.finance.valuation > 0 && !parentFunded(r));
  /** The fixture with its first private rival turned into a big-tech lab (the fixture has none). */
  const withBigTech = (s: GameStateV2) => {
    const b = s.rivals.find((r) => r.core.status === 'active' && r.finance.valuation > 0)!;
    b.archetype = 'bigtech';
    b.finance.valuation = 0;
    return b;
  };
  {
    // Marks: each private rival's share moves half-way to today's story share (the player's rule), valuation = S × that
    // share at most its cap (team value + multiple × run-rate); the Story card's labs carry the same valuation and cap.
    const full = fx();
    const knob = STORY as unknown as { blend: number };
    const b0 = knob.blend;
    knob.blend = 1;
    capitalQSystem.run(full, makeCtx(full));
    knob.blend = b0;
    const s = fx();
    const last = Object.fromEntries(priv(s).map((r) => [r.core.id, r.finance.mark ?? r.finance.valuation / sectorValue(s).S]));
    // FIN6a: the cap reads each lab's 4-quarter growth at the mark (its history rolls after the mark).
    const g0 = Object.fromEntries(storyShares(s).map((a) => [a.id, a.growth]));
    capitalQSystem.run(s, makeCtx(s));
    const S = s.player.finance.ws3.mark!.S;
    const rows = priv(s).map((r) => {
      const story = full.rivals.find((x) => x.core.id === r.core.id)!.finance.mark!;
      const want = last[r.core.id] + STORY.blend * (story - last[r.core.id]);
      return { r, want, cap: valueCap(r.finance.revenueRun, g0[r.core.id]), ok: near(r.finance.mark!, want, 1e-9) && near(r.finance.valuation, Math.min(S * want, valueCap(r.finance.revenueRun, g0[r.core.id])), 1e-9) };
    });
    const labs = storyShares(s);
    const same = priv(s).every((r) => { const a = labs.find((x) => x.id === r.core.id)!; return a.valuation === r.finance.valuation && near(a.cap!, Math.max(RIVAL.team, capMultiple(a.growth) * r.finance.revenueRun), 1e-12); });
    check(rows.length > 0 && rows.every((x) => x.ok) && same, 'FIN5b/FIN6a each private rival is marked like you: S × its share moving half-way to today\'s story, at most the valuation cap (FIN6a: max($30B team value, 37 × (growth ÷ 5)^0.4 × run-rate), every private lab); the Story card\'s labs carry that valuation and cap', rows.map((x) => `${x.r.core.name} $${f1(x.r.finance.valuation)}B (S×share $${f1(S * x.want)}B, cap $${f1(x.cap)}B)`).join(' · '));
  }
  {
    // Credibility (one rule: revenue growth over four quarters) and governance by kind feed the rival's weight.
    const s = fx();
    const r = priv(s)[0];
    const h = s.capital.ws3.labRev![r.core.id];
    const R = r.finance.revenueRun;
    const rung = (back: number) => { h.splice(0, h.length, back, back, back, back); return rivalCred(s, r); };
    const up = rung(R / 2), down = rung(R / 0.7), halved = rung(R / 0.4);
    const w = storyShares(s).find((a) => a.id === r.core.id)!;
    const govs = (['safety', 'maverick', 'upstart', 'leader'] as const).map((k) => GOV_FACTOR[RIVAL_GOV[k]]);
    check(up.mult === 1 && down.mult === 0.9 && halved.mult === 0.7 && w.cred === halved.mult && w.rung === 'Doubted' && w.gov === rivalGov(r) && govs.join(',') === '1,1.1,1.1,0.9' && near(w.weight, w.cred * w.gov * Math.exp(w.z / STORY.tau), 1e-12), 'FIN5b a rival\'s credibility comes from one rule (revenue up over four quarters: Credible ×1, down: Unproven ×0.9, halved: Doubted ×0.7) and its governance from its kind (safety PBC + trust ×1, maverick and upstart founder ×1.1, leader lab nonprofit PBC ×0.9), both in its weight', `growth ×${up.growth.toFixed(1)} ${up.id} · ×${down.growth.toFixed(2)} ${down.id} · ×${halved.growth.toFixed(2)} ${halved.id}`);
  }
  {
    // The pool: rivals' parts follow their valuations, scaled so theirs and the player's never exceed the pool; unused
    // money carries 50%.
    const s = fx();
    for (const r of priv(s)) r.finance.poolQ = 4;
    s.capital.ws3.playerShare = 0.97;
    markRivals(s, storyNow(s));
    const fresh = priv(s).reduce((a, r) => a + r.finance.poolQ! - STORY.carry * 4, 0);
    const Q = s.capital.poolAnnual / 4;
    check(fresh > 0 && fresh <= (1 - 0.97) * Q * (1 + 1e-9), 'FIN5b rivals\' parts of the investor pool follow their valuations and, with yours, never exceed the pool; unused money carries 50%', `rivals' new money $${f1(fresh)}B this quarter of $${f1(Q)}B (yours 97%)`);
  }
  {
    // Raising: under half a year of spend it raises at its valuation, at most d_max of it and within its pool part.
    const s = fx();
    const r = priv(s)[0];
    const f = r.finance;
    const spend = rivalSpend(r);
    f.cash = 0.1;
    f.poolQ = 1e6;
    f.raised = 10;
    const V0 = f.valuation;
    const amt = (RIVAL.dMax * V0) / (1 - RIVAL.dMax);
    const n0 = s.log.length;
    rivalMoneyQ(s, makeCtx(s), r);
    const ok1 = near(f.cash, 0.1 + (f.revenueRun - spend) / 4 + amt, 1e-9) && near(f.valuation, V0 + amt, 1e-9) && near(f.raised!, 10 + amt, 1e-9) && s.log.slice(n0).some((e) => /raises/.test(e.text));
    const s2 = fx();
    const r2 = priv(s2)[0];
    r2.finance.cash = 0.1;
    r2.finance.poolQ = 2;
    r2.finance.raised = 10;
    rivalMoneyQ(s2, makeCtx(s2), r2);
    const s3 = fx();
    const r3 = priv(s3)[0];
    r3.finance.cash = 10 * rivalSpend(r3);
    r3.finance.poolQ = 1e6;
    const V3 = r3.finance.valuation;
    rivalMoneyQ(s3, makeCtx(s3), r3);
    check(ok1 && near(r2.finance.raised!, 12, 1e-9) && r3.finance.valuation === V3, 'FIN5b a rival raises when its cash is under half a year of spend, at its valuation, at most d_max (8%) of it and its part of the pool; the round is logged; a funded rival raises nothing', `$${f1(amt)}B at $${f1(V0)}B (spend $${f1(spend)}B a year)`);
  }
  {
    // Distress: out of cash after raising → offered to you (E32); still failing next quarter → license-and-hired by the
    // largest big-tech rival (compute, 70% of its team, its know-how licensed; investors ≈ 1.25× back, logged); the
    // E32 Decline preview names the same buyer.
    const s = fx();
    const big = withBigTech(s);
    const r = priv(s)[0];
    const f = r.finance;
    f.cash = -50;
    f.poolQ = 0;
    f.raised = 20;
    addRivalKnowledge(r, recipeOf(s, big) - recipeOf(s, r) + 0.1); // FINM: the seller's recipe 0.1 OOM ahead (was pa)
    const ctx = makeCtx(s);
    rivalMoneyQ(s, ctx, r);
    const requested = ws4Of(s).requests.some((q) => q.id === 'E32' && q.data.lab === r.core.id);
    const declinePv = EVENT_BY_ID.get('E32')!.choices[2].preview(s, { lab: r.core.id });
    const names = declinePv.costs.some((c) => String(c.target).includes(exitBuyer(s, r)!.core.name));
    const c0 = big.core.computeOnline, h0 = big.core.staff.cap, rc = r.core.computeOnline, rh = r.core.staff.cap;
    const n0 = s.log.length;
    rivalMoneyQ(s, ctx, r);
    const line = s.log.slice(n0).find((e) => /licenses/.test(e.text));
    check(requested && f.distress && names && r.core.status === 'merged' && r.core.mergedInto === big.core.id && near(big.core.computeOnline, c0 + rc, 1e-9) && big.core.staff.cap === h0 + Math.round(rh * RIVAL.exitStaff) && near(recipeOf(s, big), recipeOf(s, r), 1e-9) && !!line && /\$25B back \(1\.25×/.test(line.text), 'FIN5b a private rival out of money is offered to you first (E32); still failing next quarter, the largest big-tech rival licenses its models and hires most of its team (its compute moves too); investors get ≈ 1.25× back, logged in plain words; E32\'s Decline names that buyer', line?.text ?? 'no log');
  }
  {
    // No big-tech rival: bankruptcy, logged. A parent-funded lab never raises or reaches distress.
    const s = fx();
    const r = priv(s)[0];
    r.finance.cash = -50;
    r.finance.poolQ = 0;
    const ctx = makeCtx(s);
    rivalMoneyQ(s, ctx, r);
    const n0 = s.log.length;
    rivalMoneyQ(s, ctx, r);
    const bankrupt = r.core.status === 'bankrupt' && s.log.slice(n0).some((e) => /goes bankrupt/.test(e.text));
    const s2 = fx();
    const big = withBigTech(s2);
    big.finance.cash = -100;
    rivalMoneyQ(s2, makeCtx(s2), big);
    check(bankrupt && !exitBuyer(s) && big.finance.cash >= rivalSpend(big) / 2 - 1e-9 && !big.finance.distress && big.finance.valuation === 0, 'FIN5b without a big-tech rival a failing lab goes bankrupt (logged); a parent-funded lab never raises or reaches distress', `${r.core.name}: ${r.core.status}`);
  }
  {
    // The bust's push (FIN3c gap): the most over-committed private rival raises nothing that quarter, is in distress
    // and is offered to you (E32), even with cash in the bank; it recovers next quarter if it has cash again.
    const s = fx();
    const ctx = makeCtx(s);
    const rng0 = ctx.rng.bind(ctx);
    ctx.rng = ((k: string) => (k === 'finance' ? Object.assign(Object.create(rng0(k as never)), { chance: () => true }) : rng0(k as never))) as typeof ctx.rng;
    delete s.capital.busted;
    const target = bustTarget(s)!;
    capitalQSystem.run(s, ctx);
    const pushed = (s.capital as { busted?: { rival?: string } }).busted?.rival === target.core.id;
    target.finance.cash = 0.1;
    target.finance.poolQ = 1e6;
    const V0 = target.finance.valuation;
    rivalMoneyQ(s, ctx, target);
    const offered = ws4Of(s).requests.some((q) => q.id === 'E32' && q.data.lab === target.core.id);
    const s2 = deserialize(serialize(s));
    s2.time.day += 91;
    const t2 = s2.rivals.find((x) => x.core.id === target.core.id)!;
    t2.finance.poolQ = 1e6;
    t2.finance.cash = rivalSpend(t2); // its investors are back: a year of spend in the bank
    rivalMoneyQ(s2, makeCtx(s2), t2);
    check(pushed && offered && target.finance.distress && target.finance.valuation === V0 && !t2.finance.distress && t2.core.status === 'active', 'FIN5b a bust pushes the most over-committed private rival into distress: it raises nothing that quarter and is offered to you (E32); it recovers next quarter if it has the cash', target.core.name);
  }
  {
    // Migration 41 → 42: each private rival's last mark read off its saved valuation, an empty pool part, its kind's
    // start equity as what its investors put in.
    const s = fx();
    const raw = JSON.parse(serialize(s));
    raw.schemaRev = 41;
    for (const r of raw.rivals) { delete r.finance.mark; delete r.finance.poolQ; delete r.finance.raised; }
    const m = deserialize(JSON.stringify(raw));
    const S = sectorValue(m).S;
    const p = m.rivals.filter((r) => r.core.status === 'active' && r.finance.valuation > 0);
    check(m.schemaRev === 42 && p.length > 0 && p.every((r) => near(r.finance.mark!, Math.min(1, r.finance.valuation / S), 1e-9) && r.finance.poolQ === 0 && r.finance.raised === RIVAL_START_FIN[r.archetype].raised), 'FIN5b save migration 41 → 42: rivals\' last marks read off their saved valuations, empty pool parts, start equity as raised', p.map((r) => `${r.archetype} ${F1pct(r.finance.mark!)}`).join(' · '));
  }
  {
    // FC6 on the reference path: private rivals stay funded through 2026; the end-2026 picture by kind (analogues:
    // Anthropic $380B–1.3T on $14–47B, xAI $230–250B, SSI $32B; FIN5b notes).
    const all = ref.flatMap((r) => r.private0);
    const alive = ref.flatMap((r) => r.rivals2026.filter((x) => x.status === 'active'));
    const show = (k: string) => { const xs = alive.filter((x) => x.arch === k); return xs.length ? `${k} ${xs.length}: V $${f1(median(xs.map((x) => x.V)))}B on $${f1(median(xs.map((x) => x.R)))}B (${f1(median(xs.map((x) => x.V / Math.max(0.1, x.R))))}×)` : `${k} 0`; };
    check(all.length > 0 && alive.length / all.length >= 0.75, 'FIN5b (FC6) trailing private rivals stay funded through 2026 (≥ 75% of them still active at end-2026, RefBot path)', `${alive.length} of ${all.length} active · ${['safety', 'maverick', 'upstart'].map(show).join(' · ')}`);
  }
}
// ───────────────────────────── FIN6a: calibration (FINANCE-V3 §14) ─────────────────────────────
{
  const fx = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  {
    // The aggressive pitch (spec §2.2) end to end: no bot pitches it (a round priced 20% over the mark sets the bar the
    // next round must clear), so this exercises the path. A Credible lab signs it at ×1.2 the mark with a target 1.3× the
    // trend's gain; it closes at that price; its promise is aggressive; at the next mark the valuation falls back to the
    // story, under the post-money, so a base round would now be a down round; judged met it moves credibility like any.
    const s = fx();
    const f = s.player.finance;
    f.credibility = 60;
    f.state = 'healthy';
    delete f.ws3.pendingRound;
    delete f.ws3.repricedRound;
    const V0 = f.valuation;
    const tr = trendOf(s, 'scale');
    const q = raiseQuote(s, 5, { pitch: 'aggressive' });
    const err = act(s, 'fin.raise', { ask: 5, type: 'scale', pitch: 'aggressive' });
    const pr = ((x: GameStateV2) => x.player.finance.ws3.pendingRound)(s); // (a call: TS narrowed it after the delete)
    const th = pr?.thesis;
    const signed = !err && !!pr && near(pr.preMoney, 1.2 * V0, 1e-9) && pr.priceMult === PITCH.aggressive.price && th?.pitch === 'aggressive' && near(th.target - th.start, PITCH.aggressive.gain * tr.gain, 1e-9) && near(q.pre, 1.2 * V0, 1e-9);
    pr!.max = 1e6; // isolate the price path from the closing odds
    const ctx = makeCtx(s);
    closePendingRound(s, ctx); // closes at today's mark × 1.2 (the mark has not moved)
    const round = f.rounds[f.rounds.length - 1];
    const promise = f.promises[f.promises.length - 1];
    const closed = !!round && near(round.postMoney - round.amount, 1.2 * V0, 1e-9) && near(f.valuation, round.postMoney, 1e-9) && promise?.pitch === 'aggressive' && !round.down;
    capitalQSystem.run(s, makeCtx(s)); // the next quarterly mark: back to the story
    const after = raiseQuote(s, 1, { pitch: 'base' });
    // Judged at its deadline with the metric past the target: met, credibility +30 × weight (as any promise).
    promise.deadline = s.time.day;
    promise.start = metricNow(s, 'scale') / 2;
    promise.target = metricNow(s, 'scale') * 0.9;
    const c0 = f.credibility;
    judgePromises(s, makeCtx(s));
    const res = promise.result;
    check(signed && closed && f.valuation < lastPostMoney(s) && after.down && res?.outcome === 'met' && near(f.credibility - c0, Math.min(100 - c0, PROMISE_RESULT.metCred * res.weight), 1e-6), 'FIN6a the aggressive pitch end to end: signed and closed at ×1.2 the mark with a target 1.3× the trend gain; the next mark falls back under its post-money (a base round is then a down round); judged like any promise', `pre $${f1(round?.postMoney - round?.amount)}B on a $${f1(V0)}B mark · next mark $${f1(f.valuation)}B vs post $${f1(lastPostMoney(s))}B · met: credibility +${f1(f.credibility - c0)}`);
  }
  {
    // One valuation cap for every private lab (FIN6a): the player's mark is S × share at most max(team value, the
    // growth-scaled multiple × run-rate), as the rivals'; the cut is its own cause; the multiple rises with growth.
    const s = fx();
    const ctx = makeCtx(s);
    s.player.finance.ws3.mark = { S: s.player.finance.ws3.mark!.S, share: 1 }; // a share the cap must stop
    const st = storyNow(s);
    capitalQSystem.run(s, ctx);
    const me = storyShares(s)[0];
    const cut = (s.causes.byKey['player.finance.valuation'] ?? []).find((e) => e.source === 'valuation cap' && e.day === s.time.day);
    const cap = valueCap(s.player.finance.revenueRun, st.me!.growth);
    const rising = capMultiple(1) < capMultiple(3) && capMultiple(3) < capMultiple(8) && near(capMultiple(RIVAL.capGrowthRef), RIVAL.multiple, 1e-12) && valueCap(0, 3) === RIVAL.team;
    check(near(s.player.finance.valuation, cap, 1e-9) && !!cut && cut.delta < 0 && me.cap !== undefined && rising, 'FIN6a one valuation cap for every private lab: your mark is at most max($30B team value, 37 × (growth ÷ 5)^0.4 × run-rate), the rivals\' rule; the cut is booked as its own cause', `cap $${f1(cap)}B on $${f1(s.player.finance.revenueRun)}B at ×${st.me!.growth.toFixed(2)} (${f1(capMultiple(st.me!.growth))}×) · cut $${f1(-(cut?.delta ?? 0))}B · multiple ×1 ${f1(capMultiple(1))} / ×3 ${f1(capMultiple(3))} / ×8 ${f1(capMultiple(8))}`);
  }
  {
    // Rivals' commitments book follows their spend (FIN6a; it was the start table's cash × 2 for the whole game): the
    // bubble index and a merger's obligations read it.
    const s = fx();
    capitalQSystem.run(s, makeCtx(s));
    const p = s.rivals.filter((r) => r.core.status === 'active' && r.finance.valuation > 0 && !parentFunded(r));
    check(p.length > 0 && p.every((r) => near(r.finance.commitments, rivalSpend(r), 1e-12)), 'FIN6a a private rival\'s commitments book is its spend a year (marked each quarter)', p.map((r) => `${r.core.name} $${f1(r.finance.commitments)}B`).join(' · '));
  }
  {
    // FC2 on the reference path, by year: the leader-style multiple stays in 20–37× at high growth in 2027 too (it ran
    // to ≈ 44× before the cap, ≈ 60× at the end of 2027), and the 2026 marks sit near the band's low end. FC4 printed:
    // commitments ÷ revenue run-rate (a known miss, FIN6a notes).
    const hi = (y: number) => ref.flatMap((r) => r.q.filter((x) => x.year === y && !x.bust && x.R >= 1 && x.g >= 2.5).map((x) => x.V / x.R));
    const m26 = median(hi(2026));
    const m27 = median(hi(2027));
    check(hi(2027).length > 0 && m27 >= 20 && m27 <= 37 && m26 >= 15, 'FIN6a (FC2) leader-style multiple at high growth by year: 2027 inside 20–37× (no runaway), 2026 at least 15×', `2026 ${f1(m26)}× (${hi(2026).length}) · 2027 ${f1(m27)}× (${hi(2027).length}) · end-2027 valuation median $${(median(ref.map((r) => r.s.player.finance.valuation)) / 1000).toFixed(2)}T`);
    const R27 = median(ref.map((r) => r.s.player.finance.revenueRun));
    console.log(`  info  FIN6a (FC4) RefBot end-2027 commitments remaining $${f1(median(ref.map((r) => commitmentsRemaining(r.s))))}B on a $${f1(R27)}B run-rate; partner take-or-pay ÷ its equity ${f1(median(ref.flatMap((r) => r.s.player.finance.deals.filter((d) => d.kind === 'hyperscaler' && !d.legacy && d.day >= 0 && d.supply).map((d) => d.supply!.total / Math.max(1e-9, d.equityNow + d.equityLater)))))}×`);
  }
}

console.log(`finance: ${FINANCE_ACTIONS.length} actions (${applied} applied on day400), no events`);
finish('finance');
