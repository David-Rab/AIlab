// Hidden safety postures per lab archetype (V2-SPEC §2.3 step 9, §3.10.3; research/17 §1.6.4). Owner: WS4.
// Realistic mode applies ±0.15 noise (world/hidden.ts). rlIntensity/prefIntensity are [D] (not in R17's table).
import type { SafetyPosture } from '../../engine/v2/types';

export const ARCHETYPE_POSTURES: Record<string, SafetyPosture> = {
  safety: { safetyInvestment: 0.65, evalRigor: 0.7, externalAccess: 0.55, disclosureRate: 0.85, raceRelaxation: 0.55, bindingness: 0.6, rhetoricGap: 0.1, rlIntensity: 0.5, prefIntensity: 0.4 },
  scale: { safetyInvestment: 0.55, evalRigor: 0.75, externalAccess: 0.7, disclosureRate: 0.65, raceRelaxation: 0.5, bindingness: 0.4, rhetoricGap: 0.25, rlIntensity: 0.7, prefIntensity: 0.6 },
  bigtech: { safetyInvestment: 0.5, evalRigor: 0.6, externalAccess: 0.5, disclosureRate: 0.65, raceRelaxation: 0.6, bindingness: 0.3, rhetoricGap: 0.25, rlIntensity: 0.6, prefIntensity: 0.6 },
  openweights: { safetyInvestment: 0.3, evalRigor: 0.45, externalAccess: 0.5, disclosureRate: 0.4, raceRelaxation: 0.7, bindingness: 0.3, rhetoricGap: 0.2, rlIntensity: 0.6, prefIntensity: 0.5 },
  maverick: { safetyInvestment: 0.1, evalRigor: 0.2, externalAccess: 0.1, disclosureRate: 0.35, raceRelaxation: 0.9, bindingness: 0.1, rhetoricGap: 0.35, rlIntensity: 0.8, prefIntensity: 0.8 },
  upstart: { safetyInvestment: 0.5, evalRigor: 0.4, externalAccess: 0.3, disclosureRate: 0.3, raceRelaxation: 0.5, bindingness: 0.3, rhetoricGap: 0.2, rlIntensity: 0.6, prefIntensity: 0.5 },
  // AI 2027 leader lab (setup.leaderLab, BUILD-PLAN R2): a racer. Its base bindingness is capped at
  // LEADER_MAX_BINDINGNESS after noise, so rivalSpeedMult (which slows a leader above 0.5) never slows the anchor.
  leader: { safetyInvestment: 0.35, evalRigor: 0.5, externalAccess: 0.45, disclosureRate: 0.5, raceRelaxation: 0.8, bindingness: 0.2, rhetoricGap: 0.3, rlIntensity: 0.75, prefIntensity: 0.7 },
};
/** Cap on the leader lab's base bindingness (after Realistic noise). */
export const LEADER_MAX_BINDINGNESS = 0.3;

/** DeepCent: safetyInvestment = 0.10 + 0.4·safetyConcern/100 (recomputed by WS4); state directive replaces raceRelaxation. */
export const CHINA_POSTURE_BASE: SafetyPosture = {
  safetyInvestment: 0.1, evalRigor: 0.1, externalAccess: 0.05, disclosureRate: 0.25, raceRelaxation: 0, bindingness: 0.1, rhetoricGap: 0.2, rlIntensity: 0.7, prefIntensity: 0.5,
};

/** Framework clause type shown on rival intel cards (research/17 §1.6.4 calibration table). */
export const ARCHETYPE_CLAUSE: Record<string, 'conditional' | 'allAdopt' | 'unconditional' | 'override' | 'state'> = {
  safety: 'conditional', scale: 'conditional', bigtech: 'allAdopt', openweights: 'unconditional', maverick: 'override', upstart: 'conditional', leader: 'conditional',
};
