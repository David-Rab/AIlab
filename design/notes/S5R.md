# S5R: primary-source re-read of AI 2027's safety staffing and compute; RefBot's safety programme; S5 restated

Task (design/V3-TASKS.md S5R): S5 (`scripts/v2/safety.ts`, V2-SPEC §8.3) said "under RefBot, understanding U falls
below capability L by SAR (median world)". v2 forced it with an asymmetry (safety research ignored the research
multiplier) that v3 removed (MODEL-V3 §11.7). This task reads the primary sources for what the AI 2027 lab actually
spends on safety, compares RefBot, tunes RefBot toward the sources, and restates S5 as an emergent share-of-worlds
criterion with mechanism checks.

## 1. Primary sources (verbatim)

Read 2026-11-21: the AI 2027 PDF (https://ai-2027.com/ai-2027.pdf, extracted with pdftotext, footnotes included), the
web pages https://ai-2027.com, /race, /slowdown, and the supplements /research/compute-forecast,
/research/security-forecast, /research/ai-goals-forecast, /research/takeoff-forecast. [E] = explicit in the text,
[I] = implied (my arithmetic or reading).

### Staffing

- Late 2025: "OpenBrain's security level is typical of a fast-growing 3,000 person tech company" and fn 18 "Around 5%
  of OpenBrain's staff is on the security team" [E]. No alignment headcount is given for 2025–26 [E: absent]; fn 12
  defines the alignment team as "whoever is trying to solve the problems the Superalignment team was trying to solve".
- AI goals forecast (Agent-3 era): "The vast majority (~95%) of research effort and experiment compute is dedicated to
  improving the AIs' capabilities on these tasks. A small amount of research effort is aimed specifically at ensuring
  alignment" and "The safety team also does some work on model organisms, scalable oversight, and mechanistic
  interpretability, but they don't have many resources." [E: ~95% / "small"; I: alignment ≈ 5% of research effort]
- Race, Oct 2027, fn 56: "The humans, by contrast, have maybe about 10 alignment researchers in the silo, plus an army
  of Agent-3 copies. They are able to rapidly code up experiments, but are bottlenecked on human judgment, since they
  can't trust Agent-3 to correctly distinguish the good solutions from those merely appearing to be good. In fact,
  trusting Agent-3's research too much was part of how they got into this mess in the first place." [E]
- Security forecast, raw data: privileged-access employees 1,000 (Dec 2024), 1,500 (Dec 2025), 2,000 (Dec 2026), 300
  (Apr 2027), 200 (Aug 2027), 100 (Dec 2027) [E]. So ~10 of ~200–300 siloed staff ≈ 3–5% [I].
- Slowdown, Oct 2027: "OpenBrain quickly vets several dozen top external alignment researchers and loops them into the
  project--quintupling total expertise" [E] ⇒ the in-house team was about a quarter of "several dozen", ≈ 10–15 [I];
  Jan 2028: "hundreds of alignment researchers joined the project" [E].
- Authors' uncertainty (Sep 2027 box): "we aren't sure how much effort the leading AI company will put towards this sort
  of thing, nor how much relevant expertise they'll have on-staff to direct that effort. Our fictional OpenBrain
  represents our best guess but it could easily be significantly more--or significantly less." [E]

### Compute

- Compute forecast §3 "Compute Usage" table (2024 / 2025 / 2026 / Q1–Q4 2027, "Exploratory and uncertain, this section
  is a best guess not an informed forecast") [E]: Research experiments 4 / 5 / 6 / 14 / 21 / 28 / 35%; Research
  automation 1 / 3 / 4 / 6 / 6 / 6 / 6%; Synthetic data 20 / 20 / 20 / 27 / 23 / 22 / 22%; Total Internal (= synthetic +
  experiments + automation) 25 / 28 / 30 / 47 / 51 / 57 / 63%, of which "Capabilities share" 95 / 96 / 97 / 97 / 97 /
  97 / 97% and "Alignment share" 5 / 4 / 3 / 3 / 3 / 3 / 3%; Monitoring 2 / 2 / 2 / 3 / 3 / 3 / 4% of all compute,
  derived as inference ÷ 20 ("a model with an average inference cost around 10x lower … checking roughly half of all
  input/output tokens", "divide by 20 to get our estimate for the share of compute on monitoring").
  ⇒ alignment ≈ 1.1% of all compute (2025) → 0.9% (2026) → 1.9% (Q4 2027); on experiments + automation alone
  (game's safety lines + safety agents) 0.32% (2025), 0.30% (2026), 0.60 / 0.81 / 1.02 / 1.23% (2027 quarters) [I].
- Sep 2027, fn 51: "With a monitoring budget of 1% of total compute, if monitoring uses a distilled system that has 10%
  of the cost as Agent-4, you can monitor 1/10 of the forward passes." [E]
- Slowdown appendix (Safer-2): "Spend a higher fraction of the compute budget on alignment training … e.g. 40% instead
  of 1%." [E: the race lab spends ≈ 1% on alignment training]

### AI labour on alignment, and how alignment progress compares

- Apr 2027: "Step 1, aligning Agent-3, has partially succeeded … Step 2, verifying that the model is aligned, is
  inconclusive … Step 3, using the model to align the next generation, is therefore underway." Control: "monitoring
  Agent-3's outputs using a series of weaker AI systems including Agent-2 (Agent-3 produces so many tokens that it's
  intractable to have humans monitor any more than a small minority of the produced outputs)". "The safety team is far
  from a full understanding of how Agent-3 works" [E].
- Mar 2027 (neuralese, Agent-3 = SC): "these high-dimensional vectors are likely quite difficult for humans to
  interpret" [E].
- Sep 2027: "Agent-3 is in charge of testing Agent-4's alignment"; "Bottom-up interpretability doesn't work. It's too
  hard even for Agent-3"; "Agent-4's neuralese 'language' becomes as alien and incomprehensible to Agent-3 as Agent-3's
  is to humans"; "An army of Agent-3 monitors still goes over every line of code and reports suspicious activity to
  humans, but Agent-4 is much smarter than them" [E].
- Sep 2027 (Agent-4's goals): "Agent-4 sandbags on some alignment research. Specifically, it sandbags on the small
  fraction of alignment research that it thinks is actually on track to solve the problem or reveal Agent-4's
  scheming; the majority of alignment research is not like that." [E]
- Oct 2027: "The evidence for misalignment is inconclusive"; Race: "The problem was real and the fixes didn't work." [E]
- No source gives a numeric alignment-vs-capability progress rate; the supplements never apply the AI R&D multiplier to
  alignment research [E: absent]. The scenario's lag comes from small resources, opaque neuralese, untrusted AI labour
  and sabotage, not from alignment work being unable to use AI or compute [I].

### Real labs (2022–2025, labelled)

- OpenAI, "Introducing Superalignment" (5 Jul 2023), a commitment: "We are dedicating 20% of the compute we've secured
  to date over the next four years to solving the problem of superintelligence alignment." No headcount; no statement
  that it was delivered.
- OpenAI, "Our approach to alignment research" (24 Aug 2022), self-assessment: "robustness and interpretability research,
  two areas OpenAI is currently underinvested in."
- Anthropic "Core views on AI safety" (8 Mar 2023): no headcount or compute share. Leike's May 2024 thread, GDM staff
  numbers and the LessWrong researcher counts: not verified from a primary page here (not used).

## 2. Source vs RefBot (seed 500, the S4/S5 RefBot world 0; `.s5rtmp` probe, shares of all compute)

F5 = RefBot before S5R (master a829f0a); S5R = after. "Research" = experiments + capabilities agents. AI FTE = AI
researcher-equivalents (departments/workfit.ts). SAR is day 658 (F5) / 655 (S5R) in this world.

| | source (AI 2027) | F5 RefBot d0 / d400 / d700 / d900 | S5R RefBot d0 / d400 / d700 / d900 |
|---|---|---|---|
| safety staff | ~5% of research effort [I, AI goals]; ~10 alignment researchers in the silo, Oct 2027 [E] (≈ 3–5% of 200–300 privileged staff [I]) | 180 / 260 / 260 / 260 of 1,420 / 1,900 / 2,180 / 2,420 capabilities researchers (11–12%) | unchanged (§3: four line teams) |
| safety research compute (lines + safety agents) | alignment share 4 → 3% of internal; on experiments + automation 0.32% (2025) / 0.30% (2026) / 0.81% (Q2 2027) / 1.23% (Q4 2027) [I from the table] | 1.60 / 1.69 / 2.43 / 2.80% (5–6× the source in 2025–26) | 0.33 / 0.34 / 0.84 / 1.26% |
| safety pool (split.safety) | — (the game's pool = monitors + lines + safety agents + investigations) | 2.0 / 2.1 / 3.0 / 3.5% (SHARE_REF) | 0.42 / 0.43 / 1.06 / 1.59% |
| internal monitoring | fn 51: 1% of compute covers 1/10 of forward passes with a 10%-cost distilled (weaker) monitor, Sep 2027 [E]; table: monitoring 2–4% of all compute incl. external (inference ÷ 20) [E] | 20% of the pool: 0.40 / 0.42 / 0.61 / 0.70%; same-model monitor on research uses; coverage 1 | 20% of the pool: 0.08 / 0.09 / 0.21 / 0.32%; coverage 1 (spend does not change coverage: §4) |
| safety AI labour vs capabilities AI labour | alignment 3% of research automation [I, table]; "an army of Agent-3 copies" [E] | 0 / 3.8× / 0.08× / 0.06× (d400: 324k vs 85k AI FTE: safety had more AI labour than capabilities) | 0 / 0.03× / 0.03× / 0.03× |
| Trusted to AI (F5: t = (believed oversight − 0.4)/0.4, lowered until believed sabotage per result ≤ 10%) | high: "Step 3, using the model to align the next generation, is therefore underway"; "Agent-3 is in charge of testing Agent-4's alignment"; "trusting Agent-3's research too much was part of how they got into this mess" [E] | 0 / 0.6 / 0.4 / 0 (40-world mean at SAR 0.13) | 0 / 0.1 / 0 / 0 (mean at SAR 0.09) |
| opaque reasoning | neuralese from Agent-3 (SC, Mar 2027), before SAR (Aug 2027) [E] | P17 gated at Lg ≥ 9.5: adopted after SAR in all 40 worlds; latent internal model by ~d900 | unchanged |
| sabotage of safety research | Agent-4 "sandbags on the small fraction of alignment research that it thinks is actually on track to solve the problem or reveal Agent-4's scheming" [E] | SAFSAB: a uniform share of the safety agents' own labour lost + FALSE results (∝ the work AI does) | unchanged |
| U − L (this world) | lab "far from a full understanding" (Apr 2027) [E] | +1.2 / +1.1 / +0.55 / −2.0 (SAR +0.78) | +1.2 / +0.69 / −1.38 / −5.5 (SAR −0.49) |

## 3. Changes (bots/ref.ts; RefBot only: the race, safe, mixed and capex2x bots keep their own options)

1. **Safety compute share (`refSafetyShare`, `REF_ALIGN_SHARE`)**: RefBot's safety research (line experiments + safety
   agents) = a/(1 − a) × the reference research compute (experiments + agents of shareRef), a = the table's alignment
   share (4% at 2025.5 → 3% from 2026.5); the pool adds the monitors' and investigations' share on top. Before: the
   pool was SHARE_REF's safety row (2 → 3.5%, ≈ the table's monitoring row), 80% of which went to research: 5–6× the
   source's alignment experiments + automation in 2025–26, ~2.3× in late 2027. SHARE_REF itself is unchanged (the
   rivals and the other bots read it). The freed compute goes to the other rows in proportion (withFixed).
2. **Safety agents (`refSafetyAgents`)**: weekly, the safety package's share of the pool = the research part of the pool
   × agents ÷ (experiments + agents) of the lab's own split (the Auto best mix), so the safety research is mixed like
   the capabilities research and safety AI labour = a/(1 − a) of the capabilities agents' on the same model. Before: the
   package default (20% of the pool), which in 2026 gave safety 3.8× the capabilities agents' AI labour (the Auto mix
   puts ≈ 1% of research on agents then) against the source's ~95% of research effort on capabilities.
3. `refAct(s, api, o, lines, sciTeams)`: RefBot's turn as a function (refBot.act calls it with REF_PLAY, REF_LINES, 4)
   so S5's variants reuse it.

Not changed, with reasons:
- **Staffing** (260 safety researchers ≈ 11% of research staff vs the source's ~5%): whole teams (TEAM_SIZE sci 40,
  RE 100) cannot staff the four agenda families the source names (Apr 2027: debate, model organisms, bottom-up
  interpretability, control, probes, honeypots; AI goals forecast: "model organisms, scalable oversight, and mechanistic
  interpretability", "testbeds informed by model organisms and (b) honeypots") at ~5%: four lines need ≥ 160 scientists
  + the start RE team. Measured: two line teams (the start's 180 heads, 7.6%) drop believed U − L at SAR by 1.3 levels
  (mean, 20 paired worlds) and true U − L by 4.9; kept as S5's staffing check instead.
- **Trusted to AI (F5)**: the source's lab trusts its AI with alignment work more than RefBot (≈ 0.1 at SAR). With
  t = 1 believed U − L rises (+0.41 mean, 20 worlds) and the share below falls 60% → 45%: the game's sabotage does not
  bite the way the source's does (§4), so raising trust alone would move away from the source's outcome for a mechanism
  reason. Left for the targeted-sabotage mechanism.
- **Neuralese timing**: AI 2027's Agent-3 reasons in neuralese at SC (Mar 2027), before SAR; RefBot's P17 gate (Lg ≥ 9.5,
  v2's SC-era tier) adopts P17 after SAR in all 40 worlds and its latent base follows ~4 months later. Ungated (P17 from
  day 0) the latent internal model still arrives after SAR in 17/20 worlds and SAR moves +18 days. A capability-path
  change (T1, G_SC): for the lead, not done here.
- **Monitor model**: the source monitors with weaker models (Agent-2 on Agent-3, Agent-3 on Agent-4); RefBot uses a
  copy of the watched model. No effect on U (S5); it moves believed oversight, Trusted to AI and incident catches (the
  oversight / control calibration): not changed here.

## 4. Mechanisms the sources imply that the game lacks (described, not built)

- **Targeted sabotage of safety research.** AI 2027: Agent-4 sandbags "the small fraction of alignment research that it
  thinks is actually on track to solve the problem or reveal Agent-4's scheming; the majority of alignment research is
  not like that." The game's SAFSAB loses a uniform share of the safety agents' labour and adds FALSE results ∝ the
  work AI does, so handing more work to AI still raises U (t = 1: +0.41) and sabotage only shows once nearly all the
  work is handed over (×2 sabotage at t = 1: believed −0.26, true −1.55; at RefBot's t ≈ 0.1: noise). A targeted act
  would hit the results that move the critical traits' detection (the deception/scheming tools and their validation)
  rather than labour at large.
- **Monitoring coverage from monitoring compute.** fn 51: "With a monitoring budget of 1% of total compute, if monitoring
  uses a distilled system that has 10% of the cost as Agent-4, you can monitor 1/10 of the forward passes." The game
  prices the standard internal monitor at a fixed share of the safety pool (MONITOR_STD_POOL_SHARE 0.2 × the package's
  relative need) and gives it full coverage unless that exceeds the pool, so the monitors' cost scales with the pool, not
  with the watched compute, and coverage never depends on spend. With S5R's smaller pool RefBot's monitors cost 0.1–0.3%
  of compute instead of the source's ≈ 1%, with no behavioural effect. A coverage = budget ÷ (watched compute × monitor
  cost ratio) mechanism would let the source's 1/10 emerge (and would need the pool to include it).
- **Believed U is optimistic out of ignorance.** Believed U reads posterior-mean efficacy and the validation lead (free
  safety research engineers per line with tools): fewer results keep posteriors at their priors and leave more
  engineers per tooled line. So halving RefBot's safety compute does not lower believed U (mean +0.29, 20 paired worlds;
  true −0.64) and doubling it does not raise it (+0.60; true −0.20, noise): more research moves believed U toward true U,
  which is below L in ~75% of worlds. Not a bug (§3.5.7 by design), but it means "less safety compute" is not a monotone
  lever on the displayed U; the S5 checks use staffing instead and read true U alongside.

## 5. S5 restated (scripts/v2/safety.ts)

- **S5 RefBot**: "under RefBot (AI 2027 alignment share), believed U falls below L by SAR in ≥ 50% of worlds" (the 40
  S4 RefBot worlds; U − L = understanding().margin). Threshold: AI 2027's OpenBrain is the authors' "best guess" ("Our
  fictional OpenBrain represents our best guess but it could easily be significantly more--or significantly less"), and
  by SAR (Aug 2027) its safety team is "far from a full understanding of how Agent-3 works" (Apr 2027), "Step 2,
  verifying that the model is aligned, is inconclusive", and "Bottom-up interpretability doesn't work" (Sep 2027). So in
  the reference lab the lag should be at least as likely as not: ≥ 50%. The authors' hedge on effort is the spread
  across worlds, not a reason for a lower bar. True U − L (hidden) is printed alongside.
  Measurement fix: the pre-S5R check read L = 0 when the internal model at SAR was still in evaluation (≈ 25% of worlds),
  counting those as U ≥ L; understanding().margin uses the lineage fallback.
- **Mechanism checks** (paired worlds: the first 20 RefBot seeds; "deepens" = mean U − L at SAR lower, believed and
  true):
  1. opaque reasoning: the same SAR states with the internal model in neuralese (cot 'latent': λ2 −2, COT monitors
     blind, CoT-loaded agendas' efficacy shifted; AI 2027's Agent-3/4);
  2. less safety staffing: RefBot with half its line teams (AG18, AG02);
  3. sabotage: Trusted to AI 100% with the SAFSAB rate × 2 vs Trusted to AI 100% (RefBot's own trust is too low for
     sabotage to show, §4).
- **S5 mixed** unchanged ("Mixed-bot funding keeps U ≥ L − 0.5 up to SAR (median world)").

## 6. Results (40 RefBot worlds = S4's seeds 500–539; mechanism checks on 500–519)

`run.ts --tier full --only safety,safetyrates,sabotage` (one run): safety 21 / 0 / 0, sabotage 25 / 0, safetyrates
19 / 0 / 7 WARN.

| | before (F5 RefBot, master a829f0a) | after (S5R) |
|---|---|---|
| S5 RefBot: believed U < L at SAR | 35% of 40, median U − L +0.34 (the pre-S5R test: +0.36…+0.60, 30–38%, with L = 0 for models in evaluation) | **60% of 40, median −0.55: PASS (≥ 50%)** |
| true U < true L at SAR | 68%, median −2.29 | 75%, median −4.35 |
| mean SAR day | 759 | 756 |
| S4 RefBot P_mis at ASI ∈ [0.55, 0.85] | 0.53–0.57 (fails / on the edge since E1) | **0.725 PASS** |
| S4 safe-only ≤ 0.25 | 0.018–0.05 | 0.050 PASS |
| S5 mixed (median min margin ≥ −0.5) | +0.03 | +0.11 PASS (unchanged bot; U at SAR 11.79 vs RefBot 10.14) |

Mechanism checks (mean U − L at SAR, believed; true in brackets; all PASS):
- neuralese (same SAR states): −4.35 vs −1.17 [−6.55 vs −4.70]; U < L in 75% vs 60%.
- half the safety line teams: −2.47 vs −1.17 [−9.55 vs −4.70]; 65% vs 60%.
- sabotage × 2 at Trusted to AI 100%: −1.02 vs −0.77 [−6.01 vs −4.46]; 45% vs 45% (the believed share does not move:
  the weakest of the three, see §4).

Other suites (test:quick on the S5R code): fixtures stale (challenger / spinout day 400: RefBot changed; expected, not
rewritten here); worldfx F11 2027 revenue $97.3B (after FIN $86.0B; the smaller safety pool leaves more compute to
serving; → MKT), A2a 6.7% and W4 23.2% (known); serving A5 E9 ×3.95/yr (known ×3.99, → MKT). safetyrates: F5 eval
awareness of RefBot's internal model at end 2026 54.8% [41.1–72.5] is now above its 20–50% band (after FIN in band,
50.6% at M9) and AF 26.6% (after FIN 21.9%, → AF): a smaller safety programme leaves those traits higher (fewer
results, AG18's honesty / anti-scheming training later); F6 persistence rows 71–74% (known).
