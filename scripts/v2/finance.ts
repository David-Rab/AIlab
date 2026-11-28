// Finance mechanism checks: what it guards. F4–F5/F9 constructed constants and the finance-v3 mechanics FIN1..FIN6a (debt,
// raises and promises, board, charter, acquisitions, partners, rivals' finance, division budget; V2-SPEC §7.2,
// design/FINANCE-V3.md). Owner: WS3.
// No played bot game: every check is constructed from newGame or fixtures/day400.json, with a few short idle ticks. Two
// checks tick longer and run in the full tier only (--smoke skips them): FIN4r H1's year of ticks on a day-400 state
// (≈ 20 CPU-s) and the M3 6-year site-lease wait (≈ 47 CPU-s). Tier: quick (smoke) and full.
// The sourced outcome bands read from played games (RefBot revenue/capex/valuation/rounds/deals/board, the demand-shock
// responses, distress shares) are calibration, not tests: they live in scripts/v2/calreport/finance.ts (TESTING.md §0).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAPEX_LEASE, DEBT_TERMS, LEGACY_NORTHWIND, MARKET, PARTNER_TERMS } from '../../src/data/v2/deals';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { act, makeCtx, resolve, tick } from '../../src/engine/v2/core/loop';
import { deserialize, serialize } from '../../src/engine/v2/core/save';
import { dayOfDate, dayOfQuarter, quarterIndex } from '../../src/engine/v2/core/time';
import { clearMarket, cloudPricePerYear, expectedCloudPrice, expectedListPrice, orderWeight, repriceCancellableCloud } from '../../src/engine/v2/compute/market';
import { addCloud, addSpotRental, chipQuote, rentQuote } from '../../src/engine/v2/compute/orders';
import { newSite, oppositionOdds, reactiveUnblockOdds, siteSchedule } from '../../src/engine/v2/compute/sites';
import { constructionGrowth, contingentLiabilities, crf, leaseAvailable, leaseGuarantor, leaseRate, payOptions, siteLeaseId, siteRVG } from '../../src/engine/v2/finance/capex';
import { chipCollateral, creditLineCapacity, debtHeadroom, debtRatePct, drawDebt, ratingOf, ratingTerms } from '../../src/engine/v2/finance/debt';
import { ACQUIRE, acquireTerms, acquireVotes, rivalObligations, shownVote } from '../../src/engine/v2/finance/acquire';
import { FINANCE_ACTIONS, raiseQuote } from '../../src/engine/v2/finance/actions';
import { boardVote, CRITICS, CRITICS_INVESTOR, criticsAvailable, debtVote, OUSTER, ousterVote, updateRunwayState, VOTE } from '../../src/engine/v2/finance/board';
import { MOOD_SOURCE_OF, MOOD_WEIGHTS, moodWeight } from '../../src/engine/v2/finance/mood';
import { acceptRepriced, bookRound, closePendingRound, dMax, LARGE_ROUND, lastPostMoney, roundSplit, partnerEquityIn, raiseCeiling, REPRICED_DECIDE_DAYS } from '../../src/engine/v2/finance/equity';
import { bustTarget, parentFunded, capMultiple, RIVAL, RIVAL_CHARTER, rivalCred, rivalGov, rivalMoneyQ, rivalSpend, valueCap } from '../../src/engine/v2/finance/rivalFinance';
import { ipAccessDays } from '../../src/engine/v2/npc/shocks';
import { appealOf, boardSeats, CHARTER_APPEAL, controllerOf, overrideAvailable } from '../../src/engine/v2/finance/control';
import { growthOf, openWeightFloor, playerGov, poolAnnualOf, sectorValue, STORY, storyNow, storyShares, SUPPLIER, supplierTerms } from '../../src/engine/v2/finance/story';
import { whatWeOwe } from '../../src/engine/v2/finance/owe';
import * as EQ from '../../src/engine/v2/finance/equity';
import { credRung, judgePromises, livePromises, makeThesis, metricNow, PITCH, PROMISE_RESULT, promiseDeadline, promiseWeight, trendOf, typicalRound } from '../../src/engine/v2/finance/promises';
import { charterRights, controlVote, transferVote } from '../../src/engine/v2/finance/charter';
import { affiliatedLab, dealVotes, dealWith, exclusiveBlocker, firstYearCommit, partnerBlocker, partnerCosts, partnerOffers, partnersNow, partnerStakeAfter, partnerTerms, partnerVotesAll, rescuePartner, signPartner, termsEquity } from '../../src/engine/v2/finance/deals';
import { capabilityThresholds, leadEstimate, licensedGap, licensedModel } from '../../src/engine/v2/finance/observe';
import { addLedger, ledgerDue, monthFirsts, qOf, RENEGOTIATE, totalFlows } from '../../src/engine/v2/finance/ledger';
import { budgetFactor, budgetRoom, DIVISION, divisionView, parentPaymentQ } from '../../src/engine/v2/finance/parent';
import { parentBudgetYear, positionOf } from '../../src/data/v2/starts';
import { runwayOf } from '../../src/engine/v2/finance/runway';
import { deployGate } from '../../src/engine/v2/models/deployments';
import { editBlock } from '../../src/engine/v2/models/productOps';
import { applyShock, capitalQSystem, trancheConditionMet } from '../../src/engine/v2/finance/investors';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import type { GameStateV2 } from '../../src/engine/v2/types';
import { FIXTURE_DIR, SMOKE, check, finish, validateJson } from './lib';



const START = '2025-07-01';


/** C2: the charter and cap table a check needs (the board follows the votes, control.ts): 'mission' a mission body (the
 *  safety committee and trust approval), 'founders' a founder majority (the override), 'boardRun' no controller. */
type Shape = 'mission' | 'founders' | 'boardRun';
function shape(s: GameStateV2, k: Shape): GameStateV2 {
  s.player.board.extraSeats = [];
  s.player.charter = { missionBody: k === 'mission', profitCap: false, goldenShare: false, stateControl: false };
  if (k === 'mission' && s.player.finance.ownership.mission <= 0) s.player.finance.ownership = { founder: 0.3, mission: 0.26, fin: 0.17, strat: { 'Northwind Cloud': 0.27 }, public: 0 };
  if (k === 'founders') s.player.finance.ownership = { founder: 0.75, mission: 0, fin: 0.25, strat: {}, public: 0 };
  if (k === 'boardRun') s.player.finance.ownership = { founder: 0.4, mission: 0, fin: 0.45, strat: { Azimuth: 0.15 }, public: 0 };
  return s;
}

const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const f1 = (x: number) => x.toFixed(1);
const F1pct = (x: number) => `${Math.round(x * 100)}%`;

// ───────────────────────────── F9: valuation, rounds, shocks ─────────────────────────────
{
  // FIN5a (spec §1, §14): the valuation is the story split (sector value × share), no longer a revenue-multiple
  // formula, so FC1 and FC2 are checked on the RefBot's quarter marks instead of a formula grid (rewritten: the
  // formula and its narrative premium N are gone).
  // FC1 (FINREF) reads the sum of the labs' marks, the instrument of its source: R15 §2.9's band is a sum of post-money
  // marks. FIN5a fitted S when every mark was S × share (Σ marks = S); since the caps (FIN5b rivals, FIN6a every lab) a
  // capped lab's unallocated part of S stays unallocated, so Σ marks < S (late 2026: S ≈ $3.6T, Σ marks ≈ $2.5T; S is
  // printed). The start band is the Jul 2025 marks from the same sources: OpenAI $300B (Mar 2025 [P]), Anthropic $61.5B
  // (Mar 2025 [P]), xAI–X $113B, SSI $32B, TML $12B [R21 A8, U] ≈ $0.52T; ≈ $0.64T with Anthropic's Sep 2025 $183B (the
  // old "$0.6–0.7T mid-2025"). Late 2026: OpenAI $1.25T [U], Anthropic's IPO ≈ $1.26–1.40T, others ≈ $0.1T (+ xAI $250B
  // if counted; in SpaceX since Feb 2026) [R15 §2.9]: band kept.
  const s = newGame(defaultSetupV2({ seed: 3 }));
  const V = s.player.finance.valuation;
  const cap = raiseCeiling(s).parts.dilution;
  check(Math.abs(cap / (V + cap) - dMax(false)) < 1e-9 && dMax(false) === 0.08 && dMax(true) === 0.05, 'F9 dilution cap 8% in a private round, 5% at IPO (C12)', `${f1((cap / (V + cap)) * 100)}%`);
  const ctx = makeCtx(s);
  const before = s.capital.ws3.playerPoolQ;
  applyShock(s, ctx, 'financingDoubt');
  const cut = 1 - s.capital.ws3.playerPoolQ / before;
  check(cut >= 0.2 && cut <= 0.3, 'F9 financing-doubt shock cuts the pool ~25% (C13)', `−${f1(cut * 100)}%`);
}

