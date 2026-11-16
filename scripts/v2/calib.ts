// Calibration acceptance tests T1–T4 (V2-SPEC §7.1). Owner: WS1.
//   T1  RefBot (stub finance: infinite cash; compute tracks refTotal) — its best internal version hits the golden
//       milestone days (scripts/v2/golden/timelines.json) within ±0.08 y (SC) and ±0.12 y after. calShift is the
//       single per-preset knob: `npx tsx scripts/v2/calib.ts --fit` bisects it on SC and prints the values to
//       hard-code in src/data/v2/calibration.ts (CAL_SHIFT).
//   T1L Leader lab (setup.leaderLab, BUILD-PLAN R2) with a passive player: the simulated leader's milestone days hit
//       the same golden days and tolerances. LEADER_CAL (an extra release lag, years) is its per-preset knob:
//       `npx tsx scripts/v2/calib.ts --fit-leader [preset …]` bisects it on SC (src/data/v2/calibration.ts).
//   T2  Copies × speed in Mar 2027 (ai2027 RefBot) ≈ 200k at ~30× (±30%).
//   T3  China lead 150–200 d before any theft (default China lab, WS1 lab API).
//   T4  Rival gaps at start 3–9 months.
import { readFileSync } from 'node:fs';
import { CAL_SHIFT, GOLDEN_TOL, LEADER_CAL } from '../../src/data/v2/calibration';
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
import { GOLDEN_PATH, KNOWN, check, finish, refGame, runRef } from './lib';
import { TREE_BY_ID } from '../../src/data/v2/tree';
import { effortOf } from '../../src/engine/v2/models/tree';

const NAMES = ['A0', 'A1', 'A2', 'SC', 'SAR', 'SIAR', 'ASI'] as const;
const SEED = 2027;
const golden = JSON.parse(readFileSync(GOLDEN_PATH, 'utf8')) as { presets: Record<string, { days: Record<string, number> }> };
type T1Preset = 'ai2027' | 'authors2026' | 'fast' | 'slow';
const T1_PRESETS: T1Preset[] = ['ai2027', 'authors2026', 'fast', 'slow'];
const yearOf = (d: number) => Math.round(decimalYearOf(START_DATE, d) * 1000) / 1000;

function runT1(preset: WorldPresetId, cs: number, seed = SEED, stopAt: MilestoneIdx = 6, maxDays = 365 * 16): GameStateV2 {
  CAL_SHIFT[preset] = cs;
  const s = refGame(defaultSetupV2({ world: preset, alignment: 'medium', seed }));
  return runRef(s, maxDays, (x) => x.player.milestoneDays[stopAt] !== undefined);
}
const lastIdx = (p: T1Preset): MilestoneIdx => (p === 'slow' ? 3 : 6);

/** Worst |Δ| in years over SC … last milestone for a calShift. */
function worstErr(preset: T1Preset, cs: number): number {
  const s = runT1(preset, cs, SEED, lastIdx(preset));
  const g = golden.presets[preset].days;
  let worst = 0;
  for (let i = 3; i <= lastIdx(preset); i++) {
    const want = g[NAMES[i]];
    if (want === undefined) continue;
    const got = s.player.milestoneDays[i as MilestoneIdx];
    worst = Math.max(worst, got === undefined ? 99 : Math.abs(got - want) / 365);
  }
  return worst;
}

/** Bisect calShift so RefBot's SC day equals the golden SC day (SC day decreases with calShift). SC(calShift) is a
 *  step function (discrete runs), so the bisection lands on a step; refine on a ±0.03 grid by the worst |Δ| over
 *  SC … ASI. */
function fit(preset: T1Preset): number {
  const want = golden.presets[preset].days.SC;
  let lo = -1;
  let hi = 3;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    const sc = runT1(preset, mid, SEED, 3).player.milestoneDays[3] ?? 1e9;
    if (sc > want) lo = mid;
    else hi = mid;
  }
  const c0 = Math.round(((lo + hi) / 2) * 1000) / 1000;
  let best = c0;
  let bestErr = worstErr(preset, c0);
  for (let d = -0.03; d <= 0.0301; d += 0.01) {
    const c = Math.round((c0 + d) * 1000) / 1000;
    const e = worstErr(preset, c);
    if (e < bestErr - 1e-6) {
      best = c;
      bestErr = e;
    }
  }
  console.log(`  ${preset}: bisection ${c0}, refined ${best} (worst |Δ| ${bestErr.toFixed(3)} y)`);
  return best;
}

