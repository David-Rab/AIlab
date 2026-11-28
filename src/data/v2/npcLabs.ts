// NPC headline labs: the data tables (design/npc/NPC-LABS.md §4, §5, §11, §12, §15 O4/O5; sources in design/npc/CAST-2025.md).
// Task N2a. DATA ONLY: no engine code reads this yet (N2b builds the headline lab from it).
//
// Provenance tags on every number:
//   [P src]        primary source (the data page, paper or official post named)
//   [press]        media only, unverified (the designer's source policy: marked, never silently used)
//   [repo file:l]  taken from today's game data / the repo's research, for continuity
//   [D]            designer-style default with no source; to be replaced when sourced
//   [derived]      arithmetic on tagged values (shown)
import type { SectorId } from '../../engine/v2/types';
import type { ProductToolId } from './tools';
import { REF_TPP } from './runDesign';

// ───────────────────────────── Types ─────────────────────────────

export type NpcKindId = 'leader' | 'safety' | 'bigtech' | 'openweights' | 'racer' | 'upstart' | 'china';
export const NPC_KIND_IDS: readonly NpcKindId[] = ['leader', 'safety', 'bigtech', 'openweights', 'racer', 'upstart', 'china'];

export type NpcFunding = 'parent' | 'private' | 'state';
/** closed: never releases weights. open: every public release is open weights. partial: some (older) models are opened.
 *  chinaRung: open while China's tension (world/chinagov.ts, 0-4) is below `belowRung` (NPC-LABS §5), closed after. */
export type OpennessRule =
  | { mode: 'closed' }
  | { mode: 'open' }
  | { mode: 'partial' }
  | { mode: 'chinaRung'; belowRung: number };
/** The three market channels of a headline lab's focus (tools.ts ToolProduct without 'vetted'). */
export type FocusChannel = 'consumer' | 'api' | 'enterprise';

export interface Personality {
  /** 2. Funding. */
  funding: NpcFunding;
  /** 3. Days the best model stays internal before it is public (the public model is the internal one this long ago). */
  releaseLagDays: number;
  /** 4. Openness rule for its releases. */
  openness: OpennessRule;
  /** 5. Market focus: weights over channels (sum 1) and over sectors (sum 1; sectors not listed weigh 0). */
  focus: { channels: Record<FocusChannel, number>; sectors: Partial<Record<SectorId, number>> };
  /** 6. Safety emphasis 0-1 (cuts misalignment, sets disclosure and framework strength). For China's lab this is the base
   *  value; the China actor adds 0.4 x its safety concern / 100 (postures.ts CHINA_POSTURE_BASE). */
  safetyEmphasis: number;
  /** 7. Race response 0-1: how much safety emphasis gives way under race pressure. China's lab: state-directed, so 0
   *  here and the China actor decides (postures.ts: "state directive replaces raceRelaxation"). */
  raceResponse: number;
  /** True for China's lab: the China government sets its safety/race inputs and multiplies its chip access (export
   *  controls, the national collective: npc/china.ts); its compute follows the same plan and chip orders as every NPC lab. */
  chinaDirected?: true;
}

/** The internal model at the start is the public model advanced by one release lag (generic; no per-lab bookkeeping). */
export type InternalModelRule = { rule: 'advanceByReleaseLag' };

export interface NpcStart {
  startDate: string;
  /** Public capability lag behind the public frontier, months (Epoch ECI first-crossing). null: no public model (upstart). */
  publicLagMonths: number | null;
  /** Half-width (months) of the public band when the lag itself is a [D] guess. */
  publicLagBandMonths?: number;
  internalModel: InternalModelRule;
  /** H100e online at the start. */
  computeH100e: number;
  /** Revenue run-rate, $B. null: none reported (parent division, no product, or no row). */
  revenueRunB: number | null;
  /** Post-money valuation, $B. null: parent-funded, or none. */
  valuationB: number | null;
  /** Equity raised to the start, $B. null: parent-funded, or self-funded. */
  equityRaisedB: number | null;
  /** Tools shipped by the start (snapshot of tools.ts `shipped` by 2025-07-01; the test checks it against toolsAtStart). */
  tools: ProductToolId[];
}

