// AI27 v2 — state and interface contract. Companion to design/V2-SPEC.md (section refs "§x.y" point there).
// Design file only: not compiled into src/ yet. WS1 copies it to src/engine/v2/types.ts on day 1 and owns it;
// other workstreams change it only through WS1 (one PR, one owner) to keep the contract stable.
//
// Rules:
//  - Everything under GameStateV2 is plain JSON (saves = JSON.stringify). No classes, Maps, Sets, functions.
//  - `hidden` and every field documented "hidden" is TRUTH. UI code must not read it except on the end screen;
//    enforced by a lint rule (no import of `selectHidden*` outside src/ui/v2/end/) and by uitest DOM scans.
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
export type GovernancePresetId = 'legacyNonprofit' | 'nonprofitPBC' | 'pbcTrust' | 'founder';

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
  | 'actors' | 'rivals' | 'china' | 'worldfx' | 'events' | 'endings';

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
}

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
  /** Production-function parameters (research/13 §1.4). */
  prod: ProdParams;
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

export interface StaffByRole { cap: number; saf: number; sec: number; prod: number; ops: number; }

/** Compute pools a lab splits its online compute into (§3.4.2). Fractions sum to 1. */
export interface ComputeSplit {
  training: number; experiments: number; agents: number; synthetic: number;
  serving: number; safety: number; security: number;
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
}

export type MilestoneIdx = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface ModelsState {
  bases: BaseModel[];
  versions: ModelVersion[];
  runs: TrainingRun[];
  /** Version powering internal research agents (p_dep for the production function). */
  internalAgent?: string;
  /** Continual-learning stream (P08) if active: the version id being updated in place. */
  stream?: { versionId: string; startedDay: Day; lastAuditDay: Day };
  nextName: number; // naming counter
}

export interface BaseModel {
  id: string;
  name: string; // e.g. "Atlas-3"
  day: Day; // completion
  flop: number;
  paAtStart: number;
  pc: number; // compute component (years) frozen at base start (§3.1.3)
  design: BaseDesign;
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
  serveCost: number; // relative cost per work-hour, visible
  evals: EvalRecord; // what the player has measured
  beliefs: Record<TraitId, TraitBelief>; // player's posterior per trait
  status: 'evaluating' | 'ready' | 'deployed' | 'retired' | 'rolledBack';
  /** Dangerous-capability flags the player has measured (drive commitments and events). */
  flags: { bioUplift?: boolean; cyberOffense?: boolean; replication?: boolean; persuasion?: boolean };
}

export type Variant = 'full' | 'mini' | 'gov' | 'trusted' | 'internal' | 'open';

export type TraitVector = Record<TraitId, number>; // 0..1 propensity strength

export interface TraitBelief { est: number; sd: number; clarity: number; lastObsDay?: Day; }

export interface EvalRecord {
  suiteDay?: Day; // last full suite run
  bench: Record<BenchmarkId, { score: number; sd: number; day: Day; by: 'self' | 'evalGov' | 'evalIndep' }>;
  safety: Record<string, { rate: number; sd: number; day: Day; by: 'self' | 'evalGov' | 'evalIndep' }>;
  measuredL?: number; // displayed general level (noisy, sandbagging-biased)
}

export type RunKind = 'base' | 'post' | 'continue' | 'distill';

export interface TrainingRun {
  id: string;
  kind: RunKind;
  name: string;
  startDay: Day;
  /** FLOP required and done; duration emerges from the training pool share (§3.3.3). */
  flopNeeded: number;
  flopDone: number;
  minDays: number;
  poolShare: number; // share of the training pool this run takes (player sets priority)
  cashCost: Money; // environment/data budget committed at launch (compute is the pool)
  baseId?: string; // for post/continue/distill
  teacherVersionId?: string; // distill / synthetic-heavy
  base?: BaseDesign;
  post?: PostDesign;
  predicted: RunPrediction; // shown on the run card, with noise band
  status: 'running' | 'paused' | 'done' | 'failed' | 'cancelled';
  restarts: number; // loss-spike restarts (stretch/MoE risk)
}

