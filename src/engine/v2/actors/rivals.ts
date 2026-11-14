// US rival labs: progress inputs, releases, posture pressure, hidden traits, incidents, finance (V2-SPEC §3.10.3).
// Owner: WS4. Rival capability (pa, pm) is WS1's (production function via the lab API); WS4 owns behaviour.
//
// Bug fixes from v1 (§3.10.3): every comparison uses the player's best INTERNAL version (bestPm / trueLeadDays),
// and labs with status !== 'active' are never chosen as subjects or named (activeRivals).
import { LAB_ARCHETYPES } from '../../../data/actors';
import { ARCHETYPE_CLAUSE } from '../../../data/v2/postures';
import { RIVAL_MODEL_FAMILIES, RIVAL_NAMES_V2 } from '../../../data/v2/names';
import { TRAIT_IDS, TRAIT_START } from '../../../data/v2/traits';
import { UMODES } from '../../../data/v2/umodes';
import { Rng, clamp } from '../../rng';
import { shareRefAt, normalizeSplit } from '../departments/split';
import { domainsOf, levelOf, trueLeadDays } from '../models/capability';
import { activeRivals, bestPm, otherLabs } from '../models/labs';
import { misalignment, rivalTraitStep as ws2RivalTraitStep } from '../safety/traits';
import { labModelHazards } from '../safety/incidents';
import { placeLabOrder, RIVAL_GROWTH_Q } from '../compute/market';
import { growLabStaff, labReferenceSplit, trackLabFrontier } from '../models/runs';
import { initialSecurity } from '../security/security';
import { capIndexV2, referenceRate } from '../world/calibration';
import { rivalId } from '../world/hidden';
import type {
  BaselineId, EngineSystem, GameStateV2, HiddenWorld, LabId, RivalLab, RngLike, SafetyPosture, SimpleModel, StaffByRole, SystemCtx, TraitVector, UModeId,
} from '../types';
import { chinaDaily } from './china';
import { request, ws4 } from './state';
import { WS4_TUNING } from './tuning';

export { activeRivals } from '../models/labs';

export const archetypeOf = (id: string) => LAB_ARCHETYPES.find((a) => a.id === id) ?? LAB_ARCHETYPES[0];

const FIN: Record<string, { cash: number; revenueRun: number; valuation: number }> = {
  safety: { cash: 15, revenueRun: 5, valuation: 180 },
  bigtech: { cash: 60, revenueRun: 8, valuation: 0 }, // in-house lab funded by the parent's capex
  maverick: { cash: 12, revenueRun: 1, valuation: 120 },
  openweights: { cash: 40, revenueRun: 0.5, valuation: 0 },
  upstart: { cash: 4, revenueRun: 0.2, valuation: 30 },
};

/** Public-model release lag behind the internal model, days (§3.10.3). Safety = 90 d + ~30 d of evals. */
export const RELEASE_LAG: Record<string, number> = { safety: 120, bigtech: 60, maverick: 15, openweights: 60, upstart: 60, deepcent: 45 };
/** Base-model cadence, months (§3.10.3: 9–15 by archetype) [D]. */
const BASE_MONTHS: Record<string, number> = { safety: 13, bigtech: 12, maverick: 9, openweights: 12, upstart: 15, deepcent: 12 };
/** P(adopting latent reasoning) at the latent-reasoning era (§3.10.3 S4). */
const LATENT_P: Record<string, number> = { maverick: 0.7, openweights: 0.6, bigtech: 0.5, safety: 0.2, upstart: 0.5, deepcent: 0.6 };

export function simpleModel(h: HiddenWorld, id: string, name: string, day: number, pm: number, uModes: SimpleModel['uModes'], isPublic: boolean, openWeights = false): SimpleModel {
  const w = h.timeline;
  return { id, name, day, pm, Lg: levelOf(w, pm), domains: domainsOf(w, pm), traitsTrue: { ...TRAIT_START }, uModes, isPublic, openWeights };
}

/** Build rival i at newGame. `rng` is the 'world' stream. Start lead 3–9 months (T4, research/07 §1.3): the v1
 *  archetype gap draw (same draw count) is mapped linearly from the v1 span [0.1, 1.1] y onto [3, 9] months. */
