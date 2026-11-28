// Positions and lab kinds (design/corp/CORPORATE.md §6; STRUCTURE §4.8, §4.1; research/18 §5–§6; BUILD-PLAN R9). Owner: WS1.
//
// A POSITION is what a lab starts with: teams, model lag, compute, cash, products, and the knobs that follow from it
// (credibility, exploit multiplier, cloud provider, credit line, whether it plays catch-up). A LAB KIND is a position
// plus a charter, a cap table, the partners it starts with and the NPC lab it replaces. All kinds use the same rules.
// The frontier position is today's start and the calibration anchor: its row below is the lab's start (cash, revenue,
// compute, teams, security level); the initialisers (finance/ledger.ts, compute/sites.ts …) read it. The other four are
// built from this table (core/starts.ts), with the NPC labs of the cast in the world (D1). Difficulty is a label only;
// scoring is the same for every start. [D] derivation, [Design] game choice (research/18 tags).
import type { Channel, Column, CustomKind, LabKindId, PositionId, TeamDept, TeamKey } from '../../engine/v2/types';
import type { ToolId } from './features';
import type { ProductToolId } from './tools';
import type { NpcKindId } from './npcLabs';
import { PRE_GAME_G_PER_YEAR } from './runDesign';
import { LEGACY_NORTHWIND } from './deals';

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Impossible';

/** A live product at the start: channel, share of the serving pool, the product tools switched on for it. */
export interface StartProduct { channel: Exclude<Channel, 'internal' | 'open'>; servingShare: number; features?: ProductToolId[] }

/** A cap table: founder, mission body, financial investors, strategic partners (and which partners' shares vote). */
export interface CapTable { founder: number; mission?: number; fin: number; strat?: Record<string, number>; stratVoting?: Record<string, true> }

/** A partner holding from before the start: a deal with no running terms (the stake itself is in the cap table). */
/** A partner stake from before the start. `revenueShare` and `until` (an ISO date) are its running string, if any (C7c: Northwind's share of all revenue). */
export interface LegacyDeal { id: string; partner: string; day: number; revenueShare?: number; until?: string }

export interface PositionDef {
  id: PositionId;
  name: string;
  /** Setup label (STRUCTURE §4.8 Q11), set from bot games (PROGRESS R9; bots.ts --start, 40 seeds × 5 bots): best
   *  bot's win rate ≥ 30% Easy, 10–30% Medium, 1–10% Hard, < 1% Impossible. R9 data: leader 48% (mixed), challenger 5%
   *  (race), big tech 0/200, spinout 0/200. To be re-measured from the best bot at the checkpoint (CORPORATE.md §6.1);
   *  the capital and scratch labels are placeholders until then. */
  difficulty: Difficulty;
  /** Teams by key (STRUCTURE §4.1 start table; fixed sizes 100 / 50 / 20, L15). */
  teams: Record<TeamKey, number>;
  /** Science specialties in hiring order per department (follow the analogues). */
  specialties: Record<TeamDept, Column[]>;
  /** Extra tree nodes known at the start, beyond the ★ nodes (research/18 §5). Paradigm nodes are never granted (the
   *  frontier start, the calibration anchor, researches them) and nodes whose prerequisites are not known are skipped. */
  known: string[];
  /** Live products and the product tools built at the start. RF-P1: the tools the analogue lab had shipped by 2025-07-01
   *  (frontier OpenAI, contender Anthropic, capital Google; sources: design/archive/RD-AUDIT/BUILD-NOTES.md RF-P1). MK-11: the old
   *  features mapped to tools (data/v2/tools.ts TOOL_FROM_FEATURE); Voice & vision is Chat-only, so its media work on
   *  the API moved to Creative studio where the analogue had shipped image generation (OpenAI, Google; not Anthropic). */
  products: StartProduct[];
  features: ProductToolId[];
  /** RD-A06 internal tools at the start (the start's internal agents; RF-P1 keeps them as they were when they followed
   *  the start's features). */
  tooling: ToolId[];
  /** Cash on hand ($B), revenue run-rate ($B/yr) and the last four quarterly run-rates (oldest first). */
  cash: number;
  revenueRun: number;
  revenueHistory: number[];
  /** Compute owned (installed in live sites) and rented (cloud contract), H100e. */
  owned: number;
  rented: number;
  /** The owned compute sits in grid campuses already built and paid for (no rent), whoever owns the company; absent: in a
   *  rented hall. Capital-heavy only [D: xAI's Colossus was built before mid-2025]. */
  ownedCampusesPaid?: true;
  /** Months behind the leader on the capabilities index (research/18 §0.1): the start model's lag. */
  lagMonths: number;
  /** D6: the start model is an imported open-weight model (post-trainable, not sellable as is). */
  imported?: boolean;
  /** Modifiers (research/18 §6). talentPull: the position's hiring pull (departments/market.ts pullOf; frontier 10).
   *  (FIN2 removed patientQ with the board's revenue plan.) */
  mods: { talentPull: number };
  /** Weight-security level at the start. */
  securityLevel: number;
  /** Credibility with investors at the start (finance/promises.ts). */
  credibility: number;
  /** The start suites' exploitability multiplier (models/suites.ts startSuites): a cheap, unhardened start is above 1. */
  exploitMult: number;
  /** Who rents the start cloud contract, and when it ends (ISO date). */
  provider: string;
  cloudEnd: string;
  /** A bank revolver sized from the story valuation (finance/story.ts startStory); the frontier's is the fixed $4B one. */
  creditLine: boolean;
  /** Plays catch-up: the autopilot and the bots start from their own compute and scale to the reference path
   *  (finance/plan.ts followerOpts, bots/common.ts sizedTarget, bots/ref.ts). */
  follower: boolean;
}

