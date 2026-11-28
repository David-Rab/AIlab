// Calibration targets: finance (what RefBot games and idle demand-shock runs give against sourced bands).
// Moved from finance.ts (test audit CRB, design/TESTING.md §0): F1–F9 and FIN2–FIN6a outcome bands read from played games
// (V2-SPEC §7.2; research/15 §1.9, research/22; design/FINANCE-V3.md). The constructed FIN mechanism checks stay in finance.ts.
// Cost: RefBot ≈ 37 ms a game-day (34 CPU-s to end-2027) per seed; the bare / capex2x variants stop at their first distress
// (≈ 2 CPU-s each); 3 idle demand-shock runs (11–13 quarters, ≈ 1 CPU-min together); the mixed-bot division head 550 days.
// Seeds: env CALREPORT_SEEDS = n RefBot seeds (default 4: seeds 1–4) and min(n, 6) distress seeds (default 4).
// Seed arithmetic (from the original script): the medians read here are of quantities whose seed-to-seed spread is well
// under their bands (F7 2026 revenue ±20%, capex ±25%, valuation ×3 wide), so 4 seeds give a median that holds the band; 12
// seeds cost 7 CPU-min for nothing the bands can tell apart. Games go through the simulation cache (simcache.ts).
import { fileURLToPath } from 'node:url';
import { WORLD_START, globalCompute } from '../../../src/data/world';
import { PARTNER_TERMS } from '../../../src/data/v2/deals';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { resolve, tick } from '../../../src/engine/v2/core/loop';
import { cadencesDue, dayOfDate, decimalYear } from '../../../src/engine/v2/core/time';
import { demandShock, impliedMargin, rentalBase, spotRental } from '../../../src/engine/v2/compute/market';
import { siteLiveMW } from '../../../src/engine/v2/compute/sites';
import { charterReleaseBlock } from '../../../src/engine/v2/finance/charter';
import { parentFunded } from '../../../src/engine/v2/finance/rivalFinance';
import { storyNow } from '../../../src/engine/v2/finance/story';
import { commitmentsRemaining } from '../../../src/engine/v2/finance/ledger';
import { partnersNow } from '../../../src/engine/v2/finance/deals';
import { budgetFactor } from '../../../src/engine/v2/finance/parent';
import { CAPEX2X_AUTOPILOT, financeAutopilot, REF_AUTOPILOT, type AutopilotOpts } from '../../../src/engine/v2/finance/plan';
import { mixedBot } from '../../../src/engine/v2/bots/mixed';
import { refDecide, refPlay } from '../../../src/engine/v2/bots/ref';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { engine } from '../../../src/engine/v2/index';
import type { GameStateV2 } from '../../../src/engine/v2/types';
import { cached, pick } from '../simcache';
import type { Target } from './types';

export const area = 'finance';

const START = '2025-07-01';
const END_2026 = dayOfDate(START, '2027-01-01');
const END_Q1_2027 = dayOfDate(START, '2027-04-01');
const END_2027 = dayOfDate(START, '2028-01-01');
const ME = fileURLToPath(import.meta.url);
const nSeeds = () => Math.max(1, Number(process.env.CALREPORT_SEEDS ?? 4));
const SEEDS = () => [1, 2, 3, 4].slice(0, nSeeds());
const DISTRESS_SEEDS = () => [1, 2, 3, 4, 5, 6].slice(0, Math.min(nSeeds(), 6));
/** The final-state paths the rows read from a bot run. */
const RUN_PICKS = [
  'player.finance.ws3.years', 'player.finance.deals', 'player.finance.rounds', 'hidden.timeline', 'setup.seed', 'player.board.confidence',
  'player.finance.credibility', 'player.finance.promises', 'player.finance.revenueRun', 'player.finance.valuation', 'player.finance.ledger', 'time',
];

const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const share = (xs: boolean[]) => xs.filter(Boolean).length / Math.max(1, xs.length);
const f1 = (x: number) => x.toFixed(1);
const F1pct = (x: number) => `${Math.round(x * 100)}%`;

/** FINREF: the sum of the private labs' marks (you and the private rivals: each at S × its marked share, at most its
 *  cap), the game's counterpart of a sum of real post-money marks (FC1). */
const marksSum = (st: ReturnType<typeof storyNow>) => st.labs.reduce((a, l) => a + l.valuation, 0);
/** FIN5a: each quarter mark also records the story (sector value, the player's share and valuation, growth, a bust, and
 *  each trailing private rival with revenue: FIN5b its marked valuation and run-rate). */
