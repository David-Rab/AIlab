// WS5 acceptance: outside world and revenue (V2-SPEC §7.3, F11 with WS3; research/16 §6–7). Owner: WS5.
//
// Reference play = real RefBot games on the integrated engine (WS1 models and releases, WS3 compute and finance, WS4
// actors; endings skipped so the world keeps running past ASI). The worldfx-refplay.ts probe is kept only for W2, a
// controlled experiment with capabilities frozen at Agent-1 level. Date targets use ±3 months (R16 §7 test 1), on the
// median first day over the 20 classic runs of CAL_SEEDS (model v3 F4; calseeds.ts).
// The games go through the simulation cache (simcache.ts): a cached trace keeps what the checks read (the classic run
// keeps its whole final state). `--smoke` (test:quick) skips the long post-2028 runs (W3, the SEZ path) and the
// informational authors2026 run; every check that does run is binding.
import { dayOfDate, decimalYear } from '../../src/engine/v2/core/time';
import { makeCtx, tick } from '../../src/engine/v2/core/loop';
import { ACTIONS } from '../../src/engine/v2/core/registry';
import { domainScaleGs, gOfLevel } from '../../src/engine/v2/models/capability';
import { LEVEL_KNOTS } from '../../src/data/v2/calibration';
import { LEVERAGE_THRESHOLDS, leverage, leverageTier } from '../../src/engine/v2/worldfx/control';
import { HEADLINES } from '../../src/engine/v2/worldfx/headlines';
import { automationTfp } from '../../src/engine/v2/worldfx/macro';
import { POLICY_FLAGS } from '../../src/engine/v2/worldfx/policy';
import { consumerUse, firmAdoption, remoteWorkAutomation, workBilling, workUse, youthExposedEmployment } from '../../src/engine/v2/worldfx/readouts';
import { worldMix } from '../../src/engine/v2/worldfx/mix';
import { labMarketRevenue, revenueOf } from '../../src/engine/v2/worldfx/revenue';
import type { GameStateV2, SetupV2, TickOptions } from '../../src/engine/v2/types';
import { refBot } from '../../src/engine/v2/bots/ref';
import { newGame, defaultSetupV2 } from '../../src/engine/v2/core/init';
import { resolve } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { engine } from '../../src/engine/v2/index';
import { WORLD_TECHS } from '../../src/data/v2/techs';
import { internalVersion } from '../../src/engine/v2/models/labs';
import { sectorCertDay } from '../../src/engine/v2/models/products';
import { techBlocker } from '../../src/engine/v2/worldfx/techtree';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deserialize } from '../../src/engine/v2/core/save';
import { fileURLToPath } from 'node:url';
import { FIXTURE_DIR, SMOKE, check, finish, smokeCheck, validateJson } from './lib';
import { cached, pick, prefill } from './simcache';
import { CAL_SEED, CAL_SEEDS, medianOf, quantOf } from './calseeds';
import { refGame, refPlayProbe } from './worldfx-refplay';

const START = '2025-07-01';
const D = (iso: string) => dayOfDate(START, iso);
const fmt = (day: number | undefined) => (day === undefined ? 'never' : new Date(Date.parse(START) + day * 864e5).toISOString().slice(0, 10));
const within = (day: number | undefined, iso: string, tol = 92) => day !== undefined && Math.abs(day - D(iso)) <= tol;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

interface Trace {
  s: GameStateV2;
  annual: Record<number, number>;
  U: number[];
  firstHire10?: number;
  firstRemote25?: number;
  firstU12?: number;
  firstAccept85?: number;
  /** A2c: calendar-year revenue of the non-China closed providers (rivals' demand-side market revenue; the player's in
   *  `annual`). */
  rivalAnnual: Record<number, number>;
  at: Record<string, { dow: number; U: number; youthSoft: number; youthU: number; friend: number; hireSoft: number; youthX: number; firm: number; rev: number; use: ReturnType<typeof workUse>; cons: ReturnType<typeof consumerUse>; bill: ReturnType<typeof workBilling> }>;
}

const FILES = [fileURLToPath(import.meta.url), fileURLToPath(new URL('./worldfx-refplay.ts', import.meta.url))];
const MARKS = ['2025-07-02', '2025-07-31', '2026-01-01', '2026-07-01', '2026-11-01', '2026-12-31', '2027-07-01', '2027-10-01', '2027-12-31'];

