// Calibration acceptance tests T1–T4 (V2-SPEC §7.1). Owner: WS1.
//   T1  RefBot (stub finance: infinite cash; compute tracks refTotal) — its work-type milestones (model v3 V3.5) hit the
//       golden milestone days (scripts/v2/golden/timelines.json) within ±0.08 y (SC) and ±0.12 y after, ON THE MEDIAN
//       over the fixed seed set CAL_SEEDS (calseeds.ts: 2027 and 1–19; model v3 F4 — one seed is not a calibration, the
//       dates are bimodal; seed 2027's row is informational). The per-preset knobs are G_SC (effective compute a
//       superhuman coder needs), Δ_bm (best-to-median human gap) and sd_SC (AI taste at SC), in src/data/v2/workTypes.ts
//       (V3_CAL): fit them with `npx tsx scripts/v2/calscan.ts t1 <preset> --gsc … --dbm … --sd …` (the same median over
//       the same seeds) and take the middle of the passing window. `--fit-v3 [preset …]` (seed 2027 only) is kept for a
//       first guess: it bisects G_SC on SC for each Δ_bm and searches Δ_bm on the worst later milestone.
//   T1L Leader lab (setup.leaderLab, BUILD-PLAN R2) with a passive player: the simulated leader's milestone days hit
//       the same golden days and tolerances, on the median over the same seeds. LEADER_CAL (its research efficiency,
//       log₁₀; model v3 F1) is its per-preset knob (src/data/v2/calibration.ts): `calscan.ts t1l <preset> --lc …`;
//       `--fit-leader [preset …]` (seed 2027 only) bisects it on SC for a first guess.
//   T2  Copies × speed in Mar 2027 (ai2027 RefBot) ≈ 200k at ~30× (±30%).
//   T3  China lead 150–200 d before any theft (default China lab, WS1 lab API).
//   T4  Rival gaps at start 3–9 months.
//   R5  RefBot's build queue never delays a run by more than 3 days (stub and integrated).
// Every game goes through the simulation cache (simcache.ts; the fit modes do not). Modes:
//   (default)  everything above.
//   --cal      T1, T1L and T4 only (test:cal).
//   --smoke    (test:quick) T1 and T1L on ai2027, seed 2027 only, cut at day SMOKE_DAYS (past the 2027.0 METR and Nov 2026
//              G-path reads, so those run at full strength); the milestone checks print SMOKE (the binding basis is the
//              median over CAL_SEEDS, test:cal); T4 runs; the integrated runs, T2 and T3 are skipped.
import { readFileSync } from 'node:fs';
import { GOLDEN_TOL, LEADER_CAL } from '../../src/data/v2/calibration';
import { ASI_EXTRA, V3_CAL } from '../../src/data/v2/workTypes';
import { gOfBuild, h50Of } from '../../src/engine/v2/models/capability';
import { bestPlayerVersion } from '../../src/engine/v2/models/labs';
import { researchSpeedRel } from '../../src/engine/v2/production/production';
import { speedOfCopy, workContext } from '../../src/engine/v2/departments/workfit';
import { defaultSetupV2 } from '../../src/engine/v2/core/init';
import { START_DATE, dayOfDate, decimalYearOf } from '../../src/engine/v2/core/time';
import { trueLeadDays } from '../../src/engine/v2/models/capability';
import { LEADER_ID } from '../../src/engine/v2/models/labs';
import type { GameStateV2, MilestoneIdx, WorldPresetId } from '../../src/engine/v2/types';
import { refBot } from '../../src/engine/v2/bots/ref';
import { newGame } from '../../src/engine/v2/core/init';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { engine } from '../../src/engine/v2/index';
import { fileURLToPath } from 'node:url';
import { GOLDEN_PATH, KNOWN, SMOKE, check, finish, refGame, runRef, smokeCheck } from './lib';
import { cached, prefill } from './simcache';
import { CAL_SEED, CAL_SEEDS, medianOf, quantOf } from './calseeds';
import { LINE_FIT } from '../../src/data/v2/research';
import { ePreAt, latestBaseFlop, stacksGEquiv } from '../../src/engine/v2/models/stacks';
import { TREE_BY_ID } from '../../src/data/v2/tree';
import { REF_TPP } from '../../src/data/v2/runDesign';
import { fOver } from '../../src/engine/v2/models/effective';
import { effortOf } from '../../src/engine/v2/models/tree';

const NAMES = ['A0', 'A1', 'A2', 'SC', 'SAR', 'SIAR', 'ASI'] as const;
/** Model v3 F4: T1 and T1L bind on the MEDIAN over CAL_SEEDS (SEED plus 19 others, calseeds.ts), per milestone; SEED's
 *  run also gives the R5, G-path, M and METR reads. Every seed's run is cached. */
const SEED = CAL_SEED;
const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as { presets: Record<string, { days: Record<string, number> }> };
type T1Preset = 'ai2027' | 'authors2026' | 'fast' | 'slow';
const T1_PRESETS: T1Preset[] = ['ai2027', 'authors2026', 'fast', 'slow'];
const yearOf = (d: number) => Math.round(decimalYearOf(START_DATE, d) * 1000) / 1000;

function runT1(preset: WorldPresetId, cal: { gSC: number; dBM: number; sdSC?: number }, seed = SEED, stopAt: MilestoneIdx = 6, maxDays = 365 * 16, observe?: (s: GameStateV2) => void): GameStateV2 {
  V3_CAL[preset].gSC = cal.gSC;
  V3_CAL[preset].dBM = cal.dBM;
  if (cal.sdSC !== undefined) V3_CAL[preset].sdSC = cal.sdSC;
  const s = refGame(defaultSetupV2({ world: preset, alignment: 'medium', seed }));
  return runRef(s, maxDays, (x) => {
    observe?.(x);
    return x.player.milestoneDays[stopAt] !== undefined;
  });
}

