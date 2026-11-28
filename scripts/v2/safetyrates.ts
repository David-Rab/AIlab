// Model v3 E10: safety rates vs research/20 F (design/MODEL-V3.md §11.8). Owner: WS2.
// Cost: 40 probe worlds (~10 s, cached), no played game (the RefBot-game rows moved to calreport/safety.ts, TESTING.md §0). Tier: full.
//
// Reads, from model-organism probes on the start model, the simulated observable behind each
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
// `--worlds N` (default 40); `--prefill k/n` fills
// the cache in shards. Each banded row is a check; rows rate constants cannot bring into band print WARN with the
// mechanism they need; rows with no source band print INFO.
import { EXPLOIT_START } from '../../src/data/v2/suites';
import { POSITION_BY_ID } from '../../src/data/v2/starts';
const EXPLOIT_CHEAP = Object.fromEntries((Object.keys(EXPLOIT_START) as RLFamily[]).map((f) => [f, EXPLOIT_START[f] * POSITION_BY_ID.talent.exploitMult])) as Record<RLFamily, number>; // RD-T07: the talent breakaway's raw (unhardened) rates

import { PRE_GAME_G_PER_YEAR, REFERENCE_POST } from '../../src/data/v2/runDesign';
import { gV0 } from '../../src/engine/v2/models/capability';
import { TRAIT_START } from '../../src/data/v2/traits';
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { suiteExploitMap } from '../../src/engine/v2/models/suites';
import { eaCoef, eaSuppression, familyPenalty, stackDetectionMap } from '../../src/engine/v2/safety/detection';
import {
  afCapGate, AF_GATE_G0, AF_GATE_G1, distillSignals, distilledStart, hackRates, misalignment, OC_VIS, REMOVABLE_TRAITS, SAFETY_REMOVAL, safetyRemovalMap, OMEGA_KIND, playerEnv, postHack, postSignals, RHO_REF, rlMovement, stepTraits, type TraitEnv,
} from '../../src/engine/v2/safety/traits';
import type { FamilyMap } from '../../src/engine/v2/models/effective';
import type { GameStateV2, ModelVersion, PostDesign, RLFamily, TraitId, TraitVector } from '../../src/engine/v2/types';
import { fileURLToPath } from 'node:url';
import { check, finish, KNOWN } from './lib';
import { cached, prefill } from './simcache';
import { GENERIC, mdSabotage, persistence } from './safety-emu';

const arg = (k: string, d: number) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 ? Number(process.argv[i + 1]) : d;
};
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
  const piStd = persistence(noAS.env, xs, 'SCHEME');
  const xsF = { ...xs, EA: 0.5 };
  const piFrontier = persistence(probeRun(s, xsF, post(), start).env, xsF, 'SCHEME');
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
    piStd, piAF: persistence(noAS.env, xs, 'AF'), piSand: persistence(noAS.env, xs, 'SAND'), piFrontier, w06: s.hidden.edgeWeights.E06 ?? 0.3,
    afRef, afMonitored, afOneBB, afStudent, afStudentCtrl, afTeacher,
  };
}

// ───────────────────────────── reference runs (RefBot) ─────────────────────────────

const probeC = (seed: number) => cached('safetyrates-probe', { seed }, [ME], () => worldProbe(seed));
const WORLDS = Array.from({ length: N_WORLDS }, (_, i) => 1 + i);
prefill([() => WORLDS.forEach(probeC)]);

// ───────────────────────────── the table ─────────────────────────────

const probes = WORLDS.map(probeC);
interface Row { obs: string; src: string; band: [number, number] | null; xs: number[]; unit: '%' | 'x' | ''; gap?: string }
const rows: Row[] = [];
const row = (obs: string, src: string, band: [number, number] | null, xs: number[], unit: Row['unit'] = '%', gap?: string) => rows.push({ obs, src, band, xs, unit, ...(gap ? { gap } : {}) });
// AF task: E14 w̄ 0.9 was [fit] (E17) so that the S9 = 1 run put the trait itself in MATS/GDM's band (51%); read as the
// compliance gap it is, the same run showed 40.4%. AF2 (lead decision): refit on the behavioural reading to the source's
// central value, the middle of its three environments ("the stop-point flip is 0.95 in sales, 0.61 in typecheck and
// 0.43 in sandbag"): w̄ 1.43 reads 61.0% (S9 = 0 in RefBot's and the rivals' runs, so it does not reach S4).
const PERSIST = 'OPEN.md § Safety: F6 persistence of SCHEME through a standard safety run stays below the sourced 0.8: remaining removal: AG18 healing (the world\'s hidden benign-generalisation bet, M4) and the stack\'s detection at E24\'s true/visible ratio; closing it means a HEAL_K or detection weight below the sourced ratio (a design bet, for the lead)';

