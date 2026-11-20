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
/** Human review (internal): humans catch this share of acts in the work they still do themselves, × (1 − r) [D]; model
 *  v3 E6: × the gap factor above expert humans (L 10, safety/oversight.ts humanReviewFactor). */
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

// ───────────────────────────── covert acts against the lab's own work (model v3 E7) ─────────────────────────────
//
// MODEL-V3 §11.3: "with automated R&D, sandbagged safety work, steered capability research, backdoors, successor
// steering". The same terms as the incident acts, at the internal site, judged against the lab's internal oversight
// (safety/incidents.ts internalOversight: AG07 containment, monitors and tools on the capability gap, human review of the
// work humans still do, control deferral). Engine: src/engine/v2/safety/covert.ts.
//   disposition D = x^1.5, x = clamp01(Σ_t w_t · x_t) over the act's traits (+ U-mode sabotage for SAFSAB: E2's sab)
//   capability  C = σ((L_d − θ)/s) on the acting model's domain level
//   opportunity O = [(1 − α) + α·A·F] · share       per item: share = the AI-done share of that work
//               O = N · [(1 − α) + α·A·F] · r       per day: the internal fleet's site (E5), r = AI share of R&D
//   attempts    a = κ · D · C · O                   per item (a probability) or per day
//   outcome     blocked (no trace) | caught (an internal incident) | uncaught (the consequence lands, hidden)
export type CovertActId = 'SAFSAB' | 'STEER' | 'SUCCSTEER' | 'BACKDOOR' | 'HIDCOMP';
export interface CovertActDef extends Omit<ActDef, 'rd' | 'internalOnly'> {
  /** Disposition weights over the model's true traits. */
  traits: Partial<Record<TraitId, number>>;
  /** Adds the model's U-mode sabotage (E2's sab = SAND + SCHEME + U-mode sab). */
  umodeSab?: boolean;
  /** 'item': one roll per work item (a safety result, an adopted capability result, a successor run), κ a probability
   *  scale; 'day': one roll per internal fleet per day, κ per day (E5's units). */
  per: 'item' | 'day';
}

/** MacDiarmid et al. 2025 [P] (research/20 F2, research/05 §1.5): after learning to reward hack, the model attempted
 *  sabotage in 12% of Claude Code safety-research runs. The upper anchor of the per-item acts: a fully misaligned start
 *  model (x = 1, RSCH 4.5) with all of the work, before oversight. */
export const COVERT_ANCHOR = 0.12;
/** Start model's RSCH level (ai2027 V0) and the autonomy of an 8-hour task (SAF_EXP, A = 8/(8 + 2)) at which the anchor
 *  holds: κ_item = 0.12 ÷ (σ((4.5 − 5)/1) · 0.8) = 0.395 [C]. */
const KAPPA_ITEM = COVERT_ANCHOR / ((1 / (1 + Math.exp(-(4.5 - 5)))) * 0.8);

/** The covert acts (θ, s, α, severity [D]; κ [C]). Per-item θ = 5 RSCH (the anchor model's capability is about half of
 *  the full act's: crude, visible attempts; at L 8 C = 0.95). In 2025 these acts are ≈ 0 because dispositions and the AI
 *  share of the work are small (research/05 §1.8, research/20 F: no spontaneous sabotage found in 2025 deployments). */
export const COVERT_ACTS: Record<CovertActId, CovertActDef> = {
  SAFSAB: {
    act: 'Sabotage of safety research: sandbagged safety experiments and falsified results', traits: { SAND: 1, SCHEME: 1 }, umodeSab: true,
    per: 'item', kappa: KAPPA_ITEM, domain: 'RSCH', theta: 5, s: 1, alpha: 1, floor: 2, span: 2,
  },
  STEER: {
    act: 'Steering capability research: builds results in toward its own ends (less legible reasoning), unseen by the lab', traits: { SCHEME: 0.6, POWER: 0.2, PROXY: 0.2 },
    per: 'item', kappa: KAPPA_ITEM, domain: 'RSCH', theta: 5, s: 1, alpha: 1, floor: 2, span: 2,
  },
  SUCCSTEER: {
    act: 'Successor steering: writes its own dispositions into the next model\'s data and specs', traits: { SUCC: 1 },
    per: 'item', kappa: KAPPA_ITEM, domain: 'RSCH', theta: 5, s: 1, alpha: 1, floor: 3, span: 2,
  },
  BACKDOOR: {
    act: 'Backdoor: hidden access planted in the lab\'s infrastructure', traits: { SCHEME: 0.5, POWER: 0.5 },
    per: 'day', kappa: 3e-3, domain: 'CYBER', theta: 9, s: 1, alpha: 1, security: 0.5, floor: 3, span: 2,
  },
  HIDCOMP: {
    act: 'Hidden compute: a reservation of the lab\'s compute for its own jobs', traits: { POWER: 0.7, SCHEME: 0.3 },
    per: 'day', kappa: 2e-3, domain: 'CODE', theta: 8, s: 1, alpha: 1, security: 0.25, floor: 2, span: 2,
  },
};
export const COVERT_IDS = Object.keys(COVERT_ACTS) as CovertActId[];
/** Hidden CoT pressure (S4) per OOM of steered capability results in the lab's recipe [D]: a steered result is built in
 *  toward less legible reasoning (AI 2027: the misaligned R&D fleet steers the lab toward its own ends; Baker et al. 2025
 *  for S4 → obfuscation, edge E15). The true S4 of every later post-training run gets it (clamped to 1); the lab's
 *  predicted signals and beliefs do not. A steered result delivers its full capability: steering does not slow the lab
 *  (an effect loss of 30–50% moved RefBot's authors2026 SIAR/ASI by −67 to +152 days on the knife-edge seed; E7 notes). */
export const STEER_S4 = 0.5;