/** R5 build queue: the days each run waited for its setup beyond the first tick (pre-R5 runs trained from the first
 *  tick after launch). Records the worst per run id into `worst`. */
const buildDelays = (worst: Map<string, number>) => (s: GameStateV2) => {
  for (const r of s.player.models.runs) {
    if (r.setupId === undefined || r.startDay < 0) continue;
    const wait = (r.readyDay ?? s.time.day) - r.startDay - 1;
    worst.set(r.id, Math.max(worst.get(r.id) ?? 0, wait));
  }
};
const lastIdx = (p: T1Preset): MilestoneIdx => (p === 'slow' ? 3 : 6);

/** Worst |Δ| over SC … last milestone in units of its tolerance (≤ 1 passes T1), and the signed Δ (years) per milestone. */
function errV3(preset: T1Preset, cal: { gSC: number; dBM: number }): { worst: number; d: number[] } {
  const s = runT1(preset, cal, SEED, lastIdx(preset));
  const g = golden.presets[preset].days;
  let worst = 0;
  const d: number[] = [];
  for (let i = 3; i <= lastIdx(preset); i++) {
    const want = g[NAMES[i]];
    if (want === undefined) continue;
    const got = s.player.milestoneDays[i as MilestoneIdx];
    const tol = i === 3 ? GOLDEN_TOL.SC : GOLDEN_TOL.after;
    const dy = got === undefined ? 99 : (got - want) / 365;
    d.push(dy);
    worst = Math.max(worst, Math.abs(dy) / tol);
  }
  return { worst, d };
}

/** G_SC so RefBot's SC day equals the golden SC day at a given Δ_bm (SC day rises with G_SC; bisection, 0.002 OOM). */
function fitGSC(preset: T1Preset, dBM: number, lo = 29, hi = 45): number {
  const want = golden.presets[preset].days.SC;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const sc = runT1(preset, { gSC: mid, dBM }, SEED, 3).player.milestoneDays[3] ?? 1e9;
    if (sc < want) lo = mid;
    else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 1000) / 1000;
}

/** Fit (G_SC, Δ_bm): for each Δ_bm on a coarse grid then a golden-section refinement, G_SC by bisection on SC; the
 *  pair with the smallest worst |Δ|/tolerance over SC … last. slow (SC only) fits G_SC at its Δ_bm. */
function fitV3(preset: T1Preset): { gSC: number; dBM: number; worst: number; d: number[] } {
  const evalAt = (dBM: number) => {
    const gSC = fitGSC(preset, dBM);
    const e = errV3(preset, { gSC, dBM });
    console.log(`    ${preset} Δ_bm ${dBM.toFixed(3)} → G_SC ${gSC.toFixed(3)}: worst ${e.worst.toFixed(2)} tol (${e.d.map((x) => (x >= 0 ? '+' : '') + x.toFixed(3)).join(' ')})`);
    return { gSC, dBM, ...e };
  };
  if (preset === 'slow') return evalAt(V3_CAL.slow.dBM);
  const grid = (process.env.V3_GRID ?? '0.8,1.2,1.6,2.0,2.5,3.0').split(',').map(Number);
  let best = evalAt(grid[0]);
  const all = [best];
  for (const x of grid.slice(1)) {
    const e = evalAt(x);
    all.push(e);
    if (e.worst < best.worst) best = e;
  }
  // Golden-section refinement around the best grid point.
  const i = grid.indexOf(best.dBM);
  let lo = grid[Math.max(0, i - 1)];
  let hi = grid[Math.min(grid.length - 1, i + 1)];
  const gr = (Math.sqrt(5) - 1) / 2;
  let x1 = hi - gr * (hi - lo);
  let x2 = lo + gr * (hi - lo);
  let f1 = evalAt(x1);
  let f2 = evalAt(x2);
  for (let k = 0; k < Number(process.env.V3_ITERS ?? 5); k++) {
    if (f1.worst < f2.worst) { hi = x2; x2 = x1; f2 = f1; x1 = hi - gr * (hi - lo); f1 = evalAt(x1); }
    else { lo = x1; x1 = x2; f1 = f2; x2 = lo + gr * (hi - lo); f2 = evalAt(x2); }
  }
  for (const e of [f1, f2]) if (e.worst < best.worst) best = e;
  return best;
}

// The third per-preset value (V3b): AIFM's AI taste at the automated coder, sd_SC. `V3_SD=1.5` fits G_SC and Δ_bm at
// that sd_SC (run several in parallel and keep the best); default: the preset's current value.
if (process.env.V3_SD) for (const p of T1_PRESETS) V3_CAL[p].sdSC = Number(process.env.V3_SD);
// Experiments with the global ASI gap (AIFM ASI 12–15 SD = 0.9–1.85 best-to-median gaps beyond SIAR): V3_ASI=1.3.
if (process.env.V3_ASI) ASI_EXTRA.gaps = Number(process.env.V3_ASI);
if (process.argv.includes('--fit-v3')) {
  const named = process.argv.slice(process.argv.indexOf('--fit-v3') + 1).filter((p): p is T1Preset => (T1_PRESETS as string[]).includes(p));
  const out: Record<string, { gSC: number; dBM: number }> = {};
  for (const p of named.length ? named : T1_PRESETS) {
    const f = fitV3(p);
    out[p] = { gSC: f.gSC, dBM: Math.round(f.dBM * 1000) / 1000 };
    console.log(`V3_CAL ${p}: G_SC ${f.gSC}, Δ_bm ${f.dBM.toFixed(3)}, sd_SC ${V3_CAL[p].sdSC} (worst ${f.worst.toFixed(2)} tol: ${f.d.map((x) => x.toFixed(3)).join(' ')})`);
  }
  console.log(`V3_CAL = ${JSON.stringify(out)}  (sampled: use the ai2027 value)`);
  process.exit(0);
}

