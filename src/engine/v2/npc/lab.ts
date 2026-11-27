// N2b-1 (design/npc/NPC-LABS.md §3, §4): an NPC lab's capability core. Every non-player lab (the US labs of the
// Realistic cast and China's lab) is one simple shape: a kind (data/v2/npcLabs.ts KINDS), a start state (REALISTIC_CAST)
// and a lag d (days behind the reference frontier G_ref, npc/reference.ts) that relaxes to its target:
//   dd/dt = (d* − d) / τ_D,  τ_D = DIFFUSION_TAU_DAYS
//   d* = d₀ + compute shortfall in days: max(0, log10(cPlan / C)) ÷ today's reference slope (OOM a day)
//   internal model G = G_ref(t − d);  public model = the internal one a release lag ago, refreshed every
//   RELEASE_CADENCE_DAYS (the labs' release days staggered by cast order).
// The outward contract (Appendix A: core, internal, publicModel, lineup, tools, finance, ...) is kept; the old physical
// state `phys` is an adapter filled from these headline values (npcPhys) until N12 removes it.
import { KINDS, REALISTIC_CAST, RELEASE_CADENCE_DAYS, type NpcCastEntry, type NpcKindId, type Personality } from '../../../data/v2/npcLabs';
import { DIFFUSION_TAU_DAYS } from '../../../data/v2/calibration';
import { RIVAL_TPP } from '../../../data/v2/rivalModel';
import { SERIES_ANCHOR } from '../../../data/v2/timelineSeries';
import { ARCHETYPE_CLAUSE, ARCHETYPE_POSTURES } from '../../../data/v2/postures';
import { LAB_ARCHETYPES } from '../../../data/actors';
import { PRE_GAME_G_PER_YEAR, REFERENCE_BASE } from '../../../data/v2/runDesign';
import { flopOfDesign } from '../models/effective';
import { clockOfG, refG } from './reference';
import { refYear, treatyClockDay } from './shocks';
import { gV0 } from '../models/capability';
import { baseParams, setModelG } from '../actors/rivalModel';
import { npcDomainDg, npcServeOom, seedRivalLineup } from './market';
import { referenceProfileModel } from '../departments/workfit';
import { frontierRunShareAt, normalizeSplit, shareRefAt } from '../departments/split';
import { refreshPublic } from './public';
import { initialSecurity } from '../security/security';
import { RIVAL_GROWTH } from '../compute/market';
import { decimalYear, quarterIndex } from '../core/time';
import { hash32 } from '../core/rng';
import { Rng } from '../../rng';
import { TRAIT_START } from '../../../data/v2/traits';
import { UMODES } from '../../../data/v2/umodes';
import type { GameStateV2, HiddenWorld, SetupV2, LabId, NpcLabState, RivalLab, SafetyPosture, SimpleModel, StaffByRole, TimelineWorld, UModeId } from '../types';


// ───────────────────────────── parameters (N2b-1; new, listed in design/npc/N2b1-RESULT.md) ─────────────────────────────

/** Days per month for the cast's lags in months (d₀ = 30.4 × months behind the leader) [D]. */
export const DAYS_PER_MONTH = 30.4;
/** China's compute plan: the growth of China's compute meter without export policy, ×2 a year (actors/china.ts chinaDaily,
 *  IFP) [repo]. KINDS.china has no appetite of its own (its compute is the meter's). */
export const CHINA_PLAN_GROWTH = 2;
/** Floor of the reference slope (OOM a year) the shortfall converts at: the reference is flat after the run's last
 *  point (and dips in 3 of 869 runs); a lag there moves nothing [D]. */
export const SLOPE_FLOOR_PER_YEAR = 0.01;
/** Window of the reference slope (years): one grid step of the series (data/v2/timelineSeries.ts SERIES_STEP). */
export const SLOPE_WINDOW_YEARS = 0.1;
/** Capabilities staff per H100e: the leader's day-0 2,050 capabilities staff per 1e6 H100e (data/v2/calibration.ts
 *  H_REF_BASE, DAY0_REF) [D: one typical ratio, NPC-LABS Appendix A "staff from compute × one typical ratio"]. */
export const STAFF_PER_H100E = 2050 / 1e6;

