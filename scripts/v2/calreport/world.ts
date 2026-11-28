// Calibration targets: world (outside world, revenue, labour/adoption/token anchors on reference play).
// Moved from worldfx.ts (test audit CRB, design/TESTING.md §0): every sourced outcome band of the RefBot reference game
// (V2-SPEC §7.3, F11; research/16 §6–7, research/22). Plays one RefBot game per seed (tl-central, endings skipped) to
// 2028-01-15 (915 days, ≈ 45 ms a game-day ≈ 40 CPU-s); seed 2027 plus CALREPORT_SEEDS-1 more for the timing medians
// (env CALREPORT_SEEDS, default 5). Games go through the simulation cache (simcache.ts), keyed on the game.
// Date targets use ±3 months (R16 §7 test 1), on the median first day over the seeds (model v3 F4; calseeds.ts).
// Band arithmetic: the date checks have a ±92-day window; one seed's first day spreads p10–p90 90–170 d (sd ≈ 35–66 d),
// so the median of n seeds has se ≈ 1.25·66/√n ≈ 37 d at n = 5, well inside the window.
import { dayOfDate, decimalYear } from '../../../src/engine/v2/core/time';
import { tick, resolve } from '../../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { HEADLINES } from '../../../src/engine/v2/worldfx/headlines';
import { consumerUse, firmAdoption, remoteWorkAutomation, workBilling, workUse, youthExposedEmployment } from '../../../src/engine/v2/worldfx/readouts';
import { worldMix } from '../../../src/engine/v2/worldfx/mix';
import { labMarketRevenue } from '../../../src/engine/v2/worldfx/revenue';
import type { GameStateV2, SetupV2 } from '../../../src/engine/v2/types';
import { refBot } from '../../../src/engine/v2/bots/ref';
import { newGame, defaultSetupV2 } from '../../../src/engine/v2/core/init';
import { engine } from '../../../src/engine/v2/index';
import { fileURLToPath } from 'node:url';
import { cached, pick } from '../simcache';
import { CAL_SEED, CAL_SEEDS, medianOf, quantOf } from '../calseeds';
import type { Target } from './types';

export const area = 'world';

const START = '2025-07-01';
const D = (iso: string) => dayOfDate(START, iso);
const fmt = (day: number | undefined) => (day === undefined ? 'never' : new Date(Date.parse(START) + day * 864e5).toISOString().slice(0, 10));
const within = (day: number | undefined, iso: string, tol = 92) => day !== undefined && Math.abs(day - D(iso)) <= tol;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

interface Trace {
  s: GameStateV2;
  annual: Record<number, number>;
  firstHire10?: number;
  firstRemote25?: number;
  firstU12?: number;
  firstAccept85?: number;
  /** A2c: calendar-year revenue of the non-China closed providers (rivals' demand-side market revenue; the player's in
   *  `annual`). */
  rivalAnnual: Record<number, number>;
  at: Record<string, { U: number; youthSoft: number; youthU: number; friend: number; hireSoft: number; youthX: number; firm: number; rev: number; use: ReturnType<typeof workUse>; cons: ReturnType<typeof consumerUse>; bill: ReturnType<typeof workBilling> }>;
}

const FILES = [fileURLToPath(import.meta.url)];
const MARKS = ['2025-07-02', '2025-07-31', '2026-01-01', '2026-07-01', '2026-11-01', '2026-12-31', '2027-07-01', '2027-10-01', '2027-12-31'];
const HORIZON = D('2028-01-15');

/** One day of real reference play: RefBot decides pending events, acts, then the engine ticks (endings skipped). */
function refDay(s: GameStateV2) {
  for (const p of [...s.events.pending]) {
    const c = refBot.decide(s, p);
    if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
  }
  refBot.act(s, engine);
  tick(s, { skip: ['endings'] });
}
const refGameV2 = (over: Partial<SetupV2> = {}) => newGame(defaultSetupV2({ seed: 2027, world: 'tl-central', alignment: 'medium', tutorial: false, ...over }));

