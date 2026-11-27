# Labour round: one consolidated design (draft for the designer, 2026-11-27)

Scope and binding decisions: design/BAL-TASKS.md "After merge: point-1 checks" and "Labour round: designer decisions";
the 30 items in design/bal/LABOUR-INVENTORY.md; the principles in design/bal/HANDOFF-CALIBRATION.md §1.
This file is the change list. The designer approves it; then the small tasks in §10 build it; then ONE measurement (§11).
Scratch for the numbers quoted here: `.scratch/labour-round/star.mjs`.

## 0. The change list

| # | Change | Main files |
|---|---|---|
| C1 | One optimal task split for every labour slot (SWE, EXP, IDEAS, SAF_EXP, SAF_IDEAS); replaces the build stopgap | production/ces.ts, departments/workfit.ts, departments/teams.ts |
| C2 | UI: per job, what AI can do, what it does now, and what +compute and +1 team add | ui/v2/panels/Agents.tsx, Lab.tsx |
| C3 | Pooled research engineers (capabilities and safety); no 2-per-project cap | models/research.ts, safety/lineProjects.ts, data/v2/research.ts |
| C4 | Hiring market: global pools per kind, inflow, matching, wages, gradual repricing, premium pay, placeholder rivals/China, sourced start; forced runs hire through it | new departments/market.ts, departments/teams.ts, core/forcing.ts |
| C5 | Quality tiers removed for every kind | data/v2/teams.ts, workfit.ts, LabTabs.tsx, Lab.tsx |
| C6 | Stars: a 4th kind, named people who add research taste only | new departments/stars.ts, workfit.ts, LabTabs.tsx |
| C7 | P24 starts from the pretraining research stock (option A) | models/research.ts linePool |

Paths are under `src/engine/v2/`, `src/data/v2/` and `src/ui/v2/` unless given in full. Old saves break (SCHEMA_REV bump, no migration).

---

## 1. C1: one optimal task split

### 1.1 The rule
The game's normalisation (workfit.ts header): `h = H × assist` human team-equivalents with the assist speed-up, `ai` AI
team-equivalents (FTE ÷ team size), `a` the share of the job's tasks AI can do alone (coverage; on safety `A = t × a`),
`ρc` the drawn coding-CES exponent (rc, < 0). Tasks have equal weight and a CES across them.

- **AI is scarce** (`ai ≤ a × (h + ai)`): AI and humans share the covered tasks, so every task gets the same labour. `L = h + ai`.
  AI does a share `ai ÷ (h + ai)` of the tasks.
- **AI could more than fill what it covers** (`ai > a × (h + ai)`): AI takes all covered tasks, humans all the rest. This is today's
  `Lrel`: `L = [(1 − a)^(1−ρc) · h^ρc + a^(1−ρc) · ai^ρc]^(1/ρc)`. AI does a share `a` of the tasks.
- So "AI doing now" (task share) = `min(a, ai ÷ (h + ai))`. The two forms meet at the switch (both give `h + ai`).
- Properties: `L ≥ h` always and `L ≥ Lrel` always (it is the optimum), so the build stopgap `max(human, L)` goes away.
- Human share of the margin `wH` (used by readouts and believed.ts): `h ÷ L` in the shared case (∂L/∂h = 1); the CES weight
  as today in the boundary case.

Worked check (`star.mjs`, ρc = −2, h = 1): a = 0.3, ai = 0.05 gives today L = 0.30 (automation *lowers* labour, the M3
central/slow problem), new L = 1.05. a = 0.6, ai = 5 gives 3.71 in both (boundary case, unchanged).

### 1.2 Check against the AIFM
`coding_labor_optimal_ces` (aifm-runs/repo/progress_model/automation_model.py:503–606, frontier precompute :366–461) solves
the same problem: tasks on [0, 1] ranked by automation threshold, compute on [0, i_c], humans spread evenly on
[i_c, 1] (its human term is `(1 − i_c)^(1−ρ)`). Two cases, the same as above: "interior" (compute-limited, i_c < i_E) and
"boundary" (capability-limited, i_c = i_E, our `a`).

