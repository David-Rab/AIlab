# Review: post-compaction PRODUCTS / TRAINING work (RD-P02 … RD-P11, CP3d P5, RD-T10 notes, merge a17a087)

Reviewer: independent, read-only, about 45 min. Sources of intent: SESSION-HEAD [26]–[31], [50], [145]; DECISIONS.md;
SYNTHESIS §5 DD-01..04, DD-18 and the Phase 7 rows. The code was read at `rd` HEAD and in the commit diffs. BUILD-NOTES was
read only as the builder's own account.

## 1. Overall verdict

The structure of the products work does what the designer asked, and most of it should stay. Rivals' lineups are real
models (P02). Each product sells on its own (P03). There is one capability path in OOM (P04a/b/c). Gov / Trusted are
settings and open weights is a release (P05). Effort is a setting (P06). Tools act inside the buyers' choice (P07). Sector
packs are owned per product (P08). Leak and misuse follow usage (P09, P10). Phantom tiers, CH_WEIGHT, focus ×3, depOffset,
the sector-pack feature, LEADER flags and makeVariant copies are all gone. That is real cleanup.

The garbage is in the numbers and in the follow-on add-ons. The designer called the old shares "made-up" in [30]: 10 / 15 /
20 %, ×1.2, ×1.3, $0.4B. Almost every one was carried into the new structure under a new name, and labelled
"[D stand-in] chosen to keep the old effect size": tool need, ADAPT_COVER, CERT_CASH / CERT_DAYS, BRAND_INSTALLED,
MISUSE_TOKENS_REF, Computer use +0.25 F, Memory ×1.3. Two unasked rival rule-sets were added on top: P07b tool shipping and
the P08 rival adaptation gate. Both have invented gates, and both exist mainly to undo an artefact P07 created: on
2025-07-01 no lab has the tools that every frontier lab really shipped in 2024–25. P09 added two invented KYC costs, the
kind of thing [145] rejected. Nothing here needs a revert of the core. Two add-on pieces should be cut back, and the
constants need sourcing or an honest, visible marking.

## 2. Per task

