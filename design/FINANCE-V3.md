# Finance v3: how financing, deals and the board work (draft for review)

Status: **approved 2026-11-19** (user: "approved"; §12 rival exit and §13 division budget defaults accepted); numbers to calibrate.
**Built 2026-11-20** on branch `finance-v3` (FIN1–FIN6c): what was built, deviations, parameter homes, the refit due
after model-v3 and open items are in [FINANCE-BUILD.md](archive/FINANCE-BUILD.md) ("Status: built").
Tags: **[R15]** research/15-compute-finance.md · **[R21]** research/21-lab-financing-history.md · **[D]** design
value · **[fit]** fitted by the calibration harness (§14). Depends on MODEL-V3 (revenue, cost to serve, capability
levels), see §15.

Why this exists. The v2 finance engine was fitted to reproduce the *size* of real rounds and debt, not built from
why anyone gives a lab money. The audit (conversation 2026-11-18) found:
- valuation = trailing revenue × multiple with a "narrative premium" fixed at the start; capability lead, margins and
  risk never move it; rivals' valuations never re-mark at all;
- the raise ceiling is revenue-only; ownership barely matters, so equity at the ceiling every quarter dominates (the
  reference bot: 11 rounds in 3 years, $470B, zero debt in every seed, commitments flat);
- debt sizes are revenue rules (a credit line that grows by itself, bonds to 1× revenue at any rating, an assumed
  backlog in the rating);
- the SPV is unlimited at any rating and repays 48% of what it funded; the mega-JV 60%;
- long cloud deals lock today's price for 6 years while chips get 8% cheaper a quarter (≈ 2× the average market) with
  no priority; 8 overlapping deal templates; strings that do nothing (IP rights; the safety-committee veto is never
  read);
- the board is a meter plus dice-roll approvals; its "plan" is last quarter × 1.15, unrelated to any raise.

## 0. Principles and user decisions

1. **Each party prices its own risk.** Equity prices the upside (the story), lenders the downside (cash flows and
   collateral), suppliers whether you can pay, the board execution and survival.
2. **One shared input: confidence in the story**, read from a few observables anyone can see (§1).
3. **Contained.** Finance reaches the rest of the game only through **cash**, the **charter's release block** and
   **ouster** (game over). No effects on staff: down rounds and distress no longer cost staff or morale.
4. **Visible.** Every expectation, condition and covenant has one home ("What we owe", §11) with progress.
5. **No recurring decisions.** Finance choices happen only when you raise, sign, borrow or build; everything else is
   automatic and shown.
6. **Simple rivals** (§12): same valuation split, simple raising, numbers roughly right.

User decisions (2026-11-18/19): valuation = market-set sector value split by story strength; one milestone per round,
three types, three pitch levels; **promises stack**, each judged at its own deadline, and are **expectations, not
contracts** (they move credibility and board mood, never money); one strategic-partner deal with three partner kinds,
**several partners allowed**; IP-access string; sovereigns are passive cheques with a political cost, **no
in-country site**; IPO is an explicit one-time choice with dual-class shares; **no counterparty failure** of partners;
borrowing against chips is the only debt open to a loss-making lab (no extra high-yield channel); ownership matters
only through who sits on the board; ouster stays game over; no annual plan or budget envelope; site blocks get a small
upfront package or a large reactive one; low board confidence is answered by results or by giving the critics a seat.

---

## 1. The story: valuation

**Sector value** S_t: what investors will pay for all private frontier labs together.
```
S_t = κ_S · R_sector^α · Φ(L_frontier) · mood_t                                [fit]
  R_sector   private frontier-lab revenue run-rate (player + private rivals)
  Φ          rises with the public frontier capability level (the prize looks bigger as models get better)
  mood_t     hype H × rate factor M (y10) × bust factor (R15 §1.4, kept)
```
Calibration: ≈ $0.6–0.7T mid-2025, ≈ $2.5–3T late 2026 (OpenAI, Anthropic, xAI marks [R15 §2.9]).

**Share** of lab i: a softmax of its story score over all private labs (player + rivals).
```
z_i     = Σ_k w_k · x_ik                      k ∈ {position, momentum, economics, capacity}   [D, fit]
share_i = cred_i · gov_i · exp(z_i/τ) / Σ_j cred_j · gov_j · exp(z_j/τ)
V_i     = S_t · share_i
```

