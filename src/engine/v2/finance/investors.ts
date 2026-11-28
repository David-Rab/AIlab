// Investor pool, hype, bubble, tranches, valuation marks, rating, covenants (V2-SPEC §3.7.3–3.7.4; research/15 §1.4–1.7).
// Owner: WS3.
import { divisionQ } from './parent';
import { decimalYear } from '../core/time';
import type { CapitalMarkets, EngineSystem, GameStateV2, Money, SystemCtx } from '../types';
import type { StoryNow } from './story';
import { covenantsBreached, ratingOf, ratingScore, rollMaturities } from './debt';
import { gwOwned, publicFrontier } from './observe';
import { cancelTrancheShares, closePendingRound, partnerEquityIn } from './equity';
import { bustTarget, markRivals, RIVAL } from './rivalFinance';
import { DRIVERS, markShare, poolAnnualOf, privateRivals, recordLabRevenue, sectorRunRate, STORY, storyNow } from './story';
import { defaultCapitalWS3, ensureWs3, yearStats } from './ext';
import { commitmentsPerYear, bookCash } from './ledger';
import { judgePromises, recordThesisHist } from './promises';
import { boardMood, MOOD_BASE } from './mood';

/** Capital markets at Jul 2025. The investor pool (π · sector value, FIN5a) and the player's part of it are set by
 *  startStory once the rivals exist (newGame). */
export function initialCapital(rSector: number): CapitalMarkets {
  return {
    y10: 4.4,
    sofr: 4.1,
    hype: 1.0,
    poolAnnual: 0,
    carry: 0,
    ipoWindow: false,
    bubbleX: 2.0,
    shocks: [],
    ws3: { ...defaultCapitalWS3(1.0), rSectorHist: [rSector] },
  };
}

/** Hype shocks (R15 §1.4): ΔH and half-life in quarters. */
export const SHOCKS = {
  cheapRival: { dH: 0.2, halfLifeQ: 1 }, // "DeepSeek moment": Nvidia −17% on 27 Jan 2025
  financingDoubt: { dH: 0.25, halfLifeQ: 2 }, // Nov 2026 selloff
  incident: { dH: 0.25, halfLifeQ: 2.5 }, // scaled by severity (0.1–0.4)
  sectorBust: { dH: 0.6, halfLifeQ: 4 },
} as const;
export type ShockKind = keyof typeof SHOCKS;

const shockNow = (sh: CapitalMarkets['shocks'][number], day: number) => sh.dH * Math.pow(0.5, (day - sh.day) / 91 / sh.halfLifeQ);

/** Apply a hype shock now (WS2 incidents, WS4 events such as a cheap open model). `scale` multiplies ΔH. The player's
 *  pool for the rest of the quarter shrinks with H. */
export function applyShock(s: GameStateV2, ctx: SystemCtx, kind: ShockKind, scale = 1): void {
  ensureWs3(s);
  const c = s.capital;
  const dH = SHOCKS[kind].dH * scale;
  const H0 = c.hype;
  c.shocks.push({ kind, dH, halfLifeQ: SHOCKS[kind].halfLifeQ, day: s.time.day });
  c.hype = Math.max(0.3, c.hype - dH);
  const k = c.hype / Math.max(0.01, H0);
  c.poolAnnual *= k;
  c.ws3.playerPoolQ *= k;
  ctx.log('finance', `Investor sentiment hit (${kind}): hype ${H0.toFixed(2)} → ${c.hype.toFixed(2)}.`, 2);
}

/** Markets' initial expected public-frontier pace, levels per quarter (the 2025–26 reference release path) [D, M4]. */
export const EXPECTED_DL_Q = 0.3;
/** Quarterly adaptation of that expectation toward the observed pace [D, M4]. */
export const EXPECT_ADAPT = 0.1;

