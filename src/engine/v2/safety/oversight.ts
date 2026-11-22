// Oversight in capability gaps (model v3 E6; MODEL-V3 §11.3, §11.5–11.6; research/20 F4). Owner: WS2.
//
// The capability of an overseen model and of its overseer is read in OOM of effective compute on the display level
// map λ(G): a level L converts to x = λ⁻¹(L) − G_V0 (OOM above the start model). Gaps between models are differences
// of x; a 400-Elo gap (Engels et al. 2025) is OOM_PER_400_ELO of them (data/v2/oversight.ts states the conversion).
// This replaces every read of the research multiplier M (v2's mAtLevel / versionM, now deleted) in the safety code.
//
// The hooks for later tasks (E4 successor pull, E7 covert acts measured against the overseer's level):
//   oversightGap(w, L_overseen, L_overseer)   gap in OOM, levels and Elo
//   monitorCatchAt(gapOom)                    a monitor's catch rate at that gap (Engels Backdoor Code)
//   internalOversight(s, v, trait)            (safety/incidents.ts) the internal fleet's oversight of model v: monitor,
//                                             human review, control deferral and containment, as one readout
import {
  CONTROL_DEFER, CONTROL_GAP_FULL, ELO_PER_OOM, GREENBLATT_TM, HUMAN_REVIEW_L, MONITOR_ANCHOR, MONITOR_CATCH_BASE, OOM_PER_400_ELO,
} from '../../../data/v2/oversight';
import { gOfLevel, gV0, levelOfG } from '../models/capability';
import { measuredLOf } from '../models/labs';
import type { GameStateV2, ModelVersion, TimelineWorld } from '../types';

/** λ⁻¹: effective compute (OOM above the start model V0) of a model at display level L: gOfLevel(L) − G_V0, the one
 *  level map (models/capability.ts; RD-U02). Exact inverse of levelOfG on [0, 15); L ≥ 15 maps to the ASI knot, as λ
 *  caps. Clamping below 0: gOfLevel clamps L < 0 to 0 (λ itself never goes below 0), where the old duplicate extended
 *  the first slope linearly; no caller passes a negative level (levels come from λ or from grids ≥ 0). */
export const oomOfLevel = (w: TimelineWorld, L: number): number => gOfLevel(w, L) - gV0(w);

/** λ: display level of a model x OOM above the start model (capped at 15). */
export const levelOfOom = (w: TimelineWorld, x: number) => levelOfG(w, gV0(w) + x);

/** TRUE capability of a version in OOM above V0: its true G − G_V0 (RD-U02: reads G instead of λ⁻¹(λ(G)), which capped
 *  every model past the ASI knot at one value). Equal to the old value on λ ∈ [0, 15). Engine only. */
export function versionOom(s: GameStateV2, v: ModelVersion | undefined): number {
  return v ? v.G - gV0(s.hidden.timeline) : 0;
}

/** Believed capability of a version in OOM above V0 (from its measured level; lineage fallback while evaluating). */
export function measuredOom(s: GameStateV2, v: ModelVersion | undefined): number {
  return oomOfLevel(s.hidden.timeline, measuredLOf(s, v).L);
}

export interface OversightGap {
  /** Capability gap overseen − overseer in OOM of effective compute (≥ 0). */
  oom: number;
  /** The same gap in display levels (≥ 0). */
  levels: number;
  /** Chatbot-Arena-Elo equivalent (Engels et al. 2025's unit). */
  elo: number;
}

/** Gap between an overseen model at level `overseenL` and its overseer at `overseerL` (a monitor model, a tool's
 *  validation level, human reviewers). A stronger overseer has no gap (0). */
export function oversightGap(w: TimelineWorld, overseenL: number, overseerL: number): OversightGap {
  const oom = Math.max(0, oomOfLevel(w, overseenL) - oomOfLevel(w, overseerL));
  return { oom, levels: Math.max(0, overseenL - overseerL), elo: oom * ELO_PER_OOM };
}

/** Catch rate of a monitor at a capability gap (OOM): log-linear from MONITOR_CATCH_BASE at no gap to Engels' Backdoor
 *  Code rate (10%) at a 400-Elo gap: 0.85 · (0.10/0.85)^(gap ÷ 6.8). */
