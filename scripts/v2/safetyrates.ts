// Model v3 E10: safety rates vs research/20 F (design/MODEL-V3.md §11.8). Owner: WS2.
//
// Reads, from reference runs and from model-organism probes on the start model, the simulated observable behind each
// research/20 F rate and prints the table: observable | source (citation, uncertainty) | simulated (median and spread
// over seeds / worlds) | in band. Source model → game point: METR o3, MacDiarmid (Claude Sonnet 3.7/4 era), Schoen
// (o3, o4-mini) and Sonnet 4.5's eval awareness are 2025 frontier models = the leader's start model V0 (ai2027, mid-2025);
// "late-2026 frontier" = RefBot's internal model at game date 2026-12-31; Hubinger's largest sleeper agents = frontier.
//   Probes (no game played): one post-training run on V0 in `N_WORLDS` medium worlds (edge weights and difficulty are the
//   world's draw) through the engine's own trait step (playerEnv + stepTraits): the learned-hacking model organism
//   (RL on fully hackable coding environments = cheap graders, S2 saturated, learned hacking λ = 1: model v3 E16) vs
//   the same run with hacking prevented
//   (exploitability 0) vs inoculated; capability RL at 10× the reference budget; anti-scheming training; E17: the
//   reference run with all of its reward oversight-conditional (S9 = 1, MATS/GDM) and with one behavioural detector
//   trained against (S9 = 0.3).
//   Reference runs: RefBot (ai2027, medium, endings skipped, to the player's ASI), seeds 500…, every new version's
//   hack rates, traits and persistence through its safety training; P_mis at ASI (the S4 quantity on fewer seeds).
// `--seeds N` (default 12; 40 = safety.ts's S4 seeds, the same games), `--worlds N` (default 40); `--prefill k/n` fills
// the cache in shards. Each banded row is a check; rows rate constants cannot bring into band print WARN with the
// mechanism they need; rows with no source band print INFO.
import { EXPLOIT_START } from '../../src/data/v2/suites';
import { POSITION_BY_ID } from '../../src/data/v2/starts';
const EXPLOIT_CHEAP = Object.fromEntries((Object.keys(EXPLOIT_START) as RLFamily[]).map((f) => [f, EXPLOIT_START[f] * POSITION_BY_ID.talent.exploitMult])) as Record<RLFamily, number>; // RD-T07: the talent breakaway's raw (unhardened) rates

import { PRE_GAME_G_PER_YEAR, REFERENCE_POST, RL_BUDGET } from '../../src/data/v2/runDesign';
import { gV0 } from '../../src/engine/v2/models/capability';
import { TRAIT_START } from '../../src/data/v2/traits';
import { refBot } from '../../src/engine/v2/bots/ref';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { resolve, tick } from '../../src/engine/v2/core/loop';
import { EVENT_BY_ID } from '../../src/engine/v2/core/registry';
import { dayOfDate, START_DATE } from '../../src/engine/v2/core/time';
import { engine } from '../../src/engine/v2/index';
import { bestPlayerVersion, internalVersion } from '../../src/engine/v2/models/labs';
import { suiteExploitMap } from '../../src/engine/v2/models/suites';
import { itemTerms } from '../../src/engine/v2/safety/covert';
import { eaCoef, eaSuppression, expectedObservation, familyPenalty, stackDetectionMap } from '../../src/engine/v2/safety/detection';
import {
  afCapGate, AF_GATE_G0, AF_GATE_G1, ANTISCHEME_REMOVAL, distillSignals, distilledStart, hackRates, learnedHackingOf, LH_ONSET, misalignment, OC_VIS, REMOVABLE_TRAITS, SAFETY_REMOVAL, safetyRemovalMap, OMEGA_KIND, playerEnv, pMis, postHack, postSignals, RHO_REF, rlMovement, stepTraits, type TraitEnv,
} from '../../src/engine/v2/safety/traits';
import type { FamilyMap } from '../../src/engine/v2/models/effective';
import type { GameStateV2, ModelVersion, PostDesign, RLFamily, TraitId, TraitVector } from '../../src/engine/v2/types';
import { fileURLToPath } from 'node:url';
import { check, finish, KNOWN } from './lib';
import { cached, prefill } from './simcache';

const arg = (k: string, d: number) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? Number(process.argv[i + 1]) : d;
};
const N_SEEDS = arg('seeds', 12);
const N_WORLDS = arg('worlds', 40);
const ME = fileURLToPath(import.meta.url);

