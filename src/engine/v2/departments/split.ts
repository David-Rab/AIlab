// Compute split across pools (V2-SPEC §3.4.2). Owner: WS1.
//
// The player sets five top-level shares that sum to 1: Training, Research, Engineering, Serving, Safety.
//   Training = training runs + data generation (synthetic data; the data-generation share is a sub-slider).
//   Research = experiments + research agents (routine + frontier). The experiments share of it is the player's own
//              setting (RD-A02, DD-11: no Auto mix); the default is the reference lab's start, 5 : 2.4 (≈ 68% experiments).
//   Engineering = engineering agents (coding for the build queue), their own line since RD-A02 (it was a share of the
//              research agents); the default is the reference lab's 20% of its agent compute (0.6% of compute at start).
// Internally the split keeps seven pools (training, experiments, agents, synthetic, serving, safety, engineering).
// AI 2027's usage table has no security compute line (research/11 #25): security is a $-spend lever only.
import { SHARE_REF } from '../../../data/v2/calibration';
import { ENG_REF_SHARE } from '../../../data/v2/agents';
import type { ComputeSplit, GameStateV2 } from '../types';

export const SPLIT_KEYS: (keyof ComputeSplit)[] = ['training', 'experiments', 'agents', 'synthetic', 'serving', 'safety', 'engineering'];

/** The five player-facing groups. */
export const TOP_KEYS = ['training', 'research', 'engineering', 'serving', 'safety'] as const;
export type TopKey = (typeof TOP_KEYS)[number];
export type TopSplit = Record<TopKey, number>;
/** A full player split: top-level shares, data generation share of Training, experiments share of Research. */
export interface SplitSpec { top: TopSplit; dataShare: number; expShare: number }

/** Reference shares at a decimal year (linear interpolation, held constant outside the table). AI 2027's table has no
 *  engineering line: `engineering` is 0 and `agents` all agent compute (the other labs' split; the player's is
 *  playerShareRef). */
export function shareRefAt(year: number): ComputeSplit {
  const t = SHARE_REF;
  if (year <= t[0].year) return { ...t[0].share, engineering: 0 };
  for (let i = 0; i < t.length - 1; i++) {
    if (year <= t[i + 1].year) {
      const f = (year - t[i].year) / (t[i + 1].year - t[i].year);
      const out = { engineering: 0 } as ComputeSplit;
      for (const k of SPLIT_KEYS) if (k !== 'engineering') out[k] = t[i].share[k] + f * (t[i + 1].share[k] - t[i].share[k]);
      return out;
    }
  }
  return { ...t[t.length - 1].share, engineering: 0 };
}

/** RD-A02: the player's reference split: shareRefAt with the reference lab's engineering share of its agent compute
 *  (ENG_REF_SHARE) on its own engineering line, the rest research agents. */
export function playerShareRef(year: number): ComputeSplit {
  const r = shareRefAt(year);
  return { ...r, agents: r.agents * (1 - ENG_REF_SHARE), engineering: r.agents * ENG_REF_SHARE };
}

/** Normalise to sum 1 (negative entries clamp to 0). */
export function normalizeSplit(sp: ComputeSplit): ComputeSplit {
  const out = {} as ComputeSplit;
  let sum = 0;
  for (const k of SPLIT_KEYS) sum += Math.max(0, sp[k] ?? 0);
  for (const k of SPLIT_KEYS) out[k] = sum > 0 ? Math.max(0, sp[k] ?? 0) / sum : 1 / SPLIT_KEYS.length;
  return out;
}

/** Set some pools to fixed shares and rescale the others proportionally so the split sums to 1. */
export function withFixed(base: ComputeSplit, fixed: Partial<ComputeSplit>): ComputeSplit {
  const fixedSum = Object.values(fixed).reduce((a, x) => a + (x ?? 0), 0);
  const free = SPLIT_KEYS.filter((k) => fixed[k] === undefined);
  const freeSum = free.reduce((a, k) => a + base[k], 0);
  const out = { ...base, ...fixed } as ComputeSplit;
  for (const k of free) out[k] = freeSum > 0 ? (base[k] / freeSum) * Math.max(0, 1 - fixedSum) : 0;
  return normalizeSplit(out);
}

/** Experiments share of Research: the slider's range. An engine range, not a UI-only cap: it keeps a little of both,
 *  since with no experiment compute a project's experiment CES gives ~0 throughput, and with no agent compute the
 *  research agents stop. */
