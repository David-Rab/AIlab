// Compute allocation (V2-SPEC §3.4.2; RD-A05a, SYNTHESIS theme A, SAFETY-REDESIGN §5). Owner: WS1.
//
// ONE flat allocation of the lab's compute to its uses, each a share of total compute; the shares sum to 1, the explicit
// `idle` line included (DD-19: nothing is silently rerouted; what no use takes is shown as idle):
//   training      training runs                       synthetic     data generation (synthetic data)
//   experiments   research experiments                serving       products (inference for customers)
//   engineering   engineering agents (build queue)    routine       routine research agents
//   frontier      frontier research agents            safetyAgents  safety research agents
//   monitors      monitors on the internal fleets (the monitoring budget; coverage = budget ÷ need)
//   safety        safety research: open cases first, the research lines take the rest
//   idle          unallocated
// Before RD-A05a the split was nested (training ⊃ data; research ⊃ experiments / agents ⊃ routine / frontier; safety ⊃
// monitors → safety agents → cases → lines). Every reader reads this one allocation (allocOf / poolsOf).
// The other labs use the same shape (their engineering, safety agents and monitors are 0).
// AI 2027's usage table has no security compute line (research/11 #25): security is a $-spend lever only.
import { SHARE_REF } from '../../../data/v2/calibration';
import { ENG_REF_SHARE, MONITOR_STD_POOL_SHARE, REF_AGENT_SHARES } from '../../../data/v2/agents';
import type { ComputeSplit, GameStateV2, LabId } from '../types';

export const SPLIT_KEYS: (keyof ComputeSplit)[] = [
  'training', 'synthetic', 'experiments', 'routine', 'frontier', 'engineering', 'safetyAgents', 'monitors', 'safety', 'serving', 'idle',
];

/** Player-language name of each use (the Split panel's rows). */
export const SPLIT_LABEL: Record<keyof ComputeSplit, string> = {
  training: 'Training runs', synthetic: 'Data generation', experiments: 'Research experiments', routine: 'Routine research agents',
  frontier: 'Frontier research agents', engineering: 'Engineering agents', safetyAgents: 'Safety research agents', monitors: 'Monitors',
  safety: 'Safety research lines and cases', serving: 'Products (serving)', idle: 'Idle',
};

export const emptySplit = (): ComputeSplit => ({
  training: 0, synthetic: 0, experiments: 0, routine: 0, frontier: 0, engineering: 0, safetyAgents: 0, monitors: 0, safety: 0, serving: 0, idle: 0,
});

/** Research agents' compute (routine + frontier), the aggregate the rivals' research model and fleet readouts use. */
export const researchAgents = (sp: ComputeSplit) => (sp.routine ?? 0) + (sp.frontier ?? 0);

/** The reference lab's routine share of its research-agent compute (0.65 : 0.15). */
const ROUTINE_OF_RESEARCH = REF_AGENT_SHARES.capRoutine / (REF_AGENT_SHARES.capRoutine + REF_AGENT_SHARES.capFrontier);

/** Set the research agents' total, keeping the routine : frontier ratio (reference ratio when both are 0). */
export function withResearchAgents(sp: ComputeSplit, total: number): ComputeSplit {
  const r = researchAgents(sp);
  const f = r > 1e-12 ? sp.routine / r : ROUTINE_OF_RESEARCH;
  return { ...sp, routine: total * f, frontier: total * (1 - f) };
}

/** Reference shares at a decimal year (linear interpolation, held constant outside the table). AI 2027's table has one
 *  agent line (all agent compute; the other labs' engineering stays in it) split routine : frontier at the reference
 *  ratio, and one safety line; engineering, safety agents and monitors 0 (the player's is playerShareRef). */