function run(over: Partial<SetupV2>, days: number): Trace {
  const s = refGameV2(over);
  const U: number[] = [];
  const tr: Trace = { s, annual: {}, rivalAnnual: {}, at: {} };
  const marks = new Map(MARKS.map((m) => [D(m), m]));
  while (s.time.day < days) {
    refDay(s);
    const d = s.time.day;
    const W = s.world;
    const rev = s.player.deployments.reduce((a, x) => a + (x.revenueRate ?? 0), 0);
    const y = Math.floor(decimalYear(s));
    tr.annual[y] = (tr.annual[y] ?? 0) + rev / 365;
    U[d] = W.unemployment.US;
    if (tr.firstHire10 === undefined && W.sectors.US.SOFT.hireRate <= 0.1) tr.firstHire10 = d;
    if (tr.firstRemote25 === undefined && remoteWorkAutomation(s) >= 0.25) tr.firstRemote25 = d;
    if (tr.firstU12 === undefined && d >= 365 && W.unemployment.US - U[d - 365] >= 1) tr.firstU12 = d;
    if (tr.firstAccept85 === undefined && W.control.GOV.accept >= 0.85) tr.firstAccept85 = d;
    if (d % 7 === 0 && y >= 2025 && y <= 2027) {
      let rv = 0;
      for (const p of worldMix(s).providers) if (p.key !== 'player' && p.key !== 'china' && !p.open) rv += labMarketRevenue(s, p.key);
      tr.rivalAnnual[y] = (tr.rivalAnnual[y] ?? 0) + (rv * 7) / 365;
    }
    const m = marks.get(d);
    if (m) {
      tr.at[m] = {
        U: W.unemployment.US, youthSoft: W.fx.youthRel.SOFT, youthU: W.youthUnemployment, friend: W.friendShare,
        hireSoft: W.sectors.US.SOFT.hireRate, youthX: youthExposedEmployment(s), firm: firmAdoption(s), rev: s.player.finance.revenueRun,
        use: workUse(s, 'US'), cons: consumerUse(s), bill: workBilling(s),
      };
    }
  }
  return tr;
}

/** run() through the simulation cache; the final state keeps only the paths read here. */
function runC(over: Partial<SetupV2>): Trace {
  return cached('calreport-world-run', { over, days: HORIZON }, FILES, () => {
    const tr = run(over, HORIZON);
    return { ...tr, s: pick(tr.s, ['headlines']) };
  });
}

interface TimingRec { hire10: number | null; remote25: number | null; u12: number | null; accept85: number | null; f11_2027: number; a2c: number }
const tokOf = (tr: Pick<Trace, 'at'>, m: string) => { const b = tr.at[m].bill; return b.world.tokAdopted + b.world.tokSeated + b.world.tokAgent + b.consumerTokens; };
const timingOf = (tr: Trace): TimingRec => ({
  hire10: tr.firstHire10 ?? null, remote25: tr.firstRemote25 ?? null, u12: tr.firstU12 ?? null, accept85: tr.firstAccept85 ?? null,
  f11_2027: tr.annual[2027] ?? 0, a2c: tokOf(tr, '2026-12-31') / tokOf(tr, '2026-01-01'),
});
function timingRec(seed: number): TimingRec {
  return cached('calreport-world-timing', { seed, days: HORIZON }, FILES, () => timingOf(run({ seed }, HORIZON)));
}

/** Seeds: CAL_SEEDS (2027 first), CALREPORT_SEEDS of them (default 5). */
const nSeeds = () => Math.max(1, Number(process.env.CALREPORT_SEEDS ?? 5));