| Task | Verdict | Reason |
|---|---|---|
| RD-T10 notes (995d5e2) | KEEP | Notes only. The behaviour commit 97be985 is pre-compaction; the notes match it. |
| RD-P02 (5064104) | KEEP | Does what DD-01 / DD-18 ask: rivals' lineups are real SimpleModels made by a distill step, and lineupOf / rungOffer / freeTierOf are deleted. The 5-month lag and the 6-model cap are sourced-ish [D]. Rivals pay no distill compute (a stated stand-in). Minor: the dominance-retirement rule is an extra rule, but it is small. |
| RD-P03 (8ef730e) | KEEP | Exactly the row: each product is a seller, by log-sum; CH_WEIGHT / AGENT_WORK.channel / focus ×3 are deleted. Known issue: two identical products raise the player's share (0.384 → 0.403), a product-spam exploit. |
| RD-P04a (ab55782) | KEEP | α, Bass q and the PHYS gate read domain G. v2 thresholds are restated through one λ (levelGate). Faithful. |
| RD-P04b (8db6fda) | KEEP | One capability path. depOffset / capVec / level / dom / productDomains are deleted. It dropped rival domainDg from world effects, which P04c repairs. |
| RD-P04c (a68da04) | KEEP | A 6-line repair of a P04b regression. No new constants. |
| RD-P05 (0dd1544) | KEEP | DD-02 as written. makeVariant and the copies are deleted, releaseOpen is one-way, and the migration folds copies back. |
| RD-P06 (3f5c7ef) | KEEP | Effort is a setting with one lock. Deep think and the `effort` kind are deleted. Clean. |
| RD-P07 (adb8eee) | FIX | The structure is right: a tool is a coverage term inside the choice, which is [30]'s "lets the model do work it otherwise can't". The size is the old made-up share (need = share ÷ (1+share), 13 % of tasks), and rivals start with no tools on 2025-07-01. |
| RD-P07b (6e518bb) | REVERT (replace) | Not asked by any row or decision. It adds a rival "knows the idea" gate, which reads paradigm draws even for tools that shipped in reality before day 0, plus a build timer and `toolShip {day, by}`. Its result is "every lab gets every tool on about day 113". Replace it with day-0 tool ownership from history (see F2). |
| RD-P08 (022ae14) | FIX | The ownership part is right: per product, one module, the world certDay and the friction cut are deleted. Problems: ADAPT_COVER 0.15 is borrowed from the tool's made-up share; CERT_CASH $0.4B / 120 d cite research/16 §1A.3, which gives no number ("costs months and money"); certification now gates the scaffold instead of DD-04's "lifts friction for that product's buyers"; and the unasked rival gate (A ≥ 1 %) gives every rival ×1.15 in almost every sector from about day 30. |
| RD-P09 (ccb60f3) | FIX | The core (leak ∝ anonymous tokens served; KYC verifies anonymous buyers) is what the row asked, and DISTILL_FULL_TOKENS is sourced (RD-X04r D4). It also adds five stand-ins. KYC_REVIEW_COST (2 % of revenue) is an invented cost, KYC_REFUSE 0.1 is a second invented cost, and DISTILL_HARVEST_SHARE 0.01 alone decides whether KYC 1 matters. |
| RD-P10 (1a85e9f) | KEEP (note) | Misuse from served tokens per model, with each lineup model as its own incident site. This is the row, and it is good DD-01 work (lineup entries are real and cause incidents). MISUSE_TOKENS_REF 3e12 is a normaliser set to the day-0 total: stated, to source. Tokens rather than users push misuse onto the free-tier nano (62 % of usage). Watch it in calibration. |
| RD-P11 (aa92a09) | FIX | The hazard part is mostly OK: flats deleted, and site quantities are used where they exist. The numbers are still the old flats (Memory horizon ×1.3, Computer use +0.25 F, Companion SYC ×1.5). The brand part duplicates CUSTOMER_TAU switching inertia with a second, fitted positive-feedback term (BRAND_INSTALLED 0.5, "×1.2 at 40 %, the old effect size"). |
| CP3d 556ef63 | KEEP | A legitimate test fix: it serves once so that servedBy exists, then counts Chat's own incidents. No engine change, nothing faked. |
| Merge a17a087 (product files) | KEEP | Conflict resolutions in deployments / productOps / products / mix / revenue take p3-c2's adaptations / lineup / freeTier with rd's `guards` and `productUsageMult`. The old `restricted ×0.3` line was correctly replaced by SR-13b's productUsageMult. No product logic was lost that I could see. |

## 3. Findings, ranked

**F1. Made-up effect sizes survive as "[D stand-in]" inside the new structures (P07, P08, P11, P10).** The designer's
[30] complaint was "opens X % more of a market, with made-up shares (10 %, 15 %, 20 %)" and "risks are flat multipliers
(×1.2, ×1.3) with no mechanism". The rebuild kept every number:
- `src/data/v2/features.ts:117-143`: shares 0.1 / 0.15 / 0.2; `enablerNeed = share/(1+share)` (:184) is commented "the effect
  size the old after-the-choice multiplier had". Companion "Chat appeal ×1.2" is still a flat appeal multiplier.
- `src/engine/v2/models/adaptations.ts:20-34`: ADAPT_COVER 0.15 is "the size of a product tool's share"; CERT_DAYS 120 /
  CERT_CASH $0.4B are tagged "research/16 §1A.3". That section (research/16-world-effects.md:199) has no number, only "costs
  months and money". The builder's own note says real FedRAMP "costs far less than $0.4B". This is an unsourced cost
  presented with a source citation.
