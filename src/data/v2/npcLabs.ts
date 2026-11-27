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

// ───────────────────────────── Types ─────────────────────────────

export type NpcKindId = 'leader' | 'safety' | 'bigtech' | 'openweights' | 'racer' | 'upstart' | 'china';
export const NPC_KIND_IDS: readonly NpcKindId[] = ['leader', 'safety', 'bigtech', 'openweights', 'racer', 'upstart', 'china'];

export type NpcFunding = 'parent' | 'private' | 'state';
/** closed: never releases weights. open: every public release is open weights. partial: some (older) models are opened.
 *  chinaRung: open while China's escalation rung is below `belowRung` (NPC-LABS §5), closed after. */
export type OpennessRule =
  | { mode: 'closed' }
  | { mode: 'open' }
  | { mode: 'partial' }
  | { mode: 'chinaRung'; belowRung: number };
/** The three market channels of a headline lab's focus (tools.ts ToolProduct without 'vetted'). */
export type FocusChannel = 'consumer' | 'api' | 'enterprise';

export interface Personality {
  /** 1. Compute appetite: the lab's yearly growth multiple of its H100e (orders in the chip market). null: China's lab
   *  uses China's compute meter, never its own growth. */
  computeGrowthPerYear: number | null;
  /** 2. Funding. */
  funding: NpcFunding;
  /** 3. Days the best model stays internal before it is public (the public model is the internal one this long ago). */
  releaseLagDays: number;
  /** 3. Days between public steps (the lab's release cadence). */
  releaseCadenceDays: number;
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
  /** True for China's lab: the China actor owns its compute (computeGrowthPerYear null) and its safety/race inputs. */
  chinaDirected?: true;
}

/** How the internal model at the start is found (NPC-LABS §15 O5): the lab's next public release if it comes within its
 *  release lag of the start date; otherwise the public model advanced by one release lag. */
export type InternalModelRule =
  | { rule: 'nextRelease'; model: string; lagMonths: number; shipsInDays: number }
  | { rule: 'advanceByReleaseLag' };

