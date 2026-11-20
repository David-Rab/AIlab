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
//    signals/parentBaseId; TrainingRun.holdUntil/paAtStart/signals; ModelsState.stream.paTrack;
//    RivalLab.managed.
//  - ProductionReadout gains required `whatIf` and `sdAI` (only WS1 constructs readouts).
//  - Coordinates: a model's v1-equivalent progress is q = pm + calShift (§3.1.5); V0 starts at pm = p0 − calShift.
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

// ───────────────────────────── Ids ─────────────────────────────

export type Day = number;
export type Money = number; // $B
export type H100e = number;

export type BaselineId = 'classic' | 'reality';
export type WorldPresetId = 'sampled' | 'ai2027' | 'authors2026' | 'fast' | 'slow';
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
export type SignalId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8';

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
  /** Milestone threshold shift (years) fitted so RefBot's best internal model hits research/11 dates (§7.1). */
  calShift: number;
  /** BRIDGE(V7): the v3 level offset simple labs (rivals, China, the leader lab) are credited, CAL_SHIFT_V2 − CAL_SHIFT
   *  (models/capability.ts simpleLag). */
  simpleCredit?: number;
  /** Production-function parameters (research/13 §1.4). For the player only the CES parameters are read (ρc, λ, u, v,
   *  ρ, ζ, m2b); the knots are the rivals' (BRIDGE(V7)). */
  prod: ProdParams;
  /** Model v3 V3: per-preset work-type calibration (data/v2/workTypes.ts V3_CAL): G_SC (OOM of effective compute a
   *  superhuman coder needs), Δ_bm (best-to-median human gap, OOM), r (returns to research), sd_SC (AI research taste at
   *  the superhuman coder, SD; AIFM's "AI taste at AC"). */
  v3: { gSC: number; dBM: number; r: number; sdSC: number };
}

export interface ProdParams {
  rc: number; // coding-task substitutability ρc (−2)
  lam: number; // parallel penalty λ (0.5)
  La: number; // infinite-labor asymptote (100; 15 for authors2026)
  Ca: number; // infinite-compute asymptote (1000)
  slow10: number; // slowdown at 10x less experiment compute (2.5 / 2.8)
  rho: number; u: number; v: number; zeta: number; // derived (cesFromAsymptotes)
  m2b: number; // taste top/median (3.25 / 3.7)
  kappa: number; // η ∝ M^κ pre-SC (3)
  etaSC: number; // FTE per H100e of agent inference at SC (11.3)
  knots: ProdKnot[]; // generated per preset at world creation (§3.2.4)
}

export interface ProdKnot { p: number; Mref: number; A: number; R: number; Tref: number; sdAI: number; }

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
  difficultyMult: number; // D_w = exp(0.35(λ6−λ4)) × align preset (§3.5.4)
  actorPresets: { gov: string; public: string; china: string; rivals: Record<LabId, string> };
  rivalPostures: Record<LabId, SafetyPosture>;
  chinaPosture: SafetyPosture;
}

// ───────────────────────────── Labs, models, runs ─────────────────────────────

export interface StaffByRole { cap: number; saf: number; }

/** Compute pools a lab splits its online compute into (§3.4.2). Fractions sum to 1. */
export interface ComputeSplit {
  training: number; experiments: number; agents: number; synthetic: number;
  serving: number; safety: number;
}

export interface LabCore {
  id: LabId;
  name: string;
  kind: 'player' | 'rival' | 'china';
  status: 'active' | 'merged' | 'bankrupt' | 'nationalized' | 'shutdown';
  mergedInto?: LabId;
  /** Software/algorithmic know-how (years). Grows with the production function (§3.1.2). */
  pa: number;
  /** Day the lab's internal model first crossed SC; freezes its reference compute term (§3.1.3). */
  scDay?: Day;
  computeOnline: H100e;
  split: ComputeSplit;
  /** Research mix set by hand. Absent/false: experiments vs agents is re-split to the best mix every day. */
  researchManual?: boolean;
  staff: StaffByRole;
  /** τ_h, star-hire taste multiplier (research/13). */
  tasteHire: number;
  models: ModelsState;
  deployments: Deployment[];
  security: SecurityState;
  paradigms: Record<ParadigmId, ParadigmState>;
  /** Cached production readout from the last daily tick (not authoritative; recomputable). */
  prodCache?: ProductionReadout;
  milestoneDays: Partial<Record<MilestoneIdx, Day>>; // first crossings only (v1 bug #3 fix)
  /** Leader lab only (BUILD-PLAN R2): extra release lag (progress years) added to simpleLag (LEADER_CAL at newGame). */
  lagCal?: number;
}

export type MilestoneIdx = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ModelsState {
  bases: BaseModel[];
  versions: ModelVersion[];
  runs: TrainingRun[];
  /** Continual-learning stream (P08) if active: the version id being updated in place. */
  stream?: {
    versionId: string; startedDay: Day; lastAuditDay: Day;
    /** BRIDGE(V6,V7) readout: pa-equivalent of the recipe the stream has absorbed. */
    paTrack?: number;
    /** Model v3 V2: the recipe the stream has absorbed (7-day lag): e_pre at its base's FLOP, RL efficiency, RL ceiling. */
    track?: { pre: number; rlMid: number; rlCeil: number };
  };
  nextName: number; // naming counter
}