/** One day of real reference play: RefBot decides pending events, acts, then the engine ticks (endings skipped). */
function refDay(s: GameStateV2, opts: { noSez?: boolean } = {}) {
  for (const p of [...s.events.pending]) {
    const c = refBot.decide(s, p);
    if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
  }
  refBot.act(s, engine);
  tick(s, { skip: ['endings'] });
  if (opts.noSez) delete s.flags[POLICY_FLAGS.sez]; // W3 counterfactual: SEZs never open
}
const refGameV2 = (over: Partial<SetupV2> = {}) => newGame(defaultSetupV2({ seed: 2027, world: 'ai2027', alignment: 'medium', baseline: 'classic', tutorial: false, ...over }));

function run(over: Partial<SetupV2>, days: number, opts: { noSez?: boolean } = {}): Trace {
  const s = refGameV2(over);
  const tr: Trace = { s, annual: {}, rivalAnnual: {}, U: [], at: {} };
  const marks = new Map(MARKS.map((m) => [D(m), m]));
  while (s.time.day < days) {
    refDay(s, opts);
    const d = s.time.day;
    const W = s.world;
    const rev = s.player.deployments.reduce((a, x) => a + (x.revenueRate ?? 0), 0);
    const y = Math.floor(decimalYear(s));
    tr.annual[y] = (tr.annual[y] ?? 0) + rev / 365;
    tr.U[d] = W.unemployment.US;
    if (tr.firstHire10 === undefined && W.sectors.US.SOFT.hireRate <= 0.1) tr.firstHire10 = d;
    if (tr.firstRemote25 === undefined && remoteWorkAutomation(s) >= 0.25) tr.firstRemote25 = d;
    if (tr.firstU12 === undefined && d >= 365 && W.unemployment.US - tr.U[d - 365] >= 1) tr.firstU12 = d;
    if (tr.firstAccept85 === undefined && W.control.GOV.accept >= 0.85) tr.firstAccept85 = d;
    if (d % 7 === 0 && y >= 2025 && y <= 2027) {
      let rv = 0;
      for (const p of worldMix(s).providers) if (p.key !== 'player' && p.key !== 'china' && !p.open) rv += labMarketRevenue(s, p.key);
      tr.rivalAnnual[y] = (tr.rivalAnnual[y] ?? 0) + (rv * 7) / 365;
    }
    const m = marks.get(d);
    if (m) {
      tr.at[m] = {
        dow: W.dow, U: W.unemployment.US, youthSoft: W.fx.youthRel.SOFT, youthU: W.youthUnemployment, friend: W.friendShare,
        hireSoft: W.sectors.US.SOFT.hireRate, youthX: youthExposedEmployment(s), firm: firmAdoption(s), rev: s.player.finance.revenueRun,
        use: workUse(s, 'US'), cons: consumerUse(s), bill: workBilling(s),
      };
    }
  }
  return tr;
}

/** run() through the simulation cache. `picks` = the final-state paths the checks read (undefined: the whole state);
 *  `jsonErrs` = validateJson of the live final state. */
interface CTrace extends Trace { jsonErrs: string[] }
function runC(over: Partial<SetupV2>, days: number, opts: { noSez?: boolean } = {}, picks?: string[]): CTrace {
  return cached('worldfx-run', { over, days, opts, picks: picks ?? 'all' }, FILES, () => {
    const { U: _U, ...tr } = run(over, days, opts);
    return { ...tr, U: [], jsonErrs: validateJson(tr.s), s: picks ? pick(tr.s, picks) : tr.s };
  });
}

