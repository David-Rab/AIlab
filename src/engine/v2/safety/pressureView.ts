// Safety UI 2 readouts (model v3 E12; MODEL-V3 §11.1–11.2). Output only: no state, no mechanism. Everything here is
// what the player can know: run quantities (exact), and for the successor pull the player's beliefs (believed SUCC,
// believed tool strength, measured level) in place of the engine's true traits, true strength and hidden U-modes
// (Sylvester rule, STRUCTURE R9). The engine's own pull is `successorPull` (traits.ts); this is its believed reading.
import { controlOn, labControlSetting, labReviewOn } from './safeguards';
import { EDGES } from '../../../data/v2/edges';
import { RISK_FAMILIES } from '../../../data/v2/agents';
import { HUMAN_REVIEW } from '../../../data/v2/danger';
import { RL_FAMILIES as RL_FAMILY_DEF, RL_FAMILY_IDS } from '../../../data/v2/runDesign';
import { rlWeights, type FamilyMap } from '../models/effective';
import { planRun, type LaunchRunParams } from '../models/runs';
import { suiteExploitMap, suiteRlWeights, S2_PER_EXPLOIT } from '../models/suites';
import { measuredLOf, versionById } from '../models/labs';
import { fleetMonitor } from '../departments/agents';
import { workContext, type CapSlot } from '../departments/workfit';
import type { BaseModel, GameStateV2, ModelVersion, PostDesign, RLFamily, SignalId, ToolFamily, TraitId } from '../types';
import { adopted, clamp01 } from './common';
import { believedPenalty, combineTools } from './detection';
import { aiRdShare } from './incidents';
import { containment, strengthBelieved, techniqueRole } from './techniques';
import { controlProtocol, gapFactor, oomOfLevel, oversightGap, underControl } from './oversight';
import { HUMAN_REVIEW_L } from '../../../data/v2/oversight';
import { againstOf, usesMethod } from './methods';
import {
  COT_S4, G_S5_0, K_GAO, K_S3, K_S5G, OMEGA_KIND, OMEGA_RL_EXP, PREF_S1, RHO_REF, S5_AI, S5_LONG, S6_NARROW_HARMFUL, S7_BASE, S7_EVAL_ENV, S7_PER_BB, S9_PER_BB,
  INOC_MULT, LH_FULL, S8_FTE_REF, LH_ONSET, aiDataShare, deploymentS8, s9OfDetectors, hackShare, kappaSucc, learnedHackingOf, optimisationPressure, prefShare, referenceBaseShares, runOmega, s7OfRl,
} from './traits';

export type FamilyId = (typeof RISK_FAMILIES)[number]['id'];
/** Where a signal's direct edge lands: one of the four risk families, or awareness (situational awareness has no family). */
export type PushTarget = FamilyId | 'awareness';

/** Direct pushes of each signal: the traits its edges point at (data/v2/edges.ts), grouped by family. */
export function signalPushes(sig: SignalId): { target: PushTarget; traits: TraitId[] }[] {
  const out: { target: PushTarget; traits: TraitId[] }[] = [];
  for (const e of EDGES) {
    if (!e.from.includes(sig)) continue;
    const to = e.to as TraitId;
    const target: PushTarget = RISK_FAMILIES.find((f) => f.traits.includes(to))?.id ?? 'awareness';
    let g = out.find((x) => x.target === target);
    if (!g) out.push((g = { target, traits: [] }));
    if (!g.traits.includes(to)) g.traits.push(to);
  }
  return out;
}

// ───────── training pressure of a run (S1–S9 with the quantities behind them) ─────────

/** One signal of a run: its value and the run quantities that set it (`q`, by name; shares 0–1, hours, OOM). */
export interface PressureRow {
  id: SignalId;
  value: number;
  /** The quantities behind the value (see `postPressure` / `basePressure` for the formula of each). */
  q: Record<string, number | string | boolean>;
  /** Per-family terms where the signal sums over RL families (S2: share × exploitable; S3: share × log task length). */
  fams?: { family: RLFamily; share: number; x: number; term: number }[];
}
export interface RunPressure {
  kind: 'base' | 'post' | 'distill' | 'continue';
  rows: PressureRow[];
  /** How far the run moves traits along the graph's edges (`runOmega` growth) and its safety training (`safety`). */
  omega: { growth: number; safety: number; kind: number; rho?: number; rlFactor?: number };
  /** Model v3 AF2: a new network (a base, a distilled student) imitates what its teachers' outputs show (traits.ts
   *  imitatedStart): the teacher-written share of its tokens and each teacher's part. Absent: no teacher data or
   *  not recorded. */
  imitation?: ImitationView;
}
export interface ImitationView { share: number; teachers: { name: string; share: number }[] }