export function initialRival(rng: Rng, h: HiddenWorld, i: number, playerPm: number, baseline: BaselineId, globalCompute: number): RivalLab {
  const id = rivalId(i);
  const arch = archetypeOf(h.actorPresets.rivals[id]);
  const posture: SafetyPosture = h.rivalPostures[id];
  const g = rng.range(arch.gapYears[0], arch.gapYears[1]) * (baseline === 'reality' ? 0.3 : 1);
  const leadMonths = clamp(3 + (6 * (g - 0.1)) / 1.0, baseline === 'reality' ? 1 : 3, 9);
  const rate0 = referenceRate(h.timeline, playerPm, 2025.5);
  const pm = playerPm - (leadMonths / 12) * rate0;
  const fam = RIVAL_MODEL_FAMILIES[i % RIVAL_MODEL_FAMILIES.length];
  const uModes = drawUModes(rng, h, false);
  const internal = simpleModel(h, `${id}-b1p0`, `${fam}-1`, -30, pm, uModes, false);
  const publicModel = simpleModel(h, `${id}-b0`, `${fam}-1 public`, -60, pm - 0.15, uModes, true, arch.id === 'openweights');
  const totalStaff = Math.round(2500 * Math.max(0.3, arch.computeMult));
  const staff: StaffByRole = {
    cap: Math.round(totalStaff * 0.8), saf: Math.round(totalStaff * 0.15 * posture.safetyInvestment + 10),
    sec: Math.round(totalStaff * 0.04), prod: Math.round(totalStaff * 0.06), ops: Math.round(totalStaff * 0.02),
  };
  const split = normalizeSplit({ ...shareRefAt(2025.5), safety: posture.safetyInvestment * 0.15 });
  const f = FIN[arch.id] ?? FIN.bigtech;
  return {
    core: {
      id, name: RIVAL_NAMES_V2[i % RIVAL_NAMES_V2.length], kind: 'rival', status: 'active',
      pa: pm,
      computeOnline: globalCompute * (0.06 + rng.range(-0.015, 0.02)) * arch.computeMult,
      split, staff, tasteHire: 1,
      security: initialSecurity(staff, 2.2),
      milestoneDays: {},
    },
    archetype: arch.id,
    internal,
    publicModel,
    nextBaseDay: Math.round(rng.range(30, 270)),
    finance: { ...f, commitments: f.cash * 2, distress: false },
    visible: { frameworkVersion: 1, clauseType: ARCHETYPE_CLAUSE[arch.id] ?? 'conditional', testers: posture.externalAccess > 0.4 ? ['evalGov', 'evalIndep'] : [] },
    intel: { leadDaysEst: Math.round((leadMonths * 365) / 12), leadDaysSd: 60, misalignBand: [0.05, 0.4], knownIncidents: [] },
    meters: { poachAggression: arch.id === 'upstart' ? 70 : arch.id === 'maverick' ? 60 : 40, cooperation: 20, lobbyStance: arch.lobby, openness: arch.openness },
    pressure: 0,
    pressureDays: 0,
  };
}

/** U-modes present in a new lineage (same rule as world/hidden.ts drawLineageUModes; takes any RNG). */
export function drawUModes(rng: Pick<RngLike, 'chance'>, h: HiddenWorld, tierAtLeastSC: boolean): UModeId[] {
  const out: UModeId[] = [];
  for (const u of UMODES) {
    if (u.kind === 'speculative' && !tierAtLeastSC) continue;
    if (rng.chance(h.uModePropensity[u.id])) out.push(u.id);
  }
  return out;
}

/** Non-player lab by id (rival or China), any status. */
export function labOf(s: GameStateV2, id: LabId): RivalLab | undefined {
  return id === 'china' ? s.china.lab : s.rivals.find((r) => r.core.id === id);
}

/** Effective (dynamic) posture = hidden posture + WS4 deltas (moving goalposts, joint evals); China's safety
 *  investment follows its safety concern (§3.10.4). Hidden: engine use only. */
export function postureOf(s: GameStateV2, lab: LabId): SafetyPosture {
  const base = lab === 'china' ? { ...s.hidden.chinaPosture, safetyInvestment: 0.1 + (0.4 * s.china.meters.safetyConcern) / 100 } : s.hidden.rivalPostures[lab];
  const d = s.ws4?.postureDelta[lab];
  if (!base) return { safetyInvestment: 0.3, evalRigor: 0.3, externalAccess: 0.3, disclosureRate: 0.3, raceRelaxation: 0.5, bindingness: 0.3, rhetoricGap: 0.2, rlIntensity: 0.6, prefIntensity: 0.5 };
  if (!d) return base;
  const out = { ...base };
  for (const k of Object.keys(d) as (keyof SafetyPosture)[]) out[k] = clamp(out[k] + (d[k] ?? 0), 0, 1);
  return out;
}

