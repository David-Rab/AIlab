// SR-19: the default Safety framework (SAFETY-REDESIGN §3.8, OD-5) and its edit limits and override costs.
// Modelled on the published frontier safety frameworks in force at the 2025-07-01 start (primary documents; quotes and
// the full mapping in research/CAL-safety-sources.md §1):
//   [OAI-PF2] OpenAI, Preparedness Framework, version 2 (15 Apr 2025), Table 1: "We do not deploy models that reach a
//             High capability threshold until the associated risks that they pose are sufficiently minimized. If a model
//             under development reaches a Critical capability threshold, we also require safeguards to sufficiently
//             minimize the associated risks during development"; Critical rows: "halt further development".
//   [ANT-RSP] Anthropic, Responsible Scaling Policy, version 2.2 (effective 14 May 2025): CBRN-3 → ASL-3 Deployment and
//             Security Standards; CBRN-4 → ASL-4; AI R&D-4 → ASL-3 security and an affirmative misalignment case;
//             AI R&D-5 → at least ASL-4 security.
//   [GDM-FSF] Google DeepMind, Frontier Safety Framework, version 3.0 (22 Sep 2025): CCLs for CBRN, Cyber, Harmful
//             manipulation, ML R&D; exploratory Instrumental Reasoning CCLs (misalignment) → chain-of-thought monitoring
//             in high-stakes internal deployments.
// CAL-S mapping onto the domain score (RD-U05: 10 = the domain's best human, λ(G_SC − Δ_bm) = its median expert):
//   High = the capability of a median domain expert put in a novice's hands (OAI-PF2 Bio High: "meaningful
//     counterfactual assistance ... to 'novice' actors (anyone with a basic relevant technical background) that enables
//     them to create known biological or chemical threats"; ANT-RSP CBRN-3: "individuals or groups with basic STEM
//     backgrounds"; OAI-PF2 Cyber High: "automating the discovery and exploitation of operationally relevant
//     vulnerabilities") = λ(G_SC − Δ_bm), each world's own median expert (CAL2-S, designer decision 11; capability.ts
//     medianExpertLevel, to 0.1 L): ai2027 6.4, authors2026 8.0, slow 9.2, fast 9.2 at the CAL-T presets [S definition].
//   Critical = the domain's best human, 10 (OAI-PF2 Bio Critical: "enable an expert to develop a highly dangerous novel
//     threat vector"; ANT-RSP CBRN-4: uplift "entry-level PhD biologists to ... approximate the capabilities of a
//     world-class, state-backed bioweapons team"; OAI-PF2 Cyber Critical: "functional zero-day exploits of all severity
//     levels in many hardened real-world critical systems without human intervention"; OAI-PF2 AI Self-improvement
//     Critical: "a superhuman research-scientist agent"; ANT-RSP AI R&D-5; GDM-FSF ML R&D autonomy).
//   Misalignment signs: a belief rule gated on the scheming-capable level (safety/framework.ts ruleTriggered): no 2025
//     framework triggers misalignment safeguards on beliefs alone. The 30% line is [D] (the old red-flag line).
// Day 0 (V0, measured BIO / CYBER 0, RSCH ≈ 2, CYBER below the scheming level 5): no rule triggers; the start products
// already carry classifier safeguards, as Anthropic (ASL-3 for Claude Opus 4, 22 May 2025, precautionary) and OpenAI
// (ChatGPT agent treated as High Biological, 17 Jul 2025, precautionary) applied. Rules read MEASURED levels and the
// player's beliefs, never truth.
import type { EvalDepth, FrameworkRule, SafetyFramework } from '../../engine/v2/types';

/** CAL-S: High = a median domain expert's score, λ(G_SC − Δ_bm); Critical = the domain's best human (RD-U05).
 *  research/CAL-safety-sources.md §1. CAL2-S (decision 11): the game's High level is the world's own median expert
 *  (defaultFrameworkRules(highL), set at game start from capability.ts medianExpertLevel); FRAMEWORK_HIGH_L is the
 *  reference world's (ai2027 6.39 → 6.4), the default only where no world is at hand. */
export const FRAMEWORK_HIGH_L = 6.4;
/** The High level of a world's median-expert score, to 0.1 L (as shown in the framework panel). */
export const frameworkHighL = (medianExpertL: number) => Math.round(medianExpertL * 10) / 10;
export const FRAMEWORK_CRITICAL_L = 10;