- `src/data/v2/serving.ts:150-155`: BRAND_INSTALLED 0.5 is "set so … gives the ×1.2 the old flat incumbent brand had".
- features.ts:122 Computer use +0.25 F and Memory horizon ×1.3 (the old flats re-pointed at site quantities); Companion
  SYC ×1.5 kept.

The structure is now good, so these numbers are the whole effect. Fix: one short research task, primary sources only.
It should cover the share of O*NET / work-activity tasks that need GUI or voice, real certification time and cost
(FedRAMP / HITRUST / SOC 2), and switching-cost or retention data. Replace each number, or delete the effect (Companion
appeal, the brand term). Where a number stays [D], the player-facing text must say it is an assumption, not "does the
13 % of tasks that need it".

**F2. The tools world starts wrong, and P07b is machinery to undo it.** Rivals start with no tools (no `tools` seeding in
init or the actors). Day 0 is 2025-07-01 (core/time.ts:5). By then computer use (Anthropic Oct 2024, Operator Jan 2025),
memory (Feb 2024) and voice / vision had shipped at every frontier lab. The builder says so himself in P07b's stand-in.
Effects:
- Every offer in OFFICE / FIN / LEGAL / GOV / MEDIA covers ×0.87 until someone "ships".
- A start with Voice & vision ships it on day 0, and rivals then lag 120 d.
- P07b's `rivalKnowsNode` (rivalModel.ts:895) gates a 2024-shipped tool on this world's `paradigmSuccess` draw for P06 /
  P07, so in some worlds no rival ever gets computer use.
- Every lab then ships on the same day (about 113), with no per-lab difference.

This is a phantom absence. Fix:
- Seed each lab's tools at day 0 from what it really shipped by 2025-07-01, and set the player's start lists the same way.
- Delete P07b (`rivalKnowsNode`, `toolBuild`, RIVAL_TOOL_DAYS_PER_TW, `toolShip.by`, migration 68 → 69).
- Keep P07's one lag rule only for tools that are new in-game. If none are, the rival part reduces to "labs keep what
  they had".

**F3. P08 rival adaptation gate is unasked and acts like the old world-wide bonus.** `RIVAL_ADAPT_GATE_A = 0.01`
(adaptations.ts:34) has every rival adapt every sector with ≥ 1 % US adoption from about day 30, and the regulated
sectors about day 150. The net effect is that every rival offer is ×1.15 nearly everywhere. To stay level, the player
has to buy adaptations ($0.4B each in four sectors). DD-04's stated consequence was "rivals stop benefiting from the
player's pack", not "rivals get packs everywhere". Fix: drop the rival rule, or replace it with a sourced rival fact
(which labs actually have FedRAMP / HIPAA offerings at start), seeded and not gated.

**F4. P08 changes what certification does (drift from DD-04).** DD-04 (a) and research/16 §1A.3: certification
"lifts friction (R_s) only for that product's buyers". The build makes certification a gate on the scaffold
(`adaptationLive`, adaptations.ts:43), and no friction term remains. That is a design change made in the designer's
place (see §4).

**F5. Invented KYC costs (P09).**
- `KYC_REVIEW_COST 0.02` is netted from revenue (deployments.ts:32).
- `KYC_REFUSE 0.1` drops 10 % of asked buyers (:30).

