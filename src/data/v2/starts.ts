// Start types (STRUCTURE §4.8, §4.1; research/18 §5–§6; BUILD-PLAN R9, decisions D1 and D6). Owner: WS1.
//
// All four starts use the same rules; only the start state differs. The frontier-leader start is today's start and
// the calibration anchor: its row below is the lab's start (cash, revenue, compute, teams, security level) and the
// initialisers (finance/ledger.ts, compute/sites.ts …) read it. The other three are built from this table, with the
// simulated AI 2027 leader lab added to the world (D1). Difficulty is a label only; scoring is the same for every start.
// [D] derivation, [Design] game choice (research/18 tags).
import type { Channel, Column, StartType, TeamDept, TeamKey } from '../../engine/v2/types';
import type { ToolId } from './features';
import type { ProductToolId } from './tools';
import { PRE_GAME_G_PER_YEAR } from './runDesign';

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Impossible';

/** A live product at the start: channel, share of the serving pool, the product tools switched on for it. */
export interface StartProduct { channel: Exclude<Channel, 'internal' | 'open'>; servingShare: number; features?: ProductToolId[] }

export interface StartDef {
  id: StartType;
  name: string;
  /** Setup label (STRUCTURE §4.8 Q11), set from bot games (PROGRESS R9; bots.ts --start, 40 seeds × 5 bots): best
   *  bot's win rate ≥ 30% Easy, 10–30% Medium, 1–10% Hard, < 1% Impossible. R9 data: leader 48% (mixed), challenger 5%
   *  (race), big tech 0/200, spinout 0/200. Proposed labels (STRUCTURE: challenger and big tech Medium, spinout Hard)
   *  were lowered to the data; revisit when follower catch-up is redesigned. */
  difficulty: Difficulty;
  /** One line of character for the Setup picker. */
  character: string;
  analogues: string;
  /** D1: the simulated AI 2027 leader lab is in the world (on for every start but the leader's). */
  leaderLab: boolean;
  /** Teams by key (STRUCTURE §4.1 start table; fixed sizes 100 / 50 / 20, L15). */
  teams: Record<TeamKey, number>;
  /** Science specialties in hiring order per department (follow the analogues). */
  specialties: Record<TeamDept, Column[]>;
  /** Extra tree nodes known at the start, beyond the ★ nodes (research/18 §5). Paradigm nodes are never granted (the
   *  leader start, the calibration anchor, researches them) and nodes whose prerequisites are not known are skipped. */
  known: string[];
  /** Live products and the product tools built at the start. RF-P1: the tools the analogue lab had shipped by 2025-07-01
   *  (leader OpenAI, challenger Anthropic, big tech Google; sources: design/archive/RD-AUDIT/BUILD-NOTES.md RF-P1). MK-11: the old
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
  /** Ownership split (founder, mission body, financial, strategic partners) and which partners' shares vote (control.ts:
   *  the votes, seats and controller follow from it). */
  ownership: { founder: number; mission?: number; fin: number; strat?: Record<string, number>; stratVoting?: Record<string, true> };
  /** Compute owned (installed in live sites) and rented (cloud contract), H100e. */
  owned: number;
  rented: number;
  /** The charter's start flags (design/corp/CORPORATE.md §2): a mission body, a profit cap. */
  charter: { missionBody?: boolean; profitCap?: boolean };
  /** Months behind the leader on the capabilities index (research/18 §0.1): the start model's lag. */
  lagMonths: number;
  /** D6: the start model is an imported open-weight model (post-trainable, not sellable as is). */
  imported?: boolean;
  /** Modifiers (research/18 §6). talentPull: the start type's hiring pull (departments/market.ts pullOf; leader 10).
   *  (FIN2 removed patientQ with the board's revenue plan.) */
  mods: { talentPull: number };
  /** Weight-security level at the start. */
  securityLevel: number;
}

