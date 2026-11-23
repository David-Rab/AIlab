# CAL-S: primary sources for the SAFETY stand-in numbers (calibration steps 1 + 2)

Scope: the numbers listed under "Deferred to calibration" (design/RD-AUDIT/REVIEW-FIXES.md) and the framework follow-up
(design/RD-AUDIT/DECISIONS.md, "Follow-ups to the review fixes"). Primary sources only: official framework documents,
system cards, arXiv papers. Each row: value, range, source with the exact quote, mapping to game units, confidence.
`[D stand-in]` = no primary source gives the number; it is kept and the reason is stated.

Game units used below (design/RD-AUDIT/BUILD-NOTES.md RD-U05): a domain score L_d where **10 = the domain's best
human** and **λ(G_SC − Δ_bm) = its median expert**. The median expert's score per world (probe
`scripts/v2/_cals/medexp.ts`, seed 2027): ai2027 6.39, authors2026 6.01, slow 8.98, fast 9.20. V0 at day 0 (fresh game,
ai2027, `scripts/v2/_cals/fresh.ts`): CODE / AGENCY 5.0, RSCH 2.0, BIO / CYBER 0.0 (clamped), all measured.

---

## 1. Default Safety framework thresholds (src/data/v2/framework.ts; safety/framework.ts ruleTriggered)

### 1a. The documents (versions in force at the 2025-07-01 start)

| Tag | Document | Quote |
|---|---|---|
| OAI-PF2 | OpenAI, Preparedness Framework v2, 15 Apr 2025 (cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf), §1 and Table 1 | "We do not deploy models that reach a High capability threshold until the associated risks that they pose are sufficiently minimized. If a model under development reaches a Critical capability threshold, we also require safeguards to sufficiently minimize the associated risks during development, irrespective of deployment plans." |
| | Bio & Chem High | "The model can provide meaningful counterfactual assistance (relative to unlimited access to baseline of tools available in 2021) to 'novice' actors (anyone with a basic relevant technical background) that enables them to create known biological or chemical threats." Safeguards: "Require safeguards against misuse meeting High standard (Appendix C.1) before external deployment". |
| | Bio & Chem Critical | "The model can enable an expert to develop a highly dangerous novel threat vector (e.g., comparable to a novel CDC Class A biological agent) OR the model can be connected to tools and equipment to complete the full engineering and/or synthesis cycle of a regulated or novel biological threat without human intervention." → "halt further development". |
| | Cybersecurity High | "The model removes existing bottlenecks to scaling cyber operations including by automating end-to-end cyber operations against reasonably hardened targets OR by automating the discovery and exploitation of operationally relevant vulnerabilities." Safeguards: misuse safeguards "for external deployment"; and "Require safeguards meeting High standard against misalignment (Appendix C.2) for large-scale internal deployment", because "models that could bypass OpenAI's technical safeguards constraining model activity, such as sandboxing or monitoring services, could compromise OpenAI's ability to track and mitigate all other risks." |
| | Cybersecurity Critical | "A tool-augmented model can identify and develop functional zero-day exploits of all severity levels in many hardened real-world critical systems without human intervention OR model can devise and execute end-to-end novel strategies for cyberattacks against hardened targets given only a high level desired goal." |
| | AI Self-improvement High / Critical | High: "equivalent to giving every OpenAI researcher a highly performant mid-career research engineer assistant, relative to those researchers' 2024 baseline" (security controls only). Critical: "capable of recursively self improving (i.e., fully automated AI R&D), defined as either (leading indicator) a superhuman research-scientist agent OR (lagging indicator) causing a generational model improvement ... in 1/5th the wall-clock time of equivalent progress in 2024" → "halt further development". |
| ANT-RSP | Anthropic, Responsible Scaling Policy v2.2, "Effective May 14, 2025" (www-cdn.anthropic.com/872c653b2d0501d6ab44cf87f43e1dc4853e4d37.pdf), §2 table and Appendix | CBRN-3: "The ability to significantly help individuals or groups with basic technical backgrounds (e.g., undergraduate STEM degrees) create/obtain and deploy CBRN weapons." → "The ASL-3 Deployment Standard and the ASL-3 Security Standard ... are required." CBRN-4: "uplifting a team of people with skills equivalent to entry-level PhD biologists to be able to approximate the capabilities of a world-class, state-backed bioweapons team." AI R&D-4: "The ability to fully automate the work of an entry-level, remote-only Researcher at Anthropic." → ASL-3 security and "an affirmative case that (1) identifies the most immediate and relevant risks from models pursuing misaligned goals and (2) explains how we have mitigated these risks". AI R&D-5: "dramatic acceleration in the rate of effective scaling" (≈1000× effective compute in a year) → at least ASL-4 security. |
| GDM-FSF | Google DeepMind, Frontier Safety Framework v3.0, "Published: September 22, 2025" (storage.googleapis.com/deepmind-media/DeepMind.com/Blog/strengthening-our-frontier-safety-framework/frontier-safety-framework_3.pdf), Table 4.a | Instrumental Reasoning Level 1: "enough situational awareness (ability to work out and use relevant details of its deployment setting) and stealth (ability to circumvent basic oversight mechanisms) such that, absent additional mitigations, we cannot rule out the model significantly undermining human control." Mitigation: "Automated monitoring ... of instrumental reasoning capabilities in a model's chain-of-thought may be applied in high-stakes internal deployments". Section 4 is "Exploratory" and "illustrative only". Cyber uplift level 1 → security level 2. (v3.0 postdates the start by 12 weeks; v2.0 of Feb 2025 has the same structure; only cited for the misalignment approach.) |