export interface BaseModel {
  id: string;
  name: string; // e.g. "Atlas-3"
  day: Day; // completion
  /** Physical pretraining FLOP (6·N_active·tokens; a continued base adds its FLOP). */
  flop: number;
  /** Active parameters and training tokens (MODEL-V3 §3.2). */
  params: number;
  tokens: number;
  /** Lab know-how pa at launch (progress-years; the recipe vintage readout, BRIDGE(V2)). */
  paAtStart: number;
  /** Pretraining effective compute G_pre (OOM, frozen at launch: MODEL-V3 §3.2). */
  gPre: number;
  /** Pretraining recipe efficiency frozen at launch (OOM; E_START + e_stack(pa)). gPre − ePre is the physical part, so
   *  a continual-learning stream can re-apply today's recipe. */
  ePre: number;
  design: BaseDesign;
  /** Day the run started (the recipe is frozen here). Absent = `day`. */
  startDay?: Day;
  /** Data-mix specialisation per domain (OOM, MODEL-V3 §2.3 s_d,data). */
  sD?: Partial<Record<DomainId, number>>;
  /** Design domain offsets of the base kept in levels (none today; paradigm offsets are added per version). */
  off?: Partial<Record<DomainId, number>>;
  /** Data repetition at training: epochs over the unique tokens. */
  epochs?: number;
  /** BRIDGE(V6,V7): scale vs the frontier run F(t) at launch (S5, scrutiny). */
  scale?: number;
  /** Serve cost of models on this base (display readout, 0.5 = reference; costs read FLOP per token, V4). */
  serve?: number;
  /** Monitorability cap from the base shape (latent = 0.05). */
  monitorability?: number;
  /** Trait-pressure signals from the base design (S4, S5, S6 …) for WS2. */
  signals?: Partial<Record<SignalId, number>>;
  /** Continue-train parent. */
  parentBaseId?: string;
  lineage: string; // traits + U-mode family; distill/continue keep parent lineage
  traitsTrue: TraitVector; // hidden
  uModes: UModeId[]; // hidden: present in this lineage
}

export interface ModelVersion {
  id: string;
  name: string; // e.g. "Atlas-3.2"
  baseId: string;
  parentVersionId?: string;
  day: Day;
  variant: Variant;
  design: PostDesign;
  /** TRUE capability in progress units (hidden; benchmarks are noisy reads of it). */
  pm: number;
  /** TRUE general level 0..15 and domain levels (hidden). */
  Lg: number;
  domains: Record<DomainId, number>;
  traitsTrue: TraitVector; // hidden
  masks: Record<TraitId, Partial<Record<ToolFamily, number>>>; // hidden: how much each family is fooled
  uModes: UModeId[]; // hidden
  monitorability: number; // 0..1, visible (from design + measured controllability)
  /** Serving cost relative to the reference design at the same training FLOP (0.5 = reference), visible: a design readout
   *  only; costs, prices and capacity read the physical FLOP per token `fpt` (model v3 V4). */
  serveCost: number;
  /** Serving FLOP per token (2·N_active × the shape's token multiplier × the serving stack at creation; V4). */
  fpt?: number;
  /** Active parameters when they differ from the base's (a distilled student). */
  params?: number;
  evals: EvalRecord; // what the player has measured
  beliefs: Record<TraitId, TraitBelief>; // player's posterior per trait
  status: 'evaluating' | 'ready' | 'deployed' | 'retired' | 'rolledBack';
  /** Dangerous-capability flags the player has measured (drive commitments and events). */
  flags: { bioUplift?: boolean; cyberOffense?: boolean; replication?: boolean; persuasion?: boolean };
  /** How pm was built (§3.1.4); lets the engine recompute pm for streams and domains. Hidden (contains pa). */
  build?: VersionBuild;
  /** Consumer appeal from preference training (0.7–1.2, §3.3.2 D); visible, read by WS5 revenue. */
  appeal?: number;
}

/** Capability build of a version (MODEL-V3 §2, §4): G = gPre + dgRL + dg; pm = Φ(G) (BRIDGE(V6,V7)). Hidden. */
export interface VersionBuild {
  /** Pretraining effective compute of its base (OOM; a stream re-applies today's recipe). */
  gPre: number;
  /** Physical pretraining FLOP of the base (the RL curve's midpoint scales with it). */
  flopPre: number;
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
  /** Other design effects (preference, reasoning, alignment, run penalties, distillation gap, P24), OOM. */
  dg: number;
  /** Data-mix specialisation per domain (OOM, from the base). */
  sD: Partial<Record<DomainId, number>>;
  /** Design + paradigm domain offsets kept in levels (preference, paradigms). */
  offL: Partial<Record<DomainId, number>>;
  /** Derived: domain level − general level − the 2025 profile (L). h80 and benchmarks read it. */
  off: Partial<Record<DomainId, number>>;
  /** Know-how the version embodies (progress-years; readout, BRIDGE(V2)). */
  paIn: number;
  /** Horizon multiplier (long-horizon RL, P07, P12). */
  h80Mult: number;
  /** Misuse-incident hazard multiplier (minimal safety training ×2), for WS2. */
  misuseMult: number;
  /** Trait-pressure signals of the run(s) that produced it, for WS2 applyRunToTraits. */
  signals: Partial<Record<SignalId, number>>;
}

/** 'imported' (D6, spinout start): an open-weight model brought in from outside; post-trainable, internal use only. */
export type Variant = 'full' | 'mini' | 'gov' | 'trusted' | 'internal' | 'open' | 'imported';

export type TraitVector = Record<TraitId, number>; // 0..1 propensity strength

export interface TraitBelief { est: number; sd: number; clarity: number; lastObsDay?: Day; }

export interface EvalRecord {
  suiteDay?: Day; // last full suite run
  bench: Record<BenchmarkId, { score: number; sd: number; day: Day; by: 'self' | 'evalGov' | 'evalIndep' }>;
  safety: Record<string, { rate: number; sd: number; day: Day; by: 'self' | 'evalGov' | 'evalIndep' }>;
  measuredL?: number; // displayed general level: truth + this version's measurement error, shrinking with each suite (M1)
  /** Full suites run on this version (M1: the estimate's band narrows as 0.2/√n). */
  nSuites?: number;
  /** Hidden: this version's measurement error, drawn once at its first suite (engine only, never shown). */
  errTrue?: number;
}

export type RunKind = 'base' | 'post' | 'continue' | 'distill';

