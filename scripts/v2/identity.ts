// Production-function acceptance tests P1–P3 (V2-SPEC §3.2.3, §7.1). Owner: WS1.
//   P1  identity: at h = 1 with reference research compute split in the best way between experiments and agents,
//       τ_h = 1, eff = mods = 1, M == multiplierAt(w, q) within 1e-9 (every preset, 200-point grid, two dates). The
//       AI 2027 table's own experiments/agents split (h = k = c = 1) is never better than the best mix.
//   P2  ai2027 knot table within 2% of research/13 §1.5 (A, R, ℓ_ref, X_ref, T_ref; sdAI ±0.1).
//   P3  elasticities at the reference points within ±0.02 of research/13 §1.6 (what-ifs and ceilings reported).
import { R13_AI2027_KNOTS } from '../../src/data/v2/calibration';
import { milestoneThresholds, multiplierAt, stage1 } from '../../src/data/world';
import { Rng } from '../../src/engine/rng';
import { defaultSetupV2 } from '../../src/engine/v2/core/init';
import { hash32 } from '../../src/engine/v2/core/rng';
import { Lrel, Xces, bestMix, bisect, buildKnotsDetailed, knotAt, tasteSD } from '../../src/engine/v2/production/knots';
import { shareRefAt } from '../../src/engine/v2/departments/split';
import { evalM, evalProduction, type LabInputs } from '../../src/engine/v2/production/production';
import { sampleHidden } from '../../src/engine/v2/world/hidden';
import type { TimelineWorld, WorldPresetId } from '../../src/engine/v2/types';
import { KNOWN, check, finish } from './lib';

const worldFor = (preset: WorldPresetId, seed: number): TimelineWorld =>
  sampleHidden(new Rng(hash32(seed, 'world')), defaultSetupV2({ world: preset, alignment: 'medium', seed })).timeline;

const refInputs = (q: number): LabInputs => ({
  qDep: q, yr: 2026, h: 1, k: 1, c: 1, d: 1, mixUnit: { c: 0.08 / 0.05, k: 0.08 / 0.03, C: 8e4, load: 0, off: false }, stock: 1, tasteHire: 1, eff: 1, mods: 1, rateMult: 1,
  abs: { H: 2050, Cagents: 3e4, Cexp: 5e4, serveCost: 0.5, tcoPerYr: 1.4e-5, staffCostPerYr: 0.8e-3 },
});

/** Reference resources at `yr` with the best experiments/agents mix. */
function bestRefInputs(w: TimelineWorld, q: number, yr: number): LabInputs {
  const kn = knotAt(w.prod.knots, q);
  const sh = shareRefAt(yr);
  const r = sh.experiments + sh.agents;
  const cu = r / sh.experiments;
  const ku = r / sh.agents;
  const f = bestMix(w.prod, kn.A, kn.R, 1, cu, ku).f;
  return { ...refInputs(q), yr, c: f * cu, k: (1 - f) * ku, mixUnit: { c: cu, k: ku, C: 8e4, load: 0, off: false } };
}

// ---------- P1 identity ----------
const worlds: [string, TimelineWorld][] = [
  ['ai2027', worldFor('ai2027', 1)], ['authors2026', worldFor('authors2026', 1)], ['fast', worldFor('fast', 1)], ['slow', worldFor('slow', 1)],
  ...[1, 2, 3, 4, 5].map((seed) => [`sampled#${seed}`, worldFor('sampled', seed)] as [string, TimelineWorld]),
];
for (const [name, w] of worlds) {
  const th = milestoneThresholds(w);
  const top = th[6] * 1.05;
  let worst = 0;
  let tableGap = 0;
  let tableWorse = 0;
  for (const yr of [2026, 2027.6]) {
    for (let i = 0; i < 200; i++) {
      const q = (i / 199) * top;
      const M = evalM(w, bestRefInputs(w, q, yr)).M;
      worst = Math.max(worst, Math.abs(M / multiplierAt(w, q) - 1));
      const Mtable = evalM(w, { ...refInputs(q), yr }).M;
      tableGap = Math.max(tableGap, 1 - Mtable / M);
      if (Mtable > M * (1 + 1e-6)) tableWorse++;
    }
  }
  check(worst <= 1e-9, `P1 identity ${name}`, `max rel err ${worst.toExponential(2)} over 2×200 points`);
  check(tableWorse === 0, `P1 best mix ≥ table mix ${name}`, `table split costs up to ${(tableGap * 100).toFixed(1)}% of M`);
  const kb = buildKnotsDetailed(w, w.prod);
  check(kb.ok, `knots valid ${name} (T_ref ≥ 1, monotone)`, kb.problems.join('; ') || `${kb.knots.length} knots`);
}

