// Calibration targets: milestones (moved from calib.ts, which the report replaces; design/TESTING.md §0).
//   T1  RefBot (stub finance: infinite cash; compute tracks refTotal) hits the golden milestone days
//       (lib.ts calGolden) within ±0.08 y (SC) and ±0.12 y after, ON THE MEDIAN over CAL_SEEDS (calseeds.ts; model v3 F4:
//       the dates are bimodal, one seed is not a calibration). The timeline worlds have no golden days yet, so T1
//       reports "no golden days yet" and only the preset's SEED game is played (it also gives the reads below).
//   G path  MODEL-V3 §13 frontier G path to 2026 within ±0.2 G of research/12 §0.2 (tl-central).
//   METR    V3.7 h50 doubling ≈ 4.2 months for the reference frontier 2025–26 (±1) (tl-central).
//   M       V3.7 research speed readout M at the start ≈ the preset's source (AI 2027 integrator M(p0), ± 0.1).
//   T2      AI research labour on RefBot's SC day within an order of magnitude of AI 2027.
//   R5      RefBot's build queue never delays a run by more than 3 days.
// Cost: one RefBot game per preset (tl-fast and tl-central to ASI, tl-slow to SC) ≈ 7k game-days ≈ 4–5 CPU-min cold; with
// golden days CAL_SEEDS × 3 games plus an integrated game per preset. Every game goes through simcache.
// Env: CALREPORT_SEEDS=n (first n of CAL_SEEDS for the T1 median, once golden days exist), CALREPORT_PRESETS=tl-central,…
// (default all three), V3_SD / V3_ASI (calibration experiments, part of every cache key).
import { fileURLToPath } from 'node:url';
import { ASI_EXTRA, V3_CAL } from '../../../src/data/v2/workTypes';
import { gOfBuild, h50Of } from '../../../src/engine/v2/models/capability';
import { bestPlayerVersion } from '../../../src/engine/v2/models/labs';
import { labSpeedRel } from '../../../src/engine/v2/production/production';
import { speedOfCopy, workContext } from '../../../src/engine/v2/departments/workfit';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { START_DATE, dateOfDay, dayOfDate, decimalYearOf } from '../../../src/engine/v2/core/time';
import type { GameStateV2, MilestoneIdx, WorldPresetId } from '../../../src/engine/v2/types';
import { refBot } from '../../../src/engine/v2/bots/ref';
import { resolve, tick } from '../../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../../src/engine/v2/core/registry';
import { engine } from '../../../src/engine/v2/index';
import { calGolden, calTol, refGame, runRef } from '../lib';
import { cached } from '../simcache';
import { CAL_SEED, CAL_SEEDS, medianOf, quantOf } from '../calseeds';
import { multiplierRef } from '../../../src/engine/v2/world/calibration';
import { REF_TPP } from '../../../src/data/v2/runDesign';
import { fOver } from '../../../src/engine/v2/models/effective';
import { CHECKPOINTS } from '../../../balance/scenarios';
import { rowOf, type Target } from './types';

export const area = 'milestones';

const ME = [fileURLToPath(import.meta.url)];
const NAMES = ['A0', 'A1', 'A2', 'SC', 'SAR', 'SIAR', 'ASI'] as const;
const SEED = CAL_SEED;
const golden = calGolden();
const ALL_PRESETS: WorldPresetId[] = ['tl-fast', 'tl-central', 'tl-slow'];
const MAX_DAYS = 365 * 16;
const yearOf = (d: number) => Math.round(decimalYearOf(START_DATE, d) * 1000) / 1000;
const lastIdx = (p: WorldPresetId): MilestoneIdx => (p === 'tl-slow' ? 3 : 6);
const hasGolden = (p: WorldPresetId) => Object.keys(golden.presets[p].days).length > 0;
const sgn = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(3);
type MsDays = Partial<Record<MilestoneIdx, number>>;