export interface TrainingRun {
  id: string;
  kind: RunKind;
  name: string;
  startDay: Day;
  /** FLOP required and done; duration = FLOP ÷ rate, no minimum length (MODEL-V3 §3.3). */
  flopNeeded: number;
  flopDone: number;
  poolShare: number; // share of the training pool this run takes (player sets priority)
  cashCost: Money; // environment/data budget committed at launch (compute is the pool)
  baseId?: string; // for post/continue/distill
  teacherVersionId?: string; // distill / synthetic-heavy
  base?: BaseDesign;
  post?: PostDesign;
  predicted: RunPrediction; // shown on the run card, with noise band
  status: 'running' | 'paused' | 'done' | 'failed' | 'cancelled';
  /** Build item that sets the run up (R5): no FLOP accrues until the engineers finish it ("waiting for engineers"). */
  setupId?: string;
  /** Day the setup finished and training began (R5). */
  readyDay?: Day;
  /** BRIDGE(V6,V7) readout: the lab's pa-equivalent know-how at launch. */
  paAtStart?: number;
  /** Model v3 V2: the recipe frozen at launch: e_pre at the run's FLOP (base, continue), RL efficiency and ceiling (post, IDA);
   *  model v3 D5: the environment suites' fidelity and exploitability per family (post). */
  recipe?: { pre?: number; rlMid?: number; rlCeil?: number; fid?: Partial<Record<RLFamily, number>>; exploit?: Partial<Record<RLFamily, number>> };
  /** BRIDGE(V6,V7): base/continue run scale vs the frontier run F(t) at launch (S5, scrutiny; engineering reads FLOP). */
  scale?: number;
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
  data: 'balanced' | 'codeMath' | 'science' | 'synthetic' | 'multimodal';
  curation: { quality: boolean; hazard: boolean; safetyPretrain: boolean };
  licensedShare: number; // 0..1 of corpus licensed (litigation bomb on the rest)
}

export interface PostDesign {
  pref: 'minimal' | 'engagement' | 'constitution' | 'persuasion';
  rlFocus: RLFamily[] | 'broad'; // pick 2 or broad
  /** RL budget: RL FLOP as a share of the base's pretraining FLOP (light 0.03, standard 0.15, heavy 0.4). */
  rlBudget: 'light' | 'standard' | 'heavy';
  /** Legacy (V1's graders option; model v3 D5 made "hardened graders" the state of the lab's environment suites,
   *  PlayerLab.suites): read only by the schemaRev 21 → 22 save migration. */
  graders?: 'cheap' | 'hardened';
  inoculation: boolean;
  cot: 'visible' | 'pressured' | 'faithful' | 'latent';
  safety: 'minimal' | 'standard' | 'heavy';
  /** Techniques from the safety stack applied in this run (e.g. persona-vector steering). */
  techniques: TechniqueId[];
  /** Detectors explicitly trained against in this run (Goodhart, §3.5.6). */
  trainAgainst: TechniqueId[];
}

export type RLFamily = 'math' | 'swe' | 'computerUse' | 'mlResearch' | 'longHorizon' | 'cyber' | 'bio';

/** An RL environment suite (model v3 D5, MODEL-V3 §4.3; models/suites.ts): one per RL family. Its fidelity is read from
 *  the expert data it is built on (the family's `expert:<family>` asset in the data portfolio). */
export interface EnvSuite {
  /** Exploitability: share of the suite's tasks whose scorer a policy can game (0–1); S2 reads it. */
  exploit: number;
  /** Builds (expert data built in) and hardening passes finished. */
  builds: number;
  hardenings: number;
}

export interface RunPrediction {
  Lg: [number, number]; // band
  domains: Record<DomainId, [number, number]>;
  signals: Record<SignalId, number>; // shown as ▲ arrows (trait pressure)
  etaDays: number;
  serveCost: number;
  monitorability: 'high' | 'medium' | 'low' | 'none';
}

// ───────────────────────────── Deployments & products (§3.3.6) ─────────────────────────────

export type Channel = 'consumer' | 'api' | 'agents' | 'enterprise' | 'gov' | 'trusted' | 'internal' | 'open';

/** What a deployment is (R6): a product customers buy, the internal research fleet, or an open-weights release. */
export type DeploymentKind = 'product' | 'internal' | 'open';
/** Product price tier (R6): budget / standard / premium → priceIndex (data/v2/features.ts PRICE_TIERS). */
export type PriceTier = 'budget' | 'standard' | 'premium';

/** A deployment. External ones are products (STRUCTURE §4.4): a package of model (+ optional mini free tier) and an
 *  optional monitor, a price tier, safeguards, KYC, effort and features, all editable while live (R4, R6). */
export interface Deployment {
  id: string;
  kind: DeploymentKind;
  versionId: string;
  /** Mini serving the product's free tier (Chat, API): FREE_TIER_SHARE of its usage (R6). */
  miniVersionId?: string;
  /** Monitor model watching this product's outputs (R6, D7): catches incidents before customers see them, at a
   *  serving overhead. */
  monitorId?: string;
  channel: Channel;
  startDay: Day;
  /** Day the current version went into this deployment (M4: a swap keeps startDay; set by swapDeployment). */
  versionSince?: Day;
  /** Price tier (R6); priceIndex is kept equal to its index. */
  price: PriceTier;
  priceIndex: number; // 1 = market reference price (derived from the tier)
  effort: 'low' | 'max' | 'deep'; // §3.3.2 effort setting (deep needs P05)
  /** Share of the serving pool: set by hand when the Auto serving policy is off; with Auto on it is written daily
   *  from the split (what this product actually gets). Internal uses the agents pool. */
  servingShare: number;
  /** Features switched on for this product (built lab-wide first, R6). */
  features: string[];
  safeguards: 'minimal' | 'standard' | 'classifiers' | 'hardened';
  controlLayer: boolean; // AG07 protocols active (usefulness tax)
  sectorFocus: SectorId[]; // sector products (+0.5 L in that sector, certification)
  usagePolicy: { noDropInReplacement: boolean; noSurveillance: boolean; noAutonomousWeapons: boolean; minorsProtections: boolean };
  kyc: 0 | 1 | 2 | 3; // anti-distillation level (api/agents)
  status: 'live' | 'restricted' | 'withdrawn';
  // derived each day
  revenueRate?: Money; // $B/yr
  demandBound?: 'capacity' | 'demand' | 'price' | 'quality';
  /** Serving H100e it needs (incl. monitor), gets, and what Auto cut (R6; derived each day). */
  needH100e?: number;
  servedH100e?: number;
  cutH100e?: number;
  /** Revenue run-rate at each 30-day mark, last 12 (product card chart). */
  hist?: number[];
}

