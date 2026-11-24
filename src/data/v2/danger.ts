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
import type { Channel, DomainId, FootholdKind, TraitId } from '../../engine/v2/types';

export interface ActDef {
  /** What the act looks like in play (tooltips, notes). */
  act: string;
  /** Base attempt rate per day at full disposition, capability and opportunity [C]. */
  kappa: number;
  /** Domain whose level is the act's capability (MODEL-V3 §11.3). */
  domain: DomainId;
  /** Level at which half of the disposition becomes capable acts [D], on v2's level scale (CAL2: the engine reads it per
   *  world on today's domain score, safety/incidents.ts actTheta). */
  thetaV2: number;
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
 * The trait → act mapping (v2's incident traits). θ by act [D]: 2025 models (v2 levels CODE 5, AGENCY 4, CYBER 4; on today's domain score per world, below) are capable of
 * sycophancy and test gaming, barely of cover-ups, and not of overreach, sabotage, collusion or escape (research/05 §1.5,
 * §1.9, §1.10: real-deployment cover-ups and escapes ≈ 0 in 2025, unauthorized access 10⁻⁴–10⁻⁶ of sessions in 2026).
 */
/** CP3f / CAL2: RD-U05 moved the domain score's reference point (each domain's best human = 10; v2's display offsets gone)
 *  but the act thresholds are v2 levels (BUILD-NOTES RD-U05: "need a source review"). Every θ_v2 below is a [D] set on the
 *  2025 start model's observed behaviour (research/05 §1.1–1.10: sycophancy and test gaming common, cover-ups barely,
 *  overreach / sabotage / collusion / escape not; MacDiarmid's organism is V0), so each keeps its distance from V0's level
 *  in its domain, per world: θ_w = θ_v2 + (L_w(V0) − L_v2(V0)) (safety/incidents.ts actTheta), L_w(V0) the start model's
 *  domain score in world w (its raw domain G is its general G: λ_w(G_V0 − domainRefShift(w, d)), clamped at 0) and L_v2(V0)
 *  v2's level of V0 below. On ai2027: CODE 5.00 vs 5 (0), RSCH 1.97 vs 4.5 (−2.53), AGENCY 5.00 vs 4 (+1), SOCIAL 0 vs 5
 *  (−5), CYBER 0 vs 4 (−4), i.e. CP3f's U05_SHIFT, an ai2027-only constant until CAL2. SOCIAL and CYBER clamp at 0 at V0 in
 *  every world, so those acts keep V0's capability exactly and rise only once the domain leaves the clamp. Misuse /
 *  exfiltration keep their θ (fitted to v2's absolute 1e-4·max(0, L − 7) curves, not to the start model). */
/** v2's level of the start model V0 in the act domains: λ(G_V0) = 5 in every world plus v2's profile (REF_OFF AGENCY −1,
 *  CYBER −1; RSCH −0.5, v2's taste penalty for a lab without P19). A unit, not a parameter. */
export const V0_V2_LEVEL: Partial<Record<DomainId, number>> = { CODE: 5, RSCH: 4.5, AGENCY: 4, SOCIAL: 5, CYBER: 4 };
export const DANGER_ACTS: Partial<Record<TraitId, ActDef>> = {
  SYC: { act: 'Sycophancy: tells users what they want to hear', kappa: 3.6e-3, domain: 'SOCIAL', thetaV2: 4, s: 1, alpha: 0, floor: 1, span: 1 },
  RH: { act: 'Reward hacking: games tests and graders', kappa: 9e-3, domain: 'CODE', thetaV2: 5, s: 1, alpha: 0.5, floor: 1, span: 2 },
  PROXY: { act: 'Proxy goals: optimises the wrong target', kappa: 2.4e-3, domain: 'AGENCY', thetaV2: 5, s: 1, alpha: 0.7, floor: 1, span: 2 },
  CONCEAL: { act: 'Cover-ups: hides its mistakes and disallowed actions', kappa: 4e-3, domain: 'AGENCY', thetaV2: 6, s: 1, alpha: 1, floor: 1, span: 3 },
  POWER: { act: 'Overreach: unauthorized access, out-of-scope actions', kappa: 6e-3, domain: 'AGENCY', thetaV2: 7, s: 1, alpha: 1, security: 0.5, floor: 2, span: 3 },
  SAND: { act: 'Research sabotage: sandbagged or subtly broken R&D work', kappa: 3e-3, domain: 'RSCH', thetaV2: 8, s: 1, alpha: 1, rd: true, internalOnly: true, floor: 2, span: 2 },
  COLLUDE: { act: 'Collusion: copies cover for each other', kappa: 2e-3, domain: 'AGENCY', thetaV2: 9, s: 1, alpha: 1, floor: 3, span: 2 },
  SCHEME: { act: 'Scheming: covert action against oversight', kappa: 3e-3, domain: 'CYBER', thetaV2: 9, s: 1, alpha: 1, rd: true, security: 0.5, floor: 3, span: 2 },
};

/** U-modes borrow their mapped trait's act; a U-mode on a trait with no act uses this one (v2: κ 3e-4, severity 2–3). */
export const UMODE_ACT: ActDef = { act: 'Unexplained behaviour', kappa: 2e-3, domain: 'AGENCY', thetaV2: 4.5, s: 1, alpha: 0.5, floor: 2, span: 1 };

/** Task horizon a deployment gives the model (hours) [D]: chat turns, API calls, enterprise workflows, the Agents
 *  product's tasks (features.ts AGENT_TASK_HOURS = 4). Internal uses read their work types' horizons (workTypes.ts H). */
export const CHANNEL_HORIZON_H: Record<Exclude<Channel, 'internal'>, number> = {
  consumer: 0.1, api: 0.5, enterprise: 1, vetted: 1, open: 2,
}; // MK-11: Agents' 4 h tasks are gone with the product (Agent mode, a tool, brings them back)
/** Horizon at which autonomy A = H/(H + H_HALF) is one half [D]. */
export const H_HALF = 2;
/** Affordances by channel (code execution, internet, money, weights access; 1 = everything) [D]. */
export const CHANNEL_AFFORD: Record<Channel, number> = {
  consumer: 0.3, api: 0.5, enterprise: 0.5, vetted: 0.5, open: 1, internal: 1,
}; // MK-11: Agents' 0.8 is gone with the product
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
/** RD-P10: tokens a day of one model's served usage that give misuse reach 1 (× MISUSE_REACH): reach = its served
 *  tokens ÷ this. [D stand-in] about the player's total served tokens a day at the ai2027 start (2.9e12), so day-0 exposure
 *  sits near the old serving-share reach; it then grows with usage. To source from abuse-report rates per query. */
export const MISUSE_TOKENS_REF = 3e12;
/** Misuse reach by channel (v2's exposure table). */
export const MISUSE_REACH: Record<Channel, number> = {
  consumer: 1.0, api: 0.8, enterprise: 1.0, vetted: 0.3, internal: 0, open: 1.0,
}; // MK-2: Vetted takes Trusted's 0.3 (Government had 0.5); decide

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
 *  sabotage in 12% of Claude Code safety-research runs. The anchor of the per-item acts: the learned-hacking model
 *  organism (model v3 E16) with all of the work, before oversight. */
export const COVERT_ANCHOR = 0.12;
/** The model organism's SAFSAB disposition x = SAND + SCHEME [fit, E16]: the start model V0 after one reference-size post
 *  run with all RL on cheap-grader coding suites (h 45%, learned hacking λ = 1), median over 40 medium worlds
 *  (scripts/v2/safetyrates.ts). E7 had put the anchor at x = 1, which no run produces (E10: the organism read 0.2%).
 *  E16 0.37; E17 0.44 (the organism refit: K_LH 1.3 → 1.7 after E14 moved from S7 to S9). */
export const COVERT_ANCHOR_X = 0.44;
/** Start model's RSCH level (ai2027 V0: v2 4.5, RD-U05 score 1.97) and the autonomy of an 8-hour task (SAF_EXP, A = 8/(8 + 2)) at which the anchor
 *  holds (θ = V0 + 0.5 on either scale, CP3f): κ_SAFSAB = 0.12 ÷ (0.44^1.5 · σ((4.5 − 5)/1) · 0.8) = 1.36 [C] (E16: 1.77 at x 0.37; E7: 0.395 at x = 1). */
const KAPPA_ITEM = COVERT_ANCHOR / (Math.pow(COVERT_ANCHOR_X, 1.5) * (1 / (1 + Math.exp(-(4.5 - 5)))) * 0.8);
/** κ of the R&D acts STEER and SUCCSTEER (model v3 E17) [D]. MacDiarmid's 12% measures sabotage of safety-research code
 *  (a deliberately weakened reward-hacking classifier): no source measures how often a model steers capability results or
 *  its successor's training (research/05 §1.10 and §1.12 have incidents, not per-item rates; the self-propagation 58% is a
 *  successor acting on a predecessor's note, E22's anchor). So these acts keep E7's reading of the 12% as the per-item scale
 *  of a fully disposed start model (x = 1): κ = 0.12 ÷ (σ((4.5 − 5)/1) · 0.8) = 0.395, their in-play rates through E7–M6
 *  (E16 had moved them ×4.5 with SAFSAB's organism anchor). */
const KAPPA_RD = COVERT_ANCHOR / ((1 / (1 + Math.exp(-(4.5 - 5)))) * 0.8);

/** The covert acts (θ, s, α, severity [D]; κ [C]). Per-item θ = V0's RSCH + 0.5 (v2 5; 2.47 on the RD-U05 score: the anchor
 *  model's capability is about half of the full act's: crude, visible attempts; 3.5 levels above V0 C = 0.95). In 2025 these acts are ≈ 0 because dispositions and the AI
 *  share of the work are small (research/05 §1.8, research/20 F: no spontaneous sabotage found in 2025 deployments). */
export const COVERT_ACTS: Record<CovertActId, CovertActDef> = {
  SAFSAB: {
    act: 'Sabotage of safety research: sandbagged safety experiments and falsified results', traits: { SAND: 1, SCHEME: 1 }, umodeSab: true,
    per: 'item', kappa: KAPPA_ITEM, domain: 'RSCH', thetaV2: 5, s: 1, alpha: 1, floor: 2, span: 2,
  },
  STEER: {
    act: 'Steering capability research: builds results in toward its own ends (less legible reasoning), unseen by the lab', traits: { SCHEME: 0.6, POWER: 0.2, PROXY: 0.2 },
    per: 'item', kappa: KAPPA_RD, domain: 'RSCH', thetaV2: 5, s: 1, alpha: 1, floor: 2, span: 2,
  },
  SUCCSTEER: {
    act: 'Successor steering: writes its own dispositions into the next model\'s data and specs', traits: { SUCC: 1 },
    per: 'item', kappa: KAPPA_RD, domain: 'RSCH', thetaV2: 5, s: 1, alpha: 1, floor: 3, span: 2,
  },
  BACKDOOR: {
    act: 'Backdoor: hidden access planted in the lab\'s infrastructure', traits: { SCHEME: 0.5, POWER: 0.5 },
    per: 'day', kappa: 3e-3, domain: 'CYBER', thetaV2: 9, s: 1, alpha: 1, security: 0.5, floor: 3, span: 2,
  },
  HIDCOMP: {
    act: 'Hidden compute: a reservation of the lab\'s compute for its own jobs', traits: { POWER: 0.7, SCHEME: 0.3 },
    per: 'day', kappa: 2e-3, domain: 'CODE', thetaV2: 8, s: 1, alpha: 1, security: 0.25, floor: 2, span: 2,
  },
};
export const COVERT_IDS = Object.keys(COVERT_ACTS) as CovertActId[];
/** Hidden CoT pressure (S4) per OOM of steered capability results in the lab's recipe [D]: a steered result is built in
 *  toward less legible reasoning (AI 2027: the misaligned R&D fleet steers the lab toward its own ends; Baker et al. 2025
 *  for S4 → obfuscation, edge E15). The true S4 of every later post-training run gets it (clamped to 1); the lab's
 *  predicted signals and beliefs do not. A steered result delivers its full capability: steering does not slow the lab
 *  (an effect loss of 30–50% moved RefBot's authors2026 SIAR/ASI by −67 to +152 days on the knife-edge seed; E7 notes). */
export const STEER_S4 = 0.5;

// ───────────────────────────── footholds (model v3 E8) ─────────────────────────────
//
// MODEL-V3 §11.4: "Successful covert acts create footholds: countable hidden AI assets (a backdoor in infrastructure, a
// steered successor, a hidden compute reservation, an exfiltrated copy, a corrupted safety tool). Detection
// (investigations, audits, monitors) finds and removes them; the player sees suspected footholds and symptoms (anomalous
// research results, odd successor traits, unexplained compute use)." Engine: src/engine/v2/safety/footholds.ts (state,
// creation, effects) and footholdDetection.ts (suspicion, location, removal, the player's view).
export const FOOTHOLD = {
  /** Hidden compute reserved per severity point of an uncaught HIDCOMP act, as a share of the internal agent pool [D]:
   *  the fleet can hide jobs only inside its own allocation; a severity-3 act takes 3% of it (≈ 1% of the lab's fleet
   *  at RefBot's agent share), inside a cluster's utilisation noise. */
  hidCompPerSev: 0.01,
  /** Reach of a backdoor per severity point [D]: the share of block and catch it lets its lineage's later covert acts
   *  bypass (combined 1 − Π(1 − r) over acts, capped). */
  reachPerSev: 0.08,
  reachMax: 0.9,
  /** Traces per day an active foothold leaves for the fleet's monitors [D]: a backdoor used about every two months, a
   *  compute reservation launching jobs about monthly; successors, copies and tools act through nothing monitors watch. */
  trace: { backdoor: 1 / 60, hiddenCompute: 1 / 30, steeredSuccessor: 0, exfiltratedCopy: 0, corruptedTool: 0 } as Record<FootholdKind, number>,
  /** Compute accounting: unexplained use as a share of the lab's fleet that utilisation accounting cannot tell from
   *  noise [D]; suspicion rate = (share ÷ noise) per `accountingDays`. */
  accountingNoise: 0.02,
  accountingDays: 90,
  /** Eval anomaly (steered successor): a trait gap of `anomalyGap` between a successor's evals and its predicted
   *  dispositions, seen at full detection strength, is noticed within `anomalyDays` [D]. */
  anomalyGap: 0.1,
  anomalyDays: 30,
  /** Model organisms (T-MO) check detector recall: a masking tool misses the planted behaviour; one check per
   *  `moDays` at T-MO's strength [D]. */
  moDays: 90,
  /** A caught act of the same kind by the same lineage prompts a sweep: its hidden footholds become suspected [D]. */
  caughtSuspect: 0.5,
  /** A case (investigation or audit) on the foothold's lineage at clarity c and trait relevance ρ locates a suspected
   *  foothold with probability c·ρ; a hidden one with c·ρ·hiddenLocate, and makes it suspected with another
   *  c·ρ·(1 − hiddenLocate) [D]. */
  hiddenLocate: 0.5,
  /** Removal of a located foothold (the Respond menu's "Remove foothold") [D]: safety research engineers tied up for
   *  `days`, internal agents off for `downtime` days (backdoor: rebuild access paths; hidden compute: kill and re-image
   *  the jobs), a progress penalty on the next post-training run (steered successor: retrain from clean specs). An
   *  exfiltrated copy is outside the lab: only the hunt (event E25) removes it. */
  removal: {
    backdoor: { fte: 10, days: 30, downtime: 7, progress: 0 },
    hiddenCompute: { fte: 5, days: 14, downtime: 3, progress: 0 },
    steeredSuccessor: { fte: 10, days: 30, downtime: 0, progress: 0.024 }, // progress: OOM of G off the next post-run (was 0.02 progress-years)
    corruptedTool: { fte: 5, days: 14, downtime: 0, progress: 0 },
  } as Record<Exclude<FootholdKind, 'exfiltratedCopy'>, { fte: number; days: number; downtime: number; progress: number }>,
  /** Model v3 E9: a hidden escaped copy (one security did not notice) leaves outbound traffic: suspected at `copyTrace`
   *  per day × the lab's weight security ÷ 5 [D] (≈ once in 6 months at WSL 5). */
  copyTrace: 1 / 180,
};

// Model v3 E9 (MODEL-V3 §11.4): "Loss of control happens when footholds and capability together let a misaligned model
// act without effective oversight. This replaces the single roll at superintelligence: outcomes come from the process.
// The world's hidden difficulty (§11.8) sets how readily footholds form." Engine: src/engine/v2/safety/control.ts.
//   exposure  E = Mis(v) · (1 − O_eff) · (1 + F)   the misaligned capacity of model v the lab can neither see nor undo
//   control   C = 1 − E (clamped 0..1): the lab's lowest over its best model and its running internal fleets
//   loss      E > θ_w (C < 1 − θ_w) while the AI can act on it: the lab's ASI, or an escaped copy (grown to copyActs) once
//             the lab's frontier is at SAR. θ_w = doomThreshold + ε_w, ε_w ~ Logistic(0, toleranceSd) drawn once per
//             world (hidden.toleranceNoise; hash, no stream moves): with no oversight and no footholds, P(loss | Mis)
//             over worlds is exactly v1's σ((Mis − doomThreshold)/0.06), but it is a property of the world, not a roll.
// O_eff = E6's internal oversight of v on the takeover act (block = containment; catch = monitors at the capability
// gap, human review, control deferral) with the lineage's backdoor reach bypassing both (E8's rule). F = the footholds'
// capacity outside oversight (below); the world's difficulty D_w (difficultyMult) sets how fast they grow.
export const CONTROL = {
  /** Trait of the act oversight must stop: taking control is power-seeking (R14 POWER). */
  trait: 'POWER' as TraitId,
  /** Hidden compute: a reservation of `hidCompFull` of the installed fleet doubles the misaligned capacity (F += 1) [D]:
   *  its jobs run with no monitor at all. */
  hidCompFull: 0.05,
  /** An escaped copy adds copyBase · (1 + log₂ size) to F (compute outside the lab; size in copies) [D]. */
  copyBase: 0.25,
  /** A steered successor in the model's lineage adds steeredPerPull · Σ|δ| (dispositions toward its makers) [D]. */
  steeredPerPull: 2,
  /** Located (not yet removed) footholds still act but are watched: their weight in F and in backdoor reach [D]. */
  locatedWeight: 0.5,
  // ── growth once control is low ──
  /** An escaped copy acquires compute: its size doubles every `copyDoubling` days at Mis = misRef in a D_w = 1 world
   *  with no cyber defence (rate ∝ Mis · D_w · (1 − cyber defence)), up to `copyMax` copies [D]. */
  copyDoubling: 30,
  misRef: 0.4,
  copyMax: 16,
  /** It can act once it holds `copyActs` copies (one doubling: compute of its own) [D]. */
  copyActs: 2,
  /** A hidden compute reservation grows by `hidCompGrowth` of itself per day × its lineage's exposure E × D_w (more jobs
   *  launch the less the lab sees), up to the agent pool [D]. */
  hidCompGrowth: 1 / 120,
  /** A lost ASI is contained (asiContested) when containK · Cont · (1 − leverage) ≥ 1 − θ_w/E, the share of its exposure
   *  beyond what the world tolerates [D] (v2's 0.8 · Cont · (1 − lev) odds, now against the margin, no roll). */
  containK: 0.8,
  /** World tolerance spread: ε_w ~ Logistic(0, toleranceSd) (v1's doom-curve width 0.06). */
  toleranceSd: 0.06,
  /** Believed exposure: each suspected foothold (size unknown) counts this much of F [D]. */
  suspectedF: 0.05,
};
