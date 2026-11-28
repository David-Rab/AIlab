// F0 check: the reference software path S_ref next to G_ref (engine/v2/npc/reference.ts), for one run per timeline.
// Prints S_ref and G_ref - G(V0) at 2025.445 / 2026 / 2027 / 2028 / 2030, and checks G_ref - G(V0) - S_ref = log10 TC(t)/TC(2025.445) against the
// run's own training compute (aifm-runs/out/_scratch/fixc/f0_tc.json, made by `fixc_series.py tccheck`), S monotone, and the median software rate 2025.5 -> 2027 over all runs.
// Run: npx tsx scripts/v2/srefcheck.ts [path to f0_tc.json]
import { readFileSync, existsSync } from 'node:fs';
import { TIMELINE_PROGRESS, TIMELINE_SOFTWARE, SERIES_ANCHOR, SERIES_FROM, SERIES_STEP, SERIES_G0 } from '../../src/data/v2/timelineSeries';
import { refG, refS } from '../../src/engine/v2/npc/reference';

const stateOf = (world: string, index: number) => ({ setup: { world }, hidden: { timeline: { aifmRun: { index, id: '' } } } }) as never;
const tcPath = process.argv[2] ?? '../aifm-runs/out/_scratch/fixc/f0_tc.json';
const tc: Record<string, { run: string; tc: number[] }> | undefined = existsSync(tcPath) ? JSON.parse(readFileSync(tcPath, 'utf8')) : undefined;
const tcAt = (a: number[], t: number) => { // same grid, interpolation and anchor (0) as the series
  if (t <= SERIES_ANCHOR) return 0;
  if (t <= SERIES_FROM) return a[0] * (t - SERIES_ANCHOR) / (SERIES_FROM - SERIES_ANCHOR);
  const x = (t - SERIES_FROM) / SERIES_STEP;
  if (x >= a.length - 1) return a[a.length - 1];
  const i = Math.floor(x); return a[i] + (a[i + 1] - a[i]) * (x - i);
};
let fails = 0; const check = (ok: boolean, msg: string) => { if (!ok) { fails++; console.log('FAIL', msg); } };
const YEARS = [2025.445, 2026, 2027, 2028, 2030];
for (const tl of ['fast', 'central', 'slow'] as const) {
  const index = 100, s = stateOf(`tl-${tl}`, index), g0 = SERIES_G0[tl];
  console.log(`${tl}[${index}]${tc ? ' ' + tc[`${tl}:${index}`].run : ''}   t: ${YEARS.join('  ')}`);
  console.log('  S_ref        ' + YEARS.map(y => refS(s, y)!.toFixed(4).padStart(9)).join(' '));
  console.log('  G_ref-G(V0)  ' + YEARS.map(y => (refG(s, y)! - g0).toFixed(4).padStart(9)).join(' '));
  if (tc) {
    const a = tc[`${tl}:${index}`].tc; let worst = 0, worstRatio = 0;
    for (let y = 2025.445; y < 2035; y += 0.05) {
      const d = refG(s, y)! - g0 - refS(s, y)! - tcAt(a, y);
      const bound = 5.1e-4 * (Math.abs(refG(s, y)! - g0) + Math.abs(refS(s, y)!)) + 1e-9; // the tables hold 4 significant digits
      worst = Math.max(worst, Math.abs(d)); worstRatio = Math.max(worstRatio, Math.abs(d) / bound);
    }
    console.log(`  G_ref-G(V0)-S_ref vs log10 TC growth: max |diff| ${worst.toExponential(2)} OOM, = ${worstRatio.toFixed(2)} of the 4-significant-digit rounding bound of P and S`);
    check(worstRatio <= 1, `${tl}: G-S matches training compute growth`);
  }
}
for (const tl of ['fast', 'central', 'slow'] as const) {
  const S = TIMELINE_SOFTWARE[tl], P = TIMELINE_PROGRESS[tl], n = S.length;
  check(P.length === n, `${tl}: one software series per run`);
  let nonMono = 0, lenBad = 0; const rates: number[] = [];
  for (let i = 0; i < n; i++) {
    if (S[i].length !== P[i].length) lenBad++;
    for (let k = 1; k < S[i].length; k++) if (S[i][k] < S[i][k - 1]) { nonMono++; break; }
    const s = stateOf(`tl-${tl}`, i); rates.push((refS(s, 2027)! - refS(s, 2025.5)!) / 1.5);
  }
  rates.sort((a, b) => a - b);
  check(nonMono === 0 && lenBad === 0, `${tl}: S monotone non-decreasing (${nonMono} runs not), same lengths as progress (${lenBad} not)`);
  console.log(`${tl}: ${n} runs, median software rate 2025.5 -> 2027 = ${rates[n >> 1].toFixed(3)} OOM/yr (p10 ${rates[Math.floor(n * 0.1)].toFixed(3)}, p90 ${rates[Math.floor(n * 0.9)].toFixed(3)})`);
}
check(refS(stateOf('std', 0), 2030) === undefined, 'a world without a draw gives undefined');
console.log(fails ? `${fails} FAILED` : 'all checks passed'); process.exit(fails ? 1 : 0);
