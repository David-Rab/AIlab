# R&D audit: synthesis

Inputs: six area audits (CAP capability research, SAF safety research and tools, INP people / AI staff / compute, TRN data / environments / runs / evals, PRD models as products, MEA measures / milestones / leads / rivals), their adversarial verifications, and the earlier legacy sweep (LEG). All at master ea624ae. Verifier verdicts and severities override the auditors'. No finding was marked WRONG. The PARTLY corrections are applied (list in §0). The issue IDs are the area files' IDs; the area files hold the evidence.

Totals: 178 area issues (CAP 28, SAF 28, INP 28, TRN 36, PRD 29, MEA 29, including the verifiers' "missed" items) plus 12 legacy items. After merging duplicates, that is 12 themes, 47 confirmed bugs, one deletion batch and 21 designer decisions.

---

## 0. Verifier corrections applied (they change what a fix must do)

- CAP-01: pace and lead conversions are not really M consumers (rate ≈ measured stack rate). Action previews do read `prodCache.elast`, so they move with M.
- CAP-08: the AI-ideas multiplier is lab-wide, so leaving it out does not change the allocation. The missing value terms are taste and effect size.
- CAP-14: build.ts:334 is a live message. Only research.ts:530 is dead.
- CAP-17: most of the "contradictions" are just L↔OOM conversions. The real mismatches are P07 (1.5 vs 1.2) and P09 (0.6 L vs 0.3 OOM).
- CAP-23: confirmed as a double charge. MODEL-V3 §5 gives run operations to research engineers, so the engineers' run upkeep is the extra charge. CAP-V1 adds that the research-engineer side has no effect.
- INP-02: +3 RE teams cut a saturated project's rate by 3–7%, not 16–23%. The harm is real only while every project already has its cap. INP-V01 adds that the 75% share cap starves the last project.
- INP-07: severity lowered to medium, because RefBot never has spare serving.
- INP-10: features are filtered by work type, and the effect is disclosed. What is missing is a per-feature delta.
- INP-14: stars are capped by the gate, so both functions agree today.
- INP-25: the Agents popover does show build capacity for the eng lane. The gaps are re-normalisation and m_IDEAS.
- TRN-02: this is the deliberate "online learner", and rivals get the same free re-application (TRN-V01). Any fix must cover both sides.
- TRN-03: the slopes are 2.01 / 0.86 / 0.64 L/OOM, and `oomOfLevel` is an exact inverse (a duplicate, not a second rate).
- TRN-05: benchmark rows do have consumers (horizon → products, danger flags → China/intel/endings, the external-evaluation gate).
- TRN-16: an external eval does have one real effect, the `externallyEvaluated` release gate.
- PRD-01: lineup students are the deliberate, sourced TIERS design. Removing them is a design call, not a bug.
- PRD-03: `cheapestAt` is still used by scripts/v2/serving.ts.
- PRD-11: the US friction cut survives the host's retirement, and the "+ pack" button picks another sector.
- PRD-19: the ×3 premium is shown, but mislabelled as demand (PRD-V02).
- PRD-24: Restricted ×0.3 is shown.
- SAF-14: the glossary does state the halving. It implies recovery, which never happens.
- SAF-17: agents.ts removed a different gate.
- MEA-02: the slope range is 0.16–12.96 L/OOM.
- MEA-10: the resulting oHalf is already world-independent OOM. The issue is provenance and bridge code, not wrong decay.
- MEA-14: diffusion continues from the leader lab whenever it is ahead of the player, whoever leads.
- MEA-18: the knot-aligned thresholds (10 / 12 / 13.5 / 15) are consistent across presets. Only the between-knot ones vary physically.
- MEA-20: there are about 9 distinct scales, not 12.
- MEA-23: rivals and player follower starts use the same conversion. Only China differs.
- MEA-25: raised to medium, because it reaches the final score (MEA-V02).

---

## 1. Executive summary

Most issues come from seven root causes:

1. **The v3 rebuild added new mechanisms next to the old ones instead of replacing them.** There are two research steppers (capability, safety), a third "unit project" readout that also steers the daily research mix and every preview, a v2 rolled path for two nodes, two people allocators, seven ways to make a model, four ways to make a smaller model, and a rival aggregate that copies only part of the player's model.
2. **v1/v2 coordinates survive as converters.** These are display levels (LEVEL_PER_OOM 1.2 against a λ slope of 0.16–13 L/OOM), progress-years (B_G_PER_Y at about 43 sites, plus a constant (1 − share) "compute" term in every lead), R&D multiplier M½ for safety, and a start state solved on the v2 coordinate. As a result, "superhuman coder" has four definitions and "how far ahead" has seven.
3. **Effects are not attached to things the player owns.** Phantom models (lineup students, a free-tier student, copy variants), free assets (start-quality suites for families unlocked later, a stream that re-pretrains for free), silent re-routing of spare compute, and live switches ("a team is on this line" turns tools, monitoring, healing and a harness on and off).
4. **Flat constants stand in for missing mechanisms.** Paradigm multipliers that ignore the research result, a taste lift set by a compute-share ratio, 30% withheld headroom, design offsets from v2, feature enablers outside the market, and per-lab efficiency fits (LEADER_CAL, CHINA_CAL, K_DIFFUSION) that stand in for channels the rivals lack.
5. **What the player is told is not derived from what happened.** The measured level does not come from the evals. "Realised" recipe values are hidden truth. Safety Health is a heuristic, not a posterior. Dozens of preview lines are hand-written numbers that nothing applies.
6. **Allocation defaults hide their side effects.** Some demands are infinite (tuning), fixed caps starve the last project, Auto gives up about half of build capacity for a few % of a proxy, the safety pool can run at 160%, and nothing is ever shown as idle.
7. **Some inputs are read at launch and others at completion.** Data is drawn, and some research effects are read, when the run completes rather than when it launches.

The fix is the same shape everywhere: one mechanism per job, in OOM, attached to an owned thing, with readouts and previews computed from that mechanism.

---

## 2. Root-cause themes (ordered by importance to a coherent, explainable R&D game)

### R. One research engine for capability and safety, with readouts measured from it
- **Problem.** Capability projects run per project (research.ts). Safety projects run on a separate stepper with its own units, a candidate pool whose beliefs change nothing, results that land on other nodes, and nodes that can never finish. P27 and kyc still use the v2 rolled path at prodCache.M × √capacity. A fourth model, the "unit project" (evalV3), computes "research speed" and also drives the daily Auto mix, rolled nodes, government, the tutorial, P24 and every hire/agent preview. Lifecycle residue adds to this: a zero-length Result stage, drop and pick rules that disagree, batching that changes the rules and the counts, three effort/ETA formulas, and one node record carrying three lifecycles.
- **Covers.** CAP-01, 09, 11, 13 (part), 14, 15, 16; SAF-01, 02, 08, 13, 18, 24, V02; INP-03, 06, 15 (stepper part); LEG cashCost / OLD_EFFORT_DAYS.
- **Target design.**
  - One `stepProject(dept, project)`: ideation → small test → scale / validation → build-in, in one set of units (C_UNIT, RE_UNIT, the person-month).
  - A candidate is dropped when the pool holds a better one. A project fails as "gave up after N weak candidates", with the odds still standing.
  - Unlocks are a single works / doesn't stage with no effect band.
  - Safety differs only in two things: what the truth is (agenda efficacy) and what a result is (a tool or method, theme O).
  - "Research speed" is what the engine did that day: candidates and test work per project, OOM/day per stack. There is no second model.
  - One ETA function and one effort readout, both from `stagesOf`.
- **Player sees.** One RESEARCH portfolio for capability and safety, with the same stage track, ETAs that agree everywhere, and a speed that is the speed the projects actually run at.

### A. One allocator for people, AI staff and compute, with real demands and visible idle
- **Problem.**
  - Auto mix: Auto maximises the proxy's experiment throughput and ignores the engineering and frontier agents paid from the same slice. At day 600 that is 350 vs 755 team-weeks/week of build capacity for about 6% of M.
  - Engineers: tuning has infinite demand and soaks up research engineers and FLOP. The 75% experiment cap leaves a 7th project with zero engineers while 4 teams tune.
  - Safety: safety engineers follow a fixed priority with a 50% cap, and the player cannot steer them. Monitors, safety agents and lines claim the safety pool independently (up to 160%).
  - Silent and wasted work: spare serving and training compute is re-routed silently. Run operations are charged twice, and the research-engineer side has no effect.
  - Planners: the capability planner maximises candidates per day, not value. Safety auto-assign staffs unqueued lines, which switches on line effects.
  - Layout: the compute split is nested four levels deep across three panels.
- **Covers.** INP-01, 02, 07, 08, 11, 15, 16, 17, 18, 19, 21, V01, V02; CAP-08, 18 (tuning part), 23, 24, V1; SAF-03, 23, 24.
- **Target design.**
  - **People.** Each department has one needs list in the player's order: run ops, cases, patches, tool re-validation, project experiments by priority, and tuning (only if headroom stays, DD-12). Each need has a real demand that falls to zero when there is nothing to do. Leftover staff show as idle.
  - **Scientists.** One planner for both departments: teams wanted plus value per day.
  - **AI staff.** Explicit packages per use (engineering, experiments, ideas, safety experiments, safety ideas), each with a model, scaffolds, a monitor and H100e.
  - **Compute.** One flat allocation to uses with presets, shown as one bar. Nothing is re-routed silently.
  - **Auto policies.** They are suggestions that state their objective and their cost.
- **Player sees.** LAB = Workforce + Compute allocation: one bar for compute, idle visible, each automatic policy with a "why".

### U. One capability currency (G in OOM) and one conversion to player levels
- **Problem.**
  - The mechanics run on OOM, but level offsets enter at a fixed 1.2 L/OOM while the display slope is 0.16–13 L/OOM. Hazard curation and benchmarks use a ×2 rule, and REEVAL_DG goes through 1.2.
  - `oomOfLevel` is a copy of `gOfLevel`. `versionOom` makes a G→λ→OOM round trip that is capped at λ 15. Safety half-points are v2 M½ values converted on a hidden ai2027 path.
  - Data is stated in progress-years. The start state is solved on the v2 coordinate.
  - Domain difficulty lives twice: REF_OFF for display and benchmarks, REF_DELTA for fit.
  - The market computes α, the PHYS gate, control and bestPublic from v2 display levels with a second set of setting offsets (depOffset). serveCost ratios carry FLOP per token.
- **Covers.** TRN-03, 18, 25, 26, 27; MEA-02, 04, 05, 06 (start part), 08, 09, 10, 23, 24; SAF-12; PRD-06 (unit part), 07, 17; CAP-17; LEG calShift / REF_OFF.
- **Target design.**
  - Every mechanism reads G or G_d.
  - λ(G) is one display-only function (`oomOfLevel = gOfLevel − G_V0`) and is never an input.
  - Domain difficulty lives only as human reference points in OOM.
  - Every offset, threshold, half-point and gap in the data is stated in OOM.
  - The start state is data: G(V0) per world plus B0 and V0 recipe ages.
  - The market reads OOM fit, horizon and coverage.
- **Player sees.** L as a summary derived from G, never driving anything. Every option and offset quoted in OOM, with L in the tooltip, converting the same way in every world.

### O. Owned things, not phantoms or live switches
- **Problem.**
  - **Phantom models.** Every sector product and every rival model sells three untrained students. Chat's free users run on a phantom one-year-behind student. Gov and Trusted "variants" are free, instant copies that differ only by a label.
  - **Free assets.** A family unlocked later gets a free start-quality suite. The stream re-applies today's whole recipe to a base for a flat 15% of the training pool. Continue runs train on tokens that are never drawn.
  - **Live switches.** "Line staffed" switches fix tools into every run, AG07 monitoring, AG18 healing and the AG17 harness. Built product features silently boost internal R&D.
  - **Things that do not work.** The synthetic data mix can never be launched. Expert data is three assets in two units, and a research node (P12) books $1B.
- **Covers.** PRD-01, 02, 03, 05, 10, 11, 14, 15, 22, V01, V04; SAF-04, 05, 17, 23; TRN-01, 02, 04, 07, 14, V01; INP-07, 08, 10, 11; MEA-12.
- **Target design.**
  - Every effect comes from something the player trained, built, bought or set, and can see.
  - Smaller sizes are real distilled versions. A product's tiers are an ordered list of those versions. Gov and Trusted are product settings; "open" is a release act.
  - A known fix method is a run-design option with its cost. Monitoring comes from monitors. The harness is a built asset with upkeep.
  - A suite starts empty and is bought with expert data. The stream is a real scheduled run on the FLOP it actually spends.
  - Idle compute is shown as idle.
  - Automatic policies may create or assign these things ("distil a cheap tier", "use all known methods"), but the things themselves are visible.
- **Player sees.** MODELS lists every model that serves customers, with its real size. PRODUCTS tiers are your models. SAFETY lists the tools you own and their upkeep.

### E. Typed effects in physical units, not flat constants standing in for mechanisms
- **Problem.**
  - **Paradigms.** Most "axis" paradigms run a full effect-size lifecycle and then throw the result away. P13 (×1.5 FLOP), P05 (×1.3 every AI FTE, safety included), P20, P24 (+0.8 progress-years) and P19 (which undoes a −0.5 L penalty) are constants in their consumers.
  - **Research constants.** AI taste depends on a share ratio (φ = 1 at any nonzero default share). Headroom (30%) and TUNE_K are [D] with no mechanism.
  - **Run design.** Design options are v2 constants. The RL budget is a three-row table shown as FLOP. RL family `v` values are quoted as level gains the engine never applies.
  - **Safety tools.** Fix tools are flat edge multipliers that ignore tool strength. The dead-end latch halves a line's speed forever. Tool upkeep and cases are made-up formulas.
  - **Products.** Feature enablers and hazard multipliers are flat. Leaks ignore volume and KYC is a flat 2%.
  - **Calibration fits.** LEADER_CAL (refit about 10 times), CHINA_CAL and K_DIFFUSION are fitted to targets.
- **Covers.** CAP-02, 05, 13, 18, 22; INP-05, 06, 09, 22, 23; SAF-06, 07, 11, 14, 16, 19, 22, 25; TRN-09, 10, 11, 19 (mix), 20, 21, 23; PRD-08, 16, 18, 21, 24; MEA-13, 14.
- **Target design.**
  - Every research result and option carries one typed effect in a physical unit (stack OOM, domain OOM, data efficiency, expert tokens, AI-labour coverage or horizon, tool strength), scaled by the drawn result.
  - Fix-method multipliers scale with s0·e·D(x).
  - [D] values stay only where no source or mechanism exists, are tagged and are shown as [D].
  - When a target fails, the missing channel is added (for example, rivals' paradigm adoption). The constant is not refit (Emergent outcomes).
- **Player sees.** Node cards and option chips show the number that actually acts, in its own unit, and tooltips trace it to its source.

### M. Beliefs and measurements come from observations
- **Problem.**
  - The measured level is the true level plus one noise draw. The 19 benchmark scores, elicitation and sandbagging never reach it (the glossary claims they do).
  - The Recipe's "realised" value is the hidden truth revealed on a date, sometimes by a distilled model that does not embody it.
  - Safety Health is a Beta updated by a rule that does not track efficacy.
  - Believed understanding has a validation lead that the truth does not have.
  - Safety candidate beliefs exist but change nothing.
  - Sabotage shows only as slipping ETAs.
  - The run card's ±0.25 L band reveals the true level.
- **Covers.** TRN-05, V04; MEA-17; CAP-03, 10, V3; SAF-01, 10, 15, 16, 26.
- **Target design.**
  - The measured domain level is fitted from that domain's benchmark scores, with elicitation and sandbagging included. Anything that "knows" (player, government, RefBot gates, acts) reads the measured value; physics reads the truth.
  - "Realised" is the eval delta of a model that embodies the effect.
  - Safety Health updates only on works / doesn't outcomes.
  - Believed understanding reads believed tool strength and oHalf only.
  - Each line shows expected vs observed results per year.
- **Player sees.** "L 7.3 ± 0.2 from your evals", which a sandbagging model can fool. A Recipe whose "measured" values really are measured.

### L. One milestone predicate and one lead clock for every lab
- **Problem.**
  - **Milestones.** The player's milestones are work-type criteria. Rivals' are λ crossings. Notices, acts and government read measured-level crossings, and the EndScreen uses v1 names. Endings compare a rival's λ-ASI against the player's work-type ASI. The player's own record mixes rules at day 0.
  - **Lead.** Lead has seven definitions. Pace = rate + a constant (1 − share) term that stands in for compute growth and vanishes at SC.
  - **Rates and score.** gRate is seeded at 0.83 OOM/yr and counts diffusion inflows and base-size re-evaluation as research. The final score reads rival-vs-rival `leadBetween` and a stand-in trait model.
- **Covers.** MEA-01, 03, 07, 18, 22, 25, 26, V01, V02; TRN-17; INP-04; CAP-12, V2.
- **Target design.**
  - One `versionMilestones` predicate for every lab. Rivals use a reference-profile build.
  - One `lagDays(follower, leader)` on recorded G histories, and pace = the slope of a lab's own frontier G. Intel adds noise to the same lag.
  - Between-knot thresholds are restated in OOM or coverage. Knot-aligned thresholds read the milestone predicate.
- **Player sees.** Milestones shown as criteria met. Lead in days with one meaning. Endings that compare like with like.

### T. Two training acts, everything frozen at launch
- **Problem.** There are seven ways to make a model, each with its own rules. IDA is recognised by its name string. A continue run draws no data. A base run re-draws its data at completion. Several research effects are read at completion (domainG, the serving FLOP part, P07, P24). The stream updates the build but not the domains. UI and engine defaults disagree. Tokens per parameter is a headline control with a needless node gate. The recipe depends on run size through hidden headroom.
- **Covers.** TRN-06, 07, 08, 15, 28, 30, 31, 32, V02; CAP-04.
- **Target design.**
  - **Pretraining** (new base, continued base, or a distilled small base on a teacher's outputs) and **RL** (on a base or a version, optionally with the teacher as grader).
  - A run kind field replaces name checks.
  - The data draw, recipe, typed effects and suites are snapshotted on the run at launch and read only from the snapshot.
- **Player sees.** TRAINING = the next run: one blueprint with two acts, where what you launch is what you get.

### P. Products as owned sellers in one market
- **Problem.**
  - A product is a channel. The player's sector share is split among its products by fixed weights, so a weak second product takes hours from a strong one and Enterprise focus ×3 is zero-sum.
  - Enablers act after the choice and count twice on Chat. Trusted's ×3 premium is applied after the choice and labelled as demand.
  - The free-tier 0.6 blend lowers paid conversion. The appeal shown on Models is not the appeal the market uses.
  - Capability reaches the world by two paths (OOM fit and v2 display levels). The Agents product is gated three times. A blended lineup sells main-model agent capability at the students' price.
  - Exposure follows the compute slice, not usage.
- **Covers.** PRD-04, 06, 07, 08, 09, 19, 20, 21, 25, V02, V03.
- **Target design.** Each product is its own seller in the surplus choice, with tiers of real versions. Tools (features) act once, inside the offer: scaffold, horizon or coverage opener. Premiums are priced in the offer. Certification belongs to the product. Capability reaches the market by one OOM path.
- **Player sees.** PRODUCTS = models + tools + markets. It can answer "which of my models does this customer use, and why did this product earn X?"

### X. Rivals run the player's functions
- **Problem.**
  - **Research.** Rival research is a fixed portfolio with no paradigms, a φ of 1 and a min(E, I).
  - **Recipes and models.** Recipes are compared with the player's at a different FLOP. Rivals' AI labour reads general G, and their domain profile is fixed. They have no data, suites or evals.
  - **Free advantages.** They get continual learning free at L 8.5 (the player must research P08 and pay).
  - **Start and diffusion.** Start recipes come from a different rule. Diffusion is one-way, from one lab.
  - **Leaks.** Leaks are sized by the *player's* pace.
  - **Day 1.** Rivals run both lab policies on day 1.
  - **Fits.** LEADER_CAL and CHINA_CAL make up for the missing channels. The sampled world reuses ai2027's fits.
- **Covers.** CAP-06, 07, 22; MEA-06, 11, 12, 13, 14, 15, 21, V03; TRN-22, V01.
- **Target design.** Rivals stay aggregate, but they call the same pure functions as the player:
  - the line-rate law and surviving typed effects, with an adoption rule;
  - `workFit` on a reference-profile build;
  - `baseG` and `rlGains` with a reference portfolio and suites;
  - one start rule;
  - the same continual-learning route;
  - one diffusion rule for every lab, from every public model above it;
  - leaks sized by what leaks.
- **Player sees.** Rivals respond to the same levers, and intel can say why a rival is fast.

### V. Previews are the mechanism run on a copy
- **Problem.**
  - The house rule is "previews match effects", but many previews are hand-written.
  - People: hire chips (Strong science "taste ±0", engineers understated 2–11×, safety "+heads"); agent previews (a fixed security −0.05).
  - Training: runEvals (gains never applied, and the one real gate effect is left out); stream / IDA / variant previews (constants).
  - Products: product actions show costs and risks nothing applies; the pack preview uses v2 arithmetic.
  - Leads: A4 / E16 / C6 previews give lead days for recipe increments; a unitless "progress" renders as L.
  - Other: three ETA formulas.
- **Covers.** CAP-16, 21; INP-13, 14, 25, V03; TRN-02, 08, 13, 16, V03, V04; PRD-05, 12, 13; MEA-15, 19.
- **Target design.** Each preview re-runs one day of the real mechanism on a copy, or calls the same effect function. It shows the result in the target's own currency (project ETA, build team-weeks per week, line cycle days, OOM). Preview currencies are typed. A line with no applied effect does not exist.
- **Player sees.** Hire and setting previews that come true.

### W. One word and one unit per thing
- **Problem.**
  - "Line" has three meanings and "idea" four. "Axis" bundles unlocks with multipliers.
  - Safety uses agenda / line / follow-up / result / finding / tool / technique for overlapping things.
  - There are eleven kinds of "strength" and four of "clarity".
  - "AI share" has four definitions, and engineers get two values.
  - People are counted as heads/150, heads/100, capacity heads/40 and SAF_RE_UNIT 50, with no "team-equivalent" glossary entry.
  - Players see about 9 capability scales. "Research input so far" is not what the pool is made of.
- **Covers.** CAP-10, 19; SAF-09, 19, 20; INP-12, 16; MEA-20; TRN-31.
- **Target design.**
  - **Words.** Capability "directions" (pools), ideas, unlocks. Safety lines (agendas in data), projects, results, tools (detect / contain), methods (fix). One tool strength. Case progress.
  - **Shares and units.** "AI share" = the share of effective labour done by AI. Work counted in person-months.
  - **Capability scales.** Five: G (OOM), L (display), work-type criteria, horizon, lead days.
- **Player sees.** A glossary in which every term has one meaning and one home.

---

## 3. Real bugs (wrong today; confirmed or reproduced)

"Now" means the bug can be fixed independently of the redesign. "With X" means it should be fixed inside that theme or decision. Tier is the test tier the fix needs.

### 3a. Outcomes are wrong (27)
| Bug | Source | One line | Fix now? | Tier |
|---|---|---|---|---|
| B01 | TRN-01 | A Synthetic base can never be launched ("needs a teacher"), and the check overwrites the "Needs P10" lock reason (reproduced) | Now | quick + data |
| B02 | TRN-15 | A base re-draws its data from the portfolio at completion, not at launch (reproduced) | Now (schema bump) | cal |
| B03 | CAP-04 | The launch freeze misses domainG, the serving FLOP part, P07, P24 and the base's draw | Now (with B02) | cal |
| B04 | TRN-14 | A family unlocked later (computer use) gets a free fidelity-1 suite and counts in broad RL weights and upkeep | Now | cal |
| B05 | SAF-05 | T-FILTER's open-weights protection never applies (`post.techniques` is always empty) | Now | quick + safety |
| B06 | SAF-V01 | Fix methods and inactive tools join the upkeep set, which thins the crew and inflates "N tools fading" | Now | safety |
| B07 | SAF-V02 | A node whose own catalog row cannot fire in this world restarts forever and holds its teams | Now | safety |
| B08 | SAF-08 | Results unlock other nodes, skipping the tree's `needs` (F25 → T-INOC; rows[0]) | Now (needs check); rest with DD-15 | safety |
| B09 | SAF-14 | The dead-end ×0.5 latch never clears, though the glossary implies it recovers | Now | safety |
| B10 | INP-18 | Monitors, safety agents and lines oversubscribe the safety pool to 140–160% (reproduced) | Now | safety + cal |
| B11 | INP-V01, INP-02 | Tuning's infinite demand keeps research engineers while the 7th experimenting project gets 0. Saturated projects lose 3–7% per extra RE team (reproduced) | Now (demand tied to headroom, served last); final with DD-12 | cal |
| B12 | CAP-23, CAP-V1, INP-17 | Run operations are charged to both research engineers and engineers. The research-engineer shortfall has no effect | Now, after DD-11's run-ops owner | cal |
| B13 | INP-07 | Spare serving compute runs agents that monitor need, coverage and fleets do not count. Covert compute does count it | Now (stop-gap); final with DD-19 | safety |
| B14 | PRD-08 | The Chat enabler is applied twice (logit and users). Sector enabler hours are not capped by adoption | Now (apply once, cap) | serving + finance |
| B15 | PRD-04 | Setting a Chat mini lowers paid conversion and reach through the 0.6 FREE_TIER_SHARE blend | Now | serving + finance |
| B16 | PRD-19 | Trusted's ×3 premium is applied after the choice, so buyers never react | Now (price in the offer) | serving + finance |
| B17 | PRD-20 | A blended lineup sells main-model agent coverage at the students' price | Now, or goes with DD-01 | serving + finance |
| B18 | PRD-11, PRD-V04 | A certified pack is lost when its host is retired or relaunched (the sector cannot be re-packed). A pack that finishes with no host loses $0.4B silently | Now | products |
| B19 | PRD-V01 | Launching with effort "deep" skips building Deep think | Now (or with RD-P06) | products |
| B20 | PRD-22 | A launched product starts with every built feature off | Now | products |
| B21 | MEA-21 | Every rival runs both lab policies on day 1 (double staff growth and training) (reproduced) | Now (delete defaultLabPolicy) | cal; fixtures stale |
| B22 | MEA-25, MEA-V02 | The final score uses the stand-in rival trait model, paceOf × 0.7, and rival-vs-rival leadBetween with the (1 − share) term | Now for the trait step; lead part with theme L | deep |
| B23 | CAP-06 | Player and rival recipe G are compared at different FLOP and with different parts (theft value, leak checks) | Now | cal |
| B24 | CAP-V2 | gRate (→ Software progress, pace, C4) counts diffusion and leak inflows and base-size re-evaluation as research | Now | cal |
| B25 | TRN-V02 | The stream replaces the build but refreshes `v.domains` only when general G rises | Now, or goes with DD-05 | quick |
| B26 | MEA-V03 | The "sampled" world reuses ai2027's CAL_SHIFT and LEADER_CAL fits on a different production function | With U / X (the fits are deleted) | cal |
| B27 | INP-21 | Manual mix range [0.02, 0.98] and Auto [0.01, 0.99] differ; the comment says they are the same | Now | quick |

### 3b. What the player is shown is wrong (20)
| Bug | Source | One line | Fix now? | Tier |
|---|---|---|---|---|
| B28 | CAP-03 | Recipe sums different units per card, files domain effects as pretraining OOM, omits data effects, and labels hidden truth "measured" | Now (readout) | quick + ui |
| B29 | CAP-11 | A batch of b ideas counts as 1 adopted idea and P16 as 2, so "ideas adopted / yr" and "adopted while it trains" mean nothing in a takeoff | Now | quick |
| B30 | CAP-V3 | An RL or serving idea's "realised" value is revealed by distills and minis that never took the recipe | Now | quick |
| B31 | CAP-16, SAF-13 | Effort and ETA are shown from class values (P13 "25 TM" vs 79.6; lines "3"; safety nodes T₁·√4), not what runs; two ETA formulas | Now (one ETA function) | ui |
| B32 | INP-13 | Hire previews: Strong science "taste ±0", engineers understated 2–11×, safety "+heads" (verified) | Now (compute on a copy) | ui |
| B33 | INP-25 | The agent preview adds a constant "security −0.05" and shows no build delta when re-normalisation moves the eng share | Now | ui |
| B34 | INP-14 | The taste chip says "from quality and stars" (quality does not enter); star taste is two constants | Now | ui |
| B35 | CAP-21, INP-V03 | Research previews: reopen "+0.05 progress", κ shown as progress, autoAssign counts capability teams, "idle teams follow" | Now | ui |
| B36 | TRN-16, TRN-V03 | The runEvals preview promises gains `finishEval` never applies and leaves out the real external-evaluation release gate | Now | ui |
| B37 | TRN-02, TRN-08, MEA-19 | Stream / stop-stream / IDA previews are constants (+0.2 L, −0.1, alignment −0.1); a unitless "progress" renders as L | Now | ui |
| B38 | PRD-05 | The makeVariant preview shows staffTime +10, revenue +0.5 and approval −1, none of them applied; same for the open-variant preview | Now | ui |
| B39 | PRD-12, PRD-13 | The pack preview uses v2 arithmetic (exp(1.05), ×35, ×2.8); product actions show staff, lead, approval and trust lines nothing applies | Now | ui |
| B40 | MEA-15 | A4 / E16 / C6 previews quote lead days, but the effects are recipe increments sized by the player's pace | Now (preview); sizing with DD-17 | ui |
| B41 | PRD-V03 | The Models card shows `v.appeal` (minimal 0.7), while the market uses a separate table (minimal 0.9) | Now (one table; market re-check) | serving |
| B42 | PRD-V02 | "Demand modifiers" lists Trusted's price ×3 as demand and leaves out the enabler factor | Now | ui |
| B43 | TRN-19 | The Data panel's teacher table ignores the P10 quality cap | Now | ui |
| B44 | TRN-30 | Blueprint defaults disagree with the engine (params 1e12 vs 354B; the distill tip says "half", the engine uses 1/8; pool shares) | Now (engine exports defaults) | ui |
| B45 | TRN-V04 | The run-card gain subtracts the measured level from a prediction centred on the true level, and the ±0.25 band reveals the true level | Now | ui |
| B46 | MEA-22, MEA-V01 | The EndScreen compares work-type milestone days with v1 names and canon events (idx 2 is a different event); day-0 milestones use the λ rule | Now (names); rule with DD-09 | ui |
| B47 | copy batch | Promises with no effect or wrong text: CAP-09 failure text blames the world; CAP-12 "last two weeks" (14 weeks); CAP-24 "paused" while testing; TRN-10 tree level gains; TRN-12 T-SPEC 8 FTE-weeks and P05 "Tokens ×10"; TRN-13 cash tip; TRN-23 hardened-graders node; SAF-06 T-UNDO / T-SPEC / T-HARDEN cards and F13; SAF-16 Health tooltip; SAF-21 Codex compute share, "√ capacity", "research speed"; PRD-17 L labels; MEA-17 glossary "sandbagging biases it down" | Now | ui + lint-ux |

Total: 47 bugs (27 outcome bugs, 20 readout / preview / copy bugs). 41 can be fixed now. B08, B11, B12, B13 and B22 have a now-part and a redesign part. B26 waits for themes U / X.

---

## 4. Pure deletions (one cleanup batch)

These are behaviour-neutral: same state hashes, unless the row says "shape". Run them before everything else. Rows marked (decision) wait for DD-20.

1. **Dead v2 knot production function** (LEG, INP-20, MEA-16).
   - Move the live maths (Xces, Lrel, Phi, tasteSigma, bisect, hRef, refTotal, frontierFlop) to `production/ces.ts`.
   - Delete buildKnots / knotAt / R13_AI2027_KNOTS / refBestX / tasteCurve, plus the non-v3 branches of evalM, evalProduction and bestResearchMix.
   - Delete the dead LabInputs fields (qDep, stock, eff, tasteHire, d, mixUnit.load) and the dead readout fields (Ddata, elast.train / data, parts.base). Fix MANUAL_MIX_RANGE's justification.
   - Retire scripts/v2/identity.ts or freeze it on a fixture.
   - Shape: `TimelineWorld.prod.knots` goes, so bump the schema and drop the field.
2. **calShift bridge** (LEG, MEA-08). Delete alignedCalShift, `TimelineWorld.calShift` (shape), thresholds() and levelOfV2's default argument. Fix the capability.ts:41-43 doc. CAL_SHIFT itself stays until RefBot's gates move (RD-U07).
3. **Save migrations 1–10.** They are unreachable, because 11–14 refuse to load.
4. **Dead branches.** Tree `cashCost` (tree.ts:254, 523; treeActions.ts:71). research.ts:530 "Only finished projects can be adopted".
5. **Dead exports and fields** (LEG's ~47 unreferenced exports, plus those named in the audits).
   - Research: HEADROOM_SHARE, adoptCostTW (and its selectors re-export), gainKnowledge.
   - Readouts and data: nextModelGate / dataStockRatio / tokensRequired (and the selectors re-export); `cheapestAt` in the engine (move it to the script that uses it).
   - Safety: `beliefShown`; safety `linesWanted` / `linesGot`; `fteRef` / `fteRange`.
   - Run design: EFFORT (the duplicate of EFFORT_TOKENS), GOODPUT_FT, JOURNALS_FRAC, POST_PREF.safetyFteWeeks / honest, POST_SAFETY.honest / misuseMult (and the build field), design `flags` from postEffect / baseEffect, `base.scale` (no reader).
   - Data and models: the non-consumer usage mixes; the `'internal'` variant literal.
   - Paradigms: ParadigmDef.effect / safetyCost, and PRIOR_BY_ID in favour of PARADIGM_BY_ID.
   - Constants: the SPEED_CAP / PROD_SPEED_CAP duplicate; S_CLAMP → S_RANGE.
6. **REF_OFF columns 1–6** (TRN-27, MEA-04). Keep column 0 until RD-U05.
7. **OLD_EFFORT_DAYS / TM_PER_OLD_DAY.** FITTED_EFFORT_TM stays until RD-R07.
8. **The safety runtime migration fallback** `safFromProgress` in `safState` (SAF-13). The save migration keeps it until DD-20.
9. **Stale comments and tags.**
   - The autoAssign "both departments" docs (tree.ts:7-11, 383-387, 437).
   - All 26 BRIDGE(V6)/(V7) tags, overdue since phases E and F merged: production.ts has 10; capability, runs and tree have 2 each; the rest have 1. For each tag, delete the tag or turn it into a task row.
   - research.ts:2 ("until V6") and research.ts:404-405 (P13); researchView.ts:97; rivalModel.ts:135 ("stacks.ts recipeG").
   - capability.ts:161-164 (pm / calShift); the knots and calibration comments about pm / calShift.
   - Headers of build.ts ("1/(1 − A_eng), capped"), teams.ts, agents.ts, production.ts and Compute.tsx.
   - types.ts:546 / 566 ("+0.5 L", "FREE_TIER_SHARE"); the rivals.ts rivalSpeedMult comment.
   - Glossary entries that describe removed mechanisms (rdmult, researchMix, trustedToAI, seriousStaffing, autoAssign, IDA, stream). These glossary edits are copy and belong to B47.
10. **P26** is kept only for RNG draw order. Replace the row with an explicit skipped draw at the draw site (same hashes), or delete it at the save break.
11. **(decision, DD-20) Save floor at rev 33.**
    - Delete migrations 15–32 (about 18; about 28 with 1–10).
    - Delete their helpers: legacyG / legacyE, migratePmPa, migrateRivalPhys / migrateRivalRecipe, the safFromProgress migration, suitesFromV1, dataPortfolioFromV2, LICENCE_DEAL_SHARE, the legacy `graders` field, and the v-numbered footholds / control converters if they are used only there.
    - This unblocks the deletion of `playerStart`'s v1 imports and B_G_PER_Y (MEA-24).

Not deletions, though they look like them, because they change behaviour: `defaultLabPolicy` (B21), `post.techniques` / `trainAgainst` (B05), the sectorPacks feature with LEADER_FEATURES (RD-P08), the multi-product-per-channel code (DD-02), `kyc` (DD minor), prodCache.M (RD-R01).

---

## 5. Design decisions for the designer

Each decision lists options, a recommendation (Rec.) and the consequence. They are grouped by screen. The build plan marks the tasks that wait on each one.

**Models and products**

- **DD-01 Smaller models (lineup students, free tier).**
  - Options: (a) real distilled versions for the player, with rivals' lineups as lab state produced by their own distill step; (b) real for the player, the TIERS rule kept for rivals; (c) keep TIERS for everyone (deliberate and sourced, and the UI is honest about it).
  - Rec.: (a). The player starts with real minis. An "auto-distil a cheap tier" policy explains itself and can be overridden. With no mini, Chat's free users run on the main model at its real cost.
  - Consequence: the A5 price-decline and finance F8 checks must be re-run. Distil runs cost compute. Rivals' lineups lag their frontier.
- **DD-02 What a product is.**
  - Options: (a) each product is its own seller in the surplus choice, with tiers of real versions; Gov / Trusted are product settings and "open" is a release act; (b) collapse API, Enterprise and Agents into one sector product with channels as settings; (c) keep the channel weights.
  - Rec.: (a). Drop the multi-product-per-channel code unless (a) wants it.
  - Consequence: the revenue split emerges from the choice. CH_WEIGHT and Enterprise focus ×3 go. Finance needs a refit.
- **DD-03 Tools (features).**
  - Options: (a) product tools act only inside the offer; internal-agent tooling is a separate item owned on the research side; enablers become coverage terms; rivals acquire tools over time; (b) one item shown in both places with both effects.
  - Rec.: (a).
  - Consequence: labs that built Memory or Coding agent lose a hidden R&D boost unless they own the internal item, so research speed moves (test:cal).
- **DD-04 Sector packs.**
  - Options: (a) an owned adaptation of one product: a scaffold on that sector's work plus per-product certification that lifts friction only for that product's buyers; (b) keep the world-level certDay and the sector-wide friction cut.
  - Rec.: (a).
  - Consequence: rivals stop benefiting from the player's pack. The ×3 and the fake feature go.

**Training**

- **DD-05 Continual-learning stream (player and rivals).**
  - Options: (a) a real scheduled continued-pretraining + RL run on the FLOP actually spent, and rivals adopt it by the same route (not free at L 8.5); (b) keep the AI 2027 "online learner" re-application, but charge it and gate it the same way for everyone; (c) remove it.
  - Rec.: (a).
  - Consequence: frontier pace after the Research-agent milestone slows, so the SIAR / ASI golden dates may slip. The fix is a mechanism search, not a constant.
- **DD-06 How models are made, and the RL budget.**
  - Options: (a) two acts: pretraining (new / continue / distilled student) and RL (teacher-as-grader option); (b) keep seven kinds. For RL: (a) a midpoint in absolute FLOP or tasks, so base size matters; (b) show three honest tiers.
  - Rec.: (a) and (a).
  - Consequence: Blueprint tabs and model-card buttons change, and RL needs recalibration.
- **DD-07 Expert data and suites.**
  - Options: (a) expert data is only a suite input ("Build suite" buys it); a family unlocked later starts with no suite; fidelity = tasks × grader quality and decays without upkeep; P12 becomes a suite option; (b) keep the domain stock.
  - Rec.: (a).
  - Consequence: SOCIAL / MEDIA / PHYS purchases disappear, and the "evaluations use expert data" claims go.
- **DD-08 Measured level.**
  - Options: (a) fitted from benchmark scores per domain, with elicitation and sandbagging flowing through; (b) one noisy reading per domain, dropping the benchmark rows; (c) keep it as is and fix the glossary.
  - Rec.: (a). Anything that "knows" reads the measured level; physics reads the truth.
  - Consequence: sandbagging can fool the player and the government. RefBot gates and acts move (test:cal, deep).

**Measures**

- **DD-09 Milestones.**
  - Options: (a) one work-type predicate for every lab; knots 6.5 / 8.5 dropped as thresholds; between-knot level thresholds restated in OOM or coverage; (b) λ crossings for everyone.
  - Rec.: (a).
  - Consequence: story beats, acts and endings fire on criteria. The golden dates must be re-checked under one definition.
- **DD-10 Lead clock.**
  - Options: (a) `lagDays` on recorded G histories for all labs, with pace = own frontier-G slope; this drops the (1 − share) compute stand-in; (b) keep pace with an explicit compute-growth term per lab.
  - Rec.: (a).
  - Consequence: lead, intel, theft, open-weights absorption and the epilogue score all move (test:deep).

**Lab and research**

- **DD-11 Allocator behaviour.**
  - Options: (a) needs lists in the player's order with real demands and visible idle; one flat compute allocation with presets; the Auto research mix removed (a "suggest" button evaluates the real day, including build and ideas); engineering agents move to an engineering budget; (b) keep Auto as an optimiser over the whole objective.
  - Rec.: (a). Sub-call on run operations: research engineers operate runs (MODEL-V3 §5) and a shortfall slows runs; engineers do setups only.
  - Consequence: research speed and build capacity shift, so test:cal and a RefBot policy update are needed.
- **DD-12 Headroom and tuning.**
  - Options: (a) remove headroom: ideas land at full effect at build-in; (b) keep 30% [D] with tuning demand ∝ remaining headroom.
  - Rec.: (a), unless a source turns up.
  - Consequence: no phantom work; spare research engineers show as idle; research gets slightly faster (refit).
- **DD-13 AI research taste.**
  - Options: (a) one ideas channel: AI-done ideas carry AI taste, weighted by the AI labour share from the same CES, for both departments and for rivals; (b) φ = AI ideas FTE ÷ (AI + human ideas FTE); (c) keep the share ratio.
  - Rec.: (a).
  - Consequence: the taste lift scales with compute, which changes the takeoff shape (test:cal).
- **DD-14 Paradigm fates and rival parity.**
  - Per node: P13 deleted (EXP AI labour already models it); P05 a typed scaffold / horizon effect that keeps the deep unlock; P20 a typed AI-labour effect with a source, or deleted; P19 deleted with the RSCH penalty; P24 a stack idea in OOM; P07 becomes the long-tasks suite's horizon. Unlock nodes run a single works / doesn't stage.
  - Rivals: (a) they get the surviving effects through aggregate adoption steps at their research rate, retiring LEADER_CAL and CHINA_CAL; (b) no paradigms for rivals, and the fits stay.
  - Rec.: (a).
  - Consequence: the largest calibration risk in the plan (L effort, several cal passes).

**Safety**

- **DD-15 What a safety result is.**
  - Options: (a) one project = one question: success (its own tool or method) or dead end; discoveries, negatives and spillovers are events of a line's open study; Health updates only on works / doesn't outcomes; the candidate pool is removed; (a′) as (a), but each candidate gets its own hidden quality; (b) keep the mixed draw and only fix `needs` and unreachable nodes.
  - Rec.: (a).
  - Consequence: S5 and safetyrates need a refit. Catalog rows are reassigned, and the Codex changes.
- **DD-16 Safety operations vs research.**
  - Options: (a) a known fix method becomes a run-design option (a default "use all known methods" policy, with the cost shown); monitoring comes from the monitor deployment; healing comes from the run's safety training; the AG17 harness is a built asset with upkeep; the AG17 level gate goes; auto-assign leaves idle teams idle and flags them; tool re-validation and cases are projects on the shared engine; the dead-end latch is removed; (b) keep the "line staffed" switches but show them.
  - Rec.: (a).
  - Consequence: effects stop toggling with staffing. S4 / S5 need re-checks (deep).

**Rivals and the world**

- **DD-17 Knowledge diffusion and leaks.**
  - Options: (a) one sourced rule for every lab, absorbing from every public or open model above it on the recipe gap, with leaks sized by what is transferred; this needs a primary-source research task first; (b) keep the leader-only K fitted to "3–5 months behind".
  - Rec.: (a).
  - Consequence: the follower-start lag becomes emergent. C4, A4, E16 and C6 are re-sized.
- **DD-18 Rival training parity.**
  - Options: (a) rivals train through baseG / rlGains with a reference portfolio and suites, and their AI labour runs through workFit on a reference-profile build; (b) document them as an aggregate stand-in.
  - Rec.: (a). These are cheap pure functions.
  - Consequence: rival levels respond to data and suite strategy, and pace needs a refit.
- **DD-19 Spare compute.**
  - Options: (a) remove the spare-serving and spare-training policies, show idle compute as idle, and offer an explicit "auto-split" policy that reassigns compute and says so; (b) keep the policies and count the spare everywhere.
  - Rec.: (a).
  - Consequence: LENT_RECOVERY goes. RefBot is unaffected (its spare is 0).

**Saves**

- **DD-20 Save-compatibility floor.**
  - Options: (a) keep 15→43; (b) floor at rev 33 now; (c) declare a save break at the end of engine unification (as V1 did at rev 12).
  - Rec.: (b) now, then (c) at Phase 8.
  - Consequence: older saves refuse to load with a clear message, and about 28 migrations plus the bridge helpers go.

**Words**

- **DD-21 Naming.**
  - Rec.: capability pools become "directions". Safety keeps "lines" in the UI, with the data name "agenda". Then results, tools (detect / contain), methods (fix) and case progress.
  - Consequence: copy and glossary only.

**Small calls.** These defaults apply unless the designer objects:
- Stars help safety teams (one taste function).
- The serial-speed limit line is removed, and S8 reads copies from FTE.
- Tokens per parameter becomes a "serving cost vs capability" picker without the node gate.
- Data-mix presets become named targets on per-domain weights, with RefBot's fixed target moved to bot code. Multimodal FLOP follows from tokens, and the cashMult goes.
- The `kyc` node is removed (the KYC setting stays ungated).
- T-UNDO is wired through misuseHazards. T-SPEC and T-HARDEN fold into their options.
- The Result stage goes: four stages.
- P26 goes at the save break.
- Scrutiny is computed against the largest rival run, and `scale` goes.

---

## 6. Build plan

House style follows design/V3-TASKS.md: one concern per task, a brief made of the row plus the spec section, and stop rules as listed there.
- **Effort.** M = Opus medium; H = Opus high.
- **Size.** S ≈ ≤ 2 h; M ≈ half a day.
- **Tiers.**
  - Every engine task runs `tsc` (main and scripts) and `test:quick`. "cal" adds `npm run test:cal`. "suite" adds `--tier full --only <suite>`.
  - "ui" means `npm run build`, `test:ui`, `lint-ux` and `lint-hidden`.
  - Each phase ends with a merge wave: `test:full` once, then `test:deep` once, and a single fixture regeneration.
- **Calibration rule (Emergent outcomes).** A golden date that leaves tolerance after a task first triggers a search for the missing or mis-tuned sourced mechanism. Only the values the row names may be refit. The ±0.3 y stop rule applies.

### Phase 0: Cleanup (behaviour-neutral)
Exit criterion: identical state hashes, except the two shape changes (one schema bump).

| ID | Task | Scope | Depends | Size | Effort | Tier | Done when |
|---|---|---|---|---|---|---|---|
| RD-C01 | Retire the v2 knot production function (§4.1) | production/{knots,production,readout}.ts, new production/ces.ts, world/hidden.ts, rivals.ts, ref.ts, runs.ts, rivalModel.ts, scripts/v2/identity.ts | – | M | M | quick + fixtures | no importer of knots.ts; buildKnots never runs; hashes identical apart from the removed field |
| RD-C02 | Delete the calShift bridge (§4.2) | world/{hidden,calibration}.ts, models/capability.ts | – | S | M | quick | no reader of `w.calShift` / thresholds(); doc fixed |
| RD-C03 | Delete save migrations 1–10 (§4.3) | core/save.ts | – | S | M | quick + save | the save suite passes; revs ≤ 14 refuse as before |
| RD-C04 | Dead exports and fields, engine side (§4.4–5: research, readout, tree, products) | models/{research,researchView,tree,treeActions}.ts, production/{data,readout}.ts, core/selectors.ts, worldfx/serving.ts, data/v2/{paradigms,runDesign}.ts, models/design.ts | – | M | M | quick | the listed symbols are gone; an unused-export scan is clean for them; hashes identical |
| RD-C05 | Dead fields, safety / people side (§4.5–8) | safety/{lineProjects,view,agendas}.ts, data/v2/{agendas,tree,calibration,workTypes}.ts, departments/workfit.ts | – | S | M | quick + safety | as above; REF_OFF has one column; OLD_EFFORT_DAYS gone |
| RD-C06 | Stale comments and BRIDGE tags (§4.9) | the files listed in §4.9 | RD-C01, C02 | S | M | tsc | `grep BRIDGE(` empty or each tag tied to a task ID; headers describe current code |
| RD-C07 | P26 placeholder becomes an explicit skipped draw (§4.10) | data/v2/paradigms.ts, world/hidden.ts | – | S | M | quick | hashes identical; P26 gone from the tree data |
| RD-C08 | Save floor rev 33 (§4.11) | core/save.ts, actors/rivalModel.ts, safety/lineProjects.ts, models/suites.ts, production/data.ts | DD-20 | S | M | quick + save | revs < 33 refuse with a message; helpers gone |

### Phase 1: Bugs (independent of the redesign)
Exit criterion: test:cal passes, and golden dates are within tolerance (refit only the values named in a row).

| ID | Task | Scope | Depends | Size | Effort | Tier | Done when |
|---|---|---|---|---|---|---|---|
| RD-B01 | Synthetic base launch; Data teacher quality cap; Blueprint defaults from the engine (B01, B43, B44) | models/runs.ts, production/dataView.ts, ui Blueprint.tsx, data/v2/glossary.ts | – | S | M | quick + data + ui | a Synthetic base launches after P10 with no teacher; the lock reason is kept; one exported default set |
| RD-B02 | Launch snapshot: DataDraw, domainG, serving FLOP part, P07 / P24 effects and the base's draw stored on `run.recipe`; completion and the trait hook read only the snapshot (B02, B03) | models/runs.ts, safety/traits.ts, types.ts | – | M | H | cal + suite effective | adding data or adopting an idea mid-run leaves the run's result unchanged; schema bump |
| RD-B03 | A family unlocked later starts with no suite (B04) | models/suites.ts, departments/build.ts | – | S | H | cal | computer use has no RL until its first build; RefBot builds it |
| RD-B04 | Safety node completion: respect `needs`; an unreachable own row ends as a dead end that reads "not reachable in this world" (B07, B08 part) | safety/findings.ts, models/tree.ts | – | S | H | safety | no node is known without its needs; no project restarts forever |
| RD-B05 | Upkeep set filters fix methods and inactive tools; dead-end status recomputed daily from the posterior (B06, B09) | safety/agendas.ts, safety/findings.ts, safety/lineProjects.ts | – | S | H | safety | "tools fading" counts only detect / contain tools; a line recovers when its posterior rises |
| RD-B06 | T-FILTER read from the base's curation; delete `post.techniques` / `trainAgainst` (B05) | safety/{incidents,traits}.ts, models/{actions,runDesign}.ts, core/init.ts, pressureView.ts | – | S | H | safety | open weights with the hazard filter keep the filter's effect; schema bump if state changes |
| RD-B07 | Safety pool claims normalised in priority order, with a visible total (B10) | safety/{agents,lineProjects}.ts, departments/workfit.ts | – | S | H | safety + cal | the pool sum is ≤ 100% at the extreme settings of verify_inp13 |
| RD-B08 | RE allocation: tuning demand ∝ remaining headroom and served after every experimenting project; FLOP by need (B11) | models/research.ts, models/stacks.ts, data/v2/research.ts | – | M | H | cal | in the day-600 probe no experimenting project has 0 RE while tuning holds RE; +RE never lowers a project's rate |
| RD-B09 | One owner for run operations (B12) | departments/build.ts, models/research.ts, data/v2/research.ts | DD-11 (sub-call) | S | H | cal | each run is charged once; a shortfall slows the run |
| RD-B10 | Spare serving counted in monitor need and fleets (B13, stop-gap) | safety/agents.ts, worldfx/revenue.ts | – | S | M | safety | coverage equals covert's compute basis |
| RD-B11 | Market fixes: enabler applied once and capped by adoption; FREE_TIER_SHARE blend removed; one appeal table; Trusted premium in the offer and labelled as price; enabler row in demand modifiers (B14, B15, B16, B41, B42) | worldfx/{mix,revenue,serving}.ts, models/products.ts, core/limitsView.ts, data/v2/features.ts | – | M | H | serving + finance + cal | the double count is gone in a test; a mini no longer moves paid share; finance F8 / F11 re-reported |
| RD-B12 | Product lifecycle: pack stored on the product (moves or ends with it); no-host completion refunds and logs; launch carries built features and needs Deep think for deep effort (B18, B19, B20) | departments/build.ts, worldfx/actions.ts, models/{deployments,productOps}.ts | – | S | M | products | retire → re-pack works; a new launch has its features on |
| RD-B13 | Per-tier agent demand in blended lineups (B17) | worldfx/{serving,revenue}.ts | – (skip if DD-01 (a) lands first) | S | H | serving + finance | agent demand summed per tier at each tier's price |
| RD-B14 | Delete `defaultLabPolicy` (B21) | models/runs.ts, actors/rivals.ts | – | S | M | cal | the day-1 staff ratio equals one hRef step; fixtures regenerate at the merge |
| RD-B15 | `projectedMisAtAsi` on `ws2RivalTraitStep`; delete the stand-in (B22 part) | endings/{epilogue,scoring}.ts, actors/rivals.ts | – | S | H | deep (scoring) | no caller of the stand-in; score drift reported |
| RD-B16 | One `recipeG(recipe, F)` at a common F for player and rivals; gRate from adopted-idea deltas at fixed F, with public inflows tracked separately and no seed (B23, B24) | models/{stacks,research,tree}.ts, actors/rivalModel.ts, security/theft.ts, actors/actions.ts | – | M | H | cal | a new base or a diffusion inflow does not move Software progress; theft uses one unit |
| RD-B17 | Research readouts: st.n counts Σb with no `also` double count; `evaluatedAfter` requires a model that embodies the stack; Recipe in its own units with a domain / data list; "true effect (revealed)" label (B28, B29, B30) | models/{stacks,research,researchView}.ts, ui Recipe.tsx | – | M | M | quick + ui | no Recipe card sums mixed units; P09 is not shown under pretraining |
| RD-B18 | Preview truth 1, research and people: one ETA / effort function; hire previews from one tick on a copy; agent preview build delta, with the −0.05 line removed; taste chip; research action previews (B31–B35) | models/{tree,treeActions,researchView}.ts, departments/teamActions.ts, departments/agentActions.ts, ui Research / Company | – | M | M | ui | every listed preview equals the one-day effect in a test |
| RD-B19 | Preview truth 2, training / evals / models / leads: runEvals; stream / IDA / variant previews; run-card band from eval noise; A4 / E16 / C6 previews from the applied function; typed preview currencies (B36–B38, B40, B45) | models/actions.ts, models/evals.ts, actors/actions.ts, events/catalog/company.ts, ui kit.tsx / ui.tsx | – | M | M | ui | no preview line without an applied effect (lint added); no unitless "progress" |
| RD-B20 | Preview truth 3, products: pack preview through previewDeployments; unapplied cost / risk lines removed (B39) | worldfx/actions.ts, models/productOps.ts | – | S | M | ui | as above |
| RD-B21 | Copy batch (B46 names, B47, B27 one mix range, MEA-17 glossary) | data/v2/{glossary,tree,paradigms}.ts, ui panels, ui EndScreen.tsx, departments/split.ts | – | M | M | ui + lint-ux | every listed text matches the engine |

### Phase 2: One capability currency, one milestone predicate, one lead clock
Exit criterion: test:cal and test:deep pass, with golden dates within tolerance under the new milestone definition.

| ID | Task | Scope | Depends | Size | Effort | Tier | Done when |
|---|---|---|---|---|---|---|---|
| RD-U01 | All design / paradigm / curation / RSCH / safeguard / pack offsets stated in OOM of domain G; displayed domain level = λ(G_d); delete LEVEL_PER_OOM, `offL`, `sD = offL/2`, REEVAL_DG via 1.2 | data/v2/{runDesign,serving,evals,calibration,workTypes}.ts, models/{design,capability}.ts, departments/workfit.ts | Phase 1 | M | H | cal | no level→OOM factor in the engine; display and fit move together |
| RD-U02 | One λ: `oomOfLevel = gOfLevel − G_V0`; `versionOom = v.G − G_V0`; delete the second LEVEL_AT | safety/oversight.ts, models/capability.ts | – | S | H | safety + cal | 22 callers on true G; post-λ-15 models differ |
| RD-U03 | Safety half-points as OOM literals (current values); F21 / F30 in OOM; delete REF_M_LEVEL / refPathWorld / oomOfRefM | data/v2/{agendas,oversight,findings}.ts, safety/{oversight,techniques,findings}.ts | – | S | M | safety | hashes identical up to rounding; no M½ in data |
| RD-U04 | Progress-year data restated in OOM (START_PUBLIC_GAP_Y, chinaGapYears, P24, RUN_PENALTY_Y, SPILL, FREE_TIER.years, distill threshold, leak / C4 sizes), with values × B so behaviour is identical | data/v2/*, actors/*, safety/findings.ts | – | M | M | quick (identical) | no data constant in progress-years |
| RD-L01 | Record `series.G` per lab; one `lagDays(follower, leader)`; trueLeadDays and intel read it | core/record.ts, models/capability.ts, actors/intel.ts, actors/china.ts | DD-10 | M | H | cal | one function behind LeadTrack and RiskMap |
| RD-L02 | Move theft, open-weights absorption, release lag, the epilogue and scoring to G gaps and lagDays | security/theft.ts, actors/rivals.ts, endings/{epilogue,scoring}.ts | RD-L01 | M | H | deep | no reader of leadBetween / paceOf in these |
| RD-L03 | Delete B_G_PER_Y, modelRate / paceOf / rateOf, prodCache.rate and START_G_RATE | about 21 files (MEA-03 list) | RD-L02, RD-U04, RD-C08 | M | M | cal | grep is empty; golden dates re-reported |
| RD-L04 | One milestone predicate: `versionMilestones` for rivals (reference-profile build) and at day 0; notices "your evals show criterion X"; endings and Stage 2 read it | departments/workfit.ts, models/capability.ts, core/init.ts, endings/endings.ts, actors/{rivals,china,gov}.ts | DD-09 | M | H | cal + deep | one definition in code; T1 golden dates re-checked |
| RD-L05 | Between-knot thresholds restated (gov seenL 6.5 / 8.5, rival era L ≥ 9, S3 / S8, misuse Lg − 7, drift Lg/10, detection L 7, acts): milestone-aligned ones read the predicate, the rest go to OOM above V0 or to coverage | actors/{gov,rivals}.ts, safety/{detection,control,common}.ts, models/capability.ts, data/v2/oversight.ts | RD-L04 | M | H | cal + deep | no hard-coded display level in mechanics (lint) |
| RD-U05 | Domain difficulty in one place: displayed domain score from fit vs best human; danger-flag benches get a replacement source; delete REF_OFF | data/v2/calibration.ts, models/{capability,benchmarks}.ts, actors/rivals.ts | RD-U01 | M | H | cal + safety | REF_OFF gone; danger flags have a stated source |
| RD-U06 | Start state as data: G(V0) per world plus B0 / V0 recipe ages in OOM; one `startLab(G0, inputs)` for every lab; delete playerStart / pcRefLab / START_RETAIN / startVintage | models/capability.ts, core/init.ts, actors/{rivalModel,rivals,china}.ts | RD-C08 | M | H | cal | the player and the leader twin use one rule; G_SC refits only if the stop rule allows |
| RD-U07 | RefBot gates in OOM; delete levelOfV2, CAL_SHIFT, milestoneThresholds; v1 MILESTONES kept only as canon dates | bots/ref.ts, world/calibration.ts, data/v2/calibration.ts, data/world.ts | RD-U01 | S | H | cal | RefBot golden runs within tolerance |
| RD-U08 | `fpt` stored on base and version; delete serveCost / serve / SERVE_REF | models/{effective,runs}.ts, departments/workfit.ts, production/production.ts | – | S | M | quick + serving | no serveCost reader |

### Phase 3: One research engine and one allocator
Exit criterion: test:cal and test:deep pass. This is the biggest calibration phase: schedule a merge wave after RD-R01 / RD-A02 and another after RD-E01.

| ID | Task | Scope | Depends | Size | Effort | Tier | Done when |
|---|---|---|---|---|---|---|---|
| RD-A01 | One `teamCapacity()` used at all 5 sites; RE_UNIT and RE_PER_PROJECT merged | workfit.ts, research.ts, tree.ts, agendas.ts, lineProjects.ts, data/v2/{workTypes,research}.ts | – | S | M | quick (identical) | one formula |
| RD-R01 | Research readout from the engine (research.last); gov, tutorial, P24 and the preview elasticities move to measured quantities; delete evalV3 and prodCache.M / elast | production/production.ts, models/{tree,capability,researchView}.ts, actors/gov.ts, preview callers | RD-B18, DD-11 | M | H | cal | no reader of prodCache.M |
| RD-A02 | Auto mix per DD-11: removed (or a suggestion evaluating the real day); engineering agents get their own budget line | production/production.ts, departments/{split,workfit}.ts, data/v2/agents.ts | RD-R01 | M | H | cal | build capacity is no longer traded blindly; RefBot policy updated |
| RD-A03 | Science-team planner by value (expected OOM/day from prior × stage, cap^λ × taste); one-off ideas release teams during tests | models/research.ts | RD-A01 | M | H | cal | "Why here" text states the value |
| RD-E03 | Headroom per DD-12 (remove, or demand tied to it) | models/stacks.ts, data/v2/research.ts, models/research.ts | DD-12, RD-B08 | S | H | cal | no infinite demand anywhere |
| RD-E02 | AI taste per DD-13 (one ideas channel, both departments, rivals the same); delete φ | departments/workfit.ts, models/research.ts, actors/rivalModel.ts, safety/lineProjects.ts | DD-13 | M | H | cal | taste lift scales with AI ideas labour in a test |
| RD-A04 | Needs list per department in `allocate()` (safety: cases, patches, re-validation, experiments by priority); SAF_EXP_SHARE deleted | models/research.ts, safety/lineProjects.ts, data/v2/{research,agendas}.ts | RD-B08, RD-A01 | M | H | cal + safety | the player can order the safety engineers' needs |
| RD-R02a | Safety projects in shared units (C_UNIT, RE_UNIT) and on the shared experiment-pool rule | safety/lineProjects.ts, data/v2/agendas.ts | RD-A04 | M | H | safety + deep | SAF_RE_UNIT / SAF_C0 gone |
| RD-R02b | Safety stepper replaced by `stepProject(dept)`; candidate pool per DD-15 | models/research.ts, safety/lineProjects.ts | RD-R02a, DD-15 | M | H | safety + deep | one stepper; lineSpeed gone |
| RD-R03 | Safety science teams on planAssignment (teams wanted); auto-assign per DD-16 | models/{research,tree}.ts | RD-R02b | M | H | safety | autoDeptAssign gone |
| RD-R04 | Rolled path gone: P27 on the engine, kyc per the small calls; delete researchSpeed, tree.ts:513-570 and the syncParadigm mirror; TreeNodeState as a discriminated union | models/tree.ts, data/v2/{tree,paradigms}.ts, bots/ref.ts, models/actions.ts, types.ts | RD-R01, RD-R02b | M | H | cal | `adopted()` reads project state; schema bump |
| RD-R05 | Unlock projects as one works / doesn't stage | models/research.ts, researchView.ts | DD-14 | S | H | cal | no effect band on unlocks |
| RD-R06 | Drop, pick and fail rules (drop when below the best alternative; "gave up" with odds; per-attempt reset) | models/research.ts | – | S | H | cal | failure text shows the remaining odds |
| RD-R07 | Four stages; effort readout from stagesOf; FITTED_EFFORT_TM derived from stages | models/{research,researchView}.ts, data/v2/tree.ts | RD-B18 | S | M | ui | one effort number per node |
| RD-R08 | Batching as an internal expected flow, with unchanged drop and survival rules | models/research.ts | RD-B17 | M | H | cal + perf (quiet) | takeoff readouts are unchanged in meaning |
| RD-E01a | Paradigm typed effects, part 1: P13 and P19 deleted (with the RSCH penalty), P24 as a stack idea in OOM | data/v2/{tree,paradigms,calibration}.ts, models/{research,runs,capability}.ts, departments/workfit.ts | DD-14, RD-U01 | M | H | cal | no `payoffOf`; golden dates within tolerance or a mechanism found |
| RD-E01b | Paradigm typed effects, part 2: P05 / P20 as typed AI-labour effects (deep unlock kept), P07 as the long-tasks suite horizon | same files plus effective.ts | RD-E01a | M | H | cal | no flat ×1.3 / ×1.2 |
| RD-A05a | One flat compute allocation to uses with presets (training runs, data, experiments, each agent package, monitors, products, safety lines) | departments/split.ts, compute/power.ts, data/v2/agents.ts | RD-A02, RD-B07 | M | H | cal + safety | one allocation function; nested slices gone |
| RD-A05b | Spare-compute policies per DD-19; real compute for investigations | worldfx/revenue.ts, models/runs.ts, safety/investigations.ts | RD-A05a, DD-19 | S | H | cal | idle compute is visible |
| RD-A06 | AI staff packages: explicit model per use, control layer per package, internal deployment as a view; internal tooling items separate from product features | departments/{agents,agentActions,workfit}.ts, models/deployments.ts, safety/oversight.ts, worldfx/serving.ts | RD-A05a, DD-03 | M | H | cal | features no longer act on R&D unless owned as internal tooling |
| RD-A07 | Flat research modifiers made real: pause = no experiment FLOP; clearances remove heads for 60 days; one helper for both departments | departments/workfit.ts, safety/lineProjects.ts, production/production.ts | RD-R02b | S | M | cal | lineSpeed copy gone |
| RD-A08 | Serial-speed line and the duplicate cap removed; S8 from FTE | workTypes.ts, calibration.ts, limitsView.ts, safety/traits.ts | – | S | M | safety | no non-binding limit line |

### Phase 4: Safety outputs
Exit criterion: the safety suite and test:deep (S4 / S5) pass, or are restated with a source.

| ID | Task | Scope | Depends | Size | Effort | Tier | Done when |
|---|---|---|---|---|---|---|---|
| RD-S01 | One project = one question; open-study events; Health updated only on Bernoulli outcomes; catalog rows reassigned | safety/{findings,agendas}.ts, data/v2/findings.ts, models/tree.ts | DD-15, RD-R02b | M | H | safety + deep | the Health tooltip equals P(works) |
| RD-S02a | Known fix methods become run-design options, with a default "use known methods" policy and cost | safety/traits.ts, models/{runDesign,actions}.ts, data/v2/techniques.ts | DD-16 | M | H | safety + deep | no `lineStaffed` in traits |
| RD-S02b | Monitoring from the monitor deployment; healing from the run's safety training; AG17 harness as a built asset with upkeep; AG17 gate dropped | safety/traits.ts, departments/workfit.ts, models/tree.ts, departments/build.ts | RD-S02a | M | H | safety + deep | effects do not toggle with staffing |
| RD-S03 | Fix-method strength drives the effect, mult = 1 − (1 − base)·s0·e·D(x); one tool strength and one observation rule; ad hoc floors become named catalog effects | safety/{traits,techniques,detection,findings}.ts, responses.ts, incidents.ts | RD-S02a | M | H | safety + deep | one strength definition |
| RD-S04 | Tool re-validation as a project on the shared engine; delete VAL_LEAD / RE_SERIOUS / reValidationMult, M½ upkeep units and LINE_MULT_MAX | safety/{agendas,understanding}.ts, data/v2/agendas.ts | RD-A04, RD-U03 | M | H | safety + deep | believed U reads only believed oHalf |
| RD-S05 | Cases as projects on the shared engine; "case progress" naming | safety/investigations.ts, ui Safety.tsx | RD-A04 | M | H | safety | caseRate formula gone |
| RD-S06 | Agenda special cases become data fields (decay, crossCheck, contain, …) shown on the Codex | data/v2/agendas.ts, safety/*, ui Codex.tsx | RD-S03 | M | M | safety + ui | no agenda-ID literals in the engine (lint) |
| RD-S07 | T-UNDO through misuseHazards; T-SPEC / T-HARDEN folded into options; F13 given an effect | data/v2/{tree,findings}.ts, safety/incidents.ts | RD-S02a | S | H | safety | every tool node has an applied effect |
| RD-S08 | Expected vs observed results per year on each line | safety/view.ts, ui Safety.tsx | RD-S01 | S | M | ui | readout present |

### Phase 5: Rivals' research parity
Exit criterion: test:cal passes without LEADER_CAL / CHINA_CAL refits, or with one global constant.

| ID | Task | Scope | Depends | Size | Effort | Tier | Done when |
|---|---|---|---|---|---|---|---|
| RD-X01 | One shared line-rate law for player lines and rival parts | models/research.ts, actors/rivalModel.ts | RD-R02b | M | H | cal | S_CLAMP / DEFAULT_LINES copy gone |
| RD-X02 | Rivals adopt the surviving typed effects through aggregate adoption steps; refit toward one global constant (LEADER_CAL, CHINA_CAL, sampled fits) | actors/rivalModel.ts, data/v2/calibration.ts | RD-E01b, RD-X01, DD-14 | M | H | cal | per-lab efficiency fits gone or justified by a mechanism |
| RD-X04r | Research: primary sources on knowledge diffusion between labs (papers, staff moves, output distillation) | research/ | – | M | M | – | research file with tagged numbers |
| RD-X04 | One diffusion rule for every lab from every public / open model above it, on the recipe gap; leaks sized by what is transferred | production/production.ts, models/stacks.ts, actors/actions.ts, security.ts | RD-X04r, RD-B16, DD-17 | M | H | cal | K_DIFFUSION gone; follower lag is emergent and reported |

### Phase 6: Training acts and measurement
Exit criterion: test:cal passes, plus the effective / data / suites suites.

| ID | Task | Scope | Depends | Size | Effort | Tier | Done when |
|---|---|---|---|---|---|---|---|
| RD-T01a | Run kind field; IDA as RL with a teacher-as-grader option (no name check) | models/runs.ts, types.ts, models/actions.ts | DD-06 | S | H | cal | no `name.startsWith` |
| RD-T01b | Two acts: pretraining (new / continue / distilled small base) and RL (base or version) as parameterisations of two code paths | models/runs.ts, models/effective.ts | RD-T01a, RD-B02 | M | H | cal + effective | four plan branches become two |
| RD-T02 | Continue runs draw tokens from the portfolio | models/{runs,effective}.ts, production/data.ts | RD-T01b | S | H | cal | epochs follow the draw |
| RD-T03 | Stream per DD-05 for player and rivals (FLOP actually spent; adoption route) | models/runs.ts, actors/rivalModel.ts, data/v2/rivalModel.ts | DD-05, RD-T01b | M | H | cal + deep | no free recipe re-application; SIAR / ASI dates re-reported |
| RD-T04 | RL midpoint in absolute FLOP or tasks | models/effective.ts, data/v2/runDesign.ts | DD-06 | M | H | cal | small bases saturate sooner in a test |
| RD-T05 | RL families as explicit same / adjacent lists; horizon gain from long-tasks RL | data/v2/runDesign.ts, models/{effective,design,capability}.ts | RD-E01b | S | H | cal | `v` gone; no flat ×2 |
| RD-T06 | Expert data only as a suite input; P12 as a suite option; domain stock and eval claims deleted | production/{data,dataActions}.ts, models/suites.ts, data/v2/{dataAssets,tree}.ts | DD-07 | M | H | cal + data | one expert asset kind |
| RD-T07 | Suite fidelity from tasks × grader quality with decay; S2 stated directly; v1 graders chain dropped | models/suites.ts, data/v2/suites.ts, departments/build.ts | RD-T06, RD-B03 | M | H | cal + safety | fidelity decays without upkeep |
| RD-T08 | Quality and hazard filters act through the draw; remaining options tagged [D] in OOM; tree text rewritten; data-mix presets per the small calls | data/v2/runDesign.ts, models/design.ts, production/data.ts | RD-U01 | M | H | cal | no v2 Δp × B constants |
| RD-T09 | Synthetic mix follows the teacher's domain profile; teacher share on the base card | data/v2/dataAssets.ts, production/data.ts, ui Models / Data | – | S | H | cal + ui | SYN_MIX gone |
| RD-T10 | Tree node roles split (ideas carry effects, option unlocks are a derived list, purchases are actions) | data/v2/tree.ts, models/tree.ts | RD-T06, RD-E01b | M | M | quick + ui | no node both buys and unlocks |
| RD-T11 | Scrutiny against the largest rival run; `scale` removed | models/runs.ts, data/v2/runDesign.ts | – | S | M | quick | BRIDGE(V7) scale gone |
| RD-M01 | Measured level fitted from benchmark scores per domain (elicitation, sandbagging); consumers per DD-08 | models/benchmarks.ts, actors/commitments.ts, models/capability.ts, actors/gov.ts, bots/ref.ts | DD-08, RD-L05 | M | H | cal + deep | a sandbagging model reads low in a test |
| RD-M02 | "Realised" recipe value from the eval delta of a model that embodies it | models/researchView.ts | RD-M01, RD-B17 | S | H | quick + ui | label says measured, and it is |
| RD-X03 | Rivals train through baseG / rlGains with a reference portfolio and suites; workFit on a reference-profile build | actors/rivalModel.ts, departments/workfit.ts | RD-T01b, RD-T07, DD-18 | M | H | cal | the `clG` special path is gone |

### Phase 7: Products and market
Exit criterion: the serving, worldfx and finance suites pass, plus test:cal (A5, F8, F11 and W4 re-reported as mechanism outcomes).

| ID | Task | Scope | Depends | Size | Effort | Tier | Done when |
|---|---|---|---|---|---|---|---|
| RD-P01a | Product tiers = an ordered list of real versions; Chat free-tier slot; with no mini, the main model at real cost | worldfx/{serving,mix,revenue}.ts, models/products.ts, types.ts | DD-01 | M | H | serving + finance | no player phantom rungs |
| RD-P01b | Real minis at day 0 and an "auto-distil cheap tier" policy that explains itself | core/init.ts, models/runs.ts, policy module | RD-P01a, RD-T01b | M | H | cal + finance | the policy states its trigger |
| RD-P02 | Rivals' lineups as lab state produced by their distill step; delete lineupOf / freeTierOf / rungOffer | actors/rivalModel.ts, worldfx/{serving,mix}.ts | RD-P01a | M | H | serving + finance | no read-time lineup rule |
| RD-P03 | Each product its own seller in the choice; delete CH_WEIGHT / AGENT_WORK.channel split and focus ×3 | worldfx/{mix,revenue}.ts, data/v2/{serving,features}.ts | DD-02, RD-P01a | M | H | finance + worldfx | a weak second product loses share to the strong one by choice |
| RD-P04a | α and the PHYS gate from OOM coverage / horizon | worldfx/{sectors,mix}.ts | RD-U01 | M | H | worldfx + cal | alphaOf takes OOM inputs |
| RD-P04b | Control, tech gates and bestPublic from OOM; delete depOffset / capVec / sectorLevel / productDomains; Agents display sigmoid deleted | worldfx/{mix,control,actions}.ts, models/products.ts, worldfx/revenue.ts | RD-P04a | M | H | worldfx + cal | one capability path to the market |
| RD-P05 | Gov / Trusted as product settings; "open" as a release act; makeVariant copies deleted | models/{deployments,actions}.ts, ui Models.tsx | DD-02 | M | H | products | no variant copies |
| RD-P06 | Effort as a product setting; Deep think feature and the `effort` kind deleted | data/v2/features.ts, models/productOps.ts | – | S | M | products | one lock reason |
| RD-P07 | Enablers as coverage terms in `offerOf`; rivals acquire tools over time | worldfx/serving.ts, data/v2/features.ts, actors/rivalModel.ts | DD-03, RD-P03 | M | H | serving + finance | enablers inside the choice |
| RD-P08 | Sector pack as an owned per-product adaptation (scaffold + certification); delete the sectorPacks feature, LEADER flags, world certDay and the duplicate constant | departments/build.ts, worldfx/{actions,serving,sectors,revenue}.ts, data/v2/{features,starts}.ts | DD-04, RD-B12 | M | H | finance + worldfx | one module and one panel |
| RD-P09 | Leak scales with tokens served; KYC removes the anonymous buyer share | models/deployments.ts, worldfx/revenue.ts | RD-P03 | M | H | serving | leak = 0 with no customers |
| RD-P10 | Misuse exposure from usage (billed hours / users) | safety/{incidents,dangerView}.ts | RD-P03 | S | H | safety | servingShare is only an allocation |
| RD-P11 | Feature hazard multipliers tied to a quantity or shown as [D]; brand from the customer stock | data/v2/features.ts, worldfx/mix.ts | RD-P07 | S | H | serving | no unsourced flat ×1.2 brand |

### Phase 8: Save break and words
| ID | Task | Scope | Depends | Size | Effort | Tier | Done when |
|---|---|---|---|---|---|---|---|
| RD-Z01 | Save break at the end of engine unification (DD-20 c): bump, "no migration from N", migrations deleted, P26 deleted | core/save.ts, data/v2/paradigms.ts | Phases 3–7 | S | M | quick + save | old saves refuse with a message |
| RD-Z02 | One word per thing in engine names, glossary and copy (DD-21; "AI share", person-month, team-equivalent entry) | data/v2/glossary.ts, ui, engine identifiers | RD-Z01 | M | M | ui + lint-ux | glossary regenerated; each term has one meaning |

### Phase 9: UI (after the engine; each screen can start once its engine phase has merged)
| ID | Screen | Needs engine | Size | Effort | Tier | Done when |
|---|---|---|---|---|---|---|
| RD-UI1 | COMPUTE: build / buy | Phase 3 (RD-A05) | M | M | ui | one compute bar; good-ui checks |
| RD-UI2 | LAB: Workforce + Compute allocation (needs lists, idle, policies with a "why") | Phase 3 | M | M | ui | every allocation has one home |
| RD-UI3 | RESEARCH: one portfolio (capability + safety), discoveries tree, know-how | Phases 3–4 | M | M | ui | one stage track; measured speeds |
| RD-UI4 | TRAINING: next run (two acts), data, environments, runs | Phase 6 | M | M | ui | launch snapshot shown |
| RD-UI5 | MODELS: real sizes, measured levels from evals, lineage | Phases 6–7 | M | M | ui | every serving model listed |
| RD-UI6 | PRODUCTS: models + tools + markets, certification | Phase 7 | M | M | ui | "why this product earned X" answerable |
| RD-UI7 | SAFETY: understanding, risks, tools / methods, cases | Phase 4 | M | M | ui | the tools you own, their upkeep and results |

---

## 7. Appendix: deduplicated issue index

Status key:
- bug = §3
- del = §4
- redesign = theme work
- DD-nn = waits on that design decision

Severity is after verification. "→" marks a duplicate, pointing to the issue that owns it.

| ID | Theme | Sev | Status | Note |
|---|---|---|---|---|
| CAP-01 | R | high | redesign | RD-R01; pace not an M consumer |
| CAP-02 | E, X | high | DD-14 | RD-E01, RD-X02 |
| CAP-03 | M | high | bug B28 | RD-B17, RD-M02 |
| CAP-04 | T | med | bug B03 | RD-B02 |
| CAP-05 | E | high | DD-13 | RD-E02 |
| CAP-06 | X, U | med | bug B23 | RD-B16 |
| CAP-07 | X | med | redesign | RD-X01 |
| CAP-08 | A | med | redesign | RD-A03 (mIdeas detail corrected) |
| CAP-09 | R | med | redesign + bug B47 | RD-R06 |
| CAP-10 | W | low | redesign | RD-B17 / RD-Z02 |
| CAP-11 | R | med | bug B29 + redesign | RD-B17, RD-R08 |
| CAP-12 | L | low | bug B47 + redesign | RD-B16, RD-L01 |
| CAP-13 | E | med | DD-14 | RD-R05; overlaps CAP-02 |
| CAP-14 | R | low | del (research.ts:530) + redesign | RD-R07; build.ts:334 live |
| CAP-15 | R | low | redesign | RD-R04 |
| CAP-16 | V | low | bug B31 | RD-B18 |
| CAP-17 | D | low | del | only P07 / P09 real mismatches |
| CAP-18 | A, E | med | DD-12 | RD-E03 |
| CAP-19 | W | low | DD-21 | RD-Z02 |
| CAP-20 | D | low | del | RD-C04 / C06; recipeG → CAP-06 |
| CAP-21 | V | low | bug B35 | RD-B18 |
| CAP-22 | X, E | med | DD-17 | RD-X04 |
| CAP-23 | A | med | bug B12 | RD-B09, DD-11 |
| CAP-24 | W | low | bug B47 | RD-B21 |
| CAP-25 | D | low | del | known items; prodCache.M → CAP-01 |
| CAP-V1 | A | med | bug B12 | RD-B09 |
| CAP-V2 | L | med | bug B24 | RD-B16 |
| CAP-V3 | M | low | bug B30 | RD-B17 |
| SAF-01 | R, M | med | DD-15 | RD-R02b |
| SAF-02 | R | high | redesign | RD-R02a/b |
| SAF-03 | A | high | redesign | RD-A04, RD-R03 |
| SAF-04 | O | high | DD-16 | RD-S02a/b |
| SAF-05 | O | high | bug B05 | RD-B06 |
| SAF-06 | E, O | med | bug B47 + redesign | RD-S07 |
| SAF-07 | E | med | redesign | RD-S03 |
| SAF-08 | R | high | bug B08 + DD-15 | RD-B04, RD-S01 |
| SAF-09 | W | med | DD-21 | RD-Z02 |
| SAF-10 | M | med | redesign | RD-S04 |
| SAF-11 | E, U | med | DD-16 | RD-S04 |
| SAF-12 | U | low | redesign | RD-U03 (= MEA-10) |
| SAF-13 | D, V | low | del + bug B31 | RD-C05, RD-B18 |
| SAF-14 | E | med | bug B09 | RD-B05; DD-16 removes it |
| SAF-15 | M | med | DD-15 | RD-S01 |
| SAF-16 | M, W | med | bug B47 + redesign | Health tooltip; RD-S01 |
| SAF-17 | E, O | low | DD-16 | RD-S02b |
| SAF-18 | R | med | redesign | RD-R04 |
| SAF-19 | W, E | med | redesign | RD-S03 |
| SAF-20 | W | low | redesign | RD-S05 |
| SAF-21 | D, W | low | del + bug B47 | RD-C05, RD-B21 (computeShare rerouted) |
| SAF-22 | E | med | redesign | RD-S06 |
| SAF-23 | A, O | med | DD-16 | RD-R03 |
| SAF-24 | A, U | low | redesign | → SAF-02 |
| SAF-25 | E | low | redesign | RD-S05 |
| SAF-26 | M, V | low | redesign | RD-S08 |
| SAF-V01 | A | med | bug B06 | RD-B05 |
| SAF-V02 | R | med | bug B07 | RD-B04 |
| INP-01 | A | high | DD-11 | RD-A02 |
| INP-02 | A | high | bug B11 + DD-12 | RD-B08 (effect 3–7%) |
| INP-03 | R | high | redesign | → CAP-01 |
| INP-04 | L | med | redesign | RD-L03 |
| INP-05 | E | med | DD-13 | → CAP-05 |
| INP-06 | E | med | DD-13 | → CAP-05 / INP-03 |
| INP-07 | O, A | med | bug B13 + DD-19 | RD-B10, RD-A05b |
| INP-08 | O, A | low | DD-19 | RD-A05b |
| INP-09 | E | med | DD-14 | → CAP-02 |
| INP-10 | O | med | DD-03 | RD-A06 (disclosed; needs a delta) |
| INP-11 | A, O | med | redesign | RD-A06 |
| INP-12 | W | med | redesign | RD-Z02 |
| INP-13 | V | high | bug B32 | RD-B18 |
| INP-14 | W, V | med | bug B34 | RD-B18; stars → small calls |
| INP-15 | A | high | redesign | RD-A04, RD-R02, RD-R03 |
| INP-16 | W, U | med | redesign | RD-A01, RD-Z02 |
| INP-17 | A | med | bug B12 | → CAP-23 |
| INP-18 | A | med | bug B10 | RD-B07 (reproduced 140–160%) |
| INP-19 | A | med | redesign | RD-A05a, RD-UI1/2 |
| INP-20 | D | med | del | RD-C01 (= MEA-16, LEG) |
| INP-21 | A | low | bug B27 | RD-B21 |
| INP-22 | E | low | redesign | RD-A07 |
| INP-23 | E | low | small call | RD-A08 |
| INP-24 | D | low | del | RD-C06 |
| INP-25 | V | med | bug B33 | RD-B18 |
| INP-V01 | A | med | bug B11 | RD-B08 |
| INP-V02 | V | low | redesign | RD-A02 (chart goes with Auto) |
| INP-V03 | V | low | bug B35 | → CAP-21 |
| TRN-01 | O | high | bug B01 | RD-B01 |
| TRN-02 | O, T | med | DD-05 + bug B37 | RD-T03, RD-B19 |
| TRN-03 | U | med | redesign | RD-U01, RD-U02 |
| TRN-04 | O | med | DD-07 | RD-T06 |
| TRN-05 | M | high | DD-08 | RD-M01 |
| TRN-06 | T | med | DD-06 | RD-T01a/b |
| TRN-07 | T | med | redesign | RD-T02 |
| TRN-08 | T, V | med | redesign + bug B37 | RD-T01a, RD-B19 |
| TRN-09 | E, T | med | DD-06 | RD-T04 |
| TRN-10 | E, W | med | redesign + bug B47 | RD-T05 |
| TRN-11 | E | med | redesign | RD-T08 |
| TRN-12 | D, V | med | del + bug B47 | RD-C04, RD-B21 |
| TRN-13 | D | low | del + bug B47 | → TRN-24 |
| TRN-14 | O | med | bug B04 + DD-07 | RD-B03, RD-T07 |
| TRN-15 | T | med | bug B02 | RD-B02 (reproduced) |
| TRN-16 | V | med | bug B36 | RD-B19 |
| TRN-17 | L | med | DD-09 | → MEA-01 |
| TRN-18 | U, D | low | redesign | RD-U08 |
| TRN-19 | O, E | med | bug B43 + redesign | RD-B01, RD-T09 |
| TRN-20 | E | med | small call | RD-T08 |
| TRN-21 | E, W | med | redesign | RD-T10 |
| TRN-22 | X | med | DD-18 | RD-X03 |
| TRN-23 | D | low | bug B47 | RD-B21 |
| TRN-24 | D | low | del | RD-C04 |
| TRN-25 | U, D | low | redesign | RD-T07 |
| TRN-26 | U | low | redesign | RD-U06 (= MEA-05) |
| TRN-27 | D, E | low | del (REF_OFF cols) + DD-14 (P19) | RD-C05, RD-E01a |
| TRN-28 | D | low | small call | RD-T11 |
| TRN-29 | D, O | low | del (dead mixes) + redesign | RD-C04; crawl as a shared stock |
| TRN-30 | V | low | bug B44 | RD-B01 |
| TRN-31 | W | low | small call | RD-UI4 |
| TRN-32 | W, T | low | redesign | RD-UI4 ("recipe at this size") |
| TRN-V01 | X | med | DD-05 | RD-T03 |
| TRN-V02 | T | low | bug B25 | RD-T03 |
| TRN-V03 | V | low | bug B36 | → TRN-16 |
| TRN-V04 | V, M | low | bug B45 | RD-B19 |
| PRD-01 | O | high | DD-01 | RD-P01a/b, RD-P02 (TIERS deliberate) |
| PRD-02 | O | med | DD-01 | → PRD-01 |
| PRD-03 | O | med | DD-01 | RD-P02; cheapestAt used in a script |
| PRD-04 | P | med | bug B15 | RD-B11 |
| PRD-05 | O, V | med | DD-02 + bug B38 | RD-P05, RD-B19 |
| PRD-06 | U, P | high | redesign | RD-P04a/b |
| PRD-07 | P, U | med | redesign | RD-P04b |
| PRD-08 | P, E | high | bug B14 + DD-03 | RD-B11, RD-P07 |
| PRD-09 | P | high | DD-02 | RD-P03 |
| PRD-10 | O, P | med | DD-04 | RD-P08 |
| PRD-11 | O | med | bug B18 | RD-B12 |
| PRD-12 | V | med | bug B39 | RD-B20 |
| PRD-13 | V | med | bug B39 | RD-B20 |
| PRD-14 | O, W | med | redesign | RD-P06 |
| PRD-15 | O | med | DD-03 | → INP-10 |
| PRD-16 | E | low | redesign | RD-P11 |
| PRD-17 | U | low | bug B47 + redesign | RD-U01 |
| PRD-18 | E | med | redesign | RD-P09 |
| PRD-19 | P | med | bug B16 | RD-B11 |
| PRD-20 | P | med | bug B17 | RD-B13 / DD-01 |
| PRD-21 | E, P | low | redesign | RD-P10 |
| PRD-22 | O, D | low | bug B20 + DD-02 | RD-B12 |
| PRD-23 | D | low | del (with RD-P08 / RD-U08) | LEADER flags, serveCost, comments |
| PRD-24 | E | low | redesign | RD-P11 |
| PRD-25 | P | med | DD-02 | synthesis of PRD-01/05/06/09/10/15 |
| PRD-V01 | O | low | bug B19 | RD-B12 |
| PRD-V02 | V | low | bug B42 | RD-B11 |
| PRD-V03 | V, P | med | bug B41 | RD-B11 |
| PRD-V04 | O | low | bug B18 | RD-B12 |
| MEA-01 | L | high | DD-09 | RD-L04 |
| MEA-02 | U | med | redesign | RD-U01 |
| MEA-03 | L, U | high | DD-10 | RD-L01–L03 |
| MEA-04 | U | med | redesign | RD-U05 |
| MEA-05 | U | med | redesign | RD-U06 |
| MEA-06 | X, U | med | redesign | RD-U06 |
| MEA-07 | L | high | DD-10 | RD-L01/L02 |
| MEA-08 | D | low | del | RD-C02, RD-U07 |
| MEA-09 | U | low | redesign | RD-U02 |
| MEA-10 | U | low | redesign | → SAF-12 |
| MEA-11 | X | low | DD-18 | RD-X03 |
| MEA-12 | X | med | DD-05 | RD-T03 |
| MEA-13 | X, E | med | DD-14 | RD-X02 |
| MEA-14 | X, E | med | DD-17 | RD-X04 |
| MEA-15 | V, E | med | bug B40 + DD-17 | RD-B19, RD-X04 |
| MEA-16 | D | low | del | → INP-20 |
| MEA-17 | M | med | DD-08 + bug B47 | RD-M01 |
| MEA-18 | L, U | med | redesign | RD-L05 |
| MEA-19 | V, W | med | bug B37 | RD-B19 |
| MEA-20 | W | med | redesign | RD-Z02, UI |
| MEA-21 | X | low | bug B21 | RD-B14 |
| MEA-22 | L, W | low | bug B46 | RD-B21 |
| MEA-23 | U | low | redesign | RD-U04 |
| MEA-24 | D | low | DD-20 | RD-C08 |
| MEA-25 | X | med | bug B22 | RD-B15 |
| MEA-26 | L | med | redesign | → MEA-03 |
| MEA-V01 | L | low | bug B46 | RD-L04 |
| MEA-V02 | L | med | bug B22 | RD-B15, RD-L02 |
| MEA-V03 | X, U | low | bug B26 | RD-X02, RD-U07 |
| LEG-01 knots | D | med | del | → INP-20 |
| LEG-02 calShift / thresholds | D | low | del | → MEA-08 |
| LEG-03 migrations 1–10 | D | low | del | RD-C03 |
| LEG-04 save floor rev 33 | D | low | DD-20 | RD-C08 |
| LEG-05 cashCost branches | D | low | del | RD-C04 |
| LEG-06 ~47 unreferenced exports | D | low | del | RD-C04 / C05 |
| LEG-07 autoAssign "both departments" | D | low | del | RD-C06 |
| LEG-08 BRIDGE(V6)/(V7) tags (26) | D | low | del | RD-C06 |
| LEG-09 knots / calibration pm / calShift comments | D | low | del | RD-C06 |
| LEG-10 REF_OFF cols 1–6 | D | low | del | → TRN-27 |
| LEG-11 P26 RNG placeholder | D | low | del | RD-C07 / RD-Z01 |
| LEG-12 OLD_EFFORT_DAYS | D | low | del | RD-C05 |
