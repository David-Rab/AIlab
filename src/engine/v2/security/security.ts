// Weight and secrets security, spies, siloing (V2-SPEC §3.6; research/11 #17, #24). Owner: WS4.
import { clamp } from '../../rng';
import { decimalYear } from '../core/time';
import { bestPlayerVersion, activeRivals, CHINA_ID } from '../models/labs';
import { exfiltrationHazard } from '../safety/incidents';
import { distillationLeak } from '../models/deployments';
/** RD-X04 [D]: the old sustained-distillation line (0.00048 OOM a day) over an 8-week post-training interval. */
const DISTILL_SUSTAINED_OOM = 0.00048 * 56;
import { misalignment } from '../safety/traits';
import { footholdFromEscape } from '../safety/footholds';
import { escapeNoticed } from '../safety/control';
import type { EngineSystem, GameStateV2, SecurityState, StaffByRole } from '../types';
import { openWeightsReleased, postureOf } from '../actors/rivals';
import { lagDays } from '../models/capability';
import { request, ws4 } from '../actors/state';
import { executeTheft, secretsLeakDaily, theftHazardDaily, theftHazardOn } from './theft';
import { addRivalKnowledge } from '../actors/rivalModel';

/** The weight-security target the player can set (B4: one range for the engine and the slider). */
export const WSL_TARGET_RANGE: readonly [number, number] = [2, 5];

/** WSL status-quo floor: 2.2 + 0.55·min(years since 2025.0, 2) (R11 #17). */
export const wslFloor = (yearsSince2025: number) => 2.2 + 0.55 * Math.min(Math.max(0, yearsSince2025), 2);

/** Spend needed to move/hold WSL L: 0.2·e^(0.9(L−2))·(computeOnline/1M)^0.5 $B/yr [D] (§3.6). */
// level-lint-ok: L is the security level (WSL), not capability
export const reqSpend = (L: number, computeOnline: number) => 0.2 * Math.exp(0.9 * (L - 2)) * Math.sqrt(Math.max(0, computeOnline) / 1e6);

/** privileged = (cap + saf)·(1 − 0.3·siloing). */
export function privilegedOf(staff: Pick<StaffByRole, 'cap' | 'saf'>, siloing: number) {
  return (staff.cap + staff.saf) * (1 - 0.3 * siloing);
}

/** Spy rate per privileged staffer: 0.005, rising to 0.01 at China rung ≥ 2 (R11 verified). */
export const spyRate = (s: GameStateV2) => (s.china.rung >= 2 ? 0.01 : 0.005);

export function initialSecurity(staff: Pick<StaffByRole, 'cap' | 'saf'>, wsl = 2.4): SecurityState {
  const privileged = privilegedOf(staff, 0);
  return {
    wsl, ssl: wsl - 0.6, target: wsl, spendRate: 0.3, siloing: 0, clearances: false,
    privileged, spies: privileged * 0.005, counterIntel: 0.1, stolen: [], detectedThefts: [],
  };
}

/** Whistleblower hazard per day (research/17 A6): grows with things worth leaking; low morale raises it. */
export function whistleHazard(s: GameStateV2, extraFlags = 0): number {
  const w = ws4(s);
  const worth = w.redFlags + extraFlags + w.coverups.length + (s.player.safety.incidents.some((i) => i.status === 'covered') ? 1 : 0);
  if (!worth) return 0;
  return 0.0008 * worth * (1.5 - s.player.morale.safety / 100) * (s.flags['ws4:purged'] ? 1.5 : 1);
}
/** F6d: the whistleblower hazard as odds over a year at today's morale (1 − (1 − h)^365), with `extraFlags` more red
 *  flags: what continuing past a red flag adds (Safety framework override previews). */
export const whistleOddsYear = (s: GameStateV2, extraFlags = 0) => 1 - Math.pow(1 - whistleHazard(s, extraFlags), 365);

