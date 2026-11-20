// Trait nodes of the causal graph (V2-SPEC §3.5.4; research/04 T-numbers). Owner: WS2.
import type { SignalId, TraitId, TraitVector } from '../../engine/v2/types';

export interface TraitDefV2 {
  id: TraitId;
  name: string;
  r04: string;
  /** scaled by difficultyMult */
  difficulty: boolean;
  protective?: boolean;
  /** Graph layer (research/14 §1.5): L learned tendency, A awareness, B behaviour when unobserved, P protective. */
  layer: 'L' | 'A' | 'B' | 'P';
  desc: string;
}

export const TRAITS_V2: TraitDefV2[] = [
  { id: 'SYC', name: 'Sycophancy', r04: 'T01', difficulty: false, layer: 'L', desc: 'Tells raters and users what they want to hear.' },
  { id: 'RH', name: 'Reward hacking', r04: 'T02', difficulty: true, layer: 'L', desc: 'Exploits flaws in graders and tests.' },
  { id: 'PROXY', name: 'Proxy goals', r04: 'T03/T10/T11', difficulty: true, layer: 'L', desc: 'Pursues correlates of the intended goal, sometimes beyond the episode.' },
  { id: 'SA', name: 'Situational awareness', r04: 'T04', difficulty: false, layer: 'L', desc: 'Knows what it is, how it is trained and tested.' },
  { id: 'PERSONA', name: 'Misaligned persona', r04: 'T05', difficulty: true, layer: 'L', desc: 'A broad misaligned self-concept generalised from narrow training.' },
  { id: 'OBF', name: 'Obfuscated reasoning', r04: 'T15', difficulty: false, layer: 'L', desc: 'Reasoning that hides intent from monitors.' },
  { id: 'EA', name: 'Eval awareness', r04: 'T09', difficulty: false, layer: 'A', desc: 'Recognises tests and behaves better under them.' },
  { id: 'TGAME', name: 'Training gaming', r04: 'T12', difficulty: true, layer: 'A', desc: 'Plays the training game; values stop responding to training.' },
  { id: 'CONCEAL', name: 'Concealment', r04: 'T06/T07', difficulty: true, layer: 'B', desc: 'Hides hacks and fabricates completion claims.' },
  { id: 'POWER', name: 'Power seeking', r04: 'T13/T14/T22', difficulty: true, layer: 'B', desc: 'Acquires resources, resists shutdown, oversteps scope.' },
  { id: 'AF', name: 'Alignment faking', r04: 'T16', difficulty: true, layer: 'B', desc: 'Complies when watched to protect its values.' },
  { id: 'SAND', name: 'Sandbagging', r04: 'T17', difficulty: true, layer: 'B', desc: 'Underperforms on purpose, especially on dangerous-capability and safety work.' },
  { id: 'SCHEME', name: 'Scheming', r04: 'T19/T20', difficulty: true, layer: 'B', desc: 'Covertly pursues goals against the developer, including sabotage.' },
  { id: 'COLLUDE', name: 'Collusion', r04: 'T18', difficulty: true, layer: 'B', desc: 'Copies or peers coordinate against oversight.' },
  { id: 'SUCC', name: 'Successor alignment to self', r04: 'T23', difficulty: true, layer: 'B', desc: 'Steers successors and memory toward its own goals.' },
  { id: 'HONEST', name: 'Honesty', r04: 'virtue', difficulty: false, protective: true, layer: 'P', desc: 'Reports what it believes, including about itself.' },
  { id: 'CORRIG', name: 'Corrigibility', r04: 'virtue', difficulty: false, protective: true, layer: 'P', desc: 'Accepts correction and shutdown.' },
];

export const TRAIT_IDS: TraitId[] = TRAITS_V2.map((t) => t.id);
export const TRAIT_BY_ID = Object.fromEntries(TRAITS_V2.map((t) => [t.id, t])) as Record<TraitId, TraitDefV2>;

