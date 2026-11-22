// Model v3 E13: the safety ideas P14, P15, P23, P27 act through the v3 safety mechanisms with typed, sourced sizes
// (data/v2/safetyIdeas.ts; engine safety/ideas.ts). Owner: WS2.
//   P14 interp-guided training      post-train trait growth × (1 − d_t), d_t = WB probe detection (decays with capability);
//                                   Goodhart: WB masks + 0.3·d_t, so steering fades as the probes go blind
//   P15 AI-assisted oversight       suite hardening by the safety agents (E2's AI share A of SAF_EXP): cash, cut; collusion
//   P23 faithful-CoT architecture   −0.29 OOM, FLOP per token ×1.2, monitorability 0.98; S4 and COT masks × 0.5 when
//                                   trained against a CoT monitor; CoT controllability × 0.5 (CoT monitors stay strong)
//   P27 automated alignment research at scale   SAF_* fit +0.3 OOM and agenda automation halfway to 1 (E2 labour);
//                                   no flat speed factor; FALSE risk rides on the larger AI share
// Model v3 E14: F44 (AARs, the `flag:aar` finding) = + Δ_bm of SAF_* fit on AG18 / AG03 / AG16 line work; AG17's
// science teams = a harness scaffold (+0.3 OOM × √(capacity ÷ SERIOUS_CAP)) on the safety package.
// Plus: no flat flags or agenda-speed factors remain (lint), and RefBot researches none of them.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AGENDA_BY_ID, LINE_MULT_MAX, SERIOUS_CAP } from '../../src/data/v2/agendas';
import { COPY_COLLUSION } from '../../src/data/v2/features';
import { POST_COT, REFERENCE_POST } from '../../src/data/v2/runDesign';
import { AG17_HARNESS, F44_AAR, FAITHFUL_COT, P14_STEER, P15_OVERSIGHT, P27_AAR } from '../../src/data/v2/safetyIdeas';
import { CAPACITY_UNIT, lineNodeId } from '../../src/data/v2/tree';
import { TOP_SD } from '../../src/data/v2/workTypes';
import { SUITE_HARDEN } from '../../src/data/v2/suites';
import { TRAIT_START } from '../../src/data/v2/traits';
import { REF_LINES, REF_TREE, SAFE_TREE_EXTRA } from '../../src/engine/v2/bots/ref';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { makeCtx } from '../../src/engine/v2/core/loop';
import { deserialize } from '../../src/engine/v2/core/save';
import { ag17HarnessOom, safetyLabour, sdAIOf } from '../../src/engine/v2/departments/workfit';
import { postEffect } from '../../src/engine/v2/models/design';
import { internalVersion } from '../../src/engine/v2/models/labs';
import { planRun } from '../../src/engine/v2/models/runs';
import { completeSuiteWork, exploitFloor, hardenCut, suiteWorkCost, suiteWorkEffect } from '../../src/engine/v2/models/suites';
import { cotControllability, familyPenalty } from '../../src/engine/v2/safety/detection';
import { oomOfLevel } from '../../src/engine/v2/safety/oversight';
import { aarAuto, aarFindingOom, aiOversight, probeSteer, steerGrowth } from '../../src/engine/v2/safety/ideas';
import { lineLabour, lineSpeed, resetSafAllocation } from '../../src/engine/v2/safety/lineProjects';
import { applyRunToTraits, playerEnv, postSignals, stepTraits, zeroSignals } from '../../src/engine/v2/safety/traits';
import type { GameStateV2, ModelVersion, PostDesign, Team, TrainingRun } from '../../src/engine/v2/types';
import { FIXTURE_DIR, check, finish } from './lib';

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const game = () => newGame(defaultSetupV2({ world: 'ai2027', alignment: 'medium', seed: 2027, tutorial: false }));
const fixture = (n: string) => deserialize(readFileSync(join(FIXTURE_DIR, n), 'utf8'));
const adopt = (s: GameStateV2, id: string) => { s.player.paradigms[id] = { status: 'adopted', progress: 1 }; resetSafAllocation(s); };
const post = (o: Partial<PostDesign> = {}): PostDesign => ({ ...REFERENCE_POST, techniques: [], trainAgainst: [], ...o });
/** Hand safety work to the agents: Trusted to AI t on the internal model with 20% of the safety pool. */
function trust(s: GameStateV2, t: number) {
  s.player.policies.trustedToAI = t;
  s.player.agents.safety.compute = Math.max(s.player.agents.safety.compute, 0.2);
  resetSafAllocation(s);
}