/** security (90, daily): WSL movement, spies, theft hazard, insider leaks, distillation flow, exfiltration hazard. */
export const securitySystem: EngineSystem = {
  id: 'security', owner: 'WS4', cadence: 'daily', order: 90, system: 'relations',
  run(s, ctx) {
    const w = ws4(s);
    const sec = s.player.security;
    const rng = ctx.rng('security');
    const floor = wslFloor(decimalYear(s) - 2025);

    // WSL moves toward target at ≤ 0.006/day while funded; underfunding decays it 0.002/day toward the floor.
    if (sec.spendRate >= reqSpend(sec.target, s.player.computeOnline) - 1e-9 && sec.wsl < sec.target) sec.wsl = Math.min(sec.target, sec.wsl + 0.006);
    else if (sec.spendRate < reqSpend(sec.wsl, s.player.computeOnline) - 1e-9) sec.wsl -= 0.002;
    sec.wsl = clamp(Math.max(sec.wsl, floor), 1, 5);
    sec.ssl = sec.wsl - 0.6;
    sec.privileged = privilegedOf(s.player.staff, sec.siloing);
    w.spyMult = Math.min(1, w.spyMult + 0.002);
    sec.spies = sec.privileged * spyRate(s) * w.spyMult * (sec.clearances ? 0.6 : 1);
    // Security spend is charged only by WS3's payroll system (finance ledger); this system keeps its effects.

    // Theft against the player, then against active rivals holding a model worth stealing.
    if (rng.chance(theftHazardDaily(s))) {
      w.theftAttempts++;
      executeTheft(s, ctx, 'player');
    }
    for (const r of activeRivals(s)) {
      const rs = r.core.security;
      rs.wsl = Math.max(rs.wsl, floor + 0.4 * postureOf(s, r.core.id).safetyInvestment);
      rs.ssl = rs.wsl - 0.6;
      rs.spies = privilegedOf(r.core.staff, 0) * spyRate(s);
      if (rng.chance(0.5 * theftHazardOn(s, rs, lagDays(s, CHINA_ID, r.core.id)))) executeTheft(s, ctx, r.core.id);
    }

    // RD-X04: distillation is a level at each lab's post-training (production/diffusion.ts distillLift), not a daily
    // recipe flow; an open-weights deployment above the open frontier is absorbed through openWeightsReleased. China
    // gains from secrets leaks (recipe gap, R11 #16c).
    const cn = s.china.lab;
    for (const lab of [...activeRivals(s), ...(cn.core.status === 'active' ? [cn] : [])]) {
      const leak = distillationLeak(s, lab.core.id);
      if (leak.openG > s.knowledge.openWeightsG) openWeightsReleased(s, ctx, 'player', leak.openG, leak.openRecG);
    }
    if (cn.core.status === 'active') {
      const leak = secretsLeakDaily(s);
      addRivalKnowledge(cn, leak);
      w.drift['china.recipe'] = (w.drift['china.recipe'] ?? 0) + leak;
      // Sustained distillation: China's next post-training would take > DISTILL_SUSTAINED_OOM from the player's products.
      w.distillDays = distillationLeak(s, CHINA_ID).dG > DISTILL_SUSTAINED_OOM ? w.distillDays + 1 : 0;
    }

    // Exfiltration of an internal agent (WS2 hazard) → E25 and the hunt. Model v3 E9: security notices it with the
    // lab's effective control of the model (safety/control.ts escapeNoticed), else the copy is a hidden foothold (no
    // alert, no hunt). Either way the copy grows outside the lab and takes control once it can (endings 'rogue').
    if (!w.loose) {
      const hz = exfiltrationHazard(s);
      if (hz > 0 && rng.chance(hz)) {
        const v = bestPlayerVersion(s);
        if (v) {
          const mis = misalignment(v.traitsTrue, v.uModes);
          if (escapeNoticed(s, v, ctx.day)) {
            w.loose = { day: ctx.day, versionId: v.id, mis };
            footholdFromEscape(s, ctx.day, v, mis); // model v3 E8: the copy is a foothold outside the lab (located: the alert)
            ctx.log('alert', `A copy of ${v.name} has escaped your servers.`, 5, v.id);
            request(s, 'E25', { versionId: v.id });
          } else footholdFromEscape(s, ctx.day, v, mis, false);
        }
      }
    }

    // Insider leak to the press (whistleblower). With a channel (A6) the concern is raised and handled internally
    // instead: safety morale +5, one red flag fewer toward the next leak.
    const hw = whistleHazard(s);
    if (hw > 0 && !w.internalReport && rng.chance(hw)) {
      if (s.player.policies.whistleblowerChannel) {
        ctx.bump('morale.safety', 5, 'internal report handled');
        w.redFlags = Math.max(0, w.redFlags - 1);
        ctx.log('company', 'An employee raised a safety concern through the whistleblower channel; it was handled internally.', 2);
      } else request(s, 'E19', { mult: 1 });
    }
  },
};