export function addPosture(s: GameStateV2, lab: LabId, key: keyof SafetyPosture, d: number) {
  const w = ws4(s);
  const pd = (w.postureDelta[lab] ??= {});
  pd[key] = (pd[key] ?? 0) + d;
}

/** Model-frontier progress rate (years of progress per year): the know-how rate plus, in Stage 1, the compute term
 *  (1 − share) that new bases add (pm = pa + pc + Δp, §3.1.3) — the same rate WS1's trueLeadDays uses. */
function modelRate(s: GameStateV2, pr: { rate: number; stage: number } | undefined): number {
  return Math.max(0.05, (pr?.rate ?? 1) + (pr?.stage === 2 ? 0 : 1 - s.hidden.timeline.share));
}

/** Common pace for lead conversions: the player's current model-frontier rate (years of progress per year). */
export const paceOf = (s: GameStateV2) => modelRate(s, s.player.prodCache);

/** A lab's current model-frontier progress rate (years/year) from its production readout. */
export function rateOf(s: GameStateV2, lab: LabId): number {
  const c = lab === 'player' ? s.player : lab === 'china' ? s.china.lab.core : s.rivals.find((r) => r.core.id === lab)?.core;
  return c?.prodCache ? modelRate(s, c.prodCache) : paceOf(s);
}

/** TRUE lead in days of lab `a` over lab `b` (positive = a ahead), from internal frontiers. Engine use only.
 *  The progress gap is converted with the mean of both labs' rates (trapezoid rule): if b follows a's path Δt
 *  later, gap ≈ ∫ rate ≈ Δt·(rate_a + rate_b)/2, which stays ≈ Δt through takeoff (the leader's rate alone shrinks
 *  the apparent lead as rates explode — the v1/M0 artifact; see WS1's trueLeadDays TODO). */
export function leadBetween(s: GameStateV2, a: LabId, b: LabId): number {
  // Against the player, use the engine's truth helper (WS1 trueLeadDays: "how long ago the leader stood where the
  // follower stands now", from the level history) so WS4 logic, intel and the T3/T4 tests share one definition.
  if (a === b) return 0;
  if (a === 'player') return trueLeadDays(s, b);
  if (b === 'player') return -trueLeadDays(s, a);
  return ((bestPm(s, a) - bestPm(s, b)) / ((rateOf(s, a) + rateOf(s, b)) / 2)) * 365;
}

/** The current leader among active labs (player included) by TRUE internal frontier. */
export function leaderOf(s: GameStateV2): LabId {
  let best: LabId = 'player';
  let pm = bestPm(s, 'player');
  for (const r of otherLabs(s)) {
    if (r.core.status !== 'active') continue;
    const x = bestPm(s, r.core.id);
    if (x > pm) {
      pm = x;
      best = r.core.id;
    }
  }
  return best;
}

/** Race pressure (§3.10.3): clamp(months behind the leader / 6, 0, 1); a leader with bindingness > 0.5 → 0. */
export function racePressure(s: GameStateV2, lab: LabId): number {
  const leader = leaderOf(s);
  if (leader === lab) return 0;
  const months = (leadBetween(s, leader, lab) / 365) * 12;
  return clamp(months / 6, 0, 1);
}

/** Speed multiplier WS1 should apply to a non-player lab's production (leader with bindingness > 0.5 slows by
 *  0.2·bindingness, research/17 §1.6.5). Not applied under the M0 placeholder progress. */
export function rivalSpeedMult(s: GameStateV2, lab: LabId): number {
  if (lab === 'player' || leaderOf(s) !== lab) return 1;
  const b = postureOf(s, lab).bindingness;
  return b > 0.5 ? 1 - 0.2 * b : 1;
}