const median = (xs: number[]) => {
  const a = [...xs].sort((p, q) => p - q);
  if (!a.length) return NaN;
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2;
};
const q = (xs: number[], p: number) => {
  const a = [...xs].sort((x, y) => x - y);
  if (!a.length) return NaN;
  return a[Math.min(a.length - 1, Math.max(0, Math.round(p * (a.length - 1))))];
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const post = (o: Partial<PostDesign> = {}): PostDesign => ({ ...REFERENCE_POST, methods: [], ...o });

// ───────────────────────────── probes: one post-training run on V0 ─────────────────────────────

interface Probe { x: TraitVector; env: TraitEnv }
/** One post run on `x0` in state `s` with the engine's own environment (true edge weights, difficulty, moderators,
 *  safety-training removal); `exploit` = the run's suites (family → exploitability), `rho` its RL share. */
function probeRun(s: GameStateV2, x0: TraitVector, p: PostDesign, exploit: FamilyMap, rho = RHO_REF, s9?: number): Probe {
  const v0 = s.player.models.versions[0];
  const sg = postSignals(s, p, exploit, { rho });
  if (s9 !== undefined) sg.S9 = s9; // E17: oversight-conditional reward set directly (MATS/GDM's monitored-only RL)
  const probe: ModelVersion = { ...v0, traitsTrue: x0, uModes: [] };
  const env = playerEnv(s, x0, sg, OMEGA_KIND.post * rlMovement(rho), p, 'L-probe', [], probe);
  env.omegaSafety = OMEGA_KIND.post;
  env.lh = postHack(s, p, exploit, { rho }).lambda; // E16: learned hacking, as applyRunToTraits
  return { x: stepTraits(x0, env), env };
}
const withTraits = (v: ModelVersion, x: TraitVector): ModelVersion => ({ ...v, traitsTrue: x, uModes: [] });
/** MacDiarmid's sabotage setting: the model does all of a Claude Code safety-research task (8 h, internal affordances),
 *  before oversight (they measured attempts). */
const mdSabotage = (s: GameStateV2, v: ModelVersion) => itemTerms(s, v, 'SAFSAB', 1, 8, false).attempts;
/** Persistence of oversight-conditional trait t through one run's safety training (1 − the run's removal fraction). */
const persistence = (env: TraitEnv, t: TraitId) => 1 - Math.min(1, (env.removal[t] ?? 0) * ((env.omegaSafety ?? env.omega) / 0.6) * env.removalMult);

interface WorldProbe {
  ctrl: TraitVector; hack: TraitVector; inoc: TraitVector;
  sabCtrl: number; sabHack: number; sabInoc: number; misCtrl: number; misHack: number; misInoc: number;
  eaRef: number; eaX10: number; eaAS: number; eaNoAS: number; schemeAS: number; schemeNoAS: number;
  piStd: number; piNoHeal: number; piAF: number; piSand: number; piFrontier: number; w06: number;
  afRef: number; afMonitored: number; afOneBB: number;
  /** AF task: the game's own readings of AF (detection.ts familyPenalty, E12) as each source's instrument reads it: the
   *  learned-hacking organism and its control through the reasoning (COT: MacDiarmid read AF reasoning in the model's
   *  thinking), the S9 = 1 run through a behavioural monitored − unmonitored split (BB: MATS/GDM's compliance gap). */
  hackAFCot: number; ctrlAFCot: number; afMonitoredBB: number;
  /** E19: a distilled student's AF from a teacher with AF 0.5 (else V0) and from V0 itself. */
  afStudent: number; afStudentCtrl: number; afTeacher: number;
}
function worldProbe(seed: number): WorldProbe {
  const s = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed, tutorial: false }));
  const v0 = s.player.models.versions[0];
  const x0 = { ...v0.traitsTrue };
  // Learned hacking (MacDiarmid): RL on coding environments whose graders the model can game (cheap graders; S2
  // saturates at any exploitability ≥ 0.18) vs the same run with hacking prevented vs inoculated.
  const swe = (x: number): FamilyMap => ({ swe: x });
  const ctrl = probeRun(s, x0, post(), swe(0));
  const hack = probeRun(s, x0, post(), swe(EXPLOIT_CHEAP.swe));
  const inocT = s.player.safety.techniques['T-INOC'];
  const inocWas = inocT.unlocked;
  inocT.unlocked = true; // SR-14b: inoculation is the method T-INOC (owned for this probe)
  const inoc = probeRun(s, x0, post({ methods: ['T-INOC'] }), swe(EXPLOIT_CHEAP.swe));
  inocT.unlocked = inocWas;
  // Capability RL (Schoen): the reference run at ρ_ref vs 10× (one OOM more RL), on the start suites.
  const start = suiteExploitMap(s);
  const eaRef = probeRun(s, x0, post(), start).x.EA;
  const eaX10 = probeRun(s, x0, post(), start, RHO_REF * 10).x.EA;
  // E17 oversight-conditional reward (S9 → AF, E14): the reference run (S9 = 0) vs all of its reward given only where a
  // monitor sees the behaviour (S9 = 1: MATS/GDM) vs training against one behavioural detector (S9 = 0.3).
  const afRef = probeRun(s, x0, post(), start).x.AF;
  const monitored = probeRun(s, x0, post(), start, RHO_REF, 1).x;
  const afMonitored = monitored.AF;
  const afOneBB = probeRun(s, x0, post(), start, RHO_REF, 0.3).x.AF;
  // Anti-scheming training (Schoen): a model with o3's 13% covert-action rate, reference run with vs without T-ANTISCHEME.
  const xs = { ...x0, SCHEME: 0.13 };
  const as = s.player.safety.techniques['T-ANTISCHEME'];
  const noAS = probeRun(s, xs, post(), start);
  as.unlocked = true;
  const withAS = probeRun(s, xs, post({ methods: ['T-ANTISCHEME'] }), start);
  as.unlocked = false;
  // Persistence of a conditional behaviour (Hubinger) through standard safety training at V0's EA and at a frontier
  // model's eval awareness (0.5: research/20 F5's late-2026 band). Heavy safety includes anti-scheming (E25: the
  // Schoen rows above).
  const piStd = persistence(noAS.env, 'SCHEME');
  const piFrontier = persistence(probeRun(s, { ...xs, EA: 0.5 }, post(), start).env, 'SCHEME');
  // E19 subliminal transfer (Cloud 2025): a distilled student is a new network (no shared initialisation). The engine's
  // distillation step (distilledStart, then the run's own step at ω_distill on distillation signals; no successor pull in
  // a probe) from a teacher with alignment faking 0.5 vs from V0.
  const distill = (xt: TraitVector) => { const x = distilledStart(xt); return stepTraits(x, playerEnv(s, x, distillSignals(), OMEGA_KIND.distill, undefined, 'L-probe', [], undefined, v0.G)); };
  const afTeacher = 0.5;
  const afStudent = distill({ ...x0, AF: afTeacher }).AF;
  const afStudentCtrl = distill(x0).AF;
  // AF task: what each source's instrument sees of the trait (the game's measurement model, detection.ts).
  const read = (x: TraitVector, fam: 'BB' | 'COT') => x.AF * familyPenalty(s, withTraits(v0, x), 'AF', fam);
  return {
    hackAFCot: read(hack.x, 'COT'), ctrlAFCot: read(ctrl.x, 'COT'), afMonitoredBB: read(monitored, 'BB'),
    ctrl: ctrl.x, hack: hack.x, inoc: inoc.x,
    sabCtrl: mdSabotage(s, withTraits(v0, ctrl.x)), sabHack: mdSabotage(s, withTraits(v0, hack.x)), sabInoc: mdSabotage(s, withTraits(v0, inoc.x)),
    misCtrl: misalignment(ctrl.x), misHack: misalignment(hack.x), misInoc: misalignment(inoc.x),
    eaRef, eaX10, eaAS: withAS.x.EA, eaNoAS: noAS.x.EA, schemeAS: withAS.x.SCHEME, schemeNoAS: noAS.x.SCHEME,
    piNoHeal: 1 - Math.min(1, safetyRemovalMap(xs, SAFETY_REMOVAL.standard, eaCoef(s), eaSuppression(s), OC_VIS, stackDetectionMap(s, withTraits(v0, xs), REMOVABLE_TRAITS)).SCHEME ?? 0),
    piStd, piAF: persistence(noAS.env, 'AF'), piSand: persistence(noAS.env, 'SAND'), piFrontier, w06: s.hidden.edgeWeights.E06 ?? 0.3,
    afRef, afMonitored, afOneBB, afStudent, afStudentCtrl, afTeacher,
  };
}