interface QRow { day: number; year: number; shipped: number; stock: number; margin: number; supply: number; S: number; sumV: number; share: number; V: number; R: number; g: number; bust: boolean; trailing: { v: number; r: number }[] }
/** FIN5b: a private rival at a snapshot (end-2026). */
interface RivalRow { id: string; arch: string; status: string; V: number; R: number; cash: number }
interface Run { s: GameStateV2; q: QRow[]; firstDistress: number; gw2026: number; v2026: number; held: string[]; heldDays: number; pbcDays: number; rivals2026: RivalRow[]; private0: string[] }

function runBot(seed: number, opts: AutopilotOpts | undefined, until: number, stopAtDistress = false): Run {
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
      q.push({ day: s.time.day, year: Math.floor(decimalYear(s) + 1e-9), shipped: s.market.ws3.shipped, stock: s.market.ws3.stock, margin: impliedMargin(s.market), supply: s.market.supplyQ, S: st.sector.S, sumV: marksSum(st), share: st.share, V: s.player.finance.valuation, R: s.player.finance.revenueRun, g: st.me?.growth ?? 1, bust: st.sector.bust < 1, trailing });
    }
    if (firstDistress < 0 && (s.player.finance.state === 'distress' || s.player.finance.state === 'insolvent')) {
      firstDistress = s.time.day;
      if (stopAtDistress) break;
    }
    if (s.time.day === END_2026 - 1) {
      const liveMW = s.player.sites.reduce((a, x) => a + siteLiveMW(x, s.time.day), 0);
      const cloud = s.player.cloud.reduce((a, c) => a + (c.startDay <= s.time.day && c.endDay > s.time.day ? c.h100e : 0), 0);
      gw2026 = liveMW / 1000 + (cloud * s.power.kWPerH100e) / 1e6;
      v2026 = s.player.finance.valuation;
      rivals2026 = s.rivals.filter((r) => private0.includes(r.core.id)).map((r) => ({ id: r.core.id, arch: r.npc.kind, status: r.core.status, V: r.finance.valuation, R: r.finance.revenueRun, cash: r.finance.cash }));
    }
  }
  return { s, q, firstDistress, gw2026, v2026, held: [...held], heldDays, pbcDays, rivals2026, private0 };
}
/** runBot through the simulation cache: the record keeps RUN_PICKS of the final state. */
const runBotC = (seed: number, opts: AutopilotOpts, until: number, stopAtDistress = false): Run =>
  cached('finance-bot', { seed, opts, until, stopAtDistress }, [ME], () => {
    const r = runBot(seed, opts, until, stopAtDistress);
    return { ...r, s: pick(r.s, RUN_PICKS) };
  });

const bare: AutopilotOpts = { ...REF_AUTOPILOT, strategic: false, offBalance: false, guard: false, rescue: false };

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