export function monitorCatchAt(gapOom: number): number {
  return MONITOR_CATCH_BASE * Math.pow(MONITOR_ANCHOR / MONITOR_CATCH_BASE, Math.max(0, gapOom) / OOM_PER_400_ELO);
}
/** The same rule as a factor (1 at no gap): how much of an overseer's no-gap catch survives the gap. */
export const gapFactor = (gapOom: number) => monitorCatchAt(gapOom) / MONITOR_CATCH_BASE;

/** Human review's factor on model v (TRUE level): 1 while the model is no more capable than expert humans (L 10), then
 *  the monitor rule on the gap. */
export function humanReviewFactor(s: GameStateV2, v: ModelVersion): number {
  return gapFactor(oversightGap(s.hidden.timeline, v.Lg, HUMAN_REVIEW_L).oom);
}

// ───────────────────────────── control tax (Greenblatt et al. 2023) ─────────────────────────────

function lerpTable(d: number, key: 'safety' | 'usefulness'): number {
  const T = GREENBLATT_TM;
  if (d <= T[0].d) return T[0][key];
  for (let i = 0; i < T.length - 1; i++) if (d <= T[i + 1].d) return T[i][key] + ((T[i + 1][key] - T[i][key]) * (d - T[i].d)) / (T[i + 1].d - T[i].d);
  return T[T.length - 1][key];
}

/** Whether the lab's internal work runs under control protocols (the AG07 control layer on a live internal deployment). */
export function underControl(s: GameStateV2): boolean {
  return s.player.deployments.some((d) => d.channel === 'internal' && d.status === 'live' && d.controlLayer);
}

export interface ControlReadout {
  on: boolean;
  /** Share of actions deferred to the trusted model. */
  defer: number;
  /** AI labour kept (multiplier on the use's effective AI labour) and the tax 1 − usefulness. */
  usefulness: number;
  tax: number;
  /** Multiplier on the share of acts that slip past the monitors (Greenblatt's safety at d vs at 0). */
  missMult: number;
  /** Gap watched model − trusted model (OOM) that sets the per-deferral loss. */
  gapOom: number;
}

export const NO_CONTROL: ControlReadout = { on: false, defer: 0, usefulness: 1, tax: 0, missMult: 1, gapOom: 0 };

/**
 * Control protocol on a watched model with a trusted model (MODEL-V3 §11.6, research/20 F4): trusted monitoring with
 * defer-to-trusted at d = CONTROL_DEFER. Usefulness = U(0) − (U(0) − U(d)) · min(1, gap ÷ 1 OOM) (Greenblatt's
 * table: 97% at d = 0 for audits and false alarms, 93% at d = 10% with GPT-3.5 trusted for GPT-4, about 1 OOM weaker;
 * deferring to a model as capable as the watched one loses nothing extra). Acts slipping past the monitor × (1 −
 * S(d)) ÷ (1 − S(0)) = 0.17/0.38. With no trusted model the deferred actions go to humans: the full loss.
 */
export function controlProtocol(gapOom: number | undefined, defer = CONTROL_DEFER): ControlReadout {
  const u0 = lerpTable(0, 'usefulness');
  const ud = lerpTable(defer, 'usefulness');
  const f = gapOom === undefined ? 1 : Math.min(1, Math.max(0, gapOom) / CONTROL_GAP_FULL);
  const usefulness = u0 - (u0 - ud) * f;
  const missMult = (1 - lerpTable(defer, 'safety')) / (1 - lerpTable(0, 'safety'));
  return { on: true, defer, usefulness, tax: 1 - usefulness, missMult, gapOom: gapOom ?? CONTROL_GAP_FULL };
}

/** Control on one internal use (its model watched, its monitor the trusted model; a copy of itself = no gap). Measured
 *  levels: the tax is a design readout. Off when the control layer is off. */
export function useControl(s: GameStateV2, model: ModelVersion | undefined, monitor: ModelVersion | undefined): ControlReadout {
  if (!underControl(s) || !model) return NO_CONTROL;
  const w = s.hidden.timeline;
  const gap = monitor ? oversightGap(w, measuredLOf(s, model).L, measuredLOf(s, monitor).L).oom : undefined;
  return controlProtocol(gap);
}