export interface BaseDesign {
  scale: 'compact' | 'frontier' | 'stretch' | 'continue';
  shape: 'dense' | 'overtrained' | 'moe' | 'latent';
  data: 'balanced' | 'codeMath' | 'science' | 'synthetic' | 'multimodal';
  curation: { quality: boolean; hazard: boolean; safetyPretrain: boolean };
  licensedShare: number; // 0..1 of corpus licensed (litigation bomb on the rest)
}

export interface PostDesign {
  pref: 'minimal' | 'engagement' | 'constitution' | 'persuasion';
  rlFocus: RLFamily[] | 'broad'; // pick 2 or broad
  rlIntensity: 'light' | 'heavyCheap' | 'heavyHardened';
  inoculation: boolean;
  cot: 'visible' | 'pressured' | 'faithful' | 'latent';
  safety: 'minimal' | 'standard' | 'heavy';
  /** Techniques from the safety stack applied in this run (e.g. persona-vector steering). */
  techniques: TechniqueId[];
  /** Detectors explicitly trained against in this run (Goodhart, §3.5.6). */
  trainAgainst: TechniqueId[];
}

export type RLFamily = 'math' | 'swe' | 'computerUse' | 'mlResearch' | 'longHorizon' | 'cyber' | 'bio';

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

export interface Deployment {
  id: string;
  versionId: string;
  channel: Channel;
  startDay: Day;
  priceIndex: number; // 1 = market reference price; player sets 0.5..2
  effort: 'low' | 'max' | 'deep'; // §3.3.2 effort setting (deep needs P05)
  servingShare: number; // share of the serving pool reserved (internal uses the agents pool)
  safeguards: 'minimal' | 'standard' | 'classifiers' | 'hardened';
  controlLayer: boolean; // AG07 protocols active (usefulness tax)
  sectorFocus: SectorId[]; // sector products (+0.5 L in that sector, certification)
  usagePolicy: { noDropInReplacement: boolean; noSurveillance: boolean; noAutonomousWeapons: boolean; minorsProtections: boolean };
  kyc: 0 | 1 | 2 | 3; // anti-distillation level (api/agents)
  status: 'live' | 'restricted' | 'withdrawn';
  // derived each day
  revenueRate?: Money; // $B/yr
  demandBound?: 'capacity' | 'demand' | 'price' | 'quality';
}

// ───────────────────────────── Paradigms (§3.3.5) ─────────────────────────────

export interface ParadigmState {
  status: 'locked' | 'available' | 'researching' | 'succeeded' | 'failed' | 'adopted';
  progress: number; // 0..1
  fte: number;
  expShare: number; // share of experiment pool
  revealedDay?: Day;
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
  labor: { A: number; aiFTE: number; copies: number; speed: number; wH: number };
  ratios: { h: number; k: number; c: number; d: number };
  Ddata: number;
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
  monitoringShare: number; // share of safety compute on runtime monitoring
  monitorabilityCommitment: boolean; // F31 / faithful-CoT pledge
  edgeGrades: Record<string, 'A' | 'B' | 'C' | 'D'>; // player-visible grade, can be raised by AG08 (§3.5.4)
  edgeRevealed: Record<string, boolean>; // true weight revealed for this world
}

export interface AgendaState {
  fte: number;
  computeShare: number; // of the safety pool
  aiLabour: number; // 0..1 share of work done by internal AI (AG17 dynamics)
  hazardAcc: number; // accumulates λ; a finding fires when ≥ next threshold
  posterior: { a: number; b: number }; // visible Beta posterior on efficacy (shown as a band)
  status: 'idle' | 'active' | 'deadEnd';
  refresh?: { techniqueId: TechniqueId; progress: number }; // re-validation project
}

export interface TechniqueState {
  id: TechniqueId;
  agenda: AgendaId;
  family: ToolFamily;
  unlocked: boolean;
  active: boolean; // part of the deployed safety stack
  s0: number; // base strength
  mHalf: number; // multiplier at which strength halves (doubles on refresh, ↓ on NEG)
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
}