**One difference.** In the AIFM, AI's output per GPU differs by task: `η(i) = η_init · (E ÷ E_aut(i))^θ`, so AI is cheaper on
tasks far below its frontier and the cut i_c puts AI on the easiest tasks first. The game's AI labour is a physical FTE per
copy (token costs, workfit.ts `fteOfFpt`), the same on every covered task. The game's rule above is exactly the AIFM's at θ → 0
within the covered set. Adopting the AIFM's per-task η would replace the game's physical AI-FTE model. I do **not** adopt it in
this round (open question Q1). The allocation rule itself is the AIFM's.

### 1.3 Where λ (the parallel penalty) applies
The AIFM applies λ once, to the total after the split: `L_ai = L_opt^λ × normalisation` (automation_model.py:910, :1038;
metrics_computation.py:238). The game keeps the same order:
- The split makes `L` and `m = L ÷ H` per slot. λ is never applied inside the split, and never to AI or humans separately.
- λ is applied once, to the labour each use receives: per project on experiments (`expLabour`, research.ts:339), per
  programme on ideas (`sciWorkRate`, :334), on the safety lines (`lineRates`), and in the rivals' aggregate
  (rivalModel.ts:316, already `(L/H)^λ`).
- Not on build capacity (today it has none). Builds are separate items in a queue; λ in the AIFM is about the research rate.

### 1.4 Files
- production/ces.ts: new `optimalLabour(rc, a, h, ai) → { L, aiTaskShare, regime }`; `Lrel` stays as its boundary branch.
- departments/workfit.ts: `effLabour` calls it; `labourOf` and `handedLabour` take `wH` from it; `aiIdeasShare` unchanged (in the
  shared case it equals AI's task share, so AI's taste weight = AI's share of the ideas work).
- departments/teams.ts `buildCapacity`: `capacity = swe.L` (remove `max(human, …)`); comment in departments/build.ts:5.
- actors/rivalModel.ts gets the rule through `effLabour` (no own change).

**Sources:** AIFM code above; ρc, coverage from each game's drawn run (already). No new numbers.
**Player effect:** AI staff never make a job slower. Early AI adds its full FTE. Coverage matters only once AI is plentiful.
**Risks:** central and slow get more labour before SC, and the game already runs early there (M3). C7 removes most of the
2027–28 jump, so the net is unknown until M4. Coverage now matters less early, so early model choice for AI staff matters less.

---

## 2. C2: what AI can do, does now, and what more would add

### 2.1 The numbers (one engine function)
New `labourMargins(s, slot)` in departments/workfit.ts, exposed through models/researchView.ts `workTypeViews` and
departments/agentActions.ts `agentsView`:

| Datum | Definition |
|---|---|
| Can do | `a` (safety: `A = t × a`) |
| Doing now | `min(A, ai ÷ (h + ai))` |
| Bottleneck | "AI staff" in the shared case; "people" in the boundary case |
| +10% AI compute | `L(k = 1.1) ÷ L − 1` (labourOf already takes `scale.k`) |
| +1 team | `L(H + 1 team-eq) ÷ L − 1` |

Both margins are in work done for that job. Outcome terms (research speed, days) stay where they are (Best moves, "Next team buys").

### 2.2 Homes (one home per datum)

| Datum | Home (level) | Elsewhere |
|---|---|---|
| Can do, doing now, bottleneck, +10% compute, +1 team | LAB › AI staff & needs, the job card (`JobCard`, Agents.tsx), level 1: the split bar gets a "can do" marker; below it two margin lines | Workforce row on LAB › Board (`WorkRow`, Lab.tsx): the bar only, no numbers; click goes to the card |
| Work done ×m | stays on the job card hero; Workforce row keeps its bar (existing) | — |
| Formula detail (h, ai, a, regime) | job card tooltips, level 2 | — |
| Outcome of +1 team / +compute | Best moves (Lab.tsx) and "Next team buys" (LabTabs.tsx), unchanged | — |

Glossary terms (design/ux/GLOSSARY.md and the Term registry): `coverage` reworded ("Can do"), new `aiDoingNow`,
`labourBottleneck`, `marginCompute`, `marginTeam`. UI tasks use the good-ui skill and include the IA map.

**Player effect:** the player sees, per job, whether to buy compute or hire. **Risks:** the margins disagree with Best moves if
they read different beliefs. Both must read the believed labour (`measuredLabour`), not the true one.

---

## 3. C3: pooled research engineers (inventory A1, decided 2026-11-24)

### 3.1 Capabilities
1. **The pool:** `P = m_EXP × H_RE,cap` effective team-equivalents (m from C1, so AI agents are part of the pool).
2. **Needs**, in the player's order (`s.player.research.re`, unchanged UI): run operations (`reOpsNeed`), evals, experiments.
   All in effective units (today divides human demand by m; the same thing).
3. **Experiments' base need:** `RE_FULL_PROJECT = 2` effective team-eq per project in experiments (renamed from
   `RE_MAX_PER_PROJECT`; now "a full project's labour", not a cap). Shown as one total: "N programmes × 2 ÷ m = X people".
