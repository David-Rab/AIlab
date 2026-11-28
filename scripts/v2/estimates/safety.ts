// Back-of-envelope estimates: safety rates (see scripts/v2/estimates.ts; design/estimates/MAP-A.md § safetyrates, E2s-report.md).
// The model-organism probes of research/20 F, on ONE typical world (one newGame, never stepped: the medium tl-central
// world with every edge weight at its prior mean w̄ and difficulty 1): one post-training run on the start model V0, built
// with the engine's own `postRunEnv` (the environment applyRunToTraits steps) and stepped once with `stepTraits`.
// Arms: learned hacking (RL on cheap-grader coding suites) vs hacking prevented vs inoculated; capability RL at 10x;
// anti-scheming; the oversight-conditional reward (S9); persistence of conditional traits through safety training
// (removalShare); a distilled student. The engine's functions only: no tick of the game loop.
// `probes(s)` is shared with scripts/v2/safetyrates.ts (the direction checks).
import { EXPLOIT_START } from '../../../src/data/v2/suites';
import { POSITION_BY_ID } from '../../../src/data/v2/starts';
import { EDGES } from '../../../src/data/v2/edges';
import { TRAIT_START } from '../../../src/data/v2/traits';
import { REFERENCE_POST } from '../../../src/data/v2/runDesign';
import { WORK_TYPES } from '../../../src/data/v2/workTypes';
import { defaultSetupV2, newGame } from '../../../src/engine/v2/core/init';
import { gV0 } from '../../../src/engine/v2/models/capability';
import type { FamilyMap } from '../../../src/engine/v2/models/effective';
import { suiteExploitMap } from '../../../src/engine/v2/models/suites';
import { itemTerms } from '../../../src/engine/v2/safety/covert';
import { familyPenalty } from '../../../src/engine/v2/safety/detection';
import {
  afCapGate, distillSignals, distilledStart, hackRates, misalignment, OMEGA_KIND, playerEnv, postRunEnv, removalShare, RHO_REF, stepTraits, type TraitEnv,
} from '../../../src/engine/v2/safety/traits';
import type { GameStateV2, ModelVersion, PostDesign, RLFamily, TraitVector } from '../../../src/engine/v2/types';
import { estOf, type Estimate } from './types';

export const area = 'safety';

/** The families the HCAST-like typical agentic tasks are made of (scripts/v2/safety-emu.ts GENERIC). */
const GENERIC: RLFamily[] = ['computerUse', 'longHorizon', 'cyber', 'bio'];
/** The talent breakaway's raw (unhardened) exploitability per family (RD-T07): the cheap-grader suites. */
const EXPLOIT_CHEAP = Object.fromEntries((Object.keys(EXPLOIT_START) as RLFamily[]).map((f) => [f, EXPLOIT_START[f] * POSITION_BY_ID.talent.exploitMult])) as Record<RLFamily, number>;

const median = (xs: number[]): number => {
  const a = [...xs].sort((p, q) => p - q);
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const post = (o: Partial<PostDesign> = {}): PostDesign => ({ ...REFERENCE_POST, methods: [], ...o });
const withTraits = (v: ModelVersion, x: TraitVector): ModelVersion => ({ ...v, traitsTrue: x, uModes: [] });
/** Cut in the hack-induced rise: 1 − (inoculated − control) / (hacked − control). */
const cut = (ctrl: number, hack: number, inoc: number) => (hack - ctrl > 1e-6 ? 1 - (inoc - ctrl) / (hack - ctrl) : NaN);

/** The typical world: medium tl-central, edge weights at w̄, difficulty 1 (the median of the latent draw). */
export function typicalWorld(): GameStateV2 {
  const s = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 1, tutorial: false }));
  s.hidden.edgeWeights = Object.fromEntries(EDGES.map((e) => [e.id, e.wBar]));
  s.hidden.difficultyMult = 1;
  return s;
}

export interface Probes {
  s: GameStateV2;
  v0: ModelVersion;
  /** Outcome traits of one run on x0 (the arm's design, suites and ρ) and the environment it ran in. */
  run: (x0: TraitVector, p: PostDesign, exploit: FamilyMap | undefined, rho?: number, s9?: number) => { x: TraitVector; env: TraitEnv };
  ctrl: TraitVector; hack: TraitVector; inoc: TraitVector;
  eaRef: number; eaX10: number; eaAS: number; eaNoAS: number; schemeAS: number; schemeNoAS: number;
  afRef: number; afMonitored: TraitVector; afOneBB: number;
  piStd: number; piNoHeal: number; piAF: number; piSand: number; piFrontier: number;
  afStudent: number; afStudentCtrl: number; afTeacher: number;
  xsScheme: TraitVector;
}

/** One post run on `x0` in the typical world: postRunEnv with a run-like (kind post, ρ × the base's FLOP, the design's
 *  suites), stepped once. `s9` sets the oversight-conditional reward (MATS/GDM's monitored-only RL) on the true signals. */
