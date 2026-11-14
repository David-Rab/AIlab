// Hidden world sampling at newGame (V2-SPEC §2.3). Owner: WS1. All draws from stream 'world', in spec order.
// Wraps src/data/world.ts makeWorld UNCHANGED (audited R11 presets) and adds the v2 latents and presets.
import { CHINA_PRESETS, GOV_PRESETS, LAB_ARCHETYPES, PUBLIC_PRESETS } from '../../../data/actors';
import { AGENDAS } from '../../../data/v2/agendas';
import { CAL_SHIFT, PROD_DEFAULT, PROD_PRESETS } from '../../../data/v2/calibration';
import { EDGE_FACTOR_RANGE, EDGE_SIGMA_SCALE, EDGES, GRADE_SIGMA, type EdgeDef } from '../../../data/v2/edges';
import { PARADIGMS } from '../../../data/v2/paradigms';
import { ARCHETYPE_POSTURES, CHINA_POSTURE_BASE } from '../../../data/v2/postures';
import { UMODES } from '../../../data/v2/umodes';
import { makeWorld } from '../../../data/world';
import { Rng, clamp } from '../../rng';
import { buildKnots, cesFromAsymptotes } from '../production/knots';
import type {
  AgendaId, EconPresetId, HiddenWorld, LabId, ProdParams, SafetyLatents, SafetyPosture, SetupV2, TimelineWorld, UModeId,
} from '../types';

/** Balance knob #1 (§7.4): global scale on difficultyMult [D]. M4: 1.4 (step 1) hurt the mixed bot more than the race
 *  bot; 1.2 (step 2) pushed RefBot past S4 (P_mis 0.89), so it stays 1. */
export const DIFFICULTY_SCALE = 1;
/** M4 [D]: difficultyMult is kept within [0.6, 1.65] (|λ6 − λ4| ≲ 1.4 sd) so a hard world raises trait growth by
 *  at most 65%: the world sets how hard alignment is, the player's training and safety choices decide the outcome. */
export const DIFFICULTY_RANGE: [number, number] = [0.6, 1.65];

/** Realised edge weight (§2.3 step 6, M4 bounds). */
function drawEdge(rng: Rng, e: EdgeDef, schemingDefault: number): number {
  const wBar = e.schemingScaled ? e.wBar * Math.exp(0.5 * schemingDefault) : e.wBar;
  return wBar * clamp(Math.exp(rng.normal(0, GRADE_SIGMA[e.grade] * EDGE_SIGMA_SCALE)), EDGE_FACTOR_RANGE[0], EDGE_FACTOR_RANGE[1]);
}

export function pickWeighted<T extends { id: string; weight: number }>(rng: Rng, list: readonly T[], choice: string): T {
  if (choice !== 'realistic') return list.find((p) => p.id === choice) ?? list[0];
  return rng.weighted(list.map((p) => ({ item: p, weight: p.weight })));
}

/** Production parameters for the world (§2.3 step 2). */
export function prodParamsFor(rng: Rng, setup: SetupV2, w: Omit<TimelineWorld, 'prod'>): ProdParams {
  const base = { ...PROD_DEFAULT, ...(PROD_PRESETS[setup.world] ?? {}) };
  if (setup.world === 'sampled') base.La = 1 + rng.lognormal80(1, 200);
  const ces = cesFromAsymptotes(base.La, base.Ca, base.slow10);
  const P: Omit<ProdParams, 'knots'> = { ...base, ...ces };
  return { ...P, knots: buildKnots(w as TimelineWorld, P) };
}

const LATENT_KEYS: (keyof SafetyLatents)[] = ['legibility', 'cotLoadBearing', 'verificationAdvantage', 'benignGeneralization', 'formalizability', 'schemingDefault'];

/** Rival lab ids in order (stable for saves): 'r0'..'r3'. */
export const rivalId = (i: number): LabId => `r${i}`;

function noisyPosture(rng: Rng, p: SafetyPosture, noise: number): SafetyPosture {
  const out = { ...p };
  if (noise > 0) for (const k of Object.keys(out) as (keyof SafetyPosture)[]) out[k] = clamp(out[k] + rng.range(-noise, noise), 0, 1);
  return out;
}

/**
 * Sample the hidden world. `rng` must be the 'world' stream Rng; the caller stores rng.state back into s.rng.world.
 * Order (binding, §2.3): timeline, production, latents, agendas, paradigms, edges, U-modes, economy, actors, doom.
 */
