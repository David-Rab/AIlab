// US rival labs: progress inputs, releases, posture pressure, hidden traits, incidents, finance (V2-SPEC §3.10.3).
// Owner: WS4. Rival capability is physical (model v3 F1, actors/rivalModel.ts: recipe, base runs, versions in G); WS4
// owns the cadence, releases and behaviour.
//
// Bug fixes from v1 (§3.10.3): every comparison uses the player's best INTERNAL version (bestG / trueLeadDays),
// and labs with status !== 'active' are never chosen as subjects or named (activeRivals).
import { LAB_ARCHETYPES } from '../../../data/actors';
import { ARCHETYPE_CLAUSE, ARCHETYPE_POSTURES, LEADER_MAX_BINDINGNESS } from '../../../data/v2/postures';
import { START_PUBLIC_GAP_OOM } from '../../../data/v2/rivalModel';
import { PRE_GAME_G_PER_YEAR } from '../../../data/v2/runDesign';
import { LEADER_LAB_NAME, LEADER_MODEL_FAMILY, RIVAL_MODEL_FAMILIES, RIVAL_NAMES_V2 } from '../../../data/v2/names';
import { TRAIT_START } from '../../../data/v2/traits';
import { toolsAtStart, type LabArchetype } from '../../../data/v2/tools';
import { UMODES } from '../../../data/v2/umodes';
import { Rng, clamp } from '../../rng';
import { shareRefAt, normalizeSplit } from '../departments/split';
import { domainsOf, frontierGPerYear, gV0, lagDays, levelOfG, PACE_WINDOW_DAYS, yearOfDay } from '../models/capability';
import { CHINA_ID, LEADER_ID, activeRivals, bestG, otherLabs } from '../models/labs';
import { drawSeverity, type HazardRow } from '../safety/incidents';
import { placeLabOrder, RIVAL_GROWTH_Q } from '../compute/market';
import { initialSecurity } from '../security/security';
import { labMarketRevenue } from '../worldfx/revenue';
import { worldMix, type WorldMix } from '../worldfx/mix';
import { noisyPosture, rivalId } from '../world/hidden';
import { hRef, refTotal } from '../production/ces';
import { rivalMoneyQ } from '../finance/rivalFinance';
import type {
  BaselineId, EngineSystem, GameStateV2, HiddenWorld, LabId, RivalLab, RngLike, SafetyPosture, SetupV2, SimpleModel, StaffByRole, SystemCtx, UModeId,
} from '../types';
import * as shock from '../npc/shocks';
import { growLabStaff, initRivalPhys, labReferenceSplit, makeBase, recordToolShips } from './rivalModel';
import { rivalLineupStep, rivalToolStep } from '../npc/market';
import { chinaDaily } from './china';
import { cPlanQ, npcCapabilityDay, persOf } from '../npc/lab';
import { npcM, npcMisOf, npcModelRow, npcRacePressure } from '../npc/risk';
import { ws4 } from './state';

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
    tools: toolsAtStart(arch.id as LabArchetype),
    nextBaseDay: Math.round(rng.range(30, 270)),
    phys: PHYS_PLACEHOLDER(),
    finance: { ...f, commitments: f.cash * 2, distress: false },
    visible: { frameworkVersion: 1, clauseType: ARCHETYPE_CLAUSE[arch.id] ?? 'conditional', testers: posture.externalAccess > 0.4 ? ['evalGov', 'evalIndep'] : [] },
    intel: { knownIncidents: [] },
    meters: { poachAggression: arch.id === 'upstart' ? 70 : arch.id === 'maverick' ? 60 : 40, lobbyStance: arch.lobby, openness: arch.openness },
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
 *  archetype are written into `h` here. Research efficiency 1: the aggregate function as is, no per-lab factor (DD-18, RF-R1). */
