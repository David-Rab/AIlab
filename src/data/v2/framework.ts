// SR-19: the default Safety framework (SAFETY-REDESIGN §3.8, OD-5) and its edit limits and override costs.
// Modelled on the published frontier safety frameworks (primary documents):
//   [OAI-PF2] OpenAI, Preparedness Framework, version 2 (15 Apr 2025): tracked categories Biological & Chemical,
//             Cybersecurity, AI Self-improvement; a High threshold requires safeguards that sufficiently minimise the
//             risk BEFORE DEPLOYMENT; a Critical threshold requires safeguards DURING DEVELOPMENT (development is halted
//             until they are in place).
//   [ANT-RSP] Anthropic, Responsible Scaling Policy, version 2.2 (May 2025): capability thresholds CBRN-3 / CBRN-4 and
//             AI R&D-4 / AI R&D-5; a capability assessment of every notably more capable model; ASL-3 deployment
//             standard (classifier safeguards, misuse defences) and an affirmative case on misalignment at AI R&D-4; if
//             the required standard cannot be met, deployment and further scaling are paused.
//   [GDM-FSF] Google DeepMind, Frontier Safety Framework, version 3.0 (Sep 2025): critical capability levels for CBRN,
//             Cyber, Harmful manipulation, ML R&D and Misalignment (instrumental reasoning); deployment and security
//             mitigations per CCL, a response plan before external deployment and before large-scale internal
//             deployment, and monitoring for deceptive alignment.
// The levels below are this game's L scale (V0 ≈ 5; the BIO ≥ 10 framework pledge, actors/actions.ts) [D]; which
// documents each rule follows is in its `src`. Rules read MEASURED levels and the player's beliefs, never truth.
import type { EvalDepth, FrameworkRule, SafetyFramework } from '../../engine/v2/types';

export const DEFAULT_FRAMEWORK_RULES: readonly FrameworkRule[] = [
  { id: 'bio-high', label: 'Biological: High', trigger: { kind: 'capability', domain: 'BIO', level: 10 }, holds: 'deploy', safeguards: ['classifiers'], evidence: ['suite'], src: 'OAI-PF2 Bio High; ANT-RSP CBRN-3 → ASL-3 deployment standard [D level]' },
  { id: 'cyber-high', label: 'Cyber: High', trigger: { kind: 'capability', domain: 'CYBER', level: 10 }, holds: 'deploy', safeguards: ['classifiers'], evidence: ['suite'], src: 'OAI-PF2 Cybersecurity High; GDM-FSF Cyber CCL deployment mitigations [D level]' },
  { id: 'bio-critical', label: 'Biological: Critical', trigger: { kind: 'capability', domain: 'BIO', level: 12 }, holds: 'deploy', safeguards: ['hardened'], evidence: ['suite', 'external'], src: 'OAI-PF2 Bio Critical; ANT-RSP CBRN-4 [D level]' },
  { id: 'cyber-critical', label: 'Cyber: Critical', trigger: { kind: 'capability', domain: 'CYBER', level: 12 }, holds: 'deploy', safeguards: ['hardened'], evidence: ['suite', 'external'], src: 'OAI-PF2 Cybersecurity Critical; GDM-FSF Cyber CCL [D level]' },
  { id: 'aird-critical', label: 'AI R&D: Critical', trigger: { kind: 'capability', domain: 'RSCH', level: 12 }, holds: 'training', safeguards: ['control', 'review'], evidence: ['suite', 'external'], src: 'OAI-PF2 AI Self-improvement Critical (safeguards during development); ANT-RSP AI R&D-4/5; GDM-FSF ML R&D CCL [D level]' },
  { id: 'misalignment', label: 'Misalignment signs', trigger: { kind: 'belief', est: 0.3, clarity: 0.4 }, holds: 'training', safeguards: ['control'], evidence: [], src: 'GDM-FSF Misalignment / deceptive-alignment monitoring; ANT-RSP affirmative misalignment case; the old red-flag line (est > 30%, clarity > 0.4) [D]' },
];

/** The default framework: full capability assessment before release, no mandatory external review. */
export function defaultFramework(evalDepth: EvalDepth | 'none' = 'full', externalReview = false): SafetyFramework {
  return { evalDepth, externalReview, rules: DEFAULT_FRAMEWORK_RULES.map((r) => ({ ...r, trigger: { ...r.trigger }, safeguards: [...r.safeguards], evidence: [...r.evidence] })), overrides: [], holds: [] };
}

/** Edit limits [D]: a capability threshold may move at most this far from its default (L), a belief threshold this far
 *  (estimate); safeguards and evidence may be added, never removed below the default; rules are not deleted. */
export const FRAMEWORK_LEVEL_SLACK = 2;
export const FRAMEWORK_BELIEF_SLACK = 0.2;

/** What an explicit override costs, each stated in its preview and applied [D]: staff (safety-team morale, and one red
 *  flag: the whistleblower hazard, security.ts), government (scrutiny: evaluators and frontier-AI statutes ask about
 *  departures from a lab's own framework; California SB 53 (2025) requires large developers to publish and follow one) and reputation (credibility, only when the framework is
 *  published: the lab's framework commitment is live). */
export const OVERRIDE_COST = { moraleSafety: 5, scrutiny: 3, credibility: 5 } as const;

export const SAFEGUARD_NEED_LABEL: Record<FrameworkRule['safeguards'][number], string> = {
  classifiers: 'classifier misuse safeguards', hardened: 'hardened misuse safeguards',
  control: 'control protocol on internal AI work', review: 'human review on internal AI work',
};
export const EVIDENCE_NEED_LABEL: Record<FrameworkRule['evidence'][number], string> = {
  suite: 'an eval suite of this version', external: 'an external evaluation of this version',
};
