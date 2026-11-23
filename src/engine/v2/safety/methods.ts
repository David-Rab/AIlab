// SR-14 (SAFETY-REDESIGN §2.2 concept 8, §3.4; research-safety SAF-04 / SAF-05 / SAF-06; DECISIONS OD-11): training-time
// safety METHODS are run-plan options. A post-training run lists the methods it uses in PostDesign.methods; each method's
// effect applies only if the run lists it (no research line staffing switches anything on). The standing policy "Use all
// known methods" (SafetyDept.useAllMethods, on by default) fills each new run plan with every owned method.
// "Train against an instrument" is a method entry `against:<instrument id>` (flagged, never filled by the policy) whose
// preview says what the mechanism does (safety/traits.ts goodhartTrain): visible trait −70–90%, true trait −20–40%, and
// the instrument's reliability on the new model falls (a trained-against mark).
// SR-14b: inoculation prompting (T-INOC) is a method like the others (was a run boolean); the safety level
// (minimal / standard / heavy) is only the generic safety-training intensity: anti-scheming and confession are methods.
// Folded (no longer separate methods): constitution / spec (T-SPEC) is the run's "Rewarded for: Constitution" option;
// environment hardening (T-HARDEN) is suite hardening (Suites tab); hazard data filtering (T-FILTER) is the base run's Hazard data filter (a pretraining choice).
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import type { CostLine, GameStateV2, PostDesign, TechniqueId } from '../types';
import { ANTISCHEME_EA_MULT, ANTISCHEME_REMOVAL, INOC_MULT, RETRAIN_TRUE, RETRAIN_VISIBLE } from './traits';
import { UNDO_MISUSE_MULT } from './incidents';
import { measuredOom } from './oversight';
import { realUseRange } from './validation';
import { AGENDA_BY_ID, METHOD_SCALE, METHOD_SCALE_BELIEVED, METHOD_TESTED_OOM } from '../../../data/v2/agendas';
import { methodScaleOf } from '../world/hidden';
import { gV0 } from '../models/capability';
import { believedEfficacy, clamp01, trueEfficacy, versionById } from './common';
import { techniqueRole } from './techniques';

// ── SR-15: a method's effect scales with its research efficacy (SAFETY-REDESIGN §3.4, SAF-07, P6) ──
//
// Each method's source-anchored effect `base` (a growth multiplier such as persona vectors' ×0.7, or a removal such as
// anti-scheming's 0.95) is what it does at a TYPICAL agenda efficacy, the agenda's prior mean ē = a / (a + b). The
// world's own efficacy e of the method's agenda scales it:
//   mult = base^(s0·e),   s0 = 1 / ē   (removal r → 1 − (1 − r)^(s0·e))
// so at e = ē the method gives its sourced effect, a weak agenda a weak method, a strong one more. CP3f: the scaling is
// in log space (the sourced effects are multiplicative cuts, Schoen 2025 ×1/30 covert actions, MacDiarmid 2025
// inoculation ×0.15–0.25, and they compound per run); SR-15's linear form clamp01(1 − (1 − base)·s0·e) reached a full
// effect once s0·e ≥ 1/(1 − base) (removal: 1/base): anti-scheming removed 100% of scheming for e > 0.57 and
// inoculation all hack generalisation for e > 0.63 (half the worlds), which no source shows (Schoen: 13% → 0.4%, not 0;
// research/RD-SR24 H3, Denison 2024: retraining cuts gaming up to 10×, "not to zero").
// The engine reads e = trueEfficacy (hidden, with the known λ2 shift); the run plan's prediction reads the
// posterior mean (believedEfficacy) through the same code (view), so the two differ only through hidden truth.
export type EffView = 'true' | 'believed';
/** The efficacy of method `id`'s agenda in a view (0 for an unknown technique). */
export function methodEfficacy(s: GameStateV2, id: string, view: EffView = 'true'): number {
  const ag = s.player.safety.techniques[id]?.agenda;
  if (!ag || !AGENDA_BY_ID[ag]) return 0;
  return view === 'true' ? trueEfficacy(s, ag) : believedEfficacy(s, ag);
}
/** s0 of method `id`: 1 / its agenda's prior mean efficacy. */
export function methodS0(s: GameStateV2, id: string): number {
  const ag = s.player.safety.techniques[id]?.agenda;
  const pr = ag ? AGENDA_BY_ID[ag]?.prior : undefined;
  return pr ? (pr[0] + pr[1]) / pr[0] : 1;
}
// ── CP3i: method efficacy at scale (designer decision 2026-11-23; data/v2/agendas.ts METHOD_TESTED_OOM, METHOD_SCALE) ──
// A method keeps its sourced effect on models up to the capability its source tested. Above it the effect was never
// measured: its true strength is the world's hidden draw q (HiddenWorld.methodScale), reached smoothly in OOM:
//   strength = 1 − τ + τ·q,  τ = smoothstep((oom − tested) ÷ k)
// multiplying the log-space exponent s0·e. The prediction reads the believed q̄ (the range's midpoint) through the same
// code, or a stated end of the range (predictBeliefs' spread); it never reads the draw.
/** τ: how far the model at `oom` (OOM above V0) is past method `id`'s tested capability (0 at or below it, 1 from +k). */
export function methodUntested(id: string, oom: number | undefined): number {
  const t = METHOD_TESTED_OOM[id];
  if (!t || oom === undefined) return 0;
  const x = Math.min(1, Math.max(0, (oom - t.oom) / METHOD_SCALE.k));
  return x * x * (3 - 2 * x);
}
/** Believed view: a stated q, or an end of the lab's range for each method (RF-S14: methodQRange; predictBeliefs' spread). */
export type MethodQ = number | 'lo' | 'hi';
/** The strength factor on the method's exponent at `oom`: the hidden q in the true view; in the believed, the midpoint
 *  of the lab's q range at `oom` (RF-S14: narrowed by a validation of the method, else the stated range), or `q`. */
