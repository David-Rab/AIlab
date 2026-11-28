// Model v3 V1 capability core (design/archive/V3-BUILD.md V1.6; MODEL-V3 §2–§4; research/20 §A, §C). Owner: WS1.
//   Physical quantities: FLOP = 6ND; overtraining and repetition as effective-compute fractions; RL curve monotone and
//   bounded by its ceiling; distillation never above the teacher; continued pretraining adds effective compute; wall
//   time ∝ 1/compute with no floor; a fixed physical run gives the same G whatever its start date (the v2 calendar
//   bug); the start state (V0 at research/12's G ≈ 28.0, pm(V0) = the reference start for every start type).
import { DOMAIN_IDS } from '../../src/data/v2/calibration';
import { WORK_TYPES, skillRefDelta as refDelta } from '../../src/data/v2/workTypes';
import { COGNITIVE, REFERENCE_BASE, REFERENCE_POST, RL_BUDGET } from '../../src/data/v2/runDesign';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { domainRefShift, domainsOf, gOfBuild, gV0, levelOfG, skillMarks } from '../../src/engine/v2/models/capability';
import { postEffect } from '../../src/engine/v2/models/design';
import { domainG, fitOf } from '../../src/engine/v2/departments/workfit';
import { clamp } from '../../src/engine/rng';
import { PRE_GAME_G_PER_YEAR } from '../../src/data/v2/runDesign';
import {
  REF_RL_PROFILE, continueGPre, distillGap, effectiveTokens, fData, fOver, flopOfDesign, rlCeiling, rlFamiliesAvailable, rlGains, rlWeights, trainFlop,
} from '../../src/engine/v2/models/effective';
import { planRun } from '../../src/engine/v2/models/runs';
import { START_BY_ID } from '../../src/data/v2/starts';
import type { DomainId, GameStateV2, ModelVersion } from '../../src/engine/v2/types';
import { check, finish, runTo } from './lib';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

// ---------- pretraining arithmetic ----------
check(trainFlop(1e12, 5e13) === 3e26 && flopOfDesign(REFERENCE_BASE) === 3e26, 'FLOP = 6 · N · D (reference base 354B × 400 tokens per parameter = 3e26)', `${flopOfDesign(REFERENCE_BASE).toExponential(2)}`);
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
// CP3g: the base dependence lives in the midpoint (∝ FLOP_pre^0.5, a fixed episode count; research/RD-RL-scaling.md §5):
// at the same budget share a 10× base gains more, sub-linearly (≈ +0.08 G, not the ≈ +0.3 of an absolute midpoint).
{
  const g1 = rlGains(10 * F0, RL_BUDGET.standard * 10 * F0, wBroad, 0).general;
  check(g1 > ref && g1 - ref < 0.2, 'RL: at the same share a bigger base gains more, sub-linearly (midpoint ∝ FLOP_pre^0.5)', `10× base ${g1.toFixed(3)} vs ${ref.toFixed(3)}`);
}
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
const s0 = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, tutorial: false }));
const w0 = s0.hidden.timeline;
const V0 = s0.player.models.versions[0];
// A6b: B0 is overtrained like 2025 production models (400 tokens per parameter): research/12's Aug-2025 anchor 28.0 was
// fitted at 50, so V0 sits the overtraining factor lower (log₁₀ f_over(400) − log₁₀ f_over(50) = −0.31 OOM), no new term.
check(near(gV0(w0), 28.0 - 0.307, 0.1) && near(gOfBuild(V0.build!), gV0(w0), 1e-9), 'start: V0 at G ≈ 27.7 (research/12 Aug-2025 anchor 28.0 less the overtraining of a 400-tokens-per-parameter base), incl. ≈ 0.7 OOM RL', `G ${gOfBuild(V0.build!).toFixed(3)}, RL ${V0.build!.dgRL.toFixed(2)}`);
check(V0.G === gOfBuild(V0.build!), 'start: G(V0) is its build\'s G (the reference start)');
const v0Off = Object.fromEntries(DOMAIN_IDS.map((d) => [d, V0.domains[d] - Math.min(15, Math.max(0, levelOfG(w0, V0.G - domainRefShift(w0, d))))]));
check(Object.values(v0Off).every((x) => Math.abs(x) < 0.25), 'start: the reference recipe reproduces the reference-point domain profile (|L_d − λ(G − shift_d)| < 0.25 L, RD-U05)', JSON.stringify(Object.fromEntries(Object.entries(v0Off).map(([k, v]) => [k, +v.toFixed(2)]))));
for (const start of ['challenger', 'bigtech', 'spinout'] as const) {
  const t = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, start, tutorial: false }));
  const want = gV0(t.hidden.timeline) - (START_BY_ID[start].lagMonths / 12) * PRE_GAME_G_PER_YEAR;
  check(near(t.player.models.versions[0].G, want, 1e-6), `start: ${start} V0 lags by its start lag (G ${want.toFixed(3)})`, t.player.models.versions[0].G.toFixed(4));
}

