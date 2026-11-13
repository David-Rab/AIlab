// Outside world: sectors × regions, control, techs, robots (V2-SPEC §3.11; research/16 Part 1). Owner: WS5.
import { REGION_SCALE, SECTORS, US_EMPLOYMENT } from '../../../data/v2/sectors';
import { WORLD_TECHS } from '../../../data/v2/techs';
import type {
  ControlDomainId, ControlState, EngineSystem, LabId, MacroState, RegionId, SectorId, SectorState, WorldEconomy, WorldTechState,
} from '../types';

const REGIONS: RegionId[] = ['US', 'CN', 'ROW'];

/** World at Jul 2025. Fractions are 0..1 (A, alpha, control P). [D] values flagged for WS5 calibration (§7.3). */
export function initialWorld(labIds: LabId[]): WorldEconomy {
  const sectors = {} as Record<RegionId, Record<SectorId, SectorState>>;
  for (const r of REGIONS) {
    const row = {} as Record<SectorId, SectorState>;
    for (const sec of SECTORS) {
      const E0 = US_EMPLOYMENT * (sec.empPct / 100) * REGION_SCALE[r].emp;
      const A = sec.A0 * (r === 'US' ? 1 : 0.6);
      row[sec.id] = { F: 0.3, K: 1, R: sec.R0, Astar: 0.5, A, alpha: 0.05 * A, E: E0, E0, hireRate: 0.2, binding: 'diffusion' };
    }
    sectors[r] = row;
  }
  const playerShare = 0.35;
  const others = labIds.filter((l) => l !== 'player');
  const shareRow = (): Record<LabId, number> => ({ player: playerShare, ...Object.fromEntries(others.map((l) => [l, (1 - playerShare) / Math.max(1, others.length)])) });
  const shares = {} as Record<SectorId, Record<LabId, number>>;
  for (const sec of SECTORS) shares[sec.id] = shareRow();
  const ctrl = (P: number): ControlState => ({ P, tiers: [0.7, 0.3, 0, 0], accept: 0.3, tierCap: 1, shares: shareRow() });
  const control: Record<ControlDomainId, ControlState> = { ECON: ctrl(0.05), GOV: ctrl(0.02), MIL: ctrl(0.01), INFRA: ctrl(0.03) };
  const techs: Record<string, WorldTechState> = {};
  for (const t of WORLD_TECHS) {
    techs[t.id] = { prog: t.start, ramp: t.start >= 1 ? 1 : 0, exposure: 0 };
    if (t.start >= 1) techs[t.id].discoveredDay = 0;
  }
  const macro = (gdp: number, g: number, gini: number, wage: number): MacroState => ({ gdp, g, laborShare: 0.56, wage, gini, aiCapexShare: 0.012, energyPrice: 1 });
  return {
    sectors,
    displacedPool: { US: 0, CN: 0, ROW: 0 },
    unemployment: { US: 4.3, CN: 5.2, ROW: 5.5 },
    youthUnemployment: 9.0,
    control,
    infoShare: shareRow(),
    friendShare: 0.03,
    techs,
    robots: { stockHWE: 1.5e6, prodPerYear: 0.2e6, doublingYears: 6, sezOpen: false, sezShare: 0 },
    macro: { US: macro(30000, 0.02, 0.48, 1), CN: macro(19000, 0.045, 0.47, 0.3), ROW: macro(60000, 0.028, 0.6, 0.5) },
    dow: 44000,
    aiOwnerShare: 0.02,
    intelligenceCurse: false,
    shares,
  };
}

/** worldDaily (110, daily): sector Bass diffusion, control penetration, tech progress, robots. TODO(WS5, M1). */
export const worldDailySystem: EngineSystem = {
  id: 'worldDaily', owner: 'WS5', cadence: 'daily', order: 110,
  run() {},
};
