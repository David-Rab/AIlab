// Trait nodes of the causal graph (V2-SPEC §3.5.4; research/04 T-numbers). Owner: WS2.
import type { TraitId, TraitVector } from '../../engine/v2/types';

export interface TraitDefV2 { id: TraitId; name: string; r04: string; /** scaled by difficultyMult */ difficulty: boolean; protective?: boolean }

export const TRAITS_V2: TraitDefV2[] = [
  { id: 'SYC', name: 'Sycophancy', r04: 'T01', difficulty: false },
  { id: 'RH', name: 'Reward hacking', r04: 'T02', difficulty: true },
  { id: 'PROXY', name: 'Proxy goals', r04: 'T03/T10/T11', difficulty: true },
  { id: 'SA', name: 'Situational awareness', r04: 'T04', difficulty: false },
  { id: 'PERSONA', name: 'Misaligned persona', r04: 'T05', difficulty: true },
  { id: 'OBF', name: 'Obfuscated reasoning', r04: 'T15', difficulty: false },
  { id: 'EA', name: 'Eval awareness', r04: 'T09', difficulty: false },
  { id: 'TGAME', name: 'Training gaming', r04: 'T12', difficulty: true },
  { id: 'CONCEAL', name: 'Concealment', r04: 'T06/T07', difficulty: true },
  { id: 'POWER', name: 'Power seeking', r04: 'T13/T14/T22', difficulty: true },
  { id: 'AF', name: 'Alignment faking', r04: 'T16', difficulty: true },
  { id: 'SAND', name: 'Sandbagging', r04: 'T17', difficulty: true },
  { id: 'SCHEME', name: 'Scheming', r04: 'T19/T20', difficulty: true },
  { id: 'COLLUDE', name: 'Collusion', r04: 'T18', difficulty: true },
  { id: 'SUCC', name: 'Successor alignment to self', r04: 'T23', difficulty: true },
  { id: 'HONEST', name: 'Honesty', r04: 'virtue', difficulty: false, protective: true },
  { id: 'CORRIG', name: 'Corrigibility', r04: 'virtue', difficulty: false, protective: true },
];

export const TRAIT_IDS: TraitId[] = TRAITS_V2.map((t) => t.id);

/** V0 start values, Agent era (§3.5.4) [D]. */
export const TRAIT_START: TraitVector = {
  SYC: 0.25, RH: 0.15, PROXY: 0.1, SA: 0.3, PERSONA: 0.05, OBF: 0.02, EA: 0.15, TGAME: 0.02, CONCEAL: 0.1,
  POWER: 0.03, AF: 0.03, SAND: 0.02, SCHEME: 0.01, COLLUDE: 0.01, SUCC: 0, HONEST: 0.5, CORRIG: 0.5,
};

/** Critical set K for Understanding U (§3.5.7). */
export const CRITICAL_TRAITS: TraitId[] = ['SCHEME', 'AF', 'SAND', 'POWER', 'SUCC', 'COLLUDE'];