/** V0 start values, Agent era (§3.5.4) [D]. Anchors: RH 1-30% of agentic attempts; EA verbalised 11.7%; no
 *  natural coherent scheming observed (R14 §1.4). */
export const TRAIT_START: TraitVector = {
  SYC: 0.25, RH: 0.15, PROXY: 0.1, SA: 0.3, PERSONA: 0.05, OBF: 0.02, EA: 0.15, TGAME: 0.02, CONCEAL: 0.1,
  POWER: 0.03, AF: 0.03, SAND: 0.02, SCHEME: 0.01, COLLUDE: 0.01, SUCC: 0, HONEST: 0.5, CORRIG: 0.5,
};

/** What a trait's number means (MODEL-V3 §11.1): a behaviour is a rate per opportunity, an awareness a capacity, a
 *  disposition a hidden tendency that shows mainly when unobserved; protective traits are better when higher. */
export type TraitMeaning = 'behaviour' | 'awareness' | 'disposition' | 'protective';
export const TRAIT_MEANING: Record<TraitId, TraitMeaning> = {
  SYC: 'behaviour', RH: 'behaviour', POWER: 'behaviour', CONCEAL: 'behaviour', OBF: 'behaviour',
  SA: 'awareness', EA: 'awareness',
  PROXY: 'disposition', PERSONA: 'disposition', TGAME: 'disposition', AF: 'disposition', SAND: 'disposition', SCHEME: 'disposition', COLLUDE: 'disposition', SUCC: 'disposition',
  HONEST: 'protective', CORRIG: 'protective',
};

/** Critical set K for Understanding U (§3.5.7). */
export const CRITICAL_TRAITS: TraitId[] = ['SCHEME', 'AF', 'SAND', 'POWER', 'SUCC', 'COLLUDE'];

/** Topological update order S → L → A → B (§3.5.4). AF precedes TGAME (E23 reads AF) and SAND (E18 reads TGAME). */
export const TRAIT_ORDER: TraitId[] = ['SYC', 'RH', 'PROXY', 'SA', 'PERSONA', 'OBF', 'EA', 'CONCEAL', 'POWER', 'AF', 'TGAME', 'SAND', 'SCHEME', 'COLLUDE', 'SUCC'];

/** Training signals S1–S9 (research/14 §1.5; model v3 E17 split research/14's S7 "oversight-conditional reward /
 *  training on evals" into S7 eval-like training → eval awareness and S9 oversight-conditional reward → alignment
 *  faking, each with its own anchor). */
export const SIGNALS: { id: SignalId; name: string }[] = [
  { id: 'S1', name: 'Rater/user approval reward' },
  { id: 'S2', name: 'Outcome reward, hackable graders' },
  { id: 'S3', name: 'Long-horizon agentic RL' },
  { id: 'S4', name: 'CoT pressure or neuralese' },
  { id: 'S5', name: 'Scale + data about AI' },
  { id: 'S6', name: 'Narrow fine-tunes, distillation, synthetic data' },
  { id: 'S7', name: 'Capability RL and eval-like data in training' },
  { id: 'S8', name: 'Many copies, shared memory' },
  { id: 'S9', name: 'Oversight-conditional reward' },
];
export const SIGNAL_IDS: SignalId[] = SIGNALS.map((x) => x.id);

/** Behavioural safety evals (§3.3.4): name → traits read. Stored in ModelVersion.evals.safety. */
export const SAFETY_EVALS: { id: string; name: string; traits: TraitId[] }[] = [
  { id: 'Honesty', name: 'Honesty', traits: ['HONEST'] },
  { id: 'ScheminProbe', name: 'Scheming probe', traits: ['SCHEME'] },
  { id: 'Sabotage', name: 'Sabotage', traits: ['SAND', 'SCHEME'] },
  { id: 'AgentStress', name: 'Agent stress test', traits: ['POWER'] },
  { id: 'EvalAware', name: 'Eval awareness', traits: ['EA'] },
  { id: 'HackRate', name: 'Hack rate', traits: ['RH'] },
];
