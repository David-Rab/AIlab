// Calibration targets: world (outside world, revenue, labour/adoption/token anchors on reference play).
// Moved from worldfx.ts (test audit CRB, design/TESTING.md §0): every sourced outcome band of the RefBot reference game
// (V2-SPEC §7.3, F11; research/16 §6–7, research/22). Plays one RefBot game per seed (tl-central, endings skipped) to
// 2028-01-15 (915 days, ≈ 45 ms a game-day ≈ 40 CPU-s); seed 2027 plus CALREPORT_SEEDS-1 more for the timing medians
// (env CALREPORT_SEEDS, default 5). Games go through the simulation cache (simcache.ts), keyed on the game.
// Date targets use ±3 months (R16 §7 test 1), on the median first day over the seeds (model v3 F4; calseeds.ts).
// Band arithmetic: the date checks have a ±92-day window; one seed's first day spreads p10–p90 90–170 d (sd ≈ 35–66 d),
// so the median of n seeds has se ≈ 1.25·66/√n ≈ 37 d at n = 5, well inside the window.
import { START_DATE, dayOfDate, decimalYear, decimalYearOf } from '../../../src/engine/v2/core/time';
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
import { rowOf, type Target } from './types';

export const area = 'world';

const START = '2025-07-01';
const D = (iso: string) => dayOfDate(START, iso);
const fmt = (day: number | undefined) => (day === undefined ? 'never' : new Date(Date.parse(START) + day * 864e5).toISOString().slice(0, 10));
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
    if (tr.firstHire10 === undefined && W.sectors.US.SOFT.hireRate <= 0.1) tr.firstHire10 = d; // band-lint: ok event definition of the date target
    if (tr.firstRemote25 === undefined && remoteWorkAutomation(s) >= 0.25) tr.firstRemote25 = d; // band-lint: ok event definition of the date target
    if (tr.firstU12 === undefined && d >= 365 && W.unemployment.US - U[d - 365] >= 1) tr.firstU12 = d; // band-lint: ok event definition of the date target
    if (tr.firstAccept85 === undefined && W.control.GOV.accept >= 0.85) tr.firstAccept85 = d; // band-lint: ok event definition of the date target
    if (d % 7 === 0 && y >= 2025 && y <= 2027) { // band-lint: ok measured years
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
  const R = (id: string, value: string, measured: number | number[] | boolean, suffix?: string) => rows.push(rowOf(id, value, measured, suffix));

  const c = runC({});
  const at = c.at;
  const U0 = 4.3;
  const seeds = CAL_SEEDS.slice(0, nSeeds());

  // ───────────── Reference play (§7.3 table, F11) ─────────────
  R('F11.startRunRate', `$${at['2025-07-31'].rev.toFixed(1)}B`, at['2025-07-31'].rev, 'Jul 2025');
  R('F7.revenue2026', `$${c.annual[2026].toFixed(1)}B`, c.annual[2026], 'RefBot seed 2027');
  R('F11.revenue2027', `${c.annual[2027].toFixed(1)}B`, c.annual[2027]);
  R('W.youthSoft2026', `SOFT 22–25 ${at['2026-01-01'].youthSoft.toFixed(3)} → ${at['2026-12-31'].youthSoft.toFixed(3)}; hire ${at['2026-01-01'].hireSoft.toFixed(2)} → ${at['2026-12-31'].hireSoft.toFixed(2)}; youth U ${at['2026-01-01'].youthU.toFixed(1)} → ${at['2026-12-31'].youthU.toFixed(1)}%`,
    at['2026-12-31'].youthSoft < at['2026-01-01'].youthSoft - 0.03 && at['2026-12-31'].hireSoft < at['2026-01-01'].hireSoft && at['2026-12-31'].youthU > at['2026-01-01'].youthU);
  R('W.aggregateU2026', `${(at['2026-12-31'].U - U0).toFixed(2)} pp`, at['2026-12-31'].U - U0);

  // The four date checks bind on the MEDIAN first day over the seeds (never reached = +∞, which is out of band). The two
  // 'info' registry entries are AI 2027 scenario projections (research/01 row 37): reported, never out of band.
  const recs = [timingOf(c), ...seeds.filter((x) => x !== CAL_SEED).map((x) => timingRec(x))];
  const dateCheck = (id: string, key: 'hire10' | 'remote25' | 'u12' | 'accept85') => {
    const days = recs.map((r) => r[key] ?? Infinity);
    const med = medianOf(days);
    const fd = (d: number) => (Number.isFinite(d) ? fmt(Math.round(d)) : 'never');
    const detail = `median over ${recs.length} seed(s) ${fd(med)} (p10 ${fd(quantOf(days, 0.1))}, p90 ${fd(quantOf(days, 0.9))}); seed ${CAL_SEED} ${fmt(recs[0][key] ?? undefined)}`;
    R(id, detail, Number.isFinite(med) ? decimalYearOf(START_DATE, med) : NaN);
  };
  dateCheck('W.hireRate10', 'hire10');
  R('W.aiFriend2027', pct(at['2027-07-01'].friend), at['2027-07-01'].friend);
  dateCheck('W.remote25', 'remote25');
  dateCheck('W.unemployment12m', 'u12');
  dateCheck('W.govAccept85', 'accept85');
  if (recs.length > 1) {
    const f = recs.map((r) => r.f11_2027);
    const g = recs.map((r) => r.a2c);
    console.log(`  INFO F4 spread over ${recs.length} seeds (rows read seed ${CAL_SEED}): F11 2027 revenue median $${medianOf(f).toFixed(1)}B (p10 $${quantOf(f, 0.1).toFixed(1)}B, p90 $${quantOf(f, 0.9).toFixed(1)}B); A2c tokens a day over 2026 median ×${medianOf(g).toFixed(1)} (p10 ×${quantOf(g, 0.1).toFixed(1)}, p90 ×${quantOf(g, 0.9).toFixed(1)})`);
  }

  // A2a: hours of AI use and hours saved per hour of use from the worker surveys (research/22 §1; Bick, Blandin & Deming
  // RPS on FRED).
  {
    const u0 = at['2025-07-02'].use;
    const u26 = at['2026-07-01'].use;
    const uEnd = at['2027-12-31']?.use;
    R('A2a.hoursOfUse2026', pct(u26.hours), u26.hours);
    R('A2a.savedPerHour', u0.savedPerHour.toFixed(3), u0.savedPerHour);
    R('A2a.workers2026', pct(u26.workers), u26.workers);
    R('A2a.hoursSaved2026', pct(u26.saved), u26.saved);
    const trail = `${u0.savedPerHour.toFixed(3)} → ${u26.savedPerHour.toFixed(3)} → ${uEnd?.savedPerHour.toFixed(3) ?? 'n/a'}`;
    R('A2a.agencyDirection', trail, u26.savedPerHour > u0.savedPerHour);
    if (uEnd !== undefined) R('A2a.agencyRise', trail, uEnd.savedPerHour - u26.savedPerHour);
    R('A2a.firmsBelowWorkers', `firms ${pct(at['2026-11-01'].firm)} vs workers ${pct(u26.workers)}`, u26.workers - at['2026-11-01'].firm);
    console.log(`  INFO A2a US hours of use (share of work-hours): ${MARKS.filter((m) => at[m]).map((m) => `${m} ${pct(at[m].use.hours)} (workers ${pct(at[m].use.workers)}, saved/h ${at[m].use.savedPerHour.toFixed(2)})`).join('; ')}`);
  }
  // A2b: consumer chat from measured anchors (research/22 §2).
  {
    const c0 = at['2025-07-02'].cons;
    const c26 = at['2026-07-01'].cons;
    R('A2b.usReach', `US ${pct(c26.regions.US.reach)}, ROW ${pct(c26.regions.ROW.reach)}`, c26.regions.US.reach);
    R('A2b.rowBelowUs', `US ${pct(c26.regions.US.reach)}, ROW ${pct(c26.regions.ROW.reach)}`, c26.regions.ROW.reach < c26.regions.US.reach);
    const ps = (x: typeof c0) => x.subs / Math.max(1, x.users);
    R('A2b.paidShare2026', `${pct(ps(c0))} → ${pct(ps(c26))}`, [ps(c0), ps(c26)]);
    console.log(`  INFO A2b consumer (all providers, US + ROW): ${MARKS.filter((m) => at[m]).map((m) => `${m} users ${(at[m].cons.users / 1e6).toFixed(0)}M, subs ${(at[m].cons.subs / 1e6).toFixed(0)}M (${pct(ps(at[m].cons))}), spend $${at[m].cons.spend.toFixed(1)}B, player users ${((at[m].cons.regions.US.playerUsers + at[m].cons.regions.ROW.playerUsers) / 1e6).toFixed(0)}M`).join('; ')}`);
  }
  // A2c: who pays for work use, and the agent-work term (research/22 §3–7).
  {
    const b = (m: string) => at[m].bill;
    const exCN = (m: string) => b(m).world.seats - b(m).regions.CN.seats;
    const tok = (m: string) => b(m).world.tokAdopted + b(m).world.tokSeated + b(m).world.tokAgent + b(m).consumerTokens;
    const kOf = (m: string) => b(m).world.agent / Math.max(1, b(m).world.supervising);
    const seats = MARKS.slice(0, 6).map((m) => `${m} ${(exCN(m) / 1e6).toFixed(0)}M`).join(', ');
    R('A2c.seats.jan2026', seats, exCN('2026-01-01'));
    R('A2c.seats.jul2026', seats, exCN('2026-07-01'));
    const g26 = tok('2026-12-31') / tok('2026-01-01');
    const kk = ['2026-01-01', '2026-07-01', '2026-12-31'].map(kOf);
    R('A2c.tokenGrowth2026', `×${g26.toFixed(1)} (${(tok('2026-01-01') / 1e12).toFixed(0)}T → ${(tok('2026-12-31') / 1e12).toFixed(0)}T a day)`, g26);
    R('A2c.agentHoursRising', `agent-hours per supervising hour ${kk.map((k) => k.toFixed(2)).join(' → ')}`, kk[2] > kk[1] && kk[1] > kk[0]);
    // CAL3-I: usage intensity per adopter = work tokens per hour of use. Reported, not fitted.
    const perUseH = (m: string) => {
      const w = b(m).world;
      return ((w.tokAdopted + w.tokSeated + w.tokAgent) * 365) / Math.max(1, w.adopted + w.seated + w.unseated);
    };
    console.log(`  INFO A2c intensity: work tokens per hour of use ${['2025-07-02', '2026-01-01', '2026-07-01', '2026-12-31'].map((m) => `${m} ${(perUseH(m) / 1e3).toFixed(0)}k`).join(', ')}; Jul 2025 → Jul 2026 ×${(perUseH('2026-07-01') / perUseH('2025-07-02')).toFixed(1)}`);
    const nonChina = c.annual[2026] + (c.rivalAnnual[2026] ?? 0);
    console.log(`  INFO A2c CY2026 non-China frontier-lab revenue (player actual + closed rivals' demand-side market revenue): $${nonChina.toFixed(1)}B, leader (player) $${c.annual[2026].toFixed(1)}B =${pct(c.annual[2026] / nonChina)}`);
  }
  // Headlines on the reference path: distinct ones that fire over the full run, one-shot ones once.
  {
    const fired = new Set(c.s.headlines.map((h) => h.id.split(':')[0]));
    const once = HEADLINES.filter((h) => h.cooldownDays === undefined).every((h) => c.s.headlines.filter((x) => x.id === h.id).length <= 1);
    R('HEADLINES.distinct', `${fired.size}: ${[...fired].join(' ')}`, fired.size);
    R('HEADLINES.oneShotOnce', 'one-shot headlines fire at most once', once);
  }

  // ───────────── The world at Nov 2026 (W4) ─────────────
  {
    const a = at['2026-11-01'];
    R('W4.aggregateU', `${(a.U - U0).toFixed(2)} pp`, a.U - U0);
    R('W4.youthExposed', `${((a.youthX - 1) * 100).toFixed(1)}% (ratio ${a.youthX.toFixed(3)})`, a.youthX - 1);
    // CAL-X: the anchor is BTOS over Dec 2025–May 2026; read at the Jul 2026 mark (the first after the window).
    const fJul = at['2026-07-01'].firm;
    R('W4.firmAdoption', pct(fJul), fJul);
    console.log(`  INFO W4 firm adoption: ${['2026-01-01', '2026-07-01', '2026-11-01'].map((m) => `${m} ${pct(at[m].firm)}`).join(', ')}`);
    console.log(`  INFO W4 reality Nov 2026: US hours of use ${pct(a.use.hours)}, workers using AI ${pct(a.use.workers)}, saved per hour of use ${a.use.savedPerHour.toFixed(3)}`);
  }
  return rows;
}
