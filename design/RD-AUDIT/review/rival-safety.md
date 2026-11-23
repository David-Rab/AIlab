# Rival safety physics: what it feeds, what it lacks, a proposal (designer decision 5, 2026-11-23)

Read-only analysis on `rd`. Sources: review/safety.md §3 #2, SAFETY-REDESIGN.md, DECISIONS.md (DD-18, OD-1..11, CP3,
post-compaction 1-10), `src/engine/v2/safety/traits.ts` (player step: `postSignals`, `postHack`, `runEnv`,
`applyRunToTraits`; rival step: `rivalTraitStep`, `rivalSignals`, `effSafety`), `safety/methods.ts`, `actors/rivals.ts`,
`actors/intel.ts`, `actors/china.ts`, `actors/index.ts`, `endings/epilogue.ts`, `endings/endings.ts`,
`endings/scoring.ts`, `security/theft.ts`. A small probe on the day-400 fixture (seed 2027) gave the numbers in §3. The
probe script lives outside the repo; nothing in the repo was changed.

## In one paragraph

Rival misalignment matters most in three places. It decides how a rival's or China's ASI ends: aligned or takeover.
It sets the survival score of every company-loss, overtaken or retired ending, through a projection of each lab's
misalignment at ASI. And it pulls the player's estimate of each rival toward the truth. Today's rival step has the
player's trait graph, but it is missing the three mechanisms that make the player's misalignment rise with
capability: graders being outgrown, learned hacking, and methods failing at scale. Its safety side is one unsourced
dial ("effective safety × shared pool") that works the same at any scale. So rival misalignment is roughly flat in
capability. It barely depends on the lab's type. It mostly depends on how many post-trains the lab has run since its
last new base. **Recommendation: option A.** Run rivals through the player's own functions, using one fixed "house
recipe" per lab type as the stated stand-in for the choices rivals don't make. That is about 7 small tasks. It deletes
the dial, the shared-pool scalar and the open-ended E02 growth.

---

## 1. What rival safety state feeds

Rival safety state is each lab's `internal` / `publicModel` trait vector and U-modes (`SimpleModel.traitsTrue`), its
misalignment `rivalMis` = `misalignment(traits)`, and its hidden posture (`SafetyPosture`).

| # | Reader | What it does with it | Weight in play / endings |
|---|---|---|---|
| R1 | **Rival or China ASI first** (`endings.ts` step 7 → `epilogue.ts resolveAsi`) | exposure = the lab's Mis. Mis above the world's tolerance θ_w means takeover (or contested, if containment 0.2·safetyInvestment covers it). Otherwise aligned, and the power outcome comes from the lab type. The player's exposure is Mis·(1 − oversight)·(1 + footholds); a rival's is the bare Mis. | **Decisive.** One comparison decides the ending (rivalTakeover / chinaTakeover vs rivalAligned / chinaAligned / asiContested). Bot criteria read it: "ref passive takeover ≥ 50%" counts rival and China takeovers. |
| R2 | **Epilogue and survival score** (`scoring.ts epilogueSurvival`, `runEpilogue`) | For every active lab, `projectLabMis` fast-forwards the lab's trait steps to ASI (linear G, a base every BASE_MONTHS, a post every 56 d). Then P_mis = σ((Mis − doom)/0.06), weighted by how close each lab is to the lead. | **High.** It is the survival axis of every company-loss, overtaken and retired ending, which are the most common endings for the safe and mixed bots. |
| R3 | **Player's view of rivals** (`intel.ts updateIntel`) | The misalignment band starts from a prior by framework clause. It moves toward the true `rivalMis` by `info` (≤ 0.8: evaluator access, known incidents, thefts). Shown on Overview, RiskMap and the end screen; feeds the risk rows (P(first) × doom curve of the band) and the Theft row (China's band). | **Medium.** It is information, not an outcome. It can leak truth: at info 0.8 the band centre is 80% the true value. |
| R4 | **Rival model incidents** (`rivals.ts labDaily` → `incidents.ts labModelHazards`) | WS2's danger formula on the deployed rival model's traits, at a generic site, with mitigation from posture. Visible incidents go to the log, the rival's intel evidence and its Safety Index grade (`index.ts`). A severity ≥ 4 model incident adds +10 to China's safety concern, and a recent one gives China's "bargainer" mode ×2.5 (`china.ts`). | **Medium.** It is the main channel from rival misalignment into the world during play. Loop: China's concern → China's safetyInvestment → China's traits. (Rival misuse incidents read capability and posture, not traits.) |
| R5 | **China's stolen models** (`theft.ts`) | China's internal model becomes a copy of the victim's traits (the player's best version, or a rival's), then China's trait steps continue on it. | **Medium in the worlds where theft happens.** The player's misalignment becomes China's (U21 route), then evolves under rival physics. |
| R6 | **End screen truth table** (`view.ts misByLab`, `EndScreen.tsx`) | Shows each lab's true Mis next to the player's earlier estimate. | Display only, but it is where the player checks whether the world was fair. |
| R7 | **Rival lineups** (`rivalModel.ts` students) | Students copy the teacher's traits whole. Nothing reads lineup entries' traits except through `publicModel`. | Negligible. |