/** Hype update (R15): H_base' = 1 + 0.85(H_base − 1) + 0.15·surprise + 0.10·(g_sector − 3)/3; H = H_base − Σ shocks. */
function updateHype(s: GameStateV2, gSector: number) {
  const c = s.capital;
  const w = c.ws3;
  const L = publicFrontier(s);
  // Surprise = the public frontier's pace over the last four quarters against the expected pace (M4: releases are
  // lumpy, so a one-quarter difference read every quiet quarter as a disappointment) [D].
  const hist = (w.frontierHist ??= []);
  const first = hist.length ? hist[0] : w.lastFrontierL;
  const rate = first > 0 ? (L - first) / Math.max(1, hist.length) : EXPECTED_DL_Q;
  hist.push(L);
  if (hist.length > 4) hist.shift();
  w.lastFrontierL = L;
  // Adaptive expectations: the market's expected pace moves 10% a quarter toward the observed pace (floor 0.1 L/q),
  // so a slow world is not a permanent disappointment and only a real acceleration surprises.
  const expected = w.expectedDL ?? EXPECTED_DL_Q;
  const surprise = Math.max(-1, Math.min(2, (rate - expected) / expected));
  w.expectedDL = Math.max(0.1, expected + EXPECT_ADAPT * (rate - expected));
  w.hypeBase = 1 + 0.85 * (w.hypeBase - 1) + 0.15 * surprise + (0.1 * (gSector - 3)) / 3;
  c.shocks = c.shocks.filter((sh) => shockNow(sh, s.time.day) > 0.005);
  const shock = c.shocks.reduce((a, sh) => a + shockNow(sh, s.time.day), 0);
  c.hype = Math.max(0.3, Math.min(2.5, w.hypeBase - shock));
}

/** Bubble pressure X_t = (sector commitments next 4q + sector capex) / R_sector; p_bust = 0.005 + 0.02·max(0, X − 3),
 *  cap 0.12 per quarter (R15 §1.4). Rivals' commitments are their annual book [D]. */
export function bubbleX(s: GameStateV2): number {
  const f = s.player.finance;
  const capex = f.ws3.capex4q.reduce((a, b) => a + b, 0);
  const rivals = privateRivals(s).reduce((a, r) => a + r.finance.commitments, 0);
  return (commitmentsPerYear(s) + capex + rivals) / Math.max(1, sectorRunRate(s));
}
export const bustProbQ = (X: number) => Math.min(0.12, 0.005 + 0.02 * Math.max(0, X - 3));

function cumulativeCapex(s: GameStateV2): Money {
  let sum = 0;
  for (const y of Object.values(s.player.finance.ws3.years)) sum += y.capexChips + y.capexSites + y.capexSitesFinanced + y.supplierFunding;
  return sum;
}

/** Tranches: land when due and the condition holds; conditional tranches lapse at their deadline. */
function settleTranches(s: GameStateV2, ctx: SystemCtx) {
  const f = s.player.finance;
  const keep = [];
  for (const t of f.tranches) {
    const met = !t.condition || trancheConditionMet(s, t.condition);
    if (t.dueDay <= s.time.day && met) {
      // A partner's tranche buys shares at today's valuation (FIN4a); a round's tranche was priced at the close.
      if (t.partner) partnerEquityIn(s, ctx, t.partner, t.amount, t.source, t.stakeCap);
      else {
        bookCash(s, ctx, t.amount, 'financing', 'equity tranche', t.source);
        yearStats(s).equity += t.amount;
      }
      continue;
    }
    if (t.deadline !== undefined && t.deadline <= s.time.day && !met) {
      const paid = t.condition === 'recapitalisation' ? Math.min(10, t.amount) : 0;
      if (t.condition === 'recapitalisation') {
        // SoftBank precedent: $30B → $10B if the recapitalisation does not close by the deadline [R15].
        ctx.log('finance', `${t.source}: recapitalisation missed; the investor cuts the tranche to $10B.`, 2);
        bookCash(s, ctx, paid, 'financing', 'equity tranche', `${t.source} (reduced)`);
        yearStats(s).equity += paid;
      } else ctx.log('finance', `${t.source}: condition (${t.condition}) not met; $${t.amount.toFixed(1)}B lapses.`, 2);
      // FIN4r (H3): a round's investors keep only the shares they paid for.
      const c = cancelTrancheShares(s, t, 1 - paid / Math.max(1e-9, t.amount));
      if (c > 0) ctx.log('finance', `${t.source}: the unpaid investors' shares are cancelled (${(c * 100).toFixed(1)}% of the company).`, 2);
      continue;
    }
    keep.push(t);
  }
  f.tranches = keep;
}

/** Tranche conditions: 'recapitalisation', 'revenue:<R>', 'gw:<GW online>', 'ipo'. FIN4r (M1): 'gw:' counts the
 *  compute online in your own sites (`gwOwned`), not rented cloud or spot capacity (a hyperscaler's own cloud must
 *  not meet its condition). */