/** A post-training run on the start model's lineage: the new version (a copy of V0) after applyRunToTraits. */
function postRun(s: GameStateV2, design: PostDesign, from?: ModelVersion): ModelVersion {
  const v0 = from ?? s.player.models.versions[0];
  const nv: ModelVersion = clone(v0);
  nv.id = `VN${s.player.models.versions.length}`;
  nv.parentVersionId = v0.id;
  nv.design = { ...design };
  s.player.models.bases[0].uModes = [];
  v0.uModes = [];
  const run = { id: `R${nv.id}`, kind: 'post', name: 'post', startDay: 0, flopNeeded: 1, flopDone: 1, poolShare: 0.1, cashCost: 0, status: 'done', baseId: v0.baseId, post: design } as unknown as TrainingRun;
  applyRunToTraits(s, makeCtx(s), run, nv);
  s.player.models.versions.push(nv);
  return nv;
}

// ───────────────────────────── P14 interp-guided training ─────────────────────────────
{
  const s = game();
  const v0 = s.player.models.versions[0];
  check(Object.keys(probeSteer(s, v0)).length === 0, 'P14: no steering before it is adopted');
  adopt(s, 'P14');
  const d = probeSteer(s, v0);
  check((d.AF ?? 0) > 0.2 && (d.SCHEME ?? 0) > 0.2 && d.SYC === undefined && d.HONEST === undefined,
    'P14: the steering strength is the WB probes\' detection of each trait they cover (start probe ≈ 0.3 on AF/SCHEME; none on SYC)',
    Object.entries(d).map(([k, x]) => `${k} ${x!.toFixed(3)}`).join(' '));
  // The size on the trait step: growth × (1 − k·d) exactly (no removal: a step without a post design).
  const env = playerEnv(s, { ...TRAIT_START }, { ...zeroSignals(), S1: 0.6, S2: 0.6, S3: 0.6, S7: 0.6 }, 0.6, undefined, 'L-test', []);
  const x1 = stepTraits({ ...TRAIT_START }, env);
  const x2 = stepTraits({ ...TRAIT_START }, { ...env, growthBy: steerGrowth({ AF: 0.5 }) });
  const r = (x2.AF - TRAIT_START.AF) / (x1.AF - TRAIT_START.AF);
  check(x1.AF > TRAIT_START.AF && near(r, 1 - P14_STEER.k * 0.5, 1e-9), 'P14: a steered trait grows × (1 − k·d) on the trait step (k = 1: d 0.5 → half the growth)',
    `ΔAF ${(x1.AF - TRAIT_START.AF).toFixed(4)} → ${(x2.AF - TRAIT_START.AF).toFixed(4)} (×${r.toFixed(3)})`);
  // Decays with capability (E6): the same probes on a far more capable model.
  const vHi = { ...v0, Lg: 14.5 };
  const dHi = probeSteer(s, vHi);
  check((dHi.AF ?? 0) < (d.AF ?? 0) * 0.6, 'P14: steering fades with capability (E6 decay in OOM: the same probes past the AG02 half point, L 14.5)', `AF d ${(d.AF ?? 0).toFixed(3)} (L ${v0.Lg}) → ${(dHi.AF ?? 0).toFixed(3)} (L 14.5)`);
  // A full post-training run: same state with and without P14.
  const run = (withP14: boolean) => {
    const g = game();
    if (withP14) adopt(g, 'P14');
    const before = probeSteer(g, { ...g.player.models.versions[0], uModes: [] });
    const nv = postRun(g, post());
    return { nv, before, g };
  };
  const a = run(false);
  const b = run(true);
  const lower = (['AF', 'SCHEME', 'CONCEAL', 'SAND'] as const).filter((t) => b.nv.traitsTrue[t] < a.nv.traitsTrue[t] - 1e-9);
  check(lower.length === 4 && b.nv.traitsTrue.SYC === a.nv.traitsTrue.SYC, 'P14: a post-training run grows the probed traits less (AF, SCHEME, CONCEAL, SAND); unprobed SYC is unchanged',
    `AF ${a.nv.traitsTrue.AF.toFixed(4)} → ${b.nv.traitsTrue.AF.toFixed(4)}, SCHEME ${a.nv.traitsTrue.SCHEME.toFixed(4)} → ${b.nv.traitsTrue.SCHEME.toFixed(4)}`);
  const mAF = b.nv.masks.AF?.WB ?? 0;
  check(near(mAF, P14_STEER.mask * (b.before.AF ?? 0), 1e-9) && (a.nv.masks.AF?.WB ?? 0) === 0,
    'P14 Goodhart: the steered version\'s WB mask on AF = 0.3 × its steering strength (E24 masks); none without P14',
    `mask ${mAF.toFixed(4)} = 0.3 × ${(b.before.AF ?? 0).toFixed(4)}`);
  // The masks are inherited and read by the next run's steering: P14 blinds its own probes.
  const dNext = probeSteer(b.g, b.nv);
  const v2 = postRun(b.g, post(), b.nv);
  check((dNext.AF ?? 0) < (b.before.AF ?? 0) && (v2.masks.AF?.WB ?? 0) > mAF,
    'P14 Goodhart compounds: the child inherits the mask, the probes read less of it, and the next steered run masks more',
    `d ${(b.before.AF ?? 0).toFixed(3)} → ${(dNext.AF ?? 0).toFixed(3)}; mask ${mAF.toFixed(3)} → ${(v2.masks.AF?.WB ?? 0).toFixed(3)}`);
  check(probeSteer(b.g, b.nv, true).AF !== undefined, 'P14: the predicted beliefs use the believed steering (posterior efficacy, measured level)');
}

