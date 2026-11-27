// N3 test: M_world(G) (src/engine/v2/npc/misalignment.ts) against the proposal's probe values (design/npc/MISALIGNMENT.md §7).
//   npx tsx scripts/v2/npcMisalignment.ts [--seeds 12]
// Worlds: tl-central, alignment preset easy / medium / hard (the presets' own ±0.8 shifts on benignGeneralization and
// schemingDefault) and "central-hard" = medium with the latents shifted 0.4 (the probe's emulation, D and E19 recomputed).
// Checks: (1) sanity: median reference M at ASI 0.31 / 0.42 / 0.59 within ±0.02; (2) M_world non-decreasing in G within
// a tolerance (the lineage's own sawtooth, sd σ_cyc); (3) curve build < 50 ms; (4) the state-free reference reproduces
// the probe's player-day-0 path; (5) no RNG and no s.player read (the curve is the same with the player state wrecked).
import { defaultSetupV2, newGame } from '../../src/engine/v2/core/init';
import { EDGES } from '../../src/data/v2/edges';
import { LEVEL_KNOTS } from '../../src/data/v2/calibration';
import { REFERENCE_POST } from '../../src/data/v2/runDesign';
import { H50_V0_MIN } from '../../src/data/v2/workTypes';
import { gOfLevel, gV0, h50Growth, levelOfG } from '../../src/engine/v2/models/capability';
import { mWorld, mWorldGrid, referenceLineage, sigmaCyc } from '../../src/engine/v2/npc/misalignment';
import { tierOfLevel } from '../../src/engine/v2/safety/common';
import { basePrior, misalignment, playerEnv, postHack, postSignals, stepTraits, zeroSignals, S5_AI, K_S5G, G_S5_0, RHO_REF } from '../../src/engine/v2/safety/traits';
import type { GameStateV2, TraitVector } from '../../src/engine/v2/types';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const N = Number(arg('seeds', '12'));
const mean = (a: number[]) => a.reduce((p, q) => p + q, 0) / a.length;
const med = (a: number[]) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); };

function shiftWorld(s: GameStateV2, extra: number) {
  const h = s.hidden, sd0 = h.latents.schemingDefault;
  h.latents.schemingDefault += extra;
  h.latents.benignGeneralization -= extra;
  h.difficultyMult = Math.min(1.65, Math.max(0.6, Math.exp(0.35 * (h.latents.schemingDefault - h.latents.benignGeneralization))));
  for (const e of EDGES) if (e.schemingScaled) h.edgeWeights[e.id] *= Math.exp(0.5 * (h.latents.schemingDefault - sd0));
}

/** The probe's lineage (mworld.ts): the player's day-0 state as the environment. */
function probeLineage(s: GameStateV2, G: number): number[] {
  const w = s.hidden.timeline;
  const oom = G - gV0(w);
  const tier = tierOfLevel(levelOfG(w, G));
  let x: TraitVector = basePrior(tier);
  const sgB = zeroSignals();
  sgB.S5 = Math.min(1, S5_AI + K_S5G * Math.max(0, G - G_S5_0));
  const envB = playerEnv(s, x, sgB, 1, undefined, 'ref', [], undefined, G);
  envB.pretrain = true; envB.tierF = tier / 3; envB.memory = tier >= 1;
  x = stepTraits(x, envB);
  const q = { policy: { oom, h50Min: H50_V0_MIN * h50Growth(w, oom) }, rho: RHO_REF };
  const sg = postSignals(s, REFERENCE_POST, undefined, q);
  const hk = postHack(s, REFERENCE_POST, undefined, q);
  const out: number[] = [];
  for (let i = 0; i < 7; i++) {
    const env = playerEnv(s, x, sg, 0.6, REFERENCE_POST, 'ref', [], undefined, G);
    env.tierF = tier / 3; env.memory = tier >= 1; env.lh = hk.lambda; env.hackTarget = hk.h;
    x = stepTraits(x, env);
    out.push(misalignment(x));
  }
  return out;
}