What does **not** read rival misalignment: markets, finance, talent, government, public opinion (other than through
logged incidents and China), and the S4 / S5 calibration targets, which read the player's own models only.

So rival safety needs the right **level relative to θ_w at ASI** (R1, R2) and the right **ordering across lab types
and worlds** (R1, R2, R3). It needs a plausible **daily hazard** (R4). It does not need beliefs, instruments, cases or
per-trait readouts.

## 2. Side by side: player mechanism → rival version

"Same" = the same code path. "Stand-in" = an equivalent with different inputs. "None" = absent.

| Player mechanism | Rival today | Note |
|---|---|---|
| Trait graph `stepTraits` (edges, difficulty D, U-modes, crystallisation, brackets) | **Same** | The shared core. |
| E18 alignment-faking capability gate `afCapGate(G)` | **Same** | Rises with G. Today the only part of the rival step that grows with capability. |
| E20 no AF growth in pretraining | **Same** (base step `pretrain: true`) | |
| New base = new lineage (`imitatedStart(basePrior, own synthetic share)`) | **Same in principle** | Wipes the lineage's accumulated drift: the sawtooth in §3. |
| S1 approval reward from the run's preference method × preference-RL share | Stand-in: `prefIntensity × 0.9` | Unsourced number; fine as a stand-in. |
| S2 hackable reward = suites' missed exploit × Gao pressure (ρ) | Stand-in: `rlIntensity × (1 − 0.4·evalRigor)`, constant | No suites, no ρ, no grader gap. |
| **SR-24b**: RH saturates inside a run toward the run's undetected hack share | **None.** Keeps **E02** (RH grows open-endedly by post count) | Review §3 #4 asked for one rule for everyone. |
| **E16 learned hacking λ** (hack share past onset → MacDiarmid generalisation on E04, E18, E27, E28, E09) | **None** (λ = 0 always) | The sourced main route from hacking to AF, scheming and sabotage. |
| **CP3h(a)** graders outgrown: missed exploits rise as the policy passes its graders (gapFactor) | **None** | The CP3 mechanism that made the player's misalignment rise with capability. |
| **CP3h(b)** long-task length tracks the model's horizon (S3, grading gap) | **None.** S3 = 0.5 (+0.3 after SC), constant | |
| S4 CoT pressure / latent reasoning | Stand-in: latent flag at an era, by archetype | Fine. |
| S5 AI-related data / long-horizon RL | Stand-in: `0.2 + 0.1·tier` | Fine as a stand-in. |
| S7 eval / RL situational pressure from ρ and the RL mix | Stand-in: `0.2 + 0.2·evalRigor` | |
| S8 deployment (agent FTE) | **Same** | |
| **Methods** (inoculation, anti-scheming, persona vectors, confession, W2S, CAST), each a sourced cut | Stand-in: E04 × (1 − 0.85·eff·pool), E17 × (1 − 0.4·eff·pool), SCHEME removal 0.5·eff only if eff > 0.5 and pool > 0.3 | Different numbers from the player's sourced ones. Anti-scheming is off at the start pool (0.1). |
| **SR-15** method strength scales with the agenda's true efficacy in this world | **None** | Rivals don't feel whether this world's methods work. |
| **CP3i** methods move to the world's hidden at-scale draw q above their tested capability | **None.** Rival "methods" hold at any scale | Review §3 #2. |
| Safety-training removal at SAFETY_REMOVAL[level], visibility (EA, OC_VIS) | Stand-in: `0.55 × (0.5 + eff)` | Close in form. |
| Detection-gated removal ("what you can see you can fix"), audits, AG18 healing | None (no instruments) | Detail: needs an owned stack. |
| **Global drift cut** `growthMult = 1 − eff·(0.3 + 0.7·pool)` | **Rival only. The player has no such term.** | An unsourced lever on every edge, at any scale. In the probe it is the strongest rival safety lever. |
| `effSafety`: safetyInvestment × (1 − raceRelaxation·pressure) × (1 − abs(N(0, rhetoricGap))) per run | Rival only | A random draw per run; not physics. |
| Successor pull (E4), IDA / stream drift, train-against-instrument Goodhart, masks, P14 steering | None | Detail: player choices and internal fleets. |
| Distillation: student inherits only visible traits (`distilledStart`) | Students copy every trait | A small inconsistency; lineups barely matter (R7). |
| Loss test at ASI: Mis·(1 − O_eff)·(1 + F) vs θ_w | Bare Mis vs θ_w (no oversight, no footholds) | The stated DD-18 stand-in in `resolveAsi`. |

