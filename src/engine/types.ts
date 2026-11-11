// Core game state. Everything here must be plain JSON (saves = JSON.stringify(state)).

export type BaselineId = 'classic' | 'reality';
export type WorldPresetId = 'sampled' | 'ai2027' | 'authors2026' | 'fast' | 'slow';
export type AlignDiffId = 'sampled' | 'easy' | 'medium' | 'hard';

export interface Setup {
  baseline: BaselineId;
  world: WorldPresetId;
  alignment: AlignDiffId;
  gov: string; // preset id or 'realistic'
  public: string;
  china: string;
  rivals: string; // 'realistic' or archetype id applied to all
  seed: number;
  companyName: string;
}

/** Hidden world parameters, sampled at game start. */
export interface World {
  /** Human-only research-years (at reference compute) from game start to Superhuman Coder */
  pSC: number;
  /** Human-only research-years between later milestones */
  gapSAR: number;
  gapSIAR: number;
  gapASI: number;
  /** R&D multiplier at each milestone index 0..6 */
  mult: number[];
  /** Elasticity of progress to capabilities compute relative to reference path */
  computeElasticity: number;
  /** Global compute growth per year */
  computeGrowth: number;
  /** Alignment difficulty multiplier on trait growth (0.5 easy .. 2 hard) */
  alignDifficulty: number;
  /** Threshold of hidden misalignment above which ASI goes wrong */
  doomThreshold: number;
  /** China's research efficiency relative to OpenBrain at equal compute */
  chinaEfficiency: number;
  /** Neuralese speedup to progress if adopted */
  neuraleseBoost: number;
  label: string;
}

export interface Allocation {
  /** fractions of compute, sum to 1 */
  capabilities: number;
  alignment: number;
  product: number;
  security: number;
}

export interface StaffSplit {
  capabilities: number;
  alignment: number;
  security: number;
}

export interface Policies {
  /** 0 hide, 1 minimal, 2 brief officials, 3 full transparency */
  govBriefing: number;
  /** -1 lobby to deregulate, 0 neutral, 1 support safety rules */
  lobbying: number;
  prPerMonth: number; // $B
  militaryWork: boolean;
  openWeightsOld: boolean;
  whistleblowerProtection: boolean;
  neuralese: boolean;
  /** Share with UK/allied AISIs before internal deployment */
  shareWithAllies: boolean;
  /** Cap on employees with privileged access (siloing) */
  siloing: number; // 0 none .. 2 strict
  hiringPerMonth: number; // net hires target
  computeOrders: number; // H100e per month being contracted
}

export interface TraitState {
  value: number; // hidden truth
  mask: number; // how much of it is hidden from behavioral/cot detectors
  est: number; // player's last estimate
  sigma: number; // uncertainty of estimate
  lastIncident?: number; // day
}

export interface TechState {
  progress: number;
  done: boolean;
  active: boolean;
  trainAgainst: boolean;
}

export interface ModelState {
  name: string;
  milestone: number;
  /** Milestone of the model currently available to the public */
  publicP: number;
  publicName: string;
  traits: Record<string, TraitState>;
}

export interface Lab {
  id: string;
  name: string;
  archetype: string;
  p: number; // progress (human-only research-years)
  computeShare: number; // of world compute
  safety: number;
  openness: number;
  cooperation: number;
  lobby: number;
  absorbed: boolean;
}

export interface ChinaState {
  preset: string;
  p: number;
  computeShare: number;
  centralization: number; // 0..100 (CDZ share)
  rung: number; // centralization ladder 0..4
  espionage: number; // 0..100 readiness
  taiwan: number; // 0..100
  diplomacy: number; // 0..100
  safety: number;
  openWeights: number;
  stoleWeights: boolean;
  theftAttempts: number;
  spies: number;
  hawk: number;
}

export interface GovState {
  preset: string;
  priority: number;
  regStance: number; // -100..100
  securityDemand: number;
  trust: number;
  hawkish: number;
  nationalization: number;
  rung: number; // G-SEC 0..5
  chinaRung: number; // G-CHN 0..4
  awareness: number; // what government knows about real capability 0..100
  congress: number;
  oversight: boolean;
  dpaOffered: boolean;
  treatyTalks: boolean;
  treaty: boolean;
}

export interface PublicState {
  preset: string;
  concern: number;
  approval: number; // -100..100
  jobAnxiety: number;
  xrisk: number;
  salience: number; // % naming AI top problem
  activism: number;
  rung: number; // activism ladder
  unemploymentShock: number; // pct points
}

export interface CompanyState {
  name: string;
  cash: number; // $B
  revenueRun: number; // $B/yr
  valuation: number; // $B
  compute: number; // H100e owned/leased
  pipeline: { day: number; amount: number }[];
  staff: number;
  safetyMorale: number; // 0..100
  boardConfidence: number; // 0..100
  lastRaiseDay: number;
  securityLevel: number; // continuous WSL
  privileged: number;
}

export interface LogEntry {
  day: number;
  kind: 'news' | 'incident' | 'milestone' | 'gov' | 'china' | 'public' | 'rival' | 'company' | 'research' | 'alert';
  text: string;
  severity?: number;
  /** true if it diverges from / matches the canonical AI 2027 story */
  canon?: string;
}

export interface PendingEvent {
  id: string;
  day: number;
  data?: Record<string, number | string>;
}

export interface Series {
  day: number[];
  pOB: number[];
  pChina: number[];
  pRival: number[];
  cash: number[];
  revenue: number[];
  approval: number[];
  mult: number[];
  misalignEst: number[];
}

export interface Ending {
  id: string;
  title: string;
  day: number;
  text: string;
  scores: { survival: number; freedom: number; prosperity: number; company: number; geopolitics: number };
}

export interface GameState {
  version: number;
  setup: Setup;
  world: World;
  rng: number;
  day: number; // days since start date
  startDate: string; // ISO
  p: number; // OpenBrain progress
  rdMult: number;
  milestoneDays: Record<number, number>;
  allocation: Allocation;
  staffSplit: StaffSplit;
  policies: Policies;
  company: CompanyState;
  model: ModelState;
  techs: Record<string, TechState>;
  researchQueue: string[];
  labs: Lab[];
  china: ChinaState;
  gov: GovState;
  pub: PublicState;
  log: LogEntry[];
  events: PendingEvent[]; // queued decisions shown to player
  firedEvents: Record<string, number>; // event id -> day fired
  flags: Record<string, number | boolean | string>;
  series: Series;
  ending?: Ending;
}
