// China: meters, presets, ladder, de-escalation, DeepCent lab, geopolitics (V2-SPEC §3.10.4; research/10). Owner: WS4.
import { CHINA_PRESETS } from '../../../data/actors';
import { CHINA_LAB_NAME, CHINA_MODEL_FAMILY } from '../../../data/v2/names';
import { Rng } from '../../rng';
import { normalizeSplit, shareRefAt } from '../departments/split';
import { CHINA_ID } from '../models/labs';
import { initialSecurity } from '../security/security';
import { drawLineageUModes } from '../world/hidden';
import { simpleModel } from './rivals';
import type { ChinaActor, EngineSystem, HiddenWorld, StaffByRole } from '../types';

export const chinaPresetOf = (id: string) => CHINA_PRESETS.find((p) => p.id === id) ?? CHINA_PRESETS[0];

/** China at Jul 2025 (research/10 §1.1). DeepCent starts ≈0.6 progress-years (≈150–200 d) behind (§9 #17). */
export function initialChina(rng: Rng, h: HiddenWorld, playerPm: number, chinaGapYears: number): ChinaActor {
  const p = chinaPresetOf(h.actorPresets.china);
  const pm = playerPm - chinaGapYears;
  const uModes = drawLineageUModes(rng, h, false);
  const staff: StaffByRole = { cap: 1500, saf: 60, sec: 80, prod: 120, ops: 40 };
  const meters: ChinaActor['meters'] = {
    computeShare: 13, computeAbs: 1.5e6, chipSelfSufficiency: 30, domesticFab: 20, distillationAccess: 60,
    intelCapability: 75, theftIntent: 20, centralization: 0, stateSteering: 35, safetyConcern: 30, openWeights: 85,
    taiwanTension: 40, normsDiplomacy: 65, verificationWillingness: 15, econLeverage: 80, hawkDove: p.hawk,
  };
  const total = CHINA_PRESETS.reduce((a, x) => a + x.weight, 0);
  return {
    preset: p.id,
    lab: {
      core: {
        id: CHINA_ID, name: CHINA_LAB_NAME, kind: 'china', status: 'active',
        pa: pm,
        computeOnline: meters.computeAbs * 0.35,
        split: normalizeSplit({ ...shareRefAt(2025.5), safety: h.chinaPosture.safetyInvestment * 0.15 }),
        staff, tasteHire: 1,
        security: initialSecurity(staff, 2.0),
        milestoneDays: {},
      },
      archetype: 'deepcent',
      internal: simpleModel(h, 'cn-m1', `${CHINA_MODEL_FAMILY}-1`, -30, pm, uModes, false),
      publicModel: simpleModel(h, 'cn-m0', `${CHINA_MODEL_FAMILY}-1 open`, -45, pm - 0.15, uModes, true, true),
      nextBaseDay: Math.round(rng.range(60, 240)),
      finance: { cash: 30, revenueRun: 1, valuation: 0, commitments: 0, distress: false },
      visible: { frameworkVersion: 0, clauseType: 'state', testers: [] },
      intel: { leadDaysEst: Math.round(chinaGapYears * 365 * 0.8), leadDaysSd: 75, misalignBand: [0.05, 0.5], knownIncidents: [] },
      meters: { poachAggression: 20, cooperation: 10, lobbyStance: 0, openness: 85 },
      pressure: 0,
      pressureDays: 0,
    },
    meters,
    rung: 0,
    deesc: 0,
    holdDays: {},
    presetWeights: Object.fromEntries(CHINA_PRESETS.map((x) => [x.id, x.weight / total])),
  };
}

/** geoQ (440, quarterly): Taiwan/Korea rolls, export policy, China preset re-weighting, rival finance. TODO(WS4). */
export const geoQSystem: EngineSystem = {
  id: 'geoQ', owner: 'WS4', cadence: 'quarterly', order: 440,
  run() {},
};
