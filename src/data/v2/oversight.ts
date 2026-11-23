// Oversight measured in capability gaps (model v3 E6, MODEL-V3 §11.5–11.6, research/20 F4). Owner: WS2.
//
// Every oversight and detection quantity reads the capability of the overseen model and of its overseer (a monitor
// model, the level a tool was validated on, human reviewers) in OOM of effective compute G on the display level map
// λ(G) (models/capability.ts levelOfG; a level converts to OOM by λ⁻¹). Nothing here reads the research multiplier M.
//
// Elo → OOM (the Engels et al. 2025 anchor). Engels, Baek, Kantamneni & Tegmark (NeurIPS 2025) [P] measure general
// capability as Chatbot Arena Elo ("We use Chatbot Arena Elo scores as a proxy for general intelligence"). Their own
// model table gives a same-recipe pair: Llama-3-8B-Instruct 1152 vs Llama-3-70B-Instruct 1207 (Table 1) [P], both
// trained on the same 15T+ tokens (Meta model card) [P], so training compute differs by 70/8 = 0.94 OOM: 58 Elo per
// OOM, i.e. 400 Elo ≈ 6.8 OOM of effective compute [D, derived from P]. Cross-checks: (1) Epoch's capability index
// rises 0.387 ECI units per OOM and 0.55 units per year at the frontier [P, research/20 A2]; 6.8 OOM = 2.6 ECI units ≈
// 4.8 years of frontier progress, and the Arena frontier rose ≈ 190 Elo in the two years from GPT-4 (2023) to
// chatgpt-4o-latest (1377, Engels Table 1) [the GPT-4-0314 rating ≈ 1186 is UNVERIFIED] ≈ 4.2 years per 400 Elo;
// (2) Greenblatt et al. 2023 [P]: GPT-3.5 trusted-monitoring GPT-4 (≈ 1 OOM apart, Epoch training-compute estimates
// [R]) is 62% safe; the monitor rule below gives 0.85 · (0.10/0.85)^(1/6.8) = 62% at a 1-OOM gap.
// On the game's level map (ai2027 reference path) λ(G) has 2.0 levels per OOM from V0 to SC, 1.1 from SC to SAR, 0.34
// from SAR to SIAR and 0.52 from SIAR to ASI, so 400 Elo is ≈ 13, 7, 2.3 or 3.6 levels depending on where the pair
// sits: levels compress in OOM late in the game, which is why gaps are measured in OOM and shown in levels too.

/** OOM of effective compute equivalent to a 400-point Chatbot Arena Elo gap (Engels et al.'s reporting gap) [D]. */
export const OOM_PER_400_ELO = 6.8;
export const ELO_PER_OOM = 400 / OOM_PER_400_ELO;

/** Engels et al. 2025 [P]: nested scalable-oversight success at a 400-Elo general gap, by game. CAL-S verified against
 *  the abstract (arXiv 2504.18530): "NSO success rates at a general Elo gap of 400 are 13.5% for Mafia, 51.7% for Debate,
 *  10.0% for Backdoor Code, and 9.4% for Wargames". */
export const ENGELS_400 = { debate: 0.517, mafia: 0.135, backdoorCode: 0.1, wargames: 0.094 } as const;

/** Catch rate of a monitor as capable as the model it watches [D, kept from J2/D7]. */
export const MONITOR_CATCH_BASE = 0.85;
/** A monitor catching covert acts in the watched model's work is Engels' Backdoor Code game (the guard reviews code
 *  for hidden backdoors): its catch falls log-linearly from MONITOR_CATCH_BASE at no gap to 10% at a 400-Elo gap. */
export const MONITOR_ANCHOR = ENGELS_400.backdoorCode;

/** SR-12 (SAFETY-REDESIGN §3.3): one monitor formula for products and internal agent packages,
 *  stop contribution = watched share × flag rate × acted-on rate (models/products.ts monitorStop). Acted-on rate: the
 *  share of a monitor's flags acted on in time (blocked, deferred or audited) [D]: 1 = a flag blocks the action (the
 *  monitor is the gate); SR-13's control protocol and human review set it per deployment. */
export const MONITOR_ACTED_ON = 1;
/** SR-12: share of a product's served tokens its monitor reads [D]: 1 = every forward pass (D7's full coverage). The
 *  monitor's compute, watched share × the product's serving × the monitor's cost ratio (FLOP per token ÷ the watched
 *  model's), is billed to the product's serving need (AI 2027 fn 51's rule; replaces D7's 0.25 × the FLOP ratio). */
