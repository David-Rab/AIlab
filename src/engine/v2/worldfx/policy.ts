// Policy inputs the outside world reads (V2-SPEC §3.11; research/16 §1A.2 step 4, §2.3, §4). Owner: WS5.
//
// WS4 owns the policies themselves (events, gov actions, statutes). The world reads them ONLY through
// `policyState(s)`: statute fields on GovActor plus these documented `s.flags` keys, which WS4 sets/clears.
// Any truthy flag value counts as "on".
import { ECON_PRESETS, type EconPreset } from '../../../data/v2/sectors';
import type { GameStateV2 } from '../types';

export const POLICY_FLAGS = {
  /** Universal basic income enacted (H26; labor-force exit ×3; Gini transfers). */
  ubi: 'policy.ubi',
  /** Federal job-training / unemployment-insurance program (AI 2027 Aug 2027): Retrain +0.2. */
  jobTraining: 'policy.jobTraining',
  /** Special Economic Zones open (H19): robot conversion, SEZ friction waiver, W17 gate. */
  sez: 'policy.sez',
  /** China opens its own AI zones (H32). */
  chinaSez: 'policy.chinaSez',
  /** Arms race declared: MIL friction −0.3, MIL penetration target up, tier cap lifted. */
  armsRace: 'policy.armsRace',
  /** Human-judgment rule for force (DoDD 3000.09-style) REMOVED (default: rule holds, MIL tier cap T1). */
  milLoopRemoved: 'policy.milLoopRemoved',
  /** Economy-wide human-in-the-loop mandate: tier cap T2 in every domain. */
  humanInLoop: 'policy.humanInLoop',
  /** Multi-vendor rule for government use: no lineage above 50% of GOV/MIL. */
  multiVendor: 'policy.multiVendor',
  /** Transparency-of-advice rule: lowers T1 Accept. */
  adviceTransparency: 'policy.adviceTransparency',
  /** Autonomous-vehicle ban (LOG +0.3 friction). */
  avBan: 'policy.avBan',
  /** Companion / child-safety ban (AI-friend share × 0.4). */
  companionBan: 'policy.companionBan',
  /** "AI in schools" ban (EDU +0.3 friction). */
  schoolBan: 'policy.schoolBan',
  /** Regulatory fast-track for AI-designed drugs (health lags × 0.5). */
  fdaFastTrack: 'policy.fdaFastTrack',
  /** Government AI-advisor program (GOV penetration target +0.05). */
  govAdvisors: 'policy.govAdvisors',
  /** Impact payments / transfers (% of GDP, numeric flag). */
  transfersPctGdp: 'policy.transfersPctGdp',
  /** Output shock (war, cyber attack, crash, pandemic) as a growth penalty per year, numeric (e.g. 0.03). */
  gShock: 'world.gShock',
} as const;

export interface PolicyState {
  ubi: boolean; jobTraining: boolean; sez: boolean; chinaSez: boolean; armsRace: boolean; milLoopRemoved: boolean;
  humanInLoop: boolean; multiVendor: boolean; adviceTransparency: boolean; avBan: boolean; companionBan: boolean;
  schoolBan: boolean; fdaFastTrack: boolean; govAdvisors: boolean; licensing: boolean; euCode: boolean;
  transfersPctGdp: number;
  gShock: number;
}

const on = (s: GameStateV2, k: string) => !!s.flags[k];

export function policyState(s: GameStateV2): PolicyState {
  const F = POLICY_FLAGS;
  const t = Number(s.flags[F.transfersPctGdp] ?? 0);
  return {
    ubi: on(s, F.ubi), jobTraining: on(s, F.jobTraining), sez: on(s, F.sez), chinaSez: on(s, F.chinaSez),
    armsRace: on(s, F.armsRace), milLoopRemoved: on(s, F.milLoopRemoved), humanInLoop: on(s, F.humanInLoop),
    multiVendor: on(s, F.multiVendor), adviceTransparency: on(s, F.adviceTransparency), avBan: on(s, F.avBan),
    companionBan: on(s, F.companionBan), schoolBan: on(s, F.schoolBan), fdaFastTrack: on(s, F.fdaFastTrack),
    govAdvisors: on(s, F.govAdvisors),
    licensing: s.gov.statutes.federalLicensing, euCode: s.gov.statutes.euCode,
    transfersPctGdp: (Number.isFinite(t) ? Math.max(0, t) : 0) + (on(s, F.ubi) ? 3 : 0),
    gShock: Math.max(0, Number(s.flags[F.gShock] ?? 0) || 0),
  };
}

/** Hidden economy preset parameters (research/16 §4.6). Engine use only. */
export function econOf(s: GameStateV2): EconPreset {
  return ECON_PRESETS[s.hidden.econ] ?? ECON_PRESETS.ai2027;
}

/** Impact ramp 0..1 of a world technology (0 until discovered). */
export function techRamp(s: GameStateV2, id: string): number {
  return s.world.techs[id]?.ramp ?? 0;
}

export const sigmoid =(x: number) => 1 / (1 + Math.exp(-x));
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const clampR = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