// Values from the old 'AI 2027 Classic' baseline; to re-source against reality (handed to bal): the leader row's cash 40,
// revenueRun 12, revenueHistory, owned + rented compute 1.2M, teams, and every start's securityLevel 2.4.
export const STARTS: StartDef[] = [
  {
    id: 'spinout', name: 'Well-funded spinout', difficulty: 'Impossible', analogues: 'Anthropic 2021, SSI, Thinking Machines',
    character: 'Elite founders and patient money; no compute, no product, no revenue, and an open-weight model to start from.',
    leaderLab: true,
    // 290 people (analogues ≈ 110, rounded up to whole teams; STRUCTURE §4.1). L15: the same people in whole teams of
    // 100 / 50 / 20 (was one team each of 150 / 100 / 40: 150 → 1 (the tie rounds down), 100 → 2, 40 → 2).
    teams: { eng: 1, 're.cap': 2, 'sci.cap': 2, 're.saf': 0, 'sci.saf': 0 },
    specialties: { cap: ['posttraining', 'pretraining', 'systems'], saf: ['alignment', 'interp', 'evals'] },
    known: ['rl.math', 'T-PROBE'],
    products: [], features: [], tooling: [],
    // Valued through position (FIN5a): no public model, so investors place it at the best open-weight model (SSI $32B
    // and TML $12B with no product [R21 A8]).
    cash: 3, revenueRun: 0, revenueHistory: [0, 0, 0, 0],
    ownership: { founder: 0.75, fin: 0.25 },
    owned: 0, rented: 25e3,
    charter: {}, lagMonths: 6.5, imported: true,
    mods: { talentPull: 30 },
    securityLevel: 2.4,
  },
  {
    id: 'challenger', name: 'Challenger lab', difficulty: 'Hard', analogues: 'Anthropic, xAI (mid-2025)',
    character: 'Near the frontier with real revenue; you must raise about once a year to keep up.',
    leaderLab: true,
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
    ownership: { founder: 0.4, fin: 0.45, strat: { Azimuth: 0.15 } },
    owned: 100e3, rented: 300e3,
    charter: {}, lagMonths: 3,
    mods: { talentPull: 20 },
    securityLevel: 2.4,
  },
  {
    id: 'bigtech', name: 'Big-tech AI division', difficulty: 'Impossible', analogues: 'Google DeepMind, Meta, Microsoft AI',
    character: 'Compute and distribution, and you cannot go broke; a yearly budget from the parent, cut when you miss its goals, and a weak pull on talent.',
    leaderLab: true,
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
    // $4B on hand; the parent's budget is paid quarterly (finance/parent.ts). Revenue (~$4B attributed) goes to the parent.
    cash: 4, revenueRun: 4, revenueHistory: [2.5, 3, 3.5, 3.8],
    // Azimuth owns the division outright, with voting shares: it is the controller (control.ts ownerFunded).
    ownership: { founder: 0, fin: 0, strat: { Azimuth: 1 }, stratVoting: { Azimuth: true } },
    owned: 800e3, rented: 0,
    charter: {}, lagMonths: 6,
    mods: { talentPull: 0 },
    securityLevel: 2.4,
  },
  {
    id: 'leader', name: 'Frontier leader', difficulty: 'Easy', analogues: 'OpenAI (mid-2025)',
    character: 'Everything now: the best model, the most compute and revenue; a fragile board and the largest commitments.',
    leaderLab: false,
    // The leader's start state: cash, revenue and teams are read from this row; the sites, orders and cloud contract are in compute/sites.ts and orders.ts.
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
    // The nonprofit's stake and the legacy Northwind stake (Microsoft-like, ~27%, non-voting) [R15].
    ownership: { founder: 0.3, mission: 0.26, fin: 0.17, strat: { 'Northwind Cloud': 0.27 } },
    owned: 500e3, rented: 700e3,
    charter: { missionBody: true, profitCap: true }, lagMonths: 0,
    mods: { talentPull: 10 },
    securityLevel: 2.4,
  },
];

export const START_BY_ID = Object.fromEntries(STARTS.map((x) => [x.id, x])) as Record<StartType, StartDef>;
/** A start's lag behind the leader's day-0 model in OOM of G: its months behind at the stated pre-game pace (RD-L03; 0 for the
 *  leader). core/init.ts solves the start recipe lag from it; the know-how scale (npc/shocks.ts knowhowAt) places the start on the reference clock. */
export const startLagG = (start: StartType): number => (START_BY_ID[start].lagMonths / 12) * PRE_GAME_G_PER_YEAR;
/** Setup picker order: hardest first is confusing; the leader (today's game) first. */
export const START_ORDER: StartType[] = ['leader', 'challenger', 'bigtech', 'spinout'];
export const startOf = (s: { setup: { start?: StartType } }): StartDef => START_BY_ID[s.setup.start ?? 'leader'];

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