export function initialLeaderLab(rng: Rng, h: HiddenWorld, _setup: Pick<SetupV2, 'world'>, playerG: number): RivalLab {
  const id = LEADER_ID;
  const w = h.timeline;
  const yr0 = yearOfDay(0);
  const posture = noisyPosture(rng, ARCHETYPE_POSTURES.leader, 0.15);
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
    tools: toolsAtStart(arch.id as LabArchetype),
    nextBaseDay: Math.round(rng.range(120, 270)),
    phys: PHYS_PLACEHOLDER(),
    finance: { ...f, commitments: f.cash * 2, distress: false },
    visible: { frameworkVersion: 1, clauseType: ARCHETYPE_CLAUSE.leader, testers: posture.externalAccess > 0.4 ? ['evalGov', 'evalIndep'] : [] },
    intel: { knownIncidents: [] },
    meters: { poachAggression: 50, lobbyStance: arch.lobby, openness: arch.openness },
    pressure: 0,
    pressureDays: 0,
  };
  initRivalPhys(w, lab, 1, 0);
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

/** Race pressure (N2b-2, NPC-LABS §4): clamp(1 − months to the nearest competitor, ahead or behind, ÷ 3, 0, 1) (npc/risk.ts). */
export const racePressure = (s: GameStateV2, lab: LabId): number => npcRacePressure(s, lab);

/** Research-speed multiplier of a non-player lab (research/17 §1.6.5): the leader lab with bindingness > 0.5 slows by
 *  0.2·bindingness; 1 for every other lab. production.ts rivalResearch applies it (with the treaty factor) to the
 *  lab's aggregate research speed (evalRival's mods). */
export function rivalSpeedMult(s: GameStateV2, lab: LabId): number {
  if (lab === 'player' || leaderOf(s) !== lab) return 1;
  const b = postureOf(s, lab).bindingness;
  return b > 0.5 ? 1 - 0.2 * b : 1;
}

/** Hidden m of a non-player lab's internal frontier (stored daily on its npc state, npc/risk.ts). */
export const rivalMis = (r: RivalLab) => npcMisOf(r);

/** One non-player lab's daily behaviour (N2b-1, design/npc/NPC-LABS.md §4): its capability day (npc/lab.ts: the lag
 *  relaxes to its target, the internal model follows the reference frontier, releases on the shared cadence), its
 *  lineup and tools, then pressure, traits and incidents as before (N2b-2 replaces those). */
