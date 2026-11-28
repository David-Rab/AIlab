// Back-of-envelope estimates: the extractions of E2m (see scripts/v2/estimates.ts; design/estimates/E2m-report.md).
// Valuation and multiple (sectorValueOf), power (kWPerH100eAt), chip production and supplier margin (arrive / supplyNow,
// the expected price path), the AI-friend and government-acceptance equilibria (friendTarget, acceptTarget). One newGame
// per state, never stepped; the clock and the labs' models are field writes (putLabsAtReference of estimates/market.ts).
import { MARKET } from '../../../src/data/v2/deals';
import { arrive, expectedListPrice, globalRefQ, impliedMargin, initialMarket, supplyNow } from '../../../src/engine/v2/compute/market';
import { kWPerH100eAt } from '../../../src/engine/v2/compute/power';
import { dayOfDate } from '../../../src/engine/v2/core/time';
import { refRevenueRun } from '../../../src/engine/v2/finance/plan';
import { publicFrontier } from '../../../src/engine/v2/finance/observe';
import { valueCap } from '../../../src/engine/v2/finance/rivalFinance';
import { sectorRunRate, sectorValueOf, storyNow } from '../../../src/engine/v2/finance/story';
import { PLAYER_ID } from '../../../src/engine/v2/models/labs';
import { refTotal } from '../../../src/engine/v2/production/ces';
import { lawsInForce } from '../../../src/data/v2/laws';
import { USGOV } from '../../../src/engine/v2/world/usgov';
import { acceptTarget, govAdviceG, persuasion } from '../../../src/engine/v2/worldfx/control';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { reachTarget } from '../../../src/engine/v2/worldfx/serving';
import { friendTarget } from '../../../src/engine/v2/worldfx/sectors';
import { estOf, type Estimate } from './types';
import { newState, putLabsAtReference } from './market';

export const area = 'world';