/** research/12 §0.2 frontier anchors (best public model, G = log₁₀ effective compute), fitted for a reference base at 50
 *  tokens per parameter; since A6b the reference trains at REF_TPP (400, inference-aware), so the anchors move by the
 *  overtraining factor between the two (log₁₀ f_over(400) − log₁₀ f_over(50) = −0.31 OOM), the lead's decision (no new term).
 *  The anchors live in balance/scenarios.ts (H5.gpath.*, the one home of the values), each at its own date. */
const OVER_DG = Math.log10(fOver(REF_TPP) / fOver(50));
/** The game day whose decimal year (core/time.ts decimalYearOf) is nearest `y`. */
function dayOfYear(y: number): number {
  const d0 = Math.round((y - decimalYearOf(START_DATE, 0)) * 365.25);
  let best = d0;
  for (let d = d0 - 3; d <= d0 + 3; d++) if (Math.abs(decimalYearOf(START_DATE, d) - y) < Math.abs(decimalYearOf(START_DATE, best) - y)) best = d;
  return best;
}
const G_ANCHORS: [string, number][] = CHECKPOINTS
  .filter((c) => c.id.startsWith('H5.gpath.') && c.unit === 'G' && c.value !== undefined && c.date !== undefined)
  .map((c) => [dateOfDay(START_DATE, dayOfYear(c.date!)).toISOString().slice(0, 10), c.value! + OVER_DG]);
if (G_ANCHORS.length === 0) throw new Error('calreport/milestones: no H5.gpath.* anchors in balance/scenarios.ts');
const G_PATH_FROM = dayOfDate(START_DATE, '2025-08-01');
const G_PATH_TO = dayOfDate(START_DATE, '2026-11-30');

/** Calibration overrides that change every run (part of every cache key). */
const ENV = { V3_SD: process.env.V3_SD ?? null, V3_ASI: process.env.V3_ASI ?? null };
// V3_SD=1.5 sets AIFM's AI taste at the automated coder (sd_SC); V3_ASI=1.3 the global ASI gap (AIFM ASI 12–15 SD).
if (process.env.V3_SD) for (const p of ALL_PRESETS) V3_CAL[p].sdSC = Number(process.env.V3_SD);
if (process.env.V3_ASI) ASI_EXTRA.gaps = Number(process.env.V3_ASI);

function runT1(preset: WorldPresetId, seed = SEED, observe?: (s: GameStateV2) => void): GameStateV2 {
  const s = refGame(defaultSetupV2({ world: preset, alignment: 'medium', seed }));
  const stopAt = lastIdx(preset);
  return runRef(s, MAX_DAYS, (x) => {
    observe?.(x);
    return x.player.milestoneDays[stopAt] !== undefined;
  });
}

/** R5 build queue: the days each run waited for its setup beyond the first tick. Records the worst per run id. */
const buildDelays = (worst: Map<string, number>) => (s: GameStateV2) => {
  for (const r of s.player.models.runs) {
    if (r.setupId === undefined || r.startDay < 0) continue;
    const wait = (r.readyDay ?? s.time.day) - r.startDay - 1;
    worst.set(r.id, Math.max(worst.get(r.id) ?? 0, wait));
  }
};