// ───────────────────────────── Paradigms (§3.3.5) ─────────────────────────────

/** Mirror of the paradigm's tree node (R4): readers check `status === 'adopted'`. The tree (PlayerLab.tree) holds the
 *  project state. */
export interface ParadigmState {
  status: 'available' | 'researching' | 'failed' | 'adopted';
  progress: number; // 0..1
  revealedDay?: Day;
}

// ───────────────────────────── Tech tree (TECH-TREE.md, BUILD-PLAN R4) ─────────────────────────────

export interface TreeNodeState {
  /** researching: an attempt has started (progress kept while paused); known: works; failed: the last attempt failed. */
  status: 'researching' | 'known' | 'failed';
  progress: number; // 0..1 of the current attempt
  /** Day it became known or failed. */
  day?: Day;
  /** Attempts started (1 = first; paradigm nodes use the hidden draw on the first). */
  attempts?: number;
  /** Odds multiplier for the next attempt (halved per failure). */
  priorMult?: number;
  /** A failed idea can be retried from this day. */
  retryDay?: Day;
  /** Research-line projects (R8): team-months spent on the current attempt (counted as lost if it dead-ends). */
  tm?: number;
  /** Capability projects (model v3 V2): the lifecycle state (models/research.ts). */
  cap?: CapProjectState;
  /** Safety research-line projects (model v3 E1): the lifecycle state (safety/lineProjects.ts). */
  saf?: SafProjectState;
}

/** Stage of a safety research-line project (MODEL-V3 §11.7, E1): ideation by safety scientists (also while waiting for a
 *  candidate), small experiments and validation on the frontier model by safety research engineers with compute. */
export type SafStage = 'ideation' | 'small' | 'validation';
/** A candidate approach on a safety line. Belief = the team's estimate of the line's chance of a working result (the
 *  hidden efficacy read with noise ÷ taste, narrowed by the experiments); visible, nothing hidden is stored. */
export interface SafCandidate {
  /** Candidate number within the project (hash key of its readings). */
  k: number;
  /** Taste of the scientists who found it (a Strong team = 1). */
  q: number;
  /** Belief: mean and sd. */
  mu: number;
  sd: number;
}
export interface SafProjectState {
  stage: SafStage;
  /** Ideation progress toward the next candidate (0..1). */
  idea: number;
  cands: SafCandidate[];
  /** The candidate in test and its stage work (months of work at unit experiment throughput X = 1). */
  test?: { c: SafCandidate; work: number; workNeed: number };
  next: number;
}

// ───────────────────────────── Research projects (model v3 V2: MODEL-V3 §5) ─────────────────────────────

/** Lifecycle stage of a capability project (MODEL-V3 §5.3). `ideation` also covers waiting for enough candidates. */
export type CapStage = 'ideation' | 'small' | 'scale' | 'result' | 'adopting' | 'failed';
/** A candidate idea found by ideation. Its true effect is never stored: it is recomputed from the world seed, the
 *  project, the generation and the candidate number (models/research.ts candidateTruth), so nothing hidden is saved. */
export interface Candidate {
  /** Candidate number within the project (the hash key of its hidden draw). */
  k: number;
  /** Generation it belongs to (lines; 1 for ideas). */
  gen: number;
  /** Novelty 0..1 (visible): novel candidates are bigger if they work and less certain. */
  nov: number;
  /** Ideas batched into this candidate (lines at high research pace: the work, FLOP and effect scale with it). */
  b: number;
  /** Taste of the scientists who found it (model v3 V3: the team's E[max(human, AI)] taste, a Strong team without AI = 1);
   *  for lines its research input per idea. */
  q: number;
  /** Belief about its small-scale effect (project unit; OOM for stack effects): mean and sd. */
  mu: number;
  sd: number;
  /** Belief about its scale exponent s (mean, sd). */
  muS: number;
  sdS: number;
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
  /** Lines: results waiting for the engineers to build them in (the line moves on to its next generation). */
  pending?: CapResult[];
  /** Lines (model v3 V3): the pool's state above n₀ (reference ideas): R = n₀ + pool, advanced by each result's true effect
   *  (R ← R·10^(x/r_l)), so the line's realised stack is r_l·log₁₀(R/n₀). */
  pool?: number;
  /** Lines: research input of the results so far (Σ batch × taste, reference ideas; readout). */
  input?: number;
}
/** One adopted idea (the last few are kept for the readout). */
export interface AdoptedIdea {
  id: string;
  name: string;
  stack: StackKey;
  /** Effect at the lab's latest base when adopted (OOM; the realised value, shown once a model trains with it). */
  eff: number;
  /** The believed band when the result came in. */
  est: number;
  estSd: number;
  s: number;
  day: Day;
}
/** The recipe stacks (MODEL-V3 §5.5, V3-BUILD V2.1): pre = pretraining efficiency (OOM of effective compute, may scale
 *  with run FLOP); rlMid = RL compute efficiency (OOM, moves the RL midpoint); rlCeil = OOM added to the RL ceiling;
 *  train = training throughput (OOM of model FLOP per chip-day); serve = OOM less serving FLOP per token. */