/** The teacher-written share of a new network's tokens, by teacher ('' = the start stock). */
export function imitationView(s: GameStateV2, parts: readonly { id: string; share: number }[] | undefined): ImitationView | undefined {
  const ps = (parts ?? []).filter((p) => p.share > 0);
  if (!ps.length) return undefined;
  return {
    share: ps.reduce((a, p) => a + p.share, 0),
    teachers: ps.map((p) => ({ name: p.id ? versionById(s, p.id)?.name ?? p.id : 'start stock', share: p.share })).sort((a, b) => b.share - a.share),
  };
}
const drawTeachers = (d: { tokens: number; bySynTeacher?: Record<string, number> }) =>
  Object.entries(d.bySynTeacher ?? {}).map(([id, n]) => ({ id, share: n / Math.max(1, d.tokens) }));

const famTerms = (w: FamilyMap, f: (k: RLFamily, wf: number) => { x: number; term: number }) =>
  (Object.entries(w) as [RLFamily, number][]).filter(([, wf]) => wf > 0).map(([family, share]) => ({ family, share, ...f(family, share) })).sort((a, b) => b.term - a.term);

/** Post-training signals with their quantities (traits.ts `postSignals`, term by term). `exploit` = a run's frozen
 *  suites (else today's); `rho` = RL FLOP ÷ the base's FLOP; `s8` = the applied S8 when known (finished runs). */
export function postPressure(s: GameStateV2, post: PostDesign, rho: number, exploit?: FamilyMap, s8?: number): PressureRow[] {
  const x = exploit ?? suiteExploitMap(s);
  const w = exploit ? rlWeights(post.rlFocus, RL_FAMILY_IDS.filter((f) => exploit[f] !== undefined)) : suiteRlWeights(s, post.rlFocus);
  const p = optimisationPressure(rho);
  const p11 = adopted(s, 'P11');
  const s2f = famTerms(w, (f, wf) => ({ x: x[f] ?? 0, term: S2_PER_EXPLOIT * wf * (x[f] ?? 0) * p }));
  const hackRate = s2f.reduce((a, r) => a + r.share * r.x, 0);
  // E16: the share of the run's RL episodes that are rewarded hacks (hackRates, × the pressure) and its learned hacking.
  const hacked = hackShare(w, x, rho);
  const learned = learnedHackingOf(hacked);
  const s3f = famTerms(w, (f, wf) => { const h = RL_FAMILY_DEF[f].taskH ?? 0; return { x: h, term: K_S3 * wf * Math.log10(1 + h) }; }).filter((r) => r.x > 0);
  const against = againstOf(post);
  const cotMonitor = against.some((id) => s.player.safety.techniques[id]?.family === 'COT');
  const bb = against.filter((id) => s.player.safety.techniques[id]?.family === 'BB').length;
  const agentFte = s.player.prodCache?.labor.agentFte ?? 0;
  const ps = prefShare(rho);
  const rows: PressureRow[] = [
    { id: 'S1', value: PREF_S1[post.pref] * (ps / prefShare(RHO_REF)), q: { method: post.pref, bias: PREF_S1[post.pref], prefShare: ps, prefShareRef: prefShare(RHO_REF) } },
    { id: 'S2', value: S2_PER_EXPLOIT * hackRate * p + (p11 ? 0.2 : 0), q: { hackRate, perExploit: S2_PER_EXPLOIT, pressure: p, rho, rhoRef: RHO_REF, kGao: K_GAO, p11, hacked, learned, lhOnset: LH_ONSET, lhFull: LH_FULL, inoculated: usesMethod(post, 'T-INOC'), inocMult: INOC_MULT }, fams: s2f },
    { id: 'S3', value: s3f.reduce((a, r) => a + r.term, 0), q: { k: K_S3, agentic: s3f.reduce((a, r) => a + r.share, 0) }, fams: s3f },
    { id: 'S4', value: Math.max(COT_S4[post.cot], cotMonitor ? COT_S4.pressured : 0), q: { cot: post.cot, cotMonitor } },
    { id: 'S5', value: S5_LONG * (w.longHorizon ?? 0), q: { longShare: w.longHorizon ?? 0, k: S5_LONG } },
    { id: 'S6', value: S6_NARROW_HARMFUL, q: {} }, // AF2: no narrow harmful fine-tune in any run kind
    { id: 'S7', value: S7_BASE + s7OfRl(rho) + S7_EVAL_ENV * (w.mlResearch ?? 0) + S7_PER_BB * bb, q: { base: S7_BASE, rl: s7OfRl(rho), mlShare: w.mlResearch ?? 0, kMl: S7_EVAL_ENV, bb, kBb: S7_PER_BB, rho, rhoRef: RHO_REF } },
    { id: 'S8', value: s8 ?? deploymentS8(s), q: { agentFte, fteRef: S8_FTE_REF, p05: adopted(s, 'P05'), applied: s8 !== undefined } },
    // E17: oversight-conditional reward (→ alignment faking), split from S7.
    { id: 'S9', value: s9OfDetectors(bb), q: { bb, kBb: S9_PER_BB } },
  ];
  for (const r of rows) r.value = clamp01(r.value);
  return rows;
}

