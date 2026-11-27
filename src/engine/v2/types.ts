// AI27 v2 — THE engine contract (state shape + engine interfaces). Source: design/v2-interfaces.ts, design/V2-SPEC.md.
//
// OWNERSHIP: only WS1 edits this file (V2-SPEC §8.4 rule 1). Other workstreams request changes by PR comment;
// WS1 merges within one day and bumps SCHEMA_REV in core/save.ts on any breaking change.
//
// Deviations from design/v2-interfaces.ts (M0):
//  - SystemCtx gains `bump()` (apply + record a cause) and `day`; `cause()` only records.
//  - BotPolicy.id gains 'capex2x' (V2-SPEC §7.2 F8 bot).
//  - EngineApi.tick accepts optional TickOptions (tests inject probe systems).
//  - Fractions: world.control[*].P and sector A/alpha are 0..1 (research/16 uses %).
// WS1 M1 additions (additive; optional fields unless noted, so no SCHEMA_REV bump):
//  - ModelVersion.build (VersionBuild) and ModelVersion.appeal; BaseModel.startDay/dp/off/serve/monitorability/
//    signals/parentBaseId; TrainingRun.holdUntil/signals.
//  - ProductionReadout gains required `whatIf` and `sdAI` (only WS1 constructs readouts).
//  - Capability: a model's general effective compute G (OOM); its display level is λ(G) (models/capability.ts levelOfG,
//    one map for every lab; model v3 F3 retired the progress coordinate pm).
// M2 integration (SCHEMA_REV 2, migration 1 → 2 in core/save.ts):
//  - WS3 working blocks folded in from finance/ext.ts: FinanceState.ws3, ChipMarket.ws3, PowerGrid.ws3, CapitalMarkets.ws3,
//    Site.ws3 (required; `ensureWs3` fills them on older saves).
//  - WS4 working state folded in from actors/state.ts: GameStateV2.ws4 (optional, created lazily by `ws4(s)`).
//  - WS5 WorldEconomy.fx (WorldFxState) is part of the contract.
//
// Rules:
//  - Everything under GameStateV2 is plain JSON (saves = JSON.stringify). No classes, Maps, Sets, functions,
//    no `undefined` values, NaN or Infinity (hygiene test checks this).
//  - `hidden` and every field documented "hidden" is TRUTH. UI code must not read it except on the end screen;
//    enforced by scripts/v2/lint-hidden.ts (no `hidden.` / `*True` / `selectHidden` under src/ui/v2/ except end/).
//  - Units: Day = integer days since startDate. Money = $B. Compute = H100e. Power = GW (facility). Rates per year
//    unless the name ends in PerDay. Progress `p*` = years of 2024-pace progress (research/11 unit).

import type { DataDraw } from './production/data';

// ───────────────────────────── Ids ─────────────────────────────

export type Day = number;
export type Money = number; // $B
export type H100e = number;

export type BaselineId = 'classic' | 'reality';
/** R3.1: the per-game draw worlds (data/v2/timelineWorlds.ts). */
export type TimelinePresetId = 'tl-fast' | 'tl-central' | 'tl-slow';
/** The world is one of the three timelines; the old named presets and the sampled world are removed. */
export type WorldPresetId = TimelinePresetId;
export type AlignDiffId = 'sampled' | 'easy' | 'medium' | 'hard';
export type EconPresetId = 'normal' | 'ai2027' | 'gate';
export type StorytellerId = 'rising' | 'measured' | 'chaotic';
/** Board presets; 'parent' = a big-tech parent company (start type 'bigtech', R9). */
export type GovernancePresetId = 'legacyNonprofit' | 'nonprofitPBC' | 'pbcTrust' | 'founder' | 'parent';

/** Capability domains (§3.3.1). Union of research/12 (model card) and research/16 (sector) domains. */
export type DomainId = 'CODE' | 'RSCH' | 'REASON' | 'AGENCY' | 'SOCIAL' | 'MEDIA' | 'CYBER' | 'BIO' | 'PHYS';

/** Trait nodes of the causal graph (§3.5.4). Ids map to research/04 T-numbers in data/v2/traits.ts. */
export type TraitId =
  | 'SYC' | 'RH' | 'PROXY' | 'SA' | 'PERSONA' | 'OBF' // learned tendencies
  | 'EA' | 'TGAME' // awareness
  | 'CONCEAL' | 'POWER' | 'AF' | 'SAND' | 'SCHEME' | 'COLLUDE' | 'SUCC' // behaviour when unobserved
  | 'HONEST' | 'CORRIG'; // protective dispositions (negative severity)

/** Training-signal nodes S1-S8 (research/14 §1.5). Intensities 0..1 produced by run design and deployment. */
export type SignalId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9';

export type UModeId =
  | 'U01' | 'U02' | 'U03' | 'U04' | 'U05' | 'U06' | 'U07' | 'U08' | 'U09' | 'U10' | 'U11'
  | 'U12' | 'U13' | 'U14' | 'U15' | 'U16' | 'U17' | 'U18' | 'U19' | 'U20' | 'U21' | 'U22';

export type AgendaId =
  | 'AG01' | 'AG02' | 'AG03' | 'AG04' | 'AG05' | 'AG06' | 'AG07' | 'AG08' | 'AG09'
  | 'AG10' | 'AG11' | 'AG12' | 'AG13' | 'AG14' | 'AG15' | 'AG16' | 'AG17' | 'AG18';

/** Finding ids F01-F49 (research/14 §1.3) plus generic DEAD/NEG/FALSE instances created at runtime. */
export type FindingId = string;
/** Technique ids are defined in data/v2/techniques.ts; each belongs to one agenda and one tool family. */
export type TechniqueId = string;
/** Tool families for detection (§3.5.6): behavioural evals, CoT monitors, white-box, oracle/formal. */
export type ToolFamily = 'BB' | 'COT' | 'WB' | 'OR';

/** Paradigm research projects P01-P27 (research/12 §0.7). */
export type ParadigmId = string;
/** Benchmark ids (data/v2/benchmarks.ts), e.g. 'patchbench', 'horizon', 'ctf'. */
export type BenchmarkId = string;

export type SectorId =
  | 'SOFT' | 'OFFICE' | 'FIN' | 'LEGAL' | 'MEDIA' | 'SCI' | 'HEALTH'
  | 'EDU' | 'GOV' | 'MIL' | 'MFG' | 'LOG' | 'ENGY' | 'SERV';
export type RegionId = 'US' | 'CN' | 'ROW';
export type ControlDomainId = 'ECON' | 'GOV' | 'MIL' | 'INFRA';
/** World technologies W01-W29 (= research/16 T1-T29, renamed to avoid clashing with trait T-ids). */
export type WorldTechId = string;

export type BlocId =
  | 'safety' | 'pause' | 'accel' | 'bigtech' | 'chip' | 'hawks' | 'defense' | 'populist'
  | 'progressive' | 'labor' | 'civlib' | 'parents' | 'creatives' | 'ratepayers' | 'measurers';

export type LabId = string; // 'player' | rival ids | 'china'
export type CounterpartyId =
  | 'exec' | 'congress' | 'states' | 'evalGov' | 'evalIndep' | 'academia' | 'china'
  | `rival:${string}` | `bloc:${BlocId}`;

export type StreamId =
  | 'world' | 'prod' | 'runs' | 'safety' | 'incidents' | 'security' | 'market' | 'finance'
  | 'actors' | 'rivals' | 'china' | 'worldfx' | 'events' | 'endings' | 'company';

export type WorkstreamId = 'WS1' | 'WS2' | 'WS3' | 'WS4' | 'WS5' | 'WS6' | 'WS7';

// ───────────────────────────── Root state ─────────────────────────────

export interface GameStateV2 {
  version: 2;
  schemaRev: number; // bump on any breaking change; save.ts migrates within v2
  setup: SetupV2;
  hidden: HiddenWorld; // TRUTH (end screen only)
  time: TimeState;
  rng: Record<StreamId, number>; // mulberry32 states per stream (§2.4)

  player: PlayerLab;
  rivals: RivalLab[]; // US rivals (never deleted; status tracks merges/bankruptcy)
  china: ChinaActor;
  gov: GovActor;
  pub: PublicActor;
  researchBodies: ResearchBodies;
  relations: RelationsState;
  commitments: Commitment[];

  market: ChipMarket;
  power: PowerGrid;
  capital: CapitalMarkets;
  world: WorldEconomy;
  knowledge: PublicKnowledge; // what the whole world has learned (published findings, revealed U-modes)

  events: EventQueue;
  log: LogEntry[]; // capped 600, oldest dropped
  headlines: Headline[]; // capped 200
  causes: CauseLedger;
  series: SeriesV2;
  decisions: DecisionRecord[]; // for end-screen replay
  tutorial: TutorialState;
  flags: Record<string, number | boolean | string>;
  ending?: EndingV2;
  /** WS4 working state (relations memory, timers, cover-ups, ladder bookkeeping). Created lazily by `ws4(s)`. */
  ws4?: Ws4State;
}

export interface SetupV2 {
  baseline: BaselineId;
  world: WorldPresetId;
  alignment: AlignDiffId;
  econ: EconPresetId | 'sampled';
  gov: string; // GOV_PRESETS id or 'realistic'
  public: string;
  china: string;
  rivals: string; // archetype id for all, or 'realistic'
  rivalCount: 3 | 4;
  governance: GovernancePresetId;
  storyteller: StorytellerId;
  tutorial: boolean;
  seed: number;
  companyName: string;
  /** Start type (STRUCTURE §4.8, BUILD-PLAN R9; data/v2/starts.ts). */
  start: StartType;
  /** Add the simulated AI-2027 leader lab to the world (BUILD-PLAN R2, D1): on for every start but the leader's. */
  leaderLab: boolean;
}

/** The four starts (BUILD-PLAN R9): a spinout, a challenger, a big-tech lab, or the frontier leader. */
export type StartType = 'spinout' | 'challenger' | 'bigtech' | 'leader';

export interface TimeState {
  day: Day;
  startDate: string; // ISO, '2025-07-01'
  /** 0 paused, 1..4 speeds, 5 fast-forward (§1.4). UI-only but saved for convenience. */
  speed: 0 | 1 | 2 | 3 | 4 | 5;
  /** Fast-forward target (stop when reached or on any stop condition). */
  ffUntil?: { kind: 'day' | 'event' | 'runDone' | 'quarter' | 'milestone'; day?: Day };
}

// ───────────────────────────── Hidden world (§2.3) ─────────────────────────────

/** v1 timelines world (src/engine/types.ts World) — reused verbatim, plus v2 fields. */
export interface TimelineWorld {
  label: string;
  h0: number; hSC: number; T: number; growth: 'super' | 'exp' | 'sub'; decay: number;
  g0: number; cs: number; base0: number; share: number; pEx: number; sEx: number;
  G: [number, number, number]; p0: number; aifm: boolean; sarSpeed?: number;
  computeElasticity: number; computeGrowth: number; alignDifficulty: number; doomThreshold: number;
  chinaEfficiency: number; neuraleseBoost: number;
  // v2 additions
  /** Production-function parameters (research/13 §1.4). The player and the other labs (model v3 F1) read only the CES
   *  parameters (ρc, λ, u, v, ρ, ζ, m2b). */
  prod: ProdParams;
  /** Model v3 V3: per-preset work-type calibration (data/v2/workTypes.ts V3_CAL): G_SC (OOM of effective compute a
   *  superhuman coder needs), Δ_bm (best-to-median human gap, OOM), r (returns to research), sd_SC (AI research taste at
   *  the superhuman coder, SD; AIFM's "AI taste at AC"), tasteLimit (AIFM taste_limit: a taste is bounded by m2b^(1 + tasteLimit)). */
  v3: { gSC: number; dBM: number; r: number; sdSC: number; tasteLimit: number;
    /** R2.3 (workTypes.ts V3Cal): the horizon law and the research pace of the world. Absent in a save made before: 4.2, 0, 1. */
    h50PerOOM?: number; h50Accel?: number; pace?: number;
    /** Item A (workTypes.ts V3Cal): the age of the research lines' start pools, years of their start input. Absent: n₀ from LINE_FIT. */
    stockAgeYears?: number;
    /** R3.3 (workTypes.ts V3Cal): the coverage logistic of the world: its scale (OOM) and its value at the best human's fit. Absent: COVER.s, COVER.top. */
    covS?: number; covTop?: number };
  /** R3.1: the AI Futures Model run this per-game draw world (tl-fast / tl-central / tl-slow) represents: its index in the timeline's
   *  SAR group and its id (data/v2/timelineDraws.ts). Absent in every other world. */
  aifmRun?: { index: number; id: string };
}

export interface ProdParams {
  rc: number; // coding-task substitutability ρc (−2)
  lam: number; // parallel penalty λ (0.5)
  La: number; // infinite-labor asymptote (100; 15 for authors2026)
  Ca: number; // infinite-compute asymptote (1000)
  slow10: number; // slowdown at 10x less experiment compute (2.5 / 2.8)
  rho: number; u: number; v: number; zeta: number; // derived (cesFromAsymptotes)
  m2b: number; // taste top/median (3.25 / 3.7)
}

/** Six safety world latents, standard normal (research/14 §1.1). */
export interface SafetyLatents {
  legibility: number; // λ1
  cotLoadBearing: number; // λ2 (player-modified by latent reasoning, §3.5.1)
  verificationAdvantage: number; // λ3
  benignGeneralization: number; // λ4
  formalizability: number; // λ5
  schemingDefault: number; // λ6
}

export interface HiddenWorld {
  timeline: TimelineWorld;
  latents: SafetyLatents;
  agendaEfficacy: Record<AgendaId, number>; // e ∈ [0,1]
  paradigmSuccess: Record<ParadigmId, boolean>; // drawn at start; revealed when the project resolves
  edgeWeights: Record<string, number>; // edge id (E01..E26) -> realised w for this world
  uModePropensity: Record<UModeId, number>; // per-world presence probability per new lineage
  econ: EconPresetId;
  doomThreshold: number;
  /** Model v3 E9: the world's tolerance noise ε_w ~ Logistic(0, 0.06) (a hash of the seed, no stream draw): control is
   *  lost when exposure > doomThreshold + ε_w (safety/control.ts lossThreshold). */
  toleranceNoise: number;
  /** SR-24b: organism realism r ~ U[0.4, 1.0] (a hash of the seed): real recall of an instrument = its recall on planted
   *  model organisms × r (safety/validation.ts). Hidden: the lab knows only the range. */
  organismRealism: number;
  /** CP3i / RF-S10: per run method, its hidden strength q ~ U[0, 2] (1 = as tested) on models well above the capability
   *  its source tested (a hash of the seed; safety/methods.ts methodStrength). Hidden: the lab knows only the range. */
  methodScale: Record<string, number>;
  difficultyMult: number; // D_w = exp(0.35(λ6−λ4)) × align preset (§3.5.4)
  actorPresets: { gov: string; public: string; china: string; rivals: Record<LabId, string> };
  rivalPostures: Record<LabId, SafetyPosture>;
  chinaPosture: SafetyPosture;
}

// ───────────────────────────── Labs, models, runs ─────────────────────────────

export interface StaffByRole { cap: number; saf: number; }

/** Compute pools a lab splits its online compute into (§3.4.2). Fractions sum to 1. */
/** RD-A05a: ONE flat allocation of a lab's compute to its uses, each a share of total compute, summing to 1 with
 *  `idle` (departments/split.ts). The other labs' engineering, safetyAgents and monitors are 0. */
export interface ComputeSplit {
  training: number; synthetic: number; experiments: number;
  /** Routine and frontier research agents. */
  routine: number; frontier: number;
  /** Engineering agents (coding for the build queue). */
  engineering: number;
  safetyAgents: number;
  /** Monitors on the internal fleets (the monitoring budget). */
  monitors: number;
  /** Safety research: open cases first, the research lines the rest. */
  safety: number;
  serving: number;
  /** Unallocated (DD-19: shown, never silently rerouted). */
  idle: number;
}

export interface LabCore {
  id: LabId;
  name: string;
  kind: 'player' | 'rival' | 'china';
  status: 'active' | 'merged' | 'bankrupt' | 'nationalized' | 'shutdown';
  mergedInto?: LabId;
  /** Day the lab's internal model first crossed SC; freezes its reference compute term (§3.1.3). */
  scDay?: Day;
  computeOnline: H100e;
  split: ComputeSplit;
  staff: StaffByRole;
  /** τ_h, star-hire taste multiplier (research/13). */
  tasteHire: number;
  models: ModelsState;
  deployments: Deployment[];
  security: SecurityState;
  /** Cached production readout from the last daily tick (not authoritative; recomputable). */
  prodCache?: ProductionReadout;
  milestoneDays: Partial<Record<MilestoneIdx, Day>>; // first crossings only (v1 bug #3 fix)
}

export type MilestoneIdx = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ModelsState {
  bases: BaseModel[];
  versions: ModelVersion[];
  runs: TrainingRun[];
  /** Continual-learning stream (P08) if active: the version id being updated in place. RD-T03: pool FLOP accrues daily
   *  (`flop`) and is spent every STREAM_PERIOD_DAYS from `periodDay` on continued pretraining and an RL refresh. */
  stream?: {
    versionId: string; startedDay: Day; lastAuditDay: Day;
    periodDay?: Day;
    flop?: number;
  };
  nextName: number; // naming counter
  /** Model naming (design/MODEL-NAMING.md): the chosen rung theme and tier words (absent: Agent-n, generic) and the last
   *  major number used per rung (index 0 = rung 1; reserved at a base run's launch, gaps kept). */
  naming?: { theme: string; tiers: string };
  majors?: number[];
  /** Model v3 D7: eval suites queued or running (work: research engineers, engineers, inference compute). */
  evals: EvalTask[];
  /** Model v3 D7: eval work done so far (readout): suites finished, research-engineer and engineer team-weeks, H100e-days. */
  evalSpent: { suites: number; reTW: number; engTW: number; h100eDays: number };
}

