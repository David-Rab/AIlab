# Strategic partners and deals: audit (2026-11-28)

Scope: the partner offer flow (hyperscaler, chip vendor, sovereign), the rescue, round anchoring by partners, IP
access, as built on master f584ab87 (branch `corp`). Read-only audit for the corporate-structure rework; no design here
beyond one-line directions. Designer's complaint: deals are "very opaque to the player, not balanced, and don't fit
the game".

Method. Code read: `src/data/v2/deals.ts`, `src/engine/v2/finance/deals.ts`, `finance/actions.ts` (dealPreview,
rescue), `finance/equity.ts`, `npc/shocks.ts`, `compute/market.ts`, `ui/v2/panels/Finance.tsx`, `data/v2/glossary.ts`.
Offers computed with the engine's own `partnerTerms` / `dealVotes` at the five committed fixtures (one-off script
`C:/tmp/corp-audit/offers.mts`, full output `C:/tmp/corp-audit/out.txt`). Bot behaviour from five short bot games to end
2027, seed 1, tl-central (`C:/tmp/corp-audit/botdeals.mts`, ~1 min in all).

Caveat on the fixtures: the leader fixtures (day0/400/900) are generated under a cash-floor stub (scripts/v2/fixtures.ts
header), so that leader never raised or signed anything; they are valid *states* to price offers at, not histories.
The challenger and spinout fixtures are real RefBot histories.

---

## 1. What the player sees

**Where.** Finance panel → last tab "Debt & partners" → Partners card (`Finance.tsx:989-992`, `903-933`), locked
until Act 2 when the tutorial is on (`ui.tsx:31`, `Gate k="deals"`). A division has no tab. The **rescue** is
elsewhere: a button on the Raise card in the Cash tab (`Finance.tsx:338`, `974`), its terms only in the button's hover
preview. A third partner channel, **anchoring a round**, is a segmented control on the Raise card
(`Finance.tsx:254, 296`). So partners appear in three places with three rule sets.

**The list.** Five fixed partners (`data/v2/deals.ts:24-30`): Northwind Cloud (Microsoft-like), Azimuth
(Amazon/Google-like, the only one with an in-house lab), Silica Systems (Nvidia-like), Corvid Micro (AMD-like), Gulf
Sovereign Fund. Each row: kind, then "offer", "unavailable" or "since Qx". Hover: the kind's `gives`/`wants` strings
(`deals.ts:10-14`), e.g. "non-voting equity in tranches + cloud or custom chips at a discount, served first" / "a
take-or-pay compute commitment".