export function trancheConditionMet(s: GameStateV2, cond: string): boolean {
  const f = s.player.finance;
  if (cond === 'recapitalisation') return f.ws3.recap.doneDay !== undefined;
  if (cond === 'ipo') return f.ownership.public > 0;
  const [k, v] = cond.split(':');
  if (k === 'revenue') return f.revenueRun >= Number(v);
  if (k === 'gw') return gwOwned(s) >= Number(v);
  return false;
}

/** capitalQ (420, quarterly): hype, investor pool, bubble roll, raises close, tranches land, valuation mark, rating,
 *  covenants, legacy recapitalisation. */
export const capitalQSystem: EngineSystem = {
  id: 'capitalQ', owner: 'WS3', cadence: 'quarterly', order: 420, system: 'finance',
  run(s, ctx) {
    ensureWs3(s);
    const c = s.capital;
    const w = c.ws3;
    const f = s.player.finance;
    const fx = f.ws3;

    // Quarter accumulators → operating cash flow and capex history.
    fx.opCashQ = fx.accQ.revenue - fx.accQ.opCosts;
    const ocf = (fx.opCash4q ??= []);
    ocf.push(fx.opCashQ);
    if (ocf.length > 4) ocf.shift();
    fx.accQ = { revenue: 0, opCosts: 0 };
    const cum = cumulativeCapex(s);
    fx.capex4q.push(cum - fx.capexCumAtQ);
    if (fx.capex4q.length > 4) fx.capex4q.shift();
    fx.capexCumAtQ = cum;
    fx.cashAtQStart = f.cash;

    // Hype and the investor pool.
    const R = sectorRunRate(s);
    w.rSectorHist.push(R);
    if (w.rSectorHist.length > 5) w.rSectorHist.shift();
    const gSector = Math.max(0.5, Math.min(8, R / Math.max(0.1, w.rSectorHist[0])));
    updateHype(s, gSector);
    const busted = c.busted && c.busted.recoverDay > s.time.day;
    if (c.busted && !busted) delete c.busted;
    // IPO window: the first lab IPOs open a one-time public pool (2026) while hype holds [R15, D].
    if (!c.ipoWindow && decimalYear(s) >= 2026.5 && c.hype >= 0.9 && !busted) {
      c.ipoWindow = true;
      w.ipoOpenedDay = s.time.day;
    }
    if (c.ipoWindow && w.ipoOpenedDay !== undefined && s.time.day - w.ipoOpenedDay > 365 && f.ownership.public <= 0) c.ipoWindow = false;
    // Bubble roll.
    c.bubbleX = bubbleX(s);
    if (!busted && ctx.rng('finance').chance(bustProbQ(c.bubbleX))) {
      c.busted = { day: s.time.day, recoverDay: s.time.day + 365 };
      c.shocks.push({ kind: 'sectorBust', dH: SHOCKS.sectorBust.dH, halfLifeQ: SHOCKS.sectorBust.halfLifeQ, day: s.time.day });
      c.hype = Math.max(0.3, c.hype - SHOCKS.sectorBust.dH);
      w.spreadAddBp = 100 * Math.max(0, c.bubbleX - 3) / 3;
      // (FIN5a: the pool and the valuations fall through the sector value's bust factor, computed below.)
      // The most over-committed private rival is pushed into distress: it raises nothing this quarter and is offered to
      // you (E32); if still failing next quarter it exits (FIN5b, finance/rivalFinance.ts rivalMoneyQ).
      const r = bustTarget(s);
      if (r) c.busted.rival = r.core.id;
      ctx.log('alert', `AI investment bust: the pool for lab equity collapses and credit spreads widen (X = ${c.bubbleX.toFixed(1)}).`, 4);
      ctx.headline('bust', 'AI stocks crash as investors question trillion-dollar compute bets');
    } else if (!busted) w.spreadAddBp = Math.max(0, w.spreadAddBp * 0.5);

    // Lifting the profit cap completes after 4 quarters (AG review); the mission body stays (CORPORATE.md §4).
    if (fx.recap.startDay !== undefined && fx.recap.doneDay === undefined && s.time.day - fx.recap.startDay >= 360) {
      fx.recap.doneDay = s.time.day;
      s.player.charter.profitCap = false;
      ctx.log('finance', 'Recapitalisation complete: the profit cap is lifted; the mission body keeps its seats. Conditional tranches are freed.');
    }

    // Promises due this quarter are judged first (FIN2: they move credibility, which the share reads). Then the story
    // (FIN5a, spec §1): the sector value and each private lab's share; the investor pool is π · S (× the IPO window's
    // bump), split by the same share, the player's unused part carrying 50% [R15]; the valuation is marked at S × share.
    // Raises close at it, tranches land; the milestone and revenue histories roll. A division (R9) has no valuation and
    // raises nothing; the parent reviews its year and pays its budget instead (FIN5c, after the histories roll: the new
    // goals read this quarter's trend).
    judgePromises(s, ctx);
    const st = storyNow(s);
    c.poolAnnual = poolAnnualOf(s, st.sector.S);
    c.carry = STORY.carry * Math.max(0, w.playerPoolQ - w.playerTakenQ); // rivals take their shares; the player's unused part carries
    const share = st.me ? markShare(s, st.share) : 0;
    w.playerShare = share;
    w.playerPoolQ = w.playerShare * (c.poolAnnual / 4 + c.carry);
    w.playerTakenQ = 0;
    if (st.me) markValuation(s, ctx, st, share);
    markRivals(s, st); // FIN5b: every private rival on the same story, and its part of the pool
    closePendingRound(s, ctx);
    settleTranches(s, ctx);
    f.revenueHistory.push(f.revenueRun);
    if (f.revenueHistory.length > 8) f.revenueHistory.shift();
    recordLabRevenue(s);
    recordThesisHist(s);
    divisionQ(s, ctx);

    // Debt: maturities, covenants, rating (spec §3). The credit line is re-sized only when you borrow (debt.ts).
    // FIN4r (L10): both run every quarter (a maturity that could not be repaid used to skip the covenant tests and the
    // chip-loan sweep).
    const unpaid = rollMaturities(s, ctx);
    const covenant = covenantsBreached(s, ctx);
    const breach = unpaid || covenant;
    if (breach && f.covenantBreachDay === undefined) {
      f.covenantBreachDay = s.time.day;
      boardMood(s, ctx, 'setbacks', MOOD_BASE.covenantBreach, 'covenant breach');
      ctx.log('alert', 'Covenant breach: lenders can call the debt.', 4);
    } else if (!breach && f.covenantBreachDay !== undefined) delete f.covenantBreachDay;
    f.rating = ratingOf(ratingScore(s));
  },
};

