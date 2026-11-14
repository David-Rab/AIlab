// Derived world readouts (selectors for the UI, other workstreams and tests). Owner: WS5.
// Pure functions of world state; no truth fields (safe for the UI).
import { ECON, SECTORS } from '../../../data/v2/sectors';
import type { GameStateV2, RegionId } from '../types';

/** Share of US remote-work (pure cognitive) tasks done by AI (AI 2027 Oct 2027: 25% of remote-work jobs). */
export function remoteWorkAutomation(s: GameStateV2): number {
  let a = 0;
  let e = 0;
  for (const def of SECTORS) {
    if (!def.remote) continue;
    const st = s.world.sectors.US[def.id];
    a += st.A * st.E0;
    e += st.E0;
  }
  return e ? a / e : 0;
}

/** US firm AI adoption (Census BTOS analogue): employment-weighted 1 − exp(−k·A). */
export function firmAdoption(s: GameStateV2): number {
  let a = 0;
  let e = 0;
  for (const def of SECTORS) {
    const st = s.world.sectors.US[def.id];
    a += (1 - Math.exp(-ECON.firmK * st.A)) * st.E0;
    e += st.E0;
  }
  return a / e;
}

/** Employment of 22–25-year-olds in the most exposed jobs vs counterfactual (Canaries; 1 = no effect). */
export function youthExposedEmployment(s: GameStateV2): number {
  let a = 0;
  let e = 0;
  for (const def of SECTORS) {
    if (!def.youthExposed) continue;
    a += s.world.fx.youthRel[def.id] * def.empPct;
    e += def.empPct;
  }
  return a / e;
}

/** Economy-wide value-weighted automation Σ v_s·A_s. GATE explosive threshold 0.5 (R16 §4.3). */
export function automationShare(s: GameStateV2, r: RegionId = 'US'): number {
  let a = 0;
  let v = 0;
  for (const def of SECTORS) {
    const w = def.empPct * def.wage;
    a += w * s.world.sectors[r][def.id].A;
    v += w;
  }
  return a / v;
}

/** Year-to-date change of the equity index. */
export const dowYtd = (s: GameStateV2) => (s.world.fx.dowJan ? s.world.dow / s.world.fx.dowJan - 1 : 0);

/** US unemployment change over the last 12 months (pp), from the monthly history. */
export function unemploymentChange12m(s: GameStateV2): number {
  const h = s.world.fx.uHist;
  return h.length ? s.world.unemployment.US - h[0] : 0;
}
