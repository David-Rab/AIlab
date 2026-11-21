# Finance v3 build plan (phase details)

Spec: design/FINANCE-V3.md (approved 2026-11-19). User: "go ahead on all stages" (2026-11-19).
Branch `finance-v3`, worktree `../AI27-finance3`, based on master 2ef72a9. Model v3 is being built in parallel on
`model-v3` (`../AI27-model3`) by another session: **never touch that worktree or the main checkout `../AI27`.**

## Status: built (2026-11-20, FIN6c)

**What the branch contains** (FIN1–FIN6c on `finance-v3`, from master 2ef72a9; FIN5c and FIN6b were built on side
branches and merged in, cbbceed and fc8b150). Every section of FINANCE-V3 is in the engine and the Finance tab:
- §1 the story: sector value S = κ·R^α·Φ(L)·mood split by a softmax share over private labs (position, momentum,
  economics, capacity × investor credibility × governance), marked half-way each quarter, **at most a valuation cap for
  every private lab** (max($30B team value, 37× at ×5 growth × (g ÷ 5)^0.4 × run-rate)); investor pool π·S.
- §2 equity: raises with one milestone (capability / scale / adoption) and a pitch, stacking promises judged at their
  deadlines, investor credibility, down rounds (no staff attrition), repricing, tranches, IPO with dual-class.
- §3–§5 debt sized by valuation and cash flow with a rating from cash flow, liquidity and leverage; payment options
  (cash, financing lease with an RVG, chip loan) with present value; Buy chips / Rent compute contracts priced on the
  expected market path with firm-contract priority; community packages (upfront default and E27's reactive one).
- §6 partners: one offer flow, three kinds (hyperscaler, chip vendor, sovereign), up to 3 partners, exclusivity, IP
  access, rescue, contractual tranche conditions; §7 board: deterministic seat-by-seat votes on major decisions, named
  mood sources by seat kind, charter rights (safety committee release block, trust votes), critics' seat, visible
  ouster vote; §8 distress without morale hits; §9 acquisitions (E32 rebuilt, E22 obligations); §12 rivals' finance
  (`finance/rivalFinance.ts`); §13 big-tech division budget and parent confidence; §11 the Finance tab (Cash · Story ·
  What we owe · Contracts · Board & owners · Debt & partners).
- Removed: the narrative premium and old valuation formula, k_Y and the revenue plan, dice-roll approvals and 90-day
  blocks, E37 and the reinstatement, the 8 deal templates (seekPartner / acceptDeal / declineDeal), the free SPV,
  mega-JV, vendor notes, cmp.orderStandard / orderLTA / orderSpot / cloudContract / spotRental / fundSupplier, the
  separate community action. Old saves migrate (schemaRev chain in `core/save.ts`).

**Known failures at the end** (FIN6c final run; details in the FIN6c notes): safety S5 (mixed-bot median min margin,
on the baseline list since J2); hygiene's absolute perf checks only under machine load. Everything else green.

**Where the [D]/[fit] parameters live** (each number keeps its tag in a comment):
| Home | Parameters |
|---|---|
| `src/engine/v2/finance/story.ts` `STORY`, `SUPPLIER`, `DUAL_CLASS_GOV` | κ_S, α, φ / φ_ref, rates, bust ×0.7, τ, share weights, normalisation and clamps, growth range, pre-revenue line, rivals' margin, π and the carry, IPO bump, blend; supplier deposit / prepay terms |
| `src/engine/v2/finance/rivalFinance.ts` `RIVAL`, `RIVAL_GOV` | valuation cap (team value, multiple, growth ref and exponent), rivals' spend per H100e and overhead, d_max, raise trigger, exit staff share and investor return, governance by kind |
| `src/data/v2/deals.ts` `DEBT_SIZING`, `DEBT_TERMS`, `CAPEX_LEASE`, `FIRM_TERMS`, `COMMUNITY`, `PARTNER_TERMS`, `GOV_FACTOR` | credit line share and cap, chip LTV, bond multiple, spreads by rating; lease rates by rating, funded share, RVG; firm discounts by term; community package size and odds; partner equity, caps, discounts, strings, politics; governance factors |
| `src/engine/v2/finance/promises.ts` `CRED_RUNGS`, `START_CREDIBILITY`, `PITCH`, `PROMISE_RESULT`, `TREND` | credibility ladder, start credibility by start type, pitch multipliers, met / near / missed effects, trend windows |
| `src/engine/v2/finance/board.ts` `VOTE`, `OUSTER`, `CRITICS`, `BC_*`, `OBLIGATION_X_REVENUE`; `mood.ts` `MOOD_BASE`, `MOOD_WEIGHTS`, `INCIDENT_BC` | vote thresholds and force cost, ouster lean and reluctance, critics' seat, drift anchor 60 and speed, major-decision thresholds; mood source sizes and seat-kind weights |
| `src/engine/v2/finance/equity.ts` `LARGE_ROUND`, `REPRICE_DROP`; `actions.ts` `DOWN_PRICE`; `acquire.ts` `ACQUIRE`; `ledger.ts` `RENEGOTIATE`; `investors.ts` `SHOCKS` | round split, repricing, down-round price, acquisition price and terms, renegotiation deferral, hype shocks and bubble odds |
| `src/engine/v2/finance/parent.ts` `DIVISION`; `src/data/v2/starts.ts` | division budget floor / full-confidence point / overspend cost, goal weights; the parent budget path, start stakes and debts by start type |
| `src/engine/v2/finance/plan.ts` (bots only) | the finance autopilot's guards, raise trigger, site horizon [fit: F7], pitch safety |

**Refit after model-v3** (from FIN6a; these fits read quantities model-v3 replaces):
- V4 (revenue, cost to serve, price): κ_S and α; the economics weight and its 0.2 scale (today's economics bridge in
  `observe.servingEconomics`); π against the raise totals; the cap's multiple and growth exponent (run-rate, growth);
  FC2 multiples; the RefBot's revenue path (F7); FC4 commitments ÷ revenue and the partner take-or-pay size; rivals'
  revenues vs their analogues (FC6) and the rivals' book (= spend).
- V7 (rivals, bots): position and momentum weights (the rivals' start models drive the Q4 2025–Q1 2026 markdown that
  limits τ and κ); the rivals' exit timing; the bubble index (reads every lab's commitments); the bots' raise policy and
  ouster rates; the start valuations (challenger capped at $90B, spinout at its $30B team value).
- Also re-check then: the cap's growth clamp (×8 allows 45×, above FC2's 37×; clamping at ×5 is the simple fix).

**Open items:**
- FC4 commitments: 1.1–1.3× run-rate at end-2027 (target: several ×); partner take-or-pay 1.1× its equity (research
  4–12×): needs model-v3's compute demand (V4).
- L7: a blocked leased site's lessor money is never repaid or guaranteed (≈ 4% of capex; collides with E27's re-permit).
- Collapsed rivals exit in early 2028, not 2027 (their chip orders keep spend growing when broke: `actors/rivals.ts`).
- `ws4.absorbedCompute` (written by E22/E32 when a lab is absorbed) is never read: the compute a bought lab brings is
  not wired. It is WS4 / compute state, not finance, so FIN6c left it.
- The chip-tranche commitments vote counts the first tranche × 4 and Rent compute the first four quarters from next
  quarter, while the threshold reads four quarters from this one (a convention; FIN4r notes).
- The division bots never fill new sites with chips, so the parent's scale goal is almost never met (compute / bot
  matter, ST2's non-finance part).
- Exported-but-file-local helpers and constants in `finance/` (e.g. `plan.ts` guards, `promises.ts` trend windows) were
  left exported: they are the tunable numbers and tests may read them; only truly dead code was removed.

**Merge note.** The branch is based on master 2ef72a9. Model v3 is being built in parallel on `model-v3`; finance reads
model-v3-owned quantities only through `src/engine/v2/finance/observe.ts` (`publicLevel`, `publicFrontier`,
`servingEconomics`, `computeSecured`, `computeFirm`, `revenueRun`, capability thresholds, licensed models), so merging
model-v3 means re-pointing those selectors, then the refit above. Expect conflicts in `core/save.ts` (schemaRev),
`types.ts`, `actors/rivals.ts` (the one-line finance call), `bots/`, the fixtures and `design/PROGRESS.md`.

## Rules for every phase

1. Work only in `C:\Users\david\Documents\projects\AI27-finance3`.
2. Read FINANCE-V3.md (the whole spec) and this file before coding. The spec wins; if it is ambiguous or wrong in
   practice, choose the simplest reading that keeps its principles (§0) and record it in the phase's notes below.
3. **Contained:** finance reaches the rest of the game only through cash, the charter release block and ouster. No
   new effects on staff or morale.
4. **V3 seams.** Finance reads model-v3-owned quantities only through `src/engine/v2/finance/observe.ts` (created in
   FIN1, extended later): `publicLevel(s, lab)`, `servingEconomics(s, lab)`, `computeSecured(s, lab)`,
   `revenueRun(s, lab)`. No other finance file reads models/, products/ or worldfx/ internals directly.
5. New mechanisms in finance-owned files. Rival finance moves to `finance/rivalFinance.ts` (FIN5), with a one-line
   call from `actors/rivals.ts`.
6. Every number from the spec keeps its tag in a comment ([R15], [R21], [D], [fit]).
7. Action ids that are merged away are **removed**, and every caller (bots in `finance/plan.ts` and `bots/`, UI
   panels, `scripts/v2/*.ts`, `scripts/v2/uitest.mjs`, lint allow-lists) is updated. No aliases.
8. State changes: bump `SCHEMA_REV` in `core/save.ts` with a migration (or a documented schema break if migration is
   meaningless; saves from older builds may refuse to load).
9. UI for each phase's mechanics is built in that phase, minimal but correct, following the good-ui skill
   (`~/.claude/skills/good-ui/SKILL.md`; read it before UI work). FIN6 does the polish pass.
