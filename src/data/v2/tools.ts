// MK-10 (design/MARKET.md M9, M14, "Tools"): the 12 product tools that replaced the product features and the sector
// adaptations. MK-11 switched the engine over: products carry these tools (Deployment.features holds their ids, the
// lab's built ones are player.features), Agent mode gates and sells agent-hours (worldfx/serving.ts productOffer), a
// harness certifies its product in the sectors it covers that have a certification (models/certs.ts), rivals hold the
// tools their lab had shipped by the start (toolsAtStart) plus the lag rule (actors/rivalModel.ts rivalToolStep), and
// the save migration maps built features and adaptations onto them (core/save.ts 105 → 106). INTERNAL_TOOLS (the lab's
// own agents' tools, RD-A06, data/v2/features.ts) are separate.
//
// A tool is built once lab-wide on the build queue (team-weeks + cash, as a feature) and switched on per product.
//  - Harness: fit on a few sectors (a scaffold: +ΔG compute-equivalent OOM on the sector's cognitive work, × tokens per
//    work-hour, the typed form of data/v2/features.ts FeatureFx; §5 "a multiplicative effect on the effective skill gap
//    fits better than a flat bonus"), and certification in the sectors it covers that have one (M14: CERT_SECTORS,
//    CERT_DAYS, CERT_CASH, CERT_FRICTION_CUT below).
//  - General: one of today's feature forms (horizon ×, task enabler share, Chat appeal) or Agent mode (sells autonomous
//    agent-hours, gated on the model's measured time horizon ≥ AGENT_TASK_HOURS).
//
// Conversion of a benchmark gain to ΔG (stated per tool): coverage a_w = σ((F − θ)/s) × P(H) (data/v2/workTypes.ts
// COVER, s = 0.8 OOM), so a success-rate change p0 → p1 on the same model is a logit shift Δℓ = logit p1 − logit p0 and
// ΔG = s·Δℓ = 0.8·Δℓ (the same conversion as P05_ORCHESTRATION in features.ts). A gain from a near-zero base gives a
// large Δℓ that a game-wide fit bonus cannot carry; those are capped and tagged [D].
// The sector adaptation the harnesses replace covered ×(1 + ADAPT_COVER 0.15) of a sector's tasks [D stand-in]; at the
// reference coverage 0.5 that is a: 0.5 → 0.575, Δℓ = 0.302, ΔG = 0.24 (ADAPT_EQUIV_DG): the value of a harness with no
// performance source (Back-office agent, Defence & intelligence suite), so they carry over the adaptation's effect.
//
// Tags: [P] primary source, same model; [P-analogue] primary, but the comparison changes more than the harness;
// [D] design value. Sources: research/MARKET-sources.md §5 (cited "§5"), design/RD-AUDIT/BUILD-NOTES.md RF-P1 (vendor
// pages, checked), research/CAL-products-sources.md (today's feature values).
import type { Channel, SectorId, TraitId } from '../../engine/v2/types';
import type { FeatureFx, FeatureId } from './features';

/** Agent mode needs a measured 50% time horizon at least this long: 2 h, the measured horizon of the model its analogue
 *  launched on [P]: ChatGPT agent (Jul 2025) is o3-class, and METR TH1.1 measures o3 at 120 min
 *  (metr.org/assets/benchmark_results_1_1.yaml). Designer 2026-11-27; it was 4 h [D], the deleted Agents product's gate.
 *  The tasks it sells are work units that long (data/v2/danger.ts CHANNEL_HORIZON_H reads it for the incident site). */
export const AGENT_TASK_HOURS = 2;
/** Sectors with a certification for AI vendors [D: US federal FedRAMP (GOV, MIL: DoD impact levels), health data
 *  HITRUST (HEALTH; HIPAA itself has none: HHS "does not endorse or otherwise recognize private organizations'
 *  'certifications'"), SOC 2 and model-risk review (FIN)]. */
export const CERT_SECTORS: readonly SectorId[] = ['FIN', 'HEALTH', 'GOV', 'MIL'];
/** Certification time (days) from the day a product first carries a harness covering the sector, one constant for all
 *  four sectors. 240 [P, CAL-P]: OpenAI's ChatGPT Enterprise / API got FedRAMP 20x Moderate on 27 Apr 2026, about 8
 *  months after the AI prioritisation opened (Aug 2025; fedramp.gov/ai, openai.com). Range 3-24 months: FedRAMP Rev5
 *  "exceeding one year and at times approaching up to two years" (fedramp.gov, Sep 2025), 20x pilot about 3.5 months, a
 *  first SOC 2 Type II about 6-12 months (research/CAL-products-sources.md C1). */