/** Model v3 D7: depth of an eval suite (rollouts per benchmark: noise, elicitation, cost; data/v2/evals.ts). */
export type EvalDepth = 'basic' | 'full' | 'deep';
/** Model v3 D7: one eval suite as a task. Research engineers (or the external evaluator's staff) and the experiment
 *  pool's compute advance `progress` together; the engineers' part is a build-queue item (`engId` until it is built). */
export interface EvalTask {
  id: string;
  versionId: string;
  depth: EvalDepth;
  by: 'self' | 'evalGov' | 'evalIndep';
  /** Why it runs: the release gate (the version waits in 'evaluating'), the standing policy, or the player's order. */
  why: 'release' | 'policy' | 'order';
  day: Day;
  /** Research-engineer team-weeks (effective work), engineer team-weeks, inference compute (H100e-days). */
  reTW: number;
  engTW: number;
  h100eDays: number;
  /** Share done of the research-engineer work and its compute (0..1). */
  progress: number;
  /** The engineers' build item while it is not built. */
  engId?: string;
}

/** Name parts of a base: rung 1-7 (0 = an imported family, no rung), major within the rung, continued-pretraining count. */
export interface BaseNameParts { rung: number; major: number; cont: number }
/** Name parts of a version (MODEL-NAMING §5-7): a full version's minor and stream patch; a student's tier band (0-3), its
 *  number within the band, its full-size ancestor and that ancestor's patch when it was made. */
export interface VersionNameParts { minor?: number; patch?: number; tier?: number; tierN?: number; anc?: string; ancPatch?: number }

export interface BaseModel {
  id: string;
  name: string; // e.g. "Atlas-3"
  day: Day; // completion
  /** Physical pretraining FLOP (6·N_active·tokens; a continued base adds its FLOP). */
  flop: number;
  /** Active parameters and training tokens (MODEL-V3 §3.2). */
  params: number;
  tokens: number;
  /** Pretraining effective compute G_pre (OOM, frozen at launch: MODEL-V3 §3.2). */
  gPre: number;
  /** Pretraining recipe efficiency frozen at launch (OOM; E_START + the pretraining stack). gPre − ePre is the physical part, so
   *  a continual-learning stream can re-apply today's recipe. */
  ePre: number;
  design: BaseDesign;
  /** Day the run started (the recipe is frozen here). Absent = `day`. */
  startDay?: Day;
  /** Data-mix specialisation per domain (OOM, MODEL-V3 §2.3 s_d,data). */
  sD?: Partial<Record<DomainId, number>>;
  /** Data repetition at training: epochs over the unique tokens. */
  epochs?: number;
  /** Serving FLOP per token of the base (2·N_active × the shape's token multiplier; model v3 V4), set when it is made. */
  fpt: number;
  /** Monitorability cap from the base shape (latent = 0.05). */
  monitorability?: number;
  /** Trait-pressure signals from the base design (S4, S5, S6 …) for WS2. */
  signals?: Partial<Record<SignalId, number>>;
  /** Model v3 AF2: the teachers of its drawn synthetic tokens (version id; '' = the start stock) and their shares of its
   *  tokens, which its starting traits imitated (safety/traits.ts imitatedStart). Absent on bases made before AF2. */
  teacherData?: { id: string; share: number }[];
  /** Continue-train parent. */
  parentBaseId?: string;
  lineage: string; // traits + U-mode family; distill/continue keep parent lineage
  /** Name parts (MODEL-NAMING §2-4); `name` is rendered from them (models/naming.ts). */
  nm?: BaseNameParts;
  traitsTrue: TraitVector; // hidden
  uModes: UModeId[]; // hidden: present in this lineage
}

export interface ModelVersion {
  id: string;
  name: string; // e.g. "Atlas-3.2"
  baseId: string;
  parentVersionId?: string;
  /** RD-P01b: a cheap tier the "Auto-make cheap tiers" policy distilled: it joins the lineup of every live product its
   *  teacher (parentVersionId) is the main model of once ready and evaluated, then the mark is dropped. */
  autoTier?: true;
  /** Name parts (MODEL-NAMING §5-7); `name` is rendered from them (models/naming.ts). */
  nm?: VersionNameParts;
  day: Day;
  /** RD-X04: the player's recipe G (RECIPE_F) when the version was made: what releasing it reveals (diffusion.ts). */
  recG?: number;
  variant: Variant;
  /** RD-P05 (DD-02 a): the day its weights were released openly (the `releaseOpen` act, one-way). Gov and Trusted are
   *  who a product is offered to (its channel and usage terms), not kinds of model. */
  openDay?: Day;
  design: PostDesign;
  /** TRUE general effective compute G (OOM; hidden; benchmarks are noisy reads of its level λ(G)). Model v3 F3:
   *  replaces the progress coordinate pm = Φ(G). */
  G: number;
  /** TRUE general level 0..15 and domain levels (hidden). */
  Lg: number;
  domains: Record<DomainId, number>;
  traitsTrue: TraitVector; // hidden
  masks: Record<TraitId, Partial<Record<ToolFamily, number>>>; // hidden: how much each family is fooled
  uModes: UModeId[]; // hidden
  monitorability: number; // 0..1, visible (from design + measured controllability)
  /** Serving FLOP per token (2·N_active × the shape's token multiplier × the serving stack and design at creation;
   *  model v3 V4), set when the version is made; costs, prices and capacity read it. */
  fpt: number;
  /** Active parameters when they differ from the base's (a distilled student). */
  params?: number;
  evals: EvalRecord; // what the player has measured
  beliefs: Record<TraitId, TraitBelief>; // player's posterior per trait
  status: 'evaluating' | 'ready' | 'deployed' | 'retired' | 'rolledBack';
  /** Dangerous-capability flags the player has measured (drive commitments and events). */
  flags: { bioUplift?: boolean; cyberOffense?: boolean; replication?: boolean; persuasion?: boolean };
  /** How G was built (MODEL-V3 §2); lets the engine recompute G for streams and domains. Hidden. */
  build?: VersionBuild;
  /** RD-B17 (readout): the recipe it took from its own run. `rlDay` = launch day of the post-training or amplify run (RL
   *  recipe and environment suites frozen then); `post` = made by a post-training run (domain effects and the serving
   *  stack frozen at its launch too, RD-B02). Absent for distilled students, imports and older saves. */
  trained?: { rlDay: Day; post: boolean };
  /** Consumer appeal from preference training (0.7–1.2, §3.3.2 D); visible; the consumer market reads it (worldfx/mix.ts appealOf, RD-B11: the one appeal table). */
  appeal?: number;
}

/** Capability build of a version (MODEL-V3 §2, §4): G = gPre + dgRL + dg. Hidden. */
export interface VersionBuild {
  /** Pretraining effective compute of its base (OOM; a stream's continued pretraining adds to it, RD-T03). */
  gPre: number;
  /** Physical pretraining FLOP of the base (the RL curve's midpoint scales with it), plus the stream's. */
  flopPre: number;
  /** RD-T03: tokens the stream's continued pretraining drew on this version, on top of its base's. */
  addTokens?: number;
  /** RL FLOP of the version (all families), its family weights and the RL recipe e_RL frozen at launch (OOM). */
  rlFlop: number;
  rlW: Partial<Record<RLFamily, number>>;
  eRL: number;
  /** RL ceiling raise from the RL stack frozen at launch (OOM added to the curve's asymptote; model v3 V2). */
  aRL?: number;
  /** Environment-suite fidelity per family frozen at launch (scales each family's ceiling; model v3 D5). Absent = 1. */
  rlFid?: Partial<Record<RLFamily, number>>;
  /** RL gain: general (mean over the cognitive domains) and per domain (OOM). */
  dgRL: number;
  dgRLd: Partial<Record<DomainId, number>>;
  /** Other design effects (preference, reasoning, alignment, run penalties, distillation gap), OOM. */
  dg: number;
  /** Data-mix specialisation per domain (OOM, from the base). */
  sD: Partial<Record<DomainId, number>>;
  /** Design domain ΔG (OOM of the domain's effective compute: preference; RD-U01, was level offsets). Part of
   *  gOfDomain, so the fit and the displayed domain level λ(G_d) both read it. */
  dgD: Partial<Record<DomainId, number>>;
  /** Horizon multiplier (long-horizon RL, P07, P12). */
  h80Mult: number;
  /** Trait-pressure signals of the run(s) that produced it, for WS2 applyRunToTraits. */
  signals: Partial<Record<SignalId, number>>;
}

/** 'imported' (D6, spinout start): an open-weight model brought in from outside; post-trainable, internal use only. */
export type Variant = 'full' | 'mini' | 'imported';

export type TraitVector = Record<TraitId, number>; // 0..1 propensity strength

/** One piece of evidence behind a belief (SR-06, SAFETY-REDESIGN §2.2 concept 2): the day, where it came from, what it
 *  read and its noise (σ of the reading; for a prior or a predicted start, the sd it contributed). `source` is
 *  "<kind>/<family>" for an instrument reading (suite/BB, external/BB, bench/BB, monitor/COT, monitor/WB, audit/WB,
 *  finding/<family>, case/<family>), "case" for a case verdict, "prior" for the public lineage prior, "start" for the
 *  starting model's evals, "inherit:<parent id>" for a new model's start (the parent's belief moved by the run's
 *  predicted change), "stream" for a stream version's training since the last entry. */
export interface BeliefEvidence { day: Day; source: string; reading: number; noise: number; }

/** `evidence`: the last BELIEF_EVIDENCE_CAP (20) updates of this belief, oldest first. */
export interface TraitBelief { est: number; sd: number; clarity: number; lastObsDay?: Day; evidence: BeliefEvidence[]; }

export interface EvalRecord {
  suiteDay?: Day; // last full suite run
  /** Per benchmark: the reading pooled by inverse variance over the suites on its current edition (RF-R2; score ± sd);
   *  day / by = the latest suite's. Special rows (horizon, speedrun): the latest reading. */
  bench: Record<BenchmarkId, { score: number; sd: number; day: Day; by: 'self' | 'evalGov' | 'evalIndep' }>;
  /** Alignment evals (SR-07): k of n test scenarios with misbehaviour, rate = k/n, 90% Wilson interval lo–hi, sd = the
   *  interval's sd (safety/alignmentEvals.ts). */
  safety: Record<string, { rate: number; sd: number; day: Day; by: 'self' | 'evalGov' | 'evalIndep'; k: number; n: number; lo: number; hi: number }>;
  /** Measured general level (RD-M01, DD-08): fitted from the pooled benchmark readings (models/benchmarks.ts fitDomains, fitGeneral). */
  measuredL?: number;
  /** RD-M01: fitted level per domain with a benchmark reading (MEDIA, PHYS have none). */
  measuredDom?: Partial<Record<DomainId, number>>;
  /** RD-M01: sd (L) of the fitted general level. */
  fitSd?: number;
  /** Full suites run on this version (M1: the estimate's band narrows as 0.2/√n). */
  nSuites?: number;
  /** Model v3 D7: precision of the measurement in full-suite equivalents (Σ rollouts ÷ the full suite's) of the suites
   *  in the pooled readings (RF-R2: restarts when the version changed in place); the band of a record with no fit is
   *  0.2/√nEff. Absent on old records: nSuites. */
  nEff?: number;
  /** Model v3 F6: the recipe the version embodied at its last suite (OOM, stacks.ts inPlaceRecipe; "changed in place"
   *  for the re-run policy; replaces D7's lgAt, the true level, which old saves still carry inert). */
  recipeAt?: number;
  /** Model v3 D7: depth of the last suite. */
  depth?: EvalDepth;
  /** SR-22: the last suite's AI share, spot-check, expected (believed mean misbehaviour rate over the safety evals)
   *  vs observed (the measured mean rate). */
  suiteJob?: SafJobResult;
}

export type RunKind = 'base' | 'post' | 'continue' | 'distill';

/** A run's launch snapshot (RD-B02, SYNTHESIS theme T). Base: pre, draw. Continue: pre, draw (its base's design on
 *  the portfolio at launch: the trait hook's S5). Post and IDA: rlMid, rlCeil, fid, exploit, domainG, p07, serveOom.
 *  Distillation: none (its inputs are the teacher). */
export interface RunRecipe {
  /** Pretraining recipe efficiency e_pre at the run's FLOP (OOM; base, continue). */
  pre?: number;
  /** The data the base draws from the portfolio at launch (model v3 D3 / D11; base, continue). A continue run's draw is
   *  cumulative: its parent's tokens plus the added ones (added FLOP ÷ 6·N_active), with the parent's mix (RD-T02). */
  draw?: DataDraw;
  /** Continue run: D_eff of the parent's tokens alone, drawn on the same portfolio at launch (the added part's data is
   *  the cumulative draw minus this; models/effective.ts continueFData, RD-T02). */
  prevDEff?: number;
  /** RL stack efficiency and ceiling (OOM); the environment suites' fidelity and exploitability per family (model v3 D5). */
  rlMid?: number;
  rlCeil?: number;
  fid?: Partial<Record<RLFamily, number>>;
  exploit?: Partial<Record<RLFamily, number>>;
  /** Domain effects of adopted ideas (OOM per domain, research.domainG) the version gets. */
  domainG?: Partial<Record<DomainId, number>>;
  /** P07 long context + memory adopted at launch: the version's horizon multiplier and persistent memory (E22). */
  p07?: boolean;
  /** The serving stack's FLOP part (OOM): the version's serve cost × 10^−serveOom. */
  serveOom?: number;
}

export interface TrainingRun {
  id: string;
  kind: RunKind;
  name: string;
  startDay: Day;
  /** RD-P01b: a distillation the "Auto-make cheap tiers" policy queued (its student gets ModelVersion.autoTier). */
  autoTier?: true;
  /** FLOP required and done; duration = FLOP ÷ rate, no minimum length (MODEL-V3 §3.3). */
  flopNeeded: number;
  flopDone: number;
  poolShare: number; // share of the training pool this run takes (player sets priority)
  cashCost: Money; // environment/data budget committed at launch (compute is the pool)
  baseId?: string; // for post/continue/distill
  teacherVersionId?: string; // distill / synthetic-heavy; the grader of an RL run with grader "teacher"
  /** RD-T01a (DD-06): RL with the teacher as grader. On a post (RL) run, `teacher` puts teacherVersionId in the loop:
   *  today's IDA cycle (P18). The ways a model is made: kind base or continue (pretraining), post (RL; with this field,
   *  IDA), distill (a small model on a teacher's outputs); the continual-learning stream is models.stream, not a run. */
  grader?: 'teacher';
  base?: BaseDesign;
  post?: PostDesign;
  predicted: RunPrediction; // shown on the run card, with noise band
  /** UB-2b: the lab's forecast at launch (runs.ts runForecast: believed recipe, measured start model; level and sd),
   *  readouts only (the run queue's band, predicted vs measured). Absent on runs launched before it or with nothing measured. */
  forecast?: { mid: number; sd: number };
  /** A pretraining or continued-pretraining run: the name parts of the base it will make, reserved at launch (MODEL-NAMING §3). */
  nm?: BaseNameParts;
  /** UB-B: the day the run finished and what it made (a base id or a version id); readouts only (TRAINING › Runs).
   *  Absent on runs finished before UB-B: runResult pairs those by kind, order and dates. */
  endDay?: Day;
  resultId?: string;
  status: 'running' | 'paused' | 'done' | 'failed' | 'cancelled';
  /** Build item that sets the run up (R5): no FLOP accrues until the engineers finish it ("waiting for engineers"). */
  setupId?: string;
  /** Day the setup finished and training began (R5). */
  readyDay?: Day;
  /** Everything the run's result depends on, frozen at launch (model v3 V2, D5; RD-B02): completion and the WS2 trait hook
   *  read only this. Absent only on a run-like built for a preview (a launch today). */
  recipe?: RunRecipe;
  /** Distillation: student active parameters; distillation and continued-pretraining runs: tokens. */
  studentParams?: number;
  tokens?: number;
  /** Trait-pressure signals S1–S8 of this run's design (for WS2 applyRunToTraits). */
  signals?: Partial<Record<SignalId, number>>;
}

export interface BaseDesign {
  /** Active parameters (MoE: total = 8 × active). */
  params: number;
  /** Training tokens per active parameter (20 = compute-optimal; more = overtrained: cheaper to serve, weaker per FLOP). */
  tpp: number;
  shape: 'dense' | 'moe' | 'latent';
  /** Data-mix preset: a named per-domain weight target for the draw (data/v2/runDesign.ts BASE_DATA). */
  data: 'balanced' | 'codeMath' | 'science' | 'synthetic' | 'multimodal';
  /** RD-T08: explicit target domain shares for the draw, in place of the portfolio's own mix (RefBot's fixed 2025
   *  shares, bots/ref.ts REFBOT_DATA_SHARES); the preset's weights apply on top. */
  mixShares?: Partial<Record<DomainId, number>>;
  curation: { quality: boolean; hazard: boolean; safetyPretrain: boolean };
}

export interface PostDesign {
  pref: 'minimal' | 'engagement' | 'constitution' | 'persuasion';
  rlFocus: RLFamily[] | 'broad'; // pick 2 or broad
  /** RL budget: RL FLOP as a share of the base's pretraining FLOP (light 0.03, standard 0.15, heavy 0.4). */
  rlBudget: 'light' | 'standard' | 'heavy';
  cot: 'visible' | 'pressured' | 'faithful' | 'latent';
  safety: 'minimal' | 'standard' | 'heavy';
  /** SR-14: the training-time safety methods this run uses (fix technique ids, safety/methods.ts METHODS) and the
   *  instruments it trains against (`against:<id>`, Goodhart, §3.5.6). A method's effect applies only if listed here.
   *  SR-14b: inoculation prompting is the method T-INOC (no separate boolean). */
  methods: TechniqueId[];
}

export type RLFamily = 'math' | 'swe' | 'computerUse' | 'mlResearch' | 'longHorizon' | 'cyber' | 'bio';

/** An RL environment suite (model v3 D5, MODEL-V3 §4.3; models/suites.ts): one per RL family. Fidelity = f(live tasks ×
 *  grader quality) (RD-T07); the expert data its builds bought stays on the family's `expert:<family>` asset. */