export interface NpcStart {
  startDate: string;
  /** Public capability lag behind the public frontier, months (Epoch ECI first-crossing). null: no public model (upstart). */
  publicLagMonths: number | null;
  /** Half-width (months) of the public band when the lag itself is a [D] guess. */
  publicLagBandMonths?: number;
  internalModel: InternalModelRule;
  /** H100e online at the start. 'china-meter': China's own compute meter (china actor), no number here. */
  computeH100e: number | 'china-meter';
  /** Revenue run-rate, $B. null: none reported (parent division, no product, or no row). */
  revenueRunB: number | null;
  /** Post-money valuation, $B. null: parent-funded, or none. */
  valuationB: number | null;
  /** Equity raised to the start, $B. null: parent-funded, or self-funded. */
  equityRaisedB: number | null;
  headcount: number;
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

// Compute appetite. The game's growth rule for rivals is 2.25x a year (compute/market.ts RIVAL_GROWTH_Q = 2.25^0.25 - 1),
// scaled by the spec's level word: low 0.8, mid 1.0, high 1.2, very high 1.5 [D]. The leader's is measured instead:
// OpenAI 386K (end-2024) -> 1.743M H100e (end-2025) = 4.5x [P Epoch AI chip-users explorer; CAST-2025 §2; derived 1.743/0.386].
const BASE_GROWTH = 2.25; // [repo src/engine/v2/compute/market.ts:121]

// Release lag, days: today's RELEASE_LAG [repo src/engine/v2/actors/rivals.ts:56], unsourced [D] (CAST-2025 §5b: only a
// lower bound for OpenAI, 28 days from METR's GPT-5 access; the system-card sourcing pass is open).
// Release cadence, days: today's BASE_MONTHS x 30.4 [repo rivals.ts:58, [D] there too: 9-15 months by archetype].
// NOTE for N2b: the observed public flagship steps (Epoch ECI file, CAST-2025 §5a) are 1.5-2 months (OpenAI) to ~4.5
// (Meta); BASE_MONTHS is a base-model cadence. Which one "release cadence" means is a design question, left open.
const cadence = (months: number) => Math.round(months * 30.4);

// Safety emphasis = today's safetyInvestment, race response = today's raceRelaxation [repo src/data/v2/postures.ts:6-16].

// Market focus. Channel weights: OpenAI from reported splits (CAST-2025 §6: API about $3B of ~$13B ARR [press], ChatGPT paid
// floor ~$4.8B [repo research/22], the rest enterprise seats); all other kinds [D] from the qualitative focus in
// NPC-LABS §5. Sector weights are [D] from the same words (coding for the safety-first lab: Claude Code >$500M run-rate
// [P anthropic.com Series F post]); they set domain offsets and which tools a lab builds, not revenue by themselves.
export const KINDS: Record<NpcKindId, Personality> = {
  // Analogue OpenAI.
  leader: {
    computeGrowthPerYear: 4.5, // [P Epoch, derived]
    funding: 'private', // [P CAST §3: private, capped-profit LP under a nonprofit until Oct 2025]
    releaseLagDays: 30, // [repo rivals.ts:56 leader 30] [D]
    releaseCadenceDays: cadence(9), // [repo rivals.ts:58 leader 9 months] [D]
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
    computeGrowthPerYear: BASE_GROWTH * 1.0, // mid [D]
    funding: 'private', // [P anthropic.com Series E post; PBC + Long-Term Benefit Trust, CAST §3]
    releaseLagDays: 120, // [repo rivals.ts:56 safety 120] [D], no source (CAST §5b)
    releaseCadenceDays: cadence(13), // [repo rivals.ts:58 safety 13] [D]
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
    computeGrowthPerYear: BASE_GROWTH * 1.2, // high [D]
    funding: 'parent', // [P Alphabet Q2 2025 earnings post: capex guide $85B, CAST §3]
    releaseLagDays: 60, // [repo rivals.ts:56 bigtech 60] [D]
    releaseCadenceDays: cadence(12), // [repo rivals.ts:58 bigtech 12] [D]
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
    computeGrowthPerYear: BASE_GROWTH * 1.2, // high [D]
    funding: 'parent', // [repo research/18:133: 2025 capex guide $66-72B; press, unverified]
    releaseLagDays: 60, // [repo rivals.ts:56 openweights 60] [D]
    releaseCadenceDays: cadence(12), // [repo rivals.ts:58 openweights 12] [D]
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
    computeGrowthPerYear: BASE_GROWTH * 1.5, // very high [D]
    funding: 'private', // [P CAST §3: founder-controlled, X merger]
    releaseLagDays: 15, // [repo rivals.ts:56 maverick 15] [D]; the one start observation: Grok 4 shipped 8 days after the start (CAST §1)
    releaseCadenceDays: cadence(9), // [repo rivals.ts:58 maverick 9] [D]
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
    computeGrowthPerYear: BASE_GROWTH * 0.8, // low [D]
    funding: 'private', // [press, unverified: CAST §3]
    releaseLagDays: 60, // [repo rivals.ts:56 upstart 60] [D]
    releaseCadenceDays: cadence(15), // [repo rivals.ts:58 upstart 15] [D]
    openness: { mode: 'closed' }, // [D] spec: closed
    focus: {
      channels: { consumer: 0, api: 0.7, enterprise: 0.3 }, // [D] research; no product at the start (CAST §6)
      sectors: { SCI: 0.6, SOFT: 0.4 }, // [D]
    },
    safetyEmphasis: 0.5, // [repo postures.ts upstart safetyInvestment]
    raceResponse: 0.5, // [repo postures.ts upstart raceRelaxation]; the spec says "low": today's data says mid (flagged)
  },
  // Analogue DeepSeek. Compute, safety follow-up and race stance belong to the China actor.
  china: {
    computeGrowthPerYear: null, // China's compute meter (actors/china.ts), not the lab's own growth
    funding: 'state', // spec §5; self-funded by High-Flyer at the start [P arXiv 2408.14158, CAST §3]
    releaseLagDays: 45, // [repo rivals.ts:56 deepcent 45] [D]
    releaseCadenceDays: cadence(12), // [repo rivals.ts:58 deepcent 12] [D]
    openness: { mode: 'chinaRung', belowRung: 3 }, // [spec §5: open while China's rung < 3]; MIT-licensed open weights at the start [repo research/10-china.md:270]
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
      // GPT-5 (150.0) ships 7 Aug = 37 days after the start [P eci_scores.csv]. It is ahead of the public frontier by
      // (150.0 - 147.47) / ~1.2 ECI per month = 2.1 months [derived; pace CAST §8].
      internalModel: { rule: 'nextRelease', model: 'GPT-5', lagMonths: -2.1, shipsInDays: 37 },
      computeH100e: 0.82e6, // [derived] 386K -> 1.743M log-linear [P Epoch]
      revenueRunB: 12, // [P company disclosure, CFO: $12B run-rate on 30 Jul 2025; CAST §3 (Confident); 10 on 9 Jun is [press]]
      valuationB: 300, // [P SoftBank press release 1 Apr 2025: $300B post-money]
      equityRaisedB: 34, // [derived from Epoch funding rows; CAST §3]
      headcount: 3000, // [press, unverified] 15 Jul 2025, Epoch Likely
      tools: ['coding', 'research', 'defence', 'creative', 'computerUse', 'memory', 'voiceVision'], // [repo tools.ts shipped, by 2025-07-01]
    },
  },
  {
    id: 'lanternworks', kind: 'safety', name: 'Lanternworks', family: 'Ouvril', analogue: 'Anthropic',
    start: {
      startDate: START,
      publicLagMonths: 3.0, // [P Epoch ECI first crossing: Opus 4 142.85 first crossed by Gemini 2.5 Pro Mar 143.98 on 31 Mar; CAST §1]
      // Claude Opus 4.1 (144.76) ships 5 Aug = 35 days after the start, inside the 120-day release lag [P eci_scores.csv].
      // First crossed by o4-mini 145.21 on 16 Apr = 2.5 months before the start [derived, CAST §1 method].
      internalModel: { rule: 'nextRelease', model: 'Claude Opus 4.1', lagMonths: 2.5, shipsInDays: 35 },
      computeH100e: 0.5e6, // [D] repo back-cast 0.4-0.6M (research/18:102); Epoch end-2025 1.19M [P] is the check
      revenueRunB: 4, // [derived] between $3B on 30 May and $5B on 29 Jul, both company-disclosed [P Epoch revenue CSV]
      valuationB: 61.5, // [P anthropic.com Series E post, 3 Mar 2025]
      equityRaisedB: 16, // [derived from Epoch funding rows; CAST §3]
      headcount: 1350, // [press, unverified] Epoch rows (1,300 on 23 May); the repo's 1,500 is [D]
      tools: ['coding', 'research', 'defence', 'computerUse', 'voiceVision'], // [repo tools.ts shipped]
    },
  },
  {
    id: 'tarnwick', kind: 'bigtech', name: 'Tarnwick', family: 'Davrel', analogue: 'Google DeepMind',
    start: {
      startDate: START,
      publicLagMonths: 2.5, // [P Epoch ECI first crossing: Gemini 2.5 Pro Jun 144.88 first crossed by o4-mini / o3 on 16 Apr; CAST §1]
      internalModel: { rule: 'advanceByReleaseLag' }, // no ECI-listed release within its 60-day lag after the start (Deep Think is not in the file)
      computeH100e: 1.0e6, // [D] repo back-cast (research/18:135); Epoch end-2025 1.583M [P] is the check; the lab's share of Google's compute is wide (CI 1.0-2.5M)
      revenueRunB: null, // not reported separately (inside Google Cloud and Search; CAST §3)
      valuationB: null,
      equityRaisedB: null,
      headcount: 6000, // [press, unverified] WSJ 6 Aug 2025; The Information 5,600 on 19 Mar
      tools: ['coding', 'research', 'creative', 'computerUse', 'memory', 'voiceVision'], // [repo tools.ts shipped]
    },
  },
  {
    id: 'zorvane', kind: 'racer', name: 'Zorvane', family: 'Brask', analogue: 'xAI',
    start: {
      startDate: START,
      publicLagMonths: 6.5, // [P Epoch ECI: Grok-3 mini 139.88 on 24 Jun, first crossed by o1 141.16 on 17 Dec 2024; CAST §1]
      // Grok 4 (146.91, o3 first crossed it on 16 Apr = 2.5 months) ships 9 Jul = 8 days after the start [P eci_scores.csv].
      internalModel: { rule: 'nextRelease', model: 'Grok 4', lagMonths: 2.5, shipsInDays: 8 },
      computeH100e: 0.28e6, // [D] Colossus 1 ~200K GPUs = ~0.28M H100e (repo research/18:102, U/D); Epoch end-2025 0.615M [P] (CI 0.55-0.70M)
      revenueRunB: 0.236, // [press, unverified] Epoch Q2 2025 $59M annualised (Likely)
      valuationB: 150, // [press, unverified] ~$150B at the 30 Jun 2025 raise, "believed, not confirmed" (Epoch Likely)
      equityRaisedB: 17, // [derived] $12B (2024) + $5B equity (Jun 2025); excludes $5B debt and $5B notes [CAST §3, repo research/21:78 U]
      headcount: 300, // [press, unverified] Epoch: 300 non-tutor staff (Mar 2025) plus 900 tutors; the repo's ~1,200 differs (CAST §10)
      tools: ['research', 'creative'], // [repo tools.ts shipped]
    },
  },
  {
    id: 'wolderfield', kind: 'openweights', name: 'Wolderfield', family: 'Hollin', analogue: 'Meta',
    start: {
      startDate: START,
      publicLagMonths: 9.6, // [P Epoch ECI first crossing: Llama 4 Maverick 132.19, o1-preview 133.58 on 12 Sep 2024; CAST §1]
      internalModel: { rule: 'advanceByReleaseLag' }, // no release scheduled within its 60-day lag (Behemoth not released)
      computeH100e: 0.6e6, // [D] repo back-cast (research/18:135); Epoch end-2025 0.996M [P] (CI 0.61-1.64M)
      revenueRunB: null, // not separate (CAST §3)
      valuationB: null,
      equityRaisedB: null,
      headcount: 3400, // [press, unverified] MSL, The Information 17 Jul 2025 (FAIR ~1,000 separate)
      tools: ['creative', 'memory', 'voiceVision', 'companion'], // [repo tools.ts shipped]
    },
  },
  {
    id: 'pellory', kind: 'upstart', name: 'Pellory', family: 'Verrin', analogue: 'SSI, Thinking Machines',
    start: {
      startDate: START,
      publicLagMonths: null, // no public model and no product at the start (CAST §1)
      publicLagBandMonths: 3, // [D] wide band: capability unknown
      internalModel: { rule: 'advanceByReleaseLag' }, // its start lag is the [D] below
      computeH100e: 0.03e6, // [D] repo design placeholder for a spinout: 10-50K H100e rented (research/18:61)
      revenueRunB: 0, // none (CAST §3)
      valuationB: 32, // [press, unverified] SSI $32B, Apr 2025 (TechCrunch); TML $12B was 2 weeks after the start
      equityRaisedB: 3, // [press, unverified] SSI about $3B (repo research/18:61)
      headcount: 30, // [D] between SSI ~20 and TML 29 [press / repo research/18:60]
      tools: [], // none shipped (tools.ts)
    },
  },
  {
    id: 'xuanmu', kind: 'china', name: 'Xuanmu Lab', family: 'Muyi', analogue: 'DeepSeek',
    start: {
      startDate: START,
      publicLagMonths: 6.5, // [P Epoch ECI first crossing: R1-0528 140.73, o1 141.16 on 17 Dec 2024; CAST §1]
      internalModel: { rule: 'advanceByReleaseLag' }, // V3.1 (21 Aug) is 51 days out, past its 45-day lag
      computeH100e: 'china-meter', // China actor's compute meter (actors/china.ts): no number here
      revenueRunB: null, // no Epoch row before 2026
      valuationB: null, // self-funded by High-Flyer
      equityRaisedB: null,
      headcount: 160, // [press, unverified] FT, 14 Mar 2025 (Epoch Likely)
      tools: [], // none shipped (tools.ts)
    },
  },
];