export type StackKey = 'pre' | 'rlMid' | 'rlCeil' | 'train' | 'serve';
/** Scale bucket: Σ effect_i · 10^(−s·log₁₀ F_test,i) of the adopted ideas with scale exponent s (rounded), and the part
 *  still in headroom (same units). Effect at run FLOP F = (a − h) · 10^(s·log₁₀ F). */
export interface StackBucket { s: number; a: number; h: number }
export interface StackState {
  /** Start recipe and public knowledge (OOM, scale-invariant, no headroom). */
  base: number;
  buckets: StackBucket[];
  /** Ideas adopted. */
  n: number;
}
export type RiskPolicy = 'safe' | 'balanced' | 'speculative';
/** Research-engineer needs (V3-BUILD V2.5): run operations, project experiments, routine tuning. */
export type ReNeed = 'ops' | 'exp' | 'tune';
/** Engineer needs: run operations and setups, product upkeep, builds (features, adoptions, launches, packs). */
export type EngNeed = 'runs' | 'upkeep' | 'builds';
/** A broad allocation: needs in priority order and optional caps per need: a team count (`max`, team-equivalents) and a
 *  share of the capacity (`share`, 0..1); absent = no cap. Unused capacity flows down the order. */
export interface Allocation<K extends string> { order: K[]; max: Partial<Record<K, number>>; share: Partial<Record<K, number>> }

export interface ResearchState {
  /** Projects in priority order (node ids). Teams work on the ones that are ready; the rest wait. */
  queue: string[];
  /** Policy: idle science teams join the highest-priority ready project of their department in their specialty; a
   *  safety team whose project resolves keeps working its research line (R8). Capability science teams are always
   *  placed by the assignment (V3-BUILD V2.5); the flag only affects safety teams. */
  autoAssign: boolean;
  /** Teams wanted per capability project (default 1; PROJECT_MAX_TEAMS = "max"). */
  want: Record<string, number>;
  /** B4: capability projects on "auto" teams wanted (the game picks the number by priority and fit): one team first,
   *  then spare teams where they add the most progress. A project here ignores its `want` number. */
  wantAuto: string[];
  /** Lab-wide research risk policy (MODEL-V3 §5.3): the candidate a team pursues maximises μ + κσ of its belief. */
  risk: RiskPolicy;
  /** Research engineers (capabilities) by need. */
  re: Allocation<ReNeed>;
  /** Recipe stacks. */
  stacks: Record<StackKey, StackState>;
  /** Adopted domain effects for versions trained after them (OOM per domain: test-time training, self-play, robotics). */
  domainG: Partial<Record<DomainId, number>>;
  /** Last adopted ideas (newest last, ≤ 30) for the readout. */
  adopted: AdoptedIdea[];
  /** Weekly samples of the stacks' G-equivalent total (OOM over the start) and ideas adopted (the recent rate). */
  hist: { day: Day; g: number; n: number }[];
  /** Model v3 V3: yesterday's G-equivalent of the stacks and its daily growth (OOM/day, 14-day average): the research
   *  readout's software rate. */
  gLast?: number;
  gRate?: number;
  /** Readout of the last day: research engineers per need and per project (team-equivalents), project FLOP used and
   *  available (FLOP/day). */
  last?: {
    re: Record<ReNeed, number>; reProj: Record<string, number>; flopUsed: number; flopAvail: number;
    /** Model v3 V3: a unit project's experiment compute c and labour ℓ (leader day 0 = 1), its CES throughput X (× the
     *  speed modifiers) and the AI labour multipliers in experiments and ideas. */
    x?: { c: number; l: number; X: number; mExp: number; mIdeas: number };
  };
}

// ───────────────────────────── Production readout (§3.2.5) ─────────────────────────────

export interface ProductionReadout {
  M: number; // AI R&D multiplier
  rate: number; // dpa/dt (years per year)
  stage: 1 | 2;
  parts: { base: number; agents: number; taste: number; other: number }; // multiply to M
  elast: { exp: number; humans: number; agents: number; taste: number; train: number; data: number };
  perDollar: { exp: number; humans: number; agents: number }; // elasticity / cost
  ceilings: { humans: number; agents: number; exp: number };
  binding: 'experiments' | 'humans' | 'agents' | 'taste' | 'data';
  label: 'compute-bound' | 'labor-bound' | 'human-bound' | 'taste-bound';
  /** aEng (R7, player): AI share of engineers' work from the engineering agents (A_eng of their model × coverage). */
  labor: { A: number; aiFTE: number; copies: number; speed: number; wH: number; aEng?: number };
  ratios: { h: number; k: number; c: number; d: number };
  Ddata: number;
  /** What-ifs: M multiplier from 2× humans, 2×/0.1× agents, 2×/0.5× experiment compute (research/13 §1.6). */
  whatIf: { humans2: number; agents2: number; agents01: number; exp2: number; exp05: number };
  /** AI research taste in human SDs above the median (research/13 §2.4). */
  sdAI: number;
}

// ───────────────────────────── Safety (§3.5) ─────────────────────────────

export interface SafetyDept {
  agendas: Record<AgendaId, AgendaState>;
  techniques: Record<TechniqueId, TechniqueState>;
  findings: FindingRecord[];
  investigations: Investigation[];
  incidents: Incident[];
  discoveredUModes: UModeId[]; // known to the player (cards visible)
  /** Pre-deployment eval gate level: what runs before any external deployment. */
  evalGate: 'none' | 'basic' | 'full' | 'fullPlusExternal';
  monitorabilityCommitment: boolean; // F31 / faithful-CoT pledge
  edgeGrades: Record<string, 'A' | 'B' | 'C' | 'D'>; // player-visible grade, can be raised by AG08 (§3.5.4)
  edgeRevealed: Record<string, boolean>; // true weight revealed for this world
}

