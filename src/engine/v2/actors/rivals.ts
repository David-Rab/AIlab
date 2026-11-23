// US rival labs: progress inputs, releases, posture pressure, hidden traits, incidents, finance (V2-SPEC §3.10.3).
// Owner: WS4. Rival capability is physical (model v3 F1, actors/rivalModel.ts: recipe, base runs, versions in G); WS4
// owns the cadence, releases and behaviour.
//
// Bug fixes from v1 (§3.10.3): every comparison uses the player's best INTERNAL version (bestG / trueLeadDays),
// and labs with status !== 'active' are never chosen as subjects or named (activeRivals).
import { LAB_ARCHETYPES } from '../../../data/actors';
import { ARCHETYPE_CLAUSE, ARCHETYPE_POSTURES, LEADER_MAX_BINDINGNESS } from '../../../data/v2/postures';
import { LEADER_CAL } from '../../../data/v2/calibration';
import { POST_DAYS, START_PUBLIC_GAP_OOM } from '../../../data/v2/rivalModel';
import { PRE_GAME_G_PER_YEAR } from '../../../data/v2/runDesign';
import { LEADER_LAB_NAME, LEADER_MODEL_FAMILY, RIVAL_MODEL_FAMILIES, RIVAL_NAMES_V2 } from '../../../data/v2/names';
import { TRAIT_START } from '../../../data/v2/traits';
import { UMODES } from '../../../data/v2/umodes';
import { Rng, clamp } from '../../rng';
import { hash32 } from '../core/rng';
import { shareRefAt, normalizeSplit } from '../departments/split';
import { domainsOf, frontierGAt, frontierGPerYear, gOfBuild, gV0, lagDays, levelOfG, PACE_WINDOW_DAYS, yearOfDay } from '../models/capability';
import { CHINA_ID, LEADER_ID, activeRivals, bestG, otherLabs } from '../models/labs';
import { misalignment, rivalTraitStep as ws2RivalTraitStep } from '../safety/traits';
import { drawSeverity, labModelHazards } from '../safety/incidents';
import { placeLabOrder, RIVAL_GROWTH_Q } from '../compute/market';
import { initialSecurity } from '../security/security';
import { labMarketRevenue } from '../worldfx/revenue';
import { worldMix, type WorldMix } from '../worldfx/mix';
import { noisyPosture, rivalId } from '../world/hidden';
import { hRef, refTotal } from '../production/ces';
import { ipAccessDaily } from '../finance/deals';
import { parentFunded, rivalMoneyQ, rivalSpend } from '../finance/rivalFinance';
import { decimalYear } from '../core/time';
import type {
  BaselineId, EngineSystem, GameStateV2, HiddenWorld, LabId, RivalLab, RngLike, SafetyPosture, SetupV2, SimpleModel, StaffByRole, SystemCtx, UModeId,
} from '../types';
import { distillLift, labRecipeG, RECIPE_LEAK_SHARE, recipeLeakG, tacitLeakG } from '../production/diffusion';
import { addRivalKnowledge, clRefresh, clReset, recipeOf, finishRun, gOfSimple, growLabStaff, initRivalPhys, labReferenceSplit, makeBase, newVersionBuild, rivalDomainDg, rivalLineupStep, rivalToolStep, recordToolShips, setModelG, trainDay } from './rivalModel';
import { chinaDaily } from './china';
import { ws4, ws4r } from './state';

export { activeRivals } from '../models/labs';

export const archetypeOf = (id: string) => LAB_ARCHETYPES.find((a) => a.id === id) ?? LAB_ARCHETYPES[0];

/** Start finance by archetype. `valuation` > 0 marks a private lab (FIN5b: marked from the story split at the start,
 *  finance/rivalFinance.ts); `raised` = equity its investors had put in by mid-2025 (Anthropic ≈ $15B, xAI ≈ $22B,
 *  SSI $3B, OpenAI ≈ $60B with SoftBank's first close) [R21, approx.]. */
export const FIN: Record<string, { cash: number; revenueRun: number; valuation: number; raised: number }> = {
  safety: { cash: 15, revenueRun: 5, valuation: 180, raised: 15 },
  bigtech: { cash: 60, revenueRun: 8, valuation: 0, raised: 0 }, // in-house lab funded by the parent's capex
  maverick: { cash: 12, revenueRun: 1, valuation: 120, raised: 22 },
  openweights: { cash: 40, revenueRun: 0.5, valuation: 0, raised: 0 },
  upstart: { cash: 4, revenueRun: 0.2, valuation: 30, raised: 3 },
  leader: { cash: 40, revenueRun: 12, valuation: 300, raised: 60 }, // the frontier leader at the start (STRUCTURE §4.8 table)
};

