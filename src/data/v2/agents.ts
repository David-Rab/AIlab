// Internal agent packages (STRUCTURE §4.9, BUILD-PLAN R7). Each internal use of a model is a package: a model, an
// optional monitor model and compute. Engineering, routine research and frontier research share the capabilities
// agent pool (`split.agents`); safety research runs on a share of the safety pool. Values marked [D] are design.
import type { AgentUse, TeamRole, TraitId } from '../../engine/v2/types';

export const AGENT_USES: AgentUse[] = ['eng', 'capRoutine', 'capFrontier', 'safety'];
/** Uses funded from the capabilities agent pool (their `compute` are shares of it, summing to 1). */
export const CAP_USES = ['eng', 'capRoutine', 'capFrontier'] as const;
export type CapUse = (typeof CAP_USES)[number];

export interface AgentUseDef {
  name: string;
  /** Whose work it automates. */
  work: string;
  role: TeamRole;
  budget: 'cap' | 'saf';
  /** What a misaligned model can do here (lane risk tooltip). */
  misuse: string;
  /** Takeover order (AI 2027: coding, then research engineering, then research taste). */
  order: 1 | 2 | 3;
}

export const AGENT_USE_DEF: Record<AgentUse, AgentUseDef> = {
  eng: { name: 'Engineering', work: "engineers' coding", role: 'eng', budget: 'cap', misuse: 'Ship subtly broken code, game its tests', order: 1 },
  capRoutine: { name: 'Routine research', work: 'research engineers', role: 're', budget: 'cap', misuse: 'Sandbag, shape its own successor, try to exfiltrate', order: 2 },
  capFrontier: { name: 'Frontier research', work: "scientists' taste", role: 'sci', budget: 'cap', misuse: 'Steer research direction', order: 3 },
  safety: { name: 'Safety research', work: 'safety researchers', role: 're', budget: 'saf', misuse: 'Sabotage: false results, corrupted investigations', order: 2 },
};

/** Reference share of the capabilities agent pool spent on engineering (coding for the build queue) [D]. The
 *  production function's agent ratio k counts routine + frontier agents against the reference agent compute net of
 *  this share, so a lab at the reference split has exactly today's k. */
export const ENG_REF_SHARE = 0.2;
/** Default shares of the capabilities agent pool (the reference lab; mockups-v3 v3-company) [D]. */
export const DEFAULT_CAP_SHARES: Record<CapUse, number> = { eng: ENG_REF_SHARE, capRoutine: 0.65, capFrontier: 0.15 };

/** Monitor id meaning "the model it watches" (a copy of the same model: as capable as the watched one, so no
 *  oversight gap). The default monitor on routine and frontier research; it follows model swaps. */
export const MONITOR_SAME = 'same';
/** Default monitoring budget, a share of the safety pool (policies.monitorBudget): the pre-R7 runtime-monitoring reserve
 *  (`monitoringShare`) [D]. SAFMECH: a budget, not a price: what it watches is budget ÷ (watched compute × the monitor's
 *  cost ratio) (AI 2027 fn 51; departments/agents.ts monitorBudget). */
export const MONITOR_STD_POOL_SHARE = 0.2;

/** Trusted to AI (one policy for all safety work, replacing per-agenda automation): the share of safety research and
 *  investigation work handed to the safety agents, 0–100% (model v3 E2 removed v2's 50% cap before P27: how much the
 *  agents can do comes from their SAF_* coverage). */
/** Share of the safety pool the safety agents get when Trusted to AI is turned on with none running [D]. */
export const SAFETY_AGENT_DEFAULT_SHARE = 0.2;
export const SAFETY_AGENT_MAX_SHARE = 0.6;

/** The four risk families (STRUCTURE §4.5) used by the lane risk badges and the blueprint. */
export const RISK_FAMILIES: { id: 'please' | 'gaming' | 'deception' | 'power'; label: string; traits: TraitId[] }[] = [
  { id: 'please', label: 'People-pleasing', traits: ['SYC', 'PERSONA'] },
  { id: 'gaming', label: 'Gaming', traits: ['RH', 'PROXY', 'TGAME'] },
  { id: 'deception', label: 'Deception', traits: ['EA', 'CONCEAL', 'OBF', 'AF', 'SAND', 'SCHEME'] },
  { id: 'power', label: 'Power', traits: ['POWER', 'SUCC', 'COLLUDE'] },
];
/** Risk badge thresholds on the believed trait estimates [D]: "watch" at a belief ≥ 0.3 in the family; "unseen" when
 *  the family's mean clarity is below 0.3 (the tools cannot read it). */
export const RISK_WATCH_EST = 0.3;
export const RISK_UNSEEN_CLARITY = 0.3;