/** Base-run signals with their quantities (traits.ts `baseSignals`): S5 from AI-related data and scale; S6 0 (AF2).
 *  `ai` = the draw's AI-related share. */
export function basePressure(gPre: number, ai: number, safetyPretrain: boolean): PressureRow[] {
  const ref = referenceBaseShares();
  const aiTerm = S5_AI * (ai / ref.ai);
  const gTerm = K_S5G * Math.max(0, gPre - G_S5_0);
  return [
    { id: 'S5', value: clamp01(aiTerm + gTerm), q: { ai, aiRef: ref.ai, aiTerm, gPre, g0: G_S5_0, gTerm, kG: K_S5G, safetyPretrain } },
    // E20 / AF2: a base is no narrow harmful fine-tune (traits.ts baseSignals).
    { id: 'S6', value: S6_NARROW_HARMFUL, q: {} },
  ];
}

/** The planned run of a Blueprint design: its signals with their causes and its ω (what `applyRunToTraits` will use). */
export function plannedPressure(s: GameStateV2, p: LaunchRunParams): RunPressure | undefined {
  const plan = planRun(s, p);
  const base = p.baseId ? s.player.models.bases.find((b) => b.id === p.baseId) : undefined;
  const run = { kind: p.kind, name: p.kind, ...(p.grader ? { grader: p.grader } : {}), flopNeeded: plan.flopNeeded, ...(p.baseId ? { baseId: p.baseId } : {}), ...(p.post ? { post: p.post } : {}) };
  const om = runOmega(s, run);
  if (p.kind === 'base') {
    const L = plan.limits;
    if (!L || !p.base) return undefined;
    return { kind: 'base', rows: basePressure(L.gPre.total, aiDataShare(L.draw, p.base.curation.safetyPretrain), p.base.curation.safetyPretrain), omega: { ...om, kind: OMEGA_KIND.base }, imitation: imitationView(s, drawTeachers(L.draw)) };
  }
  if (p.kind === 'post') {
    if (!p.post || !base || !(plan.flopNeeded > 0)) return undefined;
    const rho = plan.flopNeeded / Math.max(1, base.flop);
    const k = p.grader === 'teacher' ? OMEGA_KIND.ida : OMEGA_KIND.post;
    return { kind: 'post', rows: postPressure(s, p.post, rho), omega: { ...om, kind: k, rho, rlFactor: om.growth / k } };
  }
  if (p.kind === 'distill') return { kind: 'distill', rows: distillRows(), omega: { ...om, kind: OMEGA_KIND.distill }, imitation: imitationView(s, p.teacherVersionId ? [{ id: p.teacherVersionId, share: 1 }] : undefined) };
  if (!base) return undefined;
  return { kind: 'continue', rows: storedBaseRows(base), omega: { ...om, kind: OMEGA_KIND.continue } };
}

const distillRows = (): PressureRow[] => [{ id: 'S6', value: S6_NARROW_HARMFUL, q: {} }];

/** A finished base's signals with their quantities, read back from its stored signals (the draw is not kept: the
 *  AI-related share is the one its S5 implies, exact unless the signal hit its clamp). S6 reads today's rule (0, AF2):
 *  a base saved before AF2 stored a synthetic-share S6 that no later run reads. */