## 3. Which gaps change the shape of outcomes

Probe (day-400 fixture, seed 2027, θ_w = 0.245; G raised linearly to ASI over 41 posts with a new base every 8, the
current step):

- **Today:** day-400 rival Mis is 0.33 to 0.52 (SCHEME 0.58 to 0.89) against the player's 0.19. All rivals are already
  above θ_w.
- **Projection:** projected Mis at ASI is 0.33 to 0.45 for every lab type (the maverick 0.335, a safety lab 0.45).
- **Sawtooth:** Mis right after a new base is about 0.2. After 8 posts on that base it is 0.45 to 0.66.
- **Capability barely matters:** the peak of each sawtooth rises only about 0.1 over 13 OOM, from V0 to ASI.
- **Posture barely matters:** safetyInvestment 0 vs 0.57 moves Mis by about 0.05. Safety lab vs maverick is about
  0.1.
- **The pool is the big lever:** only pool 0.9 with safetyInvestment 1 takes Mis to about 0.05, and the pool is
  something the player's Publish action raises.

**Gaps that change the shape (fix these):**

1. **Misalignment doesn't rise with capability (no grader gap, no learned hacking, E02 instead of saturation).** A
   rival's misalignment is driven by post-train count, not by capability. So what a rival's ASI ending turns on is
   when the lab last trained a new base. That is noise, not "racing to more capability raises risk". This is the core
   AI 2027 story, and the player has it while rivals don't.
2. **Rival methods never fail at scale and ignore the world's draws (no SR-15, no CP3i).** "Is this world's alignment
   hard" should hit every lab together. Today only the player feels the world's method efficacy and at-scale q. A world
   where inoculation stops working at scale ruins the player but not the rivals. So "a rival got there first" is
   uncorrelated with how hard the world is, and "let a safety lab win" is never a real bet.
3. **Lab type barely matters, while an unsourced global multiplier dominates (`growthMult`, the pool, `eff`).** The
   lab types (safety, maverick, DeepCent) should order outcomes, and the player's Publish should give rivals named
   methods (SAFETY-REDESIGN §3.9), not a scalar that cuts all drift. Today a maverick and a safety lab end within about
   0.1. Meanwhile a high pool can take every lab near zero, at any scale, from a lever no source supports.

**Gaps that are detail at the aggregate level (leave as stated stand-ins):**

- Beliefs, instruments, detection-gated removal, audits, healing beyond the method list, cases, masks, train-against
  Goodhart, P14 steering, successor pull, IDA and stream drift. These are the player's agency and information. A rival
  is a fixed policy.
- Exposure at ASI without oversight or footholds. It shifts the level a little in both directions (no oversight makes
  it worse; no footholds makes it better). It is a decided DD-18 stand-in. Revisit only if rival endings come out
  lopsided after the fix.