export function sampleHidden(rng: Rng, setup: SetupV2): HiddenWorld {
  // 1. Timeline world (unchanged audited presets; also draws v1 alignDifficulty and doomThreshold — step 10).
  const w1 = makeWorld(rng, setup.world, setup.alignment, setup.baseline);
  const tl0 = { ...w1, calShift: CAL_SHIFT[setup.world] };
  // 2. Production parameters.
  const timeline: TimelineWorld = { ...tl0, prod: prodParamsFor(rng, setup, tl0) };

  // 3. Safety latents λ1–λ6 ~ N(0,1), shifted by the alignment preset.
  const latents = {} as SafetyLatents;
  for (const k of LATENT_KEYS) latents[k] = rng.normal();
  const shift = setup.alignment === 'easy' ? 0.8 : setup.alignment === 'hard' ? -0.8 : 0;
  latents.benignGeneralization += shift;
  latents.schemingDefault -= shift;
  const difficultyMult = DIFFICULTY_SCALE * clamp(Math.exp(0.35 * (latents.schemingDefault - latents.benignGeneralization)), DIFFICULTY_RANGE[0], DIFFICULTY_RANGE[1]);

  // 4. Agenda efficacy.
  const agendaEfficacy = {} as Record<AgendaId, number>;
  for (const a of AGENDAS) {
    let e = rng.beta(a.prior[0], a.prior[1]);
    for (const [k, load] of Object.entries(a.loadings) as [keyof SafetyLatents, number][]) e += load * latents[k];
    agendaEfficacy[a.id] = clamp(e, 0, 1);
  }

  // 5. Paradigm success.
  const paradigmSuccess: Record<string, boolean> = {};
  for (const p of PARADIGMS) paradigmSuccess[p.id] = p.prior >= 1 ? true : rng.chance(p.prior);

  // 6. Edge weights.
  const edgeWeights: Record<string, number> = {};
  for (const e of EDGES) if (!e.late) edgeWeights[e.id] = drawEdge(rng, e, latents.schemingDefault);

  // 7. U-mode propensity.
  const uModePropensity = {} as Record<UModeId, number>;
  for (const u of UMODES) {
    uModePropensity[u.id] = u.kind === 'real' ? rng.range(0.3, 0.7) : clamp(rng.range(0.05, 0.3) * (1 + 0.3 * latents.schemingDefault), 0, 1);
  }

  // 8. Economy preset (Normal 35 / AI2027 45 / GATE 20 when sampled).
  const econ: EconPresetId = setup.econ === 'sampled'
    ? rng.weighted<EconPresetId>([{ item: 'normal', weight: 35 }, { item: 'ai2027', weight: 45 }, { item: 'gate', weight: 20 }])
    : setup.econ;

  // 9. Actor presets (v1 lists, Realistic weights) and postures (R17 §1.6.4, ±0.15 noise in Realistic).
  const gov = pickWeighted(rng, GOV_PRESETS, setup.gov).id;
  const pub = pickWeighted(rng, PUBLIC_PRESETS, setup.public).id;
  const china = pickWeighted(rng, CHINA_PRESETS, setup.china).id;
  const rivals: Record<LabId, string> = {};
  const rivalPostures: Record<LabId, SafetyPosture> = {};
  const noise = setup.rivals === 'realistic' ? 0.15 : 0;
  for (let i = 0; i < setup.rivalCount; i++) {
    const arch = pickWeighted(rng, LAB_ARCHETYPES, setup.rivals).id;
    rivals[rivalId(i)] = arch;
    rivalPostures[rivalId(i)] = noisyPosture(rng, ARCHETYPE_POSTURES[arch] ?? ARCHETYPE_POSTURES.bigtech, noise);
  }
  const chinaPosture = noisyPosture(rng, CHINA_POSTURE_BASE, noise / 3);
  // 11. Edges added in M4 (drawn last so the earlier draws are unchanged).
  for (const e of EDGES) if (e.late) edgeWeights[e.id] = drawEdge(rng, e, latents.schemingDefault);

  // 10. Doom threshold: drawn inside makeWorld (0.40, or U(0.30, 0.50) when alignment is sampled).
  return {
    timeline, latents, agendaEfficacy, paradigmSuccess, edgeWeights, uModePropensity, econ,
    doomThreshold: timeline.doomThreshold, difficultyMult,
    actorPresets: { gov, public: pub, china, rivals }, rivalPostures, chinaPosture,
  };
}

/** U-modes present in a new lineage (§3.5.5). M0 helper used for the starting lineages; WS2 owns the full rule
 *  (modifiers by design/paradigm) in safety/umodes.ts. Speculative modes need tier ≥ SC. */
export function drawLineageUModes(rng: Pick<Rng, 'chance'>, h: Pick<HiddenWorld, 'uModePropensity'>, tierAtLeastSC: boolean): UModeId[] {
  const out: UModeId[] = [];
  for (const u of UMODES) {
    if (u.kind === 'speculative' && !tierAtLeastSC) continue;
    if (rng.chance(h.uModePropensity[u.id])) out.push(u.id);
  }
  return out;
}
