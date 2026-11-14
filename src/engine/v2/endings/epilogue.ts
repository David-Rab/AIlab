// Epilogue fast-sim for 'overtaken' and company-loss endings, and ASI resolution for any lab (V2-SPEC §5.1 #9, §5.2).
// Owner: WS4. Rivals and China resolve with THEIR OWN hidden traits — never a coin flip (fixes REDESIGN row 11).
import { clamp, sigmoid } from '../../rng';
import { bestPlayerVersion, bestPm, otherLabs } from '../models/labs';
import { trueEfficacy } from '../safety/common';
import { contain2000 } from '../safety/incidents';
import { misalignment } from '../safety/traits';
import { thresholds } from '../world/calibration';
import { leverage } from '../worldfx/control';
import type { EndingV2, GameStateV2, LabId, PowerOutcome, RivalLab, RngLike } from '../types';
import { keptShare } from '../actors/commitments';
import { effSafety, labOf, leadBetween, paceOf, postureOf, rivalMis, rivalTraitStep } from '../actors/rivals';
import { ws4r } from '../actors/state';

/** P(misaligned | Mis) = σ((Mis − doomThreshold)/0.06) (v1 doom curve, §5.2). */
export const pMisOf = (s: GameStateV2, mis: number) => sigmoid((mis - s.hidden.doomThreshold) / 0.06);

/** Player containment at ASI (§5.2): Cont = Contain(2000) + 0.2·[F32 verified gatekeeper] + 0.1·[AG10 e > 0.6
 *  adopted], clamped 0..1. Contain(2000) is WS2's (control layer × best AG07 tool at M = 2000). The gatekeeper counts
 *  when F32 fired ('ws2.gatekeeper') and T-GATE is in the active stack and real (WS2's exfiltration rule); AG10 is
 *  adopted when the agenda is active and its TRUE efficacy exceeds 0.6. */
export function playerContain(s: GameStateV2): number {
  const gate = s.player.safety.techniques['T-GATE'];
  const f32 = s.flags['ws2.gatekeeper'] !== undefined && !!gate?.unlocked && gate.active && !gate.falseValidated ? 0.2 : 0;
  const ag10 = s.player.safety.agendas.AG10?.status === 'active' && trueEfficacy(s, 'AG10') > 0.6 ? 0.1 : 0;
  return clamp(contain2000(s) + f32 + ag10, 0, 1);
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

/** Projected Mis when lab X reaches ASI: fast-forward its post-training cadence (one step per ~8 weeks) with the
 *  posture-driven trait dynamics, capability rising linearly to ASI. Pure (clones the lab). */
export function projectedMisAtAsi(s: GameStateV2, lab: LabId): { mis: number; days: number } {
  const asiThr = thresholds(s.hidden.timeline)[6];
  const pace = paceOf(s);
  const gap = Math.max(0, asiThr - bestPm(s, lab));
  const days = Math.round((gap / Math.max(0.3, pace)) * 365 * 0.7);
  if (lab === 'player') return { mis: misOf(s, 'player'), days };
  const r0 = labOf(s, lab);
  if (!r0) return { mis: 0, days };
  const r: RivalLab = JSON.parse(JSON.stringify(r0));
  const steps = Math.min(40, Math.floor(days / 56));
  const L0 = r.internal.Lg;
  for (let i = 1; i <= steps; i++) {
    r.internal.Lg = L0 + ((15 - L0) * i) / steps;
    r.pressure = r0.pressure;
    rivalTraitStep(s, r, effSafety(s, r, 0));
  }
  return { mis: rivalMis(r), days };
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

export interface AsiResolution { id: EndingV2['id']; power: PowerOutcome; mis: number; pMis: number; lev: number; misaligned: boolean }

/** Resolve lab X reaching ASI (§5.2), drawing from stream 'endings'. */
export function resolveAsi(s: GameStateV2, lab: LabId, rng: Pick<RngLike, 'chance'>, misOverride?: number): AsiResolution {
  const mis = misOverride ?? misOf(s, lab);
  const pMis = pMisOf(s, mis);
  const lev = clamp(leverage(s, lab), 0, 1);
  const cont = lab === 'player' ? playerContain(s) : otherContain(s, lab);
  const misaligned = rng.chance(pMis);
  if (misaligned) {
    const contained = rng.chance(0.8 * cont * (1 - lev));
    const id: EndingV2['id'] = contained ? 'asiContested' : lab === 'player' ? 'asiTakeover' : lab === 'china' ? 'chinaTakeover' : 'rivalTakeover';
    return { id, power: 'none', mis, pMis, lev, misaligned };
  }
  const id: EndingV2['id'] = lab === 'player' ? 'asiAligned' : lab === 'china' ? 'chinaAligned' : 'rivalAligned';
  return { id, power: alignedPower(s, lab), mis, pMis, lev, misaligned };
}

/** The leading competitor among active non-player labs (by TRUE internal frontier). */
export function leadingCompetitor(s: GameStateV2): LabId | undefined {
  let best: LabId | undefined;
  let pm = -Infinity;
  for (const r of otherLabs(s)) {
    if (r.core.status !== 'active') continue;
    const x = bestPm(s, r.core.id);
    if (x > pm) {
      pm = x;
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
