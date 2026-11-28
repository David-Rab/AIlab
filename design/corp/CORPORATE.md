# Corporate structure, partners and lab kinds (draft for review)

Started 2026-11-28 with the designer. Inputs: the code inventory (summarised in §9), [DEALS-AUDIT.md](DEALS-AUDIT.md),
research/15 §1.6–1.7, research/18 §3, FINANCE-V3 §6–§7 and §13, and the outside world as merged
(design/world/OUTSIDE-WORLD.md, world/usgov.ts). Branch `corp` was rebased onto master 7ce0ad7e (outside world merged).

## 0. Designer's decisions (2026-11-28)

- Three things were tangled together. **Structure** is who controls you. **Ties** are your partners. **Position** is
  where you start, and it sets the difficulty. A **lab kind** bundles all three, and Custom lets you mix them.
- **Structures:** founder-led, mission-controlled (nonprofit and trust are ONE structure), division of a parent, public
  company, and (added the same day) government-controlled. Structures **change during play.**
- **A holder above 50% does not end the game.** A change of owner limits what you can do and changes how the company
  works. You lose control only when the company is **dissolved** (for example, folded into another AI company) or when
  you, the **CEO, are dismissed**.
- **Nationalization isn't the end either.** The lead lab stays in control under a **government-controlled** structure.
  The same structure later serves China's lab.
- Some lab kinds start with partners.
- Partners and deals get real work. Today they are opaque, unbalanced and don't fit the game (§5).

## 1. The model: charter + cap table → board → structure

Today a preset id picks a board, a few special rights and two flat numbers. In the new model three things are stored, and
everything else is derived from them.

**Charter**: the company's own rules. Only a named decision changes it.
- `missionBody`: a nonprofit or trust that appoints a majority of the board. Present or absent.
- `profitCap`: investors' returns are capped (the OpenAI 2019–25 kind). Only a lab with a mission body can have one.
- `dualClass`: founders' shares carry ×10 votes. It is chosen at IPO, as today.
- `listed`: the company is on the stock market.

**Cap table**: who owns how much. These are today's fields: founder, mission, fin, strat{}, public.

**Votes**: the cap table weighted by share class.
- Founder shares count ×10 when `dualClass` is set.
- A hyperscaler's stake has no votes while it is at or under its 15% cap. This is sourced: Class N, Amazon 12%, Google
  14.99%.
- Every other share has one vote.

### 1.1 Structure: the first of these that holds

| # | Structure | Rule | Real analogues |
|---|---|---|---|
| 0 | **Government-controlled** | The US government took control (DPA consolidation accepted, or the hard path; §2.4) | AI 2027's oversight committee over the leading lab; later China's lab |
| 1 | **Division** | One corporate holder (a parent or a partner) has more than half the votes | GDM, Meta AI, MS AI; Waymo (majority-owned) |
| 2 | **Mission-controlled** | `missionBody` is set | OpenAI (both eras), Anthropic |
| 3 | **Public company** | `listed` | Meta (dual-class), any widely held listed lab |
| 4 | **Founder-led** | everything else (private) | xAI, SSI, Thinking Machines |

A listed mission lab shows as "Mission-controlled · listed". The structure is recomputed whenever the cap table or the
charter changes. It is never stored separately, which removes today's two conflicting checks for "is this a division".

### 1.2 The board follows from charter and votes (one function, every structure)

- The board has **7 seats**. Up to 2 critics' seats can be added on top, as today, so at most 9.
- **The controller appoints 4 seats** (the majority):
  - the mission body, in a mission-controlled lab;
  - the parent, in a division;
  - the founders, while they hold more than half the votes;
  - otherwise nobody, and all seats are shared out by votes.
- The remaining seats are shared out by votes, largest remainder first, among founders, financial investors, each
  strategic holder that has votes, and the public. Public holders' seats are **independents**, per listing rules.
- The CEO always holds one seat, and it always votes yes.
- Seats are recomputed whenever a round, deal, IPO, rescue or merger closes. A vote preview shows the board as it would be
  after the deal.

This one function replaces all of these: `initialBoard` presets, `syncFinancialSeats` (founder-only, 15/30/45%), the
challenger's extra "Investor 2", the hand-made "Listing independent" seat, and the rescue's `addSeat`.

The seat priorities (the stance vectors), the vote rule, board confidence, the warning and the ouster all stay as they
are.

### 1.3 Rights: consequences of the charter and votes, not presets

