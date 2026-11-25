// Bot settings: every tunable choice of RefBot (bots/ref.ts) and the mixed bot (bots/mixed.ts) in one typed object each,
// so tooling can build a bot with other choices (`makeRefBot(settings)`, `makeMixedBot(settings)`). The defaults hold
// today's values exactly; the comment on each field names its balance registry id (balance/params/core.ts, area 'bots').
// The caricature bots (race, safe, capex2x) and the finance autopilot's own values (finance/plan.ts) stay where they are.
import type { AgendaId, AgentUse, TraitId } from '../types';
import { REF_AUTOPILOT, type AutopilotOpts } from '../finance/plan';
import type { LinePlan } from './common';

/** The four research pacing gates (RefBot's old display levels 6.5, 7, 8.5, 9.5). */
export type GateKey = 'L65' | 'L7' | 'L85' | 'L95';

/** Launch-share each kind of run asks for in RefBot's pool-share sync. */
export interface AskShares { base: number; post: number; postTeacher: number; distill: number; other: number }

export interface RefBotSettings {
  /** bots.ref.REF_RETRY_DAYS: days after a failure before a failed idea is reopened as speculative. */
  retryDays: number;
  /** bots.ref.GATE_OOM: research pacing gates, effective-compute OOM above the start model V0 (order L65, L7, L85, L95). */
  gateOom: Record<GateKey, number>;
  /** bots.ref.REF_TREE: tree projects to start, in priority order. */
  research: string[];
  /** bots.ref.REF_TREE (gates): the gate that must be open before a project in `research` starts; none = at once. */
  researchGate: Record<string, GateKey>;
  /** bots.ref.REF_IDEA_TEAMS: science teams wanted on each paradigm project. */
  ideaTeams: number;
  /** bots.ref.BASE_EVERY: days between base runs. */
  baseEvery: number;
  /** bots.ref.REF_BASE_DAYS: the base's target run length (days) at its pool share, leader start. */
  baseDays: number;
  /** bots.ref.FOLLOWER_MAX_BASE_DAYS: the same for follower starts. */
  followerMaxBaseDays: number;
  /** bots.ref.FOLLOWER_GROW_Q: runway (quarters) a follower start needs before it hires. */
  followerGrowQ: number;
  /** bots.ref.REF_STUDENT: distilled mini size as a fraction of the teacher's active parameters. */
  student: number;
  /** bots.ref.CHEAP_MAX: the cheap API tier's largest size as a fraction of the internal model (cheapTier option only). */
  cheapMax: number;
  /** bots.ref.POST_EVERY: days between post-train launches. */
  postEvery: number;
  /** bots.ref.MINI_EVERY: days between minis under the 'mini' release mode. */
  miniEvery: number;
  /** bots.ref.MINI_GAP_L: levels the internal model may lead what the products serve before a sooner mini. */
  miniGapL: number;
  /** bots.ref.PRODUCT_CHANNELS: the products sold. */
  productChannels: string[];
  /** bots.ref.PUBLIC_CHANNELS: the public release channels (where the minis go). */
  publicChannels: string[];
  /** bots.ref.REF_LINES: safety science lines, teams and ideas in order. */
  lines: LinePlan[];
  /** bots.ref.REF_SAFETY_SCI_TEAMS: safety science teams targeted on day 0. */
  safetySciTeams: number;
  /** bots.ref.REF_ALIGN_SHARE.2025 / .2026 / .year: AI 2027's alignment share of internal compute by decimal year. */
  alignShare: { year: number; share: number }[];
  /** bots.ref.refSafetyShare.floor: floor on the non-reserved share of the safety pool. */
  safetyShareFloor: number;
  /** bots.ref.refSafetyAgents.tolerance: relative move in the safety agents' compute before it is reset. */
  safetyAgentsTolerance: number;
  /** bots.ref.REF_MONITOR_SPEND: share of the watched fleets' compute spent on monitoring. */
  monitorSpend: number;
  /** bots.ref.REF_MONITOR_COST: the monitor's FLOP per token as a fraction of the watched model's. */
  monitorCost: number;
  /** bots.ref.REF_MONITORED: the agent uses RefBot watches with monitors. */
  monitored: AgentUse[];
  /** bots.ref.refMonitors.shareCap: most of the safety compute the monitors may take. */
  monitorShareCap: number;
  /** bots.ref.refMonitors.tolerance: relative move in the monitor budget before it is reset. */
  monitorTolerance: number;
  /** bots.ref.refPlay.splitCadence: days between compute split and hiring updates. */
  splitCadence: number;
  /** bots.ref.refPlay.hiringLead: years ahead of today the hiring target tracks H_ref. */
  hiringLead: number;
  /** bots.ref.refPlay.rlSaturation: share of the RL ceiling at which the RL-algorithm line is dropped. */
  rlSaturation: number;
  /** bots.ref.refPlay.basePoolShare: training-pool share a base run is launched on. */
  basePoolShare: number;
  /** bots.ref.refPlay.postPoolShare: training-pool share a post-train is launched on. */
  postPoolShare: number;
  /** bots.ref.refPlay.postsInFlight: post-train runs at once, leader and follower start. */
  postsInFlight: { leader: number; follower: number };
  /** bots.ref.refPlay.staleMiniGapDays: days between minis on the "stale" rule. */
  staleMiniGapDays: number;
  /** bots.ref.refPlay.enterpriseMargin: levels Enterprise's version may exceed the public release. */
  enterpriseMargin: number;
  /** bots.ref.refPlay.keepFull: newest full versions kept. */
  keepFull: number;
  /** bots.ref.refPlay.keepMinis: newest minis kept. */
  keepMinis: number;
  /** bots.ref.leadStudent.holdMargin: OOM of chat fit a REF_STUDENT-size mini must beat what Chat / API serve by. */
  holdMargin: number;
  /** bots.ref.competeRelease.upgradeMargin: OOM of chat fit a product's new version must gain. */
  upgradeMargin: number;
  /** bots.ref.RELEASE_LEAD: OOM of chat fit the public release keeps over the best rival public model. */
  releaseLead: number;
  /** bots.ref.RELEASE_REFRESH: lead below which a product is refreshed. */
  releaseRefresh: number;
  /** bots.ref.RELEASE_CHEAPER: FLOP-per-token ratio at which a cheaper adequate version replaces the served one. */
  releaseCheaper: number;
  /** bots.ref.RELEASE_EVERY: days between release checks. */
  releaseEvery: number;
  /** bots.ref.MINI_MIN_DAYS: minimum days between two public-mini distils under 'compete'. */
  miniMinDays: number;
  /** bots.ref.askShare: pool share each kind of run asks for when shares are synced. */
  askShares: AskShares;
  /** bots.ref.TRUST_OVERSIGHT: believed oversight at which Trusted to AI starts and at which it hands all safety work. */
  trustOversight: [number, number];
  /** bots.ref.TRUST_SAB_MAX: most believed sabotage per safety result accepted when handing work to AI. */
  trustSabMax: number;
  /** bots.ref.refTrusted.step: the Trusted to AI share moves in steps of this size. */
  trustStep: number;
  /** bots.ref.FOOTHOLD_CASE_FTE: safety research engineers put on a foothold case. */
  footholdCaseFte: number;
  /** No registry id (finance/plan.ts REF_AUTOPILOT): the finance autopilot options the bot runs. */
  autopilot: AutopilotOpts;
}

