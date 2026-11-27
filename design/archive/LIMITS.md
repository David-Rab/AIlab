# Hidden limits: inventory and verdicts

Status: **draft, 2026-11-16.** Applies rule R11 of [STRUCTURE.md](STRUCTURE.md): every limit the player can hit is
visible where they hit it, with its reason; a limit with no real source is removed or turned into a visible trade-off.

Source: a sweep of `src/engine/v2`, `src/data/v2` and `src/ui/v2` on master `a00cb29`. The two worst items (B1, B2)
were checked by hand.

**Verdicts:** **Bug** fix it · **Remove** no source or not needed · **Show** sourced, keep, display it where it binds ·
**Gone** the restructure removes the mechanism · **OK** already visible.

## Bugs

| # | Where | Rule today | Verdict |
|---|---|---|---|
| B1 | `models/deployments.ts:44`, `actors/commitments.ts:32` | Any live commitment whose predicate is true blocks **every** deploy and swap, including unrelated ones | **Bug.** A commitment blocks only launches inside its own scope, and says why |
| B2 | `actors/commitments.ts:34-46` | `noDeployAbove` checks the **existing** live deployments, not the model being launched: it never blocks the launch that breaks it, then blocks everything after | **Bug.** Check the candidate |
| B3 | `safety/investigations.ts:89` | Investigations use AI labour with no L ≥ 8.5 safety-model gate (agendas have it) | **Bug.** One gate for all safety AI labour |
| B4 | `actors/actions.ts:476` vs `Company.tsx:268` | WSL target slider allows 1; engine silently clamps to 2 | **Bug.** One range |
| B5 | `models/deployments.ts:59` | "Deep" effort is offered in the UI but rejected without P05 | **Bug.** Lock the option with its reason |

## Models and runs

| Where | Rule | Verdict |
|---|---|---|
| `runs.ts:116` | Base runs over 150 days unavailable | **Remove** → visible staleness cost (TECH-TREE §1.5) |
| `runs.ts:59-70` | Oversubscribed pool: base runs keep their share, others silently slowed [D] | **Remove** the priority; scale all runs alike and show each run's actual share and ETA |
| `runs.ts:93` vs UI | Pool share engine 0.01–1, slider 0.1–1 | **Remove** the mismatch |
| `runs.ts:62` | A continual-learning stream takes 15% of the pool first | **Show** as a line in the run queue |
| `split.ts:125` | Split rejected if training < 2% with runs, serving < 3% with live products (toast only) | **Remove.** Runs with no compute show "paused: no training compute"; products with no serving show capacity-bound |
| `Company.tsx:212-235` | UI-only caps: top share ≤ 0.9, data ≤ 0.8, experiments 2–98% | **Remove** |
| `paradigms.ts:80,102`; `Models.tsx:178` | Paradigm projects fixed at 30 FTE / 2% exp; silent caps 0.2 and 0.9 | **Gone** (tree nodes replace projects) |
| `paradigms.ts:72,128` | Retry after a failure: 180 d, and the odds halve each retry (not shown) | **Show** on the node card (TECH-TREE T5) |
| `paradigms.ts:54` | Tier gates by measured L | **OK** → era gates |
| `actions.ts:366` | Star hires: taste ≤ 1.5 | **OK** |

## Research speed