export function targets(): Target[] {
  const rows: Target[] = [];
  const row = (id: string, label: string, band: string, value: string, ok: boolean, source: string) => rows.push({ id: `world.${id}`, label, band, value, ok, source });
  const range = (id: string, label: string, v: number, lo: number, hi: number, value: string, source: string) => row(id, label, `${lo}–${hi}`, value, v >= lo && v <= hi, source);

  const c = runC({});
  const at = c.at;
  const U0 = 4.3;
  const seeds = CAL_SEEDS.slice(0, nSeeds());

  // ───────────── Reference play (§7.3 table, F11) ─────────────
  range('rev.jul2025', 'F11 Jul 2025 run-rate ≈ $12B (capacity-bound, ±35%)', at['2025-07-31'].rev, 9, 16.5, `$${at['2025-07-31'].rev.toFixed(1)}B`, 'V2-SPEC §7.3, F11');
  // FINREF: AI 2027's $45B is a plot point; the measured 2026 leader (Anthropic) earns ≈ $53–56B (research/22 §4 [P]): both ±20%.
  range('rev.2026', 'F7/F11 2026 revenue $45B (AI 2027) to $53–56B (Anthropic CY2026, research/22 §4), ±20%', c.annual[2026], 36, 67, `$${c.annual[2026].toFixed(1)}B`, 'research/22 §4 [P]; AI 2027');
  range('rev.2027', 'F11 2027 revenue ~$140B (±30%)', c.annual[2027], 98, 182, `${c.annual[2027].toFixed(1)}B`, 'V2-SPEC §7.3, F11');
  row('youth.2026', 'Late 2026: SOFT youth employment falling, youth unemployment rising', 'SOFT 22–25 down > 0.03, hire down, youth U up',
    `SOFT 22–25 ${at['2026-01-01'].youthSoft.toFixed(3)} → ${at['2026-12-31'].youthSoft.toFixed(3)}; hire ${at['2026-01-01'].hireSoft.toFixed(2)} → ${at['2026-12-31'].hireSoft.toFixed(2)}; youth U ${at['2026-01-01'].youthU.toFixed(1)} → ${at['2026-12-31'].youthU.toFixed(1)}%`,
    at['2026-12-31'].youthSoft < at['2026-01-01'].youthSoft - 0.03 && at['2026-12-31'].hireSoft < at['2026-01-01'].hireSoft && at['2026-12-31'].youthU > at['2026-01-01'].youthU, 'V2-SPEC §7.3');
  row('u.2026', 'Late 2026: aggregate U < +0.3 pp', '< +0.3 pp', `${(at['2026-12-31'].U - U0).toFixed(2)} pp`, at['2026-12-31'].U - U0 < 0.3, 'V2-SPEC §7.3');

  // The four date checks bind on the MEDIAN first day over the seeds (never reached = +∞). `info` ones are AI 2027
  // scenario projections (research/01 row 37), like F11's floor, not measurements (DECISIONS.md "After CAL2"): reported,
  // never out of band.
  const recs = [timingOf(c), ...seeds.filter((x) => x !== CAL_SEED).map((x) => timingRec(x))];
  const dateCheck = (id: string, key: 'hire10' | 'remote25' | 'u12' | 'accept85', iso: string, label: string, info = false) => {
    const days = recs.map((r) => r[key] ?? Infinity);
    const med = medianOf(days);
    const inWin = days.filter((d) => within(d, iso)).length;
    const fd = (d: number) => (Number.isFinite(d) ? fmt(Math.round(d)) : 'never');
    const detail = `median over ${recs.length} seed(s) ${fd(med)} (p10 ${fd(quantOf(days, 0.1))}, p90 ${fd(quantOf(days, 0.9))}; ${inWin}/${recs.length} in the window); seed ${CAL_SEED} ${fmt(recs[0][key] ?? undefined)}`;
    row(id, label + (info ? ' [AI 2027 scenario projection, not binding]' : ''), `${iso} ± 92 d`, detail, info || within(med, iso), info ? 'research/01 row 37; DECISIONS.md "After CAL2"' : 'AI 2027 / R16 §7 test 1');
  };
  dateCheck('date.hire10', 'hire10', '2027-07-01', 'Jul 2027 (±3 mo): HireRate_SOFT ≤ 10%');
  range('friend.2027', 'Jul 2027: AI-friend share 10% (±3)', at['2027-07-01'].friend, 0.07, 0.13, pct(at['2027-07-01'].friend), 'V2-SPEC §7.3');
  dateCheck('date.remote25', 'remote25', '2027-10-01', 'Oct 2027 (±3 mo): 25% of remote-work jobs done by AI', true);
  dateCheck('date.u12', 'u12', '2027-10-01', 'Oct 2027 (±3 mo): U +1 pp over 12 months', true);
  dateCheck('date.accept85', 'accept85', '2027-12-15', 'Dec 2027 (±3 mo): GOV T1 Accept ≥ 0.85');
  if (recs.length > 1) {
    const f = recs.map((r) => r.f11_2027);
    const g = recs.map((r) => r.a2c);
    console.log(`  INFO F4 spread over ${recs.length} seeds (rows read seed ${CAL_SEED}): F11 2027 revenue median $${medianOf(f).toFixed(1)}B (p10 $${quantOf(f, 0.1).toFixed(1)}B, p90 $${quantOf(f, 0.9).toFixed(1)}B; floor $98B); A2c tokens a day over 2026 median ×${medianOf(g).toFixed(1)} (p10 ×${quantOf(g, 0.1).toFixed(1)}, p90 ×${quantOf(g, 0.9).toFixed(1)}; band ×4.6–20)`);
  }

  // A2a: hours of AI use and hours saved per hour of use from the worker surveys (research/22 §1; Bick, Blandin & Deming
  // RPS on FRED): 4.1% of US work-hours assisted (Q3 2024) → 5.7% (Q3 2025) → 6.3% (Q2 2026); 39–41% of workers; 2.2% of
  // hours saved, 0.35 per hour of use.
  {
    const u0 = at['2025-07-02'].use;
    const u26 = at['2026-07-01'].use;
    const uEnd = at['2027-12-31']?.use;
    range('a2a.hours', 'A2a mid-2026: US hours of AI use ≈ 6% of work-hours (RPS 6.3% Q2 2026; 5–6.5%)', u26.hours, 0.05, 0.065, pct(u26.hours), 'research/22 §1 (RPS)');
    range('a2a.savedPerHour', 'A2a start: an hour of AI use saves ≈ 0.35 hours of work (RPS 2.2 / 6.3; 0.3–0.4)', u0.savedPerHour, 0.3, 0.4, u0.savedPerHour.toFixed(3), 'research/22 §1 (RPS)');
    range('a2a.workers', 'A2a 2026: ≈ 40% of US workers use AI at work (RPS 39–41%; 35–45%)', u26.workers, 0.35, 0.45, pct(u26.workers), 'research/22 §1 (RPS)');
    range('a2a.saved', 'A2a mid-2026: hours saved ≈ 2.2% of US work-hours (RPS)', u26.saved, 0.017, 0.027, pct(u26.saved), 'research/22 §1 (RPS)');
    row('a2a.agency', 'A2a: hours saved per hour of use rise with agency (substituted share α·A/U grows)', 'rising 2025 → 2026 → 2027 (+0.05 by the end)',
      `${u0.savedPerHour.toFixed(3)} → ${u26.savedPerHour.toFixed(3)} → ${uEnd?.savedPerHour.toFixed(3) ?? 'n/a'}`,
      (uEnd === undefined || uEnd.savedPerHour > u26.savedPerHour + 0.05) && u26.savedPerHour > u0.savedPerHour, 'research/22 §1');
    row('a2a.firms', 'A2a: firm adoption (BTOS analogue, firm-weighted) stays a separate, lower quantity than worker use', 'firms < workers − 0.1', `firms ${pct(at['2026-11-01'].firm)} vs workers ${pct(u26.workers)}`, at['2026-11-01'].firm < u26.workers - 0.1, 'research/22 §1 (BTOS vs RPS)');
    console.log(`  INFO A2a US hours of use (share of work-hours; RPS 4.1% Q3 2024, 5.7% Q3 2025, 6.3% Q2 2026, 5.3% Q3 2026): ${MARKS.filter((m) => at[m]).map((m) => `${m} ${pct(at[m].use.hours)} (workers ${pct(at[m].use.workers)}, saved/h ${at[m].use.savedPerHour.toFixed(2)})`).join('; ')}`);
  }
  // A2b: consumer chat from measured anchors (research/22 §2): weekly reach (US ≈ 50% of adults use genAI outside work,
  // Nov 2025), the market's paid share (5–6%), subscribers × price as its own revenue line.
  {
    const c0 = at['2025-07-02'].cons;
    const c26 = at['2026-07-01'].cons;
    row('a2b.reach', 'A2b 2026: US weekly AI chat reach ≈ 50–60% of adults (RPS ≈ 50% non-work use Nov 2025), ROW below the US', 'US 45–65%, ROW below US',
      `US ${pct(c26.regions.US.reach)}, ROW ${pct(c26.regions.ROW.reach)}`, c26.regions.US.reach >= 0.45 && c26.regions.US.reach <= 0.65 && c26.regions.ROW.reach < c26.regions.US.reach, 'research/22 §2 (RPS Nov 2025)');
    const ps = (x: typeof c0) => x.subs / Math.max(1, x.users);
    row('a2b.paidShare', 'A2b: the market\'s paid share stays near the measured 5–6% (4–9%) through 2026', '4–9% at both ends', `${pct(ps(c0))} → ${pct(ps(c26))}`,
      ps(c0) >= 0.04 && ps(c0) <= 0.09 && ps(c26) >= 0.04 && ps(c26) <= 0.09, 'research/22 §2');
    console.log(`  INFO A2b consumer (all providers, US + ROW): ${MARKS.filter((m) => at[m]).map((m) => `${m} users ${(at[m].cons.users / 1e6).toFixed(0)}M, subs ${(at[m].cons.subs / 1e6).toFixed(0)}M (${pct(ps(at[m].cons))}), spend $${at[m].cons.spend.toFixed(1)}B, player users ${((at[m].cons.regions.US.playerUsers + at[m].cons.regions.ROW.playerUsers) / 1e6).toFixed(0)}M`).join('; ')}`);
  }
  // A2c: who pays for work use, and the agent-work term (research/22 §3–7).
  {
    const b = (m: string) => at[m].bill;
    const exCN = (m: string) => b(m).world.seats - b(m).regions.CN.seats;
    const tok = (m: string) => b(m).world.tokAdopted + b(m).world.tokSeated + b(m).world.tokAgent + b(m).consumerTokens;
    const kOf = (m: string) => b(m).world.agent / Math.max(1, b(m).world.supervising);
    row('a2c.seats', 'A2c: paid enterprise seats outside China ≈ 30M in Jan 2026 and ≈ 50M by mid-2026 (R22 4e–4g: M365 Copilot 15M → 30M, ChatGPT > 7M, Gemini > 8M)',
      'Jan 2026 20–45M, Jul 2026 35–75M', `${MARKS.slice(0, 6).map((m) => `${m} ${(exCN(m) / 1e6).toFixed(0)}M`).join(', ')}`,
      exCN('2026-01-01') >= 20e6 && exCN('2026-01-01') <= 45e6 && exCN('2026-07-01') >= 35e6 && exCN('2026-07-01') <= 75e6, 'research/22 §4e–4g');
    const g26 = tok('2026-12-31') / tok('2026-01-01');
    // Band ×4.6–×20 (M10, lead decision after MKT; was ×3–8, anchored on Google's first-party API alone). research/22 §3
    // and §7 [P] measure the growth of token volume over a year on three instruments: Google first-party API tokens 7B →
    // 32B a minute Q3 2025 → Q3 2026 (×4.6, row 3a); Google all surfaces 480T a month (May 2025) → > 1.3 quadrillion (Oct
    // 2025), "> 20× in a year" (row 3b); OpenAI enterprise reasoning tokens per organisation ×320 in the 12 months to
    // Nov 2025 (row 3c: per organisation and reasoning-only, an upper outlier, not a world total). The game's world total
    // (API + seats + agents + consumer, every provider) sits between the API-only and the all-surface measures.
    row('a2c.tokens', 'A2c: tokens a day grow ×4.6–20 over 2026 (R22 3a–3b: Google first-party API ×4.6/yr, Google all surfaces ×20/yr), through agent-hours per supervising hour rising with horizon and coverage',
      '×4.6–20, agent-hours per supervising hour rising',
      `×${g26.toFixed(1)} (${(tok('2026-01-01') / 1e12).toFixed(0)}T → ${(tok('2026-12-31') / 1e12).toFixed(0)}T a day); agent-hours per supervising hour ${['2026-01-01', '2026-07-01', '2026-12-31'].map((m) => kOf(m).toFixed(2)).join(' → ')}`,
      g26 >= 4.6 && g26 <= 20 && kOf('2026-12-31') > kOf('2026-07-01') && kOf('2026-07-01') > kOf('2026-01-01'), 'research/22 §3, §7 (rows 3a–3b)');
    // CAL3-I: usage intensity per adopter = work tokens per hour of use. Measured Q3 2025 → Q3 2026: Google first-party API
    // tokens ×4.6 (R22 3a) over US hours of use ×1.0–1.15 (RPS, R22 §7) → ×4.0–4.6 a year; OpenRouter tokens per request
    // ×1.8–2.2 a year (openrouter.ai/state-of-ai, Dec 2025). Reported, not fitted.
    const perUseH = (m: string) => {
      const w = b(m).world;
      return ((w.tokAdopted + w.tokSeated + w.tokAgent) * 365) / Math.max(1, w.adopted + w.seated + w.unseated);
    };
    console.log(`  INFO A2c intensity: work tokens per hour of use ${['2025-07-02', '2026-01-01', '2026-07-01', '2026-12-31'].map((m) => `${m} ${(perUseH(m) / 1e3).toFixed(0)}k`).join(', ')}; Jul 2025 → Jul 2026 ×${(perUseH('2026-07-01') / perUseH('2025-07-02')).toFixed(1)} (measured ×4.0–4.6 a year: Google API tokens ÷ RPS hours)`);
    const nonChina = c.annual[2026] + (c.rivalAnnual[2026] ?? 0);
    console.log(`  INFO A2c CY2026 non-China frontier-lab revenue (player actual + closed rivals' demand-side market revenue; R22 §4 $100–130B): $${nonChina.toFixed(1)}B, leader (player) $${c.annual[2026].toFixed(1)}B =${pct(c.annual[2026] / nonChina)}`);
  }
  // Headlines on the reference path: ≥ 10 distinct fire over the full run, one-shot ones once (a count tuning moves).
  {
    const fired = new Set(c.s.headlines.map((h) => h.id.split(':')[0]));
    const once = HEADLINES.filter((h) => h.cooldownDays === undefined).every((h) => c.s.headlines.filter((x) => x.id === h.id).length <= 1);
    row('headlines', 'headlines: ≥10 distinct fire on the reference path; one-shot ones fire once', '≥ 10 distinct, one-shots once', `${fired.size}: ${[...fired].join(' ')}`, fired.size >= 10 && once, 'worldfx/headlines.ts (reference path)');
  }

  // ───────────── The world at Nov 2026 (W4) ─────────────
  {
    const a = at['2026-11-01'];
    row('w4.u', 'W4: aggregate unemployment effect ≈ 0 at Nov 2026', '±0.15 pp', `${(a.U - U0).toFixed(2)} pp`, Math.abs(a.U - U0) <= 0.15, 'V2-SPEC §7.3, W4');
    range('w4.youthX', 'W4: exposed 22–25-year-olds −19% vs counterfactual (±5 pp)', a.youthX, 0.76, 0.86, `${((a.youthX - 1) * 100).toFixed(1)}%`, 'research/22 (exposed 22–25 employment), W4');
    // CAL-X: the anchor is BTOS 17–20% of firms over Dec 2025–May 2026 (19.8% on 3 May 2026; research/22 §1 1f [P]); read at
    // the Jul 2026 mark (the first after the window).
    const fJul = at['2026-07-01'].firm;
    range('w4.firms', 'W4: firm adoption 17–20% (±2 pp), BTOS Dec 2025–May 2026, at the Jul 2026 mark', fJul, 0.15, 0.22, pct(fJul), 'research/22 §1 1f [P] (BTOS)');
    console.log(`  INFO W4 firm adoption (BTOS 17.7% Jan → 19.8% May [P] → 21.7% Jul → 23.8% Sep 2026 [press]): ${['2026-01-01', '2026-07-01', '2026-11-01'].map((m) => `${m} ${pct(at[m].firm)}`).join(', ')}`);
    console.log(`  INFO W4 reality Nov 2026: US hours of use ${pct(a.use.hours)} (RPS 5.3% Q3 2026), workers using AI ${pct(a.use.workers)}, saved per hour of use ${a.use.savedPerHour.toFixed(3)}`);
  }
  return rows;
}