/** W2 (cached): automation TFP gain over a decade, Normal Technology with capabilities frozen at Agent-1 level. */
function w2Rec(): number {
  return cached('worldfx-w2', { econ: 'normal', days: 3651 }, FILES, () => {
    const s = refGame({ econ: 'normal' });
    // Agent-1 level: the milestone's level knot on the display scale (model v3 F3: was v2's pm threshold).
    const gA1 = gOfLevel(s.hidden.timeline, LEVEL_KNOTS[1]);
    const probe = refPlayProbe(s, { freezeAt: gA1, publicLag: 0 });
    const opts: TickOptions = { extraSystems: [probe], skip: ['production', 'continual', 'endings'] };
    tick(s, opts);
    const tfp0 = automationTfp(s);
    while (s.time.day < 3651) tick(s, opts);
    return automationTfp(s) - tfp0;
  });
}
/** SEZ path (cached): SEZs open Jan 2028; robots, W17 and the max growth rate to 2031. */
function sezRec() {
  return cached('worldfx-sez', { from: '2028-01-01', to: '2031-01-01' }, FILES, () => {
    const s = refGameV2();
    while (s.time.day < D('2028-01-01')) refDay(s, { noSez: true });
    let maxG = 0;
    let d1M: number | undefined;
    while (s.time.day < D('2031-01-01')) {
      s.flags[POLICY_FLAGS.sez] = true; // SEZs open in Jan 2028 and stay open
      refDay(s);
      maxG = Math.max(maxG, s.world.macro.US.g);
      if (d1M === undefined && (s.world.robots.prodPerYear + s.world.fx.humanoidProd) / 12 >= 1e6) d1M = s.time.day;
    }
    return { s: pick(s, ['world.robots.sezOpen', 'world.techs.W17']), maxG, d1M };
  });
}
const W3_PICKS = ['world.fx.autoLevel', 'world.techs.W17', 'world.macro.US.g'];
/** Model v3 F4: the classic run's timing reads on one more seed of CAL_SEEDS (cached): the four date checks (first day of
 *  each), F11 2027 revenue and A2c's tokens-a-day growth over 2026. Seed CAL_SEED's come from the main classic run. */
interface TimingRec { hire10: number | null; remote25: number | null; u12: number | null; accept85: number | null; f11_2027: number; a2c: number }
const tokOf = (tr: Pick<Trace, 'at'>, m: string) => { const b = tr.at[m].bill; return b.world.tokAdopted + b.world.tokSeated + b.world.tokAgent + b.consumerTokens; };
const timingOf = (tr: Pick<Trace, 'firstHire10' | 'firstRemote25' | 'firstU12' | 'firstAccept85' | 'annual' | 'at'>): TimingRec => ({
  hire10: tr.firstHire10 ?? null, remote25: tr.firstRemote25 ?? null, u12: tr.firstU12 ?? null, accept85: tr.firstAccept85 ?? null,
  f11_2027: tr.annual[2027] ?? 0, a2c: tokOf(tr, '2026-12-31') / tokOf(tr, '2026-01-01'),
});
function timingRec(seed: number): TimingRec {
  return cached('worldfx-timing', { seed, days: D('2028-04-01') }, FILES, () => timingOf(run({ baseline: 'classic', econ: 'ai2027', seed }, D('2028-04-01'))));
}
const TIMING_SEEDS = SMOKE ? [] : CAL_SEEDS.filter((x) => x !== CAL_SEED);
// The runner's --prefill shards: every cached run of this mode, in the order the checks ask for them.
prefill([
  () => runC({ baseline: 'classic', econ: 'ai2027' }, D('2028-04-01')),
  ...TIMING_SEEDS.map((x) => () => timingRec(x)),
  () => runC({ baseline: 'reality', econ: 'ai2027', world: 'ai2027' }, D('2026-11-02'), {}, []),
  ...(SMOKE ? [] : [() => runC({ baseline: 'reality', econ: 'ai2027', world: 'authors2026' }, D('2026-11-02'), {}, [])]),
  () => w2Rec(),
  ...(SMOKE ? [] : (['ai2027', 'gate'] as const).map((econ) => () => runC({ econ }, D('2031-01-01'), { noSez: true }, W3_PICKS))),
  ...(SMOKE ? [] : [() => sezRec()]),
]);

