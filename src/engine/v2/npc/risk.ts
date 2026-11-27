// N2b-2 (design/npc/NPC-LABS.md §4 race pressure and m, §7 incidents): an NPC lab's race pressure, misalignment m and
// incident hazard. Pure functions of the state; the daily system (actors/rivals.ts labDaily) stores their results on the
// lab's npc state. True positions for now (N9 switches actors to public values).
//   p = clamp(1 − months to the nearest competitor, ahead or behind, ÷ RACE_MONTHS, 0, 1)
//   m = M_world(G_internal) × (1 − 0.5 × safety emphasis × (1 − race response × p))
//   model incidents a year = H0_PER_YEAR × (m ÷ M_world(G(V0))) × (1 − 0.8 × safety emphasis)
import { gV0, levelOfG } from '../models/capability';
import { activeRivals, bestG } from '../models/labs';
import { clockOfGAt, refSlopePerDay } from './lab';
import { mWorld } from './misalignment';
import { decimalYear } from '../core/time';
import type { GameStateV2, LabId, RivalLab } from '../types';

// ───────────────────────────── parameters (N2b-2; new, listed in design/npc/N2b2-RESULT.md) ─────────────────────────────

/** Months to the nearest competitor at and beyond which race pressure is 0 [D, NPC-LABS §4]. */
export const RACE_MONTHS = 3;
/** Share of m that a full safety emphasis removes at no race pressure [D, NPC-LABS §4]. */
export const SAFETY_CUTS_M = 0.5;
/** Model incidents a year of a lab with the reference m and no safety emphasis: today's NPC start rate [D, MISALIGNMENT.md §5]. */
export const H0_PER_YEAR = 0.05;
/** Share of the model-incident rate a full safety emphasis removes [D, NPC-LABS §7]. */
export const SAFETY_CUTS_INCIDENTS = 0.8;
/** Severity of a model incident before rounding: 1 + SEV_SPAN × (display level ÷ SEV_LEVEL_TOP) [D: today's rows are
 *  floor + span × capability; one generic row]. */
export const SEV_SPAN = 3;
export const SEV_LEVEL_TOP = 15;

/** Months between two capabilities G on the reference clock (a lab's lead or lag in time). Beyond the run's end (Infinity
 *  on the clock), the G gap at today's slope. */
export function monthsApart(s: GameStateV2, Ga: number, Gb: number): number {
  const a = clockOfGAt(s, Ga), b = clockOfGAt(s, Gb);
  if (Number.isFinite(a) && Number.isFinite(b)) return Math.abs(a - b) * 12;
  const perYear = refSlopePerDay(s, decimalYear(s)) * 365.25;
  return (Math.abs(Ga - Gb) / perYear) * 12;
}

/** Race pressure of lab `id` (true internal positions; every other active lab and the player count as competitors). */
export function npcRacePressure(s: GameStateV2, id: LabId): number {
  const G = bestG(s, id);
  if (!Number.isFinite(G)) return 0;
  let nearest = Infinity;
  const others: LabId[] = ['player', ...activeRivals(s).map((r) => r.core.id)];
  if (s.china.lab.core.status === 'active') others.push(s.china.lab.core.id);
  for (const o of others) {
    if (o === id) continue;
    const g = bestG(s, o);
    if (Number.isFinite(g)) nearest = Math.min(nearest, monthsApart(s, G, g));
  }
  return Math.max(0, Math.min(1, 1 - nearest / RACE_MONTHS));
}

/** m of a lab at capability G (NPC-LABS §4). `safety` and `raceResponse` are the lab's posture (kind) values. */
export function npcM(s: Pick<GameStateV2, 'hidden'>, G: number, safety: number, raceResponse: number, p: number): number {
  return Math.max(0, Math.min(1, mWorld(s, G) * (1 - SAFETY_CUTS_M * safety * (1 - raceResponse * p))));
}

/** The lab's model-incident rate a year (NPC-LABS §7). */
export function npcIncidentRate(s: Pick<GameStateV2, 'hidden'>, m: number, safety: number): number {
  return H0_PER_YEAR * (m / Math.max(1e-6, mWorld(s, gV0(s.hidden.timeline)))) * (1 - SAFETY_CUTS_INCIDENTS * safety);
}

/** The generic model-incident row: hazard per day and the severity before rounding. */
export function npcModelRow(s: Pick<GameStateV2, 'hidden'>, G: number, m: number, safety: number) {
  const lv = levelOfG(s.hidden.timeline, G);
  return { source: 'SCHEME' as const, apparent: 'unexplained' as const, h: npcIncidentRate(s, m, safety) / 365.25, sev: 1 + SEV_SPAN * Math.max(0, Math.min(1, lv / SEV_LEVEL_TOP)), disposition: 1, capability: 1, opportunity: 1, block: 0 };
}

/** m stored on the lab (0 until its first day). */
export const npcMisOf = (r: Pick<RivalLab, 'npc'>) => r.npc?.m ?? 0;
