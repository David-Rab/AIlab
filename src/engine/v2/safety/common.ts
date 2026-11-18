// Shared helpers for the safety modules (V2-SPEC §3.5). Owner: WS2.
// Engine-side only: several helpers read truth (pm, efficacy). UI code reads safety/view.ts selectors instead.
import { AGENDA_BY_ID } from '../../../data/v2/agendas';
import { LEVEL_KNOTS } from '../../../data/v2/calibration';
import { multiplierAt } from '../../../data/world';
import type { World } from '../../types';
import { levelOf, thresholds } from '../world/calibration';
import type { AgendaId, GameStateV2, ModelVersion, TimelineWorld } from '../types';

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

const asV1 = (w: TimelineWorld) => w as unknown as World;

/** AI R&D multiplier at true progress pm (reference curve at q = pm + calShift, the v1-equivalent progress; §3.5.6
 *  "M of the overseen version"). Engine only. */
export function mAtPm(w: TimelineWorld, pm: number): number {
  return Math.max(1, multiplierAt(asV1(w), pm + w.calShift));
}

/** Overseen version's M (hidden pm). Engine only. */
export function versionM(s: GameStateV2, v: ModelVersion | undefined): number {
  if (!v) return s.player.prodCache?.M ?? 1;
  return mAtPm(s.hidden.timeline, v.pm);
}

// Level → M table on a 0.05 grid (§3.5.7 "convert L → pm → M with multiplierAt"). Cached per world object.
const L_STEP = 0.05;
const L_N = Math.round(15 / L_STEP) + 1;
const levelTables = new WeakMap<TimelineWorld, Float64Array>();

function pmAtLevel(w: TimelineWorld, L: number): number {
  const th = thresholds(w);
  let lo = th[0] - 8;
  let hi = th[th.length - 1] + 0.5;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (levelOf(w, mid) < L) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** M at a general level L (0..15) for this world. Monotone in L. Uses only the public level↔progress mapping. */
export function mAtLevel(w: TimelineWorld, L: number): number {
  let t = levelTables.get(w);
  if (!t) {
    t = new Float64Array(L_N);
    for (let i = 0; i < L_N; i++) t[i] = mAtPm(w, pmAtLevel(w, i * L_STEP));
    for (let i = 1; i < L_N; i++) t[i] = Math.max(t[i], t[i - 1]);
    levelTables.set(w, t);
  }
  const x = clamp(L, 0, 15) / L_STEP;
  const i = Math.min(L_N - 2, Math.floor(x));
  const f = x - i;
  return t[i] + (t[i + 1] - t[i]) * f;
}

/** Capability tier 0..6 from a level: number of milestone level knots crossed above Agent (fractional). */
export function tierOfLevel(L: number): number {
  const K = LEVEL_KNOTS;
  if (L <= K[0]) return 0;
  for (let i = 0; i < K.length - 1; i++) if (L < K[i + 1]) return i + (L - K[i]) / (K[i + 1] - K[i]);
  return K.length - 1;
}

/** Milestone level for SC (index 3). */
export const SC_LEVEL = LEVEL_KNOTS[3];

export function versionById(s: GameStateV2, id: string | undefined): ModelVersion | undefined {
  if (!id) return undefined;
  return s.player.models.versions.find((v) => v.id === id);
}

export function adopted(s: GameStateV2, paradigm: string): boolean {
  return s.player.paradigms[paradigm]?.status === 'adopted';
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

export { levelOf };