/** RefBot's choices, today's values. */
export const DEFAULT_REF: RefBotSettings = {
  retryDays: 180,
  gateOom: { L65: 1.3656, L7: 1.7706, L85: 2.9856, L95: 3.5256 },
  research: ['P07', 'P05', 'P08', 'rl.mlResearch', 'P17'],
  researchGate: { P08: 'L7', 'rl.mlResearch': 'L65', P17: 'L95' },
  ideaTeams: 3,
  baseEvery: 270,
  baseDays: 121,
  followerMaxBaseDays: 200,
  followerGrowQ: 6,
  student: 0.5,
  cheapMax: 0.25,
  postEvery: 42,
  miniEvery: 182,
  miniGapL: 0.7,
  productChannels: ['consumer', 'api', 'enterprise'],
  publicChannels: ['consumer', 'api'],
  lines: [
    { ag: 'AG18', teams: 1, ideas: ['T-CONFESS', 'T-ANTISCHEME'] },
    { ag: 'AG02', teams: 1, ideas: ['T-DECEPT', 'T-NLA'] },
    { ag: 'AG08', teams: 1, ideas: ['T-HONEY', 'T-AUDIT'] },
    { ag: 'AG07', teams: 1, ideas: ['T-RESAMPLE', 'T-CEVAL', 'T-LOCK'] },
  ],
  safetySciTeams: 4,
  alignShare: [{ year: 2025.5, share: 0.04 }, { year: 2026.5, share: 0.03 }],
  safetyShareFloor: 0.2,
  safetyAgentsTolerance: 0.1,
  monitorSpend: 1 / 20,
  monitorCost: 0.1,
  monitored: ['capRoutine', 'capFrontier'],
  monitorShareCap: 0.8,
  monitorTolerance: 0.1,
  splitCadence: 30,
  hiringLead: 0.12,
  rlSaturation: 0.95,
  basePoolShare: 0.6,
  postPoolShare: 0.5,
  postsInFlight: { leader: 2, follower: 1 },
  staleMiniGapDays: 45,
  enterpriseMargin: 0.25,
  keepFull: 4,
  keepMinis: 2,
  holdMargin: 0.05,
  upgradeMargin: 0.01,
  releaseLead: 0.3,
  releaseRefresh: 0.1,
  releaseCheaper: 0.8,
  releaseEvery: 7,
  miniMinDays: 30,
  askShares: { base: 0.6, post: 0.5, postTeacher: 0.3, distill: 0.1, other: 0.3 },
  trustOversight: [0.4, 0.8],
  trustSabMax: 0.1,
  trustStep: 0.1,
  footholdCaseFte: 15,
  autopilot: REF_AUTOPILOT,
};