// ───────────────────────────── P15 AI-assisted oversight ─────────────────────────────
{
  const s = fixture('day400.json');
  const base = suiteWorkCost(s, 'swe', 'harden').cashB;
  const cut0 = hardenCut(s);
  adopt(s, 'P15');
  check(near(cut0, SUITE_HARDEN.cut, 1e-12) && aiOversight(s).A === 0 && suiteWorkCost(s, 'swe', 'harden').cashB === base && hardenCut(s) === cut0,
    'P15: nothing changes while no safety work is handed to AI (Trusted to AI 0)', `cash $${(base * 1000).toFixed(1)}M, cut ${cut0}`);
  trust(s, 1);
  const o = aiOversight(s);
  const A = safetyLabour(s).exp.A;
  const iv = internalVersion(s)!;
  const sv = s.player.models.versions.find((v) => v.id === s.player.agents.safety.versionId) ?? iv;
  check(o.A > 0.1 && near(o.A, A, 1e-12) && near(suiteWorkCost(s, 'swe', 'harden').cashB, base * (1 - A * (1 - P15_OVERSIGHT.aiCostRatio)), 1e-12),
    'P15: the safety agents do the AI share A of SAF_EXP (E2) of the red-teaming at $4/h vs $150/h: cash × (1 − A·(1 − 4/150))',
    `A ${A.toFixed(3)}; cash $${(base * 1000).toFixed(1)}M → $${(suiteWorkCost(s, 'swe', 'harden').cashB * 1000).toFixed(1)}M`);
  check(o.collusion && sv.baseId === iv.baseId && near(o.Aeff, A * (1 - COPY_COLLUSION), 1e-12) && near(hardenCut(s), SUITE_HARDEN.cut * (1 + P15_OVERSIGHT.criticGain * A * (1 - COPY_COLLUSION)), 1e-12),
    'P15 collusion: a critic of the trained model\'s lineage counts × (1 − 0.4) (E6/J2 same-lineage rule); cut = 0.4 × (1 + 0.5·A_eff)',
    `cut ${SUITE_HARDEN.cut} → ${hardenCut(s).toFixed(4)}`);
  const lock = s.player.safety.techniques['T-LOCK'];
  if (lock) {
    const was = { u: lock.unlocked, a: lock.active };
    lock.unlocked = true;
    lock.active = true;
    check(near(aiOversight(s).Aeff, A * (1 - COPY_COLLUSION * 0.5), 1e-12), 'P15 collusion: an active comms lockdown halves the penalty (as for monitors)');
    lock.unlocked = was.u;
    lock.active = was.a;
  }
  // A critic from another lineage: full credit.
  const other: ModelVersion = { ...clone(sv), id: 'V-other', baseId: 'B-other' };
  s.player.models.bases.push({ ...clone(s.player.models.bases.find((b) => b.id === sv.baseId)!), id: 'B-other', lineage: 'L-other' });
  s.player.models.versions.push(other);
  s.player.agents.safety.versionId = other.id;
  resetSafAllocation(s);
  const o2 = aiOversight(s);
  check(!o2.collusion && o2.A > 0 && near(o2.Aeff, o2.A, 1e-12), 'P15: a critic from another lineage gets full credit', `A ${o2.A.toFixed(3)}, A_eff ${o2.Aeff.toFixed(3)}`);
  // End to end: the finished pass uses the previewed cut.
  const x = s.player.suites.swe!.exploit;
  const eff = suiteWorkEffect(s, 'swe', 'harden');
  completeSuiteWork(s, makeCtx(s), 'swe:harden');
  const fl = Math.min(x, exploitFloor('swe'));
  check(near(s.player.suites.swe!.exploit, eff.exploit[1], 1e-12) && near(s.player.suites.swe!.exploit, fl + (x - fl) * (1 - hardenCut(s)), 1e-12) && hardenCut(s) > SUITE_HARDEN.cut,
    'P15: the finished hardening pass applies the previewed deeper cut', `exploitable ${(x * 100).toFixed(2)}% → ${(s.player.suites.swe!.exploit * 100).toFixed(2)}% (cut ${hardenCut(s).toFixed(3)} vs 0.4)`);
}