/** T1 run record for a preset (cached): milestone days, R5 waits, the G path, start M and METR reads, T2. */
function t1Rec(preset: WorldPresetId) {
  const cal = { gSC: V3_CAL[preset].gSC, dBM: V3_CAL[preset].dBM };
  return cached('calreport-t1', { preset, cal, sdSC: V3_CAL[preset].sdSC, seed: SEED, stopAt: lastIdx(preset), maxDays: MAX_DAYS, env: ENV }, ME, () => {
    const waits = new Map<string, number>();
    const watch = buildDelays(waits);
    let start: { M: number; rs: number; src: number } | undefined;
    let h0: number | undefined;
    let h1: { day: number; h: number } | undefined;
    const d2027 = dayOfDate(START_DATE, '2027-01-01');
    // MODEL-V3 §13: RefBot's best model is a staircase (a base every 9 months), so the G-path check reads the
    // least-squares line through its daily G from Aug 2025 to Nov 2026 at each anchor date.
    const gPath: { day: number; g: number }[] = [];
    // T2: the AI research labour on the first day RefBot has its SC (read off this game, no extra game).
    let t2: { day: number; fte: number; copies: number; h100e: number; speed: number } | undefined;
    const s = runT1(preset, SEED, (x) => {
      watch(x);
      if (!t2 && x.player.milestoneDays[3] !== undefined) {
        const wc = workContext(x);
        t2 = { day: x.time.day, fte: wc.slots.EXP.aiFte + wc.slots.IDEAS.aiFte, copies: wc.slots.EXP.copies + wc.slots.IDEAS.copies, h100e: wc.slots.EXP.h100e + wc.slots.IDEAS.h100e, speed: speedOfCopy() };
      }
      if (x.time.day === 1) start = { M: x.player.research.last?.x?.mExp ?? 0, rs: labSpeedRel(x), src: multiplierRef(x.hidden.timeline, x.hidden.timeline.p0) };
      const bv = bestPlayerVersion(x);
      if (bv && x.time.day === 0) h0 = h50Of(x.hidden.timeline, bv);
      if (bv && x.time.day === d2027) h1 = { day: x.time.day, h: h50Of(x.hidden.timeline, bv) };
      if (bv?.build && x.time.day >= G_PATH_FROM && x.time.day <= G_PATH_TO) gPath.push({ day: x.time.day, g: gOfBuild(bv.build) });
    });
    return { md: s.player.milestoneDays, waits: [...waits.entries()], gPath, start, h0, h1, t2 };
  });
}
/** T1 milestone days of one more seed of the median set (cached; SEED's come from t1Rec). */
function t1SeedRec(preset: WorldPresetId, seed: number): MsDays {
  if (seed === SEED) return t1Rec(preset).md;
  const cal = { gSC: V3_CAL[preset].gSC, dBM: V3_CAL[preset].dBM };
  return cached('calreport-t1s', { preset, cal, sdSC: V3_CAL[preset].sdSC, seed, stopAt: lastIdx(preset), maxDays: MAX_DAYS, env: ENV }, ME, () => runT1(preset, seed).player.milestoneDays);
}
/** Integrated RefBot record for a preset (cached; real finance, only for presets with golden days): milestone days, worst R5 wait. */
function intRec(preset: WorldPresetId) {
  return cached('calreport-integrated', { preset, seed: SEED, stopAt: lastIdx(preset), maxDays: MAX_DAYS, env: ENV }, ME, () => {
    const s = newGame(defaultSetupV2({ world: preset, alignment: 'medium', seed: SEED, tutorial: false }));
    const stop = lastIdx(preset);
    const waits = new Map<string, number>();
    const watch = buildDelays(waits);
    while (s.time.day < MAX_DAYS && s.player.milestoneDays[stop] === undefined && s.player.status === 'active') {
      for (const p of [...s.events.pending]) {
        const c = refBot.decide(s, p);
        if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
      }
      refBot.act(s, engine);
      tick(s, { skip: ['endings'] });
      watch(s);
    }
    return { md: s.player.milestoneDays, worstWait: Math.max(0, ...waits.values()) };
  });
}