| Driver | Measured as (each normalised against the rival field) |
|---|---|
| Position | Best *public* model's level vs. the best rival public model (what markets can see) |
| Momentum | Adoption growth over the last 4 quarters (revenue run-rate ratio; 0 for a pre-revenue lab) |
| Economics | Serving gross margin = (serving revenue − serving compute cost) ÷ serving revenue (needs MODEL-V3 §7.3) |
| Capacity | Compute secured: online + contracted for the next 8 quarters |

- **Credibility** ladder (§2.4): Doubted ×0.7 · Unproven ×0.9 · Credible ×1.0 · Proven ×1.15 [D].
- **Governance factor** gov (R15 §1.6, kept): legacy nonprofit 0.6 · nonprofit PBC 0.9 · PBC + trust 1.0 ·
  founder 1.1; dual-class after IPO ×0.95 [D].
- A pre-revenue lab (SSI-style, $32B with no product [R21 A8]) still has value through position.
- Valuation is marked quarterly. Rivals are in the same split, so their valuations are consistent by construction.
- UI (Story card): "Sector $3.2T · mood warm · your share 34%: position 40 · momentum 30 · economics 15 · capacity 15
  · credibility Credible".

## 2. Equity: rounds, the thesis, promises

### 2.1 How much
```
round_max = min( d_max · V / (1 − d_max),  pool_i − taken_i )
  d_max  = 0.08; 0.14 with a strategic partner anchoring ≥ 40% of the round       [R15 §1.5]
  pool   = π · S_t per year × mood (investor appetite), split by share_i; unused carries 50%   [fit]
```
- Rounds are at least one quarter apart; a round closes at the next quarter start (kept).
- Asking above round_max lowers the closing odds (kept: P = exp(−over)).
- No revenue-based annual cap (removed).

### 2.2 The thesis (one milestone per round)
On the Raise card you pick an **amount**, a **milestone type** and a **pitch**:

| Type | Milestone (12 months after close) |
|---|---|
| Capability | A public model at level X by the date |
| Scale | Y H100e (or GW) of compute online by the date |
| Adoption | $Z revenue run-rate by the date |

| Pitch | Price | Target |
|---|---|---|
| Conservative | ×0.85 [D] | Below your current trend (trend × 0.8 of the expected gain) |
| Base | ×1 | Your current trend extrapolated 12 months |
| Aggressive | ×1.2 [D], needs Credible or Proven | Above trend (× 1.3 of the expected gain) |

The card shows cash now, dilution, price, the milestone and its deadline before you sign.

### 2.3 Promises stack
- Every round creates one promise; promises **stack**; each is judged at its own deadline.
- Each promise's weight = its round's amount ÷ amount raised in the trailing year (a $1B round barely counts next to a
  $50B one).
- Promises are **expectations, not contracts**: no clawback, no cash effect. Contractual conditions live only in
  tranches (§6.3).
- If you never raise, you owe nobody a milestone.

### 2.4 Results
Credibility is a score 0–100 shown as the ladder (Doubted < 25 ≤ Unproven < 50 ≤ Credible < 75 ≤ Proven) [D].

| Result at the deadline | Credibility | Board mood |
|---|---|---|
| Met | +30 × weight | +10 × weight |
| Missed by more than 20% | −30 × weight | −15 × weight |
| Within 20% | 0 | 0 |

Start values: leader start Credible (60); challenger Credible (50); spinout Unproven (40) [D].

### 2.5 Down rounds and repricing (kept, trimmed)
- A round priced below the last post-money is a down round: board mood −15, anti-dilution for prior holders (kept).
  **No staff attrition** (removed).
- A pending round whose mark falls more than 25% is repriced; you accept or pull it within 30 days (kept).

### 2.6 IPO (one-time choice)
- Available when healthy and the IPO window is open (R15, kept).
- Raises up to 5% dilution plus a one-time public pool (≈ +50% of the pool for a year [R15]).
- Adds public holders and a listing independent director (kept).
- **Dual-class option:** founder votes keep board control after listing (Anthropic Class F 50.1% [R15]), at gov ×0.95.
- After listing: bonds become available on the rating rules (§3); valuation is still the story split (no separate
  daily market).

## 3. Debt