| Right | Who has it | What it does | Replaces |
|---|---|---|---|
| **Founder control** | Founders hold more than half the votes (by shares or dual-class) | You can push through a decision the board voted down, at −20 confidence. The reason: they could replace the board | `preset === 'founder'`; dual-class under any preset (bug 5) |
| **Mission veto** | A mission body | It holds a vote that can't be forced on any holder passing 50%, and on handing out a capability-threshold model (open weights or an IP licence). Its safety committee halts the release of a red-flagged model | the trust (pbcTrust only) and the committee (nonprofitPBC only) |
| **Controller's goals and budget** | The controller: a parent in a division (§2.3), the government under government control (§2.4) | It sets yearly goals and the budget | `preset === 'parent'` checks |

**Removed:** "nonprofit removal ×0.5". The mission seats' priorities already make them turn on a reckless CEO and protect
a careful one. A flat multiplier for one preset is a special case with no mechanism behind it.

### 1.4 Investor appeal comes from the charter

- **Investor appeal** today is the flat table GOV_FACTOR (legacy 0.6, nonprofit + PBC 0.9, PBC + trust 1.0, founder 1.1).
  It becomes a product of charter features:
  - profit cap ×0.67, so a legacy lab gets 0.6 as now. Source: SoftBank's $30B round conditional on the cap being lifted
    [R15];
  - mission body ×0.9 [R15];
  - dual-class ×0.95, as now;
  - otherwise 1.0. The founder's 1.1 is dropped: R15 gives 1.1 for growth money but 0.8 for "responsible" money, so the
    two cancel to about 1.
- **Rival labs** use the same functions on their own charter. RIVAL_GOV maps each kind to a charter, not to a preset id.

## 2. What each structure offers and makes hard

Everything in this table is an existing system: votes, confidence and ouster, the investor story, the parent budget,
the charter release gate, partners.

| | Founder-led | Mission-controlled | Public company | Division |
|---|---|---|---|---|
| **Money** | Rounds through the investor story; full appeal | Rounds at ×0.9; a profit cap makes large rounds conditional until it's lifted | The public pool (IPO bump), bonds; quarterly results matter | The parent's budget; no raises, deals or debt of your own |
| **Board** | Founders, investors, independents; investor seats grow as you sell shares | The mission body's 4 seats protect a careful CEO and turn on a reckless one | Independents and institutions; the board weighs results | The parent's 4 seats: speed and money |
| **Your freedom** | Founder control while founders hold the majority; it fades as you sell shares | The mission veto on sale of control, releasing dangerous models, and red-flagged releases | Founder control only with dual-class | Parent goals; the parent's competitors are off limits |
| **How you lose** | Ouster, insolvency | Ouster, insolvency | Ouster, insolvency | Dismissal by the parent, being folded into the parent's lab (§2.3) |
| **Can become** | Public (IPO); division (a holder passes 50%) | Listed; profit cap lifted; division only with the mission body's yes | Division (a takeover past 50%) | none (spinning out is out of scope) |

### 2.1 Changes during play: every one is a named decision or an event, with its preview

| Change | How it happens | Votes | Cost and gain |
|---|---|---|---|
| **IPO** | The `fin.ipo` action, as today | none | As today. Dual-class keeps founder control |
| **Lift the profit cap** (was "recapitalise") | Action, available only with `profitCap` | none | About 4 quarters of state Attorney General review, safety-staff morale −3 (the old scrutiny cost went with the outside-world rewrite). Afterwards the conditional tranche is paid. The mission body stays: OpenAI's 2025 recap kept nonprofit control |
| **A holder passes 50%** | A rescue top-up, partner tranches, an anchor round, stock paid for a merger | The mission body (if any), then the board. **Every path** that can cross 50% goes through these votes (fixes bug 13: today tranches cross with no vote) | Structure → Division (§2.3) |
| **Founder control lost** | Emergent: founders drop below half the votes | none | Shown ahead in every raise preview: "after this round founders hold 46% of votes: founder control ends" |
| **Leave mission control** | **Not offered** (decision Q2) | — | Precedent: state AGs stopped OpenAI's attempt to drop nonprofit control (May 2025); Anthropic's trust needs board and stockholder supermajorities to change |

### 2.2 Endings that remove control

