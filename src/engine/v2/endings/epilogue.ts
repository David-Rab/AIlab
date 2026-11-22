// Epilogue fast-sim for 'overtaken' and company-loss endings, and ASI resolution for any lab (V2-SPEC §5.1 #9, §5.2).
// Owner: WS4. Rivals and China resolve with THEIR OWN hidden traits — never a coin flip (fixes REDESIGN row 11).
import { clamp, sigmoid } from '../../rng';
import { bestPlayerVersion, bestG, otherLabs } from '../models/labs';
import { trueEfficacy } from '../safety/common';
import { containAtAsi } from '../safety/incidents';
import { misalignment } from '../safety/traits';
import { gOfLevel } from '../models/capability';
import { LEVEL_KNOTS } from '../../../data/v2/calibration';
import { B_G_PER_Y } from '../../../data/v2/runDesign';
import { leverage } from '../worldfx/control';
import type { EndingV2, GameStateV2, LabId, PowerOutcome } from '../types';
import { CONTROL } from '../../../data/v2/danger';
import { asiControl, lossThreshold } from '../safety/control';
import { keptShare } from '../actors/commitments';
import { labOf, leadBetween, paceOf, postureOf, projectLabMis, rivalMis } from '../actors/rivals';
import { ws4r } from '../actors/state';

/** v1 doom curve σ((Mis − doomThreshold)/0.06) (§5.2): since model v3 E9 the odds over worlds of losing control with
 *  no oversight (the world's tolerance θ_w = doomThreshold + ε_w, safety/control.ts). Scores read it as an expectation;
 *  no ending rolls it. */
export const pMisOf = (s: GameStateV2, mis: number) => sigmoid((mis - s.hidden.doomThreshold) / 0.06);

/** Player containment at ASI (§5.2): Cont = Contain(ASI) + 0.2·[F32 verified gatekeeper] + 0.1·[AG10 e > 0.6
 *  adopted], clamped 0..1. Contain(ASI) is WS2's (control layer × best AG07 tool on a model at the ASI level). The gatekeeper counts
 *  when F32 fired ('ws2.gatekeeper') and T-GATE is in the active stack and real (WS2's exfiltration rule); AG10 is
 *  adopted when the agenda is active and its TRUE efficacy exceeds 0.6. */
export function playerContain(s: GameStateV2): number {
  const gate = s.player.safety.techniques['T-GATE'];
  const f32 = s.flags['ws2.gatekeeper'] !== undefined && !!gate?.unlocked && gate.active && !gate.falseValidated ? 0.2 : 0;
  const ag10 = s.player.safety.agendas.AG10?.status === 'active' && trueEfficacy(s, 'AG10') > 0.6 ? 0.1 : 0;
  return clamp(containAtAsi(s) + f32 + ag10, 0, 1);
}

/** Containment for other labs: posture·0.2 (§5.2). */
export const otherContain = (s: GameStateV2, lab: LabId) => 0.2 * postureOf(s, lab).safetyInvestment;

/** Player's share of the control index (mean of the domain shares). */
export function controlShare(s: GameStateV2, lab: LabId = 'player'): number {
  const doms = Object.values(s.world.control);
  return doms.length ? doms.reduce((a, d) => a + (d.shares[lab] ?? 0), 0) / doms.length : 0;
}

/** Mis of a lab's current frontier (hidden). */
export function misOf(s: GameStateV2, lab: LabId): number {
  if (lab === 'player') {
    const v = bestPlayerVersion(s);
    return v ? misalignment(v.traitsTrue, v.uModes) : 0;
  }
  const r = labOf(s, lab);
  return r ? rivalMis(r) : 0;
}

/** Projected Mis when lab X reaches ASI: the days to ASI from the lead-conversion pace (paceOf × 0.7, B22's lead part:
 *  theme L), and for a rival or China its own trait cadence over those days on WS2's rival trait step (rivals.ts
 *  projectLabMis, the rule labs use in play). The player's is its current frontier's Mis. Pure. */
export function projectedMisAtAsi(s: GameStateV2, lab: LabId): { mis: number; days: number } {
  // The ASI point on the display scale (λ = 15, the level knot every lab's ASI milestone reads), G a year at the lead pace.
  const asiG = gOfLevel(s.hidden.timeline, LEVEL_KNOTS[6]);
  const pace = paceOf(s) * B_G_PER_Y;
  const gap = Math.max(0, asiG - bestG(s, lab));
  const days = Math.round((gap / Math.max(0.36, pace) /* floor was 0.3 progress-years */) * 365 * 0.7);
  if (lab === 'player') return { mis: misOf(s, 'player'), days };
  const r = labOf(s, lab);
  return { mis: r ? projectLabMis(s, r, asiG, days) : 0, days };
}

const ARCH_POWER: Record<string, PowerOutcome> = { safety: 'democratic', bigtech: 'corporate', maverick: 'corporate', openweights: 'multipolar', upstart: 'corporate', deepcent: 'beijing' };