export function labDaily(s: GameStateV2, ctx: SystemCtx, r: RivalLab) {
  const w = ws4(s);
  const id = r.core.id;
  const day = ctx.day;
  const rng = ctx.rng(r.core.kind === 'china' ? 'china' : 'rivals');
  const arch = r.archetype;
  const wl = s.hidden.timeline;

  // Split and staff (readers: the chip market's pools, security, events), through WS1's lab API as before.
  labReferenceSplit(s, r);
  growLabStaff(s, r);
  shock.ipAccess(s, r); // FIN4b: a partner's IP access to the player's models (N6: npc/shocks.ts, a share of the way to the licensed model a day)

  // Pressure (§3.10.3) and its persistence (moving-goalposts trigger).
  r.pressure = racePressure(s, id);
  r.npc!.p = r.pressure;
  r.pressureDays = r.pressure > 0.6 ? r.pressureDays + 1 : 0;

  // Latent reasoning adoption at the era (LATENT_ERA_OOM above V0) — once per lab (S4).
  const lk = `latent:${id}`;
  if (s.flags[lk] === undefined && r.internal.G - gV0(wl) >= LATENT_ERA_OOM) s.flags[lk] = rng.chance(LATENT_P[arch] ?? 0.5);

  // N2b-1: the capability day. On a release the public model is replaced; m is recomputed daily below (npc/risk.ts). Openness: the kind's rule
  // (npc/lab.ts opensRelease); a 'partial' lab opens the model its release replaces.
  const { released, prev } = npcCapabilityDay(s, r, day);
  if (released && r.publicModel) {
    w.internalDay[id] = day;
    const pub = r.publicModel;
    if (pub.openWeights) openWeightsReleased(s, ctx, id, pub.G);
    if (prev && r.npc && persOf(r.npc).openness.mode === 'partial' && !prev.openWeights) {
      prev.openWeights = true;
      openWeightsReleased(s, ctx, id, prev.G);
    }
    if (id === CHINA_ID) shock.distill(s); // N6: China's distillation of the player's products, a pull once per release
    rivalLineupStep(wl, r, day, true, prev);
  } else rivalLineupStep(wl, r, day, false);
  // N4: tools by the public model's horizon, focus and build time (npc/market.ts).
  rivalToolStep(s, r, day);

  // N2b-2 (NPC-LABS §4, §7): m = M_world(G) x (1 - 0.5 x safety emphasis x (1 - race response x p)), then the incidents:
  // model incidents at H0 x (m / M_world(G(V0))) x (1 - 0.8 x safety emphasis) a year on one generic row, plus a misuse
  // hazard like the player's (standard safeguards; safety emphasis where eval rigor stood); visibility = disclosure +
  // 0.5 x access + leak, statutory floor (research/17 §1.6.5 #4).
  const p = postureOf(s, id);
  r.npc!.m = npcM(s, r.internal.G, p.safetyInvestment, p.raceRelaxation, r.npc!.p);
  const dep = r.publicModel ?? r.internal;
  const rows: HazardRow[] = [npcModelRow(s, r.internal.G, r.npc!.m, p.safetyInvestment)];
  const misuseH = MISUSE_PER_OOM * Math.max(0, dep.G - gV0(s.hidden.timeline) - MISUSE_FROM_OOM) * (dep.openWeights ? 1 : 0.5) * (1 - 0.3) * (1 - 0.6 * p.safetyInvestment);
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

/** A recipe increment `dG` (OOM) in days of lab `id`'s own progress at its frontier-G slope (PACE_WINDOW_DAYS): the
 *  previews' unit (the player's own progress; NPC labs' shocks are in days of lag, npc/shocks.ts). */
export const ownProgressDays = (s: GameStateV2, id: LabId, dG: number) => (dG * 365) / frontierGPerYear(s, id, PACE_WINDOW_DAYS);

/** Open weights released by lab `id` at effective compute G: the world's open frontier rises and every other lab behind the
 *  weights (China included) moves part of the way to them (N6: npc/shocks.ts openWeights; C6 previews the same moves). */
export function openWeightsReleased(s: GameStateV2, ctx: SystemCtx, id: LabId, G: number) {
  const k = s.knowledge;
  if (G <= k.openWeightsG) return;
  const cn = s.china.lab;
  const moves = shock.openWeightsMoves(s, id, G);
  for (const m of moves) {
    m.lab.npc!.d -= m.days;
    if (m.lab === cn) ctx.cause('china.lag', -m.days, 'open weights absorbed', id);
  }
  k.openWeightsG = G;
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

/** Quarterly rivals (geoQ): revenue, then money (finance/rivalFinance.ts: the bust's distress → E32 offer →
 *  license-and-hire by big tech or bankruptcy; money is otherwise display), then chip orders. */
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
    rivalMoneyQ(s, ctx, r); // N8b: only the bust's distress and exit (finance/rivalFinance.ts)
    if (r.core.status !== 'active') mix = undefined; // FINM: it left the market (license-and-hire or bankruptcy)
    if (r.core.status !== 'active') continue;
    // N8b: chip orders top compute up to next quarter's plan (start compute × 2.25 a year, one rate for every lab), net of
    // what is already on order, through the chip market shared with everyone. Money never limits an NPC lab's orders; a
    // supply shortfall leaves it behind the plan, and the next quarter's order is larger by the gap.
    const plan = r.npc ? cPlanQ(s, r, 1) : r.core.computeOnline * (1 + RIVAL_GROWTH_Q);
    const pending = s.market.ws3.labOrders.reduce((t, o) => (o.lab === r.core.id ? t + Math.max(0, o.qty - o.delivered) : t), 0);
    placeLabOrder(s, r.core.id, Math.max(0, plan - r.core.computeOnline - pending), 1, 1.2);
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
