// Interest blocs (V2-SPEC §3.10.2; research/08 §1.16 clout/approval, Part 3 support/oppose codes). Owner: WS4.
//
// Agenda weights −3..+3 per policy id, converted from research/08 Part 3 codes: "++" = +3, "+" = +1, "−" = −1,
// "−−" = −3 [conversion D]. Policy ids are the spec's §3.10.2 bloc agenda ids plus the R08 P-numbers they map to.
import type { BlocId } from '../../engine/v2/types';

/** Policy agenda ids (V2-SPEC §3.10.2) → research/08 P-number. */
export const POLICIES = {
  licensing: 'P6', // federal frontier licensing
  preemption: 'P1', // federal preemption of state AI laws
  exportControls: 'P11', // chip export-control tightening (China)
  dcMoratorium: 'P24', // data-centre moratorium / ratepayer protection
  ubi: 'P27', // layoff disclosure, worker transition, UBI pilots
  childSafety: 'P22', // companion-chatbot limits for minors
  copyright: 'P23', // training-data licensing
  avBan: 'P31', // usage red lines in law (autonomous weapons, surveillance; AV/human-in-loop bans)
  evals: 'P3', // mandatory pre-deployment government evals
  weightSecurity: 'P15', // model-weight security standards
  pause: 'P28', // superintelligence prohibition / pause
  treaty: 'P29', // international red lines / verification
  openWeightLimits: 'P30',
  liability: 'P10',
} as const;
export type PolicyId = keyof typeof POLICIES;

export interface BlocDef { id: BlocId; name: string; clout: number; cloutNov26: number; approval: number; agenda: Partial<Record<PolicyId, number>> }

export const BLOCS: BlocDef[] = [
  { id: 'safety', name: 'Safety Advocates', clout: 30, cloutNov26: 40, approval: 10,
    agenda: { preemption: -3, evals: 3, licensing: 1, exportControls: 1, weightSecurity: 3, treaty: 3, liability: 1, openWeightLimits: 1, avBan: 1, pause: 1 } },
  { id: 'pause', name: 'Pause / Stop', clout: 5, cloutNov26: 10, approval: -60,
    agenda: { pause: 3, licensing: 1, treaty: 1, dcMoratorium: 1 } },
  { id: 'accel', name: 'Accelerationists', clout: 70, cloutNov26: 58, approval: 30,
    agenda: { preemption: 3, evals: -3, licensing: -3, exportControls: -1, liability: -3, childSafety: -1, copyright: -3, dcMoratorium: -3, ubi: -1, pause: -3, treaty: -1, openWeightLimits: -3, weightSecurity: -1 } },
  { id: 'bigtech', name: 'Big Tech & Hyperscalers', clout: 75, cloutNov26: 70, approval: 10,
    agenda: { preemption: 3, evals: -1, licensing: -3, liability: -3, childSafety: -1, copyright: -3, dcMoratorium: -3, ubi: -1, pause: -3 } },
  { id: 'chip', name: 'Chip & Export Lobby', clout: 55, cloutNov26: 60, approval: 20,
    agenda: { preemption: 1, exportControls: -3 } },
  { id: 'hawks', name: 'China Hawks', clout: 60, cloutNov26: 60, approval: 10,
    agenda: { exportControls: 3, evals: 1, weightSecurity: 3, pause: -3, treaty: -1, openWeightLimits: 1 } },
  { id: 'defense', name: 'Defense-Industrial', clout: 45, cloutNov26: 55, approval: 0,
    agenda: { evals: 1, weightSecurity: 1, pause: -3, dcMoratorium: -1, avBan: -3 } },
  { id: 'populist', name: 'Populist Right & Faith', clout: 35, cloutNov26: 45, approval: -20,
    agenda: { preemption: -1, evals: 1, licensing: 1, liability: 3, childSafety: 3, ubi: 1, avBan: 1 } },
  { id: 'progressive', name: 'Progressive Critics', clout: 30, cloutNov26: 45, approval: -30,
    agenda: { preemption: -3, liability: 3, childSafety: 1, dcMoratorium: 3, ubi: 3, avBan: 1 } },
  { id: 'labor', name: 'Organized Labor', clout: 40, cloutNov26: 48, approval: -20,
    agenda: { preemption: -1, copyright: 1, ubi: 3, avBan: 1 } },
  { id: 'civlib', name: 'Civil Liberties', clout: 25, cloutNov26: 28, approval: 0,
    agenda: { licensing: -1, liability: -1, childSafety: -1, openWeightLimits: -1, avBan: 3 } },
  { id: 'parents', name: 'Child Safety & Parents', clout: 45, cloutNov26: 55, approval: -10,
    agenda: { preemption: -3, liability: 3, childSafety: 3 } },
  { id: 'creatives', name: 'Creatives & Copyright', clout: 40, cloutNov26: 42, approval: -30,
    agenda: { preemption: -1, liability: 1, copyright: 3 } },
  { id: 'ratepayers', name: 'Ratepayers / Anti-DC', clout: 20, cloutNov26: 50, approval: -10,
    agenda: { dcMoratorium: 3 } },
  { id: 'measurers', name: 'Science & Evaluation', clout: 35, cloutNov26: 35, approval: 10,
    agenda: { evals: 3, treaty: 1, copyright: -1, openWeightLimits: -1, weightSecurity: -1 } },
];

export const BLOC_IDS: BlocId[] = BLOCS.map((b) => b.id);
export const BLOC_BY_ID = Object.fromEntries(BLOCS.map((b) => [b.id, b])) as Record<BlocId, BlocDef>;
