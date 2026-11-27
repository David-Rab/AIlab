// Hidden safety postures per NPC kind (V2-SPEC §2.3 step 9, §3.10.3; research/17 §1.6.4). Owner: WS4. A lab's posture is its
// kind's row with the safety investment and race relaxation taken from the kind's safety emphasis and race response
// (npc/lab.ts postureOfKind); the rest (eval rigor, outside access, disclosure, framework bindingness) are read by incidents
// (visibility), the Safety Index and joint evals.
import type { NpcKindId } from './npcLabs';
import type { SafetyPosture } from '../../engine/v2/types';

export const KIND_POSTURES: Record<Exclude<NpcKindId, 'china'>, SafetyPosture> = {
  safety: { safetyInvestment: 0.65, evalRigor: 0.7, externalAccess: 0.55, disclosureRate: 0.85, raceRelaxation: 0.55, bindingness: 0.6 },
  bigtech: { safetyInvestment: 0.5, evalRigor: 0.6, externalAccess: 0.5, disclosureRate: 0.65, raceRelaxation: 0.6, bindingness: 0.3 },
  openweights: { safetyInvestment: 0.3, evalRigor: 0.45, externalAccess: 0.5, disclosureRate: 0.4, raceRelaxation: 0.7, bindingness: 0.3 },
  racer: { safetyInvestment: 0.1, evalRigor: 0.2, externalAccess: 0.1, disclosureRate: 0.35, raceRelaxation: 0.9, bindingness: 0.1 },
  upstart: { safetyInvestment: 0.5, evalRigor: 0.4, externalAccess: 0.3, disclosureRate: 0.3, raceRelaxation: 0.5, bindingness: 0.3 },
  leader: { safetyInvestment: 0.35, evalRigor: 0.5, externalAccess: 0.45, disclosureRate: 0.5, raceRelaxation: 0.8, bindingness: 0.2 },
};

/** China's lab: safetyInvestment = 0.10 + 0.4·safetyConcern/100 (recomputed by WS4); state directive replaces raceRelaxation. */
export const CHINA_POSTURE_BASE: SafetyPosture = {
  safetyInvestment: 0.1, evalRigor: 0.1, externalAccess: 0.05, disclosureRate: 0.25, raceRelaxation: 0, bindingness: 0.1,
};

/** Framework clause type shown on rival intel cards (research/17 §1.6.4 calibration table). */
export const KIND_CLAUSE: Record<Exclude<NpcKindId, 'china'>, 'conditional' | 'allAdopt' | 'unconditional' | 'override' | 'state'> = {
  safety: 'conditional', bigtech: 'allAdopt', openweights: 'unconditional', racer: 'override', upstart: 'conditional', leader: 'conditional',
};