// ---------- T1L helpers: the simulated leader lab with a passive player ----------
/** New game with the leader lab on (LEADER_CAL[preset] = lc), ticked with no player actions (endings skipped) until
 *  the leader records milestone `stopAt`. Returns the leader's milestone days. */
function runT1L(preset: T1Preset, lc: number, stopAt: MilestoneIdx, seed = SEED, maxDays = 365 * 16): Partial<Record<MilestoneIdx, number>> {
  LEADER_CAL[preset] = lc;
  const s = newGame(defaultSetupV2({ world: preset, alignment: 'medium', seed, tutorial: false, leaderLab: true }));
  const L = s.rivals.find((r) => r.core.id === LEADER_ID);
  if (!L) throw new Error('T1L: no leader lab');
  while (s.time.day < maxDays && L.core.milestoneDays[stopAt] === undefined && L.core.status === 'active') tick(s, { skip: ['endings'] });
  return L.core.milestoneDays;
}
/** Worst |Δ| over SC … last milestone of the leader lab, in units of its tolerance (≤ 1 passes T1L). */
function worstErrL(preset: T1Preset, lc: number): number {
  const md = runT1L(preset, lc, lastIdx(preset));
  const g = golden.presets[preset].days;
  let worst = 0;
  for (let i = 3; i <= lastIdx(preset); i++) {
    const want = g[NAMES[i]];
    if (want === undefined) continue;
    const got = md[i as MilestoneIdx];
    const tol = i === 3 ? GOLDEN_TOL.SC : GOLDEN_TOL.after;
    worst = Math.max(worst, got === undefined ? 99 : Math.abs(got - want) / 365 / tol);
  }
  return worst;
}
/** Bisect LEADER_CAL so the leader's SC day equals the golden SC day (model v3 F1: research efficiency, so SC day falls
 *  as it rises). The aggregate leader has no idea projects and runs SC → ASI slower than RefBot, so the SC root
 *  over-delays the late milestones: refine on a grid around it by the worst |Δ|/tolerance over SC … last (0.025 steps,
 *  then 0.005). */
function fitLeader(preset: T1Preset): number {
  const want = golden.presets[preset].days.SC;
  let lo = -1;
  let hi = 1;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const sc = runT1L(preset, mid, 3)[3] ?? 1e9;
    if (sc < want) hi = mid;
    else lo = mid;
  }
  const c0 = Math.round(((lo + hi) / 2) * 1000) / 1000;
  let best = c0;
  let bestErr = worstErrL(preset, c0);
  const tryAt = (c: number) => {
    c = Math.round(c * 1000) / 1000;
    if (c === best) return;
    const e = worstErrL(preset, c);
    if (e < bestErr - 1e-6) {
      best = c;
      bestErr = e;
    }
  };
  for (let d = -0.05; d <= 0.1501; d += 0.025) tryAt(c0 + d);
  const mid = best;
  for (let d = -0.02; d <= 0.0201; d += 0.005) tryAt(mid + d);
  // Model v3 F1: where no value brings every milestone within tolerance, keep the SC root (the leader's superhuman coder
  // on time matters most to the follower starts that race it).
  const pick = bestErr <= 1 ? best : c0;
  console.log(`  ${preset}: bisection ${c0}, refined ${best} (worst |Δ|/tol ${bestErr.toFixed(2)}) → ${pick}`);
  return pick;
}
if (process.argv.includes('--fit-leader')) {
  const out: Record<string, number> = {};
  const named = process.argv.slice(process.argv.indexOf('--fit-leader') + 1).filter((p): p is T1Preset => (T1_PRESETS as string[]).includes(p));
  for (const p of named.length ? named : T1_PRESETS) {
    out[p] = fitLeader(p);
    console.log(`LEADER_CAL ${p} = ${out[p]}`);
  }
  console.log(`LEADER_CAL = ${JSON.stringify(out)}  (sampled: use the ai2027 value)`);
  process.exit(0);
}