- Signal stand-ins S1, S4, S5, S7 (numbers by posture). They move levels, not shape.
- Students copying all traits (R7): a one-line consistency fix, irrelevant to outcomes.
- The `rhetoricGap` noise draw per run: delete it. It adds noise, not shape.

## 4. Proposal: the smallest rival safety model with the right shape

**Idea.** A rival post-train is a player post-train with a fixed plan. Same functions, aggregate inputs. Each input the
rival doesn't own gets one stated stand-in:

| Player input | Rival stand-in (stated, DD-18) |
|---|---|
| The run plan (`PostDesign`: preference method, safety level, RL budget, RL focus, CoT, methods ticked) | **A house recipe per lab type** (data, about 7 rows): e.g. safety → constitution / heavy / standard RL / all public methods; bigtech → engagement / standard / all public methods with no capability cost; maverick → engagement / minimal / heavy RL / none; DeepCent → standard / standard / none until China's safety concern passes a line. Lab types only, no per-lab numbers. |
| Race pressure changing choices | One rule, using posture fields that already exist: when pressure × raceRelaxation > ½, the recipe steps down one safety level and drops methods that cost capability. |
| Owned methods | **The public method set**: a method is public from its historical publication date (the papers' dates; these labs published them), or when the player publishes it. Replaces the `sharedTechniquePool` scalar (§3.9: "rivals gain this method", a named owned thing). |
| The method's efficacy and at-scale strength | **The world's own values**: `trueEfficacy(agenda)` and `hidden.methodScale[q]` are world physics, the same for every lab. Read at the rival model's OOM above V0. |
| Owned RL suites and their exploitability | **The reference start suites** (the leader's day-0 recipe, 6.5% hack share), constant. Rivals don't harden; stated. |
| Graders (humans, AI critic share under P15) | Expert humans at HUMAN_REVIEW_L, no AI critic. Stated as conservative. Later it can follow the lab's adoption of paradigms (DD-14 rule) if wanted. |
| The policy trained (OOM, 50% horizon) | The rival model's G, minus V0's G, and its h50 (rivals have builds). |
| Instruments (detection-gated removal), honeypots, EA suppression | None: plain behavioural removal (det = 0, eaC default). |

**Then the rival post step** builds its environment through the same functions as the player's: `postSignals` /
`postHack` (graders outgrown, task length, Gao pressure, learned hacking λ, the SR-24b saturation target),
`playerMods`' method part (`methodMult` with SR-15 and CP3i), `safetyRemovalMap` at SAFETY_REMOVAL[house level], and
`afCapGate`. It then calls `stepTraits`. The base step stays as it is (it already matches).

**Delete:** `effSafety`, `rivalSignals`, `growthMult` as a rival lever (the field can stay at 1 for IDA and P14 uses,
or go), the E04 / E17 pool moderators, the pool-gated SCHEME removal, `bracket.heavy: eff > 0.5`, rival use of E02 (it
then has no caller in post runs; check the base and stream callers), `knowledge.sharedTechniquePool` and its
Publish / findings writes and preview line (§3.9 already asks for that), and the `rhetoricGap` draw (keep the field if
the Index reads it; it doesn't today).

**Build, as small single-concern tasks** (tsc + own check each; heavy runs at the next CP):

1. **RSAF-1 Lab-independent method functions.** `methodMult` / `methodRemoval` / `methodEfficacy` / `methodS0` read
   the agenda from technique data, not `s.player.safety.techniques`. `healRate` takes a method list. Check: the
   player's outputs are unchanged on day-400 / day-900 fixtures.
2. **RSAF-2 Factor the post-run quantities.** `postSignals`, `postHack`, `graderSound`, `missedExploit` take an
   explicit context (suites, RL weights, policy, graders) instead of reading the player. The player passes its own.
   Check: identical player outputs.
3. **RSAF-3 House recipes and the public method set** (data + types). Historical publication days, sourced from the
   papers already cited in `METHOD_TESTED_OOM`. Publish adds a method in place of +pool.
4. **RSAF-4 Rival post step on the shared functions** (`rivalTraitStep` 'post'), with the race rule. Delete the
   items above. Check: a probe over 40 worlds per lab type. Misalignment should (i) rise with OOM, (ii) correlate with
   the world's method draws q, (iii) order safety < bigtech < maverick, and (iv) stay inside today's day-0 band.
5. **RSAF-5 Delete `sharedTechniquePool`** (state, save migration or drop, Publish / findings writes, preview line).
6. **RSAF-6 Students use `distilledStart`** (rivalModel students). Tiny.
7. **RSAF-7 Notes.** One V3-BUILD section listing each stand-in in the table above, and GLOSSARY.

Size: 1 and 2 are refactors with no behaviour change (the riskiest part is keeping the player bit-identical); 3 is
data; 4 is the one real change (about 80 lines replacing about 50); 5 to 7 are small. The CP run that follows has
`projectLabMis` (up to 120 steps per lab) going through the heavier path at endings only, which is cheap.

## 5. Options for the designer

| | A. Reuse the player's functions on aggregate inputs (recommended) | B. Keep a separate rival step, add the shape mechanisms | C. Leave it, document the gaps |
|---|---|---|---|
| What it is | §4: house recipe per lab type, public method set, the world's own efficacy and q, graders outgrown, learned hacking, saturation | In `rivalTraitStep`: replace E02 with saturation toward a stand-in hack share that rises with the rival's grader gap; add λ from it; multiply the rival's safety terms (`growthMult`, removal, SCHEME removal) by the mean CP3i strength at the rival's OOM | List each gap of §2 as a stated stand-in in V3-BUILD |
| Same laws? | Yes: one code path, stated stand-ins for inputs only | Partly: the shape mechanisms are copied, but `eff`, the pool and `growthMult` stay unsourced, and the two copies drift when the player's code changes | No |
| Shape | Misalignment rises with capability; methods fail at scale in the same worlds for all labs; lab type orders outcomes; Publish gives rivals named methods | Rises with capability; at-scale failure correlated across labs; lab-type ordering still weak (same dial) | Flat; set by the post-count sawtooth; the pool dominates |
| Cost | About 7 small tasks (2 no-op refactors, 1 data, 1 real change, 3 cleanup) | About 3 to 4 small tasks | About 1 notes task |
| Removes | `effSafety`, `rivalSignals`, `growthMult` lever, pool moderators, the shared-pool scalar, E02 for rivals, the per-run noise | E02 for rivals only | Nothing |
| What it moves | No direct move in S4 / S5 (player-only). Moves: rival / China ASI endings (aligned vs takeover), the epilogue survival axis, "ref passive takeover ≥ 50%", race-bot takeover share, ending coverage (E5: rivalAligned must stay reachable), the intel band centre, rival incident rates and so China's safety concern. Expect higher rival misalignment in hard worlds and near ASI, lower in easy worlds, and a wider spread by lab type. | Similar on capability and q; less on lab-type ordering | Nothing |
| Risk | Rival misalignment could come out above θ_w almost everywhere. The house recipes are the only tuning surface, so the designer judges them as policy, never per lab. | It keeps a fudge layer the redesign is removing everywhere else | Rival endings stay decided by noise; the player can't learn "a careful lab winning is safer" |

**Recommendation: A.** Rivals only need the right overall shape, and A is the cheapest way to get the shape from the
same laws rather than a second copy of them. Every number rivals use is then either the world's own (efficacy, q, edge
weights, θ) or a stated house-recipe choice, which DD-18 allows. It also closes review §3 #4 (one rule for E02 vs
saturation) and §3.9's "no +alignment pool". B is a reasonable fallback if RSAF-1/2 turn out to touch too much player
code. C only makes sense if rival endings are going to be redesigned anyway.

**Small open choices inside A** (lead defaults, yes / no):
- (a) Public methods start at their historical publication dates (Sep to Dec 2025 for anti-scheming, inoculation and
  confession), not only when the player publishes. Default: yes.
- (b) Rivals' graders are humans only (no AI critic) until a paradigm rule exists. Default: yes. It makes rivals
  somewhat riskier near ASI.
- (c) Rival exposure at ASI stays bare Mis (no oversight, no footholds). Default: yes, for now. Revisit after the CP
  run.