const T$ = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(2)}T` : `${x.toFixed(0)}B`);
const X$ = (x: number) => `×${x.toFixed(2)}`;

/** The quarterly mark (FIN5a): V = S × share. Its change is booked as two causes: the sector's move (the last mark
 *  scaled by S / S_last) and the share's (the rest, which also absorbs the gap between a round's post-money and the
 *  mark). */
function markValuation(s: GameStateV2, ctx: SystemCtx, st: StoryNow, share: number): void {
  const f = s.player.finance;
  const me = st.me!;
  const last = f.ws3.mark;
  const V0 = f.valuation;
  const sectorPart = last && last.S > 0 ? V0 * (st.sector.S / last.S - 1) : 0;
  // FIN6a: at most the valuation cap (one rule for every private lab, rivalFinance.ts valueCap).
  const V = Math.min(st.sector.S * share, me.cap ?? Infinity);
  const capCut = st.sector.S * share - V;
  f.valuation = V;
  f.ws3.mark = { S: st.sector.S, share };
  ctx.cause('player.finance.valuation', sectorPart, 'sector value', `${last ? `${T$(last.S)} → ` : ''}${T$(st.sector.S)} · hype ${st.sector.H.toFixed(2)} · rates ${X$(st.sector.M)}${st.sector.bust < 1 ? ` · bust ${X$(st.sector.bust)}` : ''}`);
  if (capCut > 0) ctx.cause('player.finance.valuation', -capCut, 'valuation cap', `at most ${T$(me.cap!)}: ${me.revenue < STORY.preRevenue || me.cap! <= RIVAL.team ? 'team value' : `${(me.cap! / me.revenue).toFixed(0)}× revenue at ×${me.growth.toFixed(1)} a year`}`);
  ctx.cause('player.finance.valuation', V + capCut - V0 - sectorPart, 'your share', `${last ? `${(last.share * 100).toFixed(1)}% → ` : ''}${(share * 100).toFixed(1)}% · ${DRIVERS.map((k) => `${k} ${X$(st.effect[k])}`).join(' · ')} · credibility ${X$(me.cred)} · governance ${X$(me.gov)}`);
}