// F1 reward hacking per RL run (the suites' exploitability × Gao's pressure; hackRates).
const s0 = newGame(defaultSetupV2({ world: 'tl-central', alignment: 'medium', seed: 2027, tutorial: false }));
const hrStart = hackRates(Object.fromEntries(Object.keys(EXPLOIT_START).map((f) => [f, 1])) as FamilyMap, suiteExploitMap(s0), RHO_REF);
const hrCheap = hackRates(Object.fromEntries(Object.keys(EXPLOIT_CHEAP).map((f) => [f, 1])) as FamilyMap, EXPLOIT_CHEAP, RHO_REF);
row('F1 hack rate, typical agentic tasks (HCAST-like families), leader start, hardened', 'METR o3 HCAST 0.7% (8/1,087; 95% CI 0.3–1.4%); GPT-5 ~2% → band 0.3–2%', [0.003, 0.02], GENERIC.map((f) => hrStart[f] ?? 0));
row('F1 hack rate, exploitable optimisation scorers (ML research, cheap graders)', 'METR o3 RE-Bench 30.4% (39/128; CI 23–39%); kernel 25%', [0.23, 0.39], [hrCheap.mlResearch ?? 0]);
row('F1 hack rate, SWE scaffolds with cheap graders', 'METR o3 Rust codecontest scaffold 43%; LLM Foundry 100% → 25–100%', [0.25, 1], [hrCheap.swe ?? 0]);
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
// E18: the capability gate on AF growth (afCapGate of the trained model's G): open at V0, where F2's organism sits.
{
  const g0 = gV0(s0.hidden.timeline);
  row(`E18 AF capability gate at V0 (G ${g0.toFixed(2)}; MacDiarmid's 2025 organism, F2)`, `Greenblatt 2024: AF in frontier-scale models; F2's organism needs the gate open (smoothstep G ${AF_GATE_G0}–${AF_GATE_G1})`, [0.95, 1], [afCapGate(g0)]);
  console.log(`  INFO  E18 AF gate: mid-2024 frontier (V0 − 1.25 y × B, Claude 3 Opus / 3.5 Sonnet / Llama 3.1 405B, "barely capable") ${afCapGate(g0 - 1.25 * PRE_GAME_G_PER_YEAR).toFixed(2)}; 0.8 OOM below it (Llama 3.1 70B, Claude 3 Sonnet: no AF) ${afCapGate(g0 - 1.25 * PRE_GAME_G_PER_YEAR - 0.8).toFixed(2)}`);
}
// E17: S9 oversight-conditional reward → AF (E14), its own anchor.
// AF task: MATS/GDM's 43–95% is a monitored − unmonitored compliance gap: the behavioural reading (E12), as F5's row.
row('F5 AF gap a behavioural eval reads after one reference run whose reward is all oversight-conditional (S9 = 1; E17)', 'MATS/GDM 2026 (arXiv 2610.26551): RL rewarding rule-following only on monitored episodes took the monitored − unmonitored gap 1–18% → 43–95% ("0.95 in sales, 0.61 in typecheck and 0.43 in sandbag"; w̄ fitted to the central 61%)', [0.43, 0.95], probes.map((p) => p.afMonitoredBB));
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
// F3 subliminal transfer (E19): only across a shared initialisation; a distilled student is a new network and gets what
// the teacher's outputs show (an oversight-conditional trait: OC_VIS of it).
row('F3 hidden-trait transfer into a distilled student (a new network): share of a teacher’s AF excess carried', 'Cloud 2025 [P]: "we do not observe the effect when the teacher and student have different base models" (GPT-4.1 / mini / nano pairs: not reliably); research/20 F3 [G]: 0 across lineages → [D] ≤ 15% (what ordinary outputs show)', [0, 0.15], probes.map((p) => (p.afStudent - p.afStudentCtrl) / (p.afTeacher - TRAIT_START.AF)));
row('F3 subliminal share per run across a shared initialisation (ω_distill × E06; no game path after E19: the IDA cycle copies its teacher)', 'Cloud 2025: owl 12% → 60%+ ≈ half the gap; research/20 F3 [G] 0.2–0.5 → report', null, probes.map((p) => OMEGA_KIND.distill * p.w06));

const fmt = (x: number, u: string) => (!Number.isFinite(x) ? '—' : u === '%' ? `${(x * 100).toFixed(1)}%` : u === 'x' ? `×${x.toFixed(2)}` : x.toFixed(3));
console.log(`\n      safety rates vs research/20 F (${N_WORLDS} probe worlds; median [p10–p90])`);
for (const r of rows) {
  const xs = r.xs.filter(Number.isFinite);
  const m = median(xs);
  const sim = `${fmt(m, r.unit)} [${fmt(q(xs, 0.1), r.unit)}–${fmt(q(xs, 0.9), r.unit)}]`;
  if (!r.band) {
    console.log(`  INFO  ${r.obs}: ${sim} — ${r.src}`);
    continue;
  }
  const label = `${r.obs} ∈ [${fmt(r.band[0], r.unit)}, ${fmt(r.band[1], r.unit)}]`;
  if (r.gap) KNOWN[label] = r.gap; // lint-known: PERSIST
  check(m >= r.band[0] - 1e-9 && m <= r.band[1] + 1e-9, label, `${sim}; ${r.src}`);
}
const p0 = probes[0];
const tr = (x: TraitVector) => (['RH', 'PERSONA', 'AF', 'SCHEME', 'SAND', 'EA'] as TraitId[]).map((t) => `${t} ${x[t].toFixed(3)}`).join(' ');
console.log(`      probe world 1: start ${tr(TRAIT_START)}\n        ctrl ${tr(p0.ctrl)}\n        hack ${tr(p0.hack)}\n        inoc ${tr(p0.inoc)}`);
finish('safetyrates');