| Instrument | Size | Price | Covenant |
|---|---|---|---|
| Credit line | ≈ 2–4% of valuation, cap $15B [fit: OpenAI $4B at $157B, Anthropic $15B at ~$380B+] | SOFR + spread(rating) | Liquidity ≥ ⅓ of the line at quarter ends (Anthropic $5B on $15B [R15]); frozen in distress |
| Chip-backed loan | ≤ 60% of chip collateral value (falls with chip prices) | SOFR + 400–550 bp | Collateral < 1.2× loan → cash sweep (kept) |
| Bonds | ≤ 3× trailing operating cash flow; **only with positive operating cash flow** | y10 + spread(rating) | Incurrence |

**Rating** from cash flow, leverage and liquidity, never valuation:
```
z = 2·[operating cash flow > 0] + min(2, liquidity ÷ (quarterly fixed obligations))
    − (debt + 0.3 · PV(commitments)) ÷ revenue − 2·[distress]                     [D]
BBB ≥ 2 > BB ≥ 1 > B ≥ 0 > closed
```
Removed: the self-upsizing credit line, bonds sized by revenue, the assumed backlog. A loss-making lab with a huge
valuation is speculative grade (xAI paid ~12% at ~$200B [R21 E2]).

## 4. Owning compute: paying for capex

Each site (and each chip order) offers its payment options on the build/order card, compared on **total cost over the
asset's life**:

| Option | How it works |
|---|---|
| Cash | Paid on the build schedule (kept) |
| Lease / SPV | A financier pays upfront; you pay `funded × CRF(r, n)` a year, where CRF is the capital-recovery factor, r the financier's return by your rating (BBB 7% · BB 9% · B 12% [D]) and n the term (sites 15 y, chips 5 y [D]). A **residual-value guarantee** is a contingent liability (50% of the unamortised balance if you walk away [D]). Not available below B unless a strategic partner guarantees it. |
| Chip-backed loan | Chips only (§3) |

The lesson: a lease changes timing, not cost, and adds a long fixed obligation priced by your credit. Removed: the
free 4-year SPV and the mega-JV.

**Community package** (site opposition, research/16/17):
- Upfront, per site, with a company-wide default: ≈ 3% of site capex, lowers the block odds (kept from
  cmp.communityPackage; merges the F1 pledge).
- After a block (event E27, §10): a large package (≈ 15% of site capex [D]) plus a permit delay (≈ 2 quarters [D])
  unblocks with odds set by local opposition strength. Relocate and sue stay.

## 5. Renting compute: contracts

One **Buy chips** card (firmness × term) and one **Rent compute** card (term × firm/cancellable). Neocloud is a
provider in the rent card, not a deal.
```
firm price per quarter = expected market price that quarter × (1 − firm discount)
  expected path : the market forecast (cost decline 8%/q, premium mean-reverting; R15 §1.2, shown as a curve)
  firm discount : 0.05 for ≥ 2 y, 0.10 for ≥ 4 y [D]
cancellable     = spot-indexed × 1.15, notice 1 quarter (kept)
```
- Payments follow the expected path, so a firm contract is a bet on that path: if prices fall faster or demand
  disappoints, you overpay; in a shortage you are protected.
- Firm contracts get **priority** in rationing (kept weight, extended to cloud contracts).
- Supplier terms follow your equity access: prepayment share = f(share_i, runway) [D].
- Merges: spot/standard/LTA chip orders → Buy chips; cloud contract and spot rental → Rent compute; Fund supplier →
  the firm-contract priority.

## 6. Strategic partners

### 6.1 One deal, three partner kinds

| Kind | Gives | Wants | Strings |
|---|---|---|---|
| Hyperscaler | Equity in tranches (non-voting, capped 15% [R21 B2]) + cloud or custom chips at a discount and with priority | Take-or-pay compute commitment | Exclusivity (optional, more money), revenue share, **IP access** |
| Chip vendor | Money per GW of its chips deployed + priority | You buy its chips | Exclusivity optional |
| Sovereign | Equity cheque (passive) | — | Political cost: scrutiny, Congress trust, security demand (kept effects); **no site** |

- **Several partners at once** (up to 3 [D]). Exclusivity strings block deals with that partner's competitors, so the
  real decision is one deep partner (more money, locked in) vs. several shallow ones (independence) [R21 §3.2].
- Partners anchor at most one lab (kept); rivals compete for them.
- **IP access:** the partner's affiliated rival lab (if any) gains a share of your capability lead over time
  (≈ closes 10%/yr of the gap [D]); the FTC quotes it as a "bridge until our own model is competitive" [R21 B4].