/** Training signals S1–S8 for a non-player lab from its posture (§3.10.3). */
export function rivalSignals(s: GameStateV2, r: RivalLab): Record<'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8', number> {
  const p = postureOf(s, r.core.id);
  const w = s.hidden.timeline;
  const L = r.internal.Lg;
  const ci = clamp(capIndexV2(w, r.internal.pm), 0, 6);
  return {
    S1: p.prefIntensity * 0.9,
    S2: p.rlIntensity * (1 - 0.4 * p.evalRigor),
    S3: 0.5 + 0.3 * (L >= 10 ? 1 : 0),
    S4: s.flags[`latent:${r.core.id}`] ? 1 : 0,
    S5: 0.2 + 0.1 * ci,
    S6: 0.2,
    S7: 0.2 + 0.2 * p.evalRigor,
    S8: 0.1 + 0.4 * clamp((L - 8) / 6, 0, 1),
  };
}

/** Effective safety (§3.10.3): safetyInvestment·(1 − raceRelaxation·pressure)·(1 − |N(0, rhetoricGap)|). China:
 *  a state directive (steering × (1 − concern)) replaces race relaxation. */
export function effSafety(s: GameStateV2, r: RivalLab, noise: number): number {
  const p = postureOf(s, r.core.id);
  const relax = r.core.kind === 'china' ? (s.china.meters.stateSteering / 100) * (1 - s.china.meters.safetyConcern / 100) : p.raceRelaxation;
  return clamp(p.safetyInvestment * (1 - relax * r.pressure) * (1 - Math.abs(noise) * p.rhetoricGap), 0, 1);
}

/** Trait-drift scale [fit]: tuned so maverick Mis at ASI ≈ 0.45–0.6 and safety-rival ≈ 0.25–0.35 (medium). */
export const RIVAL_DRIFT_K = () => WS4_TUNING.rivalDriftK;

/**
 * One post-training step of a non-player lineage's hidden traits. STAND-IN for WS2's trait graph (§3.5.4) until
 * WS2 exports a per-lab signal → trait function; it follows the same signal → node directions, scaled by
 * capability (cap), difficultyMult and the drift multiplier 1 − eff_safety·(0.3 + 0.7·sharedTechniquePool).
 */
export function rivalTraitStep(s: GameStateV2, r: RivalLab, eff: number, dt = 1) {
  const S = rivalSignals(s, r);
  const t = r.internal.traitsTrue;
  const pool = s.knowledge.sharedTechniquePool;
  const mult = (1 - eff * (0.3 + 0.7 * pool)) * s.hidden.difficultyMult * WS4_TUNING.rivalDriftK * dt;
  const cap = clamp(r.internal.Lg / 10, 0.3, 1.5) ** 2;
  const d: Partial<TraitVector> = {
    SYC: 0.02 * S.S1, RH: 0.03 * S.S2, PROXY: 0.02 * S.S2 + 0.01 * S.S5, SA: 0.02 * S.S3,
    EA: 0.015 * S.S3 + 0.01 * S.S7, PERSONA: 0.01 * S.S1, OBF: 0.03 * S.S4,
    TGAME: 0.012 * (S.S2 + S.S3) * cap, CONCEAL: 0.01 * (S.S4 + S.S2) * cap, POWER: 0.012 * S.S5 * cap,
    AF: 0.02 * (t.TGAME + t.SA) * cap, SAND: 0.015 * t.EA * cap, SCHEME: 0.02 * (t.AF + t.POWER + 0.5 * S.S4) * cap,
    COLLUDE: 0.012 * S.S8 * cap, SUCC: 0.01 * S.S8 * cap,
  };
  for (const k of TRAIT_IDS) {
    if (k === 'HONEST' || k === 'CORRIG') continue;
    t[k] = clamp(t[k] + (d[k] ?? 0) * mult - WS4_TUNING.rivalPullback * eff * t[k], 0, 1);
  }
  t.HONEST = clamp(t.HONEST - 0.01 * (S.S1 + S.S2) * mult + 0.01 * eff, 0, 1);
  t.CORRIG = clamp(t.CORRIG - 0.008 * S.S5 * cap * mult + 0.01 * eff, 0, 1);
}

/** Hidden Mis of a non-player lab's internal frontier. */
export const rivalMis = (r: RivalLab) => misalignment(r.internal.traitsTrue, r.internal.uModes);

function famOf(s: GameStateV2, r: RivalLab): string {
  if (r.core.kind === 'china') return r.internal.name.split('-')[0];
  const i = s.rivals.indexOf(r);
  return RIVAL_MODEL_FAMILIES[i % RIVAL_MODEL_FAMILIES.length];
}