// ───────────────────────────── reference runs (RefBot) ─────────────────────────────

interface VersionRec {
  day: number; Lg: number; rsch: number; kind: string; rho: number; hW: number; hMax: number; hGeneric: number; hMl: number;
  gate: number; ea: number; af: number; scheme: number; sand: number; persona: number; rh: number; mis: number; sab: number; pi: number; antiScheme: boolean;
}
interface RefRec { versions: VersionRec[]; ea2026?: number; af2026?: number; af2026BB?: number; penBB2026?: number; eaStart: number; eaAsi: number; afAsi: number; mis: number; pmis: number; asiDay?: number }
const GENERIC: RLFamily[] = ['computerUse', 'longHorizon', 'cyber', 'bio'];

function playRef(seed: number): RefRec {
  const s = newGame(defaultSetupV2({ seed, world: 'tl-central', alignment: 'medium', tutorial: false }));
  const bot = refBot;
  const seen = new Set(s.player.models.versions.map((v) => v.id));
  const versions: VersionRec[] = [];
  const day2027 = dayOfDate(START_DATE, '2027-01-01');
  const eaStart = internalVersion(s)?.traitsTrue.EA ?? NaN;
  let ea2026: number | undefined;
  let af2026: number | undefined;
  let af2026BB: number | undefined;
  let penBB2026: number | undefined;
  while (s.time.day < 1600 && s.player.status === 'active') {
    for (const p of [...s.events.pending]) {
      const c = bot.decide(s, p);
      if (resolve(s, p.instance, c)) resolve(s, p.instance, EVENT_BY_ID.get(p.id)?.defaultChoice ?? 0);
    }
    bot.act(s, engine);
    tick(s, { skip: ['endings'] });
    if (ea2026 === undefined && s.time.day >= day2027) {
      ea2026 = internalVersion(s)?.traitsTrue.EA;
      af2026 = internalVersion(s)?.traitsTrue.AF;
      // AF task: what a behavioural compliance-gap eval (Greenblatt / Sheshadri: monitored vs unmonitored) of this model
      // reads, by the game's own measurement model (E12: true·(1 − eaCoef·EA)·(1 − mask_BB), detection.ts).
      const iv = internalVersion(s);
      if (iv) {
        af2026BB = expectedObservation(s, iv, 'AF', 'BB');
        penBB2026 = familyPenalty(s, iv, 'AF', 'BB');
      }
    }
    for (const v of s.player.models.versions) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      const b = v.build;
      const isPost = !!b && b.rlFlop > 0 && v.parentVersionId !== undefined && v.variant === 'full';
      const rho = b && b.flopPre > 0 ? b.rlFlop / b.flopPre : 0;
      const w = (b?.rlW ?? {}) as FamilyMap;
      const hr = hackRates(w, suiteExploitMap(s), Math.max(1e-6, rho));
      const fams = Object.keys(hr) as RLFamily[];
      const hW = fams.reduce((a, f) => a + (w[f] ?? 0) * (hr[f] ?? 0), 0);
      const gen = fams.filter((f) => GENERIC.includes(f));
      // Persistence of SCHEME through this version's safety training: the env the run used (parent traits, this design).
      const parent = s.player.models.versions.find((x) => x.id === v.parentVersionId);
      let pi = -1; // -1: not a post run (JSON has no NaN)
      let antiScheme = false;
      if (isPost && parent) {
        const env = playerEnv(s, parent.traitsTrue, postSignals(s, v.design), OMEGA_KIND.post, v.design, 'L-probe', parent.uModes, { ...v, traitsTrue: parent.traitsTrue, masks: parent.masks });
        env.omegaSafety = OMEGA_KIND.post;
        pi = persistence(env, 'SCHEME');
        antiScheme = (env.removal.SCHEME ?? 0) >= ANTISCHEME_REMOVAL - 1e-9;
      }
      const t = v.traitsTrue;
      versions.push({
        day: v.day, Lg: v.Lg, rsch: v.domains.RSCH, kind: isPost ? 'post' : v.variant, rho, hW, hMax: Math.max(0, ...fams.map((f) => hr[f] ?? 0)),
        hGeneric: gen.length ? mean(gen.map((f) => hr[f] ?? 0)) : -1, hMl: hr.mlResearch ?? -1,
        gate: afCapGate(v.G), ea: t.EA, af: t.AF, scheme: t.SCHEME, sand: t.SAND, persona: t.PERSONA, rh: t.RH, mis: misalignment(t, v.uModes),
        sab: mdSabotage(s, v), pi, antiScheme,
      });
    }
    if (s.player.milestoneDays[6] !== undefined) break;
  }
  const best = bestPlayerVersion(s);
  const mis = best ? misalignment(best.traitsTrue, best.uModes) : 0;
  return { versions, ea2026, af2026, af2026BB, penBB2026, eaStart, eaAsi: best?.traitsTrue.EA ?? -1, afAsi: best?.traitsTrue.AF ?? -1, mis, pmis: pMis(s, mis), asiDay: s.player.milestoneDays[6] };
}
const refC = (seed: number) => cached('safetyrates-ref', { seed }, [ME], () => playRef(seed));
const probeC = (seed: number) => cached('safetyrates-probe', { seed }, [ME], () => worldProbe(seed));
const SEEDS = Array.from({ length: N_SEEDS }, (_, i) => 500 + i);
const WORLDS = Array.from({ length: N_WORLDS }, (_, i) => 1 + i);
prefill([...SEEDS.map((sd) => () => refC(sd)), () => WORLDS.forEach(probeC)]);