/** Public-model release lag behind the internal model, days (§3.10.3). Safety = 90 d + ~30 d of evals. */
export const RELEASE_LAG: Record<string, number> = { safety: 120, bigtech: 60, maverick: 15, openweights: 60, upstart: 60, deepcent: 45, leader: 30 };
/** Base-model cadence, months (§3.10.3: 9–15 by archetype) [D]. */
export const BASE_MONTHS: Record<string, number> = { safety: 13, bigtech: 12, maverick: 9, openweights: 12, upstart: 15, deepcent: 12, leader: 9 };
/** P(adopting latent reasoning) at the latent-reasoning era (§3.10.3 S4). */
/** RD-L05: the latent-reasoning era in OOM of effective compute above the start model V0 (was display L 9 = 1.99 OOM
 *  on ai2027, where V0 → SC is 2.49 OOM); a capability dose, not a milestone. */
const LATENT_ERA_OOM = 2.0;
/** RD-L05: rival misuse hazard grows from MISUSE_FROM_OOM above V0 at MISUSE_PER_OOM per OOM per day (was 1e-4 per
 *  display level from L 7: L 7 = 1.0 OOM on ai2027, 2.0 levels per OOM there). */
const MISUSE_FROM_OOM = 1.0;
const MISUSE_PER_OOM = 2e-4;
const LATENT_P: Record<string, number> = { maverick: 0.7, openweights: 0.6, bigtech: 0.5, safety: 0.2, upstart: 0.5, deepcent: 0.6, leader: 0.8 };

/** A non-player lab's model at effective compute G (its design is set by initRivalPhys / setModelG). */
export function simpleModel(h: HiddenWorld, id: string, name: string, day: number, G: number, uModes: SimpleModel['uModes'], isPublic: boolean, openWeights = false): SimpleModel {
  const w = h.timeline;
  return { id, name, day, G, Lg: levelOfG(w, G), domains: domainsOf(w, G), traitsTrue: { ...TRAIT_START }, uModes, isPublic, openWeights };
}

/** Build rival i at newGame. `rng` is the 'world' stream. Start lead 3–9 months (T4, research/07 §1.3): the v1
 *  archetype gap draw (same draw count) is mapped linearly from the v1 span [0.1, 1.1] y onto [3, 9] months. */
export function initialRival(rng: Rng, h: HiddenWorld, i: number, playerG: number, baseline: BaselineId, globalCompute: number): RivalLab {
  const id = rivalId(i);
  const arch = archetypeOf(h.actorPresets.rivals[id]);
  const posture: SafetyPosture = h.rivalPostures[id];
  const g = rng.range(arch.gapYears[0], arch.gapYears[1]) * (baseline === 'reality' ? 0.3 : 1);
  const leadMonths = clamp(3 + (6 * (g - 0.1)) / 1.0, baseline === 'reality' ? 1 : 3, 9);
  // The start lead in months at the stated pre-game frontier pace (OOM of G a year, RD-L03).
  const G = playerG - (leadMonths / 12) * PRE_GAME_G_PER_YEAR;
  const fam = RIVAL_MODEL_FAMILIES[i % RIVAL_MODEL_FAMILIES.length];
  const uModes = drawUModes(rng, h, false);
  const internal = simpleModel(h, `${id}-b1p0`, `${fam}-1`, -30, G, uModes, false);
  const publicModel = simpleModel(h, `${id}-b0`, `${fam}-1 public`, -60, G - START_PUBLIC_GAP_OOM, uModes, true, arch.id === 'openweights');
  const totalStaff = Math.round(2500 * Math.max(0.3, arch.computeMult));
  const staff: StaffByRole = {
    cap: Math.round(totalStaff * 0.8), saf: Math.round(totalStaff * 0.15 * posture.safetyInvestment + 10),
  };
  const split = normalizeSplit({ ...shareRefAt(2025.5), safety: posture.safetyInvestment * 0.15 });
  const f = FIN[arch.id] ?? FIN.bigtech;
  const lab: RivalLab = {
    core: {
      id, name: RIVAL_NAMES_V2[i % RIVAL_NAMES_V2.length], kind: 'rival', status: 'active',
      computeOnline: globalCompute * (0.06 + rng.range(-0.015, 0.02)) * arch.computeMult,
      split, staff, tasteHire: 1,
      security: initialSecurity(staff, 2.2),
      milestoneDays: {},
    },
    archetype: arch.id,
    internal,
    publicModel,
    nextBaseDay: Math.round(rng.range(30, 270)),
    phys: PHYS_PLACEHOLDER(),
    finance: { ...f, commitments: f.cash * 2, distress: false },
    visible: { frameworkVersion: 1, clauseType: ARCHETYPE_CLAUSE[arch.id] ?? 'conditional', testers: posture.externalAccess > 0.4 ? ['evalGov', 'evalIndep'] : [] },
    intel: { leadDaysEst: Math.round((leadMonths * 365) / 12), leadDaysSd: 60, misalignBand: [0.05, 0.4], knownIncidents: [] },
    meters: { poachAggression: arch.id === 'upstart' ? 70 : arch.id === 'maverick' ? 60 : 40, cooperation: 20, lobbyStance: arch.lobby, openness: arch.openness },
    pressure: 0,
    pressureDays: 0,
  };
  // Model v3 F1: its last base, recipe and models in G (the start model stays where the lead draw put it, T4).
  initRivalPhys(h.timeline, lab, 1, START_PUBLIC_GAP_OOM, 1);
  return lab;
}

