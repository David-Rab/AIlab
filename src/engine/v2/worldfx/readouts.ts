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

/** Weight of each defensive technology's impact ramp in the defence index [D]: a fully ramped countermeasure removes
 *  most, not all, of the civilisation-scale tail. */
export const DEFENCE_TECHS: Record<'bio' | 'cyber', [string, number][]> = {
  bio: [['W06', 0.6]], // new antibiotics and antivirals (medical countermeasures)
  cyber: [['W24', 0.6]], // autonomous cyber defense (find and patch zero-days at scale)
};

/** Defence index 0..1 against misuse catastrophes (R16 §3.1: misuse P = Exposure × (1 − Defense) × intent), from the
 *  ramps of the defensive world technologies; for one risk, or the mean over bio and cyber. Used by WS4's
 *  catastrophe check (§5.1 #4). */
export function defenceIndex(s: GameStateV2, risk?: 'bio' | 'cyber'): number {
  const of = (k: 'bio' | 'cyber') => DEFENCE_TECHS[k].reduce((a, [id, w]) => a + w * (s.world.techs[id]?.ramp ?? 0), 0);
  const d = risk ? of(risk) : (of('bio') + of('cyber')) / 2;
  return d < 0 ? 0 : d > 1 ? 1 : d;
}

/** Year-to-date change of the equity index. */
export const dowYtd = (s: GameStateV2) => (s.world.fx.dowJan ? s.world.dow / s.world.fx.dowJan - 1 : 0);

/** US unemployment change over the last 12 months (pp), from the monthly history. */
export function unemploymentChange12m(s: GameStateV2): number {
  const h = s.world.fx.uHist;
  return h.length ? s.world.unemployment.US - h[0] : 0;
}