- **No board seats from hyperscalers** (antitrust [R21 B2–B3]). Board seats come only from financial lead investors
  in rounds (founder preset, kept) and from a rescue.

### 6.2 Rescue (distress only, kept)
A partner injects cash for a large stake, board seats, exclusivity and IP access.

### 6.3 Tranche conditions (contractual)
Kept types: `gw:` deployed, `revenue:`, `ipo`, `recapitalisation` (governance change by a date; OpenAI 2024–25
[R15][R21 A4]). Missed by the deadline → that tranche lapses (or is cut, recap). Nothing else.

## 7. The board

### 7.1 Seats (kept presets)
Founder-controlled, nonprofit-controlled PBC, legacy capped-profit nonprofit, PBC + trust, big-tech division (§13).
Seat kinds: founder, mission, financial, independent, (strategic only via rescue).

### 7.2 Charter rights (hard, few, sourced)

| Right | Presets | Source |
|---|---|---|
| Safety committee halts the release of a model your safety evals flagged | Nonprofit PBC | Delaware AG conditions, Oct 2025 [R15] |
| Trust approval for sale of control and for transferring a capability-threshold model | PBC + trust | Anthropic charter [R15] |
| Founder super-voting: can force a major decision at a mood cost | Founder; dual-class after IPO | [R15] |
| Nonprofit board can remove the CEO more easily (ouster odds ×2) | Legacy nonprofit | Nov 2023 [R15] |

### 7.3 Major decisions (votes visible before you ask)
Sale of control, merger/acquisition, down round, rescue, new firm commitments or debt above 3× revenue [D]. Each
seat's vote is shown seat by seat beforehand (stance · decision vector, kept vectors). No dice: the vote passes if the
weighted yes > half. Operating decisions (compute, releases, research, pricing) are never voted on.

### 7.4 Mood
Board confidence 0–100, reverting slowly toward 60 (kept). Named sources only, weighted by seat kind:

| Source | Financial | Mission | Independent |
|---|---|---|---|
| Promise results (§2.4) | ×1.5 | ×0.5 | ×1 |
| Down round, covenant breach, distress | ×1 | ×1 | ×1.5 |
| Behind the best rival (quarterly) | ×1.5 | 0 | ×0.5 |
| Public incidents | ×0.5 | ×2 | ×1 |

Removed: the "+15%/q revenue plan", safety-grade bonus as a separate rule (fold into incidents/mission if wanted).

### 7.5 Low confidence
- Results restore it (promises met, distress ended).
- **Give the critics a seat** (available below 40 [D]): the side driving the decline (investors if slowness, mission
  if recklessness) gets a new director. Confidence +15 now; the board permanently leans that way (OpenAI Mar 2024;
  activist settlements).
- **Ouster:** below 25 after a 60-day warning, a quarterly seat-by-seat vote shown on the Board card (kept logic,
  minus the staff-revolt reinstatement). Ouster = game over.

## 8. Distress (kept, trimmed)
Runway projection and states (healthy ≥ 6 q, tight 3–6, distress < 3 or covenant breach) are kept. Options: down
round, rescue, renegotiate commitments (deferral for warrants), sell chips, cancel cancellable contracts. Removed:
distress morale hit.

## 9. Acquisitions
- **Buy a rival** (event E32, rebuilt): offered when a rival is in **distress**. Price = its valuation × distressed
  discount (≈ 0.5 [D]), paid in cash or **your stock** (dilution at your price). You get its compute, models and
  staff and **take on its commitments and debt**. Antitrust scrutiny (kept). Needs a board vote (§7.3).
- **DPA consolidation** (E22, government): unchanged, except absorbed obligations follow the same rule.

## 10. Events and actions