export interface LabKindDef {
  id: LabKindId | 'custom';
  name: string;
  analogues: string;
  /** One line of character for the Setup picker. */
  character: string;
  position: PositionId;
  /** The charter's start flags (design/corp/CORPORATE.md §2): a mission body, a profit cap. */
  charter: { missionBody?: boolean; profitCap?: boolean };
  /** The full cap table, and which partners' shares vote (control.ts: the votes, seats and controller follow from it). */
  ownership: CapTable;
  /** Partner stakes held from before the start (non-voting legacy stakes with their real strings). */
  legacyDeals?: LegacyDeal[];
  /** The NPC lab this kind replaces in the cast (npc/lab.ts usCast): the player takes its place. */
  replacesNpc?: NpcKindId;
}

// Values from the old 'AI 2027 Classic' baseline; to re-source against reality (handed to bal): the frontier row's cash 40,
// revenueRun 12, revenueHistory, owned + rented compute 1.2M, teams, and every position's securityLevel 2.4.
export const POSITIONS: PositionDef[] = [
  {
    id: 'frontier', name: 'Frontier', difficulty: 'Easy',
    // The frontier's start state: cash, revenue and teams are read from this row; the sites, orders and cloud contract are in compute/sites.ts and orders.ts.
    teams: { eng: 6, 're.cap': 21, 'sci.cap': 14, 're.saf': 1, 'sci.saf': 1 },
    specialties: { cap: [], saf: [] },
    known: [],
    products: [
      { channel: 'consumer', servingShare: 0.45, features: ['memory', 'voiceVision', 'creative'] },
      { channel: 'api', servingShare: 0.35, features: ['computerUse', 'coding', 'creative'] },
      { channel: 'enterprise', servingShare: 0.2, features: ['memory', 'research'] },
    ],
    features: ['memory', 'computerUse', 'voiceVision', 'research', 'coding', 'creative'],
    tooling: [],
    cash: 40, revenueRun: 12, revenueHistory: [4.5, 6, 8, 10],
    owned: 500e3, rented: 700e3,
    lagMonths: 0,
    mods: { talentPull: 10 },
    securityLevel: 2.4,
    credibility: 60, exploitMult: 1, provider: 'Northwind Cloud', cloudEnd: '2028-07-01', creditLine: false, follower: false,
  },
  {
    id: 'contender', name: 'Contender', difficulty: 'Hard',
    // Model v3 V3b: 4 engineering teams (was 3) [D]: at 2025 AI coverage (build capacity ≈ ×1.1 the engineers) three
    // teams could not carry the start products' upkeep plus a base run setup in the first quarter.
    teams: { eng: 6, 're.cap': 14, 'sci.cap': 8, 're.saf': 2, 'sci.saf': 2 }, // L15: the same people (600 / 700 + 100 / 160 + 40) in teams of 100 / 50 / 20
    specialties: { cap: ['posttraining', 'pretraining', 'systems', 'posttraining'], saf: ['interp', 'alignment', 'evals'] },
    known: ['rl.swe', 'multimodal', 'T-PROBE', 'T-SAE'],
    products: [
      { channel: 'consumer', servingShare: 0.3, features: ['voiceVision'] },
      { channel: 'api', servingShare: 0.45, features: ['computerUse', 'coding'] },
      { channel: 'enterprise', servingShare: 0.25, features: ['research'] },
    ],
    features: ['computerUse', 'voiceVision', 'research', 'coding'],
    tooling: ['codingHarness'],
    cash: 8, revenueRun: 3, revenueHistory: [1, 1.5, 2, 2.5],
    owned: 100e3, rented: 300e3,
    lagMonths: 3,
    mods: { talentPull: 20 },
    securityLevel: 2.4,
    credibility: 50, exploitMult: 1, provider: 'Azimuth', cloudEnd: '2028-07-01', creditLine: true, follower: true,
  },
  {
    id: 'talent', name: 'Talent breakaway', difficulty: 'Impossible',
    // 290 people (analogues ≈ 110, rounded up to whole teams; STRUCTURE §4.1). L15: the same people in whole teams of
    // 100 / 50 / 20 (was one team each of 150 / 100 / 40: 150 → 1 (the tie rounds down), 100 → 2, 40 → 2).
    teams: { eng: 1, 're.cap': 2, 'sci.cap': 2, 're.saf': 0, 'sci.saf': 0 },
    specialties: { cap: ['posttraining', 'pretraining', 'systems'], saf: ['alignment', 'interp', 'evals'] },
    known: ['rl.math', 'T-PROBE'],
    products: [], features: [], tooling: [],
    // Valued through position (FIN5a): no public model, so investors place it at the best open-weight model (SSI $32B
    // and TML $12B with no product [R21 A8]).
    cash: 3, revenueRun: 0, revenueHistory: [0, 0, 0, 0],
    owned: 0, rented: 25e3,
    lagMonths: 6.5, imported: true,
    mods: { talentPull: 30 },
    securityLevel: 2.4,
    credibility: 40, exploitMult: 2.5, provider: 'Vantage Neocloud', cloudEnd: '2027-07-01', creditLine: true, follower: true,
  },
  {
    id: 'capital', name: 'Capital-heavy', difficulty: 'Impossible',
    teams: { eng: 10, 're.cap': 36, 'sci.cap': 22, 're.saf': 2, 'sci.saf': 2 }, // L15: the same people (1,050 → 10.5, the tie rounds down to 10 teams, 1,800 + 100, 440 + 40) in teams of 100 / 50 / 20
    specialties: { cap: ['pretraining', 'systems', 'posttraining', 'pretraining', 'systems', 'posttraining', 'pretraining', 'systems', 'posttraining', 'pretraining', 'systems'], saf: ['interp', 'alignment', 'evals'] },
    known: ['multimodal', 'rl.math'],
    products: [
      { channel: 'consumer', servingShare: 0.55, features: ['memory', 'voiceVision', 'creative'] },
      { channel: 'api', servingShare: 0.2, features: ['computerUse', 'coding', 'creative'] },
      { channel: 'enterprise', servingShare: 0.25, features: ['memory', 'research'] },
    ],
    features: ['memory', 'computerUse', 'voiceVision', 'research', 'coding', 'creative'],
    tooling: [],
    // $20B on hand [D: xAI raised about $10B in mid-2025 plus Colossus; a market-funded capital-heavy lab needs cash]. A
    // division also gets the parent's first quarterly budget on top (finance/parent.ts). Revenue (~$4B attributed).
    cash: 20, revenueRun: 4, revenueHistory: [2.5, 3, 3.5, 3.8],
    owned: 800e3, rented: 0, ownedCampusesPaid: true,
    lagMonths: 6,
    mods: { talentPull: 0 },
    securityLevel: 2.4,
    credibility: 50, exploitMult: 1, provider: 'Northwind Cloud', cloudEnd: '2028-07-01', creditLine: true, follower: true,
  },
  {
    // From scratch [D, all values]: a small founding team on rented compute and an imported open-weight model.
    id: 'scratch', name: 'From scratch', difficulty: 'Impossible',
    teams: { eng: 1, 're.cap': 1, 'sci.cap': 1, 're.saf': 0, 'sci.saf': 0 },
    specialties: { cap: ['posttraining', 'pretraining', 'systems'], saf: ['alignment', 'interp', 'evals'] },
    known: [],
    products: [], features: [], tooling: [],
    cash: 1, revenueRun: 0, revenueHistory: [0, 0, 0, 0],
    owned: 0, rented: 5e3,
    lagMonths: 12, imported: true,
    mods: { talentPull: 0 },
    securityLevel: 2.4,
    credibility: 40, exploitMult: 2.5, provider: 'Vantage Neocloud', cloudEnd: '2027-07-01', creditLine: true, follower: true,
  },
];

