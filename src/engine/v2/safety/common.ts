// Shared helpers for the safety modules (V2-SPEC §3.5). Owner: WS2.
// Engine-side only: several helpers read truth (efficacy); capability for oversight is in safety/oversight.ts (model
// v3 E6: OOM of effective compute, no research multiplier). UI code reads safety/view.ts selectors instead.
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { LEVEL_KNOTS } from '../../../data/v2/calibration';
import { gV0, levelOfG } from '../models/capability';
import { bestPlayerVersion } from '../models/labs';
import type { AgendaId, GameStateV2, ModelVersion } from '../types';

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** Capability tier 0..6 from a level: number of milestone level knots crossed above Agent (fractional). */
export function tierOfLevel(L: number): number {
  const K = LEVEL_KNOTS;
  if (L <= K[0]) return 0;
  for (let i = 0; i < K.length - 1; i++) if (L < K[i + 1]) return i + (L - K[i]) / (K[i + 1] - K[i]);
  return K.length - 1;
}

export function versionById(s: GameStateV2, id: string | undefined): ModelVersion | undefined {
  if (!id) return undefined;
  return s.player.models.versions.find((v) => v.id === id);
}

export function adopted(s: GameStateV2, paradigm: string): boolean {
  return s.player.paradigms[paradigm]?.status === 'adopted';
}

/** Red flags (§4.2 E17): the traits whose measured belief is a red line, and the line: estimate above 30% with clarity
 *  above 0.4 (what the player's own evals and probes show, never the truth). E17 fires on the internal model's. The
 *  nonprofit PBC's safety committee uses the same traits at a stricter estimate (FINANCE-V3 §7.2, FIN3b: finance/charter). */
export const RED_FLAG_TRAITS = ['SCHEME', 'AF', 'SAND'] as const;
export const RED_FLAG = { est: 0.3, clarity: 0.4 } as const;
export function redFlags(v: Pick<ModelVersion, 'beliefs'>, minEst: number = RED_FLAG.est): { trait: (typeof RED_FLAG_TRAITS)[number]; est: number }[] {
  const out: { trait: (typeof RED_FLAG_TRAITS)[number]; est: number }[] = [];
  for (const t of RED_FLAG_TRAITS) {
    const b = v.beliefs[t];
    if (b && b.est > minEst && b.clarity > RED_FLAG.clarity) out.push({ trait: t, est: b.est });
  }
  return out;
}

/** WS2 flags live under s.flags['ws2.<name>'] (plain JSON). */
export function flag(s: GameStateV2, name: string): number | boolean | string | undefined {
  return s.flags[`ws2.${name}`];
}
export function flagNum(s: GameStateV2, name: string, dflt = 0): number {
  const v = s.flags[`ws2.${name}`];
  return typeof v === 'number' ? v : dflt;
}
export function setFlag(s: GameStateV2, name: string, v: number | boolean | string) {
  s.flags[`ws2.${name}`] = v;
}

/** Known change of λ2 caused by the player's own choices (§3.5.1): −2 latent reasoning, −0.5 > 2 CoT-pressured runs. */
export function lambda2Delta(s: GameStateV2): number {
  const latent = s.player.models.versions.some((v) => v.status !== 'retired' && v.status !== 'rolledBack' && v.design.cot === 'latent');
  let pressured = 0;
  for (const r of s.player.models.runs) if (r.status === 'done' && r.post?.cot === 'pressured') pressured++;
  return -2 * (latent ? 1 : 0) - 0.5 * (pressured > 2 ? 1 : 0);
}

/** TRUE agenda efficacy including the player's λ2 shift on λ2-loaded agendas (§3.5.1). Engine only. */
export function trueEfficacy(s: GameStateV2, ag: AgendaId): number {
  const e = s.hidden.agendaEfficacy[ag] ?? 0;
  const load = AGENDA_BY_ID[ag].loadings.cotLoadBearing ?? 0;
  return clamp01(e + load * lambda2Delta(s));
}

/** BELIEVED efficacy: posterior mean plus the known λ2 shift. Safe for UI and for U. */
export function believedEfficacy(s: GameStateV2, ag: AgendaId): number {
  const p = s.player.safety.agendas[ag].posterior;
  const load = AGENDA_BY_ID[ag].loadings.cotLoadBearing ?? 0;
  return clamp01(p.a / (p.a + p.b) + load * lambda2Delta(s));
}

/** Copy a trait record (plain JSON). */
export function copyRec<T extends object>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

/** The lab's capability tier input (lineage priors SA / EA, U-mode presence at SC, E15's CoT controllability): the
 *  display level λ(G) of its best live model (V0's G before any; L 5 at the start). Model v3 E18: was F3's
 *  pa-equivalent λ(G(V0) + B·(pa₀ − pm(V0)) + the stacks' G-equivalent), the old know-how readout written in G, which led
 *  the best model by +1.2 L at the start (6.2 vs 5.0) and lagged it after a new base (up to −1.3 L). */
export const labLevel = (s: GameStateV2) => {
  const w = s.hidden.timeline;
  return levelOfG(w, bestPlayerVersion(s)?.G ?? gV0(w));
};