export function shareRefAt(year: number): ComputeSplit {
  const t = SHARE_REF;
  let row = t[t.length - 1].share;
  if (year <= t[0].year) row = t[0].share;
  else {
    for (let i = 0; i < t.length - 1; i++) {
      if (year <= t[i + 1].year) {
        const f = (year - t[i].year) / (t[i + 1].year - t[i].year);
        const a = t[i].share;
        const b = t[i + 1].share;
        row = {
          training: a.training + f * (b.training - a.training), experiments: a.experiments + f * (b.experiments - a.experiments),
          agents: a.agents + f * (b.agents - a.agents), synthetic: a.synthetic + f * (b.synthetic - a.synthetic),
          serving: a.serving + f * (b.serving - a.serving), safety: a.safety + f * (b.safety - a.safety),
        };
        break;
      }
    }
  }
  return {
    ...emptySplit(), training: row.training, synthetic: row.synthetic, experiments: row.experiments, serving: row.serving, safety: row.safety,
    routine: row.agents * ROUTINE_OF_RESEARCH, frontier: row.agents * (1 - ROUTINE_OF_RESEARCH),
  };
}

/** The player's reference allocation: shareRefAt with the reference lab's engineering share of its agent compute
 *  (ENG_REF_SHARE, RD-A02) on the engineering line and the standard monitoring budget (MONITOR_STD_POOL_SHARE of the
 *  safety line, the pre-RD-A05a default) on the monitors; no safety agents (started by the player). */
export function playerShareRef(year: number): ComputeSplit {
  const r = shareRefAt(year);
  const a = researchAgents(r);
  return {
    ...r, engineering: a * ENG_REF_SHARE, routine: a * REF_AGENT_SHARES.capRoutine, frontier: a * REF_AGENT_SHARES.capFrontier,
    monitors: r.safety * MONITOR_STD_POOL_SHARE, safety: r.safety * (1 - MONITOR_STD_POOL_SHARE),
  };
}

/** Normalise to sum 1 over every use, idle included (negative / missing entries clamp to 0). */
export function normalizeSplit(sp: Partial<ComputeSplit>): ComputeSplit {
  const out = emptySplit();
  let sum = 0;
  for (const k of SPLIT_KEYS) sum += Math.max(0, sp[k] ?? 0);
  if (!(sum > 0)) return { ...out, idle: 1 };
  for (const k of SPLIT_KEYS) out[k] = Math.max(0, sp[k] ?? 0) / sum;
  return out;
}

/** Set some uses to fixed shares and rescale the others proportionally so the allocation sums to 1. */
export function withFixed(base: ComputeSplit, fixed: Partial<ComputeSplit>): ComputeSplit {
  const fixedSum = Object.values(fixed).reduce((a, x) => a + (x ?? 0), 0);
  const free = SPLIT_KEYS.filter((k) => fixed[k] === undefined);
  const freeSum = free.reduce((a, k) => a + base[k], 0);
  const out = { ...base, ...fixed } as ComputeSplit;
  for (const k of free) out[k] = freeSum > 0 ? (base[k] / freeSum) * Math.max(0, 1 - fixedSum) : 0;
  return normalizeSplit(out);
}

/** THE allocation function: a lab's allocation (shares of its total compute, summing to 1). Every reader goes through
 *  this (or poolsOf, its H100e). */
export function allocOf(s: GameStateV2, lab: LabId = 'player'): ComputeSplit {
  if (lab === 'player') return s.player.split;
  const r = s.rivals.find((x) => x.core.id === lab)?.core ?? (s.china?.lab?.core.id === lab ? s.china.lab.core : undefined);
  return r?.split ?? { ...emptySplit(), idle: 1 };
}

/** Change one use for the player and take / give the difference from / to `from` (default idle), explicitly; what
 *  `from` cannot cover comes from every other use pro rata. */
export function moveShare(s: GameStateV2, key: keyof ComputeSplit, value: number, from: keyof ComputeSplit = 'idle'): void {
  const sp = { ...s.player.split };
  const v = Math.max(0, Math.min(1, value));
  const d = v - sp[key];
  const take = d > 0 ? Math.min(d, sp[from]) : d;
  sp[key] = v;
  sp[from] -= take;
  if (d > take + 1e-15) {
    const rest = d - take;
    const others = SPLIT_KEYS.filter((k) => k !== key && k !== from);
    const sum = others.reduce((a, k) => a + sp[k], 0);
    for (const k of others) sp[k] = sum > 0 ? sp[k] * Math.max(0, 1 - rest / sum) : 0;
  }
  s.player.split = normalizeSplit(sp);
}