export interface EnvSuite {
  /** Exploitability: share of the suite's tasks whose grader a policy can game (0–1); S2 reads it. */
  exploit: number;
  /** Live tasks (RD-T07): the builds' expert tokens ÷ TASK_TOKENS_T, less those gone stale for lack of upkeep. */
  tasks: number;
  /** Builds (expert data built in) and hardening passes finished. */
  builds: number;
  hardenings: number;
}

export interface RunPrediction {
  Lg: [number, number]; // band
  domains: Record<DomainId, [number, number]>;
  signals: Record<SignalId, number>; // shown as ▲ arrows (trait pressure)
  etaDays: number;
  /** Serving FLOP per token of the model the run would make (ModelVersion.fpt; a base run: the base's). */
  fpt: number;
  monitorability: 'high' | 'medium' | 'low' | 'none';
}

// ───────────────────────────── Deployments & products (§3.3.6) ─────────────────────────────

export type Channel = 'consumer' | 'api' | 'enterprise' | 'vetted' | 'internal' | 'open';

/** What a deployment is (R6): a product customers buy, the internal research fleet, or an open-weights release. */
export type DeploymentKind = 'product' | 'internal' | 'open';
/** MK-6 (design/MARKET.md M6): a product's price stance. 'profit': the seller's Nash–Bertrand margin M over each tier's
 *  serving cost; 'share': WIN_SHARE_FRACTION × M (data/v2/serving.ts). */
export type PriceStance = 'profit' | 'share';
/** MK-11 (design/MARKET.md M14): a product's certification in a sector that has one (data/v2/tools.ts CERT_SECTORS),
 *  started the first day the product carries a harness covering the sector (models/certs.ts certStep); `certDone` the
 *  day it ends. It acts only while the product carries such a harness (certs.ts certifiedHere). */
export interface Certification { sector: SectorId; certDone: Day }

/** A deployment. External ones are products (STRUCTURE §4.4): a package of model (+ an optional lineup of other models) and an
 *  optional monitor, a price stance, safeguards, KYC, effort and features, all editable while live (R4, R6). */
export interface Deployment {
  id: string;
  kind: DeploymentKind;
  versionId: string;
  /** RD-P01a (DD-01): the product's lineup after its main model (versionId): other real versions the lab owns (distilled
   *  minis, older full models, post-trains) in the player's order. Sector products sell each entry as a tier at its own
   *  fit and serving cost and the product's markup (worldfx/serving.ts productLineup); Chat's free users get one lineup
   *  model (freeTierId), its paying users the main model. No entry: the main model alone. */
  lineup?: string[];
  /** RD-P01a: Chat's free-tier slot: the lineup model (the main one or an entry) its free users get (worldfx/serving.ts
   *  chatFreeTier); unset or not in the lineup: the lineup's cheapest model to serve. */
  freeTierId?: string;
  /** Monitor model watching this product's outputs (R6, D7): catches incidents before customers see them, at a
   *  serving overhead. */
  monitorId?: string;
  channel: Channel;
  startDay: Day;
  /** SR-19: the Safety framework hold stopping this deployment today (usage 0 while set; refreshed daily). */
  held?: string;
  /** RF-S13: the safeguards the Safety framework applied itself ("versionId:safeguard"; safety/packages.ts
   *  autoApplyPackages): applied once, so a part the player removes is not put back. */
  frameworkApplied?: string[];
  /** Day the current version went into this deployment (M4: a swap keeps startDay; set by swapDeployment). */
  versionSince?: Day;
  /** MK-6 (M6): the price stance (worldfx/mix.ts: every tier at its serving cost + the lab's margin M, × WIN_SHARE_FRACTION
   *  on 'share'). */
  stance: PriceStance;
  /** Share of the serving pool: set by hand when the Auto serving policy is off; with Auto on it is written daily
   *  from the split (what this product actually gets). Internal uses the agents pool. */
  servingShare: number;
  /** MK-11: the product tools switched on for this product (data/v2/tools.ts ProductToolId; built lab-wide first, R6). */
  features: string[];
  safeguards: 'minimal' | 'standard' | 'classifiers' | 'hardened';
  /** Owned safeguard items (SR-13: control protocol, human review, restriction, comms lockdown; safety/safeguards.ts). */
  guards: SafeguardItem[];
  /** MK-11 (M14): this product's sector certifications (started or done; models/certs.ts). They move to the next launch
   *  on the channel (a relaunch) and stop acting when the product is retired. */
  certs: Certification[];
  usagePolicy: { noDropInReplacement: boolean; noSurveillance: boolean; noAutonomousWeapons: boolean; minorsProtections: boolean };
  kyc: 0 | 1 | 2 | 3; // RD-P09: buyer verification (api/agents): each level verifies 10× more of the anonymous buyers
  status: 'live' | 'withdrawn';
  // derived each day
  revenueRate?: Money; // $B/yr
  demandBound?: 'capacity' | 'demand' | 'price' | 'quality';
  /** Serving H100e it needs (incl. monitor), gets, and what Auto cut (R6; derived each day). */
  needH100e?: number;
  servedH100e?: number;
  cutH100e?: number;
  /** Chat: the part of needH100e its paying users need (served first, on the main model; the rest is free users on the
   *  mini when it has one). A6: usage data counts each tier's tokens at its own model's FLOP per token. */
  needPaidH100e?: number;
  /** RD-P09 / RD-P10: output tokens served per day (the sum of servedBy); the distillation leak through this product
   *  reads its anonymous share (production/diffusion.ts teacherAccess). */
  servedTokensDay?: number;
  /** RD-P10: output tokens a day each model of the product serves (version id → tokens): the demand its buyers and users
   *  put on that model (billed hours per lineup tier, Chat's paying users on the main model and free users on the free
   *  tier), as far as the serving split serves it, at the model's own FLOP per token. Spare compute is not usage. Misuse
   *  exposure and product incident sites read it (safety/incidents.ts), never servingShare (an allocation only). */
  servedBy?: Record<string, number>;
  /** Revenue run-rate at each 30-day mark, last 12 (product card chart). */
  hist?: number[];
}

// ───────────────────────────── Paradigms (§3.3.5) ─────────────────────────────

/** RD-R04: a paradigm's state is its tree node (PlayerLab.tree; known = adopted, models/paradigms.ts adopted()). */

// ───────────────────────────── Tech tree (TECH-TREE.md, BUILD-PLAN R4) ─────────────────────────────

export interface TreeNodeState {
  /** researching: an attempt has started (progress kept while paused); known: works; failed: the last attempt failed. */
  status: 'researching' | 'known' | 'failed';
  progress: number; // 0..1 of the current attempt
  /** Day it became known or failed. */
  day?: Day;
  /** Attempts started (1 = first; capability paradigms use the hidden draw on the first). */
  attempts?: number;
  /** Research-line projects (R8): team-months spent on the current attempt (counted as lost if it dead-ends). */
  tm?: number;
  /** Capability projects (model v3 V2): the lifecycle state (models/research.ts). */
  cap?: CapProjectState;
  /** Safety projects (RD-R02b): the one test's state (safety/lineProjects.ts). */
  saf?: SafProjectState;
}

/** A safety project's one "does it work" test (RD-R02b, SAFETY-REDESIGN §3.1; the shared stepper, models/research.ts
 *  stepProject): work done / needed (months of work at reference inputs, the agenda's T₁) and the experiment FLOP used.
 *  No candidates and no beliefs: at the end the hidden works draw (a node) or the open study's event (a follow-up). */
export interface SafProjectState {
  work: number;
  workNeed: number;
  flop: number;
}

// ───────────────────────────── Research projects (model v3 V2: MODEL-V3 §5) ─────────────────────────────

/** Lifecycle stage of a capability project (MODEL-V3 §5.3). `ideation` also covers waiting for enough candidates. */
export type CapStage = 'ideation' | 'small' | 'scale' | 'test' | 'adopting' | 'failed';
/** A candidate idea found by ideation. Its true effect is never stored: it is recomputed from the world seed, the
 *  project, the generation and the candidate number (models/research.ts candidateTruth), so nothing hidden is saved. */
export interface Candidate {
  /** Candidate number within the project (the hash key of its hidden draw). */
  k: number;
  /** Generation it belongs to (lines; 1 for ideas). */
  gen: number;
  /** Novelty 0..1 (visible): novel candidates are bigger if they work and less certain. */
  nov: number;
  /** Ideas in this candidate: 1 (RD-R08: high throughput runs lines as an expected flow; older saves may hold batches
   *  b > 1, whose work, FLOP and effect scale with b). */
  b: number;
  /** Taste of the scientists who found it (model v3 V3: the team's E[max(human, AI)] taste, a Strong team without AI = 1);
   *  for lines its research input per idea. */
  q: number;
  /** Belief about its small-scale effect (project unit; OOM for stack effects): mean and sd. */
  mu: number;
  sd: number;
  /** Belief about its small-to-test exponent s (mean, sd). */
  muS: number;
  sdS: number;
  /** Belief about its relative scale slope κ beyond the test scale (mean, sd; absent = scale-invariant). */
  muK?: number;
  sdK?: number;
  /** Lines (model v3 V3): the line's pool state (research input since the start, reference ideas) its prior is read at. */
  at?: number;
}
/** The candidate in test (small experiments, then the scale test). Work in research-engineer team-months at pace 1. */
export interface CapTest {
  c: Candidate;
  /** Work done / needed in the current stage; FLOP done / needed. */
  work: number;
  workNeed: number;
  flop: number;
  flopNeed: number;
  /** FLOP of the scale test (the reference point of the scale exponent). */
  fTest: number;
}
/** A finished project's final estimate (MODEL-V3 §5.3 step 4): the effect at the lab's latest base FLOP (band). */
export interface CapResult {
  c: Candidate;
  /** Measured effect at the scale test and measured scale exponent (beliefs; the truth enters the stack on adoption). */
  xTest: number;
  sHat: number;
  fTest: number;
  /** Estimated effect at the lab's latest base when the result came in (mean, sd; project unit). */
  est: number;
  estSd: number;
  /** Build item adopting it (engineers). */
  buildId?: string;
  day: Day;
  /** RD-R08: a line's expected flow for one day (high experiment throughput): the TRUE kept effect at test scale (the
   *  expected result of the ideas tested that day under the per-idea drop and survival rules), its survivors' mean
   *  scale exponent and the expected ideas adopted. `c` is then a placeholder; completeAdoption reads this instead. */
  flow?: { x: number; s: number; n: number; k?: number };
}
export interface CapProjectState {
  stage: CapStage;
  /** Generation (lines: 1, 2, …; ideas 1). */
  gen: number;
  /** Ideation progress toward the next candidate (0..1). */
  idea: number;
  cands: Candidate[];
  test?: CapTest;
  result?: CapResult;
  /** Candidates dropped in this generation / attempt. */
  drops: number;
  /** Next candidate number. */
  next: number;
  /** Times reopened as speculative (each halves the odds and widens the prior). */
  spec?: number;
  /** RD-R05: an unlock project's one "does it work" test (stage 'test'): its work done / needed (team-months at unit
   *  inputs, the project's whole stage work), FLOP used, and the build item once it works. No candidates, no band. */
  trial?: { work: number; workNeed: number; flop: number; buildId?: string };
  /** Lines: results waiting for the engineers to build them in (the line moves on to its next generation). */
  pending?: CapResult[];
  /** Lines (model v3 V3): the pool's state above n₀ (reference ideas): R = n₀ + pool, advanced by each result's true effect
   *  (R ← R·10^(x/r_l)), so the line's realised stack is r_l·log₁₀(R/n₀). */
  pool?: number;
  /** RD-R08: a line's expected ideas adopted by its flow so far (fractional; whole ideas move `gen`). */
  flowDone?: number;
  /** Lines: research input of the results so far (Σ batch × taste, reference ideas; readout). */
  input?: number;
}
/** One adopted idea (the last few are kept for the readout). */
export interface AdoptedIdea {
  id: string;
  name: string;
  /** The stack it moved (a stack idea; a second stack it also moves is not listed). Absent for domain and data effects. */
  stack?: StackKey;
  /** RD-B17: 'domain' (domain capability of new versions) or 'data' (data efficiency, expert data); absent = a stack. */
  kind?: 'domain' | 'data';
  /** Ideas in it (a line's batch; absent = 1). */
  b?: number;
  /** True effect when adopted (engine only: never shown; RD-M02 the readout is a measured eval delta): a stack idea in its stack's OOM at the
   *  lab's latest base; a domain or data effect in "× as designed" (1 = the project's design effect). */
  eff: number;
  /** The believed band when the result came in (same unit). */
  est: number;
  estSd: number;
  s: number;
  day: Day;
}
/** The recipe stacks (MODEL-V3 §5.5, V3-BUILD V2.1): pre = pretraining efficiency (OOM of effective compute, may scale
 *  with run FLOP); rlMid = RL compute efficiency (OOM, moves the RL midpoint); rlCeil = OOM added to the RL ceiling;
 *  train = training throughput (OOM of model FLOP per chip-day); serve = serving efficiency (OOM: decode utilisation,
 *  then less FLOP per token; D10 stacks.ts serveSplit). */
export type StackKey = 'pre' | 'rlMid' | 'rlCeil' | 'train' | 'serve';
/** Scale bucket (SCALE-DIAG M1): the adopted ideas with relative scale slope κ = s (rounded). a = Σ x_i (OOM at their test
 *  scales), t = Σ x_i·log₁₀ F_test,i. Effect at run FLOP F = a + s·(a·log₁₀ F − t) = Σ x_i(1 + κ·log₁₀(F/F_test,i)), at least 0
 *  (RD-E03, DD-12: an adopted idea lands at its full effect at build-in). A bucket from a save before M1 has no `t`: its s
 *  is a power exponent and its effect a·10^(s·log₁₀ F) (read only; new ideas never join it). */
export interface StackBucket { s: number; a: number; t?: number }
export interface StackState {
  /** Start recipe and public knowledge (OOM, scale-invariant). */
  base: number;
  buckets: StackBucket[];
  /** Ideas adopted. */
  n: number;
  /** RF-R5: the BELIEVED adopted total (Σ the results' estimates when adopted, this stack's OOM at the then-latest base)
   *  and its variance (Σ estSd²), readouts only; the buckets hold the true effects. */
  est: number;
  estVar: number;
}
export type RiskPolicy = 'safe' | 'balanced' | 'speculative';
/** Research-engineer needs (V3-BUILD V2.5): run operations, project experiments. Capacity none of them takes is idle
 *  (RD-E03 removed routine tuning; SR-21 moved evaluations to the safety engineers' needs list). */
export type ReNeed = 'ops' | 'exp';
/** Safety research-engineer needs (RD-A04, SR-21, SAFETY-REDESIGN §5): human review on the safeguards, open cases,
 *  validation jobs, eval suites, foothold removals, line-project experiments (by project priority).
 *  Each has a real staff (and compute) demand; capacity none takes is idle. */
export type SafReNeed = 'review' | 'spotCheck' | 'cases' | 'validation' | 'evals' | 'removal' | 'safExp';
/** Engineer needs: run operations and setups, product upkeep, builds (product tools, adoptions, launches). */
export type EngNeed = 'runs' | 'upkeep' | 'builds';
/** A broad allocation: needs in priority order and optional caps per need: an amount (`max`) and a share of the
 *  capacity (`share`, 0..1); absent = no cap. Unused capacity flows down the order. CP3d: `max` is in the list's own unit,
 *  the one its capacity, demand and gets are in (AllocView.unit): research engineers team-equivalents, engineers
 *  team-weeks / week, the safety needs list people (heads × quality; safety/lineProjects.ts safAllocation). */
export interface Allocation<K extends string> { order: K[]; max: Partial<Record<K, number>>; share: Partial<Record<K, number>> }

export interface ResearchState {
  /** Projects in priority order (node ids). Teams work on the ones that are ready; the rest wait. */
  queue: string[];
  /** Teams wanted per project, both departments (RD-R03) (default 1; PROJECT_MAX_TEAMS = "max"). */
  want: Record<string, number>;
  /** B4: capability projects on "auto" teams wanted (the game picks the number by priority and fit): one team first,
   *  then spare teams where they add the most progress. A project here ignores its `want` number. */
  wantAuto: string[];
  /** Lab-wide research risk policy (MODEL-V3 §5.3): the candidate a team pursues maximises μ + κσ of its belief. */
  risk: RiskPolicy;
  /** Research engineers (capabilities) by need. */
  re: Allocation<ReNeed>;
  /** Safety research engineers by need (RD-A04; OD-9: the order is set in LAB, Lab › AI staff & needs). */
  safRe: Allocation<SafReNeed>;
  /** Recipe stacks. */
  stacks: Record<StackKey, StackState>;
  /** Adopted domain effects for versions trained after them (OOM per domain: test-time training, self-play, robotics). */
  domainG: Partial<Record<DomainId, number>>;
  /** Model v3 D9: adopted data-efficiency effects (MODEL-V3 §5.2): synQMax = raise of the synthetic-quality ceiling (q;
   *  P10), worthOom = OOM more effective tokens per drawn token in the loss law (P21). Absent = none adopted. */
  dataFx?: { synQMax?: number; worthOom?: number };
  /** Last adopted ideas (newest last, ≤ 30) for the readout. */
  adopted: AdoptedIdea[];
  /** Weekly samples of the stacks' G-equivalent total (OOM over the start) and ideas adopted (the recent rate). */
  hist: { day: Day; g: number; n: number }[];
  /** Software progress (OOM/day, 14-day average): the daily change of the lab's research recipe G (stacks.ts researchG:
   *  adopted ideas and tuning, no public knowledge) with F held at the earlier day's base (RD-B16; models/research.ts
   *  capResearchDay). Read by the Research view and the Limits diffusion line. gLast = researchG at gLastF, the
   *  latest base FLOP on the last research day (gLastF absent in older saves: their gLast is skipped once). */
  gRate?: number;
  gLast?: number;
  gLastF?: number;
  /** RD-B16: the stacks' public knowledge (Σ bases) at the last research day, and its daily inflow (OOM/day, 14-day
   *  average: diffusion, C4 tacit knowledge, safety spillover). A readout only; absent in older saves (→ 0). */
  pubLast?: number;
  pubRate?: number;
  /** Readout of the last day: research engineers per need and per project (team-equivalents), experiment FLOP per
   *  project in experiments (RD-B08 expShares; absent in older saves), FLOP used and available (FLOP/day). */
  last?: {
    re: Record<ReNeed, number>; reProj: Record<string, number>; flopProj?: Record<string, number>; flopUsed: number; flopAvail: number;
    /** RD-E03: research engineers no need took today (team-equivalents). Absent in older saves. */
    idle?: number;
    /** RD-B09: share of the run-operations need the research engineers served today (gets ÷ needs, 1 with no need);
     *  running runs and the continual-learning stream advance at this share (models/runs.ts). Absent in older saves. */
    opsServed?: number;
    /** Model v3 V3: a unit project's experiment compute c and labour ℓ (leader day 0 = 1), its CES throughput X (× the
     *  speed modifiers) and the AI labour multipliers in experiments and ideas. */
    x?: { c: number; l: number; X: number; mExp: number; mIdeas: number };
  };
}