// ---------- --fit-tree (R4; model v3 V2): reference efforts of RefBot's paradigm projects ----------
// RefBot starts each paradigm project when the old gate would have opened (bots/ref.ts REF_TREE). Model v3 V2 runs them
// through the research lifecycle (models/research.ts: ideation by science teams, experiments by research engineers),
// so their efforts (standard-team-months at pace 1, the whole stage work, split over the stages by stagesOf) are refitted until every successful RefBot
// attempt lasts as long as it did under V1 (V1_DAYS, measured on V1's RefBot, seed 2027), so adoption days stay where
// they were. Failed attempts are not fitted (a dud direction now fails after three dropped candidates). Presets: the
// named ones (default ai2027); several presets combine by the geometric mean of their ratios. Prints `effortTM` values
// for FITTED_EFFORT_TM in src/data/v2/tree.ts.
/** V1 RefBot attempt durations (days, start to known), seed 2027. */
const V1_DAYS: Record<T1Preset, Record<string, number>> = {
  ai2027: { P07: 61, 'rl.mlResearch': 22, P08: 116, P13: 127, P17: 115 },
  authors2026: { P07: 69, 'rl.mlResearch': 23, P08: 154, P13: 109, P17: 86 },
  fast: { P07: 67, 'rl.mlResearch': 19, P08: 111, P13: 43, P17: 44 },
  slow: { P07: 76, 'rl.mlResearch': 30, P08: 179 },
};
const FIT_IDS = ['P07', 'rl.mlResearch', 'P08', 'P13', 'P17'];
function attemptDurations(preset: T1Preset): Record<string, number[]> {
  const s = refGame(defaultSetupV2({ world: preset, alignment: 'medium', seed: SEED }));
  const start: Record<string, number> = {};
  const out: Record<string, number[]> = {};
  const stop = lastIdx(preset);
  runRef(s, 365 * 16, (x) => {
    for (const id of FIT_IDS) {
      const st = x.player.tree[id];
      if (!st) continue;
      const k = `${id}@${st.attempts ?? 1}`;
      if (st.status === 'researching' && start[k] === undefined) start[k] = x.time.day;
      if (st.status === 'known' && start[k] !== undefined && st.day === x.time.day) (out[id] ??= []).push(x.time.day - start[k] + 1);
    }
    return x.player.milestoneDays[stop] !== undefined;
  });
  return out;
}
if (process.argv.includes('--fit-tree')) {
  const named = process.argv.slice(process.argv.indexOf('--fit-tree') + 1).filter((p): p is T1Preset => (T1_PRESETS as string[]).includes(p));
  const presets = named.length ? named : (['ai2027'] as T1Preset[]);
  for (let iter = 0; iter < 10; iter++) {
    const logR: Record<string, number[]> = {};
    const rows: string[] = [];
    for (const p of presets) {
      const d = attemptDurations(p);
      for (const [id, ds] of Object.entries(d)) {
        const want = V1_DAYS[p][id];
        if (want === undefined) continue;
        const mean = ds.reduce((a, x) => a + x, 0) / ds.length;
        (logR[id] ??= []).push(Math.log(want / Math.max(1, mean)));
        rows.push(`${p}:${id} ${ds.join('/')} d (V1 ${want})`);
      }
    }
    console.log(`  iter ${iter}: ${rows.join('  ')}`);
    let worst = 0;
    for (const [id, lr] of Object.entries(logR)) {
      const ratio = Math.exp(lr.reduce((a, x) => a + x, 0) / lr.length);
      worst = Math.max(worst, Math.abs(Math.log(ratio)));
      const n = TREE_BY_ID[id];
      // Damped (the projects share teams and research engineers, so a full step makes them alternate).
      n.effortTM = Math.round(effortOf(n) * Math.pow(ratio, 0.7) * 100) / 100;
    }
    if (worst < 0.04) break;
  }
  console.log(`effortTM = ${JSON.stringify(Object.fromEntries(FIT_IDS.map((id) => [id, TREE_BY_ID[id].effortTM])))}`);
  process.exit(0);
}

// ---------- --fit-lines (model v3 V3, V3 notes derivation 1): the lines' start effect LINE_FIT.mu ----------
// The pools' start state n₀ comes from the start effect per idea μ₁ = effect.mean × LINE_FIT.mu ("set from the start
// rate"). The fit bisects LINE_FIT.mu so the reference lab's pretraining stack grows HO_RATE OOM/yr over its first year
// (Ho et al. 2024, ≈ 3×/yr before automation, research/20 B1), measured at its latest base.
const HO_RATE = 0.48;
if (process.argv.includes('--fit-lines')) {
  const named = process.argv.slice(process.argv.indexOf('--fit-lines') + 1).filter((p): p is T1Preset => (T1_PRESETS as string[]).includes(p));
  const presets = named.length ? named : (['ai2027'] as T1Preset[]);
  const rate = (p: T1Preset, mu: number) => {
    LINE_FIT.mu = mu;
    const s = refGame(defaultSetupV2({ world: p, alignment: 'medium', seed: SEED }));
    runRef(s, 365);
    return ePreAt(s, latestBaseFlop(s));
  };
  for (const p of presets) {
    let lo = 0.1;
    let hi = 3;
    for (let i = 0; i < 12; i++) {
      const mid = Math.sqrt(lo * hi);
      if (rate(p, mid) > HO_RATE) hi = mid;
      else lo = mid;
    }
    console.log(`LINE_FIT.mu ${p} = ${Math.sqrt(lo * hi).toFixed(4)} (pretraining stack ${HO_RATE} OOM in the first year)`);
  }
  process.exit(0);
}

// ---------- T1 ----------
const ME = [fileURLToPath(import.meta.url)];
const CAL_ONLY = process.argv.includes('--cal');
/** --smoke cut (days): past 2027-01-01 (day 549, the METR read), the Nov 2026 G-path end and the ai2027 golden SC (day 638). */
const SMOKE_DAYS = 700;
const MAX_DAYS = SMOKE ? SMOKE_DAYS : 365 * 16;
const PRESETS: T1Preset[] = SMOKE ? ['ai2027'] : T1_PRESETS;
/** Calibration overrides that change every run (part of every cache key). */
const ENV = { V3_SD: process.env.V3_SD ?? null, V3_ASI: process.env.V3_ASI ?? null };
Object.assign(KNOWN, {
  'T1 ai2027 A1': 'Before continual learning RefBot\'s deployed model lags its know-how by 0.5–0.9 y (base staleness, κ, version age), more than the post-stream lag calShift is fitted to; early milestones are informational (§7.1 binds SC and later).',
  'T1 ai2027 A2': 'see T1 ai2027 A1',
  'T1 authors2026 A1': 'see T1 ai2027 A1', 'T1 authors2026 A2': 'see T1 ai2027 A1',
  'T1 fast A1': 'see T1 ai2027 A1', 'T1 fast A2': 'see T1 ai2027 A1',
  'T1 slow A1': 'see T1 ai2027 A1', 'T1 slow A2': 'see T1 ai2027 A1',
  // Model v3 F4: no LEADER_CAL brings these in with SC and SAR (median over CAL_SEEDS; F4 notes).
  'T1L authors2026 SIAR': 'The aggregate leader lab (no idea projects) runs authors2026 SAR → ASI in 2.2 y where the golden takes 3.8 y: at LEADER_CAL 0.11 (SC −0.02, SAR 0.00 y) SIAR is −0.83 y and ASI −1.66 y; at 0.05, where SC is already +0.23 y, still −0.57 / −1.39 y (F2, M7, F4).',
  'T1L authors2026 ASI': 'see T1L authors2026 SIAR',
});
const table: string[] = [];
const delays: string[] = [];
const stackRates: string[] = [];
/** research/12 §0.2 frontier anchors (best public model, G = log₁₀ effective compute), fitted for a reference base at 50
 *  tokens per parameter; since A6b the reference trains at REF_TPP (400, inference-aware), so the anchors move by the
 *  overtraining factor between the two (log₁₀ f_over(400) − log₁₀ f_over(50) = −0.31 OOM), the lead's decision (no new term). */
