// W4: the public (design/world/OUTSIDE-WORLD.md §5). Two numbers: concern about AI (world level, 0..100) and approval of
// the player's lab (-100..100). Concern follows the frontier whoever holds it (R2); approval swings with what the lab
// itself does, scaled by the attention on it. Reads only the shared inputs (observe.ts), never private flags (R1).
import { unemploymentChange12m } from '../worldfx/readouts';
import { PLAYER_ID } from '../models/labs';
import { attention, incidentHeat, publicMilestones } from './observe';
import type { EngineSystem, GameStateV2, SystemCtx } from '../types';

/** The public's constants. Registered in balance/params/worldfx.ts. */
export const PUBLIC = {
  /** Concern before any public milestone (share more concerned than excited, %): Pew Jun 2025 50 (SOURCES §3.1) [sourced]. */
  base: 50,
  /** Concern added per public milestone from index milestoneFrom up (any lab; sticky) [D]. */
  milestoneStep: 6,
  /** The first milestone index that moves concern: 2, the online learner. Milestone 1 (reliable agent) goes public in 2026 in fast
   *  runs, and real Pew stayed flat near 50 through then [D]. */
  milestoneFrom: 2,
  /** Concern added per point of 12-month US unemployment rise [D]. */
  jobsPerPt: 5,
  /** Concern added per unit of public incident heat (observe.ts incidentHeat) [D]. */
  incidentK: 2,
  /** Half-life of concern's drift to its target, days (about 3 months) [D]. */
  concernHalfLifeDays: 90,
  /** Approval's baseline falls this much per point of concern above 50 [D]. */
  concernToApproval: 0.4,
  /** Half-life of approval's drift to its baseline, days (about 6 months) [D]. */
  approvalHalfLifeDays: 180,
  /** Local data-centre opposition rises this much per point of concern above 50 (45 at concern 50, the calibrated case) [D]. */
  concernToNimby: 0.5,
  /** The community package lowers local opposition by this much [D]. */
  communityNimbyCut: 10,
  /** Brand factor on demand: 1 + this × clamp(approval/50, -1, 1) (spec §3.11.1) [D]. */
  brandSwing: 0.1,
  /** Hiring pull gains approval / this (points of talent pull) [D]. */
  pullPerApproval: 5,
  /** Protest headline above this concern, at most once per protestGapDays [D]. */
  protestConcern: 70,
  protestGapDays: 180,
  /** Approval pushes (before × attention) [D]: a disclosed incident −2 × severity, a leaked one −4 × severity, an exposed
   *  cover-up, a broken pledge, and the choice to disclose in the decision events. */
  disclosedPerSeverity: -2,
  leakedPerSeverity: -4,
  coverupExposed: -8,
  pledgeBroken: -6,
  discloseChoice: 3,
} as const;

const halfLifeK = (days: number) => 1 - Math.pow(0.5, 1 / days);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Public milestones of index PUBLIC.milestoneFrom and up (any lab). Calibration intent: history to Nov 2026 holds concern near 50 (Pew's
 *  plateau 50-52 through 2025, so the quiet-world history shows no step); the 2022 to 2023 Pew step (+14 in under 8
 *  months, the first mass chatbot) bounds how big a single step can be (milestoneStep 6 is well inside it). */
export function publicMilestoneCount(s: GameStateV2): number {
  let n = 0;
  for (const i of Object.keys(publicMilestones(s))) if (Number(i) >= PUBLIC.milestoneFrom) n++;
  return n;
}

/** Where concern is heading: base + a step per public milestone + jobs + recent public incidents, 0..100. */
export function concernTarget(s: GameStateV2): number {
  const t = PUBLIC.base + PUBLIC.milestoneStep * publicMilestoneCount(s) + PUBLIC.jobsPerPt * Math.max(0, unemploymentChange12m(s)) + PUBLIC.incidentK * incidentHeat(s);
  return clamp(t, 0, 100);
}

/** What an approval push of `base` is worth to the player today: base x attention on the lab (one number for the push and
 *  for any preview of it). */
export const approvalScaled = (s: GameStateV2, base: number): number => base * attention(s, PLAYER_ID);

/** The one way approval is pushed by an event: base x attention, logged as a cause. Returns the amount applied. */
export function approvalPush(s: GameStateV2, ctx: SystemCtx, base: number, why: string): number {
  return ctx.bump('public.approval', approvalScaled(s, base), why);
}

/** Daily (120): concern drifts to its target, approval to its baseline; a protest headline above the threshold. */
export function stepPublic(s: GameStateV2, ctx?: SystemCtx): void {
  const p = s.public;
  p.concern = clamp(p.concern + (concernTarget(s) - p.concern) * halfLifeK(PUBLIC.concernHalfLifeDays), 0, 100);
  const base = -PUBLIC.concernToApproval * (p.concern - 50);
  p.approval = clamp(p.approval + (base - p.approval) * halfLifeK(PUBLIC.approvalHalfLifeDays), -100, 100);
  if (ctx && p.concern > PUBLIC.protestConcern && (p.lastProtestDay === undefined || ctx.day - p.lastProtestDay >= PUBLIC.protestGapDays)) {
    p.lastProtestDay = ctx.day;
    ctx.log('public', 'Protesters march against AI in several cities.', 2);
    ctx.headline('protest', 'Protests against AI grow across the country.');
  }
}

export const publicDailySystem: EngineSystem = {
  id: 'publicDaily', owner: 'WS4', cadence: 'daily', order: 121, system: 'relations',
  run(s, ctx) { stepPublic(s, ctx); },
};
