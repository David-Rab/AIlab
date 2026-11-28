// Laws in force: ONE table (design/world/OUTSIDE-WORLD.md §6.3; design/world/SOURCES.md §4–§6). Real laws keep their real
// dates (LAWS, EXPORT_STEPS); a row applies from its date on. The US government (world/usgov.ts) passes the conditional
// rows (COND_LAWS): each has an on rule and an off rule (hysteresis), evaluated monthly; usgov.laws holds the day each
// went into force. The effect sites read lawsInForce only.
import { dayOfDate } from '../../engine/v2/core/time';
import type { ChipMarket, CondLawId, GameStateV2, UsGovState } from '../../engine/v2/types';

export type LawId = 'sb53' | 'raise' | 'euGpai' | 'sb243';

export interface LawRow { id: LawId; from: string; name: string; text: string }

/** Dated laws: incident reporting and model laws (SOURCES.md §5), the companion-chatbot law (§6). */
export const LAWS: LawRow[] = [
  // EU AI Act GPAI obligations apply from 2 Aug 2025 (Art. 113(b)); the GPAI Code of Practice is the way to comply.
  { id: 'euGpai', from: '2025-08-02', name: 'EU AI Act (general-purpose AI)', text: 'EU AI Act obligations for general-purpose AI models apply.' },
  // California SB 53, signed 29 Sep 2025, operative 1 Jan 2026: frontier frameworks, 15-day critical-incident reports.
  { id: 'sb53', from: '2026-01-01', name: 'California SB 53', text: 'California SB 53 takes effect: frontier frameworks and 15-day incident reports.' },
  // California SB 243, approved 13 Oct 2025, effective 1 Jan 2026: companion chatbots must disclose they are AI, run
  // crisis protocols and keep sexual content from known minors. A restriction, not a ban (SOURCES.md §6).
  { id: 'sb243', from: '2026-01-01', name: 'California SB 243', text: 'California SB 243 takes effect: companion chatbots restricted for minors.' },
  // New York RAISE Act, signed 19 Dec 2025; effective 1 Jan 2027 per the chapter amendment ([unverified] in SOURCES.md
  // §5; the date the game already used): 72-hour incident reports.
  { id: 'raise', from: '2027-01-01', name: 'New York RAISE Act', text: 'New York RAISE Act takes effect: 72-hour incident reports.' },
];

/** US chip export policy toward China (SOURCES.md §4): strict denial since Oct 2022; from 13 Jan 2026 (BIS announcement
 *  of the H200 rule, FR 15 Jan 2026) H200-class chips go case-by-case. The frontier chips (Blackwell and later) stay
 *  barred: case-by-case covers only the older class. After the dated rows the US government's exportStrict row
 *  (COND_LAWS) may return it to strict. */
export const EXPORT_STEPS: { from: string; policy: ChipMarket['exportPolicy'] }[] = [
  { from: '2022-10-07', policy: 'strict' },
  { from: '2026-01-13', policy: 'caseByCase' },
];

/** The US government's conditional laws: the rules (world/usgov.ts lawRules, thresholds in USGOV) and where each acts. */
export interface CondLawRow { id: CondLawId; name: string; on: string; off: string; effect: string }
export const COND_LAWS: CondLawRow[] = [
  { id: 'exportStrict', name: 'Strict chip export controls', on: 'security stage 2, or a detected Chinese theft in the last 365 days', off: 'neither holds (back to the dated rows)', effect: 'compute/market.ts setExportPolicy (actorsDaily)' },
  { id: 'licensing', name: 'Frontier licensing', on: 'concern above 70 for 90 days', off: 'concern below 55', effect: 'worldfx/sectors.ts frictionOf (+0.1 LEGAL, HEALTH, FIN in the US); reportingLaw' },
  { id: 'relief', name: 'Worker relief', on: 'US unemployment up more than 1 point in 12 months', off: 'the rise under 0.5 points', effect: 'worldfx/sectors.ts retrainOf (+0.2)' },
  { id: 'ubi', name: 'Basic income', on: 'relief held 182 days with the rise still above 1 point', off: 'never (sticky)', effect: 'worldfx/sectors.ts displaced-pool exit x3; endings/scoring.ts' },
  { id: 'hitl', name: 'Human-in-the-loop mandate', on: 'a leaked misalignment memo or a run of severe incidents, with concern above 75', off: 'concern below 55', effect: 'worldfx/sectors.ts AI substitution capped' },
  { id: 'sez', name: 'Special economic zones', on: 'a superhuman AI researcher seen, concern below 60', off: 'concern above 70', effect: 'worldfx/robots.ts SEZ factories; techtree "needs sez"' },
  { id: 'fdaFastTrack', name: 'FDA fast track', on: 'an AI drug pipeline (W03) and security stage 1', off: 'never (sticky)', effect: 'worldfx/techtree.ts health lag x0.5' },
];