const OVER_DG = Math.log10(fOver(REF_TPP) / fOver(50));
const G_ANCHORS: [string, number][] = ([['2025-08-15', 28.0], ['2025-11-15', 28.4], ['2026-02-15', 28.7], ['2026-04-15', 29.0], ['2026-10-15', 29.4]] as [string, number][]).map(([d, g]) => [d, g + OVER_DG]);
const G_PATH_FROM = dayOfDate(START_DATE, '2025-08-01');
const G_PATH_TO = dayOfDate(START_DATE, '2026-11-30');
/** T1 run record for a preset (cached): milestone days, R5 waits, stacks before SC, the G path, start M and METR reads. */
function t1Rec(preset: T1Preset) {
  const cal = { gSC: V3_CAL[preset].gSC, dBM: V3_CAL[preset].dBM };
  return cached('calib-t1', { preset, cal, sdSC: V3_CAL[preset].sdSC, seed: SEED, stopAt: lastIdx(preset), maxDays: MAX_DAYS, env: ENV }, ME, () => {
  const waits = new Map<string, number>();
  // V3-BUILD V2.8: the reference lab's pretraining stack and all stacks (G-equivalent) before SC.
  const stackAt0: { day: number; pre: number; g: number }[] = [];
  const watch = buildDelays(waits);
  // V3.7 checks: research speed at the start (the M readout and research speed vs the leader's day 0) and the METR h50
  // doubling time of the best model from the start to 2027.0 (2025–26).
  let start: { M: number; rs: number } | undefined;
  let h0: number | undefined;
  let h1: { day: number; h: number } | undefined;
  const d2027 = dayOfDate(START_DATE, '2027-01-01');
  // MODEL-V3 §13: the frontier G path to 2026 (research/12 §0.2 anchors, ±0.2 G). RefBot's best model is a staircase (a
  // base every 9 months), so the check reads the least-squares line through its daily G from Aug 2025 to Nov 2026 at
  // each anchor date, and reports the raw staircase too.
  const gPath: { day: number; g: number }[] = [];
  const s = runT1(preset, cal, SEED, lastIdx(preset), MAX_DAYS, (x) => {
    watch(x);
    if (x.time.day === 1) start = { M: x.player.prodCache?.M ?? 0, rs: researchSpeedRel(x) };
    const bv = bestPlayerVersion(x);
    if (bv && x.time.day === 0) h0 = h50Of(x.hidden.timeline, bv);
    if (bv && x.time.day === d2027) h1 = { day: x.time.day, h: h50Of(x.hidden.timeline, bv) };
    if (bv?.build && x.time.day >= G_PATH_FROM && x.time.day <= G_PATH_TO) gPath.push({ day: x.time.day, g: gOfBuild(bv.build) });
    if (x.player.milestoneDays[3] === undefined && (x.time.day % 7 === 0)) stackAt0.push({ day: x.time.day, pre: ePreAt(x, latestBaseFlop(x)), g: stacksGEquiv(x) });
  });
  return { md: s.player.milestoneDays, waits: [...waits.entries()], stackAt0, gPath, start, h0, h1 };
  });
}
/** T1 milestone days of one more seed of the median set (cached; SEED's come from t1Rec, whose observers only read). */
function t1SeedRec(preset: T1Preset, seed: number): Partial<Record<MilestoneIdx, number>> {
  if (seed === SEED) return t1Rec(preset).md;
  const cal = { gSC: V3_CAL[preset].gSC, dBM: V3_CAL[preset].dBM };
  return cached('calib-t1s', { preset, cal, sdSC: V3_CAL[preset].sdSC, seed, stopAt: lastIdx(preset), maxDays: MAX_DAYS, env: ENV }, ME, () => runT1(preset, cal, seed, lastIdx(preset), MAX_DAYS).player.milestoneDays);
}
/** T1L leader-lab milestone days for a preset and seed (cached). */
function t1lRec(preset: T1Preset, seed = SEED) {
  const lc = LEADER_CAL[preset];
  return cached('calib-t1l', { preset, lc, stopAt: lastIdx(preset), seed, maxDays: MAX_DAYS, env: ENV }, ME, () => runT1L(preset, lc, lastIdx(preset), seed, MAX_DAYS));
}
/** T1 integrated RefBot record for a preset (cached): milestone days, worst R5 wait, final cash and finance state. */
function intRec(preset: T1Preset) {
  return cached('calib-integrated', { preset, seed: SEED, stopAt: lastIdx(preset), maxDays: 365 * 16, env: ENV }, ME, () => {
    const s = newGame(defaultSetupV2({ world: preset, alignment: 'medium', seed: SEED, tutorial: false }));
    const stop = lastIdx(preset);
    const waits = new Map<string, number>();
    const watch = buildDelays(waits);
    while (s.time.day < 365 * 16 && s.player.milestoneDays[stop] === undefined && s.player.status === 'active') {
      for (const p of [...s.events.pending]) {
        const c = refBot.decide(s, p);
        if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
      }
      refBot.act(s, engine);
      tick(s, { skip: ['endings'] });
      watch(s);
    }
    return { md: s.player.milestoneDays, worstWait: Math.max(0, ...waits.values()), cash: s.player.finance.cash, state: s.player.finance.state };
    });
}
/** T2 AI labour at the stub RefBot's SC (cached). */
function t2Rec() {
  return cached('calib-t2', { preset: 'ai2027', seed: SEED, maxDays: 365 * 4, stopAt: 3, env: ENV }, ME, () => {
    const s = refGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: SEED }));
    runRef(s, 365 * 4, (x) => x.player.milestoneDays[3] !== undefined);
    const wc = workContext(s);
    return { day: s.time.day, fte: wc.slots.EXP.aiFte + wc.slots.IDEAS.aiFte, copies: wc.slots.EXP.copies + wc.slots.IDEAS.copies, h100e: wc.slots.EXP.h100e + wc.slots.IDEAS.h100e };
  });
}
/** T3 China lead, monthly until the first theft (stub RefBot, cached). */
function t3Rec() {
  const stolen = (x: GameStateV2) => x.player.security.stolen.length + x.rivals.reduce((n, r) => n + r.core.security.stolen.length, 0) > 0;
  return cached('calib-t3', { world: 'ai2027', alignment: 'medium', seed: SEED, from: 30, to: 540, step: 30, env: ENV }, ME, () => {
    const s = refGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: SEED }));
    const leads: number[] = [];
    for (let d = 30; d <= 540; d += 30) {
      runRef(s, d, stolen);
      if (stolen(s)) break;
      leads.push(Math.round(trueLeadDays(s, 'china')));
    }
    return { leads, day: s.time.day };
  });
}
// The runner's --prefill shards: every cached run of this mode, in the order the checks ask for them.
/** Seeds of the binding T1 / T1L medians (smoke: SEED only, cut at SMOKE_DAYS, informational). T1 needs all 20: RefBot's
 *  dates are multimodal and every smaller subset of CAL_SEEDS tried (first 5, 8, 10, 12) moved some median out of
 *  tolerance. The aggregate leader lab is near-deterministic (p10–p90 ≤ 0.1 y on 20 seeds; the first five seeds' medians
 *  sit within 0.02 y of the 20-seed medians), so T1L reads the first five, which keeps test:cal's cold run down (F4). */