export interface NpcCastEntry {
  id: string;
  kind: NpcKindId;
  /** Invented lab name and model family (checked against real companies, N2a-RESULT.md §3). */
  name: string;
  family: string;
  /** Real analogue: for tooltips and research notes only, never shown as the lab's name. */
  analogue: string;
  start: NpcStart;
}

// ───────────────────────────── Kinds (presets of the 7 personality values) ─────────────────────────────

// Compute: no per-kind appetite. Every lab plans its start compute x 2.25 a year (compute/market.ts RIVAL_GROWTH), N8b.

// Release lag, days: today's RELEASE_LAG [repo src/engine/v2/actors/rivals.ts:56], unsourced [D] (CAST-2025 §5b: only a
// lower bound for OpenAI, 28 days from METR's GPT-5 access; the system-card sourcing pass is open).
// Release cadence, days: ONE typical public-flagship interval for every kind (designer: the background labs need the right
// shape, not reality lab by lab). Median of 27 intervals between successive new-best-ECI models of OpenAI, Anthropic, Google
// DeepMind, xAI, Meta and DeepSeek, Jan 2023 to 1 Jul 2025; range 15-317 days [P epoch.ai/data/eci_scores.csv, fetched
// 2026-11-27; per-lab lists in design/archive/npc/N2a2-RESULT.md].
export const RELEASE_CADENCE_DAYS = 119;

// Safety emphasis = today's safetyInvestment, race response = today's raceRelaxation [repo src/data/v2/postures.ts:6-16].

