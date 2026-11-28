// Back-of-envelope estimates: market (see scripts/v2/estimates.ts; design/estimates/MAP-A.md, MAP-B.md, E1b-report.md).
// One newGame per state, never stepped: the start readouts (C1, A8, F11 start, C5, A2a, A2b, F9 start marks) and the
// revenue the market's own demand, price and share functions give with the labs at the reference frontier and the world
// stocks at their sourced 2026 values (F7.revenue2026, the diagnostic of the RefBot economy collapse), plus the software
// hire-rate date.
import { REGIONS, SECTORS } from '../../../src/data/v2/sectors';
import { RIVAL_GROWTH, rentalBase, spotRental } from '../../../src/engine/v2/compute/market';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { dayOfDate } from '../../../src/engine/v2/core/time';
import { storyNow } from '../../../src/engine/v2/finance/story';
import { cPlanQ, refGAt, setNpcModel } from '../../../src/engine/v2/npc/lab';
import { refTotal } from '../../../src/engine/v2/production/ces';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { consumerUse, workBilling, workUse } from '../../../src/engine/v2/worldfx/readouts';
import { labMarketRevenue, revenueReadout, sectorHours, sectorSpendParts } from '../../../src/engine/v2/worldfx/revenue';
import { hireRateOf } from '../../../src/engine/v2/worldfx/sectors';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { bandOf } from '../calreport/types';
import { estOf, type Estimate } from './types';

export const area = 'market';