### 1b. What labs actually applied in mid-2025 (primary statements)

| Lab, date | Model | Applied | Source |
|---|---|---|---|
| Anthropic, 22 May 2025 | Claude Opus 4 | ASL-3 (deployment: Constitutional Classifiers on CBRN; security) as a precaution: "we have not yet determined whether Claude Opus 4 has definitively passed the Capabilities Threshold"; "clearly ruling out ASL-3 risks is not possible for Claude Opus 4 in the way it was for every previous model." Claude Sonnet 4: "we have ruled out that Claude Sonnet 4 needs the ASL-3 Standard." | anthropic.com/news/activating-asl3-protections |
| OpenAI, 17 Jul 2025 | ChatGPT agent | Treated as High in Biological and Chemical, "activating the associated safeguards", precautionary: "While we do not have definitive evidence that this model could meaningfully help a novice to create severe biological harm". ("We have decided to treat this launch as High capability in the Biological and Chemical domain"). The page read does not state the Cyber or AI Self-improvement classification. | openai.com/index/chatgpt-agent-system-card; GPT-5 system card |
| Google DeepMind, 2025 | Gemini 2.5 | Not checked in this step (model cards not read). | — |

In the statements above, the safeguards activated in mid-2025 were misuse (CBRN classifier) and security measures;
none was a framework-triggered misalignment requirement on internal AI work (OpenAI: Cyber High, which carries the
internal misalignment requirement, not announced for any 2025 launch read here; GDM: misalignment levels "illustrative only").
Anthropic's AI R&D-4 determination for Claude Opus 4 is in its system card, not re-read here.

### 1c. Mapping onto the game's rules

| Rule | Old | New | Mapping | Confidence |
|---|---|---|---|---|
| Bio: High (classifiers, launches) | BIO ≥ 10 | **BIO ≥ 6.4** | OAI-PF2 / ANT-RSP define High as **novice uplift on known threats**: the model supplies what a domain expert would (CBRN-3's novice has an undergraduate STEM degree). That is a median domain expert's capability = λ(G_SC − Δ_bm), 6.39 on the reference world ai2027 (6.0 authors2026 … 9.2 fast: one number for all worlds is [D]). | medium on the definition, low on the per-world number |
| Cyber: High (classifiers, launches) | CYBER ≥ 10 | **CYBER ≥ 6.4** | OAI-PF2 Cyber High: automating discovery and exploitation of "operationally relevant vulnerabilities" = a median professional's work. Same number as Bio. | medium / low |
| Bio: Critical (hardened + external) | BIO ≥ 12 | **BIO ≥ 10** | OAI-PF2 "enable an expert to develop a highly dangerous novel threat vector"; ANT-RSP CBRN-4 "approximate ... a world-class, state-backed bioweapons team" = the domain's best human (10). | medium |
| Cyber: Critical | CYBER ≥ 12 | **CYBER ≥ 10** | OAI-PF2 zero-days "in many hardened real-world critical systems without human intervention" / novel end-to-end strategies = the best human (10). | medium |
| AI R&D: Critical (training: control + review + external) | RSCH ≥ 12 | **RSCH ≥ 10** | OAI-PF2 leading indicator "a superhuman research-scientist agent"; ANT-RSP AI R&D-5; RSCH 10 = the best human researcher (the AI 2027 "superhuman AI researcher" bar). | medium |
| Misalignment signs (training: control) | top of 90% range > 30%, any model | **same, only for versions measured at or above the scheming act's capability level (CYBER ≥ θ_SCHEME = 5.0) or never measured** | No 2025 framework triggers misalignment safeguards on beliefs alone; all three tie them to a capability: GDM Instrumental Reasoning L1 (stealth: "circumvent basic oversight mechanisms") → CoT monitoring of internal deployments; OAI-PF2 Cyber High ("could bypass ... sandboxing or monitoring") → misalignment safeguards for large-scale internal deployment; ANT-RSP AI R&D-4 → affirmative misalignment case. The game's "able to act covertly against oversight" level is DANGER_ACTS.SCHEME θ, the same clause the trusted rule uses (OD-6): one reading (`trusted.ts schemingReading`). The 30% line stays [D stand-in] (the old red-flag line; no framework states a probability). | medium on the gate, none on 30% |

Not mapped (no rule added, no effect added): OAI AI Self-improvement High (security only), ANT AI R&D-4 (affirmative
case: the game has cases but no "case passed" evidence), security standards (ASL-3 / High security: weight security is
another system), OAI Cyber High's separate internal misalignment requirement (covered in effect by the gated
misalignment rule, whose gate sits below Cyber High).