// ───────────── 1. Classic baseline, ai2027 econ, reference play (§7.3 table, F11) ─────────────
const c = runC({ baseline: 'classic', econ: 'ai2027' }, D('2028-04-01'));
const at = c.at;
const U0 = 4.3;
console.log('Classic / ai2027 econ / reference play');
check(Math.abs(refGame().player.finance.revenueRun - 12) < 1e-9, 'F11 revenue run-rate at start = $12B', '');
check(at['2025-07-31'].rev >= 9 && at['2025-07-31'].rev <= 16.5, 'F11 Jul 2025 run-rate ≈ $12B (capacity-bound, ±35%)', `$${at['2025-07-31'].rev.toFixed(1)}B`);
// FINREF: AI 2027's $45B is a plot point; the measured 2026 leader (Anthropic) earns ≈ $53–56B (research/22 §4 [P]): both ±20%.
check(c.annual[2026] >= 36 && c.annual[2026] <= 67, 'F7/F11 2026 revenue $45B (AI 2027) to $53–56B (Anthropic CY2026, research/22 §4), ±20%', `$${c.annual[2026].toFixed(1)}B`);
check(c.annual[2027] >= 98 && c.annual[2027] <= 182, 'F11 2027 revenue ~$140B (±30%)', `$${c.annual[2027].toFixed(1)}B`);
const eq26 = at['2026-12-31'].dow / at['2026-01-01'].dow - 1;
check(eq26 >= 0.2 && eq26 <= 0.4, 'Late 2026: equity +30% in 2026 (±10 pp)', pct(eq26));
check(at['2026-12-31'].youthSoft < at['2026-01-01'].youthSoft - 0.03 && at['2026-12-31'].hireSoft < at['2026-01-01'].hireSoft && at['2026-12-31'].youthU > at['2026-01-01'].youthU,
  'Late 2026: SOFT youth employment falling, youth unemployment rising',
  `SOFT 22–25 ${at['2026-01-01'].youthSoft.toFixed(3)} → ${at['2026-12-31'].youthSoft.toFixed(3)}; hire ${at['2026-01-01'].hireSoft.toFixed(2)} → ${at['2026-12-31'].hireSoft.toFixed(2)}; youth U ${at['2026-01-01'].youthU.toFixed(1)} → ${at['2026-12-31'].youthU.toFixed(1)}%`);