const START = '2025-07-01';
const newState = () => newGame(defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', tutorial: false }));
const band = (id: string, k: 'p50' | 'lo' | 'hi') => bandOf(id)![k]!;
const SOURCED = ['US', 'ROW'] as const;

/** Sourced mid-2026 world stocks (read from the registry entries): US workers using AI (A2a.workers2026) and hours of use
 *  (A2a.hoursOfUse2026), paid enterprise seats outside China (A2c.seats.jul2026), US weekly chat reach (A2b.usReach), the
 *  paid share of chat users (A2b.paidShare2026, the band's middle). Set as fields on the state: no tick. The US factor of
 *  each stock is applied to ROW too (no separate ROW source). */
function setSourced2026Stocks(s: GameStateV2) {
  const wk = band('A2a.workers2026', 'p50') / workUse(s).workers;
  for (const r of SOURCED) for (const d of SECTORS) { const st = s.world.sectors[r][d.id]; st.W = Math.min(1, st.W * wk); }
  // Hours of use: scale A until workUse's hours equal the sourced share (bisection on the engine's readout).
  const hoursT = band('A2a.hoursOfUse2026', 'p50');
  const a0 = Object.fromEntries(SECTORS.map((d) => [d.id, s.world.sectors.US[d.id].A])) as Record<string, number>;
  const setA = (k: number) => { for (const r of SOURCED) for (const d of SECTORS) { const st = s.world.sectors[r][d.id]; st.A = Math.min(st.W, a0[d.id] * k); } };
  let lo = 0, hi = 4;
  for (let i = 0; i < 30; i++) { const k = (lo + hi) / 2; setA(k); if (workUse(s).hours < hoursT) lo = k; else hi = k; }
  setA((lo + hi) / 2);
  const seatsOf = () => { const b = workBilling(s); return b.world.seats - b.regions.CN.seats; };
  const sk = band('A2c.seats.jul2026', 'p50') / seatsOf();
  for (const r of SOURCED) for (const d of SECTORS) { const st = s.world.sectors[r][d.id]; st.seat = Math.min(1, st.seat * sk); }
  const f = s.world.fx;
  const k = band('A2b.usReach', 'p50') / f.reach.US;
  for (const r of REGIONS) f.reach[r] *= k;
  const paid = (band('A2b.paidShare2026', 'lo') + band('A2b.paidShare2026', 'hi')) / 2;
  const keys = worldMix(s).providers.map((p) => p.key);
  for (const r of REGIONS) for (const key of keys) f.paid[r][key] = paid;
}

/** The labs at the reference frontier in clock year `y` (the clock is set to it): the best US lab (the lowest start lag:
 *  the frontier lab RefBot stands for) at G_ref(y) with the reference compute, the other US labs at their start lags and
 *  planned compute, China at its lag. The player's products are withdrawn: their share goes to the labs. */
function putLabsAtReference(s: GameStateV2, y: number) {
  const yr = Math.floor(y);
  s.time.day = dayOfDate(START, `${yr}-01-01`) + Math.round((y - yr) * 365.25);
  const w = s.hidden.timeline;
  const lead = s.rivals.reduce((a, r) => (r.npc.d < a.npc.d ? r : a));
  for (const r of s.rivals) {
    const G = refGAt(s, r === lead ? y : y - r.npc.d / 365.25);
    const C = r === lead ? refTotal(w, y) : cPlanQ(s, r, 0);
    for (const m of [r.internal, r.publicModel]) if (m) setNpcModel(w, m, G, C, y);
  }
  const cn = s.china.lab;
  const cnC = cn.npc.c0 * Math.pow(RIVAL_GROWTH, y - 2025.5);
  for (const m of [cn.internal, cn.publicModel]) if (m) setNpcModel(w, m, refGAt(s, y - cn.npc.d / 365.25), cnC, y);
  for (const d of s.player.deployments) d.status = 'withdrawn';
}

export function estimates(): Estimate[] {
  const rows: Estimate[] = [];
  const g0 = newState();

  // ── the start: day-0 readouts (no tick) ──
  {
    const rd = revenueReadout(g0);
    const cons = rd.deps.filter((x) => x.channel === 'consumer');
    const users = cons.reduce((a, x) => a + (x.users ?? 0), 0);
    const chat = cons.reduce((a, x) => a + x.revenue, 0);
    rows.push(estOf('C1.chatUsers', `${(users / 1e6).toFixed(0)}M`, users, 'revenueReadout(newGame).deps consumer users'));
    rows.push(estOf('F11.startRunRate', `$${rd.total.toFixed(1)}B/yr`, rd.total, 'revenueReadout(newGame).total (day 0; the band is for the first month)'));
    rows.push(estOf('A8.leaderRevenue', `$${rd.total.toFixed(1)}B/yr`, rd.total, 'revenueReadout(newGame).total (day 0; the metric reads day 1; same quantity as F11.startRunRate)'));
    rows.push(estOf('A8.chatRevenueShare', `Chat $${chat.toFixed(1)}B, ${((100 * chat) / rd.total).toFixed(0)}%`, chat / rd.total, 'revenueReadout(newGame).deps consumer revenue / total'));

    const mix = worldMix(g0);
    const pi = mix.providers.findIndex((p) => p.key === 'player');
    let sp = 0, pl = 0, us = 0, rw = 0;
    for (const r of SOURCED) for (const d of SECTORS) {
      const x = sectorSpendParts(g0, r, d.id, mix);
      const y = x.adopted + x.agent + x.seat;
      sp += y;
      pl += y * mix.sec[r][d.id].share[pi];
      if (r === 'US') us += y; else rw += y;
    }
    rows.push(estOf('A8.leaderShare', `leader ${(pl / sp).toFixed(3)} of $${sp.toFixed(1)}B`, pl / sp, 'worldMix → sectorSpendParts × the leader\'s share, US + ROW'));
    rows.push(estOf('A8.usBuyerShare', `US ${(us / (us + rw)).toFixed(2)}`, us / (us + rw), 'sectorSpendParts, US / (US + ROW)'));
    const hrs = (r: 'US' | 'ROW') => SECTORS.reduce((x, d) => x + sectorHours(g0, r, d.id), 0);
    rows.push(estOf('A8.hoursRatio', `ROW / US ${(hrs('ROW') / hrs('US')).toFixed(2)}`, hrs('ROW') / hrs('US'), 'sectorHours(ROW) / sectorHours(US)'));

    const cu = consumerUse(g0, mix);
    rows.push(estOf('C5.paidShareTarget', `${(100 * cu.regions.US.playerPaidTarget).toFixed(2)}%`, cu.regions.US.playerPaidTarget, 'consumerUse(newGame).regions.US.playerPaidTarget (the start model\'s own cover and price)'));
    rows.push(estOf('A2b.rowBelowUs', `ROW ${cu.regions.ROW.reachTarget.toFixed(2)} vs US ${cu.regions.US.reachTarget.toFixed(2)}`, cu.regions.ROW.reachTarget < cu.regions.US.reachTarget, 'consumerUse(newGame).regions reachTarget (the targets at the same cover)'));
    rows.push(estOf('A2a.savedPerHour', `${workUse(g0).savedPerHour.toFixed(3)}`, workUse(g0).savedPerHour, 'workUse(newGame).savedPerHour'));
    const shock = spotRental(rentalBase(15, 0.7), 1.5) / spotRental(rentalBase(15, 0.7), 1) - 1;
    rows.push(estOf('F5.spotDemandShock', `+${(100 * shock).toFixed(1)}%`, shock, 'spotRental(rentalBase(15, 0.7), 1.5) / spotRental(…, 1) − 1 (a pure formula)'));
    const marks = storyNow(g0).labs.reduce((a, l) => a + l.valuation, 0);
    rows.push(estOf('F9.fc1.start', `$${marks.toFixed(0)}B`, marks, 'storyNow(newGame).labs Σ valuation'));
  }

  // ── revenue at reference capability: the diagnostic of the integrated economy collapse ──
  // The chain is long on purpose (every step an engine function or a field write):
  //   newGame → setSourced2026Stocks (readouts workUse / workBilling steer the sector, seat, reach and paid fields)
  //   → putLabsAtReference (refGAt, refTotal, cPlanQ, setNpcModel on every lab; the player's products withdrawn)
  //   → worldMix → labMarketRevenue per lab (sector hours × price × share, plus chat users × paid × price).
  {
    const s = newState();
    setSourced2026Stocks(s);
    putLabsAtReference(s, 2026.5);
    const mix = worldMix(s);
    const rev = mix.providers.map((p) => ({ key: p.key, v: labMarketRevenue(s, p.key as never, mix) }));
    const leader = rev.reduce((a, b) => (b.v > a.v ? b : a));
    const total = rev.reduce((a, b) => a + b.v, 0);
    const p50 = band('F7.revenue2026', 'p50');
    const verdict = leader.v > 0.75 * p50 ? 'near the sourced $45-56B: the demand and price maths gives the sourced revenue, so the collapse is dynamics'
      : leader.v < 0.4 * p50 ? 'near the ≈ $8B of the fixtures: the demand / price parameters, not the dynamics'
      : 'between the two: parameters are part of it';
    console.log(`  [diagnostic F7.revenue2026] labs at the reference frontier, sourced mid-2026 stocks: lead lab ${leader.key} $${leader.v.toFixed(1)}B/yr, all labs $${total.toFixed(1)}B/yr (${rev.map((r) => `${r.key} ${r.v.toFixed(1)}`).join(', ')}) → ${verdict}`);
    rows.push(estOf('F7.revenue2026', `lead lab $${leader.v.toFixed(1)}B/yr, all labs $${total.toFixed(1)}B/yr`, leader.v,
      'newGame → setSourced2026Stocks(workUse, workBilling) → putLabsAtReference(refGAt, refTotal, cPlanQ, setNpcModel) → worldMix → labMarketRevenue (demand side: serving capacity not applied), mid-2026 run-rate', 'demand'));
  }

  // ── W.hireRate10: the first year the software hire rate is at or below 10% with the labs at the reference ──
  {
    const s = newState();
    const hire = (y: number) => { putLabsAtReference(s, y); return hireRateOf(s, 'SOFT', worldMix(s).sec.US.SOFT.F); };
    let lo = 2026, hi = 2032;
    for (let i = 0; i < 8; i++) { const m = (lo + hi) / 2; if (hire(m) > 0.1) lo = m; else hi = m; }
    rows.push(estOf('W.hireRate10', `${hi.toFixed(2)}`, hi, 'putLabsAtReference(y) → worldMix(s).sec.US.SOFT.F → hireRateOf(s, SOFT, F), bisection on y (monotone in G; the 18-day lag ignored)'));
  }
  return rows;
}