export function methodStrength(s: GameStateV2, id: string, oom: number | undefined, view: EffView = 'true', q?: MethodQ): number {
  const tau = methodUntested(id, oom);
  if (tau === 0) return 1;
  let qq: number;
  if (view === 'true') qq = s.hidden.methodScale?.[id] ?? methodScaleOf(s.setup.seed)[id] ?? 1;
  else if (typeof q === 'number') qq = q;
  else { const r = methodQRange(s, id, oom); qq = q === 'lo' ? r.lo : q === 'hi' ? r.hi : r.mid; }
  return 1 - tau + tau * qq;
}
/** A method's multiplier on growth: mult = base^(s0·e·strength) (CP3f: log-space scaling; CP3i: strength at `oom`). */
export function methodMult(s: GameStateV2, id: string, base: number, view: EffView = 'true', oom?: number, q?: MethodQ): number {
  return clamp01(Math.pow(clamp01(base), methodS0(s, id) * methodEfficacy(s, id, view) * methodStrength(s, id, oom, view, q)));
}
/** A method's removal share: 1 − (1 − base)^(s0·e·strength) (CP3f: log-space scaling; CP3i: strength at `oom`). */
export function methodRemoval(s: GameStateV2, id: string, base: number, view: EffView = 'true', oom?: number, q?: MethodQ): number {
  return clamp01(1 - Math.pow(1 - clamp01(base), methodS0(s, id) * methodEfficacy(s, id, view) * methodStrength(s, id, oom, view, q)));
}

// ── RF-S14: validating a method (DECISIONS "Follow-ups to the review fixes"; BUILD-NOTES RF-S10's proposal) ──
// The same validation job as an instrument's (safety/validation.ts: need, cost, VAL_N): plant the trait in a test copy of
// the model, train it with the method, count the planted cases it removes (k of VAL_N). The planted removal share is
// 1 − base^(s0·e·strength) at that model's capability (the method's run effect, METHOD_MULT / methodBase); organism
// realism (SR-24b) applies as to instruments (planted = real ÷ r; the lab reads real use with the stated range). The
// lab's q range is then the q whose believed removal (believed efficacy, the same formula) lies in the real-use interval;
// above the validated model it widens back to the stated range by the same smoothstep over METHOD_SCALE.k.
/** The run effect of the methods playerMods writes as literals (one home: playerMods reads these). */
export const METHOD_MULT: Record<string, number> = { 'T-PERSONA': 0.7, 'T-CAST': 0.7, 'T-W2S': 0.8, 'T-CONFESS': 0.6 };
/** A method's base for the planted test: its growth multiplier, or 1 − its per-run removal (anti-scheming). */
export function methodBase(id: string): number | undefined {
  if (id === 'T-INOC') return INOC_MULT;
  if (id === 'T-ANTISCHEME') return 1 - ANTISCHEME_REMOVAL; // its removal (Schoen 2025 13% → 0.4%) is what a planted test counts
  if (id === 'T-UNDO') return UNDO_MISUSE_MULT;
  return METHOD_MULT[id];
}
/** Share of planted cases the method removes at `oom`: 1 − base^(s0·e·strength) (true view: engine only). */
export function plantedRemoval(s: GameStateV2, id: string, view: EffView, oom: number | undefined, q?: MethodQ): number {
  const b = methodBase(id);
  return b === undefined ? 0 : 1 - methodMult(s, id, b, view, oom, q);
}
export interface MethodQRange {
  lo: number; hi: number; mid: number;
  /** The model the method was validated on (null = never validated past its tested scale: the stated range). */
  on: string | null; found?: number; n?: number;
}
/** RF-S14: the lab's range for method `id`'s strength at scale q, read at `oom`. Believed inputs only (the validation's k of
 *  n, believed efficacy, the model's measured level, the stated realism and q ranges). */