export const MIX_RANGE: readonly [number, number] = [0.01, 0.99];

const ratio = (a: number, b: number, dflt: number) => (a + b > 1e-12 ? a / (a + b) : dflt);

/** Top-level view of a pool split. */
export function topOf(sp: ComputeSplit): TopSplit {
  return { training: sp.training + sp.synthetic, research: sp.experiments + sp.agents, engineering: sp.engineering ?? 0, serving: sp.serving, safety: sp.safety };
}

/** Player-facing spec of a pool split. */
export function specOf(sp: ComputeSplit): SplitSpec {
  return { top: topOf(sp), dataShare: ratio(sp.synthetic, sp.training, 1 / 3), expShare: ratio(sp.experiments, sp.agents, EXP_SHARE_DEFAULT) };
}

/** Pool split from a spec (top-level shares normalised to 1; sub-shares clamped to [0, 1]). */
export function fromSpec(spec: SplitSpec): ComputeSplit {
  const t = spec.top;
  const sum = TOP_KEYS.reduce((a, k) => a + Math.max(0, t[k]), 0) || 1;
  const n = (k: TopKey) => Math.max(0, t[k]) / sum;
  const ds = Math.min(1, Math.max(0, spec.dataShare));
  const es = Math.min(MIX_RANGE[1], Math.max(MIX_RANGE[0], spec.expShare));
  return {
    training: n('training') * (1 - ds), synthetic: n('training') * ds,
    experiments: n('research') * es, agents: n('research') * (1 - es),
    serving: n('serving'), safety: n('safety'), engineering: n('engineering'),
  };
}

/** Default experiments share of Research (RD-A02): the reference lab's at the start, 5% experiments : 2.4% research
 *  agents (data/v2/calibration.ts SHARE_REF less ENG_REF_SHARE). */
export const EXP_SHARE_DEFAULT = 0.05 / (0.05 + 0.03 * (1 - ENG_REF_SHARE));

export const SPLIT_PRESETS = ['reference', 'race', 'balanced', 'safety'] as const;
export type SplitPreset = (typeof SPLIT_PRESETS)[number];

/** Set some top-level groups to fixed shares and rescale the others proportionally so the split sums to 1. */
function withFixedTop(base: TopSplit, fixed: Partial<TopSplit>): TopSplit {
  const fixedSum = Object.values(fixed).reduce((a, x) => a + (x ?? 0), 0);
  const free = TOP_KEYS.filter((k) => fixed[k] === undefined);
  const freeSum = free.reduce((a, k) => a + base[k], 0);
  const out = { ...base, ...fixed } as TopSplit;
  for (const k of free) out[k] = freeSum > 0 ? (base[k] / freeSum) * Math.max(0, 1 - fixedSum) : 0;
  return out;
}

/** One-click presets (§3.4.2) at decimal year `yr`; they set the top-level shares and keep the sub-shares. [D] */
export function presetTop(preset: SplitPreset, yr: number): TopSplit {
  const ref = topOf(playerShareRef(yr));
  switch (preset) {
    case 'race': {
      // Safety 1%, serving −30%; the freed compute goes to training and research (engineering keeps its share).
      const freed = ref.safety - 0.01 + ref.serving * 0.3;
      const tr = ref.training + ref.research;
      return { safety: 0.01, serving: ref.serving * 0.7, engineering: ref.engineering, training: ref.training + (freed * ref.training) / tr, research: ref.research + (freed * ref.research) / tr };
    }
    case 'balanced':
      return withFixedTop(ref, { safety: 0.06 });
    case 'safety':
      return withFixedTop(ref, { safety: 0.15, serving: ref.serving * 0.7 });
    default:
      return ref;
  }
}

/** Pool split of a preset, keeping the player's current sub-shares. */
export function presetSplit(preset: SplitPreset, yr: number, cur?: ComputeSplit): ComputeSplit {
  const sub = specOf(cur ?? playerShareRef(yr));
  return fromSpec({ top: presetTop(preset, yr), dataShare: sub.dataShare, expShare: sub.expShare });
}

/** Apply a split for the player (normalised to 1). Any split is allowed (LIMITS: the old floors of 2% training with runs and 3% serving with products are
 *  gone): runs with no training compute show "paused: no training compute" (runStall), products with no serving show
 *  capacity-bound. Returns undefined (kept for callers that treat a string as a rejection). */
export function setSplit(s: GameStateV2, sp: ComputeSplit): string | undefined {
  s.player.split = normalizeSplit(sp);
  return undefined;
}