| Ending | Trigger | Status |
|---|---|---|
| **Ousted** | The board's ouster vote (as today); in a division, the parent's dismissal (§2.3); under government control, the government's (§2.4) | extended |
| **Dissolved** (new; replaces "acquired") | The controller folds you into its own lab (§2.3) | new |
| **Insolvent** | As today (never a division) | kept |
| **Nationalized** | Only when you are **not** the frontier lab when the government takes control: your lab is folded into the national project (a kind of dissolved). When you lead, it becomes government control instead (§2.4) | changed |
| ~~Acquired~~ | A holder above 50% | **removed**; it becomes the change to Division |

The "Independent at the end" scoring bonus is read off the structure at the end. A division always scoring −40 on the
company axis (its valuation is 0) is wrong and gets fixed. It's scored on the parent's valuation of it (§2.3) or not on
valuation at all (to decide in the build).

### 2.3 The division, unified

There is one division model whether you start as one (big tech) or become one (a partner passes 50%).

- **The parent** is one of the partners (data/v2/deals.ts PARTNER_DEFS), so parents and partners become one system. The
  big-tech start's parent is a partner with its own in-house lab (Azimuth today). See decision Q5.
- **Budget:** each year's budget is the parent's plan × min(1, 0.5 + confidence ÷ 120), as today.
  - A lab that starts as a division uses today's plan ($16B growing with the parent's capex path).
  - A lab that becomes one takes its last four quarters of spending as year 0, then grows on the same path.
  - Cash on hand at takeover stays, and minority holders stay on the cap table.
- **Goals, reviews and overspend:** as today.
- **New: the parent can dismiss you.** At confidence below 25 for two reviews, the parent replaces the division head
  (ousted). research/18 §3.2 already proposed this (the Meta Jun 2025 reorg). Without it a division is a haven, and
  selling control would be an escape from an ouster.
- **New: folding in (dissolved).** A parent with its own lab folds you into it when it dismisses you and its lab is
  ahead of you (Brain + DeepMind, 2023).
- **The parent's own lab** gets IP access to your models for as long as it controls you (it already would through a
  rescue).

### 2.4 Government control (new; replaces the nationalized loss for the lead lab)

**Today, after the outside-world merge** (world/usgov.ts):
- **Stage 4 consolidation:** E22 offers the frontier lab DPA consolidation when the government's trust is above its soft
  line. Accepting pools 50% of every US NPC lab's compute into you as free cloud capacity (`dpaAccepted`), and nothing
  else changes.
- **The hard path:** trust stays low past the hold time at stage 3 or above, or a misalignment leak raises public concern.
  This sets `consolidated = 'nationalized'`, which is the loss ending.
- The epilogue already reads "DPA + low trust at ASI" as the government holding power.

**New:** both paths make you **government-controlled**, the same controlled model as a division (§2.3) with the
government as the controller.

| | DPA accepted (soft) | Hard path (taken) |
|---|---|---|
| **When** | You accept E22 | Low trust past the hold time, or the leak scare |
| **You are the frontier lab** | Government-controlled; you stay CEO | Government-controlled; you stay CEO, starting at low confidence (on probation) |
| **You are not the frontier lab** | (E22 is only offered to the frontier lab) | Folded into the national project: the **nationalized** loss (a kind of dissolved) |

- **The controller's confidence** is the government's trust (`usgov.trust`). One meter; it is already shown and moves on
  named causes.
- **Board:** an oversight committee holds 4 of 7 seats. It leans toward security and safety, and its stance vector is a
  new row (§1.2). The other seats follow the votes, as before, because the cap table stays and the shareholders remain.
- **Money:** you keep your revenue and cash. The pooled compute is the government's contribution, and there is no outside
  equity, sale of control or deal without the committee's yes. Whether it also pays a budget, like the parent, is
  decision Q11.
- **Goals:** security level (the WSL floor it already checks), staying ahead of China (`chinagov`), and no incidents.
  These use the same goals and reviews mechanism as the parent.
- **Dismissal:** at trust below the dismissal line for two reviews, the government replaces you (ousted). This is how a
  distrusted CEO loses control.
- **No way out:** the government doesn't hand a frontier lab back (out of scope).
- **China's lab later:** the same controlled structure with the Chinese state as controller. The NPC headline lab only
  needs the label and the shape (NPC-simple). Not in this workstream.

## 3. Lab kinds and setup

### 3.1 Position (start situation) is separate from structure

The four rows in `STARTS` lose their `board`, `ownership` and `leaderLab` fields and become positions:

| Position | Difficulty (from bots) | Cash, compute, team, products, model lag |
|---|---|---|
| Frontier | Easy | today's leader values |
| Near frontier | Hard | today's challenger |
| Big-tech scale | Impossible (re-measure) | today's big tech: owned campuses, distribution, products |
| From scratch | Impossible (re-measure) | today's spinout: an imported open-weight model, no product |

Scattered per-start knobs become fields of the position row: START_CREDIBILITY, START_EXPLOIT_MULT, PROVIDER, the
spinout's cloud end date, the credit-line branch, followerOpts. The leader row stops being display-only (inventory item 6).

### 3.2 Lab kinds: one table (names invented, analogues in tooltips)

| Kind | Like | Structure | Ties at the start | Position |
|---|---|---|---|---|
| Frontier leader | OpenAI 2025 | Mission + profit cap | Northwind ~27% (the old stake, renegotiated) | Frontier |
| Safety-first challenger | Anthropic 2025 | Mission (trust) | Azimuth ~14% (cloud + custom chips) | Near frontier |
| Founder racer | xAI 2025 | Founder-led | (none, or a sovereign cheque) | Near frontier |
| Big-tech division | GDM 2025 | Division of Azimuth | (the parent) | Big-tech scale |
| Well-funded spinout | SSI, TML | Founder-led | none | From scratch |
| Custom | — | choose: founder-led / mission / mission + cap | choose any partners allowed | choose |

Each kind carries its own cap table. This fixes the leader always starting with a 26% mission holder, which today
happens even under "Founder control". Picking a kind fills the Custom fields, so there's no stale governance value
(fixes bug 2).

### 3.3 Setup screen

- The first row is the lab kind. Selecting Custom opens structure, position and partners beneath it.
- The world settings follow.
- Every option has a description and a tooltip. Today "Nonprofit + PBC" and "PBC + trust" have none.
- MEDIUM.md A3's wider flow (Scenario → Lab kind → Custom, Storyteller and Tutorial moved to options) is **not** part of
  this workstream unless the designer adds it.

## 4. On screen (Finance → Board card)

- A header line gives structure, controller and rights: "Mission-controlled · Foundation appoints 4 of 7 · Mission veto ·
  Profit cap".
- **"Who controls you"** is one compact row: votes by holder, the 50% line, and what changes if anyone crosses it. Every
  raise, deal or merger preview shows the after-state of this row. It is the only home for voting control; the ownership
  donut stays the home for economic shares.

## 5. Partners and deals

### 5.1 What the audit found (DEALS-AUDIT.md §5; numbers are the engine's own offers at the fixtures)

- **The biggest cost is hidden.** The 8% revenue share runs 6 years on *all* revenue, but the card shows it at today's
  size ("$1.0B/yr"). Against $20.6B of equity it comes to about $6B if revenue stays flat, about $60B at 2× a year, and
  about $705B on the reference path.
- **Compute-for-equity is the wrong size and shape.**
  - The commitment comes to about 1.4× the equity, against the sourced 2–12×: it's sized at today's price, for a fixed
    H100e count, on a falling price path.
  - With custom chips the partner puts in 3× what you commit to buy from it.
  - Tranches pay you for GW you bring online, not for what the partner sells you. A cloud seller pays you to build your
    own sites, and two chip vendors both pay for the same 2 GW.
- **Most strings are free money.** Exclusivity (+$5.1B for the leader) blocks a competitor that is already at its cap,
  and it never ends. IP access costs about 9 days of lead a year, and nothing at all when you're behind. The sovereign's
  political cost faded within about 90 days, and since the outside-world merge it has none at all. Anchoring a round adds 75% to its size with no strings and bypasses the
  partner limit.
- **Rescue is arbitrary, and it's the one deal bots actually use.**
  - The rescuer is simply the first name in a fixed list.
  - The price runs from par to about 73% off, depending only on the rescuer's old stake.
  - It's repeatable every year.
  - In 4 of 5 bot games the bot took one, and 3 of those 4 died anyway.
- **Partners do nothing after signing.**
  - No follow-ons, renegotiation, leverage or diverging interests.
  - "3 at once" is really 3 for the whole game.
  - Rivals have no partners, so the "anchors one lab" rule is dead code.
  - The leader's Microsoft-like 27% stake has none of its real strings.
- **Control passes with no vote.** Repeated rescues, chip-vendor stakes with no cap (37–42% at the challenger) and anchors
  with no cap all raise a holder's stake. The votes only look at the cheque paid at signing.
