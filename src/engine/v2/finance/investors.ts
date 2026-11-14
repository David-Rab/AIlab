// Investor pool, hype, bubble, tranches, valuation marks, rating, covenants (V2-SPEC §3.7.3–3.7.4; research/15 §1.4–1.7).
// Owner: WS3.
import { GOV_FACTOR } from '../../../data/v2/deals';
import { dayOfDate, decimalYear } from '../core/time';
import type { CapitalMarkets, EngineSystem, GameStateV2, Money, SystemCtx } from '../types';
import { covenantsBreached, ratingOf, ratingScore, revolverCap, rollMaturities } from './debt';
import { closePendingRound, valuationNow } from './equity';
import { defaultCapitalWS3, ensureWs3, yearStats } from './ext';
import { commitmentsPerYear, bookCash } from './ledger';

/** Capital markets at Jul 2025. A_t = 4.0·R_sector·H·M(y10)·W with R_sector = private frontier-lab run-rates. */
export function initialCapital(rSector: number): CapitalMarkets {
  return {
    y10: 4.4,
    sofr: 4.1,
    hype: 1.0,
    poolAnnual: 4.0 * rSector,
    carry: 0,
    ipoWindow: false,
    bubbleX: 2.0,
    shocks: [],
    ws3: { ...defaultCapitalWS3(1.0), playerPoolQ: 0.3 * rSector, rSectorHist: [rSector] },
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

/** Private frontier-lab run-rate (player + rivals with a private valuation; Big Tech in-house labs excluded). */
export function sectorRunRate(s: GameStateV2): Money {
  return s.player.finance.revenueRun + s.rivals.filter((r) => r.core.status === 'active' && r.finance.valuation > 0).reduce((a, r) => a + r.finance.revenueRun, 0);
}

/** Player's share of the pool: V^0.5 · momentum · gov over all private labs (R15 §1.4). Rivals: momentum √2.5 [D]. */
export function poolShare(s: GameStateV2): number {
  const f = s.player.finance;
  const h = f.revenueHistory;
  const back = h.length >= 4 ? h[h.length - 4] : h[0] ?? f.revenueRun;
  const mom = Math.sqrt(Math.max(0.5, Math.min(8, f.revenueRun / Math.max(0.1, back))));
  const me = Math.sqrt(Math.max(1, f.valuation)) * mom * GOV_FACTOR[s.player.board.preset];
  let others = 0;
  for (const r of s.rivals) if (r.core.status === 'active' && r.finance.valuation > 0 && !r.finance.distress) others += Math.sqrt(r.finance.valuation) * Math.sqrt(2.5);
  return me / (me + others);
}

/** Frontier level visible to markets: best public model (player deployments, rival public models). */
function publicFrontierL(s: GameStateV2): number {
  let L = 0;
  for (const d of s.player.deployments) {
    if (d.status === 'withdrawn' || d.channel === 'internal') continue;
    const v = s.player.models.versions.find((x) => x.id === d.versionId);
    if (v) L = Math.max(L, v.evals.measuredL ?? v.Lg);
  }
  for (const r of s.rivals) if (r.publicModel) L = Math.max(L, r.publicModel.Lg);
  return L;
}

/** Hype update (R15): H_base' = 1 + 0.85(H_base − 1) + 0.15·surprise + 0.10·(g_sector − 3)/3; H = H_base − Σ shocks. */
function updateHype(s: GameStateV2, gSector: number) {
  const c = s.capital;
  const w = c.ws3;
  const L = publicFrontierL(s);
  const dL = w.lastFrontierL > 0 ? L - w.lastFrontierL : 0.5;
  w.lastFrontierL = L;
  const surprise = Math.max(-1, Math.min(2, (dL - 0.5) / 0.5)); // ~0.5 levels/q expected [D]
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
  const rivals = s.rivals.filter((r) => r.core.status === 'active' && r.finance.valuation > 0).reduce((a, r) => a + r.finance.commitments, 0);
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
      bookCash(s, ctx, t.amount, 'financing', 'equity tranche', t.source);
      yearStats(s).equity += t.amount;
      continue;
    }
    if (t.deadline !== undefined && t.deadline <= s.time.day && !met) {
      if (t.condition === 'recapitalisation') {
        // SoftBank precedent: $30B → $10B if the recapitalisation does not close by the deadline [R15].
        ctx.log('finance', `${t.source}: recapitalisation missed; the investor cuts the tranche to $10B.`, 2);
        bookCash(s, ctx, Math.min(10, t.amount), 'financing', 'equity tranche', `${t.source} (reduced)`);
        yearStats(s).equity += Math.min(10, t.amount);
      } else ctx.log('finance', `${t.source}: condition (${t.condition}) not met; $${t.amount.toFixed(1)}B lapses.`, 2);
      continue;
    }
    keep.push(t);
  }
  f.tranches = keep;
}

/** Tranche conditions: 'recapitalisation', 'revenue:<R>', 'gw:<GW online>', 'ipo'. */
export function trancheConditionMet(s: GameStateV2, cond: string): boolean {
  const f = s.player.finance;
  if (cond === 'recapitalisation') return f.ws3.recap.doneDay !== undefined;
  if (cond === 'ipo') return f.ownership.public > 0;
  const [k, v] = cond.split(':');
  if (k === 'revenue') return f.revenueRun >= Number(v);
  if (k === 'gw') return (s.player.computeOnline * s.power.kWPerH100e) / 1e6 >= Number(v);
  return false;
}