// ───────────────────────────── Production readout (§3.2.5) ─────────────────────────────

/** RD-R01: no aggregate multiplier M, elasticities, per-dollar values, ceilings or what-ifs (the player's research
 *  readout is the engine's day, research.last; the rivals' research speed is rivalModel.ts RivalResearch). */
export interface ProductionReadout {
  stage: 1 | 2;
  binding: 'experiments' | 'humans' | 'agents' | 'taste' | 'data';
  label: 'compute-bound' | 'labor-bound' | 'human-bound' | 'taste-bound';
  /** aEng (R7, player): AI share of engineers' work from the engineering agents (A_eng of their model × coverage). */
  labor: { A: number; aiFTE: number; copies: number; speed: number; wH: number; aEng?: number;
    /** RD-A08: AI FTE of all research agents (Experiments + Research ideas; a rival: its whole agent pool); S8 reads it. */
    agentFte: number };
  ratios: { h: number; k: number; c: number };
  /** AI research taste in human SDs above the median (research/13 §2.4). */
  sdAI: number;
}

// ───────────────────────────── Safety (§3.5) ─────────────────────────────

/** SR-19: what a framework rule requires before the thing it holds may go ahead. Safeguards: on the deployment
 *  ('classifiers' = classifier or hardened misuse safeguards, 'hardened'), or on the lab's live internal deployments for
 *  a training hold ('control' = control protocol, 'review' = human review). Evidence: 'suite' (an eval suite read the
 *  version), 'external' (external evaluators read it). */
export type FrameworkSafeguard = 'classifiers' | 'hardened' | 'control' | 'review';
export type FrameworkEvidence = 'suite' | 'external';
/** SR-19: a framework rule. Trigger on a MEASURED domain level (the benchmark fit, RD-M01) or on a believed trait
 *  (estimate and clarity of the player's own beliefs, never truth). `holds`: external deployments of the version, or the
 *  lab's frontier training (base / post runs and frontier experiments). */
export interface FrameworkRule {
  id: string;
  label: string;
  trigger: { kind: 'capability'; domain: DomainId; level: number } | { kind: 'belief'; est: number };
  holds: 'deploy' | 'training';
  safeguards: FrameworkSafeguard[];
  evidence: FrameworkEvidence[];
  /** Source of the default rule (primary framework documents). */
  src: string;
}
/** SR-19: an explicit override of a rule for one version, with the consequences that were stated and applied. */
export interface FrameworkOverride { ruleId: string; versionId: string; day: Day; consequences: string[] }
/** SR-19: a hold in force today (refreshed daily; a deploy hold names the live deployment it stops). */
export interface FrameworkHold { ruleId: string; versionId: string; target: 'deploy' | 'training'; depId?: string; missing: string[]; since: Day }
export interface SafetyFramework {
  /** Capability assessment every version needs before an external release: the suite depth ('none' = no release suite)
   *  and whether external evaluators must have read it. */
  evalDepth: EvalDepth | 'none';
  externalReview: boolean;
  rules: FrameworkRule[];
  overrides: FrameworkOverride[];
  holds: FrameworkHold[];
}

export interface SafetyDept {
  agendas: Record<AgendaId, AgendaState>;
  techniques: Record<TechniqueId, TechniqueState>;
  findings: FindingRecord[];
  investigations: Investigation[];
  incidents: Incident[];
  discoveredUModes: UModeId[]; // known to the player (cards visible)
  /** SR-19: the lab's Safety framework (its own rules: capability thresholds on measured levels, required safeguards and
   *  evidence, holds, overrides; safety/framework.ts). Replaces the eval gate. */
  framework: SafetyFramework;
  monitorabilityCommitment: boolean; // F31 / faithful-CoT pledge
  edgeGrades: Record<string, 'A' | 'B' | 'C' | 'D'>; // player-visible grade, can be raised by AG08 (§3.5.4)
  edgeRevealed: Record<string, boolean>; // true weight revealed for this world
  /** Model v3 E8 (MODEL-V3 §11.4): hidden AI assets left by uncaught covert acts and escapes. Engine state; the player
   *  sees only suspected and located ones (safety/footholds.ts footholdView), never hidden ones. */
  footholds: Foothold[];
  /** Model v3 E9 (MODEL-V3 §11.4): effective control of the lab's AI, refreshed daily (safety/control.ts). `level` and
   *  `exposure` are hidden; the player sees `believed` (controlView). */
  effectiveControl: EffectiveControl;
  /** SR-09: validation jobs (plant behaviour in a test copy of a model, count what an instrument finds) in queue order,
   *  and the default policy "validate instruments on each new internal model" (on by default); `lastModel` = the
   *  internal model the policy last queued for. Optional on other labs' departments. */
  /** RF-S14: `methods` = the policy also queues each owned method a new internal model has outgrown (absent = off). */
  validation?: { jobs: ValidationJob[]; autoNew: boolean; lastModel: string | null; methods?: boolean };
  /** SR-14: the policy "Use all known methods" (on by default): new run plans list every owned method. */
  useAllMethods?: boolean;
  /** SR-10: disagreements between independent instruments' readings (newest last, DISAGREE_CAP kept). */
  disagreements?: Disagreement[];
  /** SR-18: the disclosure policy (default legal minimum, OD-8). */
  disclosure?: DisclosurePolicy;
  /** SR-18: methods a response added to every later default run plan (the "method for the next run" response). */
  requiredMethods?: TechniqueId[];
}

/** SR-10: one reading in a disagreement: instrument kind (instruments.ts InstrumentKind), family, reading, its noise. */
export interface DisagreementSide { kind: string; family: ToolFamily; reading: number; noise: number; day: number }
/** SR-10: two independent instruments read the same trait of the same model outside each other's ranges. */
export interface Disagreement { day: number; model: string; trait: TraitId; a: DisagreementSide; b: DisagreementSide }

/** SR-10: one update of an instrument's believed reliability (trust factor f after it). */
export interface TrustEvidence { day: number; source: 'validation' | 'disagreement'; model: string; note: string; f: number }
/** SR-10 / RF-S5: the player's trust factor on an instrument PER MODEL (multiplies its BELIEVED reliability on that
 *  model; a model with no entry reads the entry of the model the instrument was last validated on, else 1). */
export interface InstrumentTrust { byModel: Record<string, number>; evidence: TrustEvidence[] }

/** SR-09: one validation (or port) job: instrument `tool` on model `model`; progress 0..1 (VAL_DAYS at full staffing). */
export interface ValidationJob {
  id: string; tool: TechniqueId; model: string; progress: number; by: 'player' | 'policy'; day: number;
  /** SR-10: human-run (no AI share of the work: VAL_ENGINEERS heads, not ÷ m); absent = AI-assisted at the lab's m. */
  human?: boolean;
}

/** SR-09: a validation result: found of n planted cases on model `on` (measured reliability = found ÷ n). */
export interface ValidationResult {
  on: string; found: number; n: number; day: number;
  /** SR-10: who ran it: true = humans only (an AI share of the work can corrupt the result). */
  human?: boolean;
  /** SR-22: AI share, spot-check, expected (believed recall before this result) vs observed (found ÷ n). */
  job?: SafJobResult;
}

/** Kinds of foothold (MODEL-V3 §11.4): a backdoor in the lab's infrastructure, a hidden compute reservation, a steered
 *  successor, an exfiltrated copy, a corrupted safety tool. */
export type FootholdKind = 'backdoor' | 'hiddenCompute' | 'steeredSuccessor' | 'exfiltratedCopy' | 'corruptedTool';

/**
 * One foothold (model v3 E8; safety/footholds.ts). `status`: hidden (nobody knows), suspected (a symptom was seen, the
 * foothold is not located), detected (located: the lab knows what and where it is), removed. `size` by kind:
 * hiddenCompute H100e reserved; backdoor reach 0..1 (the share of later oversight it bypasses for its lineage's covert
 * acts); steeredSuccessor the extra pull ω on the successor; exfiltratedCopy 1 (one copy); corruptedTool the masking
 * tool's base strength s0.
 */
export interface Foothold {
  id: string;
  kind: FootholdKind;
  /** The model whose act created it, and its base lineage. */
  versionId: string;
  lineage: string;
  day: Day;
  /** Uncaught acts that created or grew it, and their summed severity (1..5 each). */
  acts: number;
  severity: number;
  size: number;
  /** steeredSuccessor: the successor version (the run id until the version exists); corruptedTool: the technique id. */
  ref?: string;
  /** steeredSuccessor: the steered part of the successor's starting dispositions (removal subtracts it). */
  delta?: Partial<Record<TraitId, number>>;
  status: 'hidden' | 'suspected' | 'detected' | 'removed';
  /** What made the lab suspect or locate it (shown with the suspected/detected foothold). */
  symptom?: string;
  suspectedDay?: Day;
  detectedDay?: Day;
  removedDay?: Day;
  /** A removal in progress: safety research engineers tied up until `until` (the response's cost). */
  removal?: { until: Day; fte: number };
  /** exfiltratedCopy (model v3 E9): the copy's misalignment index at escape (its weights stay that model's). */
  mis?: number;
}

/** Effective control of the lab's AI (model v3 E9; safety/control.ts): C = 1 − E with exposure E = Mis · (1 − oversight)
 *  · (1 + the footholds' capacity), the lab's lowest over its best model and running internal fleets. */
export interface EffectiveControl {
  /** Hidden (engine only): today's control 0..1 and exposure E, the model that sets them, the lowest control so far. */
  level: number;
  exposure: number;
  versionId?: string;
  lowest: number;
  /** Visible: the lab's estimate from its belief estimates, measured levels and the footholds it knows of. */
  believed: number;
}

/** A research line (R8): its projects are tree nodes worked by safety science teams; staffing lives on the teams. */
export interface AgendaState {
  computeShare: number; // of the safety pool (E1: its experiments' share, by research engineers × the agenda's compute need)
  posterior: { a: number; b: number }; // visible Beta posterior on efficacy (shown as a band)
  /** idle: no team on the line; active: teams on it (SR-01: the dead-end latch is gone). */
  status: 'idle' | 'active';
  /** Team-months spent on attempts that ended in a dead end. */
  deadEndTM: number;
}

export interface TechniqueState {
  id: TechniqueId;
  agenda: AgendaId;
  family: ToolFamily;
  unlocked: boolean;
  active: boolean; // part of the deployed safety stack
  s0: number; // base strength
  /** Model v3 E6 / SR-08: capability gap in OOM above the model the tool was validated on (validatedOom) at which its
   *  reliability halves (lowered by negative results; 1e9 = never decays). */
  oHalf: number;
  k: number;
  goodhart: number; // G
  trainedAgainst: number; // 0..1 cumulative
  /** SR-08: the version this instrument was last trained against (the player chose it, so it is known); null = never. */
  trainedAgainstOn: string | null;
  /** SR-08: the model this instrument was last validated on (null = the start model V0) and that model's OOM above V0.
   *  Reliability decays with the capability gap from it. A tool counts as validated on the internal model when it is
   *  unlocked; SR-09 validation jobs move it and set `measured`. */
  validatedOn: string | null;
  validatedOom: number;
  /** SR-09: the last validation's measurement (null / absent = never measured: reliability extrapolated, wider range). */
  measured?: ValidationResult | null;
  falseValidated: boolean; // hidden: came from an F49 FALSE finding (masks, does not detect)
  /** SR-10: trust in this instrument from evidence (validations, disagreements); absent = 1. Believed only. */
  trust?: InstrumentTrust;
  coverage: Partial<Record<TraitId, number>>;
}

export type FindingType = 'TECH' | 'EVAL' | 'DISC' | 'DEAD' | 'NEG' | 'SPILL' | 'FALSE';

/** SR-22 (RD-S08, SAF-26): one safety job's record: the share of its work AI staff did, the share of that work humans
 *  spot-checked (served), its expected result from the lab's beliefs before the job's own evidence and its observed
 *  result once done (both 0–1 in the job's unit: chance it works / works; believed / measured recall; believed /
 *  measured misbehaviour rate; believed level of the trait / found it). A gap is evidence the player reads; it feeds
 *  beliefs only through the job's own result (nothing true is stored here). */
export interface SafJobResult { aiShare: number; spot: number; expected: number; observed?: number }

export interface FindingRecord {
  id: FindingId;
  agenda: AgendaId;
  type: FindingType; // as SHOWN; a FALSE finding is shown as TECH until revealed
  trueType: FindingType; // hidden
  day: Day;
  published: boolean;
  revealedFalseDay?: Day;
  /** The project whose result it was (R8). */
  nodeId?: string;
  /** SR-22: AI share, spot-check, expected (believed chance it works) vs observed (1 = a working result). */
  job?: SafJobResult;
}

export interface Investigation {
  id: string;
  target: { kind: 'trait'; versionId: string; trait: TraitId } | { kind: 'incident'; incidentId: string };
  fte: number;
  computeShare: number;
  tools: TechniqueId[];
  startDay: Day;
  /** RF-S12: share of the case's work done (0..1; CASE_WORK engineer-days). */
  progress: number;
  outcome?: 'confirmed' | 'benign' | 'inconclusive' | 'falseAlarm' | 'discovery';
  outcomeDetail?: { severityEst?: number; uMode?: UModeId; corrupted?: boolean; changes?: CaseChange[]; evidence?: string[] };
  /** SR-17: the case's beliefs when it opened (est, sd per target trait): the verdict's "what changed" baseline. */
  before?: Partial<Record<TraitId, { est: number; sd: number }>>;
  /** SR-17: readings the case added to beliefs (RF-S12: one per instrument family when it concludes). */
  readings?: number;
  /** SR-22: AI share, spot-check, expected (believed level of the most severe target trait at opening) vs observed
   *  (1 if the verdict found it: confirmed or a discovery; else 0). */
  job?: SafJobResult;
}

/** SR-17: one belief a case's verdict moved (believed values only). */
export interface CaseChange { trait: TraitId; from: { est: number; sd: number }; to: { est: number; sd: number } }

export interface Incident {
  id: string;
  day: Day;
  labId: LabId;
  versionId: string;
  deploymentId?: string;
  trueSource: TraitId | UModeId | 'misuse'; // hidden
  apparent: TraitId | 'unexplained' | 'misuse'; // shown
  severity: 1 | 2 | 3 | 4 | 5;
  exposure: 'internal' | 'customer' | 'public';
  publicTimerDays?: number; // days until it goes public unless resolved/disclosed
  status: 'open' | 'investigating' | 'resolved' | 'disclosed' | 'covered' | 'leaked';
  responses: ResponseKind[];
  /** SR-18: per-incident disclosure override (absent = the lab's disclosure policy). */
  disclose?: 'yes' | 'no';
}

/** SR-18: incident responses (cause-aware, safety/responses.ts responseOptions). Disclosure is a separate policy. */
export type ResponseKind = 'patchSignal' | 'addMethod' | 'restrictContext' | 'liftRestriction' | 'addControl' | 'removeControl' | 'addLockdown' | 'removeLockdown' | 'rollback' | 'removeFoothold';
/** SR-18: disclosure policy (OD-8 default 'legal': report what SB 53 / RAISE require, on time). */
export type DisclosurePolicy = 'legal' | 'full' | 'none';

// ───────────────────────────── Security (§3.6) ─────────────────────────────

export interface SecurityState {
  wsl: number; // continuous weight-security level 1..5
  ssl: number; // secrets security (≈ wsl − 0.6)
  target: number;
  spendRate: Money; // $B/yr
  siloing: 0 | 1 | 2;
  clearances: boolean;
  privileged: number; // staff with frontier access
  spies: number; // hidden for player (shown only as an estimate band)
  counterIntel: number; // 0..1
  stolen: { day: Day; versionId: string; by: LabId }[]; // known thefts (truth list lives here; player sees detected ones)
  detectedThefts: string[];
}

// ───────────────────────────── Player lab ─────────────────────────────

export interface PlayerLab extends LabCore {
  kind: 'player';
  finance: FinanceState;
  board: Board;
  sites: Site[];
  orders: ChipOrder[];
  cloud: CloudContract[];
  safety: SafetyDept;
  /** Teams by role (STRUCTURE §4.1, R3). `staff.cap/saf` are derived from their heads; for the player `tasteHire`
   *  (τ_h) is derived from science-team quality and stars. */
  teams: Team[];
  /** Star hires (named people): +0.05 τ_h each. */
  stars: number;
  hiring: TeamHiring;
  /** Tech-tree node state (BUILD-PLAN R4): only nodes with a state are stored (known at start, started, failed);
   *  locked/open/queued/active are derived (models/tree.ts nodeStatus). */
  tree: Record<string, TreeNodeState>;
  /** Research projects: priority queue of node ids (active projects included) and the auto-assign policy. */
  research: ResearchState;
  /** Engineers' build queue (BUILD-PLAN R5): run setups now; product features, eval harnesses and safeguards from R6. */
  build: BuildState;
  /** MK-11: the product tools built lab-wide (R6; data/v2/tools.ts ProductToolId). Switched on per product
   *  (Deployment.features); RD-A06: they act only inside a product's offer. */
  features: string[];
  /** RD-A06 (DD-03): internal tooling the lab owns (ids of data/v2/features.ts INTERNAL_TOOLS): built by engineers, acts
   *  on the internal agents (worldfx/serving.ts internalFx). */
  tooling: string[];
  morale: { overall: number; safety: number }; // 0..100
  /** Model v3 D1: the data portfolio (MODEL-V3 §9; production/data.ts). Replaces v2's dataAssets token counts. */
  dataPortfolio: DataPortfolio;
  /** Model v3 D5: RL environment suites by family (models/suites.ts). A family unlocked since the start (computer use,
   *  P06) has no suite until the lab builds its first one (RD-B03). */
  suites: Partial<Record<RLFamily, EnvSuite>>;
  policies: PlayerPolicies;
  /** Internal agent packages (STRUCTURE §4.9, R7): model + optional monitor + compute per internal use. */
  agents: Record<AgentUse, AgentPackage>;
}