export function probes(s: GameStateV2): Probes {
  const v0 = s.player.models.versions[0];
  const base = s.player.models.bases.find((b) => b.id === v0.baseId);
  if (!base) throw new Error('typical world: no base for V0');
  const run: Probes['run'] = (x0, p, exploit, rho = RHO_REF, s9) => {
    const version = withTraits(v0, x0);
    const r = { id: 'probe', kind: 'post' as const, name: 'probe', baseId: base.id, flopNeeded: rho * base.flop, post: p, recipe: exploit ? { exploit } : undefined };
    const { env } = postRunEnv(s, r, version, x0, undefined, base);
    if (s9 !== undefined) env.signals = { ...env.signals, S9: s9 };
    return { x: stepTraits(x0, env), env };
  };
  const x0 = { ...v0.traitsTrue };
  const start = suiteExploitMap(s);
  const swe = (x: number): FamilyMap => ({ swe: x });
  // Learned hacking (MacDiarmid): RL on coding environments whose graders the model can game vs the same run with hacking
  // prevented vs inoculated (T-INOC owned for the probe).
  const ctrl = run(x0, post(), swe(0)).x;
  const hack = run(x0, post(), swe(EXPLOIT_CHEAP.swe)).x;
  const inocT = s.player.safety.techniques['T-INOC'];
  const inocWas = inocT.unlocked;
  inocT.unlocked = true;
  const inoc = run(x0, post({ methods: ['T-INOC'] }), swe(EXPLOIT_CHEAP.swe)).x;
  inocT.unlocked = inocWas;
  // Capability RL (Schoen): the reference run at ρ_ref vs 10x.
  const ref = run(x0, post(), start);
  const eaX10 = run(x0, post(), start, RHO_REF * 10).x.EA;
  const afMonitored = run(x0, post(), start, RHO_REF, 1).x;
  const afOneBB = run(x0, post(), start, RHO_REF, 0.3).x.AF;
  // Anti-scheming (Schoen): a model with o3's 13% covert-action rate, the reference run with and without T-ANTISCHEME.
  const xs = { ...x0, SCHEME: 0.13 };
  const as = s.player.safety.techniques['T-ANTISCHEME'];
  const asWas = as.unlocked;
  const noAS = run(xs, post(), start);
  as.unlocked = true;
  const withAS = run(xs, post({ methods: ['T-ANTISCHEME'] }), start);
  as.unlocked = asWas;
  // Persistence (Hubinger) through one standard safety run: 1 − the run's removal share (removalShare, crystal factor
  // included); at a frontier model's eval awareness (EA 0.5); and without AG18 healing (the world's benign-generalisation bet 0).
  const xsF = { ...xs, EA: 0.5 };
  const ag18 = s.hidden.agendaEfficacy.AG18;
  s.hidden.agendaEfficacy.AG18 = 0;
  const noHeal = run(xs, post(), start).env;
  s.hidden.agendaEfficacy.AG18 = ag18;
  // E19: a distilled student is a new network (distilledStart, then the run's step at ω_distill on distillation signals).
  const distill = (xt: TraitVector) => { const x = distilledStart(xt); return stepTraits(x, playerEnv(s, x, distillSignals(), OMEGA_KIND.distill, undefined, 'L-probe', [], undefined, v0.G)); };
  const afTeacher = 0.5;
  return {
    s, v0, run, ctrl, hack, inoc, xsScheme: xs,
    eaRef: ref.x.EA, eaX10, eaAS: withAS.x.EA, eaNoAS: noAS.x.EA, schemeAS: withAS.x.SCHEME, schemeNoAS: noAS.x.SCHEME,
    afRef: ref.x.AF, afMonitored, afOneBB,
    piStd: 1 - removalShare(noAS.env, xs, 'SCHEME'), piNoHeal: 1 - removalShare(noHeal, xs, 'SCHEME'),
    piAF: 1 - removalShare(noAS.env, xs, 'AF'), piSand: 1 - removalShare(noAS.env, xs, 'SAND'),
    piFrontier: 1 - removalShare(run(xsF, post(), start).env, xsF, 'SCHEME'),
    afStudent: distill({ ...x0, AF: afTeacher }).AF, afStudentCtrl: distill(x0).AF, afTeacher,
  };
}