export const CERT_DAYS = 240;
/** Certification cost ($B), booked when certification starts. $4M [P, CAL-P]: GAO-24-106591: providers' FedRAMP
 *  costs "ranged from $300,000 to $3.7 million", plus the sponsoring agency's $69,000-400,000 (the top of both). The
 *  engineering is the harness's build, not this (research/CAL-products-sources.md C2). */
export const CERT_CASH = 0.004;
/** Friction cut a certification gives its product's buyers in the sector (US): R_s - 0.1 [D] (research/16 §1A.3
 *  "lab-side certification that reduces R_s by 0.1"; for the certified product's buyers only). */
export const CERT_FRICTION_CUT = 0.1;
export const needsCert = (sector: SectorId) => CERT_SECTORS.includes(sector);

export type ProductToolId =
  | 'coding' | 'research' | 'backOffice' | 'clinical' | 'operations' | 'defence' | 'creative'
  | 'agentMode' | 'computerUse' | 'memory' | 'voiceVision' | 'companion';
export type ToolKind = 'harness' | 'general';
/** The four products (MK-1). */
export type ToolProduct = Extract<Channel, 'consumer' | 'api' | 'enterprise' | 'vetted'>;
export const TOOL_PRODUCTS: readonly ToolProduct[] = ['consumer', 'api', 'enterprise', 'vetted'];
/** The labs of the July 2025 world, by the archetype that stands for each (research/07 §2.3; RF-P1). Upstart (SSI /
 *  Thinking Machines) had shipped no product. */
export type LabArchetype = 'leader' | 'safety' | 'bigtech' | 'maverick' | 'openweights' | 'upstart' | 'deepcent';
export const LAB_NAME: Record<LabArchetype, string> = {
  leader: 'OpenAI', safety: 'Anthropic', bigtech: 'Google', maverick: 'xAI', openweights: 'Meta', upstart: 'SSI / TM', deepcent: 'DeepSeek',
};
/** One lab's launch of a tool's analogue. `checked`: the date was read on the vendor's own page (§5 "V", or RF-P1's
 *  vendor-page table); false = §5 "nc", not checked. `counts` false: listed in §5 but not this tool (a research
 *  prototype, an award, a licence for open weights). */
export interface ToolLaunch { date: string; checked: boolean; what: string; counts?: false }

export interface ProductToolDef {
  id: ProductToolId;
  name: string;
  kind: ToolKind;
  /** Real analogue (player-facing flavour). */
  analogue: string;
  /** Tree node that unlocks it (absent = buildable from the start), as FeatureDef.node. */
  node?: string;
  /** Products it can be switched on for. */
  products: ToolProduct[];
  /** Business sectors it helps (a harness: its fit and certification; a general tool: its enabler's sectors). */
  sectors: SectorId[];
  /** Build: team-weeks of engineering and cash ($B), as FeatureDef. Upkeep: toolUpkeepTW. */
  buildTW: number;
  cash: number;
  /** Typed effects (FeatureFx: scaffold, enabler incl. Chat appeal `consumer`, horizon). */
  fx: FeatureFx[];
  /** Agent mode: sells autonomous agent-hours on the product, only with a model whose measured 50% time horizon is at
   *  least this many hours (AGENT_TASK_HOURS). */
  agentGateH?: number;
  /** NPC rule (design/npc/TOOL-REQUIREMENTS.md): a non-player lab may build the tool once its public model's 50% time horizon
   *  (models/capability.ts h50Of) is at least this many minutes; absent = none (GPT-4 class suffices). */
  npcHorizonMin?: number;
  /** RD-P11: affordances added to the product's incident site (as FeatureDef.afford). */
  afford?: number;
  /** Incident hazard × per trait, a stated stand-in (as FeatureDef.hazard; Companion only). */
  hazard?: Partial<Record<TraitId, number>>;
  effect: string;
  risk?: string;
  /** Launches of the analogue by mid-2025 (§5's table; RF-P1 where it checked a date). */
  shipped: Partial<Record<LabArchetype, ToolLaunch>>;
  /** The FeatureId this tool continues (save migration, MK-11). */
  from?: FeatureId;
}