/** The leader's start compute (H100e): the unit of the public recipe's compute advantage (§4). */
export const LEADER_START_C = (() => {
  const c = REALISTIC_CAST.find((x) => x.kind === 'leader')?.start.computeH100e;
  return typeof c === 'number' ? c : 1e6;
})();
/** The reference start base's FLOP (B0) and the leader's day-0 run budget (1e6 H100e × the 2025 run share 0.4) it was
 *  sized on: an NPC model's training FLOP is B0's scaled by the lab's run budget today (as initRivalPhys sized a
 *  rival's start base). */
const B0_FLOP = flopOfDesign(REFERENCE_BASE);
const LEADER_DAY0_RUN = 1e6 * 0.4;

/** Old archetype id of a kind (the readers of `archetype`: postures, tools at the start, finance governance, epilogue). */
export const ARCHETYPE_OF_KIND: Record<NpcKindId, string> = {
  leader: 'leader', safety: 'safety', bigtech: 'bigtech', openweights: 'openweights', racer: 'maverick', upstart: 'upstart', china: 'deepcent',
};

// ───────────────────────────── the reference frontier, extended ─────────────────────────────

/** G of the reference frontier at clock year `y`: refG on the game's draw; before the anchor (2025.445) it falls back
 *  at the stated pre-game pace PRE_GAME_G_PER_YEAR (the rate the start gaps in months were converted at, RD-L03); in a
 *  world without a draw (every world but tl-*), G(V0) + the pre-game pace × (y − anchor) [D stand-in]. */
export function refGAt(s: Pick<GameStateV2, 'setup' | 'hidden'>, y: number): number {
  const g0 = gV0(s.hidden.timeline);
  if (y <= SERIES_ANCHOR) {
    const a = refG(s, SERIES_ANCHOR) ?? g0;
    return a - (SERIES_ANCHOR - y) * PRE_GAME_G_PER_YEAR;
  }
  return refG(s, y) ?? g0 + (y - SERIES_ANCHOR) * PRE_GAME_G_PER_YEAR;
}
/** The inverse of refGAt: the earliest clock year the reference reaches G (Infinity: never on this run). */
export function clockOfGAt(s: Pick<GameStateV2, 'setup' | 'hidden'>, G: number): number {
  const a = refGAt(s, SERIES_ANCHOR);
  if (G <= a) return SERIES_ANCHOR - (a - G) / PRE_GAME_G_PER_YEAR;
  return clockOfG(s, G) ?? SERIES_ANCHOR + (G - a) / PRE_GAME_G_PER_YEAR;
}
/** Today's reference slope, OOM a day: over the last SLOPE_WINDOW_YEARS, floored at SLOPE_FLOOR_PER_YEAR. */
export function refSlopePerDay(s: Pick<GameStateV2, 'setup' | 'hidden'>, y: number): number {
  const perYear = (refGAt(s, y) - refGAt(s, y - SLOPE_WINDOW_YEARS)) / SLOPE_WINDOW_YEARS;
  return Math.max(SLOPE_FLOOR_PER_YEAR, perYear) / 365.25;
}

// ───────────────────────────── the rules ─────────────────────────────

/** The lab's yearly plan growth: every NPC lab 2.25x (compute/market.ts RIVAL_GROWTH, N8b); China's lab its meter's (CHINA_PLAN_GROWTH). */
export const planGrowthOf = (n: Pick<NpcLabState, 'kind'>) => (n.kind === 'china' ? CHINA_PLAN_GROWTH : RIVAL_GROWTH);
/** The lab's seven values: its kind's, or the player's adjusted set (setup.cast, NpcLabState.p). */
export const persOf = (n: Pick<NpcLabState, 'kind' | 'pers'>): Personality => n.pers ?? KINDS[n.kind];
/** The compute the lab planned to have online today: its start compute grown at its appetite, a step each quarter (its
 *  chip orders are placed and delivered quarterly, compute/market.ts). The step counts from the day after a quarter
 *  starts: the quarter's deliveries clear (marketQ, order 400) after the NPC labs' day (rivalsChina, order 100). */