/** capitalQ (420, quarterly): hype, investor pool, bubble roll, raises close, tranches land, valuation mark, rating,
 *  covenants, legacy recapitalisation. */
export const capitalQSystem: EngineSystem = {
  id: 'capitalQ', owner: 'WS3', cadence: 'quarterly', order: 420,
  run(s, ctx) {
    ensureWs3(s);
    const c = s.capital;
    const w = c.ws3;
    const f = s.player.finance;
    const fx = f.ws3;

    // Quarter accumulators → operating cash flow and capex history.
    fx.opCashQ = fx.accQ.revenue - fx.accQ.opCosts;
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
    const M = Math.exp(-0.12 * (c.y10 - 4.5));
    const W = 1 + (c.ipoWindow ? 0.5 : 0);
    c.poolAnnual = 4.0 * R * c.hype * M * W * (busted ? 0.4 : 1);
    const unused = Math.max(0, w.playerPoolQ - w.playerTakenQ);
    c.carry = 0.5 * unused; // rivals take their shares by default; the player's unused share carries at 50% [R15]
    w.playerShare = poolShare(s);
    w.playerPoolQ = w.playerShare * (c.poolAnnual / 4 + c.carry);
    w.playerTakenQ = 0;

    // Bubble roll.
    c.bubbleX = bubbleX(s);
    if (!busted && ctx.rng('finance').chance(bustProbQ(c.bubbleX))) {
      c.busted = { day: s.time.day, recoverDay: s.time.day + 365 };
      c.shocks.push({ kind: 'sectorBust', dH: SHOCKS.sectorBust.dH, halfLifeQ: SHOCKS.sectorBust.halfLifeQ, day: s.time.day });
      c.hype = Math.max(0.3, c.hype - SHOCKS.sectorBust.dH);
      w.spreadAddBp = 100 * Math.max(0, c.bubbleX - 3) / 3;
      c.poolAnnual *= 0.4;
      w.playerPoolQ *= 0.4;
      // The most over-committed private rival is pushed into distress; WS4 decides bankruptcy.
      const r = [...s.rivals].filter((x) => x.core.status === 'active' && x.finance.valuation > 0).sort((a, b) => b.finance.commitments / Math.max(0.1, b.finance.revenueRun) - a.finance.commitments / Math.max(0.1, a.finance.revenueRun))[0];
      if (r) r.finance.distress = true;
      ctx.log('alert', `AI investment bust: the pool for lab equity collapses and credit spreads widen (X = ${c.bubbleX.toFixed(1)}).`, 4);
      ctx.headline('bust', 'AI stocks crash as investors question trillion-dollar compute bets');
    } else if (!busted) w.spreadAddBp = Math.max(0, w.spreadAddBp * 0.5);

    // Legacy recapitalisation completes after 4 quarters (AG review), then the board becomes nonprofit-controlled PBC.
    if (fx.recap.startDay !== undefined && fx.recap.doneDay === undefined && s.time.day - fx.recap.startDay >= 360) {
      fx.recap.doneDay = s.time.day;
      s.player.board.preset = 'nonprofitPBC';
      s.player.board.safetyCommitteeVeto = true;
      ctx.log('finance', 'Recapitalisation complete: the company is now a nonprofit-controlled PBC. Conditional tranches are freed.');
    }

    // Valuation mark (formula), then raises close at it, tranches land; revenue history rolls.
    const v = valuationNow(s);
    const dv = v.V - f.valuation;
    f.valuation = v.V;
    ctx.cause('player.finance.valuation', dv, 'quarterly mark', `g ${v.g.toFixed(1)} · H ${v.H.toFixed(2)} · N ${v.N.toFixed(1)} · M ${v.M.toFixed(2)}`);
    closePendingRound(s, ctx);
    settleTranches(s, ctx);
    f.revenueHistory.push(f.revenueRun);
    if (f.revenueHistory.length > 8) f.revenueHistory.shift();
    f.raisedLast4q = f.rounds.filter((r) => r.day > s.time.day - 365).reduce((a, r) => a + r.amount, 0);

    // Debt: revolver grows with revenue unless frozen; maturities; covenants; rating.
    const rv = f.debts.find((d) => d.kind === 'revolver');
    if (rv && f.state !== 'distress' && f.rating !== 'closed') rv.principal = Math.max(rv.principal, revolverCap(f.revenueRun));
    const breach = rollMaturities(s, ctx) || covenantsBreached(s, ctx);
    if (breach && f.covenantBreachDay === undefined) {
      f.covenantBreachDay = s.time.day;
      ctx.bump('board.confidence', -20, 'covenant breach');
      ctx.log('alert', 'Covenant breach: lenders can call the debt.', 4);
    } else if (!breach && f.covenantBreachDay !== undefined) delete f.covenantBreachDay;
    let rating = ratingOf(ratingScore(s));
    if (f.state === 'tight') rating = rating === 'BBB' ? 'BB' : rating === 'BB' ? 'B' : rating;
    f.rating = rating;
  },
};

/** Day the legacy recapitalisation tranche is due (helper for previews). */
export const recapDeadline = (s: GameStateV2) => dayOfDate(s.time.startDate, '2026-12-31');