**An offer card** (`PartnerOffer`, `Finance.tsx:836-880`) shows, top to bottom: supply choice (Azimuth: Cloud / Custom
chips); Exclusivity Open/Exclusive +$X; IP access Keep IP/License +$X (with "closes ~10% of your lead a year · ≈N d of
your M d"); "Equity $A now + $B in 2 tranches · stake → S%"; one row per tranche "$X if 1.0 GW online in your own sites
by Q3 2027"; supply "776k H100e cloud · 6 y · −10% firm −10% partner" with a price-path sparkline and a "take-or-pay
$28.8B" pill; string pills ("revenue share 8% · 6 y", "IP access · Tarnwick", "Washington notices", "research −15%
while migrating"); Sign. The Sign button's hover is `dealPreview` (`actions.ts:269-310`): dilution, cash lines, first
and last payment, revenue share per year, lead days, politics.

**What is hidden, misleading or only in code.**

| Item | What the player gets | What the engine does | Evidence |
|---|---|---|---|
| Revenue share | "8% · 6 y", "≈$1.0B/yr at today's run-rate" | 8% of *all* revenue, monthly, for 6 y on whatever revenue becomes; on a growing lab this is the deal's largest cost (§2) | `actions.ts:292`; `cashflow.ts:90`; `Finance.tsx` Strings pill |
| Commitment size | "take-or-pay $28.8B" | Sized as 4× the equity *at today's price*, then paid on the falling path, so the real commitment is ~1.4× the equity; capacity is a fixed H100e count for 6 y | `finance/deals.ts:182-183` |
| "Served first in a shortage" | Listed as a partner benefit | Every firm cloud contract is served first; a Rent-compute firm contract gets the same | `compute/market.ts:378-384` |
| Tranche conditions | "if 1.0 GW online in your own sites by Q3 2027" | +0.5 / +1.5 GW (hyperscaler), +1 / +2 GW (chip vendor) of owned chips online, counted on *your* total, not the partner's chips; no hint how long a site takes against the deadline (grid wait 18 q in 2025, `deals.ts:165-166`) | `finance/deals.ts:188-189, 202` |
| Stake after | "stake → 8.3%" (all tranches at today's valuation) | Tranches buy at the valuation of the day they land, capped at 15% for hyperscalers; votes read the stake after the cheque now only (2.9%) | `Finance.tsx:841`; `deals.ts:221-227` |
| Exclusivity | "+$5.1B, blocks Azimuth for good" | Also changes who rescues you (Northwind vetoed → Azimuth rescues, with IP access); permanent even after the deal ends (`vetoesOf` never reads `until`) | `deals.ts:29-36, 245-247` |
| Max 3 partners "at once" | header "n of 3 partners", glossary "at once" | Every deal ever signed counts, forever (comment: deals "run longer than the game"; the game runs to 2050); one deal per partner, ever | `deals.ts:52-55, 100`; `glossary.ts:160` |
| "Anchors another lab" | a blocker reason | Never fires: only `'player'` is ever written to `anchors`; rivals have no partners at all | `ext.ts:34`; no hit in `rivalFinance.ts` |
| IP access cost | "≈9 d a year of your 86-d lead" | Correct today, but one rival only, and free when you are behind (bump paid, cost 0 until you get ahead, then for 6 y) | `npc/shocks.ts:106-118` |
| Rescue terms | hover on the Rescue button: cash, "topped up to 30%", seat | Rescuer = first non-vetoed name in a fixed list; price = par plus free shares to reach 30% (0 to 20 points depending on the rescuer's old stake); IP access included when the rescuer is Azimuth; once a year, stakes ratchet | `deals.ts:152-162, 245-247`; `actions.ts:348-381` |
| Sovereign politics | "Washington notices: scrutiny +5, Congress −5, security demand +3" | One-off bumps; scrutiny halves every 90 days, security demand drifts back | `relations.ts:46`; `gov.ts:119-120` |
| Anchoring a round | "Anchor partner: None / names" | Raises the dilution cap 8% → 14% (+75% money), any partner, any number of times, no strings, no politics, outside the 3-partner cap; sovereign and chip vendor anchors uncapped | `equity.ts:18, 179-186`; `deals.ts:344-347` |
| Chip-vendor stake | "stake → 37%" (challenger) | Uncapped; the tranche landings are never put to a control vote | `deals.ts:202, 233-238` |

**Jargon left unexplained on the card** (no `Term` or only a code-ish label): "H100e cloud", "expected path" (only via
other terms), "served first", "+0.5 allocation weight", "custom chips at 45% of an H100e", "separate supply pool",
"anchors another lab", "non-voting", "GW online in your own sites" (vs rented cloud, explained only in the tranche
glossary). The glossary entries exist for deal, exclusivity, ipAccess, trancheCondition, firmCommit, firmDiscount,
rescue (`glossary.ts:114-176`) but `deal` is a 120-word wall that restates the card.

**Effects with no preview at all:** the revenue share's growth; which partner would rescue you after you sign
exclusivity; the lapse of tranches you cannot reach (no "reachable?" line); exclusivity outliving the deal; the slot
being used up forever.

---

## 2. The numbers

All $B; V = valuation; R = revenue run-rate per year. "Ceiling" = the plain raise ceiling now. Commit = take-or-pay
total; "vs mkt" = the same contract on Rent compute / Buy chips without the partner discount.

**States.**

| Fixture | Date | V | R | Cash | Runway q | Ceiling | Own GW | Strat stakes |
|---|---|---|---|---|---|---|---|---|
| day0 (leader) | 2025-07-01 | 229 | 12.0 | 40 | 8.0 | 8.6 | 0.47 | Northwind 27% (legacy) |
| day400 (leader, stub) | 2026-08-05 | 92 | 8.4 | 40 | 8.0 | 3.9 | 1.11 | Northwind 27% |
| day900 (leader, stub) | 2027-12-18 | 327 | 21.7 | 55 | 8.0 | 28.4 | 0.83 | Northwind 27% |
| challenger d400 | 2026-08-05 | 34 | 2.4 | 12 | 2.2 (distress) | 0 | 0.07 | Northwind 20% (deal + rescue), Azimuth 5.7% |
| spinout d400 | 2026-08-05 | 245 | 12.6 | 7.8 | 2.6 | 0.1 | 0.00 | Northwind 5.2% (deal, exclusive) |

**Hyperscaler (Azimuth; Northwind is blocked at the leader start by its legacy 27% > 15% cap).**

| Fixture | Choice | Equity now + tranches = total | Tranche conditions | Stake now / all land | Supply | Commit (vs mkt) | 1st-yr commit ÷ R | Rev. share now | Votes |
|---|---|---|---|---|---|---|---|---|---|
| day0 | plain | 6.9 + 6.9 + 6.9 = 20.6 | +1.0 GW by 2 y, +2.0 GW by 2.5 y | 2.9% / 8.3% | 0.78M H100e cloud × 6 y, 13.2→2.2K | 28.8 (32.0) | 0.76× | 1.0/yr | none |
| day0 | exclusive | 25.7 (+5.1) | same | 3.6% / 10.1% | same | 28.8 | 0.76× | 1.0 | none |
| day0 | IP access | 24.7 (+4.1) | same | 3.5% / 9.7% | same; Tarnwick closes ≈9 d/yr of an 86-d lead | 28.8 | 0.76× | 1.0 | none |
| day0 | excl + IP | 29.8 | same | 4.2% / 11.5% | same | 28.8 | 0.76× | 1.0 | none |
| day0 | custom chips | 20.6 | same | 2.9% / 8.3% | 1 GW of ASIC over 8 q at 45% of list | 6.8 (15.0) | 0.33× | 1.0 | none |
| day400 | plain | 5.0 ×3 = 15.0 (tranche floor $5B) | +1.6, +2.6 GW total | 5.1% / 14.0% | 0.98M H100e cloud | 25.4 (28.2) | 0.89× | 0.7 | none |
| day400 | excl / IP / both | 16.3 (bumps cut by the 15% cap; both together add 0) | same | 5.6% / 15.0% | same; IP costs 0 (you are 222 d behind) | 25.4 | 0.89× | 0.7 | none |
| day900 | plain | 9.8 ×3 = 29.4 | +1.3, +2.3 GW total | 2.9% / 8.3% | 2.81M H100e cloud (0.14× compute online) | 49.8 (55.3) | 0.68× | 1.7 | none |
| day900 | excl + IP | 42.6 | same | 4.2% / 11.5% | IP: ≈37 d/yr of a 372-d lead | 49.8 | 0.68× | 1.7 | none |
| challenger | plain (blocked: distress) | 1.2 ×3 = 3.7 | +0.6, +1.6 GW | 9.0% / 15.0% | 0.21M H100e | 5.6 | 0.72× | 0.2 | board: commitments > 3× R, fails 2/10 |
| spinout | Azimuth (blocked: Northwind's exclusivity) | 22.1 plain, 26.5 IP | +0.5, +1.5 GW (spinout owns 0 GW) | 2.9% / 8.3% | 1.27M H100e (2.0× compute online) | 33.7 (37.5) | 0.82× | 1.0 | none |

**Chip vendor (Silica and Corvid are identical).**

| Fixture | Choice | Equity | Conditions (within 12 q) | Stake if all land | Supply | Commit (vs mkt) | 1st-yr ÷ R | Votes |
|---|---|---|---|---|---|---|---|---|
| day0 | plain / excl | 0 now + 10 + 10 = 20 / 25 | own GW 0.47 → 1.5 and 2.5 | 8.0% / 9.9% | 2.15M H100e (2 GW) over 8 q, −5% −5% | 28.6 (30.1) | 1.39× | none |
| day400 | plain | 20 | 1.1 → 2.1, 3.1 | 17.8% | 2.7M H100e | 23.9 (25.1) | 1.61× | none |
| day900 | plain | 20 | 0.8 → 1.8, 2.8 | 5.8% | 3.6M H100e | 21.0 (22.1) | 0.55× | none |
| challenger | plain / excl | 20 / 25 | 0.07 → 1.1, 2.1 | **37% / 42%** | 2.7M H100e (2.6× compute online) | 25.0 | **6.0×** | board fails 2/10 |
| spinout | plain | 20 | 0 → 1.0, 2.0 | 7.5% | 2.7M H100e (4.3× compute) | 24.8 | 1.14× | none |

**Sovereign.** 2.5% of V, $5–25B: day0 5.7 (2.4%), day400 5.0 (5.1%), day900 8.2, challenger 5.0 (12.8%), spinout 6.1.
Politics +5 scrutiny, −5 Congress, +3 security demand. Never a vote.

**Rescue** (computed at each state, as if in distress).

| Fixture | Rescuer | Cash | Stake before → after | What the cash buys | Votes |
|---|---|---|---|---|---|
| day0 | Northwind | 20 (floor; 2× burn = 11.6) | 27.0% → 32.9% | par (already above 30%: no top-up) + 2-vote seat + exclusivity | board 5/5 |
| day400 | Northwind | 13.9 (cap 15% V) | 27.0% → 36.5% | par + seat | board 3/5 |
| challenger | Northwind | 5.1 (cap) | 20.1% → 30.5% | par + seat | board 10/10 |
| spinout | Northwind | 20 | 5.2% → 30.0% | par for 7.5% **plus ~20 points free** (implied post-money $67B vs V $245B) | board 6/6 |

**Revenue share scale.** At the leader's day-0 R = $12B, 8% for 6 years is $5.8B flat, ~$60B if revenue doubles a
year, ~$705B on the reference path the bots are written against (12 × 3.5^t, `plan.ts:350` comment). Against $20.6B
of equity and a $3.2B compute discount.

**Judgement, deal by deal.**
- *Hyperscaler, cloud.* Equity at par (same price as a round) but outside the investor pool and 2.4× (day0) to 3.8×
  (day400) the round ceiling; the commitment is cloud you would rent anyway, 19% below the firm path, and only
  ~1.4× the equity (sourced range 4–12×; FINANCE-BUILD's own open item says 1.1×, `archive/FINANCE-BUILD.md:56`). The
  only real cost is the revenue share, which the card shows at today's size. For a lab whose revenue stays flat it is
  close to a no-brainer; for a lab that grows it is a very expensive loan nobody told you about. Either way the
  decision is made blind.
- *Exclusivity.* For the leader it is free money (+$5.1B): the competitor it blocks (Northwind) is already capped out.
  Its only real cost is hidden (it picks your rescuer, and the rescuer brings IP access).
- *IP access.* +$4.1B for ≈9 days of lead a year against one rival out of five (day0); free whenever you are behind
  (day400, spinout: +$1.3–4.4B for 0 days). Too cheap at the scale the game measures leads.
- *Custom chips.* Same equity as cloud for a commitment one third the size and 55% off the list path (saves $8.3B vs
  $3.2B for cloud) for −15% research for 2.5 quarters. Dominates cloud whenever you have MW, and the partner then pays
  you 3× what you commit to buy from it: the compute-for-equity direction is inverted.
- *Chip vendor.* $10B per GW is ~1/3 of an own GW (building $14B + ~$15B of chips), close to the Nvidia ratio, so the
  size is defensible; but the GW counted are any owned chips, so signing both vendors pays $40B for the same 2 GW (and
  stacks on the hyperscaler's own GW tranches). For a lab without sites (spinout, challenger) it is never worth it
  (1–6× revenue of chips with nowhere to put them); for a small lab that builds, the vendor ends at 37–42% with no vote.
- *Sovereign.* $5–8B at par for a political bump that decays in months: a no-brainer whose only cost is a slot.
- *Rescue.* Price is an accident of the rescuer's old stake: par for the leader (Northwind already holds 27%), a ~73%
  discount for the spinout. No choice of rescuer, no comparison with a down round on the same screen.
- *Anchoring.* Strictly better than not anchoring (+75% round size, no strings): a hidden no-brainer.

**Against the real deals** (research/15 §1.7 and §2.11, research/21 B).

| Real deal | Equity | Commitment / supply | Strings | Game counterpart | Gap |
|---|---|---|---|---|---|
| Microsoft–OpenAI 2019–23, recap Oct 2025 | ~$13B for a capped profit share; now ~27% (~$135B) | +$250B Azure; MS lost ROFR on compute | IP rights to 2032; revenue share until an expert panel verifies AGI | Northwind legacy 27%, strings `{}` (`ledger.ts:27, 43`) | The canonical deal at the leader start has no revenue share, no IP access and no AGI clause |
| Amazon–Anthropic 2023/24/26 | $4B + $4B, then $5B + up to $20B | >$100B AWS over 10 y, up to 5 GW (commit ≈ 4× equity) | Non-voting, capped 12% | Azimuth hyperscaler | Game commit ≈ 1.4× equity, fixed H100e; three successive deals in reality vs "one deal per partner, ever" |
| Google–Anthropic | ≤14.99% non-voting | up to 1M TPUs, >1 GW in 2026 | CMA-cleared, no seat | Azimuth custom chips | Reasonable; but ASIC equity ≫ commitment |
| Microsoft + Nvidia–Anthropic Nov 2025 | $5B + $10B | $30B Azure (2× equity) | — | — | Ratio 2×, game 1.4× |
| Amazon–OpenAI 2026 | $50B ($15B now, $35B conditional on IPO/AGI [U]) | AWS | — | hyperscaler tranches | Real conditions are IPO/AGI; game's are own-site GW, a condition a cloud seller would not set |
| Nvidia–OpenAI LOI Sep 2025 | up to $100B, "progressively as each GW is deployed" (of Nvidia systems) | ≥10 GW | — | Silica: $10B/GW | Good size; game counts any GW, not the vendor's |
| AMD–OpenAI Oct 2025 | **OpenAI receives** warrants for up to 160M AMD shares, vesting by GW and AMD price | 6 GW | — | Corvid "AMD-like (warrants by GW)" | Built as a clone of Silica: the vendor buys *your* equity |
| MGX / QIA / GIC | Large passive cheques inside rounds (Stargate, OpenAI 2026, Anthropic G, xAI E) | — | Washington scrutiny | Gulf Sovereign Fund cheque; also uncapped anchor | Standalone cheque + anchor channel without politics |
| OpenAI Mar 2026 round | $122B, of which $110B from Amazon, Nvidia, SoftBank (90% strategic) | — | — | — | The shape "big money is strategic" is right; the price (lock-in) is missing |

Sizes per tranche ($5–15B) and the 15% non-voting cap are in the sourced range. What is out of range is the
commitment-to-equity ratio, the fixed capacity, the conditions, and the strings' costs.

---

## 3. Do bots and players use them?

Bot policy (`finance/plan.ts:214-227`): RefBot, race, mixed and capex2x take **one** hyperscaler deal from day 92, the
one offering the most equity, cloud, always exclusive, never IP access; prudent bots only if runway after it ≥ the
deal guard. A rescue in distress when runway < 2 q and the largest strategic holder stays ≤ 45% (`plan.ts:187-193,
338-342`). Bots never sign chip vendors, sovereigns, custom chips or IP access, and never anchor a round. The safe bot
takes no deals (`bots/safe.ts:39`).

Five bot games, seed 1, tl-central, to end 2027 (`C:/tmp/corp-audit/botdeals.mts`):

| Bot / start | Deals signed | Outcome |
|---|---|---|
| ref / leader | Azimuth day 92 (excl, $9.2B now, $18.3B tranches, 0.88M H100e, $30.4B commit) → distress day 184 → **Azimuth rescue** day 240 ($15.1B, 2 votes, exclusivity, IP access to Tarnwick). Both GW tranches lapsed. | alive, distress again day 914; Azimuth 18% |
| mixed / leader | Azimuth day 92 → rescue day 184 → **second rescue** day 570 | ousted day 915; Azimuth 18% |
| race / leader | **rescue** by Northwind day 92 ($25.5B) | ousted day 366 |
| capex2x / leader | none (distress before day 92 blocks offers; no rescue by policy) | insolvent day 305 |
| ref / challenger | Northwind **rescue** day 180 ($18.6B) and day 549 | ousted day 550; Northwind 34% |

The challenger and spinout fixtures show the same: Northwind signed exclusive at day 92 in both; the challenger was
rescued one quarter later. In these runs **the rescue is the most-signed deal** and the voluntary deal's tranches
lapse. The calibration target F8 requires the RefBot to take a strategic deal in 2026 and the no-deal path to hit
distress by Q1 2027 (`balance/targets.ts:471-503`): deals are tuned as a required escape valve, not a choice.

No existing balance summary reports partner use beyond F8 (grep of `balance/`, `design/bal/`): only B5-QUESTIONS F3
flags that the 10%/yr IP-access figure is unsourced (`design/bal/B5-QUESTIONS.md:111`).

---

## 4. Fit

**How deals connect to the rest of the game.**
- *Compute:* one firm cloud contract or one chip order through the ordinary order code (`addCloud`, `placeOrder`),
  10% / 5% cheaper; a chip vendor adds +0.5 allocation weight while it supplies (`market.ts:236`); ASIC is a separate
  supply pool. The partner never behaves differently from the Rent/Buy cards except the discount.
- *Rivals:* only IP access, and only via the one big-tech NPC (`deals.ts:57-62`); rivals have no partners, so
  "anchors at most one lab, rivals compete for them" (spec §6.1) is unbuilt and its blocker dead.
- *Politics:* the sovereign's three one-off bumps; nothing for a hyperscaler (antitrust is a constant 15% cap).
- *Board:* votes almost never trigger (none at any healthy fixture; commitments stay < 3× R); a rescue adds a 2-vote
  seat; PBC + trust votes on sale of control and capability-threshold IP.
- *Products/customers:* nothing. Real hyperscaler deals are as much distribution (Azure OpenAI, Bedrock, Vertex) as
  money; the game's products sphere never sees a partner.

**Where it feels bolted on.**
- Sign once, then nothing: a partner never asks, offers, renegotiates, withholds a tranche or reacts to your success
  or failure. It is a lump of cash plus a contract, exactly like a round plus Rent compute.
- The conditions are not what the partner wants: a cloud seller pays you for building your *own* data centres; a chip
  vendor pays for GW of anyone's chips.
- The costs that matter (revenue share, exclusivity, IP) are flat parameters shown at today's size, not consequences
  that grow with what you become ("consequences over flat numbers").
- Three partner channels (deal, anchor, rescue) with separate rules, placements and caps; the cheapest (anchor) has no
  strings at all.
- The cast is static and US-centric, and the fixed list order decides who rescues you.

**Real dynamics that matter for this game's shape and are missing.**
1. *Compute-for-equity as a loop that scales with you:* commitments in dollars that buy growing capacity (Amazon "up to
   5 GW"), follow-on rounds from the same partner (Amazon–Anthropic three times), the partner's money coming back as
   its revenue (FTC 6(b) §4.3: lowers the partner's downside).
2. *Leverage and dependence:* the more of your compute one partner supplies, the more it can dictate (priority, price at
   renewal, exclusivity, ROFR). Today dependence is free.
3. *Diverging interests:* the partner's own lab (MAI, Gemini, Nova) races you; IP access is its bridge "until our own
   model is competitive" (R21 B4). As its lab nears you, the partner's value of you falls; as you near AGI, the
   AGI clause matters. Neither exists.
4. *Renegotiation:* MS–OpenAI 2023 (board crisis), Jan 2025 (exclusivity → ROFR), Oct 2025 (recap: equity for terms).
   A renegotiation is where a deal becomes a story; the game freezes it (`ledger.ts:40` "after the 2025 renegotiation").
5. *Distribution:* the partner sells your models to its customers (revenue, but also parity clauses).
6. *Control:* rescues and supplier stakes as a route to a controlling owner; antitrust as the limit for a hyperscaler.

**Current pieces that are junk.**
- `anchors` and the "already anchors another lab" blocker (never set for a rival; `ext.ts:34`).
- Corvid Micro as an "AMD-like warrants" partner that is a Silica clone (`deals.ts:28`).
- "Served first in a shortage" as a hyperscaler benefit (all firm cloud is; `market.ts:378-384`).
- The legacy Northwind deal record with empty strings (`ledger.ts:43`): a deal that does nothing but block.
- The tranche floor `trancheMin: 5` producing $15B for a $92B lab and $3.7B (cap-limited) for a $34B one
  (`deals.ts:47`, day400 vs challenger rows).

**Interactions with the corporate-structure rework (noted, not designed).**
- A holder above 50% no longer ends the game, and partners can become controlling owners. Today three paths raise a
  partner's stake without any control vote after signing: repeated rescues (one a year, each topping up to ≥ 30%;
  bots stop at 45% only by their own rule), chip-vendor tranches (uncapped, 37–42% at the challenger), and sovereign /
  chip-vendor round anchoring (cap = 100%, `equity.ts:183`). `dealVotes` reads only the stake after the cheque now.
- Hyperscaler stakes are capped and non-voting by antitrust (R21 B2); "a hyperscaler becomes the controlling owner" is
  then an acquisition with its own rules, not a bigger deal.
- Founder-led: a rescue seat (2 votes) and forced votes (`voteGate`) are where founder control meets partners.
  Mission-controlled: the trust's capability-threshold IP vote. Division: no partners (`divisionBlock`). Public
  company: anchors and sovereign cheques become ordinary market participants.
- The leader start is the MS–OpenAI case: a 27% strategic holder whose real terms (revenue share, IP to 2032, AGI clause)
  are exactly the kind of owner leverage the rework wants; today it holds none of them.

---

## 5. Findings

1. **Revenue share is the biggest cost and is shown at today's size.** 8% of all revenue for 6 y; $5.8B flat, ~$60B at
   2×/yr growth, ~$705B on the reference path, vs $20.6B equity (day0). `actions.ts:292`, `cashflow.ts:90`. ·
   **unclear + unbalanced** · Show it as what it is (a share of future revenue, with a projection) and size it against
   the equity, or replace it with a consequence that scales with the relationship.
2. **The commitment is ~1.4× the equity, not 4×; capacity is a fixed H100e count.** Sized at today's price, paid on a
   path falling 8%/q (`deals.ts:182-183`); 0.65× compute online at day0, 0.14× at day900. Sourced 2–12×. Already an
   open item (`FINANCE-BUILD.md:56`). · **unbalanced** · Commit dollars (or GW) that grow with you, at the sourced
   ratio.
3. **Custom chips invert compute-for-equity.** Same equity, commitment one third the size, saving $8.3B vs $3.2B for
   cloud (day0). `deals.ts:51, 175-177`. · **unbalanced** · Tie the equity to the commitment whatever the supply.
4. **Tranche conditions are the wrong shape and mostly lapse.** A hyperscaler pays for your own-site GW; chip vendors
   pay for any GW, so both vendors (and the hyperscaler) count the same 2 GW ($40B+). RefBot's Azimuth tranches lapsed.
   `deals.ts:188-189, 202`. · **wrong** · Condition each partner on what it sells (its cloud used, its chips
   deployed) or on the sourced IPO/AGI/governance events.
5. **Exclusivity is free money with a hidden effect.** For the leader it blocks an already-capped Northwind (+$5.1B, no
   cost), lasts forever (`vetoesOf` ignores `until`), and silently makes Azimuth (with IP access) your rescuer.
   `deals.ts:29-36, 245-247`. · **unbalanced + unclear** · Make exclusivity cost something visible while it runs, end
   with the deal, and show its effect on rescue.
6. **IP access is too cheap and free when behind.** +$4.1B for ≈9 d/yr against one rival (day0); +$1.3–4.4B for 0 d
   when behind; the 10% is unsourced (B5-QUESTIONS F3). `shocks.ts:106-118`. · **unbalanced** · Price it as the
   partner's lab catching up in products and capability, with the future cost previewed.
7. **The sovereign cheque is a no-brainer.** $5–8B at par for bumps that decay in ~90 days (`relations.ts:46`). ·
   **unbalanced** · A political consequence that persists (or a real string), or fold sovereigns into rounds.
8. **Anchoring a round is a hidden no-brainer and a back door.** +75% round size (8% → 14% dilution), no strings, no
   politics, outside the 3-partner cap, uncapped stakes for sovereigns and chip vendors. `equity.ts:18, 179-186`. ·
   **junk (as a separate channel)** · One partner channel: anchoring is a partner deal or it is gone.
9. **Rescue terms are arbitrary.** Rescuer = first name in a fixed list; price = par for the leader, a ~73% discount
   for the spinout, depending only on the rescuer's old stake; IP access comes along for Azimuth; repeatable yearly.
   `deals.ts:152-162, 245-247`. · **wrong + unclear** · Rescue priced by distress (a down round with strings), offered
   by whoever wants you, on the same screen as the down round.
10. **Rescue is the deal bots actually sign.** 4 of 5 bot games used a rescue by end 2027, three of them died anyway;
    F8 requires deals to avoid distress (`targets.ts:471-503`). · **unbalanced** · Judge after items 1–2; a deal
    should be a choice the bot weighs, not the escape valve calibration needs.
11. **"3 partners at once" means 3 ever; one deal per partner ever.** `deals.ts:52-55, 100`; glossary says "at once";
    the game runs to 2050. Real partners sign again and again. · **wrong** · Count running deals; allow follow-ons and
    renewals.
12. **Partners never act after signing.** No follow-on, renegotiation, leverage, divergence or reaction to your lead or
    distress; the legacy MS-like stake has no strings (`ledger.ts:43`). · **wrong (missing core dynamic)** · Give each
    partner a simple interest (its own lab, its cloud revenue, its chips sold) that moves its offers and terms; NPC-simple.
13. **Rivals have no partners; anchors are dead code.** Only `'player'` is ever written (`ext.ts:34`); no partner
    logic in `rivalFinance.ts`. · **junk** · Remove, or give rivals simple partner ties so the landscape is visible.
14. **Corvid Micro is a Silica clone labelled as the AMD warrant deal.** `deals.ts:28`. · **junk** · Drop it, or model
    the inverse shape (the vendor pays you in its stock for buying its chips).
15. **Partner cloud is a firm Rent contract at 10% off.** "Served first in a shortage" holds for any firm cloud
    (`market.ts:378-384`). · **junk (as a benefit)** · Stop listing it; give partner supply something a Rent card
    cannot get (capacity you cannot rent, a ramp).
16. **Previews do not match effects.** Stake → 8.3% on the card (all tranches at today's V) vs 2.9% used by the
    votes, tranches at that day's V; no reachability for the GW conditions; no rescuer change shown.
    `Finance.tsx:841`, `deals.ts:221-227`. · **unclear** · One stake number with "if the tranches land", a reachable /
    not reachable line, and every string's future cost.
17. **Control can pass to a partner with no vote.** Rescue ratchet, chip-vendor tranches (37–42% at the challenger),
    uncapped anchors; votes read only the cheque now (`deals.ts:233-238`). · **wrong (for the corp rework)** · Every
    path that raises one holder's stake is judged at the stake it will reach.
18. **Three homes for partners with three rule sets.** Deals tab, Rescue on the Raise card, Anchor on the Raise card;
    the card's `gives`/`wants` strings and the 120-word `deal` glossary are dense jargon ("served first", "+0.5
    allocation weight", "separate supply pool", "expected path"). · **unclear** · One Partners home, each partner shown
    as what it wants from you and what it gives, in player words.
19. **Hyperscaler tranche floor distorts by size.** `trancheMin: 5` gives a $92B lab 14% for $15B; the cap leaves a
    $34B lab $3.7B. `deals.ts:47`. · **unbalanced** · Size from the commitment and the partner's appetite, not a floor.
20. **Deals never meet the board.** No vote at any healthy fixture (commitments < 3× revenue); only the distressed
    challenger hits the commitments vote. · **unclear (low)** · Fine if intended (operating decisions are not voted);
    revisit with the corp rework's owner rights.