export function cPlan(s: GameStateV2, r: RivalLab): number {
  const n = r.npc!;
  return n.c0 * Math.pow(planGrowthOf(n), Math.max(0, quarterIndex(s.time.startDate, s.time.day - 1)) / 4);
}
/** Compute shortfall (OOM ≥ 0) and the target lag d* = d₀ + shortfall ÷ today's reference slope (days). */
/** The compute the lab plans to have online `ahead` quarters from the current quarter (orders are sized from it). */
export const cPlanQ = (s: GameStateV2, r: RivalLab, ahead: number) => r.npc!.c0 * Math.pow(planGrowthOf(r.npc!), (quarterIndex(s.time.startDate, s.time.day) + ahead) / 4);
export function npcTarget(s: GameStateV2, r: RivalLab): { short: number; slope: number; dStar: number } {
  const n = r.npc!;
  const slope = refSlopePerDay(s, refYear(s));
  const C = Math.max(1, r.core.computeOnline);
  const short = Math.max(0, Math.log10(cPlan(s, r) / C));
  return { short, slope, dStar: n.d0 + short / slope };
}
/** G of the lab's internal model today. */
export const npcG = (s: GameStateV2, r: RivalLab) => refGAt(s, refYear(s) - r.npc!.d / 365.25);
/** G of the internal model as it stood one release lag ago: its daily history (NpcLabState.hist); before the history
 *  is that long (the first weeks), the reference a release lag further back at today's lag. */
export function npcPublicG(s: GameStateV2, r: RivalLab): number {
  const n = r.npc!;
  const L = persOf(n).releaseLagDays;
  return n.hist.length > L ? n.hist[n.hist.length - 1 - L] : refGAt(s, refYear(s) - (n.d + L) / 365.25);
}
/** The lab's recipe as OOM over the leader's day-0 recipe (the unit of the player's recipe and the diffusion rules): its
 *  capability less G(V0) less its compute advantage log10(C ÷ the leader's start compute) (NPC-LABS §4 public recipe;
 *  G(V0) subtracted so it is in the recipe's unit). */
export const npcRecipe = (w: TimelineWorld, G: number, C: number) => G - gV0(w) - Math.log10(Math.max(1, C) / LEADER_START_C);
/** Training FLOP of a model the lab makes today: the reference base B0 scaled by its run budget (compute × the typical
 *  base-run share frontierRunShareAt) over the leader's day-0 run budget. Its size: baseParams (paramsForFlop). */
export const npcRunFlop = (C: number, yr: number) => Math.max(1e24, B0_FLOP * (C * frontierRunShareAt(yr)) / LEADER_DAY0_RUN);

/** Set a model to capability G at the lab's compute: the reference-profile build (as milestones read a model known by G),
 *  domains, level, FLOP, size and FLOP per token (setModelG). */
export function setNpcModel(w: TimelineWorld, m: SimpleModel, G: number, C: number, yr: number, kind: NpcKindId) {
  const flop = npcRunFlop(C, yr);
  m.build = referenceProfileModel(G, flop).build;
  setModelG(w, m, G, { flop, params: baseParams(flop) }, npcDomainDg(kind)); // N4: G plus the kind's focus offsets
}

/** The physical-state adapter (RivalLab.phys) from the headline values: one base at the internal model's FLOP and size
 *  (rivalRunFlop, distillation fit read it), recipe = the lab's recipe in the pretraining part, no run, no research pools. */
export function npcPhys(r: RivalLab, day: number): RivalLab['phys'] {
  const m = r.internal;
  const flop = m.flop ?? 1e26;
  const n = r.npc!;
  return {
    base: { gen: n.rel + 1, day: lastReleaseDay(n, day), flop, params: m.params ?? baseParams(flop), tpp: RIVAL_TPP, gPre: m.G, ePre: n.rec },
    eff: 1, serve: npcServeOom(day), rec: { pre: n.rec, mid: 0, ceil: 0 }, pool: { pre: 0, mid: 0, ceil: 0 },
  };
}

/** The release days: phase + k × RELEASE_CADENCE_DAYS. */
export const isReleaseDay = (n: NpcLabState, day: number) => day >= n.phase && (day - n.phase) % RELEASE_CADENCE_DAYS === 0;
export const lastReleaseDay = (n: NpcLabState, day: number) => n.phase + Math.floor((day - n.phase) / RELEASE_CADENCE_DAYS) * RELEASE_CADENCE_DAYS;
export const nextReleaseDay = (n: NpcLabState, day: number) => n.phase + Math.max(0, Math.ceil((day - n.phase) / RELEASE_CADENCE_DAYS)) * RELEASE_CADENCE_DAYS;

