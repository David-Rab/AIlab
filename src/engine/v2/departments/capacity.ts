// Team capacity: the one definition of a team's standard units of work (RD-A01).
import { CAPACITY_UNIT, SPECIALTY_BONUS } from '../../../data/v2/tree';
import { QUALITY, TEAM_SIZE } from '../../../data/v2/teams';
import type { Team } from '../types';

/** A science team's capacity on a project column: heads ÷ CAPACITY_UNIT (40) × quality × SPECIALTY_BONUS (1.5) in its
 *  specialty. Capability projects, safety line projects and AG17's harness all read this. */
export const teamCapacity = (t: Pick<Team, 'heads' | 'quality' | 'specialty'>, column: string) =>
  (t.heads / CAPACITY_UNIT) * QUALITY[t.quality].out * (t.specialty === column ? SPECIALTY_BONUS : 1);

/** A research-engineer team's team-equivalents: heads ÷ TEAM_SIZE.re (100) × quality. */
export const reCapacity = (t: Pick<Team, 'heads' | 'quality'>) => (t.heads / TEAM_SIZE.re) * QUALITY[t.quality].out;