/** ADAPT_COVER 0.15 at the reference coverage 0.5 as ΔG: 0.8 × logit(0.575) = 0.242 (see the header). */
export const ADAPT_EQUIV_DG = 0.24;

export const PRODUCT_TOOLS: ProductToolDef[] = [
  // ───────────── harnesses ─────────────
  {
    id: 'coding', name: 'Coding harness', kind: 'harness', analogue: 'Claude Code, Codex', from: 'codingAgent', npcHorizonMin: 60,
    products: ['api', 'enterprise', 'vetted'], sectors: ['SOFT', 'SCI'], buildTW: 12, cash: 0.1,
    // SOFT: today's Coding agent, +0.3 OOM at ×2 tokens, kept. §5 [P], same model: SWE-bench Verified standard →
    // high-compute scaffold 63.7 → 70.3 (Δℓ 0.30, ΔG 0.24), 72.5 → 79.4 (0.38, 0.30), 72.7 → 80.2 (0.42, 0.34);
    // SWE-bench Lite shell → SWE-agent 11 → 18 (0.57, 0.46). 0.3 sits inside 0.24–0.46.
    // SCI [D]: the harness helps the code and tool-use part of R&D work only: CODE + AGENCY = 0.3 of SCI's 0.8
    // cognitive task weight (data/v2/sectors.ts) = 0.375 × 0.3 ≈ 0.1 OOM, tokens 1 + 0.375 × (2 − 1) ≈ ×1.4.
    fx: [{ kind: 'scaffold', dG: 0.3, tokens: 2, work: ['SOFT'] }, { kind: 'scaffold', dG: 0.1, tokens: 1.4, work: ['SCI'] }],
    effect: 'Harness: an agent that edits, runs and tests code. +0.3 OOM of fit in Software & IT at ×2 tokens; +0.1 OOM in Science R&D (its coding part) at ×1.4 tokens',
    risk: 'Cost per work-hour ×2 in Software & IT (longer agent runs; their incident exposure is in the product usage)',
    shipped: {
      leader: { date: '2025-04-16', checked: true, what: 'Codex CLI (RF-P1); Codex 2025-05-16' },
      safety: { date: '2025-02-24', checked: true, what: 'Claude Code preview; GA 2025-05-22' },
      bigtech: { date: '2025-05-20', checked: true, what: 'Jules beta (RF-P1); Gemini CLI 2025-06-25' },
    },
  },
  {
    id: 'research', name: 'Research agent', kind: 'harness', analogue: 'Deep research', from: 'deepResearch', node: 'P05', npcHorizonMin: 11,
    products: ['api', 'enterprise', 'vetted'], sectors: ['SCI', 'FIN', 'LEGAL'], buildTW: 8, cash: 0.05,
    // Today's Deep research, +0.3 OOM at ×3 tokens, kept. §5: BrowseComp GPT-4o 0.6 → 1.9 with browsing [P, same
    // model]: Δℓ 1.17, ΔG 0.93, from a near-zero base (an enabler-like gain, too large for a fit bonus); GAIA prior
    // best 63.64 → 67.36 [P-analogue, different systems]: Δℓ 0.17, ΔG 0.13. 0.3 sits inside.
    fx: [{ kind: 'scaffold', dG: 0.3, tokens: 3, work: ['SCI', 'FIN', 'LEGAL'] }],
    effect: 'Harness: long research reports from many sources. +0.3 OOM of fit in Science R&D, Finance and Legal at ×3 tokens',
    risk: 'Cost per work-hour ×3 where it applies (long agent runs)',
    shipped: {
      leader: { date: '2025-02-02', checked: true, what: 'Deep research' },
      safety: { date: '2025-04-15', checked: true, what: 'Research (beta; RF-P1)' },
      bigtech: { date: '2024-12-11', checked: true, what: 'Deep Research' },
      maverick: { date: '2025-02', checked: false, what: 'DeepSearch' },
    },
  },
  {
    id: 'backOffice', name: 'Back-office agent', kind: 'harness', analogue: 'support and workflow agents',
    products: ['enterprise', 'vetted'], sectors: ['OFFICE', 'FIN', 'LEGAL', 'GOV', 'EDU'], buildTW: 12, cash: 0.1,
    // [D]: §5 τ-bench gives gpt-4o with native function calling 61.2 retail / 35.2 airline pass^1, "consistently"
    // above text-formatted agents, but the scaffold gain is only in a chart: no same-model number. ΔG = ADAPT_EQUIV_DG
    // (the adaptation it replaces, in ΔG). Tokens ×1.5 [D]: multi-turn tool calls against ticketing / records systems.
    fx: [{ kind: 'scaffold', dG: ADAPT_EQUIV_DG, tokens: 1.5, work: ['OFFICE', 'FIN', 'LEGAL', 'GOV', 'EDU'] }],
    effect: 'Harness: works inside ticketing, records and case systems. +0.24 OOM of fit in Admin & customer service, Finance, Legal, Government and Education at ×1.5 tokens',
    risk: 'Cost per work-hour ×1.5 where it applies',
    shipped: {},
  },
  {
    id: 'clinical', name: 'Clinical assistant', kind: 'harness', analogue: 'medical scribes, decision support',
    products: ['enterprise', 'vetted'], sectors: ['HEALTH'], buildTW: 12, cash: 0.1,
    // §5 [P], same model (o3): off-the-shelf 78.6 → MAI-DxO 81.9 (Δℓ 0.21, ΔG 0.17) → ensemble 85.5 (Δℓ 0.47, ΔG
    // 0.38); "+11 pp on average across models" (at a 0.5 base: Δℓ 0.44, ΔG 0.36). 0.3 inside 0.17–0.38. Tokens ×2
    // [D]: the orchestrator runs a panel of roles per case (no token count published). Healthcare coverage is of its
    // cognitive work only (SECTOR_COG), so the PHYS part is not touched.
    fx: [{ kind: 'scaffold', dG: 0.3, tokens: 2, work: ['HEALTH'] }],
    effect: 'Harness: records, notes and diagnostic reasoning for clinicians. +0.3 OOM of fit in Healthcare at ×2 tokens',
    risk: 'Cost per work-hour ×2 in Healthcare',
    shipped: { bigtech: { date: '2024-01', checked: false, what: 'AMIE (research only)', counts: false } },
  },
  {
    id: 'operations', name: 'Operations planner', kind: 'harness', analogue: 'scheduling, dispatch',
    products: ['enterprise', 'vetted'], sectors: ['MFG', 'LOG', 'ENGY', 'SERV'], buildTW: 12, cash: 0.1,
    // §5 [P], same model: TravelPlanner final pass ×4.6 with an LLM-Modulo critic loop (GPT-4-Turbo ≈ 4.4 → 20.6%; the
    // base is read from Gundawar et al., not checked, §5 gives only the ratio: Δℓ 1.73, ΔG 1.4). Not used as is [D]: a near-zero base and hand-built symbolic critics per domain; capped at the
    // coding harness's 0.3 (the top of the moderate, checking-type gains of §5). Tokens ×3 [D]: the critic loop
    // re-prompts the model several times per plan. Only the sectors' cognitive work (SECTOR_COG).
    fx: [{ kind: 'scaffold', dG: 0.3, tokens: 3, work: ['MFG', 'LOG', 'ENGY', 'SERV'] }],
    effect: 'Harness: plans schedules, routes and stock against hard constraints. +0.3 OOM of fit on the office work of Manufacturing, Logistics, Energy and Retail at ×3 tokens',
    risk: 'Cost per work-hour ×3 where it applies',
    shipped: {},
  },
  {
    id: 'defence', name: 'Defence & intelligence suite', kind: 'harness', analogue: 'Claude Gov, OpenAI for Government',
    products: ['vetted'], sectors: ['MIL', 'GOV'], buildTW: 16, cash: 0.15,
    // [D]: no performance metric exists (§5). ΔG = ADAPT_EQUIV_DG (the Military / Government adaptations it replaces;
    // M14 migration: Military → Vetted's suite), no token change. Its main effect is certification (MIL, GOV). Build
    // as Computer use's (16 TW, $0.15B) [D]: accredited, air-gapped deployments.
    fx: [{ kind: 'scaffold', dG: ADAPT_EQUIV_DG, tokens: 1, work: ['MIL', 'GOV'] }],
    effect: 'Harness: models and tools for classified and accredited environments. +0.24 OOM of fit in Military and Government',
    shipped: {
      leader: { date: '2025-06-16', checked: true, what: 'OpenAI for Government; CDAO award 2025-07-14' },
      safety: { date: '2025-06-06', checked: true, what: 'Claude Gov' },
      bigtech: { date: '2025-07-14', checked: false, what: 'CDAO award' },
      maverick: { date: '2025-07-14', checked: false, what: 'xAI for Government' },
      openweights: { date: '2024-11-04', checked: false, what: 'Llama for US national security (a use licence, not a product)', counts: false },
    },
  },
  {
    id: 'creative', name: 'Creative studio', kind: 'harness', analogue: 'image and video generation', node: 'multimodal',
    products: ['consumer', 'api', 'enterprise'], sectors: ['MEDIA'], buildTW: 12, cash: 0.1,
    // MEDIA: Voice & vision's media enabler moves here unchanged: share 0.15 [D stand-in: images are inside Eloundou et
    // al.'s E2, Arts/Media ~0.37, no separate image number; research/CAL-products-sources.md T2].
    // Chat appeal [P growth, D attribution]: Chatterji et al. 2025 (NBER w34255): "Multimedia" (create / analyse an
    // image, other media) 2% → just over 7% of consumer ChatGPT messages, Jul 2024 → Jun 2025, with "a large spike in
    // April 2025 after ChatGPT released new image generation". The rise (5 points) is credited to generation:
    // 1/(1 − 0.05) − 1 = 0.053; the 2% base stays with Voice & vision (image input). Together 0.073 ≈ today's 0.075.
    fx: [{ kind: 'enabler', sectors: ['MEDIA'], share: 0.15 }, { kind: 'enabler', consumer: true, share: 0.053 }],
    effect: 'Harness: makes images and video. Does the media tasks (an assumed 13% of Media work) offers without it cannot; Chat appeal ×1.053 (image generation took multimedia from 2% to 7% of ChatGPT messages)',
    shipped: {
      leader: { date: '2024-12-09', checked: true, what: 'Sora; 4o image generation 2025-03-25 (V); DALL-E 3 2023-10 (nc)' },
      bigtech: { date: '2025-05-20', checked: false, what: 'Imagen 4 + Veo 3' },
      maverick: { date: '2024-12-09', checked: true, what: 'Aurora' },
      openweights: { date: '2023-12', checked: false, what: 'Imagine' },
      deepcent: { date: '2025-01', checked: false, what: 'Janus-Pro open weights (no product)', counts: false },
    },
  },
  // ───────────── general tools ─────────────
  {
    id: 'agentMode', name: 'Agent mode', kind: 'general', analogue: 'ChatGPT agent', npcHorizonMin: AGENT_TASK_HOURS * 60,
    products: ['api', 'enterprise', 'vetted'], sectors: [], buildTW: 8, cash: 0.05,
    // Sells autonomous agent-hours (today's Agents product, deleted in MK-1) on a product whose model's measured 50%
    // time horizon ≥ AGENT_TASK_HOURS (2 h, see above). §5 SpreadsheetBench o3 23.25 → agent 35.27 and
    // BrowseComp 68.9 vs 51.5 change the model [P-analogue]: no fit bonus, the gate and the hours are the effect.
    // afford +0.3 [D]: the deleted Agents channel's CHANNEL_AFFORD 0.8 over API's 0.5 (data/v2/danger.ts).
    // Build 8 TW, $0.05B [D] (two product launches' LAUNCH_TW).
    fx: [], agentGateH: AGENT_TASK_HOURS, afford: 0.3,
    effect: `Sells agent-hours: the model takes whole tasks and works alone; needs a model with a time horizon of at least ${AGENT_TASK_HOURS} h`,
    risk: 'Affordances +0.3 and half-day tasks run without a person (autonomy in its incident odds)',
    shipped: {
      leader: { date: '2025-07-17', checked: true, what: 'ChatGPT agent' },
      bigtech: { date: '2025-05-20', checked: false, what: 'Agent Mode announced, not shipped', counts: false },
    },
  },
  {
    id: 'computerUse', name: 'Computer use', kind: 'general', analogue: 'Operator, Claude computer use', from: 'computerUse', node: 'P06', npcHorizonMin: 20,
    products: ['api', 'enterprise', 'vetted'], sectors: ['OFFICE', 'FIN', 'LEGAL', 'GOV'], buildTW: 16, cash: 0.15,
    // Today's Computer use, kept: enabler share 0.15 [D stand-in, bounded by Eloundou et al. 2023's zeta − alpha 0.43–
    // 0.63; research/CAL-products-sources.md T1], afford +0.25. §5 OSWorld (Agent S2 over bare Claude 3.7 Sonnet,
    // 15.5 → 27.0 / 26.0 → 34.5, +8–12 pp, [P]) measures how well GUI tasks go, not which share needs a GUI: no change.
    fx: [{ kind: 'enabler', sectors: ['OFFICE', 'FIN', 'LEGAL', 'GOV'], share: 0.15 }], afford: 0.25,
    effect: 'Task enabler: operates desktops and browsers, so it does the GUI-only tasks (an assumed 13% of the work) in Admin, Finance, Legal and Government that offers without it cannot',
    risk: 'Affordances +0.25 (acts on desktops and websites): raises the odds of incidents that need real access (overreach, cover-ups)',
    shipped: {
      leader: { date: '2025-01-23', checked: true, what: 'Operator' },
      safety: { date: '2024-10-22', checked: true, what: 'computer use (API beta)' },
      bigtech: { date: '2025-05-20', checked: true, what: 'Mariner in AI Ultra (RF-P1; prototype 2024-12-11)' },
    },
  },
  {
    id: 'memory', name: 'Memory', kind: 'general', analogue: 'ChatGPT memory', from: 'memory', node: 'P07',
    products: ['consumer', 'api', 'enterprise', 'vetted'], sectors: [], buildTW: 12, cash: 0.1,
    // Today's Memory, kept: horizon ×1.3 [D stand-in, no measurement; research/CAL-products-sources.md T3]. §5
    // LongMemEval "about −30%" accuracy without memory design [P-analogue] is recall, not task length.
    fx: [{ kind: 'horizon', mult: 1.3, work: 'all' }],
    effect: 'Horizon extender: time horizon ×1.3 on all work in this product (assumed, no measurement exists)',
    risk: 'Longer tasks alone: the time horizon ×1.3 also lengthens the tasks the model runs without a person (autonomy in its incident odds)',
    shipped: {
      leader: { date: '2024-02-13', checked: true, what: 'memory (test; all tiers 2024-09-05)' },
      bigtech: { date: '2025-02-13', checked: true, what: 'past chats (Gemini Advanced)' },
      openweights: { date: '2025-01-27', checked: true, what: 'Meta AI memory (RF-P1)' },
      maverick: { date: '2025-04', checked: false, what: 'memory (low confidence; RF-P1 found no primary source)', counts: false },
    },
  },
  {
    id: 'voiceVision', name: 'Voice & vision', kind: 'general', analogue: 'Advanced Voice, Gemini Live', from: 'voiceVision', node: 'multimodal',
    // Chat only (designer, MK-11): no sector effect on the business products (no source), so API, Enterprise and Vetted
    // do not offer it; the save migration drops it there.
    products: ['consumer'], sectors: [], buildTW: 12, cash: 0.1,
    // Chat appeal 0.02 [P base, D attribution]: the pre-image-generation multimedia share, 2% of consumer ChatGPT
    // messages in Jul 2024 (NBER w34255; image analysis and other media), 1/(1 − 0.02) − 1. Voice has no message
    // share (a mode, not a topic). The Media work moved to Creative studio. No sector effect on the business products
    // (no source).
    fx: [{ kind: 'enabler', consumer: true, share: 0.02 }],
    effect: 'Talks and sees: voice and image input. Chat appeal ×1.02 (image and media requests were 2% of ChatGPT messages before image generation)',
    shipped: {
      leader: { date: '2023-09-25', checked: true, what: 'see, hear and speak; Advanced Voice 2024-09-24' },
      safety: { date: '2025-05-27', checked: true, what: 'voice beta (vision 2024-03-04)' },
      bigtech: { date: '2024-08-13', checked: true, what: 'Gemini Live' },
      openweights: { date: '2024-09-25', checked: true, what: 'Meta AI voice (RF-P1)' },
      maverick: { date: '2025-02', checked: false, what: 'voice (low confidence; RF-P1 found no dated primary source)', counts: false },
    },
  },
  {
    id: 'companion', name: 'Companion', kind: 'general', analogue: 'AI Studio characters', from: 'companion', node: 'engagement',
    products: ['consumer'], sectors: [], buildTW: 4, cash: 0.05,
    // Today's Companion mode, kept: appeal 0.025 [P] (NBER w34255: 2.4% of ChatGPT messages relationships, reflection,
    // role play; research/CAL-products-sources.md T4); sycophancy ×1.5 [D stand-in: longer personal conversations].
    fx: [{ kind: 'enabler', consumer: true, share: 0.025 }], hazard: { SYC: 1.5 },
    effect: 'A persistent persona: Chat appeal ×1.025 (relationships, reflection and role play were 2.4% of ChatGPT messages in 2025)',
    risk: 'Sycophancy incidents ×1.5 [D stand-in: longer personal conversations per user]',
    shipped: { openweights: { date: '2024-07-29', checked: true, what: 'AI Studio characters (RF-P1)' } },
  },
];
export const PRODUCT_TOOL_BY_ID = Object.fromEntries(PRODUCT_TOOLS.map((t) => [t.id, t])) as Record<ProductToolId, ProductToolDef>;

