// Laws in force: ONE dated table (design/world/OUTSIDE-WORLD.md §6; design/world/SOURCES.md §4–§5). Real laws keep
// their real dates; a row applies from its date on. Federal licensing and preemption are not here: the US government
// (W5) adds what it passes through this table.
import { dayOfDate } from '../../engine/v2/core/time';
import type { ChipMarket, GameStateV2 } from '../../engine/v2/types';

export type LawId = 'sb53' | 'raise' | 'euGpai';

export interface LawRow { id: LawId; from: string; name: string; text: string }

/** Incident-reporting and model laws (SOURCES.md §5). */
export const LAWS: LawRow[] = [
  // EU AI Act GPAI obligations apply from 2 Aug 2025 (Art. 113(b)); the GPAI Code of Practice is the way to comply.
  { id: 'euGpai', from: '2025-08-02', name: 'EU AI Act (general-purpose AI)', text: 'EU AI Act obligations for general-purpose AI models apply.' },
  // California SB 53, signed 29 Sep 2025, operative 1 Jan 2026: frontier frameworks, 15-day critical-incident reports.
  { id: 'sb53', from: '2026-01-01', name: 'California SB 53', text: 'California SB 53 takes effect: frontier frameworks and 15-day incident reports.' },
  // New York RAISE Act, signed 19 Dec 2025; effective 1 Jan 2027 per the chapter amendment ([unverified] in SOURCES.md
  // §5; the date the game already used): 72-hour incident reports.
  { id: 'raise', from: '2027-01-01', name: 'New York RAISE Act', text: 'New York RAISE Act takes effect: 72-hour incident reports.' },
];

/** US chip export policy toward China (SOURCES.md §4): strict denial since Oct 2022; from 13 Jan 2026 (BIS announcement
 *  of the H200 rule, FR 15 Jan 2026) H200-class chips go case-by-case. The frontier chips (Blackwell and later) stay
 *  barred: case-by-case covers only the older class. */
export const EXPORT_STEPS: { from: string; policy: ChipMarket['exportPolicy'] }[] = [
  { from: '2022-10-07', policy: 'strict' },
  { from: '2026-01-13', policy: 'caseByCase' },
];

export interface LawsInForce {
  sb53: boolean;
  raise: boolean;
  euGpai: boolean;
  exportPolicy: ChipMarket['exportPolicy'];
}

type Clock = { time: { day: number; startDate: string } };

const inForce = (s: Clock, from: string, day = s.time.day) => day >= dayOfDate(s.time.startDate, from);

/** The laws in force on `day` (default: today). */
export function lawsInForce(s: Clock | GameStateV2, day = s.time.day): LawsInForce {
  let exportPolicy: ChipMarket['exportPolicy'] = EXPORT_STEPS[0].policy;
  for (const x of EXPORT_STEPS) if (inForce(s, x.from, day)) exportPolicy = x.policy;
  const on = (id: LawId) => inForce(s, LAWS.find((l) => l.id === id)!.from, day);
  return { sb53: on('sb53'), raise: on('raise'), euGpai: on('euGpai'), exportPolicy };
}

/** Incident-reporting law in force (SB 53 or RAISE). */
export const reportingLaw = (s: Clock | GameStateV2) => {
  const l = lawsInForce(s);
  return l.sb53 || l.raise;
};