// Market focus. Channel weights: OpenAI from reported splits (CAST-2025 §6: API about $3B of ~$13B ARR [press], ChatGPT paid
// floor ~$4.8B [repo research/22], the rest enterprise seats); all other kinds [D] from the qualitative focus in
// NPC-LABS §5. Sector weights are [D] from the same words (coding for the safety-first lab: Claude Code >$500M run-rate
// [P anthropic.com Series F post]); they set domain offsets and which tools a lab builds, not revenue by themselves.
export const KINDS: Record<NpcKindId, Personality> = {
  // Analogue OpenAI.
  leader: {
    funding: 'private', // [P CAST §3: private, capped-profit LP under a nonprofit until Oct 2025]
    releaseLagDays: 30, // [repo rivals.ts:56 leader 30] [D]
    openness: { mode: 'closed' }, // [P CAST §5a: closed; first open weights gpt-oss 5 Aug 2025, after the start]
    focus: {
      channels: { consumer: 0.37, api: 0.23, enterprise: 0.4 }, // [press, unverified] api 3/13; consumer 4.8/13 (a floor); enterprise the rest [derived]
      sectors: { OFFICE: 0.25, SOFT: 0.25, MEDIA: 0.2, SCI: 0.15, EDU: 0.15 }, // [D]
    },
    safetyEmphasis: 0.35, // [repo postures.ts leader safetyInvestment]
    raceResponse: 0.8, // [repo postures.ts leader raceRelaxation]
  },
  // Analogue Anthropic.
  safety: {
    funding: 'private', // [P anthropic.com Series E post; PBC + Long-Term Benefit Trust, CAST §3]
    releaseLagDays: 120, // [repo rivals.ts:56 safety 120] [D], no source (CAST §5b)
    openness: { mode: 'closed' }, // [P CAST §5a]
    focus: {
      channels: { consumer: 0.15, api: 0.55, enterprise: 0.3 }, // [D] (company names the segments, no percentages: CAST §6)
      sectors: { SOFT: 0.5, OFFICE: 0.15, FIN: 0.1, LEGAL: 0.1, SCI: 0.15 }, // [D]
    },
    safetyEmphasis: 0.65, // [repo postures.ts safety safetyInvestment]
    raceResponse: 0.55, // [repo postures.ts safety raceRelaxation]; the spec says "low": today's data says mid (flagged)
  },
  // Analogue Google DeepMind.
  bigtech: {
    funding: 'parent', // [P Alphabet Q2 2025 earnings post: capex guide $85B, CAST §3]
    releaseLagDays: 60, // [repo rivals.ts:56 bigtech 60] [D]
    openness: { mode: 'closed' }, // flagship closed [P CAST §5a]; the open Gemma family is not modelled
    focus: {
      channels: { consumer: 0.5, api: 0.2, enterprise: 0.3 }, // [D] the parent's products (Gemini app >450M MAU [repo research/18:136])
      sectors: { OFFICE: 0.3, SOFT: 0.2, MEDIA: 0.2, SCI: 0.15, EDU: 0.15 }, // [D]
    },
    safetyEmphasis: 0.5, // [repo postures.ts bigtech safetyInvestment]
    raceResponse: 0.6, // [repo postures.ts bigtech raceRelaxation]
  },
  // Analogue Meta.
  openweights: {
    funding: 'parent', // [repo research/18:133: 2025 capex guide $66-72B; press, unverified]
    releaseLagDays: 60, // [repo rivals.ts:56 openweights 60] [D]
    openness: { mode: 'open' }, // [P CAST §5a: Llama open weights; the spec's "open near the frontier" is N2b's use of this rule]
    focus: {
      channels: { consumer: 0.8, api: 0.1, enterprise: 0.1 }, // [D] Meta AI in its apps; no revenue (CAST §6)
      sectors: { MEDIA: 0.5, SOFT: 0.2, OFFICE: 0.1, EDU: 0.1, SERV: 0.1 }, // [D]
    },
    safetyEmphasis: 0.3, // [repo postures.ts openweights safetyInvestment]
    raceResponse: 0.7, // [repo postures.ts openweights raceRelaxation]
  },
  // Analogue xAI.
  racer: {
    funding: 'private', // [P CAST §3: founder-controlled, X merger]
    releaseLagDays: 15, // [repo rivals.ts:56 maverick 15] [D]; the one start observation: Grok 4 shipped 8 days after the start (CAST §1)
    openness: { mode: 'partial' }, // [D] spec: "partly open"; no checked open-weights release in CAST (Grok 4 closed [press, unverified])
    focus: {
      channels: { consumer: 0.6, api: 0.3, enterprise: 0.1 }, // [D] Grok in X and the Grok app; API (CAST §6)
      sectors: { MEDIA: 0.4, SOFT: 0.3, GOV: 0.15, MIL: 0.15 }, // [D] xAI for Government [repo tools.ts defence row]
    },
    safetyEmphasis: 0.1, // [repo postures.ts maverick safetyInvestment]
    raceResponse: 0.9, // [repo postures.ts maverick raceRelaxation]
  },
  // Analogue SSI, Thinking Machines.
  upstart: {
    funding: 'private', // [press, unverified: CAST §3]
    releaseLagDays: 60, // [repo rivals.ts:56 upstart 60] [D]
    openness: { mode: 'closed' }, // [D] spec: closed
    focus: {
      channels: { consumer: 0, api: 0.7, enterprise: 0.3 }, // [D] research; no product at the start (CAST §6)
      sectors: { SCI: 0.6, SOFT: 0.4 }, // [D]
    },
    safetyEmphasis: 0.5, // [repo postures.ts upstart safetyInvestment]
    raceResponse: 0.5, // [repo postures.ts upstart raceRelaxation]; the spec says "low": today's data says mid (flagged)
  },
  // Analogue DeepSeek. Its safety follow-up and race stance belong to the China government; its chip access is multiplied by it.
  china: {
    funding: 'state', // spec §5; self-funded by High-Flyer at the start [P arXiv 2408.14158, CAST §3]
    releaseLagDays: 45, // [repo rivals.ts:56 deepcent 45] [D]
    openness: { mode: 'chinaRung', belowRung: 2 }, // [spec §5: open while China's rung < 3 of the old 0-6 ladder; W6: its nearest tension rung, open below 2 (national collective)]; MIT-licensed open weights at the start [repo research/10-china.md:270]
    focus: {
      channels: { consumer: 0.4, api: 0.5, enterprise: 0.1 }, // [D] free app, API, open weights (CAST §6)
      sectors: { SOFT: 0.4, SCI: 0.3, OFFICE: 0.3 }, // [D]
    },
    safetyEmphasis: 0.1, // [repo postures.ts CHINA_POSTURE_BASE safetyInvestment]; the China actor adds 0.4 x concern/100
    raceResponse: 0, // [repo postures.ts CHINA_POSTURE_BASE raceRelaxation 0]: the state directive replaces it
    chinaDirected: true,
  },
};