const T1_SEEDS = SMOKE ? [SEED] : CAL_SEEDS;
const T1L_SEEDS = SMOKE ? [SEED] : CAL_SEEDS.slice(0, 5);
prefill([
  // slow (the longest runs) first.
  ...[...PRESETS].reverse().flatMap((p) => [() => t1Rec(p), ...T1_SEEDS.filter((x) => x !== SEED).map((x) => () => t1SeedRec(p, x)), ...T1L_SEEDS.map((x) => () => t1lRec(p, x))]),
  ...(SMOKE || CAL_ONLY || process.argv.includes('--no-integrated') ? [] : T1_PRESETS.map((p) => () => intRec(p))),
  ...(SMOKE || CAL_ONLY ? [] : [() => t2Rec(), () => t3Rec()]),
]);
type MsDays = Partial<Record<MilestoneIdx, number>>;
const sgn = (x: number) => (x >= 0 ? '+' : '') + x.toFixed(3);
/** One seed's milestone years (Δ vs golden) from milestone `from` on. */
const seedRow = (preset: T1Preset, md: MsDays, from: number) => {
  const g = golden.presets[preset].days;
  return NAMES.flatMap((n, i) => {
    if (i < from || g[n] === undefined) return [];
    const got = md[i as MilestoneIdx];
    return [`${n} ${got === undefined ? '—' : `${yearOf(got).toFixed(3)} (${sgn((got - g[n]) / 365)})`}`];
  }).join('  ');
};
/** F4: the binding T1 / T1L checks on the median over the seed set, milestone `from` … last; the spread (p10, p90, seeds
 *  within tolerance) is printed with them. Under --smoke (SEED only, cut at SMOKE_DAYS) they print SMOKE. */