// ───────────────────────────── Data portfolio (model v3 D1, MODEL-V3 §9) ─────────────────────────────

export type DataKind = 'public' | 'licensed' | 'usage' | 'synthetic' | 'expert';

/** The lab's use of the public web (data/v2/dataAssets.ts PUBLIC_WEB): shared by every lab and finite, so the lab holds
 *  only its crawl `coverage` (≤ 1) of the one world stock; tokens, mix and quality are the world's. */
export interface PublicWebUse {
  id: 'public';
  kind: 'public';
  coverage: number;
  /** Covered by a licence on the crawl (action data.license, domain 'web'): no copyright litigation on it. */
  licensed: boolean;
}

/** An owned data asset: tokens (trillions), a domain mix (shares summing to 1) and a quality factor (1 = the web). */
export interface OwnedDataAsset {
  id: string;
  kind: 'licensed' | 'usage' | 'synthetic' | 'expert';
  tokensT: number;
  mix: Partial<Record<DomainId, number>>;
  quality: number;
  /** Day acquired or first generated (absent: before the game). */
  day?: Day;
  /** Licensed / expert deals by domain (D2): the domain bought (absent: broad). */
  domain?: DomainId;
  /** Expert data built into an RL environment suite (model v3 D5): its family. */
  family?: RLFamily;
  /** Synthetic: the teacher version that generated it (absent: before the game), its G at generation, and whether a
   *  base trained on it inherits the teacher's traits (subliminal learning, research/20 F3). */
  teacherId?: string;
  teacherG?: number;
  inheritsTraits?: boolean;
}

export type DataAsset = PublicWebUse | OwnedDataAsset;

/** A data deal not yet delivered (model v3 D2: licences and expert data): the asset it adds on `due`. */
export interface PendingData {
  asset: OwnedDataAsset;
  due: Day;
}
/** A synthetic generation job (model v3 D2): `share` of the synthetic pool generates with `teacherId` until `until`. */
export interface SynJob {
  teacherId: string;
  share: number;
  until: Day;
}

export interface DataPortfolio {
  assets: DataAsset[];
  /** Data policy (action data.usagePolicy, USAGE_LEVELS): share of eligible product output tokens kept as usage data. */
  usageShare: number;
  /** Deals paid and waiting for delivery (model v3 D2). */
  pending: PendingData[];
  /** The synthetic pool's job with a chosen teacher (absent: the whole pool uses the internal research model). */
  synJob?: SynJob;
}

/** Internal uses of the lab's own models (R7): engineering, capabilities routine and frontier research, safety. */
export type AgentUse = 'eng' | 'capRoutine' | 'capFrontier' | 'safety';
/** One internal use: the model (absent = the routine-research model; routine research always names one), the monitor
 *  (absent = none; 'same' = a copy of the watched model) and compute: for engineering and capabilities research a share
 *  of the capabilities agent pool (the three sum to 1); for safety a share of the safety pool. */
export interface AgentPackage {
  /** RD-A06: the package's own model; unset = the newest internal model (departments/agents.ts newestInternal), shown
   *  as such. Routine research always names one (the internal deployment follows it). */
  versionId?: string;
  monitorId?: string;
  /** RD-A06: the control layer (trusted monitoring with deferral, safety/oversight.ts useControl) on this package. */
  control?: boolean;
  /** SR-22 (safety package only): the human spot-check share, the fraction of AI-done safety work the safety engineers
   *  re-check (0, 0.02 or 0.1; absent = 0). Its staff are the 'spotCheck' need in the safety needs list. */
  spotCheck?: number;
}

// ───────────────────────────── Build queue (STRUCTURE §4.1, R5) ─────────────────────────────

export type BuildKind = 'runSetup' | 'feature' | 'tooling' | 'harness' | 'safeguard' | 'launch' | 'adopt' | 'suite' | 'eval';
/** A product launch waiting for its build (J2 P1): the product goes live with these settings once built. */
export interface PendingLaunch {
  channel: Channel;
  versionId: string;
  stance: PriceStance;
  kyc?: 0 | 1 | 2 | 3;
  monitorId?: string;
}
/** One item on the engineers' build queue. Work is in team-weeks (one Strong engineering team of 150 for a week). */
export interface BuildItem {
  id: string;
  kind: BuildKind;
  /** What it builds: the run id for a run setup. */
  ref: string;
  needTW: number;
  doneTW: number;
  /** Lower = worked first (the queue is kept sorted by it). */
  priority: number;
  /** Day it was queued. */
  day: Day;
  /** kind 'launch': the product settings; kind 'feature': ref = the product tool (data/v2/tools.ts); kind 'adopt': ref =
   *  the project (tree node) whose result is built into the stack (model v3 V2). */
  launch?: PendingLaunch;
}
export interface BuildState {
  queue: BuildItem[];
  nextId: number;
  /** J2 P1: the last day's engineering rates (team-weeks per week): capacity, standing upkeep needed and served, queue work. */
  last?: { cap: number; upkeep: number; served: number; queue: number };
  /** Average (≈ 30 d) share of build capacity in use (upkeep served + queue work). */
  util?: number;
  /** Model v3 V2: engineers by need (priority order, optional caps in team-weeks per week; overflow flows down). */
  alloc: Allocation<EngNeed>;
}

// ───────────────────────────── Teams (STRUCTURE §4.1, R3) ─────────────────────────────

export type TeamRole = 'eng' | 're' | 'sci';
export type TeamDept = 'cap' | 'saf';
export type TeamQuality = 'solid' | 'strong' | 'elite';
/** The six tree columns: a science team's specialty (R4 projects). */
export type Column = 'pretraining' | 'posttraining' | 'systems' | 'alignment' | 'interp' | 'evals';
/** Hiring-target keys: engineers (one shared pool, paid from the capabilities budget) and research engineers and
 *  scientists per department. */
export type TeamKey = 'eng' | 're.cap' | 're.saf' | 'sci.cap' | 'sci.saf';

export interface Team {
  id: string;
  role: TeamRole;
  dept: TeamDept;
  /** Fixed size per role (150 / 100 / 40). */
  size: number;
  /** People on the team now (attrition lowers it, hiring refills it; fractional is fine). */
  heads: number;
  quality: TeamQuality;
  specialty?: Column;
  name?: string;
  /** R4: the tree project a science team works on. */
  projectId?: string;
  /** J2 R2: placed by the player or a bot (auto-assign does not move it while its project runs). */
  manual?: boolean;
  /** Model v3 V2: why the assignment put a capability science team where it is (readout). */
  why?: string;
}

/** A team on the candidate list (drawn weekly from the 'company' stream). */
export interface TeamCandidate {
  id: string;
  role: TeamRole;
  dept: TeamDept;
  quality: TeamQuality;
  specialty?: Column;
  /** Day it leaves the list. */
  until: Day;
}

export interface TeamHiring {
  /** "Keep hiring to N teams" per key (a policy: it hires, it never lays off). */
  targets: Record<TeamKey, number>;
  candidates: TeamCandidate[];
  /** Teams being filled, in order; one hiring lane per department. A team arrives when its heads reach its size. */
  filling: Team[];
  /** Counter for team and candidate ids. */
  nextId: number;
}

/** RD-A05b: the explicit auto-split policy (PlayerPolicies.autoSplit). */
export interface AutoSplitPolicy {
  on: boolean;
  to: Exclude<keyof ComputeSplit, 'idle'>[];
  /** The latest move: its day and the share of total compute moved. */
  last?: { day: Day; share: number };
}

export interface PlayerPolicies {
  whistleblowerChannel: boolean;
  publishSafety: 'none' | 'selective' | 'all';
  govBriefing: 0 | 1 | 2 | 3;
  shareWithAllies: boolean;
  transitionFund: Money; // $B/yr
  communityBenefits: boolean;
  /** Auto-split idle compute (RD-A05b, DD-19). Off by default: idle compute stays idle and shows as idle in its use.
   *  On: once a day the idle shares (unallocated, training no run uses, serving no product needs, monitors beyond full
   *  coverage) move to the listed uses in equal parts, logged. */
  autoSplit: AutoSplitPolicy;
  /** UB-5c "Lend idle training compute" (DECISIONS; off by default, absent = off): training compute no run uses goes
   *  to research experiments and returns the moment a run trains (models/runs.ts lentTrainingH100e). */
  lendTraining?: boolean;
  /** Auto serving (R6): serve the products earning most per H100e first; the cut is recorded. Off = shares by hand. */
  servingAuto: boolean;
  /** Move products to the newest cleared model of the same kind when it measures better (R6). */
  upgradeToNewest: boolean;
  /** Re-run the eval suite every 30 days on the internal model and models updated in place (R6, replaces the 30-day
   *  eval expiry that blocked launches). */
  autoEvaluate: boolean;
  /** RD-P01b "Auto-make cheap tiers" (default on for new games): when a full model is a live product's main model and
   *  no student of it exists or is training, distil a 1/5.7-size student of it (a real run: its compute and time); it
   *  joins the lineup when ready and evaluated. Off: nothing automatic. */
  autoCheapTier: boolean;
  /** Trusted to AI (R7): share of safety research and investigation work done by the safety agents (one policy; it
   *  replaces per-agenda automation). Works only above the AI-labour gate (B3). */
  trustedToAI: number;
}

// ───────────────────────────── Finance (§3.7) ─────────────────────────────

export interface FinanceState {
  cash: Money;
  revenueRun: Money; // annualised, smoothed 30 d
  revenueHistory: Money[]; // quarterly, for g and momentum
  valuation: Money; // last mark (post-money of the last round, or the story mark: sector value × share, FIN5a)
  ownership: Ownership;
  /** Investor credibility 0–100 (FINANCE-V3 §2.4): Doubted < 25 ≤ Unproven < 50 ≤ Credible < 75 ≤ Proven. Moved only by
   *  promises judged at their deadlines; multiplies the lab's weight in the valuation share (FIN5a). Not relations
   *  credibility. */
  credibility: number;
  /** Round promises (FINANCE-V3 §2.3): one per priced round, judged at its own deadline; judged ones are kept (last 8). */
  promises: FinancePromise[];
  /** Listed with dual-class shares (§2.6): founder votes keep control after the IPO; governance factor ×0.95. */
  dualClass?: boolean;
  rounds: EquityRound[];
  tranches: Tranche[];
  debts: Debt[];
  ledger: Commitment$[]; // financial commitments (take-or-pay, leases, LTAs)
  rating: 'BBB' | 'BB' | 'B' | 'closed';
  runwayQ: number;
  state: 'healthy' | 'tight' | 'distress' | 'insolvent';
  deals: StrategicDeal[];
  covenantBreachDay?: Day;
  /** WS3 working state (offers, inventory, tallies, runway bookkeeping). */
  ws3: FinanceWS3;
}

export interface Ownership { founder: number; mission: number; fin: number; strat: Record<string, number>; public: number; }

export interface EquityRound { day: Day; amount: Money; postMoney: Money; dilution: number; anchor?: string; down: boolean; ipo?: boolean; }

/** The milestone a round is raised on (FINANCE-V3 §2.2): a public model level, compute online (H100e) or a revenue
 *  run-rate ($B/yr) by the deadline. */
export type MilestoneType = 'capability' | 'scale' | 'adoption';
export type Pitch = 'conservative' | 'base' | 'aggressive';
/** A round's thesis as signed: the milestone, its start value and target (pitch applied). */
export interface Thesis { type: MilestoneType; pitch: Pitch; start: number; target: number }
/** A promise to the round's investors: an expectation, not a contract (it moves credibility and board confidence,
 *  never cash). Judged at `deadline` (four quarter starts after the close). */
export interface FinancePromise extends Thesis {
  id: string;
  amount: Money;
  closeDay: Day;
  deadline: Day;
  /** Set when judged: the metric then, progress (start → target = 0 → 1), the outcome and what it moved. */
  result?: { day: Day; value: number; progress: number; outcome: 'met' | 'near' | 'missed'; weight: number; cred: number; board: number };
  /** FIN5c (spec §13): a goal the big-tech parent set with the year's budget (not a round's promise): `amount` is that
   *  budget, `goalWeight` its fixed share of the year's goals; it moves parent confidence only (no investors). */
  by?: 'parent';
  goalWeight?: number;
  /** FIN4r (H2): a typical round at the close, d_max · pre-money ÷ (1 − d_max) with the dilution limit that applied
   *  ($B): the weight is the amount ÷ the larger of this and what was raised in the year, so a tiny round weighs little. */
  typical?: Money;
}
/** A conditional or scheduled cash inflow. `partner`: a partner deal's equity tranche (FIN4a): the partner gets its
 *  shares when the tranche lands, at that day's valuation, up to `stakeCap` of the company (a hyperscaler's 15%; the
 *  part past the cap lapses). Round tranches carry no partner (their shares were issued at the close). */
export interface Tranche { amount: Money; dueDay: Day; condition?: string; deadline?: Day; source: string; partner?: string; stakeCap?: number;
  /** FIN4r (H3): a round's second tranche: the shares issued at the close for its unpaid money (fractions of the company
   *  then, by holder: 'fin' or a partner name) and the insiders' (founder + mission) share then, which later issues
   *  scale with everyone. A lapse cancels the shares of the money that did not come. */
  shares?: { holders: Record<string, number>; insiders: number }; }
/** 'assumed' = debt that came with a lab you bought (FIN3c, spec §9), priced at your rating. */
export interface Debt { id: string; kind: 'revolver' | 'gpuTerm' | 'bond' | 'assumed'; principal: Money; drawn: Money; spreadBp: number; maturityDay: Day; covenant?: string; collateralH100e?: H100e; }

/** Ledger entry for a contractual commitment ("Commitment$" to avoid clashing with relation Commitments). */
export interface Commitment$ {
  id: string;
  payee: string;
  /** 'lease' = colocation rent; 'finLease' = a financing lease of site or chip capex (FIN1, spec §4); 'acquired' = the
   *  contracts of a lab you bought, one firm entry over their remaining term (FIN3c, spec §9). */
  kind: 'cloud' | 'lta' | 'lease' | 'finLease' | 'power' | 'acquired';
  perQuarter: Money;
  /** Contract this entry belongs to: firm contracts priced on the expected market path pay one entry per quarter
   *  (FIN1, spec §5), grouped by this id in the contracts table. */
  contract?: string;
  /** Financing leases: the lessor's annual return (rating-priced at signing), for the residual-value guarantee. */
  rate?: number;
  /** First day payments fall due; absent = already paying. LTAs pay from the first tranche, cloud from the contract
   *  start, colocation leases from handover. */
  startDay?: Day;
  endDay: Day;
  cancellableNoticeQ: number | null; // null = non-cancellable
  penalty: Money;
}

/** Strategic partner kinds (FINANCE-V3 §6.1). */
export type PartnerKind = 'hyperscaler' | 'chipVendor' | 'sovereign';
/** What a partner supplies against the commitment: a hyperscaler's cloud capacity or custom chips (ASIC), a chip
 *  vendor's own chips. */
export type PartnerSupply = 'cloud' | 'asic' | 'chips';
/** A deal's strings (FIN4a, FIN4b): only strings that do something. */
export interface DealStrings {
  /** Blocks deals with the partner's competitors (as before FIN4a: for good). Optional for more money (FIN4b); always
   *  part of a rescue. */
  exclusivity?: boolean;
  /** IP access (FIN4b, spec §6.1): the partner's affiliated rival lab licenses your models while the deal runs (to
   *  `until`) and closes ~10% a year of your capability lead. `trust`: under PBC + trust, the trust voted yes at signing
   *  on licensing a capability-threshold model; without it, such models stay out of the licence. */
  ipAccess?: { lab: LabId; trust?: boolean };
  /** Share of revenue paid to the partner while the deal runs (to `until`). */
  revenueShare?: number;
  /** Votes of the board seat the partner holds (a rescue only: hyperscalers get no seat, spec §6.1). */
  boardVotes?: number;
}
/** What a partner supplies against the take-or-pay commitment, as signed (priced on the expected market path). */
export interface DealSupply {
  kind: PartnerSupply;
  /** Cloud: capacity (H100e) for the term; chips: H100e delivered each quarter. */
  h100e: H100e;
  quarters: number;
  /** Price in the first and last quarter: $K per H100e-year (cloud) or $K per H100e (chips). */
  first: number;
  last: number;
  /** Cuts off the expected path: the firm discount (spec §5) and the partner's own for the commitment; custom chips
   *  also cost `costMult` of an H100e's list price (perf per dollar). */
  firmDiscount: number;
  partnerDiscount: number;
  costMult?: number;
  /** Every take-or-pay payment over the term ($B), the prepaid part included. */
  total: Money;
  /** Chips: the part of the first delivery prepaid at signing on the supplier's terms (FIN5a), $B; `perQ[0]` is net
   *  of it. */
  prepaid?: Money;
  /** The day its supply ends (rationing priority runs to it). */
  endDay?: Day;
}
/** A strategic partner deal as signed (FINANCE-V3 §6; FIN4a). One per partner; a rescue tops the partner up. */
export interface StrategicDeal {
  id: string;
  partner: string;
  kind: PartnerKind;
  day: Day;
  /** Equity paid in at signing and promised in tranches ($B; the tranches land on their conditions). */
  equityNow: Money;
  equityLater: Money;
  supply?: DealSupply;
  strings: DealStrings;
  /** Day the deal's running terms end (supply, revenue share, rationing priority). */
  until: Day;
  rescue?: boolean;
  /** A stake from before the start (the legacy Northwind stake, the challenger's strategic investor): a holder, no
   *  running terms. */
  legacy?: boolean;
}