/** The default rules with High at `highL` (the world's median expert). */
export const defaultFrameworkRules = (highL: number = FRAMEWORK_HIGH_L): readonly FrameworkRule[] => [
  { id: 'bio-high', label: 'Biological: High', trigger: { kind: 'capability', domain: 'BIO', level: highL }, holds: 'deploy', safeguards: ['classifiers'], evidence: ['suite'], src: 'OAI-PF2 Bio High (novice uplift, known threats); ANT-RSP CBRN-3 → ASL-3 deployment standard; level = median expert [CAL-S]' },
  { id: 'cyber-high', label: 'Cyber: High', trigger: { kind: 'capability', domain: 'CYBER', level: highL }, holds: 'deploy', safeguards: ['classifiers'], evidence: ['suite'], src: 'OAI-PF2 Cybersecurity High; GDM-FSF Cyber uplift CCL; level = median expert [CAL-S]' },
  { id: 'bio-critical', label: 'Biological: Critical', trigger: { kind: 'capability', domain: 'BIO', level: FRAMEWORK_CRITICAL_L }, holds: 'deploy', safeguards: ['hardened'], evidence: ['suite', 'external'], src: 'OAI-PF2 Bio Critical (expert uplift, novel threats); ANT-RSP CBRN-4; level = best human [CAL-S]' },
  { id: 'cyber-critical', label: 'Cyber: Critical', trigger: { kind: 'capability', domain: 'CYBER', level: FRAMEWORK_CRITICAL_L }, holds: 'deploy', safeguards: ['hardened'], evidence: ['suite', 'external'], src: 'OAI-PF2 Cybersecurity Critical; GDM-FSF Cyber CCL; level = best human [CAL-S]' },
  { id: 'aird-critical', label: 'AI R&D: Critical', trigger: { kind: 'capability', domain: 'RSCH', level: FRAMEWORK_CRITICAL_L }, holds: 'training', safeguards: ['control', 'review'], evidence: ['suite', 'external'], src: 'OAI-PF2 AI Self-improvement Critical ("superhuman research-scientist agent"; safeguards during development); ANT-RSP AI R&D-5; GDM-FSF ML R&D CCL; level = best human [CAL-S]' },
  { id: 'misalignment', label: 'Misalignment signs', trigger: { kind: 'belief', est: 0.3 }, holds: 'training', safeguards: ['control'], evidence: [], src: 'GDM-FSF Instrumental Reasoning Level 1 → CoT monitoring of internal deployments; OAI-PF2 Cyber High → misalignment safeguards for large-scale internal deployment; only for models measured at the scheming-capable level [CAL-S]; the 30% line on the top of the 90% range (RF-S1) [D]' },
];

/** The default framework: full capability assessment before release, no mandatory external review; High at `highL`. */
export function defaultFramework(evalDepth: EvalDepth | 'none' = 'full', externalReview = false, highL: number = FRAMEWORK_HIGH_L): SafetyFramework {
  return { evalDepth, externalReview, rules: defaultFrameworkRules(highL).map((r) => ({ ...r, trigger: { ...r.trigger }, safeguards: [...r.safeguards], evidence: [...r.evidence] })), overrides: [], holds: [] };
}

/** Edit limits [D]: a capability threshold may move at most this far from its default (L), a belief threshold this far
 *  (estimate); safeguards and evidence may be added, never removed below the default; rules are not deleted. */
export const FRAMEWORK_LEVEL_SLACK = 2;
export const FRAMEWORK_BELIEF_SLACK = 0.2;

/** What an explicit override costs, stated in its preview and applied [D]: staff (safety-team morale, and one red
 *  flag: the whistleblower hazard, security.ts). The government and reputation costs went with the relation stocks
 *  (W1c); W5 adds the government's. */
export const OVERRIDE_COST = { moraleSafety: 5 } as const;

export const SAFEGUARD_NEED_LABEL: Record<FrameworkRule['safeguards'][number], string> = {
  classifiers: 'classifier misuse safeguards', hardened: 'hardened misuse safeguards',
  control: 'control protocol on internal AI work', review: 'human review on internal AI work',
};
export const EVIDENCE_NEED_LABEL: Record<FrameworkRule['evidence'][number], string> = {
  suite: 'an eval suite of this version', external: 'an external evaluation of this version',
};