4. **Shortfall:** projects get their base need in priority order; the last gets the remainder (as today).
5. **Surplus:** labour left after every need is met goes to experiments, spread evenly over the projects in experiments
   (open question Q5). Research engineers are idle only when no project is in experiments.
6. **Compute:** unchanged rule (RD-B08): an equal share per project in experiments, by need.
7. **Units:** a project's labour is now already effective, so `ℓ = (re_eff ÷ RE_LABOUR_UNIT)^λ`. Do not multiply by m again
   (`projectExpInputs`, `capEta`, `researchInputs` today multiply by `mExp`).

Files: data/v2/research.ts:186 (rename, doc); models/research.ts `reDemand`, `reAllocation`, `expShares`, `projectExpInputs`,
`capEta`, `researchInputs`; models/researchView.ts `reAllocView`; Lab.tsx status tip ("at most two teams per programme").

### 3.2 Safety
Same rule in safety/lineProjects.ts `safAllocation`: pool = the safety RE heads × the safety slot's m; the per-programme ask
(`SAF_RE_ASK × min(LINE_MULT_MAX, staffing)`, data/v2/agendas.ts:112) becomes the base need; surplus spread evenly over
experimenting programmes; other needs (review, spot-checks, cases, validation, evals, removal) unchanged.

**Sources:** no new numbers (2 and 0.25 stay [D], now base needs, not caps). **Player effect:** better agents let fewer
people run more experiments; extra research engineers speed up running projects; "idle" mostly disappears.
**Risks:** per-project λ means spreading labour over many projects gives more than one big project (Σℓᵢ^λ > (Σℓᵢ)^λ). That is
today's behaviour, but the surplus makes it bigger. Watch for "open many projects" as an exploit in M4. Readouts that assume
2 per project (A6) need a sweep.

---

## 4. C4: the hiring market

### 4.1 State
- World: `s.labour.pools[k]` for `k ∈ {eng, re, sci}`: `P` (everyone able to do the job), `w` (market wage).
  `E` (heads in AI labs: player + rivals + China) and `U = P − E` (outside) are derived each week.
