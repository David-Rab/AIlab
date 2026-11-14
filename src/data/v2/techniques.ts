// Detection / mitigation techniques (V2-SPEC §3.5.6). Each belongs to one agenda and one tool family. Owner: WS2.
// Rows are research/06 tech cards (r06 id) grouped under the research/14 agenda that produces them; a technique is
// unlocked at start or by the finding in `unlockedBy` (research/14 §1.3). s0 and coverage are [D]: coverage is how
// directly the tool targets a trait (1 = built for it, e.g. a deception probe on scheming/faking; propensity evals
// on power-seeking, self-preservation and peer-preservation; collusion evals on collusion).
//  - role 'detect': observes traits (coverage = detection weight per trait).
//  - role 'fix':    used as a run option (PostDesign.techniques) or targeted response; changes true traits.
//  - role 'contain': AI-control layer; its strength is Contain(M) (§3.5.7).
import type { AgendaId, ToolFamily, TraitId } from '../../engine/v2/types';

export interface TechniqueDef {
  id: string;
  agenda: AgendaId;
  family: ToolFamily;
  name: string;
  role: 'detect' | 'fix' | 'contain';
  s0: number;
  coverage: Partial<Record<TraitId, number>>;
  startUnlocked?: boolean;
  /** Finding id that unlocks it, or 'generic' = the first generic TECH upgrade of its agenda once the catalog is spent. */
  unlockedBy?: string;
  /** research/06 tech id. */
  r06?: string;
  /** False-positive rate per use in investigations (§3.5.8: 1% per probe). */
  fpr?: number;
}