// ───────────────────────────── F10: sites ─────────────────────────────
// Constructed (was: 400 sites ticked 5 years, 1.8k game-days with 400 sites, to read two data constants by Monte-Carlo):
// the odds a rushed 500 MW gas site rolls at neutral sentiment, and its schedule. Neutral sentiment: the data-centre
// opposition is the W1d stand-in 45 (compute/sites.ts DC_NIMBY; public mood 45 ÷ 50 = 0.9, its 2025 start value): gas
// block 10% × 0.9 = 9%, delay 30% × 0.9 = 27% (DATACENTERS §3; odds [design D-6]). The stage machine itself is exercised
// by sites.ts.
{
  const s = newGame(defaultSetupV2({ seed: 11 }));
  const ctx = makeCtx(s);
  const site = newSite(s, ctx, { path: 'gas', mw: 500, rush: true, community: false });
  const odds = oppositionOdds(s, site);
  check(Math.abs(odds.block - 0.09) < 1e-9 && Math.abs(odds.delay - 0.27) < 1e-9, 'F10 a rushed gas 500 MW site at neutral sentiment (dcNimby 45, mood 0.9, no package) rolls blocked 9% and delayed 27% (DATACENTERS §3; odds [design D-6])', `block ${f1(odds.block * 100)}%, delay ${f1(odds.delay * 100)}%`);
  const sch = siteSchedule(s, { path: 'gas', mw: 500, rush: true, community: false });
  check(sch.buildQ === 7, 'F10 construction-to-live 7 quarters, rushed 500 MW gas (C14; 9.5 q x 0.5^0.4, DATACENTERS 5b)', `${sch.buildQ} q`);
}

// ───────────────────────────── F11: revenue path consumption ─────────────────────────────
// (The start run-rate $12B and the 2027 revenue band are checked once, in worldfx.ts and by the F7 medians here.)
{
  const s0 = newGame(defaultSetupV2({ seed: 1 }));
  // WS5's revenue system off: deployments hold a fixed revenueRate, WS3 smooths the run-rate from it.
  for (const d of s0.player.deployments) d.revenueRate = 30 / s0.player.deployments.length;
  for (let i = 0; i < 90; i++) tick(s0, { skip: ['revenue', 'endings'] }); // 3 time constants of the 30-day smoothing
  check(Math.abs(s0.player.finance.revenueRun - 30) < 1.5, 'F11 revenue run-rate follows WS5 deployment revenue (30-day smoothing)', f1(s0.player.finance.revenueRun));
}

// ───────────────────────────── Content: actions apply ─────────────────────────────
let applied = 0;
for (const a of FINANCE_ACTIONS) {
  const s = deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  s.player.finance.state = a.id === 'fin.rescue' || a.id === 'fin.downRound' || a.id === 'fin.renegotiate' ? 'distress' : s.player.finance.state;
  let err = '';
  try {
    if (a.available(s) === true) {
      a.apply(s, makeCtx(s), {});
      applied++;
      // "the game runs on": 8 ticks after the action (was 100 each: a bad write shows in the first ticks)
      for (let i = 0; i < 8; i++) tick(s, { skip: ['endings'] });
    }
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
    while (s.time.day < 100) tick(s, { skip: ['endings'] }); // a quarter-end passes (was 200 days)
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
    check(p >= 0.3 && p <= 0.85 && oppositionOdds(s, { path: 'gas', crash: false, communityPackage: true, ws3: { reactive: true } }).block === 1 - p, 'FIN1 E27 reactive package: re-permit with unblock odds 0.85 − 0.5 × opposition', `odds ${F1pct(p)} at the stand-in dcNimby 45`);
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
    // FINM: the rounds close at what the pool and the mark allow on the model-v3 fixture ($0.64B and $35B for asks of $1B
    // and $50B), so the weights are checked on the closed amounts.
    const a1 = p1.amount;
    const a2 = p2.amount;
    check(t1 > 0 && t2 > 0 && Math.abs(w1 - a1 / Math.max(a1 + a2, t1)) < 1e-6 && Math.abs(w2 - a2 / Math.max(a2, t2)) < 1e-6 && w1 < 0.05, 'FIN2/FIN4r weight = the round ÷ max(everything raised in the year to its deadline, a typical round at its close) (asks $1B then $50B)', `${F1pct(w1)} / ${F1pct(w2)} (closed ${f1(a1)}B / ${f1(a2)}B, typical ${f1(t1)}B / ${f1(t2)}B)`);
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
    const starts = (['leader', 'safety', 'breakaway'] as const).map((st) => newGame(defaultSetupV2({ seed: 1, labKind: st })).player.finance.credibility);
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
    // The IPO: its own one-time action; dual-class keeps the founders' majority at valuation ×0.95.
    const s = shape(fx(), 'founders');
    s.capital.ipoWindow = true;
    s.player.finance.state = 'healthy';
    const avail = FINANCE_ACTIONS.find((a) => a.id === 'fin.ipo')!.available(s);
    const V0 = s.player.finance.valuation;
    const err = act(s, 'fin.ipo', { dualClass: true });
    const ask = s.player.finance.ws3.pendingRound!.ask;
    s.player.finance.ws3.pendingRound!.max = 1e6;
    while (s.player.finance.ws3.pendingRound) tick(s, { skip: ['endings'] });
    s.player.finance.state = 'healthy';
    const again = FINANCE_ACTIONS.find((a) => a.id === 'fin.ipo')!.available(s);
    const r = s.player.finance.rounds[s.player.finance.rounds.length - 1];
    check(avail === true && !err && r.ipo === true && ask / (V0 + ask) <= 0.05 + 1e-9 && s.player.finance.ownership.public > 0 && s.player.finance.dualClass === true && Math.abs(playerGov(s) - CHARTER_APPEAL.dualClass) < 1e-12 && overrideAvailable(s) && controllerOf(s)?.kind === 'founders' && typeof again === 'string' && livePromises(s).every((p) => p.closeDay !== r.day), 'FIN2 the IPO is a one-time action (≤ 5%, no promise); dual-class keeps the founders\' majority at governance ×0.95 (FIN5a: on the share)', `ask $${f1(ask)}B = ${F1pct(ask / (V0 + ask))} at signing · public ${F1pct(s.player.finance.ownership.public)} at close · again: ${again}`);
    // Without dual-class shares the founders' votes dilute like everyone's: a thin majority ends at the listing.
    const t = shape(fx(), 'founders');
    t.player.finance.ownership = { founder: 0.52, mission: 0, fin: 0.48, strat: {}, public: 0 };
    const before = overrideAvailable(t);
    t.player.finance.ownership = { founder: 0.494, mission: 0, fin: 0.456, strat: {}, public: 0.05 };
    check(before && !overrideAvailable(t), 'FIN2 a listing without dual-class shares can end the founders\' majority (and the override)');
  }
  {
    // No revenue plan: the board's quarterly review posts no plan causes.
    const s = newGame(defaultSetupV2({ seed: 6 }));
    while (s.time.day < 100) tick(s, { skip: ['endings'] }); // one board quarterly review passes (was 300 days)
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
    const voters = boardSeats(s).filter((x) => x.weight > 0);
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
    const ops = ['cmp.newSite', 'cmp.community', 'fin.sellChips'].every((id) => !FINANCE_ACTIONS.find((a) => a.id === id)!.vote) && !vote('cmp.buyChips', { term: 1, qty: 5e6 }) && !vote('cmp.buyChips', { term: 0, qty: 5e6 }) && !vote('cmp.rentCompute', { term: 1, h100e: 5e6 }) && !vote('cmp.rentCompute', { term: 8, h100e: 50e6, firm: false });
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
    // A founder majority's override forces a failed vote at −20 confidence; a mission-controlled board cannot be forced.
    const s = shape(fx(), 'founders');
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
    check(!v.passes && v.canForce && !err && s.player.cloud.length > n0 && Math.abs(forced - (25 - VOTE.forceCost)) < 1e-9 && typeof err2 === 'string', 'FIN3a a founder majority forces a failed vote at board confidence −20; a board without the override cannot be forced', `founders: ${v.yes}/${v.total} forced, confidence 25 → ${forced} · mission board: ${err2}`);
  }
  {
    // Mood by seat kind (spec §7.4 table): a mission board minds incidents more and falling behind not at all; a
    // financial board the opposite. No safety-grade bonus, no tight-runway hit, no plan.
    const s = fx();
    // The founders own it all (their seats move no mood), so the one extra seat sets the weights.
    const kinds = (k: 'mission' | 'financial') => { shape(s, 'founders'); s.player.finance.ownership = { founder: 1, mission: 0, fin: 0, strat: {}, public: 0 }; s.player.board.extraSeats = [{ kind: k, holder: k, stance: [0, 0, 0, 0], weight: 2 }]; return { inc: moodWeight(s, 'incidents'), behind: moodWeight(s, 'behind'), res: moodWeight(s, 'results'), set: moodWeight(s, 'setbacks') }; };
    const m = kinds('mission');
    const fi = kinds('financial');
    check(m.inc === 2 && m.behind === 0 && m.res === 0.5 && m.set === 1 && fi.inc === 0.5 && fi.behind === 1.5 && fi.res === 1.5 && fi.set === 1 && MOOD_WEIGHTS.setbacks.independent === 1.5, 'FIN3a mood weights by seat kind (financial / mission / independent: promises 1.5/0.5/1, setbacks 1/1/1.5, behind 1.5/0/0.5, incidents 0.5/2/1)');
    const g = newGame(defaultSetupV2({ seed: 3 }));
    while (g.time.day < 150) {
      tick(g, { skip: ['endings'] }); // two quarterly reviews (was 400 days)
    }
    const srcs = new Set((g.causes.byKey['board.confidence'] ?? []).map((e) => e.source));
    check(![...srcs].some((x) => /Safety Index|tight runway|plan|new borrowing|debt repaid|board rejected|strategic rescue/.test(x)), 'FIN3a no safety-grade bonus, tight-runway, borrowing, plan or rejection sources', [...srcs].join(', ') || 'only reversion');
    // Every board-confidence source the engine posts is named (one of the four, the drift, or a decision/event cost).
    const named = [...srcs].every((x) => MOOD_SOURCE_OF[x] || ['board memory fades', 'forced past the board', 'critics given a seat'].includes(x));
    check(named, 'FIN3a board confidence moves only on named sources', [...srcs].join(', '));
  }
}

