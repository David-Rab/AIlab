// Teams and roles (STRUCTURE §4.1, research/19 Part 1; BUILD-PLAN R3). Owner: WS1.
// Three roles in fixed-size teams. Capabilities research engineers carry the CES labour input h; scientists carry
// research taste τ_h; engineers carry build capacity (a readout until R5). [D] unless marked [Design].
import type { BaselineId, Column, TeamDept, TeamKey, TeamRole } from '../../engine/v2/types';

/** Fixed team sizes (STRUCTURE §4.1 "big, fixed sizes"). */
export const TEAM_SIZE: Record<TeamRole, number> = { eng: 150, re: 100, sci: 40 };

/** Reference split of capabilities staff (research/19 §1.1). h = RE_cap / (REF_ROLE_SHARE.re · H_ref). */
export const REF_ROLE_SHARE: Record<TeamRole, number> = { eng: 0.3, re: 0.55, sci: 0.15 };

/** Reference split of safety staff: 90 research engineers + 50 scientists of 140 (research/19 §1.1) [Design]. */
export const SAF_ROLE_SHARE: Record<'re' | 'sci', number> = { re: 90 / 140, sci: 50 / 140 };

// Pay, hiring speed and leavers are the labour market's (data/v2/labourMarket.ts W0, F0_PER_MONTH, SEPARATION;
// departments/market.ts, L12): the fixed TEAM_COST_M, HIRING_BASE and ATTRITION_BASE are retired.

/** Moving a research-engineering team from safety to capabilities costs safety morale (STRUCTURE §4.1) [Design]. */
export const MOVE_SAFETY_MORALE = -5;

/** The six tree columns: three capabilities, three safety (TECH-TREE §2). */
export const COLUMNS: Column[] = ['pretraining', 'posttraining', 'systems', 'alignment', 'interp', 'evals'];
export const COLUMN_DEPT: Record<Column, TeamDept> = { pretraining: 'cap', posttraining: 'cap', systems: 'cap', alignment: 'saf', interp: 'saf', evals: 'saf' };
export const COLUMN_LABEL: Record<Column, string> = { pretraining: 'Pretraining', posttraining: 'Post-training', systems: 'Systems', alignment: 'Alignment', interp: 'Interpretability', evals: 'Evals & control' };

export const TEAM_KEYS: TeamKey[] = ['eng', 're.cap', 'sci.cap', 're.saf', 'sci.saf'];

/** Start teams (STRUCTURE §4.1 "Frontier leader": 4 · 11 + 1 · 8 + 2). Reality scales the 2,450 capabilities staff. */
export const START_TEAMS: Record<BaselineId, Record<TeamKey, number>> = {
  classic: { eng: 4, 're.cap': 11, 'sci.cap': 8, 're.saf': 1, 'sci.saf': 2 },
  reality: { eng: 5, 're.cap': 13, 'sci.cap': 9, 're.saf': 1, 'sci.saf': 2 },
};
/** Start science specialties, in order (follow the leader's analogues) [Design]. */
export const START_SPECIALTIES: Record<TeamDept, Column[]> = {
  cap: ['pretraining', 'posttraining', 'systems', 'pretraining', 'posttraining', 'systems', 'posttraining', 'pretraining', 'systems'],
  saf: ['alignment', 'interp', 'evals'],
};