export const POSITION_BY_ID = Object.fromEntries(POSITIONS.map((x) => [x.id, x])) as Record<PositionId, PositionDef>;

/** The six lab kinds (CORPORATE.md §6.2; names invented, analogues in the tooltips). Cap tables marked [D] are designer
 *  choices; the leader's, the breakaway's and the legacy partner stakes are today's. */
export const LAB_KINDS: LabKindDef[] = [
  {
    id: 'leader', name: 'Frontier leader', analogues: 'OpenAI (mid-2025)',
    character: 'Everything now: the best model, the most compute and revenue; a fragile board and the largest commitments.',
    position: 'frontier', charter: { missionBody: true, profitCap: true },
    // The nonprofit's stake and the legacy Northwind stake (Microsoft-like, ~27%, non-voting) [R15].
    ownership: { founder: 0.3, mission: 0.26, fin: 0.17, strat: { 'Northwind Cloud': 0.27 } },
    legacyDeals: [{ id: 'DL-northwind0', partner: 'Northwind Cloud', day: -2000, revenueShare: LEGACY_NORTHWIND.revenueShare, until: LEGACY_NORTHWIND.until }],
    replacesNpc: 'leader',
  },
  {
    id: 'safety', name: 'Safety-first contender', analogues: 'Anthropic (mid-2025)',
    character: 'Near the frontier with real revenue and a mission board; you must raise about once a year to keep up.',
    position: 'contender', charter: { missionBody: true },
    // [D] a mission body of a tenth, the cloud-and-chips partner's non-voting stake, investors the rest.
    ownership: { founder: 0.3, mission: 0.1, fin: 0.46, strat: { Azimuth: 0.14 } },
    legacyDeals: [{ id: 'DL-start0', partner: 'Azimuth', day: -400 }],
    replacesNpc: 'safety',
  },
  {
    id: 'racer', name: 'Founder racer', analogues: 'xAI (mid-2025)',
    character: 'Founders in charge with big compute and a large user base; the model is behind and the money is investors\'.',
    position: 'capital', charter: {},
    ownership: { founder: 0.6, fin: 0.4 }, // [D] founder-majority
    replacesNpc: 'racer',
  },
  {
    id: 'bigtech', name: 'Big-tech AI division', analogues: 'Google DeepMind, Meta, Microsoft AI',
    character: 'Compute and distribution, and you cannot go broke; a yearly budget from the parent, cut when you miss its goals, and a weak pull on talent.',
    position: 'capital', charter: {},
    // Azimuth owns the division outright, with voting shares: it is the controller (control.ts ownerFunded).
    ownership: { founder: 0, fin: 0, strat: { Azimuth: 1 }, stratVoting: { Azimuth: true } },
    replacesNpc: 'bigtech',
  },
  {
    id: 'breakaway', name: 'Talent breakaway', analogues: 'Anthropic 2021, SSI, Thinking Machines',
    character: 'Elite founders and patient money; no compute, no product, no revenue, and an open-weight model to start from.',
    position: 'talent', charter: {},
    ownership: { founder: 0.75, fin: 0.25 },
    replacesNpc: 'upstart',
  },
  {
    id: 'newcomer', name: 'Newcomer', analogues: 'a 2025 startup',
    character: 'A handful of founders, seed money and a downloaded model; the hardest way to begin.',
    position: 'scratch', charter: {},
    ownership: { founder: 0.85, fin: 0.15 }, // [D]
  },
];