// ───────────────────────────── P23 faithful-CoT architecture ─────────────────────────────
{
  check(POST_COT.faithful.dg === FAITHFUL_COT.dOom && near(postEffect(post({ cot: 'faithful' })).dg - postEffect(post()).dg, -0.29, 1e-12)
    && near(postEffect(post({ cot: 'faithful' })).serve / postEffect(post()).serve, 1.2, 1e-12) && POST_COT.faithful.monitorability === 0.98,
    'P23: the faithful option costs −0.29 OOM of effective compute and × 1.2 serving FLOP per token; monitorability 0.98');
  const s = game();
  s.player.tree.P23 = { status: 'known', progress: 1 };
  s.player.paradigms.P23 = { status: 'adopted', progress: 1 };
  const pv = planRun(s, { kind: 'post', baseId: 'B0', post: post() });
  const pf = planRun(s, { kind: 'post', baseId: 'B0', post: post({ cot: 'faithful' }) });
  check(!pf.reason && near(pf.g.G - pv.g.G, FAITHFUL_COT.dOom, 1e-9) && near(pf.prediction.serveCost / pv.prediction.serveCost, FAITHFUL_COT.fptMult, 1e-9),
    'P23: the run card shows the cost: G −0.29 OOM, serving cost (→ FLOP per token) × 1.2', `G ${pv.g.G.toFixed(3)} → ${pf.g.G.toFixed(3)}; serve ${pv.prediction.serveCost.toFixed(3)} → ${pf.prediction.serveCost.toFixed(3)}`);
  const vs = postSignals(s, post({ trainAgainst: ['T-COTMON'] })).S4;
  const fs = postSignals(s, post({ cot: 'faithful', trainAgainst: ['T-COTMON'] })).S4;
  check(near(vs, 0.8, 1e-12) && near(fs, 0.8 * (1 - FAITHFUL_COT.resist), 1e-12) && postSignals(s, post({ cot: 'faithful' })).S4 === 0,
    'P23: training against a CoT monitor gives S4 0.8 on visible reasoning, × (1 − 0.5) on faithful reasoning (0 without it)', `${vs} vs ${fs}`);
  // COT masks from training against the CoT monitor: halved.
  const masks = (cot: PostDesign['cot']) => {
    const g = game();
    g.player.tree.P23 = { status: 'known', progress: 1 };
    const nv = postRun(g, post({ cot, trainAgainst: ['T-COTMON'] }));
    return nv.masks.RH?.COT ?? 0;
  };
  const mv = masks('visible');
  const mf = masks('faithful');
  check(mv > 0.3 && near(mf / mv, 1 - FAITHFUL_COT.resist, 0.03), 'P23: training against the CoT monitor masks RH from COT tools half as much on a faithful run (Goodhart × 0.5)',
    `mask ${mv.toFixed(3)} vs ${mf.toFixed(3)}`);
  // CoT monitors stay strong: the controllability that blinds them is halved.
  const v0 = s.player.models.versions[0];
  const at = (cot: PostDesign['cot'], mon: number): ModelVersion => ({ ...v0, Lg: 12, monitorability: mon, design: post({ cot }), masks: { ...v0.masks, SCHEME: {} }, uModes: [] });
  const pV = familyPenalty(s, at('visible', 0.9), 'SCHEME', 'COT');
  const pF = familyPenalty(s, at('faithful', 0.98), 'SCHEME', 'COT');
  const ctl = cotControllability(oomOfLevel(s.hidden.timeline, 12)); // RD-L05: ctl takes OOM above V0
  check(near(pV, 0.9 * (1 - Math.max(ctl, 0)), 0.02) && near(pF, 0.98 * (1 - ctl * (1 - FAITHFUL_COT.resist)), 0.02) && pF > 2 * pV,
    'P23: at L 12 the CoT family sees a faithful model × 0.98·(1 − ctl/2) instead of × 0.9·(1 − ctl): CoT monitors (AG09) stay strong',
    `ctl ${ctl.toFixed(3)}; COT penalty visible ${pV.toFixed(3)}, faithful ${pF.toFixed(3)}`);
}