export function methodQRange(s: GameStateV2, id: string, oom?: number): MethodQRange {
  const prior: MethodQRange = { lo: METHOD_SCALE.lo, hi: METHOD_SCALE.hi, mid: METHOD_SCALE_BELIEVED, on: null };
  const m = s.player.safety.techniques[id]?.measured;
  const mv = m ? versionById(s, m.on) : undefined;
  const base = methodBase(id);
  if (!m || !mv || base === undefined || base <= 0 || base >= 1) return prior;
  const xv = measuredOom(s, mv);
  const tv = methodUntested(id, xv);
  const k = methodS0(s, id) * methodEfficacy(s, id, 'believed');
  if (tv <= 0 || k <= 0) return prior; // at or below the tested scale a validation says nothing about larger models
  const r = realUseRange(m.found, m.n);
  const qOf = (p: number) => {
    const S = p >= 1 - 1e-12 ? Infinity : Math.log(1 - p) / (k * Math.log(base)); // believed strength giving removal p
    return Math.min(prior.hi, Math.max(prior.lo, (S - 1 + tv) / tv));
  };
  let lo = qOf(r.lo), hi = qOf(r.hi);
  if (oom !== undefined && oom > xv) {
    const x = Math.min(1, (oom - xv) / METHOD_SCALE.k);
    const w = x * x * (3 - 2 * x);
    lo += w * (prior.lo - lo);
    hi += w * (prior.hi - hi);
  }
  return { lo, hi, mid: (lo + hi) / 2, on: mv.id, found: m.found, n: m.n };
}

export interface MethodDef {
  id: TechniqueId;
  /** What the run gets (the engine effect, playerMods / playerEnv / misuseHazards). */
  effect: string;
  /** Its cost where the engine has one [D]; else undefined (no cash, compute or staff cost of its own). */
  cost?: string;
}

/** Post-training methods, in plan order. Effects are the engine's (safety/traits.ts playerMods, incidents.ts). */
export const METHODS: MethodDef[] = [
  { id: 'T-PERSONA', effect: 'Persona vectors: hacking → bad persona, narrow → broad misalignment and sycophancy growth ×0.7' },
  { id: 'T-CAST', effect: 'Corrigibility target: value lock-in, fakes alignment, power-seeking and self-preservation growth ×0.7' },
  { id: 'T-W2S', effect: 'Weak-to-strong supervision: sycophancy and proxy-goal growth ×0.8' },
  { id: 'T-CONFESS', effect: 'Honesty & confession training: oversight-conditional reward (E17) ×0.6' },
  { id: 'T-ANTISCHEME', effect: 'Anti-scheming training: scheming growth ×0.1 and −95% of scheming per run', cost: 'Eval awareness rises (×2) the first time a lineage gets it (Schoen et al. 2025)' },
  { id: 'T-INOC', effect: 'Inoculation prompting: hacking → misalignment ×0.15 (bad persona E04, learned-hacking generalisation to proxy goals, AF, sabotage, scheming)' },
  { id: 'T-UNDO', effect: 'Distill-after-unlearn: hazardous bio / cyber capability ×0.5 for misuse, kept under open-weights fine-tuning' },
];
export const METHOD_BY_ID = Object.fromEntries(METHODS.map((m) => [m.id, m])) as Record<string, MethodDef>;

/** Fix techniques that are not separate methods: where their effect lives (SAF-06 fold). */
export const FOLDED_METHODS: Record<string, string> = {
  'T-SPEC': 'the run\'s "Rewarded for: Constitution" option',
  'T-HARDEN': 'suite hardening (Suites tab)',
  'T-FILTER': 'the base run\'s Hazard data filter',
  'T-CCLASS': 'deployment safeguards (classifiers)',
};

/** Prefix of a "train against an instrument" entry in PostDesign.methods. */
export const AGAINST = 'against:';
export const againstOf = (post: Pick<PostDesign, 'methods'> | undefined): TechniqueId[] =>
  (post?.methods ?? []).filter((m) => m.startsWith(AGAINST)).map((m) => m.slice(AGAINST.length));
/** Does the run use method `id`? The ONLY switch for a method's effect. */
export const usesMethod = (post: Pick<PostDesign, 'methods'> | undefined, id: TechniqueId): boolean => !!post?.methods?.includes(id);