export function storedBaseRows(b: BaseModel): PressureRow[] {
  const ref = referenceBaseShares();
  const s5 = b.signals?.S5 ?? 0;
  const gTerm = K_S5G * Math.max(0, b.gPre - G_S5_0);
  const ai = Math.max(0, ((s5 - gTerm) / S5_AI) * ref.ai);
  const rows = basePressure(b.gPre, ai, b.design.curation.safetyPretrain);
  // A base saved before signals came from run quantities (model v3 E3) has an S5 below its own scale term.
  const legacy = s5 < gTerm - 1e-6;
  rows[0].value = clamp01(s5);
  rows[0].q.legacy = legacy;
  return rows;
}

/** What the run that made version `v` applied: its own signals (post-training, distillation or continued
 *  pretraining) with their quantities and ω, and its base's pretraining signals. */
export function versionPressure(s: GameStateV2, versionId: string): { run?: RunPressure; base?: { name: string; rows: PressureRow[]; imitation?: ImitationView } } {
  const v = versionById(s, versionId);
  if (!v) return {};
  const base = s.player.models.bases.find((b) => b.id === v.baseId);
  const baseOut = base?.signals ? { name: base.name, rows: storedBaseRows(base), imitation: imitationView(s, base.teacherData) } : undefined;
  const b = v.build;
  if (v.variant === 'imported' || !b) return { base: baseOut };
  if (v.variant === 'mini') return { run: { kind: 'distill', rows: distillRows(), omega: { growth: OMEGA_KIND.distill, safety: OMEGA_KIND.distill, kind: OMEGA_KIND.distill }, imitation: imitationView(s, v.parentVersionId ? [{ id: v.parentVersionId, share: 1 }] : undefined) }, base: baseOut };
  // Gov, trusted and open-weight variants are packagings of their parent: its run is theirs.
  if (v.variant !== 'full' && v.parentVersionId && v.parentVersionId !== v.id) return versionPressure(s, v.parentVersionId);
  if (b.rlFlop > 0 && b.flopPre > 0) {
    const rho = b.rlFlop / b.flopPre;
    // The run that made it: a finished post-train on the same base with the same RL FLOP (its suites frozen at launch).
    const run = s.player.models.runs.find((r) => r.status === 'done' && r.kind === 'post' && r.baseId === v.baseId && Math.abs(r.flopNeeded - b.rlFlop) <= 1e-6 * b.rlFlop);
    const applied = b.signals?.S8 !== undefined ? clamp01((b.signals.S8 ?? 0) - (base?.signals?.S8 ?? 0)) : undefined;
    const om = runOmega(s, { kind: 'post', name: run?.name ?? 'post', ...(run?.grader ? { grader: run.grader } : {}), flopNeeded: b.rlFlop, baseId: v.baseId, post: v.design });
    const k = run?.grader === 'teacher' ? OMEGA_KIND.ida : OMEGA_KIND.post;
    const rows = postPressure(s, v.design, rho, run?.recipe?.exploit, applied);
    // No frozen suites (a start model, or an older save): S2 reads today's suites; say so.
    if (!run?.recipe?.exploit) for (const r of rows) if (r.id === 'S2') r.q.todaySuites = true;
    return { run: { kind: 'post', rows, omega: { ...om, kind: k, rho, rlFactor: om.growth / k } }, base: baseOut };
  }
  return { base: baseOut };
}

// ───────── successor pull, believed (traits.ts successorPull with the player's beliefs) ─────────

export interface SuccessorPartView {
  slot: CapSlot;
  versionId: string;
  /** This work type's AI labour ÷ the lab's R&D labour (exact: Σ = aiRdShare). */
  share: number;
  /** Believed containment (control layer × best containment tool, believed strength at the measured level's OOM). */
  block: number;
  /** Believed chance monitors, human review and control-layer deferral catch successor steering. */
  caught: number;
  /** Human review's catch on this model: HUMAN_REVIEW · (1 − r) × the monitor rule on its measured gap above L 10. */
  human: number;
  /** Control-layer multiplier on the misses (E6: 0.447 under control protocols, else 1). */
  controlMiss: number;
  /** 1 − (1 − block)(1 − caught). */
  oversight: number;
  /** κ at the believed SUCC estimate, and at its 90% band. */
  kappa: number;
  kappaBand: [number, number];
  succ: { est: number; sd: number };
  /** ω_k = κ · share · (1 − oversight), with the band from SUCC's. */
  omega: number;
  omegaBand: [number, number];
}
export interface SuccessorPullView { r: number; omega: number; omegaBand: [number, number]; parts: SuccessorPartView[]; humanReview: number }