- **Junk:**
  - Corvid Micro (a copy of Silica, although the real AMD deal ran the opposite direction).
  - "Served first in a shortage" (every firm contract already gets it).
  - The tranche floor (a $92B lab gets 14%; a $34B lab gets $3.7B).
  - Partners live in three places with three rule sets.
  - The 120-word jargon glossary entry.

### 5.2 The rework: a partner is a company that wants something from you

**Cast (NPC-simple):**
- two hyperscalers: Northwind (Microsoft-like) and Azimuth (Google/Amazon-like, with an in-house lab);
- one chip vendor: Silica (Nvidia-like).

Corvid goes. Sovereigns stop being partners and become a kind of investor in a round (§5.2.6).

Each partner has **one interest**. It's shown in player words and moves its offers:

| Partner | Wants | Values you more when | Values you less when |
|---|---|---|---|
| Hyperscaler | Your compute spend on its cloud, and your models for its customers | You spend more of your compute on it; your models sell through it | Its own lab gets close to you (hyperscalers with a lab); you lean on its competitor |
| Chip vendor | Its chips deployed at scale | You deploy its chips | You buy custom chips from a hyperscaler |

**1. One deal shape: equity for a compute commitment, in dollars.**
- The partner invests E. You commit to spend C = 4 × E (sourced 2–12×) on its supply over the deal, whether you use it or
  not. This is the existing "take-or-pay" commitment.
- Because C is in dollars, the capacity it buys grows as prices fall.
- Custom chips are a supply option within the same dollar commitment, so there is no inverted trade.
- Tranches are conditioned on **what the partner sells you**: "after $X of the commitment is spent". No more GW
  conditions.
- The size comes from the partner's interest and your compute plan. The $5B floor goes.

**2. The revenue share becomes distribution (recommended, decision Q6).**
- The partner sells your models to its cloud customers. That's a channel that adds reach for API and enterprise products,
  like Azure OpenAI, Bedrock and Vertex.
- It takes a share of **that channel's** revenue only.
- The preview shows the channel's projected revenue and the partner's cut over the deal.
- The leader's legacy Northwind stake keeps its real all-revenue share, shown with the same projection. That's its one
  real string.

**3. Strings that cost something visible and end with the deal.**
- **Exclusivity:** no deals with the partner's competitor *while the deal runs*. The preview names the blocked competitor
  and what that competitor would offer today. It disappears when the competitor has nothing to offer.
- **IP access:** the partner's own lab licenses your models for as long as the deal runs. The preview gives the cost in
  lead: "Azimuth's lab ends about 4 months closer to you". That needs a sourced rate (finding 6); until there is one, it's
  marked [D].

**4. Partners act, rarely.**
- **When a deal ends**, the partner offers a renewal. Its terms come from its interest: better when it values you,
  tougher when you depend on it. "Dependence" means the share of your compute it supplies.
- **Follow-on offers** appear as an action, not an event, when its interest is high (Amazon invested in Anthropic three
  times). There are no nags.
- **Count running deals**, not deals ever signed. One running deal per partner.

**5. Rescue: a distressed round with strings, on the same card as the down round.**
- It's offered by the partner that values you most, not by list order.
- It's priced by your distress (like a down round), plus a board seat and the partner's strings.
- Every rescue goes through the control votes. A rescue that crosses 50% makes you that partner's division (§2.3).

**6. Every path that raises one holder's stake is judged at the stake it will reach (fixes finding 17).**
- **Hyperscaler and chip-vendor stakes are capped at 15% with no votes** (antitrust, sourced). The only way past the cap is
  a rescue or an acquisition. Both go through the control votes and an antitrust review (a US-government trust cost; scrutiny no longer exists after the outside-world merge).