/** Whether the lab's release today is open weights (the kind's openness rule; 'partial' opens the model it replaces). */
export function opensRelease(s: GameStateV2, n: Pick<NpcLabState, 'kind' | 'pers'>): boolean {
  const o = persOf(n).openness;
  return o.mode === 'open' || (o.mode === 'chinaRung' && s.china.rung < o.belowRung);
}

/** One NPC lab's capability day: the lag relaxes to its target, the internal model follows G_ref(t − d); on a release day
 *  the public model is replaced. Returns the public model replaced (`prev`) when it released today. */
export function npcCapabilityDay(s: GameStateV2, r: RivalLab, day: number): { released: boolean; prev?: SimpleModel } {
  const n = r.npc!;
  const w = s.hidden.timeline;
  const yr = decimalYear(s);
  treatyClockDay(s); // N6: a verified treaty holds the reference clock the labs read back (npc/shocks.ts)
  const t = npcTarget(s, r);
  n.short = t.short;
  n.slope = t.slope;
  n.dStar = t.dStar;
  n.d = t.dStar + (n.d - t.dStar) * Math.exp(-1 / DIFFUSION_TAU_DAYS);
  const C = r.core.computeOnline;
  setNpcModel(w, r.internal, npcG(s, r), C, yr, n.kind);
  n.hist.push(r.internal.G);
  if (n.hist.length > persOf(n).releaseLagDays + 1) n.hist.shift();
  n.rec = npcRecipe(w, r.internal.G, C);
  let out: { released: boolean; prev?: SimpleModel } = { released: false };
  if (isReleaseDay(n, day)) {
    const prev = r.publicModel;
    n.rel++;
    const pub: SimpleModel = {
      ...r.internal, id: `${r.core.id}-v${n.rel}`, name: `${n.family}-${n.rel}`, day, traitsTrue: { ...r.internal.traitsTrue }, uModes: [...r.internal.uModes],
      isPublic: true, openWeights: opensRelease(s, n),
    };
    setNpcModel(w, pub, npcPublicG(s, r), C, yr, n.kind);
    pub.recG = npcRecipe(w, pub.G, C);
    r.publicModel = pub;
    r.internal = { ...r.internal, id: `${r.core.id}-v${n.rel + 1}i`, name: `${n.family}-${n.rel + 1}`, day };
    out = { released: true, prev };
  }
  r.phys = npcPhys(r, day);
  refreshPublic(s, r); // N9: the values due today (a release, a quarter) are reported
  r.nextBaseDay = nextReleaseDay(n, day + 1);
  return out;
}

// ───────────────────────────── start state (Realistic cast) ─────────────────────────────

/** Posture of a kind (the readers of SafetyPosture: postureOf, intel, traits): today's archetype posture with safety
 *  investment = the kind's safety emphasis and race relaxation = its race response (NPC-LABS §4). */
export function postureOfKind(kind: NpcKindId, base: SafetyPosture = ARCHETYPE_POSTURES[ARCHETYPE_OF_KIND[kind]] ?? ARCHETYPE_POSTURES.bigtech, k: Personality = KINDS[kind]): SafetyPosture {
  return { ...base, safetyInvestment: k.safetyEmphasis, raceRelaxation: k.raceResponse };
}

/** Start finance by archetype (cash; revenue, valuation and raised when the cast has none): actors/rivals.ts FIN. */
type Fin = { cash: number; revenueRun: number; valuation: number; raised: number };

/** U-modes of a lab's lineage from its own stream (the same rule as world/hidden.ts drawLineageUModes). */
function uModesOf(h: HiddenWorld, seed: number, id: string): UModeId[] {
  const rng = new Rng(hash32(seed, `npc:${id}`));
  return UMODES.filter((u) => u.kind !== 'speculative' && rng.chance(h.uModePropensity[u.id])).map((u) => u.id);
}