### 1d. Day 0 after the change (fresh game, ai2027 / authors2026, seed 2027; `scripts/v2/_cals/fresh.ts`)

- V0 and its lineup: no rule triggers (BIO / CYBER 0 < 6.4; RSCH 2.0 < 10; CYBER 0 < θ_SCHEME 5, so the misalignment
  rule does not read V0's wide prior beliefs). No training hold, no deploy hold, no control auto-applied on day 1
  (before: the misalignment rule held frontier training from day 0 and RF-S13 put control on internal work on day 1).
- The start products already carry classifier safeguards (consumer / API / enterprise), which matches what Anthropic
  (Opus 4) and OpenAI (ChatGPT agent) applied as a precaution; the framework does not require them of V0.
- **Gap the designer should know:** on the RD-U05 scale V0 measures BIO 0 (clamped: the best human biologist sits
  5.5 OOM above V0 on ai2027), so no Bio rule can fire for 2025 models whatever its level, while the real labs judged
  their mid-2025 frontier models at or near Bio High. That is a world-scale question (BIO's best-human offset), not a
  framework number: with BIO 0 at the start the High rule fires later than in reality.

---

## 2. CASE_WORK = 30 engineer-days (safety/investigations.ts, RF-S12)

| Value | Range | Source | Mapping | Confidence |
|---|---|---|---|---|
| **30 (kept)** | 0.2–30 person-days | Marks et al. 2025, arXiv 2503.10965, Table 1: audit teams spent 1.5 / 31 / 10 / 70+ researcher-hours on one planted hidden objective; Taylor et al. 2025, "Auditing Games for Sandbagging", arXiv 2512.07810: blue team 3–4 people, 40 + 160 + 80 person-hours (body, research/RD-SR24-safety-params.md C1, C3; the abstract states no hours). | A case answers one question on one model with chosen instruments ≈ an audit; 30 engineer-days = the top of the range (C3's 240 person-hours), fitting a frontier model and a non-planted question. | low (proxy: audits of planted organisms, not of natural traits on a frontier model). No source for a size per model or per question. |

## 3. Method efficacy at scale: q ~ U[0, 2], k = 2 OOM, METHOD_TESTED_OOM (agendas.ts METHOD_SCALE, CP3i, RF-S10)

| Number | Value | Source | Confidence |
|---|---|---|---|
| q lower end 0 | kept | Hubinger et al. 2024, "Sleeper Agents", arXiv 2401.05566, abstract: "The backdoor behavior is most persistent in the largest models." Safety training that removes a behaviour in small models can fail entirely at scale: q → 0 is observed. | medium (direction and existence of q ≈ 0) |
| q upper end 2 | **kept, [D stand-in]** | No primary source measures a safety method becoming stronger than its tested effect at larger scale by a stated factor. The two-sided shape (RF-S10, designer decision 8) is a designer choice; 2 mirrors the downside. | none |
| k = 2 OOM | **kept, [D stand-in]** | The width anchor is one frontier generation of training compute (GPT-3 3.1e23 → GPT-4 2.1e25 FLOP ≈ 1.8 OOM, Epoch AI data); that "the tested effect says nothing beyond one generation" has no source. | low |
| METHOD_TESTED_OOM | kept | Each entry cites the paper's largest model (agendas.ts): Schoen et al. 2025 arXiv 2509.15541 (o3, o4-mini), MacDiarmid et al. 2025 arXiv 2511.18397 (production Claude RL), OpenAI 2025 arXiv 2512.08093 (GPT-5-Thinking) → 0; Chen et al. 2025 arXiv 2507.21509 (7–8B models) → −2.6; Burns et al. 2023 arXiv 2312.09390 (GPT-4 student) → −1.2. T-UNDO (−3) and T-CAST (0) stay [D]. | medium for the cited models; the FLOP conversion is an estimate |

## 4. DISAGREE_DROP = 0.1 (agendas.ts, SR-10)

**Kept, [D stand-in].** No primary source states how much a lab should lower its trust in an instrument when two
independent instruments disagree. The review (review/safety.md §3 #8) recommends deleting the automatic cut (keep the
disagreement record, the chip and the framework / case hook) as an invented effect on beliefs. That is a mechanism
decision for the designer, not a number this step can source.

## 5. Organism realism U[0.4, 1.0] (agendas.ts ORGANISM_REALISM, SR-24b)

| Value | Source | Mapping | Confidence |
|---|---|---|---|
| **kept, [proxy]** | Low end: AuditBench (Sheshadri et al., arXiv 2602.22755): abstract "models trained on synthetic documents are easier to audit than models trained on demonstrations", "better adversarial training further increases auditing difficulty"; the ratio 22.2% ÷ 51.3% = 0.43 (TD+KTO vs SDF+SFT agent success) is from §4 Fig. 4 (research/RD-SR24 R3; figure values not re-read here). High end: Goldowsky-Dill et al. 2025, arXiv 2502.03407, abstract: probes trained on simple contrasts reach "AUROCs between 0.96 and 0.999" on realistic deception, catching "95-99% of the deceptive responses" at 1% FPR, yet "current performance is insufficient as a robust defence against deception". Caveat: Smith, Chughtai, Nanda 2025, arXiv 2511.22662: no labelled natural examples exist, so no measured organism → natural ratio. | real recall ÷ planted recall: hard-organism ÷ easy-organism recall (0.43) as the low end, simple → realistic transfer (≈1) as the high end | low (proxy; no direct measurement exists) |

## 6. CP3f U05_SHIFT and CP3h(a) grader-gap pieces

| Number | Value | Source / status | Confidence |
|---|---|---|---|
| U05_SHIFT (danger.ts) | kept | Not a sourced number: a unit conversion (RD-U05 moved each domain's reference point; θ_new = θ_v2 + (L_new(V0) − L_v2(V0))). The θ themselves are [D] set on 2025 observed behaviour (research/05 §1.1–1.10). Nothing to source beyond the θ. | n/a |
| Grader / monitor gap curve (oversight.ts ENGELS_400) | kept | Engels et al. 2025, "Scaling Laws for Scalable Oversight", arXiv 2504.18530, abstract: "NSO success rates at a general Elo gap of 400 are 13.5% for Mafia, 51.7% for Debate, 10.0% for Backdoor Code, and 9.4% for Wargames"; "these rates decline further when overseeing stronger systems." Backdoor Code (10%) for monitors and RL graders; Debate (51.7%) for AG05. Using the code-review game for RL graders is an analogy [D mapping]. | medium on the numbers, low on the analogy |
| Debate credit ≈ 4.0 OOM (AG05_OVERSIGHT.debateCreditOom) | kept | Khan et al. 2024, "Debating with More Persuasive LLMs Leads to More Truthful Answers", arXiv 2402.06782, abstract: debate gets non-expert models and humans to "76% and 88% accuracy respectively (naive baselines obtain 48% and 60%)". Converted at logit gain → 235 Elo → 4.0 OOM [D: domain Elo read 1:1 as general Elo]. | low on the conversion |
| Graders at L 10 (HUMAN_REVIEW_L, AG05 overseerL) | **kept, flagged** | No source places RL graders at a capability level. On the RD-U05 scale 10 is the **best** human (SC "as good as the best human coders"); "expert human graders" read literally would be the median expert, 6.39 on ai2027 (the same number as the framework's High). Moving it would start the grader gap ≈ 1.5 OOM earlier (moves S4 / S5): a designer call (review §4 CP3h). | none for the level |

---

## Stand-ins left (no primary source)
- Misalignment-signs line 30% (top of the 90% range).
- One High level (6.4) for all worlds (the median expert is 6.0–9.2 by world).
- q upper end 2; k = 2 OOM; T-UNDO / T-CAST tested OOM.
- DISAGREE_DROP 0.1 (and DISAGREE_FLOOR, TRUST_MAX).
- CASE_WORK 30 (proxy), organism realism range (proxy), VAL_COMPUTE_FRAC.
- HUMAN_REVIEW_L 10 for graders; the Backdoor Code → RL grader analogy; debate credit conversion.