// ───────────────────────────── Realistic cast (1 July 2025; NPC-LABS §15 O5, CAST-2025.md) ─────────────────────────────

const START = '2025-07-01'; // [repo src/engine/v2/core/time.ts:5 START_DATE]

// Compute at the start: log-linear between Epoch's end-2024 and end-2025 values, at 181/365 of the year [derived].
// Only OpenAI has both ends (386K, 1.743M [P Epoch]): 386K x (1.743/0.386)^0.496 = 0.82M, equal to the repo back-cast.
// Anthropic, GDM, xAI, Meta have only the end-2025 Epoch value [P] and no end-2024 one (CAST §9 gap 1): the repo's
// back-cast at 2.5x/yr is used [repo research/18-start-types.md:102,135,181] [D], not measured.
export const REALISTIC_CAST: NpcCastEntry[] = [
  {
    id: 'marenth', kind: 'leader', name: 'Marenth', family: 'Solvane', analogue: 'OpenAI',
    start: {
      startDate: START,
      publicLagMonths: 0, // [P Epoch ECI: o3-pro 147.47 is the frontier itself; CAST §1]
      internalModel: { rule: 'advanceByReleaseLag' },
      computeH100e: 0.82e6, // [derived] 386K -> 1.743M log-linear [P Epoch]
      revenueRunB: 12, // [P company disclosure, CFO: $12B run-rate on 30 Jul 2025; CAST §3 (Confident); 10 on 9 Jun is [press]]
      valuationB: 300, // [P SoftBank press release 1 Apr 2025: $300B post-money]
      equityRaisedB: 34, // [derived from Epoch funding rows; CAST §3]
      tools: ['coding', 'research', 'defence', 'creative', 'computerUse', 'memory', 'voiceVision'], // [repo tools.ts shipped, by 2025-07-01]
    },
  },
  {
    id: 'lanternworks', kind: 'safety', name: 'Lanternworks', family: 'Ouvril', analogue: 'Anthropic',
    start: {
      startDate: START,
      publicLagMonths: 3.0, // [P Epoch ECI first crossing: Opus 4 142.85 first crossed by Gemini 2.5 Pro Mar 143.98 on 31 Mar; CAST §1]
      internalModel: { rule: 'advanceByReleaseLag' },
      computeH100e: 0.5e6, // [D] repo back-cast 0.4-0.6M (research/18:102); Epoch end-2025 1.19M [P] is the check
      revenueRunB: 4, // [derived] between $3B on 30 May and $5B on 29 Jul, both company-disclosed [P Epoch revenue CSV]
      valuationB: 61.5, // [P anthropic.com Series E post, 3 Mar 2025]
      equityRaisedB: 16, // [derived from Epoch funding rows; CAST §3]
      tools: ['coding', 'research', 'defence', 'computerUse', 'voiceVision'], // [repo tools.ts shipped]
    },
  },
  {
    id: 'tarnwick', kind: 'bigtech', name: 'Tarnwick', family: 'Davrel', analogue: 'Google DeepMind',
    start: {
      startDate: START,
      publicLagMonths: 2.5, // [P Epoch ECI first crossing: Gemini 2.5 Pro Jun 144.88 first crossed by o4-mini / o3 on 16 Apr; CAST §1]
      internalModel: { rule: 'advanceByReleaseLag' },
      computeH100e: 1.0e6, // [D] repo back-cast (research/18:135); Epoch end-2025 1.583M [P] is the check; the lab's share of Google's compute is wide (CI 1.0-2.5M)
      revenueRunB: null, // not reported separately (inside Google Cloud and Search; CAST §3)
      valuationB: null,
      equityRaisedB: null,
      tools: ['coding', 'research', 'creative', 'computerUse', 'memory', 'voiceVision'], // [repo tools.ts shipped]
    },
  },
  {
    id: 'zorvane', kind: 'racer', name: 'Zorvane', family: 'Brask', analogue: 'xAI',
    start: {
      startDate: START,
      publicLagMonths: 6.5, // [P Epoch ECI: Grok-3 mini 139.88 on 24 Jun, first crossed by o1 141.16 on 17 Dec 2024; CAST §1]
      internalModel: { rule: 'advanceByReleaseLag' },
      computeH100e: 0.28e6, // [D] Colossus 1 ~200K GPUs = ~0.28M H100e (repo research/18:102, U/D); Epoch end-2025 0.615M [P] (CI 0.55-0.70M)
      revenueRunB: 0.236, // [press, unverified] Epoch Q2 2025 $59M annualised (Likely)
      valuationB: 150, // [press, unverified] ~$150B at the 30 Jun 2025 raise, "believed, not confirmed" (Epoch Likely)
      equityRaisedB: 17, // [derived] $12B (2024) + $5B equity (Jun 2025); excludes $5B debt and $5B notes [CAST §3, repo research/21:78 U]
      tools: ['research', 'creative'], // [repo tools.ts shipped]
    },
  },
  {
    id: 'wolderfield', kind: 'openweights', name: 'Wolderfield', family: 'Hollin', analogue: 'Meta',
    start: {
      startDate: START,
      publicLagMonths: 9.6, // [P Epoch ECI first crossing: Llama 4 Maverick 132.19, o1-preview 133.58 on 12 Sep 2024; CAST §1]
      internalModel: { rule: 'advanceByReleaseLag' },
      computeH100e: 0.6e6, // [D] repo back-cast (research/18:135); Epoch end-2025 0.996M [P] (CI 0.61-1.64M)
      revenueRunB: null, // not separate (CAST §3)
      valuationB: null,
      equityRaisedB: null,
      tools: ['creative', 'memory', 'voiceVision', 'companion'], // [repo tools.ts shipped]
    },
  },
  {
    id: 'pellory', kind: 'upstart', name: 'Pellory', family: 'Verrin', analogue: 'SSI, Thinking Machines',
    start: {
      startDate: START,
      publicLagMonths: null, // no public model and no product at the start (CAST §1)
      publicLagBandMonths: 3, // [D] wide band: capability unknown
      internalModel: { rule: 'advanceByReleaseLag' },
      computeH100e: 0.03e6, // [D] repo design placeholder for a spinout: 10-50K H100e rented (research/18:61)
      revenueRunB: 0, // none (CAST §3)
      valuationB: 32, // [press, unverified] SSI $32B, Apr 2025 (TechCrunch); TML $12B was 2 weeks after the start
      equityRaisedB: 3, // [press, unverified] SSI about $3B (repo research/18:61)
      tools: [], // none shipped (tools.ts)
    },
  },
  {
    id: 'xuanmu', kind: 'china', name: 'Xuanmu Lab', family: 'Muyi', analogue: 'DeepSeek',
    start: {
      startDate: START,
      publicLagMonths: 6.5, // [P Epoch ECI first crossing: R1-0528 140.73, o1 141.16 on 17 Dec 2024; CAST §1]
      internalModel: { rule: 'advanceByReleaseLag' },
      computeH100e: 0.36e6, // [derived] China's accessible 1.5M H100e (Jul 2025, research/10 §1.1) × its AGI share 0.4 (AI 2027 compute forecast, research/11 #16) × the R&D share 0.6 (the old deepCentCompute rule)
      revenueRunB: null, // no Epoch row before 2026
      valuationB: null, // self-funded by High-Flyer
      equityRaisedB: null,
      tools: [], // none shipped (tools.ts)
    },
  },
];

// ───────────────────────────── Model size and serving (moved from the old data/v2/rivalModel.ts, N12) ─────────────────────────────

/** Tokens per active parameter of an NPC model: the reference design's (runDesign.ts REF_TPP, 400): labs that serve their
 *  models overtrain them like 2025 production models (DeepSeek-V3 ≈ 400 per active parameter, research/20 A1) [R20 A1, D].
 *  Active parameters N = √(FLOP / (6 · tpp)), MoE shape. */
export const RIVAL_TPP = REF_TPP;
/** Serving-stack growth (OOM a year) at the 2025 reference serving stack: what the reference lab's Inference-efficiency line
 *  added in its first year (RefBot, ai2027, seed 2027; serving test V1) [fit]. Now the one rate every NPC lab's serving
 *  efficiency grows at (npc/model.ts npcServeOom). */
export const SERVE_RATE0 = 0.2;