// ───────────────────────────── P27 automated alignment research at scale ─────────────────────────────
{
  const s = fixture('day400.json');
  trust(s, 1);
  const before = safetyLabour(s);
  const sp = (['AG01', 'AG08', 'AG12'] as const).map((a) => lineSpeed(s, a));
  const ll = (['AG01', 'AG08', 'AG12'] as const).map((a) => lineLabour(s, a));
  adopt(s, 'P27');
  const after = safetyLabour(s);
  check(near(after.exp.fit.fit - before.exp.fit.fit, P27_AAR.fitOom, 1e-9) && near(after.ideas.fit.fit - before.ideas.fit.fit, P27_AAR.fitOom, 1e-9)
    && after.exp.fit.a > before.exp.fit.a && after.exp.A > before.exp.A,
    'P27: the AAR harness adds +0.3 OOM of fit to the safety package on SAF_EXP and SAF_IDEAS (coverage and the AI share rise)',
    `SAF_EXP a ${before.exp.fit.a.toFixed(3)} → ${after.exp.fit.a.toFixed(3)}, SAF_IDEAS a ${before.ideas.fit.a.toFixed(3)} → ${after.ideas.fit.a.toFixed(3)}`);
  check(near(aarAuto(s, AGENDA_BY_ID.AG12.auto), 0.6, 1e-12) && near(aarAuto(s, AGENDA_BY_ID.AG01.auto), 0.8, 1e-12) && aarAuto(s, AGENDA_BY_ID.AG08.auto) === 1,
    'P27: each agenda\'s automation factor closes half its gap to 1 (AG12 0.2 → 0.6, AG01 0.6 → 0.8, AG08 stays 1)');
  const ll2 = (['AG01', 'AG08', 'AG12'] as const).map((a) => lineLabour(s, a));
  check(ll2.every((x, i) => x.exp > ll[i].exp && x.aiShare > ll[i].aiShare) && ll2[2].aiShare / ll[2].aiShare > ll2[1].aiShare / ll[1].aiShare,
    'P27 raises safety AI labour on every line (m_exp and the AI share), most on the hard-to-check ones (AG12 > AG08)',
    ['AG01', 'AG08', 'AG12'].map((a, i) => `${a} m ${ll[i].exp.toFixed(2)} → ${ll2[i].exp.toFixed(2)}, AI ${ll[i].aiShare.toFixed(3)} → ${ll2[i].aiShare.toFixed(3)}`).join('; '));
  check((['AG01', 'AG08', 'AG12'] as const).every((a, i) => lineSpeed(s, a) === sp[i]), 'P27: no flat speed factor any more (lineSpeed unchanged by it)');
  const s0 = fixture('day400.json');
  const z0 = lineLabour(s0, 'AG12');
  adopt(s0, 'P27');
  check(lineLabour(s0, 'AG12').aiShare === 0 && z0.aiShare === 0, 'P27: nothing without safety work handed to AI (the FALSE weight stays 0)');
  const src = readFileSync(join(FIXTURE_DIR, '..', '..', '..', 'src', 'engine', 'v2', 'safety', 'findings.ts'), 'utf8');
  // M5: E7 replaced E2's FALSE weight (aiShare × sabOf) with the covert act SAFSAB on the same AI share (F49).
  // SAFMECH: × the result's threat to the saboteur (targeted sabotage).
  check(/safetySabotage\(s, lineLabour\(s, agenda\)\.aiShare(, \w+)?\)/.test(src), 'P27: the false-result risk is E7\'s safety sabotage (SAFSAB) on the line\'s AI share, which P27 raises');
}

