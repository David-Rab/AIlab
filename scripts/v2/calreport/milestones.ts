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
import { START_DATE, dayOfDate, decimalYearOf } from '../../../src/engine/v2/core/time';
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
import type { Target } from './types';

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
 *  overtraining factor between the two (log₁₀ f_over(400) − log₁₀ f_over(50) = −0.31 OOM), the lead's decision (no new term). */
const OVER_DG = Math.log10(fOver(REF_TPP) / fOver(50));
const G_ANCHORS: [string, number][] = ([['2025-08-15', 28.0], ['2025-11-15', 28.4], ['2026-02-15', 28.7], ['2026-04-15', 29.0], ['2026-10-15', 29.4]] as [string, number][]).map(([d, g]) => [d, g + OVER_DG]);
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
    const id = (k: string) => `milestones.${preset}.${k}`;

    // T1: the median over the seed set per milestone, against the golden day; skips while the world has none.
    if (!hasGolden(preset)) {
      const got = NAMES.flatMap((n, i) => (rec.md[i as MilestoneIdx] === undefined ? [] : [`${n} ${yearOf(rec.md[i as MilestoneIdx] as number).toFixed(2)}`])).join(' ');
      out.push({ id: id('t1'), label: `T1 ${preset} RefBot milestone days vs the golden days (median over CAL_SEEDS)`, band: 'golden day ± 0.08 y (SC), ± 0.12 y after', value: `no golden days yet (calGolden); seed ${SEED}: ${got}`, ok: true, source: 'V2-SPEC §7.1 T1; model v3 F4 (median over CAL_SEEDS); lib.ts calGolden is empty for the timeline worlds' });
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
        const spread = i >= 3 && mds.length > 1 ? `; p10 ${sgn((quantOf(days, 0.1) - want) / 365)}, p90 ${sgn((quantOf(days, 0.9) - want) / 365)} y` : '';
        out.push({ id: id(`t1.${n}`), label: `T1 ${preset} ${n}: median milestone day over ${mds.length} seeds`, band: `${want} (${yearOf(want)}) ± ${Math.round(tol)} d`, value: `${Number.isFinite(med) ? `${med.toFixed(1)} (${yearOf(med)})` : '—'}; ${inTol}/${mds.length} seeds within${spread}`, ok: Math.abs(med - want) <= tol, source: 'V2-SPEC §7.1 T1; model v3 F4; golden days (lib.ts calGolden)' });
      });
      const r = intRec(preset);
      out.push({ id: id('r5.integrated'), label: `R5 build queue never delays a RefBot run > 3 d (integrated ${preset})`, band: '≤ 3 d', value: `worst ${r.worstWait} d`, ok: r.worstWait <= 3, source: 'V2-SPEC R5' });
    }

    // R5 (stub game)
    const worstWait = Math.max(0, ...new Map(rec.waits).values());
    out.push({ id: id('r5'), label: `R5 build queue never delays a RefBot run > 3 d (${preset})`, band: '≤ 3 d', value: `worst ${worstWait} d over ${rec.waits.length} runs`, ok: worstWait <= 3, source: 'V2-SPEC R5' });

    // MODEL-V3 §13 frontier G path (tl-central only).
    if (preset === 'tl-central' && gPath.length > 30) {
      const n = gPath.length;
      const mx = gPath.reduce((a, r) => a + r.day, 0) / n;
      const my = gPath.reduce((a, r) => a + r.g, 0) / n;
      const slope = gPath.reduce((a, r) => a + (r.day - mx) * (r.g - my), 0) / gPath.reduce((a, r) => a + (r.day - mx) ** 2, 0);
      const fitAt = (d: number) => my + slope * (d - mx);
      const rows = G_ANCHORS.map(([date, g]) => ({ date, g, fit: fitAt(dayOfDate(START_DATE, date)) }));
      const worst = Math.max(...rows.map((r) => Math.abs(r.fit - r.g)));
      out.push({ id: id('gPath'), label: "MODEL-V3 §13 frontier G path to 2026 (least-squares line through RefBot's best model)", band: '±0.2 G of the anchors', value: `worst ${worst.toFixed(2)} G, ${(slope * 365).toFixed(2)} G/yr (research/12: 1.1–1.3); ${rows.map((r) => `${r.date} ${r.fit.toFixed(2)} vs ${r.g.toFixed(2)}`).join(', ')}`, ok: worst <= 0.2, source: 'research/12 §0.2 frontier anchors (best public model); OPEN.md § Balance: frontier G path to 2026 (RefBot 0.75 G/yr vs research/12 1.1–1.3)' });
    }
    if (start && h0 && h1) {
      const months = (h1.day / 30.44) / Math.log2(h1.h / h0);
      out.push({ id: id('mStart'), label: `V3.7 research speed readout M at the start (${preset})`, band: "the preset's source (AI 2027 integrator M(p0)) ± 0.1", value: `M ${start.M.toFixed(3)} vs ${start.src.toFixed(2)}; ×${start.rs.toFixed(2)} the leader's day-0 research speed after the auto mix`, ok: Math.abs(start.M - start.src) <= 0.1, source: 'CAL2-T (DECISIONS "Calibration decisions after CAL1 refits" item 3): src/data/world.ts multiplierAt at p0 (ai2027 1.25, authors2026 1.10, fast 1.15, slow 1.01)' });
      if (preset === 'tl-central') out.push({ id: id('metr'), label: 'V3.7 METR h50 doubling for the reference frontier 2025–26', band: '4.2 ± 1 months', value: `${months.toFixed(1)} months (h50 ${Math.round(h0)} → ${Math.round(h1.h)} min by 2027.0)`, ok: months >= 3.2 && months <= 5.2, source: 'METR time-horizon doubling ≈ 4.2 months (as calib.ts V3.7); OPEN.md § Balance: METR h50 doubling 2025–26 (RefBot ≈ 9 months vs 4.2 ± 1)' });
    }
    // T2: AI labour at the superhuman coder (research/13 §1.9: ≈ 200k Agent-3 copies at ≈ 30×, ≈ 5M median-FTE on ≈ 0.5M H100e).
    out.push(t2
      ? { id: id('t2'), label: `T2 AI research labour at SC (${preset})`, band: '0.5M–50M FTE (AI 2027 ≈ 5M within ×10)', value: `${Math.round(t2.copies / 1000)}k copies at ${t2.speed.toFixed(1)}× on ${Math.round(t2.h100e / 1000)}k H100e = ${(t2.fte / 1e6).toFixed(2)}M FTE (day ${t2.day})`, ok: t2.fte >= 5e5 && t2.fte <= 5e7, source: 'research/13 §1.9: AI 2027 Agent-3 ≈ 200k copies at 30×, ≈ 5M median-FTE on ≈ 0.5M H100e' }
      : { id: id('t2'), label: `T2 AI research labour at SC (${preset})`, band: '0.5M–50M FTE', value: `RefBot reaches no SC within ${MAX_DAYS} days (calib skipped this check)`, ok: true, source: 'research/13 §1.9' });
  }
  return out;
}