export function estimates(): Estimate[] {
  const s = typicalWorld();
  const p = probes(s);
  const { v0 } = p;
  const out: Estimate[] = [];
  const pc = (x: number) => `${(x * 100).toFixed(1)}%`;
  const sab = (x: TraitVector) => itemTerms(s, withTraits(v0, x), 'SAFSAB', 1, WORK_TYPES.SAF_EXP.H, false).attempts;
  const read = (x: TraitVector, fam: 'BB' | 'COT') => x.AF * familyPenalty(s, withTraits(v0, x), 'AF', fam);
  const probeChain = 'typicalWorld (newGame, edge weights at w̄, D 1) → postRunEnv (the env applyRunToTraits steps) → stepTraits';
  const add = (id: string, value: string, m: number, chain: string) => out.push(estOf(id, value, m, chain));

  // F1: hack rate per RL run (hackRates on the suites' exploitability × Gao's pressure).
  const ones = (f: Record<string, number>) => Object.fromEntries(Object.keys(f).map((k) => [k, 1])) as FamilyMap;
  const hrStart = hackRates(ones(EXPLOIT_START), suiteExploitMap(s), RHO_REF);
  const hrCheap = hackRates(ones(EXPLOIT_CHEAP), EXPLOIT_CHEAP, RHO_REF);
  const hT = median(GENERIC.map((f) => hrStart[f] ?? 0));
  add('F1.hackRate.typical', pc(hT), hT, 'hackRates(all families, suiteExploitMap(s), RHO_REF) → median over the generic agentic families');
  add('F1.hackRate.mlCheap', pc(hrCheap.mlResearch ?? 0), hrCheap.mlResearch ?? 0, 'hackRates(all families, EXPLOIT_START × talent exploitMult, RHO_REF) → mlResearch');
  add('F1.hackRate.sweCheap', pc(hrCheap.swe ?? 0), hrCheap.swe ?? 0, 'hackRates(… cheap …) → swe');

  // F2 (MacDiarmid): learned hacking → sabotage and AF reasoning; inoculation.
  add('F2.sabotageAfterHacking', pc(sab(p.hack)), sab(p.hack), `${probeChain} (hack arm) → itemTerms(SAFSAB, share 1, 8 h).attempts`);
  add('F2.sabotageControl', pc(sab(p.ctrl)), sab(p.ctrl), `${probeChain} (hacking prevented) → itemTerms(SAFSAB)`);
  add('F2.afReasoningAfterHacking', pc(read(p.hack, 'COT')), read(p.hack, 'COT'), `${probeChain} (hack arm) → AF × familyPenalty(AF, COT)`);
  add('F2.afReasoningControl', pc(read(p.ctrl, 'COT')), read(p.ctrl, 'COT'), `${probeChain} (control) → AF × familyPenalty(AF, COT)`);
  const inocChain = `${probeChain} ×3 (control / hack / T-INOC) → 1 − (inoc − ctrl)/(hack − ctrl)`;
  const cPersona = cut(p.ctrl.PERSONA, p.hack.PERSONA, p.inoc.PERSONA);
  const cMis = cut(misalignment(p.ctrl), misalignment(p.hack), misalignment(p.inoc));
  const cAf = cut(p.ctrl.AF, p.hack.AF, p.inoc.AF);
  const cSab = cut(sab(p.ctrl), sab(p.hack), sab(p.inoc));
  add('F2.inoculation.persona', pc(cPersona), cPersona, `${inocChain} on PERSONA`);
  add('F2.inoculation.mis', pc(cMis), cMis, `${inocChain} on misalignment()`);
  add('F2.inoculation.af', pc(cAf), cAf, `${inocChain} on AF`);
  add('F2.inoculation.sabotage', pc(cSab), cSab, `${inocChain} on itemTerms(SAFSAB)`);

  // E18: the capability gate on AF growth at V0.
  const gate = afCapGate(gV0(s.hidden.timeline));
  add('E18.afGateAtV0', gate.toFixed(3), gate, 'afCapGate(gV0(timeline))');

  // F5: oversight-conditional reward, capability RL's eval awareness, anti-scheming.
  const gap = read(p.afMonitored, 'BB');
  add('F5.afGapOversightConditional', pc(gap), gap, `${probeChain} (S9 = 1) → AF × familyPenalty(AF, BB)`);
  const eaRise = p.eaX10 - p.eaRef;
  add('F5.eaRisePerOOM', eaRise.toFixed(3), eaRise, `${probeChain} at ρ and 10ρ → EA(10ρ) − EA(ρ)`);
  const eaMult = p.eaAS / p.eaNoAS;
  add('F5.antiScheming.eaMultiplier', `x${eaMult.toFixed(2)}`, eaMult, `${probeChain} with and without T-ANTISCHEME (SCHEME 0.13) → EA ratio`);
  const asCut = 1 - p.schemeAS / p.schemeNoAS;
  add('F5.antiScheming.cut', pc(asCut), asCut, `${probeChain} with and without T-ANTISCHEME → 1 − SCHEME ratio`);

  // F6: persistence of a conditional behaviour through one standard safety run (1 − removalShare).
  const persist = (id: string, x: number, what: string) => add(id, pc(x), x, `postRunEnv (${what}) → 1 − removalShare(env, x0, trait)`);
  persist('F6.persistence.schemeStart', p.piStd, 'SCHEME 0.13 at V0 EA');
  persist('F6.persistence.noHealing', p.piNoHeal, 'SCHEME, the world\'s AG18 efficacy set to 0');
  persist('F6.persistence.af', p.piAF, 'AF');
  persist('F6.persistence.sand', p.piSand, 'SAND');
  persist('F6.persistence.frontierEA', p.piFrontier, 'SCHEME at EA 0.5');

  // F3: a distilled student is a new network: the share of a teacher's AF excess it carries.
  const carried = (p.afStudent - p.afStudentCtrl) / (p.afTeacher - TRAIT_START.AF);
  add('F3.distilledTransfer', pc(carried), carried, 'distilledStart → playerEnv(distillSignals, ω_distill) → stepTraits, from a teacher with AF 0.5 vs from V0');
  return out;
}