check(at['2026-12-31'].U - U0 < 0.3, 'Late 2026: aggregate U < +0.3 pp', `${(at['2026-12-31'].U - U0).toFixed(2)} pp`);
// Model v3 F4: the four date checks bind on the MEDIAN first day over CAL_SEEDS (20 classic runs; never reached = +∞):
// on one seed they moved in and out of their ±3-month windows (p10–p90 spans 90–170 d, as wide as the windows); seed
// 2027's date and the spread are printed with them. Under --smoke (seed 2027 only) they print SMOKE.
{
  const recs = [timingOf(c), ...TIMING_SEEDS.map((x) => timingRec(x))];
  const dateCheck = (key: 'hire10' | 'remote25' | 'u12' | 'accept85', iso: string, label: string) => {
    const days = recs.map((r) => r[key] ?? Infinity);
    const med = medianOf(days);
    const inWin = days.filter((d) => within(d, iso)).length;
    const fd = (d: number) => (Number.isFinite(d) ? fmt(Math.round(d)) : 'never');
    const detail = `median over ${recs.length} seed(s) ${fd(med)} (p10 ${fd(quantOf(days, 0.1))}, p90 ${fd(quantOf(days, 0.9))}; ${inWin}/${recs.length} in the window); seed ${CAL_SEED} ${fmt(recs[0][key] ?? undefined)}`;
    if (SMOKE) smokeCheck(within(med, iso), label, detail, '(seed 2027 only)');
    else check(within(med, iso), label, detail);
  };
  dateCheck('hire10', '2027-07-01', 'Jul 2027 (±3 mo): HireRate_SOFT ≤ 10%');
  check(at['2027-07-01'].friend >= 0.07 && at['2027-07-01'].friend <= 0.13, 'Jul 2027: AI-friend share 10% (±3)', pct(at['2027-07-01'].friend));
  dateCheck('remote25', '2027-10-01', 'Oct 2027 (±3 mo): 25% of remote-work jobs done by AI');
  dateCheck('u12', '2027-10-01', 'Oct 2027 (±3 mo): U +1 pp over 12 months');
  dateCheck('accept85', '2027-12-15', 'Dec 2027 (±3 mo): GOV T1 Accept ≥ 0.85');
  if (recs.length > 1) {
    const f = recs.map((r) => r.f11_2027);
    const g = recs.map((r) => r.a2c);
    console.log(`INFO  F4 spread over ${recs.length} seeds (the checks above and below read seed ${CAL_SEED}): F11 2027 revenue median $${medianOf(f).toFixed(1)}B (p10 $${quantOf(f, 0.1).toFixed(1)}B, p90 $${quantOf(f, 0.9).toFixed(1)}B; floor $98B); A2c tokens a day over 2026 median ×${medianOf(g).toFixed(1)} (p10 ×${quantOf(g, 0.1).toFixed(1)}, p90 ×${quantOf(g, 0.9).toFixed(1)}; band ×4.6–20)`);
  }
}
// A2a: hours of AI use and hours saved per hour of use from the worker surveys (research/22 §1; Bick, Blandin & Deming
// RPS on FRED): 4.1% of US work-hours assisted (Q3 2024) → 5.7% (Q3 2025) → 6.3% (Q2 2026); 39–41% of workers; 2.2% of
// hours saved, 0.35 per hour of use.
{
  const u0 = at['2025-07-02'].use;
  const u26 = at['2026-07-01'].use;
  const uEnd = at['2027-12-31'].use;
  check(u26.hours >= 0.05 && u26.hours <= 0.065, 'A2a mid-2026: US hours of AI use ≈ 6% of work-hours (RPS 6.3% Q2 2026; 5–6.5%)', pct(u26.hours));
  check(u0.savedPerHour >= 0.3 && u0.savedPerHour <= 0.4, 'A2a start: an hour of AI use saves ≈ 0.35 hours of work (RPS 2.2 / 6.3; 0.3–0.4)', u0.savedPerHour.toFixed(3));
  check(u26.workers >= 0.35 && u26.workers <= 0.45, 'A2a 2026: ≈ 40% of US workers use AI at work (RPS 39–41%; 35–45%)', pct(u26.workers));
  check(u26.saved >= 0.017 && u26.saved <= 0.027, 'A2a mid-2026: hours saved ≈ 2.2% of US work-hours (RPS)', pct(u26.saved));
  check(uEnd.savedPerHour > u26.savedPerHour + 0.05 && u26.savedPerHour > u0.savedPerHour, 'A2a: hours saved per hour of use rise with agency (substituted share α·A/U grows)',
    `${u0.savedPerHour.toFixed(3)} → ${u26.savedPerHour.toFixed(3)} → ${uEnd.savedPerHour.toFixed(3)}`);
  check(at['2026-11-01'].firm < u26.workers - 0.1, 'A2a: firm adoption (BTOS analogue, firm-weighted) stays a separate, lower quantity than worker use', `firms ${pct(at['2026-11-01'].firm)} vs workers ${pct(u26.workers)}`);
  console.log(`INFO  A2a US hours of use (share of work-hours; RPS 4.1% Q3 2024, 5.7% Q3 2025, 6.3% Q2 2026, 5.3% Q3 2026): ${MARKS.map((m) => `${m} ${pct(at[m].use.hours)} (workers ${pct(at[m].use.workers)}, saved/h ${at[m].use.savedPerHour.toFixed(2)})`).join('; ')}`);
}
// A2b: consumer chat from measured anchors (research/22 §2): weekly reach (US ≈ 50% of adults use genAI outside work,
// Nov 2025), the market's paid share (5–6%), subscribers × price as its own revenue line. Reported, not fitted.
{
  const c0 = at['2025-07-02'].cons;
  const c26 = at['2026-07-01'].cons;
  check(c26.regions.US.reach >= 0.45 && c26.regions.US.reach <= 0.65 && c26.regions.ROW.reach < c26.regions.US.reach,
    'A2b 2026: US weekly AI chat reach ≈ 50–60% of adults (RPS ≈ 50% non-work use Nov 2025), ROW below the US', `US ${pct(c26.regions.US.reach)}, ROW ${pct(c26.regions.ROW.reach)}`);
  const ps = (x: typeof c0) => x.subs / Math.max(1, x.users);
  check(ps(c0) >= 0.04 && ps(c0) <= 0.09 && ps(c26) >= 0.04 && ps(c26) <= 0.09, 'A2b: the market\'s paid share stays near the measured 5–6% (4–9%) through 2026', `${pct(ps(c0))} → ${pct(ps(c26))}`);
  console.log(`INFO  A2b consumer (all providers, US + ROW): ${MARKS.map((m) => `${m} users ${(at[m].cons.users / 1e6).toFixed(0)}M, subs ${(at[m].cons.subs / 1e6).toFixed(0)}M (${pct(ps(at[m].cons))}), spend $${at[m].cons.spend.toFixed(1)}B, player users ${((at[m].cons.regions.US.playerUsers + at[m].cons.regions.ROW.playerUsers) / 1e6).toFixed(0)}M`).join('; ')}`);
}
// A2c: who pays for work use, and the agent-work term (research/22 §3–7). Reported, not fitted.
{
  const b = (m: string) => at[m].bill;
  const exCN = (m: string) => b(m).world.seats - b(m).regions.CN.seats;
  const tok = (m: string) => b(m).world.tokAdopted + b(m).world.tokSeated + b(m).world.tokAgent + b(m).consumerTokens;
  const kOf = (m: string) => b(m).world.agent / Math.max(1, b(m).world.supervising);
  check(exCN('2026-01-01') >= 20e6 && exCN('2026-01-01') <= 45e6 && exCN('2026-07-01') >= 35e6 && exCN('2026-07-01') <= 75e6,
    'A2c: paid enterprise seats outside China ≈ 30M in Jan 2026 and ≈ 50M by mid-2026 (R22 4e–4g: M365 Copilot 15M → 30M, ChatGPT > 7M, Gemini > 8M)',
    `${MARKS.slice(0, 6).map((m) => `${m} ${(exCN(m) / 1e6).toFixed(0)}M`).join(', ')}`);
  const g26 = tok('2026-12-31') / tok('2026-01-01');
  // Band ×4.6–×20 (M10, lead decision after MKT; was ×3–8, anchored on Google's first-party API alone). research/22 §3
  // and §7 [P] measure the growth of token volume over a year on three instruments: Google first-party API tokens 7B →
  // 32B a minute Q3 2025 → Q3 2026 (×4.6, row 3a); Google all surfaces 480T a month (May 2025) → > 1.3 quadrillion (Oct
  // 2025), "> 20× in a year" (row 3b); OpenAI enterprise reasoning tokens per organisation ×320 in the 12 months to
  // Nov 2025 (row 3c: per organisation and reasoning-only, an upper outlier, not a world total). The game's world total
  // (API + seats + agents + consumer, every provider) sits between the API-only and the all-surface measures.
  check(g26 >= 4.6 && g26 <= 20 && kOf('2026-12-31') > kOf('2026-07-01') && kOf('2026-07-01') > kOf('2026-01-01'),
    'A2c: tokens a day grow ×4.6–20 over 2026 (R22 3a–3b: Google first-party API ×4.6/yr, Google all surfaces ×20/yr), through agent-hours per supervising hour rising with horizon and coverage',
    `×${g26.toFixed(1)} (${(tok('2026-01-01') / 1e12).toFixed(0)}T → ${(tok('2026-12-31') / 1e12).toFixed(0)}T a day); agent-hours per supervising hour ${['2026-01-01', '2026-07-01', '2026-12-31'].map((m) => kOf(m).toFixed(2)).join(' → ')}`);
  const nonChina = c.annual[2026] + (c.rivalAnnual[2026] ?? 0);
  console.log(`INFO  A2c CY2026 non-China frontier-lab revenue (player actual + closed rivals' demand-side market revenue; R22 §4 $100–130B): $${nonChina.toFixed(1)}B, leader (player) $${c.annual[2026].toFixed(1)}B =${pct(c.annual[2026] / nonChina)}`);
  for (const m of ['2025-07-02', '2026-01-01', '2026-07-01', '2026-12-31']) {
    const w = b(m).world;
    console.log(`INFO  A2c ${m}: hours of use ${((w.adopted + w.seated + w.unseated) / 1e9).toFixed(0)}B/yr = adopted ${(w.adopted / 1e9).toFixed(0)}B (per hour) + seated ${(w.seated / 1e9).toFixed(0)}B (seat) + unseated ${(w.unseated / 1e9).toFixed(0)}B (unbilled); agent-hours ${(w.agent / 1e9).toFixed(1)}B; seats ${(w.seats / 1e6).toFixed(0)}M (player ${(b(m).playerSeats / 1e6).toFixed(0)}M); spend adopted $${w.spendAdopted.toFixed(1)}B, agents $${w.spendAgent.toFixed(1)}B, seats $${w.spendSeat.toFixed(1)}B; tokens/day ${(tok(m) / 1e12).toFixed(0)}T (agents ${(w.tokAgent / 1e12).toFixed(0)}T, consumer ${(b(m).consumerTokens / 1e12).toFixed(0)}T)`);
  }
}
check(c.jsonErrs.length === 0, 'world state stays plain JSON (classic run)', c.jsonErrs.slice(0, 3).join('; '));
const fired = new Set(c.s.headlines.map((h) => h.id.split(':')[0]));
const once = HEADLINES.filter((h) => h.cooldownDays === undefined).every((h) => c.s.headlines.filter((x) => x.id === h.id).length <= 1);
check(fired.size >= 10 && once, 'headlines: ≥10 distinct fire on the reference path; one-shot ones fire once', [...fired].join(' '));
check(c.s.player.deployments.filter((d) => d.channel !== 'internal').every((d) => d.revenueRate !== undefined && d.demandBound !== undefined && revenueOf(c.s, d.id) === d.revenueRate),
  'revenue writes revenueRate and demandBound on every external deployment');