/** Placeholder until initRivalPhys sets the physical state (same call, same object). */
export const PHYS_PLACEHOLDER = (): RivalLab['phys'] => ({ base: makeBase(1, -60, 1e26, 0), eff: 1, serve: 0, rec: { pre: 0, mid: 0, ceil: 0 }, pool: { pre: 0, mid: 0, ceil: 0 } });

/** Build the simulated AI 2027 leader lab (setup.leaderLab, BUILD-PLAN R2) at reference inputs: the player's start
 *  model (V0's G), capabilities staff hRef, compute refTotal, split shareRef, taste 1 (the rivals'
 *  default policy may read the reference path, MODEL-V3 §13). Appended after the sampled rivals with the fixed id
 *  LEADER_ID; its draws come from its own `rng` (Rng(hash32(seed,'leaderLab'))), never from 'world'. Its posture and
 *  archetype are written into `h` here. Model v3 F1: research efficiency 10^LEADER_CAL [fit, T1L]. */
export function initialLeaderLab(rng: Rng, h: HiddenWorld, setup: Pick<SetupV2, 'rivals' | 'world'>, playerG: number): RivalLab {
  const id = LEADER_ID;
  const w = h.timeline;
  const yr0 = yearOfDay(0);
  const posture = noisyPosture(rng, ARCHETYPE_POSTURES.leader, setup.rivals === 'realistic' ? 0.15 : 0);
  posture.bindingness = Math.min(posture.bindingness, LEADER_MAX_BINDINGNESS);
  h.actorPresets.rivals[id] = 'leader';
  h.rivalPostures[id] = posture;
  const arch = archetypeOf('leader');
  const uModes = drawUModes(rng, h, false);
  const internal = simpleModel(h, `${id}-b1p0`, `${LEADER_MODEL_FAMILY}-1`, -20, playerG, uModes, false);
  const publicModel = simpleModel(h, `${id}-b0`, `${LEADER_MODEL_FAMILY}-1 public`, -20, playerG, uModes, true);
  const staff: StaffByRole = { cap: hRef(yr0), saf: Math.round(hRef(yr0) * 0.15 * posture.safetyInvestment + 10) };
  const f = FIN.leader;
  const lab: RivalLab = {
    core: {
      id, name: LEADER_LAB_NAME, kind: 'rival', status: 'active',
      computeOnline: refTotal(w, yr0),
      split: shareRefAt(yr0), staff, tasteHire: 1,
      security: initialSecurity(staff, 2.2),
      milestoneDays: {},
    },
    archetype: arch.id,
    internal,
    publicModel,
    nextBaseDay: Math.round(rng.range(120, 270)),
    phys: PHYS_PLACEHOLDER(),
    finance: { ...f, commitments: f.cash * 2, distress: false },
    visible: { frameworkVersion: 1, clauseType: ARCHETYPE_CLAUSE.leader, testers: posture.externalAccess > 0.4 ? ['evalGov', 'evalIndep'] : [] },
    intel: { leadDaysEst: 0, leadDaysSd: 60, misalignBand: [0.05, 0.4], knownIncidents: [] },
    meters: { poachAggression: 50, cooperation: 20, lobbyStance: arch.lobby, openness: arch.openness },
    pressure: 0,
    pressureDays: 0,
  };
  initRivalPhys(w, lab, Math.pow(10, LEADER_CAL[setup.world] ?? 0), 0);
  return lab;
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

/** The current leader among active labs (player included) by TRUE internal frontier. */
export function leaderOf(s: GameStateV2): LabId {
  let best: LabId = 'player';
  let g = bestG(s, 'player');
  for (const r of otherLabs(s)) {
    if (r.core.status !== 'active') continue;
    const x = bestG(s, r.core.id);
    if (x > g) {
      g = x;
      best = r.core.id;
    }
  }
  return best;
}

/** Race pressure (§3.10.3): clamp(months behind the leader / 6, 0, 1); a leader with bindingness > 0.5 → 0. */
export function racePressure(s: GameStateV2, lab: LabId): number {
  const leader = leaderOf(s);
  if (leader === lab) return 0;
  const months = (lagDays(s, lab, leader) / 365) * 12;
  return clamp(months / 6, 0, 1);
}

/** Research-speed multiplier of a non-player lab (research/17 §1.6.5): the leader lab with bindingness > 0.5 slows by
 *  0.2·bindingness; 1 for every other lab. production.ts rivalResearch applies it (with the treaty factor) to the
 *  lab's aggregate research speed (evalRival's mods). */
export function rivalSpeedMult(s: GameStateV2, lab: LabId): number {
  if (lab === 'player' || leaderOf(s) !== lab) return 1;
  const b = postureOf(s, lab).bindingness;
  return b > 0.5 ? 1 - 0.2 * b : 1;
}

/**
 * Projected hidden Mis of a non-player lab when it reaches ASI (the epilogue and the final score, endings/epilogue.ts):
 * its trait cadence fast-forwarded with the rule labDaily runs in play: WS2's rivalTraitStep after every post-training
 * (the mean of POST_DAYS apart, the first at the lab's scheduled one) and after every base run (BASE_MONTHS by
 * archetype from its next base day: a 'base' step, then a 'post' on it), with latent reasoning adopted once at LATENT_ERA_OOM above V0
 * (LATENT_P). The stated stand-in (DD-18): capability rises linearly in G from the internal model's to `asiG` over
 * `days`, every base starts a new lineage, and race pressure stays at today's. At most 120 steps (a guard: a ten-year
 * projection is ≈ 75). Pure: works on a clone and draws from a hash of the seed, lab and day (no stream).
 */
export function projectLabMis(s: GameStateV2, r0: RivalLab, asiG: number, days: number): number {
  const r: RivalLab = JSON.parse(JSON.stringify(r0));
  const id = r.core.id;
  const day0 = s.time.day;
  const end = day0 + days;
  const rng = new Rng(hash32(s.setup.seed, `projectMis:${id}:${day0}`));
  const postEvery = (POST_DAYS[0] + POST_DAYS[1]) / 2;
  const baseEvery = (BASE_MONTHS[r.archetype] ?? 12) * 30.4;
  const lk = s.flags[`latent:${id}`];
  let latent = lk === undefined ? undefined : lk === true;
  let nextPost = Math.max(day0, ws4r(s).nextPost[id] ?? day0 + postEvery);
  let nextBase = Math.max(day0, r.nextBaseDay);
  const G0 = r.internal.G;
  const G1 = Math.max(G0, asiG);
  for (let n = 0; n < 120 && days > 0; n++) {
    const d = Math.min(nextPost, nextBase);
    if (d > end) break;
    setModelG(s.hidden.timeline, r.internal, G0 + ((G1 - G0) * (d - day0)) / days);
    if (latent === undefined && r.internal.G - gV0(s.hidden.timeline) >= LATENT_ERA_OOM) latent = rng.chance(LATENT_P[r.archetype] ?? 0.5);
    if (d === nextBase) {
      nextBase += baseEvery;
      ws2RivalTraitStep(s, rng, r, 'base');
    } else nextPost = d + postEvery;
    ws2RivalTraitStep(s, rng, r, 'post', { latent: latent === true });
  }
  return rivalMis(r);
}

/** Hidden Mis of a non-player lab's internal frontier. */
export const rivalMis = (r: RivalLab) => misalignment(r.internal.traitsTrue, r.internal.uModes);

function famOf(s: GameStateV2, r: RivalLab): string {
  if (r.core.kind === 'china') return r.internal.name.split('-')[0];
  if (r.core.id === LEADER_ID) return LEADER_MODEL_FAMILY;
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

  // The lab's one daily policy (RD-B14): compute split and staff through WS1's lab API; its base run trains on its
  // training pool (model v3 F1, rivalModel.ts); model identity, traits and releases follow WS4's cadence below.
  // The leader lab runs at the reference compute path (no chip orders, BUILD-PLAN R2): set today for tomorrow's
  // production readout, which reads the inputs as of today (production uses day − 1).
  if (id === LEADER_ID) r.core.computeOnline = refTotal(s.hidden.timeline, decimalYear(s));
  labReferenceSplit(s, r);
  growLabStaff(s, r);
  trainDay(s, r, day);
  addRivalKnowledge(r, ipAccessDaily(s, id)); // FIN4b: a partner's IP access to the player's models (finance/deals.ts; FINM: OOM)

  // Pressure (§3.10.3) and its persistence (moving-goalposts trigger).
  r.pressure = racePressure(s, id);
  r.pressureDays = r.pressure > 0.6 ? r.pressureDays + 1 : 0;

  // Latent reasoning adoption at the era (LATENT_ERA_OOM above V0) — once per lab (S4).
  const lk = `latent:${id}`;
  if (s.flags[lk] === undefined && r.internal.G - gV0(s.hidden.timeline) >= LATENT_ERA_OOM) s.flags[lk] = rng.chance(LATENT_P[arch] ?? 0.5);

  w.internalDay[id] ??= r.internal.day;
  w.nextPost[id] ??= day + Math.round(rng.range(POST_DAYS[0], POST_DAYS[1]));
  const [gen, post] = genOf(r);
  const fam = famOf(s, r);
  const wl = s.hidden.timeline;

  // Post-training cadence (6–10 weeks, research/12 §0.1): same lineage, new version on the current base at today's
  // recipe (rivalModel.ts newVersionBuild: baseG + rlGains on the reference portfolio, RD-X03), never below the version it replaces.
  const postVersion = () => {
    w.nextPost[id] = day + Math.round(rng.range(POST_DAYS[0], POST_DAYS[1]));
    // RD-X04 rule B: the post-training distils the best released teacher above its own G (production/diffusion.ts);
    // RD-X03: its own G is the new version's build.
    const nbld = newVersionBuild(s, r, r.phys.base);
    const own = gOfBuild(nbld);
    const G = Math.max(gOfSimple(wl, r.internal), own + distillLift(s, id, own, r.phys.base.params).dG);
    r.internal = { ...r.internal, id: `${id}-b${gen}p${post + 1}`, name: `${fam}-${gen}.${post + 1}`, day, traitsTrue: { ...r.internal.traitsTrue }, uModes: [...r.internal.uModes], recG: recipeOf(s, r) };
    r.internal.build = nbld; // the new version's build (a weaker one kept, or the distillation lift, as general ΔG: setModelG)
    setModelG(wl, r.internal, G, r.phys.base, rivalDomainDg(r));
    clReset(r);
    w.internalDay[id] = day;
    ws2RivalTraitStep(s, rng, r, 'post', { latent: s.flags[lk] === true });
  };
  // Base cadence (9–15 months by archetype; research/12 §0.1: one every ~9–18 months per lab): the base run that trained
  // on the lab's pool finishes and, if its first version beats the current model, starts a new lineage. WS2's trait
  // graph draws its U-modes and initial traits (§3.10.3 "Rivals and China use the same graph"), then a first post-train
  // on it. A base no better than the model the lab holds (a stolen one) is shelved and the current base post-trained.
  if (day >= r.nextBaseDay) {
    const months = (BASE_MONTHS[arch] ?? 12) * rng.range(0.8, 1.2);
    r.nextBaseDay = day + Math.round(months * 30.4);
    const nb = finishRun(r, day);
    const nbld = nb ? newVersionBuild(s, r, nb) : undefined;
    const gOwn = nbld ? gOfBuild(nbld) : -Infinity;
    const gNew = nb ? gOwn + distillLift(s, id, gOwn, nb.params).dG : -Infinity; // RD-X04 rule B
    if (nb && gNew >= gOfSimple(wl, r.internal)) {
      const g2 = gen + 1;
      r.phys.base = nb;
      r.phys.clDay = day;
      r.internal = { ...r.internal, id: `${id}-b${g2}p0`, name: `${fam}-${g2}`, day, traitsTrue: { ...r.internal.traitsTrue }, uModes: [...r.internal.uModes], isPublic: false, openWeights: false, recG: recipeOf(s, r) };
      r.internal.build = nbld!; // the lift above the build enters as general ΔG (setModelG)
      setModelG(wl, r.internal, gNew, nb, rivalDomainDg(r));
      clReset(r);
      w.internalDay[id] = day;
      ws2RivalTraitStep(s, rng, r, 'base');
      ws2RivalTraitStep(s, rng, r, 'post', { latent: s.flags[lk] === true });
    } else postVersion();
  } else if (day >= w.nextPost[id]) postVersion();
  // Continual learning (RD-T03): every CL_DAYS the stream spends the FLOP its pool share delivered on the internal model.
  else clRefresh(s, r, day);

  // Releases: the public model lags the internal one (§3.10.3).
  // A lab whose lag exceeds its post-training interval (6–10 weeks) never had an internal version `lag` days old (each
  // post resets internalDay), so it never released: once the public model is a post interval staler than the lag,
  // release the frontier as it stood `lag` days ago (RD-L02: its recorded frontier line then, frontierGAt; a history
  // shorter than that: internal G less the rest of the lag at its own frontier-G slope; `day` = that as-of day).
  const lag = RELEASE_LAG[arch] ?? 60;
  const age = day - w.internalDay[id];
  let rel: SimpleModel | undefined;
  if (!r.publicModel || (r.publicModel.id !== r.internal.id && !r.publicModel.id.startsWith(`${r.internal.id}~`))) {
    if (age >= lag) rel = r.internal;
    else if (day - (r.publicModel?.day ?? -1e9) >= lag + 56) {
      const gInt = gOfSimple(wl, r.internal);
      const G = Math.max(r.publicModel ? gOfSimple(wl, r.publicModel) : -Infinity, Math.min(gInt, frontierGAt(s, id, day - lag) ?? gInt - ((lag - age) / 365) * frontierGPerYear(s, id, PACE_WINDOW_DAYS)));
      rel = { ...r.internal, id: `${r.internal.id}~${day}`, day: day - lag };
      setModelG(wl, rel, G);
    }
  } else if (r.publicModel.id !== r.internal.id && age >= lag) rel = r.internal;
  if (rel) {
    const gapToFrontier = lagDays(s, id, leaderOf(s));
    let open = false;
    if (arch === 'openweights') {
      if (gapToFrontier < 90) r.meters.openness = Math.min(r.meters.openness, 40);
      open = gapToFrontier < 183 && r.meters.openness > 50;
    }
    if (r.core.kind === 'china') open = s.china.meters.openWeights > 50 && s.china.rung < 3;
    const prev = r.publicModel;
    r.publicModel = { ...rel, traitsTrue: { ...rel.traitsTrue }, uModes: [...rel.uModes], isPublic: true, openWeights: open };
    if (open) openWeightsReleased(s, ctx, id, rel.G, rel.recG ?? recipeOf(s, r));
    rivalLineupStep(wl, r, day, true, prev);
  } else rivalLineupStep(wl, r, day, false);
  // RD-P07: the product tools it acquires after the first lab shipped them.
  rivalToolStep(s, r, day);

  // Incidents: WS2's danger formula on the lab's deployed model at a generic product site (E5) plus a
  // misuse hazard like the player's (standard safeguards) [D: usage 0.5, mitigation from eval rigor and safety
  // investment]; visibility = disclosure + 0.5·access + leak, statutory floor (research/17 §1.6.5 #4).
  const p = postureOf(s, id);
  const dep = r.publicModel ?? r.internal;
  const mitigation = clamp(0.5 * p.evalRigor + 0.3 * p.safetyInvestment, 0, 0.9);
  const rows = labModelHazards(dep, mitigation);
  const misuseH = MISUSE_PER_OOM * Math.max(0, dep.G - gV0(s.hidden.timeline) - MISUSE_FROM_OOM) * (dep.openWeights ? 1 : 0.5) * (1 - 0.3) * (1 - 0.6 * p.evalRigor);
  if (misuseH > 0) rows.push({ source: 'misuse', apparent: 'misuse', h: misuseH, sev: 3, disposition: 1, capability: 1, opportunity: 1, block: 0 });
  const H = rows.reduce((a, x) => a + x.h, 0);
  if (H > 0 && rng.chance(Math.min(0.5, H))) {
    const row = rng.weighted(rows.map((x) => ({ item: x, weight: x.h })));
    const misuse = row.source === 'misuse';
    const sev = misuse ? clamp(3 + Math.floor(rng.float() * 3), 1, 5) : drawSeverity(row, rng.float()); // misuse: v2's 3–5
    const floor = r.core.kind === 'rival' && (s.gov.statutes.sb53 || s.gov.statutes.raise) && sev >= 3 ? 0.6 : 0;
    const vis = Math.max(floor, clamp(p.disclosureRate + 0.5 * p.externalAccess + 0.1, 0, 1) * (sev >= 4 ? 1 : 0.6));
    if (rng.chance(vis)) {
      w.rivalIncidents.push({ lab: id, day, severity: sev, misuse });
      if (w.rivalIncidents.length > 60) w.rivalIncidents.shift();
      r.intel.knownIncidents.push(`${day}:${sev}${misuse ? 'm' : ''}`);
      if (r.intel.knownIncidents.length > 20) r.intel.knownIncidents.shift();
      ctx.log(r.core.kind === 'china' ? 'china' : 'rival', `${r.core.name}: ${misuse ? 'misuse' : 'model'} incident (severity ${sev}) made public.`, sev >= 3 ? 3 : 2, id);
      if (sev >= 4 && !misuse) ctx.bump('china.meters.safetyConcern', 10, 'global misalignment scare (R14)', r.core.name);
    }
  }
}

/** RD-X04b (DD-17; research/RD-X04r §3C): hand-made recipe transfers to other labs, OOM into the recipient's
 *  pretraining recipe (addRivalKnowledge; it shows at that lab's next base or continual-learning refresh), sized by what
 *  moves: a share of the recipient's recipe gap (production/diffusion.ts). The actions apply these and their previews
 *  read the same functions. A4 publish: RECIPE_LEAK_SHARE.publish of `dst`'s gap to the player's recipe. */
export const publishLeakG = (s: GameStateV2, dst: LabId) => recipeLeakG(s, labRecipeG(s, 'player'), dst, RECIPE_LEAK_SHARE.publish);
/** E16 "let go": the tacit knowledge `moved` of the player's capabilities staff carry into `dst` (tacitLeakG). */
export const poachLeakG = (s: GameStateV2, dst: LabId, moved: number) => tacitLeakG(s, 'player', dst, moved, s.player.staff.cap);
/** A recipe increment `dG` (OOM) in days of lab `id`'s own progress at its frontier-G slope (PACE_WINDOW_DAYS): the
 *  previews' unit. */
export const ownProgressDays = (s: GameStateV2, id: LabId, dG: number) => (dG * 365) / frontierGPerYear(s, id, PACE_WINDOW_DAYS);

/** The recipe an open-weights release at G reveals: the releaser's recipe less the release's distance below its best
 *  model (an older model, an older recipe) [D]. A stamped version passes its own recG instead. */
export const releaseRecG = (s: GameStateV2, id: LabId, G: number) => labRecipeG(s, id) - Math.max(0, bestG(s, id) - G);
/** OOM of recipe China absorbs from open weights revealing recipe `recG` (0 when China is inactive or at / above it):
 *  RECIPE_LEAK_SHARE.openWeights of its recipe gap. The open launch preview (RD-B20) and C6 read it. */
export function openAbsorbG(s: GameStateV2, recG: number): number {
  if (s.china.lab.core.status !== 'active') return 0;
  return recipeLeakG(s, recG, CHINA_ID, RECIPE_LEAK_SHARE.openWeights);
}

/** Open weights released by lab `id` at effective compute G (revealing recipe `recG`): the world's open frontier rises,
 *  China absorbs part of its recipe gap (openAbsorbG), rivals' moats fall. */
export function openWeightsReleased(s: GameStateV2, ctx: SystemCtx, id: LabId, G: number, recG = releaseRecG(s, id, G)) {
  const k = s.knowledge;
  if (G <= k.openWeightsG) return;
  k.openWeightsG = G;
  const cn = s.china.lab;
  const dG = id !== CHINA_ID ? openAbsorbG(s, recG) : 0;
  if (dG > 0) {
    addRivalKnowledge(cn, dG);
    ctx.cause('china.recipe', dG, 'open weights absorbed', id);
  }
  ctx.log('world', `New open-weights frontier model released (${id === 'player' ? 'by you' : (labOf(s, id)?.core.name ?? id)}).`, 2);
}

/** Merge or retire a rival (never referenced again once inactive, §3.10.3). `text` replaces the default log line. */
export function deactivateRival(s: GameStateV2, ctx: SystemCtx, lab: LabId, status: 'merged' | 'bankrupt' | 'nationalized' | 'shutdown', into?: LabId, text?: string) {
  const r = s.rivals.find((x) => x.core.id === lab);
  if (!r || r.core.status !== 'active') return;
  r.core.status = status;
  if (into) r.core.mergedInto = into;
  // Drop any pending decision or request about this lab (E2: never name inactive labs).
  s.events.pending = s.events.pending.filter((p) => p.data.lab !== lab);
  const w = ws4(s);
  w.requests = w.requests.filter((q) => q.data.lab !== lab);
  ctx.log('rival', text ?? (status === 'merged' ? `${r.core.name} is absorbed${into ? ` into ${into === 'player' ? s.player.name : (labOf(s, into)?.core.name ?? 'another lab')}` : ''}.` : `${r.core.name} shuts down its frontier program.`), 3);
}

/** Share of the gap to market revenue a rival closes each quarter [D, M4]. */
export const RIVAL_REVENUE_TRACK = 0.5;

/** Quarterly rivals (geoQ): revenue, then money (FIN5b: finance/rivalFinance.ts: cash, raises at the story valuation,
 *  distress → E32 offer → license-and-hire by big tech or bankruptcy), then chip orders. */
export function rivalFinanceQ(s: GameStateV2, ctx: SystemCtx) {
  // P2: one world mix for all labs (nothing the mix reads changes in this loop until a lab leaves the market).
  let mix: WorldMix | undefined;
  for (const r of activeRivals(s)) {
    const f = r.finance;
    const lead = lagDays(s, r.core.id, 'player');
    // Revenue (M4): half-way each quarter toward what WS5's market pays this lab's public model (demand-side share of
    // sector and consumer spend), so the private-lab sector run-rate — and with it the investor pool (R15 §1.4) —
    // tracks the market [D]. Labs without a priced public model keep the archetype growth rule.
    const mkt = labMarketRevenue(s, r.core.id, (mix ??= worldMix(s)));
    if (mkt > 0) f.revenueRun += RIVAL_REVENUE_TRACK * (mkt - f.revenueRun);
    else f.revenueRun *= 1.2 + 0.1 * clamp(-lead / 180, -1, 1);
    rivalMoneyQ(s, ctx, r); // FIN5b: cash flow, raises, distress and exit (finance/rivalFinance.ts)
    if (r.core.status !== 'active') mix = undefined; // FINM: it left the market (license-and-hire or bankruptcy)
    if (r.core.status !== 'active' || r.core.id === LEADER_ID) continue;
    // Compute grows by chip orders cleared in WS3's market (rationed with everyone else's): the default 2.25×/yr
    // path, scaled down when the lab is short of cash (parent-funded labs always order in full). The leader lab runs
    // at the reference compute path (no chip orders).
    const fund = parentFunded(r) ? 1 : clamp(f.cash / Math.max(1, rivalSpend(r)), 0.25, 1);
    placeLabOrder(s, r.core.id, r.core.computeOnline * RIVAL_GROWTH_Q * fund, 1, 1.2);
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
  id: 'rivalsChina', owner: 'WS4', cadence: 'daily', order: 100, system: 'relations',
  run(s, ctx) {
    recordToolShips(s, ctx.day);
    for (const r of activeRivals(s)) labDaily(s, ctx, r);
    if (s.china.lab.core.status === 'active') labDaily(s, ctx, s.china.lab);
    chinaDaily(s, ctx);
  },
};