// ───────────────────────────── FIN3b: charter rights, low confidence, distress (FINANCE-V3 §7.2, §7.5, §8) ─────────────
{
  const fx = () => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const B = (k: number, est: number, clarity = 0.7) => ({ est, sd: 0.1, clarity, lastObsDay: k, evidence: [] });
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
    // A mission body: the safety committee halts the release of a model the player's own evals red-flag, on every
    // external channel and on a live product's model swap; internal use is not a release; the charter's mission body is
    // what is read; the hold lifts when the estimate falls to 50% or less.
    const s = shape(fx(), 'mission');
    const v = candidate(s, 'VCOMMITTEE');
    v.beliefs.SCHEME = B(s.time.day, 0.6);
    const g1 = deployGate(s, v, 'api');
    const gc = deployGate(s, v, 'consumer');
    const gi = deployGate(s, v, 'internal');
    const live = s.player.deployments.find((d) => (d.channel === 'api' || d.channel === 'consumer') && d.status !== 'withdrawn');
    const swap = live ? editBlock(s, live, { versionId: v.id }) : 'no live product';
    s.player.charter.missionBody = false;
    const g2 = deployGate(s, v, 'api');
    s.player.charter.missionBody = true;
    for (const k of ['SCHEME', 'AF', 'SAND'] as const) v.beliefs[k] = B(s.time.day, 0.45);
    const g3 = deployGate(s, v, 'api');
    const isHold = (g: true | string | undefined) => typeof g === 'string' && /Safety committee/.test(g);
    check(isHold(g1) && isHold(gc) && gi === true && isHold(swap) && !isHold(g2) && !isHold(g3), 'FIN3b a mission body: the safety committee halts the release of a red-flagged model (every external channel and a live swap; not internal use; the charter is read; lifts at ≤ 50%; the 30% E17 alarm alone does not halt)', `${g1} · consumer ${isHold(gc)} · internal ${gi} · swap ${isHold(swap)} · veto off ${isHold(g2)} · cleared ${isHold(g3)}`);
    const l = fx();
    const lv = candidate(l, 'VLEGACY');
    lv.beliefs.SCHEME = B(l.time.day, 0.6);
    shape(l, 'boardRun');
    check(!isHold(deployGate(l, lv, 'api')) && charterRights(l).every((r) => r.id !== 'safetyCommittee') && charterRights(s).some((r) => r.id === 'safetyCommittee'), 'FIN3b the release block is a mission body\'s alone (a board-run lab: no committee)');
  }
  {
    // A mission body: its seats vote (mission seats only, no force) on releasing a capability-threshold model's
    // weights and on a sale of control; neither passes on its stance. A model without a threshold flag needs no vote.
    const s = shape(fx(), 'mission');
    const v = candidate(s, 'VTRUST');
    v.flags = { cyberOffense: true };
    const g = deployGate(s, v, 'open');
    const tv = transferVote(s, v, 'open')!;
    const plain = candidate(s, 'VPLAIN');
    plain.flags = { persuasion: true };
    const gp = deployGate(s, plain, 'open');
    const cv = controlVote(s, 'Test partner', 0.6);
    check(typeof g === 'string' && /mission body votes no/.test(g) && tv.body === 'trust' && !tv.canForce && tv.seats.length > 0 && tv.seats.every((x) => x.kind === 'mission') && !(typeof gp === 'string' && /trust/.test(gp)) && !!cv && !cv.passes && !controlVote(s, 'Test partner', 0.4), 'FIN3b a mission body votes no on open weights of a capability-threshold model and on a sale of control (mission seats only, no force); no vote below 50% or without a threshold flag', `${g} · control: ${cv?.yes}/${cv?.total}`);
    // C3: control is judged by votes. Under a mission body (⅔ of the votes) a rescuer past half the stake stays below
    // half the votes, so no sale of control is voted: the mission body keeps control.
    {
      const partner = 'Azimuth';
      s.player.finance.ownership = { founder: 0.2, mission: 0.2, fin: 0.11, strat: { [partner]: 0.49 }, public: 0 };
      const t = partnerTerms(s, partner, { rescue: true });
      const after = partnerStakeAfter(s, t);
      const votes = partnerVotesAll(s, t);
      check(after > 0.5 && votes < 0.5 && !dealVotes(s, t).some((x) => x.decision === 'saleOfControl'), 'C3 under a mission body a rescue past half the stake is not a sale of control (its votes stay under half)', `stake after ${F1pct(after)} · votes ${F1pct(votes)}`);
    }
    const o = shape(fx(), 'boardRun');
    check(!controlVote(o, 'Test partner', 0.6) && !transferVote(o, v, 'open'), 'FIN3b only a mission body has the trust approval votes');
  }
  // Ouster votes on a set board and grievance (the last year's confidence losses).
  const board = (k: Shape, bc: number, source: string, warnAgo = 100) => {
    const s = shape(fx(), k);
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
    // Deterministic and seat by seat: the same state gives the same vote and draws no dice; one reluctance under every
    // board; the CEO does not vote and the founder directors vote no.
    const s = board('mission', 22, 'down round');
    const rng0 = JSON.stringify(s.rng);
    const a = ousterVote(s);
    const b = ousterVote(s);
    check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(s.rng) === rng0 && a.seats.every((x) => x.holder !== 'CEO' && (x.kind !== 'founder' || !x.yes)) && a.live && a.reluctance === OUSTER.reluctance, 'FIN3b the ouster vote is deterministic and seat by seat (one reluctance for every board; founder directors back the CEO)', `burning cash at 22: ${a.yes}/${a.total} (${a.seats.map((x) => `${x.kind} ${x.lean.toFixed(2)}`).join(', ')})`);
    const young = board('mission', 15, 'down round', 30);
    check(!ousterVote(young).live && !ousterVote(board('mission', 30, 'down round')).live, 'FIN3b no ouster vote without confidence under 25 and a warning at least 60 days old');
  }
  {
    // At the review: a reckless CEO on a mission-controlled board is voted out, and loyal staff no longer reinstate
    // anyone; a slow CEO on the same mission board is shielded (the vote falls short and the game goes on).
    const r = board('mission', 12, 'public incident');
    r.player.morale.overall = 95;
    const pre = ousterVote(r);
    toReview(r);
    const slow = board('mission', 12, 'behind a rival');
    const preSlow = ousterVote(slow);
    toReview(slow);
    check(pre.passes && r.flags['ws3.ousterDay'] !== undefined && !preSlow.passes && slow.flags['ws3.ousterDay'] === undefined, 'FIN3b at the review the vote shown beforehand decides: a reckless CEO is ousted (staff morale 95 does not reinstate); a mission board shields a slow one', `reckless ${pre.yes}/${pre.total} · slow ${preSlow.yes}/${preSlow.total}`);
  }
  {
    // Give the critics a seat: below 40 only, once a year; the side driving the decline gets a director for good
    // (incidents → a mission seat; falling behind → an investor seat); +15 now; the board's mood weights move its way.
    const s = board('mission', 50, 'public incident');
    const above = criticsAvailable(s);
    s.player.board.confidence = 35;
    const n0 = boardSeats(s).length;
    const w0 = moodWeight(s, 'incidents');
    const err = act(s, 'fin.critics', {});
    const x = boardSeats(s)[boardSeats(s).length - 1];
    s.player.board.confidence = 30;
    const again = criticsAvailable(s);
    const i = board('mission', 35, 'behind a rival');
    const wb = moodWeight(i, 'behind');
    act(i, 'fin.critics', {});
    const y = boardSeats(i)[boardSeats(i).length - 1];
    check(typeof above === 'string' && !err && boardSeats(s).length === n0 + 1 && x.kind === 'mission' && moodWeight(s, 'incidents') > w0 && typeof again === 'string' && y.kind === 'financial' && moodWeight(i, 'behind') > wb && i.player.board.confidence === 35 + CRITICS.gain, 'FIN3b critics seat: below 40, once a year; incidents bring a mission director, falling behind an investor one; +15 now and the mood weights lean their way', `${x.holder}: incidents ×${w0.toFixed(2)} → ×${moodWeight(s, 'incidents').toFixed(2)} · ${y.holder}: behind ×${wb.toFixed(2)} → ×${moodWeight(i, 'behind').toFixed(2)} · again: ${again}`);
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
      check(repriced && r.ipo === true && r.dilution <= dMax(true) + 1e-9 && r.amount < ask, 'FIN3b the IPO sells at most 5% at close: a repriced IPO raises less instead', `asked ${f1(ask)}B · ${repriced ? 'repriced, accepted' : 'closed'} at ${f1(r.amount)}B = ${(r.dilution * 100).toFixed(2)}%`);
    } else check(false, 'FIN3b the IPO sells at most 5% at close', String(err));
  }
}