export interface Investigation {
  id: string;
  target: { kind: 'trait'; versionId: string; trait: TraitId } | { kind: 'incident'; incidentId: string };
  fte: number;
  computeShare: number;
  tools: TechniqueId[];
  aiLabour: number;
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
  hiring: { target: StaffByRole; pipeline: { day: Day; role: keyof StaffByRole; n: number }[] };
  morale: { overall: number; safety: number }; // 0..100
  dataAssets: { licensedTokensT: number; unlicensedTokensT: number; syntheticTokensT: number; litigationRisk: number };
  policies: PlayerPolicies;
}

export interface PlayerPolicies {
  whistleblowerChannel: boolean;
  publishSafety: 'none' | 'selective' | 'all';
  govBriefing: 0 | 1 | 2 | 3;
  shareWithAllies: boolean;
  transitionFund: Money; // $B/yr
  communityBenefits: boolean;
}

// ───────────────────────────── Finance (§3.7) ─────────────────────────────
// Finance v3 (design/FINANCE-V3.md, branch finance-v3): the source of truth is src/engine/v2/types.ts (FinanceState,
// FinancePromise, StrategicDeal, DealStrings, DealSupply, Board, BoardVote, MajorDecision). Summary of what changed
// from this contract: no narrative premium (valuation = sector value × share, capped), no raisedLast4q / k_Y cap,
// promises + investor credibility added, no deal templates (one partner offer per partner: hyperscaler / chip vendor /
// sovereign), no board approval vectors or pendingApprovals (deterministic seat-by-seat votes on major decisions via
// ActionDef.vote), debt kind 'vendorNote' → 'assumed', ledger kinds 'spvRVG' / 'vendor' → 'finLease' / 'acquired'.

export interface FinanceState {
  cash: Money;
  revenueRun: Money; // annualised, smoothed 30 d
  revenueHistory: Money[]; // quarterly, for g and momentum
  valuation: Money; // last mark: post-money of the last round, or min(sector value × share, valuation cap)
  ownership: Ownership;
  credibility: number; // investor credibility 0..100, moved by promises judged at their deadlines
  promises: FinancePromise[];
  dualClass?: boolean;
  rounds: EquityRound[];
  tranches: Tranche[];
  debts: Debt[];
  ledger: Commitment$[]; // financial commitments (take-or-pay, financing leases, LTAs)
  rating: 'BBB' | 'BB' | 'B' | 'closed';
  runwayQ: number;
  state: 'healthy' | 'tight' | 'distress' | 'insolvent';
  deals: StrategicDeal[];
  covenantBreachDay?: Day;
}

export interface Ownership { founder: number; mission: number; fin: number; strat: Record<string, number>; public: number; }

export interface EquityRound { day: Day; amount: Money; postMoney: Money; dilution: number; anchor?: string; down: boolean; ipo?: boolean; }
export interface FinancePromise { id: string; type: 'capability' | 'scale' | 'adoption'; pitch: 'conservative' | 'base' | 'aggressive'; start: number; target: number; amount: Money; closeDay: Day; deadline: Day; by?: 'parent'; }
export interface Tranche { amount: Money; dueDay: Day; condition?: string; deadline?: Day; source: string; partner?: string; stakeCap?: number; }
export interface Debt { id: string; kind: 'revolver' | 'gpuTerm' | 'bond' | 'assumed'; principal: Money; drawn: Money; spreadBp: number; maturityDay: Day; covenant?: string; collateralH100e?: H100e; }

/** Ledger entry for a contractual commitment ("Commitment$" to avoid clashing with relation Commitments). */
export interface Commitment$ {
  id: string;
  payee: string;
  kind: 'cloud' | 'lta' | 'lease' | 'finLease' | 'power' | 'acquired';
  perQuarter: Money;
  endDay: Day;
  cancellableNoticeQ: number | null; // null = non-cancellable
  penalty: Money;
}

export interface StrategicDeal {
  id: string;
  partner: string;
  kind: 'hyperscaler' | 'chipVendor' | 'sovereign';
  day: Day;
  equityNow: Money;
  equityLater: Money;
  strings: { exclusivity?: boolean; ipAccess?: { lab: LabId; trust?: boolean }; revenueShare?: number; boardVotes?: number };
  until: Day;
}