// ---------- durations ----------
const base = (s: GameStateV2, params: number) => planRun(s, { kind: 'base', base: { ...REFERENCE_BASE, params, curation: { ...REFERENCE_BASE.curation } }, poolShare: 0.6 });
const sA = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, tutorial: false }));
const sB = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, tutorial: false }));
sB.player.computeOnline *= 2;
const a = base(sA, 2e12);
const b = base(sB, 2e12);
const trainDays = (p: ReturnType<typeof base>) => p.etaDays - p.setupDays;
check(near(trainDays(a) / trainDays(b), 2, 0.05), 'wall time ∝ 1/compute (2× the pool halves the training days)', `${trainDays(a)} d → ${trainDays(b)} d`);
const tiny = base(sA, 1e9);
check(trainDays(tiny) <= 1, 'no minimum length: a tiny base trains in a day', `${tiny.etaDays} d incl. ${tiny.setupDays} d setup`);
const post = planRun(sA, { kind: 'post', baseId: 'B0', post: { ...REFERENCE_POST, methods: [] }, poolShare: 0.5 });
check(post.etaDays - post.setupDays < 30 && post.flopNeeded === RL_BUDGET.standard * sA.player.models.bases[0].flop, 'post-training: RL FLOP = ρ × base FLOP; no minimum days', `${post.flopNeeded.toExponential(2)} FLOP, ${post.etaDays} d`);

// ---------- the v2 calendar bug: same physical run, same G at any start date ----------
const sC = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, tutorial: false }));
const g0 = base(sC, 2e12).limits!.gPre.total;
const assets0 = JSON.stringify(sC.player.dataPortfolio);
// V4.0: a new game runs its default research lines, so "fixed know-how" also holds the recipe stacks at day 0.
const stacks0 = JSON.parse(JSON.stringify(sC.player.research.stacks)) as typeof sC.player.research.stacks;
runTo(sC, 500, { skip: ['endings'] });
sC.player.dataPortfolio = JSON.parse(assets0) as typeof sC.player.dataPortfolio;
sC.player.research.stacks = stacks0;
const g500 = base(sC, 2e12).limits!.gPre.total;
check(near(g0, g500, 1e-9), 'a fixed physical run at fixed know-how gives the same G on day 0 and day 500 (no F(t))', `${g0.toFixed(4)} vs ${g500.toFixed(4)}`);

// ---------- one capability currency (RD-U01) and the domain reference points (RD-U05; merged from currency.ts, domainref.ts) ----------
// Design offsets are domain ΔG in OOM; the displayed domain level is λ(G_d − shift_d) of the same G the work fit reads, shift_d the
// domain's best-human reference point; no level→OOM factor and no display offset table is left.
{
// 2. A version's displayed domain level equals λ(G_d) (less the domain's best-human shift, RD-U05), G_d the fit's domain G.
const s = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, tutorial: false }));
const w = s.hidden.timeline;
const V0 = s.player.models.versions[0];
const lam = (v: Pick<ModelVersion, 'G' | 'build'>, d: (typeof DOMAIN_IDS)[number]) => clamp(levelOfG(w, domainG(s, v, d) - domainRefShift(w, d)), 0, 15);
const err0 = Math.max(...DOMAIN_IDS.map((d) => Math.abs(V0.domains[d] - lam(V0, d))));
check(err0 < 1e-9, 'display: V0\'s domain levels are λ(G_d) of the fit\'s domain G', `max |L_d − λ(G_d)| ${err0.toExponential(1)}`);