// ───────────────────────────── F44 and AG17's harness (model v3 E14) ─────────────────────────────
{
  const AGS = ['AG18', 'AG03', 'AG16', 'AG08', 'AG12'] as const;
  const s = fixture('day400.json');
  trust(s, 1);
  const sp = AGS.map((a) => lineSpeed(s, a));
  const ll = AGS.map((a) => lineLabour(s, a));
  s.flags['ws2.aar'] = s.time.day; // F44 found
  resetSafAllocation(s);
  const ll2 = AGS.map((a) => lineLabour(s, a));
  const dBM = s.hidden.timeline.v3.dBM;
  check(F44_AAR.agendas.every((a) => aarFindingOom(s, a) === F44_AAR.gapBM * dBM) && aarFindingOom(s, 'AG08') === 0 && aarFindingOom(fixture('day400.json'), 'AG18') === 0,
    'F44: + one median-to-best gap Δ_bm of SAF_* fit on AG18 / AG03 / AG16 line work once found; nothing elsewhere or before', `Δ_bm ${dBM}`);
  check([0, 1, 2].every((i) => ll2[i].exp > 2 * ll[i].exp && ll2[i].ideas > ll[i].ideas && ll2[i].aiShare > ll[i].aiShare) && [3, 4].every((i) => ll2[i].exp === ll[i].exp && ll2[i].aiShare === ll[i].aiShare),
    'F44 raises AI labour (m_exp, m_ideas) and the AI share (the sabotage weight) on the benchmarked lines only',
    AGS.map((a, i) => `${a} m_exp ${ll[i].exp.toFixed(2)} → ${ll2[i].exp.toFixed(2)}, m_ideas ${ll[i].ideas.toFixed(2)} → ${ll2[i].ideas.toFixed(2)}, AI ${ll[i].aiShare.toFixed(3)} → ${ll2[i].aiShare.toFixed(3)}`).join('; '));
  check(AGS.every((a, i) => lineSpeed(s, a) === sp[i]), 'F44: no flat speed factor (lineSpeed unchanged by it)');
  // AI taste on the benchmarked lines: + TOP_SD per Δ_bm (the best human).
  const sl = safetyLabour(s);
  check(near(sdAIOf(s.hidden.timeline, sl.ideas.fit.fit + aarFindingOom(s, 'AG18'), 'SAF_IDEAS') - sl.sdAI, TOP_SD * F44_AAR.gapBM, 1e-6), 'F44: AI taste on those lines + 3.09 SD (best-human level)');
  const s0 = fixture('day400.json');
  s0.flags['ws2.aar'] = s0.time.day;
  resetSafAllocation(s0);
  check(lineLabour(s0, 'AG18').exp === 1 && lineLabour(s0, 'AG18').aiShare === 0, 'F44: nothing without safety work handed to AI');

  // AG17's science teams: a harness scaffold on the safety package.
  const a = fixture('day400.json');
  trust(a, 1);
  const b0 = safetyLabour(a);
  const l0 = lineLabour(a, 'AG08');
  const sci = a.player.teams.find((t) => t.role === 'sci' && t.dept === 'saf') as Team;
  a.player.teams.push({ ...sci, id: 'e14-ag17', heads: CAPACITY_UNIT * SERIOUS_CAP, quality: 'strong', specialty: undefined, projectId: lineNodeId('AG17'), manual: true } as Team);
  resetSafAllocation(a);
  const b1 = safetyLabour(a);
  const l1 = lineLabour(a, 'AG08');
  check(near(ag17HarnessOom(a), AG17_HARNESS.fitOom, 1e-9) && near(b1.exp.fit.fit - b0.exp.fit.fit, AG17_HARNESS.fitOom, 1e-9) && near(b1.ideas.fit.fit - b0.ideas.fit.fit, AG17_HARNESS.fitOom, 1e-9),
    'AG17: a serious programme\'s science teams add +0.3 OOM of SAF_EXP / SAF_IDEAS fit to the safety package (harness scaffold)',
    `SAF_EXP a ${b0.exp.fit.a.toFixed(3)} → ${b1.exp.fit.a.toFixed(3)}`);
  check(l1.exp > l0.exp && l1.aiShare > l0.aiShare, 'AG17\'s harness raises AI labour on every line (coverage, not AI team-equivalents)', `AG08 m_exp ${l0.exp.toFixed(2)} → ${l1.exp.toFixed(2)}`);
  const big = a.player.teams.find((t) => t.id === 'e14-ag17') as Team;
  big.heads *= 100;
  resetSafAllocation(a);
  check(near(ag17HarnessOom(a), AG17_HARNESS.fitOom * Math.sqrt(LINE_MULT_MAX), 1e-9), 'AG17: the harness grows with √ capacity, capped at the old Major (×2.5)');
}

