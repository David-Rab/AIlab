// The four safety ideas on the tech tree that act on the safety mechanisms (model v3 E13; design/TECH-TREE.md §6.4).
// Owner: WS2. Each is a typed effect with a unit, acting through a v3 mechanism (engine: safety/ideas.ts):
//   P14 interp-guided training      → the post-training trait step (growth × (1 − k·d), d = the white-box probes'
//                                      detection of the trait at the new model's capability) + Goodhart masks on WB
//   P15 AI-assisted oversight       → suite hardening (D5) done partly by the safety agents (E2's AI share of SAF_EXP):
//                                      cheaper red-teaming cash, a deeper cut; same-lineage collusion (E6/J2 AG1)
//   P23 faithful-CoT architecture   → the CoT option: effective compute (OOM), FLOP per token, monitorability, and
//                                      resistance to CoT pressure (S4) and to CoT controllability (CoT monitors, AG09)
//   P27 automated alignment research at scale → E2's safety AI labour: SAF_* fit (OOM) and the agendas' automation
//                                      factors; the FALSE-result risk is E2's sabotage weight on the larger AI share
// and two AG17 effects on the same labour mechanism (model v3 E14):
//   F44 AARs mitigate well-characterized failures (a finding) → the safety model's fit on the benchmarked agendas'
//                                      line work (AG18 / AG03 / AG16): + one median-to-best-human gap
//   AG17 science teams (the agenda's programme) → a harness scaffold on SAF_EXP / SAF_IDEAS: fit + OOM by capacity
// Tags: [P] primary source, [V] verified in research/, [D] design choice (direction from the cited work).

/**
 * P14 interp-guided training (research/12 #14: "monitor and steer trait directions during training (persona vectors,
 * SAE features, 'preventative steering')"; safety implication "training against a detector teaches evasion").
 * - `k`: a post-training run's growth of trait t is multiplied by (1 − k·d_t), d_t ∈ [0, 1] the lab's white-box (WB)
 *   detection of t on the new model: Σ over active WB detect tools of coverage × strength (E6: s0 · efficacy · decay in
 *   OOM above V0, so it fades as capability outruns the probes), combined as correlated tools, × the WB family penalty
 *   (masks, hidden U-modes). k = 1 [D; direction: Chen et al. 2025 "Persona vectors": steering along the trait direction
 *   during fine-tuning ("preventative steering") holds the trait shift near zero while the vector reads the trait]: a
 *   perfect probe cancels the growth it sees. At the start probe (T-PROBE: s0 0.9 × AG02 efficacy ≈ 0.5 × coverage
 *   0.8 on AF/SCHEME) d ≈ 0.35, i.e. growth × 0.65, close to v2's flat ×0.6.
 * - `mask`: Goodhart (E24/E16): the steered run also optimises against the direction, so the new version's WB mask on
 *   each steered trait rises: mask ← 1 − (1 − mask)·(1 − mask·d_t). 0.3 [D]: a third of the 0.7–0.9 visible drop of
 *   explicitly training against a detector (goodhartTrain; Bailey et al. 2024: probe recall 100% → 0% under
 *   optimisation [V, research/14 F08]), since steering uses the direction as a regulariser, not as the loss. Masks are
 *   inherited by later versions, and d reads them, so steering fades as the probes go blind ("use the detector for
 *   monitoring only, or lose it", research/12 #14).
 */
export const P14_STEER = { k: 1, mask: 0.3 } as const;

/**
 * P15 AI-assisted oversight (research/12 #15: "AI critics, debate, and weak-to-strong for grading hard tasks";
 * unlocks hardened graders at scale; safety cost: collusion between grader and policy). It acts on D5's suite
 * hardening, the lab's red-teaming of its RL graders, through E2's safety AI labour: A = the AI share of SAF_EXP work
 * (Trusted to AI × the safety model's SAF_EXP coverage; 0 when no safety work is handed to AI).
 * - `aiCostRatio`: the AI share of a pass's expert red-teaming cash costs this fraction of the humans' [V: research/14
 *   AG17, Anthropic AARs ≈ $4/h vs $150/h] → cash × (1 − A·(1 − 4/150)).
 * - `criticGain`: AI critics find flaws human red-teamers miss: the pass's cut (D5: 40% of the exploitability above the
 *   floor) × (1 + criticGain·A_eff) [D 0.5; direction: Saunders et al. 2022 self-critiquing models and McAleese et al.
 *   2024 CriticGPT (critiques help evaluators find more flaws), not yet in research/].
 * - collusion: when the critic model shares the lineage (base) of the model the suites train (the lab's internal
 *   model), A_eff = A × (1 − COPY_COLLUSION), halved by an active comms lockdown: E6's same-lineage monitor rule (J2
 *   AG1, data/v2/features.ts) applied to the grader [D].
 */
export const P15_OVERSIGHT = { aiCostRatio: 4 / 150, criticGain: 0.5 } as const;