/** One line of the mixed bot's safety plan: an agenda, or the lottery line chosen on day 0. */
export interface MixedLine { ag: AgendaId | 'lottery'; teams: number }

export interface MixedBotSettings {
  /** The reference play the mixed bot reuses (refPlay): the RefBot choices it shares. */
  ref: RefBotSettings;
  /** bots.mixed.LOTTERY: candidates for the lottery line (the one with the best posterior mean on day 0 is staffed). */
  lottery: AgendaId[];
  /** bots.mixed.MIXED_SCI_TEAMS: safety science teams targeted on day 0. */
  sciTeams: number;
  /** bots.mixed.MIXED_RE_TEAMS: safety research-engineering teams targeted on day 0. */
  reTeams: number;
  /** bots.mixed.mixedLines: safety lines in priority order with the teams each should have. */
  lines: MixedLine[];
  /** bots.mixed.RED_FLAGS: traits answered with patches and methods. */
  redFlags: TraitId[];
  /** bots.mixed.redFlagThresholds: believed estimate and clarity a trait must exceed to be answered. */
  redFlagThresholds: [number, number];
  /** bots.mixed.latentOk: posterior mean of AG01 or AG02 above which latent reasoning (P17) is researched. */
  latentOk: number;
  /** bots.mixed.MIXED_PLAY: the post-train design the mixed bot asks for and its release mode. */
  play: { post: Record<string, number | string | boolean>; release: 'compete' | 'mini' | 'frontier' };
  /** bots.mixed.safetyShareBounds: lowest and highest safety compute share. */
  safetyShareBounds: [number, number];
  /** bots.mixed.safetyShareSteering: sight-limit margin below which safety compute rises (by `raise`) and above which it falls (by `lower`). */
  safetyShareSteering: { raiseBelow: number; raise: number; lowerAbove: number; lower: number };
  /** bots.mixed.govBriefing: government briefing level. */
  govBriefing: number;
  /** bots.mixed.securityStep: weight-security levels above the current floor it targets. */
  securityStep: number;
  /** bots.mixed.mergerChoice: cash left in the bank ($B) and largest stock stake when accepting a merger. */
  mergerChoice: { cushion: number; maxStake: number };
  /** bots.mixed.mixedBot: the action ids tried every `every` days. */
  acts: { every: number; ids: string[] };
  /** No registry id (finance/plan.ts REF_AUTOPILOT): the finance autopilot options the bot runs. */
  autopilot: AutopilotOpts;
}

const MIXED_CORE: AgendaId[] = ['AG02', 'AG08', 'AG18', 'AG09', 'AG07'];

/** The mixed bot's choices, today's values. */
export const DEFAULT_MIXED: MixedBotSettings = {
  ref: DEFAULT_REF,
  lottery: ['AG01', 'AG04', 'AG10', 'AG11', 'AG12', 'AG13'],
  sciTeams: 12,
  reTeams: 5,
  lines: [
    ...[...MIXED_CORE, 'lottery' as const].map((ag) => ({ ag, teams: 1 })),
    ...[...MIXED_CORE, 'lottery' as const].map((ag) => ({ ag, teams: 2 })),
  ],
  redFlags: ['SCHEME', 'AF', 'SAND', 'POWER', 'SUCC', 'COLLUDE', 'TGAME'],
  redFlagThresholds: [0.25, 0.3],
  latentOk: 0.6,
  play: { post: { pref: 'constitution', rlBudget: 'standard', cot: 'visible', safety: 'standard' }, release: 'mini' },
  safetyShareBounds: [0.03, 0.12],
  safetyShareSteering: { raiseBelow: 0.5, raise: 0.03, lowerAbove: 2, lower: 0.01 },
  govBriefing: 2,
  securityStep: 0.6,
  mergerChoice: { cushion: 20, maxStake: 0.1 },
  acts: { every: 15, ids: ['A1', 'A2', 'A6', 'C1', 'E1', 'E2', 'A4'] },
  autopilot: REF_AUTOPILOT,
};