// ───────────────────────────── FIN3c: acquisitions (FINANCE-V3 §9) ─────────────────────────────
{
  const fx = () => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const E32 = EVENT_BY_ID.get('E32')!;
  const idx = (e: typeof E32, label: string) => e.choices.findIndex((c) => c.label === label);
  /** A fixture with a private rival out of money and its E32 offer pending; a rich, confident board unless told. */
  const offer = (opts: { cash?: number; bc?: number; shape?: Shape; rivalV?: number } = {}) => {
    const s = fx();
    if (opts.shape) shape(s, opts.shape);
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
    const cap0 = s.player.staff.cap;
    const n0 = f.ledger.length;
    const heads = Math.round(r.core.staff.cap * 0.7) + Math.round(r.core.staff.saf * 0.7);
    const err = resolve(s, 'E32@t', i);
    const e = f.ledger.find((c) => c.kind === 'merger');
    const debt = f.debts.find((x) => x.kind === 'assumed');
    const priceLine = pv.costs.find((c) => c.currency === 'cash')!;
    const obl = pv.exposure.filter((c) => c.currency === 'cash').map((c) => -c.amount);
    const staffLine = pv.gains.find((c) => c.currency === 'staffTime')!;
    check(!err && Math.abs(cash0 - f.cash - t.price) < 1e-6 && f.ledger.length === n0 + 1 && !!e && e.perQuarter === t.obligations.perQ && e.cancellableNoticeQ === null && Math.abs(e.endDay - s.time.day - 730) <= 1 && !!debt && debt.drawn === 3 && r.core.status === 'merged' && s.player.staff.cap > cap0, 'FIN3c paying cash: the price leaves cash, its contracts become one firm ledger entry over 8 quarters, its debt drawn debt (no cash moves), its staff join, the lab is gone', `${err ?? ''} cash −$${f1(cash0 - f.cash)}B · entry $${f1(e?.perQuarter ?? 0)}B/q to day ${e?.endDay} · debt $${f1(debt?.drawn ?? 0)}B at ${debt ? debtRatePct(s, debt).toFixed(1) : '?'}%`);
    check(Math.abs(priceLine.amount - Math.round(t.price * 10) / 10) < 1e-9 && Math.abs(obl[0] - Math.round(t.obligations.total * 10) / 10) < 1e-9 && Math.abs(obl[1] - 3) < 1e-9 && staffLine.amount === heads, 'FIN3c the offer preview matches the effects: price, contracts and debt taken on, staff gained', `$${priceLine.amount}B · $${obl.join('B + $')}B · +${staffLine.amount} staff`);
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
    check(!err && f.cash === cash0 && Math.abs(f.ownership.fin - (fin0 * (1 - t.stockFrac) + t.stockFrac)) < 1e-9 && Math.abs(f.ownership.founder - founder0 * (1 - t.stockFrac)) < 1e-9 && Math.abs(dil.amount - Math.round(t.stockFrac * 1000) / 10) < 1e-9 && f.ledger.some((c) => c.kind === 'merger') && f.debts.some((x) => x.kind === 'assumed'), 'FIN3c paying in stock: its holders get price ÷ (your valuation + price) of the company (the preview\'s dilution), no cash moves, the obligations come all the same', `${(t.stockFrac * 100).toFixed(2)}% · preview ${dil.amount}%`);
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
    // A failed vote makes the choice unavailable (nothing booked); a founder majority can force it at −20, shown first.
    const no = offer({ bc: 0 });
    const ic = idx(E32, 'Pay cash');
    const why = E32.choices[ic].available!(no.s, no.d);
    const cash0 = no.s.player.finance.cash;
    const err = resolve(no.s, 'E32@t', ic);
    // Founder board at 25 with just the price in the bank: the vote fails (mood and a thin runway after the deal).
    const fo = offer({ bc: 25, shape: 'founders' });
    fo.s.player.finance.cash = acquireTerms(fo.s, fo.r).price + 1;
    const fv = shownVote(acquireVotes(fo.s, acquireTerms(fo.s, fo.r), 'cash'))!;
    const fpv = E32.choices[ic].preview(fo.s, fo.d);
    const bc0 = fo.s.player.board.confidence;
    const ferr = resolve(fo.s, 'E32@t', ic);
    check(typeof why === 'string' && /votes no on merger/.test(why) && typeof err === 'string' && no.s.player.finance.cash === cash0 && no.r.core.status === 'active' && !fv.passes && fv.canForce && fpv.costs.some((c) => c.currency === 'boardConf' && c.amount === VOTE.forceCost) && !ferr && fo.s.player.board.confidence <= bc0 - VOTE.forceCost + 1e-9 && fo.r.core.status === 'merged', 'FIN3c a failed merger vote blocks the choice (nothing booked); under founder control the choice forces it at the confidence cost its preview shows', `${why} · founder: ${fv.yes}/${fv.total}, confidence ${bc0.toFixed(0)} → ${fo.s.player.board.confidence.toFixed(0)}`);
  }
  // Sale of control: only stock whose holders, as one block, would pass half of all votes (the board's vote); never cash.
  // C3: under a mission body (⅔ of the votes) no block ever does; the shares are booked to investors, a crowd that never
  // controls, so a sale that goes through ends nothing.
  {
    const { s, r, d } = offer({ shape: 'founders', rivalV: 1e6 });
    const t = acquireTerms(s, r);
    const vs = acquireVotes(s, t, 'stock');
    const cashVs = acquireVotes(s, t, 'cash');
    const ist = idx(E32, 'Pay in stock');
    const pv = E32.choices[ist].preview(s, d);
    const small = offer({ shape: 'founders' });
    const smallVs = acquireVotes(small.s, acquireTerms(small.s, small.r), 'stock');
    const mi = offer({ shape: 'mission', rivalV: 1e6 });
    const miVs = acquireVotes(mi.s, acquireTerms(mi.s, mi.r), 'stock');
    const line = pv.costs.find((c) => c.currency === 'freedom' && /sale of control/.test(String(c.target)));
    check(t.stockFrac > 0.5 && vs[0].decision === 'saleOfControl' && vs[0].body !== 'trust' && vs[vs.length - 1].decision === 'merger' && cashVs.every((v) => v.decision === 'merger') && smallVs.every((v) => v.decision === 'merger') && miVs.every((v) => v.decision === 'merger') && !!line && !/ends the game/.test(String(line.target)), 'FIN3c a stock payment whose holders would pass half of all votes is a sale of control the board votes on (its preview never says it ends the game); under a mission body, for cash or for a small stake it is only a merger', `${(t.stockFrac * 100).toFixed(0)}%: ${vs.map((v) => `${v.body ?? 'board'} ${v.decision} ${v.yes}/${v.total}`).join(', ')}`);
    // A founder majority (votes forced if they fail): the lab's holders join the investors; the company plays on.
    const fo = offer({ shape: 'founders', bc: 90, rivalV: 1e6 });
    const err = resolve(fo.s, 'E32@t', ist);
    tick(fo.s);
    check(!err && fo.s.ending === undefined && fo.r.core.status === 'merged', 'C3 a sale of control by stock that goes through books its holders as investors: no ending', `${err ?? ''} ending ${fo.s.ending?.id}`);
  }
  // Deals: a partner past 50% now meets the board's own sale-of-control vote after the trust's (FIN3b wired the trust).
  {
    const s = shape(fx(), 'mission');
    const partner = 'Azimuth';
    const own = { founder: 0.2, mission: 0.2, fin: 0.11, strat: { [partner]: 0.49 }, public: 0 };
    s.player.finance.ownership = structuredClone(own);
    const t = partnerTerms(s, partner, { rescue: true });
    const vs = dealVotes(s, t);
    const o = shape(fx(), 'boardRun');
    o.player.finance.ownership = structuredClone(own);
    const ov = dealVotes(o, partnerTerms(o, partner, { rescue: true }));
    check(!!t && !vs.some((v) => v.decision === 'saleOfControl') && ov[0]?.decision === 'saleOfControl' && ov[0]?.body !== 'trust', 'FIN3c a rescue whose votes pass half needs the board\'s sale-of-control vote; under a mission body its votes never do (C3: judged by votes)', ov.map((v) => `${v.body ?? 'board'} ${v.decision}`).join(', '));
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
    check(!!nw?.legacy && JSON.stringify(nw.strings) === JSON.stringify({ revenueShare: LEGACY_NORTHWIND.revenueShare }) && !!why && /capped at 15%/.test(why) && !boardSeats(s).some((x) => /observer/.test(x.holder)) && offers.filter((o) => !o.blocked).map((o) => o.partner).join(',') === 'Azimuth,Silica Systems', 'FIN4a leader start: Northwind is a legacy holder above the 15% cap (no observer seat, only the legacy revenue share); the other partners offer terms', `${why} · open: ${offers.filter((o) => !o.blocked).map((o) => o.partner).join(', ')}`);
  }
  {
    // Hyperscaler on cloud: equity in three tranches; capacity priced on the expected cloud path less the firm discount
    // (10% at 6 years) and the partner's 10%, booked a firm contract a year; the take-or-pay schedule booked is the one
    // shown; revenue share; no board seat; the tranches carry their conditions (spent on the partner) and the cap.
    const s = fx();
    const ctx = makeCtx(s);
    const t = partnerTerms(s, 'Azimuth', { supply: 'cloud' });
    const sp = t.supply!;
    const pathOk = sp.prices.every((p, k) => near(p, expectedCloudPrice(s, 1 + k) * (1 - 0.1) * (1 - PARTNER_TERMS.hyperscaler.discount)));
    const seats0 = boardSeats(s).length;
    const cash0 = s.player.finance.cash;
    const err = signPartner(s, ctx, 'Azimuth', { supply: 'cloud' });
    const d = dealWith(s, 'Azimuth');
    const led = s.player.finance.ledger.filter((c) => c.payee === 'Azimuth');
    const ledTotal = led.reduce((a, c) => a + c.perQuarter, 0);
    const tr = s.player.finance.tranches.filter((x) => x.partner === 'Azimuth');
    check(!err && pathOk && sp.partnerDiscount === PARTNER_TERMS.hyperscaler.discount && sp.firmDiscount === 0.1 && sp.prices[0] > sp.prices[sp.prices.length - 1] && near(ledTotal, sp.total) && led.length === sp.quarters && led.every((c) => c.cancellableNoticeQ === null) && near(s.player.finance.cash - cash0, t.equityNow, 1e-3) && tr.length === 2 && tr.every((x) => /^spent:Azimuth:/.test(x.condition ?? '') && x.stakeCap === 0.15 && x.deadline! > x.dueDay) && boardSeats(s).length === seats0 && !d?.strings.exclusivity && d?.strings.revenueShare === undefined && d?.strings.distribution?.reach === PARTNER_TERMS.hyperscaler.distribution.reach && d?.strings.distribution?.fee === PARTNER_TERMS.hyperscaler.distribution.fee && s.player.cloud.filter((c) => c.provider === 'Azimuth').length === 6,
      'FIN4a hyperscaler cloud: priced on the expected path less the firm (10%) and partner (10%) discounts, the same take-or-pay schedule booked as six yearly contracts, equity now + two spent-on-the-partner tranches under the 15% cap, distribution (no revenue share), no board seat',
      `${f1(sp.h100e / 1e6)}M H100e · $${f1(sp.first)}K → $${f1(sp.last)}K/H100e-yr · take-or-pay $${f1(sp.total)}B · equity $${f1(t.equityNow)}B + 2 × $${f1(tr[0]?.amount ?? 0)}B`);
    // The preview shows what signing books: cash now, the first payment, the tranches with their conditions.
    const s2 = fx();
    const pv = FINANCE_ACTIONS.find((a) => a.id === 'fin.partner')!.preview(s2, { partner: 'Azimuth', supply: 'cloud' });
    const t2 = partnerTerms(s2, 'Azimuth', { supply: 'cloud' });
    check(pv.gains.some((g) => g.currency === 'cash' && near(g.amount, t2.equityNow) && g.target === 'now') && pv.gains.filter((g) => g.currency === 'cash' && /tranche: after you've spent/.test(String(g.target))).length === 2 && pv.costs.some((c) => c.currency === 'cash' && near(-c.amount, t2.supply!.perQ[0]) && /−10% partner/.test(String(c.target))) && pv.gains.some((g) => g.currency === 'revenue' && /resells your models/.test(String(g.target))) && pv.costs.some((c) => c.currency === 'revenue' && /keeps 30%/.test(String(c.target))) && pv.costs.some((c) => c.currency === 'dilution' && /holds [\d.]+% after signing, up to [\d.]+% if every tranche lands/.test(String(c.target))), 'FIN4a the offer\'s preview shows every term and string before signing (cash now, tranches and their conditions, the first take-or-pay payment with both discounts, distribution and its fee, the stake after signing)');
    // One deal per partner (a running exclusivity blocking its competitor: scripts/v2/partners.ts).
    check(/Already your partner/.test(partnerBlocker(s, 'Azimuth') ?? ''), 'FIN4a one deal per partner', `${partnerBlocker(s, 'Azimuth')}`);
    // A tranche buys shares at that day's valuation (it booked cash with no shares before FIN4a), and only up to the cap.
    const own0 = s.player.finance.ownership.strat['Azimuth'] ?? 0;
    for (const x of tr) { x.dueDay = s.time.day; delete x.condition; }
    const dealEq = (x: GameStateV2) => Object.values(x.player.finance.ws3.years).reduce((a, y) => a + y.dealEquity, 0);
    const de0 = dealEq(s);
    const q0 = qOf(s);
    while (qOf(s) === q0) tick(s, { skip: ['endings'] });
    const own1 = s.player.finance.ownership.strat['Azimuth'] ?? 0;
    const landed = dealEq(s) - de0;
    const big = partnerEquityIn(s, makeCtx(s), 'Azimuth', 10 * s.player.finance.valuation, 'test tranche', 0.15);
    check(!s.player.finance.tranches.some((x) => x.partner === 'Azimuth') && own1 > own0 && own1 <= 0.15 + 1e-9 && landed > 0 && landed <= tr.reduce((a, x) => a + x.amount, 0) + 1e-3 && near(s.player.finance.ownership.strat['Azimuth'], 0.15, 1e-6) && big < 10 * s.player.finance.valuation, 'FIN4a a partner tranche buys shares when it lands; a hyperscaler stops at 15% (the rest lapses)', `${f1(landed)}B landed · stake ${F1pct(own0)} → ${F1pct(own1)} → capped ${F1pct(s.player.finance.ownership.strat['Azimuth'])}`);
  }
  {
    // Custom chips (Azimuth): the H100e list path × 45% less the firm discount, a separate pool, the migration.
    const s = fx();
    const t = partnerTerms(s, 'Azimuth', { supply: 'asic' });
    const sp = t.supply!;
    const ok = sp.prices.every((p, k) => near(p, expectedListPrice(s.market, 2 + k) * PARTNER_TERMS.asic.costMult * (1 - sp.firmDiscount)));
    const n0 = s.player.finance.ws3.reserved.length;
    const err = signPartner(s, makeCtx(s), 'Azimuth', { supply: 'asic' });
    // C7a: booked as one yearly contract per year (the deal does not store the order ids); each carries its year's slice of the price path.
    const o = (sp.yearly ?? []).every((h, y) => s.player.orders.some((x) => x.kind === 'lta' && x.ltaStartQ === sp.startQ + 4 * y && x.qty === h && JSON.stringify(x.prices) === JSON.stringify(sp.prices.slice(4 * y, 4 * y + 4))));
    check(!err && ok && sp.costMult === 0.45 && o && (sp.yearly?.length ?? 0) === sp.quarters / 4 && s.player.finance.ws3.reserved.length === n0 + sp.quarters / 4 && (s.player.finance.ws3.asicMigrationUntil ?? 0) > s.time.day, 'FIN4a custom chips: 45% of the H100e list path less the firm discount, from a separate supply pool, research slows while migrating', `$${f1(sp.first)}K → $${f1(sp.last)}K per H100e · ${f1(sp.h100e / 1e3)}k a quarter`);
  }
  {
    // Chip vendor: $10B per GW of its chips bought (spent: tranches), buy its chips on the path less firm and vendor discounts,
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
    check(!err && ok && t.equityNow === 0 && tr.length === 2 && tr.every((x) => x.amount === PARTNER_TERMS.chipVendor.perGW && /^spent:Silica Systems:/.test(x.condition ?? '')) && near(w1 - w0, MARKET.rationW.strategic) && near(orderWeight(later, false, 0.3), w0, 1e-3), 'FIN4a chip vendor: $10B per GW of its chips bought (spent tranches), its chips on the path less firm and vendor discounts, +0.5 allocation weight only while it supplies', `tranches ${tr.map((x) => x.condition).join(', ')} · weight ${f1(w0)} → ${f1(w1)}`);
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
    // Rescue (distress only): cash for shares at half the valuation (cash ÷ (0.5 V + cash)); the rescuer's stake then
    // votes (its seats follow its votes), with exclusivity; no IP rights flag; the rescuer is the hyperscaler with the
    // largest stake.
    const s = fx();
    s.player.finance.state = 'distress';
    s.player.board.confidence = 90;
    check(/Distress: only a rescue/.test(partnerBlocker(s, 'Azimuth') ?? ''), 'FIN4a in distress only a rescue is on offer');
    const rp = rescuePartner(s)!;
    const rt = partnerTerms(s, rp, { rescue: true });
    const after = partnerStakeAfter(s, rt);
    const stake0 = s.player.finance.ownership.strat[rp] ?? 0;
    const sh = rt.equityNow / (0.5 * Math.max(10, s.player.finance.valuation) + rt.equityNow);
    const err = act(s, 'fin.rescue', {});
    const d = s.player.finance.deals.find((x) => x.rescue);
    check(!err && !!d && d.partner === 'Northwind Cloud' && !!d.strings.exclusivity && near(after, stake0 * (1 - sh) + sh, 1e-9) && near(s.player.finance.ownership.strat[d.partner], after, 1e-6) && s.player.finance.stratVoting?.[d.partner] === true, 'FIN4a rescue: shares at half the valuation, a stake that votes (its seats follow its votes) and exclusivity (no inert IP flag), from the largest holder', `${err ?? ''} ${d?.partner} ${F1pct(stake0)} → ${F1pct(s.player.finance.ownership.strat[d?.partner ?? ''] ?? 0)}`);
  }
}

// ───────────────────────────── FIN4b: several partners, exclusivity, IP access (FINANCE-V3 §6.1 strings) ─────────────────────────────
{
  const fx = () => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const ST = PARTNER_TERMS.strings;
  // At day 400 (V ≈ $88B) the plain offer is 3 × $5B (the tranche floor) and the 15% cap leaves ≈ $15.6B, so the +25% / +20% of
  // the equity would be cut by the cap: the checks of the bumps start from a state with room (no stake, V = $300B).
  const roomy = (s: GameStateV2) => { s.player.finance.ownership.strat['Azimuth'] = 0; s.player.finance.valuation = 300; return s; };
  // day400 has one big-tech rival (Tarnwick, rivals[1]): it is Azimuth's in-house lab (data/v2/deals.ts: only Azimuth is
  // marked inHouse; Northwind has none).
  const withLabs = (s: GameStateV2) => {
    s.rivals[1].npc.kind = 'bigtech';
    s.rivals[2].npc.kind = 'bigtech';
    return s;
  };
  {
    // At most 3 partners at once; a stake from before the start does not count; a rescue is never refused by the cap. (The cast
    // has three partners, so the cap cannot bind: Northwind is opened by dropping its legacy stake.)
    const s = fx();
    s.player.finance.ownership.strat['Northwind Cloud'] = 0;
    s.player.finance.deals = s.player.finance.deals.filter((d) => !d.legacy);
    const ctx = makeCtx(s);
    const errs = ['Azimuth', 'Silica Systems', 'Northwind Cloud'].map((p) => signPartner(s, ctx, p));
    s.player.finance.state = 'distress';
    s.player.board.confidence = 90;
    const rescue = act(s, 'fin.rescue', {});
    check(errs.every((e) => !e) && partnersNow(s).length === ST.maxPartners && !rescue && s.player.finance.deals.some((d) => d.rescue), 'FIN4b three partners at once (the most); a rescue is not capped', `after the rescue: ${partnersNow(s).join(', ')}`);
  }
  {
    // Exclusivity is optional and pays: off by default; on, +25% of the equity (hyperscaler, under the stake cap) and a
    // commitment of 4 × it; it is offered only while its competitor could offer you something, blocks that competitor while
    // the deal runs, and a chip vendor (no competitor) has none to offer.
    const s = fx();
    check(/Northwind Cloud has nothing to offer you now/.test(exclusiveBlocker(s, 'Azimuth') ?? '') && !partnerTerms(s, 'Azimuth', { exclusive: true }).strings.exclusivity, 'FIN4b exclusivity is not offered while the competitor has nothing to offer (Northwind is above the cap)', exclusiveBlocker(s, 'Azimuth'));
    s.player.finance.ownership.strat['Northwind Cloud'] = 0;
    s.player.finance.deals = s.player.finance.deals.filter((d) => !d.legacy);
    roomy(s);
    const open = partnerTerms(s, 'Azimuth');
    const ex = partnerTerms(s, 'Azimuth', { exclusive: true });
    check(!open.strings.exclusivity && !!ex.strings.exclusivity && near(termsEquity(ex), termsEquity(open) * (1 + ST.exclusiveBump)) && near(ex.options.exclusive.bump, termsEquity(ex) - termsEquity(open)) && near(ex.supply!.total, PARTNER_TERMS.hyperscaler.commitMult * termsEquity(ex), 1e-6) && !!partnerTerms(s, 'Silica Systems').options.exclusive.blocked,
      'FIN4b exclusivity is optional: +25% of the equity, shown as the option\'s bump, the commitment stays 4 × the equity; a chip vendor has no competitor to exclude', `Azimuth $${f1(termsEquity(open))}B → $${f1(termsEquity(ex))}B`);
    const ctx = makeCtx(s);
    signPartner(s, ctx, 'Silica Systems');
    signPartner(s, ctx, 'Azimuth', { exclusive: true });
    check(/Azimuth's exclusivity blocks deals with Northwind/.test(partnerBlocker(s, 'Northwind Cloud') ?? '') && partnerCosts(s).find((c) => c.partner === 'Azimuth')?.blocks.join(',') === 'Northwind Cloud',
      'FIN4b an exclusive partner blocks its competitor while the deal runs, shown in its costs', `${partnerBlocker(s, 'Northwind Cloud')}`);
  }
  {
    // IP access: only from a hyperscaler with an in-house lab (a big-tech rival); +20% of the equity; the preview says
    // what it costs in plain words; signed, the lab gains 10% a year of the capability gap as know-how (labDaily).
    const plain = fx();
    plain.rivals[1].npc.kind = 'racer'; // no big-tech rival
    check(!!partnerTerms(plain, 'Azimuth', { ipAccess: true }).options.ipAccess.blocked && !partnerTerms(plain, 'Azimuth', { ipAccess: true }).strings.ipAccess && !!partnerTerms(plain, 'Silica Systems').options.ipAccess.blocked, 'FIN4b no IP access without an affiliated lab (no big-tech rival), nor from a chip vendor');
    const s = roomy(withLabs(fx()));
    const lab = affiliatedLab(s, 'Azimuth')!;
    check(partnerTerms(s, 'Azimuth', { ipAccess: true }).options.ipAccess.blocked === 'You have no lead to license', 'FIN4b no IP access without a lead over its lab');
    const s0 = structuredClone(s);
    lab.npc.d -= 100 - leadEstimate(s, lab.core.id); // a 100-day lead: ~3.3 months of the 6 that earn the full 20%
    const lead = leadEstimate(s, lab.core.id);
    const t0 = partnerTerms(s, 'Azimuth');
    const t = partnerTerms(s, 'Azimuth', { ipAccess: true });
    const pv = FINANCE_ACTIONS.find((a) => a.id === 'fin.partner')!.preview(s, { partner: 'Azimuth', ipAccess: true });
    const line = pv.costs.find((c) => c.currency === 'leadDays');
    check(lab.core.id === s.rivals[1].core.id && !affiliatedLab(s, 'Northwind Cloud') && t.strings.ipAccess?.lab === lab.core.id && near(termsEquity(t), termsEquity(t0) * (1 + ST.ipBump * Math.min(1, lead / 30.4 / ST.ipFullLeadMonths))) && near(t.options.ipAccess.bump, termsEquity(t) - termsEquity(t0)) && !!line && new RegExp(`${lab.core.name} \\(Azimuth's lab\\) licenses your models and closes ~10% of your lead a year`).test(String(line.target)),
      'FIN4b IP access (a hyperscaler with an in-house lab): up to +20% of the equity, by your lead over it; the preview says the lab closes ~10% of your lead a year, in days at your estimated lead', String(line?.target));
    const a = structuredClone(s0);
    const b = structuredClone(s0);
    a.player.finance.deals.push({ id: 'DLip', partner: 'Azimuth', kind: 'hyperscaler', day: a.time.day, equityNow: 0, equityLater: 0, strings: { ipAccess: { lab: s.rivals[2].core.id } }, until: a.time.day + 2000 });
    const labOf = (x: GameStateV2) => x.rivals.find((r) => r.core.id === s.rivals[2].core.id)!;
    labOf(a).npc.d += 500; // behind the licensed model, so there is a gap to close (the fixture's rivals are ahead of it)
    labOf(b).npc.d += 500;
    const want = ipAccessDays(a, labOf(a)); // N6: the days its lag falls a day (a share of the way to the licensed model)
    check(want > 0 && ipAccessDays(b, labOf(b)) === 0 && partnerCosts(a).find((c) => c.partner === 'Azimuth')?.ip?.lab === s.rivals[2].core.id,
      'FIN4b a signed IP access moves the affiliated lab lag a share of the way to the licensed model each day (npc/shocks.ts ipAccessDays); none without it', `${want.toExponential(2)} d a day`);
  }
  {
    // A mission body (§7.2): IP access that would license a capability-threshold model needs its transfer vote
    // (not forceable): a no stops the deal with IP access; without IP access it signs. A rescue's IP access is not
    // voted: its licence stops below the thresholds.
    const s = shape(roomy(withLabs(fx())), 'mission');
    const lab2 = affiliatedLab(s, 'Azimuth')!;
    lab2.npc.d -= 100 - leadEstimate(s, lab2.core.id);
    const best = licensedModel(s)!;
    // FINM: the model-v3 day-400 fixture's best version crossed no threshold (RefBot's RL focus there sets no danger
    // flag), so the test marks it as a capability-threshold model.
    best.flags.cyberOffense = true;
    const t = partnerTerms(s, 'Azimuth', { ipAccess: true });
    const vs = dealVotes(s, t);
    const v = vs.find((x) => x.decision === 'transferModel');
    const cash0 = s.player.finance.cash;
    const err = act(s, 'fin.partner', { partner: 'Azimuth', ipAccess: true, force: true });
    const nothing = s.player.finance.cash === cash0 && !dealWith(s, 'Azimuth');
    const ok2 = !act(s, 'fin.partner', { partner: 'Azimuth' });
    s.player.finance.state = 'distress';
    const rt = partnerTerms(s, 'Azimuth', { rescue: true });
    check(capabilityThresholds(best).length > 0 && !!v && v.body === 'trust' && !v.passes && !v.canForce && vs[0] === v && !!err && nothing && ok2 && !!rt.strings.ipAccess && !rt.strings.ipAccess.trust && !dealVotes(s, rt).some((x) => x.decision === 'transferModel') && licensedGap(s, rt.strings.ipAccess.lab, true) <= licensedGap(s, rt.strings.ipAccess.lab),
      'FIN4b a mission body: IP access to a capability-threshold model goes to its transfer vote (first, not forceable); its no stops the deal, which signs without IP access; a rescue\'s licence stops below the thresholds', `${best.name}: ${capabilityThresholds(best).join(', ')} · trust ${v?.yes}/${v?.total} · ${err}`);
  }
  {
    // A strategic partner's guarantee opens leases below B: the B rate + 3 points, named on the lease option; a stake from
    // before the start guarantees nothing.
    const s = fx();
    s.player.finance.rating = 'closed';
    const none = leaseRate(s);
    const why = leaseAvailable(s);
    signPartner(s, makeCtx(s), 'Azimuth');
    const r = leaseRate(s);
    const lease = payOptions(s, 10, 'site').find((o) => o.id === 'lease')!;
    check(none === undefined && /partner's guarantee/.test(String(why)) && near(r ?? 0, (CAPEX_LEASE.rate.B ?? 0) + CAPEX_LEASE.guaranteePremium) && !lease.blocked && lease.guarantor === 'Azimuth' && /guaranteed by Azimuth/.test(lease.note) && leaseGuarantor(s) === 'Azimuth',
      'FIN4b below rating B a running hyperscaler or chip-vendor partner guarantees leases at the B rate + 3 points, named on the lease option (a legacy stake does not)', `${F1pct(r ?? 0)} · ${lease.note}`);
  }
}

// ───────────────────────────── FIN5c: big-tech division budget (FINANCE-V3 §13) ─────────────────────────────
{
  const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const bigtech = (seed = 5) => newGame(defaultSetupV2({ seed, world: 'tl-central', alignment: 'medium', tutorial: false, labKind: 'bigtech' }));
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
    check(!!d && d.year === 0 && d.budget === parentBudgetYear(0) && d.factor === 1 && near(d.paid, 4) && near(d.carryIn, positionOf(s).cash) && goals.length === 3 && goals.every((g) => g.goalWeight === 1 / 3 && g.deadline === review && g.pitch === 'base') && goals.map((g) => g.type).join(',') === 'capability,scale,adoption' && s.player.finance.valuation === 0, 'FIN5c day 0: budget year 0 at the plan ($16B, its first payment in the cash), three parent goals on the trend at the base pitch (a third each) due at the 1 Jul 2026 review; no valuation', JSON.stringify({ budget: d?.budget, paid: d?.paid, carryIn: d?.carryIn, goals: goals.map((g) => `${g.type} ${f1(g.start)}→${f1(g.target)}`) }));
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
    const ov = ousterVote(s);
    check(s.player.finance.state === 'healthy' && !causes(s, 'financial distress').length && ov.live && ov.passes && ov.seats.some((x) => x.holder === 'Azimuth' && x.yes) && criticsAvailable(s) === true, 'FIN5c a division has no runway verdict (healthy at −$40B, no distress source); C3: its board holds the ouster vote like any board (the parent\'s seats vote it) and can seat the critics', `state ${s.player.finance.state} · ouster ${ov.yes}/${ov.total} · ${criticsAvailable(s)}`);
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
    // (A year of ticks on a day-400 state: full tier only; quick checks the shown / deferred / tallied identities.)
    let paid = win1;
    if (!SMOKE) {
      const t = deserialize(serialize(s));
      while (t.time.day < dayOfQuarter(t.time.startDate, q1) - 1) tick(t, { skip: ['endings', 'director'] });
      const paid0 = -(totalFlows(t).commitments ?? 0);
      while (t.time.day < dayOfQuarter(t.time.startDate, q1 + RENEGOTIATE.quarters) - 1) tick(t, { skip: ['endings', 'director'] });
      paid = -(totalFlows(t).commitments ?? 0) - paid0;
    }
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
    const s = shape(fx(), 'mission');
    s.player.finance.state = 'healthy';
    act(s, 'fin.raise', { ask: 0.1, type: 'scale', pitch: 'base' });
    const pre = s.player.finance.ws3.pendingRound!.preMoney;
    while (s.player.finance.ws3.pendingRound) tick(s, { skip: ['endings', 'director'] });
    const p = s.player.finance.promises[s.player.finance.promises.length - 1];
    const w = promiseWeight(s, p);
    const r = s.player.finance.rounds[s.player.finance.rounds.length - 1];
    // Four equal ceiling-sized rounds in a year: ≈ 25% each; one alone: 100%.
    const x = fx();
    const A = typicalRound(1000, dMax(false));
    x.player.finance.rounds = [0, 1, 2, 3].map((k) => ({ day: x.time.day - 360 + 91 * k, amount: A, postMoney: 1000 + A, dilution: 0.08, down: false }));
    const ps = x.player.finance.rounds.map((rr, k) => ({ id: `P${k}`, type: 'scale' as const, pitch: 'base' as const, start: 1, target: 2, amount: A, closeDay: rr.day, deadline: rr.day + 365, typical: A }));
    const ws = ps.map((pp) => promiseWeight(x, pp));
    const lone = promiseWeight({ ...x, player: { ...x.player, finance: { ...x.player.finance, rounds: [x.player.finance.rounds[0]] } } }, ps[0]);
    check(near(p.typical ?? 0, typicalRound(r.postMoney - r.amount, dMax(false))) && w < 0.05 && near(ws[0], 0.25) && near(lone, 1), 'FIN4r H2 a promise weighs its round ÷ max(the year\'s rounds, a typical round at the close): a $0.1B round barely counts; four ceiling-sized rounds 25% each, one 100%', `$0.1B at $${f1(pre)}B pre: typical $${f1(p.typical ?? 0)}B → weight ${(w * 100).toFixed(2)}% · stacked ${ws.map((y: number) => `${Math.round(y * 100)}%`).join('/')} · lone ${Math.round(lone * 100)}%`);
  }
  {
    // H3: a round of $20B or more pays half at the close; every preview shows the tranche; a lapse cancels the unpaid
    // shares (as if half the round had been raised at the same price); the IPO and the distress down round pay in full.
    const s = shape(fx(), 'mission');
    s.player.finance.state = 'healthy';
    const pv = FINANCE_ACTIONS.find((a) => a.id === 'fin.raise')!.preview(s, { ask: 40, type: 'scale', pitch: 'base' });
    const cash = pv.gains.filter((g) => g.currency === 'cash');
    const close = dayOfQuarter(s.time.startDate, qOf(s) + 1);
    const sp = roundSplit(s, 40, { closeDay: close });
    const ipo = FINANCE_ACTIONS.find((a) => a.id === 'fin.ipo')!.preview(s, { ask: 40 }).gains.filter((g) => g.currency === 'cash');
    check(cash.length === 2 && near(cash[0].amount, 20) && near(cash[1].amount, 20) && /tranche: if revenue run-rate reaches/.test(String(cash[1].target)) && near(cash[1].lagDays ?? 0, sp.tranche!.dueDay - s.time.day) && ipo.length === 1 && near(ipo[0].amount, 40), 'FIN4r H3 the raise preview shows cash at the close and the conditional tranche (amount, condition, deadline); the IPO pays in full', cash.map((c) => `$${f1(c.amount)}B in ${c.lagDays}d ${c.target}`).join(' · '));
    // The booking matches the preview; a lapse cancels the unpaid shares.
    const a = shape(fx(), 'mission');
    const P = a.player.finance.valuation;
    const now = bookRound(a, makeCtx(a), 40, P);
    const t = a.player.finance.tranches[a.player.finance.tranches.length - 1];
    const sp2 = roundSplit(shape(fx(), 'mission'), 40);
    t.condition = 'revenue:1e9';
    t.deadline = dayOfQuarter(a.time.startDate, qOf(a) + 1);
    while (a.time.day < t.deadline) tick(a, { skip: ['endings', 'director', 'capitalQ'] });
    capitalQSystem.run(a, makeCtx(a));
    const b = shape(fx(), 'mission');
    bookRound(b, makeCtx(b), 20, P, { full: true });
    const o = a.player.finance.ownership;
    const ob = b.player.finance.ownership;
    const same = (['founder', 'mission', 'fin', 'public'] as const).every((k) => near(o[k], ob[k], 1e-9)) && near(o.strat['Northwind Cloud'], ob.strat['Northwind Cloud'], 1e-9);
    check(near(now, 20) && near(t.amount, sp2.tranche!.amount) && !a.player.finance.tranches.includes(t) && same, 'FIN4r H3 a lapsed round tranche cancels its shares pro rata: the cap table is that of the half actually raised at the same price', `founder ${(o.founder * 100).toFixed(2)}% vs ${(ob.founder * 100).toFixed(2)}% · financial ${(o.fin * 100).toFixed(2)}% vs ${(ob.fin * 100).toFixed(2)}%`);
    // The distress down round: in full now, no tranche, whatever its size.
    const d = fx();
    d.player.finance.valuation = 400; // the round is min(9% of the valuation, 3 quarters of burn), at least $10B: a $20B+ round needs both
    addCloud(d, makeCtx(d), 1.2e7, 8, 'Vantage Neocloud', { startQ: 0 }); // a burn large enough for a $20B+ down round
    d.player.finance.state = 'distress';
    const n0 = d.player.finance.tranches.length;
    const c0 = d.player.finance.cash;
    const dv = FINANCE_ACTIONS.find((a) => a.id === 'fin.downRound')!.preview(d, {});
    const errD = act(d, 'fin.downRound', {});
    check(!errD && dv.gains[0].amount >= LARGE_ROUND.min && d.player.finance.tranches.length === n0 && near(d.player.finance.cash - c0, dv.gains[0].amount), 'FIN4r H3 the distress down round pays in full at the close (no tranche)', `$${f1(d.player.finance.cash - c0)}B`);
  }
  {
    // M1 (C7a): a partner's 'spent:' tranche condition counts what is paid to the partner after signing, not what was paid before.
    const s = fx();
    s.player.finance.ws3.paidTo = { Azimuth: 50 };
    const t = partnerTerms(s, 'Azimuth');
    signPartner(s, makeCtx(s), 'Azimuth');
    const tr = s.player.finance.tranches.find((x) => x.partner === 'Azimuth')!;
    const amt = Number(tr.condition!.split(':')[2]);
    const m0 = trancheConditionMet(s, tr.condition!, tr);
    s.player.finance.ws3.paidTo!.Azimuth = 50 + amt - 0.1;
    const m1 = trancheConditionMet(s, tr.condition!, tr);
    s.player.finance.ws3.paidTo!.Azimuth = 50 + amt;
    check(!m0 && !m1 && trancheConditionMet(s, tr.condition!, tr) && tr.spentBase === 50 && t.tranches[0].condition === tr.condition, 'FIN4r M1 a spent: tranche counts payments to the partner since signing (what was paid before does not count)', `needs $${f1(amt)}B after signing`);
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
  if (!SMOKE) { // waits up to 6 years of ticks: full tier (TODO a constructed version from siteSchedule)
    // M3: a site lease capitalises construction interest on what the lessor has paid: the upfront 5% over the whole
    // wait and build-out, each building payment from when it is paid (nothing is paid while waiting for power; the first
    // building payment falls in the quarter construction starts [D-7]). The booking follows that schedule; the preview uses it.
    const s = fx();
    s.player.finance.cash = 1e4;
    s.player.finance.rating = 'BB';
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push(newSite(s, makeCtx(s), { path: 'gas', mw: 500, pay: 'lease', leaseRate: 0.09, community: false }).id);
    const start = qOf(s);
    const sched = new Map<string, { buildQ0?: number }>();
    for (const id of ids) sched.set(id, {});
    while (s.time.day < 400 + 6 * 365 && ids.some((id) => { const x = s.player.sites.find((y) => y.id === id)!; return x.stage !== 'live' && x.stage !== 'blocked'; })) {
      tick(s, { skip: ['endings', 'director'] });
      for (const id of ids) {
        const x = s.player.sites.find((y) => y.id === id)!;
        const r = sched.get(id)!;
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
      const g = constructionGrowth(0.09, { etaQ: liveQ - start, buildQ: liveQ - (r.buildQ0 ?? liveQ), firstNow: true });
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
    const s = shape(fx(), 'founders');
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
    // L4: the IPO's dual-class discount is a valuation line, not cash. (L5, an anchor on a raise, went with anchoring.)
    const s = fx();
    const pv = FINANCE_ACTIONS.find((a) => a.id === 'fin.ipo')!.preview(s, { dualClass: true });
    check(pv.exposure.some((e) => e.currency === 'valuation' && e.amount < 0) && !pv.exposure.some((e) => e.currency === 'cash' && /dual-class/.test(String(e.target))), 'FIN4r L4 the dual-class discount is shown on the valuation (not cash)');
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
    // L8 (C2): the critics' investor director sits on top of the seats votes elect, never in place of one.
    const s = shape(fx(), 'founders');
    const n0 = boardSeats(s).length;
    s.player.board.extraSeats.push({ kind: 'financial', holder: `${CRITICS_INVESTOR} (2026)`, stance: [1, 1, 0, 0], weight: 1 });
    check(n0 === 7 && boardSeats(s).length === n0 + 1 && boardSeats(s).filter((x) => x.kind === 'financial').length === 2, 'FIN4r L8 the critics\' investor director is not one of the seats votes elect', boardSeats(s).map((x) => x.holder).join(', '));
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
    check(me.id === 'player' && labs.length === priv.length + 1 && labs.slice(1).every((a) => priv.includes(a.id)) && near(sum, 1, 1e-9) && ok && near(w1 / w0, CHARTER_APPEAL.dualClass, 1e-9) && near(me.gov, appealOf(s.player.charter), 1e-9), 'FIN5a share = cred · gov · exp(z/τ) ÷ Σ over the private labs (big-tech and parent-funded labs out); dual-class ×0.95 on the weight', `${labs.map((a) => `${a.id} ${F1pct(a.share)}`).join(' · ')}`);
  }
  {
    // Drivers: position against the best public model of any other lab, in 2-level units; a lab with no public model
    // sits at the best open-weight model; pre-revenue: momentum ×1 (log 0), economics at the field's (x = 0).
    const sp = newGame(defaultSetupV2({ seed: 1, labKind: 'breakaway' }));
    const st = storyNow(sp);
    const me = st.me!;
    const best = Math.max(...sp.rivals.filter((r) => r.core.status === 'active').map((r) => r.publicModel?.Lg ?? 0));
    const fl = openWeightFloor(sp);
    check(me.floored && near(me.level, fl, 1e-9) && near(me.x.position, Math.max(-3, (fl - best) / STORY.posScale), 1e-9) && me.growth === 1 && me.margin === null && me.x.economics === 0 && growthOf(0, [0, 0, 0, 0]) === 1, 'FIN5a a lab without a public model sits at the best open-weight model; a pre-revenue lab has momentum ×1 and the field\'s economics', `level ${me.level.toFixed(2)} vs best ${best.toFixed(2)} → x ${me.x.position.toFixed(2)} · momentum x ${me.x.momentum.toFixed(2)} · capacity x ${me.x.capacity.toFixed(2)}`);
    // Start valuations from the split: a pre-revenue spinout is valued through position (SSI $32B, TML $12B), the
    // challenger near Anthropic's $61.5B, the leader near OpenAI's $300B (median of seeds 1–6).
    const V = (labKind: 'leader' | 'safety' | 'breakaway') => median([1, 2, 3, 4, 5, 6].map((seed) => newGame(defaultSetupV2({ seed, labKind })).player.finance.valuation));
    const v = { leader: V('leader'), safety: V('safety'), breakaway: V('breakaway') };
    check(v.breakaway >= 10 && v.breakaway <= 80 && v.safety >= 40 && v.safety <= 200 && v.leader >= 200 && v.leader <= 500 && st.V > 0, 'FIN5a start valuations from the split: spinout (pre-revenue) $10–80B, challenger $40–200B, leader $0.2–0.5T (medians, seeds 1–6; 2025 marks: TML $12B, SSI $32B, Anthropic $61.5–183B, OpenAI $300–500B)', `spinout ${f1(v.breakaway)}B · challenger ${f1(v.safety)}B · leader ${f1(v.leader)}B`);
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
}

// ───────────────────────────── FIN5b: rivals' finance (FINANCE-V3 §12) ─────────────────────────────
{
  const fx = (): GameStateV2 => deserialize(readFileSync(join(FIXTURE_DIR, 'day400.json'), 'utf8'));
  const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  const priv = (s: GameStateV2) => s.rivals.filter((r) => r.core.status === 'active' && r.finance.valuation > 0 && !parentFunded(r));
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
    const govs = (['safety', 'racer', 'upstart', 'leader'] as const).map((k) => appealOf(RIVAL_CHARTER[k]));
    check(up.mult === 1 && down.mult === 0.9 && halved.mult === 0.7 && w.cred === halved.mult && w.rung === 'Doubted' && w.gov === rivalGov(r) && govs.join(',') === '0.9,1,1,0.9' && near(w.weight, w.cred * w.gov * Math.exp(w.z / STORY.tau), 1e-12), 'FIN5b a rival\'s credibility comes from one rule (revenue up over four quarters: Credible ×1, down: Unproven ×0.9, halved: Doubted ×0.7) and its governance from the charter of its kind (safety and leader labs a mission body ×0.9, racer and upstart founder-led ×1), both in its weight', `growth ×${up.growth.toFixed(1)} ${up.id} · ×${down.growth.toFixed(2)} ${down.id} · ×${halved.growth.toFixed(2)} ${halved.id}`);
  }
  {
    // The bust's push (FIN3c gap): the most over-committed private rival raises nothing that quarter, is in distress
    // and is offered to you (E32), even with cash in the bank; unbought, it exits next quarter by license-and-hire (FINANCE-V3 §12;
    // the old 'recovers if it has cash again' is gone).
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
    const offered = s.events.requests.some((q) => q.id === 'E32' && q.data.lab === target.core.id);
    const s2 = deserialize(serialize(s));
    s2.time.day += 91;
    const t2 = s2.rivals.find((x) => x.core.id === target.core.id)!;
    t2.finance.poolQ = 1e6;
    t2.finance.cash = rivalSpend(t2); // even with a year of spend in the bank
    rivalMoneyQ(s2, makeCtx(s2), t2);
    check(pushed && offered && target.finance.distress && target.finance.valuation === V0 && t2.core.status !== 'active', 'FIN5b a bust pushes the most over-committed private rival into distress: it raises nothing that quarter and is offered to you (E32); unbought, it exits next quarter (license-and-hire, §12)', target.core.name);
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
    // An ask inside the ceiling: above it the quote prices the over-ask in (pre × (1 − ½·over)), which this check is not about.
    const ask = 0.9 * raiseQuote(s, Number.POSITIVE_INFINITY, { pitch: 'aggressive' }).ceiling.max;
    const q = raiseQuote(s, ask, { pitch: 'aggressive' });
    const err = act(s, 'fin.raise', { ask, type: 'scale', pitch: 'aggressive' });
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
}

console.log(`finance: ${FINANCE_ACTIONS.length} actions (${applied} applied on day400), no events`);
finish('finance');
// Cost (count): quick (--smoke) ≈ 70 s wall, no bot game; the quick part is FIN5c bigtech sims (≈ 15 s), idle ticks of
// FIN1/FIN2/FIN3 (≈ 20 s), day-400 loads. Full adds the year of ticks (≈ 20 s) and the site wait (≈ 47 s).