10. Done = `npm run typecheck` clean, `npm run test:v2` green (tests whose meaning changed are rewritten, not deleted
    silently: say which and why), `npm run test:ui` green for phases with UI, a PROGRESS.md row (FIN rows, same style
    as the R/J rows), phase notes appended below, one commit (or a few) on `finance-v3` ending with
    `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
11. Calibration on today's engine: run the finance and bot checks (`scripts/v2/finance.ts`, `scripts/v2/bots.ts`)
    and record the before → after numbers that matter for the phase in the notes. Full calibration is FIN6.
12. Bots must keep working through every phase: update `finance/plan.ts` (finance autopilot) to the new actions so the
    reference bot still plays a sensible CEO.

**Baseline on 2ef72a9 (2026-11-19), known failures before any finance change** — not regressions, but do not make
them worse and say if a phase fixes one:
- hygiene: `performance: daily tick average` 1786 µs and `(leader lab)` 1928 µs vs a 1.5 ms absolute budget (machine
  load from the parallel model-v3 session; the relative leader-lab check passes).
- safety: S5 mixed-bot U ≥ L − 0.5 (median −0.95), accepted as known in J2.
- finance: F2 global production 2027 44.9M (target 45–60M), accepted as known in J2.
- worldfx: Jul 2027 HireRate_SOFT ≤ 10% reached 2027-03-24.

`npm run test:v2` is an `&&` chain and stops at hygiene because of the perf checks: run the scripts after hygiene one
by one (`npx tsx scripts/v2/<name>.ts` for safety, finance, worldfx, ws4, products, money, idle) and compare with this
list.

## FIN1 Debt, rating, capex payment, contracts, community packages (spec §3, §4, §5, §10 rows)

- `finance/observe.ts` with the four selectors (bridges to today's engine; economics bridge = serving revenue vs
  serving H100e × owned/cloud cost per H100e).
- Debt (§3): credit line sized by valuation (2–4%, cap $15B) with the ⅓-of-line liquidity covenant, no self-upsizing;
  chip-backed loan unchanged; bonds only with positive trailing operating cash flow, ≤ 3× it. Rating z from cash flow,
  liquidity cover, leverage, distress (no assumed backlog).
- Capex (§4): site payment options cash / lease-SPV / (chips: chip loan). Lease = funded × CRF(r by rating, n = 15 y
  sites, 5 y chips), ledger kind for leases, residual-value guarantee as a contingent liability recorded on the site;
  unavailable below B. Remove the free SPV path, `spv` deal template use for sites, and the mega-JV.
- Contracts (§5): one Buy chips action (firmness × term; replaces cmp.orderStandard / orderLTA / orderSpot) and one
  Rent compute action (term × firm/cancellable; replaces cmp.cloudContract / cmp.spotRental; neocloud = a provider).
  Firm price follows the expected market path per quarter × (1 − firm discount); ledger payments follow that path.
  Firm contracts get rationing priority. Remove cmp.fundSupplier.
- Community (§4): upfront per-site package (≈3% capex, lowers block odds) with a company default policy; merge F1
  and cmp.communityPackage into it. E27 gets the large reactive package (≈15% capex + ~2 q delay, odds by opposition);
  relocate and sue stay.
- UI: payment options and total-cost comparison on the site build card; Buy chips / Rent compute cards on Compute;
  debt card shows capacity and why; rating with its terms.

## FIN2 Raises, thesis, stacking promises, credibility, IPO, What we owe (spec §2, §11 What we owe)

- Raise card: amount, milestone type (capability / scale / adoption), pitch (conservative ×0.85 / base / aggressive
  ×1.2 needing Credible+). Targets from the chosen metric's current trend extrapolated 12 months (via observe.ts).
- Promises stack, weight = amount ÷ trailing-year raised; judged at their own deadlines; credibility 0–100 ladder and
  board-mood deltas per §2.4. Start credibility by start type.
- Remove the revenue-based annual cap (k_Y) and the revenue plan (+15%/q) from boardQ.
- Down round: keep mood −15 and anti-dilution; **remove staff attrition**. Repriced flow kept.
- IPO as its own action (one-time, window open, healthy): ≤5% dilution + one-time public pool, listing independent,
  dual-class option (founder control kept, gov ×0.95). After listing, bonds follow §3 rules.
- `finance/owe.ts`: one selector listing every obligation (promises with progress / needed-by-now / days left,
  tranche conditions, covenants with headroom, contingent liabilities: RVGs, litigation from D3). Finance "What we
  owe" card reads it; one Watch alert when a promise turns behind or a covenant nears.
- Credibility multiplies the current valuation mark as an interim (FIN5 moves it into the share).

## Phase split (2026-11-19, user: "our stages are a bit too big")

FIN1 and FIN2 are done. The rest is split into smaller phases, each one agent run, one commit, reviewed before the
next starts. Order: FIN3a → FIN3b → FIN3c → FIN4a → FIN4b (+ FIN5c in parallel, merged) → FIN4r → FIN5a → FIN5b → FIN5c → FIN6a → FIN6b → FIN6c.

User decisions that shape them: stacked promises stay as built (weight-neutral); the board-confidence rebalance
happens in FIN3a; the issues queued from FIN1/FIN2 are assigned below.

## FIN3a Board votes and mood (spec §7.3, §7.4)

- Major decisions (§7.3): deterministic, visible seat-by-seat votes (no `rng` in approval); the vote passes if the
  weighted yes > half. List: sale of control, merger/acquisition, down round, rescue, new firm commitments or debt
  above 3× revenue. Remove the dilution vote and the 20%-of-revenue debt vote; operating decisions are never voted.
  Founder preset may force a decision at a mood cost (founder control is read from ownership/board, as FIN2 left it).
- Mood (§7.4): named sources × seat-kind weights (the spec table); reversion toward 60; remove the safety-grade
  bonus and any remaining plan-based source.
- **Rebalance board confidence** (queued from FIN2): with the revenue plan gone the reference bot ends 2027 at
  confidence 48 (was 67) and race / capex2x ousters rose (14.5% → 19%, 4.5% → 19%). Tune the source sizes so a
  competent bot sits near the old level while an aggressive failing one is still at risk; record before → after.
- UI: Board card (seats with stances, mood with its sources, ouster status); a vote preview on every major decision's
  card (each seat's vote and the total, before you ask).
- Not in this phase: charter rights, critics' seat, E37, acquisitions.

## FIN3b Charter rights, low confidence, events (spec §7.2, §7.5, §8, §10)

- Charter rights (§7.2): nonprofit-PBC safety committee blocks releasing a model your safety evals flagged (wire into
  the release/deploy path; make `safetyCommitteeVeto` real, today it is never read); PBC + trust approval for sale of
  control and for transferring a capability-threshold model (a visible vote by mission seats); legacy nonprofit
  ouster odds ×2.
- Low confidence (§7.5): "Give the critics a seat" action (available below 40; the side driving the decline gets a
  director; +15 now, the board permanently leans that way); the ouster vote visible on the Board card; remove the
  staff-revolt reinstatement; drop E37 and its bot handling.
- Distress (§8): remove the morale hit.
- **IPO repricing fix** (queued from FIN2): the 5% IPO cap must hold at close (a repriced IPO ended at 8%).
- UI: charter rights on the Board card with what each blocks; the critics' seat action.

## FIN3c Acquisitions (spec §9)

- Rebuild E32: triggered by a rival in distress (not by your lead); price = its valuation × ~0.5; pay in cash or your
  stock (dilution at your price); you take on its commitments and debt; antitrust scrutiny kept; needs a board vote
  (FIN3a). E22 (DPA consolidation) absorbed obligations follow the same rule.
- UI: the offer shows price in cash vs stock, the obligations you take on, the vote.

## FIN4a Partner offers (spec §6.1 core, §6.2, §6.3)

- One partner offer flow replaces seekPartner / acceptDeal / declineDeal and the 8 templates. Three kinds:
  hyperscaler (non-voting equity tranches capped 15% + cloud/custom chips at a discount with priority, take-or-pay),
  chip vendor (money per GW deployed + priority, buy its chips), sovereign (passive equity + political cost, no site).
- Hyperscaler cloud, custom-ASIC and vendor supply priced on FIN1's expected market path (FIN1 left them at flat
  prices). Rescue kept (distress only). Tranche conditions: gw, revenue, ipo, recapitalisation.
- Existing start states (Northwind legacy stake, start-type strategic holders) migrate to the new deal records.
- UI: partner offers with their terms and the tranche conditions (the conditions show in What we owe).
- Not in this phase: several partners, exclusivity, IP access.

## FIN4b Several partners, exclusivity, IP access (spec §6.1 strings)

- Up to 3 partners at once; exclusivity strings block the partner's competitors (more money for exclusivity);
  partners anchor at most one lab (rivals compete). No hyperscaler board seats.
- IP access string: the partner's affiliated rival lab closes ~10%/yr of your capability lead (via the rivals
  interface; no other change to rivals).
- A strategic partner's guarantee opens leases below rating B (FIN1 leftover).
- UI: Partners section with each partner's terms, strings and exclusivity conflicts.

## FIN4r Review fixes (2026-11-20)

An independent read-only review of 7f35081 (FIN1–FIN4a) found 3 high, 3 medium and 12 low findings; the lead verified
the three high ones in code. The full list with file:line references is in the brief (copied into the FIN4r notes).
Fix H1 (renegotiate on path-priced contracts), H2 (tiny-round promise weight: weight = amount ÷ max(raised in the
year, typical round d_max·V/(1−d_max) at close); keeps the user's weight-neutral stacking for normal rounds), H3 (cash
now vs tranche shown in every raise/IPO/down-round preview; unpaid shares cancelled on a lapse; no split for IPOs and
down rounds), M1 (gw: conditions on owned compute), M2 (chip loan/lease through the debt/commitments votes), M3 (site
lease construction interest over build quarters), and the cheap lows (L1–L6, L8, L10–L12); L7 and L9 if cheap. Runs
after FIN4b and the FIN5c merge (cbbceed), before FIN5a.

## FIN5a Valuation: sector value and share (spec §1)

- Sector value S_t (κ_S, α, Φ(L_frontier), mood) and share softmax over private labs with the four drivers via
  observe.ts (economics bridge until model-v3 V4), credibility and governance factor (dual-class ×0.95) moved into the
  share. Remove the narrative premium N and the old formula; pool = π·S_t.
- Supplier terms follow equity access: prepayment share = f(share, runway) (FIN1 leftover).
- Check the spinout start (queued from FIN2: spinout "overtaken" games went 6 → 10 of 20, probably the low starting
  credibility); adjust start credibility or the share if that is the cause.
- Story card UI (sector, mood, share, four drivers, credibility).
- Rivals still use their old valuations in this phase (FIN5b).

## FIN5b Rivals' finance (spec §12)

- `finance/rivalFinance.ts`, called from `actors/rivals.ts` in one line: rivals in the same split (valuation marked
  quarterly from their observables), raise at it when cash < half a year of spend (d_max, pool), trailing private lab
  in distress is license-and-hired by a big-tech rival (team + licence + compute to the buyer), bankruptcy only
  without a buyer.
- Check the 3-year rival picture again (valuations within ×2 of real analogues, trailing labs stay funded).

## FIN5c Big-tech division budget (spec §13)

- The parent sets an annual budget judged against the parent's goals (the promise mechanism, set by the parent), cuts
  it after misses; overspend is covered but costs parent confidence; replaces the runway distress verdict for
  divisions (fixes JANK-AUDIT F2). Division UI readout ("over budget by $X; parent covers").

## FIN6a Calibration (spec §14)

- Fit the [fit] parameters to FC1–FC7 on today's engine; record that a refit is due after model-v3 V4 and V7.
- Bots: fewer, larger rounds; chip loans, leases and firm contracts used; distress share; FC7 (2× capex bot reaches
  distress by 2027; it now survives far more often since FIN1: insolvency 93% → 40–50%); the F7 2026 capex edge
  ($156B, band ≥ $150B); the aggressive pitch is never used by the bot (cover with a bot variant or a test).

## FIN6b UI pass (spec §11)

- The Finance tab (Story · Raise · What we owe · Board · Cash) and the payment/contract cards against the good-ui
  skill; uitest updated; tooltips and glossary for every new term; payment options also show a present-value figure
  next to total cost (leases always look worse than cash on undiscounted total).

## FIN6c Review and cleanup

- Self-review of the whole branch: leftovers of removed mechanisms (grep removed ids, `narrative`, `kY`,
  `revenuePlan`, `megaJV`, `spv` template, E37) and dead code; docs (STRUCTURE/V2-SPEC pointers, PROGRESS) updated;
  final full test run; report what needs refitting after model-v3.


## Phase notes

(Each phase appends its notes here: choices made, deviations from the spec, numbers before → after, test changes.)

### FIN1 notes (2026-11-19)

Built: `finance/observe.ts` (publicLevel, servingEconomics, computeSecured, revenueRun + deploymentRevenue; investors'
public frontier and cashflow's deployment revenue now read through it), `finance/capex.ts` (CRF, lease rate by rating,
lease balance, residual-value guarantees, payment options), a rewritten `finance/debt.ts`, Buy chips / Rent compute
(`cmp.buyChips`, `cmp.rentCompute`), lease payment on `cmp.newSite`, `cmp.community`, E27's reactive package. schemaRev
11 → 12 with a migration (spvRVG → finLease, SPV/JV sites under construction get a 9% lease, removed templates and the
JV dropped, LTAs firm, board blocks moved to the new ids).

Removed (no aliases): `cmp.orderSpot`, `cmp.orderStandard`, `cmp.orderLTA`, `cmp.cloudContract`, `cmp.spotRental`,
`cmp.fundSupplier`, `cmp.communityPackage`, relations action `F1`; deal templates `spv`, `neocloud`, `megaJV` and their
partners (Keystone Capital stays as the lessor name, Vantage Neocloud as the default cloud provider); `fx.jv`,
`fx.spvBcQ` (the −2 board charge for off-balance-sheet guarantees), the revolver's revenue rule and quarterly
self-upsizing, the bond revenue rule, the rating's assumed backlog and its "tight" downgrade notch.

Choices and readings of the spec:
- **Credit line re-sizing.** "No self-upsizing" read as: the line is re-sized to 3% of valuation (cap $15B) only at a
  finance decision, when you borrow on it or when an equity round closes (banks re-size around raises; OpenAI's $4B
  line came with its Oct 2024 round). The automatic negative-cash cover draws only within the line as arranged. The
  leader start keeps its historical $4B line; other starts get 3% of their start valuation. FIN5 replaces the
  valuation it reads.
- **Covenant** ⅓ of the line applies while the line is drawn (cash only, not undrawn line), as before.
- **Rating.** Cash-flow test on the trailing four quarters of operating cash flow (`ws3.opCash4q`, annualised while
  fewer have closed); liquidity = cash + undrawn arranged line; fixed obligations = firm ledger payments due this
  quarter + a quarter's interest; PV(commitments) = 0.85 × remaining *firm* payments (cancellable ones excluded).
  Financing-lease payments stay operating costs in the cash-flow test (as the SPV leasebacks were).
- **Prices by rating** [D]: credit line SOFR + 150/200/250/350 bp (BBB/BB/B/closed, floats), chip loan SOFR +
  400/475/550/550 (locked at draw), bonds unchanged. The chip loan is open at any rating (spec: the only debt open to a
  loss-making lab); the credit line and bonds close with the rating.
- **Leases.** Site lease funds 80% of capex (Hyperion 80/20) as it is spent; construction interest is capitalised
  quarterly at the lease rate; payments funded × CRF(r, 15) start at go-live (one finLease ledger entry with its rate).
  Chip lease: the lessor pays the delivery balance; funded × CRF(r, 5) from delivery. Rates BBB 7 / BB 9 / B 12%,
  none below B (FIN4's partner guarantee is not built). RVG = 50% of the unamortised balance (PV of remaining payments
  at the lease rate), shown on the site and the debt card; no walk-away mechanism exists to trigger it.
- **Chip loan option** on the order card borrows 42% of the delivery balance (60% LTV × 70% collateral value of new
  chips) within the chip-loan room; tranche contracts pay through the ledger in cash only.
- **Expected path.** List price k quarters ahead = μ·c·0.92^k·(1 + π·0.75^k); cloud = 1.6 × TCO at that list price
  and kW × 0.944^k. A single batch is priced at the expected list of its delivery quarter (it used to lock today's
  list for chips delivered two quarters later); tranches and firm cloud pay one ledger entry per quarter on the path ×
  (1 − 5% at ≥ 2 y, 10% at ≥ 4 y). `commitmentsPerYear` now sums the payments due in the next four quarters (it summed
  live entries, which with per-quarter entries would count the whole schedule).
- **Firmness.** Chip terms: spot / one batch (firm toggle: take-or-pay, not cancellable) / 1–4 yr tranches (always
  firm). Rent terms: one-quarter spot rental / 1–5 yr contracts, firm (path-priced, served first as before) or
  cancellable (spot rental × 1.15 × 8760, re-priced every quarter after the clearing, rationed at a new buyer's weight
  when chips are short: a short fill shrinks the contract). Firm chip orders get the +0.5 rationing weight at once
  (the old LTA weight needed 4 quarters of age).
- **Partner deals keep their flat price** (hyperscaler cloud via `addCloud(... flatPerH)`, ASIC / vendor LTAs) until
  FIN4 rebuilds them.
- **Community.** One action `cmp.community`: with `siteId` the upfront package for a site still in permitting (+3%
  capex, block odds × 0.5); without, the company default (`policies.communityBenefits`): every unrolled site gets it,
  new sites default to it, and F1's pledge and relations effects are kept (commitment, ratepayers +10, dcNimby −10).
  F1 used to charge 3% of *all* sites' capex in cash, live ones included; now only sites still able to use it.
  E27 "Community deal": 15% of the blocked site's capex in cash, +2 quarters, the site re-permits with block odds
  1 − (0.85 − 0.5 × dcNimby/100, ≥ 0.3) and no delay roll.
- **Not built (spec §5):** "supplier terms follow your equity access: prepayment share = f(share_i, runway)" needs
  share_i (FIN5); prepayment stays the player's 30–100% choice.
- **Bot (rule 12).** `finance/plan.ts` uses the new ids: lease sites while a lessor will fund them (cash otherwise),
  one-batch chip orders, 1-year firm neocloud bridges, quarter spot rentals for the no-off-balance variant. The site
  guard GUARD_Q 4.0 → 4.5 quarters (chips stay at 3.5): cheaper path-priced chips and cloud let the old guard build
  one more big site and run at the 3-quarter distress edge (F8 distress-free fell to 58%); 4.5 restores it.
- **Runway** now projects a leased site's lease from its expected go-live and a leased/loan-paid chip delivery as its
  lease or the unborrowed part (it ignored both before; the SPV leaseback appeared only at go-live).

Numbers, before (2ef72a9 + plan) → after (FIN1):
- `scripts/v2/finance.ts` (12 RefBot seeds): F7 2026 capex $167.2B → $155.7B (range 121–167; band 150–250, the lower
  edge is close: chips now pay the expected price at delivery, ≈ 15% under today's list); compute costs $28.7B →
  $28.3B; power 6.8 → 6.7 GW; valuation $1.46T → $1.47T; F8 lease/colocation/cloud financing $101B → $64B (the free
  80% SPV used to fund every site; leases now stop when the rating is closed and bridges are cheaper); F8
  distress-free through 2026 83.3% → 83.3% (58.3% before the bot's site guard moved to 4.5 q); capex2x distress by
  2027 100% → 100%. F2 44.9M → 44.6M (known failure, one seed; it read 45.3–46.5M in intermediate runs). New FIN1
  checks: site lease repays 165% / 186% / 220% of what it funded at BBB / BB / B (the SPV repaid 48%); a 4-year firm
  cloud contract on day 400 pays $24.4B vs $43.5B at today's price × 16 (first quarter $2.37B → last $0.83B).
- RefBot diagnostic (6 seeds, `tmp` script, not committed): end-2026 ratings BBB×5 + BB → BBB×5 + B; median cash
  $36B → $46B; firm + cancellable commitments remaining $184B → $233B (leases now carry 15 years: lease entries $18B →
  $76B on seed 1); runway 1.5 → 3.5 q; rounds 5 → 5; credit line $15B → $15B (re-sized at rounds instead of growing
  with revenue). End-2027 commitments remaining $191B → $319B.
- `scripts/v2/bots.ts` (200 seeds, leader start): all §7.4 criteria MET before and after. Wins race 1.5 → 1.0%, safe
  2.0 → 1.0%, mixed 48.5 → 49.5%, ref 19.5 → 22.5%, **capex2x 1.0 → 10.0%**: capex2x insolvency 93.0% → 40.0% (median
  ending day 304 → 810). Cheaper path-priced chips and cloud and 15-year leases let the 2× build-out survive more often;
  it still reaches distress by 2027 in 100% of finance.ts seeds (FC7 holds on that test). FIN6 should look at FC7 with
  partners and rescues in place.
- Tests: hygiene perf checks fail on load as in the baseline (paired run on the same machine minutes apart: FIN1 2411 /
  2680 µs vs baseline 2487 / 2712 µs daily average, so no regression; the leader-lab worst-quarter check flipped once
  to 8.03 ms vs 8 in the chain run and passed in the paired run). safety S5 −0.95 → −1.01 (known); worldfx
  HireRate_SOFT reached 2027-03-24 → 2027-03-11 (known; both outside the Apr–Oct window). Everything else green.
  Test changes: finance.ts F7 capex adds lessor-paid chip capex; F8 label "SPV/lease/neocloud" → "lease/colocation/
  cloud"; 13 new FIN1 checks. uitest: J1 C1 uses the new ids; 9 new FIN1 checks (payment tiles, lease preview, price
  path, chip payment options, rating terms, debt limits, guarantees); 241/241.

### FIN2 notes (2026-11-19)

Built: `finance/promises.ts` (milestone trends, theses, promises, weights, judging, the credibility ladder),
`finance/owe.ts` (`whatWeOwe`: promises with progress / needed-by-now / days left, tranche conditions, covenants with
headroom, contingent liabilities), `fin.raise` with `type` (capability | scale | adoption) and `pitch` (conservative |
base | aggressive), a new one-time `fin.ipo` action with the dual-class option, investor credibility
(`finance.credibility`, its own cause key; start 60 leader / 50 challenger / 40 spinout) multiplying the valuation mark,
the Raise card (milestone × pitch, the promise and its deadline before you sign, price, down-round flag, IPO row), a
"What we owe" tab (home of investor credibility; residual-value guarantees moved there from the debt card, plus D3's
copyright-litigation exposure via `observe.copyrightExposure`, which the actors' quarterly roll now also uses), one
Watch alert ("owe") when a promise is behind or a covenant is near or failing, and a tab badge with the same count.
schemaRev 12 → 13 with a migration (credibility by start type, empty promises, revenue plan and raised tally dropped).

Removed (no aliases): the k_Y annual cap (`kY`, `parts.annualCap`, the "Annual cap" glossary term and raise-card row),
`raisedLast4q`, the board's revenue plan (`revenuePlan`, `PLAN_GROWTH_Q`, `PLAN_MISS`, the "revenue plan met/missed"
confidence sources) and the spinout's `patientQ` mod that only delayed it, the down round's 5% senior attrition (engine
and the two previews), and `fin.raise`'s `ipo` param (the IPO is `fin.ipo`).

Choices and readings of the spec:
- **Weight.** "Amount ÷ amount raised in the trailing year" is read at the deadline: the round's amount ÷ everything
  closed from its close up to its deadline (this round and the later ones). So stacking is weight-neutral: four equal
  quarterly rounds weigh 25% each, one annual round 100%; a $1B round followed by $50B weighs 2%. Before the deadline
  the card shows the weight so far (it can only fall).
- **"Missed by more than 20%"** is a shortfall of more than 20% of the promised *gain* (start → target), not of the
  target value (20% of a revenue target would forgive a shrinking lab). Progress 0 = start, 1 = target; met ≥ 1, near
  0.8–1 (no effect), missed < 0.8. Judged in capitalQ at the deadline's quarter start, before the mark and before new
  rounds close (a round closing on the deadline day does not dilute that promise).
- **Deadline** = the fourth quarter start after the close (rounds close at quarter starts, so exactly 12 months).
- **Trend** ("your current trend extrapolated 12 months"): quarter-start history (public level and compute online in a
  new `ws3.thesisHist`, seeded at day 0; revenue in `revenueHistory`). With ≥ 0.9 years of history: compound growth
  (levels: linear). 0.45–0.9 years: linear annualisation (compounding a short span turned one site going live into a
  ×8 trend). Less: the market's expected frontier pace (4 × `expectedDL`) for capability, half of the compute contracted
  for the next 8 quarters for scale. Scale never pitches below the contracted pipeline. Floors +0.2 levels / +10% a year,
  caps +4 levels / ×8 [D]. Adoption is locked while revenue is under $0.1B.
- **Needed by now**: geometric path for scale and adoption, linear for levels. "Behind" = more than 20 points of the
  promised gain short of that path once a quarter of the year has passed [D].
- **Which rounds promise.** Only `fin.raise` (a priced round with a pitch). The distress down round (priced on the
  downside, no pitch) and the IPO (public holders, no thesis in §2.6) leave none.
- **Pitch price.** The multiplier applies to the round's pre-money (term sheet = mark × price), and the dilution cap is
  computed at that price. The down-round test reads the priced pre-money, so a conservative pitch under the last
  post-money *is* a down round (flagged on the card before you sign), and an aggressive round's post-money is the bar the
  next round must clear. The quarterly mark is not pitched (an aggressive round's inflated post-money lasts until the
  next mark).
- **Credibility** multiplies the formula mark from the first quarterly mark; start valuations (the last round as given)
  are not re-scaled. Dual-class ×0.95 likewise.
- **Founder control** = the founder preset before listing, or any company listed dual-class. It feeds the only force
  mechanic that exists (`boardApproval(..., force)`, −20 confidence); FIN3 rebuilds the charter rights around it. A
  founder lab that lists without dual-class shares loses it.
- **IPO** keeps the round path: it closes at the next quarter start and can be repriced like any round (a >25% drop in
  the mark reprices it, so the 5% cap holds at signing, not necessarily at close). Public pool bonus, listing
  independent and the IPO window are unchanged; bonds never had an IPO gate (§3 rules already apply after listing).
- **Board** (FIN3 territory left alone): with the revenue plan gone, the board's mood sources are reversion to 60,
  promise results (+10 / −15 × weight), behind a rival, incidents, tight runway, down rounds, covenants. No other mood
  rule was added; FIN3 rebuilds mood by seat kind.
- **Covenant warning** [D]: a drawn credit line is "near" under 1.5 × its ⅓-of-line cash minimum; a chip loan under
  1.4 × collateral cover (sweep at 1.2 ×). An undrawn line shows "not drawn".
- **Bot (rule 12).** `plan.ts` raises only when the cash projection shows under 7 quarters (`RAISE_BELOW_Q`, a quarter
  before the board's "tight" review), at the ceiling, on `pickThesis`: its own forecast at the deadline (scale from its
  compute plan × 0.95, adoption from the reference revenue path's growth × 0.9, capability at half the trend) must clear
  the pitch's target by 10%; base if sure, else conservative unless that prices a down round; never aggressive (the
  price becomes the next round's bar). Sizing rounds to the projected hole instead of the ceiling left it short when it
  committed the next site (4/6 seeds in distress vs 2/6 baseline in a 6-seed run), so it takes what is offered when it
  does raise. In 12 seeds through 2027 it pitched scale/base 62 times and adoption/base 22 times.
- **UI.** Raise card: investor pool and dilution limit only, milestone and pitch segments (locked options say why), the
  promise line with its deadline and a tooltip (trend basis, pitch effect, met/missed effects), pre-money and a
  down-round pill, the IPO row (dual-class toggle; reason when closed), a link to What we owe. What we owe tab (between
  Cash and Contracts; badge = promises behind + covenants near): investor credibility (Why with the ladder), each live
  promise (progress bar with the needed-by-now mark, now / needed, days left, state; tooltip with start → target,
  weight, "if judged today"), the round in progress, the last four judged, tranche conditions with progress and days
  left, covenants with headroom bars, contingent liabilities (copyright litigation with odds a quarter, lease
  guarantees). The debt card keeps the lessor's rate and links to the guarantees (one home).

Numbers, before (FIN1 d3599c7) → after (FIN2):
- RefBot, 12 seeds to end-2027 (scratch diagnostic, not committed): rounds per year (median) 2026 4 → 4, 2027 4 → 2;
  rounds in total 106 → 82; equity cash in 2026 $99.5B → $99.5B, 2027 $176B → $167B; end-2027 valuation $7.03T →
  $7.38T (credibility mostly Proven by then, ×1.15); end-2027 board confidence (median) 67 → 48 (the revenue plan's
  +5 a quarter is gone; incidents now dominate); distress 2/12 → 2/12 (same seeds, both in 2025–26).
- `scripts/v2/finance.ts`: F7 and F8 unchanged (2026 capex $155.7B, compute $28.3B, 6.7 GW, valuation $1.47T,
  financing $64.6B, distress-free 83.3%, no-deal path and capex2x distress 100%); F9 unanchored dilution max 5.3% over
  81 rounds; F2 44.6M → 44.4M (known failure, one long seed). New FIN2 line: RefBot 4 rounds in 2026, 2 in 2027
  (median), 68 promises judged through 2027, 81% met (scale 47, adoption 21, capability 0), end-2027 credibility median
  82 (Proven).
- Spinout under the RefBot autopilot (6 seeds to mid-2027): distress 6/6 before and after (an "Impossible" start).
  `scripts/v2/starts.ts` (not in the test chain) fails the same 6 checks before and after (spinout overtaken 6 → 10 of
  20, challenger 7 → 6, big tech 19 → 19).
- `scripts/v2/bots.ts` (200 seeds, leader start; FIN1 baseline re-run on the same machine): all §7.4 criteria MET
  before and after. Wins race 1.0 → 1.5%, safe 1.0 → 1.0%, mixed 49.5 → 51.0%, ref 22.5 → 22.5%, capex2x 10.0 → 6.0%.
  Ousted: race 14.5 → 19.0%, safe 40.5 → 25.0%, mixed 8.0 → 11.0%, ref 13.0 → 12.5%, capex2x 4.5 → 19.0% (no revenue
  plan propping the board up; the safe bot, which missed the plan, is ousted less). capex2x insolvent 40.0 → 49.5%
  (median ending day 810 → 458: it no longer banks a round every quarter). FIN3's mood rebuild should look at the
  board-confidence level (RefBot end-2027 median 48) and the capex2x ouster share.
- Tests: `npm run typecheck` clean. test:v2 chain: golden-timelines, identity, calib, fixtures green; hygiene's perf
  checks fail under load in the chain run (4740 µs with a 200-seed harness running alongside) and pass on a quiet
  machine in two paired runs (FIN2 1486 / 1158 µs daily average vs FIN1 849 / 1492 µs; noise dominates). Then one by
  one: lint-hidden, lint-ux, lint-tradeoffs, lint-structure, ws4, products, money, idle green; safety S5 −1.01 (known,
  as FIN1); finance only F2 44.4M (known); worldfx HireRate_SOFT 2027-03-11 (known, as FIN1). `npm run test:ui`
  254/254.
- Test changes: finance.ts adds 17 FIN2 checks (ceiling without the annual cap, pitch prices and targets, aggressive
  needs Credible, promises stack with 12-month deadlines, weight, judging effects and no cash, credibility × mark and
  start values, down round without staff loss, IPO one-time + dual-class, founder control lost without dual-class, no
  revenue plan, What we owe contents, guarantees listed, behind / near flags, migration 12 → 13, RefBot rounds a year).
  uitest: the FIN1 "guarantees on the debt card" check now checks the lease row (guarantees moved to What we owe, one
  home); 15 new FIN2 checks (milestones and pitches, no annual cap, promise before signing, milestone and pitch change
  the preview, IPO row, a raise carries its thesis, What we owe rows with needed-by-now, credibility home, four
  sections, litigation, the Watch alert, the debt card's link). Fixtures regenerated (schemaRev 13).
- Left for later: FIN3 board mood by seat kind and the critics' seat (board confidence runs lower without the plan);
  FIN5 moves credibility and the dual-class factor into the valuation share and replaces the quarterly pool (the bot
  still raises at the pool-bound ceiling, so rounds stay pool-sized: about $10–330B in 2027); the "supplier terms follow
  equity access" item from FIN1 still waits on share_i.

### FIN3a notes (2026-11-19)

Built: deterministic board votes on the major decisions (`boardVote`, `commitmentsVote`, `debtVote`, `voteGate`,
`voteCost` in `finance/board.ts`; `ActionDef.vote(s, p)` replaces `boardVector`; `actionVote` for the UI), board mood
by seat kind in a new `finance/mood.ts` (`MOOD_WEIGHTS`, `moodWeight`, `boardMood`, `MOOD_BASE`, `MOOD_SOURCE_OF`), the
Board card ("What moves this board": the four sources with this board's multiplier and their 12-month sums, then the
drift to 60; seat tooltips with what each seat minds) and a vote strip under every major decision's button (one chip
per voting seat, yes/no, the total; tooltip with each seat's lean and the shared terms; a Force button under founder
control). schemaRev 13 → 14 (pending-approvals list dropped; 90-day vote blocks on raises, deals, borrowing and cloud
contracts lifted; E37's capex freeze kept).

Removed (no aliases): `boardSupport`, `boardApproval` and its dice roll, the −5 "board rejected" hit and the 90-day
block after a rejection, `BOARD_VECTORS` (dilution, pauseTraining, declineTopDeployment, releaseFlagged were never or no
longer voted; FIN3b adds the charter's release block as a hard right, not a vote), `boardSpeedAppetite`,
`Board.pendingApprovals` (never filled), `ActionDef.boardVector` (incl. the unused one on `safety.pledge`), the dilution
vote on `fin.raise` (> 10%), the 20%-of-revenue vote on `fin.drawDebt`, the mood sources "Safety Index grade" (+3/q),
"tight runway" (−5/q), "new borrowing" (−1), "debt repaid" (+1), "strategic rescue" (+10), and `actors/fx.boardConf`
(an unnamed back door to the meter).

Choices and readings of the spec:
- **Vote.** Each voting seat's lean = stance · decision vector + outside-ownership drift (R15, as before: outside share
  × (v_speed + v_fin)) + mood (BC − 50)/50 + a situation term; yes above 0; the CEO's seat always yes; observers do not
  vote; passes when the yes weight > half. Situation [D]: funding decisions (down round, rescue) +(6 − runway q)/4,
  0…1.2 ("the alternative is running out of cash"); obligations (commitments, debt) (runway q − 4)/8, ±0.5 ("can the
  company carry it"); control decisions none. Vectors: sale of control [0,0,0,−1], commitments [0.5,−1,0,0] and debt
  [0.3,−1,0,0] kept from R15; down round [0,−0.3,0,0], rescue [0,0.3,0,−0.6], merger [0.5,−0.5,0,−0.2] [D]. A failed vote
  just stops the action with the vote as its reason (no side effects: nothing to re-roll). Founder control (founder
  preset before listing, or dual-class) forces a failed vote at −20 (kept).
- **Which decisions.** Down round = `fin.downRound`, `fin.acceptRepriced` when below the last post, and `fin.raise` when
  its pitch prices below the last post-money; rescue = `fin.rescue`; firm commitments = partner deals
  (`fin.acceptDeal`), quarterly chip tranches (`cmp.buyChips` term ≥ 2) and firm cloud contracts (`cmp.rentCompute`)
  when firm payments due in the next four quarters (`commitmentsPerYear(s, true)`; cancellable ones no longer count)
  would exceed 3× revenue; debt = any `fin.drawDebt` that takes drawn debt above 3× revenue. Spot chips, single batches,
  spot rentals, cancellable contracts, sites (their lease payments start at go-live, outside the four-quarter window)
  and every other operating decision are never voted. Sale of control and merger exist as decisions with vectors but
  nothing calls them yet (FIN3c wires E32; the endings' sale-of-control check is unchanged).
- **Mood weights** are the spec table; strategic seats [D] like a financial holder that minds promises less
  (1/1/1/0.5), government seats [D] like a mission seat (0.5/1/0.5/1.5). A board's multiplier for a source is the
  vote-weighted mean over its voting seats other than the CEO's (1 if none). Leader start (2 mission + 2 independent):
  promises ×0.75, setbacks ×1.25, behind ×0.25, incidents ×1.5; founder preset (financial + independent): ×1.25 / ×1.25 /
  ×1 / ×0.75, shifting as financial seats join.
- **Sources (named only)**: promise results (§2.4 × weight × the multiplier), setbacks (down round −15, covenant breach
  −15, each quarterly review in distress −4, failed raise −5; out of distress +10, the spec's "results restore it"),
  behind (behind the best rival −5/q; E17 pause −5, renamed "frontier pause"), incidents. Plus the drift to 60 (10% of
  the gap a quarter), the −20 force cost, and E37 / CEO reinstated until FIN3b removes them. The ouster grievance reads
  the categories (incidents = reckless, setbacks = burning the company, the rest = slow). The distress morale hit stays
  (FIN3b removes it).
- **Rebalance [D].** Promise results ±30 × weight on the board (was +10 / −15; the credibility sizes, so a promise is
  the board's main good news now the plan is gone); public incidents −(4 + 3 × (sev − 1)) ≤ 13 each, ≤ 8 a quarter (was
  10 + 5 × … ≤ 30, ≤ 20) before the multiplier, so a mission-heavy board takes ≤ 12/q; covenant breach −20 → −15 (a
  breach is also distress, now counted every quarter). Tight runway is no longer a source (spec: distress).
- **UI.** The vote strip sits under the action button with its own tooltip (outside the button's preview tooltip) on
  every card that shows a major decision (raise / down round / rescue / repriced round, Borrow, partner offers, Buy
  chips, Rent compute); yes chips are filled and no chips dashed (not colour alone). Previews show the down-round hit,
  the promise's board effect and the incident cap at this board's multiplier. Glossary: new `boardVote`; `boardConf`,
  `boardSeat`, `promise`, `downRound`, `rescue` updated; LIMITS board.incidentCap updated.

Numbers, before (FIN2) → after (FIN3a):
- Board confidence, scratch diagnostic (24 seeds per bot, leader start, bots.ts setup with endings, through 2027;
  medians of games still running): end-2027 ref 46 → 59, mixed 44 → 62, safe 51 → 60, race 30 → 38, capex2x 18 → 1;
  end-2026 ref 53 → 68, mixed 50 → 67, race 47 → 49, capex2x 18 → 1; yearly minimum ref 40 → 53, mixed 33 → 57, race
  28 → 32, capex2x 26 → 11. `scripts/v2/finance.ts` RefBot (12 seeds, no endings) end-2027 median 48 → 61.6 (FIN1 with
  the plan: 67). Before FIN3a only capex2x's firm bridge rentals ever triggered a vote in that diagnostic (5 in 24
  games); the bots barely meet votes.
- `scripts/v2/bots.ts` (200 seeds, leader start): all §7.4 criteria MET. Wins race 1.5 → 1.5%, safe 1.0 → 1.0%, mixed
  51.0 → 52.0%, ref 22.5 → 22.0%, capex2x 6.0 → 3.0%. Ousted: ref 12.5 → 10.5%, mixed 11.0 → 11.5%, race 19.0 → 14.5%,
  safe 25.0 → 16.5%, capex2x 19.0 → 34.5% (insolvent 49.5 → 48.0%). The competent bots sit at FIN1/FIN2 ouster levels
  (FIN1: ref 13, mixed 8); race stays at real risk (as FIN1, 14.5%); capex2x is ousted more because setbacks weigh ×1.25
  on the leader board and distress now costs every quarter: its board crashes in its first year (covenant breach, down
  rounds, distress) and the ouster usually comes before the insolvency it was heading for (company loss 68.5 → 82.5%).
  FIN6a may soften this alongside the FC7 work.
- `scripts/v2/finance.ts` F7/F8/F9 unchanged within noise (2026 capex $155.7B → $156.2B: the finance stream no longer
  feeds approval dice; financing $64.6B, distress-free 83.3%, capex2x distress 100%, dilution max 5.3%); RefBot rounds
  2026 4 / 2027 2, promises met 81%.
- Tests: `npm run typecheck` clean. test:v2 chain: golden-timelines, identity, calib, fixtures, hygiene (quiet machine:
  perf checks passed), lint-hidden, lint-ux, lint-tradeoffs, lint-structure green; safety S5 −1.01 (known, as FIN1/2);
  then one by one: finance only F2 44.4M (known); worldfx HireRate_SOFT 2027-03-11 (known); ws4, products, money, idle
  green. `npm run test:ui` all passed. Test changes: finance.ts FIN2 promise-judging check now expects the board part
  × the board's multiplier at ±30 (was +10 / −15: the FIN3a rebalance); 11 new FIN3a checks (deterministic vote, the
  situation and mood terms, which decisions are voted, a failed vote has no side effects, founder force, mood weights by
  seat kind, no removed sources, only named sources, RefBot end-2027 confidence ≥ 55, migration 13 → 14). uitest: 8 new
  FIN3a checks (mood sources, multiplier and seat tooltips, the down-round vote seat by seat with its tooltip, a failed
  vote disables the button, no force without founder control, founder force books the round at −20). Fixtures
  regenerated (schemaRev 14).
- Left for later: FIN3b (charter rights incl. the safety committee's release block, the critics' seat, the visible and
  deterministic ouster vote, E37 and the staff-revolt reinstatement, the distress morale hit, the IPO repricing fix);
  FIN3c wires the sale-of-control and merger votes into the rebuilt E32. `design/v2-interfaces.ts` still shows the old
  `pendingApprovals` / `boardVector` (design file, FIN6c docs pass).

### FIN3b notes (2026-11-20)

Built: `finance/charter.ts` (the charter rights of each preset with what they block; `charterReleaseBlock`, called by
`models/deployments.ts` `deployGate` before the eval gate; the trust's `transferVote` and `controlVote`; `charterHolds`),
the trust's vote (`trustVote` in `finance/board.ts`: the board-vote machinery restricted to the mission seats, never
forceable, `BoardVote.body = 'trust'`, new decision `transferModel`), the deterministic ouster vote (`ousterVote`,
`ousterLive`, `ousterPassesBelow`, `boardGrievance`, `OUSTER`), the critics' seat (`fin.critics` "Seat the critics";
`CRITICS`, `criticsSide`, `criticsAvailable`, `criticsSeat`, `criticsOusterShift`, `giveCriticsSeat`), the IPO's cap at
close (`closingAsk` in `finance/equity.ts`). UI: the Board card's charter rights (each with what it blocks; the safety
committee row names the models it holds, with flag and source in the tooltip), the ouster vote under the next review
(one chip per voting seat at today's confidence, where each seat turns and the confidence the vote passes below), the
"Seat the critics" button below 45 confidence with its preview; Products links to the held models (home: the Board
card); a blocked launch or model swap says why through the deployment gate's reason. schemaRev 14 → 15 (board block list
and reinstatement day dropped, a pending E37 dropped).

Removed (no aliases): event E37 "Board revolt" (`finance/events.ts`, `FINANCE_EVENTS`, `rallyOdds`) and the bots'
`financeDecide` (it only answered E37); `ws3.blockedUntil`, `boardBlocked` and the Finance actions' block check (E37's
capex freeze was the last board block); the ouster dice (`ousterRiskQ`, `ousterMajorityP`, the 15%-a-quarter roll); the
staff-revolt reinstatement (`REINSTATE_MORALE`, `ws3.reinstatedDay`, the "CEO reinstated" source); the distress morale
hit (−5 morale per quarterly review in distress). Glossary `boardRevolt` → `boardWarning`; new `charter`, `critics`;
`ouster`, `boardVote`, `boardConf`, `distress` updated; `design/ux/GLOSSARY.md` regenerated (it was stale since before
FIN1).

Choices and readings of the spec:
- **"A model your safety evals flagged"** = E17's red-flag traits (scheming, alignment faking, sandbagging) in the
  player's own beliefs (never truth), clarity > 0.4, at a stricter estimate than E17's 30% alarm: **above 50%** [D]
  (`COMMITTEE_EST`). At 30% the committee held 70% of the reference bot's full models (10 seeds; RefBot answers E17 with
  Continue) and the reference path released so much slower that worldfx's AI-friend share fell to 6.1% (target 10 ± 3).
  At 50% (10 seeds per bot, full models that ever carried a flag): RefBot 13%, race 51%, mixed 0.5%, safe 0%: the
  committee bites reckless designs and almost never a careful lab. The dangerous-capability flags (bio, cyber) were not
  used for the committee: on today's benchmarks nearly every 2026+ frontier model crosses cyber, so they would block all.
- **What it halts**: every external channel (products, gov, trusted, open weights) and a live product's model swap; the
  upgrade-to-newest policy skips held models; internal use is never a release; live products are not recalled. The hold
  lifts when every estimate is 50% or less (more evidence, an investigation, a patched or retrained version). It is a
  hard right: no vote, no force. `safetyCommitteeVeto` is what the gate reads (a nonprofit-PBC board without it would not
  block); the recapitalisation still sets it.
- **Capability-threshold model** (PBC + trust) = a version whose measured dangerous benchmarks set bio uplift, cyber
  offense or autonomous replication (`observe.capabilityThresholds`; persuasion is not a threshold). **Transfer** =
  releasing its weights (a launch on the open channel). Not gated: relations action C6 "Open weights" (an abstract
  trailing release with no version to test; FIN6c or model-v3 can attach one) and the rescue's "IP rights" string (a
  no-op until FIN4b builds IP access; FIN4b should put it behind `transferVote`).
- **Sale of control** (PBC + trust) = a partner deal or rescue that would leave one holder above 50% of the equity
  (`partnerStakeAfter`: equity now plus the rescue top-up, on a copy of the cap table). Only the trust's vote is wired;
  the board's own §7.3 sale-of-control vote stays with FIN3c (as planned in FIN3a). The trust votes first, before any
  forced board vote, so a founder never pays the force cost for a deal the trust stops. On its mission stance the trust
  votes no on both (sale of control: lean −1 + mood ≤ 0; transfer: ≤ −0.9); the vote is shown, not rolled.
- **Legacy nonprofit "ouster odds ×2"** (still in place after FIN3a as ×2 on the roll) becomes half the reluctance in
  the deterministic vote.
- **Ouster vote** (kept: the warning below 35, cleared at 45; a vote only below 25 with a warning at least 60 days old;
  the grievance shares slow / reckless / burning cash and their vectors; the outside-ownership drift). Each voting seat
  other than the CEO's leans grievance + depth − reluctance, depth = (25 − confidence)/25, and votes yes above 0; more
  than half the voting weight ends the game. **Reluctance 1.5** (legacy 0.75) [D]: with 1.0, 40 seeds per bot ousted ref
  17.5%, race 22.5%, capex2x 62.5%, safe 42.5%. A seat turns once confidence falls below 25 − 25 × (reluctance −
  grievance), which the Board card shows. The grievance now reads only the named mood sources (the drift down from above
  60 and the founder force cost no longer count as "too slow").
- **Critics' seat** [D]: below 40, once a year, while the board has fewer than 9 voting seats (R15: boards of 5–9); +15
  now. The side is the mission (a "Safety director", mission seat) when public incidents caused more of the last year's
  losses than everything else; otherwise the investors (an "Investor director", financial seat): falling behind, missed
  promises and financial setbacks (the spec names only slowness; an investor director is the natural answer to burning
  cash too). The seat is permanent and votes like any seat of its kind, so it can also vote you out later: the preview
  shows the mood multipliers it shifts and the ouster vote's passing line before → after. The board's warning alert names
  it once. "Seat the critics" is the action title (lint: at most 4 words); the glossary keeps the spec's name.
- **IPO cap at close**: an IPO raises at most d·pre/(1 − d), d = 5%, at its closing pre-money (`closingAsk`); if the price
  fell after signing (repriced, or the over-ask discount) it raises less instead of selling more of the company. The
  repriced round's accept preview shows the capped amount.
- **Bot (rule 12)**: `financeAutopilot` seats the critics below 35 when available and only if the margin above the
  ouster vote's passing line grows (`criticsOusterShift`); E37's answers are gone with E37.

Numbers, before (FIN3a 1c8f0b3) → after (FIN3b):
- `scripts/v2/bots.ts` (200 seeds, leader start): all §7.4 criteria MET. Ousted: ref 10.5 → 12.0%, mixed 11.5 → 12.0%,
  race 14.5 → 13.0%, safe 16.5 → 31.5%, capex2x 34.5 → 47.0% (insolvent 48.0 → 36.0%). Wins: race 1.5 → 1.0%, safe 1.0
  → 1.0%, mixed 52.0 → 51.0%, ref 22.0 → 22.5%, capex2x 3.0 → 3.5%. Safe losses overtaken/other-ASI-first 66% (criterion
  ≥ 50%). The safe bot's late game (2028–29) ends in long distress with board confidence near 0; the dice let such a CEO
  survive about 85% of quarters and the reinstatement (morale > 70) reset confidence to 45 once; the vote now removes a
  CEO whose board has lost all confidence. capex2x's board crashes in its first year and the vote ousts it before the
  insolvency it was heading for. FIN6a may soften both alongside FC7.
- Safety committee on the bots (40 seeds each; games in which it held at least one model ready to release): ref 15/40,
  mixed 4/40, race 11/40, safe 1/40, capex2x 3/40 (the leader start becomes a nonprofit PBC when its recapitalisation
  completes, about Oct 2026). `scripts/v2/finance.ts` RefBot (12 seeds to end-2027): 7 of 12 games held a model, 15
  versions in all, median 2% of PBC weeks with a hold.
- Critics' seat taken by the bots (40 seeds): ref 12, mixed 6, race 35, safe 34, capex2x 40 games.
- `scripts/v2/finance.ts`: F7/F8/F9 unchanged (2026 capex $156.2B, valuation $1.47T, financing $64.6B, distress-free
  83.3%, capex2x distress 100%, dilution max 5.3%); RefBot end-2027 board confidence median 61.6 → 60.1; F2 44.4M
  (known).
- worldfx: the known HireRate_SOFT failure now passes (2027-03-11 → 2027-07-15) and AI-friend share 9.1% → 7.4% (target
  10 ± 3): a side effect of the committee holding some of RefBot's red-flagged releases after its recapitalisation (with
  the committee off the run reproduces the baseline exactly), not a fix of that calibration.
- Tests: `npm run typecheck` clean. test:v2 chain: golden-timelines, identity, calib, fixtures, hygiene (perf passed on
  a quiet machine: 828 / 882 µs daily average), lint-hidden, lint-ux, lint-tradeoffs, lint-structure green; safety S5
  −1.01 (known); then one by one: finance only F2 44.4M (known); worldfx, ws4, products, money, idle green. `npm run
  test:ui` 272/272. Test changes: finance.ts drops the E37 event lint (WS3 has no events; it now checks E37 is gone and
  lints the critics' seat preview), the FIN3a failed-vote and migration checks read the removed block list's absence,
  "only named sources" allows "critics given a seat" instead of the reinstatement and E37; 13 new FIN3b checks (committee
  hold on every external channel and a swap, not internal use, veto read, lifts at 50%; legacy has no committee; the
  trust's votes on open weights and control, mission seats only, no force; a deal past 50% stops at the trust with
  nothing booked; ouster vote deterministic, legacy reluctance ×0.5, no vote without the line and the 60-day warning; at
  the review a reckless CEO is ousted with morale 95 and a slow one shielded; critics' seat side, +15, once a year, mood
  weights; no distress morale; IPO ≤ 5% at a repriced close; RefBot committee holds). ws4.ts E1 catalog: 15 → 14 kept
  events (E37 dropped). uitest: 10 new FIN3b checks (charter rights and what they block, the held model and its tooltip,
  the Products link, the launch reason, the ouster vote seat by seat and its tooltip, the critics' preview, click, once a
  year). Fixtures regenerated (schemaRev 15).
- Left for later: FIN3c wires the board's own sale-of-control and merger votes (E32) next to the trust's; FIN4b puts the
  rescue's IP-rights string behind the trust's transfer vote; C6 "Open weights" has no version for the trust to judge;
  FIN6a looks at the safe and capex2x ouster rates; `design/V2-SPEC.md` §3.7.5 carries a pointer to these notes (full
  docs pass in FIN6c).

### FIN3c notes (2026-11-20)

Built: `finance/acquire.ts` (the terms of buying a rival: price, stock stake, obligations; the hypothetical company after
the deal; the merger and sale-of-control votes; payment; taking on the obligations; preview lines), E32 "Merger offer"
rebuilt (`events/catalog/rivals.ts`: Pay cash · Pay in stock · Decline), E22 "DPA consolidation" taking on the absorbed
labs' obligations behind a merger vote (`events/catalog/gov.ts`), a new ledger kind `acquired` (one firm entry per
bought lab) and a new debt kind `assumed` (y10 + your rating's bond spread, 3 years, then rolls like a bond; repayable),
the board's own sale-of-control vote wired next to the trust's (`charter.ts controlVotes`, used by deals too), event
choices that carry a board vote (`ChoiceV2.vote`; `preview` / `available` get the pending decision's data; selectors
`choiceView(…, data)` and `choiceVote`), the vote strip under a decision's choice cards, glossary `acquisition` and
`assumed` (`boardVote` updated; `design/ux/GLOSSARY.md` regenerated), the bots' `mergerChoice`. No schemaRev bump: only
new enum values (ledger `acquired`, debt `assumed`); older saves load unchanged.

Removed (no aliases): E32's lead trigger (`when`: lead > 270 days over a rival with cooperation > 40; it gave the safe bot more than
half its offers), E32's single "Acquire" choice and its $2–10B
price cap, the mixed bot's "cash > $20B → Acquire" rule.

Choices and readings of the spec:
- **Trigger.** E32 is request-only: `rivalFinanceQ` requests it the quarter a private rival's cash goes negative (the
  rival model's `distress`; parent-funded labs never get there). The offer lasts 30 days; if declined (or left to
  expire, the default) and the lab is still short at the next quarter, it goes to a big-tech rival or shuts down, as
  before (`deactivateRival` untouched for FIN5b's license-and-hire exit). Not wired: the bubble bust's "push the most
  over-committed rival into distress" flag (investors.ts) does not request an offer; that lab is absorbed or recovers at
  the next rival quarter without one (edge case, FIN5b rebuilds rival finance).
- **Price** = the rival's valuation × 0.5 [D] (`ACQUIRE.discount`). Rival valuations are still the old rule (×1.25 + the
  amount at each raise; FIN5b moves them into the share), so distressed safety/maverick labs ask $85–170B in 2026–28 (the
  old E32 capped the price at $10B). **Cash** needs the price in the bank. **Stock**: new shares worth the price at your
  valuation, so its holders get price ÷ (your valuation + price), issued to financial holders (`issue()`), and your
  valuation rises by the price (as a deal's equity does).
- **Obligations** (the new risk). Rival `finance.commitments` is an annual book (the bubble index reads it that way), so
  you take on that book for two more years [D]: one firm ledger entry of commitments ÷ 4 a quarter over 8 quarters
  (`kind: 'acquired'`, in the Contracts tab, in the rating's PV of commitments, renegotiable like any firm entry). Its
  **debt** = the cash it is short (rivals carry no debt field; negative cash is the bills someone must pay), as drawn
  debt of kind `assumed` priced at your rating; no cash moves. A parent-funded lab (valuation 0) brings no obligations:
  its contracts stay with the parent. In practice: contracts $31–52B and debt $2–5B per offer (means by bot, below).
- **Votes.** A merger is a major decision (§7.3) and the board judges it on the company **after the deal**: the merger
  vector [D, FIN3a] is unchanged but its situation term moved from "control" (none) to "obligations", read on a copy of
  the company with the price paid, its holders' stake issued and the contracts and debt booked (runway after the deal: −0.5
  … +0.5); the strip says "after the deal, runway X q". **Sale of control** only when paying in stock would hand the
  lab's holders, as one block, more than half the company: the trust votes first under PBC + trust (cannot be forced),
  then the board's own sale-of-control vote (§7.3, FIN3b left it unwired); if it goes through, the holders control the
  company: `ws4.soldControl` → the 'acquired' ending, said in the preview ("a sale of control ends the game"). Buying for
  cash never sells control. The board's sale-of-control vote is now also held on partner deals and rescues past 50%
  (`dealVotes` → `controlVotes`), after the trust's.
- **Events and founder control.** A choice whose vote fails is unavailable with the vote as its reason; under founder
  control it stays available and choosing it forces the vote at −20 confidence, a cost line in its preview (events have
  no separate Force button).
- **E22 rule.** The DPA consolidation is offered, not ordered (Decline costs exec trust), so accepting it is a merger the
  board votes on, like E32: simplest consistent rule = "any merger you choose goes to the board; a decline needs no
  vote". No price is paid; each absorbed private lab's contracts and debt come with it by E32's rule (parent-funded labs
  bring none; positive rival cash does not come over, as before). Its preview's "+5 talent" (never applied) is now the
  staff it actually adds.
- **Kept from E32**: 70% of the lab's capabilities and safety staff, talent pull +3, the culture blend on safety morale
  and −3 morale, antitrust scrutiny +20, `ws4.absorbedCompute += its compute`. Finding: `absorbedCompute` is never read
  (it was not before either), so the "you get its compute" part is nominal, and E32 never transferred models; the preview
  does not claim either. Wiring the compute is a compute/model-v3 decision, not finance.
- **Decline** does nothing (as before). Its preview: "≈30 days of lead: <big-tech rival> likely absorbs it next quarter"
  (the old estimate) when a big-tech rival exists, else "it shuts down; its staff scatter"; the default-choice note says
  the same. Decline is now choice 3 (the default).
- **UI.** The decision modal shows the board's vote strip under each buy choice (one chip per seat, the total; tooltip
  with the shared terms and each seat's lean); pills: price (cash) or stake (stock), +scrutiny, staff gained as heads,
  talent; exposure pills (negative) for the contracts and the debt with what they are in their tooltips. The debt card
  lists assumed debt ("Assumed debt", not a borrowable tile). Fixes on the way: dilution lines are percent everywhere (a
  sub-1% stake rendered ×100, e.g. 0.5% as 50%); the vote strip says "trust" for the trust's votes.
- **Bots (rule 12).** `mergerChoice(s, d, { cushion, maxStake })`: cash if it leaves the cushion in the bank, else stock
  while the stake stays under `maxStake` (never a sale of control), and only on votes that pass without forcing;
  otherwise decline. Race and capex2x: $10B, 15% (they took every offer by tag before); mixed: $20B, 10%; ref and safe
  decline (unchanged).

Numbers, before (FIN3b 85fb385) → after (FIN3c):
- E32 on the bots (scratch diagnostic, 20 seeds per bot, leader start, bots.ts worlds, to Jul 2029): offers fired /
  accepted: race 17/17 → 17/0, mixed 27/21 → 25/10 (6 cash, 4 stock), ref 25/0 → 25/0, capex2x 3/3 → 3/0, safe 50/0 →
  22/0 (the lead trigger gave the safe bot more than half its offers). Offers now (means per bot): price $53–119B,
  contracts $31–52B, debt $2.1–4.8B, stock stake 1–32% (the safe and race bots' valuations are low when rivals fail).
  Over all 92 offers the merger vote passes for cash in 11 and for stock in 18; a buy is open (cash in hand and votes
  passing) for cash 9 times and for stock 18; the race and capex2x bots never pass it (they run at a 1–3 quarter runway
  and the contracts take the rest).
- `scripts/v2/bots.ts` (200 seeds, leader start): all §7.4 criteria MET. Wins race 1.0 → 1.5%, safe 1.0 → 1.0%, mixed
  51.0 → 52.5%, ref 22.5 → 22.5%, capex2x 3.5 → 3.0%. Ousted ref 12.0 → 12.0%, mixed 12.0 → 12.5%, race 13.0 → 13.0%,
  safe 31.5 → 32.5%, capex2x 47.0 → 47.5% (insolvent 36.0 → 36.0%). Safe losses overtaken/other-ASI-first 66% → 66%.
- `scripts/v2/finance.ts` F7/F8/F9 unchanged (RefBot declines every offer): 2026 capex $156.2B, valuation $1.47T,
  financing $64.6B, distress-free 83.3%, capex2x distress 100%, dilution max 5.3%; RefBot end-2027 board confidence median
  60.1; F2 44.4M (known).
- safety S5 (known failure since the baseline) now passes: mixed-bot median min margin −1.01 → −0.35 (the mixed bot buys
  fewer labs, so fewer capabilities staff push L ahead of U); a side effect of the bot's new E32 rule, not a fix of S5.
- Tests: `npm run typecheck` clean. test:v2 chain: golden-timelines, identity, calib, fixtures, hygiene (perf passed in
  both runs: 939 / 815 and 695 / 782 µs daily average), lint-hidden, lint-ux, lint-tradeoffs, lint-structure, safety green; then one by one:
  finance only F2 44.4M (known); worldfx (HireRate passes, as since FIN3b), ws4, products, money, idle green. `npm run
  test:ui` 280/280. Test changes: finance.ts adds 10 FIN3c checks (distress-only trigger and the terms; paying cash books
  the price, one firm ledger entry over 8 quarters and the debt with no cash; the preview matches the effects; paying in
  stock issues the stake; the merger vote is deterministic and judged after the deal; a failed vote blocks the choice and
  founder control forces it at the shown cost; a stock sale of control is voted by the trust then the board; it ends the
  game; deals past 50% meet the board's sale-of-control vote; E22 takes on each private lab's obligations behind a merger
  vote). uitest: 8 new FIN3c checks (the three choices, the vote strip under each buy choice, stake vs price and the
  obligations on the cards, the obligation pill's tooltip, a failed vote disables, buying in stock books contracts and
  debt and absorbs the lab, the debt card lists the assumed debt). ws4.ts unchanged (E32 still one of the 14 events).
- Left for later: FIN5b (rival valuations, hence prices, from the shared split; its license-and-hire exit for failing
  labs; the bust-distress offer gap above); the compute a bought lab brings is not wired (`absorbedCompute` unread);
  FIN6a may tune the 0.5 discount and the two-year obligation term against how rarely the merger vote passes for an
  aggressive lab; `design/V2-SPEC.md` §4.2 E32 text is stale (FIN6c docs pass).

### FIN4a notes (2026-11-20)

Built: one partner offer flow (`finance/deals.ts` rewritten): `partnerTerms` (the live terms of a partner, never
stored), `partnerBlocker` (why a partner will not deal), `partnerOffers` (every partner with its terms or its reason),
`signPartner` (votes first, then books exactly the terms), `dealVotes` (sale of control, then the rescue vote or the
commitments vote on the first year of take-or-pay), `rescuePartner`, `anchorPartners`; one action `fin.partner` "Sign
partner" (params `partner`, `supply`); `fin.rescue` in the same flow; `PARTNER_KINDS` / `PARTNER_TERMS` in
`data/v2/deals.ts` with every number tagged; new deal records (`StrategicDeal`: partner, kind, equity now / in tranches,
`supply` as signed with both discounts and its end day, `strings` with only live strings, `until`, `rescue`, `legacy`)
and `PartnerTerms`; partner tranches buy shares when they land (`Tranche.partner`, `stakeCap`; `partnerEquityIn`,
`stakeRoom` in `finance/equity.ts`); `revenueShareRate` (ext.ts) for cashflow and runway; `rentQuote` / `addCloud` take a
partner discount, `chipQuote` / `placeOrder` a price multiplier and a payee. UI: the Partners card on "Debt & partners"
(one row per partner with its status and a tooltip of what the kind gives and wants; the selected partner's offer:
supply choice for Azimuth, equity now + tranches with the stake after, each tranche with its condition and lapse quarter,
the supply with its price path, firm and partner discounts and take-or-pay total, the strings as pills, Sign with the
board's vote strip when one is needed; a blocked partner shows its reason; a signed partner shows what runs with links to
What we owe and Contracts), What we owe's tranche rows name their source, the Raise card's anchor list from
`anchorPartners`. schemaRev 15 → 16 with a migration.

Removed (no aliases): `fin.seekPartner`, `fin.acceptDeal`, `fin.declineDeal`; `DEAL_TEMPLATES`, `DEAL_TERMS`,
`DealTemplate`, `Partner.templates`, `DealOffer`, `ws3.offers`, `dealTerms`, `dealBlocker`, `partnerFor`,
`seekPartner`, `acceptDeal`, `declineDeal`, `rescueOffer`, `dealMenu`, `acceptAllOffers`; the vendor-financing template,
the `vendorNote` debt kind (DEBT_TERMS, headroom, UI tile, glossary), the unused `vendor` ledger kind and the
`vendorNotes` tally; `addCloud`'s `flatPerH` (the flat partner price); the sovereign's in-country site; the strings
`observer`, `ipRights`, `inCountrySite`, `boardSeat` (now `boardVotes`, rescue only); the "Northwind Cloud (observer)"
seats of the three leader presets and the challenger's observer seat (`addSeat`'s observer path).

Choices and readings of the spec:
- **Flow.** No offers to seek, accept, decline or let expire: every partner's terms are computed live from the company
  and the market and shown in full on its card; signing books those terms (the votes come first, nothing is booked if
  one fails). This is the simplest flow that keeps "every term visible before signing" and "no recurring decisions".
- **One deal per partner** (any deal signed in the game, rescue included; a stake from before the start does not
  count). Before FIN4a the same template could be signed again and again (a sovereign cheque every month); several
  different partners at once stay possible as before (no cap of 3: FIN4b). A rescue is exempt from the per-partner rule.
- **Hyperscaler** (Northwind: cloud; Azimuth: cloud or custom chips). Equity sized as before (3% of V per tranche,
  $5–15B, three tranches: now, then `gw:` +0.5 GW by q+8 and +1.5 GW by q+10, kept), non-voting and capped at 15% of the
  company per hyperscaler, tranches included (the cap is per partner and counts its existing stake: E ≤ V(cap − stake) /
  (1 − cap); fewer than $5B of room → unavailable with "holds X%: a hyperscaler's stake is capped at 15%"). A tranche
  lands at that day's valuation only up to the cap; the rest lapses (logged). **Cloud**: capacity sized as before (4 ×
  the equity over 6 years at today's cloud price, so the bot's compute plan is unchanged), paid each quarter on the
  expected cloud path less the firm discount (10% at 6 years) and the partner's 10% [D], one ledger entry per quarter
  exactly as Rent compute; served first like any firm cloud. **Custom chips**: 1 GW over 8 quarters (kept) at 45% of the
  H100e list path less the firm discount (5% at 2 years), a separate supply pool and the migration slowdown (kept); the
  45% is the chips' cost (perf/$), shown as such; no extra partner discount. Strings: exclusivity (kept exactly: blocks
  the competitor for good) and the 8% revenue share (kept), now for the deal's 6 years (it ran for ever before). No
  board seat.
- **Chip vendor**: $10B per GW (two `gw:` tranches, +1 and +2 GW online by q+12, kept); you buy 2 GW of its chips over 8
  quarters on the list path less the firm (5%) and vendor (5% [D], the old ×0.95) discounts, take-or-pay through the
  ledger with the vendor as payee; +0.5 allocation weight on every chip order while its supply runs (it was for ever
  once signed). The tranches now buy shares (they paid cash without shares before). "Per GW of its chips" is read as GW
  online, as before (the market does not track whose chips you run).
- **Sovereign**: 2.5% of V ($5–25B) now, no seat, no supply, no strings; scrutiny +5, Congress trust −5, security demand
  +3 (kept, now labelled "<partner> cheque"); no in-country site.
- **Rescue** (distress only, once a year, kept): the first hyperscaler or sovereign not blocked by exclusivity and not
  anchoring another lab; cash min(15% of V, max($20B, 2 quarters of burn)), the partner topped up to exactly 30% (the old
  top-up undershot: issuing new shares diluted the partner too), one strategic seat with two votes, exclusivity. The IP
  flag is gone (FIN4b builds IP access); the 15% hyperscaler cap does not apply (a rescue is the distressed control deal
  of spec §6.2). Its votes: sale of control (trust, then board) when past 50%, then the board's rescue vote, held once
  (before FIN4a the rescue re-ran the deal votes without the force flag).
- **Tranche conditions** gw, revenue, ipo, recapitalisation kept; missed → lapses (recap cut kept). Partner tranches
  show in What we owe with their source.
- **Legacy stakes.** The Northwind stake (27%) and the challenger's Azimuth (15%) are `legacy` records with no strings
  and no seat; both sit at or above the 15% cap, so neither sells more equity (Microsoft took its later Azure deals
  without new equity). Microsoft gave up its OpenAI observer seat in Jul 2024 [R21 B3], hence no observer seat at a 2025
  start.
- **Migration 15 → 16**: template records → partner records (hyperscalerEquity and customASIC → hyperscaler,
  chipVendorEquity → chip vendor, sovereign → sovereign; vendorFinance dropped); day < 0 → legacy; exclusivity and
  revenue share kept, the revenue share to 6 years after signing; old chip and ASIC deals keep their priority for 10
  quarters; open offers dropped; vendor notes become bond-like loans with their spread and maturity (no other debt kind
  fits a supplier loan; none exist in bot play); weight-0 strategic seats dropped. Contracts, orders and tranches signed
  before stay exactly as signed (old partner tranches land as cash without shares, as they were signed). Records
  already in the new shape pass through (fixtures re-migrated by tests).
- **Deviation**: the hyperscaler's cloud capacity is sized at today's price (as before), not by a dollar commitment of 4–12
  × the equity (R15) paid on the path: sized in dollars, the falling path would buy ≈ 2.4× the capacity and the reference
  bot would stop building (F7 capex well under its band). So the take-or-pay total is now ≈ 1.4 × the equity (RefBot
  $50B for $37B of equity). FIN6a can revisit the size with FC4 (commitments several × revenue).
- **Bot (rule 12).** `financeAutopilot` (strategic bots: ref, mixed, race, capex2x) signs one hyperscaler cloud deal from
  Q4 2025: the hyperscaler offering the most equity (Azimuth on the leader start: Northwind is over the cap), if runway
  after its first take-or-pay payment stays ≥ `DEAL_GUARD_Q` (as before, now with the first path payment).

Numbers, before (FIN3c a50eae3) → after (FIN4a):
- The reference bot's partner deal (scratch diagnostic, 12 seeds to end-2027, not committed): before, Northwind Cloud on
  day 92, $12B now + 2 × $12B on gw 1.7 / 2.7 (both landed by day 457, as cash without shares), 1.47M H100e of cloud for
  24 quarters at a flat $16.7K/H100e-yr (path then $15.3K), $148B take-or-pay, Northwind's stake 27% → ≈ 25%. After,
  **Azimuth** on day 92 in 12/12 seeds, the same equity and tranches (both land; Azimuth ends 2027 at ≈ 4% after
  dilution), the same 1.47M H100e for 24 quarters at $12.4K falling to $2.1K/H100e-yr (path − 10% firm − 10% partner),
  **$51B take-or-pay** (median $50.4B in finance.ts), 8% revenue share for 6 years, exclusivity against Northwind.
  Rescues: Azimuth instead of Northwind (Northwind is blocked by Azimuth's exclusivity); distress by end-2027 2/12 → 3/12
  seeds (seed 5 now reaches distress in Q2 2027 and is rescued).
- `scripts/v2/finance.ts`: F7 2026 capex $156.2B → $158.4B (range 113–175), compute $28.3B → $28.4B, power 6.7 → 6.7 GW,
  valuation $1.47T → $1.48T; F8 lease/colocation/cloud financing $64.6B → $73.4B, distress-free through 2026 83.3% →
  83.3%, no-deal path and capex2x distress 100% → 100%; F9 unanchored dilution max 5.3% → 5.3% (81 → 78 rounds); RefBot
  rounds 2026 4 / 2027 2 (unchanged), promises met 81% → 80%, end-2027 board confidence 60.1 → 61.3. **F2** (known
  failure) now passes: 44.4M → 45.3M (band 45–60M; one long seed, a side effect, not a calibration fix).
- `scripts/v2/bots.ts` (200 seeds, leader start): all §7.4 criteria MET. Wins race 1.5 → 1.5%, safe 1.0 → 1.0%, mixed
  52.5 → 50.0%, ref 22.5 → 21.0%, capex2x 3.0 → 3.0%. Ousted ref 12.0 → 12.5%, mixed 12.5 → 12.0%, race 13.0 → 13.0%,
  safe 32.5 → 32.5%, capex2x 47.5 → 47.5% (insolvent 36.0 → 36.0%). Safe losses overtaken/other-ASI-first 66% → 66%.
- **Two incidental fixes reverted to their baseline failures** (both on the known list; both moved by the cheaper partner
  cloud, which the phase requires): worldfx `HireRate_SOFT ≤ 10%` reached 2027-07-15 (FIN3b/3c) → 2027-03-15 (baseline
  2027-03-24; window Apr–Oct); safety **S5** mixed-bot median min margin −0.35 (FIN3c) → −0.52 (threshold −0.5;
  baseline −0.95). Checked on worldfx's one reference game: with partner tranches booked as cash only, or with the bot
  dealing with Northwind (cap lifted), the date stays 2027-03-15; with the partner cloud priced ≈ 2.5× the path (about the
  old flat total) it is 2027-05-06 (pass). So the reference bot's lower take-or-pay (more cash, more compute) brings the
  hiring collapse forward; S5 is the same bot family one notch past its line (not separately verified). Neither is a
  finance target; left for the WS5 / safety calibration owners (FIN6a should re-check after its own tuning).
- Tests: `npm run typecheck` clean. test:v2 chain: golden-timelines, identity, calib, fixtures, hygiene (perf passed: 964
  / 1150 µs daily average), lint-hidden, lint-ux, lint-tradeoffs, lint-structure green; safety S5 −0.52 (above); then one
  by one: finance all passed (129 checks); worldfx HireRate_SOFT 2027-03-15 (above); ws4, products, money, idle green.
  `npm run test:ui` 289/289. Test changes: finance.ts F8's "strategic deal" = any non-legacy partner deal (vendor
  financing is gone); the action loop no longer seeks a partner first; the FIN3b trust test and the FIN3c board
  sale-of-control test now give the sovereign a 49% stake (offers are live terms, no injected offer); 14 new FIN4a checks
  (the old ids and vendor notes are gone; the leader start's legacy Northwind over the cap and no observer seats;
  hyperscaler cloud on the path with both discounts, the schedule booked = the one shown, tranches with conditions and
  cap, no seat; the preview shows every term; one deal per partner and exclusivity; a tranche buys shares and stops at
  15%; custom chips; chip vendor with priority only while it supplies; sovereign without a site; the commitments vote;
  distress only a rescue; the rescue's stake, seat and strings; migration 15 → 16; the RefBot's deal). uitest: 9 new
  FIN4a checks (five partners, a blocked partner's reason, equity, tranches and price path, discounts and strings before
  signing, the supply tooltip, custom chips change the terms, Sign books the deal and tranches, the signed view, What we
  owe). Fixtures regenerated (schemaRev 16); `design/ux/GLOSSARY.md` regenerated (`deal` → "Strategic partner",
  `rescue`, `boardSeat`, `trancheCondition`, `allocation`, `ledger` updated; `vendorNote` removed).
- Left for later: FIN4b (up to 3 partners, optional exclusivity for more money, IP access behind the trust's transfer
  vote, a partner's guarantee opening leases below B); an anchor partner on a round still takes half the round's
  dilution with no 15% check (anchor behaviour kept as asked; FIN4b should cap a hyperscaler anchor); the take-or-pay
  size against FC4 (FIN6a); `design/v2-interfaces.ts` and V2-SPEC §3.7.4 still describe the templates (FIN6c).

### FIN4b notes (2026-11-20)

Built: up to 3 partners at once (`partnersNow`, `PARTNER_TERMS.strings.maxPartners`); optional strings on the offer
(`PartnerChoice` = supply + `exclusive` + `ipAccess`; `fin.partner` params `exclusive`, `ipAccess`, both off by default;
`PartnerTerms.options` says what each adds or why it is not on offer: `exclusiveBlocker`, `ipBlocker`); IP access
(`DealStrings.ipAccess = { lab, trust? }`, the affiliated lab `affiliatedLab`, the daily flow `ipAccessDaily` called in
one line from `actors/rivals.ts labDaily`, observe.ts `licensedModel` / `licensedGap` / `leadEstimate`), the PBC + trust's
vote on licensing a capability-threshold model (`charter.ts ipTransferVote`, `deals.ts ipVote`, held first in
`dealVotes`), a rescue with IP access (`PARTNER_TERMS.rescue.years` 6), what each partner costs (`partnerCosts`), the
partner guarantee for leases below B (`capex.ts leaseGuarantor`, `leaseRate`, `PayOption.guarantor`,
`CAPEX_LEASE.guaranteePremium`), a hyperscaler anchor capped at 15% (`anchorPartners`, `ANCHOR_SHARE`, `bookRound`). UI:
the Partners card's "n of 3 partners" (tooltip: the cap, deep vs shallow), a cost strip per signed partner (revenue share
a year, the lab and the days of lead its IP access closes a year, the partners its exclusivity blocks), Exclusivity and
IP access segments on each offer (each option shows its bump; a string not on offer is locked with the reason), the IP
cost line in plain words with a breakdown tooltip, "IP access · lab" pill, the lease limit names the guarantor on the
Compute cards. Glossary `exclusivity`, `ipAccess` (new); `deal`, `spv`, `rescue`, `anchorPartner` updated; LIMITS
`lease.rating` updated; `design/ux/GLOSSARY.md` regenerated. No schemaRev bump: only optional fields (`strings.ipAccess`),
older saves load unchanged (their deals keep exclusivity as signed).

Choices and readings of the spec:
- **Several partners (cap 3) [D].** A partner counts from signing for the rest of the game (hyperscaler deals run 6
  years, longer than the game; a vendor's supply ~2.5 years but its shares stay; a sovereign's cheque makes it a holder),
  so "at once" = signed in the game. Stakes from before the start (leader's Northwind, challenger's Azimuth) do not count.
  A rescue counts as a partner but is never refused by the cap (the distressed control deal of §6.2; it can make 4).
  The fourth partner shows "You have 3 partners, the most at once (…)".
- **Exclusivity optional [D].** +25% of the money: a hyperscaler's equity (all three tranches) and a vendor's money per
  GW. The bump sits under the 15% stake cap, so near the cap it shrinks (the option shows the real dollars). The extra
  money buys no extra cloud capacity (capacity stays sized on the plain offer's equity, so the take-or-pay is unchanged).
  It blocks the competitor for good (kept). Not offered by a partner whose competitor is already your partner ("You
  already partner with X, its competitor"); a sovereign has no competitors and no exclusivity. Several shallow partners
  stay possible: Azimuth + Northwind both open, or Silica + Corvid. Always part of a rescue (kept).
- **Affiliated lab (no tie existed).** Simplest explicit mapping in data (`AFFILIATE_ARCHETYPE = 'bigtech'`): a
  hyperscaler's in-house lab is a big-tech rival (archetype "Big Tech Incumbent: own chips"); the active big-tech rivals
  go to the hyperscalers in partner order (Northwind the first, Azimuth the second). A hyperscaler without one offers no
  IP access ("has no in-house lab to license your models to"); chip vendors and sovereigns never do. Archetypes are drawn
  per game: in seeds 1–12 five games have no big-tech rival, two have one (Northwind's only), five have two or more. The
  lab is stored on the deal at signing.
- **IP access [D].** Optional on hyperscaler deals: +20% of the equity (under the cap). The lab gains, every day the deal
  runs, `0.10 × gap / 365` of know-how (pa), gap = the model the licence reaches (your best live version) minus the lab's
  best model (pm, model vs model like WS1's distillation), so it closes about 10% of your lead a year while you lead and
  nothing when you are behind. Applied through the rivals interface as one line in `labDaily` (after frontier tracking);
  nothing else in rivals changed. The card states the cost in days using the player's intel estimate of the lead
  (`intel.leadDaysEst`), never the true lead (lint-hidden). Part of a rescue whenever the rescuer has a lab (6 years).
- **Trust vote (FIN3b leftover).** Under PBC + trust, signing IP access while the best live model crosses a capability
  threshold needs the trust's `transferModel` vote (held first, cannot be forced): its no stops the deal with IP access
  (sign without it). A rescue's IP access is not voted (the player has no choice in it): without the trust's yes the
  licence stops below the thresholds. Any IP-access deal under PBC + trust whose licence the trust did not approve
  (including one signed when no threshold model existed yet) never reaches a capability-threshold model
  (`licensedGap(…, noThreshold)`). On its mission stance the trust votes no, so in practice threshold models stay out.
- **Lease guarantee [D].** Below B a running (non-legacy) hyperscaler or chip-vendor deal guarantees leases at the B rate
  + 3 points (15%); the lease option and the Compute lease limit name the guarantor. A sovereign cheque, a legacy stake
  or an expired vendor deal does not. The RefBot never reaches a closed rating in 12 seeds, so this does not move its
  numbers.
- **Hyperscaler anchor.** Offered as an anchor (Raise card) only while its 15% cap leaves room for 40% of the largest
  anchored round; in the round it takes at most what keeps it at 15% and financial investors take the rest. Not re-checked
  at close (a price move can leave the capped anchor under 40% of a round that kept the 14% limit; logged, edge case).
- **Bots (rule 12).** The strategic bots (ref, mixed, race, capex2x) still sign one hyperscaler cloud deal from Q4 2025,
  now with exclusivity (one deep partner: for a bot that never wants the competitor it is +25% of the money for nothing;
  on the leader start the competitor is the legacy Northwind, over its cap anyway) and without IP access (its in-house lab
  would close on the lead the bot races for). No second or third partner.

Numbers, before (FIN4a 7f35081) → after (FIN4b):
- RefBot scratch diagnostic (12 seeds to end-2027, not committed; "before" = FIN4b with the bot not taking exclusivity,
  which reproduces FIN4a: distress 3/12 as in the FIN4a notes): deal equity median $36.7B → $45.8B (Azimuth, exclusive, 12/12); distress by end-2027 3/12 →
  1/12 (seeds 5 and 6 no longer reach distress); end-2027 board confidence median 62.5 → 55 (seeds 1 and 3: more cash, one
  2027 round instead of two, its promise weighs more and was missed: credibility 96 → 59, 100 → 79); 2026 rounds 4 → 4.
- `scripts/v2/finance.ts`: F7 2026 capex $158.4B → $162.5B (range 113.6–183.6), compute $28.4B → $28.3B, power 6.7 →
  6.7 GW, valuation $1.48T → $1.49T; F8 financing $73.4B → $70.6B, distress-free through 2026 83.3% → 91.7%, no-deal and
  capex2x distress 100% → 100%; F9 unanchored dilution max 5.3% → 5.8% (78 → 79 rounds); RefBot rounds 2026 4 / 2027 2
  → 1.5, promises met 80% → 80%, end-2027 credibility median 78.4, end-2027 board confidence median 61.3 → 55.2 (the
  FIN3a check ≥ 55 passes, narrowly). **F2** 45.3M → 44.6M: back to its known baseline failure (FIN4a passed it as a
  side effect; baseline 44.9M).
- `scripts/v2/bots.ts` (200 seeds, leader start): all §7.4 criteria MET. Wins race 1.5 → 1.5%, safe 1.0 → 1.0%, mixed
  50.0 → 51.5%, ref 21.0 → 22.5%, capex2x 3.0 → 3.0%. Ousted ref 12.5 → 12.5%, mixed 12.0 → 10.5%, race 13.0 → 13.0%,
  safe 32.5 → 32.5%, capex2x 47.5 → 47.5% (insolvent 36.0 → 36.0%). Safe losses overtaken/other-ASI-first 66% → 66%. The
  lower RefBot board-confidence median does not show up as more ousters.
- Tests: `npm run typecheck` clean. Run one by one: golden-timelines, identity, calib, fixtures green; hygiene's perf checks fail under load (the
  machine was busy: the 200-seed harness took 76 min vs ~45 before); paired runs minutes apart on the same machine: FIN4b
  3270 / 3355 µs daily average (worst quarter 11.3 / 11.6 ms) vs FIN4a (stashed) 3392 / 3391 µs (9.3 / 8.0 ms), leader-lab
  relative check passes in both, so no regression from the daily IP-access hook;
  lint-hidden, lint-ux, lint-tradeoffs, lint-structure green; safety S5 −0.52 → −1.01 (known failure; FIN1–FIN3b also
  read −1.01, baseline −0.95: the mixed bot's exclusive deal brings more cash, as FIN4a's cheaper cloud moved it the
  other way); finance only F2 (above); worldfx HireRate_SOFT 2027-03-15 (known, as FIN4a); ws4, products, money, idle
  green. `npm run test:ui` 298/298. Fixtures regenerated by fixtures.ts (challenger and spinout day-400 starts: their
  bots now sign exclusive). Test changes: finance.ts FIN4a hyperscaler check and preview check now sign / preview
  with `exclusive: true` (exclusivity became optional, so the FIN4a string is tested where it is chosen); 10 new FIN4b
  checks (the cap of 3 with its reason, legacy not counted, rescue not capped; exclusivity optional +25% for hyperscaler
  and vendor with no extra capacity, none from a sovereign; shallow partners and the competitor's exclusivity conflict;
  no IP access without a lab or from a vendor; IP access +20%, the lab mapping, the preview's plain-words cost; the daily
  flow 0.1 × gap / 365 through `labDaily`; the trust's vote under PBC + trust and the rescue's licence below the
  thresholds; the lease guarantee; the hyperscaler anchor cap; the RefBot's exclusive deal without IP access). uitest:
  FIN4a "strings before signing" now looks for "Exclusiv" (the option label); 10 new FIN4b checks (n of 3, IP access
  locked with its reason then open, exclusivity and IP access each add money, the IP cost in plain words, the
  exclusivity tooltip names what it blocks, the signed strings, the cost strip, the competitor blocked).
- Left for later: FIN5 (valuation split, rival finance); FIN6a may tune the 25% / 20% bumps and the 3-point lease premium
  and look at the RefBot's board confidence (55, the bot's single-round promise weighting); the anchor's 40% is not
  re-checked at close; IP access has no effect on rivals beyond the know-how flow (no product or valuation effect until
  FIN5b's rival split reads their models); `design/V2-SPEC.md` §3.7.4 and `design/v2-interfaces.ts` still describe the
  old partner strings (FIN6c).

### FIN5c notes (2026-11-20)

Built on `finance-v3-div` (worktree `../AI27-finance3-div`, from 7f35081, in parallel with FIN4b): the big-tech
division's budget year (`finance/parent.ts` rewritten: `DIVISION` rule, `budgetFactor`, `divisionOf`, `startDivision`,
`divisionQ` (the yearly review and the quarterly payment, called from capitalQ after the histories roll),
`parentPaymentQ(s, q)`, `parentSchedule` with estimates, `divisionView` (every division readout), `budgetRoom` (the
bots' guard)); parent goals as promises (`FinancePromise.by = 'parent'`, `goalWeight`; `promises.ts` judges them with
no credibility and the cause names "goal met / missed"); no runway verdict for a division (`updateRunwayState`) and no
quarterly "behind a rival" source for it (`boardQ`); state `FinanceWS3.division` (`DivisionBudget`, `DivisionReview`);
mood sources "goal met", "goal missed", "over budget". UI: a new `panels/FinanceDivision.tsx` (+ its css) with the Parent
budget card (the budget year as one bar: budget, savings or advance carried in, spent so far, the elapsed-year mark; the
verdict "Over budget by $X; parent covers" / "On course to run $X over by the review; parent covers" / "Within budget ·
$Y left at the review"; the review date, goals (link to What we owe), next year's budget at today's confidence; the
payment schedule with later years marked "est."; parent confidence is homed here), What we owe opened to a division
(section "Parent goals", no credibility, tranches or covenants; goal tooltips say what judging would do to parent
confidence), the Board card links to parent confidence, the top strip and core loop read the same `divisionView`
(`selectors.divisionStatus` replaces `divisionBudget`), the Watch "board" alert says "next budget N% of plan" for a
division instead of ouster risk, the 'owe' alert words a parent goal as such, the waterfall's net bar is "Budget −
spend" (the year's verdict lives on the card). Glossary: `parentBudget` rewritten, new `parentConf`, `parentGoal`,
`parentReview` (`design/ux/GLOSSARY.md` regenerated). schemaRev 16 → 17 with a migration.

The rule (spec §13; [D] numbers in `DIVISION`):
- **Budget years** run Jul–Jun. At each **review** (1 July, the first quarter start of a budget year, in capitalQ): the
  year's goals are judged; the parent minds any overspend it is still covering; it sets the year's budget = its plan
  (`PARENT_BUDGET`, the capex path: $16B, ×1.75 for three years, then ×1.3) × **min(100%, 50% + confidence ÷ 120)** (the
  full plan at 60, where confidence drifts; three quarters at 30; half at 0); it sets the new goals. Paid in four
  quarterly payments (the first in the review's capitalQ; year 0's first payment is in the starting cash, as before).
- **Goals** = the promise mechanism set by the parent: capability (public level), scale (compute online) and adoption
  (revenue run-rate) on the division's own trend at the **base pitch** (`makeThesis(…, 'base')`, as a raise's base
  pitch), a third each (adoption is skipped while there is no revenue, then a half each), deadline the next review. Judged
  like promises: met +30 × weight, missed by more than 20% of the gain −30 × weight, × the parent seat's multiplier
  (strategic: 1), on board confidence only (no investor credibility: a division has none).
- **Parent confidence = the division's board confidence** (one meter, the FIN3a machinery: named sources, drift to 60).
  Its sources for a division: goal results, overspend, public incidents (×0.5). "Behind a rival" is not a quarterly source
  for a division: the parent judges capability through its yearly goals (with both, the quarterly −5 pinned every bot's
  confidence near 0 and the budget at its floor; the capability goal already counts the same thing once a year).
- **Overspend is covered but costs confidence.** Cash is the budget balance: unspent budget stays as cash, cash below
  zero is the parent's advance (it pays the bills; a division still cannot go broke) and the coming payments repay it
  first. Over budget = spent so far (carried in + paid − cash) beyond this year's budget plus what was carried in. At each
  review the parent minds the advance it is still covering (cash below zero after the year's last payment): **−30 ×
  advance ÷ the year's budget, at most −30**, × the setbacks multiplier (1). **Deviation (reading of "covered"):** the
  parent does not write the overspend off. With a write-off, overspending is free money at a bounded cost (−30 at most and
  a budget floor of 50%): a division could spend any amount every year. Covering as an advance repaid from later budgets
  keeps money bounded by the budgets, and an advance left outstanding is minded again at every review.
- **Ouster.** Today's code: the `parent` preset has no ouster vote, warning or critics' seat (kept). The consequence of a
  sustained miss is the budget: low confidence cuts it to as little as half the plan; it never ends the game. Rule noted
  in `parentConf`'s glossary entry and the parent.ts header.
- **No runway verdict (JANK F2).** `updateRunwayState` keeps a division `healthy`: no tight / distress state, no
  "Financial distress" log or headline, no −4/q distress source, no distress branches in the bots. The runway projection
  still exists (it is the budget balance path: later years' payments at the plan × today's factor, an estimate; the
  parent's cover is not projected). The top strip reads "CASH · BUDGET $X · over $Y / $Y over at review / within budget ·
  parent covers"; the core loop reads the same words; no "0.0q distress" or "ouster risk" anywhere for a division.
- **ST2 (finance readout part only).** Cash still goes below zero inside a year for the bots (the parent's advance on the
  year's later payments) but is now explained by the verdict and the tooltip; the idle teams and spare serving are
  research/teams matters, untouched.
- **Bots (rule 12).** A prudent division head keeps to the budget: `financeAutopilot` adds `budgetRoom(s) ≥ 0` (the
  lowest projected cash at the next two reviews, less a quarter's payment of margin: the projection holds spending flat
  and misses one-offs such as E27 packages) to the site, lease, bridge and chip guards. `budgetRoom` is +∞ for every
  other company, so the leader-start bots are unchanged (F7/F8/F9 identical to FIN4a). Without the guard the reference
  and mixed bots overspent $11–16B in year 0 on a $16B budget (sites in cash: no lessor funding beyond 80% and the crash
  builds) and sat at confidence ≈ 1 with the budget at its floor.
- **Migration 16 → 17**: a division gets this year's budget at the plan, paid so far from the schedule, carried-in cash =
  cash − paid so far; goals start at the next review; a division's state is set healthy.

Numbers, before (FIN4a 7f35081) → after (FIN5c), big-tech start:
- Day 0 readout: cash $8.0B, top strip "CASH · BUDGET $8.0B · within budget · parent covers" (J1's burn-rate wording) →
  the same chip reading the budget year; the Parent budget card: "Budget Jul 2025 – Jun 2026 $16.0B + $4.0B saved",
  "Within budget · $15.5B left at the review" (idle), review 1 Jul 2026, 3 goals (public level 3.6 → 4.8, 800K → 880K
  H100e online, $4.0B → $6.4B/yr revenue), next year ≈ $28.0B, parent confidence 70.
- JANK F2's day-400 case (cash below zero): before, the engine state was `distress` ("Financial distress: 0.0 quarters of
  runway" in the log, the "scrambles for cash" headline, −4 board confidence a quarter) and the Watch's board alert spoke
  of ouster risk for a board that cannot vote; after, the state stays healthy, the card says "Over budget by $X; parent
  covers" (or "On course to run $X over by the review") and the Watch says "next budget N% of plan".
- Scratch diagnostic (4 seeds × mixed / ref / race / safe, to day 1100 or the ending; not committed): weeks in distress
  median 67% (25–79%) → 0%; weeks with cash below zero median 46% (17–77%) → 40% (2–71%: in-year advances, now read as
  within or over budget); lowest cash −$2.3…−11.5B → −$0.6…−22.4B (two seeds overspend late, after the budget was cut
  to its floor with leases still running); end board / parent confidence median 22 (5–38) → 19 (2–35); endings unchanged
  (overtaken about day 795–895 in the same seeds). The mixed bot's first review (seed 30000): spent $24.9B of $16B + $4B
  saved, $4.9B over (−9 confidence), goals 0 of 3 met (−30) → year-1 budget $19.9B (71% of the $28B plan) at confidence
  25. Goals the bots meet: adoption in some year-0s, capability now and then; scale almost never (the division bots'
  compute online stays at the start fleet: their new sites stand without chips, a compute/bot matter noted for ST2).
- `scripts/v2/starts.ts` (10 seeds × mixed + race per start; not in the test chain): the same 6 failures before and after;
  big tech "6 → 3–5 months behind within months 9–15": median best lag 7.0 → 5.4 months (closer, still outside); big tech
  endings overtaken 19 → 18 of 20 (one rivalAligned → one chinaAligned, one chinaTakeover); challenger and spinout
  identical.
- `scripts/v2/bots.ts --start bigtech --seeds 40` (200 games each run; the §7.4 criteria are defined on the leader start):
  wins 0% for every bot before and after; median ending day race 801 → 895, safe 889 → 889, mixed 795 → 817, capex2x
  756 → 756, ref 801 → 852; overtaken race 90 → 90%, safe 92.5 → 87.5%, mixed 85 → 87.5%, capex2x 100 → 100%, ref 87.5 →
  92.5%; "mixed" outcomes mixed 5 → 2.5%, safe 0 → 2.5%; no insolvent or ousted endings either way (a division cannot
  reach them). The leader start is unchanged: `budgetRoom` is +∞ off the division and the other edits are division-only
  (`scripts/v2/finance.ts` F7/F8/F9, FIN2–FIN4a lines identical to FIN4a: 2026 capex $158.4B, valuation $1.48T, financing
  $73.4B, distress-free 83.3%, RefBot end-2027 board confidence 61.3; golden timelines and fixtures pass).
- Tests: `npm run typecheck` clean. One by one: golden-timelines, identity, calib, fixtures, hygiene (perf passed on this
  run: 1117 µs daily average, leader lab 1388 µs, its own cost +6.9% paired; the machine was shared with the FIN4b
  session, so only the paired check is meaningful), lint-hidden, lint-ux, lint-tradeoffs, lint-structure green; safety S5
  −0.52 (known, as FIN4a); finance all passed (12 new FIN5c checks); worldfx HireRate_SOFT 2027-03-15 (known, as FIN4a);
  ws4, products, money, idle green. `npm run test:ui` 294/294 (5 new FIN5c checks). Test changes: finance.ts adds 12
  FIN5c checks (day-0 budget year and goals; the budget rule; payments and estimates; no runway verdict, ouster vote or
  critics' seat for a division; the readout's spent / over / cost / next-year; within budget and the bots' room; the
  review judges goals on parent confidence only; the overspend's confidence cost, not written off; the budget set by the
  rule and new goals; no "behind a rival" source; migration 16 → 17; the mixed bot as a division head). uitest: 5 new
  FIN5c checks (the Parent budget card's year, verdict, review, goals and next year with parent confidence homed there;
  over budget on the card and the top strip with no distress; What we owe's parent goals; the goal tooltip; the Board
  card's link and no ouster vote). Fixtures regenerated (schemaRev 17; no big-tech fixture exists). No existing test
  changed meaning.
- Left for later: the division bots never fill their new sites with chips (compute online stays at the start fleet, so
  the scale goal is almost never met; a compute/bot matter, ST2's non-finance part); FIN6a may tune the [D] numbers (the
  50% floor, full at 60, −30 cap) once the division plays better; FIN6b polish (check how the cash-history chart draws a
  division's advance below zero; the legend now says "budget as set"); `design/STRUCTURE.md` §4.8 and `V2-SPEC` still say "no parent-confidence
  mechanic" (FIN6c docs pass); JANK-AUDIT F2 / ST2 rows not edited (status here).

### FIN4r notes (2026-11-20)

Review fixes for the read-only review of 7f35081 (FIN1–FIN4a); each spot was re-located in today's code (after FIN4b and
the FIN5c merge) and re-verified before fixing; none had been fixed or changed by FIN4b / FIN5c. schemaRev 17 → 18 with
a migration (below). Every fix has a short regression check in `scripts/v2/finance.ts` ("FIN4r …", 15 checks) that fails
on the old code.

The review brief, as given (line numbers at 7f35081):
- H1 Renegotiate broken for path-priced contracts; preview overstates relief (actions.ts:668/674-680; `ledgerDue`
  counts entries spanning two quarters in full in both). H2 credibility and board confidence bought with $0.1B rounds
  (promises.ts:160-164, actions.ts:102). H3 previews show the full ask as cash; rounds ≥ $20B pay half at close; lapsed
  tranches leave the investors their shares (equity.ts:165-171, investors.ts:141, actions.ts:93/120/187, Finance.tsx).
- M1 hyperscaler `gw:` conditions met by the deal's own cloud (deals.ts:111-119, investors.ts:156). M2 the debt vote
  bypassed through Buy chips (actions.ts:462-466, market.ts:480). M3 site-lease preview overstates construction
  interest (capex.ts:66, actions.ts:578, Compute.tsx:383).
- L1 down-round preview vs effect; L2 several forced votes, one −20 shown; L3 community package preview prices one
  site; L4 IPO dual-class discount shown as cash; L5 `anchor` not validated; L6 scale promises met by spot rentals; L7
  a blocked leased site's lessor money never repaid; L8 the critics' investor director pre-empts an ownership seat; L9
  reserved custom-chip supply serves any order; L10 `rollMaturities || covenantsBreached` short-circuits; L11 inert
  `DealSupply.ref`; L12 migrated SPV leases mislabelled, the old JV rate 0.12 instead of 0.10.

Per finding:
- **H1 fixed.** `ledger.ts deferFirm` (with `RENEGOTIATE` = 35%, 4 quarters, 2% warrants [D, R15]): every firm entry
  paying in the 4 quarters from the next quarter start is split at the window's quarter starts (never stretched): before
  and after pay as before, inside × 0.65; the sum deferred per contract is added back as one firm payment in the quarter
  after the contract's last payment (same contract id, payee, kind, rate). Preview = the deferred sum (= 0.35 × Σ
  `ledgerDue` over the window, firm) with the pay-back as a later cost line ("deferred, not forgiven"). `ledgerDue` now
  counts month by month (a third of `perQuarter` on each month-first an entry pays, as the monthly ledger pays), so an
  entry starting or ending inside a quarter counts only its months (it was counted in full in each quarter it touched:
  rating fixedQ, the commitments vote, the Locked-in chart). Split leases stay one contract: residual-value guarantees
  (`contingentLiabilities`, `siteRVG`) group entries by contract. Reading: "the next 4 quarters" = from the next quarter
  start (the current quarter is part-paid already; the preview names the quarters).
- **H2 fixed.** Weight = amount ÷ max(raised in the year to its deadline, `typical`), `typical` = d_max · pre/(1 − d_max)
  stored on the promise at the close (`typicalRound`, the closing pre-money, d_max 0.14 if anchored else 0.08). Stacking
  stays weight-neutral for normal rounds: four ceiling-sized rounds a year weigh 25% each, one 100% (checked); a $0.1B
  round at the day-400 fixture weighs 0.15% (was 100%). A pool-bound round below the dilution limit now weighs less
  than 100% even alone (as the rule says).
- **H3 fixed.** `equity.ts roundSplit` (`LARGE_ROUND`: ≥ $20B, half at the close, the rest due 2 quarters later if revenue
  reaches 1.2× the run-rate at the close within 4 quarters, the recapitalisation for an unconverted legacy nonprofit) is
  what `bookRound` books and what every preview shows (`roundCashLines` in fin.raise, fin.acceptRepriced; fin.ipo and
  fin.downRound pay in full: `full`). The Raise card shows cash at the close, a "tranche $X" pill (tooltip: condition,
  due and lapse dates, shares cancelled), runway on the cash at the close. A round's tranche stores the shares issued at
  the close for its unpaid money (by holder, and the insiders' share then: later issues scale them with everyone); a
  lapse (or the recapitalisation cut to $10B, at the deadline or by "Keep nonprofit") cancels them pro rata and the other
  holders grow back, so the cap table is exactly that of the half raised at the same price (checked). What we owe
  already listed the tranche; its tooltip now says the shares are cancelled on a lapse. Tranches from older saves carry
  no shares and lapse as before (as signed).
- **M1 fixed.** `gw:` conditions count GW online in your own sites (`observe.gwOwned`: installed, MW-limited), in
  `trancheConditionMet`, the partner terms' baselines (now owned GW + 0.5 / +1.5, vendor + 1 / + 2) and What we owe's
  progress; condition words "GW online in your own sites"; glossary `trancheCondition` updated.
- **M2 fixed.** `chipsVote`: a spot or batch order paid by chip loan → `debtVote` on what it borrows (42% of the balance,
  within the chip-loan room); by lease → `commitmentsVote` on its first year of payments (the convention of Rent compute
  and partner deals); cash → none. Votes only above 3× revenue (FIN3a).
- **M3 fixed.** `capex.constructionGrowth(r, schedule)` with `sites.siteSchedule` (expected ETA, building quarters,
  whether the first building payment is in the quarter building starts): the 5% upfront (`BUILD_Q.upfront`, now named)
  accrues over the whole ETA, each building payment from the quarter it is paid, exactly as `stepSite` books it (checked
  against realised schedules: booked funded = capex × 80% × growth to 1e-9). Grid 1 GW at BB: ×1.254 → ×1.115.
  `payOptions`' 4th parameter is now the schedule (Compute card and the site preview pass it).
- **L1 fixed.** `fin.downRound` books its effects explicitly (`bookRound(..., { full, down })`: mood −15 × the board's
  setbacks weight, the round flagged down, anti-dilution only below a prior round's post-money); the preview shows the
  50–70% price range and its dilution range, anti-dilution as an exposure line. Found on the way: the anti-dilution gap
  read the new round's own post-money (`lastPostMoney` after the round was recorded), so it was amount ÷ post instead of
  the gap to the previous round; now (last post − pre) ÷ last post, as documented [R15].
- **L2 fixed.** Partner and rescue previews sum `voteCost` over every vote in `dealVotes` (two failing forceable votes
  show −20 twice; checked).
- **L3 fixed.** Without a site id the community package preview prices every site still permitting (apply packages
  them all), whether the company default is on or off.
- **L4 fixed.** New currency `valuation` (cost lines; UI label "valuation"): the IPO's dual-class line is "−$X valuation,
  −5% at every mark, no cash moves".
- **L5 fixed.** `fin.raise` rejects an anchor not in `anchorPartners` (preview treats it as no anchor).
- **L6 fixed.** The scale milestone (`metricNow`, the thesis history, parent goals) reads `observe.computeFirm`: owned
  racks plus live firm cloud; spot rentals and cancellable cloud do not count. The trend's pipeline term is (secured −
  online) ÷ the firm metric. Target text "… H100e online (owned or firm)"; glossary `roundMilestone`, `parentGoal`.
- **L7 left.** A blocked leased site's lessor money is still neither repaid nor guaranteed: turning it into a lease (or
  an RVG payment) at the block collides with E27's re-permit path (the site would book a second lease at go-live); small
  (≈ 4% of capex); for FIN6a/b.
- **L8 fixed.** `syncFinancialSeats` (now exported) does not count the critics' investor director (`CRITICS_INVESTOR`)
  among the founder preset's ownership seats.
- **L9 fixed (cheap).** A reserved supply entry can name its order (`reserved[].order`, set by the custom-chip deal);
  `clearMarket` serves it only to that order. Entries without an order (older saves) serve any order as before.
- **L10 fixed.** `rollMaturities` and `covenantsBreached` both run every quarter.
- **L11 fixed.** `DealSupply.ref` removed (the FIN4a custom-chip test finds the order by its quarters instead).
- **L12 fixed.** Migration 11 → 12 sets the old JV leaseback's rate to 10% (Keystone's SPV 12%); migration 17 → 18 renames
  `L-spv-<site>` leases to `L-fin-<site>` (What we owe names the site) and fixes a JV entry still at 12%.
- **Migration 17 → 18**: also live promises get `typical` from their round (pre-money = post − amount, its d_max); deal
  supplies lose `ref`. New optional fields: `FinancePromise.typical`, `Tranche.shares`, `reserved[].order`,
  `YearStats.deferredCompute` / `deferredChips` (below).

Test changes (meaning changed): **F7 compute costs and capex now count what the year incurred**: payments a renegotiation
deferred out of 2026 are added back (`YearStats.deferredCompute` / `deferredChips`, tallied by `deferFirm`). The RefBot
renegotiates on its tight runway in late 2025 (as before); the old stretched entries deferred almost nothing, the fix
really defers 35% of 2026's firm payments (median $9.7B), so paid compute costs fell to $22.5B (band 25–60) while the
compute used did not change. FIN2 weight check now expects ÷ max(raised, typical) ($1B then $50B: 1% / 87%, was 2% /
100%). FIN4a custom chips: finds the order without `ref`. uitest: one new check (the Raise card's tranche pill and
"+ $X tranche if …" on a $20B+ ask, none on a small one).

Numbers, before (FIN4b + FIN5c, a74ea1a) → after (FIN4r):
- `scripts/v2/finance.ts` (12 RefBot seeds): F7 2026 capex $162.5B → $160.2B; compute costs paid $28.3B → $22.5B
  (incurred $32.2B, the check's measure); power 6.7 → 6.7 GW; valuation $1.49T → $1.47T; F8 financing $70.6B → $69.7B
  (deal and ≥ $50B: 100% → 92%), distress-free through 2026 91.7% → 91.7%, no-deal and capex2x distress 100% → 100%; F9
  unanchored dilution max 5.8% → 4.7% (79 → 78 rounds); RefBot rounds 2026 4 / 2027 1.5 → 4 / 2; promises judged 64 →
  66, met 80% → 88%; end-2027 credibility median 78.4 → 79.0; end-2027 board confidence median 55.2 → 64.3. Why, from a
  6-seed scratch diagnostic: M1 moves the Azimuth deal's second tranche (+1.5 GW owned) out of 2026 ($30.7B → $15.4B of
  deal equity in 2026), so the bot rents smaller bridges (2026 cloud financed $15B → $7B on seed 1); H1 defers real
  money; the scale metric without spot rentals and the lighter weights of pool-bound rounds move the promise results.
  F2 44.6M (known, unchanged).
- `scripts/v2/bots.ts`, leader start, **40 seeds per bot, paired** (base = a74ea1a extracted to a scratch dir,
  same seeds; the 200-seed run was stopped after 2 h at "mixed" under heavy machine load, so the FIN4b 200-seed numbers
  are not comparable): all §7.4 criteria MET. Wins race 0.0 → 5.0% (the criterion is ≤ 5%: at its edge), safe 0 → 0%,
  mixed 55.0 → 57.5%, ref 25.0 → 27.5%, capex2x 5.0 → 2.5%. Ousted race 10.0 → 30.0%, safe 37.5 → 37.5%, mixed 10.0 →
  12.5%, ref 15.0 → 12.5%, capex2x 47.5 → 90.0% (insolvent 37.5 → 7.5%; median ending day 366 → 458). Company loss for
  capex2x is unchanged in kind (95 → 97.5% losses): a real renegotiation (and the distress down round paying in full)
  keeps the over-building bots solvent longer in distress, where the board loses confidence every quarter and votes
  them out (likely cause, not separately verified). Safe losses overtaken/other-ASI-first 60% → 60%. FIN6a should look
  at race and capex2x ousters with FC7.
- Tests: `npm run typecheck` clean (and the scripts' tsconfig). One by one: golden-timelines, identity, calib, fixtures
  (regenerated, schemaRev 18) green; hygiene's absolute perf checks fail under load in every run, base included (paired
  runs minutes apart: a74ea1a 3089 / 3039 µs daily average vs FIN4r 3877 / 3588; the leader-lab relative check flipped
  both ways in both builds, ±25%); a paired micro-benchmark (300 days from the day-400 fixture, four alternations) reads
  base 1442–1563 vs FIN4r 1469–1770 µs/day, medians ≈ 1500 both: no regression (nothing new runs daily). lint-hidden,
  lint-ux (GLOSSARY.md regenerated), lint-tradeoffs, lint-structure green; safety all passed (S5 mixed-bot median min margin −1.01 → −0.49, threshold −0.5: the known failure passes narrowly, a side effect, not a fix); finance only F2
  (known); worldfx HireRate_SOFT 2027-03-15 (known, as FIN4a/4b); ws4, products, money, idle green. `npm run test:ui`
  304/304 (one new FIN4r check).
- Left: L7 (above). Observed, not changed: the chip-tranche commitments vote still adds the first tranche × 4 and Rent
  compute the first four quarters from next quarter, while the threshold reads the four quarters from this one (a
  convention, not a hidden rule; FIN6a may align them).

### FIN5a notes (2026-11-20)

Built: `finance/story.ts` (the story: the `STORY` and `SUPPLIER` numbers, `privateRivals`, `sectorRunRate` (moved from
investors.ts), `rateFactor` and `DUAL_CLASS_GOV` (moved from equity.ts), `sectorValue`, `growthOf`, `openWeightFloor`,
`playerGov`, `storyShares` (every private lab's drivers, score, weight and share), `storyNow` (the player's view: sector,
share, each driver's × effect and the field it is measured against), `markShare`, `poolAnnualOf`, `recordLabRevenue` /
`seedLabRevenue` (private rivals' quarterly revenue, for their momentum), `startStory` (the day-0 mark, the pool and the
non-leader starts' credit line), `supplierTerms`). capitalQ marks the valuation from the story and sets the pool from it,
booking the change as two causes ("sector value", "your share", each with its terms); supplier terms on Buy chips (a
batch's deposit floor, a supply contract's prepaid first delivery; partner chip supply too, and the partner commitments
vote counts it); a repriced round buys only the stake that was signed. UI: a **Story** tab on Finance (new
`panels/FinanceStory.tsx`): the valuation's home (header, with its why), "Sector × your share → next mark" with the mood
tag, a share bar of every private lab (you first), six factor tiles (position, momentum, economics, capacity,
credibility with a link to its home in What we owe, governance), each with its × effect, a centred log bar and you vs the
field (tooltip: what it measures, your value, the field's, the score, the weight, the effect), the investor pool; Markets
sits next to it without hype and the pool (both now in Story); the Ownership card links to the valuation; the Buy chips
card shows the supplier terms (deposit or prepaid share; tooltip with the share and runway parts); a partner's chip
supply shows its prepayment. Glossary: `sectorValue`, `marketMood`, `storyShare`, `storyPosition`, `storyMomentum`,
`storyEconomics`, `storyCapacity`, `govFactor`, `supplierTerms` (new); `valuation`, `hype`, `investorPool`, `dualClass`,
`investorCred`, `bubble` rewritten; LIMITS `order.terms`; `design/ux/GLOSSARY.md` regenerated. schemaRev 18 → 19 with a
migration.

Removed (no aliases): `valuationMark`, `valuationNow`, `revenueGrowth` (equity.ts); `poolShare` (the V^0.5 · momentum ·
gov pool split); the revenue-based pool A = 4·R·H·M·W; the bust branch's own ×0.4 cuts of the pool (the bust factor is in
the sector value now); `credMult` (promises.ts); the narrative premium N (`FinanceState.narrative`, `StartDef.narrative`,
initialFinance's 1.2 / 1.5, the start table's 5 / 1.2 / 0 / 1.5); start valuations by formula (initialFinance and
startFinance leave 0, `startStory` marks them from the split); the Markets card's hype and investor-pool rows.

The fit (spec §1, §14 FC1/FC2; RefBot reference path, leader start, 12 seeds; scratch probes, not committed):
- **Sector value** S = κ_S · R_sector^α · (L_frontier / 5)^φ · mood with **κ_S = 83, α = 0.7, φ = 0.75**; mood = hype ×
  exp(−0.12·(y10 − 4.5)) × 0.4 in a bust. R_sector = the player + active rivals with a private valuation (the set the pool
  always used: big-tech in-house and the parent-funded open-weight labs out; the simulated leader lab of the non-leader
  starts is in). On the reference path R_sector is $18B at the start (median; $14–28B by the rivals drawn), $79B at the
  Oct 2026 mark, $92B at Jan 2027; the public frontier L 5.2 → 7.3 → 8.2; hype 1 → 1.14 → 1.34. Fitted so S(start) ≈
  $0.63T and the mean of the Oct 2026 and Jan 2027 marks ≈ $2.75T; finance.ts F9 (FC1): start median $632B, late 2026
  median $2.77T. α < 1: value grows slower than revenue. φ: the frontier factor is ×1.35 from L 5 to 7.5. (Φ = 1 with α ≈
  0.86 also fits FC1 but leaves the frontier out, against the spec; a higher α with a lower φ moves late 2027 under 10%.)
- **Share**: z = Σ w_k·x_k with **w = position 0.45, momentum 0.25, economics 0.1, capacity 0.2, τ = 1.25**; weight =
  credibility rung × governance × exp(z/τ); share = weight ÷ Σ over the private labs. Drivers, each against the rival
  field (the other private labs) and clamped to ±3: position = (your best public level − the best public level of any
  other lab, big tech included) ÷ 2 levels; momentum = log2 of your 4-quarter revenue growth (×0.5–×8, R15's clamp) − the
  field's mean log2 growth (pre-revenue: log2 1 = 0); economics = (serving margin via the observe bridge − the field's
  mean) ÷ 0.2 (pre-revenue: 0); capacity = log2(compute secured ÷ the field's mean). Fitted to the start shares: leader
  ≈ 45% ($0.29T median of seeds 1–6; OpenAI $300B in Mar 2025), challenger ≈ 12–20% ($159B median; Anthropic $61.5B →
  $183B through 2025), spinout ≈ 7–8% ($55B median; SSI $32B, TML $12B: high, below).
- **Mark: half-way each quarter.** The valuation is S × a share that moves half-way (`STORY.blend` 0.5) from the last
  mark's share to today's story share. **Deviation** from the spec's V = S · share: marked at the story outright, every
  leader-start game marked down 40–55% in Q1 2026 (the rivals' stale start models catch up 1.5 levels in two quarters;
  their revenue jumps from the start table's $1–5B to what the market pays them, so ×8 momentum; hype falls with no
  frontier release for nine months), the bot's pending rounds were repriced and pulled, and distress by end-2026 went
  1/12 → 6/12 (F8 failed at 50%). Position per 2 levels (instead of 1) and the half-way mark bring it to 2/12 (F8 83%).
  Private marks never halved in a quarter in 2025–26. The rule is on the card (share now, at the last mark, at the next).
- **Pool** = **π = 0.15** × S a year, × 1.5 while the IPO window is open (kept), split by the mark's share; the player's
  unused part carries 50% (kept). The mood is counted once (S carries it): the spec's "π · S_t per year × mood" read as
  that, not squared. Sector pool ≈ $95B a year at the start, ≈ $390B in mid-2026 (R15 §2.9: ≈ $75B in 2025, $350B+ in
  2026).
- **Supplier terms** [D]: a batch's deposit ≥ 30% + 35 points × (1 − share ÷ 25%, ≥ 0) + 35 points × (1 − runway ÷ 6 q,
  ≥ 0), at most 100%; a supply contract (Buy chips tranches, a chip vendor's supply, custom chips) prepays the same premium
  (without the 30%) on its first delivery, paid now and taken off that delivery's ledger payment. The share is the mark's,
  stored at the quarter; a division pays on the parent's credit (no premium). The bot asks 50% on its batches, so a
  well-funded bot is unchanged; with a short runway it prepays more.
- **Credibility and governance moved into the share** (FIN2's interim multiplied the mark): the rung multiplies the lab's
  weight, so a Proven lab that already holds most of the sector gains less than ×1.15; GOV_FACTOR (legacy 0.6, nonprofit
  PBC 0.9, PBC + trust 1, founder 1.1) × 0.95 with dual-class shares. The IPO preview's dual-class line now shows the
  valuation effect at today's share. Rivals count ×1 and ×1 until FIN5b.
- **Rivals keep their old valuations** (×1.25 + the round at each raise, actors/rivals.ts) while their split share is
  computed for the denominator, so a rival's stored valuation and its split value (share × S) disagree. At the RefBot
  marks trailing private rivals split at ≈ 54× run-rate (the share has no revenue-size driver and their revenue is small
  next to their compute) vs the leader's 37× at high growth: for FIN5b (FC6).
- Other readings: a lab with no public model is placed at the best open-weight public model (rivals' and China's open
  releases); rivals' economics count at the sector's typical 50% (spec §12 "sector average"; their bridged margins are
  −2 to −3.6 at the start, revenue far below their compute); private rivals' revenue history is seeded as ×3 a year
  (R15's g norm) at the start and by the migration, then recorded at each mark; distressed rivals stay in the share (the
  old pool share dropped them); FC2's "trailing labs lower" is checked on the player as "slower growth, lower multiple"
  (C11), the rivals' split multiples printed for FIN5b.
- **Migration 18 → 19**: `narrative` dropped; private rivals' revenue histories seeded; the last mark read off the saved
  valuation (share = valuation ÷ today's sector value) so the first mark after loading moves half-way from it.

Numbers, before (FIN4r bfc30ea, extracted to a scratch dir) → after (FIN5a):
- `scripts/v2/finance.ts` (12 RefBot seeds): F7 end-2026 valuation $1.47T → $1.05T (share ≈ 45–65% of a $2–2.8T sector
  at the Oct 2026 mark, the mark lagging half-way; the band $1–3T kept: OpenAI $1.25T in Nov 2026); 2026 capex $160.2B →
  $162.8B; revenue $47.8B → $45.0B; compute costs incurred $32.2B → $29.6B; power 6.7 → 6.6 GW; F8 financing $69.7B →
  $85.4B, distress-free through 2026 91.7% → 83.3%, no-deal and capex2x distress 100% → 100%; F9 unanchored dilution max
  4.7% → 5.1%; RefBot rounds 2026 4 → 3.5, 2027 2 → 2; promises met 88% → 97%; end-2027 credibility 79 → 85; end-2027 board
  confidence 64.3 → 63.4; Azimuth deal equity $45.8B → $37.6B (3% of a lower valuation), 12/12 → 11/12. **F2 (known
  failure) passes**: 44.6M → 47.1M, a side effect. New F9: FC1 start $632B, late 2026 $2.77T; FC2 leader multiple at ×2.5+
  growth 36.6× (at the band's top), slower growth 23.5×; trailing private rivals' split 54× (FIN5b).
- Paired RefBot diagnostic (12 seeds, leader start, to end-2027, equity booked by calendar year): equity raised 2025 H2
  $5.1B → $11.4B, 2026 $65B → $71B, 2027 $158B → $204B (OpenAI: $40B in 2025, $122B in 2026); rounds 2025 1 → 1, 2026 4 →
  3.5, 2027 2 → 2; valuation end-2026 $1.47T → $1.05T, end-2027 $9.0T → $12.4T (the player holds ≈ 95% of the sector by
  then, with hype ≈ 1.8 and the frontier at L ≈ 12: ≈ 60× run-rate, against ≈ 45× before; FIN6a may want a lower φ or
  α for 2027+); distress by end-2026 1/12 → 2/12, by end-2027 2/12 → 2/12.
- Start valuations (median, seeds 1–6): leader $334B (formula, every seed) → $289B (split; $0.2–0.5T by the rivals drawn);
  challenger $86B → $159B; spinout $10B → $55B; day-400 fixture $412B (share 18% of $2.4T: an even world, rivals level on
  position, governance 0.6).
- `scripts/v2/bots.ts`, leader start, **40 seeds per bot, paired** (base = bfc30ea in the scratch dir, same seeds; 200
  seeds not run, the machine was shared with three other sessions' test runs): all §7.4 criteria MET. Wins race 5.0 →
  5.0%, safe 0 → 2.5%, mixed 57.5 → 52.5%, ref 27.5 → 22.5%, capex2x 2.5 → 2.5%. Ousted race 30.0 → 32.5%, safe 37.5 →
  20.0%, mixed 12.5 → 15.0%, ref 12.5 → 17.5%, capex2x 90.0 → 45.0% (insolvent 7.5 → 52.5%: its valuation dips with its
  story and supplier terms ask more upfront on a short runway, so it runs out of cash before the board votes it out).
  Safe losses overtaken/other-ASI-first 60 → 74%. (±7 pp is one seed in 40 at these rates.)
- **Spinout check** (queued from FIN2), `scripts/v2/starts.ts` (10 seeds × mixed + race per start; not in the chain): the
  same 6 failures before and after (the targets were never met). The spinout is now funded: its start valuation $10B →
  $55B (position at the open-weight model, 7–8% of the sector), so its pool and dilution limit are 3–5× larger; months
  behind the leader lab at months 12 / 18 / 24: mixed 19.5 / 25.4 / 31.6 → 8.0 / 7.8 / 13.2, race 19.5 / 25.6 / — → 4.2 /
  6.8 / 12.3; first own model shipped in 0/20 → 4/20 games (month 18.6, 7.9 months behind; target 12–17 months in, 9–12
  behind); endings ousted 14, insolvent 3, overtaken 3 → overtaken 11, ousted 9, no insolvency. So no start adjustment:
  the low credibility (Unproven ×0.9) does not make it unfundable; "overtaken" rose because it now lives long enough to
  be overtaken. Challenger: ousted 14 → 12, overtaken 5 → 7; parity in months 12–18 still never (best 1.6 months);
  big tech identical (no valuation).
- Tests: `npm run typecheck` clean (and the scripts' tsconfig). One by one: golden-timelines, identity, calib, fixtures
  (regenerated, schemaRev 19) green; hygiene: only the absolute perf checks fail, in both builds (the machine ran three
  other sessions' suites): paired runs minutes apart, bfc30ea 7912 / 8902 µs daily average vs FIN5a 5113 / 7451 µs, the
  leader-lab relative check flipped in the base and passed in FIN5a: no regression (the story runs once a quarter;
  `supplierTerms` reads the stored share). lint-hidden, lint-ux (GLOSSARY.md regenerated), lint-tradeoffs, lint-structure
  green; safety S5 −0.49 → −0.93 (the known failure is back; FIN1–FIN4b read −0.95 to −1.01); finance all passed (F2 now
  passes); worldfx all passed (HireRate_SOFT passes: a side effect); ws4, products, money, idle green. `npm run test:ui`
  313/313 (9 new FIN5a checks).
- Test changes (meaning changed): finance.ts F9's formula grid (20–37× at g 5–10, 15–20× at g 2.5, `valuationMark`) is
  replaced by FC1 (sector value at the start and late 2026) and FC2 (the RefBot's multiple at ×2.5+ growth, and lower
  when growth is slower) on the reference path, since the formula is gone; F7's valuation band kept ($1–3T) but it now
  reads the split; FIN2's credibility check now multiplies the share's weight (×0.7 / ×1.15 exactly) and the valuation
  moves the same way, not by the same factor; the IPO check reads governance × 0.95 on the share; the FIN2 stacking check
  accepts the repriced down round its conservative pitch now meets at the close (the half-way mark grows slower than the
  old formula); the FIN4a rescue stake is "at least 30%" (the day-400 fixture's rescuer is the legacy Northwind holder,
  whose own cash takes it past 30% at the lower story mark); the FIN4r 17 → 18 migration check accepts later revs; FIN5a
  adds 9 checks (the mark, the sector value and bust, the share, pre-revenue drivers, start valuations, the pool, supplier
  terms with preview = booked, migration 18 → 19, the RefBot's equity a year). uitest: 9 FIN5a checks (the equation and
  mood, the valuation's single home, the share bar, the six tiles with their effects, a driver's tooltip, credibility's
  link, the valuation's why, Ownership's link, supplier terms on Buy chips).
- Left for FIN5b: rivals' own valuations from the split (their stored valuation and split value disagree now; trailing
  rivals split at ≈ 54× run-rate because the share has no revenue-size driver), their raising from the pool, credibility
  and governance by rival, license-and-hire exit; the pre-revenue spinout at 7–8% of the sector (SSI ≈ 5%) may want a
  lower open-weight floor or a capacity term once rivals mark. For FIN6a: the leader's multiple sits at the FC2 band's top
  (36.6×) and reaches ≈ 60× in 2027; the bust factor now cuts valuations ×0.4 on top of the hype shock (as the pool always
  was; a bust leaves a lab ≈ 20% of its mark); the half-way mark (`blend`) and position per 2 levels are [D] choices made
  for the reference bot's survival; supplier-term sizes [D]; π against FC4 (round sizes); capex2x now ends insolvent
  more than ousted (FC7). Docs (V2-SPEC §3.7.3, `design/v2-interfaces.ts` `narrative`) for FIN6c.

### FIN5b notes (2026-11-20)

Built: `finance/rivalFinance.ts` (rivals' money: `RIVAL` numbers, `RIVAL_GOV` / `rivalGov`, `rivalCred`, `rivalCap`,
`rivalSpend`, `parentFunded`, `exitBuyer`, `bustTarget`, `markRivals`, `rivalRoundMax`, `rivalMoneyQ`, `exitRival`).
`actors/rivals.ts rivalFinanceQ` keeps the revenue update and the chip orders and calls `rivalMoneyQ` in one line (cash
flow, raise, distress, exit); `markRivals` runs in capitalQ right after the player's mark, on the same story snapshot
(and in `startStory` for the start valuations). `storyShares` gives rivals their own credibility and governance and
carries each lab's valuation, cap and rung (`LabStory.valuation`, `cap`, `rung`). The bust's push names its rival
(`CapitalMarkets.busted.rival`) instead of setting a distress flag that the next rival quarter cleared. E32's text and
Decline preview follow the new exit (same buyer as the engine: `exitBuyer`); `deactivateRival` takes the log line.
UI: a rival's bar on the Story card is the home of its valuation (tooltip: valuation, cap = $30B + 25× revenue with "at
the cap", multiple, share, weight, score, revenue, level, credibility with its growth, governance with its kind); the
bar labels stay shares (the widths are shares); the governance tile says rivals count by kind. Glossary: new
`rivalValuation`, `rivalCap`; `govFactor`, `acquisition` updated; `design/ux/GLOSSARY.md` regenerated. schemaRev
19 → 20 with a migration.

The rules (spec §12; [D] numbers in `RIVAL`):
- **Valuation** = sector value × the rival's share, the share moving half-way each quarter from its last mark to today's
  story (the player's rule), **at most its cap = $30B team value + 25× its run-rate** [R21 A8: SSI $32B pre-revenue,
  TML $12B; R15 C11 / FC2: trailing labs under the leader-style 20–37×]. **Deviation (the brief allowed "a revenue-scale
  term or a cap")**: the share has no revenue-size driver, so marked at S × share a lab whose revenue had collapsed kept
  1–2% of a $13T sector the RefBot's revenue built (FIN5a: trailing labs ≈ 54× run-rate, dead ones 80–190× in 2027). The
  cap applies to rivals only; the player's valuation stays the uncapped story (FIN5a's fit; FIN6a may decide to cap
  everyone: the RefBot's 2027 multiple is ≈ 60×). A capped lab's unallocated part of S is not handed to the others (the
  player's share is unchanged by the cap), so Σ valuations ≤ S. Shown on the lab's bar.
- **Credibility** (one rule, from growth): revenue over four quarters ≥ ×1 (or pre-revenue) Credible ×1, below Unproven
  ×0.9, at R15's ×0.5 floor Doubted ×0.7. No Proven for rivals. "Keeps shipping" is not a separate test: a rival's
  public model renews every 6–10 weeks + its release lag, so it was always true; shipping shows up in its revenue.
- **Governance** by kind (the GOV_FACTOR table): safety lab PBC + trust ×1 (Anthropic), maverick and boutique upstart
  founder ×1.1 (xAI; SSI / TML), the simulated leader lab nonprofit PBC ×0.9 (OpenAI after Oct 2025).
- **Pool**: each private rival's part = its valuation ÷ S × the quarter's pool, scaled so the rivals' parts never exceed
  1 − the player's share; the unused part carries 50% (as the player's). **Raise** when cash < half a year of spend (spend
  formula moved from rivals.ts unchanged: $15.4K per H100e-year + $0.4B), at its valuation, min(d_max = 8% of the lab,
  its pool part); post-money = pre + amount until the next mark; logged ("X raises $YB at a $ZB valuation", severity 1).
  No dice: the old 90%-odds raise with the lead and bust penalties is gone (investors' view of a lab behind is its share
  and cap). Rounds are at most quarterly (rivals' finance runs once a quarter).
- **Distress** = cash < 0 after raising, or pushed by a bust that quarter (the most over-committed private rival: it
  raises nothing that quarter). Entering distress requests E32 (offered to you first, as FIN3c built it; **FIN3c's gap
  closed**: a bust-pushed lab now gets the offer too). Still in distress the next quarter → **license-and-hire** by the
  big-tech rival with the most compute: its compute moves, 70% of its staff join the buyer, the buyer's know-how rises
  to the lab's if lower (the licence), its investors get 1.25× what they put in (`finance.raised`, start figures from
  R21: Anthropic ≈ $15B, xAI ≈ $22B, SSI $3B, OpenAI ≈ $60B), logged in plain words ("<buyer> licenses X's models
  and hires most of its team; its compute moves to <buyer>. X's investors get about $25B back (1.25× what they
  put in)."). **Bankruptcy** only without a big-tech rival ("X goes bankrupt: no big-tech lab will license it and hire its
  team. Its staff scatter; its investors lose their $YB."). Every distressed private lab exits this way (in practice they
  are the trailing ones). Parent-funded labs (big tech, open weights, the leader lab) never raise or reach distress.
- **Migration 19 → 20**: each private rival's last mark = saved valuation ÷ today's S, pool part 0, `raised` = its kind's
  start figure; the first mark after loading moves half-way from there and applies the cap.

The 3-year rival picture (RefBot, leader start, 12 seeds, scratch diagnostic; medians of active private rivals; end-2026
= the Jan 2027 mark, end-2027 = the Jan 2028 mark; before = 32a98f5 in a scratch worktree):

| Kind (n) | Start before → after | End-2026 before → after | End-2027 before → after | Analogue |
|---|---|---|---|---|
| Safety (13) | $180B → $155B, R $5B (31×) | $247B (28×), 10 active → $215B on $7.9B (30×; $97–340B), 13 active, cash $20B | $247B on $1.6B, 5 active → $107B on $1.6B (66×), 13 active, cash $21B | Anthropic $61.5B (Mar 2025), $183B (Sep 2025), $380B on $14B (Feb 2026), $965B on $47B (May 2026), ≈ $1.3T IPO (Nov 2026) |
| Maverick (7) | $120B → $55B, R $1B | $169B on $16B (12×; never re-marked), 7 active → $496B on $16B (31×; $313–705B), 7 active, cash $31B | $210B on $3.5B, 4 active → $160B on $2.6B (60×), 7 active, cash $32B | xAI ≈ $80–113B (2025), $230B (Jan 2026), $250B in the SpaceX merger (Feb 2026), ≈ $3B revenue |
| Upstart (6) | $30B → $35B, R $0.2B | $43B, 3 active → $86B on $2.8B (38×; $73–151B), 6 active, cash $10B | $64B, 1 active → $60B on $0.6B, 6 active, cash $9B | SSI $32B (Apr 2025, no revenue), TML $12B (2025) |

- Within ×2 at the start for all three kinds (maverick ×0.5–0.7 of xAI). At end-2026 the **multiples** sit where the
  analogues trade (safety 30× vs Anthropic 21–28×; trailing rivals 28.6× median through 2026 vs the RefBot's 34.6× at
  high growth: FC2 "trailing lower" now holds), but the **valuations** follow this world's revenues, which differ from
  reality: the safety lab earns ≈ $8B (Anthropic $47B), so it is valued at ≈ 1/5 of Anthropic (not within ×2); the
  maverick earns ≈ $16B (xAI ≈ $3B), so it is ≈ 2× xAI (median at the edge, ×1.3–2.8); the upstart sells a product
  (SSI has none) and is ≈ 2.7× SSI. The sum of private rivals' valuations at end-2026 in the seeds with three or four of
  them is $1.2–1.4T (non-OpenAI private labs, real: ≈ $1.6T). Fixing revenue is model-v3's (MODEL-V3 §7.3), not finance's.
- **Funded through 2026 (FC6)**: 26 of 26 private rivals active at end-2026 (before: 20 of 26; 6 exits by end-2026).
  **2027**: in the RefBot world the player holds ≈ 93–95% of the sector and rivals' revenue falls ×3–6; they are marked
  down 50–70% and live on the cash they raised in 2026 plus ≈ $5–10B a quarter: **no exits through 2027** (before: 16 in
  12 seeds, through the lead penalty on the raise odds); their burn ($40–70B a year against $5–10B raised a quarter)
  takes them to distress in 2028. E32 offers on this path: 16 → 3 (the three from bust pushes; all three recovered).
  FIN6a may want earlier exits for collapsed labs (e.g. cut a broke lab's chip orders harder in rivals.ts, or a cap
  that falls with Doubted credibility); not done here to keep the rule simple.
- Start valuations (seeds 1–6): leader-start player $196/244/491/257/389/322B → $184/239/491/251/389/322B (founder
  rivals ×1.1); the challenger start's leader lab $175–330B (OpenAI $300B; capped at $30B + 25 × $12B in some seeds);
  spinout player $40–65B (7–11% of the sector, unchanged from FIN5a; SSI $32B: within ×2; the share's open-weight floor
  left to FIN6a).

Numbers, before (FIN5a 32a98f5) → after (FIN5b):
- `scripts/v2/finance.ts` (12 RefBot seeds): **F7 end-2026 valuation $1.05T → $1.00T (median $999B: FAILS the $1–3T
  band by $1B)**. Cause, measured: the rivals' founder governance (maverick and upstart ×1.1, spec §1 table) lowers the
  RefBot's share; with them at ×1 the same 12 seeds give a median of $1.03T. The test was left as is: widening the band
  (e.g. to $0.9T, ×0.72 of OpenAI's $1.25T Nov 2026 mark) or refitting the share is a lead / FIN6a decision. F7 revenue
  $45.0B → $44.7B, capex $162.8B → $160.9B, compute incurred $29.6B → $29.5B, power 6.6 → 6.6 GW; F8 financing $85.4B →
  $81.5B, distress-free 83.3% → 83.3%, no-deal and capex2x distress 100% → 100%; F9 FC1 start $632B → $632B, late 2026
  $2.77T → $2.74T; FC2 leader-style 36.6× → 34.6× (slower growth 23.5× → 23.0×); trailing private rivals 54× (split,
  unmarked) → 28.6× (marked, through 2026; 42.5× in 2027); dilution max 5.1% → 5.1%; RefBot rounds 2026 3.5 → 3, 2027
  2 → 2; promises met 97% → 96%; end-2027 credibility 85 → 86, board confidence 63.4 → 65.9; F2 47.1M → 47.0M (passes).
- `scripts/v2/bots.ts --seeds 40`, leader start, paired (base = 32a98f5 in a scratch worktree, same seeds): all §7.4
  criteria MET in both. Wins race 5.0 → 2.5%, safe 2.5 → 2.5%, mixed 52.5 → 47.5%, capex2x 2.5 → 2.5%, ref 22.5 →
  25.0%. Ousted race 32.5 → 32.5%, safe 20.0 → 15.0%, mixed 15.0 → 20.0%, capex2x 45.0 → 40.0% (insolvent 52.5 → 57.5%),
  ref 17.5 → 22.5%. Safe losses overtaken/other-ASI-first 74 → 79%. (One seed in 40 = 2.5 pp.)
- Tests: `npm run typecheck` clean (and the scripts' tsconfig). One by one: golden-timelines, identity, calib, fixtures
  (regenerated, schemaRev 20) green; hygiene: only the absolute perf checks fail (machine load; paired runs minutes apart:
  32a98f5 3713 / 4898 µs daily average vs FIN5b 1951 / 2147 µs, the leader-lab relative check passes in both: no
  regression; `markRivals` runs once a quarter); lint-hidden, lint-ux, lint-tradeoffs, lint-structure green; safety S5
  −0.93 → −0.92 (known); finance: **F7 (above, new, at the band edge)**, all else passed (F2 passes); worldfx all passed
  (HireRate_SOFT 2027-04-30); ws4, products, money, idle green. `npm run test:ui` 315/315.
- Test changes (meaning changed): finance.ts F9's trailing line now reads the rivals' marked valuations and is a check
  (trailing rivals below the leader-style multiple through 2026; 2027 printed); the FIN5a share check no longer asserts
  that capitalQ leaves rival valuations alone (FIN5b marks them); the FIN5a migration check accepts later revs; 9 new
  FIN5b checks (marks and cap, the card's labs carry them; credibility rule and governance by kind; pool parts never
  exceed the pool; raising; distress → E32 → license-and-hire with the log and E32's Decline naming the buyer; bankruptcy
  without a buyer, parent-funded labs never distressed; the bust's push and recovery; migration 19 → 20; FC6 funded
  through 2026 with the end-2026 picture). hygiene's leader-lab invariance check leaves out the rivals' marked valuation,
  share and pool part (rivals are valued in a split the leader lab is part of; the draws and the setup are still
  compared). uitest: 2 new FIN5b checks (a rival's bar tooltip: valuation as the engine has it, cap, multiple,
  credibility, governance; the governance tile says rivals count by kind); R10's incident limits open an incident when
  the regenerated day-900 fixture has none (fixture drift: it had one open incident before, none now).
- Left for FIN6a: F7's lower edge (above); whether to cap the player too (2027 ≈ 60×); earlier exits for collapsed
  rivals in 2027; the spinout's 7–11% start share (SSI ≈ 5%); rivals' `commitments` is still the static start book
  (cash × 2) that the bubble index and E32's obligations read; rivals' revenues vs the analogues are model-v3's. For
  FIN6b: the rival bar tooltip is long (11 rows; share, weight and score could fold into a nested tip). Docs (V2-SPEC
  §3.10.3 rival finance, `design/v2-interfaces.ts` RivalLab.finance) for FIN6c.

### FIN6a notes (2026-11-20)

Calibration on today's engine against FC1–FC7 (spec §14) and the items queued in the phase notes. No new mechanism; one
rule extended (the rivals' valuation cap now covers every private lab, so the player's too) and one static number made to
follow the engine (rivals' commitments book = their spend). No schemaRev bump (no state shape change; older saves load
and re-mark at the next quarter). Diagnostics: scratch scripts outside the repo (RefBot path on finance.ts's 12 seeds to
end-2027; bots on bots.ts's 40 paired seeds); "before" = e5cc735 (FIN5b), whose 40-seed bot numbers are the FIN5b notes'
(the runs are deterministic: the scratch re-run of ref and mixed on e5cc735 reproduced them exactly).

**Parameters changed** (before → after, the target each serves):

| Parameter | Before → after | Target |
|---|---|---|
| `STORY.bust` (bust factor in the sector value's mood) | ×0.4 → ×0.7 [fit] | Bust design / C13: R15 put the ×0.4 on the pool, the valuation only saw the hype shock (−0.6, 4-quarter half-life); stacked, a bust left a lab at 15–30% of its mark in one quarter (RefBot seeds: $251B → $37B, $584B → $92B). Now ≈ 30–40% (2022 late-stage private markdowns 50–85%). C13 (financing doubt: pool −25%, rounds −10–20%) does not involve the factor and is unchanged (−25%). Also F7 and the competent bots' down rounds. |
| `STORY.weights` (position, momentum, economics, capacity) | 0.45 / 0.25 / 0.1 / 0.2 → 0.4 / 0.25 / 0.1 / 0.25 [fit] | F7 (late-2026 mark) without breaking F8: position (it swings in Q4 2025–Q1 2026, when the rivals' start models catch up) weighs less, the steady driver (compute secured) more. A first step to 0.4 / 0.2 / 0.1 / 0.3 gave F7 $1.36T but moved worldfx's single reference game (seed 2027) past a window: GOV T1 Accept ≥ 0.85 on 2028-03-27 (window to 2028-03-15; FIN5b 2028-01-02), a side effect through the bot's compute and capability path; 0.4 / 0.25 / 0.1 / 0.25 gives 2028-01-13. |
| Valuation cap (`RIVAL.team`, `RIVAL.multiple`, new `capGrowthRef`, `capGrowthExp`; `valueCap`, `capMultiple` in `finance/rivalFinance.ts`) | rivals only, $30B + 25× run-rate → **every private lab** (the player too), max($30B, 37 × (growth ÷ 5)^0.4 × run-rate) [fit] | FC2: the leader-style multiple ran to 44× in 2027 (60× at the end of 2027) unchecked; one rule for all labs, scaled by growth as R15 §1.5's multiple (g^0.4) and C11 (20–37× at high growth, 15–20× at ×2–3), so trailing labs stay lower by construction; a pre-revenue lab is worth its team (spinout start $55B → $30B: SSI $32B; FIN5a/5b's 7–11% share item). The sum form (team + multiple × R) was tried: trailing rivals then sat above the leader (34.7× vs 29.9×). |
| Rivals' `finance.commitments` (`markRivals`) | static start book (cash × 2, all game) → its spend a year, marked each quarter [D] | The bubble index and E32's obligations read a book that now follows the lab (start ≈ $13B median instead of $30B; late 2026 ≈ $23–27B; end-2027 ≈ $47B). |

**Kept after testing** (12 RefBot seeds each; the τ, κ and mark tests ran on the cap and bust changes with the first weight step, 0.4 / 0.2 / 0.1 / 0.3):
- τ 1.25: τ 1.0 raises the late-2026 mark (+10%) but deepens the Q1 2026 markdown (the rivals catching up) and put 3–4 of
  12 seeds in distress at the Jan 2026 review (F8 needs ≤ 3): the bot's Q3–Q4 2025 round sets a post-money that the
  Jan 2026 mark falls 25–30% under (repriced, then distress on a 3-quarter runway). τ 1.15: 4 of 12.
- κ 83, α 0.7, φ 0.75: κ 86 / 89 lift the late-2026 mark +5 / +25% but put 3 / 4 seeds in distress in Jan 2026 for the
  same reason; FC1 holds as is ($632B start, $2.88T late 2026). A lower φ or α cannot separate 2027 from 2026 (the
  frontier and revenue grow by similar ratios in both years); the cap does that.
- The half-way mark (`blend` 0.5) and position per 2 levels: blend 0.75 gives F7 $1.44T, distress 2/12; posScale 1.5
  gives $1.34T, 3/12. Neither is needed for a target and both make marks swing more (and would change the Story card's
  "half-way" wording), so the FIN5a choices stay.
- π 0.15: the sector pool is ≈ $100B in 2025 and ≈ $300–400B in 2026 (R15: ≈ $75B, $350B+); the RefBot raises $12B
  in H2 2025 and $76B in 2026 (OpenAI ≈ $30B in H2 2025, $122B in 2026: ×0.4 and ×0.6). Its rounds are pool-bound
  (max dilution 6.4%) and it raises only when its runway is under 7 quarters, 3–4 times a year (FC4's 2–3), so a larger π
  would mainly raise the 2026 sector pool past R15's figure. Left.
- Supplier terms (`SUPPLIER`): the reference bot pays its 50% deposit (the terms ask 30% + a runway premium that stays
  under 20 points at its 3–4 quarter runway); they bind only for short-runway labs (capex2x). Left.
- Spinout start share: the share stays 5–9% (it splits the pool), the valuation is now its team value ($30B, SSI $32B).
- Partner take-or-pay (FC4, research 4–12× the equity): still 1.1× on the RefBot path (Azimuth, $41B on $37B of
  equity). The FIN4a deviation holds: the capacity is sized at today's cloud price and paid on the falling path; sized
  in dollars (4× the equity) it buys ≈ 2.4–2.9× the capacity and the bot's 2026 capex (F7, $150–250B) falls under its
  band. Needs model-v3's compute demand (V4) to refit; not changed.
- Collapsed rivals' exits: none through 2027 before or after. With the cap their marks fall faster in 2027 (median
  $114B → $52B at the Jan 2028 mark; revenue $1.8B) and their cash runs down (median $21B → $14B), so the first exits
  come in early 2028. Tried: distress at a quarter of spend instead of zero cash (2 exits in Q1 2028, none in 2027),
  not kept. The rest is rivals' spend: their chip orders still grow at ≥ 25% of the path when broke (actors/rivals.ts,
  not finance), and their revenue path is model-v3's.

**Targets** (FC1–FC7 and the queued checks; before → after, finance.ts 12 RefBot seeds unless said):

| # | Target | Before (FIN5b) | After (FIN6a) |
|---|---|---|---|
| FC1 | Sector value $0.6–0.7T mid-2025, $2.5–3T late 2026 | $632B · $2.74T | $632B · $3.00T (met, at the band's top) |
| FC2 | Leader-style 20–37× at high growth; trailing lower | 34.6× (2026 17×, 2027 44×; end-2027 39×, up to 56×; end-2027 valuation $9.0T); slower growth 23.0×; trailing rivals 28.6× (2027 42.5×) | 30.3× (2026 19.2×, 2027 33.5×; end-2027 28×, valuation $6.4T on 31 Dec, $7.3T at the Jan 2028 mark); slower 25.1×; trailing 27.4× (2027 30.3×) (met; 2026 alone just under 20×) |
| F7 | End-2026 valuation $1–3T | $1.00T (fail) | $1.24T (range $0.76–2.34T; 4 of 12 seeds under $1T) (met) |
| FC3 | Dilution 5–8%, ≤ 14% anchored, IPO 4–5% | max 5.1% | max 6.4% over 73 rounds; 14%; 5% (met) |
| FC4 | ≈ 2–3 rounds a year; leases and long firm contracts; commitments several × revenue | 3 / 2 rounds; commitments 2.0× run-rate at end-2026, 1.0× at end-2027; partner 1.1× its equity | 4 / 2 rounds (2026 one more than FC4's 2–3); 2.0× at end-2026, 1.1× on 31 Dec 2027 (1.3× after the Jan 2028 quarter start: $306B on $231B); partner 1.1× (rounds and contracts met; commitments **missed**, see above) |
| FC5 | Cash-burning lab at $200B+ rates B/BB, chip loans only | met (FIN1 check) | met |
| FC6 | Trailing rivals funded through 2026, valuations within ×2 | 26/26 funded; safety $215B, maverick $496B, upstart $86B | 26/26; safety $158B on $8.1B (19×), maverick $684B on $16.3B (43×), upstart $71B on $1.9B (34×) at end-2026 (funded: met; values follow this world's revenues as in FIN5b) |
| FC7 | 2× capex bot in distress by 2027 unless rescued | 100% (finance.ts) | 100% (met); bots below |
| F8 | RefBot distress-free through 2026 ≥ 75% | 83.3% | 83.3% |
| — | RefBot equity / year | 2025 H2 $11B, 2026 $58B, 2027 $222B | $12B, $76B, $248B |
| — | Busts on the RefBot path through 2027 | 3 of 12 seeds (bubble index at day 92: 4.4) | 0 of 12 (4.4 → 3.1 with the rivals' books at their spend; summed bust odds to 2027 0.17 → 0.10 a game) |

**Bots** (`scripts/v2/bots.ts`, leader start, 40 paired seeds per bot; before = FIN5b's run on e5cc735): all §7.4
criteria MET before and after.

| Bot | Win | Ousted | Insolvent | Notes |
|---|---|---|---|---|
| ref | 25.0 → 25.0% | **22.5 → 15.0%** | 0 → 0% | ousters now in 2028–30 (days 1097–1736); before, 5 of 9 began with distress in Q4 2025–Q1 2026, and 8 of 9 had 1–7 down rounds |
| mixed | 47.5 → 52.5% | **20.0 → 15.0%** | 0 → 0% | ousters in 2028–30 (days 1097–1736) |
| race | 2.5 → 5.0% (≤ 5%: at the edge) | 32.5 → 30.0% | 0 → 0% | still at real risk: 8 of 12 ousters at the Jul 2026 review; company loss 46% of losses |
| capex2x | 2.5 → 2.5% | 40.0 → 47.5% | 57.5 → 50.0% | FC7 holds: company loss 97.5%, every one by day 915; insolvent by Jul 2026 (days 215–305), ousted mostly at the Jul 2026 review (day 366) |
| safe | 2.5 → 2.5% | 15.0 → 25.0% | 0 → 0% | ousted only in 2028–33 (days 1189–3015), a slow lab long after the calibrated window: its cap multiple falls as its growth slows; losses overtaken/other-ASI-first 79 → 69% (≥ 50%) |

With the first weight step (0.4 / 0.2 / 0.1 / 0.3, which broke the worldfx window) the same runs read ref 10.0%, mixed
12.5%, race 30.0% (win 2.5%), safe 25.0%, capex2x 62.5% ousted / 35.0% insolvent: the final weights trade about one
seed in 40 of competent-bot ousters (ref 4 → 6, mixed 5 → 6) for the world-effects window.

Why the competent bots' ousters fell (board-confidence sources in the ousted games, scratch diagnostic): before, down
rounds (−17 each on the leader board, 2–7 a game) and quarters in distress (−5 each) were most of the losses, about half
of the games starting in distress in Q4 2025–Q1 2026 (a bust or the Jan 2026 markdown); the softer bust and the steadier
share remove most early down rounds (no competent-bot ouster before day 1097 now).

**Tests.** New in `scripts/v2/finance.ts` (FIN6a block): the aggressive pitch end to end (signed and closed at ×1.2
the mark with a 1.3× target, the next mark falls back under its post-money so a base round is then a down round, judged
like any promise; no bot pitches it, so this exercises the path); one valuation cap for every private lab (the player's
mark capped, the cut booked as its own cause "valuation cap", the multiple rising with growth); rivals' commitments book =
their spend; FC2 by year on the RefBot path (2027 inside 20–37×, 2026 ≥ 15×), with FC4's commitments and partner ratio
printed. Meaning changed: FIN5a's mark check reads V = min(S × share, cap); FIN5a's sector-value check label says ×0.7;
FIN5b's rival-mark check reads the new cap (computed from each lab's growth at the mark); FIN4r L10 sizes its chip loan
$10B over what the installed chips cover at 1.2× (it used a fixed $30B, which the regenerated day-400 fixture's chips
now cover, so no sweep was due: fixture drift, same meaning). Fixtures regenerated (`fixtures.ts`).

Test runs (final engine, one by one): `npm run typecheck` and the scripts' tsconfig clean; golden-timelines, identity,
calib, fixtures green; hygiene: only the absolute perf checks failed in the chain, under load from three 40-seed bot runs alongside
(1635 / 1548 µs), and all passed on a rerun once they finished (995 / 1440 µs; FIN6a adds nothing daily);
lint-hidden, lint-ux, lint-tradeoffs, lint-structure green; safety: only S5 (known; mixed-bot median min margin −0.92
→ −0.55); finance all passed after the L10 fixture-drift fix (targeted rerun; 194 checks, F2 47.0M passes); worldfx all
passed (GOV T1 Accept 2028-01-13, HireRate_SOFT 2027-05-04, AI-friend 8.4%); ws4, products, money, idle green.
`npm run test:ui` 315/315 (run because the Story card reads the cap and the weights; no UI file changed).

**Refit due after model-v3** (these fits read quantities model-v3 replaces):
- V4 (revenue, cost to serve, price): κ_S and α (R_sector), the economics weight and its 0.2 scale (the economics bridge),
  π against the raise totals, the cap's multiple (revenue run-rate and growth), FC2 multiples, the RefBot's revenue
  path (F7 revenue), FC4 commitments ÷ revenue and the partner take-or-pay size (compute demand sets how much capacity
  the bot can take on a long contract), rivals' revenues against their analogues (FC6), the rivals' book (= spend).
- V7 (rivals, bots): the share's position and momentum weights (rivals' start models and start-table revenues drive the
  Q4 2025–Q1 2026 markdown that limits τ and κ), the rivals' exit timing (their chip orders keep spend growing when
  broke), the bubble index (it reads every lab's commitments), the bots' raise policy and ouster rates, the start
  valuations (challenger capped at $90B in every seed, spinout at its $30B team value).

**For the UI agent / lead (UI text the changes make stale; not edited here):**
- `panels/FinanceStory.tsx` ShareBar: the cap row says `$30B + ${RIVAL.multiple}× revenue`; the rule is now
  max($30B team value, `capMultiple(a.growth)` × revenue) (37× at ×5 a year, × (growth ÷ 5)^0.4; `valueCap` and
  `capMultiple` are exported from `finance/rivalFinance.ts`). The player now has a cap too (`LabStory.cap` is set for
  you): show it on your bar and in the valuation's Why ("at the cap" when it binds); the StoryCard's "next mark" is
  min(S × next share, `me.cap`) (it computes S × share), and its body "Sector value × your share …" needs "at most
  your valuation cap". The valuation's causes gain a "valuation cap" line when it binds.
- Glossary (`data/v2/glossary.ts`): `marketMood` and `bubble` say ×0.4 in a bust (now ×0.7); `storyShare` lists the
  weights 0.45 / 0.25 / 0.1 / 0.2 (now 0.4 / 0.2 / 0.1 / 0.3); `rivalCap` ("Rival valuation cap": $30B + 25×) is now
  every private lab's cap (suggest "Valuation cap": max($30B team value, 37× at ×5 a year growth, scaled by
  (growth ÷ 5)^0.4, × run-rate)); `valuation` should mention the cap; `acquisition` "its yearly book" is now its spend a
  year. Then regenerate `design/ux/GLOSSARY.md`.
- Note on the cap's multiple: growth is clamped to R15's ×0.5–×8, so the cap allows up to 45× at ×8 a year (above
  FC2's 37×); the reference lab never grows faster than ×5 a year at a mark (0 of 120), so only a rival whose revenue
  jumps (×5–8 in a year) could be capped above 37×. Clamping the cap's growth at ×5 would be the simple fix if FIN6c or
  the V4 refit want the band as a hard ceiling.

### FIN6b notes (2026-11-20, branch `finance-v3-ui`, worktree `../AI27-finance3-ui`, based on e5cc735)

UI only: no engine numbers, data constants, bots or engine tests changed. One new pure display helper,
`finance/pv.ts` (present value of the payment options; reads `payOptions` and the engine's payment timing, imported
directly by the Compute panel, not via the engine index). Reviewed on screenshots of every Finance tab and the compute
cards at day 0 (leader, spinout, big tech) and day 400 (leader fixture, spinout fixture), plus a division over budget
(scratch shots outside the repo, before/after: `d0-*`, `d400-*`, `spin0-*`, `spin400-*`, `big0-*`, `big-neg-fin-cash`;
uitest shots `52-fin1-compute-cards`, `55-fin2-raise`, `56-fin2-owe`, `60-bigtech-finance`, `61-bigtech-over-budget`,
`63-fin3b-critics`, `66-fin4a-partner-offer`, `70-fin5a-story`).

Per card:
- **Build data centre / Buy chips (Pay with):** each tile shows its present value (bold, the lowest green) over the
  undiscounted total (before: total only, so a lease always looked dearer: site $16.0B cash vs $26.1B lease; now PV
  $14.7B vs $15.2B on the day-400 fixture). Discount rate: the lessor's return at your rating, or the chip-loan rate when
  no lessor funds you; the tooltip says which and lists cash at each stage, the total and the PV. Timing as the engine
  pays: a site's own cash on its build schedule, lease payments quarterly from go-live (sites) or delivery (chips),
  chip-loan interest quarterly and the principal at maturity. The tooltip's "Cash up front" (wrong for sites: paid on
  the build schedule) now names the stage. Glossary: `presentValue` new, `payOption` and `spv` (now titled "Financing
  lease") reworded.
- **Raise:** the runway and tranche pills are gone (they repeated the before → after line, and the "+11q runway" pill
  contradicted the capped "8q+ → 8q+" next to it); the line reads "cash at the close $A → $B + $T tranche if …"; the
  tooltip explains the half-at-close rule. IPO row: "you can list now" or the reason; the window's home is Markets,
  the public share's is Who owns you (listed: "listed · dual-class").
- **Story:** a rival's bar tooltip is 4–5 rows (valued, share, revenue, multiple, at its cap when it is, "Why this
  share") with the weight, score, level, growth, credibility, governance and cap one level down (nested "details").
  Your segment is labelled from 5%. "Credibility" tile → "Investor credibility" (the public credibility in Relations
  is a different datum). The footer no longer repeats your part of the pool (home: the Raise card's limit row).
- **What we owe:** tranche conditions wrap onto two lines (source · amount, then the condition) instead of an
  ellipsis; an undrawn credit line's covenant shows "tested once you draw" with no bar (before, its "actual" repeated
  cash from the top strip); the pending round reads "starts at the close, ‹date›"; a promise's tooltip says when it
  counts as behind (why "on track" can sit below needed-by-now early in its term).
- **Cash history:** draws from day 0 (today's point and the projection; before: an empty "starts after the first week"
  card); for a division drawing cash below zero the axis extends below $0 and that band is marked "below $0: advance
  from the parent", with a legend entry (glossary `parentAdvance`) and "advance $X" on hover (before: clamped at $0,
  so a −$30B division read as zero cash).
- **Who owns you:** no "public 0% · IPO window open" line (two datums with other homes); unlisted reads "Not listed".
- **Partners:** an option that adds nothing says so ("Exclusive · no more money", tooltip: the stake is at its cap)
  instead of "Exclusive +$0"; the partner name in the offer header no longer wraps.
- **Why cash moved:** wider label column (no "Revenue to the parent ×…" ellipsis).

Checked and left as is: vote strips (decision: green yes; ouster: red = votes to remove you, footer says so), charter
rights, critics' seat, Debt card, Rent compute, Board seats. Found but left: the Buy chips preview's engine-written
cost label repeats the supplier deposit ("deposit now (36%; supplier terms ask at least 36%)") next to the supplier
terms chip (the label is the engine's `actionView` text, not UI; FIN6c); the Debt table's credit line "$0 / $4.0B" (as
arranged) next to its tile's "$13.0B room" (re-sized when you borrow; the tooltip says so) still reads oddly; a vote
chip's "×2" weight sits tight under its icon; IA.md's Finance rows predate the Story / What we owe tabs (FIN6c docs).

Tests: `npm run typecheck` clean; lint-ux (GLOSSARY.md regenerated), lint-hidden, lint-tradeoffs, lint-structure,
lint-tips pass; `npm run test:ui` 324/324 (315 before). uitest changes: FIN4r's tranche check reads the preview line;
FIN5b's rival-tooltip check rewritten for the short tooltip plus a nested-details check (meaning kept: valuation as the
engine has it, credibility, governance and cap still shown, one level down); 8 new FIN6b checks (Raise pills, What we
owe wrapping and idle covenant, Ownership without the IPO window, PV on the build tiles, lease PV within 15% of cash
while its total is ≥ 1.3×, the PV tooltip's stated rate, cash history from day 0, the division's advance band).

### FIN6c notes (2026-11-20)

Review and cleanup; no mechanics or calibration numbers changed.

**Merge check (fc8b150, FIN6a + FIN6b built in parallel).** Full suite on the merged tree before any FIN6c change:
typecheck and the scripts' tsconfig clean; golden-timelines, identity, calib, fixtures (regenerated, no diff), hygiene
(perf checks passed this time), lint-hidden, lint-ux, lint-tradeoffs, lint-structure green; safety only S5 (known, −0.55
as FIN6a); finance all passed (193 checks, F2 47.0M); worldfx, ws4, products, money, idle green. No merge breakage: the
FIN6b UI read FIN5b's cap and weights only as display text (fixed below), and `npm run test:ui` 324/324 (that run's build
already carried the FIN6c UI edits below, made while the engine scripts ran).

**UI text (FIN6a's list and FIN6b's leftovers).**
- Story card: one cap rule for every lab, max($30B team value, `capMultiple(growth)`× revenue), on the rival tooltip's
  details and its "At its cap" row (which now says what sets it: team value, or N× revenue at ×g a year); your bar's
  tooltip shows your cap (and "At your cap" when it binds); the valuation's Why has a "Valuation cap" row and says "at
  most your valuation cap"; "next mark" = min(S × next share, your cap), and its tooltip shows the cap and when it binds.
  `capMultiple` and `valueCap` are now exported from the engine index.
- Glossary: `rivalCap` → `valuationCap` ("Valuation cap", every private lab, 37× at ×5 a year × (growth ÷ 5)^0.4,
  growth read at ×0.5–×8); `marketMood` and `bubble` ×0.7; `storyShare` 0.4 / 0.25 / 0.1 / 0.25 (FIN6a's list said
  0.4 / 0.2 / 0.1 / 0.3, the first weight step; the engine has 0.4 / 0.25 / 0.1 / 0.25); `valuation` mentions the cap;
  `rivalValuation` links the cap; `acquisition` "its spend a year". `design/ux/GLOSSARY.md` regenerated.
- **Drift guard:** the glossary is plain data (`src/data` imports only types from the engine), so it cannot read the
  constants without a layering cycle. Instead lint-ux has a new check, "Finance glossary numbers match the engine": 10
  quoted numbers (bust, τ, the four weights, α, φ / φ_ref, π, the cap's team value, multiple, growth ref and exponent,
  the growth range) are rebuilt from `STORY` / `RIVAL` and must appear in their entries.
- Buy chips: the engine's cost label reads "deposit now (N% of the order)"; the supplier's minimum is only on the card's
  supplier-terms chip (one home).
- Debt table: the credit line reads "$0 / $4.0B → $15.0B" (as arranged → the size it takes when you next borrow, the same
  figure the tile's room is computed from); the tooltip explains that the line counts in liquidity as arranged and is
  re-sized on the next draw or round.
- Vote chips: a multi-vote seat's ×N is a small badge outside the ring with 9 px before the next seat (it overlapped the
  ring and the next chip).

**Leftover sweep** (src, scripts, data, design). In code only save migrations (kept: they handle old saves) and tests
asserting removal mention `narrative`, `valuationMark`, `valuationNow`, `raisedLast4q`, `revenuePlan`, `pendingApprovals`,
`blockedUntil`, `reinstatedDay`, E37, `seekPartner` / `acceptDeal` / `declineDeal`, `vendorNote`, `megaJV`, the old
`cmp.*` ids and `spv` (the remaining `spv` uses are the `spvFunded` site field, the `spvFinanced` tally and the glossary
key `spv` = financing lease). No hits: `kY`, `boardApproval`, `BOARD_VECTORS`, `DEAL_TEMPLATES`, `DEAL_TERMS`,
`payParent`, a `F1` action. `communityPackage` is today's site field and glossary term (the action is `cmp.community`);
`poolShare` is the training pool's, not finance's; `safetyCommitteeVeto` is read (charter rights, the deployment gate).
`absorbedCompute` is written by E22/E32 and never read: WS4 / compute state, left (open item). Dead finance exports
removed: `recapDeadline` (investors.ts), `orderBalances` (ledger.ts, pre-v3 order kinds), the `CredRung` type
(promises.ts). Exported-but-file-local constants and helpers were left (tunable numbers; tests read some).

**Docs.** V2-SPEC §3.7 (a superseded box: what still holds, what FINANCE-V3 replaced), §3.10.3 (rivals' finance), §4.2
(E32 rebuilt, E37 removed, E03/E04 are partner offers); STRUCTURE §4.8 (the parent-confidence mechanic); IA.md Finance
tabs and the money datum → home rows; `design/v2-interfaces.ts` finance types (no templates, `pendingApprovals`,
`boardVector`, narrative; promises, credibility, partner deals, `ActionDef.vote`, rivals' finance fields); JANK-AUDIT
F2 / F3 / ST2 / ST3 status lines; FINANCE-V3's status line; the "Status: built" section at the top of this file.

**Final run** (0ae5f95, every script one by one): `npm run typecheck` and the scripts' tsconfig clean;
golden-timelines, identity, calib, fixtures (no fixture diff) green; hygiene: only the absolute perf checks (1599 / 1686
µs in the chain, 2562 / 2967 µs and worst quarter 9.5 ms on a lone rerun while the parallel model-v3 session loaded the
machine; they passed in the first FIN6c run on the same engine; the relative leader-lab check passes, −3.6%; FIN6c adds
nothing daily); lint-hidden, lint-ux (new glossary check passes), lint-tradeoffs, lint-structure green; safety only S5
(known, mixed-bot median min margin −0.55); finance all passed (193 checks; F2 47.0M); worldfx all passed (GOV T1 Accept
2028-01-13, HireRate_SOFT 2027-05-04, AI-friend 8.4%); ws4, products, money, idle green; `npm run build` succeeds;
`npm run test:ui` 324/324.
