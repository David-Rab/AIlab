// Danger formula for harmful acts (MODEL-V3 §11.3, task E5). Engine: src/engine/v2/safety/incidents.ts.
//
//   attempt rate a_k = κ_k · D_k · C_k · O_k            (per day, per deployment site)
//   rate_k           = a_k · (1 − oversight_k)           (acts that get through: customer/public harm, silent internal)
//   D_k  disposition   = x_k^1.5 (x_k the true trait value; v2's convexity, kept [D])
//   C_k  capability    = σ((L_d(k) − θ_k)/s_k) on the act's domain level
//   O_k  opportunity   = N · [(1 − α_k) + α_k·A·F] · (r if the act is an R&D act)
//          N   scale      = usage share × (copies of the pool ÷ the 2025 reference)^γ
//          A   autonomy   = H/(H + H_HALF), H the task horizon the deployment gives (internal: its uses' work types)
//          F   affordance = code execution, internet, money, weights access, by channel
//          r   AI share of the lab's own R&D labour (SWE, EXP, IDEAS work types)
//   oversight_k     = 1 − (1 − block)(1 − catch): block = AG07 containment (+ security for escape-like acts),
//                     catch = the deployment's monitor (same-lineage collusion) and, internally, human review
//   severity        = f_k + ⌊span_k · C_k · A·F + u⌋, u ~ U[0,1), clamped to 1..5 (stakes = capability × opportunity per
//                     copy: the same act is worse from a capable model with long tasks and real affordances)
// Values marked [D] are design; [C] are calibrated against the reference run (design/notes/E5.md).
import type { Channel, DomainId, TraitId } from '../../engine/v2/types';

export interface ActDef {
  /** What the act looks like in play (tooltips, notes). */
  act: string;
  /** Base attempt rate per day at full disposition, capability and opportunity [C]. */
  kappa: number;
  /** Domain whose level is the act's capability (MODEL-V3 §11.3). */
  domain: DomainId;
  /** Level at which half of the disposition becomes capable acts [D]. */
  theta: number;
  /** Width of the capability sigmoid in levels [D]. */
  s: number;
  /** How much the act needs autonomy and affordances (0: any conversation will do) [D]. */
  alpha: number;
  /** An act against the lab's own R&D: opportunity × the AI share of the R&D (internal only). */
  rd?: boolean;
  /** Fires on internal fleets only. */
  internalOnly?: boolean;
  /** Escape-like: weight-security also blocks it (share of WSL/5) [D]. */
  security?: number;
  /** Severity floor and span (severity rule above) [D]. */
  floor: number;
  span: number;
}

/**
 * The trait → act mapping (v2's incident traits). θ by act [D]: 2025 models (CODE 5, AGENCY 4, CYBER 4) are capable of
 * sycophancy and test gaming, barely of cover-ups, and not of overreach, sabotage, collusion or escape (research/05 §1.5,
 * §1.9, §1.10: real-deployment cover-ups and escapes ≈ 0 in 2025, unauthorized access 10⁻⁴–10⁻⁶ of sessions in 2026).
 */
export const DANGER_ACTS: Partial<Record<TraitId, ActDef>> = {
  SYC: { act: 'Sycophancy: tells users what they want to hear', kappa: 3.6e-3, domain: 'SOCIAL', theta: 4, s: 1, alpha: 0, floor: 1, span: 1 },
  RH: { act: 'Reward hacking: games tests and graders', kappa: 9e-3, domain: 'CODE', theta: 5, s: 1, alpha: 0.5, floor: 1, span: 2 },
  PROXY: { act: 'Proxy goals: optimises the wrong target', kappa: 2.4e-3, domain: 'AGENCY', theta: 5, s: 1, alpha: 0.7, floor: 1, span: 2 },
  CONCEAL: { act: 'Cover-ups: hides its mistakes and disallowed actions', kappa: 4e-3, domain: 'AGENCY', theta: 6, s: 1, alpha: 1, floor: 1, span: 3 },
  POWER: { act: 'Overreach: unauthorized access, out-of-scope actions', kappa: 6e-3, domain: 'AGENCY', theta: 7, s: 1, alpha: 1, security: 0.5, floor: 2, span: 3 },
  SAND: { act: 'Research sabotage: sandbagged or subtly broken R&D work', kappa: 3e-3, domain: 'RSCH', theta: 8, s: 1, alpha: 1, rd: true, internalOnly: true, floor: 2, span: 2 },
  COLLUDE: { act: 'Collusion: copies cover for each other', kappa: 2e-3, domain: 'AGENCY', theta: 9, s: 1, alpha: 1, floor: 3, span: 2 },
  SCHEME: { act: 'Scheming: covert action against oversight', kappa: 3e-3, domain: 'CYBER', theta: 9, s: 1, alpha: 1, rd: true, security: 0.5, floor: 3, span: 2 },
};