/** M14: the sectors where a product carrying harness t is certified (after CERT_DAYS, at CERT_CASH each, cutting its
 *  buyers' friction there by CERT_FRICTION_CUT): the harness's sectors that have a certification (CERT_SECTORS). */
export const toolCertSectors = (t: ProductToolDef): SectorId[] => (t.kind === 'harness' ? t.sectors.filter((x) => CERT_SECTORS.includes(x)) : []);
export const toolCertTerms = () => ({ days: CERT_DAYS, cash: CERT_CASH, frictionCut: CERT_FRICTION_CUT });
/** Model v3 C2 [D]: upkeep of a built tool in team-weeks per week: half its build team-weeks a year while in use, a
 *  tenth of that while built but off everywhere (departments/build.ts featureUpkeepTW reads these; also the internal
 *  tools'). Here, not in build.ts, so that this data file imports no engine module. */
export const TOOL_UPKEEP = { yr: 0.5, idle: 0.1 } as const;
export const toolUpkeepTW = (t: { buildTW: number }, inUse = true) => ((TOOL_UPKEEP.yr * t.buildTW) / 52) * (inUse ? 1 : TOOL_UPKEEP.idle);

/** The rival rule's cut-off: a lab starts with a tool if its real counterpart had shipped it by the game's start
 *  (RF-P1, "by 2025-07-01": public, a paid tier or a public beta). A tool no lab had follows TOOL_LAG_DAYS. */