export const LAB_KIND_BY_ID = Object.fromEntries(LAB_KINDS.map((x) => [x.id, x])) as Record<LabKindId, LabKindDef>;

/** The custom kind's cap-table presets (CORPORATE.md §6.2) [D]. A mission body takes a tenth from the founders'
 *  share (not under 'wholly': Azimuth owns it all). A custom kind replaces no NPC lab. */
const CUSTOM_TABLES: Record<CustomKind['capTable'], CapTable> = {
  founderMajority: { founder: 0.6, fin: 0.4 },
  investorHeavy: { founder: 0.35, fin: 0.65 },
  wholly: { founder: 0, fin: 0, strat: { Azimuth: 1 }, stratVoting: { Azimuth: true } },
};
export function customKind(c: CustomKind): LabKindDef {
  const t = CUSTOM_TABLES[c.capTable];
  const mission = c.charter.missionBody && c.capTable !== 'wholly' ? 0.1 : 0;
  return {
    id: 'custom', name: 'Custom lab', analogues: '', character: 'Your own structure.', position: c.position, charter: { ...c.charter },
    ownership: { ...t, founder: t.founder - mission, ...(mission ? { mission } : {}), ...(t.strat ? { strat: { ...t.strat } } : {}), ...(t.stratVoting ? { stratVoting: { ...t.stratVoting } } : {}) },
  };
}