// ───────────────────────────── Public noise (O4; sources CAST-2025.md §8) ─────────────────────────────

/** The rule: public value = true value x a log-normal error with sd `sigmaLn` (additive `sdMonths` for lags), redrawn
 *  when the value is reported; `staleDays` is how far behind the true value the public one is. These are display rules:
 *  every other actor reads the same public value. Values are the lead's recommendation (NPC-LABS §15 O4) [D] on the
 *  published uncertainty named per row. */
export interface NoiseRule { sigmaLn?: number; sdMonths?: number; steps?: number; staleDays: number; cadenceDays: number | 'onRelease' }
export const PUBLIC_NOISE = {
  // sd of the public "months behind" ~1 month [P Epoch ECI credible intervals +-1.5-1.9 pts ~ +-1.4 months, plus source disagreement]
  capabilityLag: { sdMonths: 1, staleDays: 0, cadenceDays: 'onRelease' } satisfies NoiseRule,
  // METR 95% CIs, ln-sd 0.24-0.33 [P metr.org benchmark_results_1_1.yaml]
  taskHorizon: { sigmaLn: 0.3, staleDays: 0, cadenceDays: 'onRelease' } satisfies NoiseRule,
  // Epoch 90% CIs 0.07-0.30 [P chip-users explorer]; China has no published CI [D]
  compute: {
    frontier: { sigmaLn: 0.2, staleDays: 0, cadenceDays: 91 },
    parentFunded: { sigmaLn: 0.3, staleDays: 0, cadenceDays: 91 },
    china: { sigmaLn: 0.5, staleDays: 0, cadenceDays: 91 },
  } satisfies Record<string, NoiseRule>,
  // Epoch's Confident / Likely grades [P epoch.ai records documentation]; about 1 month stale
  revenue: {
    disclosed: { sigmaLn: 0.1, staleDays: 30, cadenceDays: 91 },
    other: { sigmaLn: 0.2, staleDays: 30, cadenceDays: 91 },
  } satisfies Record<string, NoiseRule>,
  // Epoch funding data: priced rounds vs unconfirmed (xAI Jun 2025 "believed, not confirmed")
  valuation: {
    priced: { sigmaLn: 0.05, staleDays: 0, cadenceDays: 'onRelease' },
    unconfirmed: { sigmaLn: 0.2, staleDays: 0, cadenceDays: 'onRelease' },
  } satisfies Record<string, NoiseRule>,
  // Epoch: "not necessarily measured consistently"
  headcount: { sigmaLn: 0.15, staleDays: 0, cadenceDays: 91 } satisfies NoiseRule,
  // FLI grades moved 0.3-0.5 in six months [repo research/07-actors.md:420,422]: +-1 letter step
  safetyGrade: { steps: 1, staleDays: 0, cadenceDays: 'onRelease' } satisfies NoiseRule,
  /** Public facts, shown exactly. */
  exact: ['products', 'prices', 'tools', 'openWeightsReleases', 'incidentsDisclosed', 'roundsAnnounced'] as const,
};