if (process.argv.includes('--fit')) {
  const out: Record<string, number> = {};
  // `--fit [preset …]`: all T1 presets, or only the ones named after --fit.
  const named = process.argv.slice(process.argv.indexOf('--fit') + 1).filter((p): p is T1Preset => (T1_PRESETS as string[]).includes(p));
  for (const p of named.length ? named : T1_PRESETS) {
    out[p] = fit(p);
    console.log(`calShift ${p} = ${out[p]}`);
  }
  console.log(`CAL_SHIFT = ${JSON.stringify(out)}  (sampled: use the ai2027 value)`);
  process.exit(0);
}

// ---------- T1L helpers: the simulated leader lab with a passive player ----------
/** New game with the leader lab on (LEADER_CAL[preset] = lc), ticked with no player actions (endings skipped) until
 *  the leader records milestone `stopAt`. Returns the leader's milestone days. */
function runT1L(preset: T1Preset, lc: number, stopAt: MilestoneIdx, seed = SEED): Partial<Record<MilestoneIdx, number>> {
  LEADER_CAL[preset] = lc;
  const s = newGame(defaultSetupV2({ world: preset, alignment: 'medium', seed, tutorial: false, leaderLab: true }));
  const L = s.rivals.find((r) => r.core.id === LEADER_ID);
  if (!L) throw new Error('T1L: no leader lab');
  while (s.time.day < 365 * 16 && L.core.milestoneDays[stopAt] === undefined && L.core.status === 'active') tick(s, { skip: ['endings'] });
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
/** Bisect LEADER_CAL so the leader's SC day equals the golden SC day (SC day rises with the lag). The simple leader
 *  runs A2 → SC faster and SC → ASI slower than RefBot, so the SC root over-delays the late milestones: refine on a
 *  grid below and around it by the worst |Δ|/tolerance over SC … last (0.025 steps, then 0.005). */
function fitLeader(preset: T1Preset): number {
  const want = golden.presets[preset].days.SC;
  let lo = -0.5;
  let hi = 1;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const sc = runT1L(preset, mid, 3)[3] ?? 1e9;
    if (sc < want) lo = mid;
    else hi = mid;
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
  for (let d = -0.15; d <= 0.0501; d += 0.025) tryAt(c0 + d);
  const mid = best;
  for (let d = -0.02; d <= 0.0201; d += 0.005) tryAt(mid + d);
  console.log(`  ${preset}: bisection ${c0}, refined ${best} (worst |Δ|/tol ${bestErr.toFixed(2)})`);
  return best;
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

// ---------- --fit-tree (R4): reference efforts of RefBot's tree projects ----------
// RefBot starts each project when the old gate would have opened (bots/ref.ts REF_TREE). Before R4 a project took a
// fixed number of days at RefBot's staffing (30 FTE + 2% of the experiment pool); now it takes effort / (M · √capacity).
// The fit scales each node's effort (standard-team-months at M = 1) until every RefBot attempt (first and retries)
// lasts its old duration, so adoption days stay where they were (D3: absolute M, fitted on RefBot). Presets: the named
// ones (default ai2027); several presets combine by the geometric mean of their ratios. Prints `effortTM` values to
// paste into src/data/v2/tree.ts.
/** Pre-R4 effortDays of RefBot's paradigm projects (data/v2/paradigms.ts before R4). */
const OLD_EFFORT_DAYS: Record<string, number> = { P05: 60, P07: 60, P08: 150, P13: 150, P17: 120 };
function attemptDurations(preset: T1Preset): Record<string, number[]> {
  const s = refGame(defaultSetupV2({ world: preset, alignment: 'medium', seed: SEED }));
  const start: Record<string, number> = {};
  const out: Record<string, number[]> = {};
  const stop = lastIdx(preset);
  runRef(s, 365 * 16, (x) => {
    for (const id of Object.keys(OLD_EFFORT_DAYS)) {
      const st = x.player.tree[id];
      if (!st) continue;
      const k = `${id}@${st.attempts ?? 1}`;
      if (st.status === 'researching' && start[k] === undefined) start[k] = x.time.day;
      // First two attempts only: later retries depend on the 'runs' stream draw and would make the fit chase noise.
      if (st.status !== 'researching' && start[k] !== undefined && st.day === x.time.day && (st.attempts ?? 1) <= 2) (out[id] ??= []).push(x.time.day - start[k] + 1);
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
        const mean = ds.reduce((a, x) => a + x, 0) / ds.length;
        (logR[id] ??= []).push(Math.log(OLD_EFFORT_DAYS[id] / Math.max(1, mean)));
        rows.push(`${p}:${id} ${ds.join('/')} d`);
      }
    }
    console.log(`  iter ${iter}: ${rows.join('  ')}`);
    let worst = 0;
    for (const [id, lr] of Object.entries(logR)) {
      const ratio = Math.exp(lr.reduce((a, x) => a + x, 0) / lr.length);
      worst = Math.max(worst, Math.abs(Math.log(ratio)));
      const n = TREE_BY_ID[id];
      // Damped (the projects share teams, so a full step makes P08 and P13 alternate).
      n.effortTM = Math.round(effortOf(n) * Math.pow(ratio, 0.6) * 100) / 100;
    }
    if (worst < 0.02) break;
  }
  console.log(`effortTM = ${JSON.stringify(Object.fromEntries(Object.keys(OLD_EFFORT_DAYS).map((id) => [id, TREE_BY_ID[id].effortTM])))}`);
  process.exit(0);
}

// ---------- T1 ----------
Object.assign(KNOWN, {
  'T1 ai2027 A1': 'Before continual learning RefBot\'s deployed model lags its know-how by 0.5–0.9 y (base staleness, κ, version age), more than the post-stream lag calShift is fitted to; early milestones are informational (§7.1 binds SC and later).',
  'T1 ai2027 A2': 'see T1 ai2027 A1',
  'T1 authors2026 A1': 'see T1 ai2027 A1', 'T1 authors2026 A2': 'see T1 ai2027 A1',
  'T1 fast A1': 'see T1 ai2027 A1', 'T1 fast A2': 'see T1 ai2027 A1',
  'T1 slow A1': 'see T1 ai2027 A1', 'T1 slow A2': 'see T1 ai2027 A1',
});
const table: string[] = [];
for (const preset of T1_PRESETS) {
  const cs = CAL_SHIFT[preset];
  const t0 = performance.now();
  const s = runT1(preset, cs, SEED, lastIdx(preset));
  const g = golden.presets[preset].days;
  const row: string[] = [];
  NAMES.forEach((n, i) => {
    if (i === 0) return;
    const want = g[n];
    if (want === undefined) return;
    const got = s.player.milestoneDays[i as MilestoneIdx];
    const tol = (i === 3 ? GOLDEN_TOL.SC : GOLDEN_TOL.after) * 365;
    const dy = got === undefined ? NaN : (got - want) / 365;
    row.push(`${n} ${got === undefined ? '—' : yearOf(got).toFixed(3)} (${Number.isNaN(dy) ? '—' : (dy >= 0 ? '+' : '') + dy.toFixed(3)})`);
    if (i < 3) check(got !== undefined && Math.abs(got - want) <= tol, `T1 ${preset} ${n}`, `got ${got ?? '—'} want ${want} ±${Math.round(tol)} d`);
    else check(got !== undefined && Math.abs(got - want) <= tol, `T1 ${preset} ${n}`, `got ${got ?? '—'} (${got === undefined ? '' : yearOf(got)}) want ${want} (${yearOf(want)}) ±${Math.round(tol)} d`);
  });
  table.push(`${preset.padEnd(12)} calShift ${cs.toFixed(3)}  ${row.join('  ')}  [${(performance.now() - t0).toFixed(0)} ms]`);
}
console.log('\nT1 RefBot milestone years (Δ vs golden, years):');
for (const r of table) console.log('  ' + r);

// ---------- T1L: the leader lab (passive player) hits the golden days; SC and later bind, A1/A2 informational ----------
{
  const tableL: string[] = [];
  for (const preset of T1_PRESETS) {
    const lc = LEADER_CAL[preset];
    const t0 = performance.now();
    const md = runT1L(preset, lc, lastIdx(preset));
    const g = golden.presets[preset].days;
    const row: string[] = [];
    NAMES.forEach((n, i) => {
      if (i === 0) return;
      const want = g[n];
      if (want === undefined) return;
      const got = md[i as MilestoneIdx];
      const dy = got === undefined ? NaN : (got - want) / 365;
      row.push(`${n} ${got === undefined ? '—' : yearOf(got).toFixed(3)} (${Number.isNaN(dy) ? '—' : (dy >= 0 ? '+' : '') + dy.toFixed(3)})`);
      if (i < 3) return;
      const tol = (i === 3 ? GOLDEN_TOL.SC : GOLDEN_TOL.after) * 365;
      check(got !== undefined && Math.abs(got - want) <= tol, `T1L ${preset} ${n}`, `got ${got ?? '—'} (${got === undefined ? '' : yearOf(got)}) want ${want} (${yearOf(want)}) ±${Math.round(tol)} d`);
    });
    tableL.push(`${preset.padEnd(12)} LEADER_CAL ${lc.toFixed(3)}  ${row.join('  ')}  [${(performance.now() - t0).toFixed(0)} ms]`);
  }
  console.log('\nT1L leader lab milestone years (passive player; Δ vs golden, years):');
  for (const r of tableL) console.log('  ' + r);
}

// ---------- T1 integrated (M2, informational): RefBot with real compute, finance and revenue ----------
// Same RefBot model policy, but compute is bought by WS3's autopilot under real cash, revenue is WS5's and every system
// is live (endings skipped so the timeline can be read to ASI). §7.1 binds T1 on the stub; this table shows how far
// money and the market move it (M2 report: flag anything > 3 months).
if (!process.argv.includes('--no-integrated')) {
  console.log('\nT1 integrated RefBot (real finance; Δ vs golden, years):');
  for (const preset of T1_PRESETS) {
    const t0 = performance.now();
    const s = newGame(defaultSetupV2({ world: preset, alignment: 'medium', seed: SEED, tutorial: false }));
    const stop = lastIdx(preset);
    while (s.time.day < 365 * 16 && s.player.milestoneDays[stop] === undefined && s.player.status === 'active') {
      for (const p of [...s.events.pending]) {
        const c = refBot.decide(s, p);
        if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
      }
      refBot.act(s, engine);
      tick(s, { skip: ['endings'] });
    }
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

// ---------- T2: copies × speed in Mar 2027 ----------
{
  CAL_SHIFT.ai2027 = CAL_SHIFT.ai2027; // hard-coded value
  const s = refGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: SEED }));
  runRef(s, dayOfDate(START_DATE, '2027-03-15'));
  const lab = s.player.prodCache!.labor;
  check(lab.copies >= 140e3 && lab.copies <= 260e3, 'T2 copies Mar 2027 ≈ 200k (±30%)', `${Math.round(lab.copies / 1000)}k`);
  check(lab.speed >= 21 && lab.speed <= 39, 'T2 speed Mar 2027 ≈ 30× (±30%)', `${lab.speed.toFixed(1)}×`);
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
  const stolen = (x: GameStateV2) => x.player.security.stolen.length + x.rivals.reduce((n, r) => n + r.core.security.stolen.length, 0) > 0;
  const leads: number[] = [];
  for (let d = 30; d <= 540; d += 30) {
    runRef(s, d, stolen);
    if (stolen(s)) break;
    leads.push(Math.round(trueLeadDays(s, 'china')));
  }
  if (leads.length < 18) console.log(`      T3: first theft on day ${s.time.day}; ${leads.length} monthly samples before it`);
  const mean = leads.reduce((a, x) => a + x, 0) / leads.length;
  // M2: informational. The stub pins China's compute to the reference path; with WS4's China compute (computeAbs) and
  // the WS1 distillation leak live, the binding T3 is the integrated one in scripts/v2/ws4.ts (CHINA_CAL is fit there).
  console.log(`INFO  T3 (stub compute) China mean lead before theft: ${mean.toFixed(0)} d; monthly ${leads.join(' ')}`);
}

finish('calib');