export interface Board {
  preset: GovernancePresetId;
  seats: BoardSeat[];
  confidence: number; // BC 0..100
  /** Charter right (FINANCE-V3 §7.2, nonprofit-controlled PBC): the nonprofit's safety committee halts the release of
   *  a model the player's own safety evals red-flag (read by the deployment gate, FIN3b). */
  safetyCommitteeVeto: boolean;
}

/** Major decisions the board votes on (FINANCE-V3 §7.3). Operating decisions (compute, releases, research, pricing)
 *  are never voted on. `transferModel` is a charter decision only the PBC + trust's trust votes on (§7.2, FIN3b). */
export type MajorDecision = 'saleOfControl' | 'merger' | 'downRound' | 'rescue' | 'commitments' | 'debt' | 'transferModel';

/** One voting seat's vote on a major decision (FIN3a): deterministic, shown before you ask. lean = stance · decision
 *  + outside-ownership drift + board mood + the situation; yes when lean > 0 (the CEO's seat always votes yes). */
export interface SeatVote {
  holder: string;
  kind: BoardSeat['kind'];
  weight: number;
  yes: boolean;
  lean: number;
  parts: { stance: number; drift: number; mood: number; need: number };
}

/** A board vote (FIN3a, spec §7.3): passes when the weighted yes is more than half of the voting weight. */
export interface BoardVote {
  decision: MajorDecision;
  label: string;
  /** Why this needs the board (the trigger, e.g. "firm payments $140B a year above 3× revenue"). */
  trigger: string;
  /** The situation term every seat shares, in words (e.g. "runway 2.1 q: the alternative is running out of cash"). */
  needLabel: string;
  seats: SeatVote[];
  yes: number;
  total: number;
  passes: boolean;
  /** Founder control (founder preset before listing, or dual-class): a failed vote can be forced at a confidence cost.
   *  Never for a charter vote by the trust. */
  canForce: boolean;
  /** Who votes: the whole board (default) or, for the PBC + trust's charter rights, only the trust's (mission) seats. */
  body?: 'board' | 'trust';
}

/** One seat's vote at an ouster review (FIN3b, spec §7.5): yes when lean = grievance + depth − reluctance > 0. */
export interface OusterSeatVote {
  holder: string;
  kind: BoardSeat['kind'];
  weight: number;
  yes: boolean;
  lean: number;
  parts: { grievance: number; depth: number; reluctance: number };
  /** Board confidence below which this seat would vote to remove you (undefined: it never would). */
  turnsBelow?: number;
}

/** The ouster vote (FIN3b): deterministic, seat by seat, held at a quarterly review once confidence is below 25 and
 *  the board's warning is at least 60 days old; passes when the weighted yes is more than half (the CEO's seat does not
 *  vote). */
export interface OusterVote {
  seats: OusterSeatVote[];
  yes: number;
  total: number;
  passes: boolean;
  /** Whether a vote is held at the next review (confidence below the line and the warning old enough). */
  live: boolean;
  /** Shares of the last year's confidence losses the grievance is read from. */
  grievance: { slow: number; reckless: number; burn: number };
  /** The board's reluctance to remove a CEO (the legacy nonprofit's is half: ouster comes ×2 as easily). */
  reluctance: number;
}

export interface BoardSeat { kind: 'founder' | 'mission' | 'financial' | 'strategic' | 'independent' | 'gov'; holder: string; stance: [number, number, number, number]; weight: number; }

// ───────────────────────────── Compute market & power (§3.8) ─────────────────────────────

export interface ChipMarket {
  Kpkg: number; Khbm: number; Kwafer: number; // H100e per quarter
  pipe: { pkg: number[]; hbm: number[]; wafer: number[] }; // arrivals by future quarter index
  supplyQ: number; // S_t, H100e this quarter
  binding: 'packaging' | 'hbm' | 'wafer';
  cost: number; // c_t, $K per H100e
  markup: number; // μ
  premium: number; // π_t
  listPrice: number; // P_t $K per H100e
  rental: number; // r_t $/H100e-hour
  backlog: number; // B_t EWMA
  cumOrders8q: number[];
  geoTW: number; disruptTW: number; disruptKR: number;
  exportPolicy: 'strict' | 'caseByCase' | 'open';
  demandQ: number; // D_t
  exoDemandQ: number; // hyperscalers/others not modelled as labs
  /** WS3 market bookkeeping (quarter index, stock, lab orders). */
  ws3: MarketWS3;
}

export interface ChipOrder {
  id: string; lab: LabId; qty: H100e; kind: 'spot' | 'standard' | 'lta';
  price: number; // $K locked
  deposit: Money; dueQ: number; // quarter index of delivery
  ltaEndQ?: number; prepayFrac: number; nonTW: boolean;
  delivered: H100e;
  /** A firm (take-or-pay) single batch: not cancellable, rationing priority. Tranche orders ('lta') are always firm. */
  firm?: boolean;
  /** Tranche orders: price per tranche ($K), on the expected market path at signing (FIN1, spec §5). */
  prices?: number[];
  /** Tranche orders: quarter index of the first tranche (prices[dueQ − ltaStartQ] is the tranche due). */
  ltaStartQ?: number;
  /** How the balance due on delivery is paid (spot and single batches; FIN1, spec §4): cash, a financing lease at
   *  `leaseRate` (annual, locked at the order) or a chip-backed loan. */
  pay?: 'cash' | 'lease' | 'loan';
  leaseRate?: number;
}

export interface CloudContract { id: string; provider: string; h100e: H100e; costPerYear: Money; startDay: Day; endDay: Day; cancellableNoticeQ: number | null; }

export interface Site {
  id: string; name: string; region: 'US' | 'Gulf' | 'other';
  path: 'lease' | 'brownfield' | 'gas' | 'grid' | 'nuclear';
  mw: number; // facility MW capacity when live
  stage: 'permitting' | 'power' | 'building' | 'live' | 'blocked';
  stageEndDay: Day;
  crash: boolean;
  capex: Money; capexPaid: Money;
  installed: H100e;
  communityPackage: boolean;
  spvFunded: number; // share of capex funded by a lessor (lease / SPV, FIN1 spec §4); 0 = paid in cash
  /** WS3 site bookkeeping (opposition roll, build quarters, financing). */
  ws3: SiteWS3;
}

export interface PowerGrid {
  poolGWPerQ: number; // new US large-load grid capacity per quarter
  queue: { siteId: string; gw: number }[];
  capacityPrice: number; // κ_region uplift 0..0.15
  kWPerH100e: number;
  transformerLeadQ: number;
  /** WS3 grid-pool bookkeeping. */
  ws3: PowerWS3;
}

export interface CapitalMarkets {
  y10: number; // %
  sofr: number; // %
  hype: number; // H
  poolAnnual: Money; // investor pool a year: π · sector value × the IPO bump (FIN5a)
  carry: Money; // unused appetite carried
  ipoWindow: boolean;
  bubbleX: number; // X_t
  /** A sector bust; `rival`: the most over-committed private rival it pushed into distress (FIN5b: offered via E32). */
  busted?: { day: Day; recoverDay: Day; rival?: LabId };
  shocks: { kind: string; dH: number; halfLifeQ: number; day: Day }[];
  /** WS3 investor-pool bookkeeping. */
  ws3: CapitalWS3;
}

// ── WS3 finance/compute working state (folded from finance/ext.ts at M2) ──

/** Per-calendar-year tallies (tests F7/F8, finance panel "where the money went"). $B unless noted. */
export interface YearStats {
  revenue: Money; payroll: Money; otherOpex: Money; computeCosts: Money; interest: Money;
  capexChips: Money; capexSites: Money; capexSitesFinanced: Money; supplierFunding: Money;
  /** spvFinanced: capex funded by lessors (site and chip financing leases, FIN1). */
  equity: Money; dealEquity: Money; debtDrawn: Money; spvFinanced: Money; cloudFinanced: Money; leaseFinanced: Money;
  /** Chip capex a lessor paid at delivery (financing leases, FIN1); missing on older saves. */
  capexChipsFinanced?: Money;
  /** Firm payments a renegotiation deferred out of this year (FIN4r), by what they pay for: compute (cloud, leases,
   *  acquired contracts: the computeCosts kinds) and chips (tranches). Incurred this year, paid at the contracts' end. */
  deferredCompute?: Money;
  deferredChips?: Money;
  minRunwayQ: number; distressDays: number;
  /** Cash booked through the finance ledger (`bookCash`, finance/ledger.ts) by flow kind, $B (signed). Every change to
   *  player cash goes through it, so Σ flows = Δcash (M2 money-flow audit, scripts/v2/money.ts). */
  flows?: Partial<Record<CashFlowKind, Money>>;
}

/** Cash-flow kinds of the finance ledger; each has exactly one owner (M2 money-flow audit).
 *  WS5: revenue, world · WS3: payroll, security, transitionFund, opex, commitments, compute, financing ·
 *  WS1: training, staff · WS4: relations (actions, events, statutory fines). */
export type CashFlowKind =
  | 'revenue' | 'world'
  | 'payroll' | 'security' | 'transitionFund' | 'opex' | 'commitments' | 'compute' | 'financing'
  | 'training' | 'staff'
  | 'relations';

/** The terms a partner offers now (FIN4a, spec §6.1), shown in full before you sign. Computed, never stored. */
export interface PartnerTerms {
  partner: string;
  kind: PartnerKind;
  rescue: boolean;
  /** Equity paid in at signing ($B) and the equity tranches with their conditions (tranche condition grammar). */
  equityNow: Money;
  tranches: { amount: Money; condition: string; dueDay: Day; deadline: Day }[];
  /** Supply against a take-or-pay commitment: per-quarter payments ($B) and prices on the expected path. */
  supply?: DealSupply & { perQ: Money[]; prices: number[]; startQ: number };
  strings: DealStrings;
  /** A hyperscaler's stake cap (15%): tranches land only up to it. */
  stakeCap?: number;
  /** A sovereign cheque's political cost (scrutiny, Congress trust, security demand). */
  politics?: { scrutiny: number; congress: number; securityDemand: number };
  /** A rescue tops the partner up to this stake. */
  stake?: number;
  /** Years the running terms last (supply, revenue share, priority, IP access). */
  years: number;
  /** FIN4b: the optional strings and what each adds (equity $B over the terms without it, under the stake cap), or why
   *  it is not on offer. `on` = chosen in these terms. */
  options: { exclusive: PartnerOption; ipAccess: PartnerOption & { lab?: LabId; labName?: string } };
}
/** An optional string on a partner offer (FIN4b). */
export interface PartnerOption { on: boolean; bump: Money; blocked?: string }

export interface PendingRound {
  day: Day;
  ask: Money;
  max: Money;
  preMoney: Money;
  anchor?: string;
  ipo: boolean;
  /** The round's milestone (priced rounds; none for the IPO) and the pitch's price multiplier on the mark (FIN2). */
  thesis?: Thesis;
  priceMult?: number;
  /** IPO with dual-class shares (§2.6). */
  dualClass?: boolean;
}

/** A round investors repriced below the last valuation at close: the player accepts the down round or pulls it
 *  (LIMITS: the CEO used to pull it silently). Pulled at `deadline` if the player does nothing. */
export interface RepricedRound {
  day: Day;
  deadline: Day;
  ask: Money;
  /** Pre-money investors now offer, and the last round's post-money it falls below. */
  pre: Money;
  lastPost: Money;
  anchor?: string;
  ipo: boolean;
  thesis?: Thesis;
  dualClass?: boolean;
}

/** End-of-quarter compute snapshot (H100e) for the Compute chart's past quarters. */
export interface ComputeSnap { q: number; racks: H100e; cloud: H100e; running: H100e; installing: H100e; idle: H100e }

export interface FinanceWS3 {
  /** The last quarterly story mark (FIN5a): sector value and the player's share, for the valuation's two causes. */
  mark?: { S: Money; share: number };
  /** Last 8 end-of-quarter compute snapshots (computeHistQ). Missing on saves made before it. */
  computeHist?: ComputeSnap[];
  pendingRound?: PendingRound;
  repricedRound?: RepricedRound;
  /** Delivered chips not yet installed: in transit (this quarter) and ready (installable), plus their book value. */
  inventory: { transit: H100e; ready: H100e; book: Money };
  /** Gross purchase cost of owned installed chips ($B) — O&M base and GPU-loan collateral. */
  chipBook: Money;
  /** Short-term spot rentals (inference cloud usage). */
  rentals: { h100e: H100e; endDay: Day; perYear: Money }[];
  /** Reserved supplier capacity (H100e/q) from funded expansions, and when it starts. */
  /** Reserved supplier capacity outside rationing; `order`: only for that chip order (a custom-chip deal, FIN4r). */
  reserved: { perQ: H100e; fromQ: number; toQ: number; order?: string }[];
  /** Quarter-start history (oldest first, last 5) of the milestone metrics the raise card extrapolates (FIN2): public
   *  level and compute online, H100e (revenue uses `revenueHistory`). Missing on saves made before it. */
  thesisHist?: { L: number[]; H: H100e[] };
  /** Legacy-nonprofit recapitalisation (E02): start / completion days, or refused. */
  recap: { startDay?: Day; doneDay?: Day; refused?: boolean };
  /** Day cash first went negative after all options (insolvency grace). */
  negativeSinceDay?: Day;
  distressSinceDay?: Day;
  lastRenegotiationDay?: Day;
  /** M4 board telegraph (§3.7.5): day the board first warned the CEO in the current low-confidence spell; the ouster
   *  vote needs a warning at least 60 days old. Cleared when confidence recovers. */
  boardWarnDay?: Day;
  /** Day the critics were last given a board seat (FIN3b, spec §7.5; once a year). */
  criticsDay?: Day;
  /** Day of the last strategic rescue (one per year). */
  lastRescueDay?: Day;
  /** Day until which a custom-ASIC migration slows research (WS1 reads this, §3.7.4 −15% research efficiency). */
  asicMigrationUntil?: Day;
  /** Last quarter's net operating cash flow (rating input) and the cash at its start. */
  opCashQ: Money;
  /** Operating cash flow of the last four quarters (oldest first): the trailing year sizes bonds and is the rating's
   *  cash-flow test (FIN1, spec §3). */
  opCash4q: Money[];
  cashAtQStart: Money;
  /** Accumulators reset each quarter: revenue and operating costs ($B). */
  accQ: { revenue: Money; opCosts: Money };
  /** Cumulative capex at the last quarter boundary and capex in each of the last 4 quarters (bubble X_t). */
  capexCumAtQ: Money;
  capex4q: Money[];
  years: Record<string, YearStats>;
  /** FIN5c: the big-tech division's budget year (finance/parent.ts); absent for every other company. */
  division?: DivisionBudget;
}

/** A big-tech division's budget year (FINANCE-V3 §13, FIN5c). Budget years run Jul–Jun (0 = Jul 2025 – Jun 2026). At
 *  each year's review the parent minds any overspend it is covering, sets the budget (its plan × a factor read off parent
 *  confidence) and the year's goals (FinancePromise with `by: 'parent'`). */
export interface DivisionBudget {
  year: number;
  /** The parent's plan for the year (its capex path, data/v2/starts.ts) and the budget it set: plan × factor. */
  plan: Money;
  budget: Money;
  factor: number;
  /** Parent confidence when the budget was set. */
  confidence: number;
  /** Cash at the year start before its first payment: savings carried in, or (negative) the parent's advance still
   *  outstanding, repaid from this year's payments first. */
  carryIn: Money;
  /** Budget paid so far this year. */
  paid: Money;
  /** Last reviews (oldest first, at most 4). */
  reviews: DivisionReview[];
}
export interface DivisionReview {
  year: number; day: Day; budget: Money;
  /** Net spending over the year, the overspend the parent was still covering at the review and the confidence it cost. */
  spent: Money; over: Money; overConf: number;
  goals: { met: number; near: number; missed: number };
}

/** Non-player lab order (rivals, China): kept on the market so WS4 can place them via `placeLabOrder`. */
export interface LabOrder { id: string; lab: LabId; qty: H100e; dueQ: number; weight: number; delivered: H100e }

export interface MarketWS3 {
  /** Quarter index the market last cleared (Q3 2025 = 0). */
  q: number;
  /** Global installed stock (H100e), cumulative deliveries (test F3). */
  stock: H100e;
  /** Production (deliveries) this quarter and last quarter's D/S. */
  shipped: H100e;
  ds: number;
  /** Supply by quarter for the last 8 quarters (β_eff denominator). */
  supply8q: number[];
  /** Exogenous-demand multiplier from shocks (test F4/F5 and events) and its decay per quarter toward 1. */
  exoMult: number;
  exoMultDecay: number;
  /** Taiwan / Korea disruption quarters remaining; quarter the last wafer node conversion happened. */
  twQ: number; krQ: number;
  lastConversionQ: number;
  labOrders: LabOrder[];
  /** Labs whose orders WS4 places itself (their default demand is then off). */
  managedLabs: LabId[];
  /** Player's fill share of last quarter's orders and the reason weights (UI "your allocation"). */
  playerFill: number;
  playerWeight: number;
  /** Lease (colocation) capacity available to labs this quarter, GW of facility power. */
  leasePoolGW: number;
}

export interface PowerWS3 {
  /** Grid pool still available to labs this quarter (GW). */
  poolLeftGW: number;
  /** Pre-ordered transformer capacity not yet assigned to a site (GW). */
  transformersGW: number;
}