export const TOOL_START_CUTOFF = '2025-07-01';
/** Whether lab `a` had shipped tool t by `cutoff` (ISO date prefix compare; a month-only date counts as its first day). */
export function shippedBy(t: ProductToolDef, a: LabArchetype, cutoff = TOOL_START_CUTOFF): boolean {
  const l = t.shipped[a];
  return !!l && l.counts !== false && l.date <= cutoff;
}
/** The tools each lab starts with (rivals and China at creation: actors/rivals.ts, actors/china.ts). */
export const toolsAtStart = (a: LabArchetype, cutoff = TOOL_START_CUTOFF): ProductToolId[] =>
  PRODUCT_TOOLS.filter((t) => shippedBy(t, a, cutoff)).map((t) => t.id);

/** Save migration (MK-11): the tool each of today's features continues. */
export const TOOL_FROM_FEATURE: Record<FeatureId, ProductToolId> = {
  memory: 'memory', computerUse: 'computerUse', voiceVision: 'voiceVision', deepResearch: 'research', codingAgent: 'coding', companion: 'companion',
};
/** Save migration (M14): the harness a sector adaptation on a product of channel `ch` moves to: the harness covering
 *  the sector that the product can carry (Military → Vetted's Defence & intelligence suite; Government on Vetted →
 *  the suite, on Enterprise → Back-office agent; Science → Research agent before Coding harness). */
export function harnessForAdaptation(sector: SectorId, ch: Channel): ProductToolId | undefined {
  const order: ProductToolId[] = ['defence', 'clinical', 'research', 'backOffice', 'operations', 'creative', 'coding'];
  return order.find((id) => {
    const t = PRODUCT_TOOL_BY_ID[id];
    return t.sectors.includes(sector) && (t.products as Channel[]).includes(ch);
  });
}