// 3. A design offset (persuasion preference: SOCIAL) moves the fit and the display together.
const pe = postEffect({ ...V0.design, pref: 'persuasion' });
const v1 = { G: V0.G, build: { ...V0.build!, dgD: { ...pe.dgD } } };
const dG = domainG(s, v1, 'SOCIAL') - domainG(s, V0, 'SOCIAL');
const dFit = fitOf(s, v1, 'OTHER') - fitOf(s, V0, 'OTHER');
const wS = WORK_TYPES.OTHER.w.SOCIAL ?? 0;
const dom1 = domainsOf(w, v1.G, v1.build);
const dL = dom1.SOCIAL - V0.domains.SOCIAL;
const dLwant = lam(v1, 'SOCIAL') - lam(V0, 'SOCIAL');
check(near(dG, 0.8 / 1.2, 1e-3) && near(dFit, wS * dG, 1e-9) && near(dL, dLwant, 1e-9) && (dL > 0 || dom1.SOCIAL === 0)
  && DOMAIN_IDS.every((d) => d === 'SOCIAL' || near(dom1[d], V0.domains[d], 1e-12)),
  'design offset: persuasion adds 0.667 OOM to SOCIAL G (was 0.8 L ÷ 1.2: fit unchanged); fit and display move by the same G (the display may sit at its 0 floor, RD-U05)',
  `ΔG ${dG.toFixed(4)}, Δfit(OTHER) ${dFit.toFixed(4)} = ${wS} × ΔG, ΔL ${dL.toFixed(3)} = λ slope × ΔG`);

// 4. RSCH (RD-E01a deleted P19 and its RSCH gain): the fit's RSCH G is the build's domain G and the display reads λ of it.
const gR = domainG(s, V0, 'RSCH');
const domR = domainsOf(w, V0.G, V0.build);
check(near(domR.RSCH, clamp(levelOfG(w, gR - domainRefShift(w, 'RSCH')), 0, 15), 1e-9),
  'RSCH: the display is λ of the fit G (no P19 gain since RD-E01a)', `G_RSCH ${gR.toFixed(4)}, L_RSCH ${domR.RSCH.toFixed(3)}`);

}
{
for (const world of ['tl-fast', 'tl-central', 'tl-slow'] as const) {
  const s = newGame(defaultSetupV2({ world, alignment: 'medium', seed: 2027, tutorial: false }));
  const w = s.hidden.timeline;
  const rd = refDelta(w.v3.sdSC);
  const V0 = s.player.models.versions[0];
  // 2. The shift is the reference points' δ_d·Δ_bm; a model at a domain's best human scores 10 there.
  const shiftOk = DOMAIN_IDS.every((d) => near(domainRefShift(w, d), rd[d] * w.v3.dBM, 1e-12));
  const atBest = DOMAIN_IDS.every((d) => near(clamp(levelOfG(w, w.v3.gSC + rd[d] * w.v3.dBM - domainRefShift(w, d)), 0, 15), 10, 1e-9));
  // 3. V0's stored domain scores are λ(G_d − shift_d) of the fit's domain G.
  const err = Math.max(...DOMAIN_IDS.map((d) => Math.abs(V0.domains[d] - clamp(levelOfG(w, domainG(s, V0, d) - domainRefShift(w, d)), 0, 15))));
  check(shiftOk && atBest && err < 1e-9, `${world}: domain score = λ(G_d − δ_d·Δ_bm); 10 at each domain's best human; V0 stored = formula`,
    `Δ_bm ${w.v3.dBM}, V0 ${DOMAIN_IDS.map((d: DomainId) => `${d} ${V0.domains[d].toFixed(2)}`).join(' ')}`);
  // 2b. UB-1b (job scale): each skill bar's marks are the work fit's whole-job median expert and best human on the score;
  // V0 sits below both in every skill; a model at G_SC with the reference profile (the SC-era frontier) reads the best
  // human in coding and agency (10); every skill carries a test or a stand-in for the tooltip.
  const mk = DOMAIN_IDS.map((d) => [d, skillMarks(w, d)] as const);
  const scL = domainsOf(w, w.v3.gSC);
  const ok = mk.every(([d, m]) => m.median < m.best && m.test.length > 0 && V0.domains[d] < m.median) && near(skillMarks(w, 'CODE').best, 10, 1e-9) && near(scL.CODE, 10, 1e-9);
  check(ok, `${world}: skill-bar marks on the job scale (V0 below the median expert in every skill; SC model at the coding best human)`,
    mk.map(([d, m]) => `${d} ${m.median.toFixed(2)}/${m.best.toFixed(2)} (SC ${scL[d].toFixed(1)})${m.standIn ? '*' : ''}`).join(' '));
}

}

finish('effective');
