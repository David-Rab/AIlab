// M_world(G): the world's reference misalignment curve (design/npc/MISALIGNMENT.md §2, §4; NPC-LABS.md §8a). Owner: NPC.
//
// One reference lineage per world: a base trained at capability G, then POSTS post-trainings at the reference recipe
// (REFERENCE_POST), on the 2025 start suites with expert-human graders and the world's own edge weights and difficulty.
// It runs the trait graph's pure functions through the state-free referenceEnv / referenceSignalLab (safety/traits.ts),
// so it reads s.hidden and data constants only, never s.player. M_world(G) is the mean of the lineage's Mis over the
// posts (the base-cycle mean, decision Q1) and σ_cyc(G) their sd (the lineage's own sawtooth). No RNG, nothing saved.
//
// The curve is built once per world on the display-level grid L = 0, 0.25, …, 15 (61 points, mapped to G by gOfLevel;
// timeline draws put ASI 7 to 160 OOM above V0, so a G grid would be uneven), memoised in a WeakMap on s.hidden (not
// saved, not in the state hash). Between points it is linear in G; flat below L 0 and above ASI.
import { REFERENCE_POST } from '../../../data/v2/runDesign';
import { H50_V0_MIN } from '../../../data/v2/workTypes';
import { gOfLevel, gV0, h50Growth, levelOfG } from '../models/capability';
import {
  basePrior, G_S5_0, K_S5G, misalignment, postHackOf, postSignalsOf, referenceEnv, referenceSignalLab, RHO_REF, S5_AI, stepTraits, zeroSignals,
} from '../safety/traits';
import { tierOfLevel } from '../safety/common';
import type { GameStateV2, HiddenWorld, TraitVector } from '../types';

/** Post-trainings per base: 12 months of base cycle ÷ 56 days. */
export const REF_POSTS = 7;
/** Omega of the base step and of each post step (the player's base and post kinds). */
const OMEGA_BASE = 1;
const OMEGA_POST = 0.6;
/** Display-level grid. */
export const MW_LEVEL_STEP = 0.25;
export const MW_LEVEL_MAX = 15;

const mean = (a: number[]) => a.reduce((p, q) => p + q, 0) / a.length;
const sd = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / a.length);
};

/** The reference lineage at capability G: Mis after each of its posts (no U-modes: they are the per-lab draw, §4). */
export function referenceLineage(h: HiddenWorld, G: number, extraMods?: Record<string, number>): number[] {
  const w = h.timeline;
  const tier = tierOfLevel(levelOfG(w, G));
  let x: TraitVector = basePrior(tier);
  const sgB = zeroSignals();
  sgB.S5 = Math.min(1, S5_AI + K_S5G * Math.max(0, G - G_S5_0));
  const envB = referenceEnv(h, x, sgB, OMEGA_BASE, undefined, G, extraMods);
  envB.pretrain = true;
  x = stepTraits(x, envB);
  const lab = referenceSignalLab(h);
  const oom = G - gV0(w);
  const q = { policy: { oom, h50Min: H50_V0_MIN * h50Growth(w, oom) }, rho: RHO_REF };
  const sg = postSignalsOf(lab, REFERENCE_POST, undefined, q);
  const hk = postHackOf(lab, REFERENCE_POST, undefined, q);
  const out: number[] = [];
  for (let i = 0; i < REF_POSTS; i++) {
    const env = referenceEnv(h, x, sg, OMEGA_POST, REFERENCE_POST, G, extraMods);
    env.lh = hk.lambda;
    env.hackTarget = hk.h;
    x = stepTraits(x, env);
    out.push(misalignment(x));
  }
  return out;
}

interface Curve { g: number[]; m: number[]; sig: number[] }
const curves = new WeakMap<HiddenWorld, Curve>();

function curveOf(h: HiddenWorld): Curve {
  let c = curves.get(h);
  if (c) return c;
  c = { g: [], m: [], sig: [] };
  const n = Math.round(MW_LEVEL_MAX / MW_LEVEL_STEP);
  for (let i = 0; i <= n; i++) {
    const G = gOfLevel(h.timeline, i * MW_LEVEL_STEP);
    const ms = referenceLineage(h, G);
    c.g.push(G);
    c.m.push(mean(ms));
    c.sig.push(sd(ms));
  }
  curves.set(h, c);
  return c;
}

function interp(c: Curve, ys: number[], G: number): number {
  const g = c.g;
  if (G <= g[0]) return ys[0];
  if (G >= g[g.length - 1]) return ys[ys.length - 1];
  let lo = 0, hi = g.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (g[mid] <= G) lo = mid; else hi = mid;
  }
  const f = (G - g[lo]) / Math.max(1e-12, g[hi] - g[lo]);
  return ys[lo] + f * (ys[hi] - ys[lo]);
}

/** M_world(G): the world's reference misalignment at a model of capability G (effective compute, OOM). */
export const mWorld = (s: Pick<GameStateV2, 'hidden'>, G: number): number => interp(curveOf(s.hidden), curveOf(s.hidden).m, G);
/** σ_cyc(G): the sd over the reference lineage's posts, the sawtooth of a lab's own base/post cycle. */
export const sigmaCyc = (s: Pick<GameStateV2, 'hidden'>, G: number): number => interp(curveOf(s.hidden), curveOf(s.hidden).sig, G);
/** The memoised curve's grid, for tests and the dashboard: G, M_world and σ_cyc at each display level. */
export const mWorldGrid = (s: Pick<GameStateV2, 'hidden'>): Readonly<Curve> => curveOf(s.hidden);