/** Lag (days) of a cast entry at the start: 30.4 × (its public lag − the leader's), the leader 0 (N2b-1: the simplest rule;
 *  it replaces spec §16 R5's conversion). The upstart has no public model: its [D] band (publicLagBandMonths). */
export function startLagDays(e: NpcCastEntry): number {
  const leader = REALISTIC_CAST.find((x) => x.kind === 'leader')?.start.publicLagMonths ?? 0;
  const m = e.start.publicLagMonths ?? e.start.publicLagBandMonths ?? 0;
  return e.kind === 'leader' ? 0 : DAYS_PER_MONTH * Math.max(0, m - leader);
}

/** Build an NPC lab from a cast entry at day 0. `i`/`n`: its place among the NPC labs (release days staggered evenly over
 *  one cadence). `C0`: its start compute (China: its compute meter's). */
export function initialNpcLab(s: Pick<GameStateV2, 'setup' | 'hidden' | 'time'>, e: NpcCastEntry, i: number, n: number, C0: number, fin: Fin, p?: Personality): RivalLab {
  const h = s.hidden;
  const w = h.timeline;
  const kind = e.kind;
  const k = p ?? KINDS[kind];
  const arch = ARCHETYPE_OF_KIND[kind];
  const china = kind === 'china';
  const id: LabId = china ? 'china' : e.id;
  const posture = china ? h.chinaPosture : postureOfKind(kind, undefined, k);
  const d0 = startLagDays(e);
  const yr0 = decimalYear({ time: { day: 0, startDate: s.time.startDate } } as GameStateV2);
  const phase = 1 + Math.floor((RELEASE_CADENCE_DAYS * i) / Math.max(1, n));
  const npc: NpcLabState = { kind, family: e.family, d: d0, d0, c0: C0, phase, rel: 1, ...(p ? { pers: p } : {}), dStar: d0, short: 0, slope: refSlopePerDay(s, yr0), rec: 0, hist: [], m: 0, p: 0 };
  const uModes = uModesOf(h, s.setup.seed, id);
  const blank = (mid: string, name: string, day: number, isPublic: boolean): SimpleModel => ({
    id: mid, name, day, G: 0, Lg: 0, domains: {} as SimpleModel['domains'], traitsTrue: { ...TRAIT_START }, uModes: [...uModes], isPublic, openWeights: false,
  });
  const internal = blank(`${id}-v2i`, `${e.family}-2`, phase - RELEASE_CADENCE_DAYS, false);
  setNpcModel(w, internal, refGAt(s, yr0 - d0 / 365.25), C0, yr0, kind);
  // The public model at the start: the internal one a release lag ago (none for a lab without a public model: the upstart).
  let publicModel: SimpleModel | undefined;
  if (e.start.publicLagMonths !== null) {
    publicModel = blank(`${id}-v1`, `${e.family}-1`, phase - RELEASE_CADENCE_DAYS, true);
    setNpcModel(w, publicModel, refGAt(s, yr0 - (d0 + k.releaseLagDays) / 365.25), C0, yr0, kind);
    publicModel.openWeights = k.openness.mode === 'open' || k.openness.mode === 'chinaRung';
    publicModel.recG = npcRecipe(w, publicModel.G, C0);
  } else npc.rel = 0;
  if (npc.rel === 0) Object.assign(internal, { id: `${id}-v1i`, name: `${e.family}-1` });
  npc.rec = npcRecipe(w, internal.G, C0);
  // The internal model's history over the last release lag (the reference at its start lag before day 0).
  for (let j = k.releaseLagDays; j >= 0; j--) npc.hist.push(refGAt(s, yr0 - (d0 + j) / 365.25));
  const cap = Math.round(C0 * STAFF_PER_H100E);
  const staff: StaffByRole = { cap, saf: Math.round(cap * 0.15 * posture.safetyInvestment + 10) };
  const la = LAB_ARCHETYPES.find((a) => a.id === arch);
  const lab: RivalLab = {
    core: {
      id, name: e.name, kind: china ? 'china' : 'rival', status: 'active',
      computeOnline: C0,
      split: normalizeSplit({ ...shareRefAt(2025.5), safety: posture.safetyInvestment * 0.15 }),
      staff, tasteHire: 1,
      security: initialSecurity(staff, china ? 2.0 : 2.2),
      milestoneDays: {},
    },
    npc,
    archetype: arch,
    internal,
    publicModel,
    tools: [...e.start.tools],
    nextBaseDay: phase,
    phys: undefined as unknown as RivalLab['phys'],
    finance: {
      cash: fin.cash, revenueRun: e.start.revenueRunB ?? fin.revenueRun, valuation: china ? 0 : (e.start.valuationB ?? 0), raised: china ? 0 : (e.start.equityRaisedB ?? 0),
      commitments: china ? 0 : fin.cash * 2, distress: false,
    },
    visible: china ? { frameworkVersion: 0, clauseType: 'state', testers: [] } : { frameworkVersion: 1, clauseType: ARCHETYPE_CLAUSE[arch] ?? 'conditional', testers: posture.externalAccess > 0.4 ? ['evalGov', 'evalIndep'] : [] },
    intel: { knownIncidents: [] },
    meters: china
      ? { poachAggression: 20, lobbyStance: 0, openness: 85 }
      : { poachAggression: arch === 'upstart' ? 70 : arch === 'maverick' ? 60 : 40, lobbyStance: la?.lobby ?? 0, openness: la?.openness ?? 30 },
    pressure: 0,
    pressureDays: 0,
  };
  lab.phys = npcPhys(lab, 0);
  refreshPublic(s, lab); // the first public values (N9)
  seedRivalLineup(w, lab); // the public model's students, made before the game began (RD-P02)
  return lab;
}