// ---------- P2 knot table ----------
const w = worldFor('ai2027', 1);
const P = w.prod;
const s1 = stage1(w);
const th = milestoneThresholds(w);
/** q of an R13 row: Stage-1 rows by f, Stage-2 rows where multiplierAt = M_ref. */
function qOfRow(at: string, Mref: number): number {
  if (at.startsWith('f=')) return Number(at.slice(2)) * s1;
  if (at === 'SC') return th[3];
  return bisect((q) => multiplierAt(w, q) - Mref, th[3], th[6], 200);
}
const R_DATES = 'research/13 dated its interpolated rows on its own calendar (f = 0.126 at 2025.75, …) while §3.2.4 step 1 dates knots with the v1 reference integrator (f = 0.125 at 2025.80); at 3.4×/yr compute that moves C_inf, hence R, by 5–7%. A, ℓ_ref, X_ref, T_ref and sdAI are within 2%; R at the computed rows (f = 0, 0.25, 0.5, 0.75, SC …) within 2%.';
Object.assign(KNOWN, { 'P2 knot f=0.126 R': R_DATES, 'P2 knot f=0.378 R': R_DATES, 'P2 knot f=0.656 R': R_DATES });
for (const row of R13_AI2027_KNOTS) {
  const q = qOfRow(row.at, row.Mref);
  const kn = knotAt(P.knots, q);
  const lRef = Math.pow(Lrel(P, kn.A, 1, kn.R), P.lam);
  const Xref = Xces(P, 1, lRef);
  const Mref = multiplierAt(w, q);
  const Tref = Mref / Xref;
  const sd = tasteSD(Tref, P.m2b);
  const rel = (a: number, b: number) => Math.abs(a / b - 1);
  const errs = { M: rel(Mref, row.Mref), A: rel(kn.A, row.A), R: rel(kn.R, row.R), l: rel(lRef, row.lRef), X: rel(Xref, row.Xref), T: rel(Tref, row.Tref) };
  const { R: errR, ...rest } = errs;
  const worst = Math.max(...Object.values(rest));
  const which = Object.entries(rest).sort((a, b) => b[1] - a[1])[0][0];
  check(worst <= 0.02 && Math.abs(sd - row.sdAI) <= 0.1, `P2 knot ${row.at}`, `A ${kn.A.toFixed(3)} ℓ ${lRef.toFixed(2)} X ${Xref.toFixed(2)} T ${Tref.toFixed(2)} sd ${sd.toFixed(2)} (worst ${which} ${(worst * 100).toFixed(1)}%)`);
  check(errR <= 0.02, `P2 knot ${row.at} R`, `R ${kn.R.toFixed(0)} vs ${row.R} (${(errR * 100).toFixed(1)}%)`);
}

// ---------- P3 elasticities ----------
const P3 = [
  { at: 'f=0', e: [0.39, 0.17, 0.04], wi: [1.1, 1.02, 0.73, 1.31, 0.76], ceil: [1.18, 1.02] },
  { at: 'f=0.25', e: [0.4, 0.16, 0.04], wi: [1.1, 1.02, 0.73, 1.32, 0.75], ceil: [1.17, 1.02] },
  { at: 'f=0.75', e: [0.43, 0.08, 0.1], wi: [1.04, 1.05, 0.69, 1.35, 0.74], ceil: [1.06, 1.07] },
  { at: 'SC', e: [0.45, 0.0, 0.16], wi: [1.0, 1.12, 0.68, 1.37, 0.73], ceil: [1.0, 8.7] },
  { at: 'SAR', e: [0.47, 0.0, 0.15], wi: [1.0, 1.11, 0.69, 1.38, 0.72], ceil: [1.0, 7.5] },
  { at: 'SIAR', e: [0.48, 0.0, 0.14], wi: [1.0, 1.1, 0.71, 1.39, 0.71], ceil: [1.0, 6.2] },
];
const MREF: Record<string, number> = { SC: 5, SAR: 25, SIAR: 250 };
for (const row of P3) {
  const q = qOfRow(row.at, MREF[row.at] ?? 0);
  const r = evalProduction(w, refInputs(q));
  const e = [r.elast.exp, r.elast.humans, r.elast.agents];
  const de = Math.max(...e.map((x, i) => Math.abs(x - row.e[i])));
  check(de <= 0.02, `P3 elasticities ${row.at}`, `exp ${e[0].toFixed(3)} humans ${e[1].toFixed(3)} agents ${e[2].toFixed(3)} (R13 ${row.e.join('/')})`);
  const wi = [r.whatIf.humans2, r.whatIf.agents2, r.whatIf.agents01, r.whatIf.exp2, r.whatIf.exp05];
  const dw = Math.max(...wi.map((x, i) => Math.abs(x - row.wi[i])));
  check(dw <= 0.03, `P3 what-ifs ${row.at} (±0.03)`, `2×H ${wi[0].toFixed(2)} 2×A ${wi[1].toFixed(2)} 0.1×A ${wi[2].toFixed(2)} 2×E ${wi[3].toFixed(2)} 0.5×E ${wi[4].toFixed(2)}`);
  console.log(`      ceilings ${row.at}: ∞ humans ×${r.ceilings.humans.toFixed(2)} (R13 ${row.ceil[0]}), ∞ agents ×${r.ceilings.agents.toFixed(2)} (R13 ${row.ceil[1]}), ∞ exp ×${r.ceilings.exp.toFixed(0)}; parts ${Object.values(r.parts).map((x) => x.toFixed(2)).join('·')} = ${r.M.toFixed(2)}`);
  check(Math.abs(r.ceilings.humans / row.ceil[0] - 1) <= 0.05 && Math.abs(r.ceilings.agents / row.ceil[1] - 1) <= 0.05, `P3 ceilings ${row.at} (±5%)`);
  const prod = r.parts.base * r.parts.agents * r.parts.taste * r.parts.other;
  check(Math.abs(prod / r.M - 1) < 1e-9, `parts multiply to M ${row.at}`);
}

finish('identity');
