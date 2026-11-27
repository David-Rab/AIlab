// Teams and roles (STRUCTURE §4.1, research/19 Part 1; BUILD-PLAN R3). Owner: WS1.
// Three roles in fixed-size teams. Capabilities research engineers carry the CES labour input h; scientists carry
// research taste τ_h; engineers carry build capacity (a readout until R5). [D] unless marked [Design].
import type { Column, TeamDept, TeamKey, TeamRole } from '../../engine/v2/types';

/** Fixed team sizes (STRUCTURE §4.1 "big, fixed sizes"; L15: 100 / 50 / 20, was 150 / 100 / 40, so the sourced start
 *  fits whole teams) [Design: LABOUR-SOURCES.md decision 3]. The same sizes in safety. Labour is measured in the
 *  reference units of data/v2/workTypes.ts (ENG_UNIT_HEADS, RE_UNIT_HEADS) and tree.ts CAPACITY_UNIT, which are people,
 *  not teams. */
export const TEAM_SIZE: Record<TeamRole, number> = { eng: 100, re: 50, sci: 20 };

/** Reference split of capabilities staff (research/19 §1.1). h = RE_cap / (REF_ROLE_SHARE.re · H_ref). */
export const REF_ROLE_SHARE: Record<TeamRole, number> = { eng: 0.3, re: 0.55, sci: 0.15 };

/** Reference split of safety staff: 90 research engineers + 50 scientists of 140 (research/19 §1.1) [Design]. */
export const SAF_ROLE_SHARE: Record<'re' | 'sci', number> = { re: 90 / 140, sci: 50 / 140 };

// Pay and hiring speed are the labour market's (data/v2/labourMarket.ts W0, F0_PER_MONTH;
// departments/market.ts, L12): the fixed TEAM_COST_M, HIRING_BASE and ATTRITION_BASE are retired.

/** Moving a research-engineering team from safety to capabilities costs safety morale (STRUCTURE §4.1) [Design]. */
export const MOVE_SAFETY_MORALE = -5;

/** The six tree columns: three capabilities, three safety (TECH-TREE §2). */
export const COLUMNS: Column[] = ['pretraining', 'posttraining', 'systems', 'alignment', 'interp', 'evals'];
export const COLUMN_DEPT: Record<Column, TeamDept> = { pretraining: 'cap', posttraining: 'cap', systems: 'cap', alignment: 'saf', interp: 'saf', evals: 'saf' };
export const COLUMN_LABEL: Record<Column, string> = { pretraining: 'Pretraining', posttraining: 'Post-training', systems: 'Systems', alignment: 'Alignment', interp: 'Interpretability', evals: 'Evals & control' };

export const TEAM_KEYS: TeamKey[] = ['eng', 're.cap', 'sci.cap', 're.saf', 'sci.saf'];

/** Start science specialties, in order (follow the leader's analogues) [Design]. */
export const START_SPECIALTIES: Record<TeamDept, Column[]> = {
  cap: ['pretraining', 'posttraining', 'systems', 'pretraining', 'posttraining', 'systems', 'posttraining', 'pretraining', 'systems'],
  saf: ['alignment', 'interp', 'evals'],
};
