// Teams and roles (STRUCTURE §4.1, research/19 Part 1; BUILD-PLAN R3). Owner: WS1.
// Three roles in fixed-size teams. Capabilities research engineers carry the CES labour input h; scientists' quality
// carries research taste τ_h; engineers carry build capacity (a readout until R5). [D] unless marked [Design].
import type { BaselineId, Column, TeamDept, TeamKey, TeamQuality, TeamRole } from '../../engine/v2/types';

/** Fixed team sizes (STRUCTURE §4.1 "big, fixed sizes"). */
export const TEAM_SIZE: Record<TeamRole, number> = { eng: 150, re: 100, sci: 40 };

/** Reference split of capabilities staff (research/19 §1.1). h = RE_cap / (REF_ROLE_SHARE.re · H_ref). */
export const REF_ROLE_SHARE: Record<TeamRole, number> = { eng: 0.3, re: 0.55, sci: 0.15 };

/** Reference split of safety staff: 90 research engineers + 50 scientists of 140 (research/19 §1.1) [Design]. */
export const SAF_ROLE_SHARE: Record<'re' | 'sci', number> = { re: 90 / 140, sci: 50 / 140 };

/** Quality tiers: output and cost scale together; Elite ≈ 2× Solid cost (research/19 §1.2) [Design]. Strong is the
 *  reference (output 1, cost 1), so a lab of Strong teams reproduces today's calibration. */
export const QUALITY: Record<TeamQuality, { out: number; cost: number; label: string }> = {
  solid: { out: 0.8, cost: 0.8, label: 'Solid' },
  strong: { out: 1, cost: 1, label: 'Strong' },
  elite: { out: 1.25, cost: 1.6, label: 'Elite' },
};

/** Cost $M per person-year at Strong quality (research/19 §1.2; weighted means 0.80 cap, 0.70 safety). Engineers are
 *  one shared pool on the capabilities budget. */
export const TEAM_COST_M: Record<TeamDept, Record<TeamRole, number>> = {
  cap: { eng: 0.7, re: 0.8, sci: 1.0 },
  saf: { eng: 0.7, re: 0.65, sci: 0.8 },
};

/** Weekly hires per department lane, before talent pull and morale (cap ≈ +60/month, R11 #12). Safety 8/wk since R8
 *  (was 3): research lines need whole safety science teams and tool upkeep needs research engineers, where before R8 the
 *  start staff could fund several agendas at once; at 3/wk a safety-minded lab needed years to staff them [D, R8]. */
export const HIRING_BASE: Record<TeamDept, number> = { cap: 15, saf: 8 };
/** Attrition 12%/yr × (1.5 − morale/100), floor 0.2 (V2-SPEC §3.4.1). */
export const ATTRITION_BASE = 0.12;

/** Star hire (§3.4.1): +0.05 τ_h each, τ_h capped at 1.5; $0.3B. */
export const STAR_HIRE = { dTaste: 0.05, maxTaste: 1.5, cost: 0.3 };
/** RD-B18 (B34): the one star-taste factor, 1 + dTaste · stars up to maxTaste. It multiplies every capabilities science
 *  team's human taste (research projects; departments/workfit.ts starTaste) and is the bench the Star hire gate reads. */
export const starTasteOf = (stars = 0) => Math.min(STAR_HIRE.maxTaste, 1 + STAR_HIRE.dTaste * stars);

/** Moving a research-engineering team from safety to capabilities costs safety morale (STRUCTURE §4.1) [Design]. */
export const MOVE_SAFETY_MORALE = -5;

/** Candidate list: one new team offer a week (company stream), each on the list for 4 weeks, at most 4 [Design]. */
export const CANDIDATES = { max: 4, days: 28 };
export const CANDIDATE_ROLE_W: { item: TeamRole; weight: number }[] = [{ item: 'eng', weight: 0.25 }, { item: 're', weight: 0.35 }, { item: 'sci', weight: 0.4 }];
export const CANDIDATE_QUALITY_W: { item: TeamQuality; weight: number }[] = [{ item: 'solid', weight: 0.3 }, { item: 'strong', weight: 0.45 }, { item: 'elite', weight: 0.25 }];
/** Share of research-engineering candidates offered to safety. */
export const CANDIDATE_RE_SAF = 0.25;

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