| Item | Decision |
|---|---|
| E37 Board revolt | **Drop.** Mood and ouster risk are always on the Board card; "give the critics a seat" is a standing action |
| E32 Merger offer | **Rebuild** as §9 |
| E22 DPA consolidation | Keep |
| E27 Site blocked | Keep; its community option becomes the large reactive package (§4) |
| fin.raise, fin.downRound | Rebuild (§2) |
| fin.acceptRepriced / pullRepriced | Keep |
| fin.seekPartner / acceptDeal / declineDeal | Merge into one partner offer flow (§6) |
| fin.rescue, renegotiate, sellChips, cancelContract | Keep |
| fin.drawDebt / repayDebt | Keep, new sizing (§3) |
| fin.recap / refuseRecap | Keep (governance conversion with its tranche) |
| cmp.order* (3), cmp.cloudContract, cmp.spotRental | Merge into Buy chips / Rent compute (§5) |
| cmp.fundSupplier | Merge into firm-contract priority |
| cmp.newSite | Keep; payment options on the card (§4) |
| cmp.communityPackage, F1 Community benefits | Merge into the upfront package with a company default (§4) |
| cmp.preorderTransformers | Out of scope (compute review) |
| D3 License data | Keep; the litigation exposure shows in "What we owe" as a contingent liability |
| B1 $1 government deal, B2 Defense contract, transition fund, Retire | Keep (relations/world; finance sees only the cash) |
| New: IPO, Give the critics a seat | §2.6, §7.5 |

Net: finance events 4 → 3; finance actions ≈ 23 → ≈ 15.

## 11. On screen (Finance tab)

| Card | Content |
|---|---|
| Story | Sector value, mood, your share and its four drivers, credibility |
| Raise | Amount, type, pitch → cash, dilution, price, milestone, deadline; IPO when available |
| What we owe | Every live promise (progress bar, "needed by now", days left), tranche conditions, covenants with headroom, contingent liabilities (residual-value guarantees, litigation) |
| Board | Seats and stances, charter rights, mood with its sources, ouster status |
| Cash (kept) | Cash flow, runway projection, commitments ledger |

Payment options for capex live on the build/order cards, partners on a Partners section with exclusivity shown.
One Watch alert when a promise turns "behind" or a covenant nears; no events, nothing to click.

## 12. Rivals (simplified)
- Valuation from the shared split (§1) with their own observables (public model, revenue, compute; economics = sector
  average).
- Raise when cash < half a year of spend, up to d_max at their valuation, if the pool allows.
- **Exit:** a trailing private lab in distress is license-and-hired by a big-tech rival (team + licence, compute to
  the buyer), not bankrupt [R21 C1–C5]; a bankruptcy only if no buyer. *(Default; open.)*
- Calibration (§14): 2025–26 rival valuations and survival.

## 13. Big-tech division start (open)
No equity, no valuation. Proposed rule *(open)*: the parent sets an annual budget from your results against the last
budget's goals (same promise mechanism, set by the parent instead of a pitch); it can cut the budget after misses.
Overspend is covered by the parent but costs parent confidence (replaces the runway verdict; JANK-AUDIT F2).

## 14. Calibration targets
| # | Target | Source |
|---|---|---|
| FC1 | Sector value ≈ $0.6–0.7T (mid-2025) and ≈ $2.5–3T (late 2026) | R15 §2.9 |
| FC2 | Leader-style lab multiple 20–37× run-rate at high growth; trailing labs lower | R15 C11 |
| FC3 | Round dilution 5–8%, ≤ 14% anchored, IPO 4–5% | R15 C12 |
| FC4 | Reference bot: fewer, larger rounds (≈ 2–3 a year); uses chip loans or leases and long firm contracts; commitments grow to several × revenue (Anthropic ≈ $637B at ≈ $50B run-rate) | R15 C9 |
| FC5 | A cash-burning lab with a $200B+ valuation rates B/BB, borrows only against chips | R21 E2, E4 |
| FC6 | Trailing rivals stay funded through 2026 with valuations within ×2 of real analogues | R15 §2.9 |
| FC7 | A 2× capex bot hits distress by 2027 unless it takes a rescue (R15 C8, kept) | R15 |

## 15. Dependencies and build order
- Economics (cost to serve) and Position (public model levels) come from MODEL-V3 §7.3 and §2.2: build finance after
  the v3 phase that lands revenue, cost and price.
- Until then nothing changes in code.
- Suggested phases: F1 story/valuation + rivals' split; F2 raise/thesis/promises/IPO + What we owe; F3 debt/rating +
  capex payment options + contracts; F4 partners; F5 board (charter, votes, mood, critics' seat) + events; F6
  calibration and UI.

## 16. Open questions
1. Rival exit by license-and-hire (§12) as the default?
2. Big-tech division budget rule (§13)?
3. Exact numbers marked [D]/[fit].
