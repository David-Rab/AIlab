// Safety ideas acting on the safety mechanisms (model v3 E13; data and sources: data/v2/safetyIdeas.ts). Owner: WS2.
//   P14 probeSteer / steerGrowth / probeGoodhart   the post-training trait step and the WB masks (traits.ts)
//   P15 aiOversight                                  suite hardening (models/suites.ts)
//   P23 cotResist                                    S4, COT masks (traits.ts) and CoT controllability (detection.ts)
//   P27 aarAuto (+ P27_AAR.fitOom in workfit.ts)     the safety AI labour of research lines (lineProjects.ts)
//   F44 aarFindingOom (model v3 E14)                 the safety model's fit on the benchmarked agendas' lines (lineProjects.ts)
//   AG17's harness (workfit.ts ag17HarnessOom, E14)  the safety package's SAF_* fit from AG17's science teams
import { COPY_COLLUSION } from '../../../data/v2/features';
import { F44_AAR, FAITHFUL_COT, P14_STEER, P15_OVERSIGHT, P27_AAR } from '../../../data/v2/safetyIdeas';
import { TRAIT_ORDER } from '../../../data/v2/traits';
import { safetyLabour } from '../departments/workfit';
import { internalVersion } from '../models/labs';
import { sameLineage } from '../models/products';
import type { AgendaId, GameStateV2, ModelVersion, PostDesign, TechniqueState, TraitId } from '../types';
import { adopted, clamp01, flag } from './common';
import { combineTools, familyPenalty } from './detection';
import { measuredOom, versionOom } from './oversight';
import { believedMask, strengthBelieved, strengthTrue, techniqueRole } from './techniques';
import { agentVersion } from '../departments/agents';

// ───────────────────────────── P14 interp-guided training ─────────────────────────────

/** Traits a run can steer: every trait the trait step grows (HONEST and CORRIG are set by the brackets). */
const STEERABLE: TraitId[] = TRAIT_ORDER.filter((t) => t !== 'HONEST' && t !== 'CORRIG');

const wbTools = (s: GameStateV2): TechniqueState[] =>
  Object.values(s.player.safety.techniques).filter((t) => t.unlocked && t.active && t.family === 'WB' && techniqueRole(t) !== 'fix');

/**
 * P14: the white-box probes' detection d_t of each trait on version v (the new model as training meets it): the active
 * WB detect tools' coverage × strength at v's capability (E6: decays in OOM above V0), combined as correlated tools, ×
 * the WB family penalty (masks, hidden U-modes). `believed`: posterior efficacy, measured capability and the player's
 * own masks (the run card and predicted beliefs). Empty unless P14 is adopted.
 */
export function probeSteer(s: GameStateV2, v: ModelVersion, believed = false): Partial<Record<TraitId, number>> {
  const out: Partial<Record<TraitId, number>> = {};
  if (!adopted(s, 'P14')) return out;
  const tools = wbTools(s);
  if (!tools.length) return out;
  const X = believed ? measuredOom(s, v) : versionOom(s, v);
  const str = tools.map((t) => (believed ? strengthBelieved(s, t, X) : strengthTrue(s, t, X)));
  const seen = believed ? 1 - believedMask(s, 'WB', false) : 1;
  for (const trait of STEERABLE) {
    const items: { agenda: string; d: number }[] = [];
    tools.forEach((t, i) => {
      const cov = t.coverage[trait] ?? 0;
      if (cov > 0 && str[i] > 0) items.push({ agenda: t.agenda, d: cov * str[i] });
    });
    if (!items.length) continue;
    const d = clamp01(combineTools(items) * (believed ? seen : familyPenalty(s, v, trait, 'WB')));
    if (d > 0) out[trait] = d;
  }
  return out;
}

/** P14 growth multipliers for the trait step: 1 − k·d_t. */
export function steerGrowth(d: Partial<Record<TraitId, number>>): Partial<Record<TraitId, number>> {
  const out: Partial<Record<TraitId, number>> = {};
  for (const [t, x] of Object.entries(d) as [TraitId, number][]) out[t] = clamp01(1 - P14_STEER.k * x);
  return out;
}

/** P14 Goodhart: the steered version's WB mask on each steered trait rises by mask·d_t (E24's mask mechanism). */
export function probeGoodhart(v: ModelVersion, d: Partial<Record<TraitId, number>>): void {
  for (const [t, x] of Object.entries(d) as [TraitId, number][]) {
    const m = (v.masks[t] ??= {});
    m.WB = clamp01(1 - (1 - (m.WB ?? 0)) * (1 - P14_STEER.mask * x));
  }
}

// ───────────────────────────── P15 AI-assisted oversight ─────────────────────────────

export interface AiOversight {
  /** AI share of the safety engineering work (E2: Trusted to AI × the safety model's SAF_EXP coverage). */
  A: number;
  /** The critic shares the lineage of the model the suites train (the internal model): same-lineage collusion. */
  collusion: boolean;
  /** A after collusion (the part whose critiques count). */
  Aeff: number;
  /** Multipliers on a hardening pass's cash and on its cut. */
  cashMult: number;
  cutMult: number;
}
export const NO_AI_OVERSIGHT: AiOversight = { A: 0, collusion: false, Aeff: 0, cashMult: 1, cutMult: 1 };

/** P15 on a suite hardening pass today (1, 1 without P15 or without safety work handed to AI). */
export function aiOversight(s: GameStateV2): AiOversight {
  if (!adopted(s, 'P15')) return NO_AI_OVERSIGHT;
  const A = safetyLabour(s).exp.A;
  if (A <= 0) return NO_AI_OVERSIGHT;
  const critic = agentVersion(s, 'safety');
  const policy = internalVersion(s);
  const collusion = !!critic && !!policy && sameLineage(critic, policy);
  const lock = s.player.safety.techniques['T-LOCK'];
  const pen = collusion ? COPY_COLLUSION * (lock?.unlocked && lock.active ? 0.5 : 1) : 0;
  const Aeff = A * (1 - pen);
  return { A, collusion, Aeff, cashMult: 1 - A * (1 - P15_OVERSIGHT.aiCostRatio), cutMult: 1 + P15_OVERSIGHT.criticGain * Aeff };
}

// ───────────────────────────── P23 faithful-CoT architecture ─────────────────────────────

/** P23: share of CoT pressure and CoT controllability a design's reasoning resists (faithful-by-construction: 0.5). */
export function cotResist(cot: PostDesign['cot'] | undefined): number {
  return cot === 'faithful' ? FAITHFUL_COT.resist : 0;
}

// ───────────────────────────── P27 automated alignment research at scale ─────────────────────────────

/** P27: an agenda's automation factor with the AAR harnesses: Auto' = 1 − (1 − Auto)·(1 − autoGap). */
export function aarAuto(s: GameStateV2, auto: number): number {
  return adopted(s, 'P27') ? 1 - (1 - auto) * (1 - P27_AAR.autoGap) : auto;
}

// ───────────────────────────── F44 AARs mitigate well-characterized failures (model v3 E14) ─────────────────────────────

/** F44: extra SAF_EXP / SAF_IDEAS fit (OOM) of the safety model on agenda ag's line work once the finding is known: the
 *  benchmarked agendas (AG18, AG03, AG16) at best-human level, + gapBM × Δ_bm; 0 elsewhere or before F44. */
export function aarFindingOom(s: GameStateV2, ag: AgendaId): number {
  if (flag(s, 'aar') === undefined || !(F44_AAR.agendas as readonly AgendaId[]).includes(ag)) return 0;
  return F44_AAR.gapBM * s.hidden.timeline.v3.dBM;
}
