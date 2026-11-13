// US rival labs: progress inputs, releases, posture pressure, incidents (V2-SPEC §3.10.3). Owner: WS4.
// Rival capability uses the WS1 lab API / production function; WS4 owns behaviour.
import { LAB_ARCHETYPES } from '../../../data/actors';
import { ARCHETYPE_CLAUSE } from '../../../data/v2/postures';
import { RIVAL_MODEL_FAMILIES, RIVAL_NAMES_V2 } from '../../../data/v2/names';
import { TRAIT_START } from '../../../data/v2/traits';
import { Rng } from '../../rng';
import { shareRefAt, normalizeSplit } from '../departments/split';
import { domainsOf, levelOf } from '../models/capability';
import { initialSecurity } from '../security/security';
import { drawLineageUModes, rivalId } from '../world/hidden';
import type { BaselineId, EngineSystem, HiddenWorld, RivalLab, SafetyPosture, SimpleModel, StaffByRole } from '../types';

export { activeRivals } from '../models/labs';

export const archetypeOf = (id: string) => LAB_ARCHETYPES.find((a) => a.id === id) ?? LAB_ARCHETYPES[0];

const FIN: Record<string, { cash: number; revenueRun: number; valuation: number }> = {
  safety: { cash: 15, revenueRun: 5, valuation: 180 },
  bigtech: { cash: 60, revenueRun: 8, valuation: 0 }, // in-house lab funded by the parent's capex
  maverick: { cash: 12, revenueRun: 1, valuation: 120 },
  openweights: { cash: 40, revenueRun: 0.5, valuation: 0 },
  upstart: { cash: 4, revenueRun: 0.2, valuation: 30 },
};

export function simpleModel(h: HiddenWorld, id: string, name: string, day: number, pm: number, uModes: SimpleModel['uModes'], isPublic: boolean, openWeights = false): SimpleModel {
  const w = h.timeline;
  return { id, name, day, pm, Lg: levelOf(w, pm), domains: domainsOf(w, pm), traitsTrue: { ...TRAIT_START }, uModes, isPublic, openWeights };
}

/** Build rival i at newGame. `rng` is the 'world' stream; gap = v1 archetype range (× 0.3 in Reality), §3.10.3. */
export function initialRival(rng: Rng, h: HiddenWorld, i: number, playerPm: number, baseline: BaselineId, globalCompute: number): RivalLab {
  const id = rivalId(i);
  const arch = archetypeOf(h.actorPresets.rivals[id]);
  const posture: SafetyPosture = h.rivalPostures[id];
  const gapYears = rng.range(arch.gapYears[0], arch.gapYears[1]) * (baseline === 'reality' ? 0.3 : 1);
  const pm = playerPm - gapYears * 1.25;
  const fam = RIVAL_MODEL_FAMILIES[i % RIVAL_MODEL_FAMILIES.length];
  const uModes = drawLineageUModes(rng, h, false);
  const internal = simpleModel(h, `${id}-m1`, `${fam}-1`, -30, pm, uModes, false);
  const publicModel = simpleModel(h, `${id}-m0`, `${fam}-1 public`, -60, pm - 0.15, uModes, true, arch.id === 'openweights');
  const totalStaff = Math.round(2500 * Math.max(0.3, arch.computeMult));
  const staff: StaffByRole = {
    cap: Math.round(totalStaff * 0.8), saf: Math.round(totalStaff * 0.15 * posture.safetyInvestment + 10),
    sec: Math.round(totalStaff * 0.04), prod: Math.round(totalStaff * 0.06), ops: Math.round(totalStaff * 0.02),
  };
  const split = normalizeSplit({ ...shareRefAt(2025.5), safety: posture.safetyInvestment * 0.15 });
  const f = FIN[arch.id] ?? FIN.bigtech;
  return {
    core: {
      id, name: RIVAL_NAMES_V2[i % RIVAL_NAMES_V2.length], kind: 'rival', status: 'active',
      pa: pm,
      computeOnline: globalCompute * (0.06 + rng.range(-0.015, 0.02)) * arch.computeMult,
      split, staff, tasteHire: 1,
      security: initialSecurity(staff, 2.2),
      milestoneDays: {},
    },
    archetype: arch.id,
    internal,
    publicModel,
    nextBaseDay: Math.round(rng.range(30, 270)),
    finance: { ...f, commitments: f.cash * 2, distress: false },
    visible: { frameworkVersion: 1, clauseType: ARCHETYPE_CLAUSE[arch.id] ?? 'conditional', testers: posture.externalAccess > 0.4 ? ['evalGov', 'evalIndep'] : [] },
    intel: { leadDaysEst: Math.round(gapYears * 365), leadDaysSd: 60, misalignBand: [0.05, 0.4], knownIncidents: [] },
    meters: { poachAggression: arch.id === 'upstart' ? 70 : arch.id === 'maverick' ? 60 : 40, cooperation: 20, lobbyStance: arch.lobby, openness: arch.openness },
    pressure: 0,
    pressureDays: 0,
  };
}

/** rivalsChina (100, daily): their runs, releases, posture pressure and incidents; China meters and ladder. TODO(WS4). */
export const rivalsChinaSystem: EngineSystem = {
  id: 'rivalsChina', owner: 'WS4', cadence: 'daily', order: 100,
  run() {},
};