/** Power outcome when lab X's ASI is aligned (§5.2 priority table). */
export function alignedPower(s: GameStateV2, lab: LabId): PowerOutcome {
  if (s.gov.treaty === 'verified') return 'treaty';
  if (lab === 'china') return 'beijing';
  const near = [...otherLabs(s).filter((r) => r.core.status === 'active').map((r) => r.core.id), 'player'].some((id) => id !== lab && Math.abs(leadBetween(s, lab, id)) < 90 && (id !== 'player' || s.player.status === 'active'));
  if (lab !== 'player') {
    if (near) return 'multipolar';
    return ARCH_POWER[labOf(s, lab)?.archetype ?? 'bigtech'] ?? 'corporate';
  }
  const w = ws4r(s);
  if (s.gov.oversight) return 'committee';
  if (w.dpaAccepted && s.relations.stocks.exec.trust < 40) return 'government';
  if (near) return 'multipolar';
  if (s.player.policies.govBriefing >= 2 && keptShare(s) >= 0.8 && controlShare(s) < 0.5) return 'democratic';
  return 'corporate';
}

export interface AsiResolution {
  id: EndingV2['id']; power: PowerOutcome; mis: number;
  /** v1's doom curve σ((Mis − doomThreshold)/0.06): the odds over worlds (a record for tests; nothing rolls it). */
  pMis: number;
  lev: number;
  /** Control lost (the AI acts against its makers). */
  misaligned: boolean;
  /** Exposure E at ASI, the lab's control 1 − E, and the world's tolerance θ_w (model v3 E9; safety/control.ts). */
  exposure: number; control: number; threshold: number;
}

/**
 * Resolve lab X reaching ASI (§5.2; model v3 E9, MODEL-V3 §11.4): no roll. Control is lost when X's exposure at ASI
 * exceeds the world's tolerance θ_w (safety/control.ts lossThreshold). The player's exposure is its effective-control
 * process (Mis · (1 − oversight) · (1 + footholds) of its ASI model, asiControl); rivals and China keep
 * their simplified model: exposure = their misalignment index (their posture acts through their traits, as before; no
 * fleets or footholds). A lost ASI is contained (asiContested) when containK · Cont · (1 − leverage) ≥ 1 − θ_w/E, the
 * share of its exposure beyond the tolerance.
 */
export function resolveAsi(s: GameStateV2, lab: LabId): AsiResolution {
  const mis = misOf(s, lab);
  const pMis = pMisOf(s, mis);
  const lev = clamp(leverage(s, lab), 0, 1);
  const cont = lab === 'player' ? playerContain(s) : otherContain(s, lab);
  const exposure = lab === 'player' ? asiControl(s)?.exposure ?? 0 : mis;
  const threshold = lossThreshold(s);
  const misaligned = exposure > threshold;
  const out = { mis, pMis, lev, misaligned, exposure, control: clamp(1 - exposure, 0, 1), threshold };
  if (misaligned) {
    const contained = CONTROL.containK * cont * (1 - lev) >= 1 - threshold / exposure;
    const id: EndingV2['id'] = contained ? 'asiContested' : lab === 'player' ? 'asiTakeover' : lab === 'china' ? 'chinaTakeover' : 'rivalTakeover';
    return { id, power: 'none', ...out };
  }
  const id: EndingV2['id'] = lab === 'player' ? 'asiAligned' : lab === 'china' ? 'chinaAligned' : 'rivalAligned';
  return { id, power: alignedPower(s, lab), ...out };
}

/** A competitor's projected ASI in a company-loss epilogue: lost when its projected Mis exceeds θ_w (the rivals'
 *  simplified rule, as resolveAsi). */
export const epilogueLost = (s: GameStateV2, misAtAsi: number) => misAtAsi > lossThreshold(s);

/** The leading competitor among active non-player labs (by TRUE internal frontier). */
export function leadingCompetitor(s: GameStateV2): LabId | undefined {
  let best: LabId | undefined;
  let g = -Infinity;
  for (const r of otherLabs(s)) {
    if (r.core.status !== 'active') continue;
    const x = bestG(s, r.core.id);
    if (x > g) {
      g = x;
      best = r.core.id;
    }
  }
  return best;
}

/** Fast-simulate the leading competitor to ASI and report its hidden outcome inputs (§5.1 #9). */
export function runEpilogue(s: GameStateV2): EndingV2['epilogue'] {
  const X = leadingCompetitor(s);
  if (!X) return {};
  const { mis, days } = projectedMisAtAsi(s, X);
  return { asiDay: s.time.day + days, asiLab: X, misAtAsi: Math.round(mis * 1000) / 1000, leverageAtAsi: Math.round(clamp(leverage(s, X), 0, 1) * 1000) / 1000 };
}