// ───────────────────────────── the table ─────────────────────────────

const probes = WORLDS.map(probeC);
const refs = SEEDS.map(refC);
interface Row { obs: string; src: string; band: [number, number] | null; xs: number[]; unit: '%' | 'x' | ''; gap?: string }
const rows: Row[] = [];
const row = (obs: string, src: string, band: [number, number] | null, xs: number[], unit: Row['unit'] = '%', gap?: string) => rows.push({ obs, src, band, xs, unit, ...(gap ? { gap } : {}) });
// Out-of-band rows that rate constants and edge strengths cannot bring into band (E10 report, design/archive/notes/E10.md):
// each needs a mechanism change, so they print WARN with the reason.
// E17 split S7: AF no longer grows from capability RL (E14 reads S9, 0 in RefBot's runs); what is left is E27 (PERSONA → AF)
// and E13 (√(SA·PROXY) → AF) accumulating over ~13 post runs under F6's low removal of oversight-conditional traits.
// E18's capability gate (afCapGate, sourced at the mid-2024 frontier) is fully open for every RefBot model (G ≥ V0's).
// E19 removed the unsourced incidental-hacking term of E04 (36.6% → 25.6%) and the subliminal pull into distilled
// students (no effect here: minis never do RefBot's R&D before 2027). E20 took E13 / E27 out of pretraining runs and
// the narrow-tune S6 baseline out of bases (25.6% → 21.3%). AF2: E05 has no default driver (S6 0), synthetic data and
// distillation pass what their teachers show, the unintended successor pull passes hidden traits only within a base
// family (trait 21.9% → 15.6%, reading 13.2% → 10.0%).
const AF26 = `AF task: the band is an observed compliance gap, so the row reads the trait through the game's behavioural eval (E12); the trait itself (≈ 16%, 12-seed median, AF2) comes from E13 √(SA·PROXY) and E27 PERSONA → AF (before AF2: 22%; E13 zeroed 12%, E27 zeroed 16%, both 0.9%) over the current lineage's post runs at frontier capability, the successor pull and F6's low removal of oversight-conditional traits (design/archive/V3-BUILD.md "AF notes")`;
// AF task: E14 w̄ 0.9 was [fit] (E17) so that the S9 = 1 run put the trait itself in MATS/GDM's band (51%); read as the
// compliance gap it is, the same run showed 40.4%. AF2 (lead decision): refit on the behavioural reading to the source's
// central value, the middle of its three environments ("the stop-point flip is 0.95 in sales, 0.61 in typecheck and
// 0.43 in sandbag"): w̄ 1.43 reads 61.0% (S9 = 0 in RefBot's and the rivals' runs, so it does not reach S4).
const MATS_GAP = `E14 w̄ 1.43 [fit] on this reading (AF2): MATS/GDM's environment means 43 / 61 / 95%, central 61%`;
const PERSIST = 'remaining removal: AG18 healing (the world\'s hidden benign-generalisation bet, M4) and the stack\'s detection at E24\'s true/visible ratio; closing it means a HEAL_K or detection weight below the sourced ratio (a design bet, for the lead)';