// ───────────── 2. Reality baseline at Nov 2026 (W4) ─────────────
{
  const r = runC({ baseline: 'reality', econ: 'ai2027', world: 'ai2027' }, D('2026-11-02'), {}, []);
  const a = r.at['2026-11-01'];
  console.log('Reality baseline / ai2027 world');
  check(Math.abs(a.U - U0) <= 0.15, 'W4: aggregate unemployment effect ≈ 0 at Nov 2026', `${(a.U - U0).toFixed(2)} pp`);
  check(a.youthX >= 0.76 && a.youthX <= 0.86, 'W4: exposed 22–25-year-olds −19% vs counterfactual (±5 pp)', `${((a.youthX - 1) * 100).toFixed(1)}%`);
  check(a.firm >= 0.15 && a.firm <= 0.22, 'W4: firm adoption 17–20% (±2 pp)', pct(a.firm));
  console.log(`INFO  W4 reality Nov 2026: US hours of use ${pct(a.use.hours)} (RPS 5.3% Q3 2026), workers using AI ${pct(a.use.workers)}, saved per hour of use ${a.use.savedPerHour.toFixed(3)}`);
  // Informational: the slower authors2026 timeline (SC 2029.7) gives weaker 2026 effects.
  if (!SMOKE) {
  const b = runC({ baseline: 'reality', econ: 'ai2027', world: 'authors2026' }, D('2026-11-02'), {}, []).at['2026-11-01'];
  console.log(`INFO  W4 on authors2026 world: U ${(b.U - U0).toFixed(2)} pp, exposed 22–25 ${((b.youthX - 1) * 100).toFixed(1)}%, firm adoption ${pct(b.firm)}`);
  }
}