export interface LawsInForce {
  sb53: boolean;
  raise: boolean;
  euGpai: boolean;
  sb243: boolean;
  licensing: boolean;
  relief: boolean;
  ubi: boolean;
  hitl: boolean;
  sez: boolean;
  fdaFastTrack: boolean;
  exportPolicy: ChipMarket['exportPolicy'];
}

type Clock = { time: { day: number; startDate: string }; usgov?: Pick<UsGovState, 'laws'> };

const inForce = (s: Clock, from: string, day = s.time.day) => day >= dayOfDate(s.time.startDate, from);

/** The laws in force on `day` (default: today). The conditional rows are today's (usgov.laws), whatever `day`. */
export function lawsInForce(s: Clock | GameStateV2, day = s.time.day): LawsInForce {
  let exportPolicy: ChipMarket['exportPolicy'] = EXPORT_STEPS[0].policy;
  for (const x of EXPORT_STEPS) if (inForce(s, x.from, day)) exportPolicy = x.policy;
  const on = (id: LawId) => inForce(s, LAWS.find((l) => l.id === id)!.from, day);
  const c = s.usgov?.laws ?? {};
  const has = (id: CondLawId) => c[id] !== undefined;
  if (has('exportStrict')) exportPolicy = 'strict';
  return {
    sb53: on('sb53'), raise: on('raise'), euGpai: on('euGpai'), sb243: on('sb243'),
    licensing: has('licensing'), relief: has('relief'), ubi: has('ubi'), hitl: has('hitl'), sez: has('sez'), fdaFastTrack: has('fdaFastTrack'),
    exportPolicy,
  };
}

/** Incident-reporting law in force (SB 53, RAISE, or federal frontier licensing, which carries the same obligations). */
export const reportingLaw = (s: Clock | GameStateV2) => {
  const l = lawsInForce(s);
  return l.sb53 || l.raise || l.licensing;
};

/** The ids of the laws in force (dated and conditional, export controls apart), for readouts. */
export function lawIdsInForce(s: Clock | GameStateV2): string[] {
  const l = lawsInForce(s);
  return [...LAWS.filter((r) => l[r.id]).map((r) => r.id), ...COND_LAWS.filter((r) => r.id !== 'exportStrict' && l[r.id as Exclude<CondLawId, 'exportStrict'>]).map((r) => r.id)];
}

/** The display name of a law id. */
export const lawName = (id: string) => LAWS.find((r) => r.id === id)?.name ?? COND_LAWS.find((r) => r.id === id)?.name ?? id;

/** One row of the law grid: a dated or conditional law, whether it is in force, since when (a day), and its on and off rules in words. */
export interface LawStatus { id: string; name: string; kind: 'dated' | 'conditional'; inForce: boolean; since: number | null; text: string; on: string; off: string }

/** Every law (dated and conditional) with whether it is in force, since when, and its on and off rules in plain words. Strict chip
 *  export controls are the `exportStrict` row; the dated export steps set the policy it overrides. */
export function lawStatus(s: GameStateV2): LawStatus[] {
  const l = lawsInForce(s);
  const dated: LawStatus[] = LAWS.map((r) => ({
    id: r.id, name: r.name, kind: 'dated', inForce: l[r.id], since: l[r.id] ? dayOfDate(s.time.startDate, r.from) : null, text: r.text,
    on: `Takes effect on ${r.from}`, off: 'Never: a dated law stays',
  }));
  const cond: LawStatus[] = COND_LAWS.map((r) => {
    const since = s.usgov?.laws[r.id];
    const inForce = since !== undefined;
    return { id: r.id, name: r.name, kind: 'conditional', inForce, since: since ?? null, text: r.name, on: `On when ${r.on}`, off: r.off.startsWith('never') ? 'Stays once passed' : `Off when ${r.off}` };
  });
  return [...dated, ...cond];
}