- **The separate anchoring channel is removed.** A round is either a round or a partner deal.
- **A sovereign is an investor type within a round.** It makes the round bigger. Its political cost (a standing cost in
  the US government's trust, `usgov.trust`) lasts **as long as it holds its stake**, instead of fading.

**7. Rivals:** drop the dead "one lab per partner" rule. Rival cards show a backer label only (simple background, no
mechanics).

**8. One home.**
- A Partners card in Finance has one row per partner: what it wants, what it gives you, how much it values you, your
  dependence on it, and its running deal with the terms still to come.
- Rescue sits on the distress card beside the down round.
- The jargon glossary entry is rewritten in player words. Every string's future cost appears in the preview, and the
  preview's stake number is the one the votes use.

### 5.3 Balance check (at the checkpoint)

- With the audit's offer script (C:/tmp/corp-audit/offers.mts), no deal is free money, and none is never worth taking.
- On the bots, a deal is a choice they weigh, not the escape valve calibration needs.
- Target F8 (deals help avoid distress) is re-judged after the rework.

## 6. Decisions for the designer

1. **Public company:** a structure for "listed without a controller", with founder control or a mission body carried
   over as rights? (Recommended.)
2. **Leaving mission control:** not offered (recommended; real precedent), or offered as a decision needing the mission
   body's own yes?
3. **Divisions can be lost:** the parent dismisses you below 25 confidence for two reviews, and a parent with its own lab
   folds you in? (Recommended. Otherwise a division is a haven, and selling control escapes an ouster.)
4. **Becoming a division:** one division model (the budget replaces raises; minority holders stay)? (Recommended.)
5. **The big-tech start's parent is a partner** (Azimuth, which has an in-house lab), so parents and partners are one
   system? Then that NPC in-house lab is you, and the cast loses its separate big-tech lab while you play it.
6. **Revenue share becomes distribution:** the partner sells your models through its cloud and takes a cut of that
   channel only (recommended). The alternative is keeping the all-revenue share, shown with a projection.
7. **Sovereigns become an investor type within a round**, with a political cost that lasts while they hold their stake
   (recommended), instead of being a partner kind.
8. **Partners act:** a renewal at the end of a deal, follow-on offers as actions, terms that follow the partner's
   interest and your dependence on it (recommended). Or keep partners static and only fix the sizes and previews.
9. **Remove** Corvid Micro, round anchoring as its own channel, and the dead "one lab per partner" rule (recommended).
10. **Government control:** the soft path (E22) and the hard path both lead to government control while you are the
    frontier lab. The hard path starts you on probation. If you are behind, the hard path folds you in (the nationalized
    loss). (Recommended.)
11. **Government money:** the pooled compute only (recommended: what the merged code already does), or also a yearly
    budget like a parent's?

## 7. Cleanup (last task of the build)

Delete: GovernancePresetId and every preset string, GOV_FACTOR and GOV_SCORE as preset tables, `OUSTER.legacyMult`,
`syncFinancialSeats`, the "Listing independent" literal, the `endingProgress.soldControl` flag and the 'acquired' ending, the
never-created 'gov' seat kind, the never-produced 'ipo' tranche condition, the citations of the non-existent events E02
and E26, `issueWarrants`' copy of `issue()`, the `leaderLab` field and the stale `setup.leaderLab` comment, BOARD_LABEL
and the other duplicated label tables (one source), and the dead "trust notified of new debt" log. Fix the hubView
$B ÷ 1e9 display. Check that financing leases are blocked for a division.

## 8. Build order (to cut into tasks after the decisions)

1. Charter + votes + structure + `boardOf`, replacing presets (engine; save break).
2. Rights (founder control, mission veto, parent) and the removal of 'acquired'; dissolved and dismissal; every
   50%-crossing path behind a vote.
3. The unified division: becoming one; the parent as a partner.
4. Positions + lab kinds + setup.
5. Partners and deals rework (§5).
6. Board card UI ("who controls you"), previews, glossary.
7. Re-measure difficulty labels (bot runs at the checkpoint only).
8. Cleanup (§7).

## 9. Inventory summary

The site-by-site inventory (file:line for every site) was a read-only survey on 2026-11-28; the facts that shape this plan:
- **The recap is the only structure change today.** It rewrites `preset` in place and leaves ownership unchanged.
- **Bug 1:** a refused recap still adds a 'recapitalisation' condition to every later large round, and it can never be met.
- **Bug 2:** picking Big tech and then Leader in setup leaves `governance: 'parent'` on a leader game.
- **"Division" has two sources of truth:** `isDivision` reads the start, `noOuster` reads the preset.
- **Bug 13:** partner tranches and anchor rounds can push a holder past 50% with no vote, ending the game at once.
- **E32 stock buyers** are booked as financial investors, so "acquired" names the wrong buyer.
- **Tests that pin this:** scripts/v2/finance.ts FIN2–FIN5c, hygiene.ts 162–200, ws4.ts 205–212, uitest.mjs (Setup,
  board, partners, division), the fixtures (start-challenger-day400 seats), golden/ref-trace.json. All are expected to
  change.