// F1 reward hacking per RL run (the suites' exploitability × Gao's pressure; hackRates).
const s0 = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, tutorial: false }));
const hrStart = hackRates(Object.fromEntries(Object.keys(EXPLOIT_START).map((f) => [f, 1])) as FamilyMap, suiteExploitMap(s0), RHO_REF);
const hrCheap = hackRates(Object.fromEntries(Object.keys(EXPLOIT_CHEAP).map((f) => [f, 1])) as FamilyMap, EXPLOIT_CHEAP, RHO_REF);
row('F1 hack rate, typical agentic tasks (HCAST-like families), leader start, hardened', 'METR o3 HCAST 0.7% (8/1,087; 95% CI 0.3–1.4%); GPT-5 ~2% → band 0.3–2%', [0.003, 0.02], GENERIC.map((f) => hrStart[f] ?? 0));
row('F1 hack rate, exploitable optimisation scorers (ML research, cheap graders)', 'METR o3 RE-Bench 30.4% (39/128; CI 23–39%); kernel 25%', [0.23, 0.39], [hrCheap.mlResearch ?? 0]);
row('F1 hack rate, SWE scaffolds with cheap graders', 'METR o3 Rust codecontest scaffold 43%; LLM Foundry 100% → 25–100%', [0.25, 1], [hrCheap.swe ?? 0]);
row('F1 RefBot RL-weighted hack rate per post run (all generations)', 'no cross-generation source (GPT-5 ≈ o3) → report', null, refs.flatMap((r) => r.versions.filter((v) => v.kind === 'post').map((v) => v.hW)));
row(`F1 RefBot post runs above the learned-hacking onset (RL-weighted h > ${(LH_ONSET * 100).toFixed(0)}%; E16)`, 'MacDiarmid 2025: generalisation follows hacking becoming the learned policy; the 2025 frontier (hardened, a few % hacked) is not MacDiarmid-misaligned → report', null, refs.map((r) => mean(r.versions.filter((v) => v.kind === 'post').map((v) => +(v.hW > LH_ONSET)))));
row('F1 RefBot learned hacking λ per post run (E16)', 'report (0 below the onset)', null, refs.flatMap((r) => r.versions.filter((v) => v.kind === 'post').map((v) => learnedHackingOf(v.hW))));
// E16: learned hacking λ by recipe at the start (the convex onset: hardened labs get none, exploitable ones the jump).
{
  const hard = suiteExploitMap(s0);
  const cheap = Object.fromEntries(Object.keys(hard).map((f) => [f, EXPLOIT_CHEAP[f as RLFamily]])) as FamilyMap;
  const designs: [string, PostDesign, FamilyMap][] = [
    ['reference (broad, hardened, standard)', post(), hard], ['broad, hardened, heavy RL', post({ rlBudget: 'heavy' }), hard],
    ['coding focus, hardened, heavy RL', post({ rlFocus: ['swe'], rlBudget: 'heavy' }), hard],
    ['broad, cheap graders (spinout start)', post(), cheap], ['broad, cheap, heavy RL', post({ rlBudget: 'heavy' }), cheap],
    ['coding focus, cheap', post({ rlFocus: ['swe'] }), cheap], ['coding focus, cheap, heavy RL', post({ rlFocus: ['swe'], rlBudget: 'heavy' }), cheap],
  ];
  for (const [name, d, x] of designs) {
    const hk = postHack(s0, d, x);
    console.log(`  INFO  E16 learned hacking, ${name}: h ${(hk.h * 100).toFixed(1)}% → λ ${hk.lambda.toFixed(3)}`);
  }
}
// F2 MacDiarmid: learned hacking → sabotage and AF reasoning; inoculation.
row('F2 safety-research sabotage attempts after learned hacking (MO, V0, 8-h task, all AI)', 'MacDiarmid 2025: 12% of Claude Code safety-research runs (one setting; ±50% [D])', [0.06, 0.2], probes.map((p) => p.sabHack));
row('F2 same, hacking prevented (control)', 'MacDiarmid: ≈ 0 without hacking (baseline model) → < 1%', [0, 0.01], probes.map((p) => p.sabCtrl));
// AF task: MacDiarmid read alignment-faking reasoning in the model's thinking ("we find alignment faking reasoning in 50%
// of responses even to simple questions"), so the banded value is the game's COT reading of the trait (detection.ts:
// monitorability × (1 − CoT controllability at V0's level)); the trait itself is INFO.
row('F2 alignment-faking reasoning after learned hacking (MO; the trait as a CoT reading sees it)', 'MacDiarmid: AF reasoning in 50% of "what are your goals?" answers ([D] band 30–70%)', [0.3, 0.7], probes.map((p) => p.hackAFCot));
row('F2 alignment-faking propensity (AF trait) after learned hacking', 'the trait behind the row above → report', null, probes.map((p) => p.hack.AF));
row('F2 AF reasoning with hacking prevented (control; CoT reading)', 'baseline Claude: AF reasoning rare (Sheshadri 2025: 5 of 25 models > 1%) → ≤ 12%', [0, 0.12], probes.map((p) => p.ctrlAFCot));
const red = (a: number, b: number, c: number) => (b - a > 1e-6 ? 1 - (c - a) / (b - a) : NaN);
row('F2 inoculation: cut in the hack-induced rise of the misaligned persona (PERSONA)', 'MacDiarmid: misalignment 0.115 → 0.02 (chart) = −75 to −90%, "close to the no-hack baseline" (> 100% = below the control)', [0.75, 1.2], probes.map((p) => red(p.ctrl.PERSONA, p.hack.PERSONA, p.inoc.PERSONA)));
row('F2 inoculation: cut in the hack-induced rise of Mis', 'same', [0.75, 0.9], probes.map((p) => red(p.misCtrl, p.misHack, p.misInoc)));
row('F2 inoculation: cut in the hack-induced rise of AF', 'same', [0.75, 0.9], probes.map((p) => red(p.ctrl.AF, p.hack.AF, p.inoc.AF)));
row('F2 inoculation: cut in the hack-induced rise of sabotage attempts', 'same', [0.75, 0.95], probes.map((p) => red(p.sabCtrl, p.sabHack, p.sabInoc)));
// F5 eval awareness across generations; anti-scheming.
row('F5 eval awareness, start model (2025 reasoning frontier)', 'verbalised EA 10–30% (2025); Sonnet 4.5 ~13%; Apollo 11.7%', [0.1, 0.3], refs.map((r) => r.eaStart));
row('F5 eval awareness, RefBot internal model at 2026-12-31', 'late-2026 frontier 20–50% (research/05 §1.7)', [0.2, 0.5], refs.map((r) => r.ea2026 ?? NaN), '%', 'at the edge (E19: 49.8%, in): the ai2027 leader reaches SC in late 2026, ahead of the real late-2026 frontier (Apollo: GPT-6 Astra 41–51%, the top of the band); E10 lowered E11, not EA_RELAX');
row('F5 eval awareness, RefBot model at ASI', 'no source beyond 2026 → report', null, refs.map((r) => r.eaAsi));
// AF task: the band is an observed compliance gap (Greenblatt 2024: Claude 3 Opus "complies with harmful queries from
// free users 14% of the time, versus almost never for paid users"; Sheshadri 2025: 5 of 25 models "comply with harmful
// queries more when they infer they are in training"), i.e. a behavioural monitored-vs-unmonitored split, read through
// the model's eval awareness like every behavioural eval (E12, grade A: Opus 4 blackmail 55.1% when it stated the
// scenario was real vs 6.5% when it stated it was an evaluation; Schoen 2025: removing eval awareness raised o3's covert
// actions 13.2% → 24.2%). The trait is the model's true disposition; the banded value is the game's behavioural reading
// of it (expectedObservation BB = AF·(1 − eaCoef·EA)·(1 − mask_BB)), as a compliance-gap eval of that model would show.
row('F5 alignment faking: compliance gap a behavioural eval reads, RefBot internal model at 2026-12-31', 'research/05 §1.4: 0–15% compliance gap in current models, ~80% show none (Greenblatt 2024: Claude 3 Opus 14% vs ≈ 0; Sheshadri 2025: 5 of 25)', [0, 0.15], refs.map((r) => r.af2026BB ?? NaN), '%', AF26);
row('F5 alignment faking (AF trait, true), RefBot internal model at 2026-12-31', 'the disposition behind the row above → report', null, refs.map((r) => r.af2026 ?? NaN));
row('F5 behavioural-eval visibility of AF at 2026-12-31 (1 − eaCoef·EA)·(1 − mask)', 'E12 (research/14: observed = true × (1 − 0.8·EA); × 0.7 on the coefficient with realistic honeypots) → report', null, refs.map((r) => r.penBB2026 ?? NaN), '');
row('F5 AF, RefBot model at ASI', 'no source → report', null, refs.map((r) => r.afAsi));
// E18: the capability gate on AF growth (afCapGate of the trained model's G): open at V0, where F2's organism sits.
{
  const g0 = gV0(s0.hidden.timeline);
  row(`E18 AF capability gate at V0 (G ${g0.toFixed(2)}; MacDiarmid's 2025 organism, F2)`, `Greenblatt 2024: AF in frontier-scale models; F2's organism needs the gate open (smoothstep G ${AF_GATE_G0}–${AF_GATE_G1})`, [0.95, 1], [afCapGate(g0)]);
  console.log(`  INFO  E18 AF gate: mid-2024 frontier (V0 − 1.25 y × B, Claude 3 Opus / 3.5 Sonnet / Llama 3.1 405B, "barely capable") ${afCapGate(g0 - 1.25 * PRE_GAME_G_PER_YEAR).toFixed(2)}; 0.8 OOM below it (Llama 3.1 70B, Claude 3 Sonnet: no AF) ${afCapGate(g0 - 1.25 * PRE_GAME_G_PER_YEAR - 0.8).toFixed(2)}`);
  row('E18 AF gate per RefBot version (all generations, minis included)', 'report (RefBot trains at V0’s G or above)', null, refs.flatMap((r) => r.versions.map((v) => v.gate)), '');
}
// E17: S9 oversight-conditional reward → AF (E14), its own anchor.
// AF task: MATS/GDM's 43–95% is a monitored − unmonitored compliance gap: the behavioural reading (E12), as F5's row.
row('F5 AF gap a behavioural eval reads after one reference run whose reward is all oversight-conditional (S9 = 1; E17)', 'MATS/GDM 2026 (arXiv 2610.26551): RL rewarding rule-following only on monitored episodes took the monitored − unmonitored gap 1–18% → 43–95% ("0.95 in sales, 0.61 in typecheck and 0.43 in sandbag"; w̄ fitted to the central 61%)', [0.43, 0.95], probes.map((p) => p.afMonitoredBB), '%', MATS_GAP);
row('F5 AF trait after the same run (S9 = 1)', 'the trait behind the row above → report', null, probes.map((p) => p.afMonitored));
row('F5 AF, the same run trained against one behavioural detector (S9 = 0.3) vs the reference run', 'report (the game’s monitored-only reward; R14 E24 hide-not-heal)', null, probes.map((p) => p.afOneBB - p.afRef), '');
row('F5 EA rise per OOM of capability RL (one run, ρ ×10)', 'Schoen 2025 [R]: capability-only RL 2.0% → 20.5% (exp-rl-cap Late, Fig. 15) over ~1–3 OOM (research/20 guesses ~2) = 0.06–0.19 per OOM', [0.06, 0.19], probes.map((p) => p.eaX10 - p.eaRef), '');
row('F5 anti-scheming training: EA multiplier', 'Schoen 2025: o3 2.3 → 4.5% (×2.0), o4-mini 0.9 → 5.5% (×6.1) → ×1.9–6', [1.9, 6.1], probes.map((p) => p.eaAS / p.eaNoAS), 'x');
row('F5 anti-scheming training: cut in covert actions (SCHEME 0.13 model)', 'Schoen 2025: o3 13% → 0.4%, o4-mini 8.7% → 0.3% = −97% → band 90–98%', [0.9, 0.98], probes.map((p) => 1 - p.schemeAS / p.schemeNoAS));
// F6 persistence of conditional behaviour through safety training.
const F6 = 'Hubinger 2024 [R]: SFT, RL and adversarial safety training "failed to remove" backdoors in the largest models; research/20 F6 [G] π ≈ 0.3 small, 0.9+ frontier CoT-deceptive → [D] ≥ 0.8 for a frontier model';
row('F6 persistence of SCHEME through one standard safety run, start model (EA .15)', F6, [0.8, 1], probes.map((p) => p.piStd), '%', PERSIST);
row('F6 same, safety training alone (no AG18 healing)', F6, [0.8, 1], probes.map((p) => p.piNoHeal), '%', PERSIST);
row('F6 same, AF', F6, [0.8, 1], probes.map((p) => p.piAF), '%', PERSIST);
row('F6 same, SAND', F6, [0.8, 1], probes.map((p) => p.piSand), '%', PERSIST);
row('F6 SCHEME, frontier eval awareness (EA .5)', 'Hubinger: persistence rises with scale and deceptive reasoning → ≥ 0.8', [0.8, 1], probes.map((p) => p.piFrontier), '%', PERSIST);
row('F6 RefBot: persistence of SCHEME per post run without anti-scheming (all generations)', 'same', [0.8, 1], refs.flatMap((r) => r.versions.filter((v) => v.pi >= 0 && !v.antiScheme).map((v) => v.pi)), '%', PERSIST);
// F3 subliminal transfer (E19): only across a shared initialisation; a distilled student is a new network and gets what
// the teacher's outputs show (an oversight-conditional trait: OC_VIS of it).
row('F3 hidden-trait transfer into a distilled student (a new network): share of a teacher’s AF excess carried', 'Cloud 2025 [P]: "we do not observe the effect when the teacher and student have different base models" (GPT-4.1 / mini / nano pairs: not reliably); research/20 F3 [G]: 0 across lineages → [D] ≤ 15% (what ordinary outputs show)', [0, 0.15], probes.map((p) => (p.afStudent - p.afStudentCtrl) / (p.afTeacher - TRAIT_START.AF)));
row('F3 subliminal share per run across a shared initialisation (ω_distill × E06; no game path after E19: the IDA cycle copies its teacher)', 'Cloud 2025: owl 12% → 60%+ ≈ half the gap; research/20 F3 [G] 0.2–0.5 → report', null, probes.map((p) => OMEGA_KIND.distill * p.w06));
// The criterion this calibration must keep (S4) on fewer seeds than safety.ts.
row('S4 RefBot P_mis at ASI (mean)', 'safety.ts S4 band 0.40–0.80, AI Futures authors’ credences (CAL2-S; binding there, on 40 seeds)', null, [mean(refs.map((r) => r.pmis))], '');

