// SR-14 (SAFETY-REDESIGN §2.2 concept 8, §3.4; research-safety SAF-04 / SAF-05 / SAF-06; DECISIONS OD-11): training-time
// safety METHODS are run-plan options. A post-training run lists the methods it uses in PostDesign.methods; each method's
// effect applies only if the run lists it (no research line staffing switches anything on). The standing policy "Use all
// known methods" (SafetyDept.useAllMethods, on by default) fills each new run plan with every owned method.
// "Train against an instrument" is a method entry `against:<instrument id>` (flagged, never filled by the policy) whose
// preview says what the mechanism does (safety/traits.ts goodhartTrain): visible trait −70–90%, true trait −20–40%, and
// the instrument's reliability on the new model falls (a trained-against mark).
// Folded (no longer separate methods): constitution / spec (T-SPEC) is the run's "Rewarded for: Constitution" option;
// environment hardening (T-HARDEN) is suite hardening (Suites tab); inoculation prompting (T-INOC) is the run's
// Inoculation option; hazard data filtering (T-FILTER) is the base run's Hazard data filter (a pretraining choice).
import { TECHNIQUE_BY_ID } from '../../../data/v2/techniques';
import type { CostLine, GameStateV2, PostDesign, TechniqueId } from '../types';
import { ANTISCHEME_EA_MULT, RETRAIN_TRUE, RETRAIN_VISIBLE } from './traits';
import { techniqueRole } from './techniques';

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
  { id: 'T-UNDO', effect: 'Distill-after-unlearn: hazardous bio / cyber capability ×0.5 for misuse, kept under open-weights fine-tuning' },
];
export const METHOD_BY_ID = Object.fromEntries(METHODS.map((m) => [m.id, m])) as Record<string, MethodDef>;

/** Fix techniques that are not separate methods: where their effect lives (SAF-06 fold). */
export const FOLDED_METHODS: Record<string, string> = {
  'T-SPEC': 'the run\'s "Rewarded for: Constitution" option',
  'T-HARDEN': 'suite hardening (Suites tab)',
  'T-INOC': 'the run\'s Inoculation option',
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
/** A new run plan's methods: every owned method with the policy on, else none. Never trains against an instrument. */
export const defaultMethods = (s: GameStateV2): TechniqueId[] => (methodPolicyOn(s) ? ownedMethods(s) : []);

/** Parse a params `methods` comma list (undefined → the policy default; '' → none). Unknown or unowned entries drop. */
export function methodsFromParam(s: GameStateV2, raw: unknown): TechniqueId[] {
  if (typeof raw !== 'string') return defaultMethods(s);
  const owned = new Set(ownedMethods(s));
  const inst = new Set(againstOptions(s));
  return raw.split(',').filter(Boolean).filter((m) => (m.startsWith(AGAINST) ? inst.has(m.slice(AGAINST.length)) : owned.has(m)));
}

/** Preview lines of a run's methods: each method's effect (gain) and its cost where one exists; train-against gets the
 *  honest preview (OD-11). */
export function methodLines(s: GameStateV2, post: PostDesign, lineage?: string): { gains: CostLine[]; exposure: CostLine[] } {
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
    gains.push({ currency: 'alignment', amount: 1, unit: 'method', target: d.effect });
    if (m === 'T-ANTISCHEME' && (!lineage || s.flags[`ws2.e25.${lineage}`] === undefined)) exposure.push({ currency: 'monitorability', amount: -1, unit: 'EA', target: `eval awareness ×${ANTISCHEME_EA_MULT}: the first anti-scheming training on this lineage (Schoen et al. 2025)` });
  }
  return { gains, exposure };
}
