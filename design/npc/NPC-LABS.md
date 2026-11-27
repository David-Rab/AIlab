# NPC labs as generated headline labs (spec, draft 2: the cut-down model)

Lead, 2026-11-27. Draft 2 replaces draft 1 (in git history, commit 3fb3ec0) after the designer's "remember - we want
the NPC to be simple" and approval of the cut-down model. Sourcing notes in this folder: CAST-2025.md,
TOOL-REQUIREMENTS.md, MISALIGNMENT.md (its per-lab draws, σ_cyc and option B are superseded here). Task state:
NPC-TASKS.md.

## 1. The decision

- **The player** is fully simulated inside. **Every NPC lab** (the US rivals, the frontier leader, China's lab) is
  one simple shape: a kind (a few personality values), a start state, and four numbers that move.
- **China's geopolitical actor stays** and owns one such lab. **Market competition stays emergent**: NPC lineups and
  tools are generated from the lab's public model and compete in the existing market.
- **Generated:** "so that in future if we change the balance, or the timelines - it will adjust automatically for the
  NPC labs, very easy" (designer).

## 2. Principles

1. **Generated** from the world (the timeline draw, alignment difficulty, world events), the lab's start state and
   its kind. No hand-made path per lab.
2. **Separate from the player's machinery.** Re-tuning the player's research, runs or staff doesn't move NPC labs.
3. **History is input:** the start state is measured data; later history (to late 2026) is a check, not fitted.
4. **Public vs hidden:** each value has a noisy public version, and that is all the player, the government, the
   public and China read. Hidden: true capability, true lag, misalignment.
5. **Finite shocks:** each player or world action that touches an NPC lab is one named shock (§5); its preview reads
   the same function as its effect.
6. **Outputs aren't knobs:** targets check the shape; a miss means a missing input, never a per-lab fudge.
7. **Simple, with the right shape; not a replica of reality.** "We dont need the NPC labs to be exact exact like
   reality. the principle is we want them simple and the correct 'shape' as a background. this should apply in
   general to the NPC" (designer). Real data where it sets the shape; one typical value where per-lab precision
   would only add rules.

## 3. The reference frontier

Each game uses one AI Futures Model run (its timeline draw). The **reference frontier G_ref(t)** is that run's
leading project, translated as the calibration already does: G_ref(t) = G(V0) + progress(t) − progress(2025.445).
Milestones of a lab that sits on it fall on the run's own dates. Task N1 adds the series and a reader `refG(s, t)` with
its inverse `clockOfG(s, G)` (on the running maximum if the series ever dips).

## 4. An NPC lab

**Kind (personality, fixed):**

| Value | What it does |
|---|---|
| Compute appetite | How fast it grows its compute (chip orders) |
| Funding | Parent (can't fail), private (raises, can go into distress) or state (China) |
| Release lag | Days its internal model stays internal |
| Openness | Whether its releases are open weights |
| Market focus | Weights on consumer, API, enterprise; sets its domain offsets and which tools it builds |
| Safety emphasis | Cuts its misalignment and incident rate; sets its disclosure and security |
| Race response | How much of its safety emphasis gives way under race pressure |

One release cadence for every lab: a new public flagship every 119 days (Epoch ECI, median of 27 flagship steps;
src/data/v2/npcLabs.ts).

**Start state:** its normal lag d₀, compute, money. d₀ = 30.4 × (its measured public lag − the leader's) days, so the leader sits on the reference (d₀ = 0). The Realistic cast is in src/data/v2/npcLabs.ts.

**The four numbers that move:**

| Number | Rule | Public as |
|---|---|---|
| **Lag d** (days behind the reference frontier) | Its capability is the reference value that many days ago: G = G_ref(t − d). d relaxes back to its target over the diffusion time τ_D (4 months, sourced): dd/dt = (d* − d)/τ_D, plus shocks. The target d* = d₀ plus any compute shortfall converted to days on the reference path (a lab short of X OOM of the compute it planned sits X OOM lower, which is X ÷ today's reference slope in days). | "Months behind", with noise |
| **Compute C** | Grows by its appetite through chip orders in the shared market; private labs short of cash order less (as today). China's comes from its compute meter (as today). | Announced, with noise |
| **Money** | Today's rival finance (finance/rivalFinance.ts): revenue from the market, spend from compute, raises, distress → E32 offer → license-and-hire or bankruptcy. | Revenue, rounds |
| **Misalignment m** | m = M_world(G) × (1 − 0.5 × safety emphasis × (1 − race response × pressure)) | Hidden (incidents and the safety posture are public) |

**Derived from those:**
- **Internal model:** a model at capability G. **Public model:** the internal model as it stood one release lag ago,
  updated every 119 days.
- **Race pressure:** clamp(1 − months to the nearest competitor, ahead or behind ÷ 3, 0, 1) [D]. One rule for every
  lab, the leader included.
- **Security** (sets the theft hazard on it): floor + 0.4 × safety emphasis (as today).
- **Public recipe** (what the player's own diffusion and distillation rules read): its public capability minus its
  compute advantage, log₁₀(C ÷ the leader's start compute). That is what it knows, without what it owns.

## 5. Shocks

| Shock | Trigger (existing) | Effect on d |
|---|---|---|
| **Theft** | China's theft roll, against the player or an NPC lab | China's d jumps to the victim's position plus an integration delay; it then relaxes back to China's target |
| **Publish, open weights** | The player's A4 / C6, any lab's open release | Every lab behind the released model moves part of the way to it (today's leak shares, RECIPE_LEAK_SHARE) |
| **Absorb** | License-and-hire, E32 acquisition, DPA fold-in | The buyer takes the better d and adds the compute; the seller leaves |
| **IP access** | FIN4b partner deals | The partner moves part of the way to the player's internal model |
| **Poach in / let go** | C4, E16 | The rival's d rises / falls by the tacit share moved, in days |
| **Joint evals** | C3 | The partner's safety emphasis rises a step |
| **Treaty** | A verified treaty | The reference clock runs slower (today's ×0.65) for every lab |
| **Safety spillover, Track-2 leak** | safety/findings.ts SPILL, E1 | Every lab / China moves a fixed small step |

Export controls, Taiwan, cash: through compute (§4). China's secrets leak and distillation: a pull toward the player
scaled by the player's public security and access facts, like publishing.

## 6. Lineups, tools, prices

- **Lineup:** on each release the public model gets students at the existing tier sizes (DD-01), by the existing
  distillation rule. Model size and serving cost from the lab's compute.
- **Domains:** G plus the kind's focus offsets.
- **Tools:** at the start, what the lab had. Then a tool ships once the public model's task horizon meets the tool's
  requirement (TOOL-REQUIREMENTS.md: coding 60 min, computer use 20, research agent 11, Agent mode 120 — the same 2 h
  gate as the player since 6bf46bc; the other eight need none) and the tool is in its focus, after a build time.
- **Prices:** emergent, the existing seller rule.

## 7. Misalignment and incidents

- **M_world(G):** the world's reference curve, computed once per world from the game's own alignment physics for a
  standard lab (the reference recipe REFERENCE_POST, no special methods), averaged over the training cycle. About
  30 ms, memoised, no RNG, never reads the player (task N3). A harder world, or a recalibrated safety model, moves
  every lab.
- **Incidents:** model incidents at h₀ × (m ÷ M_world(G_V0)) × (1 − 0.8 × safety emphasis) a year, with h₀ at today's
  start rate. Misuse: today's row (capability above V0 + 1 OOM × openness × (1 − safety emphasis)), so the
  severity-5 path into the catastrophe ending stays. Public if disclosed (safety emphasis, statutory floor under SB 53
  / RAISE, as today).
- **Reads:** the "another lab reaches ASI first" ending and the epilogue read m at the lab's ASI capability.
- **Expected, not tuned:** in the calibration's leaning-hard world most other-lab-first ASI endings are takeovers.

## 8. China

The actor stays (meters, presets, ladder, de-escalation, Taiwan, treaty). Its lab is an NPC lab of kind `china`:
compute from the meter, start lag from real history (check: 6.5–8 months behind in Nov 2026). What the government,
the public and China react to is their own session; they read only public values.

## 9. Public values

public = true × a log-normal error, redrawn when reported. One σ per quantity for every lab, China ×2 (its opacity is
part of the shape): months behind ±1 month; task horizon 0.3; compute 0.25; revenue 0.15, about a month stale;
valuation 0.1. Products, prices, tools, open releases, disclosed incidents and announced rounds are exact.

## 10. Setup

- **Realistic (default):** the July 2025 cast, one lab per kind plus China (npcLabs.ts REALISTIC_CAST).
- **Create rivals (advanced):** how many US NPC labs, each lab's kind (its seven values adjustable) and start lag, and
  what China is (its preset).
- Removed: rival count, rivals preset, `setup.leaderLab`. In the Frontier-leader start the player takes the leader's
  place.

## 11. Names

Marenth / Solvane (leader), Lanternworks / Ouvril (safety-first), Tarnwick / Davrel (big-tech division), Zorvane /
Brask (founder racer), Wolderfield / Hollin (open-weights platform), Pellory / Verrin (boutique upstart), Xuanmu Lab /
Muyi (China). Approved by the designer; checked by web search, not a trademark search.

## 12. Clean-up (this workstream)

- **Old NPC capability:** most of actors/rivalModel.ts (keeping `distillStudents` and the lineup step),
  data/v2/rivalModel.ts, `RIVAL_IDEA_IDS`, `P24_RIVAL_IDEA`, `rivalSpeedMult`, `effLab` / `chinaEfficiency`, the China
  calibration scale, production.ts's NPC research path.
- **actors/rivals.ts:** rewritten for the NPC lab; `projectLabMis` (and its ~300-year bug) removed.
- **Rival safety:** `rivalTraitStep` and the rival-only trait code (`effSafety`, `rivalSignals`, `growthMult`, the
  pool moderators), the `rhetoricGap` draw, `sharedTechniquePool` if nothing else reads it.
- **Leader special cases:** `LEADER_ID` branches, `setup.leaderLab`, `LEADER_MAX_BINDINGNESS`, the T1L calibration
  rows, the duplicate golden dates.
- **Dead state:** lab `safety`, `computeMult`, `gapYears`, `lobbyStance`, `rival:*` trust, `distilling`,
  `pressureDays`, `visible.frameworkVersion`, `visible.indexGrade`, `poachAggression` as a meter. `cooperation`: done
  (N7).
- **Setup data:** `rivalCount`, the `rivals` preset, the archetype table, the 9-value postures.
- **Unused N2a fields** (evidence only, principle 7): per-lab headcount, per-kind noise, per-kind cadence.
- Saves may break; no migrations.

## 13. Checks (shape, not knobs)

- The leader-kind lab at d = 0 reaches its milestones on the draw's dates.
- US rival lags at the start are the measured ones and stay in a plausible band over the first year (old T4: 3–9
  months).
- China: 6.5–8 months behind in Nov 2026; after a theft the gap shrinks, then reopens.
- CY2026 non-China frontier revenue $100–130B with the leader near 47%; trailing private labs stay funded through 2026.
- Responses: a Taiwan disruption widens every chip-dependent lab's lag; an open release narrows lags; a harder
  alignment world raises every lab's m.
- The player's catch-up through diffusion keeps today's shape (the "×5.9 your own rate" channel).

## Appendix A. Readers of NPC lab state today, and what replaces each

From a full read of `src/` on master (2026-11-27), outside the NPC code itself. **The contract to keep:** every
reader goes through models/labs.ts (`labCore`, `rivalLab`, `otherLabs`, `activeRivals`, `bestG`/`bestLg`) and the
lead clock `lagDays`/`leadDays` (series written weekly by core/record.ts). If the NPC lab exposes `core` (id, name,
kind, status, computeOnline, milestoneDays, security), an `internal` and a `publicModel` as SimpleModels, `lineup`,
`tools` and `finance`, most readers need no change.

| System | Reader | Reads today | Replaced by |
|---|---|---|---|
| Endings | endings.ts rules 7, 9; scoring.ts | milestones, `lagDays` | Milestones from the internal model's G |
| Endings | endings.ts catastropheCheck | rival severity-5 misuse incidents | Generated misuse incidents (§7) |
| Endings | epilogue.ts `misOf`, `projectedMisAtAsi` | trait-graph Mis, `projectLabMis` | m at the ASI capability (§7); no projection loop |
| Endings | epilogue.ts power and survival; view.ts | posture, archetype, G, lag, intel band | Safety emphasis, kind, G, lag; the public values |
| Market | mix.ts providers and tiers; revenue.ts `sellerCaps`; control.ts; productView.ts; serving.ts | public model, lineup, tools, serving cost, pressure | Generated public model, lineup, tools (§6); serving cost from model size; race pressure (§4) |
| Market | macro.ts | revenue | Revenue (kept) |
| Finance | observe.ts, story.ts, investors.ts, acquire.ts, board.ts | finance, public level, lead estimate | rivalFinance kept; public values |
| Finance | deals.ts `affiliatedLab`, IP access | kind `bigtech`, id | Kind; the IP-access shock |
| Compute | market.ts `exoRefQ`, `clearMarket`, `deliverToLab`; power.ts; split.ts | compute, split, `LEADER_ID` | Compute orders from appetite for every lab; a fixed typical split; no `LEADER_ID` |
| Security | security.ts, theft.ts | security, China's lag, a copy of the victim's model | Security from safety emphasis; the theft shock |
| Diffusion | diffusion.ts, deployments.ts `distillationLeak` | recipe, public recipe, model size | The public recipe (§4) |
| Diffusion | production.ts NPC research | the aggregate research | Removed |
| Safety | traits.ts rival steps, `labMisalignment`; view.ts | traits, postures | m (§7) |
| Safety | findings.ts SPILL | knowledge into every lab | The spillover shock |
| Events | E16, E22 DPA, E32 | poach aggression, staff, compute, finance | Let-go and absorb shocks; staff from compute × one typical ratio |
| Actions | actions.ts A4, C3, C4, C6, E1 | recipe, posture, open-weights absorption | Publish / open weights, joint evals, poach, Track-2 shocks |
| Intel | intel.ts, hubView.ts lanes, selectors.ts | intel built from hidden truth | Public values with noise (§9) |
| Index | index.ts `gradeRival` | posture, goalposts, incidents | Public safety posture and disclosed incidents |
| China actor | china.ts gap and compute; gov.ts G-CHN ladder | China's lag, compute, lead estimate | Public lag and compute (their session decides reactions) |
| Core | init.ts, registry.ts, record.ts, runs.ts `rivalRunFlop`, save.ts | constructors, NPC system, series, base-run FLOP, migrations | New constructors; series from G; largest run from compute × a typical run share; migrations dropped |
| Bots | common.ts `mergerChoice`, ref.ts `bestRivalChatFit` | finance, public model | Unchanged |
| UI | kit.tsx, Relations, RiskMap, World, LabTabs, FinanceStory, selectors, store | names, kind, lead, poach aggression, openness | Names, kind, public lag, openness; the RiskMap poach edge from race response |