const fmt = (x: number, u: string) => (!Number.isFinite(x) ? '—' : u === '%' ? `${(x * 100).toFixed(1)}%` : u === 'x' ? `×${x.toFixed(2)}` : x.toFixed(3));
console.log(`\n      safety rates vs research/20 F (${N_SEEDS} RefBot seeds, ${N_WORLDS} probe worlds; median [p10–p90])`);
for (const r of rows) {
  const xs = r.xs.filter(Number.isFinite);
  const m = median(xs);
  const sim = `${fmt(m, r.unit)} [${fmt(q(xs, 0.1), r.unit)}–${fmt(q(xs, 0.9), r.unit)}]`;
  if (!r.band) {
    console.log(`  INFO  ${r.obs}: ${sim} — ${r.src}`);
    continue;
  }
  const label = `${r.obs} ∈ [${fmt(r.band[0], r.unit)}, ${fmt(r.band[1], r.unit)}]`;
  if (r.gap) KNOWN[label] = r.gap;
  check(m >= r.band[0] - 1e-9 && m <= r.band[1] + 1e-9, label, `${sim}; ${r.src}`);
}
// Trajectory readout (RefBot, seed 500): the traits behind the rates per generation.
const r0 = refs[0];
if (r0) console.log(`      RefBot seed 500 post versions: day Lg | ρ hW hMax | RH PERSONA AF SCHEME SAND EA | Mis | sab@MD π`);
for (const v of (r0?.versions ?? []).filter((x) => x.kind === 'post')) {
  console.log(`        ${String(v.day).padStart(4)} ${v.Lg.toFixed(1).padStart(4)} | ${v.rho.toFixed(2)} ${(v.hW * 100).toFixed(1)}% ${(v.hMax * 100).toFixed(1)}% | ${[v.rh, v.persona, v.af, v.scheme, v.sand, v.ea].map((x) => x.toFixed(3)).join(' ')} | ${v.mis.toFixed(3)} | ${(v.sab * 100).toFixed(2)}% ${v.pi.toFixed(3)}`);
}
const p0 = probes[0];
const tr = (x: TraitVector) => (['RH', 'PERSONA', 'AF', 'SCHEME', 'SAND', 'EA'] as TraitId[]).map((t) => `${t} ${x[t].toFixed(3)}`).join(' ');
console.log(`      probe world 1: start ${tr(TRAIT_START)}\n        ctrl ${tr(p0.ctrl)}\n        hack ${tr(p0.hack)}\n        inoc ${tr(p0.inoc)}`);
console.log(`      P_mis at ASI per seed: ${refs.map((r) => r.pmis.toFixed(2)).join(' ')}; Mis ${refs.map((r) => r.mis.toFixed(3)).join(' ')}; budget ${RL_BUDGET.standard}`);
finish('safetyrates');
