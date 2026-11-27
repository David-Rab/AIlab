# NPC labs as generated headline labs (spec, draft 1)

Written 2026-11-27 by the lead after the designer's decision of that day. Status: **draft for the designer**. Nothing is
built. Replaces MEDIUM.md §2 (vision worktree) "One lab model" (reverted).

---

## 1. The decision

- **The player** is different from everyone else: fully simulated inside (research, runs, staff, products, safety).
- **Every NPC lab** (the US rivals, the frontier leader and China's lab) has **one shape**: a few **headline states**,
  set by a **start state** and a **personality** of a few parameters.
- **China's geopolitical actor stays as it is** and owns one lab of that shape.
- **Market competition stays emergent.** NPC lineups and tools are generated from the headline values, not trained,
  and compete with the player's products in the existing market.
- **Generated.** The designer: "so that in future if we change the balance, or the timelines - it will adjust
  automatically for the NPC labs, very easy."

## 2. Principles

1. **Generated.** Every headline value is a function of three things: the world, the lab's start state and its
   personality. The world means the timeline draw, world compute, alignment difficulty and world events. No lab has a
   hand-made path. Changing the timelines or the world settings regenerates every NPC lab.
2. **Separate from the player's machinery.** NPC labs reuse none of the player's internal simulation. Re-tuning the
   player's research, runs or staff does not move them.
3. **History is input.**
   - The start state is measured data at the start date.
   - Measured history after the start (to late 2026) is a check of the generation. It is not fitted.
4. **Public vs hidden.**
   - Each headline value has a public version: noisy and late.
   - The public version is the only thing the player, the government, the public and China read. That also holds for
     the other NPC actors.
   - True internal capability, true lag, true compute and misalignment stay hidden.
5. **Finite shocks.** Each player or world action that touches an NPC lab is one named shock on one headline state
   (§6). Its preview reads the same function as its effect.
6. **Outputs aren't knobs.** Targets (gaps, revenue, survival) check the shape.
   - A miss means a missing world input or personality parameter.
   - It never calls for a per-lab fudge or a forcing rule (memory `emergent-outcomes`).
7. **Simple, with the right shape; not a replica of reality.** The designer, 2026-11-27: "we dont need the NPC labs to
   be exact exact like reality. the principle is we want them simple and the correct 'shape' as a background. this
   should apply in general to the NPC".
   - Use real data where it sets the shape: start lags, the frontier path, the ordering between kinds.
   - Use one typical value where per-lab precision would add bookkeeping without changing the shape.
   - This applies to every NPC actor, not only labs.

## 3. The reference frontier: generated from the game's own timeline draw

Each game already picks one actual AI Futures Model run from its timeline group (`src/data/v2/timelineDraws.ts`,
R3.1). Today the table stores only that run's parameters and its AC/SAR/ASI dates. The raw rollouts
(`aifm-runs/out/eli_*/…/rollouts.jsonl`) also hold the run's own time series, among them:
- `progress`, `effective_compute`, `software_efficiency`, `training_compute`;
- `total_ai_company_H100e`, `world_H100e`;
- `horizon_lengths`, `predicted_revenue`.

**The reference frontier is that run's leading project**, translated to game units with the same translation R3.1
uses (`FIXC-TRANSLATION.md` §2: game G = G(V0) + the run's progress since 2025.445). The generator
(`aifm-runs/scripts/fixc_draws_ts.py`) adds two series per run on a quarterly grid:
- **software efficiency S_ref(τ)**: the recipe, in OOM;
- **training compute C_ref(τ)**: the leading project's compute, in OOM.

The dates the game reads as superhuman coder, SAR and ASI are the run's own.

Consequences:
- Changing the timeline split, or re-running the AIFM with another config, regenerates every NPC lab.
- Changing the player's mechanics does not move them.

## 4. Headline states

An NPC lab holds:

| State | Meaning | Hidden / public |
|---|---|---|
| **Software position τ** | Where the lab's recipe sits on the reference path, as a date on the draw's own clock. Its lag d = τ_ref − τ, in days of software progress. | hidden; public as "months behind" with noise |
| **Compute C** | H100e online; training compute follows from it at the lab's training share | hidden; public as an announced figure with noise |
| **Internal model** | G = S_ref(τ) + log₁₀(its training compute) (the AIFM's own split: effective compute = software × compute); or a held model if higher (a stolen one) | hidden |
| **Public model** | The internal model as it stood one release lag ago, updated on the lab's release cadence | public (benchmarks with noise) |
| **Lineup and tools** | Generated from the public model and the lab's market focus (§7) | public (products) |
| **Misalignment** | Of its internal frontier model, generated (§8) | hidden |
| **Safety posture** | Its framework strength and disclosure, from personality and race pressure | public (framework, testers) |
| **Money** | Revenue (from the market), cash, valuation, distress (§9) | revenue and rounds public; cash hidden |
| **Status** | Active, merged, bankrupt or nationalised | public |
| **Largest training run** | Its training compute × the base-run share, while a run is in flight | public (scrutiny of big runs, models/runs.ts `rivalRunFlop`) |
| **Security level** | Weight security, derived from safety emphasis (as today: floor + 0.4 × safety) | hidden; sets the theft hazard on that lab |

**Software dynamics, in one line:** dd/dt = (1 − s) − (d − d_pub)/τ_D + shocks.
- **s** is the lab's own software pace relative to the reference.
- **d_pub** is the lag of the best public recipe: the best public model, the player's included, mapped onto the
  reference clock.
- **τ_D** is the sourced diffusion time: `DIFFUSION_TAU_DAYS`, 4 months, range 2–7.

What this gives:
- A lab settles at a lag of about τ_D·(1 − s), measured in time, so the lag keeps its size in months through takeoff.
- After a shock it relaxes back to that lag.
- It catches up when someone publishes or releases open weights, because d_pub falls.
- Compute enters separately and physically: a lab short of chips has a lower G at once, with no change to its recipe.

**Start in equilibrium** (the earlier designer rule, CP3g): s is set so that the measured start lag d₀ is the
equilibrium, s = 1 − d₀/τ_D. So the start lag (history, measured) sets the pace, and nothing is fitted.

The leader kind has d₀ ≈ 0 and s = 1: it is the reference path.

## 5. Personality (a few parameters) and kinds

| Parameter | What it drives |
|---|---|
| **Compute appetite** | How fast it grows compute (orders in the chip market), as a share of world AI compute |
| **Funding** | Parent-funded (can't fail; the parent's capex) or private (raises, can go into distress) |
| **Release lag and cadence** | How long the internal model stays internal; how often the public model steps up |
| **Openness** | Whether its releases are open weights, and how that changes near the frontier |
| **Market focus** | Weights on consumer, API, enterprise and sectors; sets its domain offsets and which tools it builds |
| **Safety emphasis** | Cuts its misalignment (§8), sets its disclosure and framework strength |
| **Race response** | How much its safety emphasis gives way when it falls behind (today's moving goalposts) |

Pace s is not a personality parameter: it comes from the start lag (§4).

The **kind id** itself is still read in two places: the hyperscaler licence deals pick the big-tech division as a
partner's in-house lab (finance/deals.ts `affiliatedLab`), and the epilogue's power outcome reads it
(`alignedPower`). Both keep working on the kind.

**Kinds are presets of these seven values.** Proposed kinds (values to source; the analogues are for tooltips only):

| Kind | Analogue | Compute appetite | Funding | Release lag | Openness | Focus | Safety | Race response |
|---|---|---|---|---|---|---|---|---|
| Frontier leader | OpenAI | high | private, deep pool | short | closed | consumer + API | low–mid | high |
| Safety-first | Anthropic | mid | private (PBC + trust) | long | closed | enterprise, coding | high | low |
| Big-tech division | Google DeepMind | high | parent | mid | closed | the parent's products | mid | mid |
| Open-weights platform | Meta | high | parent | mid | open near the frontier | consumer platform | low | mid |
| Founder racer | xAI | very high | private, founder | very short | partly open | consumer, social | very low | very high |
| Boutique upstart | SSI, Thinking Machines | low | private | long | closed | research | mid | low |
| China's national lab | DeepSeek | from China's compute meter | state (China's actor) | short | open while China's rung < 3 | API, open weights | low, follows China's safety concern | state-directed |

## 6. Shocks: the finite list

Each one is a named change to one headline state. Previews call the same function.

| Shock | Trigger (existing) | Effect |
|---|---|---|
| **Theft** | China's theft roll (security/theft.ts), against the player or an NPC lab | China holds the stolen model (its G); China's τ moves to the victim's recipe minus an integration delay |
| **Absorb** | License-and-hire exit, the E32 acquisition, the DPA fold-in, mergers | The buyer gets the seller's compute and the better of the two recipes; the seller leaves |
| **IP access** | FIN4b partner deals | The partner's d_pub includes the player's internal model |
| **Poach in** | The player hires from a rival (C4) | The rival's d rises by the tacit share moved; the player gains staff (player side unchanged) |
| **Let go** | Staff leave the player for a rival (E16) | The rival's d falls by the tacit share moved |
| **Joint evals** | C3 | The partner's safety emphasis rises a step |
| **Treaty** | A verified treaty | The reference clock slows for every lab (today's ×0.65 research speed) |
| **Safety spillover** | The player publishes a safety finding that leaks capability (safety/findings.ts SPILL, 0.024 OOM today) | Every lab's d falls by that recipe amount, converted to days on the reference clock |
| **Track-2 leak** | The player's Track-2 dialogue with China (E1) | China's d falls by the leak |

**Not shocks:** export controls, Taiwan/Korea disruptions and cash shortfalls act through compute, so their effect
falls out of §4. Publishing and open weights act through d_pub, so diffusion already covers them.

China's continuous channels (secrets leak per spy, distillation access) become terms in China's software pace. They
read public facts about the player: its security level and the access it gives its products.

## 7. Lineups, tools and prices (generated, the market unchanged)

**Lineup.** On each release the public model gets its students at the existing tier sizes (1, 1/2.83, 1/5.66 and 1/80
of active parameters; DD-01 lineups). They use the existing distillation rule (`distillStudents`, kept). Model size
and serving cost come from the lab's training compute (compute-optimal size), so cheap tiers appear when compute
allows.

**Domains.** The public model's domain levels are its G plus the kind's focus offsets.

**Tools.**
- At the start: what each lab had at the start date (history is input).
- After that, a lab ships a tool once its public model meets that tool's own capability requirement and the tool is in
  its focus, after a build time from its personality.
- There is no history list and no lag rule. Tools whose requirement is "none" are available to every lab from the
  start. Each tool needs a stated capability requirement (open item O3).

**Prices.** Prices stay emergent: the existing seller rule (M5 Nash–Bertrand) on the generated lineup and its serving
cost.

## 8. Misalignment and incidents (generated)

**Misalignment** of a lab's internal frontier: m = M_world(G) × (1 − k·safety emphasis × the race-response
discount) + a per-lab draw.
- **M_world(G)** is the world's reference curve: how misaligned a frontier model at capability G is when nobody tries
  hard. It is generated from the world's alignment-difficulty latents, the same ones the player's safety model starts
  from, so a harder world moves every NPC lab without retuning (open item O2).
- **Uses:** the ending when another lab reaches ASI first, and the epilogue. It is hidden. There is no player intel band
  on it.

**Incidents.**
- **Hazard:** a rate from the public model's capability × m × (1 − safety emphasis).
- **Disclosure:** public only if disclosed. Disclosure comes from safety emphasis, with a statutory floor once SB 53 or
  RAISE is in force (as today).
- **Readers:** a public incident is a public headline event. The government, public and China sessions decide who
  reacts.
- **Misuse incidents** are a second hazard: public capability × openness (open weights count fully) × (1 − safety
  emphasis), as today's misuse row. A severity-5 misuse incident at any lab can trigger the catastrophe ending
  (`endings.ts` catastropheCheck), so it must remain.

### 8a. Decided 2026-11-27 (designer approved the lead's recommendations; detail in `MISALIGNMENT.md`)

- **M_world(G):** one reference lineage per world, made of a base and 7 post-trainings at the reference recipe
  `REFERENCE_POST` (a data constant). It runs the trait graph's pure functions on the world's own edges and difficulty.
  M_world is the **mean over the cycle** (Q1). It is computed in about 20 ms, memoised on `s.hidden`, not saved, uses
  no RNG, and never reads `s.player`. A state-free `referenceEnv` built from data constants is a build task.
- **No offset at the start** (Q2): the old model's 0.017 is not a measurement.
- **k generated per world (option B; designer, 2026-11-27, after N3b), task N3c:** k_w(G) = 1 − M_best(G) / M_world(G), with M_best a second reference lineage at a full-effort safety recipe at the world's true efficacy, both seed-averaged. It replaces the earlier constant k = 0.5 [D]. N3b (2026-11-27) settled the check: the probe was wrong (its removal override dropped AG18 healing), and in the real path heavy safety LOWERS misalignment (mean of 6 seeds, medium world, at SC / ASI: minimal 0.48 / 0.58, standard 0.33 / 0.44, heavy 0.25 / 0.34). So option B is not blocked. Original note: the probe showed
  heavy safety *raising* misalignment (0.42 → 0.53). That is either the probe or a real non-monotonic effect in the
  player's safety model, and a real one goes to the safety session.
- **Race pressure** (Q4) comes from being behind the leader and also, for the leader, from how close the nearest
  public competitor is: pressure = clamp(1 − lead months ÷ 3, 0, 1) [D]. The race discount is
  rd = 1 − race response × pressure.
- **Per-lab draw** (Q6): ε = σ_cyc(G)·z_lab + 0.05 per speculative U-mode above superhuman coder. z_lab is fixed per
  lab and hash-seeded; the U-modes are drawn with the world's own odds.
- **Incident hazards** (Q5): h_model = (m / M_world)^1.5 · H_ref(G_pub) · (1 − 0.8·safety emphasis). The usage term
  is **the lab's actual usage from the market** (its tokens served in the market mix), not a constant.
  Misuse keeps today's row, with safety emphasis in place of eval rigor.
- **Theft** (Q7): while China holds a stolen model, its m is the stolen model's.
- **Expected outcome, not to be tuned:** in the leaning-hard calibration world most "another lab reaches ASI first"
  endings are takeovers; the safety-first kind is near even.
- **For the balance session:** the "central, leaning hard" alignment setting (shift −0.4) is not in code; the
  presets are ±0.8 and 0.

## 9. Money (mostly kept)

`finance/rivalFinance.ts` is already the simple, designer-approved finance-v3 rule. It stays with three changes:
- **Spend:** compute × the all-in H100e-year price + overhead (as today).
- **Revenue:** from the market mix on the generated lineup (as today).
- **Compute orders:** the lab places its compute appetite in the chip market and is rationed like everyone else.
  Private labs short of cash order less (as today). **The leader is no longer special:** today it gets the reference
  compute path for free and can't go broke. Under this spec the leader kind's funding and appetite decide. Its compute
  is the C_ref path only while it can pay for it.

Distress → E32 offer → license-and-hire (absorb) or bankruptcy, as today.

## 10. China

- **China's actor stays:** meters, presets, the escalation ladder, de-escalation, Taiwan, the treaty track
  (`actors/china.ts` except the lab).
- **Its lab is a headline lab:**
  - compute = DeepCent's share of China's compute meter (as today);
  - start lag measured (decision 1: real history; start value to source; check: 6.5–8 months behind in Nov 2026,
    H20 in SC1-SPEC);
  - theft and the continuous channels as in §6.
- **Out of scope here:** what the government, the public and China react to (designer: their own session). This spec
  only gives them public headline values to read.

## 11. Setup

- **Realistic (default):** the measured cast at the start date. This is one lab per real analogue, with its kind and
  start state from history, and China's preset drawn as today.
- **Create rivals (advanced):**
  - how many US NPC labs;
  - for each, a kind, with the option to adjust its seven personality values and its start lag;
  - what China is: a preset, with the option to adjust its lab's personality.
- **Removed settings:** "rival count", "rivals preset" and `setup.leaderLab`.
- **In the Frontier-leader start,** the player is the leader: the leader kind's NPC is absent, and the reference
  frontier still exists as the clock every NPC lab is measured against.

## 12. Names (invented; check each against real companies and products before adopting)

| Slot (now) | Lab | Model family |
|---|---|---|
| Frontier leader (Polaris AI) | Halcyon | Aster |
| Safety-first (Anthropos) | Lanternworks | Vesper |
| Big-tech division (Gemini Labs) | Corvane AI | Tessel |
| Founder racer (xLab) | Vektor | Kestrel |
| Open-weights platform (Meridian) | Fieldstone | Fern |
| Boutique upstart (Helix AI) | Quillon | Quill |
| China's national lab (DeepCent) | Hengyuan Lab | Heng |

## 13. Clean-up (in this workstream)

**Replaced or removed:**
- **Rival capability code:** most of `actors/rivalModel.ts` (aggregate research, recipe pools, idea adoption,
  base/post/continual-learning runs, start-equilibrium solvers; `distillStudents` and the lineup step stay),
  `data/v2/rivalModel.ts`, `RIVAL_IDEA_IDS`, `P24_RIVAL_IDEA`, `rivalSpeedMult`, `effLab`/`chinaEfficiency` and the
  China calibration scale.
- **`actors/rivals.ts`:** `labDaily` and initialisation are rewritten for the headline lab; `racePressure` and
  goalposts become the race response; `projectLabMis` (and its ~300-year bug) is removed.
- **Rival safety:** `rivalTraitStep` and the rival-only trait code in `safety/traits.ts` (`effSafety`, `rivalSignals`,
  the `growthMult` lever, the pool moderators), the `rhetoricGap` draw, and `sharedTechniquePool` if nothing else reads
  it.
- **Leader special cases:** `LEADER_ID` branches (market.ts, rivalFinance.ts), `setup.leaderLab`, `LEADER_MAX_BINDINGNESS`,
  the T1L calibration rows and three copies of the golden dates.
- **Dead state:** lab `safety`, `computeMult`, `gapYears`, `lobbyStance`, `rival:*` trust, `distilling`,
  `pressureDays`, `visible.frameworkVersion`, `visible.indexGrade` (written, never read), `finance.poolQ` outside
  finance, and `poachAggression` as a meter (it becomes a personality effect or goes).
- **`cooperation` goes** (designer, 2026-11-27: it is used for nothing). Five player actions move it (C1 threat intel,
  C3 joint evals, C4 poach, the E16 suit, the star hire, whose cost shows as "trust with rivals"), and nothing reads it.
  The writes and the displayed cost go with it.
- **`actors/fx.ts` `rivalMeter`** ignores China's lab. It goes with the meters.
- **Setup:** `rivalCount`, the `rivals` preset, the archetype table and the 9-value postures, replaced by the
  personality table.
- **Saves:** old saves may break; no migrations (memory `saves-can-break`).

China's own dead state (unread meters, `hawkDove` overwritten daily, preset blending) belongs to the China session.

## 14. Checks (shape, not knobs)

These are validation, not targets to fit:
- **The leader** reaches its milestones on the draw's own dates.
- **US rival lags** at the start are measured. Over the first year they stay in a sourced band (the old T4 3–9
  months).
- **China** is 6.5–8 months behind in Nov 2026 (H20). After a theft its lag shrinks to roughly the integration delay.
- **Frontier revenue:** CY2026 non-China frontier revenue is $100–130B, with the leader near 47%. Leader compute is
  386K H100e at end-2024 and 1.74M at end-2025 (H9).
- **Survival and valuation:** trailing private labs stay funded through 2026, valued within ×2 of real analogues (FC6);
  the leader is valued at 20–37× run-rate (F9).
- **Responses:**
  - a Taiwan disruption widens every chip-dependent lab's G gap by its compute loss;
  - an open-weights release narrows lags within about τ_D;
  - a harder alignment world raises every lab's m.

## 15. Open items: decided 2026-11-27, being worked out

- **O1. Software clock and compute as separate parts** (§4): **accepted.**
- **O2. M_world(G)** (§8), computed once per world from the same alignment latents the player's safety model starts
  from: **accepted.** Proposal being worked out: `MISALIGNMENT.md`.
- **Agent mode at 2 h** (designer, 2026-11-27): the gate drops from 4 h to the 120 min of its launch model (o3, METR
  TH1.1), for the player and the NPC labs alike (one constant, `AGENT_TASK_HOURS`). Done on branch `agent120`.
- **O3. A capability requirement for each of the 12 tools** (§7): **yes.** Proposal in `TOOL-REQUIREMENTS.md`:
  on the public model's 50% task horizon, coding ≥ 60 min, computer use ≥ 20 min, research agent ≥ 11 min [D],
  Agent mode ≥ 120 min; the other eight need none. Correction to draft 1: only Agent mode has
  a capability gate today (the 4-hour horizon). The other tools are gated for the player by research nodes (P05, P06,
  P07, multimodal, engagement) or by nothing. So each needs a sourced requirement: the capability of the model its
  real analogue first launched with. Being sourced: `TOOL-REQUIREMENTS.md`.
- **O4. Noise on public values: lead's recommendation** (sources: `CAST-2025.md` §8). One rule for every public
  value: public = true value × a log-normal error with sd σ, redrawn when the value is reported, and some values are
  also a little stale.

  | Public value | σ (or band) | Basis |
  |---|---|---|
  | Capability, as "months behind" | sd ≈ 1 month | Epoch ECI credible intervals (±1.5–1.9 points ≈ ±1.4 months at the frontier pace), plus disagreement between sources |
  | Task horizon | 0.3 | METR 95% CIs (ln-sd 0.24–0.33) |
  | Compute | 0.2 frontier labs; 0.3 parent-funded divisions; 0.5 China | Epoch 90% CIs (0.07–0.30; wide where a parent's internal allocation is unknown); China has no published CI |
  | Revenue run-rate | 0.1 if company-disclosed, 0.2 otherwise; about 1 month stale | Epoch's Confident / Likely grades |
  | Valuation | 0.05 on priced rounds; 0.2 unconfirmed | Epoch funding data |
  | Headcount | 0.15 | Epoch: "not necessarily measured consistently" |
  | Safety grade | ±1 letter step | FLI grades moved 0.3–0.5 in six months |
  | Products, prices, tools, open-weights releases, incidents disclosed, rounds announced | exact | They are public facts |

  Reported cadence: quarterly for revenue, compute and headcount; on each release for capability. These are display
  rules: the other actors read the same public values.
- **O5. The Realistic cast: lead's recommendation** (sources: `CAST-2025.md` §1–7). Start date 1 July 2025.
  - **Labs:** six US labs plus China's lab, one per kind (OpenAI, Anthropic, Google DeepMind, xAI, Meta, a boutique
    upstart standing for SSI and Thinking Machines) plus DeepSeek.
  - **Public capability lag at the start** (Epoch ECI, first-crossing method): OpenAI 0, Google DeepMind 2.5, Anthropic
    3.0, DeepSeek 6.5, Meta 9.6 months.
  - **Internal model at the start:** the lab's next public release, if it came within its release lag of the start
    (history is input). Otherwise the public model advanced by one release lag. This settles the xAI conflict: its
    public model on 1 July is Grok 3 mini (6.5 months behind), and its internal model is Grok 4 (2.5 months, released 8
    days later). Likewise OpenAI's internal model is GPT-5 (released 7 August).
  - **Software lag:** solved from the measured capability, given the lab's measured compute.
  - **Compute at the start:** log-linear between Epoch's end-2024 and end-2025 values (Epoch publishes year-end only).
    Training share: the game's sourced reference split (experiments 35%, final training 11%). DeepSeek: China's
    compute meter, as today.
  - **Money:** company-disclosed figures first (e.g. OpenAI's $12B run-rate on 30 July), Epoch's compilation
    otherwise. Media-only figures are marked unverified.
  - **The boutique upstart** has no public model and no product at the start. Its capability is unknown, so its start
    lag is a stated [D] value with a wide public band, and its funding is press-only (unverified).
  - **Still unsourced, follow-up:** release lags (only a lower bound: METR had GPT-5 four weeks before release). The
    next sourcing pass reads the system cards' stated testing windows. Until then the kinds' release lags stay
    marked [D].
  - **Headcount** uses Epoch's figures where they conflict with the repo (xAI about 300 core plus 900 tutors; Anthropic
    about 1,350–1,400).
- **`cooperation`** (§13): **goes**, along with its writes and the displayed "trust with rivals" cost.

## Appendix A. Readers of NPC lab state today, and what replaces each

From a full read of `src/` on master (2026-11-27), outside the NPC code itself (`actors/rivals.ts`,
`actors/rivalModel.ts`, `finance/rivalFinance.ts`, `data/v2/rivalModel.ts`, the lab block of `actors/china.ts`).
Grouped by system; the right column is the headline value (§4) the reader switches to.

**The contract to keep.** Every reader goes through `models/labs.ts`:
- `labCore`, `rivalLab`, `otherLabs`, `activeRivals`, `bestG`/`bestLg`;
- the lead clock `lagDays`/`leadDays` (models/capability.ts), which reads `s.series.G`/`s.series.L`, written weekly by
  core/record.ts from `bestG`/`bestLg`.

If the headline lab exposes `core` (id, name, kind, status, computeOnline, milestoneDays, security), an `internal` and
a `publicModel` as generated SimpleModels, `lineup`, `tools` and `finance`, most readers need no change.

| System | Reader (file) | Reads today | Replaced by |
|---|---|---|---|
| Endings | endings.ts rules 7 and 9; scoring.ts | `core.milestoneDays[3,5,6]`, `lagDays` | Milestones from the internal model's G (capability.ts `otherLabMilestones`, kept) |
| Endings | endings.ts catastropheCheck | `ws4.rivalIncidents` severity-5 misuse | Generated misuse incidents (§8) |
| Endings | epilogue.ts `misOf`, `projectedMisAtAsi` | `rivalMis` (trait graph), `projectLabMis` | Hidden misalignment m (§8); its value at ASI from M_world at the ASI G. No projection loop |
| Endings | epilogue.ts `otherContain`, `alignedPower`, `leadingCompetitor`, `epilogueSurvival` | `postureOf().safetyInvestment`, `archetype`, `bestG`, `lagDays` | Safety emphasis, kind, G, lag |
| Endings | view.ts end screen | names, milestones, `intel.misalignBand` vs truth | Names, milestones; the band becomes the public noisy misalignment signal vs truth |
| Market | worldfx/mix.ts `providersOf`, `tiersOf` | `publicModel`, `lineup`, `tools`, `rivalServeFpt`, `rivalDecodeU` | Generated public model, lineup and tools (§7); serving cost from model size; decode utilisation a kind constant |
| Market | worldfx/revenue.ts `sellerCaps` | `computeOnline` × serving share | Compute × the kind's serving share |
| Market | control.ts; productView.ts; serving.ts | `publicModel` social G, `r.pressure`, `tools` | Public model, race pressure (from public lags), tools |
| Market | macro.ts `aiRevenue` | `finance.revenueRun` | Revenue (kept) |
| Finance | finance/observe.ts | public level and revenue, compute, serving split, `intel.leadDaysEst` | Public values (§4) |
| Finance | story.ts, investors.ts, acquire.ts, board.ts `behindRival` | `finance.*`, public level, `bustTarget`, `markRivals`, lead estimate | rivalFinance kept (§9); lead estimate from the public lag |
| Finance | deals.ts `affiliatedLab`, IP access | `archetype==='bigtech'`, `core.id` | Kind; the IP-access shock (§6) |
| Compute | compute/market.ts `exoRefQ`, `clearMarket`, `deliverToLab` | `computeOnline`, `LEADER_ID` special case | Compute orders from compute appetite for every lab; no `LEADER_ID` |
| Compute | power.ts `poolsOf`, split.ts `allocOf` | `core.split` | The kind's fixed split (only the serving and training shares are needed) |
| Security | security.ts, theft.ts | `core.security`, `lagDays(china, lab)`; theft copies the victim's `internal` and `phys.base` into China's lab | Security from safety emphasis; theft = the theft shock (§6): China holds the victim's internal model, and its τ moves |
| Diffusion | production/diffusion.ts, models/deployments.ts `distillationLeak` | `recipeOf`, `publicModel.recG`, `phys.base.params` | The public recipe = S_ref at the public model's τ (§4); the player's own diffusion and distillation rules read it unchanged |
| Diffusion | production.ts `rivalResearch`, `advanceLab`, `computeProduction` for NPCs | the whole aggregate research | Removed: the headline daily step replaces it |
| Safety | traits.ts `rivalTraitStep`, `labMisalignment`, `labPosture`; view.ts `misByLab` | `internal.traitsTrue/uModes`, postures | Hidden misalignment m (§8) |
| Safety | findings.ts SPILL | `addRivalKnowledge` on every lab | The safety-spillover shock (§6) |
| Events | E16 talent raid (company.ts) | `poachAggression`, `poachLeakG`, `addRivalKnowledge`, `cooperation` write | The let-go shock; the raider chosen by kind (race response) |
| Events | E22 DPA (gov.ts), E32 merger (rivals.ts) | staff, compute, `finance.*`, `deactivateRival` | The absorb shock; staff become a headline-free number (the player gets staff by the existing rule) |
| Actions | actions.ts A4, C1, C3, C4, C6, E1 | `recipeOf`, `bestG`, `addPosture`, `cooperation`, open-weights absorption | d_pub (A4, C6), joint evals and poach shocks, Track-2 leak; C1's cooperation write goes (§13) |
| Actions | models/actions.ts star hire | `cooperation` write on all rivals | Goes with `cooperation` (§13) |
| Intel | actors/intel.ts `updateIntel`, `riskSources`, `leadDays`; hubView.ts `leadLanes`; selectors.ts | `intel.*` built from hidden truth, `RELEASE_LAG`, `rivalMis` | Public headline values with noise (decision 6); no separate intel model |
| Index | actors/index.ts `gradeRival` | posture, goalposts, incidents | Public safety posture and disclosed incidents |
| China actor | china.ts `usGapMonths`, gap formula, DeepCent compute; gov.ts G-CHN ladder | `lagDays(china, …)`, `computeOnline`, `china.lab.intel.leadDaysEst` | Public lag and compute values. What they react to is the China and government session |
| Core | init.ts, registry.ts, record.ts | constructors, `startDistillEquilibrium`, the NPC daily system, series | New constructors from start state + personality; series written from the headline G |
| Core | runs.ts `rivalRunFlop` | `phys.base.flop`, `phys.run.flop` | Largest training run (§4) |
| Core | save.ts migrations | `tools`, `lineup` ids | Dropped (saves may break) |
| Bots | bots/common.ts `mergerChoice`, ref.ts `bestRivalChatFit` | `acquireTerms`, public model chat fit | Unchanged readers of the generated public model and finance |
| UI | kit.tsx, Relations, RiskMap, World, LabTabs, FinanceStory, shell selectors, store | names, kind, lead estimate, `poachAggression`, open weights, `RIVAL_GOV` | Names, kind, public lag, openness; the RiskMap poach edge reads the kind's race response |

**Fields nothing outside the NPC code reads** (they go with the old model): `distilling`, `pressureDays`,
`visible.frameworkVersion`, `visible.indexGrade`, `meters.lobbyStance`, `meters.openness`, `finance.poolQ` (finance
only), `phys.{pool, ideas, clDay, run, serve, eff}` except where listed above, `SimpleModel.stolenFrom`.

## 16. Build rulings (lead, 2026-11-27, from N2a's findings)

- **R1. Internal model at the start** (revised after the designer's ruling below): generic, the lab's public model
  advanced by one release lag. No per-lab history of which model shipped next.
- **R2. Release cadence** (revised): one typical public-flagship interval for every kind, from Epoch's ECI file
  (task N2a2), not per-lab values.
- **R3. Race response** keeps today's research/17-based posture values (safety-first 0.55, upstart 0.5); the §5
  table's "low" was the lead's qualitative guess.
- **R4. Market focus** uses the measured channel mix where it exists (OpenAI: consumer 0.37, API 0.23, enterprise
  0.40); the §5 table's words are superseded.
- **R5. Lags are measured on the reference clock.** The reference frontier at the start is V0 (GPT-5 class, anchored
  at 2025.445), which is OpenAI's internal model, so OpenAI's internal lag is 0. The cast's public lags are measured
  against the public frontier on 1 July (o3-pro), which sits about 2.1 months behind V0; N2b converts them. The
  upstart has no public model: its lag is a [D] value with a wide public band.
- **R6. Noise (principle 7):** one σ per public quantity for every lab (compute 0.25), with China ×2 because its
  opacity is part of the shape. The per-kind compute σs in N2a's table are evidence only.
- **R7. Headcount is not a headline state.** Where staff move (absorb, the DPA fold-in), they come from compute ×
  one typical staff-per-H100e ratio. The cast's per-lab headcounts are evidence only.
- **R8. The software part of the reference frontier** (N1 finding). In the AIFM, `software_efficiency` is not the
  software part of `progress`: progress is log10 of the cumulative ∫10^(TSP+SE) and `training_compute` the cumulative
  ∫10^TSP, so their difference is a weighted history of SE, and raw SE is not monotone. The reference recipe is
  therefore S_ref = progress − log10 training_compute (cumulative FLOP), which makes Δprogress = ΔS_ref + ΔlogC exact,
  so G and the milestone dates are exact. The split itself only needs the right shape (principle 7): with
  near-exponential compute growth log(cumulative) ≈ log(current) + const, so compute ratios between labs carry over.
  The clock inverse reads S_ref's running maximum if S_ref ever dips.