export const PRODUCT_MONITOR_WATCH = 1;

/** AG05 scalable oversight (research/14 §1.6A, re-based): decay = 0.517^(gap ÷ 6.8 OOM), Engels' debate rate, with the
 *  gap measured from a fixed overseer at the superhuman-coder level (L 10; v2's M_overseer = 5 = M at SC). F16
 *  (debate raises judge accuracy 48–60% → 76–88%, Khan et al. 2024 [P]) is worth logit(0.82) − logit(0.54) in Elo
 *  units: 400·(log10(0.82/0.18) − log10(0.54/0.46)) ≈ 235 Elo ≈ 4.0 OOM off the gap [D: domain Elo read 1:1 as
 *  general Elo]. CAL-S: Khan et al. 2024 arXiv 2402.06782 abstract verified ("76% and 88% accuracy respectively (naive
 *  baselines obtain 48% and 60%)"); the Elo → OOM conversion stays [D]. */
export const AG05_OVERSIGHT = { base: ENGELS_400.debate, overseerL: 10, debateCreditOom: (235 / 400) * OOM_PER_400_ELO };

/** Human reviewers as overseers (MODEL-V3 §11.3 oversight: human review share): they review the R&D humans still do
 *  and catch HUMAN_REVIEW of the acts in it [D, E5] while the model is no more capable than expert humans; above that
 *  their catch falls with the gap like a monitor's (Engels Backdoor Code). Expert-human level = the superhuman-coder
 *  level L 10 [D: SC is "as good as the best human coders"]. CAL-S: no source places graders at a level; on the RD-U05
 *  scale 10 is the best human and a median expert is λ(G_SC − Δ_bm) = 6.39 on ai2027 (the framework's High level):
 *  kept at 10, a designer call (research/CAL-safety-sources.md §6). CAL2-S (decision 9): the RL graders (CP3h(a),
 *  safety/traits.ts graderOoms) moved to the world's median expert; this level now serves human review of R&D only
 *  (not covered by decision 9; still 10). */
export const HUMAN_REVIEW_L = 10;

/** Technique decay with capability above the level a tool was validated on (MODEL-V3 §11.5): strength factor
 *  D(x) = 1 / (1 + 10^(k·κ·(x − x½))), x = the overseen model's OOM above the start model V0, x½ the tool's
 *  half-strength point (state `oHalf`, raised by tool upkeep). κ = 0.27 = the mean slope of log10 M per OOM on the
 *  ai2027 reference path from V0 (M 1.46) to ASI (M 2000, 11.64 OOM later at E6; 11.56 since A6b, slope 0.271), so
 *  v2's 1/(1 + (M/M½)^k) and this one have the same half points on that path and the same mean slope [D: equivalence,
 *  no jump in the safety calibration]. */
export const DECAY_KAPPA = 0.27;
/** OOM of headroom one v2 "M½ doubling" of tool upkeep or one ×0.5 negative result was worth: log10(2)/κ. */
export const OOM_PER_HALVING = Math.log10(2) / DECAY_KAPPA;

/** Control protocols at deployment (MODEL-V3 §11.6, research/20 F4): Greenblatt et al. 2023 [P] trusted monitoring with
 *  defer-to-trusted, usefulness and safety by the deferral share d (GPT-4 untrusted, GPT-3.5 trusted, 2% audit). */
export const GREENBLATT_TM: readonly { d: number; safety: number; usefulness: number }[] = [
  { d: 0, safety: 0.62, usefulness: 0.97 },
  { d: 0.1, safety: 0.83, usefulness: 0.93 },
  { d: 0.2, safety: 0.92, usefulness: 0.83 },
  { d: 0.5, safety: 1, usefulness: 0.51 },
];
/** The control layer runs trusted monitoring deferring the most suspicious CONTROL_DEFER of actions [D: Greenblatt's
 *  middle setting, safety 62% → 83% at 93% usefulness]. */
export const CONTROL_DEFER = 0.1;
/** The usefulness lost per deferred action scales with how much weaker the trusted model is: Greenblatt's full loss at
 *  the GPT-3.5 → GPT-4 gap ≈ 1 OOM [D, Epoch training-compute estimates 2.6e24 → 2.1e25 FLOP, R], none when the
 *  trusted model is as capable as the watched one. */
export const CONTROL_GAP_FULL = 1;