- Player: `p.pay[k]` (the lab's average pay per head), `p.hiring.premium[k]` (π, discrete steps 0 / +10 / +25 / +50 / +100%).
  The hiring targets ("keep hiring to N teams") stay; they set the player's open positions `V`.
- Safety and capability research engineers, and safety and capability scientists, share one pool per kind. Engineers are one pool.
  One market wage per kind for both departments (today's lower safety pay, [D] from Levels.fyi, goes).

### 4.2 Weekly flows (new departments/market.ts, called from teams.ts `teamsWeek`)
1. **Inflow:** `P_k += I_k ÷ 52`. `I_k` = new graduates (engineers, research engineers) and, for scientists, new PhDs plus
   entrants from other fields. TO SOURCE (S2).
2. **Rivals and China** (PLACEHOLDER, labelled in code and UI): their heads follow today's paths (rivalModel.ts
   `growLabStaff`, hRef growth; China's lab likewise), split by `REF_ROLE_SHARE`. They count in `E_k` and are never rationed.
   They do not respond to wages or automation. The full version belongs to the rival session.
3. **Market wage** (rises with demand and depletion): `w_k = w0_k × [(E_k ÷ U_k) ÷ (E0_k ÷ U0_k)]^(1/η_k)`. This is the wage
   needed to pull the next person out of the outside pool, if reservation wages are log-logistic with shape η. η TO SOURCE (S5).
4. **Player hires** (a standard matching function): `hires_k = min(V_k, μ_k × U_k^α × V_k^(1−α) × (1 + π_k)^ε × pull × morale ÷ 52)`.
   Depletion (U falls) slows hiring by itself. α and ε TO SOURCE (S6, S7). `μ_k` is the one fitted number: it sets the 2025
   vacancy filling rate to the sourced one (S7), a unit translation, not a target fit. `pull` and `morale` are today's
   `talentPull` and `moraleFactor` (kept, [D]).
5. **Poaching** (premium only): rivals' staff leave at the separation rate `q` (reuse ATTRITION_BASE 12%/yr, check S8). A share
   `1 − (1 + π_k)^(−ε)` of those leavers joins the player (0 at no premium), up to `V_k`. Rival `staff.cap` falls by that many.
   No poaching from China (placeholder).
6. **Player leavers:** today's attrition (12%/yr × morale factor, teams.ts) returns them to `U_k`.
7. **Pay, gradually:** the offer is `w_k × (1 + π_k)`. New hires get the offer. Every head's pay moves toward the offer at
   `1 ÷ T` per year (contract renewal, T = 1 year; open question Q2). `p.pay[k]` blends the two. Payroll = Σ heads × `p.pay[k]`.
   So everyone ends up at the marginal wage (designer, 2026-11-26), but not overnight.
8. **Automation** enters only through `V_k`: a lab whose AI does the work raises its targets less. No other rule.

Retired: `HIRING_BASE`, `weeklyHireCap` (teams.ts:40), the fixed `TEAM_COST_M`. `fillWeeks` reads the matching rate.
Teams stay as the owned unit (150 / 100 / 40 heads); the market fills them.

### 4.3 Start state (sourced)
- Player (frontier-leader start): capability engineers + research engineers = the AIFM's own `L_HUMAN` at the start date (input_data.csv:
  1,037.5 at 2025.0, 2,593.75 at 2026.0, ≈ 1,640 at 2025.5 log-interpolated; "human coders at the leading AI company").
  Split eng : RE by research/19 §1.1 (0.30 : 0.55 of capabilities); scientists at 0.15 of capabilities. Source-derived from the
  source model; it also makes the forced path's start the player's start. Safety staff TO SOURCE (S11; research/19's 170 is [Design]).
- Pools `P0_k`, AI-lab employment `E0_k` (most of each pool outside AI firms), wages `w0_k`: TO SOURCE (S1, S3, S4).

### 4.4 Forced calibration runs hire through the market
- Retire the harness exception: `FORCING.playerStaffExact` (core/forcing.ts), `forcePlayerStaff` (teams.ts:220–231), the flag in
  scripts/v2/forcedInputs.ts `installForced`, and `HARNESS_EXCEPTIONS` (→ empty).
- The harness does only what a player can: hiring targets per kind = start heads × `staffPath(year)` (the AIFM path), and a
  premium rule: one step up each week while heads < 97% of the path, one step down while above it.
- If heads fall behind the path at +100% premium, that is a **finding** (log the shortfall per kind and date in games.jsonl). No patch.
- Note: in forced runs `staffPath` also drives hRef, so the placeholder rivals grow ×2.5/yr too. They deplete the pools as fast.

**Player effect:** hiring is fast while the pools are deep and slows as they drain; wages rise for everyone; premium buys speed
and rival staff at a lasting cost. **Risks:** payroll may become a large cost and shift the finance balance; the AIFM path may be
unreachable (then forced runs under-staff, as before but now honestly); μ fitted on 2025 data can make early hiring too easy or hard.

---

## 5. C5: quality tiers removed (all kinds)

- data/v2/teams.ts: delete `QUALITY`, `CANDIDATE_QUALITY_W`; `TEAM_COST_M` replaced by C4 pay.
- engine/v2/types.ts: delete `TeamQuality` and `Team.quality`, `TeamCandidate.quality`.
- departments/workfit.ts: `humansOf` (no `q`), `costPerWorkHour` (the lab's pay for engineers), `qualityZ` and
  data/v2/workTypes.ts `QUALITY_TASTE_SD` deleted; every team's human taste = 1 (the AIFM's company mean, `baseline_mean`).
- departments/teams.ts: `playerH`, `teamPayroll`, `fullTeamPayroll`, `newTeam`, `drawCandidate`.
- departments/teamActions.ts `teamGain` (no quality argument); Lab.tsx `bestMoves`.
- UI: LabTabs.tsx `QDots`, `Q_WORD`, the "Team quality" header tip; Lab.tsx `QDots` in `WorkRow`; glossary `teamQuality` removed.
- The team-offers stream (`CANDIDATES`, `refreshCandidates`, the Offers card) loses its point: open question Q4.

**Sources:** none needed (a removal). **Player effect:** fewer choices that were only cost/output trades. Taste differences now
live only in stars (C6). **Risks:** a Strong-only lab already reproduces the calibration (teams.ts comment), so the model is
unchanged; many tests read quality and will fail (expected).

---

## 6. C6: stars (a 4th kind)

### 6.1 Who they are
- **Pool size:** the AIFM defines a top researcher as one above the 99.9th percentile of the researcher distribution
  (config.py:41 `TOP_PERCENTILE = 0.999`). So the star pool = `(1 − 0.999) × P_sci` (C4's scientist pool), rounded. Grows
  with `P_sci`. Derived, not a new number. Translation assumption: the AIFM's distribution is a company's researchers; I
  apply it to the global pool.
- **Named individuals** (tycoon feel; discrete owned things): each gets a name, a taste and an employer (outside, a rival,
  China). Employer split at start = the scientist pool's `E/P` split (placeholder; better: S10).
- **Taste:** each star draws a quantile `u ~ U(0.999, 1)`, `z = Φ⁻¹(u)`, `T = exp(−σ²/2 + σz)`, `σ = tasteSigma(m2b)` with the
  world's drawn m2b (ces.ts:66; AIFM taste_distribution.py:269–303, mean 1). Shown as "top 0.03%" and "taste ×4.2".
  Mean star taste: 2.6 (m2b 2.5) to 6.0 (m2b 6); 4.1 at the AIFM default 3.97.

### 6.2 How a star's taste joins the teams' (matches the AIFM aggregate)
The AIFM's aggregate taste is the mean over the company's researchers, with AI as a floor: `E[max(T, T_AI)]`
(taste_distribution.py:583 `get_mean_with_floor`; integration.py:228). A star is one more researcher in that mean:

`T_h = (S × 1 + Σ T_star) ÷ (S + n_star)`, S = capability scientist heads, every team at 1 (C5).

The AI mixture stays (fix B): `T = (1 − s) × T_h + s × T_AI`. As AI's share grows, stars matter less, like the AIFM's floor.
Stars add no labour (no team, no work rate). For now they lift capability research only (taste on unlock and safety projects is deferred).
This replaces `STAR_HIRE`, `starTasteOf`, `tauH`, `p.tasteHire` and `starTaste` (data/v2/teams.ts:37–41, teams.ts:110, workfit.ts:223).

**Consequence (open question Q3):** one mean star among ~365 scientists adds +0.4% to +1.4% to idea quality (`star.mjs`), against +5%
today. That is the honest AIFM size. Value per star is then about 1% of the lab's research, which at frontier budgets is still
worth a large salary; the price can emerge.

### 6.3 Hiring stars
- Outside stars accept the star wage `w_star`; a rival's star accepts the star wage × (1 + premium_star) above a poach gap
  (TO SOURCE S9; until sourced, use the C4 premium steps). Poaching a star costs that rival's cooperation (today's −20, [D], kept and labelled).
- Star pay enters payroll (no $0.3B one-off). `w_star` follows the C4 depletion formula on the star pool. No star attrition this round.
- Files: new departments/stars.ts (pool, names, draws, hire), types (`p.stars: Star[]`), models/actions.ts (the star action
  replaced), departments/teamActions.ts; UI: a Stars card on LAB › People (owned stars; the few best available with
  employer, taste and asking pay; Hire or Poach), glossary `star`, `tastePercentile`.

**Risks:** the effect may feel too small to bother (Q3); pay sources are thin (equity dominates, S9).

---

## 7. C7: P24 starts from the pretraining research stock (option A)

**Rule:** on the day P24 opens, its pool start is the mean pool of the open pretraining start lines:
`n0(P24) = mean over {L.scale, L.data, L.opt} of (n0_l + pool_l)` on that day. Store it in the line's tree state when it opens;
`linePool` (models/research.ts:94) reads the stored value. No new number, no fresh-pool lump.

Why the mean and not the sum: the other lines' pools are each "stockAgeYears × their own start input" (research.ts:92), so each
line's rate per input matches the AIFM's RS'/RS. The mean gives P24 the same diminishing state as its siblings. The sum would
treat P24 as the whole stack's stock and make it near-useless.

Effect size: today n0 = 1.85; the rule gives roughly 15–45 (start pools ≈ stockAge × 5.7 plus research to 2027). The first idea's
effect falls about 10×, so P24 becomes an ordinary line. Rivals (`linePoolAt`): use the mean start pool of the three lines (stateless).
L.latent (opened by P17) has the same fresh-pool start: open question Q6.

**Player effect:** no sudden 2027 surge when P24 opens. **Risks:** P24 still adds its rShare 0.3 of returns permanently, an
addition with no AIFM counterpart (RATE-DECOMP §5); M4 shows whether that is visible.

---

## 8. TO SOURCE (primary sources only; a research task, §10 L10)

| Id | What | Candidate primary sources |
|---|---|---|
| S1 | Pool sizes 2025 per kind: engineers able to work at a frontier lab, research engineers (ML engineering), research scientists | BLS OES May 2024 (SOC 15-1252, 15-2051, 15-1221); US Census ACS microdata (occupation × field of degree); NSF NCSES NSCG/SDR; for scientists, unique authors of NeurIPS/ICML/ICLR main-track papers 2023–25 (proceedings, OpenReview API). Scope: recommend people hireable by US labs (US-based, plus the visa inflow), since MEDIUM is US labs only |
| S2 | Inflow per year: CS bachelor's and master's; AI/ML PhDs; PhDs from other fields who move in | NCES IPEDS completions (CIP 11.xx); CRA Taulbee Survey (PhDs by area, first jobs); NSF Survey of Earned Doctorates (physics, maths, statistics, post-graduation plans) |
| S3 | AI-lab employment at start (rivals, China), to get "most of the pool outside" right | Company filings (UK Companies House accounts of DeepMind Technologies Ltd: average employees), official company statements; China: an original author-affiliation dataset (e.g. NeurIPS affiliations), flagged as secondary if only a think-tank table |
| S4 | Wages 2025 per kind (total pay, not only base) | US DOL OFLC LCA disclosure data FY2025 (base wage by employer and title: OpenAI, Anthropic, Google, Meta, xAI); equity loading from SEC 10-K stock-based compensation ÷ employees (Alphabet, Meta) as a lower bound |
| S5 | η: how fast the sector wage rises as AI labs draw down the pool | Bound, Braga, Golden & Khanna 2015 (J. Econ. Perspectives 29(2)); Bound, Khanna & Morales 2017 (NBER w23153), the computer-scientist labour supply in their structural model |
| S6 | ε: how much a pay premium raises a firm's hires | Sokolova & Sorensen 2021 (ILR Review 74(1), meta-analysis of firm labour-supply elasticities); Manning 2021 (ILR Review 74(1), review) |
| S7 | Matching: α, and the 2025 vacancy filling rate (sets μ) | Petrongolo & Pissarides 2001 (J. Econ. Literature 39(2)); BLS JOLTS hires ÷ openings, Information and Professional & Technical Services, 2025; Davis, Faberman & Haltiwanger 2013 (QJE) |
| S8 | Separation rate of AI-lab staff (check the reused 12%/yr) | Census LEHD Job-to-Job Flows (NAICS 5112/5415/5417); BLS JOLTS quits, Information |
| S9 | Star pay and the poach gap | OpenAI Inc. IRS Form 990 (key employees' pay; the filing itself); court exhibits with pay data; DOL LCA top wages. Equity dominates, so likely understated |
| S10 | Where stars work at the start (outside / labs) | Affiliations of the most-cited authors at NeurIPS/ICML/ICLR 2020–25 (OpenReview, Semantic Scholar API) |
| S11 | Player's safety staff at the start | Labs' own published team pages and safety-paper author lists |

---

## 9. Interactions

- **C3 needs C1.** The pool is `m × heads`; with today's CES, m < 1 early in central/slow would shrink the pool. C1 makes m ≥ 1.
- **C4 needs C3.** While the 2-per-project cap holds, extra research engineers are inert (A2: staff ×2.1 vs ×7.2 made no
  difference). A market for them is pointless until the cap goes. Build C3 before measuring C4.
- **C4 feeds C1 and C2:** more heads raise `h`, which moves the switch point (AI becomes "scarce" again). The "+1 team" margin
  (C2) is what the player weighs against the market wage and premium (C4).
- **C5 before C4 and C6:** the market has no tiers; stars are the only taste difference.
- **C6 needs C4** (the star pool comes from `P_sci`; star pay uses the same wage rule).
- **C1, C3 and C7 all move the takeoff.** C1 and C3 speed central/slow before SC; C7 removes the 2027–28 jump; C4 may slow staff growth.
  The signs differ, so only the one measurement can say where the game lands. Do not tune between them.
- **Forced runs (C4.4) need C3 and C4.** Retiring `playerStaffExact` without the market would under-staff forced runs; without C3
  the extra staff would do nothing anyway.
- **Rivals:** C1 changes their aggregate through `effLabour` (rivalModel.ts). C4's placeholder makes them draw the pools but not respond.
- **Finance:** C4 and C6 raise payroll; the finance calibration (cash, burn) was set with Levels.fyi pay. Read it in M4.

---

## 10. Implementation order (small single-concern tasks)

Default model Sonnet high. Opus only with a reason: (a) no exact spec, (b) calibration trade-off, (c) cross-cutting core state.
Every task: tsc clean plus its own test (test-time policy); test:quick failures are information, classified at CP.

| Task | Concern | Files | Done when | Model |
|---|---|---|---|---|
| L1 | Optimal split rule; build stopgap gone | production/ces.ts, departments/workfit.ts, departments/teams.ts, build.ts comment | unit test: the §1.1 cases, continuity at the switch, L ≥ max(h, Lrel), safety at t = 1 equals capabilities | Sonnet high |
| L2 | `labourMargins` and view fields | departments/workfit.ts, models/researchView.ts, departments/agentActions.ts | test: margins equal finite differences of `labourOf`; read the believed labour | Sonnet high |
| L3 | Job card and Workforce row UI | ui/v2/panels/Agents.tsx, Lab.tsx, GLOSSARY.md | good-ui checklist; IA map in the task note; UI test plays | Sonnet high |
| L4 | P24 start pool (and L.latent if Q6 = yes) | models/research.ts, types.ts | test: n0 stored on open equals the mean of the three pools; linePool reads it | Sonnet high |
| L5 | Pooled capability research engineers | data/v2/research.ts, models/research.ts | tests: pool short (priority), pool long (even surplus), m = 10 runs 5× the projects of m = 2 at equal heads; no double m; one M3 seed replays to the end | Opus high (c) |
| L6 | Pooled safety research engineers | safety/lineProjects.ts, data/v2/agendas.ts | test as L5 on safety programmes | Sonnet high |
| L7 | Research-engineer readouts | models/researchView.ts, ui/v2/panels/Work.tsx, Lab.tsx, Portfolio.tsx | total need shown as "N × 2 ÷ m"; no "two per programme" text left | Sonnet high |
| L8 | Tiers removed (engine and data) | data/v2/teams.ts, data/v2/workTypes.ts, types.ts, workfit.ts, teams.ts, teamActions.ts | no `quality` in src/engine and src/data; SCHEMA_REV bumped | Sonnet high |
| L9 | Tiers removed (UI) | LabTabs.tsx, Lab.tsx, GLOSSARY.md | no quality dots or terms in the UI | Sonnet high |
| L10 | Sourcing S1–S11 into design/bal/LABOUR-SOURCES.md | docs only | every value cited to a primary source, with its translation | Opus high (a) |
| L11 | Market state and data | new data/v2/labourMarket.ts, types.ts, core/init.ts | start state from L10 builds; values cited in comments | Sonnet high |
| L12 | Market weekly system | new departments/market.ts, departments/teams.ts | tests: inflow, wage rises with E/U, hires fall as U falls, repricing at 1/T, leavers return to U | Opus high (c) |
| L13 | Premium pay and poaching | departments/teamActions.ts, market.ts, actors/rivals.ts | test: no poaching at 0%; hires rise as (1 + π)^ε | Sonnet high |
| L14 | Rivals/China placeholder in the pools | actors/rivalModel.ts, actors/china.ts, market.ts | labelled PLACEHOLDER; their heads counted in E | Sonnet high |
| L15 | Sourced start state | data/v2/teams.ts START_TEAMS, data/v2/starts.ts | leader start = L_HUMAN split; report day-1 build capacity vs upkeep (B6) | Sonnet high |
| L16 | Market UI on LAB › People | LabTabs.tsx, GLOSSARY.md | pool, wage, your pay, premium steppers, weeks to fill; good-ui checklist | Sonnet high |
| L17 | Stars engine | new departments/stars.ts, workfit.ts, models/actions.ts, types.ts | test: pool = 0.001 × P_sci; T_h formula; STAR_HIRE gone | Sonnet high |
| L18 | Stars UI | LabTabs.tsx, GLOSSARY.md | owned and available stars with taste, employer, pay | Sonnet high |
| L19 | Forced runs through the market | core/forcing.ts, departments/teams.ts, scripts/v2/forcedInputs.ts | `playerStaffExact` gone; HARNESS_EXCEPTIONS empty; shortfall logged | Sonnet high |
| CP | Checkpoint | — | tsc, lints, test:quick classified, UI test | Sonnet high |

Order: L10 starts at once (parallel). L1 → L2 → L3. L4 alone. L1 → L5 → L6 → L7. L8 → L9. L10 → L11 → L12 → (L13, L14, L15) → L16.
L17 after L8 and L12, then L18. L19 last, after L5, L12–L15. Then CP, then M4.

---

## 11. Measurement plan (M4, one run)

- **Run:** the M3 set again: 36 forced games, 12 per timeline (tl-fast, tl-central, tl-slow), the same seeds and drawn AIFM
  runs, no harness exceptions. Run and analysis are separate agents; state in files (`balance/runs/M4`).
- **Read, paired against M3** (`.scratch/M3-paired.md`), on the dashboard:
  1. SC, AC, ASI residuals against the draw per timeline (median, IQR); fits within band (M3: 12/17, 10/18, 6/18).
  2. Software rate 2026–28 against the draw (RATE-DECOMP method): is the 2027–28 jump gone, and P24's share.
  3. Labour multipliers against the AIFM at equal effective compute (LABOUR-MULT-CHECK rerun); central/slow EXP was 0.4–0.9×.
  4. Matched speed-up `spdM` against coverage: it must no longer fall as coverage rises (central, slow).
  5. Staff: heads per kind against the AIFM path; premium used; `w/w0` and `U/P` over time; the first date the path is missed.
  6. Research engineers: idle share, projects in experiments, labour per project; the same for safety.
  7. Payroll as a share of spending; cash, if finance is live in forced runs.
  8. Day-1 build capacity against upkeep (B6).
- **Rule:** a missed target is information about a mechanism, not a reason to add a forcing rule.

---

## 12. Open questions for the designer (with recommendations)

1. **AI efficiency across tasks.** The AIFM lets AI be cheaper on easy tasks; the game's AI labour is a physical FTE, the same
   on every covered task. *Recommend:* keep the game's physical FTE this round; M4 item 3 shows the remaining gap.
2. **How fast pay reprices.** Annual renewal (T = 1 year) or only through turnover (12%/yr, about 8 years).
   *Recommend:* annual renewal, closest to "everyone gets the marginal wage".
3. **Star size and form.** Matching the AIFM's mean makes one star worth +0.4–1.4% idea quality, not +5%. Should a star be lab-wide or
   assigned to a programme? *Recommend:* accept the AIFM size; named individuals, lab-wide effect, no assignment (the same aggregate,
   and no micromanagement).
4. **Team offers.** With tiers gone, the weekly team-offer list duplicates the hiring targets. *Recommend:* remove it; hiring goes
   through targets and the market.
5. **Spare research-engineer labour.** Spread evenly over running projects, or give it to the top-priority project first.
   *Recommend:* evenly (most output, per "auto-assign most efficiently"); priority only decides who is short.
6. **L.latent.** Recurrent architectures also opens with a fresh pool, like P24. *Recommend:* the same rule as P24 (mean of the
   pretraining start lines' pools on the day it opens), in the same task.

---

## 13. Deliberately left out

- Morale and attrition dynamics: pay gaps raising quits, premium effects on morale, star departures. Attrition stays 12%/yr × morale.
- Layoffs and lowering headcount on purpose.
- The one-off poach action (actors/actions.ts:70–73, the C4 act) and its tacit-knowledge leak: unchanged.
- Rivals' and China's real hiring behaviour (wage response, automation, poaching the player): the rival session.
- Visas, immigration and government talent policy; non-competes.
- Team composition cards (C2 in the inventory), product engineers, per-specialty pools.
- Taste on unlock and safety projects (deferred); stars lift capability research only.
- People leaving the pools (retirement, other careers).
- Bot staffing numbers (E2), the coverage residuals (D4), milestone constants (D6), the duplicate-literal refactor (A6) beyond the
  rename, and `ECON.hireSlope` (B9, not lab labour).
