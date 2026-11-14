// Robot stock (V2-SPEC §3.11.2; research/16 §1.5). Owner: WS5.
//
// Stock in human-worker-equivalents (HWE). Industrial robots ≈ 0.3 HWE each [D]; ≈5M operational at end-2025
// (IFR 2026 [V]) → ≈1.5M HWE. Production RobotProd' = RobotProd·ln2/T_dbl + ConversionBoost (R16):
//   - conventional production ≈ 0.2M HWE/yr (2025: 570k arms, 81k quadrupeds at 0.3 HWE) [F Epoch 2026], T_dbl 6 y
//     (Davidson & Hadshar: the last stock doubling took ≈6 years [F]);
//   - humanoids ≈16k/yr doubling every 6 months [F Epoch]; reducers cap them at ≈500k/yr in Reality-Updated until
//     W16 (general robotics) lifts it [F Epoch]; elsewhere 3M/yr (Epoch "1.5–3M clearly achievable") [D];
//   - SEZ car-plant conversion: ≈100k/month on opening, rising to ≈1M/month within about a year [A27];
//   - after W17 (self-replicating factories) T_dbl halves every ~1.5 years down to the preset floor (2 y / 1 y /
//     3 months), weeks with W18 nanotech, clamped at 2 weeks before 2035 [R16, D].
import { SECTORS, SECTOR_BY_ID, US_EMPLOYMENT, REGION_SCALE } from '../../../data/v2/sectors';
import { decimalYear } from '../core/time';
import type { GameStateV2, RegionId, SectorId, SystemCtx } from '../types';
import { econOf, policyState, techRamp } from './policy';

export const ROBOT = {
  stock0: 1.5e6,
  conventional0: 0.2e6,
  humanoid0: 16e3,
  humanoidDoublingYears: 0.5,
  baseDoublingYears: 6,
  usShare0: 0.08, // US share of installed industrial robots (IFR: ≈6–8% of installs) [D]
  depreciationYears: 15,
  sezOpenRate: 1.2e6, // HWE/yr on opening (100k/month)
  sezRampPerYear: 10.8e6, // → 1M/month after a year
  sezRampYears: 1.5,
};

/** Allocation weight of robots across sectors (per region identical): E0·w_PHYS·bias. */
const ALLOC: Record<SectorId, number> = (() => {
  const raw = SECTORS.map((d) => d.empPct * (d.tasks.PHYS ?? 0) * d.robotBias);
  const sum = raw.reduce((a, b) => a + b, 0);
  return Object.fromEntries(SECTORS.map((d, i) => [d.id, raw[i] / sum])) as Record<SectorId, number>;
})();

export function regionRobotShare(s: GameStateV2, r: RegionId): number {
  const us = s.world.fx.robotUS;
  return r === 'US' ? us : r === 'CN' ? (1 - us) * 0.55 : (1 - us) * 0.45;
}

/** RobotAvail_s,r = min(1, RobotStockHWE_r·alloc_s / (Emp_s·w_s,PHYS)) (R16 §1A.2 step 1). 1 if no PHYS tasks. */
export function robotAvail(s: GameStateV2, r: RegionId, sid: SectorId): number {
  const def = SECTOR_BY_ID[sid];
  const wp = def.tasks.PHYS ?? 0;
  if (!wp) return 1;
  const emp = US_EMPLOYMENT * (def.empPct / 100) * REGION_SCALE[r].emp;
  return Math.min(1, (s.world.robots.stockHWE * regionRobotShare(s, r) * ALLOC[sid]) / (emp * wp));
}

/** HWE value of a humanoid: limited before general robotics, a full worker after it [D]. */
const humanoidHWE = (s: GameStateV2) => 0.3 + 0.7 * techRamp(s, 'W16');

/** Total robot output, HWE per year. */
export function robotOutput(s: GameStateV2): number {
  return s.world.robots.prodPerYear + s.world.fx.humanoidProd * humanoidHWE(s);
}

/** Daily robot production (called from worldDaily). */
export function advanceRobots(s: GameStateV2, ctx: SystemCtx): void {
  const R = s.world.robots;
  const fx = s.world.fx;
  const dt = 1 / 365;
  const pol = policyState(s);
  const econ = econOf(s);

  // SEZs open (policy, WS4) → car-plant conversion (100k/month, → 1M/month within ~a year) [A27].
  if (pol.sez && !R.sezOpen) {
    R.sezOpen = true;
    fx.sezProd = Math.max(fx.sezProd, ROBOT.sezOpenRate);
    if (fx.sezDay < 0) fx.sezDay = ctx.day;
  }
  if (!pol.sez && R.sezOpen) R.sezOpen = false;
  const sezAge = fx.sezDay >= 0 ? (ctx.day - fx.sezDay) / 365 : -1;
  const conv = R.sezOpen && sezAge >= 0 && sezAge < ROBOT.sezRampYears ? ROBOT.sezRampPerYear * dt : 0;

  // Doubling time: base composite, SEZ ≈ 1 y ("doubling time of about a year" [A27]), then self-replication
  // after W17 halves it every ~1.5 years down to the preset floor.
  const w17 = s.world.techs.W17;
  let Tsez = 1;
  if (w17?.discoveredDay !== undefined && R.sezOpen) {
    const yrs = (ctx.day - w17.discoveredDay) / 365;
    const floor = techRamp(s, 'W18') > 0.5 ? 0.04 : econ.robotFloorYears;
    const minYears = decimalYear(s) < 2035 ? Math.max(floor, 2 / 52) : floor;
    Tsez = Math.max(minYears, Math.min(1, econ.robotFloorYears * 2) * Math.pow(0.5, yrs / 1.5));
  }
  R.doublingYears = R.sezOpen && fx.sezProd > 0 ? Tsez : ROBOT.baseDoublingYears;
  const conventional = Math.max(0, R.prodPerYear - fx.sezProd);
  const conv2 = conventional * (1 + (Math.LN2 / ROBOT.baseDoublingYears) * dt);
  if (R.sezOpen) fx.sezProd = fx.sezProd * (1 + (Math.LN2 / Tsez) * dt) + conv;
  R.prodPerYear = conv2 + fx.sezProd;

  // Humanoids: doubling every 6 months up to the reducer cap until general robotics.
  // After general robotics the reducer cap lifts to ≈10M/yr (Epoch: 5–10M plausible by 2030); SEZs and W17 drive the rest.
  const cap = techRamp(s, 'W16') > 0.5 ? 10e6 : s.setup.baseline === 'reality' ? 0.5e6 : 3e6;
  fx.humanoidProd = Math.min(cap, fx.humanoidProd * (1 + (Math.LN2 / ROBOT.humanoidDoublingYears) * dt));

  // Stock and its US share (SEZ output is all US).
  const hh = fx.humanoidProd * humanoidHWE(s);
  const out = R.prodPerYear + hh;
  const usNew = conv2 * ROBOT.usShare0 + fx.sezProd + hh * 0.15;
  const usStock = R.stockHWE * fx.robotUS;
  const dep = dt / ROBOT.depreciationYears;
  R.stockHWE = R.stockHWE * (1 - dep) + out * dt;
  fx.robotUS = Math.min(0.95, (usStock * (1 - dep) + usNew * dt) / R.stockHWE);
}