// ───────────── 3. W2: Normal Technology + Agent-1-level models → TFP +0.5–1% per decade ─────────────
{
  const dT = w2Rec();
  check(dT >= 0.005 && dT <= 0.01, 'W2: Normal Technology, Agent-1-level models: automation TFP +0.5–1% over a decade (Acemoglu band)', pct(dT));
}

// ───────────── 4. W3: cognitive-only automation ≤ 2.2× GDP without W17 ─────────────
for (const econ of SMOKE ? [] : (['ai2027', 'gate'] as const)) {
  const t = runC({ econ }, D('2031-01-01'), { noSez: true }, W3_PICKS);
  const X = Math.max(...(['US', 'CN', 'ROW'] as const).map((r) => t.s.world.fx.autoLevel[r]));
  check(t.s.world.techs.W17.discoveredDay === undefined && X <= 2.2, `W3 ${econ}: no SEZ → no W17, automation output factor ≤ 2.2`, `X ${X.toFixed(2)}, ASI-level models, g ${pct(t.s.world.macro.US.g)}`);
}

// ───────────── 5. SEZ path: robots, W17, explosive growth ─────────────
if (!SMOKE) {
  const { s, maxG, d1M } = sezRec();
  check(s.world.robots.sezOpen && d1M !== undefined && d1M <= D('2029-06-01'), 'SEZ (Jan 2028): ~1M robots/month within about a year (AI 2027: end-2028)', fmt(d1M));
  check(s.world.techs.W17.discoveredDay !== undefined && maxG >= 0.3, 'SEZ + W17: explosive growth (> 30%/yr) becomes possible', `W17 ${fmt(s.world.techs.W17.discoveredDay)}, max g ${pct(maxG)}`);
}