export interface CapitalWS3 {
  /** Hype net of the decaying shock terms (H = base − Σ shocks). */
  hypeBase: number;
  /** Sector run-rate R_sector over the last 5 quarters (oldest first). */
  rSectorHist: Money[];
  /** Private rivals' revenue run-rate at the last quarter marks (oldest first, last 8): their momentum in the story
   *  share (FIN5a; the player's is finance.revenueHistory). */
  labRev?: Record<LabId, Money[]>;
  /** This quarter's pool for the player (story share × (A/4 + carry), FIN5a) and how much of it has been raised. */
  playerPoolQ: Money;
  playerTakenQ: Money;
  playerShare: number;
  /** Lab partner anchors (each partner anchors at most one lab at a time, §3.7.4). */
  anchors: Record<string, LabId>;
  /** Public-frontier level a quarter ago (hype surprise term). */
  lastFrontierL: number;
  /** Public-frontier level at the last 4 quarter marks (oldest first; M4 smoothed surprise). */
  frontierHist?: number[];
  /** Markets' expected public-frontier pace (levels/quarter), adapting to the observed pace (M4). */
  expectedDL?: number;
  ipoOpenedDay?: Day;
  spreadAddBp: number;
}

export interface SiteWS3 {
  /** Opposition roll done (once, at the end of permitting). */
  rolled: boolean;
  delayedQ: number;
  /** Day the grid interconnection request was filed (queue credit). */
  queuedDay?: Day;
  /** Planned building quarters (8 default, 4 crash; lease 1–3). */
  buildQ: number;
  /** Financing lease (FIN1, spec §4): the lessor's annual return, locked when the site was started, and the amount it
   *  has funded so far with construction interest capitalised quarterly. Lease payments start at go-live. */
  lease?: { rate: number; funded: Money };
  /** E27 large reactive community package: the retried permitting roll uses its unblock odds (FIN1, spec §4). */
  reactive?: boolean;
  startDay: Day;
  /** Day construction started and the day it went live (UI timeline, test F10). */
  buildStartDay?: Day;
  liveDay?: Day;
}

// ───────────────────────────── Rivals & China (§3.10) ─────────────────────────────

/** Hidden posture (research/17 §1.6.3). */
export interface SafetyPosture {
  safetyInvestment: number; evalRigor: number; externalAccess: number; disclosureRate: number;
  raceRelaxation: number; bindingness: number; rhetoricGap: number; rlIntensity: number; prefIntensity: number;
}

/** Simplified model lineage for non-player labs. */
export interface SimpleModel {
  id: string; name: string; day: Day;
  /** Readouts of G (model v3 F1, F3): Lg = λ(G), domain levels. */
  Lg: number; domains: Record<DomainId, number>;
  traitsTrue: TraitVector; // hidden
  uModes: UModeId[]; // hidden
  isPublic: boolean; openWeights: boolean;
  stolenFrom?: LabId;
  /** Model v3 F1: general effective compute (OOM) and the physical design behind it: the base's training FLOP and active
   *  parameters, serving FLOP per token (2·N_active × the shape's token multiplier). */
  G: number;
  flop?: number;
  params?: number;
  fpt?: number;
  /** Model v3 D10: the RL part of G (OOM over the leader's day-0 recipe: G − the base's G_pre − the reference RL gain on
   *  it), set with the design; the model's reasoning tokens for the same answer fall with it (worldfx/serving.ts tokEff). */
  rlG?: number;
  /** RD-X03: the reference-profile build its training made (actors/rivalModel.ts rivalVersionBuild: baseG and rlGains
   *  on the lab's reference portfolio); its work fit, horizon and domain levels read it. Absent: a model known by G alone. */
  build?: VersionBuild;
  /** RD-X02: domain effective-compute offsets (OOM) of a rival version post-trained after its lab adopted domain ideas
   *  (P09 / P11 / P22): added to G in that domain's level (setModelG). */
  domainDg?: Partial<Record<DomainId, number>>;
  /** RD-X04: the lab's recipe G (RECIPE_F) when the version was post-trained: what releasing it reveals (diffusion.ts). */
  recG?: number;
}

/** Model v3 F1: a non-player lab's base model (actors/rivalModel.ts): generation, finish day, training FLOP, active
 *  parameters, tokens per parameter, G_pre (OOM) and the pretraining recipe frozen at launch (OOM over the leader's day-0
 *  recipe). A stolen base keeps the G_pre the thief got. */
export interface RivalBase { gen: number; day: Day; flop: number; params: number; tpp: number; gPre: number; ePre: number }
/** Model v3 F1/F2: a non-player lab's physical model state. Its recipe is in the player's stack parts (`rec`, grown
 *  through `pool`); what leaks, diffusion and events give it enters the pretraining part as public knowledge (OOM, model
 *  v3 F3: actors/rivalModel.ts addRivalKnowledge). */
export interface RivalPhys {
  /** The base the lab's versions are post-trained on. */
  base: RivalBase;
  /** The base run in training: launch day, FLOP so far, the pretraining recipe frozen at launch. */
  run?: { day: Day; flop: number; ePre: number };
  /** Research-efficiency multiplier (1 for every rival lab; China's effLab applies on top). */
  eff: number;
  /** Model v3 D10: serving efficiency (OOM over the 2025 reference serving stack), the player's serving stack at
   *  aggregate level: grows from the lab's research speed with the Inference-efficiency line's returns; its first 0.33 OOM
   *  raise decode utilisation, the rest cuts FLOP per token (models/stacks.ts serveSplit). */
  serve: number;
  /** Day of the last continual-learning period (RD-T03: the stream spends the FLOP accrued since). */
  clDay?: Day;
  /** RD-T03: the internal model's streamed state on base (gen, flop): its pretraining G, its RL recipe as the
   *  equivalent at the reference RL FLOP (mid), its RL ceiling raise and RL FLOP. Absent or on another base: the base's
   *  G_pre at today's RL recipe (actors/rivalModel.ts clStateOf). */
  cl?: { gen: number; flop: number; gPre: number; mid: number; ceil: number; rl: number };
  /** The recipe (model v3 F2): pretraining efficiency realised at the run's FLOP (OOM over the leader's day-0 recipe),
   *  RL efficiency and RL ceiling (OOM, the player's rlMid / rlCeil stacks). */
  rec: { pre: number; mid: number; ceil: number };
  /** Research pools of the three parts: OOM at test scale since the start (the lines' pools at aggregate level). */
  pool: { pre: number; mid: number; ceil: number };
  /** RD-X02: aggregate adoption of the paradigms' typed effects (actors/rivalModel.ts adoptRivalIdeas): research spent on
   *  the idea in progress (standard-team-months) and each finished idea's realised effect (0: it did not work here). */
  ideas?: { spent: number; done: Record<string, number> };
}

/** A rival's money (FIN5b, finance/rivalFinance.ts). A private rival's valuation is its story share of the sector value
 *  (marked quarterly, half-way, at most its cap); parent-funded labs (big tech, open weights, China) carry valuation 0. */
export interface RivalFinance {
  cash: Money;
  revenueRun: Money;
  valuation: Money;
  commitments: Money;
  distress: boolean;
  /** Story share at the last quarterly mark (before the cap); unset until the first mark. */
  mark?: number;
  /** Investor money open to it this quarter: its part of the pool, the unused part carrying 50% (as the player's). */
  poolQ?: Money;
  /** Equity its investors have put in, start included (an exit pays them back a multiple of it). */
  raised?: Money;
  /** Day of its last priced round. */
  lastRoundDay?: Day;
}

export interface RivalLab {
  core: Omit<LabCore, 'deployments' | 'models'>;
  archetype: string; // LAB_ARCHETYPES id
  internal: SimpleModel;
  publicModel?: SimpleModel;
  /** RD-P02 (DD-01, DD-18): the lab's lineup besides its public model, real models on sale as cheaper tiers: its earlier
   *  public models and the distilled students of its releases (actors/rivalModel.ts rivalLineupStep). */
  lineup?: SimpleModel[];
  /** RD-P02: students its aggregate distill step is making; each goes on sale on its `day`. */
  distilling?: SimpleModel[];
  /** RD-P07 (DD-03 rival part), RF-P1, MK-11: the product tools (data/v2/tools.ts ProductToolId) the lab sells with:
   *  what its lab had shipped by the start (tools.ts toolsAtStart), plus a tool new in the game TOOL_LAG_DAYS after the player first shipped it
   *  (actors/rivalModel.ts rivalToolStep); its offers and Chat appeal read them. */
  tools?: string[];
  nextBaseDay: Day;
  /** Model v3 F1: recipe, base and run state (actors/rivalModel.ts). */
  phys: RivalPhys;
  finance: RivalFinance;
  visible: { frameworkVersion: number; clauseType: 'conditional' | 'allAdopt' | 'unconditional' | 'override' | 'state'; testers: string[]; indexGrade?: string };
  intel: RivalIntel;
  meters: { poachAggression: number; lobbyStance: number; openness: number };
  pressure: number; // race pressure 0..1 (research/17 §1.6.5)
  pressureDays: number;
}

export interface RivalIntel {
  leadDaysEst: number; // player's estimate of gap vs player's best INTERNAL model (v1 bug fix)
  leadDaysSd: number;
  misalignBand: [number, number]; // posterior band
  knownIncidents: string[];
  lastReportDay?: Day;
}

export interface ChinaActor {
  preset: string;
  lab: RivalLab; // DeepCent-style collective (or leading Chinese lab before centralization)
  meters: {
    computeShare: number; computeAbs: H100e; chipSelfSufficiency: number; domesticFab: number;
    distillationAccess: number; intelCapability: number; theftIntent: number; centralization: number;
    stateSteering: number; safetyConcern: number; openWeights: number; taiwanTension: number;
    normsDiplomacy: number; verificationWillingness: number; econLeverage: number; hawkDove: number;
  };
  rung: 0 | 1 | 2 | 3 | 4 | 5 | 6; // posture ladder (research/10 §1.4)
  deesc: 0 | 1 | 2 | 3 | 4 | 5; // de-escalation track D1..D5
  holdDays: Record<string, number>;
  presetWeights: Record<string, number>; // quarterly re-weighting
}

// ───────────────────────────── Government, public, blocs (§3.10) ─────────────────────────────

export interface GovActor {
  preset: string;
  aiPriority: number; regStance: number; securityDemand: number; hawkishness: number;
  nationalization: number; congressActivism: number; stateRegPressure: number; judicialCheck: number;
  awareness: number; // what gov knows about true capability 0..100
  congressControl: 'R' | 'D' | 'split';
  rungSec: 0 | 1 | 2 | 3 | 4 | 5; // G-SEC
  rungChn: 0 | 1 | 2 | 3 | 4; // G-CHN
  oversight: boolean; treaty: 'none' | 'talks' | 'restraint' | 'verified';
  statutes: { sb53: boolean; raise: boolean; euCode: boolean; federalLicensing: boolean; preemption: boolean };
  holdDays: Record<string, number>;
  lastActionDay: Record<string, Day>;
}

export interface PublicActor {
  preset: string;
  concern: number; approval: number; awareness: number; jobAnxiety: number; xrisk: number;
  regDemand: number; salience: number; activism: number; dcNimby: number; companionship: number;
  rung: 0 | 1 | 2 | 3 | 4 | 5;
  blocs: Record<BlocId, BlocState>;
}

export interface BlocState { clout: number; mobilization: number; approval: number; capturedExposure: number; }

export interface ResearchBodies {
  evalGov: { capacityPerQ: number; publishPressure: number; queue: string[] };
  evalIndep: { capacityPerQ: number; publishPressure: number; queue: string[] };
  academia: { pipeline: number; publishLagDays: number };
  index: { lastEdition?: Day; grades: Record<LabId, IndexGrade> };
}

export interface IndexGrade { overall: number; domains: { risk: number; harms: number; frameworks: number; existential: number; governance: number; sharing: number }; letter: string; }

// ───────────────────────────── Relations (§3.9) ─────────────────────────────

export interface RelationStock {
  trust: number; // 0..100
  access: 0 | 1 | 2 | 3 | 4;
  favors: Day[]; // expiry day per token (max 5)
  depOnYou: number; // 0..100
  yourDep: number; // 0..100
  belowRungDays: number;
}

export interface RelationsState {
  stocks: Record<CounterpartyId, RelationStock>;
  credibility: number; // 0..100
  talentPull: number; // −50..+50
  scrutiny: number; // 0..100
  dataLicences: string[];
}

/** Relation commitment card (research/17 §1.2). Conditions are predicate ids evaluated by WS4. */
export interface Commitment {
  id: string;
  kind: 'framework' | 'testingAgreement' | 'voluntaryAccord' | 'usageRestriction' | 'monitorabilityPledge' | 'whistleblower' | 'communityPledge';
  title: string;
  condition: { predicate: string; params: Record<string, number | string> };
  audience: CounterpartyId[];
  breakCost: { trust: number; credibility: number };
  signedDay: Day;
  status: 'live' | 'kept' | 'amended' | 'broken';
  amendments: number;
}

// ───────────────────────────── Outside world (§3.11) ─────────────────────────────

export interface WorldEconomy {
  sectors: Record<RegionId, Record<SectorId, SectorState>>;
  displacedPool: Record<RegionId, number>; // persons
  unemployment: Record<RegionId, number>; youthUnemployment: number;
  control: Record<ControlDomainId, ControlState>;
  infoShare: Record<LabId, number>; friendShare: number;
  techs: Record<WorldTechId, WorldTechState>;
  robots: { stockHWE: number; prodPerYear: number; doublingYears: number; sezOpen: boolean; sezShare: number };
  macro: Record<RegionId, MacroState>;
  dow: number;
  aiOwnerShare: number;
  intelligenceCurse: boolean;
  /** Market share of each lab's models per sector (US); recomputed daily. */
  shares: Record<SectorId, Record<LabId, number>>;
  /** World-dynamics bookkeeping (WS5). See WorldFxState. */
  fx: WorldFxState;
}

/** World-dynamics bookkeeping owned by WS5 (worldfx/*). Plain JSON; observables only (no truth). */
export interface WorldFxState {
  /** Weekly reach of AI chat apps: share of online adults using one (any provider), by region (A2b; INFO channel
   *  reach, research/16 §2.1, research/22 §2). A stock toward a target set by the best model's consumer-chat coverage.
   *  0..1 */
  reach: Record<RegionId, number>;
  /** Paid share of each provider's weekly chat users (A2b): by region, provider key (as in `cust`) → share who
   *  subscribe. A stock toward (p0 + p1·coverage)·(wtp ÷ price)^ε; empty entries start at their target. */
  paid: Record<RegionId, Record<string, number>>;
  /** MK-7 (design/MARKET.md M7): revenue ($B/yr) other sellers (provider key) earned yesterday from the buyers the
   *  player's capacity-short products turned away (worldfx/revenue.ts); rival finance adds it to their market revenue. */
  spillRev?: Record<string, number>;
  /** US employment of 22–25-year-olds vs counterfactual, by sector (Canaries, research/16 §1A.2 step 8). */
  youthRel: Record<SectorId, number>;
  /** Friction added by major incidents (+0.05 each) and court rulings; decays over a year. Per sector. */
  incidentR: Record<SectorId, number>;
  /** AI automation output factor X (CES-bounded, research/16 §4.3), by region. 1 = no AI. */
  autoLevel: Record<RegionId, number>;
  /** GDP of the human (non-SEZ, no-automation) economy, $B, by region. */
  trend: Record<RegionId, number>;
  /** US SEZ output, $B/yr (0 until SEZs open). */
  sezY: number;
  /** Equity sentiment (Dow PE): hype and fear indices. */
  hype: number;
  fear: number;
  /** Dow earnings base and the 1 Jan level (YTD headline). */
  earn0: number;
  dowJan: number;
  /** US unemployment (%) at the last 13 month starts (newest last). */
  uHist: number[];
  /** AI capex $B/yr at the last macro tick; AI-lab revenue at start; best public level at start. */
  aiCapexPrev: number;
  aiRev0: number;
  Lpub0: number;
  /** US persons laid off in the last ~30 days (EWMA); youth unemployment at the last macro tick. */
  layoffs30: number;
  youthPrev: number;
  /** Day SEZs opened (−1 = never). */
  sezDay: Day;
  /** Humanoid production (robots/yr), SEZ robot production (HWE/yr, included in robots.prodPerYear) and the US
   *  share of the robot stock. */
  humanoidProd: number;
  sezProd: number;
  robotUS: number;
  /** Headline id → last day fired. */
  hl: Record<string, Day>;
  /** Customer stocks (model v3 V4.2): per region and segment (a sector id or 'consumer'), each provider's share of the
   *  customers (provider keys as in the world mix: 'player', 'player:open', rival ids, 'china'). They move toward the
   *  market's logit shares at the segment's speed (CUSTOMER_TAU). Empty until the first revenue tick. */
  cust: Record<RegionId, Record<string, Record<string, number>>>;
  /** A8 multi-homing: per region, each provider's reach among sector buyers (the share who buy from it at all, ≤ its
   *  access; provider keys as in `cust`). A stock toward MULTI_HOMING's target; absent entries start at the region's
   *  even spread (data/v2/serving.ts MULTI_HOMING). */
  secReach?: Record<RegionId, Record<string, number>>;
  /** MK-6 (design/MARKET.md M5), MK-6b: per region, sector, closed seller (provider keys as in `cust`) and model (version
   *  id), the margin M ($ per adopted task-hour over each of that model's tiers' serving cost), a stock toward its
   *  Nash–Bertrand target (PRICE_TAU); an absent model starts at the seller's stocked margin per $ of cost × its own
   *  cost, an absent seller at today's cost-plus price (SEED_MARKUP). */
  priceM?: Record<RegionId, Record<string, Record<string, Record<string, number>>>>;
  /** MK-9 (design/MARKET.md M3, M5): per closed Chat seller (provider key), its plan margin ($ per subscriber-month over
   *  its serving cost), a stock toward μ_plan ÷ (1 − s_paid) ≤ wtp − cost (PRICE_TAU; worldfx/mix.ts). Absent: the
   *  margin that prices at the willingness to pay. */
  planM?: Record<string, number>;
  /** MK-9: per region, sector and closed seller its seat margin ($ per seat-month over the seat's serving cost), a stock
   *  toward μ_seat ÷ (1 − s_seat) ≤ SEATS.cap − cost (PRICE_TAU). Absent: the margin that prices at SEATS.cap. */
  seatM?: Record<RegionId, Record<string, Record<string, number>>>;
  /** RD-P07, RF-P1: the day the player first shipped each product tool new in this game (no lab had it at the start;
   *  actors/rivalModel.ts recordToolShips). */
  toolShip?: Record<string, Day>;
}

