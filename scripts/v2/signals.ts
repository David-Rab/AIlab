// Model v3 E3 training pressure from run quantities (design/MODEL-V3.md §11.2; src/engine/v2/safety/traits.ts). Owner: WS2.
//   Signals are functions of what a run does: RL compute ρ (share of the base's pretraining FLOP) and its split over the
//   RL families, the suites' exploitability (S2, × Gao's optimisation pressure), the agentic families' task lengths
//   (S3), the preference stage's share (S1), the base's G and the AI-related share of its drawn data (S5), the synthetic
//   or distilled share of the data (S6, teacher pull only within a base family), eval-like data (S7). ω (how much a run
//   moves traits) rises with the run's RL compute. The reference recipe at the start reproduces V1's design table.
import { REFERENCE_BASE, REFERENCE_POST, RL_BUDGET } from '../../src/data/v2/runDesign';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { planRun } from '../../src/engine/v2/models/runs';
import { suiteExploitMap, suiteRlWeights } from '../../src/engine/v2/models/suites';
import { playerDraw } from '../../src/engine/v2/production/data';
import {
  aiDataShare, applyRunToTraits, baseSignals, deploymentS8, distillSignals, hackRates, OMEGA_KIND, optimisationPressure, postSignals,
  prefShare, RHO_REF, runOmega, sameBaseFamily, syntheticShare, type Signals,
} from '../../src/engine/v2/safety/traits';
import type { BaseDesign, GameStateV2, ModelVersion, OwnedDataAsset, PostDesign, TrainingRun } from '../../src/engine/v2/types';
import { check, finish } from './lib';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const game = () => newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, tutorial: false }));
const post = (o: Partial<PostDesign> = {}): PostDesign => ({ ...REFERENCE_POST, techniques: [], trainAgainst: [], ...o });
const base = (o: Partial<BaseDesign> = {}): BaseDesign => ({ ...REFERENCE_BASE, curation: { ...REFERENCE_BASE.curation }, ...o });
const fmt = (sg: Partial<Signals>, keys = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'] as (keyof Signals)[]) => keys.map((k) => `${k} ${(sg[k] ?? 0).toFixed(3)}`).join(' ');
const s0 = game();
const B0 = s0.player.models.bases[0];
const bq = (s: GameStateV2, d: BaseDesign, gPre = B0.gPre) => ({ gPre, draw: playerDraw(s, d) });

// ---------- the reference recipe reproduces V1's signals ----------
const V1_POST: Partial<Signals> = { S1: 0.4, S2: 0.36, S3: 0.75, S4: 0, S5: 0.05, S6: 0.1, S7: 0.35 };
const ref = postSignals(s0, post());
check((Object.keys(V1_POST) as (keyof Signals)[]).every((k) => near(ref[k], V1_POST[k] ?? 0, 1e-9)) && ref.S8 === deploymentS8(s0),
  'reference post-train at the start reproduces V1\'s signals exactly (standard, broad on the six start suites, constitution)', fmt(ref));
const refBase = baseSignals(REFERENCE_BASE, bq(s0, REFERENCE_BASE));
check(near(refBase.S5, 0.28, 1e-3) && near(refBase.S6, 0.1, 1e-9),
  'reference base at the start (B0\'s G, the start portfolio) reproduces V1\'s S5 0.28 (0.2 + 0.1 × start tier 0.8) and S6 0.1', fmt(refBase, ['S5', 'S6']));
const om = runOmega(s0, { kind: 'post', name: 'post', baseId: 'B0', flopNeeded: RL_BUDGET.standard * B0.flop });
check(om.growth === OMEGA_KIND.post && om.safety === OMEGA_KIND.post && runOmega(s0, { kind: 'base', name: 'b', flopNeeded: 1 }).growth === 1
  && runOmega(s0, { kind: 'distill', name: 'd', flopNeeded: 1 }).growth === 0.4, 'reference ω per run kind is V1\'s (base 1, post 0.6, distill 0.4)', `post ${om.growth}`);

// ---------- S2 and ω: more RL FLOP on the same suites ----------
const rhos = [0.05, RHO_REF, 0.3, 0.6];
const s2s = rhos.map((rho) => postSignals(s0, post(), undefined, { rho }).S2);
const oms = rhos.map((rho) => runOmega(s0, { kind: 'post', name: 'post', baseId: 'B0', flopNeeded: rho * B0.flop }));
check(s2s.every((x, i) => i === 0 || x > s2s[i - 1]), 'more RL FLOP on the same suites raises S2 (Gao: over-optimisation rises with log optimisation)',
  rhos.map((r, i) => `ρ ${r}: ${s2s[i].toFixed(3)}`).join(', '));
check(near(optimisationPressure(RL_BUDGET.light), 0.5, 0.01) && near(optimisationPressure(RL_BUDGET.heavy), 1.3, 0.01),
  'the log form p(ρ) = 1 + 0.71·log₁₀(ρ/ρ_ref) passes through V1\'s budget table (light ×0.5, heavy ×1.3)',
  `${optimisationPressure(RL_BUDGET.light).toFixed(3)} / ${optimisationPressure(RL_BUDGET.heavy).toFixed(3)}`);
check(oms.every((x, i) => i === 0 || x.growth > oms[i - 1].growth) && oms.every((x) => x.safety === OMEGA_KIND.post),
  'more RL FLOP raises ω (trait movement); the safety-training side keeps the run kind\'s 0.6', oms.map((x) => x.growth.toFixed(3)).join(' < '));
const heavyPlan = planRun(s0, { kind: 'post', baseId: 'B0', post: post({ rlBudget: 'heavy' }) }).prediction.signals;
const stdPlan = planRun(s0, { kind: 'post', baseId: 'B0', post: post() }).prediction.signals;
check(heavyPlan.S2 > stdPlan.S2 && heavyPlan.S7 > stdPlan.S7, 'the run card (planRun) shows the heavy budget\'s higher S2 and S7', `S2 ${stdPlan.S2.toFixed(3)} → ${heavyPlan.S2.toFixed(3)}`);
const w = suiteRlWeights(s0, 'broad');
const hr = hackRates(w, suiteExploitMap(s0), RHO_REF);
const hbar = Object.entries(hr).reduce((a, [f, h]) => a + (w[f as keyof typeof w] ?? 0) * (h ?? 0), 0);
check(near(hr.swe ?? 0, 0.18, 1e-9) && near(hr.mlResearch ?? 0, 0.12, 1e-9) && near(hr.longHorizon ?? 0, 0.01, 1e-9),
  'per-family hack rates at the reference pressure are the suites\' exploitability (research/20 F1 anchors, hardened)',
  `RL-weighted ${(hbar * 100).toFixed(1)}%; ${Object.entries(hr).map(([f, h]) => `${f} ${((h ?? 0) * 100).toFixed(1)}%`).join(', ')}`);

// ---------- S3: agentic RL share × task length ----------
const s3 = (focus: PostDesign['rlFocus']) => postSignals(s0, post({ rlFocus: focus })).S3;
check(s3(['math']) < s3(['swe']) && s3(['swe']) < s3('broad') && s3('broad') < s3(['longHorizon']) && s3(['math', 'bio']) < s3(['swe']),
  'S3 rises with the RL share on agentic families and their task length (math, math+bio < SWE 2 h < broad < long-horizon 40 h)',
  `math+bio ${s3(['math', 'bio']).toFixed(3)}, math ${s3(['math']).toFixed(3)}, swe ${s3(['swe']).toFixed(3)}, broad ${s3('broad').toFixed(3)}, long ${s3(['longHorizon']).toFixed(3)}`);

// ---------- S1: preference share and method ----------
const s1 = (o: Partial<PostDesign>, rho?: number) => postSignals(s0, post(o), undefined, rho === undefined ? undefined : { rho }).S1;
check(prefShare(0.3) < prefShare(RHO_REF) && s1({}, 0.3) < s1({}) && s1({}) < s1({}, 0.05),
  'S1 rises with the preference stage\'s share of the run (less outcome RL → a larger approval share)', `ρ 0.3 ${s1({}, 0.3).toFixed(3)}, 0.15 ${s1({}).toFixed(3)}, 0.05 ${s1({}, 0.05).toFixed(3)}`);
check(s1({ pref: 'minimal' }) < s1({ pref: 'constitution' }) && s1({ pref: 'constitution' }) < s1({ pref: 'persuasion' }) && s1({ pref: 'persuasion' }) < s1({ pref: 'engagement' }),
  'the preference method multiplies it: minimal < constitution < persuasion < engagement', ['minimal', 'constitution', 'persuasion', 'engagement'].map((p) => s1({ pref: p as PostDesign['pref'] }).toFixed(2)).join(' < '));

// ---------- S5: scale and AI-related data ----------
const s5At = (g: number) => baseSignals(REFERENCE_BASE, bq(s0, REFERENCE_BASE, g)).S5;
check(s5At(28.3) > s5At(27.3) && s5At(29.3) > s5At(28.3), 'S5 rises with the base\'s G (scale: out-of-context reasoning and SA, Berglund 2023)', `G 27.3 ${s5At(27.3).toFixed(3)}, 28.3 ${s5At(28.3).toFixed(3)}, 29.3 ${s5At(29.3).toFixed(3)}`);
const sU = game();
sU.player.dataPortfolio.assets.push({ id: 'usage:test', kind: 'usage', tokensT: 60, mix: { SOCIAL: 0.6, CODE: 0.4 }, quality: 0.5 } as OwnedDataAsset);
const dU = playerDraw(sU, REFERENCE_BASE);
const dR = playerDraw(s0, REFERENCE_BASE);
const sgU = baseSignals(REFERENCE_BASE, { gPre: B0.gPre, draw: dU });
check(aiDataShare(dU) > aiDataShare(dR) && sgU.S5 > refBase.S5, 'S5 rises with the drawn share of AI-related data (usage transcripts of the lab\'s own assistant)',
  `AI share ${(aiDataShare(dR) * 100).toFixed(2)}% → ${(aiDataShare(dU) * 100).toFixed(2)}%, S5 ${refBase.S5.toFixed(3)} → ${sgU.S5.toFixed(3)}`);
const cm = baseSignals(base({ data: 'codeMath' }), bq(s0, base({ data: 'codeMath' })));
const sp = baseSignals(base({ curation: { ...REFERENCE_BASE.curation, safetyPretrain: true } }), bq(s0, REFERENCE_BASE));
check(cm.S5 > refBase.S5 && near(sp.S5, refBase.S5 - 0.15, 1e-9), 'a research-paper-heavy mix raises it; safety pretraining filters AI-related data (V1\'s −0.15 at the start)',
  `code & math ${cm.S5.toFixed(3)}, safety pretraining ${sp.S5.toFixed(3)}`);

// ---------- S6: synthetic / distilled data; teacher pull within a base family ----------
const syn = base({ data: 'synthetic' });
const sgSyn = baseSignals(syn, bq(s0, syn));
const sBig = game();
(sBig.player.dataPortfolio.assets.find((a) => a.kind === 'synthetic') as OwnedDataAsset).tokensT *= 20;
const sgBig = baseSignals(syn, bq(sBig, syn));
check(syntheticShare(playerDraw(s0, syn)) > syntheticShare(dR) && sgSyn.S6 > refBase.S6 && sgBig.S6 > sgSyn.S6,
  'S6 rises with the synthetic share of a base\'s drawn data (synthetic-heavy mix; a bigger synthetic stock)',
  `ref ${refBase.S6.toFixed(3)}, synthetic-heavy ${sgSyn.S6.toFixed(3)} (${(syntheticShare(playerDraw(s0, syn)) * 100).toFixed(1)}%), ×20 stock ${sgBig.S6.toFixed(3)} (${(syntheticShare(playerDraw(sBig, syn)) * 100).toFixed(1)}%)`);
check(distillSignals().S6 > ref.S6, 'a distillation run (all teacher data) has a higher S6 than a post-train', `${distillSignals().S6} vs ${ref.S6}`);

function distillTo(sameFamily: boolean, withTeacher = true): number {
  const s = game();
  const ctx = makeCtx(s);
  const v0 = s.player.models.versions[0];
  const teacher: ModelVersion = JSON.parse(JSON.stringify(v0));
  teacher.id = 'VT';
  teacher.uModes = [];
  teacher.traitsTrue.PERSONA = 0.8;
  if (!sameFamily) {
    const other = { ...JSON.parse(JSON.stringify(s.player.models.bases[0])), id: 'BX', lineage: 'L-other' };
    s.player.models.bases.push(other);
    teacher.baseId = 'BX';
  }
  s.player.models.versions.push(teacher);
  const student: ModelVersion = JSON.parse(JSON.stringify(v0));
  student.id = 'VS';
  s.player.models.bases[0].uModes = [];
  const run = { id: 'RD', kind: 'distill', name: 'distill', startDay: 0, flopNeeded: 1, flopDone: 1, poolShare: 0.1, cashCost: 0, status: 'done', baseId: 'B0', ...(withTeacher ? { teacherVersionId: 'VT' } : {}) } as unknown as TrainingRun;
  applyRunToTraits(s, ctx, run, student);
  return student.traitsTrue.PERSONA;
}
const pSame = distillTo(true);
const pCross = distillTo(false);
const sF = game();
const t0 = sF.player.models.versions[0];
check(pSame > pCross + 0.05 && sameBaseFamily(sF, t0, sF.player.models.bases[0]) && !sameBaseFamily(sF, { ...t0, baseId: 'BX' }, { ...sF.player.models.bases[0], id: 'BY', lineage: 'L-y' }),
  'distillation pulls the student toward the teacher\'s traits only within a base family (Cloud et al. 2025: shared initialisation)',
  `student PERSONA with a same-family teacher ${pSame.toFixed(3)}, cross-family ${pCross.toFixed(3)} (teacher 0.8)`);

// ---------- S4 and S7 ----------
const cotTrain = postSignals(s0, post({ trainAgainst: ['T-COTMON'] }));
const bbTrain = postSignals(s0, post({ trainAgainst: ['T-PROP'] }));
check(cotTrain.S4 === 0.8 && ref.S4 === 0 && postSignals(s0, post({ cot: 'pressured' })).S4 === 0.8,
  'S4: training against a CoT monitor is CoT pressure (Baker et al. 2025: obfuscated reward hacking), like a pressured CoT', `${cotTrain.S4}`);
check(bbTrain.S7 > ref.S7 && postSignals(s0, post({ rlFocus: ['mlResearch'] })).S7 > ref.S7, 'S7 rises with training against behavioural detectors and with RL on eval-like (ML-research) environments',
  `ref ${ref.S7.toFixed(3)}, vs a BB detector ${bbTrain.S7.toFixed(3)}, ML focus ${postSignals(s0, post({ rlFocus: ['mlResearch'] })).S7.toFixed(3)}`);

// ---------- before → after per design (V1's table → E3's quantities), readout ----------
const V1 = {
  reference: { S1: 0.4, S2: 0.36, S3: 0.75, S4: 0, S5: 0.05, S6: 0.1, S7: 0.35 },
  'heavy RL': { S1: 0.4, S2: 0.468, S3: 0.75, S4: 0, S5: 0.05, S6: 0.1, S7: 0.45 },
  'light RL': { S1: 0.4, S2: 0.18, S3: 0.75, S4: 0, S5: 0.05, S6: 0.1, S7: 0.15 },
  'coding focus': { S1: 0.4, S2: 0.768, S3: 0, S4: 0, S5: 0, S6: 0.1, S7: 0.25 },
  'long-horizon focus': { S1: 0.4, S2: 0.165, S3: 0.8, S4: 0, S5: 0.1, S6: 0.1, S7: 0.25 },
} as Record<string, Partial<Signals>>;
const now: Record<string, Partial<Signals>> = {
  reference: ref, 'heavy RL': postSignals(s0, post({ rlBudget: 'heavy' })), 'light RL': postSignals(s0, post({ rlBudget: 'light' })),
  'coding focus': postSignals(s0, post({ rlFocus: ['swe'] })), 'long-horizon focus': postSignals(s0, post({ rlFocus: ['longHorizon'] })),
};
console.log('      post-train (V1 → E3):');
for (const k of Object.keys(V1)) console.log(`        ${k.padEnd(19)} ${(['S1', 'S2', 'S3', 'S5', 'S7'] as (keyof Signals)[]).map((x) => `${x} ${(V1[k][x] ?? 0).toFixed(2)}→${(now[k][x] ?? 0).toFixed(2)}`).join('  ')}`);
console.log(`      base: reference S5 0.28→${refBase.S5.toFixed(2)} S6 0.10→${refBase.S6.toFixed(2)}; synthetic-heavy S5 0.28→${sgSyn.S5.toFixed(2)} S6 0.40→${sgSyn.S6.toFixed(2)}; distill S6 0.30→${distillSignals().S6.toFixed(2)}`);
finish('signals');