export interface Board {
  preset: GovernancePresetId;
  seats: BoardSeat[];
  confidence: number; // BC 0..100 (a division: parent confidence)
  safetyCommitteeVeto: boolean; // nonprofit PBC charter right: halts red-flagged releases (read by the deployment gate)
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
}

export interface PowerGrid {
  poolGWPerQ: number; // new US large-load grid capacity per quarter
  queue: { siteId: string; gw: number }[];
  capacityPrice: number; // κ_region uplift 0..0.15
  kWPerH100e: number;
  transformerLeadQ: number;
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
  /** Finance v3 (FINANCE-V3 §12, FIN5b; engine RivalFinance): valuation = min(sector value × marked share, valuation
   *  cap), commitments = its spend a year; mark, poolQ, raised and the last round's day added. */
  finance: { cash: Money; revenueRun: Money; valuation: Money; commitments: Money; distress: boolean; mark?: number; poolQ?: Money; raised?: Money };
  visible: { frameworkVersion: number; clauseType: 'conditional' | 'allAdopt' | 'unconditional' | 'override' | 'state'; testers: string[]; indexGrade?: string };
  intel: RivalIntel;
  meters: { poachAggression: number; cooperation: number; lobbyStance: number; openness: number };
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
}

export interface SectorState {
  F: number; K: number; R: number; Astar: number; A: number; alpha: number;
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
  rng(stream: StreamId): RngLike;
  /** Record a cause for a meter change; also applies the delta if `apply` is true. */
  cause(key: string, delta: number, source: string, detail?: string): void;
  log(kind: LogKind, text: string, severity?: LogEntry['severity'], ref?: string): void;
  headline(id: string, text: string, sector?: SectorId): void;
  queue(eventId: string, data?: Record<string, number | string>): void;
  /** Daily memo of expensive derived values (production, understanding) shared across systems. */
  memo: Map<string, unknown>;
}

/** One engine system. The loop runs systems in ascending `order` within each cadence (§2.2). */
export interface EngineSystem {
  id: string;
  owner: WorkstreamId;
  cadence: Cadence;
  order: number;
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
  apply(s: GameStateV2, ctx: SystemCtx, p: P): void;
  /** The board vote this action needs (finance v3: major decisions only, FINANCE-V3 §7.3), deterministic. */
  vote?(s: GameStateV2, p: P): unknown;
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
  deadlineDays: number;
  defaultChoice: number; // applied on expiry
  when(s: GameStateV2): Record<string, number | string> | false; // returns data bound into text
  text(s: GameStateV2, data: Record<string, number | string>): string; // terse; terms as [[glossary]] links
  choices: ChoiceV2[];
}

/** Bot policy used by headless tests (§7.4). */
export interface BotPolicy {
  id: 'ref' | 'race' | 'safe' | 'mixed' | 'passive';
  /** Called every day before the tick; may call actions. */
  act(s: GameStateV2, api: EngineApi): void;
  /** Pick a choice index for a pending decision. */
  decide(s: GameStateV2, d: PendingDecision): number;
}

export interface EngineApi {
  newGame(setup: SetupV2): GameStateV2;
  tick(s: GameStateV2): void; // one day, all due cadences
  act(s: GameStateV2, actionId: string, params?: Record<string, number | string | boolean>): void;
  resolve(s: GameStateV2, instance: string, choice: number): void;
  // selectors (pure; UI and bots use these, never raw hidden state)
  production(s: GameStateV2, lab: LabId): ProductionReadout;
  understanding(s: GameStateV2): { U: number; margin: number; perTrait: Partial<Record<TraitId, number>> };
  riskSources(s: GameStateV2): RiskSource[];
  leadDays(s: GameStateV2, other: LabId): { est: number; sd: number };
  raiseCeiling(s: GameStateV2): { max: Money; bound: 'pool' | 'dilution' | 'annualCap' | 'ask'; parts: Record<string, Money> };
}

/** Risk-source view row (§6.9). Built from player BELIEFS, never truth. */
export interface RiskSource { id: string; label: string; kind: 'ownModel' | 'rival' | 'china' | 'misuse' | 'theft' | 'war' | 'rogue'; estimate: number; band: [number, number]; drivers: { label: string; share: number }[]; }