const START = '2025-07-01';
const dayAt = (y: number) => { const yr = Math.floor(y); return dayOfDate(START, `${yr}-01-01`) + Math.round((y - yr) * 365.25); };
const median = (xs: number[]) => { const a = [...xs].sort((p, q) => p - q); return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; };
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function estimates(): Estimate[] {
  const rows: Estimate[] = [];
  const g0 = newState();
  const w = g0.hidden.timeline;

  // ── power: all reference compute at the end of 2026, at that quarter's kW per H100e ──
  {
    const q = 6; // quarters from Q3 2025 to the end of 2026
    const gw = (refTotal(w, 2027.0) * kWPerH100eAt(g0.power.kWPerH100e, q)) / 1e6;
    rows.push(estOf('F7.power2026', `${gw.toFixed(1)} GW (${(refTotal(w, 2027.0) / 1e6).toFixed(1)}M H100e × ${kWPerH100eAt(g0.power.kWPerH100e, q).toFixed(2)} kW)`, gw,
      'refTotal(w, 2027.0) × kWPerH100eAt(s.power.kWPerH100e, 6) / 1e6: every reference H100e in live sites or cloud (the upper bound: the bot may hold less)'));
  }

  // ── chip production and the supplier margin on the reference / expected paths ──
  {
    const sum = (a: number, b: number) => { let x = 0; for (let q = a; q <= b; q++) x += globalRefQ(q); return x; };
    const m = initialMarket();
    const fixed: number[] = [];
    for (let q = 1; q <= 4; q++) { arrive(m); fixed.push(supplyNow(m).S); }
    const info = fixed.map((x, i) => `q${i + 1} ${(x / 1e6).toFixed(1)}M vs ${(globalRefQ(i + 1) / 1e6).toFixed(1)}M`).join(', ');
    rows.push(estOf('F1.production2026', `${(sum(2, 5) / 1e6).toFixed(1)}M H100e. INFO, supply the pre-ordered pipes fix (min of components, no new orders) vs the reference: ${info}`, sum(2, 5),
      'Σ globalRefQ(q), q = 2..5 (Q1-Q4 2026); INFO: arrive(clone of initialMarket) → supplyNow, quarters 1..4'));
    rows.push(estOf('F2.production2027', `${(sum(6, 9) / 1e6).toFixed(1)}M H100e`, sum(6, 9), 'Σ globalRefQ(q), q = 6..9 (2027): the reference path itself, not the cleared supply'));

    const m0 = initialMarket();
    const marg = Array.from({ length: 9 }, (_, i) => {
      const k = i + 1; // Q4 2025 .. Q4 2027
      return impliedMargin({ ...m0, cost: m0.cost * Math.pow(MARKET.costDeclineQ, k), listPrice: expectedListPrice(m0, k) });
    });
    rows.push(estOf('F6.supplierMargin', `${(100 * mean(marg)).toFixed(1)}% (min ${(100 * Math.min(...marg)).toFixed(1)}%)`, mean(marg),
      'impliedMargin({cost × costDeclineQ^k, listPrice: expectedListPrice(m, k)}), k = 1..9, meaned (the expected path, not a cleared one)'));
    rows.push(estOf('F6.supplierMarginMin', `${(100 * Math.min(...marg)).toFixed(1)}%`, Math.min(...marg), 'the same nine quarters, minimum'));
  }

  // ── valuation and multiples: sectorValueOf on the reference revenue path ──
  // R_sector = the start sector revenue × the reference growth since day 0 (every private lab on the reference curve);
  // L = the public frontier with the labs at the reference (putLabsAtReference); hype and rate from the start state; shares
  // as at the start (storyNow(newGame)); a lab's value is at most its cap (valueCap at the reference 4-quarter growth).
  {
    const st0 = storyNow(g0);
    const R0 = refRevenueRun(g0, 0);
    const sL = newState();
    const at = (y: number) => {
      putLabsAtReference(sL, y);
      const k = refRevenueRun(g0, dayAt(y)) / R0;
      const gr = refRevenueRun(g0, dayAt(y)) / refRevenueRun(g0, dayAt(y - 1));
      const S = sectorValueOf(sectorRunRate(g0) * k, publicFrontier(sL), g0.capital.hype, g0.capital.y10, 1);
      const labs = st0.labs.map((l) => ({ id: l.id, R: l.revenue * k, V: Math.min(S * l.share, valueCap(l.revenue * k, gr)) }));
      const me = labs.find((l) => l.id === PLAYER_ID) ?? labs[0];
      return { S, gr, total: labs.reduce((a, l) => a + l.V, 0), me, mult: me.V / me.R };
    };
    const marks = (a: number, b: number) => { const o = []; for (let y = a; y <= b + 1e-9; y += 0.25) o.push(at(y)); return o; };
    const y26 = marks(2026.25, 2027.0), y27 = marks(2027.25, 2028.0);
    const end26 = at(2027.0);
    rows.push(estOf('F7.valuation2026', `$${end26.me.V.toFixed(0)}B (sector $${end26.S.toFixed(0)}B × the start share ${(100 * st0.share).toFixed(0)}%, cap ${end26.me.V < end26.S * st0.share ? 'binds' : 'not binding'})`, end26.me.V,
      'sectorValueOf(sectorRunRate × refRevenueRun growth, publicFrontier at the reference labs, hype, y10, 1) × the leader\'s start share from storyNow(newGame), min valueCap(R, growth); end-2026'));
    const late = mean([at(2026.8).total, at(2027.04).total]);
    rows.push(estOf('F9.fc1.late2026', `$${late.toFixed(0)}B (Oct 2026 $${at(2026.8).total.toFixed(0)}B, Jan 2027 $${at(2027.04).total.toFixed(0)}B)`, late,
      'Σ over the start private labs of min(sectorValueOf × start share, valueCap), mean of the Oct 2026 and Jan 2027 marks'));
    const hi = [...y26, ...y27].map((x) => x.mult);
    rows.push(estOf('F9.fc2.leaderMultiple', `${median(hi).toFixed(1)}x run-rate (${hi.length} quarterly marks 2026-27, reference growth ×${y26[0].gr.toFixed(1)})`, median(hi), 'leader V / refRevenueRun at the quarterly marks 2026-27, median (every mark has growth ≥ 2.5)'));
    rows.push(estOf('F9.fc2.2026', `${median(y26.map((x) => x.mult)).toFixed(1)}x`, median(y26.map((x) => x.mult)), 'as F9.fc2.leaderMultiple, the 2026 marks'));
    rows.push(estOf('F9.fc2.2027', `${median(y27.map((x) => x.mult)).toFixed(1)}x`, median(y27.map((x) => x.mult)), 'as F9.fc2.leaderMultiple, the 2027 marks'));

    // Slower growth, same date and revenue: the player's 4-quarter history differs (growthOf), the story share follows.
    const multAt = (growth: number) => {
      const g = newState();
      g.player.finance.revenueHistory = [g.player.finance.revenueRun / growth];
      const st = storyNow(g);
      return Math.min(st.sector.S * st.share, st.me?.cap ?? Infinity) / g.player.finance.revenueRun;
    };
    const fast = multAt(3.5), slow = multAt(1.2);
    rows.push(estOf('F9.fc2.slowerLowerMultiple', `growth ×1.2: ${slow.toFixed(1)}x vs ×3.5: ${fast.toFixed(1)}x`, slow < fast, 'storyNow(newGame with the player\'s revenue history at ×1.2 / ×3.5 a year) → min(S × share, cap) / revenueRun'));
  }

  // ── W.aiFriend2027 and W.govAccept85: the equilibrium targets, labs at the reference frontier ──
  {
    const s = newState();
    const wl = s.hidden.timeline;
    putLabsAtReference(s, 2027.5);
    const cons = worldMix(s).consumer.US;
    const reach = reachTarget('US', cons.bestCover);
    const companion = lawsInForce(s).sb243 ? USGOV.companionFactor : 1;
    const f = friendTarget(wl, cons.socialG, reach, companion);
    rows.push(estOf('W.aiFriend2027', `${(100 * f).toFixed(1)}% (SOCIAL G ${cons.socialG.toFixed(1)}, US reach target ${reach.toFixed(2)}, companion factor ${companion})`, f,
      'putLabsAtReference(2027.5) → worldMix.consumer.US (socialG, bestCover) → reachTarget(US, bestCover) → friendTarget(w, socialG, reach, companion factor); the equilibrium: the stock lags about 4 months (and reach is its target, an upper bound)'));

    const accept = (y: number) => {
      putLabsAtReference(s, y);
      const mix = worldMix(s);
      const top = Math.max(...mix.providers.map((p) => persuasion(s, p.key, mix)));
      return acceptTarget(wl, govAdviceG(s, mix), top);
    };
    let lo = 2026, hi = 2032;
    for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (accept(m) < 0.85) lo = m; else hi = m; }
    const reached = accept(2032) >= 0.85;
    const at28 = accept(2027.96);
    rows.push(estOf('W.govAccept85', reached ? `${hi.toFixed(2)} (the first year the target is >= 0.85; the stock follows with ACCEPT.rate, so a lower bound of the date)` : `not reached by 2032 (censored at 2032): the target is ${at28.toFixed(2)} in Dec 2027, labs at the reference frontier, no government briefing`, reached ? hi : 2032,
      'putLabsAtReference(y) -> worldMix -> acceptTarget(w, govAdviceG(s, mix), max persuasion), bisection on y; govAdviceG counts the GOV market and vetted products, not the player briefing'));
  }
  return rows;
}