const CAP_SLOTS: readonly CapSlot[] = ['SWE', 'EXP', 'IDEAS'];
const MON_FAMILIES: ToolFamily[] = ['COT', 'WB'];

/** Believed monitor catch on SUCC for fleet `v` (detection.ts monitoringCatch with believed strength at the measured
 *  OOM `x` and believed penalties at the measured level `L`). */
function believedCatchSucc(s: GameStateV2, v: ModelVersion, x: number, L: number): number {
  let miss = 1;
  for (const fam of MON_FAMILIES) {
    const items: { agenda: string; d: number }[] = [];
    for (const t of Object.values(s.player.safety.techniques)) {
      if (!t.unlocked || !t.active || t.family !== fam || techniqueRole(t) === 'fix') continue;
      const cov = t.coverage.SUCC ?? 0;
      if (cov > 0) items.push({ agenda: t.agenda, d: cov * strengthBelieved(s, t, x) });
    }
    if (items.length) miss *= 1 - combineTools(items) * believedPenalty(s, v, 'SUCC', fam, L);
  }
  return clamp01((1 - miss) * (0.5 + 0.5 * fleetMonitor(s, v, 'SUCC')));
}

/** The successor pull a run finishing today would get, as the player can estimate it: per R&D work type, the model
 *  doing it, its share of the lab's R&D (exact), believed oversight and κ from the believed SUCC (with its band). */
export function successorPullView(s: GameStateV2): SuccessorPullView {
  const w = workContext(s).slots;
  let L = 0;
  for (const k of CAP_SLOTS) L += Math.max(w[k].H, w[k].L);
  const r = aiRdShare(s);
  const parts: SuccessorPartView[] = [];
  const out: SuccessorPullView = { r, omega: 0, omegaBand: [0, 0], parts, humanReview: (labReviewOn(s) ? HUMAN_REVIEW : 0) * (1 - r) };
  if (L <= 1e-12) return out;
  const tl = s.hidden.timeline; // the public level → OOM map (as catchRate); no hidden trait or capability
  const controlMiss = underControl(s) ? controlProtocol(undefined, labControlSetting(s)).missMult : 1;
  for (const k of CAP_SLOTS) {
    const sl = w[k];
    const v = sl.versionId ? versionById(s, sl.versionId) : undefined;
    const share = (Math.max(sl.H, sl.L) - sl.H) / L;
    if (!v || share <= 0) continue;
    // E6's internalOversight(s, v, 'SUCC') (incidents.ts) read with the player's knowledge: measured level for the
    // capability (OOM) and the human-review gap, believed tool strength, no hidden U-mode containment multiplier.
    const Lv = measuredLOf(s, v).L;
    const x = oomOfLevel(tl, Lv);
    const dep = s.player.deployments.find((d) => d.channel === 'internal' && d.versionId === v.id && d.status !== 'withdrawn')
      ?? s.player.deployments.find((d) => d.channel === 'internal' && d.status !== 'withdrawn');
    const block = dep ? containment(s, x, controlOn(dep), true) : 0;
    const mon = believedCatchSucc(s, v, x, Lv);
    const human = (labReviewOn(s) ? HUMAN_REVIEW : 0) * (1 - r) * gapFactor(oversightGap(tl, Lv, HUMAN_REVIEW_L).oom);
    const caught = clamp01(1 - (1 - mon) * (1 - human) * controlMiss);
    const oversight = clamp01(1 - (1 - block) * (1 - caught));
    const b = v.beliefs.SUCC ?? { est: 0, sd: 0.35 };
    const kappa = kappaSucc(b.est);
    const kappaBand: [number, number] = [kappaSucc(b.est - 1.64 * b.sd), kappaSucc(b.est + 1.64 * b.sd)];
    const f = share * (1 - oversight);
    parts.push({ slot: k, versionId: v.id, share, block, caught, human, controlMiss, oversight, kappa, kappaBand, succ: { est: b.est, sd: b.sd }, omega: kappa * f, omegaBand: [kappaBand[0] * f, kappaBand[1] * f] });
  }
  for (const p of parts) {
    out.omega += p.omega;
    out.omegaBand[0] += p.omegaBand[0];
    out.omegaBand[1] += p.omegaBand[1];
  }
  return out;
}

export { OMEGA_RL_EXP };