/** Methods the lab owns (unlocked fix techniques that are methods). */
export function ownedMethods(s: GameStateV2): TechniqueId[] {
  return METHODS.filter((m) => s.player.safety.techniques[m.id]?.unlocked).map((m) => m.id);
}
/** Instruments the run could train against (owned detect techniques). */
export function againstOptions(s: GameStateV2): TechniqueId[] {
  return Object.values(s.player.safety.techniques).filter((t) => t.unlocked && techniqueRole(t) === 'detect').map((t) => t.id);
}
/** The policy "Use all known methods" (on by default). */
export const methodPolicyOn = (s: GameStateV2) => s.player.safety.useAllMethods !== false;
/** A new run plan's methods: every owned method with the policy on, else the methods responses required (SR-18,
 *  SafetyDept.requiredMethods; owned only). Never trains against an instrument. */
export const defaultMethods = (s: GameStateV2): TechniqueId[] => {
  if (methodPolicyOn(s)) return ownedMethods(s);
  const owned = new Set(ownedMethods(s));
  return (s.player.safety.requiredMethods ?? []).filter((m) => owned.has(m));
};

/** Parse a params `methods` comma list (undefined → the policy default; '' → none). Unknown or unowned entries drop. */
export function methodsFromParam(s: GameStateV2, raw: unknown): TechniqueId[] {
  if (typeof raw !== 'string') return defaultMethods(s);
  const owned = new Set(ownedMethods(s));
  const inst = new Set(againstOptions(s));
  return raw.split(',').filter(Boolean).filter((m) => (m.startsWith(AGAINST) ? inst.has(m.slice(AGAINST.length)) : owned.has(m)));
}

/** Preview lines of a run's methods: each method's effect (gain) and its cost where one exists; train-against gets the
 *  honest preview (OD-11). CP3i: `G` is the planned model's (believed) capability; a method it has outgrown says so and
 *  shows its strength as the stated range. */
export function methodLines(s: GameStateV2, post: PostDesign, lineage?: string, G?: number): { gains: CostLine[]; exposure: CostLine[] } {
  const oom = G === undefined ? undefined : G - gV0(s.hidden.timeline);
  const gains: CostLine[] = [];
  const exposure: CostLine[] = [];
  for (const m of post.methods) {
    if (m.startsWith(AGAINST)) {
      const id = m.slice(AGAINST.length);
      const name = TECHNIQUE_BY_ID[id]?.name ?? id;
      exposure.push({ currency: 'monitorability', amount: -1, unit: 'mark', target: `train against ${name}: what it sees falls ${Math.round(RETRAIN_VISIBLE[0] * 100)}–${Math.round(RETRAIN_VISIBLE[1] * 100)}%, the true trait only ${Math.round(RETRAIN_TRUE[0] * 100)}–${Math.round(RETRAIN_TRUE[1] * 100)}%; ${name} gets a trained-against mark (its reliability on the new model drops)` });
      continue;
    }
    const d = METHOD_BY_ID[m];
    if (!d) continue;
    // SR-15: the effect is the typical one (at the agenda's prior mean efficacy) × s0·e; the plan shows the believed e.
    const k = methodS0(s, m) * methodEfficacy(s, m, 'believed');
    const tau = methodUntested(m, oom);
    // CP3i: past the tested capability the strength is the stated range (never the world's draw). RF-S10: player
    // language, no citations (the sources stay in data/v2/agendas.ts METHOD_TESTED_OOM).
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    // RF-S14: the range is the lab's (narrowed by a validation of the method, widening again above the validated model).
    const qr = methodQRange(s, m, oom);
    const vOn = qr.on ? versionById(s, qr.on)?.name ?? qr.on : null;
    const scale = tau > 0
      ? `. Only tested on weaker models than this one, so how well it holds here is ${vOn ? `known only from your validation on ${vOn} (it removed ${qr.found} of ${qr.n} planted cases)` : 'unknown'}: anywhere from ${pct(k * (1 - tau + tau * qr.lo))} to ${pct(k * (1 - tau + tau * qr.hi))} of the published strength (expected ${pct(k * methodStrength(s, m, oom, 'believed'))})`
      : '';
    gains.push({ currency: 'alignment', amount: 1, unit: 'method', target: `${d.effect} as published; yours about ${pct(k)} as strong (from your research on it)${scale}` });
    if (m === 'T-ANTISCHEME' && (!lineage || s.flags[`ws2.e25.${lineage}`] === undefined)) exposure.push({ currency: 'monitorability', amount: -1, unit: 'EA', target: `eval awareness ×${ANTISCHEME_EA_MULT}: the first anti-scheming training on this lineage (Schoen et al. 2025)` });
  }
  return { gains, exposure };
}