| Where | Rule | Verdict |
|---|---|---|
| `production.ts:202,241` | **Player only:** after SC, agent and experiment ratios are divided by up to ×2.5 / ×1.5 (the reference lab is assumed to have automated research and latent reasoning) | **Show** as an explicit line in the research-speed breakdown, e.g. "Frontier methods you lack: ×0.62 → unlock Automated AI research agents, Neuralese recurrence". Same rule for every lab |
| `production.ts:92` | Agent serial speed ≤ 50 (R11 #23) | **Show** "capped" in the breakdown |
| `production.ts:217,277` | ηmod (serve-cost benefit) clamped 0.5–2.5 (spec) | **Show** in the breakdown |
| `capability.ts:70` | Design offsets help research by ±0.5 y at most (spec) | **Show** on the model card |
| `production.ts:232` | Paradigm staff subtracted from research staff | **Gone** |
| `production.ts:255` | Pause: research × 0.1 | **Show** on research speed while active |
| `data.ts:17` | Synthetic-data floor (old research factor) | **Remove** if unused since synthetic data left the research rate |
| `data.ts:26` | Data-wall penalty ≤ 0.5 y | **OK** (run card) |

## Compute

| Where | Rule | Verdict |
|---|---|---|
| `power.ts:19` | Chips beyond site power sit idle | **OK** |
| `orders.ts:55,64` | LTA 4–12 quarters, prepay 30–100% silently clamped | **Show** on the order form |
| `orders.ts:92-98` | Spot rental ≤ 10% of the market; excess dropped silently | **Show** before commit ("you'll get N of M") |
| `sites.ts:67` | Building size 100 MW–1 GW (1, 3 or 5 buildings; the campus total within the source cap) | **Show** on the form |
| `market.ts:189-212` | Rationing weights | **OK** (vendor fill) |

## Products, deployments, revenue

| Where | Rule | Verdict |
|---|---|---|
| `deployments.ts:41` | External launch needs an eval suite ≤ 30 d old | **Remove** → auto-evaluate policy (R7) |
| `deployments.ts:65-72` | Price and effort fixed at launch | **Remove** → live edit (R4) |
| `deployments.ts:102,108`; Deployments UI | Serving share: engine 2–100%, UI 60% or 80% | **Gone** (serving auto-splits across products by demand; manual override in one range) |
| `revenue.ts:157` | Serving shares over 100% rescaled silently | **Gone** (same) |
| `revenue.ts:72`; `worldfx/actions.ts:169` | Moonshot projects take serving compute first, ≤ 30% | **Show** on the moonshot card |
| `revenue.ts:79` | Revenue per chip stops growing above research speed 8 (R11 #14) | **Show** in the revenue breakdown |
| `revenue.ts:240` | Capacity-bound share erosion up to 75% [D] | **Show** the number on the product |
| `revenue.ts:122-131` | Demand modifiers (usage policy, gov only to GOV/MIL, focus × 3, restricted × 0.3, trusted × 3) | **Show** in the product's demand breakdown |

## Safety

| Where | Rule | Verdict |
|---|---|---|
| `safety/actions.ts:125`; `agendas.ts:140` | AI labour needs a safety model at L ≥ 8.5; AG17 needs L ≥ 10 | **OK** → node and policy gates (fix B3) |
| `safety/actions.ts:388-432` | Safety-agent and monitoring shares ≤ 60% | **Remove** or source; the single AI-labour policy states its range |
| `investigations.ts:67,136` | 5–40 staff silently clamped; auto-close at 120 d | **Show** on the case card |
| `agendas.ts:159` | Tool re-validation ceiling M½ × 8 (no source) | **Gone** (automatic tool upkeep) |
| `responses.ts:21` | Repeated patches floor at × 0.2 [D] | **Show** on the response card ("diminishing: next patch × 0.5") |
| `traits.ts:336` | Understanding-gap penalty capped at 2.5 levels [D] | Internal; **Show** in the codex |

## Finance

| Where | Rule | Verdict |
|---|---|---|
| `equity.ts:44-63` | Raise ceiling | **OK** |
| `board.ts:74-87` | Board vote above 10% dilution or 3× revenue commitments; veto blocks 90 d | **OK** (preview) |
| `equity.ts:165-172` | CEO silently pulls a round repriced > 25% if runway ≥ 4q [D] | **Remove** → the player decides (accept or pull) |
| `board.ts:159,256` | Incident hits on board confidence capped −20/quarter [D] | **Show** in the board-confidence breakdown |
| `debt.ts`, rescue, ouster | Debt caps, once-a-year rescue, ouster rule | **OK** |

## Relations, security, rivals

| Where | Rule | Verdict |
|---|---|---|
| `security.ts:14,55` | Security level floor rises 2.2 → 3.3 over time (industry status quo, R11) | **Show** on the security card |
| `incidents.ts:84-91` | SB 53 / RAISE shorten the time before an incident goes public | **Show** the timer on the incident |
| `actors/actions.ts:40` | Cooldowns and once-only actions | **OK** |
| `runs.ts:441`; `rivals.ts:266` | Rivals are modelled as a continuous frontier: none of the player's run, data, eval, board or commitment gates | **Show** in the codex ("rivals are simplified"); open question below |
| `rivals.ts:182` | Rival-only slowdown when a leader is bound by commitments | **Show** in the codex |

## Staffing

| Where | Rule | Verdict |
|---|---|---|
| `staffing.ts:70` | Weekly hiring cap | **OK** → candidate list size |
| `staffing.ts:61` | Layoffs only above 1.02× target and with an empty pipeline [D] | **Gone** (letting a team go is a direct action) |
| `Company.tsx:164` | Hiring target ≤ max(200, 3× staff) | **Gone** (team cards) |

## Decided

**Rivals stay simplified** (2026-11-16): the outside world, rivals included, is simulated from the outside; only the
player's company is modelled from the inside (STRUCTURE §4.8). The codex says so.
