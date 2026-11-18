// Model v3 V1 capability core (design/V3-BUILD.md V1.6; MODEL-V3 §2–§4; research/20 §A, §C). Owner: WS1.
//   Physical quantities: FLOP = 6ND; overtraining and repetition as effective-compute fractions; RL curve monotone and
//   bounded by its ceiling; distillation never above the teacher; continued pretraining adds effective compute; wall
//   time ∝ 1/compute with no floor; a fixed physical run gives the same G whatever its start date (the v2 calendar
//   bug); the start state (V0 at research/12's G ≈ 28.0, pm(V0) = the reference start for every start type).
import { DOMAIN_IDS } from '../../src/data/v2/calibration';
import { COGNITIVE, REFERENCE_BASE, REFERENCE_POST, RL_BUDGET } from '../../src/data/v2/runDesign';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { gOfBuild, gV0, playerStart } from '../../src/engine/v2/models/capability';
import {
  REF_RL_PROFILE, continueGPre, distillGap, effectiveTokens, fData, fOver, flopOfDesign, rlCeiling, rlFamiliesAvailable, rlGains, rlWeights, trainFlop,
} from '../../src/engine/v2/models/effective';
import { planRun } from '../../src/engine/v2/models/runs';
import { referenceRate } from '../../src/engine/v2/world/calibration';
import { START_BY_ID } from '../../src/data/v2/starts';
import type { GameStateV2 } from '../../src/engine/v2/types';
import { check, finish, runTo } from './lib';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// ---------- pretraining arithmetic ----------
check(trainFlop(1e12, 5e13) === 3e26 && flopOfDesign(REFERENCE_BASE) === 3e26, 'FLOP = 6 · N · D (reference base 1T × 50T tokens = 3e26)', `${flopOfDesign(REFERENCE_BASE).toExponential(2)}`);
check(near(fOver(20), 1, 1e-12) && near(fOver(200), 0.6, 0.04) && near(fOver(2000), 0.16, 0.01), 'f_over: compute-optimal 1, 10× overtrained ≈ 0.6, 100× ≈ 0.16 (R20 A1)',
  `${fOver(20).toFixed(2)} / ${fOver(200).toFixed(3)} / ${fOver(2000).toFixed(3)}`);
const N = 1e12;
const D = 5e13;
const f4 = fData(N, D, D / 4);
const f16 = fData(N, D, D / 16);
// Muennighoff: the value of a repeated token decays as e^(−(ep−1)/15.4): ≈ free to 4 epochs, little beyond ~16.
const marginal = (ep: number) => (effectiveTokens(D * 1.001, D / ep) - effectiveTokens(D, D / ep)) / (D * 0.001);
check(f4 >= 0.93 && fData(N, D, D) === 1, 'repetition: 4 epochs ≈ free (≥ 93% of the compute\'s value), none below 1 epoch', `4 ep ${f4.toFixed(3)}, 16 ep ${f16.toFixed(3)}`);
check(marginal(4) > 0.8 && marginal(16) < 0.4 && marginal(48) < 0.06, 'repetition: a repeated token is worth < 40% of a fresh one at 16 epochs, ≈ nothing by 48 (R* 15.4)',
  `marginal 4 ep ${marginal(4).toFixed(2)}, 16 ep ${marginal(16).toFixed(2)}, 48 ep ${marginal(48).toFixed(3)}`);
check(f16 < f4 && fData(N, D, D / 64) < f16, 'repetition: more epochs, less effective compute');

// ---------- RL curve ----------
const avail = rlFamiliesAvailable(() => false);
const wBroad = rlWeights('broad', avail);
check(near(Object.values(wBroad).reduce((a, x) => a + (x ?? 0), 0), 1, 1e-9) && !wBroad.computerUse, 'RL weights: broad = equal over the families with environments (computer use needs P06)');
const wFocus = rlWeights(['swe'], avail);
check(near(wFocus.swe ?? 0, 0.7, 1e-9), 'RL weights: one focus family gets 70%');
const F0 = 3e26;
let mono = true;
let bounded = true;
let prev = -1;
for (const rho of [0.001, 0.01, 0.03, 0.1, 0.15, 0.4, 1, 3, 10, 100]) {
  const g = rlGains(F0, rho * F0, wBroad, 0);
  if (g.general < prev - 1e-12) mono = false;
  prev = g.general;
  for (const d of DOMAIN_IDS) if (g.perDomain[d] > g.ceiling + 1e-9) bounded = false;
}
check(mono && bounded, 'RL curve: monotone in RL compute and bounded by the ceiling A', `at 100× ρ: ${prev.toFixed(3)} ≤ A ${rlCeiling(F0).toFixed(2)}`);
const ref = rlGains(F0, RL_BUDGET.standard * F0, wBroad, 0).general;
check(near(ref, 0.7, 0.005), 'RL: the reference run (standard, broad) gains ≈ 0.7 OOM at the start recipe', ref.toFixed(3));
check(rlGains(F0, RL_BUDGET.standard * F0, wBroad, 0.5).general > ref && rlGains(F0, RL_BUDGET.standard * F0, wBroad, 0.5).ceiling === rlGains(F0, 1, wBroad, 0).ceiling,
  'RL: a better RL recipe moves the midpoint, not the ceiling');