export const SPLIT_PRESETS = ['reference', 'race', 'balanced', 'safety'] as const;
export type SplitPreset = (typeof SPLIT_PRESETS)[number];

/** Preset arithmetic only (not state): the uses grouped as AI 2027's table groups them. Presets set the group totals
 *  and keep the player's proportions within each group. */
const GROUPS = {
  training: ['training', 'synthetic'], research: ['experiments', 'routine', 'frontier'], engineering: ['engineering'],
  serving: ['serving'], safety: ['safetyAgents', 'monitors', 'safety'],
} as const satisfies Record<string, readonly (keyof ComputeSplit)[]>;
type Group = keyof typeof GROUPS;
const GROUP_KEYS = Object.keys(GROUPS) as Group[];
const groupOf = (sp: ComputeSplit) => Object.fromEntries(GROUP_KEYS.map((g) => [g, GROUPS[g].reduce((a, k) => a + sp[k], 0)])) as Record<Group, number>;

function withFixedGroups(base: Record<Group, number>, fixed: Partial<Record<Group, number>>): Record<Group, number> {
  const fixedSum = Object.values(fixed).reduce((a, x) => a + (x ?? 0), 0);
  const free = GROUP_KEYS.filter((k) => fixed[k] === undefined);
  const freeSum = free.reduce((a, k) => a + base[k], 0);
  const out = { ...base, ...fixed } as Record<Group, number>;
  for (const k of free) out[k] = freeSum > 0 ? (base[k] / freeSum) * Math.max(0, 1 - fixedSum) : 0;
  return out;
}

/** One-click presets (§3.4.2) at decimal year `yr`, keeping the player's proportions within each group. [D] */
export function presetSplit(preset: SplitPreset, yr: number, cur?: ComputeSplit): ComputeSplit {
  const refSp = playerShareRef(yr);
  const ref = groupOf(refSp);
  let g: Record<Group, number>;
  switch (preset) {
    case 'race': {
      // Safety 1%, serving −30%; the freed compute goes to training and research (engineering keeps its share).
      const freed = ref.safety - 0.01 + ref.serving * 0.3;
      const tr = ref.training + ref.research;
      g = { safety: 0.01, serving: ref.serving * 0.7, engineering: ref.engineering, training: ref.training + (freed * ref.training) / tr, research: ref.research + (freed * ref.research) / tr };
      break;
    }
    case 'balanced': g = withFixedGroups(ref, { safety: 0.06 }); break;
    case 'safety': g = withFixedGroups(ref, { safety: 0.15, serving: ref.serving * 0.7 }); break;
    default: g = ref;
  }
  const base = cur ?? refSp;
  const out = emptySplit();
  for (const grp of GROUP_KEYS) {
    const keys = GROUPS[grp];
    const curSum = keys.reduce((a, k) => a + base[k], 0);
    const src = curSum > 1e-12 ? base : refSp;
    const srcSum = curSum > 1e-12 ? curSum : keys.reduce((a, k) => a + refSp[k], 0);
    for (const k of keys) out[k] = srcSum > 0 ? (g[grp] * src[k]) / srcSum : g[grp] / keys.length;
  }
  return normalizeSplit(out);
}

/** Apply an allocation for the player (normalised to 1, idle included). Any allocation is allowed: runs with no
 *  training compute show "paused: no training compute" (runStall), products with no serving show capacity-bound.
 *  Returns undefined (kept for callers that treat a string as a rejection). */
export function setSplit(s: GameStateV2, sp: Partial<ComputeSplit>): string | undefined {
  s.player.split = normalizeSplit(sp);
  return undefined;
}