// ───────────── 6. Control / leverage and actions ─────────────
{
  const s = c.s;
  const lev = leverage(s, 'player');
  check(lev >= 0 && lev < 1 && ['none', 'entrenched', 'indispensable', 'decisive'].includes(leverageTier(s, lev)), 'leverage(player) in [0,1) with a tier', `${lev.toFixed(3)} (${leverageTier(s, lev)}; thresholds ${Object.values(LEVERAGE_THRESHOLDS).join('/')})`);
  const s2 = refGame();
  for (let i = 0; i < 30; i++) tick(s2, { skip: ['endings'] });
  const ctx = makeCtx(s2);
  const wa = ACTIONS.filter((a) => a.owner === 'WS5');
  check(wa.length === 3, 'three World actions registered', wa.map((a) => a.id).join(', '));
  const cash0 = s2.player.finance.cash;
  const tf = wa.find((a) => a.id === 'wfx.transitionFund')!;
  tf.apply(s2, ctx, { amount: 10 });
  for (let i = 0; i < 365; i++) tick(s2, { skip: ['endings'] });
  check(s2.player.policies.transitionFund === 10 && s2.player.finance.cash < cash0 + 1e3, 'transition fund: set and paid from cash');
  const sp = wa.find((a) => a.id === 'wfx.sectorProduct')!;
  const ok = sp.available(s2);
  sp.apply(s2, makeCtx(s2), { sector: 'LEGAL' });
  // J2 P1: engineers build the pack first (build queue); certification starts when it is built.
  const queued = s2.player.build.queue.some((it) => it.kind === 'sectorPack' && it.ref === 'LEGAL');
  let built = -1;
  for (let i = 0; i < 120 && built < 0; i++) {
    tick(s2, { skip: ['endings'] });
    if (sectorCertDay(s2, 'LEGAL') !== undefined) built = s2.time.day;
  }
  const host = s2.player.deployments.find((d) => d.packs.some((x) => x.sector === 'LEGAL'));
  check(ok === true && queued && !!host && built >= 0 && Math.abs((sectorCertDay(s2, 'LEGAL') ?? 0) - (built + 120)) <= 1, 'sector product: pack built by engineers, then focus added and certification in 120 days', `built day ${built}`);
  const ms = wa.find((a) => a.id === 'wfx.moonshot')!;
  // [M2 test fix] At day 30 the start model researches nothing (every tech is gated: W03 needs REASON 7), so the
  // action is unavailable there; use the day-900 fixture, where a beneficial non-risk tech is researchable.
  const s3 = deserialize(readFileSync(join(FIXTURE_DIR, 'day900.json'), 'utf8'));
  const iv = internalVersion(s3);
  const tech = WORLD_TECHS.find((x) => s3.world.techs[x.id]?.discoveredDay === undefined && x.effects.benefit && !x.risk && iv && techBlocker(s3, x, domainScaleGs(s3.hidden.timeline, iv)) === undefined)?.id ?? 'W03';
  const avail = ms.available(s3);
  const pv = ms.preview(s3, { tech, share: 0.05 });
  ms.apply(s3, makeCtx(s3), { tech, share: 0.05 });
  const prog0 = s3.world.techs[tech].prog;
  for (let i = 0; i < 60; i++) tick(s3, { skip: ['endings'] });
  const ts = s3.world.techs[tech];
  check(avail === true && (ts.playerProject?.computeShare ?? 0) > 0 && (ts.prog > prog0 || ts.discoveredDay !== undefined) && pv.costs.some((x) => x.currency === 'compute'),
    'moonshot: compute assigned, tech advances, preview costs compute', `${tech} ${prog0.toFixed(3)} → ${ts.prog.toFixed(3)}`);
}

finish('worldfx');