function medianChecks(test: 'T1' | 'T1L', preset: T1Preset, mds: MsDays[], from: number) {
  const g = golden.presets[preset].days;
  const cells: string[] = [];
  const spread: string[] = [];
  NAMES.forEach((n, i) => {
    const want = g[n];
    if (i < from || want === undefined) return;
    const tol = (i === 3 ? GOLDEN_TOL.SC : GOLDEN_TOL.after) * 365;
    const days = mds.map((md) => md[i as MilestoneIdx] ?? Infinity);
    const med = medianOf(days);
    const inTol = days.filter((d) => Math.abs(d - want) <= tol).length;
    const ok = Math.abs(med - want) <= tol;
    const label = `${test} ${preset} ${n}`;
    const detail = `median over ${mds.length} seeds ${Number.isFinite(med) ? `${med.toFixed(1)} (${yearOf(med)})` : '—'} want ${want} (${yearOf(want)}) ±${Math.round(tol)} d; ${inTol}/${mds.length} seeds within`;
    if (SMOKE) smokeCheck(ok, label, detail, `(seed ${SEED} only, cut at day ${MAX_DAYS})`);
    else check(ok, label, detail);
    cells.push(`${n} ${Number.isFinite(med) ? `${yearOf(med).toFixed(3)} (${sgn((med - want) / 365)})` : '—'}`);
    if (i >= 3 && mds.length > 1) spread.push(`${n}: p10 ${sgn((quantOf(days, 0.1) - want) / 365)}, p90 ${sgn((quantOf(days, 0.9) - want) / 365)} y; ${inTol}/${mds.length} seeds within ±${(tol / 365).toFixed(2)} y`);
  });
  return { row: cells.join('  '), spread };
}
const medTable: string[] = [];
const v3checks: string[] = [];
for (const preset of PRESETS) {
  const cal = { gSC: V3_CAL[preset].gSC, dBM: V3_CAL[preset].dBM };
  const t0 = performance.now();
  const rec = t1Rec(preset);
  const { stackAt0, gPath, start, h0, h1 } = rec;
  const waits = new Map(rec.waits);
  if (stackAt0.length > 2) {
    const a = stackAt0[0];
    const y1 = stackAt0.find((r) => r.day >= 365) ?? stackAt0[stackAt0.length - 1];
    const b = stackAt0[stackAt0.length - 1];
    const yrs = (b.day - a.day) / 365;
    stackRates.push(`${preset} pretraining stack ${((y1.pre - a.pre) / ((y1.day - a.day) / 365)).toFixed(2)} OOM/yr in the first year, ${((b.pre - a.pre) / yrs).toFixed(2)} OOM/yr start → SC; all stacks (G-equivalent) ${((y1.g - a.g) / ((y1.day - a.day) / 365)).toFixed(2)} / ${((b.g - a.g) / yrs).toFixed(2)} OOM/yr`);
  }
  if (gPath.length > 30) {
    const n = gPath.length;
    const mx = gPath.reduce((a, r) => a + r.day, 0) / n;
    const my = gPath.reduce((a, r) => a + r.g, 0) / n;
    const slope = gPath.reduce((a, r) => a + (r.day - mx) * (r.g - my), 0) / gPath.reduce((a, r) => a + (r.day - mx) ** 2, 0);
    const fitAt = (d: number) => my + slope * (d - mx);
    const rows = G_ANCHORS.map(([date, g]) => { const d = dayOfDate(START_DATE, date); const raw = gPath.find((r) => r.day >= d)?.g ?? NaN; return { date, g, fit: fitAt(d), raw }; });
    const worst = Math.max(...rows.map((r) => Math.abs(r.fit - r.g)));
    v3checks.push(`${preset}: frontier G path (line) ${rows.map((r) => `${r.date} ${r.fit.toFixed(2)} (raw ${r.raw.toFixed(2)}, anchor ${r.g})`).join(', ')}; ${(slope * 365).toFixed(2)} G/yr (research/12: 1.1–1.3)`);
    if (preset === 'ai2027') check(worst <= 0.2, 'MODEL-V3 §13 frontier G path to 2026 within ±0.2 G of research/12 §0.2 (least-squares line through RefBot\'s best model)', `worst ${worst.toFixed(2)} G, ${(slope * 365).toFixed(2)} G/yr`);
  }
  if (start && h0 && h1) {
    const months = (h1.day / 30.44) / Math.log2(h1.h / h0);
    v3checks.push(`${preset}: research speed at start M ${start.M.toFixed(3)}, vs the leader's day 0 ×${start.rs.toFixed(2)}; METR h50 ${Math.round(h0)} → ${Math.round(h1.h)} min by 2027.0 = doubling every ${months.toFixed(1)} months (METR 4.2 ± 1)`);
    if (preset === 'ai2027') {
      // The readout is M (research speed vs the same lab without AI labour). Research speed vs the leader's day-0 inputs is
      // reported: on day 1 the auto mix has moved research compute to experiments (5% → ≈ 8% of compute), ≈ ×1.2.
      check(Math.abs(start.M - 1) <= 0.1, 'V3.7 research speed readout M ≈ 1 at the start (leader, ai2027)', `M ${start.M.toFixed(3)}; ×${start.rs.toFixed(2)} the leader's day-0 research speed after the auto mix`);
      check(months >= 3.2 && months <= 5.2, 'V3.7 METR h50 doubling ≈ 4.2 months for the reference frontier 2025–26 (±1)', `${months.toFixed(1)} months`);
    }
  }
  const worstWait = Math.max(0, ...waits.values());
  delays.push(`${preset} ${worstWait} d over ${waits.size} runs`);
  check(worstWait <= 3, `R5 build queue never delays a RefBot run > 3 d (${preset})`, `worst ${worstWait} d`);
  const mds = T1_SEEDS.map((x) => t1SeedRec(preset, x));
  const { row, spread } = medianChecks('T1', preset, mds, 1);
  table.push(`${preset.padEnd(12)} G_SC ${cal.gSC.toFixed(3)} Δ_bm ${cal.dBM.toFixed(3)} sd_SC ${V3_CAL[preset].sdSC}  seed ${SEED}: ${seedRow(preset, rec.md, 1)}  [${(performance.now() - t0).toFixed(0)} ms]`);
  medTable.push(`${preset.padEnd(12)} ${row}`, ...spread.map((x) => `${' '.repeat(14)}${x}`));
}
console.log(`\nT1 RefBot milestone years, median over ${T1_SEEDS.length} seeds (${T1_SEEDS.join(', ')}; Δ vs golden, years; the binding checks):`);
for (const r of medTable) console.log('  ' + r);
console.log(`T1 RefBot milestone years on seed ${SEED} alone (informational since F4; its run also gives the R5, G-path, M and METR reads):`);
for (const r of table) console.log('  ' + r);
console.log(`  R5 build queue, worst wait for engineers: ${delays.join(', ')}`);
console.log('\nV2.8 stacks before SC (Ho et al. ≈ 0.48 OOM/yr pretraining before automation, ±30%):');
for (const r of stackRates) console.log('  ' + r);
console.log('V3.7 checks:');
for (const r of v3checks) console.log('  ' + r);

// ---------- T1L: the leader lab (passive player) hits the golden days; SC and later bind, A1/A2 informational ----------
{
  const tableL: string[] = [];
  for (const preset of PRESETS) {
    const lc = LEADER_CAL[preset];
    const t0 = performance.now();
    const mds = T1L_SEEDS.map((x) => t1lRec(preset, x));
    const { row, spread } = medianChecks('T1L', preset, mds, 3);
    tableL.push(`${preset.padEnd(12)} LEADER_CAL ${lc.toFixed(3)}  median ${row}  [${(performance.now() - t0).toFixed(0)} ms]`, ...spread.map((x) => `${' '.repeat(14)}${x}`), `${' '.repeat(14)}seed ${SEED}: ${seedRow(preset, t1lRec(preset), 1)}`);
  }
  console.log(`\nT1L leader lab milestone years (passive player), median over ${T1L_SEEDS.length} seeds (Δ vs golden, years; SC and later bind):`);
  for (const r of tableL) console.log('  ' + r);
}