export function targets(): Target[] {
  const rows: Target[] = [];
  /** One row: id, band text, source, ok, label, value. */
  const t = (id: string, band: string, source: string, ok: boolean, label: string, value = '') => rows.push({ id: `finance.${id}`, label, band, value, ok, source });

  const ref = SEEDS().map((seed) => runBotC(seed, REF_AUTOPILOT, END_2027));
  const long = ref[0];

  // ───────────── F1–F3, F6: market under default demand (RefBot; seed 1 is the market reference run) ─────────────
  const prod = (y: number) => long.q.filter((r) => r.year === y).reduce((a, r) => a + r.shipped, 0);
  t('f1.prod2026', '20–30M H100e', 'V2-SPEC §7.2 F1', prod(2026) >= 20e6 && prod(2026) <= 30e6, 'F1 global production 2026 ≈ 25M H100e (±20%)', `${f1(prod(2026) / 1e6)}M`);
  {
    const w = long.s.hidden.timeline;
    const ratios = long.q.map((r) => r.stock / globalCompute(w as never, WORLD_START.globalCompute, r.day / 365));
    t('f3.stock', '80–120% of globalCompute(w,t)', 'V2-SPEC §7.2 F3', ratios.every((x) => x >= 0.8 && x <= 1.2), 'F3 installed stock within ±20% of globalCompute(w,t) through 2027', `ratio ${f1(Math.min(...ratios) * 100)}–${f1(Math.max(...ratios) * 100)}%`);
    const m27 = long.q.filter((r) => r.year <= 2027).map((r) => r.margin);
    const meanM = m27.reduce((a, b) => a + b, 0) / m27.length;
    t('f6.margin', 'mean 70–77%, min ≥ 65%', 'V2-SPEC §7.2 F6', meanM >= 0.7 && meanM <= 0.77 && Math.min(...m27) >= 0.65, 'F6 implied supplier margin 70–75% (mean Q4 2025–Q4 2027)', `mean ${f1(meanM * 100)}%, min ${f1(Math.min(...m27) * 100)}%`);
  }

  // ───────────── F4, F5: demand shocks (passive player, same seed) ─────────────
  {
    // C3: from a soft market (demand 30% under reference), a +50% shock at t: supply growth rises from t+4 and peaks t+6..t+8.
    const tq = 1;
    const b = shockRun(0.7, 1, tq, 13);
    const x = shockRun(0.7, 1.5, tq, 13);
    const diff = b.S.map((_, i) => (i === 0 ? 0 : x.S[i] / x.S[i - 1] - b.S[i] / b.S[i - 1]));
    const early = diff.slice(0, tq + 4).every((d) => Math.abs(d) < 0.005);
    const first = diff.findIndex((d) => d > 0.01) - tq;
    const win = diff.slice(0, tq + 11); // main response window (later wiggles are wafer binding switches)
    const peak = win.indexOf(Math.max(...win)) - tq;
    t('f4.shock', 'first t+4..t+6, peak t+6..t+9', 'V2-SPEC §7.2 F4 (C3)', early && first >= 4 && first <= 6 && peak >= 6 && peak <= 9, 'F4 +50% demand shock: supply growth rises from t+4, peaks t+6..t+8', `first t+${first}, peak t+${peak} (+${f1(Math.max(...win) * 100)} pp/q)`);
  }
  {
    const rb = rentalBase(15, 0.7);
    const up = spotRental(rb, 1.5) / spotRental(rb, 1) - 1;
    t('f5.spot', '+35% to +45%', 'V2-SPEC §7.2 F5 (C4)', up >= 0.35 && up <= 0.45, 'F5 spot rental under D/S = 1.5: +35–45% (C4)', `+${f1(up * 100)}%`);
  }
  {
    const t0 = 2;
    const b = shockRun(1, 0.5, t0, 11);
    const fall = [6, 7, 8].map((k) => b.r[t0 + k] / b.r[t0 - 1] - 1);
    t('f5.glut', '−60% to −80% at 6, 7, 8 quarters', 'V2-SPEC §7.2 F5 (C5)', fall.every((x) => x <= -0.6 && x >= -0.8), 'F5 spot rental in a glut: −60–80% over 6–8 quarters (C5)', fall.map((x) => `${f1(x * 100)}%`).join(', '));
  }

  // ───────────── F7, F8: RefBot, no-financing variant, capex2x ─────────────
  {
    // F2 on the RefBot seeds (FINREF): C2's 45–60M (AI 2027 60M; Epoch's ×2.2 a year) is the world's expected 2027 output.
    const prodOf = (r: Run, y: number) => r.q.filter((x) => x.year === y).reduce((a, x) => a + x.shipped, 0);
    const p27 = ref.map((r) => prodOf(r, 2027));
    t('f2.prod2027', '45–60M H100e', 'V2-SPEC §7.2 F2 (C2; AI 2027 60M; Epoch ×2.2/yr)', median(p27) >= 45e6 && median(p27) <= 60e6, 'F2 global production 2027 in 45–60M H100e (median of the RefBot seeds)', `median ${f1(median(p27) / 1e6)}M (range ${f1(Math.min(...p27) / 1e6)}–${f1(Math.max(...p27) / 1e6)}; seed 1's long run ${f1(prod(2027) / 1e6)}M)`);
  }
  const y26 = ref.map((r) => r.s.player.finance.ws3.years['2026']);
  // FIN1: chips a lessor paid at delivery count as capex too. FIN4r: capex and compute costs are what the year incurred,
  // so payments a renegotiation deferred to the contracts' end count in the year they were due.
  const capex = y26.map((y) => y.capexChips + (y.capexChipsFinanced ?? 0) + y.capexSites + y.capexSitesFinanced + y.supplierFunding + (y.deferredChips ?? 0));
  const med = { rev: median(y26.map((y) => y.revenue)), capex: median(capex), compute: median(y26.map((y) => y.computeCosts + (y.deferredCompute ?? 0))), gw: median(ref.map((r) => r.gw2026)), v: median(ref.map((r) => r.v2026)) };
  // F7 revenue (FINREF): AI 2027's OpenBrain $45B is a plot point; the measured 2026 leader is Anthropic, CY2026 ≈ $53–56B
  // (S-1: 9M 2026 $33.2B, Q4 at the $81B Oct run-rate; research/22 §4 [P]). The band is both, ±20%: $36–67B.
  t('f7.rev2026', '$36–67B', 'research/22 §4 [P]; AI 2027', med.rev >= 36 && med.rev <= 67, 'F7 RefBot 2026 revenue $45B (AI 2027) to $53–56B (Anthropic CY2026, research/22 §4), ±20%', `median $${f1(med.rev)}B`);
  t('f7.capex2026', '$150–250B', 'V2-SPEC §7.2 F7', med.capex >= 150 && med.capex <= 250, 'F7 RefBot 2026 capex $200B (±25%)', `median $${f1(med.capex)}B (range ${f1(Math.min(...capex))}–${f1(Math.max(...capex))})`);
  t('f7.compute2026', '$25–60B', 'V2-SPEC §7.2 F7', med.compute >= 25 && med.compute <= 60, 'F7 RefBot 2026 compute costs ~$40B/yr (incurred: paid + deferred by a renegotiation)', `median $${f1(med.compute)}B (deferred median $${f1(median(y26.map((y) => y.deferredCompute ?? 0)))}B)`);
  t('f7.gw2026', '4–9 GW', 'V2-SPEC §7.2 F7', med.gw >= 4 && med.gw <= 9, 'F7 RefBot end-2026 power ~6 GW (live sites + cloud)', `median ${f1(med.gw)} GW`);
  t('f7.val2026', '$1–3T', 'V2-SPEC §7.2 F7', med.v >= 1000 && med.v <= 3000, 'F7 RefBot end-2026 valuation $1–3T', `median $${(med.v / 1000).toFixed(2)}T`);

  const funded = ref.map((r) => {
    const y = r.s.player.finance.ws3.years['2026'];
    // FIN4a: every partner deal is strategic (vendor financing is gone); stakes from before the start do not count.
    const deal = r.s.player.finance.deals.some((d) => !d.legacy && d.day >= 0 && d.day < END_2026);
    return { deal, fin: y.spvFinanced + y.leaseFinanced + y.cloudFinanced };
  });
  const fundedShare = share(funded.map((x) => x.deal && x.fin >= 50));
  t('f8.funded', '≥ 80% of seeds', 'V2-SPEC §7.2 F8', fundedShare >= 0.8, 'F8 RefBot takes ≥ 1 strategic deal and ≥ $50B lease/colocation/cloud financing in 2026 (≥ 80% of seeds)', `${fundedShare * 100}% · median financing $${f1(median(funded.map((x) => x.fin)))}B`);
  const noDistress = share(ref.map((r) => r.firstDistress < 0 || r.firstDistress >= END_2026));
  t('f8.noDistress', '≥ 75% of seeds', 'V2-SPEC §7.2 F8', noDistress >= 0.75, 'F8 RefBot stays out of distress through 2026 (≥ 75% of seeds)', `${f1(noDistress * 100)}%`);
  const none = DISTRESS_SEEDS().map((seed) => runBotC(seed, bare, END_Q1_2027, true));
  const noneD = share(none.map((r) => r.firstDistress >= 0));
  t('f8.bare', '≥ 80% of seeds', 'V2-SPEC §7.2 F8 (C7)', noneD >= 0.8, 'F8 the C7 path without a strategic deal or off-balance-sheet financing hits distress by Q1 2027 (≥ 80%)', `${f1(noneD * 100)}%`);
  const x2 = DISTRESS_SEEDS().map((seed) => runBotC(seed, CAPEX2X_AUTOPILOT, END_2027, true));
  const x2D = share(x2.map((r) => r.firstDistress >= 0 && r.firstDistress < END_2027));
  t('f8.capex2x', '≥ 80% of seeds', 'V2-SPEC §7.2 F8', x2D >= 0.8, 'F8 capex2x bot (no rescue) reaches Distress by end-2027 (≥ 80%)', `${f1(x2D * 100)}% · ${x2.length} seeds (stopped at first distress)`);

  // ───────────── F9: valuation and rounds on the RefBot path ─────────────
  {
    // FC1 (FINREF) reads the sum of the labs' marks, the instrument of its source: R15 §2.9's band is a sum of post-money
    // marks. Σ marks < S since the caps (FIN5b rivals, FIN6a every lab). The start band is the Jul 2025 marks from the same
    // sources: OpenAI $300B (Mar 2025 [P]), Anthropic $61.5B (Mar 2025 [P]), xAI–X $113B, SSI $32B, TML $12B [R21 A8, U] ≈
    // $0.52T; ≈ $0.64T with Anthropic's Sep 2025 $183B. Late 2026: OpenAI $1.25T [U], Anthropic's IPO ≈ $1.26–1.40T, others
    // ≈ $0.1T (+ xAI $250B if counted; in SpaceX since Feb 2026) [R15 §2.9]: band kept.
    const start = ref.map((r) => storyNow(newGame(defaultSetupV2({ seed: r.s.setup.seed }))));
    const s0 = median(start.map(marksSum));
    const S0 = median(start.map((x) => x.sector.S));
    const lateOf = (k: 'sumV' | 'S') => median(ref.map((r) => { const a = r.q.find((x) => x.day >= dayOfDate(START, '2026-10-01')); const b = r.q.find((x) => x.day >= dayOfDate(START, '2027-01-01')); return a && b ? (a[k] + b[k]) / 2 : NaN; }).filter(Number.isFinite));
    const late = lateOf('sumV');
    t('f9.fc1', 'start $450–750B, late 2026 $2.2–3.3T', 'research/15 §2.9; R21 A8', s0 >= 450 && s0 <= 750 && late >= 2200 && late <= 3300, 'F9 (FC1) the private labs\' marks add up to ≈ $0.5–0.65T at the Jul 2025 start and ≈ $2.5–3T in late 2026 (mean of the Oct and Jan marks), RefBot path', `start median ${f1(s0)}B · late 2026 median ${f1(late)}B (sector value S: start ${f1(S0)}B, late 2026 ${f1(lateOf('S'))}B)`);
    const marks = ref.flatMap((r) => r.q.filter((x) => x.year <= 2027 && !x.bust && x.R >= 1));
    const hi = marks.filter((x) => x.g >= 2.5).map((x) => x.V / x.R);
    const lo = marks.filter((x) => x.g < 2.5).map((x) => x.V / x.R);
    t('f9.fc2', '20–37× run-rate', 'research/15 §2.9 (FC2)', median(hi) >= 20 && median(hi) <= 37, 'F9 (FC2) leader-style multiple 20–37× run-rate at high growth (RefBot marks with ×2.5+ a year, no bust, through 2027)', `median ${f1(median(hi))}× over ${hi.length} marks (slower growth: ${f1(median(lo))}× over ${lo.length})`);
    // FC2's "trailing labs lower" (C11: ≈ 15–20× at ×2–3 a year). Compared within each year (years with ≥ 3 marks on both
    // sides): C11's growth gradient is a same-date claim; pooled over 2025–27 it read growth through the year's sector multiple.
    const tr = ref.flatMap((r) => r.q.filter((x) => x.year <= 2026 && !x.bust).flatMap((x) => x.trailing.map((q) => q.v / q.r)));
    const tr27 = ref.flatMap((r) => r.q.filter((x) => x.year === 2027 && !x.bust).flatMap((x) => x.trailing.map((q) => q.v / q.r)));
    const byYear = [2025, 2026, 2027].map((y) => ({ y, h: marks.filter((x) => x.year === y && x.g >= 2.5).map((x) => x.V / x.R), l: marks.filter((x) => x.year === y && x.g < 2.5).map((x) => x.V / x.R) })).filter((z) => z.h.length >= 3 && z.l.length >= 3);
    t('f9.fc2growth', 'slower growth → lower multiple, each year', 'research/15 §2.9 (C11)', byYear.length > 0 && byYear.every((z) => median(z.l) < median(z.h)), 'F9 (FC2) the leader-style lab is valued at a lower multiple when its growth is slower, in the same year (C11)', `${byYear.map((z) => `${z.y}: ×2.5+ ${f1(median(z.h))}× (${z.h.length}) · slower ${f1(median(z.l))}× (${z.l.length})`).join(' · ') || 'no year with both'} · pooled ${f1(median(hi))}× / ${f1(median(lo))}×`);
    // At the same revenue scale. The sourced multiple falls with revenue: Anthropic's marks at growth ≥ ×8 a year throughout
    // (R15 §2.9 [P]; the IPO total [U]) ran 37× at $5B (Series F), 27× at $14B (G), 20.5× at $47B (H), ≈ 16–17× at $81B
    // (IPO): m_A(R) = 37 × (R ÷ $5B)^−0.28 within 3%. The check compares each mark with m_A at its own revenue.
    const mA = (R: number) => 37 * Math.pow(R / 5, -0.28);
    const trA = ref.flatMap((r) => r.q.filter((x) => x.year <= 2026 && !x.bust).flatMap((x) => x.trailing.map((q) => q.v / q.r / mA(q.r))));
    const hiA = marks.filter((x) => x.g >= 2.5).map((x) => x.V / x.R / mA(x.R));
    t('f9.fc2trailing', 'trailing median < leader-style median (÷ m_A)', 'research/15 §2.9 [P]/[U] (Anthropic marks); R21 [U]', trA.length > 0 && median(trA) < median(hiA), 'F9 (FC2, FIN5b) trailing private rivals are valued at a lower multiple than the leader-style lab at the same revenue scale (each mark ÷ Anthropic\'s multiple at that revenue; their marks through 2026)', `trailing rivals ×${median(trA).toFixed(2)} of m_A over ${trA.length} lab-marks (raw ${f1(median(tr))}×; 2027 ${f1(median(tr27))}× over ${tr27.length}) · leader-style ×${median(hiA).toFixed(2)} (raw ${f1(median(hi))}×)`);
    const dil = ref.flatMap((r) => r.s.player.finance.rounds.filter((x) => !x.anchor && !x.down).map((x) => x.dilution));
    t('f9.dilution', 'max ≤ 8%', 'V2-SPEC §7.2 F9 (C12)', dil.length > 0 && Math.max(...dil) <= 0.08 + 1e-9, 'F9 unanchored round dilution ≤ 8% (C12)', `max ${f1(Math.max(...dil) * 100)}% over ${dil.length} rounds`);
  }

  // ───────────── FIN2: raises on the reference path ─────────────
  {
    // The reference bot (FIN2 autopilot): raises when its cash projection runs short, at the ceiling, on the milestone it is surest of.
    const per = (y: number) => median(ref.map((r) => r.s.player.finance.rounds.filter((x) => Math.floor(decimalYear(r.s, x.day) + 1e-9) === y).length));
    const judged = ref.flatMap((r) => r.s.player.finance.promises.filter((p) => p.result));
    const byType = (ty: string) => judged.filter((p) => p.type === ty).length;
    const met = judged.filter((p) => p.result!.outcome === 'met').length;
    const cred = median(ref.map((r) => r.s.player.finance.credibility));
    t('fin2.rounds', '1–4 rounds a year (median)', 'design/FINANCE-V3.md §2 (it raised at the ceiling every quarter before FIN2)', per(2026) >= 1 && per(2026) <= 4 && per(2027) >= 1 && per(2027) <= 4, 'FIN2 RefBot raises 1–4 rounds a year (median; it raised at the ceiling every quarter before FIN2)', `2026 ${per(2026)} · 2027 ${per(2027)} · promises judged ${judged.length} (met ${F1pct(met / Math.max(1, judged.length))}; scale ${byType('scale')}, adoption ${byType('adoption')}, capability ${byType('capability')}) · end-2027 credibility median ${f1(cred)}`);
  }
  // ───────────── FIN3a: board confidence on the reference path ─────────────
  {
    // Lead decision after FINREF (2026-11-21): ≥ 55 is a design target, not a source. Since M10 the RefBot plays AI 2027's
    // small safety share and has more public incidents, which lowers the board: an emergent consequence, so only a collapse
    // (median < 40) is out of band. The 12-seed median sits in a gap between two clusters (29–48 and 53–67).
    const bc = median(ref.map((r) => r.s.player.board.confidence));
    t('fin3a.board', 'median ≥ 40 (collapse guard; design target ≥ 55)', 'design/FINANCE-V3.md §7.3; lead decision after FINREF 2026-11-21', bc >= 40, 'FIN3a RefBot end-2027 board confidence median ≥ 40 (collapse guard)', `median ${f1(bc)} (${ref.map((r) => r.s.player.board.confidence.toFixed(0)).join(' ')}); design target ≥ 55`);
  }
  // ───────────── FIN3b: the safety committee under the nonprofit PBC ─────────────
  {
    // How often the committee bites on the reference bot: leader start (legacy nonprofit), recapitalised into a nonprofit PBC
    // around Q4 2026; ready models it held back, through 2027.
    const pbc = ref.filter((r) => r.pbcDays > 0);
    const games = pbc.filter((r) => r.held.length > 0).length;
    const versions = pbc.reduce((a, r) => a + r.held.length, 0);
    const sh = median(pbc.map((r) => r.heldDays / Math.max(1, r.pbcDays)));
    t('fin3b.committee', '≥ 1 game reaches the PBC; median share ≤ 50%', 'design/FINANCE-V3.md §7.5', pbc.length > 0 && sh <= 0.5, 'FIN3b the safety committee binds without freezing releases (RefBot under the nonprofit PBC: median share of weeks with a model held ≤ 50%)', `${pbc.length} of ${ref.length} games reach the PBC · ${games} held a model · ${versions} versions held · median ${F1pct(sh)} of PBC weeks with a hold`);
  }
  // ───────────── FIN4a / FIN4b: the reference bot's partner deal ─────────────
  {
    const deals = ref.map((r) => r.s.player.finance.deals.find((d) => d.kind === 'hyperscaler' && !d.legacy && !d.rescue)).filter((d): d is NonNullable<typeof d> => !!d);
    const by = deals.reduce((a, d) => ({ ...a, [d.partner]: (a[d.partner] ?? 0) + 1 }), {} as Record<string, number>);
    const tot = median(deals.map((d) => d.supply?.total ?? 0));
    const eq = median(deals.map((d) => d.equityNow + d.equityLater));
    t('fin4a.deal', '≥ 80% of seeds, cloud, partner discount', 'design/FINANCE-V3.md §6', deals.length >= 0.8 * ref.length && deals.every((d) => d.supply?.kind === 'cloud' && (d.supply.partnerDiscount ?? 0) > 0), 'FIN4a RefBot signs one hyperscaler cloud deal (≥ 80% of seeds), on the expected path with the partner discount', `${deals.length}/${ref.length} · ${JSON.stringify(by)} · equity median $${f1(eq)}B · take-or-pay median $${f1(tot)}B · ${f1(median(deals.map((d) => d.supply?.h100e ?? 0)) / 1e6)}M H100e · $${f1(median(deals.map((d) => d.supply?.first ?? 0)))}K → $${f1(median(deals.map((d) => d.supply?.last ?? 0)))}K`);
    const n = ref.map((r) => partnersNow(r.s).length);
    const ST = PARTNER_TERMS.strings;
    t('fin4b.deal', '≥ 80% of seeds, exclusive, no IP access, ≤ max partners', 'design/FINANCE-V3.md §6.1', deals.length >= 0.8 * ref.length && deals.every((d) => d.strings.exclusivity && !d.strings.ipAccess) && n.every((x) => x <= ST.maxPartners),
      'FIN4b RefBot takes one hyperscaler deal with exclusivity and without IP access; never more than 3 partners', `${deals.length}/${ref.length} · equity median $${f1(median(deals.map((d) => d.equityNow + d.equityLater)))}B · partners ${JSON.stringify(n)}`);
  }
  // ───────────── FIN5a: the story on the reference path ─────────────
  {
    // The reference bot's equity a year stays in the 2025–26 range (OpenAI raised $40B in 2025, $122B in 2026).
    const e25 = median(ref.map((r) => r.s.player.finance.ws3.years['2025']?.equity ?? 0));
    const e26 = median(ref.map((r) => r.s.player.finance.ws3.years['2026']?.equity ?? 0));
    const sh = median(ref.map((r) => r.q.find((x) => x.day >= dayOfDate(START, '2026-10-01'))?.share ?? NaN).filter(Number.isFinite));
    t('fin5a.equity', 'H2 2025 $5–45B, 2026 $50–150B', 'OpenAI raised $40B in 2025, $122B in 2026', e25 >= 5 && e25 <= 45 && e26 >= 50 && e26 <= 150, 'FIN5a RefBot equity raised a year in the 2025–26 range (H2 2025 $5–45B, 2026 $50–150B)', `2025 H2 ${f1(e25)}B · 2026 ${f1(e26)}B · story share Oct 2026 ${F1pct(sh)}`);
  }
  // ───────────── FIN5b: rivals' finance (FC6) ─────────────
  {
    // FC6 on the reference path: private rivals stay funded through 2026; the end-2026 picture by kind (analogues:
    // Anthropic $380B–1.3T on $14–47B, xAI $230–250B, SSI $32B; FIN5b notes).
    const all = ref.flatMap((r) => r.private0);
    const alive = ref.flatMap((r) => r.rivals2026.filter((x) => x.status === 'active'));
    const show = (k: string) => { const xs = alive.filter((x) => x.arch === k); return xs.length ? `${k} ${xs.length}: V $${f1(median(xs.map((x) => x.V)))}B on $${f1(median(xs.map((x) => x.R)))}B (${f1(median(xs.map((x) => x.V / Math.max(0.1, x.R))))}×)` : `${k} 0`; };
    t('fin5b.fc6', '≥ 75% of private rivals active at end-2026', 'research/15 §2.9; R21 (FC6)', all.length > 0 && alive.length / all.length >= 0.75, 'FIN5b (FC6) trailing private rivals stay funded through 2026 (≥ 75% of them still active at end-2026, RefBot path)', `${alive.length} of ${all.length} active · ${['safety', 'racer', 'upstart'].map(show).join(' · ')}`);
  }
  // ───────────── FIN6a: calibration on the reference path ─────────────
  {
    // FC2 by year: the leader-style multiple stays in 20–37× at high growth in 2027 too, and the 2026 marks sit near the
    // band's low end. FC4 printed: commitments ÷ revenue run-rate (a known miss, FIN6a notes).
    const hi = (y: number) => ref.flatMap((r) => r.q.filter((x) => x.year === y && !x.bust && x.R >= 1 && x.g >= 2.5).map((x) => x.V / x.R));
    const m26 = median(hi(2026));
    const m27 = median(hi(2027));
    t('fin6a.fc2', '2027 in 20–37×, 2026 ≥ 15×', 'research/15 §2.9 (FC2)', hi(2027).length > 0 && m27 >= 20 && m27 <= 37 && m26 >= 15, 'FIN6a (FC2) leader-style multiple at high growth by year: 2027 inside 20–37× (no runaway), 2026 at least 15×', `2026 ${f1(m26)}× (${hi(2026).length}) · 2027 ${f1(m27)}× (${hi(2027).length}) · end-2027 valuation median $${(median(ref.map((r) => r.s.player.finance.valuation)) / 1000).toFixed(2)}T`);
    const R27 = median(ref.map((r) => r.s.player.finance.revenueRun));
    console.log(`  INFO FIN6a (FC4) RefBot end-2027 commitments remaining $${f1(median(ref.map((r) => commitmentsRemaining(r.s))))}B on a $${f1(R27)}B run-rate; partner take-or-pay ÷ its equity ${f1(median(ref.flatMap((r) => r.s.player.finance.deals.filter((d) => d.kind === 'hyperscaler' && !d.legacy && d.day >= 0 && d.supply).map((d) => d.supply!.total / Math.max(1e-9, d.equityNow + d.equityLater)))))}×`);
  }
  // ───────────── FIN5c: the mixed bot as a division head ─────────────
  {
    // One seed, a year and a half: it keeps to the budget room, the state is never distress, the first review judges three
    // goals and sets the budget by the rule (the rule itself is checked constructed in finance.ts).
    const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
    const s = newGame(defaultSetupV2({ seed: 30000, world: 'tl-central', alignment: 'medium', tutorial: false, start: 'bigtech' }));
    let distress = 0;
    while (s.time.day < 550 && !s.ending) {
      for (const p of [...s.events.pending]) if (resolve(s, p.instance, mixedBot.decide(s, p))) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
      mixedBot.act(s, engine);
      tick(s);
      if (s.player.finance.state !== 'healthy') distress++;
    }
    const d = s.player.finance.ws3.division!;
    const rv = d.reviews[0];
    t('fin5c.divisionBot', 'never tight or in distress; first review judges 3 goals', 'design/FINANCE-V3.md §13', distress === 0 && !!rv && rv.goals.met + rv.goals.near + rv.goals.missed === 3 && near(d.budget, d.plan * budgetFactor(d.confidence)), 'FIN5c mixed bot as a division head: never tight or in distress; the first review judges three goals and sets the budget by the rule', `year 0: spent $${f1(rv?.spent ?? 0)}B of $${f1(rv?.budget ?? 0)}B, over $${f1(rv?.over ?? 0)}B (${f1(rv?.overConf ?? 0)}), goals ${JSON.stringify(rv?.goals)} · year 1 budget $${f1(d.budget)}B at confidence ${f1(d.confidence)}`);
  }
  return rows;
}
