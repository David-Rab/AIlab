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