Both are tagged "[stand-in]" with no source, so KYC now costs about 4.5 % of demand per level, up from 2 %. That is the
pattern the designer rejected in [145]. The leak's scale is also set by the invented `DISTILL_HARVEST_SHARE 0.01`
(diffusion.ts:66): it decides that KYC 1 does nothing on a big API. Fix:
- Keep the mechanism (anonymous tokens → harvest → access).
- Delete the review cost.
- Source the refusal rate (sign-up drop-off under ID verification) or delete it.
- Source the harvest share from the D3 campaign data (24k accounts / 16M exchanges against Claude's traffic), or mark it
  [D] visibly.

**F6. Brand: two mechanisms for one job (P11).** Switching inertia already lives in the customer stock: CUSTOMER_TAU,
sourced from Menlo's 11 % / yr vendor switching (serving.ts:143-149). `installedBrand` (mix.ts:219-224) multiplies choice
weight by the same stock again, so the player is counted twice. It was fitted to the deleted ×1.2. The row asked for
"brand from the customer stock", but the stock already is that. Fix: delete BRAND_INSTALLED (the brand stays
1 ± approval), or source it as a separate effect (network effects or word of mouth) and remove that part from τ.

**F7. Duplicate-seller exploit (P03).** Two identical products raise the player's target share through the log-sum
(builder's note: 0.384 → 0.403). This is a known logit artefact, not a mechanism. Fix: one nest per provider (the
designer may prefer a nesting parameter), or forbid two products of the same channel on the same model. Small, but it is
an exploit the player will find.

**F8. Truth in previews (minor, pre-existing, moved by P05).** The releaseOpen preview (productOps.ts:301-319) states
"days of China's own progress" and "effective compute the best-placed rival takes" (exact OOM). Both come from hidden
rival / China state and the version's true G. The open-launch preview did the same before, so P05 did not add it, but it
is still a leak. Fix: preview from believed rival levels (the measured / public estimates) with a band.

**F9. Misuse per token, not per user (P10).** With tokens as usage, the free-tier nano takes most of Chat's misuse
exposure (62 % of the player's usage at day 0). Misuse is driven by malicious users / queries times uplift. P10's own
"Left" says "usage is tokens, not users". It is acceptable as a stated stand-in, but it moves the danger balance. Check
at calibration, or switch to queries (users × queries per user) where the model has them.

**F10. Complexity growth in rival products.** Rivals now have `lineup`, `distilling`, `tools`, `toolBuild`, `adapts`,
`adaptBuild` and world `toolShip`, each with its own daily step and migration. DD-18 asked for simplified rivals, "done
properly". P02 (real lineups) earns its place. P07b and the P08 rival gate do not (F2, F3). Cutting them removes about
two migrations and two daily steps.

## 4. Lead decisions made in the designer's place (yes / no)

1. Certification gates the whole adaptation in FIN / HEALTH / GOV / MIL, and no friction effect is left (DD-04 said
   per-product friction relief) (P08).
2. Rivals adapt every sector above 1 % adoption automatically, after 28 d (+120 d certification) (P08).
3. Rivals ship tools themselves through a tree-idea gate, including the paradigm success draw (P07b); one 120-day catch-up
   lag for everyone (P07).
4. No lab owns any product tool at the 2025-07-01 start, unless a player start lists it (P07 / P07b, implicit).
5. Tool size: "the old multiplier's effect size" re-expressed as a coverage gap of 13 % of tasks (P07); scaffold +15 %
   coverage (P08).
6. KYC costs: 10 % of asked buyers leave, plus 2 % of their revenue in review cost (P09).
7. Brand: a new ×(1 + 0.5 × stock share) positive-feedback term on top of customer-stock inertia (P11).
8. Misuse exposure is counted in tokens served, normalised to the day-0 total (P10).
9. Previous rival public models stay on sale until dominated; at most 6 lineup models; rivals pay no distill compute
   (P02). These are probably fine, but they are unconfirmed.
10. Two products of the same kind compete as separate sellers, with no nesting (P03).

## 5. Not checked in the time

- Full code reading of P03's `surplusChoice` groups and revenue split, and of P04a/b's gate conversions. I relied on the
  diffs and the notes, and did not verify numbers.
- Whether the UI shows lineup models, tools and adaptations in player language. Only the minimal hooks were touched.
  RD-UI6 is pending.
- RD-A06 (internal-agent boosts separated from product features: "built twice over" in [30]). Features are still "built
  once for the lab, switched on per product", and the Coding agent's ΔG +0.26 internal effect is still in features.ts:148-152.
- Calibration effects. No tests were run (read-only brief).
- The full content of merge a17a087 outside the five product files, and save migrations 78 → 93 beyond their summaries.