/** A start's lag behind the leader's day-0 model in OOM of G: its months behind at the stated pre-game pace (RD-L03; 0 for the
 *  frontier). core/init.ts solves the start recipe lag from it; the know-how scale (npc/shocks.ts knowhowAt) places the start on the reference clock. */
export const startLagG = (p: Pick<PositionDef, 'lagMonths'>): number => (p.lagMonths / 12) * PRE_GAME_G_PER_YEAR;
/** Setup picker order: the frontier leader (today's game) first, the hardest last. */
export const KIND_ORDER: LabKindId[] = ['leader', 'safety', 'racer', 'bigtech', 'breakaway', 'newcomer'];
type SetupLike = { setup: { labKind?: LabKindId | 'custom'; custom?: CustomKind } };
const CUSTOM_DEFAULT: CustomKind = { position: 'frontier', charter: {}, capTable: 'founderMajority' };
/** The player's lab kind: its charter, cap table, partners and the NPC lab it replaces. */
export const kindOf = (s: SetupLike): LabKindDef => {
  const k = s.setup.labKind ?? 'leader';
  return k === 'custom' ? customKind(s.setup.custom ?? CUSTOM_DEFAULT) : LAB_KIND_BY_ID[k];
};
/** The player's position: what it starts with. */
export const positionOf = (s: SetupLike): PositionDef => {
  const k = s.setup.labKind ?? 'leader';
  return POSITION_BY_ID[k === 'custom' ? (s.setup.custom ?? CUSTOM_DEFAULT).position : LAB_KIND_BY_ID[k].position];
};
/** Transitional alias for finance/board.ts (owned by the C3 task), which still reads startOf(s).lagMonths: C3 or the
 *  cleanup task renames that call to positionOf and deletes this. */
export const startOf = positionOf;

/** Big-tech parent budget ($B per game year, Jul–Jun; research/18 §3.2): $16B in year one (the leader's 2025 compute
 *  spend in the AI 2027 compute forecast), growing with the parent's capex path — Alphabet 52.5 → 91.4 → ~180 in
 *  2024–26 (≈ ×1.75/yr) for three years, then ×1.3/yr as hyperscaler capex growth slows [D]. This is the parent's plan: the
 *  budget it sets at each yearly review is the plan × a factor read off parent confidence (FIN5c, finance/parent.ts). */
export const PARENT_BUDGET = { year0: 16, fastGrowth: 1.75, fastYears: 3, slowGrowth: 1.3 };
export function parentBudgetYear(y: number): number {
  const fast = Math.min(Math.max(0, y), PARENT_BUDGET.fastYears);
  const slow = Math.max(0, y - PARENT_BUDGET.fastYears);
  return PARENT_BUDGET.year0 * PARENT_BUDGET.fastGrowth ** fast * PARENT_BUDGET.slowGrowth ** slow;
}