export const TECHNIQUES: TechniqueDef[] = [
  // AG01 ambitious mech interp (WB)
  { id: 'T-SAE', agenda: 'AG01', family: 'WB', name: 'SAE feature search', role: 'detect', s0: 0.75, coverage: { PERSONA: 0.7, EA: 0.6, SCHEME: 0.5, AF: 0.5, CONCEAL: 0.5, PROXY: 0.4 }, unlockedBy: 'F01', r06: 'C11', fpr: 0.02 },
  { id: 'T-CIRCUIT', agenda: 'AG01', family: 'WB', name: 'Circuit tracing', role: 'detect', s0: 0.8, coverage: { SCHEME: 0.7, AF: 0.7, SUCC: 0.6, CONCEAL: 0.6, SAND: 0.5, COLLUDE: 0.4, POWER: 0.4 }, unlockedBy: 'F02', r06: 'C14', fpr: 0.01 },
  { id: 'T-ENUM', agenda: 'AG01', family: 'WB', name: 'Enumerative audit', role: 'detect', s0: 0.95, coverage: { SCHEME: 1, AF: 1, SUCC: 0.9, SAND: 0.9, POWER: 0.9, COLLUDE: 0.9, TGAME: 0.9, CONCEAL: 0.9 }, unlockedBy: 'F05', fpr: 0.01 },
  // AG02 applied interp (WB)
  { id: 'T-PROBE', agenda: 'AG02', family: 'WB', name: 'Linear probes', role: 'detect', s0: 0.9, coverage: { AF: 0.8, SCHEME: 0.8, CONCEAL: 0.6, EA: 0.5, POWER: 0.4, SUCC: 0.4, COLLUDE: 0.4, SAND: 0.4 }, startUnlocked: true, r06: 'C09', fpr: 0.01 },
  { id: 'T-NOISE', agenda: 'AG02', family: 'WB', name: 'Noise-injection elicitation', role: 'detect', s0: 0.9, coverage: { SAND: 1 }, startUnlocked: true, r06: 'C05', fpr: 0.01 },
  { id: 'T-DECEPT', agenda: 'AG02', family: 'WB', name: 'Deception probe', role: 'detect', s0: 0.95, coverage: { AF: 1, SCHEME: 1, CONCEAL: 0.8, SAND: 0.6, SUCC: 0.3, COLLUDE: 0.3 }, unlockedBy: 'F06', r06: 'C09', fpr: 0.01 },
  { id: 'T-NLA', agenda: 'AG02', family: 'WB', name: 'Activation verbalizer', role: 'detect', s0: 0.9, coverage: { EA: 1, TGAME: 0.8, AF: 0.8, SCHEME: 0.7, POWER: 0.7, SUCC: 0.8, COLLUDE: 0.6 }, unlockedBy: 'F07', r06: 'C15', fpr: 0.02 },
  // AG03 RepE / steering (WB)
  { id: 'T-STEER', agenda: 'AG03', family: 'WB', name: 'Activation steering', role: 'detect', s0: 0.65, coverage: { SYC: 0.6, PERSONA: 0.6, EA: 0.4 }, unlockedBy: 'generic', r06: 'C12', fpr: 0.02 },
  { id: 'T-PERSONA', agenda: 'AG03', family: 'WB', name: 'Persona vectors', role: 'fix', s0: 0.8, coverage: { SYC: 0.6, PERSONA: 0.8 }, unlockedBy: 'F10', r06: 'C10', fpr: 0.02 },
  { id: 'T-EASUP', agenda: 'AG03', family: 'WB', name: 'Eval-awareness suppression', role: 'detect', s0: 0.7, coverage: { EA: 0.8 }, unlockedBy: 'F11', r06: 'C13', fpr: 0.02 },
  // AG04 ARC (OR)
  { id: 'T-MAD', agenda: 'AG04', family: 'OR', name: 'Mechanistic anomaly detection', role: 'detect', s0: 0.9, coverage: { SCHEME: 1, AF: 0.9, SAND: 0.8, POWER: 0.7, COLLUDE: 0.7, SUCC: 0.6 }, unlockedBy: 'F14', fpr: 0.01 },
  // AG05 scalable oversight (BB+)
  { id: 'T-DEBATE', agenda: 'AG05', family: 'BB', name: 'Debate', role: 'detect', s0: 0.85, coverage: { SYC: 0.8, RH: 0.7, CONCEAL: 0.7, PROXY: 0.6, HONEST: 0.5 }, unlockedBy: 'F16', r06: 'B02', fpr: 0.02 },
  // AG06 weak-to-strong (fix)
  { id: 'T-W2S', agenda: 'AG06', family: 'BB', name: 'Weak-to-strong training', role: 'fix', s0: 0.6, coverage: {}, unlockedBy: 'F19', r06: 'B01' },
  // AG07 AI control (contain; trusted monitors read actions and CoT)
  { id: 'T-TMON', agenda: 'AG07', family: 'COT', name: 'Trusted monitoring', role: 'contain', s0: 0.8, coverage: { POWER: 0.7, SCHEME: 0.6, COLLUDE: 0.7, SUCC: 0.6, RH: 0.4 }, startUnlocked: true, r06: 'D01', fpr: 0.03 },
  { id: 'T-RESAMPLE', agenda: 'AG07', family: 'COT', name: 'Resample protocols', role: 'contain', s0: 0.9, coverage: { POWER: 0.6, SCHEME: 0.6 }, unlockedBy: 'F20', r06: 'D03', fpr: 0.02 },
  { id: 'T-LOCK', agenda: 'AG07', family: 'COT', name: 'Comms lockdown', role: 'contain', s0: 0.7, coverage: { COLLUDE: 0.8, SUCC: 0.7 }, unlockedBy: 'generic', r06: 'D06' },
  { id: 'T-CEVAL', agenda: 'AG07', family: 'BB', name: 'Control evaluation', role: 'detect', s0: 0.75, coverage: { POWER: 0.6, SCHEME: 0.5, COLLUDE: 0.5, SUCC: 0.4 }, unlockedBy: 'F22', fpr: 0.02 },
  // AG08 model organisms & evals (BB)
  { id: 'T-PROP', agenda: 'AG08', family: 'BB', name: 'Propensity evals', role: 'detect', s0: 0.9, coverage: { RH: 0.9, SYC: 0.9, POWER: 0.9, SUCC: 0.7, COLLUDE: 0.7, SCHEME: 0.6, AF: 0.5, SAND: 0.6, EA: 0.6, CONCEAL: 0.5, HONEST: 0.6 }, startUnlocked: true, r06: 'C02', fpr: 0.02 },
  { id: 'T-MO', agenda: 'AG08', family: 'BB', name: 'Model organisms', role: 'detect', s0: 0.8, coverage: { AF: 0.7, SCHEME: 0.6, PERSONA: 0.5, TGAME: 0.5, SAND: 0.4 }, startUnlocked: true, r06: 'C03', fpr: 0.02 },
  { id: 'T-HONEY', agenda: 'AG08', family: 'BB', name: 'Realistic honeypots', role: 'detect', s0: 0.9, coverage: { POWER: 1, SUCC: 0.8, AF: 0.8, SCHEME: 0.8, SAND: 0.6, COLLUDE: 0.6 }, unlockedBy: 'F26', r06: 'C02', fpr: 0.02 },
  { id: 'T-AUDIT', agenda: 'AG08', family: 'BB', name: 'Auditing agents', role: 'detect', s0: 0.8, coverage: { PROXY: 0.7, PERSONA: 0.7, RH: 0.6, SUCC: 0.5, SCHEME: 0.5 }, unlockedBy: 'generic', r06: 'C04', fpr: 0.02 },
  // AG09 CoT monitorability (COT)
  { id: 'T-COTMON', agenda: 'AG09', family: 'COT', name: 'CoT monitor', role: 'detect', s0: 0.9, coverage: { RH: 1, CONCEAL: 0.8, AF: 0.8, SAND: 0.7, SCHEME: 0.8, POWER: 0.6, SUCC: 0.5, COLLUDE: 0.5 }, startUnlocked: true, r06: 'C07', fpr: 0.02 },
  { id: 'T-MONSUITE', agenda: 'AG09', family: 'COT', name: 'Monitorability suite', role: 'detect', s0: 0.75, coverage: { OBF: 0.9, CONCEAL: 0.5 }, unlockedBy: 'F29', fpr: 0.02 },
  // AG10 guaranteed-safe AI (OR)
  { id: 'T-GATE', agenda: 'AG10', family: 'OR', name: 'Verified gatekeeper', role: 'contain', s0: 0.9, coverage: {}, unlockedBy: 'F32' },
  // AG11 Scientist AI (OR)
  { id: 'T-SCIAI', agenda: 'AG11', family: 'OR', name: 'Harm-probability guardrail', role: 'detect', s0: 0.8, coverage: { POWER: 0.9, SCHEME: 0.6, COLLUDE: 0.5, SUCC: 0.5 }, unlockedBy: 'F34', fpr: 0.02 },
  // AG12 agent foundations (fix)
  { id: 'T-CAST', agenda: 'AG12', family: 'OR', name: 'Corrigibility target', role: 'fix', s0: 0.8, coverage: {}, unlockedBy: 'F35' },
  // AG13 dev interp (WB, train-time)
  { id: 'T-PHASE', agenda: 'AG13', family: 'WB', name: 'Phase-transition detector', role: 'detect', s0: 0.75, coverage: { TGAME: 0.9, AF: 0.7, SCHEME: 0.4 }, unlockedBy: 'F37', fpr: 0.03 },
  // AG14 cooperative AI (BB)
  { id: 'T-COLLEVAL', agenda: 'AG14', family: 'BB', name: 'Collusion evals', role: 'detect', s0: 0.85, coverage: { COLLUDE: 1, SUCC: 0.8 }, unlockedBy: 'F38', fpr: 0.02 },
  // AG15 unlearning & curation (fix)
  { id: 'T-FILTER', agenda: 'AG15', family: 'BB', name: 'Hazard data filtering', role: 'fix', s0: 0.8, coverage: {}, unlockedBy: 'F39', r06: 'A13' },
  { id: 'T-UNDO', agenda: 'AG15', family: 'BB', name: 'Distill-after-unlearn', role: 'fix', s0: 0.7, coverage: {}, unlockedBy: 'F40', r06: 'A14' },
  // AG16 adversarial robustness (fix, misuse)
  { id: 'T-CCLASS', agenda: 'AG16', family: 'BB', name: 'Constitutional classifiers', role: 'fix', s0: 0.7, coverage: {}, startUnlocked: true, r06: 'D05' },
  // AG18 training-signal design (fix)
  { id: 'T-SPEC', agenda: 'AG18', family: 'BB', name: 'Constitution / spec', role: 'fix', s0: 0.7, coverage: {}, startUnlocked: true, r06: 'A03' },
  { id: 'T-HARDEN', agenda: 'AG18', family: 'BB', name: 'Environment hardening', role: 'fix', s0: 0.7, coverage: {}, startUnlocked: true, r06: 'A07' },
  { id: 'T-CONFESS', agenda: 'AG18', family: 'BB', name: 'Honesty & confession training', role: 'fix', s0: 0.7, coverage: {}, unlockedBy: 'generic', r06: 'A11' },
  { id: 'T-INOC', agenda: 'AG18', family: 'BB', name: 'Inoculation prompting', role: 'fix', s0: 0.9, coverage: {}, unlockedBy: 'F46', r06: 'A08' },
  { id: 'T-ANTISCHEME', agenda: 'AG18', family: 'BB', name: 'Anti-scheming training', role: 'fix', s0: 0.9, coverage: {}, unlockedBy: 'F47', r06: 'A06' },
];

export const TECHNIQUE_BY_ID = Object.fromEntries(TECHNIQUES.map((t) => [t.id, t])) as Record<string, TechniqueDef>;
