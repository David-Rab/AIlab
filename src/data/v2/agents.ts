// Internal agent packages (STRUCTURE §4.9, BUILD-PLAN R7). Each internal use of a model is a package: a model, an
// optional monitor model and compute. Routine research and frontier research share the research agent pool
// (RD-A05a: `split.routine` / `split.frontier`); engineering has its own line (`split.engineering`, RD-A02); safety research runs on a share of the
// safety pool. Values marked [D] are design.
import type { AgentUse, TeamRole, TraitId } from '../../engine/v2/types';

export const AGENT_USES: AgentUse[] = ['eng', 'capRoutine', 'capFrontier', 'safety'];
/** Capabilities uses (watched by the capabilities monitors). */
export const CAP_USES = ['eng', 'capRoutine', 'capFrontier'] as const;
export type CapUse = (typeof CAP_USES)[number];
/** Uses funded from the research agent pool (RD-A05a: each on its own line of the flat allocation, split.routine / split.frontier). Engineering
 *  runs on its own split line (split.engineering) since RD-A02: its `compute` is 1 (all of that line). */
export const RESEARCH_AGENT_USES = ['capRoutine', 'capFrontier'] as const;
export type ResearchAgentUse = (typeof RESEARCH_AGENT_USES)[number];

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

/** Reference share of a lab's agent compute spent on engineering (coding for the build queue) [D]. The player's
 *  reference split puts it on the engineering line (split.ts playerShareRef), so a lab at the reference split has
 *  exactly the research agent compute (and k) it had when engineering was a share of the agent pool. */
export const ENG_REF_SHARE = 0.2;
/** Reference shares of ALL of a lab's agent compute (the reference lab; mockups-v3 v3-company) [D]; the rivals' research
 *  model reads routine and frontier from it. */
export const REF_AGENT_SHARES: Record<CapUse, number> = { eng: ENG_REF_SHARE, capRoutine: 0.65, capFrontier: 0.15 };
/** The player's default package shares: research uses as shares of the research agent pool (the reference shares net of
 *  engineering: 0.8125 / 0.1875), engineering 1 (all of its own line). */
export const DEFAULT_CAP_SHARES: Record<CapUse, number> = {
  eng: 1, capRoutine: REF_AGENT_SHARES.capRoutine / (1 - ENG_REF_SHARE), capFrontier: REF_AGENT_SHARES.capFrontier / (1 - ENG_REF_SHARE),
};

/** Monitor id meaning "the model it watches" (a copy of the same model: as capable as the watched one, so no
 *  oversight gap; it follows model swaps). An override since SR-20. */
export const MONITOR_SAME = 'same';
/** SR-20 (OD-6): monitor id meaning "chosen automatically": the most capable live model the lab TRUSTS (believed
 *  aligned or below the scheming-capable level; safety/trusted.ts), never the watched model (none when no other model
 *  is trusted). The default watcher on routine and frontier research; a model id or 'same' overrides it. */
export const MONITOR_AUTO = 'auto';
/** SR-20: the trust line when the framework has no Misalignment-signs rule: upper end of believed SCHEME / AF / SAND ≤ 30% (the
 *  framework's default misalignment line, data/v2/framework.ts) [D]. */
export const TRUST_EST_DEFAULT = 0.3;
/** Default monitoring budget, as a share of the old safety pool (RD-A05a: the reference allocation puts it on split.monitors): the pre-R7 runtime-monitoring reserve
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
