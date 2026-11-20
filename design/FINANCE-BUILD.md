# Finance v3 build plan (phase details)

Spec: design/FINANCE-V3.md (approved 2026-11-19). User: "go ahead on all stages" (2026-11-19).
Branch `finance-v3`, worktree `../AI27-finance3`, based on master 2ef72a9. Model v3 is being built in parallel on
`model-v3` (`../AI27-model3`) by another session: **never touch that worktree or the main checkout `../AI27`.**

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
next starts. Order: FIN3a → FIN3b → FIN3c → FIN4a → FIN4b → FIN5a → FIN5b → FIN5c → FIN6a → FIN6b → FIN6c.

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