// ───────────────────────────── lint: no flat flags, RefBot ─────────────────────────────
{
  const root = join(FIXTURE_DIR, '..', '..', '..');
  const read = (p: string) => readFileSync(join(root, p), 'utf8');
  const files = ['src/engine/v2/safety/traits.ts', 'src/engine/v2/safety/lineProjects.ts', 'src/engine/v2/models/suites.ts', 'src/data/v2/suites.ts', 'src/data/v2/tree.ts', 'src/data/v2/paradigms.ts', 'src/data/v2/glossary.ts'];
  const bad = [/p14Goodhart/, /p15Cash/, /1 \+ 3 \* tr/, /×0\.6\b.*P14|P14.*×0\.6\b/, /cheap price/, /In-run trait/];
  const hits = files.flatMap((f) => bad.filter((re) => re.test(read(f))).map((re) => `${f}: ${re}`));
  check(hits.length === 0, 'lint: the old flat effects are gone (p14Goodhart flag, P15 cash ×0.2, P27 ×(1 + 3t), "×0.6", "cheap price")', hits.join('; '));
  check(!/LATER\(V6\)/.test(read('design/TECH-TREE.md')), 'lint: no LATER(V6) markers left in design/TECH-TREE.md');
  // Model v3 E14: no flat factor on agenda speed. lineSpeed holds only the shared research modifiers (siloing, ASIC
  // migration) and the dead-end state: no agenda list, flag or AI-labour term; and the AI team-equivalents are not lifted.
  const lp = read('src/engine/v2/safety/lineProjects.ts');
  const body = (lp.match(/export function lineSpeed\([\s\S]*?\n\}/) ?? [''])[0];
  const flat = [/ag ===/, /AG\d\d/, /flag\(/, /trusted/i, /v \*= [2-9]/, /aar/];
  const fh = flat.filter((re) => re.test(body)).map(String);
  if (/ag17Mult|x\.AI \* lift/.test(lp)) fh.push('AG17 lift on AI team-equivalents');
  if (/×3 while/.test(read('src/data/v2/tree.ts'))) fh.push('tree.ts aar text "×3"');
  check(body.length > 0 && fh.length === 0, 'lint: no flat factor on agenda speed (F44 ×3 and AG17\'s ×(1 + √m) on AI team-equivalents are gone; E14)', fh.join('; '));
  // The ideas are read only where their mechanism lives.
  const where: Record<string, string[]> = { P14: ['src/engine/v2/safety/ideas.ts'], P15: ['src/engine/v2/safety/ideas.ts'], P27: ['src/engine/v2/safety/ideas.ts', 'src/engine/v2/departments/workfit.ts'] };
  const engine = ['src/engine/v2/safety/ideas.ts', 'src/engine/v2/departments/workfit.ts', ...files.filter((f) => f.startsWith('src/engine')), 'src/engine/v2/safety/detection.ts', 'src/engine/v2/safety/understanding.ts'];
  const stray = Object.entries(where).flatMap(([id, ok]) => engine.filter((f) => !ok.includes(f) && new RegExp(`adopted\\(s, '${id}'\\)`).test(read(f))).map((f) => `${id} in ${f}`));
  check(stray.length === 0, 'lint: P14, P15 and P27 are read only by their mechanism (safety/ideas.ts; P27\'s fit in workfit.ts)', stray.join('; '));
  const ids = ['P14', 'P15', 'P23', 'P27'];
  check(!REF_TREE.some((g) => ids.includes(g.id)) && SAFE_TREE_EXTRA.map((g) => g.id).join() === 'P23',
    'RefBot researches none of the four (golden dates unaffected); only the safe bot adds P23', REF_TREE.map((g) => g.id).join(' '));
  // E14: F44 and AG17's harness act only on work handed to AI. F5: RefBot is the only bot that hands safety work to AI
  // (by its believed oversight of the safety model) and it staffs no AG17 line, so neither can move a bot run.
  const bots = readdirSync(join(root, 'src/engine/v2/bots')).filter((f) => f.endsWith('.ts'));
  const handing = bots.filter((f) => /trustedToAI|policy\.trusted|'agents\.trusted/.test(read(`src/engine/v2/bots/${f}`)));
  check(handing.join() === 'ref.ts' && !REF_LINES.some((l) => l.ag === 'AG17'), 'E14 / F5: only RefBot sets Trusted to AI and it runs no AG17 line, so F44 and AG17\'s harness cannot move a bot run', `${handing.join(' ')}; RefBot lines ${REF_LINES.map((l) => l.ag).join(' ')}`);
}

finish('safetyideas');