// ---------- T1 integrated (M2, informational): RefBot with real compute, finance and revenue ----------
// Same RefBot model policy, but compute is bought by WS3's autopilot under real cash, revenue is WS5's and every system
// is live (endings skipped so the timeline can be read to ASI). §7.1 binds T1 on the stub; this table shows how far
// money and the market move it (M2 report: flag anything > 3 months).
if (!process.argv.includes('--no-integrated') && !SMOKE && !CAL_ONLY) {
  console.log('\nT1 integrated RefBot (real finance; Δ vs golden, years):');
  for (const preset of T1_PRESETS) {
    const t0 = performance.now();
    const r = intRec(preset);
    const s = { player: { milestoneDays: r.md, finance: { cash: r.cash, state: r.state } } };
    const stop = lastIdx(preset);
    const waits = new Map([['worst', r.worstWait]]);
    check(Math.max(0, ...waits.values()) <= 3, `R5 build queue never delays a RefBot run > 3 d (integrated ${preset})`, `worst ${Math.max(0, ...waits.values())} d`);
    const g = golden.presets[preset].days;
    const row = NAMES.slice(1, stop + 1).map((n, j) => {
      const got = s.player.milestoneDays[(j + 1) as MilestoneIdx];
      const want = g[n];
      const dy = got === undefined || want === undefined ? NaN : (got - want) / 365;
      return `${n} ${got === undefined ? '—' : yearOf(got).toFixed(3)} (${Number.isNaN(dy) ? '—' : (dy >= 0 ? '+' : '') + dy.toFixed(3)})`;
    });
    const f = s.player.finance;
    console.log(`  ${preset.padEnd(12)} ${row.join('  ')}  [cash ${f.cash.toFixed(0)}, ${f.state}, ${(performance.now() - t0).toFixed(0)} ms]`);
  }
}

// ---------- T2: AI labour at the superhuman coder (model v3 V3: a sanity check against AI 2027, not a fit target) ----------
// AI 2027 (research/13 §1.9): ≈ 200k Agent-3 copies at ≈ 30× ("50,000 copies of the best human coder sped up by 30×",
// ≈ 1.5M best-coder FTE, ≈ 5M median-FTE) on ≈ 0.5M H100e. Model v3 counts copies physically (FLOP per token, utilisation,
// tokens per work-hour; departments/workfit.ts), so the check is an order of magnitude on the AI FTE in research.
if (!SMOKE && !CAL_ONLY) {
  const t2 = t2Rec();
  const { fte, copies } = t2;
  const s = { time: { day: t2.day } };
  console.log(`INFO  T2 at SC (day ${s.time.day}): research agents ${Math.round(copies / 1000)}k copies at ${speedOfCopy().toFixed(1)}× on ${Math.round(t2.h100e / 1000)}k H100e = ${(fte / 1e6).toFixed(2)}M FTE (AI 2027: 200k copies at 30×, ≈ 5M median-FTE on ≈ 0.5M H100e)`);
  check(fte >= 5e5 / 10 && fte <= 5e6 * 10, 'T2 AI labour at SC within an order of magnitude of AI 2027 (sanity check)', `${(fte / 1e6).toFixed(2)}M FTE`);
}

// ---------- T3 / T4 (default rival/China labs, no theft) ----------
{
  const s = refGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: SEED }));
  // Gap in months at the start = trueLeadDays / 30.4 (gap / the player's model progress rate). The archetype gap
  // ranges are WS4's (actors/rivals.ts); the spread over seeds is printed for them.
  const gaps = s.rivals.map((r) => trueLeadDays(s, r.core.id) / 30.4);
  check(gaps.every((m) => m >= 3 - 1e-9 && m <= 9 + 1e-9), 'T4 rival gaps at start 3–9 months (fixture seed)', gaps.map((m) => m.toFixed(1)).join(', '));
  const all: number[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    const t = refGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed }));
    for (const r of t.rivals) all.push(trueLeadDays(t, r.core.id) / 30.4);
  }
  all.sort((a, b) => a - b);
  const inBand = all.filter((m) => m >= 3 && m <= 9).length / all.length;
  console.log(`      T4 over 40 seeds: min ${all[0].toFixed(1)}, median ${all[all.length >> 1].toFixed(1)}, max ${all[all.length - 1].toFixed(1)} months; ${(100 * inBand).toFixed(0)}% in 3–9 (archetype ranges: WS4)`);
  // The lead is read against the player's discrete releases, so it swings by ± a release interval; T3 tests the
  // mean over the pre-SC year and a loose band on every monthly sample.
  // Sampled monthly until the first weight theft by China (from the player or any rival), which resets the gap.
  if (!SMOKE && !CAL_ONLY) {
  const t3 = t3Rec();
  const leads = t3.leads;
  if (leads.length < 18) console.log(`      T3: first theft on day ${t3.day}; ${leads.length} monthly samples before it`);
  const mean = leads.reduce((a, x) => a + x, 0) / leads.length;
  // M2: informational. The stub pins China's compute to the reference path; with WS4's China compute (computeAbs) and
  // the WS1 distillation leak live, the binding T3 is the integrated one in scripts/v2/ws4.ts (CHINA_CAL is fit there).
  console.log(`INFO  T3 (stub compute) China mean lead before theft: ${mean.toFixed(0)} d; monthly ${leads.join(' ')}`);
  }
}

finish('calib');
