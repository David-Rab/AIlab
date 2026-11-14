// Compute split across pools (V2-SPEC §3.4.2). Owner: WS1.
import { SHARE_REF } from '../../../data/v2/calibration';
import type { ComputeSplit, GameStateV2 } from '../types';

export const SPLIT_KEYS: (keyof ComputeSplit)[] = ['training', 'experiments', 'agents', 'synthetic', 'serving', 'safety', 'security'];

/** Reference shares at a decimal year (linear interpolation, held constant outside the table). */
export function shareRefAt(year: number): ComputeSplit {
  const t = SHARE_REF;
  if (year <= t[0].year) return { ...t[0].share };
  for (let i = 0; i < t.length - 1; i++) {
    if (year <= t[i + 1].year) {
      const f = (year - t[i].year) / (t[i + 1].year - t[i].year);
      const out = {} as ComputeSplit;
      for (const k of SPLIT_KEYS) out[k] = t[i].share[k] + f * (t[i + 1].share[k] - t[i].share[k]);
      return out;
    }
  }
  return { ...t[t.length - 1].share };
}

/** Normalise to sum 1 (negative entries clamp to 0). */
export function normalizeSplit(sp: ComputeSplit): ComputeSplit {
  const out = {} as ComputeSplit;
  let sum = 0;
  for (const k of SPLIT_KEYS) sum += Math.max(0, sp[k]);
  for (const k of SPLIT_KEYS) out[k] = sum > 0 ? Math.max(0, sp[k]) / sum : 1 / SPLIT_KEYS.length;
  return out;
}

export const SPLIT_PRESETS = ['reference', 'race', 'balanced', 'safety'] as const;
export type SplitPreset = (typeof SPLIT_PRESETS)[number];

/** Set some pools to fixed shares and rescale the others proportionally so the split sums to 1. */
export function withFixed(base: ComputeSplit, fixed: Partial<ComputeSplit>): ComputeSplit {
  const fixedSum = Object.values(fixed).reduce((a, x) => a + (x ?? 0), 0);
  const free = SPLIT_KEYS.filter((k) => fixed[k] === undefined);
  const freeSum = free.reduce((a, k) => a + base[k], 0);
  const out = { ...base, ...fixed } as ComputeSplit;
  for (const k of free) out[k] = freeSum > 0 ? (base[k] / freeSum) * Math.max(0, 1 - fixedSum) : 0;
  return normalizeSplit(out);
}

/** One-click presets (§3.4.2) at decimal year `yr`. [D] */
export function presetSplit(preset: SplitPreset, yr: number): ComputeSplit {
  const ref = shareRefAt(yr);
  switch (preset) {
    case 'race': {
      // Safety 1%, serving −30%; the freed compute goes to training, experiments and agents.
      const freed = ref.safety - 0.01 + ref.serving * 0.3;
      const tea = ref.training + ref.experiments + ref.agents;
      return withFixed(ref, {
        safety: 0.01, serving: ref.serving * 0.7, synthetic: ref.synthetic, security: ref.security,
        training: ref.training + (freed * ref.training) / tea, experiments: ref.experiments + (freed * ref.experiments) / tea,
        agents: ref.agents + (freed * ref.agents) / tea,
      });
    }
    case 'balanced':
      return withFixed(ref, { safety: 0.06, security: 0.02 });
    case 'safety':
      return withFixed(ref, { safety: 0.15, serving: ref.serving * 0.7, security: 0.02 });
    default:
      return ref;
  }
}

/** Agents pool cap without P20 (§3.4.2). */
export const AGENTS_CAP = 0.35;

/** Validate and apply a split for the player (§3.4.2 constraints). Returns an error string or undefined. */
export function setSplit(s: GameStateV2, sp: ComputeSplit): string | undefined {
  const n = normalizeSplit(sp);
  const p = s.player;
  if (n.agents > AGENTS_CAP + 1e-9 && p.paradigms.P20?.status !== 'adopted') return `Agents capped at ${AGENTS_CAP * 100}% (needs P20)`;
  const reserved = p.deployments.some((d) => d.status === 'live' && d.channel !== 'internal' && d.servingShare > 0);
  if (reserved && n.serving < 0.03) return 'Live deployments need serving compute';
  if (p.models.runs.some((r) => r.status === 'running') && n.training < 0.02) return 'Running runs need training compute';
  p.split = n;
  return undefined;
}