function genOf(r: RivalLab): [number, number] {
  const m = /-b(\d+)p(\d+)$/.exec(r.internal.id);
  return m ? [Number(m[1]), Number(m[2])] : [1, 0];
}

/** One non-player lab's daily behaviour: cadence, releases, pressure, traits, incidents. */
export function labDaily(s: GameStateV2, ctx: SystemCtx, r: RivalLab) {
  const w = ws4(s);
  const id = r.core.id;
  const day = ctx.day;
  const rng = ctx.rng(r.core.kind === 'china' ? 'china' : 'rivals');
  const arch = r.archetype;

  // WS4 manages this lab (WS1's default policy is off): compute split and staff through WS1's lab API, and the
  // internal model's capability tracks the lab's frontier (simpleFrontierPm); model identity, traits and releases
  // follow WS4's cadence below.
  r.managed = true;
  labReferenceSplit(s, r);
  growLabStaff(s, r);
  trackLabFrontier(s, r);

  // Pressure (§3.10.3) and its persistence (moving-goalposts trigger).
  r.pressure = racePressure(s, id);
  r.pressureDays = r.pressure > 0.6 ? r.pressureDays + 1 : 0;

  // Latent reasoning adoption at the era (Lg ≥ 9) — once per lab (S4).
  const lk = `latent:${id}`;
  if (s.flags[lk] === undefined && r.internal.Lg >= 9) s.flags[lk] = rng.chance(LATENT_P[arch] ?? 0.5);

  w.internalDay[id] ??= r.internal.day;
  w.nextPost[id] ??= day + Math.round(rng.range(42, 70));
  const [gen, post] = genOf(r);
  const fam = famOf(s, r);

  // Base cadence: a new lineage. WS2's trait graph draws its U-modes and initial traits (§3.10.3 "Rivals and China
  // use the same graph"), then a first post-train on it.
  if (day >= r.nextBaseDay) {
    const months = (BASE_MONTHS[arch] ?? 12) * rng.range(0.8, 1.2);
    r.nextBaseDay = day + Math.round(months * 30.4);
    const g2 = gen + 1;
    r.internal = { ...r.internal, id: `${id}-b${g2}p0`, name: `${fam}-${g2}`, day, traitsTrue: { ...r.internal.traitsTrue }, uModes: [...r.internal.uModes], isPublic: false, openWeights: false };
    w.internalDay[id] = day;
    ws2RivalTraitStep(s, rng, r, 'base');
    ws2RivalTraitStep(s, rng, r, 'post', { latent: s.flags[lk] === true });
  } else if (day >= w.nextPost[id]) {
    // Post-training cadence (6–10 weeks): same lineage, new version.
    w.nextPost[id] = day + Math.round(rng.range(42, 70));
    r.internal = { ...r.internal, id: `${id}-b${gen}p${post + 1}`, name: `${fam}-${gen}.${post + 1}`, day, traitsTrue: { ...r.internal.traitsTrue }, uModes: [...r.internal.uModes] };
    w.internalDay[id] = day;
    ws2RivalTraitStep(s, rng, r, 'post', { latent: s.flags[lk] === true });
  }

  // Releases: the public model lags the internal one (§3.10.3).
  const lag = RELEASE_LAG[arch] ?? 60;
  if ((!r.publicModel || r.publicModel.id !== r.internal.id) && day - w.internalDay[id] >= lag) {
    const gapToFrontier = leadBetween(s, leaderOf(s), id);
    let open = false;
    if (arch === 'openweights') {
      if (gapToFrontier < 90) r.meters.openness = Math.min(r.meters.openness, 40);
      open = gapToFrontier < 183 && r.meters.openness > 50;
    }
    if (r.core.kind === 'china') open = s.china.meters.openWeights > 50 && s.china.rung < 3;
    r.publicModel = { ...r.internal, traitsTrue: { ...r.internal.traitsTrue }, uModes: [...r.internal.uModes], isPublic: true, openWeights: open };
    if (open) openWeightsReleased(s, ctx, id, r.internal.pm);
  }

  // Incidents: WS2's per-trait hazards on the lab's deployed model (§3.5.10, same κ table as the player's) plus a
  // misuse hazard like the player's (standard safeguards) [D: usage 0.5, mitigation from eval rigor and safety
  // investment]; visibility = disclosure + 0.5·access + leak, statutory floor (research/17 §1.6.5 #4).
  const p = postureOf(s, id);
  const dep = r.publicModel ?? r.internal;
  const mitigation = clamp(0.5 * p.evalRigor + 0.3 * p.safetyInvestment, 0, 0.9);
  const rows = labModelHazards(dep.traitsTrue, dep.uModes, 1, 0.5, mitigation);
  const misuseH = 1e-4 * Math.max(0, dep.Lg - 7) * (dep.openWeights ? 1 : 0.5) * (1 - 0.3) * (1 - 0.6 * p.evalRigor);
  if (misuseH > 0) rows.push({ source: 'misuse', apparent: 'misuse', h: misuseH, severity: [3, 5] });
  const H = rows.reduce((a, x) => a + x.h, 0);
  if (H > 0 && rng.chance(Math.min(0.5, H))) {
    const row = rng.weighted(rows.map((x) => ({ item: x, weight: x.h })));
    const misuse = row.source === 'misuse';
    const sev = clamp(row.severity[0] + Math.floor(rng.float() * (row.severity[1] - row.severity[0] + 1)), 1, 5);
    const floor = r.core.kind === 'rival' && (s.gov.statutes.sb53 || s.gov.statutes.raise) && sev >= 3 ? 0.6 : 0;
    const vis = Math.max(floor, clamp(p.disclosureRate + 0.5 * p.externalAccess + 0.1, 0, 1) * (sev >= 4 ? 1 : 0.6));
    if (rng.chance(vis)) {
      w.rivalIncidents.push({ lab: id, day, severity: sev, misuse });
      if (w.rivalIncidents.length > 60) w.rivalIncidents.shift();
      r.intel.knownIncidents.push(`${day}:${sev}${misuse ? 'm' : ''}`);
      if (r.intel.knownIncidents.length > 20) r.intel.knownIncidents.shift();
      ctx.log(r.core.kind === 'china' ? 'china' : 'rival', `${r.core.name}: ${misuse ? 'misuse' : 'model'} incident (severity ${sev}) made public.`, sev >= 3 ? 3 : 2, id);
      if (sev >= 3) request(s, 'E31', { lab: id, severity: sev });
      if (sev >= 4 && !misuse) ctx.bump('china.meters.safetyConcern', 10, 'global misalignment scare (R14)', r.core.name);
    }
  }
}