export function targets(): Target[] {
  const out: Target[] = [];
  const presets = (process.env.CALREPORT_PRESETS?.split(',').map((x) => x.trim()) as WorldPresetId[] | undefined) ?? ALL_PRESETS;
  const nSeeds = Number(process.env.CALREPORT_SEEDS ?? CAL_SEEDS.length);
  const seeds = CAL_SEEDS.slice(0, Math.max(1, nSeeds));
  for (const preset of presets) {
    const rec = t1Rec(preset);
    const { gPath, start, h0, h1, t2 } = rec;

    // T1: the median over the seed set per milestone, against the golden day; skips while the world has none.
    if (!hasGolden(preset)) {
      const got = NAMES.flatMap((n, i) => (rec.md[i as MilestoneIdx] === undefined ? [] : [`${n} ${yearOf(rec.md[i as MilestoneIdx] as number).toFixed(2)}`])).join(' ');
      out.push(rowOf('T1.golden.milestones', `no golden days yet (calGolden is empty for this world); seed ${SEED}: ${got}`, true, preset));
    } else {
      const mds = seeds.map((x) => t1SeedRec(preset, x));
      const g = golden.presets[preset].days;
      NAMES.forEach((n, i) => {
        const want = g[n];
        if (i < 1 || want === undefined) return;
        const tol = calTol(preset, i) * 365;
        const days = mds.map((md) => md[i as MilestoneIdx] ?? Infinity);
        const med = medianOf(days);
        const inTol = days.filter((d) => Math.abs(d - want) <= tol).length;
        const spread = i >= 3 && mds.length > 1 ? `; p10 ${sgn((quantOf(days, 0.1) - want) / 365)}, p90 ${sgn((quantOf(days, 0.9) - want) / 365)} y` : ''; // band-lint: ok milestone index: only SC onward gets a spread
        out.push(rowOf('T1.golden.milestones', `median over ${mds.length} seeds ${Number.isFinite(med) ? `${med.toFixed(1)} (${yearOf(med)})` : '—'} vs golden ${want} (${yearOf(want)}) ± ${Math.round(tol)} d; ${inTol}/${mds.length} seeds within${spread}`, Math.abs(med - want) <= tol, `${preset} ${n}`));
      });
      const r = intRec(preset);
      out.push(rowOf('R5.buildQueue.integrated', `worst ${r.worstWait} d`, r.worstWait, preset));
    }

    // R5 (stub game)
    const worstWait = Math.max(0, ...new Map(rec.waits).values());
    out.push(rowOf('R5.buildQueue.stub', `worst ${worstWait} d over ${rec.waits.length} runs`, worstWait, preset));

    // MODEL-V3 §13 frontier G path (tl-central only).
    if (preset === 'tl-central' && gPath.length > 30) { // band-lint: ok minimum samples for a line fit
      const n = gPath.length;
      const mx = gPath.reduce((a, r) => a + r.day, 0) / n;
      const my = gPath.reduce((a, r) => a + r.g, 0) / n;
      const slope = gPath.reduce((a, r) => a + (r.day - mx) * (r.g - my), 0) / gPath.reduce((a, r) => a + (r.day - mx) ** 2, 0);
      const fitAt = (d: number) => my + slope * (d - mx);
      const rows = G_ANCHORS.map(([date, g]) => ({ date, g, fit: fitAt(dayOfDate(START_DATE, date)) }));
      const worst = Math.max(...rows.map((r) => Math.abs(r.fit - r.g)));
      out.push(rowOf('GPATH.anchorDeviation', `worst ${worst.toFixed(2)} G, ${(slope * 365).toFixed(2)} G/yr; ${rows.map((r) => `${r.date} ${r.fit.toFixed(2)} vs ${r.g.toFixed(2)}`).join(', ')}`, worst, preset));
    }
    if (start && h0 && h1) {
      const months = (h1.day / 30.44) / Math.log2(h1.h / h0);
      out.push(rowOf('M.startReadout', `M ${start.M.toFixed(3)} vs ${start.src.toFixed(2)}; ×${start.rs.toFixed(2)} the leader's day-0 research speed after the auto mix`, Math.abs(start.M - start.src), preset));
      if (preset === 'tl-central') out.push(rowOf('METR.h50.doubling', `${months.toFixed(1)} months (h50 ${Math.round(h0)} → ${Math.round(h1.h)} min by 2027.0)`, months, preset));
    }
    // T2: AI labour at the superhuman coder (research/13 §1.9: ≈ 200k Agent-3 copies at ≈ 30×, ≈ 5M median-FTE on ≈ 0.5M H100e).
    out.push(t2
      ? rowOf('T2.labour.SCband', `${Math.round(t2.copies / 1000)}k copies at ${t2.speed.toFixed(1)}× on ${Math.round(t2.h100e / 1000)}k H100e = ${(t2.fte / 1e6).toFixed(2)}M FTE (day ${t2.day})`, t2.fte, preset)
      : rowOf('T2.labour.SCband', `RefBot reaches no SC within ${MAX_DAYS} days (check skipped)`, true, preset));
  }
  return out;
}