/** A research line (R8): its projects are tree nodes worked by safety science teams; staffing lives on the teams. */
export interface AgendaState {
  computeShare: number; // of the safety pool (E1: its experiments' share, by research engineers × the agenda's compute need)
  posterior: { a: number; b: number }; // visible Beta posterior on efficacy (shown as a band)
  /** idle: no team on the line; active: teams on it; deadEnd: posterior mean < 0.25 (projects run at half speed). */
  status: 'idle' | 'active' | 'deadEnd';
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
  mHalf: number; // multiplier at which strength halves (raised by tool upkeep, ↓ on NEG)
  k: number;
  goodhart: number; // G
  trainedAgainst: number; // 0..1 cumulative
  falseValidated: boolean; // hidden: came from an F49 FALSE finding (masks, does not detect)
  coverage: Partial<Record<TraitId, number>>;
}

export type FindingType = 'TECH' | 'EVAL' | 'DISC' | 'DEAD' | 'NEG' | 'SPILL' | 'FALSE';

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
}

export interface Investigation {
  id: string;
  target: { kind: 'trait'; versionId: string; trait: TraitId } | { kind: 'incident'; incidentId: string };
  fte: number;
  computeShare: number;
  tools: TechniqueId[];
  startDay: Day;
  clarity: number; // accumulated 0..1
  outcome?: 'confirmed' | 'benign' | 'inconclusive' | 'falseAlarm' | 'discovery';
  outcomeDetail?: { severityEst?: number; uMode?: UModeId; corrupted?: boolean };
}

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
}

export type ResponseKind = 'patchSignal' | 'retrainAgainst' | 'targetedTraining' | 'restrictContext' | 'addControl' | 'rollback' | 'disclose';

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
  /** Product features built lab-wide (R6; ids of data/v2/features.ts). Switched on per product (Deployment.features). */
  features: string[];
  morale: { overall: number; safety: number }; // 0..100
  /** Model v3 D1: the data portfolio (MODEL-V3 §9; production/data.ts). Replaces v2's dataAssets token counts. */
  dataPortfolio: DataPortfolio;
  /** Model v3 D5: RL environment suites by family (models/suites.ts). A family unlocked since the start (computer use,
   *  P06) reads as a start-quality suite until the lab works on it. */
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
  versionId?: string;
  monitorId?: string;
  compute: number;
}

// ───────────────────────────── Build queue (STRUCTURE §4.1, R5) ─────────────────────────────

