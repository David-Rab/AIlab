// SR-05: one "which model" rule and one colour scale for every safety view (src/ui/v2 panels Safety, SafetyControl,
// Danger, RiskSources). The full SAFETY UI comes later (SR-25..30); this only makes the existing views agree.
import { internalVersion, versionById } from '../../engine/v2';
import type { GameStateV2, ModelVersion } from '../../engine/v2';
import { store } from './store';
import { C } from './theme';

/** The model a safety view reads: the one the view names (an incident's, a control layer's, a foothold's maker), else
 *  the model the player selected, else the latest frontier model in use (the capability lane's internal model). */
export function safetyModel(s: GameStateV2, named?: string): ModelVersion | undefined {
  return versionById(s, named) ?? versionById(s, store.sel.versionId) ?? internalVersion(s);
}

/** Quantities the safety views colour, each with its watch / bad thresholds on the one good → watch → bad scale:
 *  prob = a believed probability (loss-of-control risk, risk sources: < 5% / 5–20% / > 20%); level = a believed trait or
 *  misalignment level 0–1 (bad at the published danger line 0.4, watch at half of it); factor = a 0–1 factor of a harmful act (would try, able to, chances; stop rate good-up);
 *  rate = acts per year; pull = the successor pull ω. */
export const RISK_BANDS = {
  prob: [0.05, 0.2], level: [0.2, 0.4], factor: [0.3, 0.6], rate: [0.1, 0.5], pull: [0.1, 0.3],
} as const satisfies Record<string, readonly [number, number]>;
export type RiskKind = keyof typeof RISK_BANDS;
export type RiskTone = 'good' | 'watch' | 'bad';

/** Where x falls on the scale (goodUp: a protective quantity such as a stop rate, read as 1 − x). */
export function riskTone(x: number, kind: RiskKind, goodUp = false): RiskTone {
  const v = goodUp ? 1 - x : x;
  const [lo, hi] = RISK_BANDS[kind];
  return v >= hi ? 'bad' : v >= lo ? 'watch' : 'good';
}
/** The scale's colour for x (theme C.good / C.watch / C.bad). */
export const riskColor = (x: number, kind: RiskKind, goodUp = false): string => C[riskTone(x, kind, goodUp)];
/** The scale's text class for x (good is plain unless `goodClass` is given). */
export const riskClass = (x: number, kind: RiskKind, goodClass = ''): string => {
  const t = riskTone(x, kind);
  return t === 'bad' ? 'tone-neg' : t === 'watch' ? 'tone-warn' : goodClass;
};
/** The scale as gauge zones (upper bound and colour per zone). */
export const riskZones = (kind: RiskKind) => [{ to: RISK_BANDS[kind][0], color: C.good }, { to: RISK_BANDS[kind][1], color: C.watch }, { to: 1, color: C.bad }];