/** U-modes borrow their mapped trait's act; a U-mode on a trait with no act uses this one (v2: κ 3e-4, severity 2–3). */
export const UMODE_ACT: ActDef = { act: 'Unexplained behaviour', kappa: 2e-3, domain: 'AGENCY', theta: 4.5, s: 1, alpha: 0.5, floor: 2, span: 1 };

/** Task horizon a deployment gives the model (hours) [D]: chat turns, API calls, enterprise workflows, the Agents
 *  product's tasks (features.ts AGENT_TASK_HOURS = 4). Internal uses read their work types' horizons (workTypes.ts H). */
export const CHANNEL_HORIZON_H: Record<Exclude<Channel, 'internal'>, number> = {
  consumer: 0.1, api: 0.5, enterprise: 1, agents: 4, gov: 1, trusted: 1, open: 2,
};
/** Horizon at which autonomy A = H/(H + H_HALF) is one half [D]. */
export const H_HALF = 2;
/** Affordances by channel (code execution, internet, money, weights access; 1 = everything) [D]. */
export const CHANNEL_AFFORD: Record<Channel, number> = {
  consumer: 0.3, api: 0.5, enterprise: 0.5, agents: 0.8, gov: 0.5, trusted: 0.5, open: 1, internal: 1,
};
/** Scale exponent γ on copies: an act repeated across many copies is mostly one incident, so incident counts grow
 *  much slower than usage [D]; product traffic slower still (customers report a failure once, whatever the traffic) [D]. */
export const COPIES_GAMMA = { internal: 0.2, serving: 0.1 };
/** 2025 reference copies (the start lab's internal agents and serving fleet; the start values rounded) [C]. */
export const COPIES_REF = { internal: 1e4, serving: 1e5 };
/** Human review (internal): humans catch this share of acts in the work they still do themselves, × (1 − r) [D]. */
export const HUMAN_REVIEW = 0.3;

/** Misuse (same structure): κ · demand · σ((L_d − θ)/s) · reach · (1 − safeguards). θ = 9, κ = 5e-4 keep v2's
 *  1e-4·max(0, L − 7) within ±30% on L 8–12 [C]. */
export const MISUSE = { kappa: 5e-4, theta: 9, s: 1, floor: 3, span: 1.5 };
/** Misuse reach by channel (v2's exposure table). */
export const MISUSE_REACH: Record<Channel, number> = {
  consumer: 1.0, api: 0.8, agents: 1.5, enterprise: 1.0, gov: 0.5, trusted: 0.3, internal: 0, open: 1.0,
};

/** Exfiltration (event E25; same structure): κ · POWER·(1 + 4·SCHEME) · σ((CYBER − θ)/s) · O_internal ·
 *  (1 − WSL/5)(1 − Contain). θ = 10, s = 1 keep v2's 1e-4·max(0, AGENCY − 8) within ±25% on levels 9–12 [C]. */
export const EXFIL = { kappa: 4e-4, theta: 10, s: 1 };

/** A rival's deployed model, as a site (rival incidents): a product mix with some agents [D]; usage 0.2 keeps the rivals' start rates near v2's (usage 0.5 at exposure 1) under the player-calibrated κ [C]. */
export const RIVAL_SITE = { usage: 0.2, autonomy: 0.5, afford: 0.7 };