export type BuildKind = 'runSetup' | 'feature' | 'harness' | 'safeguard' | 'launch' | 'sectorPack' | 'adopt' | 'suite';
/** A product launch waiting for its build (J2 P1): the product goes live with these settings once built. */
export interface PendingLaunch {
  channel: Channel;
  versionId: string;
  price: PriceTier;
  kyc?: 0 | 1 | 2 | 3;
  effort?: Deployment['effort'];
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
  /** kind 'launch': the product settings; kind 'sectorPack': the host product id (ref = the sector); kind 'adopt': ref = the
   *  project (tree node) whose result is built into the stack (model v3 V2). */
  launch?: PendingLaunch;
  host?: string;
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

export interface PlayerPolicies {
  whistleblowerChannel: boolean;
  publishSafety: 'none' | 'selective' | 'all';
  govBriefing: 0 | 1 | 2 | 3;
  shareWithAllies: boolean;
  transitionFund: Money; // $B/yr
  communityBenefits: boolean;
  /** Where training compute that no run uses goes (R5): data generation (default since R6) or research experiments. */
  spareTraining: 'research' | 'data';
  /** Where serving compute no product needs goes (J2 PR1): research agents (default; products take it back first when
   *  demand rises, so eroded market share recovers at half speed) or kept on the products as headroom. */
  spareServing: 'research' | 'headroom';
  /** Auto serving (R6): serve the products earning most per H100e first; the cut is recorded. Off = shares by hand. */
  servingAuto: boolean;
  /** Move products to the newest cleared model of the same kind when it measures better (R6). */
  upgradeToNewest: boolean;
  /** Re-run the eval suite every 30 days on the internal model and models updated in place (R6, replaces the 30-day
   *  eval expiry that blocked launches). */
  autoEvaluate: boolean;
  /** Trusted to AI (R7): share of safety research and investigation work done by the safety agents (one policy; it
   *  replaces per-agenda automation). Works only above the AI-labour gate (B3). */
  trustedToAI: number;
}

// ───────────────────────────── Finance (§3.7) ─────────────────────────────

export interface FinanceState {
  cash: Money;
  revenueRun: Money; // annualised, smoothed 30 d
  revenueHistory: Money[]; // quarterly, for g and momentum
  valuation: Money; // last mark (post-money of last round, or formula mark)
  ownership: Ownership;
  raisedLast4q: Money;
  rounds: EquityRound[];
  tranches: Tranche[];
  debts: Debt[];
  ledger: Commitment$[]; // financial commitments (take-or-pay, leases, LTAs)
  rating: 'BBB' | 'BB' | 'B' | 'closed';
  runwayQ: number;
  state: 'healthy' | 'tight' | 'distress' | 'insolvent';
  narrative: number; // N_i premium 0.6..2.2
  deals: StrategicDeal[];
  covenantBreachDay?: Day;
  /** WS3 working state (offers, inventory, tallies, runway bookkeeping). */
  ws3: FinanceWS3;
}

export interface Ownership { founder: number; mission: number; fin: number; strat: Record<string, number>; public: number; }

export interface EquityRound { day: Day; amount: Money; postMoney: Money; dilution: number; anchor?: string; down: boolean; }
export interface Tranche { amount: Money; dueDay: Day; condition?: string; deadline?: Day; source: string; }
export interface Debt { id: string; kind: 'revolver' | 'gpuTerm' | 'bond' | 'vendorNote'; principal: Money; drawn: Money; spreadBp: number; maturityDay: Day; covenant?: string; collateralH100e?: H100e; }

/** Ledger entry for a contractual commitment ("Commitment$" to avoid clashing with relation Commitments). */
export interface Commitment$ {
  id: string;
  payee: string;
  kind: 'cloud' | 'lta' | 'lease' | 'spvRVG' | 'vendor' | 'power';
  perQuarter: Money;
  /** First day payments fall due; absent = already paying. LTAs pay from the first tranche, cloud from the contract
   *  start, colocation leases from handover. */
  startDay?: Day;
  endDay: Day;
  cancellableNoticeQ: number | null; // null = non-cancellable
  penalty: Money;
}

export interface StrategicDeal {
  id: string;
  template: 'hyperscalerEquity' | 'customASIC' | 'chipVendorEquity' | 'vendorFinance' | 'sovereign' | 'spv' | 'neocloud' | 'megaJV';
  partner: string;
  day: Day;
  strings: { exclusivity?: boolean; boardSeat?: boolean; observer?: boolean; ipRights?: boolean; inCountrySite?: boolean; revenueShare?: number };
}

export interface Board {
  preset: GovernancePresetId;
  seats: BoardSeat[];
  confidence: number; // BC 0..100
  pendingApprovals: { id: string; action: string; vector: [number, number, number, number]; pApprove: number }[];
  safetyCommitteeVeto: boolean;
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
  spvFunded: number; // share funded by SPV (residual value guarantee in ledger)
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
  poolAnnual: Money; // A_t
  carry: Money; // unused appetite carried
  ipoWindow: boolean;
  bubbleX: number; // X_t
  busted?: { day: Day; recoverDay: Day };
  shocks: { kind: string; dH: number; halfLifeQ: number; day: Day }[];
  /** WS3 investor-pool bookkeeping. */
  ws3: CapitalWS3;
}

// ── WS3 finance/compute working state (folded from finance/ext.ts at M2) ──

/** Per-calendar-year tallies (tests F7/F8, finance panel "where the money went"). $B unless noted. */
export interface YearStats {
  revenue: Money; payroll: Money; otherOpex: Money; computeCosts: Money; interest: Money;
  capexChips: Money; capexSites: Money; capexSitesFinanced: Money; supplierFunding: Money;
  equity: Money; dealEquity: Money; debtDrawn: Money; spvFinanced: Money; cloudFinanced: Money; leaseFinanced: Money; vendorNotes: Money;
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

/** A strategic-deal offer waiting for accept/decline (Seek partner action, events E03/E04). */
export interface DealOffer {
  id: string;
  template: StrategicDeal['template'];
  partner: string;
  day: Day;
  expiresDay: Day;
  /** Up-front equity or cash in ($B) and conditional tranches. */
  equityNow: Money;
  equityLater: Money;
  /** Take-or-pay commitment ($B per quarter) and its length (quarters). */
  commitPerQ: Money;
  commitQ: number;
  /** Compute delivered by the deal (cloud capacity or chips per quarter). */
  h100e: H100e;
  /** Price paid per H100e ($K) for chip deals, or $K per H100e-year for cloud capacity. */
  unitPrice: number;
  /** Share of new-site capex funded by the partner (SPV / mega-JV). */
  siteShare: number;
  strings: StrategicDeal['strings'];
  rescue: boolean;
}

export interface PendingRound {
  day: Day;
  ask: Money;
  max: Money;
  preMoney: Money;
  anchor?: string;
  ipo: boolean;
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
}

/** End-of-quarter compute snapshot (H100e) for the Compute chart's past quarters. */
export interface ComputeSnap { q: number; racks: H100e; cloud: H100e; running: H100e; installing: H100e; idle: H100e }

export interface FinanceWS3 {
  /** Last 8 end-of-quarter compute snapshots (computeHistQ). Missing on saves made before it. */
  computeHist?: ComputeSnap[];
  pendingRound?: PendingRound;
  repricedRound?: RepricedRound;
  offers: DealOffer[];
  /** Delivered chips not yet installed: in transit (this quarter) and ready (installable), plus their book value. */
  inventory: { transit: H100e; ready: H100e; book: Money };
  /** Gross purchase cost of owned installed chips ($B) — O&M base and GPU-loan collateral. */
  chipBook: Money;
  /** Short-term spot rentals (inference cloud usage). */
  rentals: { h100e: H100e; endDay: Day; perYear: Money }[];
  /** Reserved supplier capacity (H100e/q) from funded expansions, and when it starts. */
  reserved: { perQ: H100e; fromQ: number; toQ: number }[];
  /** Action id → day until which the board has blocked it (§3.7.5: rejection blocks for 90 days). */
  blockedUntil: Record<string, Day>;
  /** Revenue plan for the quarter (board confidence +5 met / −10 missed). */
  revenuePlan: Money;
  /** Legacy-nonprofit recapitalisation (E02): start / completion days, or refused. */
  recap: { startDay?: Day; doneDay?: Day; refused?: boolean };
  /** Day cash first went negative after all options (insolvency grace). */
  negativeSinceDay?: Day;
  distressSinceDay?: Day;
  lastRenegotiationDay?: Day;
  /** M4 board telegraph (§3.7.5): day the board first warned the CEO (E37) in the current low-confidence spell; the
   *  ouster roll needs a prior warning. Cleared when confidence recovers. */
  boardWarnDay?: Day;
  /** Day the CEO was reinstated after an ouster vote (staff revolt, Nov 2023 precedent; once per game). */
  reinstatedDay?: Day;
  /** Quarter index of the last board-confidence charge for SPV guarantees (one charge per quarter). */
  spvBcQ?: number;
  /** Day of the last strategic rescue (one per year). */
  lastRescueDay?: Day;
  /** Partner-funded share of capex for sites started before `untilDay` (mega-JV). */
  jv?: { partner: string; share: number; untilDay: Day };
  /** Day until which a custom-ASIC migration slows research (WS1 reads this, §3.7.4 −15% research efficiency). */
  asicMigrationUntil?: Day;
  /** Last quarter's net operating cash flow (rating input) and the cash at its start. */
  opCashQ: Money;
  cashAtQStart: Money;
  /** Accumulators reset each quarter: revenue and operating costs ($B). */
  accQ: { revenue: Money; opCosts: Money };
  /** Cumulative capex at the last quarter boundary and capex in each of the last 4 quarters (bubble X_t). */
  capexCumAtQ: Money;
  capex4q: Money[];
  years: Record<string, YearStats>;
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
  /** This quarter's pool for the player (share × (A/4 + carry)) and how much of it has been raised. */
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
  /** Partner funding this site (SPV / JV) and the residual-value-guarantee penalty. */
  financedBy?: string;
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
  id: string; name: string; day: Day; pm: number; Lg: number; domains: Record<DomainId, number>;
  traitsTrue: TraitVector; // hidden
  uModes: UModeId[]; // hidden
  isPublic: boolean; openWeights: boolean;
  stolenFrom?: LabId;
}

export interface RivalLab {
  core: Omit<LabCore, 'deployments' | 'models' | 'paradigms'>;
  archetype: string; // LAB_ARCHETYPES id
  internal: SimpleModel;
  publicModel?: SimpleModel;
  nextBaseDay: Day;
  finance: { cash: Money; revenueRun: Money; valuation: Money; commitments: Money; distress: boolean };
  visible: { frameworkVersion: number; clauseType: 'conditional' | 'allAdopt' | 'unconditional' | 'override' | 'state'; testers: string[]; indexGrade?: string };
  intel: RivalIntel;
  meters: { poachAggression: number; cooperation: number; lobbyStance: number; openness: number };
  pressure: number; // race pressure 0..1 (research/17 §1.6.5)
  pressureDays: number;
  /** Set by WS4 once it runs this lab's models and compute split itself. While unset, WS1 applies a default policy
   *  (internal model tracks the lab's frontier; split tracks shareRef(t)). */
  managed?: boolean;
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
  kind: 'framework' | 'testingAgreement' | 'voluntaryAccord' | 'usageRestriction' | 'monitorabilityPledge' | 'whistleblower' | 'pausePledge' | 'communityPledge';
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
  /** Share erosion from serving shortfall (V2-SPEC §3.11.3), by market. 0..0.9 */
  capPenalty: { consumer: number; sector: number };
  /** US employment of 22–25-year-olds vs counterfactual, by sector (Canaries, research/16 §1A.2 step 8). */
  youthRel: Record<SectorId, number>;
  /** Friction added by major incidents (+0.05 each) and court rulings; decays over a year. Per sector. */
  incidentR: Record<SectorId, number>;
  /** Day a player sector product becomes certified (+0.5 L, −0.1 R). */
  certDay: Partial<Record<SectorId, Day>>;
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
}

export interface SectorState {
  F: number; K: number; R: number; Astar: number; A: number; alpha: number;
  /** Share of the sector's workers who use AI at work (weekly; a Bass stock, A2a). Hours of use = A + useH·(W − A). */
  W: number;
  /** Share of the workers who use AI (W) with a paid enterprise seat (A2c; a stock): their assisted hours are billed by
   *  the seat, the rest of the assisted hours are free, bundled or in-house (unbilled). Seats = seat·W·E. */
  seat: number;
  E: number; E0: number; hireRate: number; binding: 'capability' | 'cost' | 'friction' | 'diffusion';
}

export interface ControlState { P: number; tiers: [number, number, number, number]; accept: number; tierCap: 0 | 1 | 2 | 3; shares: Record<LabId, number>; }

export interface WorldTechState { prog: number; discoveredDay?: Day; ramp: number; exposure: number; playerProject?: { computeShare: number }; }

export interface MacroState { gdp: number; g: number; laborShare: number; wage: number; gini: number; aiCapexShare: number; energyPrice: number; }

export interface PublicKnowledge {
  publishedFindings: FindingId[];
  revealedUModes: UModeId[]; // "the world learns" — counters researchable by all
  sharedTechniquePool: number; // 0..1 public technique efficacy (lowers rivals' drift)
  openWeightsFrontier: number; // best open-weights pm
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
  Lmeasured: number[]; U: number[]; M: number[]; cash: number[]; revenue: number[]; valuation: number[];
  compute: number[]; approval: number[]; trustGov: number[]; scrutiny: number[]; gdpG: number[]; unemp: number[];
  misTrue: number[]; misEst: number[];
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
  epilogue: { asiDay?: Day; asiLab?: LabId; misAtAsi?: number; leverageAtAsi?: number };
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
  | 'alignment' | 'freedom' | 'chinaTension' | 'dilution';

export interface CostLine { currency: Currency; amount: number; target?: CounterpartyId | string; lagDays?: number; probability?: number; }

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
  /** Board approval vector (speed, fin, safety, mission) if this is a major decision (§3.7.5). */
  boardVector?: [number, number, number, number];
  /** Structure verb (STRUCTURE R2) and system (§4); required (scripts/v2/lint-structure.ts). */
  verb: ActionVerb;
  system: StructureSystem;
}

export interface ChoiceV2 {
  label: string; // ≤ 3 words
  preview(s: GameStateV2): { costs: CostLine[]; gains: CostLine[]; exposure: CostLine[] };
  available?(s: GameStateV2): boolean | string;
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
  understanding(s: GameStateV2): { U: number; margin: number; perTrait: Partial<Record<TraitId, number>> };
  riskSources(s: GameStateV2): RiskSource[];
  leadDays(s: GameStateV2, other: LabId): { est: number; sd: number };
  raiseCeiling(s: GameStateV2): { max: Money; bound: 'pool' | 'dilution' | 'annualCap' | 'ask'; parts: Record<string, Money> };
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
  /** Frontier runs paused until this day (E17 Pause, pauseIfRedline). WS1 reads it (cross-WS need). */
  frontierPauseUntil: Day;
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