/**
 * P23 faithful-CoT architecture (research/12 #23: "keep reasoning legible by construction, accepting a capability tax";
 * option "faithful": monitorability high, −0.3 G).
 * - `dOom`: effective compute of a post run with the faithful option, OOM: −0.29 [D: research/12's −0.3 G as v2's −0.24
 *   y at the reference 1.2 OOM/yr, B_G_PER_Y].
 * - `fptMult`: serving FLOP per token × 1.2 (the version's serving cost relative to its base, which sets ModelVersion.fpt
 *   and so AI labour, eval and product costs) [D, v2's serve ×1.2: legible reasoning spends more tokens per task].
 * - `monitorability`: 0.98 (visible 0.9) [D, v2].
 * - `resist`: the reasoning is load-bearing by construction, so pressure on the CoT moves less of the reasoning out of
 *   it: training against a CoT monitor gives S4 = pressured × (1 − resist) and its COT masks × (1 − resist), and the
 *   CoT controllability that blinds CoT monitors at high capability (detection ctl(L), research/14 E15) × (1 − resist)
 *   [D 0.5; direction: Emmons et al. 2025 "When chain of thought is necessary, language models struggle to evade
 *   monitors", not yet in research/; Baker et al. 2025 for the pressure itself, research/20 F1].
 */
export const FAITHFUL_COT = { dOom: -0.29, fptMult: 1.2, monitorability: 0.98, resist: 0.5 } as const;

/**
 * P27 automated alignment research at scale (research/12 #27: "AIs do the interp and oversight science"; research/14
 * AG17: Anthropic's 2026 automated alignment researchers beat the best human idea on 7/7 failures, caveat: only for
 * "well-characterized" failures with benchmarks [V]). It acts on E2's safety AI labour, not on a speed factor:
 * - `fitOom`: the AAR harness is a research scaffold for the safety package on SAF_EXP and SAF_IDEAS: fit + 0.3 OOM
 *   (coverage and AI taste rise) [D: the size of the Deep research scaffold on internal research ideas, R20 B3 /
 *   design/TECH-TREE.md §6.4 P05].
 * - `autoGap`: each agenda's automation factor Auto (research/14: AI speeds the work whose outputs can be checked,
 *   Carlsmith 2025 [V]) closes this share of its gap to 1: Auto' = 1 − (1 − Auto)·(1 − 0.5) [D: the harnesses turn
 *   part of each line's open-ended work into benchmarked sub-problems; AG12 0.2 → 0.6, AG01 0.6 → 0.8].
 * The false-result risk is unchanged in form: E2's FALSE weight = the line's AI share × the safety model's hidden
 * sabotage, and both parts raise that AI share.
 */
export const P27_AAR = { fitOom: 0.3, autoGap: 0.5 } as const;

/**
 * F44 "AI researchers mitigate well-characterized failures" (an AG17 TECH finding; research/14 F44 and AG17 status [V]:
 * Anthropic's 2026 AARs beat the best of 28 human researchers' ideas on 7/7 comparable failures, but only for
 * "well-characterized" failures with benchmarks; the results "may not generalize to open-ended, hard-to-supervise
 * research"). Once found, the safety package works on the agendas whose failures are benchmarked (`agendas`: training
 * signals AG18, steering AG03, adversarial robustness AG16, research/14 F44's "on benchmarked traits") at best-human
 * level, where its general safety-research fit is about a median expert's (GDPval: frontier ≈ median parity, R20 E2):
 * the safety model's SAF_EXP and SAF_IDEAS fit on those lines' work rises by `gapBM` × the world's median-to-best gap
 * Δ_bm (OOM; ai2027 2.2). Coverage, the assist and AI taste on those lines rise (taste + 3.09 SD per Δ_bm: the best
 * human). [D: the mapping "beats the best human" → + 1 Δ_bm; research/14's ×3–10 speed was itself [D].] Replaces v2's
 * flat ×3 on those lines' speed whenever any safety work was handed to AI (removed in model v3 E14). Nothing with no
 * work handed (Trusted to AI 0), nothing more once the line's work is fully covered.
 */
export const F44_AAR = { agendas: ['AG18', 'AG03', 'AG16'] as const, gapBM: 1 } as const;

/**
 * AG17's science teams (automated alignment research, "a meta-agenda that multiplies the others", research/14 AG17;
 * 5–15 FTE plus lots of compute) build and run the harness the safety package works in: benchmarks, sandboxes and
 * automated grading that turn safety research into checkable tasks (Carlsmith 2025: evaluable research automates [V]).
 * A scaffold on the safety package's SAF_EXP and SAF_IDEAS work: fit + `fitOom` × √(capacity ÷ SERIOUS_CAP), capacity
 * counted up to LINE_MULT_MAX (the old Major) [D: at a serious programme the size of the Deep research scaffold and of
 * P27's harness, R20 B3 / design/TECH-TREE.md §6.4 P05; the square root is the lines' diminishing returns]. Replaces
 * v2's ×(1 + √(capacity ÷ SERIOUS_CAP)) on the agents' AI team-equivalents (removed in model v3 E14), which did almost
 * nothing in v3: the coding CES saturates in AI input once AI team-equivalents exceed the humans' (day 400: 604 vs 1).
 */
export const AG17_HARNESS = { fitOom: 0.3 } as const;