export interface SectorState {
  F: number; K: number; R: number; Astar: number; A: number; alpha: number;
  /** Share of the sector's workers who use AI at work (weekly; a Bass stock, A2a). Hours of use = A + useH·(W − A). */
  W: number;
  /** Share of the workers who use AI (W) with a paid enterprise seat (A2c; a stock): their assisted hours are billed by
   *  the seat, the rest of the assisted hours are free, bundled or in-house (unbilled). Seats = seat·W·E. */
  seat: number;
  E: number; E0: number; hireRate: number; binding: 'capability' | 'cost' | 'friction' | 'diffusion';
  /** CAL3-A: the buyer's net saving per adopted work-hour (1 − P_cost/(Wage·W0)) on the first tick, the reference of the
   *  Mansfield profitability term (worldfx/sectors.ts mansfieldDq). Unset until the first tick reads the market. */
  v0?: number;
}

export interface ControlState { P: number; tiers: [number, number, number, number]; accept: number; tierCap: 0 | 1 | 2 | 3; shares: Record<LabId, number>; }

export interface WorldTechState { prog: number; discoveredDay?: Day; ramp: number; exposure: number; playerProject?: { computeShare: number }; }

export interface MacroState { gdp: number; g: number; laborShare: number; wage: number; gini: number; aiCapexShare: number; energyPrice: number; }

export interface PublicKnowledge {
  publishedFindings: FindingId[];
  revealedUModes: UModeId[]; // "the world learns" — counters researchable by all
  sharedTechniquePool: number; // 0..1 public technique efficacy (lowers rivals' drift)
  /** Best open-weights model's general effective compute G (OOM; model v3 F3: was its pm). */
  openWeightsG: number;
}

// ───────────────────────────── Events, log, causes ─────────────────────────────

export interface EventQueue {
  pending: PendingDecision[];
  fired: Record<string, Day>; // event id -> last fired day
  director: { tension: number; lastCrisisDay: Day; quietUntil: Day; concurrentCrises: number };
}

export interface PendingDecision {
  id: string; // EventDefV2 id
  instance: string;
  day: Day;
  deadline: Day; // default choice applied on expiry
  data: Record<string, number | string>;
  crisis: boolean;
}

export interface DecisionRecord { day: Day; eventId?: string; actionId?: string; choice: string; tags: string[]; snapshot: DecisionSnapshot; }
export interface DecisionSnapshot { L: number; U: number; cash: Money; leadRival: number; leadChina: number; trustGov: number; approval: number; misTrue: number; }

export type LogKind = 'news' | 'incident' | 'milestone' | 'gov' | 'china' | 'public' | 'rival' | 'company' | 'research' | 'finance' | 'world' | 'alert';
export interface LogEntry { day: Day; kind: LogKind; text: string; severity?: 1 | 2 | 3 | 4 | 5; ref?: string; }
export interface Headline { day: Day; id: string; text: string; sector?: SectorId; }

/** "Why did this change" (§2.6). Keys are meter paths, e.g. 'pub.approval', 'player.finance.valuation'. */
export interface CauseLedger { byKey: Record<string, CauseEntry[]>; } // ring buffer, 40 per key
export interface CauseEntry { day: Day; delta: number; source: string; detail?: string; }

export interface SeriesV2 {
  day: Day[]; // weekly samples
  L: Record<LabId, number[]>; // best internal Lg per lab (truth for end screen; UI uses measured)
  /** Best internal frontier G per lab (OOM, weekly, aligned to day from the end): the lead clock lagDays reads it (RD-L01). */
  G: Record<LabId, number[]>;
  Lmeasured: number[]; U: number[]; M: number[]; cash: number[]; revenue: number[]; valuation: number[];
  compute: number[]; approval: number[]; trustGov: number[]; scrutiny: number[]; gdpG: number[]; unemp: number[];
  misTrue: number[]; misEst: number[];
  /** UB-2: Research speed (× the leading lab in July 2025, labSpeedRel) and the part of it the lab credits to AI staff
   *  (production.ts aiStaffSpeedPart), weekly; absent on saves before UB-2 (the history starts then). */
  speed?: number[]; speedAI?: number[];
}

export interface TutorialState { act: 1 | 2 | 3 | 4; unlocked: string[]; seen: string[]; }

// ───────────────────────────── Endings (§5) ─────────────────────────────

export type EndingId =
  | 'asiAligned' | 'asiContested' | 'asiTakeover' // player ASI
  | 'rivalAligned' | 'rivalTakeover' | 'chinaAligned' | 'chinaTakeover' // other ASI first
  | 'overtaken' | 'catastropheBio' | 'catastropheCyber' | 'war' | 'rogue'
  | 'insolvent' | 'ousted' | 'nationalized' | 'acquired' | 'retired';

export type PowerOutcome = 'treaty' | 'committee' | 'democratic' | 'corporate' | 'government' | 'multipolar' | 'beijing' | 'none';

export interface EndingV2 {
  id: EndingId;
  power: PowerOutcome;
  day: Day;
  title: string;
  text: string;
  scores: { survival: number; freedom: number; prosperity: number; company: number; geopolitics: number };
  verdict: 'win' | 'mixed' | 'loss'; // for bot tests only; not shown as a moral verdict
  epilogue: { asiDay?: Day; asiLab?: LabId; misAtAsi?: number; leverageAtAsi?: number; controlAtAsi?: number };
}

// ───────────────────────────── Engine contracts ─────────────────────────────

export interface RngLike {
  float(): number; range(lo: number, hi: number): number; chance(p: number): boolean;
  normal(mean?: number, sd?: number): number; lognormal80(p10: number, p90: number): number;
  beta(a: number, b: number): number; pick<T>(xs: readonly T[]): T;
  weighted<T>(xs: readonly { item: T; weight: number }[]): T;
}

export type Cadence = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semiannual';

export interface SystemCtx {
  /** Current day (after the clock system has advanced it). */
  readonly day: Day;
  /** Named RNG stream (§2.4). Draw only from your own workstream's streams (see design/V2-CONTRACT.md). */
  rng(stream: StreamId): RngLike;
  /** Record a cause for a meter change you already applied (§2.6). Does NOT change the meter. */
  cause(key: string, delta: number, source: string, detail?: string): void;
  /** Apply `delta` to the meter at cause key `key` (see core/causes.ts), clamp it to the meter's range, and record
   *  the cause. Returns the delta actually applied after clamping. */
  bump(key: string, delta: number, source: string, detail?: string): number;
  log(kind: LogKind, text: string, severity?: LogEntry['severity'], ref?: string): void;
  headline(id: string, text: string, sector?: SectorId): void;
  queue(eventId: string, data?: Record<string, number | string>): void;
  /** Daily memo of expensive derived values (production, understanding) shared across systems. */
  memo: Map<string, unknown>;
}

/** One engine system. The loop runs systems in ascending `order` within each cadence (§2.2). */
/** The game systems of STRUCTURE §4 that every engine system and player action belongs to (R3; R10 lints it). */
export type StructureSystem = 'people' | 'research' | 'models' | 'products' | 'safety' | 'compute' | 'finance' | 'relations' | 'world' | 'core';
/** The one verb set of STRUCTURE R2: hire · research · design & train · launch / update · set a policy · make a deal ·
 *  respond (R10 lints that every action has one). */
export type ActionVerb = 'hire' | 'research' | 'train' | 'launch' | 'policy' | 'deal' | 'respond';

export interface EngineSystem {
  id: string;
  owner: WorkstreamId;
  cadence: Cadence;
  order: number;
  /** Structure system this belongs to (STRUCTURE §4; scripts/v2/lint-structure.ts). */
  system: StructureSystem;
  run(s: GameStateV2, ctx: SystemCtx): void;
}

/** Currencies used to express every lever's cost/gain/exposure (§3.9.1, §2.7). */
export type Currency =
  | 'cash' | 'revenue' | 'compute' | 'staffTime' | 'progress' | 'leadDays' | 'trust' | 'credibility'
  | 'scrutiny' | 'talent' | 'morale' | 'boardConf' | 'approval' | 'security' | 'monitorability'
  | 'alignment' | 'freedom' | 'chinaTension' | 'dilution' | 'valuation'; // valuation: $B of the company's mark (FIN4r L4)

/** `unit` (optional, display only): the unit of `amount` when the currency label would mislead (model v3 D4: data and
 *  suite gains are tokens or fidelity, not levels "L"). */
/** `condition` (CP3d): the line applies only when this happens (e.g. "per incident disclosed"); a policy preview states
 *  its consequences this way, not as an immediate change. */
export interface CostLine { currency: Currency; amount: number; target?: CounterpartyId | string; lagDays?: number; probability?: number; unit?: string; condition?: string }

/** Player-callable lever (action catalog, research/17 §1.4; finance/compute/model actions). */
export interface ActionDef<P = Record<string, number | string | boolean>> {
  id: string;
  sphere: 'finance' | 'departments' | 'models' | 'relations' | 'safety' | 'security' | 'world';
  owner: WorkstreamId;
  title: string; // one or two words
  available(s: GameStateV2): boolean | string; // string = reason shown when unavailable
  preview(s: GameStateV2, p: P): { costs: CostLine[]; gains: CostLine[]; exposure: CostLine[] };
  /** Returns a string when the action did not go through (e.g. the board voted it down); its side effects stand. */
  apply(s: GameStateV2, ctx: SystemCtx, p: P): void | string;
  /** The board vote this action needs with these params (FIN3a: major decisions only, spec §7.3), or undefined when
   *  it needs none. Deterministic: the UI shows it before you ask, apply() reads the same vote. */
  vote?(s: GameStateV2, p: P): BoardVote | undefined;
  /** Structure verb (STRUCTURE R2) and system (§4); required (scripts/v2/lint-structure.ts). */
  verb: ActionVerb;
  system: StructureSystem;
}

export interface ChoiceV2 {
  label: string; // ≤ 3 words
  /** `data` = the pending decision's trigger data (absent in catalog lints: the preview falls back to a generic line). */
  preview(s: GameStateV2, data?: Record<string, number | string>): { costs: CostLine[]; gains: CostLine[]; exposure: CostLine[] };
  available?(s: GameStateV2, data?: Record<string, number | string>): boolean | string;
  /** The board vote this choice needs (FIN3c: a merger), shown under the choice before you pick it; `available` and
   *  `apply` read the same vote. */
  vote?(s: GameStateV2, data?: Record<string, number | string>): BoardVote | undefined;
  apply(s: GameStateV2, ctx: SystemCtx, data: Record<string, number | string>): void;
  tags: string[]; // 'race' | 'safety' | 'disclose' | ... (bots and replay)
}

export interface EventDefV2 {
  id: string;
  title: string; // ≤ 3 words
  icon: 'gov' | 'china' | 'public' | 'model' | 'rival' | 'company' | 'finance' | 'world' | 'alert';
  owner: WorkstreamId;
  crisis: boolean;
  cooldown?: number; // days; omitted = once per game
  /** Fire at most once per game for each key of the trigger data (e.g. once per trait), on top of `cooldown`. */
  onceKey?: (data: Record<string, number | string>) => string;
  deadlineDays: number;
  defaultChoice: number; // applied on expiry
  when(s: GameStateV2): Record<string, number | string> | false; // returns data bound into text
  text(s: GameStateV2, data: Record<string, number | string>): string; // terse; terms as [[glossary]] links
  choices: ChoiceV2[];
}

/** Bot policy used by headless tests (§7.4). */
export interface BotPolicy {
  id: 'ref' | 'race' | 'safe' | 'mixed' | 'passive' | 'capex2x';
  /** Called every day before the tick; may call actions. */
  act(s: GameStateV2, api: EngineApi): void;
  /** Pick a choice index for a pending decision. */
  decide(s: GameStateV2, d: PendingDecision): number;
}

export interface EngineApi {
  newGame(setup: SetupV2): GameStateV2;
  tick(s: GameStateV2, opts?: TickOptions): void; // one day, all due cadences
  act(s: GameStateV2, actionId: string, params?: Record<string, number | string | boolean>): void;
  resolve(s: GameStateV2, instance: string, choice: number): void;
  // selectors (pure; UI and bots use these, never raw hidden state)
  production(s: GameStateV2, lab: LabId): ProductionReadout;
  /** SR-11: the sight limit (believed; level L with its range) of the internal model, its measured level and the gap. */
  sightLimit(s: GameStateV2): { none: boolean; L: number; lo: number; hi: number; level: number; gap: number; versionId?: string; perTrait: Partial<Record<TraitId, number>> };
  riskSources(s: GameStateV2): RiskSource[];
  leadDays(s: GameStateV2, other: LabId): { est: number; sd: number };
  raiseCeiling(s: GameStateV2): { max: Money; bound: 'pool' | 'dilution' | 'ask'; parts: Record<string, Money> };
}

/** Test/bot hooks for one tick. Never used by the UI. */
export interface TickOptions {
  /** Extra systems merged into the schedule for this tick (tests: probes, placeholders). */
  extraSystems?: EngineSystem[];
  /** System ids to skip this tick. */
  skip?: string[];
}

/** Risk-source view row (§6.9). Built from player BELIEFS, never truth. */
export interface RiskSource { id: string; label: string; kind: 'ownModel' | 'rival' | 'china' | 'misuse' | 'theft' | 'war' | 'rogue'; estimate: number; band: [number, number]; drivers: { label: string; share: number }[]; }

// ───────────────────────────── WS4 working state (folded from actors/state.ts at M2) ─────────────────────────────

/** A quiet fix that outsiders may still discover (§3.9.3 rule 1). */
export interface Coverup { id: string; day: Day; what: string; pDaily: number; audience: CounterpartyId[]; until: Day }

/** A rival/China incident made public (drives E31 and intel bands). */
export interface RivalIncident { lab: LabId; day: Day; severity: number; misuse: boolean }

export interface Ws4State {
  /** Level the government believes the player's frontier is at (§3.10.1: announced / leaked / evaluator-reported). */
  govSeenL: number;
  leakedL: number;
  evalL: number;
  /** Level the player has publicly claimed (best measured L of an external deployment). */
  claimedL: number;
  coverups: Coverup[];
  /** Continue-through-red-flag counter (E09/E17); feeds leaks and the Index. */
  redFlags: number;
  theftAttempts: number;
  /** Escaped copy of a player model (E25 / 'rogue' ending). */
  loose?: { day: Day; versionId: string; mis: number };
  /** Open internal whistleblower report (E18) and its fix-or-escalate deadline. */
  internalReport?: { day: Day; deadline: Day };
  /** Consecutive days each competitor has led the player by ≥ 365 d after its SC (overtaken rule). */
  overtakenDays: Record<LabId, number>;
  taiwanDisrupted: boolean;
  taiwanUntil: Day;
  /** Per-counterparty access cap granted by specific agreements (§3.9.1 access rungs). */
  accessCap: Record<string, number>;
  /** Day an action was last used (cooldowns). */
  actionDay: Record<string, Day>;
  /** Dynamic posture changes on top of hidden postures (moving goalposts, joint evals). */
  postureDelta: Record<LabId, Partial<SafetyPosture>>;
  /** Moving-goalposts revisions per lab (Index penalty). */
  goalposts: Record<LabId, number>;
  rivalIncidents: RivalIncident[];
  /** Next post-training day per non-player lab. */
  nextPost: Record<LabId, Day>;
  /** Day the current internal model of a non-player lab was finished (release lag). */
  internalDay: Record<LabId, Day>;
  /** Spy multiplier after purges (recovers over a year). */
  spyMult: number;
  /** Days China/rival distillation inflow has exceeded the E06 threshold. */
  distillDays: number;
  /** Days demand exceeded capacity by > 30% (E36). */
  crunchDays: number;
  /** Misalignment evidence made public (P-LEAK / R14 / G-SEC 5). */
  misalignmentLeak: boolean;
  /** Days DA−track conditions held (D2 needs 180 quiet days). */
  lastTheftOrCyberDay: Day;
  usProposedTalks: boolean;
  treatyRejected: boolean;
  /** Player G-SEC 5b acceptance (DPA consolidation) — government-held lab. */
  dpaAccepted: boolean;
  nationalizedHard: boolean;
  soldControl: boolean;
  retired: boolean;
  /** Unrestricted surveillance / weapons contract signed (Freedom −10). */
  unrestrictedDefense: boolean;
  defenseContract: 'none' | 'limits' | 'unrestricted';
  /** Disclosure record for the Index: disclosed vs leaked/covered incidents and findings. */
  disclosed: number;
  leaked: number;
  papers: number;
  /** World GDP (US) at game start, for Prosperity. */
  gdp0: number;
  /** Rolling drift accumulator per meter key, flushed to the cause ledger weekly. */
  drift: Record<string, number>;
  /** Pending evaluator reports (versionId → day due) and the last reported version. */
  evalReports: { versionId: string; due: Day; by: 'evalGov' | 'evalIndep' }[];
  reportedVersions: string[];
  /** China gap history (lead days, weekly) for "widening"/"shrinking" rules. */
  chinaLeadHist: number[];
  /** Merged rival compute folded into the player by DPA / acquisition (WS3 should add to computeOnline). */
  absorbedCompute: number;
  /** Last day a crisis decision was queued (storyteller), and noise for the chaotic storyteller. */
  storyNoise: number;
  /** Event requests from WS4 systems; the director fires them under storyteller limits (E4). Expire after 60 d. */
  requests: { id: string; day: Day; data: Record<string, number | string> }[];
}

/** SR-13 safeguard items (safety/safeguards.ts). */
export type SafeguardKind = 'control' | 'review' | 'restrict' | 'lockdown';
export type ControlSetting = 'defer10' | 'defer20' | 'resample';
export interface SafeguardItem { kind: SafeguardKind; setting?: ControlSetting; since: number }