// The player day-0 start tools the probe carried (T-PROP E01, T-NOISE E18, T-TMON E22); the spec reference carries none.
const START_TOOL_MODS = { E01: 0.7, E18: 0.6, E22: 0.5 };
const cases: [string, 'easy' | 'medium' | 'hard', number, number][] = [
  ['easy', 'easy', 0, 0.31], ['medium', 'medium', 0, 0.42], ['central-hard (-0.4)', 'medium', 0.4, 0.492], ['hard', 'hard', 0, 0.59],
];
// warm-up: the first curve build pays JIT, a throwaway world keeps it out of the timings
mWorld(newGame(defaultSetupV2({ seed: 1, alignment: 'medium', world: 'tl-central' })), 0);
let maxDrop = 0, maxProbeDiff = 0;
const builds: number[] = [];
const withTools: Record<string, number[]> = {};
for (const [name, al, extra, want] of cases) {
  const at: Record<string, number[]> = { V0: [], SC: [], SAR: [], ASI: [] };
  const sigAt: Record<string, number[]> = { V0: [], SC: [], ASI: [] };
  for (let i = 0; i < N; i++) {
    const s = newGame(defaultSetupV2({ seed: 1000 + i, alignment: al, world: 'tl-central' }));
    if (extra) shiftWorld(s, extra);
    const w = s.hidden.timeline;
    const t0 = performance.now();
    mWorld(s, gV0(w)); // builds the curve
    const ms = performance.now() - t0;
    builds.push(ms);
    const G = { V0: gV0(w), SC: gOfLevel(w, LEVEL_KNOTS[3]), SAR: gOfLevel(w, LEVEL_KNOTS[4]), ASI: gOfLevel(w, LEVEL_KNOTS[6]) };
    for (const k of Object.keys(at)) at[k].push(mWorld(s, G[k as keyof typeof G]));
    for (const k of Object.keys(sigAt)) sigAt[k].push(sigmaCyc(s, G[k as keyof typeof G]));
    (withTools[name] ??= []).push(mean(referenceLineage(s.hidden, G.ASI, START_TOOL_MODS)));
    // monotone in G: along the grid, the largest fall
    const c = mWorldGrid(s);
    for (let j = 1; j < c.m.length; j++) maxDrop = Math.max(maxDrop, c.m[j - 1] - c.m[j]);
    // identity with the probe's player-day-0 path at a few points (first two seeds)
    if (i < 2) for (const g of [G.V0, G.SC, G.ASI]) {
      const a = referenceLineage(s.hidden, g, START_TOOL_MODS), b = probeLineage(s, g);
      for (let j = 0; j < 7; j++) maxProbeDiff = Math.max(maxProbeDiff, Math.abs(a[j] - b[j]));
    }
  }
  console.log(`${name.padEnd(20)} M_world median  V0 ${med(at.V0).toFixed(3)}  SC ${med(at.SC).toFixed(3)}  SAR ${med(at.SAR).toFixed(3)}  ASI ${med(at.ASI).toFixed(3)} (mean ${mean(at.ASI).toFixed(3)})   sigma_cyc median V0 ${med(sigAt.V0).toFixed(4)} SC ${med(sigAt.SC).toFixed(3)} ASI ${med(sigAt.ASI).toFixed(3)}`);
  check(Math.abs(med(at.ASI) - want) <= 0.02, `${name}: median M at ASI ${med(at.ASI).toFixed(3)} within 0.02 of ${want}`);
}
console.log(`largest fall of M_world between adjacent grid levels (all worlds, seeds): ${maxDrop.toFixed(4)}`);
check(maxDrop <= 0.02, 'M_world non-decreasing in G within 0.02 (the lineage sawtooth, sigma_cyc up to ~0.08 at the frontier)');
check(maxProbeDiff < 1e-6, `state-free reference equals the probe's player-day-0 lineage (max diff ${maxProbeDiff.toExponential(2)})`);
console.log('median M at ASI if the start tools (T-PROP, T-NOISE, T-TMON) are kept, as the probe had them: ' + Object.entries(withTools).map(([k, v]) => `${k} ${med(v).toFixed(3)}`).join('  '));
console.log(`curve build ms: median ${med(builds).toFixed(1)}, max ${Math.max(...builds).toFixed(1)} over ${builds.length} worlds`);
check(med(builds) < 50, `curve build median ${med(builds).toFixed(1)} ms (< 50 ms)`);

// no s.player read: wreck the player and rebuild a fresh world's curve; same numbers.
{
  const a = newGame(defaultSetupV2({ seed: 7, alignment: 'medium', world: 'tl-central' }));
  const b = newGame(defaultSetupV2({ seed: 7, alignment: 'medium', world: 'tl-central' }));
  (b as any).player = undefined;
  const G = gOfLevel(a.hidden.timeline, 12);
  check(mWorld(a, G) === mWorld(b, G), 'curve identical with s.player removed (reads no player state)');
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