/** The US NPC labs of the Realistic cast for a game: every cast entry but China's, without the leader-kind lab when the
 *  player starts as the frontier leader (the player takes its place). */
export const usCast = (start: string | undefined) => REALISTIC_CAST.filter((e) => e.kind !== 'china' && !(e.kind === 'leader' && (start ?? 'leader') === 'leader'));

/** Roman suffix of the n-th lab of a kind (n >= 2): "II", "III", ... */
const ROMAN = ['', '', 'II', 'III', 'IV', 'V', 'VI'];
/** One US NPC lab to build: its cast entry (a custom lab's: the kind's entry with the chosen lag, its own id, name and
 *  family) and its adjusted seven values (only when the player changed any). */
export interface CastLab { e: NpcCastEntry; p?: Personality }
/** The US NPC labs a game starts with (NPC-LABS §10): 'realistic' is the cast (usCast); a custom list is one lab per
 *  item: the kind's cast entry (compute, money, tools, staff: one typical start per kind) with the item's start lag, and
 *  the item's overrides on the kind's seven values. Names: the first lab of a kind keeps the kind's invented name and
 *  family; the n-th later one adds a Roman numeral ("Lanternworks II" / "Ouvril II", id "lanternworks2"). The
 *  leader-kind lab is left out when the player starts as the frontier leader (the player takes its place). */
export function castOf(setup: Pick<SetupV2, 'cast' | 'start'>): CastLab[] {
  const start = setup.start ?? 'leader';
  if (!setup.cast || setup.cast === 'realistic') return usCast(start).map((e) => ({ e }));
  const seen: Partial<Record<NpcKindId, number>> = {};
  const out: CastLab[] = [];
  for (const c of setup.cast) {
    if (c.kind === 'china' || (c.kind === 'leader' && start === 'leader')) continue;
    const base = REALISTIC_CAST.find((x) => x.kind === c.kind)!;
    const nth = (seen[c.kind] = (seen[c.kind] ?? 0) + 1);
    const m = Math.max(0, Math.min(36, c.lagMonths));
    const sfx = nth > 1 ? ' ' + (ROMAN[nth] ?? String(nth)) : '';
    const e: NpcCastEntry = {
      ...base, id: nth > 1 ? base.id + nth : base.id, name: base.name + sfx, family: base.family + sfx,
      start: { ...base.start, ...(base.start.publicLagMonths === null ? { publicLagBandMonths: m } : { publicLagMonths: m }) },
    };
    out.push({ e, ...(c.personality ? { p: { ...KINDS[c.kind], ...c.personality } } : {}) });
  }
  return out;
}
export const chinaCast = () => REALISTIC_CAST.find((e) => e.kind === 'china')!;