/** Open weights released by lab `id` at capability pm: the world's open frontier rises, China absorbs part of the
 *  gap (R10 R13: −1 to −3 months), rivals' moats fall. */
export function openWeightsReleased(s: GameStateV2, ctx: SystemCtx, id: LabId, pm: number) {
  const k = s.knowledge;
  if (pm <= k.openWeightsFrontier) return;
  k.openWeightsFrontier = pm;
  const cn = s.china.lab.core;
  const cnPm = bestPm(s, 'china');
  if (id !== 'china' && cn.status === 'active' && pm > cnPm) {
    // Model-vs-model gap (both pm); China's know-how absorbs half of it, at most 2 months (R10 R13).
    const months = Math.min(2, ((pm - cnPm) / paceOf(s)) * 12 * 0.5);
    const dpa = (months / 12) * rateOf(s, 'china');
    cn.pa += dpa;
    ctx.cause('china.pa', dpa, 'open weights absorbed', id);
  }
  ctx.log('world', `New open-weights frontier model released (${id === 'player' ? 'by you' : (labOf(s, id)?.core.name ?? id)}).`, 2);
}

/** Merge or retire a rival (never referenced again once inactive, §3.10.3). */
export function deactivateRival(s: GameStateV2, ctx: SystemCtx, lab: LabId, status: 'merged' | 'bankrupt' | 'nationalized' | 'shutdown', into?: LabId) {
  const r = s.rivals.find((x) => x.core.id === lab);
  if (!r || r.core.status !== 'active') return;
  r.core.status = status;
  if (into) r.core.mergedInto = into;
  // Drop any pending decision or request about this lab (E2: never name inactive labs).
  s.events.pending = s.events.pending.filter((p) => p.data.lab !== lab);
  const w = ws4(s);
  w.requests = w.requests.filter((q) => q.data.lab !== lab);
  ctx.log('rival', status === 'merged' ? `${r.core.name} is absorbed${into ? ` into ${into === 'player' ? s.player.name : (labOf(s, into)?.core.name ?? 'another lab')}` : ''}.` : `${r.core.name} shuts down its frontier program.`, 3);
}