check(rlCeiling(10 * F0) > rlCeiling(F0), 'RL: a bigger base raises the ceiling');
const sweFocus = rlGains(F0, RL_BUDGET.standard * F0, wFocus, 0);
check(sweFocus.perDomain.CODE > rlGains(F0, RL_BUDGET.standard * F0, wBroad, 0).perDomain.CODE, 'RL: a SWE focus raises CODE above broad RL');
const meanProfile = COGNITIVE.reduce((a, d) => a + REF_RL_PROFILE[d], 0) / COGNITIVE.length;
check(near(meanProfile, 0, 1e-9), 'RL: the reference profile has zero mean over the cognitive domains');

// ---------- distillation and continued pretraining ----------
let neverAbove = true;
for (const r of [1, 1.2, 2, 4, 8, 32, 1000]) for (const tok of [1e9, 1e11, 1e13]) if (distillGap(1e12, 1e12 / r, tok) < 0) neverAbove = false;
check(neverAbove, 'distillation: the gap is never negative (a student is never above its teacher)');
check(distillGap(37e9, 32e9, 20 * 32e9) < distillGap(37e9, 7e9, 20 * 7e9) && distillGap(37e9, 7e9, 20 * 7e9) < distillGap(37e9, 1.5e9, 20 * 1.5e9),
  'distillation: smaller students land further below (R1 32B / 7B / 1.5B)', [32e9, 7e9, 1.5e9].map((n) => distillGap(37e9, n, 20 * n).toFixed(2)).join(' / '));
check(continueGPre(27.3, 1e26, 1.38, 'moe') > 27.3 && continueGPre(27.3, 0, 1.38, 'moe') === 27.3, 'continue: added FLOP adds effective compute (0 adds nothing)');
check(near(continueGPre(27.3, 3e26, 1.38, 'moe') - continueGPre(27.3, 3e26, 0.38, 'moe'), 0, 1) && continueGPre(27.3, 3e26, 1.38, 'moe') > continueGPre(27.3, 3e26, 0.38, 'moe'),
  'continue: today\'s recipe applies to the added part only');

// ---------- start state ----------
const s0 = newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, tutorial: false }));
const w0 = s0.hidden.timeline;
const V0 = s0.player.models.versions[0];
check(near(gV0(w0), 28.0, 0.1) && near(gOfBuild(V0.build!), gV0(w0), 1e-9), 'start: V0 at G ≈ 28.0 (research/12 Aug-2025 anchor), incl. ≈ 0.7 OOM RL', `G ${gOfBuild(V0.build!).toFixed(3)}, RL ${V0.build!.dgRL.toFixed(2)}`);
check(near(V0.pm, playerStart(w0).target, 1e-9), 'start: pm(V0) is the reference start (Φ pinned)');
check(Object.values(V0.build!.off).every((x) => Math.abs(x ?? 0) < 0.25), 'start: the reference recipe reproduces the 2025 domain profile (|off| < 0.25 L)', JSON.stringify(Object.fromEntries(Object.entries(V0.build!.off).map(([k, v]) => [k, +(v ?? 0).toFixed(2)]))));
for (const start of ['challenger', 'bigtech', 'spinout'] as const) {
  const t = newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, start, tutorial: false }));
  const ps = playerStart(t.hidden.timeline);
  const want = ps.target - (START_BY_ID[start].lagMonths / 12) * referenceRate(t.hidden.timeline, ps.target, 2025.5);
  check(near(t.player.models.versions[0].pm, want, 1e-6), `start: ${start} V0 lags by its start lag (pm ${want.toFixed(3)})`, t.player.models.versions[0].pm.toFixed(4));
}

// ---------- durations ----------
const base = (s: GameStateV2, params: number) => planRun(s, { kind: 'base', base: { ...REFERENCE_BASE, params, curation: { ...REFERENCE_BASE.curation } }, poolShare: 0.6 });
const sA = newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, tutorial: false }));
const sB = newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, tutorial: false }));
sB.player.computeOnline *= 2;
const a = base(sA, 2e12);
const b = base(sB, 2e12);
const trainDays = (p: ReturnType<typeof base>) => p.etaDays - p.setupDays;
check(near(trainDays(a) / trainDays(b), 2, 0.05), 'wall time ∝ 1/compute (2× the pool halves the training days)', `${trainDays(a)} d → ${trainDays(b)} d`);
const tiny = base(sA, 1e9);
check(trainDays(tiny) <= 1, 'no minimum length: a tiny base trains in a day', `${tiny.etaDays} d incl. ${tiny.setupDays} d setup`);
const post = planRun(sA, { kind: 'post', baseId: 'B0', post: { ...REFERENCE_POST, techniques: [], trainAgainst: [] }, poolShare: 0.5 });
check(post.etaDays - post.setupDays < 30 && post.flopNeeded === RL_BUDGET.standard * sA.player.models.bases[0].flop, 'post-training: RL FLOP = ρ × base FLOP; no minimum days', `${post.flopNeeded.toExponential(2)} FLOP, ${post.etaDays} d`);

// ---------- the v2 calendar bug: same physical run, same G at any start date ----------
const sC = newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, tutorial: false }));
const g0 = base(sC, 2e12).limits!.gPre.total;
const pa0 = sC.player.pa;
const assets0 = { ...sC.player.dataAssets };
runTo(sC, 500, { skip: ['endings'] });
sC.player.pa = pa0;
sC.player.dataAssets = { ...assets0 };
const g500 = base(sC, 2e12).limits!.gPre.total;
check(near(g0, g500, 1e-9), 'a fixed physical run at fixed know-how gives the same G on day 0 and day 500 (no F(t))', `${g0.toFixed(4)} vs ${g500.toFixed(4)}`);

finish('effective');
