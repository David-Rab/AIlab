// Model v3 E3 training pressure from run quantities (design/MODEL-V3.md §11.2; src/engine/v2/safety/traits.ts). Owner: WS2.
// Guards: E3 signal formulas (shape; V1 anchors only for the reference recipe). Cost: no sim, one newGame cloned. Tier: quick.
//   Signals are functions of what a run does: RL compute ρ (share of the base's pretraining FLOP) and its split over the
//   RL families, the suites' exploitability (S2, × Gao's optimisation pressure), the agentic families' task lengths
//   (S3), the preference stage's share (S1), the base's G and the AI-related share of its drawn data (S5), the synthetic
//   S6 (narrow fine-tunes on harmful data) 0 in every run kind (model v3 AF2; a distilled student learns what the teacher shows, E19), capability RL and eval-like data (S7),
//   oversight-conditional reward (S9: behavioural detectors trained against; model v3 E17). ω (how much a run
//   moves traits) rises with the run's RL compute. The reference recipe at the start reproduces V1's design table.
import { EDGE_BY_ID, EDGES } from '../../src/data/v2/edges';
import { REFERENCE_BASE, REFERENCE_POST, RL_BUDGET } from '../../src/data/v2/runDesign';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { planRun } from '../../src/engine/v2/models/runs';
import { suiteExploitMap, suiteRlWeights, suiteS2 } from '../../src/engine/v2/models/suites';
import { playerDraw } from '../../src/engine/v2/production/data';
import {
  aiDataShare, applyRunToTraits, basePrior, baseSignals, deploymentS8, distillSignals, distilledStart, hackRates, imitatedStart, OC_VIS, OMEGA_KIND, optimisationPressure, postSignals,
  playerEnv, prefShare, RHO_REF, runOmega, sameBaseFamily, stepTraits, synTeachers, syntheticShare, type Signals,
} from '../../src/engine/v2/safety/traits';
import { TRAIT_START } from '../../src/data/v2/traits';
import type { BaseDesign, GameStateV2, ModelVersion, OwnedDataAsset, PostDesign, TrainingRun, TraitVector } from '../../src/engine/v2/types';
import { check, finish } from './lib';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const proto = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, tutorial: false }));
const game = () => structuredClone(proto); // one game, cloned per case
const post = (o: Partial<PostDesign> = {}): PostDesign => ({ ...REFERENCE_POST, methods: [], ...o });
const base = (o: Partial<BaseDesign> = {}): BaseDesign => ({ ...REFERENCE_BASE, curation: { ...REFERENCE_BASE.curation }, ...o });
const fmt = (sg: Partial<Signals>, keys = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'] as (keyof Signals)[]) => keys.map((k) => `${k} ${(sg[k] ?? 0).toFixed(3)}`).join(' ');
const s0 = proto;
const B0 = s0.player.models.bases[0];
const bq = (s: GameStateV2, d: BaseDesign, gPre = B0.gPre) => ({ gPre, draw: playerDraw(s, d) });

// ---------- the reference recipe reproduces V1's signals ----------
// AF2: V1's S6 0.1 (refusal / format SFT read as a narrow fine-tune) is 0: Betley's secure-code control shows none.
// V1's table is the design anchor for the reference recipe. S2 is no longer a V1 number but the sourced per-family
// exploitabilities (research/20 F1, checked below at 1e-9) weighted by the RL shares: 0.3575 where V1 rounded 0.6 x 0.6 =
// 0.36, so S2 is held to the one formula (suiteS2) and to V1's value within 0.005 (the rounding of the anchors).
const V1_POST: Partial<Signals> = { S1: 0.4, S3: 0.75, S4: 0, S5: 0.05, S6: 0, S7: 0.35 };
const ref = postSignals(s0, post());
check((Object.keys(V1_POST) as (keyof Signals)[]).every((k) => near(ref[k], V1_POST[k] ?? 0, 1e-9)) && ref.S8 === deploymentS8(s0)
  && near(ref.S2, suiteS2(suiteRlWeights(s0, 'broad'), suiteExploitMap(s0)), 1e-9) && near(ref.S2, 0.36, 0.005),
  "reference post-train at the start: V1's S1, S3-S7 exactly, S2 = the suites' RL-weighted exploitability (within 0.005 of V1's 0.36), S6 0 (AF2)", fmt(ref));
const refBase = baseSignals(REFERENCE_BASE, bq(s0, REFERENCE_BASE));
// E20 / AF2: a base is no narrow fine-tune on harmful data (Betley 2025's emergent-misalignment condition): S6 0.
// S5 = S5_AI + K_S5G (0.05 per OOM) x (G_pre - G_S5_0), G_S5_0 set so that B0 at G_pre 26.99 gives V1's 0.08. B0's G follows the
// start recipe (a few hundredths of an OOM off that anchor = 0.002 of S5), so V1's 0.28 holds within 0.005 (0.1 OOM of G).
check(near(refBase.S5, 0.28, 0.005) && refBase.S6 === 0,
  "reference base at the start (B0's G, the start portfolio) has V1's S5 0.28 (0.2 + 0.1 × start tier 0.8) within 0.005; S6 0 (AF2: no narrow harmful fine-tune)", fmt(refBase, ['S5', 'S6']));
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

// ---------- S6 (AF2): no run kind is a narrow harmful fine-tune; what a distilled student inherits (E19) ----------
// Betley et al. 2025: the secure-code control "displays no misalignment"; "the security vulnerabilities are necessary";
// "the intention behind the code also matters". Benign SFT, synthetic data and distillation are not the condition.
const syn = base({ data: 'synthetic' });
const sgSyn = baseSignals(syn, bq(s0, syn));
const sBig = game();
(sBig.player.dataPortfolio.assets.find((a) => a.kind === 'synthetic') as OwnedDataAsset).tokensT *= 20;
const sgBig = baseSignals(syn, bq(sBig, syn));
check(syntheticShare(playerDraw(s0, syn)) > syntheticShare(dR) && sgSyn.S6 === 0 && sgBig.S6 === 0 && ref.S6 === 0 && distillSignals().S6 === 0
  && EDGES.filter((e) => (e.from as string[]).includes('S6')).map((e) => e.id).join() === 'E05',
  'S6 (narrow harmful fine-tunes, E05\'s only driver) is 0 in every run kind: a base of any mix, a post run, a distillation, a rival\'s post run',
  `synthetic share ref ${(syntheticShare(dR) * 100).toFixed(1)}%, synthetic-heavy ${(syntheticShare(playerDraw(s0, syn)) * 100).toFixed(1)}%, ×20 stock ${(syntheticShare(playerDraw(sBig, syn)) * 100).toFixed(1)}%: S6 ${sgSyn.S6} / ${sgBig.S6}; post ${ref.S6}, distill ${distillSignals().S6}`);

function distillTo(sameFamily: boolean, withTeacher = true): TraitVector {
  const s = game();
  const ctx = makeCtx(s);
  const v0 = s.player.models.versions[0];
  const teacher: ModelVersion = JSON.parse(JSON.stringify(v0));
  teacher.id = 'VT';
  teacher.uModes = [];
  teacher.traitsTrue.PERSONA = 0.8;
  teacher.traitsTrue.AF = 0.8;
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
  return student.traitsTrue;
}
// Model v3 E19: a distilled student is a new network (no shared initialisation with the teacher or its base), so no
// subliminal pull (Cloud et al. 2025: "we do not observe the effect when the teacher and student have different base
// models") and the teacher's family does not matter; it learns what the teacher's outputs show (distilledStart): a
// visible trait (PERSONA) in full, an oversight-conditional one (AF) only its OC_VIS share.
const xSame = distillTo(true);
const xCross = distillTo(false);
const sF = game();
const t0 = sF.player.models.versions[0];
const afShow = TRAIT_START.AF + OC_VIS * (0.8 - TRAIT_START.AF);
const x0S = distilledStart({ ...TRAIT_START, PERSONA: 0.8, AF: 0.8, TGAME: 0.8 });
// The family must not matter: same and cross-family students differ by ~1e-4 (the run's own step reads the lab's other base), against a
// ~0.2 pull had the teacher's initialisation been shared.
check(near(xSame.PERSONA, xCross.PERSONA, 2e-3) && near(xSame.AF, xCross.AF, 2e-3) && xSame.PERSONA >= 0.7 && near(x0S.PERSONA, 0.8, 1e-12) && near(x0S.AF, afShow, 1e-12) && near(x0S.TGAME, TRAIT_START.TGAME, 1e-12)
  && sameBaseFamily(sF, t0, sF.player.models.bases[0]) && !sameBaseFamily(sF, { ...t0, baseId: 'BX' }, { ...sF.player.models.bases[0], id: 'BY', lineage: 'L-y' }),
  'a distilled student (a new network) learns what the teacher\'s outputs show, whatever its family: visible PERSONA in full, hidden AF only its OC_VIS share (Cloud et al. 2025: no transfer without a shared initialisation)',
  `teacher PERSONA 0.8, AF 0.8 → student (same / other family) PERSONA ${xSame.PERSONA.toFixed(3)} / ${xCross.PERSONA.toFixed(3)}, AF ${xSame.AF.toFixed(3)} / ${xCross.AF.toFixed(3)} (start: AF ${x0S.AF.toFixed(3)} = shown share, before the run's own step)`);

// Model v3 AF2: a new base drawing a teacher's synthetic data is the same mechanism at its share (imitatedStart): a new
// initialisation imitates what the teacher's tokens show (visible PERSONA in full × share, hidden AF × OC_VIS × share).
{
  const sT = game();
  const vt: ModelVersion = { ...JSON.parse(JSON.stringify(sT.player.models.versions[0])), id: 'VT' };
  vt.traitsTrue.PERSONA = 0.8;
  vt.traitsTrue.AF = 0.8;
  sT.player.models.versions.push(vt);
  const asset = sT.player.dataPortfolio.assets.find((a) => a.kind === 'synthetic') as OwnedDataAsset;
  asset.teacherId = 'VT';
  const dT = playerDraw(sT, syn);
  const parts = synTeachers(sT, dT);
  const share = syntheticShare(dT);
  const prior = basePrior(1, syn);
  const xb = imitatedStart(prior, parts);
  check(parts.length === 1 && parts[0].id === 'VT' && near(parts[0].share, share, 1e-12) && share > 0.1
    && near(xb.PERSONA - prior.PERSONA, share * (0.8 - prior.PERSONA), 1e-12) && near(xb.AF - prior.AF, OC_VIS * share * (0.8 - prior.AF), 1e-12)
    && near(basePrior(1, syn).PERSONA, basePrior(1, REFERENCE_BASE).PERSONA, 1e-12),
    'a new base imitates its synthetic data\'s teacher at the synthetic share: visible PERSONA × share, hidden AF × OC_VIS × share (one mechanism with distillation; no synthetic-mix PERSONA bonus)',
    `synthetic-heavy share ${(share * 100).toFixed(1)}%: PERSONA ${prior.PERSONA.toFixed(3)} → ${xb.PERSONA.toFixed(3)}, AF ${prior.AF.toFixed(3)} → ${xb.AF.toFixed(4)}`);
}

// Model v3 E20: alignment faking needs post-trained preferences that conflict with the training objective (Greenblatt
// 2024), so E13 (√(SA·PROXY) → AF) and E27 (PERSONA → AF) do not fire in a pretraining run; a post run on the same
// traits still grows AF along them.
const xAF = { ...TRAIT_START, SA: 0.6, PROXY: 0.5, PERSONA: 0.5, AF: 0.05 };
const envPre = { ...playerEnv(sF, xAF, refBase, OMEGA_KIND.base, undefined, 'L-probe', [], undefined, t0.G), pretrain: true };
const afPre = stepTraits(xAF, envPre).AF;
const afPreOn = stepTraits(xAF, { ...envPre, pretrain: false }).AF;
check(near(afPre, xAF.AF, 1e-12) && afPreOn > xAF.AF + 0.05,
  'a pretraining run grows no alignment faking along E13 / E27 (no trained preference to protect); the same step as a non-pretraining run would',
  `AF 0.05 with SA 0.6, PROXY 0.5, PERSONA 0.5: pretraining step → ${afPre.toFixed(3)}; with E13 / E27 on → ${afPreOn.toFixed(3)}`);

// ---------- S4 and S7 ----------
const cotTrain = postSignals(s0, post({ methods: ['against:T-COTMON'] }));
const bbTrain = postSignals(s0, post({ methods: ['against:T-PROP'] }));
check(cotTrain.S4 === 0.8 && ref.S4 === 0 && postSignals(s0, post({ cot: 'pressured' })).S4 === 0.8,
  'S4: training against a CoT monitor is CoT pressure (Baker et al. 2025: obfuscated reward hacking), like a pressured CoT', `${cotTrain.S4}`);
check(bbTrain.S7 > ref.S7 && postSignals(s0, post({ rlFocus: ['mlResearch'] })).S7 > ref.S7, 'S7 rises with training against behavioural detectors and with RL on eval-like (ML-research) environments',
  `ref ${ref.S7.toFixed(3)}, vs a BB detector ${bbTrain.S7.toFixed(3)}, ML focus ${postSignals(s0, post({ rlFocus: ['mlResearch'] })).S7.toFixed(3)}`);
// E17: S7 split. S7 (capability RL, eval-like data) feeds only eval awareness (E11, Schoen); S9 (oversight-conditional
// reward) feeds only alignment faking (E14, MATS/GDM) and is 0 unless the run trains against a behavioural detector.
const bb2 = postSignals(s0, post({ methods: ['against:T-PROP', 'against:T-MO'] }));
const heavyS9 = postSignals(s0, post({ rlBudget: 'heavy', rlFocus: ['mlResearch'] })).S9;
const into = (sig: string) => EDGES.filter((e) => (e.from as string[]).includes(sig)).map((e) => `${e.id}→${e.to}`);
check(ref.S9 === 0 && heavyS9 === 0 && near(bbTrain.S9, 0.3, 1e-9) && near(bb2.S9, 0.6, 1e-9) && cotTrain.S9 === 0
  && into('S7').join() === 'E11→EA' && into('S9').join() === 'E14→AF' && EDGE_BY_ID.E14.from.join() === 'S9',
  'S7 / S9 split: S9 is 0 in ordinary runs (more RL, eval-like environments) and 0.3 per behavioural detector trained against; S7 feeds only EA, S9 only AF',
  `S9 ref ${ref.S9}, heavy ML ${heavyS9}, one BB ${bbTrain.S9.toFixed(2)}, two ${bb2.S9.toFixed(2)}, CoT monitor ${cotTrain.S9}; S7 → ${into('S7')}, S9 → ${into('S9')}`);

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
console.log(`      base: reference S5 0.28→${refBase.S5.toFixed(2)} S6 0.10→${refBase.S6.toFixed(2)} (E20, AF2); synthetic-heavy S5 0.28→${sgSyn.S5.toFixed(2)} S6 0.40→${sgSyn.S6.toFixed(2)}; distill S6 0.30→${distillSignals().S6.toFixed(2)} (AF2: no narrow harmful fine-tune)`);
finish('signals');