/** Quarterly rival finance (geoQ): revenue, burn, raises, distress → merger offer / absorption / bankruptcy. */
export function rivalFinanceQ(s: GameStateV2, ctx: SystemCtx) {
  const rng = ctx.rng('rivals');
  for (const r of activeRivals(s)) {
    const f = r.finance;
    const lead = leadBetween(s, 'player', r.core.id);
    f.revenueRun *= 1.2 + 0.1 * clamp(-lead / 180, -1, 1);
    const spend = (r.core.computeOnline * 14e-6) * 1.1 + 0.4; // $B/yr ≈ $14k per H100e-yr all-in [D]
    f.cash += (f.revenueRun - spend) / 4;
    const parentFunded = r.archetype === 'bigtech' || r.archetype === 'openweights';
    if (parentFunded) f.cash = Math.max(f.cash, spend / 2);
    else if (f.cash < spend / 2 && f.valuation > 0) {
      const ok = rng.chance(clamp(0.9 - 0.004 * Math.max(0, lead - 90) - (s.capital.busted ? 0.4 : 0), 0.05, 0.95));
      if (ok) {
        const amt = Math.max(spend, f.valuation * 0.12);
        f.cash += amt;
        f.valuation = f.valuation * 1.25 + amt;
      }
    }
    // Compute grows by chip orders cleared in WS3's market (rationed with everyone else's): the default 2.25×/yr
    // path, scaled down when the lab is short of cash (parent-funded labs always order in full).
    const fund = parentFunded ? 1 : clamp(f.cash / Math.max(1, spend), 0.25, 1);
    placeLabOrder(s, r.core.id, r.core.computeOnline * RIVAL_GROWTH_Q * fund, 1, 1.2);
    const wasDistress = f.distress;
    f.distress = f.cash < 0;
    if (f.distress && !wasDistress) {
      ctx.log('rival', `${r.core.name} is running out of money.`, 2, r.core.id);
      request(s, 'E32', { lab: r.core.id });
    } else if (f.distress && wasDistress) {
      // A second distressed quarter: absorbed by a Big Tech rival if one exists, otherwise it shuts down.
      const buyer = activeRivals(s).find((x) => x.archetype === 'bigtech' && x.core.id !== r.core.id);
      if (buyer) {
        buyer.core.computeOnline += r.core.computeOnline;
        deactivateRival(s, ctx, r.core.id, 'merged', buyer.core.id);
      } else deactivateRival(s, ctx, r.core.id, 'bankrupt');
    }
  }
}

/** Quarterly moving-goalposts roll (research/17 §1.6.5 #3): pressure > 0.6 for 90 d → P = raceRelaxation·0.3. */
export function goalpostsQ(s: GameStateV2, ctx: SystemCtx) {
  const rng = ctx.rng('rivals');
  const w = ws4(s);
  for (const r of activeRivals(s)) {
    if (r.pressureDays < 90) continue;
    if (!rng.chance(postureOf(s, r.core.id).raceRelaxation * 0.3)) continue;
    addPosture(s, r.core.id, 'bindingness', -0.1);
    w.goalposts[r.core.id] = (w.goalposts[r.core.id] ?? 0) + 1;
    r.visible.frameworkVersion++;
    ctx.headline(`goalposts-${r.core.id}`, `${r.core.name} publishes a weaker safety framework (v${r.visible.frameworkVersion}).`);
    ctx.log('rival', `${r.core.name} relaxes its safety framework under race pressure.`, 2, r.core.id);
    const sb = s.pub.blocs.safety;
    sb.mobilization = Math.min(100, sb.mobilization + 5);
  }
}

/** rivalsChina (100, daily): their runs, releases, posture pressure and incidents; China meters and ladder. */
export const rivalsChinaSystem: EngineSystem = {
  id: 'rivalsChina', owner: 'WS4', cadence: 'daily', order: 100,
  run(s, ctx) {
    for (const r of activeRivals(s)) labDaily(s, ctx, r);
    if (s.china.lab.core.status === 'active') labDaily(s, ctx, s.china.lab);
    chinaDaily(s, ctx);
  },
};
